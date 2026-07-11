# Task 2.1: Update getPatientFunction Schema

## 📋 **Task Overview**
**Phase:** 2 (Search & Display Functions)  
**Time Estimate:** 10 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

Update the `getPatientFunction` schema to support searching by multiple field types that work with the new patient schema.

## 🎯 **Objective**
Enhance the patient search function to:
- Support searching by new schema fields
- Allow multiple search methods (name, ID, email, phone)
- Provide clear bilingual descriptions
- Work with both Israeli and US identification fields

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Lines:** 59-72  
**Function:** `this.getPatientFunction`

## 🔍 **Current Code (BEFORE)**
```javascript
this.getPatientFunction = {
  name: "get_patient",
  description: "Find a patient by name or ID",
  parameters: {
    type: Type.OBJECT,
    properties: {
      searchTerm: {
        type: Type.STRING,
        description: "Patient name or ID to search for"
      }
    },
    required: ["searchTerm"]
  }
};
```

## ✅ **New Code (AFTER)**
```javascript
this.getPatientFunction = {
  name: "get_patient", // ← Keep same name for function calling detection
  description: "Find a patient by name, ID, email, or phone number. Works with both Israeli and US patient records.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      searchTerm: {
        type: Type.STRING,
        description: "Search term: patient name (firstName lastName), national ID, social security number, email, or phone / מונח חיפוש: שם מטופל, תעודת זהות, מספר ביטוח לאומי, מייל או טלפון"
      }
    },
    required: ["searchTerm"]
  }
};
```

## 🔧 **Key Changes**
1. **✅ Enhanced description:**
   - Clarified multiple search methods
   - Added support for both Israeli and US records
   - Mentioned all searchable fields

2. **✅ Updated parameter description:**
   - Listed all possible search terms
   - Added bilingual descriptions (Hebrew/English)
   - Clarified name format (firstName lastName)
   - Included both nationalId and socialSecurityNumber

3. **✅ Maintained simplicity:**
   - Single searchTerm parameter (flexible)
   - Same required fields
   - Same parameter structure

## ⚠️ **Safety Notes**
- **✅ SAFE:** Function name stays `"get_patient"` (critical for detection)
- **✅ SAFE:** Parameter structure stays `Type.OBJECT` (critical for parsing)
- **✅ SAFE:** Only updating descriptions, not structure
- **✅ SAFE:** Single parameter approach maintained
- **❌ DON'T TOUCH:** Function calling API structure elsewhere

## 🔄 **Impact on Implementation**
The corresponding `getPatient` method will need updates to:
- Search by new schema fields (firstName, lastName)
- Handle both Israeli and US identification fields
- Format results with new schema fields
- This will be handled in Task 2.2

## 🧪 **Testing After Change**
1. **Verify function calling still works:**
   - Test patient search with various terms
   - Verify Gemini detects the function call
   - Check parameter parsing

2. **Check search flexibility:**
   - Test with name searches
   - Test with ID searches
   - Test with email/phone searches

## ✅ **Success Criteria**
- [ ] Function schema updated with enhanced descriptions
- [ ] Bilingual descriptions added
- [ ] Multiple search methods documented
- [ ] Function calling detection still works
- [ ] No breaking changes to API structure
- [ ] Search term parameter unchanged

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 2.2:** Update getPatient Implementation

## 📝 **Notes**
- This is a documentation/description update
- Implementation will handle the actual search logic
- Maintains backward compatibility
- Prepares for multi-field search capability
