/**
 * 🔐 MULTI-FACTOR AUTHENTICATION ROUTES
 * Complete 2FA endpoints for setup, verification, and management
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mfaService = require('../services/mfaService');
const { practiceContext, practiceModels, auditLogger } = require('../middleware/practiceContext');
const { fullClinicAuth } = require('../middleware/practiceAuth');
const immutableAuditService = require('../services/immutableAuditService');
const blockchainAuditService = require('../services/blockchainAuditService');
const SecureDataAccess = require('../services/secureDataAccess');

// Apply practice context to all routes
router.use(practiceContext);
router.use(fullClinicAuth);

// @route   GET /api/mfa/status
// @desc    Get MFA status for current user
// @access  Private
router.get('/status', async (req, res) => {
  try {
    // Define proper context for SecureDataAccess
    const context = {
      serviceId: 'mfa-service',
      apiKey: req.headers['x-api-key'],
      practiceId: req.practiceId || req.practice?._id
    };
    
    const user = await req.models.User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: {
          en: 'User not found.',
          he: 'משתמש לא נמצא.'
        }
      });
    }

    const mfaStatus = mfaService.getMFAStatus(user);

    res.json({
      success: true,
      mfa: mfaStatus
    });

  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error retrieving MFA status.',
        he: 'שגיאת שרת בקבלת סטטוס MFA.'
      }
    });
  }
});

// @route   POST /api/mfa/setup
// @desc    Setup MFA for user (generate QR code and backup codes)
// @access  Private
router.post('/setup', async (req, res) => {
  try {
    // Define proper context for SecureDataAccess
    const context = {
      serviceId: 'mfa-service',
      apiKey: req.headers['x-api-key'],
      practiceId: req.practiceId || req.practice?._id
    };
    
    const user = await req.models.User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: {
          en: 'User not found.',
          he: 'משתמש לא נמצא.'
        }
      });
    }

    // Validate MFA setup requirements
    const validation = mfaService.validateMFASetup(user);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: {
          en: validation.errors.join(', '),
          he: 'שגיאה בהגדרת MFA.'
        },
        errors: validation.errors
      });
    }

    // Setup MFA
    const mfaSetup = await mfaService.setupMFA(user, req.practice.name);

    // Store temporary data
    user.tempMfaSecret = mfaSetup.secret;
    user.tempBackupCodes = mfaSetup.hashedBackupCodes;
    await user.save({ validateModifiedOnly: true });

    // Log MFA setup initiation
    await immutableAuditService.addAuditEntry({
      eventType: 'mfa_setup_initiated',
      userId: user._id.toString(),
      clientIp: req.ip,
      userAgent: req.get('User-Agent'),
      details: 'User initiated MFA setup',
      metadata: {
        practiceSubdomain: req.practiceSubdomain
      }
    });

    res.json({
      success: true,
      message: {
        en: 'MFA setup initiated. Scan QR code with authenticator app.',
        he: 'הגדרת MFA החלה. סרוק את קוד QR עם אפליקציית אימות.'
      },
      mfa: {
        qrCode: mfaSetup.qrCode,
        manualEntryKey: mfaSetup.manualEntryKey,
        backupCodes: mfaSetup.backupCodes
      }
    });

  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error during MFA setup.',
        he: 'שגיאת שרת במהלך הגדרת MFA.'
      }
    });
  }
});

// @route   POST /api/mfa/enable
// @desc    Enable MFA after verification
// @access  Private
router.post('/enable', [
  body('token', 'Verification token is required').notEmpty().isLength({ min: 6, max: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Invalid verification token format.',
          he: 'פורמט טוקן אימות לא חוקי.'
        },
        errors: errors.array()
      });
    }

    const { token } = req.body;
    
    // Define proper context for SecureDataAccess
    const context = {
      serviceId: 'mfa-service',
      apiKey: req.headers['x-api-key'],
      practiceId: req.practiceId || req.practice?._id
    };
    
    const user = await req.models.User.findById(req.user.id);

    if (!user || !user.tempMfaSecret) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'MFA setup not initiated. Please start setup first.',
          he: 'הגדרת MFA לא החלה. אנא התחל הגדרה תחילה.'
        }
      });
    }

    console.log(`[${new Date().toISOString()}] 🔐 [MFA-ENABLE] Starting MFA enablement for user ${user._id}`);

    // Enable MFA
    const result = await mfaService.enableMFA(user, token, req.models);
    console.log(`[${new Date().toISOString()}] ✅ [MFA-ENABLE] MFA enabled successfully for user ${user._id}`);

    // Log MFA enablement
    try {
      await immutableAuditService.addAuditEntry({
        eventType: 'mfa_enabled',
        userId: user._id.toString(),
        clientIp: req.ip,
        userAgent: req.get('User-Agent'),
        details: 'User successfully enabled MFA',
        metadata: {
          practiceSubdomain: req.practiceSubdomain,
          backupCodesCount: result.backupCodesRemaining
        }
      });
      console.log(`[${new Date().toISOString()}] 📝 [MFA-ENABLE] Audit log added successfully`);
    } catch (auditError) {
      console.error(`[${new Date().toISOString()}] ❌ [MFA-ENABLE] Audit logging failed:`, auditError);
      // Continue anyway - don't fail MFA enablement due to audit logging issues
    }

    // Log critical security event
    try {
      await blockchainAuditService.addCriticalEvent({
        type: 'security_enhancement',
        userId: user._id.toString(),
        clientIp: req.ip,
        details: 'Multi-factor authentication enabled',
        metadata: {
          securityLevel: 'enhanced',
          mfaEnabled: true
        }
      });
      console.log(`[${new Date().toISOString()}] 🔗 [MFA-ENABLE] Blockchain audit log added successfully`);
    } catch (blockchainError) {
      console.error(`[${new Date().toISOString()}] ❌ [MFA-ENABLE] Blockchain logging failed:`, blockchainError);
      // Continue anyway - don't fail MFA enablement due to blockchain logging issues
    }

    console.log(`[${new Date().toISOString()}] 🚀 [MFA-ENABLE] Sending success response`);

    res.json({
      success: true,
      message: {
        en: 'MFA enabled successfully. Your account is now more secure.',
        he: 'MFA הופעל בהצלחה. החשבון שלך מאובטח יותר כעת.'
      },
      mfa: {
        enabled: true,
        backupCodesRemaining: result.backupCodesRemaining
      }
    });

  } catch (error) {
    console.error('MFA enable error:', error);
    res.status(400).json({
      success: false,
      message: {
        en: error.message || 'Failed to enable MFA.',
        he: 'נכשל בהפעלת MFA.'
      }
    });
  }
});

// @route   POST /api/mfa/disable
// @desc    Disable MFA for user
// @access  Private
router.post('/disable', [
  body('token', 'Verification token is required').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Verification token is required.',
          he: 'נדרש טוקן אימות.'
        },
        errors: errors.array()
      });
    }

    const { token } = req.body;
    const context = {
      serviceId: 'mfa-service',
      apiKey: req.headers['x-api-key'],
      practiceId: req.practiceId || req.practice?._id
    };
    const user = await req.models.User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: {
          en: 'User not found.',
          he: 'משתמש לא נמצא.'
        }
      });
    }

    // Disable MFA
    await mfaService.disableMFA(user, token);

    // Log MFA disablement
    await immutableAuditService.addAuditEntry({
      eventType: 'mfa_disabled',
      userId: user._id.toString(),
      clientIp: req.ip,
      userAgent: req.get('User-Agent'),
      details: 'User disabled MFA',
      metadata: {
        practiceSubdomain: req.practiceSubdomain
      }
    });

    // Log critical security event
    await blockchainAuditService.addCriticalEvent({
      type: 'security_change',
      userId: user._id.toString(),
      clientIp: req.ip,
      details: 'Multi-factor authentication disabled',
      metadata: {
        securityLevel: 'reduced',
        mfaEnabled: false
      }
    });

    res.json({
      success: true,
      message: {
        en: 'MFA disabled successfully.',
        he: 'MFA בוטל בהצלחה.'
      },
      mfa: {
        enabled: false
      }
    });

  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(400).json({
      success: false,
      message: {
        en: error.message || 'Failed to disable MFA.',
        he: 'נכשל בביטול MFA.'
      }
    });
  }
});

// @route   POST /api/mfa/regenerate-backup-codes
// @desc    Regenerate backup codes
// @access  Private
router.post('/regenerate-backup-codes', [
  body('token', 'TOTP token is required').notEmpty().isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Valid TOTP token is required.',
          he: 'נדרש טוקן TOTP חוקי.'
        },
        errors: errors.array()
      });
    }

    const { token } = req.body;
    const context = {
      serviceId: 'mfa-service',
      apiKey: req.headers['x-api-key'],
      practiceId: req.practiceId || req.practice?._id
    };
    const user = await req.models.User.findById(req.user.id);

    if (!user || !mfaService.requiresMFA(user)) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'MFA not enabled for this user.',
          he: 'MFA לא מופעל עבור משתמש זה.'
        }
      });
    }

    // Regenerate backup codes
    const result = await mfaService.regenerateBackupCodes(user, token);

    // Log backup codes regeneration
    await immutableAuditService.addAuditEntry({
      eventType: 'mfa_backup_codes_regenerated',
      userId: user._id.toString(),
      clientIp: req.ip,
      userAgent: req.get('User-Agent'),
      details: 'User regenerated MFA backup codes',
      metadata: {
        practiceSubdomain: req.practiceSubdomain,
        newBackupCodesCount: result.count
      }
    });

    res.json({
      success: true,
      message: {
        en: 'Backup codes regenerated successfully. Store them securely.',
        he: 'קודי גיבוי נוצרו מחדש בהצלחה. שמור אותם במקום בטוח.'
      },
      backupCodes: result.backupCodes
    });

  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    res.status(400).json({
      success: false,
      message: {
        en: error.message || 'Failed to regenerate backup codes.',
        he: 'נכשל ביצירת קודי גיבוי מחדש.'
      }
    });
  }
});

// @route   POST /api/mfa/verify
// @desc    Verify MFA token (for testing or additional verification)
// @access  Private
router.post('/verify', [
  body('token', 'Token is required').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Token is required.',
          he: 'נדרש טוקן.'
        },
        errors: errors.array()
      });
    }

    const { token } = req.body;
    const context = {
      serviceId: 'mfa-service',
      apiKey: req.headers['x-api-key'],
      practiceId: req.practiceId || req.practice?._id
    };
    const user = await req.models.User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: {
          en: 'User not found.',
          he: 'משתמש לא נמצא.'
        }
      });
    }

    // Verify MFA token
    const verification = await mfaService.verifyMFALogin(user, token);

    if (verification.verified) {
      // Update last used timestamp
      if (user.security) {
        user.security.mfaLastUsed = new Date();
        user.markModified('security');
        await user.save({ validateModifiedOnly: true });
      }

      res.json({
        success: true,
        message: {
          en: 'Token verified successfully.',
          he: 'טוקן אומת בהצלחה.'
        },
        verification: {
          method: verification.method,
          backupCodesRemaining: verification.backupCodesRemaining
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: {
          en: 'Invalid token.',
          he: 'טוקן לא חוקי.'
        },
        reason: verification.reason
      });
    }

  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error during token verification.',
        he: 'שגיאת שרת במהלך אימות טוקן.'
      }
    });
  }
});

module.exports = router;
