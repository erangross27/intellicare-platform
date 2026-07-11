import React, { useState, useEffect } from 'react';
import PatientCard from './PatientCard';
import LabResultsViewer from './LabResultsViewer';
import DocumentViewer from './DocumentViewer';
import MedicationTracker from './MedicationTracker';
import MedicalHistoryCard from './MedicalHistoryCard';
import PatientListCard from './PatientListCard';
import AgentResponseCard from './AgentResponseCard';
import './ContextViewer.css';

const ContextViewer = ({ patient, activeTab, onTabChange, language }) => {
  const isRTL = language === 'he';
  const [agentResponse, setAgentResponse] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState(null);
  const [patientList, setPatientList] = useState(null);
  
  // Listen for agent responses and medical history
  useEffect(() => {
    const handleAgentResponse = (responseData) => {
      // responseData can be a string or an object with response details
      if (typeof responseData === 'string') {
        setAgentResponse({ response: responseData });
      } else {
        setAgentResponse(responseData);
      }
      // Don't clear other displays - let them remain visible
      // The agent response will only show if no other context is available
    };
    
    const handleMedicalHistory = (history, patientData) => {
      setMedicalHistory(history);
      if (patientData) {
        // Update patient data if provided
        window.handlePatientData && window.handlePatientData(patientData);
      }
    };
    
    const handlePatientList = (patients, searchQuery) => {
      setPatientList({ patients, searchQuery });
      // Clear other displays
      setMedicalHistory(null);
      setAgentResponse(null);
    };
    
    window.handleAgentResponse = handleAgentResponse;
    window.handleMedicalHistory = handleMedicalHistory;
    window.handlePatientList = handlePatientList;
    
    return () => {
      delete window.handleAgentResponse;
      delete window.handleMedicalHistory;
      delete window.handlePatientList;
    };
  }, []);
  
  const renderContent = () => {
    // Priority 1: Show patient list if available
    if (patientList) {
      return <PatientListCard 
        patients={patientList.patients} 
        searchQuery={patientList.searchQuery}
        language={language}
        onPatientSelect={(patient) => {
          // Update selected patient when clicked
          window.handlePatientData && window.handlePatientData(patient);
        }}
      />;
    }
    
    // Priority 2: Show medical history if available
    if (medicalHistory && patient) {
      return <MedicalHistoryCard medicalHistory={medicalHistory} patient={patient} language={language} />;
    }
    
    // Priority 3: Show patient card if we have patient data
    if (patient) {
      return <PatientCard patient={patient} language={language} />;
    }
    
    // Priority 4: Only show agent response if no other context is available
    // This prevents duplicate information when patient data is already shown
    if (agentResponse && !patient && !medicalHistory && !patientList) {
      return (
        <AgentResponseCard 
          response={agentResponse.response || agentResponse}
          actionTaken={agentResponse.actionTaken}
          actionResult={agentResponse.actionResult}
          patient={null}
          language={language}
        />
      );
    }
    
    // Empty state
    return (
      <div className="no-patient-selected">
        <div className="empty-state">
          <span className="empty-icon">🤖</span>
          <p>{isRTL ? 'מחכה לתגובת הסוכן' : 'Waiting for agent response'}</p>
        </div>
      </div>
    );
    
    process.env.NODE_ENV !== 'production' && console.log('[ContextViewer] Patient object:', patient);
    process.env.NODE_ENV !== 'production' && console.log('[ContextViewer] Patient._id:', patient._id);
    process.env.NODE_ENV !== 'production' && console.log('[ContextViewer] Active tab:', activeTab);
    
    switch (activeTab) {
      case 'patient':
        return <PatientCard patient={patient} language={language} />;
      case 'labs':
        return <LabResultsViewer patientId={patient._id} language={language} />;
      case 'documents':
        process.env.NODE_ENV !== 'production' && console.log('[ContextViewer] Rendering DocumentViewer with patientId:', patient._id);
        // Check if we have documents data from the agent
        if (window.currentDocuments) {
          process.env.NODE_ENV !== 'production' && console.log('[ContextViewer] Using documents from agent:', window.currentDocuments);
          // Use DocumentListViewer to show the documents
          const DocumentListViewer = require('./documents/DocumentListViewer').default;
          return <DocumentListViewer documents={window.currentDocuments} patientName={`${patient.firstName} ${patient.lastName}`} language={language} />;
        }
        return <DocumentViewer patientId={patient._id} language={language} />;
      case 'medications':
        return <MedicationTracker patientId={patient._id} language={language} />;
      case 'history':
        return (
          <div className="medical-history">
            <h3>{isRTL ? 'היסטוריה רפואית' : 'Medical History'}</h3>
            {/* Medical history timeline will go here */}
          </div>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className={`context-viewer ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* No tabs - just content area */}
      <div className="context-content full-height">
        {renderContent()}
      </div>
    </div>
  );
};

export default ContextViewer;