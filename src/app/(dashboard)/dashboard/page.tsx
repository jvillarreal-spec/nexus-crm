
'use client';

import { useEffect, useState } from 'react';
import { Users, MessageSquare, Clock, TrendingUp, Mail, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function Dashboard() {
    const [stats, setStats] = useState({
        activeConversations: 0,
        totalMessages: 0,
        newLeads: 0,
        totalContacts: 0,
    });
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Get Active Conversations count
            const { count: activeConvCount } = await supabase
                .from('conversations')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'open');

            // Get Total Messages count
            const { count: totalMsgCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true });

            // Get Total Contacts count
            const { count: totalContactsCount } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true });

            // Get New Leads (last 24h)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { count: newLeadsCount } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', twentyFourHoursAgo);

            setStats({
                activeConversations: activeConvCount || 0,
                totalMessages: totalMsgCount || 0,
                newLeads: newLeadsCount || 0,
                totalContacts: totalContactsCount || 0,
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Panel de Control</h1>
                <button
                    onClick={fetchDashboardData}
                    className="text-sm text-[#2AABEE] hover:underline flex items-center gap-2"
                >
                    <Activity size={16} />
                    Actualizar datos
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Conversaciones Activas"
                    value={loading ? "..." : stats.activeConversations.toString()}
                    trend="Abiertas ahora"
                    icon={<MessageSquare className="text-[#2AABEE]" />}
                />
                <StatCard
                    title="Volumen Mensajes"
                    value={loading ? "..." : stats.totalMessages.toString()}
                    trend="Histórico total"
                    icon={<TrendingUp className="text-[#22c55e]" />}
                />
                <StatCard
                    title="Nuevos Leads (24h)"
                    value={loading ? "..." : stats.newLeads.toString()}
                    trend="Últimas 24 horas"
                    icon={<Users className="text-[#f59e0b]" />}
                />
                <StatCard
                    title="Total Contactos"
                    value={loading ? "..." : stats.totalContacts.toString()}
                    trend="Cartera total"
                    icon={<Mail className="text-[#a855f7]" />}
                />
            </div>

            {/* Placeholder Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
                <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-6 h-80">
                    <h3 className="text-lg font-semibold mb-4 text-[#e8eaed]">Actividad Reciente</h3>
                    <div className="flex flex-col items-center justify-center h-full text-[#8b8fa3] text-center">
                        <Activity size={48} className="mb-4 opacity-10" />
                        <p className="text-sm">El gráfico de actividad se generará automáticamente<br />cuando haya más volumen de datos.</p>
                    </div>
                </div>
                <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-6 h-80">
                    <h3 className="text-lg font-semibold mb-4 text-[#e8eaed]">Rendimiento</h3>
                    <div className="flex flex-col items-center justify-center h-full text-[#8b8fa3] text-center">
                        <TrendingUp size={48} className="mb-4 opacity-10" />
                        <p className="text-sm">Métricas de conversión y KPI del agente.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, trend, icon }: any) {
    return (
        <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-5 hover:border-[#2AABEE]/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm text-[#8b8fa3] font-medium">{title}</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
                </div>
                <div className="p-2 bg-[#232732] rounded-lg">
                    {icon}
                </div>
            </div>
            <div className="flex items-center text-xs">
                <span className="text-[#8b8fa3] font-medium opacity-70">{trend}</span>
            </div>
        </div>
    )
}
