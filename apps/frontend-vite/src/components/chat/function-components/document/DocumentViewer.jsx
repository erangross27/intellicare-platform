import React from 'react';

const DocumentViewer = ({ data, config, language = 'he', onAction }) => {
  const isRTL = language === 'he';
  
  return (
    <div style={{ 
      padding: '16px',
      direction: isRTL ? 'rtl' : 'ltr',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '8px',
      color: '#e3e3e8'
    }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>DocumentViewer</h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
        Component coming soon...
      </p>
    </div>
  );
};

export default DocumentViewer;