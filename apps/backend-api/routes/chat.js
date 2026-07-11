const express = require('express');
const router = express.Router();
const { practiceContext, practiceModels, auditLogger } = require('../middleware/practiceContext');
const { practiceAuth } = require('../middleware/practiceAuth');
const encryptionService = require('../services/encryptionService');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('../services/secureDataAccess');
const serviceAccountManager = require('../services/serviceAccountManager');

// Service authentication for chat service
let chatServiceAuth = null;

// Initialize chat service authentication with retry logic
async function initializeChatService(retryCount = 0) {
  try {
    // Services are initialized in server.js - just authenticate
    chatServiceAuth = await serviceAccountManager.authenticate('chat-service');
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log('✅ Chat service authenticated successfully');
    return true;
  } catch (error) {
    console.error(`❌ Failed to authenticate chat service (attempt ${retryCount + 1}):`, error.message);
    chatServiceAuth = null;
    
    // Retry up to 3 times with exponential backoff
    if (retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`⏳ Retrying chat service authentication in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return initializeChatService(retryCount + 1);
    }
    
    console.warn('⚠️ Chat service authentication failed after 3 attempts - will retry on first request');
    return false;
  }
}

// Initialize on module load
initializeChatService().catch(console.error);

// Middleware to ensure chat service is authenticated
const ensureChatServiceAuth = async (req, res, next) => {
  if (!chatServiceAuth) {
    // Try to initialize/authenticate the service
    const success = await initializeChatService();
    if (!success || !chatServiceAuth) {
      // In development, create a temporary auth object to allow testing
      if (secureConfigService.get('NODE_ENV', 'development') === 'development') {
        console.warn('⚠️ DEVELOPMENT MODE: Using temporary chat service auth');
        chatServiceAuth = {
          userId: req.user?.id || 'anonymous',
          apiKey: 'development-chat-service-key',
          permissions: ['read', 'write']
        };
        req.chatServiceAuth = chatServiceAuth;
        return next();
      }
      
      return res.status(503).json({
        success: false,
        message: 'Chat service temporarily unavailable'
      });
    }
  }
  // Pass chat service auth to request for SecureDataAccess
  req.chatServiceAuth = chatServiceAuth;
  next();
};

// Apply practice context and models middleware to all routes
router.use(practiceContext);
router.use(practiceModels);

// Public debug endpoint (before auth middleware)
router.get('/debug-public', (req, res) => {
  console.log('[CHAT DEBUG PUBLIC] Request details:');
  console.log('  - All Cookies:', req.cookies);
  console.log('  - Cookie header:', req.headers.cookie);
  console.log('  - Host:', req.get('host'));
  console.log('  - Origin:', req.headers.origin);
  console.log('  - X-Practice-Subdomain:', req.headers['x-practice-subdomain']);
  
  res.json({
    cookies: req.cookies || {},
    headers: {
      host: req.get('host'),
      origin: req.headers.origin,
      'x-practice-subdomain': req.headers['x-practice-subdomain'],
      hasCookieHeader: !!req.headers.cookie
    }
  });
});

router.use(practiceAuth);
router.use(ensureChatServiceAuth);

// Middleware to extract user ID from authenticated JWT token only
const getUserId = (req) => {
  // SECURITY: Only use authenticated user ID from JWT token, never trust headers
  const userId = req.user?.id || req.user?._id || req.user?.userId;
  if (!userId) {
    throw new Error('User not authenticated - JWT token required');
  }
  return userId.toString(); // Convert ObjectId to string if needed
};

// Helper to get SecureDataAccess context
const getSecureContext = (req, userId) => ({
  serviceId: 'chat-service',
  apiKey: req.chatServiceAuth.apiKey,
  practiceId: req.practiceSubdomain || req.practice?.subdomain,
  userId: userId || getUserId(req)
});

// DEBUG: GET /api/chat/debug - Debug endpoint to check authentication
router.get('/debug', async (req, res) => {
  console.log('[CHAT DEBUG] Request details:');
  console.log('  - Cookies:', Object.keys(req.cookies || {}));
  console.log('  - User:', req.user);
  console.log('  - Session:', req.session?.sessionId);
  console.log('  - Practice:', req.practiceSubdomain);
  console.log('  - Headers:', {
    'x-practice-subdomain': req.headers['x-practice-subdomain'],
    'cookie': req.headers.cookie ? 'present' : 'absent'
  });
  
  res.json({
    authenticated: !!req.user,
    userId: req.user?.id,
    practiceSubdomain: req.practiceSubdomain,
    cookies: Object.keys(req.cookies || {}),
    sessionPresent: !!req.session,
    chatServiceAuth: !!req.chatServiceAuth
  });
});

// GET /api/chat/sessions - Enhanced list with search, filtering, pagination, and sorting
router.get('/sessions', async (req, res) => {
  try {
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log('[CHAT SESSIONS] Starting session list request');
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log('[CHAT SESSIONS] User object:', req.user);
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log('[CHAT SESSIONS] Practice:', req.practiceSubdomain);
    
    // Handle both id and _id format from MongoDB
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    
    if (!userId) {
      process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log('[CHAT SESSIONS] No userId found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log('[CHAT SESSIONS] UserId:', userId);

    // Extract query parameters with defaults
    const {
      search = '',
      language = '',
      isActive = '',
      dateFrom = '',
      dateTo = '',
      messageCountMin = '',
      messageCountMax = '',
      sortBy = 'updatedAt',  // Changed default to updatedAt for newest first
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      searchFields = 'title,summary'
    } = req.query;

    // Query sessions with enhanced filtering

    // Build search query
    // Since we're already in a practice-specific database, just query by userId
    const query = { 
      userId
    };
    
    // Optionally filter by practice in sessionId if needed
    // Removed for now as it might be causing issues

    // Add search across multiple fields
    const searchConditions = [];
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const fields = searchFields.split(',').map(f => f.trim());

      if (fields.includes('title')) searchConditions.push({ title: searchRegex });
      if (fields.includes('summary')) searchConditions.push({ summary: searchRegex });
    }

    // Create filter functions for JavaScript filtering
    let searchFilter = null;
    let dateRangeFilter = null;
    let messageCountFilter = null;
    
    if (searchConditions.length > 0) {
      searchFilter = (session) => {
        return searchConditions.some(condition => {
          const field = Object.keys(condition)[0];
          const regex = condition[field];
          return session[field] && regex.test(session[field]);
        });
      };
    }

    // Add filters
    if (language) query.language = language;
    
    // IMPORTANT: Default to showing only active sessions unless explicitly requested otherwise
    if (isActive === 'false') {
      query.isActive = false; // Explicitly show inactive sessions
    } else if (isActive === 'all') {
      // Don't filter by isActive - show all
    } else {
      // Default: only show active sessions (or sessions without isActive field)
      query.$or = [
        { isActive: true },
        { isActive: { $exists: false } }  // Handle sessions created before isActive was added
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const dateFromObj = dateFrom ? new Date(dateFrom) : null;
      const dateToObj = dateTo ? new Date(dateTo) : null;
      
      dateRangeFilter = (session) => {
        const createdAt = session.createdAt ? new Date(session.createdAt) : null;
        if (!createdAt) return false;
        
        if (dateFromObj && createdAt < dateFromObj) return false;
        if (dateToObj && createdAt > dateToObj) return false;
        return true;
      };
    }

    // Message count range filter
    if (messageCountMin || messageCountMax) {
      const minCount = messageCountMin ? parseInt(messageCountMin) : null;
      const maxCount = messageCountMax ? parseInt(messageCountMax) : null;
      
      messageCountFilter = (session) => {
        const count = session.messageCount || 0;
        if (minCount !== null && count < minCount) return false;
        if (maxCount !== null && count > maxCount) return false;
        return true;
      };
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOptions = {};
    const validSortFields = ['createdAt', 'updatedAt', 'lastMessageAt', 'title', 'messageCount', 'language'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'updatedAt';  // Default to updatedAt
    sortOptions[sortField] = sortOrder === 'asc' ? 1 : -1;

    // Get all sessions using SecureDataAccess (required by security policy)
    const context = getSecureContext(req, userId);
    
    console.log('[CHAT SESSIONS] Query:', JSON.stringify(query));
    console.log('[CHAT SESSIONS] Context:', JSON.stringify({
      serviceId: context.serviceId,
      hasApiKey: !!context.apiKey,
      practiceId: context.practiceId,
      userId: context.userId
    }));
    
    // Log the actual practiceId being used
    console.log('[CHAT SESSIONS] Practice details:', {
      subdomain: req.practiceSubdomain,
      practiceId: req.practice?._id,
      clinicIdType: typeof req.practice?._id,
      reqClinicId: req.practiceId
    });
    
    const allSessions = await SecureDataAccess.query('chat_sessions', query, {}, context);
    
    console.log('[CHAT SESSIONS] Found', allSessions.length, 'sessions from database');
    console.log('[CHAT SESSIONS] First 3 sessions:', allSessions.slice(0, 3).map(s => ({
      sessionId: s.sessionId,
      userId: s.userId,
      title: s.title
    })));
    
    // Apply filters
    let filteredSessions = allSessions;
    
    if (searchFilter) {
      filteredSessions = filteredSessions.filter(searchFilter);
    }
    if (dateRangeFilter) {
      filteredSessions = filteredSessions.filter(dateRangeFilter);
    }
    if (messageCountFilter) {
      filteredSessions = filteredSessions.filter(messageCountFilter);
    }
    
    // Sort sessions
    filteredSessions.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
    });
    
    // Get total count and apply pagination
    const totalCount = filteredSessions.length;
    const sessions = filteredSessions.slice(skip, skip + limitNum);
    
    const [sessionsData] = await Promise.all([Promise.resolve(sessions),
      Promise.resolve(totalCount)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Log session info (suppressed in quiet mode)
    if (secureConfigService.get('QUIET_LOGS') !== 'true' && secureConfigService.get('NODE_ENV') !== 'test') {
      if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [CHAT] Found ${sessions.length}/${totalCount} sessions for user: ${userId}`);
    }

    res.json({
      success: true,
      data: sessions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      },
      filters: {
        search,
        language,
        isActive,
        dateFrom,
        dateTo,
        messageCountMin,
        messageCountMax,
        sortBy: sortField,
        sortOrder,
        searchFields
      }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error getting sessions:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to retrieve chat sessions',
        he: 'נכשל בטעינת היסטוריית השיחות'
      },
      error: error.message
    });
  }
});

// POST /api/chat/sessions - Create new chat session
router.post('/sessions', auditLogger('CREATE', 'CHAT_SESSION'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId: providedSessionId, title, language = 'en' } = req.body;

    // Use provided sessionId if available, otherwise generate new one
    const sessionId = providedSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`🆕 [CHAT] Creating new session for user: ${userId}, sessionId: ${sessionId}`);

    // Security context for SecureDataAccess
    const context = {
      serviceId: 'chat-service',
      userId: userId || req.user?.id || 'anonymous',
      apiKey: req.chatServiceAuth.apiKey,
      practiceId: req.practiceSubdomain || req.practice?.subdomain,
      operation: 'create-session'
    };

    // Check if session already exists
    const existingSessions = await SecureDataAccess.query('chat_sessions', { sessionId }, {}, context);
    if (existingSessions && existingSessions.length > 0) {
      const existingSession = existingSessions[0];
      // Session already exists, just return it
      process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`✅ [CHAT] Session already exists: ${sessionId}`);
      return res.status(200).json({
        success: true,
        data: {
          sessionId: existingSession.sessionId,
          title: existingSession.title,
          language: existingSession.language,
          createdAt: existingSession.createdAt,
          created: false // Indicate this is an existing session
        }
      });
    }

    // Keep original language - the text index is configured with language_override: 'none'
    const mongoLanguage = language || 'en';

    const sessionData = {
      userId,
      sessionId,
      title: title || `${language === 'he' ? 'שיחה חדשה' : 'New Chat'} ${new Date().toLocaleDateString()}`,
      language: mongoLanguage,  // Use mapped language value
      createdAt: new Date(),
      isActive: true,
      messageCount: 0
    };

    const insertResult = await SecureDataAccess.insert('chat_sessions', sessionData, context);
    
    // SecureDataAccess.insert returns MongoDB result, not the document
    // Use the original sessionData which has all the fields we need
    const session = { ...sessionData, _id: insertResult.insertedId };

    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`✅ [CHAT] Created session: ${sessionId}`);

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.sessionId,
        title: session.title,
        language: session.language,
        createdAt: session.createdAt,
        created: true // Indicate this is a newly created session
      }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat session',
      error: error.message
    });
  }
});

// GET /api/chat/sessions/:sessionId - Get single session info
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    
    if (process.env.QUIET_LOGS !== 'true') console.log(`📝 [CHAT] Getting session info: ${sessionId}, user: ${userId}`);
    
    // Security context for SecureDataAccess
    const context = {
      serviceId: 'chat-service',
      userId: userId || req.user?.id || 'anonymous',
      apiKey: req.chatServiceAuth.apiKey,
      practiceId: req.practiceSubdomain || req.practice?.subdomain,
      operation: 'create-session'
    };
    
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, {}, context);

    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    const session = sessions[0];

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        title: session.title,
        language: session.language,
        messageCount: session.messageCount,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastMessageAt: session.lastMessageAt,
        artifactState: session.artifactState || null
      }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error getting session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve session',
      error: error.message
    });
  }
});

// GET /api/chat/sessions/:sessionId/messages - Get session messages
router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`💬 [CHAT] Getting messages for session: ${sessionId}, user: ${userId}`);
    
    // Verify session belongs to user using SecureDataAccess
    const context = getSecureContext(req, userId);
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, {}, context);
    
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }
    
    const session = sessions[0]; // Get the session object
    
    // Get messages using SecureDataAccess
    // CRITICAL: Sort by _id (ObjectId) to maintain proper insertion order
    // _id preserves insertion order reliably, unlike createdAt which may be missing/inconsistent
    let messages = await SecureDataAccess.query('chat_messages',
      { sessionId },
      { limit, sort: { _id: 1 } },  // Use _id for reliable insertion-order sorting
      context
    );

    // Messages are already sorted by _id (insertion order) from the query above
    // Keep them in chronological order - DO NOT reorder by type
    // The parallel/interleaved format requires chronological order:
    // User → Thinking #1 → Thinking #2 → Agent Response → Thinking #3 → etc.

    // Debug: Check if attachments are being retrieved from database
    const messagesWithAttachments = messages.filter(m => m.attachments && m.attachments.length > 0);
    if (process.env.QUIET_LOGS !== 'true') console.log(`📎 Retrieved ${messagesWithAttachments.length} messages with attachments out of ${messages.length} total messages`);

    // Encryption service is initialized in server.js
    
    // Decrypt messages before sending to client
    const decryptedMessages = await Promise.all(messages.map(async (msg) => {
      try {
        // Convert to plain object if it's a Mongoose document
        const msgObj = msg.toObject ? msg.toObject() : msg;
        
        // Check if content is encrypted (has encryption metadata)
        let finalMsg = msgObj;
        if (msgObj.content && typeof msgObj.content === 'object' &&
            (msgObj.content.encrypted || msgObj.content.iv)) {
          try {
            const decrypted = await encryptionService.decrypt(msgObj.content);
            finalMsg = {
              ...msgObj,
              content: decrypted
            };
          } catch (decryptError) {
            console.error(`Failed to decrypt message ${msgObj.messageId}:`, decryptError.message);
            finalMsg = {
              ...msgObj,
              content: msgObj.content.encrypted ? '[Encrypted content]' : msgObj.content
            };
          }
        }

        // Parse displayData and actionResult if they are JSON strings
        if (finalMsg.displayData && typeof finalMsg.displayData === 'string') {
          try {
            finalMsg.displayData = JSON.parse(finalMsg.displayData);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }

        if (finalMsg.actionResult && typeof finalMsg.actionResult === 'string') {
          try {
            finalMsg.actionResult = JSON.parse(finalMsg.actionResult);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }

        // CRITICAL: Parse categoryGrids for grid persistence in old conversations
        if (finalMsg.categoryGrids && typeof finalMsg.categoryGrids === 'string') {
          try {
            finalMsg.categoryGrids = JSON.parse(finalMsg.categoryGrids);
          } catch (e) {
            console.error(`Failed to parse categoryGrids for message ${finalMsg.messageId}:`, e.message);
            // Keep as string if parsing fails
          }
        }

        // CRITICAL: Parse artifactPanel for artifact panel display
        if (finalMsg.artifactPanel && typeof finalMsg.artifactPanel === 'string') {
          try {
            finalMsg.artifactPanel = JSON.parse(finalMsg.artifactPanel);
          } catch (e) {
            console.error(`Failed to parse artifactPanel for message ${finalMsg.messageId}:`, e.message);
            // Keep as string if parsing fails
          }
        }

        return finalMsg;
      } catch (error) {
        secureConfigService.get('NODE_ENV') !== 'production' && console.error('Failed to decrypt message:', error.message);
        // Convert to plain object safely
        const msgObj = msg.toObject ? msg.toObject() : msg;
        return {
          ...msgObj,
          content: '[Encrypted content - decryption failed]'
        };
      }
    }));
    
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`✅ [CHAT] Found ${messages.length} messages for session: ${sessionId}`);

    // DEBUG: Log ALL messages with sequence numbers to verify ordering
    if (process.env.QUIET_LOGS !== 'true') console.log(`📊 [DEBUG] Message order from DB (by sequenceNumber):`, messages.map(m => ({
      seq: m.sequenceNumber,
      type: m.type,
      isThinking: m.isThinking,
      contentPreview: typeof m.content === 'string' ? m.content.substring(0, 30) : (m.content ? JSON.stringify(m.content).substring(0, 30) : '(empty)')
    })));

    // DEBUG: Log thinking messages being returned with FULL details
    const thinkingMessages = decryptedMessages.filter(m => m.isThinking);
    if (process.env.QUIET_LOGS !== 'true') console.log(`🧠 [DEBUG] Returning ${thinkingMessages.length} thinking messages out of ${decryptedMessages.length} total`);
    if (process.env.QUIET_LOGS !== 'true') console.log(`🧠 [DEBUG] FINAL order (decrypted):`, decryptedMessages.map((m, idx) => ({
      idx,
      seq: m.sequenceNumber,
      type: m.type,
      isThinking: m.isThinking,
      id: m.messageId
    })));
    if (thinkingMessages.length > 0) {
      if (process.env.QUIET_LOGS !== 'true') console.log(`🧠 Thinking messages:`, thinkingMessages.map(m => ({ id: m.messageId, isThinking: m.isThinking, content: m.content?.substring(0, 50) })));
    }

    res.json({
      success: true,
      data: {
        sessionId,
        sessionTitle: session.title,
        messages: decryptedMessages,
        messageCount: messages.length
      }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error getting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages',
      error: error.message
    });
  }
});

// POST /api/chat/sessions/:sessionId/messages - Save new message
router.post('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const {
      type,
      content,
      language,
      actionTaken,
      actionResult,
      processingTime,
      displayData,
      displayType,
      artifactPanel,   // CRITICAL: Include artifactPanel for artifact display
      categoryGrids,
      patientId,      // For medical categories card
      patientName,    // For medical categories card
      metadata,
      isServiceMessage,
      isError,
      requiresAction,
      isThinking,     // CRITICAL: Thinking messages for chain of thoughts
      usedFallback,
      fallbackProvider,
      functionCall,
      functionResult,
      costInfo,
      backgroundProcessing,  // CRITICAL: Background processing messages (document analysis)
      batchId         // CRITICAL: Batch ID for tracking background analysis
    } = req.body;
    
    process.env.QUIET_LOGS !== 'true' && process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`💾 [CHAT] Saving message to session: ${sessionId}, type: ${type}, isThinking: ${isThinking}, backgroundProcessing: ${backgroundProcessing}, batchId: ${batchId}`);
    
    // Verify session belongs to user using SecureDataAccess
    const context = getSecureContext(req, userId);
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, {}, context);
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }
    const session = sessions[0];
    
    // Get next sequence number by querying existing messages
    // CRITICAL: Respect sequenceNumber passed from frontend (for thinking messages that should appear before response)
    let sequenceNumber;
    if (metadata && metadata.sequenceNumber !== undefined) {
      // Frontend explicitly set sequenceNumber (e.g., thinking messages with seq=1)
      sequenceNumber = metadata.sequenceNumber;
      if (process.env.QUIET_LOGS !== 'true') console.log(`📝 [SEQ] Using frontend sequenceNumber: ${sequenceNumber} for type: ${type}, isThinking: ${isThinking}`);
    } else {
      // Auto-calculate next sequence number
      const existingMessages = await SecureDataAccess.query('chat_messages', { sessionId }, { sort: { sequenceNumber: -1 }, limit: 1 }, context);
      sequenceNumber = (existingMessages && existingMessages.length > 0 && existingMessages[0].sequenceNumber) ? existingMessages[0].sequenceNumber + 1 : 1;
      if (process.env.QUIET_LOGS !== 'true') console.log(`📝 [SEQ] Auto-assigned seq ${sequenceNumber} to message type: ${type}, isThinking: ${isThinking}`);
    }
    
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Map language codes to MongoDB-supported values
    const mongoLanguage = (language || session.language) === 'he' ? 'none' : (language || session.language || 'en');

    // Encryption service is initialized in server.js

    // Validate content before saving
    if (!content || (typeof content === 'object' && Object.keys(content).length === 0)) {
      // Skip saving empty messages
      console.log(`⚠️ [CHAT] Skipping empty message for session: ${sessionId}`);
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty'
      });
    }

    // Encrypt message content for PHI protection
    const encryptedContent = await encryptionService.encrypt(content, 'phi');
    
    const messageData = {
      sessionId,
      userId,
      messageId,
      type,
      content: encryptedContent, // Store encrypted content
      language: mongoLanguage,
      actionTaken,
      actionResult,
      processingTime,
      // Add display data for medical grid
      displayData,
      displayType,
      artifactPanel,  // Add artifactPanel for artifact panel display (Claude.ai-style split-screen)
      categoryGrids,  // Add categoryGrids for multi-category grid persistence
      patientId,      // For medical categories card - needed for API calls
      patientName,    // For medical categories card - for display
      metadata,
      isServiceMessage,
      isError,
      requiresAction,
      isThinking,     // CRITICAL: Save thinking flag for chain of thoughts persistence
      usedFallback,
      fallbackProvider,
      functionCall,
      functionResult,
      costInfo,
      backgroundProcessing,  // CRITICAL: Flag for background processing messages (document analysis)
      batchId,        // CRITICAL: Batch ID for tracking background analysis
      sequenceNumber,
      createdAt: new Date()
    };

    const insertResult = await SecureDataAccess.insert('chat_messages', messageData, context);

    // DEBUG: Log what was actually saved
    if (isThinking) {
      if (process.env.QUIET_LOGS !== 'true') console.log(`💾 [DEBUG] SAVED THINKING MESSAGE: ${messageId}`);
      if (process.env.QUIET_LOGS !== 'true') console.log(`💾 [DEBUG] Message object has isThinking:`, 'isThinking' in messageData, messageData.isThinking);
    }

    // Update session activity - increment message count
    const updateData = {
      $inc: { messageCount: 1 },
      $set: {
        lastMessageAt: new Date(),
        updatedAt: new Date()
      }
    };
    await SecureDataAccess.update('chat_sessions', { sessionId }, updateData, context);

    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`✅ [CHAT] Saved message: ${messageId}, sequence: ${sequenceNumber}, isThinking: ${isThinking}`);

    res.status(201).json({
      success: true,
      data: {
        _id: insertResult.insertedId, // Return database ID so frontend can delete later
        messageId: messageData.messageId,
        sequenceNumber: messageData.sequenceNumber,
        createdAt: messageData.createdAt
      }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error saving message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save message',
      error: error.message
    });
  }
});

// POST /api/chat/sessions/:sessionId/messages/batch - Save multiple messages in one transaction
router.post('/sessions/:sessionId/messages/batch', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Messages array is required and must not be empty'
      });
    }

    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`💾 [CHAT BATCH] Saving ${messages.length} messages to session: ${sessionId}`);

    // Security context for SecureDataAccess
    const context = getSecureContext(req, userId);

    // Verify session belongs to user
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, {}, context);
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }
    const session = sessions[0];

    // Get starting sequence number
    const existingMessages = await SecureDataAccess.query('chat_messages', { sessionId }, { sort: { sequenceNumber: -1 }, limit: 1 }, context);
    let sequenceNumber = (existingMessages && existingMessages.length > 0 && existingMessages[0].sequenceNumber) ? existingMessages[0].sequenceNumber + 1 : 1;

    // Map language codes to MongoDB-supported values
    const mongoLanguage = (messages[0].language || session.language) === 'he' ? 'none' : (messages[0].language || session.language || 'en');

    // Insert all messages sequentially (ensures proper sequence numbering)
    const insertedIds = [];
    for (const msg of messages) {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Encrypt message content
      const encryptedContent = await encryptionService.encrypt(msg.content, 'phi');

      const messageData = {
        sessionId,
        userId,
        messageId,
        type: msg.type,
        content: encryptedContent,
        language: mongoLanguage,
        metadata: msg.metadata,
        isThinking: msg.metadata?.isThinking || false,
        sequenceNumber: sequenceNumber++,  // Assign incrementing sequence numbers
        createdAt: new Date()
      };

      const insertResult = await SecureDataAccess.insert('chat_messages', messageData, context);
      insertedIds.push(insertResult.insertedId);
    }

    // Update session activity - increment message count by number of messages
    const updateData = {
      $inc: { messageCount: messages.length },
      $set: {
        lastMessageAt: new Date(),
        updatedAt: new Date()
      }
    };
    await SecureDataAccess.update('chat_sessions', { sessionId }, updateData, context);

    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`✅ [CHAT BATCH] Saved ${messages.length} messages successfully`);

    res.status(201).json({
      success: true,
      data: {
        insertedCount: insertedIds.length,
        insertedIds: insertedIds
      }
    });
  } catch (error) {
    console.error('❌ [CHAT BATCH] Error saving messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save messages',
      error: error.message
    });
  }
});

// POST /api/chat/sessions/:sessionId/messages/delete-by-metadata - Delete message by metadata (for old messages with client IDs)
router.post('/sessions/:sessionId/messages/delete-by-metadata', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const { metadata } = req.body;

    if (!metadata) {
      return res.status(400).json({
        success: false,
        message: 'Metadata is required'
      });
    }

    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`🗑️ [CHAT] Deleting message by metadata in session: ${sessionId}`);

    // Security context for SecureDataAccess
    const context = getSecureContext(req, userId);

    // Verify session belongs to user
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, {}, context);
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Find and delete message with matching metadata
    const deleteFilter = {
      sessionId,
      ...Object.keys(metadata).reduce((acc, key) => {
        acc[`metadata.${key}`] = metadata[key];
        return acc;
      }, {})
    };

    const deleteResult = await SecureDataAccess.delete('chat_messages', deleteFilter, context, { hardDelete: true });

    if (deleteResult.deletedCount > 0) {
      // Update session message count
      const updateData = {
        $inc: { messageCount: -deleteResult.deletedCount },
        $set: { updatedAt: new Date() }
      };
      await SecureDataAccess.update('chat_sessions', { sessionId }, updateData, context);

      process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`✅ [CHAT] Deleted ${deleteResult.deletedCount} message(s) by metadata`);

      res.json({
        success: true,
        message: 'Message deleted successfully',
        deletedCount: deleteResult.deletedCount
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Message not found with provided metadata'
      });
    }
  } catch (error) {
    console.error('❌ [CHAT] Error deleting message by metadata:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

// DELETE /api/chat/sessions/:sessionId - Delete a session and its messages (HARD DELETE)
router.delete('/sessions/:sessionId', auditLogger('DELETE', 'CHAT_SESSION'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`🗑️ [CHAT] Deleting session: ${sessionId}`);
    
    // Security context for SecureDataAccess
    const context = getSecureContext(req, userId);
    
    // Verify session belongs to user
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, {}, context);
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    // Delete all messages for this session (hard delete - not medical records)
    await SecureDataAccess.delete('chat_messages', { sessionId }, context, { hardDelete: true });
    
    // Delete the session itself (hard delete - not medical records)
    await SecureDataAccess.delete('chat_sessions', { sessionId, userId }, context, { hardDelete: true });
    
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`✅ [CHAT] Deleted session: ${sessionId}`);
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('❌ [CHAT] Error deleting session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete session',
      error: error.message
    });
  }
});

// PUT /api/chat/sessions/:sessionId/title - Update session title
router.put('/sessions/:sessionId/title', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    let { title } = req.body;

    // Ensure title is a string
    if (typeof title !== 'string') {
      title = String(title || 'Chat');
    }

    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`✏️ [CHAT] Updating title for session: ${sessionId}`);

    // Use SecureDataAccess to update session
    const context = getSecureContext(req, userId);
    const updateData = {
      $set: {
        title,
        updatedAt: new Date()
      }
    };
    
    // First check if session exists
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, {}, context);
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }
    
    // Update the session
    await SecureDataAccess.update('chat_sessions', { sessionId, userId }, updateData, context);
    
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && console.log(`✅ [CHAT] Updated title for session: ${sessionId}`);
    
    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        title: title,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error updating title:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update session title',
      error: error.message
    });
  }
});

// PUT /api/chat/sessions/:sessionId/artifact-state - Update artifact panel state
router.put('/sessions/:sessionId/artifact-state', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const { artifactState } = req.body;

    // Use SecureDataAccess to update session
    const context = getSecureContext(req, userId);
    const updateData = {
      $set: {
        artifactState: artifactState || null,
        updatedAt: new Date()
      }
    };

    // First check if session exists
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, {}, context);
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Update the session
    await SecureDataAccess.update('chat_sessions', { sessionId, userId }, updateData, context);

    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        artifactState: artifactState,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error updating artifact state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update artifact state',
      error: error.message
    });
  }
});

// PATCH /api/chat/sessions/bulk - Bulk update sessions
router.patch('/sessions/bulk', auditLogger('BULK_UPDATE', 'CHAT_SESSION'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionIds, updates } = req.body;

    // Validation
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Session IDs array is required and cannot be empty',
          he: 'נדרש מערך מזהי שיחות ולא יכול להיות ריק'
        }
      });
    }

    if (sessionIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Cannot update more than 50 sessions at once',
          he: 'לא ניתן לעדכן יותר מ-50 שיחות בבת אחת'
        }
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Updates object is required',
          he: 'נדרש אובייקט עדכונים'
        }
      });
    }

    // Define allowed fields for bulk update based on user role
    const userRole = req.user?.role || 'doctor';
    const allowedFields = ['title', 'language', 'isActive', 'summary'];

    // Filter updates to only allowed fields
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'No valid fields to update',
          he: 'אין שדות תקינים לעדכון'
        }
      });
    }

    console.log(`🔄 [CHAT] Bulk updating ${sessionIds.length} sessions for user: ${userId}`, filteredUpdates);

    // Create context for SecureDataAccess
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'bulk-update-sessions',
      practiceId: req.practiceSubdomain || 'global'
    };

    // Verify all sessions belong to the user
    const existingSessions = await SecureDataAccess.query('chat_sessions', {
      sessionId: { $in: sessionIds },
      userId
    }, {}, context);

    if (existingSessions.length !== sessionIds.length) {
      const foundIds = existingSessions.map(s => s.sessionId);
      const notFoundIds = sessionIds.filter(id => !foundIds.includes(id));

      return res.status(404).json({
        success: false,
        message: {
          en: `Sessions not found: ${notFoundIds.join(', ')}`,
          he: `שיחות לא נמצאו: ${notFoundIds.join(', ')}`
        }
      });
    }

    // Perform bulk update
    const updateData = { $set: { ...filteredUpdates, updatedAt: new Date() } };
    const result = await SecureDataAccess.update('chat_sessions', 
      { sessionId: { $in: sessionIds }, userId },
      updateData,
      context
    );
    // SecureDataAccess returns updated document, simulate MongoDB result format
    const modifiedCount = result ? sessionIds.length : 0;

    if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [CHAT] Bulk updated ${modifiedCount} sessions`);

    res.json({
      success: true,
      message: {
        en: `Successfully updated ${result.modifiedCount} sessions`,
        he: `עודכנו בהצלחה ${result.modifiedCount} שיחות`
      },
      data: {
        requestedCount: sessionIds.length,
        modifiedCount: modifiedCount,
        updates: filteredUpdates
      }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error in bulk update:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to update sessions',
        he: 'נכשל בעדכון השיחות'
      },
      error: error.message
    });
  }
});

// DELETE /api/chat/sessions/bulk - Bulk delete sessions
router.delete('/sessions/bulk', auditLogger('BULK_DELETE', 'CHAT_SESSION'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionIds } = req.body;

    // Validation
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Session IDs array is required and cannot be empty',
          he: 'נדרש מערך מזהי שיחות ולא יכול להיות ריק'
        }
      });
    }

    if (sessionIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Cannot delete more than 50 sessions at once',
          he: 'לא ניתן למחוק יותר מ-50 שיחות בבת אחת'
        }
      });
    }

    console.log(`🗑️ [CHAT] Bulk deleting ${sessionIds.length} sessions for user: ${userId}`);

    // Create context for SecureDataAccess
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'bulk-delete-sessions',
      practiceId: req.practiceSubdomain || 'global'
    };

    // Verify all sessions belong to the user
    const existingSessions = await SecureDataAccess.query('chat_sessions', {
      sessionId: { $in: sessionIds },
      userId
    }, {}, context);

    if (existingSessions.length !== sessionIds.length) {
      const foundIds = existingSessions.map(s => s.sessionId);
      const notFoundIds = sessionIds.filter(id => !foundIds.includes(id));

      return res.status(404).json({
        success: false,
        message: {
          en: `Sessions not found: ${notFoundIds.join(', ')}`,
          he: `שיחות לא נמצאו: ${notFoundIds.join(', ')}`
        }
      });
    }

    // Perform bulk soft delete (mark as inactive)
    const updateData = { $set: { isActive: false, updatedAt: new Date() } };
    const result = await SecureDataAccess.update('chat_sessions',
      { sessionId: { $in: sessionIds }, userId },
      updateData,
      context
    );
    // SecureDataAccess returns updated document, simulate MongoDB result format
    const modifiedCount = result ? sessionIds.length : 0;

    if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [CHAT] Bulk deleted ${modifiedCount} sessions`);

    res.json({
      success: true,
      message: {
        en: `Successfully deleted ${result.modifiedCount} sessions`,
        he: `נמחקו בהצלחה ${result.modifiedCount} שיחות`
      },
      data: {
        requestedCount: sessionIds.length,
        deletedCount: modifiedCount
      }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error in bulk delete:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to delete sessions',
        he: 'נכשל במחיקת השיחות'
      },
      error: error.message
    });
  }
});

// REMOVED: Duplicate DELETE endpoint that was doing soft delete
// The first DELETE endpoint above does proper hard delete

// GET /api/chat/search - Search chat history (titles and content)
router.get('/search', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { q: query, type = 'all', limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    console.log(`🔍 [CHAT] Searching for user: ${userId}, query: "${query}", type: ${type}`);

    const results = {
      sessions: [],
      messages: [],
      totalResults: 0
    };

    // Create context for SecureDataAccess using the helper
    const context = getSecureContext(req, userId);
    
    // Search in session titles and summaries
    if (type === 'all' || type === 'sessions') {
      const searchRegex = new RegExp(query.trim(), 'i');
      const sessionResults = await SecureDataAccess.query('chat_sessions', {
        userId,
        $or: [
          { title: searchRegex },
          { summary: searchRegex }
        ]
      }, { limit: parseInt(limit) }, context);
      results.sessions = sessionResults;
      console.log(`📋 [CHAT] Found ${sessionResults.length} matching sessions`);
    }

    // Search in message content
    if (type === 'all' || type === 'messages') {
      const searchRegex = new RegExp(query.trim(), 'i');
      const messageResults = await SecureDataAccess.query('chat_messages', {
        userId,
        content: searchRegex
      }, { limit: parseInt(limit) }, context);
      results.messages = messageResults;
      if (process.env.QUIET_LOGS !== 'true') console.log(`💬 [CHAT] Found ${messageResults.length} matching messages`);
    }

    results.totalResults = results.sessions.length + results.messages.length;

    if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [CHAT] Search completed. Total results: ${results.totalResults}`);

    res.json({
      success: true,
      data: results,
      query,
      searchType: type
    });
  } catch (error) {
    console.error('❌ [CHAT] Error searching:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search chat history',
      error: error.message
    });
  }
});

// GET /api/chat/sessions/:sessionId/search - Search within specific session
router.get('/sessions/:sessionId/search', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const { q: query, limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Search query must be at least 2 characters long',
          he: 'שאילתת החיפוש חייבת להכיל לפחות 2 תווים'
        }
      });
    }

    console.log(`🔍 [CHAT] Searching in session: ${sessionId}, query: "${query}"`);

    // Create context for SecureDataAccess using the helper
    const context = getSecureContext(req, userId);

    // Verify session belongs to user
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, { limit: 1 }, context);
    const session = sessions[0];
    if (!session) {
      return res.status(404).json({
        success: false,
        message: {
          en: 'Chat session not found',
          he: 'שיחה לא נמצאה'
        }
      });
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    const messages = await SecureDataAccess.query('chat_messages', {
      sessionId,
      content: searchRegex
    }, { limit: parseInt(limit) }, context);

    if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [CHAT] Found ${messages.length} matching messages in session: ${sessionId}`);

    res.json({
      success: true,
      data: {
        sessionId,
        sessionTitle: session.title,
        messages,
        resultCount: messages.length
      },
      query
    });
  } catch (error) {
    console.error('❌ [CHAT] Error searching in session:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to search in session',
        he: 'נכשל בחיפוש בשיחה'
      },
      error: error.message
    });
  }
});

// GET /api/chat/analytics - Chat analytics and statistics
router.get('/analytics', async (req, res) => {
  try {
    const userId = getUserId(req);
    const {
      dateFrom = '',
      dateTo = '',
      groupBy = 'month' // day, week, month, year
    } = req.query;

    console.log(`📊 [CHAT] Generating analytics for user: ${userId}`);

    // Create context for SecureDataAccess
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'generate-analytics',
      practiceId: req.practiceSubdomain || 'global'
    };

    // Build date filter
    const dateFilter = { userId };
    let dateRangeFilter = null;
    if (dateFrom || dateTo) {
      const dateFromObj = dateFrom ? new Date(dateFrom) : null;
      const dateToObj = dateTo ? new Date(dateTo) : null;
      
      dateRangeFilter = (session) => {
        const createdAt = session.createdAt ? new Date(session.createdAt) : null;
        if (!createdAt) return false;
        
        if (dateFromObj && createdAt < dateFromObj) return false;
        if (dateToObj && createdAt > dateToObj) return false;
        return true;
      };
    }

    // Get all sessions and process analytics in JavaScript
    const allSessions = await SecureDataAccess.query('chat_sessions', dateFilter, {}, context);
    
    // Apply date filter if specified
    const sessions = dateRangeFilter ? allSessions.filter(dateRangeFilter) : allSessions;
    
    // Calculate analytics
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.isActive).length;
    
    // Language distribution
    const languageMap = new Map();
    sessions.forEach(session => {
      const lang = session.language || 'unknown';
      languageMap.set(lang, (languageMap.get(lang) || 0) + 1);
    });
    const languageDistribution = Array.from(languageMap.entries())
      .map(([language, count]) => ({ _id: language, count }))
      .sort((a, b) => b.count - a.count);
    
    // Message count statistics
    const messageCounts = sessions.map(s => s.messageCount || 0);
    const totalMessages = messageCounts.reduce((sum, count) => sum + count, 0);
    const avgMessages = totalMessages / Math.max(totalSessions, 1);
    const minMessages = messageCounts.length > 0 ? Math.min(...messageCounts) : 0;
    const maxMessages = messageCounts.length > 0 ? Math.max(...messageCounts) : 0;
    const messageCountStats = [{
      avgMessages,
      minMessages,
      maxMessages,
      totalMessages
    }];
    
    // Session creation trends
    const trendsMap = new Map();
    sessions.forEach(session => {
      if (!session.createdAt) return;
      
      const date = new Date(session.createdAt);
      let key;
      if (groupBy === 'day') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const year = date.getFullYear();
        const week = Math.ceil(((date - new Date(year, 0, 1)) / 86400000 + 1) / 7);
        key = `${year}-${String(week).padStart(2, '0')}`;
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = String(date.getFullYear());
      }
      
      const existing = trendsMap.get(key) || { count: 0, totalMessages: 0 };
      trendsMap.set(key, {
        count: existing.count + 1,
        totalMessages: existing.totalMessages + (session.messageCount || 0)
      });
    });
    const sessionTrends = Array.from(trendsMap.entries())
      .map(([period, data]) => ({ _id: period, ...data }))
      .sort((a, b) => a._id.localeCompare(b._id));
    
    // Top sessions by message count
    const topSessions = sessions
      .sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
      .slice(0, 10)
      .map(s => ({
        sessionId: s.sessionId,
        title: s.title,
        messageCount: s.messageCount,
        language: s.language,
        createdAt: s.createdAt
      }));

    const analytics = {
      summary: {
        totalSessions,
        activeSessions,
        inactiveSessions: totalSessions - activeSessions,
        totalMessages: messageCountStats[0]?.totalMessages || 0,
        avgMessagesPerSession: Math.round((messageCountStats[0]?.avgMessages || 0) * 100) / 100,
        minMessagesPerSession: messageCountStats[0]?.minMessages || 0,
        maxMessagesPerSession: messageCountStats[0]?.maxMessages || 0
      },
      languageDistribution: languageDistribution.map(item => ({
        language: item._id || 'unknown',
        count: item.count,
        percentage: Math.round((item.count / totalSessions) * 100 * 100) / 100
      })),
      trends: sessionTrends.map(item => ({
        period: item._id,
        sessionCount: item.count,
        messageCount: item.totalMessages,
        avgMessagesPerSession: Math.round((item.totalMessages / item.count) * 100) / 100
      })),
      topSessions: topSessions.map(session => ({
        sessionId: session.sessionId,
        title: session.title,
        messageCount: session.messageCount,
        language: session.language,
        createdAt: session.createdAt
      }))
    };

    if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [CHAT] Analytics generated for user: ${userId}`, {
      totalSessions: analytics.summary.totalSessions,
      totalMessages: analytics.summary.totalMessages
    });

    res.json({
      success: true,
      data: analytics,
      filters: {
        dateFrom,
        dateTo,
        groupBy
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [CHAT] Error generating analytics:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to generate chat analytics',
        he: 'נכשל ביצירת ניתוח נתוני השיחות'
      },
      error: error.message
    });
  }
});

// GET /api/chat/export - Export chat data
router.get('/export', async (req, res) => {
  try {
    const userId = getUserId(req);
    const {
      format = 'csv',
      fields = 'sessionId,title,language,messageCount,isActive,createdAt,updatedAt',
      search = '',
      language = '',
      isActive = '',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    console.log(`📤 [CHAT] Exporting chat data for user: ${userId}, format: ${format}`);

    // Create context for SecureDataAccess
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'export-chat-data',
      practiceId: req.practiceSubdomain || 'global'
    };

    // Build query (reuse logic from sessions list)
    const query = { userId };

    // Get all sessions first
    let allSessions = await SecureDataAccess.query('chat_sessions', query, { sort: { createdAt: -1 } }, context);
    
    // Apply filters in JavaScript
    let sessions = allSessions;
    
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      sessions = sessions.filter(session => 
        (session.title && searchRegex.test(session.title)) ||
        (session.summary && searchRegex.test(session.summary))
      );
    }

    if (language) {
      sessions = sessions.filter(session => session.language === language);
    }
    
    if (isActive !== '') {
      const activeFilter = isActive === 'true';
      sessions = sessions.filter(session => session.isActive === activeFilter);
    }

    if (dateFrom || dateTo) {
      const dateFromObj = dateFrom ? new Date(dateFrom) : null;
      const dateToObj = dateTo ? new Date(dateTo) : null;
      
      sessions = sessions.filter(session => {
        const createdAt = session.createdAt ? new Date(session.createdAt) : null;
        if (!createdAt) return false;
        
        if (dateFromObj && createdAt < dateFromObj) return false;
        if (dateToObj && createdAt > dateToObj) return false;
        return true;
      });
    }

    // Parse requested fields
    const requestedFields = fields.split(',').map(f => f.trim());
    const validFields = ['sessionId', 'title', 'language', 'messageCount', 'isActive', 'createdAt', 'updatedAt', 'lastMessageAt', 'summary'];
    const exportFields = requestedFields.filter(field => validFields.includes(field));

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = exportFields.join(',');
      const csvRows = sessions.map(session => {
        return exportFields.map(field => {
          let value = session[field];
          if (value instanceof Date) {
            value = value.toISOString();
          } else if (typeof value === 'string' && value.includes(',')) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',');
      });

      const csvContent = [csvHeaders, ...csvRows].join('\n');
      const filename = `chat_sessions_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } else {
      // JSON format
      const exportData = sessions.map(session => {
        const filtered = {};
        exportFields.forEach(field => {
          filtered[field] = session[field];
        });
        return filtered;
      });

      res.json({
        success: true,
        data: exportData,
        meta: {
          totalRecords: sessions.length,
          exportedFields: exportFields,
          filters: { search, language, isActive, dateFrom, dateTo },
          exportedAt: new Date().toISOString()
        }
      });
    }

    if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [CHAT] Exported ${sessions.length} sessions for user: ${userId}`);
  } catch (error) {
    console.error('❌ [CHAT] Error exporting data:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to export chat data',
        he: 'נכשל בייצוא נתוני השיחות'
      },
      error: error.message
    });
  }
});

module.exports = router;
