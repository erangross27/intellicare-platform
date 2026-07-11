/**
 * PhoneNumberField Component
 * Country-aware phone number input with automatic country code selection
 * Supports proper formatting and validation based on country
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';

const PhoneNumberField = ({ 
  value = '', 
  onChange, 
  country = '', 
  disabled = false,
  required = true,
  error = null
}) => {
  const { t, isRTL } = useLanguage();

  // Country code mapping
  const countryPhoneCodes = useMemo(() => ({
    'Israel': '+972',
    'United States': '+1',
    'Canada': '+1',
    'United Kingdom': '+44',
    'Germany': '+49',
    'France': '+33',
    'Spain': '+34',
    'Brazil': '+55',
    'Argentina': '+54',
    'Japan': '+81',
    'South Korea': '+82',
    'Australia': '+61',
    'New Zealand': '+64'
  }), []);

  // Phone number formatting patterns
  const phoneFormats = useMemo(() => ({
    'Israel': {
      placeholder: '50-123-4567',
      pattern: /^(\d{2})(\d{3})(\d{4})$/,
      format: '$1-$2-$3',
      maxLength: 10
    },
    'United States': {
      placeholder: '(555) 123-4567',
      pattern: /^(\d{3})(\d{3})(\d{4})$/,
      format: '($1) $2-$3',
      maxLength: 10
    },
    'Canada': {
      placeholder: '(555) 123-4567',
      pattern: /^(\d{3})(\d{3})(\d{4})$/,
      format: '($1) $2-$3',
      maxLength: 10
    },
    'United Kingdom': {
      placeholder: '20 1234 5678',
      pattern: /^(\d{2})(\d{4})(\d{4})$/,
      format: '$1 $2 $3',
      maxLength: 10
    },
    'Germany': {
      placeholder: '30 12345678',
      pattern: /^(\d{2})(\d{8})$/,
      format: '$1 $2',
      maxLength: 10
    },
    'France': {
      placeholder: '1 23 45 67 89',
      pattern: /^(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})$/,
      format: '$1 $2 $3 $4 $5',
      maxLength: 9
    },
    'Spain': {
      placeholder: '612 34 56 78',
      pattern: /^(\d{3})(\d{2})(\d{2})(\d{2})$/,
      format: '$1 $2 $3 $4',
      maxLength: 9
    },
    'Brazil': {
      placeholder: '(11) 91234-5678',
      pattern: /^(\d{2})(\d{5})(\d{4})$/,
      format: '($1) $2-$3',
      maxLength: 11
    },
    'Argentina': {
      placeholder: '11 1234-5678',
      pattern: /^(\d{2})(\d{4})(\d{4})$/,
      format: '$1 $2-$3',
      maxLength: 10
    },
    'Japan': {
      placeholder: '90-1234-5678',
      pattern: /^(\d{2})(\d{4})(\d{4})$/,
      format: '$1-$2-$3',
      maxLength: 10
    },
    'South Korea': {
      placeholder: '10-1234-5678',
      pattern: /^(\d{2})(\d{4})(\d{4})$/,
      format: '$1-$2-$3',
      maxLength: 10
    },
    'Australia': {
      placeholder: '412 345 678',
      pattern: /^(\d{3})(\d{3})(\d{3})$/,
      format: '$1 $2 $3',
      maxLength: 9
    },
    'New Zealand': {
      placeholder: '21 123 4567',
      pattern: /^(\d{2})(\d{3})(\d{4})$/,
      format: '$1 $2 $3',
      maxLength: 9
    }
  }), []);

  // Get current country code and format
  const countryCode = countryPhoneCodes[country] || '';
  const phoneFormat = phoneFormats[country] || phoneFormats['United States'];

  // Parse current value to separate country code and number
  const parsePhoneValue = useCallback((phoneValue) => {
    if (!phoneValue) return { countryCode: '', number: '' };
    
    // Check if value starts with a country code
    for (const [countryName, code] of Object.entries(countryPhoneCodes)) {
      if (phoneValue.startsWith(code)) {
        return {
          countryCode: code,
          number: phoneValue.slice(code.length).replace(/^\s+/, '')
        };
      }
    }
    
    // If no country code found, assume it's just the number
    return { countryCode: '', number: phoneValue };
  }, [countryPhoneCodes]);

  const { number: currentNumber } = parsePhoneValue(value);

  // Format phone number based on country
  const formatPhoneNumber = useCallback((input) => {
    const digitsOnly = input.replace(/\D/g, '');
    
    if (digitsOnly.length === 0) return '';
    
    const format = phoneFormats[country] || phoneFormats['United States'];
    
    if (digitsOnly.length <= format.maxLength && format.pattern.test(digitsOnly)) {
      return digitsOnly.replace(format.pattern, format.format);
    }
    
    return digitsOnly.slice(0, format.maxLength);
  }, [country, phoneFormats]);

  // Handle phone number change
  const handlePhoneChange = useCallback((e) => {
    const input = e.target.value;
    const formattedNumber = formatPhoneNumber(input);
    const fullPhoneNumber = countryCode ? `${countryCode} ${formattedNumber}` : formattedNumber;
    
    if (onChange) {
      onChange(fullPhoneNumber);
    }
  }, [countryCode, formatPhoneNumber, onChange]);

  // Update phone number when country changes
  useEffect(() => {
    if (country && countryCode && currentNumber) {
      const formattedNumber = formatPhoneNumber(currentNumber);
      const fullPhoneNumber = `${countryCode} ${formattedNumber}`;
      if (onChange && fullPhoneNumber !== value) {
        onChange(fullPhoneNumber);
      }
    }
  }, [country, countryCode, currentNumber, formatPhoneNumber, onChange, value]);

  // Styles
  const containerStyle = useMemo(() => ({
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

  const inputContainerStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    border: `2px solid ${error ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: disabled ? '#f9fafb' : 'white',
    direction: isRTL ? 'rtl' : 'ltr'
  }), [error, disabled, isRTL]);

  const countryCodeStyle = useMemo(() => ({
    padding: '0.75rem',
    backgroundColor: '#f3f4f6',
    borderRight: isRTL ? 'none' : '1px solid #d1d5db',
    borderLeft: isRTL ? '1px solid #d1d5db' : 'none',
    fontSize: '1rem',
    fontWeight: '500',
    color: '#374151',
    minWidth: '60px',
    textAlign: 'center'
  }), [isRTL]);

  const inputStyle = useMemo(() => ({
    flex: 1,
    padding: '0.75rem',
    border: 'none',
    outline: 'none',
    fontSize: '1rem',
    backgroundColor: 'transparent',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const errorStyle = useMemo(() => ({
    color: '#dc2626',
    fontSize: '0.875rem',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  return (
    <div style={containerStyle} className="phone-number-field">
      <label style={labelStyle}>
        {t('phone')} {required && '*'}
      </label>
      
      <div style={inputContainerStyle}>
        {countryCode && (
          <div style={countryCodeStyle}>
            {countryCode}
          </div>
        )}
        
        <input
          type="text"
          inputMode="tel"
          value={currentNumber}
          onChange={handlePhoneChange}
          placeholder={phoneFormat.placeholder}
          disabled={disabled || !country}
          required={required}
          style={inputStyle}
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-autocomplete="none"
          data-lpignore="true"
          data-1p-ignore
          data-bw-ignore
          data-form-type="other"
          data-no-autofill="true"
        />
      </div>
      
      {error && (
        <div style={errorStyle} className="error-message">
          {error}
        </div>
      )}
      
      {!country && (
        <div style={{ ...errorStyle, color: '#6b7280' }}>
          {t('selectCountryFirst')}
        </div>
      )}
    </div>
  );
};

export default PhoneNumberField;
