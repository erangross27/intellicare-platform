# Task 11: Optimize getPatientDetails Function

## Current Issue
- Returns ENTIRE patient record including:
  - Full medical history (can be 100+ entries)
  - All conditions, medications, allergies
  - All appointments past and future
  - All documents and lab results
- Single patient can be 10,000+ tokens

## Location
- File: `services/agentServiceV4.js`
- Line: ~13814

## Current Return Structure
```javascript
{
  success: true,
  data: {
    // EVERYTHING about the patient
    _id, firstName, lastName, middleName,
    medicalHistory: [...100+ entries],
    conditions: [...all conditions],
    medications: [...all meds],
    appointments: [...all appointments],
    documents: [...all documents],
    labResults: [...all labs],
    // 50+ more fields
  }
}
```

## Smart Context-Aware Optimization
```javascript
// Base details ALWAYS returned
const baseDetails = {
  _id: patient._id,
  firstName: patient.firstName,
  lastName: patient.lastName,
  age: patient.age,
  gender: patient.gender,
  nationalId: patient.nationalId,
  phone: patient.phone,
  lastVisit: patient.lastVisit,
  primaryProvider: patient.primaryProvider
};

// Add context-specific data based on query
if (context.includes('medical') || context.includes('history')) {
  baseDetails.recentHistory = patient.medicalHistory.slice(-3); // Last 3 entries
  baseDetails.totalHistoryCount = patient.medicalHistory.length;
}

if (context.includes('medication') || context.includes('prescription')) {
  baseDetails.currentMedications = patient.medications.filter(m => m.active);
}

if (context.includes('appointment')) {
  baseDetails.nextAppointment = patient.appointments[0]; // Next one only
}

// Always include summary counts
baseDetails.summary = {
  totalVisits: patient.medicalHistory?.length || 0,
  activeConditions: patient.conditions?.filter(c => c.active).length || 0,
  currentMedications: patient.medications?.filter(m => m.active).length || 0
};
```

## Implementation
```javascript
async getPatientDetails(params, practiceContext, session) {
  // Get full patient data
  const patient = await this.callAPI(...);

  // Smart optimization based on context
  const context = params.context || session.lastMessage || '';

  return {
    success: true,
    data: this.optimizePatientDetails(patient, context),
    fullDataAvailable: true // Flag that more data exists
  };
}
```

## Expected Result
- Default: ~200 tokens (from 10,000+)
- With context: ~500 tokens with relevant data
- User gets what they asked for