// Array Helper Utilities
// Provides array manipulation utilities for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class ArrayHelpers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('array-helpers');
    }

    // Remove duplicates from array
    removeDuplicates(arr) {
        if (!Array.isArray(arr)) return arr;
        return [...new Set(arr)];
    }

    // Remove duplicates by property
    removeDuplicatesByProperty(arr, property) {
        if (!Array.isArray(arr)) return arr;
        
        const seen = new Set();
        return arr.filter(item => {
            const value = typeof item === 'object' ? item[property] : item;
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }

    // Group array by property
    groupBy(arr, property) {
        if (!Array.isArray(arr)) return {};
        
        return arr.reduce((grouped, item) => {
            const key = typeof item === 'object' ? item[property] : item;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(item);
            return grouped;
        }, {});
    }

    // Sort array by property
    sortBy(arr, property, direction = 'asc') {
        if (!Array.isArray(arr)) return arr;
        
        return [...arr].sort((a, b) => {
            let valueA = typeof a === 'object' ? a[property] : a;
            let valueB = typeof b === 'object' ? b[property] : b;
            
            // Handle dates
            if (valueA instanceof Date) valueA = valueA.getTime();
            if (valueB instanceof Date) valueB = valueB.getTime();
            
            // Handle strings
            if (typeof valueA === 'string') valueA = valueA.toLowerCase();
            if (typeof valueB === 'string') valueB = valueB.toLowerCase();
            
            if (direction === 'desc') {
                return valueB > valueA ? 1 : valueB < valueA ? -1 : 0;
            } else {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            }
        });
    }

    // Filter array by multiple conditions
    filterBy(arr, conditions) {
        if (!Array.isArray(arr)) return arr;
        if (!conditions || typeof conditions !== 'object') return arr;
        
        return arr.filter(item => {
            return Object.entries(conditions).every(([key, value]) => {
                const itemValue = typeof item === 'object' ? item[key] : item;
                
                if (Array.isArray(value)) {
                    return value.includes(itemValue);
                } else if (typeof value === 'function') {
                    return value(itemValue);
                } else {
                    return itemValue === value;
                }
            });
        });
    }

    // Paginate array
    paginate(arr, page = 1, pageSize = 10) {
        if (!Array.isArray(arr)) return { items: [], total: 0, page: 1, pageSize, totalPages: 0 };
        
        const total = arr.length;
        const totalPages = Math.ceil(total / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const items = arr.slice(startIndex, endIndex);
        
        return {
            items,
            total,
            page,
            pageSize,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        };
    }

    // Flatten nested array
    flatten(arr, depth = 1) {
        if (!Array.isArray(arr)) return arr;
        
        if (depth === Infinity) {
            return arr.flat(Infinity);
        }
        
        return arr.flat(depth);
    }

    // Chunk array into smaller arrays
    chunk(arr, size) {
        if (!Array.isArray(arr) || size <= 0) return arr;
        
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    // Get array intersection
    intersection(arr1, arr2) {
        if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];
        
        const set2 = new Set(arr2);
        return arr1.filter(item => set2.has(item));
    }

    // Get array difference
    difference(arr1, arr2) {
        if (!Array.isArray(arr1) || !Array.isArray(arr2)) return arr1 || [];
        
        const set2 = new Set(arr2);
        return arr1.filter(item => !set2.has(item));
    }

    // Get array union
    union(arr1, arr2) {
        if (!Array.isArray(arr1)) arr1 = [];
        if (!Array.isArray(arr2)) arr2 = [];
        
        return [...new Set([...arr1, ...arr2])];
    }

    // Find items by partial match
    findByPartialMatch(arr, property, searchTerm) {
        if (!Array.isArray(arr) || !searchTerm) return [];
        
        const lowerSearchTerm = String(searchTerm).toLowerCase();
        
        return arr.filter(item => {
            const value = typeof item === 'object' ? item[property] : item;
            return String(value).toLowerCase().includes(lowerSearchTerm);
        });
    }

    // Calculate array statistics
    getStatistics(arr, property = null) {
        if (!Array.isArray(arr) || arr.length === 0) {
            return { count: 0, sum: 0, average: 0, min: 0, max: 0 };
        }
        
        const values = property ? 
            arr.map(item => typeof item === 'object' ? item[property] : item) : 
            arr;
        
        const numericValues = values.filter(val => typeof val === 'number' && !isNaN(val));
        
        if (numericValues.length === 0) {
            return { count: arr.length, sum: 0, average: 0, min: 0, max: 0 };
        }
        
        const sum = numericValues.reduce((acc, val) => acc + val, 0);
        const average = sum / numericValues.length;
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        
        return {
            count: arr.length,
            numericCount: numericValues.length,
            sum,
            average: Math.round(average * 100) / 100,
            min,
            max
        };
    }

    // Safe array access
    safeGet(arr, index, defaultValue = null) {
        if (!Array.isArray(arr) || index < 0 || index >= arr.length) {
            return defaultValue;
        }
        return arr[index];
    }

    // Move array element
    moveElement(arr, fromIndex, toIndex) {
        if (!Array.isArray(arr) || fromIndex === toIndex) return arr;
        
        const result = [...arr];
        const [element] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, element);
        
        return result;
    }

    // Shuffle array
    shuffle(arr) {
        if (!Array.isArray(arr)) return arr;
        
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    // Sample random elements
    sample(arr, count = 1) {
        if (!Array.isArray(arr) || count <= 0) return [];
        if (count >= arr.length) return [...arr];
        
        const shuffled = this.shuffle(arr);
        return shuffled.slice(0, count);
    }
}

// Register with service proxy
const arrayHelpersInstance = new ArrayHelpers();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('arrayHelpers', () => arrayHelpersInstance);
}

module.exports = arrayHelpersInstance;