import React, { useState, useEffect } from 'react';
import secureApiClient from '../../services/secureApiClient';
import MedicalGridRenderer from '../grids/MedicalGridRenderer';
import './GridCollectionView.css';

/**
 * GridCollectionView - Fetches and displays collection in grid format
 *
 * Uses existing grid endpoints and UniversalGridDisplay component.
 * Displays all records for a collection in a formatted table.
 *
 * Props:
 * - patientId: string - Patient ID
 * - category: string - Category name (collection name)
 * - categoryDisplay: string - Display name for category
 * - onBack: function - Callback to go back to category list
 */
const GridCollectionView = ({ patientId, category, categoryDisplay, onBack }) => {
  const [gridData, setGridData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Format category name - remove underscores and capitalize
  const formatCategoryName = (name) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  useEffect(() => {
    fetchGridData();
  }, [patientId, category]);

  const fetchGridData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Convert category name to endpoint format (e.g., lab_results -> lab-results)
      const endpointName = category.replace(/_/g, '-');

      console.log(`[GridCollectionView] Fetching ${endpointName} for patient ${patientId}`);

      const response = await secureApiClient.get(
        `/api/agent/${endpointName}/${patientId}`
      );

      console.log('[GridCollectionView] Response:', response);

      if (response.success && response.gridFormat) {
        setGridData(response);
      } else {
        setError(response.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('[GridCollectionView] Error fetching grid data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    // Save scroll position before going back
    sessionStorage.setItem('categoryListBackNavigation', 'true');
    console.log('🔙 [GridCollectionView] Marked as back navigation');
    onBack();
  };

  // Loading state
  if (loading) {
    return (
      <div className="grid-collection-view">
        <div className="grid-collection-header">
          <button onClick={handleBackClick} className="back-button">
            ‹ Back
          </button>
          <h2>{categoryDisplay || formatCategoryName(category)}</h2>
        </div>
        <div className="grid-collection-loading">
          <div className="loading-spinner"></div>
          <p>Loading data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="grid-collection-view">
        <div className="grid-collection-header">
          <button onClick={handleBackClick} className="back-button">
            ‹ Back
          </button>
          <h2>{categoryDisplay || formatCategoryName(category)}</h2>
        </div>
        <div className="grid-collection-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={fetchGridData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data
  if (!gridData || !gridData.data || gridData.data.length === 0) {
    return (
      <div className="grid-collection-view">
        <div className="grid-collection-header">
          <button onClick={handleBackClick} className="back-button">
            ‹ Back
          </button>
          <h2>{categoryDisplay || formatCategoryName(category)}</h2>
        </div>
        <div className="grid-collection-empty">
          <div className="empty-icon">📄</div>
          <p>No data found in this category.</p>
        </div>
      </div>
    );
  }

  // Success state - render grid using MedicalGridRenderer
  // MedicalGridRenderer has: export to CSV, copy cell, copy row, copy all, pin, search, sort
  return (
    <div className="grid-collection-view">
      <div className="grid-collection-header">
        <button onClick={handleBackClick} className="back-button">
          ‹ Back
        </button>
      </div>

      <div className="grid-collection-content">
        <MedicalGridRenderer data={gridData} language="en" />
      </div>
    </div>
  );
};

export default GridCollectionView;
