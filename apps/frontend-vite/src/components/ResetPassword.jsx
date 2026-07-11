import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../config/languagesStatic';
import Navigation from './Navigation';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const ResetPassword = () => {
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  // Get token and userId from URL params
  const token = searchParams.get('token');
  const userId = searchParams.get('userId');
  const practice = searchParams.get('practice') || secureStorage.getItem('practiceSubdomain') || 'developer';

  useEffect(() => {
    // Validate token on component mount
    if (!token || !userId) {
      setError(t('invalidResetLink') || 'Invalid reset link');
      setCheckingToken(false);
      return;
    }

    // Token exists, mark as valid for now
    // The actual validation will happen when user submits the form
    setValidToken(true);
    setCheckingToken(false);
  }, [token, userId, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsDoNotMatch') || 'Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError(t('passwordMinLength') || 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // SECURE API: Resetting password
      const response = await secureApi.post('/passwordless-auth/reset-password', {
        token,
        userId,
        password: formData.password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-practice-subdomain': practice
        }
      });

      if (response.data.success) {
        setSuccess(response.data.message[secureStorage.getItem('selectedLanguage') || 'en'] || response.data.message.en);
        setFormData({ password: '', confirmPassword: '' });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login?practice=' + practice);
        }, 3000);
      } else {
        setError(response.data.message[secureStorage.getItem('selectedLanguage') || 'en'] || response.data.message.en);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message;
      if (typeof errorMessage === 'object') {
        const language = secureStorage.getItem('selectedLanguage') || 'en';
        setError(errorMessage[language] || errorMessage.en || t('resetPasswordFailed'));
      } else {
        setError(errorMessage || t('resetPasswordFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const textDirection = isRTL ? 'rtl' : 'ltr';

  if (checkingToken) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        direction: textDirection
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '2rem', marginBottom: '20px' }}>🔄</div>
          <p>{t('validatingResetLink') || 'Validating reset link...'}</p>
        </div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        direction: textDirection
      }}>
        <Navigation />
        
        <div style={{
          maxWidth: '450px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '40px 30px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>❌</div>
          <h1 style={{
            fontSize: '1.5rem',
            color: '#e53e3e',
            marginBottom: '15px'
          }}>
            {t('invalidResetLink') || 'Invalid Reset Link'}
          </h1>
          <p style={{ color: '#718096', marginBottom: '30px' }}>
            {t('resetLinkExpired') || 'This reset link is invalid or has expired. Please request a new one.'}
          </p>
          <Link
            to="/forgot-password"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: '600'
            }}
          >
            {t('requestNewResetLink') || 'Request New Reset Link'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      direction: textDirection
    }}>
      <Navigation />
      
      <div style={{
        maxWidth: '450px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '40px 30px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        animation: 'slideIn 0.8s ease-out'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '15px',
            filter: 'drop-shadow(0 4px 8px rgba(102, 126, 234, 0.3))'
          }}>
            🔑
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            margin: '0 0 10px 0',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {t('resetPassword') || 'Reset Password'}
          </h1>
          <p style={{
            color: '#718096',
            fontSize: '1rem',
            margin: '0'
          }}>
            {t('enterNewPassword') || 'Enter your new password'}
          </p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Single decoy field to absorb autofill heuristics */}
          <input type="text" name="_decoy" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />

          {/* Error Message */}
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

          {/* Success Message */}
          {success && (
            <div style={{
              background: 'linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%)',
              border: '1px solid #68d391',
              color: '#2f855a',
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {success}
              <br />
              <small>{t('redirectingToLogin') || 'Redirecting to login...'}</small>
            </div>
          )}

          {/* New Password Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#4a5568'
            }}>
              {t('newPassword') || 'New Password'}
            </label>
            <input
              type="text"
              name="password"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-autocomplete="none"
              data-lpignore="true"
              data-1p-ignore
              data-bw-ignore
              required
              readOnly
              style={{
                width: '100%',
                padding: '16px 20px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '1rem',
                background: 'rgba(255, 255, 255, 0.8)',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxSizing: 'border-box',
                WebkitTextSecurity: 'disc'
              }}
              placeholder={t('enterNewPassword') || 'Enter new password'}
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              onFocus={(e) => {
                e.target.removeAttribute('readonly');
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                e.target.style.background = 'rgba(255, 255, 255, 1)';
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

          {/* Confirm Password Field */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#4a5568'
            }}>
              {t('confirmNewPassword') || 'Confirm New Password'}
            </label>
            <input
              type="text"
              name="confirmPassword"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-autocomplete="none"
              data-lpignore="true"
              data-1p-ignore
              data-bw-ignore
              required
              readOnly
              style={{
                width: '100%',
                padding: '16px 20px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '1rem',
                background: 'rgba(255, 255, 255, 0.8)',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxSizing: 'border-box',
                WebkitTextSecurity: 'disc'
              }}
              placeholder={t('confirmNewPassword') || 'Confirm new password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              onFocus={(e) => {
                e.target.removeAttribute('readonly');
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                e.target.style.background = 'rgba(255, 255, 255, 1)';
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || success}
            style={{
              width: '100%',
              padding: '16px',
              background: (loading || success) ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: (loading || success) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
              marginBottom: '20px'
            }}
          >
            {loading ? (t('updating') || 'Updating...') : (t('updatePassword') || 'Update Password')}
          </button>

          {/* Back to Login */}
          <div style={{ textAlign: 'center' }}>
            <Link
              to="/login"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              {t('backToLogin') || 'Back to Login'}
            </Link>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ResetPassword;
