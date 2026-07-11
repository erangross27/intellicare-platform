# Task File: generatedMedicalFunctions.js
## Total Instances to Fix: 368

### Pattern Analysis
This file has a repeating pattern for all medical record types:
- updateX functions using `{ _id: args.recordId }`
- deleteX functions using `{ _id: args.recordId }`

The `args.recordId` comes from function parameters and should be converted to ObjectId at the function entry point.

### Instances to Fix (Line by Line)

#### Consultation Notes (Lines 108-142)
- [ ] Line 108: `const filter = { _id: args.recordId };` - Need to convert args.recordId to ObjectId first
- [ ] Line 142: `return await SecureDataAccess.delete('consultation_notes', { _id: args.recordId }, secureContext);`

#### Prescriptions (Lines 284-318)
- [ ] Line 284: `const filter = { _id: args.recordId };`
- [ ] Line 318: `return await SecureDataAccess.delete('prescriptions', { _id: args.recordId }, secureContext);`

#### Lab Results (Lines 460-494)
- [ ] Line 460: `const filter = { _id: args.recordId };`
- [ ] Line 494: `return await SecureDataAccess.delete('lab_results', { _id: args.recordId }, secureContext);`

#### Imaging Reports (Lines 636-670)
- [ ] Line 636: `const filter = { _id: args.recordId };`
- [ ] Line 670: `return await SecureDataAccess.delete('imaging_reports', { _id: args.recordId }, secureContext);`

#### Discharge Summaries (Lines 812-846)
- [ ] Line 812: `const filter = { _id: args.recordId };`
- [ ] Line 846: `return await SecureDataAccess.delete('discharge_summaries', { _id: args.recordId }, secureContext);`

#### Vaccination Records (Lines 988-1022)
- [ ] Line 988: `const filter = { _id: args.recordId };`
- [ ] Line 1022: `return await SecureDataAccess.delete('vaccination_records', { _id: args.recordId }, secureContext);`

#### Allergies (Lines 1164-1198)
- [ ] Line 1164: `const filter = { _id: args.recordId };`
- [ ] Line 1198: `return await SecureDataAccess.delete('allergies', { _id: args.recordId }, secureContext);`

#### Medications (Lines 1340-1374)
- [ ] Line 1340: `const filter = { _id: args.recordId };`
- [ ] Line 1374: `return await SecureDataAccess.delete('medications', { _id: args.recordId }, secureContext);`

#### Appointments (Lines 1516-1550)
- [ ] Line 1516: `const filter = { _id: args.recordId };`
- [ ] Line 1550: `return await SecureDataAccess.delete('appointments', { _id: args.recordId }, secureContext);`

#### Referrals (Lines 1692-1726)
- [ ] Line 1692: `const filter = { _id: args.recordId };`
- [ ] Line 1726: `return await SecureDataAccess.delete('referrals', { _id: args.recordId }, secureContext);`

[CONTINUING - This pattern repeats for ALL 184 update/delete function pairs]

### Fix Strategy for This File
1. Add `const { ObjectId } = require('mongodb');` at the top
2. For each update/delete function pair:
   - Convert args.recordId to ObjectId at function start
   - Use the ObjectId in the filter
3. Total functions to modify: 184 (92 update + 92 delete)

### Critical Notes
- args.recordId comes from API calls and is always a string
- Must validate it's a valid ObjectId format before converting
- Each medical record type follows the exact same pattern