/**
 * Patient Registration Validation Module
 * Handles comprehensive validation of patient registration data
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientRegistrationValidation {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Authenticate service
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-registration-validation');
    this.initialized = true;
    console.log('✅ [PatientRegValidation] Service initialized');
  }

  /**
   * Validate patient registration data
   * @param {Object} params - Patient registration parameters
   * @param {Object} practiceContext - Practice context information
   * @returns {Object} Validation result
   */
  async validatePatientData(params, practiceContext) {
    console.log('🔍 [PatientRegValidation] Starting comprehensive validation');

    const validationErrors = [];
    const validationWarnings = [];
    
    // Basic field validation
    const basicValidation = this.validateBasicFields(params, practiceContext);
    if (!basicValidation.success) {
      validationErrors.push(...basicValidation.errors);
    }
    
    // Country-specific validation
    const countryValidation = this.validateCountrySpecificFields(params, practiceContext);
    if (!countryValidation.success) {
      validationErrors.push(...countryValidation.errors);
    }
    
    // Contact information validation
    const contactValidation = this.validateContactInformation(params);
    if (!contactValidation.success) {
      validationErrors.push(...contactValidation.errors);
    }
    validationWarnings.push(...(contactValidation.warnings || []));
    
    // Date validation
    const dateValidation = this.validateDates(params);
    if (!dateValidation.success) {
      validationErrors.push(...dateValidation.errors);
    }

    return {
      success: validationErrors.length === 0,
      errors: validationErrors,
      warnings: validationWarnings,
      validatedData: this.sanitizeData(params),
      message: validationErrors.length === 0 
        ? 'Patient data validation passed'
        : 'Patient data validation failed'
    };
  }

  /**
   * Validate basic required fields
   * @param {Object} params - Patient parameters
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateBasicFields(params, practiceContext) {
    const errors = [];
    const isHebrew = practiceContext.language === 'he';

    // Required fields validation
    if (!params.firstName || params.firstName.trim().length < 1) {
      errors.push(isHebrew ? 'שם פרטי נדרש' : 'First name is required');
    }

    if (!params.lastName || params.lastName.trim().length < 1) {
      errors.push(isHebrew ? 'שם משפחה נדרש' : 'Last name is required');
    }

    // Name length validation
    if (params.firstName && params.firstName.length > 50) {
      errors.push(isHebrew ? 'שם פרטי ארוך מדי (מקסימום 50 תווים)' : 'First name too long (max 50 characters)');
    }

    if (params.lastName && params.lastName.length > 50) {
      errors.push(isHebrew ? 'שם משפחה ארוך מדי (מקסימום 50 תווים)' : 'Last name too long (max 50 characters)');
    }

    // Name format validation
    const namePattern = /^[a-zA-Zא-ת\s'-]+$/;
    if (params.firstName && !namePattern.test(params.firstName)) {
      errors.push(isHebrew ? 'שם פרטי מכיל תווים לא חוקיים' : 'First name contains invalid characters');
    }

    if (params.lastName && !namePattern.test(params.lastName)) {
      errors.push(isHebrew ? 'שם משפחה מכיל תווים לא חוקיים' : 'Last name contains invalid characters');
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Validate country-specific fields
   * @param {Object} params - Patient parameters
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateCountrySpecificFields(params, practiceContext) {
    const errors = [];
    const isHebrew = practiceContext.language === 'he';
    
    // Detect country
    const detectedCountry = this.detectCountry(params, practiceContext);
    
    if (detectedCountry === 'Israel') {
      // Israeli validation
      if (params.nationalId && !this.validateIsraeliId(params.nationalId)) {
        errors.push(isHebrew ? 'מספר זהות לא תקין' : 'Invalid Israeli ID number');
      }
      
      if (params.healthFund && !this.validateHealthFund(params.healthFund)) {
        errors.push(isHebrew ? 'קופת חולים לא תקינה' : 'Invalid health fund');
      }
    } else if (detectedCountry === 'USA') {
      // US validation
      if (params.socialSecurityNumber && !this.validateSSN(params.socialSecurityNumber)) {
        errors.push('Invalid Social Security Number format');
      }
      
      if (params.zipCode && !this.validateUSZipCode(params.zipCode)) {
        errors.push('Invalid ZIP code format');
      }
    }

    return {
      success: errors.length === 0,
      errors,
      detectedCountry
    };
  }

  /**
   * Validate contact information
   * @param {Object} params - Patient parameters
   * @returns {Object} Validation result
   */
  validateContactInformation(params) {
    const errors = [];
    const warnings = [];

    // Email validation
    if (params.email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(params.email)) {
        errors.push('Invalid email format');
      }
    } else {
      warnings.push('Email address not provided - patient notifications will be limited');
    }

    // Phone validation
    if (params.phone) {
      const cleanPhone = params.phone.replace(/[\s\-\(\)]/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors.push('Phone number must be between 10-15 digits');
      }
      if (!/^\+?[\d\s\-\(\)]+$/.test(params.phone)) {
        errors.push('Phone number contains invalid characters');
      }
    } else {
      warnings.push('Phone number not provided - emergency contact may be difficult');
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate date fields
   * @param {Object} params - Patient parameters
   * @returns {Object} Validation result
   */
  validateDates(params) {
    const errors = [];

    if (params.dateOfBirth) {
      const birthDate = new Date(params.dateOfBirth);
      const now = new Date();
      
      if (isNaN(birthDate.getTime())) {
        errors.push('Invalid date of birth format');
      } else if (birthDate > now) {
        errors.push('Date of birth cannot be in the future');
      } else if (now.getFullYear() - birthDate.getFullYear() > 150) {
        errors.push('Date of birth indicates age over 150 years');
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Detect patient's country based on available data
   * @param {Object} params - Patient parameters
   * @param {Object} practiceContext - Practice context
   * @returns {string} Detected country
   */
  detectCountry(params, practiceContext) {
    // Check explicit country
    if (params.country) return params.country;
    if (practiceContext.country) return practiceContext.country;
    
    // Detect from data patterns
    if (params.socialSecurityNumber || params.insuranceProvider) return 'USA';
    if (params.healthFund || params.nationalId) return 'Israel';
    
    return 'USA'; // Default
  }

  /**
   * Validate Israeli ID number using checksum
   * @param {string} id - Israeli ID number
   * @returns {boolean} Is valid
   */
  validateIsraeliId(id) {
    if (!/^\d{9}$/.test(id)) return false;
    
    // Luhn algorithm for Israeli ID
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let digit = parseInt(id[i]) * ((i % 2) + 1);
      sum += digit > 9 ? digit - 9 : digit;
    }
    return sum % 10 === 0;
  }

  /**
   * Validate US Social Security Number
   * @param {string} ssn - SSN to validate
   * @returns {boolean} Is valid format
   */
  validateSSN(ssn) {
    const cleanSSN = ssn.replace(/[\s\-]/g, '');
    return /^\d{9}$/.test(cleanSSN) && cleanSSN !== '000000000';
  }

  /**
   * Validate Israeli health fund
   * @param {string} healthFund - Health fund name
   * @returns {boolean} Is valid
   */
  validateHealthFund(healthFund) {
    const validFunds = ['Clalit', 'Maccabi', 'Meuhedet', 'Leumit', 'כללית', 'מכבי', 'מאוחדת', 'לאומית'];
    return validFunds.some(fund => healthFund.toLowerCase().includes(fund.toLowerCase()));
  }

  /**
   * Validate US ZIP code
   * @param {string} zipCode - ZIP code to validate
   * @returns {boolean} Is valid
   */
  validateUSZipCode(zipCode) {
    return /^\d{5}(-\d{4})?$/.test(zipCode);
  }

  /**
   * Sanitize and normalize data
   * @param {Object} params - Raw parameters
   * @returns {Object} Sanitized parameters
   */
  sanitizeData(params) {
    const sanitized = { ...params };
    
    // Trim string fields
    if (sanitized.firstName) sanitized.firstName = sanitized.firstName.trim();
    if (sanitized.lastName) sanitized.lastName = sanitized.lastName.trim();
    if (sanitized.email) sanitized.email = sanitized.email.toLowerCase().trim();
    
    // Normalize phone
    if (sanitized.phone) {
      sanitized.phone = sanitized.phone.replace(/[\s\-\(\)]/g, '');
      if (!sanitized.phone.startsWith('+')) {
        // Add country code based on context
        if (sanitized.phone.length === 10) sanitized.phone = '+1' + sanitized.phone; // US
      }
    }

    return sanitized;
  }
}

const patientRegistrationValidation = new PatientRegistrationValidation();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientRegistrationValidation', () => patientRegistrationValidation);
}

module.exports = patientRegistrationValidation;