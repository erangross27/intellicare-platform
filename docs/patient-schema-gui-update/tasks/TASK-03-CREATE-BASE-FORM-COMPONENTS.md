# Task 03: Create Base Form Components

## 📋 Task Overview
**Epic**: Patient Schema GUI Update  
**Sprint**: Phase 1 - Infrastructure  
**Estimated Time**: 8 hours  
**Priority**: High  
**Assignee**: Developer  

## 🎯 Objective
Create reusable React components for the new form sections and fields, including separate firstName/lastName inputs, address fields, country selector, and status selector.

## 📝 Description
As a developer, I need modular, reusable components for the patient form so that the code is maintainable and consistent across the application.

## ✅ Acceptance Criteria
- [ ] Create `NameFields.js` component with separate firstName/lastName inputs
- [ ] Create `AddressFields.js` component for street, city, zipCode
- [ ] Create `StatusSelector.js` component for patient status
- [ ] Create `CountrySelector.js` component for country selection
- [ ] Add proper prop validation and TypeScript support
- [ ] Include responsive design for all components
- [ ] Add accessibility attributes (ARIA labels, etc.)
- [ ] Implement proper error handling and display
- [ ] Support for both controlled and uncontrolled inputs

## 🔧 Technical Requirements

### Files to Create
- `frontend-vite/src/components/NameFields.js`
- `frontend-vite/src/components/AddressFields.js`
- `frontend-vite/src/components/StatusSelector.js`
- `frontend-vite/src/components/CountrySelector.js`

## Component Specifications

### 1. NameFields Component

**File**: `frontend-vite/src/components/NameFields.js`

```javascript
import React from 'react';
import { useLanguage } from '../config/languagesStatic';

const NameFields = ({ 
  firstName, 
  lastName, 
  onChange, 
  errors = {}, 
  required = true,
  disabled = false,
  autoComplete = true 
}) => {
  const { t } = useLanguage();

  const handleFirstNameChange = (e) => {
    onChange({
      firstName: e.target.value,
      lastName: lastName || ''
    });
  };

  const handleLastNameChange = (e) => {
    onChange({
      firstName: firstName || '',
      lastName: e.target.value
    });
  };

  return (
    <div className="name-fields">
      <div className="form-group">
        <label htmlFor="firstName">
          {t('firstName')} {required && '*'}
        </label>
        <input
          type="text"
          id="firstName"
          name="firstName"
          value={firstName || ''}
          onChange={handleFirstNameChange}
          className={`form-control ${errors.firstName ? 'error' : ''}`}
          placeholder={t('enterFirstName')}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete ? 'given-name' : 'off'}
          aria-describedby={errors.firstName ? 'firstName-error' : undefined}
          maxLength={50}
        />
        {errors.firstName && (
          <div id="firstName-error" className="error-message" role="alert">
            {errors.firstName}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="lastName">
          {t('lastName')} {required && '*'}
        </label>
        <input
          type="text"
          id="lastName"
          name="lastName"
          value={lastName || ''}
          onChange={handleLastNameChange}
          className={`form-control ${errors.lastName ? 'error' : ''}`}
          placeholder={t('enterLastName')}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete ? 'family-name' : 'off'}
          aria-describedby={errors.lastName ? 'lastName-error' : undefined}
          maxLength={50}
        />
        {errors.lastName && (
          <div id="lastName-error" className="error-message" role="alert">
            {errors.lastName}
          </div>
        )}
      </div>
    </div>
  );
};

export default NameFields;
```

### 2. AddressFields Component

**File**: `frontend-vite/src/components/AddressFields.js`

```javascript
import React from 'react';
import { useLanguage } from '../config/languagesStatic';

const AddressFields = ({ 
  values = {}, 
  onChange, 
  errors = {}, 
  required = false,
  disabled = false 
}) => {
  const { t } = useLanguage();

  const handleFieldChange = (field, value) => {
    onChange({
      ...values,
      [field]: value
    });
  };

  return (
    <div className="address-fields">
      <div className="form-group">
        <label htmlFor="street">
          {t('streetAddress')} {required && '*'}
        </label>
        <input
          type="text"
          id="street"
          name="street"
          value={values.street || ''}
          onChange={(e) => handleFieldChange('street', e.target.value)}
          className={`form-control ${errors.street ? 'error' : ''}`}
          placeholder={t('enterStreetAddress')}
          required={required}
          disabled={disabled}
          autoComplete="street-address"
          aria-describedby={errors.street ? 'street-error' : undefined}
          maxLength={100}
        />
        {errors.street && (
          <div id="street-error" className="error-message" role="alert">
            {errors.street}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="city">
          {t('city')} {required && '*'}
        </label>
        <input
          type="text"
          id="city"
          name="city"
          value={values.city || ''}
          onChange={(e) => handleFieldChange('city', e.target.value)}
          className={`form-control ${errors.city ? 'error' : ''}`}
          placeholder={t('enterCity')}
          required={required}
          disabled={disabled}
          autoComplete="address-level2"
          aria-describedby={errors.city ? 'city-error' : undefined}
          maxLength={50}
        />
        {errors.city && (
          <div id="city-error" className="error-message" role="alert">
            {errors.city}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="zipCode">
          {t('zipCode')} {required && '*'}
        </label>
        <input
          type="text"
          id="zipCode"
          name="zipCode"
          value={values.zipCode || ''}
          onChange={(e) => handleFieldChange('zipCode', e.target.value)}
          className={`form-control ${errors.zipCode ? 'error' : ''}`}
          placeholder={t('enterZipCode')}
          required={required}
          disabled={disabled}
          autoComplete="postal-code"
          aria-describedby={errors.zipCode ? 'zipCode-error' : undefined}
          maxLength={20}
        />
        {errors.zipCode && (
          <div id="zipCode-error" className="error-message" role="alert">
            {errors.zipCode}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressFields;
```

### 3. StatusSelector Component

**File**: `frontend-vite/src/components/StatusSelector.js`

```javascript
import React from 'react';
import { useLanguage } from '../config/languagesStatic';

const StatusSelector = ({ 
  value, 
  onChange, 
  disabled = false, 
  required = true,
  showIcon = true 
}) => {
  const { t } = useLanguage();

  const statusOptions = [
    { value: 'active', label: t('active'), icon: '✅', color: '#28a745' },
    { value: 'inactive', label: t('inactive'), icon: '⏸️', color: '#dc3545' },
    { value: 'archived', label: t('archived'), icon: '📦', color: '#6c757d' }
  ];

  const selectedOption = statusOptions.find(opt => opt.value === value);

  return (
    <div className="form-group">
      <label htmlFor="status">
        {t('status')} {required && '*'}
      </label>
      
      <div className="status-selector-container">
        <select
          id="status"
          name="status"
          value={value || 'active'}
          onChange={(e) => onChange(e.target.value)}
          className="form-control status-select"
          disabled={disabled}
          required={required}
          aria-describedby="status-help"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {showIcon ? `${option.icon} ` : ''}{option.label}
            </option>
          ))}
        </select>
        
        {selectedOption && (
          <div 
            className="status-indicator"
            style={{ color: selectedOption.color }}
            aria-hidden="true"
          >
            {showIcon && selectedOption.icon} {selectedOption.label}
          </div>
        )}
      </div>
      
      <small id="status-help" className="form-text text-muted">
        {t('patientStatus')}
      </small>
    </div>
  );
};

export default StatusSelector;
```

### 4. CountrySelector Component

**File**: `frontend-vite/src/components/CountrySelector.js`

```javascript
import React from 'react';
import { useLanguage } from '../config/languagesStatic';
import { getSupportedCountries } from '../utils/countryConfig';

const CountrySelector = ({ 
  value, 
  onChange, 
  disabled = false, 
  required = true,
  showFlags = true 
}) => {
  const { t } = useLanguage();
  const countries = getSupportedCountries();

  // Country flag emojis
  const countryFlags = {
    'Israel': '🇮🇱',
    'United States': '🇺🇸',
    'Canada': '🇨🇦',
    'United Kingdom': '🇬🇧',
    'Germany': '🇩🇪',
    'France': '🇫🇷',
    'Spain': '🇪🇸',
    'Brazil': '🇧🇷',
    'Argentina': '🇦🇷',
    'Japan': '🇯🇵',
    'South Korea': '🇰🇷',
    'Australia': '🇦🇺',
    'New Zealand': '🇳🇿'
  };

  const getCountryDisplay = (country) => {
    const translationKey = country.toLowerCase().replace(/\s+/g, '');
    const translatedName = t(translationKey) || country;
    const flag = showFlags ? countryFlags[country] || '🌍' : '';
    return `${flag} ${translatedName}`.trim();
  };

  return (
    <div className="form-group">
      <label htmlFor="country">
        {t('country')} {required && '*'}
      </label>
      
      <select
        id="country"
        name="country"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="form-control country-select"
        disabled={disabled}
        required={required}
        aria-describedby="country-help"
      >
        <option value="">
          {showFlags ? '🌍 ' : ''}{t('selectCountry')}
        </option>
        {countries.map(country => (
          <option key={country} value={country}>
            {getCountryDisplay(country)}
          </option>
        ))}
      </select>
      
      <small id="country-help" className="form-text text-muted">
        {t('selectCountryForSpecificFields')}
      </small>
    </div>
  );
};

export default CountrySelector;
```

## 🎨 CSS Requirements

### New CSS Classes to Add
```css
/* Name Fields */
.name-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* Address Fields */
.address-fields {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 1rem;
}

/* Status Selector */
.status-selector-container {
  position: relative;
}

.status-indicator {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.status-select {
  padding-left: 2.5rem; /* Space for icon */
}

/* Country Selector */
.country-select {
  padding-left: 2.5rem; /* Space for flag */
}

/* Error States */
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
}

/* Responsive Design */
@media (max-width: 768px) {
  .name-fields,
  .address-fields {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

/* RTL Support */
[dir="rtl"] .status-select,
[dir="rtl"] .country-select {
  padding-left: 0.75rem;
  padding-right: 2.5rem;
}
```

## 🧪 Testing Requirements

### Component Tests to Create
```javascript
// NameFields.test.js
describe('NameFields', () => {
  it('renders firstName and lastName inputs', () => {});
  it('calls onChange with correct data structure', () => {});
  it('displays validation errors', () => {});
  it('supports required and disabled states', () => {});
});

// AddressFields.test.js
describe('AddressFields', () => {
  it('renders all address input fields', () => {});
  it('updates address data correctly', () => {});
  it('handles validation errors', () => {});
});

// StatusSelector.test.js
describe('StatusSelector', () => {
  it('renders all status options', () => {});
  it('displays status indicator', () => {});
  it('handles status changes', () => {});
});

// CountrySelector.test.js
describe('CountrySelector', () => {
  it('renders all supported countries', () => {});
  it('displays country flags', () => {});
  it('translates country names', () => {});
});
```

## 📦 Dependencies
**Requires**: 
- Task 01 - Update Translation Files
- Task 02 - Create Country Configuration Utility

**Blocks**: 
- Task 04 - Create CountrySpecificFields Component
- Task 07 - Restructure PatientDetail Form Layout

## ✨ Definition of Done
- [ ] All four components created and functional
- [ ] Proper prop validation implemented
- [ ] Responsive design works on all screen sizes
- [ ] Accessibility attributes added (ARIA labels, roles)
- [ ] Error handling and display implemented
- [ ] CSS styling completed and tested
- [ ] Unit tests written with good coverage
- [ ] Components work with both languages (EN/HE)
- [ ] RTL layout supported for Hebrew
- [ ] Code review completed
- [ ] Integration tested with existing form structure

## 📚 Additional Notes
- Use React.forwardRef if ref forwarding is needed
- Consider memoization with React.memo for performance
- Ensure components are properly typed if using TypeScript
- Test keyboard navigation and screen reader compatibility
- Verify components work with form libraries (if used)

## 🔗 Related Tasks
- **Previous**: Task 02 - Create Country Configuration Utility
- **Next**: Task 04 - Create CountrySpecificFields Component
- **Integration**: Task 07 - Restructure PatientDetail Form Layout
