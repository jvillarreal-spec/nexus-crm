
'use client';

import React from 'react';
import { Sparkles, MessageSquare, Target, ShieldCheck, Copy, Check, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface SalesAdviceProps {
    advice: {
        insights: string;
        next_step: string;
        objection_handling?: string;
        suggested_replies: string[];
    } | null;
    error?: string | null;
}

export function SalesCoach({ advice, error }: SalesAdviceProps) {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 h-full bg-red-500/5 rounded-2xl border border-dashed border-red-500/20">
                <div className="p-3 bg-red-500/10 rounded-full text-red-500 mb-2">
                    <Target size={24} />
                </div>
                <h3 className="text-red-400 font-semibold text-sm">Error en AI Coach</h3>
                <p className="text-[#8b8fa3] text-[10px] max-w-xs break-words">
                    {error}
                </p>
                <p className="text-[10px] text-[#4a4e5d]">
                    Verifica tu API Key en AI Studio.
                </p>
            </div>
        );
    }

    if (!advice) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 h-full bg-[#1a1d27]/20 rounded-2xl border border-dashed border-[#2a2e3d]">
                <div className="p-3 bg-[#2AABEE]/10 rounded-full text-[#2AABEE] mb-2 animate-pulse">
                    <Sparkles size={24} />
                </div>
                <h3 className="text-white font-semibold text-sm">Nexus AI Coach</h3>
                <p className="text-[#8b8fa3] text-xs max-w-[180px]">
                    Esperando el próximo mensaje para darte consejos de cierre...
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#1a1d27]/40 backdrop-blur-xl border border-[#2a2e3d] rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 bg-[#2AABEE]/10 border-b border-[#2AABEE]/20 flex items-center gap-3">
                <Sparkles className="text-[#2AABEE]" size={20} />
                <div>
                    <h3 className="text-white font-bold text-sm tracking-tight">AI Sales Copilot</h3>
                    <p className="text-[#2AABEE] text-[10px] uppercase font-bold tracking-widest">En Tiempo Real</p>
                </div>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

                {/* Insights */}
                <section className="space-y-2">
                    <div className="flex items-center gap-2 text-[#8b8fa3]">
                        <Lightbulb size={14} className="text-amber-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Perfil del Mensaje</span>
                    </div>
                    <div className="bg-[#2a2e3d]/30 border border-[#2a2e3d] p-3 rounded-xl text-xs text-white leading-relaxed">
                        {advice.insights}
                    </div>
                </section>

                {/* Next Step */}
                <section className="space-y-2">
                    <div className="flex items-center gap-2 text-[#8b8fa3]">
                        <Target size={14} className="text-[#2AABEE]" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Acción Sugerida</span>
                    </div>
                    <div className="bg-[#2AABEE]/5 border border-[#2AABEE]/10 p-3 rounded-xl text-xs text-[#2AABEE] font-medium leading-relaxed">
                        {advice.next_step}
                    </div>
                </section>

                {/* Objection Handling */}
                {advice.objection_handling && (
                    <section className="space-y-2">
                        <div className="flex items-center gap-2 text-[#8b8fa3]">
                            <ShieldCheck size={14} className="text-emerald-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Manejo de Objeciones</span>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl text-xs text-emerald-100/80 leading-relaxed italic">
                            "{advice.objection_handling}"
                        </div>
                    </section>
                )}

                {/* Suggested Replies */}
                <section className="space-y-3">
                    <div className="flex items-center gap-2 text-[#8b8fa3]">
                        <MessageSquare size={14} className="text-purple-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Sugerencias (Copy & Paste)</span>
                    </div>
                    <div className="space-y-2">
                        {advice.suggested_replies.map((reply, idx) => (
                            <button
                                key={idx}
                                onClick={() => copyToClipboard(reply, idx)}
                                className="w-full text-left p-3 bg-[#1a1d27] border border-[#2a2e3d] hover:border-[#2AABEE]/50 hover:bg-[#2AABEE]/5 rounded-xl text-xs text-white transition-all group flex justify-between items-center gap-2"
                            >
                                <span className="line-clamp-2">{reply}</span>
                                <div className="flex-shrink-0 text-[#8b8fa3] group-hover:text-[#2AABEE]">
                                    {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            {/* Footer */}
            <div className="p-3 text-[10px] text-center text-[#4a4e5d] border-t border-[#2a2e3d]">
                Basado en psicología de ventas y contexto actual
            </div>
        </div>
    );
}
