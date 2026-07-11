import React from 'react';
import './CollectionRenderer.css';

// TODO: Implement VitalSignsRenderer
const VitalSignsRenderer = ({ data, patientId }) => {
  return (
    <div className="collection-renderer">
      <div className="collection-header">
        <h2>Vital Signs</h2>
        <span className="record-count">{data?.length || 0} vital signs</span>
      </div>
      <div className="collection-content">
        <p className="no-data">Renderer not yet implemented</p>
      </div>
    </div>
  );
};

export default VitalSignsRenderer;
