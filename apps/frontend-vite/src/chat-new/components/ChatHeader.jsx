import React from 'react';

const ChatHeader = ({ sessionTitle, onNewChat, language }) => {
  const isRTL = language === 'he';
  
  // Header container style
  const headerStyle = {
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    direction: isRTL ? 'rtl' : 'ltr'
  };
  
  // Title style
  const titleStyle = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0
  };
  
  // Button style
  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };
  
  const handleMouseEnter = (e) => {
    e.target.style.backgroundColor = '#e5e7eb';
  };
  
  const handleMouseLeave = (e) => {
    e.target.style.backgroundColor = '#f3f4f6';
  };
  
  return (
    <div style={headerStyle}>
      <h1 style={titleStyle}>
        {sessionTitle || (isRTL ? 'שיחה חדשה' : 'New Chat')}
      </h1>
      
      <button 
        onClick={onNewChat}
        style={buttonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span>➕</span>
        <span>{isRTL ? 'שיחה חדשה' : 'New Chat'}</span>
      </button>
    </div>
  );
};

export default ChatHeader;