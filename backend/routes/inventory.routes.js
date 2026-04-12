const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/inventory.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);

const ALL    = ['super_admin','accountant','store_manager','sales_officer','technician','viewer'];
const MANAGE = ['super_admin','store_manager'];

router.get('/',           authorize(ALL),    ctrl.listItems);
router.get('/low-stock',  authorize(ALL),    ctrl.lowStock);
router.get('/movements',  authorize(ALL),    ctrl.stockMovements);
router.get('/categories', authorize(ALL),    ctrl.listCategories);
router.get('/:id',        authorize(ALL),    param('id').isInt(), validate, ctrl.getItem);

router.post('/', authorize(MANAGE),
  [body('item_name').trim().notEmpty(), body('unit_cost').isFloat({ min: 0 })],
  validate, ctrl.createItem);

router.put('/:id', authorize(MANAGE), param('id').isInt(), validate, ctrl.updateItem);

router.post('/categories', authorize(MANAGE), body('name').trim().notEmpty(), validate, ctrl.createCategory);

// Specific sub-resource route must come BEFORE the generic /:id DELETE
router.delete('/movements/:id', authorize(MANAGE), param('id').isInt(), validate, ctrl.deleteStockMovement);

router.delete('/:id', authorize(MANAGE), param('id').isInt(), validate, ctrl.deleteItem);

module.exports = router;
