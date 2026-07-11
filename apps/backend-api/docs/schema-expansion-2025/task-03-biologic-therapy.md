# Task 03: Biologic Therapy Records

**Phase:** 1 (Critical Clinical Data)
**Priority:** High
**PDF Template:** `biologic_therapy_dupilumab.pdf`
**Target Collection:** `biologic_therapy_records`

## Clinical Context

Biologic therapies (dupilumab, adalimumab, infliximab, ustekinumab, etc.) require comprehensive tracking:
- Prior failed conventional therapies (prerequisite for insurance approval)
- Baseline disease severity scores (EASI, IGA, PASI, etc.)
- Administration schedule and route
- Response assessment with quantitative improvement
- Adverse events monitoring
- Insurance authorization and appeals

This collection enables biologics management across dermatology, rheumatology, gastroenterology, and other specialties.

## Implementation Steps

### Step 1: Add Schema Field to claudeBatchProcessor.js

**Location:** `services/claudeBatchProcessor.js` (AFTER `brainTumorMolecularMarkers`, BEFORE `careGaps`)

**What to add:**

```javascript
          biologicTherapyRecords: {
            type: 'object',
            properties: {
              biologicAgent: {
                type: 'string',
                description: 'Biologic medication name and brand (e.g., "Dupilumab (Dupixent)", "Adalimumab (Humira)", "Infliximab (Remicade)", "Ustekinumab (Stelara)")'
              },

              indication: {
                type: 'string',
                description: 'FDA-approved indication (Atopic dermatitis, Rheumatoid arthritis, Crohn disease, Ulcerative colitis, Psoriasis, Asthma, etc.)'
              },

              mechanismOfAction: {
                type: 'string',
                description: 'Mechanism (IL-4/IL-13 inhibitor, TNF-alpha inhibitor, IL-17 inhibitor, IL-23 inhibitor, etc.)'
              },

              priorTherapies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    therapy: { type: 'string', description: 'Prior therapy name (e.g., "Topical corticosteroids", "Methotrexate", "Cyclosporine")' },
                    duration: { type: 'string', description: 'How long used' },
                    maxDose: { type: 'string', description: 'Maximum dose achieved' },
                    response: { type: 'string', enum: ['No response', 'Partial response', 'Initial response then failure', 'Intolerance'], description: 'Treatment response' },
                    reasonForDiscontinuation: { type: 'string', description: 'Why stopped (ineffective, side effects, contraindication)' }
                  }
                },
                description: 'CRITICAL: Prior failed therapies (required for insurance approval) - document inadequate response to conventional treatments'
              },

              baselineDiseaseAssessment: {
                type: 'object',
                properties: {
                  assessmentDate: { type: 'string', description: 'Date of baseline assessment (before starting biologic)' },

                  // Dermatology scores
                  easiScore: { type: 'string', description: 'Eczema Area and Severity Index (0-72, severe ≥24)' },
                  igaScore: { type: 'string', description: 'Investigator Global Assessment (0-4, moderate-severe 3-4)' },
                  pasiScore: { type: 'string', description: 'Psoriasis Area and Severity Index (0-72, severe ≥10)' },
                  bsaPercentage: { type: 'string', description: 'Body Surface Area affected (%)' },
                  dlqiScore: { type: 'string', description: 'Dermatology Life Quality Index (0-30, severe >10)' },
                  pruritus NrsScore: { type: 'string', description: 'Pruritus Numerical Rating Scale (0-10)' },

                  // Rheumatology scores
                  das28Score: { type: 'string', description: 'Disease Activity Score 28 for RA (>5.1 = high activity)' },
                  cdaiScore: { type: 'string', description: 'Clinical Disease Activity Index' },
                  tenderJointCount: { type: 'number', description: 'Number of tender joints' },
                  swollenJointCount: { type: 'number', description: 'Number of swollen joints' },

                  // IBD scores
                  harveyBradshawIndex: { type: 'string', description: 'Harvey-Bradshaw Index for Crohn disease' },
                  mayoScore: { type: 'string', description: 'Mayo score for ulcerative colitis' },
                  fecalCalprotectin: { type: 'string', description: 'Fecal calprotectin level (µg/g)' },

                  // General
                  photography: { type: 'string', description: 'Baseline clinical photography obtained (Yes/No)' },
                  biomarkers: { type: 'array', items: { type: 'object', properties: { biomarker: { type: 'string' }, value: { type: 'string' } } }, description: 'Baseline inflammatory markers (CRP, ESR, IgE, eosinophils)' }
                },
                description: 'Baseline disease severity assessment with validated scoring systems'
              },

              biologic AdministrationPlan: {
                type: 'object',
                properties: {
                  loadingDose: { type: 'string', description: 'Loading dose regimen (e.g., "600mg SC on day 1", "5mg/kg IV weeks 0, 2, 6")' },
                  maintenanceDose: { type: 'string', description: 'Maintenance dose (e.g., "300mg SC every 2 weeks", "40mg SC every 2 weeks")' },
                  route: { type: 'string', enum: ['Subcutaneous', 'Intravenous', 'Intramuscular'], description: 'Route of administration' },
                  frequency: { type: 'string', description: 'Dosing frequency (weekly, every 2 weeks, every 4 weeks, every 8 weeks)' },
                  administrationSetting: { type: 'string', description: 'Where administered (Self-injection at home, Infusion center, Office injection)' },
                  durationOfTherapy: { type: 'string', description: 'Expected duration or indefinite' }
                },
                description: 'Biologic dosing and administration plan'
              },

              firstDoseAdministration: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Date of first dose' },
                  location: { type: 'string', description: 'Where administered (clinic, home, infusion center)' },
                  dose: { type: 'string', description: 'Dose given' },
                  tolerability: { type: 'string', description: 'How patient tolerated (no reaction, mild injection site reaction, etc.)' },
                  injectionSiteReaction: { type: 'string', description: 'Injection site reaction if SC (erythema, swelling, pain)' },
                  infusionReaction: { type: 'string', description: 'Infusion reaction if IV (none, mild, moderate)' },
                  premedications: { type: 'array', items: { type: 'string' }, description: 'Premedications given (acetaminophen, diphenhydramine, hydrocortisone)' },
                  patientEducation: { type: 'boolean', description: 'Patient educated on self-injection technique if applicable' }
                },
                description: 'First dose administration details and tolerability'
              },

              responseAssessment: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    assessmentDate: { type: 'string', description: 'Date of follow-up assessment' },
                    weeksOnTherapy: { type: 'number', description: 'Weeks since starting biologic' },

                    // Repeat severity scores
                    currentEasiScore: { type: 'string', description: 'Current EASI if dermatology' },
                    currentIgaScore: { type: 'string', description: 'Current IGA if dermatology' },
                    currentPasiScore: { type: 'string', description: 'Current PASI if dermatology' },
                    currentDas28Score: { type: 'string', description: 'Current DAS28 if rheumatology' },

                    percentImprovement: { type: 'string', description: 'CRITICAL: Quantitative improvement from baseline (e.g., "50% improvement in EASI", "PASI75 achieved")' },
                    responseCategory: { type: 'string', enum: ['Complete response', 'Excellent response (≥75% improvement)', 'Good response (50-74% improvement)', 'Partial response (25-49% improvement)', 'Minimal response (<25% improvement)', 'No response', 'Worsening'], description: 'Response category' },
                    patientReportedOutcome: { type: 'string', description: 'Patient-reported improvement in symptoms and quality of life' },
                    photographicDocumentation: { type: 'boolean', description: 'Follow-up photos obtained for comparison' }
                  }
                },
                description: 'Serial response assessments with quantitative improvement tracking'
              },

              adverseEvents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    event: { type: 'string', description: 'Adverse event (Injection site reaction, Conjunctivitis, Upper respiratory infection, Headache, etc.)' },
                    severity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'], description: 'Severity grade' },
                    onset: { type: 'string', description: 'When occurred relative to dose' },
                    management: { type: 'string', description: 'How managed (observation, symptomatic treatment, dose modification, discontinuation)' },
                    resolved: { type: 'boolean', description: 'Whether event resolved' }
                  }
                },
                description: 'Adverse events and safety monitoring'
              },

              safetyMonitoring: {
                type: 'object',
                properties: {
                  baselineScreening: {
                    type: 'object',
                    properties: {
                      tbTesting: { type: 'string', description: 'TB screening (IGRA, PPD) for TNF inhibitors' },
                      hepatitisPanel: { type: 'string', description: 'Hepatitis B/C screening' },
                      cbcBaseline: { type: 'string', description: 'Baseline CBC' },
                      lftsBaseline: { type: 'string', description: 'Baseline liver function tests' },
                      pregnancyTest: { type: 'string', description: 'Pregnancy test if applicable' }
                    }
                  },
                  ongoingMonitoring: {
                    type: 'object',
                    properties: {
                      labFrequency: { type: 'string', description: 'How often labs checked (e.g., "CBC and CMP every 3 months")' },
                      infectionScreening: { type: 'string', description: 'Infection surveillance (TB, hepatitis reactivation)' },
                      immunizationStatus: { type: 'string', description: 'Live vaccine contraindications, ensure up-to-date on inactivated vaccines' }
                    }
                  }
                },
                description: 'Safety screening and ongoing monitoring protocols'
              },

              insuranceAuthorization: {
                type: 'object',
                properties: {
                  priorAuthorizationStatus: { type: 'string', enum: ['Approved', 'Denied', 'Pending', 'Appeal in progress'], description: 'Prior authorization status' },
                  approvalDate: { type: 'string', description: 'Date approved' },
                  authorizationPeriod: { type: 'string', description: 'How long approved (e.g., "6 months", "1 year")' },
                  reauthorizationDue: { type: 'string', description: 'When reauthorization needed' },
                  denialReasons: { type: 'array', items: { type: 'string' }, description: 'Reasons for denial if applicable' },
                  appealStatus: { type: 'string', description: 'Appeal status and outcome' },
                  outOfPocketCost: { type: 'string', description: 'Patient out-of-pocket cost per dose' },
                  copayAssistance: {
                    type: 'object',
                    properties: {
                      program: { type: 'string', description: 'Manufacturer copay card or patient assistance program' },
                      enrolled: { type: 'boolean', description: 'Patient enrolled in assistance program' },
                      coverageAmount: { type: 'string', description: 'Amount covered by assistance (e.g., "Up to $13,000/year")' }
                    }
                  }
                },
                description: 'CRITICAL: Insurance authorization tracking (biologics are expensive, PA almost always required)'
              },

              treatmentPlan: {
                type: 'object',
                properties: {
                  shortTermGoals: { type: 'array', items: { type: 'string' }, description: 'Goals for first 3-6 months (e.g., "Achieve 50% reduction in EASI", "Clear face and hands", "Reduce pruritus to <3/10")' },
                  longTermGoals: { type: 'array', items: { type: 'string' }, description: 'Long-term goals (sustained remission, minimal disease activity, off systemic steroids)' },
                  responseThreshold: { type: 'string', description: 'Minimum response to continue therapy (e.g., "If <25% improvement by week 16, consider alternative biologic")' },
                  durationOfTrial: { type: 'string', description: 'How long to trial before assessing efficacy (typically 12-16 weeks)' },
                  concomitantTherapies: { type: 'array', items: { type: 'string' }, description: 'Therapies used alongside biologic (topical steroids, moisturizers, phototherapy)' }
                },
                description: 'Treatment plan with goals and discontinuation criteria'
              },

              switchingBiologics: {
                type: 'object',
                properties: {
                  priorBiologics: { type: 'array', items: { type: 'object', properties: {
                    biologic: { type: 'string' },
                    duration: { type: 'string' },
                    reasonForSwitch: { type: 'string', description: 'Primary failure, secondary loss of response, adverse event, insurance' }
                  }}},
                  washoutPeriod: { type: 'string', description: 'Washout period between biologics if applicable' },
                  rationalForCurrentChoice: { type: 'string', description: 'Why this biologic chosen (different mechanism, better safety profile, insurance coverage)' }
                },
                description: 'Biologic switching history and rationale'
              }
            },
            description: 'EXTRACT biologic therapy records including prior failures, baseline severity, administration plan, quantitative response assessment, adverse events, and insurance authorization'
          },
```

### Step 2: Add Collection to medicalCollectionsService.js

**Add:** `'biologic_therapy_records',` to the `allCollections` array

### Step 3: Add Collection Schema to collectionSchemas.js

```javascript
biologic_therapy_records: {
  fields: {
    biologicAgent: { type: 'string' },
    indication: { type: 'string' },
    mechanismOfAction: { type: 'string' },
    priorTherapies: { type: 'array' },
    baselineDiseaseAssessment: { type: 'object' },
    biologicAdministrationPlan: { type: 'object' },
    firstDoseAdministration: { type: 'object' },
    responseAssessment: { type: 'array' },
    adverseEvents: { type: 'array' },
    safetyMonitoring: { type: 'object' },
    insuranceAuthorization: { type: 'object' },
    treatmentPlan: { type: 'object' },
    switchingBiologics: { type: 'object' }
  }
},
```

### Step 4: Test

```bash
cp services/claudeBatchProcessor.js services/claudeBatchProcessor.js.backup
node -c services/claudeBatchProcessor.js

cp "/home/erangross/Documents/English medical termplates/biologic_therapy_dupilumab.pdf" \
   sample-medical-records/

node scripts/verifyDataExtractionAutoWithCache.js --no-cache
```

### Step 5: Verify

```bash
MONGO_URI=$(cat .kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --quiet --eval "
  db = db.getSiblingDB('intellicare_practice_yale');
  print('Biologic therapy records: ' + db.biologic_therapy_records.countDocuments());
  printjson(db.biologic_therapy_records.findOne());
"
```

## Expected Data

```javascript
{
  biologicAgent: "Dupilumab (Dupixent)",
  indication: "Moderate-to-severe atopic dermatitis",
  mechanismOfAction: "IL-4 and IL-13 inhibitor",
  priorTherapies: [
    {
      therapy: "High-potency topical corticosteroids",
      duration: "2 years",
      response: "Partial response",
      reasonForDiscontinuation: "Inadequate control, skin atrophy from prolonged use"
    },
    {
      therapy: "Cyclosporine",
      duration: "6 months",
      maxDose: "5mg/kg/day",
      response: "Initial response then failure",
      reasonForDiscontinuation: "Loss of efficacy, elevated creatinine"
    }
  ],
  baselineDiseaseAssessment: {
    assessmentDate: "2024-10-15",
    easiScore: "32",
    igaScore: "4",
    bsaPercentage: "45%",
    dlqiScore: "18",
    pruritusNrsScore: "8/10"
  },
  biologicAdministrationPlan: {
    loadingDose: "600mg SC (two 300mg injections) on day 1",
    maintenanceDose: "300mg SC every 2 weeks",
    route: "Subcutaneous",
    frequency: "Every 2 weeks",
    administrationSetting: "Self-injection at home after training"
  },
  responseAssessment: [
    {
      assessmentDate: "2024-12-17",
      weeksOnTherapy: 16,
      currentEasiScore: "12",
      currentIgaScore: "2",
      percentImprovement: "62.5% improvement in EASI (from 32 to 12)",
      responseCategory: "Good response (50-74% improvement)",
      patientReportedOutcome: "Significant reduction in itching, sleeping better, face almost clear"
    }
  ],
  adverseEvents: [
    {
      event: "Injection site erythema and mild swelling",
      severity: "Mild",
      onset: "First 3 doses",
      management: "Ice application, resolved within 24 hours",
      resolved: true
    },
    {
      event: "Conjunctivitis",
      severity: "Mild",
      onset: "Week 8",
      management: "Preservative-free artificial tears, warm compresses",
      resolved: false
    }
  ],
  insuranceAuthorization: {
    priorAuthorizationStatus: "Approved",
    approvalDate: "2024-10-10",
    authorizationPeriod: "1 year",
    reauthorizationDue: "2025-10-10",
    outOfPocketCost: "$150/month with copay card",
    copayAssistance: {
      program: "Dupixent MyWay copay card",
      enrolled: true,
      coverageAmount: "Up to $13,000/year"
    }
  }
}
```

## Success Criteria

✅ Schema added
✅ Collection registered
✅ Prior failures documented
✅ Baseline scores captured
✅ Response assessment with % improvement
✅ Insurance authorization tracked

## Status

- [ ] Schema field added
- [ ] Collection registered
- [ ] Tested with sample PDF
- [ ] MongoDB verified
- [ ] Task complete

---

**Next Task:** task-04-wound-care.md
