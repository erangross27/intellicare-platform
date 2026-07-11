import React from 'react';

const GenericDocumentViewer = ({ document, language }) => {
  const isRTL = language === 'he';
  
  const styles = {
    container: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      direction: isRTL ? 'rtl' : 'ltr',
      color: '#e8eaf0',
      overflowY: 'auto',
      background: 'transparent',
      fontFamily: "'Inter', 'SF Pro Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
    },
    placeholder: {
      textAlign: 'center',
      padding: '48px',
      color: '#8b949e'
    }
  };
  
  return (
    <div style={styles.container}>
      <div style={styles.placeholder}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
        <div>{isRTL ? 'מסמך כללי' : 'Generic Document'}</div>
        <div style={{ fontSize: '13px', marginTop: '8px', color: '#667eea' }}>
          {document?.fileName || 'Document'}
        </div>
      </div>
    </div>
  );
};

export default GenericDocumentViewer;