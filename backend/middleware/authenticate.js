const { verifyAccessToken } = require('../utils/generateToken');

/**
 * Verifies the Bearer token in Authorization header.
 * Attaches decoded payload to req.user on success.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // { id, email, role, organization_id, ... }
    next();
  } catch (err) {
    // Distinguish expired vs invalid so the frontend can act accordingly
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ success: false, error: message });
  }
}

module.exports = authenticate;
