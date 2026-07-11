# Technical Implementation Plan - Workflow Helper System

## Tech Stack & Architecture

### Frontend Stack:
- **React 18** with Hooks
- **Zustand** for state management (lightweight, TypeScript-friendly)
- **Socket.io-client** for real-time backend sync
- **Framer Motion** for smooth animations
- **React Portal** for overlay rendering
- **TailwindCSS** for utility-first styling

### Backend Stack:
- **Node.js/Express** (existing)
- **Socket.io** for WebSocket communication
- **MongoDB** for workflow persistence
- **Redis** for session state caching

---

## 🏗️ Complete Technical Architecture

### 1. State Management with Zustand

```javascript
// frontend-vite/src/stores/workflowStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

const useWorkflowStore = create(
  devtools(
    subscribeWithSelector((set, get) => ({
      // State
      activeWorkflow: null,
      currentStep: 0,
      completedSteps: [],
      workflowHistory: [],
      isHelperVisible: false,
      commands: [],
      userProgress: {},
      
      // Actions
      startWorkflow: (workflowId) => {
        const workflow = workflowTemplates[workflowId];
        set({
          activeWorkflow: workflow,
          currentStep: 0,
          completedSteps: [],
          commands: workflow.steps[0].commands,
          isHelperVisible: true
        });
        
        // Notify backend
        socketService.emit('workflow:start', { workflowId });
      },
      
      advanceStep: () => {
        const { currentStep, activeWorkflow } = get();
        if (currentStep < activeWorkflow.steps.length - 1) {
          const nextStep = currentStep + 1;
          set({
            currentStep: nextStep,
            completedSteps: [...get().completedSteps, currentStep],
            commands: activeWorkflow.steps[nextStep].commands
          });
          
          socketService.emit('workflow:advance', { 
            workflowId: activeWorkflow.id,
            step: nextStep 
          });
        }
      },
      
      jumpToStep: (stepIndex) => {
        const { activeWorkflow } = get();
        set({
          currentStep: stepIndex,
          commands: activeWorkflow.steps[stepIndex].commands
        });
      },
      
      completeWorkflow: () => {
        const { activeWorkflow } = get();
        set({
          workflowHistory: [...get().workflowHistory, {
            ...activeWorkflow,
            completedAt: new Date(),
            steps: get().completedSteps
          }],
          activeWorkflow: null,
          currentStep: 0,
          completedSteps: []
        });
        
        socketService.emit('workflow:complete', { 
          workflowId: activeWorkflow.id 
        });
      }
    }))
  )
);

// Subscribe to step changes
useWorkflowStore.subscribe(
  (state) => state.currentStep,
  (currentStep) => {
    console.log('Step changed to:', currentStep);
    // Update UI, analytics, etc.
  }
);
```

### 2. WebSocket Integration

```javascript
// frontend-vite/src/services/socketService.js
import { io } from 'socket.io-client';
import useWorkflowStore from '../stores/workflowStore';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }
  
  connect(sessionId) {
    this.socket = io('http://localhost:5000', {
      auth: { sessionId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000
    });
    
    this.setupListeners();
  }
  
  setupListeners() {
    // Connection events
    this.socket.on('connect', () => {
      this.connected = true;
      console.log('WebSocket connected');
    });
    
    // Workflow sync from backend
    this.socket.on('workflow:sync', (data) => {
      const { updateWorkflow } = useWorkflowStore.getState();
      updateWorkflow(data);
    });
    
    // Command detection from chat
    this.socket.on('command:detected', (data) => {
      const { command, matchedStep } = data;
      const { currentStep, activeWorkflow } = useWorkflowStore.getState();
      
      // Auto-advance if command matches current step
      if (matchedStep === currentStep) {
        useWorkflowStore.getState().advanceStep();
      }
    });
    
    // Workflow suggestions from AI
    this.socket.on('workflow:suggestion', (data) => {
      const { workflowId, confidence } = data;
      if (confidence > 0.8) {
        // Show suggestion to user
        showWorkflowSuggestion(workflowId);
      }
    });
  }
  
  emit(event, data) {
    if (this.connected) {
      this.socket.emit(event, data);
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

export default new SocketService();
```

### 3. Main Chat Integration

```jsx
// frontend-vite/src/components/chat/ChatContainer.js
import React, { useEffect, useState } from 'react';
import { useWorkflowStore } from '../../stores/workflowStore';
import WorkflowHelper from '../workflow/WorkflowHelper';
import socketService from '../../services/socketService';

const ChatContainer = () => {
  const { 
    activeWorkflow, 
    currentStep, 
    isHelperVisible,
    startWorkflow 
  } = useWorkflowStore();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  useEffect(() => {
    // Connect WebSocket
    socketService.connect(sessionId);
    
    // Listen for workflow triggers in messages
    socketService.socket.on('message:received', (message) => {
      // Check if AI detected workflow intent
      if (message.detectedWorkflow) {
        startWorkflow(message.detectedWorkflow);
      }
    });
    
    return () => socketService.disconnect();
  }, []);
  
  const handleSendMessage = async (text) => {
    // Send to backend
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({ 
        message: text,
        sessionId,
        activeWorkflow: activeWorkflow?.id,
        currentStep
      })
    });
    
    const data = await response.json();
    
    // Check if command matches workflow step
    if (activeWorkflow) {
      const stepCommands = activeWorkflow.steps[currentStep].commands;
      const matched = stepCommands.find(cmd => 
        matchesCommand(text, cmd.template)
      );
      
      if (matched) {
        useWorkflowStore.getState().advanceStep();
      }
    }
    
    setMessages([...messages, data.message]);
  };
  
  // Handle command from WorkflowHelper
  const handleCommandClick = (command) => {
    setInput(command);
    // Optionally auto-send
    // handleSendMessage(command);
  };
  
  return (
    <div className="chat-container">
      <div className={`chat-main ${isHelperVisible ? 'with-helper' : ''}`}>
        <div className="chat-messages">
          {messages.map(msg => (
            <Message key={msg.id} {...msg} />
          ))}
        </div>
        
        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(input)}
            placeholder={
              activeWorkflow 
                ? `Step ${currentStep + 1}: ${activeWorkflow.steps[currentStep].name}`
                : "Type your message..."
            }
          />
        </div>
      </div>
      
      {/* Workflow Helper Sidebar */}
      {isHelperVisible && (
        <WorkflowHelper
          activeWorkflow={activeWorkflow}
          currentStep={currentStep}
          onCommandClick={handleCommandClick}
          onStepJump={(step) => useWorkflowStore.getState().jumpToStep(step)}
          onClose={() => useWorkflowStore.getState().setHelperVisible(false)}
        />
      )}
    </div>
  );
};
```

### 4. Backend Workflow Engine

```javascript
// backend/services/workflowEngine.js
const { Server } = require('socket.io');
const redis = require('redis');
const SecureDataAccess = require('./secureDataAccess');

class WorkflowEngine {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });
    
    this.redisClient = redis.createClient();
    this.workflows = this.loadWorkflows();
    this.activeSessions = new Map();
    
    this.setupSocketHandlers();
  }
  
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      const { sessionId } = socket.handshake.auth;
      
      console.log(`User connected: ${sessionId}`);
      
      // Join session room
      socket.join(`session:${sessionId}`);
      
      // Restore workflow state from Redis
      this.restoreWorkflowState(sessionId, socket);
      
      // Handle workflow events
      socket.on('workflow:start', async (data) => {
        await this.startWorkflow(sessionId, data.workflowId, socket);
      });
      
      socket.on('workflow:advance', async (data) => {
        await this.advanceWorkflow(sessionId, data.step, socket);
      });
      
      socket.on('workflow:complete', async (data) => {
        await this.completeWorkflow(sessionId, data.workflowId, socket);
      });
      
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${sessionId}`);
      });
    });
  }
  
  async startWorkflow(sessionId, workflowId, socket) {
    const workflow = this.workflows[workflowId];
    if (!workflow) return;
    
    const state = {
      workflowId,
      currentStep: 0,
      completedSteps: [],
      startedAt: new Date(),
      data: {}
    };
    
    // Store in Redis for persistence
    await this.redisClient.setex(
      `workflow:${sessionId}`,
      3600, // 1 hour TTL
      JSON.stringify(state)
    );
    
    // Store in memory for fast access
    this.activeSessions.set(sessionId, state);
    
    // Notify all clients in session
    this.io.to(`session:${sessionId}`).emit('workflow:started', {
      workflow,
      state
    });
    
    // Log to audit
    await this.logWorkflowEvent(sessionId, 'workflow_started', {
      workflowId,
      workflowName: workflow.name
    });
  }
  
  async advanceWorkflow(sessionId, stepIndex, socket) {
    const state = this.activeSessions.get(sessionId);
    if (!state) return;
    
    const workflow = this.workflows[state.workflowId];
    const previousStep = workflow.steps[state.currentStep];
    
    // Validate step completion
    const validation = await this.validateStep(
      previousStep,
      state.data
    );
    
    if (!validation.valid) {
      socket.emit('workflow:error', {
        message: validation.message,
        missingFields: validation.missingFields
      });
      return;
    }
    
    // Update state
    state.completedSteps.push(state.currentStep);
    state.currentStep = stepIndex;
    
    // Save to Redis
    await this.redisClient.setex(
      `workflow:${sessionId}`,
      3600,
      JSON.stringify(state)
    );
    
    // Notify clients
    this.io.to(`session:${sessionId}`).emit('workflow:advanced', {
      currentStep: stepIndex,
      completedSteps: state.completedSteps
    });
    
    // Execute any step hooks
    await this.executeStepHooks(workflow.steps[stepIndex], state);
  }
  
  async validateStep(step, data) {
    const validation = { valid: true, missingFields: [] };
    
    // Check required fields
    for (const command of step.commands) {
      if (command.required && !data[command.field]) {
        validation.valid = false;
        validation.missingFields.push(command.field);
      }
    }
    
    // Custom validation
    if (step.validate) {
      const customValidation = await step.validate(data);
      if (!customValidation.valid) {
        validation.valid = false;
        validation.message = customValidation.message;
      }
    }
    
    return validation;
  }
  
  async executeStepHooks(step, state) {
    if (!step.hooks) return;
    
    for (const hook of step.hooks) {
      switch (hook.type) {
        case 'api':
          await this.executeApiHook(hook, state);
          break;
        case 'database':
          await this.executeDatabaseHook(hook, state);
          break;
        case 'notification':
          await this.executeNotificationHook(hook, state);
          break;
      }
    }
  }
  
  detectWorkflowIntent(message) {
    const intents = {
      'new patient': 'newPatient',
      'add patient': 'newPatient',
      'register patient': 'newPatient',
      'patient visit': 'patientVisit',
      'see patient': 'patientVisit',
      'lab order': 'labOrder',
      'order labs': 'labOrder',
      'prescription': 'prescription',
      'prescribe': 'prescription',
      'referral': 'referral',
      'refer patient': 'referral'
    };
    
    const lowercaseMessage = message.toLowerCase();
    
    for (const [phrase, workflowId] of Object.entries(intents)) {
      if (lowercaseMessage.includes(phrase)) {
        return {
          workflowId,
          confidence: 0.9
        };
      }
    }
    
    return null;
  }
}

module.exports = WorkflowEngine;
```

### 5. React Hook for Workflow Integration

```javascript
// frontend-vite/src/hooks/useWorkflow.js
import { useEffect, useCallback } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import socketService from '../services/socketService';

export const useWorkflow = () => {
  const store = useWorkflowStore();
  
  // Auto-detect workflow from chat
  const detectWorkflow = useCallback((message) => {
    const patterns = {
      newPatient: /add.*patient|new.*patient|register.*patient/i,
      patientVisit: /patient.*visit|see.*patient|appointment/i,
      labOrder: /order.*lab|lab.*order|labs/i,
      prescription: /prescribe|prescription|medication/i
    };
    
    for (const [workflowId, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) {
        return workflowId;
      }
    }
    
    return null;
  }, []);
  
  // Handle command execution
  const executeCommand = useCallback((command) => {
    const { activeWorkflow, currentStep } = store;
    
    if (!activeWorkflow) return false;
    
    const currentStepData = activeWorkflow.steps[currentStep];
    const matchedCommand = currentStepData.commands.find(cmd => 
      matchesCommandTemplate(command, cmd.template)
    );
    
    if (matchedCommand) {
      // Extract data from command
      const data = extractDataFromCommand(command, matchedCommand.template);
      
      // Store data
      store.updateStepData(currentStep, data);
      
      // Check if step is complete
      const requiredCommands = currentStepData.commands.filter(c => c.required);
      const allComplete = requiredCommands.every(cmd => 
        store.stepData[currentStep]?.[cmd.field]
      );
      
      if (allComplete) {
        store.advanceStep();
      }
      
      return true;
    }
    
    return false;
  }, [store]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl+W to toggle workflow helper
      if (e.ctrlKey && e.key === 'w') {
        store.toggleHelper();
      }
      
      // Ctrl+Enter to advance step
      if (e.ctrlKey && e.key === 'Enter') {
        store.advanceStep();
      }
      
      // Escape to close workflow
      if (e.key === 'Escape' && store.activeWorkflow) {
        if (confirm('Cancel current workflow?')) {
          store.cancelWorkflow();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [store]);
  
  return {
    ...store,
    detectWorkflow,
    executeCommand
  };
};
```

### 6. Animated Transitions with Framer Motion

```jsx
// frontend-vite/src/components/workflow/AnimatedWorkflowHelper.jsx
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '../../stores/workflowStore';

const AnimatedWorkflowHelper = () => {
  const { isHelperVisible, activeWorkflow, currentStep } = useWorkflowStore();
  
  return (
    <AnimatePresence>
      {isHelperVisible && (
        <motion.div
          className="workflow-helper"
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 300,
            damping: 30 
          }}
        >
          {/* Step Progress Animation */}
          <div className="workflow-steps">
            {activeWorkflow?.steps.map((step, index) => (
              <motion.div
                key={step.id}
                className={`workflow-step ${index === currentStep ? 'active' : ''}`}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  className="step-icon"
                  animate={{
                    scale: index === currentStep ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {getStepIcon(index, currentStep)}
                </motion.div>
                <span>{step.name}</span>
              </motion.div>
            ))}
          </div>
          
          {/* Command Cards with Stagger Animation */}
          <motion.div className="commands-section">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {activeWorkflow?.steps[currentStep].commands.map((cmd, i) => (
                  <motion.div
                    key={i}
                    className="command-card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ 
                      scale: 1.02,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                    }}
                  >
                    <CommandCard command={cmd} />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

### 7. Persistent State with LocalStorage

```javascript
// frontend-vite/src/stores/workflowStore.js - Enhanced with persistence
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useWorkflowStore = create(
  persist(
    (set, get) => ({
      // ... existing state and actions
      
      // Restore workflow on page reload
      restoreWorkflow: () => {
        const saved = localStorage.getItem('workflow-state');
        if (saved) {
          const state = JSON.parse(saved);
          if (state.activeWorkflow) {
            set(state);
            // Reconnect to backend
            socketService.emit('workflow:restore', state);
          }
        }
      }
    }),
    {
      name: 'workflow-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeWorkflow: state.activeWorkflow,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        stepData: state.stepData
      })
    }
  )
);
```

---

## 🚀 Implementation Steps

### Phase 1: Core Setup (Day 1-2)
1. Install dependencies: `zustand`, `socket.io-client`, `framer-motion`
2. Set up Zustand store with workflow state
3. Create basic WorkflowHelper component
4. Integrate with existing ChatContainer

### Phase 2: Backend Integration (Day 3-4)
1. Install `socket.io` on backend
2. Create WorkflowEngine service
3. Set up Redis for state persistence
4. Connect WebSocket to Express server

### Phase 3: Real-time Sync (Day 5)
1. Implement Socket.io event handlers
2. Create command detection logic
3. Sync workflow state between frontend/backend
4. Add auto-advance on command match

### Phase 4: Polish & UX (Day 6-7)
1. Add Framer Motion animations
2. Implement keyboard shortcuts
3. Add localStorage persistence
4. Create workflow analytics

---

## 📦 Package.json Updates

```json
// frontend-vite/package.json
{
  "dependencies": {
    "zustand": "^4.4.7",
    "socket.io-client": "^4.6.0",
    "framer-motion": "^11.0.0",
    "@floating-ui/react": "^0.26.0"
  }
}

// backend/package.json
{
  "dependencies": {
    "socket.io": "^4.6.0",
    "redis": "^4.6.0",
    "ioredis": "^5.3.0"
  }
}
```

This technical implementation provides:
1. **Real-time sync** between chat and workflow helper
2. **Persistent state** across page reloads
3. **Smooth animations** for better UX
4. **WebSocket communication** for instant updates
5. **Modular architecture** that's easy to extend