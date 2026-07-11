// Regex Constants
// Provides regular expression constants for AgentServiceV4

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/shared/feature-agent-utilities/ files (4 levels deep)
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class RegexConstants {
    constructor() {
        this.serviceToken = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('regex-constants');
        this.initialized = true;
    }

    // Email validation patterns
    getEmailPatterns() {
        return {
            BASIC: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            STRICT: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
            SIMPLE: /\S+@\S+\.\S+/
        };
    }

    // Phone number patterns
    getPhonePatterns() {
        return {
            US: /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
            ISRAELI: /^(\+972|0)?[2-9]\d{7,8}$/,
            INTERNATIONAL: /^\+?[1-9]\d{1,14}$/,
            DIGITS_ONLY: /^\d{10,15}$/
        };
    }

    // Date patterns
    getDatePatterns() {
        return {
            ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
            ISO_DATETIME: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
            US_DATE: /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(19|20)\d{2}$/,
            EUROPEAN_DATE: /^(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(19|20)\d{2}$/,
            TIME_24H: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
            TIME_12H: /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i
        };
    }

    // Medical patterns
    getMedicalPatterns() {
        return {
            BLOOD_PRESSURE: /^\d{2,3}\/\d{2,3}$/,
            TEMPERATURE_F: /^\d{2,3}(\.\d)?°?F?$/i,
            TEMPERATURE_C: /^\d{2}(\.\d)?°?C?$/i,
            HEART_RATE: /^\d{2,3}\s?(bpm|beats)/i,
            WEIGHT_LBS: /^\d{1,3}(\.\d)?\s?(lbs?|pounds?)/i,
            WEIGHT_KG: /^\d{1,3}(\.\d)?\s?(kg|kilograms?)/i,
            HEIGHT_FEET: /^\d'(\d{1,2}")|\d'\s?\d{1,2}"/,
            HEIGHT_CM: /^\d{2,3}\s?cm/i,
            MRN: /^[A-Z0-9]{6,12}$/,
            ICD10: /^[A-Z]\d{2}(\.[A-Z0-9]{1,4})?$/,
            CPT: /^\d{5}(-\d{2})?$/
        };
    }

    // Security patterns
    getSecurityPatterns() {
        return {
            STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            MEDIUM_PASSWORD: /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/,
            API_KEY: /^[a-zA-Z0-9]{32,}$/,
            JWT_TOKEN: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
            UUID: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
            SESSION_ID: /^[a-zA-Z0-9]{24,}$/
        };
    }

    // Network patterns
    getNetworkPatterns() {
        return {
            IPV4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
            IPV6: /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
            MAC_ADDRESS: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
            URL: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/,
            DOMAIN: /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
            PORT: /^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/
        };
    }

    // Financial patterns
    getFinancialPatterns() {
        return {
            CREDIT_CARD: /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/,
            VISA: /^4[0-9]{12}(?:[0-9]{3})?$/,
            MASTERCARD: /^5[1-5][0-9]{14}$/,
            AMEX: /^3[47][0-9]{13}$/,
            DISCOVER: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
            SSN: /^\d{3}-\d{2}-\d{4}$/,
            EIN: /^\d{2}-\d{7}$/,
            CURRENCY: /^\$?\d{1,3}(,\d{3})*(\.\d{2})?$/,
            PERCENTAGE: /^\d{1,3}(\.\d{1,2})?%$/
        };
    }

    // File patterns
    getFilePatterns() {
        return {
            IMAGE: /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i,
            DOCUMENT: /\.(pdf|doc|docx|txt|rtf|odt)$/i,
            SPREADSHEET: /\.(xls|xlsx|csv|ods)$/i,
            ARCHIVE: /\.(zip|rar|tar|gz|7z)$/i,
            VIDEO: /\.(mp4|avi|mov|wmv|flv|webm)$/i,
            AUDIO: /\.(mp3|wav|ogg|aac|flac)$/i,
            FILENAME: /^[a-zA-Z0-9._-]+$/,
            FILE_EXTENSION: /\.[a-zA-Z0-9]{1,5}$/
        };
    }

    // Language detection patterns
    getLanguagePatterns() {
        return {
            HEBREW: /[\u0590-\u05FF]/,
            ARABIC: /[\u0600-\u06FF]/,
            RUSSIAN: /[\u0400-\u04FF]/,
            CHINESE: /[\u4E00-\u9FFF]/,
            JAPANESE: /[\u3040-\u309F\u30A0-\u30FF]/,
            KOREAN: /[\uAC00-\uD7AF]/,
            ENGLISH: /^[A-Za-z0-9\s\.\,\!\?\-\(\)]+$/
        };
    }

    // HTML and markup patterns
    getMarkupPatterns() {
        return {
            HTML_TAG: /<[^>]+>/g,
            HTML_ENTITY: /&[a-zA-Z0-9#]+;/g,
            XML_TAG: /<\/?[^>]+(>|$)/g,
            MARKDOWN_LINK: /\[([^\]]+)\]\(([^)]+)\)/g,
            EMAIL_IN_TEXT: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            URL_IN_TEXT: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
        };
    }

    // Validation helper methods
    validateWithPattern(value, patternName, category = 'general') {
        const patterns = this.getPatternsByCategory(category);
        const pattern = patterns[patternName];
        
        if (!pattern) {
            throw new Error(`Pattern '${patternName}' not found in category '${category}'`);
        }
        
        return pattern.test(value);
    }

    getPatternsByCategory(category) {
        switch (category.toLowerCase()) {
            case 'email': return this.getEmailPatterns();
            case 'phone': return this.getPhonePatterns();
            case 'date': return this.getDatePatterns();
            case 'medical': return this.getMedicalPatterns();
            case 'security': return this.getSecurityPatterns();
            case 'network': return this.getNetworkPatterns();
            case 'financial': return this.getFinancialPatterns();
            case 'file': return this.getFilePatterns();
            case 'language': return this.getLanguagePatterns();
            case 'markup': return this.getMarkupPatterns();
            default: return {};
        }
    }

    // Extract matches from text
    extractMatches(text, patternName, category = 'general') {
        const patterns = this.getPatternsByCategory(category);
        const pattern = patterns[patternName];
        
        if (!pattern) {
            return [];
        }
        
        const globalPattern = new RegExp(pattern.source, 'g');
        return text.match(globalPattern) || [];
    }

    // Clean text using patterns
    cleanText(text, patternName, category = 'markup', replacement = '') {
        const patterns = this.getPatternsByCategory(category);
        const pattern = patterns[patternName];
        
        if (!pattern) {
            return text;
        }
        
        const globalPattern = new RegExp(pattern.source, 'g');
        return text.replace(globalPattern, replacement);
    }
}

// Create singleton instance
const regexConstants = new RegexConstants();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('regexConstants', () => regexConstants);
}

module.exports = regexConstants;