
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Phone, Mail, Tag, Search, MoreVertical, X, Building2, DollarSign, Quote, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function ContactsPage() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedContact, setSelectedContact] = useState<any | null>(null);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        fetchContacts();

        // Subscribe to real-time updates
        const channel = supabase
            .channel('contacts-all')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'contacts'
            }, () => {
                console.log('Contacts update detected, refetching...');
                fetchContacts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchContacts() {
        setLoading(true);
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching contacts:', error);
        } else {
            setContacts(data || []);
        }
        setLoading(false);
    }

    const filteredContacts = contacts.filter(contact =>
        (contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact.username?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact.phone?.includes(searchTerm)) ||
        (contact.metadata?.company?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="relative h-[calc(100vh-120px)]">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-white">Contactos</h1>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8fa3]" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar contacto o empresa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-[#1a1d27] border border-[#2a2e3d] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#2AABEE] w-64"
                        />
                    </div>
                </div>

                <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-[#2a2e3d] bg-[#232732]/50">
                                <th className="px-6 py-4 text-xs font-semibold text-[#8b8fa3] uppercase">Nombre</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[#8b8fa3] uppercase">Empresa</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[#8b8fa3] uppercase">Canal</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[#8b8fa3] uppercase">Etiquetas</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[#8b8fa3] uppercase">Última Actividad</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[#8b8fa3] uppercase text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2e3d]">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-[#8b8fa3]">
                                        Cargando contactos...
                                    </td>
                                </tr>
                            ) : filteredContacts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-[#8b8fa3]">
                                        No se encontraron contactos.
                                    </td>
                                </tr>
                            ) : (
                                filteredContacts.map((contact) => (
                                    <tr
                                        key={contact.id}
                                        onClick={() => setSelectedContact(contact)}
                                        className={`hover:bg-[#232732]/30 cursor-pointer transition-colors ${selectedContact?.id === contact.id ? 'bg-[#232732]/50' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#2AABEE]/10 flex items-center justify-center text-[#2AABEE]">
                                                    <User size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        {contact.first_name || 'Sin nombre'} {contact.last_name || ''}
                                                    </p>
                                                    <p className="text-xs text-[#8b8fa3]">{contact.username ? `@${contact.username}` : contact.email || '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-[#e8eaed]">
                                                {contact.metadata?.company ? (
                                                    <>
                                                        <Building2 size={14} className="text-[#8b8fa3]" />
                                                        {contact.metadata.company}
                                                    </>
                                                ) : (
                                                    <span className="text-[#8b8fa3]">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#2AABEE]/10 text-[#2AABEE] capitalize">
                                                {contact.channel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {contact.tags?.map((tag: string) => (
                                                    <span key={tag} className="px-2 py-0.5 bg-[#232732] border border-[#2a2e3d] rounded text-[10px] text-[#8b8fa3]">
                                                        {tag}
                                                    </span>
                                                )) || <span className="text-[#8b8fa3]">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[#8b8fa3]">
                                            {format(new Date(contact.updated_at), "d 'de' MMM, HH:mm", { locale: es })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-[#8b8fa3] hover:text-white p-1">
                                                <MoreVertical size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Side Panel Detail View */}
            <AnimatePresence>
                {selectedContact && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedContact(null)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#1a1d27] border-l border-[#2a2e3d] p-0 z-20 shadow-2xl flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-[#2a2e3d] flex justify-between items-center bg-[#232732]/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-[#2AABEE] flex items-center justify-center text-white text-xl font-bold">
                                        {(selectedContact.first_name?.[0] || selectedContact.username?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">
                                            {selectedContact.first_name || 'Desconocido'} {selectedContact.last_name || ''}
                                        </h2>
                                        <p className="text-sm text-[#8b8fa3]">Lead de {selectedContact.channel}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedContact(null)}
                                    className="p-2 hover:bg-[#2a2e3d] rounded-full text-[#8b8fa3] hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {/* AI Summary Section */}
                                {selectedContact.metadata?.ai_summary && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-[#2AABEE]">
                                            <Quote size={16} />
                                            <h3 className="text-xs font-bold uppercase tracking-wider">Análisis de IA</h3>
                                        </div>
                                        <div className="bg-[#2AABEE]/5 border border-[#2AABEE]/20 rounded-xl p-4">
                                            <p className="text-sm text-[#e8eaed] leading-relaxed italic">
                                                "{selectedContact.metadata.ai_summary}"
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Metadata Grid */}
                                <div className="grid grid-cols-1 gap-4">
                                    <InfoItem
                                        icon={<Building2 size={16} />}
                                        label="Empresa"
                                        value={selectedContact.metadata?.company || 'No detectado'}
                                        highlight={!!selectedContact.metadata?.company}
                                    />
                                    <InfoItem
                                        icon={<DollarSign size={16} />}
                                        label="Presupuesto Estimado"
                                        value={selectedContact.metadata?.estimated_budget || 'En negociación'}
                                        highlight={!!selectedContact.metadata?.estimated_budget}
                                    />
                                    <InfoItem
                                        icon={<Mail size={16} />}
                                        label="Correo Electrónico"
                                        value={selectedContact.email || 'No proporcionado'}
                                    />
                                    <InfoItem
                                        icon={<Phone size={16} />}
                                        label="Teléfono"
                                        value={selectedContact.phone || 'N/A'}
                                    />
                                </div>

                                {/* Tags Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-[#8b8fa3]">
                                        <Tag size={16} />
                                        <h3 className="text-xs font-bold uppercase tracking-wider">Etiquetas</h3>
                                    </div>
                                </div>

                                {/* Debug Section */}
                                {selectedContact.metadata?.debug_last_ai_raw && (
                                    <div className="space-y-3 p-4 bg-red-900/10 border border-red-500/20 rounded-xl">
                                        <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Debug: Raw AI Response</h3>
                                        <pre className="text-[10px] text-red-300/70 overflow-x-auto whitespace-pre-wrap">
                                            {JSON.stringify(selectedContact.metadata.debug_last_ai_raw, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>

                            {/* Footer / Actions */}
                            <div className="p-6 border-t border-[#2a2e3d] bg-[#232732]/10 flex gap-3">
                                <button
                                    onClick={() => router.push(`/chat?contactId=${selectedContact.id}`)}
                                    className="flex-1 bg-[#2AABEE] hover:bg-[#2299d4] text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                                >
                                    <MessageCircle size={18} />
                                    Abrir Chat
                                </button>
                                <button className="px-4 border border-[#2a2e3d] hover:bg-[#2a2e3d] text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
                                    Editar
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function InfoItem({ icon, label, value, highlight = false }: any) {
    return (
        <div className="bg-[#232732]/30 border border-[#2a2e3d]/50 rounded-xl p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${highlight ? 'bg-[#2AABEE]/10 text-[#2AABEE]' : 'bg-[#1a1d27] text-[#8b8fa3]'}`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] text-[#8b8fa3] font-bold uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className={`text-sm font-medium ${highlight ? 'text-white' : 'text-[#e8eaed]'}`}>{value}</p>
            </div>
        </div>
    );
}
