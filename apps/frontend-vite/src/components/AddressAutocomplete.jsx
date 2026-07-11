/**
 * AddressAutocomplete Component
 * API-based address lookup with autocomplete functionality
 * Provides standardized address data for consistent database entries
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { streetsAPI, postalCodesAPI, addressAPI } from '../services/apiMigration';

const AddressAutocomplete = ({
  value = '',
  onChange,
  disabled = false,
  required = true,
  error = null,
  country = 'Israel',
  placeholder = '',
  onAddressSelect = null,
  selectedCity = '' // New prop to filter addresses by city
}) => {
  const { t, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [apiError, setApiError] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Mock address data for demonstration (in production, this would come from APIs)
  const mockAddresses = useMemo(() => ({
    'Israel': [
      { 
        street: 'רחוב דיזנגוף 1', 
        city: 'תל אביב-יפו', 
        zipCode: '6436101',
        fullAddress: 'רחוב דיזנגוף 1, תל אביב-יפו, 6436101'
      },
      { 
        street: 'רחוב דיזנגוף 50', 
        city: 'תל אביב-יפו', 
        zipCode: '6436150',
        fullAddress: 'רחוב דיזנגוף 50, תל אביב-יפו, 6436150'
      },
      { 
        street: 'רחוב דיזנגוף 100', 
        city: 'תל אביב-יפו', 
        zipCode: '6436200',
        fullAddress: 'רחוב דיזנגוף 100, תל אביב-יפו, 6436200'
      },
      { 
        street: 'רחוב הרצל 1', 
        city: 'תל אביב-יפו', 
        zipCode: '6525101',
        fullAddress: 'רחוב הרצל 1, תל אביב-יפו, 6525101'
      },
      { 
        street: 'רחוב הרצל 25', 
        city: 'תל אביב-יפו', 
        zipCode: '6525125',
        fullAddress: 'רחוב הרצל 25, תל אביב-יפו, 6525125'
      },
      { 
        street: 'רחוב יפו 1', 
        city: 'ירושלים', 
        zipCode: '9422301',
        fullAddress: 'רחוב יפו 1, ירושלים, 9422301'
      },
      { 
        street: 'רחוב יפו 50', 
        city: 'ירושלים', 
        zipCode: '9422350',
        fullAddress: 'רחוב יפו 50, ירושלים, 9422350'
      },
      { 
        street: 'רחוב בן יהודה 1', 
        city: 'ירושלים', 
        zipCode: '9423401',
        fullAddress: 'רחוב בן יהודה 1, ירושלים, 9423401'
      },
      { 
        street: 'רחוב הנביאים 1', 
        city: 'ירושלים', 
        zipCode: '9424501',
        fullAddress: 'רחוב הנביאים 1, ירושלים, 9424501'
      },
      { 
        street: 'רחוב הרצל 1', 
        city: 'חיפה', 
        zipCode: '3310101',
        fullAddress: 'רחוב הרצל 1, חיפה, 3310101'
      },
      { 
        street: 'רחוב הרצל 50', 
        city: 'חיפה', 
        zipCode: '3310150',
        fullAddress: 'רחוב הרצל 50, חיפה, 3310150'
      },
      { 
        street: 'שדרות בן גוריון 1', 
        city: 'באר שבע', 
        zipCode: '8410101',
        fullAddress: 'שדרות בן גוריון 1, באר שבע, 8410101'
      }
    ],
    'United States': [
      { 
        street: '123 Main Street', 
        city: 'New York', 
        zipCode: '10001',
        fullAddress: '123 Main Street, New York, NY 10001'
      },
      { 
        street: '456 Broadway', 
        city: 'New York', 
        zipCode: '10013',
        fullAddress: '456 Broadway, New York, NY 10013'
      },
      { 
        street: '789 Fifth Avenue', 
        city: 'New York', 
        zipCode: '10022',
        fullAddress: '789 Fifth Avenue, New York, NY 10022'
      },
      { 
        street: '100 Hollywood Boulevard', 
        city: 'Los Angeles', 
        zipCode: '90028',
        fullAddress: '100 Hollywood Boulevard, Los Angeles, CA 90028'
      },
      { 
        street: '200 Sunset Strip', 
        city: 'Los Angeles', 
        zipCode: '90069',
        fullAddress: '200 Sunset Strip, Los Angeles, CA 90069'
      },
      { 
        street: '300 Michigan Avenue', 
        city: 'Chicago', 
        zipCode: '60601',
        fullAddress: '300 Michigan Avenue, Chicago, IL 60601'
      }
    ]
  }), []);

  // Real address search using Google Places Autocomplete API
  const searchRealAddresses = useCallback(async (query, selectedCity, country) => {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      process.env.NODE_ENV !== 'production' && console.log(`🔍 Searching via Google Places Autocomplete: "${query}" in ${selectedCity || 'Israel'}`);
      
      // Convert country name to country code for API
      const countryCode = country === 'Israel' ? 'IL' : 'US';
      
      // Use the new Google Places Autocomplete endpoint
      const response = await addressAPI.autocomplete(query, selectedCity, countryCode);
      
      if (response.data.success && response.data.suggestions.length > 0) {
        process.env.NODE_ENV !== 'production' && console.log(`✅ Found ${response.data.suggestions.length} suggestions from Google Places`);
        
        // Format the suggestions for display
        const formatted = response.data.suggestions.map(suggestion => ({
          street: suggestion.street || suggestion.mainText,
          buildingNumber: suggestion.buildingNumber,
          buildingNumberRange: suggestion.buildingNumber,
          city: suggestion.city || selectedCity,
          zipCode: '', // Will be fetched when selected
          fullAddress: suggestion.fullAddress,
          placeId: suggestion.placeId, // Store placeId for getting details later
          mainText: suggestion.mainText,
          secondaryText: suggestion.secondaryText,
          source: 'google_places_autocomplete'
        }));
        
        return formatted;
      }
      
      // If no results from Google, try getting street addresses with generated numbers
      process.env.NODE_ENV !== 'production' && console.log('⚠️ No autocomplete results, trying street addresses');
      const streetResponse = await addressAPI.getStreetAddresses(query, selectedCity, countryCode);
      
      if (streetResponse.data.success && streetResponse.data.addresses.length > 0) {
        return streetResponse.data.addresses.map(addr => ({
          street: addr.street,
          buildingNumber: addr.buildingNumber,
          buildingNumberRange: addr.buildingNumber,
          city: addr.city || selectedCity,
          zipCode: '',
          fullAddress: addr.fullAddress,
          generated: addr.generated,
          source: 'google_places_street'
        }));
      }
      
      // Final fallback
      process.env.NODE_ENV !== 'production' && console.log('⚠️ No results, using fallback');
      return generateBuildingNumberVariations(query, selectedCity);
      
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Address search error:', error);
      // Fallback to generating suggestions
      return generateBuildingNumberVariations(query, selectedCity);
    }
  }, []);


  // Search streets from our database
  const searchIsraeliGovernmentData = useCallback(async (query, selectedCity) => {
    try {
      if (!selectedCity || !query || query.length < 2) {
        return [];
      }

      // Clean city name for search (remove extra spaces)
      const cleanCityName = selectedCity.trim();

      // Use our streetsAPI to search streets in the database
      process.env.NODE_ENV !== 'production' && console.log(`📡 Searching streets in ${cleanCityName} for: "${query}"`);

      const response = await streetsAPI.searchStreets(cleanCityName, query);
      const data = response.data;

      if (!data.success || !data.data || !data.data.streets) {
        process.env.NODE_ENV !== 'production' && console.warn('No results from database API');
        return [];
      }

      const streetResults = data.data.streets;

      process.env.NODE_ENV !== 'production' && console.log(`✅ Found ${streetResults.length} unique streets from smart address database`);
      return streetResults;

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('🔴 Smart address API error:', error);
      return [];
    }
  }, []);





  // Generate building number variations for common Israeli streets with postal codes
  const generateBuildingNumberVariations = useCallback(async (query, selectedCity) => {
    try {
      // Extract street name from query
      const streetName = query.replace(/\d+/g, '').trim();
      const buildingNumberMatch = query.match(/(\d+)/);

      if (!buildingNumberMatch || !streetName) {
        return [];
      }

      const baseNumber = parseInt(buildingNumberMatch[1]);
      const variations = [];

      // Get base postal code for the street/city combination
      const basePostalCode = await getIsraeliPostalCode(streetName, selectedCity);

      // Generate nearby building numbers (±10)
      for (let i = Math.max(1, baseNumber - 10); i <= baseNumber + 10; i += 2) {
        // Calculate postal code variation (Israeli postal codes often change by building number)
        const postalCodeVariation = basePostalCode ?
          calculatePostalCodeVariation(basePostalCode, i, baseNumber) : '';

        variations.push({
          street: `${streetName} ${i}`,
          city: selectedCity,
          zipCode: postalCodeVariation,
          fullAddress: `${streetName} ${i}, ${selectedCity}${postalCodeVariation ? ', ' + postalCodeVariation : ''}`,
          lat: null,
          lon: null,
          source: 'generated',
          isGenerated: true
        });
      }

      process.env.NODE_ENV !== 'production' && console.log(`🏗️ Generated ${variations.length} building variations for ${streetName}`);
      return variations.slice(0, 8); // Limit to 8 variations

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Building number generation error:', error);
      return [];
    }
  }, []);

  // Get Israeli postal code for street/city combination
  const getIsraeliPostalCode = useCallback(async (streetName, city) => {
    try {
      // Israeli postal code database (major streets in major cities)
      const postalCodeDB = {
        'תל אביב-יפו': {
          'דיזנגוף': '6436101',
          'הרצל': '6525101',
          'בן יהודה': '6380101',
          'אלנבי': '6581101',
          'רוטשילד': '6688101',
          'יפו': '6826101',
          'קינג ג\'ורג\'': '6423101',
          'ארלוזורוב': '6209101'
        },
        'ירושלים': {
          'יפו': '9422301',
          'הרצל': '9414101',
          'בן יהודה': '9423401',
          'הנביאים': '9424501',
          'המלך ג\'ורג\'': '9426101',
          'עגנון': '9328101',
          'בר כוכבא': '9310101'
        },
        'חיפה': {
          'הרצל': '3310101',
          'יפו': '3310201',
          'בן גוריון': '3310301',
          'הנביאים': '3310401',
          'מסדה': '3310501'
        },
        'באר שבע': {
          'בן גוריון': '8410101',
          'הרצל': '8410201',
          'יפו': '8410301'
        },
        'חולון': {
          'הרצל': '5810101',
          'סוקולוב': '5810201'
        },
        'פתח תקווה': {
          'הרצל': '4910101',
          'רוטשילד': '4910201'
        },
        'נתניה': {
          'הרצל': '4210101',
          'ויצמן': '4210201'
        }
      };

      const cityData = postalCodeDB[city];
      if (!cityData) return null;

      // Try exact match first
      if (cityData[streetName]) {
        return cityData[streetName];
      }

      // Try partial match
      for (const [street, postalCode] of Object.entries(cityData)) {
        if (streetName.includes(street) || street.includes(streetName)) {
          return postalCode;
        }
      }

      return null;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Postal code lookup error:', error);
      return null;
    }
  }, []);

  // Calculate postal code variation based on building number
  const calculatePostalCodeVariation = useCallback((basePostalCode, buildingNumber, baseNumber) => {
    try {
      if (!basePostalCode || basePostalCode.length !== 7) return basePostalCode;

      // Israeli postal codes: first 5 digits = area, last 2 = specific location
      const areaCode = basePostalCode.substring(0, 5);
      const locationCode = parseInt(basePostalCode.substring(5, 7));

      // Adjust location code based on building number difference
      const numberDiff = Math.abs(buildingNumber - baseNumber);
      const adjustment = Math.floor(numberDiff / 10); // Every 10 buildings might change location code

      const newLocationCode = Math.max(1, Math.min(99, locationCode + adjustment));
      const newPostalCode = areaCode + String(newLocationCode).padStart(2, '0');

      return newPostalCode;
    } catch (error) {
      return basePostalCode;
    }
  }, []);



  // Fallback mock search for offline/testing
  const searchMockAddresses = useCallback((query, selectedCity, country) => {
    const countryAddresses = mockAddresses[country] || [];
    let filtered = countryAddresses;

    // Filter by selected city first if provided
    if (selectedCity) {
      filtered = filtered.filter(address =>
        address.city.toLowerCase() === selectedCity.toLowerCase()
      );
    }

    // Then filter by search query
    filtered = filtered.filter(address =>
      address.fullAddress.toLowerCase().includes(query.toLowerCase()) ||
      address.street.toLowerCase().includes(query.toLowerCase()) ||
      address.city.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10); // Limit to 10 results

    return filtered;
  }, [mockAddresses]);

  // Search addresses with debouncing
  const searchAddresses = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    // Only show loading after a small delay to avoid flicker
    const loadingTimer = setTimeout(() => {
      setIsLoading(true);
    }, 100);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(async () => {
      try {
        setApiError(false);
        const results = await searchRealAddresses(query, selectedCity, country);

        if (results.length > 0) {
          setSuggestions(results);
          process.env.NODE_ENV !== 'production' && console.log(`✅ Found ${results.length} real addresses for "${query}"`);
        } else {
          // If no real results, try mock data as fallback
          const mockResults = searchMockAddresses(query, selectedCity, country);
          setSuggestions(mockResults);
          if (mockResults.length > 0) {
            process.env.NODE_ENV !== 'production' && console.log(`📋 Using ${mockResults.length} mock addresses for "${query}"`);
          }
        }

        clearTimeout(loadingTimer);
        setIsLoading(false);
        setIsOpen(true);
        
        // Maintain focus on the input
        if (inputRef.current) {
          inputRef.current.focus();
        }
      } catch (error) {
        process.env.NODE_ENV !== 'production' && console.error('🔴 Address search API error:', error);
        clearTimeout(loadingTimer);
        setApiError(true);

        // Fallback to mock data
        const mockResults = searchMockAddresses(query, selectedCity, country);
        setSuggestions(mockResults);
        setIsLoading(false);
        setIsOpen(true);

        if (mockResults.length > 0) {
          process.env.NODE_ENV !== 'production' && console.log(`🔄 Fallback: Using ${mockResults.length} mock addresses for "${query}"`);
        }
        
        // Maintain focus on the input
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    }, 300);
  }, [country, selectedCity, searchRealAddresses, searchMockAddresses, inputRef]);

  // Handle input change
  const handleInputChange = useCallback((e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onChange) {
      onChange(query);
    }
    searchAddresses(query);
    setSelectedIndex(-1);
  }, [onChange, searchAddresses]);

  // Handle address selection
  const handleAddressSelect = useCallback(async (address) => {
    // Only show street and building number in input
    const streetAndNumber = address.street + (address.buildingNumberRange ? ' ' + address.buildingNumberRange : '');
    setSearchQuery(streetAndNumber);
    if (onChange) {
      onChange(streetAndNumber);
    }
    
    // Try to fetch full details including postal code if we have a placeId
    let finalZipCode = address.zipCode;
    
    process.env.NODE_ENV !== 'production' && console.log('🔍 Address selected:', {
      street: address.street,
      buildingNumber: address.buildingNumberRange,
      city: address.city,
      placeId: address.placeId,
      currentZipCode: address.zipCode
    });
    
    if (address.placeId && !address.zipCode) {
      try {
        process.env.NODE_ENV !== 'production' && console.log(`📍 Fetching place details for placeId: ${address.placeId}`);
        const detailsResponse = await addressAPI.getPlaceDetails(address.placeId);
        
        if (detailsResponse.data.success && detailsResponse.data.data) {
          const details = detailsResponse.data.data;
          finalZipCode = details.postalCode || '';
          
          // Preserve original Hebrew street name if API returns English
          // Only update if the API returns Hebrew or if we don't have a street name
          if (details.street && (!address.street || !/[a-zA-Z]/.test(details.street))) {
            address.street = details.street;
          }
          
          // Update building number only if provided
          if (details.streetNumber) {
            address.buildingNumberRange = details.streetNumber;
          }
          
          // Update city only if provided and not English
          if (details.city && !/[a-zA-Z]/.test(details.city)) {
            address.city = details.city;
          }
          
          process.env.NODE_ENV !== 'production' && console.log(`✅ Got place details - Postal code: ${finalZipCode || 'NOT FOUND'}`);
        } else {
          process.env.NODE_ENV !== 'production' && console.log('⚠️ No place details returned');
        }
      } catch (error) {
        process.env.NODE_ENV !== 'production' && console.log('❌ Could not fetch place details:', error.message);
      }
    }
    
    // If still no postal code, try the lookup service
    if (!finalZipCode) {
      try {
        const buildingNumber = address.buildingNumberRange ? 
          address.buildingNumberRange.split('-')[0] : '1';
        
        process.env.NODE_ENV !== 'production' && console.log(`🔄 Trying postal code lookup: street="${address.street}", city="${address.city}", building="${buildingNumber}"`);
        
        const postalResponse = await postalCodesAPI.lookup(
          address.street,
          address.city,
          buildingNumber,
          country === 'Israel' ? 'IL' : 'US'
        );
        
        process.env.NODE_ENV !== 'production' && console.log('📮 Postal lookup response:', postalResponse.data);
        
        if (postalResponse.data.success && postalResponse.data.postalCode) {
          finalZipCode = postalResponse.data.postalCode;
          process.env.NODE_ENV !== 'production' && console.log(`✅ Fetched postal code via lookup: ${finalZipCode}`);
        } else {
          process.env.NODE_ENV !== 'production' && console.log(`⚠️ No postal code found via lookup`);
        }
      } catch (error) {
        process.env.NODE_ENV !== 'production' && console.log('❌ Postal code lookup failed:', error.message);
      }
    }
    
    if (onAddressSelect) {
      const addressData = {
        street: address.street,
        buildingNumberRange: address.buildingNumberRange,
        city: address.city,
        zipCode: finalZipCode || '',
        fullAddress: address.fullAddress
      };
      
      process.env.NODE_ENV !== 'production' && console.log('📤 Calling onAddressSelect with:', addressData);
      onAddressSelect(addressData);
    }
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  }, [onChange, onAddressSelect, country]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleAddressSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isOpen, suggestions, selectedIndex, handleAddressSelect]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Update search query when value changes externally
  useEffect(() => {
    if (value !== searchQuery) {
      setSearchQuery(value);
    }
  }, [value]);

  const inputStyle = useMemo(() => ({
    width: '100%',
    padding: '0.75rem',
    border: `2px solid ${error ? '#ef4444' : '#d1d5db'}`,
    borderRadius: '8px',
    fontSize: '1rem',
    backgroundColor: disabled ? '#f9fafb' : '#ffffff',
    color: disabled ? '#6b7280' : '#111827',
    textAlign: isRTL ? 'right' : 'left',
    direction: isRTL ? 'rtl' : 'ltr',
    cursor: disabled ? 'not-allowed' : 'text',
    outline: 'none',
    transition: 'border-color 0.2s ease-in-out',
    boxSizing: 'border-box',
    // Prevent autofill
    autoComplete: 'new-password',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false
  }), [error, disabled, isRTL]);

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={dropdownRef}>
      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        placeholder={placeholder || (isRTL ? 'חפש כתובת...' : 'Search address...')}
        style={inputStyle}
        disabled={disabled}
        required={required}
        data-lpignore="true"
        data-1p-ignore
        data-bw-ignore
        data-form-type="other"
        data-no-autofill="true"
      />

      {/* Loading Indicator */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          right: isRTL ? 'auto' : '0.75rem',
          left: isRTL ? '0.75rem' : 'auto',
          transform: 'translateY(-50%)',
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          {isRTL ? 'מחפש...' : 'Searching...'}
        </div>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          marginTop: '0.25rem',
          maxHeight: '300px',
          overflowY: 'auto',
          direction: isRTL ? 'rtl' : 'ltr'
        }}>
          {/* Data Source Indicator */}
          {apiError && (
            <div style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: '#fef3c7',
              borderBottom: '1px solid #f59e0b',
              fontSize: '0.75rem',
              color: '#92400e',
              textAlign: isRTL ? 'right' : 'left'
            }}>
              {isRTL ? '🔄 נתונים מקומיים (API לא זמין)' : '🔄 Local data (API unavailable)'}
            </div>
          )}

          {!apiError && suggestions.length > 0 && (
            <div style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: suggestions[0].isGenerated ? '#fef3c7' : '#d1fae5',
              borderBottom: `1px solid ${suggestions[0].isGenerated ? '#f59e0b' : '#10b981'}`,
              fontSize: '0.75rem',
              color: suggestions[0].isGenerated ? '#92400e' : '#065f46',
              textAlign: isRTL ? 'right' : 'left'
            }}>
              {suggestions[0].isGenerated
                ? (isRTL ? '🏗️ מספרי בניין מוצעים' : '🏗️ Suggested building numbers')
                : suggestions[0].source === 'smart_address_db'
                  ? (isRTL ? '🏗️ מאגר כתובות חכם - ממשלת ישראל' : '🏗️ Smart Address Database - Israeli Government')
                  : (isRTL ? '✅ כתובות מאומתות' : '✅ Verified addresses')
              }
            </div>
          )}

          {suggestions.map((address, index) => (
            <div
              key={index}
              onClick={() => handleAddressSelect(address)}
              style={{
                padding: '0.75rem',
                cursor: 'pointer',
                backgroundColor: selectedIndex === index ? '#f3f4f6' : 'transparent',
                borderBottom: index < suggestions.length - 1 ? '1px solid #e5e7eb' : 'none',
                fontSize: '0.875rem',
                color: '#374151',
                textAlign: isRTL ? 'right' : 'left',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div style={{
                fontWeight: '500',
                marginBottom: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {/* Show street and building number only (if present) */}
                {address.street}
                {address.buildingNumberRange ? ` ${address.buildingNumberRange}` : ''}
                {address.isGenerated && (
                  <span style={{
                    fontSize: '0.7rem',
                    backgroundColor: '#fbbf24',
                    color: '#92400e',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    fontWeight: '600'
                  }}>
                    {isRTL ? 'מוצע' : 'Suggested'}
                  </span>
                )}
              </div>
              {/* Only show street name, no city/zip code */}
            </div>
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.875rem',
          color: '#ef4444',
          textAlign: isRTL ? 'right' : 'left'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
