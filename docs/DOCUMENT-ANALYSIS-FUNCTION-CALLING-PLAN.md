# 🏥 Document Analysis Function Calling Migration Plan

## 🎯 **Objective**
Replace text-based prompts with native Gemini function calling for medical document analysis to achieve:
- 95%+ reliability (vs current 60-70%)
- Eliminate manual parsing errors
- Support complex nested medical data
- Remove all database prompts completely

---

## 📋 **Current State Analysis**

### **❌ Problems with Current System:**
1. **Manual Parsing Failures**: Regex patterns fail when AI doesn't follow exact format
2. **Limited Data Structure**: Can only extract flat key-value pairs
3. **Language Dependency**: Separate prompts needed for Hebrew/English
4. **Maintenance Overhead**: 18+ complex prompts in database (9 categories × 2 languages)
5. **Unreliable Extraction**: AI sometimes doesn't use exact `_VALUE` suffix format

### **📊 Current Database Prompts to Replace:**
- `medical_relevance_check` (2 languages)
- `document_categorization` (2 languages) 
- `lab_results_extraction` (2 languages)
- `prescriptions_extraction` (2 languages)
- `discharge_summary_extraction` (2 languages)
- `imaging_reports_extraction` (2 languages)
- `consultation_notes_extraction` (2 languages)
- `vaccination_records_extraction` (2 languages)
- `referrals_extraction` (2 languages)
- `medical_certificate_extraction` (2 languages)
- `medical_procedures_extraction` (2 languages)

**Total: 22 prompts to eliminate!**

---

## 🚀 **Migration Plan**

### **Phase 1: Create Function Declarations (30 min)**
- [ ] Create `documentAnalysisServiceNew.js` with function calling
- [ ] Define medical relevance function
- [ ] Define document categorization function  
- [ ] Define extraction functions for all 9 categories
- [ ] Use rich nested data structures (arrays, objects)

### **Phase 2: Implement Core Logic (45 min)**
- [ ] Replace text-based analysis with function calling
- [ ] Remove all manual parsing (`extractFieldValue` functions)
- [ ] Handle function call responses directly
- [ ] Maintain backward compatibility with existing API

### **Phase 3: Testing & Validation (30 min)**
- [ ] Test with real medical documents
- [ ] Verify all 9 categories work correctly
- [ ] Compare results with old system
- [ ] Test Hebrew and English documents

### **Phase 4: Deployment (15 min)**
- [ ] Replace old service with new implementation
- [ ] Update any dependent services
- [ ] Clean up old code

### **Phase 5: Database Cleanup (15 min)**
- [ ] Remove all document analysis prompts from database
- [ ] Keep only translation prompts
- [ ] Verify system works without database prompts

---

## 🔧 **Technical Implementation**

### **Function Declarations Structure:**

```javascript
// Medical Relevance Check
const medicalRelevanceFunction = {
  name: "check_medical_relevance",
  description: "Determine if document contains medical information",
  parameters: {
    type: Type.OBJECT,
    properties: {
      isMedical: { type: Type.BOOLEAN, description: "True if medical document" },
      confidence: { type: Type.NUMBER, description: "Confidence score 0-1" },
      reasoning: { type: Type.STRING, description: "Why it's medical/non-medical" }
    },
    required: ["isMedical", "confidence"]
  }
};

// Document Categorization  
const categorizationFunction = {
  name: "categorize_document",
  description: "Categorize medical document type",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { 
        type: Type.STRING,
        enum: ["lab_results", "prescriptions", "discharge_summary", "imaging_reports", 
               "consultation_notes", "vaccination_records", "referrals", 
               "medical_certificate", "medical_procedures"],
        description: "Document category"
      },
      confidence: { type: Type.NUMBER, description: "Confidence score 0-1" }
    },
    required: ["category"]
  }
};

// Lab Results Extraction
const labResultsFunction = {
  name: "extract_lab_results",
  description: "Extract structured data from laboratory reports",
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: "Test date YYYY-MM-DD" },
      tests: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Test name" },
            value: { type: Type.STRING, description: "Result value" },
            unit: { type: Type.STRING, description: "Measurement unit" },
            referenceRange: { type: Type.STRING, description: "Normal range" },
            status: { type: Type.STRING, description: "Normal/High/Low" }
          }
        }
      },
      patientName: { type: Type.STRING, description: "Patient name" },
      doctorName: { type: Type.STRING, description: "Ordering physician" },
      labName: { type: Type.STRING, description: "Laboratory name" },
      notes: { type: Type.STRING, description: "Additional notes" }
    },
    required: ["date", "tests"]
  }
};
```

### **Benefits of New Structure:**
- **Rich Data**: Arrays of tests with multiple properties each
- **Validation**: Required fields ensure critical data is extracted
- **Flexibility**: Optional fields for additional information
- **Type Safety**: Numbers, booleans, strings properly typed
- **Multilingual**: Works in any language automatically

---

## 📊 **Expected Improvements**

| Metric | Current | With Function Calling |
|--------|---------|----------------------|
| Reliability | 60-70% | 95%+ |
| Data Structure | Flat key-value | Rich nested objects |
| Parsing Errors | Frequent | Eliminated |
| Language Support | 2 separate prompts | Universal |
| Maintenance | 22 database prompts | 0 prompts |
| Processing Speed | Slow (text parsing) | Fast (direct JSON) |

---

## 🎯 **Success Criteria**

- [ ] All 9 document categories extract data successfully
- [ ] No manual parsing code remains
- [ ] Hebrew and English documents work identically  
- [ ] Complex medical data (multiple tests, medications) extracted correctly
- [ ] All database prompts removed
- [ ] System reliability >95%

---

## 🚀 **Execution Timeline**

**Total Estimated Time: 2.5 hours**

1. **Phase 1**: 30 minutes - Function declarations
2. **Phase 2**: 45 minutes - Core implementation  
3. **Phase 3**: 30 minutes - Testing
4. **Phase 4**: 15 minutes - Deployment
5. **Phase 5**: 15 minutes - Database cleanup

**Ready to execute!** 🎉
