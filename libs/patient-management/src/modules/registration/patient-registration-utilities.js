/**
 * Patient Registration Utilities Module
 * Provides utility functions and helpers for patient registration processes
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientRegistrationUtilities {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Authenticate service
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-registration-utilities');
    this.initialized = true;
    console.log('✅ [PatientRegUtilities] Service initialized');
  }

  /**
   * Generate a formatted patient display name
   * @param {Object} patientData - Patient data
   * @returns {string} Formatted display name
   */
  formatPatientDisplayName(patientData) {
    if (!patientData.firstName || !patientData.lastName) {
      return 'Unknown Patient';
    }
    
    return `${patientData.firstName} ${patientData.lastName}`;
  }

  /**
   * Generate a patient summary for display
   * @param {Object} patientData - Patient data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Patient summary
   */
  generatePatientSummary(patientData, practiceContext) {
    const isHebrew = practiceContext.language === 'he';
    const displayName = this.formatPatientDisplayName(patientData);
    
    const summary = {
      displayName,
      basicInfo: {},
      contactInfo: {},
      identificationInfo: {},
      registrationInfo: {}
    };

    // Basic information
    if (patientData.dateOfBirth) {
      const age = this.calculateAge(patientData.dateOfBirth);
      summary.basicInfo.age = age;
      summary.basicInfo.dateOfBirth = patientData.dateOfBirth;
    }
    if (patientData.gender) {
      summary.basicInfo.gender = patientData.gender;
    }

    // Contact information
    if (patientData.email) {
      summary.contactInfo.email = patientData.email;
    }
    if (patientData.phone) {
      summary.contactInfo.phone = patientData.phone;
    }
    if (patientData.street || patientData.city || patientData.state || patientData.zipCode) {
      summary.contactInfo.address = this.formatAddress(patientData);
    }

    // Identification
    if (patientData.nationalId) {
      summary.identificationInfo.nationalId = patientData.nationalId;
    }
    if (patientData.socialSecurityNumber) {
      summary.identificationInfo.ssn = this.maskSSN(patientData.socialSecurityNumber);
    }
    if (patientData.healthFund) {
      summary.identificationInfo.healthFund = patientData.healthFund;
    }
    if (patientData.insuranceProvider) {
      summary.identificationInfo.insurance = patientData.insuranceProvider;
    }

    // Registration info
    summary.registrationInfo = {
      registrationDate: patientData.registrationDate || patientData.createdAt,
      status: patientData.status || 'active',
      verified: patientData.verified || false
    };

    return summary;
  }

  /**
   * Calculate age from date of birth
   * @param {string|Date} dateOfBirth - Date of birth
   * @returns {number} Age in years
   */
  calculateAge(dateOfBirth) {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    
    if (isNaN(birth.getTime())) {
      return null;
    }
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Format address string
   * @param {Object} patientData - Patient data with address fields
   * @returns {string} Formatted address
   */
  formatAddress(patientData) {
    const parts = [];
    
    if (patientData.street) parts.push(patientData.street);
    if (patientData.city) parts.push(patientData.city);
    if (patientData.state) parts.push(patientData.state);
    if (patientData.zipCode) parts.push(patientData.zipCode);
    
    return parts.join(', ');
  }

  /**
   * Mask SSN for display purposes
   * @param {string} ssn - Social Security Number
   * @returns {string} Masked SSN (XXX-XX-1234)
   */
  maskSSN(ssn) {
    if (!ssn) return null;
    
    const cleanSSN = ssn.replace(/\D/g, '');
    if (cleanSSN.length !== 9) return ssn; // Return as-is if invalid format
    
    return `XXX-XX-${cleanSSN.slice(-4)}`;
  }

  /**
   * Format phone number for display
   * @param {string} phone - Phone number
   * @param {string} country - Country context
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phone, country = 'USA') {
    if (!phone) return null;
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (country === 'USA' && cleanPhone.length === 10) {
      return `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
    } else if (country === 'USA' && cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      const phoneNum = cleanPhone.slice(1);
      return `+1 (${phoneNum.slice(0, 3)}) ${phoneNum.slice(3, 6)}-${phoneNum.slice(6)}`;
    }
    
    return phone; // Return original if can't format
  }

  /**
   * Validate and normalize patient name
   * @param {string} name - Patient name (first or last)
   * @returns {Object} Validation result
   */
  validateAndNormalizeName(name) {
    if (!name || typeof name !== 'string') {
      return {
        isValid: false,
        normalizedName: null,
        error: 'Name is required and must be a string'
      };
    }

    // Trim whitespace
    let normalized = name.trim();
    
    // Check minimum length
    if (normalized.length < 1) {
      return {
        isValid: false,
        normalizedName: null,
        error: 'Name cannot be empty'
      };
    }

    // Check maximum length
    if (normalized.length > 50) {
      return {
        isValid: false,
        normalizedName: null,
        error: 'Name cannot exceed 50 characters'
      };
    }

    // Check for valid characters (letters, spaces, hyphens, apostrophes, Hebrew characters)
    const namePattern = /^[a-zA-Zא-ת\s'-]+$/;
    if (!namePattern.test(normalized)) {
      return {
        isValid: false,
        normalizedName: null,
        error: 'Name contains invalid characters'
      };
    }

    // Capitalize first letter of each word
    normalized = normalized.replace(/\b\w/g, l => l.toUpperCase());

    return {
      isValid: true,
      normalizedName: normalized,
      error: null
    };
  }

  /**
   * Generate patient search tokens for improved searchability
   * @param {Object} patientData - Patient data
   * @returns {Array} Search tokens
   */
  generateSearchTokens(patientData) {
    const tokens = [];
    
    // Name tokens
    if (patientData.firstName) {
      tokens.push(patientData.firstName.toLowerCase());
    }
    if (patientData.lastName) {
      tokens.push(patientData.lastName.toLowerCase());
    }
    
    // Full name combination
    if (patientData.firstName && patientData.lastName) {
      tokens.push(`${patientData.firstName} ${patientData.lastName}`.toLowerCase());
      tokens.push(`${patientData.lastName} ${patientData.firstName}`.toLowerCase());
    }

    // Contact tokens
    if (patientData.email) {
      tokens.push(patientData.email.toLowerCase());
    }
    if (patientData.phone) {
      const cleanPhone = patientData.phone.replace(/\D/g, '');
      tokens.push(cleanPhone);
      // Add partial phone tokens
      if (cleanPhone.length >= 10) {
        tokens.push(cleanPhone.slice(-4)); // Last 4 digits
        tokens.push(cleanPhone.slice(-7)); // Last 7 digits
      }
    }

    // Identification tokens
    if (patientData.nationalId) {
      tokens.push(patientData.nationalId);
    }
    if (patientData.socialSecurityNumber) {
      const cleanSSN = patientData.socialSecurityNumber.replace(/\D/g, '');
      tokens.push(cleanSSN);
      if (cleanSSN.length === 9) {
        tokens.push(cleanSSN.slice(-4)); // Last 4 digits
      }
    }

    return [...new Set(tokens)]; // Remove duplicates
  }

  /**
   * Generate a registration tracking ID
   * @param {Object} practiceContext - Practice context
   * @returns {string} Tracking ID
   */
  generateRegistrationTrackingId(practiceContext) {
    const timestamp = Date.now().toString(36);
    const clinicPrefix = practiceContext.practiceSubdomain ? 
      practiceContext.practiceSubdomain.substring(0, 3).toUpperCase() : 'CLI';
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    return `REG-${clinicPrefix}-${timestamp}-${random}`;
  }

  /**
   * Estimate registration completion percentage
   * @param {Object} patientData - Current patient data
   * @param {string} country - Detected country
   * @returns {Object} Completion estimate
   */
  estimateRegistrationCompletion(patientData, country) {
    const requiredFields = {
      universal: ['firstName', 'lastName'],
      USA: ['socialSecurityNumber', 'insuranceProvider', 'street', 'city', 'state', 'zipCode'],
      Israel: ['nationalId', 'healthFund', 'city']
    };

    const optionalFields = ['dateOfBirth', 'gender', 'email', 'phone', 'emergencyContact'];
    
    let totalRequired = requiredFields.universal.length;
    let completedRequired = 0;
    
    // Count universal required fields
    requiredFields.universal.forEach(field => {
      if (patientData[field]) completedRequired++;
    });
    
    // Add country-specific required fields
    if (country && requiredFields[country]) {
      totalRequired += requiredFields[country].length;
      requiredFields[country].forEach(field => {
        if (patientData[field]) completedRequired++;
      });
    }
    
    // Count optional fields
    let completedOptional = 0;
    optionalFields.forEach(field => {
      if (patientData[field]) completedOptional++;
    });
    
    const requiredCompletion = (completedRequired / totalRequired) * 100;
    const totalCompletion = ((completedRequired + completedOptional) / (totalRequired + optionalFields.length)) * 100;
    
    return {
      requiredCompletion: Math.round(requiredCompletion),
      totalCompletion: Math.round(totalCompletion),
      isMinimumComplete: requiredCompletion >= 100,
      missingRequired: requiredFields.universal
        .concat(country && requiredFields[country] ? requiredFields[country] : [])
        .filter(field => !patientData[field]),
      missingOptional: optionalFields.filter(field => !patientData[field])
    };
  }

  /**
   * Format registration error message for user display
   * @param {string} errorCode - Error code
   * @param {Object} practiceContext - Practice context
   * @returns {string} Formatted error message
   */
  formatRegistrationError(errorCode, practiceContext) {
    const isHebrew = practiceContext.language === 'he';
    
    const errorMessages = {
      EMPTY_PARAMS: {
        he: 'לא ניתן לרשום מטופל עם פרמטרים ריקים',
        en: 'Cannot register patient with empty parameters'
      },
      MISSING_REQUIRED_FIELDS: {
        he: 'חסרים שדות חובה לרישום המטופל',
        en: 'Missing required fields for patient registration'
      },
      PATIENT_ALREADY_EXISTS: {
        he: 'מטופל זה כבר קיים במערכת',
        en: 'This patient already exists in the system'
      },
      INVALID_DATA: {
        he: 'הנתונים שהוזנו אינם תקינים',
        en: 'The provided data is invalid'
      },
      DATABASE_ERROR: {
        he: 'שגיאת מסד נתונים - אנא נסה שוב',
        en: 'Database error - please try again'
      }
    };
    
    const message = errorMessages[errorCode];
    return message ? (isHebrew ? message.he : message.en) : 
      (isHebrew ? 'שגיאה לא ידועה' : 'Unknown error');
  }
}

const patientRegistrationUtilities = new PatientRegistrationUtilities();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientRegistrationUtilities', () => patientRegistrationUtilities);
}

module.exports = patientRegistrationUtilities;