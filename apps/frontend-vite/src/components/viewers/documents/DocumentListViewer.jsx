import React, { useState } from 'react';

const DocumentListViewer = ({ documents, patientName, language, isPracticeWide = false }) => {
  const isRTL = language === 'he';
  const [filterPatient, setFilterPatient] = useState('');
  const [filterType, setFilterType] = useState('');
  const [downloadingDoc, setDownloadingDoc] = useState(null);
  
  // Ensure documents is an array - handle both formats
  const rawDocList = Array.isArray(documents) ? documents : documents?.data || documents?.documents || [];
  
  // Apply filters
  const docList = rawDocList.filter(doc => {
    if (filterPatient && doc.patientName && !doc.patientName.toLowerCase().includes(filterPatient.toLowerCase())) {
      return false;
    }
    if (filterType && doc.fileType !== filterType) {
      return false;
    }
    return true;
  });
  
  const styles = {
    container: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      direction: isRTL ? 'rtl' : 'ltr',
      color: '#e8eaf0',
      overflowY: 'auto',
      background: 'transparent',
      fontFamily: "'Inter', 'SF Pro Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
    },
    header: {
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '2px solid rgba(74, 158, 255, 0.2)'
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '24px',
      fontWeight: 600,
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    subtitle: {
      fontSize: '14px',
      color: '#a8b2d1'
    },
    documentGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '16px'
    },
    documentCard: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(74, 158, 255, 0.2)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      position: 'relative'
    },
    documentCardHover: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.4)',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(74, 158, 255, 0.2)'
    },
    categoryBadge: {
      position: 'absolute',
      top: '20px',
      right: isRTL ? 'auto' : '20px',
      left: isRTL ? '20px' : 'auto',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      background: 'rgba(74, 158, 255, 0.2)',
      color: '#4a9eff'
    },
    documentIcon: {
      fontSize: '32px',
      marginBottom: '12px'
    },
    documentName: {
      fontSize: '16px',
      fontWeight: 600,
      color: '#ffffff',
      marginBottom: '8px',
      wordBreak: 'break-word'
    },
    documentMeta: {
      fontSize: '13px',
      color: '#8b949e',
      marginBottom: '4px'
    },
    viewButton: {
      marginTop: '12px',
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #4a9eff, #667eea)',
      border: 'none',
      borderRadius: '8px',
      color: '#ffffff',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      width: '100%'
    },
    emptyState: {
      textAlign: 'center',
      padding: '48px 24px',
      color: '#8b949e'
    },
    emptyIcon: {
      fontSize: '48px',
      marginBottom: '16px',
      opacity: 0.5
    },
    emptyText: {
      fontSize: '16px',
      marginBottom: '8px'
    }
  };
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  const getCategoryIcon = (category) => {
    const categoryMap = {
      'lab_results': '🔬',
      'prescriptions': '💊',
      'imaging_reports': '🩻',
      'discharge_summary': '🏥',
      'consultation_notes': '👨‍⚕️',
      'vaccination_records': '💉',
      'referrals': '📋',
      'medical_certificate': '📜',
      'medical_procedures': '🏥',
      'general': '📄'
    };
    return categoryMap[category] || '📄';
  };
  
  const getCategoryColor = (category) => {
    const colorMap = {
      'lab_results': 'rgba(74, 158, 255, 0.2)',
      'prescriptions': 'rgba(52, 211, 153, 0.2)',
      'imaging_reports': 'rgba(251, 191, 36, 0.2)',
      'discharge_summary': 'rgba(239, 68, 68, 0.2)',
      'consultation_notes': 'rgba(139, 92, 246, 0.2)',
      'vaccination_records': 'rgba(16, 185, 129, 0.2)',
      'referrals': 'rgba(236, 72, 153, 0.2)',
      'medical_certificate': 'rgba(245, 158, 11, 0.2)',
      'medical_procedures': 'rgba(99, 102, 241, 0.2)'
    };
    return colorMap[category] || 'rgba(74, 158, 255, 0.2)';
  };
  
  const handleDocumentOpen = async (doc, e) => {
    e.stopPropagation();
    
    const documentId = doc._id || doc.id;
    if (!documentId) {
      console.error('No document ID found');
      return;
    }
    
    setDownloadingDoc(documentId);
    
    try {
      // Create download URL
      const downloadUrl = `/api/documents/download/${documentId}`;
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.fileName || doc.name || doc.originalName || 'document';
      link.target = '_blank';
      
      // Add to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`📥 Opening document: ${doc.fileName || doc.name}`);
    } catch (error) {
      console.error('Error opening document:', error);
      alert(isRTL ? 'שגיאה בפתיחת המסמך' : 'Error opening document');
    } finally {
      setDownloadingDoc(null);
    }
  };
  
  // Show document list
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          📄 {isRTL ? 'מסמכים רפואיים' : 'Medical Documents'}
          {isPracticeWide && <span style={{ fontSize: '16px', marginLeft: '10px', color: '#a8b2d1' }}>
            ({isRTL ? 'כל המרפאה' : 'Practice-wide'})
          </span>}
        </h2>
        <div style={styles.subtitle}>
          {patientName && !isPracticeWide && `${isRTL ? 'מטופל:' : 'Patient:'} ${patientName} • `}
          {docList.length} {isRTL ? 'מסמכים' : 'documents'}
          {rawDocList.length !== docList.length && ` (${rawDocList.length} ${isRTL ? 'סה"כ' : 'total'})`}
        </div>
      </div>
      
      {/* Filters for practice-wide view */}
      {isPracticeWide && (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            placeholder={isRTL ? 'חיפוש לפי שם מטופל...' : 'Search by patient name...'}
            value={filterPatient}
            onChange={(e) => setFilterPatient(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(74, 158, 255, 0.3)',
              background: 'rgba(30, 41, 59, 0.5)',
              color: '#e8eaf0',
              fontSize: '14px',
              minWidth: '200px',
              outline: 'none'
            }}
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(74, 158, 255, 0.3)',
              background: 'rgba(30, 41, 59, 0.5)',
              color: '#e8eaf0',
              fontSize: '14px',
              minWidth: '150px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">{isRTL ? 'כל הסוגים' : 'All Types'}</option>
            <option value="lab_results">{isRTL ? 'תוצאות מעבדה' : 'Lab Results'}</option>
            <option value="prescriptions">{isRTL ? 'מרשמים' : 'Prescriptions'}</option>
            <option value="imaging_reports">{isRTL ? 'דוחות הדמיה' : 'Imaging Reports'}</option>
            <option value="discharge_summary">{isRTL ? 'סיכום שחרור' : 'Discharge Summary'}</option>
            <option value="consultation_notes">{isRTL ? 'הערות ייעוץ' : 'Consultation Notes'}</option>
          </select>
        </div>
      )}
      
      {/* Documents Grid */}
      {docList.length > 0 ? (
        <div style={styles.documentGrid}>
          {docList.map((doc, index) => {
            const category = doc.aiClassification?.documentType || doc.category || doc.fileType || 'general';
            const [isHovered, setIsHovered] = useState(false);
            
            return (
              <div
                key={doc._id || doc.id || index}
                style={{
                  ...styles.documentCard,
                  ...(isHovered ? styles.documentCardHover : {})
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {/* Category Badge */}
                <div style={{
                  ...styles.categoryBadge,
                  background: getCategoryColor(category)
                }}>
                  {category.replace(/_/g, ' ')}
                </div>
                
                {/* Document Icon */}
                <div style={styles.documentIcon}>
                  {getCategoryIcon(category)}
                </div>
                
                {/* Document Name */}
                <div style={styles.documentName}>
                  {doc.fileName || doc.name || doc.originalName || 'Unnamed Document'}
                </div>
                
                {/* Patient Name for practice-wide view */}
                {isPracticeWide && doc.patientName && (
                  <div style={{
                    ...styles.documentMeta,
                    color: '#4a9eff',
                    fontWeight: 600,
                    marginBottom: '8px'
                  }}>
                    👤 {doc.patientName}
                  </div>
                )}
                
                {/* Deleted Status */}
                {doc.isDeleted && (
                  <div style={{
                    ...styles.documentMeta,
                    color: '#ef4444',
                    fontWeight: 600,
                    marginBottom: '8px'
                  }}>
                    🗑️ {isRTL ? 'נמחק' : 'Deleted'} - {formatDate(doc.deletedAt)}
                  </div>
                )}
                
                {/* Document Metadata */}
                <div style={styles.documentMeta}>
                  {isRTL ? 'תאריך העלאה:' : 'Uploaded:'} {formatDate(doc.uploadDate || doc.uploadedAt || doc.createdAt)}
                </div>
                
                {doc.fileSize && (
                  <div style={styles.documentMeta}>
                    {isRTL ? 'גודל:' : 'Size:'} {formatFileSize(doc.fileSize)}
                  </div>
                )}
                
                {doc.aiClassification?.confidence && (
                  <div style={styles.documentMeta}>
                    {isRTL ? 'ביטחון AI:' : 'AI Confidence:'} {Math.round(doc.aiClassification.confidence * 100)}%
                  </div>
                )}
                
                {/* AI Analysis Status */}
                {doc.analysis && (
                  <div style={{ 
                    marginTop: '8px',
                    padding: '4px 8px',
                    background: 'rgba(52, 211, 153, 0.2)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#34d399',
                    textAlign: 'center'
                  }}>
                    ✅ {isRTL ? 'נותח על ידי AI' : 'AI Analyzed'}
                  </div>
                )}
                
                {/* Open Button */}
                <button 
                  style={{
                    ...styles.viewButton,
                    opacity: downloadingDoc === (doc._id || doc.id) ? 0.6 : 1
                  }}
                  onClick={(e) => handleDocumentOpen(doc, e)}
                  disabled={downloadingDoc === (doc._id || doc.id)}
                >
                  {downloadingDoc === (doc._id || doc.id) 
                    ? (isRTL ? 'פותח...' : 'Opening...') 
                    : (isRTL ? '📂 פתח מסמך' : '📂 Open Document')}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📄</div>
          <div style={styles.emptyText}>
            {isRTL ? 'אין מסמכים' : 'No documents'}
          </div>
          <div style={{ fontSize: '13px', color: '#667eea', marginTop: '8px' }}>
            {isRTL ? 'העלה מסמכים חדשים דרך הצ\'אט' : 'Upload new documents through chat'}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentListViewer;