import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const MedicalSecurityOverlay = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Disable right-click context menu EXCEPT for chat messages and text selection
    const handleContextMenu = (e) => {
      // Allow right-click on chat messages, selected text, inputs, and textareas
      if (e.target.closest('.chat-message-content') ||
          e.target.closest('[class*="message"]') ||
          e.target.closest('[class*="Message"]') ||
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          window.getSelection().toString().length > 0) {
        return; // Allow right-click for copying
      }
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [user]);

  return null;
};

export default MedicalSecurityOverlay;
