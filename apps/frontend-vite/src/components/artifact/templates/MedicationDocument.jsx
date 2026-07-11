import React from 'react';
import './MedicationDocument.css';

/**
 * MedicationDocument Template
 *
 * Displays medication information with:
 * - Active vs discontinued sections
 * - Dose, route, frequency details
 * - Indication and prescriber
 * - Clinical notes and response
 * - Safety checks and interactions
 *
 * Props:
 * - document: object - Document data with medications array
 */
const MedicationDocument = ({ document }) => {
  const medications = document.medications || [];

  // Separate active and discontinued medications
  const activeMeds = medications.filter(med => med.status === 'active' || !med.status);
  const discontinuedMeds = medications.filter(med => med.status === 'discontinued' || med.status === 'stopped');

  const renderMedication = (med, index) => {
    return (
      <div key={index} className="medication-item">
        <div className="medication-header">
          <div className="medication-name-section">
            <h3 className="medication-name">{med.name || 'Unnamed Medication'}</h3>
            {med.genericName && med.genericName !== med.name && (
              <span className="medication-generic">({med.genericName})</span>
            )}
          </div>
          {med.status && (
            <span className={`medication-status status-${med.status}`}>
              {med.status.charAt(0).toUpperCase() + med.status.slice(1)}
            </span>
          )}
        </div>

        <div className="medication-details">
          {/* Dosing information */}
          <div className="detail-section">
            <h4>Dosing</h4>
            <div className="detail-grid">
              {med.dose && (
                <div className="detail-item">
                  <span className="detail-label">Dose:</span>
                  <span className="detail-value">
                    {med.dose} {med.doseUnit || ''}
                  </span>
                </div>
              )}
              {med.route && (
                <div className="detail-item">
                  <span className="detail-label">Route:</span>
                  <span className="detail-value">{med.route}</span>
                </div>
              )}
              {med.frequency && (
                <div className="detail-item">
                  <span className="detail-label">Frequency:</span>
                  <span className="detail-value">{med.frequency}</span>
                </div>
              )}
              {med.duration && (
                <div className="detail-item">
                  <span className="detail-label">Duration:</span>
                  <span className="detail-value">{med.duration}</span>
                </div>
              )}
            </div>
          </div>

          {/* Clinical information */}
          {(med.indication || med.prescriber || med.startDate || med.endDate) && (
            <div className="detail-section">
              <h4>Clinical Information</h4>
              <div className="detail-grid">
                {med.indication && (
                  <div className="detail-item">
                    <span className="detail-label">Indication:</span>
                    <span className="detail-value">{med.indication}</span>
                  </div>
                )}
                {med.prescriber && (
                  <div className="detail-item">
                    <span className="detail-label">Prescriber:</span>
                    <span className="detail-value">{med.prescriber}</span>
                  </div>
                )}
                {med.startDate && (
                  <div className="detail-item">
                    <span className="detail-label">Started:</span>
                    <span className="detail-value">
                      {new Date(med.startDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                {med.endDate && (
                  <div className="detail-item">
                    <span className="detail-label">Ended:</span>
                    <span className="detail-value">
                      {new Date(med.endDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes and response */}
          {(med.notes || med.response) && (
            <div className="detail-section">
              {med.notes && (
                <div className="detail-item-full">
                  <span className="detail-label">Notes:</span>
                  <p className="detail-text">{med.notes}</p>
                </div>
              )}
              {med.response && (
                <div className="detail-item-full">
                  <span className="detail-label">Patient Response:</span>
                  <p className="detail-text">{med.response}</p>
                </div>
              )}
            </div>
          )}

          {/* Safety information */}
          {(med.interactions || med.contraindications || med.sideEffects) && (
            <div className="detail-section safety-section">
              <h4>Safety Information</h4>
              {med.interactions && (
                <div className="safety-item">
                  <span className="safety-label">⚠️ Interactions:</span>
                  <p className="safety-text">{med.interactions}</p>
                </div>
              )}
              {med.contraindications && (
                <div className="safety-item">
                  <span className="safety-label">🚫 Contraindications:</span>
                  <p className="safety-text">{med.contraindications}</p>
                </div>
              )}
              {med.sideEffects && (
                <div className="safety-item">
                  <span className="safety-label">⚕️ Side Effects:</span>
                  <p className="safety-text">{med.sideEffects}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="medication-document">
      <h1 className="document-title">Medications</h1>

      {/* Active medications */}
      {activeMeds.length > 0 && (
        <div className="medication-section">
          <h2 className="section-title">
            Active Medications ({activeMeds.length})
          </h2>
          <div className="medication-list">
            {activeMeds.map((med, index) => renderMedication(med, `active-${index}`))}
          </div>
        </div>
      )}

      {/* Discontinued medications */}
      {discontinuedMeds.length > 0 && (
        <div className="medication-section discontinued-section">
          <h2 className="section-title">
            Discontinued Medications ({discontinuedMeds.length})
          </h2>
          <div className="medication-list">
            {discontinuedMeds.map((med, index) => renderMedication(med, `discontinued-${index}`))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {medications.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">💊</div>
          <p>No medications recorded</p>
        </div>
      )}
    </div>
  );
};

export default MedicationDocument;
