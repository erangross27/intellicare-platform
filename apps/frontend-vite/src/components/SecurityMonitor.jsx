import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../config/languagesStatic';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const SecurityMonitor = ({ children }) => {
  const { logout, user } = useAuth();
  const { t } = useLanguage();

  // Check if user has long-term session (30 days) - don't enforce inactivity logout
  const rememberSession = secureStorage.getItem('rememberSession') === 'true';

  // Security settings for medical platform - adjusted based on session type
  const INACTIVITY_WARNING_TIME = rememberSession ? null : 25 * 60 * 1000; // No warning for long sessions
  const INACTIVITY_LOGOUT_TIME = rememberSession ? null : 30 * 60 * 1000;   // No logout for long sessions

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Reset activity timer
  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
    setCountdown(0);
  }, []);

  // Force logout with security logging and tab closure
  const forceLogout = useCallback(async () => {
    process.env.NODE_ENV !== 'production' && console.log('🚨 SECURITY: Auto-logout due to inactivity - forcing tab closure');

    // Log security event
    try {
      await secureApi.post('/security/log', {
        event: 'AUTO_LOGOUT_INACTIVITY_FORCE_CLOSE',
        userId: user?.id,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ip: 'client-side' // Server will capture real IP
      });
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to log security event:', error);
    }

    // Preserve language setting before clearing storage
    const currentLanguage = secureStorage.getItem('selectedLanguage');

    // Clear all storage and logout (medical security)
    secureStorage.clear();
    secureStorage.clear();

    // Restore language setting
    if (currentLanguage) {
      secureStorage.setItem('selectedLanguage', currentLanguage);
    }

    // Also clear any cached data
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }

    logout();

    // Force close browser tab
    forceCloseTab();
  }, [logout, user]);

  // Force close browser tab with fallback methods
  const forceCloseTab = useCallback(() => {
    process.env.NODE_ENV !== 'production' && console.log('🔒 SECURITY: Attempting to force close browser tab');

    try {
      // Method 1: Try to close the window
      window.close();

      // Method 2: If window.close() doesn't work, clear the page and show session expired message
      setTimeout(() => {
        // Create secure session expired overlay without innerHTML
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 24px;
          z-index: 99999;
          text-align: center;
        `;
        
        const container = document.createElement('div');
        
        const lockIcon = document.createElement('div');
        lockIcon.style.cssText = 'font-size: 64px; margin-bottom: 30px;';
        lockIcon.textContent = '🔒';
        
        const title = document.createElement('div');
        title.style.cssText = 'font-size: 32px; margin-bottom: 20px; font-weight: bold;';
        title.textContent = t('sessionExpired') || 'Session Expired';
        
        const message = document.createElement('div');
        message.style.cssText = 'font-size: 18px; margin-bottom: 30px; color: #ccc;';
        message.textContent = t('idleWarningMessage') || 'You have been idle for 60 seconds.';
        
        const instruction = document.createElement('div');
        instruction.style.cssText = 'font-size: 16px; color: #999;';
        instruction.textContent = 'Please close this tab and login again';
        
        container.appendChild(lockIcon);
        container.appendChild(title);
        container.appendChild(message);
        container.appendChild(instruction);
        overlay.appendChild(container);
        
        // Clear body and append overlay
        document.body.innerHTML = '';
        document.body.appendChild(overlay);

        // Method 3: Try to navigate away as final fallback
        setTimeout(() => {
          window.location.replace('about:blank');
        }, 2000);

      }, 100);

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to close tab:', error);
      // Ultimate fallback: redirect to login
      window.location.href = '/login?reason=inactivity';
    }
  }, [t]);

  // Extend session
  const extendSession = useCallback(() => {
    resetActivity();
    process.env.NODE_ENV !== 'production' && console.log('🔒 SECURITY: Session extended by user action');
  }, [resetActivity]);


  // Activity event listeners
  useEffect(() => {
    if (!user) return; // Only monitor when logged in

    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 
      'touchstart', 'click', 'focus', 'blur'
    ];

    const handleActivity = () => {
      resetActivity();
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [user, resetActivity]);

  // Inactivity monitoring
  useEffect(() => {
    if (!user) return;

    const checkInactivity = () => {
      // Skip inactivity checks for long-term sessions (30 days)
      if (rememberSession) {
        return;
      }
      
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;

      if (INACTIVITY_LOGOUT_TIME && timeSinceActivity >= INACTIVITY_LOGOUT_TIME) {
        // Force logout (only for short sessions)
        forceLogout();
      } else if (INACTIVITY_WARNING_TIME && timeSinceActivity >= INACTIVITY_WARNING_TIME && !showWarning) {
        // Show warning (only for short sessions)
        setShowWarning(true);
        setCountdown(Math.ceil((INACTIVITY_LOGOUT_TIME - timeSinceActivity) / 1000));
      }
    };

    const interval = setInterval(checkInactivity, 1000); // Check every second
    return () => clearInterval(interval);
  }, [user, lastActivity, showWarning, forceLogout, INACTIVITY_WARNING_TIME, INACTIVITY_LOGOUT_TIME, rememberSession]);

  // Countdown timer
  useEffect(() => {
    if (!showWarning || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          forceLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showWarning, countdown, forceLogout]);

  // Visibility change detection for logging
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        process.env.NODE_ENV !== 'production' && console.log('🔒 SECURITY: Page hidden - user switched away from medical system');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Format countdown time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {children}
      
      {/* Inactivity Warning Modal */}
      {showWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            textAlign: 'center',
            maxWidth: '400px',
            border: '3px solid #e74c3c'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px'
            }}>
              🚨
            </div>
            
            <h2 style={{
              color: '#e74c3c',
              marginBottom: '15px',
              fontSize: '24px'
            }}>
              {t('idleWarningTitle') || 'System Idle Warning'}
            </h2>

            <p style={{
              marginBottom: '20px',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              {t('idleWarningMessage') || 'You have been idle for 60 seconds.'}
            </p>

            <div style={{
              marginBottom: '20px',
              fontSize: '18px',
              color: '#333'
            }}>
              {t('browserWillCloseIn') || 'Browser will close in'} <strong style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#e74c3c'
              }}>{countdown}</strong> {t('seconds') || 'seconds'}
            </div>

            <button
              onClick={extendSession}
              style={{
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              {t('imStillHere') || "I'm Still Here"}
            </button>

          </div>
        </div>
      )}
    </>
  );
};

export default SecurityMonitor;
