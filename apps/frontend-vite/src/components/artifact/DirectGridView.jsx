import React from 'react';
import MedicalGridRenderer from '../grids/MedicalGridRenderer';
import './DirectGridView.css';

/**
 * DirectGridView - Displays grid data directly in artifact panel
 *
 * Used when backend provides complete grid data (like listAllPatients)
 * instead of fetching from API endpoint.
 *
 * Props:
 * - title: string - Grid title
 * - data: array - Grid data rows
 * - columns: array - Column field names
 * - headers: array - Column display headers
 * - onBack: function - Callback to go back
 */
const DirectGridView = ({ title, data, columns, headers, onBack }) => {
  return (
    <div className="direct-grid-view">
      {/* Header with back button */}
      <div className="direct-grid-header">
        {onBack && (
          <button onClick={onBack} className="back-button">
            ‹ Back
          </button>
        )}
        <h2>{title || 'Data Grid'}</h2>
        <div className="grid-stats">
          {data?.length || 0} records
        </div>
      </div>

      {/* Grid content */}
      <div className="direct-grid-content">
        <MedicalGridRenderer
          data={{
            data: data || [],
            columns: columns || [],
            headers: headers || [],
            displayTitle: title || 'Data Grid'
          }}
          language="en"
        />
      </div>
    </div>
  );
};

export default DirectGridView;
