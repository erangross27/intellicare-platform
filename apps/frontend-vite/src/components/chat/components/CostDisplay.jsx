import React, { useState } from 'react';

const CostDisplay = ({ costInfo, language }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!costInfo) return null;
  
  const isRTL = language === 'he';
  
  // PRIORITY 1: Use the new daily/monthly format from backend if available
  if (costInfo.costDisplay) {
    // Parse the cost display to extract values
    const lines = costInfo.costDisplay.split('\n').filter(line => line.trim());
    const todayMatch = lines.find(l => l.includes('Today:'));
    const monthMatch = lines.find(l => l.includes('This month:'));
    const messageMatch = lines.find(l => l.includes('This message:'));
    
    let todayData = null;
    let monthData = null;
    let messageData = null;
    
    if (todayMatch) {
      const match = todayMatch.match(/([\$₪€£¥]?[\d,]+\.\d+)\s*\((\d+)\s*messages?\)/i);
      if (match) todayData = { cost: match[1], messages: match[2] };
    }
    
    if (monthMatch) {
      const match = monthMatch.match(/([\$₪€£¥]?[\d,]+\.\d+)\s*\((\d+)\s*messages?\)/i);
      if (match) monthData = { cost: match[1], messages: match[2] };
    }
    
    if (messageMatch) {
      const match = messageMatch.match(/([\$₪€£¥]?[\d,]+\.\d+)\s*\(([\d,]+)\s*tokens?\)/i);
      if (match) messageData = { cost: match[1], tokens: match[2] };
    }
    
    // Collapsed view - just $ button
    if (!isExpanded) {
      return (
        <div 
          onClick={() => setIsExpanded(true)}
          style={{
            position: 'absolute',
            top: '12px',
            left: isRTL ? 'auto' : '12px',
            right: isRTL ? '12px' : 'auto',
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'all 0.3s ease',
            fontSize: '18px',
            fontWeight: '600',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3))';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={isRTL ? 'לחץ לצפייה בעלויות' : 'Click to view costs'}
        >
          $
        </div>
      );
    }
    
    // Expanded view - full summary
    return (
      <div style={{
        position: 'absolute',
        top: '12px',
        left: isRTL ? 'auto' : '12px',
        right: isRTL ? '12px' : 'auto',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '12px',
        padding: '12px 16px',
        zIndex: 1000,
        direction: isRTL ? 'rtl' : 'ltr',
        minWidth: '280px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
      }}>
        {/* Header with close button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          paddingBottom: '10px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: isRTL ? '0' : '10px',
              marginLeft: isRTL ? '10px' : '0',
              fontSize: '16px'
            }}>
              📊
            </div>
            <div style={{
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>
              {isRTL ? 'סיכום שימוש' : 'Usage Summary'}
            </div>
          </div>
          {/* Close button */}
          <div
            onClick={() => setIsExpanded(false)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#a0a0b0',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#a0a0b0';
            }}
          >
            ✕
          </div>
        </div>
        
        {/* Stats Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Today */}
          {todayData && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateX(2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#a0a0b0', fontSize: '12px' }}>📅</span>
                <span style={{ color: '#d0d0e0', fontSize: '13px' }}>{isRTL ? 'היום' : 'Today'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>{todayData.cost}</span>
                <span style={{ color: '#a0a0b0', fontSize: '11px' }}>({todayData.messages} {isRTL ? 'הודעות' : 'msgs'})</span>
              </div>
            </div>
          )}
          
          {/* This Month */}
          {monthData && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateX(2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#a0a0b0', fontSize: '12px' }}>📆</span>
                <span style={{ color: '#d0d0e0', fontSize: '13px' }}>{isRTL ? 'החודש' : 'This month'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>{monthData.cost}</span>
                <span style={{ color: '#a0a0b0', fontSize: '11px' }}>({monthData.messages} {isRTL ? 'הודעות' : 'msgs'})</span>
              </div>
            </div>
          )}
          
          {/* Current Message */}
          {messageData && (
            <div style={{
              marginTop: '4px',
              padding: '8px 12px',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
              borderRadius: '8px',
              border: '1px solid rgba(102, 126, 234, 0.2)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#b0b0c0', fontSize: '12px' }}>💡</span>
                  <span style={{ color: '#e0e0f0', fontSize: '12px', fontWeight: '500' }}>{isRTL ? 'הודעה זו' : 'This message'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '600' }}>{messageData.cost}</span>
                  <span style={{ color: '#b0b0c0', fontSize: '10px' }}>({messageData.tokens} {isRTL ? 'טוקנים' : 'tokens'})</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // FALLBACK: Use old session format only if new format not available
  if (!costInfo.sessionTotals) return null;
  
  // Extract cost information from backend - backend handles all currency conversion
  const currency = costInfo.sessionTotals?.currency || costInfo.currency || 'USD';
  const currencySymbol = costInfo.sessionTotals?.currencySymbol || costInfo.currencySymbol || '$';
  
  // Get the formatted cost or cost in the user's preferred currency
  // Backend sends the correct amount already converted
  const sessionCost = costInfo.sessionTotals?.formattedCost || 
                     costInfo.sessionTotals?.totalCostInCurrency || 
                     costInfo.sessionTotals?.totalCostILS || 
                     costInfo.sessionTotals?.totalCost || 
                     '0.0000';
  const sessionTokens = costInfo.sessionTotals?.totalTokens || 0;
  
  // Get per-message cost
  const messageCost = costInfo.totalCost || costInfo.totalCostInCurrency || '0.0000';
  const messageTokens = costInfo.totalTokens || 0;
  
  // If backend sends a pre-formatted string, use it directly
  const isPreFormatted = typeof sessionCost === 'string' && sessionCost.includes(currencySymbol);
  const isMessagePreFormatted = typeof messageCost === 'string' && messageCost.includes(currencySymbol);
  
  // Collapsed view for old format
  if (!isExpanded) {
    return (
      <div 
        onClick={() => setIsExpanded(true)}
        style={{
          position: 'absolute',
          top: '12px',
          left: isRTL ? 'auto' : '12px',
          right: isRTL ? '12px' : 'auto',
          width: '36px',
          height: '36px',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          fontSize: '18px',
          fontWeight: '600',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3))';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={isRTL ? 'לחץ לצפייה בעלויות' : 'Click to view costs'}
      >
        {currencySymbol}
      </div>
    );
  }
  
  // Container styles - professional label with improved visibility
  const containerStyle = {
    position: 'absolute',
    top: '12px',
    left: isRTL ? 'auto' : '12px',
    right: isRTL ? '12px' : 'auto',
    backgroundColor: 'rgba(142, 142, 160, 0.15)',
    color: '#e5e5f2',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    zIndex: 1000,
    border: '1px solid rgba(142, 142, 160, 0.3)',
    direction: isRTL ? 'rtl' : 'ltr',
    fontWeight: '500',
    minWidth: '200px',
    cursor: 'pointer'
  };
  
  // Format the display - use pre-formatted if available, otherwise format with currency symbol
  const sessionCostDisplay = isPreFormatted 
    ? sessionCost 
    : `${currencySymbol}${parseFloat(sessionCost).toFixed(4)}`;
  
  const messageCostDisplay = isMessagePreFormatted
    ? messageCost
    : `${currencySymbol}${parseFloat(messageCost).toFixed(4)}`;
    
  const sessionText = isRTL 
    ? `שיחה: ${sessionCostDisplay} (${sessionTokens.toLocaleString()} טוקנים)`
    : `Session: ${sessionCostDisplay} (${sessionTokens.toLocaleString()} tokens)`;
  
  const messageText = isRTL
    ? `הודעה זו: ${messageCostDisplay} (${messageTokens.toLocaleString()} טוקנים)`
    : `This message: ${messageCostDisplay} (${messageTokens.toLocaleString()} tokens)`;
  
  return (
    <div style={containerStyle} onClick={() => setIsExpanded(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>💰</span>
        <span>{sessionText}</span>
      </div>
      <div style={{ 
        fontSize: '11px', 
        opacity: 0.85,
        paddingLeft: isRTL ? '0' : '22px',
        paddingRight: isRTL ? '22px' : '0'
      }}>
        {messageText}
      </div>
      <div style={{
        fontSize: '10px',
        opacity: 0.6,
        marginTop: '4px',
        textAlign: 'center'
      }}>
        {isRTL ? 'לחץ להסתרה' : 'Click to hide'}
      </div>
    </div>
  );
};

export default CostDisplay;