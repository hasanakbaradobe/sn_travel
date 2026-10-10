import React from 'react';
import { AlertTriangle, X, CheckCircle2, ShieldAlert, RotateCcw } from 'lucide-react';

export interface ReturnStatusWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode?: 'mark_returned' | 'revert_status';
  clientName?: string;
  applicationCode?: string;
  taskTitle?: string;
  dueDate?: string;
  previousStatus?: string;
  loading?: boolean;
}

export const ReturnStatusWarningModal: React.FC<ReturnStatusWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  mode = 'mark_returned',
  clientName,
  applicationCode,
  taskTitle,
  dueDate,
  previousStatus = 'Pending Collection',
  loading = false,
}) => {
  if (!isOpen) return null;

  const isRevert = mode === 'revert_status';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`bg-white rounded-2xl shadow-2xl border max-w-md w-full overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 ${
          isRevert ? 'border-sky-300' : 'border-amber-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className={`p-5 text-white flex items-start justify-between gap-3 ${
            isRevert 
              ? 'bg-gradient-to-r from-slate-800 via-sky-800 to-indigo-900' 
              : 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30">
              {isRevert ? (
                <RotateCcw className="w-6 h-6 text-white animate-spin-once" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-white animate-bounce" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold leading-tight">
                {isRevert ? 'Revert Application Status' : 'Return Status Warning'}
              </h3>
              <p className="text-xs text-slate-200 mt-0.5 font-medium">
                {isRevert ? 'Changing Status to Previous State' : 'Automatic Application Status Update'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div 
            className={`rounded-xl p-4 text-xs sm:text-sm leading-relaxed flex items-start gap-3 border ${
              isRevert 
                ? 'bg-sky-50 border-sky-200 text-sky-950' 
                : 'bg-amber-50 border-amber-200/80 text-slate-800'
            }`}
          >
            <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${isRevert ? 'text-sky-600' : 'text-amber-600'}`} />
            <div>
              <p className={`font-semibold mb-1 ${isRevert ? 'text-sky-950' : 'text-amber-900'}`}>
                {isRevert ? (
                  <>
                    Marking this task as uncompleted will revert the application status to{' '}
                    <span className="underline decoration-sky-500 font-black">{previousStatus}</span>.
                  </>
                ) : (
                  <>
                    Completing this collection task will mark the application as{' '}
                    <span className="underline decoration-amber-500 font-black">Returned</span>.
                  </>
                )}
              </p>
              <p className={`text-xs ${isRevert ? 'text-sky-800' : 'text-amber-800'}`}>
                {isRevert ? (
                  <>
                    You are unmarking a completed collection/delivery task. Doing so automatically restores the visa application status back to its previous state (<span className="font-bold">{previousStatus}</span>).
                  </>
                ) : (
                  <>
                    You are about to mark the collection task as completed. Doing so automatically updates the visa application status to <span className="font-bold">Returned</span>.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Details Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            {clientName && (
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Client Name:</span>
                <span className="font-bold text-slate-900">{clientName}</span>
              </div>
            )}
            {applicationCode && (
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Application ID:</span>
                <span className="font-mono font-bold text-sky-700">{applicationCode}</span>
              </div>
            )}
            {taskTitle && (
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Task / Event:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[200px]">{taskTitle}</span>
              </div>
            )}
            {dueDate && (
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Collection Date:</span>
                <span className="font-semibold text-slate-700">{dueDate}</span>
              </div>
            )}
            {isRevert && (
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Current Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Returned
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500 font-medium">New Reverted Status:</span>
              {isRevert ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-300">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                  {previousStatus}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Returned
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              isRevert
                ? 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800'
                : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
            }`}
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : isRevert ? (
              <RotateCcw className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {isRevert ? 'Confirm & Revert Status' : 'Confirm & Mark as Returned'}
          </button>
        </div>
      </div>
    </div>
  );
};
