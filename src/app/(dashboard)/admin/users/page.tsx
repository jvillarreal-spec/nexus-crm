'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Mail,
    Shield,
    CheckCircle,
    AlertCircle,
    Loader2,
    Plus,
    X,
    MoreVertical,
    Trash2,
    RefreshCw
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createWorker } from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const supabase = createClient();

    // Form state
    const [newWorker, setNewWorker] = useState({ name: '', email: '' });

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get profile to get company_id
            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single();

            if (profile?.company_id) {
                const { data: teamMembers, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('company_id', profile.company_id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setUsers(teamMembers || []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleCreateWorker = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        const result = await createWorker(newWorker);

        if (result.success) {
            setMessage({ type: 'success', text: 'Comercial creado y correo enviado con éxito.' });
            setNewWorker({ name: '', email: '' });
            setShowModal(false);
            fetchUsers();
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al crear el comercial.' });
        }
        setSaving(false);
    };

    return (
        <div className="max-w-6xl space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Gestión de Equipo</h1>
                    <p className="text-[#8b8fa3] mt-1">Administra los comerciales y sus permisos en la empresa.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center justify-center gap-2 bg-[#2AABEE] text-white px-6 py-3 rounded-2xl text-sm font-black shadow-lg shadow-[#2AABEE]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <UserPlus size={18} />
                    Añadir Miembro
                </button>
            </div>

            {message && !showModal && (
                <div className={cn(
                    "p-4 rounded-2xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-2",
                    message.type === 'success' ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                )}>
                    {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                </div>
            )}

            <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#11131c]">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d]">Nombre</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d]">Email</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d]">Rol</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d]">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2e3d]">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[#8b8fa3]">
                                        <Loader2 className="animate-spin mx-auto mb-2" />
                                        Cargando equipo...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[#8b8fa3]">
                                        No hay miembros en el equipo aún.
                                    </td>
                                </tr>
                            ) : (
                                users.map((member) => (
                                    <tr key={member.id} className="hover:bg-[#232732]/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-[#232732] flex items-center justify-center text-xs font-black text-[#2AABEE] border border-[#2a2e3d]">
                                                    {member.full_name?.[0] || 'U'}
                                                </div>
                                                <span className="text-sm font-bold text-white">{member.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-[#8b8fa3]">{member.email}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md",
                                                member.role === 'org_admin' ? "bg-purple-500/10 text-purple-500" :
                                                    member.role === 'super_admin' ? "bg-amber-500/10 text-amber-500" :
                                                        "bg-blue-500/10 text-blue-500"
                                            )}>
                                                {member.role === 'org_admin' ? 'Administrador' :
                                                    member.role === 'super_admin' ? 'Super Admin' :
                                                        'Comercial'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Activo</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 text-[#4a4e5d] hover:text-white transition-colors">
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

            {/* Create Worker Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute right-6 top-6 text-[#4a4e5d] hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="mb-8">
                            <div className="w-12 h-12 bg-[#2AABEE]/10 rounded-2xl flex items-center justify-center mb-4">
                                <UserPlus className="text-[#2AABEE]" size={24} />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tight">Añadir Comercial</h3>
                            <p className="text-sm text-[#8b8fa3] mt-1">Escribe los datos para enviarle la invitación.</p>
                        </div>

                        <form onSubmit={handleCreateWorker} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Nombre Completo</label>
                                    <input
                                        required
                                        type="text"
                                        value={newWorker.name}
                                        onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                                        placeholder="Ej. Juan Pérez"
                                        className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Correo Electrónico</label>
                                    <input
                                        required
                                        type="email"
                                        value={newWorker.email}
                                        onChange={(e) => setNewWorker({ ...newWorker, email: e.target.value })}
                                        placeholder="juan@ejemplo.com"
                                        className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-colors"
                                    />
                                </div>
                            </div>

                            {message && message.type === 'error' && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    {message.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-[#2AABEE] disabled:bg-[#2AABEE]/50 text-white py-4 rounded-xl text-sm font-black shadow-lg shadow-[#2AABEE]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                {saving ? 'Añadiendo...' : 'Crear y Enviar Bienvenida'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

