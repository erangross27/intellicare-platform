import React, { useEffect, useRef } from 'react';
import Message from './Message';

const MessageList = ({ messages, language }) => {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const isRTL = language === 'he';
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Use messages directly
  const displayMessages = messages;
  
  // Container style
  const containerStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 0',
    backgroundColor: '#ffffff',
    minHeight: '400px',
    maxHeight: 'calc(100vh - 200px)',
    direction: isRTL ? 'rtl' : 'ltr'
  };
  
  // Empty state style
  const emptyStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '300px',
    color: '#9ca3af',
    fontSize: '16px',
    textAlign: 'center',
    padding: '32px'
  };
  
  // Welcome message style
  const welcomeStyle = {
    fontSize: '24px',
    marginBottom: '8px'
  };
  
  if (displayMessages.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          <div style={welcomeStyle}>👋</div>
          <div>{isRTL ? 'שלום! איך אוכל לעזור?' : 'Hello! How can I help?'}</div>
        </div>
      </div>
    );
  }
  
  return (
    <div ref={containerRef} style={containerStyle}>
      {displayMessages.map((message, index) => (
        <Message 
          key={message.id || index} 
          message={message} 
          isRTL={isRTL}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;