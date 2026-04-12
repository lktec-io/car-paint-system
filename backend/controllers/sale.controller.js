const pool = require('../config/db');
const { deductStock } = require('../services/inventory.service');
const { createJournalEntry } = require('../services/accounting.service');
const { generateReference } = require('../utils/autoReference');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.invoice_number AS sale_number, i.invoice_date AS sale_date,
              i.total_amount, i.payment_method, i.notes, u.full_name AS created_by_name,
              COUNT(ii.id) AS item_count
       FROM invoices i
       JOIN users u ON u.id = i.created_by
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE i.organization_id = ?
       GROUP BY i.id
       ORDER BY i.invoice_date DESC, i.id DESC`,
      [req.orgId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [invoices] = await pool.query(
      `SELECT i.id, i.invoice_number AS sale_number, i.invoice_date AS sale_date,
              i.total_amount, i.payment_method, i.notes, u.full_name AS created_by_name
       FROM invoices i
       JOIN users u ON u.id = i.created_by
       WHERE i.id = ? AND i.organization_id = ? LIMIT 1`,
      [req.params.id, req.orgId]
    );
    if (!invoices.length) return res.status(404).json({ success: false, error: 'Sale not found' });

    const [items] = await pool.query(
      `SELECT ii.description, ii.quantity, ii.unit_price, ii.total,
              inv.item_name, inv.sku, inv.unit
       FROM invoice_items ii
       LEFT JOIN inventory_items inv ON inv.id = ii.inventory_item_id
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

    const { sale_date, payment_method, notes, items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'At least one item required' });
    }

    // Validate each item has required fields
    for (const item of items) {
      if (!item.description && !item.inventory_item_id) {
        await conn.rollback();
        return res.status(400).json({ success: false, error: 'Each item needs a description or inventory selection' });
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, error: 'Quantity must be greater than 0' });
      }
      if (!item.unit_price || parseFloat(item.unit_price) < 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, error: 'Price must be a valid number' });
      }
    }

    // Validate stock availability upfront
    for (const item of items) {
      if (item.inventory_item_id) {
        const [inv] = await conn.query(
          'SELECT quantity, item_name FROM inventory_items WHERE id = ? AND organization_id = ? FOR UPDATE',
          [item.inventory_item_id, req.orgId]
        );
        if (!inv.length) {
          await conn.rollback();
          return res.status(404).json({ success: false, error: 'Inventory item not found' });
        }
        if (parseFloat(inv[0].quantity) < parseFloat(item.quantity)) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for "${inv[0].item_name}". Available: ${inv[0].quantity}`,
          });
        }
      }
    }

    // Calculate total
    const total = items.reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.unit_price), 0);

    // Generate sale number
    const saleNum = await generateReference({
      prefix: 'SALE',
      table: 'invoices',
      column: 'invoice_number',
      orgId: req.orgId,
      conn,
    });

    // Insert sale record — always status=paid, amount_paid=total
    const [result] = await conn.query(
      `INSERT INTO invoices
         (organization_id, customer_id, invoice_number, invoice_date, due_date,
          subtotal, discount_percent, tax_percent, total_amount, amount_paid,
          payment_method, status, notes, created_by)
       VALUES (?,NULL,?,?,?,?,0,0,?,?,?,?,?,?)`,
      [
        req.orgId, saleNum, sale_date, sale_date,
        total, total, total,
        payment_method || 'cash', 'paid',
        notes || null, req.user.id,
      ]
    );
    const saleId = result.insertId;

    // Insert line items and deduct stock
    for (const item of items) {
      const lineTotal = parseFloat(item.quantity) * parseFloat(item.unit_price);
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, inventory_item_id, description, quantity, unit_price, total)
         VALUES (?,?,?,?,?,?)`,
        [saleId, item.inventory_item_id || null, item.description || '', parseFloat(item.quantity), parseFloat(item.unit_price), lineTotal]
      );

      if (item.inventory_item_id) {
        await deductStock({
          conn,
          itemId: item.inventory_item_id,
          quantity: item.quantity,
          referenceType: 'sale',
          referenceId: saleId,
          userId: req.user.id,
        });
      }
    }

    // Auto journal entry for accounting
    const [accounts] = await conn.query(
      `SELECT account_code, id FROM accounts
       WHERE organization_id = ? AND account_code IN ('1010','1020','1030','1040','4010','4020','5010','1050')
       AND is_active = TRUE`,
      [req.orgId]
    );
    const acct = {};
    accounts.forEach(a => { acct[a.account_code] = a.id; });

    const debitAcct = {
      cash: acct['1010'], mobile: acct['1030'], bank: acct['1020'], credit: acct['1040'],
    }[payment_method] || acct['1010'];
    const revenueAcct = acct['4010'] || acct['4020'];

    const lines = [];
    if (debitAcct && revenueAcct) {
      lines.push({ account_id: debitAcct, debit: total, credit: 0, description: `Sale - ${saleNum}` });
      lines.push({ account_id: revenueAcct, debit: 0, credit: total, description: `Revenue - ${saleNum}` });
    }

    // COGS journal lines
    const cogsAcct = acct['5010'];
    const inventoryAcct = acct['1050'];
    let cogsTotal = 0;
    for (const item of items.filter(i => i.inventory_item_id)) {
      const [inv] = await conn.query('SELECT unit_cost FROM inventory_items WHERE id = ?', [item.inventory_item_id]);
      if (inv.length) cogsTotal += parseFloat(inv[0].unit_cost) * parseFloat(item.quantity);
    }
    if (cogsTotal > 0 && cogsAcct && inventoryAcct) {
      lines.push({ account_id: cogsAcct, debit: cogsTotal, credit: 0, description: 'Cost of goods sold' });
      lines.push({ account_id: inventoryAcct, debit: 0, credit: cogsTotal, description: 'Inventory reduction' });
    }

    if (lines.length >= 2) {
      const jeId = await createJournalEntry({
        conn, orgId: req.orgId, userId: req.user.id,
        entryDate: sale_date, description: `Sale ${saleNum}`,
        sourceType: 'sale', sourceId: saleId, lines,
      });
      await conn.query('UPDATE invoices SET journal_entry_id = ? WHERE id = ?', [jeId, saleId]);
    }

    await conn.commit();
    req.auditEntityId = saleId;

    res.status(201).json({ success: true, data: { id: saleId, sale_number: saleNum, total_amount: total } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

module.exports = { list, get, create };
