import React, { useState, useEffect } from 'react';
import { X, Calendar, FileCheck, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { VisaType, Client, ApplicationStatus, ALL_APPLICATION_STATUSES } from '../types';
import { ClientSelectSearch } from './ClientSelectSearch';

interface NewApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: number;
  clientName?: string;
  clients?: Client[];
  onApplicationCreated: () => void;
}

export const NewApplicationModal: React.FC<NewApplicationModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientName,
  clients = [],
  onApplicationCreated,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<number | ''>(clientId || '');
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [selectedVisaTypeId, setSelectedVisaTypeId] = useState<number | ''>('');
  const [status, setStatus] = useState<ApplicationStatus>('Upcoming');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedUserId, setAssignedUserId] = useState<number | ''>(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setSelectedClientId(clientId || '');
      setStatus('Upcoming');
      setDeliveryDate('');
      setNotes('');
      setError(null);
      api.getVisaTypes(true).then((vts) => {
        setVisaTypes(vts);
        if (vts.length > 0) {
          setSelectedVisaTypeId(vts[0].id);
        } else {
          setSelectedVisaTypeId('');
        }
      }).catch((err) => console.error('Failed to load visa types:', err));
    }
  }, [isOpen, clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError('Please select a client');
      return;
    }
    if (!selectedVisaTypeId) {
      setError('Please select a visa type');
      return;
    }
    const requiresDeliveryDate = status === 'Online Review Completed' || status === 'Pending Collection';
    if (requiresDeliveryDate && !deliveryDate) {
      setError(`Please specify a collection / delivery date for ${status} status`);
      return;
    }

    setSubmitting(true);
    try {
      await api.createApplication({
        client_id: Number(selectedClientId),
        visa_type_id: Number(selectedVisaTypeId),
        status,
        delivery_date: deliveryDate ? deliveryDate : undefined,
        notes: notes || undefined,
        assigned_user_id: assignedUserId ? Number(assignedUserId) : undefined,
      });

      onApplicationCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create application');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" />
      <div
        className="relative bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-sky-400" />
            <h2 className="font-bold text-base">New China Visa Application</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Client Selector (if not preselected) */}
          <div>
            {clientId && clientName ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Client <span className="text-red-500">*</span>
                </label>
                <div className="px-3.5 py-2.5 bg-slate-100 rounded-xl text-sm font-semibold text-slate-800 border border-slate-200">
                  {clientName}
                </div>
              </div>
            ) : (
              <ClientSelectSearch
                clients={clients}
                selectedClientId={selectedClientId}
                onSelectClient={(id) => setSelectedClientId(id)}
                required={true}
                label="Client"
                placeholder="Search by passport number, name, or Client ID..."
              />
            )}
          </div>

          {/* Visa Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              China Visa Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={selectedVisaTypeId}
              onChange={(e) => setSelectedVisaTypeId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
            >
              {visaTypes.length === 0 && <option value="">Loading Visa Types...</option>}
              {visaTypes.map((vt) => (
                <option key={vt.id} value={vt.id}>
                  {vt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Initial Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
            >
              {ALL_APPLICATION_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional Delivery / Collection Date */}
          {(status === 'Online Review Completed' || status === 'Pending Collection') && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in">
              <label className="block text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                {status === 'Pending Collection' ? 'Collection Date / Scheduled Delivery' : 'Scheduled Delivery Date'}
              </label>
              <p className="text-[11px] text-emerald-800">
                Saving this date will automatically create a linked delivery task in the internal calendar!
              </p>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm text-slate-900"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Application Remarks / Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Case details, specific consular requests, travel dates..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Create Application</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
