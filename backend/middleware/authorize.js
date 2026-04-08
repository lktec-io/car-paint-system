/**
 * Role-based authorization middleware factory.
 * Usage: router.get('/sensitive', authenticate, authorize(['super_admin', 'accountant']), handler)
 *
 * @param {string[]} allowedRoles - Array of roles permitted to access the route
 */
function authorize(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    next();
  };
}

module.exports = authorize;
