import React from 'react';

const LabResultsCard = ({ results, language = 'he' }) => {
  const isRTL = language === 'he';
  
  // Helper to determine if value is abnormal
  const getValueStatus = (value, normalRange) => {
    if (!normalRange) return 'normal';
    const numValue = parseFloat(value);
    const [min, max] = normalRange.split('-').map(v => parseFloat(v));
    if (numValue < min) return 'low';
    if (numValue > max) return 'high';
    return 'normal';
  };
  
  return (
    <div style={{
      ...styles.container,
      direction: isRTL ? 'rtl' : 'ltr'
    }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>🧪</div>
        <div style={styles.headerContent}>
          <h3 style={styles.title}>תוצאות בדיקות מעבדה</h3>
          <div style={styles.date}>{results.date || new Date().toLocaleDateString('he-IL')}</div>
        </div>
        <div style={styles.statusBadge}>
          <span style={styles.statusIcon}>✓</span>
          הושלם
        </div>
      </div>
      
      {/* Results Grid */}
      <div style={styles.resultsGrid}>
        {results.tests?.map((test, index) => {
          const status = getValueStatus(test.value, test.normalRange);
          return (
            <div key={index} style={{
              ...styles.testCard,
              ...(status === 'high' && styles.testCardHigh),
              ...(status === 'low' && styles.testCardLow)
            }}>
              <div style={styles.testHeader}>
                <span style={styles.testName}>{test.name}</span>
                {status !== 'normal' && (
                  <span style={{
                    ...styles.alertIcon,
                    color: status === 'high' ? '#ff6b6b' : '#ffd93d'
                  }}>
                    {status === 'high' ? '↑' : '↓'}
                  </span>
                )}
              </div>
              
              <div style={styles.testValue}>
                <span style={{
                  ...styles.value,
                  color: status === 'normal' ? '#2ed573' : 
                         status === 'high' ? '#ff6b6b' : '#ffd93d'
                }}>
                  {test.value}
                </span>
                <span style={styles.unit}>{test.unit}</span>
              </div>
              
              <div style={styles.normalRange}>
                טווח נורמלי: {test.normalRange}
              </div>
              
              {/* Visual indicator */}
              <div style={styles.indicatorBar}>
                <div style={{
                  ...styles.indicatorFill,
                  width: `${Math.min(100, (parseFloat(test.value) / parseFloat(test.normalRange?.split('-')[1] || 100)) * 100)}%`,
                  background: status === 'normal' ? '#2ed573' : 
                             status === 'high' ? '#ff6b6b' : '#ffd93d'
                }}></div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Summary Section */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryIcon}>📊</span>
          <span style={styles.summaryText}>
            {results.tests?.length || 0} בדיקות בוצעו
          </span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryIcon}>👨‍⚕️</span>
          <span style={styles.summaryText}>
            ד"ר {results.doctor || 'לא צוין'}
          </span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(145deg, #1a1a2e 0%, #0f0f1e 100%)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    margin: '16px 0'
  },
  
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
  },
  
  headerIcon: {
    fontSize: '32px',
    marginRight: '16px',
    filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))'
  },
  
  headerContent: {
    flex: 1
  },
  
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: '4px'
  },
  
  date: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'rgba(46, 213, 115, 0.1)',
    border: '1px solid rgba(46, 213, 115, 0.3)',
    borderRadius: '20px',
    color: '#2ed573',
    fontSize: '13px'
  },
  
  statusIcon: {
    fontSize: '12px'
  },
  
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    padding: '20px'
  },
  
  testCard: {
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    transition: 'all 0.3s ease'
  },
  
  testCardHigh: {
    borderColor: 'rgba(255, 107, 107, 0.3)',
    background: 'rgba(255, 107, 107, 0.05)'
  },
  
  testCardLow: {
    borderColor: 'rgba(255, 217, 61, 0.3)',
    background: 'rgba(255, 217, 61, 0.05)'
  },
  
  testHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  
  testName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)'
  },
  
  alertIcon: {
    fontSize: '18px',
    fontWeight: 'bold'
  },
  
  testValue: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    marginBottom: '8px'
  },
  
  value: {
    fontSize: '24px',
    fontWeight: '700'
  },
  
  unit: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  normalRange: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: '8px'
  },
  
  indicatorBar: {
    height: '4px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  
  indicatorFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease'
  },
  
  summary: {
    display: 'flex',
    gap: '24px',
    padding: '16px 20px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
  },
  
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  summaryIcon: {
    fontSize: '16px'
  },
  
  summaryText: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)'
  }
};

export default LabResultsCard;