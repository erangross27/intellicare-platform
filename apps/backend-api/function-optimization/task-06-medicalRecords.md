# Task 06: Optimize Medical Record List Functions

## Current Issue
- Returns complete medical records with full text
- Includes lab results with all values
- Prescriptions with detailed instructions
- Each record can be 1,000+ tokens

## Functions to Optimize
- `listMedicalRecords`
- `searchMedicalRecords`
- `listPrescriptions`
- `listLabResults`
- `getPatientsForFollowUp`

## Current Return Structure
```javascript
{
  data: [{
    _id, patientId, date, type,
    fullText, /* Entire medical note */
    diagnosis, /* Full diagnosis text */
    treatment, /* Detailed treatment plan */
    medications, /* Full prescription details */
    labResults, /* All lab values */
    imaging, /* Imaging reports */
    ...
  }]
}
```

## Required Optimization
Return summary only:
```javascript
{
  _id: record._id,
  date: record.date,
  type: record.type,
  summary: /* First 50 chars */,
  provider: record.providerName,
  hasLabResults: !!record.labResults,
  hasPrescriptions: !!record.medications
}
```

## Implementation Steps
1. Create medical record summarizer
2. Return flags instead of full data
3. Truncate all text fields
4. Group by type for better organization

## Expected Result
- Token reduction: 95%
- Maintains medical context
- Preserves navigation ability