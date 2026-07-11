const SecureDataAccess = require('../feature-data-access/secureDataAccess');
/**
 * 🔐 REQUEST SIGNING SERVICE
 * 
 * Signs and verifies all API requests to prevent tampering.
 * Uses HMAC-SHA256 with timestamp to ensure request integrity.
 * 
 * SECURITY: All frontend requests MUST be signed. Backend MUST verify.
 * 
 * Future developers: Never bypass signature verification in production!
 */

const crypto = require('crypto');
const secureConfigService = require('../feature-encryption/secureConfigService');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');

class RequestSigningService {
  constructor() {
    // Generate a unique signing key per server instance
    // In production, this should be stored securely and shared across instances
    this.signingKey = secureConfigService.get('REQUEST_SIGNING_KEY') || crypto.randomBytes(32).toString('hex');
    
    // Store used nonces to prevent replay attacks
    this.usedNonces = new Map();
    
    // Clean up old nonces every 5 minutes
    setInterval(() => this.cleanupNonces(), 5 * 60 * 1000);
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('request-signing');
    }
    return this;
  }

  /**
   * Generate a signature for a request
   * @param {Object} requestData - The request data to sign
   * @param {string} timestamp - Unix timestamp in milliseconds
   * @param {string} nonce - Unique request identifier
   * @returns {string} The signature
   */
  generateSignature(requestData, timestamp, nonce) {
    // Create canonical request string
    const canonicalRequest = this.createCanonicalRequest(requestData, timestamp, nonce);
    
    // Generate HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', this.signingKey);
    hmac.update(canonicalRequest);
    
    return hmac.digest('hex');
  }

  /**
   * Verify a request signature
   * @param {Object} req - Express request object
   * @param {string} signature - The signature to verify
   * @param {string} timestamp - The request timestamp
   * @returns {boolean} Whether the signature is valid
   */
  async verifySignature(req, signature, timestamp) {
    try {
      const nonce = req.headers['x-request-nonce'];
      
      if (!nonce) {
        console.error('Missing request nonce');
        return false;
      }

      // Check if nonce was already used (prevent replay attacks)
      if (this.usedNonces.has(nonce)) {
        console.error('Nonce already used - possible replay attack');
        return false;
      }

      // Create request data object
      const requestData = {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent']
        }
      };

      // Generate expected signature
      const expectedSignature = this.generateSignature(requestData, timestamp, nonce);
      
      // Compare signatures using timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (isValid) {
        // Store nonce with expiration time
        this.usedNonces.set(nonce, Date.now() + 5 * 60 * 1000);
      }

      return isValid;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Create a canonical request string for signing
   * @private
   */
  createCanonicalRequest(requestData, timestamp, nonce) {
    // Sort object keys for consistent ordering
    const sortedData = this.sortObject(requestData);
    
    // Create canonical string
    const parts = [
      requestData.method,
      requestData.path,
      JSON.stringify(sortedData.query || {}),
      JSON.stringify(sortedData.body || {}),
      JSON.stringify(sortedData.headers || {}),
      timestamp,
      nonce
    ];

    return parts.join('\n');
  }

  /**
   * Sort object keys recursively
   * @private
   */
  sortObject(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }

    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObject(obj[key]);
    });

    return sorted;
  }

  /**
   * Clean up expired nonces
   * @private
   */
  cleanupNonces() {
    const now = Date.now();
    for (const [nonce, expiry] of this.usedNonces.entries()) {
      if (expiry < now) {
        this.usedNonces.delete(nonce);
      }
    }
  }

  /**
   * Generate a client token for frontend use
   * @param {string} userId - The user ID
   * @param {string} practiceId - The practice ID
   * @returns {Object} Token data for client
   */
  generateClientToken(userId, practiceId) {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Create a client-specific signing key
    const clientData = {
      userId,
      practiceId,
      timestamp,
      nonce
    };

    const token = crypto
      .createHmac('sha256', this.signingKey)
      .update(JSON.stringify(clientData))
      .digest('hex');

    return {
      token,
      timestamp,
      nonce,
      expiresIn: 3600000 // 1 hour
    };
  }

  /**
   * Middleware to verify request signatures
   */
  verificationMiddleware() {
    return async (req, res, next) => {
      // Skip signature verification for certain paths
      const skipPaths = ['/health', '/api/health', '/api/auth/login', '/api/auth/signup'];
      if (skipPaths.includes(req.path)) {
        return next();
      }

      // Skip in development mode (but log warning)
      if (secureConfigService.get('NODE_ENV') === 'development' && !secureConfigService.get('ENFORCE_SIGNATURES')) {
        console.warn('⚠️ Request signature verification skipped in development');
        return next();
      }

      const signature = req.headers['x-request-signature'];
      const timestamp = req.headers['x-request-timestamp'];

      if (!signature || !timestamp) {
        return res.status(401).json({
          error: {
            he: 'חסרות כותרות אבטחה בבקשה',
            en: 'Missing security headers in request'
          }
        });
      }

      // Verify timestamp is recent (within 5 minutes)
      const now = Date.now();
      const requestTime = parseInt(timestamp);
      if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
        return res.status(401).json({
          error: {
            he: 'הבקשה פגה תוקף',
            en: 'Request has expired'
          }
        });
      }

      // Verify signature
      const isValid = await this.verifySignature(req, signature, timestamp);
      if (!isValid) {
        // Log potential attack
        console.error('Invalid request signature detected:', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.headers['user-agent']
        });

        return res.status(401).json({
          error: {
            he: 'חתימת הבקשה אינה תקפה',
            en: 'Invalid request signature'
          }
        });
      }

      // Add verification metadata
      req.signatureVerified = true;
      req.signatureTimestamp = timestamp;

      next();
    };
  }
}

// Create singleton instance
const requestSigningService = new RequestSigningService();

module.exports = requestSigningService;
