# Task 02: Create Country Configuration Utility

## 📋 Task Overview
**Epic**: Patient Schema GUI Update  
**Sprint**: Phase 1 - Infrastructure  
**Estimated Time**: 6 hours  
**Priority**: High (Blocking)  
**Assignee**: Developer  

## 🎯 Objective
Create a centralized configuration utility that defines field specifications, validation rules, and display properties for all 13 supported countries from the PatientSchemaFactory.js schema.

## 📝 Description
As a developer, I need a centralized configuration system for country-specific fields so that the application can dynamically display appropriate identification and healthcare fields based on the selected country.

## ✅ Acceptance Criteria
- [ ] Create `utils/countryConfig.js` with complete field definitions
- [ ] Include validation rules for each country's ID formats
- [ ] Add field labels, placeholders, and help text for all countries
- [ ] Export functions to get country fields dynamically
- [ ] Support for firstName/lastName separate fields
- [ ] Add comprehensive unit tests
- [ ] Include documentation and examples
- [ ] Ensure TypeScript compatibility (if applicable)

## 🔧 Technical Requirements

### Files to Create
- `frontend-vite/src/utils/countryConfig.js`
- `frontend-vite/src/utils/__tests__/countryConfig.test.js`

### Core Configuration Structure
```javascript
// Universal fields (same for all countries)
const universalFields = {
  firstName: { 
    required: true, 
    type: 'text', 
    maxLength: 50,
    label: 'firstName',
    placeholder: 'enterFirstName'
  },
  lastName: { 
    required: true, 
    type: 'text', 
    maxLength: 50,
    label: 'lastName', 
    placeholder: 'enterLastName'
  },
  dateOfBirth: { 
    required: true, 
    type: 'date',
    label: 'dateOfBirth'
  },
  email: { 
    required: false, 
    type: 'email', 
    maxLength: 100,
    label: 'email'
  },
  phone: { 
    required: false, 
    type: 'tel', 
    maxLength: 20,
    label: 'phone'
  },
  street: { 
    required: false, 
    type: 'text', 
    maxLength: 100,
    label: 'streetAddress',
    placeholder: 'enterStreetAddress'
  },
  city: { 
    required: false, 
    type: 'text', 
    maxLength: 50,
    label: 'city',
    placeholder: 'enterCity'
  },
  zipCode: { 
    required: false, 
    type: 'text', 
    maxLength: 20,
    label: 'zipCode',
    placeholder: 'enterZipCode'
  },
  status: { 
    required: true, 
    type: 'select', 
    options: ['active', 'inactive', 'archived'], 
    default: 'active',
    label: 'status'
  },
  doctorSummary: { 
    required: false, 
    type: 'textarea', 
    maxLength: 2000,
    label: 'doctorSummary'
  }
};
```

### Country-Specific Configurations
Each country needs a complete configuration object with:

#### Israel Configuration
```javascript
const israelConfig = {
  country: 'Israel',
  countryCode: 'IL',
  fields: {
    nationalId: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{9}$',
      maxLength: 9,
      minLength: 9,
      label: 'nationalId',
      placeholder: '123456789',
      helpText: '9-digit Israeli ID number',
      validation: 'israeliId',
      inputMode: 'numeric'
    },
    healthFund: {
      required: true,
      type: 'select',
      options: ['מכבי', 'כללית', 'מאוחדת', 'לאומית'],
      label: 'healthFund',
      helpText: 'Israeli health fund provider'
    }
  }
};
```

#### United States Configuration
```javascript
const usConfig = {
  country: 'United States',
  countryCode: 'US',
  fields: {
    socialSecurityNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{3}-[0-9]{2}-[0-9]{4}$',
      maxLength: 11,
      label: 'socialSecurityNumber',
      placeholder: '123-45-6789',
      helpText: 'Format: XXX-XX-XXXX',
      validation: 'ssn',
      inputMode: 'numeric'
    },
    insuranceProvider: {
      required: false,
      type: 'text',
      maxLength: 100,
      label: 'insuranceProvider',
      placeholder: 'Blue Cross Blue Shield',
      helpText: 'Health insurance company name'
    }
  }
};
```

### Required Export Functions
```javascript
// Get configuration for a specific country
export const getCountryConfig = (countryName) => { ... };

// Get all supported countries
export const getSupportedCountries = () => { ... };

// Get fields for a specific country
export const getCountryFields = (countryName) => { ... };

// Get required fields for a country
export const getRequiredFields = (countryName) => { ... };

// Get universal fields
export const getUniversalFields = () => { ... };

// Validate field value for specific country
export const validateCountryField = (country, fieldName, value) => { ... };

// Format field value for display
export const formatFieldValue = (country, fieldName, value) => { ... };

// Get validation error message
export const getValidationError = (country, fieldName, value) => { ... };
```

### Validation Functions to Include
```javascript
// Israeli ID validation (Luhn algorithm)
export const validateIsraeliId = (id) => { ... };

// US SSN validation
export const validateSSN = (ssn) => { ... };

// Canadian Health Card validation
export const validateCanadianHealthCard = (number) => { ... };

// UK NHS Number validation
export const validateNhsNumber = (number) => { ... };

// German Health Insurance validation
export const validateGermanHealthInsurance = (number) => { ... };

// Add validation for all other countries...
```

## 🧪 Testing Requirements

### Unit Tests to Create
```javascript
describe('countryConfig', () => {
  describe('getSupportedCountries', () => {
    it('should return all 13 supported countries', () => {
      // Test implementation
    });
  });

  describe('getCountryConfig', () => {
    it('should return valid config for Israel', () => {
      // Test implementation
    });
    
    it('should return null for unsupported country', () => {
      // Test implementation
    });
  });

  describe('validateIsraeliId', () => {
    it('should validate correct Israeli ID', () => {
      // Test with valid IDs
    });
    
    it('should reject invalid Israeli ID', () => {
      // Test with invalid IDs
    });
  });

  // Add tests for all countries and validation functions
});
```

### Test Cases for Each Country
- [ ] Valid ID format validation
- [ ] Invalid ID format rejection
- [ ] Required field identification
- [ ] Optional field handling
- [ ] Field configuration completeness

## 📦 Dependencies
**Requires**: Task 01 - Update Translation Files  
**Blocks**: Task 03 - Create Base Form Components

**Technical Dependencies**:
- Understanding of PatientSchemaFactory.js structure
- Knowledge of validation algorithms for each country
- Jest testing framework setup

## ✨ Definition of Done
- [ ] All 13 countries have complete configurations
- [ ] Universal fields are properly defined
- [ ] Validation functions work correctly for all countries
- [ ] Unit tests have 100% coverage
- [ ] Documentation is complete with examples
- [ ] Code review completed
- [ ] Performance impact assessed
- [ ] Integration with existing useClinicInfo hook considered

## 📚 Additional Notes

### Country-Specific Research Required
- **Israeli ID**: Luhn algorithm validation
- **US SSN**: Format validation (no checksum)
- **Canadian Health Card**: Province-specific formats
- **UK NHS**: Check digit validation
- **German Health Insurance**: Letter + digit format
- **French Social Security**: 13-digit validation
- **Spanish Health Card**: Regional variations
- **Brazilian CPF**: Checksum validation
- **Argentine DNI**: 8-digit format
- **Japanese Health Insurance**: Prefecture codes
- **Korean Resident Registration**: Date validation
- **Australian Medicare**: Check digit validation
- **New Zealand NHI**: Check character validation

### Performance Considerations
- Lazy loading of country configurations
- Memoization of validation results
- Efficient field lookup algorithms

## 🔗 Related Tasks
- **Previous**: Task 01 - Update Translation Files
- **Next**: Task 03 - Create Base Form Components
- **Related**: Task 08 - Enhance NationalIdField Component
