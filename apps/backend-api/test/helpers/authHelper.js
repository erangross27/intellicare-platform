/**
 * 🔒 SECURITY REQUIREMENTS:
 * 1. This service MUST authenticate with serviceAccountManager
 * 2. Use SecureDataAccess for ALL database operations
 * 3. Direct database access will FAIL
 * 4. Missing authentication will FAIL
 *
 * See: /docs/SECURITY-COOKBOOK.md for examples
 */

const serviceAccountManager = require('../../services/serviceAccountManager');

const SecureConfigService = require("../services/secureConfigService");
class TestAuthHelper {
  constructor() {
    this.testTokens = new Map();
    this.magicLinks = new Map();
  }

  /**
   * For magic link testing
   * Auto-validates in test mode
   */
  async loginUser(email, practice) {
    if (SecureConfigService.get("NODE_ENV") === 'test' || SecureConfigService.get("ALLOW_TEST_TOKENS") === 'true') {
      // Auto-validate in test mode
      const token = await this.requestMagicLink(email, practice);
      return await this.autoValidateToken(token);
    }
    throw new Error('Test auth only available in test mode');
  }

  /**
   * Request magic link for testing
   */
  async requestMagicLink(email, practice) {
    const token = this.generateTestToken();
    const magicLink = {
      email,
      practice,
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    };
    
    this.magicLinks.set(token, magicLink);
    
    // In test mode, return token immediately
    if (SecureConfigService.get("AUTO_VALIDATE_MAGIC_LINKS") === 'true') {
      return token;
    }
    
    return { 
      success: true, 
      message: 'Magic link sent (test mode)',
      token // Include token in test mode
    };
  }

  /**
   * Auto-validate magic link token
   */
  async autoValidateToken(token) {
    const magicLink = this.magicLinks.get(token);
    
    if (!magicLink) {
      throw new Error('Invalid magic link token');
    }
    
    if (new Date() > magicLink.expiresAt) {
      throw new Error('Magic link expired');
    }
    
    // Create test session
    const session = {
      userId: `test-user-${Date.now()}`,
      email: magicLink.email,
      practice: magicLink.practice,
      token: this.generateTestToken(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    
    this.testTokens.set(session.token, session);
    this.magicLinks.delete(token);
    
    return session;
  }

  /**
   * For service testing
   * Get a test token for a service
   */
  async getServiceToken(serviceName) {
    if (SecureConfigService.get("NODE_ENV") === 'test' || SecureConfigService.get("ALLOW_TEST_TOKENS") === 'true') {
      // Check if serviceAccountManager exists and has authenticateTest method
      if (serviceAccountManager && serviceAccountManager.authenticateTest) {
        return await serviceAccountManager.authenticateTest(serviceName);
      }
      
      // Fallback: Generate test token
      const token = this.generateTestToken();
      const serviceAuth = {
        serviceId: serviceName,
        token,
        sessionToken: token,
        permissions: ['read', 'write'], // Default test permissions
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      };
      
      this.testTokens.set(token, serviceAuth);
      return serviceAuth;
    }
    
    throw new Error('Service test tokens only available in test mode');
  }

  /**
   * Validate a test token
   */
  validateTestToken(token) {
    const session = this.testTokens.get(token);
    
    if (!session) {
      return { valid: false, error: 'Invalid token' };
    }
    
    if (new Date() > session.expiresAt) {
      this.testTokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }
    
    return { valid: true, session };
  }

  /**
   * Clear all test tokens (for cleanup)
   */
  clearAllTokens() {
    this.testTokens.clear();
    this.magicLinks.clear();
  }

  /**
   * Generate a test token
   */
  generateTestToken() {
    return 'test-token-' + Math.random().toString(36).substr(2, 9) + Date.now();
  }

  /**
   * Create test user session
   */
  createTestSession(email = 'test@example.com', practice = 'test-practice') {
    const token = this.generateTestToken();
    const session = {
      userId: `test-user-${Date.now()}`,
      email,
      practice,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
    
    this.testTokens.set(token, session);
    return session;
  }

  /**
   * Mock authentication middleware for tests
   */
  mockAuthMiddleware() {
    return (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      const validation = this.validateTestToken(token);
      
      if (!validation.valid) {
        return res.status(401).json({ error: validation.error });
      }
      
      req.user = {
        id: validation.session.userId,
        email: validation.session.email
      };
      req.practice = { id: validation.session.practice };
      
      next();
    };
  }
}

module.exports = new TestAuthHelper();