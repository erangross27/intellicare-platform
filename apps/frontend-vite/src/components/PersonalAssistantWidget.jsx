/**
 * Personal Assistant Widget
 * 
 * Advanced AI-powered widget that provides:
 * - Real-time workflow predictions
 * - Personalized suggestions
 * - Automation opportunities
 * - Efficiency insights
 * - Learning-based recommendations
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../config/languagesStatic';
import { useAuth } from '../context/AuthContext';
import learningWebSocketClient from '../services/learningWebSocketClient';
import secureApi from '../services/secureApiClient';
import './PersonalAssistantWidget.css';

const PersonalAssistantWidget = ({ 
  position = 'bottom-right',
  onSendMessage,
  currentContext = {}
}) => {
  const { currentLanguage, isRTL } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [activeTab, setActiveTab] = useState('predictions'); // predictions, suggestions, automation, insights
  const [isConnected, setIsConnected] = useState(false);
  const widgetRef = useRef(null);

  // Learning data states
  const [predictions, setPredictions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [automationOpportunities, setAutomationOpportunities] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [efficiency, setEfficiency] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Animation and interaction states
  const [pulse, setPulse] = useState(false);
  const [newInsights, setNewInsights] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const isHebrew = currentLanguage === 'he';

  // Initialize learning connection
  useEffect(() => {
    const initializeAssistant = async () => {
      try {
        // Connect to learning WebSocket
        if (!learningWebSocketClient.isConnected) {
          await learningWebSocketClient.connect();
        }
        setIsConnected(true);

        // Subscribe to all relevant events
        learningWebSocketClient.subscribe([
          'workflow_prediction',
          'personal_suggestions',
          'automation_opportunity',
          'pattern_detected',
          'efficiency_alert',
          'bottleneck_alert',
          'learning_milestone'
        ]);

        // Set up event handlers
        setupEventHandlers();

        // Request initial data
        await requestInitialData();

      } catch (error) {
        console.error('Failed to initialize Personal Assistant:', error);
        setIsConnected(false);
      }
    };

    const setupEventHandlers = () => {
      // Workflow predictions
      learningWebSocketClient.on('workflow_prediction', (data) => {
        setPredictions(data);
        triggerNotification('New predictions available', '🔮');
        setLastActivity(Date.now());
      });

      // Personal suggestions
      learningWebSocketClient.on('personal_suggestions', (data) => {
        setSuggestions(data);
        triggerNotification('Personal suggestions updated', '💡');
        setLastActivity(Date.now());
      });

      // Automation opportunities
      learningWebSocketClient.on('automation_opportunity', (data) => {
        setAutomationOpportunities(prev => [data.data, ...prev].slice(0, 10));
        triggerNotification(`Automation: $${data.data.roi}/month savings`, '🤖');
        setNewInsights(prev => prev + 1);
        setLastActivity(Date.now());
      });

      // Pattern detection
      learningWebSocketClient.on('pattern_detected', (data) => {
        setPatterns(prev => [data.data, ...prev].slice(0, 10));
        triggerNotification('New behavior pattern detected', '🔍');
        setLastActivity(Date.now());
      });

      // Efficiency alerts
      learningWebSocketClient.on('efficiency_alert', (data) => {
        setEfficiency(data.data);
        triggerNotification(`Efficiency: ${(data.data.metrics?.current * 100 || 0).toFixed(1)}%`, '⚡');
        setLastActivity(Date.now());
      });

      // Learning milestones
      learningWebSocketClient.on('learning_milestone', (data) => {
        triggerNotification(data.achievement, '🎉');
        setLastActivity(Date.now());
      });
    };

    const requestInitialData = async () => {
      try {
        // Get workflow predictions
        const predRes = await learningWebSocketClient.requestWorkflowPrediction([]);
        if (predRes?.predictions) setPredictions(predRes.predictions);

        // Get personal suggestions
        const sugRes = await learningWebSocketClient.requestSuggestions(currentContext);
        if (sugRes?.suggestions) setSuggestions(sugRes.suggestions);

        // Get efficiency metrics
        const effRes = await learningWebSocketClient.requestEfficiencyMetrics('user', '24h');
        if (effRes?.efficiency) setEfficiency(effRes.efficiency);

      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    initializeAssistant();

    // Cleanup
    return () => {
      learningWebSocketClient.removeAllListeners([
        'workflow_prediction', 'personal_suggestions', 'automation_opportunity',
        'pattern_detected', 'efficiency_alert', 'learning_milestone'
      ]);
    };
  }, []);

  // Trigger notifications and visual feedback
  const triggerNotification = (message, icon) => {
    const notification = {
      id: Date.now(),
      message,
      icon,
      timestamp: new Date()
    };

    setNotifications(prev => [notification, ...prev].slice(0, 5));
    
    // Visual pulse effect
    setPulse(true);
    setTimeout(() => setPulse(false), 2000);

    // Auto-remove notification
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  // Handle suggestion feedback
  const handleSuggestionFeedback = async (suggestionId, accepted) => {
    try {
      await learningWebSocketClient.sendFeedback(suggestionId, '', accepted);
      
      setSuggestions(prev =>
        prev.map(s =>
          s.id === suggestionId
            ? { ...s, feedback: accepted ? 'accepted' : 'rejected' }
            : s
        )
      );

      triggerNotification(
        accepted ? 'Feedback recorded - Thank you!' : 'Suggestion dismissed',
        accepted ? '✅' : '❌'
      );

    } catch (error) {
      console.error('Failed to send feedback:', error);
    }
  };

  // Handle quick actions
  const handleQuickAction = (action) => {
    if (onSendMessage) {
      onSendMessage(action);
    }
    triggerNotification(`Executed: ${action}`, '⚡');
  };

  // Widget visibility management
  const toggleWidget = () => {
    if (isMinimized) {
      setIsMinimized(false);
      setIsOpen(true);
      setNewInsights(0); // Clear notification count
    } else {
      setIsMinimized(true);
      setIsOpen(false);
    }
  };

  // Get position styles
  const getPositionStyles = () => {
    const base = { position: 'fixed', zIndex: 9999 };
    switch (position) {
      case 'bottom-right':
        return { ...base, bottom: '20px', right: '20px' };
      case 'bottom-left':
        return { ...base, bottom: '20px', left: '20px' };
      case 'top-right':
        return { ...base, top: '20px', right: '20px' };
      case 'top-left':
        return { ...base, top: '20px', left: '20px' };
      default:
        return { ...base, bottom: '20px', right: '20px' };
    }
  };

  // Minimized widget button
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`assistant-widget-minimized ${pulse ? 'pulse' : ''}`}
        style={getPositionStyles()}
        onClick={toggleWidget}
      >
        <div className="minimized-button">
          <span className="assistant-icon">
            {isConnected ? '🧠' : '💡'}
          </span>
          {newInsights > 0 && (
            <span className="insight-badge">{newInsights > 9 ? '9+' : newInsights}</span>
          )}
          {notifications.length > 0 && (
            <span className="notification-pulse"></span>
          )}
        </div>
        
        {/* Recent notification preview */}
        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="notification-preview"
          >
            <span className="preview-icon">{notifications[0].icon}</span>
            <span className="preview-text">{notifications[0].message}</span>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Full widget interface
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="personal-assistant-widget"
        style={getPositionStyles()}
        ref={widgetRef}
      >
        {/* Widget Header */}
        <div className="widget-header">
          <div className="header-left">
            <span className="assistant-avatar">🧠</span>
            <div className="assistant-info">
              <h3>{isHebrew ? 'עוזר אישי חכם' : 'Smart Personal Assistant'}</h3>
              <span className="connection-status">
                <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
                {isConnected ? 
                  (isHebrew ? 'מחובר ללמידה' : 'Learning Active') : 
                  (isHebrew ? 'מנותק' : 'Disconnected')
                }
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button 
              className="minimize-button"
              onClick={toggleWidget}
              title={isHebrew ? 'מזער' : 'Minimize'}
            >
              ➖
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'predictions' ? 'active' : ''}`}
            onClick={() => setActiveTab('predictions')}
          >
            <span className="tab-icon">🔮</span>
            <span className="tab-label">{isHebrew ? 'חיזויים' : 'Predictions'}</span>
            {predictions.length > 0 && <span className="tab-count">{predictions.length}</span>}
          </button>
          
          <button 
            className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            <span className="tab-icon">💡</span>
            <span className="tab-label">{isHebrew ? 'הצעות' : 'Suggestions'}</span>
            {suggestions.length > 0 && <span className="tab-count">{suggestions.length}</span>}
          </button>
          
          <button 
            className={`tab-button ${activeTab === 'automation' ? 'active' : ''}`}
            onClick={() => setActiveTab('automation')}
          >
            <span className="tab-icon">🤖</span>
            <span className="tab-label">{isHebrew ? 'אוטומציה' : 'Automation'}</span>
            {automationOpportunities.length > 0 && <span className="tab-count">{automationOpportunities.length}</span>}
          </button>
          
          <button 
            className={`tab-button ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">{isHebrew ? 'תובנות' : 'Insights'}</span>
          </button>
        </div>

        {/* Widget Content */}
        <div className="widget-content">
          {/* Workflow Predictions Tab */}
          {activeTab === 'predictions' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="predictions-tab"
            >
              <h4>{isHebrew ? '🔮 צעדים צפויים' : '🔮 Predicted Next Steps'}</h4>
              {predictions.length > 0 ? (
                <div className="predictions-list">
                  {predictions.slice(0, 4).map((prediction, idx) => (
                    <div
                      key={idx}
                      className="prediction-card"
                      onClick={() => handleQuickAction(prediction.name)}
                    >
                      <div className="prediction-header">
                        <span className="prediction-name">{prediction.name}</span>
                        <span className="confidence-badge">
                          {(prediction.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="confidence-bar">
                        <div 
                          className="confidence-fill"
                          style={{ width: `${prediction.confidence * 100}%` }}
                        ></div>
                      </div>
                      {prediction.reason && (
                        <p className="prediction-reason">{prediction.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">🌱</span>
                  <p>{isHebrew ? 'אוסף נתונים לחיזוי...' : 'Gathering data for predictions...'}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Personal Suggestions Tab */}
          {activeTab === 'suggestions' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="suggestions-tab"
            >
              <h4>{isHebrew ? '💡 הצעות אישיות' : '💡 Personal Suggestions'}</h4>
              {suggestions.length > 0 ? (
                <div className="suggestions-list">
                  {suggestions.slice(0, 4).map((suggestion, idx) => (
                    <div
                      key={suggestion.id || idx}
                      className={`suggestion-card priority-${suggestion.priority || 'medium'}`}
                    >
                      <div className="suggestion-header">
                        <span className="suggestion-title">{suggestion.title}</span>
                        <span className={`priority-badge ${suggestion.priority || 'medium'}`}>
                          {suggestion.priority || 'medium'}
                        </span>
                      </div>
                      <p className="suggestion-description">{suggestion.description}</p>
                      {suggestion.impact && (
                        <span className="suggestion-impact">Impact: {suggestion.impact}</span>
                      )}
                      
                      {suggestion.feedback !== 'accepted' && suggestion.feedback !== 'rejected' && (
                        <div className="suggestion-actions">
                          <button
                            className="action-button accept"
                            onClick={() => handleSuggestionFeedback(suggestion.id, true)}
                          >
                            ✓ {isHebrew ? 'קבל' : 'Accept'}
                          </button>
                          <button
                            className="action-button reject"
                            onClick={() => handleSuggestionFeedback(suggestion.id, false)}
                          >
                            ✗ {isHebrew ? 'דחה' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">💡</span>
                  <p>{isHebrew ? 'אין הצעות כרגע' : 'No suggestions available'}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Automation Opportunities Tab */}
          {activeTab === 'automation' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="automation-tab"
            >
              <h4>{isHebrew ? '🤖 הזדמנויות אוטומציה' : '🤖 Automation Opportunities'}</h4>
              {automationOpportunities.length > 0 ? (
                <div className="automation-list">
                  {automationOpportunities.slice(0, 3).map((opportunity, idx) => (
                    <div key={opportunity.id || idx} className="automation-card">
                      <div className="automation-header">
                        <span className="automation-title">{opportunity.title}</span>
                        <span className="roi-badge">${opportunity.roi}/mo</span>
                      </div>
                      <p className="automation-description">{opportunity.description}</p>
                      <div className="automation-metrics">
                        <span className="effort-level">Effort: {opportunity.effort}</span>
                        <span className={`priority-tag ${opportunity.priority}`}>
                          {opportunity.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">🤖</span>
                  <p>{isHebrew ? 'חיפוש הזדמנויות אוטומציה...' : 'Searching for automation opportunities...'}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="insights-tab"
            >
              <h4>{isHebrew ? '📊 תובנות ביצועים' : '📊 Performance Insights'}</h4>
              
              {/* Efficiency Score */}
              {efficiency && (
                <div className="efficiency-card">
                  <div className="efficiency-header">
                    <span className="efficiency-label">{isHebrew ? 'יעילות נוכחית' : 'Current Efficiency'}</span>
                    <span className="efficiency-score">
                      {(efficiency.metrics?.current * 100 || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="efficiency-trend">
                    <span className={`trend-indicator ${efficiency.metrics?.trend || 'stable'}`}>
                      {efficiency.metrics?.trend === 'increasing' ? '📈' : 
                       efficiency.metrics?.trend === 'decreasing' ? '📉' : '➡️'}
                    </span>
                    <span className="trend-text">
                      {isHebrew ? 'מגמה: ' : 'Trend: '}{efficiency.metrics?.trend || 'stable'}
                    </span>
                  </div>
                  {efficiency.suggestions && (
                    <div className="efficiency-suggestions">
                      <strong>{isHebrew ? 'הצעות שיפור:' : 'Improvements:'}</strong>
                      <ul>
                        {efficiency.suggestions.slice(0, 2).map((suggestion, idx) => (
                          <li key={idx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Patterns */}
              {patterns.length > 0 && (
                <div className="patterns-section">
                  <h5>{isHebrew ? '🔍 דפוסים שזוהו לאחרונה' : '🔍 Recently Detected Patterns'}</h5>
                  {patterns.slice(0, 2).map((pattern, idx) => (
                    <div key={idx} className="pattern-card">
                      <span className="pattern-name">{pattern.name || pattern.type}</span>
                      <p className="pattern-description">
                        {pattern.description || 'New behavior pattern detected'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Activity Summary */}
              <div className="activity-summary">
                <h5>{isHebrew ? '📈 סיכום פעילות' : '📈 Activity Summary'}</h5>
                <div className="activity-stats">
                  <div className="stat-item">
                    <span className="stat-label">{isHebrew ? 'חיזויים' : 'Predictions'}</span>
                    <span className="stat-value">{predictions.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">{isHebrew ? 'הצעות' : 'Suggestions'}</span>
                    <span className="stat-value">{suggestions.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">{isHebrew ? 'אוטומציה' : 'Automation'}</span>
                    <span className="stat-value">{automationOpportunities.length}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Recent Notifications */}
        {notifications.length > 0 && (
          <div className="notifications-section">
            <h5>{isHebrew ? '🔔 עדכונים אחרונים' : '🔔 Recent Updates'}</h5>
            <div className="notifications-list">
              {notifications.slice(0, 3).map(notification => (
                <div key={notification.id} className="notification-item">
                  <span className="notification-icon">{notification.icon}</span>
                  <span className="notification-text">{notification.message}</span>
                  <span className="notification-time">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default PersonalAssistantWidget;