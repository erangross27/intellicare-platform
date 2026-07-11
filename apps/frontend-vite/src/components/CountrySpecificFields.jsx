/**
 * CountrySpecificFields Component
 * Dynamic component that renders country-specific identification and healthcare fields
 * Supports all 13 countries with proper validation and field types
 */

import React, { useMemo, useCallback } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { getCountryFields, validateField, getFieldError } from '../utils/countryConfig';

const CountrySpecificFields = ({ 
  country, 
  values = {}, 
  onChange, 
  errors = {}, 
  disabled = false 
}) => {
  const { t, isRTL } = useLanguage();

  // Get field configurations for the selected country
  const countryFields = useMemo(() => {
    return country ? getCountryFields(country) : {};
  }, [country]);

  // Memoized styles
  const containerStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    direction: isRTL ? 'rtl' : 'ltr'
  }), [isRTL]);

  const formGroupStyle = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  }), []);

  const labelStyle = useMemo(() => ({
    fontWeight: '600',
    fontSize: '0.875rem',
    color: '#374151',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const inputStyle = useMemo(() => ({
    padding: '0.75rem',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '1rem',
    backgroundColor: disabled ? '#f9fafb' : '#ffffff',
    color: disabled ? '#6b7280' : '#111827',
    cursor: disabled ? 'not-allowed' : 'text',
    transition: 'all 0.2s ease',
    textAlign: isRTL ? 'right' : 'left',
    direction: isRTL ? 'rtl' : 'ltr'
  }), [disabled, isRTL]);

  const selectStyle = useMemo(() => ({
    padding: '0.75rem',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '1rem',
    backgroundColor: disabled ? '#f9fafb' : '#ffffff',
    color: disabled ? '#6b7280' : '#111827',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    textAlign: isRTL ? 'right' : 'left',
    direction: isRTL ? 'rtl' : 'ltr',
    appearance: 'none',
    backgroundImage: isRTL 
      ? `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`
      : `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: isRTL ? 'left 0.75rem center' : 'right 0.75rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1.5em 1.5em',
    paddingRight: isRTL ? '0.75rem' : '3rem',
    paddingLeft: isRTL ? '3rem' : '0.75rem'
  }), [disabled, isRTL]);

  const errorStyle = useMemo(() => ({
    color: '#dc2626',
    fontSize: '0.875rem',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const helpTextStyle = useMemo(() => ({
    color: '#6b7280',
    fontSize: '0.75rem',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const focusStyle = useMemo(() => ({
    outline: 'none',
    borderColor: '#6366f1',
    boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)'
  }), []);

  // Handle field value change
  const handleFieldChange = useCallback((fieldName, value) => {
    if (onChange && !disabled) {
      onChange({
        ...values,
        [fieldName]: value
      });
    }
  }, [onChange, values, disabled]);

  // Handle input focus
  const handleInputFocus = useCallback((e) => {
    if (!disabled) {
      Object.assign(e.target.style, focusStyle);
    }
  }, [disabled, focusStyle]);

  // Handle input blur
  const handleInputBlur = useCallback((e) => {
    const fieldName = e.target.name;
    const hasError = errors[fieldName];
    e.target.style.borderColor = hasError ? '#dc2626' : '#d1d5db';
    e.target.style.boxShadow = 'none';
  }, [errors]);

  // Get input style with error state
  const getInputStyle = useCallback((fieldName, baseStyle) => ({
    ...baseStyle,
    borderColor: errors[fieldName] ? '#dc2626' : '#d1d5db'
  }), [errors]);

  // Format field value for display
  const formatFieldValue = useCallback((fieldName, value, fieldConfig) => {
    if (!value) return '';
    
    // Apply input formatting based on field type and pattern
    if (fieldConfig.inputMode === 'numeric' && fieldConfig.pattern) {
      // Handle specific formatting patterns
      switch (fieldName) {
        case 'socialSecurityNumber':
          // Format US SSN: XXX-XX-XXXX
          return value.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');
        case 'nhsNumber':
          // Format UK NHS: XXX XXX XXXX
          return value.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
        case 'cpfNumber':
          // Format Brazilian CPF: XXX.XXX.XXX-XX
          return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        case 'residentRegistrationNumber':
          // Format Korean RRN: YYMMDD-NNNNNNN
          return value.replace(/(\d{6})(\d{7})/, '$1-$2');
        default:
          return value;
      }
    }
    
    return value;
  }, []);

  // Render text input field
  const renderTextField = useCallback((fieldName, fieldConfig) => {
    const fieldValue = values[fieldName] || '';
    const fieldError = errors[fieldName];
    
    return (
      <div key={fieldName} style={formGroupStyle} className="form-group">
        <label 
          htmlFor={fieldName} 
          style={labelStyle}
        >
          {t(fieldConfig.label)} {fieldConfig.required && '*'}
        </label>
        
        <input
          type="text"
          id={fieldName}
          name={fieldName}
          value={fieldValue}
          onChange={(e) => handleFieldChange(fieldName, e.target.value)}
          onFocus={(e) => {
            e.currentTarget.removeAttribute('readonly');
            handleInputFocus(e);
          }}
          onBlur={handleInputBlur}
          onMouseDown={(e) => e.currentTarget.removeAttribute('readonly')}
          onKeyDown={(e) => e.currentTarget.removeAttribute('readonly')}
          style={getInputStyle(fieldName, inputStyle)}
          placeholder={fieldConfig.placeholder}
          disabled={disabled}
          required={fieldConfig.required}
          maxLength={fieldConfig.maxLength}
          minLength={fieldConfig.minLength}
          pattern={fieldConfig.pattern}
          inputMode={fieldConfig.inputMode}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-autocomplete="none"
          data-lpignore="true"
          data-1p-ignore
          data-bw-ignore
          readOnly
        />
        
        {fieldConfig.helpText && (
          <div style={helpTextStyle} className="help-text">
            {fieldConfig.helpText}
          </div>
        )}
        
        {/* Field validation errors removed */}
      </div>
    );
  }, [values, errors, disabled, t, formGroupStyle, labelStyle, inputStyle, helpTextStyle, errorStyle, handleFieldChange, handleInputFocus, handleInputBlur, getInputStyle]);

  // Render select dropdown field
  const renderSelectField = useCallback((fieldName, fieldConfig) => {
    const fieldValue = values[fieldName] || '';
    const fieldError = errors[fieldName];
    
    return (
      <div key={fieldName} style={formGroupStyle} className="form-group">
        <label 
          htmlFor={fieldName} 
          style={labelStyle}
        >
          {t(fieldConfig.label)} {fieldConfig.required && '*'}
        </label>
        
        <select
          id={fieldName}
          name={fieldName}
          value={fieldValue}
          onChange={(e) => handleFieldChange(fieldName, e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          style={getInputStyle(fieldName, selectStyle)}
          disabled={disabled}
          required={fieldConfig.required}
        >
          <option value="">
            {`${t('select')} ${t(fieldConfig.label)}`}
          </option>
          
          {fieldConfig.options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        
        {fieldConfig.helpText && (
          <div style={helpTextStyle} className="help-text">
            {fieldConfig.helpText}
          </div>
        )}
        
        {/* Field validation errors removed */}
      </div>
    );
  }, [values, errors, disabled, t, formGroupStyle, labelStyle, selectStyle, helpTextStyle, errorStyle, handleFieldChange, handleInputFocus, handleInputBlur, getInputStyle]);

  // Render field based on type
  const renderField = useCallback((fieldName, fieldConfig) => {
    switch (fieldConfig.type) {
      case 'select':
        return renderSelectField(fieldName, fieldConfig);
      case 'text':
      default:
        return renderTextField(fieldName, fieldConfig);
    }
  }, [renderTextField, renderSelectField]);

  // If no country is selected, show placeholder
  if (!country) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        color: '#6b7280',
        fontStyle: 'italic',
        direction: isRTL ? 'rtl' : 'ltr'
      }}>
        {t('selectCountry')} to see identification and healthcare fields
      </div>
    );
  }

  // If no fields are configured for this country, show message
  if (Object.keys(countryFields).length === 0) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        color: '#6b7280',
        direction: isRTL ? 'rtl' : 'ltr'
      }}>
        No additional fields required for {country}
      </div>
    );
  }

  return (
    <div style={containerStyle} className="country-specific-fields">
      {Object.entries(countryFields).map(([fieldName, fieldConfig]) => 
        renderField(fieldName, fieldConfig)
      )}
    </div>
  );
};

// Validation helper function for country-specific fields
export const validateCountrySpecificFields = (country, values, t) => {
  const errors = {};
  const countryFields = getCountryFields(country);
  
  Object.entries(countryFields).forEach(([fieldName, fieldConfig]) => {
    const fieldValue = values[fieldName];
    const fieldError = getFieldError(country, fieldName, fieldValue, t);
    
    if (fieldError) {
      errors[fieldName] = fieldError;
    }
  });
  
  return errors;
};

export default CountrySpecificFields;
