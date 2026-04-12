const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/expense.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);

const ROLES = ['super_admin','accountant','store_manager'];

router.get('/categories', authorize(ROLES), ctrl.listCategories);
router.post('/categories', authorize(ROLES), body('name').trim().notEmpty(), validate, ctrl.createCategory);
router.get('/', authorize(ROLES), ctrl.list);
router.post('/', authorize(ROLES),
  [body('expense_category_id').isInt(), body('amount').isFloat({ gt: 0 }), body('expense_date').isDate()],
  validate, ctrl.create);
router.put('/:id',    authorize(ROLES), param('id').isInt(), validate, ctrl.update);
router.delete('/:id', authorize(ROLES), param('id').isInt(), validate, ctrl.remove);

module.exports = router;
