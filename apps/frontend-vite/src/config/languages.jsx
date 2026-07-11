import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStaticTranslations, getAvailableLanguages } from './staticTranslations';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
// Language Context
const LanguageContext = createContext();

// 🚀 GLOBAL CACHE: Prevent multiple cache misses during component re-initialization
let globalTranslationCache = null;
let globalCacheLanguage = null;

// Language Provider Component
export const LanguageProvider = ({ children }) => {
  // Safely get auth context - it might not be available initially
  let user = null;
  let updateLanguagePreference = null;
  
  try {
    const authContext = useAuth();
    user = authContext.user;
    updateLanguagePreference = authContext.updateLanguagePreference;
  } catch (error) {
    // AuthContext not available yet - this is fine, we'll work without it initially
    process.env.NODE_ENV !== 'production' && console.log('🔄 [FRONTEND] AuthContext not available yet, using localStorage only');
  }
  
  // 🚀 CRITICAL FIX: Initialize everything synchronously to prevent flash
  const initializeLanguageData = () => {
    const savedLanguage = secureStorage.getItem('selectedLanguage') || 'en';
    process.env.NODE_ENV !== 'production' && console.log(`🚀 [FRONTEND] Chrome restart - Initializing with saved language: ${savedLanguage}`);

    // � DEBUG: Check all localStorage keys
    // localStorage keys check removed for secureStorage compatibility
    // localStorage length check removed for secureStorage compatibility

    // �🚀 GLOBAL CACHE CHECK: Use global cache if available for this language
    if (globalTranslationCache && globalCacheLanguage === savedLanguage) {
      process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] GLOBAL CACHE HIT: Using global cache for ${savedLanguage}`);
      return {
        language: savedLanguage,
        translations: globalTranslationCache.translations,
        isRTL: globalTranslationCache.isRTL,
        loading: false
      };
    }

    try {
      const cacheKey = `translations_${savedLanguage}`;
      const cached = secureStorage.getItem(cacheKey);
      process.env.NODE_ENV !== 'production' && console.log(`🔍 [FRONTEND] Checking cache key: ${cacheKey}`);
      process.env.NODE_ENV !== 'production' && console.log(`🔍 [FRONTEND] Cache exists: ${!!cached}`);
      process.env.NODE_ENV !== 'production' && console.log(`🔍 [FRONTEND] Cache value length: ${cached ? cached.length : 0}`);

      if (cached) {
        const parsedCache = JSON.parse(cached);
        const cacheAge = Date.now() - parsedCache.timestamp;
        const maxAge = 30 * 60 * 1000; // 30 minutes

        process.env.NODE_ENV !== 'production' && console.log(`🔍 [FRONTEND] Cache age: ${Math.round(cacheAge / 1000)}s (max: ${maxAge / 1000}s)`);
        process.env.NODE_ENV !== 'production' && console.log(`🔍 [FRONTEND] Cache data structure:`, {
          hasData: !!parsedCache.data,
          hasTranslations: !!(parsedCache.data && parsedCache.data.translations),
          translationCount: parsedCache.data && parsedCache.data.translations ? Object.keys(parsedCache.data.translations).length : 0
        });

        if (cacheAge < maxAge && parsedCache.data && parsedCache.data.translations && Object.keys(parsedCache.data.translations).length > 0) {
          process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] INSTANT LOAD: Using cached data for ${savedLanguage}`);
          process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] Sample translations:`, {
            home: parsedCache.data.translations.home,
            diagnosis: parsedCache.data.translations.diagnosis,
            patients: parsedCache.data.translations.patients
          });

          // 🚀 STORE IN GLOBAL CACHE for subsequent re-initializations
          globalTranslationCache = {
            translations: parsedCache.data.translations,
            isRTL: parsedCache.data.isRTL || false
          };
          globalCacheLanguage = savedLanguage;

          return {
            language: savedLanguage,
            translations: parsedCache.data.translations,
            isRTL: parsedCache.data.isRTL || false,
            loading: false
          };
        } else {
          process.env.NODE_ENV !== 'production' && console.log(`❌ [FRONTEND] Cache invalid - age: ${cacheAge}, maxAge: ${maxAge}`);
        }
      } else {
        process.env.NODE_ENV !== 'production' && console.log(`📭 [FRONTEND] No cache found for key: ${cacheKey}`);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error(`❌ [FRONTEND] Failed to load cached data during init:`, error);
    }

    process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] No valid cache, will load from server. Language: ${savedLanguage}, RTL: ${savedLanguage === 'he'}`);
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

  // Startup logging
  useEffect(() => {
    // process.env.NODE_ENV !== 'production' && console.log('🚀 [FRONTEND] LanguageProvider initialized');
    // process.env.NODE_ENV !== 'production' && console.log('🌐 [FRONTEND] Starting translation system...');
    // process.env.NODE_ENV !== 'production' && console.log('📍 [FRONTEND] Backend API expected at: /api/translations');
  }, []);



  // 🚀 SIMPLIFIED CACHE: Check localStorage cache for specific language
  const getCachedTranslations = useCallback((language) => {
    try {
      const cacheKey = `translations_${language}`;
      const cached = secureStorage.getItem(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const cacheAge = Date.now() - parsedCache.timestamp;
        const maxAge = 30 * 60 * 1000; // 30 minutes cache

        if (cacheAge < maxAge && parsedCache.data && parsedCache.data.translations) {
          process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] Using cached translations for ${language} (${Object.keys(parsedCache.data.translations).length} keys)`);
          return parsedCache.data;
        } else {
          process.env.NODE_ENV !== 'production' && console.log(`🕒 [FRONTEND] Cache expired for ${language}, removing...`);
          secureStorage.removeItem(cacheKey);
        }
      } else {
        process.env.NODE_ENV !== 'production' && console.log(`📭 [FRONTEND] No cache found for ${language}`);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.warn(`❌ [FRONTEND] Cache read error for ${language}:`, error);
    }
    return null;
  }, []);

  // 🚀 PERFORMANCE CACHE: Save translations to localStorage and global cache
  const setCachedTranslations = useCallback((language, data) => {
    try {
      const cacheKey = `translations_${language}`;
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        language: language
      };
      secureStorage.setItem(cacheKey, JSON.stringify(cacheData));
      process.env.NODE_ENV !== 'production' && console.log(`💾 [FRONTEND] Cached translations for ${language} (${Object.keys(data.translations).length} keys)`);

      // 🚀 UPDATE GLOBAL CACHE for immediate availability
      globalTranslationCache = {
        translations: data.translations,
        isRTL: data.isRTL
      };
      globalCacheLanguage = language;
      process.env.NODE_ENV !== 'production' && console.log(`🌐 [FRONTEND] Updated global cache for ${language}`);

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.warn(`❌ [FRONTEND] Cache write error for ${language}:`, error);
    }
  }, []);

  // 🚀 NEW: Load specific translation keys for faster loading
  const loadSpecificKeys = useCallback(async (language, keys) => {
    process.env.NODE_ENV !== 'production' && console.log(`🎯 [FRONTEND] Loading specific keys for ${language}: ${keys.join(', ')}`);

    try {
      const data = await secureApi.get(`/translations/${language}/keys/${keys.join(',')}`);

      if (data.error) {
        throw new Error(data.error);
      }
      process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] Received ${data.data?.translationCount || 0} specific translations for ${language}`);

      if (data.success && data.data && data.data.translations) {
        const translationData = {
          translations: data.data.translations,
          isRTL: data.data.isRTL || false,
          languageName: data.data.languageName || language,
          source: 'DATABASE_FILTERED',
          lastUpdated: data.data.lastUpdated
        };

        // Merge with existing translations instead of replacing
        setTranslations(prev => ({
          ...prev,
          ...translationData.translations
        }));
        setIsRTL(translationData.isRTL);

        process.env.NODE_ENV !== 'production' && console.log(`✅ [FRONTEND] Successfully loaded ${Object.keys(translationData.translations).length} specific translations for ${language}`);
        return translationData.translations;
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error(`❌ [FRONTEND] Failed to load specific translations for ${language}:`, error);
      throw error;
    }
  }, []);

  // 🎯 CRITICAL PERFORMANCE FIX: Memoize loadLanguage with caching
  const loadLanguage = useCallback(async (language) => {
    setLoading(true);

    // 🚀 STEP 1: Check cache first
    const cachedData = getCachedTranslations(language);
    if (cachedData) {
      setTranslations(cachedData.translations);
      setIsRTL(cachedData.isRTL);
      setLoading(false);
      process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] Loaded ${Object.keys(cachedData.translations).length} translations from CACHE for ${language}`);
      return;
    }

    // 🚀 STEP 2: Fetch from server if not cached
    process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] Loading ${language} from database...`);
    try {
      const data = await secureApi.get(`/translations/${language}`);

      if (data.error) {
        throw new Error(data.error);
      }
      process.env.NODE_ENV !== 'production' && console.log(`📦 [FRONTEND] Database response received:`, {
        success: data.success,
        source: data.data?.source,
        translationCount: data.data?.translationCount,
        language: data.data?.language,
        isRTL: data.data?.isRTL
      });

      if (data.success && data.data && data.data.translations) {
        const translationData = {
          translations: data.data.translations,
          isRTL: data.data.isRTL || false,
          languageName: data.data.languageName || language,
          source: 'DATABASE',
          lastUpdated: data.data.lastUpdated
        };

        // 🚀 STEP 3: Cache the data
        setCachedTranslations(language, translationData);

        setTranslations(translationData.translations);
        setIsRTL(translationData.isRTL);
        process.env.NODE_ENV !== 'production' && console.log(`✅ [FRONTEND] Successfully loaded ${Object.keys(translationData.translations).length} translations from DATABASE for ${language}`);
        process.env.NODE_ENV !== 'production' && console.log(`🕒 [FRONTEND] Last updated: ${data.data.lastUpdated}`);
      } else {
        process.env.NODE_ENV !== 'production' && console.warn(`❌ [FRONTEND] Database response invalid for ${language}:`, data);
        throw new Error('Invalid database response structure');
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error(`❌ [FRONTEND] Failed to load translations from MongoDB for ${language}:`, error);
      // Use basic navigation translations as fallback
      const fallbackTranslations = language === 'he' ? {
        company: 'חברה',
        about: 'אודות',
        contact: 'צור קשר',
        signup: 'הרשמה',
        login: 'התחברות',
        home: 'בית'
      } : {
        company: 'Company',
        about: 'About',
        contact: 'Contact',
        signup: 'Sign Up',
        login: 'Login',
        home: 'Home'
      };
      setTranslations(fallbackTranslations);
      setIsRTL(language === 'he');
      process.env.NODE_ENV !== 'production' && console.log(`🔄 Using fallback translations for ${language}:`, fallbackTranslations);
    } finally {
      setLoading(false);
    }
  }, [getCachedTranslations, setCachedTranslations]); // 🎯 PERFORMANCE: Memoize with dependencies

  // Load translations when language changes
  useEffect(() => {
    process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] Language changed to: ${currentLanguage}`);

    // 🚀 PREVENT FLASH: Only load if we don't already have translations for this language
    if (Object.keys(translations).length === 0) {
      process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] No translations loaded, loading for ${currentLanguage}...`);
      loadLanguage(currentLanguage);
    } else {
      // Check if current translations match the current language by testing a key
      const testKey = 'home';
      const expectedValue = currentLanguage === 'he' ? 'בית' : 'Home';
      if (translations[testKey] !== expectedValue) {
        process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] Language mismatch detected, loading ${currentLanguage}...`);
        loadLanguage(currentLanguage);
      } else {
        process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] Translations already match ${currentLanguage}, skipping load`);
        setLoading(false);
      }
    }
  }, [currentLanguage, loadLanguage, translations]);

  // 🚀 PERFORMANCE CACHE: Cache available languages
  const loadAvailableLanguages = useCallback(async () => {
    try {
      // Check cache first
      const cacheKey = 'available_languages';
      const cached = secureStorage.getItem(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const cacheAge = Date.now() - parsedCache.timestamp;
        const maxAge = 60 * 60 * 1000; // 1 hour cache for available languages

        if (cacheAge < maxAge) {
          process.env.NODE_ENV !== 'production' && console.log(`⚡ [FRONTEND] Using cached available languages (${Math.round(cacheAge / 1000)}s old)`);
          setAvailableLanguages(parsedCache.data);
          return;
        } else {
          secureStorage.removeItem(cacheKey);
        }
      }

      const data = await secureApi.get('/translations');

      if (data.success) {
        const languages = data.data.map(lang => ({
          code: lang.language,
          name: lang.languageName,
          isRTL: lang.isRTL || false
        }));
        setAvailableLanguages(languages);

        // Cache the result
        const cacheData = {
          data: languages,
          timestamp: Date.now()
        };
        secureStorage.setItem(cacheKey, JSON.stringify(cacheData));
        process.env.NODE_ENV !== 'production' && console.log(`💾 [FRONTEND] Cached available languages (${languages.length} languages)`);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to load available languages:', error);
    }

    // Fallback to default languages if API fails
    if (availableLanguages.length === 0) {
      setAvailableLanguages([
        { code: 'en', name: 'English', isRTL: false },
        { code: 'he', name: 'עברית', isRTL: true }
      ]);
    }
  }, [availableLanguages.length]);

  // Load available languages on mount
  useEffect(() => {
    process.env.NODE_ENV !== 'production' && console.log('📋 [FRONTEND] Loading available languages from database...');
    loadAvailableLanguages();
  }, [loadAvailableLanguages]);

  const changeLanguage = useCallback(async (language) => {
    if (language !== currentLanguage) {
      setCurrentLanguage(language);
      // Save to localStorage for persistence
      secureStorage.setItem('selectedLanguage', language);

      // If user is logged in, save preference to database
      if (user && updateLanguagePreference) {
        try {
          await updateLanguagePreference(language);
          process.env.NODE_ENV !== 'production' && console.log(`💾 [FRONTEND] Language preference saved to user profile: ${language}`);
        } catch (error) {
          process.env.NODE_ENV !== 'production' && console.error('Failed to save language preference to database:', error);
          // Continue anyway - localStorage will still work
        }
      }
    }
  }, [currentLanguage, user, updateLanguagePreference]);

  // Translation function with parameter substitution
  const t = useCallback((key, params = {}) => {
    // 🚀 CRITICAL FIX: Never show "..." - always return something useful
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
      // 🚀 NEVER SHOW LOADING DOTS: Always return the key as fallback
      // This prevents the "..." flash completely
      if (Object.keys(translations).length > 10) {
        process.env.NODE_ENV !== 'production' && console.warn(`❌ [FRONTEND] Translation missing for key: '${key}' in language: ${currentLanguage}`);
      }
      return key; // Always return key, never "..."
    }
  }, [translations, currentLanguage]);

  // Initialize language from user preference when user data becomes available
  useEffect(() => {
    // Only update if user has a different preference than what's currently set
    if (user && user.preferredLanguage && user.preferredLanguage !== currentLanguage) {
      process.env.NODE_ENV !== 'production' && console.log(`👤 [FRONTEND] Using user's preferred language from database: ${user.preferredLanguage}`);
      process.env.NODE_ENV !== 'production' && console.log(`🔄 [FRONTEND] Changing language from ${currentLanguage} to ${user.preferredLanguage}`);
      setCurrentLanguage(user.preferredLanguage);
      // Also update localStorage to keep them in sync
      secureStorage.setItem('selectedLanguage', user.preferredLanguage);
    }
  }, [user?.preferredLanguage, currentLanguage, user]); // Include all dependencies

  // 🚀 PERFORMANCE CACHE: Clear cache function
  const clearTranslationCache = useCallback((language = null) => {
    try {
      if (language) {
        // Clear specific language cache
        const cacheKey = `translations_${language}`;
        secureStorage.removeItem(cacheKey);
        process.env.NODE_ENV !== 'production' && console.log(`🗑️ [FRONTEND] Cleared cache for ${language}`);
      } else {
        // Clear all translation caches
        // Clear common translation cache keys since we can't iterate secureStorage
        const commonKeys = ['translations_en', 'translations_he', 'available_languages'];
        commonKeys.forEach(key => {
          secureStorage.removeItem(key);
        });
        process.env.NODE_ENV !== 'production' && console.log(`🗑️ [FRONTEND] Cleared all translation caches`);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.warn(`❌ [FRONTEND] Cache clear error:`, error);
    }
  }, []);

  // 🎯 PERFORMANCE FIX: Memoize refreshTranslations function with cache clearing
  const refreshTranslations = useCallback((clearCache = false) => {
    if (clearCache) {
      clearTranslationCache(currentLanguage);
    }
    loadLanguage(currentLanguage);
  }, [loadLanguage, currentLanguage, clearTranslationCache]);

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
    loadSpecificKeys
  }), [currentLanguage, translations, loading, isRTL, availableLanguages, changeLanguage, t, refreshTranslations, clearTranslationCache, loadSpecificKeys]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook to use translations
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

// Export for backward compatibility
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  he: 'עברית'
};

export const DEFAULT_LANGUAGE = 'en';
