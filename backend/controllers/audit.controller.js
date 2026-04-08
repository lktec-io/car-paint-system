const pool = require('../config/db');

async function list(req, res, next) {
  try {
    const { user_id, entity_type, action, from, to, page = 1, limit = 50 } = req.query;
    const params = [req.orgId];
    const where = ['al.organization_id = ?'];

    if (user_id)     { where.push('al.user_id = ?');      params.push(parseInt(user_id)); }
    if (entity_type) { where.push('al.entity_type = ?');  params.push(entity_type); }
    if (action)      { where.push('al.action = ?');       params.push(action); }
    if (from)        { where.push('al.created_at >= ?');  params.push(from + ' 00:00:00'); }
    if (to)          { where.push('al.created_at <= ?');  params.push(to   + ' 23:59:59'); }

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs al WHERE ${where.join(' AND ')}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT al.id, al.action, al.entity_type, al.entity_id,
              al.old_values, al.new_values, al.ip_address, al.created_at,
              u.full_name AS user_name, u.email AS user_email
       FROM audit_logs al
       JOIN users u ON u.id = al.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
}

async function pollNotifications(req, res, next) {
  try {
    const orgId = req.orgId;
    const today = new Date().toISOString().split('T')[0];

    const [[{ lowStock }]] = await pool.query(
      `SELECT COUNT(*) AS lowStock FROM inventory_items WHERE organization_id = ? AND quantity <= reorder_level`,
      [orgId]
    );

    const [[{ overdueInvoices }]] = await pool.query(
      `SELECT COUNT(*) AS overdueInvoices FROM invoices
       WHERE organization_id = ? AND status NOT IN ('paid','cancelled') AND due_date < ?`,
      [orgId, today]
    );

    const since24h = new Date(Date.now() - 86400000).toISOString().replace('T', ' ').split('.')[0];
    const [[{ completedJobs }]] = await pool.query(
      `SELECT COUNT(*) AS completedJobs FROM jobs
       WHERE organization_id = ? AND status = 'completed' AND updated_at >= ?`,
      [orgId, since24h]
    );

    // Build notification items
    const notifications = [];
    if (parseInt(lowStock) > 0) {
      notifications.push({
        id: 'low-stock',
        type: 'warning',
        message: `${lowStock} item${lowStock > 1 ? 's' : ''} low on stock`,
      });
    }
    if (parseInt(overdueInvoices) > 0) {
      notifications.push({
        id: 'overdue-inv',
        type: 'danger',
        message: `${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''}`,
      });
    }
    if (parseInt(completedJobs) > 0) {
      notifications.push({
        id: 'completed-jobs',
        type: 'success',
        message: `${completedJobs} job${completedJobs > 1 ? 's' : ''} completed in last 24h`,
      });
    }

    res.json({ success: true, data: { notifications, counts: { lowStock, overdueInvoices, completedJobs } } });
  } catch (err) { next(err); }
}

module.exports = { list, pollNotifications };
