/**
 * useDocumentAnalysisNotifications.js
 * Hook to listen for document analysis WebSocket events and display reasoning
 */

import { useState, useEffect, useCallback } from 'react';

export const useDocumentAnalysisNotifications = (socket) => {
  const [notifications, setNotifications] = useState([]);
  const [currentReasoning, setCurrentReasoning] = useState(null);
  const [phase1Complete, setPhase1Complete] = useState(false);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissReasoning = useCallback(() => {
    setCurrentReasoning(null);
    setPhase1Complete(false);
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for batch status updates
    const handleBatchStatus = (data) => {
      console.log('📊 Batch status update:', data);

      if (data.type === 'phase1_complete') {
        console.log('🧠 Phase 1 complete with reasoning:', data.reasoning);
        
        // Store the reasoning for display
        setCurrentReasoning({
          batchId: data.batchId,
          patientName: data.patientName,
          reasoning: data.reasoning,
          selectedCollections: data.selectedCollections,
          timestamp: data.timestamp
        });
        setPhase1Complete(true);

        // Add to notification list
        const notification = {
          id: `phase1-${data.batchId}-${Date.now()}`,
          type: 'phase1_complete',
          title: `Document Analysis Complete - ${data.patientName || 'Unknown Patient'}`,
          message: data.reasoning?.substring(0, 100) + (data.reasoning?.length > 100 ? '...' : ''),
          reasoning: data.reasoning,
          batchId: data.batchId,
          timestamp: new Date(),
          autoDismiss: false
        };

        setNotifications(prev => [notification, ...prev].slice(0, 5));
      }

      if (data.type === 'phase2_complete') {
        const notification = {
          id: `phase2-${data.batchId}-${Date.now()}`,
          type: 'phase2_complete',
          title: `Data Extraction Complete - ${data.patientName || 'Unknown Patient'}`,
          message: `Extracted data for ${data.extractedFields?.length || 0} fields`,
          batchId: data.batchId,
          extractedFields: data.extractedFields,
          timestamp: new Date(),
          autoDismiss: true
        };

        setNotifications(prev => [notification, ...prev].slice(0, 5));

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          dismissNotification(notification.id);
        }, 5000);
      }

      if (data.type === 'error') {
        const notification = {
          id: `error-${data.batchId || Date.now()}-${Date.now()}`,
          type: 'error',
          title: 'Document Processing Error',
          message: data.message || 'An error occurred during document processing',
          batchId: data.batchId,
          timestamp: new Date(),
          autoDismiss: false
        };

        setNotifications(prev => [notification, ...prev].slice(0, 5));
      }
    };

    socket.on('batchStatus', handleBatchStatus);

    return () => {
      socket.off('batchStatus', handleBatchStatus);
    };
  }, [socket, dismissNotification]);

  return {
    notifications,
    currentReasoning,
    phase1Complete,
    dismissNotification,
    dismissReasoning
  };
};

export default useDocumentAnalysisNotifications;
