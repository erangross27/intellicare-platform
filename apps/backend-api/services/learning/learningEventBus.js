/**
 * Learning Event Bus Service
 * 
 * Core event system for learning analytics microservices.
 * Provides pub/sub functionality with no external dependencies.
 * Enables loose coupling between learning services.
 */

class LearningEventBus {
  constructor() {
    this.events = new Map();
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 1000;
    this.debugMode = process.env.LEARNING_DEBUG === 'true';
  }

  /**
   * Subscribe to an event
   */
  subscribe(eventName, handler, subscriberId = null) {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, new Map());
    }
    
    const id = subscriberId || `subscriber_${Date.now()}_${Math.random()}`;
    this.subscribers.get(eventName).set(id, handler);
    
    if (this.debugMode) {
      console.log(`[LearningEventBus] Subscribed ${id} to ${eventName}`);
    }
    
    return id;
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(eventName, subscriberId) {
    if (this.subscribers.has(eventName)) {
      this.subscribers.get(eventName).delete(subscriberId);
      
      if (this.debugMode) {
        console.log(`[LearningEventBus] Unsubscribed ${subscriberId} from ${eventName}`);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  async emit(eventName, data) {
    const event = {
      name: eventName,
      data: data,
      timestamp: new Date(),
      id: `event_${Date.now()}_${Math.random()}`
    };
    
    // Store in history
    this.addToHistory(event);
    
    // Get all handlers for this event
    const handlers = this.subscribers.get(eventName);
    if (!handlers || handlers.size === 0) {
      if (this.debugMode) {
        console.log(`[LearningEventBus] No subscribers for ${eventName}`);
      }
      return;
    }
    
    // Execute all handlers
    const promises = [];
    for (const [subscriberId, handler] of handlers) {
      promises.push(this.executeHandler(handler, event, subscriberId));
    }
    
    // Wait for all handlers to complete
    const results = await Promise.allSettled(promises);
    
    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[LearningEventBus] Handler failed for ${eventName}:`, result.reason);
      }
    });
    
    return results;
  }

  /**
   * Emit an event without waiting for handlers
   */
  emitAsync(eventName, data) {
    setImmediate(() => {
      this.emit(eventName, data).catch(error => {
        console.error(`[LearningEventBus] Async emit failed for ${eventName}:`, error);
      });
    });
  }

  /**
   * Execute a handler safely
   */
  async executeHandler(handler, event, subscriberId) {
    try {
      const startTime = Date.now();
      const result = await handler(event);
      const duration = Date.now() - startTime;
      
      if (this.debugMode && duration > 1000) {
        console.warn(`[LearningEventBus] Slow handler ${subscriberId} for ${event.name}: ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      console.error(`[LearningEventBus] Handler ${subscriberId} error:`, error);
      throw error;
    }
  }

  /**
   * Add event to history
   */
  addToHistory(event) {
    this.eventHistory.push(event);
    
    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(count = 10, eventName = null) {
    let events = this.eventHistory;
    
    if (eventName) {
      events = events.filter(e => e.name === eventName);
    }
    
    return events.slice(-count);
  }

  /**
   * Clear all subscriptions for an event
   */
  clearEvent(eventName) {
    this.subscribers.delete(eventName);
  }

  /**
   * Clear all subscriptions
   */
  clearAll() {
    this.subscribers.clear();
    this.eventHistory = [];
  }

  /**
   * Get statistics about the event bus
   */
  getStats() {
    const stats = {
      totalEvents: this.subscribers.size,
      totalSubscribers: 0,
      eventHistory: this.eventHistory.length,
      events: {}
    };
    
    for (const [eventName, handlers] of this.subscribers) {
      stats.events[eventName] = handlers.size;
      stats.totalSubscribers += handlers.size;
    }
    
    return stats;
  }

  /**
   * Wait for an event to occur
   */
  waitForEvent(eventName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.unsubscribe(eventName, subscriberId);
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);
      
      const subscriberId = this.subscribe(eventName, (event) => {
        clearTimeout(timeoutId);
        this.unsubscribe(eventName, subscriberId);
        resolve(event);
      });
    });
  }

  /**
   * Create a filtered subscription
   */
  subscribeWithFilter(eventName, filter, handler) {
    const filteredHandler = (event) => {
      if (filter(event)) {
        return handler(event);
      }
    };
    
    return this.subscribe(eventName, filteredHandler);
  }

  /**
   * Batch emit multiple events
   */
  async batchEmit(events) {
    const results = [];
    for (const { eventName, data } of events) {
      const result = await this.emit(eventName, data);
      results.push(result);
    }
    return results;
  }
}

// Event names constants for consistency
const LEARNING_EVENTS = {
  // Interaction events
  INTERACTION_CAPTURED: 'interaction.captured',
  FUNCTION_CALLED: 'function.called',
  WORKFLOW_STEP: 'workflow.step',
  SESSION_STARTED: 'session.started',
  SESSION_COMPLETED: 'session.completed',
  
  // Pattern events
  PATTERN_DETECTED: 'pattern.detected',
  SEQUENCE_FOUND: 'sequence.found',
  TEMPORAL_PATTERN_FOUND: 'temporal.pattern.found',
  CONTEXT_PATTERN_FOUND: 'context.pattern.found',
  
  // Learning events
  CHALLENGE_CREATED: 'challenge.created',
  SOLUTION_ATTEMPTED: 'solution.attempted',
  LEARNING_VALIDATED: 'learning.validated',
  OUTCOME_RECORDED: 'outcome.recorded',
  
  // Memory events
  MEMORY_STORED: 'memory.stored',
  MEMORY_UPDATED: 'memory.updated',
  PROCEDURE_CREATED: 'procedure.created',
  
  // Automation events
  BOTTLENECK_DETECTED: 'bottleneck.detected',
  AUTOMATION_SUGGESTED: 'automation.suggested',
  AUTOMATION_IMPLEMENTED: 'automation.implemented',
  
  // User events
  USER_PATTERN_LEARNED: 'user.pattern.learned',
  SUGGESTION_OFFERED: 'suggestion.offered',
  SUGGESTION_ACCEPTED: 'suggestion.accepted',
  SUGGESTION_REJECTED: 'suggestion.rejected'
};

// Create singleton instance
let eventBusInstance = null;

class LearningEventBusManager {
  static getInstance() {
    if (!eventBusInstance) {
      eventBusInstance = new LearningEventBus();
    }
    return eventBusInstance;
  }
  
  static resetInstance() {
    if (eventBusInstance) {
      eventBusInstance.clearAll();
    }
    eventBusInstance = null;
  }
}

// Create singleton instance
const learningEventBus = new LearningEventBus();

module.exports = {
  LearningEventBusManager,
  LEARNING_EVENTS,
  learningEventBus
};