import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../config/languagesStatic';
import './ChatInterfaceDark.css';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const ChatInterfaceDark = () => {
  const { language, t, isRTL } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
  }, []);

  const initializeSession = async () => {
    try {
      const result = await secureApi.post('/chat/sessions', {
        title: isRTL ? 'שיחה חדשה' : 'New Chat',
        language: language
      });

      if (!result.error) {
        setSessionId(result.data.sessionId);
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
    setInputMessage('');
    setIsLoading(true);

    try {
      const result = await secureApi.post('/api/agent/chat', {
        message: inputMessage,
        sessionId: sessionId,
        language: language
      });

      if (!result.error) {
        process.env.NODE_ENV !== 'production' && console.log('🎯 Chat response received:', result);
        
        // Check if we have action results - these should trigger split screen
        const actionResult = result.actionResult || result.data?.actionResult;
        const actionTaken = result.actionTaken || result.data?.actionTaken;
        
        // Smart detection: Only show chat bubble for questions/input requests
        const isQuestionOrInput = !actionResult && (
          result.needsMoreInfo || 
          result.message?.includes('?') ||
          result.message?.includes('מה ') ||
          result.message?.includes('איזה ') ||
          result.message?.includes('האם ') ||
          result.message?.includes('תאריך') ||
          result.message?.includes('כתובת') ||
          result.message?.includes('טלפון')
        );
        
        // Only add chat message if it's a question or no action result
        if (isQuestionOrInput) {
          const agentMessage = {
            id: Date.now() + 1,
            type: 'agent',
            content: result.message || result.data?.message || 'No response',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, agentMessage]);
        }
        
        // If we have action results, trigger split screen instead
        if (actionResult) {
          process.env.NODE_ENV !== 'production' && console.log('🎯 Triggering split screen for:', actionTaken, actionResult);
          handleActionResult(actionResult, actionTaken);
          
          // Add a simple confirmation message instead of duplicating data
          if (actionTaken === 'searchPatients' || actionTaken === 'getPatient') {
            const confirmMessage = {
              id: Date.now() + 1,
              type: 'agent',
              content: isRTL ? '✓ המידע מוצג בחלון הצדדי' : '✓ Information displayed in side panel',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, confirmMessage]);
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
    }
  };

  const handleActionResult = (actionResult, actionType) => {
    process.env.NODE_ENV !== 'production' && console.log('🎯 handleActionResult called:', actionType, actionResult);
    
    // Handle different action types
    switch (actionType) {
      case 'searchPatients':
      case 'getPatient':
      case 'viewPatient':
        // If actionResult is an array, it's the patients directly
        if (Array.isArray(actionResult) && actionResult.length > 0 && window.handlePatientData) {
          process.env.NODE_ENV !== 'production' && console.log('🎯 Opening split screen with patient data');
          window.handlePatientData(actionResult[0]);
        }
        // Check if we have a single patient or array of patients in object
        else if (actionResult?.patient && window.handlePatientData) {
          process.env.NODE_ENV !== 'production' && console.log('🎯 Opening split screen with patient data');
          window.handlePatientData(actionResult.patient);
        } else if (actionResult?.patients && actionResult.patients.length > 0 && window.handlePatientData) {
          process.env.NODE_ENV !== 'production' && console.log('🎯 Opening split screen with first patient');
          window.handlePatientData(actionResult.patients[0]);
        } else {
          process.env.NODE_ENV !== 'production' && console.log('❌ No patient data found or handler missing');
          process.env.NODE_ENV !== 'production' && console.log('window.handlePatientData exists?', !!window.handlePatientData);
          process.env.NODE_ENV !== 'production' && console.log('actionResult structure:', actionResult);
        }
        break;
      
      case 'getDocuments':
        if (actionResult.documents && actionResult.documents.length > 0 && window.handleDocumentSelect) {
          // Show first document by default
          window.handleDocumentSelect(actionResult.documents[0]._id);
        }
        break;
      
      case 'getLabResults':
        if (actionResult.patient && window.handleLabResults) {
          window.handleLabResults(actionResult.patient);
        }
        break;
      
      case 'getMedications':
        if (actionResult.patient && window.handleMedications) {
          window.handleMedications(actionResult.patient);
        }
        break;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-grow textarea as user types
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);

    // Auto-grow textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
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
      {/* Messages Area */}
      <div className="messages-area">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <h2>{isRTL ? 'שלום! איך אוכל לעזור לך היום?' : 'Hello! How can I help you today?'}</h2>
              <p>{isRTL ? 'אני כאן כדי לסייע עם מידע רפואי, חיפוש מטופלים ועוד' : 'I\'m here to help with medical information, patient search and more'}</p>
            </div>
          ) : (
            messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="input-area">
        <div className="input-container">
          <button
            className="attachment-button"
            onClick={() => process.env.NODE_ENV !== 'production' && console.log('Attachment clicked')}
            title={isRTL ? 'צרף קובץ' : 'Attach file'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={isRTL ? 'הקלד הודעה...' : 'Type a message...'}
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
      </div>
    </div>
  );
};

export default ChatInterfaceDark;