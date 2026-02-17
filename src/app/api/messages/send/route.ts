
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';

export async function POST(request: Request) {
    try {
        const { contactId, conversationId, text, messageId } = await request.json();

        if (!contactId || !text) {
            return NextResponse.json({ error: 'Missing contactId or text' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Get contact details (channel_id is the Telegram chat_id)
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('channel_id')
            .eq('id', contactId)
            .single();

        if (contactError || !contact) {
            console.error('Contact not found:', contactError);
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // 2. Send message via Telegram Adapter
        const telegram = new TelegramAdapter();

        // Use sendTextMessage instead of sendMessage
        try {
            await telegram.sendTextMessage(contact.channel_id, text);

            // After sending, update conversation summary in background
            (async () => {
                try {
                    const { AIService } = await import('@/lib/ai/ai.service');
                    const ai = new AIService();

                    const activeConvId = conversationId;

                    if (activeConvId) {
                        const { data: recentMessages } = await supabase
                            .from('messages')
                            .select('direction, body')
                            .eq('conversation_id', activeConvId)
                            .order('created_at', { ascending: false })
                            .limit(10);

                        if (recentMessages && recentMessages.length >= 2) {
                            console.log('AI: Updating summary after outbound message...');
                            const summary = await ai.generateConversationSummary(recentMessages.reverse());
                            await supabase
                                .from('conversations')
                                .update({ summary })
                                .eq('id', activeConvId);
                        }
                    } else {
                        console.warn('AI: No conversationId provided for summary update');
                    }
                } catch (summaryErr) {
                    console.error('Error updating summary after send:', summaryErr);
                }
            })();

            return NextResponse.json({ success: true });
        } catch (telegramError: any) {
            console.error('Telegram API error:', telegramError);
            return NextResponse.json({ error: telegramError.message }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Internal server error sending message:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
