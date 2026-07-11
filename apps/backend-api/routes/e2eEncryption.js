// End-to-End Encryption Routes
// Handles document encryption, key management, and encrypted search

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const e2eEncryptionService = require('../services/e2eEncryptionService');
const { practiceAuth, fullClinicAuth } = require('../middleware/practiceAuth');
const multer = require('multer');
const crypto = require('crypto');

// Configure multer for encrypted file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// @route   POST /api/e2e/keys/generate
// @desc    Generate encryption keys for user
// @access  Protected
router.post('/keys/generate', practiceAuth, asyncHandler(async (req, res) => {
  const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'test-user';
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password required for key generation'
    });
  }
  
  try {
    const result = await e2eEncryptionService.generateUserMasterKey(userId, password);
    
    res.json({
      success: true,
      message: 'Encryption keys generated successfully',
      keyInfo: {
        keyId: result.keyId,
        algorithm: result.algorithm,
        version: result.keyVersion
      }
    });
  } catch (error) {
    console.error('Key generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate encryption keys'
    });
  }
}));

// @route   POST /api/e2e/encrypt/document
// @desc    Encrypt a document
// @access  Protected
router.post('/encrypt/document', 
  practiceAuth,
  upload.single('document'),
  asyncHandler(async (req, res) => {
    const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'test-user';
    const { title, tags, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document provided'
      });
    }
    
    try {
      const metadata = {
        id: crypto.randomBytes(16).toString('hex'),
        title: title || req.file.originalname,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        description,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      };
      
      const encryptedPackage = await e2eEncryptionService.encryptDocument(
        userId,
        req.file.buffer,
        metadata
      );
      
      res.json({
        success: true,
        message: 'Document encrypted successfully',
        encrypted: {
          id: metadata.id,
          package: encryptedPackage,
          metadata: {
            title: metadata.title,
            encryptedSize: encryptedPackage.data.length,
            algorithm: encryptedPackage.algorithm
          }
        }
      });
    } catch (error) {
      console.error('Document encryption error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to encrypt document'
      });
    }
}));

// @route   POST /api/e2e/decrypt/document
// @desc    Decrypt a document
// @access  Protected
router.post('/decrypt/document', practiceAuth, asyncHandler(async (req, res) => {
  const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'test-user';
  const { encryptedPackage } = req.body;
  
  if (!encryptedPackage) {
    return res.status(400).json({
      success: false,
      message: 'No encrypted package provided'
    });
  }
  
  try {
    const decrypted = await e2eEncryptionService.decryptDocument(userId, encryptedPackage);
    
    // Set appropriate headers for file download
    if (decrypted.metadata.mimeType) {
      res.setHeader('Content-Type', decrypted.metadata.mimeType);
    }
    if (decrypted.metadata.originalName) {
      res.setHeader('Content-Disposition', `attachment; filename="${decrypted.metadata.originalName}"`);
    }
    
    res.send(decrypted.data);
  } catch (error) {
    console.error('Document decryption error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to decrypt document'
    });
  }
}));

// @route   POST /api/e2e/search
// @desc    Search encrypted documents
// @access  Protected
router.post('/search', practiceAuth, asyncHandler(async (req, res) => {
  const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'test-user';
  const { searchTerm } = req.body;
  
  if (!searchTerm) {
    return res.status(400).json({
      success: false,
      message: 'Search term required'
    });
  }
  
  try {
    const results = await e2eEncryptionService.searchEncryptedDocuments(userId, searchTerm);
    
    res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Encrypted search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
}));

// @route   POST /api/e2e/keys/rotate
// @desc    Rotate encryption keys
// @access  Protected
router.post('/keys/rotate', practiceAuth, asyncHandler(async (req, res) => {
  const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'test-user';
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password required for key rotation'
    });
  }
  
  try {
    const result = await e2eEncryptionService.rotateUserKeys(userId);
    
    res.json({
      success: true,
      message: 'Keys rotated successfully',
      newVersion: result.newVersion,
      rotatedAt: result.rotatedAt
    });
  } catch (error) {
    console.error('Key rotation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to rotate keys'
    });
  }
}));

// @route   POST /api/e2e/keys/export
// @desc    Export encryption keys for backup
// @access  Protected
router.post('/keys/export', practiceAuth, asyncHandler(async (req, res) => {
  const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'test-user';
  const { exportPassword } = req.body;
  
  if (!exportPassword) {
    return res.status(400).json({
      success: false,
      message: 'Export password required'
    });
  }
  
  try {
    const exportPackage = await e2eEncryptionService.exportUserKeys(userId, exportPassword);
    
    res.json({
      success: true,
      message: 'Keys exported successfully',
      backup: exportPackage
    });
  } catch (error) {
    console.error('Key export error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to export keys'
    });
  }
}));

// @route   POST /api/e2e/keys/import
// @desc    Import encryption keys from backup
// @access  Protected
router.post('/keys/import', practiceAuth, asyncHandler(async (req, res) => {
  const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'test-user';
  const { exportPackage, exportPassword } = req.body;
  
  if (!exportPackage || !exportPassword) {
    return res.status(400).json({
      success: false,
      message: 'Backup package and password required'
    });
  }
  
  try {
    const result = await e2eEncryptionService.importUserKeys(userId, exportPackage, exportPassword);
    
    res.json({
      success: true,
      message: 'Keys imported successfully',
      version: result.version
    });
  } catch (error) {
    console.error('Key import error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to import keys'
    });
  }
}));

// @route   GET /api/e2e/stats
// @desc    Get encryption statistics
// @access  Protected (Admin only in production)
router.get('/stats', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const stats = e2eEncryptionService.getEncryptionStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
}));

// @route   POST /api/e2e/encrypt/text
// @desc    Encrypt text data
// @access  Protected
router.post('/encrypt/text', practiceAuth, asyncHandler(async (req, res) => {
  const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'test-user';
  const { text, metadata } = req.body;
  
  if (!text) {
    return res.status(400).json({
      success: false,
      message: 'Text data required'
    });
  }
  
  try {
    const encryptedPackage = await e2eEncryptionService.encryptDocument(
      userId,
      text,
      metadata || {}
    );
    
    res.json({
      success: true,
      message: 'Text encrypted successfully',
      encrypted: encryptedPackage
    });
  } catch (error) {
    console.error('Text encryption error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to encrypt text'
    });
  }
}));

// @route   POST /api/e2e/decrypt/text
// @desc    Decrypt text data
// @access  Protected
router.post('/decrypt/text', practiceAuth, asyncHandler(async (req, res) => {
  const userId = req.user?._id?.toString() || req.headers['x-user-id'] || 'test-user';
  const { encryptedPackage } = req.body;
  
  if (!encryptedPackage) {
    return res.status(400).json({
      success: false,
      message: 'Encrypted package required'
    });
  }
  
  try {
    const decrypted = await e2eEncryptionService.decryptDocument(userId, encryptedPackage);
    
    res.json({
      success: true,
      text: decrypted.data.toString('utf8'),
      metadata: decrypted.metadata
    });
  } catch (error) {
    console.error('Text decryption error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to decrypt text'
    });
  }
}));

module.exports = router;