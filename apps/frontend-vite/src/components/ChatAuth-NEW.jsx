import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import ChatContainer from './chat/ChatContainer';

import secureStorage from '../utils/secureStorage';
/**
 * ChatAuth - Simplified version using new optimized ChatContainer
 * Handles authentication flow then delegates to ChatContainer
 */
const ChatAuth = React.memo(() => {
  const { login, signup, isAuthenticated, logout, user, practice } = useAuth();
  const [language, setLanguage] = useState(() => {
    return secureStorage.getItem('appLanguage') || 'he';
  });
  
  const isRTL = useMemo(() => language === 'he', [language]);
  
  // Container styles
  const containerStyle = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    background: 'linear-gradient(135deg, #0a0e27 0%, #141832 100%)',
    direction: isRTL ? 'rtl' : 'ltr',
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  }), [isRTL]);
  
  // Login form styles
  const loginFormStyle = {
    maxWidth: '400px',
    width: '90%',
    margin: '100px auto',
    padding: '40px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
  };
  
  const inputStyle = {
    width: '100%',
    padding: '12px',
    marginBottom: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    direction: isRTL ? 'rtl' : 'ltr'
  };
  
  const buttonStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  };
  
  const titleStyle = {
    textAlign: 'center',
    marginBottom: '32px',
    color: '#1f2937',
    fontSize: '28px',
    fontWeight: '700'
  };
  
  // Simple login state
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
    practice: 'testpractice'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Force dark background
  useEffect(() => {
    document.body.style.background = 'linear-gradient(135deg, #0a0e27 0%, #141832 100%)';
    document.body.style.backgroundColor = '#0a0e27';
  }, []);
  
  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await login(loginData.email, loginData.password, loginData.practice);
    } catch (err) {
      setError(isRTL ? 'שגיאה בהתחברות. נסה שוב.' : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // If not authenticated, show login form
  if (!isAuthenticated) {
    return (
      <div style={containerStyle}>
        <form onSubmit={handleLogin} style={loginFormStyle}>
          <h1 style={titleStyle}>IntelliCare</h1>
          
          <input
            type="text"
            placeholder={isRTL ? 'מרפאה' : 'Practice'}
            value={loginData.practice}
            onChange={(e) => setLoginData({...loginData, practice: e.target.value})}
            style={inputStyle}
            required
          />
          
          <input
            type="email"
            placeholder={isRTL ? 'דוא"ל' : 'Email'}
            value={loginData.email}
            onChange={(e) => setLoginData({...loginData, email: e.target.value})}
            style={inputStyle}
            required
          />
          
          <input
            type="password"
            placeholder={isRTL ? 'סיסמה' : 'Password'}
            value={loginData.password}
            onChange={(e) => setLoginData({...loginData, password: e.target.value})}
            style={inputStyle}
            required
          />
          
          {error && (
            <div style={{color: 'red', marginBottom: '16px', textAlign: 'center'}}>
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            style={buttonStyle}
            disabled={isLoading}
          >
            {isLoading 
              ? (isRTL ? 'מתחבר...' : 'Logging in...') 
              : (isRTL ? 'התחבר' : 'Login')}
          </button>
        </form>
      </div>
    );
  }
  
  // If authenticated, use the new optimized ChatContainer
  return (
    <div style={containerStyle}>
      <ChatContainer
        apiUrl={process.env.REACT_APP_API_URL || '/api'}
        practice={practice?.subdomain || 'testpractice'}
        authToken={user?.token || secureStorage.getItem('authToken')}
        language={language}
      />
    </div>
  );
});

ChatAuth.displayName = 'ChatAuth';

export default ChatAuth;