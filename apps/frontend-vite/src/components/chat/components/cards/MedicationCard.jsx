import React from 'react';

const MedicationCard = ({ medications, language = 'he' }) => {
  const isRTL = language === 'he';
  
  return (
    <div style={{
      ...styles.container,
      direction: isRTL ? 'rtl' : 'ltr'
    }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>💊</span>
          <h3 style={styles.title}>מרשמים ותרופות</h3>
        </div>
        <div style={styles.pillCount}>
          {medications?.length || 0} תרופות פעילות
        </div>
      </div>
      
      {/* Medications List */}
      <div style={styles.medicationsList}>
        {medications?.map((med, index) => (
          <div key={index} style={styles.medicationItem}>
            <div style={styles.medicationHeader}>
              <div style={styles.medicationName}>
                <span style={styles.pillIcon}>💊</span>
                <span style={styles.name}>{med.name}</span>
                <span style={styles.dosage}>{med.dosage}</span>
              </div>
              {med.active && (
                <span style={styles.activeBadge}>פעיל</span>
              )}
            </div>
            
            <div style={styles.medicationDetails}>
              <div style={styles.detailRow}>
                <span style={styles.detailIcon}>⏰</span>
                <span style={styles.detailText}>
                  {med.frequency || 'פעמיים ביום'}
                </span>
              </div>
              
              <div style={styles.detailRow}>
                <span style={styles.detailIcon}>📅</span>
                <span style={styles.detailText}>
                  החל מ: {med.startDate || 'לא צוין'}
                </span>
              </div>
              
              <div style={styles.detailRow}>
                <span style={styles.detailIcon}>👨‍⚕️</span>
                <span style={styles.detailText}>
                  {med.doctor || 'ד"ר לא צוין'}
                </span>
              </div>
            </div>
            
            {med.instructions && (
              <div style={styles.instructions}>
                <span style={styles.instructionIcon}>📝</span>
                {med.instructions}
              </div>
            )}
            
            {/* Visual schedule */}
            <div style={styles.schedule}>
              <div style={styles.scheduleItem}>
                <span style={styles.timeIcon}>🌅</span>
                <span>בוקר</span>
              </div>
              <div style={styles.scheduleItem}>
                <span style={styles.timeIcon}>☀️</span>
                <span>צהריים</span>
              </div>
              <div style={styles.scheduleItem}>
                <span style={styles.timeIcon}>🌙</span>
                <span>ערב</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Action Footer */}
      <div style={styles.footer}>
        <button style={styles.footerButton}>
          <span>🔄</span>
          חידוש מרשמים
        </button>
        <button style={styles.footerButton}>
          <span>⚠️</span>
          בדיקת אינטראקציות
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(145deg, #1f1f2e 0%, #141420 100%)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    margin: '16px 0'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  
  headerIcon: {
    fontSize: '28px',
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
  },
  
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: 'white'
  },
  
  pillCount: {
    padding: '6px 12px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '20px',
    fontSize: '13px',
    color: 'white',
    fontWeight: '500'
  },
  
  medicationsList: {
    padding: '20px'
  },
  
  medicationItem: {
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    marginBottom: '16px',
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'translateX(-4px)',
      boxShadow: '4px 0 20px rgba(102, 126, 234, 0.1)'
    }
  },
  
  medicationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  
  medicationName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  pillIcon: {
    fontSize: '20px'
  },
  
  name: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)'
  },
  
  dosage: {
    padding: '2px 8px',
    background: 'rgba(102, 126, 234, 0.2)',
    borderRadius: '12px',
    fontSize: '13px',
    color: '#667eea',
    fontWeight: '500'
  },
  
  activeBadge: {
    padding: '4px 10px',
    background: 'rgba(46, 213, 115, 0.2)',
    border: '1px solid rgba(46, 213, 115, 0.3)',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#2ed573',
    fontWeight: '500'
  },
  
  medicationDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    marginBottom: '12px'
  },
  
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  
  detailIcon: {
    fontSize: '14px',
    opacity: 0.7
  },
  
  detailText: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  
  instructions: {
    padding: '10px',
    background: 'rgba(255, 217, 61, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 217, 61, 0.2)',
    fontSize: '13px',
    color: 'rgba(255, 217, 61, 0.9)',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  instructionIcon: {
    fontSize: '14px'
  },
  
  schedule: {
    display: 'flex',
    gap: '8px'
  },
  
  scheduleItem: {
    flex: 1,
    padding: '8px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  
  timeIcon: {
    fontSize: '16px'
  },
  
  footer: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
  },
  
  footerButton: {
    flex: 1,
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.3s ease',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.08)'
    }
  }
};

export default MedicationCard;