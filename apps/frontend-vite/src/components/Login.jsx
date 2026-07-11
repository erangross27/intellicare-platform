import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../config/languagesStatic';
import PracticeSelector from './PracticeSelector';
import MFAVerification from './MFAVerification';
import { authAPI } from '../services/apiMigration';

import secureStorage from '../utils/secureStorage';
const Login = () => {
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();

  // Determine text direction based on language
  const textDirection = isRTL ? 'rtl' : 'ltr';
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [showClinicSelector, setShowPracticeSelector] = useState(true);
  const [showMFA, setShowMFA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [mfaAttempts, setMfaAttempts] = useState(3);

  const { setUser, setPractice } = useAuth();
  const navigate = useNavigate();

  // Check if practice is provided in URL params or localStorage
  useEffect(() => {
    const practiceFromUrl = searchParams.get('practice');
    const practiceFromStorage = secureStorage.getItem('practiceSubdomain');
    
    // Check for saved credentials (Remember me feature)
    const savedCredentials = secureStorage.getItem('intellicare_remember');
    if (savedCredentials) {
      try {
        const { email, practice, expiresAt } = JSON.parse(savedCredentials);
        const now = new Date().getTime();
        
        // Check if credentials haven't expired (30 days)
        if (expiresAt && now < expiresAt) {
          setFormData(prev => ({ ...prev, email }));
          setSelectedPractice(practice);
          setShowPracticeSelector(false);
          setRememberMe(true);
        } else {
          // Expired - clean up
          secureStorage.removeItem('intellicare_remember');
        }
      } catch (e) {
        process.env.NODE_ENV !== 'production' && console.error('Failed to parse saved credentials:', e);
        secureStorage.removeItem('intellicare_remember');
      }
    }

    if (practiceFromUrl) {
      setSelectedPractice(practiceFromUrl);
      setShowPracticeSelector(false);
    } else if (practiceFromStorage && !savedCredentials) {
      setSelectedPractice(practiceFromStorage);
      setShowPracticeSelector(false);
    } else if (window.location.hostname === 'localhost' || window.location.hostname.startsWith('127.')) {
      // Dev convenience: auto-select developer practice to bypass validation step
      const devClinic = 'developer';
      if (!savedCredentials) {
        setSelectedPractice(devClinic);
        setShowPracticeSelector(false);
      }
      secureStorage.setItem('practiceSubdomain', devClinic);
    }
  }, [searchParams]);

  // 🔒 SECURITY: Clear form data on component mount (handles automatic logout)
  useEffect(() => {
    // Clear form data when component mounts (security measure for automatic logout)
    setFormData({
      email: '',
      password: ''
    });
    setError('');
    setShowMFA(false);
    setTempToken('');
    setMfaAttempts(3);

    // Clear any stored form data from browser memory
    setTimeout(() => {
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        if (form.reset) form.reset();
      });

      // Clear password fields specifically
      const passwordInputs = document.querySelectorAll('input[type="password"]');
      passwordInputs.forEach(input => {
        input.value = '';
        input.setAttribute('value', '');
      });
    }, 100);
  }, []);

  const handlePracticeSelect = (practiceSubdomain) => {
    setSelectedPractice(practiceSubdomain);
    setShowPracticeSelector(false);
    secureStorage.setItem('practiceSubdomain', practiceSubdomain);
  };

  const handleBackToPracticeSelector = () => {
    setSelectedPractice(null);
    setShowPracticeSelector(true);
    secureStorage.removeItem('practiceSubdomain');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!selectedPractice) {
        setError(t('pleaseSelectClinic') || 'Please select a practice');
        return;
      }

      // Use practice-auth endpoint with MFA support
      const response = await authAPI.practiceLogin({
        email: formData.email,
        password: formData.password,
        practice: selectedPractice.subdomain,
        practiceSubdomain: selectedPractice.subdomain,
        rememberMe: rememberMe // Send remember me flag to backend
      }, selectedPractice.subdomain);

      process.env.NODE_ENV !== 'production' && console.log('🔍 Login request sent with headers:', {
        'x-practice-subdomain': selectedPractice.subdomain,
        'Content-Type': 'application/json'
      });

      if (response.data.success) {
        // Check if MFA is required
        if (response.data.security?.mfaRequired && !response.data.security?.mfaVerified) {
          // Store temporary token and show MFA verification
          setTempToken(response.data.token);
          setShowMFA(true);
          setMfaAttempts(3);
          return;
        }

        // Complete login
        completeLogin(response.data);
      } else if (response.data.mfaRequired || response.data.requires2FA) {
        // Handle MFA required response - no token provided, user must provide MFA
        setShowMFA(true);
        setMfaAttempts(3);
        // Clear any error from the MFA requirement message
        setError('');
      }
    } catch (err) {
      // Suppress console noise for expected MFA-required 401
      if (err?.response?.status === 401 && (err.response?.data?.mfaRequired || err.response?.data?.requires2FA)) {
        setShowMFA(true);
        setMfaAttempts(3);
        setError('');
        return;
      }

      process.env.NODE_ENV !== 'production' && console.error('Login unexpected error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });

      const errorMessage = err.response?.data?.message;
      if (typeof errorMessage === 'object') {
        const language = secureStorage.getItem('selectedLanguage') || 'en';
        setError(errorMessage[language] || errorMessage.en || t('loginFailed'));
      } else if (err.response?.data?.errors) {
        process.env.NODE_ENV !== 'production' && console.error('Validation errors:', err.response.data.errors);
        setError(t('validationFailed') || 'Validation failed. Please check your input.');
      } else {
        setError(errorMessage || t('loginFailed') || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerification = async (token, isBackupCode) => {
    setLoading(true);
    setError('');

    try {
      // Submit MFA token with login credentials
      const response = await authAPI.practiceLogin({
        email: formData.email,
        password: formData.password,
        mfaToken: token,
        practice: selectedPractice.subdomain,
        practiceSubdomain: selectedPractice.subdomain
      }, selectedPractice.subdomain);

      if (response.data.success) {
        completeLogin(response.data);
      }
    } catch (err) {
      setMfaAttempts(prev => prev - 1);

      const errorMessage = err.response?.data?.message;
      if (typeof errorMessage === 'object') {
        const language = secureStorage.getItem('selectedLanguage') || 'en';
        setError(errorMessage[language] || errorMessage.en || t('invalidMFAToken'));
      } else {
        setError(errorMessage || t('invalidMFAToken') || 'Invalid MFA token');
      }

      if (mfaAttempts <= 1) {
        // Too many failed attempts, reset to login
        setShowMFA(false);
        setTempToken('');
        setMfaAttempts(3);
        setError(t('tooManyMFAAttempts') || 'Too many failed attempts. Please try logging in again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = (loginData) => {
    const { token, user, practice, security } = loginData;

    // Store auth data with security info
    secureStorage.setItem('token', token);
    secureStorage.setItem('user', JSON.stringify(user));
    secureStorage.setItem('token', token);
    secureStorage.setItem('user', JSON.stringify(user));
    secureStorage.setItem('practiceSubdomain', practice.subdomain);
    secureStorage.setItem('tokenTimestamp', Date.now().toString());
    
    // Handle "Remember me" - save credentials for 30 days
    if (rememberMe) {
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      const rememberData = {
        email: formData.email,
        practice: practice.subdomain,
        expiresAt: new Date().getTime() + thirtyDaysInMs
      };
      // Note: We don't save the password for security reasons
      // Only email and practice for convenience
      secureStorage.setItem('intellicare_remember', JSON.stringify(rememberData));
      
      // Also request a long-lived token from backend if available
      secureStorage.setItem('rememberMe', 'true');
      secureStorage.setItem('tokenExpiry', new Date(new Date().getTime() + thirtyDaysInMs).toISOString());
    } else {
      // Clear any existing remember me data
      secureStorage.removeItem('intellicare_remember');
      secureStorage.removeItem('rememberMe');
      secureStorage.removeItem('tokenExpiry');
    }

    // Store security session info
    if (security?.sessionId) {
      secureStorage.setItem('sessionId', security.sessionId);
      secureStorage.setItem('sessionId', security.sessionId);
    }

    // Update auth context
    setUser(user);
    setPractice(practice);

    // Reset MFA state
    setShowMFA(false);
    setTempToken('');
    setMfaAttempts(3);

    // Redirect to home
    navigate('/home');
  };

  const handleMFACancel = () => {
    setShowMFA(false);
    setTempToken('');
    setMfaAttempts(3);
    setError('');
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  // Show practice selector if no practice is selected
  if (showClinicSelector) {
    return (
      <div style={{
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        direction: textDirection,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <PracticeSelector
          onPracticeSelect={handlePracticeSelect}
          loading={loading}
        />
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      direction: textDirection,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '100px',
        height: '100px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        animation: 'float 6s ease-in-out infinite'
      }}></div>
      <div style={{
        position: 'absolute',
        top: '70%',
        right: '15%',
        width: '150px',
        height: '150px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '50%',
        animation: 'float 8s ease-in-out infinite reverse'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '20%',
        left: '20%',
        width: '80px',
        height: '80px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '50%',
        animation: 'float 7s ease-in-out infinite'
      }}></div>

      {/* Login Content */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1vh 2vw',
        height: '100%',
        overflowY: 'auto'
      }}>

      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.3), 0 0 40px rgba(118, 75, 162, 0.2), 0 0 60px rgba(240, 147, 251, 0.1); }
            50% { box-shadow: 0 0 30px rgba(102, 126, 234, 0.4), 0 0 60px rgba(118, 75, 162, 0.3), 0 0 90px rgba(240, 147, 251, 0.2); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .login-card {
            max-width: min(90vw, 450px);
            width: 100%;
            max-height: 90vh;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: clamp(16px, 2vw, 24px);
            padding: clamp(20px, 3vh, 40px) clamp(15px, 3vw, 30px);
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            animation: slideIn 0.8s ease-out, glow 4s ease-in-out infinite;
            position: relative;
            overflow-y: auto;
          }
          
          .login-icon {
            font-size: clamp(2.5rem, 5vw, 3.5rem);
            margin-bottom: clamp(10px, 2vh, 20px);
            filter: drop-shadow(0 4px 8px rgba(102, 126, 234, 0.3));
            animation: float 3s ease-in-out infinite;
          }
          
          .login-title {
            font-size: clamp(1.4rem, 4vw, 2rem);
            font-weight: 700;
            margin: 0 0 clamp(6px, 1vh, 12px) 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-align: center;
          }
          
          .login-subtitle {
            color: #718096;
            font-size: clamp(0.8rem, 2vw, 1rem);
            margin: 0;
            text-align: center;
          }
          
          .login-form {
            margin-bottom: clamp(15px, 2vh, 25px);
          }
          
          .form-group {
            margin-bottom: clamp(15px, 2vh, 20px);
          }
          
          .form-label {
            display: block;
            font-size: clamp(0.8rem, 2vw, 0.9rem);
            font-weight: 600;
            color: #4a5568;
            margin-bottom: clamp(6px, 1vh, 8px);
          }
          
          .form-input {
            width: 100%;
            padding: clamp(12px, 2vh, 16px) clamp(15px, 3vw, 20px);
            border: 2px solid #e2e8f0;
            border-radius: clamp(8px, 1.5vw, 12px);
            font-size: clamp(0.9rem, 2vw, 1rem);
            background: rgba(255, 255, 255, 0.8);
            transition: all 0.3s ease;
            outline: none;
            box-sizing: border-box;
          }
          
          .remember-section {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: clamp(20px, 3vh, 30px);
            flex-wrap: wrap;
            gap: 10px;
          }
          
          .submit-button {
            width: 100%;
            padding: clamp(12px, 2vh, 16px);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: clamp(8px, 1.5vw, 12px);
            font-size: clamp(1rem, 2.5vw, 1.1rem);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            position: relative;
            overflow: hidden;
          }
          
          @media (max-width: 768px) {
            .remember-section {
              flex-direction: column;
              align-items: flex-start;
              gap: 15px;
            }
          }
          
          @media (max-height: 700px) {
            .login-card {
              padding: 15px 20px;
            }
            .login-icon {
              font-size: 2rem;
              margin-bottom: 10px;
            }
            .form-group {
              margin-bottom: 12px;
            }
          }
        `}
      </style>

      <div className="login-card">
        {/* Show MFA verification if required */}
        {showMFA ? (
          <MFAVerification
            onVerify={handleMFAVerification}
            onCancel={handleMFACancel}
            loading={loading}
            error={error}
            userEmail={formData.email}
            remainingAttempts={mfaAttempts}
          />
        ) : (
          <>
            {/* Medical icon */}
            <div style={{ textAlign: 'center', marginBottom: 'clamp(15px, 2vh, 25px)' }}>
              <div className="login-icon">🩺</div>
              <h2 className="login-title">{t('signInToIntelliCare')}</h2>
              <p className="login-subtitle">{t('useMedicalAccount')}</p>
            </div>

        {/* Practice Info */}
        {selectedPractice && (
          <div style={{
            background: 'rgba(102, 126, 234, 0.1)',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
              {t('selectedPractice')}
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>
              {selectedPractice}
            </div>
            <button
              type="button"
              onClick={handleBackToPracticeSelector}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: '14px',
                cursor: 'pointer',
                textDecoration: 'underline',
                marginTop: '8px'
              }}
            >
              {t('changePractice')}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" autoComplete="new-password" data-lpignore="true" data-1p-ignore data-bw-ignore>
          {/* No decoy fields - they're being detected by Chrome */}
          {error && (
            <div style={{
              background: 'linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%)',
              border: '1px solid #fc8181',
              color: '#c53030',
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="login-email-input" style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#4a5568',
              marginBottom: '8px'
            }}>
              {t('emailAddress')}
            </label>
            <input
              id="login-email-input"
              name="field_x1"
              type="text"
              inputMode="email"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-autocomplete="none"
              data-lpignore="true"
              data-1p-ignore
              data-bw-ignore
              data-form-type="other"
              data-no-autofill="true"
              required
              style={{
                width: '100%',
                padding: '16px 20px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '1rem',
                background: 'rgba(255, 255, 255, 0.8)',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder={t('emailAddress')}
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              readOnly
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                e.target.style.background = 'rgba(255, 255, 255, 1)';
                e.currentTarget.removeAttribute('readonly');
              }}
              onMouseDown={(e) => e.currentTarget.removeAttribute('readonly')}
              onKeyDown={(e) => e.currentTarget.removeAttribute('readonly')}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
                e.target.style.background = 'rgba(255, 255, 255, 0.8)';
              }}
            />
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="login-password-input"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}
            >
              {t('password') || 'Password'}
            </label>
            {/* Decoy field to absorb browser heuristics */}
            <input
              type="text"
              name="_decoy"
              autoComplete="username"
              aria-hidden="true"
              tabIndex={-1}
              style={{
                position: 'absolute',
                top: '-9999px',
                left: '-9999px',
                width: '1px',
                height: '1px',
                opacity: 0,
                pointerEvents: 'none'
              }}
            />
            <input
              id="login-password-input"
              name="field_y2"
              type="text"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-autocomplete="none"
              data-lpignore="true"
              data-1p-ignore
              data-bw-ignore
              data-form-type="other"
              data-no-autofill="true"
              required
              readOnly
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '16px',
                background: 'rgba(255, 255, 255, 0.8)',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxSizing: 'border-box',
                WebkitTextSecurity: 'disc'
              }}
              placeholder={t('enterPassword') || 'Enter your password'}
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                e.target.style.background = 'rgba(255, 255, 255, 1)';
                e.target.removeAttribute('readonly');
              }}
              onMouseDown={(e) => e.currentTarget.removeAttribute('readonly')}
              onKeyDown={(e) => e.currentTarget.removeAttribute('readonly')}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
                e.target.style.background = 'rgba(255, 255, 255, 0.8)';
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginBottom: '30px'
          }}>

            <button 
              type="button"
              onClick={handleForgotPassword}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'color 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.color = '#764ba2'}
              onMouseLeave={(e) => e.target.style.color = '#667eea'}
            >
              {t('forgotPassword')}
            </button>
          </div>

          {/* Remember Me Checkbox */}
          <div style={{ 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer'
              }}
            />
            <label 
              htmlFor="rememberMe"
              style={{
                fontSize: '14px',
                color: '#374151',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              {isRTL ? 'זכור אותי ל-30 יום' : 'Remember me for 30 days'}
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
              }
            }}
          >
            {loading ? t('loggingIn') || 'Logging in...' : t('login') || 'Login'}
          </button>
        </form>

            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: '#718096',
                fontSize: '0.9rem',
                margin: '0 0 15px 0'
              }}>
                {t('dontHaveAccount')}{' '}
                <Link
                  to="/signup"
                  style={{
                    color: '#667eea',
                    fontWeight: '600',
                    textDecoration: 'none',
                    transition: 'color 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#764ba2'}
                  onMouseLeave={(e) => e.target.style.color = '#667eea'}
                >
                  {t('signUp')}
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export default Login;
