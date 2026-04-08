const pool = require('../config/db');
const { deductStock } = require('../services/inventory.service');
const { createJournalEntry } = require('../services/accounting.service');
const { generateReference } = require('../utils/autoReference');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT i.*, c.name AS customer_name, u.full_name AS created_by_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       JOIN users u ON u.id = i.created_by
       WHERE i.organization_id = ? ORDER BY i.invoice_date DESC`,
      [req.orgId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [invoices] = await pool.query(
      `SELECT i.*, c.name AS customer_name FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.id = ? AND i.organization_id = ? LIMIT 1`,
      [req.params.id, req.orgId]
    );
    if (!invoices.length) return res.status(404).json({ success: false, error: 'Invoice not found' });
    const [items] = await pool.query(
      `SELECT ii.*, inv.item_name, inv.sku FROM invoice_items ii LEFT JOIN inventory_items inv ON inv.id = ii.inventory_item_id
       WHERE ii.invoice_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...invoices[0], items } });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { customer_id, invoice_date, due_date, discount_percent, tax_percent, payment_method, notes, items, job_id } = req.body;

    if (!Array.isArray(items) || !items.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'At least one line item required' });
    }

    // Validate stock availability upfront
    for (const item of items) {
      if (item.inventory_item_id) {
        const [inv] = await conn.query('SELECT quantity, item_name FROM inventory_items WHERE id = ? FOR UPDATE', [item.inventory_item_id]);
        if (!inv.length) throw Object.assign(new Error(`Item ${item.inventory_item_id} not found`), { status: 404 });
        if (parseFloat(inv[0].quantity) < parseFloat(item.quantity)) {
          await conn.rollback();
          return res.status(400).json({ success: false, error: `Insufficient stock for "${inv[0].item_name}"` });
        }
      }
    }

    const subtotal = items.reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.unit_price), 0);
    const discAmt = subtotal * (parseFloat(discount_percent || 0) / 100);
    const taxAmt  = (subtotal - discAmt) * (parseFloat(tax_percent || 0) / 100);
    const total   = subtotal - discAmt + taxAmt;

    const invNum = await generateReference({ prefix: 'INV', table: 'invoices', column: 'invoice_number', orgId: req.orgId, conn });

    const [result] = await conn.query(
      `INSERT INTO invoices (organization_id, customer_id, invoice_number, invoice_date, due_date,
         subtotal, discount_percent, tax_percent, total_amount, amount_paid, payment_method, status, notes, job_id, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)`,
      [req.orgId, customer_id || null, invNum, invoice_date, due_date, subtotal, discount_percent || 0, tax_percent || 0, total, payment_method || 'cash', 'sent', notes || null, job_id || null, req.user.id]
    );
    const invoiceId = result.insertId;

    for (const item of items) {
      const itemTotal = parseFloat(item.quantity) * parseFloat(item.unit_price);
      await conn.query(
        'INSERT INTO invoice_items (invoice_id, inventory_item_id, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?)',
        [invoiceId, item.inventory_item_id || null, item.description, parseFloat(item.quantity), parseFloat(item.unit_price), itemTotal]
      );

      if (item.inventory_item_id) {
        await deductStock({ conn, itemId: item.inventory_item_id, quantity: item.quantity, referenceType: 'sale', referenceId: invoiceId, userId: req.user.id });
      }
    }

    // Auto journal entry
    const [accounts] = await conn.query(
      `SELECT account_code, id FROM accounts WHERE organization_id = ? AND account_code IN ('1010','1020','1030','1040','4010','4020','5010','1050') AND is_active = TRUE`,
      [req.orgId]
    );
    const acct = {};
    accounts.forEach((a) => { acct[a.account_code] = a.id; });

    const debitAcct = { cash: acct['1010'], mobile: acct['1030'], bank: acct['1020'], credit: acct['1040'] }[payment_method] || acct['1010'];
    const revenueAcct = acct['4010'] || acct['4020'];

    const lines = [];
    if (debitAcct && revenueAcct) {
      lines.push({ account_id: debitAcct, debit: total, credit: 0, description: `Sale - ${invNum}` });
      lines.push({ account_id: revenueAcct, debit: 0, credit: total, description: `Revenue - ${invNum}` });
    }

    // COGS entry for inventory items
    const cogsAcct = acct['5010'];
    const inventoryAcct = acct['1050'];
    const cogsTotal = items
      .filter((i) => i.inventory_item_id)
      .reduce(async (sumPromise, item) => {
        const sum = await sumPromise;
        const [inv] = await conn.query('SELECT unit_cost FROM inventory_items WHERE id = ?', [item.inventory_item_id]);
        return sum + (inv.length ? parseFloat(inv[0].unit_cost) * parseFloat(item.quantity) : 0);
      }, Promise.resolve(0));

    const cogsTotalVal = await cogsTotal;
    if (cogsTotalVal > 0 && cogsAcct && inventoryAcct) {
      lines.push({ account_id: cogsAcct, debit: cogsTotalVal, credit: 0, description: 'Cost of goods sold' });
      lines.push({ account_id: inventoryAcct, debit: 0, credit: cogsTotalVal, description: 'Inventory reduction' });
    }

    if (lines.length >= 2) {
      const jeId = await createJournalEntry({ conn, orgId: req.orgId, userId: req.user.id, entryDate: invoice_date, description: `Sale ${invNum}`, sourceType: 'sale', sourceId: invoiceId, lines });
      await conn.query('UPDATE invoices SET journal_entry_id = ? WHERE id = ?', [jeId, invoiceId]);
    }

    if (job_id) await conn.query('UPDATE jobs SET invoice_id = ? WHERE id = ? AND organization_id = ?', [invoiceId, job_id, req.orgId]);

    await conn.commit();
    req.auditEntityId = invoiceId;

    const [created] = await pool.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
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
    const [rows] = await pool.query('SELECT * FROM invoices WHERE id = ? AND organization_id = ? LIMIT 1', [id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Invoice not found' });
    const { status, notes } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (Object.keys(updates).length) {
      const s = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      await pool.query(`UPDATE invoices SET ${s} WHERE id = ?`, [...Object.values(updates), id]);
    }
    const [updated] = await pool.query('SELECT * FROM invoices WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

async function recordPayment(req, res, next) {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const [rows] = await pool.query('SELECT * FROM invoices WHERE id = ? AND organization_id = ? LIMIT 1', [id, req.orgId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const newPaid = parseFloat(rows[0].amount_paid) + parseFloat(amount);
    const total = parseFloat(rows[0].total_amount);
    const status = newPaid >= total ? 'paid' : 'partial';

    await pool.query('UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?', [newPaid, status, id]);
    const [updated] = await pool.query('SELECT * FROM invoices WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update, recordPayment };
