import React from 'react';

// Universal card that adapts to any type of medical data
const UniversalMessageCard = ({ message, language = 'he' }) => {
  const isRTL = language === 'he';
  
  // Extract function info from message
  const functionCall = message.functionCall || (message.metadata && {
    name: message.metadata.functionName,
    args: message.metadata.functionArgs
  });
  const functionResult = message.functionResult || message.metadata?.functionResult;
  const content = message.content;
  
  if (!functionCall || !content) return null;
  
  // Determine card type and theme based on function name
  const getCardConfig = (funcName) => {
    const name = funcName?.toLowerCase() || '';
    
    // Patient functions
    if (name.includes('patient') || name === 'getpatient' || name === 'searchpatients') {
      return {
        type: 'patient',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        icon: '👤',
        title: language === 'he' ? 'פרטי מטופל' : 'Patient Details'
      };
    }
    
    // Medical history
    if (name.includes('history') || name === 'getmedicalhistory' || name === 'gethistory') {
      return {
        type: 'history',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        icon: '📋',
        title: language === 'he' ? 'היסטוריה רפואית' : 'Medical History'
      };
    }
    
    // Medications
    if (name.includes('medication') || name.includes('prescription') || name === 'getmedications') {
      return {
        type: 'medications',
        gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        icon: '💊',
        title: language === 'he' ? 'תרופות ומרשמים' : 'Medications'
      };
    }
    
    // Lab results
    if (name.includes('lab') || name.includes('test') || name === 'getlabresults') {
      return {
        type: 'lab',
        gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        icon: '🧪',
        title: language === 'he' ? 'תוצאות בדיקות' : 'Lab Results'
      };
    }
    
    // Documents
    if (name.includes('document') || name === 'getdocuments') {
      return {
        type: 'documents',
        gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        icon: '📁',
        title: language === 'he' ? 'מסמכים רפואיים' : 'Medical Documents'
      };
    }
    
    // Appointments
    if (name.includes('appointment') || name === 'getappointments') {
      return {
        type: 'appointments',
        gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        icon: '📅',
        title: language === 'he' ? 'תורים' : 'Appointments'
      };
    }
    
    // Vital signs
    if (name.includes('vital') || name === 'getvitalsigns') {
      return {
        type: 'vitals',
        gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        icon: '❤️',
        title: language === 'he' ? 'סימנים חיוניים' : 'Vital Signs'
      };
    }
    
    // Allergies
    if (name.includes('allerg') || name === 'getallergies') {
      return {
        type: 'allergies',
        gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        icon: '⚠️',
        title: language === 'he' ? 'אלרגיות' : 'Allergies'
      };
    }
    
    // Vaccinations
    if (name.includes('vaccin') || name === 'getvaccinations') {
      return {
        type: 'vaccines',
        gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
        icon: '💉',
        title: language === 'he' ? 'חיסונים' : 'Vaccinations'
      };
    }
    
    // Imaging
    if (name.includes('imaging') || name.includes('xray') || name.includes('mri')) {
      return {
        type: 'imaging',
        gradient: 'linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)',
        icon: '🔬',
        title: language === 'he' ? 'דימות רפואי' : 'Medical Imaging'
      };
    }
    
    // Referrals
    if (name.includes('referral')) {
      return {
        type: 'referrals',
        gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
        icon: '🔄',
        title: language === 'he' ? 'הפניות' : 'Referrals'
      };
    }
    
    // Billing/Insurance
    if (name.includes('bill') || name.includes('insurance') || name.includes('payment')) {
      return {
        type: 'billing',
        gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        icon: '💳',
        title: language === 'he' ? 'חיובים' : 'Billing'
      };
    }
    
    // Reports
    if (name.includes('report') || name.includes('summary')) {
      return {
        type: 'reports',
        gradient: 'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
        icon: '📊',
        title: language === 'he' ? 'דוחות' : 'Reports'
      };
    }
    
    // Default
    return {
      type: 'default',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      icon: '📋',
      title: language === 'he' ? 'מידע רפואי' : 'Medical Information'
    };
  };
  
  const config = getCardConfig(functionCall.name);
  
  // Parse content to extract key-value pairs
  const parseContent = (text) => {
    if (!text) return { lines: [] };
    
    const cleanText = text.replace(/\*\*/g, '');
    const lines = cleanText.split('\n').filter(l => l.trim());
    
    const parsed = {
      title: '',
      items: [],
      sections: []
    };
    
    // Find title (usually first line)
    if (lines.length > 0 && (lines[0].includes('מצאתי') || lines[0].includes('Found') || lines[0].includes('הנה'))) {
      parsed.title = lines[0];
      lines.shift();
    }
    
    let currentSection = null;
    
    lines.forEach(line => {
      // Skip cost lines
      if (line.includes('₪') || line.includes('טוקנים')) return;
      
      // Check for section headers (lines ending with :)
      if (line.endsWith(':') && !line.includes('http')) {
        if (currentSection && currentSection.items.length > 0) {
          parsed.sections.push(currentSection);
        }
        currentSection = {
          title: line.replace(':', ''),
          items: []
        };
      }
      // Numbered items
      else if (line.match(/^\d+\./)) {
        const item = line.replace(/^\d+\./, '').trim();
        if (currentSection) {
          currentSection.items.push({ type: 'numbered', value: item });
        } else {
          parsed.items.push({ type: 'numbered', value: item });
        }
      }
      // Bullet points
      else if (line.startsWith('-') || line.startsWith('•')) {
        const item = line.replace(/^[-•]/, '').trim();
        if (currentSection) {
          currentSection.items.push({ type: 'bullet', value: item });
        } else {
          parsed.items.push({ type: 'bullet', value: item });
        }
      }
      // Key-value pairs
      else if (line.includes(':') && !line.startsWith('http')) {
        const colonIndex = line.indexOf(':');
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        if (value) {
          const item = { type: 'keyvalue', key, value };
          if (currentSection) {
            currentSection.items.push(item);
          } else {
            parsed.items.push(item);
          }
        }
      }
      // Regular text
      else if (line.trim()) {
        const item = { type: 'text', value: line };
        if (currentSection) {
          currentSection.items.push(item);
        } else {
          parsed.items.push(item);
        }
      }
    });
    
    // Add last section
    if (currentSection && currentSection.items.length > 0) {
      parsed.sections.push(currentSection);
    }
    
    return parsed;
  };
  
  const data = parseContent(content);
  
  // Don't render if no data
  if (!data.items.length && !data.sections.length && !data.title) {
    return null;
  }
  
  return (
    <div style={{
      ...styles.container,
      direction: isRTL ? 'rtl' : 'ltr'
    }}>
      {/* Dynamic Header with gradient based on function type */}
      <div style={{ ...styles.header, background: config.gradient }}>
        <div style={styles.headerContent}>
          <span style={styles.headerIcon}>{config.icon}</span>
          <div style={styles.headerText}>
            <div style={styles.headerTitle}>{config.title}</div>
            {data.title && (
              <div style={styles.headerSubtitle}>{data.title}</div>
            )}
          </div>
        </div>
      </div>
      
      {/* Body with dynamic content */}
      <div style={styles.body}>
        {/* Direct items (not in sections) */}
        {data.items.length > 0 && (
          <div style={styles.itemsContainer}>
            {data.items.map((item, idx) => (
              <div key={idx} style={styles.item}>
                {item.type === 'keyvalue' && (
                  <div style={styles.kvRow}>
                    <span style={styles.kvKey}>{item.key}:</span>
                    <span style={styles.kvValue}>{item.value}</span>
                  </div>
                )}
                {item.type === 'numbered' && (
                  <div style={styles.numberedRow}>
                    <span style={styles.numberBullet}>{idx + 1}.</span>
                    <span style={styles.numberText}>{item.value}</span>
                  </div>
                )}
                {item.type === 'bullet' && (
                  <div style={styles.bulletRow}>
                    <span style={styles.bullet}>•</span>
                    <span style={styles.bulletText}>{item.value}</span>
                  </div>
                )}
                {item.type === 'text' && (
                  <div style={styles.textRow}>{item.value}</div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Sections */}
        {data.sections.map((section, sIdx) => (
          <div key={sIdx} style={styles.section}>
            <div style={styles.sectionTitle}>{section.title}</div>
            <div style={styles.sectionContent}>
              {section.items.map((item, idx) => (
                <div key={idx} style={styles.item}>
                  {item.type === 'keyvalue' && (
                    <div style={styles.kvRow}>
                      <span style={styles.kvKey}>{item.key}:</span>
                      <span style={styles.kvValue}>{item.value}</span>
                    </div>
                  )}
                  {item.type === 'numbered' && (
                    <div style={styles.numberedRow}>
                      <span style={styles.numberBullet}>{idx + 1}.</span>
                      <span style={styles.numberText}>{item.value}</span>
                    </div>
                  )}
                  {item.type === 'bullet' && (
                    <div style={styles.bulletRow}>
                      <span style={styles.bullet}>•</span>
                      <span style={styles.bulletText}>{item.value}</span>
                    </div>
                  )}
                  {item.type === 'text' && (
                    <div style={styles.textRow}>{item.value}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer with function info */}
      <div style={styles.footer}>
        <span style={styles.footerIcon}>⚡</span>
        <span style={styles.footerText}>
          {functionCall.name} 
          {language === 'he' ? ' בוצע בהצלחה' : ' executed successfully'}
        </span>
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(145deg, #1e1e2e 0%, #151521 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    margin: '16px 0'
  },
  
  header: {
    padding: '20px',
    color: 'white'
  },
  
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  
  headerIcon: {
    fontSize: '32px',
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
  },
  
  headerText: {
    flex: 1
  },
  
  headerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '4px'
  },
  
  headerSubtitle: {
    fontSize: '14px',
    opacity: 0.9
  },
  
  body: {
    padding: '20px'
  },
  
  itemsContainer: {
    marginBottom: '20px'
  },
  
  item: {
    marginBottom: '12px'
  },
  
  section: {
    marginBottom: '24px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  sectionContent: {
    paddingTop: '8px'
  },
  
  kvRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '6px 0'
  },
  
  kvKey: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
    minWidth: '120px',
    flexShrink: 0
  },
  
  kvValue: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
    flex: 1
  },
  
  numberedRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '6px 0'
  },
  
  numberBullet: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: '14px'
  },
  
  numberText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '14px',
    flex: 1
  },
  
  bulletRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '6px 0'
  },
  
  bullet: {
    color: '#667eea',
    fontSize: '16px'
  },
  
  bulletText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '14px',
    flex: 1
  },
  
  textRow: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '14px',
    padding: '6px 0',
    lineHeight: '1.5'
  },
  
  footer: {
    padding: '12px 20px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  footerIcon: {
    fontSize: '14px'
  },
  
  footerText: {
    fontFamily: 'monospace'
  }
};

export default UniversalMessageCard;