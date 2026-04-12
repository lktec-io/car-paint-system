const pool = require('../config/db');

async function getSummary(req, res, next) {
  try {
    const orgId = req.orgId;
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    const [[revenue]] = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(amount_paid),0) AS paid
       FROM invoices WHERE organization_id = ? AND invoice_date >= ?`,
      [orgId, monthStart]
    );

    const [[expenses]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE organization_id = ? AND expense_date >= ?`,
      [orgId, monthStart]
    );

    const [[invoiceStats]] = await pool.query(
      `SELECT
         SUM(status = 'sent') AS sent,
         SUM(status = 'partial') AS partial,
         SUM(status = 'paid') AS paid,
         SUM(status = 'overdue') AS overdue,
         COALESCE(SUM(total_amount - amount_paid),0) AS outstanding
       FROM invoices WHERE organization_id = ?`,
      [orgId]
    );

    const [lowStock] = await pool.query(
      `SELECT id, item_name, quantity, reorder_level FROM inventory_items
       WHERE organization_id = ? AND quantity <= reorder_level ORDER BY quantity ASC LIMIT 5`,
      [orgId]
    );

    res.json({
      success: true,
      data: {
        revenue: { month: parseFloat(revenue.total), collected: parseFloat(revenue.paid) },
        expenses: { month: parseFloat(expenses.total) },
        profit:   { month: parseFloat(revenue.paid) - parseFloat(expenses.total) },
        invoices: invoiceStats,
        lowStock,
      },
    });
  } catch (err) { next(err); }
}

async function getRevenueChart(req, res, next) {
  try {
    const orgId = req.orgId;
    const months = parseInt(req.query.months) || 6;
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(invoice_date, '%Y-%m') AS month,
              COALESCE(SUM(total_amount),0) AS revenue,
              COALESCE(SUM(amount_paid),0)  AS collected
       FROM invoices
       WHERE organization_id = ? AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
       ORDER BY month ASC`,
      [orgId, months]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getExpenseChart(req, res, next) {
  try {
    const orgId = req.orgId;
    const months = parseInt(req.query.months) || 6;
    const [rows] = await pool.query(
      `SELECT ec.name AS category, COALESCE(SUM(e.amount),0) AS total
       FROM expenses e JOIN expense_categories ec ON ec.id = e.expense_category_id
       WHERE e.organization_id = ? AND e.expense_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY ec.name ORDER BY total DESC LIMIT 8`,
      [orgId, months]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getRecentActivity(req, res, next) {
  try {
    const orgId = req.orgId;
    const [invoices] = await pool.query(
      `SELECT 'invoice' AS type, invoice_number AS ref, total_amount AS amount, invoice_date AS date, status,
              COALESCE(i.customer_name, c.name, 'Walk-in') AS customer_name
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.organization_id = ? ORDER BY i.created_at DESC LIMIT 5`,
      [orgId]
    );
    const [expenses] = await pool.query(
      `SELECT 'expense' AS type, ec.name AS ref, e.amount, e.expense_date AS date, 'expense' AS status, NULL AS customer_name
       FROM expenses e JOIN expense_categories ec ON ec.id = e.expense_category_id
       WHERE e.organization_id = ? ORDER BY e.created_at DESC LIMIT 5`,
      [orgId]
    );
    const combined = [...invoices, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    res.json({ success: true, data: combined });
  } catch (err) { next(err); }
}

module.exports = { getSummary, getRevenueChart, getExpenseChart, getRecentActivity };
