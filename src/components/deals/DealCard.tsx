
import React from 'react';
import { Briefcase, MessageSquare, TrendingUp, User } from 'lucide-react';
import Link from 'next/link';

interface DealCardProps {
    contactId: string;
    name: string;
    company?: string;
    budget?: string;
    summary?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
}

export function DealCard({ contactId, name, company, budget, summary, sentiment }: DealCardProps) {
    const sentimentColor =
        sentiment === 'positive' ? 'border-l-green-500' :
            sentiment === 'negative' ? 'border-l-red-500' :
                'border-l-blue-500';

    const sentimentBg =
        sentiment === 'positive' ? 'bg-green-500/10 text-green-400' :
            sentiment === 'negative' ? 'bg-red-500/10 text-red-400' :
                'bg-blue-500/10 text-blue-400';

    return (
        <div className={`bg-[#1a1d27] border border-[#2a2e3d] border-l-4 ${sentimentColor} rounded-lg p-4 space-y-3 hover:border-[#3a3f4e] transition-all group shadow-sm`}>
            <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#2a2e3d] flex items-center justify-center text-[#8b8fa3]">
                        <User size={16} />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-white group-hover:text-[#2AABEE] transition-colors line-clamp-1">{name}</h4>
                        {company && (
                            <div className="flex items-center gap-1 text-[11px] text-[#8b8fa3]">
                                <Briefcase size={10} />
                                <span className="line-clamp-1">{company}</span>
                            </div>
                        )}
                    </div>
                </div>
                {budget && (
                    <div className="px-2 py-0.5 rounded-full bg-[#2AABEE]/10 text-[#2AABEE] text-[10px] font-bold border border-[#2AABEE]/20">
                        {budget}
                    </div>
                )}
            </div>

            {summary && (
                <p className="text-xs text-[#8b8fa3] leading-relaxed line-clamp-2 italic">
                    "{summary}"
                </p>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-[#2a2e3d]">
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${sentimentBg}`}>
                    <TrendingUp size={10} />
                    <span className="capitalize">{sentiment || 'neutral'}</span>
                </div>

                <Link
                    href={`/chat?contactId=${contactId}`}
                    className="flex items-center gap-1.5 text-[11px] text-[#2AABEE] hover:text-white transition-colors"
                >
                    <MessageSquare size={12} />
                    <span>Chat</span>
                </Link>
            </div>
        </div>
    );
}
