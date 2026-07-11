import React, { useState } from 'react';
import './MedicalHistoryCard.css';

const MedicalHistoryCard = ({ medicalHistory, patient, language }) => {
  const [expandedItems, setExpandedItems] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const isRTL = language === 'he';

  // Group history by category
  const groupedHistory = medicalHistory?.reduce((acc, item) => {
    const category = item.category || 'consultation_notes';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {}) || {};

  // Category labels
  const categoryLabels = {
    consultation_notes: isRTL ? 'ביקורים' : 'Consultations',
    prescriptions: isRTL ? 'מרשמים' : 'Prescriptions',
    lab_results: isRTL ? 'בדיקות מעבדה' : 'Lab Results',
    imaging_reports: isRTL ? 'דימות רפואי' : 'Imaging',
    discharge_summary: isRTL ? 'סיכומי שחרור' : 'Discharge Summary',
    vaccination_records: isRTL ? 'חיסונים' : 'Vaccinations',
    referrals: isRTL ? 'הפניות' : 'Referrals',
    medical_procedures: isRTL ? 'פרוצדורות' : 'Procedures'
  };

  // Toggle item expansion
  const toggleExpanded = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Format date
  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };

  // Get priority badge
  const getPriorityBadge = (item) => {
    if (item.priority === 'urgent' || item.isUrgent) {
      return <span className="priority-badge urgent">{isRTL ? 'דחוף' : 'Urgent'}</span>;
    }
    if (item.priority === 'high') {
      return <span className="priority-badge high">{isRTL ? 'גבוה' : 'High'}</span>;
    }
    return null;
  };

  // Render history item
  const renderHistoryItem = (item, index) => {
    const isExpanded = expandedItems[item._id || index];
    
    return (
      <div key={item._id || index} className="history-item">
        <div className="history-item-header" onClick={() => toggleExpanded(item._id || index)}>
          <div className="history-item-title">
            <span className="history-date">{formatDate(item.date)}</span>
            <span className="history-category">{categoryLabels[item.category]}</span>
            {getPriorityBadge(item)}
          </div>
          <div className="history-item-summary">
            {item.diagnosis || item.summary || item.description || 
             (isRTL ? 'לחץ לפרטים נוספים' : 'Click for details')}
          </div>
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
        
        {isExpanded && (
          <div className="history-item-details">
            {/* Consultation Notes */}
            {item.category === 'consultation_notes' && (
              <>
                {item.diagnosis && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'אבחנה:' : 'Diagnosis:'}</strong> {item.diagnosis}
                  </div>
                )}
                {item.symptoms && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'תסמינים:' : 'Symptoms:'}</strong> {item.symptoms}
                  </div>
                )}
                {item.treatment && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'טיפול:' : 'Treatment:'}</strong> {item.treatment}
                  </div>
                )}
                {item.visitType && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'סוג ביקור:' : 'Visit Type:'}</strong> {item.visitType}
                  </div>
                )}
              </>
            )}

            {/* Lab Results */}
            {item.category === 'lab_results' && (
              <>
                {item.testType && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'סוג בדיקה:' : 'Test Type:'}</strong> {item.testType}
                  </div>
                )}
                {item.results && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'תוצאות:' : 'Results:'}</strong> {item.results}
                  </div>
                )}
                {item.referenceRange && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'טווח תקין:' : 'Reference Range:'}</strong> {item.referenceRange}
                  </div>
                )}
                {item.isAbnormal && (
                  <div className="alert-box">
                    {isRTL ? '⚠️ תוצאה חריגה' : '⚠️ Abnormal Result'}
                  </div>
                )}
              </>
            )}

            {/* Imaging Reports */}
            {item.category === 'imaging_reports' && (
              <>
                {item.imagingType && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'סוג דימות:' : 'Imaging Type:'}</strong> {item.imagingType}
                  </div>
                )}
                {item.findings && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'ממצאים:' : 'Findings:'}</strong> 
                    <div className="findings-text">{item.findings}</div>
                  </div>
                )}
                {item.impression && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'רושם:' : 'Impression:'}</strong> {item.impression}
                  </div>
                )}
                {item.recommendations && (
                  <div className="detail-row">
                    <strong>{isRTL ? 'המלצות:' : 'Recommendations:'}</strong>
                    <div className="recommendations-text">{item.recommendations}</div>
                  </div>
                )}
              </>
            )}

            {/* Prescriptions */}
            {item.category === 'prescriptions' && item.medications && (
              <div className="medications-list">
                <strong>{isRTL ? 'תרופות:' : 'Medications:'}</strong>
                {item.medications.map((med, idx) => (
                  <div key={idx} className="medication-item">
                    <span className="med-name">{med.name}</span>
                    {med.dosage && <span className="med-dosage">{med.dosage}</span>}
                    {med.frequency && <span className="med-frequency">{med.frequency}</span>}
                    {med.duration && <span className="med-duration">{med.duration}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Additional Notes */}
            {item.notes && (
              <div className="detail-row notes">
                <strong>{isRTL ? 'הערות:' : 'Notes:'}</strong> {item.notes}
              </div>
            )}

            {/* Provider Info */}
            {(item.provider || item.prescribingDoctor) && (
              <div className="detail-row provider">
                <strong>{isRTL ? 'רופא:' : 'Provider:'}</strong> {item.provider || item.prescribingDoctor}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Filter history by category
  const filteredHistory = selectedCategory === 'all' 
    ? medicalHistory 
    : medicalHistory?.filter(item => item.category === selectedCategory);

  return (
    <div className={`medical-history-card ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Patient Header */}
      {patient && (
        <div className="patient-header">
          <h3>{patient.firstName} {patient.lastName}</h3>
          <div className="patient-info">
            <span>{isRTL ? 'ת.ז:' : 'ID:'} {patient.nationalId || patient.ssn}</span>
            <span>{isRTL ? 'טלפון:' : 'Phone:'} {patient.phone}</span>
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="category-filter">
        <button 
          className={selectedCategory === 'all' ? 'active' : ''}
          onClick={() => setSelectedCategory('all')}
        >
          {isRTL ? 'הכל' : 'All'}
        </button>
        {Object.keys(groupedHistory).map(category => (
          <button
            key={category}
            className={selectedCategory === category ? 'active' : ''}
            onClick={() => setSelectedCategory(category)}
          >
            {categoryLabels[category]} ({groupedHistory[category].length})
          </button>
        ))}
      </div>

      {/* History List */}
      <div className="history-list">
        {filteredHistory && filteredHistory.length > 0 ? (
          filteredHistory
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((item, index) => renderHistoryItem(item, index))
        ) : (
          <div className="no-history">
            {isRTL ? 'אין היסטוריה רפואית זמינה' : 'No medical history available'}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalHistoryCard;