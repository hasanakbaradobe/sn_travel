# SN Travels Agency — MySQL Database Documentation
**Company**: SN Travels Agency  
**Official Website**: sn-travelsagency.com  
**Application**: China Visa Client Management System  
**Database Engine**: MySQL 8.0+ / MariaDB 10.4+  
**Database Management Interface**: phpMyAdmin  

---

## 1. Quick Setup in phpMyAdmin

1. Log in to your **phpMyAdmin** dashboard.
2. Click **New** in the left sidebar to create a database:
   - Name: `sn_travels_visa`
   - Collation: `utf8mb4_unicode_ci`
3. Click on the newly created `sn_travels_visa` database.
4. Click the **Import** tab at the top.
5. Choose `database/schema.sql` and click **Go** to create all tables, indexes, and foreign keys.
6. Choose `database/seed.sql` and click **Go** to populate initial users, visa types, clients, applications, tasks, and custom fields.
7. Set up your MySQL credentials in `.env` or server environment variables:
   ```env
   DB_HOST="localhost"
   DB_PORT="3306"
   DB_NAME="sn_travels_visa"
   DB_USER="sn_travels_user"
   DB_PASSWORD="your_password"
   ```

---

## 2. Default Seed Accounts

| Role | Email | Password | Access Rights |
|---|---|---|---|
| **Super Admin** | `admin@sn-travelsagency.com` | `admin123456` | Full system control: User management, visa types, custom client fields, settings, reports, all client and application records. |
| **Staff** | `staff@sn-travelsagency.com` | `staff123456` | Daily visa operations: Clients, China visa applications, status workflow, tasks, calendar, comments. |
| **Staff** | `lin.chen@sn-travelsagency.com` | `staff123456` | China Desk Specialist: Applications, tasks, calendar, client profiles. |

---

## 3. Database Architecture & Relationships

```
 users (id)
   ├─► visa_applications (assigned_user_id)
   ├─► tasks (assigned_user_id)
   ├─► comments (user_id)
   ├─► application_status_history (changed_by_user_id)
   └─► activity_logs (user_id)

 clients (id)
   ├─► visa_applications (client_id)
   ├─► client_custom_field_values (client_id)
   ├─► tasks (client_id)
   └─► comments (client_id)

 client_custom_fields (id)
   └─► client_custom_field_values (field_id)

 visa_types (id)
   └─► visa_applications (visa_type_id)

 visa_applications (id)
   ├─► application_status_history (application_id)
   ├─► tasks (application_id)
   └─► comments (application_id)
```

---

## 4. Tables & Schema Specifications

### `users`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `name` VARCHAR(150) NOT NULL
- `email` VARCHAR(191) NOT NULL UNIQUE (Indexed)
- `password_hash` VARCHAR(255) NOT NULL
- `role` ENUM('super_admin', 'staff') NOT NULL DEFAULT 'staff'
- `is_active` TINYINT(1) NOT NULL DEFAULT 1
- `created_at`, `updated_at` TIMESTAMP

### `clients`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `client_id` VARCHAR(30) NOT NULL UNIQUE (e.g. `CL-000001`)
- `full_name` VARCHAR(200) NOT NULL (Indexed)
- `passport_number` VARCHAR(100) NOT NULL (Indexed)
- `country` VARCHAR(100) NOT NULL (Indexed)
- `phone`, `whatsapp`, `email`, `date_of_birth`, `address`, `occupation`, `notes`
- `google_drive_url` VARCHAR(500) (Google Drive folder URL)
- `photo_url` VARCHAR(500) (Client profile / visa photo — supports Google Drive shareable links & web images with auto-preview)
- `created_at`, `updated_at` TIMESTAMP

### `client_custom_fields`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `field_name` VARCHAR(100) NOT NULL UNIQUE
- `field_label` VARCHAR(150) NOT NULL
- `field_type` ENUM('text', 'long_text', 'number', 'date', 'dropdown', 'checkbox') NOT NULL
- `field_options` TEXT (for dropdown options)
- `is_required` TINYINT(1) DEFAULT 0
- `is_active` TINYINT(1) DEFAULT 1
- `display_order` INT DEFAULT 0 (Indexed)

### `client_custom_field_values`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `client_id` INT NOT NULL (Foreign Key -> `clients.id`)
- `field_id` INT NOT NULL (Foreign Key -> `client_custom_fields.id`)
- `field_value` TEXT
- `UNIQUE KEY (client_id, field_id)`

### `visa_types`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `name` VARCHAR(100) NOT NULL UNIQUE
- `description` VARCHAR(255)
- `is_active` TINYINT(1) DEFAULT 1

### `visa_applications`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `application_id` VARCHAR(30) NOT NULL UNIQUE (e.g. `APP-000001`)
- `client_id` INT NOT NULL (Foreign Key -> `clients.id`)
- `visa_type_id` INT NOT NULL (Foreign Key -> `visa_types.id`)
- `status` ENUM('Upcoming', 'File Missing', 'Need to Prepare', 'Prepared', 'Under Review', 'Online Review Completed', 'Modify', 'Pending Collection', 'Rejected')
- `delivery_date` DATE (Revealed on 'Online Review Completed')
- `notes` TEXT
- `assigned_user_id` INT (Foreign Key -> `users.id`)

### `application_status_history`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `application_id` INT NOT NULL (Foreign Key -> `visa_applications.id`)
- `old_status`, `new_status`, `delivery_date`, `changed_by_user_id`, `notes`, `created_at`

### `tasks`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `title` VARCHAR(255) NOT NULL
- `description` TEXT
- `client_id` INT NULL
- `application_id` INT NULL
- `assigned_user_id` INT NULL
- `due_date` DATE NOT NULL (Indexed)
- `priority` ENUM('Low', 'Normal', 'High', 'Urgent')
- `status` ENUM('Pending', 'Completed') (Indexed)
- `is_delivery_task` TINYINT(1) DEFAULT 0
- `completed_at` DATETIME NULL

### `comments`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `client_id` INT NOT NULL
- `application_id` INT NULL
- `user_id` INT NOT NULL
- `message` TEXT NOT NULL
- `created_at` TIMESTAMP

### `activity_logs`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `user_id` INT NULL
- `action` VARCHAR(100) NOT NULL
- `entity_type` VARCHAR(50) NOT NULL
- `entity_id` INT NULL
- `details` TEXT
- `created_at` TIMESTAMP
