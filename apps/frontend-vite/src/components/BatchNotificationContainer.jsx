/**
 * BatchNotificationContainer.jsx
 * Container component that listens for batch notifications and displays reasoning
 * Place this in your App.jsx or main layout to show notifications globally
 */

import React, { useState, useEffect } from 'react';
import batchNotificationService from '../services/batchNotificationService';
import DocumentAnalysisReasoning from './DocumentAnalysisReasoning';
import './BatchNotificationContainer.css';

const BatchNotificationContainer = () => {
  const [notifications, setNotifications] = useState([]);
  const [activeReasoning, setActiveReasoning] = useState(null);

  useEffect(() => {
    // Subscribe to batch notifications
    const unsubscribe = batchNotificationService.subscribe((event, data) => {
      if (event === 'batchStatus') {
        handleBatchStatus(data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleBatchStatus = (data) => {
    switch (data.type) {
      case 'phase1_complete':
        // Show Phase 1 reasoning
        setActiveReasoning({
          batchId: data.batchId,
          patientName: data.patientName,
          reasoning: data.reasoning,
          selectedCollections: data.selectedCollections,
          timestamp: data.timestamp
        });
        
        // Also add to notification list
        addNotification({
          id: `phase1-${data.batchId}`,
          type: 'phase1',
          title: `📄 Document Analysis Complete`,
          subtitle: data.patientName || 'Unknown Patient',
          message: data.reasoning?.substring(0, 80) + '...',
          data: data
        });
        break;

      case 'phase2_complete':
        // Phase 2 complete - can dismiss the reasoning popup
        addNotification({
          id: `phase2-${data.batchId}`,
          type: 'phase2',
          title: `✅ Data Extraction Complete`,
          subtitle: data.patientName || 'Unknown Patient',
          message: `Extracted ${data.extractedFields?.length || 0} fields`,
          data: data,
          autoDismiss: true
        });
        break;

      case 'processing':
        addNotification({
          id: `processing-${data.batchId}`,
          type: 'processing',
          title: `⏳ Processing Documents`,
          subtitle: data.patientName || 'Unknown Patient',
          message: `Processing ${data.documentCount || 1} document(s)...`,
          data: data
        });
        break;

      case 'error':
        addNotification({
          id: `error-${data.batchId || Date.now()}`,
          type: 'error',
          title: `❌ Processing Error`,
          subtitle: 'Document Analysis Failed',
          message: data.message || 'An error occurred',
          data: data,
          autoDismiss: false
        });
        break;

      default:
        console.log('Unknown batch status type:', data.type);
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => {
      // Remove existing notification with same ID
      const filtered = prev.filter(n => n.id !== notification.id);
      
      // Add new notification at the beginning
      const updated = [notification, ...filtered].slice(0, 5);
      
      // Auto-dismiss if requested
      if (notification.autoDismiss) {
        setTimeout(() => {
          dismissNotification(notification.id);
        }, 5000);
      }
      
      return updated;
    });
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const dismissReasoning = () => {
    setActiveReasoning(null);
  };

  const handleNotificationClick = (notification) => {
    if (notification.type === 'phase1' && notification.data?.reasoning) {
      setActiveReasoning(notification.data);
    }
    dismissNotification(notification.id);
  };

  return (
    <>
      {/* Toast Notifications */}
      <div className="batch-notifications-container">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`batch-notification ${notification.type}`}
            onClick={() => handleNotificationClick(notification)}
          >
            <div className="notification-header">
              <h4>{notification.title}</h4>
              <button
                className="dismiss-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification(notification.id);
                }}
              >
                ×
              </button>
            </div>
            {notification.subtitle && (
              <div className="notification-subtitle">{notification.subtitle}</div>
            )}
            <p className="notification-message">{notification.message}</p>
          </div>
        ))}
      </div>

      {/* Phase 1 Reasoning Modal/Panel */}
      {activeReasoning && (
        <div className="reasoning-modal-overlay" onClick={dismissReasoning}>
          <div className="reasoning-modal" onClick={e => e.stopPropagation()}>
            <div className="reasoning-modal-header">
              <h2>🧠 Document Analysis</h2>
              <button className="close-btn" onClick={dismissReasoning}>×</button>
            </div>
            <div className="reasoning-modal-content">
              <div className="patient-info">
                <strong>Patient:</strong> {activeReasoning.patientName || 'Unknown'}
              </div>
              <DocumentAnalysisReasoning
                batchId={activeReasoning.batchId}
                onClose={dismissReasoning}
              />
              {activeReasoning.selectedCollections && (
                <div className="selected-collections">
                  <h4>Selected Data Categories:</h4>
                  <ul>
                    {activeReasoning.selectedCollections.map((collection, idx) => (
                      <li key={idx}>{collection}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BatchNotificationContainer;
