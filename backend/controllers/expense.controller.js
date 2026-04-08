const pool = require('../config/db');
const { createJournalEntry } = require('../services/accounting.service');

async function listCategories(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM expense_categories WHERE organization_id = ? ORDER BY name', [req.orgId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try {
    const [r] = await pool.query('INSERT INTO expense_categories (organization_id, name) VALUES (?,?)', [req.orgId, req.body.name]);
    const [created] = await pool.query('SELECT * FROM expense_categories WHERE id = ?', [r.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, ec.name AS category_name, u.full_name AS created_by_name
       FROM expenses e JOIN expense_categories ec ON ec.id = e.expense_category_id JOIN users u ON u.id = e.created_by
       WHERE e.organization_id = ? ORDER BY e.expense_date DESC`,
      [req.orgId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { expense_category_id, amount, expense_date, description, payment_method } = req.body;

    const [r] = await conn.query(
      'INSERT INTO expenses (organization_id, expense_category_id, amount, expense_date, description, payment_method, created_by) VALUES (?,?,?,?,?,?,?)',
      [req.orgId, expense_category_id, parseFloat(amount), expense_date, description || null, payment_method || 'cash', req.user.id]
    );
    const expId = r.insertId;

    // Auto journal entry: DR Expense / CR Cash
    const [accounts] = await conn.query(
      `SELECT account_code, id FROM accounts WHERE organization_id = ? AND account_code IN ('6070','1010','1020','1030') AND is_active = TRUE`,
      [req.orgId]
    );
    const acct = {};
    accounts.forEach((a) => { acct[a.account_code] = a.id; });

    // Use generic operating expense account; real apps would map category to account
    const expenseAcctId = acct['6070'];
    const cashAcctId = { cash: acct['1010'], mobile: acct['1030'], bank: acct['1020'] }[payment_method] || acct['1010'];

    if (expenseAcctId && cashAcctId) {
      const jeId = await createJournalEntry({
        conn, orgId: req.orgId, userId: req.user.id,
        entryDate: expense_date, description: description || 'Expense',
        sourceType: 'expense', sourceId: expId,
        lines: [
          { account_id: expenseAcctId, debit: parseFloat(amount), credit: 0, description },
          { account_id: cashAcctId, debit: 0, credit: parseFloat(amount), description: `Payment - ${payment_method}` },
        ],
      });
      await conn.query('UPDATE expenses SET journal_entry_id = ? WHERE id = ?', [jeId, expId]);
    }

    await conn.commit();
    req.auditEntityId = expId;
    const [created] = await pool.query('SELECT * FROM expenses WHERE id = ?', [expId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM expenses WHERE id = ? AND organization_id = ? LIMIT 1', [id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Expense not found' });
    const { description } = req.body;
    if (description !== undefined) await pool.query('UPDATE expenses SET description = ? WHERE id = ?', [description, id]);
    const [updated] = await pool.query('SELECT * FROM expenses WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id FROM expenses WHERE id = ? AND organization_id = ?', [id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Expense not found' });
    await pool.query('DELETE FROM expenses WHERE id = ?', [id]);
    req.auditEntityId = id;
    res.json({ success: true, data: { message: 'Deleted' } });
  } catch (err) { next(err); }
}

module.exports = { listCategories, createCategory, list, create, update, remove };
