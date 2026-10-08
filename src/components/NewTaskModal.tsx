import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { TaskPriority, Client, VisaApplication } from '../types';
import { ClientSelectSearch } from './ClientSelectSearch';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: number;
  applicationId?: number;
  initialDueDate?: string;
  clients?: Client[];
  applications?: VisaApplication[];
  onTaskCreated: () => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  clientId,
  applicationId,
  initialDueDate,
  clients = [],
  applications = [],
  onTaskCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | ''>(clientId || '');
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | ''>(applicationId || '');
  const [dueDate, setDueDate] = useState(initialDueDate || new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<TaskPriority>('Normal');
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
      setSelectedApplicationId(applicationId || '');
      if (initialDueDate) setDueDate(initialDueDate);
      else setDueDate(new Date().toISOString().split('T')[0]);
      setTitle('');
      setDescription('');
      setPriority('Normal');
      setError(null);
    }
  }, [isOpen, clientId, applicationId, initialDueDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setError('Task Title and Due Date are required');
      return;
    }

    setSubmitting(true);
    try {
      await api.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        client_id: selectedClientId ? Number(selectedClientId) : null,
        application_id: selectedApplicationId ? Number(selectedApplicationId) : null,
        due_date: dueDate,
        priority,
      });

      onTaskCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
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
            <CheckSquare className="w-5 h-5 text-sky-400" />
            <h2 className="font-bold text-base">Create Internal Task</h2>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Verify biometric appointment, Call client for photos..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Optional Linked Client */}
          <div>
            {clientId ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Linked Client
                </label>
                <div className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-800 border border-slate-200">
                  {clients.find((c) => c.id === clientId)?.full_name || `Client #${clientId}`}
                </div>
              </div>
            ) : (
              <ClientSelectSearch
                clients={clients}
                selectedClientId={selectedClientId}
                onSelectClient={(id) => setSelectedClientId(id)}
                required={false}
                label="Link to Client (Optional)"
                placeholder="Search by passport number, name, or Client ID..."
                allowClear={true}
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description / Action Steps</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions for staff, phone numbers to call, documents to verify..."
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
              <span>Create Task</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
