const pool = require('../config/db');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE organization_id = ? ORDER BY name', [req.orgId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ? AND organization_id = ? LIMIT 1', [req.params.id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, contact_person, phone, email, address } = req.body;
    const [r] = await pool.query(
      'INSERT INTO suppliers (organization_id, name, contact_person, phone, email, address) VALUES (?,?,?,?,?,?)',
      [req.orgId, name, contact_person || null, phone || null, email || null, address || null]
    );
    req.auditEntityId = r.insertId;
    const [created] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [r.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ? AND organization_id = ? LIMIT 1', [id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Supplier not found' });
    req.auditOld = rows[0];

    const fields = ['name', 'contact_person', 'phone', 'email', 'address'];
    const updates = {};
    fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (Object.keys(updates).length) {
      const s = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      await pool.query(`UPDATE suppliers SET ${s}, updated_at = NOW() WHERE id = ?`, [...Object.values(updates), id]);
    }
    const [updated] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    req.auditNew = updates;
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id FROM suppliers WHERE id = ? AND organization_id = ?', [id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Supplier not found' });
    await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
    req.auditEntityId = id;
    res.json({ success: true, data: { message: 'Supplier deleted' } });
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update, remove };
