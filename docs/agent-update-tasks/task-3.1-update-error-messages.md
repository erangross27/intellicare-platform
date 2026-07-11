# Task 3.1: Update Error Messages

## 📋 **Task Overview**
**Phase:** 3 (Utility Functions)  
**Time Estimate:** 15 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

Consolidate and enhance error message generation to support both Israeli and US practices with comprehensive localized messages.

## 🎯 **Objective**
Create a comprehensive error message system that:
- Provides localized messages for both Hebrew and English
- Covers all agent functions and scenarios
- Uses consistent formatting and tone
- Supports dynamic parameter substitution

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Location:** Add new methods to the class  

## ✅ **Enhanced Error Message System**

### **1. Comprehensive Message Dictionary**
```javascript
getLocalizedMessages() {
  return {
    'Israel': {
      // Patient Management
      patientAdded: `✅ המטופל {name} נוסף בהצלחה`,
      patientNotFound: `❌ לא נמצא מטופל עם המונח: {searchTerm}`,
      addPatientError: `❌ שגיאה בהוספת מטופל: {error}`,
      searchTermRequired: 'נדרש מונח חיפוש',
      patientNameRequired: 'נדרש שם מטופל',
      
      // Field Validation
      missingFields: 'חסרים שדות נדרשים:',
      firstName: '🏷 מה השם הפרטי?',
      lastName: '🏷 מה שם המשפחה?',
      dateOfBirth: '🎂 מה תאריך הלידה? (YYYY-MM-DD)',
      nationalId: '🆔 מה מספר תעודת הזהות?',
      healthFund: '🏥 איזה קופת חולים? (מכבי/כללית/מאוחדת/לאומית)',
      email: '📧 מה כתובת המייל?',
      phone: '📱 מה מספר הטלפון?',
      street: '🏠 מה כתובת הרחוב?',
      city: '🏙 באיזה עיר?',
      zipCode: '📮 מה המיקוד?',
      
      // Medical History
      historyAdded: `✅ היסטוריה רפואית נוספה בהצלחה עבור {patientName}`,
      historyUpdated: `✅ היסטוריה רפואית עודכנה בהצלחה עבור {patientName}`,
      historyError: `❌ שגיאה בהיסטוריה רפואית: {error}`,
      noHistory: `📋 אין היסטוריה רפואית עבור {patientName}`,
      
      // Diagnosis
      diagnosisResult: `🩺 אבחנה: {diagnosis}\n📋 המלצות: {recommendations}`,
      diagnosisError: `❌ שגיאה באבחון: {error}`,
      symptomsRequired: 'נדרשים תסמינים לאבחון',
      
      // Patient Lists
      patientList: `📋 רשימת מטופלים ({count}):`,
      noPatients: '📋 אין מטופלים במערכת',
      multiplePatients: `נמצאו {count} מטופלים:`,
      
      // General Errors
      apiError: `שגיאה בשרת: {error}`,
      networkError: 'שגיאת רשת - אנא נסה שוב',
      unknownError: 'אירעה שגיאה לא ידועה',
      
      // Field Names for Errors
      fieldNames: {
        patient_name: 'שם המטופל',
        entry_id: 'מזהה הרשומה',
        category: 'קטגוריה',
        diagnosis: 'אבחנה',
        symptoms: 'תסמינים'
      }
    },
    
    'United States': {
      // Patient Management
      patientAdded: `✅ Patient {name} added successfully`,
      patientNotFound: `❌ No patient found with search term: {searchTerm}`,
      addPatientError: `❌ Error adding patient: {error}`,
      searchTermRequired: 'Search term is required',
      patientNameRequired: 'Patient name is required',
      
      // Field Validation
      missingFields: 'Missing required fields:',
      firstName: '🏷 What is the first name?',
      lastName: '🏷 What is the last name?',
      dateOfBirth: '🎂 What is the date of birth? (YYYY-MM-DD)',
      socialSecurityNumber: '🆔 What is the Social Security Number? (XXX-XX-XXXX)',
      insuranceProvider: '🏥 What is the insurance provider?',
      email: '📧 What is the email address?',
      phone: '📱 What is the phone number?',
      street: '🏠 What is the street address?',
      city: '🏙 What city?',
      zipCode: '📮 What is the ZIP code?',
      
      // Medical History
      historyAdded: `✅ Medical history added successfully for {patientName}`,
      historyUpdated: `✅ Medical history updated successfully for {patientName}`,
      historyError: `❌ Medical history error: {error}`,
      noHistory: `📋 No medical history found for {patientName}`,
      
      // Diagnosis
      diagnosisResult: `🩺 Diagnosis: {diagnosis}\n📋 Recommendations: {recommendations}`,
      diagnosisError: `❌ Diagnosis error: {error}`,
      symptomsRequired: 'Symptoms are required for diagnosis',
      
      // Patient Lists
      patientList: `📋 Patient List ({count}):`,
      noPatients: '📋 No patients in the system',
      multiplePatients: `Found {count} patients:`,
      
      // General Errors
      apiError: `Server error: {error}`,
      networkError: 'Network error - please try again',
      unknownError: 'An unknown error occurred',
      
      // Field Names for Errors
      fieldNames: {
        patient_name: 'patient name',
        entry_id: 'entry ID',
        category: 'category',
        diagnosis: 'diagnosis',
        symptoms: 'symptoms'
      }
    }
  };
}
```

### **2. Enhanced Message Formatter**
```javascript
getLocalizedMessage(key, country, params = {}) {
  const messages = this.getLocalizedMessages();
  const countryMessages = messages[country] || messages['Israel'];
  let message = countryMessages[key] || key;
  
  // Replace parameters in message
  Object.keys(params).forEach(param => {
    const placeholder = `{${param}}`;
    message = message.replace(new RegExp(placeholder, 'g'), params[param]);
  });
  
  return message;
}
```

### **3. Enhanced Missing Fields Generator**
```javascript
generateMissingFieldsMessage(missingFields, country) {
  const messages = this.getLocalizedMessages();
  const countryMessages = messages[country] || messages['Israel'];
  
  const fieldMessages = missingFields.map(field => 
    countryMessages[field] || `Missing: ${field}`
  );
  
  return fieldMessages.join('\n');
}
```

### **4. Field Name Translator**
```javascript
translateFieldNames(fields, country) {
  const messages = this.getLocalizedMessages();
  const countryMessages = messages[country] || messages['Israel'];
  const fieldNames = countryMessages.fieldNames || {};
  
  return fields.map(field => fieldNames[field] || field);
}
```

### **5. Error Response Builder**
```javascript
buildErrorResponse(errorKey, country, params = {}) {
  return {
    success: false,
    error: this.getLocalizedMessage(errorKey, country, params)
  };
}

buildSuccessResponse(messageKey, country, params = {}) {
  return {
    success: true,
    message: this.getLocalizedMessage(messageKey, country, params)
  };
}
```

## 🔧 **Key Features**
1. **✅ Comprehensive Coverage:**
   - All agent functions covered
   - Both success and error messages
   - Field validation messages
   - General error handling

2. **✅ Dynamic Parameters:**
   - Template-based messages with {parameter} placeholders
   - Automatic parameter substitution
   - Flexible message formatting

3. **✅ Consistent Formatting:**
   - Emoji icons for visual clarity
   - Consistent tone and style
   - Professional medical language

4. **✅ Easy Maintenance:**
   - Centralized message dictionary
   - Easy to add new messages
   - Clear organization by function

## ⚠️ **Safety Notes**
- **✅ SAFE:** Only adding new utility methods
- **✅ SAFE:** No changes to existing function calling logic
- **✅ SAFE:** Backward compatible with existing code
- **❌ DON'T TOUCH:** Function calling API structure

## 🔄 **Usage Examples**
```javascript
// Success message with parameters
return this.buildSuccessResponse('patientAdded', country, { 
  name: `${patient.firstName} ${patient.lastName}` 
});

// Error message with parameters
return this.buildErrorResponse('patientNotFound', country, { 
  searchTerm: params.searchTerm 
});

// Missing fields message
const missingFields = ['firstName', 'lastName'];
return {
  success: false,
  needsMoreInfo: true,
  error: this.generateMissingFieldsMessage(missingFields, country)
};
```

## 🧪 **Testing After Change**
1. **Test Israeli messages:**
   - Verify Hebrew messages display correctly
   - Check parameter substitution
   - Test all message types

2. **Test US messages:**
   - Verify English messages display correctly
   - Check parameter substitution
   - Test all message types

3. **Test edge cases:**
   - Missing parameters
   - Unknown message keys
   - Invalid country codes

## ✅ **Success Criteria**
- [ ] Comprehensive message dictionary created
- [ ] Parameter substitution works correctly
- [ ] Both Hebrew and English messages available
- [ ] Easy to use helper methods
- [ ] Backward compatibility maintained

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 3.2:** Add Country Detection Helper

## 📝 **Notes**
- Add all methods to the agentService class
- Test message formatting thoroughly
- Verify parameter substitution works
- Check both languages display correctly
