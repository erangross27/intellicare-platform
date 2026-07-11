import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../config/languagesStatic';
import LanguageSwitcher from './LanguageSwitcher';
import { isAdmin } from '../config/roleConfig';
import './Navigation.css';

const Navigation = () => {
  const location = useLocation();

  const { user, practice, logout } = useAuth();
  const { t, isRTL } = useLanguage();
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 🎯 PERFORMANCE: Memoize isActive function to prevent useCallback dependency issues
  // const isActive = useCallback((path) => {
  //   return location.pathname === path;
  // }, [location.pathname]);

  // 🎯 CRITICAL PERFORMANCE FIX: Memoized styles to prevent re-renders




  const navigationLinksContainerStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    order: 2,
    flexDirection: 'row'
  }), []);



  const companyDropdownContainerStyle = useMemo(() => ({
    position: 'relative'
  }), []);



  // Dropdown menu now uses CSS classes for better performance



  const languageSwitcherContainerStyle = useMemo(() => ({
    margin: '0 8px'
  }), []);



  // Logo styles - Modern Clean Design
  const logoLinkStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
    color: '#111827',
    fontSize: '1.8rem',
    fontWeight: '700',
    gap: '12px',
    flexDirection: 'row'
  }), []);

  const logoIconStyle = useMemo(() => ({
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    color: 'white',
    boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)'
  }), []);

  // Dropdown styles - White box centered below Company button
  const dropdownMenuStyle = useMemo(() => ({
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: '-20px',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    minWidth: '120px',
    zIndex: 1000,
    display: 'block',
    padding: '4px 0'
  }), []);

  const dropdownLinkStyle = useMemo(() => ({
    display: 'block',
    padding: '8px 12px',
    color: '#000000',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '400',
    backgroundColor: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease'
  }), []);

  // Auth button styles - Clean without frames
  const authButtonStyle = useMemo(() => ({
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    fontSize: '0.875rem',
    fontWeight: '500',
    padding: '8px 12px',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'color 0.2s ease'
  }), []);

  // Company button styles - Clean without frames
  const companyButtonStyle = useMemo(() => ({
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    fontSize: '0.875rem',
    fontWeight: '500',
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'color 0.2s ease'
  }), []);

  // Primary navigation button styles
  const primaryButtonStyle = useMemo(() => ({
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    fontSize: '0.875rem',
    fontWeight: '500',
    padding: '8px 12px',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'color 0.2s ease'
  }), []);

  // Logout button styles
  const logoutButtonStyle = useMemo(() => ({
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    fontSize: '0.875rem',
    fontWeight: '500',
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }), []);

  // Main navigation styles - Modern Clean Design with full width
  const navStyle = useMemo(() => ({
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    width: '100vw',
    margin: 0,
    padding: 0,
    left: 0,
    right: 0
  }), []);

  const navContainerStyle = useMemo(() => ({
    width: '100%',
    margin: '0',
    padding: '0',
    maxWidth: '1200px',
    marginLeft: 'auto',
    marginRight: 'auto'
  }), []);

  const navContentStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    height: '70px',
    position: 'relative',
    direction: isRTL ? 'rtl' : 'ltr',
    padding: '0 20px',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 'none'
  }), [isRTL]);

  // RTL/LTR layout styles
  const rtlLogoPositionStyle = useMemo(() => ({
    flex: '0 0 auto',
    minWidth: '200px'
  }), []);

  const rtlNavigationCenterStyle = useMemo(() => ({
    flex: '1',
    display: 'flex',
    justifyContent: 'center'
  }), []);


  const ltrNavigationCenterStyle = useMemo(() => ({
    flex: '1',
    display: 'flex',
    justifyContent: 'center'
  }), []);

  const ltrLogoStyle = useMemo(() => ({
    flex: '0 0 auto',
    minWidth: '200px',
    display: 'flex',
    justifyContent: 'flex-end'
  }), []);

  const handleLogout = () => {
    process.env.NODE_ENV !== 'production' && console.log('🔴 LOGOUT: Starting logout process');
    process.env.NODE_ENV !== 'production' && console.log('🔴 LOGOUT: Current location:', location.pathname);
    logout();
    process.env.NODE_ENV !== 'production' && console.log('🔴 LOGOUT: Logout completed, using window.location.href');
    window.location.href = '/';
    process.env.NODE_ENV !== 'production' && console.log('🔴 LOGOUT: Window location set');
  };

  // Close dropdown when clicking outside - only if dropdown is open
  useEffect(() => {
    process.env.NODE_ENV !== 'production' && console.log('🟡 useEffect triggered, companyDropdownOpen:', companyDropdownOpen);

    if (!companyDropdownOpen) {
      process.env.NODE_ENV !== 'production' && console.log('🟡 Dropdown closed, not adding listener');
      return;
    }

    const handleClickOutside = (event) => {
      process.env.NODE_ENV !== 'production' && console.log('🔴 Click outside handler triggered');
      process.env.NODE_ENV !== 'production' && console.log('🔴 Target:', event.target);
      process.env.NODE_ENV !== 'production' && console.log('🔴 Dropdown ref:', dropdownRef.current);
      process.env.NODE_ENV !== 'production' && console.log('🔴 Contains check:', dropdownRef.current && dropdownRef.current.contains(event.target));

      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        process.env.NODE_ENV !== 'production' && console.log('🔴 CLOSING dropdown due to outside click');
        setCompanyDropdownOpen(false);
      } else {
        process.env.NODE_ENV !== 'production' && console.log('🔴 Click was inside dropdown, keeping open');
      }
    };

    // Add a small delay to prevent immediate closing when opening
    process.env.NODE_ENV !== 'production' && console.log('🟡 Adding click outside listener with delay');
    const timeoutId = setTimeout(() => {
      process.env.NODE_ENV !== 'production' && console.log('🟡 Actually adding mousedown listener now');
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      process.env.NODE_ENV !== 'production' && console.log('🟡 Cleaning up click outside listener');
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [companyDropdownOpen]);








  // Navigation links (center) - Both RTL and LTR: Company → Register → Login → Logo → Switcher (when logged out) / Company → Diagnosis → Patients → Logo → Switcher (when logged in)
  const NavigationLinks = (
    <div style={navigationLinksContainerStyle}>
      {/* Home - Only show when NOT logged in AND not currently on home page */}
      {!user && location.pathname !== '/' && (
        <Link
          to="/"
          style={primaryButtonStyle}
        >
          {t('home')}
        </Link>
      )}

      {/* User-specific links for logged in users */}
      {user ? (
        <>
          <Link
            to="/home"
            style={primaryButtonStyle}
          >
            {t('home')}
          </Link>
          <Link
            to="/diagnosis"
            style={primaryButtonStyle}
          >
            {t('diagnosis')}
          </Link>
          <Link
            to="/patients"
            style={primaryButtonStyle}
          >
            {t('patients')}
          </Link>
          <Link
            to="/chat"
            style={primaryButtonStyle}
          >
            🤖 {t('chatAgent') || (isRTL ? 'סוכן צ\'אט' : 'Chat Agent')}
          </Link>
          {isAdmin(user?.roles) && (
            <Link to="/users" style={primaryButtonStyle}>
              👥 {t('userManagement')}
            </Link>
          )}
        </>
      ) : (
        <>
          {/* Company dropdown - Second */}
          <div ref={dropdownRef} style={companyDropdownContainerStyle}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCompanyDropdownOpen(!companyDropdownOpen);
              }}
              style={companyButtonStyle}
            >
              <span>{t('company')}</span>
            </button>
            
            {companyDropdownOpen && (
              <div style={dropdownMenuStyle}>
                {process.env.NODE_ENV !== 'production' && console.log('🟢 DROPDOWN MENU IS RENDERING!')}
                <Link
                  to="/about"
                  onClick={() => {
                    process.env.NODE_ENV !== 'production' && console.log('🟢 About link clicked');
                    setCompanyDropdownOpen(false);
                  }}
                  style={dropdownLinkStyle}
                >
                  {t('about')}
                </Link>
                <Link
                  to="/contact"
                  onClick={() => {
                    process.env.NODE_ENV !== 'production' && console.log('🟢 Contact link clicked');
                    setCompanyDropdownOpen(false);
                  }}
                  style={dropdownLinkStyle}
                >
                  {t('contact')}
                </Link>
              </div>
            )}
          </div>

          {/* Register - Third */}
          <Link
            to="/signup"
            style={authButtonStyle}
          >
            {t('signup')}
          </Link>

          {/* Login - Fourth */}
          <Link
            to="/login"
            style={authButtonStyle}
          >
            {t('login')}
          </Link>
        </>
      )}

      {/* Language switcher - Always last */}
      <div style={languageSwitcherContainerStyle}>
        <LanguageSwitcher />
      </div>
    </div>
  );

  // IntelliCare logo - RTL: leftmost, LTR: rightmost
  const Logo = (
    <Link
      to="/"
      style={logoLinkStyle}
    >
      <span>IntelliCare</span>
      <div style={logoIconStyle}>
        🏥
      </div>
    </Link>
  );

  return (
    <nav style={navStyle}>
      <div style={navContainerStyle}>
        <div style={navContentStyle}>
          {isRTL ? (
            <>
              {/* RTL Layout: Logo (left) | Navigation (center) | User Info (right) */}
              <div style={rtlLogoPositionStyle}>
                {Logo}
              </div>

              <div style={rtlNavigationCenterStyle}>
                {NavigationLinks}
              </div>
            </>
          ) : (
            <>
              {/* LTR Layout: Navigation (center) | Logo (right) */}
              <div style={ltrNavigationCenterStyle}>
                {NavigationLinks}
              </div>

              <div style={ltrLogoStyle}>
                {Logo}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
