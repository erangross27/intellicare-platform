# Task 01: Addiction Medicine Consultations

**Phase:** 1 (Critical Clinical Data)
**Priority:** High
**PDF Template:** `addiction_medicine_opioid_use_disorder.pdf`
**Target Collection:** `addiction_medicine_consultations`

## Clinical Context

Opioid Use Disorder (OUD) treatment requires comprehensive documentation of:
- Substance use history (types, duration, route, frequency)
- Withdrawal assessment (COWS/CIWA scores)
- Medication-Assisted Treatment (MAT) with buprenorphine, methadone, or naltrexone
- Relapse prevention planning
- Social support and recovery program enrollment
- Harm reduction counseling

This collection enables tracking treatment efficacy, medication titration, and recovery progress.

## Implementation Steps

### Step 1: Add Schema Field to claudeBatchProcessor.js

**Location:** `services/claudeBatchProcessor.js` lines ~15694 (BEFORE `careGaps` field)

**What to add:** Insert the following field BEFORE the `careGaps` field definition:

```javascript
          addictionMedicineData: {
            type: 'object',
            properties: {
              substanceUseHistory: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    substance: { type: 'string', description: 'Substance name (e.g., "Heroin", "Oxycodone", "Fentanyl", "Methamphetamine")' },
                    ageOfFirstUse: { type: 'string', description: 'Age when first used' },
                    duration: { type: 'string', description: 'How long used (e.g., "5 years", "Since age 18")' },
                    route: { type: 'string', description: 'Route of administration (IV, intranasal, oral, smoking)' },
                    frequency: { type: 'string', description: 'Frequency of use (e.g., "Daily", "Multiple times daily", "3-4x per day")' },
                    amount: { type: 'string', description: 'Amount used per day/session (e.g., "1-2 bags/day", "60-80mg oxycodone/day")' },
                    lastUse: { type: 'string', description: 'Date/time of last use' },
                    attempts ToQuit: { type: 'number', description: 'Number of previous quit attempts' },
                    longestSobriety: { type: 'string', description: 'Longest period of sobriety (e.g., "6 months in 2020")' }
                  }
                },
                description: 'Complete substance use history for all substances'
              },

              withdrawalAssessment: {
                type: 'object',
                properties: {
                  symptoms: { type: 'array', items: { type: 'string' }, description: 'Withdrawal symptoms present (e.g., "Anxiety", "Sweating", "Nausea", "Muscle aches", "Dilated pupils")' },
                  severity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'], description: 'Overall withdrawal severity' },
                  cowsScore: { type: 'number', description: 'Clinical Opiate Withdrawal Scale (COWS) score (0-48, ≥13 = moderate withdrawal)' },
                  ciwaScore: { type: 'number', description: 'Clinical Institute Withdrawal Assessment for Alcohol (CIWA-Ar) score if applicable' },
                  timeS inceLastUse: { type: 'string', description: 'Time since last substance use' },
                  managementPlan: { type: 'string', description: 'Withdrawal management approach' }
                },
                description: 'Withdrawal symptom assessment and scoring'
              },

              medicationAssistedTreatment: {
                type: 'object',
                properties: {
                  medication: { type: 'string', description: 'MAT medication (Buprenorphine/naloxone [Suboxone], Buprenorphine [Subutex], Methadone, Naltrexone [Vivitrol], Naltrexone oral)' },
                  inductionDate: { type: 'string', description: 'Date MAT initiated' },
                  inductionDose: { type: 'string', description: 'Initial induction dose (e.g., "4mg buprenorphine SL")' },
                  currentDose: { type: 'string', description: 'Current maintenance dose (e.g., "16mg/4mg buprenorphine/naloxone daily")' },
                  dosing Schedule: { type: 'string', description: 'Dosing frequency (once daily, twice daily, etc.)' },
                  responseToTreatment: { type: 'string', description: 'Patient response to MAT (craving reduction, withdrawal control, side effects)' },
                  sideEffects: { type: 'array', items: { type: 'string' }, description: 'Side effects experienced' },
                  titrationPlan: { type: 'string', description: 'Dose adjustment plan if applicable' },
                  prescribingProvider: { type: 'string', description: 'Provider prescribing MAT (requires DEA-X waiver for buprenorphine)' },
                  pharmacyDispensing: { type: 'string', description: 'Dispensing schedule (e.g., "Weekly pickup", "Daily observed dosing at clinic")' }
                },
                description: 'Medication-Assisted Treatment (MAT) details'
              },

              urinedrugScreening: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string', description: 'Date of UDS' },
                    results: {
                      type: 'object',
                      properties: {
                        buprenorphine: { type: 'string', description: 'Positive/Negative' },
                        opiates: { type: 'string', description: 'Positive/Negative' },
                        fentanyl: { type: 'string', description: 'Positive/Negative' },
                        cocaine: { type: 'string', description: 'Positive/Negative' },
                        amphetamines: { type: 'string', description: 'Positive/Negative' },
                        benzodiazepines: { type: 'string', description: 'Positive/Negative' },
                        thc: { type: 'string', description: 'Positive/Negative' },
                        alcohol: { type: 'string', description: 'Positive/Negative' }
                      }
                    },
                    interpretation: { type: 'string', description: 'Clinical interpretation (e.g., "Consistent with prescribed MAT", "Positive for fentanyl - indicates ongoing use")' }
                  }
                },
                description: 'Urine drug screening results for monitoring'
              },

              relapsePrevention: {
                type: 'object',
                properties: {
                  triggers: { type: 'array', items: { type: 'string' }, description: 'Identified relapse triggers (people, places, emotions, situations)' },
                  copingStrategies: { type: 'array', items: { type: 'string' }, description: 'Coping strategies taught (e.g., "Call sponsor", "Attend meeting", "Use urge-surfing technique")' },
                  supportSystem: { type: 'array', items: { type: 'string' }, description: 'Support system (e.g., "Spouse - supportive", "Sponsor - John D., 5 years sober", "NA home group Tuesdays")' },
                  relapsePlan: { type: 'string', description: 'What to do if relapse occurs' },
                  emergencyContacts: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, relationship: { type: 'string' } } } }
                },
                description: 'Relapse prevention planning'
              },

              recoveryPrograms: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    programType: { type: 'string', description: 'Program type (AA, NA, SMART Recovery, Intensive Outpatient Program [IOP], Partial Hospitalization [PHP], Sober living, Peer support)' },
                    frequency: { type: 'string', description: 'Attendance frequency (e.g., "3x per week", "Daily")' },
                    startDate: { type: 'string', description: 'Program enrollment date' },
                    attendance: { type: 'string', description: 'Attendance status (Active, Completed, Dropped out, Irregular)' },
                    counselor: { type: 'string', description: 'Counselor/case manager name if applicable' }
                  }
                },
                description: 'Recovery program enrollment and participation'
              },

              harmReductionCounseling: {
                type: 'object',
                properties: {
                  naloxoneProvided: { type: 'boolean', description: 'Naloxone (Narcan) provided for overdose reversal' },
                  naloxoneTraining: { type: 'boolean', description: 'Patient/family trained on naloxone use' },
                  safeInjectionPractices: { type: 'boolean', description: 'Counseling on safe injection practices if actively using' },
                  fentanylTestStrips: { type: 'boolean', description: 'Fentanyl test strips provided' },
                  needleExchange: { type: 'boolean', description: 'Referred to needle exchange program' }
                },
                description: 'Harm reduction interventions provided'
              },

              psychiatricComorbidities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    diagnosis: { type: 'string', description: 'Psychiatric diagnosis (Depression, Anxiety, PTSD, Bipolar disorder, etc.)' },
                    treatment: { type: 'string', description: 'Treatment (medications, therapy)' },
                    impact OnRecovery: { type: 'string', description: 'How this condition impacts recovery' }
                  }
                },
                description: 'Co-occurring psychiatric disorders (common in substance use disorders)'
              },

              socialDeterminants: {
                type: 'object',
                properties: {
                  housingStatus: { type: 'string', description: 'Housing (Stable, Unstable, Homeless, Sober living)' },
                  employment: { type: 'string', description: 'Employment status' },
                  legalIssues: { type: 'string', description: 'Legal issues/involvement (e.g., "Probation", "Drug court", "Pending charges")' },
                  insurance: { type: 'string', description: 'Insurance coverage for treatment' },
                  transportation: { type: 'string', description: 'Transportation access to appointments' },
                  childCustody: { type: 'string', description: 'Child custody status if applicable (motivation for recovery)' }
                },
                description: 'Social determinants affecting recovery'
              },

              treatmentPlan: {
                type: 'object',
                properties: {
                  goals: { type: 'array', items: { type: 'string' }, description: 'Treatment goals (e.g., "Abstinence from opioids", "Stable on MAT", "Return to work", "Regain child custody")' },
                  frequencyOfVisits: { type: 'string', description: 'Appointment frequency (e.g., "Weekly x 4 weeks, then biweekly")' },
                  udsTesting: { type: 'string', description: 'UDS testing schedule (e.g., "Weekly random", "Monthly")' },
                  counseling: { type: 'string', description: 'Counseling plan (individual, group, family)' },
                  referrals: { type: 'array', items: { type: 'string' }, description: 'Referrals made (psychiatry, case management, vocational rehab, etc.)' }
                },
                description: 'Comprehensive treatment plan'
              },

              prognosis: {
                type: 'object',
                properties: {
                  shortTerm: { type: 'string', description: 'Short-term prognosis (3-6 months)' },
                  longTerm: { type: 'string', description: 'Long-term recovery prognosis' },
                  prognosticFactors: {
                    type: 'object',
                    properties: {
                      positive: { type: 'array', items: { type: 'string' }, description: 'Positive prognostic factors (e.g., "Strong family support", "Employment", "No IV use")' },
                      negative: { type: 'array', items: { type: 'string' }, description: 'Negative prognostic factors (e.g., "Homelessness", "Polysubstance use", "Legal issues")' }
                    }
                  }
                },
                description: 'Recovery prognosis'
              }
            },
            description: 'EXTRACT addiction medicine consultation data including substance use history, MAT, withdrawal assessment, recovery programs, and relapse prevention'
          },
```

**CRITICAL SAFETY:**
- Insert this ENTIRE block starting at line ~15694 (BEFORE `careGaps`)
- Do NOT modify ANY existing fields
- Do NOT change line numbers after your insertion
- The schema should nest inside the existing `properties: {` block

### Step 2: Add Collection to medicalCollectionsService.js

**Location:** `services/medicalCollectionsService.js`

**Find:** The `allCollections` array

**Add:** `'addiction_medicine_consultations',` to the array (alphabetical order preferred)

```javascript
const allCollections = [
  ...
  'addiction_medicine_consultations',
  ...
];
```

### Step 3: Add Collection Schema to collectionSchemas.js

**Location:** `services/models/collectionSchemas.js`

**Add:** After existing collection definitions:

```javascript
addiction_medicine_consultations: {
  fields: {
    substanceUseHistory: { type: 'array' },
    withdrawalAssessment: { type: 'object' },
    medicationAssistedTreatment: { type: 'object' },
    urineDrugScreening: { type: 'array' },
    relapsePrevention: { type: 'object' },
    recoveryPrograms: { type: 'array' },
    harmReductionCounseling: { type: 'object' },
    psychiatricComorbidities: { type: 'array' },
    socialDeterminants: { type: 'object' },
    treatmentPlan: { type: 'object' },
    prognosis: { type: 'object' }
  }
},
```

### Step 4: Test the Schema

**Before testing:**
```bash
# Backup original file
cp services/claudeBatchProcessor.js services/claudeBatchProcessor.js.backup

# Syntax check
node -c services/claudeBatchProcessor.js
```

**Run extraction test:**
```bash
cd apps/backend-api

# Copy test PDF
cp "/home/erangross/Documents/English medical termplates/addiction_medicine_opioid_use_disorder.pdf" \
   sample-medical-records/

# Run extraction (will use Claude Batch API)
node scripts/verifyDataExtractionAutoWithCache.js --no-cache
```

**Verify in MongoDB:**
```bash
MONGO_URI=$(cat .kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --quiet --eval "
  db = db.getSiblingDB('intellicare_practice_yale');
  print('Addiction medicine consultations count: ' + db.addiction_medicine_consultations.countDocuments());
  printjson(db.addiction_medicine_consultations.findOne());
"
```

### Step 5: Verify Unified Document

```bash
mongosh "$MONGO_URI" --quiet --eval "
  db = db.getSiblingDB('intellicare_practice_yale');
  const doc = db.unified_medical_documents.findOne(
    {},
    { addictionMedicineData: 1 }
  );
  if (doc && doc.addictionMedicineData) {
    print('✅ addictionMedicineData found in unified document');
    printjson(doc.addictionMedicineData);
  } else {
    print('❌ addictionMedicineData NOT in unified document');
  }
"
```

## Expected Data Structure

After extraction, the collection should contain:

```javascript
{
  _id: ObjectId(...),
  patientId: ObjectId(...),
  documentId: ObjectId(...),
  sessionId: "...",
  substanceUseHistory: [
    {
      substance: "Heroin",
      ageOfFirstUse: "18",
      duration: "5 years",
      route: "IV",
      frequency: "Daily, 3-4x",
      amount: "1-2 bags/day",
      lastUse: "2024-11-20",
      attemptsToQuit: 3,
      longestSobriety: "6 months in 2020"
    }
  ],
  withdrawalAssessment: {
    symptoms: ["Anxiety", "Sweating", "Dilated pupils", "Muscle aches"],
    severity: "Moderate",
    cowsScore: 15,
    timeSinceLastUse: "18 hours",
    managementPlan: "Buprenorphine induction per ASAM guidelines"
  },
  medicationAssistedTreatment: {
    medication: "Buprenorphine/naloxone (Suboxone)",
    inductionDate: "2024-11-21",
    inductionDose: "4mg buprenorphine SL",
    currentDose: "16mg/4mg daily",
    dosingSchedule: "Once daily",
    responseToTreatment: "Good - craving reduced, no withdrawal symptoms",
    prescribingProvider: "Dr. Smith (DEA-X12345678)"
  },
  // ... more fields
  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}
```

## Safety Checklist

Before implementation:
- [ ] Backup claudeBatchProcessor.js
- [ ] Backup collectionSchemas.js
- [ ] Backup medicalCollectionsService.js

During implementation:
- [ ] Add schema field in correct location (before `careGaps`)
- [ ] Do NOT modify existing fields
- [ ] Syntax check passes
- [ ] No line number conflicts

After implementation:
- [ ] Extraction runs without errors
- [ ] Collection created in MongoDB
- [ ] Sample document has expected fields
- [ ] Unified document includes new section
- [ ] All existing collections still work

## Rollback Plan

If anything breaks:

```bash
# Restore backups
cp services/claudeBatchProcessor.js.backup services/claudeBatchProcessor.js
cp services/models/collectionSchemas.js.backup services/models/collectionSchemas.js
cp services/medicalCollectionsService.js.backup services/medicalCollectionsService.js

# Verify syntax
node -c services/claudeBatchProcessor.js
```

## Success Criteria

✅ Schema added without syntax errors
✅ Collection registered in medicalCollectionsService.js
✅ Collection schema defined in collectionSchemas.js
✅ Test PDF extracts addiction medicine data
✅ MongoDB collection created with correct structure
✅ Unified document includes addictionMedicineData section
✅ No existing schemas broken

## Status

- [ ] Schema field added
- [ ] Collection registered
- [ ] Collection schema defined
- [ ] Tested with sample PDF
- [ ] MongoDB verified
- [ ] Unified document verified
- [ ] Task complete

---

**Next Task:** task-02-brain-tumor-molecular.md
