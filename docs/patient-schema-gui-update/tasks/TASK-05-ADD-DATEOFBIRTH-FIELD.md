# Task 05: Add DateOfBirth Field Component

## 📋 Task Overview
**Epic**: Patient Schema GUI Update  
**Sprint**: Phase 2 - Country-Specific Components  
**Estimated Time**: 4 hours  
**Priority**: Medium  
**Assignee**: Developer  

## 🎯 Objective
Create or enhance a DateOfBirth field component that replaces manual age entry with proper date selection, auto-calculates age, and integrates with the existing CustomDatePicker component.

## 📝 Description
As a user, I want to enter a patient's date of birth instead of manually calculating and entering age, so that the system has more accurate temporal data and can auto-calculate current age.

## ✅ Acceptance Criteria
- [ ] Create DateOfBirth component or enhance existing CustomDatePicker
- [ ] Auto-calculate age from date of birth in real-time
- [ ] Add proper date validation (not future dates, reasonable age limits)
- [ ] Support both manual entry and picker selection
- [ ] Format dates according to user locale (EN/HE)
- [ ] Integrate seamlessly with existing form structure
- [ ] Maintain backward compatibility with age field
- [ ] Add accessibility features for date input
- [ ] Support keyboard navigation

## 🔧 Technical Requirements

### Option 1: Enhance Existing CustomDatePicker

**File to Modify**: `frontend-vite/src/components/CustomDatePicker.js`

First, let me check the existing CustomDatePicker structure:

```javascript
// Add DateOfBirth-specific functionality to existing component
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';

const DateOfBirthField = ({ 
  value, 
  onChange, 
  onAgeCalculated,
  error,
  required = true,
  disabled = false,
  maxDate = new Date(),
  minDate = new Date(1900, 0, 1)
}) => {
  const { t, currentLanguage } = useLanguage();
  const [calculatedAge, setCalculatedAge] = useState(null);

  // Calculate age from date of birth
  useEffect(() => {
    if (value) {
      const birthDate = new Date(value);
      const today = new Date();
      
      if (birthDate <= today) {
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        setCalculatedAge(age);
        onAgeCalculated && onAgeCalculated(age);
      } else {
        setCalculatedAge(null);
        onAgeCalculated && onAgeCalculated(null);
      }
    } else {
      setCalculatedAge(null);
      onAgeCalculated && onAgeCalculated(null);
    }
  }, [value, onAgeCalculated]);

  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const formatDateForDisplay = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString(
      currentLanguage === 'he' ? 'he-IL' : 'en-US',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
    );
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    onChange(newDate);
  };

  const isValidDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    
    return date instanceof Date && 
           !isNaN(date) && 
           date <= today && 
           date >= minDate;
  };

  return (
    <div className="form-group date-of-birth-field">
      <label htmlFor="dateOfBirth">
        {t('dateOfBirth')} {required && '*'}
      </label>
      
      <div className="date-input-container">
        <input
          type="date"
          id="dateOfBirth"
          name="dateOfBirth"
          value={formatDateForInput(value)}
          onChange={handleDateChange}
          className={`form-control ${error ? 'error' : ''}`}
          required={required}
          disabled={disabled}
          max={formatDateForInput(maxDate)}
          min={formatDateForInput(minDate)}
          aria-describedby="dateOfBirth-help dateOfBirth-age"
        />
        
        {calculatedAge !== null && (
          <div 
            id="dateOfBirth-age" 
            className="calculated-age"
            aria-live="polite"
          >
            {t('age')}: {calculatedAge} {t('years')}
          </div>
        )}
      </div>
      
      {value && (
        <div className="date-display">
          📅 {formatDateForDisplay(value)}
        </div>
      )}
      
      <small id="dateOfBirth-help" className="form-text text-muted">
        {t('selectDateOfBirth')}
      </small>
      
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default DateOfBirthField;
```

### Option 2: Create New Component

**File to Create**: `frontend-vite/src/components/DateOfBirthField.js`

```javascript
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';
import CustomDatePicker from './CustomDatePicker';

const DateOfBirthField = ({ 
  value, 
  onChange, 
  onAgeCalculated,
  error,
  required = true,
  disabled = false 
}) => {
  const { t } = useLanguage();
  const [age, setAge] = useState(null);

  // Age calculation logic here...

  return (
    <div className="date-of-birth-wrapper">
      <CustomDatePicker
        value={value}
        onChange={onChange}
        label={t('dateOfBirth')}
        required={required}
        disabled={disabled}
        error={error}
        maxDate={new Date()}
        minDate={new Date(1900, 0, 1)}
      />
      
      {age !== null && (
        <div className="age-display">
          {t('calculatedAge')}: {age} {t('years')}
        </div>
      )}
    </div>
  );
};

export default DateOfBirthField;
```

## 🎨 CSS Requirements

### Styling for DateOfBirth Field
```css
.date-of-birth-field {
  position: relative;
}

.date-input-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.calculated-age {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #e1bee7;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4a148c;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  animation: fadeIn 0.3s ease-in-out;
}

.calculated-age::before {
  content: "🎂";
  font-size: 1rem;
}

.date-display {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.25rem;
  font-style: italic;
}

.date-input-container input[type="date"] {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease-in-out;
}

.date-input-container input[type="date"]:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
  outline: none;
}

.date-input-container input[type="date"]:invalid {
  border-color: #dc3545;
}

/* Age calculation animation */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* RTL support */
[dir="rtl"] .date-input-container {
  text-align: right;
}

[dir="rtl"] .calculated-age {
  direction: ltr; /* Keep age number LTR */
  text-align: left;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .date-input-container input[type="date"] {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Custom date picker styling */
.date-picker-wrapper {
  position: relative;
}

.date-picker-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #6c757d;
}

[dir="rtl"] .date-picker-icon {
  right: auto;
  left: 0.75rem;
}
```

## 🧪 Testing Requirements

### Unit Tests
```javascript
describe('DateOfBirthField', () => {
  describe('Age Calculation', () => {
    it('calculates correct age for past date', () => {
      // Test with known dates
    });
    
    it('handles leap years correctly', () => {
      // Test with leap year dates
    });
    
    it('calculates age when birthday has not occurred this year', () => {
      // Test edge cases
    });
    
    it('calculates age when birthday has already occurred this year', () => {
      // Test edge cases
    });
  });

  describe('Date Validation', () => {
    it('rejects future dates', () => {
      // Test future date validation
    });
    
    it('accepts reasonable past dates', () => {
      // Test valid date range
    });
    
    it('rejects unreasonably old dates', () => {
      // Test minimum date limits
    });
  });

  describe('Internationalization', () => {
    it('formats dates correctly for English locale', () => {
      // Test EN date formatting
    });
    
    it('formats dates correctly for Hebrew locale', () => {
      // Test HE date formatting
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      // Test accessibility attributes
    });
    
    it('announces age changes to screen readers', () => {
      // Test aria-live regions
    });
  });
});
```

### Integration Tests
```javascript
describe('DateOfBirthField Integration', () => {
  it('integrates with existing form validation', () => {
    // Test form integration
  });
  
  it('works with PatientDetail form state', () => {
    // Test state management
  });
  
  it('maintains backward compatibility with age field', () => {
    // Test legacy support
  });
});
```

## 📦 Dependencies
**Requires**: 
- Task 01 - Update Translation Files
- Existing CustomDatePicker component (if enhancing)

**Blocks**: 
- Task 07 - Restructure PatientDetail Form Layout

**Technical Dependencies**:
- Understanding of existing date handling in the application
- Knowledge of locale-specific date formatting
- Familiarity with accessibility requirements for date inputs

## ✨ Definition of Done
- [ ] DateOfBirth component created or CustomDatePicker enhanced
- [ ] Age calculation works accurately for all scenarios
- [ ] Date validation prevents invalid entries
- [ ] Internationalization works for both EN and HE
- [ ] Accessibility features implemented (ARIA labels, screen reader support)
- [ ] Responsive design works on all devices
- [ ] RTL layout supported for Hebrew
- [ ] Unit tests cover all calculation and validation scenarios
- [ ] Integration tests verify form compatibility
- [ ] Backward compatibility with existing age field maintained
- [ ] Code review completed
- [ ] Performance optimized for real-time calculations

## 📚 Additional Notes

### Age Calculation Edge Cases
- Leap years (Feb 29 birthdays)
- Same day birthdays
- End of month variations
- Time zone considerations
- Century boundaries

### Date Input Considerations
- Native date picker vs custom implementation
- Mobile device compatibility
- Browser support variations
- Accessibility for keyboard navigation
- Screen reader compatibility

### Validation Rules
- Maximum age: 150 years
- Minimum date: January 1, 1900
- Future date prevention
- Invalid date handling
- Required field validation

### Integration Points
- PatientDetail form state
- Age field synchronization
- API data format compatibility
- Existing validation system
- Error message display

## 🔗 Related Tasks
- **Previous**: Task 04 - Create CountrySpecificFields Component
- **Next**: Task 06 - Create FormSection Component
- **Integration**: Task 07 - Restructure PatientDetail Form Layout
- **Related**: Task 09 - Update State Management
