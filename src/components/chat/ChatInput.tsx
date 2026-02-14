'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Send, Paperclip } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ChatInputProps {
    conversationId: string;
    contactId: string;
}

export default function ChatInput({ conversationId, contactId }: ChatInputProps) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const supabase = createClient();

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!text.trim() || sending) return;

        setSending(true);
        const messageBody = text.trim();
        setText('');

        try {
            // 1. Insert message into Supabase (Outbound)
            const { data: newMessage, error: dbError } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    direction: 'outbound',
                    sender_type: 'agent',
                    content_type: 'text',
                    body: messageBody,
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // 2. Trigger Backend to send to Telegram
            // We'll create a new API route for this: /api/messages/send
            const response = await fetch('/api/messages/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId,
                    contactId,
                    text: messageBody,
                    messageId: newMessage.id
                }),
            });

            if (!response.ok) {
                console.error('Failed to send to Telegram');
                // Optionally mark message as "Failed" in UI
            }

        } catch (error) {
            console.error('Error sending message:', error);
            setText(messageBody); // Restore text on error
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="p-4 bg-[#1a1d27] border-t border-[#2a2e3d]">
            <form
                onSubmit={handleSendMessage}
                className="flex items-end gap-3 max-w-5xl mx-auto"
            >
                <button
                    type="button"
                    className="p-2 text-[#8b8fa3] hover:text-white transition-colors"
                >
                    <Paperclip size={20} />
                </button>

                <div className="flex-1 relative">
                    <textarea
                        rows={1}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Escribe un mensaje..."
                        className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2AABEE] resize-none overflow-hidden"
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    className={cn(
                        "p-2.5 rounded-xl transition-all",
                        text.trim() && !sending
                            ? "bg-[#2AABEE] text-white hover:bg-[#2AABEE]/90"
                            : "bg-[#232732] text-[#8b8fa3] cursor-not-allowed"
                    )}
                >
                    <Send size={18} className={sending ? "animate-pulse" : ""} />
                </button>
            </form>
        </div>
    );
}
