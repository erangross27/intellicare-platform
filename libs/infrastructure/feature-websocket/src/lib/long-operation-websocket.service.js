// Long Operation WebSocket Service for IntelliCare
// Provides real-time updates for long-running operations like AI processing, document analysis, etc.

const EventEmitter = require('events');
const crypto = require('crypto');

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class LongOperationWebSocketService extends EventEmitter {
  constructor(io) {
    super();
    
    this.io = io;
    this.serviceToken = null;
    this.initialized = false;
    this.operations = new Map();
    this.clientOperations = new Map(); // Map client socket to operations
    this.operationTypes = new Map();
    this.metrics = {
      totalOperations: 0,
      activeOperations: 0,
      completedOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      clientConnections: 0
    };
  }

  async initialize() {
    if (this.initialized) {
      return this;
    }

    try {
      // Authenticate service
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('long-operation-ws');
      this.initialized = true;
      console.log('✅ LongOperationWebSocketService initialized with ServiceProxy');
    } catch (error) {
      console.error('Failed to initialize Long Operation WebSocket Service:', error);
      throw error;
    }

    return this;
  }
  
  setupWebSocketHandlers() {
    if (!this.io) {
      console.warn('⚠️ Socket.IO instance not provided, WebSocket support disabled');
      return;
    }
    
    // Main namespace for long operations
    this.longOpNamespace = this.io.of('/long-operations');
    
    this.longOpNamespace.on('connection', (socket) => {
      this.metrics.clientConnections++;
      
      console.log(`🔌 Client connected to long operations: ${socket.id}`);
      
      // Initialize client operation tracking
      this.clientOperations.set(socket.id, new Set());
      
      // Handle operation subscription
      socket.on('subscribe_operation', (data) => {
        this.handleOperationSubscription(socket, data);
      });
      
      // Handle operation unsubscribe
      socket.on('unsubscribe_operation', (data) => {
        this.handleOperationUnsubscribe(socket, data);
      });
      
      // Handle operation cancellation
      socket.on('cancel_operation', (data) => {
        this.handleOperationCancellation(socket, data);
      });
      
      // Handle get operation status
      socket.on('get_operation_status', (data) => {
        this.handleGetOperationStatus(socket, data);
      });
      
      // Handle get all operations for user
      socket.on('get_user_operations', (data) => {
        this.handleGetUserOperations(socket, data);
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleClientDisconnect(socket);
      });
      
      // Send initial connection confirmation
      socket.emit('connected', {
        message: 'Connected to long operations service',
        supportedOperations: Array.from(this.operationTypes.keys()),
        timestamp: new Date()
      });
    });
    
    // Register default operation types
    this.registerOperationType('ai_diagnosis', {
      name: 'AI Diagnosis',
      description: 'AI-powered medical diagnosis processing',
      estimatedDuration: 15000, // 15 seconds
      allowCancellation: true
    });
    
    this.registerOperationType('document_analysis', {
      name: 'Document Analysis',
      description: 'OCR and AI analysis of medical documents',
      estimatedDuration: 30000, // 30 seconds
      allowCancellation: true
    });
    
    this.registerOperationType('bulk_patient_import', {
      name: 'Bulk Patient Import',
      description: 'Import multiple patient records',
      estimatedDuration: 60000, // 1 minute
      allowCancellation: false
    });
    
    this.registerOperationType('data_export', {
      name: 'Data Export',
      description: 'Export patient data and reports',
      estimatedDuration: 45000, // 45 seconds
      allowCancellation: true
    });
    
    this.registerOperationType('ai_chat_processing', {
      name: 'AI Chat Processing',
      description: 'Processing complex AI chat interactions',
      estimatedDuration: 10000, // 10 seconds
      allowCancellation: false
    });
  }
  
  // Register a new operation type
  registerOperationType(type, config) {
    this.operationTypes.set(type, {
      name: config.name || type,
      description: config.description || '',
      estimatedDuration: config.estimatedDuration || 30000,
      allowCancellation: config.allowCancellation !== false,
      maxConcurrent: config.maxConcurrent || 10,
      timeout: config.timeout || 300000, // 5 minutes default timeout
      retryable: config.retryable !== false
    });
    
    console.log(`📝 Registered operation type: ${type}`);
  }
  
  // Start a new long operation
  async startOperation(type, data = {}, options = {}) {
    const operationId = crypto.randomBytes(16).toString('hex');
    const operationConfig = this.operationTypes.get(type);
    
    if (!operationConfig) {
      throw new Error(`Unknown operation type: ${type}`);
    }
    
    const operation = {
      id: operationId,
      type: type,
      status: 'starting',
      progress: 0,
      data: data,
      result: null,
      error: null,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      estimatedDuration: operationConfig.estimatedDuration,
      allowCancellation: operationConfig.allowCancellation,
      cancelled: false,
      retryable: operationConfig.retryable,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      clientId: options.clientId,
      userId: options.userId,
      practiceId: options.practiceId,
      metadata: options.metadata || {},
      steps: [],
      currentStep: null,
      logs: [],
      timeout: operationConfig.timeout
    };
    
    // Store operation
    this.operations.set(operationId, operation);
    this.metrics.totalOperations++;
    this.metrics.activeOperations++;
    
    // Set operation timeout
    setTimeout(() => {
      if (this.operations.has(operationId)) {
        const op = this.operations.get(operationId);
        if (['starting', 'running'].includes(op.status)) {
          this.timeoutOperation(operationId, 'Operation timed out');
        }
      }
    }, operation.timeout);
    
    // Emit to subscribed clients
    this.emitToSubscribers(operationId, 'operation_started', {
      operationId: operationId,
      type: type,
      estimatedDuration: operation.estimatedDuration,
      allowCancellation: operation.allowCancellation,
      timestamp: new Date()
    });
    
    console.log(`🚀 Started operation ${operationId} (${type})`);
    
    this.emit('operation_started', operation);
    
    return operationId;
  }
  
  // Update operation progress
  updateOperationProgress(operationId, progress, message = null, data = {}) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`⚠️ Operation ${operationId} not found for progress update`);
      return false;
    }
    
    if (operation.cancelled) {
      return false;
    }
    
    // Update operation
    operation.progress = Math.min(100, Math.max(0, progress));
    operation.status = operation.progress === 100 ? 'completing' : 'running';
    
    if (message) {
      operation.logs.push({
        timestamp: Date.now(),
        level: 'info',
        message: message
      });
    }
    
    // Add any additional data
    Object.assign(operation.metadata, data);
    
    // Emit progress update
    this.emitToSubscribers(operationId, 'operation_progress', {
      operationId: operationId,
      progress: operation.progress,
      status: operation.status,
      message: message,
      data: data,
      timestamp: new Date()
    });
    
    this.emit('operation_progress', operation);
    
    return true;
  }
  
  // Add a step to an operation
  addOperationStep(operationId, stepName, description = '') {
    const operation = this.operations.get(operationId);
    if (!operation || operation.cancelled) {
      return false;
    }
    
    const step = {
      name: stepName,
      description: description,
      startTime: Date.now(),
      endTime: null,
      status: 'running'
    };
    
    // Complete previous step if exists
    if (operation.currentStep) {
      const prevStep = operation.steps[operation.steps.length - 1];
      if (prevStep && prevStep.status === 'running') {
        prevStep.endTime = Date.now();
        prevStep.status = 'completed';
      }
    }
    
    operation.steps.push(step);
    operation.currentStep = stepName;
    
    operation.logs.push({
      timestamp: Date.now(),
      level: 'info',
      message: `Started step: ${stepName}`
    });
    
    // Emit step update
    this.emitToSubscribers(operationId, 'operation_step', {
      operationId: operationId,
      step: stepName,
      description: description,
      timestamp: new Date()
    });
    
    return true;
  }
  
  // Complete operation step
  completeOperationStep(operationId, success = true, message = '') {
    const operation = this.operations.get(operationId);
    if (!operation || operation.cancelled) {
      return false;
    }
    
    if (operation.steps.length > 0) {
      const currentStep = operation.steps[operation.steps.length - 1];
      if (currentStep.status === 'running') {
        currentStep.endTime = Date.now();
        currentStep.status = success ? 'completed' : 'failed';
        
        if (message) {
          operation.logs.push({
            timestamp: Date.now(),
            level: success ? 'info' : 'error',
            message: message
          });
        }
      }
    }
    
    return true;
  }
  
  // Complete operation successfully
  completeOperation(operationId, result = null, message = 'Operation completed successfully') {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`⚠️ Operation ${operationId} not found for completion`);
      return false;
    }
    
    if (operation.cancelled) {
      return false;
    }
    
    // Update operation
    operation.status = 'completed';
    operation.progress = 100;
    operation.result = result;
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    
    // Complete current step
    this.completeOperationStep(operationId, true, message);
    
    operation.logs.push({
      timestamp: Date.now(),
      level: 'success',
      message: message
    });
    
    // Update metrics
    this.metrics.activeOperations--;
    this.metrics.completedOperations++;
    this.updateAverageDuration();
    
    // Emit completion
    this.emitToSubscribers(operationId, 'operation_completed', {
      operationId: operationId,
      result: result,
      duration: operation.duration,
      message: message,
      timestamp: new Date()
    });
    
    console.log(`✅ Completed operation ${operationId} in ${operation.duration}ms`);
    
    this.emit('operation_completed', operation);
    
    // Schedule cleanup
    setTimeout(() => {
      this.cleanupOperation(operationId);
    }, 300000); // Clean up after 5 minutes
    
    return true;
  }
  
  // Fail operation
  failOperation(operationId, error, message = 'Operation failed') {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`⚠️ Operation ${operationId} not found for failure`);
      return false;
    }
    
    if (operation.cancelled) {
      return false;
    }
    
    // Update operation
    operation.status = 'failed';
    operation.error = error;
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    
    // Complete current step as failed
    this.completeOperationStep(operationId, false, message);
    
    operation.logs.push({
      timestamp: Date.now(),
      level: 'error',
      message: message,
      error: error
    });
    
    // Update metrics
    this.metrics.activeOperations--;
    this.metrics.failedOperations++;
    
    // Emit failure
    this.emitToSubscribers(operationId, 'operation_failed', {
      operationId: operationId,
      error: error,
      message: message,
      duration: operation.duration,
      retryable: operation.retryable && operation.retryCount < operation.maxRetries,
      timestamp: new Date()
    });
    
    console.error(`❌ Failed operation ${operationId}: ${error}`);
    
    this.emit('operation_failed', operation);
    
    // Schedule cleanup
    setTimeout(() => {
      this.cleanupOperation(operationId);
    }, 600000); // Clean up failed operations after 10 minutes
    
    return true;
  }
  
  // Cancel operation
  cancelOperation(operationId, reason = 'Operation cancelled by user') {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`⚠️ Operation ${operationId} not found for cancellation`);
      return false;
    }
    
    if (!operation.allowCancellation) {
      console.warn(`⚠️ Operation ${operationId} does not allow cancellation`);
      return false;
    }
    
    if (['completed', 'failed', 'cancelled'].includes(operation.status)) {
      return false;
    }
    
    // Update operation
    operation.status = 'cancelled';
    operation.cancelled = true;
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.error = reason;
    
    operation.logs.push({
      timestamp: Date.now(),
      level: 'warning',
      message: reason
    });
    
    // Update metrics
    this.metrics.activeOperations--;
    
    // Emit cancellation
    this.emitToSubscribers(operationId, 'operation_cancelled', {
      operationId: operationId,
      reason: reason,
      duration: operation.duration,
      timestamp: new Date()
    });
    
    console.log(`🔄 Cancelled operation ${operationId}: ${reason}`);
    
    this.emit('operation_cancelled', operation);
    
    // Immediate cleanup for cancelled operations
    setTimeout(() => {
      this.cleanupOperation(operationId);
    }, 60000); // Clean up after 1 minute
    
    return true;
  }
  
  // Timeout operation
  timeoutOperation(operationId, reason = 'Operation timed out') {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return false;
    }
    
    console.warn(`⏰ Operation ${operationId} timed out`);
    return this.failOperation(operationId, reason, reason);
  }
  
  // Retry failed operation
  async retryOperation(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status !== 'failed' || !operation.retryable) {
      return false;
    }
    
    if (operation.retryCount >= operation.maxRetries) {
      console.warn(`⚠️ Operation ${operationId} exceeded max retries`);
      return false;
    }
    
    operation.retryCount++;
    operation.status = 'retrying';
    operation.error = null;
    operation.progress = 0;
    operation.steps = [];
    operation.currentStep = null;
    
    operation.logs.push({
      timestamp: Date.now(),
      level: 'info',
      message: `Retrying operation (attempt ${operation.retryCount + 1}/${operation.maxRetries + 1})`
    });
    
    this.metrics.activeOperations++;
    
    // Emit retry
    this.emitToSubscribers(operationId, 'operation_retry', {
      operationId: operationId,
      retryCount: operation.retryCount,
      maxRetries: operation.maxRetries,
      timestamp: new Date()
    });
    
    this.emit('operation_retry', operation);
    
    return true;
  }
  
  // Get operation status
  getOperationStatus(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return null;
    }
    
    return {
      id: operation.id,
      type: operation.type,
      status: operation.status,
      progress: operation.progress,
      result: operation.result,
      error: operation.error,
      startTime: operation.startTime,
      endTime: operation.endTime,
      duration: operation.duration,
      estimatedDuration: operation.estimatedDuration,
      allowCancellation: operation.allowCancellation,
      cancelled: operation.cancelled,
      retryCount: operation.retryCount,
      maxRetries: operation.maxRetries,
      steps: operation.steps,
      currentStep: operation.currentStep,
      logs: operation.logs.slice(-10), // Last 10 logs
      metadata: operation.metadata
    };
  }
  
  // Get operations for user
  getUserOperations(userId, practiceId = null, status = null) {
    const userOps = Array.from(this.operations.values()).filter(op => {
      if (op.userId !== userId) return false;
      if (practiceId && op.practiceId !== practiceId) return false;
      if (status && op.status !== status) return false;
      return true;
    });
    
    return userOps.map(op => this.getOperationStatus(op.id));
  }
  
  // WebSocket event handlers
  handleOperationSubscription(socket, data) {
    const { operationId } = data;
    if (!operationId) {
      socket.emit('error', { message: 'Operation ID required' });
      return;
    }
    
    // Add to client's operation set
    const clientOps = this.clientOperations.get(socket.id) || new Set();
    clientOps.add(operationId);
    this.clientOperations.set(socket.id, clientOps);
    
    // Join operation room
    socket.join(`operation_${operationId}`);
    
    // Send current operation status
    const status = this.getOperationStatus(operationId);
    if (status) {
      socket.emit('operation_status', status);
    } else {
      socket.emit('error', { message: 'Operation not found' });
    }
    
    console.log(`🔌 Client ${socket.id} subscribed to operation ${operationId}`);
  }
  
  handleOperationUnsubscribe(socket, data) {
    const { operationId } = data;
    if (!operationId) return;
    
    // Remove from client's operation set
    const clientOps = this.clientOperations.get(socket.id);
    if (clientOps) {
      clientOps.delete(operationId);
    }
    
    // Leave operation room
    socket.leave(`operation_${operationId}`);
    
    console.log(`🔌 Client ${socket.id} unsubscribed from operation ${operationId}`);
  }
  
  handleOperationCancellation(socket, data) {
    const { operationId } = data;
    if (!operationId) {
      socket.emit('error', { message: 'Operation ID required' });
      return;
    }
    
    const success = this.cancelOperation(operationId, 'Cancelled by user');
    socket.emit('operation_cancel_result', {
      operationId: operationId,
      success: success
    });
  }
  
  handleGetOperationStatus(socket, data) {
    const { operationId } = data;
    if (!operationId) {
      socket.emit('error', { message: 'Operation ID required' });
      return;
    }
    
    const status = this.getOperationStatus(operationId);
    if (status) {
      socket.emit('operation_status', status);
    } else {
      socket.emit('error', { message: 'Operation not found' });
    }
  }
  
  handleGetUserOperations(socket, data) {
    const { userId, practiceId, status } = data;
    if (!userId) {
      socket.emit('error', { message: 'User ID required' });
      return;
    }
    
    const operations = this.getUserOperations(userId, practiceId, status);
    socket.emit('user_operations', {
      operations: operations,
      count: operations.length
    });
  }
  
  handleClientDisconnect(socket) {
    // Clean up client operation tracking
    this.clientOperations.delete(socket.id);
    this.metrics.clientConnections--;
    
    console.log(`🔌 Client disconnected: ${socket.id}`);
  }
  
  // Emit to subscribers
  emitToSubscribers(operationId, event, data) {
    if (this.longOpNamespace) {
      this.longOpNamespace.to(`operation_${operationId}`).emit(event, data);
    }
  }
  
  // Cleanup completed operations
  cleanupOperation(operationId) {
    const operation = this.operations.get(operationId);
    if (operation && ['completed', 'failed', 'cancelled'].includes(operation.status)) {
      this.operations.delete(operationId);
      console.log(`🧹 Cleaned up operation ${operationId}`);
    }
  }
  
  // Start cleanup process
  startCleanupProcess() {
    // Clean up old operations every 10 minutes
    setInterval(() => {
      const now = Date.now();
      const maxAge = 1800000; // 30 minutes
      
      let cleanedCount = 0;
      
      for (const [operationId, operation] of this.operations.entries()) {
        if (['completed', 'failed', 'cancelled'].includes(operation.status)) {
          const age = now - (operation.endTime || operation.startTime);
          if (age > maxAge) {
            this.operations.delete(operationId);
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old operations`);
      }
      
    }, 600000); // Every 10 minutes
  }
  
  // Update average duration metric
  updateAverageDuration() {
    const completedOps = Array.from(this.operations.values())
      .filter(op => op.status === 'completed' && op.duration);
    
    if (completedOps.length > 0) {
      const totalDuration = completedOps.reduce((sum, op) => sum + op.duration, 0);
      this.metrics.averageDuration = Math.round(totalDuration / completedOps.length);
    }
  }
  
  // Get service metrics
  getMetrics() {
    return {
      ...this.metrics,
      activeOperationsCount: this.operations.size,
      registeredOperationTypes: this.operationTypes.size,
      timestamp: new Date()
    };
  }
  
  // Operation wrapper for easy integration
  async executeWithWebSocket(type, operationFunction, options = {}) {
    const operationId = await this.startOperation(type, options.data, options);
    
    try {
      // Execute the operation with progress callbacks
      const progressCallback = (progress, message, data) => {
        this.updateOperationProgress(operationId, progress, message, data);
      };
      
      const stepCallback = (stepName, description) => {
        this.addOperationStep(operationId, stepName, description);
      };
      
      const completeStepCallback = (success, message) => {
        this.completeOperationStep(operationId, success, message);
      };
      
      // Execute operation with callbacks
      const result = await operationFunction(progressCallback, stepCallback, () => {
          const op = this.operations.get(operationId);
          return op ? op.cancelled : true;
        }
      );
      
      this.completeOperation(operationId, result);
      return { operationId, result };
      
    } catch (error) {
      this.failOperation(operationId, error.message);
      throw error;
    }
  }
  
  // Shutdown service
  async shutdown() {
    console.log('🛑 Shutting down Long Operation WebSocket Service...');
    
    // Cancel all active operations
    for (const [operationId, operation] of this.operations.entries()) {
      if (['starting', 'running', 'retrying'].includes(operation.status)) {
        this.cancelOperation(operationId, 'Service shutting down');
      }
    }
    
    // Clear operations
    this.operations.clear();
    this.clientOperations.clear();
    
    console.log('✅ Long Operation WebSocket Service shutdown complete');
  }
}

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('longOperationWebSocketService', () => LongOperationWebSocketService);
}

module.exports = {
  LongOperationWebSocketService
};