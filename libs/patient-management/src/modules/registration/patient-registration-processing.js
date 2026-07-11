/**
 * Patient Registration Processing Module
 * Handles the core processing logic for patient registration including country-specific requirements
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientRegistrationProcessing {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Authenticate service
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-registration-processing');
    this.initialized = true;
    console.log('✅ [PatientRegProcessing] Service initialized');
  }

  /**
   * Process patient registration data with country-specific logic
   * @param {Object} params - Patient registration parameters
   * @param {Object} practiceContext - Practice context information
   * @param {Object} session - Current session
   * @returns {Object} Processing result
   */
  async processPatientRegistration(params, practiceContext, session) {
    console.log('🔍 [PatientRegProcessing] Starting registration processing');

    try {
      // Detect and set country
      const countryProcessing = await this.processCountryDetection(params, practiceContext);
      if (!countryProcessing.success) {
        return countryProcessing;
      }

      const processedParams = { ...params, ...countryProcessing.additionalData };
      const detectedCountry = countryProcessing.detectedCountry;

      // Apply country-specific processing
      let countrySpecificResult;
      if (detectedCountry === 'Israel') {
        countrySpecificResult = await this.processIsraeliPatient(processedParams, practiceContext);
      } else {
        countrySpecificResult = await this.processUSPatient(processedParams, practiceContext);
      }

      if (!countrySpecificResult.success) {
        return countrySpecificResult;
      }

      // Format and normalize data
      const formattedData = this.formatPatientData(countrySpecificResult.processedData, detectedCountry);

      return {
        success: true,
        processedData: formattedData,
        detectedCountry,
        processingSteps: {
          countryDetection: 'completed',
          countrySpecificProcessing: 'completed',
          dataFormatting: 'completed'
        },
        message: 'Patient registration processing completed successfully'
      };

    } catch (error) {
      console.error('❌ [PatientRegProcessing] Processing failed:', error);
      return {
        success: false,
        error: 'PROCESSING_FAILED',
        message: error.message || 'Patient registration processing failed'
      };
    }
  }

  /**
   * Detect patient's country and apply initial processing
   * @param {Object} params - Patient parameters
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Country detection result
   */
  async processCountryDetection(params, practiceContext) {
    console.log('🌍 [PatientRegProcessing] Detecting patient country');

    // Determine country context - check multiple sources
    let detectedCountry = practiceContext.country || params.country;

    // If we have SSN or US insurance, it's likely a US patient
    if (!detectedCountry && (params.socialSecurityNumber || params.insuranceProvider)) {
      console.log('🇺🇸 Detected US patient based on SSN or insurance provider');
      detectedCountry = 'USA';
    }

    // If we have Israeli health fund, it's likely an Israeli patient  
    if (!detectedCountry && params.healthFund) {
      console.log('🇮🇱 Detected Israeli patient based on health fund');
      detectedCountry = 'Israel';
    }

    // Default to USA if still not determined (most common case)
    if (!detectedCountry) {
      console.log('📍 No country detected, defaulting to USA');
      detectedCountry = 'USA';
    }

    const isIsrael = detectedCountry === 'Israel' || detectedCountry === 'IL';
    const isUSA = detectedCountry === 'United States' || detectedCountry === 'USA' || detectedCountry === 'US';

    console.log(`🌍 Country check - isIsrael: ${isIsrael}, isUSA: ${isUSA}, detectedCountry: ${detectedCountry}`);

    return {
      success: true,
      detectedCountry,
      isIsrael,
      isUSA,
      additionalData: {
        country: detectedCountry,
        isIsrael,
        isUSA
      }
    };
  }

  /**
   * Process Israeli patient specific requirements
   * @param {Object} params - Patient parameters
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Processing result
   */
  async processIsraeliPatient(params, practiceContext) {
    console.log('🇮🇱 [PatientRegProcessing] Processing Israeli patient');

    const processedParams = { ...params };

    // Map nationalId if not provided but other ID fields are
    if (!processedParams.nationalId) {
      if (processedParams.ssn || processedParams.socialSecurityNumber) {
        // User provided SSN but this is an Israeli practice - map to nationalId
        processedParams.nationalId = processedParams.ssn || processedParams.socialSecurityNumber;
        delete processedParams.ssn;
        delete processedParams.socialSecurityNumber;
        console.log('📝 Mapped SSN to national ID for Israeli patient');
      }
    }

    // Ensure healthFund is provided for Israeli patients
    if (!processedParams.healthFund) {
      // Check if it might be under a different name
      if (processedParams.health_fund) {
        processedParams.healthFund = processedParams.health_fund;
        delete processedParams.health_fund;
      } else if (processedParams.קופת_חולים) {
        processedParams.healthFund = processedParams.קופת_חולים;
        delete processedParams.קופת_חולים;
      } else if (processedParams.kupat_holim) {
        processedParams.healthFund = processedParams.kupat_holim;
        delete processedParams.kupat_holim;
      } else {
        // Default health fund if not specified
        processedParams.healthFund = 'Clalit';
        console.log('📋 Defaulted to Clalit health fund');
      }
    }

    // Validate Israeli national ID if provided
    if (processedParams.nationalId) {
      if (!this.validateIsraeliId(processedParams.nationalId)) {
        return {
          success: false,
          error: 'INVALID_NATIONAL_ID',
          message: practiceContext.language === 'he' 
            ? 'מספר זהות לא תקין'
            : 'Invalid Israeli national ID'
        };
      }
    }

    return {
      success: true,
      processedData: processedParams
    };
  }

  /**
   * Process US patient specific requirements
   * @param {Object} params - Patient parameters
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Processing result
   */
  async processUSPatient(params, practiceContext) {
    console.log('🇺🇸 [PatientRegProcessing] Processing US patient');

    const processedParams = { ...params };

    // Insurance provider validation for US patients
    if (!processedParams.insuranceProvider) {
      return {
        success: false,
        error: 'MISSING_INSURANCE_PROVIDER',
        message: 'Insurance provider is required for US patients. Please provide the insurance provider (e.g., Medicare, Blue Cross, Aetna, UnitedHealth, Cigna, Kaiser, Humana, etc.)'
      };
    }

    // Validate and normalize insurance provider
    const insuranceResult = this.validateUSInsuranceProvider(processedParams.insuranceProvider);
    if (!insuranceResult.isValid) {
      console.log(`⚠️ Unusual insurance provider: ${processedParams.insuranceProvider} - allowing but logging`);
    }

    // Validate and format SSN if provided
    if (processedParams.socialSecurityNumber) {
      const ssnResult = this.validateAndFormatSSN(processedParams.socialSecurityNumber);
      if (!ssnResult.success) {
        return {
          success: false,
          error: 'INVALID_SSN',
          message: ssnResult.message
        };
      }
      processedParams.socialSecurityNumber = ssnResult.formattedSSN;
    }

    // Auto-detect state from city if not provided
    if (!processedParams.state && processedParams.city) {
      const stateResult = await this.detectStateFromCity(processedParams.city);
      if (stateResult.success) {
        processedParams.state = stateResult.stateCode;
        if (stateResult.enhancedCity) {
          processedParams.city = stateResult.enhancedCity;
        }
        console.log(`✅ Auto-detected state as ${stateResult.stateCode} for ${processedParams.city}`);
      }
    }

    return {
      success: true,
      processedData: processedParams
    };
  }

  /**
   * Format patient data for final processing
   * @param {Object} data - Processed patient data
   * @param {string} country - Detected country
   * @returns {Object} Formatted data
   */
  formatPatientData(data, country) {
    const formatted = { ...data };

    // Format date if needed
    if (formatted.dateOfBirth && !formatted.dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
      formatted.dateOfBirth = this.formatDate(formatted.dateOfBirth);
    }

    // Normalize names
    if (formatted.firstName) {
      formatted.firstName = formatted.firstName.trim();
    }
    if (formatted.lastName) {
      formatted.lastName = formatted.lastName.trim();
    }

    // Normalize email
    if (formatted.email) {
      formatted.email = formatted.email.toLowerCase().trim();
    }

    // Add metadata
    formatted.registrationMetadata = {
      detectedCountry: country,
      processedAt: new Date().toISOString(),
      source: 'registration-processing'
    };

    return formatted;
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
   * Validate US insurance provider
   * @param {string} provider - Insurance provider name
   * @returns {Object} Validation result
   */
  validateUSInsuranceProvider(provider) {
    const commonUSInsurers = [
      'medicare', 'medicaid', 'tricare', 'va', 'veterans affairs', 'chip',
      'unitedhealth', 'united healthcare', 'uhc', 'unitedhealthcare',
      'elevance', 'elevance health', 'anthem',
      'aetna', 'cvs', 'cvs health', 'cvs aetna',
      'cigna', 'cigna healthcare', 'humana',
      'kaiser', 'kaiser permanente', 'kaiser foundation',
      'blue cross', 'blue shield', 'bcbs', 'bluecross', 'blueshield'
    ];

    const normalizedProvider = provider.toLowerCase().trim();
    const isValidInsurer = commonUSInsurers.some(insurer =>
      normalizedProvider.includes(insurer) || insurer.includes(normalizedProvider)
    );

    return {
      isValid: isValidInsurer,
      normalizedProvider
    };
  }

  /**
   * Validate and format SSN
   * @param {string} ssn - SSN to validate
   * @returns {Object} Validation result
   */
  validateAndFormatSSN(ssn) {
    const ssnRegex = /^(?:\d{3}-\d{2}-\d{4}|\d{9})$/;
    const cleanSSN = ssn.replace(/\s/g, '');

    if (!ssnRegex.test(cleanSSN)) {
      // Try to format if possible
      const digitsOnly = ssn.replace(/\D/g, '');
      if (digitsOnly.length === 9) {
        const formattedSSN = `${digitsOnly.substr(0, 3)}-${digitsOnly.substr(3, 2)}-${digitsOnly.substr(5, 4)}`;
        return {
          success: true,
          formattedSSN
        };
      } else {
        return {
          success: false,
          message: 'Invalid SSN format. Please provide a valid 9-digit Social Security Number (XXX-XX-XXXX)'
        };
      }
    }

    return {
      success: true,
      formattedSSN: cleanSSN
    };
  }

  /**
   * Detect state from city name
   * @param {string} city - City name
   * @returns {Object} Detection result
   */
  async detectStateFromCity(city) {
    try {
      // Try geocoding service first
      const proxy = getServiceProxy();
      const geocodingService = proxy.getService('geocodingService');
      const locationDetails = await geocodingService.getLocationDetails(city);
      if (locationDetails.success && locationDetails.stateCode) {
        return {
          success: true,
          stateCode: locationDetails.stateCode,
          enhancedCity: locationDetails.city
        };
      }
    } catch (error) {
      console.log('⚠️ Geocoding failed, using fallback mapping');
    }

    // Fallback to common city-state mappings
    const commonCityStates = {
      'san jose': 'CA', 'san francisco': 'CA', 'los angeles': 'CA', 'san diego': 'CA',
      'new york': 'NY', 'manhattan': 'NY', 'brooklyn': 'NY',
      'chicago': 'IL', 'houston': 'TX', 'dallas': 'TX', 'austin': 'TX',
      'phoenix': 'AZ', 'philadelphia': 'PA', 'miami': 'FL', 'atlanta': 'GA',
      'boston': 'MA', 'seattle': 'WA', 'denver': 'CO', 'las vegas': 'NV'
    };

    const cityLower = city.toLowerCase();
    const stateCode = commonCityStates[cityLower];

    return {
      success: !!stateCode,
      stateCode: stateCode || null
    };
  }

  /**
   * Format date to YYYY-MM-DD
   * @param {string} dateString - Date string to format
   * @returns {string} Formatted date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid

    return date.toISOString().split('T')[0];
  }
}

const patientRegistrationProcessing = new PatientRegistrationProcessing();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientRegistrationProcessing', () => patientRegistrationProcessing);
}

module.exports = patientRegistrationProcessing;