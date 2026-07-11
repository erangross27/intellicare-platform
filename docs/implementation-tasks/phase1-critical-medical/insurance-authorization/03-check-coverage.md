# Check Coverage

## Function Details
- **Name**: checkCoverage
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 4 hours

## Problem Description
Healthcare providers need to verify patient insurance coverage in real-time before providing services. The system must check active coverage, benefits eligibility, copay amounts, deductible status, and coverage limitations. This prevents claim denials and ensures proper billing procedures.

## Implementation Steps

### 1. Create Coverage Verification Service
```javascript
// backend/services/insuranceCoverageService.js

const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const axios = require('axios');

class InsuranceCoverageService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('insurance-coverage-service');
    this.insuranceProviders = await this.loadInsuranceProviders();
    this.eligibilityAPIs = await this.loadEligibilityAPIs();
  }

  async checkCoverage(patientId, serviceDate, options = {}, context) {
    const {
      serviceCode = null,
      providerId = null,
      facilityId = null,
      urgentCheck = false,
      includeDeductible = true,
      includeCopay = true,
      includeCoinsurance = true,
      includePriorAuth = true
    } = options;

    // Get patient insurance information
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    if (!patient) {
      throw new Error('Patient not found');
    }

    const insurance = await this.getActiveInsurance(patientId, serviceDate, context);
    if (!insurance) {
      return {
        success: false,
        coverage: null,
        message: 'No active insurance coverage found',
        selfPay: true
      };
    }

    // Check cache first for recent verifications
    const cacheKey = this.generateCacheKey(insurance, serviceCode, serviceDate);
    const cachedResult = await this.getCachedCoverage(cacheKey, urgentCheck);
    
    if (cachedResult) {
      await this.logCoverageCheck(patientId, 'CACHED', cachedResult, context);
      return cachedResult;
    }

    // Perform real-time eligibility check
    const eligibilityResult = await this.performEligibilityCheck(
      insurance,
      patient,
      serviceDate,
      {
        serviceCode,
        providerId,
        facilityId
      }
    );

    // Get additional coverage details
    const coverageDetails = await Promise.all([
      includeDeductible ? this.getDeductibleInfo(insurance, serviceDate) : null,
      includeCopay ? this.getCopayInfo(insurance, serviceCode, providerId) : null,
      includeCoinsurance ? this.getCoinsuranceInfo(insurance, serviceCode) : null,
      includePriorAuth ? this.checkPriorAuthRequired(insurance, serviceCode) : null
    ]);

    // Build comprehensive coverage result
    const result = {
      success: eligibilityResult.eligible,
      coverage: {
        eligible: eligibilityResult.eligible,
        active: eligibilityResult.active,
        effectiveDate: eligibilityResult.effectiveDate,
        terminationDate: eligibilityResult.terminationDate,
        planName: eligibilityResult.planName,
        planType: eligibilityResult.planType,
        groupNumber: eligibilityResult.groupNumber,
        memberId: eligibilityResult.memberId,
        pcpRequired: eligibilityResult.pcpRequired,
        referralRequired: eligibilityResult.referralRequired,
        networkStatus: eligibilityResult.networkStatus
      },
      benefits: {
        deductible: coverageDetails[0],
        copay: coverageDetails[1],
        coinsurance: coverageDetails[2],
        priorAuth: coverageDetails[3]
      },
      limitations: eligibilityResult.limitations || [],
      exclusions: eligibilityResult.exclusions || [],
      messages: eligibilityResult.messages || [],
      verificationDate: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    // Cache the result
    await this.cacheCoverageResult(cacheKey, result);

    // Store verification record
    await this.storeCoverageVerification({
      patientId,
      insuranceId: insurance._id,
      serviceDate,
      serviceCode,
      result,
      verifiedBy: context.userId,
      practiceId: context.practiceId
    }, context);

    // Create audit log
    await AuditLog.create({
      action: 'CHECK_INSURANCE_COVERAGE',
      userId: context.userId,
      patientId,
      practiceId: context.practiceId,
      details: {
        insuranceCompany: insurance.company,
        planName: result.coverage?.planName,
        eligible: result.coverage?.eligible,
        serviceCode
      },
      timestamp: new Date()
    });

    // Check for alerts
    await this.checkCoverageAlerts(result, patient, insurance, context);

    return result;
  }

  async getActiveInsurance(patientId, serviceDate, context) {
    // Get active insurance for service date
    const query = {
      patientId,
      practiceId: context.practiceId,
      active: true,
      $or: [
        { effectiveDate: { $lte: serviceDate }, terminationDate: { $gte: serviceDate } },
        { effectiveDate: { $lte: serviceDate }, terminationDate: null }
      ]
    };

    const insurances = await SecureDataAccess.query('patientinsurance', query, {
      sort: { priority: 1, effectiveDate: -1 }
    }, context);

    return insurances[0] || null; // Primary insurance
  }

  async performEligibilityCheck(insurance, patient, serviceDate, options) {
    const provider = this.insuranceProviders[insurance.payerId];
    if (!provider) {
      throw new Error(`Insurance provider not configured: ${insurance.company}`);
    }

    // Build eligibility request based on provider API
    const eligibilityRequest = this.buildEligibilityRequest(
      insurance,
      patient,
      serviceDate,
      options,
      provider
    );

    try {
      // Call insurance provider API
      let response;
      
      switch (provider.type) {
        case 'x12-270':
          response = await this.sendX12EligibilityRequest(eligibilityRequest, provider);
          break;
        case 'rest-api':
          response = await this.sendRESTEligibilityRequest(eligibilityRequest, provider);
          break;
        case 'clearinghouse':
          response = await this.sendClearinghouseRequest(eligibilityRequest, provider);
          break;
        default:
          throw new Error(`Unsupported provider type: ${provider.type}`);
      }

      return this.parseEligibilityResponse(response, provider.type);
    } catch (error) {
      console.error('Eligibility check failed:', error);
      
      // Return cached/default response for system availability
      return {
        eligible: null,
        active: null,
        error: error.message,
        fallbackUsed: true,
        message: 'Real-time verification unavailable. Manual verification required.'
      };
    }
  }

  buildEligibilityRequest(insurance, patient, serviceDate, options, provider) {
    const request = {
      // Standard fields
      transactionId: this.generateTransactionId(),
      submitterId: provider.submitterId,
      receiverId: insurance.payerId,
      
      // Patient demographics
      patient: {
        memberId: insurance.memberId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        ssn: patient.ssn
      },
      
      // Insurance details
      insurance: {
        payerId: insurance.payerId,
        planId: insurance.planId,
        groupNumber: insurance.groupNumber,
        relationshipCode: insurance.relationshipCode || '18' // Self
      },
      
      // Service details
      serviceDate: serviceDate,
      serviceTypeCode: options.serviceCode ? '30' : '33', // Professional vs General
      
      // Provider details
      provider: {
        npi: options.providerId,
        taxonomyCode: provider.taxonomyCode
      }
    };

    // Add service-specific codes if provided
    if (options.serviceCode) {
      request.serviceTypeCodes = [options.serviceCode];
    }

    return request;
  }

  async sendX12EligibilityRequest(request, provider) {
    // Generate X12 270 transaction
    const x12Message = this.generateX12_270(request, provider);
    
    const response = await axios.post(provider.endpoint, x12Message, {
      headers: {
        'Content-Type': 'application/x12',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      timeout: 30000
    });

    return {
      type: 'x12-271',
      data: response.data
    };
  }

  async sendRESTEligibilityRequest(request, provider) {
    const response = await axios.post(`${provider.endpoint}/eligibility`, request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'X-Client-ID': provider.clientId
      },
      timeout: 30000
    });

    return {
      type: 'rest-json',
      data: response.data
    };
  }

  async sendClearinghouseRequest(request, provider) {
    // Use clearinghouse API (Change Healthcare, Availity, etc.)
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
      data: response.data
    };
  }

  parseEligibilityResponse(response, type) {
    switch (type) {
      case 'x12-271':
        return this.parseX12_271Response(response.data);
      case 'rest-json':
        return this.parseRESTResponse(response.data);
      case 'clearinghouse':
        return this.parseClearinghouseResponse(response.data);
      default:
        throw new Error(`Unknown response type: ${type}`);
    }
  }

  parseX12_271Response(x12Data) {
    // Parse X12 271 response - simplified implementation
    // In production, use proper X12 parsing library
    
    const segments = x12Data.split('~');
    const result = {
      eligible: false,
      active: false,
      effectiveDate: null,
      terminationDate: null,
      planName: null,
      planType: null,
      groupNumber: null,
      memberId: null,
      messages: []
    };

    segments.forEach(segment => {
      const elements = segment.split('*');
      
      switch (elements[0]) {
        case 'EB': // Eligibility/Benefit Information
          if (elements[1] === '1') { // Active coverage
            result.eligible = true;
            result.active = true;
          }
          if (elements[3]) {
            result.planType = this.mapX12PlanType(elements[3]);
          }
          break;
        
        case 'DTP': // Date/Time Period
          if (elements[1] === '346') { // Plan Begin Date
            result.effectiveDate = this.parseX12Date(elements[3]);
          }
          if (elements[1] === '347') { // Plan End Date
            result.terminationDate = this.parseX12Date(elements[3]);
          }
          break;
        
        case 'NM1': // Individual Name
          if (elements[1] === 'IL') { // Insured
            result.memberId = elements[9];
          }
          break;
        
        case 'MSG': // Message Text
          result.messages.push(elements[1]);
          break;
      }
    });

    return result;
  }

  parseRESTResponse(data) {
    // Parse standard REST API response
    return {
      eligible: data.eligible || false,
      active: data.active || false,
      effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
      terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
      planName: data.plan?.name,
      planType: data.plan?.type,
      groupNumber: data.groupNumber,
      memberId: data.memberId,
      pcpRequired: data.benefits?.pcpRequired || false,
      referralRequired: data.benefits?.referralRequired || false,
      networkStatus: data.provider?.networkStatus,
      limitations: data.limitations || [],
      exclusions: data.exclusions || [],
      messages: data.messages || []
    };
  }

  async getDeductibleInfo(insurance, serviceDate) {
    // Get current deductible information
    try {
      const deductibleResponse = await this.queryBenefitDetails(
        insurance,
        'deductible',
        serviceDate
      );

      return {
        individual: {
          amount: deductibleResponse.individualDeductible,
          remaining: deductibleResponse.individualRemaining,
          met: deductibleResponse.individualMet
        },
        family: {
          amount: deductibleResponse.familyDeductible,
          remaining: deductibleResponse.familyRemaining,
          met: deductibleResponse.familyMet
        },
        networkType: deductibleResponse.networkType,
        planYear: deductibleResponse.planYear
      };
    } catch (error) {
      return {
        error: 'Deductible information unavailable',
        message: error.message
      };
    }
  }

  async getCopayInfo(insurance, serviceCode, providerId) {
    // Get copay information for specific service
    try {
      const copayResponse = await this.queryBenefitDetails(
        insurance,
        'copay',
        null,
        { serviceCode, providerId }
      );

      return {
        amount: copayResponse.copayAmount,
        serviceType: copayResponse.serviceType,
        networkLevel: copayResponse.networkLevel,
        specialtyTier: copayResponse.specialtyTier,
        notes: copayResponse.notes
      };
    } catch (error) {
      return {
        error: 'Copay information unavailable',
        message: error.message
      };
    }
  }

  async getCoinsuranceInfo(insurance, serviceCode) {
    // Get coinsurance percentage
    try {
      const coinsResponse = await this.queryBenefitDetails(
        insurance,
        'coinsurance',
        null,
        { serviceCode }
      );

      return {
        percentage: coinsResponse.patientPercentage,
        planPercentage: coinsResponse.planPercentage,
        networkLevel: coinsResponse.networkLevel,
        serviceCategory: coinsResponse.serviceCategory
      };
    } catch (error) {
      return {
        error: 'Coinsurance information unavailable',
        message: error.message
      };
    }
  }

  async checkPriorAuthRequired(insurance, serviceCode) {
    // Check if prior authorization is required
    try {
      const priorAuthResponse = await this.queryBenefitDetails(
        insurance,
        'prior-auth',
        null,
        { serviceCode }
      );

      return {
        required: priorAuthResponse.required,
        serviceCode: serviceCode,
        authorizationProcess: priorAuthResponse.process,
        timeframe: priorAuthResponse.timeframe,
        contactInfo: priorAuthResponse.contactInfo
      };
    } catch (error) {
      return {
        required: null,
        error: 'Prior authorization information unavailable',
        message: error.message
      };
    }
  }

  async checkCoverageAlerts(result, patient, insurance, context) {
    const alerts = [];

    // Check for coverage issues
    if (!result.coverage?.eligible) {
      alerts.push({
        type: 'coverage-not-eligible',
        severity: 'high',
        message: 'Patient not eligible for coverage'
      });
    }

    if (!result.coverage?.active) {
      alerts.push({
        type: 'coverage-inactive',
        severity: 'high',
        message: 'Insurance coverage is inactive'
      });
    }

    // Check for upcoming termination
    if (result.coverage?.terminationDate) {
      const daysUntilTermination = Math.ceil(
        (new Date(result.coverage.terminationDate) - new Date()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilTermination <= 30) {
        alerts.push({
          type: 'coverage-expiring',
          severity: 'warning',
          message: `Coverage expires in ${daysUntilTermination} days`,
          expirationDate: result.coverage.terminationDate
        });
      }
    }

    // Check deductible status
    if (result.benefits?.deductible && !result.benefits.deductible.individual?.met) {
      alerts.push({
        type: 'deductible-not-met',
        severity: 'info',
        message: `Deductible not met: $${result.benefits.deductible.individual?.remaining} remaining`
      });
    }

    // Store alerts if any
    if (alerts.length > 0) {
      await this.storeCoverageAlerts(patient._id, alerts, context);
    }
  }

  async storeCoverageVerification(data, context) {
    return await SecureDataAccess.create('coverageverifications', {
      ...data,
      createdAt: new Date()
    }, context);
  }

  async storeCoverageAlerts(patientId, alerts, context) {
    const alertRecords = alerts.map(alert => ({
      patientId,
      practiceId: context.practiceId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      metadata: alert,
      createdAt: new Date(),
      status: 'active'
    }));

    return await SecureDataAccess.insertMany('coveragealerts', alertRecords, context);
  }

  // Utility methods
  generateTransactionId() {
    return `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCacheKey(insurance, serviceCode, serviceDate) {
    const key = `coverage_${insurance.payerId}_${insurance.memberId}_${serviceCode || 'general'}_${serviceDate}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  async getCachedCoverage(cacheKey, urgent) {
    if (urgent) return null; // Skip cache for urgent checks
    
    const cached = await SecureDataAccess.findOne('coveragecache', {
      key: cacheKey,
      expiresAt: { $gt: new Date() }
    });
    
    return cached ? cached.result : null;
  }

  async cacheCoverageResult(cacheKey, result) {
    return await SecureDataAccess.upsert('coveragecache', 
      { key: cacheKey },
      {
        key: cacheKey,
        result,
        createdAt: new Date(),
        expiresAt: result.expiresAt
      }
    );
  }

  async queryBenefitDetails(insurance, benefitType, serviceDate, options = {}) {
    // Query specific benefit details from insurance provider
    // Implementation would vary by provider API
    return {
      error: 'Benefit detail query not implemented for this provider'
    };
  }

  async loadInsuranceProviders() {
    // Load configured insurance providers
    return {
      'AETNA': {
        type: 'rest-api',
        endpoint: 'https://api.aetna.com/v1',
        apiKey: process.env.AETNA_API_KEY,
        submitterId: process.env.AETNA_SUBMITTER_ID,
        taxonomyCode: '207Q00000X'
      },
      'BCBS': {
        type: 'x12-270',
        endpoint: 'https://eligibility.bcbs.com',
        apiKey: process.env.BCBS_API_KEY,
        submitterId: process.env.BCBS_SUBMITTER_ID,
        taxonomyCode: '207Q00000X'
      }
      // Add more providers as needed
    };
  }

  async loadEligibilityAPIs() {
    // Load eligibility API configurations
    return await SecureDataAccess.query('eligibilityapis', { active: true });
  }

  mapX12PlanType(code) {
    const planTypes = {
      '12': 'Medicare Part B',
      '13': 'Medicare Part A',
      '15': 'Medicare',
      'CI': 'Commercial Insurance',
      'HM': 'Health Maintenance Organization',
      'MB': 'Medicare Part B',
      'MC': 'Medicaid',
      'PP': 'Preferred Provider Organization'
    };
    
    return planTypes[code] || 'Unknown';
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
    // This is a simplified version - production would use proper X12 library
    
    const segments = [
      `ISA*00*${' '.repeat(10)}*00*${' '.repeat(10)}*ZZ*${provider.submitterId.padEnd(15)}*ZZ*${request.receiverId.padEnd(15)}*${new Date().toISOString().slice(0,10).replace(/-/g,'')}*${new Date().toTimeString().slice(0,5).replace(/:/g,'')}*^*00501*${request.transactionId}*1*T*:~`,
      `GS*HS*${provider.submitterId}*${request.receiverId}*${new Date().toISOString().slice(0,10).replace(/-/g,'')}*${new Date().toTimeString().slice(0,5).replace(/:/g,'')}*${request.transactionId}*X*005010X279A1~`,
      `ST*270*${request.transactionId}*005010X279A1~`,
      `BHT*0022*13*${request.transactionId}*${new Date().toISOString().slice(0,10).replace(/-/g,'')}*${new Date().toTimeString().slice(0,5).replace(/:/g,'')}~`,
      `HL*1**20*1~`,
      `NM1*PR*2*${request.insurance.payerId}*****PI*${request.insurance.payerId}~`,
      `HL*2*1*21*1~`,
      `NM1*1P*2*${provider.name}*****XX*${request.provider.npi}~`,
      `HL*3*2*22*0~`,
      `TRN*1*${request.transactionId}~`,
      `NM1*IL*1*${request.patient.lastName}*${request.patient.firstName}****MI*${request.patient.memberId}~`,
      `DMG*D8*${request.patient.dateOfBirth.toISOString().slice(0,10).replace(/-/g,'')}*${request.patient.gender}~`,
      `DTP*291*D8*${request.serviceDate.toISOString().slice(0,10).replace(/-/g,'')}~`,
      `EQ*${request.serviceTypeCode}~`,
      `SE*${14}*${request.transactionId}~`,
      `GE*1*${request.transactionId}~`,
      `IEA*1*${request.transactionId}~`
    ];
    
    return segments.join('');
  }
}

module.exports = new InsuranceCoverageService();
```

### 2. Create Coverage Check API Endpoints
```javascript
// backend/routes/insurance.js

// Check insurance coverage
router.post('/api/insurance/check-coverage', authenticate, authorize(['provider', 'nurse', 'medical-assistant']), async (req, res) => {
  try {
    const {
      patientId,
      serviceDate = new Date(),
      serviceCode = null,
      providerId = null,
      urgentCheck = false,
      includeDeductible = true,
      includeCopay = true
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

    const result = await insuranceCoverageService.checkCoverage(
      patientId,
      new Date(serviceDate),
      {
        serviceCode,
        providerId,
        urgentCheck,
        includeDeductible,
        includeCopay
      },
      context
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking coverage:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get coverage verification history
router.get('/api/insurance/patient/:patientId/coverage-history', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
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

    const verifications = await SecureDataAccess.query('coverageverifications', {
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
    console.error('Error retrieving coverage history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve coverage history'
    });
  }
});

// Bulk coverage check for appointment scheduling
router.post('/api/insurance/bulk-coverage-check', authenticate, authorize(['provider', 'scheduler']), async (req, res) => {
  try {
    const { appointments } = req.body; // Array of {patientId, serviceDate, serviceCode}

    if (!Array.isArray(appointments) || appointments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Appointments array is required'
      });
    }

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const results = await Promise.all(
      appointments.map(async (appt) => {
        try {
          const result = await insuranceCoverageService.checkCoverage(
            appt.patientId,
            new Date(appt.serviceDate),
            { serviceCode: appt.serviceCode },
            context
          );
          return {
            patientId: appt.patientId,
            serviceDate: appt.serviceDate,
            success: true,
            coverage: result
          };
        } catch (error) {
          return {
            patientId: appt.patientId,
            serviceDate: appt.serviceDate,
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
      eligible: results.filter(r => r.coverage?.coverage?.eligible).length
    });
  } catch (error) {
    console.error('Error in bulk coverage check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk coverage check'
    });
  }
});
```

## Required Endpoints

### POST /api/insurance/check-coverage
**Description**: Check insurance coverage for a patient
**Access**: Providers, Nurses, Medical Assistants
**Request Body**:
```json
{
  "patientId": "60d5eca7f1b2c8b1d8e4f89a",
  "serviceDate": "2024-12-20",
  "serviceCode": "99213",
  "providerId": "1234567890",
  "urgentCheck": false,
  "includeDeductible": true,
  "includeCopay": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "coverage": {
      "eligible": true,
      "active": true,
      "effectiveDate": "2024-01-01",
      "terminationDate": null,
      "planName": "Aetna Better Health",
      "planType": "HMO",
      "groupNumber": "ABC123",
      "memberId": "W123456789",
      "pcpRequired": true,
      "referralRequired": false,
      "networkStatus": "in-network"
    },
    "benefits": {
      "deductible": {
        "individual": {
          "amount": 1000,
          "remaining": 750,
          "met": false
        }
      },
      "copay": {
        "amount": 25,
        "serviceType": "office-visit",
        "networkLevel": "in-network"
      }
    },
    "verificationDate": "2024-12-19T10:30:00Z"
  }
}
```

### GET /api/insurance/patient/:patientId/coverage-history
**Description**: Get coverage verification history
**Access**: Providers, Nurses

### POST /api/insurance/bulk-coverage-check
**Description**: Check coverage for multiple appointments
**Access**: Providers, Schedulers

## Data Models Required

### CoverageVerifications Collection
```javascript
{
  patientId: ObjectId,
  insuranceId: ObjectId,
  practiceId: String,
  serviceDate: Date,
  serviceCode: String,
  result: Object, // Full coverage result
  verifiedBy: ObjectId,
  createdAt: Date,
  transactionId: String
}
```

### CoverageCache Collection
```javascript
{
  key: String, // MD5 hash of verification parameters
  result: Object,
  createdAt: Date,
  expiresAt: Date
}
```

### CoverageAlerts Collection
```javascript
{
  patientId: ObjectId,
  practiceId: String,
  type: String,
  severity: String,
  message: String,
  metadata: Object,
  status: String,
  createdAt: Date
}
```

### PatientInsurance Collection
```javascript
{
  patientId: ObjectId,
  practiceId: String,
  company: String,
  payerId: String,
  planId: String,
  planName: String,
  memberId: String,
  groupNumber: String,
  priority: Number, // 1=primary, 2=secondary
  active: Boolean,
  effectiveDate: Date,
  terminationDate: Date,
  relationshipCode: String
}
```

## Test Cases

### 1. Basic Coverage Check
- Check coverage for active patient
- Verify eligibility status
- Check benefit details returned

### 2. Multiple Insurance Plans
- Patient with primary/secondary insurance
- Verify priority handling
- Check coordination of benefits

### 3. Cache Functionality
- Verify caching of recent checks
- Check cache expiration
- Test urgent check bypasses cache

### 4. API Integration
- Test X12 270/271 transaction
- Test REST API integration
- Handle API timeouts gracefully

### 5. Coverage Alerts
- Expiring coverage detection
- Inactive coverage warnings
- Deductible status alerts

### 6. Bulk Operations
- Multiple appointments check
- Performance under load
- Error handling for failed checks

### 7. Error Handling
- Invalid patient ID
- Missing insurance information
- API unavailable scenarios

## Dependencies
- SecureDataAccess service
- Insurance provider APIs (Aetna, BCBS, etc.)
- X12 parsing libraries
- Clearinghouse connections
- AuditLog for compliance

## Success Criteria
- [ ] Real-time eligibility verification
- [ ] Multiple insurance provider support
- [ ] X12 270/271 transaction processing
- [ ] REST API integration
- [ ] Caching for performance
- [ ] Comprehensive benefit details
- [ ] Alert system for coverage issues
- [ ] Bulk verification capability
- [ ] Complete audit trail
- [ ] Error handling and fallbacks

## Notes
- Consider implementing Change Healthcare API
- May need Availity clearinghouse integration
- Future enhancement: prior authorization workflow
- Consider adding member portal integration
- May need real-time eligibility for scheduling system