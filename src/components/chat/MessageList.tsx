import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';


interface MessageListProps {
    conversationId: string;
}

export default function MessageList({ conversationId }: MessageListProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    useEffect(() => {
        fetchMessages();

        // Subscribe to new messages for THIS conversation
        const channel = supabase
            .channel(`messages-${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    setMessages((prev) => [...prev, payload.new]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    async function fetchMessages() {
        setLoading(true);
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
        } else {
            setMessages(data || []);
        }
        setLoading(false);
    }

    if (loading && messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-[#8b8fa3] text-sm animate-pulse">Cargando mensajes...</div>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className="absolute inset-0 overflow-y-auto p-6 space-y-4 scroll-smooth"
        >
            {messages.map((msg) => {
                const isInbound = msg.direction === 'inbound';
                return (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex flex-col max-w-[80%]",
                            isInbound ? "mr-auto" : "ml-auto items-end"
                        )}
                    >
                        <div
                            className={cn(
                                "px-4 py-2 rounded-2xl text-sm break-words shadow-sm",
                                isInbound
                                    ? "bg-[#1a1d27] text-white rounded-tl-none border border-[#2a2e3d]"
                                    : "bg-[#2AABEE] text-white rounded-tr-none"
                            )}
                        >
                            {msg.body}
                        </div>
                        <span className="text-[10px] text-[#8b8fa3] mt-1 px-1">
                            {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
