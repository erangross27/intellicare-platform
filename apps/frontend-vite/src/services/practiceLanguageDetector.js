/**
 * Practice Language Detector Service
 * Automatically detects the appropriate language based on practice subdomain
 */

// US state patterns for English-only practices
const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new-hampshire', 'new-jersey', 'new-mexico', 'new-york',
  'north-carolina', 'north-dakota', 'ohio', 'oklahoma', 'oregon',
  'pennsylvania', 'rhode-island', 'south-carolina', 'south-dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
  'west-virginia', 'wisconsin', 'wyoming', 'district-columbia', 'dc'
];

// Israeli location patterns for Hebrew default
const ISRAELI_PATTERNS = [
  'tel-aviv', 'telaviv', 'jerusalem', 'haifa', 'israel', 'herzliya',
  'netanya', 'ramat-gan', 'ramatgan', 'petah-tikva', 'petahtikva',
  'rishon-lezion', 'rishonlezion', 'ashdod', 'beersheba', 'beer-sheva',
  'holon', 'bnei-brak', 'bneibrak', 'bat-yam', 'batyam', 'rehovot',
  'ashkelon', 'hadera', 'kfar-saba', 'kfarsaba', 'modiin', 'nazareth',
  'tiberias', 'eilat', 'acre', 'nahariya', 'givatayim', 'kiryat-ata'
];

// Medical center patterns (typically US-based)
const MEDICAL_CENTER_PATTERNS = [
  'medical-center', 'hospital', 'practice', 'healthcare', 'health-system',
  'medical-group', 'physicians', 'doctors', 'pediatrics', 'cardiology',
  'orthopedics', 'neurology', 'oncology', 'radiology', 'surgery'
];

/**
 * Detect language configuration based on hostname/subdomain
 * @param {string} hostname - The full hostname (e.g., 'north-dakota.intellicare.health')
 * @returns {Object} Language configuration object
 */
export const detectPracticeLanguage = (hostname = window.location.hostname) => {
  // Extract subdomain from hostname
  const parts = hostname.split('.');
  const subdomain = parts[0]?.toLowerCase() || '';
  
  console.log('🌐 Language Detection:', { hostname, subdomain });
  
  // Check if on parent domain (no subdomain or localhost)
  const isParentDomain = hostname === 'intellicare.health' || 
                         hostname === 'www.intellicare.health' ||
                         hostname === 'localhost' ||
                         hostname === 'localhost:3000' ||
                         subdomain === 'intellicare' ||
                         subdomain === 'www' ||
                         parts.length < 3;
  
  if (isParentDomain) {
    console.log('📍 Parent domain detected - showing language switcher');
    return {
      language: 'en',  // Default to English on parent
      isRTL: false,
      allowSwitcher: true,
      detectedFrom: 'parent-domain'
    };
  }
  
  // Check if US practice based on state name
  const isUSClinic = US_STATES.some(state => 
    subdomain.includes(state) || 
    subdomain.replace(/-/g, '').includes(state.replace(/-/g, ''))
  );
  
  if (isUSClinic) {
    console.log('🇺🇸 US practice detected - English only, no switcher');
    return {
      language: 'en',
      isRTL: false,
      allowSwitcher: false,  // No switcher for US practices
      detectedFrom: 'us-state-pattern'
    };
  }
  
  // Check if Israeli practice
  const isIsraeliClinic = ISRAELI_PATTERNS.some(pattern => 
    subdomain.includes(pattern) || 
    subdomain.replace(/-/g, '').includes(pattern.replace(/-/g, ''))
  );
  
  if (isIsraeliClinic) {
    console.log('🇮🇱 Israeli practice detected - Hebrew default with switcher');
    return {
      language: 'he',
      isRTL: true,
      allowSwitcher: true,  // Allow switching for Israeli practices
      detectedFrom: 'israeli-pattern'
    };
  }
  
  // Check if generic medical center (usually US)
  const isMedicalCenter = MEDICAL_CENTER_PATTERNS.some(pattern => 
    subdomain.includes(pattern)
  );
  
  if (isMedicalCenter && !isIsraeliClinic) {
    console.log('🏥 Medical center detected - English default');
    return {
      language: 'en',
      isRTL: false,
      allowSwitcher: false,
      detectedFrom: 'medical-pattern'
    };
  }
  
  // Default for all other practices - English with switcher enabled
  // This allows ANY subdomain to have language switching capability
  console.log('🌍 Generic practice detected - English with language switcher enabled');
  return {
    language: 'en',
    isRTL: false,
    allowSwitcher: true,  // Allow language switching for all non-pattern-matched subdomains
    detectedFrom: 'default'
  };
};

/**
 * Get available languages for the current context
 * @param {string} hostname - The full hostname
 * @returns {Array} Array of available language objects
 */
export const getAvailableLanguagesForClinic = (hostname = window.location.hostname) => {
  const config = detectPracticeLanguage(hostname);
  
  if (!config.allowSwitcher) {
    // Only return the detected language
    return [{
      code: config.language,
      name: config.language === 'he' ? 'עברית' : 'English',
      nativeName: config.language === 'he' ? 'עברית' : 'English',
      isRTL: config.isRTL
    }];
  }
  
  // Return both languages if switcher is allowed
  return [
    { code: 'en', name: 'English', nativeName: 'English', isRTL: false },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', isRTL: true }
  ];
};

/**
 * Check if language switching should be allowed
 * @param {string} hostname - The full hostname
 * @returns {boolean} Whether language switching is allowed
 */
export const shouldShowLanguageSwitcher = (hostname = window.location.hostname) => {
  const config = detectPracticeLanguage(hostname);
  return config.allowSwitcher;
};

/**
 * Apply detected language to the document
 * @param {string} hostname - The full hostname
 */
export const applyDetectedLanguage = (hostname = window.location.hostname) => {
  const config = detectPracticeLanguage(hostname);
  
  // Set document language and direction
  document.documentElement.lang = config.language;
  document.documentElement.dir = config.isRTL ? 'rtl' : 'ltr';
  
  // Store in session for consistency
  if (!config.allowSwitcher) {
    // Force the detected language for practices
    sessionStorage.setItem('forcedLanguage', config.language);
    sessionStorage.setItem('languageDetectedFrom', config.detectedFrom);
  }
  
  return config;
};

export default {
  detectPracticeLanguage,
  getAvailableLanguagesForClinic,
  shouldShowLanguageSwitcher,
  applyDetectedLanguage
};