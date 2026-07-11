import React, { useState, useEffect } from 'react';
import './DocumentViewer.css';
import secureApi from '../../services/secureApiClient';

import secureStorage from '../../utils/secureStorage';
const DocumentViewerSimple = ({ patientId, documentId, language }) => {
  const [document, setDocument] = useState(null);
  const [documentContent, setDocumentContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfZoom, setPdfZoom] = useState(1);
  
  const isRTL = language === 'he';
  
  // Load specific document when documentId changes
  useEffect(() => {
    if (documentId) {
      loadDocument(documentId);
    }
  }, [documentId]);
  
  const loadDocument = async (docId) => {
    setLoading(true);
    try {
      const subdomain = secureStorage.getItem('practiceSubdomain') || 'developer';
      const baseUrl = subdomain === 'localhost' 
        ? 'http://intellicare.health:5000'
        : `http://${subdomain}.intellicare.health:5000`;
      
      // Get document metadata
      const result = await secureApi.get(`/documents/${docId}`);
      
      if (!result.error) {
        setDocument(result.data);
        
        // Load document content for preview
        const contentResult = await secureApi.get(`/documents/view/${docId}`);
        
        if (!contentResult.error) {
          setDocumentContent(contentResult.data);
        }
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error loading document:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleZoomIn = () => setPdfZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setPdfZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setPdfZoom(1);
  
  const translateValue = (value) => {
    if (!isRTL || !value) return value;
    
    const translations = {
      'Positive': 'חיובי',
      'Negative': 'שלילי',
      'SARS-CoV-2 Antigen: Positive': 'בדיקת אנטיגן SARS-CoV-2: חיובי',
      'Must act according to Ministry of Health guidelines for entering isolation.': 'יש לפעול בהתאם להנחיות משרד הבריאות לכניסה לבידוד.'
    };
    
    return translations[value] || value;
  };
  
  if (loading) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ fontSize: '48px' }}>⏳</div>
        <p style={{ fontSize: '18px', color: '#8b949e' }}>
          {isRTL ? 'טוען מסמך...' : 'Loading document...'}
        </p>
      </div>
    );
  }
  
  if (!document) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px',
        padding: '40px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '64px', opacity: 0.3 }}>📄</div>
        <h2 style={{ color: '#8b949e', fontWeight: 'normal' }}>
          {isRTL ? 'בחר מסמך להצגה' : 'Select a document to view'}
        </h2>
        <p style={{ color: '#6e7681' }}>
          {isRTL ? 
            'השתמש בצ\'אט כדי לבקש מסמך ספציפי' : 
            'Use the chat to request a specific document'}
        </p>
      </div>
    );
  }
  
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#1e293b' /* Dark blue */
    }}>
      {/* Header with document info and controls */}
      <div style={{
        padding: '20px',
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #334155',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '500', color: '#f0f6fc' }}>
            {document.originalName}
          </h2>
          <p style={{ margin: '5px 0 0 0', color: '#8b949e' }}>
            {new Date(document.uploadDate).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')} • 
            {document.fileSize} • 
            {document.category}
          </p>
        </div>
        
        {/* PDF Controls */}
        {documentContent?.contentType === 'application/pdf' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={handleZoomOut}
              style={{
                padding: '8px 12px',
                border: '1px solid #475569',
                borderRadius: '4px',
                backgroundColor: '#1e293b',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ➖
            </button>
            <span style={{ 
              padding: '8px 16px', 
              backgroundColor: '#475569',
              color: '#e2e8f0',
              borderRadius: '4px'
            }}>
              {Math.round(pdfZoom * 100)}%
            </span>
            <button 
              onClick={handleZoomIn}
              style={{
                padding: '8px 12px',
                border: '1px solid #475569',
                borderRadius: '4px',
                backgroundColor: '#1e293b',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ➕
            </button>
            <button 
              onClick={handleResetZoom}
              style={{
                padding: '8px 12px',
                border: '1px solid #475569',
                borderRadius: '4px',
                backgroundColor: '#1e293b',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              🔄
            </button>
          </div>
        )}
      </div>
      
      {/* Main content area */}
      <div style={{ 
        flex: 1, 
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Document Preview - Full Width */}
        <div style={{ 
          flex: '1 1 60%',
          padding: '20px',
          overflow: 'auto',
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {documentContent?.contentType?.startsWith('image/') ? (
            <img 
              src={`data:${documentContent.contentType};base64,${documentContent.content}`}
              alt={document.originalName}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                objectFit: 'contain',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            />
          ) : documentContent?.contentType === 'application/pdf' && documentContent.content ? (
            <div style={{ 
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <iframe
                src={`data:application/pdf;base64,${documentContent.content}`}
                style={{
                  width: `${100 * pdfZoom}%`,
                  height: `${100 * pdfZoom}%`,
                  maxWidth: '100%',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  backgroundColor: 'white'
                }}
                title={document.originalName}
              />
            </div>
          ) : (
            <div style={{ 
              padding: '60px',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>📄</div>
              <p style={{ fontSize: '18px', color: '#8b949e' }}>
                {isRTL ? 'תצוגה מקדימה אינה זמינה' : 'Preview not available'}
              </p>
            </div>
          )}
        </div>
        
        {/* AI Insights Panel */}
        <div style={{ 
          flex: '1 1 40%',
          padding: '20px',
          backgroundColor: '#1e293b',
          borderLeft: '1px solid #334155',
          overflow: 'auto'
        }}>
          <h3 style={{ 
            marginTop: 0,
            fontSize: '20px',
            fontWeight: '500',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#f0f6fc'
          }}>
            <span>🤖</span>
            {isRTL ? 'ניתוח AI' : 'AI Analysis'}
          </h3>
          
          {document.analysisResults ? (
            <>
              {/* Extracted Content */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ 
                  fontSize: '14px', 
                  fontWeight: '600',
                  color: '#8b949e',
                  marginBottom: '8px',
                  textTransform: 'uppercase'
                }}>
                  {isRTL ? 'תוכן מזוהה' : 'Extracted Content'}
                </h4>
                <p style={{ 
                  fontSize: '16px',
                  lineHeight: '1.6',
                  color: '#c9d1d9'
                }}>
                  {translateValue(document.analysisResults.extractedText)}
                </p>
              </div>
              
              {/* Medical Data */}
              {document.analysisResults.medicalData && 
               Object.keys(document.analysisResults.medicalData).length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#666',
                    marginBottom: '12px',
                    textTransform: 'uppercase'
                  }}>
                    {isRTL ? 'נתונים רפואיים' : 'Medical Data'}
                  </h4>
                  {Object.entries(document.analysisResults.medicalData).map(([key, value]) => (
                    <div key={key} style={{ 
                      marginBottom: '16px',
                      padding: '12px',
                      backgroundColor: '#0f172a',
                      borderRadius: '6px',
                      borderLeft: isRTL ? 'none' : '3px solid #58a6ff',
                      borderRight: isRTL ? '3px solid #58a6ff' : 'none'
                    }}>
                      <div style={{ 
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#666',
                        marginBottom: '4px',
                        textTransform: 'uppercase'
                      }}>
                        {key === 'diagnosis' ? (isRTL ? 'אבחנה' : 'Diagnosis') :
                         key === 'date' ? (isRTL ? 'תאריך' : 'Date') :
                         key === 'notes' ? (isRTL ? 'הערות' : 'Notes') :
                         key === 'medications' ? (isRTL ? 'תרופות' : 'Medications') :
                         key}
                      </div>
                      <div style={{ 
                        fontSize: '15px',
                        color: '#c9d1d9',
                        lineHeight: '1.5'
                      }}>
                        {Array.isArray(value) ? 
                          value.map(v => translateValue(String(v))).join(', ') :
                          translateValue(String(value))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Confidence Score */}
              {document.analysisResults.confidence > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#666',
                    marginBottom: '8px',
                    textTransform: 'uppercase'
                  }}>
                    {isRTL ? 'רמת ביטחון' : 'Confidence Level'}
                  </h4>
                  <div style={{ 
                    backgroundColor: '#475569',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(document.analysisResults.confidence || 0) * 100}%`,
                      backgroundColor: '#238636',
                      padding: '6px 12px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      {Math.round((document.analysisResults.confidence || 0) * 100)}%
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ 
              textAlign: 'center',
              padding: '40px 20px',
              color: '#8b949e'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
              <p>{isRTL ? 'ממתין לניתוח AI' : 'Awaiting AI analysis'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewerSimple;