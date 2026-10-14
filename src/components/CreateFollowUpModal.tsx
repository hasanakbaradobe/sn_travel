import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  MessageCircle,
  Clock,
  Send,
  AlertCircle,
  Check,
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
  const [cadence, setCadence] = useState<'1 Month' | '2 Months' | 'Custom'>('1 Month');
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to calculate date
  const getDatePlusDays = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find((c) => c.id === Number(selectedClientId)) || null;
  }, [selectedClientId, clients]);

  // Set default message
  const makeDefaultMessage = (clientName: string) => {
    const name = clientName ? clientName.split(' ')[0] : 'there';
    return `Hi ${name}, this is SN Travels Agency. Checking in to see if you need your China visa renewed for your upcoming trip!`;
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      const initialClient = preSelectedClientId || (clients.length > 0 ? clients[0].id : '');
      setSelectedClientId(initialClient);
      setCadence('1 Month');
      setDueDate(getDatePlusDays(30));

      const cObj = clients.find((c) => c.id === Number(initialClient));
      setMessage(makeDefaultMessage(cObj?.full_name || ''));
    }
  }, [isOpen, preSelectedClientId, clients]);

  const handleCadenceSelect = (selected: '1 Month' | '2 Months' | 'Custom') => {
    setCadence(selected);
    if (selected === '1 Month') {
      setDueDate(getDatePlusDays(30));
    } else if (selected === '2 Months') {
      setDueDate(getDatePlusDays(60));
    }
  };

  const handleClientChange = (clientId: number) => {
    setSelectedClientId(clientId);
    const cObj = clients.find((c) => c.id === clientId);
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

          {/* 1. Client Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Client <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => handleClientChange(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900 font-medium"
            >
              <option value="" disabled>Choose a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Client Quick Badge */}
          {selectedClient && (
            <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ClientAvatar name={selectedClient.full_name} photoUrl={selectedClient.photo_url} size="sm" />
                <div>
                  <span className="font-bold text-slate-800">{selectedClient.full_name}</span>
                  <span className="text-slate-500 ml-2">Phone: {selectedClient.phone || 'No phone'}</span>
                </div>
              </div>
              {selectedClient.phone && (
                <span className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Ready
                </span>
              )}
            </div>
          )}

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
