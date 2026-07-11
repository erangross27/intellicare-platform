import secureStorage from '../utils/secureStorage';

/**
 * Cross-tab authentication communication utility
 * Uses BroadcastChannel API with localStorage fallback for Safari
 */

class CrossTabAuthChannel {
  constructor() {
    this.channel = null;
    this.listeners = new Map();
    this.useBroadcastChannel = typeof BroadcastChannel !== 'undefined';
    
    if (this.useBroadcastChannel) {
      // Use BroadcastChannel for modern browsers
      try {
        this.channel = new BroadcastChannel('intellicare_auth');
        this.channel.onmessage = (event) => this.handleMessage(event.data);
        process.env.NODE_ENV !== 'production' && console.log('✅ Using BroadcastChannel for cross-tab communication');
      } catch (err) {
        process.env.NODE_ENV !== 'production' && console.warn('❌ BroadcastChannel failed, falling back to localStorage:', err);
        this.useBroadcastChannel = false;
      }
    }
    
    if (!this.useBroadcastChannel) {
      // Fallback to localStorage + storage events for Safari/older browsers
      process.env.NODE_ENV !== 'production' && console.log('📦 Using localStorage for cross-tab communication');
      window.addEventListener('storage', this.handleStorageEvent.bind(this));
    }
  }
  
  handleMessage(data) {
    if (data && data.type) {
      const listeners = this.listeners.get(data.type) || [];
      listeners.forEach(callback => {
        try {
          callback(data.payload);
        } catch (err) {
          process.env.NODE_ENV !== 'production' && console.error('Error in message handler:', err);
        }
      });
    }
  }
  
  handleStorageEvent(event) {
    // Only handle our specific auth events
    if (event.key === 'intellicare_auth_message' && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        this.handleMessage(data);
        
        // Clean up the message after processing
        setTimeout(() => {
          secureStorage.removeItem('intellicare_auth_message');
        }, 100);
      } catch (err) {
        process.env.NODE_ENV !== 'production' && console.error('Error parsing storage event:', err);
      }
    }
  }
  
  /**
   * Send a message to all tabs
   * @param {string} type - Message type (e.g., 'LOGIN_SUCCESS', 'LOGOUT')
   * @param {any} payload - Data to send
   */
  broadcast(type, payload) {
    const message = {
      type,
      payload,
      timestamp: Date.now(),
      origin: window.location.href
    };
    
    if (this.useBroadcastChannel && this.channel) {
      // Use BroadcastChannel
      this.channel.postMessage(message);
    } else {
      // Use localStorage as fallback
      secureStorage.setItem('intellicare_auth_message', JSON.stringify(message));
      
      // Trigger storage event manually for same tab
      this.handleMessage(message);
      
      // Clean up after a short delay
      setTimeout(() => {
        secureStorage.removeItem('intellicare_auth_message');
      }, 500);
    }
    
    process.env.NODE_ENV !== 'production' && console.log(`📡 Broadcasted ${type} to all tabs`);
  }
  
  /**
   * Listen for a specific message type
   * @param {string} type - Message type to listen for
   * @param {function} callback - Handler function
   * @returns {function} Unsubscribe function
   */
  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    
    this.listeners.get(type).push(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(type) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Clean up resources
   */
  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    
    if (!this.useBroadcastChannel) {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
    
    this.listeners.clear();
  }
}

// Create singleton instance that survives hot module replacement
let authChannel;

// Check if we already have an instance (from a previous HMR update)
if (typeof window !== 'undefined' && window.__crossTabAuthChannel) {
  process.env.NODE_ENV !== 'production' && console.log('♻️ Reusing existing CrossTabAuthChannel from HMR');
  authChannel = window.__crossTabAuthChannel;
} else {
  authChannel = new CrossTabAuthChannel();
  // Store on window to survive HMR
  if (typeof window !== 'undefined') {
    window.__crossTabAuthChannel = authChannel;
  }
}

// ✅ SECURE: Helper functions for server-side session cross-tab sync
export const broadcastLoginSuccess = (userData) => {
  process.env.NODE_ENV !== 'production' && console.log('📢 Broadcasting login success with data (no tokens):', userData);
  authChannel.broadcast('LOGIN_SUCCESS', userData);
  
  // ❌ REMOVED: Token storage (fake client security)
  // ✅ SECURE: Server manages sessions via httpOnly cookies
  
  const { user, practice } = userData;
  
  // ✅ SECURE: Store only non-sensitive preference data
  if (user?.preferredLanguage) {
    secureStorage.setItem('selectedLanguage', user.preferredLanguage);
  }
  if (practice?.subdomain) {
    secureStorage.setItem('practiceSubdomain', practice.subdomain);
  }
  
  // Set the magic login flag with timestamp for cross-tab sync
  secureStorage.setItem('magic_login_completed', Date.now().toString());
  
  // Force storage events for other tabs (doesn't work for same tab)
  try {
    const event = new StorageEvent('storage', {
      key: 'magic_login_completed',
      newValue: Date.now().toString(),
      url: window.location.href,
      storageArea: localStorage
    });
    window.dispatchEvent(event);
  } catch (err) {
    process.env.NODE_ENV !== 'production' && console.log('Could not dispatch storage event:', err);
  }
};

export const broadcastLogout = () => {
  authChannel.broadcast('LOGOUT', {});
};

export const onLoginSuccess = (callback) => {
  return authChannel.on('LOGIN_SUCCESS', callback);
};

export const onLogout = (callback) => {
  return authChannel.on('LOGOUT', callback);
};

export default authChannel;