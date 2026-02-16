
import { Briefcase, Plus } from 'lucide-react';

export default function DealsPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Deals / Oportunidades</h1>
                <button className="bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                    <Plus size={18} />
                    Nuevo Deal
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <PipelineColumn title="Leads" count={5} color="bg-[#f59e0b]" />
                <PipelineColumn title="Calificados" count={2} color="bg-[#3b82f6]" />
                <PipelineColumn title="Propuesta" count={3} color="bg-[#a855f7]" />
                <PipelineColumn title="Negociación" count={1} color="bg-[#22c55e]" />
            </div>

            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#2a2e3d] rounded-xl text-[#8b8fa3]">
                <Briefcase size={48} className="mb-4 opacity-20" />
                <p>El pipeline de ventas estará disponible próximamente.</p>
            </div>
        </div>
    );
}

function PipelineColumn({ title, count, color }: any) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color}`}></div>
                    <span className="text-sm font-semibold text-white">{title}</span>
                </div>
                <span className="text-xs bg-[#1a1d27] border border-[#2a2e3d] px-2 py-0.5 rounded text-[#8b8fa3]">
                    {count}
                </span>
            </div>
        </div>
    );
}
