const { validationResult } = require('express-validator');

/**
 * Runs express-validator checks and returns 422 with errors if any fail.
 * Place after the validation chain in the route definition.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = validate;
