/**
 * Static Translation Loader
 * Loads translations from static JSON files for instant performance
 */

// Import static translation files
import enTranslations from '../translations/en.json';
import heTranslations from '../translations/he.json';
import languageIndex from '../translations/index.json';

// Static translation cache
const staticTranslations = {
  en: enTranslations,
  he: heTranslations
};

/**
 * Get translations for a specific language instantly
 * @param {string} language - Language code (en, he)
 * @returns {Object} Translation data
 */
export const getStaticTranslations = (language) => {
  const translationData = staticTranslations[language];
  
  if (!translationData) {
    process.env.NODE_ENV !== 'production' && console.warn(`❌ [STATIC] No static translations found for language: ${language}`);
    return null;
  }
  
  process.env.NODE_ENV !== 'production' && console.log(`⚡ [STATIC] Loaded ${translationData.translationCount} translations for ${language} instantly`);
  
  return {
    language: translationData.language,
    languageName: translationData.languageName,
    isRTL: translationData.isRTL,
    translations: translationData.translations,
    version: translationData.version,
    lastUpdated: translationData.lastUpdated,
    source: 'STATIC_FILE',
    translationCount: translationData.translationCount
  };
};

/**
 * Get available languages from static index
 * @returns {Array} Available languages
 */
export const getAvailableLanguages = () => {
  process.env.NODE_ENV !== 'production' && console.log(`⚡ [STATIC] Loaded ${languageIndex.totalLanguages} available languages instantly`);
  return languageIndex.languages;
};

/**
 * Check if a language is available in static files
 * @param {string} language - Language code
 * @returns {boolean} Whether language is available
 */
export const isLanguageAvailable = (language) => {
  return !!staticTranslations[language];
};

/**
 * Get all supported language codes
 * @returns {Array} Array of language codes
 */
export const getSupportedLanguages = () => {
  return Object.keys(staticTranslations);
};

/**
 * Preload all translations (they're already loaded as imports)
 * This function exists for compatibility but does nothing since imports are already loaded
 */
export const preloadTranslations = () => {
  process.env.NODE_ENV !== 'production' && console.log(`⚡ [STATIC] All translations already preloaded via imports`);
  return Promise.resolve();
};

export default {
  getStaticTranslations,
  getAvailableLanguages,
  isLanguageAvailable,
  getSupportedLanguages,
  preloadTranslations
};
