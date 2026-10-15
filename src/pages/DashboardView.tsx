import React from 'react';
import {
  Users,
  FileCheck2,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Plus,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { DashboardMetrics, Task } from '../types';
import { STATUS_CONFIG, getPriorityBadge } from '../utils/status';
import { ClientAvatar } from '../components/ClientAvatar';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  loading: boolean;
  onOpenClient: (clientId: number) => void;
  onOpenNewClient: () => void;
  onOpenPassportScanner?: () => void;
  onOpenNewApplication: () => void;
  onOpenNewFollowUp?: () => void;
  onOpenNewTask: () => void;
  onToggleTask: (taskId: number) => void;
  onOpenStatusModal: (applicationId: number) => void;
  onNavigate?: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  loading,
  onOpenClient,
  onOpenNewClient,
  onOpenPassportScanner,
  onOpenNewApplication,
  onOpenNewFollowUp,
  onOpenNewTask,
  onToggleTask,
  onOpenStatusModal,
  onNavigate,
}) => {
  if (!metrics) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-72 bg-slate-200 rounded-2xl lg:col-span-2"></div>
          <div className="h-72 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Welcome & Quick Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Internal Operations Dashboard
            </h1>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
              Live Office Hub
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            SN Travels Agency • China Visa Client Management & Task Overview
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {onOpenPassportScanner && (
            <button
              onClick={onOpenPassportScanner}
              className="px-3 py-2 bg-gradient-to-r from-slate-900 to-sky-950 hover:from-slate-800 hover:to-sky-900 text-sky-300 border border-sky-800/40 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Scan passport identity page with AI OCR"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Scan Passport</span>
            </button>
          )}

          <button
            onClick={onOpenNewClient}
            className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Client</span>
          </button>

          <button
            onClick={onOpenNewApplication}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>New Visa</span>
          </button>

          {onOpenNewFollowUp && (
            <button
              onClick={onOpenNewFollowUp}
              className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Follow-up</span>
            </button>
          )}

          <button
            onClick={onOpenNewTask}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-400" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* KPI Cards — Tactile & Clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Clients */}
        <div
          onClick={() => onNavigate && onNavigate('clients')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-sky-300 transition-all duration-200 flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-sky-700 transition-colors">
              Total Clients
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {metrics.total_clients}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Registered travelers</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Active Applications */}
        <div
          onClick={() => onNavigate && onNavigate('applications')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-emerald-700 transition-colors">
              Active Applications
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {metrics.active_applications}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>In processing pipeline</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Today's Tasks */}
        <div
          onClick={() => onNavigate && onNavigate('calendar')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-700 transition-colors">
              Today's Tasks
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-700 tracking-tight">
            {metrics.today_tasks}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Due today</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div
          onClick={() => onNavigate && onNavigate('calendar')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
              Upcoming Tasks
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {metrics.upcoming_tasks}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Next 7 days</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </div>

      {/* Main Grid: Attention Required & Today's Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Applications Requiring Attention */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-900">
                    Applications Requiring Attention ({metrics.apps_requiring_attention.length})
                  </h2>
                  <p className="text-[11px] text-slate-500">File Missing / Need to Prepare / Modify</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate && onNavigate('applications')}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900 transition-colors cursor-pointer"
              >
                View all →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {metrics.apps_requiring_attention.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-semibold text-slate-700">All applications on track</p>
                  <p className="text-xs text-slate-400 mt-0.5">No applications currently require urgent attention.</p>
                </div>
              ) : (
                metrics.apps_requiring_attention.map((app) => {
                  const statusConf = STATUS_CONFIG[app.status];
                  return (
                    <div
                      key={app.id}
                      className="p-4 hover:bg-slate-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/80">
                            {app.application_id}
                          </span>
                          <span
                            onClick={() => onOpenStatusModal(app.id)}
                            className="font-bold text-slate-900 text-sm hover:text-sky-700 cursor-pointer truncate"
                            title="Click to view & update application status"
                          >
                            {app.client_name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                          <span>Passport: <strong className="font-mono text-slate-700">{app.passport_number}</strong></span>
                          <span>•</span>
                          <span className="text-slate-600 font-medium">{app.visa_type_name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${statusConf.bgClass} ${statusConf.textClass} ${statusConf.borderClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotClass}`} />
                          {app.status}
                        </span>

                        <button
                          onClick={() => onOpenStatusModal(app.id)}
                          className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                        >
                          Update Status
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Clients */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm text-slate-900">Recently Registered Clients</h2>
                <p className="text-[11px] text-slate-500">Newly added travelers and passport records</p>
              </div>
              <button
                onClick={onOpenNewClient}
                className="text-xs text-sky-700 hover:text-sky-900 font-bold px-2.5 py-1 rounded-lg hover:bg-sky-50 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>+ Add Client</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {metrics.recent_clients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => onOpenClient(client.id)}
                  className="p-4 hover:bg-slate-50/90 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ClientAvatar
                      name={client.full_name}
                      photoUrl={client.photo_url}
                      size="md"
                      className="w-9 h-9 rounded-xl text-sm shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 group-hover:text-sky-700 transition-colors flex items-center gap-2">
                        <span className="truncate">{client.full_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-medium bg-slate-100 px-1.5 py-0.2 rounded">
                          {client.client_id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        Passport: <span className="font-mono text-slate-700">{client.passport_number}</span> • {client.country}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {client.google_drive_url && (
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        Drive
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm text-slate-900">Recent Office Activity</h2>
                <p className="text-[11px] text-slate-500">Live operational audit log</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            <div className="p-3 divide-y divide-slate-100 max-h-[520px] overflow-y-auto no-scrollbar">
              {metrics.recent_activity.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No recent activities recorded yet.
                </div>
              ) : (
                metrics.recent_activity.map((log) => (
                  <div key={log.id} className="p-3 first:pt-1 last:pb-1 hover:bg-slate-50 rounded-xl transition-colors">
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">
                      {log.details}
                    </p>
                    <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                      <span className="font-semibold text-slate-500">By {log.user_name || 'Staff'}</span>
                      <span className="font-mono text-slate-400">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
