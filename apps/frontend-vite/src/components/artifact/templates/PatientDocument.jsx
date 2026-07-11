import React from 'react';
import './PatientDocument.css';

/**
 * PatientDocument Template
 *
 * Displays comprehensive patient information with:
 * - Patient demographics and contact info
 * - Medical information (blood type, allergies)
 * - Emergency contact details
 * - Insurance information
 * - Clinical summary and available records
 *
 * Props:
 * - document: object - Patient data
 */
const PatientDocument = ({ document }) => {
  const patient = document || {};

  // Calculate age from DOB
  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
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
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get status badge class
  const getStatusClass = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'active') return 'status-active';
    if (statusLower === 'inactive') return 'status-inactive';
    return 'status-unknown';
  };

  // Try multiple possible field names for date of birth
  const dob = patient.dateOfBirth || patient.dob || patient.birthDate || patient.date_of_birth;
  const age = calculateAge(dob);

  return (
    <div className="patient-document">
      {/* Header */}
      <div className="patient-header">
        <div className="patient-name-section">
          <h1 className="patient-name">
            {patient.firstName || ''} {patient.lastName || patient.patientName || 'Unknown Patient'}
          </h1>
          {patient.status && (
            <span className={`patient-status ${getStatusClass(patient.status)}`}>
              {patient.status}
            </span>
          )}
        </div>
        {patient.patientId && (
          <div className="patient-id">ID: {patient.patientId}</div>
        )}
      </div>

      {/* Patient Information Section */}
      <div className="document-section">
        <h2 className="section-title">Patient Information</h2>
        <div className="detail-grid">
          {patient.dateOfBirth && (
            <div className="detail-item">
              <span className="detail-label">Date of Birth:</span>
              <span className="detail-value">
                {formatDate(patient.dateOfBirth)}
                {age && ` (${age} years old)`}
              </span>
            </div>
          )}
          {patient.gender && (
            <div className="detail-item">
              <span className="detail-label">Gender:</span>
              <span className="detail-value">{patient.gender}</span>
            </div>
          )}
          {patient.nationalId && (
            <div className="detail-item">
              <span className="detail-label">National ID:</span>
              <span className="detail-value">{patient.nationalId}</span>
            </div>
          )}
          {patient.socialSecurityNumber && (
            <div className="detail-item">
              <span className="detail-label">Social Security Number:</span>
              <span className="detail-value">{patient.socialSecurityNumber}</span>
            </div>
          )}
          {patient.preferredLanguage && (
            <div className="detail-item">
              <span className="detail-label">Preferred Language:</span>
              <span className="detail-value">{patient.preferredLanguage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <div className="document-section">
        <h2 className="section-title">Contact Information</h2>
        <div className="detail-grid">
          {patient.phone && (
            <div className="detail-item">
              <span className="detail-label">Phone:</span>
              <span className="detail-value">{patient.phone}</span>
            </div>
          )}
          {patient.email && (
            <div className="detail-item">
              <span className="detail-label">Email:</span>
              <span className="detail-value">{patient.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      {(patient.street || patient.address || patient.city || patient.state || patient.zipCode || patient.country) && (
        <div className="document-section">
          <h2 className="section-title">Address</h2>
          <div className="address-content">
            {(patient.street || patient.address) && <div>{patient.street || patient.address}</div>}
            <div>
              {patient.city && `${patient.city}, `}
              {patient.state && `${patient.state} `}
              {patient.zipCode}
            </div>
            {patient.country && <div>{patient.country}</div>}
          </div>
        </div>
      )}

      {/* Medical Information */}
      <div className="document-section">
        <h2 className="section-title">Medical Information</h2>
        <div className="detail-grid">
          {patient.bloodType && (
            <div className="detail-item">
              <span className="detail-label">Blood Type:</span>
              <span className="detail-value">{patient.bloodType}</span>
            </div>
          )}
          {patient.allergies && (
            <div className="detail-item full-width">
              <span className="detail-label">Allergies:</span>
              <span className="detail-value">
                {Array.isArray(patient.allergies)
                  ? patient.allergies.join(', ')
                  : patient.allergies}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Contact */}
      {(patient.emergencyContact || patient.emergencyContactName || patient.emergencyContactPhone) && (
        <div className="document-section">
          <h2 className="section-title">Emergency Contact</h2>
          <div className="detail-grid">
            {(patient.emergencyContact || patient.emergencyContactName) && (
              <div className="detail-item">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{patient.emergencyContact || patient.emergencyContactName}</span>
              </div>
            )}
            {patient.emergencyContactPhone && (
              <div className="detail-item">
                <span className="detail-label">Phone:</span>
                <span className="detail-value">{patient.emergencyContactPhone}</span>
              </div>
            )}
            {patient.emergencyContactRelationship && (
              <div className="detail-item">
                <span className="detail-label">Relationship:</span>
                <span className="detail-value">{patient.emergencyContactRelationship}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insurance Information */}
      {(patient.insuranceProvider || patient.insuranceNumber) && (
        <div className="document-section">
          <h2 className="section-title">Insurance</h2>
          <div className="detail-grid">
            {patient.insuranceProvider && (
              <div className="detail-item">
                <span className="detail-label">Provider:</span>
                <span className="detail-value">{patient.insuranceProvider}</span>
              </div>
            )}
            {patient.insuranceNumber && (
              <div className="detail-item">
                <span className="detail-label">Insurance Number:</span>
                <span className="detail-value">{patient.insuranceNumber}</span>
              </div>
            )}
            {patient.insuranceGroup && (
              <div className="detail-item">
                <span className="detail-label">Group:</span>
                <span className="detail-value">{patient.insuranceGroup}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clinical Summary */}
      {patient.doctorSummary && (
        <div className="document-section">
          <h2 className="section-title">Clinical Summary</h2>
          <div className="clinical-summary">
            <p>{patient.doctorSummary}</p>
          </div>
        </div>
      )}

      {/* Medical Records Available */}
      {(() => {
        // Collect all count fields from patient object
        const countFields = {};
        Object.keys(patient).forEach(key => {
          if (key.endsWith('Count') && patient[key] > 0) {
            const category = key.replace('Count', '').replace(/([A-Z])/g, ' $1').trim();
            countFields[category] = patient[key];
          }
        });

        return Object.keys(countFields).length > 0 ? (
          <div className="document-section">
            <h2 className="section-title">Medical Records Available</h2>
            <div className="medical-records-grid">
              {Object.entries(countFields).map(([category, count]) => (
                <div key={category} className="record-item">
                  <span className="record-category">
                    {category.charAt(0).toUpperCase() + category.slice(1)}:
                  </span>
                  <span className="record-count">{count} {count === 1 ? 'record' : 'records'}</span>
                </div>
              ))}
            </div>
          </div>
        ) : patient.medicalRecordsAvailable && Object.keys(patient.medicalRecordsAvailable).length > 0 ? (
          <div className="document-section">
            <h2 className="section-title">Medical Records Available</h2>
            <div className="medical-records-grid">
              {Object.entries(patient.medicalRecordsAvailable).map(([category, count]) => (
                <div key={category} className="record-item">
                  <span className="record-category">
                    {category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                  </span>
                  <span className="record-count">{count} records</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Footer with last modified */}
      {(patient.updatedAt || patient.createdAt) && (
        <div className="document-footer">
          <span className="footer-label">Last Modified:</span>
          <span className="footer-value">
            {formatDate(patient.updatedAt || patient.createdAt)}
          </span>
        </div>
      )}

      {/* Clinical Note (if inactive) */}
      {patient.status && patient.status.toLowerCase() === 'inactive' && (
        <div className="clinical-note warning">
          <strong>Clinical Note:</strong> Patient status is currently "Inactive".
          Consider reactivating if they require ongoing care or have upcoming appointments scheduled.
        </div>
      )}
    </div>
  );
};

export default PatientDocument;
