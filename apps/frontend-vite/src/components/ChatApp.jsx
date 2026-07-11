import React, { useState, useEffect, useCallback } from 'react';
import ChatInterfaceUnified from './ChatInterfaceUnified';
import ContextPanel from './ContextPanel';
import secureStorage from '../utils/secureStorage';
import './ChatApp.css';

const ChatApp = () => {
  const [language, setLanguage] = useState(() => {
    return secureStorage.getItem('appLanguage') || 'he';
  });
  
  // Single context state - only one thing shown at a time
  const [currentContext, setCurrentContext] = useState({
    type: null,      // null, 'patient-view', 'patient-edit', 'patient-list', 'document-view', etc.
    data: null,      // The actual data to display
    mode: 'view'     // 'view', 'edit', 'list'
  });
  
  const isRTL = language === 'he';
  
  // Handle different function results from chat
  const handleFunctionResult = useCallback((functionName, result, mode = 'view') => {
    process.env.NODE_ENV !== 'production' && console.log('🎯 ChatApp - Function result:', functionName, mode);
    
    // Map function names to context types
    const contextMap = {
      // Patient functions
      'searchPatients': { type: 'patient-list', mode: 'view' },
      'getPatient': { type: 'patient-view', mode: 'view' },
      'getPatientDetails': { type: 'patient-view', mode: 'view' },
      'updatePatient': { type: 'patient-edit', mode: 'edit' },
      'addPatient': { type: 'patient-add', mode: 'edit' },
      
      // Document functions
      'getDocuments': { type: 'document-list', mode: 'view' },
      'analyzeDocument': { type: 'document-view', mode: 'view' },
      'uploadDocument': { type: 'document-upload', mode: 'edit' },
      
      // Medical History
      'getMedicalHistory': { type: 'history-view', mode: 'view' },
      'addMedicalHistory': { type: 'history-add', mode: 'edit' },
      
      // Lab Results
      'getLabResults': { type: 'lab-view', mode: 'view' },
      'addLabResult': { type: 'lab-add', mode: 'edit' },
      
      // Medications
      'getMedications': { type: 'medication-view', mode: 'view' },
      'addMedication': { type: 'medication-add', mode: 'edit' },
      
      // Appointments
      'scheduleAppointment': { type: 'appointment-add', mode: 'edit' },
      'findAvailableSlots': { type: 'appointment-slots', mode: 'view' },
      
      // Diagnosis
      'analyzeSymptoms': { type: 'diagnosis-view', mode: 'view' },
      'recommendTreatment': { type: 'treatment-view', mode: 'view' },
      
      // Reports
      'generatePatientReport': { type: 'report-view', mode: 'view' },
      'generatePracticeReport': { type: 'report-view', mode: 'view' },
      
      // System
      'getSystemHealth': { type: 'system-health', mode: 'view' },
      'exportAuditLogs': { type: 'audit-view', mode: 'view' }
    };
    
    const contextConfig = contextMap[functionName];
    if (contextConfig) {
      setCurrentContext({
        type: contextConfig.type,
        mode: contextConfig.mode,
        data: result
      });
    } else {
      // If no specific mapping, close the panel
      process.env.NODE_ENV !== 'production' && console.log('No context mapping for:', functionName);
    }
  }, []);
  
  // Clear context (close panel) - only triggered by user saying "close" or similar
  const clearContext = useCallback(() => {
    setCurrentContext({
      type: null,
      data: null,
      mode: 'view'
    });
  }, []);
  
  // Expose handlers globally for ChatInterface
  useEffect(() => {
    window.handleFunctionResult = handleFunctionResult;
    window.clearContextPanel = clearContext;
    
    return () => {
      delete window.handleFunctionResult;
      delete window.clearContextPanel;
    };
  }, [handleFunctionResult, clearContext]);
  
  return (
    <div className={`chat-app ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Context Panel - NO interactive elements, just display */}
      {currentContext.type && (
        <div className="context-panel-container">
          <ContextPanel 
            context={currentContext}
            language={language}
          />
        </div>
      )}
      
      {/* Chat Panel - The ONLY place for user interaction */}
      <div className={`chat-panel-container ${currentContext.type ? 'with-context' : 'full-width'}`}>
        <ChatInterfaceUnified 
          language={language}
        />
      </div>
    </div>
  );
};

export default ChatApp;