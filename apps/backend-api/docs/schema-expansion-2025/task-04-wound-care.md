# Task 04: Wound Care Assessments

**Phase:** 1 (Critical Clinical Data)
**Priority:** High
**PDF Template:** `wound_care_diabetic_foot_ulcer.pdf`
**Target Collection:** `wound_care_assessments`

## Clinical Context

Diabetic foot ulcers and chronic wounds require meticulous documentation for:
- Wound staging and classification (Wagner grade, University of Texas classification)
- Serial measurements (length × width × depth) to track healing
- Wound bed characteristics (granulation, slough, eschar percentages)
- Infection signs and culture results
- Vascular assessment (pulses, ABI, TcPO2)
- Debridement procedures
- Dressing regimens
- Off-loading devices
- Healing progress (% reduction in size, wound closure)

This collection enables wound care tracking, amputation risk assessment, and treatment optimization.

## Implementation Steps

### Step 1: Add Schema Field to claudeBatchProcessor.js

**Location:** (AFTER `biologicTherapyRecords`, BEFORE `careGaps`)

```javascript
          woundCareAssessments: {
            type: 'object',
            properties: {
              woundIdentification: {
                type: 'object',
                properties: {
                  woundNumber: { type: 'string', description: 'Wound identifier if multiple wounds (e.g., "Wound 1", "Right plantar ulcer")' },
                  anatomicLocation: { type: 'string', description: 'Precise anatomic location (e.g., "Right plantar first metatarsal head", "Left lateral malleolus", "Sacrum")' },
                  laterality: { type: 'string', enum: ['Right', 'Left', 'Bilateral', 'Midline'], description: 'Laterality' },
                  woundEtiology: { type: 'string', description: 'Wound cause (Diabetic neuropathic ulcer, Arterial ulcer, Venous stasis ulcer, Pressure injury, Surgical wound, Traumatic wound)' },
                  dateOfOnset: { type: 'string', description: 'When wound first appeared' },
                  durationOfWound: { type: 'string', description: 'How long wound present (e.g., "6 weeks", "3 months", "Chronic - 2 years")' }
                },
                description: 'Wound identification and etiology'
              },

              woundClassification: {
                type: 'object',
                properties: {
                  wagnerGrade: { type: 'string', enum: ['Grade 0 (intact skin, high risk)', 'Grade 1 (superficial ulcer)', 'Grade 2 (deep ulcer to tendon/bone)', 'Grade 3 (deep ulcer with abscess/osteomyelitis)', 'Grade 4 (forefoot gangrene)', 'Grade 5 (whole foot gangrene)'], description: 'Wagner classification for diabetic foot ulcers' },
                  universityOfTexasClass: { type: 'string', description: 'University of Texas Diabetic Wound Classification (Grade 0-3, Stage A-D, e.g., "2B - deep ulcer with infection")' },
                  pressureInjuryStage: { type: 'string', enum: ['Stage 1 (non-blanchable erythema)', 'Stage 2 (partial thickness)', 'Stage 3 (full thickness)', 'Stage 4 (full thickness with exposed bone/muscle)', 'Unstageable (obscured by slough/eschar)', 'Deep tissue injury'], description: 'NPUAP/EPUAP pressure injury staging if applicable' }
                },
                description: 'Wound classification systems'
              },

              woundMeasurements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    measurementDate: { type: 'string', description: 'Date of measurement' },
                    length: { type: 'string', description: 'Longest dimension in cm' },
                    width: { type: 'string', description: 'Width perpendicular to length in cm' },
                    depth: { type: 'string', description: 'Depth in cm (if probing performed)' },
                    area: { type: 'string', description: 'Surface area (length × width in cm²)' },
                    volume: { type: 'string', description: 'Wound volume if calculable (cm³)' },
                    undermining: { type: 'object', properties: {
                      present: { type: 'boolean' },
                      clockPositions: { type: 'string', description: 'Clock positions where undermining present (e.g., "9-12 o\'clock")' },
                      depth: { type: 'string', description: 'Depth of undermining in cm' }
                    }},
                    tunneling: { type: 'object', properties: {
                      present: { type: 'boolean' },
                      clockPosition: { type: 'string', description: 'Clock position of tunnel opening' },
                      depth: { type: 'string', description: 'Tunnel depth in cm' }
                    }},
                    photographicDocumentation: { type: 'boolean', description: 'Wound photograph obtained with ruler for scale' }
                  }
                },
                description: 'Serial wound measurements to track healing progress'
              },

              woundBedCharacteristics: {
                type: 'object',
                properties: {
                  granulationTissue: { type: 'string', description: 'Percentage of wound bed covered by healthy red granulation tissue (e.g., "60%")' },
                  sloughTissue: { type: 'string', description: 'Percentage yellow/tan slough (devitalized tissue)' },
                  necroticTissue: { type: 'string', description: 'Percentage black eschar (necrotic tissue)' },
                  epithelialization: { type: 'string', description: 'Epithelial tissue at wound edges (Pink tissue advancing from edges, indicating healing)' },
                  woundBedColor: { type: 'string', description: 'Overall wound bed appearance (Red - healthy granulation, Yellow - slough, Black - necrotic)' },
                  bioburden: { type: 'string', description: 'Assessment of bacterial load (Clean, Colonized, Infected)' }
                },
                description: 'Wound bed tissue composition - critical for healing assessment'
              },

              exudate: {
                type: 'object',
                properties: {
                  amount: { type: 'string', enum: ['None', 'Scant', 'Small', 'Moderate', 'Large', 'Copious'], description: 'Exudate amount' },
                  type: { type: 'string', enum: ['Serous (clear)', 'Serosanguineous (pink)', 'Sanguineous (bloody)', 'Purulent (thick, cloudy)', 'Seropurulent'], description: 'Exudate type and color' },
                  odor: { type: 'string', enum: ['None', 'Foul', 'Musty'], description: 'Odor (foul odor suggests anaerobic infection)' }
                },
                description: 'Wound drainage characteristics'
              },

              peri WoundSkin: {
                type: 'object',
                properties: {
                  color: { type: 'string', description: 'Periwound skin color (Pink, Red/erythema, Dusky, Cyanotic)' },
                  temperature: { type: 'string', description: 'Periwound temperature (Warm suggests infection, Cool suggests ischemia)' },
                  edema: { type: 'string', enum: ['None', 'Mild', 'Moderate', 'Severe'], description: 'Periwound edema' },
                  induration: { type: 'string', description: 'Firmness/hardness around wound (suggests infection or inflammation)' },
                  maceration: { type: 'boolean', description: 'White/wrinkled skin from excessive moisture' },
                  callus: { type: 'string', description: 'Callus formation (thick hyperkeratotic tissue - impedes healing, requires debridement)' },
                  erythema: { type: 'object', properties: {
                    present: { type: 'boolean' },
                    distance: { type: 'string', description: 'How far erythema extends from wound edge (e.g., "2cm circumferentially")' }
                  }}
                },
                description: 'Periwound skin condition - important for infection detection and moisture management'
              },

              infection Assessment: {
                type: 'object',
                properties: {
                  signsOfInfection: { type: 'array', items: { type: 'string' }, description: 'Clinical signs (Erythema >2cm, Warmth, Purulent drainage, Foul odor, Increased pain, Friable granulation tissue, Delayed healing)' },
                  infectionSeverity: { type: 'string', enum: ['No infection', 'Local infection', 'Spreading infection (cellulitis)', 'Systemic infection (SIRS)'], description: 'Infection severity classification' },
                  cultures: { type: 'array', items: { type: 'object', properties: {
                    cultureDate: { type: 'string' },
                    cultureType: { type: 'string', description: 'Culture method (Swab culture, Tissue biopsy culture - gold standard)' },
                    organisms: { type: 'array', items: { type: 'string' }, description: 'Organisms identified' },
                    sensitivities: { type: 'string', description: 'Antibiotic sensitivities' },
                    mrsaStatus: { type: 'string', enum: ['Positive', 'Negative', 'Not tested'], description: 'MRSA present' }
                  }}},
                  probeToBone: { type: 'boolean', description: 'Probe-to-bone test positive (suggests osteomyelitis)' },
                  osteomyelitis: { type: 'string', description: 'Osteomyelitis assessment (Clinical suspicion, MRI findings, bone biopsy results)' }
                },
                description: 'Infection assessment - critical for treatment decisions'
              },

              vascularAssessment: {
                type: 'object',
                properties: {
                  dorsalisPedisPulse: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'DP pulse' },
                  posteriorTibialPulse: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'PT pulse' },
                  poplitealPulse: { type: 'string', description: 'Popliteal pulse if checked' },
                  capillaryRefillTime: { type: 'string', description: 'Capillary refill time (normal <2 seconds, >3 seconds = poor perfusion)' },
                  anklebrachialIndex: { type: 'string', description: 'ABI (>0.9 normal, 0.5-0.9 moderate PAD, <0.5 severe PAD, >1.3 calcified vessels)' },
                  toePressure: { type: 'string', description: 'Toe pressure in mmHg (>30mmHg adequate for healing)' },
                  tcpo2: { type: 'string', description: 'Transcutaneous oxygen pressure (>40mmHg adequate for healing)' },
                  skinTemperature: { type: 'string', description: 'Foot temperature (Cool = ischemia, Warm = infection or neuropathy)' },
                  dependentRubor: { type: 'boolean', description: 'Foot becomes red when dependent (sign of severe ischemia)' },
                  vascularReferral: { type: 'string', description: 'Vascular surgery referral if significant PAD (for revascularization)' }
                },
                description: 'Vascular assessment - CRITICAL for healing potential in arterial/diabetic wounds'
              },

              neuropathyAssessment: {
                type: 'object',
                properties: {
                  monofilamentTest: { type: 'string', description: '10g monofilament test result (Normal, Loss of protective sensation)' },
                  vibrationSense: { type: 'string', description: '128 Hz tuning fork (Present, Diminished, Absent)' },
                  ankleReflexes: { type: 'string', description: 'Achilles reflex (Present, Diminished, Absent)' },
                  neuropathySeverity: { type: 'string', description: 'Overall neuropathy assessment' }
                },
                description: 'Neuropathy assessment for diabetic foot ulcers'
              },

              debridement: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    debridementDate: { type: 'string', description: 'Date of debridement' },
                    method: { type: 'string', description: 'Debridement method (Sharp/surgical, Enzymatic, Autolytic, Mechanical, Biological/maggots)' },
                    tissueRemoved: { type: 'string', description: 'Type and amount of tissue debrided (Callus, Slough, Necrotic tissue, Bone)' },
                    bleedingAfter: { type: 'string', description: 'Bleeding after debridement (None, Minimal, Moderate - good sign of viable tissue)' },
                    tolerability: { type: 'string', description: 'Patient tolerance of procedure' }
                  }
                },
                description: 'Debridement procedures - remove nonviable tissue to promote healing'
              },

              dressingRegimen: {
                type: 'object',
                properties: {
                  primaryDressing: { type: 'string', description: 'Dressing in direct contact with wound (Hydrogel, Hydrocolloid, Foam, Alginate, Antimicrobial silver, Collagen, Negative pressure, etc.)' },
                  secondaryDressing: { type: 'string', description: 'Cover dressing (Gauze, Foam, Transparent film, Compression wrap)' },
                  dressingFrequency: { type: 'string', description: 'How often changed (Daily, Every 2 days, Weekly, etc.)' },
                  moistureManagement: { type: 'string', description: 'Strategy (Absorb excess exudate with foam/alginate, Add moisture with hydrogel for dry wounds)' },
                  antimicrobialDressing: { type: 'boolean', description: 'Using antimicrobial dressing (silver, cadexomer iodine, PHMB)' }
                },
                description: 'Dressing selection - matched to wound characteristics'
              },

              offloading: {
                type: 'object',
                properties: {
                  device: { type: 'string', description: 'Off-loading device (Total contact cast - gold standard, Removable cast walker [CAM boot], Felted foam, Wheelchair, Crutches/walker, Surgical shoe)' },
                  compliance: { type: 'string', description: 'Patient compliance with off-loading (Excellent, Good, Poor)' },
                  weightBearingStatus: { type: 'string', description: 'Weight-bearing status (Non-weight bearing, Partial weight bearing, Weight bearing as tolerated)' }
                },
                description: 'Off-loading for plantar foot ulcers - CRITICAL for healing'
              },

              adjunctiveTherapies: {
                type: 'array',
                items: { type: 'string' },
                description: 'Adjunctive therapies used (Hyperbaric oxygen, Negative pressure wound therapy [VAC], Platelet-rich plasma, Skin substitutes, Growth factors, Electrical stimulation)'
              },

              healingProgress: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    assessmentDate: { type: 'string' },
                    currentArea: { type: 'string', description: 'Current wound area in cm²' },
                    percentReduction: { type: 'string', description: 'CRITICAL: Percentage reduction from baseline (e.g., "40% smaller than baseline", "Increased 20% - not healing")' },
                    healingRate: { type: 'string', description: 'Healing trajectory (Healing well, Stalled/plateau, Deteriorating)' },
                    expectedTimeToHealing: { type: 'string', description: 'Estimated time to complete closure based on current rate' }
                  }
                },
                description: 'Healing progress tracking with quantitative measurements'
              },

              amputationRisk: {
                type: 'object',
                properties: {
                  riskLevel: { type: 'string', enum: ['Low', 'Moderate', 'High'], description: 'Amputation risk level' },
                  riskFactors: { type: 'array', items: { type: 'string' }, description: 'Risk factors present (Non-healing ulcer >12 weeks, Severe PAD, Osteomyelitis, Gangrene, Non-compliance with off-loading)' },
                  limb SalvagePlan: { type: 'string', description: 'Aggressive limb salvage plan if high risk (Vascular intervention, IV antibiotics, Advanced wound therapies)' }
                },
                description: 'Amputation risk assessment'
              },

              patientEducation: {
                type: 'object',
                properties: {
                  diabeticFootCare: { type: 'boolean', description: 'Educated on daily foot inspection, proper footwear, glucose control' },
                  dressingChangeTechnique: { type: 'boolean', description: 'Taught dressing change if applicable' },
                  offloadingCompliance: { type: 'boolean', description: 'Reinforced importance of off-loading' },
                  signsOfInfection: { type: 'boolean', description: 'Taught to recognize infection signs (increased pain, redness, drainage, fever)' }
                },
                description: 'Patient education provided'
              }
            },
            description: 'EXTRACT comprehensive wound care assessments including staging, measurements, wound bed composition, vascular status, debridement, dressing regimen, off-loading, and healing progress'
          },
```

### Step 2: Add to medicalCollectionsService.js

`'wound_care_assessments',`

### Step 3: Add to collectionSchemas.js

```javascript
wound_care_assessments: {
  fields: {
    woundIdentification: { type: 'object' },
    woundClassification: { type: 'object' },
    woundMeasurements: { type: 'array' },
    woundBedCharacteristics: { type: 'object' },
    exudate: { type: 'object' },
    periwoundSkin: { type: 'object' },
    infectionAssessment: { type: 'object' },
    vascularAssessment: { type: 'object' },
    neuropathyAssessment: { type: 'object' },
    debridement: { type: 'array' },
    dressingRegimen: { type: 'object' },
    offloading: { type: 'object' },
    adjunctiveTherapies: { type: 'array' },
    healingProgress: { type: 'array' },
    amputationRisk: { type: 'object' },
    patientEducation: { type: 'object' }
  }
},
```

### Step 4: Test

```bash
cp services/claudeBatchProcessor.js services/claudeBatchProcessor.js.backup
node -c services/claudeBatchProcessor.js

cp "/home/erangross/Documents/English medical termplates/wound_care_diabetic_foot_ulcer.pdf" \
   sample-medical-records/

node scripts/verifyDataExtractionAutoWithCache.js --no-cache
```

### Step 5: Verify

```bash
MONGO_URI=$(cat .kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --quiet --eval "
  db = db.getSiblingDB('intellicare_practice_yale');
  print('Wound care assessments: ' + db.wound_care_assessments.countDocuments());
  printjson(db.wound_care_assessments.findOne());
"
```

## Success Criteria

✅ Wagner grade captured
✅ Serial measurements tracked
✅ Wound bed percentages recorded
✅ Vascular assessment complete
✅ Healing progress quantified
✅ Amputation risk assessed

## Status

- [ ] Complete

---

**Next Task:** task-05-podiatry.md
