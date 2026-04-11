require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Initialize DB pool (triggers connection test on startup)
require('./config/db');

const errorHandler = require('./middleware/errorHandler');

const authRoutes      = require('./routes/auth.routes');
const userRoutes      = require('./routes/user.routes');
const accountRoutes   = require('./routes/account.routes');
const journalRoutes   = require('./routes/journal.routes');
const reportRoutes    = require('./routes/report.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const supplierRoutes  = require('./routes/supplier.routes');
const purchaseRoutes  = require('./routes/purchase.routes');
const customerRoutes  = require('./routes/customer.routes');
const invoiceRoutes   = require('./routes/invoice.routes');
const expenseRoutes   = require('./routes/expense.routes');
const dashboardRoutes   = require('./routes/dashboard.routes');
const uploadRoutes      = require('./routes/upload.routes');

const app = express();

// ── Security & parsing middleware ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'https://silas-paint-store.nardio.online',
  credentials: true,                 // required for httpOnly cookies
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Trust proxy so req.ip works behind Nginx/load balancer
app.set('trust proxy', 1);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', ts: new Date().toISOString() } });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',            authRoutes);
app.use('/api/users',           userRoutes);
app.use('/api/accounts',        accountRoutes);
app.use('/api/journal-entries', journalRoutes);
app.use('/api/reports',         reportRoutes);
app.use('/api/inventory',       inventoryRoutes);
app.use('/api/suppliers',       supplierRoutes);
app.use('/api/purchases',       purchaseRoutes);
app.use('/api/customers',       customerRoutes);
app.use('/api/invoices',        invoiceRoutes);
app.use('/api/expenses',        expenseRoutes);
app.use('/api/dashboard',       dashboardRoutes);
app.use('/api/upload',          uploadRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 8002;
app.get('/', (req, res) => {
  res.send('Car Paint API Running 🚀');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on https://silas-paint-store.nardio.online:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
