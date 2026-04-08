const { getTrialBalance, getProfitLoss, getBalanceSheet } = require('../services/accounting.service');

async function trialBalance(req, res, next) {
  try {
    const asOf = req.query.as_of || new Date().toISOString().split('T')[0];
    const data = await getTrialBalance(req.orgId, asOf);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function profitLoss(req, res, next) {
  try {
    const now = new Date();
    const start = req.query.start || `${now.getFullYear()}-01-01`;
    const end   = req.query.end   || now.toISOString().split('T')[0];
    const data = await getProfitLoss(req.orgId, start, end);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function balanceSheet(req, res, next) {
  try {
    const asOf = req.query.as_of || new Date().toISOString().split('T')[0];
    const data = await getBalanceSheet(req.orgId, asOf);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { trialBalance, profitLoss, balanceSheet };
