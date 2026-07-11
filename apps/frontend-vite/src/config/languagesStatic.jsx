import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { getStaticTranslations, getAvailableLanguages } from './staticTranslations';
import { detectPracticeLanguage, applyDetectedLanguage } from '../services/practiceLanguageDetector';
import { isLikelyUSUser, getRecommendedLanguage } from '../utils/regionDetector';

import secureStorage from '../utils/secureStorage';
// Language Context
const LanguageContext = createContext();

// Language Provider Component
export const LanguageProvider = ({ children }) => {
  // Try to get auth context, but don't fail if it's not available
  // This avoids circular dependency while still using auth data when available
  const [authData, setAuthData] = useState({ user: null, practice: null });

  // We'll get auth data through a different method to avoid circular dependency
  useEffect(() => {
    // Check for auth data in a way that doesn't create circular dependency
    const checkAuthData = () => {
      // Look for auth context data if it exists in the DOM or window
      if (window.__AUTH_DATA__) {
        setAuthData(window.__AUTH_DATA__);
      }
    };

    checkAuthData();
    // Listen for auth updates
    window.addEventListener('authUpdate', checkAuthData);
    return () => window.removeEventListener('authUpdate', checkAuthData);
  }, []);

  const { user, practice } = authData;

  // Check if we're on a subdomain
  const isSubdomain = () => {
    const hostname = window.location.hostname;
    return hostname !== 'localhost' && hostname !== 'intellicare.health' && hostname !== 'www.intellicare.health';
  };

  // 🚀 STATIC TRANSLATIONS: Initialize with static files for instant loading
  const initializeLanguageData = () => {
    // Detect language based on hostname/subdomain
    const hostname = window.location.hostname;
    const detectedConfig = detectPracticeLanguage(hostname);
    
    // Apply detected language to document
    applyDetectedLanguage(hostname);
    
    let savedLanguage;

    // Check if US user - force English
    if (isLikelyUSUser()) {
      savedLanguage = 'en';
      secureStorage.setItem('selectedLanguage', 'en');
      process.env.NODE_ENV !== 'production' && console.log(`🇺🇸 [FRONTEND] US user detected - forcing English`);
    } else if (!detectedConfig.allowSwitcher) {
      // If on subdomain (not parent domain), force detected language
      savedLanguage = detectedConfig.language;
      secureStorage.setItem('selectedLanguage', detectedConfig.language);
      process.env.NODE_ENV !== 'production' && console.log(`🏥 [FRONTEND] Forcing practice language: ${savedLanguage} (detected from ${detectedConfig.detectedFrom})`);
    } else if (isSubdomain() && practice?.settings?.language) {
      // Use practice setting if available
      savedLanguage = practice.settings.language;
      process.env.NODE_ENV !== 'production' && console.log(`🏥 [FRONTEND] Using practice setting language: ${savedLanguage}`);
    } else {
      // Parent domain or no detection - use saved preference or recommended language
      savedLanguage = secureStorage.getItem('selectedLanguage') || getRecommendedLanguage() || 'en';
      process.env.NODE_ENV !== 'production' && console.log(`🌐 [FRONTEND] Using saved/recommended language: ${savedLanguage}`);
    }
    
    process.env.NODE_ENV !== 'production' && console.log(`🚀 [FRONTEND] Initializing with static translations for: ${savedLanguage}`);

    try {
      // Load translations from static files instantly
      const staticData = getStaticTranslations(savedLanguage);
      
      if (staticData) {
        process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] INSTANT STATIC LOAD: ${staticData.translationCount} translations for ${savedLanguage}`);
        process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] Sample static translations:`, {
          home: staticData.translations.home,
          diagnosis: staticData.translations.diagnosis,
          patients: staticData.translations.patients
        });

        return {
          language: savedLanguage,
          translations: staticData.translations,
          isRTL: staticData.isRTL,
          loading: false,
          allowSwitcher: detectedConfig.allowSwitcher
        };
      } else {
        process.env.NODE_ENV !== 'production' && console.warn(`❌ [FRONTEND] No static translations found for ${savedLanguage}, falling back to English`);
        const fallbackData = getStaticTranslations('en');
        if (fallbackData) {
          return {
            language: 'en',
            translations: fallbackData.translations,
            isRTL: false,
            loading: false
          };
        }
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error(`❌ [FRONTEND] Failed to load static translations:`, error);
    }

    // Ultimate fallback
    process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] Using minimal fallback translations`);
    return {
      language: savedLanguage,
      translations: {},
      isRTL: savedLanguage === 'he',
      loading: true
    };
  };

  const initialData = initializeLanguageData();

  const [currentLanguage, setCurrentLanguage] = useState(initialData.language);
  const [translations, setTranslations] = useState(initialData.translations);
  const [loading, setLoading] = useState(initialData.loading);
  const [isRTL, setIsRTL] = useState(initialData.isRTL);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [allowSwitcher, setAllowSwitcher] = useState(initialData.allowSwitcher !== false);

  // React to practice changes - update language when practice loads
  useEffect(() => {
    if (practice?.settings?.language) {
      const practiceLanguage = practice.settings.language;
      if (practiceLanguage !== currentLanguage) {
        process.env.NODE_ENV !== 'production' && console.log(`🏥 [FRONTEND] Practice loaded with language: ${practiceLanguage}, updating from ${currentLanguage}`);
        setCurrentLanguage(practiceLanguage);
        secureStorage.setItem('selectedLanguage', practiceLanguage);

        // Also update RTL setting
        const newIsRTL = practiceLanguage === 'he';
        setIsRTL(newIsRTL);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice?.settings?.language]); // Only react to practice language changes, not currentLanguage to avoid loops

  // Load available languages from static files
  const loadAvailableLanguages = useCallback(async () => {
    try {
      const languages = getAvailableLanguages();
      setAvailableLanguages(languages);
      process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] Loaded ${languages.length} available languages from static files`);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to load available languages:', error);
      // Fallback to default languages
      setAvailableLanguages([
        { code: 'en', name: 'English', isRTL: false },
        { code: 'he', name: 'עברית', isRTL: true }
      ]);
    }
  }, []);

  // Load translations for a specific language from static files
  const loadLanguage = useCallback(async (language) => {
    setLoading(true);
    process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] Loading static translations for: ${language}`);

    try {
      const staticData = getStaticTranslations(language);
      
      if (staticData) {
        setTranslations(staticData.translations);
        setIsRTL(staticData.isRTL);
        process.env.NODE_ENV !== 'production' && console.log(`✅ [FRONTEND] Successfully loaded ${staticData.translationCount} static translations for ${language}`);
      } else {
        process.env.NODE_ENV !== 'production' && console.warn(`❌ [FRONTEND] No static translations found for ${language}`);
        // Keep existing translations if new language not found
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error(`❌ [FRONTEND] Failed to load static translations for ${language}:`, error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Change language function
  const changeLanguage = useCallback((newLanguage) => {
    // Check if language change is allowed based on domain
    const hostname = window.location.hostname;
    const detectedConfig = detectPracticeLanguage(hostname);
    
    // Don't allow language change if switcher is disabled
    if (!detectedConfig.allowSwitcher) {
      process.env.NODE_ENV !== 'production' && console.log(`🏥 [FRONTEND] Language change blocked - practice forces ${detectedConfig.language}`);
      return;
    }
    
    process.env.NODE_ENV !== 'production' && console.log(`🌐 [FRONTEND] Changing language from ${currentLanguage} to ${newLanguage}`);
    
    if (newLanguage !== currentLanguage) {
      secureStorage.setItem('selectedLanguage', newLanguage);
      setCurrentLanguage(newLanguage);
    }
  }, [currentLanguage, practice]);

  // Load translations when language changes
  useEffect(() => {
    process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] Language changed to: ${currentLanguage}`);
    
    // Check if we already have translations for this language
    const testKey = 'home';
    const expectedValue = currentLanguage === 'he' ? 'בית' : 'Home';
    if (translations[testKey] !== expectedValue) {
      process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] Language mismatch detected, loading ${currentLanguage}...`);
      loadLanguage(currentLanguage);
    } else {
      process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] Translations already match ${currentLanguage}, skipping load`);
      setLoading(false);
    }
  }, [currentLanguage, loadLanguage, translations]);

  // Load available languages on mount
  useEffect(() => {
    process.env.NODE_ENV !== 'production' && console.log('📋 [FRONTEND] Loading available languages from static files...');
    loadAvailableLanguages();
  }, [loadAvailableLanguages]);

  // Update language when practice changes (for subdomains)
  useEffect(() => {
    if (isSubdomain() && practice?.settings?.language && practice.settings.language !== currentLanguage) {
      process.env.NODE_ENV !== 'production' && console.log(`🏥 [FRONTEND] Setting language to practice preference: ${practice.settings.language}`);
      setCurrentLanguage(practice.settings.language);
    }
  }, [practice]);

  // Translation function with parameter substitution
  const t = useCallback((key, params = {}) => {
    // Always try to use translations, never show loading dots
    const translation = translations[key];

    if (translation) {
      // Replace parameters in the translation string
      let translatedString = translation;
      Object.keys(params).forEach(param => {
        const regex = new RegExp(`{${param}}`, 'g');
        translatedString = translatedString.replace(regex, params[param]);
      });

      return translatedString;
    } else {
      // Always return the key as fallback, never show "..."
      if (Object.keys(translations).length > 10) {
        process.env.NODE_ENV !== 'production' && console.warn(`❌ [FRONTEND] Translation missing for key: '${key}' in language: ${currentLanguage}`);
      }
      return key; // Always return key, never "..."
    }
  }, [translations, currentLanguage]);

  // Refresh translations function
  const refreshTranslations = useCallback(() => {
    loadLanguage(currentLanguage);
  }, [loadLanguage, currentLanguage]);

  // Clear cache function (not needed for static files, but kept for compatibility)
  const clearTranslationCache = useCallback(() => {
    process.env.NODE_ENV !== 'production' && console.log(`🗑️ [FRONTEND] Cache clear requested (not applicable for static files)`);
  }, []);

  const value = useMemo(() => ({
    currentLanguage,
    translations,
    loading,
    isRTL,
    availableLanguages,
    changeLanguage,
    t,
    refreshTranslations,
    clearTranslationCache,
    allowSwitcher
  }), [currentLanguage, translations, loading, isRTL, availableLanguages, changeLanguage, t, refreshTranslations, clearTranslationCache, allowSwitcher]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageProvider;
