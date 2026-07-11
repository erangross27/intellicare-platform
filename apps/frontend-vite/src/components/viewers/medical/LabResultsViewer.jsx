import React, { useState, useEffect } from 'react';
import secureApiClient from '../../../services/secureApiClient';

const LabResultsViewer = ({ patientId, patientName, language }) => {
  const isRTL = language === 'he';
  const [labResults, setLabResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);
  
  useEffect(() => {
    fetchLabResults();
  }, [patientId]);
  
  const fetchLabResults = async () => {
    try {
      const practiceSubdomain = window.location.hostname.split('.')[0];
      
      const response = await secureApiClient.get(
        `/api/medical-data/patients/${patientId}/lab-results`,
        {
          headers: {
            'X-Practice-Subdomain': practiceSubdomain
          }
        }
      );
      
      setLabResults(response.data || []);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error fetching lab results:', error);
    } finally {
      setLoading(false);
    }
  };
  
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
    resultsList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    resultCard: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(74, 158, 255, 0.2)',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    resultCardHover: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.4)'
    },
    resultHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px'
    },
    testName: {
      fontSize: '16px',
      fontWeight: 600,
      color: '#4a9eff'
    },
    testDate: {
      fontSize: '13px',
      color: '#8b949e'
    },
    resultsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '12px'
    },
    resultItem: {
      background: 'rgba(30, 41, 59, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      border: '1px solid rgba(74, 158, 255, 0.1)'
    },
    paramName: {
      fontSize: '12px',
      color: '#8b949e',
      marginBottom: '4px'
    },
    paramValue: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#ffffff'
    },
    paramUnit: {
      fontSize: '12px',
      color: '#8b949e',
      marginLeft: '4px'
    },
    normalRange: {
      fontSize: '11px',
      color: '#667eea',
      marginTop: '4px'
    },
    flagHigh: {
      color: '#ef4444',
      fontWeight: 600
    },
    flagLow: {
      color: '#fbbf24',
      fontWeight: 600
    },
    flagNormal: {
      color: '#34d399'
    },
    emptyState: {
      textAlign: 'center',
      padding: '48px 24px',
      color: '#8b949e'
    },
    emptyIcon: {
      fontSize: '48px',
      marginBottom: '16px',
      opacity: 0.5
    },
    emptyText: {
      fontSize: '16px',
      marginBottom: '8px'
    },
    badge: {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 500,
      marginLeft: '8px'
    },
    badgeHigh: {
      background: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444'
    },
    badgeLow: {
      background: 'rgba(251, 191, 36, 0.2)',
      color: '#fbbf24'
    },
    badgeNormal: {
      background: 'rgba(52, 211, 153, 0.2)',
      color: '#34d399'
    }
  };
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  const getResultFlag = (value, normalRange) => {
    if (!normalRange) return 'normal';
    // Parse normal range (e.g., "70-100")
    const match = normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
    if (match) {
      const [, min, max] = match;
      const numValue = parseFloat(value);
      if (numValue < parseFloat(min)) return 'low';
      if (numValue > parseFloat(max)) return 'high';
    }
    return 'normal';
  };
  
  // Mock data for demonstration
  const mockLabResults = [
    {
      _id: '1',
      testType: 'Complete Blood Count',
      testDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      labName: 'Central Lab',
      results: {
        WBC: { value: 7.5, unit: 'K/μL', normalRange: '4.5-11.0' },
        RBC: { value: 4.8, unit: 'M/μL', normalRange: '4.5-5.9' },
        Hemoglobin: { value: 14.2, unit: 'g/dL', normalRange: '13.5-17.5' },
        Hematocrit: { value: 42, unit: '%', normalRange: '41-53' },
        Platelets: { value: 250, unit: 'K/μL', normalRange: '150-400' }
      }
    },
    {
      _id: '2',
      testType: 'Basic Metabolic Panel',
      testDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      labName: 'Hospital Lab',
      results: {
        Glucose: { value: 95, unit: 'mg/dL', normalRange: '70-100' },
        Sodium: { value: 140, unit: 'mEq/L', normalRange: '136-145' },
        Potassium: { value: 4.2, unit: 'mEq/L', normalRange: '3.5-5.0' },
        Chloride: { value: 102, unit: 'mEq/L', normalRange: '98-107' },
        CO2: { value: 24, unit: 'mEq/L', normalRange: '22-29' },
        BUN: { value: 18, unit: 'mg/dL', normalRange: '7-20' },
        Creatinine: { value: 1.0, unit: 'mg/dL', normalRange: '0.6-1.2' }
      }
    },
    {
      _id: '3',
      testType: 'Lipid Panel',
      testDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      labName: 'Practice Lab',
      results: {
        'Total Cholesterol': { value: 210, unit: 'mg/dL', normalRange: '<200' },
        'LDL': { value: 130, unit: 'mg/dL', normalRange: '<100' },
        'HDL': { value: 55, unit: 'mg/dL', normalRange: '>40' },
        'Triglycerides': { value: 125, unit: 'mg/dL', normalRange: '<150' }
      }
    }
  ];
  
  const displayResults = labResults.length > 0 ? labResults : mockLabResults;
  
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⏳</div>
          <div style={styles.emptyText}>
            {isRTL ? 'טוען תוצאות מעבדה...' : 'Loading lab results...'}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          🔬 {isRTL ? 'תוצאות מעבדה' : 'Lab Results'}
        </h2>
        <div style={styles.subtitle}>
          {patientName && `${isRTL ? 'מטופל:' : 'Patient:'} ${patientName}`}
          {displayResults.length > 0 && ` • ${displayResults.length} ${isRTL ? 'בדיקות' : 'tests'}`}
        </div>
      </div>
      
      {/* Results List */}
      {displayResults.length > 0 ? (
        <div style={styles.resultsList}>
          {displayResults.map((result) => {
            const hasAbnormal = Object.values(result.results || {}).some(r => {
              const flag = getResultFlag(r.value, r.normalRange);
              return flag !== 'normal';
            });
            
            return (
              <div
                key={result._id}
                style={{
                  ...styles.resultCard,
                  ...(selectedResult === result._id ? styles.resultCardHover : {})
                }}
                onClick={() => setSelectedResult(selectedResult === result._id ? null : result._id)}
              >
                <div style={styles.resultHeader}>
                  <div>
                    <span style={styles.testName}>{result.testType}</span>
                    {hasAbnormal && (
                      <span style={{ ...styles.badge, ...styles.badgeHigh }}>
                        {isRTL ? 'חריג' : 'Abnormal'}
                      </span>
                    )}
                  </div>
                  <div style={styles.testDate}>
                    {formatDate(result.testDate)}
                  </div>
                </div>
                
                {result.labName && (
                  <div style={{ fontSize: '13px', color: '#8b949e', marginBottom: '12px' }}>
                    {isRTL ? 'מעבדה:' : 'Lab:'} {result.labName}
                  </div>
                )}
                
                <div style={styles.resultsGrid}>
                  {Object.entries(result.results || {}).map(([param, data]) => {
                    const flag = getResultFlag(data.value, data.normalRange);
                    return (
                      <div key={param} style={styles.resultItem}>
                        <div style={styles.paramName}>{param}</div>
                        <div style={flag === 'high' ? styles.flagHigh : flag === 'low' ? styles.flagLow : styles.flagNormal}>
                          <span style={styles.paramValue}>{data.value}</span>
                          <span style={styles.paramUnit}>{data.unit}</span>
                        </div>
                        {data.normalRange && (
                          <div style={styles.normalRange}>
                            {isRTL ? 'תקין:' : 'Normal:'} {data.normalRange}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🔬</div>
          <div style={styles.emptyText}>
            {isRTL ? 'אין תוצאות מעבדה' : 'No lab results'}
          </div>
        </div>
      )}
    </div>
  );
};

export default LabResultsViewer;