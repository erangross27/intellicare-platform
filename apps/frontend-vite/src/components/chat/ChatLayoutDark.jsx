import React, { useState, useEffect, useCallback } from 'react';
import ChatInterfaceDark from '../ChatInterfaceDark';
import DocumentViewerSimple from '../viewers/DocumentViewerSimple';
import PatientCardDark from '../viewers/PatientCardDark';
import LabResultsViewer from '../viewers/LabResultsViewer';
import MedicationTracker from '../viewers/MedicationTracker';
import secureStorage from '../../utils/secureStorage';
import './ChatLayoutDark.css';

const ChatLayoutDark = () => {
  const [language, setLanguage] = useState(() => {
    return secureStorage.getItem('appLanguage') || 'he';
  });
  
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [activeContext, setActiveContext] = useState(null); // null means chat only
  const [contextData, setContextData] = useState(null);
  
  const isRTL = language === 'he';
  
  // Handle patient data from chat
  const handlePatientData = useCallback((patientData) => {
    process.env.NODE_ENV !== 'production' && console.log('👤 ChatLayoutDark - Received patient data:', patientData);
    process.env.NODE_ENV !== 'production' && console.log('👤 Patient _id:', patientData?._id);
    process.env.NODE_ENV !== 'production' && console.log('👤 Setting activeContext to: patient');
    if (patientData) {
      setSelectedPatient(patientData);
      setActiveContext('patient');
      setContextData(patientData);
      process.env.NODE_ENV !== 'production' && console.log('👤 State updated - should show split screen now');
    }
  }, []);
  
  // Handle document selection from chat
  const handleDocumentSelect = useCallback((documentId) => {
    process.env.NODE_ENV !== 'production' && console.log('📄 Document selected:', documentId);
    setSelectedDocument(documentId);
    setActiveContext('document');
  }, []);
  
  // Handle lab results view
  const handleLabResults = useCallback((patientData) => {
    if (patientData) {
      setSelectedPatient(patientData);
      setActiveContext('labs');
      setContextData(patientData);
    }
  }, []);
  
  // Handle medications view
  const handleMedications = useCallback((patientData) => {
    if (patientData) {
      setSelectedPatient(patientData);
      setActiveContext('medications');
      setContextData(patientData);
    }
  }, []);
  
  // Close context panel - return to chat only
  const handleClosePanel = useCallback(() => {
    setActiveContext(null);
    setContextData(null);
  }, []);
  
  // Expose handlers globally for ChatInterface
  useEffect(() => {
    window.handlePatientData = handlePatientData;
    window.handleDocumentSelect = handleDocumentSelect;
    window.handleLabResults = handleLabResults;
    window.handleMedications = handleMedications;
    
    return () => {
      delete window.handlePatientData;
      delete window.handleDocumentSelect;
      delete window.handleLabResults;
      delete window.handleMedications;
    };
  }, [handlePatientData, handleDocumentSelect, handleLabResults, handleMedications]);
  
  // Render appropriate viewer based on context
  const renderContextPanel = () => {
    if (!activeContext) return null;
    
    switch (activeContext) {
      case 'patient':
        return (
          <PatientCardDark 
            patient={selectedPatient} 
            language={language}
          />
        );
      
      case 'document':
        return (
          <DocumentViewerSimple
            patientId={selectedPatient?._id}
            documentId={selectedDocument}
            language={language}
          />
        );
      
      case 'labs':
        return (
          <LabResultsViewer
            patientId={selectedPatient?._id}
            language={language}
          />
        );
      
      case 'medications':
        return (
          <MedicationTracker
            patientId={selectedPatient?._id}
            language={language}
          />
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div className={`chat-layout-dark ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Context Panel - Clean, full-height panel */}
      {activeContext && (
        <div className="context-panel-dark">
          {/* Minimal close button */}
          <button
            className="close-panel-btn"
            onClick={handleClosePanel}
            aria-label="Close panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          
          {/* Content without tabs or clutter */}
          <div className="context-content-dark">
            {renderContextPanel()}
          </div>
        </div>
      )}
      
      {/* Chat Panel - Full width when no context */}
      <div className={`chat-panel-dark ${activeContext ? 'with-context' : 'full-width'}`}>
        <ChatInterfaceDark />
      </div>
    </div>
  );
};

export default ChatLayoutDark;