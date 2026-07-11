import React, { useState, useEffect } from 'react';
import DocumentListItem from './DocumentListItem';
import './DocumentListView.css';

/**
 * DocumentListView - Level 2 of artifact navigation
 *
 * Displays a list of documents in a specific category.
 * Shows document title, preview, and date (newest first).
 *
 * Props:
 * - patientId: string - Patient ID
 * - category: string - Category name (collection name)
 * - onSelectDocument: function(document) - Callback when document is clicked
 * - onBack: function - Callback to go back to category list
 * - initialDocuments: array - Optional pre-fetched documents from Claude function result
 */
const DocumentListView = ({ patientId, category, onSelectDocument, onBack, initialDocuments }) => {
  const [documents, setDocuments] = useState(initialDocuments || []);
  const [categoryDisplay, setCategoryDisplay] = useState('');
  const [loading, setLoading] = useState(!initialDocuments); // Skip loading if we have initial data
  const [error, setError] = useState(null);

  // Format category name - remove underscores and capitalize
  const formatCategoryName = (name, useSingular = false) => {
    let formatted = name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    // Convert to singular form if requested (for individual document titles)
    if (useSingular) {
      // Words that end in 's' but are NOT plurals (the 's' is part of the word)
      const noSingularize = [
        'prognosis', 'diagnosis', 'analysis', 'synopsis', 'thesis', 'crisis',
        'basis', 'dialysis', 'psoriasis', 'sepsis', 'status', 'consensus'
      ];
      const lowerFormatted = formatted.toLowerCase();
      const shouldSkip = noSingularize.some(word => lowerFormatted.endsWith(word));

      if (!shouldSkip) {
        if (formatted.endsWith('ies')) {
          formatted = formatted.slice(0, -3) + 'y';
        } else if (formatted.endsWith('s')) {
          formatted = formatted.slice(0, -1);
        }
      }
    }

    return formatted;
  };

  useEffect(() => {
    // CRITICAL: Documents MUST come from Claude function results (no API fallback)
    if (initialDocuments) {
      console.log('[DocumentListView] Using pre-fetched documents from Claude:', initialDocuments.length);
      setDocuments(initialDocuments);
      setCategoryDisplay(formatCategoryName(category));
      setLoading(false);

      // Persist to localStorage for page refresh
      const storageKey = `artifactDocuments_${patientId}_${category}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(initialDocuments));
        console.log('[DocumentListView] Persisted documents to localStorage:', storageKey);
      } catch (err) {
        console.error('[DocumentListView] Failed to persist documents:', err);
      }
      return;
    }

    // If no initialDocuments (page refresh), try to restore from localStorage
    const storageKey = `artifactDocuments_${patientId}_${category}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const restoredDocs = JSON.parse(stored);
        console.log('[DocumentListView] Restored documents from localStorage on page refresh:', restoredDocs.length);
        setDocuments(restoredDocs);
        setCategoryDisplay(formatCategoryName(category));
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('[DocumentListView] Failed to restore documents from localStorage:', err);
    }

    // No documents provided and no localStorage - show error
    console.error('[DocumentListView] ERROR: No initialDocuments provided and no localStorage! Documents must come from Claude function results.');
    setError('No document data available. Please ask Claude to fetch the documents.');
    setLoading(false);
  }, [patientId, category, initialDocuments]);

  const handleDocumentClick = (document) => {
    console.log('[DocumentListView] Document clicked:', {
      id: document._id,
      title: document.title,
      hasAllFields: {
        _id: !!document._id,
        title: !!document.title,
        date: !!document.date,
        preview: !!document.preview
      }
    });
    onSelectDocument(document);
  };

  const handleBackClick = () => {
    // Mark as back navigation so CategoryListView can restore scroll position
    sessionStorage.setItem('categoryListBackNavigation', 'true');
    console.log('🔙 [DocumentListView] Marked as back navigation');
    onBack();
  };

  // Loading state
  if (loading) {
    return (
      <div className="document-list-view">
        <div className="document-list-header">
          <button
            onClick={handleBackClick}
            className="back-button"
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #243B66 0%, #2E4F86 100%)',
              color: '#ececf1',
              border: '1px solid #667eea',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #3D8BFF 0%, #2E4F86 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #243B66 0%, #2E4F86 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <h2>{categoryDisplay || 'Loading...'}</h2>
        </div>
        <div className="document-loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="document-list-view">
        <div className="document-list-header">
          <button
            onClick={handleBackClick}
            className="back-button"
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #243B66 0%, #2E4F86 100%)',
              color: '#ececf1',
              border: '1px solid #667eea',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #3D8BFF 0%, #2E4F86 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #243B66 0%, #2E4F86 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <h2>{categoryDisplay || 'Error'}</h2>
        </div>
        <div className="document-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (documents.length === 0) {
    return (
      <div className="document-list-view">
        <div className="document-list-header">
          <button
            onClick={handleBackClick}
            className="back-button"
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #243B66 0%, #2E4F86 100%)',
              color: '#ececf1',
              border: '1px solid #667eea',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #3D8BFF 0%, #2E4F86 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #243B66 0%, #2E4F86 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <h2>{categoryDisplay}</h2>
        </div>
        <div className="document-empty">
          <div className="empty-icon">📄</div>
          <p>No documents found in this category.</p>
        </div>
      </div>
    );
  }

  // Success state - show document list
  return (
    <div className="document-list-view">
      <div className="document-list-header">
        <button
          onClick={handleBackClick}
          className="back-button"
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #243B66 0%, #2E4F86 100%)',
            color: '#ececf1',
            border: '1px solid #667eea',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #3D8BFF 0%, #2E4F86 100%)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #243B66 0%, #2E4F86 100%)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h2>{categoryDisplay}</h2>
        <p className="document-count">
          {documents.length} {documents.length === 1 ? 'document' : 'documents'}
        </p>
      </div>

      <div className="document-list">
        {documents.map((document) => (
          <DocumentListItem
            key={document._id}
            document={document}
            onClick={() => handleDocumentClick(document)}
            categoryName={formatCategoryName(category, true)}
          />
        ))}
      </div>
    </div>
  );
};

export default DocumentListView;
