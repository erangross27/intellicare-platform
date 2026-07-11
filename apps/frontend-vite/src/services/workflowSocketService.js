// Workflow WebSocket Service
// Handles real-time workflow communication with backend

import io from 'socket.io-client';
import useWorkflowStore from '../stores/workflowStore';

class WorkflowSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  /**
   * Initialize WebSocket connection
   */
  connect() {
    if (this.socket && this.connected) {
      console.log('✅ Already connected to workflow socket');
      return;
    }

    // Check if user is authenticated before attempting connection
    if (!this.shouldAttemptReconnect()) {
      console.log('Workflow socket: No active session, skipping connection');
      return;
    }

    // Use the current window location - frontend dev server will proxy to backend
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port;
    
    // Use the frontend URL - Vite will proxy Socket.IO to backend
    const socketUrl = port ? `${protocol}//${host}:${port}` : `${protocol}//${host}`;
    
    console.log('Connecting to workflow socket at:', socketUrl);
    
    // Connect with session authentication via httpOnly cookies
    this.socket = io(`${socketUrl}/workflows`, {
      withCredentials: true,
      transports: ['polling', 'websocket'], // Start with polling, then upgrade
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      timeout: 20000, // Increase timeout to 20 seconds
      autoConnect: true,
      auth: {
        // Session token will be sent via httpOnly cookie automatically
        clientType: 'workflow-helper'
      }
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  setupEventHandlers() {
    const store = useWorkflowStore.getState();

    // Connection events
    this.socket.on('connect', () => {
      console.log('🚀 Connected to workflow socket');
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // Restore session if workflow was active
      store.restoreSession();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from workflow socket:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      // Only log meaningful errors, not every reconnection attempt
      if (this.reconnectAttempts === 0 || this.reconnectAttempts % 3 === 0) {
        console.warn(`Workflow socket connection attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}:`, error.type || error.message);
      }
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('Workflow socket max reconnection attempts reached - will retry when user is authenticated');
        this.disconnect();
        // Try to reconnect after a delay if user might be authenticated
        setTimeout(() => {
          if (this.shouldAttemptReconnect()) {
            this.reconnectAttempts = 0;
            this.connect();
          }
        }, 30000); // Retry after 30 seconds
      }
    });

    // Workflow events
    this.socket.on('workflow:started', (data) => {
      console.log('📋 Workflow started:', data);
      const { workflow } = data;
      
      if (workflow && workflow.id !== store.activeWorkflow?.id) {
        store.startWorkflow(workflow);
      }
    });

    this.socket.on('workflow:advanced', (data) => {
      console.log('➡️ Workflow advanced:', data);
      const { step, workflowId } = data;
      
      if (workflowId === store.activeWorkflow?.id) {
        store.jumpToStep(step);
      }
    });

    this.socket.on('workflow:completed', (data) => {
      console.log('✅ Workflow completed:', data);
      const { workflowId } = data;
      
      if (workflowId === store.activeWorkflow?.id) {
        store.completeWorkflow();
      }
    });

    this.socket.on('workflow:cancelled', (data) => {
      console.log('❌ Workflow cancelled:', data);
      const { workflowId } = data;
      
      if (workflowId === store.activeWorkflow?.id) {
        store.cancelWorkflow();
      }
    });

    this.socket.on('workflow:stepData', (data) => {
      console.log('📝 Step data received:', data);
      const { workflowId, stepId, data: stepData } = data;
      
      if (workflowId === store.activeWorkflow?.id) {
        store.updateStepData(stepId, stepData);
      }
    });

    this.socket.on('workflow:suggestion', (data) => {
      console.log('💡 Workflow suggestion:', data);
      const { workflow, reason } = data;
      
      // Show suggestion in UI (could trigger a notification)
      if (workflow && !store.activeWorkflow) {
        store.showWorkflowSuggestion(workflow, reason);
      }
    });

    this.socket.on('workflow:error', (error) => {
      console.error('Workflow error:', error);
      // Handle workflow errors
    });

    // Command assistance events
    this.socket.on('command:validated', (data) => {
      console.log('✅ Command validated:', data);
      const { command, isValid, suggestion } = data;
      
      if (!isValid && suggestion) {
        console.log('💡 Suggestion:', suggestion);
        // Could show inline suggestion in chat
      }
    });

    this.socket.on('command:executed', (data) => {
      console.log('⚡ Command executed:', data);
      const { command, result, nextStep } = data;
      
      if (nextStep) {
        store.advanceStep();
      }
    });

    // Help and guidance events
    this.socket.on('help:contextual', (data) => {
      console.log('📚 Contextual help:', data);
      const { help, relatedCommands } = data;
      
      // Display contextual help in workflow helper
      if (help) {
        store.showContextualHelp(help, relatedCommands);
      }
    });

    // User skill tracking
    this.socket.on('skill:levelUp', (data) => {
      console.log('🎉 Skill level up!', data);
      const { newLevel, unlockedFeatures } = data;
      
      store.updateUserLevel(newLevel);
      
      if (unlockedFeatures?.length > 0) {
        console.log('🔓 New features unlocked:', unlockedFeatures);
      }
    });
  }

  /**
   * Emit workflow events to backend
   */
  emit(event, data) {
    if (!this.connected) {
      console.warn('Not connected to workflow socket');
      return;
    }

    this.socket.emit(event, data);
  }

  /**
   * Start a workflow
   */
  startWorkflow(workflowId) {
    this.emit('workflow:start', { workflowId });
  }

  /**
   * Advance to next step
   */
  advanceStep(workflowId, stepId) {
    this.emit('workflow:advance', { workflowId, step: stepId });
  }

  /**
   * Jump to specific step
   */
  jumpToStep(workflowId, stepId) {
    this.emit('workflow:jump', { workflowId, step: stepId });
  }

  /**
   * Update step data
   */
  updateStepData(workflowId, stepId, data) {
    this.emit('workflow:updateStep', { workflowId, stepId, data });
  }

  /**
   * Complete workflow
   */
  completeWorkflow(workflowId, data) {
    this.emit('workflow:complete', { workflowId, data });
  }

  /**
   * Cancel workflow
   */
  cancelWorkflow(workflowId) {
    this.emit('workflow:cancel', { workflowId });
  }

  /**
   * Request help for current step
   */
  requestHelp(workflowId, stepId) {
    this.emit('workflow:help', { workflowId, stepId });
  }

  /**
   * Validate a command
   */
  validateCommand(command, context) {
    this.emit('command:validate', { command, context });
  }

  /**
   * Check if we should attempt to reconnect
   * Only reconnect if there's a valid session
   */
  shouldAttemptReconnect() {
    // Check if there's a session cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name] = cookie.trim().split('=');
      if (name === 'sessionToken') {
        return true;
      }
    }
    return false;
  }

  /**
   * Disconnect from socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Reconnect to socket
   */
  reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }
}

// Create singleton instance
const workflowSocketService = new WorkflowSocketService();

// Auto-connect when imported (but only if authenticated and in browser environment)
if (typeof window !== 'undefined') {
  // Connect after a small delay to ensure auth context is ready
  setTimeout(() => {
    // Only connect if user has a session
    if (workflowSocketService.shouldAttemptReconnect()) {
      workflowSocketService.connect();
    } else {
      console.log('Workflow socket waiting for user authentication');
    }
  }, 1000); // Wait 1 second for auth context to be ready
  
  // Listen for auth state changes (when user logs in)
  window.addEventListener('user-authenticated', () => {
    console.log('User authenticated, connecting workflow socket...');
    workflowSocketService.connect();
  });
  
  // Listen for logout
  window.addEventListener('user-logout', () => {
    console.log('User logged out, disconnecting workflow socket...');
    workflowSocketService.disconnect();
  });
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.workflowSocketService = workflowSocketService;
}

export default workflowSocketService;