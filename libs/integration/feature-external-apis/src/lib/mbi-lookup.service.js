/**
 * Medicare Beneficiary Identifier (MBI) Lookup Service
 * 
 * COMPLETE WORKFLOW FOR GETTING PATIENT MEDICAL DATA:
 * ====================================================
 * 
 * Step 1: SSN VERIFICATION (ssnVerificationService.js)
 * - Verify SSN is valid using SSA eCBSV API
 * - Confirms identity (name, DOB match)
 * - Does NOT provide medical data
 * 
 * Step 2: SSN TO MBI CONVERSION (this service)
 * - Convert verified SSN to Medicare Beneficiary Identifier (MBI)
 * - Options:
 *   a) Commercial services (Stedi, pVerify, ZOLL)
 *   b) Medicare Administrative Contractor (MAC) portals
 *   c) X12 270/271 eligibility transactions
 * 
 * Step 3: RETRIEVE MEDICAL DATA
 * - Use MBI with CMS Blue Button 2.0 API for Medicare data
 * - Query Health Information Exchanges (HIEs)
 * - Access insurance provider APIs
 * - Connect to hospital/practice EHR systems
 * 
 * DATA SOURCES FOR MEDICAL INFORMATION:
 * =====================================
 * 
 * 1. CMS Blue Button 2.0 API (Medicare beneficiaries only)
 *    - Claims data (Parts A, B, D)
 *    - Diagnoses and procedures
 *    - Medications (Part D)
 *    - Provider information
 * 
 * 2. Health Information Exchanges (HIEs)
 *    - Regional patient data aggregation
 *    - Cross-provider medical records
 *    - Lab results, imaging, clinical notes
 * 
 * 3. Insurance Provider APIs
 *    - Claims history
 *    - Prior authorizations
 *    - Coverage details
 * 
 * 4. Direct EHR/EMR Integration
 *    - Epic MyChart
 *    - Cerner PowerChart
 *    - Allscripts
 *    - athenahealth
 * 
 * 5. Pharmacy Benefit Managers (PBMs)
 *    - Medication history
 *    - Prescription fills
 *    - Drug interactions
 * 
 * LIMITATIONS:
 * - Only works for Medicare beneficiaries (65+ or disabled)
 * - Requires patient consent for data access
 * - Non-Medicare patients need different data sources
 * - Commercial insurance APIs vary by provider
 */

const axios = require('axios');
const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../backend/services/secureDataAccess');
const productionKMS = require('../../../../../backend/services/productionKMS');
const externalApiGateway = require('../../../../../backend/services/externalApiGatewayService');

class MBILookupService {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    this.apiKey = null;
    
    // API endpoints - Using commercial services that provide SSN-to-MBI lookup
    // CMS doesn't provide direct SSN-to-MBI API, we use Stedi or similar services
    this.endpoints = {
      // Stedi Healthcare API for MBI lookup (commercial service) - CORRECT URL!
      stediEligibility: 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3',
      
      // CMS Blue Button 2.0 Sandbox for patient data (after we have MBI)
      blueButtonSandbox: 'https://sandbox.bluebutton.cms.gov/v2/fhir',
      blueButtonProd: 'https://api.bluebutton.cms.gov/v2/fhir',
      
      // Medicare Administrative Contractor (MAC) portals for MBI lookup
      macPortals: {
        noridian: 'https://med.noridianmedicare.com/web/jddme/mbi-lookup',
        palmetto: 'https://www.palmettogba.com/mbi',
        novitas: 'https://www.novitas-solutions.com/mbi',
        firstCoast: 'https://medicare.fcso.com/mbi'
      },
      
      // BCDA API for ACO organizations (requires special access)
      bcda: 'https://api.bcda.cms.gov/api/v2',
      bcdaSandbox: 'https://sandbox.bcda.cms.gov/api/v2'
    };
    
    // Use sandbox in development
    this.useSandbox = process.env.NODE_ENV === 'development';
  }

  async initialize() {
    if (this.initialized) {
      return this;
    }
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('mbi-lookup-service');
      
      // Get API keys from KMS - we'll store these as we integrate with services
      try {
        // Stedi API key for MBI lookup service
        this.stediApiKey = await productionKMS.getInternalKey('STEDI_API_KEY');
      } catch (e) {
        console.log('Stedi API key not found, will need to be configured');
      }
      
      try {
        // Blue Button API credentials (OAuth-based)
        this.blueButtonClientId = await productionKMS.getInternalKey('BLUE_BUTTON_CLIENT_ID');
        this.blueButtonClientSecret = await productionKMS.getInternalKey('BLUE_BUTTON_CLIENT_SECRET');
      } catch (e) {
        console.log('Blue Button credentials not found, using sandbox mode');
      }
      
      this.initialized = true;
      console.log('✅ MBI Lookup Service initialized with security token');
    } catch (error) {
      console.error('Failed to initialize MBI Lookup Service:', error);
      // Service will auto-register on first run
      this.initialized = true;
    }

    return this;
  }

  /**
   * Look up patient information using SSN
   * @param {Object} params - Lookup parameters
   * @param {string} params.ssn - Social Security Number (9 digits, no dashes)
   * @param {string} params.dateOfBirth - Date of birth (YYYYMMDD format)
   * @param {string} params.firstName - Patient first name
   * @param {string} params.lastName - Patient last name
   * @returns {Object} Patient data including MBI and demographics
   */
  async lookupPatientBySSN(params) {
    await this.initialize();
    
    try {
      // Format SSN (remove any dashes or spaces)
      const formattedSSN = params.ssn.replace(/[-\s]/g, '');
      
      // Format date of birth for API
      const formattedDOB = this.formatDateForAPI(params.dateOfBirth);
      
      // Step 1: Try Stedi first (automatic SSN lookup)
      const stediService = require('../../../../../backend/services/stediHealthcareService');
      try {
        console.log('🔍 Attempting Stedi SSN lookup...');
        const stediResult = await stediService.lookupPatientBySSN({
          ssn: formattedSSN,
          firstName: params.firstName,
          lastName: params.lastName,
          dateOfBirth: params.dateOfBirth,
          clinicNpi: params.clinicNpi,
          userId: params.userId,
          practiceId: params.practiceId
        });
        
        if (stediResult.success && stediResult.mbi) {
          console.log('✅ Stedi lookup successful! Got MBI:', stediResult.mbi);
          
          // We have MBI from Stedi, now get additional data if needed
          return {
            success: true,
            source: 'stedi',
            mbi: stediResult.mbi,
            demographics: stediResult.demographics,
            insurance: stediResult.insurance,
            benefits: stediResult.benefits,
            message: 'Patient data retrieved automatically via Stedi',
            requiresPatientLogin: false
          };
        }
      } catch (stediError) {
        console.log('⚠️ Stedi lookup failed:', stediError.message);
        // Continue to fallback methods
      }
      
      // Step 2: If Stedi fails, try other methods
      const mbiResponse = await this.getMBIFromSSN({
        ssn: formattedSSN,
        dateOfBirth: formattedDOB,
        firstName: params.firstName,
        lastName: params.lastName
      });
      
      if (!mbiResponse.mbi) {
        return {
          success: false,
          message: 'No Medicare record found for this SSN'
        };
      }
      
      // Step 2: Get full patient data using MBI
      const patientData = await this.getPatientDataByMBI(mbiResponse.mbi);
      
      // Step 3: Get additional data in parallel
      const [coverage, claims, medications, providers] = await Promise.all([
        this.getMedicareCoverage(mbiResponse.mbi),
        this.getClaimsHistory(mbiResponse.mbi),
        this.getMedicationHistory(mbiResponse.mbi),
        this.getProviderHistory(mbiResponse.mbi)
      ]);
      
      // Combine all data
      const completePatientData = {
        success: true,
        mbi: mbiResponse.mbi,
        demographics: {
          firstName: patientData.firstName || params.firstName,
          lastName: patientData.lastName || params.lastName,
          middleName: patientData.middleName,
          dateOfBirth: patientData.dateOfBirth,
          gender: patientData.gender,
          ssn: formattedSSN,
          address: {
            street: patientData.address?.line1,
            street2: patientData.address?.line2,
            city: patientData.address?.city,
            state: patientData.address?.state,
            zipCode: patientData.address?.postalCode,
            country: 'USA'
          },
          phone: patientData.telecom?.find(t => t.system === 'phone')?.value,
          email: patientData.telecom?.find(t => t.system === 'email')?.value
        },
        insurance: {
          medicare: {
            mbi: mbiResponse.mbi,
            partA: coverage.partA,
            partB: coverage.partB,
            partC: coverage.partC,
            partD: coverage.partD,
            effectiveDate: coverage.effectiveDate,
            eligibilityReason: coverage.eligibilityReason
          },
          supplemental: coverage.supplemental
        },
        medicalHistory: {
          diagnoses: this.extractDiagnoses(claims),
          procedures: this.extractProcedures(claims),
          medications: medications,
          allergies: patientData.allergies || [],
          immunizations: patientData.immunizations || [],
          vitalSigns: patientData.vitalSigns || []
        },
        providers: providers,
        lastClaimDate: claims[0]?.serviceDate,
        totalClaimsCount: claims.length
      };
      
      // Log the lookup for audit
      await this.logPatientLookup(formattedSSN, mbiResponse.mbi, params.userId);
      
      return completePatientData;
      
    } catch (error) {
      console.error('Patient lookup error:', error);
      return {
        success: false,
        message: 'Failed to lookup patient data',
        error: error.message
      };
    }
  }

  /**
   * Get MBI from SSN using available services
   * Since CMS doesn't provide direct SSN-to-MBI API, we use:
   * 1. Stedi Healthcare API (commercial service)
   * 2. MAC portal integrations
   * 3. X12 270/271 eligibility transactions
   */
  async getMBIFromSSN(params) {
    // Try Stedi API first (if we have credentials)
    if (this.stediApiKey) {
      try {
        return await this.getMBIFromStedi(params);
      } catch (error) {
        console.error('Stedi MBI lookup failed:', error);
      }
    }
    
    // Try X12 270/271 eligibility check with SSN
    try {
      return await this.getMBIFromX12Eligibility(params);
    } catch (error) {
      console.error('X12 eligibility lookup failed:', error);
    }
    
    // Fallback to synthetic test data in sandbox mode
    if (this.useSandbox) {
      return this.getSyntheticMBI(params);
    }
    
    throw new Error('MBI lookup service not configured. Please configure Stedi API or other MBI lookup service.');
  }
  
  /**
   * Get MBI using Stedi Healthcare API
   */
  async getMBIFromStedi(params) {
    try {
      // Format SSN (remove dashes/spaces)
      const formattedSSN = params.ssn.replace(/[-\s]/g, '');
      
      // Format date of birth to YYYYMMDD
      let formattedDOB;
      if (typeof params.dateOfBirth === 'string' && params.dateOfBirth.length === 8 && !params.dateOfBirth.includes('-')) {
        formattedDOB = params.dateOfBirth; // Already in YYYYMMDD format
      } else {
        const dob = new Date(params.dateOfBirth);
        const year = dob.getFullYear();
        const month = String(dob.getMonth() + 1).padStart(2, '0');
        const day = String(dob.getDate()).padStart(2, '0');
        formattedDOB = `${year}${month}${day}`;
      }
      
      // Generate control number for tracking
      const controlNumber = `MBI_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Build Stedi eligibility request
      // In test mode, use approved test data
      const isTestMode = process.env.NODE_ENV === 'development';
      const request = isTestMode ? {
        // TEST MODE: Use approved Aetna test data
        controlNumber: controlNumber,
        tradingPartnerServiceId: '60054', // Aetna test partner
        provider: {
          organizationName: 'Test Provider',
          npi: '1999999984'
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
          organizationName: 'IntelliCare Health',
          npi: '1999999984'
        },
        subscriber: {
          dateOfBirth: formattedDOB,
          firstName: params.firstName.toUpperCase(),
          lastName: params.lastName.toUpperCase(),
          ssn: formattedSSN
        }
      };
      
      const response = await axios.post(
        this.endpoints.stediEligibility,
        request,
        {
          headers: {
            'Authorization': `Key ${this.stediApiKey}`, // Use 'Key' not 'Bearer'
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Extract MBI from eligibility response
      const mbi = response.data.subscriber?.memberId || 
                  response.data.subscriber?.medicareHealthInsuranceClaimNumber ||
                  response.data.dependents?.[0]?.memberId;
      
      return {
        mbi: mbi,
        source: 'stedi',
        eligibilityData: response.data
      };
    } catch (error) {
      console.error('Stedi API error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Get MBI using X12 270/271 eligibility transaction
   */
  async getMBIFromX12Eligibility(params) {
    // Build X12 270 eligibility request with SSN
    const x12Request = this.buildX12EligibilityRequest({
      ssn: params.ssn,
      dateOfBirth: params.dateOfBirth,
      firstName: params.firstName,
      lastName: params.lastName
    });
    
    try {
      // Send to CMS or MAC endpoint
      const response = await axios.post(
        `${this.endpoints.macPortals.noridian}/api/eligibility`,
        x12Request,
        {
          headers: {
            'Content-Type': 'application/x12',
            'X-API-Key': this.apiKey
          }
        }
      );
      
      // Parse X12 271 response to extract MBI
      const mbi = this.parseX12Response(response.data);
      
      return {
        mbi: mbi,
        source: 'x12',
        rawResponse: response.data
      };
    } catch (error) {
      console.error('X12 eligibility error:', error);
      throw error;
    }
  }
  
  /**
   * Get synthetic MBI for sandbox testing
   */
  getSyntheticMBI(params) {
    // CMS Blue Button sandbox synthetic beneficiaries
    const syntheticBeneficiaries = {
      '123456789': { mbi: '1S00E00AA00', name: 'Jane Doe' },
      '234567890': { mbi: '2S00E00BB00', name: 'John Smith' },
      '345678901': { mbi: '3S00E00CC00', name: 'Mary Johnson' },
      '456789012': { mbi: '4S00E00DD00', name: 'Robert Williams' }
    };
    
    const ssn = params.ssn.replace(/[-\s]/g, '');
    const synthetic = syntheticBeneficiaries[ssn];
    
    if (synthetic) {
      return {
        mbi: synthetic.mbi,
        source: 'sandbox',
        message: `Using synthetic MBI for testing (${synthetic.name})`
      };
    }
    
    // Generate a valid-format MBI for testing
    const testMBI = this.generateTestMBI(ssn);
    return {
      mbi: testMBI,
      source: 'generated',
      message: 'Generated test MBI for sandbox testing'
    };
  }
  
  /**
   * Build X12 270 eligibility request
   */
  buildX12EligibilityRequest(params) {
    // X12 270 format for eligibility inquiry with SSN
    const segments = [
      'ISA*00*          *00*          *ZZ*SENDER         *ZZ*CMS            *' + this.formatX12Date() + '*' + this.formatX12Time() + '*^*00501*000000001*0*T*:~',
      'GS*HS*SENDER*CMS*' + this.formatX12Date() + '*' + this.formatX12Time() + '*1*X*005010X279A1~',
      'ST*270*0001*005010X279A1~',
      'BHT*0022*13*' + this.generateTransactionId() + '*' + this.formatX12Date() + '*' + this.formatX12Time() + '~',
      'HL*1**20*1~',
      'NM1*PR*2*CENTERS FOR MEDICARE & MEDICAID SERVICES*****PI*CMS~',
      'HL*2*1*21*1~',
      'NM1*1P*2*INTELLICARE HEALTH*****XX*1234567890~',
      'HL*3*2*22*0~',
      'NM1*IL*1*' + params.lastName + '*' + params.firstName + '****MI*' + params.ssn + '~',
      'DMG*D8*' + this.formatDateForX12(params.dateOfBirth) + '~',
      'DTP*291*D8*' + this.formatX12Date() + '~',
      'EQ*30~', // Request for health benefit plan coverage
      'SE*13*0001~',
      'GE*1*1~',
      'IEA*1*000000001~'
    ];
    
    return segments.join('');
  }
  
  /**
   * Parse X12 271 eligibility response to extract MBI
   */
  parseX12Response(x12Data) {
    // Look for NM1 segment with MBI
    const segments = x12Data.split('~');
    for (const segment of segments) {
      if (segment.startsWith('NM1*IL')) {
        const elements = segment.split('*');
        // MBI is typically in element 9 after identifier type in element 8
        if (elements[8] === 'MI' && elements[9]) {
          return elements[9];
        }
      }
      // Also check REF segments for MBI
      if (segment.startsWith('REF*0F')) { // 0F = Medicare MBI
        const elements = segment.split('*');
        if (elements[2]) {
          return elements[2];
        }
      }
    }
    return null;
  }
  
  /**
   * Generate valid-format test MBI
   */
  generateTestMBI(seed) {
    // MBI format: [1-9][A-Z except SLOIBZ][0-9A-Z except SLOIBZ][0-9]...
    const validChars = '0123456789ACDEFGHJKMNPQRTUVWXY';
    const firstChar = '123456789'[parseInt(seed[0]) % 9];
    const letters = 'ACDEFGHJKMNPQRTUVWXY';
    const secondChar = letters[parseInt(seed[1]) % letters.length];
    
    let mbi = firstChar + secondChar;
    for (let i = 2; i < 11; i++) {
      const charIndex = parseInt(seed[i % seed.length]) + i;
      mbi += validChars[charIndex % validChars.length];
    }
    
    return mbi;
  }

  /**
   * Get patient data using MBI from Blue Button API
   */
  async getPatientDataByMBI(mbi) {
    try {
      // Use sandbox or production endpoint
      const endpoint = this.useSandbox ? 
        this.endpoints.blueButtonSandbox : 
        this.endpoints.blueButtonProd;
      
      // Blue Button uses OAuth 2.0, need to get access token first
      const accessToken = await this.getBlueButtonAccessToken();
      
      const response = await axios.get(
        `${endpoint}/Patient`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          },
          params: {
            identifier: mbi
          }
        }
      );
      
      const patient = response.data.entry?.[0]?.resource;
      if (!patient) return {};
      
      return {
        firstName: patient.name?.[0]?.given?.[0],
        lastName: patient.name?.[0]?.family,
        middleName: patient.name?.[0]?.given?.[1],
        dateOfBirth: patient.birthDate,
        gender: patient.gender,
        address: patient.address?.[0],
        telecom: patient.telecom,
        maritalStatus: patient.maritalStatus?.coding?.[0]?.display,
        race: patient.extension?.find(e => e.url.includes('race'))?.valueCodeableConcept?.coding?.[0]?.display,
        ethnicity: patient.extension?.find(e => e.url.includes('ethnicity'))?.valueCodeableConcept?.coding?.[0]?.display
      };
    } catch (error) {
      console.error('Patient data retrieval failed:', error);
      return {};
    }
  }

  /**
   * Get Medicare coverage information
   */
  async getMedicareCoverage(mbi) {
    try {
      const endpoint = this.useSandbox ? 
        this.endpoints.blueButtonSandbox : 
        this.endpoints.blueButtonProd;
      
      const accessToken = await this.getBlueButtonAccessToken();
      
      // Get Coverage resource from Blue Button API
      const response = await axios.get(
        `${endpoint}/Coverage`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          },
          params: {
            beneficiary: mbi
          }
        }
      );
      
      return {
        partA: response.data.partA,
        partB: response.data.partB,
        partC: response.data.partC,
        partD: response.data.partD,
        effectiveDate: response.data.effectiveDate,
        eligibilityReason: response.data.eligibilityReason,
        supplemental: response.data.supplementalPlans || []
      };
    } catch (error) {
      console.error('Coverage retrieval failed:', error);
      return {};
    }
  }

  /**
   * Get claims history
   */
  async getClaimsHistory(mbi, limit = 100) {
    try {
      const endpoint = this.useSandbox ? 
        this.endpoints.blueButtonSandbox : 
        this.endpoints.blueButtonProd;
      
      const accessToken = await this.getBlueButtonAccessToken();
      
      // Get ExplanationOfBenefit resources from Blue Button API
      const response = await axios.get(
        `${endpoint}/ExplanationOfBenefit`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          },
          params: {
            patient: mbi,
            _count: limit,
            _sort: '-created'
          }
        }
      );
      
      return response.data.claims || [];
    } catch (error) {
      console.error('Claims history retrieval failed:', error);
      return [];
    }
  }

  /**
   * Get medication history (Part D)
   */
  async getMedicationHistory(mbi) {
    try {
      const endpoint = this.useSandbox ? 
        this.endpoints.blueButtonSandbox : 
        this.endpoints.blueButtonProd;
      
      const accessToken = await this.getBlueButtonAccessToken();
      
      // Get MedicationRequest resources from Blue Button API
      const response = await axios.get(
        `${endpoint}/MedicationRequest`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          },
          params: {
            patient: mbi,
            status: 'active'
          }
        }
      );
      
      return response.data.medications?.map(med => ({
        name: med.medicationName,
        genericName: med.genericName,
        dosage: med.dosage,
        frequency: med.frequency,
        prescribedDate: med.prescribedDate,
        prescriber: med.prescriberName,
        prescriberNPI: med.prescriberNPI,
        daysSupply: med.daysSupply,
        refillsRemaining: med.refillsRemaining,
        ndcCode: med.ndcCode,
        rxNumber: med.rxNumber
      })) || [];
    } catch (error) {
      console.error('Medication history retrieval failed:', error);
      return [];
    }
  }

  /**
   * Get provider history
   */
  async getProviderHistory(mbi) {
    try {
      const endpoint = this.useSandbox ? 
        this.endpoints.blueButtonSandbox : 
        this.endpoints.blueButtonProd;
      
      const accessToken = await this.getBlueButtonAccessToken();
      
      const response = await axios.get(
        `${endpoint}/Practitioner`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          },
          params: {
            patient: mbi
          }
        }
      );
      
      const providers = response.data.entry?.map(entry => ({
        name: entry.resource.name?.[0]?.text,
        npi: entry.resource.identifier?.find(id => id.system?.includes('npi'))?.value,
        specialty: entry.resource.qualification?.[0]?.code?.text,
        phone: entry.resource.telecom?.find(t => t.system === 'phone')?.value,
        address: entry.resource.address?.[0]
      })) || [];
      
      return providers;
    } catch (error) {
      console.error('Provider history retrieval failed:', error);
      return [];
    }
  }

  /**
   * Extract diagnoses from claims
   */
  extractDiagnoses(claims) {
    const diagnoses = new Map();
    
    claims.forEach(claim => {
      claim.diagnosis?.forEach(diag => {
        if (!diagnoses.has(diag.code)) {
          diagnoses.set(diag.code, {
            code: diag.code,
            description: diag.description,
            firstDiagnosed: claim.serviceDate,
            occurrences: 1
          });
        } else {
          const existing = diagnoses.get(diag.code);
          existing.occurrences++;
          if (claim.serviceDate < existing.firstDiagnosed) {
            existing.firstDiagnosed = claim.serviceDate;
          }
        }
      });
    });
    
    return Array.from(diagnoses.values()).sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Extract procedures from claims
   */
  extractProcedures(claims) {
    const procedures = [];
    
    claims.forEach(claim => {
      claim.procedures?.forEach(proc => {
        procedures.push({
          code: proc.code,
          description: proc.description,
          date: claim.serviceDate,
          provider: claim.providerName,
          facility: claim.facilityName
        });
      });
    });
    
    return procedures.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Get Blue Button OAuth access token
   */
  async getBlueButtonAccessToken() {
    // In sandbox mode, use test token
    if (this.useSandbox) {
      return 'sandbox-test-token';
    }
    
    // In production, implement OAuth 2.0 flow
    if (!this.blueButtonClientId || !this.blueButtonClientSecret) {
      throw new Error('Blue Button OAuth credentials not configured');
    }
    
    try {
      const response = await axios.post(
        'https://api.bluebutton.cms.gov/v2/o/token/',
        {
          grant_type: 'client_credentials',
          client_id: this.blueButtonClientId,
          client_secret: this.blueButtonClientSecret
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data.access_token;
    } catch (error) {
      console.error('Failed to get Blue Button access token:', error);
      throw error;
    }
  }
  
  /**
   * Format date for API (YYYYMMDD)
   */
  formatDateForAPI(date) {
    if (typeof date === 'string' && date.length === 8) {
      return date; // Already in YYYYMMDD format
    }
    
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  /**
   * Format date for X12 transactions (YYYYMMDD)
   */
  formatDateForX12(date) {
    if (typeof date === 'string' && date.length === 8) {
      return date;
    }
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  /**
   * Format current date for X12 header
   */
  formatX12Date() {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  /**
   * Format current time for X12 header
   */
  formatX12Time() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}${minutes}`;
  }
  
  /**
   * Generate unique transaction ID for X12
   */
  generateTransactionId() {
    return Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 7).toUpperCase();
  }
  
  /**
   * DEPRECATED: Old mock functions removed
   * The service now uses real APIs:
   * - Stedi Healthcare API for MBI lookup
   * - CMS Blue Button 2.0 API for patient data
   * - X12 270/271 eligibility transactions
   * 
   * For testing in sandbox mode:
   * - Synthetic MBIs are generated for unknown SSNs
   * - Blue Button sandbox provides test data
   * - No hardcoded patient data
   */
  
  // Removed getMockPatientData_OLD function with all the static test data
  
  /**
   * Log patient lookup for audit
   */
  async logPatientLookup(ssn, mbi, userId) {
    try {
      const context = {
        serviceId: 'mbi-lookup-service',
        operation: 'patientLookup',
        practiceId: 'global',
        apiKey: this.serviceToken
      };
      
      await SecureDataAccess.insert('audit_logs', {
        action: 'PATIENT_SSN_LOOKUP',
        userId: userId,
        timestamp: new Date(),
        metadata: {
          ssnLast4: ssn.slice(-4),
          mbi: mbi,
          success: true
        }
      }, context);
    } catch (error) {
      console.error('Failed to log patient lookup:', error);
    }
  }
}

// Export singleton instance for backward compatibility
module.exports = new MBILookupService();