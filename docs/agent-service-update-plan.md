# 🎯 Agent Service Update Plan - Israel + US Multi-Country Support

## 📋 **PROJECT OVERVIEW**

Transform the IntelliCare Agent Service from Israeli-only to support both Israeli and US practices with country-specific patient schemas, while preserving the working Gemini function calling API structure.

### **Current State:**
- Agent service hardcoded for Israeli practices only
- Uses old patient schema (`name`, `age`, `gender`, `address`)
- Single country validation and error messages

### **Target State:**
- Support for Israeli and US practices
- Uses new country-specific patient schemas
- Dynamic field validation based on practice country
- Multi-language error messages (Hebrew for Israel, English for US)

### **Key Constraints:**
- ⚠️ **CRITICAL**: Preserve Gemini function calling API structure (took hours to get right)
- ⚠️ **CRITICAL**: Don't break `mode: 'ANY'` configuration that forces function calling
- ⚠️ **CRITICAL**: Maintain function call detection logic (lines 484-534)

---

## 🔧 **DETAILED TASK BREAKDOWN**

### **PHASE 1: CRITICAL FUNCTIONS (Patient Management)**

#### **Task 1.1: Update addPatientFunction Schema**
**File:** `backend/services/agentService.js` (lines 16-57)  
**Time:** 15 minutes | **Risk:** LOW | **Priority:** HIGH

**Current Schema (Israeli only):**
```javascript
this.addPatientFunction = {
  name: "add_patient",
  description: "Add a new patient to the medical system",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Patient name" },
      age: { type: Type.NUMBER, description: "Patient's age in years" },
      gender: { type: Type.STRING, description: "Patient's gender (male/female/זכר/נקבה)" },
      nationalId: { type: Type.STRING, description: "National ID number (תעודת זהות)" },
      email: { type: Type.STRING, description: "Email address" },
      phone: { type: Type.STRING, description: "Phone number" },
      address: { type: Type.STRING, description: "Home address" },
      healthFund: { type: Type.STRING, description: "Health fund (קופת חולים): מכבי, כללית, מאוחדת, לאומית" }
    },
    required: ["name", "age", "gender", "nationalId", "email", "phone", "address"]
  }
}
```

**New Schema (Israel + US):**
```javascript
this.addPatientFunction = {
  name: "add_patient", // ← Keep same name for function calling
  description: "Add a new patient. For Israeli practices: use nationalId+healthFund. For US practices: use socialSecurityNumber+insuranceProvider",
  parameters: {
    type: Type.OBJECT,
    properties: {
      // Base fields (all countries)
      firstName: { type: Type.STRING, description: "First name / שם פרטי" },
      lastName: { type: Type.STRING, description: "Last name / שם משפחה" },
      dateOfBirth: { type: Type.STRING, description: "Date of birth (YYYY-MM-DD) / תאריך לידה" },
      email: { type: Type.STRING, description: "Email address / כתובת מייל" },
      phone: { type: Type.STRING, description: "Phone number / מספר טלפון" },
      street: { type: Type.STRING, description: "Street address / כתובת רחוב" },
      city: { type: Type.STRING, description: "City / עיר" },
      zipCode: { type: Type.STRING, description: "ZIP/Postal code / מיקוד" },
      
      // Israeli-specific fields
      nationalId: { type: Type.STRING, description: "Israeli national ID (9 digits) - תעודת זהות - Required for Israeli practices" },
      healthFund: { type: Type.STRING, description: "Health fund: מכבי, כללית, מאוחדת, לאומית - Required for Israeli practices" },
      
      // US-specific fields
      socialSecurityNumber: { type: Type.STRING, description: "Social Security Number (XXX-XX-XXXX) - Required for US practices" },
      insuranceProvider: { type: Type.STRING, description: "Insurance provider name - Optional for US practices" }
    },
    required: ["firstName", "lastName", "dateOfBirth"] // Country-specific validation in implementation
  }
}
```

**Changes:**
- ✅ Replace `name` → `firstName` + `lastName`
- ✅ Replace `age` → `dateOfBirth`
- ✅ Remove `gender` (not in new schema)
- ✅ Replace `address` → `street` + `city` + `zipCode`
- ✅ Add US fields: `socialSecurityNumber`, `insuranceProvider`
- ✅ Update descriptions for both languages

#### **Task 1.2: Update addPatient Implementation**
**File:** `backend/services/agentService.js` (lines 575-631)  
**Time:** 20 minutes | **Risk:** LOW | **Priority:** HIGH

**Current Implementation Issues:**
- Hardcoded Israeli field validation
- Uses old schema field names
- Hebrew-only error messages

**New Implementation Requirements:**
```javascript
async addPatient(params, practiceContext) {
  try {
    console.log('👤 AGENT: Adding patient:', JSON.stringify(params, null, 2));

    // 1. Detect practice country
    const clinicCountry = practiceContext.practice?.contact?.address?.country || 'Israel';
    console.log(`🌍 AGENT: Practice country detected: ${clinicCountry}`);

    // 2. Country-specific validation
    const missingFields = this.validatePatientFields(params, clinicCountry);
    if (missingFields.length > 0) {
      return {
        success: false,
        needsMoreInfo: true,
        error: this.generateMissingFieldsMessage(missingFields, clinicCountry)
      };
    }

    // 3. Build country-specific patient data
    const patientData = this.buildPatientData(params, clinicCountry);

    // 4. API call (same as before)
    const response = await axios.post(`${this.intellicareApiBase}/patients`, patientData, {
      headers: this.getAuthHeaders(practiceContext),
      timeout: 30000
    });

    return {
      success: true,
      message: clinicCountry === 'Israel' 
        ? `✅ המטופל ${params.firstName} ${params.lastName} נוסף בהצלחה`
        : `✅ Patient ${params.firstName} ${params.lastName} added successfully`
    };
  } catch (error) {
    // Error handling...
  }
}
```

**Helper Functions to Add:**
```javascript
validatePatientFields(params, country) {
  const missingFields = [];
  
  // Base fields (all countries)
  if (!params.firstName) missingFields.push('firstName');
  if (!params.lastName) missingFields.push('lastName');
  if (!params.dateOfBirth) missingFields.push('dateOfBirth');
  
  // Country-specific fields
  if (country === 'Israel') {
    if (!params.nationalId) missingFields.push('nationalId');
    if (!params.healthFund) missingFields.push('healthFund');
  } else if (country === 'United States') {
    if (!params.socialSecurityNumber) missingFields.push('socialSecurityNumber');
  }
  
  return missingFields;
}

buildPatientData(params, country) {
  const baseData = {
    firstName: params.firstName.trim(),
    lastName: params.lastName.trim(),
    dateOfBirth: params.dateOfBirth,
    email: params.email?.toLowerCase().trim(),
    phone: params.phone?.trim(),
    street: params.street?.trim(),
    city: params.city?.trim(),
    zipCode: params.zipCode?.trim()
  };
  
  // Add country-specific fields
  if (country === 'Israel') {
    baseData.nationalId = params.nationalId.trim();
    baseData.healthFund = params.healthFund.trim();
  } else if (country === 'United States') {
    baseData.socialSecurityNumber = params.socialSecurityNumber.trim();
    if (params.insuranceProvider) {
      baseData.insuranceProvider = params.insuranceProvider.trim();
    }
  }
  
  return baseData;
}

generateMissingFieldsMessage(missingFields, country) {
  const messages = {
    'Israel': {
      firstName: '🏷 מה השם הפרטי?',
      lastName: '🏷 מה שם המשפחה?',
      dateOfBirth: '🎂 מה תאריך הלידה? (YYYY-MM-DD)',
      nationalId: '🆔 מה מספר תעודת הזהות?',
      healthFund: '🏥 איזה קופת חולים? (מכבי/כללית/מאוחדת/לאומית)',
      email: '📧 מה כתובת המייל?',
      phone: '📱 מה מספר הטלפון?'
    },
    'United States': {
      firstName: '🏷 What is the first name?',
      lastName: '🏷 What is the last name?',
      dateOfBirth: '🎂 What is the date of birth? (YYYY-MM-DD)',
      socialSecurityNumber: '🆔 What is the Social Security Number?',
      insuranceProvider: '🏥 What is the insurance provider?',
      email: '📧 What is the email address?',
      phone: '📱 What is the phone number?'
    }
  };
  
  const countryMessages = messages[country] || messages['Israel'];
  return missingFields.map(field => countryMessages[field] || `Missing: ${field}`).join('\n');
}
```

#### **Task 1.3: Update addHistoryFunction Schema**
**File:** `backend/services/agentService.js` (lines 74-104)  
**Time:** 10 minutes | **Risk:** LOW | **Priority:** HIGH

**Current Schema Issues:**
- Includes `age` and `gender` fields (not in new schema)
- Patient identification by name only

**New Schema:**
```javascript
this.addHistoryFunction = {
  name: "add_history",
  description: "Add medical history record for a patient",
  parameters: {
    type: Type.OBJECT,
    properties: {
      patient_name: { type: Type.STRING, description: "Patient full name (firstName lastName) / שם המטופל המלא" },
      category: { 
        type: Type.STRING, 
        description: "Medical category: lab_results, prescriptions, consultation_notes, imaging_reports, vaccination_records, referrals, medical_certificate, medical_procedures, discharge_summary" 
      },
      diagnosis: { type: Type.STRING, description: "Medical diagnosis / אבחנה רפואית" },
      symptoms: { type: Type.STRING, description: "Patient symptoms / תסמינים" },
      treatment: { type: Type.STRING, description: "Treatment provided / טיפול שניתן" },
      notes: { type: Type.STRING, description: "Additional notes / הערות נוספות" },
      followUpDate: { type: Type.STRING, description: "Follow-up date (YYYY-MM-DD) / תאריך מעקב" }
      // Removed: age, gender (not in new schema)
    },
    required: ["patient_name", "category", "diagnosis"]
  }
}
```

#### **Task 1.4: Update getDiagnosisFunction Schema**
**File:** `backend/services/agentService.js` (lines 228-253)  
**Time:** 10 minutes | **Risk:** LOW | **Priority:** HIGH

**Current Schema Issues:**
- Includes `age` and `gender` parameters
- Should get patient info from database instead

**New Schema:**
```javascript
this.getDiagnosisFunction = {
  name: "get_diagnosis",
  description: "Get AI diagnostic prediction for symptoms. Patient age/gender will be retrieved from database if patient_name is provided.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symptoms: { type: Type.STRING, description: "Patient symptoms description / תיאור התסמינים" },
      patient_name: { type: Type.STRING, description: "Patient name (optional) - if provided, age/gender will be retrieved from database / שם המטופל (אופציונלי)" }
      // Removed: age, gender (will get from database)
    },
    required: ["symptoms"]
  }
}
```

#### **Task 1.5: Update getDiagnosis Implementation**
**File:** `backend/services/agentService.js` (lines 1138-1208)  
**Time:** 15 minutes | **Risk:** LOW | **Priority:** HIGH

**Current Implementation Issues:**
- Uses age/gender from parameters
- Hardcoded field access

**New Implementation:**
```javascript
async getDiagnosis(params, practiceContext) {
  try {
    console.log('🩺 AGENT: Get diagnosis request:', JSON.stringify(params, null, 2));

    if (!params.symptoms) {
      return {
        success: false,
        error: 'Symptoms are required for diagnosis'
      };
    }

    // Prepare diagnosis request
    const diagnosisData = {
      symptoms: params.symptoms,
      language: 'he'
    };

    // If patient name provided, get age/gender from database
    if (params.patient_name) {
      try {
        const patientResponse = await axios.get(`${this.intellicareApiBase}/patients/search`, {
          params: { q: params.patient_name },
          headers: this.getAuthHeaders(practiceContext),
          timeout: 10000
        });

        if (patientResponse.data.success && patientResponse.data.data.length > 0) {
          const patient = patientResponse.data.data[0];
          
          // Calculate age from dateOfBirth
          if (patient.dateOfBirth) {
            const birthDate = new Date(patient.dateOfBirth);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            diagnosisData.age = age;
          }
          
          // Note: gender removed from new schema, diagnosis will work without it
          console.log(`👤 AGENT: Found patient for diagnosis: ${patient.firstName} ${patient.lastName}, age: ${diagnosisData.age}`);
        }
      } catch (error) {
        console.log('⚠️ AGENT: Could not retrieve patient info for diagnosis, proceeding with symptoms only');
      }
    }

    const response = await axios.post(`${this.intellicareApiBase}/diagnosis/predict`, diagnosisData, {
      headers: this.getAuthHeaders(practiceContext),
      timeout: 30000
    });

    if (response.data.success) {
      return {
        success: true,
        message: `🩺 אבחנה: ${response.data.data.diagnosis}\n📋 המלצות: ${response.data.data.recommendations?.join(', ') || 'אין המלצות נוספות'}`
      };
    } else {
      return {
        success: false,
        error: response.data.message || 'Diagnosis failed'
      };
    }
  } catch (error) {
    console.error('❌ AGENT: Diagnosis error:', error);
    return {
      success: false,
      error: `שגיאה באבחון: ${error.message}`
    };
  }
}
```

---

### **PHASE 2: MEDIUM FUNCTIONS (Patient Search & Display)**

#### **Task 2.1: Update getPatientFunction Schema**
**File:** `backend/services/agentService.js` (lines 59-72)  
**Time:** 10 minutes | **Risk:** LOW | **Priority:** MEDIUM

**New Schema:**
```javascript
this.getPatientFunction = {
  name: "get_patient",
  description: "Find a patient by name, ID, email, or phone number",
  parameters: {
    type: Type.OBJECT,
    properties: {
      searchTerm: { 
        type: Type.STRING, 
        description: "Search term: patient name, national ID, social security number, email, or phone / מונח חיפוש: שם, תעודת זהות, מייל או טלפון" 
      }
    },
    required: ["searchTerm"]
  }
}
```

#### **Task 2.2: Update getPatient Implementation**
**File:** `backend/services/agentService.js` (lines 633-694)  
**Time:** 15 minutes | **Risk:** LOW | **Priority:** MEDIUM

**New Implementation:**
```javascript
async getPatient(params, practiceContext) {
  try {
    console.log('🔍 AGENT: Getting patient:', params);

    if (!params.searchTerm) {
      return {
        success: false,
        error: 'Search term is required'
      };
    }

    const response = await axios.get(`${this.intellicareApiBase}/patients/search`, {
      params: { q: params.searchTerm },
      headers: this.getAuthHeaders(practiceContext),
      timeout: 10000
    });

    if (response.data.success && response.data.data.length > 0) {
      const patients = response.data.data;
      const clinicCountry = practiceContext.practice?.contact?.address?.country || 'Israel';
      
      if (patients.length === 1) {
        const patient = patients[0];
        const patientInfo = this.formatPatientInfo(patient, clinicCountry);
        
        return {
          success: true,
          message: patientInfo
        };
      } else {
        // Multiple patients found
        const patientList = patients.map((patient, index) => 
          `${index + 1}. ${this.formatPatientInfo(patient, clinicCountry, true)}`
        ).join('\n');
        
        return {
          success: true,
          message: clinicCountry === 'Israel' 
            ? `נמצאו ${patients.length} מטופלים:\n${patientList}`
            : `Found ${patients.length} patients:\n${patientList}`
        };
      }
    } else {
      return {
        success: false,
        message: clinicCountry === 'Israel'
          ? `לא נמצא מטופל עם המונח: ${params.searchTerm}`
          : `No patient found with search term: ${params.searchTerm}`
      };
    }
  } catch (error) {
    console.error('❌ AGENT: Get patient error:', error);
    return {
      success: false,
      message: `Failed to retrieve patient: ${error.message}`
    };
  }
}

formatPatientInfo(patient, country, brief = false) {
  const name = `${patient.firstName} ${patient.lastName}`;
  const age = patient.dateOfBirth ? this.calculateAge(patient.dateOfBirth) : 'Unknown';
  
  if (brief) {
    if (country === 'Israel') {
      return `${name} (ת.ז: ${patient.nationalId}, גיל: ${age})`;
    } else {
      return `${name} (SSN: ${patient.socialSecurityNumber}, Age: ${age})`;
    }
  }
  
  if (country === 'Israel') {
    return `👤 שם: ${name}
🆔 תעודת זהות: ${patient.nationalId}
🎂 גיל: ${age}
🏥 קופת חולים: ${patient.healthFund}
📧 מייל: ${patient.email || 'לא צוין'}
📱 טלפון: ${patient.phone || 'לא צוין'}
🏠 כתובת: ${patient.street || ''} ${patient.city || ''} ${patient.zipCode || ''}`.trim();
  } else {
    return `👤 Name: ${name}
🆔 SSN: ${patient.socialSecurityNumber}
🎂 Age: ${age}
🏥 Insurance: ${patient.insuranceProvider || 'Not specified'}
📧 Email: ${patient.email || 'Not specified'}
📱 Phone: ${patient.phone || 'Not specified'}
🏠 Address: ${patient.street || ''} ${patient.city || ''} ${patient.zipCode || ''}`.trim();
  }
}

calculateAge(dateOfBirth) {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1;
  }
  return age;
}
```

#### **Task 2.3: Update listPatients Implementation**
**File:** `backend/services/agentService.js` (lines 761-792)  
**Time:** 10 minutes | **Risk:** LOW | **Priority:** MEDIUM

**New Implementation:**
```javascript
async listPatients(params, practiceContext) {
  try {
    console.log('📋 AGENT: Listing patients');

    const response = await axios.get(`${this.intellicareApiBase}/patients`, {
      headers: this.getAuthHeaders(practiceContext),
      timeout: 10000
    });

    if (response.data.success && response.data.data.length > 0) {
      const patients = response.data.data;
      const clinicCountry = practiceContext.practice?.contact?.address?.country || 'Israel';
      
      const patientList = patients.map((patient, index) => {
        const name = `${patient.firstName} ${patient.lastName}`;
        const age = patient.dateOfBirth ? this.calculateAge(patient.dateOfBirth) : 'Unknown';
        
        if (clinicCountry === 'Israel') {
          return `${index + 1}. ${name} (ת.ז: ${patient.nationalId}, גיל: ${age})`;
        } else {
          return `${index + 1}. ${name} (SSN: ${patient.socialSecurityNumber}, Age: ${age})`;
        }
      }).join('\n');

      return {
        success: true,
        message: clinicCountry === 'Israel'
          ? `📋 רשימת מטופלים (${patients.length}):\n${patientList}`
          : `📋 Patient List (${patients.length}):\n${patientList}`
      };
    } else {
      return {
        success: true,
        message: clinicCountry === 'Israel' 
          ? '📋 אין מטופלים במערכת'
          : '📋 No patients in the system'
      };
    }
  } catch (error) {
    console.error('❌ AGENT: List patients error:', error);
    return {
      success: false,
      message: `Failed to list patients: ${error.message}`
    };
  }
}
```

#### **Task 2.4: Update getHistory Implementation**
**File:** `backend/services/agentService.js` (lines 994-1071)  
**Time:** 10 minutes | **Risk:** LOW | **Priority:** MEDIUM

**Changes Needed:**
- Update patient search to use new schema fields
- Update display format for patient information
- Keep medical history logic the same

#### **Task 2.5: Update updateHistory Implementation**
**File:** `backend/services/agentService.js` (lines 1073-1135)  
**Time:** 10 minutes | **Risk:** LOW | **Priority:** MEDIUM

**Changes Needed:**
- Update patient identification logic
- Ensure compatibility with new schema
- Keep update logic the same

---

### **PHASE 3: UTILITY FUNCTIONS (Error Messages & Helpers)**

#### **Task 3.1: Update Error Message Generation**
**Time:** 15 minutes | **Risk:** LOW | **Priority:** MEDIUM

**Add to agentService.js:**
```javascript
// Country detection helper
getClinicCountry(practiceContext) {
  return practiceContext.practice?.contact?.address?.country || 'Israel';
}

// Validation helpers
validateIsraeliId(id) {
  if (!id || id.length !== 9) return false;
  // Add Israeli ID checksum validation if needed
  return /^\d{9}$/.test(id);
}

validateUSSSN(ssn) {
  if (!ssn) return false;
  return /^\d{3}-\d{2}-\d{4}$/.test(ssn);
}

// Multi-language messages
getLocalizedMessage(key, country, params = {}) {
  const messages = {
    'Israel': {
      patientAdded: `✅ המטופל ${params.name} נוסף בהצלחה`,
      patientNotFound: `❌ לא נמצא מטופל עם המונח: ${params.searchTerm}`,
      missingFields: 'חסרים שדות נדרשים:',
      // ... more messages
    },
    'United States': {
      patientAdded: `✅ Patient ${params.name} added successfully`,
      patientNotFound: `❌ No patient found with search term: ${params.searchTerm}`,
      missingFields: 'Missing required fields:',
      // ... more messages
    }
  };
  
  return messages[country]?.[key] || messages['Israel'][key] || key;
}
```

#### **Task 3.2: Add Country Detection Helper**
**Time:** 10 minutes | **Risk:** LOW | **Priority:** MEDIUM

#### **Task 3.3: Update Field Validation Helpers**
**Time:** 15 minutes | **Risk:** LOW | **Priority:** MEDIUM

---

### **PHASE 4: TESTING & VALIDATION**

#### **Task 4.1: Test Israeli Practice Functions**
**Time:** 20 minutes | **Risk:** MEDIUM | **Priority:** HIGH

**Test Cases:**
- Create Israeli patient with nationalId + healthFund
- Search for Israeli patient
- Add medical history
- Get diagnosis
- List patients

#### **Task 4.2: Test US Practice Functions**
**Time:** 20 minutes | **Risk:** MEDIUM | **Priority:** HIGH

**Test Cases:**
- Create US patient with socialSecurityNumber + insuranceProvider
- Search for US patient
- Add medical history
- Get diagnosis
- List patients

#### **Task 4.3: Test Function Calling API**
**Time:** 15 minutes | **Risk:** HIGH | **Priority:** CRITICAL

**Critical Tests:**
- Verify Gemini still detects function calls correctly
- Test `mode: 'ANY'` still forces function calling
- Verify parameter parsing works with new schema
- Test function call detection logic (lines 484-534)

---

## 📊 **EXECUTION SUMMARY**

| Phase | Tasks | Total Time | Risk Level | Priority |
|-------|-------|------------|------------|----------|
| Phase 1 | 5 tasks | 70 minutes | LOW | HIGH |
| Phase 2 | 5 tasks | 55 minutes | LOW | MEDIUM |
| Phase 3 | 3 tasks | 40 minutes | LOW | MEDIUM |
| Phase 4 | 3 tasks | 55 minutes | MEDIUM-HIGH | HIGH |
| **TOTAL** | **16 tasks** | **220 minutes** | **LOW-MEDIUM** | - |

## 🎯 **EXECUTION ORDER**

1. **Phase 1** (Critical functions) - Core patient management
2. **Phase 3** (Helpers) - Support functions
3. **Phase 2** (Search/Display) - Enhanced functionality
4. **Phase 4** (Testing) - Validation and safety

## ⚠️ **CRITICAL SAFETY RULES**

### **DO NOT TOUCH:**
- Function calling API structure (lines 456-482)
- Function call detection logic (lines 484-534)
- `mode: 'ANY'` configuration
- Function names (keep identical for detection)

### **SAFE TO MODIFY:**
- Function parameter schemas
- Function implementation methods
- Validation logic
- Error messages
- Helper functions

### **ROLLBACK PLAN:**
- Git commit after each phase
- Test function calling after each critical change
- Have backup of working version

---

## 🚀 **READY TO START**

**Next Step:** Begin with Phase 1, Task 1.1 - Update addPatientFunction Schema

**Command:** `git commit -m "Pre-agent-update checkpoint"` before starting
