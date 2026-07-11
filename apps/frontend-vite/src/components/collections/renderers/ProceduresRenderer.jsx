import React from 'react';
import './CollectionRenderer.css';

// TODO: Implement ProceduresRenderer
const ProceduresRenderer = ({ data, patientId }) => {
  return (
    <div className="collection-renderer">
      <div className="collection-header">
        <h2>Procedures</h2>
        <span className="record-count">{data?.length || 0} procedures</span>
      </div>
      <div className="collection-content">
        <p className="no-data">Renderer not yet implemented</p>
      </div>
    </div>
  );
};

export default ProceduresRenderer;
