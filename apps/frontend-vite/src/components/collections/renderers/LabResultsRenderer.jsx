import React from 'react';
import './CollectionRenderer.css';

// TODO: Implement LabResultsRenderer
const LabResultsRenderer = ({ data, patientId }) => {
  return (
    <div className="collection-renderer">
      <div className="collection-header">
        <h2>Lab Results</h2>
        <span className="record-count">{data?.length || 0} results</span>
      </div>
      <div className="collection-content">
        <p className="no-data">Renderer not yet implemented</p>
      </div>
    </div>
  );
};

export default LabResultsRenderer;
