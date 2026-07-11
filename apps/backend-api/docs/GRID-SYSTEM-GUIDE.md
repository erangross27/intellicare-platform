# IntelliCare Grid System - Developer Guide

## Overview

The IntelliCare Grid System provides a centralized, scalable way to format data for display across thousands of functions. Instead of hardcoding display formats in each function, the system uses:

1. **GridFormatterService** - Centralized formatting logic
2. **functionGridMappings.js** - Function-to-grid mappings
3. **Automatic AI Integration** - AI detects grid data and formats appropriately

## Quick Start: Adding Grid Support to Any Function

### Step 1: Add Function Mapping

Edit `services/functionGridMappings.js`:

```javascript
module.exports = {
  // ... existing mappings

  'yourNewFunction': {
    gridType: 'patient-list',  // Use existing template
    title: 'Custom Function Results'
  }
};
```

### Step 2: Update Function Return

In your function implementation:

```javascript
// OLD WAY (manual formatting)
return {
  success: true,
  data: results,
  message: "Found results"
};

// NEW WAY (grid formatter)
const gridFormatter = require('./gridFormatterService');
const baseResult = {
  success: true,
  data: results,
  message: "Found results"
};

return gridFormatter.formatForDisplay('yourNewFunction', baseResult,
  practiceContext.language, practiceContext);
```

**That's it!** Your function now supports:
- Consistent grid formatting
- Israeli vs US field differences (nationalId vs SSN)
- Role-based security filtering
- Automatic AI table generation

## Grid Templates Available

### 1. Patient Lists (`patient-list`)
**For:** Patient search, list, demographic functions
**Columns (Israeli):** firstName, lastName, nationalId, age, phone, healthFund
**Columns (US):** firstName, lastName, ssn, age, phone, insurance

```javascript
'listAllPatients': {
  gridType: 'patient-list',
  title: 'All Patients'
}
```

### 2. Follow-up Lists (`followup-list`)
**For:** Follow-up, task, and reminder functions
**Columns:** patientName, followUpDate, doctor, reason, priority

```javascript
'getPatientsNeedingFollowUp': {
  gridType: 'followup-list',
  title: 'Patients Needing Follow-up'
}
```

### 3. Appointment Lists (`appointment-list`)
**For:** Scheduling, calendar functions
**Columns:** patientName, date, time, provider, type, status, duration

```javascript
'getTodayAppointments': {
  gridType: 'appointment-list',
  title: 'Today\'s Appointments'
}
```

### 4. Medical Records (`medical-records`)
**For:** Medical history, lab results, diagnostics
**Columns:** patientName, recordType, date, provider, diagnosis, status

```javascript
'getLabResults': {
  gridType: 'medical-records',
  title: 'Lab Results',
  // Custom columns override template
  columns: ['patientName', 'testType', 'date', 'result', 'referenceRange'],
  headers: ['Patient', 'Test', 'Date', 'Result', 'Reference']
}
```

### 5. Documents (`documents`)
**For:** Document management functions
**Columns:** patientName, documentType, uploadDate, status, provider

### 6. Financial (`financial`)
**For:** Billing, payments, insurance
**Columns:** patientName, amount, paymentStatus, insuranceInfo, date

## Custom Grid Templates

### Create New Template

Edit `services/gridFormatterService.js`:

```javascript
this.gridTemplates = {
  // ... existing templates

  'medication-list': {
    title: 'Medications',
    columns: ['patientName', 'medication', 'dosage', 'frequency', 'prescribedBy'],
    headers: ['Patient', 'Medication', 'Dosage', 'Frequency', 'Prescribed By']
  }
};
```

### Use Custom Template

```javascript
// In functionGridMappings.js
'getCurrentMedications': {
  gridType: 'medication-list',
  title: 'Current Patient Medications'
}
```

## Advanced Features

### 1. Regional Differences (Israeli vs US)

```javascript
'patient-demographics': {
  title: 'Patient Demographics',
  israeli: {
    columns: ['firstName', 'lastName', 'nationalId', 'healthFund'],
    headers: ['שם פרטי', 'שם משפחה', 'תעודת זהות', 'קופת חולים']
  },
  us: {
    columns: ['firstName', 'lastName', 'ssn', 'insurance'],
    headers: ['First Name', 'Last Name', 'SSN', 'Insurance']
  }
}
```

### 2. Role-Based Security

Sensitive fields are automatically filtered based on user roles:
- **Full access:** doctor, nurse, admin, medical_director
- **Filtered access:** secretary, user (sensitive data shown as `***`)

Sensitive fields: `nationalId`, `ssn`, `phone`, `email`, `address`

### 3. Custom Column Overrides

```javascript
'getOverduePayments': {
  gridType: 'financial',
  title: 'Overdue Payments',
  // Override template columns
  columns: ['patientName', 'balance', 'daysPastDue', 'lastContact'],
  headers: ['Patient Name', 'Balance', 'Days Overdue', 'Last Contact']
}
```

## Data Format Requirements

Your function data should match the expected column names:

```javascript
// For patient-list template, return data like:
[
  {
    firstName: 'John',
    lastName: 'Doe',
    nationalId: '123456789',
    age: 35,
    phone: '+1-555-0123',
    healthFund: 'Clalit'
  }
  // ... more patients
]
```

## AI Integration

The system automatically instructs Claude to:
- Detect `gridFormat: true` in function results
- Display data as formatted tables
- Use provided `columns` and `headers`
- Show complete data (no truncation)
- Include statistics when available

## Examples of Complete Implementation

### Example 1: Simple Function

```javascript
// Function implementation
async getActivePatients(params, practiceContext) {
  const patients = await SecureDataAccess.query('patients',
    { status: 'active' }, {}, context);

  const gridFormatter = require('./gridFormatterService');
  const result = {
    success: true,
    data: patients,
    message: `Found ${patients.length} active patients`
  };

  return gridFormatter.formatForDisplay('getActivePatients', result,
    practiceContext.language, practiceContext);
}

// Mapping (in functionGridMappings.js)
'getActivePatients': {
  gridType: 'patient-list',
  title: 'Active Patients'
}
```

### Example 2: Custom Columns

```javascript
// Mapping with custom columns
'getPatientAllergies': {
  gridType: 'medical-records',
  title: 'Patient Allergies',
  columns: ['patientName', 'allergen', 'severity', 'reaction', 'discoveredDate'],
  headers: ['Patient Name', 'Allergen', 'Severity', 'Reaction', 'Discovered']
}
```

## Benefits

1. **Consistency:** All grids follow same format standards
2. **Scalability:** Easy to add hundreds of new functions
3. **Maintainability:** One place to update grid logic
4. **Security:** Automatic role-based filtering
5. **Localization:** Support for Israeli vs US practices
6. **AI Integration:** Automatic table generation by Claude

## Migration Guide

To migrate existing functions:

1. Add mapping to `functionGridMappings.js`
2. Update function return to use `gridFormatter.formatForDisplay()`
3. Ensure data fields match template expectations
4. Test with different user roles

The system is designed to scale to thousands of functions with minimal effort!