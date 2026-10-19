-- ========================================================
-- SN Travels Agency — China Visa Client Management System
-- Initial Seed Data for MySQL / MariaDB (phpMyAdmin)
-- Official Website: sn-travelsagency.com
-- ========================================================

USE `sn_travels_visa`;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Seed Users (Passwords hashed with SHA-256 for demo; super admin & staff)
-- admin@sn-travelsagency.com / admin123456
-- staff@sn-travelsagency.com / staff123456
-- lin.chen@sn-travelsagency.com / staff123456
-- --------------------------------------------------------
TRUNCATE TABLE `users`;
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`, `created_at`) VALUES
(1, 'Sarah Nadeem (Managing Director)', 'admin@sn-travelsagency.com', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'super_admin', 1, NOW()),
(2, 'Farhan Qureshi (Senior Visa Officer)', 'staff@sn-travelsagency.com', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'staff', 1, NOW()),
(3, 'Lin Chen (China Desk Specialist)', 'lin.chen@sn-travelsagency.com', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'staff', 1, NOW());

-- --------------------------------------------------------
-- Seed Countries
-- --------------------------------------------------------
TRUNCATE TABLE `countries`;
INSERT INTO `countries` (`id`, `name`, `code`, `is_active`, `display_order`, `created_at`) VALUES
(1, 'United Arab Emirates', 'AE', 1, 1, NOW()),
(2, 'Pakistan', 'PK', 1, 2, NOW()),
(3, 'India', 'IN', 1, 3, NOW()),
(4, 'Russia', 'RU', 1, 4, NOW()),
(5, 'United Kingdom', 'GB', 1, 5, NOW()),
(6, 'Malaysia', 'MY', 1, 6, NOW()),
(7, 'Saudi Arabia', 'SA', 1, 7, NOW()),
(8, 'China', 'CN', 1, 8, NOW()),
(9, 'Oman', 'OM', 1, 9, NOW()),
(10, 'Qatar', 'QA', 1, 10, NOW()),
(11, 'Turkey', 'TR', 1, 11, NOW()),
(12, 'Egypt', 'EG', 1, 12, NOW()),
(13, 'Canada', 'CA', 1, 13, NOW()),
(14, 'United States', 'US', 1, 14, NOW()),
(15, 'Germany', 'DE', 1, 15, NOW()),
(16, 'Bangladesh', 'BD', 1, 16, NOW()),
(17, 'Australia', 'AU', 1, 17, NOW()),
(18, 'Singapore', 'SG', 1, 18, NOW()),
(19, 'Iran', 'IR', 1, 19, NOW()),
(20, 'Philippines', 'PH', 1, 20, NOW());

-- --------------------------------------------------------
-- Seed Visa Types
-- --------------------------------------------------------
TRUNCATE TABLE `visa_types`;
INSERT INTO `visa_types` (`id`, `name`, `description`, `is_active`, `created_at`) VALUES
(1, 'L - Tourist Visa', 'For leisure travel, sightseeing, and personal visits to China', 1, NOW()),
(2, 'M - Commercial Trade / Business Visa', 'For commercial and trade activities, business meetings, and supplier visits', 1, NOW()),
(3, 'X1/X2 - Student Visa', 'Long-term (X1) or short-term (X2) study at accredited Chinese universities', 1, NOW()),
(4, 'Z - Work Visa', 'For taking up post, employment, or commercial performance in China', 1, NOW()),
(5, 'Q1/Q2 - Family Reunion Visa', 'For family members of Chinese citizens or foreign citizens with permanent residence', 1, NOW()),
(6, 'F - Non-commercial Exchange Visa', 'For cultural exchange, academic visits, lectures, and non-commercial research', 1, NOW()),
(7, 'Other Special Category', 'Diplomatic, transit, crew, or specialized China visa permits', 1, NOW());

-- --------------------------------------------------------
-- Seed Custom Client Fields
-- --------------------------------------------------------
TRUNCATE TABLE `client_custom_fields`;
INSERT INTO `client_custom_fields` (`id`, `field_name`, `field_label`, `field_type`, `field_options`, `is_required`, `is_active`, `display_order`, `created_at`) VALUES
(1, 'employer', 'Employer / Company Name', 'text', NULL, 0, 1, 1, NOW()),
(2, 'visa_history', 'Previous China Visa History', 'dropdown', 'Never Visited, 1-2 Times, Frequent Traveler (3+ Times), Has Expired Visa in Old Passport', 0, 1, 2, NOW()),
(3, 'travel_history', 'Past 3 Years Travel History', 'long_text', NULL, 0, 1, 3, NOW()),
(4, 'marital_status', 'Marital Status', 'dropdown', 'Single, Married, Divorced, Widowed', 0, 1, 4, NOW()),
(5, 'chinese_contact', 'Chinese Inviting Entity / Contact', 'text', NULL, 0, 1, 5, NOW()),
(6, 'invitation_source', 'Invitation Letter Source (PU Letter / Official)', 'dropdown', 'Official Government PU Letter, Corporate Partner Invitation, University Admission Notice (JW202), Family Invitation, None Required', 0, 1, 6, NOW());

-- --------------------------------------------------------
-- Seed Clients
-- --------------------------------------------------------
TRUNCATE TABLE `clients`;
INSERT INTO `clients` (`id`, `client_id`, `full_name`, `passport_number`, `country`, `phone`, `whatsapp`, `email`, `date_of_birth`, `address`, `occupation`, `notes`, `google_drive_url`, `photo_url`, `created_at`) VALUES
(1, 'CL-000001', 'Ahmed Mohamed Al-Mansoor', 'P98421054', 'United Arab Emirates', '+971 50 123 4567', '+971 50 123 4567', 'ahmed.mansoor@almansoorgroup.com', '1984-06-15', 'Villa 42, Al Barsha 2, Dubai, UAE', 'Managing Director - Trade Import', 'Frequent business visitor to Guangzhou and Yiwu wholesale markets. Urgently requires M visa.', 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces', NOW()),
(2, 'CL-000002', 'Elena Rostova', 'RU72019482', 'Russia', '+7 916 555 0192', '+7 916 555 0192', 'elena.rostova@artdesign.ru', '1992-11-03', 'Tverskaya St 18, Moscow', 'Interior Designer & Buyer', 'Visiting Beijing Design Week and Shanghai furniture suppliers. Photos uploaded to Drive.', 'https://drive.google.com/drive/folders/1bCdEfGhIjKlMnOpQrStUvWxYzA987654', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces', NOW()),
(3, 'CL-000003', 'Kavita Sundaram', 'M40192837', 'India', '+91 98200 45123', '+91 98200 45123', 'kavita.s@biotechventures.in', '1989-03-22', 'Indiranagar 100ft Road, Bengaluru', 'Biotech Researcher', 'Invited to Tsinghua University for a 2-week symposium. Need F visa processing.', 'https://drive.google.com/drive/folders/1cDeFgHiJkLmNoPqRsTuVwXyZaB567890', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces', NOW()),
(4, 'CL-000004', 'David Michael Harrison', 'GB551982740', 'United Kingdom', '+44 7700 900142', '+44 7700 900142', 'david.harrison@londonlogistics.co.uk', '1978-09-14', '24 Kensington Church Street, London', 'Supply Chain Director', 'Regular cargo inspection in Ningbo. Passport valid until 2031.', 'https://drive.google.com/drive/folders/1dEfGhIjKlMnOpQrStUvWxYzAbC112233', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces', NOW()),
(5, 'CL-000005', 'Li Wei Chen', 'MYA4928105', 'Malaysia', '+60 12 345 6789', '+60 12 345 6789', 'chen.lw@sinopacific.com.my', '1995-01-30', 'Jalan Ampang, Kuala Lumpur', 'Student / Candidate', 'Enrolling in Zhejiang University for Master degree. JW202 form verified.', 'https://drive.google.com/drive/folders/1eFgHiJkLmNoPqRsTuVwXyZabCd445566', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&crop=faces', NOW());

-- --------------------------------------------------------
-- Seed Custom Field Values
-- --------------------------------------------------------
TRUNCATE TABLE `client_custom_field_values`;
INSERT INTO `client_custom_field_values` (`client_id`, `field_id`, `field_value`, `created_at`) VALUES
(1, 1, 'Al-Mansoor Trading LLC', NOW()),
(1, 2, 'Frequent Traveler (3+ Times)', NOW()),
(1, 3, 'China (2024, 2025), Turkey, Germany, Singapore', NOW()),
(1, 4, 'Married', NOW()),
(1, 5, 'Guangzhou International Trade Center, Mr. Wang', NOW()),
(1, 6, 'Corporate Partner Invitation', NOW()),
(2, 1, 'Studio Rostova Design', NOW()),
(2, 2, '1-2 Times', NOW()),
(2, 4, 'Single', NOW()),
(3, 1, 'Biotech Ventures India Pvt Ltd', NOW()),
(3, 2, 'Never Visited', NOW()),
(3, 5, 'Tsinghua University School of Life Sciences', NOW()),
(3, 6, 'Corporate Partner Invitation', NOW());

-- --------------------------------------------------------
-- Seed Visa Applications
-- --------------------------------------------------------
TRUNCATE TABLE `visa_applications`;
INSERT INTO `visa_applications` (`id`, `application_id`, `client_id`, `visa_type_id`, `status`, `delivery_date`, `notes`, `assigned_user_id`, `created_at`) VALUES
(1, 'APP-000001', 1, 2, 'Online Review Completed', DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY), 'Online application submitted on COVA portal. Appointment scheduled. Scheduled for passport dispatch and collection.', 2, NOW()),
(2, 'APP-000002', 2, 1, 'Under Review', NULL, 'Chinese Visa Application Service Center (CVASC) reviewing invitation and round-trip flight booking.', 2, NOW()),
(3, 'APP-000003', 3, 6, 'Need to Prepare', NULL, 'Awaiting official invitation letter with Chinese seal from Tsinghua host department.', 3, NOW()),
(4, 'APP-000004', 4, 2, 'Pending Collection', DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY), 'Visa stamped by embassy. Passport currently at agency desk ready for courier or pickup.', 2, NOW()),
(5, 'APP-000005', 5, 3, 'Prepared', NULL, 'Original JW202 form and university admission letter notarized. Ready for portal upload.', 3, NOW());

-- --------------------------------------------------------
-- Seed Application Status History
-- --------------------------------------------------------
TRUNCATE TABLE `application_status_history`;
INSERT INTO `application_status_history` (`application_id`, `old_status`, `new_status`, `delivery_date`, `changed_by_user_id`, `notes`, `created_at`) VALUES
(1, 'Upcoming', 'Need to Prepare', NULL, 1, 'Client case opened at SN Travels Agency', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(1, 'Need to Prepare', 'Prepared', NULL, 2, 'All documents compiled and scanned into Google Drive folder', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(1, 'Prepared', 'Under Review', NULL, 2, 'Submitted to China Visa Application Service Center (CVASC)', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(1, 'Under Review', 'Online Review Completed', DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY), 2, 'Online review verified. Embassy scheduled delivery on target date.', NOW());

-- --------------------------------------------------------
-- Seed Tasks (Including linked Delivery Tasks)
-- --------------------------------------------------------
TRUNCATE TABLE `tasks`;
INSERT INTO `tasks` (`id`, `title`, `description`, `client_id`, `application_id`, `assigned_user_id`, `due_date`, `priority`, `status`, `is_delivery_task`, `created_at`) VALUES
(1, 'Delivery - Ahmed Mohamed Al-Mansoor', 'Deliver issued M Commercial Visa and passport to client office or prepare for counter pickup.', 1, 1, 2, DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY), 'High', 'Pending', 1, NOW()),
(2, 'Verify Tsinghua Invitation Letter Seal', 'Call host coordinator in Beijing to request updated color scan with red institutional seal.', 3, 3, 3, CURRENT_DATE, 'Urgent', 'Pending', 0, NOW()),
(3, 'Check CVASC biometric appointment slot', 'Elena Rostova requires biometric submission slot at visa center on Monday.', 2, 2, 2, DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY), 'Normal', 'Pending', 0, NOW()),
(4, 'Passport Courier Dispatch to London Client', 'Hand over David Harrison stamped passport to DHL Express tracking number.', 4, 4, 2, CURRENT_DATE, 'High', 'Completed', 0, DATE_SUB(NOW(), INTERVAL 1 DAY));

-- --------------------------------------------------------
-- Seed Comments
-- --------------------------------------------------------
TRUNCATE TABLE `comments`;
INSERT INTO `comments` (`id`, `client_id`, `application_id`, `user_id`, `message`, `created_at`) VALUES
(1, 1, 1, 2, 'Client visited SN Travels Dubai office. Provided 2 recent white background passport photos according to Chinese embassy 33x48mm spec.', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(1, 1, 1, 1, 'Online COVA form approved. Delivery date confirmed with visa courier.', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, 3, 3, 3, 'Client will provide missing bank statement tomorrow morning via WhatsApp/Drive.', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- --------------------------------------------------------
-- Seed Activity Logs
-- --------------------------------------------------------
TRUNCATE TABLE `activity_logs`;
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at`) VALUES
(1, 1, 'CREATE', 'CLIENT', 1, 'Created client profile for Ahmed Mohamed Al-Mansoor (CL-000001)', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2, 2, 'CREATE', 'APPLICATION', 1, 'Created M - Commercial Trade / Business Visa application (APP-000001)', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(3, 2, 'STATUS_CHANGE', 'APPLICATION', 1, 'Changed status to Online Review Completed. Set delivery date and created delivery task.', NOW());

-- --------------------------------------------------------
-- Seed Hotels (9 Kuala Lumpur Hotels - Rooms & Pictures to be added later)
-- --------------------------------------------------------
TRUNCATE TABLE `hotel_rooms`;
TRUNCATE TABLE `hotels`;
INSERT INTO `hotels` (`id`, `name`, `city`, `address`, `star_rating`, `phone`, `email`, `notes`, `is_active`, `created_at`) VALUES
(1, 'Axon BukitBintang with pavilion by AQSA', 'Kuala Lumpur', 'Bukit Bintang, Kuala Lumpur, Malaysia (0.4 km from Bukit Bintang)', 4, '', '', 'Booking.com Score: 7.7 Good (280 reviews) | Ranked #2 of 6 apartments in Kuala Lumpur | Free Wi-Fi, Swimming pool, Parking, Kitchen, Airport shuttle | Starting rate: RM 182/night (Total RM 727 + RM 217 taxes & charges) | No prepayment needed – pay at the property', 1, NOW()),
(2, 'Sky Suites KLCC Homestay by BIRDY STAY', 'Kuala Lumpur', 'Kuala Lumpur City-Centre (KLCC), Kuala Lumpur, Malaysia (0.4 km from Petronas Twin Towers)', 3, '', '', 'Booking.com Score: 7.2 Good (505 reviews) | Ranked #2 of 15 homestays in Kuala Lumpur | Free Wi-Fi, Family rooms, Non-smoking rooms | Starting rate: RM 105/night (Total RM 419 + RM 102 taxes & charges) | Prepayment needed', 1, NOW()),
(3, 'KLCC Sky Villa Suites Scarletz Brickz By M Suites', 'Kuala Lumpur', 'Kuala Lumpur City-Centre (KLCC), Kuala Lumpur, Malaysia (0.5 km from Petronas Twin Towers)', 4, '', '', 'Booking.com Score: 7.9 Good (294 reviews) | Free Wi-Fi, Swimming pool, Parking, Fitness centre, Spa, Bar | Starting rate: RM 114/night (Total RM 457 + RM 202 taxes & charges)', 1, NOW()),
(4, 'Tropicana The Residence Suites KLCC', 'Kuala Lumpur', 'Kuala Lumpur City-Centre (KLCC), Kuala Lumpur, Malaysia (0.2 km from Petronas Twin Towers)', 5, '', '', 'Booking.com Score: 8.6 Fabulous (1,123 reviews) | Free Wi-Fi, Swimming pool, Parking, Restaurant, Fitness centre, 24-hour front desk | Starting rate: RM 262/night (Total RM 1,049 + RM 164 taxes & charges)', 1, NOW()),
(5, 'Urban Living Residence Kuala Lumpur', 'Kuala Lumpur', 'Chow Kit, Kuala Lumpur, Malaysia (0.6 km from Putra World Trade Centre)', 4, '', '', 'Booking.com Score: 7.7 Good (257 reviews) | Free Wi-Fi, Swimming pool, Parking, Fitness centre | Starting rate: RM 63/night (Total RM 253 + RM 79 taxes & charges) | Free cancellation', 1, NOW()),
(6, 'Ceylonz Suites by MyKey', 'Kuala Lumpur', 'Bukit Bintang, Kuala Lumpur, Malaysia (0.7 km from Kuala Lumpur Tower)', 4, '', '', 'Booking.com Score: 8.1 Very good (13,596 reviews) | Ranked #3 of 6 apartments in Kuala Lumpur | Free Wi-Fi, Swimming pool, Parking, Restaurant, Fitness centre, Bar | Starting rate: RM 122/night (Total RM 488 + RM 79 taxes & charges)', 1, NOW()),
(7, 'Sunway Putra Hotel Kuala Lumpur', 'Kuala Lumpur', 'Chow Kit, Kuala Lumpur, Malaysia (0.1 km from Putra World Trade Centre)', 5, '', '', 'Booking.com Score: 8.5 Very good (9,432 reviews) | Ranked #5 of 24 hotels in Kuala Lumpur | Free Wi-Fi, Swimming pool, Parking, Restaurant, Fitness centre, Bar | Starting rate: RM 284/night (Total RM 1,134 + RM 151 taxes & charges) | Free cancellation', 1, NOW()),
(8, 'Riveria City Kuala Lumpur Sentral by Archos Room', 'Kuala Lumpur', 'Brickfields (KL Sentral), Kuala Lumpur, Malaysia (0.7 km from KL Sentral)', 4, '', '', 'Booking.com Score: 7.6 Good (214 reviews) | Free Wi-Fi, Swimming pool, Parking, Fitness centre | Starting rate: RM 101/night (Total RM 406 + RM 91 taxes & charges) | Free cancellation', 1, NOW()),
(9, 'Swing & Pillows @ Imbi Bukit Bintang formerly known as Hotel 99 Kuala Lumpur', 'Kuala Lumpur', 'Bukit Bintang, Kuala Lumpur, Malaysia (1.9 km from Petronas Twin Towers)', 3, '', '', 'Booking.com Score: 7.2 Good (516 reviews) | Free Wi-Fi, 24-hour front desk, Non-smoking rooms, Lift, Laundry | Starting rate: RM 64/night (Total RM 257 + RM 26 taxes & charges)', 1, NOW());


TRUNCATE TABLE `hotel_bookings`;
INSERT INTO `hotel_bookings` (`id`, `booking_reference`, `client_id`, `hotel_id`, `room_type_id`, `room_type_name`, `check_in_date`, `check_out_date`, `guest_count`, `room_count`, `status`, `comment`, `special_requests`, `total_price`, `currency`, `checkout_task_id`, `created_by_user_id`, `created_at`) VALUES
(1, 'HB-000001', 1, 1, 1, 'Grand King Room', CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY), 1, 1, 'Confirmed', 'Client requested high floor quiet room. Airport transfer arranged by SN Travels.', 'High floor, non-smoking, late check-in ~21:00', 660.00, 'USD', NULL, 1, NOW());

-- --------------------------------------------------------
-- Seed Follow-ups (Recurring 1-2 month visa clients)
-- --------------------------------------------------------
TRUNCATE TABLE `follow_ups`;
INSERT INTO `follow_ups` (`id`, `client_id`, `title`, `reason`, `channel`, `cadence`, `due_date`, `notes`, `message_template`, `status`, `priority`, `task_id`, `assigned_user_id`, `created_by_user_id`, `created_at`) VALUES
(1, 1, 'WhatsApp: 1-Month Visa Renewal Check', '1-Month China Visa Renewal Check', 'WhatsApp', '1 Month', DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY), 'Frequent trader who visits Guangzhou wholesale markets monthly.', 'Hello, greetings from SN Travels Agency! Your China visa is due for renewal soon for your regular travel schedule. Would you like our visa desk to prepare your next visa application and schedule document pickup? Please let us know your planned travel dates.', 'Pending', 'Normal', NULL, 2, 1, NOW());

-- --------------------------------------------------------
-- Seed Settings
-- --------------------------------------------------------
TRUNCATE TABLE `settings`;
INSERT INTO `settings` (`setting_key`, `setting_value`, `updated_at`) VALUES
('agency_name', 'SN Travels Agency', NOW()),
('agency_website', 'sn-travelsagency.com', NOW()),
('agency_email', 'visa@sn-travelsagency.com', NOW()),
('agency_phone', '+971 4 399 2200', NOW()),
('country_office', 'United Arab Emirates / Regional Desks', NOW()),
('secret_login_enabled', '1', NOW()),
('secret_login_key', 'sn-secure-staff-2026', NOW());

-- --------------------------------------------------------
-- Seed Invoice Settings & Configurable Catalog Fields
-- --------------------------------------------------------
TRUNCATE TABLE `invoice_settings`;
INSERT INTO `invoice_settings` (`id`, `company_name`, `company_tagline`, `logo_url`, `phone`, `whatsapp`, `email`, `website`, `address`, `tax_number`, `bank_details`, `payment_notes`, `terms_and_conditions`, `default_currency`, `invoice_prefix`, `next_number`) VALUES
(1, 'SN Travels Agency', 'China Visa & Travel Processing Specialists', 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&auto=format&fit=crop&q=80', '+971 4 399 2200', '+971 50 123 4567', 'visa@sn-travelsagency.com', 'sn-travelsagency.com', 'Office 402, Al Hudaiba Awards Building, 2nd December St, Dubai, UAE', 'TRN-100482910400003', 'Bank: Emirates NBD\nAccount Title: SN Travels Agency LLC\nIBAN: AE24 0260 0000 0000 1234 56\nSWIFT: ENBDDBAXXX', 'Please reference your Invoice number when transferring funds. Payment due upon presentation.', '1. Embassy visa processing and biometric slots are subject to consular verification.\n2. Invoices must be cleared before document submission or passport delivery.\n3. Official receipt issued upon payment confirmation.', 'MYR', 'INV-2026-', 1004);

TRUNCATE TABLE `invoice_catalog_items`;
INSERT INTO `invoice_catalog_items` (`id`, `name`, `description`, `default_unit_price`, `category`, `is_active`, `display_order`) VALUES
(1, 'China Commercial Trade Visa (M) - 1 Year Multi-Entry', 'Includes documentation audit, PU invitation review, appointment scheduling, and consular VIP submission', 350.00, 'Visa Services', 1, 1),
(2, 'China Tourist Visa (L) Standard Processing', 'Tourist visa filing, itinerary validation, travel hotel verification, and consular courier dispatch', 180.00, 'Visa Services', 1, 2),
(3, 'Official Embassy Consular Visa Fee', 'Official government visa stamping charges (Non-refundable consular fee)', 140.00, 'Government Fees', 1, 3),
(4, 'Express Consular Priority VIP Handling', 'Next-day fast-track processing and priority consular submission lane', 85.00, 'Express Services', 1, 4),
(5, 'China Student Visa (X1/X2) Package', 'Full review of JW202/DQ form, university admission notice verification, and medical record check', 220.00, 'Visa Services', 1, 5),
(6, 'Hotel Reservation & Voucher Booking', 'Official confirmed hotel voucher for embassy submission and travel itinerary proof', 60.00, 'Travel & Accommodation', 1, 6),
(7, 'Document Legalization & Chinese Translation', 'Certified translation into Simplified Chinese by accredited legal translator', 45.00, 'Document Services', 1, 7),
(8, 'Secure Passport Return Courier Delivery', 'Insured premium diplomatic courier return delivery to client doorstep', 25.00, 'Logistics', 1, 8);

TRUNCATE TABLE `invoices`;
INSERT INTO `invoices` (`id`, `invoice_number`, `client_id`, `issue_date`, `due_date`, `status`, `payment_method`, `currency`, `subtotal`, `discount`, `tax_rate`, `tax_amount`, `total_amount`, `paid_amount`, `balance_due`, `notes`, `created_by_user_id`) VALUES
(1, 'INV-2026-1001', 1, DATE_SUB(CURRENT_DATE, INTERVAL 10 DAY), DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), 'Paid', 'Bank Transfer', 'MYR', 490.00, 0.00, 5.00, 24.50, 514.50, 514.50, 0.00, 'Client paid in full via Emirates NBD transfer.', 1),
(2, 'INV-2026-1002', 2, DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY), 'Partial', 'Credit Card', 'MYR', 240.00, 0.00, 5.00, 12.00, 252.00, 150.00, 102.00, 'Initial deposit received. Balance due upon passport collection.', 2),
(3, 'INV-2026-1003', 3, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), 'Pending', 'Bank Transfer', 'MYR', 380.00, 20.00, 5.00, 18.00, 378.00, 0.00, 378.00, 'F visa processing and express translation package. Invoice emailed to client.', 1);

TRUNCATE TABLE `invoice_items`;
INSERT INTO `invoice_items` (`id`, `invoice_id`, `catalog_item_id`, `description`, `quantity`, `unit_price`, `total`) VALUES
(1, 1, 1, 'China Commercial Trade Visa (M) - 1 Year Multi-Entry', 1, 350.00, 350.00),
(2, 1, 3, 'Official Embassy Consular Visa Fee', 1, 140.00, 140.00),
(3, 2, 2, 'China Tourist Visa (L) Standard Processing', 1, 180.00, 180.00),
(4, 2, 6, 'Hotel Reservation & Voucher Booking', 1, 60.00, 60.00),
(5, 3, 5, 'China Student Visa (X1/X2) Package', 1, 220.00, 220.00),
(6, 3, 3, 'Official Embassy Consular Visa Fee', 1, 140.00, 140.00),
(7, 3, 8, 'Secure Passport Return Courier Delivery', 1, 20.00, 20.00);

SET FOREIGN_KEY_CHECKS = 1;

