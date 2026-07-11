# ALL TASKS SUMMARY - Comprehensive Cardiovascular/Diabetes Management

**Total Tools**: 8 (All Tier 1 - Critical)
**Estimated Timeline**: 45-55 days (sequential) | 12-15 days (parallel with 4 developers)
**Patient Scenario**: Andrew Peterson - HFrEF, CAD s/p CABG, DM2, HTN, CKD

---

## TOOL #1: CARDIAC REHAB MANAGEMENT SYSTEM

### Clinical Background
**ACC/AHA 2021 Guidelines**: Class 1A recommendation for cardiac rehab after CABG, MI, or HF hospitalization.
- **Evidence**: 26% reduction in all-cause mortality with CR participation
- **Completion rates**: Only 20-30% complete recommended 36 sessions
- **Barriers**: Transportation, insurance, lack of tracking/accountability

### Decision Logic
```
IF patient has:
  - Recent CABG (within 12 months) OR
  - Recent MI (within 12 months) OR
  - HFrEF (EF <40%) OR
  - Stable angina

THEN:
  1. Check if already enrolled in cardiac rehab
  2. If not enrolled → Generate referral + track response
  3. If enrolled → Monitor session attendance (target 36 over 12 weeks)
  4. Alert if <50% attendance after 4 weeks (dropout risk)
  5. Document functional progress (6MWT, peak VO2) every 4 weeks
```

### Data Models

#### Collection: `cardiac_rehab_programs`
```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  referralDate: Date,
  referringProvider: String,
  indication: String, // "Post-CABG", "HFrEF", "Post-MI", etc.
  programType: String, // "In-person", "Hybrid", "Home-based"
  facilityName: String,
  facilityPhone: String,
  enrollmentStatus: String, // "Referred", "Enrolled", "Declined", "Completed", "Dropped"
  enrollmentDate: Date,
  expectedCompletionDate: Date,
  sessionsCompleted: Number,
  sessionsTarget: Number, // Usually 36
  baselineFunctionalTests: {
    sixMinuteWalkDistance: Number, // meters
    peakVO2: Number, // ml/kg/min
    testDate: Date
  },
  exercisePrescription: {
    targetHeartRateMin: Number, // 60% of age-predicted max
    targetHeartRateMax: Number, // 80% of age-predicted max
    durationMinutes: Number, // 30-45 minutes per session
    frequencyPerWeek: Number, // 3x per week
    modalitites: [String] // ["Treadmill", "Bike", "Rowing"]
  },
  barriers: [String], // ["Transportation", "Cost", "Motivation", "Comorbidities"]
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Collection: `cardiac_rehab_sessions`
```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  programId: ObjectId, // Links to cardiac_rehab_programs
  sessionNumber: Number, // 1-36
  sessionDate: Date,
  attendanceStatus: String, // "Attended", "Missed", "Excused"
  vitalsPre: {
    heartRate: Number,
    bloodPressure: String,
    weight: Number,
    oxygenSaturation: Number
  },
  vitalsPost: {
    heartRate: Number,
    bloodPressure: String
  },
  exercisePerformed: [
    {
      modality: String, // "Treadmill", "Bike", etc.
      durationMinutes: Number,
      intensityLevel: Number, // METs or RPE scale
      avgHeartRate: Number,
      peakHeartRate: Number
    }
  ],
  symptomsReported: [String], // ["Chest pain", "Dyspnea", "Fatigue", "None"]
  sessionNotes: String,
  providerName: String, // Exercise physiologist or nurse
  createdAt: Date
}
```

### Function Specifications

#### `enrollPatientInCardiacRehab()`
**Purpose**: Create new cardiac rehab program enrollment
**Parameters**:
- `patientId` (required): Patient ID
- `indication` (required): "Post-CABG", "HFrEF", "Post-MI", etc.
- `facilityName` (optional): Preferred rehab facility
- `exercisePrescription` (required): Target HR zones, duration

**Returns**: `{ success: true, programId, referralPDF }`

**Logic**:
1. Verify patient eligibility (cardiac diagnosis exists)
2. Check for existing active programs (avoid duplicates)
3. Calculate target HR zones: 60-80% of (220 - age)
4. Generate referral PDF with diagnosis, meds, restrictions
5. Send to facility via fax/HL7
6. Create calendar reminder for 2-week follow-up ("Did patient enroll?")

#### `logCardiacRehabSession()`
**Purpose**: Record individual rehab session attendance and data
**Parameters**:
- `programId` (required): Cardiac rehab program ID
- `sessionDate` (required): Date of session
- `attendanceStatus` (required): "Attended", "Missed", "Excused"
- `vitalsPre`, `vitalsPost` (if attended): Pre/post-exercise vitals
- `exercisePerformed` (if attended): Array of exercises with METs, HR

**Returns**: `{ success: true, sessionId, completionPercentage }`

**Logic**:
1. Increment `sessionsCompleted` in parent program
2. Calculate completion % (sessionsCompleted / sessionsTarget × 100)
3. Alert if attendance <50% after 12 sessions (dropout risk)
4. Flag if HR exceeded target range (safety concern)
5. Update next expected session date

#### `getCardiacRehabProgress()`
**Purpose**: Retrieve rehab program summary with progress metrics
**Parameters**:
- `patientId` (required): Patient ID

**Returns**: Artifact panel with:
- Enrollment status, sessions completed (e.g., "18/36 - 50%")
- Functional improvement: Baseline 6MWT 300m → Current 425m (+42%)
- Attendance trend graph (last 8 weeks)
- Barriers identified, action plan

### UI Mockups

**Artifact Panel - Cardiac Rehab Summary**:
```
╔══════════════════════════════════════════════════════════════╗
║ 🏃 CARDIAC REHAB PROGRESS - Andrew Peterson                 ║
╠══════════════════════════════════════════════════════════════╣
║ Program: Post-CABG Rehabilitation (In-person)               ║
║ Facility: Yale Cardiac Rehab Center                         ║
║ Start Date: 09/15/2025  |  Expected End: 12/07/2025         ║
║                                                              ║
║ ⏱️  SESSIONS COMPLETED: 18/36 (50%)                          ║
║ [████████████░░░░░░░░░░░░] 50%                              ║
║                                                              ║
║ 📊 FUNCTIONAL IMPROVEMENT:                                   ║
║   6-Minute Walk Test:                                        ║
║     Baseline (09/15): 300 meters                            ║
║     Week 6 (10/27):   425 meters  [+42% ↑]                  ║
║     Target:           450 meters                             ║
║                                                              ║
║   Peak VO2:                                                  ║
║     Baseline: 14.2 ml/kg/min                                ║
║     Week 6:   18.8 ml/kg/min  [+32% ↑]                      ║
║                                                              ║
║ ⚠️  ATTENDANCE ALERTS:                                        ║
║   • Missed 3 of last 6 sessions (50% attendance)            ║
║   • Barrier identified: Transportation issues               ║
║   • Action: Referred to home-based hybrid program           ║
║                                                              ║
║ 💪 EXERCISE PRESCRIPTION:                                    ║
║   Target HR Zone: 113-150 bpm (60-80% max)                  ║
║   Duration: 30-45 min per session, 3x/week                  ║
║   Modalities: Treadmill, Bike, Rowing                       ║
║                                                              ║
║ [View Session Log] [Update Barriers] [Export PDF]           ║
╚══════════════════════════════════════════════════════════════╝
```

### Success Criteria
- ✅ Referrals auto-generate with diagnosis, meds, target HR zones
- ✅ Enrollment status tracked (referred → enrolled → in-progress → completed)
- ✅ Sessions logged with attendance, vitals, exercise data
- ✅ Dropout alerts sent if attendance <50% after 12 sessions
- ✅ Functional tests (6MWT, VO2) documented at baseline, weeks 6, 12
- ✅ Completion rates increase from 20% to 50%+

### Testing Strategy
1. **Create test patient**: 67M, HFrEF (EF 30%), post-CABG
2. **Enroll in rehab**: Verify referral PDF generated with correct target HR (113-150 bpm)
3. **Log 18 sessions**: Mix of attended/missed, verify completion % = 50%
4. **Trigger dropout alert**: Log 6 missed sessions → Verify alert sent to provider
5. **Document functional improvement**: Baseline 6MWT 300m → Week 6 425m (+42%)
6. **Export summary**: PDF includes progress graph, barriers, recommendations

### 6-Step Implementation Checklist
- [ ] **Step 1**: Define schema in `collectionSchemas.js` (cardiac_rehab_programs, cardiac_rehab_sessions)
- [ ] **Step 2**: Create handlers in `cardiacRehabService.js` (enroll, log, getProgress)
- [ ] **Step 3**: Register in `medicalCollectionsService.js` (allCollections array)
- [ ] **Step 4**: Add routes in `routes/agent.js` (case handlers)
- [ ] **Step 5**: Update `aiHelpers.js` function registry (3 new functions)
- [ ] **Step 6**: Create frontend template `CardiacRehabDocument.jsx` + CSS

---

## TOOL #2: REMOTE PATIENT MONITORING (RPM) PLATFORM

### Clinical Background
**CMS RPM Codes (2024)**: CPT 99457/99458 reimburse for remote monitoring services
- **Evidence**: JAMA 2024 - RPM reduced HF hospitalizations by 38%
- **Conditions eligible**: HF, HTN, DM, COPD, post-operative
- **Requirements**: 16+ days of data transmission per month

### Decision Logic
```
Patient transmits vitals daily (weight, BP, glucose):

IF weight ↑ ≥5 lbs in 3 days:
  → ALERT: "Fluid overload - possible HF exacerbation"
  → ACTION: RN contacts patient within 4 hours, assess dyspnea, edema
  → INTERVENTION: ↑ furosemide, schedule urgent MD visit if symptomatic

IF systolic BP ≥160 or diastolic BP ≥100 x 2 consecutive readings:
  → ALERT: "Hypertensive urgency"
  → ACTION: RN calls within 2 hours, assess symptoms (HA, chest pain)
  → INTERVENTION: ↑ antihypertensive, ED referral if >180/110 + symptoms

IF fasting glucose ≥250 x 2 consecutive days OR random ≥300:
  → ALERT: "Severe hyperglycemia"
  → ACTION: RN calls same day, check ketones, assess DKA risk
  → INTERVENTION: ↑ insulin, endocrinology consult if persistent

IF NO DATA transmitted x 3 days:
  → ALERT: "Device non-compliance"
  → ACTION: Outreach to troubleshoot device or re-engage patient
```

### Data Models

#### Collection: `rpm_devices`
```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  deviceType: String, // "Scale", "BP Cuff", "Glucometer", "Pulse Ox"
  manufacturer: String, // "iHealth", "Withings", "Dexcom"
  deviceId: String, // Serial number or BLE MAC address
  activationDate: Date,
  deactivationDate: Date,
  status: String, // "Active", "Inactive", "Malfunctioning"
  lastTransmission: Date,
  communicationMethod: String, // "Bluetooth→App→API", "Cellular", "Manual Entry"
  billableMonth: Boolean, // True if ≥16 days of data this month
  notes: String,
  createdAt: Date
}
```

#### Collection: `rpm_vitals`
```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  deviceId: ObjectId,
  vitalType: String, // "Weight", "BP", "Glucose", "O2Sat", "HeartRate"
  value: Mixed, // Number (glucose, weight) or String (BP "140/90")
  unit: String, // "lbs", "kg", "mg/dL", "mmHg", "%"
  timestamp: Date, // When patient measured (not when transmitted)
  transmittedAt: Date, // When data arrived in system
  flagged: Boolean, // True if outside normal range
  alertTriggered: Boolean, // True if crossed alert threshold
  alertDetails: {
    severity: String, // "Low", "Medium", "High", "Critical"
    message: String, // "Weight increased 6 lbs in 2 days"
    actionRequired: String, // "RN outreach within 4 hours"
    assignedTo: String // "RN Smith"
  },
  reviewedBy: String, // Provider who acknowledged alert
  reviewedAt: Date,
  interventionNotes: String, // "Increased furosemide 40→80mg daily"
  createdAt: Date
}
```

#### Collection: `rpm_alert_thresholds`
```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  vitalType: String,
  condition: String, // "weight_increase", "bp_high", "glucose_high"
  thresholdValue: Mixed,
  timeWindow: String, // "3 days", "2 consecutive readings"
  alertSeverity: String, // "Medium", "High", "Critical"
  assignToRole: String, // "RN", "MD", "Pharmacist"
  escalationTime: Number, // Hours before escalation if not reviewed
  active: Boolean,
  createdBy: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Function Specifications

#### `enrollPatientInRPM()`
**Purpose**: Enroll patient in RPM program with device assignment
**Parameters**:
- `patientId` (required)
- `devices` (required): Array of {deviceType, manufacturer, deviceId}
- `conditions` (required): ["HF", "HTN", "DM"] - determines alert thresholds

**Returns**: `{ success: true, deviceIds, defaultThresholds }`

**Logic**:
1. Create RPM device records (scale, BP cuff, glucometer)
2. Auto-generate alert thresholds based on conditions:
   - HF → Weight +5 lbs/3 days
   - HTN → BP >160/100 x2
   - DM → Glucose >250 fasting or >300 random
3. Send patient onboarding materials (device setup, video tutorials)
4. Schedule nurse orientation call (within 48 hours)
5. Enable billing codes (99453 setup, 99454 data transmission)

#### `receiveRPMVitals()`
**Purpose**: Ingest vitals from device API (webhook/polling)
**Parameters**:
- `deviceId` (required): Which device sent data
- `vitalType` (required): "Weight", "BP", "Glucose", etc.
- `value` (required): Measurement value
- `timestamp` (required): When patient measured (not server time)

**Returns**: `{ success: true, vitalId, alertTriggered, alertDetails }`

**Logic**:
1. Insert into `rpm_vitals` collection
2. Query recent vitals (last 3-7 days depending on threshold)
3. Check alert thresholds:
   - Weight: Calculate 3-day trend
   - BP: Check if 2 consecutive readings >160/100
   - Glucose: Check if fasting >250 or random >300
4. If threshold crossed → Create alert, assign to RN queue
5. Update device `lastTransmission` date
6. Check if ≥16 days this month → Mark `billableMonth = true`

#### `getRPMDashboard()`
**Purpose**: Display patient's RPM vitals with trend graphs and alerts
**Parameters**:
- `patientId` (required)
- `dateRange` (optional): Default last 30 days

**Returns**: Artifact panel with:
- Trend graphs (weight, BP, glucose over time)
- Alert history (unresolved alerts at top)
- Compliance metrics (% days with data, billable status)
- Device status (last transmission time)

### UI Mockups

**Artifact Panel - RPM Dashboard**:
```
╔═══════════════════════════════════════════════════════════════════╗
║ 📡 REMOTE PATIENT MONITORING - Andrew Peterson                   ║
╠═══════════════════════════════════════════════════════════════════╣
║ Enrolled: 09/01/2025  |  Conditions: HF, HTN, DM                 ║
║ Compliance: 26/30 days (87%) ✅ BILLABLE (≥16 days)               ║
║                                                                   ║
║ ⚠️  ACTIVE ALERTS (2):                                            ║
║   🔴 CRITICAL: Weight ↑ 6 lbs in 2 days (10/18-10/20)            ║
║      Action: RN Smith contacted patient - increased furosemide   ║
║      Status: RESOLVED (10/20 11:30 AM)                           ║
║                                                                   ║
║   🟠 HIGH: BP 168/98 x 2 consecutive readings (10/19 AM/PM)      ║
║      Action: PENDING - Assigned to RN Johnson                    ║
║      Escalation: 2 hours remaining                               ║
║                                                                   ║
║ 📊 WEIGHT TREND (Last 30 Days):                                  ║
║   ┌──────────────────────────────────────────────────┐           ║
║185│                                        ●          │           ║
║180│                            ●     ●   ●            │           ║
║175│        ●   ●   ●   ●   ●                         │ Target    ║
║170│  ●   ●                                           │ 172 lbs   ║
║   └──────────────────────────────────────────────────┘           ║
║     9/20      9/30      10/10     10/20                          ║
║   Current: 184 lbs  |  Baseline: 172 lbs  |  Δ +12 lbs          ║
║                                                                   ║
║ 🩺 BLOOD PRESSURE (Last 7 Days):                                 ║
║   10/20: 158/92  |  10/19: 168/98 ⚠️ |  10/18: 152/88           ║
║   10/17: 146/84  |  10/16: 142/80 ✅ |  10/15: 138/76 ✅        ║
║   Avg: 151/88 (Goal: <130/80)                                    ║
║                                                                   ║
║ 🩸 GLUCOSE (Last 7 Days - Fasting):                              ║
║   10/20: 168  |  10/19: 182  |  10/18: 156                      ║
║   10/17: 192 ⚠️ |  10/16: 148  |  10/15: 138 ✅                 ║
║   Avg: 164 mg/dL (Goal: 80-130)                                  ║
║                                                                   ║
║ 📱 DEVICE STATUS:                                                ║
║   Scale (iHealth): Last transmission 10/20 7:32 AM ✅            ║
║   BP Cuff (Omron): Last transmission 10/20 8:15 AM ✅            ║
║   Glucometer (Dexcom CGM): Last transmission 10/20 9:45 AM ✅    ║
║                                                                   ║
║ [Review Alerts] [Adjust Thresholds] [Contact Patient] [Export]  ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Success Criteria
- ✅ Devices paired and transmitting vitals daily (≥16 days/month for billing)
- ✅ Alert thresholds auto-configured by condition (HF, HTN, DM)
- ✅ Critical alerts (weight +5 lbs/3 days) route to RN within 4 hours
- ✅ Trend graphs visible in artifact panel (30-day weight, BP, glucose)
- ✅ Interventions documented (e.g., "Increased furosemide 40→80mg")
- ✅ Compliance tracked (% days with data), billable status calculated
- ✅ 38% reduction in HF hospitalizations (per JAMA 2024 evidence)

### Testing Strategy
1. **Enroll test patient**: HFrEF + HTN + DM2
2. **Simulate device data**: Send weight +6 lbs over 2 days via API
3. **Verify alert triggered**: Critical alert created, assigned to RN queue
4. **RN reviews alert**: Document intervention ("Increased furosemide"), mark resolved
5. **Test compliance**: Transmit data 18 days in October → Verify billable = true
6. **Trend graph**: Verify 30-day weight graph displays correctly

### 6-Step Implementation Checklist
- [ ] **Step 1**: Define schemas (rpm_devices, rpm_vitals, rpm_alert_thresholds)
- [ ] **Step 2**: Create `rpmService.js` (enroll, receiveVitals, getDashboard, checkAlerts)
- [ ] **Step 3**: Register collections in `medicalCollectionsService.js`
- [ ] **Step 4**: Add API routes (POST /api/rpm/vitals, GET /api/rpm/dashboard)
- [ ] **Step 5**: Update `aiHelpers.js` (3 new functions)
- [ ] **Step 6**: Create `RPMDashboardDocument.jsx` with trend graphs

---

## TOOL #3: MEDICATION ADHERENCE TRACKING

### Clinical Background
**AHA Scientific Statement (2022)**: Medication non-adherence costs $100-300B annually in US
- **HF patients**: Only 50% adherent to GDMT at 6 months post-discharge
- **DM patients**: 30-50% non-adherent to insulin/oral agents
- **Consequences**: 2x ↑ hospitalization risk, 5x ↑ mortality risk

### Decision Logic
```
FOR each active prescription:
  1. Query pharmacy fill data (via SureScripts/RxHub API)
  2. Calculate PDC (Proportion of Days Covered):
     PDC = (Days with medication ÷ Total days in period) × 100

  3. Classify adherence:
     - PDC ≥80%: GREEN (adherent)
     - PDC 60-79%: YELLOW (partially adherent)
     - PDC <60%: RED (non-adherent)

  4. Trigger alerts:
     - If PDC <80% for critical meds (beta-blocker, ACE-I, insulin) → Alert MD
     - If no refill in 60 days (30-day supply) → Alert patient + RN
     - If multiple missed refills → Assess barriers (cost, side effects, complexity)

  5. Interventions:
     - Cost barrier → Switch to generic, patient assistance program
     - Side effects → Consider alternative agent
     - Complexity → Simplify regimen (e.g., combine pills, use combination products)
```

### Data Models

#### Collection: `medication_adherence`
```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  medicationId: ObjectId, // Links to medications collection
  drugName: String,
  rxNormCode: String,
  prescriptionDate: Date,
  lastRefillDate: Date,
  nextRefillDueDate: Date,
  daysSupply: Number, // 30, 60, 90 days
  refillsRemaining: Number,
  pdcScore: Number, // 0-100 (Proportion of Days Covered)
  pdcPeriod: String, // "Last 30 days", "Last 90 days", "Last 6 months"
  adherenceCategory: String, // "Adherent (≥80%)", "Partial (60-79%)", "Non-adherent (<60%)"
  adherenceTrend: String, // "Improving", "Stable", "Declining"
  missedRefills: Number, // Count of expected refills not filled
  gapsInTherapy: [
    {
      startDate: Date,
      endDate: Date,
      durationDays: Number,
      reason: String // "Refill not picked up", "Prescription expired", "Cost"
    }
  ],
  barriers: [String], // ["Cost", "Side effects", "Complexity", "Forgetfulness"]
  interventions: [
    {
      date: Date,
      type: String, // "Patient education", "Switch to generic", "Simplify regimen"
      performedBy: String,
      outcome: String // "Improved adherence", "No change", "Discontinued med"
    }
  ],
  criticalMedication: Boolean, // True for life-saving meds (beta-blocker in HF, insulin in DM)
  createdAt: Date,
  updatedAt: Date
}
```

#### Collection: `pharmacy_fill_data`
```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  medicationId: ObjectId,
  rxNumber: String,
  fillDate: Date,
  pharmacyName: String,
  pharmacyNCPDP: String, // National pharmacy ID
  daysSupply: Number,
  quantityDispensed: Number,
  prescriberId: String, // NPI
  dataSource: String, // "SureScripts", "RxHub", "Manual Entry"
  copayAmount: Number,
  insurancePaid: Number,
  totalCost: Number,
  createdAt: Date
}
```

### Function Specifications

#### `calculateMedicationAdherence()`
**Purpose**: Calculate PDC score and identify non-adherence
**Parameters**:
- `patientId` (required)
- `period` (optional): "30d", "90d", "6mo" (default 90d)

**Returns**: Artifact panel with:
- Adherence summary: % of meds with PDC ≥80%
- Individual med adherence scores (sorted by criticality)
- Gaps in therapy (date ranges without medication)
- Recommended interventions

**Logic**:
1. Get all active medications for patient
2. Query pharmacy fill data (last 90 days)
3. For each medication:
   - Calculate days covered: SUM(daysSupply) from fills
   - Calculate PDC: (Days covered ÷ 90 days) × 100
   - Identify gaps: Dates between fills where patient had no medication
4. Flag critical meds with PDC <80% (beta-blocker, ACE-I, insulin, anticoagulant)
5. Suggest interventions based on barriers:
   - If copay >$50 → Suggest generic switch or patient assistance
   - If multiple meds from same class → Suggest simplification
   - If forgetfulness → Suggest pill organizer, med sync program

#### `trackPharmacyRefills()`
**Purpose**: Ingest pharmacy fill data from SureScripts/RxHub API
**Parameters**:
- `patientId` (required)
- `fillData` (required): { rxNumber, fillDate, daysSupply, quantityDispensed, pharmacy }

**Returns**: `{ success: true, fillId, adherenceUpdated }`

**Logic**:
1. Insert into `pharmacy_fill_data`
2. Link to corresponding medication in `medications` collection
3. Update `lastRefillDate` and `nextRefillDueDate`
4. Recalculate PDC score
5. Check for overdue refills (nextRefillDue + 7 days grace period)
6. If overdue → Send patient reminder via portal/text
7. If 2+ consecutive missed refills → Alert RN for outreach

#### `getMedicationAdherenceReport()`
**Purpose**: Generate adherence report for patient or population
**Parameters**:
- `patientId` (optional): Single patient, or omit for practice-wide
- `medicationClass` (optional): Filter by drug class (e.g., "Beta-blockers")
- `timeframe` (optional): Default 6 months

**Returns**: Artifact panel with:
- Overall adherence rate (% patients with PDC ≥80%)
- Non-adherent patients list (for outreach campaign)
- Adherence by drug class (e.g., statins 65%, beta-blockers 72%)
- Barriers analysis (cost 40%, side effects 25%, forgetfulness 35%)

### UI Mockups

**Artifact Panel - Medication Adherence Summary**:
```
╔══════════════════════════════════════════════════════════════════╗
║ 💊 MEDICATION ADHERENCE - Andrew Peterson (Last 90 Days)        ║
╠══════════════════════════════════════════════════════════════════╣
║ Overall Adherence: 7/13 medications PDC ≥80% (54%) ⚠️           ║
║                                                                  ║
║ 🔴 CRITICAL MEDICATIONS - NON-ADHERENT:                          ║
║                                                                  ║
║ 1. Metoprolol Succinate 25mg BID (Beta-blocker)                 ║
║    PDC: 62% ⚠️ | Last Refill: 09/12 (38 days ago, OVERDUE)     ║
║    Gaps: 9/22-10/02 (10 days), 10/12-present (8 days)          ║
║    Barrier: Forgetfulness reported                              ║
║    💡 Suggestion: Enroll in medication synchronization program  ║
║                                                                  ║
║ 2. Insulin Glargine 20 units QHS                                ║
║    PDC: 58% ⚠️ | Last Refill: 09/28 (22 days ago)              ║
║    Gaps: 8/15-8/30 (15 days), 10/18-present (2 days)           ║
║    Barrier: Cost ($85 copay)                                    ║
║    💡 Suggestion: Switch to biosimilar Semglee ($25 copay)      ║
║                                                                  ║
║ 3. Lisinopril 10mg Daily (ACE Inhibitor)                        ║
║    PDC: 71% ⚠️ | Last Refill: 10/05 (15 days ago)              ║
║    Gaps: 9/10-9/18 (8 days), 9/28-10/05 (7 days)               ║
║    Barrier: Side effects (cough) per patient report             ║
║    💡 Suggestion: Consider switch to ARB (losartan)             ║
║                                                                  ║
║ ✅ ADHERENT MEDICATIONS (PDC ≥80%):                              ║
║   • Atorvastatin 80mg (Statin): PDC 94% ✅                      ║
║   • Furosemide 40mg (Diuretic): PDC 88% ✅                      ║
║   • Metformin 1000mg BID (Diabetes): PDC 82% ✅                 ║
║   • Aspirin 81mg (Antiplatelet): PDC 96% ✅                     ║
║   • Clopidogrel 75mg (Antiplatelet): PDC 91% ✅                 ║
║   • Empagliflozin 10mg (SGLT2i): PDC 86% ✅                     ║
║   • Spironolactone 25mg (MRA): PDC 80% ✅ (borderline)          ║
║                                                                  ║
║ 📊 ADHERENCE TREND (Last 6 Months):                             ║
║   May: 78%  |  Jun: 72%  |  Jul: 68%  |  Aug: 65% ↓            ║
║   Sep: 61%  |  Oct: 54% ↓↓ (DECLINING - intervention needed)   ║
║                                                                  ║
║ 🎯 RECOMMENDED ACTIONS:                                         ║
║   1. RN outreach: Discuss barriers (cost, side effects)         ║
║   2. Switch insulin to biosimilar (save $60/month)              ║
║   3. Switch lisinopril to losartan (eliminate cough)            ║
║   4. Enroll in med sync program (all refills same day)          ║
║   5. Set up pill organizer + reminder app                       ║
║                                                                  ║
║ [Contact Patient] [Update Barriers] [Request Prior Auth]        ║
╚══════════════════════════════════════════════════════════════════╝
```

### Success Criteria
- ✅ PDC scores calculated automatically for all active medications
- ✅ Pharmacy fill data imported via SureScripts/RxHub API
- ✅ Overdue refill alerts sent to patients 7 days before runout
- ✅ Critical meds (beta-blocker, ACE-I, insulin) flagged if PDC <80%
- ✅ Barriers identified (cost, side effects, complexity) and interventions suggested
- ✅ Adherence trend tracked over time (identify declining adherence early)
- ✅ Overall adherence improves from 54% → 80%+ after interventions

### Testing Strategy
1. **Create test patient**: 13 active medications (mix of critical + non-critical)
2. **Simulate pharmacy fills**: Import refill data with gaps (e.g., metoprolol PDC 62%)
3. **Verify PDC calculation**: Metoprolol filled 56/90 days = 62% ✓
4. **Trigger overdue alert**: Last refill 38 days ago (30-day supply) → Alert patient
5. **Document barriers**: Cost barrier for insulin ($85 copay)
6. **Suggest intervention**: Switch to biosimilar ($25 copay) → Verify suggestion appears
7. **Track trend**: Enter 6 months of data showing decline 78%→54% → Verify trend graph

### 6-Step Implementation Checklist
- [ ] **Step 1**: Define schemas (medication_adherence, pharmacy_fill_data)
- [ ] **Step 2**: Create `medicationAdherenceService.js` (calculate, track, getReport)
- [ ] **Step 3**: Register collections in `medicalCollectionsService.js`
- [ ] **Step 4**: Add API integration (SureScripts/RxHub webhook for pharmacy fills)
- [ ] **Step 5**: Update `aiHelpers.js` (3 new functions)
- [ ] **Step 6**: Create `MedicationAdherenceDocument.jsx` with PDC bars, trend graph

---

## TOOL #4: CARE COORDINATION PLATFORM

### Clinical Background
**AHRQ TeamSTEPPS (2023)**: Structured team communication reduces adverse events by 30%
- **Problem**: Specialists work in silos (cardiology, endocrinology, nephrology)
- **Consequences**: Medication errors (30% at transitions), conflicting care plans, duplicate testing
- **Solution**: Unified care team workspace with shared plans, real-time updates, task assignment

### Decision Logic
```
Multi-specialty patient (e.g., HF + DM + CKD):

1. CREATE CARE TEAM:
   - Primary: Cardiologist (Dr. Martinez)
   - Consultants: Endocrinologist (Dr. Chen), Nephrologist (Dr. Patel)
   - Ancillary: RN case manager, Pharmacist, Nutritionist

2. SHARED CARE PLAN:
   - Active problems: HFrEF (EF 30%), DM2 (A1c 8.2%), CKD3a (Cr 1.8)
   - Goals: Uptitrate GDMT, A1c <7%, Cr stable
   - Medication list: Single source of truth (13 meds)
   - Tasks: Assigned to team members with due dates

3. COMMUNICATION RULES:
   - Med changes → Notify all team members within 24hr
   - Conflicting orders → Flag for resolution (e.g., cardio ↑ diuretic, nephro concerned about Cr)
   - Critical events → Escalate (e.g., ER visit → notify all)

4. CONFLICT DETECTION:
   - If 2+ providers prescribe same drug class → Alert
   - If med change affects another specialty's goals → Flag (e.g., ↑ diuretic → ↑ Cr risk)

5. CARE PLAN UPDATES:
   - Version control: Track changes over time
   - Audit log: Who changed what, when
```

### Data Models

#### Collection: `care_teams`
```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  teamName: String, // "Andrew Peterson Care Team"
  primaryProvider: {
    providerId: ObjectId,
    name: String,
    specialty: String, // "Cardiology"
    role: String // "Team Lead"
  },
  teamMembers: [
    {
      providerId: ObjectId,
      name: String,
      specialty: String,
      role: String, // "Consultant", "Case Manager", "Pharmacist"
      joinedDate: Date,
      active: Boolean
    }
  ],
  activeSince: Date,
  status: String, // "Active", "Inactive", "Archived"
  meetingSchedule: String, // "Weekly Tuesday 10am" or "As needed"
  communicationPreferences: {
    urgentAlerts: String, // "STAT page", "SMS", "Email"
    routine: String // "Daily digest", "Real-time notifications"
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Collection: `shared_care_plans`
```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  careTeamId: ObjectId,
  version: Number, // Version control (1, 2, 3...)
  activeProblems: [
    {
      problem: String, // "HFrEF with EF 30%"
      icd10: String, // "I50.22"
      managedBy: String, // "Dr. Martinez (Cardiology)"
      goal: String, // "Uptitrate GDMT to target doses"
      status: String // "Active", "Improving", "Stable", "Worsening"
    }
  ],
  medications: [
    {
      drugName: String,
      dose: String,
      frequency: String,
      indication: String,
      prescribedBy: String, // "Dr. Chen (Endocrinology)"
      lastChangedDate: Date,
      lastChangedBy: String,
      conflicts: [String] // ["Dr. Martinez also prescribed furosemide - doses differ"]
    }
  ],
  tasks: [
    {
      taskId: ObjectId,
      description: String, // "Monitor Cr after furosemide increase"
      assignedTo: String, // "Dr. Patel (Nephrology)"
      dueDate: Date,
      priority: String, // "High", "Medium", "Low"
      status: String, // "Pending", "In Progress", "Completed"
      completedBy: String,
      completedDate: Date,
      notes: String
    }
  ],
  goals: [
    {
      category: String, // "Cardiovascular", "Metabolic", "Renal"
      goal: String, // "A1c <7% by Jan 2026"
      measurableTarget: String,
      targetDate: Date,
      ownedBy: String, // "Dr. Chen (Endocrinology)"
      currentValue: String, // "A1c 8.2% (10/15/2025)"
      status: String // "Not Met", "On Track", "Met"
    }
  ],
  changeLog: [
    {
      date: Date,
      changedBy: String,
      changeType: String, // "Medication added", "Task completed", "Goal updated"
      description: String,
      previousValue: String,
      newValue: String
    }
  ],
  lastReviewedDate: Date,
  nextReviewDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Collection: `care_team_communications`
```javascript
{
  _id: ObjectId,
  careTeamId: ObjectId,
  patientId: ObjectId,
  messageType: String, // "Update", "Question", "Alert", "Conflict Resolution"
  sender: {
    providerId: ObjectId,
    name: String,
    specialty: String
  },
  recipients: [String], // ["Dr. Chen", "Dr. Patel", "RN Johnson"]
  subject: String,
  message: String,
  relatedTo: String, // "Medication change", "Lab result", "ER visit"
  priority: String, // "Routine", "Urgent", "STAT"
  requiresResponse: Boolean,
  responses: [
    {
      responderId: ObjectId,
      responderName: String,
      responseText: String,
      timestamp: Date
    }
  ],
  resolvedStatus: String, // "Open", "Resolved", "Escalated"
  createdAt: Date
}
```

### Function Specifications

#### `createCareTeam()`
**Purpose**: Assemble multi-specialty team for complex patient
**Parameters**:
- `patientId` (required)
- `primaryProvider` (required): {providerId, specialty}
- `teamMembers` (required): Array of {providerId, specialty, role}

**Returns**: `{ success: true, careTeamId, sharedCarePlanId }`

**Logic**:
1. Create `care_teams` document
2. Create initial `shared_care_plans` (version 1)
3. Pull active problems from patient's diagnoses
4. Pull current medications from medications collection
5. Send notifications to all team members (portal + email)
6. Schedule initial team meeting (within 7 days)

#### `updateSharedCarePlan()`
**Purpose**: Modify care plan with version control and conflict detection
**Parameters**:
- `carePlanId` (required)
- `changeType` (required): "add_medication", "update_goal", "assign_task", etc.
- `changeData` (required): Details of change
- `changedBy` (required): Provider making change

**Returns**: `{ success: true, newVersion, conflictsDetected }`

**Logic**:
1. Increment version number
2. Log change in `changeLog` (who, what, when)
3. Check for conflicts:
   - If medication added → Check if another team member prescribes same class
   - If diuretic dose ↑ → Alert nephrology (Cr monitoring needed)
4. If conflict detected → Create alert, require acknowledgment before proceeding
5. Notify relevant team members (e.g., med change → notify all)

#### `sendCareTeamMessage()`
**Purpose**: Structured communication between team members
**Parameters**:
- `careTeamId` (required)
- `sender` (required): Provider sending message
- `recipients` (required): Array of team members
- `subject` (required): Brief description
- `message` (required): Full message text
- `priority` (optional): "Routine", "Urgent", "STAT"

**Returns**: `{ success: true, messageId, notificationsSent }`

**Logic**:
1. Create message in `care_team_communications`
2. Send notifications based on priority:
   - STAT → Page all recipients immediately
   - Urgent → SMS + email within 15 min
   - Routine → Daily digest email
3. Track read receipts
4. If `requiresResponse = true` → Send reminders after 24hr if no response

#### `getCareTeamDashboard()`
**Purpose**: Unified view of care plan, tasks, communications
**Parameters**:
- `patientId` (required)

**Returns**: Artifact panel with:
- Team roster (who's on the team, roles)
- Active problems + goals (status, ownership)
- Medication list (with conflict flags)
- Pending tasks (assigned to each team member)
- Recent communications (last 7 days)

### UI Mockups

**Artifact Panel - Care Team Dashboard**:
```
╔══════════════════════════════════════════════════════════════════╗
║ 👥 CARE TEAM COORDINATION - Andrew Peterson                     ║
╠══════════════════════════════════════════════════════════════════╣
║ Team Lead: Dr. Maria Martinez (Cardiology)                      ║
║ Members: Dr. Li Chen (Endocrinology), Dr. Raj Patel (Nephro),   ║
║          RN Sarah Johnson (Case Manager), PharmD Amy Wong        ║
║ Active Since: 09/01/2025  |  Last Review: 10/15/2025            ║
║ Next Team Meeting: 10/27/2025 10:00 AM (Zoom link)              ║
║                                                                  ║
║ 🎯 ACTIVE PROBLEMS & GOALS:                                      ║
║                                                                  ║
║ 1. HFrEF (EF 30%) - Dr. Martinez (Cardiology)                   ║
║    Goal: Uptitrate GDMT to target doses by Dec 2025             ║
║    Status: 🟡 IN PROGRESS - Metoprolol 25→50mg (25% target)    ║
║    Tasks: • ↑ Metoprolol to 75mg in 2 weeks (Dr. Martinez)     ║
║           • Monitor HR/BP for tolerance (RN Johnson)            ║
║                                                                  ║
║ 2. DM2 (A1c 8.2%) - Dr. Chen (Endocrinology)                    ║
║    Goal: A1c <7% by Jan 2026                                    ║
║    Status: 🔴 NOT ON TRACK - A1c ↑ from 7.8% (Jul) to 8.2%     ║
║    Tasks: • ↑ Insulin glargine 20→25 units (Dr. Chen)          ║
║           • Diabetes education referral (RN Johnson)            ║
║                                                                  ║
║ 3. CKD Stage 3a (Cr 1.8) - Dr. Patel (Nephrology)               ║
║    Goal: Stabilize Cr, avoid progression to Stage 3b            ║
║    Status: ⚠️  CONCERN - Cr ↑ from 1.6 to 1.8 after diuretic ↑ ║
║    Tasks: • Recheck Cr in 1 week (Dr. Patel)                   ║
║           • If Cr >2.0, ↓ furosemide dose (Dr. Martinez)       ║
║                                                                  ║
║ 💊 SHARED MEDICATION LIST (13 meds):                            ║
║   ⚠️  2 CONFLICTS DETECTED:                                      ║
║                                                                  ║
║   1. Furosemide 80mg daily                                      ║
║      Prescribed by: Dr. Martinez (Cardiology) on 10/12          ║
║      ⚠️  CONFLICT: Dose ↑ 40→80mg without nephrology consult   ║
║      Action Required: Dr. Patel to approve or recommend ↓ dose  ║
║      Status: PENDING (Dr. Patel notified 10/12, no response)    ║
║                                                                  ║
║   2. Metformin 1000mg BID                                       ║
║      Prescribed by: Dr. Chen (Endocrinology)                    ║
║      ⚠️  CONFLICT: Contraindicated if eGFR <30 (current eGFR 48)║
║      Action Required: Monitor eGFR closely, D/C if <30          ║
║      Status: ACKNOWLEDGED (Dr. Chen + Dr. Patel aware)          ║
║                                                                  ║
║ 📋 PENDING TASKS (5):                                            ║
║   🔴 OVERDUE:                                                    ║
║   • Recheck Cr after furosemide ↑ (Due: 10/19) - Dr. Patel     ║
║                                                                  ║
║   🟠 DUE SOON:                                                   ║
║   • Diabetes education referral (Due: 10/25) - RN Johnson       ║
║   • Uptitrate metoprolol to 75mg (Due: 10/28) - Dr. Martinez   ║
║                                                                  ║
║   🟢 ON TRACK:                                                   ║
║   • A1c recheck (Due: 11/15) - Dr. Chen                         ║
║   • Echo repeat to assess EF (Due: 12/01) - Dr. Martinez        ║
║                                                                  ║
║ 💬 RECENT COMMUNICATIONS (Last 7 Days):                          ║
║   10/20 - Dr. Martinez → All: "Patient reporting ↑ dyspnea..."  ║
║   10/19 - Dr. Patel → Dr. Martinez: "Cr now 1.8, consider..."   ║
║   10/18 - RN Johnson → All: "Patient missed last 2 appts..."    ║
║   [View All Messages]                                            ║
║                                                                  ║
║ [Resolve Conflicts] [Assign Task] [Send Message] [Schedule Meeting]║
╚══════════════════════════════════════════════════════════════════╝
```

### Success Criteria
- ✅ Multi-specialty teams created for complex patients (HF+DM+CKD)
- ✅ Shared care plans with single medication list (no duplicates/conflicts)
- ✅ Real-time notifications when team member changes meds (within 24hr)
- ✅ Conflict detection alerts (e.g., 2 providers prescribe same drug class)
- ✅ Task assignment with due dates, accountability tracking
- ✅ Communication log (structured messages, not fax/phone tag)
- ✅ 30% reduction in medication errors at transitions of care

### Testing Strategy
1. **Create care team**: Cardiology + Endo + Nephro for HF+DM+CKD patient
2. **Populate care plan**: 3 active problems, 13 medications, 5 tasks
3. **Simulate med change**: Cardio ↑ furosemide 40→80mg
4. **Verify conflict detection**: Alert sent to nephrology ("Monitor Cr")
5. **Test communication**: Dr. Patel sends message → Verify Dr. Martinez notified
6. **Track task completion**: RN completes diabetes ed referral → Updates care plan
7. **Version control**: View change log → Verify all edits tracked (who, what, when)

### 6-Step Implementation Checklist
- [ ] **Step 1**: Define schemas (care_teams, shared_care_plans, care_team_communications)
- [ ] **Step 2**: Create `careCoordinationService.js` (create team, update plan, send message)
- [ ] **Step 3**: Register collections in `medicalCollectionsService.js`
- [ ] **Step 4**: Add routes (POST /api/care-team, PUT /api/care-plan, POST /api/team-message)
- [ ] **Step 5**: Update `aiHelpers.js` (4 new functions)
- [ ] **Step 6**: Create `CareTeamDashboardDocument.jsx` with task list, communication feed

---

## TOOLS #5-8: SUMMARY (Detailed specs in tier-1-critical/)

### TOOL #5: PATIENT PORTAL INTEGRATION
- **HF-specific education**: Low-sodium diet, daily weights, symptom recognition
- **DM-specific education**: Insulin technique videos, glucose logging
- **Symptom tracking**: KCCQ-12 (HF QOL), dyspnea scale, edema assessment
- **Action plans**: "If weight ↑ 3 lbs in 2 days → call clinic"
- **Timeline**: 5-6 days
- **Evidence**: 22% ↓ HF readmissions with patient portal engagement

### TOOL #6: CLINICAL PATHWAYS ENGINE
- **GDMT protocol**: Auto-suggest beta-blocker uptitration when below target
- **Contraindication checking**: "Hold ACE-I if Cr >2.5 or K+ >5.5"
- **Tracking dashboard**: % of target dose achieved (e.g., metoprolol 12.5% of max)
- **Reminders**: "Next metoprolol uptitration due in 2 weeks"
- **Timeline**: 8-10 days
- **Evidence**: Rapid GDMT titration = 34% ↓ readmission (STRONG-HF Trial)

### TOOL #7: RISK STRATIFICATION CALCULATOR
- **LACE index**: Predict 30-day HF readmission risk (score 0-19)
- **MAGGIC score**: 1-year HF mortality prediction (13 variables)
- **ASCVD risk**: 10-year MI/stroke risk (updated with HF diagnosis)
- **Risk-based pathways**: High-risk → RN call in 48hr, MD visit in 7 days
- **Timeline**: 6-7 days
- **Evidence**: LACE ≥10 = 40% readmission rate vs. 15% if <10

### TOOL #8: VACCINE REGISTRY
- **Centralized database**: All vaccines (clinic, pharmacy, community) in one view
- **Gap identification**: "Missing COVID booster (due 3 months ago)"
- **Automated reminders**: Portal message in August ("Flu season soon")
- **Registry queries**: "List all HFrEF patients missing flu vaccine"
- **Timeline**: 3-4 days
- **Evidence**: Flu vaccine = 18% ↓ CV events in HF patients

---

## IMPLEMENTATION ROADMAP

### Week 1: Quick Wins
- **Day 1-4**: Tool #8 (Vaccine Registry) - Simplest, immediate impact
- **Day 5-9**: Tool #3 (Medication Adherence) - Pharmacy API integration

### Week 2: Patient Engagement
- **Day 10-15**: Tool #1 (Cardiac Rehab) - Session tracking, functional testing
- **Day 16-21**: Tool #5 (Patient Portal) - HF/DM education, symptom PROs

### Week 3: Predictive Tools
- **Day 22-29**: Tool #2 (RPM Platform) - Device integration, alert system
- **Day 30-36**: Tool #7 (Risk Stratification) - Readmission/MACE prediction

### Week 4: Complex Workflows
- **Day 37-45**: Tool #4 (Care Coordination) - Multi-specialty communication
- **Day 46-55**: Tool #6 (Clinical Pathways) - GDMT titration engine

**Parallel Development** (4 developers):
- **Week 1**: Dev1 (Tool #8), Dev2 (Tool #3), Dev3 (Tool #1 start), Dev4 (Tool #5 start)
- **Week 2**: Dev1 (Tool #2 start), Dev2 (Tool #7 start), Dev3 (Tool #1 finish), Dev4 (Tool #5 finish)
- **Week 3**: Dev1 (Tool #2 finish), Dev2 (Tool #7 finish), Dev3 (Tool #4 start), Dev4 (Tool #6 start)
- **Week 4**: Dev3 (Tool #4 finish), Dev4 (Tool #6 finish), All (Integration testing)

**Total Timeline**: 12-15 days (parallel) vs. 45-55 days (sequential)

---

**Generated**: October 20, 2025
**Last Updated**: October 20, 2025
🤖 Generated with Claude Code
