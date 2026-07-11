import React, { memo, useMemo } from 'react';
import { useLanguage } from '../config/languagesStatic';
import './LanguageSwitcher.css';

const LanguageSwitcher = memo(() => {
  const { currentLanguage, availableLanguages, changeLanguage, loading, isRTL } = useLanguage();

  // 🚀 DEBUG: Log current language state
  process.env.NODE_ENV !== 'production' && console.log(`🌐 [FRONTEND] LanguageSwitcher render - currentLanguage: ${currentLanguage}`);

  // 🎯 CRITICAL PERFORMANCE FIX: Memoized styles to prevent re-renders


  const desktopContainerStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 255, 0.8) 100%)',
    borderRadius: '25px',
    padding: '4px',
    border: '1px solid rgba(102, 126, 234, 0.2)',
    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.1)',
    direction: 'rtl'
  }), []);

  const globeIconStyle = useMemo(() => ({
    fontSize: '1rem',
    [isRTL ? 'marginRight' : 'marginLeft']: '8px',
    [isRTL ? 'marginLeft' : 'marginRight']: '4px'
  }), [isRTL]);



  const hebrewButtonStyle = useMemo(() => ({
    padding: '8px 16px',
    border: 'none',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: currentLanguage === 'he'
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      : 'transparent',
    color: currentLanguage === 'he' ? 'white' : '#667eea',
    boxShadow: currentLanguage === 'he'
      ? '0 2px 8px rgba(102, 126, 234, 0.3)'
      : 'none',
    minWidth: '60px',
    textAlign: 'center',
    order: 1
  }), [currentLanguage]);

  const englishButtonStyle = useMemo(() => ({
    padding: '8px 16px',
    border: 'none',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: currentLanguage === 'en'
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      : 'transparent',
    color: currentLanguage === 'en' ? 'white' : '#667eea',
    boxShadow: currentLanguage === 'en'
      ? '0 2px 8px rgba(102, 126, 234, 0.3)'
      : 'none',
    minWidth: '60px',
    textAlign: 'center',
    order: 2
  }), [currentLanguage]);

  const loadingContainerStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(102, 126, 234, 0.1)',
    borderRadius: '20px',
    fontSize: '0.9rem',
    color: '#667eea'
  }), []);

  const handleLanguageChange = (languageCode, event) => {
    process.env.NODE_ENV !== 'production' && console.log(`🌐 [FRONTEND] Language switcher clicked: ${languageCode}`);

    // Show immediate visual feedback when clicking a language button
    const clickedButton = event?.target?.closest('button');
    if (clickedButton) {
      clickedButton.style.opacity = '0.7';
      clickedButton.style.transform = 'scale(0.95)';

      // Reset visual feedback after a short delay
      setTimeout(() => {
        clickedButton.style.opacity = '';
        clickedButton.style.transform = '';
      }, 150);
    }

    // Call the language change function
    if (changeLanguage) {
      changeLanguage(languageCode);
    } else {
      process.env.NODE_ENV !== 'production' && console.error('❌ [FRONTEND] changeLanguage function not available');
    }
  };

  // 🚀 CRITICAL FIX: Always render language switcher, never show loading
  const languagesToRender = availableLanguages.length > 0 ? availableLanguages : [
    { code: 'en', name: 'English', isRTL: false },
    { code: 'he', name: 'עברית', isRTL: true }
  ];

  // Never show loading - always render the switcher
  if (languagesToRender.length === 0) {
    return null; // Fallback if something goes wrong
  }

  return (
    <div style={desktopContainerStyle}>
      <span style={globeIconStyle}>🌐</span>

      {/* Hebrew button - always on the right (comes first to appear on left, but we want it on right) */}
      {languagesToRender.find(lang => lang.code === 'he') && (
        <button
          key="he"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            process.env.NODE_ENV !== 'production' && console.log('🌐 Hebrew button clicked');
            handleLanguageChange('he', e);
          }}
          style={{
            ...hebrewButtonStyle,
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
          onMouseEnter={(e) => {
            if (currentLanguage !== 'he') {
              e.target.style.background = 'rgba(102, 126, 234, 0.1)';
              e.target.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (currentLanguage !== 'he') {
              e.target.style.background = 'transparent';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          {languagesToRender.find(lang => lang.code === 'he')?.name}
        </button>
      )}

      {/* English button - always on the left */}
      {languagesToRender.find(lang => lang.code === 'en') && (
        <button
          key="en"
          onClick={(e) => handleLanguageChange('en', e)}
          style={englishButtonStyle}
          onMouseEnter={(e) => {
            if (currentLanguage !== 'en') {
              e.target.style.background = 'rgba(102, 126, 234, 0.1)';
              e.target.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (currentLanguage !== 'en') {
              e.target.style.background = 'transparent';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          {languagesToRender.find(lang => lang.code === 'en')?.name}
        </button>
      )}
    </div>
  );
});

LanguageSwitcher.displayName = 'LanguageSwitcher';

export default LanguageSwitcher;
