import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  User,
  FileCheck2,
  Calendar,
  MessageSquarePlus,
  Building2,
  CheckSquare,
  Settings,
  Sparkles,
  Plus,
  ArrowRight,
  X,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Client, VisaApplication } from '../types';
import { ClientAvatar } from './ClientAvatar';
import { NavTab } from './Sidebar';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  applications: VisaApplication[];
  onNavigate: (tab: NavTab, clientId?: number | null) => void;
  onOpenNewClient: () => void;
  onOpenNewApplication: () => void;
  onOpenNewFollowUp?: () => void;
  onOpenNewTask: () => void;
  onOpenPassportScanner?: () => void;
}

type PaletteItem = {
  id: string;
  type: 'action' | 'client' | 'application' | 'nav';
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  client?: Client;
  appId?: number;
  shortcut?: string;
  run: () => void;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  clients,
  applications,
  onNavigate,
  onOpenNewClient,
  onOpenNewApplication,
  onOpenNewFollowUp,
  onOpenNewTask,
  onOpenPassportScanner,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const quickActions: PaletteItem[] = useMemo(() => [
    {
      id: 'action-new-client',
      type: 'action' as const,
      title: 'New Client Registration',
      subtitle: 'Add new traveler and passport profile',
      icon: <User className="w-4 h-4 text-sky-600" />,
      shortcut: 'C',
      run: () => {
        onClose();
        onOpenNewClient();
      },
    },
    ...(onOpenPassportScanner
      ? [
          {
            id: 'action-scan-passport',
            type: 'action' as const,
            title: 'Scan Passport (AI MRZ OCR)',
            subtitle: 'Auto-fill client details from passport photo',
            icon: <Sparkles className="w-4 h-4 text-amber-500" />,
            shortcut: 'P',
            run: () => {
              onClose();
              onOpenPassportScanner();
            },
          },
        ]
      : []),
    {
      id: 'action-new-app',
      type: 'action' as const,
      title: 'New Visa Application',
      subtitle: 'Initiate China visa application for client',
      icon: <FileCheck2 className="w-4 h-4 text-emerald-600" />,
      shortcut: 'V',
      run: () => {
        onClose();
        onOpenNewApplication();
      },
    },
    ...(onOpenNewFollowUp
      ? [
          {
            id: 'action-new-followup',
            type: 'action' as const,
            title: 'New Visa Follow-up Reminder',
            subtitle: 'Remind 1-2 month travelers for next visa',
            icon: <MessageSquarePlus className="w-4 h-4 text-teal-600" />,
            shortcut: 'F',
            run: () => {
              onClose();
              onOpenNewFollowUp();
            },
          },
        ]
      : []),
    {
      id: 'action-new-task',
      type: 'action' as const,
      title: 'Add Operational Task',
      subtitle: 'Create calendar task or collection milestone',
      icon: <CheckSquare className="w-4 h-4 text-blue-600" />,
      shortcut: 'T',
      run: () => {
        onClose();
        onOpenNewTask();
      },
    },
    {
      id: 'nav-dashboard',
      type: 'nav' as const,
      title: 'Go to Dashboard',
      subtitle: 'Operations overview & urgent items',
      icon: <ArrowRight className="w-4 h-4 text-slate-400" />,
      run: () => {
        onClose();
        onNavigate('dashboard');
      },
    },
    {
      id: 'nav-calendar',
      type: 'nav' as const,
      title: 'Go to Calendar',
      subtitle: 'Visa deadlines, collection, hotel check-ins',
      icon: <Calendar className="w-4 h-4 text-slate-400" />,
      run: () => {
        onClose();
        onNavigate('calendar');
      },
    },
    {
      id: 'nav-hotels',
      type: 'nav' as const,
      title: 'Go to Hotels & Stays',
      subtitle: 'Manage client hotel vouchers & bookings',
      icon: <Building2 className="w-4 h-4 text-slate-400" />,
      run: () => {
        onClose();
        onNavigate('hotels');
      },
    },
    {
      id: 'nav-settings',
      type: 'nav' as const,
      title: 'Go to Settings',
      subtitle: 'System, backup, retention & security',
      icon: <Settings className="w-4 h-4 text-slate-400" />,
      run: () => {
        onClose();
        onNavigate('settings');
      },
    },
  ], [onClose, onOpenNewClient, onOpenPassportScanner, onOpenNewApplication, onOpenNewFollowUp, onOpenNewTask, onNavigate]);

  // Filtered items based on query
  const items: PaletteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return quickActions;
    }

    const results: PaletteItem[] = [];

    // 1. Matched Clients (up to 6)
    const matchingClients = clients
      .filter((c) => {
        const name = (c.full_name || '').toLowerCase();
        const passport = (c.passport_number || '').toLowerCase();
        const cid = (c.client_id || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        return name.includes(q) || passport.includes(q) || cid.includes(q) || phone.includes(q);
      })
      .slice(0, 6);

    for (const c of matchingClients) {
      results.push({
        id: `client-${c.id}`,
        type: 'client',
        title: c.full_name,
        subtitle: `Passport: ${c.passport_number} • ${c.country} (${c.client_id})`,
        client: c,
        run: () => {
          onClose();
          onNavigate('clients', c.id);
        },
      });
    }

    // 2. Matched Applications (up to 4)
    const matchingApps = applications
      .filter((a) => {
        const appCode = (a.application_id || '').toLowerCase();
        const clientName = (a.client_name || '').toLowerCase();
        const visa = (a.visa_type_name || '').toLowerCase();
        const status = (a.status || '').toLowerCase();
        return appCode.includes(q) || clientName.includes(q) || visa.includes(q) || status.includes(q);
      })
      .slice(0, 4);

    for (const a of matchingApps) {
      results.push({
        id: `app-${a.id}`,
        type: 'application',
        title: `${a.application_id} — ${a.client_name}`,
        subtitle: `${a.visa_type_name} • Status: ${a.status}`,
        appId: a.id,
        icon: <FileCheck2 className="w-4 h-4 text-emerald-600" />,
        run: () => {
          onClose();
          if (a.client_id) {
            onNavigate('clients', a.client_id);
          } else {
            onNavigate('applications');
          }
        },
      });
    }

    // 3. Matched Quick Actions
    const matchingActions = quickActions.filter(
      (action) =>
        action.title.toLowerCase().includes(q) ||
        (action.subtitle && action.subtitle.toLowerCase().includes(q))
    );
    results.push(...matchingActions);

    return results;
  }, [query, clients, applications, quickActions, onClose, onNavigate]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].run();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 sm:pt-20 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative border-b border-slate-200/80 px-4 py-3.5 flex items-center gap-3 bg-slate-50/60">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a client name, passport, application #, or action..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar divide-y divide-slate-100/60"
        >
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-slate-600">No results found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Try searching for a client name, passport number, or visa ID
              </p>
            </div>
          ) : (
            items.map((item, idx) => {
              const isActive = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-active={isActive}
                  onClick={item.run}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-100 ${
                    isActive
                      ? 'bg-sky-50 text-sky-950 border border-sky-200/80 shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.client ? (
                      <ClientAvatar
                        name={item.client.full_name}
                        photoUrl={item.client.photo_url}
                        size="sm"
                        className="w-8 h-8 rounded-lg shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.icon}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{item.title}</span>
                        {item.type === 'client' && (
                          <span className="text-[10px] uppercase font-bold text-sky-700 bg-sky-100/70 px-1.5 py-0.2 rounded">
                            Client
                          </span>
                        )}
                        {item.type === 'application' && (
                          <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                            Visa
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight
                      className={`w-4 h-4 transition-transform ${
                        isActive ? 'text-sky-600 translate-x-0.5' : 'text-slate-300 opacity-0'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded">↵</kbd>
              to select
            </span>
          </div>
          <span className="text-[11px] text-slate-400">SN Travels Ops Portal</span>
        </div>
      </div>
    </div>
  );
};
