'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    MessageSquare,
    Clock,
    CheckCircle2,
    RotateCcw,
    ChevronLeft,
    Info,
    X,
    UserPlus,
    Shield,
    ChevronRight,
    Users
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { SalesCoach } from './SalesCoach';
import { transferConversation, closeConversation } from '@/app/actions/admin';


export default function ChatContainer() {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [activeContact, setActiveContact] = useState<any | null>(null);
    const [conversationSummary, setConversationSummary] = useState<string | null>(null);
    const [showSummary, setShowSummary] = useState(true);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [showMobileCoach, setShowMobileCoach] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [companyAgents, setCompanyAgents] = useState<any[]>([]);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [followUpDate, setFollowUpDate] = useState('');

    const supabase = createClient();
    const searchParams = useSearchParams();
    const contactIdFromUrl = searchParams.get('contactId');

    useEffect(() => {
        async function fetchInitialData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                setProfile(profileData);

                if (profileData && (profileData.role === 'org_admin' || profileData.role === 'super_admin')) {
                    const { data: agents } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('company_id', profileData.company_id)
                        .neq('id', user.id);
                    setCompanyAgents(agents || []);
                }
            }
        }
        fetchInitialData();
    }, []);

    async function handleTransfer(agentId: string) {
        if (!selectedConversationId || !activeContact) return;
        setIsUpdatingStatus(true);

        const result = await transferConversation(selectedConversationId, activeContact.id, agentId);

        if (result.success) {
            setShowTransferModal(false);
            // Si el admin quiere dejar de ver el chat tras transferirlo (si no es su chat)
            // o si queremos simplemente refrescar. Veremos el efecto por RLS/Suscripción.
            setSelectedConversationId(null);
            setActiveContact(null);
        } else {
            alert('Error al transferir: ' + result.error);
        }
        setIsUpdatingStatus(false);
    }

    async function updateConversationStatus(status: string, followUpAt?: string) {
        if (!selectedConversationId) return;
        setIsUpdatingStatus(true);

        // Special handling for CLOSING a conversation to trigger the Telegram farewell message
        if (status === 'closed') {
            const result = await closeConversation(selectedConversationId);
            if (result.success) {
                setSelectedConversationId(null);
                setActiveContact(null);
            } else {
                console.error('Error closing conversation:', result.error);
                alert('Error al finalizar el chat');
            }
            setIsUpdatingStatus(false);
            return;
        }

        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        };

        if (followUpAt) {
            updateData.follow_up_at = followUpAt;
        }

        const { error } = await supabase
            .from('conversations')
            .update(updateData)
            .eq('id', selectedConversationId);

        if (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar el estado del chat');
        } else {
            setSelectedConversationId(null);
            setActiveContact(null);
            setShowDatePicker(false);
        }
        setIsUpdatingStatus(false);
    }


    // Handle deep linking and metadata refresh
    useEffect(() => {
        if (contactIdFromUrl) {
            fetchConversationForContact(contactIdFromUrl);
        }
    }, [contactIdFromUrl]);

    // Real-time metadata sync for the active contact (to see Sales Coach live updates)
    useEffect(() => {
        if (!activeContact?.id) return;

        const subscription = supabase
            .channel(`active_contact_${activeContact.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'contacts',
                filter: `id=eq.${activeContact.id}`
            }, (payload: any) => {
                setActiveContact(payload.new);
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [activeContact?.id]);

    // Real-time summary sync for the active conversation
    useEffect(() => {
        if (!selectedConversationId) return;

        const channel = supabase
            .channel(`active_conv_${selectedConversationId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'conversations',
                filter: `id=eq.${selectedConversationId}`
            }, (payload: any) => {
                console.log('Conversation update detected:', payload);
                if (payload.new && payload.new.summary !== undefined) {
                    setConversationSummary(payload.new.summary);
                }
            })
            .subscribe();

        // Also listen for NEW MESSAGES to force a summary refresh after a short delay
        const msgChannel = supabase
            .channel(`message_trigger_${selectedConversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${selectedConversationId}`
            }, () => {
                // Wait 3 seconds for AI to process, then force refresh summary
                setTimeout(() => {
                    supabase
                        .from('conversations')
                        .select('summary')
                        .eq('id', selectedConversationId)
                        .single()
                        .then(({ data }) => {
                            if (data?.summary) setConversationSummary(data.summary);
                        });
                }, 3500);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(msgChannel);
        };
    }, [selectedConversationId]);

    async function fetchConversationForContact(contactId: string) {
        const { data: conversation, error } = await supabase
            .from('conversations')
            .select('id, summary, contacts(*)')
            .eq('contact_id', contactId)
            .eq('status', 'open')
            .maybeSingle();

        if (conversation) {
            setSelectedConversationId(conversation.id);
            setConversationSummary(conversation.summary);
            setActiveContact(conversation.contacts as any);
        }
    }

    const isAdmin = profile?.role === 'org_admin' || profile?.role === 'super_admin';

    return (
        <div className="flex h-full overflow-hidden bg-[#0f1117]">
            {/* Sidebar: Conversation List */}
            <div className={cn(
                "w-full md:w-80 border-r border-[#2a2e3d] flex flex-col bg-[#1a1d27] transition-all duration-300",
                selectedConversationId ? "hidden md:flex" : "flex"
            )}>
                <div className="p-4 border-b border-[#2a2e3d]">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white tracking-tight">Chats</h2>
                        {isAdmin && (
                            <div className="flex items-center gap-1 bg-[#2AABEE]/10 px-2 py-1 rounded-md">
                                <Shield size={10} className="text-[#2AABEE]" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#2AABEE]">Oversight</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-1 text-[10px] text-[#2AABEE] font-bold uppercase tracking-widest">
                        Canal: Telegram
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <ConversationList
                        onSelect={(id: string, contact: any) => {
                            setSelectedConversationId(id);
                            setActiveContact(contact);
                            supabase
                                .from('conversations')
                                .select('summary')
                                .eq('id', id)
                                .single()
                                .then(({ data }) => setConversationSummary(data?.summary));
                        }}
                        selectedId={selectedConversationId}
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 flex overflow-hidden",
                !selectedConversationId && "hidden md:flex"
            )}>
                {selectedConversationId ? (
                    <>
                        {/* Center: Chat View */}
                        <div className="flex-1 flex flex-col bg-[#0f1117] relative">
                            {/* Chat Header */}
                            <div className="h-16 px-4 md:px-6 border-b border-[#2a2e3d] flex items-center justify-between bg-[#1a1d27]/80 backdrop-blur-md z-10">
                                <div className="flex items-center gap-2 md:gap-3">
                                    {/* Back Button (Mobile Only) */}
                                    <button
                                        onClick={() => setSelectedConversationId(null)}
                                        className="md:hidden p-2 -ml-2 text-[#8b8fa3] hover:text-white"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>

                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#232732] flex items-center justify-center font-bold text-[#2AABEE] border border-[#2AABEE]/20 shadow-lg shadow-[#2AABEE]/5 shrink-0">
                                        {activeContact?.first_name?.[0] || 'U'}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-semibold text-white truncate">
                                            {activeContact?.first_name} {activeContact?.last_name || ''}
                                        </h3>
                                        <div className="flex items-center gap-1.5 leading-none">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0"></div>
                                            <p className="text-[10px] text-[#8b8fa3] truncate">
                                                @{activeContact?.username || 'user'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 md:gap-2 relative">
                                    {/* Sales Coach Toggle (Mobile Only) */}
                                    <button
                                        onClick={() => setShowMobileCoach(true)}
                                        className="lg:hidden p-2 text-[#2AABEE] bg-[#2AABEE]/10 rounded-lg"
                                    >
                                        <Info size={18} />
                                    </button>

                                    {/* Admin Transfer Button */}
                                    {isAdmin && (
                                        <button
                                            onClick={() => setShowTransferModal(true)}
                                            className="p-2 text-[#8b8fa3] hover:text-[#2AABEE] hover:bg-[#2AABEE]/10 rounded-lg transition-all"
                                            title="Transferir a otro comercial"
                                        >
                                            <UserPlus size={18} />
                                        </button>
                                    )}

                                    {/* Transfer Modal Overlay */}
                                    {showTransferModal && (
                                        <div className="absolute top-full right-0 mt-2 w-64 bg-[#1a1d27] border border-[#2a2e3d] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-200">
                                            <div className="p-4 border-b border-[#2a2e3d] bg-[#232732]/50">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#2AABEE]">Transferir Conversation</h4>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto py-2">
                                                {companyAgents.length === 0 ? (
                                                    <div className="px-4 py-3 text-xs text-[#4a4e5d] italic">No hay otros comerciales disponibles</div>
                                                ) : (
                                                    companyAgents.map(agent => (
                                                        <button
                                                            key={agent.id}
                                                            onClick={() => handleTransfer(agent.id)}
                                                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#232732] text-left transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-[#1a1d27] flex items-center justify-center text-[10px] text-white font-bold border border-[#2a2e3d]">
                                                                    {agent.full_name?.[0] || 'A'}
                                                                </div>
                                                                <span className="text-xs text-[#8b8fa3] group-hover:text-white">{agent.full_name}</span>
                                                            </div>
                                                            <ChevronRight size={14} className="text-[#4a4e5d]" />
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setShowDatePicker(!showDatePicker)}
                                        disabled={isUpdatingStatus}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 transition-all active:scale-95",
                                            showDatePicker ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]" : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20"
                                        )}
                                        title="Marcar para seguimiento"
                                    >
                                        <Clock size={16} />
                                        <span className="hidden sm:inline">Seguimiento</span>
                                    </button>

                                    {/* Date Picker Overlay */}
                                    {showDatePicker && (
                                        <div className="absolute top-full right-0 mt-2 p-4 bg-[#1a1d27] border border-[#2a2e3d] rounded-2xl shadow-2xl z-50 w-72 md:w-64 animate-in zoom-in-95 duration-200">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8b8fa3] mb-3">Programar Seguimiento</div>
                                            <input
                                                type="datetime-local"
                                                value={followUpDate}
                                                onChange={(e) => setFollowUpDate(e.target.value)}
                                                className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-[#2AABEE] transition-all mb-4"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowDatePicker(false)}
                                                    className="flex-1 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase text-[#8b8fa3] hover:bg-[#232732]"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => updateConversationStatus('pending', followUpDate)}
                                                    disabled={!followUpDate || isUpdatingStatus}
                                                    className="flex-1 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50"
                                                >
                                                    Agendar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => updateConversationStatus('closed')}
                                        disabled={isUpdatingStatus}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50 active:scale-95"
                                        title="Finalizar conversación"
                                    >
                                        <CheckCircle2 size={16} />
                                        <span className="hidden sm:inline">Finalizar</span>
                                    </button>
                                    <div className="w-px h-4 bg-[#2a2e3d] mx-1 hidden sm:block" />
                                    <button
                                        type="button"
                                        onClick={() => setShowSummary(!showSummary)}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer",
                                            showSummary
                                                ? "bg-[#2AABEE] text-white border-[#2AABEE]"
                                                : "bg-transparent text-[#8b8fa3] border-[#2a2e3d] hover:text-white"
                                        )}
                                    >
                                        {showSummary ? "Ocultar" : "Resumen"}
                                    </button>
                                </div>
                            </div>

                            {/* AI Summary Bar */}
                            {showSummary && (
                                <div className="px-6 py-3 bg-[#1a1d27] border-b border-[#2AABEE]/20 animate-in fade-in duration-300">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 p-1 bg-[#2AABEE]/10 rounded-md">
                                            <MessageSquare size={12} className="text-[#2AABEE]" />
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#2AABEE] mb-0.5">Contexto AI</div>
                                            {conversationSummary ? (
                                                <p className="text-[11px] text-[#8b8fa3] leading-relaxed italic">
                                                    "{conversationSummary}"
                                                </p>
                                            ) : (
                                                <p className="text-[11px] text-[#4a4e5d] leading-relaxed italic animate-pulse">
                                                    Generando contexto inteligente para esta conversación... (Envía o recibe un mensaje para activarlo)
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Messages Area */}
                            <div className="flex-1 overflow-hidden relative bg-[#0f1117]">
                                <MessageList conversationId={selectedConversationId} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-[#1a1d27] border-t border-[#2a2e3d]">
                                {activeContact && (
                                    <ChatInput
                                        conversationId={selectedConversationId}
                                        contactId={activeContact.id}
                                        contactName={activeContact.first_name}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Right Sidebar: AI Sales Coach (Desktop) */}
                        <div className="hidden lg:block w-80 xl:w-96 p-4 border-l border-[#2a2e3d] bg-[#0f1117]">
                            <SalesCoach
                                advice={activeContact?.metadata?.ai_sales_advice}
                                error={activeContact?.metadata?.ai_error}
                            />
                        </div>

                        {/* Mobile AI Sales Coach Drawer */}
                        {showMobileCoach && (
                            <div className="fixed inset-0 z-[100] lg:hidden animate-in fade-in duration-200">
                                <div
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                    onClick={() => setShowMobileCoach(false)}
                                />
                                <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-[#0f1117] shadow-2xl animate-in slide-in-from-right duration-300">
                                    <div className="flex flex-col h-full">
                                        <div className="p-4 border-b border-[#2a2e3d] flex items-center justify-between bg-[#1a1d27]">
                                            <h3 className="font-bold text-white flex items-center gap-2">
                                                <Info size={18} className="text-[#2AABEE]" />
                                                AI Sales Coach
                                            </h3>
                                            <button
                                                onClick={() => setShowMobileCoach(false)}
                                                className="p-2 text-[#8b8fa3] hover:text-white"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-hidden p-4">
                                            <SalesCoach
                                                advice={activeContact?.metadata?.ai_sales_advice}
                                                error={activeContact?.metadata?.ai_error}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#8b8fa3] space-y-4 bg-[#0f1117] bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                        <div className="p-6 bg-[#1a1d27] rounded-3xl border border-[#2a2e3d] shadow-2xl">
                            <MessageSquare className="w-16 h-16 text-[#2AABEE] opacity-40" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-white font-medium">No hay chat seleccionado</h3>
                            <p className="text-xs mt-1">Selecciona una conversación para desbloquear el AI Sales Coach</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
