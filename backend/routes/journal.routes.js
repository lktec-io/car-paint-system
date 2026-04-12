const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/journal.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);

const ROLES = ['super_admin', 'accountant'];

router.get('/', authorize(ROLES), ctrl.listEntries);
router.get('/ledger', authorize(ROLES), ctrl.getGeneralLedger);
router.get('/:id', authorize(ROLES), param('id').isInt(), validate, ctrl.getEntry);
router.post('/', authorize(ROLES),
  [
    body('entry_date').isDate().withMessage('Valid date required'),
    body('lines').isArray({ min: 2 }).withMessage('At least 2 lines required'),
  ],
  validate, ctrl.createEntry);
router.put('/:id', authorize(ROLES), param('id').isInt(), validate, ctrl.updateEntry);
router.post('/:id/post', authorize(ROLES), param('id').isInt(), validate, ctrl.postEntry);

module.exports = router;
