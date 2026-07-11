import React from 'react';
import './CollectionRenderer.css';

// TODO: Implement ClinicalDecisionSupportRenderer
const ClinicalDecisionSupportRenderer = ({ data, patientId }) => {
  return (
    <div className="collection-renderer">
      <div className="collection-header">
        <h2>Clinical Decision Support</h2>
        <span className="record-count">{data?.length || 0} recommendations</span>
      </div>
      <div className="collection-content">
        <p className="no-data">Renderer not yet implemented</p>
      </div>
    </div>
  );
};

export default ClinicalDecisionSupportRenderer;
