
import { NextRequest, NextResponse } from 'next/server';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';
import { BotLogic } from '@/lib/bot/bot.logic';
import { createAdminClient } from '@/lib/supabase/admin';

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
        const bot = new BotLogic(adapter);
        await bot.handleIncomingMessage(unifiedMessage);

        // 4. Store in DB (Supabase Admin)
        console.log('Storing in database...');
        const supabase = createAdminClient();

        // a. Ensure Contact Exists
        let { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id')
            .eq('channel', 'telegram')
            .eq('channel_id', unifiedMessage.chatId)
            .maybeSingle(); // maybeSingle returns null instead of throwing if not found

        if (contactError) {
            console.error('Error fetching contact:', contactError);
        }

        if (!contact) {
            console.log('Creating new contact...');
            const { data: newContact, error: insertError } = await supabase
                .from('contacts')
                .insert({
                    channel: 'telegram',
                    channel_id: unifiedMessage.chatId,
                    first_name: unifiedMessage.senderName,
                    username: unifiedMessage.senderUsername,
                })
                .select('id')
                .single();

            if (insertError) {
                console.error('Error creating contact:', insertError);
            }
            contact = newContact;
        }

        if (contact) {
            console.log(`Contact ID: ${contact.id}. Finding/Creating conversation...`);
            // b. Ensure Conversation Exists
            let { data: conversation, error: convError } = await supabase
                .from('conversations')
                .select('id, unread_count')
                .eq('contact_id', contact.id)
                .eq('status', 'open')
                .maybeSingle();

            if (convError) console.error('Error fetching conversation:', convError);

            if (!conversation) {
                console.log('Creating new conversation...');
                const { data: newConversation, error: createConvError } = await supabase
                    .from('conversations')
                    .insert({
                        contact_id: contact.id,
                        channel: 'telegram',
                        status: 'open',
                    })
                    .select('id')
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
