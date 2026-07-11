# Task 05: Podiatry Examinations

**Phase:** 1 (Critical Clinical Data)
**Priority:** High
**PDF Template:** `podiatry_diabetic_foot_exam.pdf`
**Target Collection:** `podiatry_examinations`

## Clinical Context

Diabetic foot exams are essential for amputation prevention, requiring:
- Neuropathy assessment (monofilament, vibration, reflexes)
- Vascular assessment (pulses, ABI)
- Foot deformities (hammer toes, Charcot, bunions)
- Skin and nail conditions
- Risk stratification (IWGDF 0-3 classification)
- Footwear assessment
- Patient education on daily foot care

This collection enables systematic diabetic foot screening and amputation risk mitigation.

## Implementation Steps

### Step 1: Add Schema Field to claudeBatchProcessor.js

**Location:** (AFTER `woundCareAssessments`, BEFORE `careGaps`)

```javascript
          podiatryExaminations: {
            type: 'object',
            properties: {
              indicationForExam: {
                type: 'string',
                description: 'Reason for podiatry evaluation (Annual diabetic foot exam, Foot pain, Wound/ulcer, Nail problem, Routine foot care, Orthotic fitting)'
              },

              neuropathyAssessment: {
                type: 'object',
                properties: {
                  monofilamentTest: {
                    type: 'object',
                    properties: {
                      performed: { type: 'boolean' },
                      rightFoot: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string', description: 'Test site (1st toe, 3rd toe, 5th toe, 1st MTH, 3rd MTH, 5th MTH, Plantar midfoot, Heel)' },
                        sensation: { type: 'string', enum: ['Intact', 'Diminished', 'Absent'], description: 'Can patient feel 10g monofilament' }
                      }}},
                      leftFoot: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string' },
                        sensation: { type: 'string', enum: ['Intact', 'Diminished', 'Absent'] }
                      }}},
                      interpretation: { type: 'string', description: 'Overall result (Normal protective sensation, Loss of protective sensation - HIGH RISK)' }
                    },
                    description: '10g Semmes-Weinstein monofilament test - GOLD STANDARD for neuropathy screening'
                  },

                  vibrationSense: {
                    type: 'object',
                    properties: {
                      performed: { type: 'boolean' },
                      tuningForkFrequency: { type: 'string', description: '128 Hz tuning fork standard' },
                      rightGreatToe: { type: 'string', enum: ['Present', 'Diminished', 'Absent'], description: 'Vibration at right 1st toe dorsum' },
                      leftGreatToe: { type: 'string', enum: ['Present', 'Diminished', 'Absent'], description: 'Vibration at left 1st toe dorsum' },
                      rightMedialMalleolus: { type: 'string', enum: ['Present', 'Diminished', 'Absent'] },
                      leftMedialMalleolus: { type: 'string', enum: ['Present', 'Diminished', 'Absent'] }
                    },
                    description: 'Vibration perception test with 128 Hz tuning fork'
                  },

                  ankleReflexes: {
                    type: 'object',
                    properties: {
                      rightAchilles: { type: 'string', enum: ['Normal (2+)', 'Diminished (1+)', 'Absent (0)'], description: 'Right Achilles reflex' },
                      leftAchilles: { type: 'string', enum: ['Normal (2+)', 'Diminished (1+)', 'Absent (0)'], description: 'Left Achilles reflex' }
                    },
                    description: 'Ankle reflexes'
                  },

                  pinprickTest: {
                    type: 'object',
                    properties: {
                      performed: { type: 'boolean' },
                      rightFoot: { type: 'string', description: 'Pinprick sensation right foot' },
                      leftFoot: { type: 'string', description: 'Pinprick sensation left foot' }
                    },
                    description: 'Pinprick/sharp-dull discrimination'
                  },

                  neuropathySeverity: {
                    type: 'string',
                    enum: ['No neuropathy', 'Mild neuropathy', 'Moderate neuropathy', 'Severe neuropathy - loss of protective sensation'],
                    description: 'Overall neuropathy severity classification'
                  }
                },
                description: 'Comprehensive neuropathy assessment - CRITICAL for ulcer risk'
              },

              vascularAssessment: {
                type: 'object',
                properties: {
                  dorsalisPedisPulse: {
                    type: 'object',
                    properties: {
                      right: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'Right DP pulse' },
                      left: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'Left DP pulse' }
                    }
                  },

                  posteriorTibialPulse: {
                    type: 'object',
                    properties: {
                      right: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'Right PT pulse' },
                      left: { type: 'string', enum: ['0 (absent)', '1+ (diminished)', '2+ (normal)', '3+ (bounding)'], description: 'Left PT pulse' }
                    }
                  },

                  capillaryRefillTime: {
                    type: 'object',
                    properties: {
                      rightFoot: { type: 'string', description: 'CRT right (normal <2 seconds, delayed >3 seconds)' },
                      leftFoot: { type: 'string', description: 'CRT left' }
                    }
                  },

                  skinColor: {
                    type: 'object',
                    properties: {
                      rightFoot: { type: 'string', description: 'Skin color/perfusion (Pink, Pale, Dusky, Rubor)' },
                      leftFoot: { type: 'string', description: 'Skin color/perfusion' }
                    }
                  },

                  skinTemperature: {
                    type: 'object',
                    properties: {
                      rightFoot: { type: 'string', enum: ['Warm', 'Normal', 'Cool', 'Cold'], description: 'Skin temperature right' },
                      leftFoot: { type: 'string', enum: ['Warm', 'Normal', 'Cool', 'Cold'], description: 'Skin temperature left' }
                    }
                  },

                  edema: {
                    type: 'object',
                    properties: {
                      rightFoot: { type: 'string', enum: ['None', 'Mild (1+)', 'Moderate (2+)', 'Severe (3+)', 'Very severe (4+)'], description: 'Pedal edema right' },
                      leftFoot: { type: 'string', enum: ['None', 'Mild (1+)', 'Moderate (2+)', 'Severe (3+)', 'Very severe (4+)'], description: 'Pedal edema left' }
                    }
                  },

                  anklebrachialIndex: {
                    type: 'object',
                    properties: {
                      performed: { type: 'boolean' },
                      rightABI: { type: 'string', description: 'Right ABI value (>0.9 normal, 0.5-0.9 moderate PAD, <0.5 severe PAD, >1.3 calcified)' },
                      leftABI: { type: 'string', description: 'Left ABI value' },
                      interpretation: { type: 'string', description: 'ABI interpretation and clinical significance' }
                    }
                  },

                  vascularReferralNeeded: {
                    type: 'boolean',
                    description: 'Vascular surgery referral indicated (absent pulses, low ABI, nonhealing wounds)'
                  }
                },
                description: 'Vascular assessment - CRITICAL for wound healing potential'
              },

              footStructureDeformities: {
                type: 'object',
                properties: {
                  rightFoot: {
                    type: 'object',
                    properties: {
                      hammerToes: { type: 'array', items: { type: 'string' }, description: 'Which toes (e.g., ["2nd toe", "3rd toe"])' },
                      clawToes: { type: 'array', items: { type: 'string' } },
                      bunion: { type: 'boolean', description: 'Hallux valgus/bunion present' },
                      bunionSeverity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'] },
                      tailorsBunion: { type: 'boolean', description: '5th metatarsal bunionette' },
                      charcotFoot: { type: 'boolean', description: 'Charcot neuroarthropathy present' },
                      charcotStage: { type: 'string', description: 'Eichenholtz stage if Charcot (Acute, Subacute, Chronic/reconstructive)' },
                      flatFoot: { type: 'boolean', description: 'Pes planus (flat foot deformity)' },
                      highArch: { type: 'boolean', description: 'Pes cavus (high arch)' },
                      prominentMTHeads: { type: 'boolean', description: 'Prominent metatarsal heads (pressure points for ulcers)' },
                      otherDeformities: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  leftFoot: {
                    type: 'object',
                    properties: {
                      hammerToes: { type: 'array', items: { type: 'string' } },
                      clawToes: { type: 'array', items: { type: 'string' } },
                      bunion: { type: 'boolean' },
                      bunionSeverity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'] },
                      tailorsBunion: { type: 'boolean' },
                      charcotFoot: { type: 'boolean' },
                      charcotStage: { type: 'string' },
                      flatFoot: { type: 'boolean' },
                      highArch: { type: 'boolean' },
                      prominentMTHeads: { type: 'boolean' },
                      otherDeformities: { type: 'array', items: { type: 'string' } }
                    }
                  }
                },
                description: 'Foot structural deformities - increase ulcer risk'
              },

              skinCondition: {
                type: 'object',
                properties: {
                  rightFoot: {
                    type: 'object',
                    properties: {
                      dryness: { type: 'string', enum: ['Normal', 'Mild dryness', 'Severe dryness/fissures'], description: 'Skin dryness (xerosis)' },
                      calluses: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string', description: 'Callus location (e.g., "Plantar 1st MTH", "Heel")' },
                        severity: { type: 'string', enum: ['Thin', 'Thick', 'Very thick - requires debridement'] }
                      }}},
                      fissures: { type: 'array', items: { type: 'string' }, description: 'Heel or toe fissures (cracks)' },
                      maceration: { type: 'string', description: 'Maceration between toes or plantar' },
                      tinea: { type: 'boolean', description: 'Fungal infection (athlete\'s foot)' },
                      ulcers: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string' },
                        size: { type: 'string' },
                        wagnerGrade: { type: 'string' }
                      }}}
                    }
                  },
                  leftFoot: {
                    type: 'object',
                    properties: {
                      dryness: { type: 'string', enum: ['Normal', 'Mild dryness', 'Severe dryness/fissures'] },
                      calluses: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string' },
                        severity: { type: 'string', enum: ['Thin', 'Thick', 'Very thick - requires debridement'] }
                      }}},
                      fissures: { type: 'array', items: { type: 'string' } },
                      maceration: { type: 'string' },
                      tinea: { type: 'boolean' },
                      ulcers: { type: 'array', items: { type: 'object', properties: {
                        location: { type: 'string' },
                        size: { type: 'string' },
                        wagnerGrade: { type: 'string' }
                      }}}
                    }
                  }
                },
                description: 'Skin condition - dry skin, fissures, calluses, fungal infections'
              },

              nailCondition: {
                type: 'object',
                properties: {
                  rightFoot: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        toe: { type: 'string', description: 'Which toe (1st, 2nd, 3rd, 4th, 5th)' },
                        condition: { type: 'string', description: 'Condition (Normal, Onychomycosis/fungal, Ingrown, Thickened, Dystrophic, Absent)' },
                        ingrownSeverity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe - infected'] },
                        onyaux: { type: 'boolean', description: 'Ram\'s horn nail (severely thickened)' }
                      }
                    }
                  },
                  leftFoot: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        toe: { type: 'string' },
                        condition: { type: 'string' },
                        ingrownSeverity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe - infected'] },
                        onychauxis: { type: 'boolean' }
                      }
                    }
                  }
                },
                description: 'Toenail conditions'
              },

              footwearAssessment: {
                type: 'object',
                properties: {
                  currentFootwear: { type: 'string', description: 'Type of shoes patient wears (Sneakers, Dress shoes, Sandals, Walking barefoot)' },
                  footwearAppropriate: { type: 'boolean', description: 'Is current footwear appropriate for risk level' },
                  footwearProblems: { type: 'array', items: { type: 'string' }, description: 'Problems identified (Too tight, Worn out, No arch support, Pressure points, Walking barefoot)' },
                  insoleCondition: { type: 'string', description: 'Condition of insoles/orthotics if present' },
                  recommendedFootwear: { type: 'string', description: 'Footwear recommendations (Extra-depth shoes, Custom molded shoes, Diabetic shoes with custom orthotics, Rocker-bottom shoes for Charcot)' }
                },
                description: 'Footwear evaluation - CRITICAL for ulcer prevention'
              },

              riskStratification: {
                type: 'object',
                properties: {
                  iwgdfRiskCategory: {
                    type: 'string',
                    enum: [
                      'Category 0 (Very low risk - no LOPS, no PAD)',
                      'Category 1 (Low risk - LOPS or PAD)',
                      'Category 2 (Moderate risk - LOPS + PAD, or LOPS + deformity, or PAD + deformity)',
                      'Category 3 (High risk - LOPS or PAD + prior ulcer or amputation, or ESRD)'
                    ],
                    description: 'International Working Group on Diabetic Foot (IWGDF) risk classification'
                  },
                  recommendedScreeningFrequency: { type: 'string', description: 'How often to screen (Category 0: Annual, Category 1: 6-12 months, Category 2: 3-6 months, Category 3: 1-3 months)' },
                  ulcerRisk: { type: 'string', enum: ['Low', 'Moderate', 'High', 'Very high'], description: 'Overall ulcer risk' },
                  amputationRisk: { type: 'string', enum: ['Low', 'Moderate', 'High'], description: 'Amputation risk' }
                },
                description: 'Risk stratification using IWGDF system - guides screening interval and interventions'
              },

              treatmentPlan: {
                type: 'object',
                properties: {
                  callusDebridement: { type: 'boolean', description: 'Callus debridement performed today' },
                  nailTrimming: { type: 'boolean', description: 'Nail trimming performed' },
                  ingrownNailTreatment: { type: 'string', description: 'Ingrown nail treatment (Conservative, Partial nail avulsion, Phenolization)' },
                  moisturizerRecommended: { type: 'boolean', description: 'Moisturizer for dry skin prescribed/recommended' },
                  antifungalTreatment: { type: 'string', description: 'Antifungal therapy if onychomycosis (Topical, Oral terbinafine/itraconazole)' },
                  diabeticShoesPrescribed: { type: 'boolean', description: 'Prescription for diabetic shoes + custom orthotics' },
                  referrals: { type: 'array', items: { type: 'string' }, description: 'Referrals (Vascular surgery, Endocrinology for glucose control, Wound care, Orthopedic surgery, Orthotist)' },
                  followUpInterval: { type: 'string', description: 'When to return for follow-up (based on risk category)' }
                },
                description: 'Treatment plan'
              },

              patientEducation: {
                type: 'object',
                properties: {
                  dailyFootInspection: { type: 'boolean', description: 'Taught to inspect feet daily (use mirror for plantar surface)' },
                  properFootwear: { type: 'boolean', description: 'Educated on proper footwear (no walking barefoot, check inside shoes for foreign objects)' },
                  moisturizing: { type: 'boolean', description: 'Taught to moisturize feet (but NOT between toes)' },
                  nailCare: { type: 'boolean', description: 'Nail care instructions (trim straight across, file edges)' },
                  glycemicControl: { type: 'boolean', description: 'Emphasized importance of glucose control for neuropathy prevention' },
                  whenToSeekCare: { type: 'boolean', description: 'Taught to seek immediate care for wounds, infections, color changes' }
                },
                description: 'Patient education provided'
              }
            },
            description: 'EXTRACT comprehensive podiatry diabetic foot examination including neuropathy testing, vascular assessment, deformities, risk stratification, and prevention strategies'
          },
```

### Step 2: Add to medicalCollectionsService.js

`'podiatry_examinations',`

### Step 3: Add to collectionSchemas.js

```javascript
podiatry_examinations: {
  fields: {
    indicationForExam: { type: 'string' },
    neuropathyAssessment: { type: 'object' },
    vascularAssessment: { type: 'object' },
    footStructureDeformities: { type: 'object' },
    skinCondition: { type: 'object' },
    nailCondition: { type: 'object' },
    footwearAssessment: { type: 'object' },
    riskStratification: { type: 'object' },
    treatmentPlan: { type: 'object' },
    patientEducation: { type: 'object' }
  }
},
```

### Step 4-5: Test and Verify

```bash
cp services/claudeBatchProcessor.js services/claudeBatchProcessor.js.backup
node -c services/claudeBatchProcessor.js

cp "/home/erangross/Documents/English medical termplates/podiatry_diabetic_foot_exam.pdf" \
   sample-medical-records/

node scripts/verifyDataExtractionAutoWithCache.js --no-cache

MONGO_URI=$(cat .kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --quiet --eval "
  db = db.getSiblingDB('intellicare_practice_yale');
  print('Podiatry exams: ' + db.podiatry_examinations.countDocuments());
  printjson(db.podiatry_examinations.findOne());
"
```

## Success Criteria

✅ Monofilament test results captured
✅ IWGDF risk category determined
✅ Foot deformities documented
✅ Footwear assessment complete
✅ Patient education tracked

## Status

- [ ] Complete

---

**Next Task:** task-06-neuropsych-enhanced.md
