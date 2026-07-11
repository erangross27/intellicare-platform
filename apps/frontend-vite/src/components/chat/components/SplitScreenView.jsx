import React, { useState, useRef, useEffect } from 'react';
import FunctionComponentLoader from '../function-components/FunctionComponentLoader';
import { getComponentConfig } from '../../../config/functionComponentMap';

const SplitScreenView = ({
  isActive,
  functionCall,
  functionResult,
  language = 'he',
  onClose,
  onAction
}) => {
  const [splitPosition, setSplitPosition] = useState(45); // Start at 45% for better chat visibility
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const isRTL = language === 'he';
  
  // Handle splitter drag
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      let newPosition;
      
      if (isRTL) {
        // For RTL, measure from right
        newPosition = ((containerRect.right - e.clientX) / containerWidth) * 100;
      } else {
        // For LTR, measure from left
        newPosition = ((e.clientX - containerRect.left) / containerWidth) * 100;
      }
      
      // Limit the split position between 30% and 70%
      newPosition = Math.min(Math.max(newPosition, 30), 70);
      setSplitPosition(newPosition);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isRTL]);
  
  if (!isActive || !functionCall || !functionResult) return null;
  
  const config = getComponentConfig(functionCall.name);
  
  const labels = {
    he: {
      close: 'סגור',
      results: 'תוצאות',
      dataView: 'תצוגת נתונים'
    },
    en: {
      close: 'Close',
      results: 'Results',
      dataView: 'Data View'
    }
  };
  
  const t = labels[language] || labels.en;
  
  return (
    <div 
      ref={containerRef}
      style={{
        ...styles.container,
        direction: isRTL ? 'rtl' : 'ltr'
      }}
    >
      {/* Results Panel */}
      <div 
        style={{
          ...styles.resultsPanel,
          width: `${splitPosition}%`,
          [isRTL ? 'left' : 'right']: 0
        }}
      >
        {/* Panel Header */}
        <div style={styles.panelHeader}>
          <div style={styles.headerContent}>
            {config && (
              <>
                <span style={styles.icon}>{config.icon}</span>
                <h3 style={styles.title}>
                  {config.title[language] || config.title.en}
                </h3>
              </>
            )}
          </div>
          <button
            style={styles.closeButton}
            onClick={onClose}
            aria-label={t.close}
          >
            ✕
          </button>
        </div>
        
        {/* Panel Content */}
        <div style={styles.panelContent}>
          <div style={styles.cardView}>
            <FunctionComponentLoader
              functionName={functionCall.name}
              functionResult={functionResult}
              language={language}
              onAction={onAction}
            />
          </div>
        </div>
      </div>
      
      {/* Splitter Handle */}
      <div
        style={{
          ...styles.splitter,
          [isRTL ? 'left' : 'right']: `${splitPosition}%`,
          cursor: isDragging ? 'col-resize' : 'ew-resize'
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={styles.splitterHandle}>
          <span style={styles.splitterDots}>⋮</span>
        </div>
      </div>
      
      {/* Placeholder for chat area - actual chat will be resized */}
      <div 
        style={{
          ...styles.chatSpace,
          width: `${100 - splitPosition}%`,
          [isRTL ? 'right' : 'left']: 0
        }}
      />
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'row',
    zIndex: 100
  },
  
  resultsPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#2b2c37',
    boxShadow: '4px 0 12px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'auto',
    overflow: 'hidden',
    borderRight: '1px solid rgba(255, 255, 255, 0.15)'
  },
  
  panelHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  
  icon: {
    fontSize: '20px'
  },
  
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#e3e3e8'
  },
  
  closeButton: {
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#e3e3e8',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  
  panelContent: {
    flex: 1,
    overflow: 'auto',
    padding: '20px'
  },
  
  cardView: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '20px',
    minHeight: '100%'
  },
  
  splitter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '6px',
    backgroundColor: 'transparent',
    transform: 'translateX(-50%)',
    zIndex: 20,
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  splitterHandle: {
    width: '6px',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)'
    }
  },
  
  splitterDots: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    userSelect: 'none'
  },
  
  chatSpace: {
    position: 'absolute',
    top: 0,
    bottom: 0
  }
};

export default SplitScreenView;