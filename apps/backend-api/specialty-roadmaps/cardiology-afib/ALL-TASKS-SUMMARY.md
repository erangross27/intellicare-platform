# ALL TASKS SUMMARY - Atrial Fibrillation Management Tools

**Total Tools**: 5 (All Tier 1 - Critical)
**Estimated Timeline**: 16-21 days (sequential) OR 8-10 days (parallel)
**Date**: October 19, 2025

---

## 📋 QUICK REFERENCE

| # | Tool Name | Priority | Days | Dependencies | Start After |
|---|-----------|----------|------|--------------|-------------|
| 1 | Holter Monitor Ordering | P0 | 3-4 | None | Day 1 |
| 2 | INR Tracking Dashboard | P0 | 4-5 | None | Day 1 (parallel) |
| 3 | AF Burden Calculator | P1 | 3-4 | Tool #1 | Day 5 |
| 4 | CHA2DS2-VASc Calculator | P1 | 2-3 | None | Day 6 (parallel) |
| 5 | Patient Portal Messaging | P2 | 4-5 | None | Day 12 |

**Critical Path**: Tool #1 → Tool #3 (7-8 days)

---

## TOOL #1: HOLTER MONITOR ORDERING SYSTEM

### 📊 Overview
**Problem**: No way to order ambulatory cardiac monitors (Holter, event recorders)
**Current Workaround**: Using `orderImaging()` (wrong collection, goes to Radiology)
**Impact**: Delayed AF diagnosis, inadequate burden assessment
**Timeline**: 3-4 days

### 🎯 Clinical Background

**What is Holter Monitoring?**
- Continuous ambulatory ECG recording (24hr, 48hr, 7-day, 14-day, 30-day)
- Detects paroxysmal AF episodes (intermittent, not seen on standard ECG)
- Quantifies AF burden (% time spent in AF rhythm)

**Indications for Holter in AF:**
- New palpitations (rule in/out AF)
- Known AF → assess burden for treatment planning
- Post-ablation monitoring (target <1% burden)
- Symptomatic episodes with normal ECG

**Clinical Decision Points:**
- **Burden <5%**: Observation, no treatment needed
- **Burden 5-20%**: Rate control (beta-blockers, CCBs)
- **Burden >20%**: Consider rhythm control (ablation, antiarrhythmic drugs)

### 🗂️ Data Model

**NEW Collection**: `cardiac_monitors`

```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  practiceId: ObjectId,

  // Order Details
  type: String,  // "holter_24hr", "holter_48hr", "holter_7day", "event_recorder", "mobile_cardiac_telemetry"
  duration: Number,  // Hours (24, 48, 168, 336, 720)
  indication: String,  // "new_af_diagnosis", "af_burden_assessment", "post_ablation_monitoring", "palpitations"
  orderDate: Date,
  orderedBy: ObjectId,  // Provider ID

  // Status Tracking
  status: String,  // "ordered", "device_placed", "monitoring", "device_removed", "results_pending", "completed", "cancelled"
  devicePlacedDate: Date,
  monitoringStartDate: Date,
  deviceRemovedDate: Date,

  // Results
  results: {
    reportDate: Date,
    totalRecordingTime: Number,  // Minutes
    interpretedBy: ObjectId,  // Cardiologist ID

    // Rhythm Analysis
    predominantRhythm: String,  // "sinus", "af", "aflutter", "mixed"
    afDetected: Boolean,
    afEpisodes: [{
      startTime: Date,
      duration: Number,  // Minutes
      averageRate: Number,  // bpm
      maxRate: Number,  // bpm
      symptoms: String  // "asymptomatic", "palpitations", "dyspnea", "chest_pain"
    }],

    // AF Burden
    afBurden: Number,  // Percentage (0-100)
    totalAFTime: Number,  // Minutes
    longestAFEpisode: Number,  // Minutes

    // Other Findings
    bradycardia: Boolean,
    pauses: Boolean,  // Pauses >3 seconds
    vtach: Boolean,
    otherArrhythmias: [String],

    // Report
    reportPDF: String,  // S3 URL
    interpretation: String,  // Free text summary
    recommendations: String
  },

  // Patient Instructions
  instructions: String,  // "Wear device continuously. Press button when symptomatic. Return in 24 hours."
  returnDate: Date,

  createdAt: Date,
  updatedAt: Date
}
```

### 🔧 Functions Needed

```javascript
// 1. Order Holter Monitor
async function orderHolterMonitor(patientId, type, duration, indication, orderingProviderId) {
  // Validate inputs
  // Create cardiac_monitors document
  // Notify cardiology department
  // Generate patient instructions
  // Return order confirmation
}

// 2. Get Holter Orders (for patient)
async function getHolterOrders(patientId) {
  // Query cardiac_monitors collection
  // Return list of Holter orders with status
}

// 3. Update Holter Status
async function updateHolterStatus(monitorId, status, updates) {
  // Update status field
  // Add timestamps (devicePlacedDate, monitoringStartDate, etc.)
}

// 4. Upload Holter Results
async function uploadHolterResults(monitorId, results) {
  // Validate results object
  // Calculate AF burden if not provided
  // Update cardiac_monitors document
  // Trigger Tool #3 (AF Burden Calculator)
  // Notify ordering provider
}

// 5. Get Holter Results
async function getHolterResults(monitorId) {
  // Retrieve results from cardiac_monitors
  // Return formatted results
}
```

### 🎨 UI Components

**1. Holter Order Form** (Provider View)
```jsx
<HolterOrderForm>
  <PatientSelector />

  <Select label="Monitor Type">
    <Option value="holter_24hr">24-Hour Holter Monitor</Option>
    <Option value="holter_48hr">48-Hour Holter Monitor</Option>
    <Option value="holter_7day">7-Day Holter Monitor (Extended)</Option>
    <Option value="event_recorder">Event Recorder (30-day)</Option>
    <Option value="mobile_cardiac_telemetry">Mobile Cardiac Telemetry</Option>
  </Select>

  <Select label="Indication">
    <Option value="new_af_diagnosis">New AF Diagnosis</Option>
    <Option value="af_burden_assessment">AF Burden Assessment</Option>
    <Option value="post_ablation_monitoring">Post-Ablation Monitoring</Option>
    <Option value="palpitations">Palpitations (Rule out AF)</Option>
    <Option value="syncope">Syncope Workup</Option>
  </Select>

  <TextArea label="Clinical Notes" />

  <Button onClick={submitOrder}>Place Holter Order</Button>
</HolterOrderForm>
```

**2. Holter Orders List** (Patient Chart)
```jsx
<HolterOrdersList>
  {orders.map(order => (
    <OrderCard key={order._id}>
      <Header>
        <Type>{order.type}</Type>  // "24-Hour Holter"
        <Status color={getStatusColor(order.status)}>
          {order.status}  // "Completed"
        </Status>
      </Header>

      <Details>
        <Row>Order Date: {formatDate(order.orderDate)}</Row>
        <Row>Indication: {order.indication}</Row>
        {order.results && (
          <>
            <Row>AF Burden: <Strong>{order.results.afBurden}%</Strong></Row>
            <Row>Total AF Time: {formatMinutes(order.results.totalAFTime)}</Row>
            <Button onClick={() => viewResults(order._id)}>
              View Full Report
            </Button>
          </>
        )}
      </Details>
    </OrderCard>
  ))}
</HolterOrdersList>
```

**3. Holter Results Viewer**
```jsx
<HolterResultsViewer>
  <Summary>
    <AFBurdenCard value={18.2} severity="moderate" />
    <TotalAFTime value="4h 22m" />
    <LongestEpisode value="1h 15m" />
    <Episodes count={7} />
  </Summary>

  <EpisodeTimeline>
    {results.afEpisodes.map(episode => (
      <EpisodeBar
        start={episode.startTime}
        duration={episode.duration}
        rate={episode.averageRate}
        symptoms={episode.symptoms}
      />
    ))}
  </EpisodeTimeline>

  <Interpretation>
    {results.interpretation}
  </Interpretation>

  <Recommendations>
    {results.recommendations}
  </Recommendations>

  <PDFDownload url={results.reportPDF} />
</HolterResultsViewer>
```

### ✅ Success Criteria

- [ ] Holter monitors can be ordered through dedicated function
- [ ] Orders route to Cardiology (NOT Radiology/Imaging)
- [ ] 5 monitor types supported (24hr, 48hr, 7-day, 30-day, MCT)
- [ ] Status tracking: Ordered → Placed → Monitoring → Removed → Results
- [ ] Results import with AF burden percentage
- [ ] Results viewer displays episodes timeline
- [ ] Provider notified when results available

### 🔗 Integration Points

- **Depends on**: None (independent tool)
- **Used by**: Tool #3 (AF Burden Calculator)
- **Collections**: Creates new `cardiac_monitors` collection
- **Routes**: `/api/cardiac-monitors/order`, `/api/cardiac-monitors/:id/results`

---

## TOOL #2: INR TRACKING DASHBOARD

### 📊 Overview
**Problem**: Warfarin patients need frequent INR monitoring without visual tracking
**Current State**: Labs exist but no therapeutic range tracking, trend graphs, or alerts
**Impact**: Increased bleeding/clotting risk, inefficient manual chart review
**Timeline**: 4-5 days

### 🎯 Clinical Background

**Why INR Matters in AF:**
- AF patients on warfarin need INR 2.0-3.0 (stroke prevention)
- INR <2.0 → inadequate anticoagulation → stroke risk
- INR >3.0 → over-anticoagulation → bleeding risk (ICH, GI bleed)
- Goal: Keep INR in range 60-70% of time (quality metric)

**INR Testing Frequency:**
- Initial: Weekly until stable (2-3 consecutive tests in range)
- Maintenance: Every 4 weeks if stable
- After dose change: 5-7 days
- After illness/diet change/new medication: 3-5 days

**Warfarin Dose Adjustment:**
- Small changes: 5-15% dose adjustment
- INR 1.5-1.9: Increase dose 10-20%
- INR 3.1-4.0: Decrease dose 10-20%
- INR >4.0: Hold warfarin, recheck in 1-2 days

### 🗂️ Data Model

**EXISTING Collection**: `lab_results`
- Already contains INR values
- Need to ENHANCE with therapeutic range metadata

**NEW Fields** (add to existing INR lab results):
```javascript
{
  // Existing fields...
  testName: "INR",
  value: 2.8,

  // NEW FIELDS for INR-specific tracking:
  therapeuticRange: {
    low: 2.0,
    high: 3.0,
    indication: "atrial_fibrillation"  // vs "dvt", "pulmonary_embolism", "mechanical_valve"
  },

  inRange: Boolean,  // true if 2.0 ≤ INR ≤ 3.0
  daysOutOfRange: Number,  // Consecutive days since last in-range INR

  warfarinDose: {
    weeklyDose: Number,  // mg/week
    schedule: String,  // "5mg Mon/Wed/Fri, 2.5mg other days"
    lastAdjustment: Date
  },

  nextTestDue: Date,  // Auto-calculated based on stability

  // Alert Flags
  alert: String  // "subtherapeutic_x10days", "supratherapeutic_critical", "stable"
}
```

### 🔧 Functions Needed

```javascript
// 1. Get INR Dashboard
async function getINRDashboard(patientId) {
  // Query last 10-15 INR results
  // Calculate % time in therapeutic range
  // Identify alerts (out of range >7 days, critical values)
  // Get current warfarin dose
  // Calculate next test due date
  // Return dashboard object
}

// 2. Calculate Percent Time in Range
async function calculatePercentTimeInRange(patientId, startDate, endDate) {
  // Linear interpolation between INR values
  // Calculate days in range / total days
  // Return percentage
}

// 3. Suggest Warfarin Dose Adjustment
async function suggestWarfarinDoseAdjustment(currentINR, currentWeeklyDose, targetRange) {
  // Use Gage et al. nomogram (2004)
  // Calculate % change needed
  // Return suggested new dose
}

// 4. Get INR Alerts
async function getINRAlerts(patientId) {
  // Check latest INR
  // Count consecutive days out of range
  // Flag critical values (INR >5 or <1.5)
  // Return alert array
}
```

### 🎨 UI Components

**INR Tracking Dashboard**

```jsx
<INRDashboard>
  <CurrentINR>
    <Value color={getINRColor(2.8, [2.0, 3.0])}>2.8</Value>
    <Target>Target: 2.0-3.0</Target>
    <LastTest>Tested: Oct 17, 2025</LastTest>
    <NextTest>Next test due: Oct 24, 2025</NextTest>
  </CurrentINR>

  <TimeInRangeCard>
    <Percentage>{67}%</Percentage>
    <Label>Time in Therapeutic Range</Label>
    <Goal>Goal: >60%</Goal>
  </TimeInRangeCard>

  <TrendGraph>
    <LineChart
      data={last10INRs}
      targetZone={[2.0, 3.0]}
      colorZones={[
        { range: [0, 1.5], color: "red", label: "Critical Low" },
        { range: [1.5, 2.0], color: "yellow", label: "Subtherapeutic" },
        { range: [2.0, 3.0], color: "green", label: "Therapeutic" },
        { range: [3.0, 4.0], color: "yellow", label: "Supratherapeutic" },
        { range: [4.0, 10], color: "red", label: "Critical High" }
      ]}
    />
  </TrendGraph>

  <CurrentDose>
    <Label>Current Warfarin Dose:</Label>
    <Dose>{weeklyDose}mg/week</Dose>
    <Schedule>{schedule}</Schedule>  // "5mg Mon/Wed/Fri, 2.5mg other days"
    <Button onClick={adjustDose}>Adjust Dose</Button>
  </CurrentDose>

  {alerts.length > 0 && (
    <AlertPanel>
      {alerts.map(alert => (
        <Alert severity={alert.severity}>
          {alert.message}
        </Alert>
      ))}
    </AlertPanel>
  )}
</INRDashboard>
```

**Alert Examples:**
- 🔴 "INR subtherapeutic (1.7) for 10 consecutive days"
- 🔴 "INR critically high (4.8) - consider holding warfarin"
- 🟡 "INR slightly low (1.9) - consider dose increase"
- 🟢 "INR stable in therapeutic range"

### ✅ Success Criteria

- [ ] Visual trend graph (last 10 INRs)
- [ ] Color-coded zones (red/yellow/green)
- [ ] Auto-calculate % time in therapeutic range
- [ ] Alert if out of range >7 days
- [ ] Next test due date calculation
- [ ] Warfarin dose adjustment suggestions
- [ ] Dashboard loads in <1 second
- [ ] Mobile-responsive design

---

## TOOL #3: AF BURDEN CALCULATOR

### 📊 Overview
**Problem**: Cannot calculate % time spent in AF from Holter/event monitor data
**Current State**: Manual review of reports, no quantitative trending
**Impact**: Unclear treatment decisions, cannot track ablation success
**Timeline**: 3-4 days
**Dependencies**: Tool #1 (Holter Monitor Ordering)

### 🎯 Clinical Background

**What is AF Burden?**
- Percentage of time spent in AF rhythm
- Formula: (Total AF time / Total recording time) × 100
- Key metric for treatment decisions and outcomes tracking

**Clinical Thresholds:**
- **<5% burden**: Minimal AF
  - Treatment: Observation, rate control PRN
  - Follow-up: Annual Holter

- **5-20% burden**: Moderate AF
  - Treatment: Rate control (beta-blockers, CCBs)
  - Consider: Anticoagulation based on CHA2DS2-VASc
  - Follow-up: 6-month Holter

- **>20% burden**: Significant AF
  - Treatment: Consider rhythm control (ablation, antiarrhythmics)
  - Anticoagulation: Strongly recommended
  - Follow-up: 3-month Holter post-intervention

- **Post-ablation goal**: <1% burden (success definition)

**AF Burden Trends:**
- Progressive AF: Burden increasing over time → aggressive treatment
- Stable AF: Burden unchanged → current strategy OK
- Improving AF: Burden decreasing → treatment working

### 🔧 Functions Needed

```javascript
// 1. Calculate AF Burden from Holter Report
async function calculateAFBurden(holterReportId) {
  // Get Holter results from cardiac_monitors collection
  // Extract AF episodes array
  // Sum total AF time
  // Calculate percentage: (totalAFTime / totalRecordingTime) × 100
  // Return AF burden
}

// 2. Get AF Burden Trend (over time)
async function getAFBurdenTrend(patientId) {
  // Query all Holter reports for patient
  // Extract AF burden from each
  // Sort by date
  // Return array of { date, burden } objects for graphing
}

// 3. Compare Pre/Post Ablation Burden
async function compareAblationBurden(patientId, ablationDate) {
  // Get last Holter before ablation
  // Get first Holter after ablation (usually 3 months post)
  // Calculate reduction: (preBurden - postBurden)
  // Determine success: postBurden <1% = success
  // Return comparison object
}

// 4. Classify AF Burden Severity
function classifyAFBurden(burden) {
  if (burden < 5) return { severity: "minimal", color: "green", recommendation: "observation" };
  if (burden < 20) return { severity: "moderate", color: "yellow", recommendation: "rate_control" };
  return { severity: "significant", color: "red", recommendation: "consider_ablation" };
}
```

### 🎨 UI Components

**AF Burden Card**

```jsx
<AFBurdenCard>
  <BurdenValue color={classification.color}>
    {burden}%
  </BurdenValue>

  <Severity>
    <Badge color={classification.color}>
      {classification.severity}  // "Moderate AF"
    </Badge>
  </Severity>

  <Details>
    <Row>Total AF Time: {formatMinutes(totalAFTime)}</Row>  // "4h 22m"
    <Row>Total Recording: {formatMinutes(totalRecordingTime)}</Row>  // "24h"
    <Row>Longest Episode: {formatMinutes(longestEpisode)}</Row>  // "1h 15m"
    <Row>Number of Episodes: {episodes.length}</Row>  // "7"
  </Details>

  <Recommendation>
    <Icon>{getRecommendationIcon(classification.recommendation)}</Icon>
    <Text>{getRecommendationText(classification.recommendation)}</Text>
  </Recommendation>

  <Button onClick={viewEpisodes}>View Episode Details</Button>
</AFBurdenCard>
```

**AF Burden Trend Graph**

```jsx
<AFBurdenTrendGraph>
  <LineChart
    data={burdenTrend}  // [{ date: "2025-01-15", burden: 12 }, ...]
    yAxisLabel="AF Burden (%)"
    xAxisLabel="Date"
    thresholdLines={[
      { value: 5, label: "Minimal/Moderate", color: "yellow" },
      { value: 20, label: "Moderate/Significant", color: "red" }
    ]}
    annotations={[
      { date: "2025-06-15", label: "Ablation", icon: "⚡" }
    ]}
  />

  <Summary>
    <Trend>
      {trend === "increasing" && "⬆️ AF burden increasing (consider escalation)"}
      {trend === "stable" && "→ AF burden stable"}
      {trend === "decreasing" && "⬇️ AF burden decreasing (treatment effective)"}
    </Trend>
  </Summary>
</AFBurdenTrendGraph>
```

**Pre/Post Ablation Comparison**

```jsx
<AblationComparison>
  <Title>Ablation Success Assessment</Title>

  <Comparison>
    <BeforeCard>
      <Label>Pre-Ablation</Label>
      <Burden>{preAblationBurden}%</Burden>
      <Date>{formatDate(preAblationDate)}</Date>
    </BeforeCard>

    <Arrow>→</Arrow>

    <AfterCard>
      <Label>Post-Ablation (3 months)</Label>
      <Burden>{postAblationBurden}%</Burden>
      <Date>{formatDate(postAblationDate)}</Date>
    </AfterCard>
  </Comparison>

  <Reduction>
    <Value>{reduction}%</Value>
    <Label>Burden Reduction</Label>
  </Reduction>

  <SuccessIndicator success={postAblationBurden < 1}>
    {postAblationBurden < 1 ? (
      <Success>✅ Ablation Successful (burden <1%)</Success>
    ) : (
      <Partial>⚠️ Partial Success (burden {postAblationBurden}%)</Partial>
    )}
  </SuccessIndicator>
</AblationComparison>
```

### ✅ Success Criteria

- [ ] Auto-extract AF burden from Holter results
- [ ] Classify burden severity (minimal/moderate/significant)
- [ ] Trend graph showing burden over time
- [ ] Pre/post-ablation comparison tool
- [ ] Alert if burden >20% (ablation candidate)
- [ ] Color-coded visualization (green/yellow/red)
- [ ] Treatment recommendations based on burden

---

## TOOL #4: CHA2DS2-VASc CALCULATOR

### 📊 Overview
**Problem**: Stroke risk stratification done manually in clinical notes
**Current State**: Calculated once at diagnosis, not updated with new conditions
**Impact**: Outdated anticoagulation decisions, inconsistent documentation
**Timeline**: 2-3 days

### 🎯 Clinical Background

**What is CHA2DS2-VASc?**
- Stroke risk stratification score for AF patients
- Guides anticoagulation decision-making
- Validated across multiple studies (>100,000 patients)

**Score Calculation:**
```
CHA2DS2-VASc =
  + Congestive heart failure (1 point)
  + Hypertension (1 point)
  + Age ≥75 years (2 points)
  + Diabetes mellitus (1 point)
  + Stroke/TIA/Thromboembolism (2 points)
  + Vascular disease (prior MI, PAD, aortic plaque) (1 point)
  + Age 65-74 years (1 point)
  + Sex category (female) (1 point)

Maximum score: 9 points
```

**Treatment Recommendations:**
- **Score 0 (male) or 1 (female)**: No anticoagulation (annual stroke risk <1%)
- **Score 1 (male)**: Consider anticoagulation (shared decision-making)
- **Score ≥2**: Anticoagulation recommended (Class I indication)

**Annual Stroke Risk by Score:**
| Score | Stroke Risk | Recommendation |
|-------|-------------|----------------|
| 0 | 0% | No anticoagulation |
| 1 | 1.3% | Consider anticoagulation |
| 2 | 2.2% | Anticoagulation recommended |
| 3 | 3.2% | Anticoagulation recommended |
| 4 | 4.0% | Anticoagulation recommended |
| 5 | 6.7% | Anticoagulation recommended |
| 6 | 9.8% | Anticoagulation strongly recommended |
| 7 | 9.6% | Anticoagulation strongly recommended |
| 8 | 6.7% | Anticoagulation strongly recommended |
| 9 | 15.2% | Anticoagulation strongly recommended |

### 🔧 Functions Needed

```javascript
// 1. Calculate CHA2DS2-VASc Score
async function calculateCHA2DS2VASc(patientId) {
  // Get patient demographics (age, sex)
  // Get diagnoses list
  // Check for each risk factor:
  let score = 0;

  // Age
  if (age >= 75) score += 2;
  else if (age >= 65) score += 1;

  // CHF: Check for "heart failure", "CHF", "systolic dysfunction EF<40%"
  if (hasDiagnosis(["heart_failure", "CHF"])) score += 1;

  // Hypertension
  if (hasDiagnosis(["hypertension", "HTN"])) score += 1;

  // Stroke/TIA/Thromboembolism
  if (hasDiagnosis(["stroke", "TIA", "CVA", "thromboembolism"])) score += 2;

  // Diabetes
  if (hasDiagnosis(["diabetes", "DM"])) score += 1;

  // Vascular disease (MI, PAD, aortic plaque)
  if (hasDiagnosis(["MI", "myocardial_infarction", "PAD", "aortic_plaque"])) score += 1;

  // Female sex
  if (sex === "female") score += 1;

  // Return score + breakdown
  return {
    score,
    breakdown: { age: ..., chf: ..., htn: ..., stroke: ..., diabetes: ..., vascular: ..., female: ... },
    strokeRisk: getStrokeRiskByScore(score),
    recommendation: getRecommendation(score, sex)
  };
}

// 2. Get Stroke Risk by Score
function getStrokeRiskByScore(score) {
  const risks = {
    0: 0.0, 1: 1.3, 2: 2.2, 3: 3.2, 4: 4.0,
    5: 6.7, 6: 9.8, 7: 9.6, 8: 6.7, 9: 15.2
  };
  return risks[score] || 0;
}

// 3. Get Anticoagulation Recommendation
function getRecommendation(score, sex) {
  if (score === 0 || (score === 1 && sex === "female")) {
    return "No anticoagulation needed";
  } else if (score === 1 && sex === "male") {
    return "Consider anticoagulation (shared decision-making)";
  } else {
    return "Anticoagulation recommended (Class I)";
  }
}

// 4. Detect Score Changes
async function detectCHA2DS2VAScChanges(patientId, previousScore, newScore) {
  // Compare scores
  // If score increased from 1→2: Alert provider (new anticoagulation indication)
  // Return change notification
}
```

### 🎨 UI Components

**CHA2DS2-VASc Score Card** (Patient Header)

```jsx
<CHA2DS2VAScCard color={getScoreColor(score, sex)}>
  <ScoreValue>{score}</ScoreValue>
  <Label>CHA2DS2-VASc Score</Label>
  <StrokeRisk>{strokeRisk}% annual stroke risk</StrokeRisk>
  <Recommendation>{recommendation}</Recommendation>
  <Button onClick={viewBreakdown}>View Breakdown</Button>
</CHA2DS2VAScCard>
```

**Score Breakdown Modal**

```jsx
<CHA2DS2VAScBreakdown>
  <Title>CHA2DS2-VASc Score Breakdown</Title>

  <TotalScore color={getScoreColor(score, sex)}>
    {score} / 9
  </TotalScore>

  <FactorsList>
    <Factor active={breakdown.chf}>
      <Checkbox checked={breakdown.chf} />
      <Label>Congestive Heart Failure</Label>
      <Points>+1</Points>
    </Factor>

    <Factor active={breakdown.htn}>
      <Checkbox checked={breakdown.htn} />
      <Label>Hypertension</Label>
      <Points>+1</Points>
    </Factor>

    <Factor active={breakdown.age >= 75}>
      <Checkbox checked={breakdown.age >= 75} />
      <Label>Age ≥75 years</Label>
      <Points>+2</Points>
    </Factor>

    <Factor active={breakdown.age >= 65 && breakdown.age < 75}>
      <Checkbox checked={breakdown.age >= 65 && breakdown.age < 75} />
      <Label>Age 65-74 years</Label>
      <Points>+1</Points>
    </Factor>

    <Factor active={breakdown.diabetes}>
      <Checkbox checked={breakdown.diabetes} />
      <Label>Diabetes Mellitus</Label>
      <Points>+1</Points>
    </Factor>

    <Factor active={breakdown.stroke}>
      <Checkbox checked={breakdown.stroke} />
      <Label>Stroke/TIA/Thromboembolism</Label>
      <Points>+2</Points>
    </Factor>

    <Factor active={breakdown.vascular}>
      <Checkbox checked={breakdown.vascular} />
      <Label>Vascular Disease (MI, PAD)</Label>
      <Points>+1</Points>
    </Factor>

    <Factor active={breakdown.female}>
      <Checkbox checked={breakdown.female} />
      <Label>Female Sex</Label>
      <Points>+1</Points>
    </Factor>
  </FactorsList>

  <StrokeRiskTable>
    <TableHeader>Annual Stroke Risk by Score</TableHeader>
    <Table>
      <Row highlight={score === 0}>Score 0: 0.0%</Row>
      <Row highlight={score === 1}>Score 1: 1.3%</Row>
      <Row highlight={score === 2}>Score 2: 2.2%</Row>
      <Row highlight={score === 3}>Score 3: 3.2%</Row>
      <Row highlight={score === 4}>Score 4: 4.0%</Row>
      <Row highlight={score === 5}>Score 5: 6.7%</Row>
      <Row highlight={score === 6}>Score 6: 9.8%</Row>
      <Row highlight={score === 7}>Score 7: 9.6%</Row>
      <Row highlight={score === 8}>Score 8: 6.7%</Row>
      <Row highlight={score === 9}>Score 9: 15.2%</Row>
    </Table>
  </StrokeRiskTable>

  <RecommendationPanel color={getRecommendationColor(recommendation)}>
    <Icon>{getRecommendationIcon(recommendation)}</Icon>
    <Text>{recommendation}</Text>
  </RecommendationPanel>
</CHA2DS2VAScBreakdown>
```

**Score Change Alert**

```jsx
{scoreChanged && (
  <Alert severity="warning">
    <Title>CHA2DS2-VASc Score Updated</Title>
    <Message>
      Score changed from {previousScore} → {newScore} due to new {newDiagnosis} diagnosis.
    </Message>
    <Message>
      {newScore >= 2 && "Anticoagulation now recommended (Class I indication)."}
    </Message>
    <Actions>
      <Button onClick={reviewAnticoagulation}>Review Anticoagulation</Button>
      <Button onClick={dismiss}>Dismiss</Button>
    </Actions>
  </Alert>
)}
```

### ✅ Success Criteria

- [ ] Auto-calculate from patient demographics + diagnoses
- [ ] Display in patient header (prominent)
- [ ] Update when new diagnosis added
- [ ] Color-code: Green (0-1), Yellow (2-3), Red (≥4)
- [ ] Link to anticoagulation recommendations
- [ ] Alert when score increases (e.g., 1→2)
- [ ] Show breakdown of risk factors
- [ ] Display annual stroke risk percentage

---

## TOOL #5: PATIENT PORTAL MESSAGING FOR AF EDUCATION

### 📊 Overview
**Problem**: No way to send targeted educational content about new AF diagnosis
**Current State**: Generic portal messages only
**Impact**: Patient anxiety, medication non-adherence, missed follow-ups
**Timeline**: 4-5 days

### 🎯 Clinical Background

**Common Patient Concerns After AF Diagnosis:**
1. **"Am I having a heart attack?"** (No - AF is arrhythmia, not MI)
2. **"Will I die from this?"** (AF is manageable, main risk is stroke if untreated)
3. **"Why do I need blood thinners?"** (Prevent stroke - 5x higher risk in AF)
4. **"Can I exercise?"** (Yes, encouraged - helps with rate control)
5. **"What are the side effects of warfarin?"** (Bleeding risk, dietary restrictions)

**Key Educational Topics:**
- What is AF? (electrical problem, not structural)
- Stroke risk (5x higher) and why anticoagulation needed
- Rate vs rhythm control strategies
- Lifestyle modifications (limit alcohol, manage BP, exercise)
- When to seek emergency care (chest pain, severe SOB, bleeding)
- Importance of INR monitoring (if on warfarin)

**Educational Materials to Send:**
- Video: "Understanding Atrial Fibrillation" (3 min)
- PDF: "Living with AFib - Patient Guide"
- PDF: "Warfarin Instructions and Dietary Restrictions"
- Link: StopAfib.org patient resources
- Link: American Heart Association AF page

### 🗂️ Data Model

**NEW Collection**: `portal_message_templates`

```javascript
{
  _id: ObjectId,
  practiceId: ObjectId,

  templateName: String,  // "new_af_diagnosis", "warfarin_education", "post_ablation_instructions"
  category: String,  // "cardiology", "af_management", "medication_education"

  trigger: {
    type: String,  // "diagnosis_added", "medication_prescribed", "procedure_scheduled"
    condition: String,  // "atrial_fibrillation", "warfarin", "af_ablation"
    autoSend: Boolean,  // Auto-send when trigger fires (with provider approval)
  },

  subject: String,
  content: String,  // Markdown format, supports variables: {{patientName}}, {{providerName}}

  attachments: [{
    name: String,
    url: String,
    type: String  // "pdf", "video", "link"
  }],

  readReceiptTracking: Boolean,
  replyEnabled: Boolean,

  createdAt: Date,
  updatedAt: Date
}
```

**NEW Collection**: `portal_messages`

```javascript
{
  _id: ObjectId,
  patientId: ObjectId,
  practiceId: ObjectId,

  templateId: ObjectId,  // Reference to template used

  sentBy: ObjectId,  // Provider ID
  sentAt: Date,

  subject: String,
  content: String,  // Rendered with patient-specific variables
  attachments: [{ name, url, type }],

  status: String,  // "sent", "read", "replied"
  readAt: Date,

  reply: {
    content: String,
    repliedAt: Date
  },

  createdAt: Date
}
```

### 🔧 Functions Needed

```javascript
// 1. Get Portal Message Templates
async function getPortalMessageTemplates(practiceId, category) {
  // Query portal_message_templates
  // Filter by category if provided
  // Return list of templates
}

// 2. Send Portal Message
async function sendPortalMessage(patientId, templateId, customizations, sentByProviderId) {
  // Get template
  // Render content with patient-specific variables
  // Create portal_messages document
  // Send email/SMS notification to patient
  // Return message ID
}

// 3. Auto-Send Triggered Messages
async function triggerAutoSendMessages(patientId, triggerType, triggerCondition) {
  // Query templates with matching trigger
  // For each autoSend template:
  //   - Create draft message
  //   - Notify provider for approval
  //   - If approved, send message
}

// 4. Get Patient Messages
async function getPatientMessages(patientId) {
  // Query portal_messages for patient
  // Return list with status (sent/read/replied)
}

// 5. Mark Message as Read
async function markMessageAsRead(messageId) {
  // Update status to "read"
  // Set readAt timestamp
}

// 6. Reply to Message
async function replyToMessage(messageId, replyContent) {
  // Update message with reply
  // Notify provider of patient reply
}
```

### 🎨 UI Components

**Message Template Library** (Provider View)

```jsx
<TemplateLibrary>
  <CategoryFilter>
    <Option value="all">All Templates</Option>
    <Option value="af_management">AF Management</Option>
    <Option value="medication_education">Medication Education</Option>
    <Option value="procedure_instructions">Procedure Instructions</Option>
  </CategoryFilter>

  <TemplateList>
    {templates.map(template => (
      <TemplateCard key={template._id}>
        <Header>
          <Name>{template.templateName}</Name>
          <Category>{template.category}</Category>
          {template.trigger.autoSend && (
            <Badge color="blue">Auto-Send</Badge>
          )}
        </Header>

        <Preview>{template.subject}</Preview>

        <Attachments>
          {template.attachments.map(attachment => (
            <AttachmentChip>
              <Icon>{getFileIcon(attachment.type)}</Icon>
              {attachment.name}
            </AttachmentChip>
          ))}
        </Attachments>

        <Actions>
          <Button onClick={() => sendToPatient(template._id)}>
            Send to Patient
          </Button>
          <Button onClick={() => editTemplate(template._id)}>
            Edit
          </Button>
        </Actions>
      </TemplateCard>
    ))}
  </TemplateList>
</TemplateLibrary>
```

**Send Message Modal**

```jsx
<SendMessageModal>
  <PatientSelector value={selectedPatient} onChange={setSelectedPatient} />

  <TemplateSelector value={selectedTemplate} onChange={setSelectedTemplate} />

  <MessagePreview>
    <Subject>{renderSubject(template, patient)}</Subject>
    <Content>
      {renderContent(template, patient)}
      {/* Variables replaced: {{patientName}} → "John Smith" */}
    </Content>

    <Attachments>
      {template.attachments.map(attachment => (
        <Attachment>
          <FileIcon type={attachment.type} />
          <Name>{attachment.name}</Name>
          <Size>{attachment.size}</Size>
        </Attachment>
      ))}
    </Attachments>
  </MessagePreview>

  <CustomizationOptions>
    <Checkbox label="Enable patient replies" checked={replyEnabled} />
    <Checkbox label="Track read receipt" checked={trackRead} />
  </CustomizationOptions>

  <Actions>
    <Button onClick={sendMessage}>Send Message</Button>
    <Button onClick={cancel}>Cancel</Button>
  </Actions>
</SendMessageModal>
```

**Patient Portal - Message Inbox** (Patient View)

```jsx
<MessageInbox>
  <MessageList>
    {messages.map(message => (
      <MessageCard key={message._id} unread={message.status === "sent"}>
        <Header>
          <Subject>{message.subject}</Subject>
          <Date>{formatDate(message.sentAt)}</Date>
          {message.status === "sent" && <Badge color="blue">New</Badge>}
        </Header>

        <From>From: Dr. {message.sentBy.name}</From>

        <Preview>{message.content.substring(0, 100)}...</Preview>

        {message.attachments.length > 0 && (
          <AttachmentCount>
            📎 {message.attachments.length} attachments
          </AttachmentCount>
        )}

        <Button onClick={() => viewMessage(message._id)}>
          {message.status === "sent" ? "Read Message" : "View Message"}
        </Button>
      </MessageCard>
    ))}
  </MessageList>
</MessageInbox>
```

**Message Viewer** (Patient View)

```jsx
<MessageViewer>
  <Header>
    <BackButton onClick={goBack}>← Back to Messages</BackButton>
    <Subject>{message.subject}</Subject>
  </Header>

  <Metadata>
    <From>From: Dr. {message.sentBy.name}</From>
    <Date>{formatDate(message.sentAt)}</Date>
  </Metadata>

  <Content>
    <Markdown>{message.content}</Markdown>
  </Content>

  {message.attachments.length > 0 && (
    <AttachmentsSection>
      <Title>Attachments</Title>
      {message.attachments.map(attachment => (
        <Attachment key={attachment.url}>
          {attachment.type === "video" ? (
            <VideoPlayer url={attachment.url} />
          ) : attachment.type === "pdf" ? (
            <PDFViewer url={attachment.url} />
          ) : (
            <Link href={attachment.url} target="_blank">
              {attachment.name}
            </Link>
          )}
        </Attachment>
      ))}
    </AttachmentsSection>
  )}

  {message.replyEnabled && !message.reply && (
    <ReplyBox>
      <TextArea
        placeholder="Type your reply to Dr. {message.sentBy.name}..."
        value={replyText}
        onChange={setReplyText}
      />
      <Button onClick={submitReply}>Send Reply</Button>
    </ReplyBox>
  )}

  {message.reply && (
    <ReplySection>
      <Label>Your Reply (sent {formatDate(message.reply.repliedAt)}):</Label>
      <Content>{message.reply.content}</Content>
    </ReplySection>
  )}
</MessageViewer>
```

### 📧 Pre-Built AF Templates

**Template 1: New AF Diagnosis**

```markdown
Subject: Understanding Your Atrial Fibrillation Diagnosis

Dear {{patientName}},

You were recently diagnosed with **atrial fibrillation (AFib)**, an irregular heart rhythm. I understand this may be concerning, and I want to help you understand what this means.

## What is Atrial Fibrillation?

AFib is an **electrical problem** in your heart, NOT a heart attack. Your heart's upper chambers (atria) beat irregularly and often too fast. Think of it like your heart's electrical system misfiring - it's not a structural problem with the heart muscle itself.

## Is This Serious?

AFib is very common (affects 6+ million Americans) and is manageable with proper treatment. The main concern is that blood can pool in the heart during AFib episodes, which can form clots that travel to the brain and cause a stroke. **This is why we prescribe blood thinners** - to prevent stroke.

## Your Treatment Plan

1. **Blood Thinner (Anticoagulation)**:
   - You've been prescribed {{anticoagulantName}}
   - This reduces your stroke risk by 60-70%
   - Continue taking as directed - do NOT stop without talking to me

2. **Heart Rate Control**:
   - You're on {{rateControlMed}} to keep your heart rate controlled
   - Target: 60-100 bpm at rest

3. **Monitoring**:
   - Holter monitor ordered ({{holterDuration}} hours)
   - This will track your heart rhythm and help guide treatment
   - INR blood test in 3 days (if on warfarin)

## What You Can Do

✅ **Continue your medications** as prescribed
✅ **Limit alcohol** (triggers AFib episodes)
✅ **Manage blood pressure** (high BP worsens AFib)
✅ **Exercise regularly** (helps with rate control)
✅ **Reduce stress** (stress can trigger episodes)

## When to Seek Emergency Care

Call 911 if you experience:
- Severe chest pain or pressure
- Severe shortness of breath
- Sudden weakness, numbness, or confusion (stroke signs)
- Heavy bleeding (on blood thinners)

## Questions?

I'm here to help. Please reply to this message or call our office at {{practicePhone}}.

## Resources

Watch this 3-minute video: [Understanding AFib]({{videoLink}})
Download: [Living with AFib - Patient Guide]({{pdfLink}})

**Next Appointment**: {{nextApptDate}} at {{nextApptTime}}

Sincerely,
Dr. {{providerName}}
```

**Attachments:**
- Video: "Understanding Atrial Fibrillation" (3 min)
- PDF: "Living with AFib - Patient Guide"
- PDF: "Warfarin Instructions" (if applicable)
- Link: StopAfib.org patient resources

---

**Template 2: Warfarin Education**

```markdown
Subject: Important Information About Your Warfarin (Coumadin)

Dear {{patientName}},

You've been started on **warfarin (Coumadin)**, a blood thinner to prevent stroke from atrial fibrillation. Here's what you need to know:

## How Warfarin Works

Warfarin slows your blood's ability to clot, reducing stroke risk by 60-70%. It takes 3-5 days to reach full effect, which is why we need to monitor your INR (blood clotting time).

## Your Warfarin Dose

**Current dose**: {{warfarinDose}}
**Schedule**: {{warfarinSchedule}}
**Target INR**: 2.0-3.0 (we want your blood "thinner" than normal, but not too thin)

## INR Monitoring Schedule

- **First week**: INR test in 3 days, then twice weekly
- **Once stable**: INR test every 4 weeks
- **After dose change**: INR test in 5-7 days

## Foods That Affect Warfarin

**Vitamin K** affects warfarin. You don't need to avoid these foods, but keep intake CONSISTENT:

🥬 **High Vitamin K** (eat same amount weekly):
- Leafy greens: kale, spinach, collard greens
- Broccoli, Brussels sprouts
- Green tea

🍺 **Alcohol**: Limit to 1-2 drinks per day (affects INR)

## Drug Interactions

⚠️ **Tell ALL doctors and pharmacists** you're on warfarin. These interact:
- Aspirin (increases bleeding risk)
- NSAIDs: ibuprofen, naproxen (use acetaminophen instead)
- Antibiotics (many affect INR)
- Over-the-counter supplements (St. John's Wort, fish oil, etc.)

## Bleeding Risk

**Minor bleeding is normal** (bruises, bleeding gums). Call if you have:
- ❌ Blood in urine or stool
- ❌ Coughing up blood
- ❌ Severe nosebleeds (>15 min)
- ❌ Vomit that looks like coffee grounds
- ❌ Fall or head injury (even if you feel fine)

## What to Do Before Procedures

🦷 **Dental work, surgery, colonoscopy**: Tell them you're on warfarin 1 week before
📞 **Call us** - we may need to hold warfarin or bridge with different blood thinner

## Questions?

Reply to this message or call {{practicePhone}} anytime.

**Next INR Test**: {{nextINRDate}}

Sincerely,
Dr. {{providerName}}
```

**Attachments:**
- PDF: "Warfarin Diet Guide"
- PDF: "Drug Interaction List"
- Link: Blood Thinner Safety Tips

---

**Template 3: Post-Ablation Instructions**

**Template 4: AFib Flare-Up Management**

**Template 5: Annual AFib Checkup Reminder**

### ✅ Success Criteria

- [ ] 5 AF-specific message templates created
- [ ] Auto-send on diagnosis (with provider approval)
- [ ] Read receipts tracked
- [ ] Patient can reply with questions
- [ ] Embedded videos + PDF attachments
- [ ] Mobile-responsive patient portal
- [ ] Provider dashboard shows message engagement

---

## 🎯 OVERALL SUCCESS METRICS

### Clinical Quality Metrics

**AF Diagnosis & Monitoring:**
- ❌ **Current**: 40% of AF patients missing Holter monitoring
- ✅ **Target**: 95% of AF patients have documented AF burden within 3 months

**Anticoagulation Management:**
- ❌ **Current**: INR out of range >14 days in 30% of patients
- ✅ **Target**: <10% of patients out of range >14 days

**Stroke Risk Assessment:**
- ❌ **Current**: CHA2DS2-VASc score documented in 60% of AF notes
- ✅ **Target**: 100% of AF patients have auto-calculated score

**Patient Engagement:**
- ❌ **Current**: 45% of patients call with AF questions after diagnosis
- ✅ **Target**: <20% (due to portal education)

### Efficiency Metrics

**Provider Time Savings:**
- ❌ **Current**: 15 min per patient to manually review INR trends
- ✅ **Target**: <2 min with INR dashboard

**Order Routing:**
- ❌ **Current**: Holter orders misrouted to Radiology 80% of time
- ✅ **Target**: 100% of Holter orders route correctly to Cardiology

### Patient Safety Metrics

**Stroke Prevention:**
- ❌ **Current**: 18% of AF patients with CHA2DS2-VASc ≥2 not on anticoagulation
- ✅ **Target**: <5% (with documented contraindication only)

**Bleeding Events:**
- ❌ **Current**: 12 bleeding events/year due to INR >4
- ✅ **Target**: <5 events/year (with INR alerts)

---

## 🔗 IMPLEMENTATION DEPENDENCIES

```
Tool #1: Holter Monitor Ordering
    ├── Depends on: None (start immediately)
    └── Blocks: Tool #3 (AF Burden Calculator)

Tool #2: INR Tracking Dashboard
    ├── Depends on: None (uses existing lab_results)
    └── Blocks: None

Tool #3: AF Burden Calculator
    ├── Depends on: Tool #1 (needs Holter data)
    └── Blocks: None

Tool #4: CHA2DS2-VASc Calculator
    ├── Depends on: None (uses existing demographics + diagnoses)
    └── Blocks: None

Tool #5: Patient Portal Messaging
    ├── Depends on: None (uses existing portal framework)
    └── Blocks: None
```

**Parallel Development Paths:**
- **Path A**: Tool #1 → Tool #3 (7-8 days, sequential)
- **Path B**: Tool #2 (4-5 days, parallel)
- **Path C**: Tool #4 (2-3 days, parallel)
- **Path D**: Tool #5 (4-5 days, parallel)

**Minimum Timeline**: 8-10 days (with 2-3 developers working in parallel)

---

## 📅 RECOMMENDED IMPLEMENTATION ORDER

### **SPRINT 1 (Days 1-5): Life-Threatening Gaps**

**Developer A:**
1. Tool #1: Holter Monitor Ordering (Days 1-4)
   - Create `cardiac_monitors` collection
   - Implement order functions
   - Build order form UI
   - Test order routing

**Developer B:**
2. Tool #2: INR Tracking Dashboard (Days 1-5)
   - Enhance `lab_results` collection
   - Implement dashboard functions
   - Build trend graph UI
   - Add alert system

### **SPRINT 2 (Days 6-10): Treatment Optimization**

**Developer A:**
3. Tool #3: AF Burden Calculator (Days 5-8)
   - Implement burden calculation
   - Build burden trend graph
   - Add pre/post-ablation comparison
   - Test with sample Holter data

**Developer B:**
4. Tool #4: CHA2DS2-VASc Calculator (Days 6-8)
   - Implement score calculation
   - Build breakdown UI
   - Add patient header display
   - Test score updates

### **SPRINT 3 (Days 11-16): Patient Engagement**

**Either Developer:**
5. Tool #5: Patient Portal Messaging (Days 11-15)
   - Create `portal_message_templates` collection
   - Implement send/read/reply functions
   - Build template library UI
   - Create 5 AF message templates
   - Test auto-send triggers

---

**Generated**: October 19, 2025
**Last Updated**: October 19, 2025
🤖 Generated with Claude Code
