import React, { useState, useMemo } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { authAPI } from '../services/apiMigration';

import secureStorage from '../utils/secureStorage';
const PracticeSelector = ({ onPracticeSelect, onCreateNewPractice, loading = false }) => {
  const { t, isRTL } = useLanguage();
  const textDirection = isRTL ? 'rtl' : 'ltr';
  
  const [practiceSubdomain, setPracticeSubdomain] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');

  // 🎯 PERFORMANCE: Memoize styles to prevent re-renders
  const containerStyle = useMemo(() => ({
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
    direction: textDirection,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden'
  }), [textDirection]);

  const cardStyle = useMemo(() => ({
    maxWidth: '480px',
    width: '100%',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '40px 30px',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    animation: 'slideIn 0.8s ease-out'
  }), []);

  const inputStyle = useMemo(() => ({
    width: '100%',
    padding: '16px 20px',
    border: '2px solid rgba(102, 126, 234, 0.2)',
    borderRadius: '12px',
    fontSize: '16px',
    background: 'rgba(255, 255, 255, 0.9)',
    transition: 'all 0.3s ease',
    marginBottom: '20px',
    textAlign: textDirection === 'rtl' ? 'right' : 'left',
    direction: textDirection
  }), [textDirection]);

  const buttonStyle = useMemo(() => ({
    width: '100%',
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: loading || validating ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s ease',
    opacity: loading || validating ? 0.7 : 1,
    transform: loading || validating ? 'scale(0.98)' : 'scale(1)'
  }), [loading, validating]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!practiceSubdomain.trim()) {
      setError(t('practiceSubdomainRequired'));
      return;
    }

    setValidating(true);
    setError('');

    try {
      // Validate practice subdomain
      await authAPI.validatePractice(practiceSubdomain.trim().toLowerCase());

      // Check if we should redirect to subdomain URL
      const currentHost = window.location.hostname;
      const currentPort = window.location.port;
      const subdomain = practiceSubdomain.trim().toLowerCase();
      const isDevelopment = currentPort === '3000';
      const isMainDomain = currentHost === 'localhost' || currentHost === 'intellicare.health';

      if (isMainDomain && subdomain !== 'localhost' && !isDevelopment) {
        // Redirect to subdomain for proper multi-tenant experience (production only)
        const baseDomain = 'intellicare.health';
        const protocol = 'https';
        const newUrl = `${protocol}://${subdomain}.${baseDomain}${window.location.pathname}`;
        process.env.NODE_ENV !== 'production' && console.log(`🌐 Redirecting to subdomain URL: ${newUrl}`);
        window.location.href = newUrl;
        return;
      }

      // In development, stay on localhost and use practice context headers
      if (isDevelopment) {
        process.env.NODE_ENV !== 'production' && console.log(`🔧 Development mode: Using practice context '${subdomain}' with localhost`);
      }

      onPracticeSelect(subdomain);
    } catch (err) {
      const errorMessage = err.response?.data?.message;
      if (typeof errorMessage === 'object') {
        const language = secureStorage.getItem('selectedLanguage') || 'en';
        setError(errorMessage[language] || errorMessage.en || t('practiceNotFound'));
      } else {
        setError(errorMessage || t('practiceNotFound'));
      }
    } finally {
      setValidating(false);
    }
  };

  return (
    <div style={containerStyle}>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .practice-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          
          .practice-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
          }
          
          .practice-button:active:not(:disabled) {
            transform: translateY(0);
          }
        `}
      </style>

      <div style={cardStyle}>
        {/* Medical icon */}
        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🏥</div>
        
        <h2 style={{ 
          color: '#333', 
          marginBottom: '10px',
          fontSize: '1.8rem',
          fontWeight: '700'
        }}>
          {t('selectPractice')}
        </h2>
        
        <p style={{
          color: '#666',
          marginBottom: '20px',
          fontSize: '1rem',
          lineHeight: '1.5'
        }}>
          {t('enterPracticeSubdomain')}
        </p>



        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Hidden dummy fields to deter browser autofill */}
          <input type="text" name="_fake_user" style={{ display: 'none' }} autoComplete="off" />
          <input type="password" name="_fake_pass" style={{ display: 'none' }} autoComplete="new-password" />
          <input
            type="text"
            value={practiceSubdomain}
            onChange={(e) => setPracticeSubdomain(e.target.value)}
            placeholder={t('practiceSubdomainPlaceholder')}
            style={inputStyle}
            className="practice-input"
            disabled={loading || validating}
            autoFocus
          />

          {error && (
            <div style={{
              color: '#e74c3c',
              marginBottom: '20px',
              padding: '12px',
              background: 'rgba(231, 76, 60, 0.1)',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={buttonStyle}
            className="practice-button"
            disabled={loading || validating || !practiceSubdomain.trim()}
          >
            {validating ? t('validating') : t('continue')}
          </button>
        </form>

        {onCreateNewPractice && (
          <div style={{
            marginTop: '20px',
            textAlign: 'center'
          }}>
            <div style={{
              margin: '20px 0',
              fontSize: '14px',
              color: '#666'
            }}>
              {t('or')}
            </div>

            <button
              type="button"
              onClick={onCreateNewPractice}
              style={{
                ...buttonStyle,
                background: 'transparent',
                color: '#667eea',
                border: '2px solid #667eea'
              }}
              className="practice-button-secondary"
            >
              {t('createNewPractice')}
            </button>
          </div>
        )}

        <div style={{
          marginTop: '20px',
          fontSize: '14px',
          color: '#666',
          lineHeight: '1.5'
        }}>
          {t('practiceSubdomainHelp')}
        </div>
      </div>
    </div>
  );
};

export default PracticeSelector;
