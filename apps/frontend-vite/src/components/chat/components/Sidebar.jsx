import React from 'react';
import SessionManager from './SessionManager';
import theme from '../styles/theme';

const Sidebar = ({
  currentSessionId,
  onSessionChange,
  onNewSession,
  language,
  refreshTrigger
}) => {
  const isRTL = language === 'he';
  
  // Sidebar styles - glassmorphism design
  const sidebarStyle = {
    width: '100%',
    background: 'transparent',
    borderRight: !isRTL ? 'none' : 'none',
    borderLeft: isRTL ? 'none' : 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    color: '#fff',
    position: 'relative',
    height: '100%'
  };
  
  // Remove header since it's now in CollapsibleSidebar
  const sidebarHeaderStyle = {
    display: 'none'
  };
  
  // Sidebar content styles
  const sidebarContentStyle = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '0',
    scrollbarWidth: 'thin',
    scrollbarColor: '#28395C transparent'
  };

  const footerStyle = {
    padding: '12px',
    borderTop: '1px solid #28395C',
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };

  const newChatButtonStyle = {
    width: '100%',
    padding: '10px 12px',
    background: '#0E1626',
    color: '#E9EFFA',
    border: '1px solid #28395C',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    direction: isRTL ? 'rtl' : 'ltr',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    letterSpacing: '0.01em'
  };

  const titleStyle = {
    margin: 0,
    color: '#E9EFFA',
    fontSize: '16px',
    fontWeight: '600',
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: 'left',
    width: '100%',
    letterSpacing: '-0.01em'
  };

  const tipStyle = {
    fontSize: '11px',
    color: '#93A2BE',
    textAlign: 'center',
    padding: '8px',
    direction: isRTL ? 'rtl' : 'ltr'
  };
  
  
  const iconStyle = {
    width: '16px',
    height: '16px',
    opacity: 0.8
  };
  
  return (
    <div style={sidebarStyle}>
      {/* New Chat button removed - it's now in CollapsibleSidebar header */}

      <div style={sidebarContentStyle}>
        <SessionManager
          currentSessionId={currentSessionId}
          onSessionChange={onSessionChange}
          onNewSession={onNewSession}
          language={language}
          refreshTrigger={refreshTrigger}
        />
      </div>

    </div>
  );
};

export default Sidebar;