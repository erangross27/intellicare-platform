import React, { useState } from 'react';
import './PatientListCard.css';

const PatientListCard = ({ patients, searchQuery, language, onPatientSelect }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const isRTL = language === 'he';

  const handlePatientClick = (patient) => {
    setSelectedPatient(patient._id === selectedPatient?._id ? null : patient);
    if (onPatientSelect) {
      onPatientSelect(patient);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };

  const getAge = (dateOfBirth) => {
    if (!dateOfBirth) return '';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className={`patient-list-card ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="patient-list-header">
        <div className="header-content">
          <h2>
            {isRTL ? 'רשימת מטופלים' : 'Patient List'}
          </h2>
          <div className="patient-count">
            <span className="count-badge">{patients.length}</span>
            <span className="count-label">
              {isRTL ? 'מטופלים' : 'patients'}
            </span>
          </div>
        </div>
        {searchQuery && searchQuery !== '*' && (
          <div className="search-info">
            {isRTL ? 'חיפוש: ' : 'Search: '}{searchQuery}
          </div>
        )}
      </div>

      {/* Patient List */}
      <div className="patient-list-container">
        {patients && patients.length > 0 ? (
          <div className="patient-list">
            {patients.map((patient, index) => (
              <div 
                key={patient._id || index}
                className={`patient-list-item ${selectedPatient?._id === patient._id ? 'selected' : ''}`}
                onClick={() => handlePatientClick(patient)}
              >
                <div className="patient-main-info">
                  <div className="patient-name">
                    <span className="patient-number">{index + 1}.</span>
                    <strong>{patient.firstName} {patient.lastName}</strong>
                    {patient.dateOfBirth && (
                      <span className="patient-age">
                        ({getAge(patient.dateOfBirth)} {isRTL ? 'שנים' : 'years'})
                      </span>
                    )}
                  </div>
                  <div className="patient-id">
                    {patient.nationalId || patient.ssn || patient._id}
                  </div>
                </div>

                <div className="patient-details">
                  <div className="detail-row">
                    <span className="detail-icon">📱</span>
                    <span>{patient.phone || (isRTL ? 'אין טלפון' : 'No phone')}</span>
                  </div>
                  {patient.email && (
                    <div className="detail-row">
                      <span className="detail-icon">✉️</span>
                      <span>{patient.email}</span>
                    </div>
                  )}
                  {(patient.city || patient.street) && (
                    <div className="detail-row">
                      <span className="detail-icon">📍</span>
                      <span>
                        {[patient.street, patient.buildingNumber, patient.city]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  {patient.healthFund && (
                    <div className="detail-row">
                      <span className="detail-icon">🏥</span>
                      <span>{patient.healthFund}</span>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {selectedPatient?._id === patient._id && (
                  <div className="patient-expanded">
                    <div className="expanded-section">
                      <h4>{isRTL ? 'פרטים נוספים' : 'Additional Details'}</h4>
                      
                      {patient.dateOfBirth && (
                        <div className="info-row">
                          <label>{isRTL ? 'תאריך לידה:' : 'Date of Birth:'}</label>
                          <span>{formatDate(patient.dateOfBirth)}</span>
                        </div>
                      )}
                      
                      {patient.gender && (
                        <div className="info-row">
                          <label>{isRTL ? 'מין:' : 'Gender:'}</label>
                          <span>{patient.gender}</span>
                        </div>
                      )}
                      
                      {patient.insuranceProvider && (
                        <div className="info-row">
                          <label>{isRTL ? 'ביטוח:' : 'Insurance:'}</label>
                          <span>{patient.insuranceProvider}</span>
                        </div>
                      )}
                      
                      {patient.emergencyContact && (
                        <div className="info-row">
                          <label>{isRTL ? 'איש קשר חירום:' : 'Emergency Contact:'}</label>
                          <span>{patient.emergencyContact}</span>
                        </div>
                      )}
                      
                      {patient.notes && (
                        <div className="info-row">
                          <label>{isRTL ? 'הערות:' : 'Notes:'}</label>
                          <span>{patient.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="patient-actions">
                      <button className="action-btn view-btn">
                        {isRTL ? 'צפה בפרופיל מלא' : 'View Full Profile'}
                      </button>
                      <button className="action-btn history-btn">
                        {isRTL ? 'היסטוריה רפואית' : 'Medical History'}
                      </button>
                      <button className="action-btn appointment-btn">
                        {isRTL ? 'קבע תור' : 'Schedule Appointment'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-patients">
            <span className="empty-icon">👥</span>
            <p>{isRTL ? 'לא נמצאו מטופלים' : 'No patients found'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientListCard;