import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../config/languagesStatic';
import PracticeSelector from './PracticeSelector';
import PracticeSetupWizard from './PracticeSetupWizard';
import secureApi from '../services/secureApiClient';
import { authAPI } from '../services/apiMigration';
// Removed crossTabAuth - using single-tab OTP login now

import secureStorage from '../utils/secureStorage';
const Signup = () => {
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  
  // Determine text direction based on language
  const textDirection = isRTL ? 'rtl' : 'ltr';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [showClinicSelector, setShowPracticeSelector] = useState(true);
  const [showClinicSetupWizard, setShowClinicSetupWizard] = useState(false);
  
  // Add scrollbar styles for viewport scrolling and fix body overflow
  useEffect(() => {
    // When wizard is showing, prevent body scroll
    if (showClinicSetupWizard) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    
    const styleId = 'signup-scrollbar-style';
    let styleElement = document.getElementById(styleId);
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = `
      .signup-wizard-viewport {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.5) transparent;
      }
      
      .signup-wizard-viewport::-webkit-scrollbar {
        width: 10px;
      }
      
      .signup-wizard-viewport::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .signup-wizard-viewport::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.5);
        border-radius: 5px;
      }
      
      .signup-wizard-viewport::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.7);
      }
    `;
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, [showClinicSetupWizard]);

  const { signup, login } = useAuth();
  const navigate = useNavigate();

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
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError(t('passwordMinLength'));
      setLoading(false);
      return;
    }

    try {
      if (selectedPractice) {
        // ✅ REAL SECURITY: Self-registration using server-side sessions
        const response = await authAPI.selfRegister({
          practiceSubdomain: selectedPractice,
          name: formData.name,
          email: formData.email,
          password: formData.password
        });

        if (response.data.success) {
          // ❌ REMOVED: Token storage (fake client security)
          // ✅ SECURE: Server automatically set httpOnly cookie
          
          const { user, practice } = response.data;
          
          // ✅ SECURE: Store only non-sensitive preference data
          if (user?.preferredLanguage) {
            secureStorage.setItem('selectedLanguage', user.preferredLanguage);
          }
          if (practice?.subdomain) {
            secureStorage.setItem('practiceSubdomain', practice.subdomain);
          }

          // REMOVED: Cross-tab broadcast - not needed for single-tab OTP flow

          // Show success message about pending approval
          setError('');
          alert((response.data.message && (response.data.message.en || response.data.message.he)) || 'Registration successful');

          navigate('/home');
        }
      } else {
        // Original signup flow (this shouldn't happen now, but keeping as fallback)
        await signup({
          name: formData.name,
          email: formData.email,
          password: formData.password
        });
        navigate('/home');
      }
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Signup error:', err);
      const errorMessage = err.response?.data?.message;
      if (typeof errorMessage === 'object') {
        const language = secureStorage.getItem('selectedLanguage') || 'en';
        setError(errorMessage[language] || errorMessage.en || t('signupFailed'));
      } else {
        setError(errorMessage || err.message || t('signupFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewPractice = () => {
    setShowPracticeSelector(false);
    setShowClinicSetupWizard(true);
  };

  const handlePracticeSetupComplete = (practiceData) => {
    // Practice creation successful, navigate to home
    navigate('/home');
  };

  const handleBackToPracticeSelector = () => {
    setShowClinicSetupWizard(false);
    setShowPracticeSelector(true);
  };

  // If showing practice setup wizard
  if (showClinicSetupWizard) {
    return (
      <div 
        className="signup-wizard-viewport"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
          direction: textDirection
        }}>
        <div style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <PracticeSetupWizard
            onComplete={handlePracticeSetupComplete}
            onBack={handleBackToPracticeSelector}
          />
        </div>
      </div>
    );
  }

  // If showing practice selector
  if (showClinicSelector && !selectedPractice) {
    return (
      <PracticeSelector
        onPracticeSelect={(practice) => {
          // Allow self-registration to existing practice
          setSelectedPractice(practice);
          setShowPracticeSelector(false);
          secureStorage.setItem('practiceSubdomain', practice);
        }}
        onCreateNewPractice={handleCreateNewPractice}
      />
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
        top: '15%',
        right: '10%',
        width: '120px',
        height: '120px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        animation: 'float 7s ease-in-out infinite'
      }}></div>
      <div style={{
        position: 'absolute',
        top: '60%',
        left: '8%',
        width: '90px',
        height: '90px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '50%',
        animation: 'float 5s ease-in-out infinite reverse'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '20%',
        width: '110px',
        height: '110px',
        background: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '50%',
        animation: 'float 6s ease-in-out infinite'
      }}></div>

      {/* Signup Content */}
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
          
          .signup-card {
            max-width: min(90vw, 480px);
            width: 100%;
            max-height: 95vh;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: clamp(16px, 2vw, 24px);
            padding: clamp(15px, 2.5vh, 35px) clamp(15px, 2.5vw, 25px);
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            animation: slideIn 0.8s ease-out, glow 4s ease-in-out infinite;
            position: relative;
            overflow-y: auto;
          }
          
          .signup-icon {
            font-size: clamp(2.2rem, 4.5vw, 3rem);
            margin-bottom: clamp(8px, 1.5vh, 15px);
            filter: drop-shadow(0 4px 8px rgba(102, 126, 234, 0.3));
            animation: float 3s ease-in-out infinite;
          }
          
          .signup-title {
            font-size: clamp(1.3rem, 3.5vw, 1.8rem);
            font-weight: 700;
            margin: 0 0 clamp(4px, 0.8vh, 8px) 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-align: center;
          }
          
          .signup-subtitle {
            color: #718096;
            font-size: clamp(0.75rem, 1.8vw, 0.9rem);
            margin: 0;
            text-align: center;
          }
          
          .signup-form {
            margin-bottom: clamp(10px, 1.5vh, 20px);
          }
          
          .signup-form-group {
            margin-bottom: clamp(12px, 1.8vh, 18px);
          }
          
          .signup-form-label {
            display: block;
            font-size: clamp(0.75rem, 1.8vw, 0.85rem);
            font-weight: 600;
            color: #4a5568;
            margin-bottom: clamp(4px, 0.8vh, 6px);
          }
          
          .signup-form-input {
            width: 100%;
            padding: clamp(10px, 1.8vh, 14px) clamp(12px, 2.5vw, 18px);
            border: 2px solid #e2e8f0;
            border-radius: clamp(8px, 1.2vw, 10px);
            font-size: clamp(0.85rem, 1.8vw, 0.95rem);
            background: rgba(255, 255, 255, 0.8);
            transition: all 0.3s ease;
            outline: none;
            box-sizing: border-box;
          }
          
          .signup-submit-button {
            width: 100%;
            padding: clamp(10px, 1.8vh, 14px);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: clamp(8px, 1.2vw, 10px);
            font-size: clamp(0.9rem, 2.2vw, 1rem);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            position: relative;
            overflow: hidden;
          }
          
          @media (max-height: 650px) {
            .signup-card {
              padding: 12px 18px;
              max-height: 98vh;
            }
            .signup-icon {
              font-size: 1.8rem;
              margin-bottom: 6px;
            }
            .signup-form-group {
              margin-bottom: 10px;
            }
          }
          
          @media (max-width: 480px) {
            .signup-card {
              margin: 1vh 0;
            }
          }
        `}
      </style>

      <div className="signup-card">
        {/* Medical icon */}
        <div style={{ textAlign: 'center', marginBottom: 'clamp(12px, 2vh, 20px)' }}>
          <div className="signup-icon">👨‍⚕️</div>
          <h2 className="signup-title">{t('createAccount')}</h2>
          <p className="signup-subtitle">{t('joinIntelliCare')}</p>
        </div>

        <form onSubmit={handleSubmit} className="signup-form" autoComplete="off" aria-autocomplete="none">
          {/* Single decoy field to absorb autofill heuristics */}
          <input type="text" name="_decoy" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
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
            <label htmlFor="signup-full-name-input" style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#4a5568',
              marginBottom: '8px'
            }}>
              {t('fullName')}
            </label>
            <input
              id="signup-full-name-input"
              name="pn"
              type="text"
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
              placeholder={t('fullName')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              autoComplete="section-signup full-name-off"
              aria-autocomplete="none"
              data-lpignore="true"
              data-1p-ignore
              readOnly
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

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="signup-email-input" style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#4a5568',
              marginBottom: '8px'
            }}>
              {t('emailAddress')}
            </label>
            <input
              id="signup-email-input"
              name="ae"
              type="text"
              inputMode="email"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore
              data-bw-ignore
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

          {/* Info for existing practice signup */}
          {selectedPractice && (
            <div style={{
              marginBottom: '20px',
              padding: '15px',
              background: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '12px',
              fontSize: '14px',
              color: '#0c4a6e'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                📋 {t('joiningExistingPractice')}: <strong>{selectedPractice}</strong>
              </div>
              <div style={{ lineHeight: '1.5' }}>
                • {t('basicPermissionsNote')}<br/>
                • {t('adminCanUpgradeNote')}<br/>
                • {t('secureAccessNote')}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#4a5568',
              marginBottom: '8px'
            }}>
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
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
                boxSizing: 'border-box',
                WebkitTextSecurity: 'disc'
              }}
              placeholder={t('password')}
              value={formData.password}
              onChange={handleChange}
              readOnly
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

          <div style={{ marginBottom: '30px' }}>
            <label htmlFor="confirmPassword" style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#4a5568',
              marginBottom: '8px'
            }}>
              {t('confirmPassword')}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
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
                boxSizing: 'border-box',
                WebkitTextSecurity: 'disc'
              }}
              placeholder={t('confirmPassword')}
              value={formData.confirmPassword}
              onChange={handleChange}
              readOnly
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
            {loading ? t('creatingAccount') : t('signUp')}
          </button>
        </form>

        <div style={{ textAlign: 'center' }}>
          <p style={{
            color: '#718096',
            fontSize: '0.9rem',
            margin: '0 0 15px 0'
          }}>
            {t('alreadyHaveAccount')}{' '}
            <Link 
              to="/login" 
              style={{
                color: '#667eea',
                fontWeight: '600',
                textDecoration: 'none',
                transition: 'color 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.color = '#764ba2'}
              onMouseLeave={(e) => e.target.style.color = '#667eea'}
            >
              {t('signIn')}
            </Link>
          </p>
          
        </div>
      </div>
      </div>
    </div>
  );
};

export default Signup;
