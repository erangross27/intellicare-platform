/**
 * Learning Dashboard Component
 *
 * Real-time learning insights dashboard with live updates via WebSocket
 */
import CloseIcon from './icons/CloseIcon';

import React, { useState, useEffect, useRef } from 'react';
import learningWebSocketClient from '../services/learningWebSocketClient';
import './LearningDashboard.css';

const LearningDashboard = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [workflowPredictions, setWorkflowPredictions] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [efficiencyMetrics, setEfficiencyMetrics] = useState(null);
    const [automationOpportunities, setAutomationOpportunities] = useState([]);
    const [patterns, setPatterns] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [rZeroUpdates, setRZeroUpdates] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [subscriptions, setSubscriptions] = useState([
        'workflow_prediction',
        'automation_opportunity', 
        'efficiency_alert',
        'pattern_detected',
        'rzero_update'
    ]);
    
    const dashboardRef = useRef(null);

    useEffect(() => {
        let mounted = true;

        const connectAndSubscribe = async () => {
            try {
                setConnectionStatus('connecting');
                
                // Connect to WebSocket
                await learningWebSocketClient.connect();
                
                if (!mounted) return;
                
                // Subscribe to events
                learningWebSocketClient.subscribe(subscriptions);
                
                // Set up event listeners
                setupEventListeners();
                
                setIsConnected(true);
                setConnectionStatus('connected');
                
                console.log('📊 Learning Dashboard connected');
                
                // Request initial data
                requestInitialData();
                
            } catch (error) {
                console.error('Failed to connect to Learning WebSocket:', error);
                setConnectionStatus('error');
            }
        };

        const setupEventListeners = () => {
            // Connection events
            learningWebSocketClient.on('connected', () => {
                setIsConnected(true);
                setConnectionStatus('connected');
            });

            learningWebSocketClient.on('disconnected', () => {
                setIsConnected(false);
                setConnectionStatus('disconnected');
            });

            learningWebSocketClient.on('error', (error) => {
                console.error('Learning WebSocket error:', error);
                setConnectionStatus('error');
            });

            // Learning events
            learningWebSocketClient.on('workflow_prediction', (predictions) => {
                if (mounted) {
                    setWorkflowPredictions(predictions);
                    addNotification('Workflow Prediction', `${predictions.length} predictions available`);
                }
            });

            learningWebSocketClient.on('personal_suggestions', (newSuggestions) => {
                if (mounted) {
                    setSuggestions(prev => [...newSuggestions, ...prev].slice(0, 10));
                }
            });

            learningWebSocketClient.on('efficiency_metrics', (metrics) => {
                if (mounted) {
                    setEfficiencyMetrics(metrics);
                }
            });

            learningWebSocketClient.on('automation_opportunity', (opportunity) => {
                if (mounted) {
                    setAutomationOpportunities(prev => [opportunity.data, ...prev].slice(0, 5));
                    addNotification('Automation Opportunity', `ROI: $${opportunity.data.roi}/month`);
                }
            });

            learningWebSocketClient.on('pattern_detected', (pattern) => {
                if (mounted) {
                    setPatterns(prev => [pattern.data, ...prev].slice(0, 10));
                    addNotification('New Pattern', pattern.data.description);
                }
            });

            learningWebSocketClient.on('efficiency_alert', (alert) => {
                if (mounted) {
                    setAlerts(prev => [alert.data, ...prev].slice(0, 5));
                    addNotification('Efficiency Alert', alert.data.message, 'warning');
                }
            });

            learningWebSocketClient.on('bottleneck_alert', (alert) => {
                if (mounted) {
                    setAlerts(prev => [alert.data, ...prev].slice(0, 5));
                    addNotification('Bottleneck Detected', alert.data.description, 'error');
                }
            });

            learningWebSocketClient.on('rzero_update', (update) => {
                if (mounted) {
                    setRZeroUpdates(prev => [update.data, ...prev].slice(0, 5));
                    if (update.data.milestone) {
                        addNotification('R-Zero Milestone', update.data.achievement, 'success');
                    }
                }
            });

            learningWebSocketClient.on('notification', (notification) => {
                if (mounted) {
                    addNotification(notification.title, notification.message, notification.type);
                }
            });
        };

        const requestInitialData = async () => {
            try {
                // Request current workflow predictions
                const predictions = await learningWebSocketClient.requestWorkflowPrediction([]);
                if (predictions.predictions && mounted) {
                    setWorkflowPredictions(predictions.predictions);
                }

                // Request personal suggestions
                const suggestions = await learningWebSocketClient.requestSuggestions({});
                if (suggestions.suggestions && mounted) {
                    setSuggestions(suggestions.suggestions);
                }

                // Request efficiency metrics
                const efficiency = await learningWebSocketClient.requestEfficiencyMetrics('user', '7d');
                if (efficiency.efficiency && mounted) {
                    setEfficiencyMetrics(efficiency.efficiency);
                }

            } catch (error) {
                console.error('Error requesting initial data:', error);
            }
        };

        // Request notification permission
        learningWebSocketClient.requestNotificationPermission();

        // Connect
        connectAndSubscribe();

        return () => {
            mounted = false;
            learningWebSocketClient.removeAllListeners();
            learningWebSocketClient.disconnect();
        };
    }, []);

    const addNotification = (title, message, type = 'info') => {
        const notification = {
            id: Date.now(),
            title,
            message,
            type,
            timestamp: new Date()
        };
        
        setNotifications(prev => [notification, ...prev].slice(0, 20));
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 5000);
    };

    const dismissNotification = (notificationId) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const handleSuggestionFeedback = async (suggestionId, accepted) => {
        try {
            await learningWebSocketClient.sendFeedback(suggestionId, '', accepted);
            
            // Update suggestion status
            setSuggestions(prev => 
                prev.map(s => 
                    s.id === suggestionId 
                        ? { ...s, feedback: accepted ? 'accepted' : 'rejected' }
                        : s
                )
            );
            
            addNotification('Feedback Sent', 'Thank you for your feedback!', 'success');
        } catch (error) {
            console.error('Error sending feedback:', error);
            addNotification('Error', 'Failed to send feedback', 'error');
        }
    };

    const getConnectionStatusColor = () => {
        switch (connectionStatus) {
            case 'connected': return '#10b981';
            case 'connecting': return '#f59e0b';
            case 'error': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const getEfficiencyColor = (score) => {
        if (score >= 0.8) return '#10b981';
        if (score >= 0.6) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="learning-dashboard" ref={dashboardRef}>
            {/* Header */}
            <div className="dashboard-header">
                <div className="header-title">
                    <h2>📊 Learning Analytics Dashboard</h2>
                    <div className="connection-status">
                        <div 
                            className={`status-indicator ${connectionStatus}`}
                            style={{ backgroundColor: getConnectionStatusColor() }}
                        ></div>
                        <span className="status-text">
                            {connectionStatus === 'connected' ? 'Live Updates Active' :
                             connectionStatus === 'connecting' ? 'Connecting...' :
                             connectionStatus === 'error' ? 'Connection Error' :
                             'Disconnected'}
                        </span>
                    </div>
                </div>
                
                {/* Real-time Notifications */}
                <div className="notifications-container">
                    {notifications.map(notification => (
                        <div 
                            key={notification.id}
                            className={`notification ${notification.type}`}
                            onClick={() => dismissNotification(notification.id)}
                        >
                            <div className="notification-content">
                                <strong>{notification.title}</strong>
                                <p>{notification.message}</p>
                                <span className="notification-time">
                                    {formatTimestamp(notification.timestamp)}
                                </span>
                            </div>
                            <button className="notification-close"><CloseIcon size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="dashboard-grid">
                {/* Efficiency Metrics */}
                <div className="dashboard-card efficiency-card">
                    <h3>⚡ Efficiency Metrics</h3>
                    {efficiencyMetrics ? (
                        <div className="efficiency-content">
                            <div className="efficiency-score">
                                <div 
                                    className="score-circle"
                                    style={{ color: getEfficiencyColor(efficiencyMetrics.score) }}
                                >
                                    {(efficiencyMetrics.score * 100).toFixed(1)}%
                                </div>
                                <div className="score-label">Current Efficiency</div>
                            </div>
                            <div className="efficiency-trend">
                                <span className={`trend ${efficiencyMetrics.trend}`}>
                                    {efficiencyMetrics.trend === 'increasing' ? '📈' :
                                     efficiencyMetrics.trend === 'decreasing' ? '📉' : '➡️'}
                                    {efficiencyMetrics.trend}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="loading">Loading efficiency data...</div>
                    )}
                </div>

                {/* Workflow Predictions */}
                <div className="dashboard-card predictions-card">
                    <h3>🔮 Workflow Predictions</h3>
                    <div className="predictions-list">
                        {workflowPredictions.length > 0 ? (
                            workflowPredictions.slice(0, 3).map((prediction, index) => (
                                <div key={index} className="prediction-item">
                                    <div className="prediction-name">{prediction.name}</div>
                                    <div className="prediction-confidence">
                                        <div 
                                            className="confidence-bar"
                                            style={{ width: `${prediction.confidence * 100}%` }}
                                        ></div>
                                        <span>{(prediction.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No predictions available</div>
                        )}
                    </div>
                </div>

                {/* Personal Suggestions */}
                <div className="dashboard-card suggestions-card">
                    <h3>💡 Personal Suggestions</h3>
                    <div className="suggestions-list">
                        {suggestions.length > 0 ? (
                            suggestions.slice(0, 3).map((suggestion, index) => (
                                <div key={suggestion.id || index} className="suggestion-item">
                                    <div className="suggestion-content">
                                        <div className="suggestion-title">{suggestion.title}</div>
                                        <div className="suggestion-description">{suggestion.description}</div>
                                        <div className="suggestion-impact">
                                            Impact: {suggestion.impact} | Priority: {suggestion.priority}
                                        </div>
                                    </div>
                                    {suggestion.feedback !== 'accepted' && suggestion.feedback !== 'rejected' && (
                                        <div className="suggestion-actions">
                                            <button 
                                                className="accept-btn"
                                                onClick={() => handleSuggestionFeedback(suggestion.id, true)}
                                            >
                                                ✓ Accept
                                            </button>
                                            <button 
                                                className="reject-btn"
                                                onClick={() => handleSuggestionFeedback(suggestion.id, false)}
                                            >
                                                ✗ Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No suggestions available</div>
                        )}
                    </div>
                </div>

                {/* Automation Opportunities */}
                <div className="dashboard-card automation-card">
                    <h3>🤖 Automation Opportunities</h3>
                    <div className="automation-list">
                        {automationOpportunities.length > 0 ? (
                            automationOpportunities.slice(0, 3).map((opportunity, index) => (
                                <div key={opportunity.id || index} className="automation-item">
                                    <div className="automation-title">{opportunity.title}</div>
                                    <div className="automation-description">{opportunity.description}</div>
                                    <div className="automation-metrics">
                                        <span className="roi">ROI: ${opportunity.roi}/month</span>
                                        <span className="effort">Effort: {opportunity.effort}</span>
                                        <span className={`priority ${opportunity.priority}`}>
                                            {opportunity.priority}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No automation opportunities</div>
                        )}
                    </div>
                </div>

                {/* Pattern Detection */}
                <div className="dashboard-card patterns-card">
                    <h3>🔍 Detected Patterns</h3>
                    <div className="patterns-list">
                        {patterns.length > 0 ? (
                            patterns.slice(0, 3).map((pattern, index) => (
                                <div key={pattern.id || index} className="pattern-item">
                                    <div className="pattern-name">{pattern.name}</div>
                                    <div className="pattern-description">{pattern.description}</div>
                                    <div className="pattern-metrics">
                                        <span className="confidence">
                                            Confidence: {(pattern.confidence * 100).toFixed(0)}%
                                        </span>
                                        <span className="frequency">
                                            Frequency: {pattern.frequency}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No patterns detected</div>
                        )}
                    </div>
                </div>

                {/* Alerts */}
                <div className="dashboard-card alerts-card">
                    <h3>⚠️ Efficiency Alerts</h3>
                    <div className="alerts-list">
                        {alerts.length > 0 ? (
                            alerts.slice(0, 3).map((alert, index) => (
                                <div key={index} className={`alert-item ${alert.severity}`}>
                                    <div className="alert-message">{alert.message}</div>
                                    {alert.suggestions && alert.suggestions.length > 0 && (
                                        <div className="alert-suggestions">
                                            <strong>Suggestions:</strong>
                                            <ul>
                                                {alert.suggestions.slice(0, 2).map((suggestion, i) => (
                                                    <li key={i}>{suggestion}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No alerts</div>
                        )}
                    </div>
                </div>

                {/* R-Zero Updates */}
                <div className="dashboard-card rzero-card">
                    <h3>🎯 R-Zero Learning</h3>
                    <div className="rzero-list">
                        {rZeroUpdates.length > 0 ? (
                            rZeroUpdates.slice(0, 2).map((update, index) => (
                                <div key={index} className="rzero-item">
                                    <div className="rzero-achievement">{update.achievement}</div>
                                    <div className="rzero-impact">Impact: {update.impact}</div>
                                    {update.milestone && (
                                        <div className="rzero-milestone">🏆 Milestone Achieved!</div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No R-Zero updates</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LearningDashboard;