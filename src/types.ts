/**
 * SN Travels Agency — Type Definitions
 * Shared across client and UI layers
 */

export type UserRole = 'super_admin' | 'admin' | 'staff';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active?: number;
  last_login_at?: string | null;
  created_at?: string;
}

export type ApplicationStatus =
  | 'Upcoming'
  | 'File Missing'
  | 'Need to Prepare'
  | 'Prepared'
  | 'Under Review'
  | 'Online Review Completed'
  | 'Modify'
  | 'Pending Collection'
  | 'Rejected'
  | 'Returned';

export const ALL_APPLICATION_STATUSES: ApplicationStatus[] = [
  'Upcoming',
  'File Missing',
  'Need to Prepare',
  'Prepared',
  'Under Review',
  'Online Review Completed',
  'Modify',
  'Pending Collection',
  'Rejected',
  'Returned',
];

export interface Client {
  id: number;
  client_id: string; // e.g. CL-000001
  full_name: string;
  passport_number: string;
  country: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  occupation?: string | null;
  notes?: string | null;
  google_drive_url?: string | null;
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
  application_count?: number;
  active_application?: {
    id: number;
    application_id: string;
    status: ApplicationStatus;
    visa_type: string | null;
    delivery_date?: string | null;
  } | null;
  next_task?: {
    id: number;
    title: string;
    due_date: string;
    priority: TaskPriority;
  } | null;
}

export interface ClientProfileDetails extends Client {
  custom_values: Array<{
    field_id: number;
    field_name: string;
    field_label: string;
    field_type: CustomFieldType;
    field_value: string;
  }>;
  applications: Array<VisaApplication & { visa_type_name: string; assigned_user_name: string | null }>;
  tasks: Array<Task & { assigned_user_name: string | null }>;
  hotel_bookings?: Array<HotelBooking>;
  comments: Array<Comment>;
  activity: Array<ActivityLog>;
}

export type CustomFieldType = 'text' | 'long_text' | 'number' | 'date' | 'dropdown' | 'checkbox';

export interface CustomField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: CustomFieldType;
  field_options?: string | null;
  is_required: number;
  is_active: number;
  display_order: number;
  created_at?: string;
}

export interface Country {
  id: number;
  name: string;
  code?: string | null;
  is_active: number;
  display_order?: number;
  created_at?: string;
}

export interface VisaType {
  id: number;
  name: string;
  description?: string | null;
  is_active: number;
  created_at?: string;
}

export interface VisaApplication {
  id: number;
  application_id: string; // e.g. APP-000001
  client_id: number;
  visa_type_id: number;
  status: ApplicationStatus;
  delivery_date?: string | null;
  notes?: string | null;
  assigned_user_id?: number | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_code?: string;
  passport_number?: string;
  country?: string;
  google_drive_url?: string | null;
  client_photo_url?: string | null;
  visa_type_name?: string;
  assigned_user_name?: string | null;
}

export interface ApplicationDetail extends VisaApplication {
  client?: Client;
  history: Array<{
    id: number;
    application_id: number;
    old_status: string | null;
    new_status: string;
    delivery_date: string | null;
    changed_by_user_id: number | null;
    user_name: string;
    notes: string | null;
    created_at: string;
  }>;
  tasks: Array<Task & { assigned_user_name: string | null }>;
}

export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type TaskStatus = 'Pending' | 'Completed';

export interface Task {
  id: number;
  title: string;
  description?: string | null;
  client_id?: number | null;
  application_id?: number | null;
  assigned_user_id?: number | null;
  due_date: string;
  priority: TaskPriority;
  status: TaskStatus;
  is_delivery_task: number;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
  client_code?: string | null;
  passport_number?: string | null;
  application_code?: string | null;
  assigned_user_name?: string | null;
}

export interface Comment {
  id: number;
  client_id: number;
  application_id?: number | null;
  user_id: number;
  user_name: string;
  user_role: UserRole;
  message: string;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  user_id?: number | null;
  user_name?: string;
  user_role?: UserRole;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  details?: string | null;
  created_at: string;
}

export interface DashboardMetrics {
  total_clients: number;
  active_applications: number;
  today_tasks: number;
  overdue_tasks: number;
  upcoming_tasks: number;
  apps_requiring_attention: Array<{
    id: number;
    application_id: string;
    status: ApplicationStatus;
    client_name: string;
    passport_number: string;
    visa_type_name: string;
  }>;
  recent_clients: Array<Client & { active_status: string }>;
  recent_activity: ActivityLog[];
}

export interface DatabaseStatus {
  connected_to_mysql: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  connection_error: string | null;
  engine: string;
  records: {
    clients: number;
    applications: number;
    tasks: number;
    users: number;
  };
}

export type HotelBookingStatus = 'Confirmed' | 'Checked In' | 'Checked Out' | 'Cancelled';

export interface HotelRoom {
  id: number;
  hotel_id: number;
  name: string;
  price_per_night?: number | null;
  currency?: string;
  capacity?: number;
  description?: string | null;
  is_active: number;
  created_at?: string;
}

export interface Hotel {
  id: number;
  name: string;
  city?: string | null;
  address?: string | null;
  star_rating?: number;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  is_active: number;
  rooms_count?: number;
  rooms?: HotelRoom[];
  created_at?: string;
}

export interface HotelBooking {
  id: number;
  booking_reference: string;
  client_id: number;
  hotel_id: number;
  room_type_id?: number | null;
  room_type_name?: string | null;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  guest_count: number;
  room_count: number;
  status: HotelBookingStatus;
  comment?: string | null;
  special_requests?: string | null;
  total_price?: number | null;
  currency?: string;
  checkout_task_id?: number | null;
  created_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_code?: string;
  passport_number?: string;
  client_photo_url?: string | null;
  hotel_name?: string;
  hotel_city?: string | null;
  hotel_address?: string | null;
  hotel_star_rating?: number;
  created_by_user_name?: string | null;
}

export interface ScannedPassportData {
  fullName: string;
  givenNames?: string;
  surname?: string;
  passportNumber: string;
  country: string;
  countryCode?: string;
  dateOfBirth?: string;
  dateOfExpiry?: string;
  gender?: string;
  nationality?: string;
  placeOfBirth?: string;
  mrzLine1?: string;
  mrzLine2?: string;
  confidenceScore: number;
  notes?: string;
  imagePreview?: string;
  ocrMethod: string;
  checksumStatus: 'verified' | 'repaired' | 'unverified';
  checkDigitsValid?: {
    documentNumber: boolean;
    dateOfBirth: boolean;
    dateOfExpiry: boolean;
    composite: boolean;
    allValid?: boolean;
  };
}

export interface PurgeTargets {
  applications: boolean;
  hotel_bookings: boolean;
  tasks: boolean;
  status_history: boolean;
  activity_logs: boolean;
}

export interface PurgePreviewResult {
  date_range: {
    start_date: string;
    end_date: string;
  };
  counts: {
    applications: number;
    hotel_bookings: number;
    tasks: number;
    status_history: number;
    activity_logs: number;
    total: number;
  };
  clients_preserved: number;
  current_records: {
    clients: number;
    applications: number;
    hotel_bookings: number;
    tasks: number;
    status_history: number;
    activity_logs: number;
  };
}

export interface PurgeExecuteResult {
  success: boolean;
  purged_counts: {
    applications: number;
    hotel_bookings: number;
    tasks: number;
    status_history: number;
    activity_logs: number;
    total: number;
  };
  clients_preserved: number;
  current_records: {
    clients: number;
    applications: number;
    hotel_bookings: number;
    tasks: number;
    status_history: number;
    activity_logs: number;
  };
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

