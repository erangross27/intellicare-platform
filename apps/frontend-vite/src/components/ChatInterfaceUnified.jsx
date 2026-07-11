import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ChatInterfaceDark.css';
import UserSettings from './UserSettings';
import HelpModal from './HelpModal';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const ChatInterfaceUnified = ({ language = 'he' }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile');
  const [showHelp, setShowHelp] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const profileMenuRef = useRef(null);
  
  const isRTL = language === 'he';

  // Debug: Log when showSettings changes
  useEffect(() => {
    process.env.NODE_ENV !== 'production' && console.log('showSettings state changed to:', showSettings);
  }, [showSettings]);

  // Handle clicking outside profile menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
    fetchUserInfo();
  }, []);

  // Fetch user information
  const fetchUserInfo = async () => {
    try {
      const result = await secureApi.get('/auth/me');

      if (!result.error) {
        setUserInfo(result.user);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to fetch user info:', error);
    }
  };

  const initializeSession = async () => {
    try {
      const result = await secureApi.post('/chat/sessions', {
        title: isRTL ? 'שיחה חדשה' : 'New Chat',
        language: language
      });

      if (!result.error) {
        setSessionId(result.data.sessionId);
        
        // Add welcome message
        const welcomeMessage = {
          id: Date.now(),
          type: 'agent',
          content: isRTL 
            ? 'שלום! אני כאן לעזור לך עם כל פעולה במערכת. פשוט תגיד לי מה אתה צריך.'
            : 'Hello! I\'m here to help you with any system operation. Just tell me what you need.',
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to initialize session:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      const result = await secureApi.post('/api/agent/chat', {
        message: currentInput,
        sessionId: sessionId,
        language: language
      });

      if (!result.error) {
        process.env.NODE_ENV !== 'production' && console.log('🎯 Chat response received:', result);
        
        // Always show regular conversational response (no form cards)
        const agentMessage = {
          id: Date.now() + 1,
          type: 'agent',
          content: result.message || result.data?.message || 'No response',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, agentMessage]);
        
        // Check for special commands to close panel
        if (currentInput.toLowerCase().includes('close') || 
            currentInput.includes('סגור')) {
          if (window.clearContextPanel) {
            window.clearContextPanel();
          }
        }
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to send message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: isRTL ? 'שגיאה בשליחת ההודעה' : 'Error sending message',
        isError: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };


  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const MessageBubble = ({ message }) => {
    const isUser = message.type === 'user';
    
    return (
      <div className={`message-wrapper ${isUser ? 'user' : 'agent'}`}>
        <div className={`message-bubble ${isUser ? 'user' : 'agent'} ${message.isError ? 'error' : ''}`}>
          <div className="message-content">
            {message.content}
          </div>
          <div className="message-time">
            {new Date(message.timestamp).toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`chat-interface-dark ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header with title and profile */}
      <div className="chat-header">
        <div className="header-left">
          <h1>{isRTL ? 'IntelliCare AI' : 'IntelliCare AI'}</h1>
          <span className="chat-subtitle">
            {isRTL ? 'העוזר הרפואי החכם שלך' : 'Your Intelligent Medical Assistant'}
          </span>
        </div>
        <div className="header-right" ref={profileMenuRef}>
          <button 
            className="profile-button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label={isRTL ? 'תפריט פרופיל' : 'Profile Menu'}
          >
            <div className="profile-avatar">
              {userInfo ? (
                userInfo.profile?.firstName && userInfo.profile?.lastName ? 
                  `${userInfo.profile.firstName[0]}${userInfo.profile.lastName[0]}`.toUpperCase() :
                  userInfo.email ? userInfo.email[0].toUpperCase() : 'U'
              ) : 'U'}
            </div>
            <span className="profile-name">
              {userInfo ? (userInfo.fullName || userInfo.email) : 'User'}
            </span>
            <span className="dropdown-arrow">▼</span>
          </button>
          
          {showProfileMenu && (
            <div className={`profile-dropdown ${isRTL ? 'rtl' : 'ltr'}`}>
              <button 
                className="dropdown-item"
                onClick={() => {
                  setActiveSettingsTab('profile');
                  setShowSettings(true);
                  setShowProfileMenu(false);
                }}
              >
                <span className="dropdown-icon">⚙️</span>
                <span>{isRTL ? 'הגדרות' : 'Settings'}</span>
              </button>
              
              <button 
                className="dropdown-item"
                onClick={() => {
                  setActiveSettingsTab('account');
                  setShowSettings(true);
                  setShowProfileMenu(false);
                }}
              >
                <span className="dropdown-icon">👤</span>
                <span>{isRTL ? 'פרטי חשבון' : 'Account'}</span>
              </button>
              
              <div className="dropdown-divider"></div>
              
              <button 
                className="dropdown-item"
                onClick={() => {
                  setShowHelp(true);
                  setShowProfileMenu(false);
                }}
              >
                <span className="dropdown-icon">❓</span>
                <span>{isRTL ? 'עזרה' : 'Help'}</span>
              </button>
              
              <button 
                className="dropdown-item"
                onClick={() => {
                  // Open keyboard shortcuts modal or help
                  alert(isRTL ? 
                    'קיצורי מקלדת:\n• Enter - שליחת הודעה\n• Shift+Enter - שורה חדשה\n• Ctrl+/ - ניקוי שיחה' : 
                    'Keyboard Shortcuts:\n• Enter - Send message\n• Shift+Enter - New line\n• Ctrl+/ - Clear chat'
                  );
                  setShowProfileMenu(false);
                }}
              >
                <span className="dropdown-icon">⌨️</span>
                <span>{isRTL ? 'קיצורי מקלדת' : 'Keyboard Shortcuts'}</span>
              </button>
              
              <div className="dropdown-divider"></div>
              
              <button 
                className="dropdown-item logout-item"
                onClick={() => {
                  if (window.confirm(isRTL ? 'האם אתה בטוח שברצונך להתנתק?' : 'Are you sure you want to logout?')) {
                    secureStorage.removeItem('token');
                    secureStorage.removeItem('practiceSubdomain');
                    window.location.href = '/login';
                  }
                  setShowProfileMenu(false);
                }}
              >
                <span className="dropdown-icon">🚪</span>
                <span>{isRTL ? 'התנתק' : 'Logout'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-area">
        <div className="messages-container">
          {messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="message-wrapper agent">
              <div className="message-bubble agent loading">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="input-area">
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isRTL 
              ? 'הקלד פקודה או שאלה... (לדוגמה: "חפש מטופל", "הצג מסמכים", "עדכן פרטים")'
              : 'Type a command or question... (e.g., "search patient", "show documents", "update details")'}
            disabled={isLoading}
            rows="1"
            className="message-input"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="send-button"
          >
            {isLoading ? (
              <div className="loading-spinner" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <div className="input-hint">
          {isRTL 
            ? 'טיפ: אתה יכול לבקש כל פעולה במערכת בשפה טבעית'
            : 'Tip: You can request any system operation in natural language'}
        </div>
      </div>

      {/* User Settings Modal */}
      {showSettings && (
        <UserSettings
          isOpen={showSettings}
          onClose={() => {
            process.env.NODE_ENV !== 'production' && console.log('Closing settings modal');
            setShowSettings(false);
            setActiveSettingsTab('profile'); // Reset to default tab
          }}
          userInfo={userInfo}
          onUpdateUser={setUserInfo}
          language={language}
          initialTab={activeSettingsTab}
        />
      )}

      {/* Help Modal */}
      {showHelp && (
        <HelpModal
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          language={language}
        />
      )}
    </div>
  );
};

export default ChatInterfaceUnified;