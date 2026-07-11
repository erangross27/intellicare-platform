# Task 4.1: Test Israeli Functions

## 📋 **Task Overview**
**Phase:** 4 (Testing & Validation)  
**Time Estimate:** 20 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

Comprehensive testing of all agent functions with Israeli practice context to ensure proper functionality with the new schema and Hebrew language support.

## 🎯 **Objective**
Thoroughly test all agent functions to verify:
- Israeli patient schema works correctly
- Hebrew messages display properly
- Function calling detection still works
- All CRUD operations function properly
- Error handling works as expected

## 📁 **Testing Environment**
**Practice Context:** Israeli practice with Hebrew language  
**Required Fields:** `nationalId`, `healthFund`  
**Language:** Hebrew (he)  
**Country:** Israel  

## 🧪 **Test Cases**

### **1. Patient Creation Tests**

#### **Test 1.1: Valid Israeli Patient Creation**
```javascript
// Test data
const testParams = {
  firstName: "דוד",
  lastName: "כהן", 
  dateOfBirth: "1985-03-15",
  nationalId: "123456789",
  healthFund: "מכבי",
  email: "david.cohen@example.com",
  phone: "050-123-4567",
  street: "רחוב הרצל 10",
  city: "תל אביב",
  zipCode: "12345"
};

// Expected result
✅ Expected: Success message in Hebrew
✅ Expected: Patient created with correct fields
✅ Expected: Function calling detected correctly
```

#### **Test 1.2: Missing Required Fields**
```javascript
// Test data (missing nationalId and healthFund)
const testParams = {
  firstName: "שרה",
  lastName: "לוי",
  dateOfBirth: "1990-07-22"
};

// Expected result
✅ Expected: Hebrew error message listing missing fields
✅ Expected: "🆔 מה מספר תעודת הזהות?" 
✅ Expected: "🏥 איזה קופת חולים? (מכבי/כללית/מאוחדת/לאומית)"
```

#### **Test 1.3: Invalid Israeli ID**
```javascript
// Test data (invalid nationalId)
const testParams = {
  firstName: "משה",
  lastName: "אברהם",
  dateOfBirth: "1975-12-01",
  nationalId: "12345", // Invalid - too short
  healthFund: "כללית"
};

// Expected result
✅ Expected: Hebrew error message about invalid ID format
✅ Expected: "תעודת זהות לא תקינה - נדרשות 9 ספרות"
```

### **2. Patient Search Tests**

#### **Test 2.1: Search by Name**
```javascript
// Test search for existing patient
const searchParams = {
  searchTerm: "דוד כהן"
};

// Expected result
✅ Expected: Patient found with Hebrew display format
✅ Expected: "👤 שם: דוד כהן"
✅ Expected: "🆔 תעודת זהות: 123456789"
✅ Expected: "🏥 קופת חולים: מכבי"
```

#### **Test 2.2: Search by National ID**
```javascript
// Test search by nationalId
const searchParams = {
  searchTerm: "123456789"
};

// Expected result
✅ Expected: Patient found correctly
✅ Expected: Hebrew display format
✅ Expected: Age calculated from dateOfBirth
```

#### **Test 2.3: Patient Not Found**
```javascript
// Test search for non-existent patient
const searchParams = {
  searchTerm: "לא קיים"
};

// Expected result
✅ Expected: Hebrew "not found" message
✅ Expected: "לא נמצא מטופל עם המונח: לא קיים"
```

### **3. Medical History Tests**

#### **Test 3.1: Add Medical History**
```javascript
// Test adding medical history
const historyParams = {
  patient_name: "דוד כהן",
  category: "consultation_notes",
  diagnosis: "דלקת גרון",
  symptoms: "כאב גרון, חום",
  treatment: "אנטיביוטיקה",
  notes: "מעקב בעוד שבוע"
};

// Expected result
✅ Expected: Hebrew success message
✅ Expected: "✅ היסטוריה רפואית נוספה בהצלחה עבור דוד כהן"
✅ Expected: Patient found by new schema fields
```

#### **Test 3.2: Get Medical History**
```javascript
// Test retrieving medical history
const historyParams = {
  patient_name: "דוד כהן"
};

// Expected result
✅ Expected: Hebrew history display
✅ Expected: Patient info with new schema format
✅ Expected: Hebrew field labels (תאריך, קטגוריה, אבחנה)
```

### **4. Diagnosis Tests**

#### **Test 4.1: Diagnosis with Patient Context**
```javascript
// Test diagnosis with patient name
const diagnosisParams = {
  symptoms: "כאב ראש, בחילה, רגישות לאור",
  patient_name: "דוד כהן"
};

// Expected result
✅ Expected: Patient found and age retrieved
✅ Expected: Hebrew diagnosis response
✅ Expected: "🩺 אבחנה: [diagnosis]"
✅ Expected: "📋 המלצות: [recommendations]"
```

#### **Test 4.2: Diagnosis without Patient Context**
```javascript
// Test diagnosis with symptoms only
const diagnosisParams = {
  symptoms: "חום גבוה, שיעול יבש"
};

// Expected result
✅ Expected: Diagnosis works without patient context
✅ Expected: Hebrew response format
✅ Expected: No age/gender used (removed from schema)
```

### **5. Patient List Tests**

#### **Test 5.1: List All Patients**
```javascript
// Test listing patients
const listParams = {};

// Expected result
✅ Expected: Hebrew patient list header
✅ Expected: "📋 רשימת מטופלים (X):"
✅ Expected: Each patient shows: name, nationalId, age, healthFund
✅ Expected: Age calculated from dateOfBirth
```

### **6. Function Calling Tests**

#### **Test 6.1: Function Detection**
```javascript
// Test that Gemini detects function calls correctly
const testMessages = [
  "הוסף מטופל חדש בשם דוד כהן",
  "חפש מטופל עם תעודת זהות 123456789", 
  "הצג רשימת מטופלים",
  "הוסף היסטוריה רפואית לדוד כהן",
  "תן אבחנה לתסמינים: כאב ראש"
];

// Expected result for each
✅ Expected: Function call detected (not chat_only)
✅ Expected: Correct function name identified
✅ Expected: Parameters parsed correctly
✅ Expected: Hebrew responses
```

### **7. Error Handling Tests**

#### **Test 7.1: API Errors**
```javascript
// Test when backend API is down
// Expected result
✅ Expected: Hebrew error message
✅ Expected: "שגיאה בשרת: [error details]"
✅ Expected: Graceful error handling
```

#### **Test 7.2: Invalid Data**
```javascript
// Test with invalid date format
const testParams = {
  firstName: "יוסי",
  lastName: "דוד",
  dateOfBirth: "invalid-date",
  nationalId: "123456789",
  healthFund: "מכבי"
};

// Expected result
✅ Expected: Hebrew validation error
✅ Expected: "תאריך לידה לא תקין - נדרש פורמט YYYY-MM-DD"
```

## 🔧 **Testing Procedure**

### **Step 1: Setup Israeli Practice Context**
```javascript
const israeliClinicContext = {
  practice: {
    contact: {
      address: {
        country: "Israel"
      }
    }
  },
  authToken: "test-token",
  practiceSubdomain: "test-practice"
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
  "הוסף מטופל חדש", 
  "he", 
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
- [ ] Israeli patient creation works
- [ ] Required field validation (nationalId, healthFund)
- [ ] Hebrew error messages display correctly
- [ ] Patient search by name and ID works
- [ ] Patient list shows correct Israeli format

### **Medical Functions**
- [ ] Medical history addition works
- [ ] Medical history retrieval shows Hebrew format
- [ ] Diagnosis works with and without patient context
- [ ] Age calculation from dateOfBirth works

### **Function Calling**
- [ ] Gemini detects function calls correctly
- [ ] `mode: 'ANY'` still forces function calling
- [ ] Parameters parsed correctly
- [ ] No regression in function calling detection

### **Language & Formatting**
- [ ] All messages in Hebrew
- [ ] Date formatting correct for Israel
- [ ] Field labels in Hebrew
- [ ] Error messages helpful and clear

## ⚠️ **Critical Issues to Watch**

1. **Function Calling Regression:**
   - If Gemini stops detecting function calls → CRITICAL
   - If parameters not parsed → HIGH
   - If wrong function detected → MEDIUM

2. **Schema Issues:**
   - If old field names still referenced → HIGH
   - If new fields not saved → HIGH
   - If validation not working → MEDIUM

3. **Language Issues:**
   - If English messages in Hebrew practice → MEDIUM
   - If Hebrew text garbled → MEDIUM

## ✅ **Success Criteria**
- [ ] All test cases pass
- [ ] Function calling works correctly
- [ ] Hebrew messages display properly
- [ ] No critical errors or regressions
- [ ] Performance acceptable

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 4.2:** Test US Functions

## 📝 **Notes**
- Test thoroughly before proceeding to US tests
- Document any issues found
- Fix critical issues before moving on
- Verify function calling detection works perfectly
