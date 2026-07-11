import React from 'react';

const DefaultCard = ({ data, config, language = 'he', onAction }) => {
  const isRTL = language === 'he';
  
  // Render different content based on data type
  const renderContent = () => {
    // If data is a string
    if (typeof data === 'string') {
      return <div style={styles.text}>{data}</div>;
    }
    
    // If data is an array
    if (Array.isArray(data)) {
      return (
        <ul style={styles.list}>
          {data.map((item, index) => (
            <li key={index} style={styles.listItem}>
              {typeof item === 'object' ? JSON.stringify(item, null, 2) : item}
            </li>
          ))}
        </ul>
      );
    }
    
    // If data is an object
    if (typeof data === 'object' && data !== null) {
      // Check if it has a message property
      if (data.message) {
        return <div style={styles.text}>{data.message}</div>;
      }
      
      // Check if it has a result property
      if (data.result) {
        return renderContent(data.result);
      }
      
      // Otherwise render as key-value pairs
      return (
        <div style={styles.dataContainer}>
          {Object.entries(data).map(([key, value]) => (
            <div key={key} style={styles.dataRow}>
              <span style={styles.dataKey}>{key}:</span>
              <span style={styles.dataValue}>
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    
    // Default: render as text
    return <div style={styles.text}>{String(data)}</div>;
  };
  
  return (
    <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
      <div style={styles.content}>
        {renderContent()}
      </div>
      
      {/* Action buttons if provided */}
      {config?.actions && config.actions.length > 0 && (
        <div style={styles.actions}>
          {config.actions.map(action => (
            <button
              key={action}
              style={styles.actionButton}
              onClick={() => onAction(action, data)}
            >
              {getActionLabel(action, language)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Get localized action labels
const getActionLabel = (action, language) => {
  const labels = {
    he: {
      view: 'צפייה',
      edit: 'עריכה',
      delete: 'מחיקה',
      export: 'ייצוא',
      print: 'הדפסה',
      save: 'שמירה',
      cancel: 'ביטול',
      refresh: 'רענון',
      download: 'הורדה'
    },
    en: {
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      export: 'Export',
      print: 'Print',
      save: 'Save',
      cancel: 'Cancel',
      refresh: 'Refresh',
      download: 'Download'
    }
  };
  
  const t = labels[language] || labels.en;
  return t[action] || action;
};

const styles = {
  container: {
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    color: '#e3e3e8'
  },
  
  content: {
    marginBottom: '12px'
  },
  
  text: {
    fontSize: '14px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap'
  },
  
  list: {
    margin: 0,
    paddingLeft: '20px'
  },
  
  listItem: {
    fontSize: '14px',
    marginBottom: '8px',
    color: '#e3e3e8'
  },
  
  dataContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  
  dataRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start'
  },
  
  dataKey: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)',
    minWidth: '100px',
    flexShrink: 0
  },
  
  dataValue: {
    fontSize: '14px',
    color: '#e3e3e8',
    flex: 1,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  actionButton: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: '#e3e3e8',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

export default DefaultCard;