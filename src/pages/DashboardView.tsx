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
  onOpenNewTask: () => void;
  onToggleTask: (taskId: number) => void;
  onOpenStatusModal: (applicationId: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  loading,
  onOpenClient,
  onOpenNewClient,
  onOpenPassportScanner,
  onOpenNewApplication,
  onOpenNewTask,
  onToggleTask,
  onOpenStatusModal,
}) => {
  if (!metrics) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-200 rounded-xl lg:col-span-2"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Internal Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            SN Travels Agency • China Visa Client Management & Task Overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenPassportScanner && (
            <button
              onClick={onOpenPassportScanner}
              className="px-3.5 py-2 bg-gradient-to-r from-slate-900 to-sky-950 hover:from-slate-800 hover:to-sky-900 text-sky-300 border border-sky-800/40 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
              title="Scan passport identity page with ICAO Doc 9303 MRZ Engine"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Scan Passport</span>
            </button>
          )}
          <button
            onClick={onOpenNewClient}
            className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Client</span>
          </button>
          <button
            onClick={onOpenNewTask}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Clients */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Clients</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {metrics.total_clients}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Registered in system</div>
        </div>

        {/* Active Applications */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Applications</span>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {metrics.active_applications}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">In processing pipeline</div>
        </div>

        {/* Today's Tasks */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Today's Tasks</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-700 tracking-tight">
            {metrics.today_tasks}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Due today</div>
        </div>

        {/* Upcoming Tasks */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Upcoming Tasks</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {metrics.upcoming_tasks}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Scheduled next 7 days</div>
        </div>
      </div>

      {/* Main Grid: Attention Required & Today's Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Applications Requiring Attention */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h2 className="font-bold text-sm text-slate-800">
                  Applications Requiring Attention ({metrics.apps_requiring_attention.length})
                </h2>
              </div>
              <span className="text-xs text-slate-500">File Missing / Need to Prepare / Modify</span>
            </div>

            <div className="divide-y divide-slate-100">
              {metrics.apps_requiring_attention.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  All active visa applications are on track. No pending roadblocks.
                </div>
              ) : (
                metrics.apps_requiring_attention.map((app) => {
                  const statusConf = STATUS_CONFIG[app.status];
                  return (
                    <div
                      key={app.id}
                      className="p-4 hover:bg-slate-50/80 transition flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            {app.application_id}
                          </span>
                          <span className="font-semibold text-slate-900 text-sm truncate">
                            {app.client_name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Passport: {app.passport_number}</span>
                          <span>•</span>
                          <span className="text-slate-600">{app.visa_type_name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5 ${statusConf.bgClass} ${statusConf.textClass} ${statusConf.borderClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotClass}`} />
                          {app.status}
                        </span>

                        <button
                          onClick={() => onOpenStatusModal(app.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg transition"
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-800">Recently Registered Clients</h2>
              <button
                onClick={onOpenNewClient}
                className="text-xs text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1"
              >
                <span>+ Add Client</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {metrics.recent_clients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => onOpenClient(client.id)}
                  className="p-4 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <ClientAvatar
                      name={client.full_name}
                      photoUrl={client.photo_url}
                      size="sm"
                    />
                    <div>
                      <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                        <span>{client.full_name}</span>
                        <span className="text-xs text-slate-400 font-mono font-normal">
                          {client.client_id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Passport: <span className="font-mono">{client.passport_number}</span> • {client.country}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {client.google_drive_url && (
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Drive Linked
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-800">Recent Office Activity</h2>
              <span className="text-[11px] text-slate-400">Live feed</span>
            </div>

            <div className="p-4 divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {metrics.recent_activity.map((log) => (
                <div key={log.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-slate-800 font-medium leading-snug">
                      {log.details}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>By {log.user_name || 'Staff'}</span>
                    <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
