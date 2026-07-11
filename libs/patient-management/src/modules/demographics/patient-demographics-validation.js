/**
 * Patient Demographics Validation Module
 * Provides comprehensive validation for patient demographic data
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientDemographicsValidation {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Authenticate service
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-demographics-validation');
    this.initialized = true;
    console.log('✅ [PatientDemographicsValidation] Service initialized');
  }

  /**
   * Comprehensive validation of patient demographics
   * @param {Object} demographicsData - Demographics data to validate
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  async validateDemographics(demographicsData, practiceContext, options = {}) {
    console.log('🔍 [PatientDemographicsValidation] Validating demographics data');

    const validationResult = {
      success: true,
      errors: [],
      warnings: [],
      validatedData: {},
      fieldResults: {}
    };

    // Validate each field
    const fieldValidations = [
      this.validateBasicInfo(demographicsData, practiceContext),
      this.validateContactInfo(demographicsData, practiceContext),
      this.validateAddressInfo(demographicsData, practiceContext),
      this.validateIdentityInfo(demographicsData, practiceContext),
      this.validateEmergencyContact(demographicsData, practiceContext),
      this.validateMedicalInfo(demographicsData, practiceContext),
      this.validatePreferences(demographicsData, practiceContext)
    ];

    // Process all field validations
    for (const fieldValidation of fieldValidations) {
      if (!fieldValidation.success) {
        validationResult.errors.push(...fieldValidation.errors);
        validationResult.success = false;
      }
      if (fieldValidation.warnings) {
        validationResult.warnings.push(...fieldValidation.warnings);
      }
      Object.assign(validationResult.fieldResults, fieldValidation.fieldResults);
      Object.assign(validationResult.validatedData, fieldValidation.validatedData);
    }

    // Cross-field validation
    const crossFieldValidation = this.validateCrossFieldConstraints(demographicsData, practiceContext);
    if (!crossFieldValidation.success) {
      validationResult.errors.push(...crossFieldValidation.errors);
      validationResult.success = false;
    }

    // Business rules validation
    const businessRulesValidation = this.validateBusinessRules(demographicsData, practiceContext);
    if (!businessRulesValidation.success) {
      validationResult.errors.push(...businessRulesValidation.errors);
      validationResult.success = false;
    }
    if (businessRulesValidation.warnings) {
      validationResult.warnings.push(...businessRulesValidation.warnings);
    }

    return validationResult;
  }

  /**
   * Validate basic demographic information
   * @param {Object} data - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateBasicInfo(data, practiceContext) {
    const errors = [];
    const warnings = [];
    const validatedData = {};
    const fieldResults = {};

    // Date of birth validation
    if (data.dateOfBirth) {
      const dobResult = this.validateDateOfBirth(data.dateOfBirth);
      if (!dobResult.success) {
        errors.push(...dobResult.errors);
        fieldResults.dateOfBirth = { isValid: false, errors: dobResult.errors };
      } else {
        validatedData.dateOfBirth = dobResult.normalizedDate;
        validatedData.age = dobResult.calculatedAge;
        fieldResults.dateOfBirth = { isValid: true, age: dobResult.calculatedAge };
        
        // Age-based warnings
        if (dobResult.calculatedAge < 0 || dobResult.calculatedAge > 150) {
          warnings.push(`Unusual age detected: ${dobResult.calculatedAge} years`);
        }
      }
    }

    // Gender validation
    if (data.gender) {
      const genderResult = this.validateGender(data.gender);
      if (!genderResult.success) {
        errors.push(...genderResult.errors);
        fieldResults.gender = { isValid: false, errors: genderResult.errors };
      } else {
        validatedData.gender = genderResult.normalizedGender;
        fieldResults.gender = { isValid: true, normalized: genderResult.normalizedGender };
      }
    }

    // Marital status validation
    if (data.maritalStatus) {
      const maritalResult = this.validateMaritalStatus(data.maritalStatus);
      if (!maritalResult.success) {
        errors.push(...maritalResult.errors);
        fieldResults.maritalStatus = { isValid: false, errors: maritalResult.errors };
      } else {
        validatedData.maritalStatus = maritalResult.normalizedStatus;
        fieldResults.maritalStatus = { isValid: true, normalized: maritalResult.normalizedStatus };
      }
    }

    // Ethnicity validation
    if (data.ethnicity) {
      const ethnicityResult = this.validateEthnicity(data.ethnicity);
      if (!ethnicityResult.success) {
        errors.push(...ethnicityResult.errors);
        fieldResults.ethnicity = { isValid: false, errors: ethnicityResult.errors };
      } else {
        validatedData.ethnicity = ethnicityResult.normalizedEthnicity;
        fieldResults.ethnicity = { isValid: true, normalized: ethnicityResult.normalizedEthnicity };
      }
    }

    // Race validation
    if (data.race) {
      const raceResult = this.validateRace(data.race);
      if (!raceResult.success) {
        errors.push(...raceResult.errors);
        fieldResults.race = { isValid: false, errors: raceResult.errors };
      } else {
        validatedData.race = raceResult.normalizedRace;
        fieldResults.race = { isValid: true, normalized: raceResult.normalizedRace };
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      validatedData,
      fieldResults
    };
  }

  /**
   * Validate contact information
   * @param {Object} data - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateContactInfo(data, practiceContext) {
    const errors = [];
    const warnings = [];
    const validatedData = {};
    const fieldResults = {};

    // Email validation
    if (data.email) {
      const emailResult = this.validateEmail(data.email);
      if (!emailResult.success) {
        errors.push(...emailResult.errors);
        fieldResults.email = { isValid: false, errors: emailResult.errors };
      } else {
        validatedData.email = emailResult.normalizedEmail;
        fieldResults.email = { isValid: true, normalized: emailResult.normalizedEmail };
      }
    } else {
      warnings.push('Email address not provided - patient notifications will be limited');
    }

    // Phone validation
    if (data.phone) {
      const phoneResult = this.validatePhone(data.phone, practiceContext.country);
      if (!phoneResult.success) {
        errors.push(...phoneResult.errors);
        fieldResults.phone = { isValid: false, errors: phoneResult.errors };
      } else {
        validatedData.phone = phoneResult.normalizedPhone;
        fieldResults.phone = { isValid: true, normalized: phoneResult.normalizedPhone };
      }
    } else {
      warnings.push('Phone number not provided - emergency contact may be difficult');
    }

    // Alternative phone validation
    if (data.alternativePhone) {
      const altPhoneResult = this.validatePhone(data.alternativePhone, practiceContext.country);
      if (!altPhoneResult.success) {
        errors.push(`Alternative phone: ${altPhoneResult.errors.join(', ')}`);
        fieldResults.alternativePhone = { isValid: false, errors: altPhoneResult.errors };
      } else {
        validatedData.alternativePhone = altPhoneResult.normalizedPhone;
        fieldResults.alternativePhone = { isValid: true, normalized: altPhoneResult.normalizedPhone };
      }
    }

    // Preferred contact method validation
    if (data.preferredContactMethod) {
      const contactMethodResult = this.validatePreferredContactMethod(data.preferredContactMethod);
      if (!contactMethodResult.success) {
        errors.push(...contactMethodResult.errors);
        fieldResults.preferredContactMethod = { isValid: false, errors: contactMethodResult.errors };
      } else {
        validatedData.preferredContactMethod = contactMethodResult.normalizedMethod;
        fieldResults.preferredContactMethod = { isValid: true, normalized: contactMethodResult.normalizedMethod };
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      validatedData,
      fieldResults
    };
  }

  /**
   * Validate address information
   * @param {Object} data - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateAddressInfo(data, practiceContext) {
    const errors = [];
    const warnings = [];
    const validatedData = {};
    const fieldResults = {};

    // Street address validation
    if (data.street) {
      const streetResult = this.validateStreetAddress(data.street);
      if (!streetResult.success) {
        errors.push(...streetResult.errors);
        fieldResults.street = { isValid: false, errors: streetResult.errors };
      } else {
        validatedData.street = streetResult.normalizedStreet;
        fieldResults.street = { isValid: true, normalized: streetResult.normalizedStreet };
      }
    }

    // City validation
    if (data.city) {
      const cityResult = this.validateCity(data.city);
      if (!cityResult.success) {
        errors.push(...cityResult.errors);
        fieldResults.city = { isValid: false, errors: cityResult.errors };
      } else {
        validatedData.city = cityResult.normalizedCity;
        fieldResults.city = { isValid: true, normalized: cityResult.normalizedCity };
      }
    }

    // State/Province validation
    if (data.state) {
      const stateResult = this.validateState(data.state, practiceContext.country);
      if (!stateResult.success) {
        errors.push(...stateResult.errors);
        fieldResults.state = { isValid: false, errors: stateResult.errors };
      } else {
        validatedData.state = stateResult.normalizedState;
        fieldResults.state = { isValid: true, normalized: stateResult.normalizedState };
      }
    }

    // ZIP/Postal code validation
    if (data.zipCode) {
      const zipResult = this.validateZipCode(data.zipCode, practiceContext.country);
      if (!zipResult.success) {
        errors.push(...zipResult.errors);
        fieldResults.zipCode = { isValid: false, errors: zipResult.errors };
      } else {
        validatedData.zipCode = zipResult.normalizedZip;
        fieldResults.zipCode = { isValid: true, normalized: zipResult.normalizedZip };
      }
    }

    // Country validation
    if (data.country) {
      const countryResult = this.validateCountry(data.country);
      if (!countryResult.success) {
        errors.push(...countryResult.errors);
        fieldResults.country = { isValid: false, errors: countryResult.errors };
      } else {
        validatedData.country = countryResult.normalizedCountry;
        fieldResults.country = { isValid: true, normalized: countryResult.normalizedCountry };
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      validatedData,
      fieldResults
    };
  }

  /**
   * Validate identity information
   * @param {Object} data - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateIdentityInfo(data, practiceContext) {
    const errors = [];
    const warnings = [];
    const validatedData = {};
    const fieldResults = {};

    const detectedCountry = practiceContext.country || data.country || 'USA';

    // National ID validation (for non-US countries)
    if (data.nationalId) {
      const nationalIdResult = this.validateNationalId(data.nationalId, detectedCountry);
      if (!nationalIdResult.success) {
        errors.push(...nationalIdResult.errors);
        fieldResults.nationalId = { isValid: false, errors: nationalIdResult.errors };
      } else {
        validatedData.nationalId = nationalIdResult.normalizedId;
        fieldResults.nationalId = { isValid: true, normalized: nationalIdResult.normalizedId };
      }
    }

    // SSN validation (for US)
    if (data.socialSecurityNumber) {
      const ssnResult = this.validateSSN(data.socialSecurityNumber);
      if (!ssnResult.success) {
        errors.push(...ssnResult.errors);
        fieldResults.socialSecurityNumber = { isValid: false, errors: ssnResult.errors };
      } else {
        validatedData.socialSecurityNumber = ssnResult.normalizedSSN;
        fieldResults.socialSecurityNumber = { isValid: true, normalized: ssnResult.normalizedSSN };
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      validatedData,
      fieldResults
    };
  }

  /**
   * Validate emergency contact information
   * @param {Object} data - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateEmergencyContact(data, practiceContext) {
    const errors = [];
    const warnings = [];
    const validatedData = {};
    const fieldResults = {};

    if (data.emergencyContact) {
      const ec = data.emergencyContact;
      const emergencyContactValidated = {};
      const emergencyContactResults = {};

      // Emergency contact name
      if (ec.name) {
        if (ec.name.length < 2 || ec.name.length > 100) {
          errors.push('Emergency contact name must be between 2-100 characters');
          emergencyContactResults.name = { isValid: false, error: 'Invalid name length' };
        } else {
          emergencyContactValidated.name = ec.name.trim();
          emergencyContactResults.name = { isValid: true };
        }
      } else {
        errors.push('Emergency contact name is required when emergency contact is provided');
      }

      // Emergency contact relationship
      if (ec.relationship) {
        const relationshipResult = this.validateRelationship(ec.relationship);
        if (!relationshipResult.success) {
          errors.push(`Emergency contact relationship: ${relationshipResult.errors.join(', ')}`);
          emergencyContactResults.relationship = { isValid: false, errors: relationshipResult.errors };
        } else {
          emergencyContactValidated.relationship = relationshipResult.normalizedRelationship;
          emergencyContactResults.relationship = { isValid: true, normalized: relationshipResult.normalizedRelationship };
        }
      } else {
        errors.push('Emergency contact relationship is required when emergency contact is provided');
      }

      // Emergency contact phone
      if (ec.phone) {
        const phoneResult = this.validatePhone(ec.phone, practiceContext.country);
        if (!phoneResult.success) {
          errors.push(`Emergency contact phone: ${phoneResult.errors.join(', ')}`);
          emergencyContactResults.phone = { isValid: false, errors: phoneResult.errors };
        } else {
          emergencyContactValidated.phone = phoneResult.normalizedPhone;
          emergencyContactResults.phone = { isValid: true, normalized: phoneResult.normalizedPhone };
        }
      } else {
        errors.push('Emergency contact phone is required when emergency contact is provided');
      }

      if (Object.keys(emergencyContactValidated).length > 0) {
        validatedData.emergencyContact = emergencyContactValidated;
      }
      fieldResults.emergencyContact = emergencyContactResults;
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      validatedData,
      fieldResults
    };
  }

  /**
   * Validate medical information
   * @param {Object} data - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateMedicalInfo(data, practiceContext) {
    const errors = [];
    const warnings = [];
    const validatedData = {};
    const fieldResults = {};

    // Blood type validation
    if (data.bloodType) {
      const bloodTypeResult = this.validateBloodType(data.bloodType);
      if (!bloodTypeResult.success) {
        errors.push(...bloodTypeResult.errors);
        fieldResults.bloodType = { isValid: false, errors: bloodTypeResult.errors };
      } else {
        validatedData.bloodType = bloodTypeResult.normalizedBloodType;
        fieldResults.bloodType = { isValid: true, normalized: bloodTypeResult.normalizedBloodType };
      }
    }

    // Organ donor status
    if (data.organDonor !== undefined) {
      if (typeof data.organDonor !== 'boolean') {
        errors.push('Organ donor status must be true or false');
        fieldResults.organDonor = { isValid: false, error: 'Must be boolean' };
      } else {
        validatedData.organDonor = data.organDonor;
        fieldResults.organDonor = { isValid: true };
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      validatedData,
      fieldResults
    };
  }

  /**
   * Validate preferences
   * @param {Object} data - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validatePreferences(data, practiceContext) {
    const errors = [];
    const warnings = [];
    const validatedData = {};
    const fieldResults = {};

    // Preferred language validation
    if (data.preferredLanguage) {
      const languageResult = this.validatePreferredLanguage(data.preferredLanguage);
      if (!languageResult.success) {
        errors.push(...languageResult.errors);
        fieldResults.preferredLanguage = { isValid: false, errors: languageResult.errors };
      } else {
        validatedData.preferredLanguage = languageResult.normalizedLanguage;
        fieldResults.preferredLanguage = { isValid: true, normalized: languageResult.normalizedLanguage };
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      validatedData,
      fieldResults
    };
  }

  /**
   * Validate cross-field constraints
   * @param {Object} data - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateCrossFieldConstraints(data, practiceContext) {
    const errors = [];

    // Age and marital status consistency
    if (data.dateOfBirth && data.maritalStatus) {
      const age = this.calculateAge(data.dateOfBirth);
      if (age < 16 && ['married', 'divorced', 'widowed'].includes(data.maritalStatus)) {
        errors.push('Marital status inconsistent with age');
      }
    }

    // Contact method availability
    if (data.preferredContactMethod) {
      if (data.preferredContactMethod === 'email' && !data.email) {
        errors.push('Preferred contact method is email but no email address provided');
      }
      if (data.preferredContactMethod === 'phone' && !data.phone) {
        errors.push('Preferred contact method is phone but no phone number provided');
      }
      if (data.preferredContactMethod === 'sms' && !data.phone) {
        errors.push('Preferred contact method is SMS but no phone number provided');
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Validate business rules
   * @param {Object} data - Demographics data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateBusinessRules(data, practiceContext) {
    const errors = [];
    const warnings = [];

    // Minimum age requirements for certain operations
    if (data.dateOfBirth) {
      const age = this.calculateAge(data.dateOfBirth);
      if (age < 13 && !data.parentGuardianInfo) {
        warnings.push('Patients under 13 typically require parent/guardian information');
      }
    }

    // Required fields based on practice policies
    const requiredByClinic = practiceContext.requiredDemographicFields || [];
    for (const field of requiredByClinic) {
      if (!data[field]) {
        errors.push(`${field} is required by practice policy`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  }

  // Helper validation methods (abbreviated for space)
  validateDateOfBirth(dob) {
    const date = new Date(dob);
    if (isNaN(date.getTime())) {
      return { success: false, errors: ['Invalid date format'] };
    }
    if (date > new Date()) {
      return { success: false, errors: ['Date of birth cannot be in the future'] };
    }
    return {
      success: true,
      normalizedDate: date.toISOString().split('T')[0],
      calculatedAge: this.calculateAge(date)
    };
  }

  validateGender(gender) {
    const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
    const normalized = gender.toLowerCase();
    if (!validGenders.includes(normalized)) {
      return { success: false, errors: ['Invalid gender value'] };
    }
    return { success: true, normalizedGender: normalized };
  }

  validateEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return { success: false, errors: ['Invalid email format'] };
    }
    return { success: true, normalizedEmail: email.toLowerCase().trim() };
  }

  validatePhone(phone, country = 'USA') {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return { success: false, errors: ['Phone number must be between 10-15 digits'] };
    }
    return { success: true, normalizedPhone: phone };
  }

  calculateAge(dateOfBirth) {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  // Additional validation methods would be implemented here...
  validateMaritalStatus(status) { return { success: true, normalizedStatus: status.toLowerCase() }; }
  validateEthnicity(ethnicity) { return { success: true, normalizedEthnicity: ethnicity }; }
  validateRace(race) { return { success: true, normalizedRace: race }; }
  validatePreferredContactMethod(method) { return { success: true, normalizedMethod: method.toLowerCase() }; }
  validateStreetAddress(street) { return { success: true, normalizedStreet: street.trim() }; }
  validateCity(city) { return { success: true, normalizedCity: city.trim() }; }
  validateState(state, country) { return { success: true, normalizedState: state.trim() }; }
  validateZipCode(zip, country) { return { success: true, normalizedZip: zip.trim() }; }
  validateCountry(country) { return { success: true, normalizedCountry: country.trim() }; }
  validateNationalId(id, country) { return { success: true, normalizedId: id.trim() }; }
  validateSSN(ssn) { return { success: true, normalizedSSN: ssn.trim() }; }
  validateRelationship(relationship) { return { success: true, normalizedRelationship: relationship.toLowerCase() }; }
  validateBloodType(bloodType) { return { success: true, normalizedBloodType: bloodType.toUpperCase() }; }
  validatePreferredLanguage(language) { return { success: true, normalizedLanguage: language.toLowerCase() }; }
}

const patientDemographicsValidation = new PatientDemographicsValidation();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientDemographicsValidation', () => patientDemographicsValidation);
}

module.exports = patientDemographicsValidation;