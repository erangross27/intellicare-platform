import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';

/**
 * Professional OTP Input Component
 * 6 square boxes for verification code entry
 */
const OTPInput = ({ 
  onComplete, 
  onResend, 
  loading = false, 
  error = null,
  email = '',
  expiresIn = 600 // 10 minutes default
}) => {
  const { currentLanguage, isRTL } = useLanguage();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(expiresIn);
  const [canResend, setCanResend] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRefs = useRef([]);
  
  // Glassmorphism colors - matching the rest of the interface
  const colors = {
    title: '#ffffff',
    subtitle: 'rgba(255, 255, 255, 0.7)',
    text: '#ffffff',
    inputBg: 'rgba(255, 255, 255, 0.1)',
    inputBorder: 'rgba(255, 255, 255, 0.2)',
    focusBorder: 'rgba(167, 139, 250, 0.5)',
    successBorder: 'rgba(34, 197, 94, 0.5)',
    errorBorder: 'rgba(239, 68, 68, 0.5)',
    successBg: 'rgba(34, 197, 94, 0.15)',
    successText: '#ffffff',
    loadingText: 'rgba(255, 255, 255, 0.9)',
    errorText: '#ffffff',
    timerText: 'rgba(255, 255, 255, 0.6)',
    buttonText: 'rgba(255, 255, 255, 0.9)',
    buttonHoverBg: 'rgba(167, 139, 250, 0.2)',
    disabledButton: 'rgba(255, 255, 255, 0.4)'
  };

  // Translations
  const t = {
    title: {
      en: 'Enter Verification Code',
      he: 'הזן קוד אימות'
    },
    subtitle: {
      en: `We sent a 6-digit code to ${email}`,
      he: `שלחנו קוד בן 6 ספרות אל ${email}`
    },
    verifying: {
      en: 'Verifying...',
      he: 'מאמת...'
    },
    resend: {
      en: 'Resend Code',
      he: 'שלח קוד מחדש'
    },
    resendIn: {
      en: 'Resend in',
      he: 'שלח שוב בעוד'
    },
    expiresIn: {
      en: 'Code expires in',
      he: 'הקוד יפוג בעוד'
    },
    expired: {
      en: 'Code expired',
      he: 'הקוד פג תוקף'
    },
    paste: {
      en: 'Paste your code',
      he: 'הדבק את הקוד שלך'
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeRemaining > 0 && !isVerified) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
        
        // Enable resend after 60 seconds
        if (timeRemaining === expiresIn - 60) {
          setCanResend(true);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining, isVerified, expiresIn]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Shake animation and clear code on error
  useEffect(() => {
    if (error) {
      setIsShaking(true);
      // Clear the code so user can try again
      setCode(['', '', '', '', '', '']);
      setFocusedIndex(0);
      // Reset verification state to allow retry
      setIsVerified(false);
      // Focus first input after clearing
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
      setTimeout(() => setIsShaking(false), 500);
    }
  }, [error]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle input change
  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }

    // Check if complete
    if (newCode.every(digit => digit !== '')) {
      const fullCode = newCode.join('');
      handleSubmit(fullCode);
    }
  };

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      
      const newCode = [...code];
      
      if (code[index]) {
        // Clear current input
        newCode[index] = '';
        setCode(newCode);
      } else if (index > 0) {
        // Move to previous input and clear it
        newCode[index - 1] = '';
        setCode(newCode);
        inputRefs.current[index - 1]?.focus();
        setFocusedIndex(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');
    
    if (digits.length > 0) {
      const newCode = ['', '', '', '', '', ''];
      digits.forEach((digit, i) => {
        if (i < 6) newCode[i] = digit;
      });
      setCode(newCode);
      
      // Focus last filled input or next empty one
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      setFocusedIndex(nextIndex);
      
      // If complete, submit
      if (digits.length === 6) {
        handleSubmit(digits.join(''));
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (fullCode) => {
    if (loading || isVerified) return;
    
    // Add success animation before calling onComplete
    setIsVerified(true);
    
    // Small delay for animation
    setTimeout(() => {
      onComplete(fullCode);
    }, 300);
  };

  // Handle resend
  const handleResend = () => {
    if (!canResend || loading) return;
    
    setCanResend(false);
    setTimeRemaining(expiresIn);
    setCode(['', '', '', '', '', '']);
    setIsVerified(false);
    inputRefs.current[0]?.focus();
    setFocusedIndex(0);
    
    if (onResend) {
      onResend();
    }
  };

  return (
    <div style={{
      padding: '30px',
      maxWidth: '400px',
      margin: '0 auto',
      direction: isRTL ? 'rtl' : 'ltr'
    }}>
      {/* Title */}
      <h3 style={{
        textAlign: 'center',
        color: colors.title,
        marginBottom: '10px',
        fontSize: '20px',
        fontWeight: '600'
      }}>
        {t.title[currentLanguage]}
      </h3>
      
      {/* Subtitle */}
      <p style={{
        textAlign: 'center',
        color: colors.subtitle,
        marginBottom: '30px',
        fontSize: '14px'
      }}>
        {t.subtitle[currentLanguage]}
      </p>

      {/* OTP Input Boxes */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '20px',
        direction: 'ltr' // Always LTR for number input
      }}
      className={isShaking ? 'shake-animation' : ''}
      >
        {code.map((digit, index) => (
          <input
            key={index}
            ref={el => inputRefs.current[index] = el}
            type="text"
            inputMode="numeric"
            maxLength="1"
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => setFocusedIndex(index)}
            disabled={loading || isVerified}
            style={{
              width: '48px',
              height: '48px',
              border: `1px solid ${
                isVerified ? colors.successBorder :
                error && digit ? colors.errorBorder :
                focusedIndex === index ? colors.focusBorder :
                colors.inputBorder
              }`,
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: '600',
              color: isVerified ? colors.successText : colors.text,
              backgroundColor: isVerified ? colors.successBg : colors.inputBg,
              transition: 'all 0.2s ease',
              outline: 'none',
              cursor: loading ? 'wait' : 'text',
              transform: isVerified ? 'scale(1.05)' : 'scale(1)',
              boxShadow: focusedIndex === index ? '0 0 0 2px rgba(255, 255, 255, 0.05)' : 'none'
            }}
          />
        ))}
      </div>

      {/* Loading indicator */}
      {loading && !isVerified && (
        <p style={{
          textAlign: 'center',
          color: colors.loadingText,
          fontSize: '14px',
          marginBottom: '15px'
        }}>
          {t.verifying[currentLanguage]}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p style={{
          textAlign: 'center',
          color: colors.errorText,
          fontSize: '14px',
          marginBottom: '15px'
        }}>
          {error}
        </p>
      )}

      {/* Success checkmark */}
      {isVerified && (
        <div style={{
          textAlign: 'center',
          marginBottom: '15px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.3" fill="rgba(16, 163, 127, 0.1)"/>
            <polyline points="8 12 11 15 16 9" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Timer and Resend */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '20px'
      }}>
        <div style={{
          fontSize: '14px',
          color: timeRemaining > 60 ? colors.timerText : colors.errorText
        }}>
          {timeRemaining > 0 ? (
            <>
              {t.expiresIn[currentLanguage]} {formatTime(timeRemaining)}
            </>
          ) : (
            <span style={{ color: colors.errorText }}>
              {t.expired[currentLanguage]}
            </span>
          )}
        </div>
        
        <button
          onClick={handleResend}
          disabled={!canResend || loading}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            color: canResend ? colors.buttonText : colors.disabledButton,
            backgroundColor: 'transparent',
            border: `1px solid ${canResend ? colors.buttonText : colors.disabledButton}`,
            borderRadius: '6px',
            cursor: canResend ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease',
            opacity: canResend ? 1 : 0.5
          }}
          onMouseEnter={(e) => {
            if (canResend) {
              e.target.style.backgroundColor = colors.buttonHoverBg;
              e.target.style.borderColor = colors.buttonText;
            }
          }}
          onMouseLeave={(e) => {
            if (canResend) {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.borderColor = canResend ? colors.buttonText : colors.disabledButton;
            }
          }}
        >
          {canResend ? t.resend[currentLanguage] : `${t.resendIn[currentLanguage]} ${60 - (expiresIn - timeRemaining)}s`}
        </button>
      </div>

      {/* Paste hint */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px',
        marginTop: '15px'
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(236, 236, 241, 0.4)" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span style={{
          fontSize: '12px',
          color: 'rgba(236, 236, 241, 0.4)'
        }}>
          {t.paste[currentLanguage]}
        </span>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        .shake-animation {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default OTPInput;