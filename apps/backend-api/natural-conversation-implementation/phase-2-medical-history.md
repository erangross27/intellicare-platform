# Phase 2: Medical History Management

## Overview
Enable natural conversation for all medical history and record operations.

## 🎯 Objectives
- Natural language medical record management
- Support complex medical data entry through conversation
- Maintain medical data integrity and validation
- Enable easy retrieval and search of medical history

## 📋 Functions to Implement

### 2.1 addMedicalHistory
**Purpose**: Add medical history entry for patient
**Natural Language Examples**:
- "Add a visit record for John Smith on December 1st, diagnosed with hypertension"
- "רשום ביקור עבור דוד כהן - אבחנה: סוכרת"
- "John had a checkup yesterday, everything looks normal"

**Function Declaration**:
```javascript
{
  name: "addMedicalHistory",
  description: "Add medical history entry for patient",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      date: { type: "string", description: "Visit/event date (YYYY-MM-DD)" },
      diagnosis: { type: "string", description: "Primary diagnosis" },
      symptoms: { type: "array", items: { type: "string" }, description: "List of symptoms" },
      treatment: { type: "string", description: "Treatment provided" },
      medications: { type: "array", items: { type: "string" }, description: "Prescribed medications" },
      vitals: {
        type: "object",
        properties: {
          bloodPressure: { type: "string", description: "Blood pressure reading" },
          temperature: { type: "number", description: "Body temperature" },
          heartRate: { type: "number", description: "Heart rate (BPM)" },
          weight: { type: "number", description: "Weight in kg" }
        }
      },
      notes: { type: "string", description: "Additional notes" },
      followUp: { type: "string", description: "Follow-up instructions" }
    },
    required: ["patientId", "date", "diagnosis"]
  }
}
```

**API Mapping**: `POST /api/patients/:id/history`
**Implementation Status**: 🔄 New - Need to implement

### 2.2 getMedicalHistory
**Purpose**: Retrieve patient's medical history
**Natural Language Examples**:
- "Show me John Smith's medical history"
- "הראה לי את ההיסטוריה הרפואית של דוד כהן"
- "Get all visits for Sarah in the last 6 months"

**Function Declaration**:
```javascript
{
  name: "getMedicalHistory",
  description: "Get patient's medical history",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      dateFrom: { type: "string", description: "Start date filter (optional)" },
      dateTo: { type: "string", description: "End date filter (optional)" },
      condition: { type: "string", description: "Filter by condition (optional)" },
      limit: { type: "number", description: "Maximum entries to return" }
    },
    required: ["patientId"]
  }
}
```

**API Mapping**: `GET /api/patients/:id/history`
**Implementation Status**: 🔄 New - Need to implement

### 2.3 updateMedicalHistory
**Purpose**: Update existing medical history entry
**Natural Language Examples**:
- "Update John's last visit - add that he's taking aspirin daily"
- "עדכן את הביקור האחרון של דוד - הוסף כי הוא לוקח מטפורמין"
- "Correct the diagnosis from last week to include anxiety"

**Function Declaration**:
```javascript
{
  name: "updateMedicalHistory",
  description: "Update existing medical history entry",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      entryId: { type: "string", description: "Medical history entry ID" },
      diagnosis: { type: "string", description: "Updated diagnosis" },
      treatment: { type: "string", description: "Updated treatment" },
      medications: { type: "array", items: { type: "string" }, description: "Updated medications" },
      notes: { type: "string", description: "Additional notes" }
    },
    required: ["patientId", "entryId"]
  }
}
```

**API Mapping**: `PUT /api/patients/:id/history/:entryId`
**Implementation Status**: 🔄 New - Need to implement

### 2.4 deleteMedicalHistory
**Purpose**: Remove medical history entry
**Natural Language Examples**:
- "Delete the incorrect entry from John's history"
- "מחק את הרשומה הלא נכונה מההיסטוריה של דוד"
- "Remove last week's visit record"

**Function Declaration**:
```javascript
{
  name: "deleteMedicalHistory",
  description: "Delete medical history entry",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      entryId: { type: "string", description: "Medical history entry ID" },
      reason: { type: "string", description: "Reason for deletion" }
    },
    required: ["patientId", "entryId", "reason"]
  }
}
```

**API Mapping**: `DELETE /api/patients/:id/history/:entryId`
**Implementation Status**: 🔄 New - Need to implement

### 2.5 searchMedicalHistory
**Purpose**: Search across all medical records
**Natural Language Examples**:
- "Find all patients with diabetes diagnosis"
- "חפש את כל המטופלים עם לחץ דם גבוה"
- "Show me all patients taking aspirin"

**Function Declaration**:
```javascript
{
  name: "searchMedicalHistory",
  description: "Search medical history across all patients",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term" },
      searchType: { 
        type: "string", 
        enum: ["diagnosis", "medication", "symptom", "treatment", "all"],
        description: "Type of search"
      },
      dateFrom: { type: "string", description: "Start date filter" },
      dateTo: { type: "string", description: "End date filter" }
    },
    required: ["query"]
  }
}
```

**API Mapping**: `GET /api/medical/search`
**Implementation Status**: 🔄 New - Need to implement

### 2.6 getMedicalSummary
**Purpose**: Generate summary of patient's medical history
**Natural Language Examples**:
- "Give me a summary of John Smith's medical history"
- "צור סיכום רפואי עבור דוד כהן"
- "What's the medical overview for patient 12345?"

**Function Declaration**:
```javascript
{
  name: "getMedicalSummary",
  description: "Generate medical history summary",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      period: { type: "string", description: "Time period (e.g., 'last_year', 'all_time')" },
      includeVitals: { type: "boolean", description: "Include vital signs trends" },
      includeMedications: { type: "boolean", description: "Include medication history" }
    },
    required: ["patientId"]
  }
}
```

**API Mapping**: `GET /api/patients/:id/summary`
**Implementation Status**: 🔄 New - Need to implement

### 2.7 addVitalSigns
**Purpose**: Add vital signs measurement
**Natural Language Examples**:
- "Record John's blood pressure as 120/80"
- "רשום לדוד לחץ דם 130/85"
- "Add vitals: temperature 98.6, heart rate 72"

**Function Declaration**:
```javascript
{
  name: "addVitalSigns",
  description: "Record vital signs for patient",
  parameters: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      date: { type: "string", description: "Measurement date" },
      bloodPressureSystolic: { type: "number", description: "Systolic pressure" },
      bloodPressureDiastolic: { type: "number", description: "Diastolic pressure" },
      temperature: { type: "number", description: "Body temperature" },
      heartRate: { type: "number", description: "Heart rate (BPM)" },
      weight: { type: "number", description: "Weight in kg" },
      height: { type: "number", description: "Height in cm" },
      oxygenSaturation: { type: "number", description: "Oxygen saturation %" },
      notes: { type: "string", description: "Additional notes" }
    },
    required: ["patientId"]
  }
}
```

**API Mapping**: `POST /api/patients/:id/vitals`
**Implementation Status**: 🔄 New - Need to implement

## 🔧 Implementation Tasks

### Task 2.1: Create medical history function declarations 🔄
- Define all 7 medical history functions
- Include comprehensive parameter validation
- Add Hebrew and English descriptions

### Task 2.2: Implement function handlers 🔄
- Create addMedicalHistory handler
- Create getMedicalHistory handler
- Create updateMedicalHistory handler
- Create deleteMedicalHistory handler
- Create searchMedicalHistory handler
- Create getMedicalSummary handler
- Create addVitalSigns handler

### Task 2.3: Enhance system instructions 🔄
- Add medical history conversation patterns
- Include medical terminology handling
- Add validation for medical data

### Task 2.4: Create medical data validation 🔄
- Validate medical dates and formats
- Check medication names against database
- Validate vital sign ranges
- Ensure diagnosis coding compliance

## 📊 Success Metrics

- ✅ All 7 medical history functions implemented
- ✅ Natural medical conversation flow
- ✅ Proper medical data validation
- ✅ Hebrew and English medical terminology
- ✅ HIPAA compliant data handling

## 🚀 Natural Conversation Examples

### Adding Medical History
**User**: "John Smith came in today with chest pain and shortness of breath"
**Agent**: "I'll record this visit for John Smith. Let me get his details."
**Agent**: *[Searches for John Smith]*
**Agent**: "Found John Smith. I'll record today's visit with chest pain and shortness of breath as symptoms. What was the diagnosis?"
**User**: "Possible angina, prescribed nitroglycerin"
**Agent**: *[Calls addMedicalHistory with all details]*
**Agent**: "✅ Medical history recorded: Chest pain and shortness of breath, diagnosed with possible angina, prescribed nitroglycerin."

### Searching Medical Records
**User**: "Show me all patients with diabetes in the last year"
**Agent**: *[Calls searchMedicalHistory with diabetes filter]*
**Agent**: "I found 23 patients diagnosed with diabetes in the last year. Would you like me to show the list or generate a report?"

### Recording Vital Signs
**User**: "Record Sarah's blood pressure as 135/90, heart rate 85"
**Agent**: "I'll record Sarah's vital signs. What's the date for this measurement?"
**User**: "Today"
**Agent**: *[Calls addVitalSigns with current date]*
**Agent**: "✅ Vital signs recorded for Sarah: BP 135/90, HR 85, measured today."

## 🏥 Medical Data Considerations

### Data Validation
- Blood pressure ranges (70-200 systolic, 40-120 diastolic)
- Temperature ranges (95-110°F / 35-43°C)
- Heart rate ranges (40-200 BPM)
- Weight and height reasonable ranges

### Medical Terminology
- Support common medical abbreviations
- Handle both generic and brand medication names
- Support ICD-10 diagnosis codes
- Handle medical units (mg, ml, etc.)

### Privacy and Security
- Audit all medical record access
- Encrypt sensitive medical data
- Maintain HIPAA compliance
- Support patient consent tracking

## 🔄 Status

**Overall Progress**: 0% Complete (0/7 functions implemented)
**Next Steps**: 
1. Design medical history data models
2. Implement addMedicalHistory handler
3. Create medical data validation
4. Add medical terminology support

**Last Updated**: August 14, 2025