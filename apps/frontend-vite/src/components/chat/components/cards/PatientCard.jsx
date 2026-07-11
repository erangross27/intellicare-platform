import React from 'react';

const PatientCard = ({ data, language = 'he' }) => {
  const isRTL = language === 'he';
  
  return (
    <div style={{
      ...styles.container,
      direction: isRTL ? 'rtl' : 'ltr'
    }}>
      {/* Header with gradient */}
      <div style={styles.header}>
        <div style={styles.headerGradient}>
          <div style={styles.avatar}>
            {data.firstName?.[0]}{data.lastName?.[0]}
          </div>
          <div style={styles.headerInfo}>
            <h3 style={styles.name}>{data.firstName} {data.lastName}</h3>
            <div style={styles.badges}>
              <span style={styles.idBadge}>
                <span style={styles.badgeIcon}>🆔</span>
                {data.nationalId}
              </span>
              <span style={styles.statusBadge}>
                <span style={styles.statusDot}></span>
                {data.status === 'active' ? 'פעיל' : 'לא פעיל'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Info Grid */}
      <div style={styles.infoGrid}>
        <div style={styles.infoCard}>
          <span style={styles.infoIcon}>📅</span>
          <div>
            <div style={styles.infoLabel}>תאריך לידה</div>
            <div style={styles.infoValue}>{data.birthDate}</div>
          </div>
        </div>
        
        <div style={styles.infoCard}>
          <span style={styles.infoIcon}>📞</span>
          <div>
            <div style={styles.infoLabel}>טלפון</div>
            <div style={styles.infoValue}>{data.phone}</div>
          </div>
        </div>
        
        <div style={styles.infoCard}>
          <span style={styles.infoIcon}>✉️</span>
          <div>
            <div style={styles.infoLabel}>אימייל</div>
            <div style={styles.infoValue}>{data.email}</div>
          </div>
        </div>
        
        <div style={styles.infoCard}>
          <span style={styles.infoIcon}>🏥</span>
          <div>
            <div style={styles.infoLabel}>קופת חולים</div>
            <div style={styles.infoValue}>{data.healthFund}</div>
          </div>
        </div>
      </div>
      
      {/* Address Section */}
      <div style={styles.addressSection}>
        <div style={styles.sectionTitle}>
          <span style={styles.sectionIcon}>📍</span>
          כתובת
        </div>
        <div style={styles.address}>
          {data.street}, {data.city} {data.zipCode}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div style={styles.actions}>
        <button style={styles.actionButton}>
          <span>📋</span> היסטוריה רפואית
        </button>
        <button style={styles.actionButton}>
          <span>💊</span> מרשמים
        </button>
        <button style={styles.actionButton}>
          <span>📅</span> תורים
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(145deg, #1e1e2e 0%, #151521 100%)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    margin: '16px 0'
  },
  
  header: {
    position: 'relative',
    padding: '24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  
  headerGradient: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  
  avatar: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'white',
    backdropFilter: 'blur(10px)',
    border: '2px solid rgba(255, 255, 255, 0.3)'
  },
  
  headerInfo: {
    flex: 1
  },
  
  name: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '700',
    color: 'white',
    marginBottom: '8px'
  },
  
  badges: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  
  idBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(255, 255, 255, 0.2)',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    color: 'white',
    backdropFilter: 'blur(10px)'
  },
  
  badgeIcon: {
    fontSize: '14px'
  },
  
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(46, 213, 115, 0.2)',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    color: '#2ed573'
  },
  
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#2ed573',
    animation: 'pulse 2s infinite'
  },
  
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    padding: '24px'
  },
  
  infoCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05)',
      transform: 'translateY(-2px)'
    }
  },
  
  infoIcon: {
    fontSize: '24px',
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
  },
  
  infoLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: '4px'
  },
  
  infoValue: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500'
  },
  
  addressSection: {
    padding: '0 24px 24px',
  },
  
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '12px'
  },
  
  sectionIcon: {
    fontSize: '16px'
  },
  
  address: {
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '14px',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  actions: {
    display: 'flex',
    gap: '12px',
    padding: '16px 24px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  actionButton: {
    flex: 1,
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.08)',
      transform: 'translateY(-1px)'
    }
  }
};

export default PatientCard;