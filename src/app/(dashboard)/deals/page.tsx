
import { Briefcase, Plus } from 'lucide-react';
import { KanbanBoard } from '@/components/deals/KanbanBoard';

export default function DealsPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-[#2AABEE]/10 rounded-lg">
                            <Briefcase className="text-[#2AABEE]" size={24} />
                        </div>
                        Oportunidades de Negocio
                    </h1>
                    <p className="text-[#8b8fa3] text-sm mt-1">
                        Pipeline inteligente alimentado por el AI Shadow Agent
                    </p>
                </div>

                <button className="bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-[#2AABEE]/10 active:scale-95">
                    <Plus size={18} />
                    Nuevo Negocio
                </button>
            </div>

            <div className="pt-2">
                <KanbanBoard />
            </div>
        </div>
    );
}
