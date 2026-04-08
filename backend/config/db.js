const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 8002,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'carpaint',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Return dates as strings to avoid timezone conversion issues
  dateStrings: true,
});

// Verify connection on startup
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL pool connected');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;
