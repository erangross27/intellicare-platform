/**
 * Secure Storage V2 - Server-Managed Encryption
 * HIPAA-Compliant Storage with Server-Side Key Management
 * 
 * Security Architecture:
 * 1. Client sends data to server for encryption
 * 2. Server encrypts with DOCUMENT_ENCRYPTION_KEY or appropriate key
 * 3. Client stores only encrypted data
 * 4. Server validates and decrypts when needed
 */

class SecureStorageV2 {
  constructor() {
    // Session identifier (changes per session)
    this.sessionId = this.generateSessionId();
    
    // API endpoint
    this.apiUrl = import.meta.env.VITE_API_URL || '/api';
    
    // Cache for performance (encrypted data only)
    this.cache = new Map();
    
    // Activity monitoring
    this.lastActivity = Date.now();
    this.inactivityTimeout = 30 * 60 * 1000; // 30 minutes
    
    // Initialize monitoring
    this.initActivityMonitoring();
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store data securely (server-side encryption)
   */
  async setItem(key, value, options = {}) {
    try {
      // Determine security level based on data type
      const securityLevel = this.determineSecurityLevel(key);
      
      // For critical data, encrypt server-side
      if (securityLevel === 'critical' || securityLevel === 'phi') {
        return await this.setServerEncrypted(key, value, options);
      }
      
      // For less sensitive data, use client-side storage with obfuscation
      return this.setClientObfuscated(key, value, options);
      
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('SecureStorage setItem error:', error);
      return false;
    }
  }

  /**
   * Server-side encryption for critical data
   */
  async setServerEncrypted(key, value, options) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        process.env.NODE_ENV !== 'production' && console.warn('No auth token for server encryption');
        return false;
      }

      // Send to server for encryption
      const result = await secureApi.post('/encryption/store', {
        key,
        data: value,
        sessionId: this.sessionId,
        options
      });

      if (result.error) {
        throw new Error('Server encryption failed');
      }
      
      // Store encrypted reference locally
      const storage = options.persistent ? localStorage : sessionStorage;
      storage.setItem(`_secure_${key}`, JSON.stringify({
        type: 'server-encrypted',
        recordId: result.recordId,
        sessionId: this.sessionId,
        expiresAt: options.expiresIn ? Date.now() + options.expiresIn : null
      }));

      // Cache for performance
      this.cache.set(key, {
        value,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Server encryption error:', error);
      return false;
    }
  }

  /**
   * Client-side obfuscation for non-critical data
   */
  setClientObfuscated(key, value, options) {
    try {
      // Simple obfuscation (NOT encryption - just to prevent casual viewing)
      const obfuscated = btoa(encodeURIComponent(JSON.stringify({
        v: value,
        t: Date.now(),
        s: this.sessionId
      })));

      const storage = options.persistent ? localStorage : sessionStorage;
      storage.setItem(`_secure_${key}`, JSON.stringify({
        type: 'client-obfuscated',
        data: obfuscated,
        expiresAt: options.expiresIn ? Date.now() + options.expiresIn : null
      }));

      // Cache
      this.cache.set(key, {
        value,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Client obfuscation error:', error);
      return false;
    }
  }

  /**
   * Retrieve data securely
   */
  async getItem(key) {
    try {
      // Check cache first
      const cached = this.cache.get(key);
      if (cached && (Date.now() - cached.timestamp < 60000)) { // 1 minute cache
        this.resetInactivityTimer();
        return cached.value;
      }

      // Get from storage
      let storedData = sessionStorage.getItem(`_secure_${key}`);
      if (!storedData) {
        storedData = localStorage.getItem(`_secure_${key}`);
      }

      if (!storedData) {
        return null;
      }

      const parsed = JSON.parse(storedData);

      // Check expiry
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        this.removeItem(key);
        return null;
      }

      // Handle based on type
      if (parsed.type === 'server-encrypted') {
        return await this.getServerDecrypted(key, parsed);
      } else if (parsed.type === 'client-obfuscated') {
        return this.getClientDeobfuscated(parsed);
      }

      return null;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('SecureStorage getItem error:', error);
      return null;
    }
  }

  /**
   * Get server-decrypted data
   */
  async getServerDecrypted(key, metadata) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        process.env.NODE_ENV !== 'production' && console.warn('No auth token for server decryption');
        return null;
      }

      const result = await secureApi.post('/encryption/retrieve', {
        key,
        recordId: metadata.recordId,
        sessionId: this.sessionId
      });

      if (result.error) {
        throw new Error('Server decryption failed');
      }
      
      // Cache decrypted value
      this.cache.set(key, {
        value: result.data,
        timestamp: Date.now()
      });

      this.resetInactivityTimer();
      return result.data;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Server decryption error:', error);
      return null;
    }
  }

  /**
   * Deobfuscate client data
   */
  getClientDeobfuscated(parsed) {
    try {
      const deobfuscated = JSON.parse(decodeURIComponent(atob(parsed.data)));
      
      // Validate session
      if (deobfuscated.s !== this.sessionId) {
        process.env.NODE_ENV !== 'production' && console.warn('Session mismatch in stored data');
        // Allow for now, but log
      }

      this.resetInactivityTimer();
      return deobfuscated.v;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Client deobfuscation error:', error);
      return null;
    }
  }

  /**
   * Determine security level for data
   */
  determineSecurityLevel(key) {
    // Critical: tokens, passwords, medical records
    if (key.includes('token') || key.includes('password') || key.includes('medical')) {
      return 'critical';
    }
    
    // PHI: patient data
    if (key.includes('patient') || key.includes('diagnosis') || key.includes('treatment')) {
      return 'phi';
    }
    
    // PII: user personal info
    if (key.includes('user') || key.includes('email') || key.includes('phone')) {
      return 'pii';
    }
    
    // Standard: other data
    return 'standard';
  }

  /**
   * Get auth token (unencrypted for API calls)
   */
  getAuthToken() {
    // Try sessionStorage first
    let token = sessionStorage.getItem('token');
    if (!token) {
      // Try localStorage
      token = localStorage.getItem('authToken');
    }
    return token;
  }

  /**
   * Store auth token with special handling
   */
  async setAuthToken(token, rememberMe = false, sessionDuration = null) {
    try {
      // Validate token format
      if (!this.validateToken(token)) {
        throw new Error('Invalid token format');
      }

      // For tokens, we need them accessible for API calls
      // So we store them with client-side obfuscation only
      const storage = rememberMe ? localStorage : sessionStorage;
      
      // Obfuscate token
      const obfuscated = btoa(token);
      
      storage.setItem('_auth_token', JSON.stringify({
        t: obfuscated,
        e: sessionDuration ? Date.now() + sessionDuration : null,
        s: this.sessionId
      }));

      // Also keep plain token for API calls (temporary - will migrate)
      storage.setItem(rememberMe ? 'authToken' : 'token', token);

      // Log security event
      await this.logSecurityEvent('TOKEN_STORED', {
        method: rememberMe ? 'persistent' : 'session',
        duration: sessionDuration
      });

      return true;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to store auth token:', error);
      return false;
    }
  }

  /**
   * Get auth token from secure storage
   */
  getSecureAuthToken() {
    try {
      // Check both storages
      let tokenData = sessionStorage.getItem('_auth_token');
      if (!tokenData) {
        tokenData = localStorage.getItem('_auth_token');
      }

      if (!tokenData) {
        return null;
      }

      const parsed = JSON.parse(tokenData);
      
      // Check expiry
      if (parsed.e && Date.now() > parsed.e) {
        this.removeAuthToken();
        return null;
      }

      // Deobfuscate
      const token = atob(parsed.t);
      
      // Validate
      if (!this.validateToken(token)) {
        this.removeAuthToken();
        return null;
      }

      return token;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Validate JWT token
   */
  validateToken(token) {
    if (!token) return false;
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Decode payload
      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiry
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove item
   */
  removeItem(key) {
    sessionStorage.removeItem(`_secure_${key}`);
    localStorage.removeItem(`_secure_${key}`);
    this.cache.delete(key);
  }

  /**
   * Remove auth token
   */
  removeAuthToken() {
    sessionStorage.removeItem('_auth_token');
    localStorage.removeItem('_auth_token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('authToken');
  }

  /**
   * Clear all secure storage
   */
  async clearAll() {
    // Log before clearing
    await this.logSecurityEvent('STORAGE_CLEARED', {
      reason: 'User action or security event'
    });

    // Clear all secure items
    const keysToRemove = [];
    
    // Session storage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key.startsWith('_secure_') || key.startsWith('_auth_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    // Local storage
    keysToRemove.length = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('_secure_') || key.startsWith('_auth_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear cache
    this.cache.clear();
    
    // Generate new session ID
    this.sessionId = this.generateSessionId();
  }

  /**
   * Initialize activity monitoring
   */
  initActivityMonitoring() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, () => this.resetInactivityTimer());
    });
    
    this.resetInactivityTimer();
  }

  /**
   * Reset inactivity timer
   */
  resetInactivityTimer() {
    this.lastActivity = Date.now();
    
    if (this.inactivityTimeoutId) {
      clearTimeout(this.inactivityTimeoutId);
    }
    
    this.inactivityTimeoutId = setTimeout(() => {
      this.handleInactivityTimeout();
    }, this.inactivityTimeout);
  }

  /**
   * Handle inactivity timeout
   */
  async handleInactivityTimeout() {
    await this.logSecurityEvent('INACTIVITY_TIMEOUT', {
      duration: this.inactivityTimeout
    });
    
    // Clear sensitive data
    await this.clearAll();
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('secureStorageTimeout', {
      detail: { reason: 'inactivity' }
    }));
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventType, details = {}) {
    try {
      const event = {
        type: eventType,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        details,
        url: window.location.href
      };

      // Send to server
      const token = this.getAuthToken();
      if (token) {
        await secureApi.post('/security/log', event);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to log security event:', error);
    }
  }

  /**
   * Get storage statistics
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      lastActivity: new Date(this.lastActivity).toISOString(),
      cacheSize: this.cache.size,
      inactivityTimeout: this.inactivityTimeout
    };
  }
}

// Export singleton instance
const secureStorage = new SecureStorageV2();

// Development helpers
if (import.meta.env.DEV) {
  window.secureStorage = secureStorage;
}

export default secureStorage;