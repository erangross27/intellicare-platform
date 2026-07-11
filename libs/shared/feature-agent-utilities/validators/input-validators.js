// Input Validation Utilities
// Provides comprehensive input validation for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class InputValidators {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('input-validators');
    }

    // Validate patient ID
    validatePatientId(patientId) {
        if (!patientId) {
            throw new Error('Patient ID is required');
        }
        
        if (typeof patientId !== 'string' || patientId.length < 1) {
            throw new Error('Patient ID must be a non-empty string');
        }
        
        // Check if it's a valid ObjectId format
        if (!/^[0-9a-fA-F]{24}$/.test(patientId)) {
            throw new Error('Patient ID must be a valid ObjectId');
        }
        
        return true;
    }

    // Validate email format
    validateEmail(email) {
        if (!email) {
            throw new Error('Email is required');
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }
        
        return true;
    }

    // Validate phone number
    validatePhoneNumber(phone) {
        if (!phone) {
            throw new Error('Phone number is required');
        }
        
        // Remove all non-digit characters
        const cleanPhone = phone.replace(/\D/g, '');
        
        // Check if it has at least 10 digits
        if (cleanPhone.length < 10) {
            throw new Error('Phone number must contain at least 10 digits');
        }
        
        return true;
    }

    // Validate national ID
    validateNationalId(nationalId) {
        if (!nationalId) {
            throw new Error('National ID is required');
        }
        
        // Remove spaces and dashes
        const cleanId = nationalId.replace(/[\s-]/g, '');
        
        // Check if it's 9 digits (Israeli ID format)
        if (!/^\d{9}$/.test(cleanId)) {
            throw new Error('National ID must be 9 digits');
        }
        
        // Validate Israeli ID check digit
        return this.validateIsraeliIdCheckDigit(cleanId);
    }

    // Validate Israeli ID check digit
    validateIsraeliIdCheckDigit(id) {
        let sum = 0;
        for (let i = 0; i < 8; i++) {
            let digit = parseInt(id[i]);
            if (i % 2 === 1) digit *= 2;
            if (digit > 9) digit = digit % 10 + Math.floor(digit / 10);
            sum += digit;
        }
        
        const checkDigit = (10 - (sum % 10)) % 10;
        const providedCheckDigit = parseInt(id[8]);
        
        if (checkDigit !== providedCheckDigit) {
            throw new Error('Invalid National ID check digit');
        }
        
        return true;
    }

    // Validate date format
    validateDate(dateStr) {
        if (!dateStr) {
            throw new Error('Date is required');
        }
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
        }
        
        return true;
    }

    // Validate age
    validateAge(age) {
        if (age === null || age === undefined) {
            throw new Error('Age is required');
        }
        
        const numAge = parseInt(age);
        if (isNaN(numAge) || numAge < 0 || numAge > 150) {
            throw new Error('Age must be between 0 and 150');
        }
        
        return true;
    }

    // Validate required fields
    validateRequiredFields(obj, requiredFields) {
        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')) {
                missingFields.push(field);
            }
        }
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        return true;
    }

    // Validate string length
    validateStringLength(value, fieldName, minLength = 1, maxLength = 255) {
        if (!value || typeof value !== 'string') {
            throw new Error(`${fieldName} must be a string`);
        }
        
        if (value.length < minLength) {
            throw new Error(`${fieldName} must be at least ${minLength} characters long`);
        }
        
        if (value.length > maxLength) {
            throw new Error(`${fieldName} must be no more than ${maxLength} characters long`);
        }
        
        return true;
    }

    // Validate numeric range
    validateNumericRange(value, fieldName, min = 0, max = Number.MAX_SAFE_INTEGER) {
        const numValue = parseFloat(value);
        
        if (isNaN(numValue)) {
            throw new Error(`${fieldName} must be a valid number`);
        }
        
        if (numValue < min || numValue > max) {
            throw new Error(`${fieldName} must be between ${min} and ${max}`);
        }
        
        return true;
    }

    // Validate array not empty
    validateArrayNotEmpty(arr, fieldName) {
        if (!Array.isArray(arr) || arr.length === 0) {
            throw new Error(`${fieldName} must be a non-empty array`);
        }
        
        return true;
    }

    // Validate object has properties
    validateObjectHasProperties(obj, fieldName, requiredProps) {
        if (!obj || typeof obj !== 'object') {
            throw new Error(`${fieldName} must be an object`);
        }
        
        const missingProps = requiredProps.filter(prop => !(prop in obj));
        if (missingProps.length > 0) {
            throw new Error(`${fieldName} missing properties: ${missingProps.join(', ')}`);
        }
        
        return true;
    }

    // Validate UUID format
    validateUUID(uuid, fieldName = 'UUID') {
        if (!uuid) {
            throw new Error(`${fieldName} is required`);
        }
        
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(uuid)) {
            throw new Error(`${fieldName} must be a valid UUID`);
        }
        
        return true;
    }

    // Validate URL format
    validateURL(url, fieldName = 'URL') {
        if (!url) {
            throw new Error(`${fieldName} is required`);
        }
        
        try {
            new URL(url);
            return true;
        } catch (error) {
            throw new Error(`${fieldName} must be a valid URL`);
        }
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
}

// Create and export singleton
const inputValidators = new InputValidators();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('inputValidators', () => inputValidators);
}

module.exports = inputValidators;