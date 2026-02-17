
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Briefcase,
    Settings,
    Menu,
    X,
    Zap,
    BookOpen,
    Shield,
    UserPlus,
    Building2,
    Crown,
    LogOut
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const ALL_NAV_ITEMS = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'org_admin', 'agent'] },
    { name: 'Empresas', href: '/admin/companies', icon: Building2, roles: ['super_admin'] },
    { name: 'Comerciales', href: '/admin/users', icon: UserPlus, roles: ['org_admin', 'super_admin'] },
    { name: 'Chat', href: '/chat', icon: MessageSquare, roles: ['org_admin', 'agent'] },
    { name: 'Contactos', href: '/contacts', icon: Users, roles: ['org_admin', 'agent'] },
    { name: 'Deals', href: '/deals', icon: Briefcase, roles: ['org_admin', 'agent'] },
    { name: 'Contexto', href: '/context', icon: BookOpen, roles: ['org_admin', 'agent'] },
    { name: 'Respuestas', href: '/quick-replies', icon: Zap, roles: ['org_admin', 'agent'] },
    { name: 'Configuración', href: '/settings', icon: Settings, roles: ['org_admin', 'agent', 'super_admin'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [company, setCompany] = useState<any>(null);
    const supabase = createClient();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    useEffect(() => {
        async function fetchProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*, companies(*)')
                    .eq('id', user.id)
                    .single();

                if (profileData) {
                    setProfile(profileData);
                    setCompany(profileData.companies);
                }
            }
        }
        fetchProfile();
    }, []);

    const userRole = profile?.role || 'agent';
    const filteredNavItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(userRole));

    return (
        <div className="flex h-screen bg-[#0f1117] text-[#e8eaed]">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 bg-[#1a1d27] border-r border-[#2a2e3d] transition-transform duration-300 lg:static lg:translate-x-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex h-16 items-center justify-between px-6 border-b border-[#2a2e3d]">
                    <div className="flex flex-col">
                        <span className="text-xl font-bold bg-gradient-to-r from-[#2AABEE] to-[#06b6d4] bg-clip-text text-transparent leading-none">NexusCRM</span>
                        {company && (
                            <span className="text-[10px] font-bold text-[#2AABEE] uppercase tracking-[0.2em] mt-1 opacity-80">{company.name}</span>
                        )}
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden text-[#8b8fa3] hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    {filteredNavItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                    "flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95",
                                    isActive
                                        ? "bg-[#2AABEE] text-white shadow-lg shadow-[#2AABEE]/20"
                                        : "text-[#8b8fa3] hover:bg-[#232732] hover:text-white"
                                )}
                            >
                                <item.icon size={22} className={cn(isActive ? "text-white" : "text-[#8b8fa3]")} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[#2a2e3d] bg-[#1a1d27]">
                    <div className="flex items-center gap-3 px-2">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-[#232732] flex items-center justify-center text-sm font-bold text-[#2AABEE] border border-[#2AABEE]/20 shadow-lg shadow-[#2AABEE]/5">
                                {profile?.full_name?.[0] || profile?.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                            {profile?.role === 'super_admin' && (
                                <div className="absolute -top-1 -right-1 bg-[#2AABEE] text-white p-1 rounded-full shadow-lg">
                                    <Crown size={10} />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{profile?.full_name || 'Usuario'}</p>
                            <p className="text-[10px] text-[#2AABEE] font-black uppercase tracking-widest bg-[#2AABEE]/10 px-1.5 py-0.5 rounded-md inline-block">
                                {profile?.role === 'super_admin' ? 'Super Admin' : profile?.role === 'org_admin' ? 'Admin' : 'Comercial'}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="ml-auto p-2 text-[#4a4e5d] hover:text-[#ef4444] transition-all active:scale-90"
                            title="Cerrar sesión"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <div className="lg:hidden flex items-center h-16 px-4 border-b border-[#2a2e3d] bg-[#1a1d27]">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="text-[#8b8fa3] hover:text-white"
                    >
                        <Menu size={24} />
                    </button>
                    <span className="ml-4 text-lg font-bold">NexusCRM</span>
                </div>

                <div className="flex-1 overflow-auto bg-[#0f1117]">
                    {children}
                </div>
            </main>
        </div>
    );
}
