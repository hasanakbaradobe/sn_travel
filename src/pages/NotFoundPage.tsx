import React from 'react';
import { ShieldAlert, Lock } from 'lucide-react';
import { NavTab } from '../components/Sidebar';

interface NotFoundPageProps {
  onNavigate?: (tab: NavTab) => void;
  onSearch?: (query: string) => void;
  requestedPath?: string;
  isAuthenticated?: boolean;
  onAccessKeyEntered?: (key: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  isAuthenticated = false,
  onNavigate,
}) => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-sans text-slate-800 relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-slate-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Rose Bar */}
        <div className="h-1.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600" />

        <div className="p-8 sm:p-10 text-center space-y-6">
          {/* Security Shield Lock Icon */}
          <div className="relative inline-block mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto shadow-inner text-rose-600">
              <ShieldAlert className="w-10 h-10 stroke-[1.8]" />
            </div>
            <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 bg-slate-900 text-rose-400 font-mono font-bold text-xs rounded-full shadow-md border border-slate-700">
              403
            </div>
          </div>

          {/* Heading & Direct Message */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-800 rounded-full text-xs font-bold border border-rose-200">
              <Lock className="w-3.5 h-3.5 text-rose-600" />
              <span>Access Denied</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              You Are Unauthorized
            </h1>

            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              You do not have authorization to view this page or access the system. A valid unique secret link is required to reach the login page.
            </p>
          </div>

          {/* Clear Guidance Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 leading-relaxed text-center">
            If you are an authorized staff member, please contact your <strong className="text-slate-800">System Administrator</strong> to receive your designated access link.
          </div>

          {isAuthenticated && onNavigate && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition underline underline-offset-4 cursor-pointer"
              >
                Return to Workspace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


