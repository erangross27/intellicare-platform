import React from 'react';

const Message = ({ message, isRTL }) => {
  const isUser = message.type === 'user';
  const isMasked = message.isMasked || message.content === '••••••••';
  
  // Message wrapper
  const wrapperStyle = {
    display: 'flex',
    justifyContent: isUser ? 'flex-end' : 'flex-start',
    padding: '8px 16px',
    width: '100%'
  };
  
  // Bubble style
  const bubbleStyle = {
    maxWidth: '70%',
    padding: '12px 16px',
    borderRadius: isUser 
      ? (isRTL ? '18px 18px 4px 18px' : '18px 18px 18px 4px')
      : (isRTL ? '18px 18px 18px 4px' : '18px 18px 4px 18px'),
    backgroundColor: isUser ? '#667eea' : '#f3f4f6',
    color: isUser ? '#ffffff' : '#1f2937',
    fontSize: '15px',
    lineHeight: '1.5',
    direction: isRTL ? 'rtl' : 'ltr',
    wordBreak: 'break-word',
    ...(isMasked && {
      fontFamily: 'monospace',
      letterSpacing: '3px',
      fontSize: '16px'
    })
  };
  
  // Timestamp style
  const timestampStyle = {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '4px',
    direction: isRTL ? 'rtl' : 'ltr'
  };
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Format content with line breaks
  const formatContent = (content) => {
    if (!content) return '';
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };
  
  return (
    <div style={wrapperStyle}>
      <div>
        <div style={bubbleStyle}>
          {isMasked ? (
            <span style={{ opacity: 0.8 }}>{message.content}</span>
          ) : (
            formatContent(message.content)
          )}
        </div>
        {message.timestamp && (
          <div style={timestampStyle}>
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;