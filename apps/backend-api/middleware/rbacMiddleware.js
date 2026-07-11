/**
 * 🔐 RBAC MIDDLEWARE
 * Role-based access control middleware for compliance features
 */

const rbacService = require('../services/rbacService');
const immutableAuditService = require('../services/immutableAuditService');

/**
 * Check if user has required role(s)
 */
const checkRole = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: {
            he: 'נדרש אימות',
            en: 'Authentication required'
          }
        });
      }

      // Check if user has any of the required roles
      if (!rbacService.hasAnyRole(user, requiredRoles)) {
        // Log unauthorized attempt
        await immutableAuditService.addAuditEntry({
          eventType: 'unauthorized_access_attempt',
          userId: user._id || user.id || 'unknown',
          details: `Attempted to access resource requiring roles: ${requiredRoles.join(', ')}`,
          metadata: {
            requiredRoles,
            userRoles: user.roles || [],
            path: req.path,
            method: req.method,
            ip: req.ip
          }
        });

        return res.status(403).json({
          success: false,
          message: {
            he: 'אין לך הרשאה לגשת למשאב זה',
            en: 'You do not have permission to access this resource'
          },
          requiredRoles
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({
        success: false,
        message: {
          he: 'שגיאה בבדיקת הרשאות',
          en: 'Error checking permissions'
        }
      });
    }
  };
};

/**
 * Check if user has required permission(s)
 */
const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: {
            he: 'נדרש אימות',
            en: 'Authentication required'
          }
        });
      }

      // Normalize to array (accept both string and array)
      const permissions = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      // Check if user has all required permissions
      if (!rbacService.hasAllPermissions(user, permissions)) {
        // Log unauthorized attempt
        await immutableAuditService.addAuditEntry({
          eventType: 'insufficient_permissions',
          userId: user._id || user.id || 'unknown',
          details: `Missing required permissions: ${permissions.join(', ')}`,
          metadata: {
            requiredPermissions: permissions,
            userPermissions: rbacService.getUserPermissions(user),
            path: req.path,
            method: req.method,
            ip: req.ip
          }
        });

        return res.status(403).json({
          success: false,
          message: {
            he: 'אין לך את ההרשאות הנדרשות',
            en: 'You do not have the required permissions'
          },
          requiredPermissions
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: {
          he: 'שגיאה בבדיקת הרשאות',
          en: 'Error checking permissions'
        }
      });
    }
  };
};

/**
 * Check if user can access specific resource
 */
const checkResourceAccess = (resource, action = 'view') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: {
            he: 'נדרש אימות',
            en: 'Authentication required'
          }
        });
      }

      // Check resource access
      if (!rbacService.canAccessResource(user, resource, action)) {
        // Check if user needs training
        const trainingCheck = rbacService.checkTrainingRequirements(user, resource);
        
        // Log access attempt
        await rbacService.logPermissionCheck(user, resource, action, false);

        return res.status(403).json({
          success: false,
          message: {
            he: `אין לך גישה ל${resource}`,
            en: `You do not have access to ${resource}`
          },
          resource,
          action,
          trainingRequired: trainingCheck.requiresTraining,
          missingTraining: trainingCheck.missingTraining
        });
      }

      // Log successful access
      await rbacService.logPermissionCheck(user, resource, action, true);

      next();
    } catch (error) {
      console.error('Resource access middleware error:', error);
      res.status(500).json({
        success: false,
        message: {
          he: 'שגיאה בבדיקת גישה למשאב',
          en: 'Error checking resource access'
        }
      });
    }
  };
};

/**
 * Apply data access scope filters
 */
const applyDataScope = (resourceType = 'patient') => {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: {
            he: 'נדרש אימות',
            en: 'Authentication required'
          }
        });
      }

      // Get user's data access scope
      const accessScope = rbacService.getDataAccessScope(user, resourceType);
      
      // Apply filters to request
      req.dataFilters = accessScope.filters;
      req.accessLevel = accessScope.level;

      // If no access, deny
      if (accessScope.level === 'none') {
        return res.status(403).json({
          success: false,
          message: {
            he: 'אין לך גישה לנתונים אלה',
            en: 'You do not have access to this data'
          }
        });
      }

      next();
    } catch (error) {
      console.error('Data scope middleware error:', error);
      res.status(500).json({
        success: false,
        message: {
          he: 'שגיאה בהחלת מסנני נתונים',
          en: 'Error applying data filters'
        }
      });
    }
  };
};

/**
 * Validate access request permissions
 */
const validateAccessRequest = (action = 'view') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const request = req.body || req.accessRequest; // Request data from body or previous middleware
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: {
            he: 'נדרש אימות',
            en: 'Authentication required'
          }
        });
      }

      // Validate access
      const validation = await rbacService.validateAccessRequest(user, request, action);
      
      if (!validation.allowed) {
        return res.status(403).json({
          success: false,
          message: validation.reason,
          requiredApprovals: validation.requiredApprovals
        });
      }

      // Add validation result to request
      req.accessValidation = validation;

      next();
    } catch (error) {
      console.error('Access request validation error:', error);
      res.status(500).json({
        success: false,
        message: {
          he: 'שגיאה באימות בקשת גישה',
          en: 'Error validating access request'
        }
      });
    }
  };
};

/**
 * Get user's permissions summary
 */
const getPermissionsSummary = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: {
          he: 'נדרש אימות',
          en: 'Authentication required'
        }
      });
    }

    const summary = rbacService.getUserAccessSummary(user);

    res.json({
      success: true,
      message: {
        he: 'סיכום הרשאות נוצר בהצלחה',
        en: 'Permissions summary generated successfully'
      },
      data: summary
    });
  } catch (error) {
    console.error('Permissions summary error:', error);
    res.status(500).json({
      success: false,
      message: {
        he: 'שגיאה ביצירת סיכום הרשאות',
        en: 'Error generating permissions summary'
      }
    });
  }
};

module.exports = {
  checkRole,
  checkPermission,
  checkResourceAccess,
  applyDataScope,
  validateAccessRequest,
  getPermissionsSummary,
  rbacService // Export the service for direct access if needed
};