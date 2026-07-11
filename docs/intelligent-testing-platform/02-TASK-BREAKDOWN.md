# Task Breakdown - Small Actionable Steps

## 🎯 Overview
Each task is designed to take 5-10 minutes. Complete them sequentially for best results.

## 📋 Phase 1: Foundation Tasks (Tasks 1-10)

### Task 1: Verify Environment
**Time**: 5 minutes  
**File**: None  
**Action**: 
```bash
# Check backend is running
curl http://localhost:5000/health

# Check session exists
cat apps/test-platform/.session.json

# Verify Claude API key
cd apps/backend-api
node -e "const kms = require('./services/productionKMS'); kms.initialize().then(() => kms.getInternalKey('CLAUDE_API_KEY')).then(console.log)"
```

### Task 2: Create Test Agent Class Structure
**Time**: 10 minutes  
**File**: `apps/test-platform/src/agents/TestAgent.js`  
**Action**: Create basic class with constructor
```javascript
class TestAgent {
  constructor(persona, apiKey) {
    this.persona = persona;
    this.apiKey = apiKey;
    this.conversation = [];
  }
}
module.exports = TestAgent;
```

### Task 3: Add Anthropic SDK Integration
**Time**: 5 minutes  
**File**: `apps/test-platform/src/agents/TestAgent.js`  
**Action**: Add Anthropic client initialization
```javascript
const Anthropic = require('@anthropic-ai/sdk');
// In constructor:
this.anthropic = new Anthropic({ apiKey: this.apiKey });
```

### Task 4: Create System Prompt Generator
**Time**: 10 minutes  
**File**: `apps/test-platform/src/agents/system-prompts.js`  
**Action**: Create persona-specific prompts
```javascript
const PROMPTS = {
  doctor: "You are a doctor at IntelliCare...",
  nurse: "You are a nurse at IntelliCare...",
  secretary: "You are a medical secretary..."
};
module.exports = { PROMPTS };
```

### Task 5: Implement IntelliCare Communication
**Time**: 10 minutes  
**File**: `apps/test-platform/src/agents/TestAgent.js`  
**Action**: Add sendToIntelliCare method
```javascript
async sendToIntelliCare(message) {
  // Load session
  // Send HTTP request to /api/agent/chat
  // Wait for response (10-20 seconds)
  // Return message
}
```

### Task 6: Add Conversation Management
**Time**: 5 minutes  
**File**: `apps/test-platform/src/agents/TestAgent.js`  
**Action**: Track conversation history
```javascript
addToConversation(role, message) {
  this.conversation.push({
    role,
    message,
    timestamp: new Date()
  });
}
```

### Task 7: Create Claude Response Generator
**Time**: 10 minutes  
**File**: `apps/test-platform/src/agents/TestAgent.js`  
**Action**: Generate test agent responses
```javascript
async generateResponse(intelliCareMessage) {
  const response = await this.anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    messages: this.conversation,
    system: this.systemPrompt
  });
  return response.content[0].text;
}
```

### Task 8: Build Function Knowledge Loader
**Time**: 5 minutes  
**File**: `apps/test-platform/src/knowledge/function-loader.js`  
**Action**: Load all 428 functions
```javascript
function loadAllFunctions() {
  const functions = fs.readFileSync('../backend-api/all_functions.txt');
  return functions.split('\n').filter(f => f.trim());
}
```

### Task 9: Create Bug Detector
**Time**: 10 minutes  
**File**: `apps/test-platform/src/detectors/BugDetector.js`  
**Action**: Detect errors in conversation
```javascript
class BugDetector {
  detectBugs(conversation) {
    // Check for error keywords
    // Extract function names
    // Identify bug patterns
    return bugs;
  }
}
```

### Task 10: Write First Test Script
**Time**: 10 minutes  
**File**: `apps/test-platform/test-single-function.js`  
**Action**: Test one function end-to-end
```javascript
const TestAgent = require('./src/agents/TestAgent');
const agent = new TestAgent('doctor');
await agent.testFunction('searchPatients');
```

## 📋 Phase 2: Enhancement Tasks (Tasks 11-20)

### Task 11: Add Session Authentication
**Time**: 5 minutes  
**File**: `apps/test-platform/src/agents/TestAgent.js`  
**Action**: Load and use session from .session.json
```javascript
loadSession() {
  const session = JSON.parse(fs.readFileSync('.session.json'));
  this.headers = {
    'Cookie': `sessionToken=${session.sessionCookie}`,
    'X-CSRF-Token': session.csrfToken
  };
}
```

### Task 12: Implement Retry Logic
**Time**: 10 minutes  
**File**: `apps/test-platform/src/agents/TestAgent.js`  
**Action**: Handle network failures and timeouts
```javascript
async sendWithRetry(message, retries = 3) {
  // Try sending
  // On failure, wait and retry
  // Return result or throw error
}
```

### Task 13: Create Conversation Logger
**Time**: 5 minutes  
**File**: `apps/test-platform/src/logging/ConversationLogger.js`  
**Action**: Save conversations to files
```javascript
saveConversation(testId, conversation, bugs) {
  const filename = `logs/${testId}.json`;
  fs.writeFileSync(filename, JSON.stringify({
    conversation, bugs, timestamp: new Date()
  }));
}
```

### Task 14: Add Function-Specific Goals
**Time**: 10 minutes  
**File**: `apps/test-platform/src/agents/function-goals.js`  
**Action**: Define test goals per function
```javascript
const GOALS = {
  addPatient: "Register a new patient named Sarah Johnson",
  prescribeMedication: "Prescribe Amoxicillin for bacterial infection",
  scheduleAppointment: "Schedule appointment for tomorrow at 2 PM"
};
```

### Task 15: Implement Wait Timer
**Time**: 5 minutes  
**File**: `apps/test-platform/src/utils/timing.js`  
**Action**: Realistic conversation pacing
```javascript
async waitBetweenMessages() {
  const delay = 10000 + Math.random() * 10000; // 10-20 seconds
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

### Task 16: Create Bug Report Generator
**Time**: 10 minutes  
**File**: `apps/test-platform/src/reports/BugReporter.js`  
**Action**: Format bugs for review
```javascript
generateReport(bugs) {
  // Create markdown report
  // Include conversation context
  // Add reproduction steps
  return reportContent;
}
```

### Task 17: Add Persona Switching
**Time**: 5 minutes  
**File**: `apps/test-platform/src/agents/TestAgent.js`  
**Action**: Change persona mid-test
```javascript
switchPersona(newPersona) {
  this.persona = newPersona;
  this.systemPrompt = getPrompt(newPersona);
}
```

### Task 18: Implement Progress Tracking
**Time**: 5 minutes  
**File**: `apps/test-platform/src/tracking/ProgressTracker.js`  
**Action**: Track testing progress
```javascript
class ProgressTracker {
  constructor(totalFunctions = 428) {
    this.total = totalFunctions;
    this.tested = 0;
    this.bugs = 0;
  }
  
  update(functionName, bugsFound) {
    this.tested++;
    this.bugs += bugsFound;
    console.log(`Progress: ${this.tested}/${this.total}`);
  }
}
```

### Task 19: Create Test Suite Runner
**Time**: 10 minutes  
**File**: `apps/test-platform/run-test-suite.js`  
**Action**: Run multiple function tests
```javascript
async function runTestSuite(functions, persona) {
  const agent = new TestAgent(persona);
  for (const func of functions) {
    await agent.testFunction(func);
    await waitBetweenTests();
  }
}
```

### Task 20: Build Results Dashboard
**Time**: 10 minutes  
**File**: `apps/test-platform/src/dashboard/results.js`  
**Action**: Display test results
```javascript
function displayResults(results) {
  console.log('=== TEST RESULTS ===');
  console.log(`Functions Tested: ${results.tested}`);
  console.log(`Bugs Found: ${results.bugs}`);
  console.log(`Success Rate: ${results.successRate}%`);
}
```

## 📋 Phase 3: Advanced Tasks (Tasks 21-30)

### Task 21: Add Memory Between Tests
**Time**: 10 minutes  
**File**: `apps/test-platform/src/agents/TestAgent.js`  
**Action**: Remember patient IDs across functions
```javascript
class TestMemory {
  constructor() {
    this.patients = {};
    this.appointments = {};
  }
  
  rememberPatient(id, data) {
    this.patients[id] = data;
  }
}
```

### Task 22: Implement Country-Specific Testing
**Time**: 10 minutes  
**File**: `apps/test-platform/src/agents/country-config.js`  
**Action**: Test US vs Israel requirements
```javascript
const COUNTRY_CONFIG = {
  USA: { requireSSN: true, requireDEA: true },
  Israel: { requireNationalId: true, requireHealthFund: true }
};
```

### Task 23: Create Validation Tester
**Time**: 10 minutes  
**File**: `apps/test-platform/src/testers/ValidationTester.js`  
**Action**: Test edge cases and validation
```javascript
testValidation(functionName) {
  // Try invalid data
  // Try missing fields
  // Try edge cases
  return validationBugs;
}
```

### Task 24: Add Performance Monitoring
**Time**: 5 minutes  
**File**: `apps/test-platform/src/monitoring/performance.js`  
**Action**: Track response times
```javascript
measureResponseTime(start, end) {
  const duration = end - start;
  if (duration > 30000) {
    console.warn('Slow response:', duration);
  }
}
```

### Task 25: Build Conversation Analyzer
**Time**: 10 minutes  
**File**: `apps/test-platform/src/analysis/ConversationAnalyzer.js`  
**Action**: Analyze conversation patterns
```javascript
analyzeConversation(conversation) {
  // Count turns
  // Identify confusion points
  // Find repetitive questions
  return analysis;
}
```

### Task 26: Create Bug Database
**Time**: 10 minutes  
**File**: `apps/test-platform/src/database/bugs.json`  
**Action**: Store and query bugs
```javascript
class BugDatabase {
  addBug(bug) { }
  findSimilar(bug) { }
  getByFunction(functionName) { }
}
```

### Task 27: Implement Batch Testing
**Time**: 10 minutes  
**File**: `apps/test-platform/batch-test.js`  
**Action**: Test function categories
```javascript
async function testCategory(category) {
  const functions = getFunctionsByCategory(category);
  await runTestSuite(functions, 'doctor');
}
```

### Task 28: Add Report Export
**Time**: 5 minutes  
**File**: `apps/test-platform/src/exports/exporter.js`  
**Action**: Export results to CSV/JSON
```javascript
exportToCSV(results) {
  // Convert to CSV format
  // Save to file
}
```

### Task 29: Create Regression Tester
**Time**: 10 minutes  
**File**: `apps/test-platform/src/regression/RegressionTester.js`  
**Action**: Re-test fixed bugs
```javascript
retestBug(bugId) {
  // Load original bug
  // Rerun same test
  // Check if fixed
}
```

### Task 30: Build Final Integration
**Time**: 10 minutes  
**File**: `apps/test-platform/index.js`  
**Action**: Complete testing platform
```javascript
// Main entry point
// Load configuration
// Run test suites
// Generate reports
// Display dashboard
```

## 🎓 Tips for Success

1. **Complete tasks in order** - Each builds on previous
2. **Test after each task** - Ensure it works before moving on
3. **Save your work** - Commit after each completed task
4. **Ask for help** - If stuck, review the architecture docs
5. **Real conversation** - Always wait for actual responses

## 📊 Progress Checklist

- [ ] Tasks 1-10: Foundation (Basic agent communication)
- [ ] Tasks 11-20: Enhancement (Full conversation flow)
- [ ] Tasks 21-30: Advanced (Complete testing platform)

## 🚀 Quick Start After All Tasks

```bash
cd apps/test-platform
npm install @anthropic-ai/sdk axios
node test-single-function.js
```

---

*Each task is a small step toward the complete two-agent testing system. No scripts, real conversation!*