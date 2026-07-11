import React, { useState } from 'react';
import { useLanguage } from '../config/languagesStatic';

const VitalSignsCard = ({ vitals, onUpdate, onDelete }) => {
  const { t, currentLanguage, isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedVitals, setEditedVitals] = useState(vitals);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(currentLanguage === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVitalStatus = (type, value) => {
    const ranges = {
      bloodPressure: {
        normal: { systolic: [90, 120], diastolic: [60, 80] },
        elevated: { systolic: [121, 129], diastolic: [60, 80] },
        high: { systolic: [130, 180], diastolic: [80, 120] }
      },
      heartRate: { normal: [60, 100], low: [0, 59], high: [101, 200] },
      temperature: { normal: [36.1, 37.2], low: [0, 36.0], fever: [37.3, 42] },
      oxygenSaturation: { normal: [95, 100], low: [0, 94] },
      respiratoryRate: { normal: [12, 20], low: [0, 11], high: [21, 40] }
    };

    if (type === 'bloodPressure' && value) {
      const [systolic, diastolic] = value.split('/').map(Number);
      if (systolic >= 130 || diastolic >= 80) return { color: '#ef4444', text: 'High' };
      if (systolic >= 121) return { color: '#f59e0b', text: 'Elevated' };
      return { color: '#10a37f', text: 'Normal' };
    }

    const range = ranges[type];
    if (!range || !value) return { color: '#6b7280', text: '-' };

    const numValue = parseFloat(value);
    if (range.normal) {
      const [min, max] = range.normal;
      if (numValue >= min && numValue <= max) return { color: '#10a37f', text: 'Normal' };
    }
    
    if (range.low && numValue <= range.low[1]) return { color: '#3b82f6', text: 'Low' };
    if (range.high && numValue >= range.high[0]) return { color: '#ef4444', text: 'High' };
    if (range.fever && numValue >= range.fever[0]) return { color: '#ef4444', text: 'Fever' };
    
    return { color: '#f59e0b', text: 'Check' };
  };

  const getVitalIcon = (type) => {
    const icons = {
      bloodPressure: '❤️',
      heartRate: '💓',
      temperature: '🌡️',
      oxygenSaturation: '💨',
      respiratoryRate: '🫁',
      weight: '⚖️',
      height: '📏',
      bmi: '📊'
    };
    return icons[type] || '📋';
  };

  const getVitalLabel = (type) => {
    const labels = {
      bloodPressure: { en: 'Blood Pressure', he: 'לחץ דם' },
      heartRate: { en: 'Heart Rate', he: 'דופק' },
      temperature: { en: 'Temperature', he: 'חום' },
      oxygenSaturation: { en: 'O₂ Saturation', he: 'רוויון חמצן' },
      respiratoryRate: { en: 'Respiratory Rate', he: 'קצב נשימה' },
      weight: { en: 'Weight', he: 'משקל' },
      height: { en: 'Height', he: 'גובה' },
      bmi: { en: 'BMI', he: 'BMI' }
    };
    return labels[type]?.[currentLanguage] || type;
  };

  const getVitalUnit = (type) => {
    const units = {
      bloodPressure: 'mmHg',
      heartRate: 'bpm',
      temperature: '°C',
      oxygenSaturation: '%',
      respiratoryRate: '/min',
      weight: 'kg',
      height: 'cm',
      bmi: 'kg/m²'
    };
    return units[type] || '';
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedVitals);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(currentLanguage === 'he' ? 'האם למחוק מדידה זו?' : 'Delete this measurement?')) {
      if (onDelete) {
        onDelete(vitals.id);
      }
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #fce7f3 100%)',
      borderRadius: '12px',
      marginBottom: '16px',
      border: '1px solid #fbcfe8',
      boxShadow: '0 2px 8px rgba(236, 72, 153, 0.1)',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      direction: isRTL ? 'rtl' : 'ltr'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
        color: 'white',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>🩺</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
              {currentLanguage === 'he' ? 'סימנים חיוניים' : 'Vital Signs'}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
              {formatDate(vitals.date)}
            </p>
          </div>
        </div>
        <span style={{
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          fontSize: '1.2rem'
        }}>
          ▼
        </span>
      </div>

      {/* Content */}
      {isExpanded && (
        <div style={{ padding: '20px' }}>
          {isEditing ? (
            // Edit Mode
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#831843', fontWeight: '500' }}>
                  {getVitalLabel('bloodPressure')}
                </label>
                <input
                  type="text"
                  value={editedVitals.bloodPressure || ''}
                  onChange={(e) => setEditedVitals({ ...editedVitals, bloodPressure: e.target.value })}
                  placeholder="120/80"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    marginTop: '4px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#831843', fontWeight: '500' }}>
                  {getVitalLabel('heartRate')}
                </label>
                <input
                  type="number"
                  value={editedVitals.heartRate || ''}
                  onChange={(e) => setEditedVitals({ ...editedVitals, heartRate: e.target.value })}
                  placeholder="72"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    marginTop: '4px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#831843', fontWeight: '500' }}>
                  {getVitalLabel('temperature')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editedVitals.temperature || ''}
                  onChange={(e) => setEditedVitals({ ...editedVitals, temperature: e.target.value })}
                  placeholder="36.6"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    marginTop: '4px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#831843', fontWeight: '500' }}>
                  {getVitalLabel('oxygenSaturation')}
                </label>
                <input
                  type="number"
                  value={editedVitals.oxygenSaturation || ''}
                  onChange={(e) => setEditedVitals({ ...editedVitals, oxygenSaturation: e.target.value })}
                  placeholder="98"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    marginTop: '4px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                    background: '#ec4899',
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
              {/* Vitals Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
              }}>
                {Object.entries(vitals).map(([key, value]) => {
                  if (key === 'id' || key === 'date' || key === 'notes' || !value) return null;
                  const status = getVitalStatus(key, value);
                  
                  return (
                    <div key={key} style={{
                      background: '#fdf2f8',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid #fbcfe8',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
                        {getVitalIcon(key)}
                      </div>
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: '#831843',
                        marginBottom: '4px',
                        fontWeight: '500'
                      }}>
                        {getVitalLabel(key)}
                      </div>
                      <div style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: '700',
                        color: status.color
                      }}>
                        {value}
                        <span style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: '400',
                          marginLeft: '4px'
                        }}>
                          {getVitalUnit(key)}
                        </span>
                      </div>
                      <div style={{ 
                        fontSize: '0.75rem',
                        color: status.color,
                        marginTop: '4px',
                        fontWeight: '500'
                      }}>
                        {status.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Notes */}
              {vitals.notes && (
                <div style={{
                  background: '#fdf2f8',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <label style={{ fontSize: '0.85rem', color: '#831843', fontWeight: '500' }}>
                    {currentLanguage === 'he' ? 'הערות:' : 'Notes:'}
                  </label>
                  <p style={{ margin: '4px 0 0 0', color: '#500724' }}>
                    {vitals.notes}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #ec4899',
                    background: 'white',
                    color: '#ec4899',
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

export default VitalSignsCard;