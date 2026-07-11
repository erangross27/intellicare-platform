# Task 06: Enhanced Neuropsychological Assessments

**Phase:** 1 (Critical Clinical Data)
**Priority:** High
**PDF Template:** `neuropsychological_testing_post_surgery.pdf`
**Target Collection:** Extends existing `neuropsychological_assessments`

## Clinical Context

Detailed neuropsychological testing provides:
- Domain-specific cognitive scores (memory, attention, executive function, language, visuospatial)
- Percentile rankings compared to normative data
- Pre/post-operative comparisons for surgical outcomes
- Functional implications for daily living
- Cognitive rehabilitation recommendations

This enhances the existing neuropsychological_assessments collection with comprehensive test batteries.

## Implementation Steps

### Step 1: Add Schema Fields to claudeBatchProcessor.js

**Location:** Find the existing `neuropsychologicalAssessments` field (search for it), and ENHANCE it with additional properties.

**Important:** This task is different - we're EXTENDING an existing field, not creating a new one.

**What to add:** Search for `neuropsychologicalAssessments:` in claudeBatchProcessor.js and add these additional properties to its existing properties object:

```javascript
          // Inside existing neuropsychologicalAssessments properties, add:

          comprehensiveTestBattery: {
            type: 'object',
            properties: {
              batteryName: { type: 'string', description: 'Test battery administered (e.g., "Halstead-Reitan", "Wechsler Adult Intelligence Scale", "Comprehensive Trail Making Test")' },
              testDate: { type: 'string', description: 'Date of testing' },
              testDuration: { type: 'string', description: 'Duration of testing session (e.g., "4 hours")' },
              examinee: { type: 'string', description: 'Neuropsychologist who administered tests' },
              testingConditions: { type: 'string', description: 'Conditions (Optimal, Suboptimal due to fatigue/pain/anxiety)' },
              effortTesting: { type: 'string', description: 'Effort validity testing results (Adequate effort, Insufficient effort)' }
            },
            description: 'Test battery administration details'
          },

          cognitiveDomainsDetailed: {
            type: 'object',
            properties: {
              memory: {
                type: 'object',
                properties: {
                  verbalMemory: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test name (e.g., "CVLT-II", "WMS-IV Logical Memory")' },
                      immediateRecall: { type: 'object', properties: {
                        rawScore: { type: 'string' },
                        scaledScore: { type: 'string' },
                        percentile: { type: 'string', description: 'Percentile compared to age-matched norms' },
                        classification: { type: 'string', enum: ['Superior', 'High average', 'Average', 'Low average', 'Borderline', 'Impaired'] }
                      }},
                      delayedRecall: { type: 'object', properties: {
                        rawScore: { type: 'string' },
                        scaledScore: { type: 'string' },
                        percentile: { type: 'string' },
                        classification: { type: 'string', enum: ['Superior', 'High average', 'Average', 'Low average', 'Borderline', 'Impaired'] }
                      }},
                      recognition: { type: 'object', properties: {
                        rawScore: { type: 'string' },
                        scaledScore: { type: 'string' },
                        percentile: { type: 'string' },
                        classification: { type: 'string', enum: ['Superior', 'High average', 'Average', 'Low average', 'Borderline', 'Impaired'] }
                      }}
                    }
                  },
                  visualMemory: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test name (e.g., "BVMT-R", "WMS-IV Visual Reproduction")' },
                      immediateRecall: { type: 'object', properties: { rawScore: { type: 'string' }, percentile: { type: 'string' }, classification: { type: 'string' } }},
                      delayedRecall: { type: 'object', properties: { rawScore: { type: 'string' }, percentile: { type: 'string' }, classification: { type: 'string' } }}
                    }
                  },
                  workingMemory: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test name (e.g., "WAIS-IV Digit Span", "Letter-Number Sequencing")' },
                      digitSpanForward: { type: 'object', properties: { rawScore: { type: 'string' }, percentile: { type: 'string' } }},
                      digitSpanBackward: { type: 'object', properties: { rawScore: { type: 'string' }, percentile: { type: 'string' } }},
                      overallWorkingMemory: { type: 'object', properties: { percentile: { type: 'string' }, classification: { type: 'string' } }}
                    }
                  }
                },
                description: 'Memory domain - verbal, visual, and working memory'
              },

              attention: {
                type: 'object',
                properties: {
                  sustainedAttention: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "CPT-3", "TOVA")' },
                      omissionErrors: { type: 'string', description: 'Missed targets (higher = inattention)' },
                      commissionErrors: { type: 'string', description: 'False positives (higher = impulsivity)' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  },
                  selectiveAttention: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "Stroop Color-Word Test")' },
                      score: { type: 'string' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  },
                  processingSpeed: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "WAIS-IV Coding", "Symbol Search", "Trail Making Test A")' },
                      score: { type: 'string' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  }
                },
                description: 'Attention domain - sustained, selective, processing speed'
              },

              executiveFunction: {
                type: 'object',
                properties: {
                  cognitiveFlexibility: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "Trail Making Test B", "Wisconsin Card Sorting Test")' },
                      score: { type: 'string' },
                      perseverativeErrors: { type: 'string', description: 'For WCST - inability to shift sets' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  },
                  planning: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "Tower of London", "DKEFS Tower Test")' },
                      score: { type: 'string' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  },
                  inhibition: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "Stroop Interference", "Go/No-Go")' },
                      score: { type: 'string' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  },
                  verbalFluency: {
                    type: 'object',
                    properties: {
                      phoneticFluency: { type: 'object', properties: { testUsed: { type: 'string', description: 'FAS test' }, score: { type: 'string' }, percentile: { type: 'string' } }},
                      semanticFluency: { type: 'object', properties: { testUsed: { type: 'string', description: 'Category fluency (animals, etc.)' }, score: { type: 'string' }, percentile: { type: 'string' } }}
                    }
                  }
                },
                description: 'Executive function - flexibility, planning, inhibition, fluency'
              },

              language: {
                type: 'object',
                properties: {
                  confrontationNaming: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "Boston Naming Test")' },
                      score: { type: 'string' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  },
                  comprehension: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "Token Test", "WAIS-IV Comprehension")' },
                      score: { type: 'string' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  },
                  repetition: {
                    type: 'object',
                    properties: {
                      score: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  }
                },
                description: 'Language domain - naming, comprehension, repetition'
              },

              visuospatial: {
                type: 'object',
                properties: {
                  visualConstruction: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "Rey-Osterrieth Complex Figure Copy", "Block Design")' },
                      score: { type: 'string' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  },
                  visualPerception: {
                    type: 'object',
                    properties: {
                      testUsed: { type: 'string', description: 'Test (e.g., "Visual Object and Space Perception Battery")' },
                      score: { type: 'string' },
                      percentile: { type: 'string' },
                      classification: { type: 'string' }
                    }
                  }
                },
                description: 'Visuospatial domain - construction, perception'
              }
            },
            description: 'Detailed cognitive domain testing with percentiles and classifications'
          },

          prePostComparison: {
            type: 'object',
            properties: {
              preOperativeBaseline: { type: 'string', description: 'Date of pre-operative testing' },
              postOperativeFollowUp: { type: 'string', description: 'Date of post-operative testing' },
              intervalBetweenTests: { type: 'string', description: 'Time between tests (e.g., "6 months post-op")' },
              domainChanges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    domain: { type: 'string', description: 'Cognitive domain (Memory, Attention, Executive, Language, Visuospatial)' },
                    preOperativePercentile: { type: 'string' },
                    postOperativePercentile: { type: 'string' },
                    changeDirection: { type: 'string', enum: ['Improved', 'Stable', 'Declined'], description: 'Direction of change' },
                    clinicalSignificance: { type: 'string', description: 'Is change clinically significant (>1 SD = significant)' }
                  }
                },
                description: 'Domain-by-domain pre/post comparison'
              },
              overallOutcome: { type: 'string', description: 'Overall cognitive outcome (Improved, No change, Mild decline, Moderate decline, Severe decline)' }
            },
            description: 'Pre/post-operative comparison - for surgical outcome assessment'
          },

          functionalImplications: {
            type: 'object',
            properties: {
              workCapacity: { type: 'string', description: 'Ability to work (Full capacity, Reduced capacity, Unable to work, Modified duties needed)' },
              drivingSafety: { type: 'string', description: 'Driving safety assessment (Safe to drive, Needs driving evaluation, Should not drive)' },
              independentLiving: { type: 'string', description: 'Can live independently (Fully independent, Needs supervision, Needs assistance with IADLs/ADLs)' },
              medicationManagement: { type: 'string', description: 'Ability to manage medications independently' },
              financialManagement: { type: 'string', description: 'Ability to handle finances' },
              socialFunctioning: { type: 'string', description: 'Impact on social relationships and activities' }
            },
            description: 'Functional implications of cognitive deficits for daily living'
          },

          cognitiveRehabilitationPlan: {
            type: 'object',
            properties: {
              indicated: { type: 'boolean', description: 'Is cognitive rehabilitation recommended' },
              targetDomains: { type: 'array', items: { type: 'string' }, description: 'Cognitive domains to target (Memory, Attention, Executive function, etc.)' },
              recommendedFrequency: { type: 'string', description: 'Recommended frequency (e.g., "2x per week for 12 weeks")' },
              compensatoryStrategies: { type: 'array', items: { type: 'string' }, description: 'Strategies taught (Memory aids, Calendar/organizer, Environmental modifications, etc.)' },
              referralMade: { type: 'boolean', description: 'Referral made to cognitive rehabilitation specialist' }
            },
            description: 'Cognitive rehabilitation recommendations'
          },

          diagnosisImplications: {
            type: 'object',
            properties: {
              cognitiveDisorders: { type: 'array', items: { type: 'string' }, description: 'Cognitive diagnoses supported (Mild Cognitive Impairment, Dementia, Post-surgical cognitive dysfunction, Traumatic brain injury sequelae)' },
              severity: { type: 'string', enum: ['Normal cognition', 'Mild impairment', 'Moderate impairment', 'Severe impairment'], description: 'Overall severity' },
              prognosis: { type: 'string', description: 'Prognosis for recovery or progression' }
            },
            description: 'Diagnostic and prognostic implications'
          }
```

**CRITICAL:** These fields should be added to the EXISTING `neuropsychologicalAssessments` properties object, not create a new field.

### Step 2: No Collection Registration Needed

This extends an existing collection, so NO changes to medicalCollectionsService.js are needed.

### Step 3: Update Collection Schema in collectionSchemas.js

**Find:** The existing `neuropsychological_assessments` entry

**Update:** Add the new fields to its fields object:

```javascript
neuropsychological_assessments: {
  fields: {
    // ... existing fields ...
    comprehensiveTestBattery: { type: 'object' },
    cognitiveDomainsDetailed: { type: 'object' },
    prePostComparison: { type: 'object' },
    functionalImplications: { type: 'object' },
    cognitiveRehabilitationPlan: { type: 'object' },
    diagnosisImplications: { type: 'object' }
  }
},
```

### Step 4: Test

```bash
cp services/claudeBatchProcessor.js services/claudeBatchProcessor.js.backup
node -c services/claudeBatchProcessor.js

cp "/home/erangross/Documents/English medical termplates/neuropsychological_testing_post_surgery.pdf" \
   sample-medical-records/

node scripts/verifyDataExtractionAutoWithCache.js --no-cache
```

### Step 5: Verify

```bash
MONGO_URI=$(cat .kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --quiet --eval "
  db = db.getSiblingDB('intellicare_practice_yale');
  const doc = db.neuropsychological_assessments.findOne();
  if (doc && doc.cognitiveDomainsDetailed) {
    print('✅ Enhanced neuropsych fields present');
    printjson(doc.cognitiveDomainsDetailed);
  } else {
    print('❌ Enhanced fields not found');
  }
"
```

## Success Criteria

✅ Comprehensive test battery captured
✅ Domain-specific percentiles recorded
✅ Pre/post surgical comparison tracked
✅ Functional implications documented
✅ Cognitive rehab recommendations included

## Status

- [ ] Complete

---

**Phase 1 Complete!** All 6 critical clinical schemas defined.
**Next:** Phase 2 tasks (specialized testing)
