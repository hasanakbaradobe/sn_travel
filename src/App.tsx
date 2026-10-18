/**
 * SN Travels Agency — China Visa Client Management System
 * Company: SN Travels Agency (sn-travelsagency.com)
 * Internal Staff Portal for Clients, Applications, Tasks, Calendar, and Roles.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './pages/DashboardView';
import { LoginView } from './pages/LoginView';
import { CreateClientModal } from './components/CreateClientModal';
import { NewApplicationModal } from './components/NewApplicationModal';
import { ApplicationStatusModal } from './components/ApplicationStatusModal';
import { NewTaskModal } from './components/NewTaskModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { CommandPalette } from './components/CommandPalette';
import { CreateFollowUpModal } from './components/CreateFollowUpModal';

// High-Performance Code Splitting: Lazy-load secondary views & heavy tools
const ClientsView = React.lazy(() => import('./pages/ClientsView').then(m => ({ default: m.ClientsView })));
const ClientProfileView = React.lazy(() => import('./pages/ClientProfileView').then(m => ({ default: m.ClientProfileView })));
const ApplicationsView = React.lazy(() => import('./pages/ApplicationsView').then(m => ({ default: m.ApplicationsView })));
const HotelsView = React.lazy(() => import('./pages/HotelsView').then(m => ({ default: m.HotelsView })));
const FollowUpsView = React.lazy(() => import('./pages/FollowUpsView').then(m => ({ default: m.FollowUpsView })));
const InvoicesView = React.lazy(() => import('./pages/InvoicesView').then(m => ({ default: m.InvoicesView })));
const CalendarView = React.lazy(() => import('./pages/CalendarView').then(m => ({ default: m.CalendarView })));
const TasksView = React.lazy(() => import('./pages/TasksView').then(m => ({ default: m.TasksView })));
const PublicWebsiteManagementView = React.lazy(() => import('./pages/PublicWebsiteManagementView').then(m => ({ default: m.PublicWebsiteManagementView })));
const SettingsView = React.lazy(() => import('./pages/SettingsView').then(m => ({ default: m.SettingsView })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const PassportScannerModal = React.lazy(() => import('./components/PassportScannerModal').then(m => ({ default: m.PassportScannerModal })));
const DatabaseModal = React.lazy(() => import('./components/DatabaseModal').then(m => ({ default: m.DatabaseModal })));
const ReturnStatusWarningModal = React.lazy(() => import('./components/ReturnStatusWarningModal').then(m => ({ default: m.ReturnStatusWarningModal })));
import { AlertTriangle, X, RotateCcw } from 'lucide-react';
import { api } from './services/api';
import {
  Client,
  VisaApplication,
  ApplicationStatus,
  Task,
  VisaType,
  User,
  DashboardMetrics,
  DatabaseStatus,
  ScannedPassportData,
  Hotel,
  HotelBooking,
  FollowUp,
} from './types';

const ViewLoadingSkeleton: React.FC = () => (
  <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-slate-200 rounded-lg"></div>
        <div className="h-4 w-72 bg-slate-100 rounded-md"></div>
      </div>
      <div className="h-10 w-32 bg-slate-200 rounded-xl"></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="h-28 bg-slate-100 rounded-2xl border border-slate-200/60"></div>
      <div className="h-28 bg-slate-100 rounded-2xl border border-slate-200/60"></div>
      <div className="h-28 bg-slate-100 rounded-2xl border border-slate-200/60"></div>
    </div>
    <div className="h-96 bg-white rounded-2xl border border-slate-200/70 p-6 space-y-4">
      <div className="h-6 w-36 bg-slate-200 rounded"></div>
      <div className="space-y-3 pt-2">
        <div className="h-12 bg-slate-50 rounded-xl"></div>
        <div className="h-12 bg-slate-50 rounded-xl"></div>
        <div className="h-12 bg-slate-50 rounded-xl"></div>
      </div>
    </div>
  </div>
);

export default function App() {
  // Navigation & View State
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [settingsTab, setSettingsTab] = useState<'fields' | 'visatypes' | 'countries' | 'hotels' | 'invoices' | 'users' | 'cleanup' | 'security'>('fields');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  // Secret Login URL & Gatekeeper State
  const [secretGateChecking, setSecretGateChecking] = useState(!Boolean(api.getCurrentUser()));
  const [secretGatePassed, setSecretGatePassed] = useState(false);
  const [verifiedSecretKey, setVerifiedSecretKey] = useState<string | null>(null);

  // Modals State
  const [createClientModalOpen, setCreateClientModalOpen] = useState(false);
  const [passportScannerModalOpen, setPassportScannerModalOpen] = useState(false);
  const [scannedPassportData, setScannedPassportData] = useState<ScannedPassportData | null>(null);
  const [newAppModalOpen, setNewAppModalOpen] = useState(false);
  const [newAppClientInfo, setNewAppClientInfo] = useState<{ id?: number; name?: string }>({});
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTargetApp, setStatusTargetApp] = useState<VisaApplication | null>(null);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [newTaskClientInfo, setNewTaskClientInfo] = useState<{ id?: number; name?: string; dueDate?: string }>({});
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createFollowUpModalOpen, setCreateFollowUpModalOpen] = useState(false);

  // Return Status Warning Modal State & Toast Banner State
  const [returnWarningState, setReturnWarningState] = useState<{
    isOpen: boolean;
    mode?: 'mark_returned' | 'revert_status';
    taskId?: number;
    appId?: number;
    clientName?: string;
    applicationCode?: string;
    taskTitle?: string;
    dueDate?: string;
    previousStatus?: ApplicationStatus;
  } | null>(null);
  const [returnWarningLoading, setReturnWarningLoading] = useState(false);
  const [returnStatusBanner, setReturnStatusBanner] = useState<{
    clientName: string;
    appCode: string;
    mode?: 'returned' | 'revert';
    targetStatus?: ApplicationStatus;
  } | null>(null);

  // Auto-hide return status toast banner after 7 seconds
  useEffect(() => {
    if (!returnStatusBanner) return;
    const timer = setTimeout(() => {
      setReturnStatusBanner(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [returnStatusBanner]);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(api.getCurrentUser());
  const [authChecking, setAuthChecking] = useState(!Boolean(api.getCurrentUser()));

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [applications, setApplications] = useState<VisaApplication[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelBookings, setHotelBookings] = useState<HotelBooking[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);

  // Load all primary data in a single unified bootstrap call (with in-flight deduplication)
  const refreshAllData = async (silent: boolean = false) => {
    if (!api.getCurrentUser()) {
      return;
    }

    if (inFlightRefreshRef.current) {
      return inFlightRefreshRef.current;
    }

    const promise = (async () => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const [bootRes, dbsRes, usrsRes] = await Promise.allSettled([
          api.getBootstrapData(),
          api.getDbStatus(),
          api.getUsers(),
        ]);

        if (bootRes.status === 'fulfilled') {
          const data = bootRes.value;
          if (data.metrics) setMetrics(data.metrics);
          if (Array.isArray(data.clients)) setClients(data.clients);
          if (Array.isArray(data.applications)) setApplications(data.applications);
          if (Array.isArray(data.tasks)) setTasks(data.tasks);
          if (Array.isArray(data.visaTypes)) setVisaTypes(data.visaTypes.filter((v) => v.is_active !== 0));
          if (Array.isArray(data.hotels)) setHotels(data.hotels);
          if (Array.isArray(data.hotelBookings)) setHotelBookings(data.hotelBookings);
          if (Array.isArray(data.followUps)) setFollowUps(data.followUps);
        } else {
          // Fallback if bootstrap fails
          const [mtrRes, clsRes, appsRes, tsksRes, vtsRes, htlsRes, hbkgsRes, fusRes] = await Promise.allSettled([
            api.getDashboardMetrics(),
            api.getClients(),
            api.getApplications(),
            api.getTasks(),
            api.getVisaTypes(true),
            api.getHotels(false),
            api.getHotelBookings(),
            api.getFollowUps(),
          ]);
          if (mtrRes.status === 'fulfilled') setMetrics(mtrRes.value);
          if (clsRes.status === 'fulfilled') setClients(clsRes.value);
          if (appsRes.status === 'fulfilled') setApplications(appsRes.value);
          if (tsksRes.status === 'fulfilled') setTasks(tsksRes.value);
          if (vtsRes.status === 'fulfilled') setVisaTypes(vtsRes.value);
          if (htlsRes.status === 'fulfilled') setHotels(htlsRes.value);
          if (hbkgsRes.status === 'fulfilled') setHotelBookings(hbkgsRes.value);
          if (fusRes.status === 'fulfilled') setFollowUps(fusRes.value);
        }

        if (dbsRes.status === 'fulfilled') setDbStatus(dbsRes.value);
        if (usrsRes.status === 'fulfilled') setUsers(usrsRes.value);

        setProfileRefreshKey((prev) => prev + 1);
      } catch (err: any) {
        console.warn('[SN Travels] Non-fatal issue during refreshAllData:', err);
      } finally {
        if (!silent) {
          setLoading(false);
        }
        inFlightRefreshRef.current = null;
      }
    })();

    inFlightRefreshRef.current = promise;
    return promise;
  };

  // Helper to extract candidate secret key strictly from the browser URL
  const extractCandidateKey = (): string => {
    try {
      // 1. Query parameters in URL: ?key=... or ?access_key=... or ?token=... or ?secret=...
      const urlParams = new URLSearchParams(window.location.search);
      const queryKey =
        urlParams.get('key') ||
        urlParams.get('access_key') ||
        urlParams.get('token') ||
        urlParams.get('secret');
      if (queryKey && queryKey.trim()) {
        return queryKey.trim();
      }

      // 2. Secret URL path formats: /access/:slug or /secret-login/:slug or /login/:slug
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const segments = pathname.split('/');
      if (segments.length >= 2) {
        const prefix = segments[0].toLowerCase();
        if (prefix === 'access' || prefix === 'secret-login' || prefix === 'login') {
          const candidate = segments.slice(1).join('/');
          if (candidate && candidate.trim()) {
            return candidate.trim();
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return '';
  };

  const checkSecretGate = async () => {
    try {
      setSecretGateChecking(true);
      const candidateKey = extractCandidateKey();
      const res = await api.checkSecretLogin(candidateKey || undefined);

      if (!res.protected) {
        // Protection is disabled -> anyone can access login screen
        setSecretGatePassed(true);
        setVerifiedSecretKey(null);
      } else if (res.valid) {
        // Valid secret URL key strictly in URL -> permit access to login
        setSecretGatePassed(true);
        const resolvedKey = res.key || candidateKey;
        setVerifiedSecretKey(resolvedKey);
      } else {
        // Invalid or missing secret key in URL -> gate closed, show 404!
        setSecretGatePassed(false);
        setVerifiedSecretKey(null);
      }
    } catch (err) {
      console.warn('[Gatekeeper] Secret gate verification error:', err);
      setSecretGatePassed(false);
    } finally {
      setSecretGateChecking(false);
    }
  };

  // Verify session on mount and setup auth error interceptor
  useEffect(() => {
    const unsub = api.onAuthError(() => {
      setCurrentUser(null);
      setLoading(false);
      checkSecretGate();
    });

    const verifySession = async () => {
      const savedUser = api.getCurrentUser();
      if (!savedUser) {
        setAuthChecking(false);
        await checkSecretGate();
        return;
      }

      setSecretGateChecking(false);
      // Fire initial data hydration immediately in parallel with session verification
      void refreshAllData();

      try {
        const verified = await api.getMe();
        setCurrentUser(verified);
      } catch (e) {
        // Invalid or expired token
        api.setCurrentUser(null);
        setCurrentUser(null);
        await checkSecretGate();
      } finally {
        setAuthChecking(false);
      }
    };

    verifySession();
    return () => unsub();
  }, []);

  // Real-Time Server-Sent Events (SSE) Stream & Smart Visibility-Aware Polling
  useEffect(() => {
    if (!currentUser) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.type === 'data_changed') {
            refreshAllData(true);
          }
        } catch {}
      };
    } catch (e) {
      console.warn('[SSE] EventSource connection failed, falling back to polling:', e);
    }

    // Smart background fallback poll (only runs when tab is active & visible to save CPU/DB bandwidth)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshAllData(true);
      }
    }, 15000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, [currentUser]);

  // Helper to parse browser pathname to active NavTab & Client ID
  const parsePathToTab = (pathname: string): { tab: NavTab; clientId?: number } => {
    const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!clean || clean === 'dashboard') return { tab: 'dashboard' };
    if (clean === 'clients') return { tab: 'clients' };
    if (clean.startsWith('clients/')) {
      const idStr = clean.replace('clients/', '');
      const id = parseInt(idStr, 10);
      if (!isNaN(id)) return { tab: 'clients', clientId: id };
    }
    if (clean === 'applications') return { tab: 'applications' };
    if (clean === 'hotels') return { tab: 'hotels' };
    if (clean === 'followups') return { tab: 'followups' };
    if (clean === 'invoices') return { tab: 'invoices' };
    if (clean === 'calendar') return { tab: 'calendar' };
    if (clean === 'tasks') return { tab: 'tasks' };
    if (clean === 'public-website') return { tab: 'public-website' };
    if (clean === 'settings') return { tab: 'settings' };
    if (clean === 'settings/security') {
      setSettingsTab('security');
      return { tab: 'settings' };
    }
    // Secret access URLs when authenticated stay on workspace
    if (clean.startsWith('access/') || clean.startsWith('secret-login/')) {
      return { tab: 'dashboard' };
    }
    return { tab: '404' };
  };

  // Synchronize browser history and tabs
  const navigateTo = (tab: NavTab, clientId?: number | null) => {
    setCurrentTab(tab);
    if (tab === 'clients' && clientId) {
      setSelectedClientId(clientId);
      window.history.pushState(null, '', `/clients/${clientId}`);
    } else if (tab === 'dashboard') {
      setSelectedClientId(null);
      window.history.pushState(null, '', '/');
    } else if (tab === '404') {
      setSelectedClientId(null);
    } else {
      setSelectedClientId(null);
      window.history.pushState(null, '', `/${tab}`);
    }
  };

  // Sync on initial load and handle browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parsePathToTab(window.location.pathname);
      setCurrentTab(parsed.tab);
      if (parsed.clientId) {
        setSelectedClientId(parsed.clientId);
      } else {
        setSelectedClientId(null);
      }
      // ONLY check secret gate if user is NOT authenticated
      if (!api.getCurrentUser()) {
        checkSecretGate();
      }
    };

    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    // Replace URL cleanly with root dashboard
    window.history.replaceState(null, '', '/');
    setCurrentTab('dashboard');
    refreshAllData(false);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setSecretGatePassed(false);
    setVerifiedSecretKey(null);
    window.history.pushState(null, '', '/');
    checkSecretGate();
  };

  // Open Client Profile
  const handleOpenClient = (clientId: number) => {
    navigateTo('clients', clientId);
  };

  // Back to Clients list
  const handleBackToClients = () => {
    navigateTo('clients');
  };

  // New application trigger
  const handleOpenNewAppForClient = (clientId?: number, clientName?: string) => {
    setNewAppClientInfo({ id: clientId, name: clientName });
    setNewAppModalOpen(true);
  };

  // New task trigger
  const handleOpenNewTaskForClient = (clientId?: number, clientName?: string, dueDate?: string) => {
    setNewTaskClientInfo({ id: clientId, name: clientName, dueDate });
    setNewTaskModalOpen(true);
  };

  // Status update modal trigger
  const handleOpenStatusModal = (applicationId: number) => {
    const app = applications.find((a) => a.id === applicationId);
    if (app) {
      setStatusTargetApp(app);
      setStatusModalOpen(true);
    }
  };

  // Toggle task with instant optimistic local update & Return Status Warning Modal for collection tasks
  const handleToggleTask = async (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const isFollowUpTask =
      task.title.startsWith('[Follow-up]') ||
      followUps.some((f) => Number(f.task_id) === Number(task.id));

    // Only genuine collection/delivery tasks interact with application Returned status
    const isCollectionOrDeliveryTask =
      !isFollowUpTask &&
      (task.is_delivery_task === 1 ||
        (task.application_id && /delivery|collection/i.test(task.title || '')) ||
        /^Delivery\s*-/i.test(task.title || ''));

    // If it's a follow-up task or standard non-delivery task, toggle directly without touching application status!
    if (!isCollectionOrDeliveryTask) {
      executeToggleTask(taskId);
      return;
    }

    // If task is currently Pending and being marked as Completed
    if (task.status !== 'Completed') {
      const linkedApp = task.application_id
        ? applications.find((a) => a.id === task.application_id)
        : applications.find((a) => a.client_id === task.client_id && (a.status === 'Pending Collection' || a.delivery_date));

      if (linkedApp) {
        setReturnWarningState({
          isOpen: true,
          mode: 'mark_returned',
          taskId: task.id,
          appId: linkedApp.id,
          clientName: linkedApp.client_name || task.client_name || 'Client',
          applicationCode: linkedApp.application_id || task.application_code || `APP-#${linkedApp.id}`,
          taskTitle: task.title,
          dueDate: task.due_date,
        });
        return;
      }
    } else {
      // If task is currently Completed and being marked as Uncompleted (Pending)
      const linkedApp = task.application_id
        ? applications.find((a) => a.id === task.application_id)
        : applications.find((a) => a.client_id === task.client_id && a.status === 'Returned');

      if (linkedApp && linkedApp.status === 'Returned') {
        let prevStatus: ApplicationStatus = 'Pending Collection';
        try {
          const appDetail = await api.getApplicationById(linkedApp.id);
          if (appDetail && appDetail.history) {
            const returnedRecord = appDetail.history.find((h) => h.new_status === 'Returned');
            if (returnedRecord && returnedRecord.old_status && returnedRecord.old_status !== 'Returned') {
              prevStatus = returnedRecord.old_status as ApplicationStatus;
            }
          }
        } catch {
          // fallback
        }

        setReturnWarningState({
          isOpen: true,
          mode: 'revert_status',
          taskId: task.id,
          appId: linkedApp.id,
          clientName: linkedApp.client_name || task.client_name || 'Client',
          applicationCode: linkedApp.application_id || task.application_code || `APP-#${linkedApp.id}`,
          taskTitle: task.title,
          dueDate: task.due_date,
          previousStatus: prevStatus,
        });
        return;
      }
    }

    // Direct toggle for standard tasks
    executeToggleTask(taskId);
  };

  const executeToggleTask = async (taskId: number, appIdToReturn?: number) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    const newStatus = targetTask?.status === 'Completed' ? 'Pending' : 'Completed';

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus, completed_at: newStatus === 'Completed' ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      if (appIdToReturn) {
        await api.updateApplicationStatus(appIdToReturn, 'Returned', undefined, 'Collection date task completed');
      }
      await api.updateTask(taskId, { status: newStatus });
      refreshAllData(true);
    } catch (err) {
      console.error(err);
      refreshAllData(true);
    }
  };

  const handleConfirmReturnWarning = async () => {
    if (!returnWarningState) return;
    setReturnWarningLoading(true);
    const { mode, appId, taskId, clientName, applicationCode, previousStatus } = returnWarningState;
    const isRevert = mode === 'revert_status';

    if (isRevert) {
      const targetStatus: ApplicationStatus = previousStatus || 'Pending Collection';

      // Optimistically update local application and task states
      if (appId) {
        setApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, status: targetStatus } : a))
        );
        const targetApp = applications.find((a) => a.id === appId);
        setTasks((prev) =>
          prev.map((t) => {
            if (
              !t.title.startsWith('[Follow-up]') &&
              (t.application_id === appId ||
                (targetApp &&
                  t.client_id === targetApp.client_id &&
                  (t.is_delivery_task === 1 || /delivery|collection/i.test(t.title))))
            ) {
              return { ...t, status: 'Pending', completed_at: null };
            }
            return t;
          })
        );
      }
      if (taskId) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'Pending', completed_at: null }
              : t
          )
        );
      }

      try {
        if (appId) {
          await api.updateApplicationStatus(
            appId,
            targetStatus,
            undefined,
            `Reverted application status from Returned to ${targetStatus} because collection task was marked uncompleted.`
          );
        }
        if (taskId) {
          await api.updateTask(taskId, { status: 'Pending' });
        }
        setReturnStatusBanner({
          clientName: clientName || 'Client',
          appCode: applicationCode || 'Application',
          mode: 'revert',
          targetStatus: targetStatus,
        });
        setReturnWarningState(null);
        refreshAllData(true);
      } catch (err) {
        console.error('Failed to revert collection task & application status:', err);
        refreshAllData(true);
      } finally {
        setReturnWarningLoading(false);
      }
    } else {
      // Mark as Returned
      if (appId) {
        setApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, status: 'Returned' } : a))
        );
        const targetApp = applications.find((a) => a.id === appId);
        setTasks((prev) =>
          prev.map((t) => {
            if (
              !t.title.startsWith('[Follow-up]') &&
              (t.application_id === appId ||
                (targetApp &&
                  t.client_id === targetApp.client_id &&
                  (t.is_delivery_task === 1 || /delivery|collection/i.test(t.title))))
            ) {
              return { ...t, status: 'Completed', completed_at: new Date().toISOString() };
            }
            return t;
          })
        );
      }
      if (taskId) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'Completed', completed_at: new Date().toISOString() }
              : t
          )
        );
      }

      try {
        if (appId) {
          await api.updateApplicationStatus(
            appId,
            'Returned',
            undefined,
            'Collection date task completed on calendar'
          );
        }
        if (taskId) {
          await api.updateTask(taskId, { status: 'Completed' });
        }
        setReturnStatusBanner({
          clientName: clientName || 'Client',
          appCode: applicationCode || 'Application',
          mode: 'returned',
        });
        setReturnWarningState(null);
        refreshAllData(true);
      } catch (err) {
        console.error('Failed to complete collection task & return application:', err);
        refreshAllData(true);
      } finally {
        setReturnWarningLoading(false);
      }
    }
  };

  // Direct toggle for application collection date event on calendar
  const handleToggleApplicationDelivery = async (app: VisaApplication) => {
    if (app.status === 'Returned') {
      let prevStatus: ApplicationStatus = 'Pending Collection';
      try {
        const appDetail = await api.getApplicationById(app.id);
        if (appDetail && appDetail.history) {
          const returnedRecord = appDetail.history.find((h) => h.new_status === 'Returned');
          if (returnedRecord && returnedRecord.old_status && returnedRecord.old_status !== 'Returned') {
            prevStatus = returnedRecord.old_status as ApplicationStatus;
          }
        }
      } catch {
        // fallback
      }

      setReturnWarningState({
        isOpen: true,
        mode: 'revert_status',
        appId: app.id,
        clientName: app.client_name || 'Client',
        applicationCode: app.application_id || `APP-#${app.id}`,
        taskTitle: `Collection Date: ${app.client_name || 'Client'} (${app.visa_type_name || 'Visa'})`,
        dueDate: app.delivery_date || undefined,
        previousStatus: prevStatus,
      });
    } else {
      setReturnWarningState({
        isOpen: true,
        mode: 'mark_returned',
        appId: app.id,
        clientName: app.client_name || 'Client',
        applicationCode: app.application_id || `APP-#${app.id}`,
        taskTitle: `Collection Date: ${app.client_name || 'Client'} (${app.visa_type_name || 'Visa'})`,
        dueDate: app.delivery_date || undefined,
      });
    }
  };

  // Delete task with instant optimistic local update and silent background refresh
  const handleDeleteTask = async (taskId: number) => {
    const taskToDelete = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (taskToDelete) {
      if (taskToDelete.application_id) {
        setApplications((prev) =>
          prev.map((a) =>
            a.id === taskToDelete.application_id ? { ...a, delivery_date: null } : a
          )
        );
      } else if (taskToDelete.client_id) {
        setApplications((prev) =>
          prev.map((a) =>
            a.client_id === taskToDelete.client_id ? { ...a, delivery_date: null } : a
          )
        );
      }
    }

    try {
      await api.deleteTask(taskId);
      refreshAllData(true);
    } catch (err) {
      console.error(err);
      refreshAllData(true);
    }
  };

  // Handle client creation success
  const handleClientCreated = (newClient: Client) => {
    refreshAllData(true);
    // Open the new client's profile immediately with proper URL synchronization
    navigateTo('clients', newClient.id);
  };

  if (authChecking || (!currentUser && secretGateChecking)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center font-black font-serif text-2xl mb-4 shadow-xl shadow-sky-600/30 animate-pulse">
          SN
        </div>
        <div className="text-sm text-slate-300 font-semibold tracking-wide">SN Travels Agency</div>
        <p className="text-xs text-slate-500 mt-1">Verifying encrypted security session...</p>
      </div>
    );
  }

  if (!currentUser) {
    if (!secretGatePassed) {
      return (
        <NotFoundPage
          requestedPath={window.location.pathname}
          isAuthenticated={false}
          onAccessKeyEntered={(key) => {
            setSecretGatePassed(true);
            setVerifiedSecretKey(key);
          }}
          onNavigate={(tab) => {
            window.location.href = `/${tab}`;
          }}
        />
      );
    }

    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        secretKey={verifiedSecretKey || undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-sky-500 selection:text-white">
      <div className="flex flex-1 min-h-screen">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => navigateTo(tab)}
          userRole={currentUser?.role}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          todayTasksCount={metrics?.today_tasks || 0}
          attentionAppsCount={metrics?.apps_requiring_attention?.length || 0}
          activeHotelsCount={hotelBookings.filter(b => b.status === 'Confirmed' || b.status === 'Checked In').length}
          dueFollowUpsCount={followUps.filter(f => f.status === 'Pending' && (f.due_date <= new Date().toISOString().split('T')[0])).length}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenChangePassword={() => setChangePasswordModalOpen(true)}
            users={users}
            onOpenNewClient={() => setCreateClientModalOpen(true)}
            onOpenPassportScanner={() => setPassportScannerModalOpen(true)}
            onOpenDbModal={() => setDbModalOpen(true)}
            dbStatus={dbStatus}
            searchQuery={globalSearch}
            onGlobalSearch={(q) => {
              setGlobalSearch(q);
              if (q && currentTab !== 'clients') {
                navigateTo('clients');
              }
            }}
            onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />

          <main className="flex-1 pb-16">
            <React.Suspense fallback={<ViewLoadingSkeleton />}>
              {/* Dashboard View */}
            {currentTab === 'dashboard' && (
              <DashboardView
                metrics={metrics}
                loading={loading}
                onOpenClient={handleOpenClient}
                onOpenNewClient={() => setCreateClientModalOpen(true)}
                onOpenPassportScanner={() => setPassportScannerModalOpen(true)}
                onOpenNewApplication={() => handleOpenNewAppForClient()}
                onOpenNewFollowUp={() => setCreateFollowUpModalOpen(true)}
                onOpenNewTask={() => handleOpenNewTaskForClient()}
                onToggleTask={handleToggleTask}
                onOpenStatusModal={handleOpenStatusModal}
                onNavigate={(tab) => navigateTo(tab)}
              />
            )}

            {/* Clients Directory / Client Profile */}
            {currentTab === 'clients' && (
              selectedClientId ? (
                <ClientProfileView
                  clientId={selectedClientId}
                  refreshTrigger={profileRefreshKey}
                  onBack={handleBackToClients}
                  onOpenNewApplication={(cid, cname) => handleOpenNewAppForClient(cid, cname)}
                  onOpenNewTask={(cid, cname) => handleOpenNewTaskForClient(cid, cname)}
                  onOpenStatusModal={handleOpenStatusModal}
                  onClientDeleted={() => {
                    setSelectedClientId(null);
                    refreshAllData(true);
                  }}
                  onRefreshData={() => refreshAllData(true)}
                  users={users}
                />
              ) : (
                <ClientsView
                  clients={clients}
                  loading={loading}
                  onOpenClient={handleOpenClient}
                  onOpenNewClient={() => setCreateClientModalOpen(true)}
                  onOpenPassportScanner={() => setPassportScannerModalOpen(true)}
                  searchFilter={globalSearch}
                  onRefreshData={() => refreshAllData(true)}
                />
              )
            )}

            {/* Applications View */}
            {currentTab === 'applications' && (
              <ApplicationsView
                applications={applications}
                loading={loading}
                visaTypes={visaTypes}
                onOpenClient={handleOpenClient}
                onOpenNewApplication={() => handleOpenNewAppForClient()}
                onOpenStatusModal={handleOpenStatusModal}
                searchFilter={globalSearch}
                onRefreshData={() => refreshAllData(true)}
              />
            )}

            {/* Hotels View — Placed between Applications and Calendar as requested */}
            {currentTab === 'hotels' && (
              <HotelsView
                clients={clients}
                hotels={hotels}
                onOpenClient={handleOpenClient}
                onOpenSettingsHotels={() => {
                  setSettingsTab('hotels');
                  navigateTo('settings');
                }}
                searchFilter={globalSearch}
                onRefreshData={() => refreshAllData(true)}
              />
            )}

            {/* Follow-ups View — Placed after Hotels and before Calendar as requested */}
            {currentTab === 'followups' && (
              <FollowUpsView
                followUps={followUps}
                clients={clients}
                users={users}
                onOpenClient={handleOpenClient}
                onNewApplication={(clientInfo) => {
                  setNewAppClientInfo(clientInfo);
                  setNewAppModalOpen(true);
                }}
                onRefreshData={() => refreshAllData(true)}
              />
            )}

            {/* Invoices View — Customer Billing & Invoices */}
            {currentTab === 'invoices' && (
              <InvoicesView
                currentUser={currentUser}
                clients={clients}
                onSelectClient={(cid) => handleOpenClient(cid)}
              />
            )}

            {/* Calendar View */}
            {currentTab === 'calendar' && (
              <CalendarView
                tasks={tasks}
                applications={applications}
                clients={clients}
                users={users}
                hotelBookings={hotelBookings}
                onOpenNewTask={(date?: string) => handleOpenNewTaskForClient(undefined, undefined, date)}
                onToggleTask={handleToggleTask}
                onToggleApplicationDelivery={handleToggleApplicationDelivery}
                onDeleteTask={handleDeleteTask}
                onOpenClient={handleOpenClient}
                onOpenStatusModal={handleOpenStatusModal}
                onRefreshData={(silent?: boolean) => refreshAllData(silent !== false)}
              />
            )}

            {/* Tasks View */}
            {currentTab === 'tasks' && (
              <TasksView
                tasks={tasks}
                loading={loading}
                onOpenNewTask={() => handleOpenNewTaskForClient()}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onOpenClient={handleOpenClient}
              />
            )}

            {/* Public Website Management View (Admin & Super Admin) */}
            {currentTab === 'public-website' && (
              <PublicWebsiteManagementView currentUser={currentUser} />
            )}

            {/* Settings View */}
            {currentTab === 'settings' && (
              <SettingsView
                currentUser={currentUser}
                dbStatus={dbStatus}
                initialTab={settingsTab}
                onTabChange={(tab) => setSettingsTab(tab)}
                onOpenDbModal={() => setDbModalOpen(true)}
                onHotelsUpdated={() => refreshAllData(true)}
                onDataPurged={() => refreshAllData(true)}
              />
            )}

            {/* 404 Not Found View */}
            {currentTab === '404' && (
              <NotFoundPage
                isAuthenticated={true}
                onNavigate={(tab) => navigateTo(tab)}
                onSearch={(q) => {
                  setGlobalSearch(q);
                  navigateTo('clients');
                }}
                requestedPath={window.location.pathname}
              />
            )}
            </React.Suspense>
          </main>
        </div>
      </div>

      {/* Modals */}
      <CreateClientModal
        isOpen={createClientModalOpen}
        onClose={() => {
          setCreateClientModalOpen(false);
          setScannedPassportData(null);
        }}
        onClientCreated={handleClientCreated}
        onOpenExistingClient={(cid) => {
          navigateTo('clients', cid);
        }}
        initialPassportData={scannedPassportData}
        onOpenPassportScanner={() => setPassportScannerModalOpen(true)}
      />

      {passportScannerModalOpen && (
        <React.Suspense fallback={null}>
          <PassportScannerModal
            isOpen={passportScannerModalOpen}
            onClose={() => setPassportScannerModalOpen(false)}
            onUseDataForNewClient={(data) => {
              setScannedPassportData(data);
              setPassportScannerModalOpen(false);
              setCreateClientModalOpen(true);
            }}
            onOpenExistingClient={(clientId) => {
              setPassportScannerModalOpen(false);
              navigateTo('clients', clientId);
            }}
          />
        </React.Suspense>
      )}

      <NewApplicationModal
        isOpen={newAppModalOpen}
        onClose={() => setNewAppModalOpen(false)}
        clientId={newAppClientInfo.id}
        clientName={newAppClientInfo.name}
        clients={clients}
        onApplicationCreated={() => refreshAllData(true)}
      />

      <ApplicationStatusModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        application={statusTargetApp}
        onStatusUpdated={() => refreshAllData(true)}
      />

      <NewTaskModal
        isOpen={newTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        clientId={newTaskClientInfo.id}
        initialDueDate={newTaskClientInfo.dueDate}
        clients={clients}
        applications={applications}
        onTaskCreated={() => refreshAllData(true)}
      />

      {dbModalOpen && (
        <React.Suspense fallback={null}>
          <DatabaseModal
            isOpen={dbModalOpen}
            onClose={() => setDbModalOpen(false)}
            status={dbStatus}
          />
        </React.Suspense>
      )}

      <ChangePasswordModal
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
        onSuccess={() => {
          // Password updated
        }}
      />

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        clients={clients}
        applications={applications}
        onNavigate={(tab, clientId) => navigateTo(tab, clientId)}
        onOpenNewClient={() => setCreateClientModalOpen(true)}
        onOpenNewApplication={() => handleOpenNewAppForClient()}
        onOpenNewFollowUp={() => setCreateFollowUpModalOpen(true)}
        onOpenNewTask={() => handleOpenNewTaskForClient()}
        onOpenPassportScanner={() => setPassportScannerModalOpen(true)}
      />

      {/* Quick Follow-up creation modal */}
      <CreateFollowUpModal
        isOpen={createFollowUpModalOpen}
        onClose={() => setCreateFollowUpModalOpen(false)}
        clients={clients}
        users={users}
        onSuccess={() => refreshAllData(true)}
      />

      {/* Return Status Warning Modal */}
      {returnWarningState?.isOpen && (
        <React.Suspense fallback={null}>
          <ReturnStatusWarningModal
            isOpen={!!returnWarningState?.isOpen}
            onClose={() => setReturnWarningState(null)}
            onConfirm={handleConfirmReturnWarning}
            mode={returnWarningState?.mode}
            clientName={returnWarningState?.clientName}
            applicationCode={returnWarningState?.applicationCode}
            taskTitle={returnWarningState?.taskTitle}
            dueDate={returnWarningState?.dueDate}
            previousStatus={returnWarningState?.previousStatus}
            loading={returnWarningLoading}
          />
        </React.Suspense>
      )}

      {/* Return Status Alert Toast */}
      {returnStatusBanner && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-2xl shadow-2xl p-4 max-w-md flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300 border ${
            returnStatusBanner.mode === 'revert'
              ? 'bg-slate-900 text-sky-50 border-sky-500/80'
              : 'bg-amber-950 text-amber-50 border-amber-600/80'
          }`}
        >
          {returnStatusBanner.mode === 'revert' ? (
            <RotateCcw className="w-6 h-6 text-sky-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
          )}
          <div className="flex-1 min-w-0 text-xs">
            <h4
              className={`font-bold text-sm mb-0.5 ${
                returnStatusBanner.mode === 'revert' ? 'text-sky-300' : 'text-amber-200'
              }`}
            >
              {returnStatusBanner.mode === 'revert'
                ? 'Application Status Reverted'
                : 'Return Status Applied'}
            </h4>
            <p>
              Application <span className="font-mono font-bold text-white">{returnStatusBanner.appCode}</span> for{' '}
              <span className="font-bold text-white">{returnStatusBanner.clientName}</span>{' '}
              {returnStatusBanner.mode === 'revert' ? (
                <>
                  has been reverted back to{' '}
                  <span className="font-extrabold text-sky-300 underline">
                    {returnStatusBanner.targetStatus || 'Pending Collection'}
                  </span>{' '}
                  because the collection task was marked as uncompleted.
                </>
              ) : (
                <>
                  has been marked as{' '}
                  <span className="font-extrabold text-amber-300 underline">Returned</span> because
                  the collection task was completed.
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => setReturnStatusBanner(null)}
            className={`transition cursor-pointer p-1 ${
              returnStatusBanner.mode === 'revert'
                ? 'text-sky-400 hover:text-white'
                : 'text-amber-400 hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
