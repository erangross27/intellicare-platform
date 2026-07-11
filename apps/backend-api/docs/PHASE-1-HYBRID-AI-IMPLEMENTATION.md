# Phase 1: Core Clinical Functions with Hybrid AI Architecture

## 🧠 AI Model Strategy: Best of Both Worlds

### Model Strengths Analysis

| Capability | Claude (Opus/Sonnet) | Gemini 2.5 Flash | Winner | Use Case |
|------------|---------------------|------------------|---------|----------|
| **Context Understanding** | 200K tokens, perfect memory | 1M tokens but loses context | Claude | Function orchestration |
| **Function Calling** | Excellent, precise | Good but sometimes hallucinates | Claude | Main agent |
| **Medical Text Analysis** | Very strong | Strong | Claude | Patient records, notes |
| **Medical Imaging** | Cannot process | Excellent (MRI, CT, X-ray) | Gemini | Imaging analysis |
| **Cost** | $3-15/1M tokens | $0.30/1M tokens | Gemini | High volume |
| **Batch Processing** | Yes, 50% cheaper | No | Claude | Bulk operations |
| **Hebrew Support** | Good | Excellent | Gemini | Hebrew conversations |
| **Speed** | Fast | Very fast | Gemini | Real-time chat |
| **Medical Knowledge** | Excellent, cautious | Excellent, detailed | Tie | Both good |

## 🎯 Proposed Hybrid Architecture

```
User Input
    ↓
[Claude - Master Orchestrator]
    ├─→ Function Selection & Context Management
    ├─→ Complex Medical Text Analysis
    └─→ Decides which model to use for each task
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
[Claude Tasks]     [Gemini Tasks]
- Lab reports      - Medical imaging
- Clinical notes   - Hebrew conversations
- Prescriptions    - Quick lookups
- Batch processing - Cost-sensitive ops
```

## 📋 Phase 1 Implementation Breakdown

### 1.1 Appointments Module (7 Functions)

#### Function: `getAppointmentById`
```javascript
{
  name: "getAppointmentById",
  description: "Get detailed appointment information",
  aiModel: "CLAUDE", // Main orchestration
  implementation: async (params) => {
    // Claude handles the request orchestration
    const appointment = await this.callAPI(`/appointments/${params.appointmentId}`);
    
    // If appointment has imaging, send to Gemini
    if (appointment.hasImaging) {
      appointment.imagingAnalysis = await this.analyzeWithGemini(appointment.imaging);
    }
    
    return appointment;
  }
}
```

#### Function: `rescheduleAppointment`
```javascript
{
  name: "rescheduleAppointment",
  aiModel: "CLAUDE", // Complex scheduling logic
  requiredParams: ["appointmentId", "newDate", "newTime"],
  validateConflicts: true,
  checkProviderAvailability: true
}
```

#### Function: `updateAppointmentStatus`
```javascript
{
  name: "updateAppointmentStatus",
  aiModel: "CLAUDE", // Workflow management
  statuses: ["scheduled", "confirmed", "in-progress", "completed", "cancelled", "no-show"],
  triggerNotifications: true
}
```

#### Function: `recordAppointmentVitals`
```javascript
{
  name: "recordAppointmentVitals",
  aiModel: "CLAUDE", // Medical data validation
  vitalSigns: ["bloodPressure", "heartRate", "temperature", "weight", "oxygenSaturation"],
  validateRanges: true,
  flagAbnormal: true
}
```

#### Function: `getTodayAppointments`
```javascript
{
  name: "getTodayAppointments",
  aiModel: "GEMINI", // Simple, fast query
  cacheResults: true,
  refreshInterval: 300000 // 5 minutes
}
```

#### Function: `getDoctorAppointments`
```javascript
{
  name: "getDoctorAppointments",
  aiModel: "GEMINI", // Simple list retrieval
  filters: ["date", "status", "type"]
}
```

#### Function: `getOverdueAppointments`
```javascript
{
  name: "getOverdueAppointments",
  aiModel: "CLAUDE", // Complex business logic
  calculatePriority: true,
  suggestActions: true
}
```

### 1.2 Prescriptions Module (5 Functions)

#### Function: `getPrescriptionById`
```javascript
{
  name: "getPrescriptionById",
  aiModel: "CLAUDE", // Medication details need precision
  includeInteractions: true,
  checkAllergies: true
}
```

#### Function: `refillPrescription`
```javascript
{
  name: "refillPrescription",
  aiModel: "CLAUDE", // Critical medical decision
  validations: [
    "checkRefillsRemaining",
    "verifyLastDispenseDate",
    "checkContraindications",
    "validateInsuranceCoverage"
  ],
  requiresApproval: true
}
```

#### Function: `updatePrescriptionStatus`
```javascript
{
  name: "updatePrescriptionStatus",
  aiModel: "CLAUDE", // Workflow tracking
  statuses: ["prescribed", "sent", "filled", "picked-up", "cancelled"],
  notifyPharmacy: true
}
```

#### Function: `checkDrugInteractions` (Enhanced)
```javascript
{
  name: "checkDrugInteractions",
  aiModel: "HYBRID",
  implementation: async (medications) => {
    // Claude for complex interaction analysis
    const interactions = await claude.analyze({
      prompt: "Analyze drug interactions with medical context",
      medications: medications,
      patientConditions: patientData.conditions
    });
    
    // Gemini for quick reference checks
    const contraindications = await gemini.quickCheck({
      medications: medications,
      checkType: "contraindications"
    });
    
    return mergeAnalysis(interactions, contraindications);
  }
}
```

#### Function: `getPrescriptionHistory`
```javascript
{
  name: "getPrescriptionHistory",
  aiModel: "GEMINI", // Simple retrieval, Hebrew support
  sortBy: "date",
  groupBy: "medication"
}
```

### 1.3 Insurance Module (7 Functions)

#### Function: `addInsurance`
```javascript
{
  name: "addInsurance",
  aiModel: "CLAUDE", // Complex validation
  validatePolicy: true,
  verifyEligibility: true
}
```

#### Function: `getPatientInsurance`
```javascript
{
  name: "getPatientInsurance",
  aiModel: "GEMINI", // Simple retrieval
  includeHistory: true
}
```

#### Function: `requestAuthorization`
```javascript
{
  name: "requestAuthorization",
  aiModel: "HYBRID",
  implementation: async (params) => {
    // Claude analyzes medical necessity
    const medicalNecessity = await claude.analyze({
      diagnosis: params.diagnosis,
      treatment: params.treatment,
      guidelines: "insurance-medical-necessity"
    });
    
    // Gemini handles Hebrew forms if needed
    if (params.language === 'he') {
      const hebrewForm = await gemini.generate({
        template: "authorization-request-he",
        data: medicalNecessity
      });
    }
    
    return submitAuthorization(medicalNecessity);
  }
}
```

#### Function: `updateAuthorization`
```javascript
{
  name: "updateAuthorization",
  aiModel: "CLAUDE", // Status tracking
  statuses: ["pending", "approved", "denied", "appealed"]
}
```

#### Function: `checkServiceCoverage`
```javascript
{
  name: "checkServiceCoverage",
  aiModel: "CLAUDE", // Complex policy analysis
  analyzePolicy: true,
  checkDeductible: true,
  calculateCopay: true
}
```

#### Function: `updateClaimStatus`
```javascript
{
  name: "updateClaimStatus",
  aiModel: "GEMINI", // Simple status update
  statuses: ["submitted", "processing", "approved", "denied", "paid"]
}
```

#### Function: `getInsuranceById`
```javascript
{
  name: "getInsuranceById",
  aiModel: "GEMINI", // Simple retrieval
  includePolicy: true
}
```

### 1.4 Imaging Module (5 Functions)

#### Function: `getImagingResultById`
```javascript
{
  name: "getImagingResultById",
  aiModel: "GEMINI", // Gemini excels at imaging
  analyzeImages: true,
  generateReport: true
}
```

#### Function: `updateImagingResult`
```javascript
{
  name: "updateImagingResult",
  aiModel: "HYBRID",
  implementation: async (params) => {
    // Gemini analyzes the actual images
    const imageAnalysis = await gemini.analyzeImage({
      images: params.images,
      type: params.studyType // MRI, CT, X-ray
    });
    
    // Claude writes the medical report
    const report = await claude.generateReport({
      findings: imageAnalysis,
      clinicalContext: params.patientHistory,
      template: "radiology-report"
    });
    
    return saveImagingResult(report);
  }
}
```

#### Function: `getPendingStudies`
```javascript
{
  name: "getPendingStudies",
  aiModel: "GEMINI", // Simple list
  sortByUrgency: true
}
```

#### Function: `orderImagingStudy`
```javascript
{
  name: "orderImagingStudy",
  aiModel: "CLAUDE", // Medical decision
  validateIndications: true,
  checkContraindications: true,
  requiresJustification: true
}
```

#### Function: `analyzeImagingWithAI`
```javascript
{
  name: "analyzeImagingWithAI",
  aiModel: "GEMINI", // Gemini's strength
  implementation: async (params) => {
    const analysis = await gemini.vision({
      images: params.images,
      prompt: `Analyze this ${params.studyType}. Look for:
        - Abnormalities
        - Measurements
        - Comparison with prior studies
        - Recommendations`,
      medicalMode: true
    });
    
    return {
      findings: analysis.findings,
      measurements: analysis.measurements,
      impression: analysis.impression,
      recommendations: analysis.recommendations
    };
  }
}
```

## 🔧 Implementation Strategy

### Step 1: Update agentServiceV4.js with Model Selection
```javascript
class IntelliCareCompleteAgent {
  constructor() {
    // Initialize both AI models
    this.claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    this.gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Model selection logic
    this.modelRouter = {
      'complex_medical': 'claude',
      'imaging': 'gemini',
      'hebrew': 'gemini',
      'batch': 'claude',
      'quick_lookup': 'gemini',
      'function_orchestration': 'claude'
    };
  }
  
  async processWithBestModel(task, params) {
    const model = this.selectModel(task);
    
    if (model === 'claude') {
      return await this.processWithClaude(task, params);
    } else if (model === 'gemini') {
      return await this.processWithGemini(task, params);
    } else {
      // Hybrid approach
      return await this.processHybrid(task, params);
    }
  }
}
```

### Step 2: Batch Processing for Cost Optimization
```javascript
// For bulk operations, use Claude's batch API
async processBatch(operations) {
  if (operations.length > 10) {
    // Use Claude batch API (50% cheaper)
    return await claude.batch({
      requests: operations,
      maxConcurrency: 10
    });
  } else {
    // Use Gemini for small batches (faster)
    return await Promise.all(
      operations.map(op => gemini.process(op))
    );
  }
}
```

### Step 3: Context Management
```javascript
// Claude maintains the master context
class ContextManager {
  async maintainContext(sessionId) {
    // Claude keeps track of entire conversation
    this.masterContext = await claude.summarize({
      session: sessionId,
      includeHistory: true
    });
    
    // Pass relevant context to Gemini when needed
    this.geminiContext = this.extractRelevantContext(this.masterContext);
  }
}
```

## 💰 Cost Optimization Strategy

### Use Claude When:
- Complex medical decisions
- Multi-step reasoning
- Context is critical
- Batch processing (50% discount)
- Safety is paramount

### Use Gemini When:
- Medical imaging analysis
- Hebrew conversations
- Simple lookups
- High-volume, low-complexity
- Speed is critical

### Estimated Costs:
| Operation Type | Volume/Day | Model | Cost/Day |
|---------------|------------|-------|----------|
| Appointments | 1000 | Gemini | $0.30 |
| Prescriptions | 500 | Claude | $2.50 |
| Insurance Auth | 100 | Claude | $1.50 |
| Imaging Analysis | 50 | Gemini | $0.15 |
| Batch Processing | 5000 | Claude Batch | $5.00 |
| **Total** | **6650** | **Hybrid** | **$9.45** |

## 🚀 Implementation Timeline

### Week 1:
- Day 1-2: Implement appointment functions with Claude
- Day 3-4: Implement prescription functions with hybrid approach
- Day 5: Test and optimize model selection

### Week 2:
- Day 1-2: Implement insurance functions
- Day 3-4: Implement imaging functions with Gemini
- Day 5: Integration testing

## 📊 Success Metrics

1. **Function Coverage**: 100% of Phase 1 functions
2. **Response Time**: <2s for simple, <5s for complex
3. **Accuracy**: >95% correct function selection
4. **Cost**: <$10/day for 5000+ operations
5. **User Satisfaction**: Natural conversation feel

## 🔑 Key Decisions Needed

1. **Primary Orchestrator**: Claude (better context) or Gemini (cheaper)?
   - **Recommendation**: Claude for orchestration, Gemini for execution

2. **Batch Threshold**: When to use batch processing?
   - **Recommendation**: >10 operations = Claude batch

3. **Hebrew Handling**: All to Gemini or mixed?
   - **Recommendation**: Gemini for Hebrew conversations, Claude for Hebrew medical records

4. **Image Processing**: Always Gemini or add Claude analysis?
   - **Recommendation**: Gemini for image analysis, Claude for report writing

---

*Strategy Date: August 18, 2025*
*Models: Claude Opus/Sonnet + Gemini 2.5 Flash*
*Estimated Implementation: 2 weeks*