import React, { memo, useRef, useEffect } from 'react';

const MessageBubble = memo(({ message, isRTL }) => {
  const isUser = message.type === 'user';
  const isWelcome = message.content.includes('Welcome to IntelliCare') || message.content.includes('שלום וברוכים הבאים ל-IntelliCare');
  
  const messageWrapperStyle = {
    display: 'flex',
    marginBottom: '16px',
    justifyContent: isWelcome ? 'flex-start' : (isRTL ? 'flex-start' : 'flex-start'), // Welcome right, Hebrew right, English left
    direction: isRTL ? 'rtl' : 'ltr',
    width: '100%'
  };
  
  const messageBubbleStyle = {
    maxWidth: isWelcome ? '80%' : '85%', // Wider for user messages, special width for welcome
    minWidth: 'fit-content',
    padding: '16px 20px',
    borderRadius: '18px',
    backgroundColor: isUser ? '#4a9eff' : '#2a3050',
    color: '#ffffff',
    fontSize: isWelcome ? '16px' : '15px',
    fontFamily: "'Inter', 'SF Pro Text', 'Segoe UI', system-ui, -apple-system, sans-serif",
    fontWeight: isWelcome ? '500' : '400',
    lineHeight: '1.5',
    wordWrap: 'break-word',
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left',
    position: 'relative'
    // Removed margin properties - let flex handle positioning
  };
  
  const messageTimeStyle = {
    fontSize: '11px',
    color: '#a8b2d1',
    marginTop: '4px',
    opacity: 0.7,
    textAlign: isRTL ? 'right' : 'left'
  };
  
  return (
    <div style={messageWrapperStyle}>
      <div style={messageBubbleStyle}>
        <div>
          {message.content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < message.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
        <div style={messageTimeStyle}>
          {new Date(message.timestamp).toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.message.id === nextProps.message.id;
});

MessageBubble.displayName = 'MessageBubble';

const MessagesList = memo(({ messages, isLoading, isRTL }) => {
  const messagesEndRef = useRef(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);
  
  const containerStyle = {
    height: '100%',
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    gap: '0px'
  };
  
  const loadingWrapperStyle = {
    display: 'flex',
    marginBottom: '16px',
    justifyContent: isRTL ? 'flex-start' : 'flex-start', // Hebrew right, English left
    direction: isRTL ? 'rtl' : 'ltr'
  };
  
  const loadingBubbleStyle = {
    padding: '12px 16px',
    borderRadius: '18px',
    backgroundColor: '#2a3050',
    color: '#ffffff'
  };
  
  const typingIndicatorStyle = {
    display: 'flex',
    gap: '4px',
    alignItems: 'center'
  };
  
  const dotStyle = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#a8b2d1',
    animation: 'pulse 1.4s infinite ease-in-out'
  };
  
  return (
    <div style={containerStyle}>
      {messages.map(message => (
        <MessageBubble key={message.id} message={message} isRTL={isRTL} />
      ))}
      {isLoading && (
        <div style={loadingWrapperStyle}>
          <div style={loadingBubbleStyle}>
            <div style={typingIndicatorStyle}>
              <span style={dotStyle}></span>
              <span style={{...dotStyle, animationDelay: '0.2s'}}></span>
              <span style={{...dotStyle, animationDelay: '0.4s'}}></span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if messages actually changed
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.messages[prevProps.messages.length - 1]?.id === 
    nextProps.messages[nextProps.messages.length - 1]?.id
  );
});

MessagesList.displayName = 'MessagesList';

export default MessagesList;