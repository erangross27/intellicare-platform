const express = require('express');
const router = express.Router();
const agentServiceOAuth = require('../services/agentServiceOAuth_old');

/**
 * Test OAuth Agent - Simple test endpoint (no auth required for testing)
 * POST /api/test-oauth/chat
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, language = 'en' } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const sessionId = req.session?.id || `test-${Date.now()}`;
    const practiceContext = { subdomain: 'test' };

    console.log('🧪 Testing OAuth Agent...');
    console.log('Session ID:', sessionId);
    console.log('Message:', message);
    console.log('Language:', language);

    // Check auth status first
    const authStatus = agentServiceOAuth.getAuthStatus(req);
    console.log('Auth Status:', authStatus);

    if (authStatus.willUse === 'none') {
      return res.status(401).json({
        success: false,
        error: 'No authentication method available',
        message: 'Please configure API key or authenticate with OAuth',
        authStatus
      });
    }

    // Process the message
    const result = await agentServiceOAuth.processChatMessage(
      message,
      sessionId,
      language,
      practiceContext,
      req
    );

    res.json({
      ...result,
      authStatus,
      testMode: true
    });

  } catch (error) {
    console.error('❌ OAuth test error:', error);
    res.status(500).json({
      success: false,
      error: 'OAuth test failed',
      details: error.message
    });
  }
});

/**
 * Get authentication status
 * GET /api/test-oauth/auth-status
 */
router.get('/auth-status', (req, res) => {
  try {
    const authStatus = agentServiceOAuth.getAuthStatus(req);
    
    res.json({
      success: true,
      authStatus,
      session: {
        hasSession: !!req.session,
        sessionId: req.session?.id
      }
    });

  } catch (error) {
    console.error('❌ Auth status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auth status',
      details: error.message
    });
  }
});

/**
 * Test OAuth token directly
 * GET /api/test-oauth/test-token
 */
router.get('/test-token', async (req, res) => {
  try {
    const result = await agentServiceOAuth.testOAuth(req);
    
    res.json({
      success: true,
      message: 'OAuth token test successful',
      claudeResponse: result.content[0].text
    });

  } catch (error) {
    console.error('❌ OAuth token test error:', error);
    res.status(500).json({
      success: false,
      error: 'OAuth token test failed',
      details: error.message
    });
  }
});

module.exports = router;