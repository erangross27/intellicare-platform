# Task 1.3: Update addHistoryFunction Schema

## 📋 **Task Overview**
**Phase:** 1 (Critical Functions)  
**Time Estimate:** 10 minutes  
**Risk Level:** LOW  
**Priority:** HIGH  

Update the `addHistoryFunction` schema to remove old schema fields (`age`, `gender`) that no longer exist in the new patient schema.

## 🎯 **Objective**
Clean up the medical history function to:
- Remove `age` and `gender` fields (not in new schema)
- Keep patient identification by name
- Maintain all medical history fields
- Update descriptions for clarity

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Lines:** 74-104  
**Function:** `this.addHistoryFunction`

## 🔍 **Current Code (BEFORE)**
```javascript
this.addHistoryFunction = {
  name: "add_history",
  description: "Add medical history record for a patient",
  parameters: {
    type: Type.OBJECT,
    properties: {
      patient_name: {
        type: Type.STRING,
        description: "Patient name to add history for"
      },
      category: {
        type: Type.STRING,
        description: "Medical category: lab_results, prescriptions, consultation_notes, imaging_reports, vaccination_records, referrals, medical_certificate, medical_procedures, discharge_summary"
      },
      diagnosis: {
        type: Type.STRING,
        description: "Medical diagnosis"
      },
      symptoms: {
        type: Type.STRING,
        description: "Patient symptoms"
      },
      treatment: {
        type: Type.STRING,
        description: "Treatment provided"
      },
      notes: {
        type: Type.STRING,
        description: "Additional notes"
      },
      followUpDate: {
        type: Type.STRING,
        description: "Follow-up date (YYYY-MM-DD)"
      },
      age: {
        type: Type.NUMBER,
        description: "Patient age"
      },
      gender: {
        type: Type.STRING,
        description: "Patient gender"
      }
    },
    required: ["patient_name", "category", "diagnosis"]
  }
};
```

## ✅ **New Code (AFTER)**
```javascript
this.addHistoryFunction = {
  name: "add_history", // ← Keep same name for function calling detection
  description: "Add medical history record for a patient",
  parameters: {
    type: Type.OBJECT,
    properties: {
      patient_name: {
        type: Type.STRING,
        description: "Patient full name (firstName lastName) / שם המטופל המלא"
      },
      category: {
        type: Type.STRING,
        description: "Medical category: lab_results, prescriptions, consultation_notes, imaging_reports, vaccination_records, referrals, medical_certificate, medical_procedures, discharge_summary"
      },
      diagnosis: {
        type: Type.STRING,
        description: "Medical diagnosis / אבחנה רפואית"
      },
      symptoms: {
        type: Type.STRING,
        description: "Patient symptoms / תסמינים"
      },
      treatment: {
        type: Type.STRING,
        description: "Treatment provided / טיפול שניתן"
      },
      notes: {
        type: Type.STRING,
        description: "Additional notes / הערות נוספות"
      },
      followUpDate: {
        type: Type.STRING,
        description: "Follow-up date (YYYY-MM-DD) / תאריך מעקב"
      }
      // Removed: age, gender (not in new schema)
    },
    required: ["patient_name", "category", "diagnosis"]
  }
};
```

## 🔧 **Key Changes**
1. **✅ Removed old fields:**
   - `age` (not in new patient schema)
   - `gender` (not in new patient schema)

2. **✅ Updated descriptions:**
   - Added bilingual descriptions (Hebrew/English)
   - Clarified patient name format
   - Enhanced field descriptions

3. **✅ Kept essential fields:**
   - All medical history fields remain
   - Patient identification by name
   - Same required fields

## ⚠️ **Safety Notes**
- **✅ SAFE:** Function name stays `"add_history"` (critical for detection)
- **✅ SAFE:** Parameter structure stays `Type.OBJECT` (critical for parsing)
- **✅ SAFE:** Only removing unused fields
- **✅ SAFE:** Required fields unchanged
- **❌ DON'T TOUCH:** Function calling API structure elsewhere

## 🔄 **Impact on Implementation**
The corresponding `addMedicalHistory` method will need minor updates to:
- Remove age/gender handling
- Use patient search by name to get patient info
- This will be handled in Phase 2 tasks

## 🧪 **Testing After Change**
1. **Verify function calling still works:**
   - Test medical history addition
   - Verify Gemini detects the function call
   - Check parameter parsing

2. **Check field handling:**
   - Verify age/gender are no longer expected
   - Test with all remaining fields
   - Check required field validation

## ✅ **Success Criteria**
- [ ] Function schema updated (removed age/gender)
- [ ] Bilingual descriptions added
- [ ] Function calling detection still works
- [ ] No breaking changes to API structure
- [ ] Required fields validation unchanged

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 1.4:** Update getDiagnosisFunction Schema

## 📝 **Notes**
- This is a simple cleanup task
- Age/gender will be retrieved from patient database if needed
- Patient identification remains by name for now
- Implementation updates will come in Phase 2
