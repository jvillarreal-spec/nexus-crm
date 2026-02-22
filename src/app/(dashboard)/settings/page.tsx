'use client';

import { useState, useEffect } from 'react';
import { Settings, User, Bell, Shield, Database, MessageCircle, Send, CheckCircle, AlertCircle, Loader2, BookOpen, Clock, Lock, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { updateCompanyBot, updateSupportEmail, updateBusinessHours } from '@/app/actions/admin';
import { updatePassword } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

const DAYS = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_HOURS = {
    monday: { start: '09:00', end: '18:00', enabled: true },
    tuesday: { start: '09:00', end: '18:00', enabled: true },
    wednesday: { start: '09:00', end: '18:00', enabled: true },
    thursday: { start: '09:00', end: '18:00', enabled: true },
    friday: { start: '09:00', end: '18:00', enabled: true },
    saturday: { start: '09:00', end: '13:00', enabled: true },
    sunday: { start: '09:00', end: '18:00', enabled: false },
};

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

    // Notification State
    const [supportEmail, setSupportEmail] = useState('');

    // Business Hours State
    const [businessHours, setBusinessHours] = useState<any>(DEFAULT_HOURS);
    const [timezone, setTimezone] = useState('America/Bogota');

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setNeedsPasswordChange(user.user_metadata?.new_account === true);
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*, companies(*)')
                    .eq('id', user.id)
                    .single();
                setProfile(profileData);
                if (profileData?.companies) {
                    setBotToken(profileData.companies.telegram_token || '');
                    setBotSecret(profileData.companies.telegram_secret_token || '');
                    setSupportEmail(profileData.companies.support_email || '');
                    if (profileData.companies.business_hours) {
                        setBusinessHours(profileData.companies.business_hours);
                    }
                    setTimezone(profileData.companies.timezone || 'America/Bogota');
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

    const handleSaveNotifications = async () => {
        if (!profile?.company_id) return;
        setSaving(true);
        setMessage(null);

        const result = await updateSupportEmail(profile.company_id, supportEmail);

        if (result.success) {
            setMessage({ type: 'success', text: 'Configuración de notificaciones guardada con éxito.' });
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al guardar notificaciones.' });
        }
        setSaving(false);
    };

    const handleSaveBusinessHours = async () => {
        if (!profile?.company_id) return;
        setSaving(true);
        setMessage(null);
        const result = await updateBusinessHours(profile.company_id, businessHours, timezone);
        if (result.success) {
            setMessage({ type: 'success', text: 'Horarios de atención guardados con éxito.' });
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al guardar horarios.' });
        }
        setSaving(false);
    };

    const handleUpdatePassword = async () => {
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Las contraseñas no coinciden.' });
            return;
        }
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
            return;
        }

        setSaving(true);
        setMessage(null);

        const result = await updatePassword(newPassword);

        if (result.success) {
            setMessage({ type: 'success', text: 'Contraseña actualizada con éxito.' });
            setNewPassword('');
            setConfirmPassword('');
            setNeedsPasswordChange(false);
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al actualizar la contraseña.' });
        }
        setSaving(false);
    };

    const updateDay = (day: string, field: string, value: any) => {
        setBusinessHours((prev: any) => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));
    };

    if (loading) return <div className="p-8 text-[#8b8fa3]">Cargando...</div>;

    const isAdmin = profile?.role === 'org_admin' || profile?.role === 'super_admin';

    return (
        <div className="max-w-5xl space-y-8 animate-in fade-in duration-500">
            {needsPasswordChange && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-4 text-amber-500">
                    <AlertCircle className="shrink-0" />
                    <div>
                        <p className="text-sm font-black">CAMBIO DE CLAVE REQUERIDO</p>
                        <p className="text-xs opacity-80">Estás usando una clave temporal. Por seguridad, debes cambiarla ahora.</p>
                    </div>
                    <button
                        onClick={() => setActiveTab('security')}
                        className="ml-auto bg-amber-500 text-[#11131c] px-4 py-2 rounded-xl text-xs font-black hover:scale-105 transition-transform"
                    >
                        Cambiar Ahora
                    </button>
                </div>
            )}

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
                        <>
                            <TabItem
                                icon={<MessageCircle size={18} />}
                                label="Canales (Telegram)"
                                active={activeTab === 'channels'}
                                onClick={() => setActiveTab('channels')}
                            />
                            <TabItem
                                icon={<Bell size={18} />}
                                label="Notificaciones"
                                active={activeTab === 'notifications'}
                                onClick={() => setActiveTab('notifications')}
                            />
                            <TabItem
                                icon={<Clock size={18} />}
                                label="Horarios"
                                active={activeTab === 'hours'}
                                onClick={() => setActiveTab('hours')}
                            />
                        </>
                    )}
                    <TabItem
                        icon={<Shield size={18} />}
                        label="Seguridad"
                        active={activeTab === 'security'}
                        onClick={() => setActiveTab('security')}
                    />
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

                    {activeTab === 'security' && (
                        <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] p-8 shadow-xl">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Shield className="text-[#2AABEE]" />
                                        Seguridad de la Cuenta
                                    </h3>
                                    <p className="text-sm text-[#8b8fa3] mt-2 max-w-md">
                                        Cambia tu contraseña para mantener tu acceso seguro.
                                    </p>
                                </div>
                                <div className="p-3 bg-blue-500/10 rounded-2xl">
                                    <Lock className="text-[#2AABEE]" size={32} />
                                </div>
                            </div>

                            <div className="space-y-6">
                                {needsPasswordChange && (
                                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex gap-3 text-orange-500">
                                        <AlertCircle className="shrink-0" size={20} />
                                        <p className="text-xs font-bold leading-relaxed">
                                            Tu administrador ha solicitado un cambio de contraseña. Por favor, elige una nueva clave segura.
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="relative">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Nueva Contraseña</label>
                                        <input
                                            type={showPasswords ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-colors"
                                        />
                                        <button
                                            onClick={() => setShowPasswords(!showPasswords)}
                                            className="absolute right-4 top-[38px] text-[#4a4e5d] hover:text-[#2AABEE] transition-colors"
                                        >
                                            {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Confirmar Contraseña</label>
                                        <input
                                            type={showPasswords ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-colors"
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
                                    onClick={handleUpdatePassword}
                                    disabled={saving || !newPassword}
                                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#2AABEE] disabled:bg-[#2AABEE]/50 text-white px-8 py-3 rounded-xl text-sm font-black shadow-lg shadow-[#2AABEE]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                                    {saving ? 'Actualizando...' : 'Actualizar Contraseña'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] p-8 shadow-xl">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Bell className="text-[#2AABEE]" />
                                        Configuración de Notificaciones
                                    </h3>
                                    <p className="text-sm text-[#8b8fa3] mt-2 max-w-md">
                                        Gestiona cómo recibes las alertas de soporte y los leads del sistema.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex gap-3 text-blue-400">
                                    <AlertCircle className="shrink-0" size={20} />
                                    <p className="text-xs font-bold leading-relaxed">
                                        Esta dirección de correo recibirá los reportes de problemas enviados por los clientes a través del bot de Telegram.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Correo de Soporte</label>
                                    <input
                                        type="email"
                                        value={supportEmail}
                                        onChange={(e) => setSupportEmail(e.target.value)}
                                        placeholder="soporte@tuempresa.com"
                                        className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-colors"
                                    />
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
                                    onClick={handleSaveNotifications}
                                    disabled={saving}
                                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#2AABEE] disabled:bg-[#2AABEE]/50 text-white px-8 py-3 rounded-xl text-sm font-black shadow-lg shadow-[#2AABEE]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                    {saving ? 'Guardando...' : 'Guardar Configuración'}
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

                                <div className="space-y-4 border-t border-[#2a2e3d] pt-6">
                                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                        <BookOpen size={14} className="text-[#2AABEE]" />
                                        Guía de Configuración
                                    </h4>
                                    <div className="space-y-3">
                                        <StepItem
                                            number="1"
                                            text="Busca a @BotFather en Telegram y presiona /start."
                                        />
                                        <StepItem
                                            number="2"
                                            text="Envía el comando /newbot y sigue las instrucciones para darle un nombre y un username."
                                        />
                                        <StepItem
                                            number="3"
                                            text="Copia el API Token que te entregue BotFather (ej: 1234567:ABC...)."
                                        />
                                        <StepItem
                                            number="4"
                                            text="Pega el token arriba y haz clic en 'Guardar'. Nexus configurará el webhook automáticamente."
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

                    {activeTab === 'hours' && (
                        <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-[2rem] p-8 shadow-xl">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Clock className="text-[#2AABEE]" />
                                        Horarios de Atención
                                    </h3>
                                    <p className="text-sm text-[#8b8fa3] mt-2 max-w-md">
                                        Define cuándo están disponibles tus asesores. Fuera de estos horarios, el Bot pedirá los datos del cliente.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                {DAYS.map(({ key, label }) => {
                                    const day = businessHours[key] || { start: '09:00', end: '18:00', enabled: false };
                                    return (
                                        <div key={key} className={cn(
                                            "flex items-center gap-4 p-4 rounded-2xl border transition-all",
                                            day.enabled
                                                ? "bg-[#11131c] border-[#2AABEE]/30"
                                                : "bg-[#11131c]/50 border-[#2a2e3d] opacity-60"
                                        )}>
                                            {/* Toggle */}
                                            <button
                                                onClick={() => updateDay(key, 'enabled', !day.enabled)}
                                                className={cn(
                                                    "relative w-10 h-6 rounded-full transition-all shrink-0",
                                                    day.enabled ? "bg-[#2AABEE]" : "bg-[#2a2e3d]"
                                                )}
                                            >
                                                <span className={cn(
                                                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all",
                                                    day.enabled ? "left-5" : "left-1"
                                                )} />
                                            </button>

                                            {/* Day label */}
                                            <span className="w-24 text-sm font-bold text-white shrink-0">{label}</span>

                                            {/* Time pickers */}
                                            {day.enabled ? (
                                                <div className="flex items-center gap-2 flex-1">
                                                    <input
                                                        type="time"
                                                        value={day.start}
                                                        onChange={(e) => updateDay(key, 'start', e.target.value)}
                                                        className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2AABEE] transition-colors"
                                                    />
                                                    <span className="text-[#4a4e5d] text-sm">—</span>
                                                    <input
                                                        type="time"
                                                        value={day.end}
                                                        onChange={(e) => updateDay(key, 'end', e.target.value)}
                                                        className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2AABEE] transition-colors"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-xs text-[#4a4e5d] font-bold uppercase tracking-widest">Cerrado</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mb-6">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[#4a4e5d] mb-2">Zona Horaria</label>
                                <select
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                    className="w-full bg-[#11131c] border border-[#2a2e3d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#2AABEE] transition-colors text-sm"
                                >
                                    <option value="America/Bogota">América/Bogotá (COT)</option>
                                    <option value="America/Mexico_City">América/Ciudad de México (CST)</option>
                                    <option value="America/Lima">América/Lima (PET)</option>
                                    <option value="America/Santiago">América/Santiago (CLT)</option>
                                    <option value="America/Buenos_Aires">América/Buenos Aires (ART)</option>
                                    <option value="America/Caracas">América/Caracas (VET)</option>
                                    <option value="America/New_York">América/Nueva York (EST)</option>
                                    <option value="Europe/Madrid">Europa/Madrid (CET)</option>
                                </select>
                            </div>

                            {message && (
                                <div className={cn(
                                    "p-4 rounded-xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-2 mb-4",
                                    message.type === 'success' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                )}>
                                    {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    {message.text}
                                </div>
                            )}

                            <button
                                onClick={handleSaveBusinessHours}
                                disabled={saving}
                                className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#2AABEE] disabled:bg-[#2AABEE]/50 text-white px-8 py-3 rounded-xl text-sm font-black shadow-lg shadow-[#2AABEE]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Clock size={18} />}
                                {saving ? 'Guardando...' : 'Guardar Horarios'}
                            </button>
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

function StepItem({ number, text }: { number: string, text: string }) {
    return (
        <div className="flex gap-3 items-start group">
            <div className="w-5 h-5 rounded-md bg-[#232732] border border-[#2a2e3d] flex items-center justify-center text-[10px] font-black text-[#2AABEE] shrink-0 group-hover:border-[#2AABEE]/30 transition-colors">
                {number}
            </div>
            <p className="text-[11px] text-[#8b8fa3] leading-relaxed">
                {text}
            </p>
        </div>
    );
}
