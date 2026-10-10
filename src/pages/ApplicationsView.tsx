import React, { useState, useMemo, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  Filter,
  Plus,
  Calendar,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Clock,
  User,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { VisaApplication, ALL_APPLICATION_STATUSES, VisaType } from '../types';
import { STATUS_CONFIG } from '../utils/status';
import { ClientAvatar } from '../components/ClientAvatar';
import { BatchApplicationStatusModal } from '../components/BatchApplicationStatusModal';
import { useDebounce } from '../hooks/useDebounce';
import { api } from '../services/api';

interface ApplicationsViewProps {
  applications: VisaApplication[];
  loading: boolean;
  visaTypes: VisaType[];
  onOpenClient: (clientId: number) => void;
  onOpenNewApplication: () => void;
  onOpenStatusModal: (applicationId: number) => void;
  searchFilter?: string;
  onRefreshData?: () => void;
}

export const ApplicationsView: React.FC<ApplicationsViewProps> = ({
  applications,
  loading,
  visaTypes,
  onOpenClient,
  onOpenNewApplication,
  onOpenStatusModal,
  searchFilter = '',
  onRefreshData,
}) => {
  const [localSearch, setLocalSearch] = useState(searchFilter);
  const debouncedSearch = useDebounce(localSearch, 300);
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [selectedVisaType, setSelectedVisaType] = useState<string>('ALL');

  // Batch selection state
  const [selectedAppIds, setSelectedAppIds] = useState<number[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  const [appToDelete, setAppToDelete] = useState<VisaApplication | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDeleteApplication = async () => {
    if (!appToDelete) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await api.deleteApplication(appToDelete.id);
      setAppToDelete(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Failed to delete application', err);
      setActionError(err.message || 'Failed to delete application.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (searchFilter !== undefined) {
      setLocalSearch(searchFilter);
    }
  }, [searchFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStatus, selectedVisaType, itemsPerPage]);

  const activeCount = useMemo(() => applications.filter((a) => a.status !== 'Returned').length, [applications]);
  const returnedCount = useMemo(() => applications.filter((a) => a.status === 'Returned').length, [applications]);

  const filteredApps = useMemo(() => {
    let list = [...applications];

    const q = debouncedSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (a) =>
          (a.application_id && a.application_id.toLowerCase().includes(q)) ||
          (a.client_name && a.client_name.toLowerCase().includes(q)) ||
          (a.passport_number && a.passport_number.toLowerCase().includes(q)) ||
          (a.visa_type_name && a.visa_type_name.toLowerCase().includes(q))
      );
    }

    if (selectedStatus === 'ACTIVE') {
      list = list.filter((a) => a.status !== 'Returned');
    } else if (selectedStatus !== 'ALL') {
      list = list.filter((a) => a.status === selectedStatus);
    }

    if (selectedVisaType !== 'ALL') {
      list = list.filter((a) => String(a.visa_type_id) === selectedVisaType);
    }

    return list;
  }, [applications, debouncedSearch, selectedStatus, selectedVisaType]);

  const totalItems = filteredApps.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const paginatedApps = useMemo(() => {
    return filteredApps.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredApps, startIndex, itemsPerPage]);

  const selectedApplications = useMemo(() => {
    return applications.filter((a) => selectedAppIds.includes(a.id));
  }, [applications, selectedAppIds]);

  const isAllSelected = useMemo(() => {
    return paginatedApps.length > 0 && paginatedApps.every((a) => selectedAppIds.includes(a.id));
  }, [paginatedApps, selectedAppIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAppIds((prev) => prev.filter((id) => !paginatedApps.some((a) => a.id === id)));
    } else {
      const pageIds = paginatedApps.map((a) => a.id);
      setSelectedAppIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectRow = (id: number) => {
    setSelectedAppIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-700" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              China Visa Applications
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor processing pipeline, status transitions, and scheduled delivery dates.
          </p>
        </div>

        <button
          onClick={onOpenNewApplication}
          className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Application</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold underline ml-2">Dismiss</button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by APP ID, client name, passport..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap justify-end">
          {/* Active vs Returned quick toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedStatus('ACTIVE')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                selectedStatus === 'ACTIVE'
                  ? 'bg-white shadow-xs text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Active Pipeline</span>
              <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded-full font-bold">
                {activeCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('Returned')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                selectedStatus === 'Returned'
                  ? 'bg-white shadow-xs text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Returned</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                {returnedCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1.5 rounded-md transition ${
                selectedStatus === 'ALL'
                  ? 'bg-white shadow-xs text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({applications.length})
            </button>
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="ACTIVE">Active (Excluding Returned)</option>
            <option value="ALL">All Statuses ({applications.length})</option>
            {ALL_APPLICATION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st} {st === 'Returned' ? `(${returnedCount})` : ''}
              </option>
            ))}
          </select>

          <select
            value={selectedVisaType}
            onChange={(e) => setSelectedVisaType(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Visa Types</option>
            {visaTypes.map((vt) => (
              <option key={vt.id} value={String(vt.id)}>
                {vt.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Floating Batch Action Bar */}
      {selectedAppIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>{selectedAppIds.length} Selected</span>
            </span>
            <span className="text-xs text-slate-300 hidden sm:inline">
              Simultaneously update processing status for all selected applications.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedAppIds([])}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setBatchModalOpen(true)}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Layers className="w-4 h-4" />
              <span>Batch Update Status ({selectedAppIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Applications Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                    title="Select / Deselect all on current page"
                  />
                </th>
                <th className="py-3 px-4 whitespace-nowrap">App ID</th>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4 whitespace-nowrap">Passport Number</th>
                <th className="py-3 px-4">Visa Category</th>
                <th className="py-3 px-4 whitespace-nowrap">Current Status</th>
                <th className="py-3 px-4 whitespace-nowrap">Delivery Date</th>
                <th className="py-3 px-4 whitespace-nowrap">Assigned Officer</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && applications.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading applications...
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    {selectedStatus === 'ACTIVE'
                      ? 'No active visa applications in progress.'
                      : selectedStatus === 'Returned'
                      ? 'No returned/completed applications found.'
                      : 'No visa applications found.'}
                  </td>
                </tr>
              ) : (
                paginatedApps.map((app) => {
                  const statusConf = STATUS_CONFIG[app.status];
                  const isSelected = selectedAppIds.includes(app.id);

                  return (
                    <tr
                      key={app.id}
                      className={`transition group ${
                        isSelected ? 'bg-sky-50/60 hover:bg-sky-50' : 'hover:bg-slate-50/90'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3.5 px-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(app.id)}
                          className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                        />
                      </td>
                      {/* App ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-600 whitespace-nowrap">
                        {app.application_id}
                      </td>

                      {/* Client Photo, Name & Passport */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-3">
                          <ClientAvatar
                            name={app.client_name || 'Client'}
                            photoUrl={app.client_photo_url}
                            size="table"
                            allowPreview={true}
                            className="shadow-sm ring-2 ring-slate-200/80 hover:ring-sky-500 transition shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpenClient(app.client_id)}
                              className="font-bold text-sm text-slate-900 group-hover:text-sky-800 hover:underline transition truncate block text-left"
                            >
                              {app.client_name}
                            </button>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                              <span className="font-mono text-slate-400">{app.client_code}</span>
                              {app.country && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 font-medium">{app.country}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Passport */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                        {app.passport_number}
                      </td>

                      {/* Visa Type */}
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {app.visa_type_name}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusConf.bgClass} ${statusConf.textClass} ${statusConf.borderClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotClass}`} />
                          {app.status}
                        </span>
                      </td>

                      {/* Delivery Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {app.delivery_date ? (
                          <div className="flex items-center gap-1.5 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{String(app.delivery_date).slice(0, 10)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Assigned Officer */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {app.assigned_user_name || 'Unassigned'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenStatusModal(app.id)}
                            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition"
                          >
                            Update Status
                          </button>
                          <button
                            type="button"
                            onClick={() => setAppToDelete(app)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Application"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenClient(app.client_id)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                            title="View Client Profile"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-medium">
              Showing {totalItems > 0 ? startIndex + 1 : 0}–{endIndex} of {totalItems} applications
              {selectedStatus === 'ACTIVE' && ` (Active pipeline)`}
            </span>
            <div className="flex items-center gap-1 text-slate-500">
              <label htmlFor="app-page-size" className="text-[11px]">Per page:</label>
              <select
                id="app-page-size"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-center">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-medium rounded-lg border border-slate-300 shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2 py-1 text-slate-600 font-semibold font-mono text-[11px]">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-medium rounded-lg border border-slate-300 shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Application Confirmation Modal */}
      {appToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-base">Delete Visa Application?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to permanently delete application{' '}
                  <strong className="font-mono text-slate-800">{appToDelete.application_id}</strong> for{' '}
                  <strong className="text-slate-800">{appToDelete.client_name || 'Client'}</strong>?
                </p>
                <p className="text-[11px] text-rose-600 font-medium bg-rose-50 p-2 rounded border border-rose-100 mt-2">
                  Warning: This will also remove associated tasks, comments, and status audit history.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setAppToDelete(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteApplication}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Application</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Application Status Modal */}
      <BatchApplicationStatusModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        selectedApplications={selectedApplications}
        onSuccess={() => {
          setSelectedAppIds([]);
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
