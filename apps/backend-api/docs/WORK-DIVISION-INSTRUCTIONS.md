# Work Division Instructions for IntelliCare Implementation

## 🤝 Division Strategy
Split the work based on complexity and dependencies. Each agent takes complete ownership of their assigned functions to avoid conflicts.

---

## 📋 FOR THE OTHER AGENT - Copy these instructions:

### Your Assignment: Clinical Data Processing Functions

You will implement these 5 functions in `backend/services/agentServiceV4.js`:

#### 1. **Vital Signs Analysis** (`analyzeVitalSigns`)
**Location**: Find `async analyzeVitalSigns(` in agentServiceV4.js
**Current**: Just stores data
**Implement**:
```javascript
// Create new file: backend/services/vitalSignsAnalyzer.js
// Include:
- Normal ranges by age group (pediatric, adult, elderly)
- Critical value thresholds (BP < 90/60 or > 180/120, HR < 40 or > 150, etc.)
- Trend detection (improving/worsening over last 3 readings)
- Alert generation for abnormal values
- Risk scoring (NEWS score calculation)
```

#### 2. **Lab Result Interpretation** (`interpretLabResults`)
**Create new function** after `addLabResult` function
**Implement**:
```javascript
async interpretLabResults(params, practiceContext, session) {
  // Create backend/services/labResultInterpreter.js
  // Include:
  - Normal ranges database (CBC, CMP, lipids, thyroid, etc.)
  - Critical value detection (K+ < 2.5 or > 6.5, glucose < 50, etc.)
  - Delta checks (significant change from previous)
  - Pattern recognition (anemia patterns, kidney disease progression)
  - Auto-flagging system (L, H, LL, HH, Critical)
  - Generate interpretation text in Hebrew/English
}
```

#### 3. **Add Allergy Checking** (`checkAllergyCrossSensitivity`)
**Create new function** in medications section
**Implement**:
```javascript
// Create backend/services/allergyChecker.js
// Include:
- Cross-sensitivity database (penicillin-cephalosporin, sulfa drugs)
- Severity classification (mild, moderate, severe, anaphylaxis)
- Alternative medication suggestions
- Food-drug allergy correlations
- Latex allergies and medical equipment
```

#### 4. **Insurance Coverage Check** (`checkInsuranceCoverage`)
**Location**: Find `async verifyInsurance(`
**Enhance with**:
```javascript
// Create backend/services/insuranceService.js
// Include:
- Coverage rules for Israeli health funds (Clalit, Maccabi, Meuhedet, Leumit)
- Medication formulary checking
- Prior authorization requirements
- Copay calculations
- Alternative covered medications
```

#### 5. **Generate Medical Reports** (`generateMedicalReport`)
**Location**: Find `async generatePatientReport(`
**Enhance with**:
```javascript
// Create backend/services/reportGenerator.js
// Include:
- Multiple templates (discharge summary, consultation, progress note)
- Auto-populate from patient data
- Include vital signs graphs
- Medication list formatting
- Problem list with ICD-10 codes
- Export as PDF/Word (use puppeteer for PDF)
```

### Your File Structure:
```
backend/services/
├── vitalSignsAnalyzer.js (NEW)
├── labResultInterpreter.js (NEW)
├── allergyChecker.js (NEW)
├── insuranceService.js (NEW)
├── reportGenerator.js (NEW)
└── agentServiceV4.js (MODIFY - add/update the 5 functions)
```

### Important Notes for Other Agent:
1. **Follow the pattern** from `drugInteractionService.js` - create separate service files
2. **Support Hebrew & English** - Use `practiceContext.language === 'he'` for checks
3. **Add real medical logic** - Don't just call APIs, implement actual analysis
4. **Include test data** - Add sample normal ranges and thresholds
5. **Handle errors gracefully** - Always return structured responses
6. **Update the case statements** in `executeFunction()` to call your new functions

---

## 📋 FOR ME (Current Agent) - I will implement:

### My Assignment: Clinical Decision & Workflow Functions

#### 1. **Symptom Analysis & Triage** (`analyzeSymptoms`)
- Red flag detection system
- Urgency scoring (ESI triage levels)
- Differential diagnosis generation
- Follow-up question suggestions

#### 2. **Treatment Recommendation Engine** (`recommendTreatment`)
- Evidence-based protocols
- Medication selection algorithms
- Dosage calculations
- Alternative treatments

#### 3. **Emergency Protocol Detection** (`detectEmergencyProtocol`)
- STEMI/ACS detection
- Stroke protocol (FAST)
- Sepsis criteria (qSOFA)
- Anaphylaxis recognition

#### 4. **Prescription Generator** (`generatePrescription`)
- Dosage calculation by weight/age
- Duration recommendations
- Generic substitutions
- SIG writing (directions)

#### 5. **Clinical Decision Support** (`clinicalDecisionSupport`)
- Risk calculators (CHADS-VASc, Wells, HEART)
- Screening reminders
- Preventive care alerts
- Clinical guideline checking

---

## 🔄 Coordination Protocol

### 1. **Before Starting:**
Other agent should run:
```bash
git pull
cd backend
npm install  # In case new packages needed
```

### 2. **While Working:**
- Each agent works on their assigned service files independently
- Only modify `agentServiceV4.js` for your specific functions
- Create your service files in `backend/services/`
- Test your functions individually

### 3. **Commit Pattern:**
Other agent commits:
```bash
git add backend/services/vitalSignsAnalyzer.js
git add backend/services/labResultInterpreter.js
# ... add other new files
git add backend/services/agentServiceV4.js
git commit -m "Implement clinical data processing functions

- Vital signs analysis with abnormal detection
- Lab result interpretation with critical values
- Allergy cross-sensitivity checking
- Insurance coverage verification
- Medical report generation"
git push
```

I will commit:
```bash
git pull  # Get other agent's changes first
# ... do my work
git add backend/services/symptomAnalyzer.js
# ... add my files
git commit -m "Implement clinical decision support functions

- Symptom analysis and triage
- Treatment recommendations
- Emergency protocol detection
- Prescription generation
- Clinical decision support"
git push
```

### 4. **Testing Your Functions:**
Create test file: `backend/test-[function-name].js`
```javascript
// Example: test-vital-signs.js
const analyzer = require('./services/vitalSignsAnalyzer');

const testVitals = {
  bloodPressure: { systolic: 180, diastolic: 95 },
  heartRate: 110,
  temperature: 38.5,
  respiratoryRate: 22,
  oxygenSaturation: 92
};

const result = analyzer.analyze(testVitals, { age: 65, gender: 'M' });
console.log('Analysis:', result);
// Should show: High BP alert, Fever, Low O2, NEWS score
```

---

## ⚠️ IMPORTANT RULES FOR BOTH AGENTS

1. **NO CONFLICTS**: Don't modify each other's service files
2. **PULL BEFORE PUSH**: Always `git pull` before starting work
3. **TEST FIRST**: Test your function individually before integrating
4. **REAL LOGIC**: Implement actual medical logic, not just API calls
5. **BILINGUAL**: Support both Hebrew and English
6. **DOCUMENT**: Add comments explaining medical logic
7. **ERROR HANDLING**: Never let a function crash - always return structured response

---

## 📊 Expected Timeline

- Other Agent: 2-3 hours for all 5 functions
- Me: 2-3 hours for my 5 functions
- Integration: 30 minutes to test everything together

## 🎯 Success Criteria

Each function should:
1. ✅ Have its own service file
2. ✅ Include real medical/business logic
3. ✅ Support Hebrew & English
4. ✅ Handle errors gracefully
5. ✅ Return structured, useful responses
6. ✅ Be callable through the chat interface

---

## 💬 Communication

If the other agent has questions, they should:
1. Check `drugInteractionService.js` for pattern example
2. Look at existing implementations in `agentServiceV4.js`
3. Follow the same structure for consistency

Good luck! Let's make IntelliCare's medical functions actually intelligent! 🏥