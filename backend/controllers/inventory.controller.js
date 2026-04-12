const pool = require('../config/db');
const { getLowStockItems } = require('../services/inventory.service');
const { generateReference } = require('../utils/autoReference');

/* ---------------------------------------------------------------
   Helper: resolve a category string → category_id
   Finds existing category or creates a new one for this org.
--------------------------------------------------------------- */
async function resolveCategoryId(conn, orgId, categoryStr) {
  if (!categoryStr?.trim()) return null;
  const name = categoryStr.trim();
  const [existing] = await conn.query(
    'SELECT id FROM categories WHERE organization_id = ? AND name = ? LIMIT 1',
    [orgId, name]
  );
  if (existing.length) return existing[0].id;
  const [inserted] = await conn.query(
    'INSERT INTO categories (organization_id, name) VALUES (?, ?)',
    [orgId, name]
  );
  return inserted.insertId;
}

async function listItems(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT i.*, c.name AS category, s.name AS supplier_name
       FROM inventory_items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       WHERE i.organization_id = ? ORDER BY i.item_name`,
      [req.orgId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getItem(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT i.*, c.name AS category, s.name AS supplier_name
       FROM inventory_items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       WHERE i.id = ? AND i.organization_id = ? LIMIT 1`,
      [req.params.id, req.orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Item not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}

async function createItem(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      item_name,
      category = '',
      unit = 'pcs',
      quantity = 0,
      unit_cost = 0,
      reorder_level = 0,
      supplier_id,
    } = req.body;

    const resolvedCategoryId = await resolveCategoryId(conn, req.orgId, category);

    const sku = await generateReference({
      prefix: 'SKU',
      table: 'inventory_items',
      column: 'sku',
      orgId: req.orgId,
      conn,
    });

    const [result] = await conn.query(
      `INSERT INTO inventory_items
         (organization_id, item_name, sku, unit, quantity, unit_cost, reorder_level, category_id, supplier_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.orgId,
        item_name,
        sku,
        unit,
        parseFloat(quantity) || 0,
        parseFloat(unit_cost) || 0,
        parseFloat(reorder_level) || 0,
        resolvedCategoryId,
        supplier_id || null,
      ]
    );

    await conn.commit();

    const [created] = await pool.query(
      `SELECT i.*, c.name AS category, s.name AS supplier_name
       FROM inventory_items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       WHERE i.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function updateItem(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const [rows] = await conn.query(
      'SELECT * FROM inventory_items WHERE id = ? AND organization_id = ? LIMIT 1',
      [id, req.orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Item not found' });

    const { category, ...rest } = req.body;

    const updates = {};

    // Resolve category string → category_id if provided
    if (category !== undefined) {
      updates.category_id = await resolveCategoryId(conn, req.orgId, category);
    }

    // Scalar fields
    ['item_name', 'unit', 'unit_cost', 'reorder_level', 'supplier_id'].forEach((f) => {
      if (rest[f] !== undefined) updates[f] = rest[f];
    });

    if (Object.keys(updates).length) {
      const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      await conn.query(
        `UPDATE inventory_items SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
        [...Object.values(updates), id]
      );
    }

    const [updated] = await conn.query(
      `SELECT i.*, c.name AS category, s.name AS supplier_name
       FROM inventory_items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       WHERE i.id = ?`,
      [id]
    );
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
  finally { conn.release(); }
}

async function deleteItem(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT id FROM inventory_items WHERE id = ? AND organization_id = ?',
      [id, req.orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Item not found' });
    await pool.query('DELETE FROM job_materials WHERE inventory_item_id = ?', [id]);
    await pool.query('DELETE FROM inventory_items WHERE id = ?', [id]);
    res.json({ success: true, data: { message: 'Item deleted' } });
  } catch (err) { next(err); }
}

async function lowStock(req, res, next) {
  try {
    const data = await getLowStockItems(req.orgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function stockMovements(req, res, next) {
  try {
    const { item_id } = req.query;
    let sql = `SELECT sm.*, i.item_name, i.sku, u.full_name AS created_by_name
               FROM stock_movements sm
               JOIN inventory_items i ON i.id = sm.inventory_item_id
               JOIN users u ON u.id = sm.created_by
               WHERE i.organization_id = ?`;
    const params = [req.orgId];
    if (item_id) { sql += ' AND sm.inventory_item_id = ?'; params.push(item_id); }
    sql += ' ORDER BY sm.created_at DESC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function listCategories(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM categories WHERE organization_id = ? ORDER BY name',
      [req.orgId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try {
    const { name, description } = req.body;
    const [result] = await pool.query(
      'INSERT INTO categories (organization_id, name, description) VALUES (?, ?, ?)',
      [req.orgId, name, description || null]
    );
    const [created] = await pool.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) { next(err); }
}

async function deleteStockMovement(req, res, next) {
  try {
    const { id } = req.params;
    const [movements] = await pool.query(
      `SELECT sm.*, ii.id AS item_id, ii.quantity AS current_qty
       FROM stock_movements sm
       JOIN inventory_items ii ON sm.inventory_item_id = ii.id
       WHERE sm.id = ? AND ii.organization_id = ?`,
      [id, req.orgId]
    );
    if (!movements.length) return res.status(404).json({ success: false, error: 'Stock movement not found' });

    const movement = movements[0];
    let newQty;
    if (movement.movement_type === 'in') {
      newQty = parseFloat(movement.current_qty) - parseFloat(movement.quantity);
    } else {
      newQty = parseFloat(movement.current_qty) + parseFloat(movement.quantity);
    }
    if (newQty < 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete — would result in negative stock' });
    }
    await pool.query('UPDATE inventory_items SET quantity = ? WHERE id = ?', [newQty, movement.item_id]);
    await pool.query('DELETE FROM stock_movements WHERE id = ?', [id]);
    res.json({ success: true, data: { message: 'Stock movement deleted and inventory updated' } });
  } catch (err) { next(err); }
}

module.exports = {
  listItems, getItem, createItem, updateItem, deleteItem,
  lowStock, stockMovements, listCategories, createCategory, deleteStockMovement,
};
