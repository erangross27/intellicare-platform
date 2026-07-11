/**
 * Region Detection Utility
 * Detects user's region without requiring location permissions
 * Uses multiple signals for accurate detection
 */

/**
 * Detect if user is likely in the US based on browser signals
 * @returns {boolean} true if likely US user
 */
export const isLikelyUSUser = () => {
  try {
    // 1. Check browser language
    const browserLang = navigator.language || navigator.userLanguage || '';
    const isEnglishUS = browserLang.toLowerCase().includes('en-us');

    // 2. Check timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const isUSTimezone = timezone.includes('America/') &&
                        !timezone.includes('America/Toronto') && // Exclude Canada
                        !timezone.includes('America/Mexico');     // Exclude Mexico

    // 3. Check date format preference (US uses MM/DD/YYYY)
    const dateFormat = new Intl.DateTimeFormat(browserLang).format(new Date('2024-03-15'));
    const isUSDateFormat = dateFormat.startsWith('3/'); // US format starts with month

    // 4. Check if browser language list includes Hebrew
    const languages = navigator.languages || [navigator.language];
    const hasHebrew = languages.some(lang => lang.toLowerCase().includes('he'));

    // Decision logic:
    // - If has Hebrew in language list, probably Israeli
    // - If US timezone AND English-US, very likely US
    // - If just English-US with US date format, likely US

    if (hasHebrew) {
      return false; // Israeli user
    }

    if (isUSTimezone && isEnglishUS) {
      return true; // Very likely US user
    }

    if (isEnglishUS && isUSDateFormat) {
      return true; // Likely US user
    }

    // Check for other strong US indicators
    if (isUSTimezone) {
      return true; // In US timezone
    }

    return false;
  } catch (error) {
    console.error('Error detecting region:', error);
    return false; // Default to showing language switcher
  }
};

/**
 * Detect if user is likely in Israel
 * @returns {boolean} true if likely Israeli user
 */
export const isLikelyIsraeliUser = () => {
  try {
    // Check for Hebrew language
    const browserLang = navigator.language || navigator.userLanguage || '';
    const languages = navigator.languages || [navigator.language];
    const hasHebrew = languages.some(lang => lang.toLowerCase().includes('he'));

    // Check for Israel timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const isIsraelTimezone = timezone.includes('Jerusalem') || timezone.includes('Israel');

    return hasHebrew || isIsraelTimezone;
  } catch (error) {
    console.error('Error detecting Israeli user:', error);
    return false;
  }
};

/**
 * Get recommended UI language based on region
 * @returns {string} 'en' or 'he'
 */
export const getRecommendedLanguage = () => {
  if (isLikelyIsraeliUser()) {
    return 'he';
  }
  return 'en';
};

/**
 * Should show language switcher based on region
 * @returns {boolean} true if switcher should be visible
 */
export const shouldShowLanguageSwitcher = () => {
  // Hide for US users, show for everyone else
  return !isLikelyUSUser();
};

/**
 * Get available languages based on region
 * @returns {string[]} array of available language codes
 */
export const getAvailableLanguagesByRegion = () => {
  if (isLikelyUSUser()) {
    return ['en']; // English only for US users
  }
  return ['en', 'he']; // Both languages for other regions
};

// Debug function for development
export const debugRegionDetection = () => {
  const info = {
    browserLanguage: navigator.language,
    languages: navigator.languages,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: new Intl.DateTimeFormat(navigator.language).format(new Date('2024-03-15')),
    isUSUser: isLikelyUSUser(),
    isIsraeliUser: isLikelyIsraeliUser(),
    recommendedLanguage: getRecommendedLanguage(),
    showSwitcher: shouldShowLanguageSwitcher()
  };

  console.log('🌍 Region Detection Debug:', info);
  return info;
};