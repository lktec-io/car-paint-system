const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate = require('../middleware/validate');
const auditLog = require('../middleware/auditLog');
const ctrl = require('../controllers/invoice.controller');
const router = express.Router();
router.use(authenticate, tenantIsolation);
const ROLES = ['super_admin','accountant','store_manager','sales_officer'];
router.get('/', authorize(ROLES), ctrl.list);
router.get('/:id', authorize(ROLES), param('id').isInt(), validate, ctrl.get);
router.post('/', authorize(ROLES), auditLog('CREATE','invoices'),
  [body('invoice_date').isDate(), body('due_date').isDate(), body('items').isArray({ min: 1 })],
  validate, ctrl.create);
router.put('/:id', authorize(ROLES), auditLog('UPDATE','invoices'), param('id').isInt(), validate, ctrl.update);
router.post('/:id/payment', authorize(ROLES), param('id').isInt(), body('amount').isFloat({ gt: 0 }), validate, ctrl.recordPayment);
module.exports = router;
