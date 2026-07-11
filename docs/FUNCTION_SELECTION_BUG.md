# Function Selection Bug - "open Hospital discharge summary"

**Date:** October 10, 2025
**Severity:** HIGH - Breaks artifact panel document viewing

## 🐛 Bug Description

When user asks: **"open Hospital discharge summary"** (after asking "Show me medications of David Wilson")

**Expected behavior:**
- Claude should select: `getDischargeSummaries`
- System should fetch discharge summary for David Wilson
- Artifact panel should display discharge summary document

**Actual behavior:**
- Claude selects: `searchPatientsByName`, `getMedicalHistory`
- Wrong functions executed
- Debug output: `📍 [DEBUG] FINAL selectedFunctionNames before return: 2 functions: [ 'searchPatientsByName', 'getMedicalHistory' ]`

## 🔍 Root Cause Analysis

### Current Function Selection Flow:

```
User message: "open Hospital discharge summary"
    ↓
agentServiceClaude.js:processMessage()
    ↓
getCoreFunctions() → calls claudeTwoStageSelector.selectFunctions()
    ↓
Stage 1: Claude Haiku picks function names from list of ~1400 function names
    ↓
Stage 2: Retrieve full definitions for selected functions
    ↓
❌ PROBLEM: Claude selects wrong functions
```

### Why Claude Picks Wrong Functions:

**Issue 1: Vague instruction to Claude**

Current prompt in `claudeTwoStageSelector.js` (lines 122-149):
```javascript
const systemPrompt = `You are a function selector for a medical system. Based on the user's request and conversation history, select the most relevant functions that would be needed to fulfill the request.

Available functions (descriptive names):
${allFunctionNames.join('\n')}

Instructions:
1. Analyze the user's request and conversation context
2. Select ALL functions needed to complete the request (usually 1-5 functions)
3. IMPORTANT: If user asks about appointments/schedule for a patient by name, select BOTH:
   - searchPatientsByName (to find the patient)
   - getAppointments (to check their schedule)
...
```

**Problem:** No specific instruction for "open" requests or document viewing!

**Issue 2: Context confusion**

The user's previous message was "Show me medications of David Wilson", which set the context to "patient: David Wilson". When the user then says "open Hospital discharge summary", Claude thinks:
- User wants to continue getting David Wilson's data
- "Hospital discharge summary" sounds like medical history
- Selects `searchPatientsByName` + `getMedicalHistory`

**Issue 3: Missing context about artifact panel**

The selector doesn't know that:
- This is a request to OPEN/VIEW a document in artifact panel
- Artifact panel needs `getDischargeSummaries` function
- The document should be displayed visually, not just text

## 🎯 Solution

### Fix 1: Add "open/view" instruction to Claude prompt

Update `claudeTwoStageSelector.js` around line 136:

```javascript
Instructions:
1. Analyze the user's request and conversation context
2. Select ALL functions needed to complete the request (usually 1-5 functions)
3. IMPORTANT: If user asks about appointments/schedule for a patient by name, select BOTH:
   - searchPatientsByName (to find the patient)
   - getAppointments (to check their schedule)
4. If user asks for details about a patient by name, select BOTH:
   - searchPatientsByName (to find the patient)
   - getPatientDetails (to get their information)

// ADD THIS NEW INSTRUCTION:
5. IMPORTANT: If user asks to "open", "view", "show", or "display" a specific document type:
   - For "discharge summary" → getDischargeSummaries
   - For "lab results" → getLabResults
   - For "medications" → getMedications
   - For "vital signs" → getVitalSigns
   - For "procedures" → getMedicalProcedures
   - For "imaging" → getImagingReports
   - For "consultation notes" → getConsultationNotes
   - And if patient name is mentioned, also add searchPatientsByName

6. If user says "open [document type]" after previously discussing a patient:
   - Use the context to know which patient
   - Select the appropriate get function for that document type
   - DO NOT select searchPatientsByName again if patient is already known in context
```

### Fix 2: Add document type mapping

Create a helper in `claudeTwoStageSelector.js`:

```javascript
// Map common document requests to function names
const DOCUMENT_TYPE_FUNCTIONS = {
  'discharge summary': 'getDischargeSummaries',
  'hospital discharge': 'getDischargeSummaries',
  'discharge': 'getDischargeSummaries',
  'lab results': 'getLabResults',
  'labs': 'getLabResults',
  'medications': 'getMedications',
  'meds': 'getMedications',
  'vital signs': 'getVitalSigns',
  'vitals': 'getVitalSigns',
  'procedures': 'getMedicalProcedures',
  'imaging': 'getImagingReports',
  'x-ray': 'getImagingReports',
  'ct scan': 'getImagingReports',
  'mri': 'getImagingReports',
  'consultation notes': 'getConsultationNotes',
  'consult': 'getConsultationNotes',
  // AI Clinical Insights
  'clinical decision support': 'getClinicalDecisionSupport',
  'recommendations': 'getIntelligentRecommendations',
  'trending analysis': 'getTrendingAnalysis',
  'trends': 'getTrendingAnalysis',
  'care plan': 'getPatientCarePlan',
  'follow up': 'getFollowUpIntelligence',
  'outcomes': 'getOutcomesPredictions',
  'prognosis': 'getOutcomesPredictions',
  'guidelines': 'getGuidelineCompliance'
};

// Fast-path detection for document viewing
function detectDocumentViewRequest(message) {
  const msgLower = message.toLowerCase();

  // Check for "open", "view", "show", "display" keywords
  if (!/\b(open|view|show|display|get|see)\b/i.test(msgLower)) {
    return null;
  }

  // Check for document type matches
  for (const [documentType, functionName] of Object.entries(DOCUMENT_TYPE_FUNCTIONS)) {
    if (msgLower.includes(documentType)) {
      return functionName;
    }
  }

  return null;
}
```

### Fix 3: Add fast-path for document viewing

In `selectFunctionNames()` method, add fast-path detection BEFORE calling Claude:

```javascript
async selectFunctionNames(messages, context = {}) {
  if (!this.initialized) await this.initialize();

  const lastUserMessage = messages[messages.length - 1]?.content || '';

  // FAST PATH: Detect direct document viewing requests
  const documentFunction = this.detectDocumentViewRequest(lastUserMessage);
  if (documentFunction) {
    console.log(`⚡ FAST PATH: Detected document view request`);
    console.log(`   Document type function: ${documentFunction}`);

    // If we have patient context from previous messages, include search
    const hasPatientInHistory = context.currentContext?.patientId ||
                                messages.slice(-3).some(m =>
                                  m.content?.match(/patient|מטופל|show.*details|get.*info/i)
                                );

    if (hasPatientInHistory && context.currentContext?.patientId) {
      // Patient already known - just return document function
      console.log(`   Patient already in context - returning: [${documentFunction}]`);
      return [documentFunction];
    } else if (hasPatientInHistory) {
      // Need to find patient first
      console.log(`   Need patient search - returning: [searchPatientsByName, ${documentFunction}]`);
      return ['searchPatientsByName', documentFunction];
    }

    // No patient context - just return document function
    return [documentFunction];
  }

  // ... rest of existing code (Claude selection, cache, etc.)
}
```

## 📊 Expected Impact

**Before fix:**
- User: "open Hospital discharge summary"
- Selected: `searchPatientsByName`, `getMedicalHistory` ❌
- Result: Wrong data displayed

**After fix:**
- User: "open Hospital discharge summary"
- Fast-path detects: "discharge summary" → `getDischargeSummaries`
- Context check: Patient "David Wilson" already known from previous message
- Selected: `getDischargeSummaries` ✅
- Result: Correct discharge summary displayed in artifact panel

## 🎯 Implementation Priority

**Priority:** HIGH - Critical for artifact panel functionality

**Files to modify:**
1. `/apps/backend-api/services/claudeTwoStageSelector.js` - Add fast-path detection
2. Test with various document type requests

**Testing scenarios:**
1. "show me medications of David Wilson" → "open Hospital discharge summary"
2. "open lab results for Sarah Johnson"
3. "view vital signs"
4. "display clinical decision support for Michael Chen"

## 💡 Additional Improvements

### Improvement 1: Add artifact panel awareness

When artifact panel is open, prioritize functions that return documents for display:
- If artifact showing categories → Return category list
- If artifact showing document list → Return documents for that category
- If artifact showing document detail → Return specific document

### Improvement 2: Add conversation context tracking

Track what the user is currently viewing:
```javascript
session.artifactContext = {
  panelOpen: true,
  level: 'document', // 'categories' | 'documents' | 'document'
  category: 'hospital_discharge_summaries',
  patientId: ObjectId("...")
};
```

Use this context to improve function selection:
- If user says "show more" → Get more documents in current category
- If user says "go back" → Return to category list
- If user says "open #2" → Open document #2 from current list

## 🔧 Quick Fix (Minimal Change)

If we want to fix this quickly with minimal changes:

**Option 1: Add to Claude prompt** (5 lines)
```javascript
// In claudeTwoStageSelector.js, line 136
5. If user asks to "open" or "view" a document type:
   - "discharge" → getDischargeSummaries
   - "labs" → getLabResults
   - "meds" → getMedications
   - Use context to determine which patient
```

**Option 2: Add keyword detection** (15 lines)
```javascript
// Before Claude API call, check for document viewing
if (message.match(/\bopen\b.*\bdischarge\b/i)) {
  return ['getDischargeSummaries'];
}
```

**Recommended:** Implement full fast-path solution (Fix 3 above) for robustness.
