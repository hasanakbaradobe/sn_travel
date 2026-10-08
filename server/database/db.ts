/**
 * SN Travels Agency — Database Connection & Storage Engine
 * Connects to MySQL/MariaDB via mysql2 connection pool.
 * Provides fallback embedded relational store with disk persistence
 * so the application is immediately operational in any environment.
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Environment variables
const DB_HOST = process.env.DB_HOST;
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME || 'sn_travels_visa';

let pool: mysql.Pool | null = null;
let isConnectedToMySQL = false;
let connectionError: string | null = null;

// Try to initialize MySQL pool if host is configured
if (DB_HOST && DB_USER) {
  try {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      dateStrings: true,
    });
    
    // Quick probe
    pool.getConnection()
      .then(conn => {
        isConnectedToMySQL = true;
        connectionError = null;
        console.log(`[Database] Connected to MySQL database "${DB_NAME}" at ${DB_HOST}:${DB_PORT}`);
        conn.release();
        syncFromMySQL();
      })
      .catch(err => {
        isConnectedToMySQL = false;
        connectionError = err.message;
        console.warn(`[Database] MySQL connection failed (${err.message}). Using local relational store fallback.`);
      });
  } catch (err: any) {
    isConnectedToMySQL = false;
    connectionError = err.message;
    console.warn(`[Database] Failed to create MySQL pool (${err.message}). Using local store fallback.`);
  }
} else {
  console.log(`[Database] DB_HOST or DB_USER not provided in env. Active local database ready (MySQL schema available for phpMyAdmin).`);
}

// --------------------------------------------------------------------------
// Local Relational In-Memory / File Persistent Store
// --------------------------------------------------------------------------
interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'super_admin' | 'admin' | 'staff';
  is_active: number;
  last_login_at?: string | null;
  created_at: string;
}

interface Client {
  id: number;
  client_id: string;
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
}

interface Country {
  id: number;
  name: string;
  code?: string | null;
  is_active: number;
  display_order: number;
  created_at: string;
}

interface CustomField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'long_text' | 'number' | 'date' | 'dropdown' | 'checkbox';
  field_options?: string | null;
  is_required: number;
  is_active: number;
  display_order: number;
  created_at: string;
}

interface CustomFieldValue {
  id: number;
  client_id: number;
  field_id: number;
  field_value: string;
  created_at: string;
}

interface VisaType {
  id: number;
  name: string;
  description?: string | null;
  is_active: number;
  created_at: string;
}

interface VisaApplication {
  id: number;
  application_id: string;
  client_id: number;
  visa_type_id: number;
  status: string;
  delivery_date?: string | null;
  notes?: string | null;
  assigned_user_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface ApplicationStatusHistory {
  id: number;
  application_id: number;
  old_status?: string | null;
  new_status: string;
  delivery_date?: string | null;
  changed_by_user_id?: number | null;
  notes?: string | null;
  created_at: string;
}

interface Task {
  id: number;
  title: string;
  description?: string | null;
  client_id?: number | null;
  application_id?: number | null;
  assigned_user_id?: number | null;
  due_date: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  status: 'Pending' | 'Completed';
  is_delivery_task: number;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: number;
  client_id: number;
  application_id?: number | null;
  user_id: number;
  message: string;
  created_at: string;
}

interface ActivityLog {
  id: number;
  user_id?: number | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  details?: string | null;
  created_at: string;
}

interface Hotel {
  id: number;
  name: string;
  city?: string | null;
  address?: string | null;
  star_rating?: number;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface HotelRoom {
  id: number;
  hotel_id: number;
  name: string;
  price_per_night?: number | null;
  currency?: string;
  capacity?: number;
  description?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface HotelBooking {
  id: number;
  booking_reference: string;
  client_id: number;
  hotel_id: number;
  room_type_id?: number | null;
  room_type_name?: string | null;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  room_count: number;
  status: 'Confirmed' | 'Checked In' | 'Checked Out' | 'Cancelled';
  comment?: string | null;
  special_requests?: string | null;
  total_price?: number | null;
  currency?: string;
  checkout_task_id?: number | null;
  created_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface Setting {
  id: number;
  setting_key: string;
  setting_value: string;
  updated_at: string;
}

interface StoreData {
  users: User[];
  countries: Country[];
  clients: Client[];
  client_custom_fields: CustomField[];
  client_custom_field_values: CustomFieldValue[];
  visa_types: VisaType[];
  visa_applications: VisaApplication[];
  application_status_history: ApplicationStatusHistory[];
  tasks: Task[];
  comments: Comment[];
  activity_logs: ActivityLog[];
  hotels: Hotel[];
  hotel_rooms: HotelRoom[];
  hotel_bookings: HotelBooking[];
  settings: Setting[];
  nextIds: { [table: string]: number };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db-store.json');

function getInitialData(): StoreData {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const inTwoDays = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  return {
    users: [
      {
        id: 1,
        name: 'Sarah Nadeem (Managing Director)',
        email: 'admin@sn-travelsagency.com',
        password_hash: 'admin123456',
        role: 'super_admin',
        is_active: 1,
        created_at: now,
      },
      {
        id: 2,
        name: 'Farhan Qureshi (Senior Visa Officer)',
        email: 'staff@sn-travelsagency.com',
        password_hash: 'staff123456',
        role: 'staff',
        is_active: 1,
        created_at: now,
      },
      {
        id: 3,
        name: 'Lin Chen (China Desk Specialist)',
        email: 'lin.chen@sn-travelsagency.com',
        password_hash: 'staff123456',
        role: 'staff',
        is_active: 1,
        created_at: now,
      },
    ],
    countries: [
      { id: 1, name: 'United Arab Emirates', code: 'AE', is_active: 1, display_order: 1, created_at: now },
      { id: 2, name: 'Pakistan', code: 'PK', is_active: 1, display_order: 2, created_at: now },
      { id: 3, name: 'India', code: 'IN', is_active: 1, display_order: 3, created_at: now },
      { id: 4, name: 'Russia', code: 'RU', is_active: 1, display_order: 4, created_at: now },
      { id: 5, name: 'United Kingdom', code: 'GB', is_active: 1, display_order: 5, created_at: now },
      { id: 6, name: 'Malaysia', code: 'MY', is_active: 1, display_order: 6, created_at: now },
      { id: 7, name: 'Saudi Arabia', code: 'SA', is_active: 1, display_order: 7, created_at: now },
      { id: 8, name: 'China', code: 'CN', is_active: 1, display_order: 8, created_at: now },
      { id: 9, name: 'Oman', code: 'OM', is_active: 1, display_order: 9, created_at: now },
      { id: 10, name: 'Qatar', code: 'QA', is_active: 1, display_order: 10, created_at: now },
      { id: 11, name: 'Turkey', code: 'TR', is_active: 1, display_order: 11, created_at: now },
      { id: 12, name: 'Egypt', code: 'EG', is_active: 1, display_order: 12, created_at: now },
      { id: 13, name: 'Canada', code: 'CA', is_active: 1, display_order: 13, created_at: now },
      { id: 14, name: 'United States', code: 'US', is_active: 1, display_order: 14, created_at: now },
      { id: 15, name: 'Germany', code: 'DE', is_active: 1, display_order: 15, created_at: now },
      { id: 16, name: 'Bangladesh', code: 'BD', is_active: 1, display_order: 16, created_at: now },
      { id: 17, name: 'Australia', code: 'AU', is_active: 1, display_order: 17, created_at: now },
      { id: 18, name: 'Singapore', code: 'SG', is_active: 1, display_order: 18, created_at: now },
      { id: 19, name: 'Iran', code: 'IR', is_active: 1, display_order: 19, created_at: now },
      { id: 20, name: 'Philippines', code: 'PH', is_active: 1, display_order: 20, created_at: now },
    ],
    visa_types: [
      { id: 1, name: 'L - Tourist Visa', description: 'For leisure travel, sightseeing, and personal visits to China', is_active: 1, created_at: now },
      { id: 2, name: 'M - Commercial Trade / Business Visa', description: 'For commercial and trade activities, business meetings, and supplier visits', is_active: 1, created_at: now },
      { id: 3, name: 'X1/X2 - Student Visa', description: 'Study at accredited Chinese universities (JW202/JW201 form)', is_active: 1, created_at: now },
      { id: 4, name: 'Z - Work Visa', description: 'Work permit holder employment and commercial engagement in China', is_active: 1, created_at: now },
      { id: 5, name: 'Q1/Q2 - Family Reunion Visa', description: 'For family members of Chinese citizens or permanent residents', is_active: 1, created_at: now },
      { id: 6, name: 'F - Non-commercial Exchange Visa', description: 'Academic conferences, lectures, and cultural exchanges', is_active: 1, created_at: now },
      { id: 7, name: 'Other Special Category', description: 'Diplomatic, transit, crew, or specialized permits', is_active: 1, created_at: now },
    ],
    client_custom_fields: [
      { id: 1, field_name: 'employer', field_label: 'Employer / Company Name', field_type: 'text', field_options: null, is_required: 0, is_active: 1, display_order: 1, created_at: now },
      { id: 2, field_name: 'visa_history', field_label: 'Previous China Visa History', field_type: 'dropdown', field_options: 'Never Visited, 1-2 Times, Frequent Traveler (3+ Times), Has Expired Visa in Old Passport', is_required: 0, is_active: 1, display_order: 2, created_at: now },
      { id: 3, field_name: 'travel_history', field_label: 'Past 3 Years Travel History', field_type: 'long_text', field_options: null, is_required: 0, is_active: 1, display_order: 3, created_at: now },
      { id: 4, field_name: 'marital_status', field_label: 'Marital Status', field_type: 'dropdown', field_options: 'Single, Married, Divorced, Widowed', is_required: 0, is_active: 1, display_order: 4, created_at: now },
      { id: 5, field_name: 'chinese_contact', field_label: 'Chinese Inviting Entity / Contact', field_type: 'text', field_options: null, is_required: 0, is_active: 1, display_order: 5, created_at: now },
      { id: 6, field_name: 'invitation_source', field_label: 'Invitation Letter Source (PU / Official)', field_type: 'dropdown', field_options: 'Official Government PU Letter, Corporate Partner Invitation, University Admission Notice (JW202), Family Invitation, None Required', is_required: 0, is_active: 1, display_order: 6, created_at: now },
    ],
    clients: [
      {
        id: 1,
        client_id: 'CL-000001',
        full_name: 'Ahmed Mohamed Al-Mansoor',
        passport_number: 'P98421054',
        country: 'United Arab Emirates',
        phone: '+971 50 123 4567',
        whatsapp: '+971 50 123 4567',
        email: 'ahmed.mansoor@almansoorgroup.com',
        date_of_birth: '1984-06-15',
        address: 'Villa 42, Al Barsha 2, Dubai, UAE',
        occupation: 'Managing Director - Trade Import',
        notes: 'Frequent business visitor to Guangzhou and Yiwu wholesale markets. Urgently requires M visa.',
        google_drive_url: 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345',
        photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces',
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        client_id: 'CL-000002',
        full_name: 'Elena Rostova',
        passport_number: 'RU72019482',
        country: 'Russia',
        phone: '+7 916 555 0192',
        whatsapp: '+7 916 555 0192',
        email: 'elena.rostova@artdesign.ru',
        date_of_birth: '1992-11-03',
        address: 'Tverskaya St 18, Moscow',
        occupation: 'Interior Designer & Buyer',
        notes: 'Visiting Beijing Design Week and Shanghai furniture suppliers. Photos uploaded to Drive.',
        google_drive_url: 'https://drive.google.com/drive/folders/1bCdEfGhIjKlMnOpQrStUvWxYzA987654',
        photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces',
        created_at: now,
        updated_at: now,
      },
      {
        id: 3,
        client_id: 'CL-000003',
        full_name: 'Kavita Sundaram',
        passport_number: 'M40192837',
        country: 'India',
        phone: '+91 98200 45123',
        whatsapp: '+91 98200 45123',
        email: 'kavita.s@biotechventures.in',
        date_of_birth: '1989-03-22',
        address: 'Indiranagar 100ft Road, Bengaluru',
        occupation: 'Biotech Researcher',
        notes: 'Invited to Tsinghua University for a 2-week symposium. Need F visa processing.',
        google_drive_url: 'https://drive.google.com/drive/folders/1cDeFgHiJkLmNoPqRsTuVwXyZaB567890',
        photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces',
        created_at: now,
        updated_at: now,
      },
      {
        id: 4,
        client_id: 'CL-000004',
        full_name: 'David Michael Harrison',
        passport_number: 'GB551982740',
        country: 'United Kingdom',
        phone: '+44 7700 900142',
        whatsapp: '+44 7700 900142',
        email: 'david.harrison@londonlogistics.co.uk',
        date_of_birth: '1978-09-14',
        address: '24 Kensington Church Street, London',
        occupation: 'Supply Chain Director',
        notes: 'Regular cargo inspection in Ningbo. Passport valid until 2031.',
        google_drive_url: 'https://drive.google.com/drive/folders/1dEfGhIjKlMnOpQrStUvWxYzAbC112233',
        photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces',
        created_at: now,
        updated_at: now,
      },
      {
        id: 5,
        client_id: 'CL-000005',
        full_name: 'Li Wei Chen',
        passport_number: 'MYA4928105',
        country: 'Malaysia',
        phone: '+60 12 345 6789',
        whatsapp: '+60 12 345 6789',
        email: 'chen.lw@sinopacific.com.my',
        date_of_birth: '1995-01-30',
        address: 'Jalan Ampang, Kuala Lumpur',
        occupation: 'Student / Candidate',
        notes: 'Enrolling in Zhejiang University for Master degree. JW202 form verified.',
        google_drive_url: 'https://drive.google.com/drive/folders/1eFgHiJkLmNoPqRsTuVwXyZabCd445566',
        photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&crop=faces',
        created_at: now,
        updated_at: now,
      },
    ],
    client_custom_field_values: [
      { id: 1, client_id: 1, field_id: 1, field_value: 'Al-Mansoor Trading LLC', created_at: now },
      { id: 2, client_id: 1, field_id: 2, field_value: 'Frequent Traveler (3+ Times)', created_at: now },
      { id: 3, client_id: 1, field_id: 3, field_value: 'China (2024, 2025), Turkey, Germany, Singapore', created_at: now },
      { id: 4, client_id: 1, field_id: 4, field_value: 'Married', created_at: now },
      { id: 5, client_id: 1, field_id: 5, field_value: 'Guangzhou International Trade Center, Mr. Wang', created_at: now },
      { id: 6, client_id: 1, field_id: 6, field_value: 'Corporate Partner Invitation', created_at: now },
      { id: 7, client_id: 2, field_id: 1, field_value: 'Studio Rostova Design', created_at: now },
      { id: 8, client_id: 2, field_id: 2, field_value: '1-2 Times', created_at: now },
      { id: 9, client_id: 2, field_id: 4, field_value: 'Single', created_at: now },
      { id: 10, client_id: 3, field_id: 1, field_value: 'Biotech Ventures India Pvt Ltd', created_at: now },
      { id: 11, client_id: 3, field_id: 2, field_value: 'Never Visited', created_at: now },
      { id: 12, client_id: 3, field_id: 5, field_value: 'Tsinghua University School of Life Sciences', created_at: now },
      { id: 13, client_id: 3, field_id: 6, field_value: 'Corporate Partner Invitation', created_at: now },
    ],
    visa_applications: [
      {
        id: 1,
        application_id: 'APP-000001',
        client_id: 1,
        visa_type_id: 2,
        status: 'Online Review Completed',
        delivery_date: inTwoDays,
        notes: 'Online application submitted on COVA portal. Appointment scheduled. Scheduled for passport dispatch and collection.',
        assigned_user_id: 2,
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        application_id: 'APP-000002',
        client_id: 2,
        visa_type_id: 1,
        status: 'Under Review',
        delivery_date: null,
        notes: 'Chinese Visa Application Service Center (CVASC) reviewing invitation and round-trip flight booking.',
        assigned_user_id: 2,
        created_at: now,
        updated_at: now,
      },
      {
        id: 3,
        application_id: 'APP-000003',
        client_id: 3,
        visa_type_id: 6,
        status: 'Need to Prepare',
        delivery_date: null,
        notes: 'Awaiting official invitation letter with Chinese seal from Tsinghua host department.',
        assigned_user_id: 3,
        created_at: now,
        updated_at: now,
      },
      {
        id: 4,
        application_id: 'APP-000004',
        client_id: 4,
        visa_type_id: 2,
        status: 'Pending Collection',
        delivery_date: tomorrow,
        notes: 'Visa stamped by embassy. Passport currently at agency desk ready for courier or pickup.',
        assigned_user_id: 2,
        created_at: now,
        updated_at: now,
      },
      {
        id: 5,
        application_id: 'APP-000005',
        client_id: 5,
        visa_type_id: 3,
        status: 'Prepared',
        delivery_date: null,
        notes: 'Original JW202 form and university admission letter notarized. Ready for portal upload.',
        assigned_user_id: 3,
        created_at: now,
        updated_at: now,
      },
    ],
    application_status_history: [
      { id: 1, application_id: 1, old_status: 'Upcoming', new_status: 'Need to Prepare', delivery_date: null, changed_by_user_id: 1, notes: 'Case opened at SN Travels Dubai office', created_at: yesterday },
      { id: 2, application_id: 1, old_status: 'Need to Prepare', new_status: 'Prepared', delivery_date: null, changed_by_user_id: 2, notes: 'Scanned all documents into Drive', created_at: yesterday },
      { id: 3, application_id: 1, old_status: 'Prepared', new_status: 'Under Review', delivery_date: null, changed_by_user_id: 2, notes: 'Submitted to CVASC', created_at: yesterday },
      { id: 4, application_id: 1, old_status: 'Under Review', new_status: 'Online Review Completed', delivery_date: inTwoDays, changed_by_user_id: 2, notes: 'Online review completed. Delivery scheduled.', created_at: now },
    ],
    tasks: [
      {
        id: 1,
        title: 'Delivery - Ahmed Mohamed Al-Mansoor',
        description: 'Deliver issued M Commercial Visa and passport to client office or prepare for counter pickup.',
        client_id: 1,
        application_id: 1,
        assigned_user_id: 2,
        due_date: inTwoDays,
        priority: 'High',
        status: 'Pending',
        is_delivery_task: 1,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        title: 'Verify Tsinghua Invitation Letter Seal',
        description: 'Call host coordinator in Beijing to request updated color scan with red institutional seal.',
        client_id: 3,
        application_id: 3,
        assigned_user_id: 3,
        due_date: today,
        priority: 'Urgent',
        status: 'Pending',
        is_delivery_task: 0,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 3,
        title: 'Check CVASC biometric appointment slot',
        description: 'Elena Rostova requires biometric submission slot at visa center on Monday.',
        client_id: 2,
        application_id: 2,
        assigned_user_id: 2,
        due_date: tomorrow,
        priority: 'Normal',
        status: 'Pending',
        is_delivery_task: 0,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 4,
        title: 'Passport Courier Dispatch to London Client',
        description: 'Hand over David Harrison stamped passport to DHL Express tracking number.',
        client_id: 4,
        application_id: 4,
        assigned_user_id: 2,
        due_date: today,
        priority: 'High',
        status: 'Completed',
        is_delivery_task: 0,
        completed_at: now,
        created_at: yesterday,
        updated_at: now,
      },
    ],
    comments: [
      {
        id: 1,
        client_id: 1,
        application_id: 1,
        user_id: 2,
        message: 'Client visited SN Travels Dubai office. Provided 2 recent white background passport photos according to Chinese embassy 33x48mm spec.',
        created_at: yesterday,
      },
      {
        id: 2,
        client_id: 1,
        application_id: 1,
        user_id: 1,
        message: 'Online COVA form approved. Delivery date confirmed with visa courier.',
        created_at: now,
      },
      {
        id: 3,
        client_id: 3,
        application_id: 3,
        user_id: 3,
        message: 'Client will provide missing bank statement tomorrow morning via WhatsApp/Drive.',
        created_at: yesterday,
      },
    ],
    activity_logs: [
      { id: 1, user_id: 1, action: 'CREATE_CLIENT', entity_type: 'CLIENT', entity_id: 1, details: 'Created client Ahmed Mohamed Al-Mansoor (CL-000001)', created_at: yesterday },
      { id: 2, user_id: 2, action: 'CREATE_APPLICATION', entity_type: 'APPLICATION', entity_id: 1, details: 'Created M Business Visa application (APP-000001)', created_at: yesterday },
      { id: 3, user_id: 2, action: 'STATUS_CHANGE', entity_type: 'APPLICATION', entity_id: 1, details: 'Status changed to Online Review Completed. Delivery task generated.', created_at: now },
    ],
    hotels: [
      {
        id: 1,
        name: 'Grand Hyatt Shanghai',
        city: 'Shanghai',
        address: 'Jin Mao Tower, 88 Century Avenue, Pudong New Area',
        star_rating: 5,
        phone: '+86 21 5049 1234',
        email: 'shanghai.grand@hyatt.com',
        notes: 'Prime commercial district hotel in Pudong with panoramic Bund views',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        name: 'The Peninsula Beijing',
        city: 'Beijing',
        address: '8 Goldfish Lane, Wangfujing, Dongcheng District',
        star_rating: 5,
        phone: '+86 10 8516 2888',
        email: 'pbj@peninsula.com',
        notes: 'Located in central Beijing minutes from Tiananmen and Forbidden City',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 3,
        name: 'Four Seasons Hotel Guangzhou',
        city: 'Guangzhou',
        address: '5 Zhujiang West Road, Tianhe District',
        star_rating: 5,
        phone: '+86 20 8883 3888',
        email: 'guangzhou@fourseasons.com',
        notes: 'Next to Canton Fair transit and Guangzhou International Finance Center',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 4,
        name: 'JW Marriott Hotel Beijing Central',
        city: 'Beijing',
        address: '18 Xuanwumen Outer Street, Xicheng District',
        star_rating: 5,
        phone: '+86 10 6391 6666',
        email: 'jw.beijing@marriott.com',
        notes: 'Convenient for commercial trade travelers and government meetings',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 5,
        name: 'Holiday Inn Express Shanghai Pudong',
        city: 'Shanghai',
        address: 'No. 399 Pudian Road, Pudong',
        star_rating: 4,
        phone: '+86 21 5830 8888',
        email: 'shanghai@hiexpress.com',
        notes: 'Clean modern corporate partner with fast subway access',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
    ],
    hotel_rooms: [
      { id: 1, hotel_id: 1, name: 'Grand King Room', price_per_night: 220, currency: 'USD', capacity: 2, description: '40 sqm king bed with city skyline view and marble bath', is_active: 1, created_at: now, updated_at: now },
      { id: 2, hotel_id: 1, name: 'Club River View Twin', price_per_night: 310, currency: 'USD', capacity: 2, description: 'Twin beds with Huangpu River views and Grand Club lounge', is_active: 1, created_at: now, updated_at: now },
      { id: 3, hotel_id: 1, name: 'Executive Suite', price_per_night: 450, currency: 'USD', capacity: 3, description: 'Living room and panoramic skyline vistas', is_active: 1, created_at: now, updated_at: now },
      { id: 4, hotel_id: 2, name: 'Superior King Suite', price_per_night: 290, currency: 'USD', capacity: 2, description: 'Chinese silk artistry with private dressing area', is_active: 1, created_at: now, updated_at: now },
      { id: 5, hotel_id: 2, name: 'Premier Twin Suite', price_per_night: 350, currency: 'USD', capacity: 2, description: 'Two twin beds with traditional courtyard aesthetics', is_active: 1, created_at: now, updated_at: now },
      { id: 6, hotel_id: 3, name: 'Tower View King Room', price_per_night: 240, currency: 'USD', capacity: 2, description: 'Floor-to-ceiling windows overlooking Canton Tower', is_active: 1, created_at: now, updated_at: now },
      { id: 7, hotel_id: 3, name: 'Deluxe Executive Twin', price_per_night: 320, currency: 'USD', capacity: 2, description: 'Executive lounge perks with complimentary breakfast', is_active: 1, created_at: now, updated_at: now },
      { id: 8, hotel_id: 4, name: 'Deluxe Business King', price_per_night: 180, currency: 'USD', capacity: 2, description: 'Spacious desk and high-speed executive WiFi', is_active: 1, created_at: now, updated_at: now },
      { id: 9, hotel_id: 5, name: 'Standard Queen Room', price_per_night: 95, currency: 'USD', capacity: 2, description: 'Clean modern room with buffet breakfast included', is_active: 1, created_at: now, updated_at: now },
    ],
    hotel_bookings: [
      {
        id: 1,
        booking_reference: 'HB-000001',
        client_id: 1,
        hotel_id: 1,
        room_type_id: 1,
        room_type_name: 'Grand King Room',
        check_in_date: today,
        check_out_date: inTwoDays,
        guest_count: 1,
        room_count: 1,
        status: 'Confirmed',
        comment: 'Client requested high floor quiet room. Airport transfer arranged by SN Travels.',
        special_requests: 'High floor, non-smoking, late check-in ~21:00',
        total_price: 440,
        currency: 'USD',
        checkout_task_id: null,
        created_by_user_id: 1,
        created_at: now,
        updated_at: now,
      },
    ],
    settings: [
      { id: 1, setting_key: 'agency_name', setting_value: 'SN Travels Agency', updated_at: now },
      { id: 2, setting_key: 'secret_login_enabled', setting_value: '1', updated_at: now },
      { id: 3, setting_key: 'secret_login_key', setting_value: 'sn-secure-staff-2026', updated_at: now },
    ],
    nextIds: {
      users: 4,
      countries: 21,
      clients: 6,
      client_custom_fields: 7,
      client_custom_field_values: 14,
      visa_types: 8,
      visa_applications: 6,
      application_status_history: 5,
      tasks: 6,
      comments: 4,
      activity_logs: 4,
      hotels: 6,
      hotel_rooms: 10,
      hotel_bookings: 2,
      settings: 4,
    },
  };
}

let store: StoreData;

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      let needsSave = false;
      if (!parsed.countries || parsed.countries.length === 0) {
        parsed.countries = getInitialData().countries;
        parsed.nextIds = parsed.nextIds || {};
        parsed.nextIds.countries = 21;
        needsSave = true;
      }
      if (!parsed.hotels || parsed.hotels.length === 0) {
        const init = getInitialData();
        parsed.hotels = init.hotels;
        parsed.hotel_rooms = init.hotel_rooms;
        parsed.hotel_bookings = init.hotel_bookings;
        parsed.nextIds = parsed.nextIds || {};
        parsed.nextIds.hotels = init.nextIds.hotels;
        parsed.nextIds.hotel_rooms = init.nextIds.hotel_rooms;
        parsed.nextIds.hotel_bookings = init.nextIds.hotel_bookings;
        needsSave = true;
      }
      if (!parsed.settings || parsed.settings.length === 0) {
        const init = getInitialData();
        parsed.settings = init.settings;
        parsed.nextIds = parsed.nextIds || {};
        parsed.nextIds.settings = init.nextIds.settings;
        needsSave = true;
      }
      if (needsSave) {
        saveStore(parsed);
      }
      return parsed;
    }
  } catch (err) {
    console.error('[Database] Failed to read store file:', err);
  }
  const initial = getInitialData();
  saveStore(initial);
  return initial;
}

function saveStore(dataToSave: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write store file:', err);
  }
}

store = loadStore();

async function deleteClientFromMySQL(id: number, clientIdString?: string): Promise<boolean> {
  if (!pool || !isConnectedToMySQL) return false;

  try {
    console.log(`[MySQL] Initiating deletion of client ID ${id} (${clientIdString || ''}) from MySQL...`);

    // 1. Get all visa application IDs for this client
    let appIds: number[] = [];
    try {
      const [appRows]: any = await pool.query('SELECT id FROM visa_applications WHERE client_id = ?', [id]);
      if (Array.isArray(appRows) && appRows.length > 0) {
        appIds = appRows.map((r: any) => r.id);
      }
    } catch (e: any) {
      console.warn('[MySQL] Could not query visa_applications:', e.message);
    }

    // 2. Delete dependent rows in proper cascade order
    if (appIds.length > 0) {
      try {
        await pool.query('DELETE FROM application_status_history WHERE application_id IN (?)', [appIds]);
      } catch (e: any) {
        console.warn('[MySQL] Could not delete application_status_history:', e.message);
      }
      try {
        await pool.query('DELETE FROM tasks WHERE application_id IN (?)', [appIds]);
      } catch (e: any) {
        console.warn('[MySQL] Could not delete tasks by application_id:', e.message);
      }
      try {
        await pool.query('DELETE FROM comments WHERE application_id IN (?)', [appIds]);
      } catch (e: any) {
        console.warn('[MySQL] Could not delete comments by application_id:', e.message);
      }
    }

    // 3. Delete tasks and comments directly linked to client
    try {
      await pool.query('DELETE FROM tasks WHERE client_id = ?', [id]);
    } catch (e: any) {
      console.warn('[MySQL] Could not delete tasks by client_id:', e.message);
    }
    try {
      await pool.query('DELETE FROM comments WHERE client_id = ?', [id]);
    } catch (e: any) {
      console.warn('[MySQL] Could not delete comments by client_id:', e.message);
    }

    // 4. Delete hotel bookings linked to client
    try {
      await pool.query('DELETE FROM hotel_bookings WHERE client_id = ?', [id]);
    } catch (e: any) {
      console.warn('[MySQL] Could not delete hotel_bookings:', e.message);
    }

    // 5. Delete visa applications linked to client
    try {
      await pool.query('DELETE FROM visa_applications WHERE client_id = ?', [id]);
    } catch (e: any) {
      console.warn('[MySQL] Could not delete visa_applications:', e.message);
    }

    // 6. Delete custom field values linked to client
    try {
      await pool.query('DELETE FROM client_custom_field_values WHERE client_id = ?', [id]);
    } catch (e: any) {
      console.warn('[MySQL] Could not delete client_custom_field_values:', e.message);
    }

    // 7. Finally delete the client row from MySQL
    let [res]: any = await pool.query('DELETE FROM clients WHERE id = ?', [id]);
    if ((!res || res.affectedRows === 0) && clientIdString) {
      const [res2]: any = await pool.query('DELETE FROM clients WHERE client_id = ?', [clientIdString]);
      res = res2;
    }

    console.log(`[MySQL] Successfully deleted client ${id} from MySQL database (affectedRows: ${res?.affectedRows})`);
    return true;
  } catch (err: any) {
    console.warn(`[MySQL] Standard delete encountered error (${err.message}). Retrying with FOREIGN_KEY_CHECKS = 0...`);
    try {
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      await pool.query('DELETE FROM clients WHERE id = ?', [id]);
      if (clientIdString) {
        await pool.query('DELETE FROM clients WHERE client_id = ?', [clientIdString]);
      }
      await pool.query('DELETE FROM client_custom_field_values WHERE client_id = ?', [id]);
      await pool.query('DELETE FROM visa_applications WHERE client_id = ?', [id]);
      await pool.query('DELETE FROM tasks WHERE client_id = ?', [id]);
      await pool.query('DELETE FROM comments WHERE client_id = ?', [id]);
      await pool.query('DELETE FROM hotel_bookings WHERE client_id = ?', [id]);
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log(`[MySQL] Successfully deleted client ${id} with FOREIGN_KEY_CHECKS = 0 fallback`);
      return true;
    } catch (fbErr: any) {
      console.error(`[MySQL] Failed to delete client ${id} from MySQL:`, fbErr.message);
      throw fbErr;
    }
  }
}

async function syncFromMySQL() {
  if (!pool || !isConnectedToMySQL) return;
  try {
    const [u]: any = await pool.query('SELECT * FROM users');
    if (Array.isArray(u) && u.length > 0) store.users = u;

    const [c]: any = await pool.query('SELECT * FROM countries ORDER BY display_order ASC, name ASC');
    if (Array.isArray(c) && c.length > 0) store.countries = c;

    const [cl]: any = await pool.query('SELECT * FROM clients');
    if (Array.isArray(cl)) {
      store.clients = cl.map((item: any) => ({
        ...item,
        date_of_birth: item.date_of_birth ? String(item.date_of_birth).slice(0, 10) : null,
      }));
    }

    const [cf]: any = await pool.query('SELECT * FROM client_custom_fields ORDER BY display_order ASC');
    if (Array.isArray(cf) && cf.length > 0) store.client_custom_fields = cf;

    const [cfv]: any = await pool.query('SELECT * FROM client_custom_field_values');
    if (Array.isArray(cfv)) store.client_custom_field_values = cfv;

    const [vt]: any = await pool.query('SELECT * FROM visa_types');
    if (Array.isArray(vt) && vt.length > 0) store.visa_types = vt;

    const [va]: any = await pool.query('SELECT * FROM visa_applications');
    if (Array.isArray(va)) {
      store.visa_applications = va.map((item: any) => ({
        ...item,
        delivery_date: item.delivery_date ? String(item.delivery_date).slice(0, 10) : null,
      }));
    }

    const [ash]: any = await pool.query('SELECT * FROM application_status_history');
    if (Array.isArray(ash)) store.application_status_history = ash;

    const [t]: any = await pool.query('SELECT * FROM tasks');
    if (Array.isArray(t)) {
      store.tasks = t.map((item: any) => ({
        ...item,
        due_date: item.due_date ? String(item.due_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      }));
    }

    const [cm]: any = await pool.query('SELECT * FROM comments');
    if (Array.isArray(cm)) store.comments = cm;

    const [al]: any = await pool.query('SELECT * FROM activity_logs');
    if (Array.isArray(al)) store.activity_logs = al;

    const [h]: any = await pool.query('SELECT * FROM hotels');
    if (Array.isArray(h) && h.length > 0) store.hotels = h;

    const [hr]: any = await pool.query('SELECT * FROM hotel_rooms');
    if (Array.isArray(hr)) store.hotel_rooms = hr;

    const [hb]: any = await pool.query('SELECT * FROM hotel_bookings');
    if (Array.isArray(hb)) {
      store.hotel_bookings = hb.map((item: any) => ({
        ...item,
        check_in_date: item.check_in_date ? String(item.check_in_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        check_out_date: item.check_out_date ? String(item.check_out_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      }));
    }

    const [s]: any = await pool.query('SELECT * FROM settings');
    if (Array.isArray(s) && s.length > 0) store.settings = s;

    // Recalculate nextIds safely
    store.nextIds = {
      users: Math.max(...store.users.map(x => x.id), 0) + 1,
      countries: Math.max(...store.countries.map(x => x.id), 0) + 1,
      clients: Math.max(...store.clients.map(x => x.id), 0) + 1,
      client_custom_fields: Math.max(...store.client_custom_fields.map(x => x.id), 0) + 1,
      client_custom_field_values: Math.max(...store.client_custom_field_values.map(x => x.id || 0), 0) + 1,
      visa_types: Math.max(...store.visa_types.map(x => x.id), 0) + 1,
      visa_applications: Math.max(...store.visa_applications.map(x => x.id), 0) + 1,
      application_status_history: Math.max(...store.application_status_history.map(x => x.id || 0), 0) + 1,
      tasks: Math.max(...store.tasks.map(x => x.id), 0) + 1,
      comments: Math.max(...store.comments.map(x => x.id || 0), 0) + 1,
      activity_logs: Math.max(...store.activity_logs.map(x => x.id || 0), 0) + 1,
      hotels: Math.max(...(store.hotels || []).map(x => x.id), 0) + 1,
      hotel_rooms: Math.max(...(store.hotel_rooms || []).map(x => x.id), 0) + 1,
      hotel_bookings: Math.max(...(store.hotel_bookings || []).map(x => x.id), 0) + 1,
      settings: Math.max(...(store.settings || []).map(x => x.id), 0) + 1,
    };

    saveStore(store);
    console.log(`[Database] Synchronized live data from MySQL "${DB_NAME}" (${store.clients.length} clients, ${store.users.length} users, ${store.settings.length} settings)`);
  } catch (err: any) {
    console.warn('[Database] Sync from MySQL encountered an issue:', err.message);
  }
}

// --------------------------------------------------------------------------
// Database Interface Service
// --------------------------------------------------------------------------
export const dbService = {
  getStatus() {
    return {
      connected_to_mysql: isConnectedToMySQL,
      host: DB_HOST || 'Not Configured (Using Active Relational Store)',
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER || 'Not Configured',
      connection_error: connectionError,
      engine: isConnectedToMySQL ? 'MySQL 8.x / MariaDB' : 'Embedded Relational (phpMyAdmin Schema Ready)',
      records: {
        clients: store.clients.length,
        applications: store.visa_applications.length,
        tasks: store.tasks.length,
        users: store.users.length,
        hotels: store.hotels ? store.hotels.length : 0,
        hotel_bookings: store.hotel_bookings ? store.hotel_bookings.length : 0,
      },
    };
  },

  // Users
  getUsers() {
    return store.users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      is_active: u.is_active,
      last_login_at: u.last_login_at || null,
      created_at: u.created_at,
    }));
  },

  getUserById(id: number) {
    return store.users.find(u => u.id === id);
  },

  getUserByEmail(email: string) {
    return store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  async createUser(data: { name: string; email: string; password_hash: string; role: 'super_admin' | 'admin' | 'staff'; is_active?: number }, creatorId: number = 1) {
    let id = store.nextIds.users++;
    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          `INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [data.name, data.email, data.password_hash, data.role, data.is_active !== undefined ? data.is_active : 1]
        );
        if (res && res.insertId) id = res.insertId;
      } catch (err: any) {
        console.error('[MySQL] Error creating user in MySQL:', err.message);
      }
    }

    const user: User = {
      id,
      name: data.name,
      email: data.email,
      password_hash: data.password_hash,
      role: data.role,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      last_login_at: null,
      created_at: new Date().toISOString(),
    };
    store.users.push(user);
    saveStore(store);
    this.logActivity(creatorId, 'CREATE_USER', 'USER', id, `Created user account: ${user.name} (${user.email}) [Role: ${user.role}]`);
    return user;
  },

  async updateUser(id: number, data: Partial<User>, updaterId: number = 1) {
    const user = store.users.find(u => u.id === id);
    if (!user) return null;
    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email;
    if (data.role !== undefined) user.role = data.role;
    if (data.is_active !== undefined) user.is_active = data.is_active;
    if (data.password_hash) user.password_hash = data.password_hash;

    if (isConnectedToMySQL && pool) {
      try {
        const sets: string[] = [];
        const vals: any[] = [];
        if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
        if (data.email !== undefined) { sets.push('email = ?'); vals.push(data.email); }
        if (data.role !== undefined) { sets.push('role = ?'); vals.push(data.role); }
        if (data.is_active !== undefined) { sets.push('is_active = ?'); vals.push(data.is_active); }
        if (data.password_hash) { sets.push('password_hash = ?'); vals.push(data.password_hash); }
        if (sets.length > 0) {
          sets.push('updated_at = NOW()');
          vals.push(id);
          await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
        }
      } catch (err: any) {
        console.error('[MySQL] Error updating user in MySQL:', err.message);
      }
    }

    saveStore(store);
    this.logActivity(updaterId, 'UPDATE_USER', 'USER', id, `Updated user account: ${user.name}`);
    return user;
  },

  updateUserLastLogin(id: number) {
    const user = store.users.find(u => u.id === id);
    if (user) {
      user.last_login_at = new Date().toISOString();
      saveStore(store);
    }
    if (isConnectedToMySQL && pool) {
      pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]).catch(e => console.warn('[MySQL] Failed to update last login:', e.message));
    }
  },

  async deleteUser(id: number, operatorId: number = 1) {
    const user = store.users.find(u => u.id === id);
    if (!user) return false;

    // Safety check: ensure at least one active super_admin remains
    if (user.role === 'super_admin') {
      const remainingSuperAdmins = store.users.filter(u => u.id !== id && u.role === 'super_admin' && u.is_active === 1);
      if (remainingSuperAdmins.length === 0) {
        throw new Error('Cannot delete the only remaining Super Admin account.');
      }
    }

    const idx = store.users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    const [deleted] = store.users.splice(idx, 1);
    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
      } catch (err: any) {
        console.error('[MySQL] Error deleting user in MySQL:', err.message);
      }
    }

    this.logActivity(operatorId, 'DELETE_USER', 'USER', id, `Deleted user account: ${deleted.name} (${deleted.email})`);
    return true;
  },

  // Clients
  getClients(search?: string, country?: string) {
    let list = [...store.clients];
    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.passport_number.toLowerCase().includes(q) ||
        c.client_id.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    if (country) {
      list = list.filter(c => c.country.toLowerCase() === country.toLowerCase());
    }

    // Enrich with active visa application and next task
    return list.map(client => {
      const apps = store.visa_applications.filter(a => a.client_id === client.id);
      const activeApps = apps.filter(a => a.status !== 'Returned');
      const activeApp = activeApps[activeApps.length - 1] || null; // Latest active (non-returned)
      let activeAppType = null;
      if (activeApp) {
        const vt = store.visa_types.find(v => v.id === activeApp.visa_type_id);
        activeAppType = vt ? vt.name : null;
      }

      const clientTasks = store.tasks
        .filter(t => t.client_id === client.id && t.status === 'Pending')
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      const nextTask = clientTasks[0] || null;

      return {
        ...client,
        application_count: apps.length,
        active_application: activeApp ? {
          id: activeApp.id,
          application_id: activeApp.application_id,
          status: activeApp.status,
          visa_type: activeAppType,
          delivery_date: activeApp.delivery_date,
        } : null,
        next_task: nextTask ? {
          id: nextTask.id,
          title: nextTask.title,
          due_date: nextTask.due_date,
          priority: nextTask.priority,
        } : null,
      };
    });
  },

  getClientsPaginated(options: {
    search?: string;
    country?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 25));
    const all = this.getClients(options.search, options.country);

    if (options.sortBy) {
      all.sort((a: any, b: any) => {
        const valA = a[options.sortBy!] ?? '';
        const valB = b[options.sortBy!] ?? '';
        const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        return options.sortOrder === 'asc' ? comp : -comp;
      });
    } else {
      all.sort((a, b) => b.id - a.id);
    }

    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const data = all.slice(startIndex, startIndex + limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
  },

  getClientById(id: number) {
    const client = store.clients.find(c => c.id === id || c.client_id === String(id));
    if (!client) return null;

    // Custom field values
    const customValues = store.client_custom_field_values
      .filter(v => v.client_id === client.id)
      .map(v => {
        const field = store.client_custom_fields.find(f => f.id === v.field_id);
        return {
          field_id: v.field_id,
          field_name: field?.field_name || '',
          field_label: field?.field_label || '',
          field_type: field?.field_type || 'text',
          field_value: v.field_value,
        };
      });

    // Applications with visa type details
    const applications = store.visa_applications
      .filter(a => a.client_id === client.id)
      .map(a => {
        const vt = store.visa_types.find(v => v.id === a.visa_type_id);
        const assigned = a.assigned_user_id ? store.users.find(u => u.id === a.assigned_user_id) : null;
        return {
          ...a,
          visa_type_name: vt?.name || 'Unknown',
          assigned_user_name: assigned?.name || null,
        };
      });

    // Tasks
    const tasks = store.tasks
      .filter(t => t.client_id === client.id)
      .map(t => {
        const assigned = t.assigned_user_id ? store.users.find(u => u.id === t.assigned_user_id) : null;
        return {
          ...t,
          assigned_user_name: assigned?.name || null,
        };
      });

    // Comments
    const comments = store.comments
      .filter(c => c.client_id === client.id)
      .map(c => {
        const author = store.users.find(u => u.id === c.user_id);
        return {
          ...c,
          user_name: author?.name || 'Staff',
          user_role: author?.role || 'staff',
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Activity
    const activity = store.activity_logs
      .filter(l => (l.entity_type === 'CLIENT' && l.entity_id === client.id) ||
                   (l.entity_type === 'APPLICATION' && applications.some(app => app.id === l.entity_id)))
      .map(l => {
        const author = l.user_id ? store.users.find(u => u.id === l.user_id) : null;
        return {
          ...l,
          user_name: author?.name || 'System',
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Hotel Bookings for this client
    const hotelBookings = this.getHotelBookings({ clientId: client.id });

    return {
      ...client,
      custom_values: customValues,
      applications,
      tasks,
      hotel_bookings: hotelBookings,
      comments,
      activity,
    };
  },

  checkDuplicate(passportNumber: string, fullName?: string) {
    const cleanPassport = passportNumber.trim().toUpperCase();
    const passportMatches = store.clients.filter(c => c.passport_number.trim().toUpperCase() === cleanPassport);
    
    let nameAndPassportMatches: Client[] = [];
    if (fullName) {
      const cleanName = fullName.trim().toLowerCase();
      nameAndPassportMatches = store.clients.filter(
        c => c.full_name.trim().toLowerCase() === cleanName && c.passport_number.trim().toUpperCase() === cleanPassport
      );
    }

    const duplicates = Array.from(new Set([...passportMatches, ...nameAndPassportMatches]));
    return {
      has_duplicate: duplicates.length > 0,
      matches: duplicates.map(d => ({
        id: d.id,
        client_id: d.client_id,
        full_name: d.full_name,
        passport_number: d.passport_number,
        country: d.country,
      })),
    };
  },

  getNextClientSerial(): { next_serial_number: number; next_client_id: string; last_serial_number: number } {
    let maxSerial = 0;

    for (const c of store.clients) {
      if (c.client_id) {
        const str = String(c.client_id).trim();
        // Check pure digits
        if (/^\d+$/.test(str)) {
          const num = parseInt(str, 10);
          if (!isNaN(num) && num > maxSerial) {
            maxSerial = num;
          }
        } else {
          // Extract trailing or embedded integer numbers from client_id (e.g. CL-000021 -> 21)
          const matches = str.match(/\d+/g);
          if (matches && matches.length > 0) {
            // Take the last group of digits in the ID
            const lastMatch = matches[matches.length - 1];
            const num = parseInt(lastMatch, 10);
            if (!isNaN(num) && num > maxSerial) {
              maxSerial = num;
            }
          }
        }
      }

      if (typeof c.id === 'number' && c.id > maxSerial) {
        maxSerial = Math.max(maxSerial, c.id);
      }
    }

    const nextSerial = maxSerial + 1;
    return {
      last_serial_number: maxSerial,
      next_serial_number: nextSerial,
      next_client_id: String(nextSerial),
    };
  },

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
    custom_fields?: Record<number, string>;
  }, userId = 1) {
    const nextInfo = this.getNextClientSerial();
    const clientId = data.client_id?.trim() ? data.client_id.trim() : nextInfo.next_client_id;
    const now = new Date().toISOString();
    let id = store.nextIds.clients++;

    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          `INSERT INTO clients (client_id, full_name, passport_number, country, phone, whatsapp, email, date_of_birth, address, occupation, notes, google_drive_url, photo_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            clientId,
            data.full_name.trim(),
            data.passport_number.trim().toUpperCase(),
            data.country.trim(),
            data.phone?.trim() || null,
            data.whatsapp?.trim() || null,
            data.email?.trim() || null,
            data.date_of_birth || null,
            data.address?.trim() || null,
            data.occupation?.trim() || null,
            data.notes?.trim() || null,
            data.google_drive_url?.trim() || null,
            data.photo_url?.trim() || null,
          ]
        );
        if (res && res.insertId) {
          id = res.insertId;
          store.nextIds.clients = Math.max(store.nextIds.clients, id + 1);
        }
      } catch (err: any) {
        console.error('[MySQL] Error creating client in MySQL:', err.message);
      }
    }

    const client: Client = {
      id,
      client_id: clientId,
      full_name: data.full_name.trim(),
      passport_number: data.passport_number.trim().toUpperCase(),
      country: data.country.trim(),
      phone: data.phone?.trim() || null,
      whatsapp: data.whatsapp?.trim() || null,
      email: data.email?.trim() || null,
      date_of_birth: data.date_of_birth || null,
      address: data.address?.trim() || null,
      occupation: data.occupation?.trim() || null,
      notes: data.notes?.trim() || null,
      google_drive_url: data.google_drive_url?.trim() || null,
      photo_url: data.photo_url?.trim() || null,
      created_at: now,
      updated_at: now,
    };

    store.clients.unshift(client);

    // Save custom fields
    if (data.custom_fields) {
      for (const [fieldIdStr, val] of Object.entries(data.custom_fields)) {
        const fieldId = parseInt(fieldIdStr, 10);
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          store.client_custom_field_values.push({
            id: store.nextIds.client_custom_field_values++,
            client_id: id,
            field_id: fieldId,
            field_value: String(val),
            created_at: now,
          });

          if (isConnectedToMySQL && pool) {
            await pool.query(
              `INSERT INTO client_custom_field_values (client_id, field_id, field_value, created_at, updated_at)
               VALUES (?, ?, ?, NOW(), NOW())
               ON DUPLICATE KEY UPDATE field_value = VALUES(field_value), updated_at = NOW()`,
              [id, fieldId, String(val)]
            ).catch(err => console.error('[MySQL] Error saving custom field in MySQL:', err.message));
          }
        }
      }
    }

    saveStore(store);
    this.logActivity(userId, 'CREATE_CLIENT', 'CLIENT', id, `Registered new client ${client.full_name} (${client.client_id})`);
    return client;
  },

  async updateClient(id: number, data: Partial<Client> & { custom_fields?: Record<number, string> }, userId = 1) {
    const client = store.clients.find(c => c.id === id);
    if (!client) return null;

    if (data.client_id !== undefined && data.client_id.trim() !== '') client.client_id = data.client_id.trim();
    if (data.full_name !== undefined) client.full_name = data.full_name.trim();
    if (data.passport_number !== undefined) client.passport_number = data.passport_number.trim().toUpperCase();
    if (data.country !== undefined) client.country = data.country.trim();
    if (data.phone !== undefined) client.phone = data.phone ? data.phone.trim() : null;
    if (data.whatsapp !== undefined) client.whatsapp = data.whatsapp ? data.whatsapp.trim() : null;
    if (data.email !== undefined) client.email = data.email ? data.email.trim() : null;
    if (data.date_of_birth !== undefined) client.date_of_birth = data.date_of_birth || null;
    if (data.address !== undefined) client.address = data.address ? data.address.trim() : null;
    if (data.occupation !== undefined) client.occupation = data.occupation ? data.occupation.trim() : null;
    if (data.notes !== undefined) client.notes = data.notes ? data.notes.trim() : null;
    if (data.google_drive_url !== undefined) client.google_drive_url = data.google_drive_url ? data.google_drive_url.trim() : null;
    if (data.photo_url !== undefined) client.photo_url = data.photo_url ? data.photo_url.trim() : null;
    client.updated_at = new Date().toISOString();

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          `UPDATE clients SET
            client_id = ?, full_name = ?, passport_number = ?, country = ?,
            phone = ?, whatsapp = ?, email = ?, date_of_birth = ?,
            address = ?, occupation = ?, notes = ?, google_drive_url = ?,
            photo_url = ?, updated_at = NOW()
           WHERE id = ?`,
          [
            client.client_id,
            client.full_name,
            client.passport_number,
            client.country,
            client.phone,
            client.whatsapp,
            client.email,
            client.date_of_birth,
            client.address,
            client.occupation,
            client.notes,
            client.google_drive_url,
            client.photo_url,
            id,
          ]
        );
      } catch (err: any) {
        console.error('[MySQL] Error updating client in MySQL:', err.message);
      }
    }

    // Update custom fields
    if (data.custom_fields) {
      for (const [fieldIdStr, val] of Object.entries(data.custom_fields)) {
        const fieldId = parseInt(fieldIdStr, 10);
        const existing = store.client_custom_field_values.find(v => v.client_id === id && v.field_id === fieldId);
        if (existing) {
          existing.field_value = String(val);
        } else if (val !== undefined && val !== null && String(val).trim() !== '') {
          store.client_custom_field_values.push({
            id: store.nextIds.client_custom_field_values++,
            client_id: id,
            field_id: fieldId,
            field_value: String(val),
            created_at: new Date().toISOString(),
          });
        }

        if (isConnectedToMySQL && pool) {
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            await pool.query(
              `INSERT INTO client_custom_field_values (client_id, field_id, field_value, created_at, updated_at)
               VALUES (?, ?, ?, NOW(), NOW())
               ON DUPLICATE KEY UPDATE field_value = VALUES(field_value), updated_at = NOW()`,
              [id, fieldId, String(val)]
            ).catch(err => console.error('[MySQL] Error updating custom field in MySQL:', err.message));
          } else {
            await pool.query('DELETE FROM client_custom_field_values WHERE client_id = ? AND field_id = ?', [id, fieldId])
              .catch(err => console.error('[MySQL] Error removing custom field in MySQL:', err.message));
          }
        }
      }
    }

    saveStore(store);
    this.logActivity(userId, 'UPDATE_CLIENT', 'CLIENT', id, `Updated profile details for ${client.full_name}`);
    return client;
  },

  async deleteClient(id: number, userId = 1): Promise<boolean> {
    const idx = store.clients.findIndex(c => c.id === id);
    const client = idx !== -1 ? store.clients[idx] : null;

    let clientExistsInDb = false;
    let dbClientId = '';
    if (isConnectedToMySQL && pool) {
      try {
        const [rows]: any = await pool.query('SELECT id, client_id, full_name FROM clients WHERE id = ?', [id]);
        if (Array.isArray(rows) && rows.length > 0) {
          clientExistsInDb = true;
          dbClientId = rows[0].client_id;
        }
      } catch (e: any) {
        console.warn('[MySQL] Could not check client in DB:', e.message);
      }
    }

    if (idx === -1 && !clientExistsInDb) {
      return false;
    }

    // 1. Remove from in-memory / local JSON store
    if (idx !== -1) {
      store.clients.splice(idx, 1);
    }
    store.client_custom_field_values = store.client_custom_field_values.filter(v => v.client_id !== id);
    const relatedAppIds = store.visa_applications.filter(a => a.client_id === id).map(a => a.id);
    store.visa_applications = store.visa_applications.filter(a => a.client_id !== id);
    store.tasks = store.tasks.filter(t => t.client_id !== id && !relatedAppIds.includes(t.application_id || 0));
    store.comments = store.comments.filter(c => c.client_id !== id && !relatedAppIds.includes(c.application_id || 0));
    store.hotel_bookings = (store.hotel_bookings || []).filter(b => b.client_id !== id);
    store.application_status_history = store.application_status_history.filter(h => !relatedAppIds.includes(h.application_id));

    saveStore(store);

    // 2. CRITICAL: Execute real deletion in MySQL database!
    if (isConnectedToMySQL && pool) {
      await deleteClientFromMySQL(id, client?.client_id || dbClientId);
    }

    const clientName = client?.full_name || 'Client';
    const clientCode = client?.client_id || dbClientId || `#${id}`;
    this.logActivity(userId, 'DELETE_CLIENT', 'CLIENT', id, `Deleted client profile ${clientName} (${clientCode})`);

    return true;
  },

  // Applications
  getApplications(filters?: { status?: string; visa_type_id?: number; staff_id?: number; search?: string }) {
    let list = [...store.visa_applications];

    if (filters?.status) {
      list = list.filter(a => a.status === filters.status);
    }
    if (filters?.visa_type_id) {
      list = list.filter(a => a.visa_type_id === Number(filters.visa_type_id));
    }
    if (filters?.staff_id) {
      list = list.filter(a => a.assigned_user_id === Number(filters.staff_id));
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(a => {
        const client = store.clients.find(c => c.id === a.client_id);
        const vt = store.visa_types.find(v => v.id === a.visa_type_id);
        return a.application_id.toLowerCase().includes(q) ||
          (client && (client.full_name.toLowerCase().includes(q) || client.passport_number.toLowerCase().includes(q))) ||
          (vt && vt.name.toLowerCase().includes(q));
      });
    }

    return list.map(app => {
      const client = store.clients.find(c => c.id === app.client_id);
      const vt = store.visa_types.find(v => v.id === app.visa_type_id);
      const staff = app.assigned_user_id ? store.users.find(u => u.id === app.assigned_user_id) : null;
      return {
        ...app,
        client_name: client?.full_name || 'Unknown',
        client_code: client?.client_id || '',
        passport_number: client?.passport_number || '',
        country: client?.country || '',
        google_drive_url: client?.google_drive_url || null,
        client_photo_url: client?.photo_url || null,
        visa_type_name: vt?.name || 'Unknown',
        assigned_user_name: staff?.name || 'Unassigned',
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getApplicationsPaginated(options: {
    search?: string;
    status?: string;
    visa_type_id?: number;
    staff_id?: number;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 25));
    const all = this.getApplications({
      status: options.status,
      visa_type_id: options.visa_type_id,
      staff_id: options.staff_id,
      search: options.search,
    });

    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const data = all.slice(startIndex, startIndex + limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
  },

  getApplicationById(id: number) {
    const app = store.visa_applications.find(a => a.id === id || a.application_id === String(id));
    if (!app) return null;
    const client = store.clients.find(c => c.id === app.client_id);
    const vt = store.visa_types.find(v => v.id === app.visa_type_id);
    const staff = app.assigned_user_id ? store.users.find(u => u.id === app.assigned_user_id) : null;

    const history = store.application_status_history
      .filter(h => h.application_id === app.id)
      .map(h => {
        const u = h.changed_by_user_id ? store.users.find(usr => usr.id === h.changed_by_user_id) : null;
        return {
          ...h,
          user_name: u?.name || 'Staff',
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const tasks = store.tasks
      .filter(t => t.application_id === app.id)
      .map(t => {
        const assigned = t.assigned_user_id ? store.users.find(u => u.id === t.assigned_user_id) : null;
        return {
          ...t,
          assigned_user_name: assigned?.name || null,
        };
      });

    return {
      ...app,
      client,
      client_name: client?.full_name || 'Unknown',
      client_code: client?.client_id || '',
      passport_number: client?.passport_number || '',
      country: client?.country || '',
      google_drive_url: client?.google_drive_url || null,
      client_photo_url: client?.photo_url || null,
      visa_type_name: vt?.name || 'Unknown',
      assigned_user_name: staff?.name || null,
      history,
      tasks,
    };
  },

  async createApplication(data: {
    client_id: number;
    visa_type_id: number;
    status?: string;
    delivery_date?: string;
    notes?: string;
    assigned_user_id?: number;
  }, userId = 1) {
    let id = store.nextIds.visa_applications++;
    let appId = `APP-${String(id).padStart(6, '0')}`;
    const now = new Date().toISOString();
    const status = data.status || 'Upcoming';
    const deliveryDate = status === 'Online Review Completed' && data.delivery_date ? data.delivery_date : null;

    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          `INSERT INTO visa_applications (application_id, client_id, visa_type_id, status, delivery_date, notes, assigned_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [appId, data.client_id, data.visa_type_id, status, deliveryDate, data.notes?.trim() || null, data.assigned_user_id || null]
        );
        if (res && res.insertId) {
          id = res.insertId;
          appId = `APP-${String(id).padStart(6, '0')}`;
          await pool.query('UPDATE visa_applications SET application_id = ? WHERE id = ?', [appId, id]);
        }
        await pool.query(
          `INSERT INTO application_status_history (application_id, old_status, new_status, delivery_date, changed_by_user_id, notes, created_at)
           VALUES (?, NULL, ?, ?, ?, 'Visa application created', NOW())`,
          [id, status, deliveryDate, userId]
        );
      } catch (err: any) {
        console.error('[MySQL] Error creating application in MySQL:', err.message);
      }
    }

    const app: VisaApplication = {
      id,
      application_id: appId,
      client_id: data.client_id,
      visa_type_id: data.visa_type_id,
      status,
      delivery_date: deliveryDate,
      notes: data.notes?.trim() || null,
      assigned_user_id: data.assigned_user_id || null,
      created_at: now,
      updated_at: now,
    };

    store.visa_applications.unshift(app);

    // Initial status history
    store.application_status_history.push({
      id: store.nextIds.application_status_history++,
      application_id: id,
      old_status: null,
      new_status: status,
      delivery_date: app.delivery_date,
      changed_by_user_id: userId,
      notes: 'Visa application created',
      created_at: now,
    });

    const client = store.clients.find(c => c.id === data.client_id);
    const clientName = client?.full_name || 'Client';

    // If initial status was Online Review Completed with delivery date, create delivery task
    if (status === 'Online Review Completed' && app.delivery_date) {
      await this.syncDeliveryTask(app, clientName, userId);
    }

    saveStore(store);
    this.logActivity(userId, 'CREATE_APPLICATION', 'APPLICATION', id, `Created visa application ${app.application_id} for ${clientName}`);
    return app;
  },

  async updateApplicationStatus(
    id: number,
    newStatus: string,
    deliveryDate?: string | null,
    notes?: string,
    userId = 1
  ) {
    const app = store.visa_applications.find(a => a.id === id);
    if (!app) return null;

    const oldStatus = app.status;
    app.status = newStatus;
    app.updated_at = new Date().toISOString();

    const client = store.clients.find(c => c.id === app.client_id);
    const clientName = client?.full_name || 'Client';

    // Delivery date business logic
    if (newStatus === 'Online Review Completed') {
      if (deliveryDate) {
        app.delivery_date = deliveryDate;
      }
    }

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          'UPDATE visa_applications SET status = ?, delivery_date = ?, notes = COALESCE(?, notes), updated_at = NOW() WHERE id = ?',
          [newStatus, app.delivery_date || null, notes ? notes.trim() : null, id]
        );
        await pool.query(
          `INSERT INTO application_status_history (application_id, old_status, new_status, delivery_date, changed_by_user_id, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [id, oldStatus, newStatus, app.delivery_date || null, userId, notes ? notes.trim() : `Status changed from ${oldStatus} to ${newStatus}`]
        );
        if (newStatus === 'Returned') {
          await pool.query(
            'UPDATE tasks SET status = "Completed", completed_at = NOW(), updated_at = NOW() WHERE application_id = ? AND status = "Pending"',
            [id]
          );
        }
      } catch (err: any) {
        console.error('[MySQL] Error updating application status in MySQL:', err.message);
      }
    }

    // Record history
    store.application_status_history.push({
      id: store.nextIds.application_status_history++,
      application_id: id,
      old_status: oldStatus,
      new_status: newStatus,
      delivery_date: app.delivery_date,
      changed_by_user_id: userId,
      notes: notes || `Status changed from ${oldStatus} to ${newStatus}`,
      created_at: new Date().toISOString(),
    });

    // If status is Online Review Completed and we have a delivery date, create/update delivery task
    if (newStatus === 'Online Review Completed' && app.delivery_date) {
      await this.syncDeliveryTask(app, clientName, userId);
    }

    // If status is Returned, complete any pending tasks linked to this application
    if (newStatus === 'Returned') {
      store.tasks.forEach(t => {
        if (t.application_id === id && t.status === 'Pending') {
          t.status = 'Completed';
          t.completed_at = new Date().toISOString();
          t.updated_at = new Date().toISOString();
        }
      });
    }

    saveStore(store);
    this.logActivity(
      userId,
      'STATUS_CHANGE',
      'APPLICATION',
      id,
      `Changed status of ${app.application_id} (${clientName}) to ${newStatus}`
    );
    return app;
  },

  async updateApplication(id: number, data: Partial<VisaApplication>, userId = 1) {
    const app = store.visa_applications.find(a => a.id === id);
    if (!app) return null;

    const client = store.clients.find(c => c.id === app.client_id);
    const clientName = client?.full_name || 'Client';

    if (data.visa_type_id !== undefined) app.visa_type_id = data.visa_type_id;
    if (data.assigned_user_id !== undefined) app.assigned_user_id = data.assigned_user_id;
    if (data.notes !== undefined) app.notes = data.notes;

    if (data.delivery_date !== undefined) {
      const oldDeliveryDate = app.delivery_date;
      app.delivery_date = data.delivery_date;
      if (app.delivery_date && app.delivery_date !== oldDeliveryDate) {
        await this.syncDeliveryTask(app, clientName, userId);
      }
    }

    app.updated_at = new Date().toISOString();

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          `UPDATE visa_applications SET visa_type_id = ?, assigned_user_id = ?, notes = ?, delivery_date = ?, updated_at = NOW() WHERE id = ?`,
          [app.visa_type_id, app.assigned_user_id || null, app.notes || null, app.delivery_date || null, id]
        );
      } catch (err: any) {
        console.error('[MySQL] Error updating application in MySQL:', err.message);
      }
    }

    saveStore(store);
    this.logActivity(userId, 'UPDATE_APPLICATION', 'APPLICATION', id, `Updated application ${app.application_id}`);
    return app;
  },

  async syncDeliveryTask(app: VisaApplication, clientName: string, userId: number) {
    if (!app.delivery_date) return;
    const taskTitle = `Delivery - ${clientName}`;
    const existingTask = store.tasks.find(
      t => t.application_id === app.id && t.is_delivery_task === 1
    );

    if (existingTask) {
      existingTask.due_date = app.delivery_date;
      existingTask.updated_at = new Date().toISOString();
      if (app.assigned_user_id) {
        existingTask.assigned_user_id = app.assigned_user_id;
      }
      if (isConnectedToMySQL && pool) {
        try {
          await pool.query(
            'UPDATE tasks SET due_date = ?, assigned_user_id = COALESCE(?, assigned_user_id), updated_at = NOW() WHERE id = ?',
            [app.delivery_date, app.assigned_user_id || null, existingTask.id]
          );
        } catch (err: any) {
          console.error('[MySQL] Error updating delivery task:', err.message);
        }
      }
      this.logActivity(userId, 'UPDATE_TASK', 'TASK', existingTask.id, `Updated delivery date to ${app.delivery_date} for task "${existingTask.title}"`);
    } else {
      let taskId = store.nextIds.tasks++;
      if (isConnectedToMySQL && pool) {
        try {
          const [res]: any = await pool.query(
            `INSERT INTO tasks (title, description, client_id, application_id, assigned_user_id, due_date, priority, status, is_delivery_task, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'High', 'Pending', 1, NOW(), NOW())`,
            [
              taskTitle,
              `Scheduled passport/visa delivery for ${clientName} (${app.application_id}). Status: Online Review Completed.`,
              app.client_id,
              app.id,
              app.assigned_user_id || 2,
              app.delivery_date,
            ]
          );
          if (res && res.insertId) taskId = res.insertId;
        } catch (err: any) {
          console.error('[MySQL] Error creating delivery task:', err.message);
        }
      }
      const newTask: Task = {
        id: taskId,
        title: taskTitle,
        description: `Scheduled passport/visa delivery for ${clientName} (${app.application_id}). Status: Online Review Completed.`,
        client_id: app.client_id,
        application_id: app.id,
        assigned_user_id: app.assigned_user_id || 2,
        due_date: app.delivery_date,
        priority: 'High',
        status: 'Pending',
        is_delivery_task: 1,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.tasks.push(newTask);
      this.logActivity(userId, 'CREATE_TASK', 'TASK', taskId, `Auto-created delivery task "${taskTitle}" on ${app.delivery_date}`);
    }
  },

  async deleteApplication(id: number, userId = 1) {
    const idx = store.visa_applications.findIndex(a => Number(a.id) === Number(id));
    if (idx === -1) return false;
    const [app] = store.visa_applications.splice(idx, 1);

    // Remove comments linked to this application
    store.comments = store.comments.filter(c => Number(c.application_id) !== Number(id));
    // Remove status history linked to this application
    store.application_status_history = store.application_status_history.filter(h => Number(h.application_id) !== Number(id));
    // Remove tasks linked to this application
    store.tasks = store.tasks.filter(t => Number(t.application_id) !== Number(id));

    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query('DELETE FROM application_status_history WHERE application_id = ?', [id]).catch(() => {});
        await pool.query('DELETE FROM comments WHERE application_id = ?', [id]).catch(() => {});
        await pool.query('DELETE FROM tasks WHERE application_id = ?', [id]).catch(() => {});
        await pool.query('DELETE FROM visa_applications WHERE id = ?', [id]);
      } catch (err: any) {
        console.error('[MySQL] Error deleting application in MySQL:', err.message);
      }
    }

    this.logActivity(userId, 'DELETE_APPLICATION', 'APPLICATION', id, `Deleted visa application ${app.application_id}`);
    return true;
  },

  // Tasks
  getTasks(filters?: { status?: string; priority?: string; user_id?: number; client_id?: number; due_date?: string }) {
    let list = [...store.tasks];
    if (filters?.status) list = list.filter(t => t.status === filters.status);
    if (filters?.priority) list = list.filter(t => t.priority === filters.priority);
    if (filters?.user_id) list = list.filter(t => t.assigned_user_id === Number(filters.user_id));
    if (filters?.client_id) list = list.filter(t => t.client_id === Number(filters.client_id));
    if (filters?.due_date) list = list.filter(t => t.due_date === filters.due_date);

    return list.map(t => {
      const client = t.client_id ? store.clients.find(c => c.id === t.client_id) : null;
      const app = t.application_id ? store.visa_applications.find(a => a.id === t.application_id) : null;
      const user = t.assigned_user_id ? store.users.find(u => u.id === t.assigned_user_id) : null;
      return {
        ...t,
        client_name: client?.full_name || null,
        client_code: client?.client_id || null,
        passport_number: client?.passport_number || null,
        application_code: app?.application_id || null,
        assigned_user_name: user?.name || 'Unassigned',
      };
    }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  },

  getTaskById(id: number) {
    const t = store.tasks.find(item => Number(item.id) === Number(id));
    if (!t) return null;
    const client = t.client_id ? store.clients.find(c => c.id === t.client_id) : null;
    const app = t.application_id ? store.visa_applications.find(a => a.id === t.application_id) : null;
    const user = t.assigned_user_id ? store.users.find(u => u.id === t.assigned_user_id) : null;
    return {
      ...t,
      client_name: client?.full_name || null,
      client_code: client?.client_id || null,
      passport_number: client?.passport_number || null,
      application_code: app?.application_id || null,
      assigned_user_name: user?.name || 'Unassigned',
    };
  },

  async createTask(data: {
    title: string;
    description?: string;
    client_id?: number | null;
    application_id?: number | null;
    assigned_user_id?: number | null;
    due_date: string;
    priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  }, userId = 1) {
    let id = store.nextIds.tasks++;
    const now = new Date().toISOString();

    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          `INSERT INTO tasks (title, description, client_id, application_id, assigned_user_id, due_date, priority, status, is_delivery_task, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', 0, NOW(), NOW())`,
          [
            data.title.trim(),
            data.description?.trim() || null,
            data.client_id || null,
            data.application_id || null,
            data.assigned_user_id || null,
            data.due_date,
            data.priority || 'Normal',
          ]
        );
        if (res && res.insertId) {
          id = res.insertId;
          store.nextIds.tasks = Math.max(store.nextIds.tasks, id + 1);
        }
      } catch (err: any) {
        console.error('[MySQL] Error creating task in MySQL:', err.message);
      }
    }

    const task: Task = {
      id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      client_id: data.client_id || null,
      application_id: data.application_id || null,
      assigned_user_id: data.assigned_user_id || null,
      due_date: data.due_date,
      priority: data.priority || 'Normal',
      status: 'Pending',
      is_delivery_task: 0,
      completed_at: null,
      created_at: now,
      updated_at: now,
    };
    store.tasks.push(task);
    saveStore(store);
    this.logActivity(userId, 'CREATE_TASK', 'TASK', id, `Created task: ${task.title}`);
    return task;
  },

  async updateTask(id: number, data: Partial<Task>, userId = 1) {
    const task = store.tasks.find(t => Number(t.id) === Number(id));
    if (!task) return null;

    if (data.title !== undefined) task.title = data.title.trim();
    if (data.description !== undefined) task.description = data.description?.trim() || null;
    if (data.client_id !== undefined) task.client_id = data.client_id;
    if (data.application_id !== undefined) task.application_id = data.application_id;
    if (data.assigned_user_id !== undefined) task.assigned_user_id = data.assigned_user_id;
    if (data.due_date !== undefined) task.due_date = data.due_date;
    if (data.priority !== undefined) task.priority = data.priority;
    if (data.status !== undefined) {
      task.status = data.status;
      task.completed_at = data.status === 'Completed' ? new Date().toISOString() : null;
    }
    task.updated_at = new Date().toISOString();

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          `UPDATE tasks SET
            title = ?, description = ?, client_id = ?, application_id = ?,
            assigned_user_id = ?, due_date = ?, priority = ?, status = ?,
            completed_at = ?, updated_at = NOW()
           WHERE id = ?`,
          [
            task.title,
            task.description,
            task.client_id,
            task.application_id,
            task.assigned_user_id,
            task.due_date,
            task.priority,
            task.status,
            task.completed_at ? new Date(task.completed_at) : null,
            id,
          ]
        );
      } catch (err: any) {
        console.error('[MySQL] Error updating task in MySQL:', err.message);
      }
    }

    saveStore(store);
    this.logActivity(userId, 'UPDATE_TASK', 'TASK', id, `Updated task: ${task.title} (${task.status})`);
    return task;
  },

  async deleteTask(id: number, userId = 1) {
    const idx = store.tasks.findIndex(t => Number(t.id) === Number(id));
    const task = idx !== -1 ? store.tasks[idx] : null;

    if (idx !== -1) {
      store.tasks.splice(idx, 1);
    }

    if (store.hotel_bookings) {
      store.hotel_bookings.forEach(b => {
        if (Number(b.checkout_task_id) === Number(id)) {
          b.checkout_task_id = null;
        }
      });
    }

    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query('UPDATE hotel_bookings SET checkout_task_id = NULL WHERE checkout_task_id = ?', [id]).catch(() => {});
        await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
        console.log(`[MySQL] Deleted task ${id} from MySQL`);
      } catch (err: any) {
        console.error(`[MySQL] Error deleting task ${id} from MySQL:`, err.message);
      }
    }

    if (task) {
      this.logActivity(userId, 'DELETE_TASK', 'TASK', id, `Deleted task: ${task.title}`);
    }
    return true;
  },

  // Comments
  getComments(clientId: number, applicationId?: number) {
    let list = store.comments.filter(c => c.client_id === clientId);
    if (applicationId) {
      list = list.filter(c => c.application_id === applicationId);
    }
    return list.map(c => {
      const u = store.users.find(usr => usr.id === c.user_id);
      return {
        ...c,
        user_name: u?.name || 'Staff',
        user_role: u?.role || 'staff',
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createComment(data: { client_id: number; application_id?: number | null; user_id: number; message: string }) {
    let id = store.nextIds.comments++;
    const now = new Date().toISOString();

    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          `INSERT INTO comments (client_id, application_id, user_id, message, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [data.client_id, data.application_id || null, data.user_id, data.message.trim()]
        );
        if (res && res.insertId) {
          id = res.insertId;
          store.nextIds.comments = Math.max(store.nextIds.comments, id + 1);
        }
      } catch (err: any) {
        console.error('[MySQL] Error creating comment in MySQL:', err.message);
      }
    }

    const comment: Comment = {
      id,
      client_id: data.client_id,
      application_id: data.application_id || null,
      user_id: data.user_id,
      message: data.message.trim(),
      created_at: now,
    };
    store.comments.push(comment);
    saveStore(store);
    const author = store.users.find(u => u.id === data.user_id);
    this.logActivity(data.user_id, 'ADD_COMMENT', 'CLIENT', data.client_id, `Internal note added by ${author?.name || 'Staff'}`);
    return {
      ...comment,
      user_name: author?.name || 'Staff',
      user_role: author?.role || 'staff',
    };
  },

  // Custom Fields
  getCustomFields(activeOnly = false) {
    let list = [...store.client_custom_fields];
    if (activeOnly) {
      list = list.filter(f => f.is_active === 1);
    }
    return list.sort((a, b) => a.display_order - b.display_order);
  },

  async createCustomField(data: {
    field_name: string;
    field_label: string;
    field_type: 'text' | 'long_text' | 'number' | 'date' | 'dropdown' | 'checkbox';
    field_options?: string;
    is_required?: number;
    display_order?: number;
  }, userId = 1) {
    let id = store.nextIds.client_custom_fields++;
    const cleanName = data.field_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const field: CustomField = {
      id,
      field_name: cleanName,
      field_label: data.field_label.trim(),
      field_type: data.field_type,
      field_options: data.field_options?.trim() || null,
      is_required: data.is_required || 0,
      is_active: 1,
      display_order: data.display_order || store.client_custom_fields.length + 1,
      created_at: new Date().toISOString(),
    };

    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          `INSERT INTO client_custom_fields (field_name, field_label, field_type, field_options, is_required, is_active, display_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
          [field.field_name, field.field_label, field.field_type, field.field_options, field.is_required, field.display_order]
        );
        if (res && res.insertId) field.id = res.insertId;
      } catch (err: any) {
        console.error('[MySQL] Error creating custom field in MySQL:', err.message);
      }
    }

    store.client_custom_fields.push(field);
    saveStore(store);
    this.logActivity(userId, 'CREATE_CUSTOM_FIELD', 'SETTINGS', field.id, `Added custom client field "${field.field_label}"`);
    return field;
  },

  async updateCustomField(id: number, data: Partial<CustomField>, userId = 1) {
    const field = store.client_custom_fields.find(f => f.id === id);
    if (!field) return null;
    if (data.field_label !== undefined) field.field_label = data.field_label.trim();
    if (data.field_type !== undefined) field.field_type = data.field_type;
    if (data.field_options !== undefined) field.field_options = data.field_options?.trim() || null;
    if (data.is_required !== undefined) field.is_required = data.is_required;
    if (data.is_active !== undefined) field.is_active = data.is_active;
    if (data.display_order !== undefined) field.display_order = data.display_order;

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          `UPDATE client_custom_fields SET field_label = ?, field_type = ?, field_options = ?, is_required = ?, is_active = ?, display_order = ?, updated_at = NOW() WHERE id = ?`,
          [field.field_label, field.field_type, field.field_options, field.is_required, field.is_active, field.display_order, id]
        );
      } catch (err: any) {
        console.error('[MySQL] Error updating custom field in MySQL:', err.message);
      }
    }

    saveStore(store);
    this.logActivity(userId, 'UPDATE_CUSTOM_FIELD', 'SETTINGS', id, `Updated custom field "${field.field_label}"`);
    return field;
  },

  async deleteCustomField(id: number, userId = 1) {
    const idx = store.client_custom_fields.findIndex(f => f.id === id);
    if (idx === -1) return false;
    const [field] = store.client_custom_fields.splice(idx, 1);
    store.client_custom_field_values = store.client_custom_field_values.filter(v => v.field_id !== id);
    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query('DELETE FROM client_custom_field_values WHERE field_id = ?', [id]);
        await pool.query('DELETE FROM client_custom_fields WHERE id = ?', [id]);
      } catch (err: any) {
        console.error('[MySQL] Error deleting custom field in MySQL:', err.message);
      }
    }

    this.logActivity(userId, 'DELETE_CUSTOM_FIELD', 'SETTINGS', id, `Deleted custom field "${field.field_label}"`);
    return true;
  },

  // Visa Types
  getVisaTypes(activeOnly = false) {
    let list = [...store.visa_types];
    if (activeOnly) {
      list = list.filter(v => v.is_active === 1);
    }
    return list;
  },

  async createVisaType(data: { name: string; description?: string }, userId = 1) {
    let id = store.nextIds.visa_types++;
    const vt: VisaType = {
      id,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      is_active: 1,
      created_at: new Date().toISOString(),
    };

    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          'INSERT INTO visa_types (name, description, is_active, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())',
          [vt.name, vt.description]
        );
        if (res && res.insertId) vt.id = res.insertId;
      } catch (err: any) {
        console.error('[MySQL] Error creating visa type in MySQL:', err.message);
      }
    }

    store.visa_types.push(vt);
    saveStore(store);
    this.logActivity(userId, 'CREATE_VISA_TYPE', 'SETTINGS', vt.id, `Added visa type "${vt.name}"`);
    return vt;
  },

  async updateVisaType(id: number, data: Partial<VisaType>, userId = 1) {
    const vt = store.visa_types.find(v => v.id === id);
    if (!vt) return null;
    if (data.name !== undefined) vt.name = data.name.trim();
    if (data.description !== undefined) vt.description = data.description?.trim() || null;
    if (data.is_active !== undefined) vt.is_active = data.is_active;

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          'UPDATE visa_types SET name = ?, description = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
          [vt.name, vt.description, vt.is_active, id]
        );
      } catch (err: any) {
        console.error('[MySQL] Error updating visa type in MySQL:', err.message);
      }
    }

    saveStore(store);
    this.logActivity(userId, 'UPDATE_VISA_TYPE', 'SETTINGS', id, `Updated visa type "${vt.name}"`);
    return vt;
  },

  async deleteVisaType(id: number, userId = 1) {
    const idx = store.visa_types.findIndex(v => v.id === id);
    if (idx === -1) return false;

    // Safety check: ensure not in use by applications
    const inUse = store.visa_applications.some(a => a.visa_type_id === id);
    if (inUse) {
      throw new Error('Cannot delete visa type because it is currently assigned to existing visa applications. Please deactivate it instead.');
    }

    const [vt] = store.visa_types.splice(idx, 1);
    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query('DELETE FROM visa_types WHERE id = ?', [id]);
      } catch (err: any) {
        console.error('[MySQL] Error deleting visa type in MySQL:', err.message);
      }
    }

    this.logActivity(userId, 'DELETE_VISA_TYPE', 'SETTINGS', id, `Deleted visa type "${vt.name}"`);
    return true;
  },

  // Countries
  getCountries(activeOnly = false) {
    let list = [...(store.countries || [])];
    if (activeOnly) {
      list = list.filter(c => c.is_active === 1);
    }
    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));
  },

  async createCountry(data: { name: string; code?: string }, userId = 1) {
    if (!store.countries) store.countries = [];
    if (!store.nextIds.countries) store.nextIds.countries = 21;
    let id = store.nextIds.countries++;
    const country: Country = {
      id,
      name: data.name.trim(),
      code: data.code?.trim().toUpperCase() || null,
      is_active: 1,
      display_order: store.countries.length + 1,
      created_at: new Date().toISOString(),
    };

    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          'INSERT INTO countries (name, code, is_active, display_order, created_at, updated_at) VALUES (?, ?, 1, ?, NOW(), NOW())',
          [country.name, country.code, country.display_order]
        );
        if (res && res.insertId) country.id = res.insertId;
      } catch (err: any) {
        console.error('[MySQL] Error creating country in MySQL:', err.message);
      }
    }

    store.countries.push(country);
    saveStore(store);
    this.logActivity(userId, 'CREATE_COUNTRY', 'SETTINGS', country.id, `Added country "${country.name}"`);
    return country;
  },

  async updateCountry(id: number, data: Partial<Country>, userId = 1) {
    if (!store.countries) return null;
    const country = store.countries.find(c => c.id === id);
    if (!country) return null;
    if (data.name !== undefined) country.name = data.name.trim();
    if (data.code !== undefined) country.code = data.code ? data.code.trim().toUpperCase() : null;
    if (data.is_active !== undefined) country.is_active = data.is_active;
    if (data.display_order !== undefined) country.display_order = data.display_order;

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          'UPDATE countries SET name = ?, code = ?, is_active = ?, display_order = ?, updated_at = NOW() WHERE id = ?',
          [country.name, country.code, country.is_active, country.display_order, id]
        );
      } catch (err: any) {
        console.error('[MySQL] Error updating country in MySQL:', err.message);
      }
    }

    saveStore(store);
    this.logActivity(userId, 'UPDATE_COUNTRY', 'SETTINGS', id, `Updated country "${country.name}"`);
    return country;
  },

  async deleteCountry(id: number, userId = 1) {
    if (!store.countries) return false;
    const idx = store.countries.findIndex(c => c.id === id);
    if (idx === -1) return false;
    const [c] = store.countries.splice(idx, 1);
    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query('DELETE FROM countries WHERE id = ?', [id]);
      } catch (err: any) {
        console.error('[MySQL] Error deleting country in MySQL:', err.message);
      }
    }

    this.logActivity(userId, 'DELETE_COUNTRY', 'SETTINGS', id, `Deleted country "${c.name}"`);
    return true;
  },

  // Activity
  getActivityLogs(limit = 20) {
    return store.activity_logs
      .map(l => {
        const u = l.user_id ? store.users.find(usr => usr.id === l.user_id) : null;
        return {
          ...l,
          user_name: u?.name || 'System',
          user_role: u?.role || 'staff',
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  },

  logActivity(userId: number | null, action: string, entityType: string, entityId: number | null, details: string) {
    const log: ActivityLog = {
      id: store.nextIds.activity_logs++,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      created_at: new Date().toISOString(),
    };
    store.activity_logs.unshift(log);
    // Keep max 500 logs
    if (store.activity_logs.length > 500) {
      store.activity_logs.pop();
    }
    if (isConnectedToMySQL && pool) {
      pool.query(
        'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [userId || null, action, entityType, entityId || null, details]
      ).catch(e => console.warn('[MySQL] Failed to write activity log:', e.message));
    }
  },

  // --------------------------------------------------------------------------
  // Hotels Management
  // --------------------------------------------------------------------------
  getHotels(activeOnly = false) {
    if (!store.hotels) store.hotels = [];
    let list = [...store.hotels];
    if (activeOnly) {
      list = list.filter(h => h.is_active === 1);
    }
    return list.map(hotel => {
      const rooms = (store.hotel_rooms || []).filter(r => r.hotel_id === hotel.id && (!activeOnly || r.is_active === 1));
      return {
        ...hotel,
        rooms_count: rooms.length,
        rooms,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  },

  getHotelById(id: number) {
    if (!store.hotels) return null;
    const hotel = store.hotels.find(h => h.id === id);
    if (!hotel) return null;
    const rooms = (store.hotel_rooms || []).filter(r => r.hotel_id === hotel.id);
    return {
      ...hotel,
      rooms_count: rooms.length,
      rooms,
    };
  },

  async createHotel(data: { name: string; city?: string; address?: string; star_rating?: number; phone?: string; email?: string; notes?: string }, userId = 1) {
    if (!store.hotels) store.hotels = [];
    if (!store.nextIds.hotels) store.nextIds.hotels = 6;
    const now = new Date().toISOString();
    let id = store.nextIds.hotels++;
    const hotel: Hotel = {
      id,
      name: data.name.trim(),
      city: data.city ? data.city.trim() : null,
      address: data.address ? data.address.trim() : null,
      star_rating: data.star_rating !== undefined ? Number(data.star_rating) : 4,
      phone: data.phone ? data.phone.trim() : null,
      email: data.email ? data.email.trim() : null,
      notes: data.notes ? data.notes.trim() : null,
      is_active: 1,
      created_at: now,
      updated_at: now,
    };

    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          `INSERT INTO hotels (name, city, address, star_rating, phone, email, notes, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [hotel.name, hotel.city, hotel.address, hotel.star_rating, hotel.phone, hotel.email, hotel.notes]
        );
        if (res && res.insertId) hotel.id = res.insertId;
      } catch (err: any) {
        console.error('[MySQL] Error creating hotel in MySQL:', err.message);
      }
    }

    store.hotels.push(hotel);
    saveStore(store);
    this.logActivity(userId, 'CREATE_HOTEL', 'HOTEL', hotel.id, `Added hotel partner "${hotel.name}" in ${hotel.city || 'unspecified city'}`);
    return this.getHotelById(hotel.id);
  },

  async updateHotel(id: number, data: Partial<Hotel>, userId = 1) {
    if (!store.hotels) return null;
    const hotel = store.hotels.find(h => h.id === id);
    if (!hotel) return null;
    if (data.name !== undefined) hotel.name = data.name.trim();
    if (data.city !== undefined) hotel.city = data.city ? data.city.trim() : null;
    if (data.address !== undefined) hotel.address = data.address ? data.address.trim() : null;
    if (data.star_rating !== undefined) hotel.star_rating = Number(data.star_rating);
    if (data.phone !== undefined) hotel.phone = data.phone ? data.phone.trim() : null;
    if (data.email !== undefined) hotel.email = data.email ? data.email.trim() : null;
    if (data.notes !== undefined) hotel.notes = data.notes ? data.notes.trim() : null;
    if (data.is_active !== undefined) hotel.is_active = data.is_active;
    hotel.updated_at = new Date().toISOString();

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          `UPDATE hotels SET name = ?, city = ?, address = ?, star_rating = ?, phone = ?, email = ?, notes = ?, is_active = ?, updated_at = NOW() WHERE id = ?`,
          [hotel.name, hotel.city, hotel.address, hotel.star_rating, hotel.phone, hotel.email, hotel.notes, hotel.is_active, id]
        );
      } catch (err: any) {
        console.error('[MySQL] Error updating hotel in MySQL:', err.message);
      }
    }

    saveStore(store);
    this.logActivity(userId, 'UPDATE_HOTEL', 'HOTEL', id, `Updated hotel "${hotel.name}"`);
    return this.getHotelById(id);
  },

  async deleteHotel(id: number, userId = 1) {
    if (!store.hotels) return false;
    const idx = store.hotels.findIndex(h => h.id === id);
    if (idx === -1) return false;
    const [deleted] = store.hotels.splice(idx, 1);
    // Remove its rooms
    if (store.hotel_rooms) {
      store.hotel_rooms = store.hotel_rooms.filter(r => r.hotel_id !== id);
    }
    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query('DELETE FROM hotel_rooms WHERE hotel_id = ?', [id]).catch(() => {});
        await pool.query('DELETE FROM hotel_bookings WHERE hotel_id = ?', [id]).catch(() => {});
        await pool.query('DELETE FROM hotels WHERE id = ?', [id]).catch(() => {});
      } catch (err: any) {
        console.error('[MySQL] Error deleting hotel in MySQL:', err.message);
      }
    }

    this.logActivity(userId, 'DELETE_HOTEL', 'HOTEL', id, `Deleted hotel "${deleted.name}"`);
    return true;
  },

  // --------------------------------------------------------------------------
  // Hotel Room Types Management
  // --------------------------------------------------------------------------
  getHotelRooms(hotelId: number, activeOnly = false) {
    if (!store.hotel_rooms) store.hotel_rooms = [];
    let rooms = store.hotel_rooms.filter(r => r.hotel_id === hotelId);
    if (activeOnly) {
      rooms = rooms.filter(r => r.is_active === 1);
    }
    return rooms.sort((a, b) => a.name.localeCompare(b.name));
  },

  async createHotelRoom(hotelId: number, data: { name: string; price_per_night?: number; currency?: string; capacity?: number; description?: string }, userId = 1) {
    if (!store.hotel_rooms) store.hotel_rooms = [];
    if (!store.nextIds.hotel_rooms) store.nextIds.hotel_rooms = 10;
    const now = new Date().toISOString();
    let id = store.nextIds.hotel_rooms++;
    const room: HotelRoom = {
      id,
      hotel_id: hotelId,
      name: data.name.trim(),
      price_per_night: data.price_per_night !== undefined ? Number(data.price_per_night) : null,
      currency: data.currency ? data.currency.trim().toUpperCase() : 'USD',
      capacity: data.capacity !== undefined ? Number(data.capacity) : 2,
      description: data.description ? data.description.trim() : null,
      is_active: 1,
      created_at: now,
      updated_at: now,
    };

    if (isConnectedToMySQL && pool) {
      try {
        const [res]: any = await pool.query(
          `INSERT INTO hotel_rooms (hotel_id, name, price_per_night, currency, capacity, description, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [room.hotel_id, room.name, room.price_per_night, room.currency, room.capacity, room.description]
        );
        if (res && res.insertId) room.id = res.insertId;
      } catch (err: any) {
        console.error('[MySQL] Error creating hotel room in MySQL:', err.message);
      }
    }

    store.hotel_rooms.push(room);
    saveStore(store);
    const hotel = store.hotels.find(h => h.id === hotelId);
    this.logActivity(userId, 'CREATE_HOTEL_ROOM', 'HOTEL', hotelId, `Added room type "${room.name}" to hotel "${hotel?.name || 'Hotel'}"`);
    return room;
  },

  async updateHotelRoom(id: number, data: Partial<HotelRoom>, userId = 1) {
    if (!store.hotel_rooms) return null;
    const room = store.hotel_rooms.find(r => r.id === id);
    if (!room) return null;
    if (data.name !== undefined) room.name = data.name.trim();
    if (data.price_per_night !== undefined) room.price_per_night = data.price_per_night !== null ? Number(data.price_per_night) : null;
    if (data.currency !== undefined) room.currency = data.currency ? data.currency.trim().toUpperCase() : 'USD';
    if (data.capacity !== undefined) room.capacity = Number(data.capacity);
    if (data.description !== undefined) room.description = data.description ? data.description.trim() : null;
    if (data.is_active !== undefined) room.is_active = data.is_active;
    room.updated_at = new Date().toISOString();

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          `UPDATE hotel_rooms SET name = ?, price_per_night = ?, currency = ?, capacity = ?, description = ?, is_active = ?, updated_at = NOW() WHERE id = ?`,
          [room.name, room.price_per_night, room.currency, room.capacity, room.description, room.is_active, id]
        );
      } catch (err: any) {
        console.error('[MySQL] Error updating hotel room in MySQL:', err.message);
      }
    }

    saveStore(store);
    this.logActivity(userId, 'UPDATE_HOTEL_ROOM', 'HOTEL', room.hotel_id, `Updated room type "${room.name}"`);
    return room;
  },

  async deleteHotelRoom(id: number, userId = 1) {
    if (!store.hotel_rooms) return false;
    const idx = store.hotel_rooms.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const [deleted] = store.hotel_rooms.splice(idx, 1);
    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query('UPDATE hotel_bookings SET room_type_id = NULL WHERE room_type_id = ?', [id]).catch(() => {});
        await pool.query('DELETE FROM hotel_rooms WHERE id = ?', [id]);
      } catch (err: any) {
        console.error('[MySQL] Error deleting hotel room in MySQL:', err.message);
      }
    }

    this.logActivity(userId, 'DELETE_HOTEL_ROOM', 'HOTEL', deleted.hotel_id, `Deleted room type "${deleted.name}"`);
    return true;
  },

  // --------------------------------------------------------------------------
  // Hotel Bookings & Customer Assignments
  // --------------------------------------------------------------------------
  getHotelBookings(filters?: { clientId?: number; hotelId?: number; status?: string; search?: string }) {
    if (!store.hotel_bookings) store.hotel_bookings = [];
    let list = [...store.hotel_bookings];

    if (filters?.clientId) {
      list = list.filter(b => b.client_id === filters.clientId);
    }
    if (filters?.hotelId) {
      list = list.filter(b => b.hotel_id === filters.hotelId);
    }
    if (filters?.status && filters.status !== 'all') {
      list = list.filter(b => b.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(b => {
        const client = store.clients.find(c => c.id === b.client_id);
        const hotel = (store.hotels || []).find(h => h.id === b.hotel_id);
        return (
          b.booking_reference.toLowerCase().includes(q) ||
          (b.room_type_name && b.room_type_name.toLowerCase().includes(q)) ||
          (b.comment && b.comment.toLowerCase().includes(q)) ||
          (client && (client.full_name.toLowerCase().includes(q) || client.passport_number.toLowerCase().includes(q) || client.client_id.toLowerCase().includes(q))) ||
          (hotel && (hotel.name.toLowerCase().includes(q) || (hotel.city && hotel.city.toLowerCase().includes(q))))
        );
      });
    }

    return list.map(b => {
      const client = store.clients.find(c => c.id === b.client_id);
      const hotel = (store.hotels || []).find(h => h.id === b.hotel_id);
      const user = b.created_by_user_id ? store.users.find(u => u.id === b.created_by_user_id) : null;

      return {
        ...b,
        client_name: client?.full_name || 'Unknown Client',
        client_code: client?.client_id || '',
        passport_number: client?.passport_number || '',
        client_photo_url: client?.photo_url || null,
        hotel_name: hotel?.name || 'Unknown Hotel',
        hotel_city: hotel?.city || null,
        hotel_address: hotel?.address || null,
        hotel_star_rating: hotel?.star_rating || 4,
        created_by_user_name: user?.name || null,
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getHotelBookingById(id: number) {
    if (!store.hotel_bookings) return null;
    const b = store.hotel_bookings.find(item => item.id === id);
    if (!b) return null;
    const client = store.clients.find(c => c.id === b.client_id);
    const hotel = (store.hotels || []).find(h => h.id === b.hotel_id);
    const user = b.created_by_user_id ? store.users.find(u => u.id === b.created_by_user_id) : null;
    return {
      ...b,
      client_name: client?.full_name || 'Unknown Client',
      client_code: client?.client_id || '',
      passport_number: client?.passport_number || '',
      client_photo_url: client?.photo_url || null,
      hotel_name: hotel?.name || 'Unknown Hotel',
      hotel_city: hotel?.city || null,
      hotel_address: hotel?.address || null,
      hotel_star_rating: hotel?.star_rating || 4,
      created_by_user_name: user?.name || null,
    };
  },

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
  }, userId = 1) {
    if (!store.hotel_bookings) store.hotel_bookings = [];
    if (!store.nextIds.hotel_bookings) store.nextIds.hotel_bookings = 2;

    const client = store.clients.find(c => c.id === data.client_id);
    if (!client) throw new Error('Client not found');

    const hotel = (store.hotels || []).find(h => h.id === data.hotel_id);
    if (!hotel) throw new Error('Hotel not found');

    // Resolve room type name if room_type_id is provided
    let roomName = data.room_type_name || null;
    if (data.room_type_id) {
      const room = (store.hotel_rooms || []).find(r => r.id === data.room_type_id);
      if (room) {
        roomName = room.name;
      }
    }

    let id = store.nextIds.hotel_bookings++;
    let refNum = `HB-${String(id).padStart(6, '0')}`;
    const now = new Date().toISOString();

    // AUTOMATIC TASK CREATION: Create a task for staff on the check-out date!
    let checkoutTaskId = store.nextIds.tasks++;
    const taskTitle = `Hotel Check-Out: ${client.full_name} (${hotel.name})`;
    const taskDesc = `Scheduled checkout at ${hotel.name}${roomName ? ` [${roomName}]` : ''}.\nCheck-in: ${data.check_in_date} → Check-out: ${data.check_out_date}.\nClient: ${client.full_name} (${client.passport_number}).${data.comment ? `\nComment/Notes: ${data.comment}` : ''}`;

    if (isConnectedToMySQL && pool) {
      try {
        const [taskRes]: any = await pool.query(
          `INSERT INTO tasks (title, description, client_id, application_id, assigned_user_id, due_date, priority, status, is_delivery_task, created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, ?, 'High', 'Pending', 0, NOW(), NOW())`,
          [taskTitle, taskDesc, client.id, userId || 1, data.check_out_date]
        );
        if (taskRes && taskRes.insertId) checkoutTaskId = taskRes.insertId;

        const [bookRes]: any = await pool.query(
          `INSERT INTO hotel_bookings (booking_reference, client_id, hotel_id, room_type_id, room_type_name, check_in_date, check_out_date, guest_count, room_count, status, comment, special_requests, total_price, currency, checkout_task_id, created_by_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            refNum,
            data.client_id,
            data.hotel_id,
            data.room_type_id || null,
            roomName,
            data.check_in_date,
            data.check_out_date,
            data.guest_count || 1,
            data.room_count || 1,
            data.status || 'Confirmed',
            data.comment ? data.comment.trim() : null,
            data.special_requests ? data.special_requests.trim() : null,
            data.total_price !== undefined && data.total_price !== null ? Number(data.total_price) : null,
            data.currency ? data.currency.trim().toUpperCase() : 'USD',
            checkoutTaskId,
            userId,
          ]
        );
        if (bookRes && bookRes.insertId) {
          id = bookRes.insertId;
          refNum = `HB-${String(id).padStart(6, '0')}`;
          await pool.query('UPDATE hotel_bookings SET booking_reference = ? WHERE id = ?', [refNum, id]);
        }
      } catch (err: any) {
        console.error('[MySQL] Error creating hotel booking in MySQL:', err.message);
      }
    }

    const checkoutTask: Task = {
      id: checkoutTaskId,
      title: taskTitle,
      description: taskDesc,
      client_id: client.id,
      application_id: null,
      assigned_user_id: userId || 1,
      due_date: data.check_out_date,
      priority: 'High',
      status: 'Pending',
      is_delivery_task: 0,
      completed_at: null,
      created_at: now,
      updated_at: now,
    };
    store.tasks.push(checkoutTask);

    const booking: HotelBooking = {
      id,
      booking_reference: refNum,
      client_id: data.client_id,
      hotel_id: data.hotel_id,
      room_type_id: data.room_type_id || null,
      room_type_name: roomName,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
      guest_count: data.guest_count || 1,
      room_count: data.room_count || 1,
      status: data.status || 'Confirmed',
      comment: data.comment ? data.comment.trim() : null,
      special_requests: data.special_requests ? data.special_requests.trim() : null,
      total_price: data.total_price !== undefined && data.total_price !== null ? Number(data.total_price) : null,
      currency: data.currency ? data.currency.trim().toUpperCase() : 'USD',
      checkout_task_id: checkoutTaskId,
      created_by_user_id: userId,
      created_at: now,
      updated_at: now,
    };

    store.hotel_bookings.push(booking);
    saveStore(store);

    this.logActivity(
      userId,
      'CREATE_HOTEL_BOOKING',
      'HOTEL',
      id,
      `Assigned hotel "${hotel.name}" to client ${client.full_name} (${data.check_in_date} to ${data.check_out_date}). Check-out task created on ${data.check_out_date}.`
    );

    return this.getHotelBookingById(id);
  },

  async updateHotelBooking(id: number, data: Partial<HotelBooking>, userId = 1) {
    if (!store.hotel_bookings) return null;
    const booking = store.hotel_bookings.find(b => b.id === id);
    if (!booking) return null;

    const oldCheckoutDate = booking.check_out_date;

    if (data.hotel_id !== undefined) booking.hotel_id = data.hotel_id;
    if (data.room_type_id !== undefined) booking.room_type_id = data.room_type_id;
    if (data.room_type_name !== undefined) booking.room_type_name = data.room_type_name;
    if (data.check_in_date !== undefined) booking.check_in_date = data.check_in_date;
    if (data.check_out_date !== undefined) booking.check_out_date = data.check_out_date;
    if (data.guest_count !== undefined) booking.guest_count = Number(data.guest_count);
    if (data.room_count !== undefined) booking.room_count = Number(data.room_count);
    if (data.status !== undefined) booking.status = data.status;
    if (data.comment !== undefined) booking.comment = data.comment ? data.comment.trim() : null;
    if (data.special_requests !== undefined) booking.special_requests = data.special_requests ? data.special_requests.trim() : null;
    if (data.total_price !== undefined) booking.total_price = data.total_price !== null ? Number(data.total_price) : null;
    if (data.currency !== undefined) booking.currency = data.currency ? data.currency.trim().toUpperCase() : 'USD';

    booking.updated_at = new Date().toISOString();

    // If check-out date changed, update the associated task's due_date
    if (booking.checkout_task_id && data.check_out_date && data.check_out_date !== oldCheckoutDate) {
      const task = store.tasks.find(t => t.id === booking.checkout_task_id);
      if (task) {
        task.due_date = data.check_out_date;
        task.updated_at = new Date().toISOString();
      }
    }

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query(
          `UPDATE hotel_bookings SET hotel_id = ?, room_type_id = ?, room_type_name = ?, check_in_date = ?, check_out_date = ?, guest_count = ?, room_count = ?, status = ?, comment = ?, special_requests = ?, total_price = ?, currency = ?, updated_at = NOW() WHERE id = ?`,
          [booking.hotel_id, booking.room_type_id, booking.room_type_name, booking.check_in_date, booking.check_out_date, booking.guest_count, booking.room_count, booking.status, booking.comment, booking.special_requests, booking.total_price, booking.currency, id]
        );
        if (booking.checkout_task_id && data.check_out_date && data.check_out_date !== oldCheckoutDate) {
          await pool.query('UPDATE tasks SET due_date = ?, updated_at = NOW() WHERE id = ?', [data.check_out_date, booking.checkout_task_id]);
        }
      } catch (err: any) {
        console.error('[MySQL] Error updating hotel booking in MySQL:', err.message);
      }
    }

    saveStore(store);
    this.logActivity(userId, 'UPDATE_HOTEL_BOOKING', 'HOTEL', id, `Updated hotel booking ${booking.booking_reference}`);
    return this.getHotelBookingById(id);
  },

  async deleteHotelBooking(id: number, userId = 1) {
    if (!store.hotel_bookings) return false;
    const idx = store.hotel_bookings.findIndex(b => b.id === id);
    if (idx === -1) return false;
    const [booking] = store.hotel_bookings.splice(idx, 1);

    // If associated checkout task is still pending, delete it
    if (booking.checkout_task_id) {
      const taskIdx = store.tasks.findIndex(t => t.id === booking.checkout_task_id);
      if (taskIdx !== -1 && store.tasks[taskIdx].status === 'Pending') {
        store.tasks.splice(taskIdx, 1);
      }
    }

    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        if (booking.checkout_task_id) {
          await pool.query('DELETE FROM tasks WHERE id = ? AND status = "Pending"', [booking.checkout_task_id]).catch(() => {});
        }
        await pool.query('DELETE FROM hotel_bookings WHERE id = ?', [id]);
      } catch (err: any) {
        console.error('[MySQL] Error deleting hotel booking in MySQL:', err.message);
      }
    }

    this.logActivity(userId, 'DELETE_HOTEL_BOOKING', 'HOTEL', id, `Deleted hotel booking ${booking.booking_reference}`);
    return true;
  },

  // Dashboard Statistics
  getDashboardMetrics() {
    const today = new Date().toISOString().split('T')[0];

    const totalClients = store.clients.length;
    const activeApplications = store.visa_applications.filter(
      a => a.status !== 'Rejected' && a.status !== 'Pending Collection' && a.status !== 'Returned'
    ).length;

    const cleanDue = (d?: string | null) => (d ? String(d).slice(0, 10) : '');
    const todayTasks = store.tasks.filter(t => cleanDue(t.due_date) === today && t.status === 'Pending').length;
    const overdueTasks = store.tasks.filter(t => cleanDue(t.due_date) < today && t.status === 'Pending').length;
    const upcomingTasks = store.tasks.filter(t => cleanDue(t.due_date) > today && t.status === 'Pending').length;

    const attentionStatuses = ['File Missing', 'Need to Prepare', 'Modify', 'Rejected'];
    const appsRequiringAttention = store.visa_applications
      .filter(a => attentionStatuses.includes(a.status))
      .map(a => {
        const client = store.clients.find(c => c.id === a.client_id);
        const vt = store.visa_types.find(v => v.id === a.visa_type_id);
        return {
          ...a,
          client_name: client?.full_name || 'Client',
          passport_number: client?.passport_number || '',
          visa_type_name: vt?.name || '',
        };
      });

    const recentClients = store.clients
      .slice(0, 5)
      .map(c => {
        const apps = store.visa_applications.filter(a => a.client_id === c.id);
        const latest = apps[apps.length - 1];
        return {
          ...c,
          active_status: latest ? latest.status : 'New',
        };
      });

    const recentActivity = this.getActivityLogs(8);

    return {
      total_clients: totalClients,
      active_applications: activeApplications,
      today_tasks: todayTasks,
      overdue_tasks: overdueTasks,
      upcoming_tasks: upcomingTasks,
      apps_requiring_attention: appsRequiringAttention,
      recent_clients: recentClients,
      recent_activity: recentActivity,
    };
  },

  // --------------------------------------------------------------------------
  // Data Purge & Historical Storage Management (Preserves Clients)
  // --------------------------------------------------------------------------
  previewPurgeData(options: {
    startDate?: string;
    endDate?: string;
    targets: {
      applications?: boolean;
      hotel_bookings?: boolean;
      tasks?: boolean;
      status_history?: boolean;
      activity_logs?: boolean;
    };
  }) {
    const { startDate, endDate } = options;
    const targets = options.targets || {};

    const normalizeDateStr = (dateVal?: any): string | null => {
      if (!dateVal) return null;
      if (dateVal instanceof Date) {
        if (isNaN(dateVal.getTime())) return null;
        return dateVal.toISOString().slice(0, 10);
      }
      if (typeof dateVal === 'number') {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      }
      const s = String(dateVal).trim();
      if (!s || s === 'null' || s === 'undefined') return null;
      if (s.includes('T')) return s.split('T')[0];
      if (s.includes(' ')) return s.split(' ')[0];
      return s.slice(0, 10);
    };

    const normStartDate = normalizeDateStr(startDate);
    const normEndDate = normalizeDateStr(endDate);

    const isDateInRange = (dateVal?: any) => {
      const d = normalizeDateStr(dateVal);
      if (!d) return false;
      if (normStartDate && d < normStartDate) return false;
      if (normEndDate && d > normEndDate) return false;
      return true;
    };

    let matchingApps = 0;
    let matchingBookings = 0;
    let matchingTasks = 0;
    let matchingHistory = 0;
    let matchingLogs = 0;

    if (targets.applications) {
      matchingApps = (store.visa_applications || []).filter(a => isDateInRange(a.created_at) || isDateInRange(a.updated_at)).length;
    }

    if (targets.hotel_bookings) {
      matchingBookings = (store.hotel_bookings || []).filter(
        b => isDateInRange(b.created_at) || isDateInRange(b.check_in_date) || isDateInRange(b.check_out_date)
      ).length;
    }

    if (targets.tasks) {
      matchingTasks = (store.tasks || []).filter(t => isDateInRange(t.created_at) || isDateInRange(t.due_date)).length;
    }

    if (targets.status_history) {
      matchingHistory = (store.application_status_history || []).filter(h => isDateInRange(h.created_at || (h as any).changed_at)).length;
    }

    if (targets.activity_logs) {
      matchingLogs = (store.activity_logs || []).filter(l => isDateInRange(l.created_at)).length;
    }

    const totalToDelete = matchingApps + matchingBookings + matchingTasks + matchingHistory + matchingLogs;

    return {
      date_range: {
        start_date: normStartDate || 'Beginning of time',
        end_date: normEndDate || 'Latest record',
      },
      counts: {
        applications: matchingApps,
        hotel_bookings: matchingBookings,
        tasks: matchingTasks,
        status_history: matchingHistory,
        activity_logs: matchingLogs,
        total: totalToDelete,
      },
      clients_preserved: (store.clients || []).length,
      current_records: {
        clients: (store.clients || []).length,
        applications: (store.visa_applications || []).length,
        hotel_bookings: (store.hotel_bookings || []).length,
        tasks: (store.tasks || []).length,
        status_history: (store.application_status_history || []).length,
        activity_logs: (store.activity_logs || []).length,
      },
    };
  },

  async purgeData(
    options: {
      startDate?: string;
      endDate?: string;
      targets: {
        applications?: boolean;
        hotel_bookings?: boolean;
        tasks?: boolean;
        status_history?: boolean;
        activity_logs?: boolean;
      };
    },
    operatorId: number = 1
  ) {
    const { startDate, endDate } = options;
    const targets = options.targets || {};

    const normalizeDateStr = (dateVal?: any): string | null => {
      if (!dateVal) return null;
      if (dateVal instanceof Date) {
        if (isNaN(dateVal.getTime())) return null;
        return dateVal.toISOString().slice(0, 10);
      }
      if (typeof dateVal === 'number') {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      }
      const s = String(dateVal).trim();
      if (!s || s === 'null' || s === 'undefined') return null;
      if (s.includes('T')) return s.split('T')[0];
      if (s.includes(' ')) return s.split(' ')[0];
      return s.slice(0, 10);
    };

    const normStartDate = normalizeDateStr(startDate);
    const normEndDate = normalizeDateStr(endDate);

    const isDateInRange = (dateVal?: any) => {
      const d = normalizeDateStr(dateVal);
      if (!d) return false;
      if (normStartDate && d < normStartDate) return false;
      if (normEndDate && d > normEndDate) return false;
      return true;
    };

    let deletedAppsCount = 0;
    let deletedBookingsCount = 0;
    let deletedTasksCount = 0;
    let deletedHistoryCount = 0;
    let deletedLogsCount = 0;

    // 1. Purge Visa Applications & cascaded tasks/comments/history
    if (targets.applications) {
      const appsToKeep: VisaApplication[] = [];
      const deletedAppIds = new Set<number>();

      for (const app of store.visa_applications || []) {
        if (isDateInRange(app.created_at) || isDateInRange(app.updated_at)) {
          deletedAppIds.add(app.id);
          deletedAppsCount++;
        } else {
          appsToKeep.push(app);
        }
      }

      store.visa_applications = appsToKeep;

      if (deletedAppIds.size > 0) {
        // Cascade clean comments and status history for deleted applications
        store.comments = (store.comments || []).filter(c => !c.application_id || !deletedAppIds.has(c.application_id));
        store.application_status_history = (store.application_status_history || []).filter(h => !deletedAppIds.has(h.application_id));
        // Remove tasks tied to deleted applications
        store.tasks = (store.tasks || []).filter(t => !t.application_id || !deletedAppIds.has(t.application_id));
      }
    }

    // 2. Purge Hotel Bookings & linked checkout tasks
    if (targets.hotel_bookings) {
      const bookingsToKeep: HotelBooking[] = [];
      const deletedCheckoutTaskIds = new Set<number>();

      for (const b of store.hotel_bookings || []) {
        if (isDateInRange(b.created_at) || isDateInRange(b.check_in_date) || isDateInRange(b.check_out_date)) {
          deletedBookingsCount++;
          if (b.checkout_task_id) {
            deletedCheckoutTaskIds.add(b.checkout_task_id);
          }
        } else {
          bookingsToKeep.push(b);
        }
      }

      store.hotel_bookings = bookingsToKeep;

      if (deletedCheckoutTaskIds.size > 0) {
        store.tasks = (store.tasks || []).filter(t => !deletedCheckoutTaskIds.has(t.id));
      }
    }

    // 3. Purge Tasks in Date Range
    if (targets.tasks) {
      const tasksToKeep: Task[] = [];
      for (const task of store.tasks || []) {
        if (isDateInRange(task.created_at) || isDateInRange(task.due_date)) {
          deletedTasksCount++;
        } else {
          tasksToKeep.push(task);
        }
      }
      store.tasks = tasksToKeep;
    }

    // 4. Purge Status Audit History in Date Range
    if (targets.status_history) {
      const historyToKeep: ApplicationStatusHistory[] = [];
      for (const item of store.application_status_history || []) {
        if (isDateInRange(item.created_at || (item as any).changed_at)) {
          deletedHistoryCount++;
        } else {
          historyToKeep.push(item);
        }
      }
      store.application_status_history = historyToKeep;
    }

    // 5. Purge Activity Logs in Date Range
    if (targets.activity_logs) {
      const logsToKeep: ActivityLog[] = [];
      for (const item of store.activity_logs || []) {
        if (isDateInRange(item.created_at)) {
          deletedLogsCount++;
        } else {
          logsToKeep.push(item);
        }
      }
      store.activity_logs = logsToKeep;
    }

    saveStore(store);

    if (isConnectedToMySQL && pool) {
      try {
        await pool.query('SET FOREIGN_KEY_CHECKS = 0').catch(() => {});
        let dateCondition = '';
        const params: any[] = [];
        if (normStartDate && normEndDate) {
          dateCondition = 'BETWEEN ? AND ?';
          params.push(normStartDate, normEndDate + ' 23:59:59');
        } else if (normStartDate) {
          dateCondition = '>= ?';
          params.push(normStartDate);
        } else if (normEndDate) {
          dateCondition = '<= ?';
          params.push(normEndDate + ' 23:59:59');
        }

        if (targets.applications) {
          if (dateCondition) {
            await pool.query(`DELETE FROM application_status_history WHERE application_id IN (SELECT id FROM visa_applications WHERE created_at ${dateCondition})`, params).catch(() => {});
            await pool.query(`DELETE FROM tasks WHERE application_id IN (SELECT id FROM visa_applications WHERE created_at ${dateCondition})`, params).catch(() => {});
            await pool.query(`DELETE FROM comments WHERE application_id IN (SELECT id FROM visa_applications WHERE created_at ${dateCondition})`, params).catch(() => {});
            await pool.query(`DELETE FROM visa_applications WHERE created_at ${dateCondition}`, params).catch(() => {});
          } else {
            await pool.query('DELETE FROM application_status_history').catch(() => {});
            await pool.query('DELETE FROM comments WHERE application_id IS NOT NULL').catch(() => {});
            await pool.query('DELETE FROM visa_applications').catch(() => {});
          }
        }
        if (targets.hotel_bookings) {
          if (dateCondition) {
            await pool.query(`DELETE FROM hotel_bookings WHERE created_at ${dateCondition}`, params).catch(() => {});
          } else {
            await pool.query('DELETE FROM hotel_bookings').catch(() => {});
          }
        }
        if (targets.tasks) {
          if (dateCondition) {
            await pool.query(`DELETE FROM tasks WHERE due_date ${dateCondition}`, params).catch(() => {});
          } else {
            await pool.query('DELETE FROM tasks').catch(() => {});
          }
        }
        if (targets.status_history) {
          if (dateCondition) {
            await pool.query(`DELETE FROM application_status_history WHERE created_at ${dateCondition}`, params).catch(() => {});
          } else {
            await pool.query('DELETE FROM application_status_history').catch(() => {});
          }
        }
        if (targets.activity_logs) {
          if (dateCondition) {
            await pool.query(`DELETE FROM activity_logs WHERE created_at ${dateCondition}`, params).catch(() => {});
          } else {
            await pool.query('DELETE FROM activity_logs').catch(() => {});
          }
        }
        await pool.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      } catch (err: any) {
        console.error('[MySQL] Error during purgeData in MySQL:', err.message);
        await pool.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      }
    }

    // Record audit activity of the purge
    const rangeDescription = startDate && endDate
      ? `from ${startDate} to ${endDate}`
      : startDate
      ? `since ${startDate}`
      : endDate
      ? `up to ${endDate}`
      : 'all historical records';

    const totalPurged = deletedAppsCount + deletedBookingsCount + deletedTasksCount + deletedHistoryCount + deletedLogsCount;

    this.logActivity(
      operatorId,
      'PURGE_DATA',
      'SYSTEM',
      operatorId,
      `Purged ${totalPurged} historical records ${rangeDescription}. Clients preserved: ${store.clients.length}.`
    );

    return {
      success: true,
      purged_counts: {
        applications: deletedAppsCount,
        hotel_bookings: deletedBookingsCount,
        tasks: deletedTasksCount,
        status_history: deletedHistoryCount,
        activity_logs: deletedLogsCount,
        total: totalPurged,
      },
      clients_preserved: store.clients.length,
      current_records: {
        clients: store.clients.length,
        applications: store.visa_applications.length,
        hotel_bookings: store.hotel_bookings.length,
        tasks: store.tasks.length,
        status_history: store.application_status_history.length,
        activity_logs: store.activity_logs.length,
      },
    };
  },

  // --------------------------------------------------------------------------
  // System Settings & Secret Login Access URL Management
  // --------------------------------------------------------------------------
  getSettings(): Setting[] {
    if (!store.settings) {
      store.settings = [];
    }
    return store.settings;
  },

  getSetting(key: string, defaultValue = ''): string {
    if (!store.settings) {
      store.settings = [];
    }
    const item = store.settings.find(s => s.setting_key === key);
    return item ? item.setting_value : defaultValue;
  },

  setSetting(key: string, value: string): void {
    if (!store.settings) {
      store.settings = [];
    }
    const now = new Date().toISOString();
    const existing = store.settings.find(s => s.setting_key === key);
    if (existing) {
      existing.setting_value = value;
      existing.updated_at = now;
    } else {
      const id = (store.nextIds && store.nextIds.settings) ? store.nextIds.settings++ : (store.settings.length + 1);
      store.settings.push({
        id,
        setting_key: key,
        setting_value: value,
        updated_at: now,
      });
    }
    saveStore(store);

    if (isConnectedToMySQL && pool) {
      pool.query(
        'INSERT INTO `settings` (`setting_key`, `setting_value`, `updated_at`) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`), `updated_at` = NOW()',
        [key, value]
      ).catch(err => {
        console.warn('[MySQL] Failed to update setting in database:', err.message);
      });
    }
  },

  getSecretLoginSettings(): { enabled: boolean; secretKey: string; loginPath: string } {
    const enabledVal = this.getSetting('secret_login_enabled', '1');
    const secretKeyVal = this.getSetting('secret_login_key', 'sn-secure-staff-2026');
    const enabled = enabledVal === '1' || enabledVal === 'true';
    const secretKey = secretKeyVal || 'sn-secure-staff-2026';
    return {
      enabled,
      secretKey,
      loginPath: `/access/${secretKey}`,
    };
  },

  updateSecretLoginSettings(
    enabled: boolean,
    secretKey: string,
    operatorId: number = 1
  ): { enabled: boolean; secretKey: string; loginPath: string } {
    const cleanKey =
      secretKey
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/^-+|-+$/g, '') || 'sn-secure-staff-2026';

    this.setSetting('secret_login_enabled', enabled ? '1' : '0');
    this.setSetting('secret_login_key', cleanKey);

    this.logActivity(
      operatorId,
      'UPDATE_SECURITY',
      'SETTINGS',
      null,
      `Updated Secret Login URL configuration: Protection ${enabled ? 'Enabled' : 'Disabled'}, Access Key: "${cleanKey}"`
    );

    return {
      enabled,
      secretKey: cleanKey,
      loginPath: `/access/${cleanKey}`,
    };
  },

  // --------------------------------------------------------------------------
  // 1-Click Full SQL Database Backup & Restore Engine
  // --------------------------------------------------------------------------
  generateFullSqlDump(): string {
    const timestamp = new Date().toISOString();
    let sql = `-- ========================================================\n`;
    sql += `-- SN Travels Agency — Full Database Backup\n`;
    sql += `-- Generated: ${timestamp}\n`;
    sql += `-- Engine: MySQL / MariaDB (phpMyAdmin Compatible)\n`;
    sql += `-- Total Clients: ${store.clients.length} | Applications: ${store.visa_applications.length}\n`;
    sql += `-- ========================================================\n\n`;
    sql += `SET NAMES utf8mb4;\n`;
    sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    const escapeSql = (val: any): string => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return String(val);
      if (typeof val === 'boolean') return val ? '1' : '0';
      const str = String(val)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\0/g, '\\0')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
      return `'${str}'`;
    };

    const dumpTable = (tableName: string, rows: any[]) => {
      sql += `-- --------------------------------------------------------\n`;
      sql += `-- Table: \`${tableName}\` (${rows.length} rows)\n`;
      sql += `-- --------------------------------------------------------\n`;
      if (rows.length === 0) {
        sql += `-- (No rows)\n\n`;
        return;
      }
      const keys = Object.keys(rows[0]);
      const columns = keys.map(k => `\`${k}\``).join(', ');
      sql += `DELETE FROM \`${tableName}\`;\n`;
      sql += `INSERT INTO \`${tableName}\` (${columns}) VALUES\n`;
      const values = rows.map(r => {
        const rowVals = keys.map(k => escapeSql(r[k])).join(', ');
        return `(${rowVals})`;
      }).join(',\n');
      sql += `${values};\n\n`;
    };

    dumpTable('users', store.users);
    dumpTable('countries', store.countries);
    dumpTable('client_custom_fields', store.client_custom_fields);
    dumpTable('clients', store.clients);
    dumpTable('client_custom_field_values', store.client_custom_field_values);
    dumpTable('visa_types', store.visa_types);
    dumpTable('visa_applications', store.visa_applications);
    dumpTable('application_status_history', store.application_status_history);
    dumpTable('tasks', store.tasks);
    dumpTable('comments', store.comments);
    dumpTable('activity_logs', store.activity_logs);
    dumpTable('hotels', store.hotels);
    dumpTable('hotel_rooms', store.hotel_rooms);
    dumpTable('hotel_bookings', store.hotel_bookings);
    dumpTable('settings', store.settings || []);

    // Also append metadata JSON block for instant 100% faithful JSON parse restore
    sql += `-- ========================================================\n`;
    sql += `-- JSON_SNAPSHOT_START\n`;
    sql += `-- ${Buffer.from(JSON.stringify(store)).toString('base64')}\n`;
    sql += `-- JSON_SNAPSHOT_END\n`;
    sql += `-- ========================================================\n\n`;
    sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    sql += `-- Full Backup Dump Completed Successfully.\n`;

    return sql;
  },

  restoreFromSqlDump(dumpContent: string, operatorId: number = 1): {
    success: boolean;
    restored: {
      clients: number;
      applications: number;
      hotel_bookings: number;
      tasks: number;
      users: number;
    };
  } {
    if (!dumpContent || typeof dumpContent !== 'string') {
      throw new Error('Invalid SQL backup content provided');
    }

    // 1. Check for embedded JSON snapshot for perfect recovery
    const match = dumpContent.match(/-- JSON_SNAPSHOT_START\n-- ([A-Za-z0-9+/=]+)\n-- JSON_SNAPSHOT_END/);
    if (match && match[1]) {
      try {
        const jsonStr = Buffer.from(match[1], 'base64').toString('utf-8');
        const parsed = JSON.parse(jsonStr);
        if (parsed.clients && Array.isArray(parsed.clients) && parsed.users && Array.isArray(parsed.users)) {
          // Restore all tables
          store.users = parsed.users || [];
          store.countries = parsed.countries || [];
          store.client_custom_fields = parsed.client_custom_fields || [];
          store.clients = parsed.clients || [];
          store.client_custom_field_values = parsed.client_custom_field_values || [];
          store.visa_types = parsed.visa_types || [];
          store.visa_applications = parsed.visa_applications || [];
          store.application_status_history = parsed.application_status_history || [];
          store.tasks = parsed.tasks || [];
          store.comments = parsed.comments || [];
          store.activity_logs = parsed.activity_logs || [];
          store.hotels = parsed.hotels || [];
          store.hotel_rooms = parsed.hotel_rooms || [];
          store.hotel_bookings = parsed.hotel_bookings || [];
          store.settings = parsed.settings || store.settings;
          store.nextIds = parsed.nextIds || store.nextIds;

          saveStore(store);

          this.logActivity(
            operatorId,
            'RESTORE_DATABASE',
            'SYSTEM',
            operatorId,
            `Restored full database from backup file. Clients: ${store.clients.length}, Applications: ${store.visa_applications.length}`
          );

          return {
            success: true,
            restored: {
              clients: store.clients.length,
              applications: store.visa_applications.length,
              hotel_bookings: store.hotel_bookings.length,
              tasks: store.tasks.length,
              users: store.users.length,
            },
          };
        }
      } catch (err: any) {
        console.warn('[Restore] Failed to restore from JSON snapshot, attempting SQL parser fallback...', err);
      }
    }

    // 2. Direct JSON format restore if the user provided raw JSON export
    if (dumpContent.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(dumpContent);
        if (parsed.clients && Array.isArray(parsed.clients)) {
          Object.assign(store, parsed);
          saveStore(store);
          return {
            success: true,
            restored: {
              clients: store.clients.length,
              applications: store.visa_applications.length,
              hotel_bookings: store.hotel_bookings.length,
              tasks: store.tasks.length,
              users: store.users.length,
            },
          };
        }
      } catch (e) {
        // Continue to error
      }
    }

    throw new Error('Unrecognized SQL backup format. Please ensure you upload a valid SN Travels SQL backup file.');
  },
};
