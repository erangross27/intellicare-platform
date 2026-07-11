# ACT Score Tracking (Asthma Control Test)

## Purpose
Track asthma control over time using validated ACT questionnaire. Required for biologic therapy monitoring and quality measure reporting.

---

## Clinical Background

### What is ACT?
- 5-question validated questionnaire
- Scored 5-25 points
- <15 = Poorly controlled
- 15-19 = Not well controlled
- 20-25 = Well controlled

### Why Track It?
- **Biologic Monitoring:** Required every 3 months for Dupilumab/Xolair
- **Quality Measures:** HEDIS/MIPS asthma control reporting
- **Treatment Decisions:** Guides step-up/step-down therapy
- **Patient Engagement:** Visual progress tracking

---

## Data Model

### Collection: `act_scores`

#### Schema
```
{
  patientId: ObjectId (required),
  testDate: Date (required),
  scores: {
    question1: Number (1-5),  // Shortness of breath in past 4 weeks
    question2: Number (1-5),  // Asthma waking you at night
    question3: Number (1-5),  // Rescue inhaler use
    question4: Number (1-5),  // Activity limitation
    question5: Number (1-5)   // Overall asthma control rating
  },
  totalScore: Number (5-25, required),
  interpretation: String (enum: ['poorly-controlled', 'not-well-controlled', 'well-controlled']),
  recordedBy: {
    type: String (enum: ['patient', 'provider', 'staff']),
    userId: ObjectId
  },
  metadata: {
    treatmentContext: String,  // 'baseline', 'biologic-followup', 'routine'
    biologicName: String,      // If on biologic therapy
    monthsOnBiologic: Number,  // Duration if applicable
    notes: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## Functions Needed

### Core Functions
```javascript
recordACTScore(patientId, scores, context)
// Returns: { success, totalScore, interpretation, trendAnalysis }

getACTHistory(patientId, dateRange)
// Returns: Array of ACT scores with trends

getLatestACTScore(patientId)
// Returns: Most recent ACT with comparison to previous

calculateACTTrend(patientId, timeframe)
// Returns: Improving/stable/worsening + statistical significance

getBiologicACTResponse(patientId, biologicName)
// Returns: Pre/post biologic ACT comparison
```

### Analytics Functions
```javascript
identifyPoorlyControlledPatients(practiceId)
// Returns: Patients with ACT <15 needing intervention

getPatientsNeedingACT(practiceId)
// Returns: Patients on biologics >3 months since last ACT

generateACTReport(patientId, format)
// Returns: Visual report for patient/provider
```

---

## User Interface

### Provider View
**Location:** Patient dashboard, asthma section

**Components:**
1. **ACT Score Widget**
   - Current score with color coding (red/yellow/green)
   - Trend arrow (↑↓→)
   - Days since last test
   - "Record New ACT" button

2. **ACT History Graph**
   - Line chart of scores over time
   - Treatment changes marked (medication starts/stops)
   - Exacerbation events marked
   - Biologic initiation marked

3. **ACT Entry Form**
   - 5 questions with 1-5 scale
   - Auto-calculation of total
   - Interpretation displayed
   - Save to patient record

### Patient Portal View
**Location:** My Asthma section

**Components:**
1. **Self-Administered ACT**
   - Mobile-friendly questionnaire
   - Plain language questions
   - Immediate feedback
   - Historical tracking

2. **Progress Dashboard**
   - Current score vs goal (20+)
   - Improvement since last test
   - Personalized message based on score
   - Next test reminder

---

## Business Logic

### Scoring Rules
```
Total = Sum of 5 questions (each 1-5)
Range: 5-25

Interpretation:
- 5-14: Poorly controlled → Alert provider
- 15-19: Not well controlled → Consider treatment adjustment
- 20-25: Well controlled → Continue current plan
```

### Alerting Rules
```
Trigger alerts when:
1. Score <15 (poorly controlled)
2. Score drops >5 points from previous
3. Patient on biologic >3 months with no recent ACT
4. Score not improving after treatment change
```

### Trend Analysis
```
Compare to previous scores:
- Improving: Increase ≥3 points
- Stable: Change <3 points
- Worsening: Decrease ≥3 points

Minimum Clinically Important Difference (MCID): 3 points
```

---

## Integration Points

### Triggers
1. **Biologic Start:** Prompt for baseline ACT
2. **Follow-up Visit:** Suggest ACT if >3 months
3. **Exacerbation:** Record post-event ACT
4. **Treatment Change:** Measure response at 4-6 weeks

### Connected Data
- **Medications:** Correlate with controller med changes
- **Lab Results:** Compare to FeNO, eosinophils
- **Exacerbations:** Track control between events
- **Spirometry:** Correlate objective/subjective measures

---

## Quality Measures

### HEDIS Asthma Medication Ratio (AMR)
- Requires documentation of control assessment
- ACT satisfies this requirement

### MIPS Quality ID 107
- Asthma control assessment at visits
- ACT is accepted tool

### Value-Based Care
- Document asthma control improvement
- Justify biologic continuation
- Support shared decision-making

---

## Implementation Notes

### Data Validation
- All 5 questions required
- Each question must be 1-5
- Total must equal sum
- Test date cannot be future
- Patient must exist

### Security
- PHI - requires encryption
- Patient can view own scores
- Providers can view their patients
- Practice-level reporting de-identified

### Performance
- Index on patientId + testDate
- Cache latest score per patient
- Aggregate queries for trend analysis

---

## Success Criteria

### Adoption
- ✅ 90% of asthma patients have baseline ACT
- ✅ 100% of biologic patients have ACT every 3 months
- ✅ 70% of patients complete self-administered ACT

### Clinical Impact
- ✅ 50% of poorly-controlled patients show improvement within 6 months
- ✅ Biologic patients average ACT increase of 5+ points
- ✅ Treatment adjustments documented for ACT <20

### Quality Reporting
- ✅ 100% HEDIS AMR compliance
- ✅ 95% MIPS Quality ID 107 compliance
- ✅ Ready for value-based care reporting

---

## Timeline
**Week 1:** Database schema + core functions
**Week 2:** Provider UI + entry forms
**Week 3:** Patient portal integration
**Week 4:** Reporting + quality measures

**Total Effort:** 40 hours
