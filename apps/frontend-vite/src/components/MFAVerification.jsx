/**
 * 🔐 MFA VERIFICATION COMPONENT
 * Two-factor authentication verification during login
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../config/languagesStatic';

const MFAVerification = ({ 
  onVerify, 
  onCancel, 
  loading = false, 
  error = '', 
  userEmail = '',
  remainingAttempts = 3 
}) => {
  const { t } = useLanguage();
  const [token, setToken] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
  const inputRef = useRef(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // TOTP countdown timer
  useEffect(() => {
    if (!isBackupCode) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            return 30; // Reset to 30 seconds
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isBackupCode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!token.trim()) {
      return;
    }

    onVerify(token.trim(), isBackupCode);
  };

  const handleTokenChange = (e) => {
    let value = e.target.value;
    
    if (!isBackupCode) {
      // For TOTP, only allow digits and limit to 6 characters
      value = value.replace(/\D/g, '').slice(0, 6);
    } else {
      // For backup codes, allow alphanumeric and limit to 8 characters
      value = value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
    }
    
    setToken(value);
  };

  const toggleBackupCode = () => {
    setIsBackupCode(!isBackupCode);
    setToken('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const isValidToken = isBackupCode ? 
    token.length === 8 : 
    token.length === 6;

  return (
    <div style={{
      maxWidth: '400px',
      margin: '0 auto',
      padding: '30px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e1e5e9'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ 
          fontSize: '48px', 
          marginBottom: '15px',
          color: '#007bff'
        }}>
          🔐
        </div>
        <h2 style={{ 
          margin: '0 0 10px 0',
          color: '#2c3e50',
          fontSize: '24px'
        }}>
          {t('twoFactorVerification') || 'Two-Factor Verification'}
        </h2>
        <p style={{ 
          color: '#6c757d',
          fontSize: '14px',
          margin: 0
        }}>
          {userEmail && (
            <>
              {t('verificationFor') || 'Verification required for'} <strong>{userEmail}</strong>
            </>
          )}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb',
          fontSize: '14px'
        }}>
          <strong>⚠️ {error}</strong>
          {remainingAttempts > 0 && (
            <div style={{ marginTop: '5px', fontSize: '12px' }}>
              {t('attemptsRemaining') || 'Attempts remaining'}: {remainingAttempts}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: '600',
            color: '#495057'
          }}>
            {isBackupCode ? 
              (t('enterBackupCode') || 'Enter backup code') :
              (t('enterAuthCode') || 'Enter authenticator code')
            }
          </label>
          
          <input
            ref={inputRef}
            type="text"
            value={token}
            onChange={handleTokenChange}
            placeholder={isBackupCode ? 'ABC12345' : '123456'}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              border: '2px solid #dee2e6',
              borderRadius: '8px',
              fontSize: '18px',
              textAlign: 'center',
              letterSpacing: isBackupCode ? '1px' : '3px',
              fontFamily: 'monospace',
              backgroundColor: loading ? '#f8f9fa' : '#ffffff',
              transition: 'border-color 0.2s ease',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#007bff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#dee2e6';
            }}
          />
          
          {!isBackupCode && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: '8px',
              fontSize: '12px',
              color: '#6c757d'
            }}>
              ⏱️ {t('newCodeIn') || 'New code in'} {timeRemaining}s
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !isValidToken}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: isValidToken && !loading ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isValidToken && !loading ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.2s ease',
            marginBottom: '15px'
          }}
        >
          {loading ? (
            <>
              <span style={{ marginRight: '8px' }}>⏳</span>
              {t('verifying') || 'Verifying...'}
            </>
          ) : (
            <>
              <span style={{ marginRight: '8px' }}>🔓</span>
              {t('verify') || 'Verify'}
            </>
          )}
        </button>

        {/* Toggle Backup Code */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <button
            type="button"
            onClick={toggleBackupCode}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              textDecoration: 'underline',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              padding: '5px'
            }}
          >
            {isBackupCode ? 
              (t('useAuthenticatorCode') || 'Use authenticator code instead') :
              (t('useBackupCode') || 'Use backup code instead')
            }
          </button>
        </div>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: 'transparent',
            color: '#6c757d',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = '#f8f9fa';
              e.target.style.borderColor = '#adb5bd';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.borderColor = '#dee2e6';
            }
          }}
        >
          {t('cancel') || 'Cancel'}
        </button>
      </form>

      {/* Help Text */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#6c757d'
      }}>
        <div style={{ marginBottom: '8px' }}>
          <strong>💡 {t('helpTitle') || 'Need help?'}</strong>
        </div>
        <div style={{ marginBottom: '5px' }}>
          • {t('helpAuthenticator') || 'Open your authenticator app (Google Authenticator, Authy, etc.)'}
        </div>
        <div style={{ marginBottom: '5px' }}>
          • {t('helpFindCode') || 'Find the 6-digit code for IntelliCare'}
        </div>
        <div>
          • {t('helpBackupCode') || 'If you lost your device, use a backup code instead'}
        </div>
      </div>
    </div>
  );
};

export default MFAVerification;
