# Task 1.2: Update addPatient Implementation

## 📋 **Task Overview**
**Phase:** 1 (Critical Functions)  
**Time Estimate:** 20 minutes  
**Risk Level:** LOW  
**Priority:** HIGH  

Update the `addPatient` method implementation to handle both Israeli and US practices with country-specific validation and field mapping.

## 🎯 **Objective**
Replace the hardcoded Israeli validation logic with dynamic country-specific logic that:
- Detects practice country automatically
- Validates appropriate fields for each country
- Maps fields correctly for API calls
- Provides localized error messages

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Lines:** 575-631  
**Method:** `async addPatient(params, practiceContext)`

## 🔍 **Current Code Issues**
- Hardcoded Israeli field validation
- Uses old schema field names (`name`, `age`, `gender`, `address`)
- Hebrew-only error messages
- No country detection

## ✅ **New Implementation**

### **1. Main Method Update**
```javascript
async addPatient(params, practiceContext) {
  try {
    console.log('👤 AGENT: Adding patient:', JSON.stringify(params, null, 2));

    // 1. Detect practice country
    const clinicCountry = this.getClinicCountry(practiceContext);
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

    if (response.data.success) {
      return {
        success: true,
        message: this.getLocalizedMessage('patientAdded', clinicCountry, {
          name: `${params.firstName} ${params.lastName}`
        })
      };
    } else {
      return {
        success: false,
        error: response.data.message || 'Failed to add patient'
      };
    }
  } catch (error) {
    console.error('❌ AGENT: Add patient error:', error);
    return {
      success: false,
      error: this.getLocalizedMessage('addPatientError', clinicCountry, {
        error: error.response?.data?.message || error.message
      })
    };
  }
}
```

### **2. Helper Methods to Add**

#### **Country Detection Helper**
```javascript
getClinicCountry(practiceContext) {
  return practiceContext.practice?.contact?.address?.country || 'Israel';
}
```

#### **Field Validation Helper**
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
    // insuranceProvider is optional for US
  }
  
  return missingFields;
}
```

#### **Patient Data Builder**
```javascript
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
```

#### **Error Message Generator**
```javascript
generateMissingFieldsMessage(missingFields, country) {
  const messages = {
    'Israel': {
      firstName: '🏷 מה השם הפרטי?',
      lastName: '🏷 מה שם המשפחה?',
      dateOfBirth: '🎂 מה תאריך הלידה? (YYYY-MM-DD)',
      nationalId: '🆔 מה מספר תעודת הזהות?',
      healthFund: '🏥 איזה קופת חולים? (מכבי/כללית/מאוחדת/לאומית)',
      email: '📧 מה כתובת המייל?',
      phone: '📱 מה מספר הטלפון?',
      street: '🏠 מה כתובת הרחוב?',
      city: '🏙 באיזה עיר?',
      zipCode: '📮 מה המיקוד?'
    },
    'United States': {
      firstName: '🏷 What is the first name?',
      lastName: '🏷 What is the last name?',
      dateOfBirth: '🎂 What is the date of birth? (YYYY-MM-DD)',
      socialSecurityNumber: '🆔 What is the Social Security Number? (XXX-XX-XXXX)',
      insuranceProvider: '🏥 What is the insurance provider?',
      email: '📧 What is the email address?',
      phone: '📱 What is the phone number?',
      street: '🏠 What is the street address?',
      city: '🏙 What city?',
      zipCode: '📮 What is the ZIP code?'
    }
  };
  
  const countryMessages = messages[country] || messages['Israel'];
  return missingFields.map(field => countryMessages[field] || `Missing: ${field}`).join('\n');
}
```

#### **Localized Message Helper**
```javascript
getLocalizedMessage(key, country, params = {}) {
  const messages = {
    'Israel': {
      patientAdded: `✅ המטופל ${params.name} נוסף בהצלחה`,
      addPatientError: `❌ שגיאה בהוספת מטופל: ${params.error}`
    },
    'United States': {
      patientAdded: `✅ Patient ${params.name} added successfully`,
      addPatientError: `❌ Error adding patient: ${params.error}`
    }
  };
  
  return messages[country]?.[key] || messages['Israel'][key] || key;
}
```

## 🔧 **Key Changes**
1. **✅ Country Detection:** Automatic detection from practice context
2. **✅ Dynamic Validation:** Different rules for Israel vs US
3. **✅ Field Mapping:** New schema fields (`firstName`, `lastName`, `dateOfBirth`)
4. **✅ Localized Messages:** Hebrew for Israel, English for US
5. **✅ Flexible Data Building:** Country-specific field inclusion

## ⚠️ **Safety Notes**
- **✅ SAFE:** Only changing validation and data mapping logic
- **✅ SAFE:** API call structure remains the same
- **✅ SAFE:** Return format stays consistent
- **❌ DON'T TOUCH:** Function calling detection logic

## 🧪 **Testing After Change**
1. **Test Israeli practice:**
   - Create patient with `nationalId` + `healthFund`
   - Verify Hebrew error messages
   - Check field validation

2. **Test US practice:**
   - Create patient with `socialSecurityNumber`
   - Verify English error messages
   - Check field validation

3. **Test edge cases:**
   - Missing required fields
   - Invalid country
   - API errors

## ✅ **Success Criteria**
- [ ] Country detection works correctly
- [ ] Israeli validation requires `nationalId` + `healthFund`
- [ ] US validation requires `socialSecurityNumber`
- [ ] Error messages in correct language
- [ ] API calls use new schema fields
- [ ] Function calling still works

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 1.3:** Update addHistoryFunction Schema

## 📝 **Notes**
- Add all helper methods to the class
- Test both countries thoroughly
- Verify function calling detection still works
- Check API response handling
