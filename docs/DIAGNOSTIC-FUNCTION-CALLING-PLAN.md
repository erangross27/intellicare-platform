# 🏥 Diagnostic System Function Calling Migration Plan

## 🎯 **Objective**
Replace text-based diagnostic prompts with native Gemini function calling for medical diagnosis to achieve:
- 95%+ reliability vs current text parsing
- Structured medical data output
- Eliminate remaining 6 database prompts (3 categories × 2 languages)

---

## 📋 **Current State Analysis**

### **❌ Problems with Current Diagnostic System:**
1. **Text-Based Responses**: AI returns unstructured text that needs manual parsing
2. **Inconsistent Format**: Responses don't always follow the expected structure
3. **Language Dependency**: Separate prompts needed for Hebrew/English
4. **Manual Parsing**: Complex text processing to extract confidence, risk levels, recommendations
5. **Unreliable Extraction**: Parsing often fails when AI doesn't follow exact format

### **📊 Current Database Prompts to Replace:**
- `diagnosis_with_confidence` (2 languages) - Comprehensive medical analysis
- `diagnosis_self_assess` (2 languages) - Symptom-by-symptom analysis  
- `recommendations` (2 languages) - Treatment recommendations

**Total: 6 prompts to eliminate!**

---

## 🚀 **Migration Plan**

### **Phase 1: Create Diagnostic Function Declarations (30 min)**
- [ ] Create `diagnosticServiceNew.js` with function calling
- [ ] Define comprehensive diagnosis function
- [ ] Define symptom assessment function
- [ ] Define treatment recommendations function
- [ ] Use structured medical data with confidence scores

### **Phase 2: Implement Core Logic (45 min)**
- [ ] Replace text-based diagnosis with function calling
- [ ] Remove manual text parsing for confidence/risk levels
- [ ] Handle structured function call responses
- [ ] Maintain compatibility with existing diagnosis API

### **Phase 3: Testing & Validation (30 min)**
- [ ] Test with real patient symptoms
- [ ] Verify structured output format
- [ ] Compare with old system results
- [ ] Test Hebrew and English diagnosis

### **Phase 4: Integration (20 min)**
- [ ] Update diagnosis routes to use new service
- [ ] Replace old service with new implementation
- [ ] Verify frontend compatibility

### **Phase 5: Database Cleanup (10 min)**
- [ ] Remove remaining 6 diagnostic prompts from database
- [ ] Verify system works without any prompts
- [ ] Complete elimination of all database prompts

---

## 🔧 **Technical Implementation**

### **Function Declarations Structure:**

```javascript
// Comprehensive Medical Diagnosis
const comprehensiveDiagnosisFunction = {
  name: "provide_medical_diagnosis",
  description: "Provide comprehensive medical analysis with structured diagnosis",
  parameters: {
    type: Type.OBJECT,
    properties: {
      primaryDiagnosis: {
        type: Type.STRING,
        description: "Most likely primary diagnosis"
      },
      differentialDiagnoses: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Alternative possible diagnoses"
      },
      confidence: {
        type: Type.NUMBER,
        description: "Diagnostic confidence percentage (0-100)"
      },
      riskLevel: {
        type: Type.STRING,
        enum: ["LOW", "MEDIUM", "HIGH"],
        description: "Patient risk level"
      },
      symptomAnalysis: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            symptom: { type: Type.STRING, description: "Symptom name" },
            significance: { type: Type.STRING, description: "Clinical significance" },
            severity: { type: Type.STRING, enum: ["MILD", "MODERATE", "SEVERE"] }
          }
        }
      },
      requiredInvestigations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Laboratory tests and imaging needed"
      },
      urgency: {
        type: Type.STRING,
        enum: ["ROUTINE", "URGENT", "EMERGENCY"],
        description: "Clinical urgency level"
      }
    },
    required: ["primaryDiagnosis", "confidence", "riskLevel"]
  }
};

// Treatment Recommendations
const treatmentRecommendationsFunction = {
  name: "provide_treatment_recommendations",
  description: "Provide structured treatment recommendations",
  parameters: {
    type: Type.OBJECT,
    properties: {
      immediateActions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Immediate treatment actions needed"
      },
      medications: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Medication name" },
            dosage: { type: Type.STRING, description: "Dosage instructions" },
            duration: { type: Type.STRING, description: "Treatment duration" },
            purpose: { type: Type.STRING, description: "Why this medication" }
          }
        }
      },
      lifestyle: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Lifestyle modifications"
      },
      followUp: {
        type: Type.OBJECT,
        properties: {
          timeframe: { type: Type.STRING, description: "When to follow up" },
          monitoring: { type: Type.ARRAY, items: { type: Type.STRING } },
          warningSignsToWatch: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      },
      specialistReferrals: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            specialty: { type: Type.STRING, description: "Medical specialty" },
            urgency: { type: Type.STRING, enum: ["ROUTINE", "URGENT", "EMERGENCY"] },
            reason: { type: Type.STRING, description: "Reason for referral" }
          }
        }
      }
    },
    required: ["immediateActions"]
  }
};
```

### **Benefits of New Structure:**
- **Rich Medical Data**: Structured diagnosis with confidence scores
- **Clinical Decision Support**: Risk levels, urgency, investigations
- **Comprehensive Treatment**: Medications, lifestyle, follow-up plans
- **Type Safety**: Guaranteed data structure and validation
- **Multilingual**: Works in any language automatically

---

## 📊 **Expected Improvements**

| Metric | Current | With Function Calling |
|--------|---------|----------------------|
| Reliability | 70-80% | 95%+ |
| Data Structure | Unstructured text | Rich medical objects |
| Parsing Errors | Frequent | Eliminated |
| Language Support | 2 separate prompts | Universal |
| Maintenance | 6 database prompts | 0 prompts |
| Clinical Utility | Basic text | Structured medical data |

---

## 🎯 **Success Criteria**

- [ ] All 3 diagnostic functions work with structured output
- [ ] Confidence scores and risk levels properly extracted
- [ ] Treatment recommendations in structured format
- [ ] Hebrew and English diagnosis work identically
- [ ] All 6 database prompts removed
- [ ] Frontend receives compatible data structure
- [ ] System reliability >95%

---

## 🚀 **Execution Timeline**

**Total Estimated Time: 2.25 hours**

1. **Phase 1**: 30 minutes - Function declarations
2. **Phase 2**: 45 minutes - Core implementation
3. **Phase 3**: 30 minutes - Testing
4. **Phase 4**: 20 minutes - Integration
5. **Phase 5**: 10 minutes - Database cleanup

**Ready to execute!** 🎉
