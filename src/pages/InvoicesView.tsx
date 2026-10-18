import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Printer,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Calendar,
  Users,
  Download,
  Sparkles,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { Client, Invoice, InvoiceStatus, User } from '../types';
import { ClientAvatar } from '../components/ClientAvatar';
import { CreateInvoiceModal } from '../components/CreateInvoiceModal';
import { InvoiceDetailModal } from '../components/InvoiceDetailModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

interface InvoicesViewProps {
  currentUser: User | null;
  clients: Client[];
  onSelectClient?: (clientId: number) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  currentUser,
  clients,
  onSelectClient,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState<string>('MYR');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch invoices from backend
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const [data, settingsData] = await Promise.all([
        api.getInvoices(),
        api.getInvoiceSettings().catch(() => null),
      ]);
      setInvoices(data);
      if (settingsData?.default_currency) {
        setDefaultCurrency(settingsData.default_currency);
      }
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Handle client-side status + search filtering
  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (statusFilter !== 'all') {
      list = list.filter(inv => inv.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      inv =>
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.client_name?.toLowerCase().includes(q) ||
        inv.client_passport?.toLowerCase().includes(q) ||
        inv.client_code?.toLowerCase().includes(q) ||
        inv.notes?.toLowerCase().includes(q)
    );
  }, [invoices, statusFilter, search]);

  // Aggregate Metrics (excluding Cancelled from billed/balance totals)
  const metrics = useMemo(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    let balanceDue = 0;
    let pendingCount = 0;

    invoices.forEach(inv => {
      if (inv.status !== 'Cancelled') {
        totalBilled += Number(inv.total_amount) || 0;
        balanceDue += Number(inv.balance_due) || 0;
      }
      totalCollected += Number(inv.paid_amount) || 0;
      if (inv.status === 'Pending' || inv.status === 'Partial') pendingCount++;
    });

    return {
      count: invoices.length,
      totalBilled,
      totalCollected,
      balanceDue,
      pendingCount,
    };
  }, [invoices]);

  // Delete invoice handler
  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setDeleting(true);
    try {
      await api.deleteInvoice(invoiceToDelete.id);
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id));
      setDeleteModalOpen(false);
      setInvoiceToDelete(null);
    } catch (err) {
      console.error('Failed to delete invoice', err);
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (cur?: string | null) => (!cur || cur === 'MYR' ? 'RM' : cur);

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Paid
          </span>
        );
      case 'Partial':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
            Partial
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Customer Invoices
            </h1>
            <span className="text-xs bg-sky-100 text-sky-800 font-bold px-2.5 py-0.5 rounded-full border border-sky-200">
              {metrics.count} total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Client billing, visa fees, hotel vouchers, and printable receipts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchInvoices}
            title="Refresh Invoices"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setInvoiceToEdit(null);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Customer Invoice</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Billed
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {formatCurrency(invoices[0]?.currency || defaultCurrency)} {metrics.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500">
            Across {metrics.count} invoices
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
            Collected / Paid
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
            {formatCurrency(invoices[0]?.currency || defaultCurrency)} {metrics.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">
            {metrics.totalBilled > 0
              ? `${Math.round((metrics.totalCollected / metrics.totalBilled) * 100)}% settled`
              : '0% settled'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
            Outstanding Balance
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
            {formatCurrency(invoices[0]?.currency || defaultCurrency)} {metrics.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-amber-600">
            Awaiting full settlement
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Pending Invoices
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-800">
            {metrics.pendingCount}
          </div>
          <span className="text-[11px] text-slate-500">
            Requires client payment
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Invoices' },
            { id: 'Pending', label: 'Pending' },
            { id: 'Paid', label: 'Paid' },
            { id: 'Partial', label: 'Partial' },
            { id: 'Cancelled', label: 'Cancelled' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-sky-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoice #, client, passport..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition"
          />
        </div>
      </div>

      {/* Invoices List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-600" />
            <p className="text-xs">Loading customer invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center mx-auto border border-sky-100">
              <Receipt className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">No Invoices Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {search || statusFilter !== 'all'
                  ? 'No invoices match your current search and filter criteria.'
                  : 'Get started by creating your first official customer invoice.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInvoiceToEdit(null);
                setCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-xl transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Customer Invoice</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map(inv => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/70 transition group cursor-pointer"
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setDetailModalOpen(true);
                    }}
                  >
                    {/* Invoice Number */}
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-800">
                      {inv.invoice_number}
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <ClientAvatar
                          name={inv.client_name || 'Customer'}
                          photoUrl={inv.client_photo_url}
                          size="sm"
                        />
                        <div>
                          <span
                            className="font-bold text-slate-900 group-hover:text-sky-700 transition block"
                            onClick={e => {
                              if (onSelectClient) {
                                e.stopPropagation();
                                onSelectClient(inv.client_id);
                              }
                            }}
                          >
                            {inv.client_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {inv.client_passport} · {inv.client_country}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Issue Date */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="block text-[11px] font-medium text-slate-800">
                        {inv.issue_date}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-xs">
                      {formatCurrency(inv.currency)} {Number(inv.total_amount).toFixed(2)}
                    </td>

                    {/* Paid Amount */}
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold text-xs">
                      {formatCurrency(inv.currency)} {Number(inv.paid_amount).toFixed(2)}
                    </td>

                    {/* Balance Due */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-xs">
                      <span className={inv.balance_due > 0 ? 'text-amber-800' : 'text-slate-400'}>
                        {formatCurrency(inv.currency)} {Number(inv.balance_due).toFixed(2)}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(inv.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setDetailModalOpen(true);
                          }}
                          title="View / Print Invoice"
                          className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceToEdit(inv);
                            setCreateModalOpen(true);
                          }}
                          title="Edit Invoice"
                          className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceToDelete(inv);
                            setDeleteModalOpen(true);
                          }}
                          title="Delete Invoice"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Invoice Modal */}
      <CreateInvoiceModal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setInvoiceToEdit(null);
        }}
        onInvoiceSaved={saved => {
          fetchInvoices();
          setSelectedInvoice(saved);
          setDetailModalOpen(true);
        }}
        clients={clients}
        invoiceToEdit={invoiceToEdit}
      />

      {/* View & Print Invoice Modal */}
      <InvoiceDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        invoice={selectedInvoice}
        onEditInvoice={inv => {
          setInvoiceToEdit(inv);
          setCreateModalOpen(true);
        }}
        onDeleteInvoice={invoiceId => {
          const inv = invoices.find(i => i.id === invoiceId) || selectedInvoice;
          if (inv) {
            setInvoiceToDelete(inv);
            setDeleteModalOpen(true);
          }
        }}
        onInvoiceUpdated={updated => {
          setSelectedInvoice(updated);
          fetchInvoices();
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        title="Delete Customer Invoice"
        message={`Are you sure you want to permanently delete invoice "${invoiceToDelete?.invoice_number}" for ${invoiceToDelete?.client_name}? This will remove all associated line items.`}
        confirmLabel="Delete Invoice"
        onConfirm={handleDeleteInvoice}
        onCancel={() => {
          setDeleteModalOpen(false);
          setInvoiceToDelete(null);
        }}
        isLoading={deleting}
      />
    </div>
  );
};
