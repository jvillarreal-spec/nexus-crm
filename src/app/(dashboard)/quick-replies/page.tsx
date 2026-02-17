
'use client';

import React, { useEffect, useState } from 'react';
import { Zap, Plus, Search, Trash2, Edit2, X, Loader2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface QuickReply {
    id: string;
    title: string;
    shortcut: string;
    content: string;
    created_at: string;
}

export default function QuickRepliesPage() {
    const [replies, setReplies] = useState<QuickReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        shortcut: '',
        content: ''
    });

    const supabase = createClient();

    const fetchReplies = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('quick_replies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching replies:', error);
        } else {
            setReplies(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchReplies();
    }, []);

    const handleOpenModal = (reply: QuickReply | null = null) => {
        if (reply) {
            setEditingReply(reply);
            setFormData({
                title: reply.title,
                shortcut: reply.shortcut || '',
                content: reply.content
            });
        } else {
            setEditingReply(null);
            setFormData({ title: '', shortcut: '', content: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (editingReply) {
            const { error } = await supabase
                .from('quick_replies')
                .update(formData)
                .eq('id', editingReply.id);
            if (error) console.error('Error updating:', error);
        } else {
            const { error } = await supabase
                .from('quick_replies')
                .insert([formData]);
            if (error) console.error('Error inserting:', error);
        }

        setIsModalOpen(false);
        fetchReplies();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta respuesta?')) return;

        const { error } = await supabase
            .from('quick_replies')
            .delete()
            .eq('id', id);

        if (error) console.error('Error deleting:', error);
        fetchReplies();
    };

    const filteredReplies = replies.filter(r =>
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.shortcut?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-[#2AABEE]/10 rounded-lg">
                            <Zap className="text-[#2AABEE]" size={24} />
                        </div>
                        Respuestas Rápidas
                    </h1>
                    <p className="text-[#8b8fa3] text-sm mt-1">
                        Atajos y plantillas para responder más rápido en el chat.
                    </p>
                </div>

                <button
                    onClick={() => handleOpenModal()}
                    className="bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-[#2AABEE]/10 active:scale-95"
                >
                    <Plus size={18} />
                    Nueva Respuesta
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4e5d] group-focus-within:text-[#2AABEE] transition-colors" size={18} />
                <input
                    type="text"
                    placeholder="Buscar por título, contenido o atajo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#1a1d27] border border-[#2a2e3d] rounded-xl py-3 pl-12 pr-4 text-white placeholder-[#4a4e5d] focus:outline-none focus:border-[#2AABEE]/50 transition-all text-sm"
                />
            </div>

            {loading && replies.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-[#8b8fa3]">
                    <Loader2 size={32} className="animate-spin mb-4 text-[#2AABEE]" />
                    <p>Cargando tus respuestas...</p>
                </div>
            ) : filteredReplies.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredReplies.map((reply) => (
                        <div key={reply.id} className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-5 hover:border-[#3a3f4e] transition-all group relative">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-sm font-bold text-white group-hover:text-[#2AABEE] transition-colors uppercase tracking-tight">{reply.title}</h3>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleOpenModal(reply)}
                                        className="p-1.5 hover:bg-[#2a2e3d] rounded-lg text-[#8b8fa3] hover:text-white transition-all"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(reply.id)}
                                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-[#8b8fa3] hover:text-red-400 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <p className="text-xs text-[#8b8fa3] mb-4 line-clamp-3 leading-relaxed italic">
                                "{reply.content}"
                            </p>

                            {reply.shortcut && (
                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#2AABEE]/10 border border-[#2AABEE]/20 text-[#2AABEE] text-[10px] font-bold">
                                    <Zap size={10} />
                                    {reply.shortcut}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-[#1a1d27]/50 border-2 border-dashed border-[#2a2e3d] rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                    <Zap size={48} className="text-[#2AABEE] mb-4 opacity-10" />
                    <h3 className="text-lg font-medium text-white mb-2">No se encontraron respuestas</h3>
                    <p className="text-[#8b8fa3] text-sm max-w-xs mb-6">
                        {searchTerm ? 'Prueba con otros términos de búsqueda.' : 'Crea tu primera respuesta rápida para ahorrar tiempo.'}
                    </p>
                    {!searchTerm && (
                        <button
                            onClick={() => handleOpenModal()}
                            className="text-[#2AABEE] text-sm font-semibold hover:underline"
                        >
                            + Crear respuesta ahora
                        </button>
                    )}
                </div>
            )}

            {/* Modal - Create/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-2xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2e3d] bg-[#1a1d27]">
                            <h3 className="text-white font-bold">{editingReply ? 'Editar Respuesta' : 'Nueva Respuesta'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-[#8b8fa3] hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-[#8b8fa3] uppercase mb-1.5 ml-1">Título</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej: Saludo Inicial"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-[#2AABEE]/50 transition-all text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#8b8fa3] uppercase mb-1.5 ml-1">Atajo (Opcional)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4e5d] text-sm font-bold">/</span>
                                    <input
                                        type="text"
                                        placeholder="ej: precios"
                                        value={formData.shortcut.replace(/^\//, '')}
                                        onChange={(e) => setFormData({ ...formData, shortcut: '/' + e.target.value.replace(/^\//, '') })}
                                        className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl py-2.5 pl-7 pr-4 text-white focus:outline-none focus:border-[#2AABEE]/50 transition-all text-sm"
                                    />
                                </div>
                                <p className="text-[10px] text-[#4a4e5d] mt-1 ml-1">Te ayuda a identificarla visualmente.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#8b8fa3] uppercase mb-1.5 ml-1">Contenido del Mensaje</label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Escribe el mensaje completo aquí..."
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-[#2AABEE]/50 transition-all text-sm resize-none"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    {editingReply ? 'Guardar Cambios' : 'Crear Respuesta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
