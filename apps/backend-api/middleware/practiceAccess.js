/**
 * Practice Access Validation Middleware
 * Ensures user has access to the requested practice resources
 */

const validatePracticeAccess = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'Authentication required',
          he: 'נדרשת הזדהות'
        }
      });
    }

    // Check if practice context is set
    if (!req.practice && !req.practiceId) {
      // Try to get practice from user or subdomain
      if (req.user.practiceId) {
        req.practiceId = req.user.practiceId;
      } else if (req.practiceSubdomain) {
        // Practice will be set by practiceContext middleware
        return next();
      } else {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Practice context required',
            he: 'נדרש הקשר מרפאה'
          }
        });
      }
    }

    // Validate user belongs to the practice
    // Compare using multiple methods since practiceId can be:
    // - ObjectId (from req.practice._id)
    // - String ObjectId (from JWT token)
    // - Subdomain string (from JWT token or headers)
    if (req.user.practiceId && req.practiceId) {
      const userPracticeId = String(req.user.practiceId);
      const reqPracticeId = String(req.practiceId);
      const reqPracticeSubdomain = req.practiceSubdomain || req.practice?.subdomain;

      // User's practiceId matches if:
      // 1. Direct string match (both ObjectIds or both subdomains)
      // 2. User's practiceId matches the practice subdomain
      // 3. Request practiceId matches user's practiceId when converted to string
      const isMatch = userPracticeId === reqPracticeId ||
                      userPracticeId === reqPracticeSubdomain ||
                      (req.practice && userPracticeId === String(req.practice._id));

      if (!isMatch) {
        console.error(`[PRACTICE ACCESS] User ${req.user._id} attempted to access practice ${reqPracticeId} (subdomain: ${reqPracticeSubdomain}) but belongs to ${userPracticeId}`);
        return res.status(403).json({
          success: false,
          message: {
            en: 'Access denied to this practice',
            he: 'הגישה למרפאה זו נדחתה'
          }
        });
      }
    }

    next();
  } catch (error) {
    console.error('[PRACTICE ACCESS] Error validating practice access:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Error validating practice access',
        he: 'שגיאה באימות גישה למרפאה'
      }
    });
  }
};

/**
 * Ensure user has specific role in practice
 */
const requirePracticeRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: {
            en: 'Authentication required',
            he: 'נדרשת הזדהות'
          }
        });
      }

      const userRole = req.user.role || req.user.clinicRole;
      
      if (!userRole || !roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: {
            en: `Required role: ${roles.join(' or ')}`,
            he: `נדרש תפקיד: ${roles.join(' או ')}`
          }
        });
      }

      next();
    } catch (error) {
      console.error('[PRACTICE ACCESS] Error checking practice role:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Error checking permissions',
          he: 'שגיאה בבדיקת הרשאות'
        }
      });
    }
  };
};

module.exports = {
  validatePracticeAccess,
  requirePracticeRole
};