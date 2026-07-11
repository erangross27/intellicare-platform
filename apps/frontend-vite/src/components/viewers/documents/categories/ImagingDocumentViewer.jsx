import React from 'react';
const ImagingDocumentViewer = ({ document, language }) => {
  const isRTL = language === 'he';
  return (
    <div style={{ padding: '24px', color: '#e8eaf0' }}>
      <h2>🩻 {isRTL ? 'דוח הדמיה' : 'Imaging Report'}</h2>
      <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px' }}>
        <div>Document: {document?.fileName}</div>
        <div>Category: Imaging/Radiology</div>
        {document?.aiAnalysis?.insights && (
          <div style={{ marginTop: '16px' }}>
            <strong>AI Analysis:</strong>
            <pre style={{ marginTop: '8px', color: '#4a9eff' }}>
              {JSON.stringify(document.aiAnalysis.insights, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
export default ImagingDocumentViewer;