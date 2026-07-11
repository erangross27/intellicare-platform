# Phase 1: Patient Management Functions

## Overview
Transform all patient-related operations to work through natural conversation.

## 🎯 Objectives
- Enable natural language patient management
- Support Hebrew and English conversations
- Cover all existing patient API endpoints
- Maintain data validation and security

## 📋 Functions to Implement

### 1.1 addPatient
**Purpose**: Add new patient to the system
**Natural Language Examples**:
- "Add a new patient named John Smith"
- "הוסף מטופל חדש בשם דוד כהן"
- "Register patient: Sarah Johnson, born 1985"

**Function Declaration**:
```javascript
{
  name: "addPatient",
  description: "Add a new patient to the system",
  parameters: {
    type: "object",
    properties: {
      firstName: { type: "string", description: "First name" },
      lastName: { type: "string", description: "Last name" },
      dateOfBirth: { type: "string", description: "Date of birth (YYYY-MM-DD)" },
      country: { type: "string", enum: ["Israel", "USA", "Other"] },
      // ... all other patient fields
    },
    required: ["firstName", "lastName", "dateOfBirth", "country"]
  }
}
```

**API Mapping**: `POST /api/patients`
**Implementation Status**: ✅ Already implemented in V3

### 1.2 updatePatient
**Purpose**: Update existing patient information
**Natural Language Examples**:
- "Update John Smith's phone number to 555-1234"
- "עדכן את הטלפון של דוד כהן"
- "Change Sarah's email address"

**Function Declaration**:
```javascript
{
  name: "updatePatient",
  description: "Update existing patient information",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      firstName: { type: "string", description: "First name (optional)" },
      lastName: { type: "string", description: "Last name (optional)" },
      phone: { type: "string", description: "Phone number (optional)" },
      email: { type: "string", description: "Email address (optional)" },
      // ... other updatable fields
    },
    required: ["patientId"]
  }
}
```

**API Mapping**: `PUT /api/patients/:id`
**Implementation Status**: 🔄 New - Need to implement

### 1.3 deletePatient
**Purpose**: Remove patient from system (soft delete)
**Natural Language Examples**:
- "Delete patient John Smith"
- "מחק את המטופל דוד כהן"
- "Remove Sarah Johnson from the system"

**Function Declaration**:
```javascript
{
  name: "deletePatient",
  description: "Delete patient from system",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      reason: { type: "string", description: "Reason for deletion" }
    },
    required: ["patientId"]
  }
}
```

**API Mapping**: `DELETE /api/patients/:id`
**Implementation Status**: 🔄 New - Need to implement

### 1.4 searchPatients
**Purpose**: Find patients by various criteria
**Natural Language Examples**:
- "Find all patients named Smith"
- "חפש מטופלים עם השם כהן"
- "Show me patients born in 1985"

**Function Declaration**:
```javascript
{
  name: "searchPatients",
  description: "Search for patients in the system",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term" },
      filter: { type: "string", description: "Additional filter (optional)" }
    },
    required: ["query"]
  }
}
```

**API Mapping**: `GET /api/patients/search`
**Implementation Status**: ✅ Already implemented in V3

### 1.5 getPatientDetails
**Purpose**: Retrieve full patient information
**Natural Language Examples**:
- "Show me John Smith's details"
- "הראה לי את הפרטים של דוד כהן"
- "Get patient information for ID 12345"

**Function Declaration**:
```javascript
{
  name: "getPatientDetails",
  description: "Get detailed patient information",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" }
    },
    required: ["patientId"]
  }
}
```

**API Mapping**: `GET /api/patients/:id`
**Implementation Status**: ✅ Already implemented in V3

### 1.6 bulkDeletePatients
**Purpose**: Delete multiple patients at once
**Natural Language Examples**:
- "Delete all patients from test data"
- "מחק את כל המטופלים הישנים"
- "Remove inactive patients"

**Function Declaration**:
```javascript
{
  name: "bulkDeletePatients",
  description: "Delete multiple patients",
  parameters: {
    type: "object",
    properties: {
      patientIds: { type: "array", items: { type: "string" } },
      reason: { type: "string", description: "Reason for bulk deletion" }
    },
    required: ["patientIds", "reason"]
  }
}
```

**API Mapping**: `DELETE /api/patients` (bulk)
**Implementation Status**: 🔄 New - Need to implement

### 1.7 restoreDeletedPatient
**Purpose**: Restore patient from deleted patients
**Natural Language Examples**:
- "Restore John Smith from deleted patients"
- "שחזר את המטופל דוד כהן"
- "Undelete patient ID 12345"

**Function Declaration**:
```javascript
{
  name: "restoreDeletedPatient",
  description: "Restore deleted patient",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Deleted patient ID" }
    },
    required: ["patientId"]
  }
}
```

**API Mapping**: `POST /api/deleted-patients/restore/:id`
**Implementation Status**: 🔄 New - Need to implement

### 1.8 exportPatients
**Purpose**: Export patient data to file
**Natural Language Examples**:
- "Export all patients to Excel"
- "ייצא את כל המטופלים ל-CSV"
- "Create patient backup file"

**Function Declaration**:
```javascript
{
  name: "exportPatients",
  description: "Export patient data",
  parameters: {
    type: "object",
    properties: {
      format: { type: "string", enum: ["csv", "excel", "pdf"] },
      filter: { type: "string", description: "Filter criteria (optional)" }
    },
    required: ["format"]
  }
}
```

**API Mapping**: `GET /api/patients/export`
**Implementation Status**: 🔄 New - Need to implement

## 🔧 Implementation Tasks

### Task 1.1: Extend agentServiceV3 with new functions ✅
- Add updatePatient function declaration
- Add deletePatient function declaration
- Add bulkDeletePatients function declaration
- Add restoreDeletedPatient function declaration
- Add exportPatients function declaration

### Task 1.2: Implement function handlers 🔄
- Create updatePatient handler
- Create deletePatient handler
- Create bulkDeletePatients handler
- Create restoreDeletedPatient handler
- Create exportPatients handler

### Task 1.3: Add system instructions 🔄
- Update Hebrew instructions for all patient functions
- Update English instructions for all patient functions
- Add examples for each function type

### Task 1.4: Create test scenarios 🔄
- Test patient updates via conversation
- Test patient deletion with confirmation
- Test bulk operations
- Test restore functionality
- Test export functionality

## 📊 Success Metrics

- ✅ All 8 patient management functions working
- ✅ Natural conversation for all operations
- ✅ Proper validation and error handling
- ✅ Hebrew and English support
- ✅ >95% function selection accuracy

## 🚀 Natural Conversation Examples

### Updating a Patient
**User**: "Update John Smith's phone number to 555-9876"
**Agent**: "I'll update John Smith's phone number. Let me find his record first."
**Agent**: *[Searches for John Smith, finds patient ID]*
**Agent**: *[Calls updatePatient function with patientId and new phone]*
**Agent**: "✅ John Smith's phone number has been updated to 555-9876."

### Deleting with Confirmation
**User**: "Delete patient Sarah Johnson"
**Agent**: "I found Sarah Johnson (ID: 67890). Before I delete her record, can you provide a reason for the deletion?"
**User**: "She moved to another city"
**Agent**: *[Calls deletePatient function with reason]*
**Agent**: "✅ Sarah Johnson has been moved to deleted patients. You can restore her later if needed."

### Bulk Operations
**User**: "Export all diabetic patients to Excel"
**Agent**: "I'll export all patients with diabetes to an Excel file for you."
**Agent**: *[Calls exportPatients with filter for diabetic patients]*
**Agent**: "✅ Excel file created with 45 diabetic patients. Download link: [URL]"

## 📝 Implementation Notes

- Use existing patient model validation
- Maintain audit logging for all operations
- Support both MongoDB ObjectId and custom patient IDs
- Implement proper error handling and user feedback
- Consider practice-specific permissions for operations

## 🔄 Status

**Overall Progress**: 40% Complete (2/5 functions implemented)
**Next Steps**: 
1. Implement updatePatient handler
2. Implement deletePatient handler
3. Add bulk operations support
4. Create comprehensive testing

**Last Updated**: August 14, 2025