# Task 3.3: Add Field Validation Helpers

## 📋 **Task Overview**
**Phase:** 3 (Utility Functions)  
**Time Estimate:** 15 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

Create comprehensive field validation helpers for patient data validation, including country-specific validation rules and data formatting.

## 🎯 **Objective**
Create robust validation system that:
- Validates all patient fields according to country requirements
- Provides specific validation for IDs, emails, phones, dates
- Formats and sanitizes input data
- Gives detailed validation error messages

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Location:** Add new methods to the class  

## ✅ **Field Validation System**

### **1. Main Patient Validation Method**
```javascript
validatePatientData(params, country) {
  const errors = [];
  const warnings = [];
  
  // Validate required fields
  const missingFields = this.validateRequiredFields(params, country);
  if (missingFields.length > 0) {
    errors.push({
      type: 'missing_fields',
      fields: missingFields,
      message: this.generateMissingFieldsMessage(missingFields, country)
    });
  }
  
  // Validate field formats
  const formatErrors = this.validateFieldFormats(params, country);
  errors.push(...formatErrors);
  
  // Validate field values
  const valueErrors = this.validateFieldValues(params, country);
  errors.push(...valueErrors);
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}
```

### **2. Required Fields Validation**
```javascript
validateRequiredFields(params, country) {
  const requiredFields = this.getRequiredFieldsForCountry(country);
  const missingFields = [];
  
  requiredFields.forEach(field => {
    if (!params[field] || (typeof params[field] === 'string' && params[field].trim() === '')) {
      missingFields.push(field);
    }
  });
  
  return missingFields;
}
```

### **3. Field Format Validation**
```javascript
validateFieldFormats(params, country) {
  const errors = [];
  
  // Name validation
  if (params.firstName && !this.isValidName(params.firstName)) {
    errors.push({
      type: 'invalid_format',
      field: 'firstName',
      message: country === 'Israel' 
        ? 'שם פרטי לא תקין - רק אותיות'
        : 'Invalid first name - letters only'
    });
  }
  
  if (params.lastName && !this.isValidName(params.lastName)) {
    errors.push({
      type: 'invalid_format',
      field: 'lastName',
      message: country === 'Israel' 
        ? 'שם משפחה לא תקין - רק אותיות'
        : 'Invalid last name - letters only'
    });
  }
  
  // Date validation
  if (params.dateOfBirth && !this.isValidDate(params.dateOfBirth)) {
    errors.push({
      type: 'invalid_format',
      field: 'dateOfBirth',
      message: country === 'Israel' 
        ? 'תאריך לידה לא תקין - נדרש פורמט YYYY-MM-DD'
        : 'Invalid date of birth - required format YYYY-MM-DD'
    });
  }
  
  // Email validation
  if (params.email && !this.isValidEmail(params.email)) {
    errors.push({
      type: 'invalid_format',
      field: 'email',
      message: country === 'Israel' 
        ? 'כתובת מייל לא תקינה'
        : 'Invalid email address'
    });
  }
  
  // Phone validation
  if (params.phone && !this.isValidPhone(params.phone, country)) {
    errors.push({
      type: 'invalid_format',
      field: 'phone',
      message: country === 'Israel' 
        ? 'מספר טלפון לא תקין'
        : 'Invalid phone number'
    });
  }
  
  // Country-specific ID validation
  if (country === 'Israel' && params.nationalId && !this.isValidIsraeliId(params.nationalId)) {
    errors.push({
      type: 'invalid_format',
      field: 'nationalId',
      message: 'תעודת זהות לא תקינה - נדרשות 9 ספרות'
    });
  }
  
  if (country === 'United States' && params.socialSecurityNumber && !this.isValidSSN(params.socialSecurityNumber)) {
    errors.push({
      type: 'invalid_format',
      field: 'socialSecurityNumber',
      message: 'Invalid Social Security Number - required format XXX-XX-XXXX'
    });
  }
  
  return errors;
}
```

### **4. Field Value Validation**
```javascript
validateFieldValues(params, country) {
  const errors = [];
  
  // Age validation (from date of birth)
  if (params.dateOfBirth) {
    const age = this.calculateAge(params.dateOfBirth);
    if (age < 0 || age > 150) {
      errors.push({
        type: 'invalid_value',
        field: 'dateOfBirth',
        message: country === 'Israel' 
          ? 'גיל לא סביר - בדוק את תאריך הלידה'
          : 'Unreasonable age - check date of birth'
      });
    }
  }
  
  // Health fund validation (Israel)
  if (country === 'Israel' && params.healthFund) {
    const validHealthFunds = ['מכבי', 'כללית', 'מאוחדת', 'לאומית'];
    if (!validHealthFunds.includes(params.healthFund)) {
      errors.push({
        type: 'invalid_value',
        field: 'healthFund',
        message: 'קופת חולים לא תקינה - בחר מהרשימה: מכבי, כללית, מאוחדת, לאומית'
      });
    }
  }
  
  return errors;
}
```

### **5. Specific Field Validators**
```javascript
isValidName(name) {
  // Allow letters, spaces, hyphens, apostrophes (for Hebrew and English names)
  return /^[a-zA-Zא-ת\s\-']+$/.test(name.trim());
}

isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
}

isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.toLowerCase());
}

isValidPhone(phone, country) {
  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (country === 'Israel') {
    // Israeli phone: 10 digits starting with 05 (mobile) or area code
    return /^(05\d{8}|0[2-4,8-9]\d{7,8})$/.test(digitsOnly);
  } else if (country === 'United States') {
    // US phone: 10 digits
    return /^\d{10}$/.test(digitsOnly);
  }
  
  // Default: at least 7 digits
  return digitsOnly.length >= 7;
}

isValidIsraeliId(id) {
  // Israeli ID: exactly 9 digits with checksum validation
  if (!/^\d{9}$/.test(id)) return false;
  
  // Luhn algorithm for Israeli ID
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(id[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  return sum % 10 === 0;
}

isValidSSN(ssn) {
  // US SSN: XXX-XX-XXXX format
  return /^\d{3}-\d{2}-\d{4}$/.test(ssn);
}

isValidZipCode(zipCode, country) {
  if (country === 'Israel') {
    // Israeli postal code: 5 or 7 digits
    return /^\d{5}(\d{2})?$/.test(zipCode);
  } else if (country === 'United States') {
    // US ZIP: 5 digits or 5+4 format
    return /^\d{5}(-\d{4})?$/.test(zipCode);
  }
  
  return true; // Default to valid for other countries
}
```

### **6. Data Sanitization**
```javascript
sanitizePatientData(params, country) {
  const sanitized = {};
  
  // Sanitize text fields
  if (params.firstName) sanitized.firstName = this.sanitizeText(params.firstName);
  if (params.lastName) sanitized.lastName = this.sanitizeText(params.lastName);
  if (params.email) sanitized.email = params.email.toLowerCase().trim();
  if (params.phone) sanitized.phone = this.sanitizePhone(params.phone, country);
  if (params.street) sanitized.street = this.sanitizeText(params.street);
  if (params.city) sanitized.city = this.sanitizeText(params.city);
  if (params.zipCode) sanitized.zipCode = this.sanitizeZipCode(params.zipCode, country);
  
  // Sanitize date
  if (params.dateOfBirth) sanitized.dateOfBirth = this.sanitizeDate(params.dateOfBirth);
  
  // Sanitize country-specific fields
  if (country === 'Israel') {
    if (params.nationalId) sanitized.nationalId = params.nationalId.replace(/\D/g, '');
    if (params.healthFund) sanitized.healthFund = params.healthFund.trim();
  } else if (country === 'United States') {
    if (params.socialSecurityNumber) sanitized.socialSecurityNumber = this.sanitizeSSN(params.socialSecurityNumber);
    if (params.insuranceProvider) sanitized.insuranceProvider = this.sanitizeText(params.insuranceProvider);
  }
  
  return sanitized;
}

sanitizeText(text) {
  return text.trim().replace(/\s+/g, ' '); // Remove extra whitespace
}

sanitizePhone(phone, country) {
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (country === 'Israel') {
    // Format Israeli phone: 0XX-XXX-XXXX
    if (digitsOnly.length === 10) {
      return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
  } else if (country === 'United States') {
    // Format US phone: (XXX) XXX-XXXX
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
  }
  
  return phone.trim(); // Return as-is if can't format
}

sanitizeSSN(ssn) {
  const digitsOnly = ssn.replace(/\D/g, '');
  if (digitsOnly.length === 9) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 5)}-${digitsOnly.slice(5)}`;
  }
  return ssn.trim();
}

sanitizeDate(dateString) {
  const date = new Date(dateString);
  if (date instanceof Date && !isNaN(date)) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
  return dateString;
}

sanitizeZipCode(zipCode, country) {
  const digitsOnly = zipCode.replace(/\D/g, '');
  
  if (country === 'United States' && digitsOnly.length === 9) {
    // Format US ZIP+4: XXXXX-XXXX
    return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`;
  }
  
  return zipCode.trim();
}
```

### **7. Validation Summary Helper**
```javascript
getValidationSummary(validationResult, country) {
  if (validationResult.isValid) {
    return {
      success: true,
      message: country === 'Israel' ? 'כל השדות תקינים' : 'All fields are valid'
    };
  }
  
  const errorMessages = validationResult.errors.map(error => error.message);
  return {
    success: false,
    message: errorMessages.join('\n')
  };
}
```

## 🔧 **Key Features**
1. **✅ Comprehensive Validation:**
   - All field types covered
   - Country-specific rules
   - Format and value validation

2. **✅ Data Sanitization:**
   - Automatic data cleaning
   - Format standardization
   - Whitespace handling

3. **✅ Detailed Error Messages:**
   - Specific validation errors
   - Localized messages
   - Field-level feedback

4. **✅ Flexible System:**
   - Easy to extend for new countries
   - Configurable validation rules
   - Modular validation functions

## ⚠️ **Safety Notes**
- **✅ SAFE:** Only adding new utility methods
- **✅ SAFE:** No changes to existing function calling logic
- **✅ SAFE:** Backward compatible with existing code
- **❌ DON'T TOUCH:** Function calling API structure

## 🔄 **Usage Examples**
```javascript
// Validate patient data
const validation = this.validatePatientData(params, country);
if (!validation.isValid) {
  return this.getValidationSummary(validation, country);
}

// Sanitize data before saving
const cleanData = this.sanitizePatientData(params, country);

// Validate specific field
const isValidId = this.isValidIsraeliId(params.nationalId);
```

## 🧪 **Testing After Change**
1. **Test field validation:**
   - Valid and invalid names
   - Valid and invalid dates
   - Valid and invalid emails/phones
   - Country-specific ID validation

2. **Test data sanitization:**
   - Text cleaning
   - Phone formatting
   - Date normalization

3. **Test error messages:**
   - Hebrew error messages
   - English error messages
   - Field-specific errors

## ✅ **Success Criteria**
- [ ] All field types validated correctly
- [ ] Country-specific validation works
- [ ] Data sanitization functions properly
- [ ] Error messages are clear and localized
- [ ] Validation is comprehensive but not overly strict

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 4.1:** Test Israeli Functions (Phase 4)

## 📝 **Notes**
- Add all methods to the agentService class
- Test validation thoroughly with various inputs
- Verify sanitization doesn't break valid data
- Check error messages are helpful
- This completes Phase 3 (Utility Functions)
