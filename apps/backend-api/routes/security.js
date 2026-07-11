const SecureDataAccess = require('../services/secureDataAccess');
const express = require('express');
// const SecureDataAccess = require('../services/secureDataAccess'); // Duplicate removed
const router = express.Router();
const { fullClinicAuth } = require('../middleware/practiceAuth');

// Security event logging for HIPAA compliance
router.post('/log', fullClinicAuth, async (req, res) => {
  try {
    const { event, timestamp, userAgent } = req.body;
    
    // Get client IP
    const clientIP = req.ip || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress ||
                    (req.connection.socket ? req.connection.socket.remoteAddress : null);

    const context = {
      serviceId: 'security-route',
      operation: 'log-security-event',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    // Create security log entry data
    const securityLogData = {
      userId: req.user.id,
      userDetails: {
        email: req.user.email,
        fullName: req.user.profile?.firstName + ' ' + req.user.profile?.lastName || req.user.email,
        roles: req.user.roles || []
      },
      action: event,
      resourceType: 'SECURITY',
      resourceId: 'SESSION',
      resourceDetails: {
        event: event,
        practiceSubdomain: req.practiceSubdomain,
        timestamp: timestamp
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        ipAddress: clientIP,
        userAgent: userAgent,
        sessionId: req.sessionID
      },
      response: {
        statusCode: 200,
        success: true
      },
      timestamp: new Date(),
      severity: 'medium'
    };

    await SecureDataAccess.insert('audit_logs', securityLogData, context);

    console.log(`🔒 SECURITY LOG: ${event} - User: ${req.user.email} - IP: ${clientIP}`);

    res.json({
      success: true,
      message: 'Security event logged'
    });

  } catch (error) {
    console.error('❌ Security logging error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log security event'
    });
  }
});

// Get security logs (admin only)
router.get('/logs', fullClinicAuth, async (req, res) => {
  try {
    // Check if user has admin permissions
    if (!req.user.roles.includes('admin') && !req.user.permissions.includes('view_security_logs')) {
      return res.status(403).json({
        success: false,
        message: {
          en: 'Access denied. Admin privileges required.',
          he: 'גישה נדחתה. נדרשות הרשאות מנהל.'
        }
      });
    }

    const { page = 1, limit = 50, event, userId, startDate, endDate } = req.query;

    // Build query
    const query = { resourceType: 'SECURITY' };
    
    if (event) query.action = event;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const context = {
      serviceId: 'security-route',
      operation: 'get-security-logs',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    // Get logs with pagination
    const logs = await SecureDataAccess.query('audit_logs', query, {
      sort: { timestamp: -1 },
      limit: limit * 1,
      skip: (page - 1) * limit
    }, context);

    const total = await SecureDataAccess.query('audit_logs', query, { count: true }, context);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching security logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security logs'
    });
  }
});

module.exports = router;
