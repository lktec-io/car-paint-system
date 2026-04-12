const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/sale.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);

const ROLES = ['super_admin', 'accountant', 'store_manager', 'sales_officer'];

router.get('/', authorize(ROLES), ctrl.list);
router.get('/:id', authorize(ROLES), param('id').isInt(), validate, ctrl.get);
router.post(
  '/',
  authorize(ROLES),
  [body('sale_date').isDate(), body('items').isArray({ min: 1 })],
  validate,
  ctrl.create
);

router.delete(
  '/:id',
  authorize(['super_admin', 'store_manager']),
  param('id').isInt(),
  validate,
  ctrl.deleteSale
);

module.exports = router;
