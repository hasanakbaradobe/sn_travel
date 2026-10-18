import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Calendar,
  MessageCircle,
  Clock,
  Send,
  AlertCircle,
  Check,
  Search,
  Phone,
} from 'lucide-react';
import { Client, User as UserType } from '../types';
import { ClientAvatar } from './ClientAvatar';
import { api } from '../services/api';

interface CreateFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  users: UserType[];
  preSelectedClientId?: number | null;
  onSuccess: () => void;
}

export const CreateFollowUpModal: React.FC<CreateFollowUpModalProps> = ({
  isOpen,
  onClose,
  clients = [],
  users = [],
  preSelectedClientId = null,
  onSuccess,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<number | ''>(preSelectedClientId || '');
  const [selectedClientSnapshot, setSelectedClientSnapshot] = useState<Client | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const [cadence, setCadence] = useState<'1 Month' | '2 Months' | 'Custom'>('1 Month');
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close search panel on outside click when a client is already selected
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        if (selectedClientId) {
          setIsSearchOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [selectedClientId]);

  // Helper to calculate date
  const getDatePlusDays = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    const found = clients.find((c) => Number(c.id) === Number(selectedClientId));
    if (found) return found;
    if (selectedClientSnapshot && Number(selectedClientSnapshot.id) === Number(selectedClientId)) {
      return selectedClientSnapshot;
    }
    return null;
  }, [selectedClientId, clients, selectedClientSnapshot]);

  // Keep snapshot updated when client list has fresher details for the selected client
  useEffect(() => {
    if (!selectedClientId) return;
    const found = clients.find((c) => Number(c.id) === Number(selectedClientId));
    if (found) {
      setSelectedClientSnapshot(found);
    }
  }, [selectedClientId, clients]);

  // Filter clients by search query (name, passport, phone, client_id, country)
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) {
      return clients;
    }
    const q = clientSearchQuery.toLowerCase().trim();
    return clients.filter((c) => {
      const name = (c.full_name || '').toLowerCase();
      const passport = (c.passport_number || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const cid = (c.client_id || '').toLowerCase();
      const country = (c.country || '').toLowerCase();
      return (
        name.includes(q) ||
        passport.includes(q) ||
        phone.includes(q) ||
        cid.includes(q) ||
        country.includes(q)
      );
    });
  }, [clients, clientSearchQuery]);

  // Set default message
  const makeDefaultMessage = (clientName: string) => {
    const name = clientName ? clientName.split(' ')[0] : 'there';
    return `Hi ${name}, this is SN Travels Agency. Checking in to see if you need your China visa renewed for your upcoming trip!`;
  };

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) {
      return;
    }
    wasOpenRef.current = true;

    setError(null);
    setClientSearchQuery('');
    setCadence('1 Month');
    setDueDate(getDatePlusDays(30));

    if (preSelectedClientId) {
      setSelectedClientId(preSelectedClientId);
      setIsSearchOpen(false);
      const cObj = clients.find((c) => Number(c.id) === Number(preSelectedClientId)) || null;
      setSelectedClientSnapshot(cObj);
      setMessage(makeDefaultMessage(cObj?.full_name || ''));
    } else {
      setSelectedClientId('');
      setSelectedClientSnapshot(null);
      setIsSearchOpen(true);
      setMessage(makeDefaultMessage(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preSelectedClientId]);

  const handleCadenceSelect = (selected: '1 Month' | '2 Months' | 'Custom') => {
    setCadence(selected);
    if (selected === '1 Month') {
      setDueDate(getDatePlusDays(30));
    } else if (selected === '2 Months') {
      setDueDate(getDatePlusDays(60));
    }
  };

  const handleClientChange = (clientId: number) => {
    const cObj = clients.find((c) => Number(c.id) === Number(clientId)) || null;
    setSelectedClientId(clientId);
    setSelectedClientSnapshot(cObj);
    setIsSearchOpen(false);
    setClientSearchQuery('');
    if (cObj) {
      setMessage(makeDefaultMessage(cObj.full_name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError('Please select a client');
      return;
    }
    if (!dueDate) {
      setError('Please choose a follow-up date');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const clientName = selectedClient?.full_name || 'Client';
      const cadenceLabel = cadence === 'Custom' ? 'One-time' : cadence;
      const title = `${cadenceLabel} Visa Follow-up`;
      const staffUser = users[0];

      await api.createFollowUp({
        client_id: Number(selectedClientId),
        title,
        reason: `${cadenceLabel} Visa Renewal Check`,
        channel: 'WhatsApp',
        cadence: cadenceLabel as any,
        due_date: dueDate,
        priority: 'Normal',
        assigned_user_id: staffUser?.id || undefined,
        message_template: message.trim(),
        notes: `Follow-up scheduled to message ${clientName} for visa renewal.`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save follow-up');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Simple Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                New Visa Follow-up
              </h2>
              <p className="text-xs text-slate-500">
                Set a reminder to message your client for visa renewal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Simple Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Searchable Client Select */}
          <div className="space-y-1.5" ref={searchContainerRef}>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Select Client <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Search by name, phone, or passport</span>
            </div>

            {selectedClient && !isSearchOpen ? (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <ClientAvatar
                    name={selectedClient.full_name}
                    photoUrl={selectedClient.photo_url}
                    size="md"
                    className="w-9 h-9 rounded-xl text-sm shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {selectedClient.full_name}
                      </span>
                      <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800 font-semibold">
                        {selectedClient.client_id}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5 flex-wrap">
                      <span>
                        Passport: <strong className="font-mono text-slate-800">{selectedClient.passport_number}</strong>
                      </span>
                      {selectedClient.phone ? (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            {selectedClient.phone}
                          </span>
                          <span className="text-[10px] bg-emerald-100/80 text-emerald-800 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5 text-emerald-600" /> WhatsApp Ready
                          </span>
                        </>
                      ) : (
                        <>
                          <span>•</span>
                          <span className="text-slate-400">No phone</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(true);
                    setClientSearchQuery('');
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="ml-2 shrink-0 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-100/70 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Search className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Change</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Search input field */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    placeholder="Type name, phone, passport number, or CL-ID..."
                    className="w-full pl-9 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs font-medium"
                  />
                  {clientSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setClientSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : selectedClient ? (
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(false)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-200/60"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>

                {/* Results summary & list */}
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      {clientSearchQuery.trim()
                        ? `Found ${filteredClients.length} match${filteredClients.length === 1 ? '' : 'es'}`
                        : `All clients (${clients.length})`}
                    </span>
                    <span className="text-slate-400">Click to select</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredClients.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No clients found matching "{clientSearchQuery}". Try another name, passport, or phone.
                      </div>
                    ) : (
                      filteredClients.map((c) => {
                        const isSelected = c.id === selectedClientId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleClientChange(c.id)}
                            className={`w-full text-left p-2.5 transition flex items-center justify-between group ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-950 font-semibold'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ClientAvatar
                                name={c.full_name}
                                photoUrl={c.photo_url}
                                size="xs"
                                className="w-7 h-7 rounded-lg text-xs shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs text-slate-900 truncate">
                                    {c.full_name}
                                  </span>
                                  <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200">
                                    {c.client_id}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span>
                                    Passport:{' '}
                                    <strong className="font-mono text-slate-700 bg-amber-50 text-amber-900 px-1 py-0.2 rounded border border-amber-200/60">
                                      {c.passport_number}
                                    </strong>
                                  </span>
                                  {c.phone && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-700 font-medium flex items-center gap-0.5">
                                        <Phone className="w-2.5 h-2.5" />
                                        {c.phone}
                                      </span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span>{c.country}</span>
                                </div>
                              </div>
                            </div>
                            {isSelected ? (
                              <Check className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                            ) : (
                              <span className="text-[11px] text-emerald-600 opacity-0 group-hover:opacity-100 font-medium shrink-0 ml-2">
                                Select
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. When to Follow-up */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              When to Follow-up?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleCadenceSelect('1 Month')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                  cadence === '1 Month'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                In 1 Month
              </button>
              <button
                type="button"
                onClick={() => handleCadenceSelect('2 Months')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                  cadence === '2 Months'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                In 2 Months
              </button>
              <button
                type="button"
                onClick={() => handleCadenceSelect('Custom')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                  cadence === 'Custom'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                Custom Date
              </button>
            </div>

            {/* Date input */}
            <div className="mt-2 relative">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setCadence('Custom');
                }}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              This reminder will automatically appear on the <strong>Calendar</strong> on this date.
            </p>
          </div>

          {/* 3. Message / Reminder Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              WhatsApp Message / Reminder Note
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the message you want to send the client..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Save Follow-up'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
