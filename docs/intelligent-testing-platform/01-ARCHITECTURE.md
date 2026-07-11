# Technical Architecture - Two-Agent Testing System

## 🎯 Core Concept
Two separate Claude instances with different system prompts having natural conversations to test IntelliCare's 428 medical functions.

## 🔍 How IntelliCare Actually Works

### The Claude Service (agentServiceClaude.js)
```javascript
// Located at: apps/backend-api/services/agentServiceClaude.js

1. User sends message via /api/agent/chat
2. Claude service processes with processChatMessage()
3. Selects relevant functions from 428 available (getCoreFunctions)
4. Sends to Anthropic API with tools parameter
5. Claude decides which tool to call
6. Service executes the function
7. Returns result to Claude for natural language response
```

### Key Components
- **Function Selection**: Line 3049 - `getCoreFunctions()` intelligently picks relevant functions
- **Security Filtering**: Line 835 - `filterFunctionsByContext()` applies role-based access
- **Tool Execution**: Lines 1400-1500 - Handles Claude's tool use responses
- **Session Management**: Maintains conversation context and history

## 🏗️ Two-Agent Architecture

### Agent 1: Test Agent (Medical Professional)
```javascript
class TestAgent {
  constructor(persona) {
    this.anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
    this.persona = persona; // 'doctor', 'nurse', 'secretary'
    this.systemPrompt = this.getSystemPrompt(persona);
    this.functionKnowledge = getAllFunctions(); // Knows all 428
  }
  
  async startConversation(goal) {
    // Initiates natural conversation with IntelliCare
    // Example: "Hi, I need to register a new patient"
  }
  
  async respond(intelliCareMessage) {
    // Processes IntelliCare's response
    // Continues conversation naturally
    // Provides requested information
  }
}
```

### Agent 2: IntelliCare Agent (Production Service)
```javascript
// Uses existing agentServiceClaude.js
// No modifications needed!
// Already handles:
- Function selection
- Parameter validation  
- Execution with error handling
- Natural language responses
```

## 🔄 Conversation Flow

### Example: Testing addPatient Function
```
Test Agent (Doctor):     "I need to register a new patient"
                         ↓ (10-15 seconds)
IntelliCare:            "I'll help you register a new patient. 
                        What's their first name?"
                         ↓ (5-10 seconds)
Test Agent:             "Sarah"
                         ↓ (10-15 seconds)
IntelliCare:            "Thank you. What's Sarah's last name?"
                         ↓ (5-10 seconds)
Test Agent:             "Johnson"
                         ↓ (10-15 seconds)
IntelliCare:            [Continues collecting required fields...]
                         ↓
                        [Eventually calls addPatient function]
                         ↓
                        "Patient Sarah Johnson has been registered 
                        successfully with ID P2024-001"
```

## 🧩 Integration Points

### 1. HTTP Communication
```javascript
// Test agent talks to IntelliCare via API
async sendMessage(message) {
  const response = await axios.post('/api/agent/chat', {
    message,
    sessionId: this.sessionId,
    language: 'en'
  }, {
    headers: this.authHeaders
  });
  
  // WAIT for actual response (10-20 seconds)
  return response.data.message;
}
```

### 2. Session Management
```javascript
// Reuse authentication from test platform
const session = JSON.parse(fs.readFileSync('.session.json'));
this.authHeaders = {
  'Cookie': `sessionToken=${session.sessionCookie}`,
  'X-CSRF-Token': session.csrfToken,
  'X-Practice-Subdomain': session.practiceSubdomain
};
```

### 3. Function Knowledge Sharing
```javascript
// Both agents know the same 428 functions
const functions = require('./all_functions.txt');
const functionDefs = require('./agentServiceV4').getAllPlatformFunctions();
```

## 🎭 System Prompts Design

### Test Agent Prompts
```javascript
const DOCTOR_PROMPT = `
You are a doctor at IntelliCare medical center. You need to use the 
IntelliCare system to manage patients. You know all 428 functions 
available but must accomplish tasks through natural conversation with 
the IntelliCare AI assistant.

When the assistant asks for information, provide realistic medical data.
Be patient - wait for responses before continuing.
Your goal: Successfully execute medical functions to test the system.
`;

const NURSE_PROMPT = `
You are a nurse working at IntelliCare. You regularly use the system
for patient care tasks. You understand all available functions but
interact naturally with the AI assistant.

Provide realistic vital signs, symptoms, and medical observations.
Follow the conversation flow naturally.
`;
```

### IntelliCare Prompt (Existing)
Already defined in agentServiceClaude.js - no changes needed!

## 🐛 Bug Detection Mechanism

### Types of Bugs We'll Find
1. **Missing Parameters**: Function expects fields not documented
2. **Validation Failures**: Backend rejects valid-looking data
3. **Context Loss**: Multi-turn conversations losing state
4. **Permission Issues**: Functions blocked unexpectedly
5. **Execution Errors**: Runtime failures in function code

### Bug Capture
```javascript
class BugDetector {
  detectBugs(conversation) {
    const bugs = [];
    
    // Check for error messages
    if (conversation.includes('error') || conversation.includes('failed')) {
      bugs.push({
        type: 'execution_error',
        function: this.extractFunction(conversation),
        error: this.extractError(conversation)
      });
    }
    
    // Check for validation issues
    if (conversation.includes('invalid') || conversation.includes('required')) {
      bugs.push({
        type: 'validation_error',
        details: this.extractValidation(conversation)
      });
    }
    
    return bugs;
  }
}
```

## 📊 Data Flow

```
Test Agent                 IntelliCare              Backend Functions
    │                           │                           │
    ├── Send Message ──────────>│                           │
    │                           ├── Process with Claude     │
    │                           ├── Select Functions        │
    │                           ├── Claude picks tool ─────>│
    │                           │                           ├── Execute
    │                           │<───── Return result ──────┤
    │<──── Natural Response ────┤                           │
    │                           │                           │
    ├── Continue Conversation ──>│                           │
    │        ...                │         ...                │
```

## 🔐 Security Considerations

### Authentication
- Reuse existing session from test platform
- No need for separate auth implementation
- CSRF tokens handled automatically

### Role-Based Testing
- Test agent persona determines available functions
- Doctor: Full medical functions
- Nurse: Limited prescribing
- Secretary: Administrative only

## 🚀 Performance Expectations

### Response Times
- IntelliCare Response: 10-20 seconds (Claude API + function execution)
- Test Agent Response: 2-5 seconds (simpler decisions)
- Full Conversation: 2-5 minutes per function test

### Concurrency
- Start with sequential testing
- Later: Multiple test agents in parallel
- Respect API rate limits

## 📈 Scalability Plan

### Phase 1: Single Function Tests
- One test agent
- One function at a time
- Manual bug review

### Phase 2: Category Testing
- Test related functions together
- Pattern detection
- Semi-automated bug classification

### Phase 3: Full Automation
- All 428 functions
- Multiple personas
- Automated bug reporting
- Regression testing

## 💾 Data Storage

### Conversation Logs
```json
{
  "testId": "test_2024_001",
  "function": "addPatient",
  "persona": "doctor",
  "conversation": [
    {"role": "test_agent", "message": "...", "timestamp": "..."},
    {"role": "intellicare", "message": "...", "timestamp": "..."}
  ],
  "bugs": [],
  "success": true,
  "duration": 180000
}
```

### Bug Reports
```json
{
  "bugId": "BUG_2024_001",
  "function": "prescribeMedication",
  "type": "missing_parameter",
  "description": "DEA number required but not documented",
  "conversation_context": "...",
  "reproducible": true
}
```

## 🔧 Implementation Technologies

- **Language**: Node.js (matches IntelliCare)
- **AI SDK**: @anthropic-ai/sdk
- **HTTP Client**: axios
- **Session**: Reuse .session.json
- **Logging**: JSON files for analysis

---

*Technical architecture designed for REAL conversation testing, not scripted automation.*