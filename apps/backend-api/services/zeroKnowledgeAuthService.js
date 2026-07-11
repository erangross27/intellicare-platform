const SecureDataAccess = require('./secureDataAccess');
// Zero-Knowledge Authentication Service
// Implements SRP (Secure Remote Password) protocol for passwordless authentication

const srp = require('secure-remote-password/server');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const bcrypt = require('bcrypt');
const serviceAccountManager = require('./serviceAccountManager');
const { v4: uuidv4 } = require('uuid');

class ZeroKnowledgeAuthService {
  constructor() {
    // Session storage for SRP handshake
    this.srpSessions = new Map(); // sessionId -> SRP session data
    
    // MFA storage
    this.mfaSecrets = new Map(); // userId -> MFA secret
    this.mfaBackupCodes = new Map(); // userId -> backup codes
    
    // Session fingerprints
    this.sessionFingerprints = new Map(); // sessionId -> fingerprint data
    
    // Password policy
    this.passwordPolicy = {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventCommonPasswords: true,
      preventUserInfo: true,
      maxConsecutiveChars: 3,
      minEntropy: 50 // bits
    };
    
    // Common passwords list (simplified, would load from file in production)
    this.commonPasswords = new Set([
      'password', '123456', 'password123', 'admin', 'letmein',
      'qwerty', 'welcome', 'monkey', 'dragon', 'master'
    ]);
    
    // Cleanup old sessions periodically
    this.startCleanup();
  }

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('zero-knowledge-auth-service');
    }
    return this;
  }

  /**
   * Step 1: Generate SRP verifier for user registration
   * Client sends username and password, server stores verifier (not password)
   */
  async generateVerifier(username, password) {
    // Validate password strength
    const validation = this.validatePasswordStrength(password, username);
    if (!validation.valid) {
      throw new Error(`Password does not meet requirements: ${validation.errors.join(', ')}`);
    }
    
    // Generate salt and verifier using SRP
    const salt = srp.generateSalt();
    const privateKey = srp.derivePrivateKey(salt, username, password);
    const verifier = srp.deriveVerifier(privateKey);
    
    // Return salt and verifier to store in database
    // NEVER store the password or privateKey
    return {
      salt,
      verifier,
      protocol: 'SRP-6a',
      createdAt: new Date()
    };
  }

  /**
   * Step 2: Start authentication challenge
   * Client sends username, server returns salt and server public key
   */
  async startAuthentication(username, userSalt, userVerifier) {
    // Generate server ephemeral keys
    const serverEphemeral = srp.generateEphemeral(userVerifier);
    
    // Create session
    const sessionId = uuidv4();
    this.srpSessions.set(sessionId, {
      username,
      serverEphemeral,
      verifier: userVerifier,
      timestamp: Date.now(),
      attempts: 0
    });
    
    // Return challenge to client
    return {
      sessionId,
      salt: userSalt,
      serverPublicKey: serverEphemeral.public,
      protocol: 'SRP-6a'
    };
  }

  /**
   * Step 3: Verify authentication proof
   * Client sends proof, server verifies without knowing password
   */
  async verifyAuthentication(sessionId, clientPublicKey, clientProof) {
    const session = this.srpSessions.get(sessionId);
    
    if (!session) {
      throw new Error('Invalid or expired session');
    }
    
    // Check attempt limit
    session.attempts++;
    if (session.attempts > 3) {
      this.srpSessions.delete(sessionId);
      throw new Error('Too many failed attempts');
    }
    
    try {
      // Derive shared session key
      const serverSession = srp.deriveSession(
        session.serverEphemeral.secret,
        clientPublicKey,
        session.verifier,
        session.username,
        session.verifier
      );
      
      // Verify client proof
      srp.verifySession(clientPublicKey, clientProof, serverSession);
      
      // Generate server proof for mutual authentication
      const serverProof = serverSession.proof;
      
      // Clean up session
      this.srpSessions.delete(sessionId);
      
      // Return success with server proof
      return {
        success: true,
        serverProof,
        sessionKey: serverSession.key, // Can be used for encrypting session data
        protocol: 'SRP-6a'
      };
    } catch (error) {
      // Invalid proof
      if (session.attempts >= 3) {
        this.srpSessions.delete(sessionId);
      }
      throw new Error('Authentication failed');
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password, username = '') {
    const errors = [];
    
    // Check length
    if (password.length < this.passwordPolicy.minLength) {
      errors.push(`Password must be at least ${this.passwordPolicy.minLength} characters`);
    }
    
    // Check character requirements
    if (this.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }
    
    if (this.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }
    
    if (this.passwordPolicy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain numbers');
    }
    
    if (this.passwordPolicy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain special characters');
    }
    
    // Check for common passwords
    if (this.passwordPolicy.preventCommonPasswords) {
      const lowerPassword = password.toLowerCase();
      if (this.commonPasswords.has(lowerPassword)) {
        errors.push('Password is too common');
      }
    }
    
    // Check for user information in password
    if (this.passwordPolicy.preventUserInfo && username) {
      const lowerPassword = password.toLowerCase();
      const lowerUsername = username.toLowerCase();
      if (lowerPassword.includes(lowerUsername) || lowerUsername.includes(lowerPassword)) {
        errors.push('Password cannot contain username');
      }
    }
    
    // Check for consecutive characters
    if (this.passwordPolicy.maxConsecutiveChars) {
      const regex = new RegExp(`(.)\\1{${this.passwordPolicy.maxConsecutiveChars},}`);
      if (regex.test(password)) {
        errors.push(`Password cannot have more than ${this.passwordPolicy.maxConsecutiveChars} consecutive identical characters`);
      }
    }
    
    // Calculate entropy
    const entropy = this.calculatePasswordEntropy(password);
    if (entropy < this.passwordPolicy.minEntropy) {
      errors.push(`Password is too weak (entropy: ${entropy.toFixed(1)} bits, required: ${this.passwordPolicy.minEntropy})`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      entropy,
      score: this.calculatePasswordScore(password)
    };
  }

  /**
   * Calculate password entropy
   */
  calculatePasswordEntropy(password) {
    let poolSize = 0;
    
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/\d/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;
    
    const entropy = password.length * Math.log2(poolSize);
    return entropy;
  }

  /**
   * Calculate password score (0-100)
   */
  calculatePasswordScore(password) {
    let score = 0;
    
    // Length bonus
    score += Math.min(password.length * 4, 40);
    
    // Character variety bonus
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[^a-zA-Z0-9]/.test(password)) score += 20;
    
    // Entropy bonus
    const entropy = this.calculatePasswordEntropy(password);
    score += Math.min(entropy / 2, 10);
    
    return Math.min(score, 100);
  }

  /**
   * Generate MFA secret for user
   */
  async generateMFASecret(userId, userEmail) {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `IntelliCare (${userEmail})`,
      issuer: 'IntelliCare Medical',
      length: 32
    });
    
    // Store secret
    this.mfaSecrets.set(userId, {
      secret: secret.base32,
      tempSecret: secret.base32,
      dataURL: secret.otpauth_url,
      verified: false
    });
    
    // Generate QR code
    const qrCode = await qrcode.toDataURL(secret.otpauth_url);
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    this.mfaBackupCodes.set(userId, backupCodes);
    
    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
      manualEntry: secret.otpauth_url
    };
  }

  /**
   * Verify MFA token
   */
  verifyMFAToken(userId, token) {
    const mfaData = this.mfaSecrets.get(userId);
    
    if (!mfaData) {
      throw new Error('MFA not configured for user');
    }
    
    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: mfaData.secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps for clock skew
    });
    
    if (verified) {
      // Mark as verified if first time
      if (!mfaData.verified) {
        mfaData.verified = true;
        this.mfaSecrets.set(userId, mfaData);
      }
      return true;
    }
    
    // Check backup codes
    const backupCodes = this.mfaBackupCodes.get(userId);
    if (backupCodes) {
      const codeIndex = backupCodes.findIndex(c => c.code === token && !c.used);
      if (codeIndex !== -1) {
        backupCodes[codeIndex].used = true;
        backupCodes[codeIndex].usedAt = new Date();
        this.mfaBackupCodes.set(userId, backupCodes);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count = 10) {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      codes.push({
        code: crypto.randomBytes(4).toString('hex').toUpperCase(),
        used: false,
        createdAt: new Date()
      });
    }
    
    return codes;
  }

  /**
   * Create session fingerprint
   */
  createSessionFingerprint(req) {
    const fingerprint = {
      userAgent: req.headers['user-agent'],
      acceptLanguage: req.headers['accept-language'],
      acceptEncoding: req.headers['accept-encoding'],
      accept: req.headers['accept'],
      ip: req.ip,
      timestamp: Date.now()
    };
    
    // Generate fingerprint hash
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(fingerprint))
      .digest('hex');
    
    fingerprint.hash = hash;
    
    return fingerprint;
  }

  /**
   * Verify session fingerprint
   */
  verifySessionFingerprint(sessionId, req) {
    const storedFingerprint = this.sessionFingerprints.get(sessionId);
    
    if (!storedFingerprint) {
      // First time, create fingerprint
      const fingerprint = this.createSessionFingerprint(req);
      this.sessionFingerprints.set(sessionId, fingerprint);
      return { valid: true, new: true };
    }
    
    // Check if fingerprint matches
    const currentFingerprint = this.createSessionFingerprint(req);
    
    // Check critical fields
    const matches = {
      userAgent: storedFingerprint.userAgent === currentFingerprint.userAgent,
      ip: storedFingerprint.ip === currentFingerprint.ip,
      language: storedFingerprint.acceptLanguage === currentFingerprint.acceptLanguage
    };
    
    // Calculate match score
    const matchScore = Object.values(matches).filter(m => m).length / Object.keys(matches).length;
    
    if (matchScore < 0.5) {
      // Suspicious change in session
      return {
        valid: false,
        reason: 'Session fingerprint mismatch',
        changes: Object.keys(matches).filter(k => !matches[k])
      };
    }
    
    return { valid: true, matchScore };
  }

  /**
   * Implement secure password recovery
   */
  async generatePasswordResetToken(userId, email) {
    // Generate cryptographically secure token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Store with expiration (1 hour)
    const resetData = {
      userId,
      email,
      hashedToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
      used: false
    };
    
    // In production, store in database
    // For now, store in memory (would need persistent storage)
    
    return {
      token, // Send this to user via secure channel (email)
      expires: new Date(resetData.expiresAt)
    };
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordResetToken(token) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // In production, lookup from database
    // Check if token exists, not expired, and not used
    
    return {
      valid: true,
      userId: 'userId' // Return actual user ID from database
    };
  }

  /**
   * Hash password using bcrypt (for legacy compatibility)
   */
  async hashPassword(password) {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password using bcrypt (for legacy compatibility)
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Get authentication strength report
   */
  getAuthenticationStrength(userId) {
    const hasMFA = this.mfaSecrets.has(userId);
    const mfaData = this.mfaSecrets.get(userId);
    
    let score = 0;
    const factors = [];
    
    // Password/SRP (something you know)
    score += 40;
    factors.push('password');
    
    // MFA (something you have)
    if (hasMFA && mfaData?.verified) {
      score += 40;
      factors.push('mfa');
    }
    
    // Session fingerprinting (something you are - device)
    score += 20;
    factors.push('device-fingerprint');
    
    return {
      score,
      level: score >= 80 ? 'STRONG' : score >= 60 ? 'MEDIUM' : 'WEAK',
      factors,
      recommendations: this.getSecurityRecommendations(score, factors)
    };
  }

  /**
   * Get security recommendations
   */
  getSecurityRecommendations(score, factors) {
    const recommendations = [];
    
    if (!factors.includes('mfa')) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Enable two-factor authentication',
        impact: '+40 security score'
      });
    }
    
    if (score < 80) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Use a stronger password',
        impact: 'Better protection against brute force'
      });
    }
    
    recommendations.push({
      priority: 'LOW',
      action: 'Review active sessions regularly',
      impact: 'Detect unauthorized access'
    });
    
    return recommendations;
  }

  /**
   * Clean up expired sessions
   */
  cleanup() {
    const now = Date.now();
    const sessionTimeout = 5 * 60 * 1000; // 5 minutes for SRP sessions
    
    // Clean SRP sessions
    for (const [sessionId, session] of this.srpSessions) {
      if (now - session.timestamp > sessionTimeout) {
        this.srpSessions.delete(sessionId);
      }
    }
    
    // Clean old fingerprints (keep last 100)
    if (this.sessionFingerprints.size > 100) {
      const sorted = Array.from(this.sessionFingerprints.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      this.sessionFingerprints.clear();
      for (let i = 0; i < 100 && i < sorted.length; i++) {
        this.sessionFingerprints.set(sorted[i][0], sorted[i][1]);
      }
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }
}

// Create singleton instance
const zeroKnowledgeAuthService = new ZeroKnowledgeAuthService();

module.exports = zeroKnowledgeAuthService;
