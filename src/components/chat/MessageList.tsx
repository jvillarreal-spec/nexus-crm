import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
    conversationId: string;
}

const PAGE_SIZE = 20;

export default function MessageList({ conversationId }: MessageListProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    useEffect(() => {
        setMessages([]);
        setHasMore(true);
        fetchMessages(false);

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

    // Scroll to bottom when messages change ONLY if we were already at bottom or if it's the first load
    useEffect(() => {
        if (scrollRef.current && !loadingMore) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    async function fetchMessages(loadMore = false) {
        if (loadMore) setLoadingMore(true);
        else setLoading(true);

        const start = loadMore ? messages.length : 0;
        const end = start + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .range(start, end);

        if (error) {
            console.error('Error fetching messages:', error);
        } else {
            const newMessages = data || [];
            if (loadMore) {
                // Keep current scroll position offset
                const scrollHeightBefore = scrollRef.current?.scrollHeight || 0;

                setMessages((prev) => [...newMessages.reverse(), ...prev]);
                setHasMore(newMessages.length === PAGE_SIZE);

                // Adjust scroll after render to maintain relative position
                setTimeout(() => {
                    if (scrollRef.current) {
                        const scrollHeightAfter = scrollRef.current.scrollHeight;
                        scrollRef.current.scrollTop = scrollHeightAfter - scrollHeightBefore;
                    }
                }, 10);
            } else {
                setMessages(newMessages.reverse());
                setHasMore(newMessages.length === PAGE_SIZE);
            }
        }

        if (loadMore) setLoadingMore(false);
        else setLoading(false);
    }

    if (loading && messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 size={24} className="text-[#2AABEE] animate-spin" />
                    <div className="text-[#8b8fa3] text-xs font-medium uppercase tracking-widest">Cargando conversación...</div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className="absolute inset-0 overflow-y-auto px-4 py-6 md:p-6 space-y-4 scroll-smooth custom-scrollbar"
        >
            {hasMore && (
                <div className="flex justify-center pb-4">
                    <button
                        onClick={() => fetchMessages(true)}
                        disabled={loadingMore}
                        className="text-[10px] font-bold text-[#8b8fa3] hover:text-[#2AABEE] bg-[#1a1d27] border border-[#2a2e3d] px-4 py-1.5 rounded-full transition-all active:scale-95 flex items-center gap-2 uppercase tracking-tighter"
                    >
                        {loadingMore ? (
                            <>
                                <Loader2 size={10} className="animate-spin" />
                                Cargando...
                            </>
                        ) : (
                            "Cargar mensajes anteriores"
                        )}
                    </button>
                </div>
            )}

            {messages.map((msg) => {
                const isInbound = msg.direction === 'inbound';
                return (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex flex-col max-w-[85%]",
                            isInbound ? "mr-auto" : "ml-auto items-end"
                        )}
                    >
                        <div
                            className={cn(
                                "px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm leading-relaxed",
                                isInbound
                                    ? "bg-[#1a1d27] text-white rounded-tl-none border border-[#2a2e3d]"
                                    : "bg-[#2AABEE] text-white rounded-tr-none shadow-lg shadow-[#2AABEE]/10"
                            )}
                        >
                            {msg.body}
                        </div>
                        <span className="text-[9px] font-bold text-[#4a4e5d] mt-1.5 px-1 uppercase tracking-tighter">
                            {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
