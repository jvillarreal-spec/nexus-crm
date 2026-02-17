'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    User,
    Mail,
    Search,
    MoreVertical,
    ShieldCheck,
    UserMinus,
    UserCheck,
    Lock
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createAgent } from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [profile, setProfile] = useState<any>(null);

    const supabase = createClient();

    useEffect(() => {
        fetchProfileAndUsers();
    }, []);

    async function fetchProfileAndUsers() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(profileData);

            if (profileData) {
                const { data: usersData, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('company_id', profileData.company_id)
                    .order('created_at', { ascending: false });

                if (!error) setUsers(usersData);
            }
        }
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        const result = await createAgent(data, profile.company_id);

        if (result.success) {
            setIsModalOpen(false);
            fetchProfileAndUsers();
        } else {
            alert('Error: ' + result.error);
        }
        setSubmitting(false);
    }

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Gestión de Comerciales</h1>
                    <p className="text-[#8b8fa3] mt-1">Administra tu equipo de ventas y sus accesos</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-[#2AABEE]/20"
                >
                    <Plus size={20} />
                    Nuevo Comercial
                </button>
            </div>

            {/* Filters & Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4e5d]" size={20} />
                <input
                    type="text"
                    placeholder="Buscar comercial por nombre o email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#1a1d27] border border-[#2a2e3d] rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                />
            </div>

            {/* Users List */}
            <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] overflow-hidden shadow-xl shadow-black/20">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[#2a2e3d]">
                            <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-[#8b8fa3]">Comercial</th>
                            <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-[#8b8fa3]">Rol</th>
                            <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-[#8b8fa3]">Email</th>
                            <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-[#8b8fa3] text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-20 text-center animate-pulse text-[#8b8fa3]">
                                    Cargando equipo...
                                </td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-20 text-center text-[#8b8fa3]">
                                    No se encontraron comerciales registrados.
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((u) => (
                                <tr key={u.id} className="border-b border-[#2a2e3d] last:border-0 hover:bg-[#232732]/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[#232732] flex items-center justify-center text-sm font-bold text-[#2AABEE]">
                                                {u.full_name?.[0] || 'U'}
                                            </div>
                                            <span className="font-bold text-white group-hover:text-[#2AABEE] transition-colors">{u.full_name || 'Sin nombre'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                                            u.role === 'org_admin' || u.role === 'super_admin'
                                                ? "bg-[#2AABEE]/10 text-[#2AABEE]"
                                                : "bg-[#232732] text-[#8b8fa3]"
                                        )}>
                                            {u.role === 'org_admin' ? 'Administrador' : u.role === 'super_admin' ? 'Super Admin' : 'Comercial'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-sm text-[#8b8fa3]">{u.email}</td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 text-[#8b8fa3] hover:text-white transition-colors" title="Editar accessos">
                                                <Lock size={18} />
                                            </button>
                                            <button className="p-2 text-[#8b8fa3] hover:text-white transition-colors" title="Desactivar">
                                                <UserMinus size={18} />
                                            </button>
                                            <button className="p-2 text-[#8b8fa3] hover:text-white transition-colors">
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* New User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setIsModalOpen(false)}
                    />
                    <div className="relative w-full max-w-md bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-[#2a2e3d]">
                            <h2 className="text-2xl font-black text-white">Nuevo Comercial</h2>
                            <p className="text-[#8b8fa3]">Personaliza el acceso para tu equipo</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-[#8b8fa3]">Nombre Completo</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4e5d]" size={18} />
                                        <input
                                            name="fullName"
                                            required
                                            className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                                            placeholder="Ej: Laura Sanchez"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-[#8b8fa3]">Email de Acceso</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4e5d]" size={18} />
                                        <input
                                            name="email"
                                            type="email"
                                            required
                                            className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                                            placeholder="comercial@nexus.com"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-[#8b8fa3]">Contraseña Inicial</label>
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                                        placeholder="••••••••"
                                    />
                                    <p className="text-[10px] text-[#4a4e5d]">El comercial podrá cambiarla en su primer ingreso.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-[#8b8fa3] hover:bg-[#232732] transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-[#2AABEE] hover:bg-[#2AABEE]/90 disabled:opacity-50 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-[#2AABEE]/20 flex items-center justify-center gap-2"
                                >
                                    {submitting ? 'Creando...' : 'Crear Acceso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
