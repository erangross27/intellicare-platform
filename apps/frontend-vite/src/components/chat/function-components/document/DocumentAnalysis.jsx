import React, { useState } from 'react';

const DocumentAnalysis = ({ data, config, language = 'he', onAction }) => {
  const [expandedSections, setExpandedSections] = useState(new Set(['summary']));
  const isRTL = language === 'he';
  
  // Parse the analysis data
  const analysis = data.analysis || data.extractedData || data;
  
  const labels = {
    he: {
      title: 'ניתוח מסמך',
      summary: 'סיכום',
      diagnoses: 'אבחנות',
      medications: 'תרופות',
      testResults: 'תוצאות בדיקות',
      recommendations: 'המלצות',
      practiceInfo: 'פרטי מרפאה',
      patientInfo: 'פרטי מטופל',
      documentInfo: 'פרטי מסמך',
      confidence: 'רמת ודאות',
      date: 'תאריך',
      doctor: 'רופא',
      practice: 'מרפאה',
      documentType: 'סוג מסמך',
      uploadDate: 'תאריך העלאה',
      analyzedDate: 'תאריך ניתוח',
      noData: 'אין נתונים',
      viewOriginal: 'צפה במסמך המקורי',
      updateHistory: 'עדכן היסטוריה רפואית',
      saveToFile: 'שמור לקובץ'
    },
    en: {
      title: 'Document Analysis',
      summary: 'Summary',
      diagnoses: 'Diagnoses',
      medications: 'Medications',
      testResults: 'Test Results',
      recommendations: 'Recommendations',
      practiceInfo: 'Practice Information',
      patientInfo: 'Patient Information',
      documentInfo: 'Document Information',
      confidence: 'Confidence Level',
      date: 'Date',
      doctor: 'Doctor',
      practice: 'Practice',
      documentType: 'Document Type',
      uploadDate: 'Upload Date',
      analyzedDate: 'Analysis Date',
      noData: 'No data',
      viewOriginal: 'View Original Document',
      updateHistory: 'Update Medical History',
      saveToFile: 'Save to File'
    }
  };
  
  const t = labels[language] || labels.en;
  
  const toggleSection = (section) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };
  
  const renderSection = (title, content, key, icon = '📋') => {
    if (!content || (Array.isArray(content) && content.length === 0)) {
      return null;
    }
    
    const isExpanded = expandedSections.has(key);
    
    return (
      <div style={styles.section} key={key}>
        <div 
          style={styles.sectionHeader}
          onClick={() => toggleSection(key)}
        >
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>{icon}</span>
            <span>{title}</span>
            {Array.isArray(content) && (
              <span style={styles.count}>({content.length})</span>
            )}
          </div>
          <span style={styles.chevron}>
            {isExpanded ? '▼' : isRTL ? '◄' : '►'}
          </span>
        </div>
        
        {isExpanded && (
          <div style={styles.sectionContent}>
            {Array.isArray(content) ? (
              <ul style={styles.list}>
                {content.map((item, index) => (
                  <li key={index} style={styles.listItem}>
                    {typeof item === 'object' ? (
                      <div>
                        {item.name && <strong>{item.name}: </strong>}
                        {item.value || item.description || JSON.stringify(item)}
                      </div>
                    ) : (
                      item
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={styles.text}>{content}</div>
            )}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Document Info Header */}
      {data.documentName && (
        <div style={styles.documentHeader}>
          <div style={styles.documentName}>
            📄 {data.documentName}
          </div>
          {data.confidence !== undefined && (
            <div style={styles.confidence}>
              <span style={styles.confidenceLabel}>{t.confidence}:</span>
              <span style={styles.confidenceValue}>
                {Math.round((data.confidence || 0) * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Analysis Sections */}
      {renderSection(t.summary, analysis.summary, 'summary', '📝')}
      {renderSection(t.diagnoses, analysis.diagnoses, 'diagnoses', '🩺')}
      {renderSection(t.medications, analysis.medications, 'medications', '💊')}
      {renderSection(t.testResults, analysis.testResults || analysis.labResults, 'testResults', '🧪')}
      {renderSection(t.recommendations, analysis.recommendations, 'recommendations', '💡')}
      
      {/* Practice Information */}
      {(analysis.practiceName || analysis.doctorName) && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>🏥</span>
              <span>{t.practiceInfo}</span>
            </div>
          </div>
          <div style={styles.infoGrid}>
            {analysis.doctorName && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>{t.doctor}:</span>
                <span>{analysis.doctorName}</span>
              </div>
            )}
            {analysis.practiceName && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>{t.practice}:</span>
                <span>{analysis.practiceName}</span>
              </div>
            )}
            {analysis.date && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>{t.date}:</span>
                <span>{new Date(analysis.date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div style={styles.actions}>
        <button
          style={styles.actionButton}
          onClick={() => onAction('viewOriginal', data)}
        >
          👁️ {t.viewOriginal}
        </button>
        <button
          style={{...styles.actionButton, ...styles.primaryButton}}
          onClick={() => onAction('updateHistory', data)}
        >
          📋 {t.updateHistory}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    color: '#e3e3e8'
  },
  
  documentHeader: {
    padding: '16px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: '8px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  
  documentName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#10b981'
  },
  
  confidence: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  confidenceLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  
  confidenceValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#10b981'
  },
  
  section: {
    marginBottom: '16px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden'
  },
  
  sectionHeader: {
    padding: '12px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background-color 0.2s'
  },
  
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '500'
  },
  
  sectionIcon: {
    fontSize: '16px'
  },
  
  count: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: '4px'
  },
  
  chevron: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  sectionContent: {
    padding: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  list: {
    margin: 0,
    paddingLeft: '20px'
  },
  
  listItem: {
    marginBottom: '8px',
    fontSize: '13px',
    lineHeight: '1.5'
  },
  
  text: {
    fontSize: '13px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap'
  },
  
  infoGrid: {
    padding: '16px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px'
  },
  
  infoItem: {
    display: 'flex',
    gap: '8px',
    fontSize: '13px'
  },
  
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  actionButton: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: '#e3e3e8',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    justifyContent: 'center'
  },
  
  primaryButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    color: '#10b981'
  }
};

export default DocumentAnalysis;