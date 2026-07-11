/**
 * CountrySelector Component
 * Dropdown component for country selection that triggers field configuration updates
 * Supports all 13 countries from PatientSchemaFactory with proper translations
 */

import React, { useMemo, useCallback } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { getSupportedCountries, getCountryConfig } from '../utils/countryConfig';

const CountrySelector = ({ 
  value = '', 
  onChange, 
  disabled = false,
  required = true,
  showFlag = true,
  size = 'medium',
  placeholder = null
}) => {
  const { t, isRTL } = useLanguage();

  // Get supported countries from configuration
  const supportedCountries = useMemo(() => getSupportedCountries(), []);

  // Country flag emojis mapping
  const countryFlags = useMemo(() => ({
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
  }), []);

  // Size configurations
  const sizeConfig = useMemo(() => ({
    small: {
      fontSize: '0.875rem',
      padding: '0.5rem 0.75rem',
      height: '2.5rem'
    },
    medium: {
      fontSize: '1rem',
      padding: '0.75rem 1rem',
      height: '3rem'
    },
    large: {
      fontSize: '1.125rem',
      padding: '1rem 1.25rem',
      height: '3.5rem'
    }
  }), []);

  const currentSize = sizeConfig[size];

  // Memoized styles
  const containerStyle = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    direction: isRTL ? 'rtl' : 'ltr',
    maxWidth: '300px', // Limit width to prevent taking full width
    minWidth: '200px'  // Ensure minimum usable width
  }), [isRTL]);

  const labelStyle = useMemo(() => ({
    fontWeight: '600',
    fontSize: '0.875rem',
    color: '#374151',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const selectStyle = useMemo(() => ({
    width: '100%', // Take full width of container (which is now limited)
    padding: currentSize.padding,
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    fontSize: currentSize.fontSize,
    height: currentSize.height,
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
    paddingRight: isRTL ? currentSize.padding : '3rem',
    paddingLeft: isRTL ? '3rem' : currentSize.padding,
    boxSizing: 'border-box' // Ensure padding is included in width calculation
  }), [currentSize, disabled, isRTL]);

  const focusStyle = useMemo(() => ({
    outline: 'none',
    borderColor: '#6366f1',
    boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)'
  }), []);

  const errorStyle = useMemo(() => ({
    borderColor: '#dc2626',
    boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.1)'
  }), []);

  // Get country display name with translation
  const getCountryDisplayName = useCallback((countryName) => {
    // Remove any country codes in parentheses if they exist
    const cleanName = countryName.replace(/\s*\([A-Z]{2}\)\s*$/, '').trim();
    
    // Convert country name to translation key
    const translationKey = cleanName.toLowerCase().replace(/\s+/g, '');
    const translatedName = t(translationKey);
    
    // If translation exists and is different from key, use it; otherwise use cleaned name
    return translatedName !== translationKey ? translatedName : cleanName;
  }, [t]);

  // Handle country selection change
  const handleChange = useCallback((e) => {
    const selectedCountry = e.target.value;
    
    if (onChange && !disabled) {
      // Get country configuration for additional data
      const countryConfig = getCountryConfig(selectedCountry);
      
      onChange(selectedCountry, {
        countryCode: countryConfig?.countryCode,
        fields: countryConfig?.fields,
        config: countryConfig
      });
    }
  }, [onChange, disabled]);

  const handleFocus = useCallback((e) => {
    if (!disabled) {
      Object.assign(e.target.style, focusStyle);
    }
  }, [disabled, focusStyle]);

  const handleBlur = useCallback((e) => {
    e.target.style.borderColor = '#d1d5db';
    e.target.style.boxShadow = 'none';
  }, []);

  // Sort countries alphabetically by translated name in user's language
  const sortedCountries = useMemo(() => {
    return [...supportedCountries].sort((a, b) => {
      const nameA = getCountryDisplayName(a);
      const nameB = getCountryDisplayName(b);

      // Use locale-specific sorting for proper alphabetical order
      if (isRTL) {
        // Hebrew sorting
        return nameA.localeCompare(nameB, 'he', { numeric: true });
      } else {
        // English sorting
        return nameA.localeCompare(nameB, 'en', { numeric: true });
      }
    });
  }, [supportedCountries, getCountryDisplayName, isRTL]);

  return (
    <div style={containerStyle} className="country-selector">
      <label 
        htmlFor="country" 
        style={labelStyle}
      >
        {t('country')} {required && '*'}
      </label>
      
      <select
        id="country"
        name="country"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={selectStyle}
        disabled={disabled}
        required={required}
      >
        <option value="">
          {placeholder || t('selectCountry')}
        </option>
        
        {sortedCountries.map(country => {
          const displayName = getCountryDisplayName(country);
          
          return (
            <option key={country} value={country}>
              {displayName}
            </option>
          );
        })}
      </select>
    </div>
  );
};

// Country display component for read-only views
export const CountryDisplay = ({ 
  country, 
  showFlag = true, 
  size = 'medium' 
}) => {
  const { t } = useLanguage();

  const countryFlags = useMemo(() => ({
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
  }), []);

  const sizeConfig = useMemo(() => ({
    small: { fontSize: '0.875rem', gap: '0.375rem' },
    medium: { fontSize: '1rem', gap: '0.5rem' },
    large: { fontSize: '1.125rem', gap: '0.625rem' }
  }), []);

  const currentSize = sizeConfig[size];

  const getCountryDisplayName = useCallback((countryName) => {
    if (!countryName) return t('notProvided');
    
    const translationKey = countryName.toLowerCase().replace(/\s+/g, '');
    const translatedName = t(translationKey);
    return translatedName !== translationKey ? translatedName : countryName;
  }, [t]);

  const displayStyle = useMemo(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: currentSize.gap,
    fontSize: currentSize.fontSize,
    fontWeight: '500',
    color: '#374151'
  }), [currentSize]);

  if (!country) {
    return (
      <span style={displayStyle}>
        {t('notProvided')}
      </span>
    );
  }

  const displayName = getCountryDisplayName(country);

  return (
    <span style={displayStyle} className="country-display">
      <span>{displayName}</span>
    </span>
  );
};

export default CountrySelector;
