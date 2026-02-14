
'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message || 'Error con Google');
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }

            router.push('/dashboard');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] text-[#e8eaed]">
            <div className="w-full max-w-md p-8 bg-[#1a1d27] rounded-xl border border-[#2a2e3d]">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[#2AABEE] to-[#06b6d4] bg-clip-text text-transparent">NexusCRM</h1>
                    <p className="text-[#8b8fa3] mt-2">Iniciar Sessión</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Google Auth desactivado temporalmente */}

                <form onSubmit={handleLogin} className="space-y-4">
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
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
