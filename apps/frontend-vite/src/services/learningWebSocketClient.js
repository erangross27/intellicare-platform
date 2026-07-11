/**
 * Learning WebSocket Client
 * 
 * Frontend service for real-time learning insights, predictions,
 * and automation discoveries via WebSocket connection
 */

// Browser-compatible EventEmitter implementation
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(eventName, listener) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
  }

  emit(eventName, ...args) {
    if (this.events[eventName]) {
      this.events[eventName].forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  removeListener(eventName, listener) {
    if (this.events[eventName]) {
      this.events[eventName] = this.events[eventName].filter(l => l !== listener);
    }
  }

  removeAllListeners(eventNames) {
    if (Array.isArray(eventNames)) {
      eventNames.forEach(eventName => {
        delete this.events[eventName];
      });
    } else if (eventNames) {
      delete this.events[eventNames];
    } else {
      this.events = {};
    }
  }

  once(eventName, listener) {
    const onceWrapper = (...args) => {
      listener(...args);
      this.removeListener(eventName, onceWrapper);
    };
    this.on(eventName, onceWrapper);
  }
}
import secureStorage from '../utils/secureStorage';

class LearningWebSocketClient extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.heartbeatInterval = null;
        this.messageQueue = [];
        this.isConnected = false;
        this.subscriptions = new Set();
        this.pendingRequests = new Map();
        this.clientId = null;
    }

    /**
     * Connect to WebSocket server
     */
    async connect() {
        try {
            // Get auth token
            const token = secureStorage.getItem('authToken');
            if (!token) {
                throw new Error('No authentication token available');
            }

            // Determine WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/ws/learn?token=${encodeURIComponent(token)}`;

            console.log('🔌 Connecting to Learning WebSocket...');
            
            this.ws = new WebSocket(wsUrl);
            
            // Setup event handlers
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            
            // Wait for connection
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 10000);
                
                this.once('connected', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                
                this.once('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
        } catch (error) {
            console.error('Failed to connect to Learning WebSocket:', error);
            throw error;
        }
    }

    /**
     * Handle WebSocket connection open
     */
    handleOpen() {
        console.log('✅ Learning WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Process queued messages
        this.processMessageQueue();
        
        // Re-subscribe to events
        if (this.subscriptions.size > 0) {
            this.send({
                type: 'subscribe',
                events: Array.from(this.subscriptions)
            });
        }
        
        this.emit('connected');
    }

    /**
     * Handle incoming WebSocket message
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'connected':
                    this.clientId = message.clientId;
                    console.log(`📊 Connected with client ID: ${this.clientId}`);
                    break;
                    
                case 'workflow_prediction':
                    this.handleWorkflowPrediction(message);
                    break;
                    
                case 'personal_suggestions':
                    this.handlePersonalSuggestions(message);
                    break;
                    
                case 'efficiency_metrics':
                    this.handleEfficiencyMetrics(message);
                    break;
                    
                case 'new_suggestion':
                    this.handleNewSuggestion(message.data);
                    break;
                    
                case 'efficiency_alert':
                    this.handleEfficiencyAlert(message.data);
                    break;
                    
                case 'automation_opportunity':
                    this.handleAutomationOpportunity(message.data);
                    break;
                    
                case 'pattern_detected':
                    this.handlePatternDetected(message.data);
                    break;
                    
                case 'bottleneck_alert':
                    this.handleBottleneckAlert(message.data);
                    break;
                    
                case 'learning_milestone':
                    this.handleLearningMilestone(message.data);
                    break;
                    
                case 'rzero_update':
                    this.handleRZeroUpdate(message.data);
                    break;
                    
                case 'initial_suggestions':
                    this.handleInitialSuggestions(message.suggestions);
                    break;
                    
                case 'current_workflow_predictions':
                    this.handleCurrentWorkflowPredictions(message.predictions);
                    break;
                    
                case 'error':
                    this.handleServerError(message);
                    break;
                    
                case 'pong':
                    // Heartbeat response
                    break;
                    
                default:
                    // Check if it's a response to a request
                    if (message.requestId) {
                        const handler = this.pendingRequests.get(message.requestId);
                        if (handler) {
                            handler.resolve(message);
                            this.pendingRequests.delete(message.requestId);
                        }
                    }
            }
            
            // Emit raw message for custom handling
            this.emit('message', message);
            
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }

    /**
     * Handle WebSocket error
     */
    handleError(error) {
        console.error('❌ Learning WebSocket error:', error);
        this.emit('error', error);
    }

    /**
     * Handle WebSocket close
     */
    handleClose(event) {
        console.log('🔌 Learning WebSocket disconnected');
        this.isConnected = false;
        this.clientId = null;
        
        // Stop heartbeat
        this.stopHeartbeat();
        
        // Emit disconnect event
        this.emit('disconnected', event);
        
        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect().catch(error => {
                    console.error('Reconnection failed:', error);
                });
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('max_reconnect_failed');
        }
    }

    /**
     * Subscribe to learning events
     */
    subscribe(events) {
        if (!Array.isArray(events)) {
            events = [events];
        }
        
        for (const event of events) {
            this.subscriptions.add(event);
        }
        
        if (this.isConnected) {
            this.send({
                type: 'subscribe',
                events
            });
        }
    }

    /**
     * Unsubscribe from learning events
     */
    unsubscribe(events) {
        if (!Array.isArray(events)) {
            events = [events];
        }
        
        for (const event of events) {
            this.subscriptions.delete(event);
        }
        
        if (this.isConnected) {
            this.send({
                type: 'unsubscribe',
                events
            });
        }
    }

    /**
     * Request workflow predictions
     */
    requestWorkflowPrediction(currentSteps) {
        return this.request({
            type: 'request_prediction',
            data: { currentSteps }
        });
    }

    /**
     * Request personal suggestions
     */
    requestSuggestions(context) {
        return this.request({
            type: 'request_suggestions',
            data: { context }
        });
    }

    /**
     * Request efficiency metrics
     */
    requestEfficiencyMetrics(type = 'user', timeframe = '7d') {
        return this.request({
            type: 'request_efficiency',
            data: { type, timeframe }
        });
    }

    /**
     * Send feedback on a suggestion
     */
    sendFeedback(suggestionId, feedback, accepted) {
        return this.request({
            type: 'feedback',
            data: {
                suggestionId,
                feedback,
                accepted
            }
        });
    }

    /**
     * Send a request and wait for response
     */
    request(message) {
        return new Promise((resolve, reject) => {
            const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            message.data = message.data || {};
            message.data.requestId = requestId;
            
            // Set timeout
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Request timeout'));
            }, 30000);
            
            // Store handler
            this.pendingRequests.set(requestId, {
                resolve: (response) => {
                    clearTimeout(timeout);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            
            // Send request
            this.send(message);
        });
    }

    /**
     * Send message to server
     */
    send(message) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            // Queue message for later
            this.messageQueue.push(message);
        }
    }

    /**
     * Process queued messages
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }

    /**
     * Start heartbeat
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping' });
            }
        }, 30000);
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Event Handlers
     */
    
    handleWorkflowPrediction(message) {
        this.emit('workflow_prediction', message.predictions);
        
        // Show notification for high-confidence predictions
        const topPrediction = message.predictions[0];
        if (topPrediction && topPrediction.confidence > 0.8) {
            this.showNotification(
                'Workflow Prediction',
                `Next likely step: ${topPrediction.name}`,
                'info'
            );
        }
    }

    handlePersonalSuggestions(message) {
        this.emit('personal_suggestions', message.suggestions);
        
        // Show notification for important suggestions
        const importantSuggestion = message.suggestions.find(s => s.priority === 'high');
        if (importantSuggestion) {
            this.showNotification(
                'Personal Assistant',
                importantSuggestion.title,
                'suggestion'
            );
        }
    }

    handleEfficiencyMetrics(message) {
        this.emit('efficiency_metrics', message.efficiency);
    }

    handleNewSuggestion(data) {
        this.emit('new_suggestion', data);
        
        this.showNotification(
            'New Suggestion',
            data.suggestion.title,
            'suggestion'
        );
    }

    handleEfficiencyAlert(data) {
        this.emit('efficiency_alert', data);
        
        this.showNotification(
            'Efficiency Alert',
            data.message,
            'warning'
        );
    }

    handleAutomationOpportunity(data) {
        this.emit('automation_opportunity', data);
        
        if (data.roi > 1000) { // High ROI
            this.showNotification(
                'Automation Opportunity',
                `Potential savings: $${data.roi.toFixed(0)}/month`,
                'success'
            );
        }
    }

    handlePatternDetected(data) {
        this.emit('pattern_detected', data);
    }

    handleBottleneckAlert(data) {
        this.emit('bottleneck_alert', data);
        
        if (data.severity === 'high') {
            this.showNotification(
                'Bottleneck Detected',
                data.description,
                'warning'
            );
        }
    }

    handleLearningMilestone(data) {
        this.emit('learning_milestone', data);
        
        this.showNotification(
            'Learning Milestone',
            data.achievement,
            'success'
        );
    }

    handleRZeroUpdate(data) {
        this.emit('rzero_update', data);
    }

    handleInitialSuggestions(suggestions) {
        this.emit('initial_suggestions', suggestions);
    }

    handleCurrentWorkflowPredictions(predictions) {
        this.emit('current_workflow_predictions', predictions);
    }

    handleServerError(message) {
        console.error('Server error:', message.error);
        this.emit('server_error', message.error);
    }

    /**
     * Show notification to user
     */
    showNotification(title, message, type = 'info') {
        // Check if browser notifications are supported and permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/logo192.png',
                tag: 'learning-insight',
                requireInteraction: false
            });
        }
        
        // Also emit event for in-app notifications
        this.emit('notification', {
            title,
            message,
            type,
            timestamp: new Date()
        });
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return Notification.permission === 'granted';
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
        
        if (this.ws) {
            this.ws.close();
        }
        
        this.stopHeartbeat();
        this.isConnected = false;
        this.messageQueue = [];
        this.pendingRequests.clear();
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            clientId: this.clientId,
            subscriptions: Array.from(this.subscriptions),
            queuedMessages: this.messageQueue.length,
            pendingRequests: this.pendingRequests.size
        };
    }
}

// Create and export singleton instance
const learningWebSocketClient = new LearningWebSocketClient();

export default learningWebSocketClient;