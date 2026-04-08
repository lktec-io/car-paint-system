const express = require('express');
const authenticate    = require('../middleware/authenticate');
const tenantIsolation = require('../middleware/tenantIsolation');
const authorize       = require('../middleware/authorize');
const ctrl            = require('../controllers/dashboard.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);

const ALL = ['super_admin','accountant','store_manager','sales_officer','technician','viewer'];

router.get('/summary',          authorize(ALL), ctrl.getSummary);
router.get('/charts/revenue',   authorize(ALL), ctrl.getRevenueChart);
router.get('/charts/expenses',  authorize(ALL), ctrl.getExpenseChart);
router.get('/recent-activity',  authorize(ALL), ctrl.getRecentActivity);

module.exports = router;
