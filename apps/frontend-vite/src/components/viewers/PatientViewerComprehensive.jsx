import React, { useState, useEffect } from 'react';
import LabResultsViewer from './LabResultsViewer';
import MedicationTracker from './MedicationTracker';
import DocumentViewer from './documents/DocumentViewer';

const PatientViewerComprehensive = ({ patient, language, mode = 'view' }) => {
  const isRTL = language === 'he';
  const [activeTab, setActiveTab] = useState('overview');
  const [medicalData, setMedicalData] = useState({
    generalHistory: [],
    surgicalHistory: [],
    medications: [],
    allergies: [],
    vaccinations: [],
    labResults: [],
    imaging: [],
    documents: [],
    vitalSigns: []
  });
  
  // Handle various patient data structures
  const patientData = patient?.patient || patient?.data || patient || {};
  
  // Extract medical history categories from patient data
  useEffect(() => {
    if (patientData.medicalHistory && Array.isArray(patientData.medicalHistory)) {
      // Group medical history by category
      const categorizedData = {
        generalHistory: [],
        surgicalHistory: [],
        medications: [],
        allergies: [],
        vaccinations: [],
        labResults: [],
        imaging: [],
        documents: [],
        vitalSigns: []
      };
      
      patientData.medicalHistory.forEach(entry => {
        const category = entry.category || 'generalHistory';
        switch(category) {
          case 'lab_results':
            categorizedData.labResults.push(entry);
            break;
          case 'prescriptions':
          case 'medications':
            categorizedData.medications.push(entry);
            break;
          case 'imaging_reports':
            categorizedData.imaging.push(entry);
            break;
          case 'vaccination_records':
            categorizedData.vaccinations.push(entry);
            break;
          case 'medical_procedures':
            categorizedData.surgicalHistory.push(entry);
            break;
          case 'consultation_notes':
          case 'discharge_summary':
          case 'referrals':
            categorizedData.generalHistory.push(entry);
            break;
          default:
            if (entry.documentId) {
              categorizedData.documents.push(entry);
            } else {
              categorizedData.generalHistory.push(entry);
            }
        }
      });
      
      setMedicalData(categorizedData);
    }
  }, [patientData]);
  
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
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      marginBottom: '24px',
      paddingBottom: '20px',
      borderBottom: '2px solid rgba(74, 158, 255, 0.2)'
    },
    avatar: {
      width: '72px',
      height: '72px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #4a9eff, #667eea)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '28px',
      fontWeight: 600,
      color: 'white',
      boxShadow: '0 4px 16px rgba(74, 158, 255, 0.3)',
      flexShrink: 0
    },
    nameSection: {
      flex: 1
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '26px',
      fontWeight: 600,
      color: '#ffffff'
    },
    subtitle: {
      fontSize: '14px',
      color: '#a8b2d1',
      display: 'flex',
      gap: '16px',
      alignItems: 'center'
    },
    tabs: {
      display: 'flex',
      gap: '4px',
      marginBottom: '24px',
      borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
      paddingBottom: '0',
      flexWrap: 'wrap'
    },
    tab: {
      padding: '10px 16px',
      background: 'transparent',
      border: 'none',
      color: '#8b949e',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      borderBottom: '2px solid transparent',
      fontFamily: 'inherit',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    tabActive: {
      color: '#4a9eff',
      borderBottom: '2px solid #4a9eff'
    },
    badge: {
      background: 'rgba(74, 158, 255, 0.2)',
      color: '#4a9eff',
      padding: '2px 6px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 600,
      minWidth: '20px',
      textAlign: 'center'
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '16px'
    },
    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    },
    label: {
      fontSize: '12px',
      color: '#8b949e',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    value: {
      fontSize: '15px',
      color: '#e8eaf0',
      padding: '10px 14px',
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '8px',
      border: '1px solid transparent'
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
    statsCard: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid rgba(74, 158, 255, 0.1)',
      textAlign: 'center'
    },
    statsNumber: {
      fontSize: '28px',
      fontWeight: 600,
      color: '#4a9eff',
      marginBottom: '4px'
    },
    statsLabel: {
      fontSize: '13px',
      color: '#8b949e'
    }
  };
  
  // Calculate age
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return '';
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  // Medical category tabs with counts
  const medicalTabs = [
    { key: 'overview', label: isRTL ? 'סקירה' : 'Overview', icon: '👤' },
    { key: 'general', label: isRTL ? 'היסטוריה כללית' : 'General History', icon: '📋', count: medicalData.generalHistory.length },
    { key: 'surgical', label: isRTL ? 'ניתוחים' : 'Surgeries', icon: '🏥', count: medicalData.surgicalHistory.length },
    { key: 'medications', label: isRTL ? 'תרופות' : 'Medications', icon: '💊', count: medicalData.medications.length },
    { key: 'allergies', label: isRTL ? 'אלרגיות' : 'Allergies', icon: '🚨', count: medicalData.allergies.length },
    { key: 'vaccinations', label: isRTL ? 'חיסונים' : 'Vaccinations', icon: '💉', count: medicalData.vaccinations.length },
    { key: 'lab', label: isRTL ? 'בדיקות מעבדה' : 'Lab Results', icon: '🔬', count: medicalData.labResults.length },
    { key: 'imaging', label: isRTL ? 'הדמיה' : 'Imaging', icon: '🩻', count: medicalData.imaging.length },
    { key: 'documents', label: isRTL ? 'מסמכים' : 'Documents', icon: '📄', count: medicalData.documents.length },
    { key: 'vitals', label: isRTL ? 'סימנים חיוניים' : 'Vital Signs', icon: '📊', count: medicalData.vitalSigns.length }
  ];
  
  // Render overview tab
  const renderOverview = () => (
    <>
      {/* Basic Information */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          📋 {isRTL ? 'מידע בסיסי' : 'Basic Information'}
        </h3>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>{isRTL ? 'שם מלא' : 'Full Name'}</label>
            <div style={styles.value}>
              {patientData.firstName} {patientData.lastName}
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{isRTL ? 'תעודת זהות' : 'ID Number'}</label>
            <div style={styles.value}>
              {patientData.nationalId || patientData.socialSecurityNumber || '-'}
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{isRTL ? 'תאריך לידה' : 'Date of Birth'}</label>
            <div style={styles.value}>
              {formatDate(patientData.dateOfBirth)} ({calculateAge(patientData.dateOfBirth)} {isRTL ? 'שנים' : 'years'})
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{isRTL ? 'טלפון' : 'Phone'}</label>
            <div style={styles.value}>
              {patientData.phone || '-'}
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{isRTL ? 'אימייל' : 'Email'}</label>
            <div style={styles.value}>
              {patientData.email || '-'}
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{isRTL ? 'קופת חולים' : 'Health Fund'}</label>
            <div style={styles.value}>
              {patientData.healthFund || patientData.insuranceProvider || '-'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Medical Summary Statistics */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          📊 {isRTL ? 'סיכום רפואי' : 'Medical Summary'}
        </h3>
        <div style={styles.grid}>
          <div style={styles.statsCard}>
            <div style={styles.statsNumber}>{medicalData.generalHistory.length}</div>
            <div style={styles.statsLabel}>{isRTL ? 'ביקורים' : 'Visits'}</div>
          </div>
          <div style={styles.statsCard}>
            <div style={styles.statsNumber}>{medicalData.medications.length}</div>
            <div style={styles.statsLabel}>{isRTL ? 'תרופות פעילות' : 'Active Medications'}</div>
          </div>
          <div style={styles.statsCard}>
            <div style={styles.statsNumber}>{medicalData.labResults.length}</div>
            <div style={styles.statsLabel}>{isRTL ? 'בדיקות מעבדה' : 'Lab Tests'}</div>
          </div>
          <div style={styles.statsCard}>
            <div style={styles.statsNumber}>{medicalData.documents.length}</div>
            <div style={styles.statsLabel}>{isRTL ? 'מסמכים' : 'Documents'}</div>
          </div>
        </div>
      </div>
      
      {/* Recent Activity */}
      {patientData.lastDocumentUpload && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            🕐 {isRTL ? 'פעילות אחרונה' : 'Recent Activity'}
          </h3>
          <div style={{ fontSize: '14px', color: '#a8b2d1' }}>
            {isRTL ? 'מסמך אחרון הועלה:' : 'Last document uploaded:'} {formatDate(patientData.lastDocumentUpload)}
          </div>
        </div>
      )}
    </>
  );
  
  // Render category content
  const renderCategoryContent = (category) => {
    const data = medicalData[category];
    
    if (!data || data.length === 0) {
      return (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            {category === 'medications' ? '💊' :
             category === 'allergies' ? '🚨' :
             category === 'vaccinations' ? '💉' :
             category === 'labResults' ? '🔬' :
             category === 'imaging' ? '🩻' :
             category === 'documents' ? '📄' :
             category === 'vitalSigns' ? '📊' :
             category === 'surgicalHistory' ? '🏥' : '📋'}
          </div>
          <div style={styles.emptyText}>
            {isRTL ? `אין ${getCategoryNameHebrew(category)}` : `No ${category.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
          </div>
        </div>
      );
    }
    
    // For complex viewers, use dedicated components
    if (category === 'labResults') {
      return <LabResultsViewer patientId={patientData._id} language={language} />;
    }
    
    if (category === 'medications') {
      return <MedicationTracker patientId={patientData._id} language={language} />;
    }
    
    // For other categories, render as list
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.map((item, index) => (
          <div key={index} style={styles.section}>
            <div style={{ marginBottom: '12px' }}>
              <strong>{formatDate(item.date || item.createdAt)}</strong>
              {item.category && (
                <span style={{ 
                  marginLeft: '12px', 
                  padding: '4px 8px', 
                  background: 'rgba(74, 158, 255, 0.2)',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  {item.category}
                </span>
              )}
            </div>
            {item.diagnosis && <div><strong>{isRTL ? 'אבחנה:' : 'Diagnosis:'}</strong> {item.diagnosis}</div>}
            {item.symptoms && <div><strong>{isRTL ? 'תסמינים:' : 'Symptoms:'}</strong> {item.symptoms}</div>}
            {item.treatment && <div><strong>{isRTL ? 'טיפול:' : 'Treatment:'}</strong> {item.treatment}</div>}
            {item.notes && <div><strong>{isRTL ? 'הערות:' : 'Notes:'}</strong> {item.notes}</div>}
          </div>
        ))}
      </div>
    );
  };
  
  // Helper function for Hebrew category names
  const getCategoryNameHebrew = (category) => {
    const names = {
      generalHistory: 'רשומות היסטוריה כללית',
      surgicalHistory: 'ניתוחים',
      medications: 'תרופות',
      allergies: 'אלרגיות',
      vaccinations: 'חיסונים',
      labResults: 'תוצאות מעבדה',
      imaging: 'בדיקות הדמיה',
      documents: 'מסמכים',
      vitalSigns: 'סימנים חיוניים'
    };
    return names[category] || category;
  };
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.avatar}>
          {(patientData.firstName?.[0] || '').toUpperCase()}
          {(patientData.lastName?.[0] || '').toUpperCase()}
        </div>
        <div style={styles.nameSection}>
          <h2 style={styles.title}>
            {patientData.firstName} {patientData.lastName}
          </h2>
          <div style={styles.subtitle}>
            <span>📅 {calculateAge(patientData.dateOfBirth)} {isRTL ? 'שנים' : 'years'}</span>
            <span>🆔 {patientData.nationalId || patientData.socialSecurityNumber || '-'}</span>
            <span>📞 {patientData.phone || '-'}</span>
          </div>
        </div>
      </div>
      
      {/* Medical Category Tabs */}
      <div style={styles.tabs}>
        {medicalTabs.map(tab => (
          <button
            key={tab.key}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span style={styles.badge}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'general' && renderCategoryContent('generalHistory')}
      {activeTab === 'surgical' && renderCategoryContent('surgicalHistory')}
      {activeTab === 'medications' && renderCategoryContent('medications')}
      {activeTab === 'allergies' && renderCategoryContent('allergies')}
      {activeTab === 'vaccinations' && renderCategoryContent('vaccinations')}
      {activeTab === 'lab' && renderCategoryContent('labResults')}
      {activeTab === 'imaging' && renderCategoryContent('imaging')}
      {activeTab === 'documents' && renderCategoryContent('documents')}
      {activeTab === 'vitals' && renderCategoryContent('vitalSigns')}
    </div>
  );
};

export default PatientViewerComprehensive;