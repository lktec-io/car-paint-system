const pool = require('../config/db');
const { generateReference } = require('../utils/autoReference');

/**
 * Creates a journal entry with lines inside an existing DB transaction (conn).
 * Enforces debits === credits before inserting.
 *
 * @param {object} params
 * @param {object} params.conn        - Active mysql2 connection (already in transaction)
 * @param {number} params.orgId
 * @param {number} params.userId      - created_by
 * @param {string} params.entryDate   - YYYY-MM-DD
 * @param {string} params.description
 * @param {string} params.sourceType  - 'manual'|'sale'|'purchase'|'expense'|'job'
 * @param {number} [params.sourceId]
 * @param {Array}  params.lines       - [{ account_id, debit, credit, description }]
 * @param {string} [params.status]    - 'draft' (default) or 'posted'
 * @returns {number} journal_entry_id
 */
async function createJournalEntry({ conn, orgId, userId, entryDate, description, sourceType = 'manual', sourceId = null, lines, status = 'posted' }) {
  // Double-entry validation — reject before touching DB
  const totalDebit  = lines.reduce((s, l) => s + parseFloat(l.debit  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw Object.assign(new Error(`Journal entry out of balance: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`), { status: 400 });
  }

  const ref = await generateReference({ prefix: 'JE', table: 'journal_entries', column: 'reference_number', orgId, conn });

  const [result] = await conn.query(
    `INSERT INTO journal_entries
       (organization_id, entry_date, reference_number, description, source_type, source_id, status, created_by, posted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orgId, entryDate, ref, description, sourceType, sourceId, status, userId, status === 'posted' ? userId : null]
  );

  const entryId = result.insertId;

  for (const line of lines) {
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, ?, ?)`,
      [entryId, line.account_id, parseFloat(line.debit || 0), parseFloat(line.credit || 0), line.description || null]
    );
  }

  return entryId;
}

/**
 * Retrieve trial balance for an organization as of a date.
 */
async function getTrialBalance(orgId, asOf) {
  const [rows] = await pool.query(
    `SELECT a.account_code, a.account_name, a.account_type,
            COALESCE(SUM(l.debit), 0)  AS total_debit,
            COALESCE(SUM(l.credit), 0) AS total_credit
     FROM accounts a
     LEFT JOIN journal_entry_lines l ON l.account_id = a.id
     LEFT JOIN journal_entries je    ON je.id = l.journal_entry_id
                                    AND je.organization_id = ?
                                    AND je.status = 'posted'
                                    AND je.entry_date <= ?
     WHERE a.organization_id = ? AND a.is_active = TRUE
     GROUP BY a.id
     ORDER BY a.account_code`,
    [orgId, asOf, orgId]
  );
  return rows;
}

/**
 * Profit & Loss between two dates.
 * Revenue accounts summed as credits minus debits; Expense accounts as debits minus credits.
 */
async function getProfitLoss(orgId, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT a.account_code, a.account_name, a.account_type, a.parent_id,
            COALESCE(SUM(l.debit), 0)  AS total_debit,
            COALESCE(SUM(l.credit), 0) AS total_credit
     FROM accounts a
     LEFT JOIN journal_entry_lines l ON l.account_id = a.id
     LEFT JOIN journal_entries je    ON je.id = l.journal_entry_id
                                    AND je.organization_id = ?
                                    AND je.status = 'posted'
                                    AND je.entry_date BETWEEN ? AND ?
     WHERE a.organization_id = ? AND a.account_type IN ('revenue','expense') AND a.is_active = TRUE
     GROUP BY a.id
     ORDER BY a.account_type, a.account_code`,
    [orgId, startDate, endDate, orgId]
  );

  const revenue = rows.filter((r) => r.account_type === 'revenue');
  const expenses = rows.filter((r) => r.account_type === 'expense');

  const totalRevenue = revenue.reduce((s, r) => s + (parseFloat(r.total_credit) - parseFloat(r.total_debit)), 0);
  const totalExpense = expenses.reduce((s, r) => s + (parseFloat(r.total_debit) - parseFloat(r.total_credit)), 0);

  return { revenue, expenses, totalRevenue, totalExpense, netIncome: totalRevenue - totalExpense };
}

/**
 * Balance sheet as of a date.
 */
async function getBalanceSheet(orgId, asOf) {
  const [rows] = await pool.query(
    `SELECT a.account_code, a.account_name, a.account_type, a.parent_id,
            COALESCE(SUM(l.debit), 0)  AS total_debit,
            COALESCE(SUM(l.credit), 0) AS total_credit
     FROM accounts a
     LEFT JOIN journal_entry_lines l ON l.account_id = a.id
     LEFT JOIN journal_entries je    ON je.id = l.journal_entry_id
                                    AND je.organization_id = ?
                                    AND je.status = 'posted'
                                    AND je.entry_date <= ?
     WHERE a.organization_id = ? AND a.account_type IN ('asset','liability','equity') AND a.is_active = TRUE
     GROUP BY a.id
     ORDER BY a.account_type, a.account_code`,
    [orgId, asOf, orgId]
  );

  function balance(row) {
    const d = parseFloat(row.total_debit);
    const c = parseFloat(row.total_credit);
    return row.account_type === 'asset' ? d - c : c - d;
  }

  const assets      = rows.filter((r) => r.account_type === 'asset').map((r) => ({ ...r, balance: balance(r) }));
  const liabilities = rows.filter((r) => r.account_type === 'liability').map((r) => ({ ...r, balance: balance(r) }));
  const equity      = rows.filter((r) => r.account_type === 'equity').map((r) => ({ ...r, balance: balance(r) }));

  const totalAssets      = assets.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.balance, 0);
  const totalEquity      = equity.reduce((s, r) => s + r.balance, 0);

  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}

module.exports = { createJournalEntry, getTrialBalance, getProfitLoss, getBalanceSheet };
