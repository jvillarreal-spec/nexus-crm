import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Zap, Search, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ChatInputProps {
    conversationId: string;
    contactId: string;
}

interface QuickReply {
    id: string;
    title: string;
    shortcut: string;
    content: string;
}

export default function ChatInput({ conversationId, contactId }: ChatInputProps) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [replies, setReplies] = useState<QuickReply[]>([]);
    const [loadingReplies, setLoadingReplies] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const popoverRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    // Fetch replies when popover opens
    useEffect(() => {
        if (showQuickReplies) {
            fetchQuickReplies();
        }
    }, [showQuickReplies]);

    // Close popover on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setShowQuickReplies(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchQuickReplies = async () => {
        setLoadingReplies(true);
        const { data, error } = await supabase
            .from('quick_replies')
            .select('id, title, shortcut, content')
            .order('title', { ascending: true });

        if (!error && data) {
            setReplies(data);
        }
        setLoadingReplies(false);
    };

    const handleSelectReply = (content: string) => {
        setText(content);
        setShowQuickReplies(false);
        // Focus textarea if needed (usually happens automatically via state update)
    };

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
            }

        } catch (error) {
            console.error('Error sending message:', error);
            setText(messageBody); // Restore text on error
        } finally {
            setSending(false);
        }
    };

    const filteredReplies = replies.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.shortcut?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="relative max-w-5xl mx-auto">
            {/* Quick Replies Popover */}
            {showQuickReplies && (
                <div
                    ref={popoverRef}
                    className="absolute bottom-full mb-3 left-0 w-80 bg-[#1a1d27] border border-[#2a2e3d] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-bottom-2 duration-200"
                >
                    <div className="p-3 border-b border-[#2a2e3d] bg-[#1a1d27]/80 backdrop-blur-sm">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4e5d]" size={14} />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Buscar respuesta..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-lg py-1.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-[#2AABEE]/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {loadingReplies ? (
                            <div className="py-8 flex justify-center">
                                <Loader2 size={16} className="animate-spin text-[#2AABEE]" />
                            </div>
                        ) : filteredReplies.length > 0 ? (
                            filteredReplies.map((reply) => (
                                <button
                                    key={reply.id}
                                    onClick={() => handleSelectReply(reply.content)}
                                    className="w-full text-left p-2.5 hover:bg-[#232732] rounded-xl transition-all group"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-[#2AABEE] transition-colors">
                                            {reply.title}
                                        </span>
                                        {reply.shortcut && (
                                            <span className="text-[9px] text-[#2AABEE] bg-[#2AABEE]/10 px-1.5 py-0.5 rounded font-bold">
                                                {reply.shortcut}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-[#8b8fa3] line-clamp-2 leading-relaxed italic">
                                        "{reply.content}"
                                    </p>
                                </button>
                            ))
                        ) : (
                            <div className="py-8 text-center text-[#4a4e5d] text-[10px] italic">
                                No se encontraron respuestas
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-t border-[#2a2e3d] bg-[#1a1d27]/80">
                        <a
                            href="/quick-replies"
                            className="block text-center py-1.5 text-[10px] font-bold text-[#8b8fa3] hover:text-[#2AABEE] transition-colors"
                        >
                            GESTIONAR RESPUESTAS
                        </a>
                    </div>
                </div>
            )}

            <form
                onSubmit={handleSendMessage}
                className="flex items-end gap-2"
            >
                <div className="flex items-center">
                    <button
                        type="button"
                        onClick={() => setShowQuickReplies(!showQuickReplies)}
                        className={cn(
                            "p-2.5 rounded-xl transition-all",
                            showQuickReplies ? "text-[#2AABEE] bg-[#2AABEE]/10" : "text-[#8b8fa3] hover:text-white hover:bg-[#232732]"
                        )}
                        title="Respuestas Rápidas"
                    >
                        <Zap size={20} className={showQuickReplies ? "fill-[#2AABEE]" : ""} />
                    </button>
                    <button
                        type="button"
                        className="p-2.5 text-[#8b8fa3] hover:text-white hover:bg-[#232732] rounded-xl transition-all"
                    >
                        <Paperclip size={20} />
                    </button>
                </div>

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
                        className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-[#2AABEE] resize-none overflow-hidden placeholder-[#4a4e5d]"
                        style={{ minHeight: '48px', maxHeight: '150px' }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    className={cn(
                        "p-3 rounded-2xl transition-all",
                        text.trim() && !sending
                            ? "bg-[#2AABEE] text-white hover:bg-[#2AABEE]/90 shadow-lg shadow-[#2AABEE]/20 active:scale-95"
                            : "bg-[#232732] text-[#4a4e5d] cursor-not-allowed"
                    )}
                >
                    <Send size={20} className={sending ? "animate-pulse" : ""} />
                </button>
            </form>
        </div>
    );
}
