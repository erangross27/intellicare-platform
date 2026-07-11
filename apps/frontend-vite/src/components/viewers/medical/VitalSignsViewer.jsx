import React, { useState, useEffect } from 'react';
import secureApiClient from '../../../services/secureApiClient';

const VitalSignsViewer = ({ patientId, patientName, language }) => {
  const isRTL = language === 'he';
  const [vitalSigns, setVitalSigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('latest'); // 'latest' or 'history'
  
  useEffect(() => {
    fetchVitalSigns();
  }, [patientId]);
  
  const fetchVitalSigns = async () => {
    try {
      const practiceSubdomain = window.location.hostname.split('.')[0];
      
      const response = await secureApiClient.get(
        `/api/medical-data/patients/${patientId}/vital-signs`,
        {
          headers: {
            'X-Practice-Subdomain': practiceSubdomain
          }
        }
      );
      
      setVitalSigns(response.data || []);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error fetching vital signs:', error);
    } finally {
      setLoading(false);
    }
  };
  
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
    vitalGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    },
    vitalCard: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(74, 158, 255, 0.2)',
      textAlign: 'center'
    },
    vitalIcon: {
      fontSize: '32px',
      marginBottom: '12px',
      opacity: 0.9
    },
    vitalLabel: {
      fontSize: '13px',
      color: '#8b949e',
      marginBottom: '8px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    vitalValue: {
      fontSize: '28px',
      fontWeight: 600,
      color: '#ffffff',
      marginBottom: '4px'
    },
    vitalUnit: {
      fontSize: '14px',
      color: '#8b949e'
    },
    vitalStatus: {
      marginTop: '8px',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 500,
      display: 'inline-block'
    },
    statusNormal: {
      background: 'rgba(52, 211, 153, 0.2)',
      color: '#34d399'
    },
    statusWarning: {
      background: 'rgba(251, 191, 36, 0.2)',
      color: '#fbbf24'
    },
    statusCritical: {
      background: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444'
    },
    historyTable: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    tableHeader: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderBottom: '2px solid rgba(74, 158, 255, 0.2)'
    },
    tableHeaderCell: {
      padding: '12px',
      textAlign: isRTL ? 'right' : 'left',
      fontSize: '13px',
      fontWeight: 600,
      color: '#a8b2d1',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    tableRow: {
      borderBottom: '1px solid rgba(74, 158, 255, 0.1)',
      transition: 'all 0.2s ease'
    },
    tableCell: {
      padding: '12px',
      fontSize: '14px',
      color: '#e8eaf0'
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
    },
    trendIndicator: {
      marginLeft: '8px',
      fontSize: '16px'
    },
    trendUp: {
      color: '#ef4444'
    },
    trendDown: {
      color: '#34d399'
    },
    trendStable: {
      color: '#8b949e'
    }
  };
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  const formatTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getVitalStatus = (type, value) => {
    // Define normal ranges
    const ranges = {
      bloodPressureSystolic: { min: 90, max: 140, critical: { min: 70, max: 180 } },
      bloodPressureDiastolic: { min: 60, max: 90, critical: { min: 40, max: 110 } },
      pulse: { min: 60, max: 100, critical: { min: 40, max: 130 } },
      temperature: { min: 36.1, max: 37.2, critical: { min: 35, max: 38.5 } },
      respiratoryRate: { min: 12, max: 20, critical: { min: 8, max: 30 } },
      oxygenSaturation: { min: 95, max: 100, critical: { min: 90, max: 100 } }
    };
    
    const range = ranges[type];
    if (!range) return 'normal';
    
    if (value < range.critical.min || value > range.critical.max) return 'critical';
    if (value < range.min || value > range.max) return 'warning';
    return 'normal';
  };
  
  // Mock data for demonstration
  const mockVitalSigns = [
    {
      _id: '1',
      date: new Date(),
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      pulse: 72,
      temperature: 36.8,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      weight: 75,
      height: 175,
      bmi: 24.5
    },
    {
      _id: '2',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      bloodPressureSystolic: 125,
      bloodPressureDiastolic: 82,
      pulse: 78,
      temperature: 37.1,
      respiratoryRate: 18,
      oxygenSaturation: 97,
      weight: 75,
      height: 175,
      bmi: 24.5
    },
    {
      _id: '3',
      date: new Date(Date.now() - 48 * 60 * 60 * 1000),
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 78,
      pulse: 70,
      temperature: 36.6,
      respiratoryRate: 14,
      oxygenSaturation: 99,
      weight: 74.5,
      height: 175,
      bmi: 24.3
    }
  ];
  
  const displayVitalSigns = vitalSigns.length > 0 ? vitalSigns : mockVitalSigns;
  const latestVitals = displayVitalSigns[0] || {};
  
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⏳</div>
          <div style={styles.emptyText}>
            {isRTL ? 'טוען סימנים חיוניים...' : 'Loading vital signs...'}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          📊 {isRTL ? 'סימנים חיוניים' : 'Vital Signs'}
        </h2>
        <div style={styles.subtitle}>
          {patientName && `${isRTL ? 'מטופל:' : 'Patient:'} ${patientName}`}
          {latestVitals.date && ` • ${isRTL ? 'עדכון אחרון:' : 'Last updated:'} ${formatDate(latestVitals.date)} ${formatTime(latestVitals.date)}`}
        </div>
      </div>
      
      {displayVitalSigns.length > 0 ? (
        <>
          {/* Latest Vital Signs Grid */}
          <div style={styles.vitalGrid}>
            {/* Blood Pressure */}
            <div style={styles.vitalCard}>
              <div style={styles.vitalIcon}>🩺</div>
              <div style={styles.vitalLabel}>{isRTL ? 'לחץ דם' : 'Blood Pressure'}</div>
              <div style={styles.vitalValue}>
                {latestVitals.bloodPressureSystolic}/{latestVitals.bloodPressureDiastolic}
              </div>
              <div style={styles.vitalUnit}>mmHg</div>
              <div style={{
                ...styles.vitalStatus,
                ...styles[`status${getVitalStatus('bloodPressureSystolic', latestVitals.bloodPressureSystolic) === 'normal' ? 'Normal' : getVitalStatus('bloodPressureSystolic', latestVitals.bloodPressureSystolic) === 'warning' ? 'Warning' : 'Critical'}`]
              }}>
                {getVitalStatus('bloodPressureSystolic', latestVitals.bloodPressureSystolic) === 'normal' ? (isRTL ? 'תקין' : 'Normal') : getVitalStatus('bloodPressureSystolic', latestVitals.bloodPressureSystolic) === 'warning' ? (isRTL ? 'חריג' : 'Abnormal') : (isRTL ? 'קריטי' : 'Critical')}
              </div>
            </div>
            
            {/* Pulse */}
            <div style={styles.vitalCard}>
              <div style={styles.vitalIcon}>❤️</div>
              <div style={styles.vitalLabel}>{isRTL ? 'דופק' : 'Pulse'}</div>
              <div style={styles.vitalValue}>{latestVitals.pulse}</div>
              <div style={styles.vitalUnit}>bpm</div>
              <div style={{
                ...styles.vitalStatus,
                ...styles[`status${getVitalStatus('pulse', latestVitals.pulse) === 'normal' ? 'Normal' : getVitalStatus('pulse', latestVitals.pulse) === 'warning' ? 'Warning' : 'Critical'}`]
              }}>
                {getVitalStatus('pulse', latestVitals.pulse) === 'normal' ? (isRTL ? 'תקין' : 'Normal') : getVitalStatus('pulse', latestVitals.pulse) === 'warning' ? (isRTL ? 'חריג' : 'Abnormal') : (isRTL ? 'קריטי' : 'Critical')}
              </div>
            </div>
            
            {/* Temperature */}
            <div style={styles.vitalCard}>
              <div style={styles.vitalIcon}>🌡️</div>
              <div style={styles.vitalLabel}>{isRTL ? 'חום' : 'Temperature'}</div>
              <div style={styles.vitalValue}>{latestVitals.temperature}</div>
              <div style={styles.vitalUnit}>°C</div>
              <div style={{
                ...styles.vitalStatus,
                ...styles[`status${getVitalStatus('temperature', latestVitals.temperature) === 'normal' ? 'Normal' : getVitalStatus('temperature', latestVitals.temperature) === 'warning' ? 'Warning' : 'Critical'}`]
              }}>
                {getVitalStatus('temperature', latestVitals.temperature) === 'normal' ? (isRTL ? 'תקין' : 'Normal') : getVitalStatus('temperature', latestVitals.temperature) === 'warning' ? (isRTL ? 'חריג' : 'Fever') : (isRTL ? 'קריטי' : 'Critical')}
              </div>
            </div>
            
            {/* Respiratory Rate */}
            <div style={styles.vitalCard}>
              <div style={styles.vitalIcon}>💨</div>
              <div style={styles.vitalLabel}>{isRTL ? 'קצב נשימה' : 'Respiratory Rate'}</div>
              <div style={styles.vitalValue}>{latestVitals.respiratoryRate}</div>
              <div style={styles.vitalUnit}>breaths/min</div>
              <div style={{
                ...styles.vitalStatus,
                ...styles.statusNormal
              }}>
                {isRTL ? 'תקין' : 'Normal'}
              </div>
            </div>
            
            {/* Oxygen Saturation */}
            <div style={styles.vitalCard}>
              <div style={styles.vitalIcon}>🫁</div>
              <div style={styles.vitalLabel}>{isRTL ? 'רוויון חמצן' : 'O₂ Saturation'}</div>
              <div style={styles.vitalValue}>{latestVitals.oxygenSaturation}</div>
              <div style={styles.vitalUnit}>%</div>
              <div style={{
                ...styles.vitalStatus,
                ...styles[`status${getVitalStatus('oxygenSaturation', latestVitals.oxygenSaturation) === 'normal' ? 'Normal' : getVitalStatus('oxygenSaturation', latestVitals.oxygenSaturation) === 'warning' ? 'Warning' : 'Critical'}`]
              }}>
                {getVitalStatus('oxygenSaturation', latestVitals.oxygenSaturation) === 'normal' ? (isRTL ? 'תקין' : 'Normal') : getVitalStatus('oxygenSaturation', latestVitals.oxygenSaturation) === 'warning' ? (isRTL ? 'נמוך' : 'Low') : (isRTL ? 'קריטי' : 'Critical')}
              </div>
            </div>
            
            {/* BMI */}
            {latestVitals.bmi && (
              <div style={styles.vitalCard}>
                <div style={styles.vitalIcon}>⚖️</div>
                <div style={styles.vitalLabel}>{isRTL ? 'BMI' : 'BMI'}</div>
                <div style={styles.vitalValue}>{latestVitals.bmi.toFixed(1)}</div>
                <div style={styles.vitalUnit}>kg/m²</div>
                <div style={{
                  ...styles.vitalStatus,
                  ...styles.statusNormal
                }}>
                  {latestVitals.bmi < 18.5 ? (isRTL ? 'תת משקל' : 'Underweight') :
                   latestVitals.bmi < 25 ? (isRTL ? 'תקין' : 'Normal') :
                   latestVitals.bmi < 30 ? (isRTL ? 'עודף משקל' : 'Overweight') :
                   (isRTL ? 'השמנה' : 'Obese')}
                </div>
              </div>
            )}
          </div>
          
          {/* History Table */}
          {displayVitalSigns.length > 1 && (
            <>
              <h3 style={{ ...styles.title, fontSize: '18px', marginTop: '24px' }}>
                📈 {isRTL ? 'היסטוריה' : 'History'}
              </h3>
              <table style={styles.historyTable}>
                <thead style={styles.tableHeader}>
                  <tr>
                    <th style={styles.tableHeaderCell}>{isRTL ? 'תאריך' : 'Date'}</th>
                    <th style={styles.tableHeaderCell}>{isRTL ? 'שעה' : 'Time'}</th>
                    <th style={styles.tableHeaderCell}>{isRTL ? 'לחץ דם' : 'BP'}</th>
                    <th style={styles.tableHeaderCell}>{isRTL ? 'דופק' : 'Pulse'}</th>
                    <th style={styles.tableHeaderCell}>{isRTL ? 'חום' : 'Temp'}</th>
                    <th style={styles.tableHeaderCell}>{isRTL ? 'חמצן' : 'O₂'}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayVitalSigns.slice(1).map((vital) => (
                    <tr key={vital._id} style={styles.tableRow}>
                      <td style={styles.tableCell}>{formatDate(vital.date)}</td>
                      <td style={styles.tableCell}>{formatTime(vital.date)}</td>
                      <td style={styles.tableCell}>
                        {vital.bloodPressureSystolic}/{vital.bloodPressureDiastolic}
                      </td>
                      <td style={styles.tableCell}>{vital.pulse}</td>
                      <td style={styles.tableCell}>{vital.temperature}°C</td>
                      <td style={styles.tableCell}>{vital.oxygenSaturation}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      ) : (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📊</div>
          <div style={styles.emptyText}>
            {isRTL ? 'אין סימנים חיוניים רשומים' : 'No vital signs recorded'}
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSignsViewer;