import React, { useState, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';
import './SessionWarningModal.css';

/**
 * Session Warning Modal
 * Shows a warning when session is about to expire
 * Part of the comprehensive session management system
 */
const SessionWarningModal = ({ 
  isVisible, 
  timeRemaining, 
  onExtendSession, 
  onLogout 
}) => {
  const { t, isRTL } = useLanguage();
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    // Update countdown when timeRemaining prop changes
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  if (!isVisible) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExtendSession = async () => {
    // Call the extend session function
    if (onExtendSession) {
      await onExtendSession();
    }
  };

  const handleLogout = () => {
    // Call logout function
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="session-warning-overlay">
      <div className={`session-warning-modal ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="session-warning-icon">
          ⏰
        </div>
        
        <h2 className="session-warning-title">
          {t('sessionExpiring', {
            en: 'Your Session is About to Expire',
            he: 'ההפעלה שלך עומדת לפוג'
          })}
        </h2>
        
        <p className="session-warning-message">
          {t('sessionExpiringMessage', {
            en: `Your session will expire in ${formatTime(countdown)} due to inactivity.`,
            he: `ההפעלה שלך תפוג בעוד ${formatTime(countdown)} עקב חוסר פעילות.`
          })}
        </p>
        
        <p className="session-warning-submessage">
          {t('sessionExpiringSubmessage', {
            en: 'Would you like to stay logged in?',
            he: 'האם ברצונך להישאר מחובר?'
          })}
        </p>
        
        <div className="session-warning-countdown">
          <span className="countdown-number">{formatTime(countdown)}</span>
        </div>
        
        <div className="session-warning-actions">
          <button 
            className="session-warning-button primary"
            onClick={handleExtendSession}
            aria-label="Stay logged in"
          >
            {t('stayLoggedIn', {
              en: 'Stay Logged In',
              he: 'הישאר מחובר'
            })}
          </button>
          
          <button 
            className="session-warning-button secondary"
            onClick={handleLogout}
            aria-label="Logout"
          >
            {t('logout', {
              en: 'Logout',
              he: 'התנתק'
            })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarningModal;