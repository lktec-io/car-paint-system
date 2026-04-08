const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate = require('../middleware/validate');
const auditLog = require('../middleware/auditLog');
const ctrl = require('../controllers/purchase.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);
const ROLES = ['super_admin', 'accountant', 'store_manager'];

router.get('/',    authorize(ROLES), ctrl.list);
router.get('/:id', authorize(ROLES), param('id').isInt(), validate, ctrl.get);
router.post('/',   authorize(ROLES), auditLog('CREATE','purchases'),
  [body('supplier_id').isInt(), body('purchase_date').isDate(), body('items').isArray({ min: 1 })],
  validate, ctrl.create);
router.put('/:id', authorize(ROLES), auditLog('UPDATE','purchases'), param('id').isInt(), validate, ctrl.update);

module.exports = router;
