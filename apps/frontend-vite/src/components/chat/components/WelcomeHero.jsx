import React from 'react';
import PulseMark from '../../PulseMark';
import { useLanguage } from '../../../config/languagesStatic';
import './WelcomeCards.css';

/**
 * Shared chat empty-state hero — the approved blue-dark landing identity
 * (eyebrow, animated PulseMark, gradient headline, ECG signature line, and
 * lightweight action pills). Rendered by ChatArea when there are no messages
 * yet AND used as MessageList's empty fallback, so the two views can never
 * drift apart again. Style only — purely presentational, no side effects.
 */
const WelcomeHero = ({ language }) => {
  const { t } = useLanguage();

  return (
    <div className="wc-hero">
      <div className="wc-amb"><span className="b1" /><span className="b2" /></div>
      <div className="wc-inner">
        <div className="wc-eyebrow">{language === 'he' ? 'סביבת עבודה רפואית AI' : 'Clinical AI workspace'}</div>
        <div className="wc-mark">
          <PulseMark size={72} glow={false} />
        </div>

        {/* Welcome Text */}
        <h1 className="wc-headline">{t('chatGreeting')}</h1>

        <div className="wc-sub">{t('chatSubtitle')}</div>

        <svg className="wc-ecg" width="280" height="26" viewBox="0 0 280 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 13 H78 L88 13 L96 4 L108 22 L118 13 H170 L180 7 L188 19 L196 13 H278" />
        </svg>

        {/* Quick Start Actions — landing-style pills */}
        <div className="wc-actions">
          <div className="wc-chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('cmdAddPatient')}
          </div>

          <div className="wc-chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {t('cmdScheduleAppointment')}
          </div>

          <div className="wc-chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            {t('cmdSearchPatient')}
          </div>

          <div className="wc-chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            {t('cmdDailySummary')}
          </div>
        </div>

        {/* Helper Text */}
        <div className="wc-helper">
          {language === 'he' ? 'פשוט הקלד את השאלה או הבקשה שלך למטה' : 'Just type your question or request below'}
        </div>
      </div>
    </div>
  );
};

export default WelcomeHero;
