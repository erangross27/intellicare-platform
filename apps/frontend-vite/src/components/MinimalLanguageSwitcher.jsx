import React, { useState, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { shouldShowLanguageSwitcher } from '../services/practiceLanguageDetector';
import { shouldShowLanguageSwitcher as shouldShowByRegion, getAvailableLanguagesByRegion } from '../utils/regionDetector';

/**
 * Minimal Professional Language Switcher
 * Only appears on parent domain, hidden on practice subdomains
 */
const MinimalLanguageSwitcher = () => {
  const { currentLanguage, changeLanguage } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState(['en', 'he']);

  useEffect(() => {
    // Check if switcher should be shown based on domain AND region
    const shouldShowForDomain = shouldShowLanguageSwitcher(window.location.hostname);
    const shouldShowForRegion = shouldShowByRegion();
    const languages = getAvailableLanguagesByRegion();

    // Only show if both domain and region allow it
    const shouldShow = shouldShowForDomain && shouldShowForRegion;
    setIsVisible(shouldShow);
    setAvailableLanguages(languages);

    if (!shouldShow) {
      if (!shouldShowForRegion) {
        console.log('🇺🇸 Language switcher hidden for US users');
      } else {
        console.log('🚫 Language switcher hidden on this domain');
      }
    }
  }, []);
  
  // Don't render if not allowed
  if (!isVisible) return null;
  
  // Container style - clean and minimal
  const containerStyle = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    display: 'flex',
    backgroundColor: '#202123',
    borderRadius: '8px',
    padding: '2px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    zIndex: 1000,
    transition: 'all 0.2s ease'
  };

  // Button style function - clean and professional
  const buttonStyle = (isActive) => ({
    position: 'relative',
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: isActive ?
      'rgba(255, 255, 255, 0.1)' :
      'transparent',
    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
    fontSize: '12px',
    fontWeight: '500',
    letterSpacing: '0.3px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textTransform: 'uppercase',
    outline: 'none',
    minWidth: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none'
  });
  
  return (
    <div style={containerStyle}>
      <button
        onClick={() => changeLanguage('en')}
        style={buttonStyle(currentLanguage === 'en')}
        onMouseEnter={(e) => {
          if (currentLanguage !== 'en') {
            e.target.style.color = '#ffffff';
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          }
        }}
        onMouseLeave={(e) => {
          if (currentLanguage !== 'en') {
            e.target.style.color = 'rgba(255, 255, 255, 0.5)';
            e.target.style.backgroundColor = 'transparent';
          }
        }}
        aria-label="Switch to English"
        title="English"
      >
        EN
      </button>

      {availableLanguages.includes('he') && (
        <button
          onClick={() => changeLanguage('he')}
          style={buttonStyle(currentLanguage === 'he')}
          onMouseEnter={(e) => {
            if (currentLanguage !== 'he') {
              e.target.style.color = '#ffffff';
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (currentLanguage !== 'he') {
              e.target.style.color = 'rgba(255, 255, 255, 0.5)';
              e.target.style.backgroundColor = 'transparent';
            }
          }}
          aria-label="Switch to Hebrew"
          title="עברית"
        >
          עב
        </button>
      )}
    </div>
  );
};

// Alternative compact version without flags
export const CompactLanguageSwitcher = () => {
  const { currentLanguage, changeLanguage } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState(['en', 'he']);

  useEffect(() => {
    const shouldShowForDomain = shouldShowLanguageSwitcher(window.location.hostname);
    const shouldShowForRegion = shouldShowByRegion();
    const languages = getAvailableLanguagesByRegion();

    setIsVisible(shouldShowForDomain && shouldShowForRegion);
    setAvailableLanguages(languages);
  }, []);

  if (!isVisible) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'rgba(20, 20, 25, 0.7)',
      backdropFilter: 'blur(10px)',
      borderRadius: '8px',
      padding: '4px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      zIndex: 1000,
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div 
        style={{
          padding: '4px 8px',
          color: currentLanguage === 'en' ? '#fff' : 'rgba(255, 255, 255, 0.4)',
          cursor: 'pointer',
          borderRadius: '4px',
          backgroundColor: currentLanguage === 'en' ? 'rgba(99, 102, 241, 0.8)' : 'transparent',
          transition: 'all 0.2s ease'
        }}
        onClick={() => changeLanguage('en')}
      >
        EN
      </div>
      {availableLanguages.includes('he') && (
        <>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.1)', margin: '0 2px' }} />
          <div
            style={{
              padding: '4px 8px',
              color: currentLanguage === 'he' ? '#fff' : 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              borderRadius: '4px',
              backgroundColor: currentLanguage === 'he' ? 'rgba(99, 102, 241, 0.8)' : 'transparent',
              transition: 'all 0.2s ease'
            }}
            onClick={() => changeLanguage('he')}
          >
            עב
          </div>
        </>
      )}
    </div>
  );
};

export default MinimalLanguageSwitcher;