/**
 * Injects organization_id from the authenticated JWT into req.orgId.
 * This MUST be used on every authenticated route — controllers should
 * always use req.orgId and never trust any organization_id from the request body.
 */
function tenantIsolation(req, res, next) {
  if (!req.user || !req.user.organization_id) {
    return res.status(401).json({ success: false, error: 'Tenant context missing' });
  }
  req.orgId = req.user.organization_id;
  next();
}

module.exports = tenantIsolation;
