import React, { useState, useEffect } from 'react';
import FunctionComponentLoader from '../function-components/FunctionComponentLoader';
import { getComponentConfig } from '../../../config/functionComponentMap';

const FunctionResultsSidebar = ({ 
  isOpen, 
  onClose, 
  functionCall, 
  functionResult, 
  language = 'he' 
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const isRTL = language === 'he';
  
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);
  
  if (!isOpen && !isAnimating) return null;
  
  const config = functionCall ? getComponentConfig(functionCall.name) : null;
  
  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };
  
  const labels = {
    he: {
      close: 'סגור',
      results: 'תוצאות',
      loading: 'טוען...',
      noData: 'אין נתונים להצגה'
    },
    en: {
      close: 'Close',
      results: 'Results',
      loading: 'Loading...',
      noData: 'No data to display'
    }
  };
  
  const t = labels[language] || labels.en;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          ...styles.backdrop,
          opacity: isAnimating && isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
        onClick={handleClose}
      />
      
      {/* Sidebar */}
      <div 
        style={{
          ...styles.sidebar,
          ...(isRTL ? styles.sidebarRTL : styles.sidebarLTR),
          transform: `translateX(${
            isAnimating && isOpen 
              ? '0' 
              : (isRTL ? '-100%' : '100%')
          })`,
          direction: isRTL ? 'rtl' : 'ltr'
        }}
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            {config && (
              <>
                <span style={styles.icon}>{config.icon}</span>
                <h2 style={styles.title}>
                  {config.title[language] || config.title.en}
                </h2>
              </>
            )}
          </div>
          <button 
            style={styles.closeButton}
            onClick={handleClose}
            aria-label={t.close}
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div style={styles.content}>
          {functionCall && functionResult ? (
            <FunctionComponentLoader
              functionName={functionCall.name}
              functionResult={functionResult}
              language={language}
              onAction={(action) => {
                process.env.NODE_ENV !== 'production' && console.log('Sidebar action:', action);
                // Handle actions from the component
              }}
            />
          ) : (
            <div style={styles.noData}>
              {t.noData}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
    transition: 'opacity 0.3s ease'
  },
  
  sidebar: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    width: '480px',
    maxWidth: '90vw',
    backgroundColor: '#2b2c37',
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.3s ease',
    overflowY: 'auto'
  },
  
  sidebarRTL: {
    left: 0,
    borderRight: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  sidebarLTR: {
    right: 0,
    borderLeft: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  header: {
    padding: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    position: 'sticky',
    top: 0,
    zIndex: 1
  },
  
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  
  icon: {
    fontSize: '24px'
  },
  
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#e3e3e8'
  },
  
  closeButton: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#e3e3e8',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    flexShrink: 0
  },
  
  content: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto'
  },
  
  noData: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '14px'
  }
};

export default FunctionResultsSidebar;