// Secrets Management Routes
// Provides secure API endpoints for secrets management operations

const express = require('express');
const router = express.Router();
const secretsManagementService = require('../services/secretsManagementService');

// Middleware to require authentication for all secrets operations
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required for secrets operations',
      code: 'AUTH_REQUIRED' 
    });
  }
  
  // In production, verify JWT token properly
  req.user = { 
    id: 'demo-user', 
    role: 'admin',
    email: 'admin@developer.com'
  };
  
  next();
};

// Middleware to require admin role for sensitive operations
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required for this operation',
      code: 'ADMIN_REQUIRED' 
    });
  }
  next();
};

// Rate limiting for secrets operations
const rateLimit = require('express-rate-limit');
const secretsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many secrets requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Apply rate limiting to all routes
router.use(secretsRateLimit);

/**
 * Store a new secret
 * POST /api/secrets
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { secretName, secretValue, options = {} } = req.body;
    
    if (!secretName || !secretValue) {
      return res.status(400).json({ 
        error: 'Secret name and value are required',
        code: 'MISSING_REQUIRED_FIELDS' 
      });
    }
    
    const result = await secretsManagementService.storeSecret(
      secretName, 
      secretValue, 
      {
        ...options,
        userId: req.user.id,
        sourceIp: req.ip,
        sessionId: req.sessionID
      }
    );
    
    res.status(201).json({
      success: true,
      message: 'Secret stored successfully',
      data: result
    });
    
  } catch (error) {
    console.error('Store secret error:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'STORE_SECRET_FAILED' 
    });
  }
});

/**
 * Retrieve a secret
 * GET /api/secrets/:secretName
 */
router.get('/:secretName', requireAuth, async (req, res) => {
  try {
    const { secretName } = req.params;
    const { version, includeMetadata = false } = req.query;
    
    const result = await secretsManagementService.retrieveSecret(
      secretName,
      {
        version: version ? parseInt(version) : undefined,
        userId: req.user.id,
        sourceIp: req.ip,
        sessionId: req.sessionID
      }
    );
    
    // Prepare response based on includeMetadata flag
    const responseData = {
      success: true,
      secretName,
      source: result.source,
      version: result.version
    };
    
    if (includeMetadata === 'true') {
      responseData.metadata = result.metadata;
    }
    
    // Send secret value in response body (consider security implications)
    responseData.value = result.value;
    
    res.json(responseData);
    
  } catch (error) {
    console.error('Retrieve secret error:', error);
    res.status(404).json({ 
      error: error.message,
      code: 'RETRIEVE_SECRET_FAILED' 
    });
  }
});

/**
 * List all secrets (metadata only)
 * GET /api/secrets
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { 
      tags, 
      accessLevel, 
      includeExpired = false,
      limit = 50,
      offset = 0 
    } = req.query;
    
    const options = {
      userId: req.user.id,
      sourceIp: req.ip,
      sessionId: req.sessionID
    };
    
    if (tags) {
      options.tags = Array.isArray(tags) ? tags : [tags];
    }
    
    if (accessLevel) {
      options.accessLevel = accessLevel;
    }
    
    if (includeExpired === 'true') {
      options.includeExpired = true;
    }
    
    const result = await secretsManagementService.listSecrets(options);
    
    // Apply pagination
    const startIndex = parseInt(offset);
    const limitNum = Math.min(parseInt(limit), 100); // Cap at 100
    const paginatedSecrets = result.secrets.slice(startIndex, startIndex + limitNum);
    
    res.json({
      success: true,
      secrets: paginatedSecrets,
      pagination: {
        total: result.total,
        limit: limitNum,
        offset: startIndex,
        hasMore: startIndex + limitNum < result.total
      },
      statistics: {
        totalStored: result.totalStored,
        accessible: result.total
      }
    });
    
  } catch (error) {
    console.error('List secrets error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'LIST_SECRETS_FAILED' 
    });
  }
});

/**
 * Rotate a secret
 * POST /api/secrets/:secretName/rotate
 */
router.post('/:secretName/rotate', requireAuth, async (req, res) => {
  try {
    const { secretName } = req.params;
    const { newValue, type = 'password' } = req.body;
    
    const result = await secretsManagementService.rotateSecret(
      secretName,
      newValue, // null to auto-generate
      {
        type,
        userId: req.user.id,
        sourceIp: req.ip,
        sessionId: req.sessionID
      }
    );
    
    res.json({
      success: true,
      message: 'Secret rotated successfully',
      data: {
        secretName,
        newVersion: result.version,
        rotatedAt: new Date(),
        autoGenerated: !newValue
      }
    });
    
  } catch (error) {
    console.error('Rotate secret error:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'ROTATE_SECRET_FAILED' 
    });
  }
});

/**
 * Update secret access control
 * PUT /api/secrets/:secretName/access
 */
router.put('/:secretName/access', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { secretName } = req.params;
    const { permissions } = req.body;
    
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ 
        error: 'Permissions object is required',
        code: 'INVALID_PERMISSIONS' 
      });
    }
    
    const result = await secretsManagementService.setAccessControl(
      secretName,
      permissions,
      req.user.id
    );
    
    res.json({
      success: true,
      message: 'Access control updated successfully',
      data: result
    });
    
  } catch (error) {
    console.error('Set access control error:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'SET_ACCESS_CONTROL_FAILED' 
    });
  }
});

/**
 * Delete a secret
 * DELETE /api/secrets/:secretName
 */
router.delete('/:secretName', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { secretName } = req.params;
    const { force = false } = req.query;
    
    // Additional confirmation for force delete
    if (force === 'true' && req.headers['x-confirm-delete'] !== 'yes') {
      return res.status(400).json({
        error: 'Force delete requires X-Confirm-Delete: yes header',
        code: 'CONFIRMATION_REQUIRED'
      });
    }
    
    const result = await secretsManagementService.deleteSecret(
      secretName,
      {
        userId: req.user.id,
        sourceIp: req.ip,
        sessionId: req.sessionID,
        force: force === 'true'
      }
    );
    
    res.json({
      success: true,
      message: 'Secret deleted successfully',
      data: result
    });
    
  } catch (error) {
    console.error('Delete secret error:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'DELETE_SECRET_FAILED' 
    });
  }
});

/**
 * Generate a new secret value
 * POST /api/secrets/generate
 */
router.post('/generate', requireAuth, (req, res) => {
  try {
    const { type = 'password', length = 32 } = req.body;
    
    // Validate type
    const allowedTypes = ['password', 'api-key', 'jwt-secret', 'encryption-key'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid secret type. Allowed: ${allowedTypes.join(', ')}`,
        code: 'INVALID_SECRET_TYPE'
      });
    }
    
    const secretValue = secretsManagementService.generateSecretValue(type);
    
    res.json({
      success: true,
      secretValue,
      type,
      length: secretValue.length,
      generated: true,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Generate secret error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GENERATE_SECRET_FAILED' 
    });
  }
});

/**
 * Get secret versions
 * GET /api/secrets/:secretName/versions
 */
router.get('/:secretName/versions', requireAuth, async (req, res) => {
  try {
    const { secretName } = req.params;
    
    // Check if user has access to the secret
    if (!secretsManagementService.checkAccess(secretName, 'read', req.user.id)) {
      return res.status(403).json({
        error: 'Access denied for secret versions',
        code: 'ACCESS_DENIED'
      });
    }
    
    const secretMeta = secretsManagementService.secretsMetadata.get(secretName);
    if (!secretMeta) {
      return res.status(404).json({
        error: 'Secret not found',
        code: 'SECRET_NOT_FOUND'
      });
    }
    
    const versions = secretMeta.versions.map(version => ({
      version: version.version,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      createdBy: version.createdBy,
      description: version.description,
      lastAccessed: version.lastAccessed,
      accessCount: version.accessCount,
      current: version === secretMeta.current
    }));
    
    res.json({
      success: true,
      secretName,
      versions,
      totalVersions: versions.length,
      currentVersion: secretMeta.current.version
    });
    
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_VERSIONS_FAILED' 
    });
  }
});

/**
 * Get service statistics
 * GET /api/secrets/admin/stats
 */
router.get('/admin/stats', requireAuth, requireAdmin, (req, res) => {
  try {
    const stats = secretsManagementService.getStats();
    
    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_STATS_FAILED' 
    });
  }
});

/**
 * Get audit log
 * GET /api/secrets/admin/audit
 */
router.get('/admin/audit', requireAuth, requireAdmin, (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0, 
      action, 
      userId,
      startDate,
      endDate 
    } = req.query;
    
    let auditLog = [...secretsManagementService.auditLog];
    
    // Apply filters
    if (action) {
      auditLog = auditLog.filter(entry => entry.action === action);
    }
    
    if (userId) {
      auditLog = auditLog.filter(entry => entry.userId === userId);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      auditLog = auditLog.filter(entry => entry.timestamp >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      auditLog = auditLog.filter(entry => entry.timestamp <= end);
    }
    
    // Sort by timestamp (newest first)
    auditLog.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply pagination
    const startIndex = parseInt(offset);
    const limitNum = Math.min(parseInt(limit), 1000); // Cap at 1000
    const paginatedLog = auditLog.slice(startIndex, startIndex + limitNum);
    
    res.json({
      success: true,
      auditLog: paginatedLog,
      pagination: {
        total: auditLog.length,
        limit: limitNum,
        offset: startIndex,
        hasMore: startIndex + limitNum < auditLog.length
      },
      filters: { action, userId, startDate, endDate }
    });
    
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_AUDIT_LOG_FAILED' 
    });
  }
});

/**
 * Health check endpoint
 * GET /api/secrets/health
 */
router.get('/health', (req, res) => {
  try {
    const health = secretsManagementService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * Batch operations
 * POST /api/secrets/batch
 */
router.post('/batch', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { operations } = req.body;
    
    if (!Array.isArray(operations)) {
      return res.status(400).json({
        error: 'Operations must be an array',
        code: 'INVALID_BATCH_FORMAT'
      });
    }
    
    if (operations.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 operations per batch',
        code: 'BATCH_TOO_LARGE'
      });
    }
    
    const results = [];
    
    for (const operation of operations) {
      try {
        let result;
        
        switch (operation.type) {
          case 'store':
            result = await secretsManagementService.storeSecret(
              operation.secretName,
              operation.secretValue,
              { ...operation.options, userId: req.user.id }
            );
            break;
            
          case 'rotate':
            result = await secretsManagementService.rotateSecret(
              operation.secretName,
              operation.newValue,
              { userId: req.user.id }
            );
            break;
            
          case 'delete':
            result = await secretsManagementService.deleteSecret(
              operation.secretName,
              { userId: req.user.id }
            );
            break;
            
          default:
            throw new Error(`Unsupported batch operation: ${operation.type}`);
        }
        
        results.push({
          operation,
          success: true,
          result
        });
        
      } catch (error) {
        results.push({
          operation,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    res.json({
      success: failureCount === 0,
      results,
      summary: {
        total: operations.length,
        successful: successCount,
        failed: failureCount
      }
    });
    
  } catch (error) {
    console.error('Batch operations error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'BATCH_OPERATIONS_FAILED' 
    });
  }
});

module.exports = router;