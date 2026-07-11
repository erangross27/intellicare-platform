/**
 * Learning WebSocket Server
 * 
 * Real-time WebSocket server for streaming learning insights,
 * predictions, and automation discoveries to connected clients
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { learningEventBus } = require('./learningEventBus');
const learningAPIGateway = require('./learningAPIGateway');
const personalAssistantService = require('./personalAssistantService');
const workflowPredictorService = require('./workflowPredictorService');
const SecureDataAccess = require('../secureDataAccess');
const productionKMS = require('../productionKMS');

class LearningWebSocketServer {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // clientId -> WebSocket connection
        this.subscriptions = new Map(); // clientId -> Set of event types
        this.userSessions = new Map(); // userId -> Set of clientIds
        this.clinicSessions = new Map(); // practiceId -> Set of clientIds
        this.heartbeatInterval = null;
        this.statsInterval = null;
        this.jwtSecret = null;
        this.initialized = false;
    }

    async initialize(server) {
        if (this.initialized) return;

        try {
            // If no server provided, defer WebSocket creation until later
            if (!server) {
                console.log('  ⏳ Deferring WebSocket server creation until HTTP server is available');
                this.deferredInit = true;
                this.initialized = false; // Not fully initialized yet
                return;
            }
            
            // Get JWT secret from KMS
            this.jwtSecret = await productionKMS.getInternalKey('JWT_SECRET');
            
            // Create WebSocket server attached to HTTP server
            this.wss = new WebSocket.Server({
                server,
                path: '/ws/learn',
                verifyClient: this.verifyClient.bind(this)
            });
            
            // Setup WebSocket event handlers
            this.wss.on('connection', this.handleConnection.bind(this));
            
            // Subscribe to learning events for broadcasting
            this.subscribeToLearningEvents();
            
            // Start heartbeat to detect disconnected clients
            this.startHeartbeat();
            
            // Start stats reporting
            this.startStatsReporting();
            
            this.initialized = true;
            console.log('✅ Learning WebSocket Server initialized on /ws/learn');
            
        } catch (error) {
            console.error('Failed to initialize Learning WebSocket Server:', error);
            throw error;
        }
    }

    /**
     * Verify WebSocket client before accepting connection
     */
    async verifyClient(info, callback) {
        try {
            // Extract token from query params or headers
            const url = new URL(info.req.url, `http://${info.req.headers.host}`);
            const token = url.searchParams.get('token') || 
                         info.req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                callback(false, 401, 'Unauthorized');
                return;
            }
            
            // Verify JWT token
            const decoded = jwt.verify(token, this.jwtSecret);
            
            // Add user info to request for later use
            info.req.userId = decoded.userId;
            info.req.practiceId = decoded.practiceId;
            info.req.role = decoded.role;
            
            callback(true);
            
        } catch (error) {
            console.error('WebSocket authentication failed:', error);
            callback(false, 401, 'Invalid token');
        }
    }

    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws, request) {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const userId = request.userId;
        const practiceId = request.practiceId;
        
        // Store client connection
        this.clients.set(clientId, {
            ws,
            userId,
            practiceId,
            role: request.role,
            connectedAt: new Date(),
            lastActivity: new Date(),
            isAlive: true
        });
        
        // Add to user sessions
        if (!this.userSessions.has(userId)) {
            this.userSessions.set(userId, new Set());
        }
        this.userSessions.get(userId).add(clientId);
        
        // Add to practice sessions
        if (!this.clinicSessions.has(practiceId)) {
            this.clinicSessions.set(practiceId, new Set());
        }
        this.clinicSessions.get(practiceId).add(clientId);
        
        // Initialize client subscriptions
        this.subscriptions.set(clientId, new Set());
        
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔌 WebSocket client connected: ${clientId} (User: ${userId})`);
        
        // Send welcome message
        this.sendToClient(clientId, {
            type: 'connected',
            clientId,
            timestamp: new Date(),
            message: 'Connected to IntelliCare Learning System'
        });
        
        // Setup client event handlers
        ws.on('message', (data) => this.handleClientMessage(clientId, data));
        ws.on('close', () => this.handleClientDisconnect(clientId));
        ws.on('error', (error) => this.handleClientError(clientId, error));
        ws.on('pong', () => this.handlePong(clientId));
        
        // Send initial predictions for the user
        this.sendInitialData(clientId);
    }

    /**
     * Handle incoming message from client
     */
    async handleClientMessage(clientId, data) {
        try {
            const client = this.clients.get(clientId);
            if (!client) return;
            
            client.lastActivity = new Date();
            
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'subscribe':
                    await this.handleSubscribe(clientId, message.events);
                    break;
                    
                case 'unsubscribe':
                    await this.handleUnsubscribe(clientId, message.events);
                    break;
                    
                case 'request_prediction':
                    await this.handlePredictionRequest(clientId, message.data);
                    break;
                    
                case 'request_suggestions':
                    await this.handleSuggestionsRequest(clientId, message.data);
                    break;
                    
                case 'request_efficiency':
                    await this.handleEfficiencyRequest(clientId, message.data);
                    break;
                    
                case 'feedback':
                    await this.handleFeedback(clientId, message.data);
                    break;
                    
                case 'ping':
                    this.sendToClient(clientId, { type: 'pong' });
                    break;
                    
                default:
                    console.warn(`Unknown message type: ${message.type}`);
            }
            
        } catch (error) {
            console.error(`Error handling client message from ${clientId}:`, error);
            this.sendError(clientId, 'Invalid message format');
        }
    }

    /**
     * Handle client subscription to events
     */
    async handleSubscribe(clientId, events) {
        const subscriptions = this.subscriptions.get(clientId);
        if (!subscriptions) return;
        
        for (const event of events) {
            subscriptions.add(event);
        }
        
        this.sendToClient(clientId, {
            type: 'subscribed',
            events,
            timestamp: new Date()
        });
        
        console.log(`Client ${clientId} subscribed to:`, events);
    }

    /**
     * Handle client unsubscription from events
     */
    async handleUnsubscribe(clientId, events) {
        const subscriptions = this.subscriptions.get(clientId);
        if (!subscriptions) return;
        
        for (const event of events) {
            subscriptions.delete(event);
        }
        
        this.sendToClient(clientId, {
            type: 'unsubscribed',
            events,
            timestamp: new Date()
        });
    }

    /**
     * Handle workflow prediction request
     */
    async handlePredictionRequest(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        try {
            const predictions = await workflowPredictorService.predictWorkflow(
                client.userId,
                data.currentSteps || [],
                {
                    practiceId: client.practiceId,
                    realtime: true
                }
            );
            
            this.sendToClient(clientId, {
                type: 'workflow_prediction',
                predictions: predictions.slice(0, 5), // Top 5 predictions
                requestId: data.requestId,
                timestamp: new Date()
            });
            
        } catch (error) {
            this.sendError(clientId, 'Failed to generate predictions');
        }
    }

    /**
     * Handle suggestions request
     */
    async handleSuggestionsRequest(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        try {
            const suggestions = await personalAssistantService.getPersonalizedSuggestions(
                client.userId,
                {
                    practiceId: client.practiceId,
                    context: data.context,
                    realtime: true
                }
            );
            
            this.sendToClient(clientId, {
                type: 'personal_suggestions',
                suggestions,
                requestId: data.requestId,
                timestamp: new Date()
            });
            
        } catch (error) {
            this.sendError(clientId, 'Failed to generate suggestions');
        }
    }

    /**
     * Handle efficiency metrics request
     */
    async handleEfficiencyRequest(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        try {
            const efficiency = await learningAPIGateway.handleRequest(
                'GET',
                '/learn/analysis/efficiency',
                {
                    type: data.type || 'user',
                    timeframe: data.timeframe || '7d'
                },
                {
                    userId: client.userId,
                    practiceId: client.practiceId,
                    role: client.role
                }
            );
            
            this.sendToClient(clientId, {
                type: 'efficiency_metrics',
                efficiency,
                requestId: data.requestId,
                timestamp: new Date()
            });
            
        } catch (error) {
            this.sendError(clientId, 'Failed to get efficiency metrics');
        }
    }

    /**
     * Handle user feedback
     */
    async handleFeedback(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        try {
            await personalAssistantService.processFeedback(
                data.suggestionId,
                {
                    userId: client.userId,
                    feedback: data.feedback,
                    accepted: data.accepted,
                    timestamp: new Date()
                }
            );
            
            this.sendToClient(clientId, {
                type: 'feedback_received',
                requestId: data.requestId,
                timestamp: new Date()
            });
            
        } catch (error) {
            this.sendError(clientId, 'Failed to process feedback');
        }
    }

    /**
     * Subscribe to learning events for broadcasting
     */
    subscribeToLearningEvents() {
        // Start live streaming services
        this.startLiveStreaming();
        
        // Subscribe to existing event bus events
        // Workflow predictions available
        learningEventBus.subscribe('workflow.predicted', (data) => {
            this.broadcastToUser(data.userId, {
                type: 'workflow_predicted',
                data
            }, 'workflow_predictions');
        });
        
        // New suggestion available
        learningEventBus.subscribe('suggestion.available', (data) => {
            this.broadcastToUser(data.userId, {
                type: 'new_suggestion',
                data
            }, 'suggestions');
        });
        
        // Efficiency alert
        learningEventBus.subscribe('efficiency.alert', (data) => {
            this.broadcastToUser(data.userId, {
                type: 'efficiency_alert',
                data
            }, 'efficiency_alerts');
        });
        
        // Automation opportunity discovered
        learningEventBus.subscribe('automation.discovered', (data) => {
            this.broadcastToClinic(data.practiceId, {
                type: 'automation_opportunity',
                data
            }, 'automation_discoveries');
        });
        
        // Pattern detected
        learningEventBus.subscribe('pattern.detected', (data) => {
            this.broadcastToUser(data.userId, {
                type: 'pattern_detected',
                data
            }, 'pattern_detection');
        });
        
        // Bottleneck identified
        learningEventBus.subscribe('bottleneck.identified', (data) => {
            this.broadcastToClinic(data.practiceId, {
                type: 'bottleneck_alert',
                data
            }, 'bottleneck_alerts');
        });
        
        // Learning milestone reached
        learningEventBus.subscribe('learning.milestone', (data) => {
            this.broadcastToUser(data.userId, {
                type: 'learning_milestone',
                data
            }, 'learning_milestones');
        });
        
        // R-Zero cycle completed
        learningEventBus.subscribe('rzero.cycle.completed', (data) => {
            this.broadcastToClinic(data.practiceId, {
                type: 'rzero_update',
                data
            }, 'rzero_updates');
        });
    }

    /**
     * Send initial data to newly connected client
     */
    async sendInitialData(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        try {
            // Get recent suggestions
            const suggestions = await personalAssistantService.getPersonalizedSuggestions(
                client.userId,
                {
                    practiceId: client.practiceId,
                    limit: 3
                }
            );
            
            if (suggestions && suggestions.length > 0) {
                this.sendToClient(clientId, {
                    type: 'initial_suggestions',
                    suggestions,
                    timestamp: new Date()
                });
            }
            
            // Get current workflow predictions if in a workflow
            const currentWorkflow = await this.getCurrentWorkflow(client.userId);
            if (currentWorkflow) {
                const predictions = await workflowPredictorService.predictWorkflow(
                    client.userId,
                    currentWorkflow.steps,
                    {
                        practiceId: client.practiceId
                    }
                );
                
                this.sendToClient(clientId, {
                    type: 'current_workflow_predictions',
                    predictions: predictions.slice(0, 3),
                    timestamp: new Date()
                });
            }
            
        } catch (error) {
            console.error(`Error sending initial data to ${clientId}:`, error);
        }
    }

    /**
     * Broadcast message to all clients of a user
     */
    broadcastToUser(userId, message, eventType) {
        const clientIds = this.userSessions.get(userId);
        if (!clientIds) return;
        
        for (const clientId of clientIds) {
            const subscriptions = this.subscriptions.get(clientId);
            if (subscriptions && subscriptions.has(eventType)) {
                this.sendToClient(clientId, message);
            }
        }
    }

    /**
     * Broadcast message to all clients in a practice
     */
    broadcastToClinic(practiceId, message, eventType) {
        const clientIds = this.clinicSessions.get(practiceId);
        if (!clientIds) return;
        
        for (const clientId of clientIds) {
            const client = this.clients.get(clientId);
            const subscriptions = this.subscriptions.get(clientId);
            
            // Only send to admins for practice-wide events
            if (client && subscriptions && 
                (client.role === 'admin' || client.role === 'super_admin') &&
                subscriptions.has(eventType)) {
                this.sendToClient(clientId, message);
            }
        }
    }

    /**
     * Send message to specific client
     */
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) return;
        
        try {
            client.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error(`Error sending to client ${clientId}:`, error);
        }
    }

    /**
     * Send error message to client
     */
    sendError(clientId, error) {
        this.sendToClient(clientId, {
            type: 'error',
            error,
            timestamp: new Date()
        });
    }

    /**
     * Handle client disconnect
     */
    handleClientDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔌 WebSocket client disconnected: ${clientId}`);
        
        // Remove from user sessions
        const userClients = this.userSessions.get(client.userId);
        if (userClients) {
            userClients.delete(clientId);
            if (userClients.size === 0) {
                this.userSessions.delete(client.userId);
            }
        }
        
        // Remove from practice sessions
        const clinicClients = this.clinicSessions.get(client.practiceId);
        if (clinicClients) {
            clinicClients.delete(clientId);
            if (clinicClients.size === 0) {
                this.clinicSessions.delete(client.practiceId);
            }
        }
        
        // Clean up
        this.subscriptions.delete(clientId);
        this.clients.delete(clientId);
    }

    /**
     * Handle client error
     */
    handleClientError(clientId, error) {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientDisconnect(clientId);
    }

    /**
     * Handle pong response for heartbeat
     */
    handlePong(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.isAlive = true;
        }
    }

    /**
     * Start heartbeat to detect disconnected clients
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            for (const [clientId, client] of this.clients) {
                if (!client.isAlive) {
                    // Client didn't respond to last ping
                    client.ws.terminate();
                    this.handleClientDisconnect(clientId);
                } else {
                    client.isAlive = false;
                    client.ws.ping();
                }
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Start periodic stats reporting
     */
    startStatsReporting() {
        this.statsInterval = setInterval(() => {
            const stats = {
                totalClients: this.clients.size,
                totalUsers: this.userSessions.size,
                totalClinics: this.clinicSessions.size,
                subscriptions: {}
            };
            
            // Count subscriptions by type
            for (const subs of this.subscriptions.values()) {
                for (const event of subs) {
                    stats.subscriptions[event] = (stats.subscriptions[event] || 0) + 1;
                }
            }
            
            
        }, 300000); // Every 5 minutes
    }

    /**
     * Get current workflow for user
     */
    async getCurrentWorkflow(userId) {
        try {
            const workflows = await SecureDataAccess.query(
                'active_workflows',
                {
                    userId,
                    status: 'in_progress'
                },
                {
                    sort: { startedAt: -1 },
                    limit: 1
                },
                {
                    serviceId: 'learning-websocket',
                    operation: 'getCurrentWorkflow',
                    practiceId: 'global'
                }
            );
            
            return workflows[0] || null;
            
        } catch (error) {
            console.error('Error getting current workflow:', error);
            return null;
        }
    }

    /**
     * Start live streaming services for real-time updates
     */
    startLiveStreaming() {
        console.log('🔄 Starting live learning event streaming...');
        
        // Start workflow prediction streaming
        this.startWorkflowPredictionStreaming();
        
        // Start automation suggestion streaming
        this.startAutomationSuggestionStreaming();
        
        // Start efficiency alert streaming
        this.startEfficiencyAlertStreaming();
        
        // Start pattern detection streaming  
        this.startPatternDetectionStreaming();
        
        // Start R-Zero updates streaming
        this.startRZeroUpdateStreaming();
        
        console.log('✅ Live learning event streaming activated');
    }

    /**
     * Stream real-time workflow predictions
     */
    startWorkflowPredictionStreaming() {
        // Check for new workflow predictions every 10 seconds for active users
        setInterval(async () => {
            try {
                for (const [clientId, client] of this.clients) {
                    const subscriptions = this.subscriptions.get(clientId);
                    if (!subscriptions?.has('workflow_prediction')) continue;
                    
                    // Get recent user actions to predict next steps
                    const recentActions = await this.getRecentUserActions(client.userId);
                    if (recentActions.length === 0) continue;
                    
                    // Generate predictions based on current context
                    const predictions = await workflowPredictorService.predictWorkflow(
                        client.userId,
                        recentActions.map(a => a.actionType),
                        {
                            practiceId: client.practiceId,
                            realtime: true,
                            confidence_threshold: 0.7
                        }
                    );
                    
                    if (predictions && predictions.length > 0) {
                        this.sendToClient(clientId, {
                            type: 'workflow_prediction',
                            predictions: predictions.slice(0, 3), // Top 3 predictions
                            context: {
                                currentStep: recentActions[recentActions.length - 1]?.actionType,
                                confidence: predictions[0]?.confidence
                            },
                            timestamp: new Date()
                        });
                    }
                }
            } catch (error) {
                console.error('Error streaming workflow predictions:', error);
            }
        }, 10000); // Every 10 seconds
    }

    /**
     * Stream real-time automation suggestions
     */
    startAutomationSuggestionStreaming() {
        // Check for new automation opportunities every 30 seconds
        setInterval(async () => {
            try {
                for (const [clientId, client] of this.clients) {
                    const subscriptions = this.subscriptions.get(clientId);
                    if (!subscriptions?.has('automation_opportunity')) continue;
                    
                    // Check for new automation opportunities
                    const opportunities = await this.checkForNewAutomationOpportunities(client.practiceId, client.userId);
                    
                    for (const opportunity of opportunities) {
                        // Only send high-value opportunities
                        if (opportunity.roi > 500 && opportunity.confidence > 0.8) {
                            this.sendToClient(clientId, {
                                type: 'automation_opportunity',
                                data: {
                                    id: opportunity.id,
                                    title: opportunity.title,
                                    description: opportunity.description,
                                    roi: opportunity.roi,
                                    effort: opportunity.effort,
                                    priority: opportunity.priority,
                                    category: opportunity.category,
                                    confidence: opportunity.confidence
                                },
                                timestamp: new Date()
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error streaming automation suggestions:', error);
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Stream efficiency alerts and insights
     */
    startEfficiencyAlertStreaming() {
        // Check for efficiency issues every 60 seconds
        setInterval(async () => {
            try {
                for (const [clientId, client] of this.clients) {
                    const subscriptions = this.subscriptions.get(clientId);
                    if (!subscriptions?.has('efficiency_alert')) continue;
                    
                    // Calculate current user efficiency
                    const efficiency = await this.calculateUserEfficiency(client.userId);
                    
                    // Check for efficiency alerts
                    if (efficiency.score < 0.7 && efficiency.trend === 'decreasing') {
                        this.sendToClient(clientId, {
                            type: 'efficiency_alert',
                            data: {
                                severity: 'medium',
                                message: `Your efficiency has decreased to ${(efficiency.score * 100).toFixed(1)}%`,
                                suggestions: efficiency.improvementSuggestions,
                                metrics: {
                                    current: efficiency.score,
                                    previous: efficiency.previousScore,
                                    trend: efficiency.trend
                                }
                            },
                            timestamp: new Date()
                        });
                    }
                    
                    // Check for bottlenecks
                    const bottlenecks = await this.detectUserBottlenecks(client.userId);
                    for (const bottleneck of bottlenecks) {
                        if (bottleneck.severity === 'high') {
                            this.sendToClient(clientId, {
                                type: 'bottleneck_alert',
                                data: {
                                    severity: bottleneck.severity,
                                    description: bottleneck.description,
                                    impact: bottleneck.impact,
                                    suggestions: bottleneck.suggestions,
                                    workflow: bottleneck.workflow
                                },
                                timestamp: new Date()
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error streaming efficiency alerts:', error);
            }
        }, 60000); // Every 60 seconds
    }

    /**
     * Stream pattern detection events
     */
    startPatternDetectionStreaming() {
        // Check for new patterns every 2 minutes
        setInterval(async () => {
            try {
                for (const [clientId, client] of this.clients) {
                    const subscriptions = this.subscriptions.get(clientId);
                    if (!subscriptions?.has('pattern_detected')) continue;
                    
                    // Check for newly detected patterns
                    const newPatterns = await this.getNewlyDetectedPatterns(client.userId, client.practiceId);
                    
                    for (const pattern of newPatterns) {
                        this.sendToClient(clientId, {
                            type: 'pattern_detected',
                            data: {
                                id: pattern.id,
                                type: pattern.type,
                                name: pattern.name,
                                description: pattern.description,
                                confidence: pattern.confidence,
                                frequency: pattern.frequency,
                                impact: pattern.impact,
                                suggestions: pattern.optimizationSuggestions
                            },
                            timestamp: new Date()
                        });
                    }
                }
            } catch (error) {
                console.error('Error streaming pattern detection:', error);
            }
        }, 120000); // Every 2 minutes
    }

    /**
     * Stream R-Zero learning updates
     */
    startRZeroUpdateStreaming() {
        // Check for R-Zero updates every 5 minutes
        setInterval(async () => {
            try {
                for (const [clientId, client] of this.clients) {
                    const subscriptions = this.subscriptions.get(clientId);
                    if (!subscriptions?.has('rzero_update')) continue;
                    
                    // Get latest R-Zero challenge results
                    const updates = await this.getRZeroUpdates(client.practiceId);
                    
                    for (const update of updates) {
                        if (update.milestone || update.breakthrough) {
                            this.sendToClient(clientId, {
                                type: 'rzero_update',
                                data: {
                                    type: update.type,
                                    challenge: update.challenge,
                                    achievement: update.achievement,
                                    impact: update.impact,
                                    performance: update.performance,
                                    milestone: update.milestone,
                                    breakthrough: update.breakthrough
                                },
                                timestamp: new Date()
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error streaming R-Zero updates:', error);
            }
        }, 300000); // Every 5 minutes
    }

    /**
     * Helper methods for live streaming
     */
    
    async getRecentUserActions(userId) {
        try {
            const actions = await SecureDataAccess.query(
                'interaction_logs',
                {
                    userId,
                    timestamp: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
                },
                { sort: { timestamp: -1 }, limit: 5 },
                {
                    serviceId: 'learning-websocket',
                    operation: 'getRecentUserActions',
                    practiceId: 'global'
                }
            );
            return actions || [];
        } catch (error) {
            console.error('Error getting recent user actions:', error);
            return [];
        }
    }

    async checkForNewAutomationOpportunities(practiceId, userId) {
        try {
            const opportunities = await SecureDataAccess.query(
                'automation_opportunities',
                {
                    practiceId,
                    status: 'new',
                    discoveredAt: { $gte: new Date(Date.now() - 3600000) } // Last hour
                },
                { sort: { roi: -1 }, limit: 3 },
                {
                    serviceId: 'learning-websocket',
                    operation: 'checkAutomationOpportunities',
                    practiceId
                }
            );
            return opportunities || [];
        } catch (error) {
            console.error('Error checking automation opportunities:', error);
            return [];
        }
    }

    async calculateUserEfficiency(userId) {
        try {
            // Get recent efficiency metrics
            const metrics = await SecureDataAccess.query(
                'efficiency_metrics',
                { userId },
                { sort: { timestamp: -1 }, limit: 10 },
                {
                    serviceId: 'learning-websocket',
                    operation: 'calculateUserEfficiency',
                    practiceId: 'global'
                }
            );
            
            if (metrics.length < 2) {
                return { score: 0.8, trend: 'stable', improvementSuggestions: [] };
            }
            
            const current = metrics[0].score;
            const previous = metrics[1].score;
            const trend = current > previous ? 'increasing' : (current < previous ? 'decreasing' : 'stable');
            
            return {
                score: current,
                previousScore: previous,
                trend,
                improvementSuggestions: this.generateEfficiencyImprovements(current, metrics)
            };
            
        } catch (error) {
            console.error('Error calculating user efficiency:', error);
            return { score: 0.8, trend: 'stable', improvementSuggestions: [] };
        }
    }

    async detectUserBottlenecks(userId) {
        try {
            const bottlenecks = await SecureDataAccess.query(
                'bottleneck_analyses',
                {
                    userId,
                    severity: { $in: ['high', 'critical'] },
                    resolved: false,
                    detectedAt: { $gte: new Date(Date.now() - 7200000) } // Last 2 hours
                },
                { sort: { severity: -1, detectedAt: -1 } },
                {
                    serviceId: 'learning-websocket',
                    operation: 'detectUserBottlenecks',
                    practiceId: 'global'
                }
            );
            return bottlenecks || [];
        } catch (error) {
            console.error('Error detecting bottlenecks:', error);
            return [];
        }
    }

    async getNewlyDetectedPatterns(userId, practiceId) {
        try {
            const patterns = await SecureDataAccess.query(
                'user_learning_patterns',
                {
                    $or: [{ userId }, { practiceId }],
                    confidence: { $gte: 0.8 },
                    detectedAt: { $gte: new Date(Date.now() - 3600000) }, // Last hour
                    notified: { $ne: true }
                },
                { sort: { confidence: -1 }, limit: 5 },
                {
                    serviceId: 'learning-websocket',
                    operation: 'getNewlyDetectedPatterns',
                    practiceId
                }
            );
            
            // Mark as notified
            if (patterns.length > 0) {
                await SecureDataAccess.update(
                    'user_learning_patterns',
                    { _id: { $in: patterns.map(p => p._id) } },
                    { $set: { notified: true } },
                    {
                        serviceId: 'learning-websocket',
                        operation: 'markPatternsNotified',
                        practiceId
                    }
                );
            }
            
            return patterns || [];
        } catch (error) {
            console.error('Error getting newly detected patterns:', error);
            return [];
        }
    }

    async getRZeroUpdates(practiceId) {
        try {
            const updates = await SecureDataAccess.query(
                'rzero_challenge_results',
                {
                    practiceId,
                    completedAt: { $gte: new Date(Date.now() - 3600000) }, // Last hour
                    $or: [
                        { milestone: true },
                        { breakthrough: true },
                        { 'performance.improvement': { $gte: 0.1 } } // 10% improvement
                    ]
                },
                { sort: { completedAt: -1 }, limit: 3 },
                {
                    serviceId: 'learning-websocket',
                    operation: 'getRZeroUpdates',
                    practiceId
                }
            );
            return updates || [];
        } catch (error) {
            console.error('Error getting R-Zero updates:', error);
            return [];
        }
    }

    generateEfficiencyImprovements(currentScore, metrics) {
        const suggestions = [];
        
        if (currentScore < 0.7) {
            suggestions.push('Consider organizing your workflow steps for better efficiency');
        }
        if (currentScore < 0.6) {
            suggestions.push('Review recent tasks for potential automation opportunities');
        }
        if (currentScore < 0.5) {
            suggestions.push('Take a break - fatigue may be affecting your performance');
        }
        
        return suggestions;
    }

    /**
     * Shutdown WebSocket server
     */
    shutdown() {
        console.log('Shutting down Learning WebSocket Server...');
        
        // Clear intervals
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        
        // Close all connections
        for (const [clientId, client] of this.clients) {
            this.sendToClient(clientId, {
                type: 'server_shutdown',
                message: 'Server is shutting down'
            });
            client.ws.close();
        }
        
        // Close server
        if (this.wss) {
            this.wss.close();
        }
        
        console.log('Learning WebSocket Server shut down');
    }
}

// Create and export singleton instance
const learningWebSocketServer = new LearningWebSocketServer();

module.exports = learningWebSocketServer;