import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import SessionManager from './components/SessionManager';
import secureApi from '../../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const ChatContainer = ({ 
  apiUrl = '/api',
  practice = 'testpractice',
  authToken,
  language = 'he'
}) => {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  
  // Generate new session ID
  const generateSessionId = useCallback(() => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);
  
  // Initialize or restore session
  useEffect(() => {
    const storedSessionId = secureStorage.getItem('current_session_id');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      loadMessages(storedSessionId);
    } else {
      const newId = generateSessionId();
      setSessionId(newId);
      secureStorage.setItem('current_session_id', newId);
    }
  }, []);
  
  // Load messages for a session
  const loadMessages = async (sessionId) => {
    try {
      const storedMessages = secureStorage.getItem('messages_${sessionId}');
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        setMessages(parsed);
        
        // Set title from first message if available
        if (parsed.length > 0) {
          const firstUserMsg = parsed.find(m => m.type === 'user');
          if (firstUserMsg) {
            setSessionTitle(firstUserMsg.content.substring(0, 50));
          }
        }
      }
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to load messages:', err);
    }
  };
  
  // Save messages to localStorage
  const saveMessages = useCallback((messages, sessionId) => {
    try {
      secureStorage.setItem('messages_${sessionId}', JSON.stringify(messages));
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to save messages:', err);
    }
  }, []);
  
  // Get last agent message for password detection
  const lastAgentMessage = useMemo(() => {
    const agentMessages = messages.filter(m => m.type === 'agent');
    return agentMessages.length > 0 ? 
      agentMessages[agentMessages.length - 1].content : null;
  }, [messages]);
  
  // Send message to backend
  const sendMessage = async (actualMessage, displayMessage, isPassword) => {
    if (!actualMessage.trim() || isLoading) return;
    
    // Add user message to display
    const userMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: isPassword ? '••••••••' : actualMessage,
      originalContent: isPassword ? actualMessage : undefined,
      timestamp: new Date().toISOString(),
      isMasked: isPassword
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    saveMessages(newMessages, sessionId);
    
    // Update session title from first message
    if (messages.length === 0 && !isPassword) {
      setSessionTitle(actualMessage.substring(0, 50));
    }
    
    setIsLoading(true);
    
    try {
      const data = await secureApi.post('/api/agent/chat', {
        message: actualMessage,
        sessionId: sessionId,
        language: language,
        practice: practice
      });
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Add agent response
      const agentMessage = {
        id: `msg_${Date.now()}_agent`,
        type: 'agent',
        content: data.response || data.message || 'No response',
        timestamp: new Date().toISOString()
      };
      
      const updatedMessages = [...newMessages, agentMessage];
      setMessages(updatedMessages);
      saveMessages(updatedMessages, sessionId);
      
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to send message:', error);
      
      // Add error message
      const errorMessage = {
        id: `msg_${Date.now()}_error`,
        type: 'agent',
        content: language === 'he' ? 
          'מצטער, אירעה שגיאה. נסה שוב.' : 
          'Sorry, an error occurred. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      saveMessages(updatedMessages, sessionId);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle session change
  const handleSessionChange = (newSessionId) => {
    setSessionId(newSessionId);
    secureStorage.setItem('current_session_id', newSessionId);
    loadMessages(newSessionId);
  };
  
  // Handle new session
  const handleNewSession = () => {
    const newId = generateSessionId();
    setSessionId(newId);
    secureStorage.setItem('current_session_id', newId);
    setMessages([]);
    setSessionTitle('');
  };
  
  // Container styles
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f9fafb',
    position: 'relative'
  };
  
  const headerWrapperStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb'
  };
  
  const mainContentStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };
  
  return (
    <div style={containerStyle}>
      <div style={headerWrapperStyle}>
        <ChatHeader 
          sessionTitle={sessionTitle}
          onNewChat={handleNewSession}
          language={language}
        />
        <SessionManager
          currentSessionId={sessionId}
          onSessionChange={handleSessionChange}
          onNewSession={handleNewSession}
          language={language}
        />
      </div>
      
      <div style={mainContentStyle}>
        <MessageList 
          messages={messages}
          language={language}
        />
        
        <MessageInput
          onSendMessage={sendMessage}
          isLoading={isLoading}
          language={language}
          lastAgentMessage={lastAgentMessage}
        />
      </div>
    </div>
  );
};

export default ChatContainer;