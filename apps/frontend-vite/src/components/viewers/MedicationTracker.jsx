import React, { useState, useEffect } from 'react';
import './MedicationTracker.css';
import secureApi from '../../services/secureApiClient';

import secureStorage from '../../utils/secureStorage';
const MedicationTracker = ({ patientId, language }) => {
  const [medications, setMedications] = useState([]);
  const [view, setView] = useState('current'); // current, history, schedule
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const isRTL = language === 'he';
  
  // Fetch real medications from backend
  useEffect(() => {
    if (!patientId) return;
    
    const fetchMedications = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const token = secureStorage.getItem('token');
        const subdomain = secureStorage.getItem('practiceSubdomain') || 'developer';
        const status = view === 'history' ? 'all' : 'active';
        
        const data = await secureApi.get(
          `/medical-data/patients/${patientId}/medications?status=${status}`
        );
        
        if (data.error) {
          throw new Error('Failed to fetch medications');
        }
        
        // Transform data to match component format
        const transformedMeds = data.data.map(med => ({
          id: med._id,
          name: med.medicationName,
          genericName: med.genericName || med.medicationName,
          dosage: med.dosage,
          frequency: med.frequency,
          route: med.route || (isRTL ? 'דרך הפה' : 'Oral'),
          startDate: med.startDate || med.prescribedDate,
          endDate: med.endDate,
          status: med.status,
          prescribedBy: med.prescribedBy || (isRTL ? 'רופא' : 'Doctor'),
          indication: med.indication,
          instructions: med.instructions,
          refills: med.refills || 0,
          lastFilled: med.lastFilled,
          adherence: med.adherence || 0
        }));
        
        // If no real data, provide a message
        if (transformedMeds.length === 0) {
          setMedications([]);
        } else {
          setMedications(transformedMeds);
        }
        
      } catch (err) {
        process.env.NODE_ENV !== 'production' && console.error('Error fetching medications:', err);
        setError(err.message);
        setMedications([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMedications();
  }, [patientId, view, isRTL]);
  
  // Temporary mock data for development - remove this later
  const mockMeds = [
      {
        id: 1,
        name: 'Metformin',
        genericName: 'Metformin HCl',
        dosage: '500mg',
        frequency: isRTL ? 'פעמיים ביום' : 'Twice daily',
        route: isRTL ? 'דרך הפה' : 'Oral',
        startDate: '2024-10-15',
        endDate: null,
        status: 'active',
        prescribedBy: isRTL ? 'ד״ר כהן' : 'Dr. Cohen',
        indication: isRTL ? 'סכרת סוג 2' : 'Type 2 Diabetes',
        instructions: isRTL ? 'לקחת עם ארוחה' : 'Take with meals',
        refills: 3,
        lastFilled: '2024-12-20',
        adherence: 92
      },
      {
        id: 2,
        name: 'Lisinopril',
        genericName: 'Lisinopril',
        dosage: '10mg',
        frequency: isRTL ? 'פעם ביום' : 'Once daily',
        route: isRTL ? 'דרך הפה' : 'Oral',
        startDate: '2024-08-20',
        endDate: null,
        status: 'active',
        prescribedBy: isRTL ? 'ד״ר לוי' : 'Dr. Levy',
        indication: isRTL ? 'יתר לחץ דם' : 'Hypertension',
        instructions: isRTL ? 'בבוקר' : 'In the morning',
        refills: 5,
        lastFilled: '2025-01-05',
        adherence: 88
      },
      {
        id: 3,
        name: 'Atorvastatin',
        genericName: 'Atorvastatin Calcium',
        dosage: '20mg',
        frequency: isRTL ? 'פעם ביום' : 'Once daily',
        route: isRTL ? 'דרך הפה' : 'Oral',
        startDate: '2024-06-10',
        endDate: null,
        status: 'active',
        prescribedBy: isRTL ? 'ד״ר כהן' : 'Dr. Cohen',
        indication: isRTL ? 'כולסטרול גבוה' : 'High Cholesterol',
        instructions: isRTL ? 'לפני השינה' : 'At bedtime',
        refills: 2,
        lastFilled: '2024-11-15',
        adherence: 95
      },
      {
        id: 4,
        name: 'Amoxicillin',
        genericName: 'Amoxicillin',
        dosage: '500mg',
        frequency: isRTL ? '3 פעמים ביום' : 'Three times daily',
        route: isRTL ? 'דרך הפה' : 'Oral',
        startDate: '2024-12-10',
        endDate: '2024-12-20',
        status: 'completed',
        prescribedBy: isRTL ? 'ד״ר שמיר' : 'Dr. Shamir',
        indication: isRTL ? 'דלקת גרון' : 'Strep Throat',
        instructions: isRTL ? 'לסיים את כל המנה' : 'Complete full course',
        refills: 0,
        lastFilled: '2024-12-10',
        adherence: 100
      }
    ];
    // Comment out mock data - only used if API fails
    // setMedications(mockMeds);
  
  const currentMeds = medications.filter(m => m.status === 'active');
  const historyMeds = medications.filter(m => m.status !== 'active');
  
  const getAdherenceColor = (adherence) => {
    if (adherence >= 90) return '#10b981';
    if (adherence >= 70) return '#f59e0b';
    return '#ef4444';
  };
  
  const getDaysUntilRefill = (lastFilled) => {
    const lastDate = new Date(lastFilled);
    const today = new Date();
    const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysSince);
  };
  
  const handleStopMedication = (med) => {
    process.env.NODE_ENV !== 'production' && console.log('Stop medication:', med.name);
    // In real app, would update medication status
  };
  
  const handleRefill = (med) => {
    process.env.NODE_ENV !== 'production' && console.log('Request refill for:', med.name);
    // In real app, would send refill request
  };
  
  const getTodaysSchedule = () => {
    const schedule = [
      { time: '08:00', meds: ['Lisinopril 10mg', 'Metformin 500mg'] },
      { time: '13:00', meds: ['Metformin 500mg'] },
      { time: '22:00', meds: ['Atorvastatin 20mg'] }
    ];
    return schedule;
  };
  
  return (
    <div className={`medication-tracker ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header with View Tabs */}
      <div className="med-header">
        <h3>{isRTL ? 'ניהול תרופות' : 'Medication Management'}</h3>
        <button className="add-med-button" onClick={() => setShowAddForm(true)}>
          + {isRTL ? 'הוסף תרופה' : 'Add Medication'}
        </button>
      </div>
      
      {/* View Tabs */}
      <div className="view-tabs">
        <button 
          className={view === 'current' ? 'active' : ''}
          onClick={() => setView('current')}
        >
          💊 {isRTL ? 'תרופות נוכחיות' : 'Current'} ({currentMeds.length})
        </button>
        <button 
          className={view === 'history' ? 'active' : ''}
          onClick={() => setView('history')}
        >
          📜 {isRTL ? 'היסטוריה' : 'History'} ({historyMeds.length})
        </button>
        <button 
          className={view === 'schedule' ? 'active' : ''}
          onClick={() => setView('schedule')}
        >
          ⏰ {isRTL ? 'לוח זמנים' : 'Schedule'}
        </button>
      </div>
      
      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{isRTL ? 'טוען תרופות...' : 'Loading medications...'}</p>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="error-state">
          <p>{isRTL ? 'שגיאה בטעינת תרופות' : 'Error loading medications'}</p>
          <small>{error}</small>
        </div>
      )}
      
      {/* Content based on view */}
      <div className="med-content">
        {!loading && !error && view === 'current' && (
          <div className="current-medications">
            {currentMeds.length === 0 ? (
              <div className="no-data-message">
                <p>{isRTL ? 'אין תרופות פעילות' : 'No active medications'}</p>
              </div>
            ) : null}
            {currentMeds.map(med => (
              <div key={med.id} className="medication-card">
                <div className="med-header-section">
                  <div className="med-title">
                    <h4>{med.name}</h4>
                    <span className="generic-name">{med.genericName}</span>
                  </div>
                  <div className="med-status active">
                    {isRTL ? 'פעיל' : 'Active'}
                  </div>
                </div>
                
                <div className="med-details">
                  <div className="detail-row">
                    <span className="detail-label">💊 {isRTL ? 'מינון' : 'Dosage'}:</span>
                    <span className="detail-value">{med.dosage} - {med.frequency}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">🏥 {isRTL ? 'רופא' : 'Prescribed by'}:</span>
                    <span className="detail-value">{med.prescribedBy}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">🎯 {isRTL ? 'התוויה' : 'Indication'}:</span>
                    <span className="detail-value">{med.indication}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">📝 {isRTL ? 'הוראות' : 'Instructions'}:</span>
                    <span className="detail-value">{med.instructions}</span>
                  </div>
                </div>
                
                <div className="med-metrics">
                  <div className="metric">
                    <span className="metric-label">{isRTL ? 'היענות' : 'Adherence'}</span>
                    <div className="adherence-bar">
                      <div 
                        className="adherence-fill"
                        style={{ 
                          width: `${med.adherence}%`,
                          backgroundColor: getAdherenceColor(med.adherence)
                        }}
                      />
                    </div>
                    <span className="metric-value" style={{ color: getAdherenceColor(med.adherence) }}>
                      {med.adherence}%
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">{isRTL ? 'מילוי חוזר' : 'Refills'}</span>
                    <span className="metric-value">{med.refills} {isRTL ? 'נותרו' : 'remaining'}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">{isRTL ? 'ימים למילוי' : 'Days to refill'}</span>
                    <span className="metric-value">{getDaysUntilRefill(med.lastFilled)}</span>
                  </div>
                </div>
                
                <div className="med-actions">
                  <button className="med-button refill" onClick={() => handleRefill(med)}>
                    🔄 {isRTL ? 'בקש מילוי' : 'Request Refill'}
                  </button>
                  <button className="med-button stop" onClick={() => handleStopMedication(med)}>
                    ⏹️ {isRTL ? 'הפסק' : 'Stop'}
                  </button>
                  <button className="med-button info" onClick={() => setSelectedMed(med)}>
                    ℹ️ {isRTL ? 'מידע' : 'Info'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {view === 'history' && (
          <div className="medication-history">
            {historyMeds.map(med => (
              <div key={med.id} className="history-item">
                <div className="history-header">
                  <span className="med-name">{med.name} {med.dosage}</span>
                  <span className="history-status completed">
                    {isRTL ? 'הושלם' : 'Completed'}
                  </span>
                </div>
                <div className="history-details">
                  <span>{new Date(med.startDate).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')} - 
                        {new Date(med.endDate).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}</span>
                  <span>{med.indication}</span>
                  <span>{med.prescribedBy}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {view === 'schedule' && (
          <div className="medication-schedule">
            <div className="schedule-header">
              <h4>{isRTL ? 'לוח זמנים יומי' : "Today's Schedule"}</h4>
              <span className="schedule-date">
                {new Date().toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}
              </span>
            </div>
            {getTodaysSchedule().map((slot, idx) => (
              <div key={idx} className="schedule-slot">
                <div className="slot-time">⏰ {slot.time}</div>
                <div className="slot-meds">
                  {slot.meds.map((med, midx) => (
                    <div key={midx} className="scheduled-med">
                      <span className="med-icon">💊</span>
                      <span>{med}</span>
                      <input type="checkbox" className="taken-checkbox" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Alerts Section - Only show if we have real medications with alerts */}
      {medications.length === 0 ? (
        <div className="med-alerts">
          <div className="alert info">
            ℹ️ {isRTL ? 'אין התראות תרופות' : 'No medication alerts'}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MedicationTracker;