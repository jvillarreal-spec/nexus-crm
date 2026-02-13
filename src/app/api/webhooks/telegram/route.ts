
import { NextRequest, NextResponse } from 'next/server';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';
import { BotLogic } from '@/lib/bot/bot.logic';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        // 1. Validate Secret Token
        const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
            console.error('Invalid Telegram Secret Token');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Incoming Update
        const rawUpdate = await request.json();
        const adapter = new TelegramAdapter();
        const unifiedMessage = adapter.parseIncoming(rawUpdate);

        if (!unifiedMessage) {
            // Not a message we care about (e.g. edited_message), just acknowledge
            return NextResponse.json({ ok: true });
        }

        // 3. Process Logic
        const bot = new BotLogic(adapter);
        await bot.handleIncomingMessage(unifiedMessage);

        // 4. Store in DB (Supabase)
        const supabase = await createClient();

        // a. Ensure Contact Exists
        let { data: contact } = await supabase
            .from('contacts')
            .select('id')
            .eq('channel', 'telegram')
            .eq('channel_id', unifiedMessage.chatId)
            .single();

        if (!contact) {
            const { data: newContact, error } = await supabase
                .from('contacts')
                .insert({
                    channel: 'telegram',
                    channel_id: unifiedMessage.chatId,
                    first_name: unifiedMessage.senderName,
                    username: unifiedMessage.senderUsername,
                })
                .select('id')
                .single();

            if (error) {
                console.error('Error creating contact:', error);
                // Continue processing even if contact creation fails? Ideally we need it.
            }
            contact = newContact;
        }

        if (contact) {
            // b. Ensure Conversation Exists
            let { data: conversation } = await supabase
                .from('conversations')
                .select('id')
                .eq('contact_id', contact.id)
                .eq('status', 'open')
                .single();

            if (!conversation) {
                const { data: newConversation } = await supabase
                    .from('conversations')
                    .insert({
                        contact_id: contact.id,
                        channel: 'telegram',
                        status: 'open',
                    })
                    .select('id')
                    .single();
                conversation = newConversation;
            }

            // c. Create Message
            if (conversation) {
                await supabase.from('messages').insert({
                    conversation_id: conversation.id,
                    channel_message_id: unifiedMessage.channelMessageId,
                    direction: 'inbound',
                    sender_type: 'customer',
                    content_type: unifiedMessage.contentType,
                    body: unifiedMessage.body,
                    media_url: unifiedMessage.mediaUrl,
                });

                // d. Update Conversation Metadata
                await supabase.from('conversations').update({
                    last_message_at: new Date().toISOString(),
                    unread_count: 1 // Increment logic should be atomic or handle read status
                }).eq('id', conversation.id);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Error processing Telegram webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'active', service: 'Telegram Webhook' });
}
