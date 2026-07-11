require('dotenv').config();

// Initialize emergency stabilizer to prevent crashes - reload
require('./utils/emergencyStabilizer').init();

// Simple file logging
const simpleLogger = require('./services/simple-logger');
// Capture all console output to log files
simpleLogger.interceptConsole();
console.log('Server startup initiated - CSRF tokens invalidated [Global practice fixed]');

// Set global server start time for rate limiting grace period
global.serverStartTime = Date.now();

// Core Express setup
const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');

// Create Express app
const app = express();

// Master Service Loader - ALL services loaded through this
const masterServiceLoader = require('./services/masterServiceLoader');

// Initialize all services - permissions updated
async function initializeServer() {
  try {
    console.log('[18:00:00] 🚀 Initializing all services via Master Service Loader...');
    console.log('📋 Current environment: NODE_ENV=' + (process.env.NODE_ENV || 'development'));
    console.log('📋 Memory usage before init:', JSON.stringify(process.memoryUsage()));

    // Initialize ALL services in correct dependency order
    console.log('⏳ Starting service initialization...');
    const startTime = Date.now();

    const result = await masterServiceLoader.initializeAll();

    const initDuration = Date.now() - startTime;
    console.log(`⏱️ Service initialization took ${initDuration}ms`);

    if (result.failed.length > 0) {
      console.error('❌ CRITICAL: Some services failed to initialize:', result.failed);
      console.error('❌ Failed service details:');
      result.failed.forEach(service => {
        console.error(`   - ${service}: Failed to load`);
      });
      console.error('❌ System starting with degraded functionality');
    } else {
      console.log(`✅ All ${result.loaded.length} services initialized successfully`);
      console.log('📋 Initialized services:', result.loaded.join(', '));
    }

    // Setup Express middleware
    console.log('🔧 Setting up Express middleware...');
    setupMiddleware();
    console.log('✅ Middleware configured');

    // Setup routes
    console.log('🛤️ Loading routes...');
    setupRoutes();
    console.log('✅ Routes loaded');

    // Start server
    console.log('🚀 Starting HTTP server...');
    startServer();

  } catch (error) {
    console.error('❌ CRITICAL: Failed to initialize server:', error.message);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Stack trace:', error.stack);

    // Log additional error details if available
    if (error.code) console.error('❌ Error code:', error.code);
    if (error.syscall) console.error('❌ System call:', error.syscall);
    if (error.path) console.error('❌ File path:', error.path);

    console.error('❌ Memory usage at crash:', JSON.stringify(process.memoryUsage()));
    console.error('❌ System cannot start - exiting with code 1');
    process.exit(1);
  }
}

// Setup middleware
function setupMiddleware() {
  // Performance monitoring (first middleware to capture all requests)
  const performanceMonitor = require('./middleware/performanceMonitor');
  app.use(performanceMonitor.middleware());
  performanceMonitor.startSampling(5000); // Sample CPU/memory every 5 seconds

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false
  }));

  // CORS configuration
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Allow all subdomains of intellicare.health and localhost
      const allowedPatterns = [
        /^https?:\/\/([a-z0-9-]+\.)?intellicare\.health(:\d+)?$/,
        /^https?:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/
      ];
      
      const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Practice-Subdomain', 
                     'X-Service-Id', 'X-Request-Id', 'X-Session-Token', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
  };
  
  app.use(cors(corsOptions));
  app.use(cookieParser());
  // Native clients (mobile) have no cookie jar and send the session via the
  // X-Session-Token header. Mirror it into req.cookies.sessionToken so the existing
  // cookie-based auth chain (practiceAuth / validateSession / validateCSRF) works
  // unchanged. Web is unaffected — it sends the cookie and no header.
  app.use((req, res, next) => {
    if (!req.cookies) req.cookies = {};
    if (!req.cookies.sessionToken) {
      const headerToken = req.get('x-session-token');
      if (headerToken) req.cookies.sessionToken = headerToken;
    }
    next();
  });
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

  // Request logging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Setup routes
function setupRoutes() {
  try {
    // Get the route loader service
    console.log('📂 Loading route loader service...');
    const routeLoaderService = require('./services/routeLoaderService');

    // Initialize with Express app
    console.log('🔗 Initializing route loader with Express app...');
    routeLoaderService.initialize(app);

    // Health check endpoint (added before other routes)
    console.log('🏥 Adding health check endpoint...');
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: masterServiceLoader.getReport(),
        routes: routeLoaderService.getReport()
      });
    });

    // Performance monitoring endpoint
    console.log('📊 Adding performance monitoring endpoint...');
    app.get('/api/performance', (req, res) => {
      try {
        const performanceMonitor = require('./middleware/performanceMonitor');
        const report = performanceMonitor.getReport();
        const timers = performanceMonitor.getActiveTimers();
        res.json({
          success: true,
          performance: report,
          timers: timers,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to get performance stats:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Claude Response Cache stats endpoint
    console.log('📊 Adding cache stats endpoint...');
    app.get('/api/cache-stats', async (req, res) => {
      try {
        const claudeResponseCache = require('./services/claudeResponseCache');
        const stats = await claudeResponseCache.getStats();
        res.json({
          success: true,
          cacheStats: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to get cache stats:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Load all routes using the service
    console.log('🚦 Loading all application routes...');
    const result = routeLoaderService.loadAllRoutes();

    if (result.failed > 0) {
      console.error(`⚠️ ${result.failed} routes failed to load`);
      if (result.failedRoutes) {
        result.failedRoutes.forEach(route => {
          console.error(`   - ${route.path}: ${route.error}`);
        });
      }
    }

    if (result.loaded) {
      console.log(`✅ Loaded ${result.loaded} routes successfully`);
    }

    // Error handling middleware
    console.log('🛡️ Adding error handling middleware...');
    app.use((err, req, res, next) => {
      console.error('🔥 Express error handler caught:', err.message);
      console.error('   Error type:', err.constructor.name);
      console.error('   Stack:', err.stack);
      res.status(err.status || 500).json({
        error: {
          message: err.message || 'Internal server error',
          status: err.status || 500
        }
      });
    });

    console.log('✅ Route setup completed successfully');

  } catch (error) {
    console.error('❌ CRITICAL: Failed to setup routes:', error.message);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Stack trace:', error.stack);
    throw error; // Re-throw to be caught by initializeServer
  }
}

// Start server with professional port management
async function startServer() {
  const PORT = process.env.PORT || 5000;

  // Check and free port before attempting to start
  await ensurePortAvailable(PORT);

  // Try to load SSL certificates if available
  let server;
  const certPath = path.join(__dirname, 'certs', 'cert.pem');
  const keyPath = path.join(__dirname, 'certs', 'key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    // HTTPS server with SSL certificates
    const httpsOptions = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath)
    };
    server = https.createServer(httpsOptions, app);
    console.log('🔒 HTTPS server created with SSL certificates');
  } else {
    // Fallback to HTTP
    server = http.createServer(app);
    console.log('⚠️ HTTP server created (no SSL certificates found)');
  }
  
  // WebSocket upgrade handler for visit recording (raw ws, not Socket.IO)
  const visitWss = new (require('ws').Server)({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/ws/visit-recording') {
      console.log('[Visit WS] Upgrade request received, cookies present:', !!(request.headers.cookie));

      // Parse cookies synchronously
      const cookies = {};
      (request.headers.cookie || '').split(';').forEach(c => {
        const [key, ...val] = c.trim().split('=');
        if (key) cookies[key.trim()] = val.join('=').trim();
      });
      const sessionToken = cookies.sessionToken;
      if (!sessionToken) {
        console.warn('[Visit WS] No sessionToken cookie found');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Validate session asynchronously, then upgrade
      const SecureSessionManager = require('./services/secureSessionManager');
      SecureSessionManager.validateSession(sessionToken)
        .then((session) => {
          if (!session) {
            console.warn('[Visit WS] Session invalid');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
          console.log('[Visit WS] Auth OK, user:', session.userId);
          request._wsUser = { id: session.userId, practiceId: session.practiceId, role: session.userRole };
          visitWss.handleUpgrade(request, socket, head, (ws) => {
            visitWss.emit('connection', ws, request);
          });
        })
        .catch((err) => {
          console.warn('[Visit WS] Auth failed:', err.message);
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
        });
      return; // Prevent Socket.IO from handling this path
    }
    // Socket.IO handles its own upgrades internally
  });

  // Handle visit recording WebSocket connections
  visitWss.on('connection', (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    let visitId = null;
    let elevenLabsSession = null;
    const audioChunks = [];
    let audioChunkCount = 0;

    console.log('[Visit WS] Client connected');

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'audio') {
          audioChunkCount++;
          if (audioChunkCount % 50 === 1) console.log(`[Visit WS] Audio chunk #${audioChunkCount}`);
        } else {
          console.log('[Visit WS] Received message:', msg.type);
        }

        switch (msg.type) {
          case 'start': {
            visitId = msg.visitId;
            const mode = msg.mode || 'visit';
            console.log(`[Visit WS] Starting session: visitId=${visitId}, mode=${mode}`);
            const elevenLabsSttService = require('./services/elevenLabsSttService');

            if (!elevenLabsSttService.isAvailable()) {
              ws.send(JSON.stringify({ type: 'error', code: 'STT_UNAVAILABLE', message: 'Speech-to-text service not available' }));
              return;
            }

            // For voiceChat mode, generate a temporary session ID if no visitId
            const sessionId = visitId || `voicechat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            elevenLabsSession = elevenLabsSttService.createRealtimeSession({ visitId, sessionId });

            elevenLabsSession.on('session_started', () => {
              console.log('[Visit WS] ElevenLabs session started, notifying client');
              ws.send(JSON.stringify({ type: 'session_started', visitId }));
            });

            elevenLabsSession.on('partial', (d) => {
              console.log('[Visit WS] Partial transcript:', d.text?.substring(0, 60));
              ws.send(JSON.stringify({ type: 'partial', text: d.text }));
            });

            elevenLabsSession.on('committed', (segment) => {
              console.log('[Visit WS] Committed transcript:', segment.text?.substring(0, 60));
              ws.send(JSON.stringify({
                type: 'committed',
                text: segment.text,
                speaker: segment.speaker,
                start: segment.start,
                end: segment.end,
              }));
            });

            elevenLabsSession.on('error', (err) => {
              console.error('[Visit WS] ElevenLabs error:', err.type, err.error);
              ws.send(JSON.stringify({ type: 'error', code: err.type, message: err.error }));
            });

            elevenLabsSession.on('close', (info) => {
              console.log('[Visit WS] ElevenLabs session closed:', info?.code, info?.reason);
              // Auto-reconnect STT session if frontend WebSocket is still open (voice chat continues)
              if (ws.readyState === 1 /* OPEN */ && mode === 'voiceChat') {
                console.log('[Visit WS] Auto-reconnecting ElevenLabs STT session for voiceChat...');
                try {
                  const newSession = elevenLabsSttService.createRealtimeSession({ visitId, sessionId });
                  newSession.on('session_started', () => {
                    console.log('[Visit WS] Reconnected ElevenLabs STT session');
                    ws.send(JSON.stringify({ type: 'session_started', visitId, reconnected: true }));
                  });
                  newSession.on('partial', (d) => {
                    ws.send(JSON.stringify({ type: 'partial', text: d.text }));
                  });
                  newSession.on('committed', (segment) => {
                    console.log('[Visit WS] Committed transcript (reconnected):', segment.text?.substring(0, 60));
                    ws.send(JSON.stringify({
                      type: 'committed', text: segment.text, speaker: segment.speaker,
                      start: segment.start, end: segment.end,
                    }));
                  });
                  newSession.on('error', (err) => {
                    console.error('[Visit WS] ElevenLabs error (reconnected):', err.type, err.error);
                  });
                  newSession.on('close', (info2) => {
                    console.log('[Visit WS] Reconnected ElevenLabs session closed:', info2?.code, info2?.reason);
                  });
                  elevenLabsSession = newSession;
                } catch (reconErr) {
                  console.error('[Visit WS] STT reconnection failed:', reconErr.message);
                }
              }
            });

            break;
          }

          case 'audio': {
            if (elevenLabsSession && elevenLabsSession.connected) {
              elevenLabsSession.sendAudio(msg.data);
              audioChunks.push(Buffer.from(msg.data, 'base64'));
            } else if (elevenLabsSession && !elevenLabsSession.connected) {
              // Audio dropping — STT session disconnected, waiting for reconnect
              if (audioChunkCount % 100 === 0) {
                console.warn('[Visit WS] Audio dropping — ElevenLabs STT not connected (chunk #' + audioChunkCount + ')');
              }
              audioChunks.push(Buffer.from(msg.data, 'base64'));
            }
            break;
          }

          case 'flush': {
            // User edited text — commit current segment so next speech starts fresh
            if (elevenLabsSession) {
              console.log('[Visit WS] Flushing current segment (user edited text)');
              elevenLabsSession.sendCommit();
            }
            break;
          }

          case 'end': {
            if (elevenLabsSession) {
              const transcript = elevenLabsSession.close();
              elevenLabsSession = null;

              // Encrypt and save audio + transcript to the visit document
              let audioSaved = false;
              if (visitId && audioChunks.length > 0) {
                try {
                  const audioBuffer = Buffer.concat(audioChunks);
                  const enc = require('./services/e2eEncryptionService');
                  const SecureDataAccess = require('./services/secureDataAccess');
                  const mongoose = require('mongoose');

                  const encrypted = await enc.encryptWithServiceKey(audioBuffer);
                  const updateData = {
                    $set: {
                      'audioRecording.encryptedContent': Buffer.from(encrypted.data, 'base64'),
                      'audioRecording.contentIv': encrypted.iv,
                      'audioRecording.contentTag': encrypted.tag,
                      'audioRecording.format': 'audio/pcm',
                      'audioRecording.sampleRate': 16000,
                      'audioRecording.sizeBytes': audioBuffer.length,
                      transcript: {
                        fullText: transcript.fullText || '',
                        segments: transcript.segments || [],
                        language: transcript.language || 'en',
                      },
                      status: 'transcribing',
                      updatedAt: new Date(),
                    },
                  };

                  const wsContext = {
                    serviceId: 'visit-recording-ws',
                    operation: 'save_audio',
                    practiceId: 'system',
                    apiKey: 'ws-internal',
                  };

                  await SecureDataAccess.update(
                    'patient_visits',
                    { _id: new mongoose.Types.ObjectId(visitId) },
                    updateData,
                    wsContext,
                  );
                  audioSaved = true;
                  audioChunks.length = 0; // Free memory
                } catch (saveErr) {
                  console.error('[Visit WS] Failed to save audio:', saveErr.message);
                }
              }

              ws.send(JSON.stringify({
                type: 'recording_ended',
                visitId,
                audioSaved,
                transcript: { fullText: transcript.fullText },
              }));
            }
            break;
          }
        }
      } catch (err) {
        console.error('[Visit WS] Message handling error:', err.message);
        ws.send(JSON.stringify({ type: 'error', code: 'INTERNAL', message: 'Server error' }));
      }
    });

    ws.on('close', () => {
      if (elevenLabsSession) {
        elevenLabsSession.close();
        elevenLabsSession = null;
      }
    });

    ws.on('error', (err) => {
      console.error('[Visit WS] Connection error:', err.message);
      if (elevenLabsSession) {
        elevenLabsSession.close();
        elevenLabsSession = null;
      }
    });
  });

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: function(origin, callback) {
        // Allow same origins as Express CORS
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://intellicare.health:3000',
          'http://intellicare.health:3001',
          'https://intellicare.health',
          'https://www.intellicare.health'
        ];
        
        // Allow requests with no origin (like mobile apps, Postman)
        if (!origin) return callback(null, true);
        
        // Check if origin is allowed
        if (allowedOrigins.includes(origin) || origin.includes('.intellicare.health')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }
  });
  
  // Store io instance globally for access in other modules
  global.io = io;
  
  // Setup Socket.IO connection handler
  io.on('connection', (socket) => {
    if (process.env.QUIET_LOGS !== 'true') console.log(`🔌 New WebSocket connection: ${socket.id}`);
    
    // Join session-specific room if sessionId provided
    socket.on('join_session', (sessionId) => {
      if (sessionId) {
        socket.join(`session_${sessionId}`);
        if (process.env.QUIET_LOGS !== 'true') console.log(`📱 Socket ${socket.id} joined session_${sessionId}`);
      }
    });
    
    // Doctor subscription for appointment notifications
    socket.on('doctor_online', (doctorId) => {
      if (doctorId) {
        socket.join(`doctor_${doctorId}`);
        console.log(`👨‍⚕️ Doctor ${doctorId} is online - joined room doctor_${doctorId}`);
        
        // TODO: Send any queued notifications for this doctor
        // This will be implemented in appointmentNotificationService
      }
    });
    
    // Secretary/Admin subscription for practice-wide notifications
    socket.on('subscribe_practice', (practiceId) => {
      if (practiceId) {
        socket.join(`practice_${practiceId}`);
        console.log(`🏥 Socket ${socket.id} subscribed to practice ${practiceId} notifications`);
      }
    });
    
    // Unsubscribe from doctor notifications (when logging out)
    socket.on('doctor_offline', (doctorId) => {
      if (doctorId) {
        socket.leave(`doctor_${doctorId}`);
        console.log(`👨‍⚕️ Doctor ${doctorId} went offline - left room doctor_${doctorId}`);
      }
    });
    
    // ===== STAFF CHAT EVENTS =====

    // Online presence (with appear_offline + availability support)
    socket.on('staff_chat_online', async ({ userId, practiceId }) => {
      if (!userId || !practiceId) return;
      socket.join(`user_${userId}`);
      socket.join(`practice_chat_${practiceId}`);
      socket.staffUserId = userId;
      socket.staffPracticeId = practiceId;

      // Query settings for appear_offline users
      let appearOfflineUserIds = new Set();
      let userStatusMap = {};
      try {
        const databaseFactory = require('./utils/databaseFactory');
        const db = await databaseFactory.getPracticeDatabase(practiceId, true);
        const nativeDb = db.db ? db.db : db;
        const allSettings = await nativeDb.collection('staff_chat_settings')
          .find({}, { projection: { userId: 1, availability: 1, statusText: 1 } })
          .toArray();
        allSettings.forEach(s => {
          if (s.availability === 'appear_offline') {
            appearOfflineUserIds.add(s.userId);
          }
          userStatusMap[s.userId] = {
            availability: s.availability || 'online',
            statusText: s.statusText || ''
          };
        });
      } catch (e) {
        // Silently fall back to no filtering
      }

      // Send current online users (excluding appear_offline) to the joiner
      const room = io.sockets.adapter.rooms.get(`practice_chat_${practiceId}`);
      const onlineIds = [];
      if (room) {
        for (const sid of room) {
          const s = io.sockets.sockets.get(sid);
          if (s?.staffUserId && !appearOfflineUserIds.has(s.staffUserId)) {
            onlineIds.push(s.staffUserId);
          }
        }
      }
      socket.emit('staff_chat_online_users', {
        users: [...new Set(onlineIds)],
        statuses: userStatusMap
      });

      // Broadcast to others (unless appear_offline)
      if (!appearOfflineUserIds.has(userId)) {
        socket.to(`practice_chat_${practiceId}`).emit('staff_user_online', {
          userId,
          availability: userStatusMap[userId]?.availability || 'online',
          statusText: userStatusMap[userId]?.statusText || ''
        });
      }
    });

    // Typing indicator
    socket.on('staff_chat_typing', ({ conversationId, userId, userName, isTyping }) => {
      if (conversationId) {
        socket.to(`staff_conv_${conversationId}`).emit('staff_chat_typing', {
          conversationId, userId, userName, isTyping
        });
      }
    });

    // Join/leave conversation rooms (for typing indicators)
    socket.on('staff_chat_join_conv', (convId) => convId && socket.join(`staff_conv_${convId}`));
    socket.on('staff_chat_leave_conv', (convId) => convId && socket.leave(`staff_conv_${convId}`));

    // Handle disconnection
    socket.on('disconnect', async () => {
      // Staff chat offline broadcast — only if no other sockets for this user remain
      if (socket.staffUserId && socket.staffPracticeId) {
        const practiceRoom = io.sockets.adapter.rooms.get(`practice_chat_${socket.staffPracticeId}`);
        let stillOnline = false;
        if (practiceRoom) {
          for (const sid of practiceRoom) {
            if (sid === socket.id) continue;
            const s = io.sockets.sockets.get(sid);
            if (s?.staffUserId === socket.staffUserId) { stillOnline = true; break; }
          }
        }
        if (!stillOnline) {
          socket.to(`practice_chat_${socket.staffPracticeId}`).emit('staff_user_offline', {
            userId: socket.staffUserId
          });

          // Update lastSeen (skip if appear_offline)
          try {
            const databaseFactory = require('./utils/databaseFactory');
            const db = await databaseFactory.getPracticeDatabase(socket.staffPracticeId, true);
            const nativeDb = db.db ? db.db : db;
            const settings = await nativeDb.collection('staff_chat_settings').findOne({ userId: socket.staffUserId });
            if (!settings || settings.availability !== 'appear_offline') {
              await nativeDb.collection('staff_chat_settings').updateOne(
                { userId: socket.staffUserId },
                { $set: { lastSeen: new Date(), updatedAt: new Date() } },
                { upsert: true }
              );
            }
          } catch (e) {
            // Silently fail — lastSeen is non-critical
          }
        }
      }
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
  
  console.log('✅ Socket.IO initialized for real-time notifications');
  
  // Handle any server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is still in use after cleanup attempt.`);
      console.error(`   Another process may have started on this port.`);
      console.error(`   Please ensure no other instances are running.`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', error);
      process.exit(1);
    }
  });
  
  // Start server on the required port
  server.listen(PORT, '0.0.0.0', async () => {
    const protocol = server instanceof https.Server ? 'https' : 'http';
    console.log('\n========================================');
    console.log('🚀 Starting IntelliCare Server');
    console.log('========================================\n');
    console.log(`[${new Date().toTimeString().split(' ')[0]}] 📡 Server listening on port ${PORT}`);
    console.log(`\n✅ Server ready at ${protocol}://localhost:${PORT}`);
    if (protocol === 'https') {
      console.log(`✅ SSL enabled - also accessible at https://intellicare.health:${PORT}`);
    }
    console.log('========================================\n');

    // Initialize batch results worker (but don't start - it runs on-demand now)
    // The worker will auto-start when a batch is submitted and auto-stop when done
    try {
      const batchResultsWorker = require('./services/batchResultsWorker');
      await batchResultsWorker.initialize();
      // Check if there are any pending batches from before restart
      await batchResultsWorker.start(); // Will auto-stop if no batches found
      console.log('✅ Batch results worker initialized (runs on-demand, auto-stops when idle)');
    } catch (error) {
      console.error('⚠️ Failed to initialize batch results worker:', error.message);
      // Non-critical, continue server operation
    }

    // Start Skills job recovery cron for recovering stuck analysis jobs
    try {
      // DEPRECATED: Skills API removed - now using Batch API
      // const { startSkillsJobRecoveryCron } = require('./cron/skillsJobRecovery');
      // startSkillsJobRecoveryCron();
      console.log('✅ Skills job recovery cron started (checking every 5 minutes)');
    } catch (error) {
      console.error('⚠️ Failed to start Skills job recovery cron:', error.message);
      // Non-critical, continue server operation
    }

    // Start prescription monitoring service for automatic prescription activation
    try {
      const prescriptionMonitoringService = require('./services/prescriptionMonitoringService');
      await prescriptionMonitoringService.initialize();
      await prescriptionMonitoringService.start();
      console.log('✅ Prescription monitoring service started (checking hourly)');
    } catch (error) {
      console.error('⚠️ Failed to start prescription monitoring service:', error.message);
      // Non-critical, continue server operation
    }

    // Start follow-up appointment creator for automatic appointment scheduling
    try {
      const { followUpCreatorJob } = require('./cron/followUpAppointmentCreator');
      followUpCreatorJob.start();
      console.log('✅ Follow-up appointment creator started (checking every 15 minutes)');
    } catch (error) {
      console.error('⚠️ Failed to start follow-up appointment creator:', error.message);
      // Non-critical, continue server operation
    }

    // Log cache statistics on startup to monitor persistence
    try {
      const claudeResponseCache = require('./services/claudeResponseCache');
      // Give Redis connection time to establish
      await new Promise(resolve => setTimeout(resolve, 1000));
      const stats = await claudeResponseCache.getStats();

      console.log('📊 Redis Cache Status on Startup:');
      console.log(`  • Cache entries: ${stats.size}`);
      console.log(`  • Hit rate: ${stats.hitRate}`);
      console.log(`  • Total saved: ${stats.totalSavedSeconds}s`);
      console.log(`  • Connected: ${stats.connected ? '✅ Yes' : '❌ No'}`);

      if (stats.size > 0) {
        console.log(`  🎉 Cache persisted! ${stats.size} entries loaded from disk`);
      } else {
        console.log(`  ℹ️ Cache empty (normal on first start or after flush)`);
      }
      console.log('========================================\n');
    } catch (error) {
      console.log('⚠️ Could not get cache statistics:', error.message);
      console.log('========================================\n');
    }

    // Cache warming disabled - using simple Redis caching approach
    // First call: Regular API call that caches result
    // Second call: Redis cache hit
    console.log('📦 Redis caching enabled - results cached on first request');

    console.log('========================================\n');
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\nSIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('\nSIGINT received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

// Ensure port is available before starting server
async function ensurePortAvailable(port) {
  const { execSync } = require('child_process');
  const net = require('net');
  
  // Check if port is in use
  const isPortInUse = await new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port);
  });
  
  if (isPortInUse) {
    console.log(`\n⚠️  Port ${port} is currently in use.`);
    console.log(`🔄 Cleaning up port ${port}...`);
    
    try {
      // Try to kill the process using the port
      if (process.platform === 'win32') {
        // Windows: Find and kill process using netstat and taskkill
        try {
          const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
          const lines = output.trim().split('\n');
          const pids = new Set();
          
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              pids.add(pid);
            }
          });
          
          pids.forEach(pid => {
            try {
              execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
            } catch (e) {
              // Process might already be gone
            }
          });
          
          console.log(`✅ Successfully freed port ${port}`);
        } catch (e) {
          // If netstat fails, try npx kill-port as fallback
          execSync(`npx kill-port ${port}`, { stdio: 'ignore' });
          console.log(`✅ Successfully freed port ${port} (using kill-port)`);
        }
      } else {
        // Unix/Linux/Mac: Use lsof and kill
        try {
          execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
          console.log(`✅ Successfully freed port ${port}`);
        } catch (e) {
          // Try npx kill-port as fallback
          execSync(`npx kill-port ${port}`, { stdio: 'ignore' });
          console.log(`✅ Successfully freed port ${port} (using kill-port)`);
        }
      }
      
      // Wait for port to be fully released
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify port is now free
      const stillInUse = await new Promise((resolve) => {
        const tester = net.createServer()
          .once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              resolve(true);
            } else {
              resolve(false);
            }
          })
          .once('listening', () => {
            tester.once('close', () => resolve(false)).close();
          })
          .listen(port);
      });
      
      if (stillInUse) {
        console.error(`\n❌ Failed to free port ${port}.`);
        console.error(`   Please manually stop any processes using this port.`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`\n❌ Failed to free port ${port}: ${error.message}`);
      console.error(`   Please manually stop any processes using this port.`);
      process.exit(1);
    }
  } else {
    console.log(`✅ Port ${port} is available`);
  }
}

// Graceful shutdown handlers for batch state persistence and prescription monitoring
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received - Graceful shutdown initiated');

  try {
    // Stop prescription monitoring service
    try {
      const prescriptionMonitoringService = require('./services/prescriptionMonitoringService');
      prescriptionMonitoringService.stop();
      console.log('⏹️ Prescription monitoring service stopped');
    } catch (error) {
      console.error('⚠️ Error stopping prescription monitoring service:', error.message);
    }

    // Check batch state
    const serviceProxyManager = require('./services/serviceProxyManager');
    const batchStateManager = serviceProxyManager.get('batchStateManager');

    if (batchStateManager) {
      const activeBatches = await batchStateManager.getActiveBatches();
      console.log(`📊 ${activeBatches.length} active batch(es) will resume on restart`);

      if (activeBatches.length > 0) {
        activeBatches.forEach(batch => {
          console.log(`   - Batch ${batch.batchId}: ${batch.documentCount} documents (${batch.status})`);
        });
      }
    }
  } catch (error) {
    console.error('⚠️ Error during shutdown cleanup:', error.message);
  }

  console.log('✅ Server shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received (Ctrl+C) - Graceful shutdown initiated');

  try {
    // Stop prescription monitoring service
    try {
      const prescriptionMonitoringService = require('./services/prescriptionMonitoringService');
      prescriptionMonitoringService.stop();
      console.log('⏹️ Prescription monitoring service stopped');
    } catch (error) {
      console.error('⚠️ Error stopping prescription monitoring service:', error.message);
    }

    // Check batch state
    const serviceProxyManager = require('./services/serviceProxyManager');
    const batchStateManager = serviceProxyManager.get('batchStateManager');

    if (batchStateManager) {
      const activeBatches = await batchStateManager.getActiveBatches();
      console.log(`📊 ${activeBatches.length} active batch(es) will resume on restart`);

      if (activeBatches.length > 0) {
        activeBatches.forEach(batch => {
          console.log(`   - Batch ${batch.batchId}: ${batch.documentCount} documents (${batch.status})`);
        });
      }
    }
  } catch (error) {
    console.error('⚠️ Error during shutdown cleanup:', error.message);
  }

  console.log('✅ Server shutting down gracefully');
  process.exit(0);
});

// Initialize the server - all services have insert permissions
initializeServer();

module.exports = app;
// Trigger restart יום ו 19 ספט 2025 07:10:20
// Restart for enhanced semantic search יום ו 19 ספט 2025 08:05:25
// Restart for appointments-api auth fix - collection fixed
// Restart for medical history fix - serviceProxyManager registration

// Least-privilege security 2025-09-19T18:36:40.873Z
// Redis data sync service added 2025-09-20
// Auto-registration enabled 2025-09-20T08:48:00Z
// Stanford practice caching enabled 2025-09-20T08:52:00Z