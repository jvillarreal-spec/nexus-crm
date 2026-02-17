
'use client';

import { useEffect, useState } from 'react';
import {
    Users,
    MessageSquare,
    Clock,
    TrendingUp,
    Mail,
    Activity,
    User as UserIcon,
    Shield,
    Building2,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function Dashboard() {
    const [stats, setStats] = useState({
        activeConversations: 0,
        totalMessages: 0,
        newLeads: 0,
        totalContacts: 0,
        totalCompanies: 0,
        dealsValue: 0,
        dealsCount: 0,
        wonDealsCount: 0,
        totalUsersGlobal: 0,
    });
    const [recentConversations, setRecentConversations] = useState<any[]>([]);
    const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);
    const [agentLoads, setAgentLoads] = useState<any[]>([]);
    const [pipelineStats, setPipelineStats] = useState<any[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [authId, setAuthId] = useState<string | null>(null);
    const [debugError, setDebugError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Date Range State (Default: Last 30 Days)
    const [range, setRange] = useState('30d');
    const [dateRange, setDateRange] = useState({
        start: startOfDay(subDays(new Date(), 30)).toISOString(),
        end: new Date().toISOString()
    });

    const supabase = createClient();

    useEffect(() => {
        fetchInitialData();
    }, [dateRange]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log('--- DASHBOARD AUTH DEBUG ---', user?.id);
            if (user) {
                setAuthId(user.id);
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*, companies(*)')
                    .eq('id', user.id)
                    .single();

                if (profileData) {
                    setProfile(profileData);
                    await fetchDashboardData(profileData);
                } else {
                    console.warn('Profile not found for authenticated user');
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Error in fetchInitialData:', error);
            setLoading(false);
        }
    };

    const fetchDashboardData = async (userProfile: any) => {
        if (!userProfile) {
            setLoading(false);
            return;
        }
        // ... (rest of the logic remains, will be updated to handle errors inside)
        try {
            const companyId = userProfile?.company_id;
            const isSuper = userProfile?.role === 'super_admin';
            const isAdmin = userProfile?.role === 'org_admin' || isSuper;
            const userId = userProfile?.id;

            // --- 1. Basic Stats with Date Filtering ---
            // Base Queries
            let qActive = supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'open');
            let qTotalMsg = supabase.from('messages').select('*', { count: 'exact', head: true });
            let qContacts = supabase.from('contacts').select('*', { count: 'exact', head: true });
            let qDeals = supabase.from('deals').select('value, stage');

            // Multi-tenant Filters
            if (!isSuper) {
                qActive = qActive.eq('company_id', companyId);
                qTotalMsg = qTotalMsg.eq('company_id', companyId);
                qContacts = qContacts.eq('company_id', companyId);
                qDeals = qDeals.eq('company_id', companyId);
            }

            // Role Filters (Agent only sees their own)
            if (userProfile.role === 'agent') {
                qActive = qActive.eq('assigned_to', userId);
                qContacts = qContacts.eq('assigned_to', userId);
                qDeals = qDeals.eq('assigned_to', userId);
                qTotalMsg = qTotalMsg.eq('sender_id', userId);
            }

            // Date Filters
            qTotalMsg = qTotalMsg.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
            qContacts = qContacts.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
            qDeals = qDeals.gte('created_at', dateRange.start).lte('created_at', dateRange.end);

            const [activeRes, msgRes, contactsRes, dealsRes] = await Promise.all([
                qActive, qTotalMsg, qContacts, qDeals
            ]);

            // Calculate Deals Stats
            const totalDealsValue = (dealsRes.data || []).reduce((acc: number, d: any) => acc + (Number(d.value) || 0), 0);

            // Pipeline Breakdown
            const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
            const pipeline = stages.map(stage => ({
                stage,
                count: (dealsRes.data || []).filter((d: any) => d.stage === stage).length
            }));
            setPipelineStats(pipeline);

            // Companies Count (Super only)
            let companiesCount = 0;
            let totalUsersGlobal = 0;
            if (isSuper) {
                const { count: cCount } = await supabase.from('companies').select('*', { count: 'exact', head: true });
                const { count: uCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
                companiesCount = cCount || 0;
                totalUsersGlobal = uCount || 0;
            }

            setStats({
                activeConversations: activeRes.count || 0,
                totalMessages: msgRes.count || 0,
                newLeads: contactsRes.count || 0,
                totalContacts: contactsRes.count || 0,
                totalCompanies: companiesCount,
                dealsValue: totalDealsValue,
                dealsCount: dealsRes.data?.length || 0,
                wonDealsCount: (dealsRes.data || []).filter((d: any) => d.stage === 'won').length,
                totalUsersGlobal
            });

            // 2. Recent Conversations
            let qRecent = supabase
                .from('conversations')
                .select(`id, last_message_at, unread_count, status, contacts (id, first_name, last_name, username, channel)`)
                .order('last_message_at', { ascending: false })
                .limit(5);

            if (!isSuper) qRecent = qRecent.eq('company_id', companyId);
            if (userProfile.role === 'agent') qRecent = qRecent.eq('assigned_to', userId);
            const { data: convs } = await qRecent;
            setRecentConversations(convs || []);

            // 3. Activity Chart (Responds to Range)
            const diffDays = Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24));
            const step = diffDays > 30 ? 7 : 1; // Show weekly or daily

            let qWeekly = supabase.from('messages').select('created_at').gte('created_at', dateRange.start).lte('created_at', dateRange.end);
            if (!isSuper) qWeekly = qWeekly.eq('company_id', companyId);
            const { data: msgs } = await qWeekly;

            const chartData = Array.from({ length: Math.min(diffDays, 14) }).map((_, i) => {
                const date = subDays(new Date(dateRange.end), i);
                const count = (msgs || []).filter(m => isSameDay(new Date(m.created_at), date)).length;
                return {
                    label: format(date, 'dd MMM', { locale: es }),
                    count,
                    date
                };
            }).reverse();
            setWeeklyActivity(chartData);

            // 4. Agent Load (Only for Admins)
            if (isAdmin && companyId) {
                const { data: loadData } = await supabase.rpc('get_agent_load', { org_id: companyId });
                if (loadData) {
                    const { data: agentNames } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', loadData.map((l: any) => l.agent_id));

                    const merged = loadData.map((l: any) => ({
                        ...l,
                        name: agentNames?.find(a => a.id === l.agent_id)?.full_name || 'Agente'
                    }));
                    setAgentLoads(merged);
                }
            }

        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRangeChange = (r: string) => {
        setRange(r);
        let start = startOfDay(subDays(new Date(), 7)).toISOString();
        if (r === '30d') start = startOfDay(subDays(new Date(), 30)).toISOString();
        if (r === '90d') start = startOfDay(subDays(new Date(), 90)).toISOString();
        if (r === '24h') start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        setDateRange({ start, end: new Date().toISOString() });
    };

    const isSuper = profile?.role === 'super_admin';
    const isAdmin = profile?.role === 'org_admin' || isSuper;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Panel de Control</h1>
                    <p className="text-[#8b8fa3] mt-1 font-medium">
                        {isSuper ? 'Resumen Global de NexusCRM' : profile?.companies?.name || 'Cargando...'}
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-[#1a1d27] p-1.5 rounded-2xl border border-[#2a2e3d] shadow-inner">
                    {[
                        { id: '24h', label: '24h' },
                        { id: '7d', label: '7 Días' },
                        { id: '30d', label: '30 Días' },
                        { id: '90d', label: '90 Días' }
                    ].map((btn) => (
                        <button
                            key={btn.id}
                            onClick={() => handleRangeChange(btn.id)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                range === btn.id
                                    ? "bg-[#2AABEE] text-white shadow-lg shadow-[#2AABEE]/20"
                                    : "text-[#4a4e5d] hover:text-[#8b8fa3]"
                            )}
                        >
                            {btn.label}
                        </button>
                    ))}
                    <div className="w-px h-4 bg-[#2a2e3d] mx-1" />
                    <button
                        onClick={() => fetchDashboardData(profile)}
                        className="p-2 text-[#8b8fa3] hover:text-[#2AABEE] transition-colors"
                        title="Actualizar datos"
                    >
                        <Activity size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Inspección Técnica */}
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
                <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">Inspección de Sesión</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-[10px] font-mono text-[#8b8fa3]">
                    <div>AuthID (Raw): <span className="text-white">{authId || 'Buscando...'}</span></div>
                    <div>Rol: <span className="text-white">{profile?.role || 'Sin rol'}</span></div>
                    <div>EmpresaID: <span className="text-white">{profile?.company_id || 'SIN PERFIL'}</span></div>
                    <div>Error: <span className="text-red-400 font-bold">{debugError || 'Ninguno'}</span></div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Volumen Negocios"
                    value={loading ? "..." : `$${stats.dealsValue.toLocaleString()}`}
                    trend="Valor total en periodo"
                    icon={<TrendingUp className="text-[#2AABEE]" />}
                    color="cyan"
                />
                <StatCard
                    title="Chats Activos"
                    value={loading ? "..." : stats.activeConversations.toString()}
                    trend="Abiertas ahora"
                    icon={<MessageSquare className="text-purple-500" />}
                    color="purple"
                />
                {isSuper ? (
                    <StatCard
                        title="Total Usuarios Global"
                        value={loading ? "..." : stats.totalUsersGlobal.toString()}
                        trend="Cuentas activas totales"
                        icon={<Shield className="text-[#2AABEE]" />}
                        color="cyan"
                    />
                ) : (
                    <StatCard
                        title="Nuevos Leads"
                        value={loading ? "..." : stats.newLeads.toString()}
                        trend="En el periodo"
                        icon={<Users className="text-orange-500" />}
                        color="orange"
                    />
                )}
                <StatCard
                    title="Ventas Cerradas"
                    value={loading ? "..." : stats.wonDealsCount.toString()}
                    trend="Negocios ganados"
                    icon={<CheckCircle className="text-green-500" />}
                    color="green"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pt-4">
                {/* Reports / Performance */}
                <div className="xl:col-span-2 space-y-8">
                    {/* Sales Pipeline */}
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] p-8 shadow-xl">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp size={18} className="text-[#2AABEE]" />
                                Pipeline de Ventas
                            </h3>
                            <span className="text-[10px] font-bold text-[#4a4e5d] uppercase tracking-widest">Distribución por Etapa</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {pipelineStats.map((item, idx) => (
                                <div key={idx} className="bg-[#232732]/30 border border-[#2a2e3d] rounded-2xl p-4 flex flex-col items-center text-center group hover:border-[#2AABEE]/30 transition-all">
                                    <span className="text-[9px] font-black text-[#4a4e5d] uppercase tracking-tighter mb-1 group-hover:text-[#2AABEE]">{item.stage}</span>
                                    <span className="text-xl font-black text-white">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activity Chart */}
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] p-8 shadow-xl">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-8 flex items-center gap-2">
                            <Activity size={18} className="text-[#2AABEE]" />
                            Actividad de Mensajes
                        </h3>
                        <div className="flex items-end justify-between gap-4 h-48 px-2">
                            {weeklyActivity.map((day, i) => {
                                const maxCount = Math.max(...weeklyActivity.map(d => d.count), 1);
                                const height = (day.count / maxCount) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                                        <div className="w-full relative flex items-end justify-center h-full">
                                            <div
                                                className="w-full max-w-[40px] bg-[#2AABEE]/20 group-hover:bg-[#2AABEE] rounded-xl transition-all duration-500 relative cursor-pointer"
                                                style={{ height: `${height}%` }}
                                            >
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#2AABEE] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {day.count}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-[#4a4e5d] group-hover:text-[#2AABEE] uppercase font-black tracking-widest transition-colors">{day.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Agent Performance (Admins Only) */}
                    {isAdmin && (
                        <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] overflow-hidden shadow-xl">
                            <div className="p-8 border-b border-[#2a2e3d] flex justify-between items-center bg-[#232732]/30">
                                <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Shield size={18} className="text-[#2AABEE]" />
                                    Carga de Equipo
                                </h3>
                                <span className="text-[10px] font-bold text-[#8b8fa3]">TIEMPO REAL</span>
                            </div>
                            <div className="p-4 overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4a4e5d]">
                                            <th className="px-4 py-3">Comercial</th>
                                            <th className="px-4 py-3">Chats Abiertos</th>
                                            <th className="px-4 py-3 text-right">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2a2e3d]">
                                        {agentLoads.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-sm text-[#4a4e5d]">No hay métricas de comerciales disponibles</td>
                                            </tr>
                                        ) : (
                                            agentLoads.map((load, idx) => (
                                                <tr key={idx} className="hover:bg-[#232732]/30 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-[#2AABEE]/10 flex items-center justify-center text-[10px] text-[#2AABEE] font-bold">
                                                                {load.name?.[0]}
                                                            </div>
                                                            <span className="text-sm font-bold text-[#e8eaed]">{load.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1.5 w-16 bg-[#2a2e3d] rounded-full overflow-hidden">
                                                                <div
                                                                    className={cn(
                                                                        "h-full rounded-full transition-all",
                                                                        load.open_chats > 5 ? "bg-orange-500" : "bg-[#2AABEE]"
                                                                    )}
                                                                    style={{ width: `${Math.min(load.open_chats * 10, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-black text-white">{load.open_chats}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        {load.open_chats > 5 ? (
                                                            <span className="text-[8px] font-black bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded border border-orange-500/20">CARGA ALTA</span>
                                                        ) : (
                                                            <span className="text-[8px] font-black bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded border border-green-500/20">ÓPTIMO</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Activity Sidebar */}
                <div className="space-y-6">
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] p-6 shadow-xl flex flex-col h-full max-h-[600px]">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center justify-between">
                            Últimos Mensajes
                            <AlertCircle size={14} className="text-[#2AABEE] animate-pulse" />
                        </h3>
                        <div className="flex-1 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[#232732]/30 rounded-2xl animate-pulse" />)}
                                </div>
                            ) : recentConversations.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                    <MessageSquare size={32} className="text-[#2a2e3d] mb-4" />
                                    <p className="text-xs text-[#4a4e5d] font-bold uppercase tracking-widest">Sin actividad reciente</p>
                                </div>
                            ) : (
                                recentConversations.map((conv) => (
                                    <div key={conv.id} className="group p-4 rounded-2xl bg-[#232732]/30 border border-[#2a2e3d]/50 hover:border-[#2AABEE]/30 transition-all cursor-pointer">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-[#1a1d27] flex items-center justify-center text-[#2AABEE] font-black text-[10px] border border-[#2a2e3d]">
                                                    {conv.contacts?.first_name?.[0] || 'U'}
                                                </div>
                                                <p className="text-sm font-bold text-white group-hover:text-[#2AABEE] transition-colors truncate max-w-[100px]">
                                                    {conv.contacts?.first_name || 'Incógnito'}
                                                </p>
                                            </div>
                                            <span className="text-[9px] text-[#4a4e5d] font-bold uppercase">
                                                {format(new Date(conv.last_message_at), "HH:mm", { locale: es })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className={cn(
                                                "text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest",
                                                conv.status === 'open' ? 'bg-green-500/10 text-green-500' : 'bg-[#2a2e3d] text-[#8b8fa3]'
                                            )}>
                                                {conv.status === 'open' ? 'Activo' : 'Cerrado'}
                                            </span>
                                            {conv.unread_count > 0 && (
                                                <span className="h-4 min-w-[16px] px-1 rounded-full bg-[#2AABEE] text-[9px] flex items-center justify-center text-white font-black shadow-lg shadow-[#2AABEE]/20">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, trend, icon, color }: any) {
    const colors: any = {
        cyan: "from-[#2AABEE]/10 border-[#2AABEE]/20 text-[#2AABEE]",
        purple: "from-purple-500/10 border-purple-500/20 text-purple-500",
        orange: "from-orange-500/10 border-orange-500/20 text-orange-500",
        green: "from-green-500/10 border-green-500/20 text-green-500",
        indigo: "from-indigo-500/10 border-indigo-500/20 text-indigo-500",
    };

    return (
        <div className={cn(
            "relative bg-gradient-to-br bg-[#1a1d27] border rounded-[2rem] p-6 shadow-xl hover:translate-y-[-4px] transition-all group",
            colors[color]
        )}>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b8fa3] mb-1">{title}</p>
                    <h3 className="text-3xl font-black text-white tracking-tight group-hover:scale-110 transition-transform origin-left">{value}</h3>
                </div>
                <div className="p-3 bg-[#232732] rounded-2xl shadow-inner">
                    {icon}
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                <span className="text-[10px] font-bold text-[#4a4e5d] uppercase tracking-wider">{trend}</span>
            </div>
        </div>
    );
}
