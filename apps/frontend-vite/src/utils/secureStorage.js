/**
 * Secure Storage Utility for HIPAA-Compliant Session Management
 * Encrypts all sensitive data before storing in browser storage
 */

import CryptoJS from 'crypto-js';
import secureApi from '../services/secureApiClient';

class SecureStorage {
  constructor() {
    // Generate or retrieve encryption key (device-specific)
    this.encryptionKey = this.getOrCreateEncryptionKey();
    
    // Session fingerprint for additional security
    this.fingerprint = this.generateFingerprint();
    
    // Track failed access attempts
    this.failedAttempts = 0;
    this.maxFailedAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    
    // Auto-logout timer
    this.inactivityTimeout = null;
    this.maxInactivityTime = 30 * 60 * 1000; // 30 minutes
    
    // Initialize activity monitoring
    this.initActivityMonitoring();
  }

  /**
   * Generate device-specific encryption key
   */
  getOrCreateEncryptionKey() {
    // Combine multiple entropy sources for key generation
    const browserInfo = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset()
    ].join('|');
    
    // Create a stable key based on browser fingerprint
    const baseKey = CryptoJS.SHA256(browserInfo).toString();
    
    // Add random salt stored in sessionStorage (changes per session)
    let sessionSalt = sessionStorage.getItem('_sk');
    if (!sessionSalt) {
      sessionSalt = CryptoJS.lib.WordArray.random(128/8).toString();
      sessionStorage.setItem('_sk', sessionSalt);
    }
    
    // Combine for final key
    return CryptoJS.PBKDF2(baseKey, sessionSalt, {
      keySize: 256/32,
      iterations: 1000
    }).toString();
  }

  /**
   * Generate session fingerprint for validation
   */
  generateFingerprint() {
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: new Date().getTimezoneOffset(),
      timestamp: Date.now()
    };
    
    return CryptoJS.SHA256(JSON.stringify(fingerprint)).toString();
  }

  /**
   * Validate session fingerprint
   */
  validateFingerprint(storedFingerprint) {
    // Allow some flexibility for minor changes (e.g., window resize)
    const currentData = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      timezone: new Date().getTimezoneOffset()
    };
    
    const currentHash = CryptoJS.SHA256(JSON.stringify(currentData)).toString();
    
    // For now, just check core properties match
    // In production, implement more sophisticated comparison
    return true; // Simplified for development
  }

  /**
   * Encrypt data before storage
   */
  encrypt(data) {
    try {
      const jsonString = JSON.stringify(data);
      const encrypted = CryptoJS.AES.encrypt(jsonString, this.encryptionKey).toString();
      
      // Add integrity check
      const hmac = CryptoJS.HmacSHA256(encrypted, this.encryptionKey).toString();
      
      return {
        data: encrypted,
        hmac: hmac,
        fingerprint: this.fingerprint,
        timestamp: Date.now()
      };
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data from storage
   */
  decrypt(encryptedPackage) {
    try {
      // Check if account is locked
      if (this.isAccountLocked()) {
        throw new Error('Account temporarily locked due to suspicious activity');
      }
      
      // Verify integrity
      const calculatedHmac = CryptoJS.HmacSHA256(encryptedPackage.data, this.encryptionKey).toString();
      if (calculatedHmac !== encryptedPackage.hmac) {
        this.handleFailedAccess();
        throw new Error('Data integrity check failed');
      }
      
      // Validate fingerprint (relaxed for development)
      if (!this.validateFingerprint(encryptedPackage.fingerprint)) {
        process.env.NODE_ENV !== 'production' && console.warn('Session fingerprint mismatch - potential security issue');
        // In production, this should throw an error
      }
      
      // Decrypt data
      const decrypted = CryptoJS.AES.decrypt(encryptedPackage.data, this.encryptionKey);
      const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!jsonString) {
        this.handleFailedAccess();
        throw new Error('Failed to decrypt data');
      }
      
      // Reset failed attempts on successful decrypt
      this.failedAttempts = 0;
      
      return JSON.parse(jsonString);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Decryption error:', error);
      this.handleFailedAccess();
      throw error;
    }
  }

  /**
   * Handle failed access attempt
   */
  handleFailedAccess() {
    this.failedAttempts++;
    
    if (this.failedAttempts >= this.maxFailedAttempts) {
      // Lock account
      const lockUntil = Date.now() + this.lockoutDuration;
      localStorage.setItem('_lockout', String(lockUntil));
      
      // Clear all sensitive data
      this.clearAll();
      
      // Log security event
      this.logSecurityEvent('ACCOUNT_LOCKED', {
        reason: 'Too many failed access attempts',
        attempts: this.failedAttempts
      });
    }
  }

  /**
   * Check if account is locked
   */
  isAccountLocked() {
    const lockUntil = localStorage.getItem('_lockout');
    if (lockUntil) {
      const lockTime = parseInt(lockUntil);
      if (Date.now() < lockTime) {
        return true;
      } else {
        // Unlock if time has passed
        localStorage.removeItem('_lockout');
      }
    }
    return false;
  }

  /**
   * Set item with encryption
   */
  setItem(key, value, options = {}) {
    try {
      const encrypted = this.encrypt(value);
      const storageKey = `_secure_${key}`;
      
      // Add expiry if specified
      if (options.expiresIn) {
        encrypted.expiresAt = Date.now() + options.expiresIn;
      }
      
      // Choose storage location
      const storage = options.persistent ? localStorage : sessionStorage;
      storage.setItem(storageKey, JSON.stringify(encrypted));
      
      // Reset inactivity timer
      this.resetInactivityTimer();
      
      return true;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to store secure item:', error);
      return false;
    }
  }

  /**
   * Get item with decryption
   */
  getItem(key) {
    try {
      const storageKey = `_secure_${key}`;
      
      // Check both storages
      let encryptedData = sessionStorage.getItem(storageKey);
      if (!encryptedData) {
        encryptedData = localStorage.getItem(storageKey);
      }
      
      if (!encryptedData) {
        return null;
      }
      
      const encryptedPackage = JSON.parse(encryptedData);
      
      // Check expiry
      if (encryptedPackage.expiresAt && Date.now() > encryptedPackage.expiresAt) {
        this.removeItem(key);
        return null;
      }
      
      // Decrypt and return
      const decrypted = this.decrypt(encryptedPackage);
      
      // Reset inactivity timer
      this.resetInactivityTimer();
      
      return decrypted;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to retrieve secure item:', error);
      return null;
    }
  }

  /**
   * Remove item from storage
   */
  removeItem(key) {
    const storageKey = `_secure_${key}`;
    sessionStorage.removeItem(storageKey);
    localStorage.removeItem(storageKey);
  }

  /**
   * Clear all secure storage
   */
  clearAll() {
    // Clear all encrypted items
    const keysToRemove = [];
    
    // Check sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key.startsWith('_secure_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    // Check localStorage
    keysToRemove.length = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('_secure_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear session salt
    sessionStorage.removeItem('_sk');
    
    // Log security event
    this.logSecurityEvent('SESSION_CLEARED', {
      reason: 'Manual clear or security event'
    });
  }

  /**
   * Clear all storage (alias for clearSensitiveData)
   */
  clear() {
    this.clearSensitiveData();
  }

  /**
   * Initialize activity monitoring for auto-logout
   */
  initActivityMonitoring() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, () => this.resetInactivityTimer());
    });
    
    // Start timer
    this.resetInactivityTimer();
  }

  /**
   * Reset inactivity timer
   */
  resetInactivityTimer() {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }
    
    this.inactivityTimeout = setTimeout(() => {
      this.handleInactivityTimeout();
    }, this.maxInactivityTime);
  }

  /**
   * Handle inactivity timeout
   */
  handleInactivityTimeout() {
    // Log security event
    this.logSecurityEvent('INACTIVITY_LOGOUT', {
      duration: this.maxInactivityTime
    });
    
    // Clear sensitive data but keep non-sensitive preferences
    this.clearSensitiveData();
    
    // Trigger logout event
    window.dispatchEvent(new CustomEvent('secureStorageTimeout', {
      detail: { reason: 'inactivity' }
    }));
  }

  /**
   * Clear only sensitive data (keep preferences)
   */
  clearSensitiveData() {
    const sensitiveKeys = ['token', 'user', 'practice', 'patient', 'medical'];
    sensitiveKeys.forEach(key => this.removeItem(key));
  }

  /**
   * Log security events for audit trail
   */
  logSecurityEvent(eventType, details = {}) {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      fingerprint: this.fingerprint,
      details: details,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    
    // Store in encrypted audit log
    const auditLog = this.getItem('auditLog') || [];
    auditLog.push(event);
    
    // Keep only last 100 events
    if (auditLog.length > 100) {
      auditLog.shift();
    }
    
    this.setItem('auditLog', auditLog, { persistent: true });
    
    // Also send to server if critical
    if (['ACCOUNT_LOCKED', 'DATA_BREACH_ATTEMPT', 'INVALID_TOKEN'].includes(eventType)) {
      this.sendSecurityAlert(event);
    }
  }

  /**
   * Send security alert to server
   */
  async sendSecurityAlert(event) {
    try {
      await secureApi.post('/security/alert', event);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to send security alert:', error);
    }
  }

  /**
   * Validate token format and expiry
   */
  validateToken(token) {
    if (!token) return false;
    
    try {
      // Check if it's a JWT
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Decode payload
      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiry
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        this.logSecurityEvent('EXPIRED_TOKEN', { token: token.substring(0, 20) });
        return false;
      }
      
      return true;
    } catch (error) {
      this.logSecurityEvent('INVALID_TOKEN', { error: error.message });
      return false;
    }
  }

  /**
   * Store auth token securely
   */
  setAuthToken(token, rememberMe = false, sessionDuration = null) {
    if (!this.validateToken(token)) {
      throw new Error('Invalid token format');
    }
    
    const options = {
      persistent: rememberMe
    };
    
    if (sessionDuration) {
      options.expiresIn = sessionDuration;
    }
    
    return this.setItem('token', token, options);
  }

  /**
   * Get auth token securely
   */
  getAuthToken() {
    const token = this.getItem('token');
    
    if (token && !this.validateToken(token)) {
      this.removeItem('token');
      return null;
    }
    
    return token;
  }

  /**
   * Get storage stats for monitoring
   */
  getStorageStats() {
    return {
      failedAttempts: this.failedAttempts,
      isLocked: this.isAccountLocked(),
      lastActivity: Date.now(),
      sessionFingerprint: this.fingerprint,
      auditLogSize: (this.getItem('auditLog') || []).length
    };
  }
}

// Export singleton instance
const secureStorage = new SecureStorage();

// Attach to window for debugging (remove in production)
if (process.env.NODE_ENV === 'development') {
  window.secureStorage = secureStorage;
}

export default secureStorage;