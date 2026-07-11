# Task 04: Create CountrySpecificFields Component

## 📋 Task Overview
**Epic**: Patient Schema GUI Update  
**Sprint**: Phase 2 - Country-Specific Components  
**Estimated Time**: 10 hours  
**Priority**: High  
**Assignee**: Developer  

## 🎯 Objective
Create a dynamic React component that renders country-specific identification and healthcare fields based on the selected country, supporting all 13 countries from the PatientSchemaFactory.js schema.

## 📝 Description
As a user, I want to see only the identification and healthcare fields relevant to my country so that the form is tailored to my specific requirements and reduces confusion.

## ✅ Acceptance Criteria
- [ ] Create dynamic component that renders fields based on country
- [ ] Support all 13 countries from the schema
- [ ] Include proper validation for each field type
- [ ] Add help text and examples for complex fields
- [ ] Handle field visibility based on required/optional status
- [ ] Support real-time country switching
- [ ] Include proper field formatting (e.g., SSN with dashes)
- [ ] Add accessibility attributes and ARIA labels
- [ ] Implement proper error handling and display

## 🔧 Technical Requirements

### File to Create
- `frontend-vite/src/components/CountrySpecificFields.js`

### Component Structure
```javascript
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { 
  getCountryConfig, 
  getCountryFields, 
  validateCountryField,
  formatFieldValue 
} from '../utils/countryConfig';

const CountrySpecificFields = ({ 
  country, 
  values = {}, 
  onChange, 
  errors = {},
  disabled = false 
}) => {
  const { t } = useLanguage();
  const [fieldConfigs, setFieldConfigs] = useState({});

  useEffect(() => {
    if (country) {
      const config = getCountryFields(country);
      setFieldConfigs(config);
    } else {
      setFieldConfigs({});
    }
  }, [country]);

  const handleFieldChange = (fieldName, value, config) => {
    // Apply formatting if needed
    const formattedValue = formatFieldValue(country, fieldName, value);
    
    onChange({
      ...values,
      [fieldName]: formattedValue
    });
  };

  const renderField = (fieldName, config) => {
    const fieldValue = values[fieldName] || '';
    const fieldError = errors[fieldName];
    const fieldId = `${country}-${fieldName}`;

    switch (config.type) {
      case 'text':
        return renderTextInput(fieldName, config, fieldValue, fieldError, fieldId);
      case 'select':
        return renderSelectInput(fieldName, config, fieldValue, fieldError, fieldId);
      default:
        return null;
    }
  };

  // Component implementation continues...
};

export default CountrySpecificFields;
```

### Field Rendering Functions

#### Text Input Renderer
```javascript
const renderTextInput = (fieldName, config, value, error, fieldId) => {
  return (
    <div className="form-group country-specific-field">
      <label htmlFor={fieldId}>
        {t(config.label)} {config.required && '*'}
      </label>
      <input
        type="text"
        id={fieldId}
        name={fieldName}
        value={value}
        onChange={(e) => handleFieldChange(fieldName, e.target.value, config)}
        className={`form-control ${error ? 'error' : ''}`}
        placeholder={config.placeholder || ''}
        required={config.required}
        disabled={disabled}
        maxLength={config.maxLength}
        minLength={config.minLength}
        pattern={config.pattern}
        inputMode={config.inputMode || 'text'}
        autoComplete="off"
        aria-describedby={`${fieldId}-help ${error ? `${fieldId}-error` : ''}`}
      />
      {config.helpText && (
        <small id={`${fieldId}-help`} className="form-text text-muted">
          {t(config.helpText) || config.helpText}
        </small>
      )}
      {error && (
        <div id={`${fieldId}-error`} className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};
```

#### Select Input Renderer
```javascript
const renderSelectInput = (fieldName, config, value, error, fieldId) => {
  return (
    <div className="form-group country-specific-field">
      <label htmlFor={fieldId}>
        {t(config.label)} {config.required && '*'}
      </label>
      <select
        id={fieldId}
        name={fieldName}
        value={value}
        onChange={(e) => handleFieldChange(fieldName, e.target.value, config)}
        className={`form-control ${error ? 'error' : ''}`}
        required={config.required}
        disabled={disabled}
        aria-describedby={`${fieldId}-help ${error ? `${fieldId}-error` : ''}`}
      >
        <option value="">
          {t('selectOption')} {t(config.label)}
        </option>
        {config.options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {config.helpText && (
        <small id={`${fieldId}-help`} className="form-text text-muted">
          {t(config.helpText) || config.helpText}
        </small>
      )}
      {error && (
        <div id={`${fieldId}-error`} className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};
```

### Country-Specific Field Implementations

#### Israel Fields
```javascript
// nationalId field with Israeli ID validation
// healthFund field with Hebrew options
```

#### United States Fields
```javascript
// socialSecurityNumber with XXX-XX-XXXX formatting
// insuranceProvider as text input
```

#### Canada Fields
```javascript
// healthCardNumber with province-specific validation
// province dropdown with all Canadian provinces
```

#### United Kingdom Fields
```javascript
// nhsNumber with XXX XXX XXXX formatting
```

#### Germany Fields
```javascript
// healthInsuranceNumber with letter + numbers format
// insuranceProvider as text input
```

#### France Fields
```javascript
// socialSecurityNumber (13 digits)
// vitaleCardNumber (15 digits)
```

#### Spain Fields
```javascript
// healthCardNumber (12 digits)
// autonomousCommunity dropdown
```

#### Brazil Fields
```javascript
// cpfNumber with XXX.XXX.XXX-XX formatting
// susNumber (15 digits)
// state dropdown with Brazilian states
```

#### Argentina Fields
```javascript
// nationalIdNumber (DNI - 8 digits)
// healthInsuranceProvider as text
// province dropdown with Argentine provinces
```

#### Japan Fields
```javascript
// healthInsuranceNumber (8 digits)
// prefecture dropdown with Japanese prefectures
// insuranceType dropdown
```

#### South Korea Fields
```javascript
// residentRegistrationNumber with YYMMDD-NNNNNNN format
// nationalHealthInsuranceNumber (11 digits)
```

#### Australia Fields
```javascript
// medicareNumber (10 digits)
// state dropdown with Australian states/territories
// indigenousStatus dropdown
```

#### New Zealand Fields
```javascript
// nationalHealthIndexNumber with ABC1234 format
// ethnicity dropdown
```

## 🎨 CSS Requirements

### Styling for Country-Specific Fields
```css
.country-specific-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.country-specific-field {
  position: relative;
}

.country-specific-field .form-control {
  transition: border-color 0.2s ease-in-out;
}

.country-specific-field .form-control:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
}

.field-help-text {
  font-size: 0.75rem;
  color: #6c757d;
  margin-top: 0.25rem;
  font-style: italic;
}

.field-help-text::before {
  content: "💡 ";
  margin-right: 0.25rem;
}

.required-indicator {
  color: #dc3545;
  margin-left: 0.25rem;
}

/* Country-specific styling */
.country-israel .form-control {
  direction: ltr; /* Keep input LTR even in RTL layout */
}

.country-us .ssn-input,
.country-brazil .cpf-input {
  font-family: 'Monaco', 'Consolas', monospace;
  letter-spacing: 0.1em;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .country-specific-fields {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

/* RTL support for specific countries */
[dir="rtl"] .country-specific-fields {
  text-align: right;
}

[dir="rtl"] .country-specific-field label {
  text-align: right;
}
```

## 🧪 Testing Requirements

### Unit Tests
```javascript
describe('CountrySpecificFields', () => {
  describe('Israel', () => {
    it('renders nationalId and healthFund fields', () => {});
    it('validates Israeli ID format', () => {});
    it('shows health fund options in Hebrew', () => {});
  });

  describe('United States', () => {
    it('renders SSN and insurance provider fields', () => {});
    it('formats SSN with dashes', () => {});
    it('validates SSN format', () => {});
  });

  describe('Canada', () => {
    it('renders health card and province fields', () => {});
    it('shows all Canadian provinces', () => {});
  });

  // Add tests for all 13 countries
  
  describe('Field Validation', () => {
    it('validates required fields', () => {});
    it('validates field formats', () => {});
    it('shows appropriate error messages', () => {});
  });

  describe('Country Switching', () => {
    it('clears fields when country changes', () => {});
    it('preserves valid fields when switching', () => {});
  });
});
```

### Integration Tests
```javascript
describe('CountrySpecificFields Integration', () => {
  it('integrates with countryConfig utility', () => {});
  it('handles translation updates', () => {});
  it('works with form validation', () => {});
  it('supports real-time field switching', () => {});
});
```

## 📦 Dependencies
**Requires**: 
- Task 02 - Create Country Configuration Utility
- Task 01 - Update Translation Files

**Blocks**: 
- Task 07 - Restructure PatientDetail Form Layout
- Task 09 - Update State Management

## ✨ Definition of Done
- [ ] Component renders fields for all 13 countries
- [ ] Real-time validation works for all field types
- [ ] Proper field formatting implemented (SSN, CPF, etc.)
- [ ] Help text and examples display correctly
- [ ] Error handling works for all validation scenarios
- [ ] Accessibility attributes implemented
- [ ] Responsive design works on all devices
- [ ] RTL layout supported for applicable countries
- [ ] Unit tests cover all countries and scenarios
- [ ] Integration tests verify component interactions
- [ ] Performance optimized for country switching
- [ ] Code review completed

## 📚 Additional Notes

### Field Formatting Examples
- **US SSN**: 123456789 → 123-45-6789
- **Brazil CPF**: 12345678901 → 123.456.789-01
- **UK NHS**: 1234567890 → 123 456 7890
- **Korea RRN**: 1234567890123 → 123456-7890123

### Validation Requirements
- Real-time validation as user types
- Format validation (pattern matching)
- Checksum validation where applicable (Israeli ID, Australian Medicare)
- Required field validation
- Custom validation messages per country

### Performance Considerations
- Lazy load validation functions
- Memoize field configurations
- Debounce validation calls
- Optimize re-renders on country changes

## 🔗 Related Tasks
- **Previous**: Task 03 - Create Base Form Components
- **Next**: Task 05 - Add DateOfBirth Field Component
- **Integration**: Task 07 - Restructure PatientDetail Form Layout
- **Related**: Task 08 - Enhance NationalIdField Component
