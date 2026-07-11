/**
 * Learning Event Bus Service - Modular Version
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
  async emit(eventName, data = null) {
    const event = {
      name: eventName,
      data: data,
      timestamp: new Date(),
      id: `event_${Date.now()}_${Math.random()}`
    };

    // Add to history
    this.eventHistory.push(event);
    
    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Get subscribers for this event
    const eventSubscribers = this.subscribers.get(eventName);
    
    if (!eventSubscribers || eventSubscribers.size === 0) {
      if (this.debugMode) {
        console.log(`[LearningEventBus] No subscribers for event: ${eventName}`);
      }
      return;
    }

    if (this.debugMode) {
      console.log(`[LearningEventBus] Emitting ${eventName} to ${eventSubscribers.size} subscriber(s)`);
    }

    // Call all subscribers
    const promises = [];
    
    for (const [subscriberId, handler] of eventSubscribers) {
      try {
        const result = handler(event);
        
        // Handle async handlers
        if (result && typeof result.then === 'function') {
          promises.push(result.catch(error => {
            console.error(`[LearningEventBus] Error in async subscriber ${subscriberId}:`, error);
          }));
        }
        
      } catch (error) {
        console.error(`[LearningEventBus] Error in subscriber ${subscriberId}:`, error);
      }
    }

    // Wait for all async handlers
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    return event;
  }

  /**
   * Get event history
   */
  getHistory(eventName = null, limit = 100) {
    let history = this.eventHistory;
    
    if (eventName) {
      history = history.filter(event => event.name === eventName);
    }
    
    return history.slice(-limit);
  }

  /**
   * Get subscriber count for event
   */
  getSubscriberCount(eventName) {
    const eventSubscribers = this.subscribers.get(eventName);
    return eventSubscribers ? eventSubscribers.size : 0;
  }

  /**
   * Get all event names with subscribers
   */
  getEventNames() {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Clear all subscribers
   */
  clearAllSubscribers() {
    this.subscribers.clear();
    if (this.debugMode) {
      console.log('[LearningEventBus] All subscribers cleared');
    }
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
    if (this.debugMode) {
      console.log('[LearningEventBus] Event history cleared');
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    const totalSubscribers = Array.from(this.subscribers.values())
      .reduce((sum, subs) => sum + subs.size, 0);

    return {
      eventTypes: this.subscribers.size,
      totalSubscribers: totalSubscribers,
      historySize: this.eventHistory.length,
      maxHistorySize: this.maxHistorySize,
      debugMode: this.debugMode
    };
  }
}

// Learning event constants
const LEARNING_EVENTS = {
  // Interaction events
  INTERACTION_RECORDED: 'interaction.recorded',
  PATTERN_DETECTED: 'pattern.detected',
  SEQUENCE_COMPLETED: 'sequence.completed',
  
  // Learning events
  LEARNING_UPDATED: 'learning.updated',
  LEARNING_VALIDATED: 'learning.validated',
  MEMORY_UPDATED: 'memory.updated',
  
  // Analysis events
  BOTTLENECK_DETECTED: 'bottleneck.detected',
  EFFICIENCY_ANALYZED: 'efficiency.analyzed',
  OPPORTUNITY_IDENTIFIED: 'opportunity.identified',
  
  // Automation events
  AUTOMATION_SUGGESTED: 'automation.suggested',
  AUTOMATION_IMPLEMENTED: 'automation.implemented',
  
  // System events
  SERVICE_STARTED: 'service.started',
  SERVICE_STOPPED: 'service.stopped',
  ERROR_OCCURRED: 'error.occurred',
  
  // Outcome events
  OUTCOME_RECORDED: 'outcome.recorded',
  FEEDBACK_RECEIVED: 'feedback.received',
  
  // Challenge events
  CHALLENGE_CREATED: 'challenge.created',
  CHALLENGE_COMPLETED: 'challenge.completed'
};

// Singleton instance
const eventBusInstance = new LearningEventBus();

// Manager class for singleton access
class LearningEventBusManager {
  static getInstance() {
    return eventBusInstance;
  }
}

module.exports = { 
  LearningEventBus, 
  LearningEventBusManager, 
  LEARNING_EVENTS,
  learningEventBus: eventBusInstance
};