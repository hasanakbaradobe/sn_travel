-- ========================================================
-- SN Travels Agency — China Visa Client Management System
-- Database Schema for MySQL / MariaDB (phpMyAdmin Compatible)
-- Official Website: sn-travelsagency.com
-- ========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Database creation (optional if already created in phpMyAdmin)
CREATE DATABASE IF NOT EXISTS `sn_travels_visa` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `sn_travels_visa`;

-- --------------------------------------------------------
-- Table: users
-- --------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'admin', 'staff') NOT NULL DEFAULT 'staff',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: countries
-- --------------------------------------------------------
DROP TABLE IF EXISTS `countries`;
CREATE TABLE `countries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `code` VARCHAR(10) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_countries_name` (`name`),
  INDEX `idx_countries_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: clients
-- --------------------------------------------------------
DROP TABLE IF EXISTS `clients`;
CREATE TABLE `clients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` VARCHAR(30) NOT NULL UNIQUE,
  `full_name` VARCHAR(200) NOT NULL,
  `passport_number` VARCHAR(100) NOT NULL,
  `country` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `whatsapp` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `date_of_birth` DATE DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `occupation` VARCHAR(150) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `google_drive_url` VARCHAR(500) DEFAULT NULL,
  `photo_url` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clients_name` (`full_name`),
  INDEX `idx_clients_passport` (`passport_number`),
  INDEX `idx_clients_country` (`country`),
  INDEX `idx_clients_created` (`created_at`),
  INDEX `idx_clients_country_created` (`country`, `created_at`),
  INDEX `idx_clients_name_passport` (`full_name`, `passport_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: client_custom_fields
-- --------------------------------------------------------
DROP TABLE IF EXISTS `client_custom_fields`;
CREATE TABLE `client_custom_fields` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `field_name` VARCHAR(100) NOT NULL UNIQUE,
  `field_label` VARCHAR(150) NOT NULL,
  `field_type` ENUM('text', 'long_text', 'number', 'date', 'dropdown', 'checkbox') NOT NULL DEFAULT 'text',
  `field_options` TEXT DEFAULT NULL, -- Comma-separated or JSON list for dropdown options
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_custom_fields_order` (`display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: client_custom_field_values
-- --------------------------------------------------------
DROP TABLE IF EXISTS `client_custom_field_values`;
CREATE TABLE `client_custom_field_values` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` INT NOT NULL,
  `field_id` INT NOT NULL,
  `field_value` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_client_field` (`client_id`, `field_id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`field_id`) REFERENCES `client_custom_fields` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: visa_types
-- --------------------------------------------------------
DROP TABLE IF EXISTS `visa_types`;
CREATE TABLE `visa_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: visa_applications
-- --------------------------------------------------------
DROP TABLE IF EXISTS `visa_applications`;
CREATE TABLE `visa_applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `application_id` VARCHAR(30) NOT NULL UNIQUE,
  `client_id` INT NOT NULL,
  `visa_type_id` INT NOT NULL,
  `status` ENUM(
    'Upcoming',
    'File Missing',
    'Need to Prepare',
    'Prepared',
    'Under Review',
    'Online Review Completed',
    'Modify',
    'Pending Collection',
    'Rejected',
    'Returned'
  ) NOT NULL DEFAULT 'Upcoming',
  `delivery_date` DATE DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `assigned_user_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_app_client` (`client_id`),
  INDEX `idx_app_status` (`status`),
  INDEX `idx_app_delivery` (`delivery_date`),
  INDEX `idx_app_status_delivery` (`status`, `delivery_date`),
  INDEX `idx_app_client_status` (`client_id`, `status`),
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`visa_type_id`) REFERENCES `visa_types` (`id`),
  FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: application_status_history
-- --------------------------------------------------------
DROP TABLE IF EXISTS `application_status_history`;
CREATE TABLE `application_status_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `application_id` INT NOT NULL,
  `old_status` VARCHAR(50) DEFAULT NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `delivery_date` DATE DEFAULT NULL,
  `changed_by_user_id` INT DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_status_hist_app` (`application_id`),
  FOREIGN KEY (`application_id`) REFERENCES `visa_applications` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: tasks
-- --------------------------------------------------------
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `client_id` INT DEFAULT NULL,
  `application_id` INT DEFAULT NULL,
  `assigned_user_id` INT DEFAULT NULL,
  `due_date` DATE NOT NULL,
  `priority` ENUM('Low', 'Normal', 'High', 'Urgent') NOT NULL DEFAULT 'Normal',
  `status` ENUM('Pending', 'Completed') NOT NULL DEFAULT 'Pending',
  `is_delivery_task` TINYINT(1) NOT NULL DEFAULT 0,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tasks_due` (`due_date`),
  INDEX `idx_tasks_status` (`status`),
  INDEX `idx_tasks_client` (`client_id`),
  INDEX `idx_tasks_app` (`application_id`),
  INDEX `idx_tasks_assigned` (`assigned_user_id`),
  INDEX `idx_tasks_due_status` (`due_date`, `status`),
  INDEX `idx_tasks_client_due` (`client_id`, `due_date`),
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`application_id`) REFERENCES `visa_applications` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: follow_ups
-- --------------------------------------------------------
DROP TABLE IF EXISTS `follow_ups`;
CREATE TABLE `follow_ups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `reason` VARCHAR(150) NOT NULL,
  `channel` ENUM('WhatsApp', 'Phone Call', 'WeChat', 'Email', 'SMS') NOT NULL DEFAULT 'WhatsApp',
  `cadence` ENUM('1 Month', '2 Months', '3 Months', '6 Months', 'One-time') NOT NULL DEFAULT '1 Month',
  `due_date` DATE NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `message_template` TEXT DEFAULT NULL,
  `status` ENUM('Pending', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
  `priority` ENUM('Low', 'Normal', 'High', 'Urgent') NOT NULL DEFAULT 'Normal',
  `task_id` INT DEFAULT NULL,
  `assigned_user_id` INT DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `completed_notes` TEXT DEFAULT NULL,
  `created_by_user_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_followups_client` (`client_id`),
  INDEX `idx_followups_due` (`due_date`),
  INDEX `idx_followups_status` (`status`),
  INDEX `idx_followups_cadence` (`cadence`),
  INDEX `idx_followups_due_status` (`due_date`, `status`),
  INDEX `idx_followups_task` (`task_id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: comments
-- --------------------------------------------------------
DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` INT NOT NULL,
  `application_id` INT DEFAULT NULL,
  `user_id` INT NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_comments_client` (`client_id`),
  INDEX `idx_comments_app` (`application_id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`application_id`) REFERENCES `visa_applications` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: activity_logs
-- --------------------------------------------------------
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_activity_created` (`created_at`),
  INDEX `idx_activity_entity` (`entity_type`, `entity_id`),
  INDEX `idx_activity_user_created` (`user_id`, `created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: hotels
-- --------------------------------------------------------
DROP TABLE IF EXISTS `hotels`;
CREATE TABLE `hotels` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `star_rating` INT NOT NULL DEFAULT 4,
  `phone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_hotels_name` (`name`),
  INDEX `idx_hotels_city` (`city`),
  INDEX `idx_hotels_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: hotel_rooms
-- --------------------------------------------------------
DROP TABLE IF EXISTS `hotel_rooms`;
CREATE TABLE `hotel_rooms` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` INT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `price_per_night` DECIMAL(10,2) DEFAULT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `capacity` INT NOT NULL DEFAULT 2,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_hotel_rooms_hotel` (`hotel_id`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: hotel_bookings
-- --------------------------------------------------------
DROP TABLE IF EXISTS `hotel_bookings`;
CREATE TABLE `hotel_bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `booking_reference` VARCHAR(30) NOT NULL UNIQUE,
  `client_id` INT NOT NULL,
  `hotel_id` INT NOT NULL,
  `room_type_id` INT DEFAULT NULL,
  `room_type_name` VARCHAR(120) DEFAULT NULL,
  `check_in_date` DATE NOT NULL,
  `check_out_date` DATE NOT NULL,
  `guest_count` INT NOT NULL DEFAULT 1,
  `room_count` INT NOT NULL DEFAULT 1,
  `status` ENUM('Confirmed', 'Checked In', 'Checked Out', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
  `comment` TEXT DEFAULT NULL,
  `special_requests` TEXT DEFAULT NULL,
  `total_price` DECIMAL(10,2) DEFAULT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `checkout_task_id` INT DEFAULT NULL,
  `created_by_user_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_bookings_client` (`client_id`),
  INDEX `idx_bookings_hotel` (`hotel_id`),
  INDEX `idx_bookings_checkin` (`check_in_date`),
  INDEX `idx_bookings_checkout` (`check_out_date`),
  INDEX `idx_bookings_status` (`status`),
  INDEX `idx_bookings_checkout_status` (`check_out_date`, `status`),
  INDEX `idx_bookings_client_dates` (`client_id`, `check_in_date`, `check_out_date`),
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`room_type_id`) REFERENCES `hotel_rooms` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: settings
-- --------------------------------------------------------
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: invoice_settings (Company branding, Google Drive logo link, address, bank details)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `invoice_settings`;
CREATE TABLE `invoice_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_name` VARCHAR(255) NOT NULL DEFAULT 'SN Travels Agency',
  `company_tagline` VARCHAR(255) DEFAULT 'China Visa & Travel Processing Specialists',
  `logo_url` TEXT DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT '+971 4 123 4567',
  `whatsapp` VARCHAR(50) DEFAULT '+971 50 123 4567',
  `email` VARCHAR(191) DEFAULT 'info@sn-travelsagency.com',
  `website` VARCHAR(191) DEFAULT 'sn-travelsagency.com',
  `address` TEXT DEFAULT 'Office 402, Al Hudaiba Awards Building, 2nd December St, Dubai, UAE',
  `tax_number` VARCHAR(100) DEFAULT NULL,
  `bank_details` TEXT DEFAULT 'Bank: Emirates NBD\nAccount Title: SN Travels Agency LLC\nIBAN: AE00 0000 0000 0000 0000 00\nSWIFT: ENBDDBAXXX',
  `payment_notes` TEXT DEFAULT 'Please include your Invoice # as payment reference. Payment due within 7 days of invoice issue date.',
  `terms_and_conditions` TEXT DEFAULT '1. All embassy visa processing charges are subject to official government guidelines.\n2. Invoices must be settled prior to passport delivery or collection.\n3. Official receipt issued upon payment confirmation.',
  `signature_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `signature_name` VARCHAR(150) DEFAULT 'Sarah Nadeem',
  `signature_designation` VARCHAR(150) DEFAULT 'Managing Director',
  `signature_image_url` LONGTEXT DEFAULT NULL,
  `signature_style` VARCHAR(20) DEFAULT 'script',
  `default_currency` VARCHAR(10) NOT NULL DEFAULT 'MYR',
  `invoice_prefix` VARCHAR(20) NOT NULL DEFAULT 'INV-2026-',
  `next_number` INT NOT NULL DEFAULT 1001,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: invoice_catalog_items (Configurable fields/fees managed in Settings)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `invoice_catalog_items`;
CREATE TABLE `invoice_catalog_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `default_unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `category` VARCHAR(100) DEFAULT 'Visa Services',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_catalog_active` (`is_active`),
  INDEX `idx_catalog_order` (`display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: invoices (Customer Invoices)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `invoices`;
CREATE TABLE `invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
  `client_id` INT NOT NULL,
  `issue_date` DATE NOT NULL,
  `due_date` DATE DEFAULT NULL,
  `status` ENUM('Pending', 'Paid', 'Partial', 'Cancelled') NOT NULL DEFAULT 'Pending',
  `payment_method` ENUM('Cash', 'Bank Transfer', 'Credit Card', 'WeChat Pay', 'Alipay', 'Other') DEFAULT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'MYR',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `balance_due` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `created_by_user_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_invoices_client` (`client_id`),
  INDEX `idx_invoices_number` (`invoice_number`),
  INDEX `idx_invoices_status` (`status`),
  INDEX `idx_invoices_date` (`issue_date`),
  INDEX `idx_invoices_client_status` (`client_id`, `status`),
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: invoice_items (Individual line items per invoice)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `invoice_items`;
CREATE TABLE `invoice_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_id` INT NOT NULL,
  `catalog_item_id` INT DEFAULT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  INDEX `idx_inv_items_invoice` (`invoice_id`),
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`catalog_item_id`) REFERENCES `invoice_catalog_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
