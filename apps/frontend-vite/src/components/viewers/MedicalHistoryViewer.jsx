import React, { useState, useEffect } from 'react';
import BaseViewer from './BaseViewer';

const MedicalHistoryViewer = ({ data, language, mode = 'view' }) => {
  const { isRTL, isViewMode, isEditMode, isAddMode, baseStyles, formatDate, formatDateTime } = BaseViewer({ 
    data, 
    language, 
    mode 
  });
  
  // Handle various data structures
  const historyData = data?.history || data?.data || data || [];
  const isArray = Array.isArray(historyData);
  const entries = isArray ? historyData : (historyData.entries || []);
  
  // State for adding new entry
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    type: '',
    description: '',
    diagnosis: '',
    treatment: '',
    notes: ''
  });
  
  // Expose functions for chat commands
  useEffect(() => {
    window.addMedicalHistoryEntry = (entry) => {
      setNewEntry(prev => ({ ...prev, ...entry }));
    };
    
    return () => {
      delete window.addMedicalHistoryEntry;
    };
  }, []);
  
  const renderTimeline = () => {
    if (!entries || entries.length === 0) {
      return (
        <div style={baseStyles.emptyState}>
          <div style={baseStyles.emptyIcon}>📋</div>
          <div style={baseStyles.emptyText}>
            {isRTL ? 'אין היסטוריה רפואית' : 'No medical history'}
          </div>
          <div style={baseStyles.emptyHint}>
            {isRTL ? 'הקלד "הוסף היסטוריה רפואית" להתחלה' : 'Type "add medical history" to start'}
          </div>
        </div>
      );
    }
    
    return (
      <div style={baseStyles.timeline}>
        {entries.map((entry, index) => (
          <div key={entry._id || index} style={baseStyles.timelineItem}>
            {index < entries.length - 1 && <div style={baseStyles.timelineLine} />}
            <div style={baseStyles.timelineDot} />
            
            <div style={baseStyles.card}>
              <div style={baseStyles.cardHeader}>
                <div style={baseStyles.cardTitle}>
                  {entry.type || entry.category || (isRTL ? 'ביקור' : 'Visit')}
                  {entry.severity && (
                    <span style={{
                      ...baseStyles.badge,
                      ...(entry.severity === 'high' ? baseStyles.badgeDanger : 
                          entry.severity === 'medium' ? baseStyles.badgeWarning : 
                          baseStyles.badgeInfo)
                    }}>
                      {entry.severity}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>
                  {formatDate(entry.date || entry.visitDate || entry.createdAt)}
                </div>
              </div>
              
              <div style={baseStyles.cardContent}>
                {entry.diagnosis && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#4a9eff' }}>
                      {isRTL ? 'אבחנה:' : 'Diagnosis:'}
                    </strong> {entry.diagnosis}
                  </div>
                )}
                
                {entry.symptoms && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#4a9eff' }}>
                      {isRTL ? 'תסמינים:' : 'Symptoms:'}
                    </strong> {Array.isArray(entry.symptoms) ? entry.symptoms.join(', ') : entry.symptoms}
                  </div>
                )}
                
                {entry.treatment && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#4a9eff' }}>
                      {isRTL ? 'טיפול:' : 'Treatment:'}
                    </strong> {entry.treatment}
                  </div>
                )}
                
                {entry.medications && entry.medications.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#4a9eff' }}>
                      {isRTL ? 'תרופות:' : 'Medications:'}
                    </strong>
                    <div style={{ marginTop: '8px' }}>
                      {entry.medications.map((med, i) => (
                        <span key={i} style={baseStyles.chip}>
                          {med.name || med} {med.dosage && `- ${med.dosage}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {entry.notes && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#4a9eff' }}>
                      {isRTL ? 'הערות:' : 'Notes:'}
                    </strong> {entry.notes}
                  </div>
                )}
                
                {entry.provider && (
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#8b949e' }}>
                    {isRTL ? 'רופא:' : 'Provider:'} {entry.provider}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  const renderAddForm = () => {
    return (
      <div style={baseStyles.section}>
        <h3 style={baseStyles.sectionTitle}>
          {isRTL ? 'הוספת רשומה חדשה' : 'Add New Entry'}
        </h3>
        
        <div style={baseStyles.grid}>
          <div style={baseStyles.field}>
            <label style={baseStyles.label}>
              {isRTL ? 'תאריך' : 'Date'}
            </label>
            <input
              type="date"
              value={newEntry.date}
              onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
              style={baseStyles.input}
            />
          </div>
          
          <div style={baseStyles.field}>
            <label style={baseStyles.label}>
              {isRTL ? 'סוג' : 'Type'}
            </label>
            <select
              value={newEntry.type}
              onChange={(e) => setNewEntry({...newEntry, type: e.target.value})}
              style={baseStyles.input}
            >
              <option value="">{isRTL ? 'בחר סוג' : 'Select type'}</option>
              <option value="consultation">{isRTL ? 'ייעוץ' : 'Consultation'}</option>
              <option value="procedure">{isRTL ? 'פרוצדורה' : 'Procedure'}</option>
              <option value="surgery">{isRTL ? 'ניתוח' : 'Surgery'}</option>
              <option value="hospitalization">{isRTL ? 'אשפוז' : 'Hospitalization'}</option>
              <option value="emergency">{isRTL ? 'חירום' : 'Emergency'}</option>
            </select>
          </div>
          
          <div style={baseStyles.field}>
            <label style={baseStyles.label}>
              {isRTL ? 'אבחנה' : 'Diagnosis'}
            </label>
            <input
              type="text"
              value={newEntry.diagnosis}
              onChange={(e) => setNewEntry({...newEntry, diagnosis: e.target.value})}
              style={baseStyles.input}
              placeholder={isRTL ? 'הקלד אבחנה' : 'Enter diagnosis'}
            />
          </div>
          
          <div style={baseStyles.field}>
            <label style={baseStyles.label}>
              {isRTL ? 'טיפול' : 'Treatment'}
            </label>
            <input
              type="text"
              value={newEntry.treatment}
              onChange={(e) => setNewEntry({...newEntry, treatment: e.target.value})}
              style={baseStyles.input}
              placeholder={isRTL ? 'הקלד טיפול' : 'Enter treatment'}
            />
          </div>
        </div>
        
        <div style={baseStyles.field}>
          <label style={baseStyles.label}>
            {isRTL ? 'הערות' : 'Notes'}
          </label>
          <textarea
            value={newEntry.notes}
            onChange={(e) => setNewEntry({...newEntry, notes: e.target.value})}
            style={baseStyles.textarea}
            placeholder={isRTL ? 'הקלד הערות נוספות' : 'Enter additional notes'}
          />
        </div>
        
        <div style={baseStyles.infoBox}>
          {isRTL 
            ? 'השתמש בצ׳אט להוספת הרשומה: "שמור היסטוריה רפואית"'
            : 'Use chat to save: "save medical history"'}
        </div>
      </div>
    );
  };
  
  return (
    <div style={baseStyles.container}>
      <div style={baseStyles.header}>
        <div>
          <h2 style={baseStyles.title}>
            {isRTL ? 'היסטוריה רפואית' : 'Medical History'}
          </h2>
          {data?.patientName && (
            <div style={baseStyles.subtitle}>
              {data.patientName}
            </div>
          )}
        </div>
      </div>
      
      {isAddMode ? renderAddForm() : renderTimeline()}
    </div>
  );
};

export default MedicalHistoryViewer;