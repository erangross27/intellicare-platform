const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const secureConfigService = require('../services/secureConfigService');
const { auth: authenticateToken } = require('../middleware/auth');

// In-memory storage for encrypted data (in production, use database)
const encryptedStorage = new Map();

// Use existing DOCUMENT_ENCRYPTION_KEY
const ENCRYPTION_KEY = secureConfigService.get('DOCUMENT_ENCRYPTION_KEY') || crypto.randomBytes(32).toString('hex');

/**
 * Helper function to encrypt data
 */
function encryptData(data) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

/**
 * Helper function to decrypt data
 */
function decryptData(encryptedPackage) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encryptedPackage.iv, 'base64')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedPackage.authTag, 'base64'));
  
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPackage.encrypted, 'base64')),
    decipher.final()
  ]);
  
  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * @route   POST /api/encryption/store
 * @desc    Store encrypted data server-side
 * @access  Private
 */
router.post('/store', authenticateToken, async (req, res) => {
  try {
    const { key, data, sessionId, options } = req.body;
    const userId = req.user.id;
    
    // Create unique storage key
    const storageKey = `${userId}_${sessionId}_${key}`;
    
    // Encrypt the data
    const encryptedPackage = encryptData(data);
    
    // Generate unique record ID
    const recordId = crypto.randomBytes(16).toString('hex');
    
    // Store with metadata
    encryptedStorage.set(recordId, {
      ...encryptedPackage,
      userId,
      sessionId,
      key,
      createdAt: Date.now(),
      expiresAt: options?.expiresIn ? Date.now() + options.expiresIn : null
    });
    
    // Clean up expired entries periodically
    if (options?.expiresIn) {
      setTimeout(() => {
        encryptedStorage.delete(recordId);
      }, options.expiresIn);
    }
    
    res.json({
      success: true,
      recordId,
      message: 'Data encrypted and stored'
    });
    
  } catch (error) {
    console.error('Storage encryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store encrypted data'
    });
  }
});

/**
 * @route   POST /api/encryption/retrieve
 * @desc    Retrieve and decrypt data
 * @access  Private
 */
router.post('/retrieve', authenticateToken, async (req, res) => {
  try {
    const { recordId, sessionId } = req.body;
    const userId = req.user.id;
    
    // Get encrypted data
    const storedData = encryptedStorage.get(recordId);
    
    if (!storedData) {
      return res.status(404).json({
        success: false,
        message: 'Data not found'
      });
    }
    
    // Verify ownership
    if (storedData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Check expiry
    if (storedData.expiresAt && Date.now() > storedData.expiresAt) {
      encryptedStorage.delete(recordId);
      return res.status(410).json({
        success: false,
        message: 'Data has expired'
      });
    }
    
    // Decrypt data
    const decrypted = decryptData(storedData);
    
    res.json({
      success: true,
      data: decrypted
    });
    
  } catch (error) {
    console.error('Retrieval decryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve data'
    });
  }
});

/**
 * @route   POST /api/security/log
 * @desc    Log security events
 * @access  Private
 */
router.post('/log', authenticateToken, async (req, res) => {
  try {
    const { type, timestamp, sessionId, details, url } = req.body;
    const userId = req.user.id;
    
    // Log security event (in production, save to database)
    console.log('🔒 Security Event:', {
      type,
      userId,
      sessionId,
      timestamp,
      details,
      url
    });
    
    // Critical events trigger alerts
    const criticalEvents = ['ACCOUNT_LOCKED', 'DATA_BREACH_ATTEMPT', 'INVALID_TOKEN'];
    if (criticalEvents.includes(type)) {
      console.error('⚠️ CRITICAL SECURITY EVENT:', type, details);
      // In production, send alert to security team
    }
    
    res.json({
      success: true,
      message: 'Security event logged'
    });
    
  } catch (error) {
    console.error('Security logging error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log security event'
    });
  }
});

module.exports = router;