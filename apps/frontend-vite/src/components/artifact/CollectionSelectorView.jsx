import React from 'react';
import './CollectionSelectorView.css';

/**
 * CollectionSelectorView - Displays a list of medical collections for the doctor to choose
 *
 * This component is shown when the AI agent returns multiple collections in the same turn.
 * Instead of one collection replacing the other, the doctor can choose which to view.
 *
 * Props:
 * - artifactPanels: array - Array of artifact panel objects (each with category, data, patientId, etc.)
 * - onSelectCollection: function(panel) - Callback when a collection is selected
 * - patientName: string - Patient name for display
 */
const CollectionSelectorView = ({ artifactPanels, onSelectCollection, patientName }) => {
  if (!artifactPanels || artifactPanels.length === 0) {
    return (
      <div className="collection-selector-view">
        <div className="collection-selector-empty">
          <div className="empty-icon">📋</div>
          <p>No collections available.</p>
        </div>
      </div>
    );
  }

  // Format category name for display
  const formatCategoryName = (name) => {
    if (!name) return 'Unknown Collection';
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get record count from panel data
  const getRecordCount = (panel) => {
    if (!panel.data) return 0;
    if (Array.isArray(panel.data)) return panel.data.length;
    // Handle wrapped collections (data is single object with array inside)
    const categoryKey = panel.category;
    if (panel.data[categoryKey] && Array.isArray(panel.data[categoryKey])) {
      return panel.data[categoryKey].length;
    }
    // Handle documentData wrapper
    if (panel.data.documentData) {
      if (Array.isArray(panel.data.documentData)) return panel.data.documentData.length;
      if (panel.data.documentData.records && Array.isArray(panel.data.documentData.records)) {
        return panel.data.documentData.records.length;
      }
    }
    return 1; // Assume at least one record
  };

  // Get description hint for the collection
  const getCollectionDescription = (category) => {
    const descriptions = {
      barriers_psychosocial_issues: 'Social work barriers, SDOH, financial issues, transportation, interventions',
      psychosocial_assessments: 'Edinburgh scores, anxiety screening, domestic violence, substance use',
      medications: 'Current medications, dosages, frequencies, prescribing providers',
      lab_results: 'Laboratory test results, values, interpretations',
      vital_signs: 'Blood pressure, heart rate, temperature, oxygen saturation',
      diagnoses: 'Active diagnoses, ICD codes, conditions',
      allergies: 'Known allergies, reactions, severity',
      imaging_reports: 'X-ray, CT, MRI, ultrasound reports and findings',
      // Add more as needed
    };
    return descriptions[category] || 'Medical data collection';
  };

  return (
    <div className="collection-selector-view">
      <div className="collection-selector-header">
        <h2 className="collection-selector-title">
          <span className="collection-icon">📊</span>
          Multiple Collections Found
        </h2>
        <p className="collection-selector-subtitle">
          The AI returned {artifactPanels.length} medical collections. Select one to view:
        </p>
        {patientName && (
          <p className="collection-selector-patient">
            Patient: <strong>{patientName}</strong>
          </p>
        )}
      </div>

      <div className="collection-selector-list">
        {artifactPanels.map((panel, index) => (
          <div
            key={panel.category || index}
            className="collection-selector-item"
            onClick={() => onSelectCollection(panel)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onSelectCollection(panel);
              }
            }}
          >
            <div className="collection-item-icon">📋</div>
            <div className="collection-item-content">
              <h3 className="collection-item-title">
                {formatCategoryName(panel.category)}
              </h3>
              <p className="collection-item-description">
                {getCollectionDescription(panel.category)}
              </p>
              <p className="collection-item-count">
                {getRecordCount(panel)} {getRecordCount(panel) === 1 ? 'record' : 'records'}
              </p>
            </div>
            <div className="collection-item-arrow">→</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollectionSelectorView;
