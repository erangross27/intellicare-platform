import React, { useState, useEffect } from 'react';

const LabDocumentViewer = ({ document, language }) => {
  const isRTL = language === 'he';
  const [activeView, setActiveView] = useState('summary');
  
  // Extract AI analysis data
  const aiAnalysis = document?.aiAnalysis || document?.analysis || document?.geminiAnalysis || {};
  const insights = aiAnalysis.insights || aiAnalysis.extractedData || {};
  const labResults = insights.labResults || [];
  const abnormalValues = labResults.filter(r => r.status === 'high' || r.status === 'low') || [];
  
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
    categoryBadge: {
      background: 'linear-gradient(135deg, #4a9eff, #667eea)',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      color: '#ffffff',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    },
    summarySection: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      border: '1px solid rgba(74, 158, 255, 0.2)'
    },
    summaryTitle: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#4a9eff',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px'
    },
    summaryCard: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '8px',
      padding: '16px',
      textAlign: 'center',
      border: '1px solid rgba(74, 158, 255, 0.1)'
    },
    summaryNumber: {
      fontSize: '28px',
      fontWeight: 600,
      color: '#ffffff',
      marginBottom: '4px'
    },
    summaryLabel: {
      fontSize: '13px',
      color: '#8b949e'
    },
    alertBox: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '2px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px'
    },
    alertTitle: {
      color: '#ef4444',
      fontSize: '16px',
      fontWeight: 600,
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    resultsTable: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '20px'
    },
    tableHeader: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderBottom: '2px solid rgba(74, 158, 255, 0.2)'
    },
    tableHeaderCell: {
      padding: '12px',
      textAlign: isRTL ? 'right' : 'left',
      fontSize: '13px',
      fontWeight: 600,
      color: '#a8b2d1',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    tableRow: {
      borderBottom: '1px solid rgba(74, 158, 255, 0.1)'
    },
    tableCell: {
      padding: '12px',
      fontSize: '14px',
      color: '#e8eaf0'
    },
    valueHigh: {
      color: '#ef4444',
      fontWeight: 600
    },
    valueLow: {
      color: '#fbbf24',
      fontWeight: 600
    },
    valueNormal: {
      color: '#34d399'
    },
    documentInfo: {
      display: 'flex',
      gap: '16px',
      marginBottom: '20px',
      flexWrap: 'wrap'
    },
    infoItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: '#a8b2d1'
    },
    infoIcon: {
      fontSize: '16px',
      opacity: 0.8
    },
    viewToggle: {
      display: 'flex',
      gap: '8px',
      marginBottom: '20px'
    },
    viewButton: {
      padding: '8px 16px',
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(74, 158, 255, 0.2)',
      borderRadius: '8px',
      color: '#8b949e',
      cursor: 'pointer',
      fontSize: '13px',
      transition: 'all 0.2s ease',
      fontFamily: 'inherit'
    },
    viewButtonActive: {
      background: 'rgba(74, 158, 255, 0.2)',
      border: '1px solid rgba(74, 158, 255, 0.4)',
      color: '#4a9eff'
    }
  };
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  // Mock enhanced lab results if none provided
  const mockLabResults = labResults.length > 0 ? labResults : [
    { test: 'Glucose', value: 105, unit: 'mg/dL', normalRange: '70-100', status: 'high' },
    { test: 'Hemoglobin', value: 14.2, unit: 'g/dL', normalRange: '13.5-17.5', status: 'normal' },
    { test: 'WBC', value: 7.5, unit: 'K/μL', normalRange: '4.5-11.0', status: 'normal' },
    { test: 'Platelets', value: 250, unit: 'K/μL', normalRange: '150-400', status: 'normal' },
    { test: 'Creatinine', value: 1.0, unit: 'mg/dL', normalRange: '0.6-1.2', status: 'normal' },
    { test: 'ALT', value: 35, unit: 'U/L', normalRange: '7-56', status: 'normal' },
    { test: 'TSH', value: 2.5, unit: 'mIU/L', normalRange: '0.4-4.0', status: 'normal' }
  ];
  
  const abnormalCount = mockLabResults.filter(r => r.status !== 'normal').length;
  const criticalValues = mockLabResults.filter(r => r.status === 'critical');
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          🔬 {isRTL ? 'תוצאות מעבדה' : 'Lab Results Document'}
        </h2>
        <div style={styles.categoryBadge}>
          <span>📋</span>
          <span>{isRTL ? 'קטגוריה: בדיקות מעבדה' : 'Category: Laboratory Tests'}</span>
        </div>
      </div>
      
      {/* Document Info */}
      <div style={styles.documentInfo}>
        <div style={styles.infoItem}>
          <span style={styles.infoIcon}>📄</span>
          <span>{document?.fileName || 'Lab_Results.pdf'}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoIcon}>📅</span>
          <span>{formatDate(document?.uploadDate || new Date())}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoIcon}>🏥</span>
          <span>{insights.labName || 'Central Laboratory'}</span>
        </div>
        {aiAnalysis.confidence && (
          <div style={styles.infoItem}>
            <span style={styles.infoIcon}>🤖</span>
            <span>AI Confidence: {Math.round(aiAnalysis.confidence * 100)}%</span>
          </div>
        )}
      </div>
      
      {/* View Toggle */}
      <div style={styles.viewToggle}>
        <button
          style={{
            ...styles.viewButton,
            ...(activeView === 'summary' ? styles.viewButtonActive : {})
          }}
          onClick={() => setActiveView('summary')}
        >
          {isRTL ? 'סיכום' : 'Summary'}
        </button>
        <button
          style={{
            ...styles.viewButton,
            ...(activeView === 'details' ? styles.viewButtonActive : {})
          }}
          onClick={() => setActiveView('details')}
        >
          {isRTL ? 'פרטים מלאים' : 'Full Details'}
        </button>
        <button
          style={{
            ...styles.viewButton,
            ...(activeView === 'trends' ? styles.viewButtonActive : {})
          }}
          onClick={() => setActiveView('trends')}
        >
          {isRTL ? 'מגמות' : 'Trends'}
        </button>
      </div>
      
      {/* Critical Alert if any */}
      {(abnormalCount > 0 || criticalValues.length > 0) && (
        <div style={styles.alertBox}>
          <div style={styles.alertTitle}>
            ⚠️ {isRTL ? 'ערכים חריגים זוהו' : 'Abnormal Values Detected'}
          </div>
          <div style={{ color: '#ef4444' }}>
            {abnormalCount > 0 && (
              <div>{abnormalCount} {isRTL ? 'ערכים מחוץ לטווח הנורמלי' : 'values outside normal range'}</div>
            )}
            {criticalValues.length > 0 && (
              <div>{isRTL ? 'נדרשת התייחסות רפואית דחופה' : 'Urgent medical attention required'}</div>
            )}
          </div>
        </div>
      )}
      
      {/* Summary View */}
      {activeView === 'summary' && (
        <>
          <div style={styles.summarySection}>
            <h3 style={styles.summaryTitle}>
              📊 {isRTL ? 'סיכום תוצאות' : 'Results Summary'}
            </h3>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>{mockLabResults.length}</div>
                <div style={styles.summaryLabel}>{isRTL ? 'בדיקות בוצעו' : 'Tests Performed'}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={{...styles.summaryNumber, color: '#34d399'}}>
                  {mockLabResults.filter(r => r.status === 'normal').length}
                </div>
                <div style={styles.summaryLabel}>{isRTL ? 'תקינים' : 'Normal'}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={{...styles.summaryNumber, color: abnormalCount > 0 ? '#ef4444' : '#34d399'}}>
                  {abnormalCount}
                </div>
                <div style={styles.summaryLabel}>{isRTL ? 'חריגים' : 'Abnormal'}</div>
              </div>
            </div>
          </div>
          
          {/* Quick Results Overview */}
          <div style={styles.summarySection}>
            <h3 style={styles.summaryTitle}>
              🔍 {isRTL ? 'תוצאות עיקריות' : 'Key Results'}
            </h3>
            {mockLabResults.slice(0, 5).map((result, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                marginBottom: '8px',
                background: 'rgba(30, 41, 59, 0.3)',
                borderRadius: '8px',
                borderLeft: `3px solid ${result.status === 'high' ? '#ef4444' : result.status === 'low' ? '#fbbf24' : '#34d399'}`
              }}>
                <span style={{ fontWeight: 500 }}>{result.test}</span>
                <span style={
                  result.status === 'high' ? styles.valueHigh :
                  result.status === 'low' ? styles.valueLow :
                  styles.valueNormal
                }>
                  {result.value} {result.unit}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      
      {/* Detailed View */}
      {activeView === 'details' && (
        <div style={styles.summarySection}>
          <h3 style={styles.summaryTitle}>
            📋 {isRTL ? 'תוצאות מפורטות' : 'Detailed Results'}
          </h3>
          <table style={styles.resultsTable}>
            <thead style={styles.tableHeader}>
              <tr>
                <th style={styles.tableHeaderCell}>{isRTL ? 'בדיקה' : 'Test'}</th>
                <th style={styles.tableHeaderCell}>{isRTL ? 'תוצאה' : 'Result'}</th>
                <th style={styles.tableHeaderCell}>{isRTL ? 'יחידות' : 'Units'}</th>
                <th style={styles.tableHeaderCell}>{isRTL ? 'טווח תקין' : 'Normal Range'}</th>
                <th style={styles.tableHeaderCell}>{isRTL ? 'סטטוס' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {mockLabResults.map((result, index) => (
                <tr key={index} style={styles.tableRow}>
                  <td style={styles.tableCell}>{result.test}</td>
                  <td style={{
                    ...styles.tableCell,
                    ...(result.status === 'high' ? styles.valueHigh :
                        result.status === 'low' ? styles.valueLow :
                        styles.valueNormal)
                  }}>
                    {result.value}
                  </td>
                  <td style={styles.tableCell}>{result.unit}</td>
                  <td style={styles.tableCell}>{result.normalRange}</td>
                  <td style={styles.tableCell}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      background: result.status === 'normal' ? 'rgba(52, 211, 153, 0.2)' :
                                 result.status === 'high' ? 'rgba(239, 68, 68, 0.2)' :
                                 'rgba(251, 191, 36, 0.2)',
                      color: result.status === 'normal' ? '#34d399' :
                             result.status === 'high' ? '#ef4444' :
                             '#fbbf24'
                    }}>
                      {result.status === 'normal' ? (isRTL ? 'תקין' : 'Normal') :
                       result.status === 'high' ? (isRTL ? 'גבוה' : 'High') :
                       (isRTL ? 'נמוך' : 'Low')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Trends View */}
      {activeView === 'trends' && (
        <div style={styles.summarySection}>
          <h3 style={styles.summaryTitle}>
            📈 {isRTL ? 'מגמות ומעקב' : 'Trends & Monitoring'}
          </h3>
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📊</div>
            <div>{isRTL ? 'השוואת תוצאות לאורך זמן תוצג כאן' : 'Historical comparison will be displayed here'}</div>
            <div style={{ fontSize: '13px', marginTop: '8px', color: '#667eea' }}>
              {isRTL ? 'נדרשות לפחות 2 בדיקות להצגת מגמות' : 'At least 2 tests required to show trends'}
            </div>
          </div>
        </div>
      )}
      
      {/* AI Insights */}
      {insights.recommendations && (
        <div style={styles.summarySection}>
          <h3 style={styles.summaryTitle}>
            🤖 {isRTL ? 'תובנות AI' : 'AI Insights'}
          </h3>
          <div style={{ lineHeight: '1.6' }}>
            {insights.recommendations}
          </div>
        </div>
      )}
    </div>
  );
};

export default LabDocumentViewer;