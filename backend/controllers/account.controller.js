const pool = require('../config/db');

async function listAccounts(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, p.account_name AS parent_name
       FROM accounts a
       LEFT JOIN accounts p ON p.id = a.parent_id
       WHERE a.organization_id = ?
       ORDER BY a.account_code`,
      [req.orgId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getAccount(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM accounts WHERE id = ? AND organization_id = ? LIMIT 1',
      [req.params.id, req.orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Account not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}

async function createAccount(req, res, next) {
  try {
    const { account_code, account_name, account_type, parent_id } = req.body;

    const [dup] = await pool.query(
      'SELECT id FROM accounts WHERE organization_id = ? AND account_code = ?',
      [req.orgId, account_code]
    );
    if (dup.length) return res.status(409).json({ success: false, error: 'Account code already exists' });

    const [result] = await pool.query(
      'INSERT INTO accounts (organization_id, account_code, account_name, account_type, parent_id) VALUES (?,?,?,?,?)',
      [req.orgId, account_code, account_name, account_type, parent_id || null]
    );

    const [created] = await pool.query('SELECT * FROM accounts WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) { next(err); }
}

async function updateAccount(req, res, next) {
  try {
    const { id } = req.params;
    const { account_name, account_type, parent_id, is_active } = req.body;

    const [rows] = await pool.query(
      'SELECT * FROM accounts WHERE id = ? AND organization_id = ? LIMIT 1',
      [id, req.orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Account not found' });

    const updates = {};
    if (account_name !== undefined) updates.account_name = account_name;
    if (account_type !== undefined) updates.account_type = account_type;
    if (parent_id !== undefined) updates.parent_id = parent_id || null;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length) {
      const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      await pool.query(`UPDATE accounts SET ${setClauses} WHERE id = ? AND organization_id = ?`,
        [...Object.values(updates), id, req.orgId]);
    }

    const [updated] = await pool.query('SELECT * FROM accounts WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

module.exports = { listAccounts, getAccount, createAccount, updateAccount };
