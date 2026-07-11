import React from 'react';
import { useLanguage } from '../config/languagesStatic';
import { useClinicInfo, getPatientIdConfig } from '../hooks/useClinicInfo';

const NationalIdField = ({ 
  value, 
  onChange, 
  required = true, 
  id = 'national-id',
  name = 'nationalId',
  className = 'form-control',
  readOnly = false,
  onFocus,
  onMouseDown,
  onKeyDown
}) => {
  const { t } = useLanguage();
  const { practiceInfo, loading } = useClinicInfo();

  if (loading) {
    return (
      <div className="form-group">
        <label>{t('loading')}...</label>
        <input 
          type="text" 
          className={className}
          disabled 
          placeholder={t('loading')}
        />
      </div>
    );
  }

  const config = getPatientIdConfig(practiceInfo, t);

  const handleChange = (e) => {
    const formattedValue = config.formatter(e.target.value);
    onChange(formattedValue);
  };

  // Ensure value is always a string to avoid controlled/uncontrolled input warning
  const inputValue = value || '';

  return (
    <div className="form-group">
      <label htmlFor={id}>{config.label} {required && '*'}</label>
      <input
        type="text"
        id={id}
        name={name}
        placeholder={config.placeholder}
        value={inputValue}
        onChange={handleChange}
        required={required}
        pattern={config.pattern}
        maxLength={config.maxLength}
        minLength={config.minLength}
        inputMode={config.inputMode}
        className={className}
        autoComplete="off"
        aria-autocomplete="none"
        data-lpignore="true"
        data-1p-ignore
        readOnly={readOnly}
        onFocus={onFocus}
        onMouseDown={onMouseDown}
        onKeyDown={onKeyDown}
      />
      <small style={{ color: '#666', fontSize: '12px' }}>
        {config.helpText}
      </small>
    </div>
  );
};

export default NationalIdField;
