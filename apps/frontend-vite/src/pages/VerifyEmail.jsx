import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
// Removed crossTabAuth - using single-tab OTP login now
const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setPractice } = useAuth();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Verifying your email...');
  const [showSessionOptions, setShowSessionOptions] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  
  // Detect language preference
  const lang = secureStorage.getItem('selectedLanguage') || 'en';
  const isHebrew = lang === 'he';

  // Language strings
  const texts = {
    verifying: {
      en: 'Verifying Email',
      he: 'מאמת אימייל'
    },
    verifyingMessage: {
      en: 'Verifying your email...',
      he: 'מאמת את כתובת האימייל שלך...'
    },
    verified: {
      en: 'Verified!',
      he: 'אומת בהצלחה!'
    },
    verifiedMessage: {
      en: 'Email verified successfully! Redirecting to login...',
      he: 'האימייל אומת בהצלחה! מעביר לדף התחברות...'
    },
    sessionQuestion: {
      en: 'How long would you like to stay logged in?',
      he: 'לכמה זמן תרצה להישאר מחובר?'
    },
    sessionSecurity: {
      en: 'Choose your session duration for security:',
      he: 'בחר את משך ההתחברות לאבטחה:'
    },
    oneDay: {
      en: '1 Day',
      he: 'יום אחד'
    },
    oneDayDesc: {
      en: 'High Security (Recommended for shared devices)',
      he: 'אבטחה גבוהה (מומלץ למכשירים משותפים)'
    },
    oneDayNote: {
      en: 'Session expires after 24 hours',
      he: 'ההתחברות תפוג אחרי 24 שעות'
    },
    sevenDays: {
      en: '7 Days',
      he: '7 ימים'
    },
    sevenDaysDesc: {
      en: 'Balanced (Good for personal devices)',
      he: 'מאוזן (טוב למכשירים אישיים)'
    },
    sevenDaysNote: {
      en: 'Convenient with good security',
      he: 'נוח עם אבטחה טובה'
    },
    thirtyDays: {
      en: '30 Days',
      he: '30 יום'
    },
    thirtyDaysDesc: {
      en: 'Stay Logged In (Personal device only)',
      he: 'הישאר מחובר (מכשיר אישי בלבד)'
    },
    thirtyDaysNote: {
      en: 'Maximum convenience',
      he: 'נוחות מקסימלית'
    },
    hipaaNotice: {
      en: '🔒 HIPAA Notice: For medical data security, always choose shorter sessions on shared computers.',
      he: '🔒 הודעת HIPAA: לאבטחת מידע רפואי, תמיד בחר התחברות קצרה במחשבים משותפים.'
    },
    redirecting: {
      en: 'Session set. Redirecting...',
      he: 'ההתחברות הוגדרה. מעביר...'
    },
    failed: {
      en: 'Verification Failed',
      he: 'האימות נכשל'
    },
    invalidLink: {
      en: 'Invalid verification link. Missing required parameters.',
      he: 'קישור אימות לא תקין. חסרים פרמטרים נדרשים.'
    },
    tryAgain: {
      en: 'Verification failed. Please try again.',
      he: 'האימות נכשל. אנא נסה שוב.'
    },
    backToSignup: {
      en: 'Back to Signup',
      he: 'חזרה להרשמה'
    }
  };

  useEffect(() => {
    const processVerification = async () => {
      const token = searchParams.get('token');
      const userId = searchParams.get('userId');
      const practiceParam = searchParams.get('practice');
      
      process.env.NODE_ENV !== 'production' && console.log('🔍 [DEBUG] Verification parameters:', {
        token: token ? token.substring(0, 10) + '...' : null,
        userId,
        practiceParam,
        fullUrl: window.location.href,
        search: window.location.search,
        allParams: Array.from(searchParams.entries())
      });
      
      // Extract practice - MUST have practice for security
      const hostParts = window.location.hostname.split('.');
      let practice = null;
      
      // Priority 1: Get from URL parameter (most reliable)
      if (practiceParam) {
        practice = practiceParam;
        process.env.NODE_ENV !== 'production' && console.log('✅ [DEBUG] Using practice from URL param:', practice);
      } 
      // Priority 2: Get from subdomain
      else if (hostParts.length >= 3) {
        // e.g., medical-center.intellicare.health
        practice = hostParts[0];
        process.env.NODE_ENV !== 'production' && console.log('📍 [DEBUG] Using practice from subdomain:', practice);
      } else if (hostParts.length >= 2 && hostParts[1] === 'localhost') {
        // e.g., medical-center.localhost
        practice = hostParts[0];
        process.env.NODE_ENV !== 'production' && console.log('📍 [DEBUG] Using practice from localhost subdomain:', practice);
      }

      // ALL three parameters are REQUIRED for security
      if (!token || !userId || !practice) {
        process.env.NODE_ENV !== 'production' && console.error('❌ [DEBUG] Missing required parameters:', {
          token: !!token, 
          userId: !!userId, 
          practice: !!practice,
          practiceValue: practice 
        });
        setStatus('error');
        setMessage(texts.invalidLink[lang]);
        return;
      }

      process.env.NODE_ENV !== 'production' && console.log('🔐 Verifying email for practice:', practice);

      try {
        // SECURE API: Verifying email with token
        const data = await secureApi.post('/api/passwordless-auth/verify-email', {
          token, 
          userId, 
          practice
        }, {
          headers: {
            'X-Practice-Subdomain': practice
          }
        });

        if (data.success) {
          setStatus('success');
          setMessage(texts.verifiedMessage[lang]);
          
          process.env.NODE_ENV !== 'production' && console.log('✅ [DEBUG] Email verified successfully');
          process.env.NODE_ENV !== 'production' && console.log('📊 [DEBUG] Response data:', {
            autoLogin: data.autoLogin,
            redirectUrl: data.redirectUrl,
            hasUser: !!data.user,
            hasPractice: !!data.practice
          });
          
          // NEW FLOW: Check for auto-login response from backend
          if (data.autoLogin && data.redirectUrl) {
            process.env.NODE_ENV !== 'production' && console.log('🚀 [DEBUG] Auto-login detected! Redirecting to practice...');
            
            // Store session token if provided (fallback if cookie doesn't work)
            if (data.sessionToken) {
              secureStorage.setItem('sessionToken', data.sessionToken);
              process.env.NODE_ENV !== 'production' && console.log('🔑 [DEBUG] Session token stored for fallback auth');
            }
            
            // Store user and practice info for AuthContext
            if (data.user) {
              setUser(data.user);
              if (data.user.email) {
                secureStorage.setItem('verifiedEmail', data.user.email);
              }
            }
            
            if (data.practice) {
              setPractice(data.practice);
              secureStorage.setItem('practiceSubdomain', data.practice.subdomain);
            }
            
            // Store CSRF token globally for subsequent requests
            if (data.csrfToken) {
              window.__CSRF_TOKEN = data.csrfToken;
              process.env.NODE_ENV !== 'production' && console.log('🔐 CSRF token stored for mutations');
            }
            
            // REMOVED: Cross-tab broadcast - not needed for single-tab OTP flow
            
            // Update message to show auto-login success
            setMessage({
              en: `✅ Email verified! Loading your practice...`,
              he: `✅ האימייל אומת! טוען את המרפאה שלך...`
            }[lang]);
            
            // Set status to show loading overlay
            setStatus('redirecting');
            
            // Store user's preferred language for immediate application
            if (data.user?.preferredLanguage) {
              secureStorage.setItem('selectedLanguage', data.user.preferredLanguage);
            }
            
            // Redirect to the practice subdomain with minimal delay
            setTimeout(() => {
              process.env.NODE_ENV !== 'production' && console.log(`🔄 [DEBUG] Redirecting to: ${data.redirectUrl}`);
              window.location.href = data.redirectUrl;
            }, 500); // Reduced delay for faster transition
            
          } 
          // OLD FLOW: Check if we should redirect to subdomain (backwards compatibility)
          else if (data.redirectToSubdomain || data.redirectToLogin) {
            process.env.NODE_ENV !== 'production' && console.log('📝 Email verified! Notifying other tabs...');
            
            // Store verification info for login page
            if (data.user && data.user.email) {
              secureStorage.setItem('verifiedEmail', data.user.email);
              secureStorage.setItem('emailVerified', 'true');
            }
            
            // Store practice info if available
            if (data.practice) {
              secureStorage.setItem('practice', JSON.stringify(data.practice));
            }
            
            // SECURE CROSS-TAB COMMUNICATION
            // Notify registration tab to redirect to subdomain
            const practiceSubdomain = data.practice?.subdomain || practiceParam;
            
            if (practiceSubdomain && typeof BroadcastChannel !== 'undefined') {
              try {
                // Use BroadcastChannel for same-origin secure communication
                const channel = new BroadcastChannel('intellicare-verification');
                const message = {
                  type: 'EMAIL_VERIFIED',
                  subdomain: practiceSubdomain,
                  email: data.user?.email,
                  timestamp: Date.now()
                };
                console.log('📡 Broadcasting verification message:', message);
                channel.postMessage(message);
                
                // Don't close immediately - give time for message to send
                setTimeout(() => {
                  channel.close();
                  console.log('📡 BroadcastChannel closed after sending');
                }, 100);
                
                console.log('✅ Sent verification notification to registration tab');
              } catch (err) {
                console.error('❌ BroadcastChannel error:', err);
              }
            } else {
              console.log('⚠️ Cannot send broadcast:', { 
                hasSubdomain: !!practiceSubdomain, 
                hasBroadcastChannel: typeof BroadcastChannel !== 'undefined' 
              });
            }
            
            // Show success message then close this tab
            setTimeout(() => {
              if (practiceSubdomain) {
                // Display message before closing
                setMessage({
                  en: 'Email verified! You can close this tab and return to the registration tab.',
                  he: 'האימייל אומת! ניתן לסגור חלון זה ולחזור לחלון ההרשמה.'
                }[lang]);
                
                // Auto-close verification tab after showing message
                setTimeout(() => {
                  window.close();
                  // If window.close() doesn't work (some browsers block it)
                  // Show permanent message
                  setMessage({
                    en: 'Email verified! Please close this tab and return to your registration tab.',
                    he: 'האימייל אומת! אנא סגור חלון זה וחזור לחלון ההרשמה.'
                  }[lang]);
                }, 2000);
              }
            }, 1000);
          } else if (data.token) {
            // Old flow - if token is provided, log in directly
            process.env.NODE_ENV !== 'production' && console.log('🔐 Token provided, logging in directly...');
            
            // Store authentication data
            secureStorage.setItem('token', data.token);
            secureStorage.setItem('user', JSON.stringify(data.user));
            secureStorage.setItem('practice', JSON.stringify(data.practice));
            
            // Also store in localStorage for persistence
            secureStorage.setItem('authToken', data.token);
            secureStorage.setItem('user', JSON.stringify(data.user));
            secureStorage.setItem('practice', JSON.stringify(data.practice));
            secureStorage.setItem('rememberMe', 'true');
            secureStorage.setItem('sessionExpiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
            
            // Mark email as verified
            secureStorage.setItem('emailVerified', 'true');
            
            // Redirect to main app (already authenticated)
            setTimeout(() => {
              // Set authentication context
              setUser(data.user);
              setPractice(data.practice);
              
              // Navigate smoothly to home
              process.env.NODE_ENV !== 'production' && console.log('✅ Authenticated, navigating to app...');
              navigate('/', { replace: true });
            }, 1500);
          }
        } else {
          setStatus('error');
          setMessage(data.message?.[lang] || data.message?.en || texts.tryAgain[lang]);
        }
      } catch (error) {
        setStatus('error');
        setMessage(texts.tryAgain[lang]);
        process.env.NODE_ENV !== 'production' && console.error('Email verification error:', error);
      }
    };

    processVerification();
  }, [searchParams, lang]);

  const completeLogin = (duration) => {
    const data = verificationData;
    if (!data) return;

    // Calculate expiry based on duration
    let expiryMs;
    let rememberMe = false;
    
    switch(duration) {
      case '1d':
        expiryMs = 24 * 60 * 60 * 1000; // 1 day
        break;
      case '7d':
        expiryMs = 7 * 24 * 60 * 60 * 1000; // 7 days
        rememberMe = true;
        break;
      case '30d':
        expiryMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        rememberMe = true;
        break;
      default:
        expiryMs = 24 * 60 * 60 * 1000;
    }

    // Store auth data - always in sessionStorage for current session
    secureStorage.setItem('token', data.token);
    secureStorage.setItem('user', JSON.stringify(data.user));
    
    // Persist to localStorage based on duration
    if (rememberMe) {
      secureStorage.setItem('authToken', data.token);
      secureStorage.setItem('user', JSON.stringify(data.user));
      secureStorage.setItem('rememberMe', 'true');
      secureStorage.setItem('sessionExpiry', (Date.now() + expiryMs).toString());
    } else {
      // Clear any previous persistent auth for security
      secureStorage.removeItem('authToken');
      secureStorage.removeItem('rememberMe');
      secureStorage.removeItem('sessionExpiry');
    }
    
    // Update auth context
    setUser(data.user);
    if (data.practice) {
      setPractice(data.practice);
      secureStorage.setItem('practice', JSON.stringify(data.practice));
    }

    // Update message
    setShowSessionOptions(false);
    setStatus('success');
    setMessage(texts.redirecting[lang]);
    
    // Redirect to subdomain if needed
    setTimeout(() => {
      const currentHost = window.location.hostname;
      const isSubdomain = currentHost.split('.').length >= 3 || 
                        (currentHost.includes('localhost') && currentHost.split('.').length >= 2);
      
      const targetSubdomain = data.practiceParam || (data.practice && data.practice.subdomain);
      
      if (!isSubdomain && targetSubdomain) {
        const redirectUrl = window.location.protocol + '//' + 
          (window.location.hostname === 'localhost' || window.location.hostname.includes('localhost')
            ? `${targetSubdomain}.localhost:${window.location.port || '3000'}`
            : `${targetSubdomain}.intellicare.health`) + '/';
        window.location.href = redirectUrl;
      } else {
        navigate('/');
      }
    }, 1500);
  };

  // Show full-screen loading overlay when redirecting
  if (status === 'redirecting') {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e22ce 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        zIndex: 9999
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '3px solid rgba(255, 255, 255, 0.2)',
          borderTopColor: 'rgba(167, 139, 250, 0.8)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{
          marginTop: '20px',
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {message}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e22ce 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      direction: isHebrew ? 'rtl' : 'ltr',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Floating orbs background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0
      }}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(167, 139, 250, ${0.15 - i * 0.02}) 0%, transparent 70%)`,
              width: `${200 + i * 100}px`,
              height: `${200 + i * 100}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `float ${20 + i * 5}s ease-in-out infinite`,
              animationDelay: `${i * 2}s`
            }}
          />
        ))}
      </div>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        maxWidth: '500px',
        width: '90%',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        position: 'relative',
        zIndex: 1
      }}>
        {status === 'processing' && (
          <>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid rgba(255, 255, 255, 0.2)',
              borderTop: '4px solid rgba(167, 139, 250, 0.8)',
              borderRadius: '50%',
              margin: '0 auto 20px',
              animation: 'spin 1s linear infinite'
            }} />
            <h2 style={{ marginBottom: '10px', color: '#ffffff' }}>{texts.verifying[lang]}</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: '50px',
              height: '50px',
              background: 'rgba(34, 197, 94, 0.3)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '2px solid rgba(34, 197, 94, 0.5)',
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '30px', color: '#ffffff' }}>✓</span>
            </div>
            <h2 style={{ marginBottom: '10px', color: '#ffffff' }}>{texts.verified[lang]}</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{message}</p>
          </>
        )}


        {status === 'error' && (
          <>
            <div style={{
              width: '50px',
              height: '50px',
              background: 'rgba(239, 68, 68, 0.3)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '2px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '30px', color: '#ffffff' }}>✕</span>
            </div>
            <h2 style={{ marginBottom: '10px', color: '#ffffff' }}>
              {texts.failed[lang]}
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '20px' }}>{message}</p>
            <button
              onClick={() => navigate('/signup')}
              style={{
                background: 'rgba(167, 139, 250, 0.2)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#ffffff',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(167, 139, 250, 0.3)';
                e.target.style.borderColor = 'rgba(167, 139, 250, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(167, 139, 250, 0.2)';
                e.target.style.borderColor = 'rgba(167, 139, 250, 0.3)';
              }}
            >
              {texts.backToSignup[lang]}
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(10px, -20px) scale(1.05); }
          50% { transform: translate(-15px, 10px) scale(0.95); }
          75% { transform: translate(15px, 15px) scale(1.02); }
        }
      `}</style>
    </div>
  );
};

export default VerifyEmail;