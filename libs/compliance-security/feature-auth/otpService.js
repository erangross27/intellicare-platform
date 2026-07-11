const crypto = require('crypto');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class OTPService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.OTP_LENGTH = 6;
    this.OTP_EXPIRY_MINUTES = 10;
    this.MAX_ATTEMPTS = 3;
    this.RESEND_DELAY_SECONDS = 60;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate as OTP service
      const authResult = await serviceAccountManager.authenticate('otp-service');
      
      // Extract the API key from the auth object
      this.serviceToken = authResult ? authResult.apiKey : null;
      
      if (!this.serviceToken) {
        throw new Error('Failed to get API key from authentication');
      }
      
      this.initialized = true;
      console.log('✅ OTP Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OTP service:', error.message);
      // In development, continue without service token
      const secureConfigService = proxy.getService('secureConfigService');
      if (secureConfigService.get('NODE_ENV', 'development') === 'development') {
        console.warn('⚠️ DEVELOPMENT MODE: Continuing without OTP service authentication');
        this.serviceToken = 'dev-otp-token';
        this.initialized = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Get service context for SecureDataAccess operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'otp-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: practiceId
    };
  }

  /**
   * Generate a secure 6-digit OTP code
   * @returns {string} 6-digit code as string
   */
  generateCode() {
    // Generate a number between 100000 and 999999
    const min = 100000;
    const max = 999999;
    const code = crypto.randomInt(min, max + 1);
    return code.toString();
  }

  /**
   * Create and store an OTP for an email address
   * @param {string} email - User's email address
   * @param {string} practiceSubdomain - Practice subdomain (optional)
   * @returns {object} OTP record with code
   */
  async createOTP(email, practiceSubdomain = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    const code = this.generateCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Security context for global database (OTPs are stored globally)
    const context = this.getServiceContext('global');

    // Check for existing unexpired OTP
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    const existingOTPs = await secureDataAccess.query('otpcodes', {
      email: email.toLowerCase(),
      isUsed: false,
      expiresAt: { $gt: now }
    }, { limit: 1 }, context);

    // If there's a recent OTP that was created less than RESEND_DELAY_SECONDS ago
    if (existingOTPs && existingOTPs.length > 0) {
      const existingOTP = existingOTPs[0];
      const secondsSinceCreation = (now - new Date(existingOTP.createdAt)) / 1000;
      
      if (secondsSinceCreation < this.RESEND_DELAY_SECONDS) {
        throw new Error(`Please wait ${Math.ceil(this.RESEND_DELAY_SECONDS - secondsSinceCreation)} seconds before requesting a new code`);
      }
      
      // Mark old OTP as used
      await secureDataAccess.update('otpcodes', 
        { _id: existingOTP._id }, 
        { $set: { isUsed: true } }, 
        context
      );
    }

    // Create new OTP record
    const otpData = {
      email: email.toLowerCase(),
      code: code,
      practiceSubdomain: practiceSubdomain,
      attempts: 0,
      expiresAt: expiresAt,
      createdAt: now,
      isUsed: false
    };

    const savedOTP = await secureDataAccess.insert('otpcodes', otpData, context);
    
    console.log(`📧 OTP created for ${email}: ${code.substring(0, 2)}****`);
    
    return {
      code: code,
      expiresAt: expiresAt,
      email: email
    };
  }

  /**
   * Verify an OTP code
   * @param {string} email - User's email address
   * @param {string} code - 6-digit code to verify
   * @returns {object} Verification result with practice subdomain if applicable
   */
  async verifyOTP(email, code) {
    if (!this.initialized) {
      await this.initialize();
    }

    const now = new Date();
    
    // Security context for global database
    const context = this.getServiceContext('global');

    // Find the OTP record
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    const otpRecords = await secureDataAccess.query('otpcodes', {
      email: email.toLowerCase(),
      code: code.toString(),
      isUsed: false
    }, { limit: 1 }, context);

    if (!otpRecords || otpRecords.length === 0) {
      // Log failed attempt for security monitoring
      console.warn(`⚠️ Invalid OTP attempt for ${email}`);
      return {
        success: false,
        error: 'Invalid verification code'
      };
    }

    const otpRecord = otpRecords[0];

    // Check if expired
    if (new Date(otpRecord.expiresAt) <= now) {
      await secureDataAccess.update('otpcodes',
        { _id: otpRecord._id },
        { $set: { isUsed: true } },
        context
      );
      
      return {
        success: false,
        error: 'Verification code has expired'
      };
    }

    // Check attempts
    if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
      await secureDataAccess.update('otpcodes',
        { _id: otpRecord._id },
        { $set: { isUsed: true } },
        context
      );
      
      return {
        success: false,
        error: 'Too many failed attempts. Please request a new code'
      };
    }

    // Increment attempts
    await secureDataAccess.update('otpcodes',
      { _id: otpRecord._id },
      { $inc: { attempts: 1 } },
      context
    );

    // Verify the code matches
    if (otpRecord.code !== code.toString()) {
      const remainingAttempts = this.MAX_ATTEMPTS - otpRecord.attempts - 1;
      return {
        success: false,
        error: `Invalid code. ${remainingAttempts} attempts remaining`,
        remainingAttempts: remainingAttempts
      };
    }

    // Success! Mark as used
    await secureDataAccess.update('otpcodes',
      { _id: otpRecord._id },
      { $set: { isUsed: true, verifiedAt: now } },
      context
    );

    console.log(`✅ OTP verified successfully for ${email}`);

    return {
      success: true,
      email: otpRecord.email,
      practiceSubdomain: otpRecord.practiceSubdomain
    };
  }

  /**
   * Clean up expired OTP codes
   * @returns {number} Number of deleted records
   */
  async cleanupExpired() {
    if (!this.initialized) {
      await this.initialize();
    }

    const now = new Date();
    
    // Security context for global database
    const context = this.getServiceContext('global');

    // Find expired OTPs older than 1 hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    const result = await secureDataAccess.delete('otpcodes', {
      $or: [
        { expiresAt: { $lt: oneHourAgo } },
        { isUsed: true, verifiedAt: { $lt: oneHourAgo } }
      ]
    }, context);

    if (result && result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} expired OTP codes`);
    }

    return result?.deletedCount || 0;
  }

  /**
   * Get OTP statistics for monitoring
   * @param {string} email - Optional email to filter by
   * @returns {object} Statistics object
   */
  async getStats(email = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    const context = this.getServiceContext('global');
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');

    const filter = email ? { email: email.toLowerCase() } : {};
    
    const [total, active, used, expired] = await Promise.all([
      secureDataAccess.query('otpcodes', filter, { count: true }, context),
      secureDataAccess.query('otpcodes', { 
        ...filter, 
        isUsed: false, 
        expiresAt: { $gt: new Date() } 
      }, { count: true }, context),
      secureDataAccess.query('otpcodes', { 
        ...filter, 
        isUsed: true 
      }, { count: true }, context),
      secureDataAccess.query('otpcodes', { 
        ...filter, 
        expiresAt: { $lt: new Date() },
        isUsed: false
      }, { count: true }, context)
    ]);

    return {
      total: total || 0,
      active: active || 0,
      used: used || 0,
      expired: expired || 0
    };
  }
}

// Export singleton instance
const otpService = new OTPService();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('otpService', () => otpService);
}

module.exports = otpService;