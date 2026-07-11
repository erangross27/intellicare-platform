# Task 11: Implement Field Validation

## 📋 Task Overview
**Priority**: High  
**Type**: Development  
**Estimated Time**: 6 hours  
**Sprint**: 3  

## 🎯 Objective
Implement comprehensive field validation for all patient form fields including country-specific validation rules and real-time validation feedback.

## 📝 Description
As a user, I want proper validation feedback for all form fields so that I can correct any errors before submitting the form and ensure data integrity.

## ✅ Acceptance Criteria
- [ ] All universal fields have appropriate validation
- [ ] Country-specific validation rules are implemented
- [ ] Real-time validation feedback is shown
- [ ] Form submission is prevented with invalid data
- [ ] Helpful error messages are displayed
- [ ] Required field indicators are shown
- [ ] firstName and lastName have proper validation
- [ ] Email and phone validation works correctly
- [ ] Date validation prevents invalid dates
- [ ] Address fields have appropriate validation

## 🔧 Technical Requirements

### Validation Rules

#### Universal Field Validation
```javascript
const universalValidation = {
  firstName: {
    required: true,
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z\u0590-\u05FF\s'-]+$/  // Allow Hebrew, English, spaces, hyphens, apostrophes
  },
  lastName: {
    required: true,
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z\u0590-\u05FF\s'-]+$/
  },
  dateOfBirth: {
    required: true,
    type: 'date',
    maxDate: new Date(),  // Cannot be in the future
    minDate: new Date('1900-01-01')  // Reasonable minimum
  },
  email: {
    required: false,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: {
    required: false,
    pattern: /^[\+]?[0-9\s\-\(\)]+$/,
    minLength: 7,
    maxLength: 20
  },
  street: {
    required: false,
    maxLength: 100
  },
  city: {
    required: false,
    maxLength: 50,
    pattern: /^[a-zA-Z\u0590-\u05FF\s'-]+$/
  },
  zipCode: {
    required: false,
    maxLength: 20
  }
};
```

#### Country-Specific Validation
```javascript
const countryValidation = {
  'Israel': {
    nationalId: {
      required: true,
      pattern: /^[0-9]{9}$/,
      customValidator: validateIsraeliId
    },
    healthFund: {
      required: true,
      enum: ['מכבי', 'כללית', 'מאוחדת', 'לאומית']
    }
  },
  'United States': {
    socialSecurityNumber: {
      required: true,
      pattern: /^[0-9]{3}-[0-9]{2}-[0-9]{4}$/,
      customValidator: validateSSN
    }
  }
  // ... other countries
};
```

### Validation Implementation
```javascript
const validateField = (fieldName, value, fieldConfig) => {
  const errors = [];
  
  // Required validation
  if (fieldConfig.required && (!value || value.toString().trim() === '')) {
    return t('fieldRequired');
  }
  
  // Skip other validations if field is empty and not required
  if (!value || value.toString().trim() === '') {
    return null;
  }
  
  // Length validation
  if (fieldConfig.minLength && value.length < fieldConfig.minLength) {
    return t('fieldTooShort', { min: fieldConfig.minLength });
  }
  
  if (fieldConfig.maxLength && value.length > fieldConfig.maxLength) {
    return t('fieldTooLong', { max: fieldConfig.maxLength });
  }
  
  // Pattern validation
  if (fieldConfig.pattern && !fieldConfig.pattern.test(value)) {
    return t('invalidFormat');
  }
  
  // Date validation
  if (fieldConfig.type === 'date') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return t('invalidDate');
    }
    
    if (fieldConfig.maxDate && date > fieldConfig.maxDate) {
      return t('dateTooRecent');
    }
    
    if (fieldConfig.minDate && date < fieldConfig.minDate) {
      return t('dateTooOld');
    }
  }
  
  // Enum validation
  if (fieldConfig.enum && !fieldConfig.enum.includes(value)) {
    return t('invalidSelection');
  }
  
  // Custom validation
  if (fieldConfig.customValidator) {
    const customError = fieldConfig.customValidator(value);
    if (customError) return customError;
  }
  
  return null;
};
```

## 📁 Files to Modify
- `frontend-vite/src/components/PatientDetail.js`
- `frontend-vite/src/utils/validation.js` (new file)

## 🔗 Dependencies
- **Blocked by**: Task 10 (Update State Management)
- **Blocks**: Task 12 (Update API Integration)

## 🧪 Testing Requirements
- [ ] All validation rules work correctly
- [ ] Error messages display properly
- [ ] Real-time validation functions
- [ ] Form submission prevention works
- [ ] Country-specific validation works
- [ ] Required field indicators show
- [ ] Edge cases handled properly

## 📚 Implementation Details

### Real-Time Validation Hook
```javascript
const useFieldValidation = (fieldName, value, validationConfig) => {
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  
  useEffect(() => {
    const validateAsync = async () => {
      setIsValidating(true);
      const validationError = await validateField(fieldName, value, validationConfig);
      setError(validationError);
      setIsValidating(false);
    };
    
    // Debounce validation
    const timeoutId = setTimeout(validateAsync, 300);
    return () => clearTimeout(timeoutId);
  }, [fieldName, value, validationConfig]);
  
  return { error, isValidating };
};
```

### Form Validation Handler
```javascript
const validateForm = () => {
  const errors = {};
  
  // Validate universal fields
  Object.keys(universalValidation).forEach(fieldName => {
    const value = editForm[fieldName];
    const config = universalValidation[fieldName];
    const error = validateField(fieldName, value, config);
    if (error) errors[fieldName] = error;
  });
  
  // Validate country-specific fields
  if (selectedCountry && editForm.countrySpecific) {
    const countryConfig = getCountryConfig(selectedCountry);
    if (countryConfig) {
      Object.keys(countryConfig.fields).forEach(fieldName => {
        const value = editForm.countrySpecific[fieldName];
        const config = countryConfig.fields[fieldName];
        const error = validateField(fieldName, value, config);
        if (error) errors[fieldName] = error;
      });
    }
  }
  
  setFieldErrors(errors);
  return Object.keys(errors).length === 0;
};
```

### Custom Validators
```javascript
// Israeli ID validation
const validateIsraeliId = (id) => {
  if (!/^[0-9]{9}$/.test(id)) return t('invalidIsraeliIdFormat');
  
  const digits = id.split('').map(Number);
  const checksum = digits.reduce((sum, digit, index) => {
    const multiplier = (index % 2) + 1;
    const product = digit * multiplier;
    return sum + (product > 9 ? product - 9 : product);
  }, 0);
  
  if (checksum % 10 !== 0) return t('invalidIsraeliIdChecksum');
  return null;
};

// US SSN validation
const validateSSN = (ssn) => {
  if (!/^[0-9]{3}-[0-9]{2}-[0-9]{4}$/.test(ssn)) {
    return t('invalidSSNFormat');
  }
  
  // Check for invalid SSN patterns
  const parts = ssn.split('-');
  if (parts[0] === '000' || parts[1] === '00' || parts[2] === '0000') {
    return t('invalidSSNPattern');
  }
  
  return null;
};
```

### Validation Component Integration
```javascript
const ValidatedInput = ({ 
  fieldName, 
  value, 
  onChange, 
  validationConfig, 
  ...inputProps 
}) => {
  const { error, isValidating } = useFieldValidation(fieldName, value, validationConfig);
  
  return (
    <div className="form-group">
      <label htmlFor={fieldName}>
        {inputProps.label}
        {validationConfig.required && <span className="required-indicator"> *</span>}
      </label>
      <input
        {...inputProps}
        id={fieldName}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`form-control ${error ? 'error' : ''} ${isValidating ? 'validating' : ''}`}
      />
      {error && <div className="error-message">{error}</div>}
      {isValidating && <div className="validation-spinner">⏳</div>}
    </div>
  );
};
```

## 🎨 Error Styling
```css
.form-control.error {
  border-color: #dc3545;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
}

.error-message {
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.error-message::before {
  content: "⚠️";
  font-size: 0.75rem;
}

.required-indicator {
  color: #dc3545;
  font-weight: bold;
}

.validation-spinner {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
}

.form-group {
  position: relative;
}
```

## 🌐 Translation Keys Required
```json
{
  "fieldRequired": "This field is required",
  "fieldTooShort": "Must be at least {{min}} characters",
  "fieldTooLong": "Must not exceed {{max}} characters", 
  "invalidFormat": "Invalid format",
  "invalidDate": "Invalid date",
  "dateTooRecent": "Date cannot be in the future",
  "dateTooOld": "Date is too old",
  "invalidSelection": "Invalid selection",
  "invalidIsraeliIdFormat": "Israeli ID must be 9 digits",
  "invalidIsraeliIdChecksum": "Invalid Israeli ID checksum",
  "invalidSSNFormat": "SSN format must be XXX-XX-XXXX",
  "invalidSSNPattern": "Invalid SSN pattern"
}
```

## ✔️ Definition of Done
- [ ] All fields have appropriate validation
- [ ] Real-time validation works
- [ ] Error messages display correctly
- [ ] Form submission prevention works
- [ ] Country-specific validation implemented
- [ ] Custom validators functional
- [ ] Required field indicators show
- [ ] Code review approved
- [ ] Unit tests pass

## 📋 Checklist
- [ ] Create validation utility functions
- [ ] Implement field validation rules
- [ ] Add real-time validation
- [ ] Create custom validators
- [ ] Add error message display
- [ ] Implement form validation
- [ ] Add required field indicators
- [ ] Update styling for errors
- [ ] Test all validation scenarios
