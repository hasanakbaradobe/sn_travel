import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Calendar,
  Repeat,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { FollowUp, FollowUpCadence } from '../types';
import { ClientAvatar } from './ClientAvatar';
import { api } from '../services/api';

interface CompleteFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  followUp: FollowUp | null;
  onSuccess: () => void;
  onStartNewApplication?: (clientInfo: { id?: number; name?: string }) => void;
}

export const CompleteFollowUpModal: React.FC<CompleteFollowUpModalProps> = ({
  isOpen,
  onClose,
  followUp,
  onSuccess,
  onStartNewApplication,
}) => {
  const [repeatChoice, setRepeatChoice] = useState<'none' | '1 Month' | '2 Months' | 'custom'>('1 Month');
  const [customDate, setCustomDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      setRepeatChoice('1 Month');
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setCustomDate(d.toISOString().split('T')[0]);
    }
  }, [isOpen, followUp]);

  if (!isOpen || !followUp) return null;

  const handleComplete = async (startApplication: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const scheduleNext = repeatChoice !== 'none';
      let nextDueDate: string | undefined = undefined;

      if (scheduleNext) {
        if (repeatChoice === 'custom') {
          if (!customDate) {
            setError('Please pick a custom date for the next reminder');
            setLoading(false);
            return;
          }
          nextDueDate = customDate;
        } else {
          const d = new Date();
          d.setDate(d.getDate() + (repeatChoice === '1 Month' ? 30 : 60));
          nextDueDate = d.toISOString().split('T')[0];
        }
      }

      await api.completeFollowUp(followUp.id, {
        completed_notes: `Messaged client on WhatsApp.`,
        schedule_next: scheduleNext,
        next_cadence: repeatChoice === 'custom' ? 'One-time' : (repeatChoice as FollowUpCadence),
        next_due_date: nextDueDate,
      });

      onSuccess();
      onClose();

      if (startApplication && onStartNewApplication && followUp.client_id) {
        onStartNewApplication({
          id: followUp.client_id,
          name: followUp.client_name,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete follow-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Mark as Done</h2>
              <p className="text-xs text-slate-500">Log this follow-up as completed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Client Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <ClientAvatar name={followUp.client_name || 'Client'} photoUrl={followUp.client_photo_url} size="md" />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 truncate">{followUp.client_name}</h4>
              <p className="text-xs text-slate-500 truncate">{followUp.client_phone || 'WhatsApp contact'}</p>
            </div>
          </div>

          {/* Repeat options */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Schedule Next Reminder for this Client?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setRepeatChoice('1 Month')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                  repeatChoice === '1 Month'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                In 1 Month
              </button>
              <button
                type="button"
                onClick={() => setRepeatChoice('2 Months')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                  repeatChoice === '2 Months'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                In 2 Months
              </button>
              <button
                type="button"
                onClick={() => setRepeatChoice('custom')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                  repeatChoice === 'custom'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Custom Date
              </button>
              <button
                type="button"
                onClick={() => setRepeatChoice('none')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                  repeatChoice === 'none'
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                No Repeat
              </button>
            </div>

            {/* Custom Date Input */}
            {repeatChoice === 'custom' && (
              <div className="mt-2.5 relative animate-in fade-in duration-150">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Pick Next Reminder Date:
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 font-medium"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          {onStartNewApplication && (
            <button
              type="button"
              onClick={() => handleComplete(true)}
              disabled={loading}
              className="px-3 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Done &amp; New Visa</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleComplete(false)}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Mark Done'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
