# Tool #5: Prescription Auto-Generator

**Priority**: CRITICAL - START HERE
**Timeline**: 3-4 days
**Complexity**: Medium-High
**Blocks**: All perioperative workflows

---

## Problem Statement

Richard Phillips has **8 active medications** but **ZERO prescriptions** documented in the system. This creates:

1. **Legal Risk**: Cannot verify controlled substance agreements (oxycodone)
2. **Safety Risk**: No refill history, cannot track adherence
3. **Workflow Risk**: Cannot generate postoperative medication plans
4. **Compliance Risk**: No prescription tracking for opioids (140mg MME/day)

**Example Gap:**
- Medication List: Oxycodone 20mg TID, Gabapentin 300mg TID, Lisinopril 10mg daily, etc.
- Prescriptions Collection: **EMPTY**

**Current State**: Medications exist, prescriptions don't → Cannot proceed with surgery

---

## Tool Specification

### Function Name
`generatePrescriptionsFromMedList()`

### Purpose
Automatically create prescription records for all active medications that lack prescriptions.

### Parameters
```
{
  patientId: string (required),
  prescribingProvider: string (required),
  effectiveDate: string (ISO date, default: today),
  includeInactive: boolean (default: false),
  dryRun: boolean (default: false, for preview)
}
```

### Return Value
```
{
  success: boolean,
  generated: number,              // Count of prescriptions created
  skipped: number,                // Already have prescriptions
  prescriptions: [
    {
      medicationName: string,
      prescriptionId: string,
      status: 'generated',
      controlledSubstance: boolean
    }
  ],
  warnings: [string],            // E.g., "Oxycodone requires DEA verification"
  message: string
}
```

---

## Business Logic

### Generation Rules

**When to Generate:**
1. Medication exists in `medications` collection
2. No active prescription exists for that medication
3. Medication status = 'active'
4. Medication has dosage + frequency

**What to Populate:**
```
Prescription Fields (from Medication):
- medicationName → from medication.name
- dosage → from medication.dosage
- frequency → from medication.frequency
- route → from medication.route
- quantity → calculated (30-day supply)
- refills → default 3 (or 0 for controlled)
- daysSupply → 30
- instructions → from medication.instructions
```

**Controlled Substance Handling:**
```
If medication is controlled (opioid, benzodiazepine):
- Set refills = 0
- Flag for DEA verification
- Require e-prescription
- Track in controlled_substance_log
- Generate patient agreement requirement
```

### Duplicate Prevention
```
Check before creating:
1. Prescription exists for same drug + same patient
2. Prescription status = 'active' or 'pending'
3. Prescription effective date within 90 days

If duplicate exists:
- Skip creation
- Log to skipped array
- Continue with next medication
```

---

## Data Model

### Input: medications Collection
```
{
  _id: ObjectId,
  patientId: ObjectId,
  name: "Oxycodone",
  dosage: "20mg",
  frequency: "TID",
  route: "Oral",
  instructions: "Take with food",
  status: "active",
  controlledSubstance: true
}
```

### Output: prescriptions Collection
```
{
  _id: ObjectId,
  patientId: ObjectId,
  medicationId: ObjectId,           // Link back to medication
  medicationName: "Oxycodone 20mg",
  dosage: "20mg",
  frequency: "TID",
  route: "Oral",
  quantity: 90,                     // 30 days * 3 per day
  refills: 0,                       // Controlled = no refills
  daysSupply: 30,
  prescribedBy: ObjectId,
  prescribedDate: Date,
  effectiveDate: Date,
  expirationDate: Date,             // +90 days for controlled, +365 for non
  status: "active",
  controlledSubstance: true,
  requiresDEA: true,
  requiresAgreement: true,
  instructions: "Take with food",
  source: "auto_generated",
  createdAt: Date,
  updatedAt: Date
}
```

---

## Clinical Workflows

### Workflow 1: Preoperative Assessment
```
1. Doctor reviews Richard Phillips medications
2. System detects 8 meds, 0 prescriptions
3. Claude suggests: "Generate prescriptions for all medications?"
4. Doctor confirms
5. System calls generatePrescriptionsFromMedList(patientId: "richard_phillips")
6. Returns: "Generated 8 prescriptions (3 controlled substances require verification)"
7. Doctor reviews controlled substance agreements
8. Prescriptions ready for perioperative planning
```

### Workflow 2: New Patient Import
```
1. Import patient with medication list
2. System auto-detects missing prescriptions
3. Flags in dashboard: "8 medications need prescriptions"
4. One-click generation button
5. Provider reviews and approves
```

### Workflow 3: Medication Reconciliation
```
1. Post-discharge medication list updated
2. System compares meds vs prescriptions
3. Identifies gaps
4. Suggests generation for new medications
```

---

## Validation Rules

### Pre-Generation Validation
```
Required Fields:
- ✅ Patient exists
- ✅ Provider has prescribing privileges
- ✅ Medication has name + dosage + frequency
- ✅ No duplicate active prescription

Warnings (proceed with caution):
- ⚠️ Controlled substance (flag for review)
- ⚠️ High-risk medication (warfarin, insulin)
- ⚠️ Drug interaction detected
- ⚠️ Allergy conflict
```

### Post-Generation Validation
```
Check Generated Prescriptions:
- Quantity calculation correct
- Days supply matches frequency
- Controlled substance rules applied
- Expiration date calculated
- All required fields populated
```

---

## User Interface

### Provider Dashboard
**Location:** Patient medication section

**Components:**
1. **Missing Prescriptions Alert**
   ```
   ⚠️ 8 medications without prescriptions
   [Generate All] [Review Medications]
   ```

2. **Preview Modal** (when clicked)
   ```
   Prescriptions to Generate:

   ✓ Lisinopril 10mg daily (30 tablets, 3 refills)
   ✓ Metformin 500mg BID (60 tablets, 3 refills)
   ⚠️ Oxycodone 20mg TID (90 tablets, 0 refills) - CONTROLLED
   ⚠️ Gabapentin 300mg TID (90 capsules, 0 refills) - CONTROLLED
   ... 4 more

   [Cancel] [Generate All]
   ```

3. **Post-Generation Summary**
   ```
   ✅ Generated 8 prescriptions
   ⚠️ 3 controlled substances require:
      - DEA verification
      - Patient agreement signature
      - E-prescription only

   [Review Prescriptions] [Sign Agreements]
   ```

### Medication List Integration
**Location:** Each medication row

**Components:**
```
Medication: Oxycodone 20mg TID
Prescription: ❌ Missing  [Generate]
```

After generation:
```
Medication: Oxycodone 20mg TID
Prescription: ✅ Active (Rx#12345, 90 tablets, 0 refills)
```

---

## Integration Points

### Database Collections
```
Read from:
- medications (source data)
- patients (validation)
- users (prescribing provider)

Write to:
- prescriptions (new records)
- controlled_substance_log (if controlled)
- audit_trail (generation events)
```

### External Systems
```
Future Integration:
- E-prescription gateway (for controlled substances)
- Drug formulary database (for quantity calculations)
- State PDMP (prescription drug monitoring)
- DEA verification API
```

### IntelliCare Services
```
Use existing:
- SecureDataAccess (data operations)
- medicationService (read medications)
- prescriptionService (create prescriptions)
- auditService (log generation events)
```

---

## Security & Compliance

### Access Control
```
Who can generate:
- ✅ Attending physicians
- ✅ Nurse practitioners (with prescribing authority)
- ✅ Physician assistants (with supervising physician)
- ❌ Nurses (cannot prescribe)
- ❌ Administrative staff
```

### Audit Trail
```
Log every generation:
- Who generated (provider ID)
- When generated (timestamp)
- What generated (medication list)
- Why generated (source: preop_assessment, reconciliation, etc.)
- Review required (controlled substances)
```

### Controlled Substance Tracking
```
For opioids/benzos/stimulants:
- Log in controlled_substance_log
- Require patient agreement
- Track MME (morphine milligram equivalent)
- Flag for PDMP check
- Require e-prescription
```

---

## Success Criteria

### Immediate (Day 1)
- ✅ Tool generates prescriptions from medication list
- ✅ Controlled substances flagged correctly
- ✅ Duplicate prevention works

### Short-term (Week 1)
- ✅ Richard Phillips has 8 prescriptions generated
- ✅ 3 controlled substances flagged for review
- ✅ Provider can approve/modify before saving

### Long-term (Week 4)
- ✅ Used for all new patient imports
- ✅ Integrated with medication reconciliation
- ✅ Reduces manual prescription entry by 80%

---

## Testing Strategy

### Test Case 1: Richard Phillips (8 medications)
```
Input:
- Oxycodone 20mg TID (controlled)
- Gabapentin 300mg TID (controlled)
- Metformin 500mg BID
- Lisinopril 10mg daily
- Aspirin 81mg daily
- Atorvastatin 40mg nightly
- Omeprazole 20mg daily
- Multivitamin daily

Expected Output:
- 8 prescriptions generated
- 2 flagged as controlled (oxycodone, gabapentin)
- Quantities calculated correctly (TID=90 for 30 days, daily=30)
- Refills: 0 for controlled, 3 for others
- All linked to medication records
```

### Test Case 2: Duplicate Prevention
```
Input:
- Patient already has active prescription for Lisinopril
- Attempt to generate again

Expected:
- Skip Lisinopril
- Log: "Prescription already exists (Rx#12345)"
- Continue with other medications
```

### Test Case 3: Missing Data Handling
```
Input:
- Medication without dosage

Expected:
- Skip medication
- Warning: "Cannot generate prescription - missing dosage"
- Continue with others
```

---

## Implementation Checklist

### Step 1: Schema Verification
- [ ] Verify prescriptions collection schema exists
- [ ] Add fields: medicationId, controlledSubstance, requiresDEA, source
- [ ] Add indexes: patientId, medicationId, status, controlledSubstance

### Step 2: Service Implementation
**File**: `apps/backend-api/services/prescriptionService.js`
- [ ] Create generatePrescriptionsFromMedList() function
- [ ] Implement duplicate checking
- [ ] Calculate quantities based on frequency
- [ ] Flag controlled substances
- [ ] Use SecureDataAccess for all queries

### Step 3: Quantity Calculation Logic
- [ ] Parse frequency (QD=1, BID=2, TID=3, QID=4, Q8H=3, PRN=variable)
- [ ] Calculate 30-day supply
- [ ] Handle special cases (PRN, taper schedules)
- [ ] Validate quantity is reasonable

### Step 4: Controlled Substance Rules
- [ ] Identify controlled meds (opioids, benzos, stimulants)
- [ ] Set refills=0
- [ ] Flag requiresDEA=true
- [ ] Log to controlled_substance_log
- [ ] Check if patient agreement exists

### Step 5: Function Registration
- [ ] Add to aiHelpers.js getAllPlatformFunctions()
- [ ] Add to agentSystemPrompt.js
- [ ] Register in agentServiceV4.js
- [ ] Test Claude can call function

### Step 6: UI Integration
- [ ] Add "Missing Prescriptions" alert
- [ ] Create preview modal
- [ ] Show post-generation summary
- [ ] Add per-medication [Generate] button

---

## Related Tools

- **Tool #2**: Opioid MME Dashboard - Uses prescription data for MME calculation
- **Tool #4**: Sleep Apnea Management - May need sedative prescriptions flagged
- Medication reconciliation workflows
- E-prescription integration (future)

---

## References

- **IntelliCare Security**: CLAUDE.md lines 71-100
- **Prescription Schema**: collectionSchemas.js
- **Controlled Substances**: DEA Schedule classification
- **Quantity Calculations**: Standard pharmacy practice (30-day supply)

---

**PRIORITY**: This is the #1 blocking tool - implement first!
