# Task 3.2: Add Country Detection Helper

## 📋 **Task Overview**
**Phase:** 3 (Utility Functions)  
**Time Estimate:** 10 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

Create robust country detection and validation helpers to ensure consistent country handling across all agent functions.

## 🎯 **Objective**
Create reliable country detection that:
- Extracts country from practice context consistently
- Validates supported countries (Israel, United States)
- Provides fallback logic for edge cases
- Supports future country additions

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Location:** Add new methods to the class  

## ✅ **Country Detection System**

### **1. Main Country Detection Method**
```javascript
getClinicCountry(practiceContext) {
  try {
    // Primary: Get from practice contact address
    const country = practiceContext?.practice?.contact?.address?.country;
    
    if (country && this.isSupportedCountry(country)) {
      console.log(`🌍 AGENT: Practice country detected: ${country}`);
      return country;
    }
    
    // Secondary: Get from practice registration data
    const registrationCountry = practiceContext?.practice?.registrationData?.country;
    if (registrationCountry && this.isSupportedCountry(registrationCountry)) {
      console.log(`🌍 AGENT: Practice country from registration: ${registrationCountry}`);
      return registrationCountry;
    }
    
    // Tertiary: Get from practice settings
    const settingsCountry = practiceContext?.practice?.settings?.country;
    if (settingsCountry && this.isSupportedCountry(settingsCountry)) {
      console.log(`🌍 AGENT: Practice country from settings: ${settingsCountry}`);
      return settingsCountry;
    }
    
    // Fallback: Default to Israel
    console.log('⚠️ AGENT: No country detected, defaulting to Israel');
    return 'Israel';
    
  } catch (error) {
    console.error('❌ AGENT: Error detecting country:', error);
    console.log('⚠️ AGENT: Error in country detection, defaulting to Israel');
    return 'Israel';
  }
}
```

### **2. Country Validation**
```javascript
isSupportedCountry(country) {
  const supportedCountries = ['Israel', 'United States'];
  return supportedCountries.includes(country);
}

getSupportedCountries() {
  return ['Israel', 'United States'];
}
```

### **3. Country Normalization**
```javascript
normalizeCountryName(country) {
  if (!country) return null;
  
  const countryMappings = {
    // Israel variations
    'israel': 'Israel',
    'IL': 'Israel',
    'ISR': 'Israel',
    'ישראל': 'Israel',
    
    // United States variations
    'united states': 'United States',
    'usa': 'United States',
    'us': 'United States',
    'US': 'United States',
    'USA': 'United States',
    'america': 'United States',
    'united states of america': 'United States'
  };
  
  const normalized = countryMappings[country.toLowerCase()] || country;
  return this.isSupportedCountry(normalized) ? normalized : null;
}
```

### **4. Country-Specific Configuration**
```javascript
getCountryConfig(country) {
  const configs = {
    'Israel': {
      language: 'he',
      currency: 'ILS',
      dateFormat: 'DD/MM/YYYY',
      requiredFields: ['nationalId', 'healthFund'],
      optionalFields: ['email', 'phone', 'street', 'city', 'zipCode'],
      idField: 'nationalId',
      healthcareField: 'healthFund',
      healthcareOptions: ['מכבי', 'כללית', 'מאוחדת', 'לאומית']
    },
    'United States': {
      language: 'en',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      requiredFields: ['socialSecurityNumber'],
      optionalFields: ['insuranceProvider', 'email', 'phone', 'street', 'city', 'zipCode'],
      idField: 'socialSecurityNumber',
      healthcareField: 'insuranceProvider',
      healthcareOptions: [] // Open text field
    }
  };
  
  return configs[country] || configs['Israel'];
}
```

### **5. Language Detection**
```javascript
getCountryLanguage(country) {
  const config = this.getCountryConfig(country);
  return config.language;
}

isHebrewCountry(country) {
  return this.getCountryLanguage(country) === 'he';
}

isEnglishCountry(country) {
  return this.getCountryLanguage(country) === 'en';
}
```

### **6. Field Requirements by Country**
```javascript
getRequiredFieldsForCountry(country) {
  const config = this.getCountryConfig(country);
  return ['firstName', 'lastName', 'dateOfBirth', ...config.requiredFields];
}

getOptionalFieldsForCountry(country) {
  const config = this.getCountryConfig(country);
  return config.optionalFields;
}

getIdentificationFieldForCountry(country) {
  const config = this.getCountryConfig(country);
  return config.idField;
}

getHealthcareFieldForCountry(country) {
  const config = this.getCountryConfig(country);
  return config.healthcareField;
}
```

### **7. Validation Helpers**
```javascript
validateCountrySpecificFields(params, country) {
  const requiredFields = this.getRequiredFieldsForCountry(country);
  const missingFields = [];
  
  requiredFields.forEach(field => {
    if (!params[field] || params[field].trim() === '') {
      missingFields.push(field);
    }
  });
  
  return missingFields;
}

validateIdentificationField(value, country) {
  const config = this.getCountryConfig(country);
  
  if (country === 'Israel') {
    // Israeli ID validation (9 digits)
    return /^\d{9}$/.test(value);
  } else if (country === 'United States') {
    // US SSN validation (XXX-XX-XXXX)
    return /^\d{3}-\d{2}-\d{4}$/.test(value);
  }
  
  return true; // Default to valid for unsupported countries
}
```

### **8. Debug and Logging Helpers**
```javascript
logCountryDetection(practiceContext) {
  console.log('🔍 AGENT: Country detection debug:');
  console.log('  - Practice contact country:', practiceContext?.practice?.contact?.address?.country);
  console.log('  - Practice registration country:', practiceContext?.practice?.registrationData?.country);
  console.log('  - Practice settings country:', practiceContext?.practice?.settings?.country);
  console.log('  - Supported countries:', this.getSupportedCountries());
  console.log('  - Final detected country:', this.getClinicCountry(practiceContext));
}

validateClinicContext(practiceContext) {
  if (!practiceContext) {
    console.warn('⚠️ AGENT: No practice context provided');
    return false;
  }
  
  if (!practiceContext.practice) {
    console.warn('⚠️ AGENT: No practice data in context');
    return false;
  }
  
  return true;
}
```

## 🔧 **Key Features**
1. **✅ Robust Detection:**
   - Multiple fallback sources for country
   - Error handling and logging
   - Graceful degradation to default

2. **✅ Country Validation:**
   - Supported country checking
   - Country name normalization
   - Validation helpers

3. **✅ Configuration System:**
   - Country-specific settings
   - Field requirements by country
   - Language and format preferences

4. **✅ Validation Helpers:**
   - Country-specific field validation
   - ID format validation
   - Required field checking

## ⚠️ **Safety Notes**
- **✅ SAFE:** Only adding new utility methods
- **✅ SAFE:** No changes to existing function calling logic
- **✅ SAFE:** Backward compatible with existing code
- **❌ DON'T TOUCH:** Function calling API structure

## 🔄 **Usage Examples**
```javascript
// Basic country detection
const country = this.getClinicCountry(practiceContext);

// Get country configuration
const config = this.getCountryConfig(country);

// Validate required fields
const missingFields = this.validateCountrySpecificFields(params, country);

// Check ID format
const isValidId = this.validateIdentificationField(params.nationalId, 'Israel');

// Get language
const language = this.getCountryLanguage(country);
```

## 🧪 **Testing After Change**
1. **Test country detection:**
   - Israeli practice context
   - US practice context
   - Missing country data
   - Invalid country data

2. **Test validation:**
   - Israeli ID validation
   - US SSN validation
   - Required field checking

3. **Test configuration:**
   - Country-specific settings
   - Language detection
   - Field requirements

## ✅ **Success Criteria**
- [ ] Reliable country detection from practice context
- [ ] Proper fallback to default country
- [ ] Country-specific validation works
- [ ] Configuration system functional
- [ ] Debug logging helpful

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 3.3:** Add Field Validation Helpers

## 📝 **Notes**
- Add all methods to the agentService class
- Test with various practice contexts
- Verify fallback logic works
- Check validation accuracy
