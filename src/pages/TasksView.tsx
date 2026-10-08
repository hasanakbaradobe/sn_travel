import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Filter,
  Square,
  Trash2,
  User,
  Clock,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { Task, TaskPriority } from '../types';
import { getPriorityBadge } from '../utils/status';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

interface TasksViewProps {
  tasks: Task[];
  loading: boolean;
  onOpenNewTask: () => void;
  onToggleTask: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onOpenClient: (clientId: number) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  loading,
  onOpenNewTask,
  onToggleTask,
  onDeleteTask,
  onOpenClient,
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Pending' | 'Completed'>('Pending');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (filterStatus !== 'ALL') {
      list = list.filter((t) => t.status === filterStatus);
    }

    if (filterPriority !== 'ALL') {
      list = list.filter((t) => t.priority === filterPriority);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.client_name && t.client_name.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [tasks, filterStatus, filterPriority, search]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-sky-700" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Internal Tasks</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage daily client tasks, document follow-ups, and scheduled visa deliveries.
          </p>
        </div>

        <button
          onClick={onOpenNewTask}
          className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, client names..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-semibold">
            <button
              onClick={() => setFilterStatus('Pending')}
              className={`px-3 py-1 rounded-md transition ${
                filterStatus === 'Pending' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
            >
              Pending ({tasks.filter((t) => t.status === 'Pending').length})
            </button>
            <button
              onClick={() => setFilterStatus('Completed')}
              className={`px-3 py-1 rounded-md transition ${
                filterStatus === 'Completed' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
            >
              Completed ({tasks.filter((t) => t.status === 'Completed').length})
            </button>
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1 rounded-md transition ${
                filterStatus === 'ALL' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
            >
              All ({tasks.length})
            </button>
          </div>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Task List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {loading && tasks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No tasks found.</div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'Completed';
            const isDelivery = task.is_delivery_task === 1;
            const priorityBadge = getPriorityBadge(task.priority);
            const cleanDueDate = task.due_date ? String(task.due_date).slice(0, 10) : '';
            const isOverdue = !isCompleted && cleanDueDate < today;

            return (
              <div
                key={task.id}
                className="p-4 hover:bg-slate-50/80 transition flex items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                  <button
                    onClick={() => onToggleTask(task.id)}
                    className={`mt-0.5 sm:mt-0 w-5 h-5 rounded border flex items-center justify-center transition shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 hover:border-sky-600'
                    }`}
                  >
                    {isCompleted && <CheckSquare className="w-3.5 h-3.5" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-semibold text-sm ${
                          isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </span>
                      {isDelivery && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Delivery Task
                        </span>
                      )}
                      {isOverdue && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>
                    )}

                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Due: <strong>{cleanDueDate}</strong>
                      </span>
                      {task.client_name && (
                        <>
                          <span>•</span>
                          <button
                            onClick={() => task.client_id && onOpenClient(task.client_id)}
                            className="text-sky-700 hover:underline font-medium"
                          >
                            Client: {task.client_name} ({task.client_code})
                          </button>
                        </>
                      )}
                      <span>•</span>
                      <span>Officer: {task.assigned_user_name || 'Staff'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${priorityBadge.bg}`}>
                    {task.priority}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setTaskToDelete(task);
                    }}
                    className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg transition"
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(taskToDelete)}
        title={`Delete task "${taskToDelete?.title}"?`}
        message={`Are you sure you want to permanently remove this internal task?`}
        confirmLabel="Delete Task"
        onConfirm={async () => {
          if (taskToDelete) {
            try {
              await onDeleteTask(taskToDelete.id);
            } catch (err) {
              console.error('Failed to delete task', err);
            } finally {
              setTaskToDelete(null);
            }
          }
        }}
        onClose={() => setTaskToDelete(null)}
      />
    </div>
  );
};
