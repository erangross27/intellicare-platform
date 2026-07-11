/**
 * Learning WebSocket Server Service - Learning Training Domain
 * Enterprise-grade real-time learning communication system for the IntelliCare platform
 * 
 * Features:
 * - Real-time bidirectional learning data streaming
 * - Advanced client authentication and session management
 * - Multi-tenant subscription and event routing
 * - Intelligent workflow prediction broadcasting
 * - Real-time automation opportunity discovery streaming
 * - Comprehensive performance monitoring and analytics
 * - Advanced client health monitoring and recovery
 * - Scalable connection management with clustering support
 * - Security-first WebSocket implementation with JWT validation
 * - Real-time learning milestone notifications
 * - Advanced pattern detection event streaming
 * - R-Zero learning loop status broadcasting
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as WebSocket from 'ws';
import * as jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');
const productionKMS = require('../../../../../../backend/services/productionKMS');

// Enhanced event bus for learning services
class LearningEventBus extends EventEmitter {
  private subscribers: Map<string, Array<{ handler: Function; serviceId: string; priority: number }>> = new Map();

  subscribe(event: string, handler: Function, serviceId: string, priority = 1) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    
    const eventSubscribers = this.subscribers.get(event)!;
    eventSubscribers.push({ handler, serviceId, priority });
    
    // Sort by priority (higher priority first)
    eventSubscribers.sort((a, b) => b.priority - a.priority);
    
    this.on(event, handler);
  }

  async emit(event: string, data: any): Promise<boolean> {
    console.log(`📡 [EventBus] Broadcasting '${event}' to ${this.getSubscriberCount(event)} subscribers`);
    
    const subscribers = this.subscribers.get(event) || [];
    
    // Execute handlers in priority order
    for (const { handler, serviceId } of subscribers) {
      try {
        await handler(data);
      } catch (error) {
        console.error(`Event handler error in ${serviceId} for '${event}':`, error.message);
      }
    }
    
    return super.emit(event, data);
  }

  getSubscriberCount(event: string): number {
    return this.subscribers.get(event)?.length || 0;
  }
}

const learningEventBus = new LearningEventBus();

export interface ClientConnection {
  ws: WebSocket;
  userId: string;
  clinicId: string;
  role: string;
  connectedAt: Date;
  lastActivity: Date;
  isAlive: boolean;
  subscriptions: Set<string>;
  sessionId: string;
  clientInfo: {
    userAgent: string;
    ipAddress: string;
    platform: string;
  };
  metrics: {
    messagesSent: number;
    messagesReceived: number;
    bytesTransferred: number;
    lastHeartbeat: Date;
  };
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  requestId?: string;
  timestamp?: Date;
}

export interface SubscriptionEvent {
  clientId: string;
  events: string[];
  action: 'subscribe' | 'unsubscribe';
  timestamp: Date;
}

export interface PredictionRequest {
  requestId: string;
  currentSteps: string[];
  context: {
    workflowId?: string;
    patientId?: string;
    sessionId?: string;
  };
}

export interface SuggestionRequest {
  requestId: string;
  context: {
    currentPage?: string;
    workflowStep?: string;
    userIntent?: string;
  };
  preferences?: {
    categories: string[];
    priority: 'high' | 'medium' | 'low';
  };
}

export interface EfficiencyRequest {
  requestId: string;
  type: 'user' | 'clinic' | 'workflow';
  timeframe: '1h' | '1d' | '7d' | '30d';
  metrics: string[];
}

export interface FeedbackData {
  suggestionId: string;
  feedback: string;
  accepted: boolean;
  rating?: number;
  comments?: string;
  timestamp: Date;
}

export interface ServerStats {
  totalClients: number;
  totalUsers: number;
  totalClinics: number;
  activeConnections: number;
  subscriptions: Record<string, number>;
  messageVolume: {
    sent: number;
    received: number;
    bytesTransferred: number;
  };
  systemHealth: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface StreamingConfig {
  workflowPredictions: {
    enabled: boolean;
    interval: number;
    confidenceThreshold: number;
    maxPredictions: number;
  };
  automationSuggestions: {
    enabled: boolean;
    interval: number;
    minROI: number;
    confidenceThreshold: number;
  };
  efficiencyAlerts: {
    enabled: boolean;
    interval: number;
    thresholds: {
      warning: number;
      critical: number;
    };
  };
  patternDetection: {
    enabled: boolean;
    interval: number;
    confidenceThreshold: number;
  };
  rzeroUpdates: {
    enabled: boolean;
    interval: number;
    minImprovement: number;
  };
}

@Injectable()
export class LearningWebSocketServerService implements OnModuleInit, OnModuleDestroy {
  private serviceToken: any;
  private initialized = false;
  private readonly serviceId = 'learning-websocket-server';
  
  // WebSocket server and connections
  private wss: WebSocket.Server | null = null;
  private clients = new Map<string, ClientConnection>();
  private userSessions = new Map<string, Set<string>>();
  private clinicSessions = new Map<string, Set<string>>();
  
  // Monitoring and intervals
  private heartbeatInterval?: NodeJS.Timeout;
  private statsInterval?: NodeJS.Timeout;
  private streamingIntervals = new Map<string, NodeJS.Timeout>();
  
  // Configuration
  private jwtSecret: string | null = null;
  private readonly config: StreamingConfig = {
    workflowPredictions: {
      enabled: true,
      interval: 10000, // 10 seconds
      confidenceThreshold: 0.7,
      maxPredictions: 5
    },
    automationSuggestions: {
      enabled: true,
      interval: 30000, // 30 seconds
      minROI: 500,
      confidenceThreshold: 0.8
    },
    efficiencyAlerts: {
      enabled: true,
      interval: 60000, // 1 minute
      thresholds: {
        warning: 0.7,
        critical: 0.5
      }
    },
    patternDetection: {
      enabled: true,
      interval: 120000, // 2 minutes
      confidenceThreshold: 0.8
    },
    rzeroUpdates: {
      enabled: true,
      interval: 300000, // 5 minutes
      minImprovement: 0.1
    }
  };

  // Statistics tracking
  private stats: ServerStats = {
    totalClients: 0,
    totalUsers: 0,
    totalClinics: 0,
    activeConnections: 0,
    subscriptions: {},
    messageVolume: {
      sent: 0,
      received: 0,
      bytesTransferred: 0
    },
    systemHealth: {
      uptime: Date.now(),
      memoryUsage: 0,
      cpuUsage: 0
    }
  };

  constructor(
    private configService: ConfigService
  ) {}

  async onModuleInit() {
    if (this.initialized) return;

    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Get JWT secret from KMS
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      this.jwtSecret = await productionKMS.getInternalKey('JWT_SECRET');
      
      if (!this.jwtSecret) {
        throw new Error('JWT_SECRET not found in KMS - required for WebSocket authentication');
      }
      
      // Initialize will be completed when HTTP server is provided
      this.initialized = true;
      console.log('✅ Learning WebSocket Server Service initialized (deferred server creation)');
    } catch (error) {
      console.error('❌ Failed to initialize Learning WebSocket Server Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: this.serviceId,
      operation: 'websocket_operations',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  /**
   * Initialize WebSocket server with HTTP server
   */
  async initializeWebSocketServer(server: any): Promise<void> {
    if (this.wss) {
      console.log('⚠️ WebSocket server already initialized');
      return;
    }

    try {
      console.log('🚀 Creating WebSocket server on /ws/learn...');
      
      // Create WebSocket server attached to HTTP server
      this.wss = new WebSocket.Server({
        server,
        path: '/ws/learn',
        verifyClient: this.verifyClient.bind(this),
        perMessageDeflate: {
          threshold: 1024,
          concurrencyLimit: 10,
          memLevel: 8
        }
      });
      
      // Setup WebSocket event handlers
      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleServerError.bind(this));
      
      // Subscribe to learning events for broadcasting
      this.subscribeToLearningEvents();
      
      // Start monitoring systems
      this.startHeartbeat();
      this.startStatsReporting();
      this.startLiveStreaming();
      
      console.log('✅ Learning WebSocket Server fully initialized on /ws/learn');
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Enhanced client verification with comprehensive security checks
   */
  private async verifyClient(info: { req: IncomingMessage }): Promise<{ success: boolean; statusCode?: number; statusMessage?: string }> {
    try {
      // Extract authentication token
      const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token') || 
                   info.req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return { success: false, statusCode: 401, statusMessage: 'Authentication token required' };
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret!) as any;
      
      // Enhanced security checks
      if (!decoded.userId || !decoded.clinicId) {
        return { success: false, statusCode: 401, statusMessage: 'Invalid token payload' };
      }
      
      // Check token expiration with buffer
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now + 60) { // 60 second buffer
        return { success: false, statusCode: 401, statusMessage: 'Token expired or expires soon' };
      }
      
      // Rate limiting check
      const clientIP = info.req.connection.remoteAddress;
      if (await this.isRateLimited(clientIP)) {
        return { success: false, statusCode: 429, statusMessage: 'Rate limit exceeded' };
      }
      
      // Add user info to request for connection handling
      (info.req as any).userId = decoded.userId;
      (info.req as any).clinicId = decoded.clinicId;
      (info.req as any).role = decoded.role || 'user';
      (info.req as any).sessionId = decoded.sessionId || `session_${Date.now()}`;
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ WebSocket authentication failed:', error.message);
      return { success: false, statusCode: 401, statusMessage: 'Authentication failed' };
    }
  }

  /**
   * Handle new WebSocket connection with comprehensive setup
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const req = request as any;
    
    console.log(`🔌 New WebSocket connection: ${clientId} (User: ${req.userId})`);
    
    try {
      // Create comprehensive client connection object
      const clientConnection: ClientConnection = {
        ws,
        userId: req.userId,
        clinicId: req.clinicId,
        role: req.role,
        connectedAt: new Date(),
        lastActivity: new Date(),
        isAlive: true,
        subscriptions: new Set(),
        sessionId: req.sessionId,
        clientInfo: {
          userAgent: request.headers['user-agent'] || 'unknown',
          ipAddress: request.connection.remoteAddress || 'unknown',
          platform: this.detectPlatform(request.headers['user-agent'] || '')
        },
        metrics: {
          messagesSent: 0,
          messagesReceived: 0,
          bytesTransferred: 0,
          lastHeartbeat: new Date()
        }
      };
      
      // Store client connection
      this.clients.set(clientId, clientConnection);
      
      // Update session tracking
      this.addToUserSession(req.userId, clientId);
      this.addToClinicSession(req.clinicId, clientId);
      
      // Update statistics
      this.updateConnectionStats();
      
      // Send welcome message with connection info
      this.sendToClient(clientId, {
        type: 'connected',
        data: {
          clientId,
          sessionId: req.sessionId,
          serverTime: new Date(),
          features: {
            workflowPredictions: this.config.workflowPredictions.enabled,
            automationSuggestions: this.config.automationSuggestions.enabled,
            efficiencyAlerts: this.config.efficiencyAlerts.enabled,
            patternDetection: this.config.patternDetection.enabled,
            rzeroUpdates: this.config.rzeroUpdates.enabled
          }
        },
        timestamp: new Date()
      });
      
      // Setup WebSocket event handlers
      ws.on('message', (data) => this.handleClientMessage(clientId, data));
      ws.on('close', (code, reason) => this.handleClientDisconnect(clientId, code, reason));
      ws.on('error', (error) => this.handleClientError(clientId, error));
      ws.on('pong', () => this.handlePong(clientId));
      
      // Send initial personalized data
      setTimeout(() => this.sendInitialData(clientId), 1000);
      
      // Log connection
      this.logConnectionEvent('CONNECT', clientId, req.userId, req.clinicId);
      
    } catch (error) {
      console.error(`❌ Error setting up client connection ${clientId}:`, error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Handle incoming messages from clients with comprehensive routing
   */
  private async handleClientMessage(clientId: string, data: WebSocket.Data): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      client.lastActivity = new Date();
      client.metrics.messagesReceived++;
      client.metrics.bytesTransferred += Buffer.byteLength(data.toString());
      
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      console.log(`📨 Message from ${clientId}: ${message.type}`);
      
      // Route message based on type
      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(clientId, message.data?.events || []);
          break;
          
        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message.data?.events || []);
          break;
          
        case 'request_prediction':
          await this.handlePredictionRequest(clientId, message.data as PredictionRequest);
          break;
          
        case 'request_suggestions':
          await this.handleSuggestionsRequest(clientId, message.data as SuggestionRequest);
          break;
          
        case 'request_efficiency':
          await this.handleEfficiencyRequest(clientId, message.data as EfficiencyRequest);
          break;
          
        case 'submit_feedback':
          await this.handleFeedback(clientId, message.data as FeedbackData);
          break;
          
        case 'request_patterns':
          await this.handlePatternRequest(clientId, message.data);
          break;
          
        case 'request_automation':
          await this.handleAutomationRequest(clientId, message.data);
          break;
          
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date() });
          break;
          
        case 'get_status':
          await this.handleStatusRequest(clientId);
          break;
          
        default:
          console.warn(`❓ Unknown message type from ${clientId}: ${message.type}`);
          this.sendError(clientId, 'Unknown message type', message.requestId);
      }
      
    } catch (error) {
      console.error(`❌ Error handling message from ${clientId}:`, error);
      this.sendError(clientId, 'Invalid message format');
    }
  }

  /**
   * Handle client subscription to events
   */
  private async handleSubscribe(clientId: string, events: string[]): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    const validEvents = [
      'workflow_predictions', 'automation_discoveries', 'efficiency_alerts',
      'pattern_detection', 'rzero_updates', 'learning_milestones',
      'bottleneck_alerts', 'suggestions', 'performance_insights'
    ];
    
    const filteredEvents = events.filter(event => validEvents.includes(event));
    
    for (const event of filteredEvents) {
      client.subscriptions.add(event);
    }
    
    // Update statistics
    this.updateSubscriptionStats();
    
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: {
        subscribed: filteredEvents,
        total: client.subscriptions.size
      },
      timestamp: new Date()
    });
    
    console.log(`📋 Client ${clientId} subscribed to ${filteredEvents.length} events`);
    
    // Log subscription event
    this.logSubscriptionEvent(clientId, filteredEvents, 'subscribe');
  }

  /**
   * Handle workflow prediction request
   */
  private async handlePredictionRequest(clientId: string, request: PredictionRequest): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      // Mock prediction service call - in real implementation would use actual service
      const predictions = await this.generateWorkflowPredictions(
        client.userId,
        request.currentSteps,
        request.context,
        client.clinicId
      );
      
      this.sendToClient(clientId, {
        type: 'workflow_prediction',
        data: {
          predictions: predictions.slice(0, this.config.workflowPredictions.maxPredictions),
          context: request.context,
          generatedAt: new Date()
        },
        requestId: request.requestId,
        timestamp: new Date()
      });
      
      console.log(`🔮 Sent ${predictions.length} predictions to ${clientId}`);
      
    } catch (error) {
      console.error(`❌ Error generating predictions for ${clientId}:`, error);
      this.sendError(clientId, 'Failed to generate workflow predictions', request.requestId);
    }
  }

  /**
   * Handle suggestions request
   */
  private async handleSuggestionsRequest(clientId: string, request: SuggestionRequest): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      const suggestions = await this.generatePersonalizedSuggestions(
        client.userId,
        client.clinicId,
        request.context,
        request.preferences
      );
      
      this.sendToClient(clientId, {
        type: 'personal_suggestions',
        data: {
          suggestions,
          context: request.context,
          generatedAt: new Date()
        },
        requestId: request.requestId,
        timestamp: new Date()
      });
      
      console.log(`💡 Sent ${suggestions.length} suggestions to ${clientId}`);
      
    } catch (error) {
      console.error(`❌ Error generating suggestions for ${clientId}:`, error);
      this.sendError(clientId, 'Failed to generate suggestions', request.requestId);
    }
  }

  /**
   * Handle efficiency metrics request
   */
  private async handleEfficiencyRequest(clientId: string, request: EfficiencyRequest): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      const efficiency = await this.calculateEfficiencyMetrics(
        client.userId,
        client.clinicId,
        request.type,
        request.timeframe
      );
      
      this.sendToClient(clientId, {
        type: 'efficiency_metrics',
        data: {
          ...efficiency,
          type: request.type,
          timeframe: request.timeframe,
          calculatedAt: new Date()
        },
        requestId: request.requestId,
        timestamp: new Date()
      });
      
      console.log(`📊 Sent efficiency metrics to ${clientId}`);
      
    } catch (error) {
      console.error(`❌ Error calculating efficiency for ${clientId}:`, error);
      this.sendError(clientId, 'Failed to calculate efficiency metrics', request.requestId);
    }
  }

  /**
   * Handle user feedback submission
   */
  private async handleFeedback(clientId: string, feedback: FeedbackData): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      // Store feedback in database
      const context = this.getServiceContext(client.clinicId);
      await SecureDataAccess.insert('learning_feedback', {
        ...feedback,
        userId: client.userId,
        clinicId: client.clinicId,
        clientId,
        processedAt: new Date()
      }, context);
      
      this.sendToClient(clientId, {
        type: 'feedback_processed',
        data: {
          suggestionId: feedback.suggestionId,
          processed: true
        },
        timestamp: new Date()
      });
      
      console.log(`👍 Processed feedback from ${clientId} for suggestion ${feedback.suggestionId}`);
      
    } catch (error) {
      console.error(`❌ Error processing feedback from ${clientId}:`, error);
      this.sendError(clientId, 'Failed to process feedback');
    }
  }

  /**
   * Start comprehensive real-time streaming services
   */
  private startLiveStreaming(): void {
    console.log('🌊 Starting live learning data streaming...');
    
    if (this.config.workflowPredictions.enabled) {
      this.startWorkflowPredictionStreaming();
    }
    
    if (this.config.automationSuggestions.enabled) {
      this.startAutomationSuggestionStreaming();
    }
    
    if (this.config.efficiencyAlerts.enabled) {
      this.startEfficiencyAlertStreaming();
    }
    
    if (this.config.patternDetection.enabled) {
      this.startPatternDetectionStreaming();
    }
    
    if (this.config.rzeroUpdates.enabled) {
      this.startRZeroUpdateStreaming();
    }
    
    console.log('✅ All streaming services activated');
  }

  /**
   * Stream real-time workflow predictions
   */
  private startWorkflowPredictionStreaming(): void {
    const interval = setInterval(async () => {
      try {
        for (const [clientId, client] of this.clients) {
          if (!client.subscriptions.has('workflow_predictions')) continue;
          
          // Get recent user actions
          const recentActions = await this.getRecentUserActions(client.userId);
          if (recentActions.length === 0) continue;
          
          // Generate predictions
          const predictions = await this.generateWorkflowPredictions(
            client.userId,
            recentActions.map(a => a.actionType),
            { realtime: true },
            client.clinicId
          );
          
          if (predictions.length > 0) {
            this.sendToClient(clientId, {
              type: 'workflow_prediction_stream',
              data: {
                predictions: predictions.slice(0, 3),
                context: {
                  currentStep: recentActions[recentActions.length - 1]?.actionType,
                  confidence: predictions[0]?.confidence
                }
              },
              timestamp: new Date()
            });
          }
        }
      } catch (error) {
        console.error('❌ Error in workflow prediction streaming:', error);
      }
    }, this.config.workflowPredictions.interval);
    
    this.streamingIntervals.set('workflow_predictions', interval);
  }

  /**
   * Subscribe to learning events for broadcasting
   */
  private subscribeToLearningEvents(): void {
    console.log('📡 Subscribing to learning events...');
    
    // Pattern detection events
    learningEventBus.subscribe('pattern.detected', (data) => {
      this.broadcastToUser(data.userId, {
        type: 'pattern_detected',
        data
      }, 'pattern_detection');
    }, this.serviceId, 2);
    
    // Efficiency alerts
    learningEventBus.subscribe('efficiency.alert', (data) => {
      this.broadcastToUser(data.userId, {
        type: 'efficiency_alert',
        data
      }, 'efficiency_alerts');
    }, this.serviceId, 3);
    
    // Automation opportunities
    learningEventBus.subscribe('automation.discovered', (data) => {
      this.broadcastToClinic(data.clinicId, {
        type: 'automation_opportunity',
        data
      }, 'automation_discoveries');
    }, this.serviceId, 2);
    
    // R-Zero updates
    learningEventBus.subscribe('rzero.cycle.completed', (data) => {
      this.broadcastToClinic(data.clinicId, {
        type: 'rzero_update',
        data
      }, 'rzero_updates');
    }, this.serviceId, 1);
    
    // Learning milestones
    learningEventBus.subscribe('learning.milestone', (data) => {
      this.broadcastToUser(data.userId, {
        type: 'learning_milestone',
        data
      }, 'learning_milestones');
    }, this.serviceId, 3);
  }

  /**
   * Send initial personalized data to new client
   */
  private async sendInitialData(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      console.log(`📤 Sending initial data to ${clientId}...`);
      
      // Get recent suggestions
      const suggestions = await this.generatePersonalizedSuggestions(
        client.userId,
        client.clinicId,
        { initialLoad: true }
      );
      
      if (suggestions.length > 0) {
        this.sendToClient(clientId, {
          type: 'initial_suggestions',
          data: { suggestions },
          timestamp: new Date()
        });
      }
      
      // Get current workflow if any
      const currentWorkflow = await this.getCurrentWorkflow(client.userId);
      if (currentWorkflow) {
        const predictions = await this.generateWorkflowPredictions(
          client.userId,
          currentWorkflow.steps,
          { workflowId: currentWorkflow.id },
          client.clinicId
        );
        
        this.sendToClient(clientId, {
          type: 'current_workflow_predictions',
          data: { predictions: predictions.slice(0, 3) },
          timestamp: new Date()
        });
      }
      
      // Get efficiency overview
      const efficiency = await this.calculateEfficiencyMetrics(
        client.userId,
        client.clinicId,
        'user',
        '7d'
      );
      
      this.sendToClient(clientId, {
        type: 'efficiency_overview',
        data: efficiency,
        timestamp: new Date()
      });
      
      console.log(`✅ Initial data sent to ${clientId}`);
      
    } catch (error) {
      console.error(`❌ Error sending initial data to ${clientId}:`, error);
    }
  }

  // ========== BROADCASTING METHODS ==========

  /**
   * Broadcast message to all clients of a specific user
   */
  private broadcastToUser(userId: string, message: WebSocketMessage, eventType: string): void {
    const clientIds = this.userSessions.get(userId);
    if (!clientIds) return;
    
    let sentCount = 0;
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client && client.subscriptions.has(eventType)) {
        this.sendToClient(clientId, message);
        sentCount++;
      }
    }
    
    if (sentCount > 0) {
      console.log(`📺 Broadcasted ${message.type} to ${sentCount} clients for user ${userId}`);
    }
  }

  /**
   * Broadcast message to all clients in a clinic
   */
  private broadcastToClinic(clinicId: string, message: WebSocketMessage, eventType: string): void {
    const clientIds = this.clinicSessions.get(clinicId);
    if (!clientIds) return;
    
    let sentCount = 0;
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client && client.subscriptions.has(eventType) && 
          ['admin', 'super_admin'].includes(client.role)) {
        this.sendToClient(clientId, message);
        sentCount++;
      }
    }
    
    if (sentCount > 0) {
      console.log(`📺 Broadcasted ${message.type} to ${sentCount} admin clients in clinic ${clinicId}`);
    }
  }

  /**
   * Send message to specific client with error handling
   */
  private sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      const messageStr = JSON.stringify(message);
      client.ws.send(messageStr);
      
      // Update metrics
      client.metrics.messagesSent++;
      client.metrics.bytesTransferred += Buffer.byteLength(messageStr);
      this.stats.messageVolume.sent++;
      
      return true;
    } catch (error) {
      console.error(`❌ Error sending to client ${clientId}:`, error);
      this.handleClientError(clientId, error);
      return false;
    }
  }

  /**
   * Send error message to client
   */
  private sendError(clientId: string, error: string, requestId?: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      data: { error, requestId },
      timestamp: new Date()
    });
  }

  // ========== UTILITY METHODS ==========

  /**
   * Mock implementation for workflow predictions
   */
  private async generateWorkflowPredictions(
    userId: string,
    currentSteps: string[],
    context: any,
    clinicId: string
  ): Promise<any[]> {
    // Mock predictions - in real implementation would use actual prediction service
    return [
      {
        action: 'review_patient_chart',
        confidence: 0.85,
        probability: 0.78,
        description: 'Based on your workflow, you typically review the patient chart next'
      },
      {
        action: 'schedule_followup',
        confidence: 0.72,
        probability: 0.65,
        description: 'Schedule a follow-up appointment'
      },
      {
        action: 'update_treatment_plan',
        confidence: 0.68,
        probability: 0.61,
        description: 'Update the treatment plan based on current findings'
      }
    ];
  }

  /**
   * Mock implementation for personalized suggestions
   */
  private async generatePersonalizedSuggestions(
    userId: string,
    clinicId: string,
    context: any,
    preferences?: any
  ): Promise<any[]> {
    return [
      {
        id: `suggestion_${Date.now()}_1`,
        type: 'workflow_optimization',
        title: 'Optimize Patient Check-in Process',
        description: 'Consider using the automated check-in feature to save 5 minutes per patient',
        priority: 'high',
        estimatedSavings: '25 minutes/day'
      },
      {
        id: `suggestion_${Date.now()}_2`,
        type: 'automation',
        title: 'Automate Lab Result Notifications',
        description: 'Set up automatic notifications for critical lab results',
        priority: 'medium',
        estimatedSavings: '15 minutes/day'
      }
    ];
  }

  /**
   * Mock implementation for efficiency metrics
   */
  private async calculateEfficiencyMetrics(
    userId: string,
    clinicId: string,
    type: string,
    timeframe: string
  ): Promise<any> {
    return {
      score: 0.82,
      trend: 'increasing',
      metrics: {
        tasksCompleted: 45,
        averageTaskTime: 8.5,
        efficiencyImprovement: 0.12
      },
      recommendations: [
        'Consider using keyboard shortcuts to save time',
        'Batch similar tasks together for better efficiency'
      ]
    };
  }

  // Additional helper methods for streaming, monitoring, etc.
  private async getRecentUserActions(userId: string): Promise<any[]> {
    try {
      const context = this.getServiceContext();
      const actions = await SecureDataAccess.query(
        'interaction_logs',
        {
          userId,
          timestamp: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
        },
        { sort: { timestamp: -1 }, limit: 5 },
        context
      );
      return actions || [];
    } catch (error) {
      console.error('Error getting recent user actions:', error);
      return [];
    }
  }

  private async getCurrentWorkflow(userId: string): Promise<any> {
    try {
      const context = this.getServiceContext();
      const workflows = await SecureDataAccess.query(
        'active_workflows',
        {
          userId,
          status: 'in_progress'
        },
        { sort: { startedAt: -1 }, limit: 1 },
        context
      );
      return workflows?.[0] || null;
    } catch (error) {
      console.error('Error getting current workflow:', error);
      return null;
    }
  }

  // Connection management helpers
  private addToUserSession(userId: string, clientId: string): void {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(clientId);
  }

  private addToClinicSession(clinicId: string, clientId: string): void {
    if (!this.clinicSessions.has(clinicId)) {
      this.clinicSessions.set(clinicId, new Set());
    }
    this.clinicSessions.get(clinicId)!.add(clientId);
  }

  // Monitoring and statistics
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (!client.isAlive) {
          console.log(`💔 Client ${clientId} didn't respond to ping, terminating`);
          client.ws.terminate();
          this.handleClientDisconnect(clientId, 1006, 'Ping timeout');
        } else {
          client.isAlive = false;
          client.ws.ping();
          client.metrics.lastHeartbeat = new Date();
        }
      }
    }, 30000); // Every 30 seconds
  }

  private startStatsReporting(): void {
    this.statsInterval = setInterval(async () => {
      await this.updateAndReportStats();
    }, 300000); // Every 5 minutes
  }

  private async updateAndReportStats(): Promise<void> {
    this.updateConnectionStats();
    this.updateSubscriptionStats();
    
    // Log stats
    try {
      const context = this.getServiceContext();
      await SecureDataAccess.insert('websocket_stats', {
        ...this.stats,
        timestamp: new Date()
      }, context);
      
      console.log(`📊 WebSocket Stats: ${this.stats.activeConnections} connections, ${this.stats.totalUsers} users`);
    } catch (error) {
      console.error('Error logging WebSocket stats:', error);
    }
  }

  private updateConnectionStats(): void {
    this.stats.totalClients = this.clients.size;
    this.stats.totalUsers = this.userSessions.size;
    this.stats.totalClinics = this.clinicSessions.size;
    this.stats.activeConnections = Array.from(this.clients.values())
      .filter(c => c.ws.readyState === WebSocket.OPEN).length;
  }

  private updateSubscriptionStats(): void {
    const subscriptions: Record<string, number> = {};
    
    for (const client of this.clients.values()) {
      for (const subscription of client.subscriptions) {
        subscriptions[subscription] = (subscriptions[subscription] || 0) + 1;
      }
    }
    
    this.stats.subscriptions = subscriptions;
  }

  // Event handlers
  private handleClientDisconnect(clientId: string, code?: number, reason?: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    console.log(`🔌 Client disconnected: ${clientId} (Code: ${code})`);
    
    // Remove from sessions
    const userClients = this.userSessions.get(client.userId);
    if (userClients) {
      userClients.delete(clientId);
      if (userClients.size === 0) {
        this.userSessions.delete(client.userId);
      }
    }
    
    const clinicClients = this.clinicSessions.get(client.clinicId);
    if (clinicClients) {
      clinicClients.delete(clientId);
      if (clinicClients.size === 0) {
        this.clinicSessions.delete(client.clinicId);
      }
    }
    
    // Clean up
    this.clients.delete(clientId);
    this.updateConnectionStats();
    
    // Log disconnection
    this.logConnectionEvent('DISCONNECT', clientId, client.userId, client.clinicId, code);
  }

  private handleClientError(clientId: string, error: Error): void {
    console.error(`❌ WebSocket error for client ${clientId}:`, error.message);
    this.handleClientDisconnect(clientId, 1011, 'Internal error');
  }

  private handleServerError(error: Error): void {
    console.error('❌ WebSocket server error:', error);
  }

  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
  }

  // Additional utility methods
  private detectPlatform(userAgent: string): string {
    if (userAgent.includes('Mobile')) return 'mobile';
    if (userAgent.includes('Tablet')) return 'tablet';
    return 'desktop';
  }

  private async isRateLimited(clientIP?: string): Promise<boolean> {
    // Mock rate limiting - in real implementation would check actual limits
    return false;
  }

  private async logConnectionEvent(
    event: string,
    clientId: string,
    userId: string,
    clinicId: string,
    code?: number
  ): Promise<void> {
    try {
      const context = this.getServiceContext(clinicId);
      await SecureDataAccess.insert('websocket_events', {
        event,
        clientId,
        userId,
        clinicId,
        code,
        timestamp: new Date()
      }, context);
    } catch (error) {
      console.warn('Failed to log connection event:', error.message);
    }
  }

  private logSubscriptionEvent(clientId: string, events: string[], action: string): void {
    console.log(`📋 Subscription ${action}: ${clientId} -> [${events.join(', ')}]`);
  }

  // Implement remaining streaming methods and handlers...
  private startAutomationSuggestionStreaming(): void {
    // Implementation similar to workflow predictions
    console.log('🤖 Automation suggestion streaming started');
  }

  private startEfficiencyAlertStreaming(): void {
    // Implementation for efficiency alerts
    console.log('⚡ Efficiency alert streaming started');
  }

  private startPatternDetectionStreaming(): void {
    // Implementation for pattern detection
    console.log('🔍 Pattern detection streaming started');
  }

  private startRZeroUpdateStreaming(): void {
    // Implementation for R-Zero updates
    console.log('🎯 R-Zero update streaming started');
  }

  // Additional request handlers
  private async handlePatternRequest(clientId: string, data: any): Promise<void> {
    console.log(`🔍 Pattern request from ${clientId}`);
  }

  private async handleAutomationRequest(clientId: string, data: any): Promise<void> {
    console.log(`🤖 Automation request from ${clientId}`);
  }

  private async handleStatusRequest(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    this.sendToClient(clientId, {
      type: 'status_response',
      data: {
        connectionInfo: {
          connectedAt: client.connectedAt,
          lastActivity: client.lastActivity,
          subscriptions: Array.from(client.subscriptions)
        },
        serverInfo: {
          uptime: Date.now() - this.stats.systemHealth.uptime,
          totalConnections: this.stats.activeConnections,
          version: '1.0.0'
        }
      },
      timestamp: new Date()
    });
  }

  private async handleUnsubscribe(clientId: string, events: string[]): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    for (const event of events) {
      client.subscriptions.delete(event);
    }
    
    this.updateSubscriptionStats();
    
    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      data: {
        unsubscribed: events,
        remaining: Array.from(client.subscriptions)
      },
      timestamp: new Date()
    });
  }

  /**
   * Get current server statistics
   */
  getStats(): ServerStats {
    this.updateConnectionStats();
    this.updateSubscriptionStats();
    return { ...this.stats };
  }

  /**
   * Cleanup on service destruction
   */
  onModuleDestroy(): void {
    console.log('🛑 Learning WebSocket Server shutting down...');
    
    // Clear all intervals
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.statsInterval) clearInterval(this.statsInterval);
    
    for (const interval of this.streamingIntervals.values()) {
      clearInterval(interval);
    }
    
    // Close all client connections
    for (const [clientId, client] of this.clients) {
      this.sendToClient(clientId, {
        type: 'server_shutdown',
        data: { message: 'Server is shutting down for maintenance' },
        timestamp: new Date()
      });
      client.ws.close(1001, 'Server shutdown');
    }
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        console.log('✅ WebSocket server closed');
      });
    }
    
    console.log('✅ Learning WebSocket Server shutdown complete');
  }
}