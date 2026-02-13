
import { Users, MessageSquare, Clock, TrendingUp } from 'lucide-react';

export default function Dashboard() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Conversaciones Activas"
                    value="12"
                    trend="+2 hoy"
                    icon={<MessageSquare className="text-[#2AABEE]" />}
                />
                <StatCard
                    title="Tiempo Promedio"
                    value="4m 32s"
                    trend="-15s vs ayer"
                    icon={<Clock className="text-[#22c55e]" />}
                />
                <StatCard
                    title="Nuevos Leads"
                    value="8"
                    trend="+3 hoy"
                    icon={<Users className="text-[#f59e0b]" />}
                />
                <StatCard
                    title="Tasa de Cierre"
                    value="24%"
                    trend="+2.1%"
                    icon={<TrendingUp className="text-[#a855f7]" />}
                />
            </div>

            {/* Placeholder Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
                <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-6 h-80">
                    <h3 className="text-lg font-semibold mb-4 text-[#e8eaed]">Actividad Reciente</h3>
                    <div className="flex items-center justify-center h-full text-[#8b8fa3]">
                        Gráfico de actividad...
                    </div>
                </div>
                <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-6 h-80">
                    <h3 className="text-lg font-semibold mb-4 text-[#e8eaed]">Rendimiento por Agente</h3>
                    <div className="flex items-center justify-center h-full text-[#8b8fa3]">
                        Lista de agentes...
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
                <span className="text-[#22c55e] font-medium">{trend}</span>
            </div>
        </div>
    )
}
