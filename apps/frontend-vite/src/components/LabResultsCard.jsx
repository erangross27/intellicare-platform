import React, { useState, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';

const LabResultsCard = ({ results, onUpdate, onDelete }) => {
  const { t, currentLanguage, isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedResult, setEditedResult] = useState(results);

  const formatDate = (dateString) => {
    if (!dateString) return t('unknown') || 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString(currentLanguage === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'normal':
        return '#10a37f';
      case 'abnormal':
      case 'critical':
        return '#ef4444';
      case 'borderline':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    const statusTexts = {
      normal: { en: 'Normal', he: 'תקין' },
      abnormal: { en: 'Abnormal', he: 'חריג' },
      critical: { en: 'Critical', he: 'קריטי' },
      borderline: { en: 'Borderline', he: 'גבולי' }
    };
    return statusTexts[status?.toLowerCase()]?.[currentLanguage] || status;
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedResult);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(currentLanguage === 'he' ? 'האם למחוק תוצאה זו?' : 'Delete this result?')) {
      if (onDelete) {
        onDelete(results.id);
      }
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      borderRadius: '12px',
      marginBottom: '16px',
      border: '1px solid #e0e7ff',
      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.06)',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      direction: isRTL ? 'rtl' : 'ltr'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        color: 'white',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>🔬</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
              {results.testName || (currentLanguage === 'he' ? 'בדיקת מעבדה' : 'Lab Test')}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
              {formatDate(results.date)}
              {results.labName && <span> • {results.labName}</span>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: '500',
            color: 'white',
            border: `2px solid ${getStatusColor(results.status)}`
          }}>
            {getStatusText(results.status)}
          </div>
          <span style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            fontSize: '1.2rem'
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div style={{ padding: '20px' }}>
          {isEditing ? (
            // Edit Mode
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                value={editedResult.testName}
                onChange={(e) => setEditedResult({ ...editedResult, testName: e.target.value })}
                placeholder={currentLanguage === 'he' ? 'שם הבדיקה' : 'Test Name'}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.95rem'
                }}
              />
              <textarea
                value={editedResult.results}
                onChange={(e) => setEditedResult({ ...editedResult, results: e.target.value })}
                placeholder={currentLanguage === 'he' ? 'תוצאות' : 'Results'}
                rows={4}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.95rem',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsEditing(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {currentLanguage === 'he' ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#3b82f6',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {currentLanguage === 'he' ? 'שמור' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            // View Mode
            <div>
              {/* Results Display */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                {results.results && typeof results.results === 'object' ? (
                  // Structured results
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {Object.entries(results.results).map(([key, value]) => (
                      <div key={key} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <span style={{ fontWeight: '500', color: '#374151' }}>{key}:</span>
                        <span style={{ 
                          color: value.status === 'abnormal' ? '#ef4444' : '#10a37f',
                          fontWeight: '600'
                        }}>
                          {value.value || value}
                          {value.unit && <span style={{ fontWeight: '400', marginLeft: '4px' }}>{value.unit}</span>}
                          {value.range && <span style={{ fontSize: '0.85rem', color: '#6b7280', marginLeft: '8px' }}>({value.range})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Plain text results
                  <p style={{ 
                    margin: 0, 
                    lineHeight: '1.6',
                    color: '#374151',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {results.results || (currentLanguage === 'he' ? 'אין תוצאות זמינות' : 'No results available')}
                  </p>
                )}
              </div>

              {/* Additional Information */}
              {(results.doctor || results.notes) && (
                <div style={{
                  display: 'grid',
                  gap: '8px',
                  fontSize: '0.9rem',
                  color: '#6b7280'
                }}>
                  {results.doctor && (
                    <div>
                      <strong>{currentLanguage === 'he' ? 'רופא מפנה:' : 'Ordering Doctor:'}</strong> {results.doctor}
                    </div>
                  )}
                  {results.notes && (
                    <div>
                      <strong>{currentLanguage === 'he' ? 'הערות:' : 'Notes:'}</strong> {results.notes}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '16px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #3b82f6',
                    background: 'white',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✏️ {currentLanguage === 'he' ? 'ערוך' : 'Edit'}
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #ef4444',
                    background: 'white',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🗑️ {currentLanguage === 'he' ? 'מחק' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LabResultsCard;