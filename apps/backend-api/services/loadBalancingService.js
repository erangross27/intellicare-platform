const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const secureConfigService = require('./secureConfigService');
// Load Balancing Service
// Provides load balancing, health checks, and auto-scaling capabilities

const os = require('os');
const cluster = require('cluster');
const EventEmitter = require('events');
const crypto = require('crypto');

class LoadBalancingService extends EventEmitter {
  constructor() {
    super();
    
    // Configuration
    this.config = {
      algorithm: 'round-robin', // round-robin, least-connections, ip-hash, weighted
      healthCheckInterval: 30000, // 30 seconds
      healthCheckTimeout: 5000, // 5 seconds
      unhealthyThreshold: 3, // Failures before marking unhealthy
      healthyThreshold: 2, // Successes before marking healthy
      stickySessionEnabled: true,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      autoScalingEnabled: true,
      minInstances: 2,
      maxInstances: 10,
      targetCPU: 70, // Target CPU percentage
      targetMemory: 80, // Target memory percentage
      scaleUpThreshold: 3, // Consecutive high load readings
      scaleDownThreshold: 5, // Consecutive low load readings
      gracefulShutdownTimeout: 30000, // 30 seconds
      warmupPeriod: 10000, // 10 seconds for new instances
      metricsInterval: 5000, // 5 seconds
      loadBalancerPort: secureConfigService.get('LB_PORT') || 3000,
      backendPorts: [3001, 3002, 3003, 3004] // Backend server ports
    };

    // Server instances
    this.servers = new Map();
    this.healthChecks = new Map();
    this.sessions = new Map();
    this.metrics = new Map();
    
    // Load balancing state
    this.currentServerIndex = 0;
    this.connectionCounts = new Map();
    this.serverWeights = new Map();
    
    // Auto-scaling state
    this.scalingMetrics = [];
    this.isScaling = false;
    this.lastScaleAction = null;
    this.scaleUpCounter = 0;
    this.scaleDownCounter = 0;
    
    // Graceful shutdown state
    this.isShuttingDown = false;
    this.activeConnections = new Set();
    this.pendingRequests = new Map();
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      activeConnections: 0,
      totalConnections: 0,
      healthyServers: 0,
      unhealthyServers: 0,
      scalingEvents: 0,
      sessionCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.initialize();
  }

  /**
   * Initialize load balancing service
   */
  async initialize() {
    try {
      // Initialize server instances
      this.initializeServers();
      
      // Start health checks
      this.startHealthChecks();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Setup graceful shutdown handlers
      this.setupGracefulShutdown();
      
      // Initialize auto-scaling if enabled
      if (this.config.autoScalingEnabled) {
        this.initializeAutoScaling();
      }
      
      // Load Balancing Service initialized
      
    } catch (error) {
      console.error('Failed to initialize Load Balancing Service:', error);
      throw error;
    }
  }

  /**
   * Initialize server instances
   */
  initializeServers() {
    for (let i = 0; i < this.config.minInstances; i++) {
      const port = this.config.backendPorts[i] || 3001 + i;
      const serverId = `server-${i + 1}`;
      
      this.servers.set(serverId, {
        id: serverId,
        host: 'localhost',
        port,
        weight: 1,
        status: 'initializing',
        healthCheckFailures: 0,
        healthCheckSuccesses: 0,
        lastHealthCheck: null,
        startTime: new Date(),
        connections: 0,
        requestsHandled: 0,
        totalResponseTime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        metadata: {
          version: secureConfigService.get('APP_VERSION') || '1.0.0',
          region: secureConfigService.get('REGION') || 'us-east-1',
          zone: secureConfigService.get('ZONE') || 'a'
        }
      });
      
      this.connectionCounts.set(serverId, 0);
      this.serverWeights.set(serverId, 1);
      
      // Simulate server warmup
      setTimeout(() => {
        const server = this.servers.get(serverId);
        if (server) {
          server.status = 'healthy';
          this.stats.healthyServers++;
        }
      }, this.config.warmupPeriod);
    }
  }

  /**
   * Get next server based on load balancing algorithm
   */
  getNextServer(sessionId = null, clientIp = null) {
    // Check for sticky session
    if (this.config.stickySessionEnabled && sessionId) {
      const sessionServer = this.sessions.get(sessionId);
      if (sessionServer && this.isServerHealthy(sessionServer)) {
        this.stats.cacheHits++;
        return this.servers.get(sessionServer);
      }
      this.stats.cacheMisses++;
    }

    // Get list of healthy servers
    const healthyServers = Array.from(this.servers.values())
      .filter(server => this.isServerHealthy(server.id));
    
    if (healthyServers.length === 0) {
      throw new Error('No healthy servers available');
    }

    let selectedServer;
    
    switch (this.config.algorithm) {
      case 'round-robin':
        selectedServer = this.roundRobinSelection(healthyServers);
        break;
        
      case 'least-connections':
        selectedServer = this.leastConnectionsSelection(healthyServers);
        break;
        
      case 'ip-hash':
        selectedServer = this.ipHashSelection(healthyServers, clientIp);
        break;
        
      case 'weighted':
        selectedServer = this.weightedSelection(healthyServers);
        break;
        
      case 'random':
        selectedServer = this.randomSelection(healthyServers);
        break;
        
      default:
        selectedServer = this.roundRobinSelection(healthyServers);
    }

    // Store session mapping if sticky sessions enabled
    if (this.config.stickySessionEnabled && sessionId) {
      this.sessions.set(sessionId, selectedServer.id);
      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, this.config.sessionTimeout);
    }

    return selectedServer;
  }

  /**
   * Round-robin server selection
   */
  roundRobinSelection(servers) {
    const server = servers[this.currentServerIndex % servers.length];
    this.currentServerIndex++;
    return server;
  }

  /**
   * Least connections server selection
   */
  leastConnectionsSelection(servers) {
    return servers.reduce((min, server) => 
      (this.connectionCounts.get(server.id) < this.connectionCounts.get(min.id)) ? server : min
    );
  }

  /**
   * IP hash server selection
   */
  ipHashSelection(servers, clientIp) {
    if (!clientIp) {
      return this.roundRobinSelection(servers);
    }
    
    const hash = crypto.createHash('md5').update(clientIp).digest('hex');
    const index = parseInt(hash.substring(0, 8), 16) % servers.length;
    return servers[index];
  }

  /**
   * Weighted server selection
   */
  weightedSelection(servers) {
    const totalWeight = servers.reduce((sum, server) => 
      sum + this.serverWeights.get(server.id), 0
    );
    
    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      random -= this.serverWeights.get(server.id);
      if (random <= 0) {
        return server;
      }
    }
    
    return servers[servers.length - 1];
  }

  /**
   * Random server selection
   */
  randomSelection(servers) {
    return servers[Math.floor(Math.random() * servers.length)];
  }

  /**
   * Perform health check on a server
   */
  async performHealthCheck(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return;

    try {
      // Simulate health check (in production, make actual HTTP request)
      const startTime = Date.now();
      
      // Check server metrics
      const isHealthy = await this.checkServerHealth(server);
      
      const responseTime = Date.now() - startTime;
      
      if (isHealthy && responseTime < this.config.healthCheckTimeout) {
        server.healthCheckSuccesses++;
        server.healthCheckFailures = 0;
        
        if (server.status === 'unhealthy' && 
            server.healthCheckSuccesses >= this.config.healthyThreshold) {
          server.status = 'healthy';
          this.stats.healthyServers++;
          this.stats.unhealthyServers--;
          this.emit('serverHealthy', { serverId });
          console.log(`Server ${serverId} is now healthy`);
        }
      } else {
        throw new Error('Health check failed');
      }
      
      server.lastHealthCheck = new Date();
      
    } catch (error) {
      server.healthCheckFailures++;
      server.healthCheckSuccesses = 0;
      
      if (server.status === 'healthy' && 
          server.healthCheckFailures >= this.config.unhealthyThreshold) {
        server.status = 'unhealthy';
        this.stats.healthyServers--;
        this.stats.unhealthyServers++;
        this.emit('serverUnhealthy', { serverId, error: error.message });
        console.log(`Server ${serverId} is now unhealthy`);
      }
      
      server.lastHealthCheck = new Date();
    }
  }

  /**
   * Check server health
   */
  async checkServerHealth(server) {
    // Simulate health check logic
    // In production, make actual HTTP request to health endpoint
    
    // Check CPU usage
    if (server.cpuUsage > 90) {
      return false;
    }
    
    // Check memory usage
    if (server.memoryUsage > 95) {
      return false;
    }
    
    // Check response time
    if (server.totalResponseTime / Math.max(server.requestsHandled, 1) > 5000) {
      return false;
    }
    
    // Random failure simulation for testing
    return Math.random() > 0.05; // 95% success rate
  }

  /**
   * Start health checks for all servers
   */
  startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      for (const serverId of this.servers.keys()) {
        this.performHealthCheck(serverId);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Check if server is healthy
   */
  isServerHealthy(serverId) {
    const server = this.servers.get(serverId);
    return server && server.status === 'healthy';
  }

  /**
   * Handle incoming request
   */
  async handleRequest(request, sessionId = null) {
    this.stats.totalRequests++;
    
    try {
      // Get server for this request
      const server = this.getNextServer(sessionId, request.ip);
      
      if (!server) {
        throw new Error('No available servers');
      }
      
      // Update connection count
      this.connectionCounts.set(server.id, (this.connectionCounts.get(server.id) || 0) + 1);
      server.connections++;
      this.stats.activeConnections++;
      
      // Track request
      const requestId = crypto.randomBytes(16).toString('hex');
      const startTime = Date.now();
      
      this.pendingRequests.set(requestId, {
        serverId: server.id,
        startTime,
        request
      });
      
      // Simulate request handling (in production, proxy to actual server)
      const response = await this.proxyRequest(server, request);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      server.totalResponseTime += responseTime;
      server.requestsHandled++;
      this.stats.successfulRequests++;
      
      // Update average response time
      this.stats.averageResponseTime = 
        (this.stats.averageResponseTime * (this.stats.successfulRequests - 1) + responseTime) / 
        this.stats.successfulRequests;
      
      // Clean up
      this.connectionCounts.set(server.id, Math.max(0, (this.connectionCounts.get(server.id) || 0) - 1));
      server.connections = Math.max(0, server.connections - 1);
      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
      this.pendingRequests.delete(requestId);
      
      return {
        serverId: server.id,
        response,
        responseTime
      };
      
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    }
  }

  /**
   * Proxy request to backend server
   */
  async proxyRequest(server, request) {
    // Simulate request proxying
    // In production, use http-proxy or similar
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 200,
          data: {
            message: 'Request handled',
            server: server.id,
            timestamp: new Date()
          }
        });
      }, Math.random() * 100); // Random response time 0-100ms
    });
  }

  /**
   * Handle WebSocket connection with sticky sessions
   */
  handleWebSocketConnection(socket, sessionId) {
    try {
      // Get server for WebSocket connection
      const server = this.getNextServer(sessionId, socket.remoteAddress);
      
      if (!server) {
        throw new Error('No available servers for WebSocket');
      }
      
      // Store sticky session for WebSocket
      if (sessionId) {
        this.sessions.set(sessionId, server.id);
        // Don't timeout WebSocket sessions
      }
      
      // Track connection
      const connectionId = crypto.randomBytes(16).toString('hex');
      this.activeConnections.add(connectionId);
      server.connections++;
      this.stats.totalConnections++;
      
      // Setup connection cleanup
      socket.on('close', () => {
        this.activeConnections.delete(connectionId);
        server.connections = Math.max(0, server.connections - 1);
        
        // Clean up session if no more connections
        if (sessionId && server.connections === 0) {
          this.sessions.delete(sessionId);
        }
      });
      
      this.emit('websocketConnected', { serverId: server.id, sessionId });
      
      return server;
      
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      throw error;
    }
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Collect system and server metrics
   */
  collectMetrics() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    // Update server metrics (simulate in development)
    for (const server of this.servers.values()) {
      server.cpuUsage = cpuUsage + (Math.random() * 20 - 10); // Add some variance
      server.memoryUsage = memoryUsage + (Math.random() * 20 - 10);
    }
    
    // Store metrics for auto-scaling
    const metrics = {
      timestamp: new Date(),
      cpuUsage,
      memoryUsage,
      activeConnections: this.stats.activeConnections,
      requestRate: this.stats.totalRequests / (Date.now() / 1000 / 60), // requests per minute
      averageResponseTime: this.stats.averageResponseTime,
      healthyServers: this.stats.healthyServers
    };
    
    this.scalingMetrics.push(metrics);
    
    // Keep only recent metrics (last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.scalingMetrics = this.scalingMetrics.filter(m => 
      m.timestamp.getTime() > fiveMinutesAgo
    );
    
    // Check auto-scaling triggers
    if (this.config.autoScalingEnabled && !this.isScaling) {
      this.checkAutoScaling(metrics);
    }
  }

  /**
   * Initialize auto-scaling
   */
  initializeAutoScaling() {
    // Auto-scaling initialized
  }

  /**
   * Check and perform auto-scaling
   */
  checkAutoScaling(metrics) {
    const shouldScaleUp = 
      metrics.cpuUsage > this.config.targetCPU ||
      metrics.memoryUsage > this.config.targetMemory ||
      metrics.averageResponseTime > 1000;
    
    const shouldScaleDown = 
      metrics.cpuUsage < this.config.targetCPU * 0.5 &&
      metrics.memoryUsage < this.config.targetMemory * 0.5 &&
      metrics.averageResponseTime < 200;
    
    if (shouldScaleUp) {
      this.scaleUpCounter++;
      this.scaleDownCounter = 0;
      
      if (this.scaleUpCounter >= this.config.scaleUpThreshold) {
        this.scaleUp();
        this.scaleUpCounter = 0;
      }
    } else if (shouldScaleDown) {
      this.scaleDownCounter++;
      this.scaleUpCounter = 0;
      
      if (this.scaleDownCounter >= this.config.scaleDownThreshold) {
        this.scaleDown();
        this.scaleDownCounter = 0;
      }
    } else {
      this.scaleUpCounter = Math.max(0, this.scaleUpCounter - 1);
      this.scaleDownCounter = Math.max(0, this.scaleDownCounter - 1);
    }
  }

  /**
   * Scale up by adding server instance
   */
  async scaleUp() {
    if (this.servers.size >= this.config.maxInstances) {
      console.log('Already at maximum instances');
      return;
    }
    
    this.isScaling = true;
    const newServerId = `server-${this.servers.size + 1}`;
    const newPort = 3001 + this.servers.size;
    
    console.log(`Scaling up: Adding ${newServerId}`);
    
    const newServer = {
      id: newServerId,
      host: 'localhost',
      port: newPort,
      weight: 1,
      status: 'initializing',
      healthCheckFailures: 0,
      healthCheckSuccesses: 0,
      lastHealthCheck: null,
      startTime: new Date(),
      connections: 0,
      requestsHandled: 0,
      totalResponseTime: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      metadata: {
        version: secureConfigService.get('APP_VERSION') || '1.0.0',
        region: secureConfigService.get('REGION') || 'us-east-1',
        zone: secureConfigService.get('ZONE') || 'a'
      }
    };
    
    this.servers.set(newServerId, newServer);
    this.connectionCounts.set(newServerId, 0);
    this.serverWeights.set(newServerId, 1);
    
    // Simulate server startup
    setTimeout(() => {
      newServer.status = 'healthy';
      this.stats.healthyServers++;
      this.isScaling = false;
      this.lastScaleAction = { type: 'up', timestamp: new Date() };
      this.stats.scalingEvents++;
      this.emit('scaledUp', { serverId: newServerId });
      console.log(`Server ${newServerId} is now online`);
    }, this.config.warmupPeriod);
  }

  /**
   * Scale down by removing server instance
   */
  async scaleDown() {
    if (this.servers.size <= this.config.minInstances) {
      // Already at minimum instances - no action needed
      return;
    }
    
    this.isScaling = true;
    
    // Find server with least connections
    let targetServer = null;
    let minConnections = Infinity;
    
    for (const server of this.servers.values()) {
      if (server.connections < minConnections) {
        minConnections = server.connections;
        targetServer = server;
      }
    }
    
    if (!targetServer) {
      this.isScaling = false;
      return;
    }
    
    console.log(`Scaling down: Removing ${targetServer.id}`);
    
    // Mark server for shutdown
    targetServer.status = 'draining';
    
    // Wait for connections to drain
    const drainInterval = setInterval(() => {
      if (targetServer.connections === 0) {
        clearInterval(drainInterval);
        
        // Remove server
        this.servers.delete(targetServer.id);
        this.connectionCounts.delete(targetServer.id);
        this.serverWeights.delete(targetServer.id);
        
        if (targetServer.status === 'healthy') {
          this.stats.healthyServers--;
        } else {
          this.stats.unhealthyServers--;
        }
        
        this.isScaling = false;
        this.lastScaleAction = { type: 'down', timestamp: new Date() };
        this.stats.scalingEvents++;
        this.emit('scaledDown', { serverId: targetServer.id });
        console.log(`Server ${targetServer.id} has been removed`);
      }
    }, 1000);
    
    // Force removal after timeout
    setTimeout(() => {
      clearInterval(drainInterval);
      if (this.servers.has(targetServer.id)) {
        this.servers.delete(targetServer.id);
        this.isScaling = false;
      }
    }, this.config.gracefulShutdownTimeout);
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdownHandler = async () => {
      if (this.isShuttingDown) return;
      
      console.log('🔄 Initiating graceful shutdown...');
      this.isShuttingDown = true;
      
      // Stop accepting new connections
      this.emit('shuttingDown');
      
      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      // Stop metrics collection
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      
      // Mark all servers as draining
      for (const server of this.servers.values()) {
        server.status = 'draining';
      }
      
      // Wait for active connections to complete
      const shutdownTimeout = setTimeout(() => {
        console.log('⚠️ Graceful shutdown timeout, forcing exit');
        process.exit(0);
      }, this.config.gracefulShutdownTimeout);
      
      // Check for connection drainage
      const drainInterval = setInterval(() => {
        const activeConnections = Array.from(this.servers.values())
          .reduce((sum, server) => sum + server.connections, 0);
        
        if (activeConnections === 0 && this.pendingRequests.size === 0) {
          clearInterval(drainInterval);
          clearTimeout(shutdownTimeout);
          console.log('✅ All connections closed, shutting down');
          this.emit('shutdown');
          process.exit(0);
        } else {
          console.log(`   Waiting for ${activeConnections} connections and ${this.pendingRequests.size} requests`);
        }
      }, 1000);
    };
    
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
  }

  /**
   * Get load balancer statistics
   */
  getStats() {
    return {
      ...this.stats,
      servers: Array.from(this.servers.values()).map(server => ({
        id: server.id,
        status: server.status,
        connections: server.connections,
        requestsHandled: server.requestsHandled,
        averageResponseTime: server.requestsHandled > 0 
          ? server.totalResponseTime / server.requestsHandled 
          : 0,
        cpuUsage: server.cpuUsage,
        memoryUsage: server.memoryUsage,
        uptime: Date.now() - server.startTime.getTime()
      })),
      sessions: this.sessions.size,
      algorithm: this.config.algorithm,
      autoScaling: {
        enabled: this.config.autoScalingEnabled,
        currentInstances: this.servers.size,
        minInstances: this.config.minInstances,
        maxInstances: this.config.maxInstances,
        lastAction: this.lastScaleAction,
        isScaling: this.isScaling
      }
    };
  }

  /**
   * Health check endpoint
   */
  healthCheck() {
    const healthyServers = Array.from(this.servers.values())
      .filter(server => server.status === 'healthy').length;
    
    const isHealthy = healthyServers > 0 && !this.isShuttingDown;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      healthyServers,
      totalServers: this.servers.size,
      activeConnections: this.stats.activeConnections,
      uptime: process.uptime(),
      metrics: {
        requestsPerMinute: this.stats.totalRequests / (process.uptime() / 60),
        averageResponseTime: this.stats.averageResponseTime,
        successRate: this.stats.totalRequests > 0 
          ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%'
          : '0%'
      },
      timestamp: new Date()
    };
  }

  /**
   * Readiness check endpoint
   */
  readinessCheck() {
    const healthyServers = Array.from(this.servers.values())
      .filter(server => server.status === 'healthy').length;
    
    return {
      ready: healthyServers >= this.config.minInstances && !this.isShuttingDown,
      healthyServers,
      minRequired: this.config.minInstances
    };
  }

  /**
   * Liveness check endpoint
   */
  livenessCheck() {
    return {
      alive: !this.isShuttingDown,
      pid: process.pid,
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }
}

// Export singleton instance
module.exports = new LoadBalancingService();
