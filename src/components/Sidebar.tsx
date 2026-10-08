import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileCheck2,
  CalendarDays,
  CheckSquare,
  Settings,
  Globe,
  ExternalLink,
  Shield,
  X,
  Plane,
  Building2,
} from 'lucide-react';
import { UserRole } from '../types';

export type NavTab = 'dashboard' | 'clients' | 'applications' | 'hotels' | 'calendar' | 'tasks' | 'settings' | '404';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userRole?: UserRole;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  todayTasksCount?: number;
  attentionAppsCount?: number;
  activeHotelsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  mobileOpen,
  onCloseMobile,
  todayTasksCount = 0,
  attentionAppsCount = 0,
  activeHotelsCount = 0,
}) => {
  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: 'applications',
      label: 'Applications',
      icon: <FileCheck2 className="w-5 h-5" />,
      badge: attentionAppsCount > 0 ? attentionAppsCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'hotels',
      label: 'Hotels',
      icon: <Building2 className="w-5 h-5" />,
      badge: activeHotelsCount > 0 ? activeHotelsCount : undefined,
      badgeColor: 'bg-teal-100 text-teal-800',
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: <CalendarDays className="w-5 h-5" />,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: <CheckSquare className="w-5 h-5" />,
      badge: todayTasksCount > 0 ? todayTasksCount : undefined,
      badgeColor: 'bg-sky-100 text-sky-800',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 border-r border-slate-800">
      {/* Top Branding Section */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-sky-950/50">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white leading-tight">
              SN Travels Agency
            </h1>
            <p className="text-xs text-sky-400 font-medium">China Visa Management</p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          Navigation
        </div>

        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition group ${
                isActive
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : item.badgeColor
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Brand / Website info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            Official Portal
          </span>
          {userRole === 'super_admin' && (
            <span className="flex items-center gap-1 text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.5 rounded">
              <Shield className="w-2.5 h-2.5" /> Super Admin
            </span>
          )}
        </div>
        <a
          href="https://sn-travelsagency.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-300 hover:text-sky-300 font-medium flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition"
        >
          <span className="truncate">sn-travelsagency.com</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </a>
        <div className="mt-2 text-[10px] text-slate-400 text-center">
          Internal Office Tool • v2.4 (MySQL Edition)
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-40">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-50">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
