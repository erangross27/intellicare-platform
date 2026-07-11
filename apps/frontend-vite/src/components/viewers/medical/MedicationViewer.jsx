import React, { useState, useEffect } from 'react';
import secureApiClient from '../../../services/secureApiClient';

const MedicationViewer = ({ patientId, patientName, language }) => {
  const isRTL = language === 'he';
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'active', 'discontinued', 'all'
  
  useEffect(() => {
    fetchMedications();
  }, [patientId]);
  
  const fetchMedications = async () => {
    try {
      const practiceSubdomain = window.location.hostname.split('.')[0];
      
      const response = await secureApiClient.get(
        `/api/medical-data/patients/${patientId}/medications`,
        {
          headers: {
            'X-Practice-Subdomain': practiceSubdomain
          }
        }
      );
      
      setMedications(response.data || []);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error fetching medications:', error);
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
    filterButtons: {
      display: 'flex',
      gap: '8px',
      marginBottom: '20px'
    },
    filterButton: {
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
    filterButtonActive: {
      background: 'rgba(74, 158, 255, 0.2)',
      border: '1px solid rgba(74, 158, 255, 0.4)',
      color: '#4a9eff'
    },
    medicationGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
      gap: '16px'
    },
    medicationCard: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(74, 158, 255, 0.2)',
      position: 'relative'
    },
    medicationHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '16px'
    },
    medicationName: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#4a9eff',
      marginBottom: '4px'
    },
    genericName: {
      fontSize: '13px',
      color: '#8b949e',
      fontStyle: 'italic'
    },
    statusBadge: {
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase'
    },
    statusActive: {
      background: 'rgba(52, 211, 153, 0.2)',
      color: '#34d399'
    },
    statusDiscontinued: {
      background: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444'
    },
    statusPaused: {
      background: 'rgba(251, 191, 36, 0.2)',
      color: '#fbbf24'
    },
    dosageSection: {
      background: 'rgba(30, 41, 59, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '12px'
    },
    dosageTitle: {
      fontSize: '12px',
      color: '#8b949e',
      marginBottom: '6px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    dosageInfo: {
      fontSize: '16px',
      color: '#ffffff',
      fontWeight: 500
    },
    detailRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '8px',
      fontSize: '14px'
    },
    detailLabel: {
      color: '#8b949e'
    },
    detailValue: {
      color: '#e8eaf0'
    },
    instructionBox: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '12px'
    },
    instructionTitle: {
      fontSize: '13px',
      color: '#4a9eff',
      fontWeight: 600,
      marginBottom: '6px'
    },
    instructionText: {
      fontSize: '13px',
      color: '#e8eaf0',
      lineHeight: '1.5'
    },
    warningBox: {
      background: 'rgba(251, 191, 36, 0.1)',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '12px'
    },
    warningTitle: {
      fontSize: '13px',
      color: '#fbbf24',
      fontWeight: 600,
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    warningText: {
      fontSize: '13px',
      color: '#fbbf24'
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
    refillIndicator: {
      marginTop: '12px',
      padding: '8px',
      background: 'rgba(239, 68, 68, 0.1)',
      borderRadius: '6px',
      fontSize: '12px',
      color: '#ef4444',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }
  };
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  // Mock data for demonstration
  const mockMedications = [
    {
      _id: '1',
      name: 'Metformin',
      genericName: 'Metformin HCl',
      dosage: '500mg',
      frequency: 'Twice daily',
      route: 'Oral',
      status: 'active',
      startDate: new Date(2023, 0, 15),
      prescribedBy: 'Dr. Cohen',
      purpose: 'Type 2 Diabetes',
      instructions: 'Take with meals to reduce stomach upset',
      sideEffects: ['Nausea', 'Diarrhea', 'Stomach pain'],
      quantity: 60,
      refills: 2,
      refillsRemaining: 1,
      lastRefill: new Date(2024, 0, 15),
      nextRefillDue: new Date(2024, 1, 15)
    },
    {
      _id: '2',
      name: 'Lisinopril',
      genericName: 'Lisinopril',
      dosage: '10mg',
      frequency: 'Once daily',
      route: 'Oral',
      status: 'active',
      startDate: new Date(2023, 3, 20),
      prescribedBy: 'Dr. Cohen',
      purpose: 'Hypertension',
      instructions: 'Take in the morning',
      warnings: ['May cause dizziness', 'Avoid potassium supplements'],
      quantity: 30,
      refills: 3,
      refillsRemaining: 2
    },
    {
      _id: '3',
      name: 'Atorvastatin',
      genericName: 'Atorvastatin Calcium',
      dosage: '20mg',
      frequency: 'Once daily at bedtime',
      route: 'Oral',
      status: 'active',
      startDate: new Date(2023, 6, 10),
      prescribedBy: 'Dr. Levy',
      purpose: 'High Cholesterol',
      instructions: 'Take at bedtime for best results',
      foodInteractions: ['Avoid grapefruit juice'],
      quantity: 30,
      refills: 5,
      refillsRemaining: 4
    },
    {
      _id: '4',
      name: 'Amoxicillin',
      genericName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Three times daily',
      route: 'Oral',
      status: 'discontinued',
      startDate: new Date(2023, 11, 1),
      endDate: new Date(2023, 11, 10),
      prescribedBy: 'Dr. Cohen',
      purpose: 'Bacterial Infection',
      discontinuedReason: 'Course completed'
    }
  ];
  
  const displayMedications = medications.length > 0 ? medications : mockMedications;
  
  // Filter medications
  const filteredMedications = displayMedications.filter(med => {
    if (filter === 'all') return true;
    if (filter === 'active') return med.status === 'active';
    if (filter === 'discontinued') return med.status === 'discontinued' || med.status === 'paused';
    return true;
  });
  
  const activeMedsCount = displayMedications.filter(m => m.status === 'active').length;
  const discontinuedMedsCount = displayMedications.filter(m => m.status === 'discontinued').length;
  
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⏳</div>
          <div style={styles.emptyText}>
            {isRTL ? 'טוען תרופות...' : 'Loading medications...'}
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
          💊 {isRTL ? 'תרופות' : 'Medications'}
        </h2>
        <div style={styles.subtitle}>
          {patientName && `${isRTL ? 'מטופל:' : 'Patient:'} ${patientName}`}
          {` • ${activeMedsCount} ${isRTL ? 'פעילות' : 'active'}`}
          {discontinuedMedsCount > 0 && ` • ${discontinuedMedsCount} ${isRTL ? 'הופסקו' : 'discontinued'}`}
        </div>
      </div>
      
      {/* Filter Buttons */}
      <div style={styles.filterButtons}>
        <button
          style={{
            ...styles.filterButton,
            ...(filter === 'active' ? styles.filterButtonActive : {})
          }}
          onClick={() => setFilter('active')}
        >
          {isRTL ? 'פעילות' : 'Active'} ({activeMedsCount})
        </button>
        <button
          style={{
            ...styles.filterButton,
            ...(filter === 'discontinued' ? styles.filterButtonActive : {})
          }}
          onClick={() => setFilter('discontinued')}
        >
          {isRTL ? 'הופסקו' : 'Discontinued'} ({discontinuedMedsCount})
        </button>
        <button
          style={{
            ...styles.filterButton,
            ...(filter === 'all' ? styles.filterButtonActive : {})
          }}
          onClick={() => setFilter('all')}
        >
          {isRTL ? 'הכל' : 'All'} ({displayMedications.length})
        </button>
      </div>
      
      {/* Medications Grid */}
      {filteredMedications.length > 0 ? (
        <div style={styles.medicationGrid}>
          {filteredMedications.map((med) => (
            <div key={med._id} style={styles.medicationCard}>
              {/* Header */}
              <div style={styles.medicationHeader}>
                <div>
                  <div style={styles.medicationName}>{med.name}</div>
                  {med.genericName && (
                    <div style={styles.genericName}>{med.genericName}</div>
                  )}
                </div>
                <div style={{
                  ...styles.statusBadge,
                  ...(med.status === 'active' ? styles.statusActive : 
                      med.status === 'discontinued' ? styles.statusDiscontinued : 
                      styles.statusPaused)
                }}>
                  {med.status}
                </div>
              </div>
              
              {/* Dosage Section */}
              <div style={styles.dosageSection}>
                <div style={styles.dosageTitle}>{isRTL ? 'מינון' : 'Dosage'}</div>
                <div style={styles.dosageInfo}>
                  {med.dosage} • {med.frequency}
                </div>
                {med.route && (
                  <div style={{ fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>
                    {isRTL ? 'דרך מתן:' : 'Route:'} {med.route}
                  </div>
                )}
              </div>
              
              {/* Details */}
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>{isRTL ? 'מטרה:' : 'Purpose:'}</span>
                <span style={styles.detailValue}>{med.purpose || '-'}</span>
              </div>
              
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>{isRTL ? 'רופא מטפל:' : 'Prescribed by:'}</span>
                <span style={styles.detailValue}>{med.prescribedBy || '-'}</span>
              </div>
              
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>{isRTL ? 'תאריך התחלה:' : 'Start date:'}</span>
                <span style={styles.detailValue}>{formatDate(med.startDate)}</span>
              </div>
              
              {med.endDate && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>{isRTL ? 'תאריך סיום:' : 'End date:'}</span>
                  <span style={styles.detailValue}>{formatDate(med.endDate)}</span>
                </div>
              )}
              
              {/* Refill Information */}
              {med.refillsRemaining !== undefined && med.status === 'active' && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>{isRTL ? 'מילויים נותרים:' : 'Refills remaining:'}</span>
                  <span style={styles.detailValue}>{med.refillsRemaining} / {med.refills}</span>
                </div>
              )}
              
              {/* Instructions */}
              {med.instructions && (
                <div style={styles.instructionBox}>
                  <div style={styles.instructionTitle}>
                    {isRTL ? 'הוראות' : 'Instructions'}
                  </div>
                  <div style={styles.instructionText}>
                    {med.instructions}
                  </div>
                </div>
              )}
              
              {/* Warnings */}
              {(med.warnings || med.sideEffects || med.foodInteractions) && (
                <div style={styles.warningBox}>
                  <div style={styles.warningTitle}>
                    ⚠️ {isRTL ? 'אזהרות' : 'Warnings'}
                  </div>
                  <div style={styles.warningText}>
                    {med.warnings && med.warnings.map((w, i) => (
                      <div key={i}>• {w}</div>
                    ))}
                    {med.sideEffects && med.sideEffects.map((s, i) => (
                      <div key={i}>• {isRTL ? 'תופעת לוואי:' : 'Side effect:'} {s}</div>
                    ))}
                    {med.foodInteractions && med.foodInteractions.map((f, i) => (
                      <div key={i}>• {f}</div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Refill Alert */}
              {med.refillsRemaining === 1 && med.status === 'active' && (
                <div style={styles.refillIndicator}>
                  ⚠️ {isRTL ? 'נותר מילוי אחד בלבד' : 'Only 1 refill remaining'}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>💊</div>
          <div style={styles.emptyText}>
            {filter === 'active' 
              ? (isRTL ? 'אין תרופות פעילות' : 'No active medications')
              : filter === 'discontinued'
              ? (isRTL ? 'אין תרופות שהופסקו' : 'No discontinued medications')
              : (isRTL ? 'אין תרופות רשומות' : 'No medications recorded')}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationViewer;