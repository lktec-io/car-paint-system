const pool = require('../config/db');
const { deductStock } = require('../services/inventory.service');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT j.*, c.name AS customer_name, u.full_name AS technician_name
       FROM jobs j
       JOIN customers c ON c.id = j.customer_id
       LEFT JOIN users u ON u.id = j.assigned_technician_id
       WHERE j.organization_id = ? ORDER BY j.created_at DESC`,
      [req.orgId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [jobs] = await pool.query(
      `SELECT j.*, c.name AS customer_name, u.full_name AS technician_name
       FROM jobs j JOIN customers c ON c.id = j.customer_id LEFT JOIN users u ON u.id = j.assigned_technician_id
       WHERE j.id = ? AND j.organization_id = ? LIMIT 1`,
      [req.params.id, req.orgId]
    );
    if (!jobs.length) return res.status(404).json({ success: false, error: 'Job not found' });
    const [materials] = await pool.query(
      `SELECT jm.*, i.item_name, i.sku FROM job_materials jm JOIN inventory_items i ON i.id = jm.inventory_item_id WHERE jm.job_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...jobs[0], materials } });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { customer_id, vehicle_plate, vehicle_make, vehicle_model, vehicle_color, job_description, assigned_technician_id, estimated_cost, start_date, notes } = req.body;
    const [r] = await pool.query(
      `INSERT INTO jobs (organization_id, customer_id, vehicle_plate, vehicle_make, vehicle_model, vehicle_color, job_description, assigned_technician_id, status, estimated_cost, start_date, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.orgId, customer_id, vehicle_plate, vehicle_make || null, vehicle_model || null, vehicle_color || null, job_description || null, assigned_technician_id || null, 'pending', parseFloat(estimated_cost) || 0, start_date || null, notes || null, req.user.id]
    );
    req.auditEntityId = r.insertId;
    const [created] = await pool.query('SELECT * FROM jobs WHERE id = ?', [r.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM jobs WHERE id = ? AND organization_id = ? LIMIT 1', [id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Job not found' });
    req.auditOld = rows[0];
    const fields = ['vehicle_plate','vehicle_make','vehicle_model','vehicle_color','job_description','assigned_technician_id','estimated_cost','start_date','completion_date','notes','status'];
    const updates = {};
    fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (Object.keys(updates).length) {
      const s = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      await pool.query(`UPDATE jobs SET ${s}, updated_at = NOW() WHERE id = ?`, [...Object.values(updates), id]);
    }
    const [updated] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
    req.auditNew = updates;
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

    // Technicians can only update their own assigned jobs
    if (req.user.role === 'technician') {
      const [rows] = await pool.query('SELECT * FROM jobs WHERE id = ? AND organization_id = ? AND assigned_technician_id = ? LIMIT 1', [id, req.orgId, req.user.id]);
      if (!rows.length) return res.status(403).json({ success: false, error: 'Not authorized to update this job' });
    }

    const updates = { status };
    if (status === 'completed') updates.completion_date = new Date().toISOString().split('T')[0];

    const s = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await pool.query(`UPDATE jobs SET ${s}, updated_at = NOW() WHERE id = ? AND organization_id = ?`, [...Object.values(updates), id, req.orgId]);

    const [updated] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

async function addMaterials(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { materials } = req.body; // [{ inventory_item_id, quantity_used }]

    if (!Array.isArray(materials) || !materials.length) {
      return res.status(400).json({ success: false, error: 'Materials array required' });
    }

    for (const mat of materials) {
      const [inv] = await conn.query('SELECT unit_cost FROM inventory_items WHERE id = ? AND organization_id = ?', [mat.inventory_item_id, req.orgId]);
      if (!inv.length) { await conn.rollback(); return res.status(404).json({ success: false, error: `Item ${mat.inventory_item_id} not found` }); }

      const qty = parseFloat(mat.quantity_used);
      const cost = parseFloat(inv[0].unit_cost);
      const total = qty * cost;

      await conn.query(
        'INSERT INTO job_materials (job_id, inventory_item_id, quantity_used, unit_cost, total_cost) VALUES (?,?,?,?,?)',
        [id, mat.inventory_item_id, qty, cost, total]
      );

      await deductStock({ conn, itemId: mat.inventory_item_id, quantity: qty, referenceType: 'job', referenceId: parseInt(id), userId: req.user.id });
    }

    // Recalculate actual_cost
    await conn.query(
      'UPDATE jobs SET actual_cost = (SELECT COALESCE(SUM(total_cost), 0) FROM job_materials WHERE job_id = ?), updated_at = NOW() WHERE id = ?',
      [id, id]
    );

    await conn.commit();
    const [updated] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

module.exports = { list, get, create, update, updateStatus, addMaterials };
