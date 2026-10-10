import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Info,
} from 'lucide-react';
import { VisaApplication, ApplicationStatus, ALL_APPLICATION_STATUSES } from '../types';
import { STATUS_CONFIG } from '../utils/status';
import { api } from '../services/api';

interface BatchApplicationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedApplications: VisaApplication[];
  onSuccess: () => void;
}

export const BatchApplicationStatusModal: React.FC<BatchApplicationStatusModalProps> = ({
  isOpen,
  onClose,
  selectedApplications,
  onSuccess,
}) => {
  const [targetStatus, setTargetStatus] = useState<ApplicationStatus>('Pending Collection');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetStatus('Pending Collection');
      setDeliveryDate('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const requiresDate =
    targetStatus === 'Online Review Completed' ||
    targetStatus === 'Pending Collection' ||
    targetStatus === 'Returned';

  const isReturnStatus = targetStatus === 'Returned';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedApplications.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const appIds = selectedApplications.map((a) => a.id);
      await api.batchUpdateApplicationStatus(
        appIds,
        targetStatus,
        requiresDate ? deliveryDate || null : null,
        notes.trim() || undefined
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Batch status update error:', err);
      setError(err.message || 'Failed to update selected applications.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600/30 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-white">Batch Status Update</h3>
                <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-bold px-2 py-0.5 rounded-full">
                  {selectedApplications.length} Selected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Apply a simultaneous status transition to all selected visa applications.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selected Applications Summary Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
            <div className="text-slate-500 font-semibold mb-1.5 flex items-center justify-between">
              <span>Target Applications ({selectedApplications.length})</span>
              <span className="text-[11px] text-slate-400">All will change to: <strong className="text-slate-800">{targetStatus}</strong></span>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
              {selectedApplications.map((app) => (
                <div key={app.id} className="flex items-center justify-between py-1 px-2 bg-white rounded border border-slate-200/80">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono font-bold text-slate-700">{app.application_id}</span>
                    <span className="text-slate-900 font-semibold truncate">{app.client_name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">{app.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Select Target Status */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Select New Status
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_APPLICATION_STATUSES.map((st) => {
                const conf = STATUS_CONFIG[st];
                const isSelected = targetStatus === st;

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTargetStatus(st)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50/80 ring-2 ring-sky-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${conf.dotClass}`} />
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-sky-950' : 'text-slate-800'}`}>
                        {st}
                      </span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Collection/Delivery Date */}
          {requiresDate && (
            <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Schedule Collection / Delivery Date</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Set an optional target collection or passports delivery date for these applications.
              </p>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              />
            </div>
          )}

          {/* Return Warning if Returned is selected */}
          {isReturnStatus && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950">
              <FileCheck2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Return & Completion Notice</span>
                <span>
                  Marking these applications as <strong>Returned</strong> will automatically complete all associated collection and passport tasks on the calendar.
                </span>
              </div>
            </div>
          )}

          {/* Notes / Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Audit Note / Reason <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Batch collected from China Visa Center on batch #402..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedApplications.length === 0}
              className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-700/20 flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Updating {selectedApplications.length} Applications...</span>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Update {selectedApplications.length} Applications to '{targetStatus}'</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
