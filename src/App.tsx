/**
 * SN Travels Agency — China Visa Client Management System
 * Company: SN Travels Agency (sn-travelsagency.com)
 * Internal Staff Portal for Clients, Applications, Tasks, Calendar, and Roles.
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './pages/DashboardView';
import { ClientsView } from './pages/ClientsView';
import { ClientProfileView } from './pages/ClientProfileView';
import { ApplicationsView } from './pages/ApplicationsView';
import { HotelsView } from './pages/HotelsView';
import { CalendarView } from './pages/CalendarView';
import { TasksView } from './pages/TasksView';
import { SettingsView } from './pages/SettingsView';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginView } from './pages/LoginView';
import { CreateClientModal } from './components/CreateClientModal';
import { NewApplicationModal } from './components/NewApplicationModal';
import { ApplicationStatusModal } from './components/ApplicationStatusModal';
import { NewTaskModal } from './components/NewTaskModal';
import { DatabaseModal } from './components/DatabaseModal';
import { PassportScannerModal } from './components/PassportScannerModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { api } from './services/api';
import {
  Client,
  VisaApplication,
  Task,
  VisaType,
  User,
  DashboardMetrics,
  DatabaseStatus,
  ScannedPassportData,
  Hotel,
  HotelBooking,
} from './types';

export default function App() {
  // Navigation & View State
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [settingsTab, setSettingsTab] = useState<'fields' | 'visatypes' | 'countries' | 'hotels' | 'users' | 'cleanup' | 'security'>('fields');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  // Secret Login URL & Gatekeeper State
  const [secretGateChecking, setSecretGateChecking] = useState(true);
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

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(api.getCurrentUser());
  const [authChecking, setAuthChecking] = useState(true);

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [applications, setApplications] = useState<VisaApplication[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelBookings, setHotelBookings] = useState<HotelBooking[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  // Load all primary data (supports silent background sync to prevent flickering & tab switching)
  const refreshAllData = async (silent: boolean = false) => {
    if (!api.getCurrentUser()) {
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      const [cls, apps, tsks, vts, usrs, mtr, dbs, htls, hbkgs] = await Promise.all([
        api.getClients(),
        api.getApplications(),
        api.getTasks(),
        api.getVisaTypes(true),
        api.getUsers(),
        api.getDashboardMetrics(),
        api.getDbStatus(),
        api.getHotels(false),
        api.getHotelBookings(),
      ]);

      setClients(cls);
      setApplications(apps);
      setTasks(tsks);
      setVisaTypes(vts);
      setUsers(usrs);
      setMetrics(mtr);
      setDbStatus(dbs);
      setHotels(htls);
      setHotelBookings(hbkgs);
      setProfileRefreshKey((prev) => prev + 1);
    } catch (err: any) {
      console.error('[SN Travels] Error fetching data:', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
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
        return;
      }

      try {
        const verified = await api.getMe();
        setCurrentUser(verified);
        refreshAllData();
      } catch (e) {
        // Invalid or expired token
        api.setCurrentUser(null);
        setCurrentUser(null);
      } finally {
        setAuthChecking(false);
      }
    };

    verifySession();
    checkSecretGate();
    return () => unsub();
  }, []);

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
    if (clean === 'calendar') return { tab: 'calendar' };
    if (clean === 'tasks') return { tab: 'tasks' };
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

  // Toggle task with instant optimistic local update and silent background refresh
  const handleToggleTask = async (taskId: number) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'Completed' ? 'Pending' : 'Completed' }
          : t
      )
    );
    try {
      await api.toggleTaskStatus(taskId);
      refreshAllData(true);
    } catch (err) {
      console.error(err);
      refreshAllData(true);
    }
  };

  // Delete task with instant optimistic local update and silent background refresh
  const handleDeleteTask = async (taskId: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
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

  if (authChecking || secretGateChecking) {
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
          />

          <main className="flex-1 pb-16">
            {/* Dashboard View */}
            {currentTab === 'dashboard' && (
              <DashboardView
                metrics={metrics}
                loading={loading}
                onOpenClient={handleOpenClient}
                onOpenNewClient={() => setCreateClientModalOpen(true)}
                onOpenPassportScanner={() => setPassportScannerModalOpen(true)}
                onOpenNewApplication={() => handleOpenNewAppForClient()}
                onOpenNewTask={() => handleOpenNewTaskForClient()}
                onToggleTask={handleToggleTask}
                onOpenStatusModal={handleOpenStatusModal}
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

      <DatabaseModal
        isOpen={dbModalOpen}
        onClose={() => setDbModalOpen(false)}
        status={dbStatus}
      />

      <ChangePasswordModal
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
        onSuccess={() => {
          // Password updated
        }}
      />
    </div>
  );
}
