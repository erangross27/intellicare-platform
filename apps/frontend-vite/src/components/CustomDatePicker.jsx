import React, { useState, useMemo } from 'react';
import { useLanguage } from '../config/languagesStatic';

const CustomDatePicker = ({ value, onChange, required = false, error = null }) => {
  const { t, currentLanguage } = useLanguage();
  const isRTL = currentLanguage === 'he';
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Parse the value to Date object
  const selectedDate = value ? new Date(value) : null;

  // Calendar styles
  const containerStyle = useMemo(() => ({
    position: 'relative',
    width: '100%'
  }), []);

  const inputStyle = useMemo(() => ({
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '4px',
    fontSize: '0.875rem',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left',
    boxSizing: 'border-box'
  }), [error, isRTL]);

  const calendarStyle = useMemo(() => ({
    position: 'absolute',
    top: '100%',
    left: isRTL ? 'auto' : '0',
    right: isRTL ? '0' : 'auto',
    zIndex: 1000,
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    padding: '16px',
    minWidth: '280px',
    marginTop: '4px'
  }), [isRTL]);

  const headerStyle = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    padding: '0 8px'
  }), []);

  const monthYearStyle = useMemo(() => ({
    fontSize: '1rem',
    fontWeight: '600',
    color: '#374151'
  }), []);

  const navButtonStyle = useMemo(() => ({
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    color: '#6b7280',
    transition: 'all 0.2s ease'
  }), []);

  const gridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px'
  }), []);

  const dayHeaderStyle = useMemo(() => ({
    textAlign: 'center',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#6b7280',
    padding: '8px 4px',
    textTransform: 'uppercase'
  }), []);

  const dayStyle = useMemo(() => ({
    textAlign: 'center',
    padding: '8px 4px',
    fontSize: '0.875rem',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'all 0.2s ease',
    minHeight: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }), []);

  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Get days in month
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    if (date) {
      const formattedDate = date.toISOString().split('T')[0];
      onChange(formattedDate);
      setIsOpen(false);
    }
  };

  // Navigate months
  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  // Check if date is selected
  const isSelected = (date) => {
    if (!selectedDate || !date) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  // Check if date is today
  const isToday = (date) => {
    if (!date) return false;
    return date.toDateString() === new Date().toDateString();
  };

  // Day names - Sunday to Saturday
  const dayNames = isRTL
    ? ['ש', 'א', 'ב', 'ג', 'ד', 'ה', 'ו']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div style={containerStyle}>
      <input
        type="text"
        value={formatDate(selectedDate)}
        onClick={() => setIsOpen(!isOpen)}
        readOnly
        style={inputStyle}
        placeholder={t('selectDate') || 'Select date...'}
      />
      
      {isOpen && (
        <div style={calendarStyle}>
          {/* Calendar Header */}
          <div style={headerStyle}>
            <button
              style={navButtonStyle}
              onClick={() => navigateMonth(-1)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ‹
            </button>

            <div style={monthYearStyle}>
              {currentMonth.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </div>

            <button
              style={navButtonStyle}
              onClick={() => navigateMonth(1)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ›
            </button>
          </div>

          {/* Calendar Grid */}
          <div style={gridStyle}>
            {/* Day headers */}
            {dayNames.map((day, index) => (
              <div key={index} style={dayHeaderStyle}>
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {getDaysInMonth().map((date, index) => (
              <div
                key={index}
                style={{
                  ...dayStyle,
                  backgroundColor: date && isSelected(date) ? '#10b981' : 
                                  date && isToday(date) ? '#f3f4f6' : 'transparent',
                  color: date && isSelected(date) ? '#ffffff' : 
                         date && isToday(date) ? '#374151' : 
                         date ? '#374151' : 'transparent',
                  fontWeight: date && (isSelected(date) || isToday(date)) ? '600' : 'normal'
                }}
                onClick={() => handleDateSelect(date)}
                onMouseEnter={(e) => {
                  if (date && !isSelected(date)) {
                    e.target.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (date && !isSelected(date) && !isToday(date)) {
                    e.target.style.backgroundColor = 'transparent';
                  } else if (date && isToday(date) && !isSelected(date)) {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }
                }}
              >
                {date ? date.getDate() : ''}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Click outside to close */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default CustomDatePicker;
