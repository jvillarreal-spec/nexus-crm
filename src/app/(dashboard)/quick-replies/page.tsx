
import { Zap, Plus, Search } from 'lucide-react';

export default function QuickRepliesPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Respuestas Rápidas</h1>
                <button className="bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                    <Plus size={18} />
                    Nueva Respuesta
                </button>
            </div>

            <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <Zap size={48} className="text-[#2AABEE] mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-white mb-2">Ahorra tiempo con atajos</h3>
                <p className="text-[#8b8fa3] max-w-md">
                    Crea respuestas predefinidas para las preguntas más frecuentes y úsalas directamente en el chat.
                </p>
            </div>
        </div>
    );
}
