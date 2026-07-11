/**
 * Stedi Healthcare API Service
 * 
 * Provides SSN to MBI lookup and eligibility verification
 * This allows automatic patient data retrieval WITHOUT patient login!
 * 
 * Workflow:
 * 1. Enter SSN + DOB + Name
 * 2. Stedi performs MBI lookup
 * 3. Returns patient demographics and Medicare coverage
 * 4. No patient login required!
 * 
 * Pricing: ~$0.30 per eligibility check
 * 
 * Sign up at: https://www.stedi.com/
 */

const axios = require('axios');
const serviceAccountManager = require('../../../../backend/services/serviceAccountManager');
const productionKMS = require('../../../../backend/services/productionKMS');
const SecureDataAccess = require('../../../../backend/services/secureDataAccess');

class StediHealthcareService {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    
    // Stedi API endpoints - CORRECT URLs!
    this.endpoints = {
      eligibility: 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3',
      eligibilityRawX12: 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3/raw-x12',
      testEligibility: 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3' // Test uses same endpoint with test key
    };
    
    // Use test endpoint in development
    this.useTestMode = process.env.NODE_ENV === 'development';
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('stedi-healthcare-service');
      
      // Get Stedi API key from KMS
      try {
        this.stediApiKey = await productionKMS.getInternalKey('STEDI_API_KEY');
        console.log('✅ Stedi API key loaded from KMS');
      } catch (e) {
        console.log('⚠️ Stedi API key not found in KMS. Please add it:');
        console.log('   cd backend && node -e "const kms = require(\'./services/productionKMS\'); kms.storeInternalKey(\'STEDI_API_KEY\', \'YOUR_STEDI_KEY\')"');
      }
      
      this.initialized = true;
      console.log('✅ Stedi Healthcare Service initialized');
    } catch (error) {
      console.error('Failed to initialize Stedi Healthcare Service:', error);
      this.initialized = true;
    }
  }

  /**
   * Get service context for database operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'stedi-healthcare-service',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  /**
   * Perform SSN to MBI lookup and get patient data
   * This is the MAGIC function - gets Medicare data with just SSN!
   * 
   * IMPORTANT: Requires PRODUCTION Stedi API key for real SSN lookups!
   * Test API keys can only use pre-defined test data (John Doe, etc.)
   * 
   * @param {Object} params
   * @param {string} params.ssn - Social Security Number (9 digits)
   * @param {string} params.firstName - Patient first name
   * @param {string} params.lastName - Patient last name
   * @param {string} params.dateOfBirth - Date of birth (YYYY-MM-DD)
   * @param {string} params.clinicNpi - Your practice's NPI number
   * @returns {Object} Patient demographics, MBI, and coverage
   */
  async lookupPatientBySSN(params) {
    await this.initialize();
    
    if (!this.stediApiKey) {
      throw new Error('Stedi API key not configured. Please add STEDI_API_KEY to KMS.');
    }
    
    try {
      // Format SSN (remove dashes/spaces)
      const formattedSSN = params.ssn.replace(/[-\s]/g, '');
      
      // Format date of birth to YYYYMMDD
      const formattedDOB = this.formatDateForStedi(params.dateOfBirth);
      
      // Generate control number for tracking
      const controlNumber = `MBI_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Build Stedi eligibility request
      // In test mode, use approved test data format
      // In production, use MBI lookup with SSN
      const request = this.useTestMode ? {
        // TEST MODE: Use approved test data
        controlNumber: controlNumber,
        tradingPartnerServiceId: '60054', // Aetna test partner
        provider: {
          organizationName: 'Test Provider',
          npi: params.clinicNpi || '1999999984'
        },
        subscriber: {
          firstName: 'John',
          lastName: 'Doe',
          memberId: 'AETNA9wcSu'
        },
        encounter: {
          serviceTypeCodes: ['30']
        }
      } : {
        // PRODUCTION MODE: Real MBI lookup
        controlNumber: controlNumber,
        tradingPartnerServiceId: 'MBILU', // Medicare MBI lookup
        externalPatientId: `PAT_${formattedSSN.slice(-4)}`,
        encounter: {
          serviceTypeCodes: ['30']
        },
        provider: {
          organizationName: params.practiceName || 'IntelliCare Health',
          npi: params.clinicNpi || '1999999984'
        },
        subscriber: {
          dateOfBirth: formattedDOB,
          firstName: params.firstName.toUpperCase(),
          lastName: params.lastName.toUpperCase(),
          ssn: formattedSSN // Real SSN for production
        }
      };
      
      // Use test or production endpoint
      const endpoint = this.useTestMode ? 
        this.endpoints.testEligibility : 
        this.endpoints.eligibility;
      
      console.log(`📡 Calling Stedi API for SSN lookup: ${params.ssn.slice(-4)}`);
      
      // Call Stedi API
      const response = await axios.post(
        endpoint,
        request,
        {
          headers: {
            'Authorization': `Key ${this.stediApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Parse Stedi response
      const eligibilityData = response.data;
      
      // Extract MBI from response
      const mbi = this.extractMBI(eligibilityData);
      
      // Format response for our system
      const result = {
        success: true,
        source: 'stedi',
        mbi: mbi,
        demographics: {
          firstName: eligibilityData.subscriber?.firstName || params.firstName,
          lastName: eligibilityData.subscriber?.lastName || params.lastName,
          middleName: eligibilityData.subscriber?.middleName,
          dateOfBirth: eligibilityData.subscriber?.dateOfBirth,
          gender: eligibilityData.subscriber?.gender,
          ssn: formattedSSN,
          
          // Address from eligibility response
          address: eligibilityData.subscriber?.address ? {
            street: eligibilityData.subscriber.address.address1,
            street2: eligibilityData.subscriber.address.address2,
            city: eligibilityData.subscriber.address.city,
            state: eligibilityData.subscriber.address.state,
            zipCode: eligibilityData.subscriber.address.postalCode,
            country: 'USA'
          } : null
        },
        
        // Insurance coverage details
        insurance: {
          medicare: {
            mbi: mbi,
            memberNumber: eligibilityData.subscriber?.memberId,
            groupNumber: eligibilityData.subscriber?.groupNumber,
            planName: eligibilityData.planInformation?.name,
            planType: eligibilityData.planInformation?.type,
            
            // Coverage status
            partA: this.hasCoverage(eligibilityData, 'Part A'),
            partB: this.hasCoverage(eligibilityData, 'Part B'),
            partC: this.hasCoverage(eligibilityData, 'Part C'),
            partD: this.hasCoverage(eligibilityData, 'Part D'),
            
            // Dates
            effectiveDate: eligibilityData.benefitsInformation?.[0]?.effectiveDate,
            eligibilityBeginDate: eligibilityData.benefitsInformation?.[0]?.eligibilityBeginDate
          }
        },
        
        // Benefits information
        benefits: this.extractBenefits(eligibilityData),
        
        // Raw response for debugging
        rawResponse: this.useTestMode ? eligibilityData : null
      };
      
      // Log successful lookup for audit
      await this.logLookup(params, result);
      
      console.log(`✅ Stedi SSN lookup successful! Found MBI: ${mbi}`);
      
      return result;
      
    } catch (error) {
      console.error('Stedi API error:', error.response?.data || error.message);
      
      // Check if it's a test mode issue
      if (error.response?.status === 401) {
        throw new Error('Stedi API key invalid or not configured. Please check STEDI_API_KEY in KMS.');
      }
      
      // Check if patient not found
      if (error.response?.status === 404 || error.response?.data?.errors?.[0]?.code === 'NO_MATCH') {
        return {
          success: false,
          message: 'No Medicare record found for this SSN',
          needsPatientLogin: true
        };
      }
      
      throw error;
    }
  }

  /**
   * Extract MBI from Stedi response
   */
  extractMBI(eligibilityData) {
    // MBI can be in different places in the response
    return eligibilityData.subscriber?.memberId || 
           eligibilityData.subscriber?.medicareHealthInsuranceClaimNumber ||
           eligibilityData.dependents?.[0]?.memberId ||
           null;
  }

  /**
   * Check if specific Medicare part has coverage
   */
  hasCoverage(eligibilityData, partName) {
    const benefits = eligibilityData.benefitsInformation || [];
    return benefits.some(benefit => 
      benefit.name?.includes(partName) || 
      benefit.code === partName ||
      benefit.coverageLevelCode === partName
    );
  }

  /**
   * Extract benefits information
   */
  extractBenefits(eligibilityData) {
    const benefits = eligibilityData.benefitsInformation || [];
    
    return benefits.map(benefit => ({
      name: benefit.name,
      code: benefit.code,
      coverageLevel: benefit.coverageLevelCode,
      serviceTypeCodes: benefit.serviceTypeCodes,
      inNetworkCoverage: benefit.inNetworkCoverage,
      outOfNetworkCoverage: benefit.outOfNetworkCoverage,
      copayment: benefit.copayment,
      coinsurance: benefit.coinsurance,
      deductible: benefit.deductible,
      outOfPocketMaximum: benefit.outOfPocketMaximum,
      effectiveDate: benefit.effectiveDate,
      terminationDate: benefit.terminationDate
    }));
  }

  /**
   * Format date for Stedi API (YYYYMMDD)
   */
  formatDateForStedi(date) {
    if (typeof date === 'string' && date.length === 8 && !date.includes('-')) {
      return date; // Already in YYYYMMDD format
    }
    
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  /**
   * Log lookup for audit compliance
   */
  async logLookup(params, result) {
    try {
      const context = this.getServiceContext(params.practiceId || 'global');
      
      await SecureDataAccess.create('audit_logs', {
        action: 'STEDI_SSN_LOOKUP',
        userId: params.userId,
        timestamp: new Date(),
        metadata: {
          ssnLast4: params.ssn.slice(-4),
          success: result.success,
          mbiFound: !!result.mbi,
          source: 'stedi'
        }
      }, context);
    } catch (error) {
      console.error('Failed to log Stedi lookup:', error);
    }
  }

  /**
   * Get Stedi test credentials for sandbox
   * Using Stedi-approved test values from documentation
   */
  getTestCredentials() {
    return {
      // For testing, we use member ID instead of SSN
      memberId: 'AETNA9wcSu',  // Approved test member ID
      firstName: 'John',        // Approved test first name
      lastName: 'Doe',          // Approved test last name
      dateOfBirth: '1970-01-01',
      tradingPartnerServiceId: '60054', // Aetna test partner
      note: 'Use Aetna test partner (60054) with member ID for testing',
      
      // Alternative test credentials for different payers
      alternativeTests: {
        anthem: {
          tradingPartnerServiceId: '62135',
          memberId: 'ANTHEM123',
          firstName: 'Jane',
          lastName: 'Smith'
        },
        cigna: {
          tradingPartnerServiceId: '62288',
          memberId: 'CIGNA456',
          firstName: 'Robert',
          lastName: 'Johnson'
        }
      }
    };
  }
}

module.exports = new StediHealthcareService();