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
    RefreshCw,
    Edit2,
    Ban,
    UserCheck
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
    createWorker,
    updateUserStatus,
    deleteUser,
    updateUserProfile,
    resendWelcomeEmail
} from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const supabase = createClient();

    // Form state
    const [newWorker, setNewWorker] = useState({ name: '', email: '' });
    const [editData, setEditData] = useState({ name: '', role: '', company_id: '' });

    const [diagInfo, setDiagInfo] = useState<any>(null);

    useEffect(() => {
        fetchUsers();
        fetchCompanies();
        // Diagnostic
        resendWelcomeEmail('diagnose', 'juancarevalos@live.com').catch(() => { }); // Dummy call to ensure module load
    }, []);

    const runDiagnosis = async () => {
        const { diagnoseAccount } = await import('@/app/actions/diagnostics');
        const res = await diagnoseAccount('juancarevalos@live.com');
        setDiagInfo(res);
    };

    async function fetchCompanies() {
        const { data } = await supabase.from('companies').select('id, name');
        setCompanies(data || []);
    }

    async function fetchUsers() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id, role')
                .eq('id', user.id)
                .single();

            setCurrentUserProfile(profile);

            if (profile) {
                let query = supabase.from('profiles').select('*, companies(name)');

                if (profile.role !== 'super_admin') {
                    query = query.eq('company_id', profile.company_id);
                }

                const { data: teamMembers, error } = await query.order('created_at', { ascending: false });

                if (error) throw error;
                setUsers(teamMembers || []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    }

    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const pageTitle = isSuperAdmin ? 'Gestión Global de Usuarios' : 'Gestión de Equipo';
    const pageDescription = isSuperAdmin
        ? 'Visualiza y gestiona todos los usuarios registrados en la plataforma.'
        : 'Administra los comerciales y sus permisos en la empresa.';

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

    const handleToggleStatus = async (user: any) => {
        setSaving(true);
        const newStatus = user.status === 'inactive' ? 'active' : 'inactive';
        const result = await updateUserStatus(user.id, newStatus);

        if (result.success) {
            setMessage({ type: 'success', text: `Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'} con éxito.` });
            fetchUsers();
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al actualizar el estado.' });
        }
        setSaving(false);
        setActiveMenuId(null);
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        setSaving(true);
        const result = await deleteUser(selectedUser.id);

        if (result.success) {
            setMessage({ type: 'success', text: 'Usuario eliminado correctamente.' });
            setShowDeleteModal(false);
            setSelectedUser(null);
            fetchUsers();
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al eliminar el usuario.' });
        }
        setSaving(false);
        setActiveMenuId(null);
    };

    const handleResendEmail = async (member: any) => {
        setSaving(true);
        const result = await resendWelcomeEmail(member.company_id, member.id);

        if (result.success) {
            setMessage({ type: 'success', text: `Correo de bienvenida reenviado a ${member.email}` });
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al reenviar correo.' });
        }
        setSaving(false);
        setActiveMenuId(null);
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        setSaving(true);
        const result = await updateUserProfile(selectedUser.id, editData);

        if (result.success) {
            setMessage({ type: 'success', text: 'Perfil actualizado correctamente.' });
            setShowEditModal(false);
            setSelectedUser(null);
            fetchUsers();
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al actualizar perfil.' });
        }
        setSaving(false);
    };

    const openEditModal = (user: any) => {
        setSelectedUser(user);
        setEditData({
            name: user.full_name || '',
            role: user.role || 'agent',
            company_id: user.company_id || ''
        });
        setShowEditModal(true);
        setActiveMenuId(null);
    };

    return (
        <div className="max-w-6xl space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{pageTitle}</h1>
                    <p className="text-[#8b8fa3] mt-1">{pageDescription}</p>
                </div>
                {!isSuperAdmin && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center justify-center gap-2 bg-[#2AABEE] text-white px-6 py-3 rounded-2xl text-sm font-black shadow-lg shadow-[#2AABEE]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <UserPlus size={18} />
                        Añadir Miembro
                    </button>
                )}
            </div>

            {message && !showModal && !showEditModal && !showDeleteModal && (
                <div className={cn(
                    "p-4 rounded-2xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-2",
                    message.type === 'success' ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                )}>
                    {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                </div>
            )}

            <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] shadow-xl">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#11131c]">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d]">Nombre</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d]">Email</th>
                                {isSuperAdmin && (
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d]">Empresa</th>
                                )}
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d]">Rol</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d]">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2e3d]">
                            {loading ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-12 text-center text-[#8b8fa3]">
                                        <Loader2 className="animate-spin mx-auto mb-2" />
                                        Cargando usuarios...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-12 text-center text-[#8b8fa3]">
                                        No hay usuarios registrados aún.
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
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-[#2AABEE] font-medium">{member.companies?.name || 'Sistema'}</span>
                                            </td>
                                        )}
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
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    member.status === 'inactive' ? "bg-red-500" : "bg-green-500"
                                                )} />
                                                <span className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest",
                                                    member.status === 'inactive' ? "text-red-500" : "text-green-500"
                                                )}>
                                                    {member.status === 'inactive' ? 'Inactivo' : 'Activo'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={() => {
                                                    console.log('Toggle menu for:', member.id);
                                                    setActiveMenuId(activeMenuId === member.id ? null : member.id);
                                                }}
                                                className="p-2 text-[#4a4e5d] hover:text-white transition-colors"
                                            >
                                                <MoreVertical size={18} />
                                            </button>

                                            {activeMenuId === member.id && (
                                                <div className="absolute right-6 top-12 w-48 bg-[#1a1d27] border border-[#2a2e3d] rounded-xl shadow-2xl z-20 py-2 animate-in fade-in slide-in-from-top-2">
                                                    <button
                                                        onClick={() => openEditModal(member)}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-[#8b8fa3] hover:text-white hover:bg-[#232732] transition-all"
                                                    >
                                                        <Edit2 size={14} /> Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(member)}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all",
                                                            member.status === 'inactive' ? "text-green-500 hover:bg-green-500/10" : "text-amber-500 hover:bg-amber-500/10"
                                                        )}
                                                    >
                                                        {member.status === 'inactive' ? <UserCheck size={14} /> : <Ban size={14} />}
                                                        {member.status === 'inactive' ? 'Activar' : 'Desactivar'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleResendEmail(member)}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-[#2AABEE] hover:bg-[#2AABEE]/10 transition-all"
                                                    >
                                                        <Mail size={14} /> Reenviar Bienvenida
                                                    </button>
                                                    <div className="h-px bg-[#2a2e3d] my-1" />
                                                    <button
                                                        onClick={() => { setSelectedUser(member); setShowDeleteModal(true); setActiveMenuId(null); }}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10 transition-all"
                                                    >
                                                        <Trash2 size={14} /> Eliminar
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit User Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
                        <button onClick={() => setShowEditModal(false)} className="absolute right-6 top-6 text-[#4a4e5d] hover:text-white"><X size={20} /></button>
                        <div className="mb-8">
                            <h3 className="text-2xl font-black text-white tracking-tight">Editar Usuario</h3>
                            <p className="text-sm text-[#8b8fa3] mt-1">Actualiza la información de {selectedUser?.full_name}.</p>
                        </div>
                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Nombre Completo</label>
                                <input required type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Rol</label>
                                <select value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE]">
                                    <option value="agent">Comercial</option>
                                    <option value="org_admin">Administrador de Empresa</option>
                                    <option value="super_admin">Super Administrador</option>
                                </select>
                            </div>
                            {isSuperAdmin && (
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Empresa</label>
                                    <select value={editData.company_id} onChange={(e) => setEditData({ ...editData, company_id: e.target.value })} className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE]">
                                        <option value="">Ninguna (Sistema)</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <button disabled={saving} type="submit" className="w-full bg-[#2AABEE] text-white py-4 rounded-xl text-sm font-black shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} Guardar Cambios
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (selectedUser || true) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Trash2 className="text-red-500" size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white mb-2">¿Eliminar usuario?</h3>
                        <p className="text-sm text-[#8b8fa3] mb-8">Esta acción es irreversible. Se eliminará a <strong>{selectedUser?.full_name}</strong> de forma permanente.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-[#8b8fa3] hover:bg-[#232732] transition-all">Cancelar</button>
                            <button onClick={handleDeleteUser} disabled={saving} className="flex-1 py-3 px-4 rounded-xl text-sm font-black bg-red-500 text-white shadow-lg shadow-red-500/20 hover:scale-[1.05] active:scale-[0.95] transition-all">
                                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Eliminar Ahora'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Worker Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
                        <button onClick={() => setShowModal(false)} className="absolute right-6 top-6 text-[#4a4e5d] hover:text-white"><X size={20} /></button>
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
                                    <input required type="text" value={newWorker.name} onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })} className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE]" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Correo Electrónico</label>
                                    <input required type="email" value={newWorker.email} onChange={(e) => setNewWorker({ ...newWorker, email: e.target.value })} className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE]" />
                                </div>
                            </div>
                            <button disabled={saving} type="submit" className="w-full bg-[#2AABEE] text-white py-4 rounded-xl text-sm font-black shadow-lg shadow-[#2AABEE]/20 hover:scale-[1.02] flex items-center justify-center gap-2">
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} {saving ? 'Añadiendo...' : 'Crear y Enviar Bienvenida'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

