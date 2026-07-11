import React from 'react';
import './SummaryCard.css';

/**
 * SummaryCard Component
 * Displays a brief summary of batch processing results
 * Shows in the chat when documents finish processing
 */
const SummaryCard = ({ summary }) => {
  if (!summary) return null;

  const {
    fileCount,
    successCount,
    failedCount,
    files,
    timestamp,
    patientId
  } = summary;

  return (
    <div className="summary-card">
      <div className="summary-header">
        <span className="summary-icon">📊</span>
        <h3>Document Analysis Complete</h3>
        <span className="summary-time">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="summary-stats">
        <div className="stat-item success">
          <span className="stat-value">{successCount}</span>
          <span className="stat-label">Processed</span>
        </div>
        {failedCount > 0 && (
          <div className="stat-item failed">
            <span className="stat-value">{failedCount}</span>
            <span className="stat-label">Failed</span>
          </div>
        )}
        <div className="stat-item total">
          <span className="stat-value">{fileCount}</span>
          <span className="stat-label">Total</span>
        </div>
      </div>

      <div className="summary-files">
        <h4>Files Processed:</h4>
        <ul className="file-list">
          {files.map((file, index) => (
            <li key={index} className={file.success ? 'success' : 'failed'}>
              <span className="file-icon">
                {file.success ? '✅' : '❌'}
              </span>
              <span className="file-name">{file.fileName}</span>
              {file.success && file.extractedCategories > 0 && (
                <span className="file-categories">
                  ({file.extractedCategories} categories extracted)
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {patientId && (
        <div className="summary-footer">
          <p className="patient-info">
            Data saved to patient record
          </p>
        </div>
      )}
    </div>
  );
};

export default SummaryCard;