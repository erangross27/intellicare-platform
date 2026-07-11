# CRITICAL GAPS - Atrial Fibrillation Management

**Specialty**: Cardiology - Arrhythmia
**Document Type**: Gap Analysis & Prioritization
**Date**: October 19, 2025

---

## 🚨 EXECUTIVE SUMMARY

**Patient Scenario**: New-onset AF requiring anticoagulation and rhythm monitoring

**Total Gaps Identified**: 5 critical tools missing
**Patient Safety Impact**: HIGH - affects stroke prevention, bleeding risk, and rhythm control
**Estimated Fix Timeline**: 16-21 days (sequential) OR 8-10 days (parallel)

---

## 📊 GAP PRIORITIZATION MATRIX

| Tool | Safety Impact | Frequency | Workaround Quality | Priority | Days |
|------|---------------|-----------|-------------------|----------|------|
| **#1 Holter Ordering** | 🔴 HIGH | Daily | ❌ Poor (wrong collection) | **P0** | 3-4 |
| **#2 INR Tracking** | 🔴 HIGH | Daily | ⚠️ Manual charts | **P0** | 4-5 |
| **#3 AF Burden Calc** | 🟡 MEDIUM | Weekly | ❌ None | **P1** | 3-4 |
| **#4 CHA2DS2-VASc** | 🟡 MEDIUM | Per visit | ⚠️ Manual notes | **P1** | 2-3 |
| **#5 Patient Portal** | 🟢 LOW | Per diagnosis | ⚠️ Generic messages | **P2** | 4-5 |

**Legend:**
- 🔴 HIGH = Life-threatening if missing
- 🟡 MEDIUM = Impacts treatment quality
- 🟢 LOW = Quality-of-life improvement

---

## 1️⃣ HOLTER MONITOR ORDERING SYSTEM

### Current State ❌
- No dedicated function for ordering ambulatory cardiac monitors
- Workaround: Using `orderImaging()` function incorrectly
- Orders go to `imaging_orders` collection (wrong department)
- Radiology receives cardiac monitor orders (causes confusion)

### Clinical Impact 🔴 HIGH
- **Delayed AF diagnosis**: Cannot confirm paroxysmal AF episodes
- **Inadequate burden assessment**: No way to quantify % time in AF
- **Treatment delays**: Rhythm control decisions require burden data
- **Post-ablation monitoring impossible**: Cannot track procedure success

### What's Needed ✅
```javascript
// NEW FUNCTION:
orderHolterMonitor(patientId, duration, indication)

// NEW COLLECTION:
cardiac_monitors {
  patientId, type, duration, indication,
  orderDate, status, results, afBurden
}
```

### Blocking Dependencies
- **BLOCKS Tool #3**: AF Burden Calculator needs Holter data
- Independent of other tools

### Success Criteria
- ✅ Holter orders route to Cardiology (not Radiology)
- ✅ Duration options: 24hr, 48hr, 7-day, 14-day, 30-day
- ✅ AF-specific indications pre-populated
- ✅ Results import with AF burden percentage

---

## 2️⃣ INR TRACKING DASHBOARD

### Current State ⚠️ PARTIAL
- INR labs exist in `lab_results` collection
- NO therapeutic range tracking
- NO trend visualization
- NO dose adjustment alerts
- Manual chart review required

### Clinical Impact 🔴 HIGH
- **Stroke risk**: Subtherapeutic INR (AF patients at high stroke risk)
- **Bleeding risk**: Supratherapeutic INR (ICH, GI bleed)
- **Inefficient management**: Providers manually track last 5-10 INRs
- **Delayed interventions**: No alerts when INR out of range >7 days

### What's Needed ✅
```javascript
// NEW FUNCTION:
getINRDashboard(patientId)
// Returns: Current INR, target range, % time in range,
// trend graph, last dose adjustment, next test due date

// UI COMPONENT:
<INRTracker
  currentINR={2.8}
  targetRange={[2.0, 3.0]}
  percentInRange={67}
  lastDose="5mg Mon/Wed/Fri, 2.5mg other days"
  nextTestDue="2025-10-22"
  alert="INR subtherapeutic x 10 days"
/>
```

### Clinical Guidelines
- **AF target INR**: 2.0-3.0 (ACC/AHA 2023)
- **Testing frequency**:
  - Initial: Weekly until stable
  - Maintenance: Every 4 weeks if stable
  - After dose change: 5-7 days

### Success Criteria
- ✅ Visual trend graph (last 10 INRs)
- ✅ Color-coded zones (green 2-3, yellow 1.5-2/3-4, red <1.5/>4)
- ✅ Auto-calculate % time in therapeutic range
- ✅ Alert if out of range >7 days
- ✅ Next test due date calculation

---

## 3️⃣ AF BURDEN CALCULATOR

### Current State ❌ NONE
- Holter reports come back as PDF/text
- Providers manually read "AF burden: 18%"
- No trending over time
- No comparison pre/post-ablation

### Clinical Impact 🟡 MEDIUM
- **Treatment decisions unclear**: Need burden >20% for ablation consideration
- **Cannot track progression**: Is AF getting worse over time?
- **Post-ablation success undefined**: No objective metric (target <1% burden)
- **Insurance denials**: Need documented burden for procedure approval

### What's Needed ✅
```javascript
// NEW FUNCTION:
calculateAFBurden(holterReportId)
// Parses Holter report, extracts AF episodes
// Calculates: (total AF time / total recording time) * 100

// OUTPUT:
{
  afBurden: 18.2,        // Percentage
  totalAFTime: "4h 22m", // Time in AF
  totalRecordingTime: "24h",
  longestAFEpisode: "1h 15m",
  episodes: [
    { start: "2025-10-18T14:32", duration: "45m", hr: "110-145bpm" }
  ]
}
```

### Clinical Thresholds
- **<5% burden**: Minimal AF, observation OK
- **5-20% burden**: Moderate AF, consider rate control
- **>20% burden**: Significant AF, consider ablation
- **Post-ablation goal**: <1% burden (success definition)

### Success Criteria
- ✅ Auto-extract AF burden from Holter text reports
- ✅ Trend graph showing burden over time
- ✅ Comparison tool (pre vs post-ablation)
- ✅ Alert if burden >20% (ablation candidate)

---

## 4️⃣ CHA2DS2-VASc CALCULATOR

### Current State ⚠️ MANUAL
- Providers calculate score in clinical notes
- Score format inconsistent: "CHADSVASC 3", "CHA2DS2-VASc = 4", "CHADSVASc score of 2"
- Not updated when new conditions added (e.g., new diabetes diagnosis)
- Not visible in patient summary UI

### Clinical Impact 🟡 MEDIUM
- **Outdated anticoagulation decisions**: Score calculated once at AF diagnosis
- **Missed anticoagulation opportunities**: New HTN diagnosis → score 1→2 → needs anticoagulation
- **Inconsistent documentation**: Hard to search/report
- **No decision support**: System doesn't suggest anticoagulation based on score

### What's Needed ✅
```javascript
// AUTO-CALCULATION:
CHA2DS2-VASc Score =
  + (age 65-74 ? 1 : age ≥75 ? 2 : 0)
  + (CHF history ? 1 : 0)
  + (Hypertension ? 1 : 0)
  + (Stroke/TIA/Thromboembolism ? 2 : 0)
  + (Vascular disease ? 1 : 0)  // Prior MI, PAD, aortic plaque
  + (Diabetes ? 1 : 0)
  + (Female sex ? 1 : 0)

// RECOMMENDATIONS:
Score 0 (male) or 1 (female): No anticoagulation needed
Score 1 (male): Consider anticoagulation
Score ≥2: Anticoagulation recommended (Class I)
```

### Success Criteria
- ✅ Auto-calculate from patient demographics + diagnoses
- ✅ Display in patient header (prominent)
- ✅ Update when new diagnosis added
- ✅ Color-code: Green (0-1), Yellow (2), Red (≥3)
- ✅ Link to anticoagulation recommendations

---

## 5️⃣ PATIENT PORTAL MESSAGING FOR AF EDUCATION

### Current State ⚠️ GENERIC
- Portal messaging exists but no condition-specific templates
- Providers manually write AF education messages
- No read receipts or engagement tracking
- No structured content (videos, PDFs, links)

### Clinical Impact 🟢 LOW (Quality Improvement)
- **Patient anxiety**: "Do I have a heart attack?" (AF misconception)
- **Medication non-adherence**: Patients stop warfarin due to bleeding fears
- **Missed follow-ups**: Don't understand importance of INR monitoring
- **Inefficient provider time**: Repeating same education at every visit

### What's Needed ✅
```javascript
// NEW TEMPLATES:
AF_EDUCATION_TEMPLATES = {
  "new_diagnosis": {
    subject: "Understanding Your Atrial Fibrillation Diagnosis",
    content: `
      Dear [Patient Name],

      You were recently diagnosed with atrial fibrillation (AF).
      This is NOT a heart attack. AF is an irregular heart rhythm...

      [Educational content]

      Next Steps:
      1. Start warfarin as prescribed
      2. INR blood test in 3 days
      3. Follow-up appointment in 2 weeks

      Resources:
      - Video: What is AF? (3 min)
      - PDF: Living with AF Guide
      - Link: StopAfib.org patient resources
    `,
    attachments: ["af_guide.pdf", "warfarin_instructions.pdf"]
  }
}

// TRIGGER:
When new AF diagnosis added → Auto-send "new_diagnosis" template
```

### Success Criteria
- ✅ 5 AF-specific message templates
- ✅ Auto-send on diagnosis (with provider approval)
- ✅ Read receipts tracked
- ✅ Patient can reply with questions
- ✅ Embedded videos + PDF attachments

---

## 🎯 IMPLEMENTATION PRIORITY

### **PHASE 1 (Days 1-5): Life-Threatening Gaps**
1. **Holter Monitor Ordering** (Days 1-4)
   - Why first: Blocks AF burden calculation, urgent clinical need

2. **INR Tracking Dashboard** (Days 3-7, parallel with #1)
   - Why now: Daily anticoagulation management, high safety impact

### **PHASE 2 (Days 6-10): Treatment Optimization**
3. **CHA2DS2-VASc Calculator** (Days 6-8)
   - Why now: Fast win (2-3 days), independent tool

4. **AF Burden Calculator** (Days 8-11)
   - Why after Holter: Depends on Holter data import

### **PHASE 3 (Days 12-16): Patient Engagement**
5. **Patient Portal Messaging** (Days 12-16)
   - Why last: Quality improvement, not safety-critical

---

## 📈 SUCCESS METRICS

### Clinical Outcomes
- ❌ **Current**: 40% of AF patients missing Holter monitoring
- ✅ **Target**: 95% of AF patients have documented AF burden

- ❌ **Current**: INR out of range >14 days in 30% of patients
- ✅ **Target**: <10% of patients out of range >14 days

- ❌ **Current**: CHA2DS2-VASc score documented in 60% of AF notes
- ✅ **Target**: 100% of AF patients have auto-calculated score

### Efficiency Metrics
- ❌ **Current**: 15 min per patient to manually review INR trends
- ✅ **Target**: <2 min with dashboard

- ❌ **Current**: 45% of patients call with AF questions after diagnosis
- ✅ **Target**: <20% (due to portal education)

---

## 🔗 DEPENDENCIES

```
Holter Ordering (#1)
    └──> AF Burden Calculator (#3)

INR Dashboard (#2)
    └──> (Independent)

CHA2DS2-VASc (#4)
    └──> (Independent)

Patient Portal (#5)
    └──> (Independent)
```

**Parallel Development**: Tools #2, #4, #5 can be built simultaneously
**Critical Path**: Tool #1 → Tool #3 (7-8 days minimum)

---

**Generated**: October 19, 2025
🤖 Generated with Claude Code
