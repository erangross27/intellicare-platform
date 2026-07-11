/**
 * Patient Data Enrichment Service
 * 
 * Combines multiple LEGAL data sources to help populate patient information
 * This service CANNOT magically get data from SSN alone (that's illegal)
 * But it CAN help streamline data entry using legitimate sources
 */

const ssnVerificationService = require('../../../backend/services/ssnVerificationService');
const stediHealthcareService = require('../../../backend/services/stediHealthcareService'); 
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');

class PatientDataEnrichmentService {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
  }

  async initialize() {
    if (this.initialized) return;
    this.serviceToken = await serviceAccountManager.authenticate('patient-enrichment-service');
    this.initialized = true;
  }

  /**
   * Smart patient data collection workflow
   * Legally obtains as much data as possible from available sources
   */
  async enrichPatientData(params) {
    await this.initialize();
    
    const enrichedData = {
      // Start with what user provided
      ssn: params.ssn,
      firstName: params.firstName,
      lastName: params.lastName,
      dateOfBirth: params.dateOfBirth,
      
      // Track what we found
      dataSource: [],
      verifications: {},
      insurance: {},
      demographics: {},
      requiresManualEntry: []
    };

    // Step 1: Verify SSN is valid (SSA eCBSV)
    if (params.ssn && params.firstName && params.lastName && params.dateOfBirth) {
      try {
        const ssnVerification = await ssnVerificationService.verifySSN({
          ssn: params.ssn,
          firstName: params.firstName,
          lastName: params.lastName,
          dateOfBirth: params.dateOfBirth
        });
        
        enrichedData.verifications.ssn = ssnVerification;
        enrichedData.ssnVerified = ssnVerification.verified;
        
        if (!ssnVerification.verified) {
          return {
            ...enrichedData,
            error: 'SSN verification failed - please check the information'
          };
        }
        
        enrichedData.dataSource.push('SSA eCBSV');
      } catch (error) {
        console.log('SSN verification not available');
      }
    }

    // Step 2: Get Medicare/Insurance data (if Medicare beneficiary)
    if (params.ssn) {
      try {
        // Try Stedi for Medicare data (if production key available)
        const medicareData = await stediHealthcareService.lookupPatientBySSN({
          ssn: params.ssn,
          firstName: params.firstName,
          lastName: params.lastName,
          dateOfBirth: params.dateOfBirth,
          clinicNpi: params.clinicNpi
        });
        
        if (medicareData.success) {
          enrichedData.insurance.medicare = {
            mbi: medicareData.mbi,
            partA: medicareData.insurance?.medicare?.partA,
            partB: medicareData.insurance?.medicare?.partB,
            partC: medicareData.insurance?.medicare?.partC,
            partD: medicareData.insurance?.medicare?.partD
          };
          
          // Sometimes insurance returns address (rare but possible)
          if (medicareData.demographics?.address) {
            enrichedData.demographics.address = medicareData.demographics.address;
            enrichedData.dataSource.push('Medicare');
          }
        }
      } catch (error) {
        console.log('Medicare lookup not available');
      }
    }

    // Step 3: Check our own database for existing patients
    try {
      const existingPatient = await this.findExistingPatient({
        ssn: params.ssn,
        firstName: params.firstName,
        lastName: params.lastName,
        dateOfBirth: params.dateOfBirth
      });
      
      if (existingPatient) {
        enrichedData.existingPatientId = existingPatient._id;
        enrichedData.demographics = {
          ...enrichedData.demographics,
          ...existingPatient.demographics
        };
        enrichedData.dataSource.push('Existing Records');
      }
    } catch (error) {
      console.log('No existing patient found');
    }

    // Step 4: Identify what's still missing
    const requiredFields = [
      'address', 'city', 'state', 'zipCode', 'phone', 'email'
    ];
    
    for (const field of requiredFields) {
      if (!enrichedData.demographics[field]) {
        enrichedData.requiresManualEntry.push(field);
      }
    }

    // Step 5: Provide smart defaults and helpers
    if (enrichedData.requiresManualEntry.includes('state')) {
      // If we have a practice state, suggest it as default
      enrichedData.suggestions = {
        state: params.clinicState || null,
        // Common area codes for the state
        phoneAreaCodes: this.getAreaCodesByState(params.clinicState)
      };
    }

    return {
      ...enrichedData,
      summary: this.generateSummary(enrichedData),
      nextSteps: this.getNextSteps(enrichedData)
    };
  }

  /**
   * Find existing patient in our database
   */
  async findExistingPatient(params) {
    const context = {
      serviceId: 'patient-enrichment-service',
      operation: 'findExistingPatient',
      practiceId: params.practiceId || 'global',
      apiKey: this.serviceToken
    };

    // Try to find by SSN first (most unique)
    if (params.ssn) {
      const ssnMatch = await SecureDataAccess.query('patients', {
        ssn: params.ssn
      }, { limit: 1 }, context);
      
      if (ssnMatch && ssnMatch.length > 0) {
        return ssnMatch[0];
      }
    }

    // Try name + DOB combination
    if (params.firstName && params.lastName && params.dateOfBirth) {
      const nameMatch = await SecureDataAccess.query('patients', {
        firstName: new RegExp(params.firstName, 'i'),
        lastName: new RegExp(params.lastName, 'i'),
        dateOfBirth: params.dateOfBirth
      }, { limit: 1 }, context);
      
      if (nameMatch && nameMatch.length > 0) {
        return nameMatch[0];
      }
    }

    return null;
  }

  /**
   * Get common area codes by state
   */
  getAreaCodesByState(state) {
    const areaCodes = {
      'CA': ['213', '310', '323', '408', '415', '510', '530', '559', '562', '619', '626', '650', '661', '707', '714', '760', '805', '818', '831', '858', '909', '916', '925', '949'],
      'NY': ['212', '315', '347', '516', '518', '585', '607', '631', '646', '716', '718', '845', '914', '917', '929'],
      'TX': ['210', '214', '254', '281', '325', '361', '409', '430', '432', '469', '512', '682', '713', '737', '806', '817', '830', '832', '903', '915', '936', '940', '956', '972', '979'],
      'FL': ['239', '305', '321', '352', '386', '407', '561', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954'],
      // Add more states as needed
    };
    
    return areaCodes[state] || [];
  }

  /**
   * Generate summary of what we found
   */
  generateSummary(data) {
    const found = [];
    const missing = data.requiresManualEntry;
    
    if (data.ssnVerified) found.push('SSN verified');
    if (data.insurance?.medicare?.mbi) found.push('Medicare MBI');
    if (data.demographics?.address) found.push('Address');
    if (data.existingPatientId) found.push('Existing patient record');
    
    return {
      found: found,
      missing: missing,
      percentComplete: Math.round((found.length / (found.length + missing.length)) * 100)
    };
  }

  /**
   * Get next steps for completing patient data
   */
  getNextSteps(data) {
    const steps = [];
    
    if (data.requiresManualEntry.length > 0) {
      steps.push({
        action: 'manual_entry',
        message: `Please enter: ${data.requiresManualEntry.join(', ')}`,
        fields: data.requiresManualEntry
      });
    }
    
    if (data.insurance?.medicare?.mbi) {
      steps.push({
        action: 'medicare_benefits',
        message: 'Medicare coverage verified - ready to check benefits'
      });
    }
    
    if (data.existingPatientId) {
      steps.push({
        action: 'update_existing',
        message: 'Update existing patient record with new information'
      });
    }
    
    return steps;
  }
}

module.exports = new PatientDataEnrichmentService();