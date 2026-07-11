import React from 'react';
import typography from '../styles/typography';

const { colors, textStyles, componentStyles, fontFamily, fontSize, fontWeight } = typography;

const MessageCard = ({ content, language = 'he', functionCall }) => {
  const isRTL = language === 'he';
  
  // Parse agent's response to extract structured data
  const parseAgentResponse = (text) => {
    if (!text) return null;
    
    // Remove markdown bold markers
    const cleanText = text.replace(/\*\*/g, '');
    
    const data = {
      title: '',
      sections: [],
      hasData: false
    };
    
    // Extract title (first line or function description)
    const lines = cleanText.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      // Check for patient found message
      if (lines[0].includes('מצאתי') || lines[0].includes('Found')) {
        data.title = lines[0].replace('!', '');
        data.hasData = true;
      }
    }
    
    // Parse sections based on Hebrew keywords
    const sectionKeywords = {
      'פרטים אישיים': { icon: '👤', key: 'personal' },
      'היסטוריה רפואית': { icon: '🏥', key: 'medical' },
      'בדיקת': { icon: '🔬', key: 'test' },
      'מרשמים': { icon: '💊', key: 'prescriptions' },
      'בדיקת מעבדה': { icon: '🧪', key: 'lab' },
      'תרופות': { icon: '💊', key: 'medications' },
      'ממצאים': { icon: '📋', key: 'findings' },
      'המלצות': { icon: '💡', key: 'recommendations' },
      'קולונוסקופיה': { icon: '🔬', key: 'procedure' },
      'MRI': { icon: '🔬', key: 'procedure' }
    };
    
    let currentSection = null;
    let currentItems = [];
    
    lines.forEach((line, index) => {
      // Check if this line starts a new section - look for section headers
      let newSection = false;
      
      // Check for section headers with colon or bold formatting
      for (const [keyword, config] of Object.entries(sectionKeywords)) {
        if (line.includes(keyword) && (line.endsWith(':') || index === 0 || lines[index - 1] === '')) {
          // Save previous section if exists
          if (currentSection && currentItems.length > 0) {
            data.sections.push({
              ...currentSection,
              items: [...currentItems]
            });
          }
          
          currentSection = {
            title: line.replace(':', '').replace(/^\d+\./, '').trim(),
            icon: config.icon,
            key: config.key
          };
          currentItems = [];
          newSection = true;
          break;
        }
      }
      
      // If not a new section, add to current items
      if (!newSection && currentSection && line.trim()) {
        // Skip cost information
        if (line.includes('₪') || line.includes('שיחה זו') || line.includes('טוקנים')) {
          return; // Skip this line
        }
        
        // Parse item based on format
        if (line.startsWith('-') || line.startsWith('•')) {
          const item = line.substring(1).trim();
          
          // Check for key-value pairs
          if (item.includes(':')) {
            const [key, ...valueParts] = item.split(':');
            currentItems.push({
              type: 'keyValue',
              key: key.trim(),
              value: valueParts.join(':').trim()
            });
          } else {
            currentItems.push({
              type: 'text',
              value: item
            });
          }
        } else if (line.match(/^\d+\./)) {
          // Numbered item (like medical history items)
          const item = line.replace(/^\d+\./, '').trim();
          
          // Parse procedure/test with date - handles format like "בדיקת קולונוסקופיה (19/08/2025):"
          const dateMatch = item.match(/\(([^)]+)\)/);
          if (dateMatch) {
            const mainText = item.replace(/\([^)]+\):?/, '').replace(':','').trim();
            currentItems.push({
              type: 'procedure',
              title: mainText,
              date: dateMatch[1],
              details: []
            });
          } else {
            // Simple numbered item
            currentItems.push({
              type: 'numbered',
              value: item.replace(':','')
            });
          }
        } else if (line.includes(':') && !line.startsWith('http') && !line.includes('💰')) {
          // Key-value pair (excluding cost lines)
          const colonIndex = line.indexOf(':');
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          
          // Skip empty values
          if (!value) return;
          
          // Add to last procedure if it's a detail
          if (currentItems.length > 0 && 
              currentItems[currentItems.length - 1].type === 'procedure') {
            currentItems[currentItems.length - 1].details.push({
              key: key,
              value: value
            });
          } else {
            currentItems.push({
              type: 'keyValue',
              key: key,
              value: value
            });
          }
        }
      }
    });
    
    // Add last section
    if (currentSection && currentItems.length > 0) {
      data.sections.push({
        ...currentSection,
        items: currentItems
      });
    }
    
    return data.hasData || data.sections.length > 0 ? data : null;
  };
  
  const parsedData = parseAgentResponse(content);
  
  // If no structured data found, return null (show regular text)
  if (!parsedData) {
    return null;
  }
  
  // Render beautiful card based on parsed data
  return (
    <div style={styles.cardContainer}>
      {parsedData.title && (
        <div style={styles.cardHeader}>
          <span style={styles.headerIcon}>
            {functionCall?.name?.includes('patient') ? '👥' : '📊'}
          </span>
          <span style={styles.headerTitle}>{parsedData.title}</span>
        </div>
      )}
      
      <div style={styles.cardBody}>
        {parsedData.sections.map((section, sectionIndex) => (
          <div key={sectionIndex} style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>{section.icon}</span>
              <span style={styles.sectionTitle}>{section.title}</span>
            </div>
            
            <div style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => {
                // Render based on item type
                if (item.type === 'keyValue') {
                  return (
                    <div key={itemIndex} style={styles.kvRow}>
                      <span style={styles.kvKey}>{item.key}:</span>
                      <span style={styles.kvValue}>{item.value}</span>
                    </div>
                  );
                } else if (item.type === 'procedure') {
                  return (
                    <div key={itemIndex} style={styles.procedureCard}>
                      <div style={styles.procedureHeader}>
                        <span style={styles.procedureTitle}>{item.title}</span>
                        <span style={styles.procedureDate}>{item.date}</span>
                      </div>
                      {item.details.length > 0 && (
                        <div style={styles.procedureDetails}>
                          {item.details.map((detail, detailIndex) => (
                            <div key={detailIndex} style={styles.detailRow}>
                              <span style={styles.detailKey}>{detail.key}:</span>
                              <span style={styles.detailValue}>{detail.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                } else if (item.type === 'text') {
                  return (
                    <div key={itemIndex} style={styles.textItem}>
                      {item.value}
                    </div>
                  );
                } else if (item.type === 'numbered') {
                  return (
                    <div key={itemIndex} style={styles.numberedItem}>
                      <span style={styles.numberedBullet}>•</span>
                      <span>{item.value}</span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Professional medical-grade styles with improved typography
const styles = {
  cardContainer: {
    background: `linear-gradient(135deg, ${colors.background.secondary}e6 0%, ${colors.background.tertiary}e6 100%)`,
    borderRadius: '16px',
    border: `1px solid ${colors.border.medium}`,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    margin: '20px 0',
    overflow: 'hidden',
    backdropFilter: 'blur(10px)',
    fontFamily: fontFamily.primary
  },
  
  cardHeader: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: `2px solid ${colors.border.medium}`,
    padding: '18px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },

  headerIcon: {
    fontSize: '28px',
    filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))'
  },

  headerTitle: {
    ...textStyles.h3,
    fontSize: fontSize.h3,
    margin: 0,
    letterSpacing: '0.3px'
  },
  
  cardBody: {
    padding: '20px'
  },
  
  section: {
    marginBottom: '24px',
    '&:last-child': {
      marginBottom: 0
    }
  },
  
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '18px',
    paddingBottom: '10px',
    borderBottom: `1px solid ${colors.border.light}`
  },

  sectionIcon: {
    fontSize: '22px',
    filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3))'
  },

  sectionTitle: {
    ...textStyles.h4,
    fontSize: fontSize.h4,
    margin: 0,
    color: colors.text.primary
  },
  
  sectionContent: {
    paddingLeft: '30px'
  },
  
  kvRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 1fr) 2fr',
    gap: '16px',
    padding: '10px 0',
    borderBottom: `1px solid ${colors.border.light}`,
    alignItems: 'baseline'
  },

  kvKey: {
    ...textStyles.label,
    color: colors.text.tertiary,
    fontSize: fontSize.regular,
    fontWeight: fontWeight.medium,
    textTransform: 'none'
  },

  kvValue: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: fontWeight.regular,
    lineHeight: '1.6'
  },
  
  procedureCard: {
    background: `linear-gradient(135deg, ${colors.background.elevated}cc, ${colors.background.secondary}cc)`,
    borderRadius: '12px',
    border: `1px solid ${colors.border.medium}`,
    padding: '16px',
    marginBottom: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    transition: 'all 0.3s ease'
  },

  procedureHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    paddingBottom: '10px',
    borderBottom: `1px solid ${colors.border.light}`
  },

  procedureTitle: {
    ...textStyles.h5,
    fontSize: fontSize.h5,
    color: colors.accent.blue,
    margin: 0
  },

  procedureDate: {
    ...textStyles.caption,
    fontSize: fontSize.caption,
    color: colors.text.primary,
    background: colors.accent.blue + '20',
    padding: '4px 10px',
    borderRadius: '14px',
    fontWeight: fontWeight.medium
  },
  
  procedureDetails: {
    paddingLeft: '16px',
    marginTop: '12px',
    borderLeft: `3px solid ${colors.accent.blue}40`
  },

  detailRow: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: '12px',
    padding: '8px',
    marginBottom: '6px',
    backgroundColor: colors.background.primary + '80',
    borderRadius: '6px'
  },

  detailKey: {
    ...textStyles.caption,
    color: colors.text.tertiary,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontSize: fontSize.small
  },

  detailValue: {
    ...textStyles.body,
    color: colors.text.primary,
    fontSize: fontSize.regular
  },
  
  textItem: {
    ...textStyles.body,
    padding: '6px 0',
    lineHeight: '1.6'
  },

  numberedItem: {
    ...componentStyles.list.item,
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    padding: '6px 0',
    marginBottom: '4px'
  },

  numberedBullet: {
    ...componentStyles.list.bullet,
    color: colors.accent.blue,
    fontWeight: fontWeight.semibold
  },

  // Medical value badges
  medicalBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    marginLeft: '8px',
    fontFamily: fontFamily.mono
  },

  normalRange: {
    backgroundColor: colors.medical.normal + '20',
    color: colors.medical.normal,
    border: `1px solid ${colors.medical.normal}40`
  },

  highValue: {
    backgroundColor: colors.medical.warning + '20',
    color: colors.medical.warning,
    border: `1px solid ${colors.medical.warning}40`
  },

  lowValue: {
    backgroundColor: colors.medical.info + '20',
    color: colors.medical.info,
    border: `1px solid ${colors.medical.info}40`
  },

  criticalValue: {
    backgroundColor: colors.medical.critical + '20',
    color: colors.medical.critical,
    border: `1px solid ${colors.medical.critical}40`,
    animation: 'pulse 2s infinite'
  }
};

export default MessageCard;