/**
 * 🔐 MULTI-FACTOR AUTHENTICATION SERVICE
 * Complete 2FA implementation with TOTP, QR codes, and backup codes
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class MFAService {
  constructor() {
    this.issuer = 'IntelliCare';
    this.window = 2; // Allow 2 time steps before/after current
    this.backupCodeLength = 8;
    this.backupCodeCount = 10;
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('mfa-service');
      this.initialized = true;
      return this;
    } catch (error) {
      console.error('Failed to initialize MFA Service:', error);
      throw error;
    }
  }

  // Generate MFA secret for user
  generateMFASecret(userEmail, practiceName) {
    // Generate raw secret only; we'll build otpauth URL ourselves to control label format
    const secret = speakeasy.generateSecret({ length: 32 });

    // Label format required by authenticator apps:
    // otpauth://totp/<ISSUER>:<ACCOUNT_NAME>?secret=...&issuer=<ISSUER>
    // We want first line = IntelliCare (issuer), second line = practice name (account)
    const issuer = this.issuer; // "IntelliCare"
    const accountName = practiceName || userEmail;

    const label = `${issuer}:${accountName}`;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret.base32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    return {
      secret: secret.base32,
      otpauthUrl,
      qrCodeUrl: null // Will be generated separately
    };
  }

  // Generate QR code for MFA setup
  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      return qrCodeDataUrl;
    } catch (error) {
      console.error('QR Code generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  // Verify TOTP token
  verifyTOTP(token, secret, windowOverride = null) {
    try {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: windowOverride != null ? windowOverride : this.window
      });

      return {
        verified: verified,
        delta: verified ? 0 : null // Could calculate actual delta if needed
      };
    } catch (error) {
      console.error('TOTP verification error:', error);
      return { verified: false, delta: null };
    }
  }

  // Generate backup codes
  generateBackupCodes() {
    const codes = [];
    
    for (let i = 0; i < this.backupCodeCount; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  // Hash backup codes for storage
  hashBackupCodes(codes) {
    return codes.map(code => {
      return crypto.createHash('sha256').update(code).digest('hex');
    });
  }

  // Verify backup code
  verifyBackupCode(inputCode, hashedCodes) {
    const inputHash = crypto.createHash('sha256').update(inputCode.toUpperCase()).digest('hex');
    
    const index = hashedCodes.findIndex(hash => hash === inputHash);
    
    if (index !== -1) {
      // Remove used backup code
      hashedCodes.splice(index, 1);
      return { verified: true, remainingCodes: hashedCodes.length };
    }

    return { verified: false, remainingCodes: hashedCodes.length };
  }

  // Setup MFA for user
  async setupMFA(user, practiceName) {
    await this.initialize();
    
    // Generate secret and QR code
    const mfaData = this.generateMFASecret(user.email, practiceName);
    const qrCodeDataUrl = await this.generateQRCode(mfaData.otpauthUrl);
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = this.hashBackupCodes(backupCodes);

    return {
      secret: mfaData.secret,
      qrCode: qrCodeDataUrl,
      manualEntryKey: mfaData.secret,
      backupCodes: backupCodes, // Show to user once
      hashedBackupCodes: hashedBackupCodes // Store in database
    };
  }

  // Enable MFA for user
  async enableMFA(user, verificationToken, context) {
    await this.initialize();
    
    console.log(`[${new Date().toISOString()}] 🔐 [MFA-SERVICE] Starting enableMFA for user ${user._id}`);

    // Verify the token first
    console.log(`[${new Date().toISOString()}] 🔍 [MFA-SERVICE] Verifying TOTP token`);
    // Allow a slightly wider window during initial enablement to account for device clock skew
    const verification = this.verifyTOTP(verificationToken, user.tempMfaSecret, 3);

    if (!verification.verified) {
      console.log(`[${new Date().toISOString()}] ❌ [MFA-SERVICE] Token verification failed`);
      throw new Error('Invalid verification token');
    }

    console.log(`[${new Date().toISOString()}] ✅ [MFA-SERVICE] Token verified successfully`);

    // Move temp secret to permanent and enable MFA
    console.log(`[${new Date().toISOString()}] 🔧 [MFA-SERVICE] Updating user security settings`);
    user.security = user.security || {};
    user.security.mfaEnabled = true;
    user.security.mfaSecret = user.tempMfaSecret;
    user.security.backupCodes = user.tempBackupCodes;
    user.security.mfaEnabledAt = new Date();

    // Clear temporary data
    user.tempMfaSecret = undefined;
    user.tempBackupCodes = undefined;

    console.log(`[${new Date().toISOString()}] 💾 [MFA-SERVICE] Saving user to database`);
    const contextWithApi = {
      serviceId: 'mfa-service',
      operation: 'enable-mfa',
      practiceId: context?.practiceId || 'global'
    };
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    await secureDataAccess.update('users', { _id: user._id }, user, contextWithApi);
    console.log(`[${new Date().toISOString()}] ✅ [MFA-SERVICE] User saved successfully`);

    return {
      enabled: true,
      backupCodesRemaining: user.security.backupCodes.length
    };
  }

  // Disable MFA for user
  async disableMFA(user, verificationToken, context) {
    await this.initialize();
    
    // Verify current TOTP token or backup code
    let verified = false;

    if (user.security.mfaSecret) {
      const totpVerification = this.verifyTOTP(verificationToken, user.security.mfaSecret);
      if (totpVerification.verified) {
        verified = true;
      } else {
        // Try backup code
        const backupVerification = this.verifyBackupCode(verificationToken, user.security.backupCodes);
        if (backupVerification.verified) {
          verified = true;
          user.security.backupCodes = backupVerification.remainingCodes;
        }
      }
    }

    if (!verified) {
      throw new Error('Invalid verification token');
    }

    // Disable MFA
    user.security.mfaEnabled = false;
    user.security.mfaSecret = undefined;
    user.security.backupCodes = [];
    user.security.mfaDisabledAt = new Date();

    const contextWithApi = {
      serviceId: 'mfa-service',
      operation: 'disable-mfa',
      practiceId: context?.practiceId || 'global'
    };
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    await secureDataAccess.update('users', { _id: user._id }, user, contextWithApi);

    return { disabled: true };
  }

  // Verify MFA during login
  async verifyMFALogin(user, token, context) {
    await this.initialize();
    
    if (!user.security || !user.security.mfaEnabled) {
      return { verified: false, reason: 'MFA not enabled' };
    }

    // Try TOTP first
    const totpVerification = this.verifyTOTP(token, user.security.mfaSecret);
    if (totpVerification.verified) {
      return { 
        verified: true, 
        method: 'totp',
        backupCodesRemaining: user.security.backupCodes.length 
      };
    }

    // Try backup code
    const backupVerification = this.verifyBackupCode(token, user.security.backupCodes);
    if (backupVerification.verified) {
      // Update user with remaining backup codes
      user.security.backupCodes = backupVerification.remainingCodes;
      const contextWithApi = {
        serviceId: 'mfa-service',
        operation: 'verify-mfa-login',
        practiceId: context?.practiceId || 'global'
      };
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.update('users', { _id: user._id }, user, contextWithApi);

      return { 
        verified: true, 
        method: 'backup_code',
        backupCodesRemaining: backupVerification.remainingCodes 
      };
    }

    return { verified: false, reason: 'Invalid token' };
  }

  // Check if user requires MFA
  requiresMFA(user) {
    return user.security && user.security.mfaEnabled;
  }

  // Get MFA status for user
  getMFAStatus(user) {
    const security = user.security || {};
    
    return {
      enabled: security.mfaEnabled || false,
      hasBackupCodes: security.backupCodes && security.backupCodes.length > 0,
      backupCodesCount: security.backupCodes ? security.backupCodes.length : 0,
      enabledAt: security.mfaEnabledAt,
      lastUsed: security.mfaLastUsed
    };
  }

  // Generate new backup codes
  async regenerateBackupCodes(user, verificationToken, context) {
    await this.initialize();
    
    // Verify current TOTP token
    const verification = this.verifyTOTP(verificationToken, user.security.mfaSecret);
    
    if (!verification.verified) {
      throw new Error('Invalid verification token');
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = this.hashBackupCodes(backupCodes);

    // Update user
    user.security.backupCodes = hashedBackupCodes;
    user.security.backupCodesRegeneratedAt = new Date();
    const contextWithApi = {
      serviceId: 'mfa-service',
      operation: 'regenerate-backup-codes',
      practiceId: context?.practiceId || 'global'
    };
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    await secureDataAccess.update('users', { _id: user._id }, user, contextWithApi);

    return {
      backupCodes: backupCodes, // Show to user once
      count: backupCodes.length
    };
  }

  // Calculate MFA risk score for Zero Trust
  calculateMFARiskScore(user, mfaVerified) {
    let riskScore = 0;

    // Base risk if MFA is not enabled
    if (!this.requiresMFA(user)) {
      riskScore += 0.3;
    }

    // Risk if MFA is enabled but not verified in this session
    if (this.requiresMFA(user) && !mfaVerified) {
      riskScore += 0.5;
    }

    // Risk based on backup codes remaining
    const mfaStatus = this.getMFAStatus(user);
    if (mfaStatus.enabled && mfaStatus.backupCodesCount < 3) {
      riskScore += 0.1; // Low backup codes increase risk
    }

    return Math.min(riskScore, 1.0);
  }

  // Validate MFA setup requirements
  validateMFASetup(user) {
    const errors = [];

    if (!user.email) {
      errors.push('User email required for MFA setup');
    }

    if (user.security && user.security.mfaEnabled) {
      errors.push('MFA already enabled for this user');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

// Singleton instance
const mfaService = new MFAService();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('mfaService', () => mfaService);
}

module.exports = mfaService;