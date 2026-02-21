'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Building2,
    Search,
    MoreVertical,
    ExternalLink,
    Mail,
    User,
    Shield,
    Activity
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createCompanyWithAdmin, updateCompany, resendWelcomeEmail } from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingCompany, setEditingCompany] = useState<any>(null);
    const [isResending, setIsResending] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        fetchCompanies();
    }, []);

    async function fetchCompanies() {
        const { data, error } = await supabase
            .from('companies')
            .select('*, profiles(id)')
            .order('created_at', { ascending: false });

        if (!error) setCompanies(data);
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        let result;
        if (editingCompany) {
            result = await updateCompany(editingCompany.id, {
                name: data.companyName as string,
                slug: data.companySlug as string
            });
        } else {
            result = await createCompanyWithAdmin(data);
        }

        if (result.success) {
            setIsModalOpen(false);
            setEditingCompany(null);
            fetchCompanies();
        } else {
            alert('Error: ' + result.error);
        }
        setSubmitting(false);
    }

    async function handleResendEmail() {
        if (!editingCompany) return;
        setIsResending(true);
        const result = await resendWelcomeEmail(editingCompany.id);

        if (result.success) {
            alert('Correo de bienvenida reenviado con éxito.');
        } else {
            alert('Error al reenviar: ' + result.error);
        }
        setIsResending(false);
    }

    const openEditModal = (company: any) => {
        setEditingCompany(company);
        setIsModalOpen(true);
    };

    const openCreateModal = () => {
        setEditingCompany(null);
        setIsModalOpen(true);
    };

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Gestión de Empresas</h1>
                    <p className="text-[#8b8fa3] mt-1">Control centralizado de organizaciones en NexusCRM</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center justify-center gap-2 bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-[#2AABEE]/20"
                >
                    <Plus size={20} />
                    Nueva Empresa
                </button>
            </div>

            {/* Stats/Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#1a1d27] border border-[#2a2e3d] p-6 rounded-3xl shadow-xl">
                    <p className="text-[#8b8fa3] text-[10px] font-black uppercase tracking-widest">Total Empresas</p>
                    <p className="text-4xl font-black text-white mt-2">{companies.length}</p>
                </div>
                <div className="bg-[#1a1d27] border border-[#2a2e3d] p-6 rounded-3xl shadow-xl">
                    <p className="text-[#8b8fa3] text-[10px] font-black uppercase tracking-widest">Total Usuarios Activos</p>
                    <p className="text-4xl font-black text-[#2AABEE] mt-2">
                        {companies.reduce((acc, curr) => acc + (curr.profiles?.length || 0), 0)}
                    </p>
                </div>
                <div className="bg-[#1a1d27] border border-[#2a2e3d] p-6 rounded-3xl shadow-xl flex items-center justify-between">
                    <div>
                        <p className="text-[#8b8fa3] text-[10px] font-black uppercase tracking-widest">Estado Plataforma</p>
                        <p className="text-xl font-black text-green-500 mt-2">OPERATIVO</p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500">
                        <Activity size={24} />
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4e5d]" size={20} />
                <input
                    type="text"
                    placeholder="Buscar empresa por nombre o slug..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#1a1d27] border border-[#2a2e3d] rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                />
            </div>

            {/* Companies List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center animate-pulse text-[#8b8fa3]">
                        Cargando empresas...
                    </div>
                ) : filteredCompanies.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-[#1a1d27] border border-dashed border-[#2a2e3d] rounded-3xl text-[#8b8fa3]">
                        No se encontraron empresas
                    </div>
                ) : (
                    filteredCompanies.map((company) => (
                        <div
                            key={company.id}
                            className="bg-[#1a1d27] border border-[#2a2e3d] p-7 rounded-[2rem] hover:border-[#2AABEE]/50 transition-all group shadow-xl"
                        >
                            <div className="flex items-start justify-between">
                                <div className="w-14 h-14 bg-[#232732] rounded-2xl flex items-center justify-center text-[#2AABEE] group-hover:scale-110 transition-transform">
                                    <Building2 size={28} />
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-[10px] font-black bg-[#2AABEE]/10 text-[#2AABEE] px-2 py-1 rounded-lg border border-[#2AABEE]/20 uppercase">
                                        ACTIVA
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6">
                                <h3 className="text-2xl font-black text-white group-hover:text-[#2AABEE] transition-colors">{company.name}</h3>
                                <p className="text-sm text-[#4a4e5d] font-bold mt-1 uppercase tracking-tighter italic">
                                    /{company.slug || company.id.slice(0, 8)}
                                </p>
                            </div>

                            <div className="mt-8 space-y-4 pt-6 border-t border-[#2a2e3d]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-[#8b8fa3] uppercase tracking-widest">Cuentas Activas</span>
                                    <span className="text-lg font-black text-white">{company.profiles?.length || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-[#8b8fa3] uppercase tracking-widest">Fecha de Alta</span>
                                    <span className="text-xs font-bold text-[#e8eaed]">
                                        {new Date(company.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => openEditModal(company)}
                                    className="flex-1 bg-[#232732] hover:bg-[#2AABEE] text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                >
                                    Administrar
                                </button>
                                <button className="p-3 bg-[#232732] hover:text-[#2AABEE] rounded-xl text-[#4a4e5d] transition-all">
                                    <MoreVertical size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Company Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setIsModalOpen(false)}
                    />
                    <div className="relative w-full max-w-xl bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-[#2a2e3d]">
                            <h2 className="text-2xl font-black text-white">
                                {editingCompany ? 'Editar Empresa' : 'Nueva Empresa'}
                            </h2>
                            <p className="text-[#8b8fa3]">
                                {editingCompany ? 'Modifica los datos de la organización' : 'Configura la organización y su administrador principal'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-[#8b8fa3]">Nombre de Empresa</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4e5d]" size={18} />
                                        <input
                                            name="companyName"
                                            required
                                            defaultValue={editingCompany?.name}
                                            className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                                            placeholder="Ej: Inmobiliaria Nexus"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-[#8b8fa3]">Slug / URL</label>
                                    <input
                                        name="companySlug"
                                        required
                                        defaultValue={editingCompany?.slug}
                                        className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                                        placeholder="ej-inmobiliaria"
                                    />
                                </div>
                            </div>

                            {editingCompany && (
                                <div className="p-6 bg-[#2AABEE]/5 border border-[#2AABEE]/10 rounded-2xl space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-[#2AABEE]/10 rounded-lg text-[#2AABEE]">
                                            <Mail size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-white">Acciones de Correo</h4>
                                            <p className="text-[11px] text-[#8b8fa3]">Reenvía las credenciales y el link de acceso al administrador.</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleResendEmail}
                                        disabled={isResending}
                                        className="w-full bg-[#232732] hover:bg-[#2AABEE]/20 hover:text-[#2AABEE] text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all inline-flex items-center justify-center gap-2 border border-[#2a2e3d]"
                                    >
                                        {isResending ? 'Enviando...' : 'Reenviar Bienvenida'}
                                    </button>
                                </div>
                            )}

                            {!editingCompany && (
                                <div className="pt-4 border-t border-[#2a2e3d]">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-[#2AABEE] mb-4">Administrador Principal</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-[#8b8fa3]">Nombre Completo</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4e5d]" size={18} />
                                                <input
                                                    name="adminName"
                                                    required={!editingCompany}
                                                    className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                                                    placeholder="Juan Perez"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-[#8b8fa3]">Email</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4e5d]" size={18} />
                                                    <input
                                                        name="adminEmail"
                                                        type="email"
                                                        required={!editingCompany}
                                                        className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                                                        placeholder="admin@empresa.com"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-[#8b8fa3]">Password Temporal</label>
                                                <input
                                                    name="adminPassword"
                                                    type="password"
                                                    required={!editingCompany}
                                                    className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-all"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                    {submitting ? 'Guardando...' : editingCompany ? 'Guardar Cambios' : 'Crear Empresa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
