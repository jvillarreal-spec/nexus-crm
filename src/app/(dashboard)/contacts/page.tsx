
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Phone, Mail, Tag, Search, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ContactsPage() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const supabase = createClient();

    useEffect(() => {
        fetchContacts();
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
        (contact.phone?.includes(searchTerm))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Contactos</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8fa3]" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar contacto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-[#1a1d27] border border-[#2a2e3d] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#2AABEE] w-64"
                    />
                </div>
            </div>

            <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[#2a2e3d] bg-[#232732]/50">
                            <th className="px-6 py-4 text-xs font-semibold text-[#8b8fa3] uppercase">Nombre</th>
                            <th className="px-6 py-4 text-xs font-semibold text-[#8b8fa3] uppercase">Canal</th>
                            <th className="px-6 py-4 text-xs font-semibold text-[#8b8fa3] uppercase">Teléfono / User</th>
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
                                <tr key={contact.id} className="hover:bg-[#232732]/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#2AABEE]/10 flex items-center justify-center text-[#2AABEE]">
                                                <User size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">
                                                    {contact.first_name || 'Sin nombre'} {contact.last_name || ''}
                                                </p>
                                                <p className="text-xs text-[#8b8fa3]">{contact.email || '-'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#2AABEE]/10 text-[#2AABEE] capitalize">
                                            {contact.channel}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-[#e8eaed]">
                                        {contact.phone || `@${contact.username}` || '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1">
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
    );
}
