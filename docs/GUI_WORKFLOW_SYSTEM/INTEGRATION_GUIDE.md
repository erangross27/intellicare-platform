# Integration Guide - Adding Workflow System to Existing IntelliCare Platform

## Quick Integration Steps

Since you already have IntelliCare running, here's exactly how to integrate the Workflow Helper:

## Step 1: Install Required Packages (2 minutes)

```bash
# Frontend - Add to your existing frontend-vite
cd frontend-vite
npm install zustand@4.4.7 socket.io-client@4.6.0 framer-motion@11.0.0

# Backend - Add to your existing backend
cd ../backend
npm install socket.io@4.6.0 redis@4.6.0
```

## Step 2: Copy Workflow System Files (1 minute)

```bash
# From IntelliCare root directory
# Copy frontend components
cp -r GUI_WORKFLOW_SYSTEM/frontend/components/* frontend-vite/src/components/
cp -r GUI_WORKFLOW_SYSTEM/frontend/stores/* frontend-vite/src/stores/
cp -r GUI_WORKFLOW_SYSTEM/frontend/services/* frontend-vite/src/services/

# Copy backend services
cp -r GUI_WORKFLOW_SYSTEM/backend/services/* backend/services/
cp -r GUI_WORKFLOW_SYSTEM/config/* backend/config/
```

## Step 3: Update Your ChatContainer.js (5 minutes)

**File:** `frontend-vite/src/components/chat/ChatContainer.js`

Add these imports at the top:
```javascript
import WorkflowHelper from '../workflow/WorkflowHelper';
import useWorkflowStore from '../../stores/workflowStore';
import socketService from '../../services/socketService';
```

Add inside your ChatContainer component:
```javascript
const ChatContainer = () => {
  // ... your existing code ...
  
  // Add these hooks
  const { activeWorkflow, isHelperVisible } = useWorkflowStore();
  
  // Add socket connection in useEffect
  useEffect(() => {
    // Your existing code...
    
    // Add this:
    socketService.connect(sessionId);
    return () => socketService.disconnect();
  }, []);
  
  // Add command handler
  const handleCommandFromHelper = (command) => {
    setInput(command); // Set command in your input field
  };
  
  // In your return statement, add WorkflowHelper:
  return (
    <>
      {/* Your existing chat UI */}
      <div className={`chat-main ${isHelperVisible ? 'with-helper' : ''}`}>
        {/* Your existing chat content */}
      </div>
      
      {/* Add this - Workflow Helper */}
      <WorkflowHelper onCommandClick={handleCommandFromHelper} />
    </>
  );
};
```

Add CSS class to adjust chat width when helper is visible:
```css
/* Add to your ChatContainer.css */
.chat-main.with-helper {
  margin-right: 400px; /* Make room for helper sidebar */
}
```

## Step 4: Update Your Backend server.js (3 minutes)

**File:** `backend/server.js`

Add these lines:
```javascript
// At the top with other imports
const { createServer } = require('http');
const WorkflowEngine = require('./services/WorkflowEngine');

// After your Express app setup
const app = express();
// ... your existing middleware ...

// Replace app.listen with this:
const httpServer = createServer(app);

// Initialize Workflow Engine
const workflowEngine = new WorkflowEngine(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ WebSocket ready for workflows`);
});
```

## Step 5: Update Your Agent Service (5 minutes)

**File:** `backend/services/agentServiceV4.js`

Add workflow detection to your message processing:
```javascript
// In processChatMessage method, add:
async processChatMessage(message, sessionId, language, practiceContext) {
  // Your existing code...
  
  // Add workflow detection
  const detectedWorkflow = this.detectWorkflowIntent(message);
  if (detectedWorkflow) {
    // Include in response
    return {
      ...yourExistingResponse,
      detectedWorkflow: detectedWorkflow.workflowId
    };
  }
  
  // Your existing code continues...
}

// Add this method
detectWorkflowIntent(message) {
  const patterns = {
    'newPatient': /add.*patient|new.*patient|register.*patient/i,
    'patientVisit': /patient.*visit|start.*visit|see.*patient/i,
    'labOrder': /order.*lab|lab.*test|blood.*work/i,
    'prescription': /prescribe|prescription|medication/i
  };
  
  for (const [workflowId, pattern] of Object.entries(patterns)) {
    if (pattern.test(message)) {
      return { workflowId, confidence: 0.9 };
    }
  }
  
  return null;
}
```

## Step 6: Add Workflow Definitions (2 minutes)

Create file: `backend/config/workflows/index.js`
```javascript
module.exports = {
  newPatient: {
    id: 'newPatient',
    name: '📋 New Patient Registration',
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
          }
        ]
      }
      // Add more steps as needed
    ]
  },
  
  patientVisit: {
    id: 'patientVisit',
    name: '🏥 Patient Visit',
    steps: [
      {
        id: 'checkin',
        name: 'Check In',
        commands: [
          {
            template: 'Check in [patient name]',
            example: 'Check in John Smith',
            required: true,
            field: 'patient'
          }
        ]
      },
      {
        id: 'vitals',
        name: 'Record Vitals',
        commands: [
          {
            template: 'BP: [systolic/diastolic]',
            example: 'BP: 120/80',
            required: true,
            field: 'bp'
          },
          {
            template: 'Pulse: [rate]',
            example: 'Pulse: 72',
            required: true,
            field: 'pulse'
          }
        ]
      }
    ]
  }
};
```

## Step 7: Test the Integration (2 minutes)

1. **Start Redis** (if not running):
```bash
redis-server
```

2. **Restart your backend**:
```bash
cd backend
npm run dev
```

3. **Restart your frontend**:
```bash
cd frontend-vite
npm run dev
```

4. **Test workflow detection**:
- Open your app
- Type in chat: "I want to add a new patient"
- The Workflow Helper should slide in from the right!

## That's It! 🎉

The Workflow Helper is now integrated with your existing IntelliCare platform.

## How It Works with Your Existing System:

1. **User types** in your existing chat: "Add new patient"
2. **Your AI agent** (agentServiceV4.js) detects workflow intent
3. **Backend** emits WebSocket event: `workflow:start`
4. **Workflow Helper** slides in showing step-by-step commands
5. **User** copies/clicks commands from helper
6. **Commands** execute in your existing chat system
7. **Helper** auto-advances through steps

## Customization Options:

### Change Helper Position:
```css
/* Right side (default) */
.workflow-helper {
  right: 0;
  width: 400px;
}

/* Left side */
.workflow-helper {
  left: 0;
  width: 400px;
}

/* Bottom */
.workflow-helper {
  bottom: 0;
  height: 300px;
  width: 100%;
}
```

### Disable Auto-open:
```javascript
// In workflowStore.js
startWorkflow: (workflow) => {
  set({
    activeWorkflow: workflow,
    isHelperVisible: false // Don't auto-open
  });
}
```

### Change Workflow Trigger Words:
```javascript
// In agentServiceV4.js - detectWorkflowIntent()
const patterns = {
  'newPatient': /your|custom|triggers/i,
  // Add your patterns
};
```

## Troubleshooting:

| Issue | Solution |
|-------|----------|
| Helper doesn't appear | Check browser console for errors, ensure WebSocket connected |
| Commands don't work | Verify command patterns match your agent's expected format |
| WebSocket errors | Check Redis is running, check CORS settings |
| Styles look wrong | Import WorkflowHelper.css in your main CSS file |

## Need Help?

1. Check browser console for errors
2. Check backend logs for WebSocket connection
3. Verify Redis is running: `redis-cli ping` (should return PONG)
4. Ensure all npm packages installed correctly

The system is designed to work alongside your existing chat without any breaking changes!