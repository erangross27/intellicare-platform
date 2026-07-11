/**
 * CitySelector Component
 * Autocomplete city selector with database integration
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { addressAPI } from '../services/apiMigration';

const CitySelector = ({ 
  value = '', 
  onChange, 
  country = 'Israel', 
  disabled = false,
  required = false,
  error = null
}) => {
  const { t, isRTL } = useLanguage();
  const [filteredCities, setFilteredCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // Update search term when value prop changes
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Search cities using Google Places API with debouncing
  const searchCities = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setFilteredCities([]);
      setLoading(false);
      return;
    }

    // Only show loading after a small delay to avoid flicker
    const loadingTimer = setTimeout(() => {
      setLoading(true);
    }, 100);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the search
    debounceRef.current = setTimeout(async () => {
      try {
        process.env.NODE_ENV !== 'production' && console.log(`🏙️ Searching cities: "${query}" in ${country}`);
        const response = await addressAPI.searchCities(query, country === 'Israel' ? 'IL' : 'US');
        
        if (response.data.success && response.data.cities) {
          setFilteredCities(response.data.cities);
          process.env.NODE_ENV !== 'production' && console.log(`✅ Found ${response.data.cities.length} cities matching "${query}"`);
        } else {
          setFilteredCities([]);
        }
      } catch (error) {
        process.env.NODE_ENV !== 'production' && console.error('❌ Error searching cities:', error);
        setFilteredCities([]);
      } finally {
        clearTimeout(loadingTimer);
        setLoading(false);
        // Don't change focus - let the user continue typing
        // The focus should remain where the user put it
      }
    }, 300); // 300ms debounce
  }, [country]);

  // Handle input change
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(true);
    
    // Search cities using Google Places API
    searchCities(value);
    
    // Notify parent of change (for validation)
    if (onChange) {
      onChange(value);
    }
  }, [onChange, searchCities]);

  // Handle city selection
  const selectCity = useCallback((city) => {
    const cityName = city.nameLocal || city.name;
    setSearchTerm(cityName);
    setShowDropdown(false);
    
    if (onChange) {
      onChange(cityName);
    }
  }, [onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    // Don't handle navigation if dropdown is closed
    if (!showDropdown) return;
    
    // Allow space key for typing (don't close dropdown)
    if (e.key === ' ') {
      // Just let the space character be typed normally
      return;
    }

    // Only handle navigation keys when there are cities
    if (filteredCities.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCities.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredCities.length) {
          selectCity(filteredCities[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  }, [showDropdown, filteredCities, selectedIndex, selectCity]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Memoized styles
  const containerStyle = useMemo(() => ({
    position: 'relative',
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
    border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '8px',
    fontSize: '1rem',
    backgroundColor: disabled ? '#f9fafb' : '#ffffff',
    color: disabled ? '#6b7280' : '#111827',
    textAlign: isRTL ? 'right' : 'left',
    direction: isRTL ? 'rtl' : 'ltr',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  }), [disabled, error, isRTL]);

  const dropdownStyle = useMemo(() => ({
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '0.25rem',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 1000,
    direction: isRTL ? 'rtl' : 'ltr'
  }), [isRTL]);

  const optionStyle = useCallback((isSelected) => ({
    padding: '0.75rem',
    cursor: 'pointer',
    backgroundColor: isSelected ? '#f3f4f6' : '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    textAlign: isRTL ? 'right' : 'left',
    transition: 'background-color 0.15s ease'
  }), [isRTL]);

  const errorStyle = useMemo(() => ({
    fontSize: '0.875rem',
    color: '#dc2626',
    marginTop: '0.25rem',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  return (
    <div style={containerStyle} className="city-selector">
      <label style={labelStyle}>
        {t('city')} {required && '*'}
        {loading && (
          <span style={{ 
            marginLeft: isRTL ? '0' : '0.5rem', 
            marginRight: isRTL ? '0.5rem' : '0',
            fontSize: '0.75rem',
            color: '#6b7280'
          }}>
            {isRTL ? '(טוען...)' : '(Loading...)'}
          </span>
        )}
      </label>
      
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setShowDropdown(true);
          if (inputRef.current && !disabled) {
            inputRef.current.style.borderColor = '#6366f1';
          }
        }}
        onBlur={() => {
          if (inputRef.current) {
            inputRef.current.style.borderColor = error ? '#dc2626' : '#d1d5db';
          }
        }}
        style={inputStyle}
        placeholder={
          !country 
            ? (isRTL ? 'בחר מדינה תחילה' : 'Select country first')
            : (isRTL ? 'הקלד לחיפוש עיר...' : 'Type to search city...')
        }
        disabled={disabled || !country}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Dropdown */}
      {showDropdown && filteredCities.length > 0 && !disabled && (
        <div ref={dropdownRef} style={dropdownStyle}>
          {filteredCities.map((city, index) => {
            const cityName = city.nameLocal || city.name;
            const isSelected = index === selectedIndex;
            
            return (
              <div
                key={`${cityName}-${index}`}
                style={optionStyle(isSelected)}
                onClick={() => selectCity(city)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div style={{ fontWeight: '500' }}>
                  {cityName}
                </div>
                {city.totalStreets > 0 && (
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280',
                    marginTop: '0.25rem'
                  }}>
                    {city.totalStreets} {isRTL ? 'רחובות' : 'streets'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No results message */}
      {showDropdown && searchTerm.length > 0 && filteredCities.length === 0 && !loading && (
        <div style={{
          ...dropdownStyle,
          padding: '0.75rem',
          color: '#6b7280',
          textAlign: isRTL ? 'right' : 'left'
        }}>
          {isRTL ? 'לא נמצאו ערים' : 'No cities found'}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}
    </div>
  );
};

export default CitySelector;