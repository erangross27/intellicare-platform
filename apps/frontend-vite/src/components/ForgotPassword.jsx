import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../config/languagesStatic';
import Navigation from './Navigation';
import PracticeSelector from './PracticeSelector';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const ForgotPassword = () => {
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    email: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [showClinicSelector, setShowPracticeSelector] = useState(true);

  // Check if practice is provided in URL params or localStorage
  useEffect(() => {
    const practiceFromUrl = searchParams.get('practice');
    const practiceFromStorage = secureStorage.getItem('practiceSubdomain');

    if (practiceFromUrl) {
      setSelectedPractice(practiceFromUrl);
      setShowPracticeSelector(false);
    } else if (practiceFromStorage) {
      setSelectedPractice(practiceFromStorage);
      setShowPracticeSelector(false);
    } else if (window.location.hostname === 'localhost' || window.location.hostname.startsWith('127.')) {
      // Dev convenience: auto-select developer practice
      const devClinic = 'developer';
      setSelectedPractice(devClinic);
      setShowPracticeSelector(false);
      secureStorage.setItem('practiceSubdomain', devClinic);
    }
  }, [searchParams]);

  const handlePracticeSelect = (practiceSubdomain) => {
    setSelectedPractice(practiceSubdomain);
    setShowPracticeSelector(false);
    secureStorage.setItem('practiceSubdomain', practiceSubdomain);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // SECURE API: Requesting password reset
      const response = await secureApi.post('/passwordless-auth/forgot-password', {
        email: formData.email
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-practice-subdomain': selectedPractice
        }
      });

      if (response.data.success) {
        setSuccess(response.data.message[secureStorage.getItem('selectedLanguage') || 'en'] || response.data.message.en);
        setFormData({ email: '' });
      } else {
        setError(response.data.message[secureStorage.getItem('selectedLanguage') || 'en'] || response.data.message.en);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message;
      if (typeof errorMessage === 'object') {
        const language = secureStorage.getItem('selectedLanguage') || 'en';
        setError(errorMessage[language] || errorMessage.en || t('forgotPasswordFailed'));
      } else {
        setError(errorMessage || t('forgotPasswordFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const textDirection = isRTL ? 'rtl' : 'ltr';

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
      
      {showClinicSelector ? (
        <PracticeSelector onPracticeSelect={handlePracticeSelect} />
      ) : (
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
              🔐
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
              {t('forgotPassword') || 'Forgot Password'}
            </h1>
            <p style={{
              color: '#718096',
              fontSize: '1rem',
              margin: '0'
            }}>
              {t('forgotPasswordSubtitle') || 'Enter your email to receive a password reset link'}
            </p>
          </div>

          {/* Practice Info */}
          <div style={{
            background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
            padding: '15px',
            borderRadius: '12px',
            marginBottom: '25px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.9rem', color: '#4a5568' }}>
              {t('practice')}: <strong>{selectedPractice}</strong>
            </span>
            <button
              onClick={() => setShowPracticeSelector(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: '0.9rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                marginTop: '8px',
                display: 'block',
                margin: '8px auto 0'
              }}
            >
              {t('changePractice')}
            </button>
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
              </div>
            )}

            {/* Email Field */}
            <div style={{ marginBottom: '25px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#4a5568'
              }}>
                {t('emailAddress') || 'Email Address'}
              </label>
              <input
                type="text"
                name="email"
                inputMode="email"
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
                  boxSizing: 'border-box'
                }}
                placeholder={t('enterEmailAddress') || 'Enter your email address'}
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
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
                marginBottom: '20px'
              }}
            >
              {loading ? (t('sending') || 'Sending...') : (t('sendResetLink') || 'Send Reset Link')}
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
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ForgotPassword;
