
import { NextRequest, NextResponse } from 'next/server';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';
import { createAdminClient } from '@/lib/supabase/admin';
import { AIService } from '@/lib/ai/ai.service';

export async function POST(request: NextRequest) {
    console.log('--- Telegram Webhook received ---');
    try {
        // 1. Validate Secret Token
        const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
            console.error('Unauthorized: Invalid Secret Token');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Incoming Update
        const rawUpdate = await request.json();
        const adapter = new TelegramAdapter();
        const unifiedMessage = adapter.parseIncoming(rawUpdate);

        if (!unifiedMessage) {
            console.log('Ignored update (not a supported message type)');
            return NextResponse.json({ ok: true });
        }

        console.log(`Processing message from ${unifiedMessage.senderName} (${unifiedMessage.chatId})`);

        // 3. Store in DB (Supabase Admin)
        console.log('Storing in database...');
        const supabase = createAdminClient();

        // a. Ensure Contact Exists
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id, tags, metadata, first_name, last_name, email, phone')
            .eq('channel', 'telegram')
            .eq('channel_id', unifiedMessage.chatId)
            .maybeSingle();

        if (contactError) {
            console.error('Error fetching contact:', contactError);
        }

        let currentContact = contact;

        if (!currentContact) {
            console.log('Creating new contact...');
            const { data: newContact, error: insertError } = await supabase
                .from('contacts')
                .insert({
                    channel: 'telegram',
                    channel_id: unifiedMessage.chatId,
                    first_name: unifiedMessage.senderName,
                    username: unifiedMessage.senderUsername,
                })
                .select('id, tags, metadata, first_name, last_name, email, phone')
                .single();

            if (insertError) {
                console.error('Error creating contact:', insertError);
            }
            currentContact = newContact;
        }

        if (currentContact) {
            console.log(`Contact ID: ${currentContact.id}. Finding/Creating conversation...`);
            // b. Ensure Conversation Exists
            let { data: conversation, error: convError } = await supabase
                .from('conversations')
                .select('id, unread_count')
                .eq('contact_id', currentContact.id)
                .eq('status', 'open')
                .maybeSingle();

            if (convError) console.error('Error fetching conversation:', convError);

            if (!conversation) {
                console.log('Creating new conversation with Round Robin assignment...');

                // 1. Get Default Company (Nexus Global)
                const { data: company } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('slug', 'nexus-global')
                    .single();

                const companyId = company?.id;

                // 2. Round Robin: Find agents and pick the one with fewest open conversations
                // or just the next one in a sorted list.
                const { data: agents } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('company_id', companyId)
                    .eq('role', 'agent');

                let assignedAgentId = null;
                if (agents && agents.length > 0) {
                    // Optimized Round Robin: pick agent with least open conversations
                    const { data: assignments } = await supabase
                        .rpc('get_agent_load', { org_id: companyId });

                    if (assignments && assignments.length > 0) {
                        assignedAgentId = assignments[0].agent_id;
                    } else {
                        assignedAgentId = agents[0].id; // Fallback
                    }
                }

                const { data: newConversation, error: createConvError } = await supabase
                    .from('conversations')
                    .insert({
                        contact_id: currentContact.id,
                        company_id: companyId,
                        assigned_to: assignedAgentId,
                        channel: 'telegram',
                        status: 'open',
                    })
                    .select('id, unread_count')
                    .single();

                if (createConvError) console.error('Error creating conversation:', createConvError);
                conversation = newConversation;

                // Also update contact's company and assignment
                await supabase
                    .from('contacts')
                    .update({
                        company_id: companyId,
                        assigned_to: assignedAgentId
                    })
                    .eq('id', currentContact.id);
            }

            // c. Create Message
            if (conversation) {
                console.log(`Conversation ID: ${conversation.id}. Saving message...`);
                const { error: msgError } = await supabase.from('messages').insert({
                    conversation_id: conversation.id,
                    channel_message_id: unifiedMessage.channelMessageId,
                    direction: 'inbound',
                    sender_type: 'customer',
                    content_type: unifiedMessage.contentType,
                    body: unifiedMessage.body,
                    media_url: unifiedMessage.mediaUrl,
                });

                if (msgError) {
                    console.error('Error saving message:', msgError);
                } else {
                    console.log('Message saved successfully');

                    // d. Update Conversation & Contact Metadata Immediately
                    await Promise.all([
                        supabase.from('conversations').update({
                            last_message_at: new Date().toISOString(),
                            unread_count: (conversation.unread_count || 0) + 1
                        }).eq('id', conversation.id),
                        supabase.from('contacts').update({
                            updated_at: new Date().toISOString()
                        }).eq('id', currentContact.id)
                    ]);

                    // e. AI Enrichment (Optimized for Serverless)
                    try {
                        const ai = new AIService();

                        // Update Conversation Summary periodically
                        const { data: recentMessages } = await supabase
                            .from('messages')
                            .select('direction, body')
                            .eq('conversation_id', conversation.id)
                            .order('created_at', { ascending: false })
                            .limit(10);

                        if (recentMessages && recentMessages.length >= 2) {
                            console.log('AI: Updating conversation summary...');
                            const summary = await ai.generateConversationSummary(recentMessages.reverse());
                            await supabase.from('conversations').update({ summary }).eq('id', conversation.id);
                        }

                        // Always fetch latest to avoid race conditions with quick messages
                        const { data: latestContact } = await supabase
                            .from('contacts')
                            .select('*')
                            .eq('id', currentContact.id)
                            .single();

                        const contactToAnalyze = latestContact || currentContact;

                        // Fetch Knowledge Base
                        const { data: knowledge } = await supabase
                            .from('organization_knowledge')
                            .select('content')
                            .limit(1)
                            .maybeSingle();
                        const businessContext = knowledge?.content || "";

                        console.log(`AI: Processing message for ${contactToAnalyze.id}...`);

                        try {
                            // ONE SINGLE CALL for everything (Saves 50% quota)
                            const fullResult = await ai.processFullEnrichment(unifiedMessage.body, contactToAnalyze, businessContext);

                            const { analysis, advice: salesAdvice } = fullResult;

                            if (analysis || salesAdvice) {
                                const updateData: any = {};
                                const existingMetadata = contactToAnalyze.metadata || {};

                                if (analysis) {
                                    const currentTags = contactToAnalyze.tags || [];
                                    updateData.tags = Array.from(new Set([...currentTags, ...analysis.tags]));

                                    const isVal = (val: any) => val && val !== 'null' && val !== 'undefined';
                                    if (isVal(analysis.extracted_data.first_name)) updateData.first_name = analysis.extracted_data.first_name;
                                    if (isVal(analysis.extracted_data.last_name)) updateData.last_name = analysis.extracted_data.last_name;
                                    if (isVal(analysis.extracted_data.email)) updateData.email = analysis.extracted_data.email;
                                    if (isVal(analysis.extracted_data.phone)) updateData.phone = String(analysis.extracted_data.phone);
                                }

                                updateData.metadata = {
                                    ...existingMetadata,
                                    ...(analysis?.extracted_data?.company ? { company: analysis.extracted_data.company } : {}),
                                    ...(analysis?.extracted_data?.budget ? { estimated_budget: analysis.extracted_data.budget } : {}),
                                    ...(analysis?.extracted_data?.summary ? { ai_summary: analysis.extracted_data.summary } : {}),
                                    ai_sales_advice: {
                                        ...salesAdvice,
                                        suggested_status: analysis?.suggested_status || 'open'
                                    },
                                    last_analysis_at: new Date().toISOString(),
                                    ai_error: null // Reset error on success
                                };

                                await supabase.from('contacts').update(updateData).eq('id', contactToAnalyze.id);
                                console.log('AI Enrichment finished successfully');
                            }
                        } catch (enrichError: any) {
                            console.error('AI Enrichment failed:', enrichError);
                            await supabase.from('contacts').update({
                                metadata: {
                                    ...(currentContact?.metadata || {}),
                                    ai_error: enrichError.message || 'Unknown error during AI enrichment'
                                }
                            }).eq('id', currentContact.id);
                        }
                    } catch (outerError: any) {
                        console.error('Critical outer AI Enrichment failure:', outerError);
                    }
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('CRITICAL: Webhook Handler Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'active', service: 'Telegram Webhook' });
}
