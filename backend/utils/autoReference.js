/**
 * Generates sequential reference numbers per organization.
 * Format: PREFIX-NNNN  (e.g., INV-0042, JE-0001, PO-0015)
 * Queries the target table to find the current max and increments.
 */
const pool = require('../config/db');

/**
 * @param {object} opts
 * @param {string} opts.prefix      - e.g. 'INV', 'JE', 'PO'
 * @param {string} opts.table       - table name to query
 * @param {string} opts.column      - column holding the reference number
 * @param {number} opts.orgId       - organization_id for scoping
 * @param {object} [opts.conn]      - optional existing connection (for transactions)
 */
async function generateReference({ prefix, table, column, orgId, conn }) {
  const db = conn || pool;

  // Extract the numeric suffix from existing references for this org
  const [rows] = await db.query(
    `SELECT ${column} FROM ${table}
     WHERE organization_id = ?
     AND ${column} LIKE ?
     ORDER BY id DESC LIMIT 1`,
    [orgId, `${prefix}-%`]
  );

  let next = 1;
  if (rows.length > 0) {
    const last = rows[0][column];
    const parts = last.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) next = lastNum + 1;
  }

  return `${prefix}-${String(next).padStart(4, '0')}`;
}

module.exports = { generateReference };
