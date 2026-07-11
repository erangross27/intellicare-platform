/**
 * Custom hook for session management
 * Handles inactivity detection, warnings, and session extension
 * Separate from AuthContext to avoid circular dependencies
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { authAPI } from '../services/apiMigration';

export function useSessionManager(user, onLogout) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const lastActivityRef = useRef(Date.now());
  const timersRef = useRef({});
  
  // Constants - Updated for 1 hour idle time
  const INACTIVITY_WARNING_TIME = 55 * 60 * 1000; // 55 minutes (warn 5 min before logout)
  const WARNING_COUNTDOWN = 300; // 5 minutes in seconds
  const AUTO_LOGOUT_TIME = 60 * 60 * 1000; // 60 minutes total
  
  // Track user activity
  const trackActivity = useCallback(() => {
    if (!user) return;
    
    lastActivityRef.current = Date.now();
    
    // Hide warning if it's showing
    if (showWarning) {
      setShowWarning(false);
      setCountdown(WARNING_COUNTDOWN);
    }
    
    // Clear existing warning timer
    if (timersRef.current.warning) {
      clearTimeout(timersRef.current.warning);
    }
    
    // Set new warning timer
    timersRef.current.warning = setTimeout(() => {
      setShowWarning(true);
      setCountdown(WARNING_COUNTDOWN);
    }, INACTIVITY_WARNING_TIME);
  }, [user, showWarning]);
  
  // Extend session when user chooses to stay logged in
  const extendSession = useCallback(async () => {
    try {
      // Make API call to refresh session and get new CSRF token
      const response = await authAPI.refreshSession();
      
      // Update CSRF token if provided
      if (response?.csrfToken) {
        // Update the global CSRF token
        window.__CSRF_TOKEN = response.csrfToken;
        console.log('✅ CSRF token updated with session refresh');
      }
      
      // Reset activity tracking
      trackActivity();
      setShowWarning(false);
      setCountdown(WARNING_COUNTDOWN);
      
      console.log('✅ Session extended successfully');
      return true;
    } catch (error) {
      console.error('Failed to extend session:', error);
      // If extension fails, trigger logout
      if (onLogout) {
        onLogout();
      }
      return false;
    }
  }, [trackActivity, onLogout]);
  
  // Setup activity listeners
  useEffect(() => {
    if (!user) {
      // Clear any existing timers when user logs out
      if (timersRef.current.warning) {
        clearTimeout(timersRef.current.warning);
        timersRef.current.warning = null;
      }
      if (timersRef.current.countdown) {
        clearInterval(timersRef.current.countdown);
        timersRef.current.countdown = null;
      }
      setShowWarning(false);
      return;
    }
    
    // Activity event handler
    const handleActivity = () => {
      trackActivity();
    };
    
    // Listen for user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });
    
    // Start tracking immediately
    trackActivity();
    
    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      // Clear all timers
      if (timersRef.current.warning) {
        clearTimeout(timersRef.current.warning);
      }
      if (timersRef.current.countdown) {
        clearInterval(timersRef.current.countdown);
      }
    };
  }, [user, trackActivity]);
  
  // Countdown timer when warning is shown
  useEffect(() => {
    if (!showWarning) {
      // Clear countdown timer if warning is hidden
      if (timersRef.current.countdown) {
        clearInterval(timersRef.current.countdown);
        timersRef.current.countdown = null;
      }
      return;
    }
    
    // Start countdown
    timersRef.current.countdown = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Time's up - trigger logout
          clearInterval(timersRef.current.countdown);
          timersRef.current.countdown = null;
          if (onLogout) {
            onLogout();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Cleanup
    return () => {
      if (timersRef.current.countdown) {
        clearInterval(timersRef.current.countdown);
        timersRef.current.countdown = null;
      }
    };
  }, [showWarning, onLogout]);
  
  // Handle session expired events from API
  useEffect(() => {
    const handleSessionExpired = (event) => {
      console.log('⚠️ Session expired detected:', event.detail);
      setShowWarning(false);
      if (onLogout) {
        onLogout();
      }
    };
    
    window.addEventListener('sessionExpired', handleSessionExpired);
    
    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, [onLogout]);
  
  return {
    showWarning,
    countdown,
    extendSession,
    trackActivity
  };
}