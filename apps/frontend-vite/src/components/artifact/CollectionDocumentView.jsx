import React, { useState, useEffect, useRef } from 'react';
import secureApiClient from '../../services/secureApiClient';
import AIDocumentRenderer from './AIDocumentRenderer';
import { pdf } from '@react-pdf/renderer';
import PDFDocumentTemplate from './PDFDocumentTemplate';
import { saveAs } from 'file-saver';
import './CollectionDocumentView.css';

/**
 * CollectionDocumentView - Fetches and displays collection data as a document
 *
 * For AI collections, fetches all records and displays them beautifully
 * using AIDocumentRenderer (skips the document list, shows data directly)
 *
 * Props:
 * - patientId: string - Patient ID
 * - category: string - Category name (collection name)
 * - categoryDisplay: string - Display name for category
 * - onBack: function - Callback to go back to category list
 * - hasCategoriesList: boolean - Whether we came from the full categories list (vs direct command)
 */
const CollectionDocumentView = ({ patientId, category, categoryDisplay, onBack, onDataFetched, hasCategoriesList = false }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedFeedback, setCopiedFeedback] = useState(null);
  const [isPinned, setIsPinned] = useState(false);
  const contentRef = useRef(null);

  // CRITICAL: Track if we've already called onDataFetched for this category to prevent infinite loops
  // On page refresh, localStorage has artifactGridData which triggers this component to mount,
  // which fetches data, calls onDataFetched, which updates state, which can re-trigger renders
  const hasCalledOnDataFetchedRef = useRef(false);
  const lastFetchedCategoryRef = useRef(null);

  // Format category name - remove underscores and capitalize
  const formatCategoryName = (name) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // CRITICAL: Reset documents when category changes to prevent showing old data
  useEffect(() => {
    console.log('[CollectionDocumentView] Category changed to:', category);
    setDocuments([]); // Clear old documents before fetching new ones
    setLoading(true); // Show loading state
    setError(null);
    // Reset the onDataFetched guard when category changes (new category = new fetch allowed)
    if (lastFetchedCategoryRef.current !== category) {
      hasCalledOnDataFetchedRef.current = false;
    }
  }, [category]);

  // Fetch data when patientId or category changes
  useEffect(() => {
    fetchCollectionData();
  }, [patientId, category]);

  const fetchCollectionData = async () => {
    setLoading(true);
    setError(null);

    // Validate patientId before making API call
    if (!patientId || patientId === 'null' || patientId === 'undefined') {
      console.error('[CollectionDocumentView] Invalid patientId:', patientId);
      setError('No patient selected. Please select a patient first.');
      setLoading(false);
      return;
    }

    try {
      console.log(`[CollectionDocumentView] Fetching DOCUMENT data: ${category} for patient ${patientId}`);

      // Use /patient/:patientId/category/:categoryName/documents/all endpoint (returns full documents)
      const response = await secureApiClient.get(
        `/api/agent/patient/${patientId}/category/${category}/documents/all`
      );

      console.log('[CollectionDocumentView] Response:', response);

      if (response.success && response.data) {
        setDocuments(response.data);

        // Notify parent (ArtifactPanel → ChatContainer) that data was fetched
        // CRITICAL: Only call once per category to prevent infinite loops on page refresh
        // The loop: fetch → onDataFetched → setArtifactGridData → directGridData prop changes →
        // ArtifactPanel useEffect → potential state reset → re-render → re-fetch
        if (onDataFetched && !hasCalledOnDataFetchedRef.current) {
          console.log('[CollectionDocumentView] Calling onDataFetched with', response.data.length, 'documents (first call for this category)');
          hasCalledOnDataFetchedRef.current = true;
          lastFetchedCategoryRef.current = category;
          onDataFetched(response.data);
        } else if (onDataFetched && hasCalledOnDataFetchedRef.current) {
          console.log('[CollectionDocumentView] SKIPPING onDataFetched (already called for category:', category, ')');
        }
      } else {
        setError(response.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('[CollectionDocumentView] Error fetching data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    // Save scroll position before going back
    sessionStorage.setItem('categoryListBackNavigation', 'true');
    console.log('🔙 [CollectionDocumentView] Marked as back navigation');
    onBack();
  };

  // Export to PDF using @react-pdf/renderer (native PDF, not screenshots)
  const exportToPDF = async () => {
    try {
      console.log('Starting PDF export for category:', category);
      console.log('Documents to export:', documents);
      console.log('Document count:', documents.length);

      // Filter out null/undefined documents BEFORE rendering
      const validDocuments = documents.filter((doc, i) => {
        if (!doc) {
          console.error(`Document at index ${i} is null or undefined - FILTERING OUT`);
          return false;
        }
        console.log(`Document ${i} keys:`, Object.keys(doc));
        return true;
      });

      if (validDocuments.length === 0) {
        alert('No valid documents to export');
        return;
      }

      console.log(`Filtered: ${documents.length} → ${validDocuments.length} valid documents`);

      setCopiedFeedback('exporting-pdf');

      // Generate PDF blob using @react-pdf/renderer
      const blob = await pdf(
        <PDFDocumentTemplate
          category={category}
          categoryDisplay={categoryDisplay}
          documents={validDocuments}
          patientName={null} // TODO: Add patient name if available
        />
      ).toBlob();

      console.log('PDF generated successfully, blob size:', blob.size);

      // Download the PDF
      const fileName = `${categoryDisplay || formatCategoryName(category)}_${new Date().toISOString().split('T')[0]}.pdf`;
      saveAs(blob, fileName);

      setCopiedFeedback('exported-pdf');
      setTimeout(() => setCopiedFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      console.error('Error stack:', err.stack);
      alert(`PDF Export Error: ${err.message}`);
      setCopiedFeedback('error');
      setTimeout(() => setCopiedFeedback(null), 2000);
    }
  };

  // Copy all document text to clipboard
  const copyAllText = async () => {
    try {
      const element = contentRef.current;
      if (!element) return;

      const text = element.innerText;

      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      setCopiedFeedback('copied');
      setTimeout(() => setCopiedFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Toggle pin to sidebar
  const togglePin = () => {
    try {
      const existingPins = JSON.parse(localStorage.getItem('pinnedDocuments') || '[]');

      if (isPinned) {
        // Unpin
        const updated = existingPins.filter(pin =>
          !(pin.category === category && pin.patientId === patientId)
        );
        localStorage.setItem('pinnedDocuments', JSON.stringify(updated));
        setIsPinned(false);
        setCopiedFeedback('unpinned');

        window.dispatchEvent(new Event('pinnedDocumentsUpdated'));
      } else {
        // Pin
        const pinData = {
          category,
          categoryDisplay: categoryDisplay || formatCategoryName(category),
          patientId,
          timestamp: new Date().toISOString(),
          recordCount: documents.length
        };
        existingPins.unshift(pinData);
        localStorage.setItem('pinnedDocuments', JSON.stringify(existingPins));
        setIsPinned(true);
        setCopiedFeedback('pinned');

        window.dispatchEvent(new Event('pinnedDocumentsUpdated'));
      }

      setTimeout(() => setCopiedFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Check if document is pinned
  useEffect(() => {
    try {
      const existingPins = JSON.parse(localStorage.getItem('pinnedDocuments') || '[]');
      const alreadyPinned = existingPins.some(pin =>
        pin.category === category && pin.patientId === patientId
      );
      setIsPinned(alreadyPinned);
    } catch (err) {
      console.error('Failed to check pin status:', err);
    }
  }, [category, patientId]);

  // Loading state
  if (loading) {
    return (
      <div className="collection-document-view">
        <div className="collection-document-header">
          <button onClick={handleBackClick} className="back-button">
            ‹ Back
          </button>
          <h2>{categoryDisplay || formatCategoryName(category)}</h2>
        </div>
        <div className="collection-document-loading">
          <div className="loading-spinner"></div>
          <p>Loading data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="collection-document-view">
        <div className="collection-document-header">
          <button onClick={handleBackClick} className="back-button">
            ‹ Back
          </button>
          <h2>{categoryDisplay || formatCategoryName(category)}</h2>
        </div>
        <div className="collection-document-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={fetchCollectionData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data
  if (!documents || documents.length === 0) {
    return (
      <div className="collection-document-view">
        <div className="collection-document-header">
          <button onClick={handleBackClick} className="back-button">
            ‹ Back
          </button>
          <h2>{categoryDisplay || formatCategoryName(category)}</h2>
        </div>
        <div className="collection-document-empty">
          <div className="empty-icon">📄</div>
          <p>No data found in this category.</p>
        </div>
      </div>
    );
  }

  // Success state - render ALL documents in one scrollable view
  // Sort by date descending (newest first)
  const sortedDocuments = [...documents].sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt || 0);
    const dateB = new Date(b.date || b.createdAt || 0);
    return dateB - dateA; // Newest first
  });

  // Special handling for medications - show as unified list
  const isMedicationsList = category === 'medications' || category === 'current_medications';

  // Special handling for diagnoses - show as unified list
  const isDiagnosesList = category === 'diagnoses';

  // Special handling for recommendations - show as unified list
  const isRecommendationsList = category === 'recommendations';

  // Special handling for allergies - show as AllergiesDocument template (merged)
  const isAllergiesList = category === 'allergies';

  // Special handling for case_management - show as CaseManagementDocument template (merged view)
  const isCaseManagementList = category === 'case_management';

  // Special handling for allergy_immunology_assessment - show as AllergyImmunologyDocument template (merged view)
  const isAllergyImmunologyAssessment = category === 'allergy_immunology_assessment';

  // Special handling for allergy_assessments - show as merged assessment document
  const isAllergiesAssessments = category === 'allergy_assessments' || category === 'allergy_assessment' || category === 'allergy_skin_testing' || category === 'component_allergen_testing';

  // AI template collections that need merged view (all records wrapped as { [category]: records })
  // These templates accept all records in a single instance for cross-record search, copy-all, and PDF export
  // Uses dynamic { [category]: sortedDocuments } wrapping - no HMR refresh needed when adding new templates
  const AI_MERGED_COLLECTIONS = new Set([
    'eeg_reports',
    'epilepsy_assessment',
    'headache_assessment',
  ]);
  const isAIMergedCollection = AI_MERGED_COLLECTIONS.has(category);

  console.log('[CollectionDocumentView] Rendering with:', {
    category,
    isMedicationsList,
    isDiagnosesList,
    isRecommendationsList,
    isAllergiesList,
    isAllergyImmunologyAssessment,
    isAllergiesAssessments,
    isCaseManagementList,
    isAIMergedCollection,
    documentsLength: documents.length
  });

  return (
    <div className="collection-document-view">
      <div className="collection-document-header">
        <button onClick={handleBackClick} className="back-button">
          ‹ Back
        </button>
        <h2>{categoryDisplay || formatCategoryName(category)}</h2>
        <span className="document-count">
          {documents.length} {documents.length === 1 ? 'record' : 'records'}
        </span>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
          {/* Copy All Button */}
          <button
            onClick={copyAllText}
            style={{
              background: copiedFeedback === 'copied' ? '#9ca3af' : '#565869',
              color: '#ececf1',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
            title="Copy all text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {copiedFeedback === 'copied' ? 'Copied!' : 'Copy'}
          </button>

          {/* Export PDF Button */}
          <button
            onClick={exportToPDF}
            style={{
              background: copiedFeedback === 'exported-pdf' ? '#9ca3af' : '#565869',
              color: '#ececf1',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
            title="Export to PDF"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            {copiedFeedback === 'exported-pdf' ? 'Exported!' : copiedFeedback === 'exporting-pdf' ? 'Exporting...' : 'PDF'}
          </button>

          {/* Pin Button */}
          <button
            onClick={togglePin}
            style={{
              background: copiedFeedback === 'pinned' || copiedFeedback === 'unpinned' ? '#9ca3af' : (isPinned ? '#6b7280' : '#565869'),
              color: '#ececf1',
              border: isPinned ? '1px solid #8e8ea0' : 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
            title={isPinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 17v5"/>
              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
            </svg>
            {copiedFeedback === 'pinned' ? 'Pinned!' : copiedFeedback === 'unpinned' ? 'Unpinned!' : (isPinned ? 'Unpin' : 'Pin')}
          </button>
        </div>
      </div>

      <div ref={contentRef} className="collection-document-content">
        {isMedicationsList ? (
          // Unified list view for medications
          <div className="ai-document-content">
            <section className="ai-section">
              <h2 className="ai-section-title" style={{ color: '#b4d4ff', marginBottom: '24px' }}>
                💊 Medications List
              </h2>

              {sortedDocuments.map((doc, index) => {
                const medName = doc.medicationName || doc.name;
                const prescriber = doc.prescribedBy || doc.prescriber;
                const indication = doc.reason || doc.indication;
                const isActive = doc.active !== undefined ? doc.active : (doc.status?.toLowerCase() === 'active');

                return (
                  <div
                    key={doc._id || index}
                    className="ai-card"
                    style={{
                      borderLeft: '4px solid #b4d4ff',
                      marginBottom: '16px',
                      padding: '16px'
                    }}
                  >
                    {/* Medication Name & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 style={{ color: '#ececf1', fontSize: '1.15em', margin: 0 }}>
                        {medName || 'Medication'}
                      </h3>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.75em',
                        fontWeight: 'bold',
                        backgroundColor: isActive ? '#b4d4ff22' : '#9ca3af22',
                        color: isActive ? '#b4d4ff' : '#9ca3af',
                        border: `1px solid ${isActive ? '#b4d4ff' : '#9ca3af'}`,
                        whiteSpace: 'nowrap'
                      }}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Dosage, Frequency, Route */}
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: '#ececf1', fontSize: '0.95em' }}>
                        <strong>{doc.dosage}</strong> - {doc.frequency}
                        {doc.route && <span style={{ color: '#9ca3af' }}> ({doc.route})</span>}
                      </span>
                    </div>

                    {/* Grid layout for additional info */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '8px',
                      marginTop: '12px',
                      fontSize: '0.9em'
                    }}>
                      {prescriber && (
                        <div style={{ color: '#9ca3af' }}>
                          <strong style={{ color: '#b4d4ff' }}>Prescriber:</strong> {prescriber}
                        </div>
                      )}

                      {doc.startDate && (
                        <div style={{ color: '#9ca3af' }}>
                          <strong style={{ color: '#b4d4ff' }}>Started:</strong> {new Date(doc.startDate).toLocaleDateString()}
                        </div>
                      )}

                      {indication && (
                        <div style={{ color: '#9ca3af' }}>
                          <strong style={{ color: '#b4d4ff' }}>Indication:</strong> {indication}
                        </div>
                      )}
                    </div>

                    {/* Instructions (if present) */}
                    {doc.instructions && doc.instructions.trim() && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#1a1a1a',
                        borderRadius: '6px',
                        fontSize: '0.85em'
                      }}>
                        <strong style={{ color: '#b4d4ff' }}>Instructions:</strong>
                        <span style={{ marginLeft: '8px', color: '#ececf1' }}>{doc.instructions}</span>
                      </div>
                    )}

                    {/* Notes (if present) */}
                    {doc.notes && doc.notes.trim() && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: 'transparent',
                        borderRadius: '6px',
                        fontSize: '0.85em',
                        borderLeft: '3px solid #b4d4ff'
                      }}>
                        <strong style={{ color: '#b4d4ff' }}>Notes:</strong>
                        <span style={{ marginLeft: '8px', color: '#ececf1' }}>{doc.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        ) : isDiagnosesList ? (
          // Unified list view for diagnoses
          <div className="ai-document-content">
            <section className="ai-section">
              <h2 className="ai-section-title" style={{ color: '#6366f1', marginBottom: '24px' }}>
                🏥 Diagnoses List
              </h2>

              {sortedDocuments.map((doc, index) => {
                const isActive = doc.status?.toLowerCase() === 'active';
                const statusColor = isActive ? '#4ade80' : '#9ca3af';

                return (
                  <div
                    key={doc._id || index}
                    className="ai-card"
                    style={{
                      borderLeft: `4px solid ${statusColor}`,
                      marginBottom: '16px',
                      padding: '16px',
                      backgroundColor: 'transparent'
                    }}
                  >
                    {/* Diagnosis Name & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 style={{ color: '#ececf1', fontSize: '1.15em', margin: 0 }}>
                        {doc.diagnosis || 'Diagnosis'}
                      </h3>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.75em',
                        fontWeight: 'bold',
                        backgroundColor: isActive ? '#4ade8022' : '#9ca3af22',
                        color: statusColor,
                        border: `1px solid ${statusColor}`,
                        whiteSpace: 'nowrap',
                        textTransform: 'capitalize'
                      }}>
                        {doc.status || 'Unknown'}
                      </span>
                    </div>

                    {/* ICD Code */}
                    {doc.icdCode && doc.icdCode.trim() && (
                      <div style={{ marginBottom: '12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8em',
                          fontWeight: 'bold',
                          backgroundColor: '#6366f122',
                          color: '#6366f1',
                          border: '1px solid #6366f1',
                          fontFamily: 'monospace'
                        }}>
                          ICD-10: {doc.icdCode}
                        </span>
                      </div>
                    )}

                    {/* Info Grid - Date & Provider */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      {/* Date */}
                      {doc.date && (
                        <div>
                          <span style={{ color: '#9ca3af', fontSize: '0.75em' }}>Date: </span>
                          <span style={{ color: '#ececf1', fontSize: '0.9em' }}>
                            {new Date(doc.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      )}

                      {/* Diagnosed By */}
                      {doc.diagnosedBy && doc.diagnosedBy.trim() && (
                        <div>
                          <span style={{ color: '#9ca3af', fontSize: '0.75em' }}>Provider: </span>
                          <span style={{ color: '#ececf1', fontSize: '0.9em' }}>
                            {doc.diagnosedBy}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Notes (if present) */}
                    {doc.notes && doc.notes.trim() && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: 'transparent',
                        borderRadius: '6px',
                        fontSize: '0.85em',
                        borderLeft: '3px solid #ffd93d'
                      }}>
                        <strong style={{ color: '#ffd93d' }}>Notes:</strong>
                        <span style={{ marginLeft: '8px', color: '#ececf1' }}>{doc.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        ) : isRecommendationsList ? (
          // Unified list view for recommendations
          <div className="ai-document-content">
            <section className="ai-section">
              <h2 className="ai-section-title" style={{ color: '#6366f1', marginBottom: '24px' }}>
                📋 Follow-up Recommendations
              </h2>

              {sortedDocuments.map((doc, index) => (
                <div
                  key={doc._id || index}
                  className="ai-card"
                  style={{
                    borderLeft: '4px solid #6366f1',
                    marginBottom: '16px',
                    padding: '16px'
                  }}
                >
                  {/* Specialty & Date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ color: '#6366f1', margin: '0 0 8px 0', fontSize: '1.15em' }}>
                        {doc.specialty || 'Follow-up'}
                      </h3>
                      {doc.type && (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75em',
                          fontWeight: '500',
                          backgroundColor: '#6366f144',
                          color: '#a5b4fc',
                          border: '1px solid #6366f166',
                          textTransform: 'capitalize'
                        }}>
                          {doc.type}
                        </span>
                      )}
                    </div>
                    {doc.date && (
                      <div style={{
                        color: '#9ca3af',
                        fontSize: '0.85em',
                        whiteSpace: 'nowrap',
                        marginLeft: '16px'
                      }}>
                        {new Date(doc.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  {doc.reason && (
                    <p style={{ color: '#ececf1', fontSize: '0.95em', lineHeight: '1.6', margin: '0 0 12px 0' }}>
                      {doc.reason}
                    </p>
                  )}

                  {/* Optional fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {doc.timing && doc.timing.trim() && (
                      <div style={{ color: '#9ca3af', fontSize: '0.85em' }}>
                        <strong style={{ color: '#6366f1' }}>Timing:</strong> {doc.timing}
                      </div>
                    )}
                    {doc.provider && doc.provider.trim() && (
                      <div style={{ color: '#9ca3af', fontSize: '0.85em' }}>
                        <strong style={{ color: '#6366f1' }}>Provider:</strong> {doc.provider}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </div>
        ) : isAllergiesList ? (
          // Render allergies through AllergiesDocument template (merged view)
          // Wrap the documents array as the backend does with WRAP_ALL_RECORDS_COLLECTIONS
          <AIDocumentRenderer
            document={{ allergies: sortedDocuments }}
            category={category}
            onSave={(updatedDoc) => {
              console.log('Save clicked:', updatedDoc);
            }}
          />
        ) : isAllergyImmunologyAssessment ? (
          // Render allergy & immunology assessment through AllergyImmunologyDocument template (merged view)
          // Wrap the documents array as the backend does with WRAP_ALL_RECORDS_COLLECTIONS
          <AIDocumentRenderer
            document={{ allergy_immunology_assessment: sortedDocuments }}
            category={category}
            onSave={(updatedDoc) => {
              console.log('Save clicked:', updatedDoc);
            }}
          />
        ) : isAllergiesAssessments ? (
          // Render allergies assessments through AllergiesAssessmentDocument template (merged view)
          // Wrap the documents array as the backend does with WRAP_ALL_RECORDS_COLLECTIONS
          <AIDocumentRenderer
            document={{ [category]: sortedDocuments }}
            category={category}
            onSave={(updatedDoc) => {
              console.log('Save clicked:', updatedDoc);
            }}
          />
        ) : isCaseManagementList ? (
          // Render case_management through CaseManagementDocument template (merged view)
          // Wrap the documents array as the backend does with WRAP_ALL_RECORDS_COLLECTIONS
          <AIDocumentRenderer
            document={{ case_management: sortedDocuments }}
            category={category}
            onSave={(updatedDoc) => {
              console.log('Save clicked:', updatedDoc);
            }}
          />
        ) : isAIMergedCollection ? (
          // AI templates with merged view - wrap all records as { [category]: records }
          // Templates handle cross-record search, copy-all, and PDF export internally
          <AIDocumentRenderer
            document={{ [category]: sortedDocuments }}
            category={category}
            onSave={(updatedDoc) => {
              console.log('Save clicked:', updatedDoc);
            }}
          />
        ) : (
          // Default: Render each document separately
          sortedDocuments.map((doc, index) => (
            <div key={doc._id || index} className="document-section">
              {/* Add separator between documents */}
              {index > 0 && <div className="document-separator"></div>}

              <AIDocumentRenderer
                document={doc}
                category={category}
                onSave={(updatedDoc) => {
                  // TODO: Implement save functionality
                  console.log('Save clicked:', updatedDoc);
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CollectionDocumentView;