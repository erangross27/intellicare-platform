import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../config/languagesStatic';
import platformFunctionHelpServiceV2 from '../services/platformFunctionHelpServiceV2';
import learningWebSocketClient from '../services/learningWebSocketClient';
import secureApi from '../services/secureApiClient';
import './SmartChatHelper.css';

/**
 * Smart Chat Helper Component
 * Dynamic, contextual tooltips for all 470+ platform functions
 * Adapts based on chat state, user context, and current conversation
 */

const SmartChatHelper = ({ 
  currentMessage, 
  chatState, 
  userContext,
  onSendMessage, 
  isVisible = true 
}) => {
  const { currentLanguage, isRTL } = useLanguage();
  const [helpData, setHelpData] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [activeTab, setActiveTab] = useState('main'); // main, search, recommendations, insights
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [learningInsights, setLearningInsights] = useState({
    predictions: [],
    suggestions: [],
    patterns: []
  });
  const [isLearningConnected, setIsLearningConnected] = useState(false);

  // Get contextual help when message changes
  useEffect(() => {
    if (currentMessage && currentMessage.trim()) {
      const contextualHelp = platformFunctionHelpServiceV2.getContextualHelp(
        currentMessage,
        chatState,
        { ...userContext, language: currentLanguage }
      );
      
      if (contextualHelp.primaryFunction || contextualHelp.suggestedActions.length > 0) {
        setHelpData(contextualHelp);
        setShowPulse(true);
        setIsMinimized(false);
        setTimeout(() => setShowPulse(false), 3000);
      }
    }
  }, [currentMessage, chatState, userContext, currentLanguage]);

  // Initialize learning integration
  useEffect(() => {
    const initializeLearning = async () => {
      try {
        // Connect to learning WebSocket for real-time insights
        await learningWebSocketClient.connect();
        setIsLearningConnected(true);
        
        // Subscribe to learning events relevant to chat helper
        learningWebSocketClient.subscribe([
          'workflow_prediction',
          'personal_suggestions',
          'pattern_detected'
        ]);
        
        // Handle learning events
        learningWebSocketClient.on('workflow_prediction', (predictions) => {
          setLearningInsights(prev => ({ ...prev, predictions }));
          if (predictions.length > 0 && activeTab === 'main') {
            setShowPulse(true);
            setTimeout(() => setShowPulse(false), 2000);
          }
        });
        
        learningWebSocketClient.on('personal_suggestions', (suggestions) => {
          setLearningInsights(prev => ({ ...prev, suggestions }));
          if (suggestions.length > 0) {
            setShowPulse(true);
            setTimeout(() => setShowPulse(false), 2000);
          }
        });
        
        learningWebSocketClient.on('pattern_detected', (pattern) => {
          setLearningInsights(prev => ({
            ...prev,
            patterns: [pattern, ...prev.patterns].slice(0, 5)
          }));
        });
        
        // Request initial learning insights
        const predictions = await learningWebSocketClient.requestWorkflowPrediction([]);
        if (predictions?.predictions) {
          setLearningInsights(prev => ({ ...prev, predictions: predictions.predictions }));
        }
        
        const suggestions = await learningWebSocketClient.requestSuggestions({});
        if (suggestions?.suggestions) {
          setLearningInsights(prev => ({ ...prev, suggestions: suggestions.suggestions }));
        }
        
      } catch (error) {
        console.error('Failed to initialize learning integration:', error);
        setIsLearningConnected(false);
      }
    };
    
    initializeLearning();
    
    // Cleanup on unmount
    return () => {
      learningWebSocketClient.removeAllListeners();
    };
  }, []);

  // Handle search
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = platformFunctionHelpServiceV2.searchFunctions(query, currentLanguage);
      setSearchResults(results);
      setActiveTab('search');
    } else {
      setSearchResults([]);
      setActiveTab('main');
    }
  }, [currentLanguage]);

  // Handle function selection
  const handleFunctionSelect = (functionKey) => {
    const context = {
      language: currentLanguage,
      ...chatState,
      ...userContext
    };
    
    const tooltip = platformFunctionHelpServiceV2.generateContextualTooltip(functionKey, context);
    if (tooltip) {
      setHelpData({
        primaryFunction: functionKey,
        contextualTooltip: tooltip,
        suggestedActions: [],
        dynamicTips: []
      });
      setActiveTab('main');
      
      // Track usage
      platformFunctionHelpServiceV2.trackFunctionUsage(functionKey, context);
    }
  };

  // Handle quick action
  const handleQuickAction = (action) => {
    if (onSendMessage) {
      onSendMessage(action);
    }
  };

  const isHebrew = currentLanguage === 'he';

  // Minimized state
  if (!isVisible || isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`smart-helper-minimized ${isRTL ? 'rtl' : 'ltr'}`}
        onClick={() => setIsMinimized(false)}
      >
        <div className={`minimized-button ${showPulse ? 'pulse' : ''}`}>
          <span className="helper-icon">🤖</span>
          {helpData?.contextualTooltip && (
            <span className="notification-dot"></span>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`smart-chat-helper ${isRTL ? 'rtl' : 'ltr'}`}
      >
        {/* Pulse Effect */}
        {showPulse && <div className="pulse-ring"></div>}

        {/* Header */}
        <div className="helper-header">
          <div className="header-left">
            <span className="helper-icon">🤖</span>
            <div className="header-text">
              <h3>{isHebrew ? 'עוזר חכם' : 'Smart Helper'}</h3>
              <span className="subtitle">
                {helpData?.contextualTooltip 
                  ? (isHebrew ? 'מציג עזרה לפעולה הנוכחית' : 'Showing help for current action')
                  : (isHebrew ? '470+ פונקציות במערכת' : '470+ system functions')
                }
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button 
              className="tab-button"
              onClick={() => setActiveTab('search')}
              title={isHebrew ? 'חיפוש פונקציות' : 'Search functions'}
            >
              🔍
            </button>
            <button 
              className={`tab-button ${isLearningConnected ? 'connected' : 'disconnected'}`}
              onClick={() => setActiveTab('insights')}
              title={isHebrew ? 'תובנות למידה' : 'Learning insights'}
            >
              🧠
              {learningInsights.predictions.length > 0 && (
                <span className="notification-dot"></span>
              )}
            </button>
            <button 
              className="minimize-button"
              onClick={() => setIsMinimized(true)}
              title={isHebrew ? 'מזער' : 'Minimize'}
            >
              ➖
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="helper-content">
          {/* Main Tab - Contextual Help */}
          {activeTab === 'main' && helpData?.contextualTooltip && (
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="contextual-help"
            >
              {/* Function Header */}
              <div className="function-header">
                <span className="category-icon">{helpData.contextualTooltip.categoryIcon}</span>
                <div className="function-info">
                  <h4 className="function-title">{helpData.contextualTooltip.title}</h4>
                  <span className="function-category">{helpData.contextualTooltip.category}</span>
                </div>
                <div className="function-meta">
                  <span className={`urgency urgency-${helpData.contextualTooltip.urgency}`}>
                    {helpData.contextualTooltip.urgency === 'high' ? '🔥' : 
                     helpData.contextualTooltip.urgency === 'medium' ? '⚡' : '💡'}
                  </span>
                  <span className="time-estimate">{helpData.contextualTooltip.timeEstimate}</span>
                </div>
              </div>

              {/* Why Needed */}
              <div className="section why-needed">
                <h5>{isHebrew ? '🎯 למה זה חשוב:' : '🎯 Why this matters:'}</h5>
                <p>{helpData.contextualTooltip.whyNeeded}</p>
              </div>

              {/* Description */}
              {helpData.contextualTooltip.description && (
                <div className="section description">
                  <p className="dynamic-description">{helpData.contextualTooltip.description}</p>
                </div>
              )}

              {/* Quick Actions */}
              {helpData.contextualTooltip.quickActions?.length > 0 && (
                <div className="section quick-actions">
                  <h5>{isHebrew ? '⚡ פעולות מהירות:' : '⚡ Quick Actions:'}</h5>
                  <div className="action-buttons">
                    {helpData.contextualTooltip.quickActions.map((action, idx) => (
                      <button
                        key={idx}
                        className="quick-action-button"
                        onClick={() => handleQuickAction(action.action)}
                      >
                        {action.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Main Tab - Suggested Actions (when no specific function detected) */}
          {activeTab === 'main' && !helpData?.contextualTooltip && helpData?.suggestedActions?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="suggested-actions"
            >
              <h5>{isHebrew ? '💡 הפעולות המומלצות:' : '💡 Suggested Actions:'}</h5>
              <div className="suggestions-grid">
                {helpData.suggestedActions.map((suggestion, idx) => (
                  <div 
                    key={idx}
                    className={`suggestion-card priority-${suggestion.priority}`}
                    onClick={() => handleQuickAction(suggestion.action)}
                  >
                    <span className="suggestion-icon">{suggestion.icon}</span>
                    <div className="suggestion-content">
                      <h6>{suggestion.title}</h6>
                      <p>{suggestion.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <motion.div
              initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="search-tab"
            >
              <div className="search-container">
                <input
                  type="text"
                  placeholder={isHebrew ? '🔍 חפש מתוך 470+ פונקציות...' : '🔍 Search 470+ functions...'}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="search-input"
                  autoFocus
                />
              </div>
              
              {searchResults.length > 0 && (
                <div className="search-results">
                  <h5>{isHebrew ? `נמצאו ${searchResults.length} פונקציות:` : `Found ${searchResults.length} functions:`}</h5>
                  {searchResults.map((result, idx) => (
                    <div 
                      key={idx}
                      className="search-result-item"
                      onClick={() => handleFunctionSelect(result.functionKey)}
                    >
                      <span className="result-icon">{result.icon}</span>
                      <div className="result-content">
                        <h6>{result.name}</h6>
                        <p>{result.description}</p>
                        <span className="result-category">{result.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <div className="no-results">
                  <span className="no-results-icon">🤷</span>
                  <p>{isHebrew ? 'לא נמצאו פונקציות מתאימות' : 'No matching functions found'}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Learning Insights Tab */}
          {activeTab === 'insights' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="learning-insights-tab"
            >
              {isLearningConnected ? (
                <div className="insights-content">
                  {/* Workflow Predictions */}
                  {learningInsights.predictions.length > 0 && (
                    <div className="insight-section">
                      <h5>🔮 {isHebrew ? 'צעדים צפויים:' : 'Predicted Next Steps:'}</h5>
                      <div className="predictions-list">
                        {learningInsights.predictions.slice(0, 3).map((prediction, idx) => (
                          <div 
                            key={idx}
                            className="prediction-item"
                            onClick={() => handleQuickAction(prediction.name)}
                          >
                            <div className="prediction-info">
                              <span className="prediction-name">{prediction.name}</span>
                              <span className="prediction-confidence">
                                {(prediction.confidence * 100).toFixed(0)}% confidence
                              </span>
                            </div>
                            <div className="prediction-bar">
                              <div 
                                className="confidence-fill"
                                style={{ width: `${prediction.confidence * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Personal Suggestions */}
                  {learningInsights.suggestions.length > 0 && (
                    <div className="insight-section">
                      <h5>💡 {isHebrew ? 'הצעות אישיות:' : 'Personal Suggestions:'}</h5>
                      <div className="suggestions-list">
                        {learningInsights.suggestions.slice(0, 3).map((suggestion, idx) => (
                          <div 
                            key={idx}
                            className={`suggestion-item priority-${suggestion.priority}`}
                            onClick={() => handleQuickAction(suggestion.action || suggestion.title)}
                          >
                            <div className="suggestion-header">
                              <span className="suggestion-title">{suggestion.title}</span>
                              <span className={`priority-badge ${suggestion.priority}`}>
                                {suggestion.priority}
                              </span>
                            </div>
                            <p className="suggestion-description">{suggestion.description}</p>
                            {suggestion.impact && (
                              <span className="suggestion-impact">Impact: {suggestion.impact}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detected Patterns */}
                  {learningInsights.patterns.length > 0 && (
                    <div className="insight-section">
                      <h5>🔍 {isHebrew ? 'דפוסים שזוהו:' : 'Detected Patterns:'}</h5>
                      <div className="patterns-list">
                        {learningInsights.patterns.slice(0, 2).map((pattern, idx) => (
                          <div key={idx} className="pattern-item">
                            <div className="pattern-header">
                              <span className="pattern-name">{pattern.name || pattern.type}</span>
                              <span className="pattern-confidence">
                                {pattern.confidence ? (pattern.confidence * 100).toFixed(0) + '%' : 'New'}
                              </span>
                            </div>
                            <p className="pattern-description">
                              {pattern.description || 'New behavior pattern detected'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No insights state */}
                  {learningInsights.predictions.length === 0 && 
                   learningInsights.suggestions.length === 0 && 
                   learningInsights.patterns.length === 0 && (
                    <div className="no-insights">
                      <span className="insights-icon">🌱</span>
                      <h4>{isHebrew ? 'אוסף תובנות...' : 'Gathering insights...'}</h4>
                      <p>{isHebrew 
                        ? 'המשך לעבוד והמערכת תלמד מההתנהגות שלך'
                        : 'Keep working and the system will learn from your behavior'
                      }</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="learning-disconnected">
                  <span className="disconnect-icon">🔌</span>
                  <h4>{isHebrew ? 'מערכת הלמידה לא מחוברת' : 'Learning system disconnected'}</h4>
                  <p>{isHebrew 
                    ? 'מנסה להתחבר למערכת הלמידה...'
                    : 'Attempting to connect to learning system...'
                  }</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Default state when no help is available */}
          {activeTab === 'main' && !helpData && (
            <div className="default-state">
              <div className="welcome-message">
                <span className="welcome-icon">👋</span>
                <h4>{isHebrew ? 'שלום! איך אוכל לעזור?' : 'Hello! How can I help?'}</h4>
                <p>{isHebrew 
                  ? 'התחל לכתוב ואני אציע לך פונקציות רלוונטיות'
                  : 'Start typing and I\'ll suggest relevant functions'
                }</p>
              </div>
              
              <div className="quick-categories">
                <h5>{isHebrew ? 'קטגוריות פופולריות:' : 'Popular Categories:'}</h5>
                <div className="category-chips">
                  <button 
                    className="category-chip"
                    onClick={() => handleSearch('patient')}
                  >
                    👥 {isHebrew ? 'ניהול מטופלים' : 'Patient Management'}
                  </button>
                  <button 
                    className="category-chip"
                    onClick={() => handleSearch('diagnose')}
                  >
                    🩺 {isHebrew ? 'אבחון' : 'Diagnosis'}
                  </button>
                  <button 
                    className="category-chip"
                    onClick={() => handleSearch('appointment')}
                  >
                    📅 {isHebrew ? 'תורים' : 'Appointments'}
                  </button>
                  <button 
                    className="category-chip"
                    onClick={() => handleSearch('document')}
                  >
                    📄 {isHebrew ? 'מסמכים' : 'Documents'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="helper-footer">
          <div className="footer-tabs">
            <button 
              className={`tab-button ${activeTab === 'main' ? 'active' : ''}`}
              onClick={() => setActiveTab('main')}
            >
              {isHebrew ? 'עזרה' : 'Help'}
            </button>
            <button 
              className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              {isHebrew ? 'חיפוש' : 'Search'}
            </button>
            <button 
              className={`tab-button ${activeTab === 'insights' ? 'active' : ''} ${isLearningConnected ? 'learning-connected' : 'learning-disconnected'}`}
              onClick={() => setActiveTab('insights')}
            >
              {isHebrew ? 'תובנות' : 'Insights'}
              {learningInsights.predictions.length > 0 && (
                <span className="tab-notification"></span>
              )}
            </button>
          </div>
          <div className="footer-info">
            <span className="function-count">
              {isHebrew ? '470+ פונקציות' : '470+ functions'}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SmartChatHelper;