const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { login, refresh, logout } = require('../controllers/auth.controller');

const router = express.Router();

router.post(
  '/login',
  [
    body('email')
      .isEmail().withMessage('A valid email address is required')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  login
);

router.post('/refresh', refresh);

router.post('/logout', logout);

module.exports = router;
