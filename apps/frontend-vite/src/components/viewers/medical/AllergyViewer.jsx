import React, { useState, useEffect } from 'react';
import secureApiClient from '../../../services/secureApiClient';

const AllergyViewer = ({ patientId, patientName, language }) => {
  const isRTL = language === 'he';
  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAllergies();
  }, [patientId]);
  
  const fetchAllergies = async () => {
    try {
      const practiceSubdomain = window.location.hostname.split('.')[0];
      
      const response = await secureApiClient.get(
        `/api/medical-data/patients/${patientId}/allergies`,
        {
          headers: {
            'X-Practice-Subdomain': practiceSubdomain
          }
        }
      );
      
      setAllergies(response.data || []);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error fetching allergies:', error);
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
    alertBox: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '2px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      padding: '20px',
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
    allergyGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '16px'
    },
    allergyCard: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(74, 158, 255, 0.2)',
      position: 'relative'
    },
    severityBadge: {
      position: 'absolute',
      top: '20px',
      right: isRTL ? 'auto' : '20px',
      left: isRTL ? '20px' : 'auto',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'uppercase'
    },
    severityHigh: {
      background: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444',
      border: '1px solid rgba(239, 68, 68, 0.3)'
    },
    severityMedium: {
      background: 'rgba(251, 191, 36, 0.2)',
      color: '#fbbf24',
      border: '1px solid rgba(251, 191, 36, 0.3)'
    },
    severityLow: {
      background: 'rgba(52, 211, 153, 0.2)',
      color: '#34d399',
      border: '1px solid rgba(52, 211, 153, 0.3)'
    },
    allergenName: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#4a9eff',
      marginBottom: '12px'
    },
    allergyDetail: {
      marginBottom: '8px',
      fontSize: '14px',
      color: '#e8eaf0'
    },
    detailLabel: {
      color: '#8b949e',
      marginRight: '8px'
    },
    symptomsList: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginTop: '8px'
    },
    symptomChip: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      borderRadius: '16px',
      padding: '4px 12px',
      fontSize: '13px',
      color: '#4a9eff'
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
      marginBottom: '8px',
      color: '#34d399'
    },
    noteBox: {
      background: 'rgba(30, 41, 59, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '12px',
      fontSize: '13px',
      color: '#a8b2d1',
      fontStyle: 'italic'
    }
  };
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  const getSeverityStyle = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'severe':
      case 'life-threatening':
        return styles.severityHigh;
      case 'medium':
      case 'moderate':
        return styles.severityMedium;
      case 'low':
      case 'mild':
        return styles.severityLow;
      default:
        return styles.severityMedium;
    }
  };
  
  // Mock data for demonstration
  const mockAllergies = [
    {
      _id: '1',
      allergen: 'Penicillin',
      severity: 'high',
      type: 'Medication',
      reaction: 'Anaphylaxis',
      symptoms: ['Hives', 'Difficulty breathing', 'Swelling'],
      firstObserved: new Date(2020, 5, 15),
      notes: 'Severe reaction requiring emergency treatment'
    },
    {
      _id: '2',
      allergen: 'Peanuts',
      severity: 'medium',
      type: 'Food',
      reaction: 'Allergic reaction',
      symptoms: ['Itching', 'Rash', 'Mild swelling'],
      firstObserved: new Date(2018, 2, 10),
      notes: 'Avoid all peanut products'
    },
    {
      _id: '3',
      allergen: 'Latex',
      severity: 'low',
      type: 'Contact',
      reaction: 'Contact dermatitis',
      symptoms: ['Skin redness', 'Itching'],
      firstObserved: new Date(2022, 8, 20),
      notes: 'Use latex-free gloves for procedures'
    }
  ];
  
  const displayAllergies = allergies.length > 0 ? allergies : mockAllergies;
  const hasHighSeverity = displayAllergies.some(a => a.severity?.toLowerCase() === 'high' || a.severity?.toLowerCase() === 'severe');
  
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⏳</div>
          <div style={styles.emptyText}>
            {isRTL ? 'טוען אלרגיות...' : 'Loading allergies...'}
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
          🚨 {isRTL ? 'אלרגיות' : 'Allergies'}
        </h2>
        <div style={styles.subtitle}>
          {patientName && `${isRTL ? 'מטופל:' : 'Patient:'} ${patientName}`}
          {displayAllergies.length > 0 && ` • ${displayAllergies.length} ${isRTL ? 'אלרגיות רשומות' : 'recorded allergies'}`}
        </div>
      </div>
      
      {/* Critical Alert if high severity allergies exist */}
      {hasHighSeverity && (
        <div style={styles.alertBox}>
          <div style={styles.alertTitle}>
            ⚠️ {isRTL ? 'אזהרה: אלרגיות חמורות' : 'Warning: Severe Allergies'}
          </div>
          <div style={{ color: '#ef4444', fontSize: '14px' }}>
            {isRTL 
              ? 'למטופל זה יש אלרגיות מסכנות חיים. יש לנקוט משנה זהירות בעת מתן תרופות או טיפולים.'
              : 'This patient has life-threatening allergies. Exercise extreme caution when prescribing medications or treatments.'}
          </div>
        </div>
      )}
      
      {/* Allergies List */}
      {displayAllergies.length > 0 ? (
        <div style={styles.allergyGrid}>
          {displayAllergies.map((allergy) => (
            <div key={allergy._id} style={styles.allergyCard}>
              {/* Severity Badge */}
              <div style={{ ...styles.severityBadge, ...getSeverityStyle(allergy.severity) }}>
                {allergy.severity || 'Unknown'}
              </div>
              
              {/* Allergen Name */}
              <div style={styles.allergenName}>
                {allergy.allergen}
              </div>
              
              {/* Allergy Details */}
              {allergy.type && (
                <div style={styles.allergyDetail}>
                  <span style={styles.detailLabel}>{isRTL ? 'סוג:' : 'Type:'}</span>
                  {allergy.type}
                </div>
              )}
              
              {allergy.reaction && (
                <div style={styles.allergyDetail}>
                  <span style={styles.detailLabel}>{isRTL ? 'תגובה:' : 'Reaction:'}</span>
                  {allergy.reaction}
                </div>
              )}
              
              {allergy.firstObserved && (
                <div style={styles.allergyDetail}>
                  <span style={styles.detailLabel}>{isRTL ? 'נצפה לראשונה:' : 'First Observed:'}</span>
                  {formatDate(allergy.firstObserved)}
                </div>
              )}
              
              {/* Symptoms */}
              {allergy.symptoms && allergy.symptoms.length > 0 && (
                <div style={styles.allergyDetail}>
                  <span style={styles.detailLabel}>{isRTL ? 'תסמינים:' : 'Symptoms:'}</span>
                  <div style={styles.symptomsList}>
                    {allergy.symptoms.map((symptom, index) => (
                      <span key={index} style={styles.symptomChip}>
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Notes */}
              {allergy.notes && (
                <div style={styles.noteBox}>
                  {allergy.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>✅</div>
          <div style={styles.emptyText}>
            {isRTL ? 'אין אלרגיות ידועות' : 'No known allergies'}
          </div>
        </div>
      )}
    </div>
  );
};

export default AllergyViewer;