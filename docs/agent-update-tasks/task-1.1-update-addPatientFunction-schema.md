# Task 1.1: Update addPatientFunction Schema

## 📋 **Task Overview**
**Phase:** 1 (Critical Functions)  
**Time Estimate:** 15 minutes  
**Risk Level:** LOW  
**Priority:** HIGH  

Update the `addPatientFunction` schema to support both Israeli and US practices with new patient schema fields.

## 🎯 **Objective**
Replace the old Israeli-only schema with a new schema that supports:
- **Israeli practices:** `nationalId` + `healthFund` + new base fields
- **US practices:** `socialSecurityNumber` + `insuranceProvider` + new base fields
- **New base fields:** `firstName`, `lastName`, `dateOfBirth` instead of `name`, `age`, `gender`

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Lines:** 16-57  
**Function:** `this.addPatientFunction`

## 🔍 **Current Code (BEFORE)**
```javascript
this.addPatientFunction = {
  name: "add_patient",
  description: "Add a new patient to the medical system",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "Patient's full name"
      },
      age: {
        type: Type.NUMBER,
        description: "Patient's age in years"
      },
      gender: {
        type: Type.STRING,
        description: "Patient's gender (male/female/זכר/נקבה)"
      },
      nationalId: {
        type: Type.STRING,
        description: "National ID number (תעודת זהות)"
      },
      email: {
        type: Type.STRING,
        description: "Email address"
      },
      phone: {
        type: Type.STRING,
        description: "Phone number"
      },
      address: {
        type: Type.STRING,
        description: "Home address"
      },
      healthFund: {
        type: Type.STRING,
        description: "Health fund (קופת חולים): מכבי, כללית, מאוחדת, לאומית"
      }
    },
    required: ["name", "age", "gender", "nationalId", "email", "phone", "address"]
  }
};
```

## ✅ **New Code (AFTER)**
```javascript
this.addPatientFunction = {
  name: "add_patient", // ← Keep same name for function calling detection
  description: "Add a new patient. For Israeli practices: use nationalId+healthFund. For US practices: use socialSecurityNumber+insuranceProvider",
  parameters: {
    type: Type.OBJECT,
    properties: {
      // Base fields (all countries)
      firstName: {
        type: Type.STRING,
        description: "First name / שם פרטי"
      },
      lastName: {
        type: Type.STRING,
        description: "Last name / שם משפחה"
      },
      dateOfBirth: {
        type: Type.STRING,
        description: "Date of birth (YYYY-MM-DD) / תאריך לידה"
      },
      email: {
        type: Type.STRING,
        description: "Email address / כתובת מייל"
      },
      phone: {
        type: Type.STRING,
        description: "Phone number / מספר טלפון"
      },
      street: {
        type: Type.STRING,
        description: "Street address / כתובת רחוב"
      },
      city: {
        type: Type.STRING,
        description: "City / עיר"
      },
      zipCode: {
        type: Type.STRING,
        description: "ZIP/Postal code / מיקוד"
      },
      
      // Israeli-specific fields
      nationalId: {
        type: Type.STRING,
        description: "Israeli national ID (9 digits) - תעודת זהות - Required for Israeli practices"
      },
      healthFund: {
        type: Type.STRING,
        description: "Health fund: מכבי, כללית, מאוחדת, לאומית - Required for Israeli practices"
      },
      
      // US-specific fields
      socialSecurityNumber: {
        type: Type.STRING,
        description: "Social Security Number (XXX-XX-XXXX) - Required for US practices"
      },
      insuranceProvider: {
        type: Type.STRING,
        description: "Insurance provider name - Optional for US practices"
      }
    },
    required: ["firstName", "lastName", "dateOfBirth"] // Country-specific validation in implementation
  }
};
```

## 🔧 **Key Changes**
1. **✅ Replace old fields:**
   - `name` → `firstName` + `lastName`
   - `age` → `dateOfBirth`
   - `address` → `street` + `city` + `zipCode`
   - **Remove:** `gender` (not in new schema)

2. **✅ Add US fields:**
   - `socialSecurityNumber` (required for US)
   - `insuranceProvider` (optional for US)

3. **✅ Update descriptions:**
   - Bilingual descriptions (Hebrew/English)
   - Clear country-specific requirements

4. **✅ Minimal required fields:**
   - Only base fields in `required` array
   - Country-specific validation moved to implementation

## ⚠️ **Safety Notes**
- **✅ SAFE:** Function name stays `"add_patient"` (critical for detection)
- **✅ SAFE:** Parameter structure stays `Type.OBJECT` (critical for parsing)
- **✅ SAFE:** Only changing field names and descriptions
- **❌ DON'T TOUCH:** Function calling API structure elsewhere

## 🧪 **Testing After Change**
1. **Verify function calling still works:**
   - Test with Israeli practice context
   - Test with US practice context
   - Verify Gemini detects the function call

2. **Check parameter parsing:**
   - Verify new fields are passed correctly
   - Check that old fields are no longer expected

## ✅ **Success Criteria**
- [ ] Function schema updated with new fields
- [ ] Bilingual descriptions added
- [ ] Country-specific fields included
- [ ] Function calling detection still works
- [ ] No breaking changes to API structure

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 1.2:** Update addPatient Implementation

## 📝 **Notes**
- This change only updates the schema definition
- The actual validation logic will be updated in Task 1.2
- Keep the function name identical to preserve Gemini detection
- Test function calling after this change before proceeding
