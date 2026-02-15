
'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else {
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        },
                    },
                });
                if (error) throw error;

                // Si el registro es exitoso pero no hay sesión (ej: requiere confirmación de email)
                if (data.user && !data.session) {
                    setError('Revisa tu correo para confirmar tu cuenta');
                    setLoading(false);
                    return;
                }
            }

            router.push('/dashboard');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Error en la autenticación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] text-[#e8eaed]">
            <div className="w-full max-w-md p-8 bg-[#1a1d27] rounded-xl border border-[#2a2e3d]">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[#2AABEE] to-[#06b6d4] bg-clip-text text-transparent">NexusCRM</h1>
                    <p className="text-[#8b8fa3] mt-2">
                        {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                    </p>
                </div>

                {error && (
                    <div className={`mb-4 p-3 rounded-lg text-sm border ${error.includes('correo')
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                        {error}
                    </div>
                )}

                {/* Google Auth desactivado temporalmente */}

                <form onSubmit={handleAuth} className="space-y-4">
                    {mode === 'register' && (
                        <div>
                            <label className="block text-sm font-medium text-[#8b8fa3] mb-1">Nombre Completo</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#2AABEE]"
                                placeholder="Juan Pérez"
                                required
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-[#8b8fa3] mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#2AABEE]"
                            placeholder="admin@nexus.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#8b8fa3] mb-1">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#2AABEE]"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'login' ? 'Entrar' : 'Registrarse')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                        className="text-sm text-[#8b8fa3] hover:text-[#2AABEE] transition-colors"
                    >
                        {mode === 'login'
                            ? '¿No tienes cuenta? Registrate aquí'
                            : '¿Ya tienes cuenta? Inicia sesión'}
                    </button>
                </div>
            </div>
        </div>
    );
}
