const pool = require('../config/db');
const { addStock } = require('../services/inventory.service');
const { createJournalEntry } = require('../services/accounting.service');
const { generateReference } = require('../utils/autoReference');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, s.name AS supplier_name, u.full_name AS created_by_name
       FROM purchases p JOIN suppliers s ON s.id = p.supplier_id JOIN users u ON u.id = p.created_by
       WHERE p.organization_id = ? ORDER BY p.purchase_date DESC`,
      [req.orgId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [purchases] = await pool.query(
      `SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.id = ? AND p.organization_id = ? LIMIT 1`,
      [req.params.id, req.orgId]
    );
    if (!purchases.length) return res.status(404).json({ success: false, error: 'Purchase not found' });
    const [items] = await pool.query(
      `SELECT pi.*, i.item_name, i.sku FROM purchase_items pi JOIN inventory_items i ON i.id = pi.inventory_item_id
       WHERE pi.purchase_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...purchases[0], items } });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { supplier_id, purchase_date, invoice_number, amount_paid, notes, items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'At least one item required' });
    }

    const total_amount = items.reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.unit_cost), 0);
    const paid = parseFloat(amount_paid) || 0;
    const status = paid >= total_amount ? 'paid' : paid > 0 ? 'partial' : 'pending';

    const [purchResult] = await conn.query(
      `INSERT INTO purchases (organization_id, supplier_id, purchase_date, invoice_number, total_amount, amount_paid, status, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [req.orgId, supplier_id, purchase_date, invoice_number || null, total_amount, paid, status, notes || null, req.user.id]
    );
    const purchId = purchResult.insertId;

    // Insert items, update inventory, record stock movements
    for (const item of items) {
      const qty  = parseFloat(item.quantity);
      const cost = parseFloat(item.unit_cost);
      const tot  = qty * cost;

      await conn.query(
        'INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost, total) VALUES (?,?,?,?,?)',
        [purchId, item.inventory_item_id, qty, cost, tot]
      );

      await addStock({ conn, itemId: item.inventory_item_id, quantity: qty, referenceType: 'purchase', referenceId: purchId, userId: req.user.id, newUnitCost: cost });
    }

    // Auto journal entry: DR Inventory / CR Cash or Accounts Payable
    const [accounts] = await conn.query(
      `SELECT account_code, id FROM accounts WHERE organization_id = ? AND account_code IN ('1050','1010','2010') AND is_active = TRUE`,
      [req.orgId]
    );
    const acctMap = {};
    accounts.forEach((a) => { acctMap[a.account_code] = a.id; });

    if (acctMap['1050']) {
      const creditAcct = paid >= total_amount ? (acctMap['1010'] || acctMap['2010']) : acctMap['2010'];
      if (creditAcct) {
        const jeId = await createJournalEntry({
          conn, orgId: req.orgId, userId: req.user.id,
          entryDate: purchase_date,
          description: `Purchase from supplier #${supplier_id} — PO`,
          sourceType: 'purchase', sourceId: purchId,
          lines: [
            { account_id: acctMap['1050'], debit: total_amount, credit: 0, description: 'Inventory purchase' },
            { account_id: creditAcct, debit: 0, credit: total_amount, description: paid >= total_amount ? 'Cash payment' : 'Accounts payable' },
          ],
        });
        await conn.query('UPDATE purchases SET journal_entry_id = ? WHERE id = ?', [jeId, purchId]);
      }
    }

    // Update supplier outstanding balance if not fully paid
    if (status !== 'paid') {
      await conn.query(
        'UPDATE suppliers SET outstanding_balance = outstanding_balance + ?, updated_at = NOW() WHERE id = ?',
        [total_amount - paid, supplier_id]
      );
    }

    await conn.commit();

    const [created] = await pool.query('SELECT * FROM purchases WHERE id = ?', [purchId]);
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
    const [rows] = await pool.query('SELECT * FROM purchases WHERE id = ? AND organization_id = ? LIMIT 1', [id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Purchase not found' });

    const { amount_paid, notes, status } = req.body;
    const updates = {};
    if (amount_paid !== undefined) {
      updates.amount_paid = parseFloat(amount_paid);
      const total = parseFloat(rows[0].total_amount);
      const paid  = parseFloat(amount_paid);
      updates.status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending';

      // Adjust supplier balance
      const balanceDiff = parseFloat(rows[0].amount_paid) - paid;
      if (balanceDiff !== 0) {
        await pool.query('UPDATE suppliers SET outstanding_balance = outstanding_balance + ?, updated_at = NOW() WHERE id = ?', [balanceDiff, rows[0].supplier_id]);
      }
    }
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length) {
      const s = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      await pool.query(`UPDATE purchases SET ${s} WHERE id = ?`, [...Object.values(updates), id]);
    }
    const [updated] = await pool.query('SELECT * FROM purchases WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update };
