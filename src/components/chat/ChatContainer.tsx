'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { SalesCoach } from './SalesCoach';

export default function ChatContainer() {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [activeContact, setActiveContact] = useState<any | null>(null);
    const [conversationSummary, setConversationSummary] = useState<string | null>(null);
    const [showSummary, setShowSummary] = useState(true);

    const supabase = createClient();
    const searchParams = useSearchParams();
    const contactIdFromUrl = searchParams.get('contactId');

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

        const subscription = supabase
            .channel(`active_conv_${selectedConversationId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'conversations',
                filter: `id=eq.${selectedConversationId}`
            }, (payload: any) => {
                if (payload.new.summary) {
                    setConversationSummary(payload.new.summary);
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
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

    return (
        <div className="flex h-full overflow-hidden bg-[#0f1117]">
            {/* Sidebar: Conversation List */}
            <div className="w-full md:w-80 border-r border-[#2a2e3d] flex flex-col bg-[#1a1d27]">
                <div className="p-4 border-b border-[#2a2e3d]">
                    <h2 className="text-xl font-bold text-white tracking-tight">Chats</h2>
                    <div className="mt-1 text-[10px] text-[#2AABEE] font-bold uppercase tracking-widest">
                        Canal: Telegram
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <ConversationList
                        onSelect={(id: string, contact: any) => {
                            setSelectedConversationId(id);
                            setActiveContact(contact);
                            // Also fetch summary if not already in contact metadata
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
            <div className="flex-1 flex overflow-hidden">
                {selectedConversationId ? (
                    <>
                        {/* Center: Chat View */}
                        <div className="flex-1 flex flex-col bg-[#0f1117] relative">
                            {/* Chat Header */}
                            <div className="h-16 px-6 border-b border-[#2a2e3d] flex items-center justify-between bg-[#1a1d27]/80 backdrop-blur-md z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#232732] flex items-center justify-center font-bold text-[#2AABEE] border border-[#2AABEE]/20 shadow-lg shadow-[#2AABEE]/5">
                                        {activeContact?.first_name?.[0] || 'U'}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">
                                            {activeContact?.first_name} {activeContact?.last_name || ''}
                                        </h3>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                            <p className="text-[11px] text-[#8b8fa3]">
                                                @{activeContact?.username || 'user'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

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

                            {/* AI Summary Bar */}
                            {showSummary && conversationSummary && (
                                <div className="px-6 py-3 bg-[#1a1d27] border-b border-[#2AABEE]/20">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 p-1 bg-[#2AABEE]/10 rounded-md">
                                            <MessageSquare size={12} className="text-[#2AABEE]" />
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#2AABEE] mb-0.5">Contexto AI</div>
                                            <p className="text-[11px] text-[#8b8fa3] leading-relaxed italic">
                                                "{conversationSummary}"
                                            </p>
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

                        {/* Right Sidebar: AI Sales Coach */}
                        <div className="hidden lg:block w-80 xl:w-96 p-4 border-l border-[#2a2e3d] bg-[#0f1117]">
                            <SalesCoach
                                advice={activeContact?.metadata?.ai_sales_advice}
                                error={activeContact?.metadata?.ai_error}
                            />
                        </div>
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
