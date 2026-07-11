// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SessionBridge {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.sessionStore = new Map();
    this.bridgeConnections = new Map();
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('session-bridge');
      this.initialized = true;
      console.log('✅ SessionBridge initialized with ServiceProxy');
      return this;
    } catch (error) {
      console.error('Failed to initialize SessionBridge:', error);
      throw error;
    }
  }

  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'session-bridge',
      operation: 'session-management',
      practiceId: practiceId
    };
  }

  async createBridge(sessionId, clientInfo = {}) {
    await this.initialize();
    
    const bridge = {
      sessionId,
      bridgeId: `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clientInfo,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      connections: 0
    };

    this.bridgeConnections.set(sessionId, bridge);
    
    console.log(`🌉 Created session bridge: ${bridge.bridgeId} for session: ${sessionId}`);
    
    return {
      success: true,
      sessionId,
      bridgeId: bridge.bridgeId,
      bridge
    };
  }

  async establishConnection(sessionId, connectionInfo = {}) {
    await this.initialize();
    
    const bridge = this.bridgeConnections.get(sessionId);
    if (!bridge) {
      return {
        success: false,
        error: 'No bridge found for session',
        sessionId
      };
    }

    bridge.connections++;
    bridge.lastActivity = new Date();
    
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔌 Established connection: ${connectionId} on bridge: ${bridge.bridgeId}`);
    
    return {
      success: true,
      sessionId,
      connectionId,
      bridgeId: bridge.bridgeId,
      connections: bridge.connections
    };
  }

  async closeConnection(sessionId, connectionId) {
    await this.initialize();
    
    const bridge = this.bridgeConnections.get(sessionId);
    if (!bridge) {
      return {
        success: false,
        error: 'No bridge found for session',
        sessionId
      };
    }

    bridge.connections = Math.max(0, bridge.connections - 1);
    bridge.lastActivity = new Date();
    
    console.log(`🔌 Closed connection: ${connectionId} on bridge: ${bridge.bridgeId}`);
    
    return {
      success: true,
      sessionId,
      connectionId,
      remainingConnections: bridge.connections
    };
  }

  async bridgeMessage(sessionId, message) {
    await this.initialize();
    
    const bridge = this.bridgeConnections.get(sessionId);
    if (!bridge) {
      return {
        success: false,
        error: 'No bridge found for session',
        sessionId
      };
    }

    bridge.lastActivity = new Date();
    
    // Store message temporarily for bridging
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const bridgedMessage = {
      messageId,
      sessionId,
      bridgeId: bridge.bridgeId,
      message,
      timestamp: new Date(),
      delivered: false
    };

    console.log(`📨 Bridging message: ${messageId} via bridge: ${bridge.bridgeId}`);
    
    return {
      success: true,
      messageId,
      sessionId,
      bridgeId: bridge.bridgeId,
      bridgedAt: bridgedMessage.timestamp
    };
  }

  async getBridgeStatus(sessionId) {
    await this.initialize();
    
    const bridge = this.bridgeConnections.get(sessionId);
    if (!bridge) {
      return {
        success: false,
        error: 'No bridge found for session',
        sessionId
      };
    }

    return {
      success: true,
      sessionId,
      bridge: {
        bridgeId: bridge.bridgeId,
        status: bridge.status,
        connections: bridge.connections,
        createdAt: bridge.createdAt,
        lastActivity: bridge.lastActivity,
        clientInfo: bridge.clientInfo
      }
    };
  }

  async destroyBridge(sessionId) {
    await this.initialize();
    
    const bridge = this.bridgeConnections.get(sessionId);
    if (!bridge) {
      return {
        success: false,
        error: 'No bridge found for session',
        sessionId
      };
    }

    this.bridgeConnections.delete(sessionId);
    
    console.log(`🌉 Destroyed session bridge: ${bridge.bridgeId} for session: ${sessionId}`);
    
    return {
      success: true,
      sessionId,
      bridgeId: bridge.bridgeId,
      destroyedAt: new Date()
    };
  }

  async listActiveBridges() {
    await this.initialize();
    
    const bridges = Array.from(this.bridgeConnections.values()).map(bridge => ({
      sessionId: bridge.sessionId,
      bridgeId: bridge.bridgeId,
      status: bridge.status,
      connections: bridge.connections,
      createdAt: bridge.createdAt,
      lastActivity: bridge.lastActivity
    }));

    return {
      success: true,
      totalBridges: bridges.length,
      bridges
    };
  }

  async cleanupInactiveBridges(maxInactivityMs = 30 * 60 * 1000) {
    await this.initialize();
    
    const now = new Date();
    const inactiveBridges = [];

    for (const [sessionId, bridge] of this.bridgeConnections) {
      const inactivityTime = now - bridge.lastActivity;
      if (inactivityTime > maxInactivityMs && bridge.connections === 0) {
        inactiveBridges.push(sessionId);
      }
    }

    const cleaned = [];
    for (const sessionId of inactiveBridges) {
      const result = await this.destroyBridge(sessionId);
      if (result.success) {
        cleaned.push(sessionId);
      }
    }

    console.log(`🧹 Cleaned up ${cleaned.length} inactive session bridges`);
    
    return {
      success: true,
      cleanedUp: cleaned.length,
      sessionIds: cleaned
    };
  }

  async transferSession(oldSessionId, newSessionId) {
    await this.initialize();
    
    const bridge = this.bridgeConnections.get(oldSessionId);
    if (!bridge) {
      return {
        success: false,
        error: 'No bridge found for old session',
        oldSessionId
      };
    }

    // Update session ID
    bridge.sessionId = newSessionId;
    bridge.lastActivity = new Date();
    
    // Move to new key
    this.bridgeConnections.set(newSessionId, bridge);
    this.bridgeConnections.delete(oldSessionId);

    console.log(`🔄 Transferred bridge from ${oldSessionId} to ${newSessionId}`);
    
    return {
      success: true,
      oldSessionId,
      newSessionId,
      bridgeId: bridge.bridgeId,
      transferredAt: new Date()
    };
  }

  getBridgeStats() {
    const totalBridges = this.bridgeConnections.size;
    let totalConnections = 0;
    let activeBridges = 0;

    for (const bridge of this.bridgeConnections.values()) {
      totalConnections += bridge.connections;
      if (bridge.status === 'active' && bridge.connections > 0) {
        activeBridges++;
      }
    }

    return {
      totalBridges,
      activeBridges,
      totalConnections,
      averageConnectionsPerBridge: totalBridges > 0 ? totalConnections / totalBridges : 0
    };
  }
}

// Export singleton instance
const sessionBridgeInstance = new SessionBridge();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('sessionBridge', () => sessionBridgeInstance);
}

module.exports = sessionBridgeInstance;