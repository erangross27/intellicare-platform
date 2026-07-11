const jwt = require('jsonwebtoken');
const config = require('config');
const { checkRole, checkPermission } = require('./rbacMiddleware');

// Main auth middleware
const auth = function(req, res, next) {
  console.log('🔑 Auth middleware: Checking token');
  // Get token from header
  const token = req.header('x-auth-token');
  console.log('   - Token present?', !!token);
  
  // If no token, deny access
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  
  // Verify token
  try {
    const decoded = jwt.verify(token, config.get('jwtSecret'));
    req.user = decoded.user;
    // Ensure _id is set (some tokens might have id instead of _id)
    if (!req.user._id && req.user.id) {
      req.user._id = req.user.id;
    }
    console.log('   - User set:', req.user.email, 'ID:', req.user._id || req.user.id);
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Import practiceAuth functions for consistent API
const { practiceAuth, requireRole: clinicRequireRole, requirePermission: clinicRequirePermission } = require('./practiceAuth');

// Export auth and RBAC functions
module.exports = {
  auth,
  authenticate: practiceAuth,  // Alias for compatibility
  authenticateToken: auth,   // Another common alias
  checkRole,
  checkPermission,
  requireRole: clinicRequireRole || checkRole,  // Use practiceAuth's requireRole or fallback
  requirePermission: clinicRequirePermission || checkPermission  // Use practiceAuth's requirePermission or fallback
};

// Also export auth as default for backward compatibility
module.exports.default = auth;