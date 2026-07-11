// Load Balancing Routes
// Provides API endpoints for load balancing management and health checks

const express = require('express');
const router = express.Router();
const loadBalancingService = require('../services/loadBalancingService');

// Middleware to require authentication for management endpoints
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // Skip auth for health checks
  if (req.path.startsWith('/health') || 
      req.path.startsWith('/ready') || 
      req.path.startsWith('/live')) {
    return next();
  }
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required for load balancer management',
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

// Apply authentication middleware
router.use(requireAuth);

/**
 * Health check endpoint
 * GET /api/load-balancer/health
 */
router.get('/health', (req, res) => {
  try {
    const health = loadBalancingService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * Readiness check endpoint (for Kubernetes)
 * GET /api/load-balancer/ready
 */
router.get('/ready', (req, res) => {
  try {
    const readiness = loadBalancingService.readinessCheck();
    const statusCode = readiness.ready ? 200 : 503;
    
    res.status(statusCode).json(readiness);
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message
    });
  }
});

/**
 * Liveness check endpoint (for Kubernetes)
 * GET /api/load-balancer/live
 */
router.get('/live', (req, res) => {
  try {
    const liveness = loadBalancingService.livenessCheck();
    
    res.json(liveness);
  } catch (error) {
    res.status(503).json({
      alive: false,
      error: error.message
    });
  }
});

/**
 * Get load balancer statistics
 * GET /api/load-balancer/stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = loadBalancingService.getStats();
    
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
 * Get server list
 * GET /api/load-balancer/servers
 */
router.get('/servers', (req, res) => {
  try {
    const servers = Array.from(loadBalancingService.servers.values()).map(server => ({
      id: server.id,
      host: server.host,
      port: server.port,
      status: server.status,
      weight: server.weight,
      connections: server.connections,
      requestsHandled: server.requestsHandled,
      cpuUsage: server.cpuUsage.toFixed(2) + '%',
      memoryUsage: server.memoryUsage.toFixed(2) + '%',
      uptime: Date.now() - server.startTime.getTime(),
      lastHealthCheck: server.lastHealthCheck,
      metadata: server.metadata
    }));
    
    res.json({
      success: true,
      servers,
      total: servers.length,
      healthy: servers.filter(s => s.status === 'healthy').length,
      unhealthy: servers.filter(s => s.status === 'unhealthy').length
    });
  } catch (error) {
    console.error('Get servers error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_SERVERS_FAILED' 
    });
  }
});

/**
 * Get or update load balancing algorithm
 * GET/PUT /api/load-balancer/algorithm
 */
router.get('/algorithm', (req, res) => {
  res.json({
    success: true,
    algorithm: loadBalancingService.config.algorithm,
    available: ['round-robin', 'least-connections', 'ip-hash', 'weighted', 'random']
  });
});

router.put('/algorithm', (req, res) => {
  try {
    const { algorithm } = req.body;
    const validAlgorithms = ['round-robin', 'least-connections', 'ip-hash', 'weighted', 'random'];
    
    if (!validAlgorithms.includes(algorithm)) {
      return res.status(400).json({
        error: `Invalid algorithm. Must be one of: ${validAlgorithms.join(', ')}`,
        code: 'INVALID_ALGORITHM'
      });
    }
    
    loadBalancingService.config.algorithm = algorithm;
    
    res.json({
      success: true,
      message: 'Load balancing algorithm updated',
      algorithm
    });
  } catch (error) {
    console.error('Update algorithm error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'UPDATE_ALGORITHM_FAILED' 
    });
  }
});

/**
 * Update server weight
 * PUT /api/load-balancer/servers/:serverId/weight
 */
router.put('/servers/:serverId/weight', (req, res) => {
  try {
    const { serverId } = req.params;
    const { weight } = req.body;
    
    if (!loadBalancingService.servers.has(serverId)) {
      return res.status(404).json({
        error: 'Server not found',
        code: 'SERVER_NOT_FOUND'
      });
    }
    
    if (typeof weight !== 'number' || weight < 0 || weight > 10) {
      return res.status(400).json({
        error: 'Weight must be a number between 0 and 10',
        code: 'INVALID_WEIGHT'
      });
    }
    
    loadBalancingService.serverWeights.set(serverId, weight);
    const server = loadBalancingService.servers.get(serverId);
    server.weight = weight;
    
    res.json({
      success: true,
      message: 'Server weight updated',
      serverId,
      weight
    });
  } catch (error) {
    console.error('Update weight error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'UPDATE_WEIGHT_FAILED' 
    });
  }
});

/**
 * Enable/disable server
 * PUT /api/load-balancer/servers/:serverId/status
 */
router.put('/servers/:serverId/status', (req, res) => {
  try {
    const { serverId } = req.params;
    const { enabled } = req.body;
    
    if (!loadBalancingService.servers.has(serverId)) {
      return res.status(404).json({
        error: 'Server not found',
        code: 'SERVER_NOT_FOUND'
      });
    }
    
    const server = loadBalancingService.servers.get(serverId);
    const previousStatus = server.status;
    
    if (enabled) {
      server.status = 'healthy';
      server.healthCheckFailures = 0;
      loadBalancingService.stats.healthyServers++;
      loadBalancingService.stats.unhealthyServers--;
    } else {
      server.status = 'disabled';
      if (previousStatus === 'healthy') {
        loadBalancingService.stats.healthyServers--;
        loadBalancingService.stats.unhealthyServers++;
      }
    }
    
    res.json({
      success: true,
      message: `Server ${enabled ? 'enabled' : 'disabled'}`,
      serverId,
      status: server.status
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'UPDATE_STATUS_FAILED' 
    });
  }
});

/**
 * Get active sessions
 * GET /api/load-balancer/sessions
 */
router.get('/sessions', (req, res) => {
  try {
    const sessions = Array.from(loadBalancingService.sessions.entries()).map(([sessionId, serverId]) => ({
      sessionId,
      serverId,
      server: loadBalancingService.servers.get(serverId)?.host + ':' + loadBalancingService.servers.get(serverId)?.port
    }));
    
    res.json({
      success: true,
      sessions,
      total: sessions.length,
      stickySessionsEnabled: loadBalancingService.config.stickySessionEnabled
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_SESSIONS_FAILED' 
    });
  }
});

/**
 * Clear session cache
 * DELETE /api/load-balancer/sessions
 */
router.delete('/sessions', (req, res) => {
  try {
    const sessionCount = loadBalancingService.sessions.size;
    loadBalancingService.sessions.clear();
    
    res.json({
      success: true,
      message: 'Session cache cleared',
      sessionsCleared: sessionCount
    });
  } catch (error) {
    console.error('Clear sessions error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CLEAR_SESSIONS_FAILED' 
    });
  }
});

/**
 * Get auto-scaling configuration
 * GET /api/load-balancer/auto-scaling
 */
router.get('/auto-scaling', (req, res) => {
  try {
    const config = loadBalancingService.config;
    
    res.json({
      success: true,
      autoScaling: {
        enabled: config.autoScalingEnabled,
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
        currentInstances: loadBalancingService.servers.size,
        targetCPU: config.targetCPU,
        targetMemory: config.targetMemory,
        scaleUpThreshold: config.scaleUpThreshold,
        scaleDownThreshold: config.scaleDownThreshold,
        lastAction: loadBalancingService.lastScaleAction,
        isScaling: loadBalancingService.isScaling,
        metrics: loadBalancingService.scalingMetrics.slice(-10) // Last 10 metrics
      }
    });
  } catch (error) {
    console.error('Get auto-scaling config error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_AUTO_SCALING_FAILED' 
    });
  }
});

/**
 * Update auto-scaling configuration
 * PUT /api/load-balancer/auto-scaling
 */
router.put('/auto-scaling', (req, res) => {
  try {
    const { 
      enabled, 
      minInstances, 
      maxInstances, 
      targetCPU, 
      targetMemory 
    } = req.body;
    
    const config = loadBalancingService.config;
    
    if (enabled !== undefined) {
      config.autoScalingEnabled = enabled;
    }
    
    if (minInstances !== undefined) {
      if (minInstances < 1 || minInstances > config.maxInstances) {
        return res.status(400).json({
          error: 'Invalid minInstances value',
          code: 'INVALID_MIN_INSTANCES'
        });
      }
      config.minInstances = minInstances;
    }
    
    if (maxInstances !== undefined) {
      if (maxInstances < config.minInstances || maxInstances > 20) {
        return res.status(400).json({
          error: 'Invalid maxInstances value',
          code: 'INVALID_MAX_INSTANCES'
        });
      }
      config.maxInstances = maxInstances;
    }
    
    if (targetCPU !== undefined) {
      if (targetCPU < 10 || targetCPU > 100) {
        return res.status(400).json({
          error: 'Target CPU must be between 10 and 100',
          code: 'INVALID_TARGET_CPU'
        });
      }
      config.targetCPU = targetCPU;
    }
    
    if (targetMemory !== undefined) {
      if (targetMemory < 10 || targetMemory > 100) {
        return res.status(400).json({
          error: 'Target memory must be between 10 and 100',
          code: 'INVALID_TARGET_MEMORY'
        });
      }
      config.targetMemory = targetMemory;
    }
    
    res.json({
      success: true,
      message: 'Auto-scaling configuration updated',
      config: {
        enabled: config.autoScalingEnabled,
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
        targetCPU: config.targetCPU,
        targetMemory: config.targetMemory
      }
    });
  } catch (error) {
    console.error('Update auto-scaling error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'UPDATE_AUTO_SCALING_FAILED' 
    });
  }
});

/**
 * Manually scale up
 * POST /api/load-balancer/scale-up
 */
router.post('/scale-up', async (req, res) => {
  try {
    if (loadBalancingService.servers.size >= loadBalancingService.config.maxInstances) {
      return res.status(400).json({
        error: 'Already at maximum instances',
        code: 'MAX_INSTANCES_REACHED'
      });
    }
    
    await loadBalancingService.scaleUp();
    
    res.json({
      success: true,
      message: 'Scaling up initiated',
      currentInstances: loadBalancingService.servers.size,
      maxInstances: loadBalancingService.config.maxInstances
    });
  } catch (error) {
    console.error('Scale up error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'SCALE_UP_FAILED' 
    });
  }
});

/**
 * Manually scale down
 * POST /api/load-balancer/scale-down
 */
router.post('/scale-down', async (req, res) => {
  try {
    if (loadBalancingService.servers.size <= loadBalancingService.config.minInstances) {
      return res.status(400).json({
        error: 'Already at minimum instances',
        code: 'MIN_INSTANCES_REACHED'
      });
    }
    
    await loadBalancingService.scaleDown();
    
    res.json({
      success: true,
      message: 'Scaling down initiated',
      currentInstances: loadBalancingService.servers.size,
      minInstances: loadBalancingService.config.minInstances
    });
  } catch (error) {
    console.error('Scale down error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'SCALE_DOWN_FAILED' 
    });
  }
});

/**
 * Simulate request (for testing)
 * POST /api/load-balancer/simulate-request
 */
router.post('/simulate-request', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    const request = {
      ip: req.ip,
      method: 'GET',
      path: '/test',
      headers: req.headers
    };
    
    const result = await loadBalancingService.handleRequest(request, sessionId);
    
    res.json({
      success: true,
      result,
      stats: {
        totalRequests: loadBalancingService.stats.totalRequests,
        successfulRequests: loadBalancingService.stats.successfulRequests,
        averageResponseTime: loadBalancingService.stats.averageResponseTime
      }
    });
  } catch (error) {
    console.error('Simulate request error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'SIMULATE_REQUEST_FAILED' 
    });
  }
});

/**
 * Get metrics for monitoring
 * GET /api/load-balancer/metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const stats = loadBalancingService.getStats();
    const health = loadBalancingService.healthCheck();
    
    // Prometheus-style metrics
    const metrics = [
      `# HELP lb_requests_total Total number of requests`,
      `# TYPE lb_requests_total counter`,
      `lb_requests_total ${stats.totalRequests}`,
      '',
      `# HELP lb_requests_success_total Total number of successful requests`,
      `# TYPE lb_requests_success_total counter`,
      `lb_requests_success_total ${stats.successfulRequests}`,
      '',
      `# HELP lb_requests_failed_total Total number of failed requests`,
      `# TYPE lb_requests_failed_total counter`,
      `lb_requests_failed_total ${stats.failedRequests}`,
      '',
      `# HELP lb_response_time_avg Average response time in milliseconds`,
      `# TYPE lb_response_time_avg gauge`,
      `lb_response_time_avg ${stats.averageResponseTime}`,
      '',
      `# HELP lb_active_connections Current active connections`,
      `# TYPE lb_active_connections gauge`,
      `lb_active_connections ${stats.activeConnections}`,
      '',
      `# HELP lb_healthy_servers Number of healthy servers`,
      `# TYPE lb_healthy_servers gauge`,
      `lb_healthy_servers ${stats.healthyServers}`,
      '',
      `# HELP lb_unhealthy_servers Number of unhealthy servers`,
      `# TYPE lb_unhealthy_servers gauge`,
      `lb_unhealthy_servers ${stats.unhealthyServers}`,
      '',
      `# HELP lb_scaling_events Total number of scaling events`,
      `# TYPE lb_scaling_events counter`,
      `lb_scaling_events ${stats.scalingEvents}`,
      '',
      `# HELP lb_session_count Active session count`,
      `# TYPE lb_session_count gauge`,
      `lb_session_count ${stats.sessionCount}`,
      '',
      `# HELP lb_up Load balancer up status`,
      `# TYPE lb_up gauge`,
      `lb_up ${health.status === 'healthy' ? 1 : 0}`
    ].join('\n');
    
    res.type('text/plain').send(metrics);
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GET_METRICS_FAILED' 
    });
  }
});

module.exports = router;