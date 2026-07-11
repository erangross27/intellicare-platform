// Object Helper Utilities
// Provides object manipulation utilities for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class ObjectHelpers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('object-helpers');
    }

    // Clean undefined properties from objects
    cleanUndefined(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const cleaned = {};
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            if (value !== undefined && value !== null) {
                if (typeof value === 'object' && !Array.isArray(value)) {
                    cleaned[key] = this.cleanUndefined(value);
                } else {
                    cleaned[key] = value;
                }
            }
        });
        
        return cleaned;
    }

    // Deep merge objects
    deepMerge(target, source) {
        if (!target || typeof target !== 'object') target = {};
        if (!source || typeof source !== 'object') return target;
        
        const result = { ...target };
        
        Object.keys(source).forEach(key => {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        });
        
        return result;
    }

    // Get nested property value
    getNestedValue(obj, path, defaultValue = undefined) {
        if (!obj || typeof obj !== 'object') return defaultValue;
        
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }

    // Set nested property value
    setNestedValue(obj, path, value) {
        if (!obj || typeof obj !== 'object') return obj;
        
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
        return obj;
    }

    // Pick specific properties from object
    pick(obj, properties) {
        if (!obj || typeof obj !== 'object') return {};
        if (!Array.isArray(properties)) return obj;
        
        const picked = {};
        properties.forEach(prop => {
            if (prop in obj) {
                picked[prop] = obj[prop];
            }
        });
        
        return picked;
    }

    // Omit specific properties from object
    omit(obj, properties) {
        if (!obj || typeof obj !== 'object') return {};
        if (!Array.isArray(properties)) return obj;
        
        const omitted = { ...obj };
        properties.forEach(prop => {
            delete omitted[prop];
        });
        
        return omitted;
    }

    // Transform object keys
    transformKeys(obj, transformer) {
        if (!obj || typeof obj !== 'object') return obj;
        if (typeof transformer !== 'function') return obj;
        
        const transformed = {};
        Object.keys(obj).forEach(key => {
            const newKey = transformer(key);
            transformed[newKey] = obj[key];
        });
        
        return transformed;
    }

    // Convert object keys to camelCase
    keysToCamelCase(obj) {
        return this.transformKeys(obj, key => 
            key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
        );
    }

    // Convert object keys to snake_case
    keysToSnakeCase(obj) {
        return this.transformKeys(obj, key => 
            key.replace(/([A-Z])/g, '_$1').toLowerCase()
        );
    }

    // Flatten nested object
    flatten(obj, prefix = '', separator = '.') {
        if (!obj || typeof obj !== 'object') return {};
        
        const flattened = {};
        
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            const newKey = prefix ? `${prefix}${separator}${key}` : key;
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                Object.assign(flattened, this.flatten(value, newKey, separator));
            } else {
                flattened[newKey] = value;
            }
        });
        
        return flattened;
    }

    // Check if object is empty
    isEmpty(obj) {
        if (!obj) return true;
        if (typeof obj !== 'object') return false;
        return Object.keys(obj).length === 0;
    }

    // Check if object has all required properties
    hasProperties(obj, properties) {
        if (!obj || typeof obj !== 'object') return false;
        if (!Array.isArray(properties)) return true;
        
        return properties.every(prop => prop in obj);
    }

    // Filter object properties by condition
    filterProperties(obj, predicate) {
        if (!obj || typeof obj !== 'object') return {};
        if (typeof predicate !== 'function') return obj;
        
        const filtered = {};
        Object.entries(obj).forEach(([key, value]) => {
            if (predicate(value, key, obj)) {
                filtered[key] = value;
            }
        });
        
        return filtered;
    }

    // Map object values
    mapValues(obj, mapper) {
        if (!obj || typeof obj !== 'object') return {};
        if (typeof mapper !== 'function') return obj;
        
        const mapped = {};
        Object.entries(obj).forEach(([key, value]) => {
            mapped[key] = mapper(value, key, obj);
        });
        
        return mapped;
    }

    // Deep clone object
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = this.deepClone(obj[key]);
        });
        
        return cloned;
    }

    // Compare objects for deep equality
    deepEqual(obj1, obj2) {
        if (obj1 === obj2) return true;
        
        if (obj1 === null || obj2 === null) return obj1 === obj2;
        if (typeof obj1 !== typeof obj2) return false;
        if (typeof obj1 !== 'object') return obj1 === obj2;
        
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        
        if (keys1.length !== keys2.length) return false;
        
        return keys1.every(key => 
            keys2.includes(key) && this.deepEqual(obj1[key], obj2[key])
        );
    }

    // Get object size (number of properties)
    size(obj) {
        if (!obj || typeof obj !== 'object') return 0;
        return Object.keys(obj).length;
    }

    // Invert object (swap keys and values)
    invert(obj) {
        if (!obj || typeof obj !== 'object') return {};
        
        const inverted = {};
        Object.entries(obj).forEach(([key, value]) => {
            inverted[value] = key;
        });
        
        return inverted;
    }

    // Group object entries by condition
    groupBy(obj, grouper) {
        if (!obj || typeof obj !== 'object') return {};
        if (typeof grouper !== 'function') return { default: obj };
        
        const grouped = {};
        Object.entries(obj).forEach(([key, value]) => {
            const group = grouper(value, key, obj);
            if (!grouped[group]) {
                grouped[group] = {};
            }
            grouped[group][key] = value;
        });
        
        return grouped;
    }
}

// Register with service proxy
const objectHelpersInstance = new ObjectHelpers();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('objectHelpers', () => objectHelpersInstance);
}

module.exports = objectHelpersInstance;