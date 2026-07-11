import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// Removed crossTabAuth - using single-tab OTP login now
import { authAPI } from '../services/apiMigration';

import secureStorage from '../utils/secureStorage';
const MagicLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setPractice } = useAuth();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Verifying your login link...');

  // Detect language preference
  const lang = secureStorage.getItem('selectedLanguage') || 'en';
  const isHebrew = lang === 'he';

  // Language strings
  const texts = {
    processing: {
      en: 'Verifying Login',
      he: 'מאמת התחברות'
    },
    processingMessage: {
      en: 'Verifying your login link...',
      he: 'מאמת את קישור ההתחברות שלך...'
    },
    success: {
      en: 'Login Successful!',
      he: 'התחברות הצליחה!'
    },
    successMessage: {
      en: 'Login successful! You can now close this tab.',
      he: 'ההתחברות הצליחה! כעת ניתן לסגור את הכרטיסייה הזו.'
    },
    closeTabMessage: {
      en: 'You can safely close this tab',
      he: 'ניתן לסגור את הכרטיסייה בבטחה'
    },
    originalTabMessage: {
      en: 'The original tab will automatically enter the system',
      he: 'הכרטיסייה המקורית תיכנס אוטומטית למערכת'
    },
    error: {
      en: 'Login Failed',
      he: 'ההתחברות נכשלה'
    },
    invalidLink: {
      en: 'Invalid login link. Please request a new one.',
      he: 'קישור התחברות לא תקין. אנא בקש חדש.'
    }
  };

  useEffect(() => {
    const processLogin = async () => {
      const token = searchParams.get('token');
      const userId = searchParams.get('userId');
      const practiceParam = searchParams.get('practice');
      
      // Extract practice subdomain
      let practiceSubdomain = practiceParam;
      if (!practiceSubdomain) {
        const hostParts = window.location.hostname.split('.');
        if (hostParts.length >= 3) {
          practiceSubdomain = hostParts[0];
        } else if (hostParts.length === 2 && hostParts[1] === 'localhost') {
          practiceSubdomain = hostParts[0];
        }
      }

      if (!token || !userId || !practiceSubdomain) {
        setStatus('error');
        setMessage(texts.invalidLink[lang]);
        return;
      }

      process.env.NODE_ENV !== 'production' && console.log('🔍 Magic login with practice:', practiceSubdomain);

      try {
        // ✅ REAL SECURITY: Verifying magic link with server-side sessions
        const response = await authAPI.verifyMagicLink({
          token, 
          userId, 
          practice: practiceSubdomain
        });
        
        const data = response; // secureApiClient returns the data directly, not wrapped

        if (data?.success) {
          process.env.NODE_ENV !== 'production' && console.log('✅ Magic login successful! Data:', data);
          process.env.NODE_ENV !== 'production' && console.log('📦 Server-side session created, cookie set automatically');
          setStatus('success');
          setMessage(texts.successMessage[lang]);
          
          // ❌ REMOVED: All token storage (fake client security)
          // ✅ SECURE: Server automatically set httpOnly cookie
          
          const { user, practice } = data;
          
          // ✅ SECURE: Store only non-sensitive preference data
          if (user?.preferredLanguage) {
            secureStorage.setItem('selectedLanguage', user.preferredLanguage);
          }
          if (practice?.subdomain) {
            secureStorage.setItem('practiceSubdomain', practice.subdomain);
          }
          
          // Set completion flag for cross-tab sync
          secureStorage.setItem('magic_login_completed', Date.now().toString());
          
          // REMOVED: Cross-tab broadcast - not needed for single-tab OTP flow
          
          // Trigger storage event for cross-tab sync
          try {
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'magic_login_completed',
              newValue: Date.now().toString(),
              url: window.location.href,
              storageArea: localStorage
            }));
          } catch (err) {
            process.env.NODE_ENV !== 'production' && console.log('Storage event dispatch failed:', err);
          }
          
          // Show success message with proper translation
          setMessage(texts.successMessage[lang]);
          
          // Don't navigate - user should close this tab manually
        } else {
          setStatus('error');
          setMessage(data.message?.[lang] || data.message?.en || texts.invalidLink[lang]);
        }
      } catch (error) {
        setStatus('error');
        setMessage(texts.invalidLink[lang]);
        process.env.NODE_ENV !== 'production' && console.error('Magic login error:', error);
      }
    };

    processLogin();
  }, [searchParams, navigate, lang]);

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
        maxWidth: '400px',
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
            <h2 style={{ marginBottom: '10px', color: '#ffffff' }}>{texts.processing[lang]}</h2>
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
            <h2 style={{ marginBottom: '10px', color: '#ffffff' }}>{texts.success[lang]}</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '20px', fontSize: '18px' }}>
              {message}
            </p>
            
            {/* Clear instruction to close tab */}
            <div style={{
              padding: '20px',
              background: 'rgba(34, 197, 94, 0.15)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '12px',
              border: '2px solid rgba(34, 197, 94, 0.4)',
              marginBottom: '15px'
            }}>
              <p style={{
                fontSize: '20px',
                color: '#ffffff',
                margin: '0 0 10px 0',
                fontWeight: 'bold'
              }}>
                ✅ {texts.closeTabMessage[lang]}
              </p>
            </div>

            {/* Info about original tab */}
            <div style={{
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.9)',
                margin: 0
              }}>
                ℹ️ {texts.originalTabMessage[lang]}
              </p>
            </div>
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
            <h2 style={{ marginBottom: '10px', color: '#ffffff' }}>{texts.error[lang]}</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '20px' }}>{message}</p>
            <button
              onClick={() => navigate('/')}
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
              Back to Chat
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

export default MagicLogin;