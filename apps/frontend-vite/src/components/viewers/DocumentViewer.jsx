import React, { useState, useEffect } from 'react';
import secureApi from '../../services/secureApiClient';
import secureStorage from '../../utils/secureStorage';
import './DocumentViewer.css';

const DocumentViewer = ({ patientId, language }) => {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [documentContent, setDocumentContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  
  const isRTL = language === 'he';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch real documents from backend
  useEffect(() => {
    const fetchDocuments = async () => {
      process.env.NODE_ENV !== 'production' && console.log(`[DocumentViewer] useEffect triggered - patientId: ${patientId}`);
      if (!patientId) {
        process.env.NODE_ENV !== 'production' && console.log(`[DocumentViewer] No patientId provided, clearing documents`);
        setDocuments([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Build correct API URL with subdomain
        process.env.NODE_ENV !== 'production' && console.log(`[DocumentViewer] Fetching documents for patient ${patientId}`);
        process.env.NODE_ENV !== 'production' && console.log(`[DocumentViewer] Using subdomain: ${subdomain}, token: ${secureStorage.getItem('token') ? 'Present' : 'Missing'}`);
        
        const result = await secureApi.get(`/documents/patient/${patientId}`);
        
        process.env.NODE_ENV !== 'production' && console.log(`[DocumentViewer] Response received`);
        
        if (result.error) {
          process.env.NODE_ENV !== 'production' && console.error(`[DocumentViewer] Error response:`, result.error);
          throw new Error(`Failed to fetch documents: ${result.error}`);
        }
        process.env.NODE_ENV !== 'production' && console.log(`[DocumentViewer] API result:`, result);
        
        if (result.success && result.data) {
          process.env.NODE_ENV !== 'production' && console.log(`[DocumentViewer] Found ${result.data.length} documents`);
          process.env.NODE_ENV !== 'production' && console.log(`[DocumentViewer] First document raw data:`, result.data[0]);
          // Transform backend data to display format
          const transformedDocs = result.data.map(doc => {
            // Handle both formats: direct from API and from agent
            const documentName = doc.name || doc.originalName || doc.fileName;
            const uploadDate = doc.date || doc.uploadDate || doc.uploadedAt || doc.metadata?.uploadDate || doc.createdAt;
            const fileSize = doc.size || doc.fileSize || doc.metadata?.size || 0;
            
            // Get category from AI classification or organized folder
            const aiCategory = doc.aiClassification?.documentType;
            const category = doc.category || aiCategory || doc.organizedFolder || doc.fileType || doc.type || 'general';
            
            process.env.NODE_ENV !== 'production' && console.log(`[DocumentViewer] Document ${documentName}:`, {
              analysisResults: doc.analysisResults,
              aiClassification: doc.aiClassification,
              date: uploadDate,
              category: category
            });
            
            // Format date properly
            let formattedDate = '-';
            if (uploadDate) {
              try {
                const dateObj = new Date(uploadDate);
                if (!isNaN(dateObj.getTime())) {
                  formattedDate = dateObj.toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
                }
              } catch (e) {
                process.env.NODE_ENV !== 'production' && console.error('Error formatting date:', e);
              }
            }
            
            return {
              id: doc.id || doc._id,
              name: documentName,
              type: category, // Use actual category for filtering
              date: formattedDate,
              size: typeof fileSize === 'string' ? fileSize : formatFileSize(fileSize),
              category: getCategoryFromType(category, isRTL),
              icon: getIconForType(category),
              status: aiCategory ? 'reviewed' : 'new',
              aiInsights: doc.analysisResults || doc.aiClassification,
              rawData: doc // Keep original data for actions
            };
          });
          
          setDocuments(transformedDocs);
        } else {
          setDocuments([]);
        }
      } catch (err) {
        process.env.NODE_ENV !== 'production' && console.error('Error fetching documents:', err);
        setError(err.message);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocuments();
  }, [patientId, isRTL]);
  
  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  // Helper function to get category from type
  const getCategoryFromType = (type, isRTL) => {
    const categories = {
      'lab_results': isRTL ? 'תוצאות מעבדה' : 'Lab Results',
      'prescriptions': isRTL ? 'מרשמים' : 'Prescriptions',
      'imaging_reports': isRTL ? 'דוחות הדמיה' : 'Imaging Reports',
      'consultation_notes': isRTL ? 'הערות ייעוץ' : 'Consultation Notes',
      'discharge_summary': isRTL ? 'סיכום שחרור' : 'Discharge Summary',
      'vaccination_records': isRTL ? 'רישומי חיסונים' : 'Vaccination Records',
      'referrals': isRTL ? 'הפניות' : 'Referrals',
      'medical_certificate': isRTL ? 'אישור רפואי' : 'Medical Certificate',
      'medical_procedures': isRTL ? 'הליכים רפואיים' : 'Medical Procedures',
      'pdf': isRTL ? 'מסמך' : 'Document',
      'image': isRTL ? 'תמונה' : 'Image',
      'other': isRTL ? 'אחר' : 'Other'
    };
    return categories[type] || categories.other;
  };
  
  // Helper function to get icon for type
  const getIconForType = (type) => {
    const icons = {
      'lab_results': '🔬',
      'prescriptions': '💊',
      'imaging_reports': '🖼️',
      'consultation_notes': '📋',
      'discharge_summary': '🏥',
      'vaccination_records': '💉',
      'referrals': '📨',
      'medical_certificate': '📄',
      'medical_procedures': '⚕️',
      'pdf': '📄',
      'image': '🖼️',
      'other': '📁'
    };
    return icons[type] || icons.other;
  };
  
  // All 9 medical document categories from backend
  const categories = [
    { value: 'all', label: isRTL ? 'הכל' : 'All', icon: '📁' },
    { value: 'lab_results', label: isRTL ? 'תוצאות מעבדה' : 'Lab Results', icon: '🔬' },
    { value: 'prescriptions', label: isRTL ? 'מרשמים' : 'Prescriptions', icon: '💊' },
    { value: 'imaging_reports', label: isRTL ? 'דוחות הדמיה' : 'Imaging Reports', icon: '🖼️' },
    { value: 'consultation_notes', label: isRTL ? 'הערות ייעוץ' : 'Consultation Notes', icon: '📋' },
    { value: 'discharge_summary', label: isRTL ? 'סיכום שחרור' : 'Discharge Summary', icon: '🏥' },
    { value: 'vaccination_records', label: isRTL ? 'רישומי חיסונים' : 'Vaccination Records', icon: '💉' },
    { value: 'referrals', label: isRTL ? 'הפניות' : 'Referrals', icon: '📨' },
    { value: 'medical_certificate', label: isRTL ? 'אישור רפואי' : 'Medical Certificate', icon: '📄' },
    { value: 'medical_procedures', label: isRTL ? 'הליכים רפואיים' : 'Medical Procedures', icon: '⚕️' }
  ];
  
  const getStatusBadge = (status) => {
    const badges = {
      new: { color: '#ef4444', text: isRTL ? 'חדש' : 'New' },
      reviewed: { color: '#10b981', text: isRTL ? 'נבדק' : 'Reviewed' },
      active: { color: '#3b82f6', text: isRTL ? 'פעיל' : 'Active' },
      signed: { color: '#8b5cf6', text: isRTL ? 'חתום' : 'Signed' }
    };
    return badges[status] || { color: '#6b7280', text: status };
  };
  
  const filteredDocs = documents.filter(doc => {
    // Check category match - use either organizedFolder or aiClassification.documentType
    const docCategory = doc.rawData?.aiClassification?.documentType || 
                       doc.rawData?.organizedFolder || 
                       doc.type;
    const matchesFilter = filter === 'all' || docCategory === filter;
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  
  const handleDocumentClick = async (doc) => {
    setSelectedDoc(doc);
    setLoadingContent(true);
    setDocumentContent(null);
    setPdfZoom(1); // Reset zoom when opening new document
    setPanPosition({ x: 0, y: 0 }); // Reset pan position
    
    // Load actual document content
    try {
      const result = await secureApi.get(`/documents/view/${doc.id}`);
      
      if (!result.error) {
        if (result.success && result.data) {
          setDocumentContent(result.data);
        }
      } else {
        process.env.NODE_ENV !== 'production' && console.error('Failed to load document content');
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error loading document:', error);
    } finally {
      setLoadingContent(false);
    }
  };
  
  const handleUpload = () => {
    // In real app, would open file upload dialog
    process.env.NODE_ENV !== 'production' && console.log('Upload document');
  };
  
  const handleDownload = (doc) => {
    // In real app, would download the document
    process.env.NODE_ENV !== 'production' && console.log('Download:', doc.name);
  };
  
  // Helper function to translate common medical values to Hebrew
  const translateMedicalValue = (value, isRTL) => {
    if (!isRTL || !value) return value;
    
    const translations = {
      'Positive': 'חיובי',
      'Negative': 'שלילי',
      'SARS-CoV-2 Antigen: Positive': 'בדיקת אנטיגן SARS-CoV-2: חיובי',
      'SARS-CoV-2 Antigen: Negative': 'בדיקת אנטיגן SARS-CoV-2: שלילי',
      'Must act according to Ministry of Health guidelines for entering isolation.': 'יש לפעול בהתאם להנחיות משרד הבריאות לכניסה לבידוד.',
      'Normal': 'תקין',
      'Abnormal': 'לא תקין',
      'High': 'גבוה',
      'Low': 'נמוך'
    };
    
    // Check if the entire value matches a translation
    if (translations[value]) {
      return translations[value];
    }
    
    // Check if value contains translatable parts
    let translatedValue = value;
    Object.entries(translations).forEach(([eng, heb]) => {
      translatedValue = translatedValue.replace(eng, heb);
    });
    
    return translatedValue;
  };
  
  const handleShare = (doc) => {
    // In real app, would share the document
    process.env.NODE_ENV !== 'production' && console.log('Share:', doc.name);
  };
  
  // PDF zoom and pan handlers
  const handleZoomIn = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setPdfZoom(prev => Math.min(prev + 0.25, 3));
  };
  
  const handleZoomOut = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setPdfZoom(prev => Math.max(prev - 0.25, 0.5));
  };
  
  const handleResetZoom = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setPdfZoom(1);
    setPanPosition({ x: 0, y: 0 });
  };
  
  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setStartPan({
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y
      });
      e.preventDefault();
    }
  };
  
  const handleMouseMove = (e) => {
    if (isPanning) {
      setPanPosition({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsPanning(false);
  };
  
  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setPdfZoom(prev => Math.min(Math.max(prev + delta, 0.5), 3));
    }
  };
  
  const handleDelete = async (doc) => {
    if (!window.confirm(isRTL ? 
      `האם אתה בטוח שברצונך למחוק את "${doc.name}"?` : 
      `Are you sure you want to delete "${doc.name}"?`)) {
      return;
    }
    
    try {
      const result = await secureApi.delete(`/documents/${doc.id}`);
      
      if (!result.error) {
        // Remove from local state
        setDocuments(prevDocs => prevDocs.filter(d => d.id !== doc.id));
        // Close modal if this document was selected
        if (selectedDoc?.id === doc.id) {
          setSelectedDoc(null);
        }
        process.env.NODE_ENV !== 'production' && console.log(`✅ Document deleted: ${doc.name}`);
      } else {
        process.env.NODE_ENV !== 'production' && console.error('Failed to delete document');
        alert(isRTL ? 'שגיאה במחיקת המסמך' : 'Error deleting document');
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error deleting document:', error);
      alert(isRTL ? 'שגיאה במחיקת המסמך' : 'Error deleting document');
    }
  };
  
  return (
    <div className={`document-viewer ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header with Search and Actions */}
      <div className="doc-header">
        <div className="doc-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder={isRTL ? 'חיפוש מסמכים...' : 'Search documents...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="doc-actions">
          <button className="upload-button" onClick={handleUpload}>
            ⬆️ {isRTL ? 'העלה' : 'Upload'}
          </button>
          <div className="view-toggle">
            <button 
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title={isRTL ? 'תצוגת רשת' : 'Grid view'}
            >
              ⚏
            </button>
            <button 
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title={isRTL ? 'תצוגת רשימה' : 'List view'}
            >
              ☰
            </button>
          </div>
        </div>
      </div>
      
      {/* Category Filter */}
      <div className="category-filter">
        {categories.map(cat => (
          <button
            key={cat.value}
            className={`filter-button ${filter === cat.value ? 'active' : ''}`}
            onClick={() => setFilter(cat.value)}
          >
            <span className="filter-icon">{cat.icon}</span>
            <span className="filter-label">{cat.label}</span>
            {filter === cat.value && (
              <span className="filter-count">
                ({filteredDocs.length})
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Documents Display */}
      <div className={`documents-container ${viewMode}`}>
        {filteredDocs.length === 0 ? (
          <div className="no-documents">
            <span className="empty-icon">📄</span>
            <p>{isRTL ? 'אין מסמכים להצגה' : 'No documents to display'}</p>
          </div>
        ) : (
          <div className={`documents-${viewMode}`}>
            {filteredDocs.map(doc => {
              const statusBadge = getStatusBadge(doc.status);
              return (
                <div 
                  key={doc.id} 
                  className={`document-item ${viewMode}`}
                  onClick={() => handleDocumentClick(doc)}
                >
                  <div className="doc-icon">{doc.icon}</div>
                  <div className="doc-info">
                    <div className="doc-name">{doc.name}</div>
                    <div className="doc-meta">
                      <span className="doc-date">
                        {new Date(doc.date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}
                      </span>
                      <span className="doc-size">{doc.size}</span>
                      <span 
                        className="doc-status"
                        style={{ backgroundColor: statusBadge.color }}
                      >
                        {statusBadge.text}
                      </span>
                    </div>
                  </div>
                  <div className="doc-actions-inline">
                    <button 
                      className="action-icon"
                      onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                      title={isRTL ? 'הורד' : 'Download'}
                    >
                      ⬇️
                    </button>
                    <button 
                      className="action-icon"
                      onClick={(e) => { e.stopPropagation(); handleShare(doc); }}
                      title={isRTL ? 'שתף' : 'Share'}
                    >
                      🔗
                    </button>
                    <button 
                      className="action-icon"
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                      title={isRTL ? 'מחק' : 'Delete'}
                      style={{ color: '#dc3545' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Document Preview Modal (if selected) */}
      {selectedDoc && (
        <div className="doc-preview-modal" onClick={() => setSelectedDoc(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedDoc.name}</h3>
              <button className="close-button" onClick={() => setSelectedDoc(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', gap: '20px', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {/* Document Content Preview - Left Side */}
              <div style={{ flex: '1 1 60%', minWidth: '0' }}>
                {loadingContent ? (
                  <div className="preview-placeholder">
                    <div className="loading-spinner" style={{ margin: '50px auto', fontSize: '24px' }}>⏳</div>
                    <p>{isRTL ? 'טוען מסמך...' : 'Loading document...'}</p>
                  </div>
                ) : documentContent && !documentContent.message ? (
                  <>
                    {documentContent.contentType?.startsWith('image/') && documentContent.content ? (
                      <img 
                        src={`data:${documentContent.contentType};base64,${documentContent.content}`}
                        alt={documentContent.fileName}
                        style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }}
                      />
                    ) : documentContent.contentType === 'application/pdf' && documentContent.content ? (
                      <div style={{ position: 'relative', height: '500px', overflow: 'hidden' }}>
                        {/* Zoom Controls */}
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          left: isRTL ? 'auto' : '10px',
                          right: isRTL ? '10px' : 'auto',
                          zIndex: 1000,
                          display: 'flex',
                          gap: '5px',
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          padding: '5px',
                          borderRadius: '5px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          <button 
                            onClick={(e) => handleZoomIn(e)}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              padding: '5px 10px',
                              cursor: 'pointer',
                              border: '1px solid #ddd',
                              borderRadius: '3px',
                              backgroundColor: '#fff'
                            }}
                            title={isRTL ? 'הגדל' : 'Zoom In'}
                            type="button"
                          >
                            ➕
                          </button>
                          <button 
                            onClick={(e) => handleZoomOut(e)}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              padding: '5px 10px',
                              cursor: 'pointer',
                              border: '1px solid #ddd',
                              borderRadius: '3px',
                              backgroundColor: '#fff'
                            }}
                            title={isRTL ? 'הקטן' : 'Zoom Out'}
                            type="button"
                          >
                            ➖
                          </button>
                          <button 
                            onClick={(e) => handleResetZoom(e)}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              padding: '5px 10px',
                              cursor: 'pointer',
                              border: '1px solid #ddd',
                              borderRadius: '3px',
                              backgroundColor: '#fff'
                            }}
                            title={isRTL ? 'איפוס' : 'Reset'}
                            type="button"
                          >
                            🔄
                          </button>
                          <span style={{
                            padding: '5px 10px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '3px',
                            fontSize: '12px'
                          }}>
                            {Math.round(pdfZoom * 100)}%
                          </span>
                        </div>
                        
                        {/* Drag Instructions */}
                        <div style={{
                          position: 'absolute',
                          bottom: '10px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          zIndex: 1000,
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          color: 'white',
                          padding: '5px 10px',
                          borderRadius: '5px',
                          fontSize: '12px'
                        }}>
                          {isRTL ? 
                            '🖱️ גרור כדי להזיז | Ctrl + גלגל כדי לשנות זום' : 
                            '🖱️ Drag to pan | Ctrl + Scroll to zoom'}
                        </div>
                        
                        {/* PDF Container with Drag Support */}
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            overflow: 'auto',
                            position: 'relative',
                            backgroundColor: '#f0f0f0'
                          }}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          onWheel={handleWheel}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: `translate(-50%, -50%) scale(${pdfZoom}) translate(${panPosition.x}px, ${panPosition.y}px)`,
                              transformOrigin: 'center center',
                              cursor: isPanning ? 'grabbing' : 'grab',
                              transition: isPanning ? 'none' : 'transform 0.2s ease',
                              width: '100%',
                              height: '100%'
                            }}
                          >
                            <iframe
                              src={`data:application/pdf;base64,${documentContent.content}`}
                              style={{
                                width: '100%',
                                height: '500px',
                                border: 'none',
                                pointerEvents: isPanning ? 'none' : 'auto',
                                backgroundColor: 'white',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                              }}
                              title={documentContent.fileName}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="preview-placeholder">
                        <span className="preview-icon">{selectedDoc.icon}</span>
                        <p>{isRTL ? 'תצוגה מקדימה לא זמינה' : 'Preview not available'}</p>
                        <p className="preview-info">
                          {selectedDoc.category} • {selectedDoc.size} • 
                          {new Date(selectedDoc.date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="preview-placeholder">
                    <span className="preview-icon">{selectedDoc.icon}</span>
                    <p>{isRTL ? 'תצוגה מקדימה של המסמך' : 'Document Preview'}</p>
                    <p className="preview-info">
                      {selectedDoc.category} • {selectedDoc.size} • 
                      {new Date(selectedDoc.date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}
                    </p>
                  </div>
                )}
              </div>
              
              {/* AI Insights Section - Right Side */}
              <div style={{
                flex: '1 1 40%',
                minWidth: '0',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                textAlign: isRTL ? 'right' : 'left',
                maxHeight: '600px',
                overflowY: 'auto'
              }}>
                  <h4 style={{ marginBottom: '10px', color: '#333' }}>
                    {isRTL ? '🤖 תובנות AI' : '🤖 AI Insights'}
                  </h4>
                  
                  {selectedDoc.aiInsights ? (
                    <>
                      {/* Extracted Text */}
                      <div style={{ marginBottom: '15px' }}>
                        <strong>{isRTL ? '📝 תוכן מזוהה:' : '📝 Extracted Content:'}</strong>
                        <p style={{ marginTop: '5px', fontSize: '14px', color: '#666' }}>
                          {translateMedicalValue(selectedDoc.aiInsights.extractedText, isRTL) || 
                           (isRTL ? 'מסמך רפואי - ממתין לניתוח מפורט' : 'Medical document - awaiting detailed analysis')}
                        </p>
                      </div>
                      
                      {/* Medical Data */}
                      {selectedDoc.aiInsights.medicalData && Object.keys(selectedDoc.aiInsights.medicalData).length > 0 ? (
                        <div style={{ marginBottom: '15px' }}>
                          <strong>{isRTL ? '🏥 נתונים רפואיים:' : '🏥 Medical Data:'}</strong>
                          <div style={{ marginTop: '10px' }}>
                            {Object.entries(selectedDoc.aiInsights.medicalData).map(([key, value]) => (
                              <div key={key} style={{ 
                                marginBottom: '8px',
                                padding: '8px',
                                backgroundColor: '#fff',
                                borderRadius: '4px',
                                [isRTL ? 'borderRight' : 'borderLeft']: '3px solid #007bff'
                              }}>
                                <strong style={{ color: '#495057' }}>
                                  {key === 'tests' ? (isRTL ? 'בדיקות:' : 'Tests:') :
                                   key === 'medications' ? (isRTL ? 'תרופות:' : 'Medications:') :
                                   key === 'diagnosis' ? (isRTL ? 'אבחנה:' : 'Diagnosis:') :
                                   key === 'summary' ? (isRTL ? 'סיכום:' : 'Summary:') :
                                   key === 'values' ? (isRTL ? 'ערכים:' : 'Values:') :
                                   key === 'duration' ? (isRTL ? 'משך:' : 'Duration:') :
                                   key === 'instructions' ? (isRTL ? 'הוראות:' : 'Instructions:') :
                                   key === 'daysOff' ? (isRTL ? 'ימי מנוחה:' : 'Days Off:') :
                                   key === 'doctor' ? (isRTL ? 'רופא:' : 'Doctor:') :
                                   key === 'prescribingDoctor' ? (isRTL ? 'רופא מרשם:' : 'Prescribing Doctor:') :
                                   key === 'nextReview' ? (isRTL ? 'ביקורת הבאה:' : 'Next Review:') :
                                   key === 'referralTo' ? (isRTL ? 'הפניה ל:' : 'Referral To:') :
                                   key === 'reason' ? (isRTL ? 'סיבה:' : 'Reason:') :
                                   key === 'urgency' ? (isRTL ? 'דחיפות:' : 'Urgency:') :
                                   key === 'type' ? (isRTL ? 'סוג:' : 'Type:') :
                                   key === 'findings' ? (isRTL ? 'ממצאים:' : 'Findings:') :
                                   key === 'recommendation' ? (isRTL ? 'המלצה:' : 'Recommendation:') :
                                   key === 'recommendations' ? (isRTL ? 'המלצות:' : 'Recommendations:') :
                                   key === 'notes' ? (isRTL ? 'הערות:' : 'Notes:') :
                                   key === 'visitType' ? (isRTL ? 'סוג ביקור:' : 'Visit Type:') :
                                   key === 'followUp' ? (isRTL ? 'מעקב:' : 'Follow Up:') :
                                   key === 'testDate' ? (isRTL ? 'תאריך בדיקה:' : 'Test Date:') :
                                   key === 'treatment' ? (isRTL ? 'טיפול:' : 'Treatment:') :
                                   key === 'symptoms' ? (isRTL ? 'תסמינים:' : 'Symptoms:') :
                                   key === 'date' ? (isRTL ? 'תאריך:' : 'Date:') :
                                   key === 'returnToWork' ? (isRTL ? 'חזרה לעבודה:' : 'Return to Work:') :
                                   key === 'specialty' ? (isRTL ? 'התמחות:' : 'Specialty:') :
                                   key === 'previousTests' ? (isRTL ? 'בדיקות קודמות:' : 'Previous Tests:') :
                                   key === 'recommendedTests' ? (isRTL ? 'בדיקות מומלצות:' : 'Recommended Tests:') :
                                   key === 'referringDoctor' ? (isRTL ? 'רופא מפנה:' : 'Referring Doctor:') :
                                   key === 'radiologist' ? (isRTL ? 'רדיולוג:' : 'Radiologist:') :
                                   isRTL ? 'שדה נוסף:' : key}
                                </strong>
                                <div style={{ marginTop: '4px', color: '#666' }}>
                                  {Array.isArray(value) ? 
                                    value.map(v => translateMedicalValue(String(v), isRTL)).join(', ') :
                                   typeof value === 'object' ? 
                                     Object.entries(value).map(([k,v]) => `${k}: ${translateMedicalValue(String(v), isRTL)}`).join(', ') :
                                   translateMedicalValue(String(value), isRTL)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginBottom: '15px', color: '#666' }}>
                          {isRTL ? 'אין נתונים רפואיים ספציפיים' : 'No specific medical data available'}
                        </div>
                      )}
                      
                      {/* Confidence Score */}
                      <div style={{ marginBottom: '10px' }}>
                        <strong>{isRTL ? '📊 רמת ביטחון:' : '📊 Confidence:'}</strong>
                        <div style={{ 
                          marginTop: '8px',
                          backgroundColor: '#e9ecef',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${(selectedDoc.aiInsights.confidence || 0.85) * 100}%`,
                            backgroundColor: '#28a745',
                            padding: '4px 8px',
                            color: 'white',
                            fontSize: '12px'
                          }}>
                            {((selectedDoc.aiInsights.confidence || 0.85) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Document Type */}
                      {selectedDoc.aiInsights.documentType && (
                        <div style={{ marginBottom: '10px' }}>
                          <strong>{isRTL ? '📁 סוג מסמך:' : '📁 Document Type:'}</strong>
                          <span style={{ marginLeft: '10px', color: '#007bff' }}>
                            {getCategoryFromType(selectedDoc.aiInsights.documentType, isRTL)}
                          </span>
                        </div>
                      )}
                      
                      {/* Analysis Date */}
                      {selectedDoc.aiInsights.analyzedAt && (
                        <div style={{ marginBottom: '10px' }}>
                          <strong>{isRTL ? '📅 תאריך ניתוח:' : '📅 Analysis Date:'}</strong>
                          <span style={{ marginLeft: '10px', color: '#666' }}>
                            {new Date(selectedDoc.aiInsights.analyzedAt).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: '#666', fontStyle: 'italic' }}>
                      {isRTL ? 'המסמך ממתין לניתוח AI' : 'Document awaiting AI analysis'}
                    </div>
                  )}
                </div>
            </div>
            <div className="modal-footer">
              <button className="modal-button primary" onClick={() => handleDownload(selectedDoc)}>
                ⬇️ {isRTL ? 'הורד' : 'Download'}
              </button>
              <button className="modal-button" onClick={() => handleShare(selectedDoc)}>
                🔗 {isRTL ? 'שתף' : 'Share'}
              </button>
              <button className="modal-button" onClick={() => window.print()}>
                🖨️ {isRTL ? 'הדפס' : 'Print'}
              </button>
              <button 
                className="modal-button" 
                onClick={() => handleDelete(selectedDoc)}
                style={{ backgroundColor: '#dc3545', color: 'white' }}
              >
                🗑️ {isRTL ? 'מחק' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;