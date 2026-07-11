import React, { useState } from 'react';
import './PatientCard.css';

const PatientCard = ({ patient, language }) => {
  const [expanded, setExpanded] = useState({
    vitals: true,
    allergies: true,
    conditions: true,
    contact: true
  });
  
  const isRTL = language === 'he';
  
  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Calculate age from date of birth
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
  
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  return (
    <div className={`patient-card ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header with Basic Info */}
      <div className="patient-header">
        <div className="patient-avatar">
          <span>{patient.firstName?.[0]}{patient.lastName?.[0]}</span>
        </div>
        <div className="patient-basic-info">
          <h2>{patient.firstName} {patient.lastName}</h2>
          <div className="patient-meta">
            <span className="meta-item">
              🆔 {patient.nationalId || patient.socialSecurityNumber}
            </span>
            <span className="meta-item">
              🎂 {calculateAge(patient.dateOfBirth)} {isRTL ? 'שנים' : 'years'}
            </span>
            <span className="meta-item">
              📅 {formatDate(patient.dateOfBirth)}
            </span>
          </div>
        </div>
        <div className={`patient-status ${patient.status || 'active'}`}>
          {patient.status === 'active' ? '✅' : '⚠️'}
          {isRTL ? (patient.status === 'active' ? 'פעיל' : 'לא פעיל') : patient.status}
        </div>
      </div>
      
      {/* Contact Information */}
      <div className="info-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('contact')}
        >
          <h3>📞 {isRTL ? 'פרטי קשר' : 'Contact Information'}</h3>
          <span className="toggle-icon">{expanded.contact ? '▼' : '▶'}</span>
        </div>
        {expanded.contact && (
          <div className="section-content">
            <div className="info-row">
              <span className="info-label">📱 {isRTL ? 'טלפון' : 'Phone'}:</span>
              <span className="info-value">{patient.phone || '-'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">📧 {isRTL ? 'אימייל' : 'Email'}:</span>
              <span className="info-value">{patient.email || '-'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">📍 {isRTL ? 'כתובת' : 'Address'}:</span>
              <span className="info-value">
                {patient.street || ''} {patient.city || ''} {patient.zipCode || ''}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Health Fund / Insurance */}
      <div className="info-section">
        <div className="section-header">
          <h3>🏥 {isRTL ? 'ביטוח רפואי' : 'Medical Insurance'}</h3>
        </div>
        <div className="section-content">
          <div className="insurance-card">
            <span className="insurance-provider">
              {patient.healthFund || patient.insuranceProvider || '-'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Vital Signs - Only show if we have vitals data */}
      {patient.vitals && (
        <div className="info-section">
          <div 
            className="section-header"
            onClick={() => toggleSection('vitals')}
          >
            <h3>💓 {isRTL ? 'סימנים חיוניים' : 'Vital Signs'}</h3>
            <span className="toggle-icon">{expanded.vitals ? '▼' : '▶'}</span>
          </div>
          {expanded.vitals && (
            <div className="section-content">
              <div className="vitals-grid">
                {patient.vitals.bloodPressure && (
                  <div className="vital-item">
                    <span className="vital-label">{isRTL ? 'לחץ דם' : 'Blood Pressure'}</span>
                    <span className="vital-value">{patient.vitals.bloodPressure}</span>
                    <span className="vital-unit">mmHg</span>
                  </div>
                )}
                {patient.vitals.heartRate && (
                  <div className="vital-item">
                    <span className="vital-label">{isRTL ? 'דופק' : 'Heart Rate'}</span>
                    <span className="vital-value">{patient.vitals.heartRate}</span>
                    <span className="vital-unit">bpm</span>
                  </div>
                )}
                {patient.vitals.temperature && (
                  <div className="vital-item">
                    <span className="vital-label">{isRTL ? 'חום' : 'Temperature'}</span>
                    <span className="vital-value">{patient.vitals.temperature}</span>
                    <span className="vital-unit">°C</span>
                  </div>
                )}
                {patient.vitals.weight && (
                  <div className="vital-item">
                    <span className="vital-label">{isRTL ? 'משקל' : 'Weight'}</span>
                    <span className="vital-value">{patient.vitals.weight}</span>
                    <span className="vital-unit">kg</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Allergies - Show only if we have allergy data */}
      {patient.allergies && patient.allergies.length > 0 && (
        <div className="info-section">
          <div 
            className="section-header"
            onClick={() => toggleSection('allergies')}
          >
            <h3>⚠️ {isRTL ? 'אלרגיות' : 'Allergies'}</h3>
            <span className="toggle-icon">{expanded.allergies ? '▼' : '▶'}</span>
          </div>
          {expanded.allergies && (
            <div className="section-content">
              <div className="allergy-list">
                {patient.allergies.map((allergy, index) => (
                  <div key={index} className={`allergy-item ${allergy.severity || 'moderate'}`}>
                    <span className="allergy-name">{allergy.name || allergy}</span>
                    {allergy.severity && (
                      <span className="allergy-severity">
                        {isRTL ? 
                          (allergy.severity === 'critical' ? 'חמור' : 
                           allergy.severity === 'moderate' ? 'בינוני' : 'קל') :
                          allergy.severity
                        }
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-button primary">
          📝 {isRTL ? 'עדכן פרטים' : 'Update Info'}
        </button>
        <button className="action-button">
          📅 {isRTL ? 'קבע תור' : 'Schedule'}
        </button>
        <button className="action-button">
          📋 {isRTL ? 'הוסף הערה' : 'Add Note'}
        </button>
      </div>
    </div>
  );
};

export default PatientCard;