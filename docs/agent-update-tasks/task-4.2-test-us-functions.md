# Task 4.2: Test US Functions

## 📋 **Task Overview**
**Phase:** 4 (Testing & Validation)  
**Time Estimate:** 20 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

Comprehensive testing of all agent functions with US practice context to ensure proper functionality with the new schema and English language support.

## 🎯 **Objective**
Thoroughly test all agent functions to verify:
- US patient schema works correctly
- English messages display properly
- Function calling detection still works
- All CRUD operations function properly
- Country-specific validation works

## 📁 **Testing Environment**
**Practice Context:** US practice with English language  
**Required Fields:** `socialSecurityNumber`  
**Optional Fields:** `insuranceProvider`  
**Language:** English (en)  
**Country:** United States  

## 🧪 **Test Cases**

### **1. Patient Creation Tests**

#### **Test 1.1: Valid US Patient Creation**
```javascript
// Test data
const testParams = {
  firstName: "John",
  lastName: "Smith", 
  dateOfBirth: "1985-03-15",
  socialSecurityNumber: "123-45-6789",
  insuranceProvider: "Blue Cross Blue Shield",
  email: "john.smith@example.com",
  phone: "555-123-4567",
  street: "123 Main Street",
  city: "New York",
  zipCode: "10001"
};

// Expected result
✅ Expected: Success message in English
✅ Expected: Patient created with correct fields
✅ Expected: Function calling detected correctly
```

#### **Test 1.2: Missing Required Fields**
```javascript
// Test data (missing socialSecurityNumber)
const testParams = {
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-07-22"
};

// Expected result
✅ Expected: English error message listing missing fields
✅ Expected: "🆔 What is the Social Security Number? (XXX-XX-XXXX)"
✅ Expected: insuranceProvider should be optional
```

#### **Test 1.3: Invalid SSN Format**
```javascript
// Test data (invalid socialSecurityNumber)
const testParams = {
  firstName: "Bob",
  lastName: "Johnson",
  dateOfBirth: "1975-12-01",
  socialSecurityNumber: "12345", // Invalid format
  insuranceProvider: "Aetna"
};

// Expected result
✅ Expected: English error message about invalid SSN format
✅ Expected: "Invalid Social Security Number - required format XXX-XX-XXXX"
```

#### **Test 1.4: Valid SSN Formats**
```javascript
// Test various valid SSN formats
const validSSNs = [
  "123-45-6789",  // Standard format
  "987-65-4321"   // Another valid SSN
];

// Expected result
✅ Expected: All valid SSNs accepted
✅ Expected: Proper formatting maintained
```

### **2. Patient Search Tests**

#### **Test 2.1: Search by Name**
```javascript
// Test search for existing patient
const searchParams = {
  searchTerm: "John Smith"
};

// Expected result
✅ Expected: Patient found with English display format
✅ Expected: "👤 Name: John Smith"
✅ Expected: "🆔 SSN: 123-45-6789"
✅ Expected: "🏥 Insurance: Blue Cross Blue Shield"
```

#### **Test 2.2: Search by SSN**
```javascript
// Test search by socialSecurityNumber
const searchParams = {
  searchTerm: "123-45-6789"
};

// Expected result
✅ Expected: Patient found correctly
✅ Expected: English display format
✅ Expected: Age calculated from dateOfBirth
```

#### **Test 2.3: Patient Not Found**
```javascript
// Test search for non-existent patient
const searchParams = {
  searchTerm: "Nonexistent Patient"
};

// Expected result
✅ Expected: English "not found" message
✅ Expected: "No patient found with search term: Nonexistent Patient"
```

### **3. Medical History Tests**

#### **Test 3.1: Add Medical History**
```javascript
// Test adding medical history
const historyParams = {
  patient_name: "John Smith",
  category: "consultation_notes",
  diagnosis: "Hypertension",
  symptoms: "High blood pressure, headaches",
  treatment: "ACE inhibitor medication",
  notes: "Follow up in 2 weeks"
};

// Expected result
✅ Expected: English success message
✅ Expected: "✅ Medical history added successfully for John Smith"
✅ Expected: Patient found by new schema fields
```

#### **Test 3.2: Get Medical History**
```javascript
// Test retrieving medical history
const historyParams = {
  patient_name: "John Smith"
};

// Expected result
✅ Expected: English history display
✅ Expected: Patient info with new schema format
✅ Expected: English field labels (Date, Category, Diagnosis)
```

### **4. Diagnosis Tests**

#### **Test 4.1: Diagnosis with Patient Context**
```javascript
// Test diagnosis with patient name
const diagnosisParams = {
  symptoms: "chest pain, shortness of breath, fatigue",
  patient_name: "John Smith"
};

// Expected result
✅ Expected: Patient found and age retrieved
✅ Expected: English diagnosis response
✅ Expected: "🩺 Diagnosis: [diagnosis]"
✅ Expected: "📋 Recommendations: [recommendations]"
```

#### **Test 4.2: Diagnosis without Patient Context**
```javascript
// Test diagnosis with symptoms only
const diagnosisParams = {
  symptoms: "fever, cough, sore throat"
};

// Expected result
✅ Expected: Diagnosis works without patient context
✅ Expected: English response format
✅ Expected: No age/gender used (removed from schema)
```

### **5. Patient List Tests**

#### **Test 5.1: List All Patients**
```javascript
// Test listing patients
const listParams = {};

// Expected result
✅ Expected: English patient list header
✅ Expected: "📋 Patient List (X):"
✅ Expected: Each patient shows: name, SSN, age, insurance
✅ Expected: Age calculated from dateOfBirth
```

#### **Test 5.2: Empty Patient List**
```javascript
// Test with no patients in system
const listParams = {};

// Expected result
✅ Expected: English empty state message
✅ Expected: "📋 No patients in the system"
```

### **6. Insurance Provider Tests**

#### **Test 6.1: With Insurance Provider**
```javascript
// Test patient with insurance
const testParams = {
  firstName: "Alice",
  lastName: "Wilson",
  dateOfBirth: "1988-09-12",
  socialSecurityNumber: "987-65-4321",
  insuranceProvider: "United Healthcare"
};

// Expected result
✅ Expected: Insurance provider saved and displayed
✅ Expected: "🏥 Insurance: United Healthcare"
```

#### **Test 6.2: Without Insurance Provider**
```javascript
// Test patient without insurance (optional field)
const testParams = {
  firstName: "Charlie",
  lastName: "Brown",
  dateOfBirth: "1992-04-08",
  socialSecurityNumber: "456-78-9012"
  // No insuranceProvider
};

// Expected result
✅ Expected: Patient created successfully
✅ Expected: "🏥 Insurance: Not specified" in display
```

### **7. Function Calling Tests**

#### **Test 7.1: Function Detection**
```javascript
// Test that Gemini detects function calls correctly
const testMessages = [
  "Add a new patient named John Smith",
  "Search for patient with SSN 123-45-6789", 
  "Show me the patient list",
  "Add medical history for John Smith",
  "Diagnose symptoms: headache and fever"
];

// Expected result for each
✅ Expected: Function call detected (not chat_only)
✅ Expected: Correct function name identified
✅ Expected: Parameters parsed correctly
✅ Expected: English responses
```

### **8. Validation Tests**

#### **Test 8.1: Phone Number Validation**
```javascript
// Test US phone number formats
const validPhones = [
  "555-123-4567",
  "(555) 123-4567",
  "5551234567"
];

// Expected result
✅ Expected: All formats accepted and normalized
✅ Expected: Display format: (555) 123-4567
```

#### **Test 8.2: ZIP Code Validation**
```javascript
// Test US ZIP code formats
const validZips = [
  "12345",        // 5-digit
  "12345-6789"    // ZIP+4
];

// Expected result
✅ Expected: Both formats accepted
✅ Expected: Proper formatting maintained
```

### **9. Error Handling Tests**

#### **Test 9.1: API Errors**
```javascript
// Test when backend API is down
// Expected result
✅ Expected: English error message
✅ Expected: "Server error: [error details]"
✅ Expected: Graceful error handling
```

#### **Test 9.2: Invalid Data**
```javascript
// Test with invalid date format
const testParams = {
  firstName: "Test",
  lastName: "User",
  dateOfBirth: "invalid-date",
  socialSecurityNumber: "123-45-6789"
};

// Expected result
✅ Expected: English validation error
✅ Expected: "Invalid date of birth - required format YYYY-MM-DD"
```

## 🔧 **Testing Procedure**

### **Step 1: Setup US Practice Context**
```javascript
const usClinicContext = {
  practice: {
    contact: {
      address: {
        country: "United States"
      }
    }
  },
  authToken: "test-token",
  practiceSubdomain: "test-us-practice"
};
```

### **Step 2: Test Each Function**
1. **addPatient** - Test all scenarios above
2. **getPatient** - Test search variations
3. **listPatients** - Test list display
4. **addHistory** - Test history addition
5. **getHistory** - Test history retrieval
6. **getDiagnosis** - Test diagnosis functionality

### **Step 3: Verify Function Calling**
```javascript
// Test that Gemini function calling still works
const response = await agent.detectIntentWithGemini(
  "Add a new patient", 
  "en", 
  [], 
  null
);

// Verify
✅ response.action should NOT be 'chat_only'
✅ response.action should be 'add_patient'
✅ response.parameters should be parsed correctly
```

## 📊 **Test Results Checklist**

### **Patient Management**
- [ ] US patient creation works
- [ ] Required field validation (socialSecurityNumber)
- [ ] Optional field handling (insuranceProvider)
- [ ] English error messages display correctly
- [ ] Patient search by name and SSN works
- [ ] Patient list shows correct US format

### **Medical Functions**
- [ ] Medical history addition works
- [ ] Medical history retrieval shows English format
- [ ] Diagnosis works with and without patient context
- [ ] Age calculation from dateOfBirth works

### **Function Calling**
- [ ] Gemini detects function calls correctly
- [ ] `mode: 'ANY'` still forces function calling
- [ ] Parameters parsed correctly
- [ ] No regression in function calling detection

### **US-Specific Features**
- [ ] SSN validation works correctly
- [ ] Insurance provider handling (optional)
- [ ] US phone number formatting
- [ ] US ZIP code validation
- [ ] English language responses

## ⚠️ **Critical Issues to Watch**

1. **Function Calling Regression:**
   - If Gemini stops detecting function calls → CRITICAL
   - If parameters not parsed → HIGH
   - If wrong function detected → MEDIUM

2. **Schema Issues:**
   - If SSN not saved correctly → HIGH
   - If insurance provider not handled → MEDIUM
   - If validation not working → MEDIUM

3. **Language Issues:**
   - If Hebrew messages in US practice → MEDIUM
   - If English formatting incorrect → LOW

## ✅ **Success Criteria**
- [ ] All test cases pass
- [ ] Function calling works correctly
- [ ] English messages display properly
- [ ] US-specific validation works
- [ ] No critical errors or regressions
- [ ] Performance acceptable

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 4.3:** Test Function Calling API

## 📝 **Notes**
- Test thoroughly to ensure US functionality works
- Compare with Israeli tests to ensure consistency
- Document any differences or issues
- Verify both countries work independently
