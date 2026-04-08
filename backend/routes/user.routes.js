const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate = require('../middleware/validate');
const auditLog = require('../middleware/auditLog');
const ctrl = require('../controllers/user.controller');

const router = express.Router();

// All user routes require authentication + tenant context
router.use(authenticate, tenantIsolation);

router.get('/', authorize(['super_admin']), ctrl.listUsers);

router.post(
  '/',
  authorize(['super_admin']),
  auditLog('CREATE', 'users'),
  [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['super_admin','accountant','store_manager','sales_officer','technician','viewer'])
      .withMessage('Invalid role'),
  ],
  validate,
  ctrl.createUser
);

router.get('/:id', authorize(['super_admin']), param('id').isInt(), validate, ctrl.getUser);

router.put(
  '/:id',
  authorize(['super_admin']),
  auditLog('UPDATE', 'users'),
  [
    param('id').isInt(),
    body('full_name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 8 }),
    body('role').optional().isIn(['super_admin','accountant','store_manager','sales_officer','technician','viewer']),
    body('is_active').optional().isBoolean(),
  ],
  validate,
  ctrl.updateUser
);

router.delete('/:id', authorize(['super_admin']), auditLog('DELETE', 'users'), param('id').isInt(), validate, ctrl.deleteUser);

module.exports = router;
