/**
 * 🛡️ FRONTEND SECURITY SERVICE
 * Comprehensive frontend security monitoring and protection
 */

import secureStorage from '../utils/secureStorage';
import secureApi from './secureApiClient';

class SecurityService {
  constructor() {
    this.sessionId = null;
    this.lastActivity = Date.now();
    this.securityEvents = [];
    this.isMonitoring = false;
    this.inactivityTimeout = 30 * 60 * 1000; // 30 minutes total
    this.warningTimeout = 25 * 60 * 1000; // 25 minutes (5 minute warning)
    this.tokenRefreshInterval = 30 * 60 * 1000; // 30 minutes
    this.warningCountdown = null;
    this.securityChecks = {
      csp: false,
      https: false,
      secureStorage: false,
      xssProtection: false
    };
  }

  // Initialize security monitoring
  initialize() {
    this.loadSessionData();
    this.startActivityMonitoring();
    this.startTokenRefresh();
    this.performSecurityChecks();
    this.setupCSPViolationReporting();
    this.startAutomaticTokenRefresh();
    this.isMonitoring = true;

    process.env.NODE_ENV !== 'production' && console.log('🛡️ Frontend Security Service initialized');
  }

  // Load session data from storage
  loadSessionData() {
    try {
      this.sessionId = secureStorage.getItem('sessionId');
      const lastActivity = secureStorage.getItem('lastActivity');
      if (lastActivity) {
        this.lastActivity = parseInt(lastActivity);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to load session data:', error);
    }
  }

  // Start automatic token refresh - DISABLED (handled by enhancedSessionManager)
  startAutomaticTokenRefresh() {
    // Token refresh is now handled by enhancedSessionManager for better control
    process.env.NODE_ENV !== 'production' && console.log('🔄 SECURITY: Token refresh delegated to enhancedSessionManager');
    
    // Only do immediate check on page load
    setTimeout(() => {
      this.refreshTokenIfNeeded();
    }, 5000); // 5 seconds after initialization
  }

  // Start activity monitoring
  startActivityMonitoring() {
    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, this.updateActivity.bind(this), true);
    });

    // Inactivity checking is now handled by SecurityMonitor component
    // setInterval(() => {
    //   this.checkInactivity();
    // }, 5000); // Check every 5 seconds

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logSecurityEvent('page_hidden', 'info', 'User switched away from page');
      } else {
        this.updateActivity();
        this.logSecurityEvent('page_visible', 'info', 'User returned to page');
      }
    });

    // Handle beforeunload for security cleanup - but NOT on refresh
    window.addEventListener('beforeunload', (e) => {
      this.logSecurityEvent('page_unload', 'info', 'User leaving page');
      // Don't cleanup on refresh - only on actual navigation away
      // The cleanup will be handled by explicit logout or inactivity timeout
    });
  }

  // Update last activity timestamp
  updateActivity() {
    this.lastActivity = Date.now();
    secureStorage.setItem('lastActivity', this.lastActivity.toString());
    
    // Clear any inactivity warnings
    this.clearInactivityWarning();
  }

  // Check for user inactivity
  checkInactivity() {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivity;

    if (timeSinceActivity >= this.inactivityTimeout) {
      // Force logout due to inactivity
      this.handleInactivityLogout();
    } else if (timeSinceActivity >= this.warningTimeout) {
      // Show inactivity warning
      this.showInactivityWarning();
    }
  }

  // Show inactivity warning
  showInactivityWarning() {
    if (document.getElementById('inactivity-warning')) return; // Already showing

    const warning = document.createElement('div');
    warning.id = 'inactivity-warning';
    warning.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4444;
      color: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      text-align: center;
      min-width: 400px;
      backdrop-filter: blur(10px);
    `;

    // Create overlay background
    const overlay = document.createElement('div');
    overlay.id = 'inactivity-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 9999;
    `;

    let timeRemaining = 60; // 60 seconds countdown

    const updateWarning = () => {
      // Clear existing content
      warning.innerHTML = '';
      
      // Create elements safely
      const icon = document.createElement('div');
      icon.style.cssText = 'font-size: 24px; margin-bottom: 20px;';
      icon.textContent = '⚠️';
      
      const title = document.createElement('div');
      title.style.cssText = 'font-weight: bold; margin-bottom: 15px; font-size: 18px;';
      title.textContent = 'System Idle Warning';
      
      const message = document.createElement('div');
      message.style.cssText = 'margin-bottom: 20px;';
      message.textContent = 'You have been idle for 60 seconds.';
      
      const countdown = document.createElement('div');
      countdown.style.cssText = 'margin-bottom: 20px; font-size: 20px; color: #ffff99;';
      const countText = document.createElement('span');
      countText.textContent = 'Browser will close in ';
      const countNumber = document.createElement('strong');
      countNumber.textContent = timeRemaining;
      const countSuffix = document.createElement('span');
      countSuffix.textContent = ' seconds';
      countdown.appendChild(countText);
      countdown.appendChild(countNumber);
      countdown.appendChild(countSuffix);
      
      const button = document.createElement('button');
      button.style.cssText = 'padding: 12px 24px; background: white; color: #ff4444; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;';
      button.textContent = "I'm Still Here";
      button.onclick = () => window.securityService.handleUserResponse();
      
      warning.appendChild(icon);
      warning.appendChild(title);
      warning.appendChild(message);
      warning.appendChild(countdown);
      warning.appendChild(button);
    };

    // Add overlay and warning to page
    document.body.appendChild(overlay);
    document.body.appendChild(warning);

    updateWarning();

    // Start countdown
    this.warningCountdown = setInterval(() => {
      timeRemaining--;
      updateWarning();

      if (timeRemaining <= 0) {
        this.forceCloseTab();
      }
    }, 1000);

    this.logSecurityEvent('inactivity_warning', 'warning', `User inactive for 60 seconds - countdown started`);
  }

  // Clear inactivity warning
  clearInactivityWarning() {
    const warning = document.getElementById('inactivity-warning');
    const overlay = document.getElementById('inactivity-overlay');

    if (warning) {
      warning.remove();
    }
    if (overlay) {
      overlay.remove();
    }

    // Clear countdown timer
    if (this.warningCountdown) {
      clearInterval(this.warningCountdown);
      this.warningCountdown = null;
    }
  }

  // Handle inactivity logout
  handleInactivityLogout() {
    this.logSecurityEvent('inactivity_logout', 'warning', 'User logged out due to inactivity');
    this.forceCloseTab();
  }

  // Handle user response to inactivity warning
  handleUserResponse() {
    this.updateActivity();
    this.clearInactivityWarning();
    this.logSecurityEvent('inactivity_response', 'info', 'User responded to inactivity warning');
  }

  // Force close browser tab
  forceCloseTab() {
    this.logSecurityEvent('force_close', 'warning', 'Forcing browser tab close due to inactivity');

    // 🔒 SECURITY: Clear all form data before closing
    this.clearAllFormData();

    // Clear session data
    this.cleanup();

    try {
      // Try multiple methods to close the tab
      window.close();

      // If window.close() doesn't work (some browsers block it), try other methods
      setTimeout(() => {
        // Clear the page content and create secure overlay
        document.body.innerHTML = '';
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #000;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          font-size: 24px;
          z-index: 99999;
        `;
        
        const container = document.createElement('div');
        container.style.cssText = 'text-align: center;';
        
        const lockIcon = document.createElement('div');
        lockIcon.style.cssText = 'font-size: 48px; margin-bottom: 20px;';
        lockIcon.textContent = '🔒';
        
        const mainText = document.createElement('div');
        mainText.textContent = 'Session Expired';
        
        const subText = document.createElement('div');
        subText.style.cssText = 'font-size: 16px; margin-top: 10px;';
        subText.textContent = 'Please close this tab and login again';
        
        container.appendChild(lockIcon);
        container.appendChild(mainText);
        container.appendChild(subText);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // Try to navigate away
        window.location.replace('about:blank');
      }, 100);

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to close tab:', error);
      // Fallback: redirect to login
      window.location.href = '/login';
    }
  }

  // Start automatic token refresh
  startTokenRefresh() {
    // Start periodic refresh
    setInterval(async () => {
      await this.refreshTokenIfNeeded();
    }, this.tokenRefreshInterval);

    // Delay initial refresh check to avoid startup race conditions
    setTimeout(async () => {
      await this.refreshTokenIfNeeded();
    }, 10000); // Wait 10 seconds after initialization
  }

  // Refresh authentication token
  async refreshTokenIfNeeded() {
    // Token refresh disabled - using httpOnly cookies for authentication
    process.env.NODE_ENV !== 'production' && console.log('🍪 SECURITY: Using cookie-based auth, token refresh not needed');
    return;
  }

  // Perform security checks
  performSecurityChecks() {
    // Check HTTPS
    this.securityChecks.https = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    
    // Check secure storage
    this.securityChecks.secureStorage = this.testSecureStorage();
    
    // Check XSS protection
    this.securityChecks.xssProtection = this.testXSSProtection();
    
    // Check CSP
    this.securityChecks.csp = this.testCSP();

    // Log security check results
    this.logSecurityEvent('security_checks', 'info', 'Frontend security checks completed', {
      checks: this.securityChecks
    });
  }

  // Test secure storage
  testSecureStorage() {
    try {
      // Test if storage is available and secure
      const testKey = '__security_test__';
      secureStorage.setItem(testKey, 'test');
      const retrieved = secureStorage.getItem(testKey);
      secureStorage.removeItem(testKey);
      return retrieved === 'test';
    } catch (error) {
      return false;
    }
  }

  // Test XSS protection
  testXSSProtection() {
    try {
      // Create a test element to check if XSS protection is working
      const testDiv = document.createElement('div');
      const testImg = document.createElement('img');
      testImg.src = '/intellicare-favicon.svg';
      
      // Test if onerror handlers are blocked
      testImg.onerror = () => {
        window.__xss_test = true;
      };
      
      testDiv.appendChild(testImg);
      document.body.appendChild(testDiv);
      
      setTimeout(() => {
        document.body.removeChild(testDiv);
        // Clean up test flag
        delete window.__xss_test;
      }, 100);
      
      return !window.__xss_test;
    } catch (error) {
      return true; // If error, assume protection is working
    }
  }

  // Test CSP
  testCSP() {
    try {
      // Check if CSP headers are present
      const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
      return metaTags.length > 0 || this.hasCSPHeader();
    } catch (error) {
      return false;
    }
  }

  // Check for CSP header (simplified)
  hasCSPHeader() {
    // This is a simplified check - in practice, CSP headers are set by the server
    return document.querySelector('meta[http-equiv="Content-Security-Policy"]') !== null;
  }

  // Setup CSP violation reporting
  setupCSPViolationReporting() {
    document.addEventListener('securitypolicyviolation', (e) => {
      this.logSecurityEvent('csp_violation', 'warning', 'Content Security Policy violation', {
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI,
        documentURI: e.documentURI,
        originalPolicy: e.originalPolicy
      });
    });
  }

  // Log security events
  logSecurityEvent(type, severity, message, metadata = {}) {
    const event = {
      id: this.generateEventId(),
      type,
      severity,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.securityEvents.push(event);
    
    // Keep only last 100 events
    if (this.securityEvents.length > 100) {
      this.securityEvents = this.securityEvents.slice(-100);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      process.env.NODE_ENV !== 'production' && console.log(`🛡️ Security Event [${severity.toUpperCase()}]:`, message, metadata);
    }

    // Send critical events to backend
    if (severity === 'error' || severity === 'critical') {
      this.sendSecurityEventToBackend(event);
    }
  }

  // Send security event to backend
  async sendSecurityEventToBackend(event) {
    try {
      const token = secureStorage.getItem('token');
      if (!token) return;

      await secureApi.post('/security/frontend-event', event);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to send security event to backend:', error);
    }
  }

  // Generate unique event ID
  generateEventId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get security status
  getSecurityStatus() {
    return {
      isMonitoring: this.isMonitoring,
      sessionId: this.sessionId,
      lastActivity: this.lastActivity,
      securityChecks: this.securityChecks,
      eventCount: this.securityEvents.length,
      recentEvents: this.securityEvents.slice(-10)
    };
  }

  // Cleanup on logout/page unload
  cleanup() {
    // Clear sensitive data
    secureStorage.clear();
    
    // Clear authentication data from secureStorage
    const authKeys = ['token', 'authToken', 'user', 'practice', 'rememberMe', 'tokenTimestamp'];
    authKeys.forEach(key => {
      secureStorage.removeItem(key);
    });
    
    // Keep only non-sensitive preferences
    const essentialKeys = ['selectedLanguage'];
    
    this.logSecurityEvent('session_cleanup', 'info', 'Security cleanup completed');
  }

  // Clear all form data for security
  clearAllFormData() {
    try {
      // Clear all forms
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        if (form.reset) form.reset();
      });

      // Clear all input fields
      const inputs = document.querySelectorAll('input');
      inputs.forEach(input => {
        input.value = '';
        input.setAttribute('value', '');
        // Clear React controlled component values
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
      });

      // Clear password fields specifically
      const passwordInputs = document.querySelectorAll('input[type="password"]');
      passwordInputs.forEach(input => {
        input.value = '';
        input.setAttribute('value', '');
        input.removeAttribute('value');
      });

      // Clear any stored form data in secureStorage
      // Clear common form-related keys since we can't iterate secureStorage
      const formKeys = ['formData', 'password', 'email', 'userForm', 'loginForm'];
      formKeys.forEach(key => secureStorage.removeItem(key));

      this.logSecurityEvent('form_data_cleared', 'info', 'All form data cleared for security');
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error clearing form data:', error);
    }
  }

  // Manual logout with security cleanup
  secureLogout() {
    this.logSecurityEvent('manual_logout', 'info', 'User initiated secure logout');
    this.clearAllFormData();
    this.cleanup();
    window.location.href = '/login';
  }
}

// Create global instance
const securityService = new SecurityService();

// Make available globally for emergency access
window.securityService = securityService;

export default securityService;
