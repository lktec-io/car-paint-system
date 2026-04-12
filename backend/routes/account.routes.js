const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/account.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);

const ACCOUNTING_ROLES = ['super_admin', 'accountant'];

router.get('/', authorize(ACCOUNTING_ROLES), ctrl.listAccounts);
router.get('/:id', authorize(ACCOUNTING_ROLES), param('id').isInt(), validate, ctrl.getAccount);
router.post('/', authorize(ACCOUNTING_ROLES),
  [
    body('account_code').trim().notEmpty().withMessage('Account code required'),
    body('account_name').trim().notEmpty().withMessage('Account name required'),
    body('account_type').isIn(['asset','liability','equity','revenue','expense']).withMessage('Invalid account type'),
  ],
  validate, ctrl.createAccount);
router.put('/:id', authorize(ACCOUNTING_ROLES), param('id').isInt(), validate, ctrl.updateAccount);

module.exports = router;
