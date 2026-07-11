/**
 * 🔒 SECURE AUTH CONTEXT - MEDICAL PLATFORM
 * 
 * ⚠️  CRITICAL SECURITY WARNING FOR AI AGENTS:
 * 1. ❌ DO NOT store tokens in browser storage
 * 2. ❌ DO NOT implement client-side session management
 * 3. ❌ DO NOT trust client-provided authentication data
 * 4. ✅ ONLY use server-side session validation
 * 5. ✅ ONLY use httpOnly cookies for sessions
 * 
 * VIOLATIONS = IMMEDIATE SECURITY BREACH
 */

import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { authAPI } from '../services/apiMigration';
import securityService from '../services/securityService';
import secureStorage from '../utils/secureStorage';
import { useSessionManager } from '../hooks/useSessionManager';
// Removed crossTabAuth - using single-tab OTP login now

// Lazy load the SessionWarningModal to avoid initial load issues
const SessionWarningModal = lazy(() => import('../components/SessionWarningModal'));

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [practice, setPractice] = useState(null);
  const [loading, setLoading] = useState(true);

  // Update window auth data whenever user or practice changes
  useEffect(() => {
    window.__AUTH_DATA__ = { user, practice };
    window.dispatchEvent(new CustomEvent('authUpdate'));
    process.env.NODE_ENV !== 'production' && console.log('🔄 AUTH: Updated window auth data', { user: user?.email, practice: practice?.name });
  }, [user, practice]);
  
  // ✅ SECURE: Define logout FIRST (before session manager)
  const logout = useCallback(async () => {
    process.env.NODE_ENV !== 'production' && console.log('🔒 AUTH: Secure logout initiated');

    try {
      // ✅ REAL SECURITY: Notify server to terminate session
      // This will invalidate the httpOnly cookie server-side
      await authAPI.logout?.() || Promise.resolve();
    } catch (error) {
      // Continue with logout even if server call fails
      process.env.NODE_ENV !== 'production' && console.warn('Server logout failed, continuing with client logout:', error);
    }

    // Use security service for secure client cleanup
    securityService.secureLogout();

    // Clear auth state
    setUser(null);
    setPractice(null);

    // Clear only non-sensitive local preferences
    secureStorage.removeItem('selectedLanguage');
    secureStorage.removeItem('practiceSubdomain');
    
    process.env.NODE_ENV !== 'production' && console.log('🔒 SECURITY: Secure logout completed - session terminated');
  }, []);
  
  // NOW use session manager (logout is defined)
  const { showWarning, countdown, extendSession, trackActivity } = useSessionManager(user, logout);

  useEffect(() => {
    // Listen for security events
    const handleSecurityTimeout = (event) => {
      process.env.NODE_ENV !== 'production' && console.log('⚠️ Security timeout detected:', event.detail);
      // Force logout
      setUser(null);
      setPractice(null);
      // Clear storage
      secureStorage.clear();
      window.location.href = '/';
    };
    
    // Handle session expired event from API client
    const handleSessionExpired = (event) => {
      console.log('🔒 Session expired, logging out...');
      logout();
    };
    
    // Handle CSRF token expired event
    const handleCSRFExpired = async (event) => {
      console.log('🔄 CSRF token expired, refreshing...');
      try {
        // Make a simple API call to get a new CSRF token
        const response = await authAPI.getCurrentUserAndPractice();
        const userData = response?.data || response;
        
        // Store the new CSRF token
        if (userData?.csrfToken) {
          window.__CSRF_TOKEN = userData.csrfToken;
          console.log('✅ CSRF token refreshed from session check');
        }
      } catch (error) {
        // If we can't refresh, logout
        if (error.status === 401) {
          logout();
        }
      }
    };
    
    // Handle backend restart event - force complete logout
    const handleBackendRestart = async (event) => {
      console.log('🔄 Backend restart detected:', event.detail?.message);
      
      // Clear ALL auth state
      setUser(null);
      setPractice(null);
      
      // Clear all storage
      secureStorage.clear();
      window.__CSRF_TOKEN = null;
      
      // Clear session storage flags
      sessionStorage.removeItem('pendingSessionToken');
      sessionStorage.removeItem('pendingCSRFToken');
      sessionStorage.setItem('backendRestart', 'true');
      
      // Notify user with a more prominent message
      if (typeof window.alert === 'function') {
        window.alert('The server was restarted. Please login again to continue.');
      }
      
      // No need to call logout() as we're already clearing everything
      // The redirect is handled by secureApiClient
    };
    
    window.addEventListener('secureStorageTimeout', handleSecurityTimeout);
    window.addEventListener('sessionExpired', handleSessionExpired);
    window.addEventListener('csrfTokenExpired', handleCSRFExpired);
    window.addEventListener('backendRestart', handleBackendRestart);
    
    // REMOVED: Cross-tab sync listeners - not needed for single-tab OTP flow
    
    const initializeAuth = async () => {
      try {
        // Check if user intentionally logged out - if so, don't auto-login
        if (sessionStorage.getItem('intentionalLogout')) {
          sessionStorage.removeItem('intentionalLogout');
          setLoading(false);
          process.env.NODE_ENV !== 'production' && console.log('🔒 AUTH: Intentional logout detected, skipping auto-login');
          return;
        }
        
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check for pending session token from OTP redirect
        const urlSessionToken = urlParams.get('st');
        const storageSessionToken = sessionStorage.getItem('pendingSessionToken');
        const pendingSessionToken = urlSessionToken || storageSessionToken;
        
        // Also check for pending CSRF token
        const pendingCSRFToken = sessionStorage.getItem('pendingCSRFToken');
        if (pendingCSRFToken) {
          window.__CSRF_TOKEN = pendingCSRFToken;
          sessionStorage.removeItem('pendingCSRFToken');
          console.log('✅ AUTH: Restored pending CSRF token from OTP flow');
        }
        
        if (pendingSessionToken) {
          console.log('🔒 AUTH: Found pending session token from OTP redirect');
          console.log('   From URL:', urlSessionToken ? 'Yes' : 'No');
          console.log('   From Storage:', storageSessionToken ? 'Yes' : 'No');
          
          // Clean up
          if (urlSessionToken) {
            // Remove from URL without reload
            const cleanUrl = new URL(window.location);
            cleanUrl.searchParams.delete('st');
            window.history.replaceState({}, document.title, cleanUrl.toString());
          }
          if (storageSessionToken) {
            sessionStorage.removeItem('pendingSessionToken');
          }
          
          // Set the cookie on this subdomain
          try {
            const response = await authAPI.setSessionCookie(pendingSessionToken);
            const sessionData = response?.data || response;
            
            console.log('✅ AUTH: Session cookie set on subdomain');
            
            // Store CSRF token from response immediately
            if (sessionData?.csrfToken) {
              window.__CSRF_TOKEN = sessionData.csrfToken;
              console.log('✅ AUTH: CSRF token stored from session-from-token response');
              
              // Also try to set it as a cookie for immediate use
              try {
                const hostname = window.location.hostname;
                const isProduction = hostname.includes('intellicare.health');
                let cookieString = `csrfToken=${sessionData.csrfToken}; path=/; SameSite=Strict`;
                if (isProduction) {
                  cookieString += '; Secure';
                }
                document.cookie = cookieString;
                console.log('✅ AUTH: CSRF token cookie set client-side');
              } catch (e) {
                console.warn('⚠️ AUTH: Could not set CSRF cookie:', e);
              }
            }
            
            // Reload to activate the new session
            window.location.reload();
          } catch (error) {
            console.error('❌ AUTH: Failed to set session cookie:', error);
          }
        }
        
        // Check for verification success parameters
        const isVerified = urlParams.get('verified');
        const welcomeName = urlParams.get('welcome');
        
        // Silently check for existing session (expected to fail on first visit)
        // Initialize security service
        securityService.initialize();

        // ✅ REAL SECURITY: Check for server-side session validation
        // No client-side tokens - only httpOnly cookies managed by server
        // Make a request to validate current session (if any)
        const response = await authAPI.getCurrentUserAndPractice();
        
        // Check both response and response.data for user info
        const userData = response?.data || response;
        
        if (userData && userData.user) {
          // ✅ SECURE: Server validated session - user is authenticated
          setUser(userData.user);
          if (userData.practice) {
            setPractice(userData.practice);
          }

          // ✅ CRITICAL: Store CSRF token from session check response
          if (userData.csrfToken) {
            window.__CSRF_TOKEN = userData.csrfToken;
            console.log('✅ AUTH: CSRF token stored from session check');
          }

          process.env.NODE_ENV !== 'production' && console.log('✅ AUTH: Server-validated session restored');
          process.env.NODE_ENV !== 'production' && console.log('✅ AUTH: User authenticated:', userData.user.email);
          if (userData.practice) {
            process.env.NODE_ENV !== 'production' && console.log('✅ AUTH: Practice context:', userData.practice.name);
          }
          
          // Store only non-sensitive preference data locally
          if (userData.user.preferredLanguage) {
            secureStorage.setItem('selectedLanguage', userData.user.preferredLanguage);
          }
          if (userData.practice?.subdomain) {
            secureStorage.setItem('practiceSubdomain', userData.practice.subdomain);
          }
          
          // If just verified and on main domain, redirect to subdomain
          if (isVerified === 'true' && userData.practice?.subdomain) {
            // Show welcome message briefly
            console.log(`✅ Welcome ${welcomeName || userData.user.firstName}! Redirecting to your practice...`);
            
            // Get current host without subdomain
            const currentHost = window.location.hostname;
            const isMainDomain = !currentHost.includes('.') || currentHost === 'intellicare.health' || currentHost === 'localhost';
            
            if (isMainDomain) {
              setTimeout(() => {
                const subdomain = userData.practice.subdomain;
                const protocol = window.location.protocol;
                const port = window.location.port ? `:${window.location.port}` : '';
                const redirectUrl = `${protocol}//${subdomain}.intellicare.health${port}/dashboard`;
                console.log(`🚀 Redirecting to: ${redirectUrl}`);
                window.location.href = redirectUrl;
              }, 2000);
            }
          }
        } else {
          // No valid session - user is not authenticated (this is normal on first load)
          setUser(null);
          setPractice(null);
          
          // Check for verification error
          const error = urlParams.get('error');
          if (error === 'invalid-verification') {
            console.error('❌ Invalid or expired verification link');
          }
        }

      } catch (error) {
        process.env.NODE_ENV !== 'production' && console.error('❌ AUTH: Error during initialization:', error);
      } finally {
        // Ensure a minimum loading time to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
        setLoading(false);
        process.env.NODE_ENV !== 'production' && console.log('✅ AUTH: Authentication initialization complete');
      }
    };

    initializeAuth();
    
    // Cleanup event listeners
    return () => {
      window.removeEventListener('secureStorageTimeout', handleSecurityTimeout);
      window.removeEventListener('sessionExpired', handleSessionExpired);
      window.removeEventListener('csrfTokenExpired', handleCSRFExpired);
      window.removeEventListener('backendRestart', handleBackendRestart);
      // Removed cross-tab listener cleanup - not needed anymore
    };
  }, []);

  // ✅ SECURE: Login function using server-side sessions
  const login = useCallback(async (userData, rememberMe = false) => {
    try {
      // ✅ REAL SECURITY: Server handles all authentication and session creation
      const response = await authAPI.login(userData);
      const { user, practice, csrfToken } = response.data;

      // ❌ REMOVED: Token storage (fake security)
      // ✅ SECURE: Server sets httpOnly cookie automatically
      
      // ✅ SECURE: Store CSRF token for mutations
      if (csrfToken) {
        window.__CSRF_TOKEN = csrfToken;
        process.env.NODE_ENV !== 'production' && console.log('🔐 [FRONTEND] CSRF token stored for mutations');
      }

      // ✅ SECURE: Update client state with server-validated data
      setUser(user);
      if (practice) {
        setPractice(practice);
      }

      // ✅ SECURE: Store only non-sensitive preference data locally
      if (user.preferredLanguage) {
        secureStorage.setItem('selectedLanguage', user.preferredLanguage);
        process.env.NODE_ENV !== 'production' && console.log(`🌐 [FRONTEND] User's preferred language loaded: ${user.preferredLanguage}`);
      }

      return user;
    } catch (err) {
      throw err;
    }
  }, []);

  // ✅ SECURE: Practice-aware login function using server-side sessions
  const practiceLogin = useCallback(async (userData, practiceSubdomain, rememberMe = false) => {
    try {
      // ✅ REAL SECURITY: Server handles all authentication and session creation
      const response = await authAPI.practiceLogin(userData, practiceSubdomain);
      process.env.NODE_ENV !== 'production' && console.log('🔒 Secure practice login response received');
      
      // Handle response format
      const responseData = response.data || response;
      const { user, practice, csrfToken } = responseData;
      
      if (!user) {
        throw new Error('No user data received from server');
      }

      // ❌ REMOVED: Token storage (fake security)
      // ✅ SECURE: Server sets httpOnly cookie automatically
      
      // ✅ SECURE: Store CSRF token for mutations
      if (csrfToken) {
        window.__CSRF_TOKEN = csrfToken;
        process.env.NODE_ENV !== 'production' && console.log('🔐 [FRONTEND] CSRF token stored for mutations');
      }

      // ✅ SECURE: Update client state with server-validated data
      setUser(user);
      if (practice) {
        setPractice(practice);
      }
      // ✅ SECURE: Store only non-sensitive preference data locally
      if (user.preferredLanguage) {
        secureStorage.setItem('selectedLanguage', user.preferredLanguage);
        process.env.NODE_ENV !== 'production' && console.log(`🌐 [FRONTEND] User's preferred language loaded: ${user.preferredLanguage}`);
      }
      
      if (practice?.subdomain) {
        secureStorage.setItem('practiceSubdomain', practice.subdomain);
      }

      // ❌ REMOVED: Token storage and timestamps (fake security)
      // ❌ REMOVED: Remember me token persistence (use server sessions)
      // ✅ SECURE: Only non-sensitive preferences stored locally

      process.env.NODE_ENV !== 'production' && console.log(`🔒 [FRONTEND] Securely logged into practice: ${practice?.name} (${practice?.subdomain})`);
      return { user, practice };
    } catch (err) {
      throw err;
    }
  }, []);

  // ✅ SECURE: Signup function using server-side sessions
  const signup = useCallback(async (userData) => {
    try {
      // ✅ REAL SECURITY: Server handles all registration and session creation
      const response = await authAPI.signup(userData);
      const { user, practice } = response.data;

      // ❌ REMOVED: Token storage (fake security)
      // ✅ SECURE: Server sets httpOnly cookie automatically

      // ✅ SECURE: Update client state with server-validated data
      setUser(user);
      if (practice) {
        setPractice(practice);
      }

      // ✅ SECURE: Store only non-sensitive preference data locally
      if (user.preferredLanguage) {
        secureStorage.setItem('selectedLanguage', user.preferredLanguage);
      }

      return user;
    } catch (err) {
      throw new Error(err.response?.data?.errors?.[0]?.msg || 'Signup failed');
    }
  }, []);

  const updateLanguagePreference = useCallback(async (language) => {
    try {
      // Use axios client with interceptors and practice headers
      const { data } = await authAPI.updateLanguage(language);

      // Update user in state and secureStorage
      const updatedUser = { ...user, preferredLanguage: language };
      setUser(updatedUser);
      secureStorage.setItem('user', JSON.stringify(updatedUser));
      secureStorage.setItem('selectedLanguage', language);

      process.env.NODE_ENV !== 'production' && console.log(`🌐 [FRONTEND] Language preference saved to database: ${language}`);
      return data;
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Error updating language preference:', err);
      throw err;
    }
  }, [user]);

  // 🎯 CRITICAL PERFORMANCE FIX: Memoize context value to prevent re-renders
  const value = useMemo(() => ({
    user,
    practice,
    login,
    practiceLogin,
    signup,
    logout,
    updateLanguagePreference,
    loading,
    setUser,
    setPractice,
    isAuthenticated: !!user,  // Add isAuthenticated flag
    trackActivity  // Expose activity tracking for components
  }), [user, practice, login, practiceLogin, signup, logout, updateLanguagePreference, loading, setUser, setPractice, trackActivity]);

  // 🎯 CRITICAL FIX: Always render children to prevent unmounting/remounting
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
