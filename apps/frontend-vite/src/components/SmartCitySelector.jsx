/**
 * Smart City Selector Component
 * Uses hierarchical Country → City database structure
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../config/languagesStatic';
import secureApi from '../services/secureApiClient';

const SmartCitySelector = ({ 
  value = '', 
  onChange, 
  country = 'Israel', 
  disabled = false,
  required = true,
  error = null
}) => {
  const { t, isRTL } = useLanguage();
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Fetch cities when country changes
  useEffect(() => {
    if (country) {
      fetchCities(country);
    }
  }, [country]);

  const fetchCities = useCallback(async (countryName) => {
    setLoading(true);
    setApiError(null);
    
    try {
      const data = await secureApi.get(`/streets/cities?country=${encodeURIComponent(countryName)}`);

      if (data.error) {
        throw new Error(`API error: ${data.error}`);
      }

      if (data.success && data.data && data.data.cities) {
        setCities(data.data.cities);
        process.env.NODE_ENV !== 'production' && console.log(`✅ Loaded ${data.data.cities.length} cities for ${countryName}`);
      } else {
        throw new Error('Invalid response format');
      }

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('❌ Error fetching cities:', error);
      setApiError(error.message);
      setCities([]); // Fallback to empty array
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle city selection
  const handleChange = useCallback((event) => {
    const selectedCity = event.target.value;
    
    if (onChange) {
      // Find the selected city object to get additional data
      const cityData = cities.find(city => 
        (city.nameLocal === selectedCity) || (city.name === selectedCity)
      );
      
      onChange(selectedCity, {
        cityData: cityData,
        country: country,
        postalCodePrefix: cityData?.postalCodePrefix
      });
    }
  }, [onChange, cities, country]);

  // Memoized styles for performance
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

  const selectStyle = useMemo(() => ({
    padding: '0.75rem',
    border: `2px solid ${error ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem',
    fontSize: '1rem',
    backgroundColor: disabled ? '#f9fafb' : '#ffffff',
    color: disabled ? '#6b7280' : '#111827',
    cursor: disabled ? 'not-allowed' : 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s ease-in-out',
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left'
  }), [disabled, error, isRTL]);

  const errorStyle = useMemo(() => ({
    fontSize: '0.875rem',
    color: '#dc2626',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const helpTextStyle = useMemo(() => ({
    fontSize: '0.875rem',
    color: '#6b7280',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  return (
    <div style={containerStyle} className="smart-city-selector">
      <label style={labelStyle}>
        {t('city')} {required && '*'}
        {loading && (
          <span style={{ marginLeft: isRTL ? '0' : '0.5rem', marginRight: isRTL ? '0.5rem' : '0' }}>
            {isRTL ? '(טוען...)' : '(Loading...)'}
          </span>
        )}
      </label>
      
      <select
        value={value}
        onChange={handleChange}
        style={selectStyle}
        disabled={disabled || loading || !country || cities.length === 0}
        required={required}
        onFocus={(e) => {
          if (!disabled && !loading) {
            e.target.style.borderColor = '#3b82f6';
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#dc2626' : '#d1d5db';
        }}
      >
        <option value="">
          {loading
            ? (isRTL ? 'טוען ערים...' : 'Loading cities...')
            : !country 
              ? t('selectCountryFirst') || 'Select country first'
              : cities.length === 0 
                ? (apiError 
                    ? (isRTL ? 'שגיאה בטעינת ערים' : 'Error loading cities')
                    : (isRTL ? 'אין ערים זמינות' : 'No cities available')
                  )
                : t('selectCity') || 'Select city'
        }
        </option>
        
        {cities.map((city, index) => {
          const displayName = city.nameLocal || city.name;
          const streetCount = city.totalStreets;
          
          return (
            <option key={`${displayName}-${index}`} value={displayName}>
              {displayName}
              {streetCount > 0 && ` (${streetCount} ${isRTL ? 'רחובות' : 'streets'})`}
            </option>
          );
        })}
      </select>

      {/* Error Message */}
      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      {/* API Error Message */}
      {apiError && (
        <div style={errorStyle}>
          {isRTL ? 'שגיאה בטעינת רשימת הערים' : 'Error loading city list'}
        </div>
      )}

      {/* Help Text */}
      {!country && (
        <div style={helpTextStyle}>
          {t('selectCountryToSeeCities') || 'Select a country to see available cities'}
        </div>
      )}
      
      {country && cities.length === 0 && !loading && !apiError && (
        <div style={helpTextStyle}>
          {t('manualCityEntry') || 'No predefined cities available. You can enter the city manually in the address section.'}
        </div>
      )}

      {/* Statistics */}
      {cities.length > 0 && (
        <div style={helpTextStyle}>
          {isRTL 
            ? `${cities.length} ערים זמינות ב${country}`
            : `${cities.length} cities available in ${country}`
          }
        </div>
      )}
    </div>
  );
};

export default SmartCitySelector;
