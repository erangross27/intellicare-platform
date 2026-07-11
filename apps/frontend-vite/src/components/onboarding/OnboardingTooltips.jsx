import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useWorkflowStore from '../../stores/workflowStore';
import { useLanguage } from '../../config/languagesStatic';
import workflowTrackerService from '../../services/workflowTrackerService';
import chatAnalysisService from '../../services/chatAnalysisService';

const OnboardingTooltips = ({ onSendMessage }) => {
  const { currentLanguage, isRTL, t } = useLanguage();
  const { 
    activeWorkflow, 
    currentStep, 
    getCurrentStepData,
    advanceStep,
    cancelWorkflow 
  } = useWorkflowStore();
  
  const [isMinimized, setIsMinimized] = useState(true); // Start closed by default
  const [showPulse, setShowPulse] = useState(true);
  const [trackerState, setTrackerState] = useState(workflowTrackerService.getState());
  const [contextualHelp, setContextualHelp] = useState('');
  const [dynamicSuggestions, setDynamicSuggestions] = useState([]);
  
  // Stop pulsing after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 5000);
    return () => clearTimeout(timer);
  }, [currentStep]);
  
  // Listen for workflow updates from the tracker
  useEffect(() => {
    const handleWorkflowUpdate = (event) => {
      const { step, data } = event.detail;
      console.log('📊 Workflow update received:', step, data);
      
      // Update tracker state
      const newState = workflowTrackerService.getState();
      setTrackerState(newState);
      
      // Update contextual help
      const help = workflowTrackerService.getContextualHelp(currentLanguage);
      setContextualHelp(help);
      
      // Update suggestions
      const suggestions = chatAnalysisService.getSuggestedActions();
      setDynamicSuggestions(suggestions[currentLanguage] || []);
      
      // Show pulse on step change
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 5000);
    };
    
    window.addEventListener('workflowUpdate', handleWorkflowUpdate);
    
    // Get initial state
    const initialState = workflowTrackerService.getState();
    setTrackerState(initialState);
    const help = workflowTrackerService.getContextualHelp(currentLanguage);
    setContextualHelp(help);
    const suggestions = chatAnalysisService.getSuggestedActions();
    setDynamicSuggestions(suggestions[currentLanguage] || []);
    
    return () => {
      window.removeEventListener('workflowUpdate', handleWorkflowUpdate);
    };
  }, [currentLanguage]);
  
  if (!activeWorkflow || activeWorkflow.id !== 'practice-onboarding') {
    return null;
  }
  
  const currentStepData = getCurrentStepData();
  if (!currentStepData) return null;
  
  // Get localized text
  const getText = (obj) => {
    if (typeof obj === 'string') return obj;
    return obj?.[currentLanguage] || obj?.en || '';
  };
  
  // Position tooltips in bottom corner based on language
  const getTooltipPosition = () => {
    // Hebrew (RTL) - bottom right, English (LTR) - bottom left
    return { 
      bottom: '30px', 
      [isRTL ? 'right' : 'left']: '30px',
      maxWidth: '380px'
    };
  };
  
  return (
    <>
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            key="tooltip"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            y: 0,
            transition: {
              type: "spring",
              stiffness: 260,
              damping: 20
            }
          }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          style={{
            position: 'fixed',
            ...getTooltipPosition(),
            zIndex: 1000,
            maxWidth: '280px',
            direction: isRTL ? 'rtl' : 'ltr'
          }}
        >
          {/* Clean dark card */}
          <div style={{
            background: '#202123',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '14px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            overflow: 'visible'
          }}>
            
            {/* Minimize button */}
            <button
              onClick={() => setIsMinimized(true)}
              style={{
                position: 'absolute',
                top: '10px',
                [isRTL ? 'left' : 'right']: '10px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '20px',
                cursor: 'pointer',
                transition: 'color 0.2s',
                padding: '5px'
              }}
              onMouseEnter={(e) => e.target.style.color = '#ffffff'}
              onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.5)'}
              title={t('minimize')}
            >
              −
            </button>
            
            {/* Step indicator - only show for non-welcome steps */}
            {contextualHelp !== 'welcomeHelp' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '15px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
                }}>
                  {currentStep + 1}
                </div>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#ececf1'
                  }}>
                    {getText(currentStepData.name)}
                  </h3>
                  <p style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'rgba(236, 236, 241, 0.6)'
                  }}>
                    {t('step')} {currentStep + 1} {t('of')} {activeWorkflow.steps.length}
                  </p>
                </div>
              </div>
            )}
            
            {/* Description - Now dynamic based on conversation */}
            {contextualHelp !== 'welcomeHelp' && (
              <div style={{
                fontSize: '14px',
                color: 'rgba(236, 236, 241, 0.8)',
                lineHeight: '1.5',
                marginBottom: '15px'
              }}>
                {contextualHelp || getText(currentStepData.help || currentStepData.description)}
              </div>
            )}
            
            {/* Progress indicator if tracking */}
            {trackerState.progress > 0 && (
              <div style={{
                marginBottom: '15px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '5px',
                  fontSize: '12px',
                  color: 'rgba(236, 236, 241, 0.6)'
                }}>
                  <span>{t('progress')}</span>
                  <span>{trackerState.progress}%</span>
                </div>
                <div style={{
                  height: '4px',
                  background: 'rgba(139, 92, 246, 0.2)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${trackerState.progress}%` }}
                    transition={{ duration: 0.5 }}
                    style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
                      borderRadius: '2px'
                    }}
                  />
                </div>
              </div>
            )}
            
            {/* Beautiful helpful tips section for welcome screen */}
            {contextualHelp === 'welcomeHelp' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ marginBottom: '15px' }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '15px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                    </svg>
                  </div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#ececf1',
                    letterSpacing: '0.3px'
                  }}>
                    {t('helpfulTips')}
                  </h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* New Practice Tip Card */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        flexShrink: 0
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
                          <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2" />
                          <rect x="8" y="2" width="8" height="3" rx="1" />
                          <line x1="12" y1="11" x2="12" y2="17" />
                          <line x1="9" y1="14" x2="15" y2="14" />
                        </svg>
                      </div>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#ffffff',
                          marginBottom: '2px'
                        }}>
                          {t('newPractice')}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'rgba(255, 255, 255, 0.6)',
                          lineHeight: '1.4'
                        }}>
                          {t('newPracticeTip')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Join Tip Card */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        flexShrink: 0
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <line x1="20" y1="8" x2="20" y2="14" />
                          <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                      </div>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#ffffff',
                          marginBottom: '2px'
                        }}>
                          {t('signup')}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'rgba(255, 255, 255, 0.6)',
                          lineHeight: '1.4'
                        }}>
                          {t('signupTip')}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Login Tip Card */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        flexShrink: 0
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                          <polyline points="10 17 15 12 10 7" />
                          <line x1="15" y1="12" x2="3" y2="12" />
                        </svg>
                      </div>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#ffffff',
                          marginBottom: '2px'
                        }}>
                          {t('login')}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'rgba(255, 255, 255, 0.6)',
                          lineHeight: '1.4'
                        }}>
                          {t('loginTip')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Dynamic helpful tips for other steps */}
            {contextualHelp !== 'welcomeHelp' && dynamicSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '15px'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                  </svg>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#8b5cf6',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {t('helpfulTips')}
                  </span>
                </div>
                {dynamicSuggestions[currentLanguage]?.map((suggestion, index) => (
                  <p key={index} style={{
                    margin: index > 0 ? '8px 0 0' : 0,
                    fontSize: '13px',
                    color: 'rgba(236, 236, 241, 0.8)',
                    fontWeight: '400',
                    lineHeight: '1.4',
                    cursor: 'default'
                  }}>
                    • {suggestion}
                  </p>
                )) || []}
              </motion.div>
            )}
            
            {/* Fallback to original action hint if no dynamic suggestions */}
            {dynamicSuggestions.length === 0 && currentStepData.commands?.[0] && (
              <motion.div
                initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '15px'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                  </svg>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#8b5cf6',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {t('actionRequired')}
                  </span>
                </div>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#ececf1',
                  fontWeight: '500'
                }}>
                  {getText(currentStepData.commands[0].example)}
                </p>
              </motion.div>
            )}
            
            {/* Smart status indicator */}
            {trackerState.currentStep && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
                padding: '8px',
                background: 'rgba(76, 175, 80, 0.1)',
                border: '1px solid rgba(76, 175, 80, 0.3)',
                borderRadius: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{
                  fontSize: '13px',
                  color: 'rgba(236, 236, 241, 0.9)'
                }}>
                  {currentLanguage === 'he' 
                    ? `זוהה: ${trackerState.currentStep}` 
                    : `Detected: ${trackerState.currentStep.replace(/-/g, ' ')}`}
                </span>
              </div>
            )}
            
          </div>
        </motion.div>
      )}
      
      {/* Minimized floating button - same corner as tooltip */}
      {isMinimized && (
        <motion.button
          key="minimized-button"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsMinimized(false)}
          style={{
            position: 'fixed',
            bottom: '30px',
            [isRTL ? 'right' : 'left']: '30px',
            width: '50px',
            height: '50px',
            borderRadius: '12px',
            background: '#202123',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            zIndex: 1000,
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
        </motion.button>
      )}
      </AnimatePresence>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </>
  );
};

export default OnboardingTooltips;