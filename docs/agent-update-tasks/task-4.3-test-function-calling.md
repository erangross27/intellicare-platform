# Task 4.3: Test Function Calling API

## 📋 **Task Overview**
**Phase:** 4 (Testing & Validation)  
**Time Estimate:** 15 minutes  
**Risk Level:** HIGH  
**Priority:** CRITICAL  

Critical testing of the Gemini function calling API to ensure that all the schema changes haven't broken the core function calling mechanism that took hours to get working correctly.

## 🎯 **Objective**
Verify that the core function calling system still works perfectly:
- Gemini detects function calls correctly
- `mode: 'ANY'` still forces function calling
- Function call detection logic works (lines 484-534)
- Parameter parsing works with new schemas
- No regression in the critical API structure

## ⚠️ **CRITICAL IMPORTANCE**
This is the **MOST IMPORTANT** test because:
- The function calling API took hours to get right
- Breaking this would make the entire agent non-functional
- The `mode: 'ANY'` configuration is critical
- The detection logic (lines 484-534) must work perfectly

## 📁 **Testing Focus**
**File:** `backend/services/agentService.js`  
**Critical Lines:** 456-482 (API structure), 484-534 (detection logic)  
**Critical Config:** `mode: 'ANY'` in `functionCallingConfig`  

## 🧪 **Critical Test Cases**

### **1. Function Call Detection Tests**

#### **Test 1.1: Basic Function Detection**
```javascript
// Test that Gemini detects function calls vs chat
const testCases = [
  {
    message: "Add a new patient named John Smith",
    expectedAction: "add_patient",
    expectedDetection: true
  },
  {
    message: "Hello, how are you?",
    expectedAction: "chat_only", 
    expectedDetection: false
  },
  {
    message: "Search for patient with ID 123456789",
    expectedAction: "get_patient",
    expectedDetection: true
  },
  {
    message: "What's the weather like?",
    expectedAction: "chat_only",
    expectedDetection: false
  }
];

// For each test case
for (const testCase of testCases) {
  const response = await agent.detectIntentWithGemini(
    testCase.message, 
    "en", 
    [], 
    null
  );
  
  // Critical assertions
  ✅ CRITICAL: response.action === testCase.expectedAction
  ✅ CRITICAL: (response.action !== 'chat_only') === testCase.expectedDetection
}
```

#### **Test 1.2: Function Call Structure Validation**
```javascript
// Test the actual API response structure
const response = await agent.ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: [{
    role: 'user',
    parts: [{ text: 'Add patient named Test User' }]
  }],
  config: {
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY' // ← CRITICAL: This must work
      }
    },
    tools: [{
      functionDeclarations: [
        agent.addPatientFunction // ← CRITICAL: New schema must work
      ]
    }],
    temperature: 0.1
  }
});

// Critical validations
✅ CRITICAL: response exists
✅ CRITICAL: response.candidates exists
✅ CRITICAL: Function call detected in response
✅ CRITICAL: Parameters parsed correctly
```

### **2. Parameter Parsing Tests**

#### **Test 2.1: New Schema Parameter Parsing**
```javascript
// Test that new schema parameters are parsed correctly
const testMessage = "Add patient: firstName=John, lastName=Smith, dateOfBirth=1985-03-15, nationalId=123456789";

const response = await agent.detectIntentWithGemini(testMessage, "en", [], null);

// Critical validations
✅ CRITICAL: response.action === "add_patient"
✅ CRITICAL: response.parameters.firstName === "John"
✅ CRITICAL: response.parameters.lastName === "Smith"
✅ CRITICAL: response.parameters.dateOfBirth === "1985-03-15"
✅ CRITICAL: response.parameters.nationalId === "123456789"
```

#### **Test 2.2: Country-Specific Parameters**
```javascript
// Test Israeli parameters
const israeliMessage = "הוסף מטופל: שם פרטי=דוד, שם משפחה=כהן, תעודת זהות=123456789, קופת חולים=מכבי";

const israeliResponse = await agent.detectIntentWithGemini(israeliMessage, "he", [], null);

// Test US parameters  
const usMessage = "Add patient: firstName=John, lastName=Smith, socialSecurityNumber=123-45-6789";

const usResponse = await agent.detectIntentWithGemini(usMessage, "en", [], null);

// Critical validations
✅ CRITICAL: Both responses detect add_patient function
✅ CRITICAL: Parameters parsed correctly for both countries
✅ CRITICAL: No confusion between nationalId and socialSecurityNumber
```

### **3. Function Call Detection Logic Tests**

#### **Test 3.1: Detection Path Validation**
```javascript
// Test the specific detection logic paths (lines 484-534)
const response = await agent.detectIntentWithGemini("Add patient John", "en", [], null);

// Manually check the detection paths
console.log('🔍 Function call detection debug:');
console.log('  - response.functionCalls:', response.functionCalls);
console.log('  - response.candidates:', response.candidates?.[0]?.content?.parts);

// Critical validations
✅ CRITICAL: Function call found via one of the detection paths
✅ CRITICAL: functionCall.name is correct
✅ CRITICAL: functionCall.args or functionCall.arguments exist
✅ CRITICAL: No errors in detection logic
```

#### **Test 3.2: Multiple Function Declarations**
```javascript
// Test that all functions are registered correctly
const allFunctions = [
  agent.addPatientFunction,
  agent.getPatientFunction,
  agent.addHistoryFunction,
  agent.listPatientsFunction,
  agent.uploadDocumentFunction,
  agent.analyzeDocumentFunction,
  agent.getDocumentsFunction,
  agent.getHistoryFunction,
  agent.updateHistoryFunction,
  agent.getDiagnosisFunction,
  agent.chatResponseFunction
];

// Test that each function can be detected
const functionTests = [
  { message: "Add patient", expectedFunction: "add_patient" },
  { message: "Find patient", expectedFunction: "get_patient" },
  { message: "List patients", expectedFunction: "list_patients" },
  { message: "Add medical history", expectedFunction: "add_history" },
  { message: "Get diagnosis", expectedFunction: "get_diagnosis" }
];

for (const test of functionTests) {
  const response = await agent.detectIntentWithGemini(test.message, "en", [], null);
  ✅ CRITICAL: response.action === test.expectedFunction
}
```

### **4. API Configuration Tests**

#### **Test 4.1: Mode ANY Configuration**
```javascript
// Test that mode: 'ANY' is working correctly
const chatMessage = "Hello there"; // Should NOT trigger function call
const functionMessage = "Add patient"; // SHOULD trigger function call

const chatResponse = await agent.detectIntentWithGemini(chatMessage, "en", [], null);
const functionResponse = await agent.detectIntentWithGemini(functionMessage, "en", [], null);

// Critical validations
✅ CRITICAL: chatResponse.action === "chat_only"
✅ CRITICAL: functionResponse.action !== "chat_only"
✅ CRITICAL: Mode ANY is working correctly (not forcing ALL messages to be functions)
```

#### **Test 4.2: Tool Configuration**
```javascript
// Verify the tools configuration is correct
const config = {
  toolConfig: {
    functionCallingConfig: {
      mode: 'ANY'
    }
  },
  tools: [{
    functionDeclarations: [
      agent.addPatientFunction
    ]
  }]
};

// Test that this configuration works
const response = await agent.ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: [{ role: 'user', parts: [{ text: 'Add patient' }] }],
  config: config
});

✅ CRITICAL: Response contains function call
✅ CRITICAL: No API errors
✅ CRITICAL: Configuration accepted by Gemini
```

### **5. Error Handling Tests**

#### **Test 5.1: API Error Handling**
```javascript
// Test error handling in function calling
try {
  const response = await agent.detectIntentWithGemini("Add patient", "en", [], null);
  ✅ CRITICAL: No errors thrown
  ✅ CRITICAL: Response is valid
} catch (error) {
  ❌ CRITICAL FAILURE: Function calling API error: ${error.message}
}
```

#### **Test 5.2: Malformed Function Response**
```javascript
// Test handling of unexpected response formats
// This tests the robustness of the detection logic (lines 484-534)

// Mock a response that might have different structure
const testResponse = {
  candidates: [{
    content: {
      parts: [
        { functionCall: { name: "add_patient", args: { firstName: "Test" } } }
      ]
    }
  }]
};

// Test that detection logic handles this correctly
✅ CRITICAL: Detection logic finds the function call
✅ CRITICAL: Parameters extracted correctly
✅ CRITICAL: No crashes or errors
```

## 📊 **Critical Validation Checklist**

### **Core Function Calling**
- [ ] `mode: 'ANY'` configuration works
- [ ] Function calls detected correctly
- [ ] Chat messages don't trigger functions inappropriately
- [ ] Function detection logic (lines 484-534) works
- [ ] No API errors or timeouts

### **Schema Compatibility**
- [ ] New patient schema functions work
- [ ] Parameters parsed correctly
- [ ] Both Israeli and US schemas work
- [ ] No parameter confusion between countries

### **Detection Logic**
- [ ] Multiple detection paths work
- [ ] Function names detected correctly
- [ ] Parameters extracted properly
- [ ] Error handling works

### **API Structure**
- [ ] generateContent API call works
- [ ] Tool configuration accepted
- [ ] Function declarations valid
- [ ] Response parsing works

## 🚨 **CRITICAL FAILURE SCENARIOS**

### **Scenario 1: Function Calling Stops Working**
```
Symptoms: All messages return chat_only
Cause: API structure broken or mode: 'ANY' not working
Impact: CRITICAL - Agent completely non-functional
Action: IMMEDIATE ROLLBACK required
```

### **Scenario 2: Parameter Parsing Broken**
```
Symptoms: Functions detected but parameters empty/wrong
Cause: Schema changes broke parameter extraction
Impact: HIGH - Functions called but fail
Action: Fix parameter schemas immediately
```

### **Scenario 3: Detection Logic Failure**
```
Symptoms: Inconsistent function detection
Cause: Detection logic (lines 484-534) broken
Impact: HIGH - Unreliable function calling
Action: Debug detection paths
```

## ✅ **Success Criteria**
- [ ] **CRITICAL:** Function calling works exactly as before
- [ ] **CRITICAL:** `mode: 'ANY'` configuration functional
- [ ] **CRITICAL:** Detection logic (lines 484-534) works
- [ ] **CRITICAL:** New schemas don't break parameter parsing
- [ ] **CRITICAL:** No regression in API functionality

## 🔄 **If Tests Fail**
1. **STOP immediately** - don't proceed to other tasks
2. **Identify the specific failure** - API, detection, or parsing
3. **Rollback changes** if critical failure
4. **Debug step by step** - test each component
5. **Fix and re-test** before proceeding

## 📝 **Notes**
- This is the **MOST CRITICAL** test in the entire update
- Function calling took hours to get working originally
- Any failure here could break the entire agent
- Test thoroughly before declaring success
- Document any issues immediately
