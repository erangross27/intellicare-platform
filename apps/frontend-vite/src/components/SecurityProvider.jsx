import React, { useEffect } from 'react';
import DOMPurify from 'dompurify';

// Configure DOMPurify globally
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Set all target="_blank" to have rel="noopener"
  if ('target' in node && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const SecurityProvider = ({ children }) => {
  useEffect(() => {
    // Check if we're in development mode (Vite uses import.meta.env)
    const isDev = import.meta.env?.DEV || process.env.NODE_ENV === 'development';

    // In development mode, allow all right-clicks for easier debugging and copying
    if (isDev) {
      console.log('Development mode: Right-click enabled everywhere');
      return; // Don't add any right-click prevention in dev mode
    }

    // Only prevent right-click on truly sensitive areas in production
    const preventRightClick = (e) => {
      // Always allow right-click on chat messages and any text content
      if (e.target.closest('.chat-message-content') ||
          e.target.closest('[class*="message"]') ||
          e.target.closest('[class*="Message"]') ||
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          window.getSelection().toString().length > 0) {
        return; // Allow right-click
      }

      // Only prevent on explicitly marked sensitive elements
      if (e.target.closest('[data-sensitive]')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', preventRightClick);

    // Prevent text selection ONLY on explicitly marked sensitive elements
    document.querySelectorAll('[data-sensitive]').forEach(el => {
      el.style.userSelect = 'none';
    });

    // Clear clipboard on sensitive copy
    document.addEventListener('copy', (e) => {
      if (e.target.closest('[data-sensitive]')) {
        e.clipboardData.setData('text/plain', 'Copying sensitive data is not allowed');
        e.preventDefault();
      }
    });

      // Detect dev tools (basic)
      let devtools = { open: false, orientation: null };
      const threshold = 160;
      setInterval(() => {
        if (window.outerHeight - window.innerHeight > threshold ||
            window.outerWidth - window.innerWidth > threshold) {
          if (!devtools.open) {
            devtools.open = true;
            if (isDev) {
              console.clear();
              console.log('%cSecurity Warning!', 'color: red; font-size: 30px;');
              console.log('%cDo not paste any code here!', 'color: red; font-size: 20px;');
            }
          }
        } else {
          devtools.open = false;
        }
      }, 500);

      return () => {
        if (!isDev) {
          document.removeEventListener('contextmenu', preventRightClick);
        }
      };
    }
  }, []);

  // Global XSS protection
  window.sanitizeHTML = (dirty) => DOMPurify.sanitize(dirty);

  // Override dangerous methods
  const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {
    set: function(value) {
      if (import.meta.env?.DEV) {
        console.warn('innerHTML usage detected - sanitizing');
      }
      originalInnerHTML.set.call(this, DOMPurify.sanitize(value));
    }
  });

  return <>{children}</>;
};

// Secure component wrapper
export const SecureComponent = ({ html, ...props }) => {
  const sanitized = DOMPurify.sanitize(html);
  return <div {...props} dangerouslySetInnerHTML={{ __html: sanitized }} />;
};

export default SecurityProvider;