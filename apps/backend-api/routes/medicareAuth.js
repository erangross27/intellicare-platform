/**
 * Medicare Authentication Routes
 * Handles OAuth flow for CMS Blue Button 2.0
 * 
 * This is the REAL implementation - users log in with Medicare.gov
 */

const express = require('express');
const router = express.Router();
const blueButtonOAuthService = require('../services/blueButtonOAuthService');
const SecureDataAccess = require('../services/secureDataAccess');

/**
 * Step 1: Initiate Medicare login
 * GET /api/medicare/auth/login
 * 
 * Redirects user to Medicare.gov to log in
 */
router.get('/login', async (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/medicare/auth/callback`;
    
    // Generate authorization URL
    const { authUrl, state } = await blueButtonOAuthService.getAuthorizationUrl(redirectUri);
    
    // Store state in session for verification
    req.session.medicareOAuthState = state;
    
    // Redirect user to Medicare.gov
    res.redirect(authUrl);
    
  } catch (error) {
    console.error('Medicare login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Medicare login',
      error: error.message
    });
  }
});

/**
 * Step 2: Handle OAuth callback
 * GET /api/medicare/auth/callback
 * 
 * Medicare.gov redirects here after user approves
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    // Check for errors from Medicare
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Medicare authorization denied',
        error: error
      });
    }
    
    // Verify state matches
    if (state !== req.session.medicareOAuthState) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OAuth state'
      });
    }
    
    const redirectUri = `${req.protocol}://${req.get('host')}/api/medicare/auth/callback`;
    
    // Exchange code for access token
    const result = await blueButtonOAuthService.exchangeCodeForToken(code, redirectUri, state);
    
    // Store patient ID in session
    req.session.medicarePatientId = result.patientId;
    req.session.medicareAuthenticated = true;
    
    // Redirect to success page or return JSON
    if (req.accepts('html')) {
      res.redirect('/medicare/success?patientId=' + result.patientId);
    } else {
      res.json({
        success: true,
        message: 'Successfully authenticated with Medicare',
        patientId: result.patientId,
        userInfo: result.userInfo
      });
    }
    
  } catch (error) {
    console.error('Medicare callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete Medicare authentication',
      error: error.message
    });
  }
});

/**
 * Step 3: Get patient data
 * GET /api/medicare/patient
 * 
 * Retrieves all available Medicare data for authenticated patient
 */
router.get('/patient', async (req, res) => {
  try {
    if (!req.session.medicareAuthenticated) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated with Medicare'
      });
    }
    
    const patientId = req.session.medicarePatientId;
    
    // Get stored access token
    const context = {
      serviceId: 'medicare-auth-api',
      operation: 'getPatientData',
      practiceId: req.practice?.id || 'global'
    };
    
    const tokens = await SecureDataAccess.query('medicare_tokens', {
      patientId: patientId
    }, { limit: 1, sort: { timestamp: -1 } }, context);
    
    if (!tokens || tokens.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'No valid Medicare token found'
      });
    }
    
    // Decrypt access token
    const encryptionService = require('../services/encryptionService');
    const accessToken = await encryptionService.decrypt(tokens[0].accessToken);
    
    // Get all patient data
    const [demographics, coverage, claims] = await Promise.all([
      blueButtonOAuthService.getPatientDemographics(accessToken, patientId),
      blueButtonOAuthService.getCoverage(accessToken, patientId),
      blueButtonOAuthService.getClaims(accessToken, patientId, 50)
    ]);
    
    // Extract useful information for auto-population
    const autoPopulateData = {
      // Demographics
      firstName: demographics.name?.given?.[0] || '',
      lastName: demographics.name?.family || '',
      dateOfBirth: demographics.birthDate,
      gender: demographics.gender,
      mbi: demographics.mbi,
      
      // Address
      street: demographics.address?.line?.join(' ') || '',
      city: demographics.address?.city || '',
      state: demographics.address?.state || '',
      zipCode: demographics.address?.postalCode || '',
      
      // Contact
      phone: demographics.telecom?.find(t => t.system === 'phone')?.value || '',
      email: demographics.telecom?.find(t => t.system === 'email')?.value || '',
      
      // Insurance
      medicarePartA: coverage.find(c => c.type?.includes('Part A')),
      medicarePartB: coverage.find(c => c.type?.includes('Part B')),
      medicarePartD: coverage.find(c => c.type?.includes('Part D')),
      medicareAdvantage: coverage.find(c => c.type?.includes('Part C')),
      
      // Medical History (from claims)
      diagnoses: [...new Set(claims.flatMap(c => c.diagnosis || [])
        .filter(d => d.code)
        .map(d => ({
          code: d.code,
          description: d.display
        })))],
      
      procedures: [...new Set(claims.flatMap(c => c.procedure || [])
        .filter(p => p.code)
        .map(p => ({
          code: p.code,
          description: p.display,
          date: p.date
        })))],
      
      // Recent providers
      providers: [...new Set(claims.map(c => c.provider).filter(Boolean))],
      
      // Medications (would need separate Part D claims endpoint)
      medications: []
    };
    
    res.json({
      success: true,
      message: 'Medicare data retrieved successfully',
      data: {
        demographics,
        coverage,
        recentClaims: claims.slice(0, 10),
        autoPopulateData
      }
    });
    
  } catch (error) {
    console.error('Get patient data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve Medicare data',
      error: error.message
    });
  }
});

/**
 * Step 4: Logout from Medicare
 * POST /api/medicare/auth/logout
 */
router.post('/logout', (req, res) => {
  req.session.medicareAuthenticated = false;
  req.session.medicarePatientId = null;
  req.session.medicareOAuthState = null;
  
  res.json({
    success: true,
    message: 'Logged out from Medicare'
  });
});

/**
 * Check authentication status
 * GET /api/medicare/auth/status
 */
router.get('/status', (req, res) => {
  res.json({
    authenticated: req.session.medicareAuthenticated || false,
    patientId: req.session.medicarePatientId || null
  });
});

module.exports = router;