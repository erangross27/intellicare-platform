// Utility to ensure chat messages are always copyable
export const enableChatCopy = () => {
  // Override any right-click prevention for chat messages
  const forceEnableCopy = (e) => {
    // Check if the target is within a chat message
    if (e.target.closest('.chat-message-content') ||
        e.target.closest('[class*="message"]') ||
        e.target.closest('[class*="Message"]') ||
        window.getSelection().toString().length > 0) {
      // Stop propagation to prevent other handlers from blocking
      e.stopImmediatePropagation();
    }
  };

  // Add with highest priority (capture phase)
  document.addEventListener('contextmenu', forceEnableCopy, true);

  // Also ensure text selection is enabled
  const enableSelection = () => {
    const chatElements = document.querySelectorAll('.chat-message-content, .chat-message-content *');
    chatElements.forEach(el => {
      el.style.userSelect = 'text';
      el.style.WebkitUserSelect = 'text';
      el.style.MozUserSelect = 'text';
      el.style.msUserSelect = 'text';
    });
  };

  // Enable selection immediately and on any DOM changes
  enableSelection();

  // Use MutationObserver to ensure new messages are also selectable
  const observer = new MutationObserver(() => {
    enableSelection();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Return cleanup function
  return () => {
    document.removeEventListener('contextmenu', forceEnableCopy, true);
    observer.disconnect();
  };
};

// Auto-initialize when the script loads
if (typeof document !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableChatCopy);
  } else {
    enableChatCopy();
  }
}