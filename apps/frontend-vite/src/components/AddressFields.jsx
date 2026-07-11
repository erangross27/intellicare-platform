/**
 * AddressFields Component
 * Reusable component for street, city, and zipCode fields with proper validation
 * Supports both Hebrew RTL and English LTR layouts
 */

import React, { useMemo } from 'react';
import { useLanguage } from '../config/languagesStatic';
import CitySelector from './CitySelector';
import AddressAutocomplete from './AddressAutocomplete';

const AddressFields = ({
  values = {},
  onChange,
  errors = {},
  disabled = false,
  required = false,
  country = '' // Add country prop for city selection
}) => {
  const { t, isRTL } = useLanguage();

  // Memoized styles for performance
  const containerStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
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
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '1rem',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    backgroundColor: disabled ? '#f9fafb' : '#ffffff',
    color: disabled ? '#6b7280' : '#111827',
    textAlign: isRTL ? 'right' : 'left',
    direction: isRTL ? 'rtl' : 'ltr'
  }), [disabled, isRTL]);

  const inputFocusStyle = useMemo(() => ({
    outline: 'none',
    borderColor: '#6366f1',
    boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)'
  }), []);

  const errorStyle = useMemo(() => ({
    color: '#dc2626',
    fontSize: '0.875rem',
    marginTop: '0.25rem',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const handleFieldChange = (fieldName, value) => {
    if (onChange) {
      onChange({
        ...values,
        [fieldName]: value
      });
    }
  };

  const handleInputFocus = (e) => {
    Object.assign(e.target.style, inputFocusStyle);
  };

  const handleInputBlur = (e) => {
    e.target.style.borderColor = errors[e.target.name] ? '#dc2626' : '#d1d5db';
    e.target.style.boxShadow = 'none';
  };

  const getInputStyle = (fieldName) => ({
    ...inputStyle,
    borderColor: errors[fieldName] ? '#dc2626' : '#d1d5db'
  });

  return (
    <div style={containerStyle} className="address-fields">
      {/* City Field - First step: select city */}
      {country ? (
        <CitySelector
          value={values.city || ''}
          onChange={(city) => {
            // When city changes, clear both street and zipCode
            if (onChange) {
              onChange({
                ...values,
                city: city,
                street: '', // Clear street when city changes
                zipCode: '' // Clear zipCode when city changes
              });
            }
          }}
          country={country}
          disabled={disabled}
          required={required}
          error={errors.city}
        />
      ) : (
        <div style={formGroupStyle} className="form-group">
          <label
            htmlFor="city"
            style={labelStyle}
          >
            {t('city')} {required && '*'}
          </label>
          <input
            type="text"
            id="city"
            name="city"
            value={values.city || ''}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            onFocus={(e) => {
              e.currentTarget.removeAttribute('readonly');
              handleInputFocus(e);
            }}
            onBlur={handleInputBlur}
            onMouseDown={(e) => e.currentTarget.removeAttribute('readonly')}
            onKeyDown={(e) => e.currentTarget.removeAttribute('readonly')}
            style={getInputStyle('city')}
            placeholder={t('enterCity')}
            disabled={disabled}
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
        </div>
      )}

      {/* Street Address Field - Second step: search addresses in selected city */}
      <div style={formGroupStyle} className="form-group">
        <label
          htmlFor="street"
          style={labelStyle}
        >
          {t('streetAddress')} {required && '*'}
        </label>
        <AddressAutocomplete
          value={values.street || ''}
          onChange={(address) => {
            // When street input changes manually (not from selection), clear zipCode
            if (onChange) {
              onChange({
                ...values,
                street: address,
                zipCode: '' // Clear zipCode when street is manually edited
              });
            }
          }}
          onAddressSelect={(addressData) => {
            // Auto-fill street with building number and zipCode when address is selected from dropdown
            const streetWithNumber = addressData.street + 
              (addressData.buildingNumberRange ? ' ' + addressData.buildingNumberRange : '');
            
            if (onChange) {
              onChange({
                ...values,
                street: streetWithNumber,
                city: addressData.city, // Keep the city consistent
                zipCode: addressData.zipCode || ''
              });
            }
          }}
          disabled={disabled || !values.city} // Disable until city is selected
          required={required}
          country={country}
          selectedCity={values.city} // Pass selected city to filter addresses
          placeholder={values.city
            ? (t('enterStreetAddress') || (isRTL ? 'חפש כתובת...' : 'Search address...'))
            : (isRTL ? 'בחר עיר תחילה' : 'Select city first')
          }
          error={errors.street}
        />
      </div>

      {/* ZIP/Postal Code Field - Auto-populated from address selection */}
      <div style={formGroupStyle} className="form-group">
        <label
          htmlFor="zipCode"
          style={labelStyle}
        >
          {t('zipCode')} {required && '*'}
          {values.zipCode && (
            <span style={{
              fontSize: '0.75rem',
              color: '#10b981',
              marginLeft: isRTL ? '0' : '0.5rem',
              marginRight: isRTL ? '0.5rem' : '0'
            }}>
              {isRTL ? '(אוטומטי)' : '(Auto)'}
            </span>
          )}
        </label>
        <input
          type="text"
          id="zipCode"
          name="zipCode"
          value={values.zipCode || ''}
          onChange={(e) => handleFieldChange('zipCode', e.target.value)}
          style={{
            ...getInputStyle('zipCode'),
            backgroundColor: values.zipCode ? '#f0fdf4' : (disabled ? '#f9fafb' : '#ffffff'),
            color: values.zipCode ? '#059669' : (disabled ? '#6b7280' : '#111827'),
            fontWeight: values.zipCode ? '600' : '400'
          }}
          placeholder={values.zipCode ? '' : (isRTL ? 'יתמלא אוטומטית' : 'Auto-filled from address')}
          disabled={disabled}
          readOnly={!!values.zipCode} // Read-only when auto-filled
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-autocomplete="none"
          data-lpignore="true"
          data-1p-ignore
          data-bw-ignore
        />
        {values.zipCode && (
          <div style={{
            fontSize: '0.75rem',
            color: '#059669',
            marginTop: '0.25rem',
            textAlign: isRTL ? 'right' : 'left'
          }}>
            {isRTL ? 'מיקוד נקבע אוטומטית על פי הכתובת' : 'Zip code auto-filled from selected address'}
          </div>
        )}
      </div>
    </div>
  );
};

// Validation helper function
export const validateAddressFields = (values, t, required = false) => {
  const errors = {};

  // Street validation
  if (required && (!values.street || values.street.trim() === '')) {
    errors.street = t('fieldRequired');
  } else if (values.street && values.street.length > 100) {
    errors.street = 'Maximum 100 characters allowed';
  }

  // City validation
  if (required && (!values.city || values.city.trim() === '')) {
    errors.city = t('fieldRequired');
  } else if (values.city && values.city.length > 50) {
    errors.city = 'Maximum 50 characters allowed';
  } else if (values.city && !/^[a-zA-Z\u0590-\u05FF\s'-]+$/.test(values.city)) {
    errors.city = 'City name contains invalid characters';
  }

  // ZIP Code validation
  if (required && (!values.zipCode || values.zipCode.trim() === '')) {
    errors.zipCode = t('fieldRequired');
  } else if (values.zipCode && values.zipCode.length > 20) {
    errors.zipCode = 'Maximum 20 characters allowed';
  }

  return errors;
};

export default AddressFields;
