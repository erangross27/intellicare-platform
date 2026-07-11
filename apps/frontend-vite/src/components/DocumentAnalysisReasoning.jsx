/**
 * DocumentAnalysisReasoning.jsx
 * Displays Claude's analysis reasoning for document batches
 */

import React, { useState, useEffect } from 'react';
import './DocumentAnalysisReasoning.css';

const DocumentAnalysisReasoning = ({ batchId, onClose }) => {
  const [reasoning, setReasoning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (batchId) {
      fetchReasoning();
    }
  }, [batchId]);

  const fetchReasoning = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/batch/status/${batchId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch batch status');
      }

      const data = await response.json();
      
      if (data.success && data.batch) {
        setReasoning(data.batch.reasoning || null);
      }
    } catch (err) {
      console.error('Error fetching reasoning:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="document-analysis-reasoning loading">
        <div className="loading-spinner"></div>
        <p>Loading analysis details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-analysis-reasoning error">
        <p>❌ Error loading analysis: {error}</p>
        <button onClick={fetchReasoning}>Retry</button>
      </div>
    );
  }

  if (!reasoning) {
    return (
      <div className="document-analysis-reasoning empty">
        <p>📝 Analysis reasoning will appear here once Phase 1 processing is complete.</p>
        <p className="sub-text">This typically takes 1-2 minutes.</p>
      </div>
    );
  }

  return (
    <div className="document-analysis-reasoning">
      <div className="reasoning-header">
        <h3>🧠 AI Document Analysis</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>×</button>
        )}
      </div>
      
      <div className="reasoning-content">
        <div className="reasoning-section">
          <h4>Document Understanding</h4>
          <p className="reasoning-text">{reasoning}</p>
        </div>
        
        <div className="reasoning-meta">
          <span className="batch-id">Batch: {batchId}</span>
          <button 
            className="refresh-btn" 
            onClick={fetchReasoning}
            title="Refresh analysis"
          >
            🔄
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentAnalysisReasoning;
