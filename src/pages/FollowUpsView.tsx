import React, { useState, useMemo, useEffect } from 'react';
import {
  MessageSquarePlus,
  Plus,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  Phone,
  MessageCircle,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Repeat,
  Send,
} from 'lucide-react';
import { FollowUp, Client, User as UserType } from '../types';
import { ClientAvatar } from '../components/ClientAvatar';
import { CreateFollowUpModal } from '../components/CreateFollowUpModal';
import { CompleteFollowUpModal } from '../components/CompleteFollowUpModal';
import { api } from '../services/api';

interface FollowUpsViewProps {
  followUps?: FollowUp[];
  clients: Client[];
  users: UserType[];
  onOpenClient: (clientId: number) => void;
  onNewApplication?: (clientInfo: { id?: number; name?: string }) => void;
  onRefreshData?: () => void;
}

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  followUps: propFollowUps,
  clients = [],
  users = [],
  onOpenClient,
  onNewApplication,
  onRefreshData,
}) => {
  const [followUps, setFollowUps] = useState<FollowUp[]>(propFollowUps || []);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUp | null>(null);
  const [itemToDelete, setItemToDelete] = useState<FollowUp | null>(null);
  const [deleting, setDeleting] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const cleanDate = (d?: string | null) => (d ? String(d).slice(0, 10) : '');

  const loadFollowUps = async () => {
    try {
      setLoading(true);
      const data = await api.getFollowUps();
      setFollowUps(data);
    } catch (err) {
      console.error('Failed to load follow-ups', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propFollowUps) {
      setFollowUps(propFollowUps);
    } else {
      loadFollowUps();
    }
  }, [propFollowUps]);

  const handleReload = () => {
    loadFollowUps();
    if (onRefreshData) onRefreshData();
  };

  // WhatsApp link helper
  const getWhatsAppLink = (phone?: string | null, messageText?: string | null) => {
    if (!phone) return null;
    let clean = phone.replace(/[^\d+]/g, '');
    if (clean.startsWith('+')) clean = clean.substring(1);
    if (!clean) return null;
    const msg = messageText ? encodeURIComponent(messageText) : '';
    return `https://wa.me/${clean}${msg ? `?text=${msg}` : ''}`;
  };

  // Quick 1-click complete if not needing modal
  const handleQuickComplete = async (f: FollowUp) => {
    setCompletingFollowUp(f);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    try {
      setDeleting(true);
      // Optimistic removal: remove immediately from current view
      setFollowUps((prev) => prev.filter((item) => Number(item.id) !== Number(targetId)));
      setItemToDelete(null);

      await api.deleteFollowUp(targetId);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Delete follow-up error:', err);
      // If error, reload from backend to sync
      loadFollowUps();
    } finally {
      setDeleting(false);
    }
  };

  // Filtered list
  const pendingList = useMemo(() => {
    return followUps.filter((f) => f.status === 'Pending');
  }, [followUps]);

  const completedList = useMemo(() => {
    return followUps.filter((f) => f.status === 'Completed');
  }, [followUps]);

  const displayedList = useMemo(() => {
    let list = activeTab === 'pending' ? pendingList : completedList;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (f) =>
          (f.client_name && f.client_name.toLowerCase().includes(q)) ||
          (f.client_phone && f.client_phone.toLowerCase().includes(q)) ||
          (f.title && f.title.toLowerCase().includes(q)) ||
          (f.message_template && f.message_template.toLowerCase().includes(q)) ||
          (f.notes && f.notes.toLowerCase().includes(q))
      );
    }

    // Sort pending: overdue & today first
    if (activeTab === 'pending') {
      return [...list].sort((a, b) => cleanDate(a.due_date).localeCompare(cleanDate(b.due_date)));
    } else {
      return [...list].sort((a, b) => cleanDate(b.updated_at).localeCompare(cleanDate(a.updated_at)));
    }
  }, [activeTab, pendingList, completedList, searchTerm]);

  // Due date tag
  const getDueTag = (dueDateStr: string, isCompleted: boolean) => {
    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Done
        </span>
      );
    }

    const due = cleanDate(dueDateStr);
    if (due === todayStr) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
          <Clock className="w-3.5 h-3.5" /> Due Today
        </span>
      );
    }

    const now = new Date(todayStr).getTime();
    const target = new Date(due).getTime();
    const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
          <AlertTriangle className="w-3.5 h-3.5" /> Overdue ({Math.abs(diffDays)}d)
        </span>
      );
    }

    if (diffDays === 1) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
          Tomorrow
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
        <Calendar className="w-3.5 h-3.5 text-slate-400" /> In {diffDays} days ({due})
      </span>
    );
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 1. Clean Simple Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Visa Follow-ups</h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-md">
              1-2 Month Clients
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Remind recurring travelers when their next China visa is due
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            title="Refresh"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Follow-up</span>
          </button>
        </div>
      </div>

      {/* 2. Simple Tabs and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Active vs Done tabs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>To Message</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'pending' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {pendingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>Completed</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'completed' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {completedList.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search client or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* 3. Follow-up Cards List */}
      {displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <MessageSquarePlus className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {activeTab === 'pending' ? 'No pending follow-ups' : 'No completed follow-ups'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'pending'
              ? 'Add a client reminder to get started. It will also show up directly on the calendar.'
              : 'Completed follow-up reminders will be saved here.'}
          </p>
          {activeTab === 'pending' && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Follow-up</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayedList.map((f) => {
            const waLink = getWhatsAppLink(f.client_phone || f.client_whatsapp, f.message_template);
            const isDone = f.status === 'Completed';

            return (
              <div
                key={f.id}
                className={`bg-white rounded-2xl border p-4 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                  isDone ? 'border-slate-200/70 bg-slate-50/50 opacity-80' : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                {/* Left: Client & Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    onClick={() => f.client_id && onOpenClient(f.client_id)}
                    className="cursor-pointer shrink-0 mt-0.5"
                    title="View client profile"
                  >
                    <ClientAvatar name={f.client_name || 'Client'} photoUrl={f.client_photo_url} size="md" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        onClick={() => f.client_id && onOpenClient(f.client_id)}
                        className="text-sm font-bold text-slate-900 hover:text-emerald-700 cursor-pointer truncate"
                      >
                        {f.client_name || 'Client'}
                      </h3>

                      {/* Cadence */}
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Repeat className="w-3 h-3 text-emerald-600" />
                        {f.cadence === 'One-time' ? 'Custom' : `Every ${f.cadence}`}
                      </span>

                      {/* Due tag */}
                      {getDueTag(f.due_date, isDone)}
                    </div>

                    {/* Phone & Message note */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {f.client_phone && (
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <Phone className="w-3 h-3 text-slate-400" /> {f.client_phone}
                        </span>
                      )}
                      {f.message_template && (
                        <p className="text-slate-600 italic line-clamp-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                          "{f.message_template}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* WhatsApp button */}
                  {waLink && !isDone && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                      title="Open WhatsApp chat with pre-written message"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  {/* Mark as Done button */}
                  {!isDone ? (
                    <button
                      onClick={() => handleQuickComplete(f)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Done</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      Completed
                    </span>
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToDelete(f);
                    }}
                    title="Delete follow-up"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateFollowUpModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        clients={clients}
        users={users}
        onSuccess={handleReload}
      />

      <CompleteFollowUpModal
        isOpen={Boolean(completingFollowUp)}
        onClose={() => setCompletingFollowUp(null)}
        followUp={completingFollowUp}
        onSuccess={handleReload}
        onStartNewApplication={onNewApplication}
      />

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden p-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Follow-up?</h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Are you sure you want to delete the reminder for{' '}
              <strong className="text-slate-800">{itemToDelete.client_name || 'this client'}</strong>?
              This will also remove the reminder task from the Calendar.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2 px-3 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
