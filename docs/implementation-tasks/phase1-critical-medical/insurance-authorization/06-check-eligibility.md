# Check Eligibility

## Function Details
- **Name**: checkEligibility
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 3 hours

## Problem Description
Healthcare providers must verify patient insurance eligibility before providing services to ensure coverage is active, determine patient responsibility, and prevent claim denials. The system needs to perform real-time eligibility verification, handle multiple insurance plans, and provide comprehensive benefit information.

## Implementation Steps

### 1. Create Eligibility Verification Service
```javascript
// backend/services/eligibilityVerificationService.js

const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const axios = require('axios');

class EligibilityVerificationService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('eligibility-verification-service');
    this.eligibilityProviders = await this.loadEligibilityProviders();
    this.benefitMappings = await this.loadBenefitMappings();
  }

  async checkEligibility(patientId, serviceDate, options = {}, context) {
    const {
      serviceTypeCode = '30', // Default to professional services
      providerNPI = null,
      includeCoordinationOfBenefits = true,
      includeDeductibles = true,
      includeOutOfPocket = true,
      includeCopayments = true,
      includeCoinsurance = true,
      includePriorAuthorization = true,
      includeReferralRequired = true,
      urgentCheck = false
    } = options;

    // Get patient information
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Get all active insurance plans for the patient
    const insurancePlans = await this.getActiveInsurancePlans(patientId, serviceDate, context);
    if (insurancePlans.length === 0) {
      return {
        success: false,
        eligible: false,
        message: 'No active insurance coverage found',
        patient: {
          id: patientId,
          name: `${patient.firstName} ${patient.lastName}`,
          dateOfBirth: patient.dateOfBirth
        },
        verificationDate: new Date(),
        selfPay: true
      };
    }

    // Check cache for recent verifications
    const cacheKey = this.generateEligibilityCacheKey(patientId, serviceDate, serviceTypeCode);
    const cachedResult = await this.getCachedEligibility(cacheKey, urgentCheck);
    
    if (cachedResult) {
      await this.logEligibilityCheck(patientId, 'CACHED', cachedResult, context);
      return cachedResult;
    }

    // Perform eligibility checks for all plans
    const eligibilityResults = [];
    
    for (const plan of insurancePlans) {
      try {
        const result = await this.verifyPlanEligibility(
          patient,
          plan,
          serviceDate,
          serviceTypeCode,
          providerNPI,
          options
        );
        eligibilityResults.push({ plan, result });
      } catch (error) {
        console.warn(`Eligibility check failed for plan ${plan.planId}:`, error.message);
        eligibilityResults.push({
          plan,
          result: {
            eligible: null,
            error: error.message,
            fallback: true
          }
        });
      }
    }

    // Process and consolidate results
    const consolidatedResult = await this.consolidateEligibilityResults(
      patient,
      eligibilityResults,
      serviceDate,
      options
    );

    // Cache the result
    await this.cacheEligibilityResult(cacheKey, consolidatedResult);

    // Store verification record
    await this.storeEligibilityVerification({
      patientId,
      serviceDate,
      serviceTypeCode,
      result: consolidatedResult,
      verifiedBy: context.userId,
      practiceId: context.practiceId
    }, context);

    // Create audit log
    await AuditLog.create({
      action: 'CHECK_ELIGIBILITY',
      userId: context.userId,
      patientId,
      practiceId: context.practiceId,
      details: {
        serviceDate,
        serviceTypeCode,
        plansChecked: eligibilityResults.length,
        primaryEligible: consolidatedResult.primaryPlan?.eligible,
        secondaryEligible: consolidatedResult.secondaryPlan?.eligible
      },
      timestamp: new Date()
    });

    return consolidatedResult;
  }

  async getActiveInsurancePlans(patientId, serviceDate, context) {
    const query = {
      patientId,
      practiceId: context.practiceId,
      active: true,
      $or: [
        { 
          effectiveDate: { $lte: serviceDate }, 
          terminationDate: { $gte: serviceDate } 
        },
        { 
          effectiveDate: { $lte: serviceDate }, 
          terminationDate: null 
        }
      ]
    };

    return await SecureDataAccess.query('patientinsurance', query, {
      sort: { priority: 1 } // Primary first
    }, context);
  }

  async verifyPlanEligibility(patient, plan, serviceDate, serviceTypeCode, providerNPI, options) {
    const provider = this.eligibilityProviders[plan.payerId];
    if (!provider) {
      throw new Error(`Eligibility provider not configured for ${plan.company}`);
    }

    // Build eligibility request
    const eligibilityRequest = {
      // Transaction info
      transactionId: this.generateTransactionId(),
      submitterId: provider.submitterId,
      receiverId: plan.payerId,
      
      // Patient demographics
      subscriber: {
        memberId: plan.memberId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        relationshipCode: plan.relationshipCode || '18' // Self
      },
      
      // Dependent info if applicable
      dependent: plan.relationshipCode !== '18' ? {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender
      } : null,
      
      // Service info
      serviceDate: serviceDate,
      serviceTypeCode: serviceTypeCode,
      
      // Provider info
      provider: {
        npi: providerNPI,
        taxonomyCode: provider.taxonomyCode
      },
      
      // Information requested
      informationRequested: this.buildInformationRequested(options)
    };

    // Send eligibility request
    let response;
    switch (provider.type) {
      case 'x12-270':
        response = await this.sendX12EligibilityRequest(eligibilityRequest, provider);
        break;
      case 'rest-api':
        response = await this.sendRESTEligibilityRequest(eligibilityRequest, provider);
        break;
      case 'clearinghouse':
        response = await this.sendClearinghouseEligibilityRequest(eligibilityRequest, provider);
        break;
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }

    return this.parseEligibilityResponse(response, provider.type, plan);
  }

  buildInformationRequested(options) {
    const infoRequested = ['30']; // Always request general eligibility
    
    if (options.includeDeductibles) infoRequested.push('1'); // Deductible
    if (options.includeOutOfPocket) infoRequested.push('G'); // Out of pocket
    if (options.includeCopayments) infoRequested.push('B'); // Copayment
    if (options.includeCoinsurance) infoRequested.push('A'); // Coinsurance
    if (options.includePriorAuthorization) infoRequested.push('41'); // Prior authorization
    if (options.includeReferralRequired) infoRequested.push('42'); // Referral
    
    return infoRequested;
  }

  async sendX12EligibilityRequest(request, provider) {
    // Generate X12 270 transaction
    const x12Message = this.generateX12_270(request, provider);
    
    const response = await axios.post(provider.endpoint, x12Message, {
      headers: {
        'Content-Type': 'application/x12',
        'Authorization': `Bearer ${provider.apiKey}`,
        'X-Partner-ID': provider.partnerId
      },
      timeout: 30000
    });

    return {
      type: 'x12-271',
      data: response.data,
      transactionId: request.transactionId
    };
  }

  async sendRESTEligibilityRequest(request, provider) {
    const requestData = {
      subscriber: request.subscriber,
      dependent: request.dependent,
      serviceDate: request.serviceDate,
      serviceTypeCode: request.serviceTypeCode,
      provider: request.provider,
      informationRequested: request.informationRequested
    };

    const response = await axios.post(`${provider.endpoint}/eligibility`, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'X-Client-ID': provider.clientId
      },
      timeout: 30000
    });

    return {
      type: 'rest-json',
      data: response.data,
      transactionId: request.transactionId
    };
  }

  async sendClearinghouseEligibilityRequest(request, provider) {
    const response = await axios.post(provider.endpoint, request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'X-Clearinghouse-ID': provider.clearinghouseId
      },
      timeout: 45000
    });

    return {
      type: 'clearinghouse',
      data: response.data,
      transactionId: request.transactionId
    };
  }

  parseEligibilityResponse(response, type, plan) {
    switch (type) {
      case 'x12-271':
        return this.parseX12_271Response(response.data, plan);
      case 'rest-json':
        return this.parseRESTEligibilityResponse(response.data, plan);
      case 'clearinghouse':
        return this.parseClearinghouseEligibilityResponse(response.data, plan);
      default:
        throw new Error(`Unknown response type: ${type}`);
    }
  }

  parseX12_271Response(x12Data, plan) {
    const segments = x12Data.split('~');
    const result = {
      eligible: false,
      active: false,
      plan: {
        id: plan._id,
        company: plan.company,
        planName: null,
        planType: null,
        groupNumber: plan.groupNumber,
        memberId: plan.memberId,
        priority: plan.priority
      },
      coverage: {
        effectiveDate: null,
        terminationDate: null,
        networkStatus: 'unknown'
      },
      benefits: {
        deductible: null,
        outOfPocket: null,
        copayment: null,
        coinsurance: null
      },
      requirements: {
        priorAuthRequired: false,
        referralRequired: false,
        pcpRequired: false
      },
      messages: [],
      rawResponse: x12Data
    };

    let currentEB = null;

    segments.forEach(segment => {
      const elements = segment.split('*');
      
      switch (elements[0]) {
        case 'EB': // Eligibility/Benefit Information
          currentEB = {
            informationCode: elements[1],
            coverageLevel: elements[2],
            serviceType: elements[3],
            planCoverage: elements[4]
          };
          
          if (elements[1] === '1') { // Active coverage
            result.eligible = true;
            result.active = true;
          }
          
          if (elements[3]) {
            result.plan.planType = this.mapX12ServiceType(elements[3]);
          }
          break;
        
        case 'DTP': // Date/Time Period
          if (currentEB) {
            if (elements[1] === '346') { // Plan Begin Date
              result.coverage.effectiveDate = this.parseX12Date(elements[3]);
            } else if (elements[1] === '347') { // Plan End Date
              result.coverage.terminationDate = this.parseX12Date(elements[3]);
            }
          }
          break;
        
        case 'AMT': // Monetary Amount
          if (currentEB && elements[1]) {
            const amount = parseFloat(elements[2]);
            switch (elements[1]) {
              case 'R': // Deductible
                result.benefits.deductible = { 
                  amount, 
                  type: 'individual',
                  period: 'calendar-year'
                };
                break;
              case 'T': // Out of pocket
                result.benefits.outOfPocket = { 
                  amount, 
                  type: 'individual',
                  period: 'calendar-year'
                };
                break;
              case 'B6': // Copayment
                result.benefits.copayment = { 
                  amount, 
                  serviceType: currentEB.serviceType
                };
                break;
            }
          }
          break;
        
        case 'PCT': // Percentage
          if (currentEB && elements[1] && elements[2]) {
            const percentage = parseFloat(elements[2]);
            if (elements[1] === 'CO') { // Coinsurance
              result.benefits.coinsurance = { 
                percentage, 
                serviceType: currentEB.serviceType
              };
            }
          }
          break;
        
        case 'REF': // Reference Information
          if (elements[1] === '1L') { // Group number
            result.plan.groupNumber = elements[2];
          } else if (elements[1] === 'SY') { // Plan coverage description
            result.plan.planName = elements[2];
          }
          break;
        
        case 'MSG': // Message Text
          result.messages.push(elements[1]);
          
          // Check for special requirements
          const msg = elements[1].toUpperCase();
          if (msg.includes('PRIOR AUTH')) {
            result.requirements.priorAuthRequired = true;
          }
          if (msg.includes('REFERRAL')) {
            result.requirements.referralRequired = true;
          }
          if (msg.includes('PCP')) {
            result.requirements.pcpRequired = true;
          }
          break;
        
        case 'III': // Information
          if (elements[1] === 'ZZ' && elements[2]) {
            // Network status information
            if (elements[2].includes('IN NETWORK')) {
              result.coverage.networkStatus = 'in-network';
            } else if (elements[2].includes('OUT OF NETWORK')) {
              result.coverage.networkStatus = 'out-of-network';
            }
          }
          break;
      }
    });

    return result;
  }

  parseRESTEligibilityResponse(data, plan) {
    return {
      eligible: data.eligible || false,
      active: data.active || false,
      plan: {
        id: plan._id,
        company: plan.company,
        planName: data.plan?.name || plan.planName,
        planType: data.plan?.type,
        groupNumber: data.groupNumber || plan.groupNumber,
        memberId: data.memberId || plan.memberId,
        priority: plan.priority
      },
      coverage: {
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
        networkStatus: data.networkStatus || 'unknown'
      },
      benefits: {
        deductible: data.benefits?.deductible,
        outOfPocket: data.benefits?.outOfPocket,
        copayment: data.benefits?.copayment,
        coinsurance: data.benefits?.coinsurance
      },
      requirements: {
        priorAuthRequired: data.requirements?.priorAuthRequired || false,
        referralRequired: data.requirements?.referralRequired || false,
        pcpRequired: data.requirements?.pcpRequired || false
      },
      messages: data.messages || [],
      rawResponse: data
    };
  }

  parseClearinghouseEligibilityResponse(data, plan) {
    // Parse clearinghouse response format
    return {
      eligible: data.eligibility?.active || false,
      active: data.eligibility?.active || false,
      plan: {
        id: plan._id,
        company: plan.company,
        planName: data.plan?.description,
        planType: data.plan?.type,
        groupNumber: data.subscriber?.groupNumber,
        memberId: data.subscriber?.memberId,
        priority: plan.priority
      },
      coverage: {
        effectiveDate: data.coverage?.effectiveDate ? new Date(data.coverage.effectiveDate) : null,
        terminationDate: data.coverage?.terminationDate ? new Date(data.coverage.terminationDate) : null,
        networkStatus: data.provider?.networkStatus || 'unknown'
      },
      benefits: data.benefits || {},
      requirements: data.requirements || {},
      messages: data.messages || [],
      rawResponse: data
    };
  }

  async consolidateEligibilityResults(patient, eligibilityResults, serviceDate, options) {
    const result = {
      success: true,
      eligible: false,
      patient: {
        id: patient._id,
        name: `${patient.firstName} ${patient.lastName}`,
        dateOfBirth: patient.dateOfBirth
      },
      verificationDate: new Date(),
      primaryPlan: null,
      secondaryPlan: null,
      coordinationOfBenefits: null,
      patientResponsibility: null,
      alerts: [],
      messages: []
    };

    // Separate primary and secondary plans
    const primaryResults = eligibilityResults.filter(r => r.plan.priority === 1);
    const secondaryResults = eligibilityResults.filter(r => r.plan.priority === 2);

    // Process primary plan
    if (primaryResults.length > 0) {
      const primaryResult = primaryResults[0];
      result.primaryPlan = primaryResult.result;
      result.eligible = result.primaryPlan.eligible;
      
      if (result.primaryPlan.error) {
        result.alerts.push({
          type: 'primary-plan-error',
          severity: 'high',
          message: 'Primary insurance eligibility check failed',
          details: result.primaryPlan.error
        });
      }
    }

    // Process secondary plan
    if (secondaryResults.length > 0 && options.includeCoordinationOfBenefits) {
      const secondaryResult = secondaryResults[0];
      result.secondaryPlan = secondaryResult.result;
      
      if (result.secondaryPlan.eligible) {
        result.coordinationOfBenefits = await this.calculateCoordinationOfBenefits(
          result.primaryPlan,
          result.secondaryPlan,
          serviceDate
        );
      }
    }

    // Calculate patient responsibility
    if (result.eligible) {
      result.patientResponsibility = this.calculatePatientResponsibility(
        result.primaryPlan,
        result.secondaryPlan,
        result.coordinationOfBenefits
      );
    }

    // Add alerts for important findings
    await this.addEligibilityAlerts(result);

    return result;
  }

  async calculateCoordinationOfBenefits(primaryPlan, secondaryPlan, serviceDate) {
    // Calculate coordination of benefits between plans
    return {
      primaryPayerRule: 'primary-pays-first',
      secondaryPayerRule: 'secondary-pays-remainder',
      totalCoverage: 'calculated-based-on-benefits',
      notes: 'COB calculation based on plan benefits and industry standards'
    };
  }

  calculatePatientResponsibility(primaryPlan, secondaryPlan = null, cob = null) {
    const responsibility = {
      estimatedCopay: 0,
      estimatedCoinsurance: 0,
      estimatedDeductible: 0,
      totalEstimatedResponsibility: 0,
      deductibleMet: false,
      outOfPocketMet: false
    };

    // Calculate based on primary plan benefits
    if (primaryPlan.benefits) {
      if (primaryPlan.benefits.copayment) {
        responsibility.estimatedCopay = primaryPlan.benefits.copayment.amount || 0;
      }
      
      if (primaryPlan.benefits.coinsurance) {
        responsibility.coinsurancePercentage = primaryPlan.benefits.coinsurance.percentage || 0;
      }
      
      if (primaryPlan.benefits.deductible && !responsibility.deductibleMet) {
        responsibility.estimatedDeductible = primaryPlan.benefits.deductible.amount || 0;
      }
    }

    // Adjust for secondary coverage if applicable
    if (secondaryPlan && cob) {
      // Secondary plan may cover copay or coinsurance
      // Implementation would depend on specific COB rules
    }

    responsibility.totalEstimatedResponsibility = 
      responsibility.estimatedCopay + 
      responsibility.estimatedCoinsurance + 
      responsibility.estimatedDeductible;

    return responsibility;
  }

  async addEligibilityAlerts(result) {
    // Check for coverage termination
    if (result.primaryPlan && result.primaryPlan.coverage.terminationDate) {
      const daysUntilTermination = Math.ceil(
        (new Date(result.primaryPlan.coverage.terminationDate) - new Date()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilTermination <= 30) {
        result.alerts.push({
          type: 'coverage-terminating',
          severity: daysUntilTermination <= 7 ? 'high' : 'medium',
          message: `Primary coverage terminates in ${daysUntilTermination} days`,
          terminationDate: result.primaryPlan.coverage.terminationDate
        });
      }
    }

    // Check for network status
    if (result.primaryPlan && result.primaryPlan.coverage.networkStatus === 'out-of-network') {
      result.alerts.push({
        type: 'out-of-network',
        severity: 'medium',
        message: 'Provider is out-of-network - higher patient costs may apply'
      });
    }

    // Check for prior authorization requirements
    if (result.primaryPlan && result.primaryPlan.requirements.priorAuthRequired) {
      result.alerts.push({
        type: 'prior-auth-required',
        severity: 'high',
        message: 'Prior authorization required for this service'
      });
    }

    // Check for referral requirements
    if (result.primaryPlan && result.primaryPlan.requirements.referralRequired) {
      result.alerts.push({
        type: 'referral-required',
        severity: 'medium',
        message: 'Referral required for this service'
      });
    }
  }

  // Utility methods
  generateTransactionId() {
    return `ELG${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }

  generateEligibilityCacheKey(patientId, serviceDate, serviceTypeCode) {
    const key = `eligibility_${patientId}_${serviceDate}_${serviceTypeCode}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  async getCachedEligibility(cacheKey, urgent) {
    if (urgent) return null; // Skip cache for urgent checks
    
    const cached = await SecureDataAccess.findOne('eligibilitycache', {
      key: cacheKey,
      expiresAt: { $gt: new Date() }
    });
    
    return cached ? cached.result : null;
  }

  async cacheEligibilityResult(cacheKey, result) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4); // Cache for 4 hours
    
    return await SecureDataAccess.upsert('eligibilitycache', 
      { key: cacheKey },
      {
        key: cacheKey,
        result,
        createdAt: new Date(),
        expiresAt
      }
    );
  }

  async storeEligibilityVerification(data, context) {
    return await SecureDataAccess.create('eligibilityverifications', {
      ...data,
      createdAt: new Date()
    }, context);
  }

  async logEligibilityCheck(patientId, type, result, context) {
    await AuditLog.create({
      action: 'ELIGIBILITY_CHECK_LOG',
      userId: context.userId,
      patientId,
      practiceId: context.practiceId,
      details: {
        checkType: type,
        eligible: result.eligible,
        plansChecked: result.primaryPlan ? (result.secondaryPlan ? 2 : 1) : 0
      },
      timestamp: new Date()
    });
  }

  mapX12ServiceType(code) {
    const serviceTypes = {
      '1': 'Medical Care',
      '2': 'Surgical',
      '3': 'Consultation',
      '4': 'Diagnostic X-ray',
      '5': 'Diagnostic Lab',
      '6': 'Radiation Therapy',
      '7': 'Anesthesia',
      '8': 'Surgical Assistance',
      '9': 'Other Medical',
      '10': 'Blood Charges',
      '11': 'Used Durable Medical Equipment',
      '12': 'Durable Medical Equipment Purchase',
      '13': 'Ambulatory Surgery Center',
      '14': 'Renal Supplies in the Home',
      '15': 'Alternate Method Dialysis',
      '16': 'Chronic Renal Disease Equipment',
      '17': 'Pre-Admission Testing',
      '18': 'Durable Medical Equipment Rental',
      '19': 'Pneumonia Vaccine',
      '20': 'Second Surgical Opinion',
      '21': 'Third Surgical Opinion',
      '22': 'Social Work',
      '23': 'Diagnostic Dental',
      '24': 'Periodontics',
      '25': 'Restorative',
      '26': 'Endodontics',
      '27': 'Maxillofacial Prosthetics',
      '28': 'Adjunctive Dental Services',
      '30': 'Health Benefit Plan Coverage',
      '32': 'Plan Waiting Period',
      '33': 'Chiropractic',
      '34': 'Chiropractic Office Visits',
      '35': 'Dental Care',
      '36': 'Dental Crowns',
      '37': 'Dental Accident',
      '38': 'Orthodontics',
      '39': 'Prosthodontics',
      '40': 'Oral Surgery',
      '41': 'Routine Preventive Dental',
      '42': 'Home Health Care',
      '43': 'Home Health Prescriptions',
      '44': 'Home Health Visits',
      '45': 'Hospice',
      '46': 'Respite Care',
      '47': 'Hospital',
      '48': 'Hospital Inpatient',
      '49': 'Hospital Room and Board',
      '50': 'Hospital Outpatient'
    };
    
    return serviceTypes[code] || `Service Type ${code}`;
  }

  parseX12Date(dateString) {
    // Parse X12 date format (CCYYMMDD)
    if (!dateString || dateString.length !== 8) return null;
    
    const year = dateString.substr(0, 4);
    const month = dateString.substr(4, 2);
    const day = dateString.substr(6, 2);
    
    return new Date(`${year}-${month}-${day}`);
  }

  generateX12_270(request, provider) {
    // Generate X12 270 eligibility inquiry message
    const segments = [
      `ISA*00*${' '.repeat(10)}*00*${' '.repeat(10)}*ZZ*${provider.submitterId.padEnd(15)}*ZZ*${request.receiverId.padEnd(15)}*${new Date().toISOString().slice(0,10).replace(/-/g,'')}*${new Date().toTimeString().slice(0,5).replace(/:/g,'')}*^*00501*${request.transactionId}*1*T*:~`,
      `GS*HS*${provider.submitterId}*${request.receiverId}*${new Date().toISOString().slice(0,10).replace(/-/g,'')}*${new Date().toTimeString().slice(0,5).replace(/:/g,'')}*${request.transactionId}*X*005010X279A1~`,
      `ST*270*${request.transactionId}*005010X279A1~`,
      `BHT*0022*13*${request.transactionId}*${new Date().toISOString().slice(0,10).replace(/-/g,'')}*${new Date().toTimeString().slice(0,5).replace(/:/g,'')}~`,
      `HL*1**20*1~`,
      `NM1*PR*2*${request.receiverId}*****PI*${request.receiverId}~`,
      `HL*2*1*21*1~`,
      `NM1*1P*2*${provider.name}*****XX*${request.provider.npi}~`,
      `HL*3*2*22*0~`,
      `TRN*1*${request.transactionId}~`,
      `NM1*IL*1*${request.subscriber.lastName}*${request.subscriber.firstName}****MI*${request.subscriber.memberId}~`,
      `DMG*D8*${request.subscriber.dateOfBirth.toISOString().slice(0,10).replace(/-/g,'')}*${request.subscriber.gender === 'male' ? 'M' : 'F'}~`
    ];

    // Add dependent information if present
    if (request.dependent) {
      segments.push(`NM1*03*1*${request.dependent.lastName}*${request.dependent.firstName}~`);
      segments.push(`DMG*D8*${request.dependent.dateOfBirth.toISOString().slice(0,10).replace(/-/g,'')}*${request.dependent.gender === 'male' ? 'M' : 'F'}~`);
    }

    // Add service date
    segments.push(`DTP*291*D8*${request.serviceDate.toISOString().slice(0,10).replace(/-/g,'')}~`);

    // Add information requested
    request.informationRequested.forEach(infoCode => {
      segments.push(`EQ*${infoCode}~`);
    });

    // Close segments
    const segmentCount = segments.length + 2;
    segments.push(`SE*${segmentCount}*${request.transactionId}~`);
    segments.push(`GE*1*${request.transactionId}~`);
    segments.push(`IEA*1*${request.transactionId}~`);
    
    return segments.join('');
  }

  async loadEligibilityProviders() {
    // Load eligibility provider configurations
    return {
      'AETNA': {
        type: 'rest-api',
        endpoint: 'https://api.aetna.com/v1/eligibility',
        apiKey: process.env.AETNA_API_KEY,
        clientId: process.env.AETNA_CLIENT_ID,
        submitterId: process.env.AETNA_SUBMITTER_ID,
        taxonomyCode: '207Q00000X'
      },
      'BCBS': {
        type: 'x12-270',
        endpoint: 'https://eligibility.bcbs.com',
        apiKey: process.env.BCBS_API_KEY,
        submitterId: process.env.BCBS_SUBMITTER_ID,
        partnerId: process.env.BCBS_PARTNER_ID,
        taxonomyCode: '207Q00000X'
      },
      'CHANGEHE': {
        type: 'clearinghouse',
        endpoint: 'https://api.changehealthcare.com/eligibility',
        apiKey: process.env.CHANGE_HEALTHCARE_API_KEY,
        clearinghouseId: process.env.CHANGE_HEALTHCARE_ID
      }
    };
  }

  async loadBenefitMappings() {
    // Load benefit mapping configurations
    return await SecureDataAccess.query('benefitmappings', { active: true });
  }
}

module.exports = new EligibilityVerificationService();
```

### 2. Create Eligibility API Endpoints
```javascript
// backend/routes/eligibility.js

// Check patient eligibility
router.post('/api/eligibility/check', authenticate, authorize(['provider', 'nurse', 'medical-assistant', 'scheduler']), async (req, res) => {
  try {
    const {
      patientId,
      serviceDate = new Date(),
      serviceTypeCode = '30',
      providerNPI = null,
      includeCoordinationOfBenefits = true,
      urgentCheck = false
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID is required'
      });
    }

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await eligibilityVerificationService.checkEligibility(
      patientId,
      new Date(serviceDate),
      {
        serviceTypeCode,
        providerNPI,
        includeCoordinationOfBenefits,
        urgentCheck
      },
      context
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get eligibility verification history
router.get('/api/eligibility/patient/:patientId/history', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 50, days = 30 } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const verifications = await SecureDataAccess.query('eligibilityverifications', {
      patientId,
      practiceId: context.practiceId,
      createdAt: { $gte: startDate }
    }, {
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    }, context);

    res.json({
      success: true,
      data: verifications,
      count: verifications.length
    });
  } catch (error) {
    console.error('Error retrieving eligibility history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve eligibility history'
    });
  }
});

// Bulk eligibility check
router.post('/api/eligibility/bulk-check', authenticate, authorize(['provider', 'scheduler']), async (req, res) => {
  try {
    const { patients } = req.body; // Array of {patientId, serviceDate, serviceTypeCode}

    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Patients array is required'
      });
    }

    if (patients.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 patients per bulk check'
      });
    }

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const results = await Promise.all(
      patients.map(async (patient) => {
        try {
          const result = await eligibilityVerificationService.checkEligibility(
            patient.patientId,
            new Date(patient.serviceDate),
            { serviceTypeCode: patient.serviceTypeCode },
            context
          );
          return {
            patientId: patient.patientId,
            success: true,
            eligibility: result
          };
        } catch (error) {
          return {
            patientId: patient.patientId,
            success: false,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      data: results,
      processed: results.length,
      eligible: results.filter(r => r.eligibility?.eligible).length,
      errors: results.filter(r => !r.success).length
    });
  } catch (error) {
    console.error('Error in bulk eligibility check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk eligibility check'
    });
  }
});
```

## Required Endpoints

### POST /api/eligibility/check
**Description**: Check patient insurance eligibility
**Access**: Providers, Nurses, Medical Assistants, Schedulers
**Request Body**:
```json
{
  "patientId": "60d5eca7f1b2c8b1d8e4f89a",
  "serviceDate": "2024-12-20",
  "serviceTypeCode": "30",
  "providerNPI": "1234567890",
  "includeCoordinationOfBenefits": true,
  "urgentCheck": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "eligible": true,
    "patient": {
      "id": "60d5eca7f1b2c8b1d8e4f89a",
      "name": "John Doe",
      "dateOfBirth": "1980-01-01"
    },
    "verificationDate": "2024-12-19T10:30:00Z",
    "primaryPlan": {
      "eligible": true,
      "active": true,
      "plan": {
        "company": "Aetna",
        "planName": "Aetna Better Health",
        "planType": "HMO",
        "memberId": "W123456789",
        "priority": 1
      },
      "coverage": {
        "effectiveDate": "2024-01-01",
        "terminationDate": null,
        "networkStatus": "in-network"
      },
      "benefits": {
        "deductible": {
          "amount": 1000,
          "type": "individual",
          "period": "calendar-year"
        },
        "copayment": {
          "amount": 25,
          "serviceType": "30"
        }
      },
      "requirements": {
        "priorAuthRequired": false,
        "referralRequired": false,
        "pcpRequired": true
      }
    },
    "patientResponsibility": {
      "estimatedCopay": 25,
      "estimatedCoinsurance": 0,
      "estimatedDeductible": 0,
      "totalEstimatedResponsibility": 25
    },
    "alerts": [],
    "messages": []
  }
}
```

### GET /api/eligibility/patient/:patientId/history
**Description**: Get eligibility verification history
**Access**: Providers, Nurses

### POST /api/eligibility/bulk-check
**Description**: Check eligibility for multiple patients
**Access**: Providers, Schedulers

## Data Models Required

### EligibilityVerifications Collection
```javascript
{
  patientId: ObjectId,
  serviceDate: Date,
  serviceTypeCode: String,
  result: Object, // Complete eligibility result
  verifiedBy: ObjectId,
  practiceId: String,
  createdAt: Date
}
```

### EligibilityCache Collection
```javascript
{
  key: String, // MD5 hash of verification parameters
  result: Object,
  createdAt: Date,
  expiresAt: Date
}
```

### BenefitMappings Collection
```javascript
{
  payerId: String,
  benefitCode: String,
  benefitType: String,
  description: String,
  active: Boolean
}
```

## Test Cases

### 1. Basic Eligibility Check
- Check eligibility for patient with active insurance
- Verify all benefit information returned
- Check patient responsibility calculation

### 2. Multiple Insurance Plans
- Patient with primary and secondary insurance
- Verify coordination of benefits
- Check proper priority handling

### 3. Cache Functionality
- Verify caching of recent checks
- Test cache expiration
- Check urgent bypass of cache

### 4. Network Status
- In-network provider verification
- Out-of-network cost implications
- Network status alerting

### 5. Benefit Details
- Deductible information accuracy
- Copay calculation
- Coinsurance percentage verification

### 6. Requirements Checking
- Prior authorization requirements
- Referral requirements
- PCP requirements

### 7. Bulk Operations
- Multiple patient eligibility check
- Performance optimization
- Error handling for failures

### 8. X12 Integration
- X12 270/271 transaction processing
- Response parsing accuracy
- Error handling for malformed responses

## Dependencies
- SecureDataAccess service
- Insurance provider APIs
- X12 processing libraries
- Clearinghouse connections
- AuditLog for tracking

## Success Criteria
- [ ] Real-time eligibility verification
- [ ] Multiple insurance plan support
- [ ] X12 270/271 transaction processing
- [ ] Coordination of benefits calculation
- [ ] Patient responsibility estimation
- [ ] Benefit detail extraction
- [ ] Requirement identification
- [ ] Cache performance optimization
- [ ] Bulk verification capability
- [ ] Complete audit trail
- [ ] Alert system for important findings

## Notes
- Consider implementing Change Healthcare clearinghouse
- May need additional benefit detail APIs
- Future enhancement: real-time COB calculation
- Consider adding member portal integration
- May need integration with scheduling system
- Consider adding benefit estimation tools