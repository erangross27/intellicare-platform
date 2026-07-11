/**
 * Country Configuration Utility
 * Centralized configuration for country-specific patient fields, validation rules, and field definitions
 * Based on PatientSchemaFactory.js backend schema
 */

// Country configurations with field definitions, validation rules, and UI properties
const countryConfigurations = {
  'Israel': {
    country: 'Israel',
    countryCode: 'IL',
    fields: {
      nationalId: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{9}$',
        maxLength: 9,
        minLength: 9,
        label: 'nationalId',
        placeholder: '123456789',
        helpText: '9-digit Israeli ID number',
        validation: 'israeliId',
        inputMode: 'numeric'
      },
      healthFund: {
        required: true,
        type: 'select',
        options: ['מכבי', 'כללית', 'מאוחדת', 'לאומית'],
        label: 'healthFund',
        helpText: 'Israeli health fund provider'
      }
    }
  },
  'United States': {
    country: 'United States',
    countryCode: 'US',
    fields: {
      socialSecurityNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{3}-[0-9]{2}-[0-9]{4}$',
        maxLength: 11,
        label: 'socialSecurityNumber',
        placeholder: '123-45-6789',
        helpText: 'Format: XXX-XX-XXXX',
        validation: 'ssn',
        inputMode: 'numeric'
      },
      insuranceProvider: {
        required: false,
        type: 'text',
        maxLength: 100,
        label: 'insuranceProvider',
        placeholder: 'Blue Cross Blue Shield',
        helpText: 'Health insurance company name'
      }
    }
  },
  'Canada': {
    country: 'Canada',
    countryCode: 'CA',
    fields: {
      healthCardNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9A-Z]{8,12}$',
        maxLength: 12,
        label: 'healthCardNumber',
        placeholder: '1234567890',
        helpText: 'Provincial health card number',
        validation: 'canadianHealthCard'
      },
      province: {
        required: true,
        type: 'select',
        options: [
          'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
          'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
          'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'
        ],
        label: 'province',
        helpText: 'Canadian province or territory'
      }
    }
  },
  'United Kingdom': {
    country: 'United Kingdom',
    countryCode: 'GB',
    fields: {
      nhsNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{3} [0-9]{3} [0-9]{4}$',
        maxLength: 12,
        label: 'nhsNumber',
        placeholder: '123 456 7890',
        helpText: 'Format: XXX XXX XXXX',
        validation: 'nhsNumber',
        inputMode: 'numeric'
      }
    }
  },
  'Germany': {
    country: 'Germany',
    countryCode: 'DE',
    fields: {
      healthInsuranceNumber: {
        required: true,
        type: 'text',
        pattern: '^[A-Z][0-9]{9}$',
        maxLength: 10,
        label: 'healthInsuranceNumber',
        placeholder: 'A123456789',
        helpText: 'Format: Letter + 9 digits',
        validation: 'germanHealthInsurance'
      },
      insuranceProvider: {
        required: false,
        type: 'text',
        maxLength: 100,
        label: 'insuranceProvider',
        placeholder: 'AOK',
        helpText: 'Health insurance company name'
      }
    }
  },
  'France': {
    country: 'France',
    countryCode: 'FR',
    fields: {
      socialSecurityNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{13}$',
        maxLength: 13,
        label: 'socialSecurityNumber',
        placeholder: '1234567890123',
        helpText: '13-digit social security number',
        validation: 'frenchSocialSecurity',
        inputMode: 'numeric'
      },
      vitaleCardNumber: {
        required: false,
        type: 'text',
        pattern: '^[0-9]{15}$',
        maxLength: 15,
        label: 'vitaleCardNumber',
        placeholder: '123456789012345',
        helpText: '15-digit Carte Vitale number',
        inputMode: 'numeric'
      }
    }
  },
  'Spain': {
    country: 'Spain',
    countryCode: 'ES',
    fields: {
      healthCardNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{12}$',
        maxLength: 12,
        label: 'healthCardNumber',
        placeholder: '123456789012',
        helpText: '12-digit health card number',
        validation: 'spanishHealthCard',
        inputMode: 'numeric'
      },
      autonomousCommunity: {
        required: false,
        type: 'select',
        options: [
          'Andalusia', 'Aragon', 'Asturias', 'Balearic Islands', 'Basque Country',
          'Canary Islands', 'Cantabria', 'Castile and León', 'Castile-La Mancha',
          'Catalonia', 'Extremadura', 'Galicia', 'La Rioja', 'Madrid',
          'Murcia', 'Navarre', 'Valencia', 'Ceuta', 'Melilla'
        ],
        label: 'autonomousCommunity',
        helpText: 'Spanish autonomous community'
      }
    }
  },
  'Brazil': {
    country: 'Brazil',
    countryCode: 'BR',
    fields: {
      cpfNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{3}\\.[0-9]{3}\\.[0-9]{3}-[0-9]{2}$',
        maxLength: 14,
        label: 'cpfNumber',
        placeholder: '123.456.789-01',
        helpText: 'Format: XXX.XXX.XXX-XX',
        validation: 'brazilianCpf',
        inputMode: 'numeric'
      },
      susNumber: {
        required: false,
        type: 'text',
        pattern: '^[0-9]{15}$',
        maxLength: 15,
        label: 'susNumber',
        placeholder: '123456789012345',
        helpText: '15-digit SUS card number',
        inputMode: 'numeric'
      },
      state: {
        required: false,
        type: 'select',
        options: [
          'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará',
          'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão',
          'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará',
          'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro',
          'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia',
          'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'
        ],
        label: 'state',
        helpText: 'Brazilian state'
      }
    }
  },
  'Argentina': {
    country: 'Argentina',
    countryCode: 'AR',
    fields: {
      nationalIdNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{8}$',
        maxLength: 8,
        label: 'nationalIdNumber',
        placeholder: '12345678',
        helpText: '8-digit national ID number',
        validation: 'argentinianId',
        inputMode: 'numeric'
      },
      healthInsuranceProvider: {
        required: false,
        type: 'text',
        maxLength: 100,
        label: 'healthInsuranceProvider',
        placeholder: 'OSDE',
        helpText: 'Health insurance provider name'
      },
      province: {
        required: false,
        type: 'select',
        options: [
          'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
          'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa',
          'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
          'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
          'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
          'Ciudad Autónoma de Buenos Aires'
        ],
        label: 'province',
        helpText: 'Argentine province'
      }
    }
  },
  'Japan': {
    country: 'Japan',
    countryCode: 'JP',
    fields: {
      healthInsuranceNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{8}$',
        maxLength: 8,
        label: 'healthInsuranceNumber',
        placeholder: '12345678',
        helpText: '8-digit health insurance number',
        validation: 'japaneseHealthInsurance',
        inputMode: 'numeric'
      },
      prefecture: {
        required: false,
        type: 'select',
        options: [
          'Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata',
          'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba',
          'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui',
          'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie',
          'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama',
          'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi',
          'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga',
          'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa'
        ],
        label: 'prefecture',
        helpText: 'Japanese prefecture'
      },
      insuranceType: {
        required: false,
        type: 'select',
        options: ['National Health Insurance', 'Employee Health Insurance', 'Mutual Aid Insurance'],
        label: 'insuranceType',
        helpText: 'Type of health insurance'
      }
    }
  },
  'South Korea': {
    country: 'South Korea',
    countryCode: 'KR',
    fields: {
      residentRegistrationNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{6}-[0-9]{7}$',
        maxLength: 14,
        label: 'residentRegistrationNumber',
        placeholder: '123456-1234567',
        helpText: 'Format: YYMMDD-NNNNNNN',
        validation: 'koreanResidentRegistration',
        inputMode: 'numeric'
      },
      nationalHealthInsuranceNumber: {
        required: false,
        type: 'text',
        pattern: '^[0-9]{11}$',
        maxLength: 11,
        label: 'nationalHealthInsuranceNumber',
        placeholder: '12345678901',
        helpText: '11-digit health insurance number',
        inputMode: 'numeric'
      }
    }
  },
  'Australia': {
    country: 'Australia',
    countryCode: 'AU',
    fields: {
      medicareNumber: {
        required: true,
        type: 'text',
        pattern: '^[0-9]{10}$',
        maxLength: 10,
        label: 'medicareNumber',
        placeholder: '1234567890',
        helpText: '10-digit Medicare number',
        validation: 'australianMedicare',
        inputMode: 'numeric'
      },
      state: {
        required: false,
        type: 'select',
        options: [
          'Australian Capital Territory', 'New South Wales', 'Northern Territory',
          'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'
        ],
        label: 'state',
        helpText: 'Australian state or territory'
      },
      indigenousStatus: {
        required: false,
        type: 'select',
        options: ['Aboriginal', 'Torres Strait Islander', 'Both Aboriginal and Torres Strait Islander', 'Neither'],
        label: 'indigenousStatus',
        helpText: 'Indigenous status (optional)'
      }
    }
  },
  'New Zealand': {
    country: 'New Zealand',
    countryCode: 'NZ',
    fields: {
      nationalHealthIndexNumber: {
        required: true,
        type: 'text',
        pattern: '^[A-Z]{3}[0-9]{4}$',
        maxLength: 7,
        label: 'nationalHealthIndexNumber',
        placeholder: 'ABC1234',
        helpText: 'Format: 3 letters + 4 digits',
        validation: 'newZealandNHI'
      },
      ethnicity: {
        required: false,
        type: 'select',
        options: [
          'New Zealand European', 'Māori', 'Pacific Peoples', 'Asian',
          'Middle Eastern/Latin American/African', 'Other', 'Prefer not to say'
        ],
        label: 'ethnicity',
        helpText: 'Ethnicity (optional)'
      }
    }
  }
};

/**
 * Get all supported countries
 * @returns {string[]} Array of supported country names
 */
export const getSupportedCountries = () => {
  return Object.keys(countryConfigurations);
};

/**
 * Get configuration for a specific country
 * @param {string} countryName - The country name
 * @returns {object|null} Country configuration object or null if not found
 */
export const getCountryConfig = (countryName) => {
  return countryConfigurations[countryName] || null;
};

/**
 * Get fields for a specific country
 * @param {string} countryName - The country name
 * @returns {object} Object containing field configurations
 */
export const getCountryFields = (countryName) => {
  const config = getCountryConfig(countryName);
  return config ? config.fields : {};
};

/**
 * Get required fields for a country
 * @param {string} countryName - The country name
 * @returns {string[]} Array of required field names
 */
export const getRequiredFields = (countryName) => {
  const fields = getCountryFields(countryName);
  return Object.keys(fields).filter(fieldName => fields[fieldName].required);
};

/**
 * Get optional fields for a country
 * @param {string} countryName - The country name
 * @returns {string[]} Array of optional field names
 */
export const getOptionalFields = (countryName) => {
  const fields = getCountryFields(countryName);
  return Object.keys(fields).filter(fieldName => !fields[fieldName].required);
};

/**
 * Validate a field value based on country-specific rules
 * @param {string} countryName - The country name
 * @param {string} fieldName - The field name
 * @param {string} value - The field value
 * @returns {boolean} True if valid, false otherwise
 */
export const validateField = (countryName, fieldName, value) => {
  const fields = getCountryFields(countryName);
  const fieldConfig = fields[fieldName];
  
  if (!fieldConfig) return true; // Field not configured for this country
  
  // Check required fields
  if (fieldConfig.required && (!value || value.trim() === '')) {
    return false;
  }
  
  // Check pattern if provided
  if (value && fieldConfig.pattern) {
    const regex = new RegExp(fieldConfig.pattern);
    return regex.test(value);
  }
  
  // Check length constraints
  if (value) {
    if (fieldConfig.maxLength && value.length > fieldConfig.maxLength) {
      return false;
    }
    if (fieldConfig.minLength && value.length < fieldConfig.minLength) {
      return false;
    }
  }
  
  return true;
};

/**
 * Get validation error message for a field
 * @param {string} countryName - The country name
 * @param {string} fieldName - The field name
 * @param {string} value - The field value
 * @param {function} t - Translation function
 * @returns {string|null} Error message or null if valid
 */
export const getFieldError = (countryName, fieldName, value, t) => {
  const fields = getCountryFields(countryName);
  const fieldConfig = fields[fieldName];
  
  if (!fieldConfig) return null;
  
  // Check required fields
  if (fieldConfig.required && (!value || value.trim() === '')) {
    return t('fieldRequired');
  }
  
  // Check pattern if provided
  if (value && fieldConfig.pattern) {
    const regex = new RegExp(fieldConfig.pattern);
    if (!regex.test(value)) {
      return t('invalidFormat');
    }
  }
  
  // Check length constraints
  if (value) {
    if (fieldConfig.maxLength && value.length > fieldConfig.maxLength) {
      return `Maximum ${fieldConfig.maxLength} characters allowed`;
    }
    if (fieldConfig.minLength && value.length < fieldConfig.minLength) {
      return `Minimum ${fieldConfig.minLength} characters required`;
    }
  }
  
  return null;
};

export default {
  getSupportedCountries,
  getCountryConfig,
  getCountryFields,
  getRequiredFields,
  getOptionalFields,
  validateField,
  getFieldError
};
