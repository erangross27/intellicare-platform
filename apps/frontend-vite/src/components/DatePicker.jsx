/**
 * DatePicker Component
 * Custom calendar component with country-specific date formats
 * Supports year selection and proper date picking
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '../config/languagesStatic';

const DatePicker = ({ 
  value = '', 
  onChange, 
  disabled = false,
  required = true,
  error = null,
  country = 'Israel',
  placeholder = '',
  minAge = 0,
  maxAge = 150
}) => {
  const { t, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [displayValue, setDisplayValue] = useState('');
  const dropdownRef = useRef(null);

  // Country-specific date formats
  const getDateFormat = useCallback((country) => {
    const formats = {
      'United States': { format: 'MM/DD/YYYY', separator: '/' },
      'Canada': { format: 'MM/DD/YYYY', separator: '/' },
      'United Kingdom': { format: 'DD/MM/YYYY', separator: '/' },
      'Germany': { format: 'DD.MM.YYYY', separator: '.' },
      'France': { format: 'DD/MM/YYYY', separator: '/' },
      'Israel': { format: 'DD/MM/YYYY', separator: '/' }
    };
    return formats[country] || formats['Israel'];
  }, []);

  const dateFormat = useMemo(() => getDateFormat(country), [country, getDateFormat]);

  // Calculate min/max years based on age limits
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - maxAge;
  const maxYear = currentYear - minAge;

  // Format date for display
  const formatDateForDisplay = useCallback((dateValue) => {
    if (!dateValue) return '';
    
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    const { format, separator } = dateFormat;
    
    if (format.startsWith('MM')) {
      return `${month}${separator}${day}${separator}${year}`;
    } else if (format.includes('.')) {
      return `${day}${separator}${month}${separator}${year}`;
    } else {
      return `${day}${separator}${month}${separator}${year}`;
    }
  }, [dateFormat]);

  // Update display value when value changes
  useEffect(() => {
    setDisplayValue(formatDateForDisplay(value));
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setSelectedYear(date.getFullYear());
        setSelectedMonth(date.getMonth());
      }
    }
  }, [value, formatDateForDisplay]);

  // Generate years array
  const years = useMemo(() => {
    const yearsList = [];
    for (let year = maxYear; year >= minYear; year--) {
      yearsList.push(year);
    }
    return yearsList;
  }, [minYear, maxYear]);

  // Generate months array
  const months = useMemo(() => {
    const monthNames = isRTL ? [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ] : [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return monthNames.map((name, index) => ({ name, value: index }));
  }, [isRTL]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const startDate = new Date(firstDay);

    // For Hebrew/RTL calendars, week starts on Sunday (0)
    // For LTR calendars, week starts on Sunday (0) as well for consistency
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    startDate.setDate(startDate.getDate() - firstDayOfWeek);

    const days = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      days.push({
        date: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === selectedMonth,
        isToday: currentDate.toDateString() === new Date().toDateString(),
        isSelected: value && new Date(value).toDateString() === currentDate.toDateString()
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }, [selectedYear, selectedMonth, value]);

  // Handle date selection
  const handleDateSelect = useCallback((date) => {
    const isoDate = date.toISOString().split('T')[0];
    if (onChange) {
      onChange(isoDate);
    }
    setIsOpen(false);
  }, [onChange]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

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
    cursor: disabled ? 'not-allowed' : 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s ease-in-out',
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
        type="text"
        value={displayValue}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onChange={() => {}} // Prevent manual typing
        placeholder={placeholder || dateFormat.format}
        style={inputStyle}
        disabled={disabled}
        required={required}
        readOnly
        data-lpignore="true"
        data-1p-ignore
        data-bw-ignore
        data-form-type="other"
        data-no-autofill="true"
      />

      {/* Calendar Dropdown */}
      {isOpen && (
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
          padding: '1rem',
          marginTop: '0.25rem',
          direction: isRTL ? 'rtl' : 'ltr',
          minWidth: '320px'
        }}>
          {/* Year and Month Selectors */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isRTL ? '1fr 1fr' : '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '1rem',
            alignItems: 'center',
            direction: isRTL ? 'rtl' : 'ltr'
          }}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{
                padding: '0.75rem',
                border: '2px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                textAlign: 'center',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: isRTL ? 'left 0.5rem center' : 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1em 1em',
                paddingRight: isRTL ? '0.75rem' : '2rem',
                paddingLeft: isRTL ? '2rem' : '0.75rem',
                direction: isRTL ? 'rtl' : 'ltr'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{
                padding: '0.75rem',
                border: '2px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                textAlign: 'center',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: isRTL ? 'left 0.5rem center' : 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1em 1em',
                paddingRight: isRTL ? '0.75rem' : '2rem',
                paddingLeft: isRTL ? '2rem' : '0.75rem',
                direction: isRTL ? 'rtl' : 'ltr'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.name}</option>
              ))}
            </select>
          </div>

          {/* Calendar Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            fontSize: '0.875rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            overflow: 'hidden',
            direction: isRTL ? 'rtl' : 'ltr'
          }}>
            {/* Day Headers */}
            {(isRTL ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((day, index) => (
              <div key={index} style={{
                padding: '0.75rem 0.5rem',
                textAlign: 'center',
                fontWeight: '600',
                color: '#374151',
                backgroundColor: '#f8fafc',
                fontSize: '0.75rem',
                letterSpacing: '0.05em'
              }}>
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {calendarDays.map((day, index) => (
              <button
                key={index}
                onClick={() => day.isCurrentMonth && handleDateSelect(day.date)}
                disabled={!day.isCurrentMonth}
                style={{
                  padding: '0.75rem 0.5rem',
                  textAlign: 'center',
                  border: 'none',
                  backgroundColor: day.isSelected
                    ? '#3b82f6'
                    : day.isToday
                      ? '#dbeafe'
                      : day.isCurrentMonth
                        ? '#ffffff'
                        : '#f9fafb',
                  color: day.isSelected
                    ? '#ffffff'
                    : day.isCurrentMonth
                      ? '#111827'
                      : '#d1d5db',
                  cursor: day.isCurrentMonth ? 'pointer' : 'default',
                  fontSize: '0.875rem',
                  fontWeight: day.isSelected || day.isToday ? '600' : '400',
                  transition: 'all 0.15s ease-in-out',
                  minHeight: '2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  if (day.isCurrentMonth && !day.isSelected) {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (day.isCurrentMonth && !day.isSelected) {
                    e.target.style.backgroundColor = day.isToday ? '#dbeafe' : '#ffffff';
                  }
                }}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>
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

export default DatePicker;
