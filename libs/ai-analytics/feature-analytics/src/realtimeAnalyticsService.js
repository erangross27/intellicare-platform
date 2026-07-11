const AuditLog = require('../../../../backend/models/AuditLog');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Real-time Analytics Service
 * 
 * Real-time data processing and analytics platform providing:
 * - Live streaming analytics with WebSocket connections
 * - Real-time dashboard updates and alerts
 * - Event-driven analytics processing
 * - Live performance monitoring and alerting
 */
class RealtimeAnalyticsService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.activeStreams = new Map();
    this.realtimeMetrics = new Map();
    this.webSocketConnections = new Map();
    this.alertThresholds = new Map();
  }

  async initialize() {
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('realtime-analytics-service');
      await this.setupRealtimeStreams();
      await this.loadAlertThresholds();
      this.initialized = true;
      
      // Start real-time processing immediately - GlobalModelLoader is now ready
      await this.startRealtimeProcessing();
      
      console.log('✅ Real-time Analytics Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Real-time Analytics Service:', error);
      throw error;
    }
  }

  // Helper method to get SecureDataAccess service
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  // Helper method to get the service context for SecureDataAccess
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'realtime-analytics-service',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  async setupRealtimeStreams() {
    const streamConfigs = [
      {
        name: 'patient_flow',
        source: 'appointments',
        events: ['check_in', 'check_out', 'no_show'],
        aggregations: ['count', 'avg_wait_time'],
        updateFrequency: 5000 // 5 seconds
      },
      {
        name: 'financial_metrics',
        source: 'financial_transactions',
        events: ['payment_received', 'claim_processed'],
        aggregations: ['sum', 'count'],
        updateFrequency: 30000 // 30 seconds
      },
      {
        name: 'system_performance',
        source: 'system_metrics',
        events: ['cpu_usage', 'memory_usage', 'response_time'],
        aggregations: ['avg', 'max', 'min'],
        updateFrequency: 10000 // 10 seconds
      }
    ];

    for (const config of streamConfigs) {
      this.activeStreams.set(config.name, {
        ...config,
        lastUpdate: new Date(),
        subscribers: new Set()
      });
    }
  }

  async loadAlertThresholds() {
    this.alertThresholds.set('wait_time_critical', 30); // 30 minutes
    this.alertThresholds.set('queue_length_warning', 10);
    this.alertThresholds.set('system_response_time', 5000); // 5 seconds
    this.alertThresholds.set('payment_processing_delay', 300000); // 5 minutes
  }

  async startRealtimeProcessing() {
    // Delay start to ensure globalModelLoader is ready
    setTimeout(() => {
      // Start processing loops for each stream
      for (const [streamName, stream] of this.activeStreams) {
        this.startStreamProcessing(streamName, stream);
      }

      console.log('Real-time processing started for all streams');
    }, 5000); // 5 second delay to ensure all services are initialized
  }

  startStreamProcessing(streamName, stream) {
    setInterval(async () => {
      try {
        await this.processRealtimeData(streamName, stream);
      } catch (error) {
        console.error(`Error processing real-time data for ${streamName}:`, error);
      }
    }, stream.updateFrequency);
  }

  async processRealtimeData(streamName, stream) {
    // Skip processing if not initialized
    if (!this.initialized || !this.serviceToken) {
      return;
    }

    const now = new Date();
    const since = new Date(stream.lastUpdate);

    try {
      // Query for new data since last update
      const secureDataAccess = this.getSecureDataAccess();
      const newData = await secureDataAccess.query(stream.source,
        {
          updatedAt: { $gt: since },
          event: { $in: stream.events }
        },
        { sort: { updatedAt: -1 } },
        this.getServiceContext(stream.practiceId)
      );

      if (newData && newData.length > 0) {
        // Process aggregations
        const metrics = await this.calculateRealtimeMetrics(newData, stream);
        
        // Update cached metrics
        this.realtimeMetrics.set(streamName, {
          ...metrics,
          timestamp: now,
          dataPoints: newData.length
        });

        // Check for alerts
        await this.checkRealtimeAlerts(streamName, metrics);

        // Broadcast to subscribers
        await this.broadcastRealtimeUpdate(streamName, metrics);

        // Update last processed time
        this.activeStreams.get(streamName).lastUpdate = now;
      }
    } catch (error) {
      // Silently skip if collection doesn't exist or service not authenticated
      if (error.message && error.message.includes('SECURITY')) {
        // Service authentication issue - will retry after initialization
        return;
      }
      // Log other errors but don't crash
      if (error.message && !error.message.includes('not exist')) {
        console.error(`Error processing real-time data for ${streamName}:`, error.message);
      }
    }
  }

  async calculateRealtimeMetrics(data, stream) {
    const metrics = {};

    for (const aggregation of stream.aggregations) {
      switch (aggregation) {
        case 'count':
          metrics.count = data.length;
          break;
        case 'sum':
          metrics.sum = data.reduce((sum, item) => sum + (item.amount || 0), 0);
          break;
        case 'avg':
          if (data.length > 0) {
            metrics.avg = data.reduce((sum, item) => sum + (item.value || 0), 0) / data.length;
          }
          break;
        case 'max':
          metrics.max = Math.max(...data.map(item => item.value || 0));
          break;
        case 'min':
          metrics.min = Math.min(...data.map(item => item.value || 0));
          break;
        case 'avg_wait_time':
          const waitTimes = data.filter(item => item.waitTime).map(item => item.waitTime);
          if (waitTimes.length > 0) {
            metrics.avgWaitTime = waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length;
          }
          break;
      }
    }

    return metrics;
  }

  async checkRealtimeAlerts(streamName, metrics) {
    const alerts = [];

    // Check specific stream alerts
    switch (streamName) {
      case 'patient_flow':
        if (metrics.avgWaitTime > this.alertThresholds.get('wait_time_critical')) {
          alerts.push({
            type: 'wait_time_critical',
            value: metrics.avgWaitTime,
            threshold: this.alertThresholds.get('wait_time_critical'),
            severity: 'critical'
          });
        }
        break;

      case 'system_performance':
        if (metrics.avg > this.alertThresholds.get('system_response_time')) {
          alerts.push({
            type: 'system_response_time',
            value: metrics.avg,
            threshold: this.alertThresholds.get('system_response_time'),
            severity: 'warning'
          });
        }
        break;
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processRealtimeAlert(streamName, alert);
    }
  }

  async processRealtimeAlert(streamName, alert) {
    await AuditLog.create({
      action: 'REALTIME_ALERT',
      details: {
        stream: streamName,
        alertType: alert.type,
        value: alert.value,
        threshold: alert.threshold,
        severity: alert.severity
      },
      severity: alert.severity,
      timestamp: new Date(),
      serviceId: 'realtime-analytics-service'
    });

    // Broadcast alert to subscribers
    await this.broadcastAlert(streamName, alert);
  }

  async broadcastRealtimeUpdate(streamName, metrics) {
    const stream = this.activeStreams.get(streamName);
    const updateMessage = {
      type: 'realtime_update',
      stream: streamName,
      data: metrics,
      timestamp: new Date()
    };

    // Send to all subscribers of this stream
    for (const subscriberId of stream.subscribers) {
      const connection = this.webSocketConnections.get(subscriberId);
      if (connection && connection.readyState === 1) { // WebSocket.OPEN
        try {
          connection.send(JSON.stringify(updateMessage));
        } catch (error) {
          console.error(`Error sending update to subscriber ${subscriberId}:`, error);
          this.removeSubscriber(streamName, subscriberId);
        }
      }
    }
  }

  async broadcastAlert(streamName, alert) {
    const stream = this.activeStreams.get(streamName);
    const alertMessage = {
      type: 'realtime_alert',
      stream: streamName,
      alert,
      timestamp: new Date()
    };

    // Send alert to all subscribers
    for (const subscriberId of stream.subscribers) {
      const connection = this.webSocketConnections.get(subscriberId);
      if (connection && connection.readyState === 1) {
        try {
          connection.send(JSON.stringify(alertMessage));
        } catch (error) {
          console.error(`Error sending alert to subscriber ${subscriberId}:`, error);
        }
      }
    }
  }

  // WebSocket Management
  addWebSocketConnection(connectionId, connection) {
    this.webSocketConnections.set(connectionId, connection);
    
    connection.on('message', (message) => {
      this.handleWebSocketMessage(connectionId, message);
    });

    connection.on('close', () => {
      this.removeWebSocketConnection(connectionId);
    });

    connection.on('error', (error) => {
      console.error(`WebSocket error for connection ${connectionId}:`, error);
      this.removeWebSocketConnection(connectionId);
    });
  }

  removeWebSocketConnection(connectionId) {
    this.webSocketConnections.delete(connectionId);
    
    // Remove from all stream subscriptions
    for (const [streamName, stream] of this.activeStreams) {
      stream.subscribers.delete(connectionId);
    }
  }

  handleWebSocketMessage(connectionId, message) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe':
          this.addSubscriber(data.stream, connectionId);
          break;
        case 'unsubscribe':
          this.removeSubscriber(data.stream, connectionId);
          break;
        case 'get_current_metrics':
          this.sendCurrentMetrics(connectionId, data.stream);
          break;
      }
    } catch (error) {
      console.error(`Error handling WebSocket message from ${connectionId}:`, error);
    }
  }

  addSubscriber(streamName, connectionId) {
    const stream = this.activeStreams.get(streamName);
    if (stream) {
      stream.subscribers.add(connectionId);
      
      // Send current metrics immediately
      this.sendCurrentMetrics(connectionId, streamName);
    }
  }

  removeSubscriber(streamName, connectionId) {
    const stream = this.activeStreams.get(streamName);
    if (stream) {
      stream.subscribers.delete(connectionId);
    }
  }

  sendCurrentMetrics(connectionId, streamName) {
    const connection = this.webSocketConnections.get(connectionId);
    const metrics = this.realtimeMetrics.get(streamName);
    
    if (connection && metrics && connection.readyState === 1) {
      const message = {
        type: 'current_metrics',
        stream: streamName,
        data: metrics,
        timestamp: new Date()
      };
      
      try {
        connection.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending current metrics to ${connectionId}:`, error);
      }
    }
  }

  // Public API Methods
  async getRealtimeMetrics(streamName, context) {
    const metrics = this.realtimeMetrics.get(streamName);
    
    if (!metrics) {
      throw new Error(`Real-time metrics not found for stream: ${streamName}`);
    }

    await AuditLog.create({
      action: 'REALTIME_METRICS_ACCESSED',
      details: { streamName },
      userId: context.userId,
      practiceId: context.practiceId,
      timestamp: new Date()
    });

    return metrics;
  }

  async getAvailableStreams(context) {
    const streams = Array.from(this.activeStreams.entries()).map(([name, stream]) => ({
      name,
      source: stream.source,
      events: stream.events,
      aggregations: stream.aggregations,
      updateFrequency: stream.updateFrequency,
      lastUpdate: stream.lastUpdate,
      subscriberCount: stream.subscribers.size
    }));

    return streams;
  }

  async getStreamHistory(streamName, duration = 3600000, context) { // 1 hour default
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - duration);

    // This would typically query a time-series database
    // For now, return a simplified history
    return {
      stream: streamName,
      period: { start: startTime, end: endTime },
      data: [] // Would contain historical data points
    };
  }
}

// Create instance
const realtimeAnalyticsService = new RealtimeAnalyticsService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('realtimeAnalyticsService', () => realtimeAnalyticsService);
}

module.exports = realtimeAnalyticsService;