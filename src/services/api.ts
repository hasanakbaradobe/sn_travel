/**
 * SN Travels Agency — Frontend API Client
 * Clean REST communication with Node.js backend
 */

import {
  User,
  Client,
  ClientProfileDetails,
  CustomField,
  Country,
  VisaType,
  VisaApplication,
  ApplicationDetail,
  Task,
  Comment,
  ActivityLog,
  DashboardMetrics,
  DatabaseStatus,
  ApplicationStatus,
  ScannedPassportData,
  Hotel,
  HotelRoom,
  HotelBooking,
  PurgeTargets,
  PurgePreviewResult,
  PurgeExecuteResult,
  PaginatedResponse,
} from '../types';

import { scanPassportInBrowser } from './clientPassportScanner';

const API_BASE = '/api';
const CACHE_KEY_PREFIX = 'sn_api_cache_';
const DEFAULT_CACHE_TTL_MS = 60 * 1000; // 1 minute default TTL

interface CacheOptions extends RequestInit {
  skipCache?: boolean;
  cacheTtl?: number;
}

class ApiService {
  private token: string | null = null;
  private currentUser: User | null = null;
  private authErrorListeners: Array<() => void> = [];

  constructor() {
    this.token = localStorage.getItem('sn_token');
    const savedUser = localStorage.getItem('sn_user');
    if (savedUser && this.token) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        this.currentUser = null;
        this.token = null;
        localStorage.removeItem('sn_user');
        localStorage.removeItem('sn_token');
      }
    } else {
      this.currentUser = null;
      this.token = null;
    }
  }

  /**
   * Purge sessionStorage GET response cache
   */
  public clearCache(pattern?: string): void {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          if (!pattern || key.includes(pattern)) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    } catch (e) {
      console.warn('[ApiService] Failed to clear sessionStorage cache:', e);
    }
  }

  private getCachedResponse<T>(endpoint: string, ttlMs: number = DEFAULT_CACHE_TTL_MS): T | null {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return null;
      const raw = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${endpoint}`);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.timestamp === 'number' && 'data' in parsed) {
        if (Date.now() - parsed.timestamp < ttlMs) {
          return parsed.data as T;
        }
      }
      sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${endpoint}`);
    } catch (e) {
      // Ignore parse or storage errors
    }
    return null;
  }

  private setCachedResponse<T>(endpoint: string, data: T): void {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      const payload = JSON.stringify({
        timestamp: Date.now(),
        data,
      });
      sessionStorage.setItem(`${CACHE_KEY_PREFIX}${endpoint}`, payload);
    } catch (e) {
      console.warn('[ApiService] Failed to write to sessionStorage cache:', e);
    }
  }

  onAuthError(callback: () => void) {
    this.authErrorListeners.push(callback);
    return () => {
      this.authErrorListeners = this.authErrorListeners.filter(cb => cb !== callback);
    };
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  setCurrentUser(user: User | null, token?: string) {
    this.currentUser = user;
    this.clearCache();
    if (user && token) {
      this.token = token;
      localStorage.setItem('sn_user', JSON.stringify(user));
      localStorage.setItem('sn_token', token);
    } else if (!user) {
      this.token = null;
      localStorage.removeItem('sn_user');
      localStorage.removeItem('sn_token');
    }
  }

  private async request<T>(endpoint: string, options: CacheOptions = {}): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    const ttl = options.cacheTtl ?? DEFAULT_CACHE_TTL_MS;

    // 1. Check sessionStorage cache for GET requests
    if (isGet && !options.skipCache) {
      const cached = this.getCachedResponse<T>(endpoint, ttl);
      if (cached !== null) {
        return cached;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const { skipCache, cacheTtl, ...fetchOptions } = options;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'An error occurred';
      let errorData: any = null;
      try {
        errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }

      // If unauthorized on any protected endpoint, clear session and inform listeners
      if (response.status === 401 && endpoint !== '/auth/login') {
        this.setCurrentUser(null);
        this.authErrorListeners.forEach(cb => {
          try { cb(); } catch {}
        });
      }

      const error: any = new Error(errorMessage);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    const data: T = await response.json();

    // 2. Cache successful GET response in sessionStorage
    if (isGet && !options.skipCache) {
      this.setCachedResponse<T>(endpoint, data);
    }

    // 3. Automatically invalidate cache on mutations (POST, PUT, PATCH, DELETE)
    if (!isGet) {
      this.clearCache();
    }

    return data;
  }

  // Auth
  async login(email: string, password: string, secretKey?: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, secretKey }),
    });
    this.setCurrentUser(res.user, res.token);
    return res;
  }

  async checkSecretLogin(key?: string): Promise<{ protected: boolean; valid: boolean; key?: string }> {
    const query = key ? `?key=${encodeURIComponent(key)}` : '';
    return this.request<{ protected: boolean; valid: boolean; key?: string }>(`/auth/secret-check${query}`);
  }

  async getSecretLoginSettings(): Promise<{ enabled: boolean; secretKey: string; loginPath: string }> {
    return this.request<{ enabled: boolean; secretKey: string; loginPath: string }>('/settings/secret-login-url');
  }

  async updateSecretLoginSettings(data: { enabled: boolean; secretKey: string }): Promise<{
    message: string;
    enabled: boolean;
    secretKey: string;
    loginPath: string;
  }> {
    return this.request<{
      message: string;
      enabled: boolean;
      secretKey: string;
      loginPath: string;
    }>('/settings/secret-login-url', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMe(): Promise<User> {
    const res = await this.request<{ user: User }>('/auth/me');
    this.currentUser = res.user;
    localStorage.setItem('sn_user', JSON.stringify(res.user));
    return res.user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }

  async logout() {
    this.setCurrentUser(null);
  }

  // Passport Scanner (100% Client-Side In-Browser Local Engine - No AI, No Server Load)
  async scanPassport(
    image: string,
    mimeType?: string,
    engine?: string,
    onStatusUpdate?: (status: string) => void
  ): Promise<ScannedPassportData> {
    try {
      // Run processing directly on the client's browser/device
      const browserResult = await scanPassportInBrowser(image, onStatusUpdate);
      if (browserResult && browserResult.passportNumber) {
        return browserResult;
      }
    } catch (browserErr: any) {
      console.warn('[PassportScanner] In-browser client scan encountered an issue:', browserErr);
      throw new Error(browserErr.message || 'In-browser scanner could not process image on device. Please ensure the Machine Readable Zone (MRZ) is clear and well-lit.');
    }

    throw new Error('In-browser scanner could not process image on device. Please ensure the Machine Readable Zone (MRZ) is clear and well-lit.');
  }

  // Clients
  async getClients(search?: string, country?: string): Promise<Client[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (country) params.append('country', country);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<Client[]>(`/clients${qs}`);
  }

  async getClientsPaginated(params?: {
    search?: string;
    country?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Client>> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.country) q.append('country', params.country);
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.sortBy) q.append('sortBy', params.sortBy);
    if (params?.sortOrder) q.append('sortOrder', params.sortOrder);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<PaginatedResponse<Client>>(`/clients${qs}`);
  }

  async getClientById(id: number | string): Promise<ClientProfileDetails> {
    return this.request<ClientProfileDetails>(`/clients/${id}`);
  }

  async checkDuplicateClient(passportNumber: string, fullName?: string): Promise<{
    has_duplicate: boolean;
    matches: Array<{ id: number; client_id: string; full_name: string; passport_number: string; country: string }>;
  }> {
    return this.request('/clients/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ passport_number: passportNumber, full_name: fullName }),
    });
  }

  async getNextClientSerial(): Promise<{ next_serial_number: number; next_client_id: string; last_serial_number: number }> {
    return this.request('/clients/next-serial');
  }

  async createClient(data: {
    client_id?: string;
    full_name: string;
    passport_number: string;
    country: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    date_of_birth?: string;
    address?: string;
    occupation?: string;
    notes?: string;
    google_drive_url?: string;
    photo_url?: string;
    ignore_duplicate?: boolean;
    custom_fields?: Record<number, string>;
  }): Promise<Client> {
    return this.request<Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: number, data: Partial<Client> & { custom_fields?: Record<number, string> }): Promise<Client> {
    return this.request<Client>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  // Applications
  async getApplications(filters?: { status?: string; visa_type_id?: number; staff_id?: number; search?: string }): Promise<VisaApplication[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.visa_type_id) params.append('visa_type_id', String(filters.visa_type_id));
    if (filters?.staff_id) params.append('staff_id', String(filters.staff_id));
    if (filters?.search) params.append('search', filters.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<VisaApplication[]>(`/applications${qs}`);
  }

  async getApplicationsPaginated(params?: {
    search?: string;
    status?: string;
    visa_type_id?: number;
    staff_id?: number;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<VisaApplication>> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.status) q.append('status', params.status);
    if (params?.visa_type_id) q.append('visa_type_id', String(params.visa_type_id));
    if (params?.staff_id) q.append('staff_id', String(params.staff_id));
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<PaginatedResponse<VisaApplication>>(`/applications${qs}`);
  }

  async getApplicationById(id: number | string): Promise<ApplicationDetail> {
    return this.request<ApplicationDetail>(`/applications/${id}`);
  }

  async createApplication(data: {
    client_id: number;
    visa_type_id: number;
    status?: ApplicationStatus;
    delivery_date?: string;
    notes?: string;
    assigned_user_id?: number;
  }): Promise<VisaApplication> {
    return this.request<VisaApplication>('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateApplicationStatus(
    id: number,
    status: ApplicationStatus,
    deliveryDate?: string | null,
    notes?: string
  ): Promise<VisaApplication> {
    return this.request<VisaApplication>(`/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, delivery_date: deliveryDate, notes }),
    });
  }

  async updateApplication(id: number, data: Partial<VisaApplication>): Promise<VisaApplication> {
    return this.request<VisaApplication>(`/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteApplication(id: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/applications/${id}`, {
      method: 'DELETE',
    });
  }

  // Tasks
  async getTasks(filters?: { status?: string; priority?: string; user_id?: number; client_id?: number; due_date?: string }): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.user_id) params.append('user_id', String(filters.user_id));
    if (filters?.client_id) params.append('client_id', String(filters.client_id));
    if (filters?.due_date) params.append('due_date', filters.due_date);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<Task[]>(`/tasks${qs}`);
  }

  async createTask(data: {
    title: string;
    description?: string;
    client_id?: number | null;
    application_id?: number | null;
    assigned_user_id?: number | null;
    due_date: string;
    priority?: string;
  }): Promise<Task> {
    return this.request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: number, data: Partial<Task>): Promise<Task> {
    return this.request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async toggleTaskStatus(id: number): Promise<Task> {
    return this.request<Task>(`/tasks/${id}/toggle`, {
      method: 'PATCH',
    });
  }

  async deleteTask(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Calendar
  async getCalendarTasks(): Promise<Task[]> {
    return this.request<Task[]>('/calendar');
  }

  // Comments
  async getComments(clientId: number, applicationId?: number): Promise<Comment[]> {
    const params = new URLSearchParams({ client_id: String(clientId) });
    if (applicationId) params.append('application_id', String(applicationId));
    return this.request<Comment[]>(`/comments?${params.toString()}`);
  }

  async addComment(clientId: number, message: string, applicationId?: number | null): Promise<Comment> {
    return this.request<Comment>('/comments', {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId, message, application_id: applicationId }),
    });
  }

  // Custom Fields (Super Admin)
  async getCustomFields(activeOnly = false): Promise<CustomField[]> {
    return this.request<CustomField[]>(`/custom-fields${activeOnly ? '?active_only=true' : ''}`);
  }

  async createCustomField(data: Partial<CustomField>): Promise<CustomField> {
    return this.request<CustomField>('/custom-fields', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomField(id: number, data: Partial<CustomField>): Promise<CustomField> {
    return this.request<CustomField>(`/custom-fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomField(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/custom-fields/${id}`, {
      method: 'DELETE',
    });
  }

  // Visa Types (Super Admin)
  async getVisaTypes(activeOnly = false): Promise<VisaType[]> {
    return this.request<VisaType[]>(`/visa-types${activeOnly ? '?active_only=true' : ''}`);
  }

  async createVisaType(data: { name: string; description?: string }): Promise<VisaType> {
    return this.request<VisaType>('/visa-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVisaType(id: number, data: Partial<VisaType>): Promise<VisaType> {
    return this.request<VisaType>(`/visa-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVisaType(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/visa-types/${id}`, {
      method: 'DELETE',
    });
  }

  // Countries
  async getCountries(activeOnly = false): Promise<Country[]> {
    return this.request<Country[]>(`/countries${activeOnly ? '?active_only=true' : ''}`);
  }

  async createCountry(data: { name: string; code?: string }): Promise<Country> {
    return this.request<Country>('/countries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCountry(id: number, data: Partial<Country>): Promise<Country> {
    return this.request<Country>(`/countries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCountry(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/countries/${id}`, {
      method: 'DELETE',
    });
  }

  // Users (Super Admin)
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async createUser(data: { name: string; email: string; password: string; role: string }): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: number, data: Partial<User & { password?: string; is_active?: number }>): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Dashboard & Activity
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return this.request<DashboardMetrics>('/dashboard');
  }

  async getActivityLogs(limit = 20): Promise<ActivityLog[]> {
    return this.request<ActivityLog[]>(`/activity?limit=${limit}`);
  }

  // Database Status
  async getDbStatus(): Promise<DatabaseStatus> {
    return this.request<DatabaseStatus>('/db/status');
  }

  // --------------------------------------------------------------------------
  // Hotels & Rooms
  // --------------------------------------------------------------------------
  async getHotels(activeOnly = false): Promise<Hotel[]> {
    return this.request<Hotel[]>(`/hotels${activeOnly ? '?active_only=true' : ''}`);
  }

  async getHotelById(id: number): Promise<Hotel> {
    return this.request<Hotel>(`/hotels/${id}`);
  }

  async createHotel(data: {
    name: string;
    city?: string;
    address?: string;
    star_rating?: number;
    phone?: string;
    email?: string;
    notes?: string;
  }): Promise<Hotel> {
    return this.request<Hotel>('/hotels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHotel(id: number, data: Partial<Hotel>): Promise<Hotel> {
    return this.request<Hotel>(`/hotels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHotel(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/hotels/${id}`, {
      method: 'DELETE',
    });
  }

  async getHotelRooms(hotelId: number, activeOnly = false): Promise<HotelRoom[]> {
    return this.request<HotelRoom[]>(`/hotels/${hotelId}/rooms${activeOnly ? '?active_only=true' : ''}`);
  }

  async createHotelRoom(hotelId: number, data: {
    name: string;
    price_per_night?: number;
    currency?: string;
    capacity?: number;
    description?: string;
  }): Promise<HotelRoom> {
    return this.request<HotelRoom>(`/hotels/${hotelId}/rooms`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHotelRoom(id: number, data: Partial<HotelRoom>): Promise<HotelRoom> {
    return this.request<HotelRoom>(`/hotel-rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHotelRoom(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/hotel-rooms/${id}`, {
      method: 'DELETE',
    });
  }

  // --------------------------------------------------------------------------
  // Hotel Bookings & Customer Assignments
  // --------------------------------------------------------------------------
  async getHotelBookings(params?: {
    client_id?: number;
    hotel_id?: number;
    status?: string;
    search?: string;
  }): Promise<HotelBooking[]> {
    const q = new URLSearchParams();
    if (params?.client_id) q.append('client_id', String(params.client_id));
    if (params?.hotel_id) q.append('hotel_id', String(params.hotel_id));
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<HotelBooking[]>(`/hotel-bookings${qs}`);
  }

  async getHotelBookingById(id: number): Promise<HotelBooking> {
    return this.request<HotelBooking>(`/hotel-bookings/${id}`);
  }

  async createHotelBooking(data: {
    client_id: number;
    hotel_id: number;
    room_type_id?: number | null;
    room_type_name?: string | null;
    check_in_date: string;
    check_out_date: string;
    guest_count?: number;
    room_count?: number;
    status?: 'Confirmed' | 'Checked In' | 'Checked Out' | 'Cancelled';
    comment?: string | null;
    special_requests?: string | null;
    total_price?: number | null;
    currency?: string;
  }): Promise<HotelBooking> {
    return this.request<HotelBooking>('/hotel-bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHotelBooking(id: number, data: Partial<HotelBooking>): Promise<HotelBooking> {
    return this.request<HotelBooking>(`/hotel-bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHotelBooking(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/hotel-bookings/${id}`, {
      method: 'DELETE',
    });
  }

  // --------------------------------------------------------------------------
  // Data Cleanup & Historical Purge (Preserves Client Profiles)
  // --------------------------------------------------------------------------
  async previewDataCleanup(options: {
    startDate?: string;
    endDate?: string;
    targets: PurgeTargets;
  }): Promise<PurgePreviewResult> {
    return this.request<PurgePreviewResult>('/data-cleanup/preview', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async purgeHistoricalData(options: {
    startDate?: string;
    endDate?: string;
    targets: PurgeTargets;
    confirmation: string;
  }): Promise<PurgeExecuteResult> {
    return this.request<PurgeExecuteResult>('/data-cleanup/purge', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // --------------------------------------------------------------------------
  // 1-Click Database SQL Backup & Restore
  // --------------------------------------------------------------------------
  async downloadSqlBackup(): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch('/api/db/backup', { headers });
    if (!response.ok) {
      let msg = 'Failed to download database backup';
      try {
        const err = await response.json();
        msg = err.error || msg;
      } catch {}
      throw new Error(msg);
    }
    return response.blob();
  }

  async restoreSqlBackup(dumpContent: string): Promise<{ message: string; restored: any }> {
    return this.request('/db/restore', {
      method: 'POST',
      body: JSON.stringify({ dumpContent }),
    });
  }
}

export const api = new ApiService();
