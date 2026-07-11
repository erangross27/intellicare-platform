# IntelliCare Function Calling Architecture Documentation

## Overview
IntelliCare uses Google Gemini 2.5 Flash with function calling capabilities to provide a natural conversation interface that maps to 38+ platform APIs. The system intelligently detects user intent and executes appropriate functions, displaying results in a professional dark-blue split-screen interface.

## Architecture Components

### 1. Frontend Components

#### Chat Interface (`ChatInterfaceDark.js`)
- **Purpose**: Main chat interface with dark blue theme
- **Key Features**:
  - Real-time message display
  - Smart action detection
  - Split-screen triggering based on function results
  - Hebrew/English localization

#### Split-Screen Layout (`ChatLayoutDark.js`)
- **Purpose**: Dynamic split-screen container
- **Components**:
  - Chat panel (left/right based on RTL)
  - Context panel (shows patient, document, lab, medication viewers)
  - Automatic panel management based on action type

#### Viewer Components
- **PatientCardDark**: Simplified patient information display
- **DocumentViewerSimple**: Document viewer with minimal UI
- **LabResultsViewer**: Lab results display
- **MedicationTracker**: Medication management interface

### 2. Backend Services

#### Agent Service V4 (`agentServiceV4.js`)
- **Model**: Gemini 2.5 Flash (`gemini-2.5-flash`)
- **Functions**: 38+ platform functions covering all medical operations
- **Architecture**: Natural conversation with automatic function calling

## Function Categories

### Patient Management (5 functions)
```javascript
- addPatient: Create new patient record
- updatePatient: Update patient information
- deletePatient: Remove patient from system
- searchPatients: Search for patients by query
- getPatientDetails: Get complete patient information
```

### Medical History (2 functions)
```javascript
- addMedicalHistory: Add medical history entry
- getMedicalHistory: Retrieve patient medical history
```

### Document Management (5 functions)
```javascript
- uploadDocument: Upload medical document
- getDocuments: Retrieve patient documents
- analyzeDocument: OCR and AI analysis of documents
- deleteDocument: Remove document
- searchDocuments: Search across all documents
```

### Diagnosis & Treatment (3 functions)
```javascript
- analyzeSymptoms: AI-powered symptom analysis
- recommendTreatment: Treatment recommendations
- checkDrugInteractions: Drug interaction checking
```

### Lab Results & Medical Data (8 functions)
```javascript
- addLabResult: Add lab test results
- getLabResults: Retrieve lab results
- addMedication: Add medication record
- getMedications: Get patient medications
- addVitalSigns: Record vital signs
- getVitalSigns: Get vital signs history
- addAllergy: Add allergy information
- getAllergies: Get patient allergies
```

### Appointments (2 functions)
```javascript
- scheduleAppointment: Schedule patient appointment
- findAvailableSlots: Find available time slots
```

### Chat & Consultation (2 functions)
```javascript
- createChatSession: Start new consultation
- searchChatHistory: Search chat history
```

### User Management (2 functions)
```javascript
- createUser: Create system user
- updateUserRole: Update user permissions
```

### Reports & Analytics (3 functions)
```javascript
- generatePatientReport: Patient reports
- generateClinicReport: Practice statistics
- generateComplianceReport: HIPAA/GDPR compliance
```

### System & Security (3 functions)
```javascript
- runBackup: System backup
- getSystemHealth: Health monitoring
- exportAuditLogs: Audit log export
```

## Function Calling Flow

### 1. User Input Processing
```javascript
User Message → Language Detection → Session Management → Context Building
```

### 2. Gemini Function Selection
```javascript
// Gemini automatically selects appropriate function based on:
- User intent in natural language
- Context from conversation history
- Available function declarations
- System instructions for behavior
```

### 3. Function Execution
```javascript
// Route through executeFunction method
switch(functionName) {
  case 'searchPatients':
    return await this.searchPatients(args, practiceContext);
  // ... other cases
}
```

### 4. Response Handling
```javascript
// Backend returns structured response
{
  success: true,
  data: resultData,
  message: localizedMessage,
  actionTaken: 'searchPatients',
  actionResult: { patients: [...] }
}
```

### 5. Frontend Display Logic
```javascript
// Smart detection in ChatInterfaceDark
if (actionResult) {
  // Trigger split screen
  handleActionResult(actionResult, actionTaken);
  // Show confirmation in chat
  addConfirmationMessage();
} else if (isQuestionOrInput) {
  // Show as chat bubble
  addChatMessage(response);
}
```

## Split-Screen Triggering

### Automatic Detection
The system automatically opens the split-screen when:
1. **Patient Data**: searchPatients, getPatient results
2. **Documents**: getDocuments results
3. **Lab Results**: getLabResults results
4. **Medications**: getMedications results

### Context Management
```javascript
// Global handlers exposed by ChatLayoutDark
window.handlePatientData = (patientData) => {
  setActiveContext('patient');
  setSelectedPatient(patientData);
};
```

## Implementation Examples

### Example 1: Patient Search
```javascript
// User: "חפש מטופל בשם דוד כהן"
// Gemini detects intent and calls:
searchPatients({ query: "דוד כהן" })

// Backend returns:
{
  success: true,
  data: [{ _id: "123", firstName: "דוד", lastName: "כהן", ... }],
  actionTaken: "searchPatients",
  actionResult: { patients: [...] }
}

// Frontend:
// 1. Opens split screen with patient card
// 2. Shows confirmation: "✓ המידע מוצג בחלון הצדדי"
```

### Example 2: Document Upload
```javascript
// User: "העלה מסמך בדיקת דם למטופל"
// Gemini calls:
uploadDocument({ 
  patientId: "123",
  documentType: "lab_result",
  documentName: "בדיקת דם",
  content: fileData
})

// Response handled appropriately
```

## Configuration & Customization

### Language Support
```javascript
// Bilingual function declarations
description: isHebrew 
  ? "חפש מטופלים במערכת"
  : "Search for patients"
```

### Country-Specific Fields
```javascript
// Israeli practice
healthFund: { enum: ["כללית", "מכבי", "מאוחדת", "לאומית"] }
nationalId: "תעודת זהות"

// US practice  
insurance: "Insurance provider"
ssn: "Social Security Number"
```

## Performance Optimization

### 1. Function Declaration Caching
- Functions are declared once per session
- Reused across multiple messages

### 2. Smart Response Handling
- Avoid duplicate API calls
- Cache search results in session

### 3. Minimal UI Updates
- Only update split-screen when needed
- Lazy load viewer components

## Security Considerations

### 1. Authentication
- JWT tokens required for all API calls
- Practice subdomain validation

### 2. Data Isolation
- Multi-tenant database architecture
- Practice-specific data access only

### 3. Audit Logging
- All function calls logged
- HIPAA-compliant audit trail

## Testing Function Calls

### Manual Testing
```javascript
// Test patient search
"חפש מטופל בשם משה"

// Test document analysis  
"נתח את המסמך האחרון שהועלה"

// Test appointment scheduling
"קבע תור למטופל ל-15 באוגוסט"
```

### Automated Testing
```javascript
// Test suite location
backend/tests/test-agent-functions.js

// Run tests
npm test -- --grep "function calling"
```

## Troubleshooting

### Common Issues

1. **Function not triggering**
   - Check function declaration in getAllPlatformFunctions
   - Verify executeFunction switch case
   - Check Gemini model configuration

2. **Split screen not opening**
   - Verify actionResult in response
   - Check window.handlePatientData binding
   - Verify activeContext state update

3. **Wrong language in response**
   - Check session language detection
   - Verify practiceContext.language
   - Check localized message formatting

## Future Enhancements

### Planned Features
1. **Batch Operations**: Process multiple patients at once
2. **Voice Input**: Speech-to-text for hands-free operation
3. **Smart Suggestions**: Predictive function recommendations
4. **Visual Body Diagram**: Interactive symptom mapping
5. **Real-time Collaboration**: Multi-user function execution

### API Expansion
- Telemedicine integration
- Insurance claim processing
- Pharmacy connections
- Wearable device data

## Metrics & Monitoring

### Key Performance Indicators
- Function call success rate: >98%
- Average response time: <2 seconds
- Split-screen load time: <500ms
- User satisfaction: >4.5/5

### Monitoring Points
```javascript
// Log function execution
console.log(`🔧 Executing ${name} with args:`, args);

// Track response time
const startTime = Date.now();
const result = await executeFunction(name, args);
console.log(`⏱️ Function took ${Date.now() - startTime}ms`);
```

## Development Workflow

### Adding New Functions

1. **Define Function Declaration**
```javascript
// In getAllPlatformFunctions
{
  name: "newFunction",
  description: isHebrew ? "תיאור" : "Description",
  parameters: { /* schema */ }
}
```

2. **Add Execution Case**
```javascript
// In executeFunction switch
case 'newFunction':
  return await this.newFunction(args, practiceContext);
```

3. **Implement Function**
```javascript
async newFunction(params, practiceContext) {
  const response = await this.callAPI('/endpoint', 'METHOD', params);
  return { success: true, data: response.data };
}
```

4. **Handle Frontend Display**
```javascript
// In handleActionResult
case 'newFunction':
  window.handleNewContext(actionResult);
  break;
```

## Conclusion

The IntelliCare function calling architecture provides a seamless bridge between natural language conversation and complex medical platform operations. By leveraging Gemini 2.5 Flash's capabilities and a well-designed split-screen interface, the system delivers an intuitive, efficient, and professional medical management experience.

---
*Last Updated: August 15, 2025*
*Version: 1.0*
*Total Functions: 38+*
*Coverage: 100% of platform APIs*