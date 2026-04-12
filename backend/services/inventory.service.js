const pool = require('../config/db');

/**
 * Deduct stock for a given item. Throws if insufficient quantity.
 * Must be called inside an existing transaction (conn).
 */
async function deductStock({ conn, itemId, quantity, referenceType, referenceId, userId, notes }) {
  const db = conn || pool;
  const [rows] = await db.query(
    'SELECT quantity FROM inventory_items WHERE id = ? FOR UPDATE',
    [itemId]
  );
  if (!rows.length) throw Object.assign(new Error(`Inventory item ${itemId} not found`), { status: 404 });

  const current = parseFloat(rows[0].quantity);
  const qty = parseFloat(quantity);

  if (current < qty) {
    throw Object.assign(
      new Error(`Insufficient stock for item ${itemId}: available ${current}, requested ${qty}`),
      { status: 400 }
    );
  }

  await db.query(
    'UPDATE inventory_items SET quantity = quantity - ?, updated_at = NOW() WHERE id = ?',
    [qty, itemId]
  );

  await db.query(
    `INSERT INTO stock_movements (inventory_item_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
     VALUES (?, 'out', ?, ?, ?, ?, ?)`,
    [itemId, qty, referenceType, referenceId, notes || null, userId]
  );
}

/**
 * Add stock (for purchases or adjustments).
 */
async function addStock({ conn, itemId, quantity, referenceType, referenceId, userId, notes, newUnitCost }) {
  const db = conn || pool;

  const updates = ['quantity = quantity + ?'];
  const params  = [parseFloat(quantity)];

  if (newUnitCost !== undefined) {
    updates.push('unit_cost = ?');
    params.push(parseFloat(newUnitCost));
  }

  params.push(itemId);
  await db.query(`UPDATE inventory_items SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);

  await db.query(
    `INSERT INTO stock_movements (inventory_item_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
     VALUES (?, 'in', ?, ?, ?, ?, ?)`,
    [itemId, parseFloat(quantity), referenceType, referenceId, notes || null, userId]
  );
}

/**
 * Returns items where quantity <= reorder_level.
 */
async function getLowStockItems(orgId) {
  const [rows] = await pool.query(
    `SELECT i.*, c.name AS category, s.name AS supplier_name
     FROM inventory_items i
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN suppliers s ON s.id = i.supplier_id
     WHERE i.organization_id = ? AND i.quantity <= i.reorder_level
     ORDER BY (i.quantity / NULLIF(i.reorder_level, 0)) ASC`,
    [orgId]
  );
  return rows;
}

module.exports = { deductStock, addStock, getLowStockItems };
