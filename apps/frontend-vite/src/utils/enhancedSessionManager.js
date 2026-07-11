/**
 * Enhanced Session Manager
 * Handles both short-term (2-hour) and long-term (30-day) sessions
 * with automatic token renewal and seamless user experience
 */

import secureStorage from '../utils/secureStorage';
import { encryptPassword } from './e2eEncryption';
import secureApi from '../services/secureApiClient';

class EnhancedSessionManager {
  constructor() {
    this.tokenRefreshInterval = null;
    this.inactivityTimer = null;
    this.isRefreshing = false;
    
    // Session types
    this.SESSION_TYPES = {
      SHORT: 'short',    // 2 hours
      LONG: 'long'       // 30 days
    };
    
    // Refresh intervals
    this.REFRESH_INTERVALS = {
      SHORT: 25 * 60 * 1000,    // 25 minutes (before 30-min timeout)
      LONG: 6 * 60 * 60 * 1000  // 6 hours for long sessions
    };
    
    this.initialize();
  }
  
  initialize() {
    this.startTokenRefreshCycle();
    this.setupActivityTracking();
    this.checkExistingSession();
  }
  
  // Check if user has existing valid session
  checkExistingSession() {
    try {
      const rememberSession = secureStorage.getItem('rememberSession');
      const sessionExpiry = secureStorage.getItem('sessionExpiry');
      const token = secureStorage.getItem('token') || secureStorage.getItem('token');
      
      if (sessionExpiry && token) {
        const expiryTime = parseInt(sessionExpiry);
        const now = Date.now();
        
        if (now < expiryTime) {
          // Session is still valid
          const sessionType = rememberSession === 'true' ? this.SESSION_TYPES.LONG : this.SESSION_TYPES.SHORT;
          process.env.NODE_ENV !== 'production' && console.log(`✅ Valid ${sessionType} session found, auto-restoring...`);
          return true;
        } else {
          // Session expired, clean up
          this.clearExpiredSession();
          return false;
        }
      }
      
      return false;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to check existing session:', error);
      return false;
    }
  }
  
  // Set session type and expiry based on user preference
  setSessionPreference(rememberSession) {
    try {
      const sessionType = rememberSession ? this.SESSION_TYPES.LONG : this.SESSION_TYPES.SHORT;
      const expiryTime = rememberSession 
        ? Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
        : Date.now() + (2 * 60 * 60 * 1000);      // 2 hours
      
      secureStorage.setItem('rememberSession', rememberSession.toString());
      secureStorage.setItem('sessionExpiry', expiryTime.toString());
      secureStorage.setItem('sessionType', sessionType);
      
      // Update refresh interval based on session type
      this.updateRefreshInterval(sessionType);
      
      process.env.NODE_ENV !== 'production' && console.log(`📝 Session preference set: ${sessionType} (expires: ${new Date(expiryTime).toLocaleString()})`);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to set session preference:', error);
    }
  }
  
  // Update token refresh interval based on session type
  updateRefreshInterval(sessionType) {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }
    
    const interval = this.REFRESH_INTERVALS[sessionType.toUpperCase()] || this.REFRESH_INTERVALS.SHORT;
    
    this.tokenRefreshInterval = setInterval(() => {
      this.refreshTokenIfNeeded();
    }, interval);
    
    process.env.NODE_ENV !== 'production' && console.log(`🔄 Token refresh interval set to ${interval / 60000} minutes for ${sessionType} session`);
  }
  
  // Start token refresh cycle
  startTokenRefreshCycle() {
    // Check immediately
    this.refreshTokenIfNeeded();
    
    // Default to short session interval, will be updated by setSessionPreference
    this.updateRefreshInterval(this.SESSION_TYPES.SHORT);
  }
  
  // Refresh token if needed (seamless background operation)
  async refreshTokenIfNeeded() {
    if (this.isRefreshing) {
      return; // Prevent multiple simultaneous refresh attempts
    }
    
    try {
      this.isRefreshing = true;
      
      const token = secureStorage.getItem('token') || secureStorage.getItem('token');
      const sessionExpiry = secureStorage.getItem('sessionExpiry');
      const rememberSession = secureStorage.getItem('rememberSession') === 'true';
      
      if (!token || !sessionExpiry) {
        return;
      }
      
      const expiryTime = parseInt(sessionExpiry);
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      
      // For short sessions: refresh when 5 minutes remain
      // For long sessions: refresh when 1 day remains
      const refreshThreshold = rememberSession 
        ? 24 * 60 * 60 * 1000  // 1 day before expiry
        : 5 * 60 * 1000;       // 5 minutes before expiry
      
      if (timeUntilExpiry <= refreshThreshold) {
        process.env.NODE_ENV !== 'production' && console.log(`🔄 Refreshing token (${Math.round(timeUntilExpiry / 60000)} minutes until expiry)`);
        
        const practice = secureStorage.getItem('practiceSubdomain');
        const sessionId = secureStorage.getItem('currentChatAuthSessionId');
        
        if (!practice || !sessionId) {
          process.env.NODE_ENV !== 'production' && console.warn('⚠️ Missing practice or session ID for token refresh');
          return;
        }
        
        const data = await secureApi.post('/auth/refresh', {
          rememberSession: rememberSession
        }, {
          headers: {
            'x-auth-token': token,
            'x-practice-subdomain': practice,
            'x-session-id': sessionId
          }
        });
        
        if (!data.error) {
          
          if (data.success && data.token) {
            // Update token in storage
            secureStorage.setItem('token', data.token);
            if (rememberSession) {
              secureStorage.setItem('token', data.token);
            }
            
            // Update expiry time
            const newExpiryTime = rememberSession 
              ? Date.now() + (30 * 24 * 60 * 60 * 1000) // Reset to 30 days
              : Date.now() + (2 * 60 * 60 * 1000);      // Reset to 2 hours
            
            secureStorage.setItem('sessionExpiry', newExpiryTime.toString());
            
            process.env.NODE_ENV !== 'production' && console.log('✅ Token refreshed successfully');
          } else {
            process.env.NODE_ENV !== 'production' && console.warn('⚠️ Token refresh response missing token');
          }
        } else if (response.status === 401) {
          // Token is invalid, user needs to re-authenticate
          process.env.NODE_ENV !== 'production' && console.log('🔄 Token refresh failed (401), session expired');
          this.clearExpiredSession();
        } else {
          process.env.NODE_ENV !== 'production' && console.warn(`⚠️ Token refresh failed with status: ${response.status}`);
        }
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('❌ Token refresh failed:', error);
    } finally {
      this.isRefreshing = false;
    }
  }
  
  // Setup activity tracking to extend sessions
  setupActivityTracking() {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const resetInactivityTimer = () => {
      // Only update expiry for active sessions
      const sessionExpiry = secureStorage.getItem('sessionExpiry');
      const rememberSession = secureStorage.getItem('rememberSession') === 'true';
      
      if (sessionExpiry && !rememberSession) {
        // For short sessions, extend by 2 hours on activity
        const newExpiry = Date.now() + (2 * 60 * 60 * 1000);
        secureStorage.setItem('sessionExpiry', newExpiry.toString());
      }
    };
    
    // Throttle activity tracking to avoid excessive updates
    let lastActivity = 0;
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastActivity > 60000) { // Only update once per minute
        lastActivity = now;
        resetInactivityTimer();
      }
    };
    
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledReset, true);
    });
  }
  
  // Clear expired session
  clearExpiredSession() {
    try {
      // Clear all session-related items
      secureStorage.removeItem('token');
      secureStorage.removeItem('token');
      secureStorage.removeItem('sessionExpiry');
      secureStorage.removeItem('rememberSession');
      secureStorage.removeItem('sessionType');
      secureStorage.removeItem('user');
      secureStorage.removeItem('user');
      secureStorage.removeItem('practice');
      secureStorage.removeItem('practice');
      
      // Clear refresh interval
      if (this.tokenRefreshInterval) {
        clearInterval(this.tokenRefreshInterval);
        this.tokenRefreshInterval = null;
      }
      
      process.env.NODE_ENV !== 'production' && console.log('🧹 Expired session cleared');
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to clear expired session:', error);
    }
  }
  
  // Get session info
  getSessionInfo() {
    try {
      const rememberSession = secureStorage.getItem('rememberSession') === 'true';
      const sessionExpiry = secureStorage.getItem('sessionExpiry');
      const sessionType = secureStorage.getItem('sessionType') || this.SESSION_TYPES.SHORT;
      
      if (sessionExpiry) {
        const expiryTime = parseInt(sessionExpiry);
        const timeRemaining = expiryTime - Date.now();
        
        return {
          type: sessionType,
          rememberSession,
          expiryTime,
          timeRemaining,
          isValid: timeRemaining > 0,
          expiresIn: this.formatTimeRemaining(timeRemaining)
        };
      }
      
      return null;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to get session info:', error);
      return null;
    }
  }
  
  // Format time remaining for display
  formatTimeRemaining(milliseconds) {
    const days = Math.floor(milliseconds / (24 * 60 * 60 * 1000));
    const hours = Math.floor((milliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) {
      return `${days} days, ${hours} hours`;
    } else if (hours > 0) {
      return `${hours} hours, ${minutes} minutes`;
    } else {
      return `${minutes} minutes`;
    }
  }
  
  // Cleanup on destroy
  destroy() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }
}

// Create singleton instance
const enhancedSessionManager = new EnhancedSessionManager();

export default enhancedSessionManager;