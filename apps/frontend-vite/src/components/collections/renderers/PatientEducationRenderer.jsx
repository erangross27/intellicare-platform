import React from 'react';
import './CollectionRenderer.css';

// TODO: Implement PatientEducationRenderer
const PatientEducationRenderer = ({ data, patientId }) => {
  return (
    <div className="collection-renderer">
      <div className="collection-header">
        <h2>Patient Education</h2>
        <span className="record-count">{data?.length || 0} items</span>
      </div>
      <div className="collection-content">
        <p className="no-data">Renderer not yet implemented</p>
      </div>
    </div>
  );
};

export default PatientEducationRenderer;
