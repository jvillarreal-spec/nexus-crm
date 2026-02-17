'use client';

import { useState, useEffect } from 'react';
import { Settings, User, Bell, Shield, Database, MessageCircle, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { updateCompanyBot } from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('profile');
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const supabase = createClient();

    // Bot Config State
    const [botToken, setBotToken] = useState('');
    const [botSecret, setBotSecret] = useState('');

    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*, companies(*)')
                    .eq('id', user.id)
                    .single();
                setProfile(profileData);
                if (profileData?.companies) {
                    setBotToken(profileData.companies.telegram_token || '');
                    setBotSecret(profileData.companies.telegram_secret_token || '');
                }
            }
            setLoading(false);
        }
        loadData();
    }, []);

    const handleSaveBot = async () => {
        if (!profile?.company_id) return;
        setSaving(true);
        setMessage(null);

        const result = await updateCompanyBot(profile.company_id, botToken, botSecret);

        if (result.success) {
            setMessage({ type: 'success', text: 'Configuración de Bot actualizada y Webhook registrado con éxito.' });
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al actualizar el bot.' });
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8 text-[#8b8fa3]">Cargando...</div>;

    const isAdmin = profile?.role === 'org_admin' || profile?.role === 'super_admin';

    return (
        <div className="max-w-5xl space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Configuración</h1>
                <p className="text-[#8b8fa3] mt-1">Gestiona tu perfil y las integraciones de tu empresa.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-1 space-y-2">
                    <TabItem
                        icon={<User size={18} />}
                        label="Mi Perfil"
                        active={activeTab === 'profile'}
                        onClick={() => setActiveTab('profile')}
                    />
                    {isAdmin && (
                        <TabItem
                            icon={<MessageCircle size={18} />}
                            label="Canales (Telegram)"
                            active={activeTab === 'channels'}
                            onClick={() => setActiveTab('channels')}
                        />
                    )}
                    <TabItem icon={<Bell size={18} />} label="Notificaciones" disabled />
                    <TabItem icon={<Shield size={18} />} label="Seguridad" disabled />
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    {activeTab === 'profile' && (
                        <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] p-8 shadow-xl">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <User className="text-[#2AABEE]" />
                                Información Personal
                            </h3>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Nombre Completo</label>
                                        <input
                                            type="text"
                                            defaultValue={profile?.full_name}
                                            className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            defaultValue={profile?.email}
                                            disabled
                                            className="w-full bg-[#11131c]/50 border border-[#2a2e3d] rounded-xl px-4 py-3 text-[#4a4e5d] cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                <button className="bg-[#2AABEE] text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-[#2AABEE]/20 hover:scale-105 transition-all">
                                    Guardar Perfil
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'channels' && (
                        <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] p-8 shadow-xl">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Send className="text-[#2AABEE]" />
                                        Configuración de Telegram
                                    </h3>
                                    <p className="text-sm text-[#8b8fa3] mt-2 max-w-md">
                                        Vincula tu propio bot de Telegram para recibir mensajes directamente en NexusCRM.
                                    </p>
                                </div>
                                <div className="p-3 bg-blue-500/10 rounded-2xl">
                                    <MessageCircle className="text-[#2AABEE]" size={32} />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex gap-3 text-orange-500">
                                    <AlertCircle className="shrink-0" size={20} />
                                    <p className="text-xs font-bold leading-relaxed">
                                        RECUERDA: Debes obtener tu Token desde @BotFather en Telegram.
                                        Una vez guardado, Nexus registrará automáticamente el Webhook.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Telegram Bot Token</label>
                                        <input
                                            type="password"
                                            value={botToken}
                                            onChange={(e) => setBotToken(e.target.value)}
                                            placeholder="123456789:ABCDefGhIjkLmNoP..."
                                            className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-colors font-mono text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Secret Token (Opcional)</label>
                                        <input
                                            type="text"
                                            value={botSecret}
                                            onChange={(e) => setBotSecret(e.target.value)}
                                            placeholder="Un valor secreto para validar webhooks"
                                            className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-colors text-sm"
                                        />
                                    </div>
                                </div>

                                {message && (
                                    <div className={cn(
                                        "p-4 rounded-xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-2",
                                        message.type === 'success' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                    )}>
                                        {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                        {message.text}
                                    </div>
                                )}

                                <button
                                    onClick={handleSaveBot}
                                    disabled={saving || !botToken}
                                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#2AABEE] disabled:bg-[#2AABEE]/50 text-white px-8 py-3 rounded-xl text-sm font-black shadow-lg shadow-[#2AABEE]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                    {saving ? 'Guardando...' : 'Guardar y Activar Bot'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TabItem({ icon, label, active, onClick, disabled }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all relative group",
                active
                    ? "bg-[#2AABEE]/10 text-[#2AABEE] shadow-[inset_0_0_10px_rgba(42,171,238,0.1)]"
                    : "text-[#4a4e5d] hover:bg-[#232732] hover:text-[#8b8fa3]",
                disabled && "opacity-30 cursor-not-allowed"
            )}
        >
            {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#2AABEE] rounded-r-full shadow-[0_0_10px_#2AABEE]" />}
            <span className={cn("transition-transform group-hover:scale-110", active && "scale-110")}>{icon}</span>
            <span className="tracking-wide">{label}</span>
        </button>
    );
}
