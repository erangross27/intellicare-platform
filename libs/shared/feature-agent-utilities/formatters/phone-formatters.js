// Phone Number Formatting Utilities
// Provides phone number formatting for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class PhoneFormatters {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('phone-formatters');
    }

    // Format phone number for display
    formatPhoneNumber(phoneNumber, country = 'US') {
        if (!phoneNumber) return phoneNumber;
        
        // Remove all non-digit characters
        const cleaned = phoneNumber.replace(/\D/g, '');
        
        if (country === 'US' || country === 'USA') {
            return this.formatUSPhone(cleaned);
        } else if (country === 'IL' || country === 'Israel') {
            return this.formatIsraeliPhone(cleaned);
        }
        
        // Default formatting
        return this.formatInternationalPhone(cleaned);
    }

    // Format US phone number
    formatUSPhone(cleaned) {
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        }
        
        return cleaned;
    }

    // Format Israeli phone number
    formatIsraeliPhone(cleaned) {
        if (cleaned.length === 9 && cleaned.startsWith('0')) {
            return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
        } else if (cleaned.length === 10 && cleaned.startsWith('05')) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length === 12 && cleaned.startsWith('972')) {
            return `+972-${cleaned.slice(3, 5)}-${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
        }
        
        return cleaned;
    }

    // Format international phone number
    formatInternationalPhone(cleaned) {
        if (cleaned.length > 10) {
            return `+${cleaned.slice(0, cleaned.length - 10)} ${cleaned.slice(-10, -6)} ${cleaned.slice(-6, -4)} ${cleaned.slice(-4)}`;
        }
        
        return cleaned;
    }

    // Clean phone number for storage
    cleanPhoneNumber(phoneNumber) {
        if (!phoneNumber) return null;
        return phoneNumber.replace(/\D/g, '');
    }

    // Validate phone number format
    validatePhoneFormat(phoneNumber, country = 'US') {
        const cleaned = this.cleanPhoneNumber(phoneNumber);
        
        if (country === 'US') {
            return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
        } else if (country === 'IL') {
            return cleaned.length === 9 || cleaned.length === 10;
        }
        
        return cleaned.length >= 7 && cleaned.length <= 15;
    }
}

// Register with service proxy
const phoneFormattersInstance = new PhoneFormatters();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('phoneFormatters', () => phoneFormattersInstance);
}

module.exports = phoneFormattersInstance;