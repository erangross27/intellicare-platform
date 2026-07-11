const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const secureConfigService = require('./secureConfigService');

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
   * Uses atomic upsert to prevent race conditions from concurrent requests
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

    // RATE LIMITING CHECK: Query for very recent OTP to enforce delay
    // Note: We still need this separate query for rate limiting before upsert
    const recentOTPs = await SecureDataAccess.query('otpcodes', {
      email: email.toLowerCase(),
      isUsed: false,
      expiresAt: { $gt: now }
    }, { limit: 1 }, context);

    if (recentOTPs && recentOTPs.length > 0) {
      const recentOTP = recentOTPs[0];
      const secondsSinceCreation = (now - new Date(recentOTP.createdAt)) / 1000;

      // Enforce rate limiting - reject if too soon
      if (secondsSinceCreation < this.RESEND_DELAY_SECONDS) {
        throw new Error(`Please wait ${Math.ceil(this.RESEND_DELAY_SECONDS - secondsSinceCreation)} seconds before requesting a new code`);
      }
    }

    // ATOMIC UPSERT: Replace any existing unused OTP for this email
    // This prevents race conditions where concurrent requests create multiple valid OTPs
    const otpData = {
      email: email.toLowerCase(),
      code: code,
      practiceSubdomain: practiceSubdomain,
      attempts: 0,
      expiresAt: expiresAt,
      isUsed: false
    };

    const savedOTP = await SecureDataAccess.upsert(
      'otpcodes',
      {
        email: email.toLowerCase(),
        isUsed: false
      },
      {
        ...otpData,
        createdAt: now  // Will be set only on insert via $setOnInsert
      },
      context
    );

    console.log(`📧 OTP created/updated for ${email}: ${code.substring(0, 2)}**** (atomic upsert)`);

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
    const otpRecords = await SecureDataAccess.query('otpcodes', {
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
      await SecureDataAccess.update('otpcodes',
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
      await SecureDataAccess.update('otpcodes',
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
    await SecureDataAccess.update('otpcodes',
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
    await SecureDataAccess.update('otpcodes',
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
    
    const result = await SecureDataAccess.delete('otpcodes', {
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

    const filter = email ? { email: email.toLowerCase() } : {};
    
    const [total, active, used, expired] = await Promise.all([
      SecureDataAccess.query('otpcodes', filter, { count: true }, context),
      SecureDataAccess.query('otpcodes', { 
        ...filter, 
        isUsed: false, 
        expiresAt: { $gt: new Date() } 
      }, { count: true }, context),
      SecureDataAccess.query('otpcodes', { 
        ...filter, 
        isUsed: true 
      }, { count: true }, context),
      SecureDataAccess.query('otpcodes', { 
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
module.exports = new OTPService();