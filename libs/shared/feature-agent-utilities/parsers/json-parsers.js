// JSON Parser Utilities
// Provides JSON parsing utilities for AgentServiceV4

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class JSONParsers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('json-parsers');
    }

    // Safe JSON parsing with error handling
    safeJSONParse(jsonString, defaultValue = null) {
        if (!jsonString || typeof jsonString !== 'string') return defaultValue;
        
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('JSON parsing error:', error.message);
            return defaultValue;
        }
    }

    // Parse JSON with validation
    parseAndValidate(jsonString, schema = null) {
        const parsed = this.safeJSONParse(jsonString);
        
        if (parsed === null) {
            return { success: false, error: 'Invalid JSON format' };
        }
        
        if (schema && !this.validateSchema(parsed, schema)) {
            return { success: false, error: 'JSON does not match expected schema' };
        }
        
        return { success: true, data: parsed };
    }

    // Basic schema validation
    validateSchema(data, schema) {
        if (typeof schema !== 'object' || schema === null) return true;
        
        for (const [key, expectedType] of Object.entries(schema)) {
            if (!(key in data)) {
                return false; // Missing required field
            }
            
            const actualType = typeof data[key];
            
            if (expectedType === 'array' && !Array.isArray(data[key])) {
                return false;
            } else if (expectedType !== 'array' && actualType !== expectedType) {
                return false;
            }
        }
        
        return true;
    }

    // Deep clone object
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (error) {
            console.warn('Deep clone error:', error.message);
            return obj;
        }
    }

    // Flatten nested JSON object
    flattenJSON(obj, prefix = '', delimiter = '.') {
        const flattened = {};
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = prefix ? `${prefix}${delimiter}${key}` : key;
                
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    Object.assign(flattened, this.flattenJSON(obj[key], newKey, delimiter));
                } else {
                    flattened[newKey] = obj[key];
                }
            }
        }
        
        return flattened;
    }

    // Unflatten JSON object
    unflattenJSON(flatObj, delimiter = '.') {
        const result = {};
        
        for (const key in flatObj) {
            if (flatObj.hasOwnProperty(key)) {
                const keys = key.split(delimiter);
                let current = result;
                
                for (let i = 0; i < keys.length - 1; i++) {
                    const k = keys[i];
                    if (!current[k]) {
                        current[k] = {};
                    }
                    current = current[k];
                }
                
                current[keys[keys.length - 1]] = flatObj[key];
            }
        }
        
        return result;
    }

    // Extract specific fields from JSON
    extractFields(obj, fields) {
        if (!obj || typeof obj !== 'object') return null;
        if (!Array.isArray(fields)) return obj;
        
        const extracted = {};
        
        fields.forEach(field => {
            if (field.includes('.')) {
                // Nested field
                const value = this.getNestedValue(obj, field);
                if (value !== undefined) {
                    this.setNestedValue(extracted, field, value);
                }
            } else {
                // Simple field
                if (field in obj) {
                    extracted[field] = obj[field];
                }
            }
        });
        
        return extracted;
    }

    // Get nested value from object
    getNestedValue(obj, path) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return undefined;
            }
        }
        
        return current;
    }

    // Set nested value in object
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    // Merge JSON objects
    mergeJSON(target, source) {
        if (typeof target !== 'object' || target === null) target = {};
        if (typeof source !== 'object' || source === null) return target;
        
        const result = this.deepClone(target);
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = this.mergeJSON(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    // Remove null/undefined values
    cleanJSON(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.cleanJSON(item)).filter(item => item !== null && item !== undefined);
        }
        
        if (typeof obj === 'object' && obj !== null) {
            const cleaned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const value = this.cleanJSON(obj[key]);
                    if (value !== null && value !== undefined) {
                        cleaned[key] = value;
                    }
                }
            }
            return cleaned;
        }
        
        return obj;
    }
}

const jsonParsers = new JSONParsers();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('jsonParsers', () => jsonParsers);
}

module.exports = jsonParsers;