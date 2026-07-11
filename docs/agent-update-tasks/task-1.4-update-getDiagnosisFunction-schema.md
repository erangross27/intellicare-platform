# Task 1.4: Update getDiagnosisFunction Schema

## 📋 **Task Overview**
**Phase:** 1 (Critical Functions)  
**Time Estimate:** 10 minutes  
**Risk Level:** LOW  
**Priority:** HIGH  

Update the `getDiagnosisFunction` schema to remove `age` and `gender` parameters and instead retrieve patient information from the database when needed.

## 🎯 **Objective**
Modernize the diagnosis function to:
- Remove `age` and `gender` parameters (not in new schema)
- Make patient name optional for context
- Get patient demographics from database if patient is specified
- Keep symptoms as the primary parameter

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Lines:** 228-253  
**Function:** `this.getDiagnosisFunction`

## 🔍 **Current Code (BEFORE)**
```javascript
this.getDiagnosisFunction = {
  name: "get_diagnosis",
  description: "Get AI diagnostic prediction for symptoms",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symptoms: {
        type: Type.STRING,
        description: "Patient symptoms description"
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
    required: ["symptoms"]
  }
};
```

## ✅ **New Code (AFTER)**
```javascript
this.getDiagnosisFunction = {
  name: "get_diagnosis", // ← Keep same name for function calling detection
  description: "Get AI diagnostic prediction for symptoms. Patient age/gender will be retrieved from database if patient_name is provided.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symptoms: {
        type: Type.STRING,
        description: "Patient symptoms description / תיאור התסמינים"
      },
      patient_name: {
        type: Type.STRING,
        description: "Patient name (optional) - if provided, age/gender will be retrieved from database / שם המטופל (אופציונלי)"
      }
      // Removed: age, gender (will get from database if patient_name provided)
    },
    required: ["symptoms"]
  }
};
```

## 🔧 **Key Changes**
1. **✅ Removed old fields:**
   - `age` (will be calculated from `dateOfBirth` in database)
   - `gender` (not in new patient schema)

2. **✅ Added optional patient context:**
   - `patient_name` parameter (optional)
   - If provided, patient info will be retrieved from database
   - If not provided, diagnosis works with symptoms only

3. **✅ Updated descriptions:**
   - Added bilingual descriptions (Hebrew/English)
   - Clarified how patient info is obtained
   - Enhanced field descriptions

4. **✅ Simplified requirements:**
   - Only `symptoms` required
   - Patient context is optional but helpful

## ⚠️ **Safety Notes**
- **✅ SAFE:** Function name stays `"get_diagnosis"` (critical for detection)
- **✅ SAFE:** Parameter structure stays `Type.OBJECT` (critical for parsing)
- **✅ SAFE:** Only removing unused fields and adding optional field
- **✅ SAFE:** Required fields simplified (only symptoms)
- **❌ DON'T TOUCH:** Function calling API structure elsewhere

## 🔄 **Impact on Implementation**
The corresponding `getDiagnosis` method will need updates to:
- Handle optional patient_name parameter
- Retrieve patient info from database if name provided
- Calculate age from dateOfBirth
- This will be handled in Task 1.5

## 🧪 **Testing After Change**
1. **Verify function calling still works:**
   - Test diagnosis with symptoms only
   - Test diagnosis with patient name
   - Verify Gemini detects the function call

2. **Check parameter parsing:**
   - Verify symptoms parameter works
   - Test optional patient_name parameter
   - Check required field validation

## ✅ **Success Criteria**
- [ ] Function schema updated (removed age/gender)
- [ ] Optional patient_name parameter added
- [ ] Bilingual descriptions added
- [ ] Function calling detection still works
- [ ] No breaking changes to API structure
- [ ] Only symptoms required

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 1.5:** Update getDiagnosis Implementation

## 📝 **Notes**
- This makes diagnosis more flexible
- Patient demographics will be retrieved automatically if patient is known
- Diagnosis can still work without patient context
- Implementation will handle database lookup in next task
