const express = require('express');
const router = express.Router();
const authAIService = require('../services/authAIService');

// Store conversation sessions in memory (in production, use Redis)
const conversationSessions = new Map();

// Clean up old sessions every hour
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [sessionId, session] of conversationSessions.entries()) {
    if (session.lastActivity < oneHourAgo) {
      conversationSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

// Helper function to extract subdomain from request
function extractSubdomain(req) {
  // Method 1: Check if passed in request body
  if (req.body && req.body.subdomain) {
    return req.body.subdomain;
  }
  
  // Method 2: Extract from host header
  const host = req.get('host') || req.get('x-forwarded-host') || '';
  const hostParts = host.split('.');
  
  // Check for subdomain pattern (e.g., stanford.intellicare.health)
  if (hostParts.length >= 2) {
    const subdomain = hostParts[0];
    // Exclude common non-practice subdomains
    if (subdomain && !['www', 'api', 'admin', 'localhost', '127', 'intellicare'].includes(subdomain)) {
      return subdomain;
    }
  }
  
  // Method 3: Check Origin header for CORS requests
  const origin = req.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originParts = originUrl.hostname.split('.');
      if (originParts.length >= 2) {
        const subdomain = originParts[0];
        if (subdomain && !['www', 'api', 'admin', 'localhost', '127', 'intellicare'].includes(subdomain)) {
          return subdomain;
        }
      }
    } catch (error) {
      // Silent fail for URL parsing
    }
  }
  
  return null;
}

// @route   GET /api/auth-ai/chat-stream
// @desc    Stream chat responses using Server-Sent Events
// @access  Public
router.get('/chat-stream', async (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders(); // Send headers immediately

  try {
    // GET endpoint uses query parameters, not body
    const { message, language = 'en', sessionId, subdomain } = req.query;

    // Extract subdomain from request - check query params first for GET request
    const currentSubdomain = subdomain || extractSubdomain(req);
    if (currentSubdomain) {
      console.log(`🏥 [Auth AI Stream] Detected subdomain: ${currentSubdomain}`);
    }

    // Get or create session
    const session = sessionId && conversationSessions.has(sessionId)
      ? conversationSessions.get(sessionId)
      : {
          id: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conversationHistory: [],
          lastActivity: Date.now()
        };

    // Send initial acknowledgment
    res.write(`data: ${JSON.stringify({ type: 'start', sessionId: session.id })}\n\n`);

    console.log(`🔄 [Auth AI Stream] Processing: "${message.substring(0, 50)}..." (${language})`);

    // Process message with AI
    const result = await authAIService.processMessage(
      message,
      language,
      session.conversationHistory,
      currentSubdomain
    );

    // Stream the response in chunks to simulate real-time typing
    const fullMessage = result.message || '';
    const words = fullMessage.split(' ');
    let currentMessage = '';

    // Send message in chunks (faster for better UX)
    for (let i = 0; i < words.length; i++) {
      currentMessage += (i === 0 ? '' : ' ') + words[i];

      // Send chunk every few words for smoother streaming
      if (i % 3 === 0 || i === words.length - 1) {
        res.write(`data: ${JSON.stringify({
          type: 'chunk',
          content: currentMessage,
          isPartial: true
        })}\n\n`);

        // Small delay to simulate typing (20ms for smoother experience)
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // Send complete message with metadata
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      content: fullMessage,
      functionCalled: result.functionCalled,
      functionResult: result.functionResult,
      success: result.success,
      conversationComplete: result.conversationComplete,
      cacheStats: result.cacheStats
    })}\n\n`);

    // Update session history
    session.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.message }
    );
    session.lastActivity = Date.now();
    conversationSessions.set(session.id, session);

    // End the stream
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('❌ [Auth AI Stream] Error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'An error occurred while processing your message'
    })}\n\n`);
    res.end();
  }
});

// @route   POST /api/auth-ai/chat
// @desc    Process authentication chat with AI
// @access  Public
router.post('/chat', async (req, res) => {
  try {
    const { message, language = 'en', sessionId } = req.body;
    
    // Extract subdomain from request
    const currentSubdomain = extractSubdomain(req);
    if (currentSubdomain) {
      console.log(`🏥 [Auth AI Route] Detected subdomain: ${currentSubdomain}`);
    }
    
    // Get or create session
    const session = sessionId && conversationSessions.has(sessionId) 
      ? conversationSessions.get(sessionId)
      : { 
          id: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conversationHistory: [],
          lastActivity: Date.now()
        };
    
    console.log(`🔄 [Auth AI Route] Processing: "${message.substring(0, 50)}..." (${language})`);
    
    // Process message with AI, passing current subdomain
    const result = await authAIService.processMessage(
      message, 
      language, 
      session.conversationHistory,
      currentSubdomain  // Pass the extracted subdomain
    );
    
    console.log(`✅ [Auth AI Route] Response ready - Success: ${result.success}, Function: ${result.functionCalled || 'none'}`);
    
    // Check if service is overloaded
    if (!result.success && result.error === 'SERVICE_OVERLOADED') {
      // Return 503 Service Unavailable with retry information
      return res.status(503).json({
        success: false,
        message: result.message,
        sessionId: session.id,
        error: result.error,
        retryAfter: result.retryAfter || 60
      });
    }
    
    // Update session
    session.conversationHistory = result.conversationHistory || session.conversationHistory;
    session.lastActivity = Date.now();
    conversationSessions.set(session.id, session);
    
    // If OTP verification succeeded and session was created, set httpOnly cookie
    // This handles both email verification (practice creation) and login OTP verification
    if ((result.functionCalled === 'verifyEmailOTP' || result.functionCalled === 'verifyOTPCode') &&
        result.functionResult?.sessionToken) {

      console.log('🍪 [Auth AI] Setting session cookie for verified user');
      console.log('   Hostname:', req.hostname);
      console.log('   Token:', result.functionResult.sessionToken.substring(0, 10) + '...');

      // Cookie options - use max safe 32-bit integer (2147483647ms ≈ 24.8 days)
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',  // Allow cross-subdomain access
        maxAge: 2147483647  // ~24.8 days (maximum safe value)
      };

      // Only set domain for production (cross-subdomain sharing)
      if (req.hostname.includes('intellicare.health')) {
        cookieOptions.domain = '.intellicare.health';
        console.log('   Domain: .intellicare.health (production)');
      } else {
        console.log('   Domain: (not set - uses exact hostname for dev)');
      }

      // Set httpOnly cookie for security
      res.cookie('sessionToken', result.functionResult.sessionToken, cookieOptions);
    }

    // DEV MODE: Handle direct login with session creation
    if (result.functionCalled === 'loginUser' && result.functionResult?.devMode && result.functionResult?.sessionToken) {
      console.log('🍪 [DEV] Setting session cookies for dev-mode login');
      console.log('   Hostname:', req.hostname);
      console.log('   SessionToken:', result.functionResult.sessionToken.substring(0, 10) + '...');
      console.log('   CSRF Token:', result.functionResult.csrfToken ? result.functionResult.csrfToken.substring(0, 10) + '...' : 'none');
      console.log('   User:', result.functionResult.user?.email);

      // Max safe 32-bit integer: 2147483647ms ≈ 24.8 days
      const maxSafeMaxAge = 2147483647;

      // Cookie options for sessionToken
      const sessionCookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: maxSafeMaxAge  // ~24.8 days (maximum safe value)
      };

      // Cookie options for CSRF token
      const csrfCookieOptions = {
        httpOnly: false,  // Accessible to JavaScript for double-submit
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',  // Strict for CSRF protection
        maxAge: maxSafeMaxAge  // ~24.8 days (maximum safe value)
      };

      // Only set domain for production (cross-subdomain sharing)
      if (req.hostname.includes('intellicare.health')) {
        sessionCookieOptions.domain = '.intellicare.health';
        csrfCookieOptions.domain = '.intellicare.health';
        console.log('   Domain: .intellicare.health (production)');
      } else {
        console.log('   Domain: (not set - uses exact hostname for dev)');
      }

      // Set sessionToken cookie (httpOnly for security)
      res.cookie('sessionToken', result.functionResult.sessionToken, sessionCookieOptions);

      // Set CSRF token cookie (non-httpOnly for double-submit pattern)
      if (result.functionResult.csrfToken) {
        res.cookie('csrfToken', result.functionResult.csrfToken, csrfCookieOptions);
      }
    }
    
    // Handle translation objects in message before sending
    let responseMessage = result.message;
    if (typeof responseMessage === 'object' && responseMessage !== null && ('he' in responseMessage || 'en' in responseMessage)) {
      // Extract the appropriate language value
      responseMessage = responseMessage[language] || responseMessage.en || responseMessage.he || 'No message';
    }

    // Send response
    res.json({
      success: result.success,
      message: responseMessage,
      sessionId: session.id,
      functionCalled: result.functionCalled,
      functionResult: result.functionResult
    });
    
  } catch (error) {
    console.error('❌ Auth AI chat error:', error);
    res.status(500).json({
      success: false,
      message: req.body.language === 'he' 
        ? 'שגיאת שרת. אנא נסה שוב.'
        : 'Server error. Please try again.',
      error: error.message
    });
  }
});

// @route   GET /api/auth-ai/session/:sessionId
// @desc    Get session history
// @access  Public
router.get('/session/:sessionId', (req, res) => {
  const session = conversationSessions.get(req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }
  
  res.json({
    success: true,
    session: {
      id: session.id,
      messageCount: session.conversationHistory.length,
      lastActivity: session.lastActivity
    }
  });
});

// @route   DELETE /api/auth-ai/session/:sessionId
// @desc    Clear session
// @access  Public
router.delete('/session/:sessionId', (req, res) => {
  conversationSessions.delete(req.params.sessionId);
  
  res.json({
    success: true,
    message: 'Session cleared'
  });
});

// @route   GET /api/auth-ai/stats
// @desc    Get usage statistics and caching metrics
// @access  Public
router.get('/stats', (req, res) => {
  const stats = authAIService.getUsageStats();
  
  res.json({
    success: true,
    stats,
    sessionCount: conversationSessions.size,
    message: 'AI Authentication Statistics',
    costSavings: {
      promptCaching: 'Up to 90% cost reduction on cached prompts',
      responseCaching: '5-minute TTL for common queries',
      estimatedSavings: 'Reduces API calls by ~40% for typical usage'
    }
  });
});

// Get cache statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = authAIService.getUsageStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get statistics'
        });
    }
});

module.exports = router;