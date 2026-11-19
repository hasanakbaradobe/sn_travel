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

const DB_SSL = process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true';

let pool: mysql.Pool | null = null;
let isConnectedToMySQL = false;
let connectionError: string | null = null;
let schemaInitialized = false;
let hasCompletedInitialSync = false;
let initialSyncPromise: Promise<void> | null = null;
const syncCompletedListeners = new Set<() => void>();
let lastProbeAttemptTime = 0;
let lastPingMs: number | null = null;
let inFlightProbePromise: Promise<boolean> | null = null;
const PROBE_COOLDOWN_MS = 10000;

function isTransientMySQLError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EPIPE' ||
    code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
    code === 'ER_SERVER_SHUTDOWN' ||
    code === 'ER_TOO_MANY_USER_CONNECTIONS' ||
    code === 'ER_CON_COUNT_ERROR' ||
    msg.includes('connection lost') ||
    msg.includes('closed state') ||
    msg.includes('read econnreset') ||
    msg.includes('timed out')
  );
}

async function probeMySQLConnection(force = false): Promise<boolean> {
  if (!pool) return false;
  const now = Date.now();
  if (!force && !isConnectedToMySQL && lastProbeAttemptTime > 0 && now - lastProbeAttemptTime < PROBE_COOLDOWN_MS) {
    return false;
  }
  if (inFlightProbePromise) {
    return inFlightProbePromise;
  }

  lastProbeAttemptTime = now;
  inFlightProbePromise = (async () => {
    const startMs = Date.now();
    let conn: mysql.PoolConnection | null = null;
    try {
      conn = await pool!.getConnection();
      lastPingMs = Date.now() - startMs;
      isConnectedToMySQL = true;
      connectionError = null;

      if (!schemaInitialized) {
        console.log(`[Database] Connected to MySQL database "${DB_NAME}" at ${DB_HOST}:${DB_PORT} (${lastPingMs}ms)`);

        // 1. Ensure tables exist in parallel
        await Promise.allSettled([
          conn.query(`
            CREATE TABLE IF NOT EXISTS follow_ups (
              id INT AUTO_INCREMENT PRIMARY KEY,
              client_id INT NOT NULL,
              title VARCHAR(255) NOT NULL,
              reason VARCHAR(150) NOT NULL,
              channel ENUM('WhatsApp', 'Phone Call', 'WeChat', 'Email', 'SMS') NOT NULL DEFAULT 'WhatsApp',
              cadence ENUM('1 Month', '2 Months', '3 Months', '6 Months', 'One-time') NOT NULL DEFAULT '1 Month',
              due_date DATE NOT NULL,
              notes TEXT DEFAULT NULL,
              message_template TEXT DEFAULT NULL,
              status ENUM('Pending', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
              priority ENUM('Low', 'Normal', 'High', 'Urgent') NOT NULL DEFAULT 'Normal',
              task_id INT DEFAULT NULL,
              assigned_user_id INT DEFAULT NULL,
              completed_at DATETIME DEFAULT NULL,
              completed_notes TEXT DEFAULT NULL,
              created_by_user_id INT DEFAULT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_fu_client (client_id),
              INDEX idx_fu_due (due_date),
              INDEX idx_fu_status (status),
              INDEX idx_fu_due_status (due_date, status),
              INDEX idx_fu_task (task_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS invoice_settings (
              id INT AUTO_INCREMENT PRIMARY KEY,
              company_name VARCHAR(255) NOT NULL DEFAULT 'SN Travels Agency',
              company_tagline VARCHAR(255) DEFAULT 'China Visa & Travel Processing Specialists',
              logo_url TEXT DEFAULT NULL,
              phone VARCHAR(50) DEFAULT '+971 4 399 2200',
              whatsapp VARCHAR(50) DEFAULT '+971 50 123 4567',
              email VARCHAR(191) DEFAULT 'visa@sn-travelsagency.com',
              website VARCHAR(191) DEFAULT 'sn-travelsagency.com',
              address TEXT DEFAULT 'Office 402, Al Hudaiba Awards Building, 2nd December St, Dubai, UAE',
              tax_number VARCHAR(100) DEFAULT NULL,
              bank_details TEXT DEFAULT NULL,
              payment_notes TEXT DEFAULT NULL,
              terms_and_conditions TEXT DEFAULT NULL,
              signature_enabled TINYINT(1) NOT NULL DEFAULT 1,
              signature_name VARCHAR(150) DEFAULT 'Sarah Nadeem',
              signature_designation VARCHAR(150) DEFAULT 'Managing Director',
              signature_image_url LONGTEXT DEFAULT NULL,
              signature_style VARCHAR(20) DEFAULT 'script',
              default_currency VARCHAR(10) NOT NULL DEFAULT 'MYR',
              invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV-2026-',
              next_number INT NOT NULL DEFAULT 1001,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS invoice_catalog_items (
              id INT AUTO_INCREMENT PRIMARY KEY,
              name VARCHAR(200) NOT NULL,
              description TEXT DEFAULT NULL,
              default_unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              category VARCHAR(100) DEFAULT 'Visa Services',
              is_active TINYINT(1) NOT NULL DEFAULT 1,
              display_order INT NOT NULL DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_catalog_active (is_active),
              INDEX idx_catalog_order (display_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS invoices (
              id INT AUTO_INCREMENT PRIMARY KEY,
              invoice_number VARCHAR(50) NOT NULL UNIQUE,
              client_id INT NOT NULL,
              issue_date DATE NOT NULL,
              due_date DATE DEFAULT NULL,
              status ENUM('Pending', 'Paid', 'Partial', 'Cancelled') NOT NULL DEFAULT 'Pending',
              payment_method ENUM('Cash', 'Bank Transfer', 'Credit Card', 'WeChat Pay', 'Alipay', 'Other') DEFAULT NULL,
              currency VARCHAR(10) NOT NULL DEFAULT 'MYR',
              subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
              tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              balance_due DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              notes TEXT DEFAULT NULL,
              created_by_user_id INT DEFAULT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_invoices_client (client_id),
              INDEX idx_invoices_number (invoice_number),
              INDEX idx_invoices_status (status),
              INDEX idx_invoices_date (issue_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS invoice_items (
              id INT AUTO_INCREMENT PRIMARY KEY,
              invoice_id INT NOT NULL,
              catalog_item_id INT DEFAULT NULL,
              description VARCHAR(255) NOT NULL,
              quantity INT NOT NULL DEFAULT 1,
              unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              INDEX idx_inv_items_invoice (invoice_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `),
        ]);

        // 2. Check existing indexes in a single query and only create missing ones in parallel
        try {
          const [idxRows]: any = await conn.query(
            `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE()`
          );
          const existingIndexes = new Set(
            Array.isArray(idxRows) ? idxRows.map((r: any) => String(r.INDEX_NAME || r.index_name)) : []
          );

          const desiredIndexes: Array<[string, string]> = [
            ['idx_tasks_app_id', 'CREATE INDEX idx_tasks_app_id ON tasks(application_id)'],
            ['idx_tasks_client_id', 'CREATE INDEX idx_tasks_client_id ON tasks(client_id)'],
            ['idx_tasks_status', 'CREATE INDEX idx_tasks_status ON tasks(status)'],
            ['idx_tasks_due', 'CREATE INDEX idx_tasks_due ON tasks(due_date)'],
            ['idx_tasks_due_status', 'CREATE INDEX idx_tasks_due_status ON tasks(due_date, status)'],
            ['idx_tasks_client_due', 'CREATE INDEX idx_tasks_client_due ON tasks(client_id, due_date)'],
            ['idx_apps_client_id', 'CREATE INDEX idx_apps_client_id ON visa_applications(client_id)'],
            ['idx_apps_status', 'CREATE INDEX idx_apps_status ON visa_applications(status)'],
            ['idx_apps_delivery', 'CREATE INDEX idx_apps_delivery ON visa_applications(delivery_date)'],
            ['idx_apps_status_delivery', 'CREATE INDEX idx_apps_status_delivery ON visa_applications(status, delivery_date)'],
            ['idx_apps_client_status', 'CREATE INDEX idx_apps_client_status ON visa_applications(client_id, status)'],
            ['idx_app_hist_app_id', 'CREATE INDEX idx_app_hist_app_id ON application_status_history(application_id)'],
            ['idx_hb_client_id', 'CREATE INDEX idx_hb_client_id ON hotel_bookings(client_id)'],
            ['idx_hb_status', 'CREATE INDEX idx_hb_status ON hotel_bookings(status)'],
            ['idx_hb_dates', 'CREATE INDEX idx_hb_dates ON hotel_bookings(check_in_date, check_out_date)'],
            ['idx_hb_checkout_status', 'CREATE INDEX idx_hb_checkout_status ON hotel_bookings(check_out_date, status)'],
            ['idx_act_created', 'CREATE INDEX idx_act_created ON activity_logs(created_at)'],
            ['idx_act_entity', 'CREATE INDEX idx_act_entity ON activity_logs(entity_type, entity_id)'],
          ];

          const missingQueries = desiredIndexes
            .filter(([name]) => !existingIndexes.has(name))
            .map(([, sql]) => conn.query(sql).catch(() => {}));

          if (missingQueries.length > 0) {
            await Promise.allSettled(missingQueries);
          }
        } catch {}

        // 3. Seed initial invoice settings & catalog in background if empty
        try {
          const [[invSetRows], [catCountRows], [seededRows], [myrMigRows]]: any = await Promise.all([
            conn.query('SELECT COUNT(*) as cnt FROM invoice_settings'),
            conn.query('SELECT COUNT(*) as cnt FROM invoice_catalog_items'),
            conn.query("SELECT setting_value FROM settings WHERE setting_key = 'invoice_catalog_seeded' LIMIT 1").catch(() => [[]]),
            conn.query("SELECT setting_value FROM settings WHERE setting_key = 'default_currency_myr_set' LIMIT 1").catch(() => [[]]),
          ]);

          // Ensure new signature columns exist on existing MySQL invoice_settings table and price_details on hotel_bookings
          await Promise.allSettled([
            conn.query("ALTER TABLE invoice_settings ADD COLUMN signature_enabled TINYINT(1) NOT NULL DEFAULT 1").catch(() => {}),
            conn.query("ALTER TABLE invoice_settings ADD COLUMN signature_name VARCHAR(150) DEFAULT 'Sarah Nadeem'").catch(() => {}),
            conn.query("ALTER TABLE invoice_settings ADD COLUMN signature_designation VARCHAR(150) DEFAULT 'Managing Director'").catch(() => {}),
            conn.query("ALTER TABLE invoice_settings ADD COLUMN signature_image_url LONGTEXT DEFAULT NULL").catch(() => {}),
            conn.query("ALTER TABLE invoice_settings ADD COLUMN signature_style VARCHAR(20) DEFAULT 'script'").catch(() => {}),
            conn.query("ALTER TABLE hotel_bookings ADD COLUMN price_details VARCHAR(500) DEFAULT NULL").catch(() => {}),
          ]);

          if (invSetRows && invSetRows[0] && Number(invSetRows[0].cnt) === 0) {
            const initSet = getInitialData().invoice_settings;
            await conn.query(
              `INSERT IGNORE INTO invoice_settings (
                id, company_name, company_tagline, logo_url, phone, whatsapp, email, website,
                address, tax_number, bank_details, payment_notes, terms_and_conditions,
                signature_enabled, signature_name, signature_designation, signature_image_url, signature_style,
                default_currency, invoice_prefix, next_number
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                1,
                initSet.company_name,
                initSet.company_tagline,
                initSet.logo_url,
                initSet.phone,
                initSet.whatsapp,
                initSet.email,
                initSet.website,
                initSet.address,
                initSet.tax_number,
                initSet.bank_details,
                initSet.payment_notes,
                initSet.terms_and_conditions,
                initSet.signature_enabled ?? 1,
                initSet.signature_name || 'Sarah Nadeem',
                initSet.signature_designation || 'Managing Director',
                initSet.signature_image_url || null,
                initSet.signature_style || 'script',
                initSet.default_currency,
                initSet.invoice_prefix,
                initSet.next_number,
              ]
            );
          }

          const alreadySeeded = Array.isArray(seededRows) && seededRows.length > 0;
          if (catCountRows && catCountRows[0] && Number(catCountRows[0].cnt) === 0 && !alreadySeeded) {
            const itemsToSeed =
              store && Array.isArray(store.invoice_catalog_items) && store.invoice_catalog_items.length > 0
                ? store.invoice_catalog_items
                : getInitialData().invoice_catalog_items;
            if (itemsToSeed.length > 0) {
              const values = itemsToSeed.map((it) => [
                it.id,
                it.name,
                it.description,
                Number(it.default_unit_price) || 0,
                it.category || 'Visa Services',
                it.is_active ?? 1,
                it.display_order || 0,
              ]);
              await conn.query(
                `INSERT IGNORE INTO invoice_catalog_items (id, name, description, default_unit_price, category, is_active, display_order) VALUES ?`,
                [values]
              );
            }
            await conn
              .query("INSERT INTO settings (setting_key, setting_value) VALUES ('invoice_catalog_seeded', '1') ON DUPLICATE KEY UPDATE setting_value = '1'")
              .catch(() => {});
          }

          if (!Array.isArray(myrMigRows) || myrMigRows.length === 0) {
            await Promise.allSettled([
              conn.query("UPDATE invoice_settings SET default_currency = 'MYR' WHERE default_currency = 'USD'"),
              conn.query("UPDATE invoices SET currency = 'MYR' WHERE currency = 'USD'"),
              conn.query("INSERT INTO settings (setting_key, setting_value) VALUES ('default_currency_myr_set', '1') ON DUPLICATE KEY UPDATE setting_value = '1'"),
            ]);
          }

          // One-time migration: Replace old hotels with the 9 Kuala Lumpur hotels & clear old rooms
          const [klMigRows]: any = await conn
            .query("SELECT setting_value FROM settings WHERE setting_key = 'kl_9_hotels_migrated_v1' LIMIT 1")
            .catch(() => [[]]);
          if (!Array.isArray(klMigRows) || klMigRows.length === 0) {
            const klHotels = getInitialData().hotels;
            await conn.query('SET FOREIGN_KEY_CHECKS = 0').catch(() => {});
            await conn.query('DELETE FROM hotel_rooms').catch(() => {});
            await conn.query('DELETE FROM hotels').catch(() => {});
            const hotelValues = klHotels.map((h) => [
              h.id,
              h.name,
              h.city,
              h.address,
              h.star_rating || 3,
              h.phone || null,
              h.email || null,
              h.notes || null,
              1,
            ]);
            await conn.query(
              `INSERT INTO hotels (id, name, city, address, star_rating, phone, email, notes, is_active) VALUES ?`,
              [hotelValues]
            );
            await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
            await conn
              .query("INSERT INTO settings (setting_key, setting_value) VALUES ('kl_9_hotels_migrated_v1', '1') ON DUPLICATE KEY UPDATE setting_value = '1'")
              .catch(() => {});
            store.hotels = klHotels;
            store.hotel_rooms = [];
            store.nextIds.hotels = 10;
            store.nextIds.hotel_rooms = 1;
            saveStore(store, true);
          }
        } catch (e: any) {
          console.warn('[MySQL] Initial seed check warning:', e.message);
        }

        schemaInitialized = true;
      }

      return true;
    } catch (err: any) {
      isConnectedToMySQL = false;
      connectionError = err?.message || String(err);
      console.warn(`[Database] MySQL connection probe failed (${connectionError}). Using fast local store.`);
      return false;
    } finally {
      if (conn) {
        try {
          conn.release();
        } catch {}
      }
      inFlightProbePromise = null;
    }
  })();

  const connected = await inFlightProbePromise;
  if (connected && !hasCompletedInitialSync) {
    await syncFromMySQL(true);
  }
  return connected;
}

// Initialize MySQL pool if host and user are configured
if (DB_HOST && DB_USER) {
  try {
    const configuredLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '8', 10);
    const safeConnectionLimit = Number.isFinite(configuredLimit) && configuredLimit >= 2 ? Math.min(configuredLimit, 20) : 8;

    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: safeConnectionLimit,
      maxIdle: Math.min(6, safeConnectionLimit),
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: true,
      connectTimeout: 10000,
      ssl: DB_SSL ? { rejectUnauthorized: false } : undefined,
    });

    (pool as any).on('error', (err: any) => {
      console.warn('[MySQL Pool Error]:', err?.message || err);
      if (isTransientMySQLError(err)) {
        isConnectedToMySQL = false;
        connectionError = err.message;
      }
    });

    // Periodic keep-alive heartbeat ping (every 45s)
    setInterval(async () => {
      if (pool && isConnectedToMySQL) {
        const t0 = Date.now();
        try {
          await pool.query({ sql: '/* keep-alive */ SELECT 1', timeout: 8000 });
          lastPingMs = Date.now() - t0;
        } catch (err: any) {
          console.warn('[MySQL KeepAlive] Ping failed, attempting probe:', err?.message || err);
          isConnectedToMySQL = false;
          void probeMySQLConnection(true);
        }
      } else if (pool && !isConnectedToMySQL) {
        void probeMySQLConnection(false);
      }
    }, 45000).unref();

    // Kick off initial startup connection + sync and track it so first API requests wait for real MySQL data
    initialSyncPromise = (async () => {
      try {
        const ok = await probeMySQLConnection(true);
        if (ok && !hasCompletedInitialSync) {
          await syncFromMySQL(true);
        }
      } catch (err: any) {
        console.warn('[Database] Initial MySQL sync warning:', err?.message || err);
      } finally {
        hasCompletedInitialSync = true;
      }
    })();
  } catch (err: any) {
    isConnectedToMySQL = false;
    hasCompletedInitialSync = true;
    connectionError = err.message;
    console.warn(`[Database] Failed to create MySQL pool (${err.message}). Using local store fallback.`);
  }
} else {
  hasCompletedInitialSync = true;
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
  price_details?: string | null;
  currency?: string;
  checkout_task_id?: number | null;
  created_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface FollowUp {
  id: number;
  client_id: number;
  title: string;
  reason: string;
  channel: 'WhatsApp' | 'Phone Call' | 'WeChat' | 'Email' | 'SMS';
  cadence: '1 Month' | '2 Months' | '3 Months' | '6 Months' | 'One-time';
  due_date: string;
  notes?: string | null;
  message_template?: string | null;
  status: 'Pending' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  task_id?: number | null;
  assigned_user_id?: number | null;
  completed_at?: string | null;
  completed_notes?: string | null;
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

interface InvoiceCatalogItem {
  id: number;
  name: string;
  description?: string | null;
  default_unit_price: number;
  category?: string | null;
  is_active: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface InvoiceItem {
  id: number;
  invoice_id: number;
  catalog_item_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  issue_date: string;
  due_date?: string | null;
  status: 'Pending' | 'Paid' | 'Partial' | 'Cancelled';
  payment_method?: 'Cash' | 'Bank Transfer' | 'Credit Card' | 'WeChat Pay' | 'Alipay' | 'Other' | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  notes?: string | null;
  created_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface InvoiceSettings {
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
  follow_ups: FollowUp[];
  settings: Setting[];
  invoice_settings: InvoiceSettings;
  invoice_catalog_items: InvoiceCatalogItem[];
  invoices: Invoice[];
  invoice_items: InvoiceItem[];
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
    clients: [],
    client_custom_field_values: [],
    visa_applications: [],
    application_status_history: [],
    tasks: [],
    comments: [],
    activity_logs: [],
    hotels: [
      {
        id: 1,
        name: 'Axon BukitBintang with pavilion by AQSA',
        city: 'Kuala Lumpur',
        address: 'Axon residence, 5 jalan walter granier, Bukit Bintang, Kuala Lumpur, Malaysia',
        star_rating: 3,
        phone: null,
        email: null,
        notes: 'Opened in 2026 · Rating 8.3 Very good ("Great location", "Clean and tidy"). Starting from RM 101/night. Highlights: Indoor rooftop pool, Free gym, Ideal location, Garden, Free Sauna, Private parking. 280m to Bukit Bintang Metro Station, 800m to Pavilion Kuala Lumpur, 1.8 km to Petronas Twin Towers.',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        name: 'Empire Bukit Bintang',
        city: 'Kuala Lumpur',
        address: 'Bukit Bintang, Kuala Lumpur, Malaysia (190m · Near Petronas Twin Towers)',
        star_rating: 3,
        phone: null,
        email: null,
        notes: 'Rating 9.1 Great (39 reviews) · Starting from RM 94/night (Total RM 203 for 2 nights incl. taxes & fees). 190m straight-line distance · Near Petronas Twin Towers. Free Cancellation & Excellent service.',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 3,
        name: 'Star Mews Hotel Changkat Bukit Bintang',
        city: 'Kuala Lumpur',
        address: 'Changkat Bukit Bintang, Kuala Lumpur, Malaysia (240m · Near Petronas Twin Towers)',
        star_rating: 3,
        phone: null,
        email: null,
        notes: 'Rating 8.1 Very good (55 reviews) · Starting from RM 109/night (Total RM 235 for 2 nights incl. taxes & fees). 240m straight-line distance · Near Petronas Twin Towers. Features on-site Bar.',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 4,
        name: 'Swing & Pillows @ ICC Pudu Kuala Lumpur',
        city: 'Kuala Lumpur',
        address: 'ICC Pudu, Kuala Lumpur, Malaysia (740m · Near Bukit Bintang Metro Station)',
        star_rating: 2,
        phone: null,
        email: null,
        notes: 'Rating 8.7 Very good (289 reviews) · Starting from RM 68/night (Total RM 148 for 2 nights incl. taxes & fees). 740m straight-line distance · Near Bukit Bintang Metro Station. Excellent service.',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 5,
        name: 'Kingston Hotel 4 @ Hulo Bukit Bintang',
        city: 'Kuala Lumpur',
        address: 'Hulo Bukit Bintang, Kuala Lumpur, Malaysia (810m · Near Zepp Kuala Lumpur)',
        star_rating: 3,
        phone: null,
        email: null,
        notes: 'Rating 8.4 Very good (440 reviews) · Starting from RM 70/night (Total RM 151 for 2 nights incl. taxes & fees). 810m straight-line distance · Near Zepp Kuala Lumpur. Ideal location.',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 6,
        name: 'Prescott Hotel Bukit Bintang',
        city: 'Kuala Lumpur',
        address: 'Bukit Bintang, Kuala Lumpur, Malaysia (610m · Near Bukit Bintang Metro Station)',
        star_rating: 3,
        phone: null,
        email: null,
        notes: 'Rating 8.3 Very good (1,429 reviews) · Starting from RM 78/night (Total RM 176 for 2 nights incl. taxes & fees). 610m straight-line distance · Near Bukit Bintang Metro Station. Features on-site Cafe.',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 7,
        name: 'Dynasty Hotel by ibilik @ Kuala Lumpur',
        city: 'Kuala Lumpur',
        address: 'Titiwangsa, Kuala Lumpur, Malaysia (3.6 km · Near Titiwangsa)',
        star_rating: 4,
        phone: null,
        email: null,
        notes: 'Rating 8.3 Very good (34 reviews) · Starting from RM 137/night (Total RM 296 for 2 nights incl. taxes & fees). 3.6 km straight-line distance · Near Titiwangsa. Ideal location.',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 8,
        name: 'SS Grey Hotel',
        city: 'Kuala Lumpur',
        address: 'Bukit Bintang, Kuala Lumpur, Malaysia (<100m · Near Petronas Twin Towers)',
        star_rating: 3,
        phone: null,
        email: null,
        notes: 'Rating 8.5 Very good (278 reviews) · Starting from RM 93/night (Total RM 201 for 2 nights incl. taxes & fees). <100m straight-line distance · Near Petronas Twin Towers. Ideal location.',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 9,
        name: 'Swing & Pillows @ Imbi Bukit Bintang',
        city: 'Kuala Lumpur',
        address: 'Imbi, Bukit Bintang, Kuala Lumpur, Malaysia (650m · Near Petronas Twin Towers)',
        star_rating: 2,
        phone: null,
        email: null,
        notes: 'Rating 8.7 Very good (195 reviews) · Starting from RM 69/night (Total RM 149 for 2 nights incl. taxes & fees). 650m straight-line distance · Near Petronas Twin Towers. Excellent service.',
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
    ],
    hotel_rooms: [],
    hotel_bookings: [],
    follow_ups: [],
    settings: [
      { id: 1, setting_key: 'agency_name', setting_value: 'SN Travels Agency', updated_at: now },
      { id: 2, setting_key: 'secret_login_enabled', setting_value: '1', updated_at: now },
      { id: 3, setting_key: 'secret_login_key', setting_value: 'sn-secure-staff-2026', updated_at: now },
      { id: 4, setting_key: 'kl_9_hotels_migrated_v1', setting_value: '1', updated_at: now },
    ],
    invoice_settings: {
      id: 1,
      company_name: 'SN Travels Agency',
      company_tagline: 'China Visa & Travel Processing Specialists',
      logo_url: 'https://lh3.googleusercontent.com/d/1wJCY1RJCq0hASsYGGRnScbXDOW9YdPsM',
      phone: '+971 4 399 2200',
      whatsapp: '+971 50 123 4567',
      email: 'visa@sn-travelsagency.com',
      website: 'sn-travelsagency.com',
      address: 'Office 402, Al Hudaiba Awards Building, 2nd December St, Dubai, UAE',
      tax_number: 'TRN-100482910400003',
      bank_details: 'Bank: Emirates NBD\nAccount Title: SN Travels Agency LLC\nIBAN: AE24 0260 0000 0000 1234 56\nSWIFT: ENBDDBAXXX',
      payment_notes: 'Please reference your Invoice number when transferring funds. Payment due upon presentation.',
      terms_and_conditions: '1. Embassy visa processing and biometric slots are subject to consular verification.\n2. Invoices must be cleared before document submission or passport delivery.\n3. Official receipt issued upon payment confirmation.',
      signature_enabled: 1,
      signature_name: 'Sarah Nadeem',
      signature_designation: 'Managing Director',
      signature_image_url: null,
      signature_style: 'script',
      default_currency: 'MYR',
      invoice_prefix: 'INV-2026-',
      next_number: 1004,
      updated_at: now,
    },
    invoice_catalog_items: [
      { id: 1, name: 'China Commercial Trade Visa (M) - 1 Year Multi-Entry', description: 'Includes documentation audit, PU invitation review, appointment scheduling, and consular VIP submission', default_unit_price: 350, category: 'Visa Services', is_active: 1, display_order: 1, created_at: now, updated_at: now },
      { id: 2, name: 'China Tourist Visa (L) Standard Processing', description: 'Tourist visa filing, itinerary validation, travel hotel verification, and consular courier dispatch', default_unit_price: 180, category: 'Visa Services', is_active: 1, display_order: 2, created_at: now, updated_at: now },
      { id: 3, name: 'Official Embassy Consular Visa Fee', description: 'Official government visa stamping charges (Non-refundable consular fee)', default_unit_price: 140, category: 'Government Fees', is_active: 1, display_order: 3, created_at: now, updated_at: now },
      { id: 4, name: 'Express Consular Priority VIP Handling', description: 'Next-day fast-track processing and priority consular submission lane', default_unit_price: 85, category: 'Express Services', is_active: 1, display_order: 4, created_at: now, updated_at: now },
      { id: 5, name: 'China Student Visa (X1/X2) Package', description: 'Full review of JW202/DQ form, university admission notice verification, and medical record check', default_unit_price: 220, category: 'Visa Services', is_active: 1, display_order: 5, created_at: now, updated_at: now },
      { id: 6, name: 'Hotel Reservation & Voucher Booking', description: 'Official confirmed hotel voucher for embassy submission and travel itinerary proof', default_unit_price: 60, category: 'Travel & Accommodation', is_active: 1, display_order: 6, created_at: now, updated_at: now },
      { id: 7, name: 'Document Legalization & Chinese Translation', description: 'Certified translation into Simplified Chinese by accredited legal translator', default_unit_price: 45, category: 'Document Services', is_active: 1, display_order: 7, created_at: now, updated_at: now },
      { id: 8, name: 'Secure Passport Return Courier Delivery', description: 'Insured premium diplomatic courier return delivery to client doorstep', default_unit_price: 25, category: 'Logistics', is_active: 1, display_order: 8, created_at: now, updated_at: now },
    ],
    invoices: [
      {
        id: 1,
        invoice_number: 'INV-2026-1001',
        client_id: 1,
        issue_date: yesterday,
        due_date: tomorrow,
        status: 'Paid',
        payment_method: 'Bank Transfer',
        currency: 'MYR',
        subtotal: 490,
        discount: 0,
        tax_rate: 5,
        tax_amount: 24.5,
        total_amount: 514.5,
        paid_amount: 514.5,
        balance_due: 0,
        notes: 'Client paid in full via Emirates NBD transfer.',
        created_by_user_id: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        invoice_number: 'INV-2026-1002',
        client_id: 2,
        issue_date: today,
        due_date: inTwoDays,
        status: 'Partial',
        payment_method: 'Credit Card',
        currency: 'MYR',
        subtotal: 240,
        discount: 0,
        tax_rate: 5,
        tax_amount: 12,
        total_amount: 252,
        paid_amount: 150,
        balance_due: 102,
        notes: 'Initial deposit received. Balance due upon passport collection.',
        created_by_user_id: 2,
        created_at: now,
        updated_at: now,
      },
      {
        id: 3,
        invoice_number: 'INV-2026-1003',
        client_id: 3,
        issue_date: today,
        due_date: tomorrow,
        status: 'Pending',
        payment_method: 'Bank Transfer',
        currency: 'MYR',
        subtotal: 380,
        discount: 20,
        tax_rate: 5,
        tax_amount: 18,
        total_amount: 378,
        paid_amount: 0,
        balance_due: 378,
        notes: 'F visa processing and express translation package. Invoice emailed to client.',
        created_by_user_id: 1,
        created_at: now,
        updated_at: now,
      },
    ],
    invoice_items: [
      { id: 1, invoice_id: 1, catalog_item_id: 1, description: 'China Commercial Trade Visa (M) - 1 Year Multi-Entry', quantity: 1, unit_price: 350, total: 350 },
      { id: 2, invoice_id: 1, catalog_item_id: 3, description: 'Official Embassy Consular Visa Fee', quantity: 1, unit_price: 140, total: 140 },
      { id: 3, invoice_id: 2, catalog_item_id: 2, description: 'China Tourist Visa (L) Standard Processing', quantity: 1, unit_price: 180, total: 180 },
      { id: 4, invoice_id: 2, catalog_item_id: 6, description: 'Hotel Reservation & Voucher Booking', quantity: 1, unit_price: 60, total: 60 },
      { id: 5, invoice_id: 3, catalog_item_id: 5, description: 'China Student Visa (X1/X2) Package', quantity: 1, unit_price: 220, total: 220 },
      { id: 6, invoice_id: 3, catalog_item_id: 3, description: 'Official Embassy Consular Visa Fee', quantity: 1, unit_price: 140, total: 140 },
      { id: 7, invoice_id: 3, catalog_item_id: 8, description: 'Secure Passport Return Courier Delivery', quantity: 1, unit_price: 20, total: 20 },
    ],
    nextIds: {
      users: 4,
      countries: 21,
      clients: 1,
      client_custom_fields: 7,
      client_custom_field_values: 1,
      visa_types: 8,
      visa_applications: 1,
      application_status_history: 1,
      tasks: 1,
      comments: 1,
      activity_logs: 1,
      hotels: 10,
      hotel_rooms: 1,
      hotel_bookings: 1,
      follow_ups: 1,
      settings: 5,
      invoice_catalog_items: 9,
      invoices: 4,
      invoice_items: 8,
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
      if (!parsed.follow_ups) {
        parsed.follow_ups = [];
        parsed.nextIds = parsed.nextIds || {};
        parsed.nextIds.follow_ups = 1;
        needsSave = true;
      }
      if (!parsed.settings || parsed.settings.length === 0) {
        const init = getInitialData();
        parsed.settings = init.settings;
        parsed.nextIds = parsed.nextIds || {};
        parsed.nextIds.settings = init.nextIds.settings;
        needsSave = true;
      }
      if (!parsed.invoice_settings) {
        parsed.invoice_settings = getInitialData().invoice_settings;
        needsSave = true;
      } else {
        if (
          !parsed.invoice_settings.logo_url ||
          parsed.invoice_settings.logo_url.includes('photo-1569154941061')
        ) {
          parsed.invoice_settings.logo_url = 'https://lh3.googleusercontent.com/d/1wJCY1RJCq0hASsYGGRnScbXDOW9YdPsM';
          needsSave = true;
        }
        if (parsed.invoice_settings.signature_enabled === undefined) {
          parsed.invoice_settings.signature_enabled = 1;
          parsed.invoice_settings.signature_name = parsed.invoice_settings.signature_name || 'Sarah Nadeem';
          parsed.invoice_settings.signature_designation = parsed.invoice_settings.signature_designation || 'Managing Director';
          parsed.invoice_settings.signature_style = parsed.invoice_settings.signature_style || 'script';
          needsSave = true;
        }
      }
      if (!parsed.invoice_catalog_items || parsed.invoice_catalog_items.length === 0) {
        parsed.invoice_catalog_items = getInitialData().invoice_catalog_items;
        parsed.nextIds = parsed.nextIds || {};
        parsed.nextIds.invoice_catalog_items = 9;
        needsSave = true;
      }
      if (!parsed.invoices) {
        parsed.invoices = getInitialData().invoices;
        parsed.invoice_items = getInitialData().invoice_items;
        parsed.nextIds = parsed.nextIds || {};
        parsed.nextIds.invoices = 4;
        parsed.nextIds.invoice_items = 8;
        needsSave = true;
      }
      const hasMyrMigration = (parsed.settings || []).some((s: any) => s.setting_key === 'default_currency_myr_set');
      if (!hasMyrMigration) {
        if (parsed.invoice_settings && parsed.invoice_settings.default_currency === 'USD') {
          parsed.invoice_settings.default_currency = 'MYR';
        }
        if (Array.isArray(parsed.invoices)) {
          parsed.invoices.forEach((inv: any) => {
            if (inv.currency === 'USD') inv.currency = 'MYR';
          });
        }
        parsed.settings = parsed.settings || [];
        parsed.nextIds = parsed.nextIds || {};
        parsed.settings.push({
          id: (parsed.nextIds.settings = (parsed.nextIds.settings || 10) + 1),
          setting_key: 'default_currency_myr_set',
          setting_value: '1',
          updated_at: new Date().toISOString(),
        });
        needsSave = true;
      }
      const hasKlHotelsMigration = (parsed.settings || []).some((s: any) => s.setting_key === 'kl_9_hotels_migrated_v1');
      if (!hasKlHotelsMigration) {
        const init = getInitialData();
        parsed.hotels = init.hotels;
        parsed.hotel_rooms = [];
        parsed.nextIds = parsed.nextIds || {};
        parsed.nextIds.hotels = 10;
        parsed.nextIds.hotel_rooms = 1;
        parsed.settings = parsed.settings || [];
        parsed.settings.push({
          id: (parsed.nextIds.settings = (parsed.nextIds.settings || 10) + 1),
          setting_key: 'kl_9_hotels_migrated_v1',
          setting_value: '1',
          updated_at: new Date().toISOString(),
        });
        needsSave = true;
      }
      if (needsSave) {
        saveStore(parsed, true);
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

let saveStoreTimer: ReturnType<typeof setTimeout> | null = null;
let saveStoreInFlight = false;
let saveStorePendingData: StoreData | null = null;
let dataVersion = 1;

async function flushStoreToDisk(dataToSave: StoreData) {
  if (saveStoreInFlight) {
    saveStorePendingData = dataToSave;
    return;
  }
  saveStoreInFlight = true;
  let currentData: StoreData | null = dataToSave;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    while (currentData) {
      const payload = JSON.stringify(currentData);
      currentData = null;
      await fs.promises.writeFile(DATA_FILE, payload, 'utf-8');
      if (saveStorePendingData) {
        currentData = saveStorePendingData;
        saveStorePendingData = null;
      }
    }
  } catch (err) {
    console.error('[Database] Failed to async write store file:', err);
  } finally {
    saveStoreInFlight = false;
  }
}

function saveStore(dataToSave: StoreData, immediate = false) {
  dataVersion += 1;
  if (immediate) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave), 'utf-8');
    } catch (err) {
      console.error('[Database] Failed to write store file:', err);
    }
    return;
  }

  // Coalesce frequent writes into a single non-blocking async disk flush without ever dropping a write
  if (saveStoreTimer) {
    clearTimeout(saveStoreTimer);
  }
  saveStoreTimer = setTimeout(() => {
    saveStoreTimer = null;
    void flushStoreToDisk(dataToSave);
  }, 150);
}

store = loadStore();

function nextEntityId(tableKey: keyof StoreData['nextIds'], rows?: Array<{ id?: number }>): number {
  const maxExisting = Array.isArray(rows)
    ? rows.reduce((m, r) => Math.max(m, Number(r?.id) || 0), 0)
    : 0;
  const currentNext = Number(store.nextIds[tableKey]) || 1;
  const id = Math.max(currentNext, maxExisting + 1);
  store.nextIds[tableKey] = id + 1;
  return id;
}

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

    // 4. Delete hotel bookings, follow-ups, and invoices linked to client
    try {
      await pool.query('DELETE FROM hotel_bookings WHERE client_id = ?', [id]);
    } catch (e: any) {
      console.warn('[MySQL] Could not delete hotel_bookings:', e.message);
    }
    try {
      await pool.query('DELETE FROM follow_ups WHERE client_id = ?', [id]);
    } catch (e: any) {
      console.warn('[MySQL] Could not delete follow_ups:', e.message);
    }
    try {
      const [invRows]: any = await pool.query('SELECT id FROM invoices WHERE client_id = ?', [id]);
      if (Array.isArray(invRows) && invRows.length > 0) {
        const invIds = invRows.map((r: any) => r.id);
        await pool.query('DELETE FROM invoice_items WHERE invoice_id IN (?)', [invIds]);
      }
      await pool.query('DELETE FROM invoices WHERE client_id = ?', [id]);
    } catch (e: any) {
      console.warn('[MySQL] Could not delete client invoices:', e.message);
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

let lastSyncTime = 0;
let lastLocalMutationTime = 0;
const SYNC_CACHE_TTL_MS = 60000; // 60 seconds TTL for routine background MySQL syncs
let inFlightSyncPromise: Promise<void> | null = null;
const pendingWritePromises = new Set<Promise<any>>();
let writePipelineChain: Promise<any> = Promise.resolve();
let lastUpcomingCleanupVersion = -1;

function computeStoreFingerprint(s: StoreData): string {
  const latest = (arr?: any[]) => {
    if (!Array.isArray(arr) || arr.length === 0) return '0';
    const first = arr[0];
    const last = arr[arr.length - 1];
    return `${arr.length}:${first?.id ?? ''}:${first?.updated_at ?? ''}:${last?.id ?? ''}:${last?.updated_at ?? ''}`;
  };
  return [
    latest(s.users),
    latest(s.clients),
    latest(s.visa_applications),
    latest(s.tasks),
    latest(s.hotels),
    latest(s.hotel_bookings),
    latest(s.follow_ups),
    latest(s.invoices),
    latest(s.invoice_items),
    latest(s.comments),
    latest(s.settings),
  ].join('|');
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIdx = 0;
  const worker = async () => {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]();
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function ensureClientAndAppInMySQL(
  activePool: mysql.Pool,
  clientId?: number | null,
  applicationId?: number | null
): Promise<{ validClientId: number | null; validAppId: number | null }> {
  let resolvedClientId = clientId ? Number(clientId) : null;
  const resolvedAppId = applicationId ? Number(applicationId) : null;

  const app = resolvedAppId ? store.visa_applications.find(a => Number(a.id) === resolvedAppId) : null;
  if (app && !resolvedClientId) {
    resolvedClientId = Number(app.client_id);
  }

  if (resolvedClientId) {
    const client = store.clients.find(c => Number(c.id) === resolvedClientId);
    if (client) {
      await activePool.query(
        `INSERT INTO clients (id, client_id, full_name, passport_number, country, phone, whatsapp, email, date_of_birth, address, occupation, notes, google_drive_url, photo_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name), passport_number = VALUES(passport_number), updated_at = NOW()`,
        [
          client.id,
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
        ]
      );
    }
  }

  if (resolvedAppId) {
    if (app) {
      const vt = store.visa_types.find(v => Number(v.id) === Number(app.visa_type_id));
      if (vt) {
        await activePool.query(
          `INSERT INTO visa_types (id, name, description, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE name = VALUES(name)`,
          [vt.id, vt.name, vt.description, vt.is_active]
        );
      }
      const validAssignedUserId = app.assigned_user_id && store.users.some(u => u.id === app.assigned_user_id)
        ? app.assigned_user_id
        : null;
      await activePool.query(
        `INSERT INTO visa_applications (id, application_id, client_id, visa_type_id, status, delivery_date, notes, assigned_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           status = VALUES(status), delivery_date = VALUES(delivery_date),
           notes = VALUES(notes), assigned_user_id = VALUES(assigned_user_id), updated_at = NOW()`,
        [
          app.id,
          app.application_id,
          app.client_id,
          app.visa_type_id,
          app.status,
          app.delivery_date,
          app.notes,
          validAssignedUserId,
        ]
      );
      return { validClientId: resolvedClientId, validAppId: app.id };
    } else {
      const [rows] = await activePool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM visa_applications WHERE id = ? LIMIT 1',
        [resolvedAppId]
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        return { validClientId: resolvedClientId, validAppId: null };
      }
    }
  }

  return { validClientId: resolvedClientId, validAppId: resolvedAppId };
}

/**
 * Executes a MySQL write operation in a serialized non-blocking write-through pipeline.
 * Automatically reconnects and retries once on transient connection drops so writes are never silently lost.
 */
function runMySQLWrite(task: (activePool: mysql.Pool) => Promise<any>): void {
  lastLocalMutationTime = Date.now();
  if (!pool) return;
  const activePool = pool;
  const p = writePipelineChain.then(async () => {
    try {
      if (!isConnectedToMySQL) {
        const reconnected = await probeMySQLConnection(true);
        if (!reconnected) return;
      }
      await task(activePool);
      isConnectedToMySQL = true;
      connectionError = null;
    } catch (err: any) {
      if (isTransientMySQLError(err)) {
        console.warn('[MySQL Write Pipeline] Transient error, reconnecting & retrying once:', err?.message || err);
        isConnectedToMySQL = false;
        connectionError = err?.message || String(err);
        try {
          const reconnected = await probeMySQLConnection(true);
          if (reconnected) {
            await task(activePool);
            isConnectedToMySQL = true;
            connectionError = null;
            return;
          }
        } catch (retryErr: any) {
          console.error('[MySQL Write Pipeline Retry Failed]:', retryErr?.message || retryErr);
          return;
        }
      }
      console.error('[MySQL Write Pipeline Error]:', err?.message || err);
    }
  });
  writePipelineChain = p;
  pendingWritePromises.add(p);
  p.finally(() => {
    pendingWritePromises.delete(p);
  });
}

async function syncFromMySQL(force = false): Promise<void> {
  if (!pool) return;
  if (!isConnectedToMySQL) {
    const connected = await probeMySQLConnection(force);
    if (!connected) return;
  }

  const now = Date.now();
  if (!force && hasCompletedInitialSync && (now - lastSyncTime < SYNC_CACHE_TTL_MS)) {
    return; // Serve cached in-memory store immediately
  }

  // Wait for any in-flight write-through queries to complete before reading from MySQL
  if (pendingWritePromises.size > 0) {
    await Promise.allSettled(Array.from(pendingWritePromises));
  }

  // Avoid clobbering very recent local mutations with a non-forced background sync
  if (!force && (Date.now() - lastLocalMutationTime < 5000)) {
    return;
  }

  if (inFlightSyncPromise) {
    return inFlightSyncPromise;
  }

  inFlightSyncPromise = (async () => {
    const syncStart = Date.now();
    const beforeFingerprint = computeStoreFingerprint(store);
    let failedQueries = 0;

    const safeQuery = async (sql: string) => {
      try {
        const queryPromise = pool!.query({ sql, timeout: 12000 });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Query timed out after 12s: ${sql.slice(0, 60)}`)), 12500)
        );
        const [rows]: any = await Promise.race([queryPromise, timeoutPromise]);
        return rows;
      } catch (err: any) {
        failedQueries += 1;
        if (isTransientMySQLError(err)) {
          isConnectedToMySQL = false;
          connectionError = err?.message || String(err);
        }
        console.warn(`[MySQL Table Sync Warning] (${sql}):`, err?.message || err);
        return null;
      }
    };

    try {
      const queries = [
        'SELECT * FROM users',
        'SELECT * FROM countries ORDER BY display_order ASC, name ASC',
        'SELECT * FROM clients ORDER BY id DESC',
        'SELECT * FROM client_custom_fields ORDER BY display_order ASC',
        'SELECT * FROM client_custom_field_values',
        'SELECT * FROM visa_types',
        'SELECT * FROM visa_applications',
        'SELECT * FROM application_status_history',
        'SELECT * FROM tasks',
        'SELECT * FROM comments',
        'SELECT * FROM activity_logs ORDER BY id DESC LIMIT 300',
        'SELECT * FROM hotels',
        'SELECT * FROM hotel_rooms',
        'SELECT * FROM hotel_bookings',
        'SELECT * FROM settings',
        'SELECT * FROM follow_ups',
        'SELECT * FROM invoice_settings LIMIT 1',
        'SELECT * FROM invoice_catalog_items ORDER BY display_order ASC, id ASC',
        'SELECT * FROM invoices ORDER BY id DESC',
        'SELECT * FROM invoice_items',
      ];

      // Run in controlled batches of 4 concurrent queries to avoid exhausting shared MySQL max_user_connections
      const [u, c, cl, cf, cfv, vt, va, ash, t, cm, al, h, hr, hb, s, fu, invS, invCat, inv, invItems] =
        await runWithConcurrency(
          queries.map((sql) => () => safeQuery(sql)),
          4
        );

      // If every core query failed, keep existing in-memory store intact
      if (failedQueries === queries.length) {
        return;
      }

      isConnectedToMySQL = true;
      connectionError = null;

      // If a local write occurred while the SELECT queries were in flight, abort overwriting memory unless forced
      if (!force && lastLocalMutationTime > syncStart) {
        return;
      }

      if (Array.isArray(u) && u.length > 0) store.users = u;
      if (Array.isArray(c) && c.length > 0) store.countries = c;
      if (Array.isArray(cl)) {
        const extractSerial = (c: any): number => {
          const raw = String(c.client_id || '').trim();
          if (/^\d+$/.test(raw)) return parseInt(raw, 10);
          const m = raw.match(/\d+/g);
          if (m && m.length > 0) {
            const n = parseInt(m[m.length - 1], 10);
            if (!isNaN(n)) return n;
          }
          return Number(c.id) || 0;
        };
        store.clients = cl
          .map((item: any) => ({
            ...item,
            date_of_birth: item.date_of_birth ? String(item.date_of_birth).slice(0, 10) : null,
          }))
          .sort((a: any, b: any) => extractSerial(b) - extractSerial(a) || Number(b.id) - Number(a.id));
      }
      if (Array.isArray(cf) && cf.length > 0) store.client_custom_fields = cf;
      if (Array.isArray(cfv)) store.client_custom_field_values = cfv;
      if (Array.isArray(vt) && vt.length > 0) store.visa_types = vt;
      if (Array.isArray(va)) {
        store.visa_applications = va.map((item: any) => ({
          ...item,
          delivery_date: item.delivery_date ? String(item.delivery_date).slice(0, 10) : null,
        }));
      }
      if (Array.isArray(ash)) store.application_status_history = ash;
      if (Array.isArray(t)) {
        store.tasks = t.map((item: any) => ({
          ...item,
          due_date: item.due_date ? String(item.due_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        }));
      }
      if (Array.isArray(cm)) store.comments = cm;
      if (Array.isArray(al)) store.activity_logs = al;
      if (Array.isArray(h) && h.length > 0) store.hotels = h;
      if (Array.isArray(hr)) store.hotel_rooms = hr;
      if (Array.isArray(hb)) {
        store.hotel_bookings = hb.map((item: any) => ({
          ...item,
          check_in_date: item.check_in_date ? String(item.check_in_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
          check_out_date: item.check_out_date ? String(item.check_out_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        }));
      }
      if (Array.isArray(fu)) {
        store.follow_ups = fu.map((item: any) => ({
          ...item,
          due_date: item.due_date ? String(item.due_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        }));
      }
      if (Array.isArray(s) && s.length > 0) store.settings = s;

      if (Array.isArray(invS) && invS.length > 0) {
        store.invoice_settings = {
          ...store.invoice_settings,
          ...invS[0],
          signature_enabled: invS[0].signature_enabled !== undefined ? Number(invS[0].signature_enabled) : (store.invoice_settings?.signature_enabled ?? 1),
          signature_name: invS[0].signature_name ?? store.invoice_settings?.signature_name ?? 'Sarah Nadeem',
          signature_designation: invS[0].signature_designation ?? store.invoice_settings?.signature_designation ?? 'Managing Director',
          signature_image_url: invS[0].signature_image_url ?? store.invoice_settings?.signature_image_url ?? null,
          signature_style: invS[0].signature_style || store.invoice_settings?.signature_style || 'script',
          next_number: Number(invS[0].next_number) || 1001,
        };
      }
      if (Array.isArray(invCat)) {
        store.invoice_catalog_items = invCat.map((item: any) => ({
          ...item,
          default_unit_price: Number(item.default_unit_price) || 0,
          is_active: Number(item.is_active ?? 1),
          display_order: Number(item.display_order) || 0,
        }));
      }
      if (Array.isArray(inv)) {
        store.invoices = inv.map((item: any) => ({
          ...item,
          issue_date: item.issue_date ? String(item.issue_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
          due_date: item.due_date ? String(item.due_date).slice(0, 10) : null,
          subtotal: Number(item.subtotal) || 0,
          discount: Number(item.discount) || 0,
          tax_rate: Number(item.tax_rate) || 0,
          tax_amount: Number(item.tax_amount) || 0,
          total_amount: Number(item.total_amount) || 0,
          paid_amount: Number(item.paid_amount) || 0,
          balance_due: Number(item.balance_due) || 0,
        }));
      }
      if (Array.isArray(invItems)) {
        store.invoice_items = invItems.map((item: any) => ({
          ...item,
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          total: Number(item.total) || 0,
        }));
      }

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
        follow_ups: Math.max(...(store.follow_ups || []).map(x => x.id), 0) + 1,
        settings: Math.max(...(store.settings || []).map(x => x.id), 0) + 1,
        invoice_catalog_items: Math.max(...(store.invoice_catalog_items || []).map(x => x.id), 0) + 1,
        invoices: Math.max(...(store.invoices || []).map(x => x.id), 0) + 1,
        invoice_items: Math.max(...(store.invoice_items || []).map(x => x.id), 0) + 1,
      };

      const wasInitial = !hasCompletedInitialSync;
      hasCompletedInitialSync = true;
      lastSyncTime = Date.now();
      const afterFingerprint = computeStoreFingerprint(store);

      // Only persist, bump dataVersion, and notify clients when data actually changed (or on first sync / forced sync)
      if (wasInitial || force || afterFingerprint !== beforeFingerprint) {
        saveStore(store);
        syncCompletedListeners.forEach((listener) => {
          try {
            listener();
          } catch {}
        });
      }
    } catch (err: any) {
      console.warn('[Database] Sync from MySQL encountered an issue:', err.message);
    } finally {
      inFlightSyncPromise = null;
    }
  })();
  return inFlightSyncPromise;
}

// --------------------------------------------------------------------------
// Database Interface Service
// --------------------------------------------------------------------------
export const dbService = {
  getDataVersion(): number {
    return dataVersion;
  },

  /**
   * Registers a callback fired whenever a MySQL sync pulls updated data so
   * API caches can be invalidated and connected browsers refreshed via SSE.
   */
  onSyncCompleted(listener: () => void): () => void {
    syncCompletedListeners.add(listener);
    return () => syncCompletedListeners.delete(listener);
  },

  /**
   * Awaits the initial startup MySQL sync (with a bounded timeout) so the first
   * API requests after a cold boot never return empty/stale seed data.
   */
  async waitForInitialSync(timeoutMs = 8000): Promise<void> {
    if (hasCompletedInitialSync || !initialSyncPromise) return;
    await Promise.race([
      initialSyncPromise,
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  },

  /**
   * Triggers a non-blocking stale-while-revalidate MySQL sync in the background
   * so HTTP API requests return in <1ms from memory without waiting on network I/O.
   */
  triggerBackgroundSync() {
    if (!pool || !hasCompletedInitialSync) return;
    const now = Date.now();
    if (now - lastSyncTime >= SYNC_CACHE_TTL_MS && !inFlightSyncPromise) {
      void syncFromMySQL(false).catch(() => {});
    }
  },

  async syncFromMySQL(force = false) {
    if (force) {
      await syncFromMySQL(true);
    } else {
      this.triggerBackgroundSync();
    }
    return this.getStatus();
  },

  getStatus() {
    return {
      connected_to_mysql: isConnectedToMySQL,
      host: DB_HOST || 'Not Configured (Using Active Relational Store)',
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER || 'Not Configured',
      connection_error: connectionError,
      ping_ms: lastPingMs,
      engine: isConnectedToMySQL ? 'MySQL 8.x / MariaDB (Write-Through Cached)' : 'Embedded Relational (phpMyAdmin Schema Ready)',
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
    const id = nextEntityId('users', store.users);
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

    runMySQLWrite(async (activePool) => {
      const [res]: any = await activePool.query(
        `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), password_hash = VALUES(password_hash), role = VALUES(role), is_active = VALUES(is_active), updated_at = NOW()`,
        [user.id, user.name, user.email, user.password_hash, user.role, user.is_active]
      );
      if (res && res.insertId && res.insertId !== user.id) {
        user.id = res.insertId;
        store.nextIds.users = Math.max(store.nextIds.users, user.id + 1);
      }
    });

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

    saveStore(store);

    runMySQLWrite(async (activePool) => {
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
        await activePool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
    });

    this.logActivity(updaterId, 'UPDATE_USER', 'USER', id, `Updated user account: ${user.name}`);
    return user;
  },

  updateUserLastLogin(id: number) {
    const user = store.users.find(u => u.id === id);
    if (user) {
      user.last_login_at = new Date().toISOString();
      saveStore(store);
    }
    runMySQLWrite(async (activePool) => {
      await activePool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
    });
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

    runMySQLWrite(async (activePool) => {
      await activePool.query('DELETE FROM users WHERE id = ?', [id]);
    });

    this.logActivity(operatorId, 'DELETE_USER', 'USER', id, `Deleted user account: ${deleted.name} (${deleted.email})`);
    return true;
  },

  // Clients
  getClients(search?: string, country?: string) {
    const extractSerial = (c: Client): number => {
      const raw = String(c.client_id || '').trim();
      if (/^\d+$/.test(raw)) return parseInt(raw, 10);
      const m = raw.match(/\d+/g);
      if (m && m.length > 0) {
        const n = parseInt(m[m.length - 1], 10);
        if (!isNaN(n)) return n;
      }
      return Number(c.id) || 0;
    };
    let list = [...store.clients].sort(
      (a, b) => extractSerial(b) - extractSerial(a) || Number(b.id) - Number(a.id)
    );
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
      const cLower = country.toLowerCase();
      list = list.filter(c => c.country.toLowerCase() === cLower);
    }

    // Pre-index visa types, applications, and pending tasks by client_id in O(N) time
    const visaTypeMap = new Map<number, string>();
    for (const vt of store.visa_types) {
      visaTypeMap.set(vt.id, vt.name);
    }

    const appCountByClient = new Map<number, number>();
    const latestActiveAppByClient = new Map<number, VisaApplication>();
    for (const app of store.visa_applications) {
      appCountByClient.set(app.client_id, (appCountByClient.get(app.client_id) || 0) + 1);
      if (app.status !== 'Returned') {
        const existing = latestActiveAppByClient.get(app.client_id);
        if (!existing || app.id >= existing.id) {
          latestActiveAppByClient.set(app.client_id, app);
        }
      }
    }

    this.cleanupStaleUpcomingTasks();

    const nextTaskByClient = new Map<number, Task>();
    for (const t of store.tasks) {
      if (t.client_id && t.status === 'Pending') {
        const cur = nextTaskByClient.get(t.client_id);
        if (!cur || t.due_date < cur.due_date) {
          nextTaskByClient.set(t.client_id, t);
        }
      }
    }

    return list.map(client => {
      const activeApp = latestActiveAppByClient.get(client.id) || null;
      const nextTask = nextTaskByClient.get(client.id) || null;

      return {
        ...client,
        application_count: appCountByClient.get(client.id) || 0,
        active_application: activeApp ? {
          id: activeApp.id,
          application_id: activeApp.application_id,
          status: activeApp.status,
          visa_type: visaTypeMap.get(activeApp.visa_type_id) || null,
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

    const userById = new Map<number, User>();
    for (const u of store.users) userById.set(u.id, u);

    const vtById = new Map<number, VisaType>();
    for (const vt of store.visa_types) vtById.set(vt.id, vt);

    const cfById = new Map<number, CustomField>();
    for (const cf of store.client_custom_fields) cfById.set(cf.id, cf);

    // Custom field values
    const customValues = store.client_custom_field_values
      .filter(v => v.client_id === client.id)
      .map(v => {
        const field = cfById.get(v.field_id);
        return {
          field_id: v.field_id,
          field_name: field?.field_name || '',
          field_label: field?.field_label || '',
          field_type: field?.field_type || 'text',
          field_value: v.field_value,
        };
      });

    // Applications with visa type details
    const appIdsSet = new Set<number>();
    const applications = store.visa_applications
      .filter(a => a.client_id === client.id)
      .map(a => {
        appIdsSet.add(a.id);
        const vt = vtById.get(a.visa_type_id);
        const assigned = a.assigned_user_id ? userById.get(a.assigned_user_id) : null;
        return {
          ...a,
          visa_type_name: vt?.name || 'Unknown',
          assigned_user_name: assigned?.name || null,
        };
      });

    this.cleanupStaleUpcomingTasks();

    // Tasks
    const tasks = store.tasks
      .filter(t => t.client_id === client.id)
      .map(t => {
        const assigned = t.assigned_user_id ? userById.get(t.assigned_user_id) : null;
        return {
          ...t,
          assigned_user_name: assigned?.name || null,
        };
      });

    // Comments
    const comments = store.comments
      .filter(c => c.client_id === client.id)
      .map(c => {
        const author = userById.get(c.user_id);
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
                   (l.entity_type === 'APPLICATION' && l.entity_id !== null && appIdsSet.has(l.entity_id)))
      .map(l => {
        const author = l.user_id ? userById.get(l.user_id) : null;
        return {
          ...l,
          user_name: author?.name || 'System',
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Hotel Bookings for this client
    const hotelBookings = this.getHotelBookings({ clientId: client.id });

    // Follow-ups for this client
    const followUps = this.getFollowUps({ clientId: client.id });

    // Invoices for this client
    const invoices = this.getInvoices({ clientId: client.id });

    return {
      ...client,
      custom_values: customValues,
      applications,
      tasks,
      hotel_bookings: hotelBookings,
      follow_ups: followUps,
      invoices,
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
    const id = nextEntityId('clients', store.clients);

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
    const bulkCustomValues: Array<[number, number, string]> = [];
    if (data.custom_fields) {
      for (const [fieldIdStr, val] of Object.entries(data.custom_fields)) {
        const fieldId = parseInt(fieldIdStr, 10);
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          store.client_custom_field_values.push({
            id: nextEntityId('client_custom_field_values', store.client_custom_field_values),
            client_id: id,
            field_id: fieldId,
            field_value: String(val),
            created_at: now,
          });
          bulkCustomValues.push([id, fieldId, String(val)]);
        }
      }
    }

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO clients (id, client_id, full_name, passport_number, country, phone, whatsapp, email, date_of_birth, address, occupation, notes, google_drive_url, photo_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           client_id = VALUES(client_id), full_name = VALUES(full_name), passport_number = VALUES(passport_number),
           country = VALUES(country), phone = VALUES(phone), whatsapp = VALUES(whatsapp), email = VALUES(email),
           date_of_birth = VALUES(date_of_birth), address = VALUES(address), occupation = VALUES(occupation),
           notes = VALUES(notes), google_drive_url = VALUES(google_drive_url), photo_url = VALUES(photo_url), updated_at = NOW()`,
        [
          client.id,
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
        ]
      );

      if (bulkCustomValues.length > 0) {
        const placeholders = bulkCustomValues.map(() => '(?, ?, ?, NOW(), NOW())').join(', ');
        const flatParams = bulkCustomValues.flat();
        await activePool.query(
          `INSERT INTO client_custom_field_values (client_id, field_id, field_value, created_at, updated_at)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE field_value = VALUES(field_value), updated_at = NOW()`,
          flatParams
        );
      }
    });

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

    const upsertRows: Array<[number, number, string]> = [];
    const deleteFieldIds: number[] = [];
    if (data.custom_fields) {
      for (const [fieldIdStr, val] of Object.entries(data.custom_fields)) {
        const fieldId = parseInt(fieldIdStr, 10);
        const existing = store.client_custom_field_values.find(v => v.client_id === id && v.field_id === fieldId);
        if (existing) {
          existing.field_value = String(val);
        } else if (val !== undefined && val !== null && String(val).trim() !== '') {
          store.client_custom_field_values.push({
            id: nextEntityId('client_custom_field_values', store.client_custom_field_values),
            client_id: id,
            field_id: fieldId,
            field_value: String(val),
            created_at: new Date().toISOString(),
          });
        }

        if (val !== undefined && val !== null && String(val).trim() !== '') {
          upsertRows.push([id, fieldId, String(val)]);
        } else {
          deleteFieldIds.push(fieldId);
        }
      }
    }

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
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

      if (upsertRows.length > 0) {
        const placeholders = upsertRows.map(() => '(?, ?, ?, NOW(), NOW())').join(', ');
        const flatParams = upsertRows.flat();
        await activePool.query(
          `INSERT INTO client_custom_field_values (client_id, field_id, field_value, created_at, updated_at)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE field_value = VALUES(field_value), updated_at = NOW()`,
          flatParams
        );
      }
      if (deleteFieldIds.length > 0) {
        await activePool.query(
          `DELETE FROM client_custom_field_values WHERE client_id = ? AND field_id IN (${deleteFieldIds.map(() => '?').join(',')})`,
          [id, ...deleteFieldIds]
        );
      }
    });

    this.logActivity(userId, 'UPDATE_CLIENT', 'CLIENT', id, `Updated profile details for ${client.full_name}`);
    return client;
  },

  async deleteClient(id: number, userId = 1): Promise<boolean> {
    const idx = store.clients.findIndex(c => c.id === id);
    const client = idx !== -1 ? store.clients[idx] : null;
    if (idx === -1 && (!isConnectedToMySQL || !pool)) {
      return false;
    }

    // 1. Remove from in-memory / local JSON store immediately
    if (idx !== -1) {
      store.clients.splice(idx, 1);
    }
    store.client_custom_field_values = store.client_custom_field_values.filter(v => v.client_id !== id);
    const relatedAppIds = store.visa_applications.filter(a => a.client_id === id).map(a => a.id);
    store.visa_applications = store.visa_applications.filter(a => a.client_id !== id);
    store.tasks = store.tasks.filter(t => t.client_id !== id && !relatedAppIds.includes(t.application_id || 0));
    store.comments = store.comments.filter(c => c.client_id !== id && !relatedAppIds.includes(c.application_id || 0));
    store.hotel_bookings = (store.hotel_bookings || []).filter(b => b.client_id !== id);
    store.follow_ups = (store.follow_ups || []).filter(f => f.client_id !== id);
    const clientInvoiceIds = (store.invoices || []).filter(inv => inv.client_id === id).map(inv => inv.id);
    store.invoices = (store.invoices || []).filter(inv => inv.client_id !== id);
    store.invoice_items = (store.invoice_items || []).filter(it => !clientInvoiceIds.includes(it.invoice_id));
    store.application_status_history = store.application_status_history.filter(h => !relatedAppIds.includes(h.application_id));

    saveStore(store);

    // 2. Execute MySQL deletion in write-through pipeline
    runMySQLWrite(async () => {
      await deleteClientFromMySQL(id, client?.client_id);
    });

    const clientName = client?.full_name || 'Client';
    const clientCode = client?.client_id || `#${id}`;
    this.logActivity(userId, 'DELETE_CLIENT', 'CLIENT', id, `Deleted client profile ${clientName} (${clientCode})`);

    return true;
  },

  // Applications
  getApplications(filters?: { status?: string; visa_type_id?: number; staff_id?: number; search?: string }) {
    this.cleanupStaleUpcomingTasks();
    let list = [...store.visa_applications];

    const clientById = new Map<number, Client>();
    for (const c of store.clients) clientById.set(c.id, c);

    const vtById = new Map<number, VisaType>();
    for (const vt of store.visa_types) vtById.set(vt.id, vt);

    const userById = new Map<number, User>();
    for (const u of store.users) userById.set(u.id, u);

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
        const client = clientById.get(a.client_id);
        const vt = vtById.get(a.visa_type_id);
        return a.application_id.toLowerCase().includes(q) ||
          (client && (client.full_name.toLowerCase().includes(q) || client.passport_number.toLowerCase().includes(q))) ||
          (vt && vt.name.toLowerCase().includes(q));
      });
    }

    return list.map(app => {
      const client = clientById.get(app.client_id);
      const vt = vtById.get(app.visa_type_id);
      const staff = app.assigned_user_id ? userById.get(app.assigned_user_id) : null;
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

    const userById = new Map<number, User>();
    for (const u of store.users) userById.set(u.id, u);

    const client = store.clients.find(c => c.id === app.client_id);
    const vt = store.visa_types.find(v => v.id === app.visa_type_id);
    const staff = app.assigned_user_id ? userById.get(app.assigned_user_id) : null;

    const history = store.application_status_history
      .filter(h => h.application_id === app.id)
      .map(h => {
        const u = h.changed_by_user_id ? userById.get(h.changed_by_user_id) : null;
        return {
          ...h,
          user_name: u?.name || 'Staff',
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const tasks = store.tasks
      .filter(t => t.application_id === app.id)
      .map(t => {
        const assigned = t.assigned_user_id ? userById.get(t.assigned_user_id) : null;
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
    const id = nextEntityId('visa_applications', store.visa_applications);
    const appId = `APP-${String(id).padStart(6, '0')}`;
    const now = new Date().toISOString();
    const status = data.status || 'Upcoming';
    const deliveryDate = (status === 'Online Review Completed' || status === 'Pending Collection' || status === 'Upcoming') && data.delivery_date ? data.delivery_date : null;

    const validAssignedUserId = data.assigned_user_id && store.users.some(u => u.id === data.assigned_user_id) ? data.assigned_user_id : null;
    const validUserId = userId && store.users.some(u => u.id === userId) ? userId : 1;

    const app: VisaApplication = {
      id,
      application_id: appId,
      client_id: data.client_id,
      visa_type_id: data.visa_type_id,
      status,
      delivery_date: deliveryDate,
      notes: data.notes?.trim() || null,
      assigned_user_id: validAssignedUserId,
      created_at: now,
      updated_at: now,
    };

    store.visa_applications.unshift(app);

    // Initial status history
    const histId = nextEntityId('application_status_history', store.application_status_history);
    store.application_status_history.push({
      id: histId,
      application_id: id,
      old_status: null,
      new_status: status,
      delivery_date: app.delivery_date,
      changed_by_user_id: validUserId,
      notes: 'Visa application created',
      created_at: now,
    });

    const client = store.clients.find(c => c.id === data.client_id);
    const clientName = client?.full_name || 'Client';

    runMySQLWrite(async (activePool) => {
      await ensureClientAndAppInMySQL(activePool, app.client_id, app.id);
      await activePool.query(
        `INSERT INTO application_status_history (id, application_id, old_status, new_status, delivery_date, changed_by_user_id, notes, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, 'Visa application created', NOW())
         ON DUPLICATE KEY UPDATE new_status = VALUES(new_status)`,
        [histId, app.id, status, deliveryDate, validUserId]
      );
    });

    // If initial status requires a delivery date or has an optional Upcoming Client date, create linked calendar task
    if ((status === 'Online Review Completed' || status === 'Pending Collection') && app.delivery_date) {
      await this.syncDeliveryTask(app, clientName, validUserId);
    } else if (status === 'Upcoming' && app.delivery_date) {
      await this.syncUpcomingTask(app, clientName, validUserId);
    }

    saveStore(store);
    this.logActivity(validUserId, 'CREATE_APPLICATION', 'APPLICATION', id, `Created visa application ${app.application_id} for ${clientName}`);
    return this.getApplicationById(id) || app;
  },

  async updateApplicationStatus(
    id: number,
    newStatus: string,
    deliveryDate?: string | null,
    notes?: string,
    userId = 1,
    skipSaveAndLog = false,
    preserveAppNotes = false
  ) {
    const app = store.visa_applications.find(a => a.id === id);
    if (!app) return null;

    const oldStatus = app.status;
    app.status = newStatus;
    if (!preserveAppNotes && notes !== undefined) {
      app.notes = notes.trim() || null;
    }
    app.updated_at = new Date().toISOString();

    const client = store.clients.find(c => c.id === app.client_id);
    const clientName = client?.full_name || 'Client';

    const isPreparationOrReviewStatus =
      newStatus === 'Need to Prepare' ||
      newStatus === 'Prepared' ||
      newStatus === 'Under Review' ||
      newStatus === 'File Missing' ||
      newStatus === 'Modify';

    // Delivery / Upcoming date business logic
    if (newStatus === 'Online Review Completed' || newStatus === 'Pending Collection' || newStatus === 'Rejected') {
      if (deliveryDate) {
        app.delivery_date = deliveryDate;
      }
    } else if (newStatus === 'Upcoming') {
      if (deliveryDate !== undefined) {
        app.delivery_date = deliveryDate || null;
      }
    } else if (isPreparationOrReviewStatus) {
      app.delivery_date = null;
    }

    // Remove any "Upcoming Client - ..." task if status is no longer Upcoming or if Upcoming date was cleared,
    // and remove any auto-scheduled delivery/upcoming tasks when moving to Need to Prepare / Prepared / Under Review / File Missing / Modify
    if (newStatus !== 'Upcoming' || !app.delivery_date) {
      const removedTaskIds: number[] = [];
      store.tasks = store.tasks.filter(t => {
        const isUpcomingTask = /^Upcoming Client\s*-/i.test(t.title || '');
        const isLinkedAppOrClient =
          t.application_id === id ||
          (t.client_id === app.client_id && (t.application_id === null || t.application_id === id));
        if (isUpcomingTask && isLinkedAppOrClient) {
          removedTaskIds.push(t.id);
          return false;
        }
        if (isPreparationOrReviewStatus && t.is_delivery_task === 1 && isLinkedAppOrClient) {
          removedTaskIds.push(t.id);
          return false;
        }
        return true;
      });

      runMySQLWrite(async (activePool) => {
        await activePool.query(
          `DELETE FROM tasks WHERE (application_id = ? OR client_id = ?) AND title LIKE 'Upcoming Client%'`,
          [id, app.client_id]
        ).catch(() => {});
        if (isPreparationOrReviewStatus) {
          await activePool.query(
            `DELETE FROM tasks WHERE application_id = ? AND is_delivery_task = 1`,
            [id]
          ).catch(() => {});
        }
        if (removedTaskIds.length > 0) {
          await activePool.query(
            `DELETE FROM tasks WHERE id IN (${removedTaskIds.map(() => '?').join(',')})`,
            removedTaskIds
          ).catch(() => {});
        }
      });
    }

    const histId = nextEntityId('application_status_history', store.application_status_history);
    const trimmedNotes = notes !== undefined ? notes.trim() : '';
    const historyNote = trimmedNotes ? trimmedNotes : `Status changed from ${oldStatus} to ${newStatus}`;

    // Record history
    store.application_status_history.push({
      id: histId,
      application_id: id,
      old_status: oldStatus,
      new_status: newStatus,
      delivery_date: app.delivery_date,
      changed_by_user_id: userId,
      notes: historyNote,
      created_at: new Date().toISOString(),
    });

    const notesToPersist = app.notes ?? null;
    runMySQLWrite(async (activePool) => {
      await ensureClientAndAppInMySQL(activePool, app.client_id, id);
      await activePool.query(
        'UPDATE visa_applications SET status = ?, delivery_date = ?, notes = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, app.delivery_date || null, notesToPersist, id]
      );
      await activePool.query(
        `INSERT INTO application_status_history (id, application_id, old_status, new_status, delivery_date, changed_by_user_id, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE new_status = VALUES(new_status), notes = VALUES(notes)`,
        [histId, id, oldStatus, newStatus, app.delivery_date || null, userId, historyNote]
      );
      if (newStatus === 'Returned') {
        await activePool.query(
          `UPDATE tasks 
           SET status = 'Completed', completed_at = NOW(), updated_at = NOW() 
           WHERE (application_id = ? OR (client_id = ? AND (is_delivery_task = 1 OR title LIKE '%Delivery%' OR title LIKE '%Collection%' OR title LIKE '%Passport%'))) 
             AND status != 'Completed'`,
          [id, app.client_id]
        );
      } else if (oldStatus === 'Returned') {
        await activePool.query(
          `UPDATE tasks 
           SET status = 'Pending', completed_at = NULL, updated_at = NOW() 
           WHERE (application_id = ? OR (client_id = ? AND (is_delivery_task = 1 OR title LIKE '%Delivery%' OR title LIKE '%Collection%' OR title LIKE '%Passport%'))) 
             AND status = 'Completed'`,
          [id, app.client_id]
        );
      }
    });

    // If status has a collection/delivery date or optional Upcoming Client date, create/update linked task
    if ((newStatus === 'Online Review Completed' || newStatus === 'Pending Collection' || newStatus === 'Rejected') && app.delivery_date) {
      await this.syncDeliveryTask(app, clientName, userId);
    } else if (newStatus === 'Upcoming' && app.delivery_date) {
      await this.syncUpcomingTask(app, clientName, userId);
    }

    // If status is Returned, complete any pending collection or delivery tasks linked to this application (excluding follow-up tasks)
    if (newStatus === 'Returned') {
      store.tasks.forEach(t => {
        const isFollowUp = (t.title && t.title.startsWith('[Follow-up]')) || (store.follow_ups && store.follow_ups.some(f => Number(f.task_id) === Number(t.id)));
        if (
          !isFollowUp &&
          (t.application_id === id || (t.client_id === app.client_id && (t.is_delivery_task === 1 || t.title.toLowerCase().includes('delivery') || t.title.toLowerCase().includes('collection')))) &&
          t.status !== 'Completed'
        ) {
          t.status = 'Completed';
          t.completed_at = new Date().toISOString();
          t.updated_at = new Date().toISOString();
        }
      });
    } else if (oldStatus === 'Returned') {
      store.tasks.forEach(t => {
        const isFollowUp = (t.title && t.title.startsWith('[Follow-up]')) || (store.follow_ups && store.follow_ups.some(f => Number(f.task_id) === Number(t.id)));
        if (
          !isFollowUp &&
          (t.application_id === id || (t.client_id === app.client_id && (t.is_delivery_task === 1 || t.title.toLowerCase().includes('delivery') || t.title.toLowerCase().includes('collection')))) &&
          t.status === 'Completed'
        ) {
          t.status = 'Pending';
          t.completed_at = null;
          t.updated_at = new Date().toISOString();
        }
      });
    }

    if (!skipSaveAndLog) {
      saveStore(store);
      this.logActivity(
        userId,
        'STATUS_CHANGE',
        'APPLICATION',
        id,
        `Changed status of ${app.application_id} (${clientName}) to ${newStatus}`
      );
    }
    return app;
  },

  async batchUpdateApplicationStatus(
    applicationIds: number[],
    newStatus: string,
    deliveryDate?: string | null,
    notes?: string,
    userId = 1
  ) {
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return { success: false, updatedCount: 0, message: 'No applications specified.' };
    }

    let updatedCount = 0;
    const trimmedBatchNotes = notes?.trim();
    for (const appId of applicationIds) {
      const updated = await this.updateApplicationStatus(
        appId,
        newStatus,
        deliveryDate,
        trimmedBatchNotes ? trimmedBatchNotes : `Batch status update to ${newStatus}`,
        userId,
        true,
        !trimmedBatchNotes
      );
      if (updated) {
        updatedCount++;
      }
    }

    saveStore(store);
    this.logActivity(
      userId,
      'BATCH_UPDATE_STATUS',
      'APPLICATION',
      null,
      `Batch updated ${updatedCount} applications to status "${newStatus}"`
    );

    return { success: true, updatedCount, message: `Successfully updated ${updatedCount} applications.` };
  },

  async updateApplication(id: number, data: Partial<VisaApplication>, userId = 1) {
    const app = store.visa_applications.find(a => a.id === id);
    if (!app) return null;

    const client = store.clients.find(c => c.id === app.client_id);
    const clientName = client?.full_name || 'Client';

    const oldStatus = app.status;
    if (data.status !== undefined && data.status !== oldStatus) {
      app.status = data.status;
      if (data.status === 'Returned') {
        runMySQLWrite(async (activePool) => {
          await activePool.query(
            `UPDATE tasks 
             SET status = 'Completed', completed_at = NOW(), updated_at = NOW() 
             WHERE (application_id = ? OR (client_id = ? AND (is_delivery_task = 1 OR title LIKE '%Delivery%' OR title LIKE '%Collection%'))) 
               AND title NOT LIKE '[Follow-up]%'
               AND status != 'Completed'`,
            [id, app.client_id]
          );
        });

        store.tasks.forEach(t => {
          const isFollowUp = (t.title && t.title.startsWith('[Follow-up]')) || (store.follow_ups && store.follow_ups.some(f => Number(f.task_id) === Number(t.id)));
          if (
            !isFollowUp &&
            (t.application_id === id || (t.client_id === app.client_id && (t.is_delivery_task === 1 || t.title.toLowerCase().includes('delivery') || t.title.toLowerCase().includes('collection')))) &&
            t.status !== 'Completed'
          ) {
            t.status = 'Completed';
            t.completed_at = new Date().toISOString();
            t.updated_at = new Date().toISOString();
          }
        });
      } else if (oldStatus === 'Returned' && data.status !== 'Returned') {
        runMySQLWrite(async (activePool) => {
          await activePool.query(
            `UPDATE tasks 
             SET status = 'Pending', completed_at = NULL, updated_at = NOW() 
             WHERE (application_id = ? OR (client_id = ? AND (is_delivery_task = 1 OR title LIKE '%Delivery%' OR title LIKE '%Collection%'))) 
               AND title NOT LIKE '[Follow-up]%'
               AND status = 'Completed'`,
            [id, app.client_id]
          );
        });

        store.tasks.forEach(t => {
          const isFollowUp = (t.title && t.title.startsWith('[Follow-up]')) || (store.follow_ups && store.follow_ups.some(f => Number(f.task_id) === Number(t.id)));
          if (
            !isFollowUp &&
            (t.application_id === id || (t.client_id === app.client_id && (t.is_delivery_task === 1 || t.title.toLowerCase().includes('delivery') || t.title.toLowerCase().includes('collection')))) &&
            t.status === 'Completed'
          ) {
            t.status = 'Pending';
            t.completed_at = null;
            t.updated_at = new Date().toISOString();
          }
        });
      }
    }

    if (data.visa_type_id !== undefined) app.visa_type_id = data.visa_type_id;
    if (data.assigned_user_id !== undefined) app.assigned_user_id = data.assigned_user_id;
    if (data.notes !== undefined) app.notes = data.notes;

    const oldDeliveryDate = app.delivery_date;
    if (data.delivery_date !== undefined) {
      app.delivery_date = data.delivery_date;
    }

    const statusChanged = data.status !== undefined && data.status !== oldStatus;
    const deliveryDateChanged = data.delivery_date !== undefined && app.delivery_date !== oldDeliveryDate;

    const isPreparationOrReviewStatus =
      app.status === 'Need to Prepare' ||
      app.status === 'Prepared' ||
      app.status === 'Under Review' ||
      app.status === 'File Missing' ||
      app.status === 'Modify';

    if (isPreparationOrReviewStatus) {
      app.delivery_date = null;
    }

    if (app.status !== 'Upcoming' || !app.delivery_date) {
      const removedTaskIds: number[] = [];
      store.tasks = store.tasks.filter(t => {
        const isUpcomingTask = /^Upcoming Client\s*-/i.test(t.title || '');
        const isLinkedAppOrClient =
          t.application_id === id ||
          (t.client_id === app.client_id && (t.application_id === null || t.application_id === id));
        if (isUpcomingTask && isLinkedAppOrClient) {
          removedTaskIds.push(t.id);
          return false;
        }
        if (isPreparationOrReviewStatus && t.is_delivery_task === 1 && isLinkedAppOrClient) {
          removedTaskIds.push(t.id);
          return false;
        }
        return true;
      });

      if (removedTaskIds.length > 0 || statusChanged) {
        runMySQLWrite(async (activePool) => {
          await activePool.query(
            `DELETE FROM tasks WHERE (application_id = ? OR client_id = ?) AND title LIKE 'Upcoming Client%'`,
            [id, app.client_id]
          ).catch(() => {});
          if (isPreparationOrReviewStatus) {
            await activePool.query(
              `DELETE FROM tasks WHERE application_id = ? AND is_delivery_task = 1`,
              [id]
            ).catch(() => {});
          }
          if (removedTaskIds.length > 0) {
            await activePool.query(
              `DELETE FROM tasks WHERE id IN (${removedTaskIds.map(() => '?').join(',')})`,
              removedTaskIds
            ).catch(() => {});
          }
        });
      }
    }

    if (app.delivery_date && (statusChanged || deliveryDateChanged)) {
      if (app.status === 'Upcoming') {
        await this.syncUpcomingTask(app, clientName, userId);
      } else if (
        app.status === 'Online Review Completed' ||
        app.status === 'Pending Collection' ||
        app.status === 'Rejected'
      ) {
        await this.syncDeliveryTask(app, clientName, userId);
      }
    }

    app.updated_at = new Date().toISOString();

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await ensureClientAndAppInMySQL(activePool, app.client_id, id);
      await activePool.query(
        `UPDATE visa_applications SET status = ?, visa_type_id = ?, assigned_user_id = ?, notes = ?, delivery_date = ?, updated_at = NOW() WHERE id = ?`,
        [app.status, app.visa_type_id, app.assigned_user_id || null, app.notes || null, app.delivery_date || null, id]
      );
    });

    this.logActivity(userId, 'UPDATE_APPLICATION', 'APPLICATION', id, `Updated application ${app.application_id}`);
    return app;
  },

  async syncUpcomingTask(app: VisaApplication, clientName: string, userId: number) {
    if (!app.delivery_date) return;
    const taskTitle = `Upcoming Client - ${clientName}`;
    const existingTask = store.tasks.find(
      t => t.application_id === app.id && t.is_delivery_task === 0 && /^Upcoming Client\s*-/i.test(t.title || '')
    );

    const validAssignedUserId = app.assigned_user_id && store.users.some(u => u.id === app.assigned_user_id)
      ? app.assigned_user_id
      : (userId && store.users.some(u => u.id === userId) ? userId : (store.users[0]?.id || null));

    if (existingTask) {
      existingTask.due_date = app.delivery_date;
      if (existingTask.status === 'Completed') {
        existingTask.status = 'Pending';
        existingTask.completed_at = null;
      }
      existingTask.updated_at = new Date().toISOString();
      if (validAssignedUserId) {
        existingTask.assigned_user_id = validAssignedUserId;
      }
      runMySQLWrite(async (activePool) => {
        await ensureClientAndAppInMySQL(activePool, app.client_id, app.id);
        await activePool.query(
          'UPDATE tasks SET due_date = ?, status = ?, completed_at = ?, assigned_user_id = COALESCE(?, assigned_user_id), updated_at = NOW() WHERE id = ?',
          [app.delivery_date, existingTask.status, null, validAssignedUserId, existingTask.id]
        );
      });
      this.logActivity(userId, 'UPDATE_TASK', 'TASK', existingTask.id, `Updated upcoming client date to ${app.delivery_date} for task "${existingTask.title}"`);
    } else {
      const taskId = nextEntityId('tasks', store.tasks);
      const taskDesc = `Upcoming client scheduled for ${clientName} (${app.application_id}).${app.notes ? ` Notes: ${app.notes}` : ''}`;
      const newTask: Task = {
        id: taskId,
        title: taskTitle,
        description: taskDesc,
        client_id: app.client_id,
        application_id: app.id,
        assigned_user_id: validAssignedUserId,
        due_date: app.delivery_date,
        priority: 'Normal',
        status: 'Pending',
        is_delivery_task: 0,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.tasks.push(newTask);

      runMySQLWrite(async (activePool) => {
        const { validClientId, validAppId } = await ensureClientAndAppInMySQL(activePool, app.client_id, app.id);
        await activePool.query(
          `INSERT INTO tasks (id, title, description, client_id, application_id, assigned_user_id, due_date, priority, status, is_delivery_task, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Normal', 'Pending', 0, NOW(), NOW())
           ON DUPLICATE KEY UPDATE due_date = VALUES(due_date), status = VALUES(status), updated_at = NOW()`,
          [
            taskId,
            taskTitle,
            taskDesc,
            validClientId,
            validAppId,
            validAssignedUserId,
            app.delivery_date,
          ]
        );
      });

      this.logActivity(userId, 'CREATE_TASK', 'TASK', taskId, `Auto-created upcoming client task "${taskTitle}" on ${app.delivery_date}`);
    }
  },

  async syncDeliveryTask(app: VisaApplication, clientName: string, userId: number) {
    if (!app.delivery_date) return;
    const taskTitle = app.status === 'Pending Collection'
      ? `Pending Collection - ${clientName}`
      : app.status === 'Rejected'
      ? `Rejected - ${clientName}`
      : `Delivery - ${clientName}`;
    const taskDesc = `Scheduled passport/visa collection/delivery for ${clientName} (${app.application_id}). Status: ${app.status}.`;
    const existingTask =
      store.tasks.find(t => t.application_id === app.id && t.is_delivery_task === 1) ||
      store.tasks.find(
        t =>
          t.client_id === app.client_id &&
          (t.is_delivery_task === 1 || /^(Delivery|Pending Collection|Rejected)\s*-/i.test(t.title || ''))
      );

    const validAssignedUserId = app.assigned_user_id && store.users.some(u => u.id === app.assigned_user_id)
      ? app.assigned_user_id
      : (userId && store.users.some(u => u.id === userId) ? userId : (store.users[0]?.id || null));

    if (existingTask) {
      existingTask.title = taskTitle;
      existingTask.description = taskDesc;
      existingTask.due_date = app.delivery_date;
      existingTask.application_id = app.id;
      existingTask.is_delivery_task = 1;
      if (app.status !== 'Returned' && existingTask.status === 'Completed') {
        existingTask.status = 'Pending';
        existingTask.completed_at = null;
      }
      existingTask.updated_at = new Date().toISOString();
      if (validAssignedUserId) {
        existingTask.assigned_user_id = validAssignedUserId;
      }
      runMySQLWrite(async (activePool) => {
        const { validAppId } = await ensureClientAndAppInMySQL(activePool, app.client_id, app.id);
        await activePool.query(
          'UPDATE tasks SET title = ?, description = ?, due_date = ?, application_id = COALESCE(?, application_id), is_delivery_task = 1, status = ?, completed_at = ?, assigned_user_id = COALESCE(?, assigned_user_id), updated_at = NOW() WHERE id = ?',
          [taskTitle, taskDesc, app.delivery_date, validAppId, existingTask.status, existingTask.completed_at ? new Date(existingTask.completed_at) : null, validAssignedUserId, existingTask.id]
        );
      });
      this.logActivity(userId, 'UPDATE_TASK', 'TASK', existingTask.id, `Updated task "${existingTask.title}" scheduled on ${app.delivery_date}`);
    } else {
      const taskId = nextEntityId('tasks', store.tasks);
      const newTask: Task = {
        id: taskId,
        title: taskTitle,
        description: taskDesc,
        client_id: app.client_id,
        application_id: app.id,
        assigned_user_id: validAssignedUserId,
        due_date: app.delivery_date,
        priority: 'High',
        status: 'Pending',
        is_delivery_task: 1,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.tasks.push(newTask);

      runMySQLWrite(async (activePool) => {
        const { validClientId, validAppId } = await ensureClientAndAppInMySQL(activePool, app.client_id, app.id);
        await activePool.query(
          `INSERT INTO tasks (id, title, description, client_id, application_id, assigned_user_id, due_date, priority, status, is_delivery_task, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'High', 'Pending', 1, NOW(), NOW())
           ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), due_date = VALUES(due_date), status = VALUES(status), updated_at = NOW()`,
          [
            taskId,
            taskTitle,
            taskDesc,
            validClientId,
            validAppId,
            validAssignedUserId,
            app.delivery_date,
          ]
        );
      });

      this.logActivity(userId, 'CREATE_TASK', 'TASK', taskId, `Auto-created task "${taskTitle}" on ${app.delivery_date}`);
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

    runMySQLWrite(async (activePool) => {
      await activePool.query('DELETE FROM application_status_history WHERE application_id = ?', [id]).catch(() => {});
      await activePool.query('DELETE FROM comments WHERE application_id = ?', [id]).catch(() => {});
      await activePool.query('DELETE FROM tasks WHERE application_id = ?', [id]).catch(() => {});
      await activePool.query('DELETE FROM visa_applications WHERE id = ?', [id]);
    });

    this.logActivity(userId, 'DELETE_APPLICATION', 'APPLICATION', id, `Deleted visa application ${app.application_id}`);
    return true;
  },

  cleanupStaleUpcomingTasks() {
    if (lastUpcomingCleanupVersion === dataVersion) {
      return;
    }
    lastUpcomingCleanupVersion = dataVersion;

    let storeModified = false;
    const clearedAppIds: number[] = [];
    const removedTaskIds: number[] = [];

    const appById = new Map<number, VisaApplication>();
    const appsByClientId = new Map<number, VisaApplication[]>();
    for (const a of store.visa_applications) {
      const isPrepOrReview =
        a.status === 'Need to Prepare' ||
        a.status === 'Prepared' ||
        a.status === 'Under Review' ||
        a.status === 'File Missing' ||
        a.status === 'Modify';
      if (isPrepOrReview && a.delivery_date) {
        a.delivery_date = null;
        clearedAppIds.push(a.id);
        storeModified = true;
      }
      appById.set(a.id, a);
      const list = appsByClientId.get(a.client_id) || [];
      list.push(a);
      appsByClientId.set(a.client_id, list);
    }

    store.tasks = store.tasks.filter(t => {
      const isUpcomingTask = /^Upcoming Client\s*-/i.test(t.title || '');
      if (!isUpcomingTask) return true;

      const linkedApp =
        (t.application_id ? appById.get(t.application_id) : undefined) ||
        (t.client_id ? (appsByClientId.get(t.client_id) || [])[0] : undefined);

      // Keep only if there is a linked application that is still 'Upcoming' and has a delivery_date
      if (linkedApp && (linkedApp.status !== 'Upcoming' || !linkedApp.delivery_date)) {
        removedTaskIds.push(t.id);
        storeModified = true;
        return false;
      }
      return true;
    });

    if (storeModified) {
      saveStore(store);
      runMySQLWrite(async (activePool) => {
        if (clearedAppIds.length > 0) {
          await activePool.query(
            `UPDATE visa_applications SET delivery_date = NULL WHERE id IN (${clearedAppIds.map(() => '?').join(',')})`,
            clearedAppIds
          ).catch(() => {});
        }
        if (removedTaskIds.length > 0) {
          await activePool.query(
            `DELETE FROM tasks WHERE id IN (${removedTaskIds.map(() => '?').join(',')})`,
            removedTaskIds
          ).catch(() => {});
        }
      });
    }
  },

  // Tasks
  getTasks(filters?: { status?: string; priority?: string; user_id?: number; client_id?: number; due_date?: string }) {
    this.cleanupStaleUpcomingTasks();
    let list = [...store.tasks];
    if (filters?.status) list = list.filter(t => t.status === filters.status);
    if (filters?.priority) list = list.filter(t => t.priority === filters.priority);
    if (filters?.user_id) list = list.filter(t => t.assigned_user_id === Number(filters.user_id));
    if (filters?.client_id) list = list.filter(t => t.client_id === Number(filters.client_id));
    if (filters?.due_date) list = list.filter(t => t.due_date === filters.due_date);

    const clientById = new Map<number, Client>();
    for (const c of store.clients) clientById.set(c.id, c);

    const appById = new Map<number, VisaApplication>();
    for (const a of store.visa_applications) appById.set(a.id, a);

    const userById = new Map<number, User>();
    for (const u of store.users) userById.set(u.id, u);

    return list.map(t => {
      const client = t.client_id ? clientById.get(t.client_id) : null;
      const isDeliveryLike = t.is_delivery_task === 1 || /^(Delivery|Pending Collection|Rejected)\s*-/i.test(t.title || '');
      const app =
        (t.application_id ? appById.get(t.application_id) : null) ||
        (isDeliveryLike && t.client_id
          ? store.visa_applications.find(
              a =>
                a.client_id === t.client_id &&
                (a.status === 'Pending Collection' ||
                  a.status === 'Online Review Completed' ||
                  a.status === 'Rejected')
            ) || store.visa_applications.find(a => a.client_id === t.client_id)
          : null);
      const user = t.assigned_user_id ? userById.get(t.assigned_user_id) : null;
      let resolvedTitle = t.title;
      if (isDeliveryLike && app) {
        const cName = client?.full_name || t.title.replace(/^(Delivery|Pending Collection|Rejected)\s*-\s*/i, '').trim() || 'Client';
        if (app.status === 'Pending Collection') {
          resolvedTitle = `Pending Collection - ${cName}`;
        } else if (app.status === 'Rejected') {
          resolvedTitle = `Rejected - ${cName}`;
        } else if (app.status === 'Online Review Completed') {
          resolvedTitle = `Delivery - ${cName}`;
        }
      }
      return {
        ...t,
        title: resolvedTitle,
        application_id: app?.id || t.application_id || null,
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
    const isDeliveryLike = t.is_delivery_task === 1 || /^(Delivery|Pending Collection|Rejected)\s*-/i.test(t.title || '');
    const app =
      (t.application_id ? store.visa_applications.find(a => a.id === t.application_id) : null) ||
      (isDeliveryLike && t.client_id
        ? store.visa_applications.find(
            a =>
              a.client_id === t.client_id &&
              (a.status === 'Pending Collection' ||
                a.status === 'Online Review Completed' ||
                a.status === 'Rejected')
          ) || store.visa_applications.find(a => a.client_id === t.client_id)
        : null);
    const user = t.assigned_user_id ? store.users.find(u => u.id === t.assigned_user_id) : null;
    let resolvedTitle = t.title;
    if (isDeliveryLike && app) {
      const cName = client?.full_name || t.title.replace(/^(Delivery|Pending Collection|Rejected)\s*-\s*/i, '').trim() || 'Client';
      if (app.status === 'Pending Collection') {
        resolvedTitle = `Pending Collection - ${cName}`;
      } else if (app.status === 'Rejected') {
        resolvedTitle = `Rejected - ${cName}`;
      } else if (app.status === 'Online Review Completed') {
        resolvedTitle = `Delivery - ${cName}`;
      }
    }
    return {
      ...t,
      title: resolvedTitle,
      application_id: app?.id || t.application_id || null,
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
    const id = nextEntityId('tasks', store.tasks);
    const now = new Date().toISOString();
    const validAssignedUserId = data.assigned_user_id && store.users.some(u => u.id === data.assigned_user_id) ? data.assigned_user_id : null;

    const task: Task = {
      id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      client_id: data.client_id || null,
      application_id: data.application_id || null,
      assigned_user_id: validAssignedUserId,
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

    runMySQLWrite(async (activePool) => {
      const { validClientId, validAppId } = await ensureClientAndAppInMySQL(activePool, task.client_id, task.application_id);
      await activePool.query(
        `INSERT INTO tasks (id, title, description, client_id, application_id, assigned_user_id, due_date, priority, status, is_delivery_task, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 0, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           title = VALUES(title), description = VALUES(description), due_date = VALUES(due_date),
           priority = VALUES(priority), status = VALUES(status), updated_at = NOW()`,
        [
          task.id,
          task.title,
          task.description,
          validClientId,
          validAppId,
          task.assigned_user_id,
          task.due_date,
          task.priority,
        ]
      );
    });

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
    if (data.assigned_user_id !== undefined) {
      task.assigned_user_id = data.assigned_user_id && store.users.some(u => u.id === data.assigned_user_id)
        ? data.assigned_user_id
        : null;
    }
    if (data.due_date !== undefined) task.due_date = data.due_date;
    if (data.priority !== undefined) task.priority = data.priority;
    const wasCompleted = task.status === 'Completed';
    if (data.status !== undefined) {
      task.status = data.status;
      task.completed_at = data.status === 'Completed' ? new Date().toISOString() : null;
    }
    task.updated_at = new Date().toISOString();

    const isFollowUpTask = (task.title && task.title.startsWith('[Follow-up]')) || (store.follow_ups && store.follow_ups.some(f => Number(f.task_id) === Number(task.id)));
    const isDeliveryOrCollection = !isFollowUpTask && (
      task.is_delivery_task === 1 ||
      (task.application_id && (/delivery/i.test(task.title || '') || /collection/i.test(task.title || ''))) ||
      (/^Delivery\s*-/i.test(task.title || ''))
    );

    if (isDeliveryOrCollection && data.status === 'Completed' && !wasCompleted) {
      let appId = task.application_id;
      if (!appId && task.client_id) {
        const activeApp = store.visa_applications.find(a => Number(a.client_id) === Number(task.client_id) && (a.status === 'Pending Collection' || a.delivery_date));
        if (activeApp) appId = activeApp.id;
      }
      if (appId) {
        try {
          await this.updateApplicationStatus(appId, 'Returned', undefined, 'Collection task completed.', userId, true, true);
        } catch (err: any) {
          console.error('[MySQL] Error auto-updating application to Returned on task complete:', err.message);
        }
      }
    } else if (isDeliveryOrCollection && data.status === 'Pending' && wasCompleted) {
      let appId = task.application_id;
      if (!appId && task.client_id) {
        const returnedApp = store.visa_applications.find(a => Number(a.client_id) === Number(task.client_id) && a.status === 'Returned');
        if (returnedApp) appId = returnedApp.id;
      }
      if (appId) {
        const app = store.visa_applications.find(a => a.id === appId);
        if (app && app.status === 'Returned') {
          const history = (store.application_status_history || [])
            .filter(h => h.application_id === appId)
            .sort((a, b) => (b.id || 0) - (a.id || 0));
          const returnedEntry = history.find(h => h.new_status === 'Returned');
          const previousStatus = (returnedEntry && returnedEntry.old_status && returnedEntry.old_status !== 'Returned')
            ? returnedEntry.old_status
            : 'Pending Collection';

          try {
            await this.updateApplicationStatus(appId, previousStatus, undefined, 'Reverted status from Returned because collection task was marked uncompleted.', userId, true, true);
          } catch (err: any) {
            console.error('[MySQL] Error reverting application status on task uncomplete:', err.message);
          }
        }
      }
    }

    // Synchronize linked follow-up if this task was created from a follow-up
    const linkedFollowUp = (store.follow_ups || []).find(f => Number(f.task_id) === Number(id));
    if (linkedFollowUp) {
      if (data.status !== undefined) {
        linkedFollowUp.status = data.status === 'Completed' ? 'Completed' : 'Pending';
        linkedFollowUp.completed_at = data.status === 'Completed' ? (linkedFollowUp.completed_at || new Date().toISOString()) : null;
      }
      if (data.due_date !== undefined) {
        linkedFollowUp.due_date = data.due_date;
      }
      if (data.priority !== undefined) {
        linkedFollowUp.priority = data.priority;
      }
      linkedFollowUp.updated_at = new Date().toISOString();
    }

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      const { validClientId, validAppId } = await ensureClientAndAppInMySQL(activePool, task.client_id, task.application_id);
      await activePool.query(
        `UPDATE tasks SET
          title = ?, description = ?, client_id = ?, application_id = ?,
          assigned_user_id = ?, due_date = ?, priority = ?, status = ?,
          completed_at = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          task.title,
          task.description,
          validClientId,
          validAppId,
          task.assigned_user_id,
          task.due_date,
          task.priority,
          task.status,
          task.completed_at ? new Date(task.completed_at) : null,
          id,
        ]
      );

      if (linkedFollowUp) {
        await activePool.query(
          `UPDATE follow_ups SET status = ?, due_date = ?, priority = ?, completed_at = ?, updated_at = NOW() WHERE id = ?`,
          [
            linkedFollowUp.status,
            linkedFollowUp.due_date,
            linkedFollowUp.priority,
            linkedFollowUp.completed_at ? new Date(linkedFollowUp.completed_at) : null,
            linkedFollowUp.id,
          ]
        ).catch(() => {});
      }
    });

    this.logActivity(userId, 'UPDATE_TASK', 'TASK', id, `Updated task: ${task.title} (${task.status})`);
    return task;
  },

  async deleteTask(id: number, userId = 1) {
    const idx = store.tasks.findIndex(t => Number(t.id) === Number(id));
    const task = idx !== -1 ? store.tasks[idx] : null;

    if (idx !== -1) {
      store.tasks.splice(idx, 1);
    }

    if (task) {
      if (task.is_delivery_task === 1 || task.application_id) {
        if (task.application_id) {
          const app = store.visa_applications.find(a => a.id === task.application_id);
          if (app) {
            app.delivery_date = null;
          }
        } else if (task.client_id) {
          const apps = store.visa_applications.filter(a => a.client_id === task.client_id && a.delivery_date);
          apps.forEach(app => {
            app.delivery_date = null;
          });
        }
      }

      if (store.hotel_bookings) {
        store.hotel_bookings.forEach(b => {
          if (Number(b.checkout_task_id) === Number(id)) {
            b.checkout_task_id = null;
          }
        });
      }

      if (store.follow_ups) {
        store.follow_ups.forEach(f => {
          if (Number(f.task_id) === Number(id)) {
            f.task_id = null;
          }
        });
      }
    }

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      if (task && (task.is_delivery_task === 1 || task.application_id)) {
        if (task.application_id) {
          await activePool.query('UPDATE visa_applications SET delivery_date = NULL WHERE id = ?', [task.application_id]).catch(() => {});
        } else if (task.client_id) {
          await activePool.query('UPDATE visa_applications SET delivery_date = NULL WHERE client_id = ?', [task.client_id]).catch(() => {});
        }
      }
      await activePool.query('UPDATE hotel_bookings SET checkout_task_id = NULL WHERE checkout_task_id = ?', [id]).catch(() => {});
      await activePool.query('UPDATE follow_ups SET task_id = NULL WHERE task_id = ?', [id]).catch(() => {});
      await activePool.query('DELETE FROM tasks WHERE id = ?', [id]);
    });

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
    const userById = new Map<number, User>();
    for (const u of store.users) userById.set(u.id, u);

    return list.map(c => {
      const u = userById.get(c.user_id);
      return {
        ...c,
        user_name: u?.name || 'Staff',
        user_role: u?.role || 'staff',
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createComment(data: { client_id: number; application_id?: number | null; user_id: number; message: string }) {
    const id = nextEntityId('comments', store.comments);
    const now = new Date().toISOString();

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

    runMySQLWrite(async (activePool) => {
      const { validClientId, validAppId } = await ensureClientAndAppInMySQL(activePool, comment.client_id, comment.application_id);
      await activePool.query(
        `INSERT INTO comments (id, client_id, application_id, user_id, message, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE message = VALUES(message)`,
        [comment.id, validClientId, validAppId, comment.user_id, comment.message]
      );
    });

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
    const id = nextEntityId('client_custom_fields', store.client_custom_fields);
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

    store.client_custom_fields.push(field);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO client_custom_fields (id, field_name, field_label, field_type, field_options, is_required, is_active, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           field_label = VALUES(field_label), field_type = VALUES(field_type),
           field_options = VALUES(field_options), is_required = VALUES(is_required),
           display_order = VALUES(display_order), updated_at = NOW()`,
        [field.id, field.field_name, field.field_label, field.field_type, field.field_options, field.is_required, field.display_order]
      );
    });

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

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `UPDATE client_custom_fields SET field_label = ?, field_type = ?, field_options = ?, is_required = ?, is_active = ?, display_order = ?, updated_at = NOW() WHERE id = ?`,
        [field.field_label, field.field_type, field.field_options, field.is_required, field.is_active, field.display_order, id]
      );
    });

    this.logActivity(userId, 'UPDATE_CUSTOM_FIELD', 'SETTINGS', id, `Updated custom field "${field.field_label}"`);
    return field;
  },

  async deleteCustomField(id: number, userId = 1) {
    const idx = store.client_custom_fields.findIndex(f => f.id === id);
    if (idx === -1) return false;
    const [field] = store.client_custom_fields.splice(idx, 1);
    store.client_custom_field_values = store.client_custom_field_values.filter(v => v.field_id !== id);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query('DELETE FROM client_custom_field_values WHERE field_id = ?', [id]);
      await activePool.query('DELETE FROM client_custom_fields WHERE id = ?', [id]);
    });

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
    const id = nextEntityId('visa_types', store.visa_types);
    const vt: VisaType = {
      id,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      is_active: 1,
      created_at: new Date().toISOString(),
    };

    store.visa_types.push(vt);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO visa_types (id, name, description, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), updated_at = NOW()`,
        [vt.id, vt.name, vt.description]
      );
    });

    this.logActivity(userId, 'CREATE_VISA_TYPE', 'SETTINGS', vt.id, `Added visa type "${vt.name}"`);
    return vt;
  },

  async updateVisaType(id: number, data: Partial<VisaType>, userId = 1) {
    const vt = store.visa_types.find(v => v.id === id);
    if (!vt) return null;
    if (data.name !== undefined) vt.name = data.name.trim();
    if (data.description !== undefined) vt.description = data.description?.trim() || null;
    if (data.is_active !== undefined) vt.is_active = data.is_active;

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        'UPDATE visa_types SET name = ?, description = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
        [vt.name, vt.description, vt.is_active, id]
      );
    });

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

    runMySQLWrite(async (activePool) => {
      await activePool.query('DELETE FROM visa_types WHERE id = ?', [id]);
    });

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
    const id = nextEntityId('countries', store.countries);
    const country: Country = {
      id,
      name: data.name.trim(),
      code: data.code?.trim().toUpperCase() || null,
      is_active: 1,
      display_order: store.countries.length + 1,
      created_at: new Date().toISOString(),
    };

    store.countries.push(country);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO countries (id, name, code, is_active, display_order, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), display_order = VALUES(display_order), updated_at = NOW()`,
        [country.id, country.name, country.code, country.display_order]
      );
    });

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

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        'UPDATE countries SET name = ?, code = ?, is_active = ?, display_order = ?, updated_at = NOW() WHERE id = ?',
        [country.name, country.code, country.is_active, country.display_order, id]
      );
    });

    this.logActivity(userId, 'UPDATE_COUNTRY', 'SETTINGS', id, `Updated country "${country.name}"`);
    return country;
  },

  async deleteCountry(id: number, userId = 1) {
    if (!store.countries) return false;
    const idx = store.countries.findIndex(c => c.id === id);
    if (idx === -1) return false;
    const [c] = store.countries.splice(idx, 1);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query('DELETE FROM countries WHERE id = ?', [id]);
    });

    this.logActivity(userId, 'DELETE_COUNTRY', 'SETTINGS', id, `Deleted country "${c.name}"`);
    return true;
  },

  // Activity
  getActivityLogs(limit = 20) {
    const userById = new Map<number, User>();
    for (const u of store.users) userById.set(u.id, u);

    return store.activity_logs
      .slice(0, Math.max(limit * 2, 50))
      .map(l => {
        const u = l.user_id ? userById.get(l.user_id) : null;
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
      id: nextEntityId('activity_logs', store.activity_logs),
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
    runMySQLWrite(async (activePool) => {
      await activePool.query(
        'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [userId || null, action, entityType, entityId || null, details]
      );
    });
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

    const roomsByHotelId = new Map<number, HotelRoom[]>();
    for (const r of store.hotel_rooms || []) {
      if (activeOnly && r.is_active !== 1) continue;
      let arr = roomsByHotelId.get(r.hotel_id);
      if (!arr) {
        arr = [];
        roomsByHotelId.set(r.hotel_id, arr);
      }
      arr.push(r);
    }

    return list.map(hotel => {
      const rooms = roomsByHotelId.get(hotel.id) || [];
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
    const now = new Date().toISOString();
    const id = nextEntityId('hotels', store.hotels);
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

    store.hotels.push(hotel);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO hotels (id, name, city, address, star_rating, phone, email, notes, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), city = VALUES(city), address = VALUES(address),
           star_rating = VALUES(star_rating), phone = VALUES(phone), email = VALUES(email),
           notes = VALUES(notes), updated_at = NOW()`,
        [hotel.id, hotel.name, hotel.city, hotel.address, hotel.star_rating, hotel.phone, hotel.email, hotel.notes]
      );
    });

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

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `UPDATE hotels SET name = ?, city = ?, address = ?, star_rating = ?, phone = ?, email = ?, notes = ?, is_active = ?, updated_at = NOW() WHERE id = ?`,
        [hotel.name, hotel.city, hotel.address, hotel.star_rating, hotel.phone, hotel.email, hotel.notes, hotel.is_active, id]
      );
    });

    this.logActivity(userId, 'UPDATE_HOTEL', 'HOTEL', id, `Updated hotel "${hotel.name}"`);
    return this.getHotelById(id);
  },

  async deleteHotel(id: number, userId = 1) {
    if (!store.hotels) return false;
    const idx = store.hotels.findIndex(h => h.id === id);
    if (idx === -1) return false;
    const [deleted] = store.hotels.splice(idx, 1);
    if (store.hotel_rooms) {
      store.hotel_rooms = store.hotel_rooms.filter(r => r.hotel_id !== id);
    }
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query('DELETE FROM hotel_rooms WHERE hotel_id = ?', [id]).catch(() => {});
      await activePool.query('DELETE FROM hotel_bookings WHERE hotel_id = ?', [id]).catch(() => {});
      await activePool.query('DELETE FROM hotels WHERE id = ?', [id]).catch(() => {});
    });

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
    const now = new Date().toISOString();
    const id = nextEntityId('hotel_rooms', store.hotel_rooms);
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

    store.hotel_rooms.push(room);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO hotel_rooms (id, hotel_id, name, price_per_night, currency, capacity, description, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), price_per_night = VALUES(price_per_night), currency = VALUES(currency),
           capacity = VALUES(capacity), description = VALUES(description), updated_at = NOW()`,
        [room.id, room.hotel_id, room.name, room.price_per_night, room.currency, room.capacity, room.description]
      );
    });

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

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `UPDATE hotel_rooms SET name = ?, price_per_night = ?, currency = ?, capacity = ?, description = ?, is_active = ?, updated_at = NOW() WHERE id = ?`,
        [room.name, room.price_per_night, room.currency, room.capacity, room.description, room.is_active, id]
      );
    });

    this.logActivity(userId, 'UPDATE_HOTEL_ROOM', 'HOTEL', room.hotel_id, `Updated room type "${room.name}"`);
    return room;
  },

  async deleteHotelRoom(id: number, userId = 1) {
    if (!store.hotel_rooms) return false;
    const idx = store.hotel_rooms.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const [deleted] = store.hotel_rooms.splice(idx, 1);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query('UPDATE hotel_bookings SET room_type_id = NULL WHERE room_type_id = ?', [id]).catch(() => {});
      await activePool.query('DELETE FROM hotel_rooms WHERE id = ?', [id]);
    });

    this.logActivity(userId, 'DELETE_HOTEL_ROOM', 'HOTEL', deleted.hotel_id, `Deleted room type "${deleted.name}"`);
    return true;
  },

  // --------------------------------------------------------------------------
  // Hotel Bookings & Customer Assignments
  // --------------------------------------------------------------------------
  getHotelBookings(filters?: { clientId?: number; hotelId?: number; status?: string; search?: string }) {
    if (!store.hotel_bookings) store.hotel_bookings = [];
    let list = [...store.hotel_bookings];

    const clientById = new Map<number, Client>();
    for (const c of store.clients) clientById.set(c.id, c);

    const hotelById = new Map<number, Hotel>();
    for (const h of store.hotels || []) hotelById.set(h.id, h);

    const userById = new Map<number, User>();
    for (const u of store.users) userById.set(u.id, u);

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
        const client = clientById.get(b.client_id);
        const hotel = hotelById.get(b.hotel_id);
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
      const client = clientById.get(b.client_id);
      const hotel = hotelById.get(b.hotel_id);
      const user = b.created_by_user_id ? userById.get(b.created_by_user_id) : null;

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
    total_price?: number | string | null;
    price_details?: string | null;
    currency?: string;
  }, userId = 1) {
    if (!store.hotel_bookings) store.hotel_bookings = [];

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

    const id = nextEntityId('hotel_bookings', store.hotel_bookings);
    const refNum = `HB-${String(id).padStart(6, '0')}`;
    const now = new Date().toISOString();

    // Parse price expression (supports e.g. "200 + 100 + 50")
    const parsePriceFields = (rawTotal: any, rawDetails: any): { total_price: number | null; price_details: string | null } => {
      const exprSource = rawDetails !== undefined && rawDetails !== null && String(rawDetails).trim() !== ''
        ? String(rawDetails).trim()
        : (rawTotal !== undefined && rawTotal !== null && String(rawTotal).trim() !== '' ? String(rawTotal).trim() : '');
      if (!exprSource) {
        return { total_price: null, price_details: null };
      }
      const segments = exprSource.split('+').map(s => s.trim()).filter(Boolean);
      const amounts: number[] = [];
      for (const seg of segments) {
        const m = seg.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
        if (m) {
          const val = parseFloat(m[0]);
          if (!isNaN(val)) amounts.push(val);
        }
      }
      const computedSum = amounts.length > 0
        ? Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100
        : (rawTotal !== undefined && rawTotal !== null && !isNaN(Number(rawTotal)) ? Number(rawTotal) : null);
      return {
        total_price: computedSum,
        price_details: segments.join(' + ') || exprSource,
      };
    };

    const resolvedPrice = parsePriceFields(data.total_price, data.price_details);

    // AUTOMATIC TASK CREATION: Create a task for staff on the check-out date!
    const checkoutTaskId = nextEntityId('tasks', store.tasks);
    const taskTitle = `Hotel Check-Out: ${client.full_name} (${hotel.name})`;
    const taskDesc = `Scheduled checkout at ${hotel.name}${roomName ? ` [${roomName}]` : ''}.\nCheck-in: ${data.check_in_date} → Check-out: ${data.check_out_date}.\nClient: ${client.full_name} (${client.passport_number}).${data.comment ? `\nComment/Notes: ${data.comment}` : ''}`;

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
      total_price: resolvedPrice.total_price,
      price_details: resolvedPrice.price_details,
      currency: data.currency ? data.currency.trim().toUpperCase() : 'MYR',
      checkout_task_id: checkoutTaskId,
      created_by_user_id: userId,
      created_at: now,
      updated_at: now,
    };

    store.hotel_bookings.push(booking);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO tasks (id, title, description, client_id, application_id, assigned_user_id, due_date, priority, status, is_delivery_task, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, 'High', 'Pending', 0, NOW(), NOW())
         ON DUPLICATE KEY UPDATE title = VALUES(title), due_date = VALUES(due_date), updated_at = NOW()`,
        [checkoutTaskId, taskTitle, taskDesc, client.id, userId || 1, data.check_out_date]
      );

      try {
        await activePool.query(
          `INSERT INTO hotel_bookings (id, booking_reference, client_id, hotel_id, room_type_id, room_type_name, check_in_date, check_out_date, guest_count, room_count, status, comment, special_requests, total_price, price_details, currency, checkout_task_id, created_by_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             booking_reference = VALUES(booking_reference), status = VALUES(status),
             total_price = VALUES(total_price), price_details = VALUES(price_details),
             check_in_date = VALUES(check_in_date), check_out_date = VALUES(check_out_date), updated_at = NOW()`,
          [
            booking.id,
            booking.booking_reference,
            booking.client_id,
            booking.hotel_id,
            booking.room_type_id,
            booking.room_type_name,
            booking.check_in_date,
            booking.check_out_date,
            booking.guest_count,
            booking.room_count,
            booking.status,
            booking.comment,
            booking.special_requests,
            booking.total_price,
            booking.price_details,
            booking.currency,
            booking.checkout_task_id,
            booking.created_by_user_id,
          ]
        );
      } catch {
        await activePool.query(
          `INSERT INTO hotel_bookings (id, booking_reference, client_id, hotel_id, room_type_id, room_type_name, check_in_date, check_out_date, guest_count, room_count, status, comment, special_requests, total_price, currency, checkout_task_id, created_by_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             booking_reference = VALUES(booking_reference), status = VALUES(status),
             total_price = VALUES(total_price),
             check_in_date = VALUES(check_in_date), check_out_date = VALUES(check_out_date), updated_at = NOW()`,
          [
            booking.id,
            booking.booking_reference,
            booking.client_id,
            booking.hotel_id,
            booking.room_type_id,
            booking.room_type_name,
            booking.check_in_date,
            booking.check_out_date,
            booking.guest_count,
            booking.room_count,
            booking.status,
            booking.comment,
            booking.special_requests,
            booking.total_price,
            booking.currency,
            booking.checkout_task_id,
            booking.created_by_user_id,
          ]
        );
      }
    });

    this.logActivity(
      userId,
      'CREATE_HOTEL_BOOKING',
      'HOTEL',
      id,
      `Assigned hotel "${hotel.name}" to client ${client.full_name} (${data.check_in_date} to ${data.check_out_date}). Check-out task created on ${data.check_out_date}.`
    );

    return this.getHotelBookingById(id);
  },

  async updateHotelBooking(id: number, data: Partial<HotelBooking> & { total_price?: number | string | null; price_details?: string | null }, userId = 1) {
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

    if (data.price_details !== undefined || data.total_price !== undefined) {
      const exprSource = data.price_details !== undefined && data.price_details !== null
        ? String(data.price_details).trim()
        : (data.total_price !== undefined && data.total_price !== null ? String(data.total_price).trim() : '');
      if (!exprSource) {
        booking.total_price = null;
        booking.price_details = null;
      } else {
        const segments = exprSource.split('+').map(s => s.trim()).filter(Boolean);
        const amounts: number[] = [];
        for (const seg of segments) {
          const m = seg.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
          if (m) {
            const val = parseFloat(m[0]);
            if (!isNaN(val)) amounts.push(val);
          }
        }
        booking.total_price = amounts.length > 0
          ? Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100
          : (data.total_price !== undefined && data.total_price !== null && !isNaN(Number(data.total_price)) ? Number(data.total_price) : null);
        booking.price_details = segments.join(' + ') || exprSource;
      }
    }

    if (data.currency !== undefined) booking.currency = data.currency ? data.currency.trim().toUpperCase() : 'MYR';

    booking.updated_at = new Date().toISOString();

    // If check-out date changed, update the associated task's due_date
    if (booking.checkout_task_id && data.check_out_date && data.check_out_date !== oldCheckoutDate) {
      const task = store.tasks.find(t => t.id === booking.checkout_task_id);
      if (task) {
        task.due_date = data.check_out_date;
        task.updated_at = new Date().toISOString();
      }
    }

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      try {
        await activePool.query(
          `UPDATE hotel_bookings SET hotel_id = ?, room_type_id = ?, room_type_name = ?, check_in_date = ?, check_out_date = ?, guest_count = ?, room_count = ?, status = ?, comment = ?, special_requests = ?, total_price = ?, price_details = ?, currency = ?, updated_at = NOW() WHERE id = ?`,
          [booking.hotel_id, booking.room_type_id, booking.room_type_name, booking.check_in_date, booking.check_out_date, booking.guest_count, booking.room_count, booking.status, booking.comment, booking.special_requests, booking.total_price, booking.price_details || null, booking.currency, id]
        );
      } catch {
        await activePool.query(
          `UPDATE hotel_bookings SET hotel_id = ?, room_type_id = ?, room_type_name = ?, check_in_date = ?, check_out_date = ?, guest_count = ?, room_count = ?, status = ?, comment = ?, special_requests = ?, total_price = ?, currency = ?, updated_at = NOW() WHERE id = ?`,
          [booking.hotel_id, booking.room_type_id, booking.room_type_name, booking.check_in_date, booking.check_out_date, booking.guest_count, booking.room_count, booking.status, booking.comment, booking.special_requests, booking.total_price, booking.currency, id]
        );
      }
      if (booking.checkout_task_id && data.check_out_date && data.check_out_date !== oldCheckoutDate) {
        await activePool.query('UPDATE tasks SET due_date = ?, updated_at = NOW() WHERE id = ?', [data.check_out_date, booking.checkout_task_id]);
      }
    });

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

    runMySQLWrite(async (activePool) => {
      if (booking.checkout_task_id) {
        await activePool.query('DELETE FROM tasks WHERE id = ? AND status = "Pending"', [booking.checkout_task_id]).catch(() => {});
      }
      await activePool.query('DELETE FROM hotel_bookings WHERE id = ?', [id]);
    });

    this.logActivity(userId, 'DELETE_HOTEL_BOOKING', 'HOTEL', id, `Deleted hotel booking ${booking.booking_reference}`);
    return true;
  },

  // --------------------------------------------------------------------------
  // Recurring Visa Follow-up System (Client messaging & tasks)
  // --------------------------------------------------------------------------
  getFollowUps(filters?: { clientId?: number; status?: string; cadence?: string; search?: string }) {
    if (!store.follow_ups) store.follow_ups = [];
    let list = [...store.follow_ups];

    const clientById = new Map<number, Client>();
    for (const c of store.clients) clientById.set(c.id, c);

    const userById = new Map<number, User>();
    for (const u of store.users) userById.set(u.id, u);

    if (filters?.clientId) {
      list = list.filter(f => f.client_id === filters.clientId);
    }
    if (filters?.status && filters.status !== 'all') {
      list = list.filter(f => f.status === filters.status);
    }
    if (filters?.cadence && filters.cadence !== 'all') {
      list = list.filter(f => f.cadence === filters.cadence);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(f => {
        const client = clientById.get(f.client_id);
        return (
          f.title.toLowerCase().includes(q) ||
          f.reason.toLowerCase().includes(q) ||
          (f.notes && f.notes.toLowerCase().includes(q)) ||
          (client && (
            client.full_name.toLowerCase().includes(q) ||
            client.passport_number.toLowerCase().includes(q) ||
            client.client_id.toLowerCase().includes(q) ||
            (client.phone && client.phone.toLowerCase().includes(q)) ||
            (client.whatsapp && client.whatsapp.toLowerCase().includes(q))
          ))
        );
      });
    }

    return list.map(f => {
      const client = clientById.get(f.client_id);
      const assignedUser = f.assigned_user_id ? userById.get(f.assigned_user_id) : null;
      const createdUser = f.created_by_user_id ? userById.get(f.created_by_user_id) : null;

      return {
        ...f,
        client_name: client?.full_name || 'Unknown Client',
        client_code: client?.client_id || '',
        passport_number: client?.passport_number || '',
        client_phone: client?.phone || null,
        client_whatsapp: client?.whatsapp || null,
        client_photo_url: client?.photo_url || null,
        assigned_user_name: assignedUser?.name || null,
        created_by_user_name: createdUser?.name || null,
      };
    }).sort((a, b) => {
      const aComp = a.status === 'Completed' ? 1 : 0;
      const bComp = b.status === 'Completed' ? 1 : 0;
      if (aComp !== bComp) return aComp - bComp;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  },

  getFollowUpById(id: number) {
    if (!store.follow_ups) return null;
    const f = store.follow_ups.find(item => Number(item.id) === Number(id));
    if (!f) return null;
    const client = store.clients.find(c => c.id === f.client_id);
    const assignedUser = f.assigned_user_id ? store.users.find(u => u.id === f.assigned_user_id) : null;
    const createdUser = f.created_by_user_id ? store.users.find(u => u.id === f.created_by_user_id) : null;

    return {
      ...f,
      client_name: client?.full_name || 'Unknown Client',
      client_code: client?.client_id || '',
      passport_number: client?.passport_number || '',
      client_phone: client?.phone || null,
      client_whatsapp: client?.whatsapp || null,
      client_photo_url: client?.photo_url || null,
      assigned_user_name: assignedUser?.name || null,
      created_by_user_name: createdUser?.name || null,
    };
  },

  async createFollowUp(data: {
    client_id: number;
    title?: string;
    reason: string;
    channel?: 'WhatsApp' | 'Phone Call' | 'WeChat' | 'Email' | 'SMS';
    cadence?: '1 Month' | '2 Months' | '3 Months' | '6 Months' | 'One-time';
    due_date: string;
    notes?: string | null;
    message_template?: string | null;
    priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
    assigned_user_id?: number | null;
  }, userId = 1) {
    if (!store.follow_ups) store.follow_ups = [];

    const client = store.clients.find(c => c.id === data.client_id);
    if (!client) throw new Error('Client not found');

    const channel = data.channel || 'WhatsApp';
    const cadence = data.cadence || '1 Month';
    const reason = data.reason || 'Recurring Visa Renewal Check';
    const priority = data.priority || 'Normal';
    const title = data.title && data.title.trim() ? data.title.trim() : `${channel}: ${reason}`;
    const now = new Date().toISOString();

    const id = nextEntityId('follow_ups', store.follow_ups);

    // AUTOMATIC TASK CREATION: Follow-ups are automatically added as tasks on the calendar!
    const taskId = nextEntityId('tasks', store.tasks);
    const taskTitle = `[Follow-up] ${client.full_name}: ${title}`;
    const taskDesc = `Channel: ${channel} | Cadence: ${cadence}\nReason: ${reason}\nClient: ${client.full_name} (${client.passport_number})\nContact: ${client.whatsapp || client.phone || 'N/A'}${data.notes ? `\nNotes: ${data.notes}` : ''}${data.message_template ? `\nSuggested Message:\n${data.message_template}` : ''}`;

    const linkedTask: Task = {
      id: taskId,
      title: taskTitle,
      description: taskDesc,
      client_id: client.id,
      application_id: null,
      assigned_user_id: data.assigned_user_id || userId || 1,
      due_date: data.due_date,
      priority,
      status: 'Pending',
      is_delivery_task: 0,
      completed_at: null,
      created_at: now,
      updated_at: now,
    };
    store.tasks.push(linkedTask);

    const followUp: FollowUp = {
      id,
      client_id: data.client_id,
      title,
      reason,
      channel,
      cadence,
      due_date: data.due_date,
      notes: data.notes ? data.notes.trim() : null,
      message_template: data.message_template ? data.message_template.trim() : null,
      status: 'Pending',
      priority,
      task_id: taskId,
      assigned_user_id: data.assigned_user_id || userId || 1,
      completed_at: null,
      completed_notes: null,
      created_by_user_id: userId,
      created_at: now,
      updated_at: now,
    };

    store.follow_ups.push(followUp);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO tasks (id, title, description, client_id, application_id, assigned_user_id, due_date, priority, status, is_delivery_task, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'Pending', 0, NOW(), NOW())
         ON DUPLICATE KEY UPDATE title = VALUES(title), due_date = VALUES(due_date), updated_at = NOW()`,
        [taskId, taskTitle, taskDesc, client.id, data.assigned_user_id || userId || 1, data.due_date, priority]
      );

      await activePool.query(
        `INSERT INTO follow_ups (id, client_id, title, reason, channel, cadence, due_date, notes, message_template, status, priority, task_id, assigned_user_id, created_by_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           title = VALUES(title), due_date = VALUES(due_date), status = VALUES(status), updated_at = NOW()`,
        [
          followUp.id,
          followUp.client_id,
          followUp.title,
          followUp.reason,
          followUp.channel,
          followUp.cadence,
          followUp.due_date,
          followUp.notes,
          followUp.message_template,
          followUp.priority,
          followUp.task_id,
          followUp.assigned_user_id,
          followUp.created_by_user_id,
        ]
      );
    });

    this.logActivity(
      userId,
      'CREATE_FOLLOW_UP',
      'FOLLOW_UP',
      id,
      `Scheduled follow-up with ${client.full_name} (${cadence} via ${channel}) due on ${data.due_date}`
    );

    return this.getFollowUpById(id);
  },

  async updateFollowUp(id: number, data: Partial<FollowUp>, userId = 1) {
    if (!store.follow_ups) return null;
    const fu = store.follow_ups.find(f => Number(f.id) === Number(id));
    if (!fu) return null;

    if (data.title !== undefined) fu.title = data.title.trim();
    if (data.reason !== undefined) fu.reason = data.reason.trim();
    if (data.channel !== undefined) fu.channel = data.channel;
    if (data.cadence !== undefined) fu.cadence = data.cadence;
    if (data.due_date !== undefined) fu.due_date = data.due_date;
    if (data.notes !== undefined) fu.notes = data.notes?.trim() || null;
    if (data.message_template !== undefined) fu.message_template = data.message_template?.trim() || null;
    if (data.priority !== undefined) fu.priority = data.priority;
    if (data.assigned_user_id !== undefined) fu.assigned_user_id = data.assigned_user_id;

    if (data.status !== undefined) {
      fu.status = data.status;
      fu.completed_at = data.status === 'Completed' ? (fu.completed_at || new Date().toISOString()) : null;
    }
    if (data.completed_notes !== undefined) fu.completed_notes = data.completed_notes?.trim() || null;
    fu.updated_at = new Date().toISOString();

    // Synchronize linked task in tasks table
    if (fu.task_id) {
      const task = store.tasks.find(t => t.id === fu.task_id);
      if (task) {
        if (data.due_date) task.due_date = data.due_date;
        if (data.priority) task.priority = data.priority;
        if (data.assigned_user_id !== undefined) task.assigned_user_id = data.assigned_user_id;
        if (data.status !== undefined) {
          task.status = data.status === 'Completed' ? 'Completed' : 'Pending';
          task.completed_at = data.status === 'Completed' ? (task.completed_at || new Date().toISOString()) : null;
        }
        task.updated_at = new Date().toISOString();
      }
    }

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `UPDATE follow_ups SET
          title = ?, reason = ?, channel = ?, cadence = ?, due_date = ?,
          notes = ?, message_template = ?, status = ?, priority = ?,
          assigned_user_id = ?, completed_at = ?, completed_notes = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          fu.title,
          fu.reason,
          fu.channel,
          fu.cadence,
          fu.due_date,
          fu.notes,
          fu.message_template,
          fu.status,
          fu.priority,
          fu.assigned_user_id,
          fu.completed_at ? new Date(fu.completed_at) : null,
          fu.completed_notes,
          id,
        ]
      );

      if (fu.task_id) {
        await activePool.query(
          `UPDATE tasks SET due_date = ?, priority = ?, status = ?, completed_at = ?, updated_at = NOW() WHERE id = ?`,
          [
            fu.due_date,
            fu.priority,
            fu.status === 'Completed' ? 'Completed' : 'Pending',
            fu.completed_at ? new Date(fu.completed_at) : null,
            fu.task_id,
          ]
        ).catch(() => {});
      }
    });

    this.logActivity(userId, 'UPDATE_FOLLOW_UP', 'FOLLOW_UP', id, `Updated follow-up: ${fu.title} (${fu.status})`);
    return this.getFollowUpById(id);
  },

  async completeFollowUp(id: number, data?: {
    completed_notes?: string;
    schedule_next?: boolean;
    next_cadence?: '1 Month' | '2 Months' | '3 Months' | '6 Months' | 'One-time';
    next_due_date?: string;
  }, userId = 1) {
    const updated = await this.updateFollowUp(id, {
      status: 'Completed',
      completed_notes: data?.completed_notes || 'Follow-up marked completed by staff.',
    }, userId);

    if (!updated) return null;

    let nextFollowUp = null;
    if (data?.schedule_next) {
      const targetCadence = data.next_cadence || updated.cadence || '1 Month';
      let nextDate = data.next_due_date;
      if (!nextDate) {
        const baseDate = new Date(updated.due_date || new Date().toISOString());
        if (isNaN(baseDate.getTime())) {
          baseDate.setTime(Date.now());
        }
        if (targetCadence === '1 Month') {
          baseDate.setDate(baseDate.getDate() + 30);
        } else if (targetCadence === '2 Months') {
          baseDate.setDate(baseDate.getDate() + 60);
        } else if (targetCadence === '3 Months') {
          baseDate.setDate(baseDate.getDate() + 90);
        } else if (targetCadence === '6 Months') {
          baseDate.setDate(baseDate.getDate() + 180);
        } else {
          baseDate.setDate(baseDate.getDate() + 30);
        }
        nextDate = baseDate.toISOString().split('T')[0];
      }

      nextFollowUp = await this.createFollowUp({
        client_id: updated.client_id,
        title: updated.title,
        reason: updated.reason,
        channel: updated.channel,
        cadence: targetCadence,
        due_date: nextDate,
        notes: updated.notes,
        message_template: updated.message_template,
        priority: updated.priority,
        assigned_user_id: updated.assigned_user_id,
      }, userId);
    }

    return {
      completed_follow_up: updated,
      next_follow_up: nextFollowUp,
    };
  },

  async deleteFollowUp(id: number, userId = 1) {
    if (!store.follow_ups) store.follow_ups = [];
    const numId = Number(id);
    if (isNaN(numId)) return false;

    const idx = store.follow_ups.findIndex(f => Number(f.id) === numId);
    const fu = idx !== -1 ? store.follow_ups[idx] : null;
    const taskId = fu ? fu.task_id : null;
    const title = fu ? fu.title : `Follow-up #${numId}`;

    if (idx !== -1) {
      store.follow_ups.splice(idx, 1);
    }

    if (taskId) {
      const taskIdx = store.tasks.findIndex(t => Number(t.id) === Number(taskId));
      if (taskIdx !== -1) {
        store.tasks.splice(taskIdx, 1);
      }
    }

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      if (taskId) {
        await activePool.query('DELETE FROM tasks WHERE id = ?', [taskId]).catch(() => {});
      }
      await activePool.query('DELETE FROM follow_ups WHERE id = ?', [numId]);
    });

    this.logActivity(userId, 'DELETE_FOLLOW_UP', 'FOLLOW_UP', numId, `Deleted follow-up: ${title}`);
    return true;
  },

  // Dashboard Statistics
  getDashboardMetrics() {
    const today = new Date().toISOString().split('T')[0];

    const totalClients = store.clients.length;
    let activeApplications = 0;

    const clientById = new Map<number, Client>();
    for (const c of store.clients) clientById.set(c.id, c);

    const vtById = new Map<number, VisaType>();
    for (const vt of store.visa_types) vtById.set(vt.id, vt);

    const attentionSet = new Set(['File Missing', 'Need to Prepare', 'Modify', 'Rejected']);
    const appsRequiringAttention: any[] = [];
    const latestAppByClient = new Map<number, VisaApplication>();

    for (const a of store.visa_applications) {
      if (a.status !== 'Rejected' && a.status !== 'Returned') {
        activeApplications++;
      }
      const prevApp = latestAppByClient.get(a.client_id);
      if (!prevApp || Number(a.id) >= Number(prevApp.id)) {
        latestAppByClient.set(a.client_id, a);
      }
      if (attentionSet.has(a.status)) {
        const client = clientById.get(a.client_id);
        const vt = vtById.get(a.visa_type_id);
        appsRequiringAttention.push({
          ...a,
          client_name: client?.full_name || 'Client',
          passport_number: client?.passport_number || '',
          visa_type_name: vt?.name || '',
        });
      }
    }

    let todayTasks = 0;
    let overdueTasks = 0;
    let upcomingTasks = 0;
    for (const t of store.tasks) {
      if (t.status !== 'Pending') continue;
      const due = t.due_date ? String(t.due_date).slice(0, 10) : '';
      if (!due) continue;
      if (due === today) todayTasks++;
      else if (due < today) overdueTasks++;
      else upcomingTasks++;
    }

    const extractSerial = (c: Client): number => {
      const raw = String(c.client_id || '').trim();
      if (/^\d+$/.test(raw)) return parseInt(raw, 10);
      const m = raw.match(/\d+/g);
      if (m && m.length > 0) {
        const n = parseInt(m[m.length - 1], 10);
        if (!isNaN(n)) return n;
      }
      return Number(c.id) || 0;
    };

    const recentClients = [...store.clients]
      .sort(
        (a, b) =>
          extractSerial(b) - extractSerial(a) ||
          Number(b.id) - Number(a.id) ||
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
      .slice(0, 6)
      .map(c => ({
        ...c,
        active_status: latestAppByClient.get(c.id)?.status || 'New',
      }));

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
      follow_ups?: boolean;
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
    let matchingFollowUps = 0;
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

    if (targets.follow_ups) {
      matchingFollowUps = (store.follow_ups || []).filter(
        f => isDateInRange(f.created_at) || isDateInRange(f.due_date) || isDateInRange(f.completed_at)
      ).length;
    }

    if (targets.status_history) {
      matchingHistory = (store.application_status_history || []).filter(h => isDateInRange(h.created_at || (h as any).changed_at)).length;
    }

    if (targets.activity_logs) {
      matchingLogs = (store.activity_logs || []).filter(l => isDateInRange(l.created_at)).length;
    }

    const totalToDelete = matchingApps + matchingBookings + matchingTasks + matchingFollowUps + matchingHistory + matchingLogs;

    return {
      date_range: {
        start_date: normStartDate || 'Beginning of time',
        end_date: normEndDate || 'Latest record',
      },
      counts: {
        applications: matchingApps,
        hotel_bookings: matchingBookings,
        tasks: matchingTasks,
        follow_ups: matchingFollowUps,
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
        follow_ups: (store.follow_ups || []).length,
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
        follow_ups?: boolean;
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
    let deletedFollowUpsCount = 0;
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
        store.comments = (store.comments || []).filter(c => !c.application_id || !deletedAppIds.has(c.application_id));
        store.application_status_history = (store.application_status_history || []).filter(h => !deletedAppIds.has(h.application_id));
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
      const deletedTaskIds = new Set<number>();
      for (const task of store.tasks || []) {
        if (isDateInRange(task.created_at) || isDateInRange(task.due_date)) {
          deletedTasksCount++;
          deletedTaskIds.add(Number(task.id));
        } else {
          tasksToKeep.push(task);
        }
      }
      store.tasks = tasksToKeep;

      if (store.follow_ups && deletedTaskIds.size > 0) {
        store.follow_ups.forEach(f => {
          if (f.task_id && deletedTaskIds.has(Number(f.task_id))) {
            f.task_id = null;
          }
        });
      }
    }

    // 4. Purge Follow-up Reminders & History in Date Range
    if (targets.follow_ups) {
      const followUpsToKeep: FollowUp[] = [];
      const deletedFollowUpTaskIds = new Set<number>();

      for (const fu of store.follow_ups || []) {
        if (
          isDateInRange(fu.created_at) ||
          isDateInRange(fu.due_date) ||
          isDateInRange(fu.completed_at)
        ) {
          deletedFollowUpsCount++;
          if (fu.task_id) {
            deletedFollowUpTaskIds.add(Number(fu.task_id));
          }
        } else {
          followUpsToKeep.push(fu);
        }
      }

      store.follow_ups = followUpsToKeep;

      if (deletedFollowUpTaskIds.size > 0) {
        store.tasks = (store.tasks || []).filter(t => !deletedFollowUpTaskIds.has(Number(t.id)));
      }
    }

    // 5. Purge Status Audit History in Date Range
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

    // 6. Purge Activity Logs in Date Range
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

    runMySQLWrite(async (activePool) => {
      try {
        await activePool.query('SET FOREIGN_KEY_CHECKS = 0').catch(() => {});
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
            await activePool.query(`DELETE FROM application_status_history WHERE application_id IN (SELECT id FROM visa_applications WHERE created_at ${dateCondition})`, params).catch(() => {});
            await activePool.query(`DELETE FROM tasks WHERE application_id IN (SELECT id FROM visa_applications WHERE created_at ${dateCondition})`, params).catch(() => {});
            await activePool.query(`DELETE FROM comments WHERE application_id IN (SELECT id FROM visa_applications WHERE created_at ${dateCondition})`, params).catch(() => {});
            await activePool.query(`DELETE FROM visa_applications WHERE created_at ${dateCondition}`, params).catch(() => {});
          } else {
            await activePool.query('DELETE FROM application_status_history').catch(() => {});
            await activePool.query('DELETE FROM comments WHERE application_id IS NOT NULL').catch(() => {});
            await activePool.query('DELETE FROM visa_applications').catch(() => {});
          }
        }
        if (targets.hotel_bookings) {
          if (dateCondition) {
            await activePool.query(`DELETE FROM hotel_bookings WHERE created_at ${dateCondition}`, params).catch(() => {});
          } else {
            await activePool.query('DELETE FROM hotel_bookings').catch(() => {});
          }
        }
        if (targets.tasks) {
          if (dateCondition) {
            await activePool.query(`DELETE FROM tasks WHERE due_date ${dateCondition}`, params).catch(() => {});
          } else {
            await activePool.query('DELETE FROM tasks').catch(() => {});
          }
        }
        if (targets.follow_ups) {
          if (normStartDate && normEndDate) {
            await activePool.query(
              'DELETE FROM follow_ups WHERE (created_at BETWEEN ? AND ?) OR (due_date BETWEEN ? AND ?)',
              [normStartDate, normEndDate + ' 23:59:59', normStartDate, normEndDate + ' 23:59:59']
            ).catch(() => {});
          } else if (normStartDate) {
            await activePool.query(
              'DELETE FROM follow_ups WHERE created_at >= ? OR due_date >= ?',
              [normStartDate, normStartDate]
            ).catch(() => {});
          } else if (normEndDate) {
            await activePool.query(
              'DELETE FROM follow_ups WHERE created_at <= ? OR due_date <= ?',
              [normEndDate + ' 23:59:59', normEndDate + ' 23:59:59']
            ).catch(() => {});
          } else {
            await activePool.query('DELETE FROM follow_ups').catch(() => {});
          }
        }
        if (targets.status_history) {
          if (dateCondition) {
            await activePool.query(`DELETE FROM application_status_history WHERE created_at ${dateCondition}`, params).catch(() => {});
          } else {
            await activePool.query('DELETE FROM application_status_history').catch(() => {});
          }
        }
        if (targets.activity_logs) {
          if (dateCondition) {
            await activePool.query(`DELETE FROM activity_logs WHERE created_at ${dateCondition}`, params).catch(() => {});
          } else {
            await activePool.query('DELETE FROM activity_logs').catch(() => {});
          }
        }
      } finally {
        await activePool.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      }
    });

    const rangeDescription = startDate && endDate
      ? `from ${startDate} to ${endDate}`
      : startDate
      ? `since ${startDate}`
      : endDate
      ? `up to ${endDate}`
      : 'all historical records';

    const totalPurged = deletedAppsCount + deletedBookingsCount + deletedTasksCount + deletedFollowUpsCount + deletedHistoryCount + deletedLogsCount;

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
        follow_ups: deletedFollowUpsCount,
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
        follow_ups: (store.follow_ups || []).length,
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
      const id = nextEntityId('settings', store.settings);
      store.settings.push({
        id,
        setting_key: key,
        setting_value: value,
        updated_at: now,
      });
    }
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        'INSERT INTO `settings` (`setting_key`, `setting_value`, `updated_at`) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`), `updated_at` = NOW()',
        [key, value]
      );
    });
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
    dumpTable('follow_ups', store.follow_ups || []);
    dumpTable('invoice_settings', store.invoice_settings ? [store.invoice_settings] : []);
    dumpTable('invoice_catalog_items', store.invoice_catalog_items || []);
    dumpTable('invoices', store.invoices || []);
    dumpTable('invoice_items', store.invoice_items || []);
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
      follow_ups: number;
      users: number;
    };
  } {
    if (!dumpContent || typeof dumpContent !== 'string') {
      throw new Error('Invalid SQL backup content provided');
    }

    const applyValidatedSnapshot = (parsed: any) => {
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.clients)) {
        return null;
      }

      if (Array.isArray(parsed.users) && parsed.users.length > 0) store.users = parsed.users;
      if (Array.isArray(parsed.countries)) store.countries = parsed.countries;
      if (Array.isArray(parsed.client_custom_fields)) store.client_custom_fields = parsed.client_custom_fields;
      store.clients = parsed.clients;
      if (Array.isArray(parsed.client_custom_field_values)) store.client_custom_field_values = parsed.client_custom_field_values;
      if (Array.isArray(parsed.visa_types)) store.visa_types = parsed.visa_types;
      if (Array.isArray(parsed.visa_applications)) store.visa_applications = parsed.visa_applications;
      if (Array.isArray(parsed.application_status_history)) store.application_status_history = parsed.application_status_history;
      if (Array.isArray(parsed.tasks)) store.tasks = parsed.tasks;
      if (Array.isArray(parsed.follow_ups)) store.follow_ups = parsed.follow_ups;
      if (Array.isArray(parsed.comments)) store.comments = parsed.comments;
      if (Array.isArray(parsed.activity_logs)) store.activity_logs = parsed.activity_logs;
      if (Array.isArray(parsed.hotels)) store.hotels = parsed.hotels;
      if (Array.isArray(parsed.hotel_rooms)) store.hotel_rooms = parsed.hotel_rooms;
      if (Array.isArray(parsed.hotel_bookings)) store.hotel_bookings = parsed.hotel_bookings;
      if (parsed.invoice_settings && typeof parsed.invoice_settings === 'object' && !Array.isArray(parsed.invoice_settings)) {
        store.invoice_settings = { ...store.invoice_settings, ...parsed.invoice_settings };
      }
      if (Array.isArray(parsed.invoice_catalog_items)) store.invoice_catalog_items = parsed.invoice_catalog_items;
      if (Array.isArray(parsed.invoices)) store.invoices = parsed.invoices;
      if (Array.isArray(parsed.invoice_items)) store.invoice_items = parsed.invoice_items;
      if (Array.isArray(parsed.settings)) store.settings = parsed.settings;

      const maxIdOf = (arr?: any[]) =>
        Array.isArray(arr) ? arr.reduce((m, r) => Math.max(m, Number(r?.id) || 0), 0) + 1 : 1;

      store.nextIds = {
        users: maxIdOf(store.users),
        countries: maxIdOf(store.countries),
        clients: maxIdOf(store.clients),
        client_custom_fields: maxIdOf(store.client_custom_fields),
        client_custom_field_values: maxIdOf(store.client_custom_field_values),
        visa_types: maxIdOf(store.visa_types),
        visa_applications: maxIdOf(store.visa_applications),
        application_status_history: maxIdOf(store.application_status_history),
        tasks: maxIdOf(store.tasks),
        comments: maxIdOf(store.comments),
        activity_logs: maxIdOf(store.activity_logs),
        hotels: maxIdOf(store.hotels),
        hotel_rooms: maxIdOf(store.hotel_rooms),
        hotel_bookings: maxIdOf(store.hotel_bookings),
        follow_ups: maxIdOf(store.follow_ups),
        settings: maxIdOf(store.settings),
        invoice_catalog_items: maxIdOf(store.invoice_catalog_items),
        invoices: maxIdOf(store.invoices),
        invoice_items: maxIdOf(store.invoice_items),
      };

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
          follow_ups: (store.follow_ups || []).length,
          users: store.users.length,
        },
      };
    };

    // 1. Check for embedded JSON snapshot for perfect recovery
    const match = dumpContent.match(/-- JSON_SNAPSHOT_START\n-- ([A-Za-z0-9+/=]+)\n-- JSON_SNAPSHOT_END/);
    if (match && match[1]) {
      try {
        const jsonStr = Buffer.from(match[1], 'base64').toString('utf-8');
        const parsed = JSON.parse(jsonStr);
        const res = applyValidatedSnapshot(parsed);
        if (res) return res;
      } catch (err: any) {
        console.warn('[Restore] Failed to restore from JSON snapshot, attempting JSON fallback...', err);
      }
    }

    // 2. Direct JSON format restore if the user provided raw JSON export (strictly validated, no Object.assign)
    if (dumpContent.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(dumpContent);
        const res = applyValidatedSnapshot(parsed);
        if (res) return res;
      } catch {
        // Continue to error
      }
    }

    throw new Error('Unrecognized SQL backup format. Please ensure you upload a valid SN Travels SQL backup file.');
  },

  // --------------------------------------------------------------------------
  // Invoice Settings & Configurable Catalog Management
  // --------------------------------------------------------------------------
  getInvoiceSettings(): InvoiceSettings {
    if (!store.invoice_settings) {
      store.invoice_settings = getInitialData().invoice_settings;
    }
    const prefix = store.invoice_settings.invoice_prefix || 'INV-2026-';
    let nextNum = Number(store.invoice_settings.next_number) || 1001;
    const existingNumbers = new Set((store.invoices || []).map(inv => (inv.invoice_number || '').trim().toUpperCase()));
    while (existingNumbers.has(`${prefix}${nextNum}`.toUpperCase())) {
      nextNum++;
    }
    if (nextNum !== store.invoice_settings.next_number) {
      store.invoice_settings.next_number = nextNum;
      saveStore(store);
    }
    return { ...store.invoice_settings };
  },

  async updateInvoiceSettings(data: Partial<InvoiceSettings>, operatorId?: number): Promise<InvoiceSettings> {
    if (!store.invoice_settings) {
      store.invoice_settings = getInitialData().invoice_settings;
    }
    const updated: InvoiceSettings = {
      ...store.invoice_settings,
      ...data,
      updated_at: new Date().toISOString(),
    };
    store.invoice_settings = updated;
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO invoice_settings (
           id, company_name, company_tagline, logo_url, phone, whatsapp, email, website,
           address, tax_number, bank_details, payment_notes, terms_and_conditions,
           signature_enabled, signature_name, signature_designation, signature_image_url, signature_style,
           default_currency, invoice_prefix, next_number
         )
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           company_name = VALUES(company_name),
           company_tagline = VALUES(company_tagline),
           logo_url = VALUES(logo_url),
           phone = VALUES(phone),
           whatsapp = VALUES(whatsapp),
           email = VALUES(email),
           website = VALUES(website),
           address = VALUES(address),
           tax_number = VALUES(tax_number),
           bank_details = VALUES(bank_details),
           payment_notes = VALUES(payment_notes),
           terms_and_conditions = VALUES(terms_and_conditions),
           signature_enabled = VALUES(signature_enabled),
           signature_name = VALUES(signature_name),
           signature_designation = VALUES(signature_designation),
           signature_image_url = VALUES(signature_image_url),
           signature_style = VALUES(signature_style),
           default_currency = VALUES(default_currency),
           invoice_prefix = VALUES(invoice_prefix),
           next_number = VALUES(next_number)`,
        [
          updated.company_name || 'SN Travels Agency',
          updated.company_tagline || '',
          updated.logo_url || null,
          updated.phone || '',
          updated.whatsapp || '',
          updated.email || '',
          updated.website || '',
          updated.address || '',
          updated.tax_number || null,
          updated.bank_details || '',
          updated.payment_notes || '',
          updated.terms_and_conditions || '',
          updated.signature_enabled !== undefined ? Number(updated.signature_enabled) : 1,
          updated.signature_name ?? 'Sarah Nadeem',
          updated.signature_designation ?? 'Managing Director',
          updated.signature_image_url || null,
          updated.signature_style || 'script',
          updated.default_currency || 'MYR',
          updated.invoice_prefix || 'INV-2026-',
          updated.next_number || 1001,
        ]
      );
    });

    if (operatorId) {
      this.logActivity(
        operatorId,
        'UPDATE_SETTINGS',
        'SYSTEM',
        1,
        'Updated company invoice branding and billing configuration'
      );
    }

    return updated;
  },

  getInvoiceCatalogItems(activeOnly = false): InvoiceCatalogItem[] {
    if (!store.invoice_catalog_items) {
      store.invoice_catalog_items = getInitialData().invoice_catalog_items;
    }
    let list = [...store.invoice_catalog_items];
    if (activeOnly) {
      list = list.filter(item => item.is_active === 1);
    }
    return list.sort((a, b) => (a.display_order || 999) - (b.display_order || 999) || a.id - b.id);
  },

  getInvoiceCatalog(activeOnly = false): InvoiceCatalogItem[] {
    return this.getInvoiceCatalogItems(activeOnly);
  },

  async createInvoiceCatalogItem(data: Omit<InvoiceCatalogItem, 'id' | 'created_at' | 'updated_at'>, operatorId?: number): Promise<InvoiceCatalogItem> {
    if (!store.invoice_catalog_items) {
      store.invoice_catalog_items = getInitialData().invoice_catalog_items;
    }
    const now = new Date().toISOString();
    const id = nextEntityId('invoice_catalog_items', store.invoice_catalog_items);
    const maxOrder = store.invoice_catalog_items.reduce((max, it) => Math.max(max, Number(it.display_order) || 0), 0);
    const desiredOrder =
      data.display_order !== undefined && Number(data.display_order) > 0
        ? Number(data.display_order)
        : maxOrder + 1;

    const newItem: InvoiceCatalogItem = {
      id,
      name: data.name,
      description: data.description || null,
      default_unit_price: Number(data.default_unit_price) || 0,
      category: data.category || 'Visa Services',
      is_active: data.is_active ?? 1,
      display_order: desiredOrder,
      created_at: now,
      updated_at: now,
    };

    store.invoice_catalog_items.push(newItem);
    // Normalize display_order sequence
    const sorted = [...store.invoice_catalog_items].sort((a, b) => {
      if (a.id === newItem.id && b.display_order >= desiredOrder) return -1;
      if (b.id === newItem.id && a.display_order >= desiredOrder) return 1;
      return (a.display_order || 999) - (b.display_order || 999) || a.id - b.id;
    });
    sorted.forEach((it, idx) => {
      it.display_order = idx + 1;
    });
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO invoice_catalog_items (id, name, description, default_unit_price, category, is_active, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), description = VALUES(description),
           default_unit_price = VALUES(default_unit_price), category = VALUES(category),
           is_active = VALUES(is_active), display_order = VALUES(display_order)`,
        [
          newItem.id,
          newItem.name,
          newItem.description,
          newItem.default_unit_price,
          newItem.category,
          newItem.is_active,
          newItem.display_order,
        ]
      );
      if (sorted.length > 0) {
        const cases = sorted.map(() => 'WHEN ? THEN ?').join(' ');
        const ids = sorted.map(it => it.id);
        const params: number[] = [];
        for (const it of sorted) params.push(it.id, it.display_order);
        params.push(...ids);
        await activePool.query(
          `UPDATE invoice_catalog_items SET display_order = CASE id ${cases} END WHERE id IN (${ids.map(() => '?').join(',')})`,
          params
        );
      }
    });

    if (operatorId) {
      this.logActivity(
        operatorId,
        'CREATE',
        'SYSTEM',
        newItem.id,
        `Created new invoice field/service preset: "${newItem.name}"`
      );
    }

    return newItem;
  },

  async reorderInvoiceCatalogItems(orderedIds: number[], operatorId?: number): Promise<InvoiceCatalogItem[]> {
    if (!store.invoice_catalog_items) {
      store.invoice_catalog_items = getInitialData().invoice_catalog_items;
    }

    const idRank = new Map<number, number>();
    orderedIds.forEach((id, idx) => {
      idRank.set(Number(id), idx + 1);
    });

    const sorted = [...store.invoice_catalog_items].sort((a, b) => {
      const rankA = idRank.get(a.id) ?? (a.display_order || 999) + 1000;
      const rankB = idRank.get(b.id) ?? (b.display_order || 999) + 1000;
      return rankA - rankB || a.id - b.id;
    });

    const now = new Date().toISOString();
    sorted.forEach((it, idx) => {
      it.display_order = idx + 1;
      it.updated_at = now;
    });

    store.invoice_catalog_items = sorted;
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      if (sorted.length > 0) {
        const cases = sorted.map(() => 'WHEN ? THEN ?').join(' ');
        const ids = sorted.map(it => it.id);
        const params: number[] = [];
        for (const it of sorted) params.push(it.id, it.display_order);
        params.push(...ids);
        await activePool.query(
          `UPDATE invoice_catalog_items SET display_order = CASE id ${cases} END WHERE id IN (${ids.map(() => '?').join(',')})`,
          params
        );
      }
    });

    if (operatorId) {
      this.logActivity(
        operatorId,
        'UPDATE',
        'SYSTEM',
        1,
        'Reordered invoice quick-add service items'
      );
    }

    return this.getInvoiceCatalogItems(false);
  },

  async updateInvoiceCatalogItem(id: number, data: Partial<InvoiceCatalogItem>, operatorId?: number): Promise<InvoiceCatalogItem | null> {
    if (!store.invoice_catalog_items) store.invoice_catalog_items = [];
    const item = store.invoice_catalog_items.find(i => i.id === id);
    if (!item) return null;

    if (data.name !== undefined) item.name = data.name;
    if (data.description !== undefined) item.description = data.description;
    if (data.default_unit_price !== undefined) item.default_unit_price = Number(data.default_unit_price) || 0;
    if (data.category !== undefined) item.category = data.category;
    if (data.is_active !== undefined) item.is_active = data.is_active;
    if (data.display_order !== undefined) item.display_order = Number(data.display_order) || item.display_order;
    item.updated_at = new Date().toISOString();

    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO invoice_catalog_items (id, name, description, default_unit_price, category, is_active, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description),
           default_unit_price = VALUES(default_unit_price),
           category = VALUES(category),
           is_active = VALUES(is_active),
           display_order = VALUES(display_order)`,
        [
          item.id,
          item.name,
          item.description,
          item.default_unit_price,
          item.category,
          item.is_active,
          item.display_order,
        ]
      );
    });

    if (operatorId) {
      this.logActivity(
        operatorId,
        'UPDATE',
        'SYSTEM',
        item.id,
        `Updated invoice preset field: "${item.name}"`
      );
    }

    return item;
  },

  async deleteInvoiceCatalogItem(id: number, operatorId?: number): Promise<boolean> {
    if (!store.invoice_catalog_items) return false;
    const index = store.invoice_catalog_items.findIndex(i => i.id === id);
    if (index === -1) return false;

    const [deleted] = store.invoice_catalog_items.splice(index, 1);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query('DELETE FROM invoice_catalog_items WHERE id = ?', [id]);
    });

    if (operatorId) {
      this.logActivity(
        operatorId,
        'DELETE',
        'SYSTEM',
        id,
        `Deleted invoice field preset: "${deleted.name}"`
      );
    }

    return true;
  },

  // --------------------------------------------------------------------------
  // Customer Invoices & Items Management
  // --------------------------------------------------------------------------
  getInvoices(filters?: { clientId?: number; status?: string; search?: string }) {
    if (!store.invoices) store.invoices = [];
    if (!store.invoice_items) store.invoice_items = [];

    const clientById = new Map<number, Client>();
    for (const c of store.clients) clientById.set(c.id, c);

    const userById = new Map<number, User>();
    for (const u of store.users) userById.set(u.id, u);

    const itemsByInvoiceId = new Map<number, InvoiceItem[]>();
    for (const it of store.invoice_items) {
      let arr = itemsByInvoiceId.get(it.invoice_id);
      if (!arr) {
        arr = [];
        itemsByInvoiceId.set(it.invoice_id, arr);
      }
      arr.push(it);
    }

    let list = store.invoices.map(inv => {
      const client = clientById.get(inv.client_id);
      const items = itemsByInvoiceId.get(inv.id) || [];
      const user = inv.created_by_user_id ? userById.get(inv.created_by_user_id) : null;

      return {
        ...inv,
        client_name: client?.full_name || 'Unknown Client',
        client_photo_url: client?.photo_url || null,
        client_passport: client?.passport_number || '',
        client_phone: client?.phone || client?.whatsapp || '',
        client_email: client?.email || '',
        client_address: client?.address || '',
        client_country: client?.country || '',
        client_code: client?.client_id || '',
        created_by_user_name: user?.name || null,
        items,
      };
    });

    if (filters?.clientId) {
      list = list.filter(inv => inv.client_id === filters.clientId);
    }
    if (filters?.status && filters.status !== 'all') {
      list = list.filter(inv => inv.status.toLowerCase() === filters.status!.toLowerCase());
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(inv =>
        inv.invoice_number.toLowerCase().includes(q) ||
        (inv.client_name && inv.client_name.toLowerCase().includes(q)) ||
        (inv.client_passport && inv.client_passport.toLowerCase().includes(q)) ||
        (inv.client_code && inv.client_code.toLowerCase().includes(q)) ||
        (inv.notes && inv.notes.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getInvoiceById(id: number) {
    if (!store.invoices) return null;
    const inv = store.invoices.find(i => i.id === id);
    if (!inv) return null;

    const client = store.clients.find(c => c.id === inv.client_id);
    const items = (store.invoice_items || []).filter(it => it.invoice_id === inv.id);
    const user = inv.created_by_user_id ? store.users.find(u => u.id === inv.created_by_user_id) : null;

    return {
      ...inv,
      client_name: client?.full_name || 'Unknown Client',
      client_photo_url: client?.photo_url || null,
      client_passport: client?.passport_number || '',
      client_phone: client?.phone || client?.whatsapp || '',
      client_email: client?.email || '',
      client_address: client?.address || '',
      client_country: client?.country || '',
      client_code: client?.client_id || '',
      created_by_user_name: user?.name || null,
      items,
    };
  },

  async createInvoice(data: any, operatorId?: number): Promise<any> {
    if (!store.invoices) store.invoices = [];
    if (!store.invoice_items) store.invoice_items = [];
    if (!store.invoice_settings) store.invoice_settings = getInitialData().invoice_settings;

    const now = new Date().toISOString();
    const id = nextEntityId('invoices', store.invoices);

    // Generate or validate unique Invoice Number and advance next_number
    const prefix = store.invoice_settings.invoice_prefix || 'INV-2026-';
    let nextNum = Number(store.invoice_settings.next_number) || 1001;
    const existingNumbers = new Set((store.invoices || []).map(inv => (inv.invoice_number || '').trim().toUpperCase()));

    let invoiceNumber = typeof data.invoice_number === 'string' ? data.invoice_number.trim() : '';
    if (!invoiceNumber || existingNumbers.has(invoiceNumber.toUpperCase())) {
      while (existingNumbers.has(`${prefix}${nextNum}`.toUpperCase())) {
        nextNum++;
      }
      invoiceNumber = `${prefix}${nextNum}`;
      store.invoice_settings.next_number = nextNum + 1;
    } else {
      const trailingDigitsMatch = invoiceNumber.match(/(\d+)$/);
      if (trailingDigitsMatch) {
        const usedNum = parseInt(trailingDigitsMatch[1], 10);
        if (!isNaN(usedNum) && usedNum >= nextNum) {
          store.invoice_settings.next_number = usedNum + 1;
        }
      }
    }

    const itemsInput: any[] = Array.isArray(data.items) ? data.items : [];
    const maxItemId = store.invoice_items.reduce((max, it) => Math.max(max, Number(it.id) || 0), 0);
    let nextItemId = Math.max(Number(store.nextIds.invoice_items) || 1, maxItemId + 1);

    let calculatedSubtotal = 0;
    const preparedItems: InvoiceItem[] = itemsInput.map((it) => {
      const itemId = nextItemId++;
      const qty = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Math.max(0, Number(it.unit_price) || 0);
      const lineTotal = Number((qty * unitPrice).toFixed(2));
      calculatedSubtotal += lineTotal;

      return {
        id: itemId,
        invoice_id: id,
        catalog_item_id: it.catalog_item_id ? Number(it.catalog_item_id) : null,
        description: it.description || 'Service Fee',
        quantity: qty,
        unit_price: unitPrice,
        total: lineTotal,
      };
    });
    store.nextIds.invoice_items = nextItemId;

    const subtotal = data.subtotal !== undefined ? Number(data.subtotal) : Number(calculatedSubtotal.toFixed(2));
    const discount = Math.max(0, Number(data.discount) || 0);
    const taxRate = Math.max(0, Number(data.tax_rate) || 0);
    const afterDiscount = Math.max(0, subtotal - discount);
    const taxAmount = Number(((afterDiscount * taxRate) / 100).toFixed(2));
    const totalAmount = Number((afterDiscount + taxAmount).toFixed(2));

    let status = data.status || 'Pending';
    let paidAmount = Math.max(0, Number(data.paid_amount) || 0);

    if (status === 'Paid') {
      paidAmount = totalAmount;
    } else if (status === 'Pending' || status === 'Cancelled') {
      if (data.status === 'Pending' || data.status === 'Cancelled') {
        paidAmount = 0;
      }
    }

    if (status !== 'Cancelled') {
      if (paidAmount >= totalAmount && totalAmount > 0) {
        status = 'Paid';
        paidAmount = totalAmount;
      } else if (paidAmount > 0 && paidAmount < totalAmount) {
        status = 'Partial';
      }
    }

    const balanceDue = status === 'Cancelled' ? 0 : Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));

    const newInvoice: Invoice = {
      id,
      invoice_number: invoiceNumber,
      client_id: Number(data.client_id),
      issue_date: data.issue_date || now.split('T')[0],
      due_date: data.due_date || null,
      status,
      payment_method: data.payment_method || null,
      currency: data.currency || store.invoice_settings.default_currency || 'MYR',
      subtotal,
      discount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      notes: data.notes || null,
      created_by_user_id: operatorId || data.created_by_user_id || null,
      created_at: now,
      updated_at: now,
    };

    store.invoices.unshift(newInvoice);
    preparedItems.forEach(it => store.invoice_items.push(it));
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `INSERT INTO invoices (id, invoice_number, client_id, issue_date, due_date, status, payment_method, currency, subtotal, discount, tax_rate, tax_amount, total_amount, paid_amount, balance_due, notes, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           invoice_number = VALUES(invoice_number), status = VALUES(status),
           total_amount = VALUES(total_amount), paid_amount = VALUES(paid_amount),
           balance_due = VALUES(balance_due)`,
        [
          newInvoice.id,
          newInvoice.invoice_number,
          newInvoice.client_id,
          newInvoice.issue_date,
          newInvoice.due_date,
          newInvoice.status,
          newInvoice.payment_method,
          newInvoice.currency,
          newInvoice.subtotal,
          newInvoice.discount,
          newInvoice.tax_rate,
          newInvoice.tax_amount,
          newInvoice.total_amount,
          newInvoice.paid_amount,
          newInvoice.balance_due,
          newInvoice.notes,
          newInvoice.created_by_user_id,
        ]
      );

      if (preparedItems.length > 0) {
        const placeholders = preparedItems.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatParams = preparedItems.flatMap(it => [
          it.id,
          it.invoice_id,
          it.catalog_item_id,
          it.description,
          it.quantity,
          it.unit_price,
          it.total,
        ]);
        await activePool.query(
          `INSERT INTO invoice_items (id, invoice_id, catalog_item_id, description, quantity, unit_price, total)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE description = VALUES(description), quantity = VALUES(quantity), unit_price = VALUES(unit_price), total = VALUES(total)`,
          flatParams
        );
      }

      await activePool.query(
        'UPDATE invoice_settings SET next_number = ? WHERE id = 1',
        [store.invoice_settings.next_number]
      ).catch(() => {});
    });

    const client = store.clients.find(c => c.id === newInvoice.client_id);
    if (operatorId) {
      this.logActivity(
        operatorId,
        'CREATE',
        'CLIENT',
        newInvoice.client_id,
        `Created invoice ${newInvoice.invoice_number} for ${client?.full_name || 'Client'} (${newInvoice.currency} ${newInvoice.total_amount.toFixed(2)})`
      );
    }

    return this.getInvoiceById(id);
  },

  async updateInvoice(id: number, data: any, operatorId?: number): Promise<any> {
    if (!store.invoices) return null;
    const inv = store.invoices.find(i => i.id === id);
    if (!inv) return null;

    const now = new Date().toISOString();

    if (data.invoice_number !== undefined) inv.invoice_number = data.invoice_number;
    if (data.client_id !== undefined) inv.client_id = Number(data.client_id);
    if (data.issue_date !== undefined) inv.issue_date = data.issue_date;
    if (data.due_date !== undefined) inv.due_date = data.due_date;
    if (data.payment_method !== undefined) inv.payment_method = data.payment_method;
    if (data.currency !== undefined) inv.currency = data.currency;
    if (data.notes !== undefined) inv.notes = data.notes;

    // Handle line items if updated
    if (Array.isArray(data.items)) {
      store.invoice_items = (store.invoice_items || []).filter(it => it.invoice_id !== id);

      const maxItemId = store.invoice_items.reduce((max, it) => Math.max(max, Number(it.id) || 0), 0);
      let nextItemId = Math.max(Number(store.nextIds.invoice_items) || 1, maxItemId + 1);
      let calculatedSubtotal = 0;
      const newItems: InvoiceItem[] = data.items.map((it: any) => {
        const itemId = nextItemId++;
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Math.max(0, Number(it.unit_price) || 0);
        const lineTotal = Number((qty * unitPrice).toFixed(2));
        calculatedSubtotal += lineTotal;

        return {
          id: itemId,
          invoice_id: id,
          catalog_item_id: it.catalog_item_id ? Number(it.catalog_item_id) : null,
          description: it.description || 'Service Fee',
          quantity: qty,
          unit_price: unitPrice,
          total: lineTotal,
        };
      });
      store.nextIds.invoice_items = nextItemId;

      newItems.forEach(it => store.invoice_items.push(it));
      inv.subtotal = Number(calculatedSubtotal.toFixed(2));
    } else if (data.subtotal !== undefined) {
      inv.subtotal = Number(data.subtotal);
    }

    if (data.discount !== undefined) inv.discount = Number(data.discount) || 0;
    if (data.tax_rate !== undefined) inv.tax_rate = Number(data.tax_rate) || 0;

    const afterDiscount = Math.max(0, inv.subtotal - inv.discount);
    inv.tax_amount = Number(((afterDiscount * inv.tax_rate) / 100).toFixed(2));
    inv.total_amount = Number((afterDiscount + inv.tax_amount).toFixed(2));

    if (data.paid_amount !== undefined) inv.paid_amount = Math.max(0, Number(data.paid_amount) || 0);

    if (data.status) {
      inv.status = data.status;
      if (data.status === 'Paid') {
        inv.paid_amount = inv.total_amount;
      } else if (data.status === 'Pending' || data.status === 'Cancelled') {
        inv.paid_amount = 0;
      }
    } else {
      if (inv.paid_amount >= inv.total_amount && inv.total_amount > 0) {
        inv.status = 'Paid';
        inv.paid_amount = inv.total_amount;
      } else if (inv.paid_amount > 0 && inv.paid_amount < inv.total_amount) {
        inv.status = 'Partial';
      } else {
        inv.status = 'Pending';
      }
    }

    if (inv.status !== 'Cancelled') {
      if (inv.paid_amount >= inv.total_amount && inv.total_amount > 0) {
        inv.status = 'Paid';
        inv.paid_amount = inv.total_amount;
      } else if (inv.paid_amount > 0 && inv.paid_amount < inv.total_amount && data.status !== 'Paid') {
        inv.status = 'Partial';
      }
    }

    inv.balance_due = inv.status === 'Cancelled' ? 0 : Math.max(0, Number((inv.total_amount - inv.paid_amount).toFixed(2)));

    inv.updated_at = now;
    saveStore(store);

    const currentItemsSnapshot = Array.isArray(data.items)
      ? store.invoice_items.filter(it => it.invoice_id === id)
      : null;

    runMySQLWrite(async (activePool) => {
      await activePool.query(
        `UPDATE invoices SET
           invoice_number = ?, client_id = ?, issue_date = ?, due_date = ?, status = ?,
           payment_method = ?, currency = ?, subtotal = ?, discount = ?, tax_rate = ?,
           tax_amount = ?, total_amount = ?, paid_amount = ?, balance_due = ?, notes = ?
         WHERE id = ?`,
        [
          inv.invoice_number,
          inv.client_id,
          inv.issue_date,
          inv.due_date,
          inv.status,
          inv.payment_method,
          inv.currency,
          inv.subtotal,
          inv.discount,
          inv.tax_rate,
          inv.tax_amount,
          inv.total_amount,
          inv.paid_amount,
          inv.balance_due,
          inv.notes,
          inv.id,
        ]
      );

      if (currentItemsSnapshot) {
        await activePool.query('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
        if (currentItemsSnapshot.length > 0) {
          const placeholders = currentItemsSnapshot.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
          const flatParams = currentItemsSnapshot.flatMap(it => [
            it.id,
            it.invoice_id,
            it.catalog_item_id,
            it.description,
            it.quantity,
            it.unit_price,
            it.total,
          ]);
          await activePool.query(
            `INSERT INTO invoice_items (id, invoice_id, catalog_item_id, description, quantity, unit_price, total)
             VALUES ${placeholders}`,
            flatParams
          );
        }
      }
    });

    if (operatorId) {
      this.logActivity(
        operatorId,
        'UPDATE',
        'CLIENT',
        inv.client_id,
        `Updated invoice ${inv.invoice_number} (Status: ${inv.status}, Total: ${inv.currency} ${inv.total_amount.toFixed(2)})`
      );
    }

    return this.getInvoiceById(id);
  },

  async deleteInvoice(id: number, operatorId?: number): Promise<boolean> {
    if (!store.invoices) return false;
    const index = store.invoices.findIndex(i => i.id === id);
    if (index === -1) return false;

    const [deleted] = store.invoices.splice(index, 1);
    store.invoice_items = (store.invoice_items || []).filter(it => it.invoice_id !== id);
    saveStore(store);

    runMySQLWrite(async (activePool) => {
      await activePool.query('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
      await activePool.query('DELETE FROM invoices WHERE id = ?', [id]);
    });

    if (operatorId) {
      this.logActivity(
        operatorId,
        'DELETE',
        'CLIENT',
        deleted.client_id,
        `Deleted invoice ${deleted.invoice_number} (${deleted.currency} ${deleted.total_amount.toFixed(2)})`
      );
    }

    return true;
  },
};

export function getMySQLPool() {
  return { pool, isConnected: isConnectedToMySQL };
}


