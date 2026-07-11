# Task 17: Add FHIR Sandbox Testing (Epic, HAPI)

## Priority: LOW
## Category: Phase 3 - Enhance Existing Integrations
## Dependencies: None
## Cost: FREE

## Background

FHIR (Fast Healthcare Interoperability Resources) is the future of healthcare data exchange. Major EHRs (Epic, Cerner, Allscripts) now expose FHIR APIs. Testing against public FHIR sandboxes prepares IntelliCare for real EHR integration without needing production access.

## Free Public FHIR Servers

### Epic on FHIR Sandbox
- **URL**: https://open.epic.com/
- **Registration**: Free developer account
- **What it offers**: Full FHIR R4 API with synthetic patient data
- **Why it matters**: Epic has ~38% US EHR market share

### HAPI FHIR Public Server
- **URL**: http://hapi.fhir.org/baseR4
- **Auth**: None
- **What it offers**: Open FHIR R4 server for any testing

### SMART on FHIR Sandbox
- **URL**: https://launch.smarthealthit.org/
- **What it offers**: Launch framework testing with synthetic data

## What Needs to Be Done

### Step 1: Create fhirClientService.js
Generic FHIR R4 client:
- `searchPatients(query)` - FHIR Patient search
- `getPatient(id)` - Get patient resource
- `getConditions(patientId)` - Active conditions
- `getMedications(patientId)` - Active medications
- `getLabResults(patientId)` - Lab observations
- `getAllergies(patientId)` - Allergy intolerances

### Step 2: Connect to Epic Sandbox
- Register at open.epic.com
- Implement SMART on FHIR launch flow
- Test data retrieval with synthetic patients

### Step 3: Build FHIR-to-IntelliCare Mapper
- Map FHIR Patient → IntelliCare patient record
- Map FHIR Condition → IntelliCare diagnosis
- Map FHIR MedicationRequest → IntelliCare medication
- Map FHIR Observation → IntelliCare lab result/vital sign

### Step 4: Wire to Agent
- `importFromFHIR` - Import patient data from external EHR
- `exportToFHIR` - Export patient data in FHIR format

## Notes
- This is preparation for real EHR integration
- No cost, no business requirements for sandbox access
- Epic sandbox approval is straightforward for developers
- FHIR competency is increasingly required for health IT certification
