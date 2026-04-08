/**
 * Migration runner — reads 001_initial_schema.sql and executes it.
 * Usage: node migrations/run.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 8001,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'car_paint_accounting',
    multipleStatements: true,
  });

  try {
    const sql = fs.readFileSync(path.join(__dirname, '001_initial_schema.sql'), 'utf8');
    await connection.query(sql);
    console.log('✅ Migrations applied successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
