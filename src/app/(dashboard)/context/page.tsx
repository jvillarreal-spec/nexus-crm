
'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Save, Loader2, Info, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ContextPage() {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const supabase = createClient();

    useEffect(() => {
        fetchContext();
    }, []);

    const fetchContext = async () => {
        try {
            const { data, error } = await supabase
                .from('organization_knowledge')
                .select('content')
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Fetch error:', error);
                // If it's a 42P01 (relation does not exist), keep loading false but content empty
            } else if (data) {
                setContent(data.content);
            }
        } catch (e) {
            console.error('Unexpected fetch error:', e);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const { data: existing, error: fetchExistingError } = await supabase
                .from('organization_knowledge')
                .select('id')
                .limit(1)
                .maybeSingle();

            if (fetchExistingError) {
                console.error('Fetch existing error:', fetchExistingError);
                throw fetchExistingError;
            }

            let error;
            if (existing) {
                const { error: updateError } = await supabase
                    .from('organization_knowledge')
                    .update({ content, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('organization_knowledge')
                    .insert({ content });
                error = insertError;
            }

            if (error) {
                console.error('Save error details:', error);
                setMessage({ type: 'error', text: `Error al guardar: ${error.message || 'Intente de nuevo.'}` });
            } else {
                setMessage({ type: 'success', text: 'Contexto actualizado correctamente. La IA ahora usará esta información.' });
                setTimeout(() => setMessage(null), 5000);
            }
        } catch (err: any) {
            console.error('Critical save error:', err);
            setMessage({ type: 'error', text: `Error crítico: ${err.message || 'Verifique la consola.'}` });
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-[#8b8fa3]">
                <Loader2 size={32} className="animate-spin mb-4 text-[#2AABEE]" />
                <p>Cargando información corporativa...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-[#2AABEE]/10 rounded-lg">
                            <BookOpen className="text-[#2AABEE]" size={24} />
                        </div>
                        Contexto de Servicios y Productos
                    </h1>
                    <p className="text-[#8b8fa3] text-sm mt-1">
                        Define qué vende tu empresa para que el AI Sales Coach sea un experto.
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#2AABEE] hover:bg-[#2AABEE]/90 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-[#2AABEE]/10 active:scale-95"
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Guardar Cambios
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-sm font-medium border ${message.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-2xl overflow-hidden focus-within:border-[#2AABEE]/50 transition-colors">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Escribe aquí: Productos, Precios, Beneficios, Garantías, FAQ..."
                            className="w-full h-[500px] bg-transparent p-6 text-sm text-[#e8eaed] leading-relaxed focus:outline-none resize-none"
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-[#2AABEE]/5 border border-[#2AABEE]/10 p-6 rounded-2xl space-y-4">
                        <div className="flex items-center gap-2 text-[#2AABEE]">
                            <Sparkles size={18} />
                            <h3 className="font-bold text-sm uppercase tracking-wider">¿Cómo llenar esto?</h3>
                        </div>
                        <ul className="space-y-3 text-xs text-[#8b8fa3] leading-relaxed">
                            <li className="flex gap-2">
                                <span className="text-[#2AABEE] font-bold">•</span>
                                <div><strong>Servicios</strong>: Describe qué haces y qué problemas resuelves.</div>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-[#2AABEE] font-bold">•</span>
                                <div><strong>Precios</strong>: Lista tus paquetes o rangos de precios para que la IA maneje el presupuesto.</div>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-[#2AABEE] font-bold">•</span>
                                <div><strong>Diferenciales</strong>: ¿Por qué eres mejor que la competencia?</div>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-[#2AABEE] font-bold">•</span>
                                <div><strong>Políticas</strong>: Tiempos de entrega, métodos de pago y garantías.</div>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-[#1a1d27]/50 border border-[#2a2e3d] p-6 rounded-2xl flex items-start gap-3">
                        <Info className="text-amber-400 flex-shrink-0" size={18} />
                        <p className="text-[11px] text-[#8b8fa3] leading-relaxed">
                            Toda la información que pongas aquí será analizada por el <strong>AI Sales Coach</strong> cada vez que un cliente te hable. ¡Sé lo más específico posible!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
