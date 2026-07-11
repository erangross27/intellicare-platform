import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../config/languagesStatic';
import { useAuth } from '../context/AuthContext';
import platformFunctionHelpServiceV2 from '../services/platformFunctionHelpServiceV2';
import learningWebSocketClient from '../services/learningWebSocketClient';
import secureStorage from '../utils/secureStorage';
import secureApi from '../services/secureApiClient';
import './DynamicFunctionTooltip.css';

/**
 * Dynamic Function Tooltip
 * Monitors actual function execution and shows contextual help in real-time
 * Minimal, non-intrusive design that appears in top-right of chat
 */
const DynamicFunctionTooltip = ({ chatMessages, currentFunction, executionLog, sessionId }) => {
  const { currentLanguage, isRTL, t } = useLanguage();
  const { user } = useAuth();
  
  // DEBUG: Log props to see what we're getting
  console.log('🔧 DynamicFunctionTooltip props:', { 
    chatMessagesLength: chatMessages?.length, 
    currentFunction, 
    chatMessages: chatMessages?.slice(-2) // Last 2 messages for debug
  });
  
  const [activeFunction, setActiveFunction] = useState(null);
  const [functionHelp, setFunctionHelp] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [fadeTimer, setFadeTimer] = useState(null);
  const [dynamicSuggestions, setDynamicSuggestions] = useState([]);
  const [learningInsights, setLearningInsights] = useState({
    predictions: [],
    efficiency: null,
    patterns: []
  });
  const [isLearningConnected, setIsLearningConnected] = useState(false);
  const [workflowContext, setWorkflowContext] = useState({
    previousAction: null,
    currentAction: null,
    nextAction: null,
    userIntent: null,
    functionSequence: []
  });

  // Update suggestions from context
  const updateSuggestionsFromContext = (suggestedActions) => {
    if (suggestedActions && suggestedActions.length > 0) {
      setDynamicSuggestions(suggestedActions);
      console.log('📋 Updated dynamic suggestions:', suggestedActions);
    }
  };

  // Define showFunctionHelp before using it
  const showFunctionHelp = (functionKey) => {
    console.log('🎯 Showing help for:', functionKey);
    
    // Clear existing timer
    if (fadeTimer) {
      clearTimeout(fadeTimer);
    }

    // ALWAYS clear previous tooltip content first (this fixes the persistence issue)
    setActiveFunction(null);
    setFunctionHelp(null);
    setIsVisible(false);

    // Detect user intent from chat messages
    const lastUserMessage = chatMessages?.filter(m => m.role === 'user').pop()?.content || '';
    const userIntent = lastUserMessage.toLowerCase().includes('add') || lastUserMessage.toLowerCase().includes('new') 
      ? 'add' 
      : lastUserMessage.toLowerCase().includes('update') || lastUserMessage.toLowerCase().includes('change')
      ? 'update'
      : 'search';

    // Update workflow context
    const newWorkflowContext = {
      ...workflowContext,
      previousAction: workflowContext.currentAction,
      currentAction: functionKey,
      userIntent: userIntent,
      functionSequence: [...workflowContext.functionSequence, functionKey].slice(-5)
    };
    setWorkflowContext(newWorkflowContext);

    // Predict next action
    let nextAction = null;
    if (functionKey === 'searchPatients' && userIntent === 'add') {
      nextAction = 'addPatient';
    } else if (functionKey === 'searchPatients' && userIntent === 'update') {
      nextAction = 'updatePatient';
    }

    // Get comprehensive context for the help service
    const context = {
      language: currentLanguage,
      userRole: user?.roles?.[0] || 'doctor',
      patientCount: 0, // TODO: Get from actual chat state
      userCount: 0, // TODO: Get from actual chat state
      currentPatient: null, // TODO: Get from actual chat state
      isFirstPatient: false, // TODO: Get from actual chat state
      isFirstUser: false, // TODO: Get from actual chat state
      previousAction: newWorkflowContext.previousAction,
      nextAction: nextAction,
      userIntent: userIntent,
      afterSearch: newWorkflowContext.previousAction === 'searchPatients'
    };

    const helpData = platformFunctionHelpServiceV2.generateContextualTooltip(functionKey, context);
    
    if (helpData) {
      // Use a small delay to ensure the clearing takes effect before showing new content
      setTimeout(() => {
        setActiveFunction(functionKey);
        setFunctionHelp(helpData);
        setIsVisible(true);
        console.log('✅ Tooltip is now visible!', helpData);
      }, 50); // 50ms delay ensures React state updates are processed

      // No auto-hide - let users read at their own pace
      // Users can close manually or it stays open
    } else {
      console.log('❌ No help data found for:', functionKey);
    }
  };
  
  // Show function help with AI explanation
  const showFunctionHelpWithExplanation = (functionKey, aiExplanation) => {
    console.log('🎯 Showing help for:', functionKey, 'with explanation:', aiExplanation);
    
    // Clear existing timer
    if (fadeTimer) {
      clearTimeout(fadeTimer);
    }

    // ALWAYS clear previous tooltip content first (this fixes the persistence issue)
    setActiveFunction(null);
    setFunctionHelp(null);
    setIsVisible(false);

    // Detect user intent from chat messages
    const lastUserMessage = chatMessages?.filter(m => m.role === 'user').pop()?.content || '';
    const userIntent = lastUserMessage.toLowerCase().includes('add') || lastUserMessage.toLowerCase().includes('new') 
      ? 'add' 
      : lastUserMessage.toLowerCase().includes('update') || lastUserMessage.toLowerCase().includes('change')
      ? 'update'
      : 'search';

    // Update workflow context
    const newWorkflowContext = {
      ...workflowContext,
      previousAction: workflowContext.currentAction,
      currentAction: functionKey,
      userIntent: userIntent,
      functionSequence: [...workflowContext.functionSequence, functionKey].slice(-5) // Keep last 5
    };
    setWorkflowContext(newWorkflowContext);

    // Predict next action based on current workflow
    let nextAction = null;
    if (functionKey === 'searchPatients' && userIntent === 'add') {
      nextAction = 'addPatient'; // After search, we'll add if not found
    } else if (functionKey === 'searchPatients' && userIntent === 'update') {
      nextAction = 'updatePatient'; // After search, we'll update if found
    }

    // Get comprehensive context for the help service
    const context = {
      language: currentLanguage,
      userRole: user?.roles?.[0] || 'doctor',
      patientCount: 0,
      userCount: 0,
      currentPatient: null,
      isFirstPatient: false,
      isFirstUser: false,
      previousAction: newWorkflowContext.previousAction,
      nextAction: nextAction,
      userIntent: userIntent,
      afterSearch: newWorkflowContext.previousAction === 'searchPatients'
    };

    const helpData = platformFunctionHelpServiceV2.generateContextualTooltip(functionKey, context);
    
    if (helpData) {
      // If we have an AI explanation, use it as the description
      if (aiExplanation) {
        helpData.description = aiExplanation;
      }
      
      // Use a small delay to ensure the clearing takes effect before showing new content
      setTimeout(() => {
        setActiveFunction(functionKey);
        setFunctionHelp(helpData);
        setIsVisible(true);
        console.log('✅ Tooltip is now visible with AI explanation!', helpData);
      }, 50); // 50ms delay ensures React state updates are processed
    } else {
      console.log('❌ No help data found for:', functionKey);
    }
  };

  // Initialize learning integration
  useEffect(() => {
    console.log('🚀 DynamicFunctionTooltip: Component mounted and ready');
    
    
    const initializeLearning = async () => {
      try {
        // DISABLED: Learning WebSocket connection (causing auth token errors)
        // Only try to connect if auth token is available
        const hasAuthToken = secureStorage.getItem('authToken') || 
                            document.cookie.includes('sessionToken');
        
        if (!hasAuthToken) {
          console.log('⚠️ No auth token - skipping learning WebSocket connection');
          setIsLearningConnected(false);
          return;
        }
        
        // Connect to learning WebSocket if not already connected
        if (!learningWebSocketClient.isConnected) {
          await learningWebSocketClient.connect();
        }
        setIsLearningConnected(true);
        
        // Subscribe to relevant learning events
        learningWebSocketClient.subscribe([
          'workflow_prediction',
          'efficiency_alert', 
          'pattern_detected'
        ]);
        
        // Handle learning events
        learningWebSocketClient.on('workflow_prediction', (predictions) => {
          setLearningInsights(prev => ({ ...prev, predictions }));
          
          // Update dynamic suggestions based on predictions
          const predictionSuggestions = predictions.slice(0, 2).map((pred, idx) => ({
            icon: idx === 0 ? '🔮' : '⭐',
            title: `Next: ${pred.name}`,
            label: `${(pred.confidence * 100).toFixed(0)}% confidence`,
            action: pred.name,
            priority: pred.confidence > 0.8 ? 'high' : 'medium'
          }));
          
          if (predictionSuggestions.length > 0) {
            setDynamicSuggestions(prev => [
              ...predictionSuggestions,
              ...prev.filter(s => !s.title.startsWith('Next:'))
            ].slice(0, 4));
          }
        });
        
        learningWebSocketClient.on('efficiency_alert', (alert) => {
          setLearningInsights(prev => ({ ...prev, efficiency: alert.data }));
          
          // Add efficiency improvement suggestion
          if (alert.data.suggestions?.length > 0) {
            const efficiencySuggestion = {
              icon: '⚡',
              title: 'Improve Efficiency',
              label: alert.data.suggestions[0],
              priority: alert.data.severity === 'high' ? 'high' : 'medium'
            };
            
            setDynamicSuggestions(prev => [
              efficiencySuggestion,
              ...prev.filter(s => s.title !== 'Improve Efficiency')
            ].slice(0, 4));
          }
        });
        
        learningWebSocketClient.on('pattern_detected', (pattern) => {
          setLearningInsights(prev => ({
            ...prev,
            patterns: [pattern.data, ...prev.patterns].slice(0, 3)
          }));
        });
        
        // Request initial insights
        try {
          const predictions = await learningWebSocketClient.requestWorkflowPrediction([]);
          if (predictions?.predictions?.length > 0) {
            setLearningInsights(prev => ({ ...prev, predictions: predictions.predictions }));
          }
        } catch (error) {
          console.log('No initial predictions available');
        }
        
      } catch (error) {
        console.error('Learning integration failed:', error);
        setIsLearningConnected(false);
      }
    };
    
    initializeLearning();
    
    return () => {
      // Clean up listeners but don't disconnect (other components may use it)
      learningWebSocketClient.removeAllListeners(['workflow_prediction', 'efficiency_alert', 'pattern_detected']);
    };
  }, []);

  // Monitor XMLHttpRequest for API calls - SECURE FUNCTION EXECUTION DETECTION
  useEffect(() => {
    console.log('🚀 DynamicFunctionTooltip: Component loaded and monitoring started');
    console.log('🔍 DynamicFunctionTooltip: Monitoring function execution via API responses...');
    
    // Whitelist of valid function names for security - ACTUAL PLATFORM FUNCTIONS
    const validFunctions = [
      // Document Functions
      'listDocuments', 'uploadDocument', 'getDocuments', 'analyzeDocument', 'deleteDocument', 'searchDocuments',
      
      // Patient Management Functions  
      'addPatient', 'updatePatient', 'searchPatients', 'getPatientDetails', 'deletePatientBySearch', 'countPatients',
      
      // Medical History Functions
      'addMedicalHistory', 'getMedicalHistory', 'updateMedicalHistory', 'deleteMedicalHistory',
      
      // Medical Analysis Functions
      'analyzeSymptoms', 'generateDiagnosis', 'recommendTreatment', 'checkDrugInteractions', 
      'checkDrugAllergy', 'analyzeVitalSigns', 'interpretLabResults', 'getDifferentialDiagnosis',
      'generateSOAPNote', 'calculateMedicationDosing', 'lookupClinicalGuidelines', 
      'generateVaccinationSchedule', 'recommendTests',
      
      // Appointment Functions
      'scheduleAppointment', 'findAvailableSlots', 'updateAppointment', 'rescheduleAppointment',
      
      // User Management Functions
      'createUser', 'resendEmailVerification', 'updateUserRole',
      
      // Chat Functions
      'createChatSession', 'searchChatHistory',
      
      // Lab & Medication Functions
      'addLabResult', 'getLabResults', 'addMedication', 'getMedications', 
      'addVitalSigns', 'getVitalSigns', 'addAllergy',
      
      // Reporting & System Functions
      'generatePatientReport', 'generatePracticeReport', 'runBackup', 'getSystemHealth', 'exportAuditLogs'
    ];
    
    // Secure function name validation (case-insensitive matching)
    const validateFunctionName = (functionName) => {
      if (!functionName || typeof functionName !== 'string') {
        return null;
      }
      const sanitized = functionName.trim();
      
      // Find exact match (preserving original case for help lookup)
      const exactMatch = validFunctions.find(func => 
        func.toLowerCase() === sanitized.toLowerCase()
      );
      
      return exactMatch || null;
    };
    
    // ALSO intercept secureApiClient requests (it uses stored original fetch)
    // We need to patch secureApiClient's request method
    const patchSecureApiClient = () => {
      // Use the imported secureApi instance
      if (secureApi && secureApi.request && !secureApi._tooltipPatched) {
        const originalRequest = secureApi.request.bind(secureApi);
        secureApi.request = async function(...args) {
          try {
            // Pass through ALL arguments correctly
            const response = await originalRequest(...args);
            // Fix: method is first arg, path is second arg
            const [method, path] = args;
            
            // Log the API call with method
            console.log(`🌐 SecureAPI Call: ${method} ${path}`, 'Response:', response);
            
            // More specific logging for debugging
            console.log('📍 Path value:', path, 'Type:', typeof path);
            if (path === '/api/agent/chat') {
              console.log('🎯🎯🎯 EXACT MATCH: /api/agent/chat endpoint hit!');
              console.log('📊 Full response:', response);
              console.log('📊 Response data:', response?.data);
              console.log('📊 Selected functions:', response?.data?.selectedFunctions);
            }
            
            // Check if this is a chat request
            if (path && (path.includes('/api/chat') || path.includes('/api/agent') || 
                path.includes('/agent/chat') || path.includes('/sessions'))) {
              console.log('🎯 Chat API detected via secureApiClient:', path);
              console.log('📊 Response structure:', Object.keys(response || {}));
              
              if (response) {
                // Check for selectedFunctions
                if (response.success && response.data && response.data.selectedFunctions) {
                  console.log('📌 Found selectedFunctions:', response.data.selectedFunctions);
                  const selectedFuncs = Array.isArray(response.data.selectedFunctions) 
                    ? response.data.selectedFunctions 
                    : [response.data.selectedFunctions];
                  
                  // Collect all valid functions
                  const validFunctions = selectedFuncs
                    .map(funcName => validateFunctionName(funcName))
                    .filter(func => func !== null);
                  
                  // Get the AI's explanation if provided
                  const aiExplanation = response.data.functionSelectionExplanation || '';
                  console.log('💡 AI Explanation:', aiExplanation);
                  
                  if (validFunctions.length > 0) {
                    console.log('🎯 Showing tooltip for functions:', validFunctions);
                    // Show first function with AI explanation
                    showFunctionHelpWithExplanation(validFunctions[0], aiExplanation);
                  }
                }
                
                // Check for actionTaken
                if (response.success && response.data && response.data.actionTaken) {
                  const validFunc = validateFunctionName(response.data.actionTaken);
                  if (validFunc) {
                    console.log('🎯 Showing tooltip for actionTaken:', validFunc);
                    showFunctionHelp(validFunc);
                  }
                }
              }
            }
            
            return response;
          } catch (error) {
            // Ignore expected 404 errors for messages endpoint (session not created yet)
            const is404MessagesError = error.status === 404 && 
                                       args[0] && 
                                       typeof args[0] === 'string' && 
                                       args[0].includes('/messages');
            
            if (!is404MessagesError) {
              // Only log unexpected errors
              console.error('Tooltip monitoring error:', error);
            }
            throw error;
          }
        };
        secureApi._tooltipPatched = true;
        console.log('✅ Patched secureApiClient for tooltip monitoring');
      }
    };
    
    // Try to patch immediately
    patchSecureApiClient();
    
    // Also try after a delay (in case secureApiClient loads later)
    setTimeout(patchSecureApiClient, 100);
    
    // ALSO intercept regular fetch for other uses
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const [url, options] = args;
      
      // Call original fetch
      return originalFetch.apply(this, args).then(response => {
        // DEBUG: Log ALL API calls to find the right pattern
        console.log('🌐 Direct Fetch Call:', response.url);
        
        // Monitor API responses from chat/agent endpoints - EXPANDED PATTERNS
        const isChatRequest = response.url && (
          response.url.includes('/api/chat') || 
          response.url.includes('/api/agent') ||
          response.url.includes('/chat') ||
          response.url.includes('/sessions') ||
          response.url.includes('/messages') ||
          response.url.includes('/agent/chat') // Added specific endpoint
        );
        
        if (isChatRequest) {
          console.log('🎯 Chat API request detected:', response.url);
          
          response.clone().json().then(data => {
            console.log('🔍 Monitoring API response for function execution:', response.url);
            console.log('📊 Response data structure:', Object.keys(data));
            console.log('📊 Full response data:', JSON.stringify(data, null, 2).substring(0, 500));
            
            // Log selected functions if present
            if (data.success && data.data && data.data.selectedFunctions) {
              console.log('🎯 Selected functions from agent:', data.data.selectedFunctions);
            }
            
            // SECURE: Extract function execution from response
            let executedFunction = null;
            
            // PRIORITY 1: IntelliCare Agent API response format (data.actionTaken)
            if (data.success && data.data && data.data.actionTaken) {
              executedFunction = validateFunctionName(data.data.actionTaken);
              console.log('🎯 Function detected from data.data.actionTaken:', data.data.actionTaken);
            }
            // PRIORITY 2: Direct actionTaken field
            else if (data.actionTaken) {
              executedFunction = validateFunctionName(data.actionTaken);
              console.log('🎯 Function detected from actionTaken:', data.actionTaken);
            }
            // PRIORITY 3: Selected functions from agent (if returned in response)
            else if (data.success && data.data && data.data.selectedFunctions) {
              console.log('📌 Found selectedFunctions in response:', data.data.selectedFunctions);
              // Agent may return which functions it selected for execution
              const selectedFuncs = Array.isArray(data.data.selectedFunctions) 
                ? data.data.selectedFunctions 
                : [data.data.selectedFunctions];
              
              console.log('📌 Processing selectedFunctions array:', selectedFuncs);
              
              for (const funcName of selectedFuncs) {
                console.log('📌 Validating function:', funcName);
                executedFunction = validateFunctionName(funcName);
                if (executedFunction) {
                  console.log('🎯 Function detected from selectedFunctions:', funcName);
                  showFunctionHelp(executedFunction); // Show help for each function
                  // Don't break - process all functions
                } else {
                  console.log('❌ Function not in whitelist:', funcName);
                }
              }
            }
            // PRIORITY 4: Claude API content with tool_use blocks
            else if (data.content && Array.isArray(data.content)) {
              for (const block of data.content) {
                if (block.type === 'tool_use' && block.name) {
                  executedFunction = validateFunctionName(block.name);
                  console.log('🎯 Function detected from content[].tool_use.name:', block.name);
                  break;
                }
              }
            }
            // PRIORITY 5: Other formats for compatibility
            else if (data.functionCall && data.functionCall.name) {
              executedFunction = validateFunctionName(data.functionCall.name);
              console.log('🎯 Function detected from functionCall.name:', data.functionCall.name);
            } else if (data.tool_calls && Array.isArray(data.tool_calls)) {
              for (const toolCall of data.tool_calls) {
                if (toolCall.function && toolCall.function.name) {
                  executedFunction = validateFunctionName(toolCall.function.name);
                  console.log('🎯 Function detected from tool_calls[].function.name:', toolCall.function.name);
                  break;
                }
              }
            }
            
            // Also check the response text for function execution mentions
            if (!executedFunction && data.response) {
              const responseText = data.response.toLowerCase();
              for (const funcName of validFunctions) {
                if (responseText.includes(funcName.toLowerCase()) && 
                    (responseText.includes('executed') || responseText.includes('calling') || 
                     responseText.includes('running') || responseText.includes('created'))) {
                  executedFunction = funcName;
                  console.log('🎯 Function detected from response text analysis:', funcName);
                  break;
                }
              }
            }
            
            // Show tooltip if valid function detected (but may have been shown already in selectedFunctions loop)
            if (executedFunction) {
              console.log('✅ Valid function execution detected:', executedFunction);
              showFunctionHelp(executedFunction);
              
              // Also update suggestions based on executed function context
              const userContext = {
                language: currentLanguage,
                role: user?.roles?.[0] || 'doctor'
              };
              const contextualHelp = platformFunctionHelpServiceV2.getContextualHelp(
                '', // No message needed for function-based detection
                {}, // Empty chat state
                userContext
              );
              updateSuggestionsFromContext(contextualHelp.suggestedActions);
            } else {
              console.log('❌ No valid function execution detected in response');
              console.log('🔍 Available data keys:', Object.keys(data));
              
              // FALLBACK: Try to detect from response text patterns
              const responseText = (data.response || data.message || JSON.stringify(data)).toLowerCase();
              console.log('📝 Response text preview:', responseText.substring(0, 200));
              
              // Look for function execution indicators in text
              for (const funcName of validFunctions) {
                if (responseText.includes(funcName.toLowerCase())) {
                  console.log('🎯 FALLBACK: Function detected in text:', funcName);
                  showFunctionHelp(funcName);
                  break;
                }
              }
            }
            
          }).catch(error => {
            console.log('Could not parse API response JSON:', error.message);
          });
        }
        
        return response;
      }).catch(error => {
        console.error('API call failed:', error);
        return Promise.reject(error);
      });
    };

    // Cleanup function to restore original fetch
    return () => {
      window.fetch = originalFetch;
      console.log('🧹 DynamicFunctionTooltip: Restored original fetch on cleanup');
    };
  }, []);

  // Watch for function execution from props
  useEffect(() => {
    if (currentFunction) {
      console.log('📌 Function prop received:', currentFunction);
      showFunctionHelp(currentFunction);
    }
  }, [currentFunction]);

  // Track previous sessionId to detect new chat creation
  const prevSessionId = useRef(sessionId);
  
  // Clear tooltip when sessionId changes (new chat created)
  useEffect(() => {
    // Skip initial mount
    if (prevSessionId.current && sessionId && prevSessionId.current !== sessionId) {
      console.log('🧹 New chat session detected (sessionId changed) - clearing tooltip');
      setIsVisible(false);
      setActiveFunction(null);
      setFunctionHelp(null);
      setDynamicSuggestions([]);
      if (fadeTimer) {
        clearTimeout(fadeTimer);
        setFadeTimer(null);
      }
    }
    
    // Update ref for next comparison
    prevSessionId.current = sessionId;
  }, [sessionId, fadeTimer]);
  
  // Monitor chat messages for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Chat messages updated, count:', chatMessages?.length);
      if (chatMessages?.length > 0) {
        const lastMessage = chatMessages[chatMessages.length - 1];
        console.log('💬 Last message role:', lastMessage?.role, 'content preview:', lastMessage?.content?.substring(0, 50));
      }
    }
  }, [chatMessages]);

  // NOTE: Removed message-based detection - now using function execution detection from API responses

  // ONLY show tooltip when a function is actually detected and executed
  // NO FALLBACKS, NO STATIC SUGGESTIONS
  if (!isVisible || !functionHelp) {
    // Reduced logging to avoid spam
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ No function detected - hiding tooltip', {
        isVisible,
        hasFunctionHelp: !!functionHelp,
        activeFunction
      });
    }
    
    
    return null; // Don't show anything if no function is detected
  }
  
  console.log('✅ RENDERING TOOLTIP NOW!', {
    isVisible,
    functionHelp,
    activeFunction
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1, y: 0, scale: 1 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
        className={`dynamic-function-tooltip ${isRTL ? 'rtl' : 'ltr'}`}
        style={{
          position: 'fixed',
          top: '20px',
          [isRTL ? 'left' : 'right']: '20px',
          zIndex: 999999,
          display: 'block',
          visibility: 'visible',
          opacity: 1
        }}
      >
        {/* Function Icon and Title */}
        <div className="tooltip-header">
          <span className="function-icon">{functionHelp.isWorkflow ? '🔄' : functionHelp.categoryIcon}</span>
          <div className="function-details">
            <h4 className="function-name">{functionHelp.title}</h4>
            <span className="function-category">{functionHelp.category || (functionHelp.isWorkflow ? (currentLanguage === 'he' ? 'תהליך אוטומטי' : 'Automated Workflow') : '')}</span>
          </div>
          {functionHelp.urgency === 'high' && (
            <span className="urgency-indicator">🔥</span>
          )}
        </div>

        {/* Why This Function */}
        <div className="tooltip-content">
          <p className="why-needed">{functionHelp.whyNeeded}</p>
          
          {/* Dynamic Description */}
          {functionHelp.description && (
            <p className="dynamic-info">{functionHelp.description}</p>
          )}

          {/* Time Estimate */}
          {functionHelp.timeEstimate && (
            <div className="time-estimate">
              <span className="time-icon">⏱️</span>
              <span className="time-text">{functionHelp.timeEstimate}</span>
            </div>
          )}

          {/* Steps if available */}
          {functionHelp.steps && functionHelp.steps.length > 0 && (
            <div className="steps-section">
              <h5 className="steps-title">{t('functionTooltip.steps') || 'Steps:'}</h5>
              <ol className="steps-list">
                {functionHelp.steps.map((step, idx) => (
                  <li key={idx} className="step-item">{step}</li>
                ))}
              </ol>
            </div>
          )}
          
          {/* Detailed workflow steps if available */}
          {functionHelp.workflowSteps && functionHelp.workflowSteps.length > 0 && (
            <div className="workflow-details">
              {functionHelp.workflowSteps.map((step, idx) => (
                <div key={idx} className="workflow-step" style={{ marginBottom: '10px', padding: '8px', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '8px' }}>
                  <strong>Step {step.step}: {step.title}</strong>
                  <p style={{ margin: '4px 0', fontSize: '0.9em', opacity: 0.8 }}>{step.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Contextual Tips */}
          {functionHelp.contextualTips && functionHelp.contextualTips.length > 0 && (
            <div className="contextual-tips">
              {functionHelp.contextualTips.map((tip, idx) => (
                <div key={idx} className="tip">{tip}</div>
              ))}
            </div>
          )}
        </div>

        {/* Small close button */}
        <div 
          onClick={() => setIsVisible(false)}
          style={{
            position: 'absolute',
            top: '8px',
            [isRTL ? 'left' : 'right']: '8px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#64748b',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
            e.currentTarget.style.color = '#7c3aed';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          ✕
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DynamicFunctionTooltip;