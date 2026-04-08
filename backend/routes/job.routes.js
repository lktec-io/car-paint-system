const express = require('express');
const { body, param } = require('express-validator');
const authenticate   = require('../middleware/authenticate');
const authorize      = require('../middleware/authorize');
const tenantIsolation = require('../middleware/tenantIsolation');
const validate       = require('../middleware/validate');
const auditLog       = require('../middleware/auditLog');
const ctrl           = require('../controllers/job.controller');

const router = express.Router();
router.use(authenticate, tenantIsolation);

const ALL    = ['super_admin','accountant','store_manager','sales_officer','technician','viewer'];
const MANAGE = ['super_admin','store_manager','sales_officer'];
const STATUS = ['super_admin','store_manager','technician'];

router.get('/',    authorize(ALL),    ctrl.list);
router.get('/:id', authorize(ALL),    param('id').isInt(), validate, ctrl.get);

router.post('/', authorize(MANAGE), auditLog('CREATE','jobs'),
  [body('customer_id').isInt(), body('vehicle_plate').trim().notEmpty()],
  validate, ctrl.create);

router.put('/:id', authorize(MANAGE), auditLog('UPDATE','jobs'),
  param('id').isInt(), validate, ctrl.update);

router.put('/:id/status', authorize(STATUS),
  [param('id').isInt(), body('status').isIn(['pending','in_progress','completed','cancelled'])],
  validate, ctrl.updateStatus);

router.post('/:id/materials', authorize(MANAGE),
  [param('id').isInt(), body('materials').isArray({ min: 1 })],
  validate, ctrl.addMaterials);

module.exports = router;
