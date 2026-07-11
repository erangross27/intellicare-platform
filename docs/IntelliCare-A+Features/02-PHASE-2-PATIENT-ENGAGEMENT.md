# Phase 2: Patient Engagement Loop
**Two-Way AI Communication - Talk WITH Patients, Not About Them**

## Objective
Enable patients to communicate with the AI, receive personalized guidance, and actively participate in their care.

## Architecture Overview

```
Patient Input → AI Understanding → Personalized Response → Action Tracking → Clinician Visibility
```

## Task Breakdown

### 2.1 Patient Portal Foundation (Week 1)
**Goal:** Secure patient-facing interface

#### Task 2.1.1: Patient Authentication System
- **What:** Separate patient login (different from clinician login)
- **Use existing:** Session management system
- **Add:** Patient role, limited permissions
- **Files to create:**
  - `middleware/patientAuth.js`
  - `routes/patient.js`
- **Security:** Read-only access to own data, no practice-wide access

#### Task 2.1.2: Patient Dashboard Layout
- **What:** Simple, patient-friendly UI
- **Sections:**
  - My Trends (simplified view)
  - My Medications
  - My Appointments
  - Chat with AI
  - Educational Resources
- **Files to create:**
  - `apps/frontend-vite/src/pages/PatientDashboard.jsx`
  - `apps/frontend-vite/src/components/patient/*`
- **Design:** Large fonts, simple language, mobile-first

#### Task 2.1.3: Patient Data Privacy Layer
- **What:** Filter what patients can see (hide sensitive clinician notes)
- **Files to create:**
  - `services/patientDataFilter.js`
- **Rules:** Show trends, meds, results - hide internal assessments

---

### 2.2 AI Chat Interface (Week 2)
**Goal:** Natural language conversation with Claude

#### Task 2.2.1: Patient Chat Service
- **What:** Claude-powered chat for patient questions
- **Input:** Patient question in plain language
- **Output:** Simple, non-medical-jargon answer
- **Files to create:**
  - `services/patientChatService.js`
- **Use existing:** Claude API (Haiku for speed + cost efficiency)

#### Task 2.2.2: Context-Aware Responses
- **What:** Claude knows patient's current conditions and medications
- **Input:** Question + patient medical context
- **Output:** Personalized answer
- **Example:**
  - Question: "Can I take ibuprofen?"
  - Context: Patient has asthma + NSAID allergy
  - Answer: "No, ibuprofen is not safe for you because you have an allergy to NSAIDs. Use acetaminophen instead."
- **Files to create:**
  - `services/patientContextBuilder.js`

#### Task 2.2.3: Safety Guardrails
- **What:** Prevent AI from giving dangerous advice
- **Rules:**
  - Never contradict doctor's orders
  - Always suggest "ask your doctor" for urgent symptoms
  - Flag emergency symptoms (chest pain, difficulty breathing)
- **Files to create:**
  - `services/chatSafetyGuardrails.js`

#### Task 2.2.4: Chat History Storage
- **What:** Save conversation for clinician review
- **Collections to create:**
  - `patient_chat_history`
- **Clinician access:** Can review what patient asked AI

---

### 2.3 Symptom Diary (Week 3)
**Goal:** Daily symptom tracking with AI analysis

#### Task 2.3.1: Symptom Input Form
- **What:** Simple daily questionnaire
- **Examples:**
  - Asthma: Peak flow, rescue inhaler use, nighttime symptoms
  - Diabetes: Blood sugar, exercise, meals
- **Files to create:**
  - `apps/frontend-vite/src/components/patient/SymptomDiary.jsx`
- **Mobile-friendly:** Quick 2-minute daily check-in

#### Task 2.3.2: Symptom Pattern Analyzer
- **What:** Claude analyzes symptom trends
- **Input:** Daily symptom data
- **Output:** "Your asthma symptoms are worsening this week - more nighttime cough"
- **Files to create:**
  - `services/symptomAnalyzer.js`
- **Frequency:** Weekly analysis

#### Task 2.3.3: Red Flag Detector
- **What:** Immediate alerts for concerning symptoms
- **Example:** "3 nights of symptoms in a row" → Alert clinician
- **Files to create:**
  - `services/symptomRedFlagDetector.js`
- **Action:** Trigger notification to clinician

---

### 2.4 Medication Adherence Tracker (Week 4)
**Goal:** Help patients remember and understand their medications

#### Task 2.4.1: Medication List Display
- **What:** Patient-friendly medication list
- **Show:**
  - Medication name (brand + generic)
  - What it's for (plain English)
  - How to take it
  - When to take it
  - Pictures of pills (if available)
- **Files to create:**
  - `apps/frontend-vite/src/components/patient/MyMedications.jsx`

#### Task 2.4.2: Medication Reminder System
- **What:** Daily reminders via web notifications
- **Use:** Browser push notifications (no SMS needed)
- **Files to create:**
  - `services/medicationReminderService.js`
- **Timing:** Based on prescribed schedule

#### Task 2.4.3: Adherence Check-In
- **What:** "Did you take your medications today?"
- **Track:** Adherence percentage
- **Alert clinician:** If <80% adherence
- **Files to create:**
  - `services/adherenceTracker.js`
- **Collections to create:**
  - `medication_adherence_log`

#### Task 2.4.4: Side Effect Reporting
- **What:** Patient reports side effects via simple form
- **Input:** "I feel dizzy after taking this medication"
- **Action:** Flag for clinician review
- **Collections to create:**
  - `patient_reported_side_effects`

---

### 2.5 Personalized Education (Week 5)
**Goal:** Right information, right time, right format

#### Task 2.5.1: AI Education Content Generator
- **What:** Claude creates personalized explanations
- **Input:** Patient's conditions + reading level
- **Output:** Simple educational content
- **Example:** "What is asthma?" written at 6th grade level
- **Files to create:**
  - `services/educationContentGenerator.js`

#### Task 2.5.2: Condition Explainer
- **What:** Explain diagnosis in simple terms
- **Format:** "You have asthma. This means your airways get tight and make it hard to breathe."
- **Use:** Patient education context from AI analysis
- **Files to create:**
  - `services/conditionExplainer.js`

#### Task 2.5.3: Test Result Interpreter
- **What:** Explain lab results to patients
- **Example:** "Your FeNO is 68. This is high and means your airways are inflamed."
- **Files to create:**
  - `services/labResultExplainer.js`
- **Safety:** Always include "Talk to your doctor about what this means for you"

#### Task 2.5.4: Educational Resource Library
- **What:** Store patient-friendly articles, videos, infographics
- **Collections to create:**
  - `patient_education_library`
- **Content:** Link to trusted sources (CDC, Mayo Clinic, condition-specific orgs)

---

### 2.6 Patient-to-Clinician Communication (Week 5)
**Goal:** Secure messaging without phone tag

#### Task 2.6.1: Secure Messaging Interface
- **What:** Patient can message clinical team
- **Features:**
  - Write message
  - Attach photo (e.g., rash photo)
  - Mark as urgent
- **Files to create:**
  - `apps/frontend-vite/src/components/patient/MessageCenter.jsx`
- **Use existing:** MongoDB for message storage

#### Task 2.6.2: Message Triage System
- **What:** AI categorizes message urgency
- **Input:** Patient message
- **Output:** Urgent (same day) / Routine (1-3 days) / Low priority
- **Files to create:**
  - `services/messageTriageService.js`

#### Task 2.6.3: Clinician Message Dashboard
- **What:** Clinicians see patient messages prioritized by urgency
- **Files to create:**
  - `apps/frontend-vite/src/components/clinician/PatientMessages.jsx`

---

## Testing Strategy

### Patient Usability Testing
- Test with 5-10 real patients
- Measure: Time to complete tasks, confusion points
- Iterate on UI based on feedback

### Safety Testing
- Test guardrails with dangerous questions
- Verify emergency symptoms trigger alerts
- Ensure no contradictory advice

### Load Testing
- Simulate 100+ concurrent patient chats
- Test notification system at scale

---

## Success Metrics

1. **Patient Activation:** >60% of patients log in monthly
2. **Chat Engagement:** >40% of patients use AI chat
3. **Adherence Improvement:** >20% increase in medication adherence
4. **Symptom Diary:** >50% of patients log symptoms weekly
5. **Clinician Time Saved:** >30% reduction in phone calls/messages
6. **Patient Satisfaction:** >80% rate experience as "helpful"

---

## Resources Required

**Computing:**
- ✅ Use existing Node.js backend
- ✅ Use existing MongoDB
- ✅ Use Claude Haiku API (cheaper for patient interactions)

**Data:**
- ✅ Patient medical data already in system
- ✅ Educational content from trusted sources (free)

**External Services:**
- ✅ Browser push notifications (free, built-in)
- ✅ No SMS needed (web-based)

---

## Risks and Mitigations

**Risk 1:** Patients get bad medical advice from AI
- **Mitigation:** Strict safety guardrails, always include "consult your doctor"

**Risk 2:** Low patient adoption
- **Mitigation:** Simple, mobile-friendly design; gamification (adherence streaks)

**Risk 3:** Information overload
- **Mitigation:** Progressive disclosure; show only what's relevant now

**Risk 4:** HIPAA compliance
- **Mitigation:** Secure authentication, encrypted storage, audit logging

---

## HIPAA Compliance Checklist

- ✅ Patient authentication (httpOnly cookies, same as clinician)
- ✅ Encrypted data in transit (HTTPS)
- ✅ Encrypted data at rest (MongoDB encryption)
- ✅ Audit logs (who accessed what, when)
- ✅ Patient data segregation (multi-tenant isolation)
- ✅ Automatic session timeout
- ✅ No PHI in browser push notifications (generic: "Time to take medication")

---

## Next Phase Trigger

**Phase 2 Complete When:**
- ✅ Patient portal operational
- ✅ AI chat functional with safety guardrails
- ✅ Symptom diary + adherence tracking live
- ✅ >50% patient engagement rate

**Then:** Proceed to Phase 3 (Frictionless Integration)

---

**Phase Duration:** 4-5 weeks
**Dependencies:** None (can start in parallel with Phase 1)
**Can Start:** Immediately
