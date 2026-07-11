// Async Handler Utility
// Wraps async route handlers to properly catch errors

/**
 * Async route wrapper to catch all errors
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // Wrap the async function and catch any errors
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error(`❌ Async error in ${req.method} ${req.path}:`, error);
      
      // Log error for monitoring
      if (req.auditLog) {
        req.auditLog('ASYNC_ROUTE_ERROR', {
          method: req.method,
          path: req.path,
          error: error.message,
          stack: error.stack,
          requestId: req.id
        });
      }
      
      // Pass error to Express error handler
      next(error);
    });
  };
};

module.exports = asyncHandler;