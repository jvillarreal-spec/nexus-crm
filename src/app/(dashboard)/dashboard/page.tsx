
'use client';

import { useEffect, useState } from 'react';
import { Users, MessageSquare, Clock, TrendingUp, Mail, Activity, User as UserIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
    const [stats, setStats] = useState({
        activeConversations: 0,
        totalMessages: 0,
        newLeads: 0,
        totalContacts: 0,
    });
    const [recentConversations, setRecentConversations] = useState<any[]>([]);
    const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. Basic Stats (Cards)
            const { count: activeConvCount } = await supabase
                .from('conversations')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'open');

            const { count: totalMsgCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true });

            const { count: totalContactsCount } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true });

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

            // 2. Recent Conversations
            const { data: convs } = await supabase
                .from('conversations')
                .select(`
                    id, 
                    last_message_at, 
                    unread_count, 
                    status,
                    contacts (id, first_name, last_name, username, channel)
                `)
                .order('last_message_at', { ascending: false })
                .limit(5);

            setRecentConversations(convs || []);

            // 3. Weekly Activity (Messages per day)
            const sevenDaysAgo = startOfDay(subDays(new Date(), 7)).toISOString();
            const { data: msgs } = await supabase
                .from('messages')
                .select('created_at')
                .gte('created_at', sevenDaysAgo);

            // Process data for chart
            const chartData = Array.from({ length: 7 }).map((_, i) => {
                const date = subDays(new Date(), 6 - i);
                const count = (msgs || []).filter(m => isSameDay(new Date(m.created_at), date)).length;
                return {
                    label: format(date, 'eee', { locale: es }),
                    fullDate: format(date, 'dd/MM'),
                    count
                };
            });
            setWeeklyActivity(chartData);

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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
                {/* Weekly Activity Chart */}
                <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-6 h-80 flex flex-col">
                    <h3 className="text-lg font-semibold mb-6 text-[#e8eaed]">Mensajes últimos 7 días</h3>
                    <div className="flex-1 flex items-end justify-between gap-2 px-2">
                        {weeklyActivity.map((day, i) => {
                            const maxCount = Math.max(...weeklyActivity.map(d => d.count), 1);
                            const height = (day.count / maxCount) * 100;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                    <div className="w-full relative flex items-end justify-center h-40">
                                        <div
                                            className="w-full max-w-[32px] bg-[#2AABEE]/60 group-hover:bg-[#2AABEE] rounded-t-md transition-all duration-500"
                                            style={{ height: `${height}%` }}
                                        >
                                            {day.count > 0 && (
                                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {day.count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-[#8b8fa3] uppercase font-bold">{day.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Conversations List */}
                <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-6 h-80 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4 text-[#e8eaed]">Actividad Reciente</h3>
                    <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-sm text-[#8b8fa3]">Cargando...</div>
                        ) : recentConversations.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-[#8b8fa3]">No hay conversaciones aún</div>
                        ) : (
                            recentConversations.map((conv) => (
                                <div key={conv.id} className="flex items-center justify-between p-3 rounded-lg bg-[#232732]/30 border border-[#2a2e3d]/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[#1a1d27] flex items-center justify-center text-[#2AABEE] border border-[#2a2e3d]">
                                            <UserIcon size={14} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white line-clamp-1">
                                                {conv.contacts?.first_name || conv.contacts?.username || 'Usuario'}
                                            </p>
                                            <p className="text-[10px] text-[#8b8fa3]">
                                                {format(new Date(conv.last_message_at), "d 'de' MMM, HH:mm", { locale: es })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${conv.status === 'open' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#8b8fa3]/10 text-[#8b8fa3]'}`}>
                                            {conv.status === 'open' ? 'Abierto' : 'Cerrado'}
                                        </span>
                                        {conv.unread_count > 0 && (
                                            <span className="w-4 h-4 rounded-full bg-[#2AABEE] text-[10px] flex items-center justify-center text-white font-bold">
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
