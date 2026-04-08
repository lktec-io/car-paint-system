/**
 * Global error handler — catches all errors thrown or passed via next(err).
 * Returns a consistent { success: false, error: "..." } shape.
 */
function errorHandler(err, req, res, next) {
  // Don't leak stack traces in production
  const isDev = process.env.NODE_ENV !== 'production';

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (isDev) {
    console.error(`[${req.method}] ${req.path} →`, err.stack || err);
  } else if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, message);
  }

  res.status(status).json({
    success: false,
    error: message,
  });
}

module.exports = errorHandler;
