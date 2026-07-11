const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const secureConfigService = require('../services/secureConfigService');

class TokenManager {
  constructor() {
    this.jwtSecret = secureConfigService.get('JWT_SECRET') || 'your-secret-key';
    this.refreshTokens = new Map(); // In production, use Redis or database
  }

  /**
   * Generate access token with practice context
   */
  generateAccessToken(user, practiceSubdomain, rememberMe = false) {
    const expiresIn = rememberMe ? '30d' : '8h';
    
    const payload = {
      user: {
        id: user._id.toString(),
        email: user.email,
        roles: user.roles || [],
        permissions: user.permissions || [],
        practiceSubdomain: practiceSubdomain
      },
      practice: practiceSubdomain,
      type: 'access',
      rememberMe: rememberMe
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: expiresIn,
      issuer: 'intellicare',
      audience: practiceSubdomain
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId, practiceSubdomain) {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store refresh token (in production, use database)
    this.refreshTokens.set(refreshToken, {
      userId: userId.toString(),
      practiceSubdomain: practiceSubdomain,
      expiresAt: expiresAt,
      createdAt: new Date()
    });

    return refreshToken;
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Check token type
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return {
        valid: true,
        decoded: decoded
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken, practiceSubdomain) {
    const tokenData = this.refreshTokens.get(refreshToken);

    if (!tokenData) {
      throw new Error('Invalid refresh token');
    }

    // Check expiration
    if (new Date() > tokenData.expiresAt) {
      this.refreshTokens.delete(refreshToken);
      throw new Error('Refresh token expired');
    }

    // Check practice match
    if (tokenData.practiceSubdomain !== practiceSubdomain) {
      throw new Error('Token practice mismatch');
    }

    // Get user from database (would need to be passed or fetched)
    // For now, return token data
    return {
      userId: tokenData.userId,
      practiceSubdomain: tokenData.practiceSubdomain
    };
  }

  /**
   * Revoke refresh token
   */
  revokeRefreshToken(refreshToken) {
    return this.refreshTokens.delete(refreshToken);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  revokeAllUserTokens(userId) {
    const tokensToDelete = [];
    
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.userId === userId.toString()) {
        tokensToDelete.push(token);
      }
    }

    tokensToDelete.forEach(token => this.refreshTokens.delete(token));
    return tokensToDelete.length;
  }

  /**
   * Clean expired tokens (run periodically)
   */
  cleanExpiredTokens() {
    const now = new Date();
    const tokensToDelete = [];

    for (const [token, data] of this.refreshTokens.entries()) {
      if (now > data.expiresAt) {
        tokensToDelete.push(token);
      }
    }

    tokensToDelete.forEach(token => this.refreshTokens.delete(token));
    return tokensToDelete.length;
  }

  /**
   * Generate secure session ID
   */
  generateSessionId(userId, practiceSubdomain) {
    const data = `${userId}-${practiceSubdomain}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = new TokenManager();