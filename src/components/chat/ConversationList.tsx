
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageCircle, Clock, CheckCircle2, Shield } from 'lucide-react';

interface ConversationListProps {
    onSelect: (id: string, contact: any) => void;
    selectedId: string | null;
}

const STATUS_TABS = [
    { id: 'open', label: 'Activos', icon: MessageCircle, color: 'text-[#2AABEE]' },
    { id: 'pending', label: 'Seguimiento', icon: Clock, color: 'text-yellow-500' },
    { id: 'closed', label: 'Finalizados', icon: CheckCircle2, color: 'text-green-500' },
];

export default function ConversationList({ onSelect, selectedId }: ConversationListProps) {
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('open');
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        async function init() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('company_id, role')
                    .eq('id', user.id)
                    .single();
                setProfile(profileData);
            }
            fetchConversations();
        }
        init();

        // Subscribe to changes
        const channel = supabase
            .channel('conversations-status-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'conversations' },
                () => fetchConversations()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeTab]);

    async function fetchConversations() {
        // We need the profile to filter by company_id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData } = await supabase
            .from('profiles')
            .select('company_id, role')
            .eq('id', user.id)
            .single();

        if (!profileData) return;

        setLoading(true);
        setError(null);

        let query = supabase
            .from('conversations')
            .select('*, contacts(*), agent:profiles!conversations_assigned_to_fkey(full_name)')
            .eq('status', activeTab);

        // Multi-tenancy filter: If not super_admin, filter by company_id
        if (profileData.role !== 'super_admin') {
            query = query.eq('company_id', profileData.company_id);
        }

        const { data, error } = await query.order('last_message_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
            setError(error.message);
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

    if (error) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 text-sm mb-2">Error cargando chats</p>
                <p className="text-[#8b8fa3] text-xs">{error}</p>
                <button
                    onClick={() => fetchConversations()}
                    className="mt-4 text-[#2AABEE] text-xs font-medium hover:underline"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Status Tabs */}
            <div className="flex border-b border-[#2a2e3d] bg-[#1a1d27]/40">
                {STATUS_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex-1 flex flex-col items-center justify-center py-2.5 transition-all relative overflow-hidden group",
                                isActive ? "bg-[#232732]" : "hover:bg-[#232732]/50"
                            )}
                        >
                            <Icon
                                size={16}
                                className={cn(
                                    "mb-1 transition-transform group-hover:scale-110",
                                    isActive ? tab.color : "text-[#8b8fa3]"
                                )}
                            />
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-wider",
                                isActive ? "text-white" : "text-[#8b8fa3]"
                            )}>
                                {tab.label}
                            </span>
                            {isActive && (
                                <div className={cn(
                                    "absolute bottom-0 left-0 right-0 h-0.5 shadow-[0_0_10px_rgba(42,171,238,0.5)]",
                                    tab.id === 'open' ? "bg-[#2AABEE]" :
                                        tab.id === 'pending' ? "bg-yellow-500" : "bg-green-500"
                                )} />
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#2a2e3d]">
                {conversations.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#232732] flex items-center justify-center mx-auto mb-4 border border-[#2a2e3d]">
                            <MessageCircle className="text-[#8b8fa3] opacity-20" />
                        </div>
                        <p className="text-sm text-[#8b8fa3] font-medium">
                            {activeTab === 'open' ? 'Bandeja vacía' :
                                activeTab === 'pending' ? 'Sin seguimientos' : 'Sin chats finalizados'}
                        </p>
                    </div>
                ) : (
                    conversations.map((conv) => (
                        <button
                            key={conv.id}
                            onClick={() => onSelect(conv.id, conv.contacts)}
                            className={cn(
                                "w-full p-4 flex items-center gap-3 hover:bg-[#232732] transition-all text-left relative group",
                                selectedId === conv.id && "bg-[#232732]"
                            )}
                        >
                            {selectedId === conv.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2AABEE] shadow-[0_0_15px_rgba(42,171,238,0.4)]" />
                            )}
                            <div className="w-12 h-12 rounded-full bg-[#232732] flex items-center justify-center font-bold text-[#2AABEE] shrink-0 border border-[#2a2e3d]">
                                {conv.contacts?.first_name?.[0] || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h4 className="text-sm font-semibold text-white truncate">
                                        {conv.contacts?.first_name} {conv.contacts?.last_name || ''}
                                    </h4>
                                    <span className="text-[10px] text-[#8b8fa3]">
                                        {activeTab === 'pending' && conv.follow_up_at ? (
                                            <div className="flex items-center gap-1 text-yellow-500 font-bold">
                                                <Clock size={10} />
                                                {formatDistanceToNow(new Date(conv.follow_up_at), { addSuffix: true, locale: es })}
                                            </div>
                                        ) : (
                                            conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: es }) : ''
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <p className="text-[#8b8fa3] truncate italic">
                                            {conv.follow_up_at && activeTab === 'pending' ? 'Seguimiento programado' : 'Nueva conversación por Telegram'}
                                        </p>
                                    </div>
                                    {conv.agent?.full_name && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#2AABEE]/10 border border-[#2AABEE]/20 rounded-md shrink-0">
                                            <Shield size={10} className="text-[#2AABEE]" />
                                            <span className="text-[9px] font-black text-[#2AABEE] uppercase tracking-wider truncate max-w-[80px]">
                                                {conv.agent.full_name.split(' ')[0]}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* SLA Warning: More than 15 mins unread */}
                                        {conv.unread_count > 0 && conv.last_message_at && (new Date().getTime() - new Date(conv.last_message_at).getTime() > 15 * 60 * 1000) && (
                                            <span className="bg-orange-500/20 text-orange-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-orange-500/30 animate-pulse">
                                                ALERTA SLA
                                            </span>
                                        )}
                                        {conv.unread_count > 0 && (
                                            <span className="bg-[#2AABEE] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg shadow-[#2AABEE]/20">
                                                {conv.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
