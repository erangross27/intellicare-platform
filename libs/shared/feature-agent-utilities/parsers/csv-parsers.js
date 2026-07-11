// CSV Parser Utilities
// Provides CSV parsing utilities for AgentServiceV4

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class CSVParsers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('csv-parsers');
    }

    // Parse CSV content to array of objects
    parseCSV(csvContent, options = {}) {
        if (!csvContent) return [];
        
        const {
            delimiter = ',',
            hasHeaders = true,
            skipEmptyLines = true
        } = options;
        
        const lines = csvContent.split('\n').filter(line => 
            skipEmptyLines ? line.trim().length > 0 : true
        );
        
        if (lines.length === 0) return [];
        
        const headers = hasHeaders ? 
            this.parseLine(lines[0], delimiter) : 
            this.generateHeaders(this.parseLine(lines[0], delimiter).length);
        
        const dataLines = hasHeaders ? lines.slice(1) : lines;
        
        return dataLines.map(line => {
            const values = this.parseLine(line, delimiter);
            const record = {};
            
            headers.forEach((header, index) => {
                record[header] = values[index] || '';
            });
            
            return record;
        });
    }

    // Parse a single CSV line
    parseLine(line, delimiter = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // Skip the next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    // Generate default headers
    generateHeaders(count) {
        return Array.from({ length: count }, (_, i) => `Column${i + 1}`);
    }

    // Convert array of objects to CSV
    arrayToCSV(data, options = {}) {
        if (!Array.isArray(data) || data.length === 0) return '';
        
        const {
            delimiter = ',',
            includeHeaders = true,
            quoteAll = false
        } = options;
        
        const headers = Object.keys(data[0]);
        const lines = [];
        
        if (includeHeaders) {
            lines.push(this.formatCSVLine(headers, delimiter, quoteAll));
        }
        
        data.forEach(record => {
            const values = headers.map(header => record[header] || '');
            lines.push(this.formatCSVLine(values, delimiter, quoteAll));
        });
        
        return lines.join('\n');
    }

    // Format a line for CSV output
    formatCSVLine(values, delimiter, quoteAll) {
        return values.map(value => {
            const stringValue = String(value);
            const needsQuotes = quoteAll || 
                stringValue.includes(delimiter) || 
                stringValue.includes('"') || 
                stringValue.includes('\n');
            
            if (needsQuotes) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            
            return stringValue;
        }).join(delimiter);
    }
}

const csvParsers = new CSVParsers();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('csvParsers', () => csvParsers);
}

module.exports = csvParsers;