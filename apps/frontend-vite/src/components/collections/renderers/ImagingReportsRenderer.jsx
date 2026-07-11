import React from 'react';
import './CollectionRenderer.css';

// TODO: Implement ImagingReportsRenderer
const ImagingReportsRenderer = ({ data, patientId }) => {
  return (
    <div className="collection-renderer">
      <div className="collection-header">
        <h2>Imaging Reports</h2>
        <span className="record-count">{data?.length || 0} reports</span>
      </div>
      <div className="collection-content">
        <p className="no-data">Renderer not yet implemented</p>
      </div>
    </div>
  );
};

export default ImagingReportsRenderer;
