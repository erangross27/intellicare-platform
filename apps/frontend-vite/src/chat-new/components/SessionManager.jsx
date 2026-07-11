import React, { useState, useEffect, useCallback } from 'react';

import secureStorage from '../../utils/secureStorage';
const SessionManager = ({ 
  currentSessionId, 
  onSessionChange, 
  onNewSession,
  language 
}) => {
  const [sessions, setSessions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const isRTL = language === 'he';
  
  // Load sessions from localStorage
  useEffect(() => {
    const loadSessions = () => {
      try {
        const stored = secureStorage.getItem('chat_sessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSessions(parsed);
        }
      } catch (err) {
        process.env.NODE_ENV !== 'production' && console.error('Failed to load sessions:', err);
      }
    };
    
    loadSessions();
    // Reload sessions every 5 seconds
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Save current session info
  const saveCurrentSession = useCallback((sessionId, title) => {
    try {
      const sessions = JSON.parse(secureStorage.getItem('chat_sessions') || '[]');
      const exists = sessions.find(s => s.id === sessionId);
      
      if (!exists) {
        sessions.unshift({
          id: sessionId,
          title: title || (isRTL ? 'שיחה חדשה' : 'New Chat'),
          timestamp: new Date().toISOString(),
          lastActive: new Date().toISOString()
        });
      } else {
        exists.lastActive = new Date().toISOString();
        if (title) exists.title = title;
      }
      
      // Keep only last 20 sessions
      const limited = sessions.slice(0, 20);
      secureStorage.setItem('chat_sessions', JSON.stringify(limited));
      setSessions(limited);
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to save session:', err);
    }
  }, [isRTL]);
  
  // Container styles
  const containerStyle = {
    position: 'relative'
  };
  
  const buttonStyle = {
    padding: '8px 12px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#4b5563'
  };
  
  const dropdownStyle = {
    position: 'absolute',
    top: '100%',
    right: isRTL ? 'auto' : '0',
    left: isRTL ? '0' : 'auto',
    marginTop: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    minWidth: '250px',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 1000,
    display: isOpen ? 'block' : 'none'
  };
  
  const sessionItemStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    direction: isRTL ? 'rtl' : 'ltr'
  };
  
  const sessionTitleStyle = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: '4px'
  };
  
  const sessionTimeStyle = {
    fontSize: '12px',
    color: '#9ca3af'
  };
  
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const mins = Math.floor(diff / (1000 * 60));
      return isRTL ? `לפני ${mins} דקות` : `${mins} min ago`;
    } else if (hours < 24) {
      return isRTL ? `לפני ${hours} שעות` : `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return isRTL ? `לפני ${days} ימים` : `${days}d ago`;
    }
  };
  
  const handleSessionClick = (session) => {
    onSessionChange(session.id);
    setIsOpen(false);
  };
  
  const handleNewSession = () => {
    onNewSession();
    setIsOpen(false);
  };
  
  return (
    <div style={containerStyle}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={buttonStyle}
      >
        <span>📋</span>
        <span>{isRTL ? 'היסטוריית שיחות' : 'Chat History'}</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>
      
      <div style={dropdownStyle}>
        <div 
          style={{...sessionItemStyle, backgroundColor: '#f0f9ff'}}
          onClick={handleNewSession}
        >
          <div style={sessionTitleStyle}>
            ➕ {isRTL ? 'שיחה חדשה' : 'New Chat'}
          </div>
        </div>
        
        {sessions.map(session => (
          <div
            key={session.id}
            style={{
              ...sessionItemStyle,
              backgroundColor: session.id === currentSessionId ? '#f3f4f6' : '#ffffff'
            }}
            onClick={() => handleSessionClick(session)}
            onMouseEnter={(e) => {
              if (session.id !== currentSessionId) {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }
            }}
            onMouseLeave={(e) => {
              if (session.id !== currentSessionId) {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }
            }}
          >
            <div style={sessionTitleStyle}>
              {session.title}
            </div>
            <div style={sessionTimeStyle}>
              {formatTime(session.lastActive)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SessionManager;