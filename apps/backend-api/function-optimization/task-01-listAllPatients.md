# Task 01: Optimize listAllPatients Function

## Current Issue
- Returns FULL patient records with 50+ fields per patient
- Causes 34,095 tokens for 100 patients
- Takes 15-20 seconds for Claude to process

## Location
- File: `services/agentServiceV4.js`
- Line: ~13595
- Route: Also affects `/api/patients` GET endpoint

## Current Return Structure
```javascript
{
  success: true,
  data: [/* Full patient objects */],
  count: patients.length,
  message: "Showing X patients",
  displayData: { patients: [/* Full objects again */] }
}
```

## Required Optimization
Return only essential fields:
```javascript
{
  _id: patient._id,
  firstName: patient.firstName,
  lastName: patient.lastName,
  nationalId: patient.nationalId || patient.ssn,
  phoneNumber: patient.phone,
  age: patient.age,
  gender: patient.gender
}
```

## Implementation Steps
1. Modify the function to map patients to minimal structure
2. Keep displayData for UI but limit fields
3. Add comment explaining token optimization
4. Test with "show me the patient list" query

## Expected Result
- Token count: <500 (from 34,095)
- Response time: <1 second (from 20 seconds)
- Fields: 7 (from 50+)