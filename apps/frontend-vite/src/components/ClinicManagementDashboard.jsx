import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../config/languagesStatic';
import { useAuth } from '../context/AuthContext';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const PracticeManagementDashboard = () => {
  const { t, isRTL } = useLanguage();
  const { user, practice } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [practiceData, setPracticeData] = useState(null);
  const [practiceStats, setPracticeStats] = useState({
    totalUsers: 0,
    totalPatients: 0,
    totalDocuments: 0,
    storageUsed: 0,
    lastActivity: null
  });
  
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: {
      address: {
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: ''
      },
      phone: '',
      email: ''
    },
    settings: {
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      currency: 'USD',
      patientIdFormat: 'israeli_id',
      workingHours: {
        start: '08:00',
        end: '18:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      }
    }
  });

  // Load practice data and statistics
  useEffect(() => {
    loadPracticeData();
  }, []);

  const loadPracticeData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load practice information - USING SECURE API
      const practiceResponse = await secureApi.get('/practice/info');

      if (practiceResponse.data.success) {
        setPracticeData(practiceResponse.data.practice);
        setFormData({
          name: practiceResponse.data.practice.name,
          contact: practiceResponse.data.practice.contact,
          settings: practiceResponse.data.practice.settings
        });
      }

      // Load practice statistics - USING SECURE API
      const statsResponse = await secureApi.get('/practice/stats');

      if (statsResponse.data.success) {
        setPracticeStats(statsResponse.data.stats);
      }

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error loading practice data:', error);
      setError(t('errorLoadingPracticeData'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => {
      if (field.includes('.')) {
        const keys = field.split('.');
        const newData = { ...prev };
        let current = newData;
        
        for (let i = 0; i < keys.length - 1; i++) {
          current[keys[i]] = { ...current[keys[i]] };
          current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        return newData;
      }
      
      return {
        ...prev,
        [field]: value
      };
    });
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await secureApi.put('/practice/update', formData);

      if (response.data.success) {
        setPracticeData(response.data.practice);
        setEditMode(false);
        setSuccess(t('practiceUpdatedSuccessfully'));
      }

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error updating practice:', error);
      const errorMessage = error.response?.data?.message;
      if (typeof errorMessage === 'object') {
        const language = secureStorage.getItem('selectedLanguage') || 'en';
        setError(errorMessage[language] || errorMessage.en || t('errorUpdatingPractice'));
      } else {
        setError(errorMessage || t('errorUpdatingPractice'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (practiceData) {
      setFormData({
        name: practiceData.name,
        contact: practiceData.contact,
        settings: practiceData.settings
      });
    }
    setEditMode(false);
    setError('');
    setSuccess('');
  };

  // Memoized styles
  const containerStyle = useMemo(() => ({
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    direction: isRTL ? 'rtl' : 'ltr'
  }), [isRTL]);

  const cardStyle = useMemo(() => ({
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0'
  }), []);

  const statCardStyle = useMemo(() => ({
    ...cardStyle,
    textAlign: 'center',
    padding: '20px'
  }), [cardStyle]);

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
    transition: 'all 0.3s ease',
    marginRight: isRTL ? '0' : '10px',
    marginLeft: isRTL ? '10px' : '0'
  }), [isRTL]);

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

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>{t('loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ marginBottom: '30px', color: '#2d3748' }}>
        {t('practiceManagement')}
      </h1>

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          background: '#fed7d7',
          border: '1px solid #fc8181',
          color: '#c53030',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: '#c6f6d5',
          border: '1px solid #68d391',
          color: '#2f855a',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {success}
        </div>
      )}

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={statCardStyle}>
          <h3 style={{ margin: '0 0 10px 0', color: '#667eea' }}>{practiceStats.totalUsers}</h3>
          <p style={{ margin: 0, color: '#666' }}>{t('totalUsers')}</p>
        </div>
        
        <div style={statCardStyle}>
          <h3 style={{ margin: '0 0 10px 0', color: '#48bb78' }}>{practiceStats.totalPatients}</h3>
          <p style={{ margin: 0, color: '#666' }}>{t('totalPatients')}</p>
        </div>
        
        <div style={statCardStyle}>
          <h3 style={{ margin: '0 0 10px 0', color: '#ed8936' }}>{practiceStats.totalDocuments}</h3>
          <p style={{ margin: 0, color: '#666' }}>{t('totalDocuments')}</p>
        </div>
        
        <div style={statCardStyle}>
          <h3 style={{ margin: '0 0 10px 0', color: '#9f7aea' }}>
            {Math.round(practiceStats.storageUsed / 1024 / 1024)} MB
          </h3>
          <p style={{ margin: 0, color: '#666' }}>{t('storageUsed')}</p>
        </div>
      </div>

      {/* Practice Information */}
      <div style={cardStyle}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, color: '#2d3748' }}>{t('practiceInformation')}</h2>
          
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              style={primaryButtonStyle}
            >
              {t('edit')}
            </button>
          ) : (
            <div>
              <button
                onClick={handleSave}
                disabled={saving}
                style={primaryButtonStyle}
              >
                {saving ? t('saving') : t('save')}
              </button>
              <button
                onClick={handleCancel}
                style={secondaryButtonStyle}
              >
                {t('cancel')}
              </button>
            </div>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {/* Basic Information */}
          <div>
            <h3 style={{ marginBottom: '15px', color: '#4a5568' }}>{t('basicInformation')}</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                {t('practiceName')}
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  style={inputStyle}
                />
              ) : (
                <div style={{ padding: '12px 0', fontSize: '16px' }}>{practiceData?.name}</div>
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                {t('subdomain')}
              </label>
              <div style={{ padding: '12px 0', fontSize: '16px', color: '#666' }}>
                {practiceData?.subdomain}.intellicare.com
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                {t('status')}
              </label>
              <div style={{
                padding: '6px 12px',
                borderRadius: '20px',
                display: 'inline-block',
                background: practiceData?.status === 'active' ? '#c6f6d5' : '#fed7d7',
                color: practiceData?.status === 'active' ? '#2f855a' : '#c53030',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {t(practiceData?.status || 'unknown')}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 style={{ marginBottom: '15px', color: '#4a5568' }}>{t('contactInformation')}</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                {t('streetAddress')}
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.contact?.address?.street || ''}
                  onChange={(e) => handleInputChange('contact.address.street', e.target.value)}
                  style={inputStyle}
                />
              ) : (
                <div style={{ padding: '12px 0', fontSize: '16px' }}>
                  {practiceData?.contact?.address?.street}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  {t('city')}
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.contact?.address?.city || ''}
                    onChange={(e) => handleInputChange('contact.address.city', e.target.value)}
                    style={inputStyle}
                  />
                ) : (
                  <div style={{ padding: '12px 0', fontSize: '16px' }}>
                    {practiceData?.contact?.address?.city}
                  </div>
                )}
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  {t('country')}
                </label>
                {editMode ? (
                  <select
                    value={formData.contact?.address?.country || ''}
                    onChange={(e) => handleInputChange('contact.address.country', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Israel">{t('israel')}</option>
                    <option value="United States">{t('unitedStates')}</option>
                    <option value="Canada">{t('canada')}</option>
                    <option value="United Kingdom">{t('unitedKingdom')}</option>
                  </select>
                ) : (
                  <div style={{ padding: '12px 0', fontSize: '16px' }}>
                    {practiceData?.contact?.address?.country}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                {t('phone')}
              </label>
              {editMode ? (
                <input
                  type="tel"
                  value={formData.contact?.phone || ''}
                  onChange={(e) => handleInputChange('contact.phone', e.target.value)}
                  style={inputStyle}
                />
              ) : (
                <div style={{ padding: '12px 0', fontSize: '16px' }}>
                  {practiceData?.contact?.phone}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Information */}
      <div style={cardStyle}>
        <h2 style={{ marginBottom: '20px', color: '#2d3748' }}>{t('subscriptionInformation')}</h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              {t('plan')}
            </label>
            <div style={{
              padding: '8px 16px',
              borderRadius: '20px',
              display: 'inline-block',
              background: '#e6fffa',
              color: '#234e52',
              fontSize: '14px',
              fontWeight: '600',
              textTransform: 'capitalize'
            }}>
              {practiceData?.subscription?.plan}
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              {t('maxUsers')}
            </label>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#667eea' }}>
              {practiceData?.subscription?.maxUsers}
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              {t('maxPatients')}
            </label>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#48bb78' }}>
              {practiceData?.subscription?.maxPatients}
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              {t('subscriptionStatus')}
            </label>
            <div style={{
              padding: '6px 12px',
              borderRadius: '20px',
              display: 'inline-block',
              background: practiceData?.subscription?.isActive ? '#c6f6d5' : '#fed7d7',
              color: practiceData?.subscription?.isActive ? '#2f855a' : '#c53030',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {practiceData?.subscription?.isActive ? t('active') : t('inactive')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PracticeManagementDashboard);
