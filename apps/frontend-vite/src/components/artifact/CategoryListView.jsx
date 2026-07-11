import React, { useState, useEffect, useRef } from 'react';
import secureApiClient from '../../services/secureApiClient';
import './CategoryListView.css';

/**
 * CategoryListView - Level 1 of artifact navigation
 *
 * Displays a list of all medical data categories for a patient.
 * Shows category name, icon, and document count.
 *
 * Props:
 * - patientId: string - Patient ID to fetch categories for
 * - onSelectCategory: function(categoryName) - Callback when category is clicked
 * - initialCategories: array - Optional pre-fetched categories data
 * - onSendMessage: function(message) - Callback to send message to Claude
 * - patientName: string - Patient name for constructing messages
 */
const CategoryListView = ({ patientId, onSelectCategory, initialCategories = null, onSendMessage = null, patientName = null }) => {
  const [categories, setCategories] = useState(initialCategories || []);
  const [loading, setLoading] = useState(!initialCategories);
  const [error, setError] = useState(null);
  const [loadingCategory, setLoadingCategory] = useState(null); // Track which category is being loaded

  useEffect(() => {
    // If we have pre-fetched categories, use them and skip API fetch
    if (initialCategories) {
      console.log('📡 [CategoryListView] Using pre-fetched categories:', initialCategories.length);
      console.log('📡 [CategoryListView] First category sample:', initialCategories[0]);
      setCategories(initialCategories);
      setLoading(false);
      return;
    }

    // Otherwise fetch from API
    if (patientId) {
      fetchCategories();
    }
  }, [patientId, initialCategories]);

  // Listen for artifact panel navigation events to clear loading state
  useEffect(() => {
    const handleArtifactNavigation = () => {
      // Clear loading state when artifact panel navigates (means Claude responded)
      if (loadingCategory) {
        console.log('✅ [CategoryListView] Clearing loading state - artifact panel navigated');
        setLoadingCategory(null);
      }
    };

    window.addEventListener('artifactPanelNavigated', handleArtifactNavigation);
    return () => window.removeEventListener('artifactPanelNavigated', handleArtifactNavigation);
  }, [loadingCategory]);

  // Clear scroll position when component first mounts (new session)
  useEffect(() => {
    // Check if this is a fresh mount (not a "back" navigation)
    const isBackNavigation = sessionStorage.getItem('categoryListBackNavigation');
    const currentLevel = localStorage.getItem('artifactLevel');

    if (!isBackNavigation) {
      // Only clear scroll position if we're NOT already on the categories level
      // (i.e., this is a truly fresh mount, not a page refresh while on categories)
      if (currentLevel !== 'categories') {
        sessionStorage.removeItem('categoryListScrollPosition');
        console.log('🧹 [CategoryListView] Fresh mount from different level - cleared scroll position');
      } else {
        console.log('📍 [CategoryListView] Refresh on categories level - keeping scroll position');
      }
    } else {
      // This is a back navigation - keep the scroll position
      sessionStorage.removeItem('categoryListBackNavigation');
      console.log('🔙 [CategoryListView] Back navigation - will restore scroll position');
    }

    // Cleanup function should NOT clear scroll position
    // because we want it to persist when navigating to child views
    // It will be cleared on fresh mount instead
  }, []);

  // Restore scroll position when component mounts or categories load
  useEffect(() => {
    if (!loading && categories.length > 0) {
      // Find the actual scroll container (.artifact-content)
      const scrollContainer = document.querySelector('.artifact-content');

      console.log('📍 [CategoryListView] Restore attempt - loading:', loading, 'categories:', categories.length, 'scrollContainer:', !!scrollContainer);

      if (scrollContainer) {
        // Get saved scroll position from sessionStorage
        const savedPosition = sessionStorage.getItem('categoryListScrollPosition');
        console.log('📍 [CategoryListView] Saved position from sessionStorage:', savedPosition);

        if (savedPosition) {
          const position = parseInt(savedPosition, 10);
          console.log('🔄 [CategoryListView] Restoring scroll position from sessionStorage:', position);
          console.log('📍 [CategoryListView] Current scrollHeight:', scrollContainer.scrollHeight, 'clientHeight:', scrollContainer.clientHeight);

          // Use requestAnimationFrame to wait for next render cycle after DOM is ready
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (scrollContainer) {
                scrollContainer.scrollTop = position;
                console.log('✅ [CategoryListView] Scroll position SET to:', position);
                console.log('✅ [CategoryListView] Actual scrollTop after SET:', scrollContainer.scrollTop);
              }
            });
          });
        } else {
          console.log('❌ [CategoryListView] No saved position found in sessionStorage');
        }
      } else {
        console.log('❌ [CategoryListView] Scroll container not found');
      }
    }
  }, [loading, categories]);

  const fetchCategories = async () => {
    console.log('📡 [CategoryListView] Fetching categories for patientId:', patientId);

    // Guard against null/undefined patientId
    if (!patientId) {
      console.warn('📡 [CategoryListView] No patientId provided, skipping fetch');
      setLoading(false);
      setError('Patient ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Force fresh request (no cache) by adding timestamp
      const url = `/api/agent/patient/${patientId}/categories?t=${Date.now()}`;
      console.log('📡 [CategoryListView] API URL:', url);

      const response = await secureApiClient.get(url);
      console.log('📡 [CategoryListView] API Response:', response);

      if (!response) {
        console.error('📡 [CategoryListView] No response from API');
        setError('No response from server. Please check your connection.');
        setLoading(false);
        return;
      }

      // SecureApiClient returns the data directly (not response.data)
      if (response.success) {
        console.log('📡 [CategoryListView] Categories received:', response.categories);
        setCategories(response.categories || []);
      } else {
        setError(response.error || 'Failed to fetch categories');
      }
    } catch (err) {
      console.error('[CategoryListView] Error fetching categories:', err);
      console.error('[CategoryListView] Error details:', {
        message: err.message,
        stack: err.stack,
        response: err.response
      });
      setError('Failed to load medical data categories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (category) => {
    console.log('🎯 [CategoryListView] Category clicked:', category);
    console.log('🎯 [CategoryListView] Category.displayMode:', category.displayMode);
    console.log('🎯 [CategoryListView] Category.displayMode === "document":', category.displayMode === 'document');

    // Special handling for Full Report - send to Claude for complete unified document
    if (category.name === 'full_report' && onSendMessage && patientName) {
      console.log('📋 [CategoryListView] Full Report clicked - sending to Claude');
      setLoadingCategory(category.name); // Show loading state
      onSendMessage(`show full medical report for ${patientName}`);
      // Don't call onSelectCategory - let Claude's response handle the artifact panel update
      return;
    }

    // For document-view collections (displayMode === 'document'), use direct navigation to bypass Claude
    if (category.displayMode === 'document') {
      console.log('✅ [CategoryListView] Document-view collection detected - using direct navigation (bypassing Claude)');

      // Save scroll position to sessionStorage before navigating away
      const scrollContainer = document.querySelector('.artifact-content');
      if (scrollContainer) {
        const scrollPosition = scrollContainer.scrollTop;
        sessionStorage.setItem('categoryListScrollPosition', scrollPosition.toString());
        sessionStorage.setItem('categoryListBackNavigation', 'true');
        console.log('💾 [CategoryListView] Saving scroll position to sessionStorage:', scrollPosition);
      }

      // Use direct navigation - this will call navigateToDocuments() which checks displayMode
      onSelectCategory(category);
      return;
    }

    // For other categories with onSendMessage, send to Claude
    if (onSendMessage && patientName) {
      // Map category name to natural language request
      const categoryRequests = {
        'medications': `show medications for ${patientName}`,
        'allergies': `show allergies for ${patientName}`,
        'lab_results': `show lab results for ${patientName}`,
        'vital_signs': `show vital signs for ${patientName}`,
        'diagnoses': `show diagnoses for ${patientName}`,
        'imaging_reports': `show imaging reports for ${patientName}`,
        'consultation_notes': `show consultation notes for ${patientName}`,
        'clinical_decision_support': `show clinical decision support for ${patientName}`,
        'follow_up_intelligence': `show follow up intelligence for ${patientName}`,
        'medication_optimization': `show medication optimization for ${patientName}`,
        'allergy_immunology_assessment': `show allergy immunology assessment for ${patientName}`,
        'administrative_data': `show administrative data for ${patientName}`,
        'discharge_summaries': `show discharge summaries for ${patientName}`,
        'hospital_discharge_summaries': `show hospital discharge summaries for ${patientName}`,
        'anesthesia_records': `show anesthesia records for ${patientName}`
      };

      const message = categoryRequests[category.name] || `show ${category.displayName} for ${patientName}`;
      console.log('📤 [CategoryListView] Sending message to Claude:', message);

      // Set loading state before sending message
      setLoadingCategory(category.name);

      // Send message to Claude - don't navigate, let Claude's response handle it
      onSendMessage(message);
    } else {
      // Fallback to old behavior if no onSendMessage callback
      console.log('⚠️ [CategoryListView] No onSendMessage callback, using direct navigation');

      // Save scroll position to sessionStorage before navigating away
      const scrollContainer = document.querySelector('.artifact-content');
      if (scrollContainer) {
        const scrollPosition = scrollContainer.scrollTop;
        sessionStorage.setItem('categoryListScrollPosition', scrollPosition.toString());
        sessionStorage.setItem('categoryListBackNavigation', 'true');
        console.log('💾 [CategoryListView] Saving scroll position to sessionStorage:', scrollPosition);
      }

      // Pass full category object including displayMode
      onSelectCategory(category);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="category-list-view">
        <div className="category-header">
          <h2>Medical Data</h2>
          <p className="category-subtitle">Loading categories...</p>
        </div>
        <div className="category-loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="category-list-view">
        <div className="category-header">
          <h2>Medical Data</h2>
        </div>
        <div className="category-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={fetchCategories} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (categories.length === 0) {
    return (
      <div className="category-list-view">
        <div className="category-header">
          <h2>Medical Data</h2>
          <p className="category-subtitle">No medical data available</p>
        </div>
        <div className="category-empty">
          <div className="empty-icon">📄</div>
          <p>No medical records found for this patient.</p>
        </div>
      </div>
    );
  }

  // Infer icon from category name if not provided
  const getIconForCategory = (category) => {
    if (category.icon) return category.icon;

    // Fallback inference based on category name
    const name = category.name.toLowerCase();

    if (name.includes('medication') || name.includes('prescription')) return '💊';
    if (name.includes('allerg')) return '⚠️';
    if (name.includes('lab') || name.includes('test')) return '🔬';
    if (name.includes('vital')) return '❤️';
    if (name.includes('imaging') || name.includes('xray') || name.includes('scan')) return '📷';
    if (name.includes('diagnos')) return '📋';
    if (name.includes('procedure') || name.includes('surgery')) return '🔪';
    if (name.includes('appointment') || name.includes('follow')) return '📅';
    if (name.includes('cardio') || name.includes('heart')) return '❤️';
    if (name.includes('clinical_decision') || name.includes('intelligent')) return '🤖';
    if (name.includes('trend') || name.includes('analys')) return '📈';
    if (name.includes('education')) return '📚';
    if (name.includes('administrative')) return '📄';
    if (name.includes('discharge')) return '🏥';
    if (name.includes('consultation') || name.includes('note')) return '📝';
    if (name.includes('assessment')) return '📊';
    if (name.includes('anesthesia')) return '💉';
    if (name.includes('immunology')) return '🦠';

    return '📄'; // Default
  };

  // Success state - show category list
  return (
    <div className="category-list-view">
      {/* Loading overlay when fetching category data */}
      {loadingCategory && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(52, 53, 65, 0.95)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          gap: '16px'
        }}>
          <div className="loading-spinner" style={{
            width: '48px',
            height: '48px',
            border: '4px solid #565869',
            borderTop: '4px solid #10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{
            color: '#ececf1',
            fontSize: '16px',
            fontWeight: '500',
            margin: 0
          }}>
            Loading {categories.find(c => c.name === loadingCategory)?.displayName || 'data'}...
          </p>
          <p style={{
            color: '#9ca3af',
            fontSize: '13px',
            margin: 0
          }}>
            Claude is fetching the data
          </p>
        </div>
      )}

      <div className="category-header">
        <h2>Medical Data</h2>
        <p className="category-subtitle">
          {categories.length} {categories.length === 1 ? 'category' : 'categories'} available
        </p>
      </div>

      <div className="category-list">
        {categories.map((category) => (
          <div
            key={category.name}
            className="category-item"
            onClick={() => handleCategoryClick(category)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleCategoryClick(category);
              }
            }}
          >
            <div className="category-icon">{getIconForCategory(category)}</div>
            <div className="category-info">
              <div className="category-name">{category.displayName}</div>
              {category.description && (
                <div className="category-description">{category.description}</div>
              )}
              <div className="category-count">
                {category.count} {category.count === 1 ? 'document' : 'documents'}
              </div>
            </div>
            <div className="category-arrow">›</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryListView;
