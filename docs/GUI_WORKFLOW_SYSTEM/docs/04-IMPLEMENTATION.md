# Implementation Guide - GUI Workflow System

## Prerequisites

### Required Software
- Node.js 20.x or higher
- npm 9.x or higher
- Redis 7.x
- MongoDB 6.x
- Git

### Required npm packages
```bash
# Frontend packages
npm install --save zustand socket.io-client framer-motion @floating-ui/react
npm install --save-dev @types/react @types/node

# Backend packages  
npm install --save socket.io redis ioredis express-session
npm install --save-dev @types/socket.io @types/redis nodemon
```

## Phase 1: Initial Setup (Day 1)

### Step 1.1: Install Dependencies

```bash
# Frontend
cd frontend-vite
npm install zustand@4.4.7 socket.io-client@4.6.0 framer-motion@11.0.0

# Backend
cd ../backend
npm install socket.io@4.6.0 redis@4.6.0 ioredis@5.3.0
```

### Step 1.2: Create Directory Structure

```bash
# Run from project root
mkdir -p GUI_WORKFLOW_SYSTEM/{frontend,backend,config}
cp -r GUI_WORKFLOW_SYSTEM/frontend/* frontend-vite/src/
cp -r GUI_WORKFLOW_SYSTEM/backend/* backend/
```

### Step 1.3: Environment Configuration

Create `.env` file in backend:
```env
# WebSocket Configuration
SOCKET_PORT=3001
SOCKET_CORS_ORIGIN=http://localhost:3000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/intellicare

# Session Configuration
SESSION_SECRET=your-secret-key-here
```

### Step 1.4: Update package.json Scripts

```json
// backend/package.json
{
  "scripts": {
    "dev": "nodemon server.js",
    "dev:workflow": "nodemon workflowServer.js",
    "start": "node server.js",
    "start:workflow": "node workflowServer.js"
  }
}
```

## Phase 2: Core Components (Day 2)

### Step 2.1: Create Zustand Store

```javascript
// frontend-vite/src/stores/workflowStore.js
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const useWorkflowStore = create(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        activeWorkflow: null,
        currentStep: 0,
        completedSteps: [],
        stepData: {},
        isHelperVisible: false,
        
        // Actions
        startWorkflow: (workflow) => set({
          activeWorkflow: workflow,
          currentStep: 0,
          completedSteps: [],
          stepData: {},
          isHelperVisible: true
        }),
        
        advanceStep: () => {
          const { currentStep, activeWorkflow, completedSteps } = get();
          if (currentStep < activeWorkflow.steps.length - 1) {
            set({
              currentStep: currentStep + 1,
              completedSteps: [...completedSteps, currentStep]
            });
          }
        },
        
        jumpToStep: (stepIndex) => set({ 
          currentStep: stepIndex 
        }),
        
        updateStepData: (step, data) => set(state => ({
          stepData: {
            ...state.stepData,
            [step]: { ...state.stepData[step], ...data }
          }
        })),
        
        toggleHelper: () => set(state => ({ 
          isHelperVisible: !state.isHelperVisible 
        })),
        
        completeWorkflow: () => {
          // Save to history
          const workflow = get().activeWorkflow;
          console.log('Workflow completed:', workflow);
          
          // Reset state
          set({
            activeWorkflow: null,
            currentStep: 0,
            completedSteps: [],
            stepData: {},
            isHelperVisible: false
          });
        }
      }),
      {
        name: 'workflow-storage',
        partialize: (state) => ({
          activeWorkflow: state.activeWorkflow,
          currentStep: state.currentStep,
          stepData: state.stepData
        })
      }
    )
  )
);

export default useWorkflowStore;
```

### Step 2.2: Create WorkflowHelper Component

```jsx
// frontend-vite/src/components/workflow/WorkflowHelper.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useWorkflowStore from '../../stores/workflowStore';
import './WorkflowHelper.css';

const WorkflowHelper = ({ onCommandClick }) => {
  const {
    activeWorkflow,
    currentStep,
    isHelperVisible,
    advanceStep,
    jumpToStep,
    toggleHelper
  } = useWorkflowStore();

  if (!isHelperVisible || !activeWorkflow) return null;

  const currentStepData = activeWorkflow.steps[currentStep];
  const progress = ((currentStep + 1) / activeWorkflow.steps.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        className="workflow-helper"
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="workflow-header">
          <h3>{activeWorkflow.name}</h3>
          <button onClick={toggleHelper}>×</button>
        </div>

        {/* Progress */}
        <div className="workflow-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>Step {currentStep + 1} of {activeWorkflow.steps.length}</span>
        </div>

        {/* Steps */}
        <div className="workflow-steps">
          {activeWorkflow.steps.map((step, index) => (
            <div
              key={step.id}
              className={`workflow-step ${
                index === currentStep ? 'current' :
                index < currentStep ? 'completed' : 'pending'
              }`}
              onClick={() => jumpToStep(index)}
            >
              <span className="step-icon">
                {index < currentStep ? '✅' :
                 index === currentStep ? '🔵' : '⭕'}
              </span>
              <span>{step.name}</span>
            </div>
          ))}
        </div>

        {/* Commands */}
        <div className="current-commands">
          <h4>Commands for this step:</h4>
          {currentStepData.commands.map((command, idx) => (
            <div key={idx} className="command-card">
              <div className="command-template">
                <code>{command.template}</code>
                {command.required && <span className="required">Required</span>}
              </div>
              {command.example && (
                <div className="command-example">
                  Example: <code>{command.example}</code>
                </div>
              )}
              <div className="command-actions">
                <button onClick={() => navigator.clipboard.writeText(command.template)}>
                  Copy
                </button>
                <button onClick={() => onCommandClick(command.example || command.template)}>
                  Use
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="workflow-actions">
          <button 
            onClick={() => jumpToStep(currentStep - 1)}
            disabled={currentStep === 0}
          >
            Previous
          </button>
          <button onClick={advanceStep}>
            {currentStep === activeWorkflow.steps.length - 1 ? 'Complete' : 'Next'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WorkflowHelper;
```

### Step 2.3: Create Socket Service

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
    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    
    this.socket = io(SOCKET_URL, {
      auth: { sessionId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.setupListeners();
  }

  setupListeners() {
    this.socket.on('connect', () => {
      this.connected = true;
      console.log('✅ WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('❌ WebSocket disconnected');
    });

    // Workflow events
    this.socket.on('workflow:started', (data) => {
      const { startWorkflow } = useWorkflowStore.getState();
      startWorkflow(data.workflow);
    });

    this.socket.on('workflow:advanced', (data) => {
      const { advanceStep } = useWorkflowStore.getState();
      advanceStep();
    });

    this.socket.on('command:matched', (data) => {
      const { command, stepMatched } = data;
      if (stepMatched) {
        const { advanceStep } = useWorkflowStore.getState();
        advanceStep();
      }
    });

    this.socket.on('workflow:suggestion', (data) => {
      const { workflowId, confidence } = data;
      if (confidence > 0.8) {
        // Show suggestion to user
        console.log(`Suggested workflow: ${workflowId} (${confidence * 100}% confidence)`);
      }
    });
  }

  emit(event, data) {
    if (this.connected && this.socket) {
      this.socket.emit(event, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();
```

## Phase 3: Backend Integration (Day 3)

### Step 3.1: Create Workflow Engine

```javascript
// backend/services/WorkflowEngine.js
const { Server } = require('socket.io');
const Redis = require('ioredis');
const workflows = require('../config/workflows');

class WorkflowEngine {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });

    this.workflows = new Map();
    this.loadWorkflows();
    this.setupHandlers();
  }

  loadWorkflows() {
    // Load workflow definitions
    Object.entries(workflows).forEach(([id, workflow]) => {
      this.workflows.set(id, workflow);
    });
    console.log(`✅ Loaded ${this.workflows.size} workflows`);
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Join user room
      const userId = socket.handshake.auth.sessionId;
      socket.join(`user:${userId}`);

      // Restore session if exists
      this.restoreSession(socket, userId);

      // Event handlers
      socket.on('workflow:start', (data) => this.handleWorkflowStart(socket, data));
      socket.on('workflow:advance', (data) => this.handleWorkflowAdvance(socket, data));
      socket.on('command:execute', (data) => this.handleCommandExecute(socket, data));
      socket.on('workflow:complete', (data) => this.handleWorkflowComplete(socket, data));
      
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
      });
    });
  }

  async handleWorkflowStart(socket, { workflowId }) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      socket.emit('error', { message: 'Workflow not found' });
      return;
    }

    const session = {
      userId: socket.handshake.auth.sessionId,
      workflowId,
      currentStep: 0,
      startedAt: Date.now(),
      data: {}
    };

    // Store in Redis
    await this.redis.setex(
      `workflow:${socket.id}`,
      3600, // 1 hour TTL
      JSON.stringify(session)
    );

    // Emit to client
    socket.emit('workflow:started', { workflow, session });
  }

  async handleWorkflowAdvance(socket, { step }) {
    const sessionKey = `workflow:${socket.id}`;
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) {
      socket.emit('error', { message: 'No active workflow' });
      return;
    }

    const session = JSON.parse(sessionData);
    session.currentStep = step;
    
    await this.redis.setex(sessionKey, 3600, JSON.stringify(session));
    socket.emit('workflow:advanced', { step });
  }

  async handleCommandExecute(socket, { command, stepId }) {
    // Validate command against current step
    const sessionKey = `workflow:${socket.id}`;
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) {
      socket.emit('error', { message: 'No active workflow' });
      return;
    }

    const session = JSON.parse(sessionData);
    const workflow = this.workflows.get(session.workflowId);
    const currentStep = workflow.steps[session.currentStep];

    // Check if command matches current step
    const matched = this.matchCommand(command, currentStep.commands);
    
    if (matched) {
      // Store command data
      session.data[stepId] = command;
      await this.redis.setex(sessionKey, 3600, JSON.stringify(session));
      
      // Check if step is complete
      const stepComplete = this.isStepComplete(currentStep, session.data);
      
      if (stepComplete) {
        socket.emit('command:matched', { 
          command, 
          stepMatched: true,
          autoAdvance: true 
        });
      } else {
        socket.emit('command:matched', { 
          command, 
          stepMatched: true,
          autoAdvance: false 
        });
      }
    }
  }

  matchCommand(input, commands) {
    return commands.some(cmd => {
      const pattern = cmd.template.replace(/\[.*?\]/g, '.*');
      const regex = new RegExp(`^${pattern}$`, 'i');
      return regex.test(input);
    });
  }

  isStepComplete(step, data) {
    const requiredCommands = step.commands.filter(c => c.required);
    return requiredCommands.every(cmd => {
      // Check if we have data for this command
      return Object.values(data).some(value => {
        const pattern = cmd.template.replace(/\[.*?\]/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(value);
      });
    });
  }

  async restoreSession(socket, userId) {
    const sessionKey = `workflow:${socket.id}`;
    const session = await this.redis.get(sessionKey);
    
    if (session) {
      const data = JSON.parse(session);
      const workflow = this.workflows.get(data.workflowId);
      socket.emit('workflow:restored', { workflow, session: data });
    }
  }
}

module.exports = WorkflowEngine;
```

### Step 3.2: Integrate with Express Server

```javascript
// backend/server.js - Add these lines
const { createServer } = require('http');
const WorkflowEngine = require('./services/WorkflowEngine');

// After Express app initialization
const httpServer = createServer(app);

// Initialize Workflow Engine
const workflowEngine = new WorkflowEngine(httpServer);

// Change app.listen to httpServer.listen
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
```

## Phase 4: Integration with Chat (Day 4)

### Step 4.1: Update ChatContainer

```jsx
// frontend-vite/src/components/chat/ChatContainer.js
import React, { useEffect, useState } from 'react';
import WorkflowHelper from '../workflow/WorkflowHelper';
import useWorkflowStore from '../../stores/workflowStore';
import socketService from '../../services/socketService';

const ChatContainer = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const { activeWorkflow, isHelperVisible } = useWorkflowStore();

  useEffect(() => {
    // Connect WebSocket
    const sessionId = localStorage.getItem('sessionId');
    socketService.connect(sessionId);

    return () => socketService.disconnect();
  }, []);

  const handleSendMessage = async (text) => {
    // Send to backend
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: text,
        activeWorkflow: activeWorkflow?.id,
        currentStep: activeWorkflow ? useWorkflowStore.getState().currentStep : null
      })
    });

    const data = await response.json();
    setMessages(prev => [...prev, data.message]);

    // Check for workflow intent
    if (data.detectedWorkflow) {
      socketService.emit('workflow:start', { 
        workflowId: data.detectedWorkflow 
      });
    }

    // Check for command match if workflow active
    if (activeWorkflow) {
      socketService.emit('command:execute', {
        command: text,
        stepId: activeWorkflow.steps[useWorkflowStore.getState().currentStep].id
      });
    }
  };

  const handleCommandClick = (command) => {
    setInput(command);
    // Optionally auto-send
    // handleSendMessage(command);
  };

  return (
    <div className="chat-container">
      <div className={`chat-main ${isHelperVisible ? 'with-helper' : ''}`}>
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className="message">
              {msg.text}
            </div>
          ))}
        </div>
        
        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage(input);
                setInput('');
              }
            }}
            placeholder="Type your message..."
          />
        </div>
      </div>

      <WorkflowHelper onCommandClick={handleCommandClick} />
    </div>
  );
};

export default ChatContainer;
```

## Phase 5: Workflow Definitions (Day 5)

### Step 5.1: Create Workflow Config

```javascript
// backend/config/workflows/index.js
module.exports = {
  newPatient: require('./newPatient'),
  patientVisit: require('./patientVisit'),
  labOrder: require('./labOrder'),
  prescription: require('./prescription')
};

// backend/config/workflows/newPatient.js
module.exports = {
  id: 'newPatient',
  name: 'New Patient Registration',
  icon: '📋',
  category: 'Patient Management',
  steps: [
    {
      id: 'basic_info',
      name: 'Basic Information',
      commands: [
        {
          template: 'Add patient [first name] [last name]',
          example: 'Add patient John Smith',
          required: true,
          field: 'name'
        },
        {
          template: 'DOB: [date]',
          example: 'DOB: 01/15/1980',
          required: true,
          field: 'dob'
        },
        {
          template: 'Gender: [M/F/Other]',
          example: 'Gender: M',
          required: true,
          field: 'gender'
        }
      ]
    },
    {
      id: 'contact',
      name: 'Contact Information',
      commands: [
        {
          template: 'Add phone: [number]',
          example: 'Add phone: 555-0123',
          required: true,
          field: 'phone'
        },
        {
          template: 'Add email: [email]',
          example: 'Add email: john@example.com',
          required: false,
          field: 'email'
        },
        {
          template: 'Add address: [address]',
          example: 'Add address: 123 Main St, City, State 12345',
          required: true,
          field: 'address'
        }
      ]
    },
    // ... more steps
  ]
};
```

## Phase 6: Testing & Debugging (Day 6)

### Step 6.1: Test Workflow Flow

```javascript
// backend/test/workflow.test.js
const io = require('socket.io-client');

describe('Workflow System', () => {
  let socket;

  beforeAll((done) => {
    socket = io('http://localhost:5000', {
      auth: { sessionId: 'test-session' }
    });
    socket.on('connect', done);
  });

  afterAll(() => {
    socket.disconnect();
  });

  test('Should start workflow', (done) => {
    socket.emit('workflow:start', { workflowId: 'newPatient' });
    
    socket.on('workflow:started', (data) => {
      expect(data.workflow).toBeDefined();
      expect(data.workflow.id).toBe('newPatient');
      done();
    });
  });

  test('Should advance step on command match', (done) => {
    socket.emit('command:execute', {
      command: 'Add patient John Smith',
      stepId: 'basic_info'
    });

    socket.on('command:matched', (data) => {
      expect(data.stepMatched).toBe(true);
      done();
    });
  });
});
```

### Step 6.2: Debug Commands

```javascript
// Add to backend WorkflowEngine
if (process.env.NODE_ENV === 'development') {
  this.io.on('connection', (socket) => {
    console.log('📊 Debug Info:', {
      socketId: socket.id,
      userId: socket.handshake.auth.sessionId,
      rooms: Array.from(socket.rooms),
      time: new Date().toISOString()
    });
  });
}
```

## Phase 7: Production Deployment

### Step 7.1: Production Configuration

```javascript
// backend/config/production.js
module.exports = {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.NODE_ENV === 'production' ? {} : undefined
  },
  
  socket: {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true
    },
    transports: ['websocket', 'polling']
  },
  
  session: {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  }
};
```

### Step 7.2: Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3000 3001
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - MONGODB_URI=mongodb://mongo:27017/intellicare
    depends_on:
      - redis
      - mongo
    deploy:
      replicas: 3

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  mongo:
    image: mongo:6
    volumes:
      - mongo-data:/data/db

volumes:
  redis-data:
  mongo-data:
```

## Troubleshooting

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| WebSocket won't connect | Check CORS settings, ensure ports are open |
| Workflow not starting | Verify workflow ID exists in config |
| Commands not matching | Check regex patterns in command templates |
| State not persisting | Ensure Redis is running and connected |
| Helper not appearing | Check Zustand store and isHelperVisible state |

### Debug Mode

Enable debug logging:
```javascript
// Frontend
localStorage.setItem('debug', 'workflow:*');

// Backend
DEBUG=workflow:* npm run dev
```

---

**Continue to:** [API Reference](05-API_REFERENCE.md)