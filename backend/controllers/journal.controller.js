const pool = require('../config/db');
const { createJournalEntry } = require('../services/accounting.service');
const { generateReference } = require('../utils/autoReference');

async function listEntries(req, res, next) {
  try {
    const { start, end, status } = req.query;
    let sql = `SELECT je.*, u.full_name AS created_by_name
               FROM journal_entries je
               JOIN users u ON u.id = je.created_by
               WHERE je.organization_id = ?`;
    const params = [req.orgId];

    if (start) { sql += ' AND je.entry_date >= ?'; params.push(start); }
    if (end)   { sql += ' AND je.entry_date <= ?'; params.push(end); }
    if (status) { sql += ' AND je.status = ?'; params.push(status); }

    sql += ' ORDER BY je.entry_date DESC, je.id DESC LIMIT 200';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getEntry(req, res, next) {
  try {
    const [entries] = await pool.query(
      `SELECT je.*, u.full_name AS created_by_name
       FROM journal_entries je JOIN users u ON u.id = je.created_by
       WHERE je.id = ? AND je.organization_id = ? LIMIT 1`,
      [req.params.id, req.orgId]
    );
    if (!entries.length) return res.status(404).json({ success: false, error: 'Entry not found' });

    const [lines] = await pool.query(
      `SELECT jel.*, a.account_code, a.account_name
       FROM journal_entry_lines jel JOIN accounts a ON a.id = jel.account_id
       WHERE jel.journal_entry_id = ?
       ORDER BY jel.id`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...entries[0], lines } });
  } catch (err) { next(err); }
}

async function createEntry(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { entry_date, description, source_type = 'manual', lines } = req.body;

    if (!Array.isArray(lines) || lines.length < 2) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Journal entry requires at least 2 lines' });
    }

    const entryId = await createJournalEntry({
      conn, orgId: req.orgId, userId: req.user.id,
      entryDate: entry_date, description, sourceType: source_type,
      lines, status: 'draft',
    });

    await conn.commit();

    const [entry] = await pool.query('SELECT * FROM journal_entries WHERE id = ?', [entryId]);
    res.status(201).json({ success: true, data: entry[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function updateEntry(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const [entries] = await pool.query(
      'SELECT * FROM journal_entries WHERE id = ? AND organization_id = ? LIMIT 1',
      [id, req.orgId]
    );
    if (!entries.length) return res.status(404).json({ success: false, error: 'Entry not found' });
    if (entries[0].status === 'posted') {
      return res.status(400).json({ success: false, error: 'Posted entries are immutable' });
    }

    await conn.beginTransaction();

    const { entry_date, description, lines } = req.body;
    await conn.query(
      'UPDATE journal_entries SET entry_date = ?, description = ? WHERE id = ?',
      [entry_date || entries[0].entry_date, description || entries[0].description, id]
    );

    if (Array.isArray(lines) && lines.length >= 2) {
      const totalDebit  = lines.reduce((s, l) => s + parseFloat(l.debit  || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        await conn.rollback();
        return res.status(400).json({ success: false, error: `Entry out of balance: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}` });
      }

      await conn.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = ?', [id]);
      for (const line of lines) {
        await conn.query(
          'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)',
          [id, line.account_id, parseFloat(line.debit || 0), parseFloat(line.credit || 0), line.description || null]
        );
      }
    }

    await conn.commit();
    const [updated] = await pool.query('SELECT * FROM journal_entries WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function postEntry(req, res, next) {
  try {
    const { id } = req.params;
    const [entries] = await pool.query(
      'SELECT * FROM journal_entries WHERE id = ? AND organization_id = ? LIMIT 1',
      [id, req.orgId]
    );
    if (!entries.length) return res.status(404).json({ success: false, error: 'Entry not found' });
    if (entries[0].status === 'posted') {
      return res.status(400).json({ success: false, error: 'Entry is already posted' });
    }

    await pool.query(
      'UPDATE journal_entries SET status = "posted", posted_by = ? WHERE id = ?',
      [req.user.id, id]
    );

    const [updated] = await pool.query('SELECT * FROM journal_entries WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
}

async function getGeneralLedger(req, res, next) {
  try {
    const { account_id, start, end } = req.query;
    if (!account_id) return res.status(400).json({ success: false, error: 'account_id is required' });

    const [rows] = await pool.query(
      `SELECT je.entry_date, je.reference_number, je.description AS entry_description,
              jel.debit, jel.credit, jel.description AS line_description
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE jel.account_id = ?
         AND je.organization_id = ?
         AND je.status = 'posted'
         ${start ? 'AND je.entry_date >= ?' : ''}
         ${end   ? 'AND je.entry_date <= ?' : ''}
       ORDER BY je.entry_date, je.id`,
      [account_id, req.orgId, ...(start ? [start] : []), ...(end ? [end] : [])]
    );

    // Running balance
    let runningBalance = 0;
    const [acct] = await pool.query('SELECT account_type FROM accounts WHERE id = ?', [account_id]);
    const isDebitNormal = acct.length && ['asset', 'expense'].includes(acct[0].account_type);

    const ledger = rows.map((row) => {
      runningBalance += isDebitNormal
        ? parseFloat(row.debit) - parseFloat(row.credit)
        : parseFloat(row.credit) - parseFloat(row.debit);
      return { ...row, balance: runningBalance };
    });

    res.json({ success: true, data: ledger });
  } catch (err) { next(err); }
}

module.exports = { listEntries, getEntry, createEntry, updateEntry, postEntry, getGeneralLedger };
