const pool = require('../config/db');
const { hashPassword } = require('../utils/hashPassword');

async function listUsers(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, email, role, is_active, last_login, created_at
       FROM users WHERE organization_id = ? ORDER BY created_at DESC`,
      [req.orgId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getUser(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, email, role, is_active, last_login, created_at
       FROM users WHERE id = ? AND organization_id = ? LIMIT 1`,
      [req.params.id, req.orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}

async function createUser(req, res, next) {
  try {
    const { full_name, email, password, role } = req.body;

    // Prevent duplicate email within the org (email is globally unique by DB constraint)
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ success: false, error: 'Email already in use' });
    }

    const hash = await hashPassword(password);
    const [result] = await pool.query(
      `INSERT INTO users (organization_id, full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [req.orgId, full_name, email, hash, role]
    );

    req.auditEntityId = result.insertId;
    req.auditNew = { full_name, email, role };

    const [created] = await pool.query(
      'SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ success: true, data: created[0] });
  } catch (err) { next(err); }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { full_name, email, password, role, is_active } = req.body;

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND organization_id = ? LIMIT 1',
      [id, req.orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });

    // Prevent super_admin from deactivating themselves
    if (parseInt(id) === req.user.id && is_active === false) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
    }

    req.auditOld = { full_name: rows[0].full_name, email: rows[0].email, role: rows[0].role, is_active: rows[0].is_active };

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    if (password) updates.password_hash = await hashPassword(password);

    if (!Object.keys(updates).length) {
      return res.json({ success: true, data: rows[0] });
    }

    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await pool.query(
      `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [...Object.values(updates), id, req.orgId]
    );

    req.auditNew = updates;

    const [updated] = await pool.query(
      'SELECT id, full_name, email, role, is_active, last_login, created_at FROM users WHERE id = ?',
      [id]
    );
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE id = ? AND organization_id = ? LIMIT 1',
      [id, req.orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });

    // Soft delete: deactivate instead of hard delete to preserve referential integrity
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);
    req.auditEntityId = id;

    res.json({ success: true, data: { message: 'User deactivated' } });
  } catch (err) { next(err); }
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
