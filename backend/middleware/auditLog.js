const pool = require('../config/db');

/**
 * Audit log middleware factory.
 * Logs CREATE, UPDATE, DELETE operations after they succeed.
 *
 * Usage: router.post('/', authenticate, tenantIsolation, auditLog('CREATE', 'invoices'), handler)
 *
 * Controllers should attach req.auditEntityId after creating/updating a record.
 * old_values / new_values are attached to req.auditOld and req.auditNew by controllers when needed.
 */
function auditLog(action, entityType) {
  return async (req, res, next) => {
    // Wrap the response to capture what was sent
    const originalJson = res.json.bind(res);

    res.json = async function (body) {
      // Only log on successful mutations
      if (body && body.success) {
        try {
          const entityId = req.auditEntityId || req.params?.id || null;
          await pool.query(
            `INSERT INTO audit_logs
               (organization_id, user_id, action, entity_type, entity_id,
                old_values, new_values, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.orgId || req.user?.organization_id,
              req.user?.id,
              action,
              entityType,
              entityId ? parseInt(entityId) : null,
              req.auditOld ? JSON.stringify(req.auditOld) : null,
              req.auditNew ? JSON.stringify(req.auditNew) : null,
              req.ip || req.connection?.remoteAddress || null,
            ]
          );
        } catch (err) {
          // Audit failures must NOT block the response
          console.error('[AuditLog] Failed to write log:', err.message);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = auditLog;
