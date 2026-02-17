
import { NextRequest, NextResponse } from 'next/server';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';
import { createAdminClient } from '@/lib/supabase/admin';
import { AIService } from '@/lib/ai/ai.service';

export async function POST(
    request: NextRequest,
    { params }: { params: { companyId: string } }
) {
    const { companyId } = params;
    console.log(`--- Multi-Tenant Telegram Webhook: Company ${companyId} ---`);

    try {
        const supabase = createAdminClient();

        // 1. Fetch Company Bot Credentials
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('telegram_token, telegram_secret_token')
            .eq('id', companyId)
            .single();

        if (companyError || !company?.telegram_token) {
            console.error('Company or Token not found:', companyError);
            return NextResponse.json({ error: 'Company not configured for Telegram' }, { status: 404 });
        }

        // 2. Validate Secret Token (If configured)
        const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (company.telegram_secret_token && secretToken !== company.telegram_secret_token) {
            console.error('Unauthorized: Invalid Secret Token');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 3. Parse Incoming Update
        const rawUpdate = await request.json();
        const adapter = new TelegramAdapter(company.telegram_token);
        const unifiedMessage = adapter.parseIncoming(rawUpdate);

        if (!unifiedMessage) {
            console.log('Ignored update (not a supported message type)');
            return NextResponse.json({ ok: true });
        }

        // 4. Process Message (Same logic as global hook, but pinned to companyId)
        // a. Ensure Contact Exists
        const { data: contact } = await supabase
            .from('contacts')
            .select('id, tags, metadata, first_name, last_name, email, phone, assigned_to')
            .eq('channel', 'telegram')
            .eq('channel_id', unifiedMessage.chatId)
            .eq('company_id', companyId)
            .maybeSingle();

        let currentContact = contact;

        if (!currentContact) {
            console.log('Creating new multi-tenant contact...');
            // Round Robin for new contact
            const { data: loadData } = await supabase.rpc('get_agent_load', { org_id: companyId });
            const assignedAgentId = loadData?.[0]?.agent_id;

            const { data: newContact } = await supabase
                .from('contacts')
                .insert({
                    channel: 'telegram',
                    channel_id: unifiedMessage.chatId,
                    company_id: companyId,
                    first_name: unifiedMessage.senderName,
                    username: unifiedMessage.senderUsername,
                    assigned_to: assignedAgentId
                })
                .select('*')
                .single();
            currentContact = newContact;
        }

        if (currentContact) {
            // b. Ensure Conversation Exists
            let { data: conversation } = await supabase
                .from('conversations')
                .select('id, unread_count')
                .eq('contact_id', currentContact.id)
                .eq('status', 'open')
                .eq('company_id', companyId)
                .maybeSingle();

            if (!conversation) {
                const { data: newConv } = await supabase
                    .from('conversations')
                    .insert({
                        contact_id: currentContact.id,
                        company_id: companyId,
                        assigned_to: currentContact.assigned_to,
                        channel: 'telegram',
                        status: 'open',
                    })
                    .select('*')
                    .single();
                conversation = newConv;
            }

            // c. Create Message
            if (conversation) {
                await supabase.from('messages').insert({
                    conversation_id: conversation.id,
                    company_id: companyId,
                    channel_message_id: unifiedMessage.channelMessageId,
                    direction: 'inbound',
                    sender_type: 'customer',
                    content_type: unifiedMessage.contentType,
                    body: unifiedMessage.body,
                    media_url: unifiedMessage.mediaUrl,
                });

                // d. Updates
                await Promise.all([
                    supabase.from('conversations').update({
                        last_message_at: new Date().toISOString(),
                        unread_count: (conversation.unread_count || 0) + 1
                    }).eq('id', conversation.id),
                    supabase.from('contacts').update({
                        updated_at: new Date().toISOString()
                    }).eq('id', currentContact.id)
                ]);

                // e. AI Enrichment (Simplified for now)
                try {
                    const ai = new AIService();
                    const fullResult = await ai.processFullEnrichment(unifiedMessage.body, currentContact, "");
                    if (fullResult.analysis) {
                        await supabase.from('contacts').update({
                            tags: Array.from(new Set([...(currentContact.tags || []), ...fullResult.analysis.tags])),
                            metadata: {
                                ...(currentContact.metadata || {}),
                                ai_summary: fullResult.analysis.extracted_data.summary
                            }
                        }).eq('id', currentContact.id);
                    }
                } catch (e) {
                    console.error('AI Error:', e);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('CRITICAL: Multi-tenant Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
