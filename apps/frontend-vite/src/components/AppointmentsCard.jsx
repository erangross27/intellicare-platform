import React, { useState } from 'react';
import { useLanguage } from '../config/languagesStatic';

const AppointmentsCard = ({ appointment, onUpdate, onCancel, onReschedule }) => {
  const { t, currentLanguage, isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedAppointment, setEditedAppointment] = useState(appointment);

  const formatDateTime = (dateString) => {
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

  const getStatusBadge = () => {
    const now = new Date();
    const appointmentDate = new Date(appointment.date);
    
    if (appointment.status === 'cancelled') {
      return { 
        text: currentLanguage === 'he' ? 'בוטל' : 'Cancelled', 
        color: '#ef4444' 
      };
    }
    
    if (appointment.status === 'completed') {
      return { 
        text: currentLanguage === 'he' ? 'הושלם' : 'Completed', 
        color: '#10a37f' 
      };
    }
    
    if (appointmentDate < now) {
      return { 
        text: currentLanguage === 'he' ? 'עבר' : 'Past', 
        color: '#6b7280' 
      };
    }
    
    const timeDiff = appointmentDate - now;
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      return { 
        text: currentLanguage === 'he' ? 'היום' : 'Today', 
        color: '#f59e0b' 
      };
    }
    
    if (daysDiff === 1) {
      return { 
        text: currentLanguage === 'he' ? 'מחר' : 'Tomorrow', 
        color: '#3b82f6' 
      };
    }
    
    return { 
      text: currentLanguage === 'he' ? `בעוד ${daysDiff} ימים` : `In ${daysDiff} days`, 
      color: '#10a37f' 
    };
  };

  const getAppointmentIcon = (type) => {
    const icons = {
      checkup: '🩺',
      consultation: '👨‍⚕️',
      followup: '📋',
      vaccination: '💉',
      surgery: '🏥',
      lab: '🔬',
      imaging: '📷',
      therapy: '🧘',
      dental: '🦷',
      specialist: '👩‍⚕️'
    };
    return icons[type] || '📅';
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedAppointment);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (window.confirm(currentLanguage === 'he' ? 'האם לבטל את התור?' : 'Cancel this appointment?')) {
      if (onCancel) {
        onCancel(appointment.id);
      }
    }
  };

  const handleReschedule = () => {
    if (onReschedule) {
      onReschedule(appointment.id);
    }
  };

  const status = getStatusBadge();
  const isPast = new Date(appointment.date) < new Date();
  const isCancelled = appointment.status === 'cancelled';

  return (
    <div style={{
      background: isCancelled 
        ? 'linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 100%)'
        : 'linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%)',
      borderRadius: '12px',
      marginBottom: '16px',
      border: `1px solid ${isCancelled ? '#d4d4d4' : '#bae6fd'}`,
      boxShadow: '0 2px 8px rgba(14, 165, 233, 0.1)',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      direction: isRTL ? 'rtl' : 'ltr',
      opacity: isCancelled ? 0.7 : 1
    }}>
      {/* Header */}
      <div style={{
        background: isCancelled 
          ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
          : 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
        color: 'white',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>
            {getAppointmentIcon(appointment.type)}
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
              {appointment.title || appointment.type}
              {appointment.doctor && <span style={{ fontWeight: '400', marginLeft: '8px' }}>• {appointment.doctor}</span>}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
              {formatDateTime(appointment.date)}
              {appointment.duration && <span> • {appointment.duration} {currentLanguage === 'he' ? 'דקות' : 'min'}</span>}
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
                  value={editedAppointment.title}
                  onChange={(e) => setEditedAppointment({ ...editedAppointment, title: e.target.value })}
                  placeholder={currentLanguage === 'he' ? 'כותרת' : 'Title'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                />
                <input
                  type="text"
                  value={editedAppointment.doctor}
                  onChange={(e) => setEditedAppointment({ ...editedAppointment, doctor: e.target.value })}
                  placeholder={currentLanguage === 'he' ? 'רופא' : 'Doctor'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <input
                type="datetime-local"
                value={editedAppointment.date ? new Date(editedAppointment.date).toISOString().slice(0, 16) : ''}
                onChange={(e) => setEditedAppointment({ ...editedAppointment, date: e.target.value })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.95rem'
                }}
              />
              <textarea
                value={editedAppointment.notes}
                onChange={(e) => setEditedAppointment({ ...editedAppointment, notes: e.target.value })}
                placeholder={currentLanguage === 'he' ? 'הערות' : 'Notes'}
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
                    background: '#0ea5e9',
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
              {/* Appointment Details */}
              <div style={{
                background: isCancelled ? '#f5f5f5' : '#f0f9ff',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: '#0c4a6e', fontWeight: '500' }}>
                      {currentLanguage === 'he' ? 'מיקום:' : 'Location:'}
                    </label>
                    <p style={{ margin: '4px 0', color: '#082f49' }}>
                      {appointment.location || (currentLanguage === 'he' ? 'המרפאה' : 'Practice')}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: '#0c4a6e', fontWeight: '500' }}>
                      {currentLanguage === 'he' ? 'סוג:' : 'Type:'}
                    </label>
                    <p style={{ margin: '4px 0', color: '#082f49' }}>
                      {appointment.type || (currentLanguage === 'he' ? 'ביקור רופא' : 'Doctor Visit')}
                    </p>
                  </div>
                  {appointment.reason && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.85rem', color: '#0c4a6e', fontWeight: '500' }}>
                        {currentLanguage === 'he' ? 'סיבת הביקור:' : 'Reason:'}
                      </label>
                      <p style={{ margin: '4px 0', color: '#082f49' }}>
                        {appointment.reason}
                      </p>
                    </div>
                  )}
                  {appointment.preparationInstructions && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.85rem', color: '#0c4a6e', fontWeight: '500' }}>
                        {currentLanguage === 'he' ? 'הכנה לפגישה:' : 'Preparation:'}
                      </label>
                      <p style={{ 
                        margin: '4px 0', 
                        color: '#082f49',
                        background: 'white',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #bae6fd'
                      }}>
                        {appointment.preparationInstructions}
                      </p>
                    </div>
                  )}
                </div>

                {appointment.notes && (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#0c4a6e', fontWeight: '500' }}>
                      {currentLanguage === 'he' ? 'הערות:' : 'Notes:'}
                    </label>
                    <p style={{ margin: '4px 0', color: '#082f49' }}>
                      {appointment.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {!isPast && !isCancelled && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={handleReschedule}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #0ea5e9',
                      background: 'white',
                      color: '#0ea5e9',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📅 {currentLanguage === 'he' ? 'שנה מועד' : 'Reschedule'}
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #0ea5e9',
                      background: 'white',
                      color: '#0ea5e9',
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
                    onClick={handleCancel}
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
                    ❌ {currentLanguage === 'he' ? 'בטל' : 'Cancel'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppointmentsCard;