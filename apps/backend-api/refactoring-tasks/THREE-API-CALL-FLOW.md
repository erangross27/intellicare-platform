# The ACTUAL 3-API-Call Flow

## 🎯 Complete Flow with All 3 Claude API Calls

```
User: "Add a new patient named John Smith"
    ↓
POST /api/agent/chat (routes/agent.js)
    ↓
agentServiceWrapper.processChatMessage()
    ↓
agentServiceClaude.processChatMessage()
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ API CALL #1: Function Selection (claudeTwoStageSelector)       │
│                                                                 │
│ Purpose: Claude picks which functions are relevant             │
│ Input: User message + ALL 1,400 function NAMES only (minimal)  │
│ Model: Claude Sonnet 4.5                                       │
│ Cost: ~$0.001 (very cheap - only function names sent)          │
│                                                                 │
│ Request:                                                        │
│   messages: ["Add a new patient named John Smith"]             │
│   function_names: [                                            │
│     "listAllPatientsInSystem",                                 │
│     "searchPatientByName",                                     │
│     "addNewPatientToSystem",  ← Claude picks this one          │
│     "updatePatientInformation",                                │
│     "scheduleNewAppointment",                                  │
│     ... 1,395 more names                                       │
│   ]                                                            │
│                                                                 │
│ Response from Claude:                                          │
│   selected_functions: [                                        │
│     "addNewPatientToSystem",                                   │
│     "getPatientDetailedInformation"  (maybe for confirmation)  │
│   ]                                                            │
└─────────────────────────────────────────────────────────────────┘
    ↓
claudeTwoStageSelector returns: ["addNewPatientToSystem", "getPatientDetailedInformation"]
    ↓
agentServiceClaude.buildFunctionDefinitions() - Get FULL definitions for ONLY those 2 functions
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ API CALL #2: Execution Planning (agentServiceClaude)           │
│                                                                 │
│ Purpose: Claude decides exact parameters and execution order   │
│ Input: User message + FULL definitions of 2 selected functions │
│ Model: Claude Sonnet 4.5                                       │
│ Cost: ~$0.02 (cheap - only 2 full function definitions)        │
│                                                                 │
│ Request:                                                        │
│   messages: ["Add a new patient named John Smith"]             │
│   tools: [                                                     │
│     {                                                          │
│       name: "addNewPatientToSystem",                           │
│       description: "Add a new patient to the system",          │
│       parameters: {                                            │
│         type: "object",                                        │
│         properties: {                                          │
│           name: { type: "string", description: "..." },        │
│           dateOfBirth: { type: "string", ... },                │
│           phoneNumber: { type: "string", ... },                │
│           email: { type: "string", ... },                      │
│           address: { type: "object", ... },                    │
│           ... 20 more parameters                               │
│         },                                                     │
│         required: ["name"]                                     │
│       }                                                        │
│     },                                                         │
│     {                                                          │
│       name: "getPatientDetailedInformation",                   │
│       description: "Get detailed patient information",         │
│       parameters: { ... }                                      │
│     }                                                          │
│   ]                                                            │
│                                                                 │
│ Response from Claude (tool_use):                               │
│   {                                                            │
│     type: "tool_use",                                          │
│     name: "addNewPatientToSystem",                             │
│     input: {                                                   │
│       name: "John Smith",                                      │
│       dateOfBirth: null,  // Not provided by user              │
│       phoneNumber: null,                                       │
│       practiceId: "yale"  // From context                      │
│     }                                                          │
│   }                                                            │
└─────────────────────────────────────────────────────────────────┘
    ↓
agentServiceClaude.execute(functionCall, practiceContext)
    ↓
agentServiceV4.executeFunction("addNewPatientToSystem", args)
    ↓
agentServiceV4._executeFunctionInternal(name, args, practiceContext)
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ SWITCH STATEMENT ROUTING (506 cases)                           │
│                                                                 │
│ switch(name) {                                                  │
│   case 'addNewPatientToSystem':                                │
│   case 'addPatient':  // Alias                                 │
│     // ✅ CORRECT - Routes to service                          │
│     return await patientService.addPatient(args, ctx);         │
│                                                                 │
│   case 'scheduleNewAppointment':                               │
│   case 'scheduleAppointment':  // Alias                        │
│     // ❌ BROKEN - Calls this.functionName()                   │
│     return await this.scheduleAppointment(args, ctx);          │
│     // Should be: appointmentService.scheduleAppointment()     │
│                                                                 │
│   ... 504 more cases                                           │
│ }                                                              │
└─────────────────────────────────────────────────────────────────┘
    ↓
patientService.addPatient(args, practiceContext)
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE EXECUTION (patientService.js)                          │
│                                                                 │
│ async addPatient(args, practiceContext, session) {             │
│   // 1. Validate input                                         │
│   if (!args.name) throw new Error('Name required');            │
│                                                                 │
│   // 2. Create secure context                                  │
│   const context = {                                            │
│     serviceId: 'patientService',                               │
│     operation: 'addPatient',                                   │
│     practiceId: practiceContext.subdomain                      │
│   };                                                           │
│                                                                 │
│   // 3. Insert to MongoDB via SecureDataAccess                 │
│   const result = await SecureDataAccess.insert(                │
│     'patients',                                                │
│     {                                                          │
│       name: args.name,                                         │
│       practiceId: practiceContext.subdomain,                   │
│       createdAt: new Date(),                                   │
│       ...args                                                  │
│     },                                                         │
│     context                                                    │
│   );                                                           │
│                                                                 │
│   return {                                                     │
│     success: true,                                             │
│     message: 'Patient added',                                  │
│     data: result                                               │
│   };                                                           │
│ }                                                              │
└─────────────────────────────────────────────────────────────────┘
    ↓
Result bubbles back up to agentServiceClaude
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ API CALL #3: Response Formatting (agentServiceClaude)          │
│                                                                 │
│ Purpose: Claude formats the result into natural language       │
│ Input: Function result + conversation history                  │
│ Model: Claude Sonnet 4.5                                       │
│ Cost: ~$0.01                                                   │
│                                                                 │
│ Request:                                                        │
│   messages: [                                                  │
│     { role: "user", content: "Add patient John Smith" },       │
│     { role: "assistant", content: [                            │
│       { type: "tool_use", name: "addNewPatientToSystem", ... } │
│     ]},                                                        │
│     { role: "user", content: [                                 │
│       {                                                        │
│         type: "tool_result",                                   │
│         tool_use_id: "...",                                    │
│         content: {                                             │
│           success: true,                                       │
│           message: "Patient added",                            │
│           data: { _id: "12345", name: "John Smith", ... }      │
│         }                                                      │
│       }                                                        │
│     ]}                                                         │
│   ]                                                            │
│                                                                 │
│ Response from Claude (text):                                   │
│   "✅ I've successfully added John Smith to the system.         │
│    Patient ID: 12345. Would you like to schedule an            │
│    appointment for them?"                                      │
└─────────────────────────────────────────────────────────────────┘
    ↓
Final response sent to user
```

---

## 📊 Summary: 3 API Calls

| Call | Purpose | Input | Output | Cost |
|------|---------|-------|--------|------|
| **#1** | Function Selection | Message + 1,400 names | 2-10 function names | ~$0.001 |
| **#2** | Execution Planning | Message + 2-10 full definitions | Function call with args | ~$0.02 |
| **#3** | Response Formatting | Result + history | Natural language response | ~$0.01 |
| **Total** | | | | **~$0.031** |

---

## 🎯 Why 3 API Calls?

### Old Way (1 API call):
```
Send ALL 1,400 function definitions to Claude
Cost: $2.50 per request (huge token count!)
Problem: Exceeds 200k token limit sometimes
```

### New Way (3 API calls):
```
Call #1: Send only 1,400 names → Get 2-10 relevant names ($0.001)
Call #2: Send only 2-10 full definitions → Get function call ($0.02)
Call #3: Format result → Get response ($0.01)
Total: $0.031 (98.8% cheaper!)
```

---

## ❌ The Problem: Broken Switch Statement

**After Call #2**, Claude returns:
```javascript
{
  name: "scheduleNewAppointment",
  input: { patientId: "12345", dateTime: "2025-01-10T14:00:00Z", ... }
}
```

**agentServiceV4._executeFunctionInternal()** receives this and does:
```javascript
switch(name) {
  case 'scheduleNewAppointment':
  case 'scheduleAppointment':
    return await this.scheduleAppointment(args, practiceContext);  // ❌ ERROR!
    // Function doesn't exist! It was moved to appointmentService.js
}
```

**Should be:**
```javascript
case 'scheduleNewAppointment':
case 'scheduleAppointment':
  return await appointmentService.scheduleAppointment(args, practiceContext);  // ✅ CORRECT
```

---

## 🔧 What We Need To Fix

**89 broken routes** in the switch statement that call `this.functionName()` instead of `serviceName.functionName()`.

### Examples:

| Current (Broken) | Should Be (Fixed) |
|-----------------|-------------------|
| `this.scheduleAppointment()` | `appointmentService.scheduleAppointment()` |
| `this.processUploadedDocuments()` | `documentService.processUploadedDocuments()` |
| `this.addMedication()` | `medicationService.addMedication()` |
| `this.getProviders()` | `providerService.getProviders()` |
| `this.createUser()` | `userService.createUser()` |

---

## ✅ Solution

Create automated script to fix all 89 broken routes in the switch statement.

**After fix, the complete flow will work:**
```
User Chat
  → API #1: Function Selection (pick relevant functions)
  → API #2: Execution Planning (Claude calls function)
  → Switch Routes Correctly to Service
  → Service Executes
  → API #3: Format Response
  → User sees result
```
