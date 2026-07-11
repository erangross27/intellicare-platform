/**
 * Database Event Bus - Modular Version
 * Event handling system for database operations
 */

const EventEmitter = require('events');

// Add this service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class DatabaseEventBus extends EventEmitter {
  constructor() {
    if (DatabaseEventBus.instance) {
      return DatabaseEventBus.instance;
    }

    super();
    this.setMaxListeners(100);
    this.serviceToken = null;
    this.initialized = false;
    this.eventHistory = new Map();
    this.subscribers = new WeakMap();

    DatabaseEventBus.instance = this;
  }

  static getInstance() {
    if (!DatabaseEventBus.instance) {
      DatabaseEventBus.instance = new DatabaseEventBus();
    }
    return DatabaseEventBus.instance;
  }

  async initialize() {
    if (this.initialized) return this;

    try {
      // Get services through proxy to avoid circular dependencies
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      this.serviceToken = await serviceAccountManager.authenticate('database-event-bus-service');
      
      // Start cleanup timer
      setInterval(() => this.cleanup(), 60000);
      
      this.initialized = true;
      console.log('✅ Database Event Bus initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Database Event Bus:', error);
      throw error;
    }

    return this;
  }

  emitEvent(category, data) {
    // Ensure service is initialized
    if (!this.initialized) {
      this.initialize().catch(console.error);
    }

    // Deduplication check
    const eventKey = `${category}:${JSON.stringify(data)}`;
    const lastEmit = this.eventHistory.get(eventKey);

    if (lastEmit && (Date.now() - lastEmit) < 100) {
      return; // Skip duplicate within 100ms
    }

    this.eventHistory.set(eventKey, Date.now());
    this.emit(category, data);

    // Clean old history
    if (this.eventHistory.size > 1000) {
      const oldest = Array.from(this.eventHistory.keys()).slice(0, 500);
      oldest.forEach(key => this.eventHistory.delete(key));
    }
  }

  subscribe(category, callback) {
    this.on(category, callback);
    return () => this.off(category, callback);
  }

  cleanup() {
    // Clean old event history
    const now = Date.now();
    for (const [key, time] of this.eventHistory.entries()) {
      if (now - time > 60000) {
        this.eventHistory.delete(key);
      }
    }
  }

  getStats() {
    return {
      initialized: this.initialized,
      eventHistory: this.eventHistory.size,
      listeners: this.listenerCount(),
      maxListeners: this.getMaxListeners()
    };
  }
}

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('DatabaseEventBus', () => {
    return DatabaseEventBus;
  });
}

module.exports = DatabaseEventBus;