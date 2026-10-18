-- ============================================================================
-- ADDITIVE MIGRATION: Public Hotel Website CMS Module
-- Target Database: MySQL / MariaDB (AlwaysData via phpMyAdmin)
-- Safety: 100% non-destructive (CREATE TABLE IF NOT EXISTS only).
-- Does NOT drop, rename, or alter any existing CRM tables or records.
-- ============================================================================

SET NAMES utf8mb4;

-- 1. General Website, Homepage, SEO & Navigation Settings
CREATE TABLE IF NOT EXISTS `public_site_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `site_status` VARCHAR(40) NOT NULL DEFAULT 'Unpublished',
  `has_unpublished_changes` TINYINT(1) NOT NULL DEFAULT 1,
  `hotel_name` VARCHAR(255) NOT NULL DEFAULT '',
  `tagline` VARCHAR(255) DEFAULT '',
  `short_description` TEXT DEFAULT NULL,
  `about_title` VARCHAR(255) DEFAULT '',
  `about_content` LONGTEXT DEFAULT NULL,
  `logo_url` TEXT DEFAULT NULL,
  `favicon_url` TEXT DEFAULT NULL,
  `primary_color` VARCHAR(30) DEFAULT '#0f172a',
  `accent_color` VARCHAR(30) DEFAULT '#b45309',
  `contact_phone` VARCHAR(100) DEFAULT '',
  `whatsapp_number` VARCHAR(100) DEFAULT '',
  `contact_email` VARCHAR(255) DEFAULT '',
  `address_line` TEXT DEFAULT NULL,
  `city` VARCHAR(120) DEFAULT '',
  `country` VARCHAR(120) DEFAULT '',
  `postal_code` VARCHAR(40) DEFAULT '',
  `google_maps_url` TEXT DEFAULT NULL,
  `google_maps_embed_url` TEXT DEFAULT NULL,
  `social_links_json` LONGTEXT DEFAULT NULL,
  `reservation_url` TEXT DEFAULT NULL,
  `reservation_button_text` VARCHAR(100) DEFAULT 'Enquire Now',
  `check_in_time` VARCHAR(100) DEFAULT '',
  `check_out_time` VARCHAR(100) DEFAULT '',
  `cancellation_policy` TEXT DEFAULT NULL,
  `general_policies` LONGTEXT DEFAULT NULL,
  `footer_text` TEXT DEFAULT NULL,
  `copyright_text` VARCHAR(255) DEFAULT '',
  `hero_heading` VARCHAR(255) DEFAULT '',
  `hero_subtitle` TEXT DEFAULT NULL,
  `hero_image_url` TEXT DEFAULT NULL,
  `hero_cta_text` VARCHAR(100) DEFAULT 'Explore Rooms',
  `hero_cta_link` VARCHAR(255) DEFAULT '#rooms',
  `hero_secondary_cta_text` VARCHAR(100) DEFAULT 'Contact Us',
  `hero_secondary_cta_link` VARCHAR(255) DEFAULT '#contact',
  `welcome_heading` VARCHAR(255) DEFAULT '',
  `welcome_body` LONGTEXT DEFAULT NULL,
  `homepage_sections_json` LONGTEXT DEFAULT NULL,
  `nav_links_json` LONGTEXT DEFAULT NULL,
  `footer_links_json` LONGTEXT DEFAULT NULL,
  `seo_title` VARCHAR(255) DEFAULT '',
  `seo_description` TEXT DEFAULT NULL,
  `og_title` VARCHAR(255) DEFAULT '',
  `og_description` TEXT DEFAULT NULL,
  `og_image_url` TEXT DEFAULT NULL,
  `canonical_domain` VARCHAR(255) DEFAULT '',
  `robots_indexing` VARCHAR(50) DEFAULT 'index,follow',
  `sitemap_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `public_site_url` VARCHAR(255) DEFAULT '',
  `last_edited_by` INT DEFAULT NULL,
  `last_edited_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `last_published_at` DATETIME DEFAULT NULL,
  `last_published_version` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Structured Public Website Pages
CREATE TABLE IF NOT EXISTS `public_site_pages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(64) NOT NULL UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `heading` VARCHAR(255) NOT NULL DEFAULT '',
  `subheading` TEXT DEFAULT NULL,
  `Hero_image_url` TEXT DEFAULT NULL,
  `content_body` LONGTEXT DEFAULT NULL,
  `structured_data_json` LONGTEXT DEFAULT NULL,
  `seo_title` VARCHAR(255) DEFAULT '',
  `seo_description` TEXT DEFAULT NULL,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `show_in_nav` TINYINT(1) NOT NULL DEFAULT 1,
  `show_in_footer` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_public_pages_order` (`display_order`, `is_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Public Room & Accommodation Types (Isolated from confidential client bookings)
CREATE TABLE IF NOT EXISTS `public_site_rooms` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) DEFAULT '',
  `short_description` TEXT DEFAULT NULL,
  `full_description` LONGTEXT DEFAULT NULL,
  `featured_image_url` TEXT DEFAULT NULL,
  `gallery_images_json` LONGTEXT DEFAULT NULL,
  `capacity` VARCHAR(120) DEFAULT '',
  `bed_type` VARCHAR(120) DEFAULT '',
  `room_size` VARCHAR(80) DEFAULT '',
  `amenities_json` LONGTEXT DEFAULT NULL,
  `optional_price` DECIMAL(10, 2) DEFAULT NULL,
  `currency` VARCHAR(16) DEFAULT 'USD',
  `price_note` VARCHAR(120) DEFAULT 'per night (indicative)',
  `enquiry_url` TEXT DEFAULT NULL,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_public_rooms_order` (`display_order`, `is_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Public Hotel Facilities & Amenities
CREATE TABLE IF NOT EXISTS `public_site_facilities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) DEFAULT 'General',
  `description` TEXT DEFAULT NULL,
  `icon_name` VARCHAR(80) DEFAULT 'Sparkles',
  `image_url` TEXT DEFAULT NULL,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 1,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_public_facilities_order` (`display_order`, `is_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Public Photo Gallery
CREATE TABLE IF NOT EXISTS `public_site_gallery` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) DEFAULT '',
  `caption` TEXT DEFAULT NULL,
  `alt_text` VARCHAR(255) NOT NULL DEFAULT '',
  `category` VARCHAR(100) DEFAULT 'Hotel',
  `image_url` TEXT NOT NULL,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_public_gallery_order` (`display_order`, `is_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Public Frequently Asked Questions (FAQs)
CREATE TABLE IF NOT EXISTS `public_site_faqs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `question` VARCHAR(500) NOT NULL,
  `answer` LONGTEXT NOT NULL,
  `category` VARCHAR(100) DEFAULT 'General',
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_public_faqs_order` (`display_order`, `is_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Immutable Versioned Published Snapshots (Allowlisted Public Fields Only)
CREATE TABLE IF NOT EXISTS `public_site_snapshots` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_number` INT NOT NULL UNIQUE,
  `snapshot_hash` VARCHAR(64) NOT NULL,
  `snapshot_json` LONGTEXT NOT NULL,
  `published_by_user_id` INT DEFAULT NULL,
  `published_by_name` VARCHAR(255) DEFAULT 'Administrator',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_public_snapshots_version` (`version_number` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Publication & Deployment Activity History Logs
CREATE TABLE IF NOT EXISTS `public_site_publications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_number` INT NOT NULL,
  `snapshot_id` INT NOT NULL,
  `initiated_by_user_id` INT DEFAULT NULL,
  `initiated_by_name` VARCHAR(255) DEFAULT 'Administrator',
  `deployment_status` VARCHAR(50) NOT NULL DEFAULT 'Deployment Requested',
  `build_hook_configured` TINYINT(1) NOT NULL DEFAULT 0,
  `build_hook_triggered` TINYINT(1) NOT NULL DEFAULT 0,
  `build_hook_http_status` INT DEFAULT NULL,
  `netlify_deploy_id` VARCHAR(120) DEFAULT NULL,
  `netlify_deploy_state` VARCHAR(80) DEFAULT NULL,
  `netlify_deploy_url` TEXT DEFAULT NULL,
  `verified_at` DATETIME DEFAULT NULL,
  `error_message` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_public_publications_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
