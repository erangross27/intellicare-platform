const express = require('express');
const router = express.Router();

// Store active SSE connections
const sseConnections = new Map();

// SSE endpoint for AI analysis events
router.get('/events', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Generate unique connection ID
  const connectionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store connection
  sseConnections.set(connectionId, {
    res,
    userId: req.user?.id,
    practiceSubdomain: req.practiceSubdomain,
    connectedAt: new Date()
  });

  console.log(`📡 SSE connection established: ${connectionId} for user ${req.user?.email || 'unknown'}`);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    connectionId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`📡 SSE connection closed: ${connectionId}`);
    sseConnections.delete(connectionId);
  });

  req.on('error', (error) => {
    console.error(`📡 SSE connection error: ${connectionId}`, error);
    sseConnections.delete(connectionId);
  });
});

// Function to broadcast AI completion event
function broadcastAICompletion(data) {
  const { documentId, patientId, userId, practiceSubdomain } = data;
  
  console.log(`📡 Broadcasting AI completion: doc=${documentId}, patient=${patientId}`);
  
  let sentCount = 0;
  
  // Send to all connections for the same user/practice
  sseConnections.forEach((connection, connectionId) => {
    if (connection.userId === userId && connection.practiceSubdomain === practiceSubdomain) {
      try {
        connection.res.write(`data: ${JSON.stringify({
          type: 'ai-analysis-complete',
          documentId,
          patientId,
          timestamp: new Date().toISOString()
        })}\n\n`);
        
        sentCount++;
        console.log(`📡 AI completion sent to connection: ${connectionId}`);
        
      } catch (error) {
        console.error(`📡 Error sending to connection ${connectionId}:`, error);
        sseConnections.delete(connectionId);
      }
    }
  });
  
  console.log(`📡 AI completion broadcast to ${sentCount} connections`);
}

// Function to get connection stats
function getConnectionStats() {
  return {
    totalConnections: sseConnections.size,
    connections: Array.from(sseConnections.entries()).map(([id, conn]) => ({
      id,
      userId: conn.userId,
      practice: conn.practiceSubdomain,
      connectedAt: conn.connectedAt
    }))
  };
}

module.exports = {
  router,
  broadcastAICompletion,
  getConnectionStats
};
