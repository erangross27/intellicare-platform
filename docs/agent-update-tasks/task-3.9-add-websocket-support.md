# Task 3.9: Add WebSocket Support

## 📋 **Task Overview**
**Phase:** 3 (Utilities, Monitoring & Resilience)  
**Time Estimate:** 25 minutes  
**Risk Level:** LOW  
**Priority:** LOW  

Add WebSocket support for real-time updates during long-running operations like document analysis and AI processing.

## 🎯 **Objective**
Implement WebSocket support that:
- Provides real-time status updates for long operations
- Streams AI responses as they're generated
- Enables live progress tracking for file uploads
- Improves user experience with immediate feedback

## 🚨 **User Experience Risk**
**LOW:** Without real-time updates, users may think the system is unresponsive during long operations.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add WebSocket endpoints and real-time streaming**

## 🔍 **Current Real-Time Limitations**

### **Issue 1: No Real-Time Updates**
```javascript
// CURRENT - NO REAL-TIME FEEDBACK
router.post('/analyze-document', async (req, res) => {
  // Long operation with no progress updates
  const result = await agent.analyzeDocument(...);
  res.json(result); // Only final result
});
```

### **Issue 2: No Streaming Responses**
```javascript
// CURRENT - NO STREAMING
router.post('/chat', async (req, res) => {
  const result = await agent.processChatMessage(...);
  res.json(result); // Complete response only
});
```

### **Issue 3: No Upload Progress**
```javascript
// CURRENT - NO UPLOAD PROGRESS
router.post('/upload-document', async (req, res) => {
  // No progress updates during file processing
});
```

## ✅ **WebSocket Support System**

### **1. WebSocket Server Setup**
```javascript
// ADD at top of file after imports:
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.connections = new Map();
    this.sessionConnections = new Map();
    
    console.log('🔌 WebSocket manager initialized');
  }
  
  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server: server,
      path: '/ws'
    });
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
    
    console.log('🔌 WebSocket server started on /ws');
  }
  
  handleConnection(ws, req) {
    const connectionId = uuidv4();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    const practiceSubdomain = url.searchParams.get('practice');
    const authToken = url.searchParams.get('token');
    
    console.log(`🔌 New WebSocket connection: ${connectionId}`);
    
    // Store connection info
    const connectionInfo = {
      id: connectionId,
      ws: ws,
      sessionId: sessionId,
      practiceSubdomain: practiceSubdomain,
      authToken: authToken,
      connectedAt: new Date(),
      lastActivity: new Date()
    };
    
    this.connections.set(connectionId, connectionInfo);
    
    // Index by session for easy lookup
    if (sessionId) {
      if (!this.sessionConnections.has(sessionId)) {
        this.sessionConnections.set(sessionId, new Set());
      }
      this.sessionConnections.get(sessionId).add(connectionId);
    }
    
    // Handle messages
    ws.on('message', (message) => {
      this.handleMessage(connectionId, message);
    });
    
    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });
    
    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'connected',
      connectionId: connectionId,
      timestamp: new Date()
    });
  }
  
  handleMessage(connectionId, message) {
    try {
      const data = JSON.parse(message);
      const connection = this.connections.get(connectionId);
      
      if (!connection) return;
      
      connection.lastActivity = new Date();
      
      console.log(`📨 WebSocket message from ${connectionId}:`, data.type);
      
      switch (data.type) {
        case 'ping':
          this.sendToConnection(connectionId, { type: 'pong' });
          break;
          
        case 'subscribe':
          this.handleSubscription(connectionId, data);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(connectionId, data);
          break;
          
        default:
          console.log(`❓ Unknown WebSocket message type: ${data.type}`);
      }
      
    } catch (error) {
      console.error(`❌ WebSocket message error for ${connectionId}:`, error);
    }
  }
  
  handleSubscription(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    if (!connection.subscriptions) {
      connection.subscriptions = new Set();
    }
    
    connection.subscriptions.add(data.channel);
    
    this.sendToConnection(connectionId, {
      type: 'subscribed',
      channel: data.channel,
      timestamp: new Date()
    });
    
    console.log(`📡 Connection ${connectionId} subscribed to ${data.channel}`);
  }
  
  handleUnsubscription(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.subscriptions) return;
    
    connection.subscriptions.delete(data.channel);
    
    this.sendToConnection(connectionId, {
      type: 'unsubscribed',
      channel: data.channel,
      timestamp: new Date()
    });
    
    console.log(`📡 Connection ${connectionId} unsubscribed from ${data.channel}`);
  }
  
  handleDisconnection(connectionId) {
    const connection = this.connections.get(connectionId);
    
    if (connection) {
      // Remove from session index
      if (connection.sessionId) {
        const sessionConnections = this.sessionConnections.get(connection.sessionId);
        if (sessionConnections) {
          sessionConnections.delete(connectionId);
          if (sessionConnections.size === 0) {
            this.sessionConnections.delete(connection.sessionId);
          }
        }
      }
      
      this.connections.delete(connectionId);
      console.log(`🔌 WebSocket disconnected: ${connectionId}`);
    }
  }
  
  sendToConnection(connectionId, data) {
    const connection = this.connections.get(connectionId);
    
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error(`❌ Failed to send to connection ${connectionId}:`, error);
        return false;
      }
    }
    
    return false;
  }
  
  sendToSession(sessionId, data) {
    const sessionConnections = this.sessionConnections.get(sessionId);
    
    if (!sessionConnections) return 0;
    
    let sentCount = 0;
    
    for (const connectionId of sessionConnections) {
      if (this.sendToConnection(connectionId, data)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  broadcastToChannel(channel, data, clinicFilter = null) {
    let sentCount = 0;
    
    for (const [connectionId, connection] of this.connections) {
      // Filter by practice if specified
      if (clinicFilter && connection.practiceSubdomain !== clinicFilter) {
        continue;
      }
      
      // Check if connection is subscribed to channel
      if (connection.subscriptions && connection.subscriptions.has(channel)) {
        if (this.sendToConnection(connectionId, {
          ...data,
          channel: channel
        })) {
          sentCount++;
        }
      }
    }
    
    return sentCount;
  }
  
  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      activeSessions: this.sessionConnections.size,
      connectionsByClinic: this.getConnectionsByClinic()
    };
  }
  
  getConnectionsByClinic() {
    const clinicCounts = {};
    
    for (const connection of this.connections.values()) {
      const practice = connection.practiceSubdomain || 'unknown';
      clinicCounts[practice] = (clinicCounts[practice] || 0) + 1;
    }
    
    return clinicCounts;
  }
}

// Create global WebSocket manager
const wsManager = new WebSocketManager();
global.wsManager = wsManager;
```

### **2. Streaming Chat Responses**
```javascript
// UPDATE: Chat route with streaming support
router.post('/chat',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    const logger = createLogger(req);
    
    try {
      const { message, sessionId = 'default', language = 'he', stream = false } = req.body;
      const clinicSessionId = createClinicSessionId(req.practiceSubdomain, sessionId);
      
      logger.info('Processing chat message', {
        messageLength: message.length,
        sessionId: sessionId,
        language: language,
        streaming: stream
      });
      
      if (stream) {
        // ✅ STREAMING: Real-time chat response
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        
        // Send initial status
        res.write(`data: ${JSON.stringify({
          type: 'status',
          message: 'Processing your message...',
          timestamp: new Date()
        })}\n\n`);
        
        const enhancedContext = {
          ...req.practiceContext,
          requestId: req.requestId,
          logger: logger,
          streamCallback: (chunk) => {
            // Stream AI response chunks
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: chunk,
              timestamp: new Date()
            })}\n\n`);
            
            // Also send via WebSocket
            wsManager.sendToSession(sessionId, {
              type: 'chat_chunk',
              content: chunk,
              sessionId: sessionId,
              timestamp: new Date()
            });
          }
        };
        
        const result = await aiCircuitBreakers.chat.execute(
          async () => {
            return await agent.processChatMessage(
              message, 
              clinicSessionId, 
              language, 
              enhancedContext
            );
          },
          aiFallbacks.chat
        );
        
        // Send final result
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          result: result,
          timestamp: new Date()
        })}\n\n`);
        
        res.end();
        
      } else {
        // ✅ REGULAR: Non-streaming response
        const result = await aiCircuitBreakers.chat.execute(
          async () => {
            return await agent.processChatMessage(
              message, 
              clinicSessionId, 
              language, 
              req.practiceContext
            );
          },
          aiFallbacks.chat
        );
        
        result.requestId = req.requestId;
        res.json(result);
      }
      
    } catch (error) {
      if (req.body.stream) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Chat processing failed',
          timestamp: new Date()
        })}\n\n`);
        res.end();
      } else {
        throw error;
      }
    }
  })
);
```

### **3. Real-Time Document Analysis**
```javascript
// UPDATE: Document analysis with progress updates
router.post('/analyze-document',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    const logger = createLogger(req);
    
    try {
      const { documentText, documentId, patientId, language = 'he' } = req.body;
      const sessionId = req.headers['x-session-id'] || req.requestId;
      
      // ✅ SEND: Analysis started notification
      wsManager.sendToSession(sessionId, {
        type: 'analysis_started',
        documentId: documentId,
        timestamp: new Date()
      });
      
      // ✅ SEND: Progress updates during analysis
      const enhancedClinicContext = {
        ...req.practiceContext,
        requestId: req.requestId,
        logger: logger,
        progressCallback: (stage, progress) => {
          wsManager.sendToSession(sessionId, {
            type: 'analysis_progress',
            stage: stage,
            progress: progress,
            documentId: documentId,
            timestamp: new Date()
          });
        }
      };
      
      const result = await aiCircuitBreakers.documentAnalysis.execute(
        async () => {
          return await agent.analyzeDocument({
            documentText,
            documentId,
            patientId,
            language,
            practiceContext: enhancedClinicContext
          });
        },
        aiFallbacks.documentAnalysis
      );
      
      // ✅ SEND: Analysis completed notification
      wsManager.sendToSession(sessionId, {
        type: 'analysis_complete',
        documentId: documentId,
        result: result,
        timestamp: new Date()
      });
      
      result.requestId = req.requestId;
      res.json(result);
      
    } catch (error) {
      const sessionId = req.headers['x-session-id'] || req.requestId;
      
      wsManager.sendToSession(sessionId, {
        type: 'analysis_error',
        documentId: req.body.documentId,
        error: 'Analysis failed',
        timestamp: new Date()
      });
      
      throw error;
    }
  })
);
```

### **4. Upload Progress Tracking**
```javascript
// UPDATE: Upload with progress tracking
router.post('/upload-document',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    const logger = createLogger(req);
    const sessionId = req.headers['x-session-id'] || req.requestId;
    
    try {
      const uploadedFiles = req.files;
      const totalFiles = uploadedFiles.length;
      
      // ✅ SEND: Upload started notification
      wsManager.sendToSession(sessionId, {
        type: 'upload_started',
        totalFiles: totalFiles,
        timestamp: new Date()
      });
      
      const processedFiles = [];
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        
        // ✅ SEND: File processing progress
        wsManager.sendToSession(sessionId, {
          type: 'upload_progress',
          currentFile: i + 1,
          totalFiles: totalFiles,
          fileName: file.originalname,
          stage: 'processing',
          timestamp: new Date()
        });
        
        try {
          // Process file with progress updates
          const fileInfo = await processFileWithProgress(file, (stage) => {
            wsManager.sendToSession(sessionId, {
              type: 'file_processing',
              fileName: file.originalname,
              stage: stage,
              timestamp: new Date()
            });
          });
          
          processedFiles.push(fileInfo);
          
          // ✅ SEND: File completed
          wsManager.sendToSession(sessionId, {
            type: 'file_complete',
            fileName: file.originalname,
            fileIndex: i + 1,
            timestamp: new Date()
          });
          
        } catch (error) {
          // ✅ SEND: File error
          wsManager.sendToSession(sessionId, {
            type: 'file_error',
            fileName: file.originalname,
            error: error.message,
            timestamp: new Date()
          });
        }
      }
      
      // ✅ SEND: Upload completed
      wsManager.sendToSession(sessionId, {
        type: 'upload_complete',
        processedFiles: processedFiles.length,
        totalFiles: totalFiles,
        timestamp: new Date()
      });
      
      // ... rest of upload logic ...
      
    } catch (error) {
      wsManager.sendToSession(sessionId, {
        type: 'upload_error',
        error: 'Upload failed',
        timestamp: new Date()
      });
      
      throw error;
    }
  })
);

// Helper function for file processing with progress
const processFileWithProgress = async (file, progressCallback) => {
  progressCallback('validating');
  // Validation logic...
  
  progressCallback('encrypting');
  // Encryption logic...
  
  progressCallback('storing');
  // Storage logic...
  
  progressCallback('complete');
  return fileInfo;
};
```

### **5. WebSocket Management Endpoints**
```javascript
// ADD: WebSocket management endpoints
router.get('/websocket/stats',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const stats = wsManager.getConnectionStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get WebSocket stats'
      });
    }
  }
);

router.post('/websocket/broadcast',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const { channel, message, clinicOnly = true } = req.body;
      
      if (!channel || !message) {
        return res.status(400).json({
          success: false,
          error: 'Channel and message are required'
        });
      }
      
      const clinicFilter = clinicOnly ? req.practiceSubdomain : null;
      
      const sentCount = wsManager.broadcastToChannel(channel, {
        type: 'broadcast',
        message: message,
        from: req.user.email,
        timestamp: new Date()
      }, clinicFilter);
      
      await correlatedAuditLog(req, 'WEBSOCKET_BROADCAST', {
        channel: channel,
        message: message.substring(0, 100),
        sentCount: sentCount,
        clinicOnly: clinicOnly
      });
      
      res.json({
        success: true,
        data: {
          sentCount: sentCount,
          channel: channel
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);
```

### **6. Initialize WebSocket Server**
```javascript
// ADD: WebSocket server initialization
const initializeWebSocketServer = (server) => {
  wsManager.initialize(server);
  
  // Add WebSocket stats to health checks
  if (global.healthChecks) {
    global.healthChecks.addCheck('websocket', {
      name: 'WebSocket Server',
      timeout: 2000,
      critical: false,
      check: async () => {
        const stats = wsManager.getConnectionStats();
        
        return {
          server_running: !!wsManager.wss,
          total_connections: stats.totalConnections,
          active_sessions: stats.activeSessions,
          connections_by_clinic: stats.connectionsByClinic
        };
      }
    });
  }
  
  console.log('🔌 WebSocket server initialized');
};

// Export for server initialization
module.exports.initializeWebSocketServer = initializeWebSocketServer;
```

## ⚠️ **WebSocket Notes**
- **🚨 IMPORTANT:** WebSocket support improves user experience
- **🚨 IMPORTANT:** Real-time updates reduce perceived latency
- **🚨 IMPORTANT:** Progress tracking helps with long operations
- **❌ DON'T SKIP:** This significantly improves user experience

## 🧪 **Testing After Implementation**
1. **Test WebSocket connections:**
   - Verify connections establish properly
   - Test authentication and practice filtering

2. **Test real-time updates:**
   - Test streaming chat responses
   - Verify document analysis progress updates
   - Check upload progress tracking

3. **Test connection management:**
   - Test connection cleanup on disconnect
   - Verify session-based messaging

## ✅ **Success Criteria**
- [ ] WebSocket server operational
- [ ] Real-time chat streaming working
- [ ] Document analysis progress updates functional
- [ ] Upload progress tracking active
- [ ] Connection management working
- [ ] WebSocket stats and monitoring available

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 3.10:** Add Response Caching

## 📝 **CRITICAL NOTES**
- **IMPROVES USER EXPERIENCE** - real-time feedback essential
- **REDUCES PERCEIVED LATENCY** - progress updates keep users engaged
- **ENABLES BETTER MONITORING** - real-time system status
- **TEST THOROUGHLY** - verify all real-time features work correctly
