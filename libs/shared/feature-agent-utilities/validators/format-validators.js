// Format Validation Utilities
// Provides format validation for various data types in AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class FormatValidators {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('format-validators');
    }

    // Validate JSON format
    validateJSON(jsonString) {
        if (!jsonString) {
            throw new Error('JSON string is required');
        }
        
        try {
            JSON.parse(jsonString);
            return true;
        } catch (error) {
            throw new Error(`Invalid JSON format: ${error.message}`);
        }
    }

    // Validate XML format
    validateXMLFormat(xmlString) {
        if (!xmlString) {
            throw new Error('XML string is required');
        }
        
        // Basic XML validation
        const xmlRegex = /<\?xml.*\?>/;
        const hasXmlDeclaration = xmlRegex.test(xmlString);
        
        // Check for balanced tags
        const tagRegex = /<\/?[^>]+>/g;
        const tags = xmlString.match(tagRegex) || [];
        
        if (tags.length === 0) {
            throw new Error('No XML tags found');
        }
        
        return true;
    }

    // Validate CSV format headers
    validateCSVHeaders(csvContent, expectedHeaders) {
        if (!csvContent) {
            throw new Error('CSV content is required');
        }
        
        const lines = csvContent.split('\n');
        if (lines.length === 0) {
            throw new Error('CSV content is empty');
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        
        if (expectedHeaders && expectedHeaders.length > 0) {
            for (const expectedHeader of expectedHeaders) {
                if (!headers.includes(expectedHeader)) {
                    throw new Error(`Missing required CSV header: ${expectedHeader}`);
                }
            }
        }
        
        return true;
    }

    // Validate file extension
    validateFileExtension(filename, allowedExtensions) {
        if (!filename) {
            throw new Error('Filename is required');
        }
        
        if (!allowedExtensions || allowedExtensions.length === 0) {
            throw new Error('Allowed extensions list is required');
        }
        
        const extension = filename.toLowerCase().split('.').pop();
        const normalizedExtensions = allowedExtensions.map(ext => ext.toLowerCase().replace('.', ''));
        
        if (!normalizedExtensions.includes(extension)) {
            throw new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
        }
        
        return true;
    }

    // Validate MIME type
    validateMimeType(mimeType, allowedTypes) {
        if (!mimeType) {
            throw new Error('MIME type is required');
        }
        
        if (!allowedTypes || allowedTypes.length === 0) {
            throw new Error('Allowed MIME types list is required');
        }
        
        if (!allowedTypes.includes(mimeType)) {
            throw new Error(`Invalid MIME type. Allowed: ${allowedTypes.join(', ')}`);
        }
        
        return true;
    }

    // Validate base64 format
    validateBase64(base64String) {
        if (!base64String) {
            throw new Error('Base64 string is required');
        }
        
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(base64String)) {
            throw new Error('Invalid Base64 format');
        }
        
        // Check if length is multiple of 4
        if (base64String.length % 4 !== 0) {
            throw new Error('Base64 string length must be multiple of 4');
        }
        
        return true;
    }

    // Validate HTML format (basic)
    validateHTMLFormat(htmlString) {
        if (!htmlString) {
            throw new Error('HTML string is required');
        }
        
        // Check for basic HTML structure
        if (!htmlString.includes('<') || !htmlString.includes('>')) {
            throw new Error('String does not contain HTML tags');
        }
        
        // Check for balanced tags (simplified)
        const openTags = (htmlString.match(/<[^/][^>]*>/g) || []).length;
        const closeTags = (htmlString.match(/<\/[^>]*>/g) || []).length;
        const selfClosingTags = (htmlString.match(/<[^>]*\/>/g) || []).length;
        
        // Allow for self-closing tags and unpaired tags like <br>, <img>
        const expectedCloseTags = openTags - selfClosingTags;
        if (Math.abs(expectedCloseTags - closeTags) > 5) {
            console.warn('HTML may have unbalanced tags');
        }
        
        return true;
    }

    // Validate regex pattern
    validateRegexPattern(pattern) {
        if (!pattern) {
            throw new Error('Regex pattern is required');
        }
        
        try {
            new RegExp(pattern);
            return true;
        } catch (error) {
            throw new Error(`Invalid regex pattern: ${error.message}`);
        }
    }

    // Validate color code (hex)
    validateHexColor(colorCode) {
        if (!colorCode) {
            throw new Error('Color code is required');
        }
        
        const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!hexRegex.test(colorCode)) {
            throw new Error('Color code must be in hex format (#RRGGBB or #RGB)');
        }
        
        return true;
    }

    // Validate MAC address
    validateMACAddress(macAddress) {
        if (!macAddress) {
            throw new Error('MAC address is required');
        }
        
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(macAddress)) {
            throw new Error('Invalid MAC address format (should be XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX)');
        }
        
        return true;
    }

    // Validate IPv4 address
    validateIPv4Address(ipAddress) {
        if (!ipAddress) {
            throw new Error('IP address is required');
        }
        
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipv4Regex.test(ipAddress)) {
            throw new Error('Invalid IPv4 address format');
        }
        
        return true;
    }

    // Validate file size format (e.g., "10MB", "1.5GB")
    validateFileSizeFormat(sizeString) {
        if (!sizeString) {
            throw new Error('File size string is required');
        }
        
        const sizeRegex = /^(\d+(?:\.\d+)?)(B|KB|MB|GB|TB)$/i;
        if (!sizeRegex.test(sizeString)) {
            throw new Error('Invalid file size format (should be like "10MB", "1.5GB")');
        }
        
        return true;
    }

    // Validate coordinate format (latitude, longitude)
    validateCoordinates(latitude, longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        
        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('Coordinates must be valid numbers');
        }
        
        if (lat < -90 || lat > 90) {
            throw new Error('Latitude must be between -90 and 90 degrees');
        }
        
        if (lng < -180 || lng > 180) {
            throw new Error('Longitude must be between -180 and 180 degrees');
        }
        
        return true;
    }

    // Validate password strength
    validatePasswordStrength(password) {
        if (!password) {
            throw new Error('Password is required');
        }
        
        const minLength = 8;
        if (password.length < minLength) {
            throw new Error(`Password must be at least ${minLength} characters long`);
        }
        
        if (!/[a-z]/.test(password)) {
            throw new Error('Password must contain at least one lowercase letter');
        }
        
        if (!/[A-Z]/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }
        
        if (!/\d/.test(password)) {
            throw new Error('Password must contain at least one number');
        }
        
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            throw new Error('Password must contain at least one special character');
        }
        
        return true;
    }
}

// Create and export singleton
const formatValidators = new FormatValidators();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('formatValidators', () => formatValidators);
}

module.exports = formatValidators;