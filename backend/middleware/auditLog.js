function auditLog(action, entityType) {
  return (req, res, next) => next();
}

module.exports = auditLog;
