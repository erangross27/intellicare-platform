/**
 * StatusSelector Component
 * Component for patient status selection (active/inactive/archived) with visual indicators
 * Supports both Hebrew RTL and English LTR layouts
 */

import React, { useMemo } from 'react';
import { useLanguage } from '../config/languagesStatic';

const StatusSelector = ({ 
  value = 'active', 
  onChange, 
  disabled = false,
  showIndicator = true,
  size = 'medium' // 'small', 'medium', 'large'
}) => {
  const { t, isRTL } = useLanguage();

  // Status configurations with colors and icons
  const statusConfig = useMemo(() => ({
    active: {
      label: t('active'),
      color: '#10b981',
      backgroundColor: '#d1fae5',
      icon: '✓',
      borderColor: '#10b981'
    },
    inactive: {
      label: t('inactive'),
      color: '#ef4444',
      backgroundColor: '#fee2e2',
      icon: '⏸',
      borderColor: '#ef4444'
    },
    archived: {
      label: t('archived'),
      color: '#6b7280',
      backgroundColor: '#f3f4f6',
      icon: '📦',
      borderColor: '#6b7280'
    }
  }), [t]);

  // Size configurations
  const sizeConfig = useMemo(() => ({
    small: {
      fontSize: '0.875rem',
      padding: '0.5rem 0.75rem',
      indicatorSize: '0.75rem',
      gap: '0.5rem'
    },
    medium: {
      fontSize: '1rem',
      padding: '0.75rem 1rem',
      indicatorSize: '1rem',
      gap: '0.75rem'
    },
    large: {
      fontSize: '1.125rem',
      padding: '1rem 1.25rem',
      indicatorSize: '1.25rem',
      gap: '1rem'
    }
  }), []);

  const currentSize = sizeConfig[size];
  const currentStatus = statusConfig[value] || statusConfig.active;

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

  const selectStyle = useMemo(() => ({
    padding: currentSize.padding,
    border: `2px solid ${disabled ? '#d1d5db' : currentStatus.borderColor}`,
    borderRadius: '8px',
    fontSize: currentSize.fontSize,
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
    backgroundPosition: isRTL ? 'left 0.5rem center' : 'right 0.5rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1.5em 1.5em',
    paddingRight: isRTL ? currentSize.padding : '2.5rem',
    paddingLeft: isRTL ? '2.5rem' : currentSize.padding
  }), [currentSize, disabled, currentStatus, isRTL]);

  const indicatorStyle = useMemo(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: currentSize.gap,
    padding: '0.25rem 0.75rem',
    borderRadius: '1rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    backgroundColor: currentStatus.backgroundColor,
    color: currentStatus.color,
    border: `1px solid ${currentStatus.borderColor}`,
    marginTop: '0.5rem'
  }), [currentSize, currentStatus]);

  const iconStyle = useMemo(() => ({
    fontSize: currentSize.indicatorSize,
    lineHeight: '1'
  }), [currentSize]);

  const handleChange = (e) => {
    if (onChange && !disabled) {
      onChange(e.target.value);
    }
  };

  const handleSelectFocus = (e) => {
    if (!disabled) {
      e.target.style.boxShadow = `0 0 0 3px ${currentStatus.borderColor}20`;
    }
  };

  const handleSelectBlur = (e) => {
    e.target.style.boxShadow = 'none';
  };

  return (
    <div style={containerStyle} className="status-selector">
      <label 
        htmlFor="status" 
        style={labelStyle}
      >
        {t('patientStatus')} *
      </label>
      
      <select
        id="status"
        name="status"
        value={value}
        onChange={handleChange}
        onFocus={handleSelectFocus}
        onBlur={handleSelectBlur}
        style={selectStyle}
        disabled={disabled}
        required
      >
        <option value="active">
          {statusConfig.active.label}
        </option>
        <option value="inactive">
          {statusConfig.inactive.label}
        </option>
        <option value="archived">
          {statusConfig.archived.label}
        </option>
      </select>

      {/* Status Indicator */}
      {showIndicator && (
        <div style={indicatorStyle} className="status-indicator">
          <span style={iconStyle}>
            {currentStatus.icon}
          </span>
          <span>
            {currentStatus.label}
          </span>
        </div>
      )}
    </div>
  );
};

// Status display component for read-only views
export const StatusDisplay = ({ 
  status = 'active', 
  size = 'medium',
  showIcon = true 
}) => {
  const { t } = useLanguage();

  const statusConfig = useMemo(() => ({
    active: {
      label: t('active'),
      color: '#10b981',
      backgroundColor: '#d1fae5',
      icon: '✓',
      borderColor: '#10b981'
    },
    inactive: {
      label: t('inactive'),
      color: '#ef4444',
      backgroundColor: '#fee2e2',
      icon: '⏸',
      borderColor: '#ef4444'
    },
    archived: {
      label: t('archived'),
      color: '#6b7280',
      backgroundColor: '#f3f4f6',
      icon: '📦',
      borderColor: '#6b7280'
    }
  }), [t]);

  const sizeConfig = useMemo(() => ({
    small: { fontSize: '0.75rem', padding: '0.25rem 0.5rem', iconSize: '0.75rem' },
    medium: { fontSize: '0.875rem', padding: '0.375rem 0.75rem', iconSize: '1rem' },
    large: { fontSize: '1rem', padding: '0.5rem 1rem', iconSize: '1.25rem' }
  }), []);

  const currentStatus = statusConfig[status] || statusConfig.active;
  const currentSize = sizeConfig[size];

  const displayStyle = useMemo(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: currentSize.padding,
    borderRadius: '1rem',
    fontSize: currentSize.fontSize,
    fontWeight: '500',
    backgroundColor: currentStatus.backgroundColor,
    color: currentStatus.color,
    border: `1px solid ${currentStatus.borderColor}`
  }), [currentStatus, currentSize]);

  const iconStyle = useMemo(() => ({
    fontSize: currentSize.iconSize,
    lineHeight: '1'
  }), [currentSize]);

  return (
    <span style={displayStyle} className="status-display">
      {showIcon && (
        <span style={iconStyle}>
          {currentStatus.icon}
        </span>
      )}
      <span>
        {currentStatus.label}
      </span>
    </span>
  );
};

export default StatusSelector;
