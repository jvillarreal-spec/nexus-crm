'use client';

import { useState, useEffect } from 'react';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare } from 'lucide-react';


interface Contact {
    id: string;
    first_name: string;
    last_name?: string;
    username?: string;
    // Add any other properties of a contact if known
}

export default function ChatContainer() {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [activeContact, setActiveContact] = useState<Contact | null>(null); // Fixed 'any' type
    const supabase = createClient();

    return (
        <div className="flex h-full overflow-hidden bg-[#0f1117]">
            {/* Sidebar: Conversation List */}
            <div className="w-full md:w-80 lg:w-96 border-r border-[#2a2e3d] flex flex-col bg-[#1a1d27]">
                <div className="p-4 border-b border-[#2a2e3d]">
                    <h2 className="text-xl font-bold text-white">Mensajes</h2>
                    <div className="mt-2 text-sm text-[#8b8fa3]">
                        Telegram
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <ConversationList
                        onSelect={(id: string, contact: any) => {
                            setSelectedConversationId(id);
                            setActiveContact(contact);
                        }}
                        selectedId={selectedConversationId}
                    />
                </div>
            </div>

            {/* Main: Chat View */}
            <div className="hidden md:flex flex-1 flex-col bg-[#0f1117]">
                {selectedConversationId ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-6 border-b border-[#2a2e3d] flex items-center justify-between bg-[#1a1d27]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#232732] flex items-center justify-center font-bold text-[#2AABEE]">
                                    {activeContact?.first_name?.[0] || 'U'}
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">
                                        {activeContact?.first_name} {activeContact?.last_name || ''}
                                    </h3>
                                    <p className="text-xs text-[#8b8fa3]">
                                        @{activeContact?.username || 'user'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {/* Actions could go here */}
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-hidden relative">
                            <MessageList conversationId={selectedConversationId} />
                        </div>
                        {/* Input */}
                        {selectedConversationId && activeContact?.id && (
                            <ChatInput conversationId={selectedConversationId} contactId={activeContact.id} />
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#8b8fa3] space-y-4">
                        <div className="p-4 bg-[#1a1d27] rounded-full">
                            <MessageSquare className="w-12 h-12 text-[#8b8fa3] opacity-20" />
                        </div>
                        <p className="text-sm">Selecciona una conversación para empezar</p>
                    </div>
                )}
            </div>
        </div>
    );
}
