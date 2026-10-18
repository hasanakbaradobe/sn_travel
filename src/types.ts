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
  follow_ups?: Array<FollowUp>;
  invoices?: Array<Invoice>;
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

export type FollowUpChannel = 'WhatsApp' | 'Phone Call' | 'WeChat' | 'Email' | 'SMS';
export type FollowUpCadence = '1 Month' | '2 Months' | '3 Months' | '6 Months' | 'One-time';
export type FollowUpStatus = 'Pending' | 'Completed' | 'Cancelled';

export interface FollowUp {
  id: number;
  client_id: number;
  title: string;
  reason: string;
  channel: FollowUpChannel;
  cadence: FollowUpCadence;
  due_date: string; // YYYY-MM-DD
  notes?: string | null;
  message_template?: string | null;
  status: FollowUpStatus;
  priority: TaskPriority;
  task_id?: number | null;
  assigned_user_id?: number | null;
  completed_at?: string | null;
  completed_notes?: string | null;
  created_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_code?: string;
  passport_number?: string;
  client_phone?: string | null;
  client_whatsapp?: string | null;
  client_photo_url?: string | null;
  assigned_user_name?: string | null;
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
  follow_ups: boolean;
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
    follow_ups: number;
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
    follow_ups: number;
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
    follow_ups: number;
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
    follow_ups: number;
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

// --------------------------------------------------------------------------
// Invoicing System Interfaces
// --------------------------------------------------------------------------

export type InvoiceStatus = 'Pending' | 'Paid' | 'Partial' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Credit Card' | 'WeChat Pay' | 'Alipay' | 'Other';

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  catalog_item_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  client_name?: string;
  client_photo_url?: string | null;
  client_passport?: string;
  client_phone?: string;
  client_email?: string;
  client_address?: string;
  client_country?: string;
  client_code?: string;
  issue_date: string;
  due_date?: string | null;
  status: InvoiceStatus;
  payment_method?: PaymentMethod | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  notes?: string | null;
  items: InvoiceItem[];
  created_by_user_id?: number | null;
  created_by_user_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceCatalogItem {
  id: number;
  name: string;
  description?: string | null;
  default_unit_price: number;
  category?: string | null;
  is_active: number;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceSettings {
  id?: number;
  company_name: string;
  company_tagline?: string;
  logo_url?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  address?: string;
  tax_number?: string;
  bank_details?: string;
  payment_notes?: string;
  terms_and_conditions?: string;
  signature_enabled?: number;
  signature_name?: string;
  signature_designation?: string;
  signature_image_url?: string | null;
  signature_style?: 'script' | 'image' | 'line_only';
  default_currency: string;
  invoice_prefix: string;
  next_number: number;
  updated_at?: string;
}

// --------------------------------------------------------------------------
// Public Hotel Website CMS Types
// --------------------------------------------------------------------------
export type PublicSiteDeploymentStatus =
  | 'Draft'
  | 'Unpublished'
  | 'Deployment Requested'
  | 'Building'
  | 'Published'
  | 'Deployment Failed';

export interface HomepageSectionConfig {
  id: 'hero' | 'welcome' | 'featured_rooms' | 'facilities' | 'gallery' | 'about' | 'faq' | 'location' | 'contact';
  label: string;
  enabled: boolean;
  order: number;
}

export interface NavLinkItem {
  label: string;
  href: string;
  visible: boolean;
}

export interface SocialLinksConfig {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  wechat?: string;
  tripadvisor?: string;
}

export interface PublicSiteSettings {
  id: number;
  site_status: PublicSiteDeploymentStatus;
  has_unpublished_changes: number;
  hotel_name: string;
  tagline: string;
  short_description: string;
  about_title: string;
  about_content: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  accent_color: string;
  contact_phone: string;
  whatsapp_number: string;
  contact_email: string;
  address_line: string;
  city: string;
  country: string;
  postal_code: string;
  google_maps_url: string;
  google_maps_embed_url: string;
  social_links: SocialLinksConfig;
  reservation_url: string;
  reservation_button_text: string;
  check_in_time: string;
  check_out_time: string;
  cancellation_policy: string;
  general_policies: string;
  footer_text: string;
  copyright_text: string;
  hero_heading: string;
  hero_subtitle: string;
  hero_image_url: string;
  hero_cta_text: string;
  hero_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;
  welcome_heading: string;
  welcome_body: string;
  homepage_sections: HomepageSectionConfig[];
  nav_links: NavLinkItem[];
  footer_links: NavLinkItem[];
  seo_title: string;
  seo_description: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  canonical_domain: string;
  robots_indexing: string;
  sitemap_enabled: number;
  public_site_url: string;
  last_edited_by: number | null;
  last_edited_at: string;
  last_published_at: string | null;
  last_published_version: number | null;
  updated_at: string;
}

export interface PublicSitePage {
  id: number;
  slug: 'home' | 'about' | 'rooms' | 'facilities' | 'gallery' | 'location' | 'contact' | 'faq';
  title: string;
  heading: string;
  subheading: string;
  hero_image_url: string;
  content_body: string;
  structured_data: Record<string, any>;
  seo_title: string;
  seo_description: string;
  is_visible: number;
  show_in_nav: number;
  show_in_footer: number;
  display_order: number;
  updated_at: string;
}

export interface PublicSiteRoom {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  full_description: string;
  featured_image_url: string;
  gallery_images: string[];
  capacity: string;
  bed_type: string;
  room_size: string;
  amenities: string[];
  optional_price: number | null;
  currency: string;
  price_note: string;
  enquiry_url: string;
  is_featured: number;
  is_visible: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSiteFacility {
  id: number;
  name: string;
  category: string;
  description: string;
  icon_name: string;
  image_url: string;
  is_featured: number;
  is_visible: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSiteGalleryItem {
  id: number;
  title: string;
  caption: string;
  alt_text: string;
  category: string;
  image_url: string;
  is_featured: number;
  is_visible: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSiteFaq {
  id: number;
  question: string;
  answer: string;
  category: string;
  is_visible: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSitePublicationLog {
  id: number;
  version_number: number;
  snapshot_id: number;
  initiated_by_user_id: number | null;
  initiated_by_name: string;
  deployment_status: PublicSiteDeploymentStatus;
  build_hook_configured: number;
  build_hook_triggered: number;
  build_hook_http_status: number | null;
  netlify_deploy_id: string | null;
  netlify_deploy_state: string | null;
  netlify_deploy_url: string | null;
  verified_at: string | null;
  error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicWebsiteSnapshot {
  schema_version: '1.0';
  published_version: number;
  published_at: string;
  is_configured: boolean;
  hotel: {
    name: string;
    tagline: string;
    short_description: string;
    about_title: string;
    about_content: string;
    logo_url: string;
    favicon_url: string;
    primary_color: string;
    accent_color: string;
    contact_phone: string;
    whatsapp_number: string;
    contact_email: string;
    address_line: string;
    city: string;
    country: string;
    postal_code: string;
    google_maps_url: string;
    google_maps_embed_url: string;
    social_links: SocialLinksConfig;
    reservation_url: string;
    reservation_button_text: string;
    check_in_time: string;
    check_out_time: string;
    cancellation_policy: string;
    general_policies: string;
    footer_text: string;
    copyright_text: string;
  };
  homepage: {
    hero_heading: string;
    hero_subtitle: string;
    hero_image_url: string;
    hero_cta_text: string;
    hero_cta_link: string;
    hero_secondary_cta_text: string;
    hero_secondary_cta_link: string;
    welcome_heading: string;
    welcome_body: string;
    sections: HomepageSectionConfig[];
  };
  navigation: {
    header_links: NavLinkItem[];
    footer_links: NavLinkItem[];
  };
  seo: {
    title: string;
    description: string;
    og_title: string;
    og_description: string;
    og_image_url: string;
    canonical_domain: string;
    robots_indexing: string;
    sitemap_enabled: boolean;
  };
  pages: Array<{
    slug: string;
    title: string;
    heading: string;
    subheading: string;
    hero_image_url: string;
    content_body: string;
    structured_data: Record<string, any>;
    seo_title: string;
    seo_description: string;
    show_in_nav: boolean;
    show_in_footer: boolean;
    display_order: number;
  }>;
  rooms: Array<{
    id: number;
    name: string;
    slug: string;
    short_description: string;
    full_description: string;
    featured_image_url: string;
    gallery_images: string[];
    capacity: string;
    bed_type: string;
    room_size: string;
    amenities: string[];
    optional_price: number | null;
    currency: string;
    price_note: string;
    enquiry_url: string;
    is_featured: boolean;
    display_order: number;
  }>;
  facilities: Array<{
    id: number;
    name: string;
    category: string;
    description: string;
    icon_name: string;
    image_url: string;
    is_featured: boolean;
    display_order: number;
  }>;
  gallery: Array<{
    id: number;
    title: string;
    caption: string;
    alt_text: string;
    category: string;
    image_url: string;
    is_featured: boolean;
    display_order: number;
  }>;
  faqs: Array<{
    id: number;
    question: string;
    answer: string;
    category: string;
    display_order: number;
  }>;
}

export interface PublicSiteBootstrapResponse {
  settings: PublicSiteSettings;
  pages: PublicSitePage[];
  rooms: PublicSiteRoom[];
  facilities: PublicSiteFacility[];
  gallery: PublicSiteGalleryItem[];
  faqs: PublicSiteFaq[];
  publications: PublicSitePublicationLog[];
  latest_publication: PublicSitePublicationLog | null;
  latest_snapshot_meta: {
    id: number;
    version_number: number;
    snapshot_hash: string;
    published_by_name: string;
    created_at: string;
  } | null;
  env_status: {
    netlify_build_hook_configured: boolean;
    export_token_configured: boolean;
    netlify_status_api_configured: boolean;
  };
}


