import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { ApplicationStatus, ALL_APPLICATION_STATUSES, VisaApplication } from '../types';
import { STATUS_CONFIG } from '../utils/status';

interface ApplicationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: VisaApplication | null;
  onStatusUpdated: () => void;
}

export const ApplicationStatusModal: React.FC<ApplicationStatusModalProps> = ({
  isOpen,
  onClose,
  application,
  onStatusUpdated,
}) => {
  const [currentStatus, setCurrentStatus] = useState<ApplicationStatus>('Upcoming');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReturnedWarning, setShowReturnedWarning] = useState(false);

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
    if (application && isOpen) {
      setCurrentStatus(application.status);
      setDeliveryDate(application.delivery_date ? String(application.delivery_date).slice(0, 10) : '');
      setNotes('');
      setError(null);
      setShowReturnedWarning(false);
    }
  }, [application, isOpen]);

  if (!isOpen || !application) return null;

  const isOnlineReviewCompleted = currentStatus === 'Online Review Completed';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOnlineReviewCompleted && !deliveryDate) {
      setError('Please select a Delivery Date when status is Online Review Completed');
      return;
    }

    if (currentStatus === 'Returned' && !showReturnedWarning) {
      setShowReturnedWarning(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    setSubmitting(true);
    try {
      await api.updateApplicationStatus(
        application.id,
        currentStatus,
        isOnlineReviewCompleted ? deliveryDate : (deliveryDate || null),
        notes || undefined
      );

      onStatusUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
      setShowReturnedWarning(false);
    } finally {
      setSubmitting(false);
    }
  };

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
          <div>
            <div className="text-xs text-sky-400 font-mono font-medium">{application.application_id}</div>
            <h2 className="font-bold text-base">Update Application Status</h2>
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Current Visa Status
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
              {ALL_APPLICATION_STATUSES.map((st) => {
                const config = STATUS_CONFIG[st];
                const isSelected = currentStatus === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setCurrentStatus(st)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition flex items-center justify-between ${
                      isSelected
                        ? `${config.bgClass} ${config.textClass} ${config.borderClass} font-semibold ring-2 ring-sky-500/20 shadow-xs`
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
                      <span>{st}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Returned Notice */}
          {currentStatus === 'Returned' && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Finalizing as Returned</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Marking this application as <strong>Returned</strong> indicates the passport/visa process has concluded. Once saved, this case will be finalized and archived from the active applications queue.
              </p>
            </div>
          )}

          {/* Special Delivery Date Logic Container */}
          {isOnlineReviewCompleted ? (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  Scheduled Delivery Date <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Auto-creates Task
                </span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Online review is complete. Saving a delivery date will automatically create/update task:{' '}
                <strong className="font-semibold">Delivery - {application.client_name || 'Client'}</strong> in the Calendar.
              </p>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-emerald-400 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : application.delivery_date ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Existing delivery date on file: <strong className="text-slate-800">{application.delivery_date}</strong></span>
              </div>
              <span className="text-[11px] text-slate-500">(Retained in history)</span>
            </div>
          ) : null}

          {/* Change reason / Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Remarks / Reason for Status Change
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Scanned COVA receipt, appointment rescheduled, visa stamped by embassy..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
            />
          </div>

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
              <span>Save Status Change</span>
            </button>
          </div>
        </form>

        {/* Warning Confirmation when marking as Returned */}
        {showReturnedWarning && (
          <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Are you sure?</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Once marked as <strong className="text-emerald-700 font-semibold">Returned</strong>, this application is finalized and will <strong>no longer be listed on the active applications page list</strong>.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowReturnedWarning(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={performSave}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 active:scale-95"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Yes, Confirm Returned</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
