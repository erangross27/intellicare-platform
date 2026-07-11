import React, { useState, useRef, useEffect } from 'react';

const MessageInput = ({ onSendMessage, isLoading, language, lastAgentMessage }) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);
  const isRTL = language === 'he';
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    
    // Send message
    onSendMessage(message, message, false);
    
    setMessage('');
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  // Container styles
  const containerStyle = {
    padding: '16px',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };
  
  const formStyle = {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  };
  
  const inputStyle = {
    flex: 1,
    padding: '12px 16px',
    fontSize: '15px',
    border: '1px solid #e5e7eb',
    borderRadius: '24px',
    outline: 'none',
    direction: isRTL ? 'rtl' : 'ltr',
    backgroundColor: '#f9fafb',
    transition: 'all 0.2s'
  };
  
  const buttonStyle = {
    padding: '12px 24px',
    backgroundColor: isLoading ? '#9ca3af' : '#667eea',
    color: '#ffffff',
    border: 'none',
    borderRadius: '24px',
    fontSize: '15px',
    fontWeight: '500',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: isLoading ? 0.5 : 1
  };
  
  const indicatorStyle = {
    padding: '8px 12px',
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#92400e',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };
  
  return (
    <div style={containerStyle}>
      
      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isRTL ? 'הקלד הודעה...' : 'Type a message...'}
          style={inputStyle}
          disabled={isLoading}
          autoFocus
        />
        
        <button 
          type="submit" 
          style={buttonStyle}
          disabled={isLoading || !message.trim()}
        >
          {isRTL ? 'שלח' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;