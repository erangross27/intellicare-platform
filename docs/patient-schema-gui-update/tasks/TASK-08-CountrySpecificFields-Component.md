# Task 08: Create CountrySpecificFields Component

## 📋 Task Overview
**Priority**: High  
**Type**: Development  
**Estimated Time**: 10 hours  
**Sprint**: 2  

## 🎯 Objective
Create a dynamic component that renders country-specific identification and healthcare fields based on the selected country.

## 📝 Description
As a user, I want to see only the identification and healthcare fields that are relevant to my country, so that I don't get confused by fields that don't apply to me.

## ✅ Acceptance Criteria
- [ ] Component renders different fields based on country prop
- [ ] Supports all 13 countries from the schema
- [ ] Includes proper validation for each field type
- [ ] Displays help text and examples for complex fields
- [ ] Handles required vs optional field visibility
- [ ] Maintains consistent styling with other form fields
- [ ] Supports both English and Hebrew translations
- [ ] Handles field value changes properly
- [ ] Shows validation errors appropriately
- [ ] Works in both LTR and RTL layouts

## 🔧 Technical Requirements

### Component Structure
```javascript
// CountrySpecificFields.js
import React from 'react';
import { useLanguage } from '../config/languagesStatic';
import { getCountryConfig } from '../utils/countryConfig';

const CountrySpecificFields = ({ 
  country, 
  values, 
  onChange, 
  errors = {},
  disabled = false 
}) => {
  // Implementation details
};
```

### Props Interface
```javascript
{
  country: string,           // Selected country name
  values: object,           // Current field values
  onChange: function,       // Callback for field changes
  errors: object,          // Validation errors
  disabled: boolean        // Disable all fields
}
```

### Supported Countries
1. Israel - nationalId, healthFund
2. United States - socialSecurityNumber, insuranceProvider
3. Canada - healthCardNumber, province
4. United Kingdom - nhsNumber
5. Germany - healthInsuranceNumber, insuranceProvider
6. France - socialSecurityNumber, vitaleCardNumber
7. Spain - healthCardNumber, autonomousCommunity
8. Brazil - cpfNumber, susNumber, state
9. Argentina - nationalIdNumber, healthInsuranceProvider, province
10. Japan - healthInsuranceNumber, prefecture, insuranceType
11. South Korea - residentRegistrationNumber, nationalHealthInsuranceNumber
12. Australia - medicareNumber, state, indigenousStatus
13. New Zealand - nationalHealthIndexNumber, ethnicity

## 📁 Files to Create
- `frontend-vite/src/components/CountrySpecificFields.js`
- `frontend-vite/src/components/__tests__/CountrySpecificFields.test.js`

## 🔗 Dependencies
- **Blocked by**: Task 02 (Country Configuration Utility)
- **Blocks**: Task 09 (Update PatientDetail Form Structure)

## 🧪 Testing Requirements
- [ ] Unit tests for all country configurations
- [ ] Validation tests for each field type
- [ ] Error handling tests
- [ ] Translation tests (English/Hebrew)
- [ ] Accessibility tests
- [ ] Responsive design tests

## 📚 Implementation Details

### Field Rendering Logic
```javascript
const renderField = (fieldName, fieldConfig) => {
  const { type, required, options, pattern, maxLength, minLength } = fieldConfig;
  const currentLanguage = getCurrentLanguage();
  const label = currentLanguage === 'he' ? fieldConfig.labelHe : fieldConfig.label;
  
  switch (type) {
    case 'text':
      return renderTextInput(fieldName, fieldConfig, label);
    case 'select':
      return renderSelectInput(fieldName, fieldConfig, label);
    default:
      return null;
  }
};
```

### Validation Integration
```javascript
const validateField = (fieldName, value, fieldConfig) => {
  if (fieldConfig.required && !value) {
    return t('fieldRequired');
  }
  
  if (fieldConfig.pattern && value && !new RegExp(fieldConfig.pattern).test(value)) {
    return t('invalidFormat');
  }
  
  if (fieldConfig.validation) {
    return validateSpecialField(fieldConfig.validation, value);
  }
  
  return null;
};
```

## 🎨 Styling Requirements
- Use consistent form field styling
- Support responsive grid layout
- Add visual indicators for required fields
- Include help text styling
- Support RTL layout for Hebrew

## 🌐 Translation Keys Required
Already covered in Task 01 (Translation Updates).

## ✔️ Definition of Done
- [ ] Component is implemented and functional
- [ ] All 13 countries are supported
- [ ] Unit tests pass with >90% coverage
- [ ] Manual testing completed for all countries
- [ ] Code review approved
- [ ] Documentation updated
- [ ] No accessibility violations
- [ ] Responsive design verified
- [ ] Translation coverage complete

## 📋 Checklist
- [ ] Create component file
- [ ] Implement field rendering logic
- [ ] Add validation support
- [ ] Create unit tests
- [ ] Test all country configurations
- [ ] Verify responsive design
- [ ] Test Hebrew RTL layout
- [ ] Update documentation
