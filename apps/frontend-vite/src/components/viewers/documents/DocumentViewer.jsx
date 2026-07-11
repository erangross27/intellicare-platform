import React, { useState } from 'react';
import DocumentCategoryRouter from './DocumentCategoryRouter';

const DocumentViewer = ({ document, language }) => {
  const isRTL = language === 'he';
  const [activeTab, setActiveTab] = useState('overview');
  
  // Handle various data structures from backend
  const doc = document?.document || document?.data || document || {};
  const analysis = doc.analysis || doc.aiAnalysis || doc.geminiAnalysis || {};
  const insights = analysis.insights || analysis.extractedData || {};
  
  // Styles
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
    header: {
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '2px solid rgba(74, 158, 255, 0.2)'
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '24px',
      fontWeight: 600,
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    subtitle: {
      fontSize: '14px',
      color: '#a8b2d1'
    },
    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '24px',
      borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
      paddingBottom: '0'
    },
    tab: {
      padding: '12px 20px',
      background: 'transparent',
      border: 'none',
      color: '#8b949e',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      borderBottom: '2px solid transparent',
      fontFamily: 'inherit'
    },
    tabActive: {
      color: '#4a9eff',
      borderBottom: '2px solid #4a9eff'
    },
    section: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid rgba(74, 158, 255, 0.2)'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#ffffff',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '16px'
    },
    card: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid rgba(74, 158, 255, 0.1)'
    },
    cardTitle: {
      fontSize: '14px',
      fontWeight: 600,
      color: '#4a9eff',
      marginBottom: '8px'
    },
    cardContent: {
      fontSize: '14px',
      color: '#e8eaf0',
      lineHeight: '1.6'
    },
    badge: {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 500,
      marginRight: '8px',
      marginBottom: '8px'
    },
    badgeSuccess: {
      background: 'rgba(52, 211, 153, 0.2)',
      color: '#34d399'
    },
    badgeWarning: {
      background: 'rgba(251, 191, 36, 0.2)',
      color: '#fbbf24'
    },
    badgeDanger: {
      background: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444'
    },
    badgeInfo: {
      background: 'rgba(74, 158, 255, 0.2)',
      color: '#4a9eff'
    },
    list: {
      listStyle: 'none',
      padding: 0,
      margin: 0
    },
    listItem: {
      padding: '12px',
      marginBottom: '8px',
      background: 'rgba(30, 41, 59, 0.3)',
      borderRadius: '6px',
      borderRight: isRTL ? '3px solid #4a9eff' : 'none',
      borderLeft: isRTL ? 'none' : '3px solid #4a9eff'
    },
    highlight: {
      background: 'rgba(74, 158, 255, 0.1)',
      padding: '2px 6px',
      borderRadius: '4px',
      color: '#4a9eff'
    },
    warningBox: {
      background: 'rgba(251, 191, 36, 0.1)',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
      color: '#fbbf24'
    },
    successBox: {
      background: 'rgba(52, 211, 153, 0.1)',
      border: '1px solid rgba(52, 211, 153, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
      color: '#34d399'
    },
    documentPreview: {
      background: 'rgba(30, 41, 59, 0.3)',
      borderRadius: '8px',
      padding: '24px',
      textAlign: 'center',
      minHeight: '200px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    },
    icon: {
      fontSize: '48px',
      marginBottom: '16px',
      opacity: 0.8
    }
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  // Get document type icon
  const getDocIcon = (type) => {
    const fileType = type || doc.fileType || doc.mimeType || '';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('dicom')) return '🩻';
    return '📋';
  };
  
  // Get category color
  const getCategoryStyle = (category) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('lab')) return styles.badgeInfo;
    if (cat.includes('imaging') || cat.includes('radiology')) return styles.badgeWarning;
    if (cat.includes('prescription') || cat.includes('medication')) return styles.badgeSuccess;
    if (cat.includes('diagnosis')) return styles.badgeDanger;
    return styles.badgeInfo;
  };
  
  // Render Overview Tab
  const renderOverview = () => (
    <>
      {/* Document Info */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          📄 {isRTL ? 'מידע על המסמך' : 'Document Information'}
        </h3>
        
        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>{isRTL ? 'שם קובץ' : 'File Name'}</div>
            <div style={styles.cardContent}>{doc.fileName || doc.name || 'Unknown'}</div>
          </div>
          
          <div style={styles.card}>
            <div style={styles.cardTitle}>{isRTL ? 'תאריך העלאה' : 'Upload Date'}</div>
            <div style={styles.cardContent}>{formatDate(doc.uploadDate || doc.createdAt)}</div>
          </div>
          
          <div style={styles.card}>
            <div style={styles.cardTitle}>{isRTL ? 'קטגוריה' : 'Category'}</div>
            <div style={styles.cardContent}>
              <span style={{
                ...styles.badge,
                ...getCategoryStyle(doc.category || analysis.category)
              }}>
                {doc.category || analysis.category || 'Uncategorized'}
              </span>
            </div>
          </div>
          
          <div style={styles.card}>
            <div style={styles.cardTitle}>{isRTL ? 'סטטוס ניתוח' : 'Analysis Status'}</div>
            <div style={styles.cardContent}>
              {analysis.status === 'completed' ? (
                <span style={{ color: '#34d399' }}>✅ {isRTL ? 'הושלם' : 'Completed'}</span>
              ) : analysis.status === 'processing' ? (
                <span style={{ color: '#fbbf24' }}>⏳ {isRTL ? 'בעיבוד' : 'Processing'}</span>
              ) : (
                <span style={{ color: '#8b949e' }}>⏸️ {isRTL ? 'ממתין' : 'Pending'}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Document Preview */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          👁️ {isRTL ? 'תצוגה מקדימה' : 'Preview'}
        </h3>
        
        <div style={styles.documentPreview}>
          <div style={styles.icon}>{getDocIcon(doc.fileType)}</div>
          <div style={{ fontSize: '16px', color: '#ffffff', marginBottom: '8px' }}>
            {doc.fileName || doc.name}
          </div>
          <div style={{ fontSize: '14px', color: '#8b949e' }}>
            {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
          </div>
          {doc.pageCount && (
            <div style={{ fontSize: '14px', color: '#8b949e', marginTop: '8px' }}>
              {doc.pageCount} {isRTL ? 'עמודים' : 'pages'}
            </div>
          )}
        </div>
      </div>
    </>
  );
  
  // Render AI Insights Tab
  const renderAIInsights = () => (
    <>
      {/* Key Findings */}
      {(insights.keyFindings || insights.summary) && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            🔍 {isRTL ? 'ממצאים עיקריים' : 'Key Findings'}
          </h3>
          <div style={styles.cardContent}>
            {insights.summary || insights.keyFindings}
          </div>
        </div>
      )}
      
      {/* Extracted Diagnoses */}
      {insights.diagnoses && insights.diagnoses.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            🩺 {isRTL ? 'אבחנות שזוהו' : 'Identified Diagnoses'}
          </h3>
          <ul style={styles.list}>
            {insights.diagnoses.map((diagnosis, i) => (
              <li key={i} style={styles.listItem}>
                <strong>{diagnosis.name || diagnosis}</strong>
                {diagnosis.date && (
                  <span style={{ marginLeft: '12px', color: '#8b949e' }}>
                    ({formatDate(diagnosis.date)})
                  </span>
                )}
                {diagnosis.severity && (
                  <span style={{
                    ...styles.badge,
                    ...(diagnosis.severity === 'high' ? styles.badgeDanger : 
                        diagnosis.severity === 'medium' ? styles.badgeWarning : 
                        styles.badgeInfo),
                    marginLeft: '8px'
                  }}>
                    {diagnosis.severity}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Extracted Medications */}
      {insights.medications && insights.medications.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            💊 {isRTL ? 'תרופות שזוהו' : 'Identified Medications'}
          </h3>
          <div style={styles.grid}>
            {insights.medications.map((med, i) => (
              <div key={i} style={styles.card}>
                <div style={styles.cardTitle}>{med.name || med}</div>
                <div style={styles.cardContent}>
                  {med.dosage && <div>Dosage: {med.dosage}</div>}
                  {med.frequency && <div>Frequency: {med.frequency}</div>}
                  {med.duration && <div>Duration: {med.duration}</div>}
                  {med.prescribedDate && <div>Date: {formatDate(med.prescribedDate)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Lab Results */}
      {insights.labResults && insights.labResults.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            🔬 {isRTL ? 'תוצאות מעבדה' : 'Lab Results'}
          </h3>
          <div style={styles.grid}>
            {insights.labResults.map((result, i) => (
              <div key={i} style={styles.card}>
                <div style={styles.cardTitle}>{result.test || result.name}</div>
                <div style={styles.cardContent}>
                  <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                    {result.value} {result.unit}
                  </div>
                  {result.normalRange && (
                    <div style={{ fontSize: '12px', color: '#8b949e' }}>
                      Normal: {result.normalRange}
                    </div>
                  )}
                  {result.status && (
                    <span style={{
                      ...styles.badge,
                      ...(result.status === 'high' || result.status === 'low' ? 
                          styles.badgeDanger : styles.badgeSuccess)
                    }}>
                      {result.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Allergies */}
      {insights.allergies && insights.allergies.length > 0 && (
        <div style={styles.warningBox}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
            ⚠️ {isRTL ? 'אלרגיות שזוהו' : 'Identified Allergies'}
          </h3>
          {insights.allergies.map((allergy, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              • {allergy.allergen || allergy}
              {allergy.reaction && ` - ${allergy.reaction}`}
            </div>
          ))}
        </div>
      )}
      
      {/* Important Dates */}
      {insights.dates && insights.dates.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            📅 {isRTL ? 'תאריכים חשובים' : 'Important Dates'}
          </h3>
          <ul style={styles.list}>
            {insights.dates.map((dateItem, i) => (
              <li key={i} style={styles.listItem}>
                <strong>{formatDate(dateItem.date)}</strong> - {dateItem.event || dateItem.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Recommendations */}
      {insights.recommendations && insights.recommendations.length > 0 && (
        <div style={styles.successBox}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
            💡 {isRTL ? 'המלצות' : 'Recommendations'}
          </h3>
          {insights.recommendations.map((rec, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              • {rec}
            </div>
          ))}
        </div>
      )}
    </>
  );
  
  // Render Medical Data Tab
  const renderMedicalData = () => (
    <>
      {/* Vital Signs */}
      {insights.vitalSigns && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            📊 {isRTL ? 'סימנים חיוניים' : 'Vital Signs'}
          </h3>
          <div style={styles.grid}>
            {insights.vitalSigns.bloodPressure && (
              <div style={styles.card}>
                <div style={styles.cardTitle}>{isRTL ? 'לחץ דם' : 'Blood Pressure'}</div>
                <div style={styles.cardContent}>{insights.vitalSigns.bloodPressure}</div>
              </div>
            )}
            {insights.vitalSigns.pulse && (
              <div style={styles.card}>
                <div style={styles.cardTitle}>{isRTL ? 'דופק' : 'Pulse'}</div>
                <div style={styles.cardContent}>{insights.vitalSigns.pulse}</div>
              </div>
            )}
            {insights.vitalSigns.temperature && (
              <div style={styles.card}>
                <div style={styles.cardTitle}>{isRTL ? 'חום' : 'Temperature'}</div>
                <div style={styles.cardContent}>{insights.vitalSigns.temperature}</div>
              </div>
            )}
            {insights.vitalSigns.weight && (
              <div style={styles.card}>
                <div style={styles.cardTitle}>{isRTL ? 'משקל' : 'Weight'}</div>
                <div style={styles.cardContent}>{insights.vitalSigns.weight}</div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Medical History Items */}
      {insights.medicalHistory && insights.medicalHistory.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            📋 {isRTL ? 'היסטוריה רפואית' : 'Medical History'}
          </h3>
          <ul style={styles.list}>
            {insights.medicalHistory.map((item, i) => (
              <li key={i} style={styles.listItem}>
                {item.date && <strong>{formatDate(item.date)}:</strong>} {item.description || item}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Procedures */}
      {insights.procedures && insights.procedures.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            🏥 {isRTL ? 'פרוצדורות' : 'Procedures'}
          </h3>
          <ul style={styles.list}>
            {insights.procedures.map((proc, i) => (
              <li key={i} style={styles.listItem}>
                <strong>{proc.name || proc}</strong>
                {proc.date && ` - ${formatDate(proc.date)}`}
                {proc.provider && <div style={{ fontSize: '12px', color: '#8b949e' }}>Provider: {proc.provider}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
  
  // Render Raw Data Tab (for debugging)
  const renderRawData = () => (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>
        🔧 {isRTL ? 'נתונים גולמיים' : 'Raw Data'}
      </h3>
      <pre style={{
        background: 'rgba(10, 14, 39, 0.6)',
        padding: '16px',
        borderRadius: '8px',
        color: '#e8eaf0',
        fontSize: '12px',
        overflowX: 'auto'
      }}>
        {JSON.stringify({ document: doc, analysis, insights }, null, 2)}
      </pre>
    </div>
  );
  
  // Check if document has AI classification to use category-specific viewer
  const hasAIClassification = doc.aiClassification?.documentType || doc.fileType in [
    'lab_results', 'prescriptions', 'discharge_summary', 'imaging_reports',
    'consultation_notes', 'vaccination_records', 'referrals', 'medical_certificate',
    'medical_procedures'
  ];
  
  // If document has specific medical category, use the category router
  if (hasAIClassification) {
    return <DocumentCategoryRouter document={document} language={language} />;
  }
  
  // Otherwise, show the generic document viewer
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          {getDocIcon(doc.fileType)}
          {isRTL ? 'מסמך רפואי' : 'Medical Document'}
        </h2>
        <div style={styles.subtitle}>
          {doc.patientName && `${isRTL ? 'מטופל:' : 'Patient:'} ${doc.patientName}`}
          {analysis.confidence && ` • ${isRTL ? 'ביטחון:' : 'Confidence:'} ${analysis.confidence}%`}
        </div>
      </div>
      
      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'overview' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('overview')}
        >
          {isRTL ? 'סקירה' : 'Overview'}
        </button>
        
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'insights' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('insights')}
        >
          {isRTL ? 'תובנות AI' : 'AI Insights'}
        </button>
        
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'medical' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('medical')}
        >
          {isRTL ? 'נתונים רפואיים' : 'Medical Data'}
        </button>
        
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'raw' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('raw')}
        >
          {isRTL ? 'נתונים גולמיים' : 'Raw Data'}
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'insights' && renderAIInsights()}
      {activeTab === 'medical' && renderMedicalData()}
      {activeTab === 'raw' && renderRawData()}
    </div>
  );
};

export default DocumentViewer;