/**
 * 🚨 SECURE API CLIENT - MEDICAL PLATFORM
 * 
 * ⚠️  CRITICAL SECURITY WARNINGS FOR AI AGENTS:
 * 1. ❌ DO NOT generate keys in frontend - IT'S FAKE SECURITY
 * 2. ❌ DO NOT sign requests in frontend - IT'S MEANINGLESS  
 * 3. ❌ DO NOT encrypt in frontend - USE HTTPS INSTEAD
 * 4. ✅ ONLY use server-provided session tokens
 * 5. ✅ ONLY use CSRF tokens for state changes
 * 
 * VIOLATIONS = IMMEDIATE REJECTION IN CODE REVIEW
 * 
 * This client now implements REAL security patterns:
 * - Server-controlled sessions via httpOnly cookies
 * - CSRF protection for mutations
 * - HTTPS for transport encryption
 * - No client-side cryptography (fake security removed)
 */

import secureStorage from '../utils/secureStorage';

// Error class for API errors
class ApiError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
  
  // Override toString to show meaningful error message
  toString() {
    if (this.response?.message) {
      return this.response.message;
    }
    if (this.response?.error) {
      return this.response.error;
    }
    return this.message || 'API Error';
  }
  
  // For JSON.stringify
  toJSON() {
    return {
      name: this.name,
      message: this.toString(),
      status: this.status
    };
  }
}

class SecureApiClient {
  constructor() {
    // ⚠️ REMOVED: Client-side key generation (FAKE SECURITY)
    // ⚠️ REMOVED: Client-side signing (MEANINGLESS)
    // ⚠️ REMOVED: Client-side encryption (USE HTTPS)
    
    // ✅ ONLY store server-provided tokens and configuration
    this.baseURL = this.getBaseURL();
    this.requestCounter = 0;
    
    // Store original fetch before intercepting
    this.originalFetch = window.fetch?.bind(window);
    
    // Intercept and warn about direct fetch usage
    this.interceptDirectFetch();
    
    // SecureApiClient initialized successfully (removed noisy log)
  }

  /**
   * ✅ CORRECT: Get base URL for API calls
   * Production-like setup: Use relative URLs, let proxy/NGINX handle routing
   */
  getBaseURL() {
    // Always use relative URLs - works identically in dev (Vite proxy) and prod (NGINX)
    // This ensures the proxy handles all /api calls properly
    // No hardcoded ports or hosts = true production architecture
    return ''; // Empty string = use relative URLs through proxy
  }

  /**
   * ❌ REMOVED: generateLocalSigningKey() - FAKE SECURITY
   * ❌ REMOVED: signRequest() - MEANINGLESS FROM CLIENT
   * ❌ REMOVED: encryptSensitiveData() - USE HTTPS INSTEAD
   * ❌ REMOVED: generateFingerprint() - GENERATE SERVER-SIDE
   */

  /**
   * ✅ CORRECT: Get CSRF token for mutations (double-submit cookie pattern)
   * Reads from non-httpOnly cookie for JavaScript access
   */
  getCSRFToken() {
    // First, try to get from cookie (double-submit pattern - 2025 best practice)
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrfToken') {
        return value;
      }
    }
    
    // Fallback: Try to get from meta tag (server-rendered)
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
      return metaTag.getAttribute('content');
    }
    
    // Fallback to global variable set by server (from session-check response)
    // This is crucial after OTP verification when cookies might not be set yet
    if (window.__CSRF_TOKEN) {
      // Also try to set it as a cookie for future requests
      this.setCSRFCookie(window.__CSRF_TOKEN);
      return window.__CSRF_TOKEN;
    }
    
    return null;
  }
  
  /**
   * Set CSRF token as cookie for future requests
   */
  setCSRFCookie(token) {
    try {
      // Set cookie with appropriate settings
      const hostname = window.location.hostname;
      const isProduction = hostname.includes('intellicare.health');
      
      // Build cookie string
      let cookieString = `csrfToken=${token}; path=/; SameSite=Strict`;
      
      // Add secure flag in production
      if (isProduction) {
        cookieString += '; Secure';
      }
      
      // Set the cookie
      document.cookie = cookieString;
      console.log('✅ CSRF token cookie set from stored value');
    } catch (error) {
      console.warn('⚠️ Could not set CSRF cookie:', error);
    }
  }

  /**
   * ✅ CORRECT: Extract practice subdomain from current URL
   */
  getClinicSubdomain() {
    // Extract subdomain from current URL
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Check if we have a subdomain (e.g., medical-center-usa.intellicare.health)
    if (parts.length >= 3 || (parts.length >= 2 && parts[1] === 'localhost')) {
      const subdomain = parts[0];
      // Don't return common non-practice subdomains
      if (!['www', 'api', 'admin', 'app'].includes(subdomain)) {
        return subdomain;
      }
    }
    
    // Fallback: check localStorage for saved practice subdomain
    const savedSubdomain = localStorage.getItem('practiceSubdomain');
    if (savedSubdomain) {
      return savedSubdomain;
    }
    
    return null;
  }

  /**
   * ✅ CORRECT: Prepare real security headers (no fake crypto)
   */
  prepareHeaders(method, path, options = {}, isFormData = false) {
    const headers = {
      // Start with any custom headers
      ...options.headers,
      // Then set our defaults (these will override any conflicting custom headers)
      // Don't set Content-Type for FormData - browser will set it with boundary
      ...(isFormData ? {} : { 'Content-Type': 'application/json' })
      // ✅ REMOVED: X-Request-ID (let backend generate if needed)
      // ✅ REMOVED: X-Client-Version (not needed for security)
    };

    // ✅ CRITICAL: Add practice subdomain header for multi-tenant routing
    const practiceSubdomain = this.getClinicSubdomain();
    if (practiceSubdomain) {
      headers['X-Practice-Subdomain'] = practiceSubdomain;
      // Removed noisy log - subdomain is working correctly
    }
    
    // ✅ FALLBACK: Add session token in header if available (for when cookies don't work across subdomains)
    const sessionToken = secureStorage.getItem('sessionToken');
    if (sessionToken) {
      headers['X-Session-Token'] = sessionToken;
    }

    // ✅ REAL CSRF protection for mutations (except pre-auth endpoints)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      // Skip CSRF for pre-authentication endpoints
      const preAuthEndpoints = ['/api/auth-ai/chat', '/api/auth/login', '/api/auth/signup', 
                               '/api/practice-auth/login', '/api/practice-auth/signup',
                               '/api/passwordless-auth/request-login', '/api/passwordless-auth/magic-login',
                               '/api/passwordless-auth/verify-otp'];
      
      if (!preAuthEndpoints.some(endpoint => path.includes(endpoint))) {
        const csrfToken = this.getCSRFToken();
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        } else {
          // Only warn for endpoints that should have CSRF
          console.warn('⚠️ No CSRF token available for protected mutation request');
        }
      }
    }

    // ❌ REMOVED: X-Request-Signature (fake security)
    // ❌ REMOVED: X-Request-Timestamp (can be spoofed)  
    // ❌ REMOVED: X-Session-Fingerprint (generate server-side)
    
    return headers;
  }

  /**
   * ✅ CORRECT: Make a secure API request with REAL security
   */
  async request(method, path, data = null, options = {}) {
    try {
      // ✅ REMOVED: Token handling - server uses httpOnly cookies
      // ✅ REMOVED: Authorization header - sessions handled via cookies
      
      // Check if data is FormData (for file uploads)
      const isFormData = data instanceof FormData;
      
      // Prepare headers with real security measures
      const headers = this.prepareHeaders(method, path, options, isFormData);

      // ❌ REMOVED: Client-side encryption - HTTPS handles this properly
      // Don't JSON.stringify FormData - send it as-is for multipart
      const body = isFormData ? data : (data ? JSON.stringify(data) : undefined);

      // Make the request with proper security using original fetch
      // Remove headers from options to prevent override
      const { headers: optionHeaders, ...otherOptions } = options;
      
      const response = await this.originalFetch(`${this.baseURL}${path}`, {
        method: method.toUpperCase(),
        headers,
        body,
        credentials: 'include', // ✅ Include httpOnly cookies for session
        ...otherOptions
      });

      // Check for security headers in response
      this.validateResponseHeaders(response);

      // Parse response based on content type or requested response type
      const contentType = response.headers.get('content-type');
      let responseData;

      // Check if blob response was requested
      if (options.responseType === 'blob' || contentType?.includes('application/pdf')) {
        responseData = await response.blob();
      } else if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Handle errors
      if (!response.ok) {
        // For session checks, return a clean response instead of throwing
        if (response.status === 401 && path.includes('session-check')) {
          return {
            success: false,
            user: null,
            practice: null,
            message: 'No session'
          };
        }
        
        // Check for CSRF errors BEFORE throwing generic error
        if (response.status === 403) {
          // Check if CSRF was refreshed due to server restart
          if (responseData?.code === 'CSRF_REFRESHED' && responseData?.csrfToken) {
            console.log('🔄 CSRF token refreshed due to server restart - retrying request');
            console.log('   New token:', responseData.csrfToken.substring(0, 10) + '...');
            console.log('   Request:', method, path);
            console.log('   Already retried?', options._csrfRetried);
            
            // Store the new CSRF token
            window.__CSRF_TOKEN = responseData.csrfToken;
            this.setCSRFCookie(responseData.csrfToken);
            
            // Retry the request ONCE with the new token
            if (!options._csrfRetried) {
              console.log('   ↻ Retrying request with new CSRF token...');
              return await this.request(method, path, data, { ...options, _csrfRetried: true });
            } else {
              console.log('   ❌ Already retried once, not retrying again');
            }
          }
          
          // Check response data for CSRF error codes
          if (responseData?.code === 'INVALID_CSRF_TOKEN' || 
              responseData?.code === 'CSRF_TOKEN_REQUIRED' ||
              responseData?.code === 'SERVER_RESTART') {
            // Handle CSRF error immediately - don't throw, just handle
            await this.handleSecurityError({
              status: 403,
              response: responseData
            });
            // Return empty response to prevent further processing
            return {};
          }
        }
        
        // Handle error message that might be an object
        let errorMessage = responseData.error || 'Request failed';
        if (typeof errorMessage === 'object' && errorMessage !== null) {
          // If it's a translation object, get the appropriate language
          const language = window.localStorage.getItem('selectedLanguage') || 'en';
          errorMessage = errorMessage[language] || errorMessage.en || errorMessage.he || JSON.stringify(errorMessage);
        }
        
        throw new ApiError(
          errorMessage,
          response.status,
          responseData
        );
      }

      // Handle new CSRF token from server (renewed token)
      const newCSRFToken = response.headers.get('X-New-CSRF-Token') || response.headers.get('X-CSRF-Token');
      if (newCSRFToken) {
        window.__CSRF_TOKEN = newCSRFToken;
        // Update the cookie with proper domain setting to match backend
        const hostname = window.location.hostname;
        const isProduction = hostname.includes('intellicare.health');
        const domain = isProduction ? '.intellicare.health' : undefined;
        
        // Build cookie string
        let cookieString = `csrfToken=${newCSRFToken}; path=/; SameSite=Lax`;
        if (domain) {
          cookieString += `; domain=${domain}`;
        }
        
        document.cookie = cookieString;
        console.log('✅ CSRF token renewed automatically');
      }

      return responseData;
    } catch (error) {
      // Handle authentication errors quietly for session checks
      if (error.status === 401) {
        // Don't log 401s for session-check - it's expected on first load
        if (!path.includes('session-check')) {
          process.env.NODE_ENV !== 'production' && console.warn('🔒 Authentication required');
        }
        await this.handleSecurityError(error);
      } else if (error.status === 403) {
        // Check for specific CSRF error codes that indicate backend restart
        if (error.response?.code === 'INVALID_CSRF_TOKEN' || 
            error.response?.code === 'CSRF_TOKEN_REQUIRED') {
          console.warn('⚠️ CSRF token invalid - session lost (likely backend restart). Redirecting to login...');
          
          // Don't retry - immediately redirect to login
          window.__CSRF_TOKEN = null;
          window.location.href = '/login?reason=backend_restart';
          throw error; // Stop processing
        }
        
        // Handle message that might be an object
        const errorMsg = typeof error.message === 'object' ? 
          JSON.stringify(error.message) : 
          error.message;
        
        // Check if it's a recoverable CSRF token error
        if (errorMsg && (errorMsg.includes('CSRF') || errorMsg.includes('csrf'))) {
          console.warn('⚠️ CSRF token error detected, attempting to refresh...');
          
          // Only retry once to avoid infinite loops
          if (!options._csrfRetried) {
            try {
              // Fetch fresh CSRF token from session-check using originalFetch to avoid interceptor
              const sessionResponse = await this.originalFetch('/api/practice-auth/session-check', {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Accept': 'application/json'
                }
              });
              
              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                
                // Store new CSRF token
                if (sessionData.csrfToken) {
                  window.__CSRF_TOKEN = sessionData.csrfToken;
                  this.setCSRFCookie(sessionData.csrfToken);
                  console.log('✅ CSRF token refreshed successfully');
                  
                  // Retry the original request with new token
                  // Fix: Pass correct parameters (method, path, data, options)
                  return this.request(method, path, data, { ...options, _csrfRetried: true });
                }
              }
            } catch (refreshError) {
              console.error('❌ Failed to refresh CSRF token:', refreshError);
            }
          }
        }
        
        process.env.NODE_ENV !== 'production' && console.error('🔒 Access forbidden:', errorMsg);
        await this.handleSecurityError(error);
      }
      throw error;
    }
  }

  /**
   * ✅ CORRECT: Validate response security headers
   */
  validateResponseHeaders(response) {
    // Only validate security headers on API responses, not error pages
    if (response.status >= 400) {
      return; // Skip validation for error responses
    }
    
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection'
    ];

    let missingHeaders = [];
    for (const header of requiredHeaders) {
      if (!response.headers.get(header)) {
        missingHeaders.push(header);
      }
    }
    
    // Only log if multiple headers are missing (indicates real issue)
    if (missingHeaders.length >= 2) {
      process.env.NODE_ENV !== 'production' && console.warn(`Missing security headers: ${missingHeaders.join(', ')}`);
    }

    // Check for security indicators (silently)
    const securityLevel = response.headers.get('X-Security-Level');
    // Only log security level changes or warnings, not routine checks
    if (securityLevel && securityLevel !== 'HIPAA-Compliant') {
      process.env.NODE_ENV !== 'production' && console.warn(`⚠️ Security level: ${securityLevel}`);
    }
  }

  /**
   * Handle security errors (401, 403)
   */
  async handleSecurityError(error) {
    if (error.status === 401) {
      // Session expired - clear any stale data
      window.__CSRF_TOKEN = null;
      secureStorage.clear(); // Clear all stored data
      
      // Emit session expired event for AuthContext to handle
      window.dispatchEvent(new CustomEvent('sessionExpired', { 
        detail: { 
          message: 'Session expired',
          timestamp: Date.now() 
        } 
      }));
      
      // Force logout and redirect
      setTimeout(() => {
        // Give AuthContext a moment to handle the event
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?reason=session_expired';
        }
      }, 100);
    } else if (error.status === 403) {
      // Check if this is a CSRF token error due to backend restart/session invalidation
      if (error.response?.code === 'INVALID_CSRF_TOKEN' || 
          error.response?.code === 'CSRF_TOKEN_REQUIRED' ||
          error.response?.code === 'SERVER_RESTART') {
        console.warn('⚠️ CSRF token invalid - backend was restarted. Forcing complete logout...');
        
        // Try to call logout endpoint to invalidate session server-side
        // Use originalFetch to avoid infinite loop
        try {
          await this.originalFetch('/api/practice-auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          console.log('✅ Server session invalidated');
        } catch (logoutError) {
          console.warn('⚠️ Could not reach logout endpoint, continuing with client-side cleanup');
        }
        
        // Clear ALL session data
        window.__CSRF_TOKEN = null;
        secureStorage.clear();
        
        // Clear all cookies to ensure complete logout
        document.cookie.split(";").forEach(function(c) { 
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        // Emit backend restart event for AuthContext
        window.dispatchEvent(new CustomEvent('backendRestart', { 
          detail: { 
            message: 'Backend was restarted - please login again',
            timestamp: Date.now() 
          } 
        }));
        
        // Force immediate redirect to login with clear message
        window.location.href = '/login?reason=backend_restart&message=' + encodeURIComponent('Server was restarted. Please login again.');
        return; // Stop processing
      }
      
      // Other CSRF errors might be recoverable
      if ((typeof error.response?.error === 'string' && error.response.error.includes('CSRF')) || 
          (typeof error.response?.message === 'string' && error.response.message.includes('CSRF'))) {
        console.warn('⚠️ CSRF token expired - attempting refresh...');
        // Clear the stale token
        window.__CSRF_TOKEN = null;
        
        // Emit event to refresh CSRF token
        window.dispatchEvent(new CustomEvent('csrfTokenExpired', {
          detail: { timestamp: Date.now() }
        }));
      } else {
        // Access forbidden - log for security monitoring
        console.error('🚨 Access forbidden - possible security violation');
      }
    }
  }

  /**
   * ⚠️ SECURITY: Intercept direct fetch usage and warn
   */
  interceptDirectFetch() {
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch.bind(window);
      
      // Override fetch with proper binding
      window.fetch = function(url, options = {}) {
        // Validate arguments to prevent swapped parameters
        if (typeof url !== 'string') {
          console.error('❌ Invalid fetch call - first argument must be a URL string, got:', typeof url, url);
          console.trace();
          // Try to recover if arguments are swapped
          if (typeof options === 'string' && typeof url === 'object') {
            console.warn('⚠️ Attempting to fix swapped fetch arguments');
            return originalFetch(options, url);
          }
          throw new TypeError('Failed to execute fetch: first argument must be a URL string');
        }
        
        // Allow requests to non-API endpoints
        if (!url.includes('/api/') && !url.includes('/auth') && !url.includes('/practice')) {
          return originalFetch(url, options);
        }

        // Block direct API calls for security
        console.error('❌ SECURITY VIOLATION: Direct fetch() to API endpoint blocked!');
        console.error('URL attempted:', url);
        console.error('You MUST use secureApi client for all API calls:');
        console.error('import secureApi from "./services/secureApiClient";');
        console.error('const data = await secureApi.get("/api/endpoint");');
        console.trace();

        // Throw error to prevent the insecure request
        throw new Error('Direct API calls are forbidden. Use secureApiClient instead.');
      };
    }
  }

  /**
   * ✅ Convenience methods for HTTP verbs
   */
  async get(path, options = {}) {
    return this.request('GET', path, null, options);
  }

  async post(path, data, options = {}) {
    return this.request('POST', path, data, options);
  }

  async put(path, data, options = {}) {
    return this.request('PUT', path, data, options);
  }

  async patch(path, data, options = {}) {
    return this.request('PATCH', path, data, options);
  }

  async delete(path, options = {}) {
    return this.request('DELETE', path, null, options);
  }

  /**
   * ✅ Stream POST request with real-time response chunks
   * For Server-Sent Events (SSE) style streaming
   */
  async streamingPost(path, data, onChunk, options = {}) {
    try {
      // Prepare headers with real security measures
      const headers = this.prepareHeaders('POST', path, options, false);

      // Make the streaming request
      const response = await this.originalFetch(`${this.baseURL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include', // ✅ Include httpOnly cookies for session
        ...options
      });

      // Check for security headers in response
      this.validateResponseHeaders(response);

      // Handle errors
      if (!response.ok) {
        throw new ApiError(
          `Streaming request failed: ${response.statusText}`,
          response.status,
          await response.json().catch(() => ({}))
        );
      }

      // Get the reader for streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (lines ending with \n\n)
        const lines = buffer.split('\n');

        // Keep the last incomplete line in buffer
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onChunk(data);
            } catch (parseError) {
              // Skip lines that aren't valid JSON
            }
          }
        }
      }

      // Process any remaining data
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6));
          onChunk(data);
        } catch (parseError) {
          // Skip
        }
      }
    } catch (error) {
      if (error.status === 401) {
        await this.handleSecurityError(error);
      } else if (error.status === 403) {
        await this.handleSecurityError(error);
      }
      throw error;
    }
  }
}

// Export singleton instance
export default new SecureApiClient();

/**
 * 🚨 SECURITY NOTES FOR AI AGENTS:
 * 
 * This implementation removes all fake security:
 * 1. ❌ No client-side key generation
 * 2. ❌ No client-side signing  
 * 3. ❌ No client-side encryption
 * 4. ✅ Uses HTTPS for transport security
 * 5. ✅ Uses httpOnly cookies for sessions
 * 6. ✅ Uses CSRF tokens for mutations
 * 7. ✅ Server controls all security validation
 * 
 * This is how banks, hospitals, and secure systems actually work.
 * Client-side cryptography is security theater - don't add it back!
 */