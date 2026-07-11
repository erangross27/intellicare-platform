import React from 'react';

const MessageCardV2 = ({ content, language = 'he', functionCall }) => {
  const isRTL = language === 'he';
  
  // Detect card type based on function call
  const getCardType = () => {
    if (!functionCall) return 'general';
    
    const funcName = functionCall.name?.toLowerCase() || '';
    
    if (funcName.includes('patient') || funcName === 'getpatient') return 'patient';
    if (funcName.includes('history') || funcName === 'getmedicalhistory') return 'history';
    if (funcName.includes('medication') || funcName.includes('prescription')) return 'medications';
    if (funcName.includes('lab') || funcName.includes('test')) return 'lab';
    if (funcName.includes('document')) return 'documents';
    if (funcName.includes('appointment')) return 'appointments';
    
    return 'general';
  };
  
  const cardType = getCardType();
  
  // Simple parsing - look for key patterns in the response
  const parseContent = (text) => {
    if (!text) return null;
    
    // Clean markdown
    const cleanText = text.replace(/\*\*/g, '');
    
    // Check if this contains medical data
    const hasMedicalData = 
      cleanText.includes('מצאתי') || 
      cleanText.includes('פרטים') ||
      cleanText.includes('היסטוריה') ||
      cleanText.includes('תרופות') ||
      cleanText.includes('בדיקות') ||
      cleanText.includes('Found') ||
      cleanText.includes('Here') ||
      cleanText.includes('Results');
    
    if (!hasMedicalData) {
      return null;
    }
    
    const result = {
      title: '',
      personalInfo: {},
      medicalHistory: [],
      medications: [],
      hasData: false
    };
    
    // Extract title
    const titleMatch = cleanText.match(/^(.*מצאתי.*)/m);
    if (titleMatch) {
      result.title = titleMatch[1].replace('!', '');
      result.hasData = true;
    }
    
    // Extract personal information
    const personalSection = cleanText.match(/פרטים אישיים:?([\s\S]*?)(?=היסטוריה|מרשמים|בדיקת|$)/);
    if (personalSection) {
      const lines = personalSection[1].split('\n');
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value && !key.startsWith('-')) {
            // Map Hebrew keys to data fields
            const fieldMap = {
              'שם': 'name',
              'תעודת זהות': 'id',
              'תאריך לידה': 'birthDate',
              'טלפון': 'phone',
              'אימייל': 'email',
              'כתובת': 'address',
              'קופת חולים': 'healthFund',
              'מדינה': 'country',
              'סטטוס': 'status'
            };
            
            const fieldKey = fieldMap[key] || key;
            result.personalInfo[fieldKey] = value;
          }
        }
      });
    }
    
    // Extract medical history
    const historySection = cleanText.match(/היסטוריה רפואית.*?:?([\s\S]*?)(?=מרשמים|האם|💰|$)/);
    if (historySection) {
      const historyText = historySection[1];
      
      // Look for numbered items (1. xxx 2. xxx etc)
      const numberedItems = historyText.match(/\d+\.\s+[^\n]+(?:\([^)]+\))?[^\d]*(?:(?:^|\n)(?!^\d+\.)[^\n]+)*/gm);
      if (numberedItems) {
        numberedItems.forEach(item => {
          // Parse each numbered item
          const lines = item.split('\n').filter(l => l.trim());
          const firstLine = lines[0];
          
          // Extract procedure name and date
          const procedureMatch = firstLine.match(/^\d+\.\s+(.+?)\s*\(([^)]+)\)/);
          if (procedureMatch) {
            const procedure = {
              name: procedureMatch[1].trim(),
              date: procedureMatch[2].trim(),
              details: []
            };
            
            // Get details from subsequent lines
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith('-')) {
                procedure.details.push(line.substring(1).trim());
              }
            }
            
            result.medicalHistory.push(procedure);
          }
        });
      }
    }
    
    // Extract medications/prescriptions
    const medsSection = cleanText.match(/מרשמים:?([\s\S]*?)(?=בדיקת|האם|💰|$)/);
    if (medsSection) {
      const lines = medsSection[1].split('\n');
      lines.forEach(line => {
        if (line.includes('-') || line.match(/^\d+\./)) {
          const med = line.replace(/^[-\d.]\s*/, '').trim();
          if (med) {
            result.medications.push(med);
          }
        }
      });
    }
    
    return result.hasData ? result : null;
  };
  
  const data = parseContent(content);
  
  if (!data) return null;
  
  // Get card theme based on type
  const getCardTheme = () => {
    switch(cardType) {
      case 'patient':
        return {
          gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          icon: '👤',
          borderColor: 'rgba(102, 126, 234, 0.3)'
        };
      case 'history':
        return {
          gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          icon: '📋',
          borderColor: 'rgba(240, 147, 251, 0.3)'
        };
      case 'medications':
        return {
          gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          icon: '💊',
          borderColor: 'rgba(79, 172, 254, 0.3)'
        };
      case 'lab':
        return {
          gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
          icon: '🧪',
          borderColor: 'rgba(67, 233, 123, 0.3)'
        };
      case 'documents':
        return {
          gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          icon: '📁',
          borderColor: 'rgba(250, 112, 154, 0.3)'
        };
      default:
        return {
          gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          icon: '📊',
          borderColor: 'rgba(102, 126, 234, 0.3)'
        };
    }
  };
  
  const theme = getCardTheme();
  
  return (
    <div style={{
      ...styles.container,
      direction: isRTL ? 'rtl' : 'ltr',
      borderColor: theme.borderColor
    }}>
      {/* Header */}
      {data.title && (
        <div style={{...styles.header, background: theme.gradient}}>
          <div style={styles.headerGradient}>
            <span style={styles.headerIcon}>{theme.icon}</span>
            <span style={styles.headerTitle}>{data.title}</span>
          </div>
        </div>
      )}
      
      {/* Personal Information Card */}
      {Object.keys(data.personalInfo).length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionIcon}>👤</span>
            <span style={styles.sectionTitle}>פרטים אישיים</span>
          </div>
          <div style={styles.infoGrid}>
            {Object.entries(data.personalInfo).map(([key, value]) => (
              <div key={key} style={styles.infoItem}>
                <span style={styles.infoLabel}>{getHebrewLabel(key)}</span>
                <span style={styles.infoValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Medical History Timeline */}
      {data.medicalHistory.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionIcon}>🏥</span>
            <span style={styles.sectionTitle}>היסטוריה רפואית</span>
          </div>
          <div style={styles.timeline}>
            {data.medicalHistory.map((item, index) => (
              <div key={index} style={styles.timelineItem}>
                <div style={styles.timelineDot}></div>
                <div style={styles.timelineCard}>
                  <div style={styles.procedureHeader}>
                    <span style={styles.procedureName}>{item.name}</span>
                    <span style={styles.procedureDate}>{item.date}</span>
                  </div>
                  {item.details.length > 0 && (
                    <div style={styles.procedureDetails}>
                      {item.details.map((detail, idx) => (
                        <div key={idx} style={styles.detailItem}>
                          • {detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Medications */}
      {data.medications.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionIcon}>💊</span>
            <span style={styles.sectionTitle}>מרשמים</span>
          </div>
          <div style={styles.medicationsList}>
            {data.medications.map((med, index) => (
              <div key={index} style={styles.medicationItem}>
                <span style={styles.medicationIcon}>💊</span>
                <span>{med}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function for Hebrew labels
const getHebrewLabel = (key) => {
  const labels = {
    name: 'שם',
    id: 'ת.ז.',
    birthDate: 'תאריך לידה',
    phone: 'טלפון',
    email: 'אימייל',
    address: 'כתובת',
    healthFund: 'קופת חולים',
    country: 'מדינה',
    status: 'סטטוס'
  };
  return labels[key] || key;
};

// Professional dark mode styles
const styles = {
  container: {
    background: 'linear-gradient(145deg, #1a1a2e 0%, #0f0f1e 100%)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    margin: '20px 0',
    overflow: 'hidden'
  },
  
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px'
  },
  
  headerGradient: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  
  headerIcon: {
    fontSize: '28px',
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
  },
  
  headerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'white',
    letterSpacing: '0.3px'
  },
  
  section: {
    padding: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px'
  },
  
  sectionIcon: {
    fontSize: '22px',
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
  },
  
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)'
  },
  
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px'
  },
  
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  infoLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500'
  },
  
  infoValue: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500'
  },
  
  timeline: {
    position: 'relative',
    paddingLeft: '30px'
  },
  
  timelineItem: {
    position: 'relative',
    marginBottom: '20px'
  },
  
  timelineDot: {
    position: 'absolute',
    left: '-25px',
    top: '8px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#667eea',
    border: '2px solid rgba(102, 126, 234, 0.3)',
    boxShadow: '0 0 10px rgba(102, 126, 234, 0.5)'
  },
  
  timelineCard: {
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderLeft: '3px solid #667eea'
  },
  
  procedureHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  
  procedureName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#6bb6ff'
  },
  
  procedureDate: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '3px 10px',
    borderRadius: '12px'
  },
  
  procedureDetails: {
    paddingTop: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  detailItem: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
    padding: '4px 0',
    lineHeight: '1.5'
  },
  
  medicationsList: {
    display: 'grid',
    gap: '12px'
  },
  
  medicationItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.85)'
  },
  
  medicationIcon: {
    fontSize: '18px'
  }
};

export default MessageCardV2;