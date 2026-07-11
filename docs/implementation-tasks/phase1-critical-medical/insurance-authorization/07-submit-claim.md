# Submit Claim

## Function Details
- **Name**: submitClaim
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 6 hours

## Problem Description
Healthcare providers need to submit insurance claims for rendered services to receive payment. The system must generate accurate claims, validate all required information, handle multiple claim formats (X12 837, CMS-1500, UB-04), track claim status, and manage claim corrections and resubmissions while ensuring compliance with billing regulations.

## Implementation Steps

### 1. Create Claims Submission Service
```javascript
// backend/services/claimsSubmissionService.js

const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const axios = require('axios');

class ClaimsSubmissionService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('claims-submission-service');
    this.claimProviders = await this.loadClaimProviders();
    this.billingRules = await this.loadBillingRules();
    this.feeSchedules = await this.loadFeeSchedules();
  }

  async submitClaim(claimData, options = {}, context) {
    const {
      submitImmediately = true,
      validateOnly = false,
      generateOnly = false,
      claimType = 'professional', // professional, institutional, dental
      electronicSubmission = true,
      testMode = false
    } = options;

    // Validate claim data
    const validation = await this.validateClaimData(claimData, claimType);
    if (!validation.valid) {
      throw new Error(`Claim validation failed: ${validation.errors.join(', ')}`);
    }

    if (validateOnly) {
      return { valid: true, validationResults: validation };
    }

    // Generate claim number
    const claimNumber = await this.generateClaimNumber(context.practiceId);

    // Get patient and insurance information
    const patient = await SecureDataAccess.findById('patients', claimData.patientId, context);
    const insurance = await this.getInsuranceForClaim(claimData.patientId, claimData.serviceDate, context);
    const provider = await SecureDataAccess.findById('providers', claimData.providerId, context);
    const practice = await SecureDataAccess.findById('practices', context.practiceId, context);

    // Build comprehensive claim record
    const claim = {
      claimNumber,
      claimType,
      patientId: claimData.patientId,
      providerId: claimData.providerId,
      practiceId: context.practiceId,
      
      // Patient information
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        middleInitial: patient.middleInitial,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        ssn: patient.ssn,
        address: patient.address,
        city: patient.city,
        state: patient.state,
        zipCode: patient.zipCode,
        phone: patient.phone
      },
      
      // Insurance information
      insurance: {
        primary: {
          company: insurance.primary.company,
          payerId: insurance.primary.payerId,
          planName: insurance.primary.planName,
          memberId: insurance.primary.memberId,
          groupNumber: insurance.primary.groupNumber,
          relationshipCode: insurance.primary.relationshipCode
        },
        secondary: insurance.secondary || null
      },
      
      // Provider information
      provider: {
        name: provider.name,
        npi: provider.npi,
        taxonomyCode: provider.taxonomyCode,
        licenseNumber: provider.licenseNumber,
        address: provider.address,
        city: provider.city,
        state: provider.state,
        zipCode: provider.zipCode,
        phone: provider.phone
      },
      
      // Facility information
      facility: {
        name: practice.name,
        npi: practice.npi,
        taxId: practice.taxId,
        address: practice.address,
        city: practice.city,
        state: practice.state,
        zipCode: practice.zipCode,
        phone: practice.phone
      },
      
      // Service information
      services: await this.processServiceLines(claimData.services, context),
      
      // Claim details
      serviceDate: claimData.serviceDate,
      admissionDate: claimData.admissionDate,
      dischargeDate: claimData.dischargeDate,
      authorizationNumber: claimData.authorizationNumber,
      referralNumber: claimData.referralNumber,
      
      // Diagnosis information
      primaryDiagnosis: claimData.primaryDiagnosis,
      secondaryDiagnoses: claimData.secondaryDiagnoses || [],
      
      // Billing information
      totalCharges: 0, // Will be calculated
      totalUnits: 0,
      placeOfService: claimData.placeOfService,
      typeOfBill: claimData.typeOfBill,
      
      // Status tracking
      status: 'created',
      submissionDate: null,
      acknowledgmentDate: null,
      paidDate: null,
      
      // Administrative
      createdBy: context.userId,
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    // Calculate totals
    claim.totalCharges = claim.services.reduce((total, service) => total + service.totalCharges, 0);
    claim.totalUnits = claim.services.reduce((total, service) => total + service.units, 0);

    // Apply billing rules and adjustments
    await this.applyBillingRules(claim, context);

    // Create claim record
    const claimRecord = await SecureDataAccess.create('claims', claim, context);

    if (generateOnly) {
      return { claim: claimRecord, generated: true };
    }

    // Generate claim file based on type and submission method
    const claimFile = await this.generateClaimFile(claimRecord, claimType, electronicSubmission);

    // Submit claim if requested
    let submissionResult = null;
    if (submitImmediately && !testMode) {
      submissionResult = await this.submitClaimToPayer(claimRecord, claimFile, context);
      
      // Update claim status
      await SecureDataAccess.update('claims', claimRecord._id, {
        status: 'submitted',
        submissionDate: new Date(),
        submissionMethod: submissionResult.method,
        confirmationNumber: submissionResult.confirmationNumber,
        lastUpdated: new Date()
      }, context);
    }

    // Create claim history entry
    await this.createClaimHistoryEntry(
      claimRecord._id,
      submitImmediately ? 'submitted' : 'created',
      submissionResult ? `Claim submitted via ${submissionResult.method}` : 'Claim created and ready for submission',
      context
    );

    // Create audit log
    await AuditLog.create({
      action: 'SUBMIT_INSURANCE_CLAIM',
      userId: context.userId,
      patientId: claimData.patientId,
      practiceId: context.practiceId,
      severity: 'medium',
      details: {
        claimId: claimRecord._id,
        claimNumber,
        claimType,
        totalCharges: claim.totalCharges,
        serviceCount: claim.services.length,
        submitted: submitImmediately,
        payerId: insurance.primary.payerId
      },
      timestamp: new Date()
    });

    return {
      success: true,
      claim: claimRecord,
      claimFile,
      submissionResult,
      message: submitImmediately ? 'Claim submitted successfully' : 'Claim created and ready for submission'
    };
  }

  async validateClaimData(claimData, claimType) {
    const errors = [];
    const warnings = [];

    // Required fields validation
    if (!claimData.patientId) errors.push('Patient ID is required');
    if (!claimData.providerId) errors.push('Provider ID is required');
    if (!claimData.serviceDate) errors.push('Service date is required');
    if (!claimData.services || claimData.services.length === 0) {
      errors.push('At least one service line is required');
    }

    // Diagnosis validation
    if (!claimData.primaryDiagnosis || !claimData.primaryDiagnosis.code) {
      errors.push('Primary diagnosis is required');
    }

    if (claimData.primaryDiagnosis && !this.isValidDiagnosisCode(claimData.primaryDiagnosis.code)) {
      errors.push('Primary diagnosis code is invalid');
    }

    // Service validation
    if (claimData.services) {
      for (let i = 0; i < claimData.services.length; i++) {
        const service = claimData.services[i];
        const serviceErrors = await this.validateServiceLine(service, i + 1);
        errors.push(...serviceErrors.errors);
        warnings.push(...serviceErrors.warnings);
      }
    }

    // Date validations
    if (claimData.serviceDate && new Date(claimData.serviceDate) > new Date()) {
      errors.push('Service date cannot be in the future');
    }

    if (claimData.serviceDate && this.isDateTooOld(claimData.serviceDate)) {
      warnings.push('Service date is more than 1 year old - may be rejected');
    }

    // Authorization validation
    if (claimData.authorizationNumber && !await this.validateAuthorization(claimData.authorizationNumber)) {
      warnings.push('Authorization number could not be verified');
    }

    // Duplicate claim check
    const duplicateCheck = await this.checkForDuplicateClaim(claimData);
    if (duplicateCheck.isDuplicate) {
      errors.push(`Potential duplicate claim detected: ${duplicateCheck.existingClaimNumber}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      duplicateCheck
    };
  }

  async validateServiceLine(service, lineNumber) {
    const errors = [];
    const warnings = [];

    if (!service.procedureCode) {
      errors.push(`Line ${lineNumber}: Procedure code is required`);
    } else if (!this.isValidProcedureCode(service.procedureCode)) {
      errors.push(`Line ${lineNumber}: Invalid procedure code ${service.procedureCode}`);
    }

    if (!service.charges || service.charges <= 0) {
      errors.push(`Line ${lineNumber}: Valid charge amount is required`);
    }

    if (!service.units || service.units <= 0) {
      errors.push(`Line ${lineNumber}: Valid unit count is required`);
    }

    // Check for modifiers
    if (service.modifiers) {
      for (const modifier of service.modifiers) {
        if (!this.isValidModifier(modifier)) {
          warnings.push(`Line ${lineNumber}: Modifier ${modifier} may be invalid`);
        }
      }
    }

    // Check procedure-diagnosis matching
    if (service.diagnosisPointers && service.diagnosisPointers.length > 0) {
      // Validate diagnosis pointers are valid
      for (const pointer of service.diagnosisPointers) {
        if (pointer < 1 || pointer > 12) {
          errors.push(`Line ${lineNumber}: Invalid diagnosis pointer ${pointer}`);
        }
      }
    } else {
      warnings.push(`Line ${lineNumber}: No diagnosis pointers specified`);
    }

    return { errors, warnings };
  }

  async processServiceLines(services, context) {
    const processedServices = [];

    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      
      // Get procedure code details
      const procedureDetails = await this.getProcedureDetails(service.procedureCode);
      
      // Calculate charges based on fee schedule
      const calculatedCharges = await this.calculateCharges(
        service.procedureCode,
        service.units,
        context.practiceId
      );

      const processedService = {
        lineNumber: i + 1,
        procedureCode: service.procedureCode,
        procedureDescription: procedureDetails.description,
        modifiers: service.modifiers || [],
        diagnosisPointers: service.diagnosisPointers || [1],
        serviceDate: service.serviceDate || service.serviceDate,
        placeOfService: service.placeOfService || '11', // Office
        units: service.units || 1,
        charges: service.charges || calculatedCharges.amount,
        totalCharges: (service.charges || calculatedCharges.amount) * (service.units || 1),
        
        // Additional details
        nationalDrugCode: service.nationalDrugCode,
        drugQuantity: service.drugQuantity,
        renderingProvider: service.renderingProvider,
        
        // Revenue information (for institutional claims)
        revenueCode: service.revenueCode,
        rateType: service.rateType
      };

      processedServices.push(processedService);
    }

    return processedServices;
  }

  async generateClaimFile(claim, claimType, electronic) {
    if (electronic) {
      // Generate electronic claim format
      switch (claimType) {
        case 'professional':
          return await this.generateX12_837P(claim);
        case 'institutional':
          return await this.generateX12_837I(claim);
        case 'dental':
          return await this.generateX12_837D(claim);
        default:
          throw new Error(`Unsupported electronic claim type: ${claimType}`);
      }
    } else {
      // Generate paper claim format
      switch (claimType) {
        case 'professional':
          return await this.generateCMS1500(claim);
        case 'institutional':
          return await this.generateUB04(claim);
        default:
          throw new Error(`Unsupported paper claim type: ${claimType}`);
      }
    }
  }

  async generateX12_837P(claim) {
    // Generate X12 837P (Professional) claim
    const transactionId = this.generateTransactionId();
    const batchId = this.generateBatchId();
    
    const segments = [
      // ISA - Interchange Control Header
      `ISA*00*${' '.repeat(10)}*00*${' '.repeat(10)}*ZZ*${claim.facility.npi.padEnd(15)}*ZZ*${claim.insurance.primary.payerId.padEnd(15)}*${this.formatISADate()}*${this.formatISATime()}*^*00501*${transactionId}*1*T*:~`,
      
      // GS - Functional Group Header
      `GS*HC*${claim.facility.npi}*${claim.insurance.primary.payerId}*${this.formatGSDate()}*${this.formatGSTime()}*${batchId}*X*005010X222A1~`,
      
      // ST - Transaction Set Header
      `ST*837*${transactionId}*005010X222A1~`,
      
      // BHT - Beginning of Hierarchical Transaction
      `BHT*0019*00*${transactionId}*${this.formatBHTDate()}*${this.formatBHTTime()}*CH~`,
      
      // REF - Transmission Type Identification
      `REF*87*${claim.claimType === 'original' ? '05' : '77'}~`,
      
      // NM1 - Submitter Name
      `NM1*41*2*${claim.facility.name}*****46*${claim.facility.npi}~`,
      
      // PER - Submitter Contact Information
      `PER*IC*${claim.facility.name}*TE*${claim.facility.phone}~`,
      
      // NM1 - Receiver Name
      `NM1*40*2*${claim.insurance.primary.company}*****46*${claim.insurance.primary.payerId}~`,
      
      // HL - Billing Provider Hierarchical Level
      `HL*1**20*1~`,
      
      // PRV - Billing Provider Specialty Information
      `PRV*BI*PXC*${claim.provider.taxonomyCode}~`,
      
      // NM1 - Billing Provider Name
      `NM1*85*2*${claim.provider.name}*****XX*${claim.provider.npi}~`,
      
      // N3 - Billing Provider Address
      `N3*${claim.provider.address}~`,
      
      // N4 - Billing Provider City/State/ZIP
      `N4*${claim.provider.city}*${claim.provider.state}*${claim.provider.zipCode}~`,
      
      // REF - Billing Provider Tax Identification
      `REF*EI*${claim.facility.taxId}~`,
      
      // HL - Subscriber Hierarchical Level
      `HL*2*1*22*${claim.insurance.secondary ? '1' : '0'}~`,
      
      // SBR - Subscriber Information
      `SBR*P*${claim.insurance.primary.relationshipCode}*${claim.insurance.primary.groupNumber}**${claim.insurance.primary.planName}***CI~`,
      
      // NM1 - Subscriber Name
      `NM1*IL*1*${claim.patient.lastName}*${claim.patient.firstName}*${claim.patient.middleInitial || ''}***MI*${claim.insurance.primary.memberId}~`,
      
      // N3 - Subscriber Address
      `N3*${claim.patient.address}~`,
      
      // N4 - Subscriber City/State/ZIP
      `N4*${claim.patient.city}*${claim.patient.state}*${claim.patient.zipCode}~`,
      
      // DMG - Subscriber Demographics
      `DMG*D8*${this.formatDate(claim.patient.dateOfBirth)}*${claim.patient.gender === 'male' ? 'M' : 'F'}~`,
      
      // NM1 - Payer Name
      `NM1*PR*2*${claim.insurance.primary.company}*****PI*${claim.insurance.primary.payerId}~`
    ];

    // Add patient hierarchical level if different from subscriber
    if (claim.insurance.primary.relationshipCode !== '18') {
      segments.push(
        `HL*3*2*23*0~`,
        `PAT*${claim.insurance.primary.relationshipCode}~`,
        `NM1*QC*1*${claim.patient.lastName}*${claim.patient.firstName}*${claim.patient.middleInitial || ''}~`,
        `N3*${claim.patient.address}~`,
        `N4*${claim.patient.city}*${claim.patient.state}*${claim.patient.zipCode}~`,
        `DMG*D8*${this.formatDate(claim.patient.dateOfBirth)}*${claim.patient.gender === 'male' ? 'M' : 'F'}~`
      );
    }

    // CLM - Claim Information
    segments.push(`CLM*${claim.claimNumber}*${claim.totalCharges}***${claim.placeOfService}:B:1*Y*A*Y*I*P~`);

    // DTP - Date - Onset of Current Illness or Symptom
    if (claim.serviceDate) {
      segments.push(`DTP*431*D8*${this.formatDate(claim.serviceDate)}~`);
    }

    // REF - Authorization Number
    if (claim.authorizationNumber) {
      segments.push(`REF*G1*${claim.authorizationNumber}~`);
    }

    // HI - Health Care Diagnosis Code
    const diagnosisCodes = [claim.primaryDiagnosis.code, ...(claim.secondaryDiagnoses || []).map(d => d.code)];
    const hiSegment = diagnosisCodes.map((code, index) => 
      `${index === 0 ? 'ABK' : 'ABF'}:${code}`
    ).join(':');
    segments.push(`HI*${hiSegment}~`);

    // Add service lines
    claim.services.forEach((service, index) => {
      // LX - Service Line Number
      segments.push(`LX*${service.lineNumber}~`);
      
      // SV1 - Professional Service
      const modifiers = service.modifiers.join(':') || '';
      segments.push(`SV1*HC:${service.procedureCode}${modifiers ? ':' + modifiers : ''}*${service.totalCharges}*UN*${service.units}***${service.diagnosisPointers.join(':')}~`);
      
      // DTP - Date - Service Date
      segments.push(`DTP*472*D8*${this.formatDate(service.serviceDate)}~`);
      
      // Add NDC if present
      if (service.nationalDrugCode) {
        segments.push(`LIN**N4*${service.nationalDrugCode}~`);
        segments.push(`CTP**WH*${service.drugQuantity}~`);
      }
    });

    // SE - Transaction Set Trailer
    const segmentCount = segments.length + 1;
    segments.push(`SE*${segmentCount}*${transactionId}~`);
    
    // GE - Functional Group Trailer
    segments.push(`GE*1*${batchId}~`);
    
    // IEA - Interchange Control Trailer
    segments.push(`IEA*1*${transactionId}~`);

    return {
      type: 'x12-837p',
      format: 'electronic',
      content: segments.join(''),
      filename: `claim-837p-${claim.claimNumber}.x12`,
      transactionId,
      segmentCount
    };
  }

  async generateCMS1500(claim) {
    // Generate CMS-1500 paper form data
    const form = {
      type: 'cms-1500',
      format: 'paper',
      filename: `claim-cms1500-${claim.claimNumber}.pdf`,
      
      // Form fields (simplified - full implementation would include all fields)
      fields: {
        // Box 1: Type of Insurance
        typeOfInsurance: this.getInsuranceType(claim.insurance.primary.planName),
        
        // Box 2: Patient's Name
        patientName: `${claim.patient.lastName}, ${claim.patient.firstName} ${claim.patient.middleInitial || ''}`.trim(),
        
        // Box 3: Patient's Birth Date & Sex
        patientDOB: this.formatDate(claim.patient.dateOfBirth),
        patientSex: claim.patient.gender === 'male' ? 'M' : 'F',
        
        // Box 4: Insured's Name
        insuredName: claim.insurance.primary.relationshipCode === '18' ? 
          'SAME' : 
          `${claim.patient.lastName}, ${claim.patient.firstName}`,
        
        // Box 5: Patient's Address
        patientAddress: claim.patient.address,
        patientCity: claim.patient.city,
        patientState: claim.patient.state,
        patientZip: claim.patient.zipCode,
        
        // Box 9: Other Insured's Name
        otherInsuredName: claim.insurance.secondary ? 
          claim.insurance.secondary.subscriberName : '',
        
        // Box 11: Insured's Group Number
        groupNumber: claim.insurance.primary.groupNumber,
        
        // Box 12: Patient's or Authorized Person's Signature
        patientSignature: 'SIGNATURE ON FILE',
        patientSignatureDate: this.formatDate(claim.serviceDate),
        
        // Box 21: Diagnosis Codes
        diagnosis1: claim.primaryDiagnosis.code,
        diagnosis2: claim.secondaryDiagnoses[0]?.code || '',
        diagnosis3: claim.secondaryDiagnoses[1]?.code || '',
        diagnosis4: claim.secondaryDiagnoses[2]?.code || '',
        
        // Box 24: Service Lines
        serviceLines: claim.services.map((service, index) => ({
          dateOfService: this.formatDate(service.serviceDate),
          placeOfService: service.placeOfService,
          procedureCode: service.procedureCode,
          modifiers: service.modifiers,
          diagnosisPointer: service.diagnosisPointers.join(','),
          charges: service.totalCharges,
          units: service.units,
          renderingProvider: service.renderingProvider
        })),
        
        // Box 25: Federal Tax ID Number
        federalTaxId: claim.facility.taxId,
        
        // Box 31: Signature of Physician
        physicianSignature: claim.provider.name,
        signatureDate: this.formatDate(new Date()),
        
        // Box 32: Service Facility Location
        serviceFacilityName: claim.facility.name,
        serviceFacilityAddress: `${claim.facility.address}, ${claim.facility.city}, ${claim.facility.state} ${claim.facility.zipCode}`,
        
        // Box 33: Billing Provider
        billingProviderName: claim.provider.name,
        billingProviderNPI: claim.provider.npi,
        billingProviderAddress: `${claim.provider.address}, ${claim.provider.city}, ${claim.provider.state} ${claim.provider.zipCode}`
      }
    };

    return form;
  }

  async submitClaimToPayer(claim, claimFile, context) {
    const payer = this.claimProviders[claim.insurance.primary.payerId];
    if (!payer) {
      throw new Error(`No submission configuration for payer ${claim.insurance.primary.payerId}`);
    }

    let result;
    switch (payer.submissionType) {
      case 'edi':
        result = await this.submitEDIClaim(claimFile, payer);
        break;
      case 'clearinghouse':
        result = await this.submitClearinghouseClaim(claimFile, payer);
        break;
      case 'api':
        result = await this.submitAPIClaim(claim, payer);
        break;
      case 'portal':
        result = await this.submitPortalClaim(claim, claimFile, payer);
        break;
      default:
        throw new Error(`Unsupported submission type: ${payer.submissionType}`);
    }

    return result;
  }

  async submitEDIClaim(claimFile, payer) {
    const response = await axios.post(payer.ediEndpoint, claimFile.content, {
      headers: {
        'Content-Type': 'application/x12',
        'Authorization': `Bearer ${payer.apiKey}`,
        'X-Partner-ID': payer.partnerId
      },
      timeout: 120000 // 2 minutes for claim submission
    });

    return {
      success: true,
      method: 'edi',
      confirmationNumber: this.extractConfirmationNumber(response.data),
      submissionDate: new Date(),
      responseData: response.data
    };
  }

  async submitClearinghouseClaim(claimFile, payer) {
    const response = await axios.post(payer.endpoint, {
      claimData: claimFile.content,
      format: claimFile.type,
      payerId: payer.payerId
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${payer.apiKey}`,
        'X-Clearinghouse-ID': payer.clearinghouseId
      },
      timeout: 180000 // 3 minutes for clearinghouse
    });

    return {
      success: true,
      method: 'clearinghouse',
      confirmationNumber: response.data.confirmationNumber,
      batchId: response.data.batchId,
      submissionDate: new Date(),
      responseData: response.data
    };
  }

  async submitAPIClaim(claim, payer) {
    // Submit via payer's API (e.g., Aetna's API)
    const apiData = this.convertClaimToAPIFormat(claim, payer.apiFormat);
    
    const response = await axios.post(`${payer.endpoint}/claims`, apiData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${payer.apiKey}`,
        'X-Client-ID': payer.clientId
      },
      timeout: 90000
    });

    return {
      success: true,
      method: 'api',
      confirmationNumber: response.data.claimId || response.data.confirmationNumber,
      submissionDate: new Date(),
      responseData: response.data
    };
  }

  // Utility methods
  async generateClaimNumber(practiceId) {
    const prefix = 'CLM';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = await this.getNextClaimSequence(practiceId, date);
    return `${prefix}-${date}-${sequence.toString().padStart(6, '0')}`;
  }

  async getNextClaimSequence(practiceId, date) {
    const counter = await SecureDataAccess.findOneAndUpdate('claimcounters', 
      { practiceId, date },
      { $inc: { sequence: 1 } },
      { upsert: true, new: true }
    );
    return counter.sequence;
  }

  generateTransactionId() {
    return Math.floor(Math.random() * 1000000000).toString();
  }

  generateBatchId() {
    return Math.floor(Math.random() * 100000).toString();
  }

  formatISADate() {
    return new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
  }

  formatISATime() {
    return new Date().toISOString().slice(11, 19).replace(/:/g, ''); // HHMMSS
  }

  formatGSDate() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, ''); // CCYYMMDD
  }

  formatGSTime() {
    return new Date().toISOString().slice(11, 16).replace(/:/g, ''); // HHMM
  }

  formatBHTDate() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, ''); // CCYYMMDD
  }

  formatBHTTime() {
    return new Date().toISOString().slice(11, 19).replace(/:/g, ''); // HHMMSS
  }

  formatDate(date) {
    return new Date(date).toISOString().slice(0, 10).replace(/-/g, ''); // CCYYMMDD
  }

  isValidDiagnosisCode(code) {
    // Validate ICD-10 code format
    const icd10Pattern = /^[A-TV-Z][0-9][0-9AB]\.?[0-9A-TV-Z]{0,4}$/i;
    return icd10Pattern.test(code);
  }

  isValidProcedureCode(code) {
    // Validate CPT/HCPCS code format
    const cptPattern = /^[0-9]{5}$/;
    const hcpcsPattern = /^[A-Z][0-9]{4}$/;
    return cptPattern.test(code) || hcpcsPattern.test(code);
  }

  isValidModifier(modifier) {
    // Validate modifier format
    const modifierPattern = /^[A-Z0-9]{2}$/;
    return modifierPattern.test(modifier);
  }

  isDateTooOld(serviceDate) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return new Date(serviceDate) < oneYearAgo;
  }

  async checkForDuplicateClaim(claimData) {
    // Check for potential duplicate claims
    const existingClaim = await SecureDataAccess.findOne('claims', {
      patientId: claimData.patientId,
      serviceDate: claimData.serviceDate,
      'services.procedureCode': { $in: claimData.services.map(s => s.procedureCode) },
      status: { $nin: ['denied', 'cancelled'] }
    });

    return {
      isDuplicate: !!existingClaim,
      existingClaimNumber: existingClaim?.claimNumber
    };
  }

  async createClaimHistoryEntry(claimId, status, notes, context) {
    return await SecureDataAccess.create('claimhistory', {
      claimId,
      status,
      notes,
      createdBy: context.userId,
      createdAt: new Date()
    }, context);
  }

  async loadClaimProviders() {
    return {
      'AETNA': {
        submissionType: 'api',
        endpoint: 'https://api.aetna.com/v1/claims',
        apiKey: process.env.AETNA_API_KEY,
        clientId: process.env.AETNA_CLIENT_ID,
        apiFormat: 'aetna-json'
      },
      'BCBS': {
        submissionType: 'edi',
        ediEndpoint: 'https://edi.bcbs.com/claims',
        apiKey: process.env.BCBS_API_KEY,
        partnerId: process.env.BCBS_PARTNER_ID
      },
      'CHANGEHE': {
        submissionType: 'clearinghouse',
        endpoint: 'https://api.changehealthcare.com/claims',
        apiKey: process.env.CHANGE_HEALTHCARE_API_KEY,
        clearinghouseId: process.env.CHANGE_HEALTHCARE_ID
      }
    };
  }

  async loadBillingRules() {
    return await SecureDataAccess.query('billingrules', { active: true });
  }

  async loadFeeSchedules() {
    return await SecureDataAccess.query('feeschedules', { active: true });
  }

  async applyBillingRules(claim, context) {
    // Apply billing rules and adjustments
    // This would include contract adjustments, fee schedule lookups, etc.
    for (const service of claim.services) {
      // Apply fee schedule
      const feeSchedule = await this.getFeeScheduleAmount(service.procedureCode, context.practiceId);
      if (feeSchedule) {
        service.contractedAmount = feeSchedule.amount;
      }
    }
  }

  async getInsuranceForClaim(patientId, serviceDate, context) {
    const insurances = await SecureDataAccess.query('patientinsurance', {
      patientId,
      practiceId: context.practiceId,
      active: true,
      $or: [
        { effectiveDate: { $lte: serviceDate }, terminationDate: { $gte: serviceDate } },
        { effectiveDate: { $lte: serviceDate }, terminationDate: null }
      ]
    }, { sort: { priority: 1 } }, context);

    return {
      primary: insurances.find(i => i.priority === 1),
      secondary: insurances.find(i => i.priority === 2)
    };
  }

  async getProcedureDetails(procedureCode) {
    const procedure = await SecureDataAccess.findOne('procedurecodes', {
      code: procedureCode
    });
    
    return {
      code: procedureCode,
      description: procedure?.description || 'Unknown Procedure'
    };
  }

  async calculateCharges(procedureCode, units, practiceId) {
    const feeSchedule = await this.getFeeScheduleAmount(procedureCode, practiceId);
    return {
      amount: feeSchedule ? feeSchedule.amount : 0,
      source: feeSchedule ? 'fee-schedule' : 'default'
    };
  }

  async getFeeScheduleAmount(procedureCode, practiceId) {
    return await SecureDataAccess.findOne('feeschedules', {
      practiceId,
      procedureCode,
      active: true
    });
  }

  getInsuranceType(planName) {
    if (planName?.toUpperCase().includes('MEDICARE')) return 'MEDICARE';
    if (planName?.toUpperCase().includes('MEDICAID')) return 'MEDICAID';
    if (planName?.toUpperCase().includes('TRICARE')) return 'TRICARE';
    if (planName?.toUpperCase().includes('CHAMPUS')) return 'CHAMPUS';
    if (planName?.toUpperCase().includes('CHAMPVA')) return 'CHAMPVA';
    if (planName?.toUpperCase().includes('GROUP')) return 'GROUP_HEALTH_PLAN';
    if (planName?.toUpperCase().includes('FECA')) return 'FECA_BLK_LUNG';
    return 'OTHER';
  }

  extractConfirmationNumber(responseData) {
    // Extract confirmation number from various response formats
    if (typeof responseData === 'string') {
      // Try to extract from X12 response
      const segments = responseData.split('~');
      for (const segment of segments) {
        if (segment.startsWith('TRN*1*')) {
          return segment.split('*')[2];
        }
      }
    }
    return `CONF-${Date.now()}`;
  }

  convertClaimToAPIFormat(claim, format) {
    // Convert claim to payer-specific API format
    switch (format) {
      case 'aetna-json':
        return this.convertToAetnaFormat(claim);
      default:
        return claim;
    }
  }

  convertToAetnaFormat(claim) {
    // Convert to Aetna's API format
    return {
      claimNumber: claim.claimNumber,
      patient: claim.patient,
      provider: claim.provider,
      services: claim.services,
      diagnosis: {
        primary: claim.primaryDiagnosis,
        secondary: claim.secondaryDiagnoses
      },
      insurance: claim.insurance.primary
    };
  }

  async validateAuthorization(authorizationNumber) {
    // Validate authorization number
    const authorization = await SecureDataAccess.findOne('authorizations', {
      authorizationNumber,
      status: 'approved'
    });
    return !!authorization;
  }
}

module.exports = new ClaimsSubmissionService();
```

### 2. Create Claims Submission API Endpoints
```javascript
// backend/routes/claims.js

// Submit insurance claim
router.post('/api/claims/submit', authenticate, authorize(['provider', 'billing-specialist']), async (req, res) => {
  try {
    const claimData = req.body;
    const {
      submitImmediately = true,
      validateOnly = false,
      generateOnly = false,
      claimType = 'professional',
      electronicSubmission = true,
      testMode = false
    } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await claimsSubmissionService.submitClaim(claimData, {
      submitImmediately: submitImmediately === 'true',
      validateOnly: validateOnly === 'true',
      generateOnly: generateOnly === 'true',
      claimType,
      electronicSubmission: electronicSubmission === 'true',
      testMode: testMode === 'true'
    }, context);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Validate claim data
router.post('/api/claims/validate', authenticate, authorize(['provider', 'billing-specialist']), async (req, res) => {
  try {
    const { claimData, claimType = 'professional' } = req.body;

    const validation = await claimsSubmissionService.validateClaimData(claimData, claimType);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Error validating claim:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get claim details
router.get('/api/claims/:claimId', authenticate, authorize(['provider', 'billing-specialist']), async (req, res) => {
  try {
    const { claimId } = req.params;
    const { includeHistory = 'true' } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const claim = await SecureDataAccess.findById('claims', claimId, context);
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    if (includeHistory === 'true') {
      claim.history = await SecureDataAccess.query('claimhistory', {
        claimId,
        practiceId: context.practiceId
      }, { sort: { createdAt: -1 } }, context);
    }

    res.json({
      success: true,
      data: claim
    });
  } catch (error) {
    console.error('Error retrieving claim:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve claim'
    });
  }
});

// Get claims by status
router.get('/api/claims/by-status/:status', authenticate, authorize(['provider', 'billing-specialist']), async (req, res) => {
  try {
    const { status } = req.params;
    const { limit = 50, offset = 0, startDate, endDate } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const query = {
      status,
      practiceId: context.practiceId
    };

    if (startDate || endDate) {
      query.serviceDate = {};
      if (startDate) query.serviceDate.$gte = new Date(startDate);
      if (endDate) query.serviceDate.$lte = new Date(endDate);
    }

    const claims = await SecureDataAccess.query('claims', query, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort: { lastUpdated: -1 }
    }, context);

    res.json({
      success: true,
      data: claims,
      count: claims.length,
      status
    });
  } catch (error) {
    console.error('Error retrieving claims by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve claims'
    });
  }
});
```

## Required Endpoints

### POST /api/claims/submit
**Description**: Submit insurance claim
**Access**: Providers, Billing Specialists
**Query Parameters**:
- `submitImmediately` (boolean): Submit immediately vs save as draft
- `validateOnly` (boolean): Only validate, don't create claim
- `generateOnly` (boolean): Generate claim file but don't submit
- `claimType` (string): professional, institutional, dental
- `electronicSubmission` (boolean): Electronic vs paper format
- `testMode` (boolean): Test mode submission

**Request Body**:
```json
{
  "patientId": "60d5eca7f1b2c8b1d8e4f89a",
  "providerId": "60d5eca7f1b2c8b1d8e4f89b",
  "serviceDate": "2024-12-15",
  "placeOfService": "11",
  "primaryDiagnosis": {
    "code": "M54.5",
    "description": "Low back pain"
  },
  "secondaryDiagnoses": [
    {
      "code": "Z87.891",
      "description": "Personal history of nicotine dependence"
    }
  ],
  "authorizationNumber": "AUTH12345",
  "services": [
    {
      "procedureCode": "99213",
      "charges": 150.00,
      "units": 1,
      "modifiers": [],
      "diagnosisPointers": [1],
      "serviceDate": "2024-12-15",
      "placeOfService": "11"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "claim": {
      "claimNumber": "CLM-20241219-000001",
      "status": "submitted",
      "totalCharges": 150.00,
      "submissionDate": "2024-12-19T10:30:00Z",
      "confirmationNumber": "CONF123456"
    },
    "claimFile": {
      "type": "x12-837p",
      "format": "electronic",
      "transactionId": "123456789"
    },
    "submissionResult": {
      "method": "edi",
      "confirmationNumber": "CONF123456",
      "submissionDate": "2024-12-19T10:30:00Z"
    }
  }
}
```

### POST /api/claims/validate
**Description**: Validate claim data without submission
**Access**: Providers, Billing Specialists

### GET /api/claims/:claimId
**Description**: Get claim details with optional history
**Access**: Providers, Billing Specialists

### GET /api/claims/by-status/:status
**Description**: Get claims by status with optional date filtering
**Access**: Providers, Billing Specialists

## Data Models Required

### Claims Collection
```javascript
{
  claimNumber: String,
  claimType: String, // professional, institutional, dental
  patientId: ObjectId,
  providerId: ObjectId,
  practiceId: String,
  
  // Patient information
  patient: Object,
  
  // Insurance information  
  insurance: {
    primary: Object,
    secondary: Object
  },
  
  // Provider and facility information
  provider: Object,
  facility: Object,
  
  // Service information
  services: [Object],
  
  // Diagnosis information
  primaryDiagnosis: Object,
  secondaryDiagnoses: [Object],
  
  // Service details
  serviceDate: Date,
  admissionDate: Date,
  dischargeDate: Date,
  authorizationNumber: String,
  referralNumber: String,
  
  // Billing information
  totalCharges: Number,
  totalUnits: Number,
  placeOfService: String,
  typeOfBill: String,
  
  // Status tracking
  status: String, // created, submitted, accepted, rejected, paid, denied
  submissionDate: Date,
  submissionMethod: String,
  confirmationNumber: String,
  acknowledgmentDate: Date,
  paidDate: Date,
  
  // Administrative
  createdBy: ObjectId,
  createdAt: Date,
  lastUpdated: Date
}
```

### ClaimHistory Collection
```javascript
{
  claimId: ObjectId,
  status: String,
  notes: String,
  createdBy: ObjectId,
  createdAt: Date
}
```

### ClaimCounters Collection
```javascript
{
  practiceId: String,
  date: String, // YYYYMMDD format
  sequence: Number
}
```

## Test Cases

### 1. Basic Claim Submission
- Submit professional claim with single service
- Verify claim number generated
- Check X12 837P format generated correctly
- Verify submission to payer

### 2. Claim Validation
- Test all required field validation
- Test diagnosis code validation
- Test procedure code validation
- Test duplicate claim detection

### 3. Multiple Service Lines
- Claim with multiple procedures
- Different service dates
- Various modifiers and diagnosis pointers
- Verify total calculations

### 4. Institutional Claims
- Generate X12 837I format
- UB-04 paper format
- Revenue codes and room/board
- DRG codes if applicable

### 5. Secondary Insurance
- Claims with COB
- Proper sequence of submission
- Secondary claim generation

### 6. Electronic vs Paper
- X12 electronic formats
- CMS-1500 paper format
- PDF generation
- Print-ready formatting

### 7. Error Handling
- Invalid diagnosis codes
- Missing required fields
- Submission failures
- Network timeouts

### 8. Integration Testing
- Real payer API connections
- Clearinghouse submissions
- Acknowledgment processing
- Status tracking

## Dependencies
- SecureDataAccess service
- Insurance payer APIs
- X12 processing libraries
- Clearinghouse connections
- PDF generation libraries
- Fee schedule databases
- Procedure code databases
- AuditLog for compliance

## Success Criteria
- [ ] Professional claim generation (837P)
- [ ] Institutional claim generation (837I)
- [ ] Dental claim generation (837D)
- [ ] CMS-1500 paper format generation
- [ ] UB-04 paper format generation
- [ ] Real-time claim validation
- [ ] Multiple submission methods
- [ ] Duplicate claim detection
- [ ] Complete audit trail
- [ ] Status tracking system
- [ ] Fee schedule integration
- [ ] Authorization validation
- [ ] Multi-payer support

## Notes
- Consider implementing ANSI X12 5010 standard compliance
- May need integration with practice management systems
- Future enhancement: real-time adjudication
- Consider adding claim scrubbing services
- May need integration with revenue cycle management
- Consider adding predictive claim denial analysis