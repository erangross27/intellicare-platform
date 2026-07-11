import React, { useState, useEffect } from 'react';
import './ToastNotification.css';
import CloseIcon from './icons/CloseIcon';

/**
 * ToastNotification Component
 * Shows temporary notifications for batch completions
 * when user is not in the same chat session
 */
const ToastNotification = ({ notification, onClose, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    setTimeout(() => setIsVisible(true), 10);

    // Auto-hide after duration
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation
    }, duration);

    return () => clearTimeout(hideTimer);
  }, [duration, onClose]);

  if (!notification) return null;

  const handleClick = () => {
    // Open notification center or navigate to results
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div 
      className={`toast-notification ${isVisible ? 'visible' : ''}`}
      onClick={handleClick}
    >
      <div className="toast-icon">
        {notification.type === 'success' ? '✅' : '📊'}
      </div>
      <div className="toast-content">
        <div className="toast-title">
          {notification.title || 'Batch Processing Complete'}
        </div>
        <div className="toast-message">
          {notification.message || 'Documents have been analyzed'}
        </div>
        {notification.fileCount && (
          <div className="toast-stats">
            {notification.successCount}/{notification.fileCount} files processed
          </div>
        )}
      </div>
      <button 
        className="toast-close"
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
};

// Toast Container to manage multiple toasts
export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  // Listen for batch completion events
  useEffect(() => {
    const handleBatchComplete = (event) => {
      const notification = event.detail || event;
      
      // Add new toast
      const newToast = {
        id: `toast_${Date.now()}`,
        ...notification
      };
      
      setToasts(prev => [...prev, newToast]);
    };

    // Listen for custom event
    window.addEventListener('batch_complete_notification', handleBatchComplete);

    return () => {
      window.removeEventListener('batch_complete_notification', handleBatchComplete);
    };
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastNotification
          key={toast.id}
          notification={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastNotification;