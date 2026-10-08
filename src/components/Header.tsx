import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Menu,
  Shield,
  ExternalLink,
  ChevronDown,
  Sparkles,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { User, DatabaseStatus } from '../types';

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onOpenChangePassword?: () => void;
  users?: User[];
  onOpenNewClient: () => void;
  onOpenPassportScanner?: () => void;
  onOpenDbModal: () => void;
  dbStatus: DatabaseStatus | null;
  onGlobalSearch: (query: string) => void;
  searchQuery: string;
  onToggleMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onOpenChangePassword,
  users,
  onOpenNewClient,
  onOpenPassportScanner,
  onOpenDbModal,
  dbStatus,
  onGlobalSearch,
  searchQuery,
  onToggleMobileSidebar,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserDropdownOpen(false);
      }
    };
    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [userDropdownOpen]);

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Mobile hamburger & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Input */}
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onGlobalSearch(e.target.value)}
            placeholder="Search by client name, passport, ID (e.g. CL-000001)..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onGlobalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Right: Quick Create Client + User Role Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Scan Passport Action */}
        {onOpenPassportScanner && (
          <button
            onClick={onOpenPassportScanner}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-slate-900 to-sky-950 hover:from-slate-800 hover:to-sky-900 text-sky-300 border border-sky-800/40 rounded-lg text-xs font-semibold shadow-xs transition active:scale-95"
            title="Scan passport identity page with AI OCR"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Scan Passport</span>
          </button>
        )}

        {/* New Client Action */}
        <button
          onClick={onOpenNewClient}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-sm font-medium shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Client</span>
        </button>

        {/* User Switcher / Profile */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-medium text-xs flex items-center justify-center shadow-inner">
              {currentUser?.name.charAt(0) || 'U'}
            </div>
            <div className="hidden md:block text-left text-xs leading-tight">
              <div className="font-semibold text-slate-800 truncate max-w-[130px]">
                {currentUser?.name.split(' ')[0] || 'User'}
              </div>
              <div className="text-slate-500 flex items-center gap-1">
                {currentUser?.role === 'super_admin' ? (
                  <span className="text-sky-700 font-medium">Super Admin</span>
                ) : (
                  <span>Staff</span>
                )}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {userDropdownOpen && (
            <div
              className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setUserDropdownOpen(false)}
            >
              <div className="px-3 py-2.5 border-b border-slate-100">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Signed in as</div>
                <div className="text-sm font-bold text-slate-900 truncate mt-0.5">{currentUser?.name}</div>
                <div className="text-xs text-slate-500 font-mono truncate">{currentUser?.email}</div>
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      currentUser?.role === 'super_admin'
                        ? 'bg-sky-100 text-sky-800'
                        : currentUser?.role === 'admin'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Shield className="w-2.5 h-2.5" />
                    {currentUser?.role === 'super_admin'
                      ? 'SUPER ADMIN (Full Control)'
                      : currentUser?.role === 'admin'
                      ? 'ADMINISTRATOR'
                      : 'STAFF / VISA DESK'}
                  </span>
                </div>
              </div>

              <div className="py-1 space-y-0.5">
                {onOpenChangePassword && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenChangePassword();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    <span>Change Password</span>
                  </button>
                )}

                <a
                  href="https://sn-travelsagency.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-50 flex items-center justify-between transition"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>Agency Website</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">sn-travelsagency.com</span>
                </a>
              </div>

              <div className="pt-1.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sign Out</span>
                  </span>
                  <span className="text-[10px] text-rose-400 font-normal">End Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
