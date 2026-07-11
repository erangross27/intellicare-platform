/**
 * Patient ID Validation Utilities
 * 
 * Provides validation for different country-specific patient ID formats:
 * - Israeli ID (Teudat Zehut)
 * - US Social Security Number (SSN)
 * - Canadian Health Card Numbers
 * - UK NHS Numbers
 */

/**
 * Israeli ID (Teudat Zehut) Validation
 * Format: 9 digits with checksum validation
 */
function validateIsraeliId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'ID is required' };
  }

  // Remove any non-digit characters
  const cleanId = id.replace(/\D/g, '');
  
  if (cleanId.length !== 9) {
    return { 
      valid: false, 
      error: 'Israeli ID must be exactly 9 digits',
      format: 'XXXXXXXXX (9 digits)'
    };
  }

  // Checksum validation using Luhn algorithm variant
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(cleanId[i]);
    
    // Multiply every second digit by 2
    if (i % 2 === 1) {
      digit *= 2;
      // If result is two digits, add them together
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }
    
    sum += digit;
  }

  const isValid = sum % 10 === 0;
  
  return {
    valid: isValid,
    formatted: cleanId,
    error: isValid ? null : 'Invalid Israeli ID checksum'
  };
}

/**
 * US Social Security Number (SSN) Validation
 * Format: XXX-XX-XXXX or XXXXXXXXX
 */
function validateUsSsn(ssn) {
  if (!ssn || typeof ssn !== 'string') {
    return { valid: false, error: 'SSN is required' };
  }

  // Remove any non-digit characters
  const cleanSsn = ssn.replace(/\D/g, '');
  
  if (cleanSsn.length !== 9) {
    return { 
      valid: false, 
      error: 'SSN must be exactly 9 digits',
      format: 'XXX-XX-XXXX'
    };
  }

  // Check for invalid patterns
  const area = cleanSsn.substring(0, 3);
  const group = cleanSsn.substring(3, 5);
  const serial = cleanSsn.substring(5, 9);

  // Invalid area numbers
  if (area === '000' || area === '666' || area.startsWith('9')) {
    return { 
      valid: false, 
      error: 'Invalid SSN area number',
      formatted: `${area}-${group}-${serial}`
    };
  }

  // Invalid group or serial numbers
  if (group === '00' || serial === '0000') {
    return { 
      valid: false, 
      error: 'Invalid SSN group or serial number',
      formatted: `${area}-${group}-${serial}`
    };
  }

  return {
    valid: true,
    formatted: `${area}-${group}-${serial}`,
    error: null
  };
}

/**
 * Canadian Health Card Number Validation
 * Format varies by province, but generally 10-12 digits
 */
function validateCanadianHealth(healthNumber, province = null) {
  if (!healthNumber || typeof healthNumber !== 'string') {
    return { valid: false, error: 'Health card number is required' };
  }

  const cleanNumber = healthNumber.replace(/\D/g, '');
  
  // Basic length validation (most provinces use 10-12 digits)
  if (cleanNumber.length < 8 || cleanNumber.length > 12) {
    return { 
      valid: false, 
      error: 'Health card number must be 8-12 digits',
      format: 'XXXXXXXXXX (varies by province)'
    };
  }

  // Province-specific validation
  if (province) {
    switch (province.toUpperCase()) {
      case 'ON': // Ontario
        if (cleanNumber.length !== 10) {
          return { 
            valid: false, 
            error: 'Ontario health card must be 10 digits',
            format: 'XXXXXXXXXX'
          };
        }
        break;
      
      case 'BC': // British Columbia
        if (cleanNumber.length !== 10) {
          return { 
            valid: false, 
            error: 'BC health card must be 10 digits',
            format: 'XXXXXXXXXX'
          };
        }
        break;
      
      case 'AB': // Alberta
        if (cleanNumber.length !== 9) {
          return { 
            valid: false, 
            error: 'Alberta health card must be 9 digits',
            format: 'XXXXXXXXX'
          };
        }
        break;
      
      case 'QC': // Quebec
        if (cleanNumber.length !== 12) {
          return { 
            valid: false, 
            error: 'Quebec health card must be 12 digits',
            format: 'XXXXXXXXXXXX'
          };
        }
        break;
    }
  }

  return {
    valid: true,
    formatted: cleanNumber,
    province: province,
    error: null
  };
}

/**
 * UK NHS Number Validation
 * Format: 10 digits with checksum validation
 */
function validateUkNhs(nhsNumber) {
  if (!nhsNumber || typeof nhsNumber !== 'string') {
    return { valid: false, error: 'NHS number is required' };
  }

  const cleanNumber = nhsNumber.replace(/\D/g, '');
  
  if (cleanNumber.length !== 10) {
    return { 
      valid: false, 
      error: 'NHS number must be exactly 10 digits',
      format: 'XXX XXX XXXX'
    };
  }

  // NHS number checksum validation
  const digits = cleanNumber.split('').map(d => parseInt(d));
  const checkDigit = digits[9];

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }

  const remainder = sum % 11;

  // Special cases for NHS validation
  if (remainder < 2) {
    // If remainder is 0 or 1, the number is invalid
    return {
      valid: false,
      error: 'Invalid NHS number checksum',
      formatted: `${cleanNumber.substring(0, 3)} ${cleanNumber.substring(3, 6)} ${cleanNumber.substring(6)}`
    };
  }

  const expectedCheck = 11 - remainder;

  if (checkDigit !== expectedCheck) {
    return {
      valid: false,
      error: 'Invalid NHS number checksum',
      formatted: `${cleanNumber.substring(0, 3)} ${cleanNumber.substring(3, 6)} ${cleanNumber.substring(6)}`
    };
  }

  return {
    valid: true,
    formatted: `${cleanNumber.substring(0, 3)} ${cleanNumber.substring(3, 6)} ${cleanNumber.substring(6)}`,
    error: null
  };
}

/**
 * Main validation function that routes to appropriate validator
 */
function validatePatientId(patientId, format, options = {}) {
  if (!patientId) {
    return { valid: false, error: 'Patient ID is required' };
  }

  switch (format) {
    case 'israeli_id':
      return validateIsraeliId(patientId);
    
    case 'us_ssn':
      return validateUsSsn(patientId);
    
    case 'ca_health':
      return validateCanadianHealth(patientId, options.province);
    
    case 'uk_nhs':
      return validateUkNhs(patientId);
    
    default:
      return { 
        valid: false, 
        error: `Unsupported patient ID format: ${format}`,
        supportedFormats: ['israeli_id', 'us_ssn', 'ca_health', 'uk_nhs']
      };
  }
}

/**
 * Get format information for a specific patient ID type
 */
function getPatientIdFormatInfo(format) {
  const formats = {
    israeli_id: {
      name: 'Israeli ID (Teudat Zehut)',
      description: '9-digit Israeli identification number with checksum validation',
      format: 'XXXXXXXXX',
      example: '123456789',
      length: 9,
      country: 'Israel'
    },
    us_ssn: {
      name: 'US Social Security Number',
      description: '9-digit US Social Security Number',
      format: 'XXX-XX-XXXX',
      example: '123-45-6789',
      length: 9,
      country: 'United States'
    },
    ca_health: {
      name: 'Canadian Health Card',
      description: 'Provincial health card number (varies by province)',
      format: 'XXXXXXXXXX (varies)',
      example: '1234567890',
      length: '8-12',
      country: 'Canada'
    },
    uk_nhs: {
      name: 'UK NHS Number',
      description: '10-digit NHS number with checksum validation',
      format: 'XXX XXX XXXX',
      example: '123 456 7890',
      length: 10,
      country: 'United Kingdom'
    }
  };

  return formats[format] || null;
}

/**
 * Generate a sample/test patient ID for a given format (for testing purposes)
 */
function generateSamplePatientId(format) {
  switch (format) {
    case 'israeli_id':
      // Generate a valid Israeli ID with proper checksum
      let id = '12345678';
      let sum = 0;
      for (let i = 0; i < 8; i++) {
        let digit = parseInt(id[i]);
        if (i % 2 === 1) {
          digit *= 2;
          if (digit > 9) {
            digit = Math.floor(digit / 10) + (digit % 10);
          }
        }
        sum += digit;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return id + checkDigit;
    
    case 'us_ssn':
      return '123-45-6789';
    
    case 'ca_health':
      return '1234567890';
    
    case 'uk_nhs':
      return '123 456 7890';
    
    default:
      return null;
  }
}

module.exports = {
  validatePatientId,
  validateIsraeliId,
  validateUsSsn,
  validateCanadianHealth,
  validateUkNhs,
  getPatientIdFormatInfo,
  generateSamplePatientId
};
