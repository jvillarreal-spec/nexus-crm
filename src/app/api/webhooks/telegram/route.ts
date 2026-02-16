
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

        // 3. Process Bot Logic (Asynchronous response to user)
        // Note: For now we'll store first and then analyze
        // const bot = new BotLogic(adapter);
        // await bot.handleIncomingMessage(unifiedMessage);

        // 4. Store in DB (Supabase Admin)
        console.log('Storing in database...');
        const supabase = createAdminClient();

        // a. Ensure Contact Exists
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id, tags, metadata, first_name, last_name, email')
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
                .select('id, tags, metadata, first_name, last_name, email')
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
                console.log('Creating new conversation...');
                const { data: newConversation, error: createConvError } = await supabase
                    .from('conversations')
                    .insert({
                        contact_id: currentContact.id,
                        channel: 'telegram',
                        status: 'open',
                    })
                    .select('id, unread_count')
                    .single();

                if (createConvError) console.error('Error creating conversation:', createConvError);
                conversation = newConversation;
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

                    // d. Update Conversation Metadata
                    await supabase.from('conversations').update({
                        last_message_at: new Date().toISOString(),
                        unread_count: (conversation.unread_count || 0) + 1
                    }).eq('id', conversation.id);

                    // e. AI Enrichment (Asynchronous)
                    const ai = new AIService();
                    const contactToAnalyze = currentContact; // Capture for the closure
                    ai.analyzeMessage(unifiedMessage.body, contactToAnalyze).then(async (analysis) => {
                        if (analysis) {
                            console.log('AI Analysis result:', analysis);
                            const updateData: any = {};

                            // Combine existing tags with new AI tags (unique)
                            const currentTags = contactToAnalyze.tags || [];
                            updateData.tags = Array.from(new Set([...currentTags, ...analysis.tags]));

                            // Map extracted data to contact fields
                            if (analysis.extracted_data.first_name) updateData.first_name = analysis.extracted_data.first_name;
                            if (analysis.extracted_data.last_name) updateData.last_name = analysis.extracted_data.last_name;
                            if (analysis.extracted_data.email) updateData.email = analysis.extracted_data.email;
                            if (analysis.extracted_data.phone) updateData.phone = analysis.extracted_data.phone;

                            const existingMetadata = contactToAnalyze.metadata || {};
                            updateData.metadata = {
                                ...existingMetadata,
                                ...(analysis.extracted_data.company ? { company: analysis.extracted_data.company } : {}),
                                ...(analysis.extracted_data.budget ? { estimated_budget: analysis.extracted_data.budget } : {}),
                                ai_summary: analysis.extracted_data.summary,
                                last_analysis_at: new Date().toISOString()
                            };

                            await supabase.from('contacts').update(updateData).eq('id', contactToAnalyze.id);
                            console.log('Contact enriched by AI');
                        }
                    }).catch(err => console.error('AI Enrichment failed:', err));
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
