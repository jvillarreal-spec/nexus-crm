
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ConversationListProps {
    onSelect: (id: string, contact: any) => void;
    selectedId: string | null;
}

export default function ConversationList({ onSelect, selectedId }: ConversationListProps) {
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchConversations();

        // Subscribe to changes in conversations
        const channel = supabase
            .channel('conversations-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'conversations' },
                () => fetchConversations()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchConversations() {
        const { data, error } = await supabase
            .from('conversations')
            .select('*, contacts(*)')
            .order('last_message_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
        } else {
            setConversations(data || []);
        }
        setLoading(false);
    }

    if (loading) {
        return (
            <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#2a2e3d]" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-[#2a2e3d] rounded w-3/4" />
                            <div className="h-3 bg-[#2a2e3d] rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="divide-y divide-[#2a2e3d]">
            {conversations.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#8b8fa3]">
                    No hay conversaciones activas
                </div>
            ) : (
                conversations.map((conv) => (
                    <button
                        key={conv.id}
                        onClick={() => onSelect(conv.id, conv.contacts)}
                        className={cn(
                            "w-full p-4 flex items-center gap-3 hover:bg-[#232732] transition-colors text-left",
                            selectedId === conv.id && "bg-[#232732] border-l-4 border-[#2AABEE]"
                        )}
                    >
                        <div className="w-12 h-12 rounded-full bg-[#232732] flex items-center justify-center font-bold text-[#2AABEE] shrink-0 border border-[#2a2e3d]">
                            {conv.contacts?.first_name?.[0] || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                                <h4 className="text-sm font-semibold text-white truncate">
                                    {conv.contacts?.first_name} {conv.contacts?.last_name || ''}
                                </h4>
                                <span className="text-[10px] text-[#8b8fa3]">
                                    {conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: es }) : ''}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <p className="text-[#8b8fa3] truncate pr-2">
                                    {/* In a real app we would join the last message body here */}
                                    Nueva conversación por Telegram
                                </p>
                                {conv.unread_count > 0 && (
                                    <span className="bg-[#2AABEE] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {conv.unread_count}
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                ))
            )}
        </div>
    );
}
