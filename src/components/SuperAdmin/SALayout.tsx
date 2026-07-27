/**
 * SALayout.tsx — Sidebar layout shell for the super admin SPA
 */
import { useState } from 'react';
import {
  LayoutDashboard, Building2, Users, LogOut,
  Menu, X, Shield, ChevronRight,
} from 'lucide-react';
import { authClient } from '../../lib/authClient';

export type SAPage = 'dashboard' | 'orgs' | 'users';

interface SALayoutProps {
  page: SAPage;
  setPage: (p: SAPage) => void;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

const NAV = [
  { id: 'dashboard' as SAPage, label: 'Dashboard',      Icon: LayoutDashboard },
  { id: 'orgs'      as SAPage, label: 'Organisations',  Icon: Building2 },
  { id: 'users'     as SAPage, label: 'Users',          Icon: Users },
];

export default function SALayout({ page, setPage, userName, userEmail, children }: SALayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = '/superadmin';
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-900/40">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">HisaabKitaab</p>
            <p className="text-xs text-indigo-400 mt-0.5">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ id, label, Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => { setPage(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon size={18} className={active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
              {label}
              {active && <ChevronRight size={14} className="ml-auto text-indigo-500/60" />}
            </button>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs font-semibold text-white truncate">{userName}</p>
          <p className="text-xs text-slate-500 truncate">{userEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all duration-150"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col lg:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white transition"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-indigo-400" />
            <span className="text-sm font-semibold text-white">Admin Console</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
