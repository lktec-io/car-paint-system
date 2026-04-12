/**
 * Migration 004 — Replace category_id FK with plain category VARCHAR on inventory_items
 * Run: node migrations/004_inventory_category_text.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 8002,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'carpaint',
    multipleStatements: false,
  });

  try {
    // 1. Add category column if it doesn't exist
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'category'`,
      [process.env.DB_NAME || 'carpaint']
    );
    if (!cols.length) {
      await conn.query(`ALTER TABLE inventory_items ADD COLUMN category VARCHAR(100) NULL AFTER organization_id`);
      console.log('✅ Added category VARCHAR column');
    } else {
      console.log('ℹ️  category column already exists');
    }

    // 2. Find and drop FK constraint on category_id
    const [fks] = await conn.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inventory_items'
         AND COLUMN_NAME = 'category_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [process.env.DB_NAME || 'carpaint']
    );
    for (const fk of fks) {
      await conn.query(`ALTER TABLE inventory_items DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      console.log(`✅ Dropped FK constraint: ${fk.CONSTRAINT_NAME}`);
    }

    // 3. Drop category_id column if it exists
    const [catIdCols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'category_id'`,
      [process.env.DB_NAME || 'carpaint']
    );
    if (catIdCols.length) {
      await conn.query(`ALTER TABLE inventory_items DROP COLUMN category_id`);
      console.log('✅ Dropped category_id column');
    } else {
      console.log('ℹ️  category_id column already removed');
    }

    console.log('✅ Migration 004 complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
