const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate = require('../middleware/validate');
const auditLog = require('../middleware/auditLog');
const ctrl = require('../controllers/inventory.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);

const ALL = ['super_admin','accountant','store_manager','sales_officer','technician','viewer'];
const MANAGE = ['super_admin','store_manager'];

router.get('/',           authorize(ALL),    ctrl.listItems);
router.get('/low-stock',  authorize(ALL),    ctrl.lowStock);
router.get('/movements',  authorize(ALL),    ctrl.stockMovements);
router.get('/categories', authorize(ALL),    ctrl.listCategories);
router.get('/:id',        authorize(ALL),    param('id').isInt(), validate, ctrl.getItem);

router.post('/', authorize(MANAGE), auditLog('CREATE','inventory_items'),
  [body('item_name').trim().notEmpty(), body('sku').trim().notEmpty(), body('unit_cost').isFloat({ min: 0 })],
  validate, ctrl.createItem);

router.put('/:id',    authorize(MANAGE), auditLog('UPDATE','inventory_items'), param('id').isInt(), validate, ctrl.updateItem);
router.delete('/:id', authorize(MANAGE), auditLog('DELETE','inventory_items'), param('id').isInt(), validate, ctrl.deleteItem);

router.post('/categories', authorize(MANAGE), body('name').trim().notEmpty(), validate, ctrl.createCategory);

module.exports = router;
