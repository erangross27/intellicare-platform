import React, { useState, useEffect } from 'react';

const FunctionLoading = ({ functionName, config, language = 'he' }) => {
  const [dots, setDots] = useState('');
  const [progress, setProgress] = useState(0);
  
  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);
  
  // Simulate progress
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 20;
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);
  
  // Get loading message based on function
  const getLoadingMessage = () => {
    const messages = {
      // Patient functions
      searchPatients: language === 'he' ? 'מחפש מטופלים' : 'Searching patients',
      getPatient: language === 'he' ? 'טוען פרטי מטופל' : 'Loading patient details',
      addPatient: language === 'he' ? 'מוסיף מטופל חדש' : 'Adding new patient',
      updatePatient: language === 'he' ? 'מעדכן פרטי מטופל' : 'Updating patient details',
      
      // Lab functions
      getLabResults: language === 'he' ? 'טוען תוצאות מעבדה' : 'Loading lab results',
      compareLabResults: language === 'he' ? 'משווה תוצאות' : 'Comparing results',
      getLabTrends: language === 'he' ? 'מנתח מגמות' : 'Analyzing trends',
      
      // Document functions
      uploadDocument: language === 'he' ? 'מעלה מסמך' : 'Uploading document',
      viewDocument: language === 'he' ? 'טוען מסמך' : 'Loading document',
      getDocuments: language === 'he' ? 'טוען רשימת מסמכים' : 'Loading documents',
      analyzeDocument: language === 'he' ? 'מנתח מסמך' : 'Analyzing document',
      
      // Medication functions
      getMedications: language === 'he' ? 'טוען רשימת תרופות' : 'Loading medications',
      checkDrugInteractions: language === 'he' ? 'בודק אינטראקציות' : 'Checking interactions',
      prescribeMedication: language === 'he' ? 'יוצר מרשם' : 'Creating prescription',
      
      // Appointment functions
      scheduleAppointment: language === 'he' ? 'קובע תור' : 'Scheduling appointment',
      getAppointments: language === 'he' ? 'טוען לוח תורים' : 'Loading appointments',
      getAvailableSlots: language === 'he' ? 'בודק זמינות' : 'Checking availability',
      
      // Default
      default: language === 'he' ? 'מעבד' : 'Processing'
    };
    
    return messages[functionName] || messages.default;
  };
  
  return (
    <div style={styles.container}>
      {/* Icon animation */}
      <div style={styles.iconWrapper}>
        <span style={styles.icon}>
          {config?.icon || '⚙️'}
        </span>
      </div>
      
      {/* Loading message */}
      <div style={styles.message}>
        {getLoadingMessage()}{dots}
      </div>
      
      {/* Progress bar */}
      <div style={styles.progressBar}>
        <div 
          style={{
            ...styles.progressFill,
            width: `${progress}%`
          }}
        />
      </div>
      
      {/* Function name (subtle) */}
      <div style={styles.functionName}>
        {functionName}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    margin: '12px 0'
  },
  
  iconWrapper: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    animation: 'pulse 2s infinite'
  },
  
  icon: {
    fontSize: '24px',
    animation: 'rotate 2s linear infinite'
  },
  
  message: {
    fontSize: '14px',
    color: '#e3e3e8',
    fontWeight: '500',
    minHeight: '20px'
  },
  
  progressBar: {
    width: '200px',
    height: '3px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    transition: 'width 0.3s ease-out',
    borderRadius: '3px'
  },
  
  functionName: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.3)',
    fontFamily: 'monospace',
    marginTop: '4px'
  }
};

// Add animations to document
if (typeof document !== 'undefined' && !document.getElementById('function-loading-styles')) {
  const style = document.createElement('style');
  style.id = 'function-loading-styles';
  style.textContent = `
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
      0%, 100% { 
        transform: scale(1);
        opacity: 1;
      }
      50% { 
        transform: scale(1.1);
        opacity: 0.8;
      }
    }
  `;
  document.head.appendChild(style);
}

export default FunctionLoading;