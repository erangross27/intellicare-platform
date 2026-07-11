import React, { useState, useEffect, useCallback } from 'react';
import SplitPane from 'split-pane-react';
import 'split-pane-react/esm/themes/default.css';
import ChatInterface from '../ChatInterface';
import ContextViewer from '../viewers/ContextViewer';
import { shouldSplitScreen, extractPatientFromMessage, detectUserIntent } from '../../utils/chatContextDetector';
import secureStorage from '../../utils/secureStorage';
import './ChatLayout.css';

const ChatLayout = () => {
  process.env.NODE_ENV !== 'production' && console.log('🎯 ChatLayout component is rendering!');
  process.env.NODE_ENV !== 'production' && console.log('🔍 SplitPane imported:', SplitPane);
  const [sizes, setSizes] = useState(() => {
    const saved = secureStorage.getItem('splitPaneSizes');
    return saved ? JSON.parse(saved) : ['60%', '40%'];
  });
  
  const [language, setLanguage] = useState(() => {
    return secureStorage.getItem('appLanguage') || 'he';
  });
  
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeContext, setActiveContext] = useState('patient'); // patient, labs, documents, history
  const [showContextPanel, setShowContextPanel] = useState(true); // ALWAYS show split screen
  
  const isRTL = language === 'he';
  
  // Save sizes to localStorage
  useEffect(() => {
    secureStorage.setItem('splitPaneSizes', JSON.stringify(sizes));
  }, [sizes]);
  
  // Handle patient selection from chat
  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setActiveContext('patient');
    setShowContextPanel(true); // Show panel when patient is selected
  };
  
  // Handle document view from chat
  const handleDocumentView = (document) => {
    setActiveContext('documents');
    setShowContextPanel(true); // Show panel when document is viewed
  };
  
  // Handle closing the context panel - DISABLED, always show
  const handleClosePanel = () => {
    // Don't actually close, maybe just clear content instead
    // setShowContextPanel(false);
    process.env.NODE_ENV !== 'production' && console.log('Panel close requested but keeping it open');
  };
  
  // Intelligent handler for chat messages (to be called from ChatInterface)
  const handleChatMessage = useCallback((message, functionCalls) => {
    process.env.NODE_ENV !== 'production' && console.log('🧠 Analyzing message for context triggers:', message);
    
    // ALWAYS show the panel - it's always split
    setShowContextPanel(true);
    
    // Check what context to show
    const decision = shouldSplitScreen(message, functionCalls, activeContext);
    
    process.env.NODE_ENV !== 'production' && console.log('📊 Screen decision:', decision);
    
    // Extract patient data if available
    const patientData = extractPatientFromMessage(message);
    if (patientData) {
      setSelectedPatient(patientData);
    }
    
    // Set the appropriate tab based on the function calls or content
    if (decision.tab) {
      setActiveContext(decision.tab);
    }
  }, [activeContext]);
  
  // Handler for direct patient data from agent
  const handlePatientData = useCallback((patientData) => {
    process.env.NODE_ENV !== 'production' && console.log('👤 Received patient data:', patientData);
    process.env.NODE_ENV !== 'production' && console.log('👤 Patient _id:', patientData?._id);
    process.env.NODE_ENV !== 'production' && console.log('👤 Patient full object:', JSON.stringify(patientData, null, 2));
    if (patientData) {
      setSelectedPatient(patientData);
      setActiveContext('patient');
      setShowContextPanel(true);
    }
  }, []);
  
  // Handler for documents data from agent
  const handleDocumentsData = useCallback((documentsData) => {
    process.env.NODE_ENV !== 'production' && console.log('📄 Received documents data:', documentsData);
    if (documentsData) {
      // Store documents in state or pass to context panel
      setActiveContext('documents');
      setShowContextPanel(true);
      // Pass documents to the ContextViewer through a ref or state
      // For now, we'll use window object (temporary solution)
      window.currentDocuments = documentsData;
    }
  }, []);
  
  // Expose handlers to ChatInterface via window (temporary solution)
  useEffect(() => {
    window.handleChatContextUpdate = handleChatMessage;
    window.handlePatientData = handlePatientData;
    window.handleDocumentsData = handleDocumentsData;
    return () => {
      delete window.handleChatContextUpdate;
      delete window.handlePatientData;
      delete window.handleDocumentsData;
    };
  }, [handleChatMessage, handlePatientData, handleDocumentsData]);
  
  process.env.NODE_ENV !== 'production' && console.log('🎨 About to render ChatLayout JSX, showContextPanel:', showContextPanel);
  
  // Dynamic layout like Claude Artifacts
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: isRTL ? 'row-reverse' : 'row',
      height: 'calc(100vh - 60px)', 
      width: '100%',
      transition: 'all 0.3s ease'
    }}>
      {/* Chat Panel - Left in LTR, Right in RTL */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease'
      }}>
        <ChatInterface />
      </div>
      
      {/* Context Panel - Right in LTR, Left in RTL */}
      {
        <div style={{ 
          width: '40%', 
          backgroundColor: '#f8f9fa',
          borderLeft: !isRTL ? '1px solid #e5e7eb' : 'none',
          borderRight: isRTL ? '1px solid #e5e7eb' : 'none',
          overflow: 'hidden',
          position: 'relative',
          animation: 'slideIn 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Close button */}
          <button
            onClick={handleClosePanel}
            style={{
              position: 'absolute',
              top: '10px',
              right: isRTL ? 'auto' : '10px',
              left: isRTL ? '10px' : 'auto',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: 'pointer',
              zIndex: 10,
              fontSize: '14px'
            }}
          >
            ✕
          </button>
          <ContextViewer
            patient={selectedPatient}
            activeTab={activeContext}
            onTabChange={setActiveContext}
            language={language}
          />
        </div>
      }
    </div>
  );
  
  try {
    // Original code (now unreachable)
    
    // Original SplitPane code (temporarily disabled for testing)
    return (
      <div className={`chat-layout-container ${isRTL ? 'rtl' : 'ltr'}`}>
        <SplitPane
        split='vertical'
        sizes={sizes}
        onChange={(newSizes) => setSizes(newSizes)}
        sashRender={() => (
          <div className="split-sash">
            <div className="sash-handle">⋮</div>
          </div>
        )}
        style={{ height: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}
      >
        {/* Chat Panel - Left in LTR, Right in RTL */}
        <div className="context-panel">
          <ContextViewer
            patient={selectedPatient}
            activeTab={activeContext}
            onTabChange={setActiveContext}
            language={language}
          />
        </div>
        
        {/* Chat Panel - Right in RTL, Left in LTR */}
        <div className="chat-panel">
          <ChatInterface />
        </div>
      </SplitPane>
    </div>
    );
  } catch (error) {
    process.env.NODE_ENV !== 'production' && console.error('❌ ChatLayout error:', error);
    // Fallback to just ChatInterface if SplitPane fails
    return <ChatInterface />;
  }
};

export default ChatLayout;