const express = require('express');
const router = express.Router();
const claudeOAuthService = require('../services/claudeOAuthService');

// Middleware to ensure session exists
const ensureSession = (req, res, next) => {
  if (!req.session) {
    return res.status(500).json({ error: 'Session not configured' });
  }
  next();
};

/**
 * Initialize OAuth flow
 * GET /api/auth/claude-oauth/login
 */
router.get('/login', ensureSession, (req, res) => {
  try {
    const sessionId = req.sessionID || req.session.id || 'default';
    const authURL = claudeOAuthService.getAuthorizationURL(sessionId);
    
    console.log('🚀 Starting OAuth flow for session:', sessionId);
    
    // Store the session ID for callback
    req.session.oauthSessionId = sessionId;
    
    res.json({
      success: true,
      authURL: authURL,
      message: 'Open this URL in your browser to authenticate with Claude'
    });
    
  } catch (error) {
    console.error('❌ OAuth login error:', error);
    res.status(500).json({
      error: 'Failed to initialize OAuth flow',
      details: error.message
    });
  }
});

/**
 * Handle OAuth callback
 * GET /api/auth/claude-oauth/callback
 */
router.get('/callback', ensureSession, async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    console.error('❌ OAuth error from provider:', error);
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: red;">OAuth Error</h1>
          <p>Error: ${error}</p>
          <p><a href="/api/auth/claude-oauth/login">Try Again</a></p>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: red;">Invalid Request</h1>
          <p>Missing authorization code or state parameter.</p>
          <p><a href="/api/auth/claude-oauth/login">Start OAuth Flow</a></p>
        </body>
      </html>
    `);
  }

  try {
    const sessionId = req.session.oauthSessionId || req.sessionID || 'default';
    
    console.log('🔄 Processing OAuth callback for session:', sessionId);
    
    // Exchange code for tokens
    const tokenData = await claudeOAuthService.exchangeCodeForTokens(sessionId, code, state);
    
    // Store tokens in session
    req.session.claudeTokens = tokenData;
    
    console.log('✅ OAuth flow completed successfully');
    
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: green;">✅ OAuth Success!</h1>
          <p>You have successfully authenticated with Claude.</p>
          <p>Access token expires at: ${new Date(tokenData.expiresAt).toLocaleString()}</p>
          <div style="margin-top: 30px;">
            <a href="/api/auth/claude-oauth/test" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Test Claude API
            </a>
          </div>
          <div style="margin-top: 10px;">
            <p><small>You can now close this window and return to your application.</small></p>
          </div>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: red;">OAuth Error</h1>
          <p>Failed to complete authentication: ${error.message}</p>
          <p><a href="/api/auth/claude-oauth/login">Try Again</a></p>
        </body>
      </html>
    `);
  }
});

/**
 * Test OAuth token with Claude API
 * GET /api/auth/claude-oauth/test
 */
router.get('/test', ensureSession, async (req, res) => {
  try {
    const { claudeTokens } = req.session;
    
    if (!claudeTokens || !claudeOAuthService.isTokenValid(claudeTokens)) {
      return res.status(401).json({
        error: 'No valid Claude OAuth token found',
        message: 'Please authenticate first',
        loginURL: '/api/auth/claude-oauth/login'
      });
    }
    
    console.log('🧪 Testing Claude API with OAuth token...');
    
    // Test with a simple message
    const testMessages = [{
      role: 'user',
      content: 'Hello! This is a test message from IntelliCare using OAuth authentication. Please confirm you can receive this message.'
    }];
    
    const response = await claudeOAuthService.makeClaudeRequest(
      claudeTokens.accessToken,
      testMessages
    );
    
    res.json({
      success: true,
      message: 'Claude OAuth test successful!',
      claudeResponse: response.content[0].text,
      tokenInfo: {
        expiresAt: new Date(claudeTokens.expiresAt).toLocaleString(),
        isValid: claudeOAuthService.isTokenValid(claudeTokens)
      }
    });
    
  } catch (error) {
    console.error('❌ OAuth test error:', error);
    res.status(500).json({
      error: 'OAuth test failed',
      details: error.message
    });
  }
});

/**
 * Check OAuth status
 * GET /api/auth/claude-oauth/status
 */
router.get('/status', ensureSession, (req, res) => {
  const { claudeTokens } = req.session;
  
  if (!claudeTokens) {
    return res.json({
      authenticated: false,
      message: 'No OAuth token found'
    });
  }
  
  const isValid = claudeOAuthService.isTokenValid(claudeTokens);
  
  res.json({
    authenticated: isValid,
    tokenInfo: {
      hasToken: !!claudeTokens.accessToken,
      expiresAt: new Date(claudeTokens.expiresAt).toLocaleString(),
      isValid: isValid
    }
  });
});

/**
 * Logout (clear OAuth tokens)
 * POST /api/auth/claude-oauth/logout
 */
router.post('/logout', ensureSession, (req, res) => {
  if (req.session.claudeTokens) {
    delete req.session.claudeTokens;
    console.log('🚪 OAuth tokens cleared from session');
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;