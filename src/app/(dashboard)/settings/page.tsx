
import { Settings, User, Bell, Shield, Database } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="max-w-4xl space-y-8">
            <h1 className="text-2xl font-bold text-white">Configuración</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-1">
                    <nav className="space-y-1">
                        <SettingsItem icon={<User size={18} />} label="Perfil" active />
                        <SettingsItem icon={<Bell size={18} />} label="Notificaciones" />
                        <SettingsItem icon={<Shield size={18} />} label="Seguridad" />
                        <SettingsItem icon={<Database size={18} />} label="Integraciones" />
                    </nav>
                </div>

                <div className="md:col-span-2 space-y-6">
                    <div className="bg-[#1a1d27] border border-[#2a2e3d] rounded-xl p-6">
                        <h3 className="text-lg font-medium text-white mb-6">Información del Perfil</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[#8b8fa3] mb-1">Nombre</label>
                                <input type="text" defaultValue="Admin User" className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#2AABEE]" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#8b8fa3] mb-1">Email</label>
                                <input type="email" defaultValue="admin@nexus.com" className="w-full bg-[#0f1117] border border-[#2a2e3d] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#2AABEE]" />
                            </div>
                            <button className="bg-[#2AABEE] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2AABEE]/90 transition-colors">
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SettingsItem({ icon, label, active }: any) {
    return (
        <button className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-[#2AABEE]/10 text-[#2AABEE]' : 'text-[#8b8fa3] hover:bg-[#232732] hover:text-white'
            }`}>
            {icon}
            {label}
        </button>
    );
}
