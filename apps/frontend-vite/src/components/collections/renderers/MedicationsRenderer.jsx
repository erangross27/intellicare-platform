import React from 'react';
import './CollectionRenderer.css';

/**
 * MedicationsRenderer - Displays patient's medication records
 *
 * Props:
 * @param {Array} data - Array of medication records
 * @param {string} patientId - Patient ID
 */
const MedicationsRenderer = ({ data, patientId }) => {

  /**
   * Format date for display
   */
  const formatDate = (dateValue) => {
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      return null;
    }
  };

  /**
   * Get status badge class
   */
  const getStatusClass = (status) => {
    if (!status) return 'status-active';
    const normalized = status.toLowerCase();
    if (normalized === 'active') return 'status-active';
    if (normalized === 'inactive' || normalized === 'completed') return 'status-inactive';
    if (normalized === 'discontinued' || normalized === 'stopped') return 'status-discontinued';
    return 'status-pending';
  };

  /**
   * Render single medication card
   */
  const renderMedicationCard = (med, index) => {
    const name = med.name || med.medicationName || 'Unknown Medication';
    const dosage = med.dosage || med.dose || '';
    const route = med.route || '';
    const frequency = med.frequency || '';
    const status = med.status || 'active';

    return (
      <div key={med._id || index} className="collection-card">
        <div className="collection-card-header">
          <h3 className="collection-card-title">{name}</h3>
          <span className={`status-badge ${getStatusClass(status)}`}>
            {status}
          </span>
        </div>

        <div className="collection-card-body">
          {/* Dosage & Route */}
          {dosage && (
            <div className="collection-field">
              <span className="collection-field-label">Dosage</span>
              <span className="collection-field-value">{dosage}</span>
            </div>
          )}

          {route && (
            <div className="collection-field">
              <span className="collection-field-label">Route</span>
              <span className="collection-field-value">{route}</span>
            </div>
          )}

          {/* Frequency */}
          {frequency && (
            <div className="collection-field">
              <span className="collection-field-label">Frequency</span>
              <span className="collection-field-value">{frequency}</span>
            </div>
          )}

          {/* Indication */}
          {(med.indication || med.reason) && (
            <div className="collection-field">
              <span className="collection-field-label">Indication</span>
              <span className="collection-field-value">
                {med.indication || med.reason}
              </span>
            </div>
          )}

          {/* Start Date */}
          {med.startDate && (
            <div className="collection-field">
              <span className="collection-field-label">Start Date</span>
              <span className="collection-field-value">
                {formatDate(med.startDate)}
              </span>
            </div>
          )}

          {/* End Date */}
          {med.endDate && (
            <div className="collection-field">
              <span className="collection-field-label">End Date</span>
              <span className="collection-field-value">
                {formatDate(med.endDate)}
              </span>
            </div>
          )}

          {/* Prescribed By */}
          {med.prescribedBy && (
            <div className="collection-field">
              <span className="collection-field-label">Prescribed By</span>
              <span className="collection-field-value">{med.prescribedBy}</span>
            </div>
          )}

          {/* Instructions */}
          {med.instructions && (
            <div className="collection-field" style={{ gridColumn: '1 / -1' }}>
              <span className="collection-field-label">Instructions</span>
              <span className="collection-field-value">{med.instructions}</span>
            </div>
          )}

          {/* Notes */}
          {med.notes && (
            <div className="collection-field" style={{ gridColumn: '1 / -1' }}>
              <span className="collection-field-label">Notes</span>
              <span className="collection-field-value">{med.notes}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="collection-renderer medications-renderer">
      <div className="collection-header">
        <h2>Medications</h2>
        <span className="record-count">{data?.length || 0} medications</span>
      </div>

      <div className="collection-content">
        {!data || data.length === 0 ? (
          <p className="no-data">No medications found</p>
        ) : (
          data.map((med, index) => renderMedicationCard(med, index))
        )}
      </div>
    </div>
  );
};

export default MedicationsRenderer;
