// String Helper Utilities
// Provides string manipulation utilities for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class StringHelpers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('string-helpers');
    }

    // Detect language from text
    detectLanguage(message, fallback = 'en') {
        if (!message) return fallback;
        
        // Hebrew text detection
        if (/[\u0590-\u05FF]/.test(message)) return 'he';
        
        // English text detection (basic ASCII)
        if (/^[A-Za-z0-9\s\.\,\!\?\-\(\)]+$/.test(message)) return 'en';
        
        // Arabic detection
        if (/[\u0600-\u06FF]/.test(message)) return 'ar';
        
        // Russian detection
        if (/[\u0400-\u04FF]/.test(message)) return 'ru';
        
        return fallback === 'auto' ? 'he' : fallback;
    }

    // Clean and validate text input
    cleanAndValidateText(text, fieldName, maxLength = 1000) {
        if (!text || typeof text !== 'string') {
            throw new Error(`${fieldName} must be a string`);
        }
        
        // Remove excessive whitespace
        const cleaned = text.trim().replace(/\s+/g, ' ');
        
        if (cleaned.length === 0) {
            throw new Error(`${fieldName} cannot be empty`);
        }
        
        if (cleaned.length > maxLength) {
            throw new Error(`${fieldName} must be no more than ${maxLength} characters`);
        }
        
        return cleaned;
    }

    // Capitalize first letter
    capitalizeFirst(str) {
        if (!str || typeof str !== 'string') return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // Capitalize each word
    capitalizeWords(str) {
        if (!str || typeof str !== 'string') return str;
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    // Convert to camelCase
    toCamelCase(str) {
        if (!str || typeof str !== 'string') return str;
        return str
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            })
            .replace(/\s+/g, '');
    }

    // Convert to kebab-case
    toKebabCase(str) {
        if (!str || typeof str !== 'string') return str;
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/\s+/g, '-')
            .toLowerCase();
    }

    // Convert to snake_case
    toSnakeCase(str) {
        if (!str || typeof str !== 'string') return str;
        return str
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .replace(/\s+/g, '_')
            .toLowerCase();
    }

    // Remove HTML tags
    stripHtmlTags(str) {
        if (!str || typeof str !== 'string') return str;
        return str.replace(/<[^>]*>/g, '');
    }

    // Escape HTML entities
    escapeHtml(str) {
        if (!str || typeof str !== 'string') return str;
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return str.replace(/[&<>"']/g, (m) => map[m]);
    }

    // Unescape HTML entities
    unescapeHtml(str) {
        if (!str || typeof str !== 'string') return str;
        const map = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'"
        };
        return str.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => map[m]);
    }

    // Truncate string with ellipsis
    truncate(str, maxLength, suffix = '...') {
        if (!str || typeof str !== 'string') return str;
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength - suffix.length) + suffix;
    }

    // Generate slug from string
    generateSlug(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }

    // Extract initials from name
    getInitials(name, maxInitials = 2) {
        if (!name || typeof name !== 'string') return '';
        
        const words = name.trim().split(/\s+/);
        const initials = words
            .slice(0, maxInitials)
            .map(word => word.charAt(0).toUpperCase())
            .join('');
            
        return initials;
    }

    // Count words in text
    countWords(text) {
        if (!text || typeof text !== 'string') return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    // Count characters excluding spaces
    countCharacters(text, includeSpaces = true) {
        if (!text || typeof text !== 'string') return 0;
        return includeSpaces ? text.length : text.replace(/\s/g, '').length;
    }

    // Extract numbers from string
    extractNumbers(str) {
        if (!str || typeof str !== 'string') return [];
        const matches = str.match(/\d+\.?\d*/g);
        return matches ? matches.map(num => parseFloat(num)) : [];
    }

    // Extract emails from string
    extractEmails(str) {
        if (!str || typeof str !== 'string') return [];
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        return str.match(emailRegex) || [];
    }

    // Extract phone numbers from string
    extractPhoneNumbers(str) {
        if (!str || typeof str !== 'string') return [];
        const phoneRegex = /(\+?1?\d{9,15})/g;
        return str.match(phoneRegex) || [];
    }

    // Check if string contains only digits
    isNumeric(str) {
        if (!str || typeof str !== 'string') return false;
        return /^\d+$/.test(str);
    }

    // Check if string is valid email
    isEmail(str) {
        if (!str || typeof str !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(str);
    }

    // Check if string contains Hebrew characters
    containsHebrew(str) {
        if (!str || typeof str !== 'string') return false;
        return /[\u0590-\u05FF]/.test(str);
    }

    // Pad string to specified length
    padString(str, length, padChar = ' ', padLeft = true) {
        if (!str) str = '';
        str = String(str);
        
        if (str.length >= length) return str;
        
        const padLength = length - str.length;
        const padding = padChar.repeat(padLength);
        
        return padLeft ? padding + str : str + padding;
    }

    // Reverse string
    reverse(str) {
        if (!str || typeof str !== 'string') return str;
        return str.split('').reverse().join('');
    }

    // Remove accents/diacritics
    removeAccents(str) {
        if (!str || typeof str !== 'string') return str;
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Generate random string
    generateRandomString(length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    }

    // Check if string matches pattern
    matchesPattern(str, pattern, flags = 'gi') {
        if (!str || typeof str !== 'string') return false;
        const regex = new RegExp(pattern, flags);
        return regex.test(str);
    }

    // Replace multiple occurrences
    replaceAll(str, searchValue, replaceValue) {
        if (!str || typeof str !== 'string') return str;
        return str.split(searchValue).join(replaceValue);
    }

    // Format name (First Last)
    formatName(firstName, lastName, middleName = null) {
        const parts = [firstName, middleName, lastName].filter(part => part && part.trim());
        return parts.join(' ');
    }

    // Mask sensitive data
    maskString(str, visibleChars = 4, maskChar = '*') {
        if (!str || typeof str !== 'string') return str;
        if (str.length <= visibleChars) return str;
        
        const visible = str.slice(0, visibleChars);
        const masked = maskChar.repeat(str.length - visibleChars);
        
        return visible + masked;
    }
}

// Register with service proxy
const stringHelpersInstance = new StringHelpers();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('stringHelpers', () => stringHelpersInstance);
}

module.exports = stringHelpersInstance;