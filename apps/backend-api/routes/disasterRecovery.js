// Disaster Recovery Routes
// Endpoints for backup, recovery, failover, and DR testing

const express = require('express');
const router = express.Router();
const disasterRecoveryService = require('../services/disasterRecoveryService');
const { auth: authenticate } = require('../middleware/auth');

// All disaster recovery routes require authentication
// Note: Authorization checks should be added when RBAC is fully implemented
router.use(authenticate);

/**
 * Get disaster recovery status
 * GET /api/disaster-recovery/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = disasterRecoveryService.getStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get DR status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'DR_STATUS_ERROR'
    });
  }
});

/**
 * Create backup
 * POST /api/disaster-recovery/backup
 */
router.post('/backup', async (req, res) => {
  try {
    const { description, paths, type } = req.body;
    
    const result = await disasterRecoveryService.createBackup({
      description,
      paths,
      type: type || 'manual'
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        backupId: result.backupId,
        backup: result.backup
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: 'BACKUP_FAILED'
      });
    }
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'BACKUP_ERROR'
    });
  }
});

/**
 * List backups
 * GET /api/disaster-recovery/backups
 */
router.get('/backups', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const backups = disasterRecoveryService.getBackups(parseInt(limit));
    
    res.json({
      success: true,
      backups,
      total: backups.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'LIST_BACKUPS_ERROR'
    });
  }
});

/**
 * Restore backup
 * POST /api/disaster-recovery/restore/:backupId
 */
router.post('/restore/:backupId', async (req, res) => {
  try {
    const { backupId } = req.params;
    const { targetPath } = req.body;
    
    const result = await disasterRecoveryService.restoreBackup(backupId, {
      targetPath
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        restoration: result.restoration
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        code: 'RESTORE_FAILED'
      });
    }
  } catch (error) {
    console.error('Restore backup error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'RESTORE_ERROR'
    });
  }
});

/**
 * Point-in-time recovery
 * POST /api/disaster-recovery/pitr
 */
router.post('/pitr', async (req, res) => {
  try {
    const { targetTime } = req.body;
    
    if (!targetTime) {
      return res.status(400).json({
        success: false,
        error: 'Target time is required',
        code: 'MISSING_TARGET_TIME'
      });
    }
    
    const result = await disasterRecoveryService.pointInTimeRecovery(targetTime);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        recovery: result.recovery
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        code: 'PITR_FAILED'
      });
    }
  } catch (error) {
    console.error('PITR error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'PITR_ERROR'
    });
  }
});

/**
 * Execute failover
 * POST /api/disaster-recovery/failover
 */
router.post('/failover', async (req, res) => {
  try {
    const { targetRegion, reason } = req.body;
    
    const result = await disasterRecoveryService.executeFailover(targetRegion, {
      reason
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        failover: result.failover
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: 'FAILOVER_FAILED'
      });
    }
  } catch (error) {
    console.error('Failover error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'FAILOVER_ERROR'
    });
  }
});

/**
 * Run DR test
 * POST /api/disaster-recovery/test
 */
router.post('/test', async (req, res) => {
  try {
    const { scenario } = req.body;
    
    const result = await disasterRecoveryService.runDRTest(scenario);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        test: result.test
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: 'TEST_FAILED'
      });
    }
  } catch (error) {
    console.error('DR test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'TEST_ERROR'
    });
  }
});

/**
 * Get test results
 * GET /api/disaster-recovery/tests
 */
router.get('/tests', async (req, res) => {
  try {
    const status = disasterRecoveryService.getStatus();
    
    res.json({
      success: true,
      tests: status.testing.recentResults,
      totalTests: status.testing.testsRun,
      lastTest: status.testing.lastTest,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get test results error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'GET_TESTS_ERROR'
    });
  }
});

/**
 * Get metrics (RTO/RPO)
 * GET /api/disaster-recovery/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = disasterRecoveryService.calculateMetrics();
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'METRICS_ERROR'
    });
  }
});

/**
 * Get region health
 * GET /api/disaster-recovery/regions
 */
router.get('/regions', async (req, res) => {
  try {
    const status = disasterRecoveryService.getStatus();
    
    res.json({
      success: true,
      activeRegion: status.activeRegion,
      regions: status.regions,
      failoverInProgress: status.failoverInProgress,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get regions error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'REGIONS_ERROR'
    });
  }
});

/**
 * Health check
 * GET /api/disaster-recovery/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = disasterRecoveryService.healthCheck();
    
    res.json({
      success: true,
      health,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

/**
 * Test DR WebSocket connection
 * POST /api/disaster-recovery/test-websocket
 */
router.post('/test-websocket', async (req, res) => {
  try {
    // Emit a test event to all connected DR monitoring clients
    const securityMonitoringService = require('../services/securityMonitoringService');
    
    if (securityMonitoringService.io) {
      const drNamespace = securityMonitoringService.io.of('/disaster-recovery');
      
      const testEvent = {
        type: 'test',
        message: 'DR WebSocket connection test',
        timestamp: new Date(),
        data: {
          status: 'connected',
          clientCount: drNamespace.sockets.size
        }
      };
      
      drNamespace.emit('test:event', testEvent);
      
      res.json({
        success: true,
        message: 'Test event sent to DR monitoring clients',
        event: testEvent,
        connectedClients: drNamespace.sockets.size
      });
    } else {
      res.status(503).json({
        success: false,
        error: 'Socket.IO not initialized',
        code: 'WEBSOCKET_NOT_READY'
      });
    }
  } catch (error) {
    console.error('Test WebSocket error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'TEST_WEBSOCKET_ERROR'
    });
  }
});

/**
 * Real-time DR monitoring via Socket.IO
 * Integrates with existing Socket.IO infrastructure
 */

// Initialize DR monitoring with Socket.IO when the route module loads
let drMonitoringInitialized = false;

function initializeDRMonitoring() {
  if (drMonitoringInitialized) return;
  
  // Get the security monitoring service which has the Socket.IO instance
  const securityMonitoringService = require('../services/securityMonitoringService');
  
  // Wait for Socket.IO to be initialized
  if (securityMonitoringService.io) {
    setupDRNamespace(securityMonitoringService.io);
    drMonitoringInitialized = true;
    // DR monitoring WebSocket initialized
  } else {
    // Retry in 1 second if Socket.IO isn't ready yet
    setTimeout(initializeDRMonitoring, 1000);
  }
}

function setupDRNamespace(io) {
  // Create DR monitoring namespace
  const drNamespace = io.of('/disaster-recovery');
  
  drNamespace.on('connection', (socket) => {
    console.log('DR monitoring client connected:', socket.id);
    
    // Send initial status
    const status = disasterRecoveryService.getStatus();
    socket.emit('status', status);
    
    // Set up event listeners for DR events
    const eventHandlers = {
      'backup:started': (data) => socket.emit('backup:started', data),
      'backup:completed': (data) => socket.emit('backup:completed', data),
      'backup:failed': (data) => socket.emit('backup:failed', data),
      'restoration:started': (data) => socket.emit('restoration:started', data),
      'restoration:progress': (data) => socket.emit('restoration:progress', data),
      'restoration:completed': (data) => socket.emit('restoration:completed', data),
      'failover:started': (data) => socket.emit('failover:started', data),
      'failover:completed': (data) => socket.emit('failover:completed', data),
      'test:started': (data) => socket.emit('test:started', data),
      'test:completed': (data) => socket.emit('test:completed', data)
    };
    
    // Register event listeners
    for (const [event, handler] of Object.entries(eventHandlers)) {
      disasterRecoveryService.on(event, handler);
    }
    
    // Handle ping/pong for connection testing
    socket.on('ping', () => {
      socket.emit('pong');
    });
    
    // Request current status
    socket.on('request:status', () => {
      const currentStatus = disasterRecoveryService.getStatus();
      socket.emit('status', currentStatus);
    });
    
    // Clean up on disconnect
    socket.on('disconnect', () => {
      console.log('DR monitoring client disconnected:', socket.id);
      
      // Remove event listeners
      for (const [event, handler] of Object.entries(eventHandlers)) {
        disasterRecoveryService.removeListener(event, handler);
      }
    });
  });
}

// Initialize DR monitoring when routes are loaded
initializeDRMonitoring();

module.exports = router;