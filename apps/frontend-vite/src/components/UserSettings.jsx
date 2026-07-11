import React, { useState, useEffect, useRef, useCallback } from 'react';
import './UserSettings.css';
import MFASetup from './MFASetup';
import secureApi from '../services/secureApiClient';
import { isClinicalRole, primaryRole } from '../config/roleConfig';

import secureStorage from '../utils/secureStorage';
const UserSettings = ({ isOpen, onClose, userInfo, onUpdateUser, initialTab = 'profile' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Voice & Speech state
  const [voices, setVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState(null);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [voiceCategoryFilter, setVoiceCategoryFilter] = useState('all');
  const [voiceGenderFilter, setVoiceGenderFilter] = useState('all');
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    const saved = secureStorage.getItem('ttsEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [selectedVoiceId, setSelectedVoiceId] = useState(() => {
    return secureStorage.getItem('ttsVoiceId') || '';
  });
  const [voicesDirty, setVoicesDirty] = useState(false);
  const previewAudioRef = useRef(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState(null);
  const voicesLoadedRef = useRef(false);

  // Simple English-only labels
  const t = (key) => {
    const labels = {
      'settings.title': 'Settings',
      'settings.close': 'Close',
      'settings.tabs.profile': 'Profile',
      'settings.tabs.security': 'Security',
      'settings.tabs.notifications': 'Notifications',
      'settings.tabs.professional': 'Professional',
      'settings.profile.title': 'Personal Information',
      'settings.profile.edit': 'Edit',
      'settings.profile.firstName': 'First Name',
      'settings.profile.lastName': 'Last Name',
      'settings.profile.title.field': 'Title',
      'settings.profile.titlePlaceholder': 'Dr., Prof., etc.',
      'settings.profile.phone': 'Phone',
      'settings.profile.email': 'Email',
      'settings.profile.cancel': 'Cancel',
      'settings.profile.save': 'Save',
      'settings.profile.saving': 'Saving...',
      'settings.profile.emergencyContact': 'Emergency Contact',
      'settings.profile.emergencyName': 'Name',
      'settings.profile.emergencyRelation': 'Relationship',
      'settings.profile.emergencyPhone': 'Phone',
      'settings.security.title': 'Account Security',
      'settings.security.emailVerified': 'Email Verified',
      'settings.security.emailNotVerified': 'Email Not Verified',
      'settings.security.twoFactor': 'Two-Factor Authentication',
      'settings.security.twoFactorEnabled': 'Enabled',
      'settings.security.twoFactorDisabled': 'Disabled',
      'settings.security.enableTwoFactor': 'Enable 2FA',
      'settings.security.lastUsed': 'Last used',
      'settings.notifications.title': 'Notification Preferences',
      'settings.notifications.email': 'Email Notifications',
      'settings.notifications.sms': 'SMS Notifications',
      'settings.notifications.push': 'Push Notifications',
      'settings.notifications.appointments': 'Appointment Reminders',
      'settings.notifications.systemAlerts': 'System Alerts',
      'settings.notifications.marketing': 'Marketing Messages',
      'settings.professional.title': 'Professional Information',
      'settings.professional.license': 'Professional License',
      'settings.professional.licenseNumber': 'License Number',
      'settings.professional.licenseState': 'State/Region',
      'settings.professional.licenseExpiry': 'License Expiry',
      'settings.professional.digitalSignature': 'Digital Signature',
      'settings.professional.uploadSignature': 'Upload Signature',
      'settings.badges.verified': 'Verified',
      'settings.badges.passwordless': 'Passwordless',
      'settings.badges.twoFactor': '2FA',
      'settings.message.saveSuccess': 'Settings saved successfully',
      'settings.message.saveError': 'Error saving settings',
      'settings.message.connectionError': 'Connection error',
      'settings.tabs.voice': 'Voice & Speech',
      'settings.voice.title': 'Voice & Speech',
      'settings.voice.ttsEnabled': 'Enable Text-to-Speech',
      'settings.voice.ttsHint': 'Speaker button will appear on each response',
      'settings.voice.selectVoice': 'Select Voice',
      'settings.voice.searchPlaceholder': 'Search by name or accent...',
      'settings.voice.englishOnly': 'English voices only',
      'settings.voice.allCategories': 'All',
      'settings.voice.premade': 'Premade',
      'settings.voice.cloned': 'Cloned',
      'settings.voice.professional': 'Professional',
      'settings.voice.noResults': 'No voices found',
      'settings.voice.preview': 'Preview',
      'settings.voice.selected': 'Selected',
      'settings.voice.loading': 'Loading voices...',
      'settings.voice.loadError': 'Error loading voices',
      'settings.voice.retry': 'Retry',
      'settings.voice.filterGender': 'Gender',
      'settings.voice.male': 'Male',
      'settings.voice.female': 'Female',
      'settings.voice.saveVoice': 'Save Voice Settings',
    };
    return labels[key] || key;
  };

  // Update active tab when initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab === 'account' ? 'profile' : initialTab);
    }
  }, [isOpen, initialTab]);

  // Helper to populate form from a user data object
  const populateForm = useCallback((data) => {
    setFormData({
      firstName: data.profile?.firstName || data.firstName || '',
      lastName: data.profile?.lastName || data.lastName || '',
      title: data.profile?.title || data.title || '',
      phone: data.profile?.phone || data.phone || '',
      email: data.email || '',
      // Emergency contact
      emergencyName: data.profile?.emergencyContact?.name || '',
      emergencyRelation: data.profile?.emergencyContact?.relationship || '',
      emergencyPhone: data.profile?.emergencyContact?.phone || '',
      // Timezone
      timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      // Notifications
      emailNotifications: data.notificationPreferences?.email !== false,
      smsNotifications: data.notificationPreferences?.sms || false,
      pushNotifications: data.notificationPreferences?.push || false,
      appointmentReminders: data.notificationPreferences?.appointmentReminders !== false,
      systemAlerts: data.notificationPreferences?.systemAlerts !== false,
      marketingMessages: data.notificationPreferences?.marketingMessages || false,
      // Provider fields
      licenseNumber: data.providerInfo?.licenseNumber || '',
      licenseState: data.providerInfo?.licenseState || '',
      licenseExpiry: data.providerInfo?.licenseExpiry ?
        new Date(data.providerInfo.licenseExpiry).toISOString().split('T')[0] : '',
    });
  }, []);

  // Fetch saved settings from API when modal opens (ensures latest DB data)
  useEffect(() => {
    if (isOpen) {
      secureApi.get('/api/user/settings').then(res => {
        if (res?.user) {
          populateForm(res.user);
          // Sync TTS preferences from DB to secureStorage (survives browser close)
          const tts = res.user.ttsPreferences;
          if (tts) {
            if (tts.voiceId) {
              secureStorage.setItem('ttsVoiceId', tts.voiceId);
              setSelectedVoiceId(tts.voiceId);
            }
            if (tts.enabled !== undefined) {
              secureStorage.setItem('ttsEnabled', String(tts.enabled));
              setTtsEnabled(tts.enabled);
            }
            if (tts.modelId) {
              secureStorage.setItem('ttsModelId', tts.modelId);
            }
          }
        }
      }).catch(() => {
        // Fallback to auth context data
        if (userInfo) populateForm(userInfo);
      });
    }
  }, [isOpen, populateForm]);

  // Also initialize from userInfo if available before API responds
  useEffect(() => {
    if (userInfo) populateForm(userInfo);
  }, [userInfo, populateForm]);

  // Build tabs array
  const tabs = [
    { id: 'profile', label: t('settings.tabs.profile'), icon: '👤' },
    { id: 'security', label: t('settings.tabs.security'), icon: '🔒' },
    { id: 'notifications', label: t('settings.tabs.notifications'), icon: '🔔' },
    { id: 'voice', label: t('settings.tabs.voice'), icon: '🎙️' },
  ];

  // Add professional tab for clinical roles (doctor / nurse)
  if (isClinicalRole(primaryRole(userInfo?.roles))) {
    tabs.push({ id: 'professional', label: t('settings.tabs.professional'), icon: '🏥' });
  }

  // Get title for the current active tab
  const getContentTitle = () => {
    const tabTitles = {
      profile: t('settings.profile.title'),
      security: t('settings.security.title'),
      notifications: t('settings.notifications.title'),
      voice: t('settings.voice.title'),
      professional: t('settings.professional.title'),
    };
    return tabTitles[activeTab] || t('settings.title');
  };

  // Load voices and models when voice tab is selected
  const loadVoicesAndModels = useCallback(async () => {
    if (voicesLoadedRef.current) return;
    setVoicesLoading(true);
    setVoicesError(null);
    try {
      const voicesRes = await secureApi.get('/api/tts/voices');
      setVoices(voicesRes.voices || []);
      voicesLoadedRef.current = true;
    } catch (err) {
      console.error('[UserSettings] Failed to load voices:', err);
      setVoicesError(err.message || 'Failed to load voices');
    } finally {
      setVoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'voice' && !voicesLoadedRef.current) {
      loadVoicesAndModels();
    }
  }, [activeTab, loadVoicesAndModels]);

  // Clean up preview audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const playPreview = useCallback((voiceId, previewUrl) => {
    // Stop current preview if any
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      if (previewingVoiceId === voiceId) {
        setPreviewingVoiceId(null);
        return;
      }
    }
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    previewAudioRef.current = audio;
    setPreviewingVoiceId(voiceId);
    audio.onended = () => {
      setPreviewingVoiceId(null);
      previewAudioRef.current = null;
    };
    audio.onerror = () => {
      setPreviewingVoiceId(null);
      previewAudioRef.current = null;
    };
    audio.play().catch(() => {
      setPreviewingVoiceId(null);
      previewAudioRef.current = null;
    });
  }, [previewingVoiceId]);

  const saveVoiceSettings = useCallback(async () => {
    // Save to secureStorage (session cache)
    secureStorage.setItem('ttsEnabled', String(ttsEnabled));
    secureStorage.setItem('ttsVoiceId', selectedVoiceId);
    // Persist to MongoDB so it survives browser close
    try {
      await secureApi.put('/api/user/settings', {
        ttsPreferences: {
          enabled: ttsEnabled,
          voiceId: selectedVoiceId,
          modelId: secureStorage.getItem('ttsModelId') || '',
        }
      });
    } catch (err) {
      console.error('[UserSettings] Failed to save TTS preferences to DB:', err);
    }
    setVoicesDirty(false);
    setMessage({ type: 'success', text: t('settings.message.saveSuccess') });
  }, [ttsEnabled, selectedVoiceId, t]);

  // English-only accents — filter out non-English voices
  const ENGLISH_ACCENTS = new Set([
    'american', 'british', 'australian', 'irish', 'indian',
    'south african', 'scottish', 'canadian', 'new zealand',
  ]);

  // Filter voices
  const filteredVoices = voices.filter(v => {
    // English accent filter — only show voices with English-compatible accents
    const accent = v.labels?.accent?.toLowerCase();
    if (accent && !ENGLISH_ACCENTS.has(accent)) return false;
    // Search filter
    if (voiceSearch) {
      const q = voiceSearch.toLowerCase();
      const nameMatch = v.name?.toLowerCase().includes(q);
      const accentMatch = v.labels?.accent?.toLowerCase().includes(q);
      const descMatch = v.description?.toLowerCase().includes(q);
      if (!nameMatch && !accentMatch && !descMatch) return false;
    }
    // Category filter
    if (voiceCategoryFilter !== 'all' && v.category !== voiceCategoryFilter) return false;
    // Gender filter
    if (voiceGenderFilter !== 'all' && v.labels?.gender !== voiceGenderFilter) return false;
    return true;
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await secureApi.put('/api/user/settings', {
        ...formData,
        profile: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          title: formData.title,
          phone: formData.phone,
            emergencyContact: {
              name: formData.emergencyName,
              relationship: formData.emergencyRelation,
              phone: formData.emergencyPhone
            }
          },
          notificationPreferences: {
            email: formData.emailNotifications,
            sms: formData.smsNotifications,
            push: formData.pushNotifications,
            appointmentReminders: formData.appointmentReminders,
            systemAlerts: formData.systemAlerts,
            marketingMessages: formData.marketingMessages
          }
        }
      );

      if (!result.error) {
        setMessage({ type: 'success', text: t('settings.message.saveSuccess') });
        setIsEditing(false);
        if (onUpdateUser) {
          onUpdateUser(result.user);
        }
      } else {
        setMessage({ type: 'error', text: result.message || t('settings.message.saveError') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.message.connectionError') });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="user-settings-overlay" onClick={onClose}>
      <div className="user-settings-modal" onClick={e => e.stopPropagation()}>

        {/* ═══ LEFT SIDEBAR ═══ */}
        <div className="settings-sidebar">
          {/* User Profile */}
          <div className="sidebar-profile">
            <div className="sidebar-avatar">
              {formData.firstName && formData.lastName ?
                `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase() :
                formData.email ? formData.email[0].toUpperCase() : 'U'}
            </div>
            <div className="sidebar-user-name">
              {formData.title && `${formData.title} `}
              {formData.firstName && formData.lastName ?
                `${formData.firstName} ${formData.lastName}` :
                formData.email || 'User'}
            </div>
            <p className="sidebar-user-email">{formData.email}</p>
            <div className="sidebar-badges">
              {userInfo?.emailVerified && (
                <span className="badge badge-verified">
                  ✓ {t('settings.badges.verified')}
                </span>
              )}
              {userInfo?.isPasswordless !== false && (
                <span className="badge badge-passwordless">
                  🔐 {t('settings.badges.passwordless')}
                </span>
              )}
              {userInfo?.security?.mfaEnabled && (
                <span className="badge badge-mfa">
                  🛡️ {t('settings.badges.twoFactor')}
                </span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="sidebar-nav">
            <div className="sidebar-nav-label">{t('settings.title')}</div>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="nav-icon">{tab.icon}</span>
                <span className="nav-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* ═══ RIGHT CONTENT PANEL ═══ */}
        <div className="settings-main">
          {/* Content Header with title and close button */}
          <div className="settings-content-header">
            <h2 className="settings-content-title">{getContentTitle()}</h2>
            <button className="close-button" onClick={onClose} title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="settings-content">
            {message && (
              <div className={`message ${message.type}`}>
                <span className="message-icon">
                  {message.type === 'success' ? '✓' : '⚠'}
                </span>
                {message.text}
              </div>
            )}

            {/* ─── PROFILE TAB ─── */}
            {activeTab === 'profile' && (
              <div className="tab-content">
                <div className="section-header">
                  <h3>{t('settings.profile.title')}</h3>
                  {!isEditing && (
                    <button
                      className="edit-button"
                      onClick={() => setIsEditing(true)}
                    >
                      ✏️ {t('settings.profile.edit')}
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('settings.profile.firstName')}</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={!isEditing ? 'disabled' : ''}
                      dir="ltr"
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('settings.profile.lastName')}</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={!isEditing ? 'disabled' : ''}
                      dir="ltr"
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('settings.profile.title.field')}</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder={t('settings.profile.titlePlaceholder')}
                      disabled={!isEditing}
                      className={!isEditing ? 'disabled' : ''}
                      dir="ltr"
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('settings.profile.phone')}</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={!isEditing ? 'disabled' : ''}
                      dir="ltr"
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('settings.profile.email')}</label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="disabled"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Emergency Contact Section */}
                <div className="form-section">
                  <h4>{t('settings.profile.emergencyContact')}</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>{t('settings.profile.emergencyName')}</label>
                      <input
                        type="text"
                        name="emergencyName"
                        value={formData.emergencyName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={!isEditing ? 'disabled' : ''}
                        dir="ltr"
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('settings.profile.emergencyRelation')}</label>
                      <input
                        type="text"
                        name="emergencyRelation"
                        value={formData.emergencyRelation}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={!isEditing ? 'disabled' : ''}
                        dir="ltr"
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('settings.profile.emergencyPhone')}</label>
                      <input
                        type="tel"
                        name="emergencyPhone"
                        value={formData.emergencyPhone}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={!isEditing ? 'disabled' : ''}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="section-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setIsEditing(false);
                        // Reset form data
                        setFormData(prev => ({
                          ...prev,
                          firstName: userInfo.profile?.firstName || userInfo.firstName || '',
                          lastName: userInfo.profile?.lastName || userInfo.lastName || '',
                          title: userInfo.profile?.title || userInfo.title || '',
                          phone: userInfo.profile?.phone || userInfo.phone || '',
                          emergencyName: userInfo.profile?.emergencyContact?.name || '',
                          emergencyRelation: userInfo.profile?.emergencyContact?.relationship || '',
                          emergencyPhone: userInfo.profile?.emergencyContact?.phone || ''
                        }));
                      }}
                    >
                      {t('settings.profile.cancel')}
                    </button>
                    <button
                      className="btn-primary"
                      onClick={handleSubmit}
                      disabled={isLoading}
                    >
                      {isLoading ? t('settings.profile.saving') : t('settings.profile.save')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── SECURITY TAB ─── */}
            {activeTab === 'security' && (
              <div className="tab-content">
                <div className="security-card">
                  <div className="security-item">
                    <div className="security-icon">📧</div>
                    <div className="security-content">
                      <h4>{t('settings.profile.email')}</h4>
                      <p className={userInfo?.emailVerified ? 'status-enabled' : 'status-warning'}>
                        {userInfo?.emailVerified ?
                          t('settings.security.emailVerified') :
                          t('settings.security.emailNotVerified')}
                      </p>
                    </div>
                  </div>

                  <div className="security-item">
                    <div className="security-icon">🛡️</div>
                    <div className="security-content">
                      <h4>{t('settings.security.twoFactor')}</h4>
                      <p className={userInfo?.security?.mfaEnabled ? 'status-enabled' : 'status-disabled'}>
                        {userInfo?.security?.mfaEnabled ?
                          t('settings.security.twoFactorEnabled') :
                          t('settings.security.twoFactorDisabled')}
                      </p>
                      {userInfo?.security?.mfaEnabled && userInfo?.security?.mfaLastUsed && (
                        <p className="mfa-last-used">
                          {t('settings.security.lastUsed')}: {formatDateTime(userInfo.security.mfaLastUsed)}
                        </p>
                      )}
                      {!userInfo?.security?.mfaEnabled && (
                        <button
                          className="btn-action"
                          onClick={() => setShowMFASetup(true)}
                          style={{ marginTop: 10 }}
                        >
                          {t('settings.security.enableTwoFactor')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* ─── NOTIFICATIONS TAB ─── */}
            {activeTab === 'notifications' && (
              <div className="tab-content">
                <div className="notification-toggles">
                  {[
                    { name: 'emailNotifications', label: t('settings.notifications.email') },
                    { name: 'smsNotifications', label: t('settings.notifications.sms') },
                    { name: 'pushNotifications', label: t('settings.notifications.push') },
                    { name: 'appointmentReminders', label: t('settings.notifications.appointments') },
                    { name: 'systemAlerts', label: t('settings.notifications.systemAlerts') },
                    { name: 'marketingMessages', label: t('settings.notifications.marketing') },
                  ].map(item => (
                    <div key={item.name} className="toggle-item">
                      <span className="toggle-label">{item.label}</span>
                      <label className="switch">
                        <input
                          type="checkbox"
                          name={item.name}
                          checked={formData[item.name]}
                          onChange={handleInputChange}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="section-actions" style={{ marginTop: 20 }}>
                  <button
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? t('settings.profile.saving') : t('settings.profile.save')}
                  </button>
                </div>
              </div>
            )}

            {/* ─── VOICE TAB ─── */}
            {activeTab === 'voice' && (
              <div className="tab-content">
                {/* TTS Enable Toggle */}
                <div className="voice-setting-card">
                  <div className="toggle-item" style={{ border: 'none', padding: 0, background: 'transparent' }}>
                    <div className="toggle-label">
                      <span>{t('settings.voice.ttsEnabled')}</span>
                      <small>{t('settings.voice.ttsHint')}</small>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={ttsEnabled}
                        onChange={(e) => {
                          setTtsEnabled(e.target.checked);
                          setVoicesDirty(true);
                        }}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>

                {ttsEnabled && (
                  <>
                    {/* Voice Browser */}
                    <div className="voice-browser" style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h4 style={{ margin: 0 }}>{t('settings.voice.selectVoice')}</h4>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(96, 165, 250, 0.15)',
                          color: '#74AEFF',
                          fontWeight: 600,
                          letterSpacing: '0.3px',
                        }}>
                          {t('settings.voice.englishOnly')}
                        </span>
                      </div>

                      {/* Search and Filters */}
                      <div className="voice-search-bar">
                        <div className="voice-search-input-wrap">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93A2BE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                          </svg>
                          <input
                            type="text"
                            className="voice-search-input"
                            placeholder={t('settings.voice.searchPlaceholder')}
                            value={voiceSearch}
                            onChange={(e) => setVoiceSearch(e.target.value)}
                            dir="ltr"
                          />
                        </div>
                      </div>

                      {/* Category Chips */}
                      <div className="voice-filter-chips">
                        {[
                          { id: 'all', label: t('settings.voice.allCategories') },
                          { id: 'premade', label: t('settings.voice.premade') },
                          { id: 'cloned', label: t('settings.voice.cloned') },
                          { id: 'professional', label: t('settings.voice.professional') },
                        ].map(cat => (
                          <button
                            key={cat.id}
                            className={`voice-chip ${voiceCategoryFilter === cat.id ? 'active' : ''}`}
                            onClick={() => setVoiceCategoryFilter(cat.id)}
                          >
                            {cat.label}
                          </button>
                        ))}
                        <span className="voice-chip-separator" />
                        {[
                          { id: 'all', label: t('settings.voice.filterGender') },
                          { id: 'male', label: t('settings.voice.male') },
                          { id: 'female', label: t('settings.voice.female') },
                        ].map(g => (
                          <button
                            key={`g-${g.id}`}
                            className={`voice-chip ${voiceGenderFilter === g.id ? 'active' : ''}`}
                            onClick={() => setVoiceGenderFilter(g.id)}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>

                      {/* Voice List */}
                      {voicesLoading && (
                        <div className="voice-loading">
                          <div className="voice-spinner" />
                          <span>{t('settings.voice.loading')}</span>
                        </div>
                      )}

                      {voicesError && (
                        <div className="voice-error">
                          <span>{t('settings.voice.loadError')}</span>
                          <button className="btn-action" onClick={() => { voicesLoadedRef.current = false; loadVoicesAndModels(); }}>
                            {t('settings.voice.retry')}
                          </button>
                        </div>
                      )}

                      {!voicesLoading && !voicesError && filteredVoices.length === 0 && voices.length > 0 && (
                        <div className="voice-empty">{t('settings.voice.noResults')}</div>
                      )}

                      {!voicesLoading && !voicesError && filteredVoices.length > 0 && (
                        <div className="voice-list">
                          {filteredVoices.map(v => {
                            const isSelected = selectedVoiceId === v.voice_id;
                            const isPreviewing = previewingVoiceId === v.voice_id;
                            return (
                              <div
                                key={v.voice_id}
                                className={`voice-row ${isSelected ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedVoiceId(v.voice_id);
                                  setVoicesDirty(true);
                                }}
                              >
                                {/* Play/Pause preview */}
                                <button
                                  className={`voice-row-play ${isPreviewing ? 'playing' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playPreview(v.voice_id, v.preview_url);
                                  }}
                                  title={t('settings.voice.preview')}
                                >
                                  {isPreviewing ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                      <rect x="6" y="4" width="4" height="16" rx="1"/>
                                      <rect x="14" y="4" width="4" height="16" rx="1"/>
                                    </svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                      <polygon points="5 3 19 12 5 21 5 3"/>
                                    </svg>
                                  )}
                                </button>

                                {/* Voice info */}
                                <div className="voice-row-info">
                                  <span className="voice-row-name">{v.name}</span>
                                  <span className="voice-row-meta">
                                    {[v.labels?.accent, v.labels?.gender, v.labels?.age, v.category].filter(Boolean).join(' · ')}
                                  </span>
                                </div>

                                {/* Selection indicator */}
                                {isSelected && (
                                  <svg className="voice-row-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#74AEFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Save Button */}
                <div className="section-actions" style={{ marginTop: 20 }}>
                  <button
                    className="btn-primary"
                    onClick={saveVoiceSettings}
                    disabled={!voicesDirty}
                  >
                    {t('settings.voice.saveVoice')}
                  </button>
                </div>
              </div>
            )}

            {/* ─── PROFESSIONAL TAB ─── */}
            {activeTab === 'professional' && isClinicalRole(primaryRole(userInfo?.roles)) && (
              <div className="tab-content">
                <div className="professional-section">
                  <h4>{t('settings.professional.license')}</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>{t('settings.professional.licenseNumber')}</label>
                      <input
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={!isEditing ? 'disabled' : ''}
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('settings.professional.licenseState')}</label>
                      <input
                        type="text"
                        name="licenseState"
                        value={formData.licenseState}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={!isEditing ? 'disabled' : ''}
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('settings.professional.licenseExpiry')}</label>
                      <input
                        type="date"
                        name="licenseExpiry"
                        value={formData.licenseExpiry}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={!isEditing ? 'disabled' : ''}
                      />
                    </div>
                  </div>

                  {userInfo?.providerInfo?.digitalSignature && (
                    <div className="signature-section">
                      <h4>{t('settings.professional.digitalSignature')}</h4>
                      {userInfo.providerInfo.digitalSignature.imageUrl ? (
                        <img
                          src={userInfo.providerInfo.digitalSignature.imageUrl}
                          alt="Digital Signature"
                          className="signature-preview"
                        />
                      ) : (
                        <button className="btn-action">
                          {t('settings.professional.uploadSignature')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showMFASetup && (
        <MFASetup
          userId={userInfo?.id || userInfo?._id}
          onClose={() => setShowMFASetup(false)}
          onSuccess={() => {
            setShowMFASetup(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default UserSettings;
