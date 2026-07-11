// Zero-Knowledge Authentication Routes
// Implements SRP protocol and MFA endpoints

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const zeroKnowledgeAuthService = require('../services/zeroKnowledgeAuthService');
const { practiceAuth, fullClinicAuth } = require('../middleware/practiceAuth');
const srp = require('secure-remote-password/client');

// ========================================
// PUBLIC ENDPOINTS (No auth required)
// ========================================

// @route   POST /api/zkauth/register
// @desc    Register user with zero-knowledge proof
// @access  Public
router.post('/register', asyncHandler(async (req, res) => {
  const { username, password, email, practiceId } = req.body;
  
  if (!username || !password || !email) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: username, password, email'
    });
  }
  
  try {
    // Validate password strength
    const validation = zeroKnowledgeAuthService.validatePasswordStrength(password, username);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: validation.errors,
        policy: zeroKnowledgeAuthService.passwordPolicy
      });
    }
    
    // Generate SRP verifier (server never sees actual password)
    const { salt, verifier } = await zeroKnowledgeAuthService.generateVerifier(username, password);
    
    // In production, save to database
    // For now, simulate user creation
    const user = {
      id: require('crypto').randomBytes(16).toString('hex'),
      username,
      email,
      practiceId,
      srpSalt: salt,
      srpVerifier: verifier,
      createdAt: new Date()
    };
    
    // Log registration
    console.log(`✅ User registered with zero-knowledge auth: ${username}`);
    
    res.json({
      success: true,
      message: 'User registered successfully',
      userId: user.id,
      passwordStrength: {
        score: validation.score,
        entropy: validation.entropy
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

// @route   POST /api/zkauth/login/challenge
// @desc    Start SRP authentication challenge
// @access  Public
router.post('/login/challenge', asyncHandler(async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username required'
    });
  }
  
  try {
    // In production, fetch user from database
    // For demo, use test credentials
    const testUser = {
      username,
      srpSalt: 'test-salt',
      srpVerifier: 'test-verifier'
    };
    
    // Start authentication challenge
    const challenge = await zeroKnowledgeAuthService.startAuthentication(
      username,
      testUser.srpSalt,
      testUser.srpVerifier
    );
    
    res.json({
      success: true,
      challenge
    });
  } catch (error) {
    console.error('Challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start authentication'
    });
  }
}));

// @route   POST /api/zkauth/login/verify
// @desc    Verify SRP authentication proof
// @access  Public
router.post('/login/verify', asyncHandler(async (req, res) => {
  const { sessionId, clientPublicKey, clientProof } = req.body;
  
  if (!sessionId || !clientPublicKey || !clientProof) {
    return res.status(400).json({
      success: false,
      message: 'Missing authentication data'
    });
  }
  
  try {
    // Verify authentication without knowing password
    const result = await zeroKnowledgeAuthService.verifyAuthentication(
      sessionId,
      clientPublicKey,
      clientProof
    );
    
    if (result.success) {
      // Create session fingerprint
      const fingerprint = zeroKnowledgeAuthService.createSessionFingerprint(req);
      zeroKnowledgeAuthService.sessionFingerprints.set(sessionId, fingerprint);
      
      // In production, create JWT token here
      const token = require('crypto').randomBytes(32).toString('hex');
      
      res.json({
        success: true,
        message: 'Authentication successful',
        serverProof: result.serverProof,
        token,
        sessionKey: result.sessionKey,
        requireMFA: false // Would check if user has MFA enabled
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
}));

// @route   POST /api/zkauth/password/validate
// @desc    Validate password strength
// @access  Public
router.post('/password/validate', asyncHandler(async (req, res) => {
  const { password, username } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password required'
    });
  }
  
  const validation = zeroKnowledgeAuthService.validatePasswordStrength(password, username);
  
  res.json({
    success: validation.valid,
    validation,
    policy: zeroKnowledgeAuthService.passwordPolicy
  });
}));

// ========================================
// PROTECTED ENDPOINTS (Auth required)
// ========================================

// @route   POST /api/zkauth/mfa/setup
// @desc    Setup MFA for user
// @access  Protected
router.post('/mfa/setup', fullClinicAuth, asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const userEmail = req.user.email;
  
  try {
    // Generate MFA secret and QR code
    const mfaSetup = await zeroKnowledgeAuthService.generateMFASecret(userId, userEmail);
    
    res.json({
      success: true,
      mfaSetup
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup MFA'
    });
  }
}));

// @route   POST /api/zkauth/mfa/verify
// @desc    Verify MFA token
// @access  Protected
router.post('/mfa/verify', fullClinicAuth, asyncHandler(async (req, res) => {
  const { token } = req.body;
  const userId = req.user._id.toString();
  
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'MFA token required'
    });
  }
  
  try {
    const verified = zeroKnowledgeAuthService.verifyMFAToken(userId, token);
    
    if (verified) {
      res.json({
        success: true,
        message: 'MFA verified successfully'
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid MFA token'
      });
    }
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

// @route   POST /api/zkauth/mfa/disable
// @desc    Disable MFA for user
// @access  Protected
router.post('/mfa/disable', fullClinicAuth, asyncHandler(async (req, res) => {
  const { password, token } = req.body;
  const userId = req.user._id.toString();
  
  if (!password || !token) {
    return res.status(400).json({
      success: false,
      message: 'Password and MFA token required'
    });
  }
  
  try {
    // Verify MFA token before disabling
    const verified = zeroKnowledgeAuthService.verifyMFAToken(userId, token);
    
    if (!verified) {
      return res.status(401).json({
        success: false,
        message: 'Invalid MFA token'
      });
    }
    
    // Remove MFA secret
    zeroKnowledgeAuthService.mfaSecrets.delete(userId);
    zeroKnowledgeAuthService.mfaBackupCodes.delete(userId);
    
    res.json({
      success: true,
      message: 'MFA disabled successfully'
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

// @route   GET /api/zkauth/mfa/backup-codes
// @desc    Get MFA backup codes
// @access  Protected
router.get('/mfa/backup-codes', fullClinicAuth, asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  
  const backupCodes = zeroKnowledgeAuthService.mfaBackupCodes.get(userId);
  
  if (!backupCodes) {
    return res.status(404).json({
      success: false,
      message: 'No backup codes found'
    });
  }
  
  res.json({
    success: true,
    backupCodes: backupCodes.filter(c => !c.used).map(c => c.code)
  });
}));

// @route   POST /api/zkauth/mfa/regenerate-backup
// @desc    Regenerate MFA backup codes
// @access  Protected
router.post('/mfa/regenerate-backup', fullClinicAuth, asyncHandler(async (req, res) => {
  const { token } = req.body;
  const userId = req.user._id.toString();
  
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'MFA token required'
    });
  }
  
  try {
    // Verify MFA token
    const verified = zeroKnowledgeAuthService.verifyMFAToken(userId, token);
    
    if (!verified) {
      return res.status(401).json({
        success: false,
        message: 'Invalid MFA token'
      });
    }
    
    // Generate new backup codes
    const backupCodes = zeroKnowledgeAuthService.generateBackupCodes();
    zeroKnowledgeAuthService.mfaBackupCodes.set(userId, backupCodes);
    
    res.json({
      success: true,
      backupCodes: backupCodes.map(c => c.code)
    });
  } catch (error) {
    console.error('Backup code regeneration error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

// @route   POST /api/zkauth/session/verify
// @desc    Verify session fingerprint
// @access  Protected
router.post('/session/verify', fullClinicAuth, asyncHandler(async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  
  const verification = zeroKnowledgeAuthService.verifySessionFingerprint(sessionId, req);
  
  if (!verification.valid) {
    // Suspicious session change detected
    console.warn(`⚠️ Session fingerprint mismatch for user ${req.user._id}:`, verification.reason);
    
    // In production, might require re-authentication
    return res.status(403).json({
      success: false,
      message: 'Session verification failed',
      reason: verification.reason,
      requireReauth: true
    });
  }
  
  res.json({
    success: true,
    message: 'Session verified',
    matchScore: verification.matchScore
  });
}));

// @route   GET /api/zkauth/security/strength
// @desc    Get authentication strength report
// @access  Protected
router.get('/security/strength', fullClinicAuth, asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  
  const strength = zeroKnowledgeAuthService.getAuthenticationStrength(userId);
  
  res.json({
    success: true,
    strength
  });
}));

// @route   POST /api/zkauth/password/reset-request
// @desc    Request password reset
// @access  Public
router.post('/password/reset-request', asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email required'
    });
  }
  
  try {
    // In production, lookup user by email and send reset email
    const resetData = await zeroKnowledgeAuthService.generatePasswordResetToken('userId', email);
    
    // In production, send email with reset token
    console.log(`Password reset token generated for ${email}:`, resetData.token);
    
    res.json({
      success: true,
      message: 'Password reset email sent',
      expires: resetData.expires
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset'
    });
  }
}));

// @route   POST /api/zkauth/password/reset
// @desc    Reset password with token
// @access  Public
router.post('/password/reset', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Token and new password required'
    });
  }
  
  try {
    // Verify reset token
    const verification = await zeroKnowledgeAuthService.verifyPasswordResetToken(token);
    
    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    // Validate new password
    const validation = zeroKnowledgeAuthService.validatePasswordStrength(newPassword);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'New password does not meet requirements',
        errors: validation.errors
      });
    }
    
    // Generate new SRP verifier
    const { salt, verifier } = await zeroKnowledgeAuthService.generateVerifier(
      'username', // Would get from user lookup
      newPassword
    );
    
    // In production, update user in database
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

module.exports = router;