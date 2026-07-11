import React from 'react';
import './CollectionRenderer.css';

// TODO: Implement OutcomesPredictionRenderer
const OutcomesPredictionRenderer = ({ data, patientId }) => {
  return (
    <div className="collection-renderer">
      <div className="collection-header">
        <h2>Outcomes Prediction</h2>
        <span className="record-count">{data?.length || 0} predictions</span>
      </div>
      <div className="collection-content">
        <p className="no-data">Renderer not yet implemented</p>
      </div>
    </div>
  );
};

export default OutcomesPredictionRenderer;
