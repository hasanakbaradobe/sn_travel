import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Receipt,
  AlertCircle,
  Loader2,
  Search,
  Check,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Client,
  Invoice,
  InvoiceCatalogItem,
  InvoiceSettings,
  InvoiceStatus,
  PaymentMethod,
} from '../types';
import { ClientAvatar } from './ClientAvatar';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceSaved: (invoice: Invoice) => void;
  clients: Client[];
  initialClientId?: number;
  invoiceToEdit?: Invoice | null;
}

interface LineItemDraft {
  catalog_item_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onInvoiceSaved,
  clients,
  initialClientId,
  invoiceToEdit,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings & Catalog Presets
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [catalogItems, setCatalogItems] = useState<InvoiceCatalogItem[]>([]);

  // Customer Search & Selection State
  const [clientId, setClientId] = useState<number | ''>('');
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form Fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('Pending');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('Bank Transfer');
  const [currency, setCurrency] = useState('MYR');
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Line items
  const [items, setItems] = useState<LineItemDraft[]>([
    {
      catalog_item_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
    },
  ]);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    if (isClientDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isClientDropdownOpen]);

  const initializedSessionRef = useRef<string | null>(null);

  // Initialize form state and load settings/catalog only when modal opens or target invoice changes
  useEffect(() => {
    if (!isOpen) {
      initializedSessionRef.current = null;
      return;
    }

    const sessionKey = invoiceToEdit ? `edit-${invoiceToEdit.id}` : `new-${initialClientId || 'none'}`;
    const isNewSession = initializedSessionRef.current !== sessionKey;
    initializedSessionRef.current = sessionKey;

    if (isNewSession) {
      setError(null);
      setClientSearch('');
      setIsClientDropdownOpen(false);

      if (invoiceToEdit) {
        setClientId(invoiceToEdit.client_id);
        setInvoiceNumber(invoiceToEdit.invoice_number);
        setIssueDate(invoiceToEdit.issue_date);
        setDueDate(invoiceToEdit.due_date || '');
        setStatus(invoiceToEdit.status);
        setPaymentMethod(invoiceToEdit.payment_method || '');
        setCurrency(invoiceToEdit.currency || 'MYR');
        setDiscount(Number(invoiceToEdit.discount) || 0);
        setPaidAmount(Number(invoiceToEdit.paid_amount) || 0);
        setNotes(invoiceToEdit.notes || '');

        if (invoiceToEdit.items && invoiceToEdit.items.length > 0) {
          setItems(
            invoiceToEdit.items.map(it => ({
              catalog_item_id: it.catalog_item_id || null,
              description: it.description,
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price) || 0,
              total:
                Number(it.total) ||
                Number(((Number(it.quantity) || 1) * (Number(it.unit_price) || 0)).toFixed(2)),
            }))
          );
        } else {
          setItems([{ catalog_item_id: null, description: '', quantity: 1, unit_price: 0, total: 0 }]);
        }
      } else {
        setClientId(initialClientId || '');
        const today = new Date().toISOString().slice(0, 10);
        setIssueDate(today);
        setDueDate('');
        setStatus('Pending');
        setPaymentMethod('Bank Transfer');
        setCurrency(settings?.default_currency || 'MYR');
        setDiscount(0);
        setPaidAmount(0);
        setNotes(settings?.payment_notes || '');
        if (settings?.invoice_prefix && settings?.next_number) {
          setInvoiceNumber(`${settings.invoice_prefix}${settings.next_number}`);
        } else {
          setInvoiceNumber('');
        }
        setItems([{ catalog_item_id: null, description: '', quantity: 1, unit_price: 0, total: 0 }]);
      }

      Promise.allSettled([
        api.getInvoiceSettings(),
        api.getInvoiceCatalog(true),
      ]).then(([settingsRes, catalogRes]) => {
        if (settingsRes.status === 'fulfilled') {
          const s = settingsRes.value;
          setSettings(s);
          if (!invoiceToEdit) {
            setCurrency(prev => prev || s.default_currency || 'MYR');
            setNotes(prev => prev || s.payment_notes || '');
            if (s.invoice_prefix && s.next_number) {
              setInvoiceNumber(prev => prev || `${s.invoice_prefix}${s.next_number}`);
            }
          }
        }
        if (catalogRes.status === 'fulfilled') {
          const sorted = [...catalogRes.value].sort(
            (a, b) => (a.display_order || 999) - (b.display_order || 999) || a.id - b.id
          );
          setCatalogItems(sorted);
        }
      });
    }
  }, [isOpen, invoiceToEdit, initialClientId]);

  // Filtered clients for searchable customer selector
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      c =>
        c.full_name.toLowerCase().includes(q) ||
        c.passport_number.toLowerCase().includes(q) ||
        c.client_id.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.whatsapp && c.whatsapp.toLowerCase().includes(q)) ||
        c.country.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  if (!isOpen) return null;

  const displayCurrency = !currency || currency === 'MYR' ? 'RM' : currency;
  const selectedClient = clients.find(c => c.id === clientId);
  const isClientLocked = Boolean(initialClientId && !invoiceToEdit);

  // Line item manipulation
  const handleItemChange = (index: number, field: keyof LineItemDraft, value: any) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'quantity') {
      item.quantity = Math.max(1, parseInt(value, 10) || 1);
      item.total = Number((item.quantity * item.unit_price).toFixed(2));
    } else if (field === 'unit_price') {
      item.unit_price = Math.max(0, parseFloat(value) || 0);
      item.total = Number((item.quantity * item.unit_price).toFixed(2));
    } else if (field === 'description') {
      item.description = value;
    }

    updated[index] = item;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        catalog_item_id: null,
        description: '',
        quantity: 1,
        unit_price: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ catalog_item_id: null, description: '', quantity: 1, unit_price: 0, total: 0 }]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleQuickAddPreset = (preset: InvoiceCatalogItem) => {
    const price = Number(preset.default_unit_price) || 0;
    const desc = preset.name + (preset.description ? ` — ${preset.description}` : '');

    if (items.length === 1 && !items[0].description.trim() && items[0].unit_price === 0) {
      setItems([
        {
          catalog_item_id: preset.id,
          description: desc,
          quantity: 1,
          unit_price: price,
          total: Number(price.toFixed(2)),
        },
      ]);
    } else {
      setItems([
        ...items,
        {
          catalog_item_id: preset.id,
          description: desc,
          quantity: 1,
          unit_price: price,
          total: Number(price.toFixed(2)),
        },
      ]);
    }
  };

  // Calculation summaries
  const subtotal = Number(items.reduce((sum, it) => sum + (Number(it.total) || 0), 0).toFixed(2));
  const effectiveDiscount = Math.min(subtotal, Math.max(0, discount || 0));
  const totalAmount = Number(Math.max(0, subtotal - effectiveDiscount).toFixed(2));

  const effectivePaid =
    status === 'Paid'
      ? totalAmount
      : status === 'Pending' || status === 'Cancelled'
      ? 0
      : Math.min(totalAmount, Math.max(0, paidAmount || 0));
  const balanceDue =
    status === 'Cancelled' ? 0 : Math.max(0, Number((totalAmount - effectivePaid).toFixed(2)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError('Please select a customer.');
      setIsClientDropdownOpen(true);
      return;
    }

    const validItems = items.filter(it => it.description.trim() !== '');
    if (validItems.length === 0) {
      setError('Please add at least one service item.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        client_id: Number(clientId),
        invoice_number: invoiceNumber.trim() || undefined,
        issue_date: issueDate,
        due_date: dueDate || null,
        status,
        payment_method: paymentMethod || null,
        currency,
        subtotal,
        discount: effectiveDiscount,
        tax_rate: 0,
        paid_amount: effectivePaid,
        notes: notes.trim() || null,
        items: validItems.map(it => ({
          catalog_item_id: it.catalog_item_id || null,
          description: it.description.trim(),
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
      };

      const savedInvoice = invoiceToEdit
        ? await api.updateInvoice(invoiceToEdit.id, payload)
        : await api.createInvoice(payload);

      onInvoiceSaved(savedInvoice);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-400/20">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">
                {invoiceToEdit ? `Edit Invoice #${invoiceToEdit.invoice_number}` : 'New Customer Invoice'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {invoiceNumber ? `Invoice #${invoiceNumber}` : settings?.company_name || 'SN Travels Agency'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Searchable Customer Selector */}
          <div className="space-y-1.5" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-700">
              Customer <span className="text-rose-500">*</span>
            </label>

            {selectedClient && !isClientDropdownOpen ? (
              <div className="flex items-center justify-between gap-3 bg-sky-50/70 border border-sky-200 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ClientAvatar
                    name={selectedClient.full_name}
                    photoUrl={selectedClient.photo_url}
                    size="sm"
                    allowPreview={false}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {selectedClient.full_name}
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-sky-800 bg-white px-1.5 py-0.5 rounded border border-sky-200">
                        {selectedClient.client_id}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">
                      Passport: <span className="font-mono font-semibold">{selectedClient.passport_number}</span> · {selectedClient.country}
                      {selectedClient.phone || selectedClient.whatsapp ? ` · ${selectedClient.phone || selectedClient.whatsapp}` : ''}
                    </div>
                  </div>
                </div>

                {!isClientLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsClientDropdownOpen(true);
                      setClientSearch('');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-sky-700 hover:text-sky-900 bg-white hover:bg-sky-100 border border-sky-200 rounded-lg transition shrink-0 cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={clientSearch}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setIsClientDropdownOpen(true);
                    }}
                    placeholder="Search customer by name, passport number, ID, or phone..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl pl-9 pr-9 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsClientDropdownOpen(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {isClientDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredClients.length === 0 ? (
                      <div className="p-3.5 text-center text-xs text-slate-400">
                        No customers match &quot;{clientSearch}&quot;
                      </div>
                    ) : (
                      filteredClients.map(c => {
                        const isSelected = c.id === clientId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setClientId(c.id);
                              setIsClientDropdownOpen(false);
                              setClientSearch('');
                            }}
                            className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-sky-50/80 transition cursor-pointer ${
                              isSelected ? 'bg-sky-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ClientAvatar
                                name={c.full_name}
                                photoUrl={c.photo_url}
                                size="xs"
                                allowPreview={false}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 truncate">
                                    {c.full_name}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {c.client_id}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  Passport: <span className="font-mono text-slate-700 font-medium">{c.passport_number}</span> · {c.country}
                                  {c.phone || c.whatsapp ? ` · ${c.phone || c.whatsapp}` : ''}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Compact Settings Row: Status, Payment Method, Currency & Date */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Payment Status
              </label>
              <select
                value={status}
                onChange={e => {
                  const st = e.target.value as InvoiceStatus;
                  setStatus(st);
                  if (st === 'Paid') setPaidAmount(totalAmount);
                  else if (st === 'Pending' || st === 'Cancelled') setPaidAmount(0);
                  else if (st === 'Partial' && paidAmount >= totalAmount) setPaidAmount(0);
                }}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500"
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid in Full</option>
                <option value="Partial">Partial Payment</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:ring-2 focus:ring-sky-500"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="WeChat Pay">WeChat Pay</option>
                <option value="Alipay">Alipay</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500"
              >
                <option value="MYR">RM (Malaysian Ringgit)</option>
                <option value="USD">USD ($)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="CNY">CNY (¥)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="BDT">BDT (৳)</option>
                <option value="PKR">PKR (₨)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                required
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* 3. Simplified Services / Line Items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Services &amp; Charges <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            {/* Quick-Add Service Chips */}
            {catalogItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center mr-1">
                  Quick Add:
                </span>
                {catalogItems.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleQuickAddPreset(preset)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-sky-600 text-slate-700 hover:text-white border border-slate-200 hover:border-sky-600 rounded-lg text-[11px] font-medium transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{preset.name}</span>
                    <span className="font-mono text-[10px] opacity-75">
                      ({displayCurrency} {Number(preset.default_unit_price).toFixed(0)})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Clean Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <div className="col-span-6">Service Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center px-3 py-2 bg-white">
                  <div className="col-span-12 sm:col-span-6">
                    <input
                      type="text"
                      placeholder="Enter service description..."
                      value={item.description}
                      onChange={e => handleItemChange(idx, 'description', e.target.value)}
                      required
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                      required
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-center text-slate-800 focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={e => handleItemChange(idx, 'unit_price', e.target.value)}
                      required
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-right font-mono text-slate-800 focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2 flex items-center justify-end gap-1.5">
                    <span className="font-mono font-bold text-xs text-slate-800">
                      {item.total.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      title="Remove item"
                      className="text-slate-300 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Compact Notes & Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
            <div className="sm:col-span-7 space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600">
                Notes / Payment Instructions (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional note or payment instruction..."
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="sm:col-span-5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">
                  {displayCurrency} {subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Discount:</span>
                <div className="flex items-center gap-1 w-28">
                  <span className="text-[10px] text-slate-400">-{displayCurrency}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-md px-2 py-1 text-right font-mono"
                  />
                </div>
              </div>

              <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-black text-slate-900">
                <span>Total:</span>
                <span className="font-mono text-sky-800">
                  {displayCurrency} {totalAmount.toFixed(2)}
                </span>
              </div>

              {status === 'Partial' && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-emerald-700 font-semibold">Amount Paid:</span>
                  <div className="flex items-center gap-1 w-28">
                    <span className="text-[10px] text-slate-400">{displayCurrency}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paidAmount}
                      onChange={e => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full text-xs bg-white border border-emerald-300 rounded-md px-2 py-1 text-right font-mono font-bold text-emerald-800"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                <span className={balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                  Balance Due:
                </span>
                <span className={`font-mono ${balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {displayCurrency} {balanceDue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-xl shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{invoiceToEdit ? 'Save Changes' : 'Create Invoice'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
