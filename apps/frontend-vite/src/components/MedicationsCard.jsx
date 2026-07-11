import React, { useState } from 'react';
import { useLanguage } from '../config/languagesStatic';

const MedicationsCard = ({ medication, onUpdate, onDelete, onRefill }) => {
  const { t, currentLanguage, isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMed, setEditedMed] = useState(medication);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(currentLanguage === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = () => {
    const today = new Date();
    const endDate = medication.endDate ? new Date(medication.endDate) : null;
    
    if (medication.status === 'discontinued') {
      return { 
        text: currentLanguage === 'he' ? 'הופסק' : 'Discontinued', 
        color: '#6b7280' 
      };
    }
    
    if (endDate && endDate < today) {
      return { 
        text: currentLanguage === 'he' ? 'הסתיים' : 'Completed', 
        color: '#10a37f' 
      };
    }
    
    if (medication.refillsRemaining === 0) {
      return { 
        text: currentLanguage === 'he' ? 'נדרש חידוש' : 'Refill Needed', 
        color: '#f59e0b' 
      };
    }
    
    return { 
      text: currentLanguage === 'he' ? 'פעיל' : 'Active', 
      color: '#10a37f' 
    };
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedMed);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(currentLanguage === 'he' ? 'האם למחוק תרופה זו?' : 'Delete this medication?')) {
      if (onDelete) {
        onDelete(medication.id);
      }
    }
  };

  const handleRefill = () => {
    if (onRefill) {
      onRefill(medication.id);
    }
  };

  const status = getStatusBadge();

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #fef3c7 100%)',
      borderRadius: '12px',
      marginBottom: '16px',
      border: '1px solid #fde68a',
      boxShadow: '0 2px 8px rgba(251, 191, 36, 0.1)',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      direction: isRTL ? 'rtl' : 'ltr'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)',
        color: 'white',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>💊</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
              {medication.name}
              {medication.dosage && <span style={{ fontWeight: '400', marginLeft: '8px' }}>{medication.dosage}</span>}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
              {medication.frequency}
              {medication.route && <span> • {medication.route}</span>}
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
            border: `2px solid ${status.color}`
          }}>
            {status.text}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <input
                  type="text"
                  value={editedMed.name}
                  onChange={(e) => setEditedMed({ ...editedMed, name: e.target.value })}
                  placeholder={currentLanguage === 'he' ? 'שם התרופה' : 'Medication Name'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                />
                <input
                  type="text"
                  value={editedMed.dosage}
                  onChange={(e) => setEditedMed({ ...editedMed, dosage: e.target.value })}
                  placeholder={currentLanguage === 'he' ? 'מינון' : 'Dosage'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <input
                type="text"
                value={editedMed.frequency}
                onChange={(e) => setEditedMed({ ...editedMed, frequency: e.target.value })}
                placeholder={currentLanguage === 'he' ? 'תדירות' : 'Frequency'}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.95rem'
                }}
              />
              <textarea
                value={editedMed.instructions}
                onChange={(e) => setEditedMed({ ...editedMed, instructions: e.target.value })}
                placeholder={currentLanguage === 'he' ? 'הוראות' : 'Instructions'}
                rows={3}
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
                    background: '#f59e0b',
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
              {/* Medication Details */}
              <div style={{
                background: '#fffbeb',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: '500' }}>
                      {currentLanguage === 'he' ? 'התחלה:' : 'Started:'}
                    </label>
                    <p style={{ margin: '4px 0', color: '#451a03', fontWeight: '600' }}>
                      {formatDate(medication.startDate)}
                    </p>
                  </div>
                  {medication.endDate && (
                    <div>
                      <label style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: '500' }}>
                        {currentLanguage === 'he' ? 'סיום:' : 'End Date:'}
                      </label>
                      <p style={{ margin: '4px 0', color: '#451a03', fontWeight: '600' }}>
                        {formatDate(medication.endDate)}
                      </p>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: '500' }}>
                      {currentLanguage === 'he' ? 'רופא מרשם:' : 'Prescriber:'}
                    </label>
                    <p style={{ margin: '4px 0', color: '#451a03' }}>
                      {medication.prescriber || (currentLanguage === 'he' ? 'לא צוין' : 'Not specified')}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: '500' }}>
                      {currentLanguage === 'he' ? 'חידושים נותרים:' : 'Refills Remaining:'}
                    </label>
                    <p style={{ margin: '4px 0', color: '#451a03', fontWeight: '600' }}>
                      {medication.refillsRemaining || 0}
                    </p>
                  </div>
                </div>

                {medication.instructions && (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: '500' }}>
                      {currentLanguage === 'he' ? 'הוראות:' : 'Instructions:'}
                    </label>
                    <p style={{ 
                      margin: '4px 0', 
                      color: '#451a03',
                      background: 'white',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #fde68a'
                    }}>
                      {medication.instructions}
                    </p>
                  </div>
                )}

                {medication.sideEffects && (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: '500' }}>
                      {currentLanguage === 'he' ? 'תופעות לוואי:' : 'Side Effects:'}
                    </label>
                    <p style={{ margin: '4px 0', color: '#dc2626' }}>
                      {medication.sideEffects}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end'
              }}>
                {medication.refillsRemaining > 0 && (
                  <button
                    onClick={handleRefill}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #10a37f',
                      background: 'white',
                      color: '#10a37f',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🔄 {currentLanguage === 'he' ? 'חדש מרשם' : 'Refill'}
                  </button>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #f59e0b',
                    background: 'white',
                    color: '#f59e0b',
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

export default MedicationsCard;