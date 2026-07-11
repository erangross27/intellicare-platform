# Task 18: Add Export Tools (Users, Patients CSV/PDF)

## Priority: MEDIUM
## Category: Phase 4 - Agent Capability Gaps
## Dependencies: None

## Background

The agent can import users/patients from CSV but cannot export data to CSV or generate reports as downloadable files. Practices need to export patient lists, user directories, and reports for administrative purposes.

## What Already Exists

### Import Tools
- `importPatientsFromCSV` - Import patients from CSV
- `importUsersFromCSV` - Import users from CSV
- `generatePatientReport` - Generate report (may not produce downloadable file)

### PDF Generation
- The platform already generates PDF templates for medical documents
- React-PDF infrastructure exists in the frontend

## What Needs to Be Done

### Step 1: Add Backend Export Functions

In a new `exportService.js`:
- `exportPatientsToCSV(filters)` - Export patient list with optional filters (by provider, date range, condition)
- `exportUsersToCSV(filters)` - Export user/staff directory
- `exportAppointmentsToCSV(dateRange, providerId)` - Export appointment schedule
- `exportBillingReport(dateRange, format)` - Export billing/revenue data
- `exportMedicationList(patientId)` - Export patient's medication list

Each function should:
1. Query the data from MongoDB
2. Format as CSV (using a library like `json2csv`)
3. Save to a temporary file
4. Return a download URL (or base64 for small files)

### Step 2: Add Agent Tools
- `exportPatients` - "Export patient list to CSV. Optional filters: provider, date range, condition"
- `exportUsers` - "Export staff/user directory to CSV"
- `exportAppointmentSchedule` - "Export appointments for a date range to CSV"
- `exportPatientMedications` - "Export a patient's medication list"

### Step 3: Handle File Delivery
Options:
- Return download link in chat response
- Open file in new browser tab
- Email the file to the requesting user

### Step 4: Test via Chat
- "Export all patients to CSV"
- "Export Dr. Smith's patients to CSV"
- "Export this week's appointment schedule"
- "Export Russell Hall's medication list"

## Files to Create
1. `apps/backend-api/services/exportService.js`

## Files to Modify
1. Standard agent wiring files
2. May need a file download route in the API

## Notes
- CSV is preferred for data portability
- Consider adding column selection ("only export name, DOB, phone")
- Large exports should be async (generate in background, notify when ready)
- HIPAA: Exported data must be handled securely
