import React from 'react';

const PatientCard = ({ data, config, language = 'he', onAction }) => {
  const patient = data.patient || data;
  const isRTL = language === 'he';
  
  // Calculate age from birthDate
  const calculateAge = (birthDate) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };
  
  // Format phone number
  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };
  
  const labels = {
    he: {
      personalInfo: 'פרטים אישיים',
      contactInfo: 'פרטי קשר',
      medicalInfo: 'מידע רפואי',
      id: 'ת.ז.',
      age: 'גיל',
      gender: 'מין',
      male: 'זכר',
      female: 'נקבה',
      phone: 'טלפון',
      email: 'דוא״ל',
      address: 'כתובת',
      allergies: 'אלרגיות',
      conditions: 'מצבים רפואיים',
      medications: 'תרופות קבועות',
      lastVisit: 'ביקור אחרון',
      nextAppointment: 'תור הבא',
      viewHistory: 'היסטוריה רפואית',
      viewDocuments: 'מסמכים',
      editPatient: 'עריכה',
      scheduleAppointment: 'קביעת תור',
      noAllergies: 'לא דווחו אלרגיות',
      noConditions: 'לא דווחו מצבים רפואיים',
      noMedications: 'לא נוטל תרופות קבועות'
    },
    en: {
      personalInfo: 'Personal Information',
      contactInfo: 'Contact Information',
      medicalInfo: 'Medical Information',
      id: 'ID',
      age: 'Age',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      phone: 'Phone',
      email: 'Email',
      address: 'Address',
      allergies: 'Allergies',
      conditions: 'Medical Conditions',
      medications: 'Current Medications',
      lastVisit: 'Last Visit',
      nextAppointment: 'Next Appointment',
      viewHistory: 'Medical History',
      viewDocuments: 'Documents',
      editPatient: 'Edit',
      scheduleAppointment: 'Schedule',
      noAllergies: 'No known allergies',
      noConditions: 'No medical conditions',
      noMedications: 'No current medications'
    }
  };
  
  const t = labels[language] || labels.en;
  
  return (
    <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Patient Header */}
      <div style={styles.header}>
        <div style={styles.avatar}>
          <span style={styles.avatarText}>
            {patient.firstName?.[0]}{patient.lastName?.[0]}
          </span>
        </div>
        <div style={styles.headerInfo}>
          <h3 style={styles.name}>
            {patient.firstName} {patient.lastName}
          </h3>
          <div style={styles.badges}>
            <span style={{
              ...styles.badge,
              backgroundColor: patient.gender === 'M' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(236, 72, 153, 0.1)',
              color: patient.gender === 'M' ? '#3b82f6' : '#ec4899'
            }}>
              {patient.gender === 'M' ? t.male : t.female}
            </span>
            {patient.birthDate && (
              <span style={styles.badge}>
                {t.age}: {calculateAge(patient.birthDate)}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Personal Information */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>{t.personalInfo}</h4>
        <div style={styles.infoGrid}>
          <InfoItem label={t.id} value={patient.nationalId || patient.id} />
          <InfoItem label={t.phone} value={formatPhone(patient.phone)} />
          <InfoItem label={t.email} value={patient.email} />
          <InfoItem label={t.address} value={patient.address} fullWidth />
        </div>
      </div>
      
      {/* Medical Information */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>{t.medicalInfo}</h4>
        
        {/* Allergies */}
        <div style={styles.medicalItem}>
          <span style={styles.medicalLabel}>{t.allergies}:</span>
          <div style={styles.tagContainer}>
            {patient.allergies && patient.allergies.length > 0 ? (
              patient.allergies.map((allergy, index) => (
                <span key={index} style={styles.allergyTag}>
                  ⚠️ {allergy}
                </span>
              ))
            ) : (
              <span style={styles.noData}>{t.noAllergies}</span>
            )}
          </div>
        </div>
        
        {/* Conditions */}
        <div style={styles.medicalItem}>
          <span style={styles.medicalLabel}>{t.conditions}:</span>
          <div style={styles.tagContainer}>
            {patient.conditions && patient.conditions.length > 0 ? (
              patient.conditions.map((condition, index) => (
                <span key={index} style={styles.conditionTag}>
                  {condition}
                </span>
              ))
            ) : (
              <span style={styles.noData}>{t.noConditions}</span>
            )}
          </div>
        </div>
        
        {/* Medications */}
        <div style={styles.medicalItem}>
          <span style={styles.medicalLabel}>{t.medications}:</span>
          <div style={styles.tagContainer}>
            {patient.medications && patient.medications.length > 0 ? (
              patient.medications.map((med, index) => (
                <span key={index} style={styles.medicationTag}>
                  💊 {med}
                </span>
              ))
            ) : (
              <span style={styles.noData}>{t.noMedications}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Visit Information */}
      {(patient.lastVisit || patient.nextAppointment) && (
        <div style={styles.section}>
          <div style={styles.visitInfo}>
            {patient.lastVisit && (
              <div>
                <span style={styles.visitLabel}>{t.lastVisit}:</span>
                <span style={styles.visitDate}>
                  {new Date(patient.lastVisit).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                </span>
              </div>
            )}
            {patient.nextAppointment && (
              <div>
                <span style={styles.visitLabel}>{t.nextAppointment}:</span>
                <span style={styles.visitDate}>
                  {new Date(patient.nextAppointment).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div style={styles.actions}>
        <button
          style={styles.actionButton}
          onClick={() => onAction('viewHistory', patient)}
        >
          📋 {t.viewHistory}
        </button>
        <button
          style={styles.actionButton}
          onClick={() => onAction('viewDocuments', patient)}
        >
          📁 {t.viewDocuments}
        </button>
        <button
          style={styles.actionButton}
          onClick={() => onAction('edit', patient)}
        >
          ✏️ {t.editPatient}
        </button>
        <button
          style={{...styles.actionButton, ...styles.primaryButton}}
          onClick={() => onAction('schedule', patient)}
        >
          📅 {t.scheduleAppointment}
        </button>
      </div>
    </div>
  );
};

// Info Item Component
const InfoItem = ({ label, value, fullWidth }) => (
  <div style={{ ...styles.infoItem, ...(fullWidth && styles.fullWidth) }}>
    <span style={styles.infoLabel}>{label}:</span>
    <span style={styles.infoValue}>{value || '-'}</span>
  </div>
);

// Styles
const styles = {
  container: {
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    color: '#e3e3e8'
  },
  
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  avatar: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  
  avatarText: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#10b981',
    textTransform: 'uppercase'
  },
  
  headerInfo: {
    flex: 1
  },
  
  name: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '8px'
  },
  
  badges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#e3e3e8'
  },
  
  section: {
    marginBottom: '20px'
  },
  
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#10b981'
  },
  
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  
  fullWidth: {
    gridColumn: 'span 2'
  },
  
  infoLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  infoValue: {
    fontSize: '14px',
    color: '#e3e3e8'
  },
  
  medicalItem: {
    marginBottom: '12px'
  },
  
  medicalLabel: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
    display: 'inline-block',
    marginBottom: '6px'
  },
  
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  
  allergyTag: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  },
  
  conditionTag: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: 'rgba(251, 146, 60, 0.1)',
    color: '#fb923c',
    border: '1px solid rgba(251, 146, 60, 0.2)'
  },
  
  medicationTag: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  
  noData: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.3)',
    fontStyle: 'italic'
  },
  
  visitInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px'
  },
  
  visitLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginRight: '8px'
  },
  
  visitDate: {
    fontSize: '13px',
    color: '#e3e3e8'
  },
  
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  actionButton: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: '#e3e3e8',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  
  primaryButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    color: '#10b981'
  }
};

export default PatientCard;