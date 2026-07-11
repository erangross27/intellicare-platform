# Context-Aware Function Calling Implementation Guide

## 🎯 Problem Solved
The system now maintains context between function calls, eliminating the need to repeatedly specify which patient/entity the user is referring to. When a user searches for a patient and then says "update the phone", the system knows which patient without asking.

## 🔑 Key Implementation Changes

### 1. Frontend Session Management
**File**: `frontend-vite/src/components/ChatAuth.js`

```javascript
// ✅ CORRECT - Single session ID for entire conversation
const [sessionId] = useState(() => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
});

// Use same sessionId for ALL messages in the conversation
```

### 2. Backend Session Context Structure
**File**: `backend/services/agentServiceV4.js`

```javascript
session = {
  history: [],
  language: null,
  clinicCountry: practiceContext?.country,
  currentContext: {  // NEW: Context tracking
    patientId: null,
    patientName: null,
    lastAction: null,
    lastActionTime: null,
    // Can add more: documentId, appointmentId, etc.
  }
}
```

### 3. Context Update Pattern
After EVERY function execution that involves an entity:

```javascript
updateSessionContext(session, functionName, args, result) {
  const now = Date.now();
  
  switch(functionName) {
    case 'searchPatients':
      if (result.data && result.data.length === 1) {
        session.currentContext = {
          patientId: result.data[0]._id,
          patientName: `${result.data[0].firstName} ${result.data[0].lastName}`,
          lastAction: 'search',
          lastActionTime: now
        };
      }
      break;
      
    case 'addLabResult':
    case 'addMedication':
    case 'addVitalSigns':
      // Keep patient context, update action
      if (session.currentContext?.patientId) {
        session.currentContext.lastAction = functionName;
        session.currentContext.lastActionTime = now;
      }
      break;
  }
}
```

### 4. Function Declaration Pattern
Make primary IDs OPTIONAL when context can provide them:

```javascript
{
  name: "updatePatient",
  parameters: {
    type: "object",
    properties: {
      patientId: { 
        type: "string", 
        description: "Patient ID (optional if context exists)" 
      },
      // other fields...
    },
    required: []  // patientId NOT in required array!
  }
}
```

### 5. Function Implementation Pattern
EVERY function that needs an entity ID should check context:

```javascript
async functionName(params, practiceContext, session) {
  let { patientId, ...otherData } = params;
  
  // 🔴 CRITICAL: Check context if ID not provided
  if (!patientId && session?.currentContext?.patientId) {
    patientId = session.currentContext.patientId;
    console.log(`🎯 Using context: ${session.currentContext.patientName}`);
  }
  
  if (!patientId) {
    throw new Error(practiceContext.language === 'he' 
      ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה'
      : 'Patient ID required. Please search for a patient first');
  }
  
  // Continue with function logic...
}
```

### 6. Main processChatMessage Flow
**CRITICAL**: Must update context after EVERY function execution:

```javascript
async processChatMessage(message, sessionId, language, practiceContext) {
  // ... get or create session ...
  
  // Build model with context-aware instruction
  const systemInstruction = this.getCompleteSystemInstruction(
    session.language, 
    session.clinicCountry, 
    practiceContext,
    session.currentContext  // Pass current context!
  );
  
  // ... process with Gemini ...
  
  if (functionCalls && functionCalls.length > 0) {
    const call = functionCalls[0];
    
    // Execute function
    const result = await this.executeFunction(
      call.name, 
      call.args, 
      practiceContext, 
      session  // Pass session for context!
    );
    
    // 🔴 CRITICAL: Update context after execution
    this.updateSessionContext(session, call.name, call.args, result);
    
    // Add to history
    session.history.push({
      role: 'model',
      parts: [{ functionCall: { name: call.name, args: call.args } }]
    });
    
    session.history.push({
      role: 'function',
      parts: [{ functionResponse: { name: call.name, response: result } }]
    });
  }
}
```

## 📋 Functions Requiring Context Implementation

### Patient-Related Functions (Use patientId from context)
- ✅ `updatePatient` - Already implemented
- ❌ `deletePatient` - Needs context check
- ❌ `getPatientDetails` - Needs context check
- ❌ `addMedicalHistory` - Needs context check
- ❌ `getMedicalHistory` - Needs context check
- ❌ `addLabResult` - Needs context check
- ❌ `getLabResults` - Needs context check
- ❌ `addMedication` - Needs context check
- ❌ `getMedications` - Needs context check
- ❌ `addVitalSigns` - Needs context check
- ❌ `getVitalSigns` - Needs context check
- ❌ `addAllergy` - Needs context check
- ❌ `getAllergies` - Needs context check
- ❌ `addVaccination` - Needs context check
- ❌ `getVaccinations` - Needs context check
- ❌ `uploadDocument` - Needs context check
- ❌ `getDocuments` - Needs context check
- ❌ `scheduleAppointment` - Needs context check
- ❌ `createPrescription` - Needs context check
- ❌ `createReferral` - Needs context check
- ❌ `generatePatientReport` - Needs context check

### Context-Setting Functions (Update context after execution)
- ✅ `searchPatients` - Sets patient context
- ✅ `addPatient` - Sets new patient as context
- ✅ `getPatientDetails` - Sets viewed patient as context
- ❌ `searchDocuments` - Should set document context
- ❌ `searchChatHistory` - Should set chat context
- ❌ `findAvailableSlots` - Should set appointment context

## 🔧 Implementation Template

### For Functions Using Context:
```javascript
async addLabResult(params, practiceContext, session) {
  try {
    // Extract patientId separately
    let { patientId, ...labData } = params;
    
    // Check context if no patientId provided
    if (!patientId && session?.currentContext?.patientId) {
      patientId = session.currentContext.patientId;
      console.log(`🎯 Using context patient: ${session.currentContext.patientName}`);
    }
    
    // Validate patientId exists (either from params or context)
    if (!patientId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה'
        : 'Patient ID required. Please search for a patient first');
    }
    
    // Continue with function logic using patientId...
    const response = await this.callAPI(
      `/medical-data/patients/${patientId}/lab-results`,
      'POST',
      labData,
      practiceContext
    );
    
    return {
      success: true,
      data: response.data,
      message: practiceContext.language === 'he'
        ? '✓ תוצאות המעבדה נוספו בהצלחה'
        : '✓ Lab results added successfully'
    };
    
  } catch (error) {
    // Error handling...
  }
}
```

### For Context Update in updateSessionContext:
```javascript
case 'addLabResult':
  // Maintain patient context, just update action
  if (session.currentContext?.patientId) {
    session.currentContext.lastAction = 'addLabResult';
    session.currentContext.lastActionTime = now;
    console.log(`🎯 Context maintained after adding lab results`);
  }
  break;
```

## 🚨 Critical Rules

1. **Session ID Stability**: Frontend must use ONE session ID for entire conversation
2. **Context Timeout**: Context expires after 5 minutes (configurable)
3. **Context Clarity**: When multiple results found, clear context
4. **Context Priority**: Explicit ID in params overrides context
5. **Context Logging**: Always log when using context for debugging
6. **Error Messages**: Tell user to search first if no context exists

## 📊 Context Flow Example

```
User: "Search for John Smith"
→ searchPatients() 
→ Found 1 result
→ SET CONTEXT: patientId=123, patientName="John Smith"

User: "Update his phone to 555-1234"  
→ updatePatient() 
→ No patientId in params
→ USE CONTEXT: patientId=123
→ Update successful
→ MAINTAIN CONTEXT

User: "Add lab results glucose 95"
→ addLabResult()
→ No patientId in params  
→ USE CONTEXT: patientId=123
→ Lab result added
→ MAINTAIN CONTEXT

User: "Show his medications"
→ getMedications()
→ No patientId in params
→ USE CONTEXT: patientId=123
→ Display medications
→ MAINTAIN CONTEXT
```

## ✅ Testing Checklist

- [ ] Single patient search → Context set correctly
- [ ] Multiple patient search → Context cleared/pending
- [ ] Update without ID → Uses context successfully
- [ ] Add data without ID → Uses context successfully
- [ ] View data without ID → Uses context successfully
- [ ] 5+ minutes pass → Context expires
- [ ] New search → Old context replaced
- [ ] Different sessions → No context mixing
- [ ] Error when no context and no ID provided

## 🔄 Migration Checklist for Existing Functions

For EACH function that uses patientId:
1. [ ] Remove patientId from `required` array in function declaration
2. [ ] Add context check at start of function implementation
3. [ ] Add case in `updateSessionContext` for context maintenance
4. [ ] Update error messages to guide user to search first
5. [ ] Test with and without context

## 📝 Notes

- Context can be extended to include: documentId, appointmentId, medicationId, etc.
- Consider adding multi-entity context (current patient + current document)
- Future: Add context confirmation ("Working with John Smith, correct?")
- Future: Add explicit context clearing command ("forget patient")

---
*Last Updated: 2025-08-15*
*Context Implementation Version: 2.0*
*Coverage: Patient context fully implemented, other entities pending*