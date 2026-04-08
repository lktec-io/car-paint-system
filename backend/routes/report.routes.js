const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const ctrl = require('../controllers/report.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);
const ROLES = ['super_admin', 'accountant', 'store_manager', 'sales_officer', 'viewer'];

router.get('/trial-balance',  authorize(ROLES), ctrl.trialBalance);
router.get('/profit-loss',    authorize(ROLES), ctrl.profitLoss);
router.get('/balance-sheet',  authorize(ROLES), ctrl.balanceSheet);

module.exports = router;
