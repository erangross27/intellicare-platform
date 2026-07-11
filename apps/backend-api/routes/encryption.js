const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const secureConfigService = require('../services/secureConfigService');
const { authenticateToken } = require('../middleware/auth');

// Store user-specific encryption keys (in production, use KMS or HSM)
const userEncryptionKeys = new Map();

// Master key for key derivation (in production, use AWS KMS, Azure Key Vault, or HSM)
const MASTER_KEY = secureConfigService.get('MASTER_ENCRYPTION_KEY') || crypto.randomBytes(32).toString('hex');

/**
 * Generate user-specific encryption key
 */
function generateUserKey(userId, practiceId) {
  const salt = crypto.randomBytes(16);
  const info = `${userId}-${practiceId}-${Date.now()}`;
  
  // Derive key from master key using HKDF
  const derivedKey = crypto.pbkdf2Sync(
    MASTER_KEY,
    salt,
    100000, // iterations
    32,     // key length
    'sha256'
  );
  
  return {
    key: derivedKey.toString('base64'),
    salt: salt.toString('base64'),
    algorithm: 'aes-256-gcm',
    createdAt: new Date()
  };
}

/**
 * @route   POST /api/encryption/get-key
 * @desc    Get user's encryption key for client-side operations
 * @access  Private
 */
router.post('/get-key', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const practiceId = req.user.practiceId || req.practice?._id;
    const sessionId = req.body.sessionId || crypto.randomBytes(16).toString('hex');
    
    // Generate unique key for this user session
    const keyId = `${userId}-${sessionId}`;
    
    // Check if key exists for this session
    let encryptionData = userEncryptionKeys.get(keyId);
    
    if (!encryptionData) {
      // Generate new key for this session
      encryptionData = generateUserKey(userId, practiceId);
      
      // Store with TTL (expire after session)
      userEncryptionKeys.set(keyId, {
        ...encryptionData,
        expiresAt: Date.now() + (8 * 60 * 60 * 1000) // 8 hours
      });
      
      // Clean expired keys periodically
      setTimeout(() => {
        userEncryptionKeys.delete(keyId);
      }, 8 * 60 * 60 * 1000);
    }
    
    // Create wrapped key for client (encrypted with session-specific key)
    const sessionKey = crypto.pbkdf2Sync(
      sessionId,
      encryptionData.salt,
      1000,
      32,
      'sha256'
    );
    
    // Encrypt the actual key with session key
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      sessionKey,
      Buffer.from(encryptionData.salt, 'base64').slice(0, 16)
    );
    
    const encryptedKey = Buffer.concat([
      cipher.update(encryptionData.key, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    res.json({
      success: true,
      encryptionData: {
        wrappedKey: encryptedKey.toString('base64'),
        authTag: authTag.toString('base64'),
        salt: encryptionData.salt,
        algorithm: encryptionData.algorithm,
        sessionId: sessionId,
        expiresAt: encryptionData.expiresAt
      }
    });
    
  } catch (error) {
    console.error('Encryption key generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate encryption key'
    });
  }
});

/**
 * @route   POST /api/encryption/validate
 * @desc    Validate encrypted data integrity
 * @access  Private
 */
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { encryptedData, hmac, sessionId } = req.body;
    const userId = req.user.id;
    const keyId = `${userId}-${sessionId}`;
    
    const encryptionData = userEncryptionKeys.get(keyId);
    
    if (!encryptionData) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired encryption session'
      });
    }
    
    // Verify HMAC
    const calculatedHmac = crypto
      .createHmac('sha256', encryptionData.key)
      .update(encryptedData)
      .digest('base64');
    
    if (calculatedHmac !== hmac) {
      // Log security event
      console.error(`⚠️ SECURITY: HMAC validation failed for user ${userId}`);
      
      return res.status(401).json({
        success: false,
        message: 'Data integrity check failed'
      });
    }
    
    res.json({
      success: true,
      message: 'Data integrity verified'
    });
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation failed'
    });
  }
});

/**
 * @route   POST /api/encryption/rotate-key
 * @desc    Rotate user's encryption key
 * @access  Private
 */
router.post('/rotate-key', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const practiceId = req.user.practiceId || req.practice?._id;
    const { oldSessionId, newSessionId } = req.body;
    
    // Generate new key
    const newEncryptionData = generateUserKey(userId, practiceId);
    
    // Get old key for re-encryption
    const oldKeyId = `${userId}-${oldSessionId}`;
    const oldEncryptionData = userEncryptionKeys.get(oldKeyId);
    
    if (!oldEncryptionData) {
      return res.status(401).json({
        success: false,
        message: 'Old session not found'
      });
    }
    
    // Store new key
    const newKeyId = `${userId}-${newSessionId}`;
    userEncryptionKeys.set(newKeyId, {
      ...newEncryptionData,
      expiresAt: Date.now() + (8 * 60 * 60 * 1000)
    });
    
    // Delete old key after brief overlap period
    setTimeout(() => {
      userEncryptionKeys.delete(oldKeyId);
    }, 5 * 60 * 1000); // 5 minutes overlap
    
    res.json({
      success: true,
      message: 'Encryption key rotated successfully',
      newSessionId: newSessionId
    });
    
  } catch (error) {
    console.error('Key rotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rotate encryption key'
    });
  }
});

/**
 * @route   POST /api/encryption/server-encrypt
 * @desc    Server-side encryption for highly sensitive data
 * @access  Private
 */
router.post('/server-encrypt', authenticateToken, async (req, res) => {
  try {
    const { data, dataType } = req.body;
    const userId = req.user.id;
    
    // Use AWS KMS or Azure Key Vault in production
    const key = crypto.pbkdf2Sync(MASTER_KEY, userId, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Store encrypted data in database with metadata
    const encryptedRecord = {
      userId,
      dataType,
      encryptedData: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: 'aes-256-gcm',
      createdAt: new Date()
    };
    
    // In production, save to database
    // await EncryptedData.create(encryptedRecord);
    
    res.json({
      success: true,
      recordId: crypto.randomBytes(16).toString('hex'),
      message: 'Data encrypted on server'
    });
    
  } catch (error) {
    console.error('Server encryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to encrypt data'
    });
  }
});

module.exports = router;