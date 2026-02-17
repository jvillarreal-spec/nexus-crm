
'use client';

import { useState } from 'react';
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
    BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Chat', href: '/chat', icon: MessageSquare },
    { name: 'Contactos', href: '/contacts', icon: Users },
    { name: 'Deals', href: '/deals', icon: Briefcase },
    { name: 'Contexto', href: '/context', icon: BookOpen },
    { name: 'Respuestas', href: '/quick-replies', icon: Zap },
    { name: 'Configuración', href: '/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
                    <span className="text-xl font-bold bg-gradient-to-r from-[#2AABEE] to-[#06b6d4] bg-clip-text text-transparent">NexusCRM</span>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden text-[#8b8fa3] hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1">
                    {navItems.map((item) => {
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

                <div className="p-4 border-t border-[#2a2e3d]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#232732] flex items-center justify-center text-sm font-bold text-[#2AABEE]">
                            AD
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">Admin User</p>
                            <p className="text-xs text-[#8b8fa3]">admin@nexus.com</p>
                        </div>
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

                <div className="flex-1 overflow-auto p-4 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
