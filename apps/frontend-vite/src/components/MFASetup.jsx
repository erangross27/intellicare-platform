/**
 * 🔐 MFA SETUP COMPONENT
 * Complete 2FA setup with QR code and backup codes
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { mfaAPI } from '../services/apiMigration';

const MFASetup = ({ onComplete, onCancel }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState('status');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaData, setMfaData] = useState(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [mfaStatus, setMfaStatus] = useState(null);

  // Load MFA status on component mount
  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    try {
      setLoading(true);
      const response = await mfaAPI.getStatus();
      setMfaStatus(response.data.mfa);

      if (response.data.mfa.enabled) {
        // If MFA is already enabled, jump straight to the management/status view
        setStep('status');
      }
    } catch (error) {
      setError(t('failedToLoadMFAStatus') || 'Failed to load MFA status');
    } finally {
      setLoading(false);
    }
  };

  const startMFASetup = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await mfaAPI.setup();
      setMfaData(response.data.mfa);
      setStep('setup');
    } catch (error) {
      setError(error.response?.data?.message?.en || t('mfaSetupFailed') || 'MFA setup failed');
    } finally {
      setLoading(false);
    }
  };

  const enableMFA = async () => {
    try {
      setLoading(true);
      setError('');

      if (!mfaData) {
        setError(t('startMFASetupFirst') || 'Please start MFA setup first (scan the QR code).');
        return;
      }

      if (!verificationToken || verificationToken.length !== 6) {
        setError(t('invalidTokenFormat') || 'Please enter a valid 6-digit token');
        return;
      }

      const response = await mfaAPI.enable(verificationToken);
      setStep('complete');

      if (onComplete) {
        onComplete(response.data);
      }
    } catch (error) {
      setError(error.response?.data?.message?.en || t('mfaEnableFailed') || 'Failed to enable MFA');
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    try {
      setLoading(true);
      setError('');

      if (!verificationToken) {
        setError(t('tokenRequired') || 'Token required');
        return;
      }

      await mfaAPI.disable(verificationToken);
      setMfaStatus({ enabled: false });
      setStep('status');
      setVerificationToken('');
    } catch (error) {
      setError(error.response?.data?.message?.en || t('mfaDisableFailed') || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(t('copiedToClipboard') || 'Copied to clipboard');
    });
  };

  const downloadBackupCodes = () => {
    if (!mfaData?.backupCodes) return;

    const content = `IntelliCare MFA Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\n${mfaData.backupCodes.join('\n')}\n\nStore these codes securely. Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intellicare-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !mfaData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>
          {t('loadingMFAStatus') || 'Loading MFA status...'}
        </div>
      </div>
    );
  }

  // Ultra-modern professional styles inspired by GitHub/Stripe
  const contentStyle = {
    padding: step === 'setup' ? '16px 24px' : '24px' // Tighter padding
  };

  const containerStyle = {
    maxWidth: step === 'setup' ? '640px' : '520px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #d0d7de',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif'
  };

  const headerStyle = {
    backgroundColor: '#f6f8fa',
    borderBottom: '1px solid #d0d7de',
    padding: '16px 24px',
    textAlign: 'center'
  };

  const buttonStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginBottom: '8px',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#2da44e',
    color: 'white',
    border: '1px solid rgba(27, 31, 36, 0.15)',
    boxShadow: '0 1px 0 rgba(27, 31, 36, 0.1)'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#f6f8fa',
    color: '#24292f',
    border: '1px solid #d0d7de'
  };

  // Destructive/danger button style (for disabling)
  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#d32f2f',
    color: 'white',
    border: '1px solid rgba(27, 31, 36, 0.15)',
    boxShadow: '0 1px 0 rgba(27, 31, 36, 0.1)'
  };

  // Shared centered row layout for actions
  const centerRowStyle = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  };


  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: '600',
          color: '#24292f'
        }}>
          {t('twoFactorAuthentication') || 'Two-factor authentication'}
        </h2>
      </div>

      <div style={contentStyle}>
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid #fecaca',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            ⚠️ {error}
          </div>
        )}

        {step === 'status' && (
          <div>
            {/* GitHub-style status section */}
            <div style={{
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              marginBottom: '16px'
            }}>
              <div style={{
                padding: '16px',
                borderBottom: mfaStatus?.enabled ? '1px solid #d0d7de' : 'none'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    marginTop: '2px',
                    flexShrink: 0
                  }}>
                    {mfaStatus?.enabled ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="#1a7f37">
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="#656d76">
                        <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#24292f',
                      marginBottom: '4px'
                    }}>
                      {t('twoFactorAuthentication') || 'Two-factor authentication'}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#656d76',
                      lineHeight: '1.4'
                    }}>
                      {mfaStatus?.enabled ?
                        (t('mfaEnabledDescription') || 'Your account is protected with two-factor authentication.') :
                        (t('mfaDescription') || 'Add an extra layer of security to your account with two-factor authentication.')
                      }
                    </div>
                    {mfaStatus?.enabled && (
                      <div style={{
                        fontSize: '12px',
                        color: '#656d76',
                        marginTop: '8px'
                      }}>
                        {t('backupCodesRemaining') || 'Backup codes remaining'}: {mfaStatus.backupCodesCount}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: mfaStatus?.enabled ? '#1a7f37' : '#656d76',
                    backgroundColor: mfaStatus?.enabled ? '#dafbe1' : '#f6f8fa',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    border: `1px solid ${mfaStatus?.enabled ? '#1a7f37' : '#d0d7de'}`
                  }}>
                    {mfaStatus?.enabled ?
                      (t('enabled') || 'Enabled') :
                      (t('disabled') || 'Disabled')
                    }
                  </div>
                </div>
              </div>

              {/* Action buttons inside the card */}
              <div style={{
                padding: '20px',
                backgroundColor: '#f6f8fa',
                borderTop: mfaStatus?.enabled ? '1px solid #d0d7de' : 'none'
              }}>
                {mfaStatus?.enabled ? (
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#24292f',
                      marginBottom: '12px'
                    }}>
                      {t('mfaManagementOptions') || 'MFA Management Options'}
                    </div>
                    <div style={centerRowStyle}>
                      <button onClick={() => setStep('verify')} style={dangerButtonStyle}>
                        🔓 {t('disableMFA') || 'Disable 2FA'}
                      </button>

                      {onCancel && (
                        <button onClick={onCancel} style={secondaryButtonStyle}>
                          {t('close') || 'Close'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#24292f',
                      marginBottom: '12px'
                    }}>
                      {t('setupMFA') || 'Setup Two-Factor Authentication'}
                    </div>
                    <div style={centerRowStyle}>
                      <button
                        onClick={startMFASetup}
                        disabled={loading}
                        style={{
                          ...primaryButtonStyle,
                          width: 'auto',
                          opacity: loading ? 0.7 : 1,
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        🔐 {loading ? (t('setting_up') || 'Setting up...') : (t('enableMFA') || 'Enable 2FA')}
                      </button>

                      {onCancel && (
                        <button onClick={onCancel} style={secondaryButtonStyle}>
                          {t('cancel') || 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'setup' && mfaData && (
          <div>


            {/* Compact single-column layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '12px',
              marginBottom: '16px'
            }}>
              {/* Left Column - QR Code */}
              <div style={{
                border: '1px solid #d0d7de',
                borderRadius: '6px',
                overflow: 'hidden',
                height: 'fit-content'
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #d0d7de',
                  backgroundColor: '#f6f8fa'
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#24292f'
                  }}>
                    {t('scanQRCode') || 'Scan QR code'}
                  </h3>
                </div>
                <div style={{
                  padding: '16px',
                  textAlign: 'center',
                  backgroundColor: 'white'
                }}>
                  <p style={{
                    color: '#656d76',
                    fontSize: '12px',
                    margin: '0 0 16px 0',
                    lineHeight: '1.4'
                  }}>
                    {t('scanWithAuthenticator') || 'Use your authenticator app to scan this QR code.'}
                  </p>

                  <div style={{
                    display: 'inline-block',
                    padding: '12px',
                    backgroundColor: '#f6f8fa',
                    borderRadius: '6px',
                    border: '1px solid #d0d7de'
                  }}>
                    <img
                      src={mfaData.qrCode}
                      alt="MFA QR Code"
                      style={{
                        width: '140px',
                        height: '140px',
                        display: 'block'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Middle Column - Manual Entry */}
              <div style={{
                border: '1px solid #d0d7de',
                borderRadius: '6px',
                overflow: 'hidden',
                height: 'fit-content'
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #d0d7de',
                  backgroundColor: '#f6f8fa'
                }}>
                  <h4 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#24292f'
                  }}>
                    {t('manualEntryKey') || 'Manual entry key'}
                  </h4>
                </div>
                <div style={{ padding: '16px' }}>
                  <p style={{
                    fontSize: '12px',
                    color: '#656d76',
                    margin: '0 0 12px 0'
                  }}>
                    If you can't scan the QR code, enter this key manually:
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <code style={{
                      flex: 1,
                      backgroundColor: '#f6f8fa',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                      wordBreak: 'break-all',
                      border: '1px solid #d0d7de',
                      color: '#24292f'
                    }}>
                      {mfaData.manualEntryKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(mfaData.manualEntryKey)}
                      style={{
                        ...secondaryButtonStyle,
                        width: 'auto',
                        marginBottom: 0,
                        padding: '6px 10px',
                        fontSize: '11px'
                      }}
                    >
                      {t('copy') || 'Copy'}
                    </button>
                  </div>
                </div>
              </div>


            </div>

            {/* Verification Section (compact) */}
            <div style={{ backgroundColor: '#f6f8fa', borderRadius: '6px', padding: '12px', marginBottom: '12px', border: '1px solid #d0d7de' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: '#24292f' }}>
                {t('enterVerificationCode') || 'Verification code'}
              </h4>
              <input
                type="text"
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d0d7de',
                  borderRadius: '6px',
                  fontSize: '18px',
                  textAlign: 'center',
                  letterSpacing: '6px',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  backgroundColor: 'white',
                  color: '#24292f',
                  outline: 'none',
                  transition: 'border-color 0.15s ease'
                }}
                maxLength={6}
                onFocus={(e) => e.target.style.borderColor = '#0969da'}
                onBlur={(e) => e.target.style.borderColor = '#d0d7de'}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={enableMFA}
                disabled={loading || !mfaData || verificationToken.length !== 6}
                style={{
                  ...primaryButtonStyle,
                  opacity: (loading || !mfaData || verificationToken.length !== 6) ? 0.5 : 1,
                  cursor: (loading || !mfaData || verificationToken.length !== 6) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '⏳ ' + (t('enabling') || 'Enabling...') : '✅ ' + (t('enableMFA') || 'Enable MFA')}
              </button>

              <button
                onClick={() => setStep('status')}
                style={secondaryButtonStyle}
              >
                ← {t('back') || 'Back'}
              </button>
            </div>
          </div>
        )}

      {step === 'verify' && (
        <div style={{
          border: '1px solid #dc3545',
          borderRadius: '6px',
          padding: '20px',
          backgroundColor: '#fef2f2'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#dc3545', margin: '0 0 12px 0' }}>
              🔓 {t('disableTwoFactorAuth') || 'Disable Two-Factor Authentication'}
            </h3>
            <div style={{
              backgroundColor: '#fecaca',
              color: '#991b1b',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              ⚠️ {t('disableMFAWarning') || 'Warning: Disabling 2FA will make your account less secure'}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              {t('enterTokenOrBackupCode') || 'Enter TOTP token or backup code'}:
            </label>
            <input
              type="text"
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value)}
              placeholder={t('tokenOrBackupCode') || 'Token or backup code'}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
          </div>

          <div style={centerRowStyle}>
            <button
              onClick={disableMFA}
              disabled={loading || !verificationToken}
              style={{
                ...dangerButtonStyle,
                width: 'auto',
                opacity: (loading || !verificationToken) ? 0.6 : 1,
                cursor: (loading || !verificationToken) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (t('disabling') || 'Disabling...') : (t('disableMFA') || 'Disable MFA')}
            </button>

            <button onClick={() => setStep('status')} style={secondaryButtonStyle}>
              {t('cancel') || 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div>
          <div style={{ border: '1px solid #d0d7de', borderRadius: '6px', padding: '12px 16px', background: '#f6f8fa', marginBottom: '12px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a7f37', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✅ {t('mfaEnabled') || 'MFA enabled successfully'}
            </div>
            <div style={{ fontSize: '12px', color: '#656d76' }}>
              {t('accountMoreSecure') || 'Your account is now protected with two-factor authentication.'}
            </div>
          </div>

          {/* Professional backup codes panel */}
          {mfaData?.backupCodes && (
            <div style={{ border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ padding: '10px 14px', background: '#fff8e1', borderBottom: '1px solid #d0d7de' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#24292f' }}>
                  {t('backupCodes') || 'Backup codes'}
                </div>
                <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                  {t('backupCodesHint') || 'Store these codes in a secure place. Each code can be used once.'}
                </div>
              </div>
              <div style={{ padding: '12px' }}>
                <div style={{ background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: '4px', padding: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace', fontSize: '12px' }}>
                    {mfaData.backupCodes.map((code, idx) => (
                      <div key={idx} style={{ background: 'white', border: '1px solid #d0d7de', borderRadius: '3px', padding: '6px 8px' }}>
                        {idx + 1}. {code}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={downloadBackupCodes} style={{ ...secondaryButtonStyle, width: 'auto', marginBottom: 0 }}>
                    {t('downloadBackupCodes') || 'Download .txt'}
                  </button>
                  <button onClick={() => copyToClipboard(mfaData.backupCodes.join('\n'))} style={{ ...secondaryButtonStyle, width: 'auto', marginBottom: 0 }}>
                    {t('copy') || 'Copy all'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep('status')} style={{ ...primaryButtonStyle, width: 'auto', marginBottom: 0 }}>
              {t('done') || 'Done'}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default MFASetup;
