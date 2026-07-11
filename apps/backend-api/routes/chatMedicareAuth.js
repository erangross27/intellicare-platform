/**
 * Chat-specific Medicare Authentication Routes
 * Handles OAuth flow within the chat interface
 */

const express = require('express');
const router = express.Router();
const blueButtonOAuthService = require('../services/blueButtonOAuthService');
const SecureDataAccess = require('../services/secureDataAccess');

/**
 * Medicare OAuth callback for chat interface
 * GET /api/chat/medicare-callback
 * 
 * This handles the redirect from Medicare.gov after user login
 * and redirects back to the chat with success/error status
 */
router.get('/medicare-callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    // Check for errors from Medicare
    if (error) {
      // Redirect back to chat with error
      return res.redirect(`/?medicare=error&message=${encodeURIComponent('Medicare authorization was denied')}`);
    }
    
    // Verify state if we have one stored
    if (req.session.medicareOAuthState && state !== req.session.medicareOAuthState) {
      return res.redirect(`/?medicare=error&message=${encodeURIComponent('Security verification failed')}`);
    }
    
    const redirectUri = `${req.protocol}://${req.get('host')}/api/chat/medicare-callback`;
    
    // Exchange code for access token
    const result = await blueButtonOAuthService.exchangeCodeForToken(code, redirectUri, state);
    
    // Store in session for chat to access
    req.session.medicareConnected = true;
    req.session.medicarePatientId = result.patientId;
    req.session.medicareUserInfo = result.userInfo;
    
    // Get the access token for immediate data retrieval
    const context = {
      serviceId: 'chat-medicare-auth',
      operation: 'getMedicareData',
      practiceId: req.session.practiceId || 'global'
    };
    
    const tokens = await SecureDataAccess.query('medicare_tokens', {
      patientId: result.patientId
    }, { limit: 1, sort: { timestamp: -1 } }, context);
    
    if (tokens && tokens.length > 0) {
      // Decrypt and get patient data immediately
      const encryptionService = require('../services/encryptionService');
      const accessToken = await encryptionService.decrypt(tokens[0].accessToken);
      
      // Get patient demographics and basic info
      const demographics = await blueButtonOAuthService.getPatientDemographics(
        accessToken, 
        result.patientId
      );
      
      // Store in session for chat to use
      req.session.medicareData = {
        mbi: demographics.mbi,
        name: `${demographics.name?.given?.[0]} ${demographics.name?.family}`,
        birthDate: demographics.birthDate,
        address: demographics.address,
        phone: demographics.telecom?.find(t => t.system === 'phone')?.value
      };
    }
    
    // Redirect back to chat with success message
    const successMessage = `Medicare account connected successfully for ${result.userInfo.name}`;
    return res.redirect(`/?medicare=success&message=${encodeURIComponent(successMessage)}`);
    
  } catch (error) {
    console.error('Medicare callback error:', error);
    
    // Redirect back to chat with error
    return res.redirect(`/?medicare=error&message=${encodeURIComponent('Failed to connect Medicare account')}`);
  }
});

/**
 * Generate Medicare auth URL for chat
 * POST /api/chat/medicare-auth-url
 * 
 * Called by chat to get the OAuth URL when user wants to connect Medicare
 */
router.post('/medicare-auth-url', async (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/chat/medicare-callback`;
    
    // Generate authorization URL
    const { authUrl, state } = await blueButtonOAuthService.getAuthorizationUrl(redirectUri);
    
    // Store state in session
    req.session.medicareOAuthState = state;
    
    res.json({
      success: true,
      authUrl,
      message: 'Click the link to connect your Medicare account'
    });
    
  } catch (error) {
    console.error('Generate auth URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Medicare login link',
      error: error.message
    });
  }
});

/**
 * Get Medicare data for connected account
 * GET /api/chat/medicare-data
 * 
 * Returns Medicare data if user has connected their account
 */
router.get('/medicare-data', async (req, res) => {
  try {
    if (!req.session.medicareConnected) {
      return res.json({
        success: false,
        connected: false,
        message: 'No Medicare account connected'
      });
    }
    
    // Return cached data from session
    if (req.session.medicareData) {
      return res.json({
        success: true,
        connected: true,
        data: req.session.medicareData,
        userInfo: req.session.medicareUserInfo
      });
    }
    
    // If no cached data, fetch it
    const patientId = req.session.medicarePatientId;
    const context = {
      serviceId: 'chat-medicare-auth',
      operation: 'getMedicareData',
      practiceId: req.session.practiceId || 'global'
    };
    
    const tokens = await SecureDataAccess.query('medicare_tokens', {
      patientId: patientId
    }, { limit: 1, sort: { timestamp: -1 } }, context);
    
    if (!tokens || tokens.length === 0) {
      return res.json({
        success: false,
        message: 'Medicare token expired, please reconnect'
      });
    }
    
    // Decrypt access token
    const encryptionService = require('../services/encryptionService');
    const accessToken = await encryptionService.decrypt(tokens[0].accessToken);
    
    // Get all patient data
    const [demographics, coverage, claims] = await Promise.all([
      blueButtonOAuthService.getPatientDemographics(accessToken, patientId),
      blueButtonOAuthService.getCoverage(accessToken, patientId),
      blueButtonOAuthService.getClaims(accessToken, patientId, 10)
    ]);
    
    // Format for chat display
    const formattedData = {
      mbi: demographics.mbi,
      name: `${demographics.name?.given?.[0]} ${demographics.name?.family}`,
      birthDate: demographics.birthDate,
      gender: demographics.gender,
      address: demographics.address,
      phone: demographics.telecom?.find(t => t.system === 'phone')?.value,
      email: demographics.telecom?.find(t => t.system === 'email')?.value,
      coverage: coverage.map(c => c.type).filter(Boolean),
      recentDiagnoses: [...new Set(claims.flatMap(c => c.diagnosis || [])
        .filter(d => d.code)
        .map(d => `${d.code}: ${d.display}`))].slice(0, 5),
      totalClaims: claims.length
    };
    
    // Cache in session
    req.session.medicareData = formattedData;
    
    res.json({
      success: true,
      connected: true,
      data: formattedData
    });
    
  } catch (error) {
    console.error('Get Medicare data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve Medicare data',
      error: error.message
    });
  }
});

/**
 * Disconnect Medicare account
 * POST /api/chat/medicare-disconnect
 */
router.post('/medicare-disconnect', (req, res) => {
  req.session.medicareConnected = false;
  req.session.medicarePatientId = null;
  req.session.medicareUserInfo = null;
  req.session.medicareData = null;
  req.session.medicareOAuthState = null;
  
  res.json({
    success: true,
    message: 'Medicare account disconnected'
  });
});

module.exports = router;