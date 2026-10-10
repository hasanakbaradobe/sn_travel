import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  FolderOpen,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Trash2,
  Sparkles,
  Camera,
  Loader2,
} from 'lucide-react';
import { Client } from '../types';
import { STATUS_CONFIG } from '../utils/status';
import { ClientAvatar } from '../components/ClientAvatar';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { api } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';

interface ClientsViewProps {
  clients: Client[];
  loading: boolean;
  onOpenClient: (clientId: number) => void;
  onOpenNewClient: () => void;
  onOpenPassportScanner?: () => void;
  searchFilter?: string;
  onRefreshData?: () => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  loading,
  onOpenClient,
  onOpenNewClient,
  onOpenPassportScanner,
  searchFilter = '',
  onRefreshData,
}) => {
  const [localSearch, setLocalSearch] = useState(searchFilter);
  const debouncedSearch = useDebounce(localSearch, 300);
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'name' | 'id' | 'country' | 'created'>('created');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Server & Client Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // Sync prop changes
  useEffect(() => {
    if (searchFilter !== undefined) {
      setLocalSearch(searchFilter);
    }
  }, [searchFilter]);

  // Reset to first page when search/filter/page-size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCountry, sortField, sortAsc, itemsPerPage]);

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    setDeleting(true);
    try {
      await api.deleteClient(clientToDelete.id);
      setClientToDelete(null);
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to delete client', err);
      setClientToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // Extract distinct countries
  const countries = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.country) set.add(c.country);
    });
    return Array.from(set).sort();
  }, [clients]);

  // Filtered & Sorted clients
  const filteredClients = useMemo(() => {
    let result = [...clients];

    const query = debouncedSearch.toLowerCase().trim();
    if (query) {
      result = result.filter(
        (c) =>
          Boolean(
            (c.full_name && c.full_name.toLowerCase().includes(query)) ||
            (c.passport_number && c.passport_number.toLowerCase().includes(query)) ||
            (c.client_id && c.client_id.toLowerCase().includes(query)) ||
            (c.country && c.country.toLowerCase().includes(query)) ||
            (c.phone && c.phone.includes(query)) ||
            (c.email && c.email.toLowerCase().includes(query))
          )
      );
    }

    if (selectedCountry !== 'ALL') {
      result = result.filter((c) => c.country && c.country.toLowerCase() === selectedCountry.toLowerCase());
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = (a.full_name || '').localeCompare(b.full_name || '');
      else if (sortField === 'id') cmp = (a.client_id || '').localeCompare(b.client_id || '');
      else if (sortField === 'country') cmp = (a.country || '').localeCompare(b.country || '');
      else if (sortField === 'created') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [clients, debouncedSearch, selectedCountry, sortField, sortAsc]);

  // Paginated View Slice
  const totalItems = filteredClients.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const paginatedClients = useMemo(() => {
    return filteredClients.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredClients, startIndex, itemsPerPage]);

  const toggleSort = (field: 'name' | 'id' | 'country' | 'created') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-700" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clients Directory</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage China visa clients, view linked cases, passport data, and next actions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onOpenPassportScanner && (
            <button
              onClick={onOpenPassportScanner}
              className="px-3.5 py-2 bg-gradient-to-r from-slate-900 to-sky-950 hover:from-slate-800 hover:to-sky-900 text-sky-300 border border-sky-800/50 rounded-lg text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
              title="Scan client passport with Tesseract OCR & ICAO 9303 MRZ engine"
            >
              <Camera className="w-4 h-4 text-sky-400" />
              <span>Scan Passport</span>
            </button>
          )}

          <button
            onClick={onOpenNewClient}
            className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Client</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by name, passport number, Client ID..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Country:</span>
          </div>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Countries ({clients.length})</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th
                  onClick={() => toggleSort('id')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Client ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Full Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">Passport Number</th>
                <th
                  onClick={() => toggleSort('country')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Country</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">Active Visa Application</th>
                <th className="py-3 px-4 whitespace-nowrap">Current Status</th>
                <th className="py-3 px-4 whitespace-nowrap">Next Action / Task</th>
                <th className="py-3 px-4 text-right">Drive / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && clients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading clients from database...
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No clients found matching the search criteria.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const activeApp = client.active_application;
                  const statusConf = activeApp ? STATUS_CONFIG[activeApp.status] : null;
                  const nextTask = client.next_task;

                  return (
                    <tr
                      key={client.id}
                      onClick={() => onOpenClient(client.id)}
                      className="hover:bg-slate-50/90 transition cursor-pointer group"
                    >
                      {/* Client ID */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-600 whitespace-nowrap">
                        {client.client_id}
                      </td>

                      {/* Full Name & Big Photo Preview */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 group-hover:text-sky-700 transition">
                        <div className="flex items-center gap-3">
                          <ClientAvatar
                            name={client.full_name}
                            photoUrl={client.photo_url}
                            size="table"
                            allowPreview={true}
                            className="shadow-sm ring-2 ring-slate-200/80 hover:ring-sky-500 transition shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 group-hover:text-sky-800 transition truncate">
                                {client.full_name}
                              </span>
                              {client.application_count && client.application_count > 1 ? (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-normal shrink-0">
                                  {client.application_count} apps
                                </span>
                              ) : null}
                            </div>
                            {client.occupation && (
                              <div className="text-xs text-slate-500 font-normal truncate mt-0.5">
                                {client.occupation}
                              </div>
                            )}
                            {client.photo_url ? (
                              <div className="text-[10px] text-sky-700 font-semibold flex items-center gap-1 mt-0.5">
                                <span>Click photo to enlarge</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Passport */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                        {client.passport_number}
                      </td>

                      {/* Country */}
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {client.country}
                      </td>

                      {/* Active Visa Application */}
                      <td className="py-3 px-4 text-slate-800">
                        {activeApp ? (
                          <div>
                            <span className="font-medium text-slate-900 block truncate max-w-[180px]">
                              {activeApp.visa_type || 'China Visa'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {activeApp.application_id}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No active case</span>
                        )}
                      </td>

                      {/* Current Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {statusConf ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusConf.bgClass} ${statusConf.textClass} ${statusConf.borderClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotClass}`} />
                            {activeApp?.status}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Next Task */}
                      <td className="py-3 px-4">
                        {nextTask ? (
                          <div className="max-w-[200px]">
                            <span className="font-medium text-slate-800 truncate block">
                              {nextTask.title}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{nextTask.due_date}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Drive / Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {client.google_drive_url ? (
                            <a
                              href={client.google_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition"
                              title="Open Google Drive folder in new tab"
                            >
                              <FolderOpen className="w-4 h-4" />
                            </a>
                          ) : null}
                          <button
                            onClick={() => onOpenClient(client.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Open Client Profile"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setClientToDelete(client);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete Client Record"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Footer & Server-Side Pagination Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-medium">
              Showing {totalItems > 0 ? startIndex + 1 : 0}–{endIndex} of {totalItems} client records
            </span>
            <div className="flex items-center gap-1 text-slate-500">
              <label htmlFor="client-page-size" className="text-[11px]">Per page:</label>
              <select
                id="client-page-size"
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

      {/* Delete Client Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(clientToDelete)}
        title={`Delete Client ${clientToDelete?.full_name}?`}
        message={`Are you sure you want to permanently delete client profile ${clientToDelete?.full_name} (${clientToDelete?.client_id})? This will also remove all linked visa applications, internal tasks, and comments.`}
        confirmLabel="Delete Client Profile"
        loading={deleting}
        onConfirm={handleDeleteClient}
        onClose={() => setClientToDelete(null)}
      />
    </div>
  );
};
