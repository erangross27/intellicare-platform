// Address Formatting Utilities
// Provides address formatting for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class AddressFormatters {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('address-formatters');
    }

    // Format complete address for display
    formatAddress(addressData, country = 'US') {
        if (!addressData || typeof addressData !== 'object') return '';
        
        if (country === 'US' || country === 'USA') {
            return this.formatUSAddress(addressData);
        } else if (country === 'IL' || country === 'Israel') {
            return this.formatIsraeliAddress(addressData);
        }
        
        return this.formatInternationalAddress(addressData);
    }

    // Format US address
    formatUSAddress(address) {
        const parts = [];
        
        if (address.street) {
            let street = address.street;
            if (address.unit || address.apartment) {
                street += `, ${address.unit || address.apartment}`;
            }
            parts.push(street);
        }
        
        const cityStateZip = [];
        if (address.city) cityStateZip.push(address.city);
        if (address.state) cityStateZip.push(address.state);
        if (address.zipCode || address.zip) cityStateZip.push(address.zipCode || address.zip);
        
        if (cityStateZip.length > 0) {
            parts.push(cityStateZip.join(', '));
        }
        
        if (address.country && address.country !== 'US' && address.country !== 'USA') {
            parts.push(address.country);
        }
        
        return parts.join('\n');
    }

    // Format Israeli address
    formatIsraeliAddress(address) {
        const parts = [];
        
        if (address.street) {
            let street = address.street;
            if (address.houseNumber) {
                street += ` ${address.houseNumber}`;
            }
            if (address.apartment) {
                street += `, דירה ${address.apartment}`;
            }
            parts.push(street);
        }
        
        if (address.city) {
            let cityLine = address.city;
            if (address.postalCode) {
                cityLine = `${address.city} ${address.postalCode}`;
            }
            parts.push(cityLine);
        }
        
        if (address.country && address.country !== 'IL' && address.country !== 'Israel') {
            parts.push(address.country);
        }
        
        return parts.join('\n');
    }

    // Format international address
    formatInternationalAddress(address) {
        const parts = [];
        
        if (address.street) {
            parts.push(address.street);
        }
        
        if (address.city || address.region || address.postalCode) {
            const cityLine = [address.city, address.region, address.postalCode]
                .filter(Boolean)
                .join(', ');
            if (cityLine) parts.push(cityLine);
        }
        
        if (address.country) {
            parts.push(address.country);
        }
        
        return parts.join('\n');
    }

    // Format address for single line display
    formatAddressSingleLine(addressData, country = 'US') {
        const formatted = this.formatAddress(addressData, country);
        return formatted.replace(/\n/g, ', ');
    }

    // Extract street number from address
    extractStreetNumber(street) {
        if (!street) return null;
        
        const match = street.match(/^(\d+)/);
        return match ? match[1] : null;
    }

    // Extract apartment/unit from address
    extractUnit(address) {
        if (!address) return null;
        
        const unitPatterns = [
            /apt\.?\s*(\w+)/i,
            /apartment\s*(\w+)/i,
            /unit\s*(\w+)/i,
            /suite\s*(\w+)/i,
            /#\s*(\w+)/
        ];
        
        for (const pattern of unitPatterns) {
            const match = address.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }

    // Validate address completeness
    validateAddressCompleteness(address, country = 'US') {
        if (!address || typeof address !== 'object') return false;
        
        const requiredFields = {
            'US': ['street', 'city', 'state', 'zipCode'],
            'IL': ['street', 'city'],
            'default': ['street', 'city']
        };
        
        const required = requiredFields[country] || requiredFields.default;
        
        return required.every(field => 
            address[field] && 
            typeof address[field] === 'string' && 
            address[field].trim().length > 0
        );
    }

    // Standardize state abbreviation
    standardizeStateAbbreviation(state) {
        if (!state) return state;
        
        const stateAbbreviations = {
            'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
            'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
            'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
            'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
            'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
            'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
            'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
            'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
            'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
            'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
            'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
            'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
            'wisconsin': 'WI', 'wyoming': 'WY'
        };
        
        const stateLower = state.toLowerCase();
        return stateAbbreviations[stateLower] || state;
    }
}

// Register with service proxy
const addressFormattersInstance = new AddressFormatters();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('addressFormatters', () => addressFormattersInstance);
}

module.exports = addressFormattersInstance;