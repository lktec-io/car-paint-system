const pool = require('../config/db');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE organization_id = ? ORDER BY name', [req.orgId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ? AND organization_id = ? LIMIT 1', [req.params.id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Customer not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, phone, email, address } = req.body;
    const [r] = await pool.query(
      'INSERT INTO customers (organization_id, name, phone, email, address) VALUES (?,?,?,?,?)',
      [req.orgId, name, phone || null, email || null, address || null]
    );
    req.auditEntityId = r.insertId;
    const [created] = await pool.query('SELECT * FROM customers WHERE id = ?', [r.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ? AND organization_id = ? LIMIT 1', [id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Customer not found' });
    const { name, phone, email, address } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (Object.keys(updates).length) {
      const s = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      await pool.query(`UPDATE customers SET ${s} WHERE id = ?`, [...Object.values(updates), id]);
    }
    const [updated] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update };
