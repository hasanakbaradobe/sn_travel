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
  RotateCcw,
  Loader2,
  GripVertical,
} from 'lucide-react';
import { Task, VisaApplication, Client, User as UserType, HotelBooking } from '../types';
import { getPriorityBadge, STATUS_CONFIG } from '../utils/status';
import { ClientAvatar } from '../components/ClientAvatar';
import { api } from '../services/api';

export interface CalendarEvent {
  id: string; // unique ID e.g. "task-12" or "delivery-4" or "hotel-checkout-5"
  type: 'task' | 'delivery' | 'hotel_checkout' | 'passport_expiry';
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
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'task' | 'hotel' | 'urgent'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

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
      await api.updateTask(taskId, { due_date: newDueDate });

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
      const baseDate = new Date(task.due_date > todayStr ? task.due_date : todayStr);
      baseDate.setDate(baseDate.getDate() + daysToAdd);
      const newDueDate = baseDate.toISOString().split('T')[0];

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
    if (!ev.taskId) return;
    setDraggingTaskId(ev.taskId);
    setDraggingTaskTitle(ev.title);
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ taskId: ev.taskId, originalDate: ev.date, title: ev.title })
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

    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        if (parsed.taskId) {
          taskId = parsed.taskId;
          taskTitle = parsed.title;
        }
      }
    } catch (_) {
      // Use fallback from state
    }

    if (taskId) {
      handleRescheduleTask(taskId, targetDate, taskTitle);
    }
    handleDragEnd();
  };

  // Unified Event Registry
  const allEvents: CalendarEvent[] = useMemo(() => {
    const list: CalendarEvent[] = [];
    const clientPhotoMap = new Map<number, string | null>();
    clients.forEach((c) => {
      clientPhotoMap.set(c.id, c.photo_url || null);
    });

    const cleanDate = (val?: string | null): string => {
      if (!val) return '';
      const s = String(val).trim();
      if (s.includes('T')) return s.split('T')[0];
      if (s.includes(' ')) return s.split(' ')[0];
      return s.slice(0, 10);
    };

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
      const photo = t.client_id ? clientPhotoMap.get(t.client_id) : null;
      list.push({
        id: `task-${t.id}`,
        type: isDelivery ? 'delivery' : 'task',
        title: t.title,
        subtitle: t.client_name ? `${t.client_name} (${t.passport_number || t.client_code || ''})` : undefined,
        date: cleanDate(t.due_date),
        priority: t.priority,
        status: t.status,
        isCompleted: t.status === 'Completed',
        clientId: t.client_id || undefined,
        clientName: t.client_name || undefined,
        clientCode: t.client_code || undefined,
        clientPhotoUrl: photo,
        passportNumber: t.passport_number || undefined,
        applicationId: t.application_id || undefined,
        applicationCode: t.application_code || undefined,
        assignedUserName: t.assigned_user_name || undefined,
        taskId: t.id,
        rawTask: t,
      });
    });

    // 2. Visa Application Delivery Dates
    const existingDeliveryAppIds = new Set(
      localTasks.filter((t) => t.is_delivery_task === 1 && t.application_id).map((t) => t.application_id)
    );

    applications.forEach((app) => {
      if (app.delivery_date && !existingDeliveryAppIds.has(app.id)) {
        const photo = app.client_photo_url || (app.client_id ? clientPhotoMap.get(app.client_id) : null);
        list.push({
          id: `app-delivery-${app.id}`,
          type: 'delivery',
          title: `📦 Delivery: ${app.client_name || 'Client'} (${app.visa_type_name || 'Visa'})`,
          subtitle: `Passport: ${app.passport_number || ''} • Status: ${app.status}`,
          date: cleanDate(app.delivery_date),
          priority: 'High',
          status: app.status,
          isCompleted: app.status === 'Pending Collection' || app.status === 'Returned',
          clientId: app.client_id,
          clientName: app.client_name,
          clientCode: app.client_code,
          clientPhotoUrl: photo,
          passportNumber: app.passport_number,
          applicationId: app.id,
          applicationCode: app.application_id,
          visaTypeName: app.visa_type_name,
          assignedUserName: app.assigned_user_name || undefined,
          rawApp: app,
        });
      }
    });

    // 3. Hotel Bookings Check-Out Dates
    hotelBookings.forEach((b) => {
      const photo = b.client_photo_url || (b.client_id ? clientPhotoMap.get(b.client_id) : null);
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
        passportNumber: b.passport_number,
        hotelName: b.hotel_name,
        roomTypeName: b.room_type_name,
        comment: b.comment || undefined,
        taskId: b.checkout_task_id || undefined,
        rawBooking: b,
      });
    });

    return list;
  }, [localTasks, applications, clients, hotelBookings]);

  // Today's Operational Breakdown
  const todayEvents = useMemo(() => {
    return allEvents.filter((e) => e.date === todayStr);
  }, [allEvents, todayStr]);

  const overdueEvents = useMemo(() => {
    return allEvents.filter((e) => !e.isCompleted && e.date < todayStr);
  }, [allEvents, todayStr]);

  const tomorrowEvents = useMemo(() => {
    return allEvents.filter((e) => e.date === tomorrowStr);
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

  // Group filtered events by date string
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
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
      const str = d.toISOString().split('T')[0];
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-700 text-white flex items-center justify-center shadow-xs">
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Calendar View Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold border border-slate-200 shadow-2xs">
            <button
              onClick={() => setCalendarView('month')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                calendarView === 'month' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
              <span>Month</span>
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                calendarView === 'week' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>Week</span>
            </button>
            <button
              onClick={() => setCalendarView('day')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                calendarView === 'day' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>Day</span>
            </button>
            <button
              onClick={() => setCalendarView('agenda')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                calendarView === 'agenda' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5 text-sky-600" />
              <span>Agenda</span>
            </button>
          </div>

          {/* New Task Button */}
          <button
            onClick={() => onOpenNewTask(selectedDate || todayStr)}
            className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🚀 TODAY'S DAILY OPERATIONS COMMAND CENTER (Interactive Hub) */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-800 text-white p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Daily Operations Plan
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 font-mono">
                  {new Date().toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Execute today&apos;s embassy runs, collection tasks, and customer handoffs.
              </p>
            </div>
          </div>

          {/* Today's Progress Bar */}
          <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700/80">
            <div className="text-right">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 justify-end">
                <span>{todayCompletedCount} of {todayEvents.length} Done</span>
                <span className="text-emerald-400 font-mono">({todayProgressPercent}%)</span>
              </div>
              <div className="text-[10px] text-slate-400">Today&apos;s Completion Rate</div>
            </div>
            <div className="w-20 sm:w-28 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${todayProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Hub Tabs / Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold scrollbar-none">
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
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
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
              const isDraggable = !!(ev.taskId && !ev.isCompleted);
              const isBeingDragged = draggingTaskId === ev.taskId;

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
                      : isOverdue
                      ? 'bg-rose-950/30 border-rose-800/60 hover:border-rose-600'
                      : ev.type === 'delivery'
                      ? 'bg-emerald-950/30 border-emerald-800/60 hover:border-emerald-500'
                      : ev.type === 'hotel_checkout'
                      ? 'bg-teal-950/30 border-teal-800/60 hover:border-teal-500'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Drag Grip Handle */}
                    {isDraggable && (
                      <div
                        className="text-slate-500 group-hover/hub:text-sky-400 mt-1 shrink-0 cursor-grab active:cursor-grabbing transition"
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
                        className="ring-1 ring-slate-700 shadow-xs"
                      />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-semibold text-xs sm:text-sm ${
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
                        <div className="text-xs text-slate-400 mt-0.5 truncate">{ev.subtitle}</div>
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

                  {/* Right Actions: 1-Click Postpone & Shortcuts */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
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

                    {ev.clientId && (
                      <button
                        type="button"
                        onClick={() => ev.clientId && onOpenClient(ev.clientId)}
                        className="px-2.5 py-1 bg-sky-600/80 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Client
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
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 leading-tight">{metrics.total}</div>
            <div className="text-[11px] text-slate-500">Scheduled This Month</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-900 leading-tight">{metrics.deliveries}</div>
            <div className="text-[11px] text-emerald-700 font-medium">Passport Deliveries</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-amber-900 leading-tight">{metrics.urgent}</div>
            <div className="text-[11px] text-amber-700 font-medium">Urgent Deadlines</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-red-200 bg-red-50/20 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-red-800 leading-tight">{metrics.overdue}</div>
            <div className="text-[11px] text-red-600 font-medium">Overdue Items</div>
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
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search task, client, passport, app ID..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Event Types</option>
              <option value="hotel">🏨 Hotel Check-Outs</option>
              <option value="delivery">📦 Deliveries Only</option>
              <option value="task">📋 Internal Tasks</option>
              <option value="urgent">⚡ Urgent / High Priority</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
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
              className="px-2.5 py-1 text-xs text-sky-700 hover:text-sky-900 font-semibold cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Month / Week / Day Navigation Header */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={prevPeriod}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextPeriod}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition active:scale-95 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 capitalize">
              {calendarView === 'month' && monthName}
              {calendarView === 'week' && `Week of ${daysInWeek[0]?.dateStr} to ${daysInWeek[6]?.dateStr}`}
              {calendarView === 'day' && currentDate.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {calendarView === 'agenda' && `Schedule Overview (${monthName})`}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/90 text-slate-600 rounded-xl text-[11px] font-medium border border-slate-200">
            <GripVertical className="w-3.5 h-3.5 text-sky-600" />
            <span>Drag tasks to reschedule</span>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl border border-sky-200 transition active:scale-95 cursor-pointer"
          >
            Today ({todayStr})
          </button>
        </div>
      </div>

      {/* VIEW: Month View */}
      {calendarView === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Day Names Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[580px]">
            {daysInMonth.map((cell, idx) => {
              const cellEvents = eventsByDate[cell.dateStr] || [];
              const isToday = cell.dateStr === todayStr;
              const isSelected = selectedDate === cell.dateStr;
              const isOverTarget = dragOverDate === cell.dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  onDragOver={(e) => handleCellDragOver(e, cell.dateStr)}
                  onDragLeave={(e) => handleCellDragLeave(e, cell.dateStr)}
                  onDrop={(e) => handleCellDrop(e, cell.dateStr)}
                  className={`p-1.5 sm:p-2 min-h-[110px] flex flex-col justify-between transition cursor-pointer group relative ${
                    isOverTarget
                      ? 'bg-sky-100/90 ring-2 ring-sky-600 shadow-inner z-10 border-sky-400'
                      : draggingTaskId !== null
                      ? 'border border-dashed border-slate-300 hover:bg-sky-50/50'
                      : ''
                  } ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-50/50 text-slate-300'
                      : isSelected
                      ? 'bg-sky-50/70 ring-2 ring-sky-600 inset-0'
                      : isToday
                      ? 'bg-amber-50/30'
                      : 'bg-white hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
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
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 font-bold rounded-md">
                        {cellEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Event Pills */}
                  <div className="space-y-1 overflow-y-auto max-h-24">
                    {cellEvents.slice(0, 3).map((ev) => {
                      const isCompleted = ev.isCompleted;
                      const isDelivery = ev.type === 'delivery';
                      const isHotel = ev.type === 'hotel_checkout';
                      const isDraggable = !!(ev.taskId && !isCompleted);
                      const isBeingDragged = draggingTaskId === ev.taskId;

                      return (
                        <div
                          key={ev.id}
                          draggable={isDraggable}
                          onDragStart={(e) => isDraggable && handleDragStart(e, ev)}
                          onDragEnd={handleDragEnd}
                          title={isDraggable ? 'Drag onto any day to reschedule' : undefined}
                          className={`text-[11px] p-1.5 rounded-lg border text-left transition flex items-start gap-1 shadow-2xs group/pill select-none ${
                            isBeingDragged
                              ? 'opacity-25 scale-95 border-dashed border-sky-500 bg-sky-100'
                              : isDraggable
                              ? 'cursor-grab active:cursor-grabbing hover:border-sky-400 hover:shadow-xs'
                              : ''
                          } ${
                            isCompleted
                              ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                              : isHotel
                              ? 'bg-teal-50 border-teal-300 text-teal-950 font-semibold'
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
                            <GripVertical className="w-3 h-3 text-slate-400 group-hover/pill:text-sky-600 mt-0.5 shrink-0 opacity-0 group-hover/pill:opacity-100 transition" />
                          )}

                          {ev.taskId ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (ev.taskId) onToggleTask(ev.taskId);
                              }}
                              className="mt-0.5 shrink-0 cursor-pointer"
                            >
                              {isCompleted ? (
                                <CheckSquare className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Square className="w-3 h-3 text-slate-400 hover:text-sky-600" />
                              )}
                            </button>
                          ) : (
                            <span className="mt-0.5 text-xs">
                              {isDelivery ? '📦' : '🏨'}
                            </span>
                          )}

                          <span className="truncate flex-1 font-medium">{ev.title}</span>
                        </div>
                      );
                    })}

                    {cellEvents.length > 3 && (
                      <div className="text-[10px] text-slate-500 font-semibold text-center py-0.5">
                        +{cellEvents.length - 3} more items
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
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-sky-700 font-semibold self-center py-0.5 hover:underline transition cursor-pointer"
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
            {daysInWeek.map((col, idx) => {
              const colEvents = eventsByDate[col.dateStr] || [];
              const isToday = col.isToday;
              const isOverTarget = dragOverDate === col.dateStr;

              return (
                <div
                  key={idx}
                  onDragOver={(e) => handleCellDragOver(e, col.dateStr)}
                  onDragLeave={(e) => handleCellDragLeave(e, col.dateStr)}
                  onDrop={(e) => handleCellDrop(e, col.dateStr)}
                  className={`p-3 min-h-[400px] flex flex-col transition relative ${
                    isOverTarget
                      ? 'bg-sky-100/90 ring-2 ring-sky-600 shadow-inner z-10 border-sky-400'
                      : draggingTaskId !== null
                      ? 'border border-dashed border-slate-300 hover:bg-sky-50/40'
                      : isToday
                      ? 'bg-amber-50/20'
                      : 'bg-white'
                  }`}
                >
                  <div className="text-center pb-2.5 border-b border-slate-100 mb-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase">{col.dayName}</div>
                    <div
                      className={`text-lg font-bold inline-flex items-center justify-center w-8 h-8 rounded-full mt-1 ${
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
                      <div className="text-center py-8 text-[11px] text-slate-400">No events</div>
                    ) : (
                      colEvents.map((ev) => {
                        const isDraggable = !!(ev.taskId && !ev.isCompleted);
                        const isBeingDragged = draggingTaskId === ev.taskId;

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
                                : ev.type === 'delivery'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                                : ev.type === 'hotel_checkout'
                                ? 'bg-teal-50 border-teal-300 text-teal-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-900'
                            }`}
                          >
                            <div className="flex items-start gap-1.5">
                              {isDraggable && (
                                <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover/weekpill:text-sky-600 mt-0.5 shrink-0 opacity-40 group-hover/weekpill:opacity-100 transition" />
                              )}

                              {ev.taskId && (
                                <button
                                  onClick={() => ev.taskId && onToggleTask(ev.taskId)}
                                  className="mt-0.5 shrink-0 cursor-pointer"
                                >
                                  {ev.isCompleted ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-400 hover:text-sky-600" />
                                  )}
                                </button>
                              )}
                              <div className="font-semibold text-xs leading-tight flex-1">{ev.title}</div>
                            </div>

                            {ev.clientName && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="truncate">{ev.clientName}</span>
                              </div>
                            )}
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900">
                {currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-500">
                {(eventsByDate[currentDate.toISOString().split('T')[0]] || []).length} scheduled operations for this day
              </p>
            </div>
            <button
              onClick={() => onOpenNewTask(currentDate.toISOString().split('T')[0])}
              className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task Today</span>
            </button>
          </div>

          <div className="space-y-3">
            {(eventsByDate[currentDate.toISOString().split('T')[0]] || []).length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No tasks or passport deliveries scheduled for this day. Click &quot;Add Task Today&quot; to create one.
              </div>
            ) : (
              (eventsByDate[currentDate.toISOString().split('T')[0]] || []).map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white hover:border-sky-300 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    {ev.taskId && (
                      <button
                        onClick={() => ev.taskId && onToggleTask(ev.taskId)}
                        className="text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                      >
                        {ev.isCompleted ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    )}
                    {ev.clientName && (
                      <ClientAvatar
                        fullName={ev.clientName}
                        photoUrl={ev.clientPhotoUrl}
                        size="md"
                        allowPreview={true}
                        className="shadow-xs"
                      />
                    )}
                    <div>
                      <div className={`font-bold text-sm ${ev.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {ev.title}
                      </div>
                      {ev.subtitle && <div className="text-xs text-slate-500 mt-0.5">{ev.subtitle}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
              ))
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
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((ev) => {
                const priorityBadge = ev.priority ? getPriorityBadge(ev.priority) : null;
                const isOverdue = !ev.isCompleted && ev.date < todayStr;

                return (
                  <div
                    key={ev.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition ${
                      isOverdue ? 'bg-red-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {ev.taskId && (
                        <button
                          onClick={() => ev.taskId && onToggleTask(ev.taskId)}
                          className="mt-1 text-slate-400 hover:text-emerald-600 transition shrink-0 cursor-pointer"
                        >
                          {ev.isCompleted ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      )}

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
                        <div className="flex items-center gap-2">
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

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {priorityBadge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge.bg}`}>
                          {ev.priority}
                        </span>
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
      {/* 📅 SELECTED DAY QUICK INSPECTOR MODAL / DRAWER */}
      {/* ======================================================== */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <CalendarIcon className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Schedule for {selectedDate}</h3>
                  <p className="text-[11px] text-slate-300">
                    {selectedDayEvents.length} scheduled item(s) on this date
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No tasks or deliveries scheduled on {selectedDate}.
                </div>
              ) : (
                selectedDayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      {ev.taskId && (
                        <button
                          onClick={() => ev.taskId && onToggleTask(ev.taskId)}
                          className="mt-1 shrink-0 cursor-pointer"
                        >
                          {ev.isCompleted ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 hover:text-sky-600" />
                          )}
                        </button>
                      )}
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
                        <div className={`font-semibold text-xs ${ev.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {ev.title}
                        </div>
                        {ev.subtitle && <div className="text-[11px] text-slate-500 mt-0.5">{ev.subtitle}</div>}
                        {ev.comment && (
                          <div className="text-[11px] text-amber-900 italic mt-1 bg-amber-50/80 p-1.5 rounded-lg border border-amber-200/70">
                            Note: {ev.comment}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {ev.clientId && (
                        <button
                          onClick={() => {
                            setSelectedDate(null);
                            if (ev.clientId) onOpenClient(ev.clientId);
                          }}
                          className="px-2 py-1 bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Client
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  const target = selectedDate;
                  setSelectedDate(null);
                  onOpenNewTask(target);
                }}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Task on {selectedDate}</span>
              </button>
              <button
                onClick={() => setSelectedDate(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
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
    </div>
  );
};
