
'use client';

import React, { useEffect, useState } from 'react';
import { DealCard } from './DealCard';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

interface Contact {
    id: string;
    first_name: string;
    last_name?: string;
    tags: string[];
    metadata: any;
}

const STAGES = [
    { id: 'new', title: 'Lead Nuevo', color: 'bg-amber-500' },
    { id: 'qualified', title: 'Calificado', color: 'bg-blue-500' },
    { id: 'proposal', title: 'Propuesta', color: 'bg-purple-500' },
    { id: 'negotiation', title: 'Negociación', color: 'bg-emerald-500' },
    { id: 'closed', title: 'Cierre', color: 'bg-slate-500' },
];

export function KanbanBoard() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchContacts = async () => {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching contacts for Kanban:', error);
        } else {
            // Filter only contacts with some metadata OR specific tags to be considered "Deals"
            const dealContacts = (data || []).filter(c =>
                (c.metadata && (c.metadata.estimated_budget || c.metadata.company)) ||
                (c.tags && c.tags.some((tag: string) =>
                    ['#Interesado', '#LeadCalificado', '#Propuesta', '#Negociacion', '#Ganado', '#Perdido'].includes(tag)
                ))
            );
            setContacts(dealContacts);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchContacts();

        // Subscribe to real-time changes
        const subscription = supabase
            .channel('kanban_all_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
                fetchContacts();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const getStageForContact = (contact: Contact) => {
        const tags = contact.tags || [];
        if (tags.includes('#Ganado') || tags.includes('#Perdido')) return 'closed';
        if (tags.includes('#Negociacion')) return 'negotiation';
        if (tags.includes('#Propuesta')) return 'proposal';
        if (tags.includes('#LeadCalificado')) return 'qualified';
        return 'new';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-[#8b8fa3]">
                <Loader2 size={32} className="animate-spin mb-4 text-[#2AABEE]" />
                <p>Cargando tablero de negocios...</p>
            </div>
        );
    }

    return (
        <div className="flex gap-6 items-start overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
            {STAGES.map((stage) => {
                const stageContacts = contacts.filter(c => getStageForContact(c) === stage.id);

                return (
                    <div key={stage.id} className="w-[300px] flex-shrink-0 space-y-4">
                        <div className="flex items-center justify-between px-3 bg-[#1a1d27]/50 py-2.5 rounded-t-xl border-b border-[#2a2e3d]">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${stage.color}`}></div>
                                <span className="text-[11px] font-bold text-white uppercase tracking-widest">{stage.title}</span>
                            </div>
                            <span className="text-[10px] bg-[#2a2e3d] text-[#8b8fa3] px-2.5 py-0.5 rounded-full font-medium">
                                {stageContacts.length}
                            </span>
                        </div>

                        <div className="space-y-3 min-h-[500px] bg-[#1a1d27]/20 rounded-b-xl p-1.5 transition-colors">
                            {stageContacts.length > 0 ? (
                                stageContacts.map((contact) => (
                                    <DealCard
                                        key={contact.id}
                                        contactId={contact.id}
                                        name={`${contact.first_name} ${contact.last_name || ''}`}
                                        company={contact.metadata?.company}
                                        budget={contact.metadata?.estimated_budget}
                                        summary={contact.metadata?.ai_summary}
                                        sentiment={contact.metadata?.debug_last_ai_raw?.sentiment}
                                    />
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-[#2a2e3d]/30 rounded-xl text-[#4a4e5d] group-hover:border-[#2a2e3d]/50 transition-colors">
                                    <span className="text-[10px] font-medium italic">Sin movimientos</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
