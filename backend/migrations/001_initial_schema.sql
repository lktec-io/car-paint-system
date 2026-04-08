-- ============================================================
-- Car Paint Shop Accounting System — Initial Schema
-- Run once against a fresh database
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ──────────────────────────────────────────────
-- ORGANIZATIONS (multi-tenant root)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  address       TEXT,
  phone         VARCHAR(30),
  email         VARCHAR(150),
  logo_url      VARCHAR(500),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- USERS & AUTH
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  full_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('super_admin','accountant','store_manager','sales_officer','technician','viewer') NOT NULL DEFAULT 'viewer',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_org (organization_id),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- CHART OF ACCOUNTS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  account_code    VARCHAR(20) NOT NULL,
  account_name    VARCHAR(150) NOT NULL,
  account_type    ENUM('asset','liability','equity','revenue','expense') NOT NULL,
  parent_id       INT UNSIGNED,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_code_org (organization_id, account_code),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL,
  INDEX idx_org (organization_id),
  INDEX idx_type (account_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- JOURNAL ENTRIES (immutable once posted)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id  INT UNSIGNED NOT NULL,
  entry_date       DATE NOT NULL,
  reference_number VARCHAR(30) NOT NULL,
  description      TEXT,
  source_type      ENUM('manual','sale','purchase','expense','job') NOT NULL DEFAULT 'manual',
  source_id        INT UNSIGNED,
  status           ENUM('draft','posted') NOT NULL DEFAULT 'draft',
  created_by       INT UNSIGNED NOT NULL,
  posted_by        INT UNSIGNED,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (posted_by) REFERENCES users(id),
  INDEX idx_org (organization_id),
  INDEX idx_date (entry_date),
  INDEX idx_ref (reference_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  journal_entry_id  INT UNSIGNED NOT NULL,
  account_id        INT UNSIGNED NOT NULL,
  debit             DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  credit            DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  description       VARCHAR(255),
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  INDEX idx_entry (journal_entry_id),
  INDEX idx_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- INVENTORY
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS suppliers (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id     INT UNSIGNED NOT NULL,
  name                VARCHAR(150) NOT NULL,
  contact_person      VARCHAR(150),
  phone               VARCHAR(30),
  email               VARCHAR(150),
  address             TEXT,
  outstanding_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  category_id     INT UNSIGNED,
  supplier_id     INT UNSIGNED,
  item_name       VARCHAR(150) NOT NULL,
  sku             VARCHAR(50) NOT NULL,
  unit            VARCHAR(30) NOT NULL DEFAULT 'pcs',
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  unit_cost       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  reorder_level   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sku_org (organization_id, sku),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  INDEX idx_org (organization_id),
  INDEX idx_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stock_movements (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inventory_item_id   INT UNSIGNED NOT NULL,
  movement_type       ENUM('in','out','adjustment') NOT NULL,
  quantity            DECIMAL(10,2) NOT NULL,
  reference_type      ENUM('purchase','sale','job','adjustment') NOT NULL,
  reference_id        INT UNSIGNED NOT NULL,
  notes               TEXT,
  created_by          INT UNSIGNED NOT NULL,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_item (inventory_item_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- PURCHASES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id  INT UNSIGNED NOT NULL,
  supplier_id      INT UNSIGNED NOT NULL,
  purchase_date    DATE NOT NULL,
  invoice_number   VARCHAR(50),
  total_amount     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  amount_paid      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status           ENUM('pending','partial','paid') NOT NULL DEFAULT 'pending',
  notes            TEXT,
  journal_entry_id INT UNSIGNED,
  created_by       INT UNSIGNED NOT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_org (organization_id),
  INDEX idx_date (purchase_date),
  INDEX idx_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_items (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id         INT UNSIGNED NOT NULL,
  inventory_item_id   INT UNSIGNED NOT NULL,
  quantity            DECIMAL(10,2) NOT NULL,
  unit_cost           DECIMAL(10,2) NOT NULL,
  total               DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  INDEX idx_purchase (purchase_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- SALES & INVOICES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name            VARCHAR(150) NOT NULL,
  phone           VARCHAR(30),
  email           VARCHAR(150),
  address         TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id  INT UNSIGNED NOT NULL,
  customer_id      INT UNSIGNED,
  invoice_number   VARCHAR(30) NOT NULL,
  invoice_date     DATE NOT NULL,
  due_date         DATE NOT NULL,
  subtotal         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  tax_percent      DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  total_amount     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  amount_paid      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  payment_method   ENUM('cash','mobile','bank','credit') NOT NULL DEFAULT 'cash',
  status           ENUM('draft','sent','partial','paid','overdue') NOT NULL DEFAULT 'draft',
  notes            TEXT,
  job_id           INT UNSIGNED,
  journal_entry_id INT UNSIGNED,
  created_by       INT UNSIGNED NOT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inv_org (organization_id, invoice_number),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_org (organization_id),
  INDEX idx_date (invoice_date),
  INDEX idx_status (status),
  INDEX idx_number (invoice_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_items (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id          INT UNSIGNED NOT NULL,
  inventory_item_id   INT UNSIGNED,
  description         VARCHAR(255) NOT NULL,
  quantity            DECIMAL(10,2) NOT NULL,
  unit_price          DECIMAL(10,2) NOT NULL,
  total               DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL,
  INDEX idx_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- EXPENSES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name            VARCHAR(100) NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id       INT UNSIGNED NOT NULL,
  expense_category_id   INT UNSIGNED NOT NULL,
  amount                DECIMAL(15,2) NOT NULL,
  expense_date          DATE NOT NULL,
  description           TEXT,
  payment_method        ENUM('cash','mobile','bank') NOT NULL DEFAULT 'cash',
  receipt_url           VARCHAR(500),
  journal_entry_id      INT UNSIGNED,
  created_by            INT UNSIGNED NOT NULL,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id),
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_org (organization_id),
  INDEX idx_date (expense_date),
  INDEX idx_category (expense_category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- JOBS (car painting)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id         INT UNSIGNED NOT NULL,
  customer_id             INT UNSIGNED NOT NULL,
  vehicle_plate           VARCHAR(30) NOT NULL,
  vehicle_make            VARCHAR(80),
  vehicle_model           VARCHAR(80),
  vehicle_color           VARCHAR(50),
  job_description         TEXT,
  assigned_technician_id  INT UNSIGNED,
  status                  ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  estimated_cost          DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  actual_cost             DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  start_date              DATE,
  completion_date         DATE,
  notes                   TEXT,
  invoice_id              INT UNSIGNED,
  created_by              INT UNSIGNED NOT NULL,
  created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (assigned_technician_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_org (organization_id),
  INDEX idx_status (status),
  INDEX idx_plate (vehicle_plate),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS job_materials (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_id              INT UNSIGNED NOT NULL,
  inventory_item_id   INT UNSIGNED NOT NULL,
  quantity_used       DECIMAL(10,2) NOT NULL,
  unit_cost           DECIMAL(10,2) NOT NULL,
  total_cost          DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  INDEX idx_job (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- AUDIT LOG
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  action          VARCHAR(50) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       INT UNSIGNED,
  old_values      JSON,
  new_values      JSON,
  ip_address      VARCHAR(45),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_org (organization_id),
  INDEX idx_user (user_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
