/**
 * DateOfBirthField Component
 * Date picker component with age auto-calculation and proper validation
 * Uses custom DatePicker component with calendar interface
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';
import DatePicker from './DatePicker';

const DateOfBirthField = ({
  value = '',
  onChange,
  onAgeChange,
  disabled = false,
  required = true,
  error = null,
  showAge = true,
  maxAge = 150,
  minAge = 0,
  country = 'Israel' // Add country prop for date format
}) => {
  const { t, isRTL } = useLanguage();

  // Country-specific date formats
  const getDateFormat = useCallback((country) => {
    const formats = {
      'United States': {
        format: 'MM/DD/YYYY',
        placeholder: 'MM/DD/YYYY',
        inputType: 'text', // Use text for custom formatting
        pattern: /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/
      },
      'Canada': {
        format: 'MM/DD/YYYY',
        placeholder: 'MM/DD/YYYY',
        inputType: 'text',
        pattern: /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/
      },
      'United Kingdom': {
        format: 'DD/MM/YYYY',
        placeholder: 'DD/MM/YYYY',
        inputType: 'text',
        pattern: /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/
      },
      'Germany': {
        format: 'DD.MM.YYYY',
        placeholder: 'DD.MM.YYYY',
        inputType: 'text',
        pattern: /^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/
      },
      'France': {
        format: 'DD/MM/YYYY',
        placeholder: 'DD/MM/YYYY',
        inputType: 'text',
        pattern: /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/
      },
      'Israel': {
        format: 'DD/MM/YYYY',
        placeholder: 'DD/MM/YYYY',
        inputType: 'text',
        pattern: /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/
      }
    };

    // Default to DD/MM/YYYY for most countries
    return formats[country] || formats['Israel'];
  }, []);

  const dateFormat = useMemo(() => getDateFormat(country), [country, getDateFormat]);

  // Format date for display based on country
  const formatDateForDisplay = useCallback((dateValue) => {
    if (!dateValue) return '';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue; // Return as-is if invalid

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    switch (dateFormat.format) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
      case 'DD/MM/YYYY':
      default:
        return `${day}/${month}/${year}`;
    }
  }, [dateFormat]);

  // Parse display format to ISO date
  const parseDisplayDate = useCallback((displayValue) => {
    if (!displayValue) return '';

    let day, month, year;

    if (dateFormat.format === 'MM/DD/YYYY') {
      const parts = displayValue.split('/');
      if (parts.length === 3) {
        month = parts[0];
        day = parts[1];
        year = parts[2];
      }
    } else if (dateFormat.format === 'DD.MM.YYYY') {
      const parts = displayValue.split('.');
      if (parts.length === 3) {
        day = parts[0];
        month = parts[1];
        year = parts[2];
      }
    } else { // DD/MM/YYYY
      const parts = displayValue.split('/');
      if (parts.length === 3) {
        day = parts[0];
        month = parts[1];
        year = parts[2];
      }
    }

    if (day && month && year) {
      // Create ISO date string (YYYY-MM-DD)
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    return displayValue;
  }, [dateFormat]);

  // Calculate age from date of birth
  const calculateAge = useCallback((dateOfBirth) => {
    if (!dateOfBirth) return null;
    
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    
    // Check if date is valid
    if (isNaN(birthDate.getTime())) return null;
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 0 ? age : null;
  }, []);

  // Get current age
  const currentAge = useMemo(() => calculateAge(value), [value, calculateAge]);

  // Validation
  const isValidDate = useCallback((dateString) => {
    if (!dateString) return required ? false : true;
    
    const date = new Date(dateString);
    const today = new Date();
    
    // Check if date is valid
    if (isNaN(date.getTime())) return false;
    
    // Check if date is not in the future
    if (date > today) return false;
    
    // Check age limits
    const age = calculateAge(dateString);
    if (age !== null && (age < minAge || age > maxAge)) return false;
    
    return true;
  }, [required, calculateAge, minAge, maxAge]);

  // Get validation error message
  const getValidationError = useCallback(() => {
    if (!value && required) {
      return t('fieldRequired');
    }
    
    if (value && !isValidDate(value)) {
      const date = new Date(value);
      const today = new Date();
      
      if (isNaN(date.getTime())) {
        return t('invalidDateOfBirth');
      }
      
      if (date > today) {
        return 'Date of birth cannot be in the future';
      }
      
      const age = calculateAge(value);
      if (age !== null && age > maxAge) {
        return `Age cannot exceed ${maxAge} years`;
      }
      
      if (age !== null && age < minAge) {
        return `Age cannot be less than ${minAge} years`;
      }
    }
    
    return null;
  }, [value, required, isValidDate, t, calculateAge, maxAge, minAge]);

  // Disable validation error messages (no red error display)
  const validationError = null;

  // Memoized styles
  const containerStyle = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    direction: isRTL ? 'rtl' : 'ltr'
  }), [isRTL]);

  const labelStyle = useMemo(() => ({
    fontWeight: '600',
    fontSize: '0.875rem',
    color: '#374151',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const inputContainerStyle = useMemo(() => ({
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start'
  }), []);

  const inputStyle = useMemo(() => ({
    flex: '1',
    padding: '0.75rem',
    border: `2px solid ${validationError ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '8px',
    fontSize: '1rem',
    backgroundColor: disabled ? '#f9fafb' : '#ffffff',
    color: disabled ? '#6b7280' : '#111827',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    textAlign: isRTL ? 'right' : 'left',
    direction: isRTL ? 'rtl' : 'ltr'
  }), [disabled, validationError, isRTL]);

  const ageDisplayStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: '#f3f4f6',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '500',
    color: '#374151',
    minWidth: '100px',
    justifyContent: 'center'
  }), []);

  const errorStyle = useMemo(() => ({
    color: '#dc2626',
    fontSize: '0.875rem',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const focusStyle = useMemo(() => ({
    outline: 'none',
    borderColor: '#6366f1',
    boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)'
  }), []);

  // Handle date change
  const handleChange = useCallback((e) => {
    const newDate = e.target.value;
    
    if (onChange) {
      onChange(newDate);
    }
    
    // Calculate and notify age change
    if (onAgeChange) {
      const age = calculateAge(newDate);
      onAgeChange(age);
    }
  }, [onChange, onAgeChange, calculateAge]);

  const handleFocus = useCallback((e) => {
    if (!disabled) {
      Object.assign(e.target.style, focusStyle);
    }
  }, [disabled, focusStyle]);

  const handleBlur = useCallback((e) => {
    e.target.style.borderColor = validationError ? '#dc2626' : '#d1d5db';
    e.target.style.boxShadow = 'none';
  }, [validationError]);

  // Format date for display
  const formatDateForInput = useCallback((dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    // Return in YYYY-MM-DD format for HTML date input
    return date.toISOString().split('T')[0];
  }, []);

  // Set max date to today
  const maxDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Set min date based on max age
  const minDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - maxAge);
    return date.toISOString().split('T')[0];
  }, [maxAge]);

  // Update age when value changes
  useEffect(() => {
    if (onAgeChange && value) {
      const age = calculateAge(value);
      onAgeChange(age);
    }
  }, [value, onAgeChange, calculateAge]);

  return (
    <div style={containerStyle} className="date-of-birth-field">
      <label
        htmlFor="dateOfBirth"
        style={labelStyle}
      >
        {t('dateOfBirth')} {required && '*'}
      </label>

      <div style={inputContainerStyle}>
        <DatePicker
          value={value}
          onChange={(date) => {
            if (onChange) {
              onChange(date);
            }
            // Calculate and notify age change
            if (onAgeChange) {
              const age = calculateAge(date);
              onAgeChange(age);
            }
          }}
          disabled={disabled}
          required={required}
          country={country}
          placeholder={dateFormat.placeholder}
          minAge={minAge}
          maxAge={maxAge}
          error={null} // Remove validation errors as requested
        />

        {showAge && (
          <div style={ageDisplayStyle} className="age-display">
            {currentAge !== null ? (
              <>
                {currentAge} {t('yearsOld') || 'years'}
              </>
            ) : (
              <span style={{ color: '#9ca3af' }}>
                {t('age')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Utility function to calculate age from date of birth
export const calculateAgeFromDate = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  
  if (isNaN(birthDate.getTime())) return null;
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : null;
};

// Validation function for date of birth
export const validateDateOfBirth = (dateOfBirth, t, required = true, maxAge = 150, minAge = 0) => {
  if (!dateOfBirth && required) {
    return t('fieldRequired');
  }
  
  if (!dateOfBirth && !required) {
    return null;
  }
  
  const date = new Date(dateOfBirth);
  const today = new Date();
  
  if (isNaN(date.getTime())) {
    return t('invalidDateOfBirth');
  }
  
  if (date > today) {
    return 'Date of birth cannot be in the future';
  }
  
  const age = calculateAgeFromDate(dateOfBirth);
  if (age !== null && age > maxAge) {
    return `Age cannot exceed ${maxAge} years`;
  }
  
  if (age !== null && age < minAge) {
    return `Age cannot be less than ${minAge} years`;
  }
  
  return null;
};

export default DateOfBirthField;
