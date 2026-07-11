/**
 * Batch Notification Service
 * Handles real-time batch processing notifications including Phase 1 reasoning
 */

import io from 'socket.io-client';

class BatchNotificationService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Initialize WebSocket connection for batch notifications
   */
  connect() {
    if (this.socket && this.connected) {
      console.log('✅ Already connected to batch notification socket');
      return;
    }

    // Use the current window location - frontend dev server will proxy to backend
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port;
    
    const socketUrl = port ? `${protocol}//${host}:${port}` : `${protocol}//${host}`;
    
    console.log('Connecting to batch notification socket at:', socketUrl);
    
    this.socket = io(socketUrl, {
      withCredentials: true,
      transports: ['polling', 'websocket'],
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      autoConnect: true
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('🚀 Connected to batch notification socket');
      this.connected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from batch notification socket:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts === 1 || this.reconnectAttempts % 3 === 0) {
        console.warn(`Batch socket connection attempt ${this.reconnectAttempts}:`, error.message);
      }
    });

    // Batch status events - This is where Phase 1 reasoning comes through!
    this.socket.on('batchStatus', (data) => {
      console.log('📊 Batch status update:', data);
      this.notifyListeners('batchStatus', data);
    });

    // Legacy events (if still used)
    this.socket.on('batch:status', (data) => {
      console.log('📊 Legacy batch status:', data);
      this.notifyListeners('batchStatus', data);
    });
  }

  /**
   * Subscribe to batch events
   * @param {function} callback - Function to call when events occur
   * @returns {function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    
    // Auto-connect if not already connected
    if (!this.connected) {
      this.connect();
    }
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in batch notification listener:', error);
      }
    });
  }

  /**
   * Disconnect from socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.listeners.clear();
    }
  }
}

// Create singleton instance
const batchNotificationService = new BatchNotificationService();

// Auto-connect in browser environment
if (typeof window !== 'undefined') {
  setTimeout(() => {
    batchNotificationService.connect();
  }, 1500); // Slightly later than workflow socket
}

export default batchNotificationService;
