/**
 * Seed script — creates:
 *  1. Default organization
 *  2. Super admin user (admin@carpaint.com / Admin@1234)
 *  3. Full chart of accounts
 *  4. Default expense categories
 *  5. Default inventory categories
 *
 * Usage: node seeds/seed.js
 * Safe to run multiple times — checks for existence before inserting.
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DEFAULT_ORG_NAME = 'Silas Car Paint Shop';
const ADMIN_EMAIL = 'admin@carpaint.com';
const ADMIN_PASSWORD = 'Admin@1234';

// Standard chart of accounts for a paint shop
const ACCOUNTS = [
  // ASSETS
  { code: '1000', name: 'Current Assets', type: 'asset', parent_code: null },
  { code: '1010', name: 'Cash on Hand', type: 'asset', parent_code: '1000' },
  { code: '1020', name: 'Cash at Bank', type: 'asset', parent_code: '1000' },
  { code: '1030', name: 'Mobile Money', type: 'asset', parent_code: '1000' },
  { code: '1040', name: 'Accounts Receivable', type: 'asset', parent_code: '1000' },
  { code: '1050', name: 'Inventory', type: 'asset', parent_code: '1000' },
  { code: '1060', name: 'Prepaid Expenses', type: 'asset', parent_code: '1000' },
  { code: '1100', name: 'Fixed Assets', type: 'asset', parent_code: null },
  { code: '1110', name: 'Equipment', type: 'asset', parent_code: '1100' },
  { code: '1120', name: 'Furniture & Fixtures', type: 'asset', parent_code: '1100' },
  { code: '1130', name: 'Accumulated Depreciation', type: 'asset', parent_code: '1100' },
  // LIABILITIES
  { code: '2000', name: 'Current Liabilities', type: 'liability', parent_code: null },
  { code: '2010', name: 'Accounts Payable', type: 'liability', parent_code: '2000' },
  { code: '2020', name: 'Accrued Expenses', type: 'liability', parent_code: '2000' },
  { code: '2030', name: 'Taxes Payable', type: 'liability', parent_code: '2000' },
  { code: '2100', name: 'Long-Term Liabilities', type: 'liability', parent_code: null },
  { code: '2110', name: 'Bank Loan', type: 'liability', parent_code: '2100' },
  // EQUITY
  { code: '3000', name: 'Owner\'s Equity', type: 'equity', parent_code: null },
  { code: '3010', name: 'Capital', type: 'equity', parent_code: '3000' },
  { code: '3020', name: 'Retained Earnings', type: 'equity', parent_code: '3000' },
  { code: '3030', name: 'Drawings', type: 'equity', parent_code: '3000' },
  // REVENUE
  { code: '4000', name: 'Revenue', type: 'revenue', parent_code: null },
  { code: '4010', name: 'Paint Job Revenue', type: 'revenue', parent_code: '4000' },
  { code: '4020', name: 'Parts & Materials Sales', type: 'revenue', parent_code: '4000' },
  { code: '4030', name: 'Other Revenue', type: 'revenue', parent_code: '4000' },
  // EXPENSES
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', parent_code: null },
  { code: '5010', name: 'Cost of Materials (COGS)', type: 'expense', parent_code: '5000' },
  { code: '5020', name: 'Direct Labor', type: 'expense', parent_code: '5000' },
  { code: '6000', name: 'Operating Expenses', type: 'expense', parent_code: null },
  { code: '6010', name: 'Rent & Utilities', type: 'expense', parent_code: '6000' },
  { code: '6020', name: 'Salaries & Wages', type: 'expense', parent_code: '6000' },
  { code: '6030', name: 'Fuel & Transport', type: 'expense', parent_code: '6000' },
  { code: '6040', name: 'Marketing & Advertising', type: 'expense', parent_code: '6000' },
  { code: '6050', name: 'Repairs & Maintenance', type: 'expense', parent_code: '6000' },
  { code: '6060', name: 'Office Supplies', type: 'expense', parent_code: '6000' },
  { code: '6070', name: 'Miscellaneous Expenses', type: 'expense', parent_code: '6000' },
];

const EXPENSE_CATEGORIES = [
  'Rent & Utilities',
  'Salaries & Wages',
  'Fuel & Transport',
  'Marketing & Advertising',
  'Repairs & Maintenance',
  'Office Supplies',
  'Miscellaneous',
];

const INVENTORY_CATEGORIES = [
  'Paints & Primers',
  'Thinners & Solvents',
  'Sandpaper & Abrasives',
  'Masking Tape & Film',
  'Spray Equipment Parts',
  'Safety & PPE',
  'Misc Supplies',
];

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 8002,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'carpaint',
  });

  try {
    // ── 1. Organization ──────────────────────────────────────
    const [orgRows] = await connection.query(
      'SELECT id FROM organizations WHERE name = ? LIMIT 1',
      [DEFAULT_ORG_NAME]
    );

    let orgId;
    if (orgRows.length > 0) {
      orgId = orgRows[0].id;
      console.log(`ℹ️  Organization already exists (id=${orgId})`);
    } else {
      const [result] = await connection.query(
        `INSERT INTO organizations (name, address, phone, email) VALUES (?, ?, ?, ?)`,
        [DEFAULT_ORG_NAME, '123 Auto Street, Paint City', '+255-674-0100', 'info@silaspaint.com']
      );
      orgId = result.insertId;
      console.log(`✅ Organization created (id=${orgId})`);
    }

    // ── 2. Super Admin ───────────────────────────────────────
    const [userRows] = await connection.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [ADMIN_EMAIL]
    );

    if (userRows.length > 0) {
      console.log(`ℹ️  Super admin already exists`);
    } else {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await connection.query(
        `INSERT INTO users (organization_id, full_name, email, password_hash, role, is_active)
         VALUES (?, ?, ?, ?, 'super_admin', TRUE)`,
        [orgId, 'System Administrator', ADMIN_EMAIL, hash]
      );
      console.log(`✅ Super admin created — email: ${ADMIN_EMAIL} | password: ${ADMIN_PASSWORD}`);
    }

    // ── 3. Chart of Accounts ─────────────────────────────────
    // First pass: insert accounts without parent (so we can resolve parent IDs)
    const codeToId = {};

    for (const acc of ACCOUNTS) {
      const [existing] = await connection.query(
        'SELECT id FROM accounts WHERE organization_id = ? AND account_code = ?',
        [orgId, acc.code]
      );

      if (existing.length > 0) {
        codeToId[acc.code] = existing[0].id;
      } else {
        const parentId = acc.parent_code ? codeToId[acc.parent_code] || null : null;
        const [res] = await connection.query(
          `INSERT INTO accounts (organization_id, account_code, account_name, account_type, parent_id)
           VALUES (?, ?, ?, ?, ?)`,
          [orgId, acc.code, acc.name, acc.type, parentId]
        );
        codeToId[acc.code] = res.insertId;
      }
    }
    console.log(`✅ Chart of accounts seeded (${ACCOUNTS.length} accounts)`);

    // ── 4. Expense Categories ────────────────────────────────
    for (const name of EXPENSE_CATEGORIES) {
      const [existing] = await connection.query(
        'SELECT id FROM expense_categories WHERE organization_id = ? AND name = ?',
        [orgId, name]
      );
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO expense_categories (organization_id, name) VALUES (?, ?)',
          [orgId, name]
        );
      }
    }
    console.log(`✅ Expense categories seeded`);

    // ── 5. Inventory Categories ──────────────────────────────
    for (const name of INVENTORY_CATEGORIES) {
      const [existing] = await connection.query(
        'SELECT id FROM categories WHERE organization_id = ? AND name = ?',
        [orgId, name]
      );
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO categories (organization_id, name) VALUES (?, ?)',
          [orgId, name]
        );
      }
    }
    console.log(`✅ Inventory categories seeded`);

    console.log('\n🎉 Seed complete!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seed();
