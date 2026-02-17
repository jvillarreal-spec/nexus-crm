import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Zap, Search, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';


interface ChatInputProps {
    conversationId: string;
    contactId: string;
    contactName?: string;
}

interface QuickReply {
    id: string;
    title: string;
    shortcut: string;
    content: string;
    category: string;
}

export default function ChatInput({ conversationId, contactId, contactName }: ChatInputProps) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [replies, setReplies] = useState<QuickReply[]>([]);
    const [loadingReplies, setLoadingReplies] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const popoverRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const supabase = createClient();

    // Fetch replies when popover opens
    useEffect(() => {
        if (showQuickReplies) {
            fetchQuickReplies();
            setSelectedIndex(0);
        }
    }, [showQuickReplies]);

    // Detect slash command
    useEffect(() => {
        if (text === '/') {
            setShowQuickReplies(true);
            setSearchQuery('');
        } else if (showQuickReplies && text === '') {
            setShowQuickReplies(false);
        }
    }, [text]);

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
            .select('id, title, shortcut, content, category')
            .order('title', { ascending: true });

        if (!error && data) {
            setReplies(data);
        }
        setLoadingReplies(false);
    };

    const handleSelectReply = (content: string) => {
        // Replace placeholders like {{nombre}} or {{name}}
        const personalizedContent = content.replace(/\{\{(nombre|name|first_name)\}\}/gi, contactName || 'cliente');

        setText(personalizedContent);
        setShowQuickReplies(false);

        // Focus textarea after selection
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 10);
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showQuickReplies) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredReplies.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredReplies.length) % filteredReplies.length);
            } else if (e.key === 'Enter' && filteredReplies.length > 0) {
                e.preventDefault();
                handleSelectReply(filteredReplies[selectedIndex].content);
            } else if (e.key === 'Escape') {
                setShowQuickReplies(false);
            }
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="relative max-w-5xl mx-auto">
            {/* Quick Replies Popover */}
            {showQuickReplies && (
                <div
                    ref={popoverRef}
                    className="absolute bottom-full mb-3 left-0 w-[calc(100vw-32px)] md:w-80 bg-[#1a1d27] border border-[#2a2e3d] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-bottom-2 duration-200"
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
                                onKeyDown={handleKeyDown}
                                className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-lg py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#2AABEE]/50 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="max-h-[50vh] md:max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {loadingReplies ? (
                            <div className="py-8 flex justify-center">
                                <Loader2 size={16} className="animate-spin text-[#2AABEE]" />
                            </div>
                        ) : filteredReplies.length > 0 ? (
                            filteredReplies.map((reply, idx) => (
                                <button
                                    key={reply.id}
                                    onClick={() => handleSelectReply(reply.content)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={cn(
                                        "w-full text-left p-3 md:p-2.5 rounded-xl transition-all group",
                                        selectedIndex === idx ? "bg-[#2AABEE]/10 border border-[#2AABEE]/20" : "hover:bg-[#232732] border border-transparent"
                                    )}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex flex-col">
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-tight transition-colors",
                                                selectedIndex === idx ? "text-[#2AABEE]" : "text-white group-hover:text-[#2AABEE]"
                                            )}>
                                                {reply.title}
                                            </span>
                                            <span className="text-[8px] text-[#4a4e5d] font-bold uppercase tracking-tighter">{reply.category || 'General'}</span>
                                        </div>
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
                            <div className="py-12 text-center text-[#4a4e5d] text-xs italic">
                                No se encontraron respuestas
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t border-[#2a2e3d] bg-[#1a1d27]/80">
                        <a
                            href="/quick-replies"
                            className="block text-center py-2 text-[10px] font-black text-[#8b8fa3] hover:text-[#2AABEE] tracking-widest transition-colors"
                        >
                            GESTIONAR RESPUESTAS
                        </a>
                    </div>
                </div>
            )}

            <form
                onSubmit={handleSendMessage}
                className="flex items-end gap-1.5 md:gap-2"
            >
                <div className="flex items-center">
                    <button
                        type="button"
                        onClick={() => setShowQuickReplies(!showQuickReplies)}
                        className={cn(
                            "p-3 md:p-2.5 rounded-xl transition-all active:scale-90",
                            showQuickReplies ? "text-[#2AABEE] bg-[#2AABEE]/10" : "text-[#8b8fa3] hover:text-white hover:bg-[#232732]"
                        )}
                        title="Respuestas Rápidas"
                    >
                        <Zap size={22} className={showQuickReplies ? "fill-[#2AABEE]" : ""} />
                    </button>
                    <button
                        type="button"
                        className="hidden md:block p-2.5 text-[#8b8fa3] hover:text-white hover:bg-[#232732] rounded-xl transition-all"
                    >
                        <Paperclip size={20} />
                    </button>
                </div>

                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribe un mensaje..."
                        className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-2xl px-4 md:px-5 py-3.5 md:py-3 text-sm text-white focus:outline-none focus:border-[#2AABEE] resize-none overflow-hidden placeholder-[#4a4e5d] transition-all"
                        style={{ minHeight: '52px', maxHeight: '150px' }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    className={cn(
                        "p-3.5 md:p-3 rounded-2xl transition-all active:scale-95",
                        text.trim() && !sending
                            ? "bg-[#2AABEE] text-white hover:bg-[#2AABEE]/90 shadow-lg shadow-[#2AABEE]/20"
                            : "bg-[#232732] text-[#4a4e5d] cursor-not-allowed"
                    )}
                >
                    <Send size={22} className={sending ? "animate-pulse" : ""} />
                </button>
            </form>
        </div>
    );
}
