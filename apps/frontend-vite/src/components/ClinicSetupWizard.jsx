import React, { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { useAuth } from '../context/AuthContext';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const PracticeSetupWizard = ({ onComplete, onBack }) => {
  const { t, isRTL } = useLanguage();
  const { setUser, setPractice } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subdomainChecking, setSubdomainChecking] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState(null);

  const [formData, setFormData] = useState({
    // Step 1: Practice Basic Info
    name: '',
    subdomain: '',
    
    // Step 2: Address & Country
    address: {
      street: '',
      city: '',
      state: '',
      country: 'Israel',
      postalCode: '',
      phone: ''
    },
    
    // Step 3: Admin User
    adminUser: {
      firstName: '',
      lastName: '',
      title: 'Dr.',
      email: '',
      password: '',
      confirmPassword: '',
      phone: ''
    },
    
    // Step 4: Settings
    settings: {
      language: 'he',
      timezone: 'Asia/Jerusalem',
      patientIdFormat: 'israeli_id'
    }
  });

  // Country to patient ID format mapping
  const countryPatientIdMap = useMemo(() => ({
    'Israel': 'israeli_id',
    'United States': 'us_ssn',
    'Canada': 'ca_health',
    'United Kingdom': 'uk_nhs'
  }), []);

  // Timezone mapping
  const timezoneMap = useMemo(() => ({
    'Israel': 'Asia/Jerusalem',
    'United States': 'America/New_York',
    'Canada': 'America/Toronto',
    'United Kingdom': 'Europe/London'
  }), []);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  }, []);

  // Handle country change to auto-update related settings
  const handleCountryChange = useCallback((country) => {
    handleInputChange('address.country', country);
    
    // Auto-update patient ID format and timezone
    const patientIdFormat = countryPatientIdMap[country] || 'israeli_id';
    const timezone = timezoneMap[country] || 'Asia/Jerusalem';
    const language = country === 'Israel' ? 'he' : 'en';
    
    handleInputChange('settings.patientIdFormat', patientIdFormat);
    handleInputChange('settings.timezone', timezone);
    handleInputChange('settings.language', language);
  }, [handleInputChange, countryPatientIdMap, timezoneMap]);

  // Check subdomain availability
  const checkSubdomain = useCallback(async (subdomain) => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainAvailable(null);
      return;
    }

    setSubdomainChecking(true);
    try {
      // SECURE API: Checking subdomain availability
      const response = await secureApi.get(`/practices/check-subdomain/${subdomain.toLowerCase()}`);
      setSubdomainAvailable(response.data.available);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Subdomain check error:', error);
      setSubdomainAvailable(false);
    } finally {
      setSubdomainChecking(false);
    }
  }, []);

  // Debounced subdomain check
  const handleSubdomainChange = useCallback((value) => {
    const cleanValue = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    handleInputChange('subdomain', cleanValue);
    
    // Debounce subdomain check
    const timeoutId = setTimeout(() => {
      checkSubdomain(cleanValue);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [handleInputChange, checkSubdomain]);

  const validateStep = useCallback((step) => {
    switch (step) {
      case 1:
        return formData.name.trim() && 
               formData.subdomain.trim() && 
               formData.subdomain.length >= 3 && 
               subdomainAvailable === true;
      case 2:
        return formData.address.street.trim() && 
               formData.address.city.trim() && 
               formData.address.country.trim();
      case 3:
        return formData.adminUser.firstName.trim() && 
               formData.adminUser.lastName.trim() && 
               formData.adminUser.email.trim() && 
               formData.adminUser.password.length >= 8 && 
               formData.adminUser.password === formData.adminUser.confirmPassword;
      case 4:
        return formData.settings.language && 
               formData.settings.timezone && 
               formData.settings.patientIdFormat;
      default:
        return false;
    }
  }, [formData, subdomainAvailable]);

  const nextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
      setError('');
    } else {
      setError(t('pleaseCompleteAllFields'));
    }
  }, [currentStep, validateStep, t]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  }, []);

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      setError(t('pleaseCompleteAllFields'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // SECURE API: Creating new practice
      const response = await secureApi.post('/practices/create', formData);
      
      if (response.data.success) {
        // Store practice context
        secureStorage.setItem('practiceSubdomain', formData.subdomain);
        secureStorage.setItem('token', response.data.token);
        secureStorage.setItem('user', JSON.stringify(response.data.user));
        secureStorage.setItem('practice', JSON.stringify(response.data.practice));

        // Update auth context directly
        setUser(response.data.user);
        setPractice(response.data.practice);

        onComplete(response.data);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Practice creation error:', error);
      const errorMessage = error.response?.data?.message;
      if (typeof errorMessage === 'object') {
        const language = secureStorage.getItem('selectedLanguage') || 'en';
        setError(errorMessage[language] || errorMessage.en || t('practiceCreationFailed'));
      } else {
        setError(errorMessage || t('practiceCreationFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Memoized styles
  const containerStyle = useMemo(() => ({
    maxWidth: '600px',
    margin: '20px auto',
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
    direction: isRTL ? 'rtl' : 'ltr',
    position: 'relative'
  }), [isRTL]);

  const stepIndicatorStyle = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '30px',
    gap: '10px'
  }), []);

  const inputStyle = useMemo(() => ({
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.3s ease',
    boxSizing: 'border-box'
  }), []);

  const buttonStyle = useMemo(() => ({
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  }), []);

  const primaryButtonStyle = useMemo(() => ({
    ...buttonStyle,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white'
  }), [buttonStyle]);

  const secondaryButtonStyle = useMemo(() => ({
    ...buttonStyle,
    background: '#f7fafc',
    color: '#4a5568',
    border: '2px solid #e2e8f0'
  }), [buttonStyle]);

  const renderStepIndicator = () => (
    <div style={stepIndicatorStyle}>
      {[1, 2, 3, 4, 5].map(step => (
        <div
          key={step}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: step <= currentStep ? '#667eea' : '#e2e8f0',
            color: step <= currentStep ? 'white' : '#a0aec0',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          {step}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#2d3748' }}>
        {t('practiceBasicInfo')}
      </h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('practiceName')}
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder={t('enterPracticeName')}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('practiceWebsiteAddress')}
        </label>
        <div style={{
          marginBottom: '8px',
          fontSize: '14px',
          color: '#666',
          fontStyle: 'italic'
        }}>
          {t('subdomainExplanation')}
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            border: '2px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
            borderColor: subdomainAvailable === true ? '#48bb78' :
                        subdomainAvailable === false ? '#f56565' : '#e2e8f0'
          }}>
            <input
              type="text"
              value={formData.subdomain}
              onChange={(e) => handleSubdomainChange(e.target.value)}
              placeholder={t('enterSubdomainExample')}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <div style={{
              padding: '12px 16px',
              background: '#f7fafc',
              color: '#4a5568',
              fontSize: '16px',
              borderLeft: '1px solid #e2e8f0'
            }}>
              .intellicare.com
            </div>
          </div>
          {subdomainChecking && (
            <div style={{ position: 'absolute', right: '140px', top: '50%', transform: 'translateY(-50%)' }}>
              ⏳
            </div>
          )}
        </div>
        {formData.subdomain && (
          <div style={{
            marginTop: '8px',
            fontSize: '14px',
            color: subdomainAvailable === true ? '#48bb78' :
                   subdomainAvailable === false ? '#f56565' : '#718096'
          }}>
            {subdomainChecking ? t('checking') :
             subdomainAvailable === true ? (
               <>
                 ✅ {t('subdomainAvailable')} - {t('yourWebsiteWillBe')}: <strong>{formData.subdomain}.intellicare.com</strong>
               </>
             ) :
             subdomainAvailable === false ? (
               <>
                 ❌ {t('subdomainTaken')} - {t('pleaseChooseDifferent')}
               </>
             ) :
             (
               <>
                 {t('yourWebsiteWillBe')}: <strong>{formData.subdomain}.intellicare.com</strong>
               </>
             )}
          </div>
        )}
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#0c4a6e'
        }}>
          <strong>{t('examples')}:</strong><br/>
          • drsmith.intellicare.com<br/>
          • telavivmedical.intellicare.com<br/>
          • familypractice.intellicare.com
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#2d3748' }}>
        {t('addressAndCountry')}
      </h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('country')}
        </label>
        <select
          value={formData.address.country}
          onChange={(e) => handleCountryChange(e.target.value)}
          style={inputStyle}
        >
          <option value="Israel">{t('israel')}</option>
          <option value="United States">{t('unitedStates')}</option>
          <option value="Canada">{t('canada')}</option>
          <option value="United Kingdom">{t('unitedKingdom')}</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('streetAddress')}
        </label>
        <input
          type="text"
          value={formData.address.street}
          onChange={(e) => handleInputChange('address.street', e.target.value)}
          placeholder={t('enterStreetAddress')}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            {t('city')}
          </label>
          <input
            type="text"
            value={formData.address.city}
            onChange={(e) => handleInputChange('address.city', e.target.value)}
            placeholder={t('enterCity')}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            {t('postalCode')}
          </label>
          <input
            type="text"
            value={formData.address.postalCode}
            onChange={(e) => handleInputChange('address.postalCode', e.target.value)}
            placeholder={t('enterPostalCode')}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('phone')} ({t('optional')})
        </label>
        <input
          type="tel"
          value={formData.address.phone}
          onChange={(e) => handleInputChange('address.phone', e.target.value)}
          placeholder={t('enterPhoneNumber')}
          style={inputStyle}
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#2d3748' }}>
        {t('adminUserCreation')}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            {t('firstName')}
          </label>
          <input
            type="text"
            value={formData.adminUser.firstName}
            onChange={(e) => handleInputChange('adminUser.firstName', e.target.value)}
            placeholder={t('enterFirstName')}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            {t('lastName')}
          </label>
          <input
            type="text"
            value={formData.adminUser.lastName}
            onChange={(e) => handleInputChange('adminUser.lastName', e.target.value)}
            placeholder={t('enterLastName')}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('title')} ({t('optional')})
        </label>
        <select
          value={formData.adminUser.title}
          onChange={(e) => handleInputChange('adminUser.title', e.target.value)}
          style={inputStyle}
        >
          <option value="Dr.">{t('doctor')}</option>
          <option value="Prof.">{t('professor')}</option>
          <option value="Mr.">{t('mister')}</option>
          <option value="Ms.">{t('miss')}</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('emailAddress')}
        </label>
        <input
          type="text"
          inputMode="email"
          value={formData.adminUser.email}
          onChange={(e) => handleInputChange('adminUser.email', e.target.value)}
          placeholder={t('enterEmailAddress')}
          style={inputStyle}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-autocomplete="none"
          data-lpignore="true"
          data-1p-ignore
          data-bw-ignore
          id="admin-email-input"
          name="ae"
          required
          readOnly
          onFocus={(e) => e.target.removeAttribute('readonly')}
          onMouseDown={(e) => e.currentTarget.removeAttribute('readonly')}
          onKeyDown={(e) => e.currentTarget.removeAttribute('readonly')}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            {t('password')}
          </label>
          <input
            type="text"
            value={formData.adminUser.password}
            onChange={(e) => handleInputChange('adminUser.password', e.target.value)}
            placeholder={t('enterPassword')}
            style={{
              ...inputStyle,
              WebkitTextSecurity: 'disc'
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-autocomplete="none"
            data-lpignore="true"
            data-1p-ignore
            data-bw-ignore
            id="admin-password-input"
            name="ap"
            required
            readOnly
            onFocus={(e) => e.target.removeAttribute('readonly')}
            onMouseDown={(e) => e.currentTarget.removeAttribute('readonly')}
            onKeyDown={(e) => e.currentTarget.removeAttribute('readonly')}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            {t('confirmPassword')}
          </label>
          <input
            type="text"
            value={formData.adminUser.confirmPassword}
            onChange={(e) => handleInputChange('adminUser.confirmPassword', e.target.value)}
            placeholder={t('confirmPassword')}
            style={{
              ...inputStyle,
              WebkitTextSecurity: 'disc',
              borderColor: formData.adminUser.password && formData.adminUser.confirmPassword &&
                          formData.adminUser.password !== formData.adminUser.confirmPassword ? '#f56565' : '#e2e8f0'
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-autocomplete="none"
            data-lpignore="true"
            data-1p-ignore
            data-bw-ignore
            id="admin-confirm-password-input"
            name="acp"
            required
            readOnly
            onFocus={(e) => e.target.removeAttribute('readonly')}
            onMouseDown={(e) => e.currentTarget.removeAttribute('readonly')}
            onKeyDown={(e) => e.currentTarget.removeAttribute('readonly')}
          />
        </div>
      </div>

      {formData.adminUser.password && formData.adminUser.confirmPassword &&
       formData.adminUser.password !== formData.adminUser.confirmPassword && (
        <div style={{ color: '#f56565', fontSize: '14px', marginBottom: '10px' }}>
          {t('passwordsDoNotMatch')}
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#2d3748' }}>
        {t('practiceSettings')}
      </h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('language')}
        </label>
        <select
          value={formData.settings.language}
          onChange={(e) => handleInputChange('settings.language', e.target.value)}
          style={inputStyle}
        >
          <option value="he">{t('hebrew')}</option>
          <option value="en">{t('english')}</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('timezone')}
        </label>
        <select
          value={formData.settings.timezone}
          onChange={(e) => handleInputChange('settings.timezone', e.target.value)}
          style={inputStyle}
        >
          <option value="Asia/Jerusalem">{t('israelTime')}</option>
          <option value="America/New_York">{t('easternTime')}</option>
          <option value="America/Toronto">{t('canadianTime')}</option>
          <option value="Europe/London">{t('ukTime')}</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          {t('patientIdFormat')}
        </label>
        <select
          value={formData.settings.patientIdFormat}
          onChange={(e) => handleInputChange('settings.patientIdFormat', e.target.value)}
          style={inputStyle}
        >
          <option value="israeli_id">{t('israeliId')}</option>
          <option value="us_ssn">{t('usSsn')}</option>
          <option value="ca_health">{t('canadianHealth')}</option>
          <option value="uk_nhs">{t('ukNhs')}</option>
        </select>
      </div>

      <div style={{
        background: '#f7fafc',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#4a5568'
      }}>
        <strong>{t('note')}:</strong> {t('settingsCanBeChangedLater')}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#2d3748' }}>
        {t('confirmAndCreate')}
      </h2>

      <div style={{
        background: '#f7fafc',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#2d3748' }}>{t('practiceSummary')}</h3>

        <div style={{ marginBottom: '10px' }}>
          <strong>{t('practiceName')}:</strong> {formData.name}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>{t('subdomain')}:</strong> {formData.subdomain}.intellicare.com
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>{t('country')}:</strong> {formData.address.country}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>{t('address')}:</strong> {formData.address.street}, {formData.address.city}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>{t('adminEmail')}:</strong> {formData.adminUser.email}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>{t('language')}:</strong> {formData.settings.language === 'he' ? t('hebrew') : t('english')}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>{t('patientIdFormat')}:</strong> {
            formData.settings.patientIdFormat === 'israeli_id' ? t('israeliId') :
            formData.settings.patientIdFormat === 'us_ssn' ? t('usSsn') :
            formData.settings.patientIdFormat === 'ca_health' ? t('canadianHealth') :
            t('ukNhs')
          }
        </div>
      </div>

      <div style={{
        background: '#e6fffa',
        border: '1px solid #38b2ac',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#234e52'
      }}>
        <strong>{t('ready')}:</strong> {t('clickCreateToFinish')}
      </div>
    </div>
  );

  return (
    <form 
      onSubmit={(e) => { e.preventDefault(); currentStep === 5 ? handleSubmit() : nextStep(); }} 
      style={containerStyle} 
      autoComplete="off" 
      aria-autocomplete="none">
      {/* Single decoy field to deter browser autofill */}
      <input type="text" name="_decoy" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
      {renderStepIndicator()}
      
      {error && (
        <div style={{
          background: '#fed7d7',
          border: '1px solid #fc8181',
          color: '#c53030',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
      {currentStep === 5 && renderStep5()}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '30px',
        gap: '10px'
      }}>
        {currentStep > 1 ? (
          <button type="button" onClick={prevStep} style={secondaryButtonStyle}>
            {t('previous')}
          </button>
        ) : (
          <button type="button" onClick={onBack} style={secondaryButtonStyle}>
            {t('back')}
          </button>
        )}

        {currentStep < 5 ? (
          <button
            type="button"
            onClick={nextStep}
            style={primaryButtonStyle}
            disabled={!validateStep(currentStep)}
          >
            {t('next')}
          </button>
        ) : (
          <button
            type="submit"
            style={primaryButtonStyle}
            disabled={loading || !validateStep(4)}
          >
            {loading ? t('creating') : t('createPractice')}
          </button>
        )}
      </div>
    </form>
  );
};

export default PracticeSetupWizard;
