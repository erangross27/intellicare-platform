import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../config/languagesStatic';
import CustomDatePicker from './CustomDatePicker';
import secureApi from '../services/secureApiClient';

const NewVisit = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { t, currentLanguage } = useLanguage();
  const isRTL = currentLanguage === 'he';

  const [visitData, setVisitData] = useState({
    symptoms: '',
    diagnosis: '',
    treatment: '',
    notes: '',
    followUpDate: '',
    visitType: 'routine', // routine, emergency, follow-up, consultation
    vitalSigns: {
      bloodPressure: '',
      heartRate: '',
      temperature: '',
      weight: ''
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Cached styles for performance - Compact clean design
  const containerStyle = useMemo(() => ({
    minHeight: '100vh',
    padding: '10px',
    backgroundColor: '#f8fafc'
  }), []);

  const contentStyle = useMemo(() => ({
    maxWidth: '1000px',
    margin: '0 auto'
  }), []);

  const cardStyle = useMemo(() => ({
    background: '#ffffff',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0'
  }), []);

  const headerStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e2e8f0'
  }), []);

  const titleStyle = useMemo(() => ({
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0
  }), []);

  const dateTimeStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6b7280',
    fontSize: '0.875rem',
    fontWeight: '500'
  }), []);



  const formSectionStyle = useMemo(() => ({
    background: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  }), []);

  const sectionTitleStyle = useMemo(() => ({
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '2px solid #f3f4f6'
  }), []);

  const formGroupStyle = useMemo(() => ({
    marginBottom: '12px'
  }), []);

  const labelStyle = useMemo(() => ({
    display: 'block',
    marginBottom: '4px',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#374151',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const inputStyle = useMemo(() => ({
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '0.875rem',
    transition: 'border-color 0.2s ease',
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box'
  }), [isRTL]);

  const textareaStyle = useMemo(() => ({
    ...inputStyle,
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: 'inherit'
  }), [inputStyle]);

  const selectStyle = useMemo(() => ({
    ...inputStyle,
    cursor: 'pointer'
  }), [inputStyle]);



  const errorMessageStyle = useMemo(() => ({
    color: '#dc2626',
    fontSize: '0.75rem',
    marginTop: '2px',
    textAlign: isRTL ? 'right' : 'left'
  }), [isRTL]);

  const buttonGroupStyle = useMemo(() => ({
    display: 'flex',
    gap: '8px',
    justifyContent: isRTL ? 'flex-end' : 'flex-start',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #e2e8f0'
  }), [isRTL]);

  const primaryButtonStyle = useMemo(() => ({
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 20px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    minWidth: '80px'
  }), []);

  const secondaryButtonStyle = useMemo(() => ({
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    padding: '10px 20px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    minWidth: '80px'
  }), []);

  const handleInputChange = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleVitalSignChange = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      vitalSigns: {
        ...prev.vitalSigns,
        [field]: value
      }
    }));
  };

  const validateForm = () => {
    const errors = {};

    if (!visitData.symptoms.trim()) {
      errors.symptoms = t('fieldRequired') || 'This field is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Add automatic date and time logging
      const visitDataWithTimestamp = {
        ...visitData,
        visitDate: new Date().toISOString().split('T')[0],
        visitTime: new Date().toTimeString().slice(0, 5),
        createdAt: new Date().toISOString()
      };

      const data = await secureApi.post(`/patients/${patientId}/visit`, visitDataWithTimestamp);

      if (data.success) {
        navigate(`/patients/${patientId}`);
      } else {
        setError(data.error || 'Failed to save visit');
      }
    } catch (err) {
      setError('Network error - please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/patients/${patientId}`);
  };

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <div style={cardStyle}>
          {/* Header with title and current date/time */}
          <div style={headerStyle}>
            <h1 style={titleStyle}>
              {t('newVisit') || 'New Patient Visit'}
            </h1>
            <div style={{
              ...dateTimeStyle,
              textAlign: 'left',
              direction: 'ltr'
            }}>
              <div style={{ fontSize: '1.1rem', color: '#1f2937', fontWeight: '600' }}>
                {new Date().toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })} • {new Date().toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #fecaca',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" aria-autocomplete="none">
            {/* Hidden dummy fields to deter browser autofill */}
            <input type="text" name="_fake_user" style={{ display: 'none' }} autoComplete="off" />
            <input type="password" name="_fake_pass" style={{ display: 'none' }} autoComplete="new-password" />
            {/* Visit Type and Follow-up - Top Section */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '24px'
            }}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>
                  {t('visitType') || 'סוג הביקור'}
                </label>
                <select
                  value={visitData.visitType}
                  onChange={(e) => handleInputChange('visitType', e.target.value)}
                  style={selectStyle}
                  required
                >
                  <option value="routine">{t('routineVisit') || 'ביקור שגרתי'}</option>
                  <option value="emergency">{t('emergencyVisit') || 'ביקור חירום'}</option>
                  <option value="follow-up">{t('followUpVisit') || 'ביקור מעקב'}</option>
                  <option value="consultation">{t('consultationVisit') || 'ייעוץ'}</option>
                </select>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>
                  {t('followUp') || 'למעקב'}
                </label>
                <CustomDatePicker
                  value={visitData.followUpDate}
                  onChange={(value) => handleInputChange('followUpDate', value)}
                />
              </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '24px'
            }}>
              {/* Symptoms */}
              <div style={formSectionStyle}>
                <h3 style={sectionTitleStyle}>
                  {t('symptoms') || 'תסמינים'} *
                </h3>

                <div style={formGroupStyle}>
                  <textarea
                    value={visitData.symptoms}
                    onChange={(e) => handleInputChange('symptoms', e.target.value)}
                    style={{
                      ...textareaStyle,
                      minHeight: '120px',
                      borderColor: fieldErrors.symptoms ? '#dc2626' : '#d1d5db'
                    }}
                    placeholder={t('symptomsPlaceholder') || 'תאר את התסמינים...'}
                    required
                  />
                  {fieldErrors.symptoms && (
                    <div style={errorMessageStyle}>{fieldErrors.symptoms}</div>
                  )}
                </div>
              </div>

              {/* Vital Signs */}
              <div style={formSectionStyle}>
                <h3 style={sectionTitleStyle}>
                  {t('vitalSigns') || 'Vital Signs'}
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px'
                }}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>
                      {t('bloodPressure') || 'Blood Pressure'}
                    </label>
                    <input
                      type="text"
                      value={visitData.vitalSigns.bloodPressure}
                      onChange={(e) => handleVitalSignChange('bloodPressure', e.target.value)}
                      style={inputStyle}
                      placeholder="120/80"
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>
                      {t('heartRate') || 'Heart Rate'}
                    </label>
                    <input
                      type="text"
                      value={visitData.vitalSigns.heartRate}
                      onChange={(e) => handleVitalSignChange('heartRate', e.target.value)}
                      style={inputStyle}
                      placeholder="72 bpm"
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>
                      {t('temperature') || 'Temperature'}
                    </label>
                    <input
                      type="text"
                      value={visitData.vitalSigns.temperature}
                      onChange={(e) => handleVitalSignChange('temperature', e.target.value)}
                      style={inputStyle}
                      placeholder="36.5°C"
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>
                      {t('weight') || 'Weight'}
                    </label>
                    <input
                      type="text"
                      value={visitData.vitalSigns.weight}
                      onChange={(e) => handleVitalSignChange('weight', e.target.value)}
                      style={inputStyle}
                      placeholder="70 kg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnosis */}
            <div style={{
              marginBottom: '24px'
            }}>
              <div style={formSectionStyle}>
                <h3 style={sectionTitleStyle}>
                  {t('diagnosis') || 'אבחנה'}
                </h3>

                <div style={formGroupStyle}>
                  <textarea
                    value={visitData.diagnosis}
                    onChange={(e) => handleInputChange('diagnosis', e.target.value)}
                    style={{...textareaStyle, minHeight: '120px'}}
                    placeholder={t('diagnosisPlaceholder') || 'הכנס אבחנה...'}
                  />
                </div>
              </div>
            </div>

            {/* Treatment */}
            <div style={formSectionStyle}>
              <h3 style={sectionTitleStyle}>
                {t('treatment') || 'טיפול'}
              </h3>

              <div style={formGroupStyle}>
                <label style={labelStyle}>
                  {t('treatment') || 'טיפול'}
                </label>
                <textarea
                  value={visitData.treatment}
                  onChange={(e) => handleInputChange('treatment', e.target.value)}
                  style={{...textareaStyle, minHeight: '100px'}}
                  placeholder={t('treatmentPlaceholder') || 'תוכנית טיפול...'}
                />
              </div>
            </div>

            <div style={buttonGroupStyle}>
              <button
                type="button"
                onClick={handleCancel}
                style={secondaryButtonStyle}
                disabled={loading}
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                style={primaryButtonStyle}
                disabled={loading}
              >
                {loading ? (t('saving') || 'Saving...') : (t('saveVisit') || 'Save Visit')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewVisit;
