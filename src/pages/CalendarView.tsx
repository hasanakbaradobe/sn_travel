import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  User,
  CheckSquare,
  Square,
  Filter,
  Search,
  Package,
  AlertTriangle,
  X,
  ArrowRight,
  CalendarDays,
  ListOrdered,
  Layers,
  Building2,
  MessageSquarePlus,
  MessageCircle,
  RotateCcw,
  Loader2,
  GripVertical,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { Task, VisaApplication, Client, User as UserType, HotelBooking } from '../types';
import { getPriorityBadge, STATUS_CONFIG } from '../utils/status';
import { ClientAvatar } from '../components/ClientAvatar';
import { HotelBookingDetailModal } from '../components/HotelBookingDetailModal';
import { api } from '../services/api';

export interface CalendarEvent {
  id: string; // unique ID e.g. "task-12" or "delivery-4" or "hotel-checkout-5"
  type: 'task' | 'delivery' | 'hotel_checkout' | 'passport_expiry' | 'followup';
  title: string;
  subtitle?: string;
  date: string; // YYYY-MM-DD
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  status?: 'Pending' | 'Completed' | string;
  isCompleted?: boolean;
  clientId?: number;
  clientName?: string;
  clientCode?: string;
  clientPhotoUrl?: string | null;
  passportNumber?: string;
  applicationId?: number;
  applicationCode?: string;
  applicationStatus?: string;
  visaTypeName?: string;
  assignedUserName?: string;
  taskId?: number;
  hotelName?: string;
  roomTypeName?: string;
  comment?: string;
  rawTask?: Task;
  rawApp?: VisaApplication;
  rawBooking?: HotelBooking;
}

interface CalendarViewProps {
  tasks: Task[];
  applications?: VisaApplication[];
  clients?: Client[];
  users?: UserType[];
  hotelBookings?: HotelBooking[];
  onOpenNewTask: (date?: string) => void;
  onToggleTask: (taskId: number) => void;
  onToggleApplicationDelivery?: (app: VisaApplication) => void;
  onDeleteTask?: (taskId: number) => void;
  onOpenClient: (clientId: number) => void;
  onOpenStatusModal?: (applicationId: number) => void;
  onRefreshData?: (silent?: boolean) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks = [],
  applications = [],
  clients = [],
  users = [],
  hotelBookings = [],
  onOpenNewTask,
  onToggleTask,
  onToggleApplicationDelivery,
  onDeleteTask,
  onOpenClient,
  onOpenStatusModal,
  onRefreshData,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Optimistic local tasks state for instant, zero-flicker drag and drop
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Quick Daily Operations Hub state
  const [dailyHubTab, setDailyHubTab] = useState<'today' | 'overdue' | 'deliveries' | 'hotels' | 'tomorrow'>('today');
  const [showDailyHub, setShowDailyHub] = useState(true);

  // Postpone Menu State
  const [postponeMenuTaskId, setPostponeMenuTaskId] = useState<number | null>(null);
  const [postponing, setPostponing] = useState(false);

  // Drag and Drop Task Rescheduling State
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [draggingTaskTitle, setDraggingTaskTitle] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isUpdatingDate, setIsUpdatingDate] = useState<number | null>(null);
  const [rescheduleFeedback, setRescheduleFeedback] = useState<{
    taskId: number;
    taskTitle: string;
    fromDay: string;
    toDay: string;
    timestamp: number;
  } | null>(null);

  // Auto-hide reschedule feedback banner after 7 seconds
  useEffect(() => {
    if (!rescheduleFeedback) return;
    const timer = setTimeout(() => {
      setRescheduleFeedback(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [rescheduleFeedback]);

  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [selectedHotelBooking, setSelectedHotelBooking] = useState<HotelBooking | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  const handleCopyPassport = async (e: React.MouseEvent, passportNumber: string, copyKey: string) => {
    e.stopPropagation();
    e.preventDefault();
    const cleanPassport = passportNumber.trim();
    if (!cleanPassport) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanPassport);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = cleanPassport;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedEventId(copyKey);
      setTimeout(() => {
        setCopiedEventId((prev) => (prev === copyKey ? null : prev));
      }, 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = cleanPassport;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedEventId(copyKey);
      setTimeout(() => {
        setCopiedEventId((prev) => (prev === copyKey ? null : prev));
      }, 2000);
    }
  };

  // Toggle hotel booking status (e.g. Confirmed <-> Checked Out)
  const handleToggleHotelBooking = async (booking: HotelBooking) => {
    try {
      const newStatus = booking.status === 'Checked Out' ? 'Confirmed' : 'Checked Out';
      await api.updateHotelBooking(booking.id, { status: newStatus });
      if (onRefreshData) onRefreshData(true);
    } catch (err: any) {
      console.error('Failed to update hotel booking status:', err);
      setCalendarError('Could not update hotel check-out status: ' + (err.message || 'Unknown error'));
    }
  };

  // Direct Quick Status Change State (Online Review Completed -> Pending Collection / Rejected)
  const [localAppStatusOverrides, setLocalAppStatusOverrides] = useState<Record<number, string>>({});
  const [updatingStatusAppId, setUpdatingStatusAppId] = useState<number | null>(null);
  const [updatingStatusEventId, setUpdatingStatusEventId] = useState<string | null>(null);

  useEffect(() => {
    setLocalAppStatusOverrides({});
  }, [applications]);

  const handleQuickStatusChange = async (
    e: React.MouseEvent,
    ev: CalendarEvent,
    targetStatus: 'Pending Collection' | 'Rejected' | 'Online Review Completed'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const cName =
      ev.clientName ||
      ev.title.replace(/^(Delivery|Pending Collection|Rejected)\s*-\s*/i, '').trim() ||
      'Client';

    // Resolve application ID from event, or fallback-search applications by clientId / passportNumber / clientName
    let resolvedAppId: number | undefined =
      ev.applicationId && applications.some((a) => a.id === ev.applicationId)
        ? ev.applicationId
        : undefined;

    if (!resolvedAppId) {
      const matchedApp =
        (ev.clientId
          ? applications.find(
              (a) =>
                a.client_id === ev.clientId &&
                (a.status === 'Online Review Completed' ||
                  a.status === 'Pending Collection' ||
                  a.status === 'Rejected')
            ) || applications.find((a) => a.client_id === ev.clientId)
          : undefined) ||
        (ev.passportNumber
          ? applications.find(
              (a) =>
                (a.passport_number || '').trim().toUpperCase() ===
                ev.passportNumber!.trim().toUpperCase()
            )
          : undefined) ||
        (cName && cName !== 'Client'
          ? applications.find(
              (a) => (a.client_name || '').trim().toLowerCase() === cName.trim().toLowerCase()
            )
          : undefined);
      if (matchedApp) {
        resolvedAppId = matchedApp.id;
      } else if (ev.applicationId) {
        resolvedAppId = ev.applicationId;
      }
    }

    if (!resolvedAppId && !ev.taskId) return;

    const newTaskTitle =
      targetStatus === 'Pending Collection'
        ? `Pending Collection - ${cName}`
        : targetStatus === 'Rejected'
        ? `Rejected - ${cName}`
        : `Delivery - ${cName}`;

    // Instant optimistic update
    if (resolvedAppId) {
      setLocalAppStatusOverrides((prev) => ({ ...prev, [resolvedAppId!]: targetStatus }));
      setUpdatingStatusAppId(resolvedAppId);
    }
    if (ev.taskId) {
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === ev.taskId ? { ...t, title: newTaskTitle } : t))
      );
    }
    setUpdatingStatusEventId(ev.id);

    try {
      let updatedApp = false;
      if (resolvedAppId) {
        try {
          await api.updateApplicationStatus(
            resolvedAppId,
            targetStatus,
            ev.date,
            `Status changed to ${targetStatus} directly from Calendar View`
          );
          updatedApp = true;
        } catch (appErr) {
          // If application ID wasn't found on backend, still allow task title update below
          if (!ev.taskId) throw appErr;
        }
      }
      if (ev.taskId) {
        await api.updateTask(ev.taskId, { title: newTaskTitle }).catch((taskErr) => {
          if (!updatedApp) throw taskErr;
        });
      }
      if (onRefreshData) onRefreshData(true);
    } catch (err: any) {
      console.error('Failed to update application status from calendar:', err);
      setCalendarError('Could not update application status: ' + (err.message || 'Unknown error'));
      if (resolvedAppId) {
        setLocalAppStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[resolvedAppId!];
          return next;
        });
      }
    } finally {
      setUpdatingStatusAppId(null);
      setUpdatingStatusEventId(null);
    }
  };

  const renderQuickStatusControls = (ev: CalendarEvent, theme: 'dark' | 'light' | 'compact' = 'light') => {
    const isEligibleTask =
      (!!ev.applicationId || !!ev.taskId) &&
      !ev.isCompleted &&
      (ev.type === 'delivery' ||
        ev.applicationStatus === 'Online Review Completed' ||
        ev.applicationStatus === 'Pending Collection' ||
        ev.applicationStatus === 'Rejected' ||
        /^(Delivery|Pending Collection|Rejected)\s*-/i.test(ev.title || ''));

    if (!isEligibleTask) return null;

    const currentAppStatus =
      (/^Pending Collection\s*-/i.test(ev.title || '')
        ? 'Pending Collection'
        : /^Rejected\s*-/i.test(ev.title || '')
        ? 'Rejected'
        : ev.applicationStatus) || 'Online Review Completed';

    const isBusy =
      (!!ev.applicationId && updatingStatusAppId === ev.applicationId) ||
      updatingStatusEventId === ev.id;

    if (theme === 'dark') {
      return (
        <div
          className="flex items-center gap-1 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {currentAppStatus !== 'Pending Collection' && (
            <button
              type="button"
              disabled={isBusy}
              onClick={(e) => handleQuickStatusChange(e, ev, 'Pending Collection')}
              title="Mark Application as Pending Collection"
              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Pending Collection</span>
            </button>
          )}
          {currentAppStatus !== 'Rejected' && (
            <button
              type="button"
              disabled={isBusy}
              onClick={(e) => handleQuickStatusChange(e, ev, 'Rejected')}
              title="Mark Application as Rejected"
              className="px-2.5 py-1 bg-rose-700/90 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
            >
              <X className="w-3 h-3" />
              <span>Rejected</span>
            </button>
          )}
          {(currentAppStatus === 'Pending Collection' || currentAppStatus === 'Rejected') && (
            <button
              type="button"
              disabled={isBusy}
              onClick={(e) => handleQuickStatusChange(e, ev, 'Online Review Completed')}
              title="Revert to Online Review Completed (Delivery)"
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white rounded-lg text-[11px] font-semibold border border-slate-700 transition flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3 h-3 text-sky-400" />
              <span>Online Review</span>
            </button>
          )}
        </div>
      );
    }

    const sizeClass =
      theme === 'compact'
        ? 'px-2 py-1 rounded-lg text-[10px] font-bold'
        : 'px-2.5 py-1 rounded-lg text-xs font-semibold';

    return (
      <div
        className="flex items-center gap-1 flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        {currentAppStatus !== 'Pending Collection' && (
          <button
            type="button"
            disabled={isBusy}
            onClick={(e) => handleQuickStatusChange(e, ev, 'Pending Collection')}
            title="Mark Application as Pending Collection"
            className={`${sizeClass} bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white border border-teal-700 transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Pending Collection</span>
          </button>
        )}
        {currentAppStatus !== 'Rejected' && (
          <button
            type="button"
            disabled={isBusy}
            onClick={(e) => handleQuickStatusChange(e, ev, 'Rejected')}
            title="Mark Application as Rejected"
            className={`${sizeClass} bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white border border-rose-700 transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs`}
          >
            <X className="w-3 h-3" />
            <span>Rejected</span>
          </button>
        )}
        {(currentAppStatus === 'Pending Collection' || currentAppStatus === 'Rejected') && (
          <button
            type="button"
            disabled={isBusy}
            onClick={(e) => handleQuickStatusChange(e, ev, 'Online Review Completed')}
            title="Revert to Online Review Completed (Delivery)"
            className={`${sizeClass} bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 transition flex items-center gap-1 cursor-pointer active:scale-95`}
          >
            <RotateCcw className="w-3 h-3 text-sky-600" />
            <span>Online Review</span>
          </button>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!calendarError) return;
    const timer = setTimeout(() => {
      setCalendarError(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [calendarError]);

  // Global escape listener for modals/drawers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDate(null);
        setPostponeMenuTaskId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'task' | 'hotel' | 'followup' | 'urgent'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const shiftDateString = (dateStr: string, deltaDays: number): string => {
    const clean = String(dateStr || '').trim().slice(0, 10);
    const parts = clean.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + deltaDays);
      return formatLocalDate(fallback);
    }
    const [y, m, d] = parts;
    const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
    const ny = utc.getUTCFullYear();
    const nm = String(utc.getUTCMonth() + 1).padStart(2, '0');
    const nd = String(utc.getUTCDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  };

  const todayStr = formatLocalDate(new Date());
  const tomorrowStr = shiftDateString(todayStr, 1);

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevPeriod = () => {
    if (calendarView === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (calendarView === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  };

  const nextPeriod = () => {
    if (calendarView === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (calendarView === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Reschedule Task (shared by Drag & Drop and manual reschedule)
  const handleRescheduleTask = async (taskId: number, newDueDate: string, taskTitle?: string) => {
    const task = localTasks.find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.due_date === newDueDate) {
      // Dropped on the same date, no update needed
      return;
    }
    const previousDate = task.due_date;
    const title = taskTitle || task.title;

    // Instant optimistic update: task moves immediately to the new date with 0ms lag
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, due_date: newDueDate } : t))
    );

    try {
      setIsUpdatingDate(taskId);
      let taskUpdated = false;
      try {
        await api.updateTask(taskId, { due_date: newDueDate });
        taskUpdated = true;
      } catch (err: any) {
        // If updating task directly fails (e.g. task not in DB) and is tied to an application, update application delivery date
        if (task.application_id) {
          await api.updateApplication(task.application_id, { delivery_date: newDueDate });
          taskUpdated = true;
        } else {
          throw err;
        }
      }

      // Also sync application delivery date if linked
      if (taskUpdated && task.application_id) {
        await api.updateApplication(task.application_id, { delivery_date: newDueDate }).catch(() => {});
      }

      setRescheduleFeedback({
        taskId,
        taskTitle: title,
        fromDay: previousDate,
        toDay: newDueDate,
        timestamp: Date.now(),
      });

      if (onRefreshData) {
        onRefreshData(true);
      }
    } catch (err: any) {
      // Revert optimistic update on error
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, due_date: previousDate } : t))
      );
      console.error('Failed to move task:', err);
      setCalendarError('Could not move task: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUpdatingDate(null);
    }
  };

  const handleRescheduleApplication = async (appId: number, targetDate: string) => {
    try {
      setIsUpdatingDate(appId);
      await api.updateApplication(appId, { delivery_date: targetDate });
      if (onRefreshData) onRefreshData(true);
    } catch (err: any) {
      console.error('Failed to move application delivery date:', err);
      setCalendarError('Could not reschedule collection/delivery date: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUpdatingDate(null);
    }
  };

  // Undo last drag/postpone reschedule
  const handleUndoReschedule = async () => {
    if (!rescheduleFeedback) return;
    const { taskId, fromDay, toDay } = rescheduleFeedback as any;
    setRescheduleFeedback(null);

    // Instant optimistic revert
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, due_date: fromDay } : t))
    );

    try {
      setIsUpdatingDate(taskId);
      await api.updateTask(taskId, { due_date: fromDay });
      if (onRefreshData) onRefreshData(true);
    } catch (err: any) {
      // Revert if undo failed
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, due_date: toDay } : t))
      );
      setCalendarError('Could not undo reschedule: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUpdatingDate(null);
    }
  };

  // 1-Click Fast Postpone / Reschedule
  const handlePostponeTask = async (taskId: number, daysToAdd: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      setPostponing(true);
      const baseDateStr = task.due_date > todayStr ? task.due_date : todayStr;
      const newDueDate = shiftDateString(baseDateStr, daysToAdd);

      await handleRescheduleTask(taskId, newDueDate, task.title);
      setPostponeMenuTaskId(null);
    } catch (err: any) {
      setCalendarError('Failed to reschedule task: ' + (err.message || 'Unknown error'));
    } finally {
      setPostponing(false);
    }
  };

  // Drag & Drop event handlers for tasks and calendar cells
  const handleDragStart = (e: React.DragEvent, ev: CalendarEvent) => {
    if (!ev.taskId && !ev.applicationId) return;
    if (ev.taskId) {
      setDraggingTaskId(ev.taskId);
      setDraggingTaskTitle(ev.title);
    }
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ taskId: ev.taskId, applicationId: ev.applicationId, originalDate: ev.date, title: ev.title })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDraggingTaskTitle(null);
    setDragOverDate(null);
  };

  const handleCellDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDate !== dateStr) {
      setDragOverDate(dateStr);
    }
  };

  const handleCellDragLeave = (e: React.DragEvent, dateStr: string) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverDate === dateStr) {
        setDragOverDate(null);
      }
    }
  };

  const handleCellDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    let taskId = draggingTaskId;
    let taskTitle = draggingTaskTitle || undefined;
    let appId: number | undefined;

    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        if (parsed.taskId) taskId = parsed.taskId;
        if (parsed.title) taskTitle = parsed.title;
        if (parsed.applicationId) appId = parsed.applicationId;
      }
    } catch (_) {
      // Use fallback from state
    }

    if (taskId) {
      handleRescheduleTask(taskId, targetDate, taskTitle);
    } else if (appId) {
      handleRescheduleApplication(appId, targetDate);
    }
    handleDragEnd();
  };

  // Unified Event Registry
  const allEvents: CalendarEvent[] = useMemo(() => {
    const list: CalendarEvent[] = [];
    const clientPhotoMap = new Map<number, string | null>();
    const clientPassportMap = new Map<number, string>();
    clients.forEach((c) => {
      clientPhotoMap.set(c.id, c.photo_url || null);
      if (c.passport_number) {
        clientPassportMap.set(c.id, c.passport_number);
      }
    });

    const cleanDate = (val?: string | null): string => {
      if (!val) return '';
      const s = String(val).trim();
      if (s.includes('T')) return s.split('T')[0];
      if (s.includes(' ')) return s.split(' ')[0];
      return s.slice(0, 10);
    };

    const appById = new Map<number, VisaApplication>();
    applications.forEach((a) => {
      appById.set(a.id, a);
    });

    const hotelCheckoutTaskIds = new Set(
      hotelBookings.filter((b) => b.checkout_task_id).map((b) => b.checkout_task_id)
    );

    // 1. Operational Tasks & Delivery Tasks
    localTasks.forEach((t) => {
      if (hotelCheckoutTaskIds.has(t.id)) {
        return;
      }
      const isHotelCheckoutTitle = t.title.startsWith('Hotel Check-Out:');
      if (isHotelCheckoutTitle && hotelBookings.some((b) => b.client_id === t.client_id && cleanDate(b.check_out_date) === cleanDate(t.due_date))) {
        return;
      }

      const isDelivery = t.is_delivery_task === 1;
      const isFollowUp = t.title.startsWith('[Follow-up]') || t.title.toLowerCase().includes('follow-up');
      const extractedName = t.title
        .replace(/^(\[Follow-up\]|Delivery|Pending Collection|Rejected|Upcoming Client)\s*[-:]?\s*/i, '')
        .trim();

      const matchedClient =
        (t.client_id ? clients.find((c) => c.id === t.client_id) : undefined) ||
        (t.passport_number
          ? clients.find(
              (c) =>
                (c.passport_number || '').trim().toUpperCase() ===
                t.passport_number!.trim().toUpperCase()
            )
          : undefined) ||
        (extractedName
          ? clients.find(
              (c) => (c.full_name || '').trim().toLowerCase() === extractedName.toLowerCase()
            )
          : undefined);

      const resolvedClientId = t.client_id || matchedClient?.id;
      const photo = resolvedClientId ? clientPhotoMap.get(resolvedClientId) : null;
      const passportNum =
        t.passport_number ||
        (resolvedClientId ? clientPassportMap.get(resolvedClientId) : undefined);

      const linkedApp =
        (t.application_id ? appById.get(t.application_id) : undefined) ||
        (resolvedClientId
          ? applications.find(
              (a) =>
                a.client_id === resolvedClientId &&
                (a.status === 'Pending Collection' ||
                  a.status === 'Online Review Completed' ||
                  a.status === 'Rejected')
            ) || applications.find((a) => a.client_id === resolvedClientId)
          : undefined);

      const finalClientId = resolvedClientId || linkedApp?.client_id || undefined;
      const finalClientName =
        t.client_name || matchedClient?.full_name || linkedApp?.client_name || undefined;
      const finalClientCode =
        t.client_code || matchedClient?.client_id || linkedApp?.client_code || undefined;

      const effectiveAppStatus = linkedApp
        ? localAppStatusOverrides[linkedApp.id] || linkedApp.status
        : undefined;

      let displayTitle = t.title;
      if (isDelivery || /^(Delivery|Pending Collection|Rejected)\s*-/i.test(t.title || '')) {
        const resolvedClientName =
          finalClientName ||
          t.title.replace(/^(Delivery|Pending Collection|Rejected)\s*-\s*/i, '').trim() ||
          'Client';
        if (effectiveAppStatus === 'Pending Collection') {
          displayTitle = `Pending Collection - ${resolvedClientName}`;
        } else if (effectiveAppStatus === 'Rejected') {
          displayTitle = `Rejected - ${resolvedClientName}`;
        } else if (effectiveAppStatus === 'Online Review Completed') {
          displayTitle = `Delivery - ${resolvedClientName}`;
        }
      }

      list.push({
        id: `task-${t.id}`,
        type: isDelivery ? 'delivery' : isFollowUp ? 'followup' : 'task',
        title: displayTitle,
        subtitle: finalClientName ? `${finalClientName} (${passportNum || finalClientCode || ''})` : undefined,
        date: cleanDate(t.due_date),
        priority: t.priority,
        status: t.status,
        isCompleted: t.status === 'Completed',
        clientId: finalClientId,
        clientName: finalClientName,
        clientCode: finalClientCode,
        clientPhotoUrl: photo,
        passportNumber: passportNum || undefined,
        applicationId: linkedApp?.id || (t.application_id && appById.has(t.application_id) ? t.application_id : undefined),
        applicationCode: t.application_code || linkedApp?.application_id || undefined,
        applicationStatus: effectiveAppStatus,
        assignedUserName: t.assigned_user_name || undefined,
        taskId: t.id,
        rawTask: t,
        rawApp: linkedApp,
      });
    });

    // 2. Visa Application Delivery / Upcoming Dates
    const existingDeliveryAppIds = new Set(
      localTasks
        .filter((t) => (t.is_delivery_task === 1 || /^Upcoming Client\s*-/i.test(t.title || '')) && t.application_id)
        .map((t) => t.application_id)
    );

    applications.forEach((app) => {
      if (app.delivery_date && !existingDeliveryAppIds.has(app.id)) {
        const photo = app.client_photo_url || (app.client_id ? clientPhotoMap.get(app.client_id) : null);
        const passportNum = app.passport_number || (app.client_id ? clientPassportMap.get(app.client_id) : undefined);
        const effectiveStatus = localAppStatusOverrides[app.id] || app.status;
        const isUpcomingApp = effectiveStatus === 'Upcoming';
        list.push({
          id: `app-delivery-${app.id}`,
          type: isUpcomingApp ? 'task' : 'delivery',
          title: isUpcomingApp
            ? `Upcoming Client - ${app.client_name || 'Client'}`
            : `${
                effectiveStatus === 'Pending Collection'
                  ? 'Pending Collection'
                  : effectiveStatus === 'Rejected'
                  ? 'Rejected'
                  : 'Delivery'
              } - ${app.client_name || 'Client'}`,
          subtitle: `Passport: ${passportNum || ''} • Status: ${effectiveStatus}`,
          date: cleanDate(app.delivery_date),
          priority: isUpcomingApp ? 'Normal' : 'High',
          status: effectiveStatus,
          isCompleted: effectiveStatus === 'Returned',
          clientId: app.client_id,
          clientName: app.client_name,
          clientCode: app.client_code,
          clientPhotoUrl: photo,
          passportNumber: passportNum,
          applicationId: app.id,
          applicationCode: app.application_id,
          applicationStatus: effectiveStatus,
          visaTypeName: app.visa_type_name,
          assignedUserName: app.assigned_user_name || undefined,
          rawApp: app,
        });
      }
    });

    // 3. Hotel Bookings Check-Out Dates
    hotelBookings.forEach((b) => {
      const photo = b.client_photo_url || (b.client_id ? clientPhotoMap.get(b.client_id) : null);
      const passportNum = b.passport_number || (b.client_id ? clientPassportMap.get(b.client_id) : undefined);
      list.push({
        id: `hotel-checkout-${b.id}`,
        type: 'hotel_checkout',
        title: `🏨 Check-Out: ${b.client_name || 'Client'} (${b.hotel_name})`,
        subtitle: `${b.hotel_name} • Room: ${b.room_type_name || 'Standard'} • Stay: ${cleanDate(b.check_in_date)} to ${cleanDate(b.check_out_date)}`,
        date: cleanDate(b.check_out_date),
        priority: 'High',
        status: b.status,
        isCompleted: b.status === 'Checked Out',
        clientId: b.client_id,
        clientName: b.client_name,
        clientCode: b.client_code,
        clientPhotoUrl: photo,
        passportNumber: passportNum,
        hotelName: b.hotel_name,
        roomTypeName: b.room_type_name,
        comment: b.comment || undefined,
        taskId: b.checkout_task_id || undefined,
        rawBooking: b,
      });
    });

    return list;
  }, [localTasks, applications, clients, hotelBookings, localAppStatusOverrides]);

  // Helper: Sort events so uncompleted tasks go up (top) and completed tasks go down (bottom)
  const sortEventsUncompletedFirst = (events: CalendarEvent[]): CalendarEvent[] => {
    return [...events].sort((a, b) => {
      const aComp = a.isCompleted ? 1 : 0;
      const bComp = b.isCompleted ? 1 : 0;
      if (aComp !== bComp) return aComp - bComp;
      return 0;
    });
  };

  // Today's Operational Breakdown
  const todayEvents = useMemo(() => {
    return sortEventsUncompletedFirst(allEvents.filter((e) => e.date === todayStr));
  }, [allEvents, todayStr]);

  const overdueEvents = useMemo(() => {
    return sortEventsUncompletedFirst(allEvents.filter((e) => !e.isCompleted && e.date < todayStr));
  }, [allEvents, todayStr]);

  const tomorrowEvents = useMemo(() => {
    return sortEventsUncompletedFirst(allEvents.filter((e) => e.date === tomorrowStr));
  }, [allEvents, tomorrowStr]);

  const todayDeliveries = useMemo(() => {
    return todayEvents.filter((e) => e.type === 'delivery');
  }, [todayEvents]);

  const todayHotels = useMemo(() => {
    return todayEvents.filter((e) => e.type === 'hotel_checkout');
  }, [todayEvents]);

  const todayCompletedCount = useMemo(() => {
    return todayEvents.filter((e) => e.isCompleted).length;
  }, [todayEvents]);

  const todayProgressPercent = useMemo(() => {
    if (todayEvents.length === 0) return 100;
    return Math.round((todayCompletedCount / todayEvents.length) * 100);
  }, [todayEvents, todayCompletedCount]);

  // Filtered Events for Calendar Views
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesClient = (ev.clientName || '').toLowerCase().includes(q);
        const matchesPassport = (ev.passportNumber || '').toLowerCase().includes(q);
        const matchesApp = (ev.applicationCode || '').toLowerCase().includes(q);
        const matchesHotel = (ev.hotelName || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesClient && !matchesPassport && !matchesApp && !matchesHotel) return false;
      }

      // Type filter
      if (typeFilter === 'delivery' && ev.type !== 'delivery') return false;
      if (typeFilter === 'task' && ev.type !== 'task') return false;
      if (typeFilter === 'hotel' && ev.type !== 'hotel_checkout') return false;
      if (typeFilter === 'followup' && ev.type !== 'followup') return false;
      if (typeFilter === 'urgent' && ev.priority !== 'Urgent' && ev.priority !== 'High') return false;

      // Status filter
      if (statusFilter === 'completed' && !ev.isCompleted) return false;
      if (statusFilter === 'pending' && ev.isCompleted) return false;
      if (statusFilter === 'overdue' && (ev.isCompleted || ev.date >= todayStr)) return false;

      // User filter
      if (userFilter !== 'all' && ev.assignedUserName !== userFilter) return false;

      return true;
    });
  }, [allEvents, searchQuery, typeFilter, statusFilter, userFilter, todayStr]);

  // Group filtered events by date string and sort uncompleted up / completed down for every date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });

    // Ensure uncompleted tasks go up and completed tasks go down for each date
    Object.keys(map).forEach((dateKey) => {
      map[dateKey] = sortEventsUncompletedFirst(map[dateKey]);
    });

    return map;
  }, [filteredEvents]);

  // Month Grid Days computation
  const daysInMonth = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Prev month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const str = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr: str, dayNum: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const str = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr: str, dayNum: i, isCurrentMonth: true });
    }

    // Next month padding to fill grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      const str = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr: str, dayNum: i, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Week View Days computation
  const daysInWeek = useMemo(() => {
    const curr = new Date(currentDate);
    const dayOfWeek = curr.getDay();
    const startOfWeek = new Date(curr);
    startOfWeek.setDate(curr.getDate() - dayOfWeek);

    const days: Array<{ dateStr: string; dayNum: number; dayName: string; isToday: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const str = formatLocalDate(d);
      days.push({
        dateStr: str,
        dayNum: d.getDate(),
        dayName: d.toLocaleString('default', { weekday: 'short' }),
        isToday: str === todayStr,
      });
    }
    return days;
  }, [currentDate, todayStr]);

  // Stats Metrics for current month
  const metrics = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthEvents = allEvents.filter((e) => e.date.startsWith(monthPrefix));
    const deliveries = monthEvents.filter((e) => e.type === 'delivery');
    const urgent = monthEvents.filter((e) => e.priority === 'Urgent' || e.priority === 'High');
    const overdue = allEvents.filter((e) => !e.isCompleted && e.date < todayStr);
    const completed = monthEvents.filter((e) => e.isCompleted);
    const completionRate = monthEvents.length > 0 ? Math.round((completed.length / monthEvents.length) * 100) : 100;

    return {
      total: monthEvents.length,
      deliveries: deliveries.length,
      urgent: urgent.length,
      overdue: overdue.length,
      completed: completed.length,
      completionRate,
    };
  }, [allEvents, year, month, todayStr]);

  // Selected Day Drawer Events
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate[selectedDate] || [];
  }, [selectedDate, eventsByDate]);

  // Active list for Daily Hub
  const activeDailyHubEvents = useMemo(() => {
    switch (dailyHubTab) {
      case 'overdue':
        return overdueEvents;
      case 'deliveries':
        return todayDeliveries;
      case 'hotels':
        return todayHotels;
      case 'tomorrow':
        return tomorrowEvents;
      case 'today':
      default:
        return todayEvents;
    }
  }, [dailyHubTab, todayEvents, overdueEvents, todayDeliveries, todayHotels, tomorrowEvents]);

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Calendar & Daily Tasks Hub
              </h1>
              <p className="text-xs text-slate-500">
                Manage daily operations, CVASC submissions, passport deliveries, and hotel check-outs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2 w-full lg:w-auto">
          {/* Calendar View Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-4 sm:flex flex-1 sm:flex-initial text-xs font-semibold border border-slate-200 shadow-2xs">
            <button
              onClick={() => setCalendarView('month')}
              className={`px-2 sm:px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                calendarView === 'month' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Month</span>
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-2 sm:px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                calendarView === 'week' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Week</span>
            </button>
            <button
              onClick={() => setCalendarView('day')}
              className={`px-2 sm:px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                calendarView === 'day' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Day</span>
            </button>
            <button
              onClick={() => setCalendarView('agenda')}
              className={`px-2 sm:px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                calendarView === 'agenda' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Agenda</span>
            </button>
          </div>

          {/* New Task Button */}
          <button
            onClick={() => onOpenNewTask(selectedDate || todayStr)}
            className="px-3 sm:px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🚀 TODAY'S DAILY OPERATIONS COMMAND CENTER (Interactive Hub) */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-800 text-white p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Daily Operations Plan
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 font-mono">
                  {new Date().toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Execute today&apos;s embassy runs, collection tasks, and customer handoffs.
              </p>
            </div>
          </div>

          {/* Today's Progress Bar */}
          <div className="flex items-center justify-between sm:justify-end gap-3 bg-slate-800/80 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-700/80">
            <div className="sm:text-right">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 sm:justify-end">
                <span>{todayCompletedCount} of {todayEvents.length} Done</span>
                <span className="text-emerald-400 font-mono">({todayProgressPercent}%)</span>
              </div>
              <div className="text-[10px] text-slate-400">Today&apos;s Completion Rate</div>
            </div>
            <div className="w-24 sm:w-28 h-2 bg-slate-700 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${todayProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Hub Tabs / Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
          <button
            onClick={() => setDailyHubTab('today')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              dailyHubTab === 'today'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Today&apos;s Schedule</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">
              {todayEvents.length}
            </span>
          </button>

          <button
            onClick={() => setDailyHubTab('overdue')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              dailyHubTab === 'overdue'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-800/80 text-rose-300 hover:bg-slate-800 hover:text-white border border-rose-900/40'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Overdue Actions</span>
            {overdueEvents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-200 text-[10px] font-mono font-bold">
                {overdueEvents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setDailyHubTab('deliveries')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              dailyHubTab === 'deliveries'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span>Deliveries ({todayDeliveries.length})</span>
          </button>

          <button
            onClick={() => setDailyHubTab('hotels')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              dailyHubTab === 'hotels'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-teal-400" />
            <span>Check-Outs ({todayHotels.length})</span>
          </button>

          <button
            onClick={() => setDailyHubTab('tomorrow')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              dailyHubTab === 'tomorrow'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tomorrow ({tomorrowEvents.length})</span>
          </button>
        </div>

        {/* Task Cards Grid for Active Hub Tab */}
        <div className="space-y-2.5 max-h-96 sm:max-h-80 overflow-y-auto pr-0.5 sm:pr-1">
          {activeDailyHubEvents.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-500/80 mx-auto mb-2" />
              {dailyHubTab === 'overdue'
                ? 'Awesome! No overdue tasks remaining.'
                : `No items scheduled in "${dailyHubTab}" category.`}
            </div>
          ) : (
            activeDailyHubEvents.map((ev) => {
              const priorityBadge = ev.priority ? getPriorityBadge(ev.priority) : null;
              const isOverdue = !ev.isCompleted && ev.date < todayStr;
              const isRejected = !ev.isCompleted && (ev.applicationStatus === 'Rejected' || /^Rejected\s*-/i.test(ev.title || ''));
              const isDraggable = !!((ev.taskId || ev.applicationId) && !ev.isCompleted);
              const isBeingDragged = !!(ev.taskId && draggingTaskId === ev.taskId);

              return (
                <div
                  key={ev.id}
                  draggable={isDraggable}
                  onDragStart={(e) => isDraggable && handleDragStart(e, ev)}
                  onDragEnd={handleDragEnd}
                  title={isDraggable ? 'Drag and drop onto any calendar day below to reschedule' : undefined}
                  className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group/hub ${
                    isBeingDragged
                      ? 'opacity-30 border-dashed border-sky-400 bg-sky-950/40'
                      : isDraggable
                      ? 'hover:border-sky-500/80 cursor-grab active:cursor-grabbing'
                      : ''
                  } ${
                    ev.isCompleted
                      ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
                      : isRejected
                      ? 'bg-rose-950/40 border-rose-700/70 border-l-4 border-l-rose-500 hover:border-rose-500'
                      : isOverdue
                      ? 'bg-rose-950/30 border-rose-800/60 hover:border-rose-600'
                      : ev.type === 'delivery'
                      ? 'bg-emerald-950/30 border-emerald-800/60 hover:border-emerald-500'
                      : ev.type === 'hotel_checkout'
                      ? 'bg-teal-950/30 border-teal-800/60 hover:border-teal-500'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                    {/* Drag Grip Handle (Desktop) */}
                    {isDraggable && (
                      <div
                        className="hidden sm:block text-slate-500 group-hover/hub:text-sky-400 mt-1 shrink-0 cursor-grab active:cursor-grabbing transition"
                        title="Drag onto calendar below to reschedule"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}

                    {/* Toggle Checkbox */}
                    {ev.taskId ? (
                      <button
                        type="button"
                        onClick={() => ev.taskId && onToggleTask(ev.taskId)}
                        className="mt-0.5 text-slate-400 hover:text-emerald-400 transition shrink-0 cursor-pointer"
                        title={ev.isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                      >
                        {ev.isCompleted ? (
                          <CheckSquare className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-500 hover:text-white" />
                        )}
                      </button>
                    ) : ev.rawBooking ? (
                      <button
                        type="button"
                        onClick={() => ev.rawBooking && handleToggleHotelBooking(ev.rawBooking)}
                        className="mt-0.5 text-slate-400 hover:text-teal-400 transition shrink-0 cursor-pointer"
                        title={ev.isCompleted ? 'Mark as Confirmed' : 'Mark as Checked Out (Completed)'}
                      >
                        {ev.isCompleted ? (
                          <CheckSquare className="w-5 h-5 text-teal-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-500 hover:text-white" />
                        )}
                      </button>
                    ) : ev.rawApp ? (
                      <button
                        type="button"
                        onClick={() => ev.rawApp && onToggleApplicationDelivery && onToggleApplicationDelivery(ev.rawApp)}
                        className="mt-0.5 text-slate-400 hover:text-amber-400 transition shrink-0 cursor-pointer"
                        title={ev.isCompleted ? 'Mark as Pending' : 'Mark Collection Date as Completed (Return Application)'}
                      >
                        {ev.isCompleted ? (
                          <CheckSquare className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Square className="w-5 h-5 text-amber-500/80 hover:text-amber-300" />
                        )}
                      </button>
                    ) : (
                      <div className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        {ev.type === 'delivery' ? (
                          <Package className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-teal-400" />
                        )}
                      </div>
                    )}

                    {/* Client Avatar */}
                    {ev.clientName && (
                      <ClientAvatar
                        fullName={ev.clientName}
                        photoUrl={ev.clientPhotoUrl}
                        size="sm"
                        allowPreview={true}
                        className="ring-1 ring-slate-700 shadow-xs shrink-0"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-semibold text-xs sm:text-sm leading-snug ${
                            ev.isCompleted ? 'line-through text-slate-500' : 'text-white'
                          }`}
                        >
                          {ev.title}
                        </span>

                        {isOverdue && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            OVERDUE
                          </span>
                        )}

                        {priorityBadge && (
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${priorityBadge.bg}`}>
                            {ev.priority}
                          </span>
                        )}
                      </div>

                      {ev.subtitle && (
                        <div className="text-xs text-slate-400 mt-0.5 break-words sm:truncate">{ev.subtitle}</div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap font-mono">
                        <span className="flex items-center gap-1 text-slate-300">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {ev.date}
                        </span>

                        {ev.clientName && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => ev.clientId && onOpenClient(ev.clientId)}
                              className="text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                            >
                              {ev.clientName} {ev.clientCode ? `(${ev.clientCode})` : ''}
                            </button>
                          </>
                        )}

                        {ev.assignedUserName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">Assigned: {ev.assignedUserName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right / Bottom Actions: 1-Click Postpone & Shortcuts */}
                  <div className="w-full sm:w-auto pt-2.5 sm:pt-0 border-t border-slate-800/80 sm:border-t-0 flex items-center gap-1.5 shrink-0 flex-wrap justify-between sm:justify-end">
                    {renderQuickStatusControls(ev, 'dark')}
                    {ev.taskId && !ev.isCompleted && (
                      <>
                        {postponeMenuTaskId === ev.taskId ? (
                          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-sky-500/50 rounded-xl p-1 shadow-lg animate-in fade-in zoom-in-95 flex-wrap">
                            <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider px-1.5 flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" />
                              <span>Move:</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handlePostponeTask(ev.taskId!, 1)}
                              disabled={postponing}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer shadow-xs"
                            >
                              Tomorrow (+1d)
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePostponeTask(ev.taskId!, 2)}
                              disabled={postponing}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition active:scale-95 cursor-pointer"
                            >
                              +2 Days
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePostponeTask(ev.taskId!, 7)}
                              disabled={postponing}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition active:scale-95 cursor-pointer"
                            >
                              +1 Week
                            </button>
                            <button
                              type="button"
                              onClick={() => setPostponeMenuTaskId(null)}
                              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPostponeMenuTaskId(ev.taskId!)}
                            className="px-2.5 py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-sky-300 rounded-lg text-xs font-semibold border border-slate-700 hover:border-slate-600 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Reschedule Task"
                          >
                            <RotateCcw className="w-3 h-3 text-sky-400" />
                            <span>Reschedule</span>
                          </button>
                        )}
                      </>
                    )}

                    {ev.passportNumber && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyPassport(e, ev.passportNumber!, `hub-${ev.id}`)}
                        title={`Copy Passport Number: ${ev.passportNumber}`}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          copiedEventId === `hub-${ev.id}`
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                        }`}
                      >
                        {copiedEventId === `hub-${ev.id}` ? (
                          <>
                            <Check className="w-3 h-3 text-white" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-sky-400" />
                            <span className="font-mono">{ev.passportNumber}</span>
                          </>
                        )}
                      </button>
                    )}

                    {ev.clientId && (
                      <button
                        type="button"
                        onClick={() => ev.clientId && onOpenClient(ev.clientId)}
                        className="px-2.5 py-1 bg-sky-600/80 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Client
                      </button>
                    )}

                    {ev.rawBooking && (
                      <button
                        type="button"
                        onClick={() => ev.rawBooking && setSelectedHotelBooking(ev.rawBooking)}
                        className="px-2.5 py-1 bg-teal-800/90 hover:bg-teal-700 text-teal-200 hover:text-white rounded-lg text-xs font-semibold border border-teal-700 transition cursor-pointer"
                      >
                        Hotel
                      </button>
                    )}

                    {ev.applicationId && onOpenStatusModal && (
                      <button
                        type="button"
                        onClick={() => ev.applicationId && onOpenStatusModal(ev.applicationId)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
                      >
                        Status
                      </button>
                    )}

                    {ev.taskId && onDeleteTask && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete task "${ev.title}"?`)) {
                            setLocalTasks((prev) => prev.filter((t) => t.id !== ev.taskId));
                            onDeleteTask(ev.taskId!);
                          }
                        }}
                        className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white rounded-lg text-xs font-semibold border border-rose-800/80 transition cursor-pointer flex items-center gap-1"
                        title="Delete Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}

                    {!ev.taskId && ev.rawApp && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Clear collection date for ${ev.rawApp?.client_name || 'Client'}?`)) {
                            try {
                              await api.updateApplication(ev.rawApp!.id, { delivery_date: null });
                              if (onRefreshData) onRefreshData(true);
                            } catch (err) {
                              console.error('Failed to clear collection date:', err);
                            }
                          }
                        }}
                        className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white rounded-lg text-xs font-semibold border border-rose-800/80 transition cursor-pointer flex items-center gap-1"
                        title="Clear Collection Date"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Date</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{metrics.total}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 truncate">This Month</div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-bold text-emerald-900 leading-tight">{metrics.deliveries}</div>
            <div className="text-[10px] sm:text-[11px] text-emerald-700 font-medium truncate">Deliveries</div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-bold text-amber-900 leading-tight">{metrics.urgent}</div>
            <div className="text-[10px] sm:text-[11px] text-amber-700 font-medium truncate">Urgent Items</div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-red-200 bg-red-50/20 shadow-xs flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-bold text-red-800 leading-tight">{metrics.overdue}</div>
            <div className="text-[10px] sm:text-[11px] text-red-600 font-medium truncate">Overdue</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hidden lg:flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-slate-800">{metrics.completionRate}%</span>
              <span className="text-[10px] text-slate-400">Completed</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${metrics.completionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-3">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search task, client, passport, app ID..."
            className="w-full pl-9 pr-4 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-2 sm:py-1 rounded-xl border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Event Types</option>
              <option value="followup">💬 Client Follow-ups</option>
              <option value="hotel">🏨 Hotel Check-Outs</option>
              <option value="delivery">📦 Deliveries Only</option>
              <option value="task">📋 Internal Tasks</option>
              <option value="urgent">⚡ Urgent / High Priority</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="bg-slate-50 px-2.5 py-2 sm:py-1 rounded-xl border border-slate-200 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="pending">⏳ Pending &amp; Active</option>
              <option value="completed">✓ Completed</option>
              <option value="overdue">⚠️ Overdue</option>
            </select>
          </div>

          {/* User Filter */}
          {users.length > 0 && (
            <div className="bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs hidden sm:block">
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">All Assignees</option>
                {users.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all' || userFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setStatusFilter('all');
                setUserFilter('all');
              }}
              className="col-span-2 sm:col-span-1 px-2.5 py-1 text-xs text-sky-700 hover:text-sky-900 font-semibold cursor-pointer text-center"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Month / Week / Day Navigation Header */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={prevPeriod}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition active:scale-95 cursor-pointer"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextPeriod}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition active:scale-95 cursor-pointer"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="min-w-0">
            <h2 className="text-sm sm:text-lg font-bold text-slate-900 capitalize truncate">
              {calendarView === 'month' && monthName}
              {calendarView === 'week' && `Week of ${daysInWeek[0]?.dateStr}`}
              {calendarView === 'day' && currentDate.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {calendarView === 'agenda' && `Agenda (${monthName})`}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/90 text-slate-600 rounded-xl text-[11px] font-medium border border-slate-200">
            <GripVertical className="w-3.5 h-3.5 text-sky-600" />
            <span>Drag tasks to reschedule</span>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl border border-sky-200 transition active:scale-95 cursor-pointer"
          >
            <span>Today</span>
            <span className="hidden sm:inline"> ({todayStr})</span>
          </button>
        </div>
      </div>

      {/* VIEW: Month View */}
      {calendarView === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Mobile Quick Tip Banner */}
          <div className="sm:hidden px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <span>Tap any date to inspect or update tasks &amp; status</span>
            <span className="font-mono font-bold text-sky-700">{metrics.total} items</span>
          </div>

          {/* Day Names Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[370px] sm:min-h-[580px]">
            {daysInMonth.map((cell) => {
              const cellEvents = eventsByDate[cell.dateStr] || [];
              const isToday = cell.dateStr === todayStr;
              const isSelected = selectedDate === cell.dateStr;
              const isOverTarget = dragOverDate === cell.dateStr;
              const hasRejectedEvent = cellEvents.some(
                (ev) => !ev.isCompleted && (ev.applicationStatus === 'Rejected' || /^Rejected\s*-/i.test(ev.title || ''))
              );

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  onDragOver={(e) => handleCellDragOver(e, cell.dateStr)}
                  onDragLeave={(e) => handleCellDragLeave(e, cell.dateStr)}
                  onDrop={(e) => handleCellDrop(e, cell.dateStr)}
                  className={`p-1 sm:p-2 min-h-[68px] sm:min-h-[110px] flex flex-col justify-between transition cursor-pointer group relative ${
                    isOverTarget
                      ? 'bg-sky-100/90 ring-2 ring-sky-600 shadow-inner z-10 border-sky-400'
                      : draggingTaskId !== null
                      ? 'border border-dashed border-slate-300 hover:bg-sky-50/50'
                      : ''
                  } ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-50/50 text-slate-300'
                      : isSelected
                      ? 'bg-sky-50/80 ring-2 ring-sky-600 inset-0 z-10'
                      : hasRejectedEvent
                      ? 'bg-rose-50/45 hover:bg-rose-50/70'
                      : isToday
                      ? 'bg-amber-50/30'
                      : 'bg-white hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[11px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg ${
                        isToday
                          ? 'bg-sky-700 text-white font-bold shadow-xs'
                          : cell.isCurrentMonth
                          ? 'text-slate-800 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {cellEvents.length > 0 && (
                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 bg-slate-100 text-slate-700 font-bold rounded-md">
                        {cellEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Event Pills */}
                  <div className="space-y-1 overflow-y-auto max-h-16 sm:max-h-24 no-scrollbar">
                    {cellEvents.slice(0, 3).map((ev) => {
                      const isCompleted = ev.isCompleted;
                      const isRejected = !isCompleted && (ev.applicationStatus === 'Rejected' || /^Rejected\s*-/i.test(ev.title || ''));
                      const isDelivery = ev.type === 'delivery';
                      const isHotel = ev.type === 'hotel_checkout';
                      const isFollowUp = ev.type === 'followup';
                      const isDraggable = !!((ev.taskId || ev.applicationId) && !isCompleted);
                      const isBeingDragged = !!(ev.taskId && draggingTaskId === ev.taskId);

                      // Clean short label for tiny mobile cells so it stays legible
                      const mobileShortLabel = ev.clientName
                        ? ev.clientName.split(' ')[0]
                        : ev.title.replace(/^(Pending Collection|Delivery|Rejected|Upcoming Client)\s*-\s*/i, '');

                      return (
                        <div
                          key={ev.id}
                          draggable={isDraggable}
                          onDragStart={(e) => isDraggable && handleDragStart(e, ev)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            if (ev.rawBooking && window.innerWidth >= 640) {
                              e.stopPropagation();
                              setSelectedHotelBooking(ev.rawBooking);
                            }
                          }}
                          title={ev.rawBooking ? 'Click to view hotel booking details' : isDraggable ? 'Drag onto any day to reschedule' : undefined}
                          className={`text-[9px] sm:text-[11px] px-1 py-0.5 sm:p-1.5 rounded sm:rounded-lg border text-left transition flex items-center sm:items-start gap-1 shadow-2xs group/pill select-none ${
                            isBeingDragged
                              ? 'opacity-25 scale-95 border-dashed border-sky-500 bg-sky-100'
                              : ev.rawBooking
                              ? 'cursor-pointer hover:border-teal-400 hover:shadow-xs'
                              : isDraggable
                              ? 'cursor-grab active:cursor-grabbing hover:border-sky-400 hover:shadow-xs'
                              : ''
                          } ${
                            isCompleted
                              ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                              : isRejected
                              ? 'bg-rose-100/85 border-rose-300 border-l-2 sm:border-l-4 border-l-rose-500 text-rose-900 font-semibold'
                              : isHotel
                              ? 'bg-teal-50 border-teal-300 text-teal-950 font-semibold'
                              : isFollowUp
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                              : isDelivery
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                              : ev.priority === 'Urgent'
                              ? 'bg-red-50 border-red-200 text-red-900 font-bold'
                              : ev.priority === 'High'
                              ? 'bg-amber-50 border-amber-200 text-amber-900 font-medium'
                              : 'bg-sky-50 border-sky-200 text-sky-900'
                          }`}
                        >
                          {isDraggable && (
                            <GripVertical className="hidden sm:block w-3 h-3 text-slate-400 group-hover/pill:text-sky-600 mt-0.5 shrink-0 opacity-0 group-hover/pill:opacity-100 transition" />
                          )}

                          {ev.taskId ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (ev.taskId) onToggleTask(ev.taskId);
                              }}
                              className="hidden sm:inline-flex mt-0.5 shrink-0 cursor-pointer"
                              title={isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                            >
                              {isCompleted ? (
                                <CheckSquare className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Square className="w-3 h-3 text-slate-400 hover:text-sky-600" />
                              )}
                            </button>
                          ) : ev.rawBooking ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (ev.rawBooking) handleToggleHotelBooking(ev.rawBooking);
                              }}
                              className="hidden sm:inline-flex mt-0.5 shrink-0 cursor-pointer"
                              title={isCompleted ? 'Mark as Confirmed' : 'Mark as Checked Out (Completed)'}
                            >
                              {isCompleted ? (
                                <CheckSquare className="w-3 h-3 text-teal-600" />
                              ) : (
                                <Square className="w-3 h-3 text-teal-500 hover:text-teal-700" />
                              )}
                            </button>
                          ) : ev.rawApp ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (ev.rawApp && onToggleApplicationDelivery) onToggleApplicationDelivery(ev.rawApp);
                              }}
                              className="hidden sm:inline-flex mt-0.5 shrink-0 cursor-pointer text-amber-500 hover:text-amber-600"
                              title={isCompleted ? 'Returned' : 'Mark as Returned'}
                            >
                              {isCompleted ? (
                                <CheckSquare className="w-3 h-3 text-amber-500" />
                              ) : (
                                <Square className="w-3 h-3 text-slate-400 hover:text-amber-500" />
                              )}
                            </button>
                          ) : (
                            <span className="hidden sm:inline mt-0.5 text-xs">
                              {isDelivery ? '📦' : '🏨'}
                            </span>
                          )}

                          {/* Mobile compact label vs Desktop full title */}
                          <span className="sm:hidden truncate flex-1 font-semibold leading-tight">
                            {mobileShortLabel}
                          </span>
                          <span className="hidden sm:inline truncate flex-1 font-medium">
                            {ev.title}
                          </span>
                        </div>
                      );
                    })}

                    {cellEvents.length > 3 && (
                      <div className="text-[9px] sm:text-[10px] text-slate-500 font-semibold text-center py-0.5">
                        +{cellEvents.length - 3} more
                      </div>
                    )}
                  </div>

                  {isOverTarget && (
                    <div className="absolute inset-x-1 bottom-1 bg-sky-700 text-white text-[10px] font-bold py-1 px-1 rounded-md text-center shadow-md animate-pulse z-20 flex items-center justify-center gap-1">
                      <CalendarIcon className="w-2.5 h-2.5" />
                      <span>Drop to Move</span>
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNewTask(cell.dateStr);
                    }}
                    className="hidden sm:block opacity-0 group-hover:opacity-100 text-[10px] text-sky-700 font-semibold self-center py-0.5 hover:underline transition cursor-pointer"
                  >
                    + Add Task
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: Week View */}
      {calendarView === 'week' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            {daysInWeek.map((col) => {
              const colEvents = eventsByDate[col.dateStr] || [];
              const isToday = col.isToday;
              const isOverTarget = dragOverDate === col.dateStr;

              return (
                <div
                  key={col.dateStr}
                  onDragOver={(e) => handleCellDragOver(e, col.dateStr)}
                  onDragLeave={(e) => handleCellDragLeave(e, col.dateStr)}
                  onDrop={(e) => handleCellDrop(e, col.dateStr)}
                  className={`p-3 min-h-[220px] sm:min-h-[400px] flex flex-col transition relative ${
                    isOverTarget
                      ? 'bg-sky-100/90 ring-2 ring-sky-600 shadow-inner z-10 border-sky-400'
                      : draggingTaskId !== null
                      ? 'border border-dashed border-slate-300 hover:bg-sky-50/40'
                      : isToday
                      ? 'bg-amber-50/20'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex sm:flex-col items-center justify-between sm:justify-center text-center pb-2.5 border-b border-slate-100 mb-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase">{col.dayName}</div>
                    <div
                      className={`text-sm sm:text-lg font-bold inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full sm:mt-1 ${
                        isToday ? 'bg-sky-700 text-white' : 'text-slate-900'
                      }`}
                    >
                      {col.dayNum}
                    </div>
                  </div>

                  {isOverTarget && (
                    <div className="p-2 mb-2 bg-sky-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md animate-pulse shrink-0">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>Move to {col.dayName}</span>
                    </div>
                  )}

                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {colEvents.length === 0 ? (
                      <div className="text-center py-6 sm:py-8 text-[11px] text-slate-400">No events</div>
                    ) : (
                      colEvents.map((ev) => {
                        const isDraggable = !!((ev.taskId || ev.applicationId) && !ev.isCompleted);
                        const isBeingDragged = !!(ev.taskId && draggingTaskId === ev.taskId);
                        const isRejected = !ev.isCompleted && (ev.applicationStatus === 'Rejected' || /^Rejected\s*-/i.test(ev.title || ''));

                        return (
                          <div
                            key={ev.id}
                            draggable={isDraggable}
                            onDragStart={(e) => isDraggable && handleDragStart(e, ev)}
                            onDragEnd={handleDragEnd}
                            title={isDraggable ? 'Drag to any calendar day to reschedule' : undefined}
                            className={`p-2.5 rounded-xl border text-xs shadow-2xs space-y-1.5 transition select-none group/weekpill ${
                              isBeingDragged
                                ? 'opacity-25 scale-95 border-dashed border-sky-500 bg-sky-100'
                                : isDraggable
                                ? 'cursor-grab active:cursor-grabbing hover:border-sky-400 hover:shadow-xs'
                                : ''
                            } ${
                              ev.isCompleted
                                ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                                : isRejected
                                ? 'bg-rose-100/85 border-rose-300 border-l-4 border-l-rose-500 text-rose-900 font-semibold'
                                : ev.type === 'delivery'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                                : ev.type === 'hotel_checkout'
                                ? 'bg-teal-50 border-teal-300 text-teal-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-900'
                            }`}
                          >
                            <div className="flex items-start gap-1.5">
                              {isDraggable && (
                                <GripVertical className="hidden sm:block w-3.5 h-3.5 text-slate-400 group-hover/weekpill:text-sky-600 mt-0.5 shrink-0 opacity-40 group-hover/weekpill:opacity-100 transition" />
                              )}

                              {ev.taskId ? (
                                <button
                                  onClick={() => ev.taskId && onToggleTask(ev.taskId)}
                                  className="mt-0.5 shrink-0 cursor-pointer"
                                  title={ev.isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                                >
                                  {ev.isCompleted ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-400 hover:text-sky-600" />
                                  )}
                                </button>
                              ) : ev.rawBooking ? (
                                <button
                                  onClick={() => ev.rawBooking && handleToggleHotelBooking(ev.rawBooking)}
                                  className="mt-0.5 shrink-0 cursor-pointer"
                                  title={ev.isCompleted ? 'Mark as Confirmed' : 'Mark as Checked Out (Completed)'}
                                >
                                  {ev.isCompleted ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-teal-600" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-teal-500 hover:text-teal-700" />
                                  )}
                                </button>
                              ) : ev.rawApp ? (
                                <button
                                  onClick={() => ev.rawApp && onToggleApplicationDelivery && onToggleApplicationDelivery(ev.rawApp)}
                                  className="mt-0.5 shrink-0 cursor-pointer text-amber-500 hover:text-amber-600"
                                  title={ev.isCompleted ? 'Returned' : 'Mark as Returned'}
                                >
                                  {ev.isCompleted ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-400 hover:text-amber-500" />
                                  )}
                                </button>
                              ) : null}
                              <div className="font-semibold text-xs leading-tight flex-1">{ev.title}</div>
                            </div>

                            {ev.clientName && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="truncate">{ev.clientName}</span>
                              </div>
                            )}

                            {renderQuickStatusControls(ev, 'compact')}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button
                    onClick={() => onOpenNewTask(col.dateStr)}
                    className="mt-3 w-full py-1.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl font-semibold transition cursor-pointer"
                  >
                    + Add Task
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: Day View */}
      {calendarView === 'day' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900">
                {currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-500">
                {(eventsByDate[formatLocalDate(currentDate)] || []).length} scheduled operations for this day
              </p>
            </div>
            <button
              onClick={() => onOpenNewTask(formatLocalDate(currentDate))}
              className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task Today</span>
            </button>
          </div>

          <div className="space-y-3">
            {(eventsByDate[formatLocalDate(currentDate)] || []).length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No tasks or passport deliveries scheduled for this day. Click &quot;Add Task Today&quot; to create one.
              </div>
            ) : (
              (eventsByDate[formatLocalDate(currentDate)] || []).map((ev) => {
                const isRejected = !ev.isCompleted && (ev.applicationStatus === 'Rejected' || /^Rejected\s*-/i.test(ev.title || ''));
                return (
                <div
                  key={ev.id}
                  className={`p-3.5 sm:p-4 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-2xs ${
                    isRejected
                      ? 'bg-rose-50/75 border-rose-300 border-l-4 border-l-rose-500 hover:bg-rose-50'
                      : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-sky-300'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {ev.taskId ? (
                      <button
                        onClick={() => ev.taskId && onToggleTask(ev.taskId)}
                        className="mt-0.5 sm:mt-0 text-slate-400 hover:text-emerald-600 transition cursor-pointer shrink-0"
                        title={ev.isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                      >
                        {ev.isCompleted ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    ) : ev.rawBooking ? (
                      <button
                        onClick={() => ev.rawBooking && handleToggleHotelBooking(ev.rawBooking)}
                        className="mt-0.5 sm:mt-0 text-teal-500 hover:text-teal-700 transition cursor-pointer shrink-0"
                        title={ev.isCompleted ? 'Mark as Confirmed' : 'Mark as Checked Out (Completed)'}
                      >
                        {ev.isCompleted ? (
                          <CheckSquare className="w-5 h-5 text-teal-600" />
                        ) : (
                          <Square className="w-5 h-5 text-teal-500 hover:text-teal-700" />
                        )}
                      </button>
                    ) : ev.rawApp ? (
                      <button
                        onClick={() => ev.rawApp && onToggleApplicationDelivery && onToggleApplicationDelivery(ev.rawApp)}
                        className="mt-0.5 sm:mt-0 text-amber-500 hover:text-amber-600 transition cursor-pointer shrink-0"
                        title={ev.isCompleted ? 'Returned' : 'Mark as Returned'}
                      >
                        {ev.isCompleted ? (
                          <CheckSquare className="w-5 h-5 text-amber-500" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400 hover:text-amber-500" />
                        )}
                      </button>
                    ) : null}
                    {ev.clientName && (
                      <ClientAvatar
                        fullName={ev.clientName}
                        photoUrl={ev.clientPhotoUrl}
                        size="md"
                        allowPreview={true}
                        className="shadow-xs shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className={`font-bold text-sm ${ev.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {ev.title}
                      </div>
                      {ev.subtitle && <div className="text-xs text-slate-500 mt-0.5">{ev.subtitle}</div>}
                    </div>
                  </div>

                  <div className="pt-2.5 sm:pt-0 border-t border-slate-200/70 sm:border-t-0 flex items-center gap-2 flex-wrap justify-between sm:justify-end">
                    {renderQuickStatusControls(ev, 'light')}
                    {ev.passportNumber && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyPassport(e, ev.passportNumber!, `day-${ev.id}`)}
                        title={`Copy Passport Number: ${ev.passportNumber}`}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          copiedEventId === `day-${ev.id}`
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200'
                        }`}
                      >
                        {copiedEventId === `day-${ev.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-sky-600" />
                            <span className="font-mono">{ev.passportNumber}</span>
                          </>
                        )}
                      </button>
                    )}
                    {ev.rawBooking && (
                      <button
                        onClick={() => ev.rawBooking && setSelectedHotelBooking(ev.rawBooking)}
                        className="px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Hotel Details
                      </button>
                    )}
                    {ev.clientId && (
                      <button
                        onClick={() => ev.clientId && onOpenClient(ev.clientId)}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        View Profile
                      </button>
                    )}
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW: Agenda View */}
      {calendarView === 'agenda' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No matching scheduled events found.
            </div>
          ) : (
            filteredEvents
              .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                const aComp = a.isCompleted ? 1 : 0;
                const bComp = b.isCompleted ? 1 : 0;
                return aComp - bComp;
              })
              .map((ev) => {
                const priorityBadge = ev.priority ? getPriorityBadge(ev.priority) : null;
                const isOverdue = !ev.isCompleted && ev.date < todayStr;
                const isRejected = !ev.isCompleted && (ev.applicationStatus === 'Rejected' || /^Rejected\s*-/i.test(ev.title || ''));

                return (
                  <div
                    key={ev.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      isRejected
                        ? 'bg-rose-50/65 border-l-4 border-l-rose-500 hover:bg-rose-50/90'
                        : isOverdue
                        ? 'bg-red-50/30 hover:bg-slate-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {ev.taskId ? (
                        <button
                          onClick={() => ev.taskId && onToggleTask(ev.taskId)}
                          className="mt-1 text-slate-400 hover:text-emerald-600 transition shrink-0 cursor-pointer"
                          title={ev.isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                        >
                          {ev.isCompleted ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      ) : ev.rawBooking ? (
                        <button
                          onClick={() => ev.rawBooking && handleToggleHotelBooking(ev.rawBooking)}
                          className="mt-1 text-teal-500 hover:text-teal-700 transition shrink-0 cursor-pointer"
                          title={ev.isCompleted ? 'Mark as Confirmed' : 'Mark as Checked Out (Completed)'}
                        >
                          {ev.isCompleted ? (
                            <CheckSquare className="w-5 h-5 text-teal-600" />
                          ) : (
                            <Square className="w-5 h-5 text-teal-500 hover:text-teal-700" />
                          )}
                        </button>
                      ) : ev.rawApp ? (
                        <button
                          onClick={() => ev.rawApp && onToggleApplicationDelivery && onToggleApplicationDelivery(ev.rawApp)}
                          className="mt-1 text-amber-500 hover:text-amber-600 transition shrink-0 cursor-pointer"
                          title={ev.isCompleted ? 'Returned' : 'Mark as Returned'}
                        >
                          {ev.isCompleted ? (
                            <CheckSquare className="w-5 h-5 text-amber-500" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400 hover:text-amber-500" />
                          )}
                        </button>
                      ) : null}

                      {ev.clientName && (
                        <ClientAvatar
                          fullName={ev.clientName}
                          photoUrl={ev.clientPhotoUrl}
                          size="sm"
                          allowPreview={true}
                          className="shrink-0 cursor-pointer shadow-xs"
                        />
                      )}

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-semibold text-sm ${
                              ev.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {ev.title}
                          </span>
                          {isOverdue && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md">
                              OVERDUE
                            </span>
                          )}
                        </div>

                        {ev.subtitle && <div className="text-xs text-slate-500 mt-0.5">{ev.subtitle}</div>}

                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-800 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {ev.date}
                          </span>
                          {ev.clientName && (
                            <>
                              <span>•</span>
                              <button
                                onClick={() => ev.clientId && onOpenClient(ev.clientId)}
                                className="text-sky-700 hover:underline font-medium cursor-pointer"
                              >
                                {ev.clientName} {ev.clientCode ? `(${ev.clientCode})` : ''}
                              </button>
                            </>
                          )}
                          {ev.assignedUserName && (
                            <>
                              <span>•</span>
                              <span>Assigned: {ev.assignedUserName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="w-full sm:w-auto pt-2.5 sm:pt-0 border-t border-slate-100 sm:border-t-0 flex items-center gap-2 self-end sm:self-auto flex-wrap justify-between sm:justify-end">
                      {renderQuickStatusControls(ev, 'light')}
                      {priorityBadge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge.bg}`}>
                          {ev.priority}
                        </span>
                      )}

                      {ev.passportNumber && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyPassport(e, ev.passportNumber!, `agenda-${ev.id}`)}
                          title={`Copy Passport Number: ${ev.passportNumber}`}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            copiedEventId === `agenda-${ev.id}`
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'text-slate-700 bg-white hover:bg-sky-50 hover:text-sky-700 border-slate-200'
                          }`}
                        >
                          {copiedEventId === `agenda-${ev.id}` ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-sky-600" />
                              <span className="font-mono">{ev.passportNumber}</span>
                            </>
                          )}
                        </button>
                      )}

                      {ev.rawBooking && (
                        <button
                          onClick={() => ev.rawBooking && setSelectedHotelBooking(ev.rawBooking)}
                          className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition cursor-pointer"
                        >
                          Hotel Details
                        </button>
                      )}

                      {ev.clientId && (
                        <button
                          onClick={() => ev.clientId && onOpenClient(ev.clientId)}
                          className="px-2.5 py-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition cursor-pointer"
                        >
                          View Client
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 📅 SELECTED DAY QUICK INSPECTOR MODAL / MOBILE SHEET */}
      {/* ======================================================== */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[88vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Pill Handle */}
            <div className="sm:hidden pt-2 pb-1 bg-slate-900 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
            </div>

            <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-4 h-4 text-sky-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate">
                    Schedule for {selectedDate}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {selectedDayEvents.length} scheduled item(s) on this date
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const prevDate = shiftDateString(selectedDate, -1);
                    setSelectedDate(prevDate);
                    const [py, pm, pd] = prevDate.split('-').map(Number);
                    if (py && pm && (py !== currentDate.getFullYear() || pm - 1 !== currentDate.getMonth())) {
                      setCurrentDate(new Date(py, pm - 1, pd || 1));
                    }
                  }}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer active:scale-95"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextDate = shiftDateString(selectedDate, 1);
                    setSelectedDate(nextDate);
                    const [ny, nm, nd] = nextDate.split('-').map(Number);
                    if (ny && nm && (ny !== currentDate.getFullYear() || nm - 1 !== currentDate.getMonth())) {
                      setCurrentDate(new Date(ny, nm - 1, nd || 1));
                    }
                  }}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer active:scale-95"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDate(null);
                  }}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg transition cursor-pointer ml-1"
                  aria-label="Close schedule drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No tasks or deliveries scheduled on {selectedDate}.
                </div>
              ) : (
                selectedDayEvents.map((ev) => {
                  const isRejected = !ev.isCompleted && (ev.applicationStatus === 'Rejected' || /^Rejected\s*-/i.test(ev.title || ''));
                  return (
                  <div
                    key={ev.id}
                    className={`p-3.5 border rounded-2xl flex flex-col gap-3 shadow-2xs transition ${
                      isRejected
                        ? 'bg-rose-50/80 border-rose-300 border-l-4 border-l-rose-500'
                        : 'bg-slate-50/90 border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Section: Checkbox, Avatar, Title, Subtitle, Quick Status Controls */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      {ev.taskId ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ev.taskId) onToggleTask(ev.taskId);
                          }}
                          className="mt-0.5 shrink-0 cursor-pointer"
                          title={ev.isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                        >
                          {ev.isCompleted ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 hover:text-sky-600" />
                          )}
                        </button>
                      ) : ev.rawBooking ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ev.rawBooking) handleToggleHotelBooking(ev.rawBooking);
                          }}
                          className="mt-0.5 shrink-0 cursor-pointer"
                          title={ev.isCompleted ? 'Mark as Confirmed' : 'Mark as Checked Out (Completed)'}
                        >
                          {ev.isCompleted ? (
                            <CheckSquare className="w-4 h-4 text-teal-600" />
                          ) : (
                            <Square className="w-4 h-4 text-teal-500 hover:text-teal-700" />
                          )}
                        </button>
                      ) : ev.rawApp ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ev.rawApp && onToggleApplicationDelivery) onToggleApplicationDelivery(ev.rawApp);
                          }}
                          className="mt-0.5 shrink-0 cursor-pointer text-amber-500 hover:text-amber-600"
                          title={ev.isCompleted ? 'Returned' : 'Mark as Returned'}
                        >
                          {ev.isCompleted ? (
                            <CheckSquare className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 hover:text-amber-500" />
                          )}
                        </button>
                      ) : null}
                      {ev.clientName && (
                        <ClientAvatar
                          fullName={ev.clientName}
                          photoUrl={ev.clientPhotoUrl}
                          size="sm"
                          allowPreview={true}
                          className="shrink-0 cursor-pointer shadow-xs"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className={`font-bold text-xs sm:text-sm leading-snug ${ev.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {ev.title}
                        </div>
                        {ev.subtitle && (
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            {ev.subtitle}
                          </div>
                        )}
                        {ev.comment && (
                          <div className="text-[11px] text-amber-900 italic mt-1.5 bg-amber-50/80 p-2 rounded-lg border border-amber-200/70">
                            Note: {ev.comment}
                          </div>
                        )}
                        <div className="mt-2.5">
                          {renderQuickStatusControls(ev, 'compact')}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar: Passport Copy + Client / Hotel Actions (div:nth-of-type(2)) */}
                    <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
                      {ev.passportNumber && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyPassport(e, ev.passportNumber!, `modal-${ev.id}`)}
                          title={`Copy Passport Number: ${ev.passportNumber}`}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            copiedEventId === `modal-${ev.id}`
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 shadow-2xs'
                          }`}
                        >
                          {copiedEventId === `modal-${ev.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-sky-600" />
                              <span className="font-mono">{ev.passportNumber}</span>
                            </>
                          )}
                        </button>
                      )}
                      {ev.rawBooking && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(null);
                            if (ev.rawBooking) setSelectedHotelBooking(ev.rawBooking);
                          }}
                          className="px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 rounded-xl text-xs font-bold cursor-pointer transition active:scale-95"
                        >
                          Hotel Details
                        </button>
                      )}
                      {(ev.clientId || ev.clientName || ev.passportNumber) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetClientId =
                              ev.clientId ||
                              (ev.passportNumber
                                ? clients.find(
                                    (c) =>
                                      (c.passport_number || '').trim().toUpperCase() ===
                                      ev.passportNumber!.trim().toUpperCase()
                                  )?.id
                                : undefined) ||
                              (ev.clientName
                                ? clients.find(
                                    (c) =>
                                      (c.full_name || '').trim().toLowerCase() ===
                                      ev.clientName!.trim().toLowerCase()
                                  )?.id
                                : undefined);
                            if (targetClientId) {
                              setSelectedDate(null);
                              onOpenClient(targetClientId);
                            }
                          }}
                          className="ml-auto px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 text-white border border-sky-700 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                        >
                          <span>Client Profile</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const target = selectedDate;
                  setSelectedDate(null);
                  onOpenNewTask(target);
                }}
                className="flex-1 sm:flex-initial justify-center px-4 py-2.5 sm:py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Task on {selectedDate}</span>
              </button>
              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Floating Drag & Drop Reschedule Notification Toast with 1-Click Undo */}
      {rescheduleFeedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs max-w-md">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white truncate">
                Task Rescheduled!
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                &ldquo;{rescheduleFeedback.taskTitle}&rdquo; moved to <span className="font-bold text-sky-300 font-mono">{rescheduleFeedback.toDay}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUndoReschedule}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 font-bold rounded-xl text-xs border border-slate-700 flex items-center gap-1 cursor-pointer transition active:scale-95 shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={() => setRescheduleFeedback(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      {/* Floating Error Toast Notification */}
      {calendarError && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="bg-rose-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-rose-800 flex items-center gap-3 text-xs max-w-md">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 border border-rose-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white">Calendar Action Notice</div>
              <div className="text-[11px] text-rose-200">{calendarError}</div>
            </div>
            <button
              type="button"
              onClick={() => setCalendarError(null)}
              className="p-1 text-rose-300 hover:text-white rounded-lg transition cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Saving / Updating indicator */}
      {isUpdatingDate !== null && (
        <div className="fixed top-6 right-6 z-50 bg-sky-950 text-sky-200 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xl border border-sky-800 flex items-center gap-2 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
          <span>Rescheduling task...</span>
        </div>
      )}
      {/* Hotel Booking Detail Modal */}
      {selectedHotelBooking && (
        <HotelBookingDetailModal
          isOpen={!!selectedHotelBooking}
          onClose={() => setSelectedHotelBooking(null)}
          booking={selectedHotelBooking}
          onUpdated={() => {
            setSelectedHotelBooking(null);
            if (onRefreshData) onRefreshData(true);
          }}
          onOpenClient={onOpenClient}
        />
      )}
    </div>
  );
};
