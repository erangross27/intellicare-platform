// XML Parser Utilities
// Provides XML parsing utilities for AgentServiceV4

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class XMLParsers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('xml-parsers');
    }

    // Basic XML parsing (simplified - for production use a proper XML parser)
    parseXML(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') return null;
        
        try {
            return this.parseXMLElement(xmlString);
        } catch (error) {
            console.error('XML parsing error:', error);
            return null;
        }
    }

    // Parse XML element recursively
    parseXMLElement(xml) {
        const result = {};
        
        // Remove XML declaration and comments
        xml = xml.replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
        
        // Find root element
        const rootMatch = xml.match(/<(\w+)[^>]*>/);
        if (!rootMatch) return null;
        
        const rootName = rootMatch[1];
        const rootContent = this.extractElementContent(xml, rootName);
        
        result[rootName] = this.parseElementContent(rootContent);
        
        return result;
    }

    // Extract content of an XML element
    extractElementContent(xml, tagName) {
        const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1] : '';
    }

    // Parse content inside an element
    parseElementContent(content) {
        if (!content || !content.trim()) return '';
        
        // Check if content has child elements
        const hasChildElements = /<\w+/.test(content);
        
        if (!hasChildElements) {
            // Text content only
            return content.trim();
        }
        
        // Parse child elements
        const result = {};
        const elementRegex = /<(\w+)[^>]*>([\\s\\S]*?)<\\\/\1>/g;
        let match;
        
        while ((match = elementRegex.exec(content)) !== null) {
            const elementName = match[1];
            const elementContent = match[2];
            
            const parsedContent = this.parseElementContent(elementContent);
            
            if (result[elementName]) {
                // Multiple elements with same name - convert to array
                if (!Array.isArray(result[elementName])) {
                    result[elementName] = [result[elementName]];
                }
                result[elementName].push(parsedContent);
            } else {
                result[elementName] = parsedContent;
            }
        }
        
        return result;
    }

    // Extract attributes from XML element
    extractAttributes(elementString) {
        const attributes = {};
        const attributeRegex = /(\w+)=["']([^"']*)["']/g;
        let match;
        
        while ((match = attributeRegex.exec(elementString)) !== null) {
            attributes[match[1]] = match[2];
        }
        
        return attributes;
    }

    // Convert object to XML
    objectToXML(obj, rootName = 'root') {
        if (!obj || typeof obj !== 'object') return '';
        
        const xmlLines = ['<?xml version="1.0" encoding="UTF-8"?>'];
        xmlLines.push(this.objectToXMLElement(obj, rootName));
        
        return xmlLines.join('\n');
    }

    // Convert object to XML element
    objectToXMLElement(obj, elementName) {
        if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
            return `<${elementName}>${this.escapeXML(String(obj))}</${elementName}>`;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.objectToXMLElement(item, elementName)).join('\n');
        }
        
        if (typeof obj === 'object' && obj !== null) {
            const children = Object.keys(obj).map(key => 
                this.objectToXMLElement(obj[key], key)
            ).join('\n');
            
            return `<${elementName}>\n${children}\n</${elementName}>`;
        }
        
        return `<${elementName}></${elementName}>`;
    }

    // Escape special XML characters
    escapeXML(str) {
        const xmlEntities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&apos;'
        };
        
        return String(str).replace(/[&<>"']/g, match => xmlEntities[match]);
    }

    // Validate XML structure
    validateXML(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') return false;
        
        try {
            // Basic validation - check for balanced tags
            const tagStack = [];
            const tagRegex = /<\/?(\w+)[^>]*>/g;
            let match;
            
            while ((match = tagRegex.exec(xmlString)) !== null) {
                const fullTag = match[0];
                const tagName = match[1];
                
                if (fullTag.startsWith('</')) {
                    // Closing tag
                    if (tagStack.length === 0 || tagStack.pop() !== tagName) {
                        return false;
                    }
                } else if (!fullTag.endsWith('/>')) {
                    // Opening tag (not self-closing)
                    tagStack.push(tagName);
                }
            }
            
            return tagStack.length === 0;
        } catch (error) {
            return false;
        }
    }
}

const xmlParsers = new XMLParsers();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('xmlParsers', () => xmlParsers);
}

module.exports = xmlParsers;