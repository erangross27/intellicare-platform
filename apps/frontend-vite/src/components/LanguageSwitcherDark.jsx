import React, { memo, useMemo, useState } from 'react';
import { useLanguage } from '../config/languagesStatic';

const LanguageSwitcherDark = memo(() => {
  const { currentLanguage, changeLanguage, isRTL } = useLanguage();
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Professional dark theme container style
  const containerStyle = useMemo(() => ({
    position: 'relative',
    display: 'inline-block'
  }), []);

  // Modern button style for dark theme
  const buttonStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    color: '#e5e5e7',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    outline: 'none',
    userSelect: 'none',
    boxShadow: isHovered ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
    transform: isHovered ? 'translateY(-1px)' : 'none'
  }), [isHovered]);

  // Dropdown menu style
  const dropdownStyle = useMemo(() => ({
    position: 'absolute',
    top: '100%',
    [isRTL ? 'left' : 'right']: 0,
    marginTop: '8px',
    backgroundColor: '#2d2d30',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
    minWidth: '160px',
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transform: isOpen ? 'translateY(0)' : 'translateY(-10px)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 1001
  }), [isOpen, isRTL]);

  // Language option style
  const optionStyle = (isActive, isHoveredOption) => ({
    padding: '12px 16px',
    backgroundColor: isActive 
      ? 'rgba(99, 102, 241, 0.2)' 
      : isHoveredOption 
        ? 'rgba(255, 255, 255, 0.05)' 
        : 'transparent',
    color: isActive ? '#818cf8' : '#e5e5e7',
    fontSize: '14px',
    fontWeight: isActive ? '600' : '400',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  });

  // Globe icon style
  const globeIconStyle = useMemo(() => ({
    width: '18px',
    height: '18px',
    opacity: 0.9
  }), []);

  // Chevron icon style
  const chevronStyle = useMemo(() => ({
    width: '12px',
    height: '12px',
    opacity: 0.6,
    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.2s ease'
  }), [isOpen]);

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית' }
  ];

  const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];
  const [hoveredOption, setHoveredOption] = useState(null);

  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
    setIsOpen(false);
  };

  // Globe SVG icon
  const GlobeIcon = () => (
    <svg style={globeIconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );

  // Chevron SVG icon
  const ChevronIcon = () => (
    <svg style={chevronStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <div style={containerStyle}>
      <button
        style={buttonStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      >
        <GlobeIcon />
        <span>{currentLang.nativeName}</span>
        <ChevronIcon />
      </button>

      <div style={dropdownStyle}>
        {languages.map(lang => (
          <div
            key={lang.code}
            style={optionStyle(
              lang.code === currentLanguage,
              hoveredOption === lang.code
            )}
            onMouseEnter={() => setHoveredOption(lang.code)}
            onMouseLeave={() => setHoveredOption(null)}
            onClick={() => handleLanguageChange(lang.code)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{lang.nativeName}</span>
              {lang.code === currentLanguage && (
                <svg style={{ width: '16px', height: '16px', color: '#6366f1' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

LanguageSwitcherDark.displayName = 'LanguageSwitcherDark';

export default LanguageSwitcherDark;