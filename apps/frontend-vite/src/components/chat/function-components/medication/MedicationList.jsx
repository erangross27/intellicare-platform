import React, { useState } from 'react';

const MedicationList = ({ data, config, language = 'he', onAction }) => {
  const [expandedMeds, setExpandedMeds] = useState(new Set());
  const [filter, setFilter] = useState('all'); // all, active, discontinued
  
  const medications = data.medications || data.drugs || data || [];
  const isRTL = language === 'he';
  
  const labels = {
    he: {
      title: 'רשימת תרופות',
      medication: 'תרופה',
      dosage: 'מינון',
      frequency: 'תדירות',
      status: 'סטטוס',
      startDate: 'התחלה',
      endDate: 'סיום',
      prescriber: 'רושם',
      active: 'פעיל',
      discontinued: 'הופסק',
      paused: 'מושהה',
      completed: 'הושלם',
      filterAll: 'כל התרופות',
      filterActive: 'תרופות פעילות',
      filterDiscontinued: 'תרופות שהופסקו',
      refill: 'חידוש מרשם',
      discontinue: 'הפסק',
      edit: 'עריכה',
      interactions: 'אינטראקציות',
      adherence: 'היענות',
      instructions: 'הוראות נטילה',
      sideEffects: 'תופעות לוואי',
      notes: 'הערות',
      morning: 'בוקר',
      noon: 'צהריים',
      evening: 'ערב',
      night: 'לילה',
      beforeMeals: 'לפני האוכל',
      withMeals: 'עם האוכל',
      afterMeals: 'אחרי האוכל',
      asNeeded: 'לפי הצורך',
      noMedications: 'אין תרופות',
      daysLeft: 'ימים נותרו',
      refillNeeded: 'נדרש חידוש',
      goodAdherence: 'היענות טובה',
      poorAdherence: 'היענות נמוכה'
    },
    en: {
      title: 'Medications',
      medication: 'Medication',
      dosage: 'Dosage',
      frequency: 'Frequency',
      status: 'Status',
      startDate: 'Start Date',
      endDate: 'End Date',
      prescriber: 'Prescriber',
      active: 'Active',
      discontinued: 'Discontinued',
      paused: 'Paused',
      completed: 'Completed',
      filterAll: 'All Medications',
      filterActive: 'Active Medications',
      filterDiscontinued: 'Discontinued',
      refill: 'Refill',
      discontinue: 'Discontinue',
      edit: 'Edit',
      interactions: 'Interactions',
      adherence: 'Adherence',
      instructions: 'Instructions',
      sideEffects: 'Side Effects',
      notes: 'Notes',
      morning: 'Morning',
      noon: 'Noon',
      evening: 'Evening',
      night: 'Night',
      beforeMeals: 'Before meals',
      withMeals: 'With meals',
      afterMeals: 'After meals',
      asNeeded: 'As needed',
      noMedications: 'No medications',
      daysLeft: 'days left',
      refillNeeded: 'Refill needed',
      goodAdherence: 'Good adherence',
      poorAdherence: 'Poor adherence'
    }
  };
  
  const t = labels[language] || labels.en;
  
  // Get status color
  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'discontinued':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'paused':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'completed':
        return { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' };
      default:
        return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' };
    }
  };
  
  // Calculate days until refill
  const getDaysUntilRefill = (endDate, pillsLeft, dailyDose) => {
    if (pillsLeft && dailyDose) {
      return Math.floor(pillsLeft / dailyDose);
    }
    if (endDate) {
      const days = Math.floor((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
      return days;
    }
    return null;
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US');
  };
  
  // Filter medications
  const filteredMedications = medications.filter(med => {
    if (filter === 'all') return true;
    if (filter === 'active') return med.status === 'active';
    if (filter === 'discontinued') return med.status === 'discontinued';
    return true;
  });
  
  if (medications.length === 0) {
    return (
      <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={styles.noMeds}>
          <span style={styles.noMedsIcon}>💊</span>
          <p>{t.noMedications}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>{t.title}</h3>
        <div style={styles.filters}>
          <button
            style={{ ...styles.filterBtn, ...(filter === 'all' && styles.filterActive) }}
            onClick={() => setFilter('all')}
          >
            {t.filterAll} ({medications.length})
          </button>
          <button
            style={{ ...styles.filterBtn, ...(filter === 'active' && styles.filterActive) }}
            onClick={() => setFilter('active')}
          >
            {t.filterActive} ({medications.filter(m => m.status === 'active').length})
          </button>
          <button
            style={{ ...styles.filterBtn, ...(filter === 'discontinued' && styles.filterActive) }}
            onClick={() => setFilter('discontinued')}
          >
            {t.filterDiscontinued} ({medications.filter(m => m.status === 'discontinued').length})
          </button>
        </div>
      </div>
      
      {/* Medications Grid */}
      <div style={styles.medsGrid}>
        {filteredMedications.map((med, index) => {
          const isExpanded = expandedMeds.has(index);
          const statusStyle = getStatusStyle(med.status);
          const daysLeft = getDaysUntilRefill(med.endDate, med.pillsLeft, med.dailyDose);
          const needsRefill = daysLeft !== null && daysLeft < 7;
          
          return (
            <div key={index} style={styles.medCard}>
              {/* Card Header */}
              <div 
                style={styles.cardHeader}
                onClick={() => {
                  const newExpanded = new Set(expandedMeds);
                  if (newExpanded.has(index)) {
                    newExpanded.delete(index);
                  } else {
                    newExpanded.add(index);
                  }
                  setExpandedMeds(newExpanded);
                }}
              >
                <div style={styles.medInfo}>
                  <h4 style={styles.medName}>
                    {med.name || med.medication}
                    {med.genericName && (
                      <span style={styles.genericName}> ({med.genericName})</span>
                    )}
                  </h4>
                  <div style={styles.dosageInfo}>
                    <span style={styles.dosage}>{med.dosage}</span>
                    <span style={styles.separator}>•</span>
                    <span style={styles.frequency}>{med.frequency}</span>
                  </div>
                </div>
                
                <div style={styles.statusContainer}>
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.color
                  }}>
                    {t[med.status] || med.status}
                  </span>
                  {needsRefill && (
                    <span style={styles.refillBadge}>
                      ⚠️ {t.refillNeeded}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Quick Info */}
              <div style={styles.quickInfo}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>{t.startDate}:</span>
                  <span>{formatDate(med.startDate)}</span>
                </div>
                {med.endDate && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>{t.endDate}:</span>
                    <span>{formatDate(med.endDate)}</span>
                  </div>
                )}
                {daysLeft !== null && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>{t.daysLeft}:</span>
                    <span style={{ 
                      color: needsRefill ? '#ef4444' : '#10b981',
                      fontWeight: needsRefill ? 'bold' : 'normal'
                    }}>
                      {daysLeft}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Expanded Details */}
              {isExpanded && (
                <div style={styles.expandedSection}>
                  {med.instructions && (
                    <div style={styles.detailBlock}>
                      <h5 style={styles.detailTitle}>{t.instructions}</h5>
                      <p style={styles.detailText}>{med.instructions}</p>
                    </div>
                  )}
                  
                  {med.prescriber && (
                    <div style={styles.detailBlock}>
                      <h5 style={styles.detailTitle}>{t.prescriber}</h5>
                      <p style={styles.detailText}>{med.prescriber}</p>
                    </div>
                  )}
                  
                  {med.sideEffects && (
                    <div style={styles.detailBlock}>
                      <h5 style={styles.detailTitle}>{t.sideEffects}</h5>
                      <p style={styles.detailText}>{med.sideEffects}</p>
                    </div>
                  )}
                  
                  {med.adherence !== undefined && (
                    <div style={styles.detailBlock}>
                      <h5 style={styles.detailTitle}>{t.adherence}</h5>
                      <div style={styles.adherenceBar}>
                        <div style={{
                          ...styles.adherenceFill,
                          width: `${med.adherence}%`,
                          backgroundColor: med.adherence > 80 ? '#10b981' : '#f59e0b'
                        }} />
                      </div>
                      <span style={styles.adherenceText}>
                        {med.adherence}% - {med.adherence > 80 ? t.goodAdherence : t.poorAdherence}
                      </span>
                    </div>
                  )}
                  
                  {med.notes && (
                    <div style={styles.detailBlock}>
                      <h5 style={styles.detailTitle}>{t.notes}</h5>
                      <p style={styles.detailText}>{med.notes}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Actions */}
              <div style={styles.actions}>
                {med.status === 'active' && (
                  <>
                    <button
                      style={styles.actionBtn}
                      onClick={() => onAction('refill', med)}
                    >
                      🔄 {t.refill}
                    </button>
                    <button
                      style={styles.actionBtn}
                      onClick={() => onAction('discontinue', med)}
                    >
                      ⏹️ {t.discontinue}
                    </button>
                  </>
                )}
                <button
                  style={styles.actionBtn}
                  onClick={() => onAction('edit', med)}
                >
                  ✏️ {t.edit}
                </button>
                <button
                  style={styles.actionBtn}
                  onClick={() => onAction('interactions', med)}
                >
                  ⚠️ {t.interactions}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    color: '#e3e3e8'
  },
  
  header: {
    marginBottom: '20px'
  },
  
  title: {
    margin: '0 0 12px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#e3e3e8'
  },
  
  filters: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  
  filterBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: '#e3e3e8',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  
  filterActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    color: '#10b981'
  },
  
  medsGrid: {
    display: 'grid',
    gap: '16px',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'
  },
  
  medCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden'
  },
  
  cardHeader: {
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  medInfo: {
    flex: 1
  },
  
  medName: {
    margin: '0 0 4px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#e3e3e8'
  },
  
  genericName: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: 'normal'
  },
  
  dosageInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  
  dosage: {
    fontWeight: '500'
  },
  
  separator: {
    color: 'rgba(255, 255, 255, 0.3)'
  },
  
  frequency: {
    fontStyle: 'italic'
  },
  
  statusContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'flex-end'
  },
  
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500'
  },
  
  refillBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  },
  
  quickInfo: {
    padding: '12px 16px',
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    fontSize: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  infoItem: {
    display: 'flex',
    gap: '6px'
  },
  
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  expandedSection: {
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  detailBlock: {
    marginBottom: '12px'
  },
  
  detailTitle: {
    margin: '0 0 4px 0',
    fontSize: '12px',
    fontWeight: '600',
    color: '#10b981'
  },
  
  detailText: {
    margin: 0,
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: '1.5'
  },
  
  adherenceBar: {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '4px'
  },
  
  adherenceFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s'
  },
  
  adherenceText: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  
  actions: {
    padding: '12px 16px',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  
  actionBtn: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: '#e3e3e8',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  noMeds: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  noMedsIcon: {
    fontSize: '48px',
    opacity: 0.3,
    display: 'block',
    marginBottom: '16px'
  }
};

export default MedicationList;