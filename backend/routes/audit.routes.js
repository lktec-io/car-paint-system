const express = require('express');
const authenticate    = require('../middleware/authenticate');
const tenantIsolation = require('../middleware/tenantIsolation');
const authorize       = require('../middleware/authorize');
const ctrl            = require('../controllers/audit.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);

const ADMIN_ROLES = ['super_admin', 'accountant'];
const ALL_ROLES   = ['super_admin','accountant','store_manager','sales_officer','technician','viewer'];

router.get('/',       authorize(ADMIN_ROLES), ctrl.list);
router.get('/poll',   authorize(ALL_ROLES),   ctrl.pollNotifications);

module.exports = router;
