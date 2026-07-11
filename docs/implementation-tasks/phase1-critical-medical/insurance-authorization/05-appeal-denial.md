# Appeal Denial

## Function Details
- **Name**: appealDenial
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 5 hours

## Problem Description
When insurance authorizations are denied, healthcare providers need a systematic process to submit appeals with supporting documentation. The system must track appeal deadlines, manage required documentation, handle multiple appeal levels, and automate follow-up processes while maintaining compliance with insurance regulations.

## Implementation Steps

### 1. Create Appeal Management Service
```javascript
// backend/services/appealManagementService.js

const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const axios = require('axios');

class AppealManagementService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('appeal-management-service');
    this.appealTypes = await this.loadAppealTypes();
    this.providerAppeals = await this.loadProviderAppealAPIs();
    this.documentTemplates = await this.loadDocumentTemplates();
  }

  async submitAppeal(authorizationId, appealData, context) {
    const {
      appealLevel = 1,
      appealType = 'medical-necessity',
      appealReason,
      supportingDocuments = [],
      additionalInformation,
      urgentAppeal = false,
      requestedProvider = null,
      clinicalJustification,
      priorTreatmentHistory,
      alternativesTried
    } = appealData;

    // Get original authorization
    const authorization = await SecureDataAccess.findById('authorizations', authorizationId, context);
    if (!authorization) {
      throw new Error('Original authorization not found');
    }

    // Verify authorization is denied
    if (authorization.status !== 'denied') {
      throw new Error('Can only appeal denied authorizations');
    }

    // Check appeal deadline
    const appealDeadline = this.calculateAppealDeadline(authorization.denialDate, authorization.payerId);
    if (new Date() > appealDeadline) {
      throw new Error(`Appeal deadline has passed (was ${appealDeadline.toLocaleDateString()})`);
    }

    // Validate appeal data
    await this.validateAppealData(appealData, authorization);

    // Generate appeal number
    const appealNumber = await this.generateAppealNumber(authorization.practiceId);

    // Create appeal record
    const appeal = {
      appealNumber,
      authorizationId,
      patientId: authorization.patientId,
      practiceId: context.practiceId,
      payerId: authorization.payerId,
      insuranceCompany: authorization.insuranceCompany,
      
      // Appeal details
      appealLevel,
      appealType,
      appealReason,
      clinicalJustification,
      priorTreatmentHistory,
      alternativesTried,
      additionalInformation,
      urgentAppeal,
      
      // Original service details
      originalServiceCode: authorization.serviceCode,
      originalServiceDate: authorization.serviceDate,
      originalDenialReason: authorization.denialReason,
      originalDenialDate: authorization.denialDate,
      
      // Provider information
      submittingProvider: requestedProvider || authorization.providerId,
      submittingProviderNPI: authorization.providerNPI,
      
      // Status tracking
      status: 'preparing',
      submittedDate: null,
      responseDate: null,
      appealDeadline,
      
      // Administrative
      submittedBy: context.userId,
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    // Create appeal record
    const appealRecord = await SecureDataAccess.create('appeals', appeal, context);

    // Process supporting documents
    if (supportingDocuments.length > 0) {
      await this.processSupportingDocuments(appealRecord._id, supportingDocuments, context);
    }

    // Generate required appeal documentation
    const appealPacket = await this.generateAppealPacket(appealRecord, authorization, context);

    // Submit to insurance if auto-submit is enabled
    if (this.shouldAutoSubmit(authorization.payerId, urgentAppeal)) {
      try {
        await this.submitAppealToInsurance(appealRecord, appealPacket, context);
      } catch (error) {
        console.warn('Auto-submission failed, manual submission required:', error.message);
        // Continue - appeal is still created for manual submission
      }
    }

    // Create appeal timeline entry
    await this.createAppealHistoryEntry(appealRecord._id, 'created', 'Appeal created and documentation prepared', context);

    // Update original authorization status
    await SecureDataAccess.update('authorizations', authorizationId, {
      status: 'appealed',
      appealId: appealRecord._id,
      lastUpdated: new Date()
    }, context);

    // Schedule follow-up reminders
    await this.scheduleAppealFollowUps(appealRecord, context);

    // Create audit log
    await AuditLog.create({
      action: 'SUBMIT_AUTHORIZATION_APPEAL',
      userId: context.userId,
      patientId: authorization.patientId,
      practiceId: context.practiceId,
      severity: urgentAppeal ? 'high' : 'medium',
      details: {
        appealId: appealRecord._id,
        appealNumber,
        authorizationId,
        appealLevel,
        appealType,
        urgentAppeal
      },
      timestamp: new Date()
    });

    return {
      success: true,
      appeal: appealRecord,
      appealPacket,
      message: this.shouldAutoSubmit(authorization.payerId, urgentAppeal) ?
        'Appeal submitted automatically to insurance' :
        'Appeal prepared for manual submission'
    };
  }

  async validateAppealData(appealData, authorization) {
    const errors = [];

    // Required fields
    if (!appealData.appealReason || appealData.appealReason.trim().length < 20) {
      errors.push('Appeal reason must be at least 20 characters');
    }

    if (!appealData.clinicalJustification || appealData.clinicalJustification.trim().length < 50) {
      errors.push('Clinical justification must be at least 50 characters');
    }

    // Validate appeal type
    const validAppealTypes = ['medical-necessity', 'experimental-treatment', 'network-issue', 'coverage-dispute', 'administrative-error'];
    if (!validAppealTypes.includes(appealData.appealType)) {
      errors.push('Invalid appeal type');
    }

    // Check if this is a subsequent appeal
    const existingAppeals = await SecureDataAccess.query('appeals', {
      authorizationId: authorization._id,
      status: { $nin: ['withdrawn', 'expired'] }
    });

    if (existingAppeals.length > 0 && appealData.appealLevel <= Math.max(...existingAppeals.map(a => a.appealLevel))) {
      errors.push('Appeal level must be higher than existing appeals');
    }

    if (errors.length > 0) {
      throw new Error(`Appeal validation failed: ${errors.join(', ')}`);
    }
  }

  async generateAppealPacket(appeal, authorization, context) {
    const packet = {
      coverLetter: null,
      clinicalDocumentation: [],
      supportingEvidence: [],
      priorAuthorizationHistory: [],
      appealForm: null
    };

    // Generate cover letter
    packet.coverLetter = await this.generateAppealCoverLetter(appeal, authorization, context);

    // Generate appeal form based on insurance requirements
    const providerRequirements = this.providerAppeals[authorization.payerId];
    if (providerRequirements?.appealForm) {
      packet.appealForm = await this.generateAppealForm(appeal, authorization, providerRequirements);
    }

    // Gather clinical documentation
    packet.clinicalDocumentation = await this.gatherClinicalDocumentation(authorization.patientId, authorization.serviceDate, context);

    // Include prior authorization history
    packet.priorAuthorizationHistory = await this.getPriorAuthorizationHistory(authorization.patientId, authorization.serviceCode, context);

    // Add supporting evidence
    packet.supportingEvidence = await this.gatherSupportingEvidence(appeal, context);

    return packet;
  }

  async generateAppealCoverLetter(appeal, authorization, context) {
    const patient = await SecureDataAccess.findById('patients', authorization.patientId, context);
    const provider = await SecureDataAccess.findById('providers', appeal.submittingProvider, context);
    const practice = await SecureDataAccess.findById('practices', context.practiceId, context);

    const letterTemplate = this.documentTemplates.appealCoverLetter;
    
    const letterContent = letterTemplate.replace(/\{(\w+)\}/g, (match, key) => {
      const replacements = {
        date: new Date().toLocaleDateString(),
        insuranceCompany: authorization.insuranceCompany,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientDOB: new Date(patient.dateOfBirth).toLocaleDateString(),
        memberId: authorization.memberId,
        authorizationNumber: authorization.authorizationNumber,
        serviceCode: authorization.originalServiceCode,
        serviceDate: new Date(authorization.serviceDate).toLocaleDateString(),
        denialReason: authorization.denialReason,
        appealReason: appeal.appealReason,
        clinicalJustification: appeal.clinicalJustification,
        providerName: provider.name,
        providerNPI: provider.npi,
        practiceName: practice.name,
        clinicAddress: `${practice.address}, ${practice.city}, ${practice.state} ${practice.zip}`,
        clinicPhone: practice.phone,
        appealNumber: appeal.appealNumber,
        appealLevel: appeal.appealLevel,
        urgentStatus: appeal.urgentAppeal ? 'URGENT APPEAL' : 'Standard Appeal'
      };
      
      return replacements[key] || match;
    });

    return {
      type: 'cover-letter',
      content: letterContent,
      filename: `appeal-cover-letter-${appeal.appealNumber}.pdf`,
      template: 'appeal-cover-letter'
    };
  }

  async generateAppealForm(appeal, authorization, providerRequirements) {
    // Generate insurance-specific appeal form
    const formData = {
      // Patient information
      patientName: authorization.patientName,
      patientDOB: authorization.patientDOB,
      memberId: authorization.memberId,
      
      // Provider information
      providerName: authorization.providerName,
      providerNPI: authorization.providerNPI,
      
      // Service information
      serviceCode: authorization.serviceCode,
      serviceDate: authorization.serviceDate,
      
      // Appeal information
      appealReason: appeal.appealReason,
      clinicalJustification: appeal.clinicalJustification,
      urgentAppeal: appeal.urgentAppeal,
      
      // Original denial
      originalAuthNumber: authorization.authorizationNumber,
      denialDate: authorization.denialDate,
      denialReason: authorization.denialReason
    };

    const formContent = await this.fillAppealForm(providerRequirements.appealForm, formData);

    return {
      type: 'appeal-form',
      content: formContent,
      filename: `appeal-form-${appeal.appealNumber}.pdf`,
      formType: providerRequirements.appealForm.type
    };
  }

  async gatherClinicalDocumentation(patientId, serviceDate, context) {
    const docs = [];
    
    // Get relevant clinical notes
    const clinicalNotes = await SecureDataAccess.query('clinicalnotes', {
      patientId,
      practiceId: context.practiceId,
      noteDate: {
        $gte: new Date(serviceDate.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days before
        $lte: new Date(serviceDate.getTime() + 30 * 24 * 60 * 60 * 1000)  // 30 days after
      }
    }, { sort: { noteDate: -1 } }, context);

    docs.push(...clinicalNotes.map(note => ({
      type: 'clinical-note',
      date: note.noteDate,
      description: note.noteType || 'Clinical Note',
      content: note.content,
      provider: note.providerId
    })));

    // Get diagnostic results
    const diagnosticResults = await SecureDataAccess.query('diagnosticresults', {
      patientId,
      practiceId: context.practiceId,
      resultDate: {
        $gte: new Date(serviceDate.getTime() - 180 * 24 * 60 * 60 * 1000), // 6 months before
        $lte: serviceDate
      }
    }, { sort: { resultDate: -1 } }, context);

    docs.push(...diagnosticResults.map(result => ({
      type: 'diagnostic-result',
      date: result.resultDate,
      description: `${result.testType} - ${result.testName}`,
      result: result.result,
      interpretation: result.interpretation
    })));

    // Get treatment history
    const treatments = await SecureDataAccess.query('treatments', {
      patientId,
      practiceId: context.practiceId,
      treatmentDate: {
        $gte: new Date(serviceDate.getTime() - 365 * 24 * 60 * 60 * 1000), // 1 year before
        $lte: serviceDate
      }
    }, { sort: { treatmentDate: -1 } }, context);

    docs.push(...treatments.map(treatment => ({
      type: 'treatment-record',
      date: treatment.treatmentDate,
      description: treatment.treatmentType,
      outcome: treatment.outcome,
      provider: treatment.providerId
    })));

    return docs;
  }

  async getPriorAuthorizationHistory(patientId, serviceCode, context) {
    // Get prior authorizations for similar services
    const priorAuths = await SecureDataAccess.query('authorizations', {
      patientId,
      practiceId: context.practiceId,
      serviceCode,
      submittedDate: {
        $gte: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) // 2 years
      }
    }, { sort: { submittedDate: -1 } }, context);

    return priorAuths.map(auth => ({
      authorizationNumber: auth.authorizationNumber,
      serviceDate: auth.serviceDate,
      status: auth.status,
      approvedUnits: auth.approvedUnits,
      usedUnits: auth.usedUnits,
      expirationDate: auth.expirationDate
    }));
  }

  async gatherSupportingEvidence(appeal, context) {
    const evidence = [];

    // Get peer-reviewed literature if available
    if (appeal.appealType === 'medical-necessity') {
      const literature = await this.searchMedicalLiterature(appeal.originalServiceCode);
      evidence.push(...literature);
    }

    // Get clinical guidelines
    const guidelines = await this.getClinicalGuidelines(appeal.originalServiceCode);
    evidence.push(...guidelines);

    // Get similar case outcomes
    const similarCases = await this.getSimilarApprovalCases(appeal, context);
    evidence.push(...similarCases);

    return evidence;
  }

  async submitAppealToInsurance(appeal, appealPacket, context) {
    const providerAPI = this.providerAppeals[appeal.payerId];
    if (!providerAPI) {
      throw new Error('No API configuration for this insurance provider');
    }

    let submissionResult;

    switch (providerAPI.type) {
      case 'x12-275':
        submissionResult = await this.submitX12Appeal(appeal, appealPacket, providerAPI);
        break;
      case 'rest-api':
        submissionResult = await this.submitRESTAppeal(appeal, appealPacket, providerAPI);
        break;
      case 'email':
        submissionResult = await this.submitEmailAppeal(appeal, appealPacket, providerAPI);
        break;
      case 'portal-upload':
        submissionResult = await this.submitPortalAppeal(appeal, appealPacket, providerAPI);
        break;
      default:
        throw new Error(`Unsupported submission type: ${providerAPI.type}`);
    }

    // Update appeal status
    await SecureDataAccess.update('appeals', appeal._id, {
      status: 'submitted',
      submittedDate: new Date(),
      submissionMethod: providerAPI.type,
      confirmationNumber: submissionResult.confirmationNumber,
      lastUpdated: new Date()
    }, context);

    // Create history entry
    await this.createAppealHistoryEntry(
      appeal._id,
      'submitted',
      `Appeal submitted via ${providerAPI.type}. Confirmation: ${submissionResult.confirmationNumber}`,
      context
    );

    return submissionResult;
  }

  async submitX12Appeal(appeal, appealPacket, providerAPI) {
    // Generate X12 275 additional information message
    const x12Message = this.generateX12_275(appeal, appealPacket, providerAPI);
    
    const response = await axios.post(providerAPI.endpoint, x12Message, {
      headers: {
        'Content-Type': 'application/x12',
        'Authorization': `Bearer ${providerAPI.apiKey}`
      },
      timeout: 60000
    });

    return {
      success: true,
      confirmationNumber: this.extractX12ConfirmationNumber(response.data),
      submissionDate: new Date(),
      method: 'x12-275'
    };
  }

  async submitRESTAppeal(appeal, appealPacket, providerAPI) {
    const appealData = {
      originalAuthorizationNumber: appeal.authorizationId,
      appealNumber: appeal.appealNumber,
      appealLevel: appeal.appealLevel,
      appealReason: appeal.appealReason,
      clinicalJustification: appeal.clinicalJustification,
      urgentAppeal: appeal.urgentAppeal,
      supportingDocuments: appealPacket.supportingEvidence
    };

    const response = await axios.post(`${providerAPI.endpoint}/appeals`, appealData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerAPI.apiKey}`,
        'X-Client-ID': providerAPI.clientId
      },
      timeout: 60000
    });

    return {
      success: true,
      confirmationNumber: response.data.confirmationNumber || response.data.appealId,
      submissionDate: new Date(),
      method: 'rest-api'
    };
  }

  async submitEmailAppeal(appeal, appealPacket, providerAPI) {
    const emailService = require('./emailService');
    
    // Prepare email content
    const emailContent = {
      to: providerAPI.appealEmail,
      subject: `Appeal Submission - ${appeal.appealNumber} - ${appeal.urgentAppeal ? 'URGENT' : 'Standard'}`,
      body: appealPacket.coverLetter.content,
      attachments: [
        appealPacket.coverLetter,
        appealPacket.appealForm,
        ...appealPacket.clinicalDocumentation.slice(0, 10) // Limit attachments
      ]
    };

    const result = await emailService.sendAppealEmail(emailContent);

    return {
      success: true,
      confirmationNumber: result.messageId,
      submissionDate: new Date(),
      method: 'email'
    };
  }

  async submitPortalAppeal(appeal, appealPacket, providerAPI) {
    const portalService = require('./portalSubmissionService');
    
    const result = await portalService.submitAppeal(
      providerAPI.portalUrl,
      providerAPI.credentials,
      appeal,
      appealPacket
    );

    return {
      success: true,
      confirmationNumber: result.confirmationNumber,
      submissionDate: new Date(),
      method: 'portal-upload'
    };
  }

  async updateAppealStatus(appealId, statusData, context) {
    const {
      status,
      responseDate = null,
      responseDetails = null,
      nextSteps = null
    } = statusData;

    // Update appeal record
    await SecureDataAccess.update('appeals', appealId, {
      status,
      responseDate,
      responseDetails,
      nextSteps,
      lastUpdated: new Date()
    }, context);

    // Create history entry
    await this.createAppealHistoryEntry(
      appealId,
      status,
      responseDetails || `Status updated to ${status}`,
      context
    );

    // Handle status-specific actions
    if (status === 'approved') {
      await this.handleAppealApproval(appealId, context);
    } else if (status === 'denied') {
      await this.handleAppealDenial(appealId, context);
    }

    // Send notifications
    await this.sendStatusNotification(appealId, status, context);
  }

  async handleAppealApproval(appealId, context) {
    const appeal = await SecureDataAccess.findById('appeals', appealId, context);
    
    // Update original authorization
    await SecureDataAccess.update('authorizations', appeal.authorizationId, {
      status: 'appeal-approved',
      lastUpdated: new Date()
    }, context);

    // Cancel any pending follow-up tasks
    await this.cancelAppealFollowUps(appealId, context);
  }

  async handleAppealDenial(appealId, context) {
    const appeal = await SecureDataAccess.findById('appeals', appealId, context);
    
    // Check if further appeals are possible
    const canAppealFurther = appeal.appealLevel < this.getMaxAppealLevels(appeal.payerId);
    
    if (canAppealFurther) {
      // Create task for next level appeal consideration
      await this.createNextLevelAppealTask(appealId, context);
    }

    // Update original authorization
    await SecureDataAccess.update('authorizations', appeal.authorizationId, {
      status: 'appeal-denied',
      lastUpdated: new Date()
    }, context);
  }

  async scheduleAppealFollowUps(appeal, context) {
    const taskService = require('./taskService');
    
    // Schedule follow-up tasks based on appeal type and insurance
    const followUpSchedule = this.getFollowUpSchedule(appeal.payerId, appeal.urgentAppeal);

    for (const followUp of followUpSchedule) {
      await taskService.createTask({
        type: 'appeal-follow-up',
        title: followUp.title,
        description: followUp.description,
        dueDate: new Date(appeal.submittedDate.getTime() + followUp.daysAfter * 24 * 60 * 60 * 1000),
        priority: followUp.priority,
        assignedTo: appeal.submittedBy,
        relatedAppealId: appeal._id,
        practiceId: context.practiceId
      }, context);
    }
  }

  async createAppealHistoryEntry(appealId, status, notes, context) {
    return await SecureDataAccess.create('appealhistory', {
      appealId,
      status,
      notes,
      createdBy: context.userId,
      createdAt: new Date()
    }, context);
  }

  // Utility methods
  calculateAppealDeadline(denialDate, payerId) {
    const deadlineDays = this.getAppealDeadlineDays(payerId);
    const deadline = new Date(denialDate);
    deadline.setDate(deadline.getDate() + deadlineDays);
    return deadline;
  }

  getAppealDeadlineDays(payerId) {
    const deadlines = {
      'AETNA': 60,
      'BCBS': 180,
      'CIGNA': 60,
      'HUMANA': 60,
      'UHC': 180,
      'MEDICARE': 120,
      'MEDICAID': 90
    };
    
    return deadlines[payerId] || 60; // Default 60 days
  }

  getMaxAppealLevels(payerId) {
    const maxLevels = {
      'AETNA': 2,
      'BCBS': 2,
      'CIGNA': 2,
      'HUMANA': 2,
      'UHC': 2,
      'MEDICARE': 5, // Multiple levels for Medicare
      'MEDICAID': 3
    };
    
    return maxLevels[payerId] || 2;
  }

  shouldAutoSubmit(payerId, urgentAppeal) {
    // Auto-submit for urgent appeals and supported providers
    const autoSubmitProviders = ['AETNA', 'BCBS', 'UHC'];
    return urgentAppeal || autoSubmitProviders.includes(payerId);
  }

  async generateAppealNumber(practiceId) {
    const prefix = 'APP';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = await this.getNextAppealSequence(practiceId, date);
    return `${prefix}-${date}-${sequence.toString().padStart(4, '0')}`;
  }

  async getNextAppealSequence(practiceId, date) {
    const counter = await SecureDataAccess.findOneAndUpdate('appealcounters', 
      { practiceId, date },
      { $inc: { sequence: 1 } },
      { upsert: true, new: true }
    );
    return counter.sequence;
  }

  getFollowUpSchedule(payerId, urgent) {
    const baseSchedule = [
      { daysAfter: urgent ? 3 : 7, title: 'Check Appeal Receipt', description: 'Confirm insurance received appeal', priority: 'medium' },
      { daysAfter: urgent ? 7 : 14, title: 'Follow-up Appeal Status', description: 'Check processing status', priority: 'medium' },
      { daysAfter: urgent ? 14 : 30, title: 'Appeal Status Review', description: 'Review appeal progress', priority: 'high' }
    ];

    // Add provider-specific follow-ups
    return baseSchedule;
  }

  async processSupportingDocuments(appealId, documents, context) {
    const documentService = require('./documentService');
    
    for (const doc of documents) {
      await documentService.associateWithAppeal(appealId, doc.id, {
        type: doc.type || 'supporting-document',
        description: doc.description,
        required: doc.required || false
      }, context);
    }
  }

  async searchMedicalLiterature(serviceCode) {
    // Integration with medical literature databases
    // This would connect to PubMed, UpToDate, etc.
    return [
      {
        type: 'literature',
        title: 'Medical literature search results',
        description: `Evidence supporting ${serviceCode}`,
        source: 'medical-database'
      }
    ];
  }

  async getClinicalGuidelines(serviceCode) {
    // Get relevant clinical guidelines
    return [
      {
        type: 'guidelines',
        title: 'Clinical practice guidelines',
        description: `Guidelines for ${serviceCode}`,
        source: 'clinical-guidelines'
      }
    ];
  }

  async getSimilarApprovalCases(appeal, context) {
    // Find similar cases that were approved
    const similarCases = await SecureDataAccess.query('authorizations', {
      practiceId: context.practiceId,
      serviceCode: appeal.originalServiceCode,
      status: 'approved',
      submittedDate: {
        $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Past year
      }
    }, { limit: 5 }, context);

    return similarCases.map(case => ({
      type: 'similar-case',
      authorizationNumber: case.authorizationNumber,
      approvalDate: case.approvalDate,
      serviceCode: case.serviceCode
    }));
  }

  generateX12_275(appeal, appealPacket, providerAPI) {
    // Generate X12 275 additional information message
    // Simplified implementation - production would use proper X12 library
    const transactionId = `TXN${Date.now()}`;
    
    const segments = [
      `ST*275*${transactionId}*005010X215E1~`,
      `BHT*0010*13*${transactionId}*${new Date().toISOString().slice(0,10).replace(/-/g,'')}*${new Date().toTimeString().slice(0,5).replace(/:/g,'')}~`,
      `HL*1**20*1~`,
      `NM1*PR*2*${appeal.insuranceCompany}*****PI*${appeal.payerId}~`,
      `HL*2*1*21*1~`,
      `NM1*1P*2*${providerAPI.submitterName}*****XX*${providerAPI.submitterNPI}~`,
      `HL*3*2*22*0~`,
      `TRN*1*${appeal.appealNumber}~`,
      `REF*F8*${appeal.authorizationId}~`, // Original authorization reference
      `NM1*IL*1*${appeal.patientLastName}*${appeal.patientFirstName}****MI*${appeal.memberId}~`,
      `PWK*OZ*FT***AA~`, // Paperwork/documentation segment
      `MSG*${appeal.appealReason.substring(0, 264)}~`, // Appeal reason (max 264 chars)
      `SE*12*${transactionId}~`
    ];
    
    return segments.join('');
  }

  extractX12ConfirmationNumber(x12Response) {
    // Extract confirmation number from X12 response
    const segments = x12Response.split('~');
    for (const segment of segments) {
      if (segment.startsWith('TRN*1*')) {
        return segment.split('*')[2];
      }
    }
    return `X12-${Date.now()}`;
  }

  async loadAppealTypes() {
    return ['medical-necessity', 'experimental-treatment', 'network-issue', 'coverage-dispute', 'administrative-error'];
  }

  async loadProviderAppealAPIs() {
    return {
      'AETNA': {
        type: 'rest-api',
        endpoint: 'https://api.aetna.com/v1/appeals',
        apiKey: process.env.AETNA_API_KEY,
        clientId: process.env.AETNA_CLIENT_ID
      },
      'BCBS': {
        type: 'email',
        appealEmail: 'appeals@bcbs.com'
      }
    };
  }

  async loadDocumentTemplates() {
    return {
      appealCoverLetter: `
Dear {insuranceCompany} Appeals Department,

Date: {date}
Patient: {patientName}
DOB: {patientDOB}
Member ID: {memberId}
Original Authorization Number: {authorizationNumber}
Appeal Number: {appealNumber}
Appeal Level: {appealLevel}
{urgentStatus}

RE: Appeal for {serviceCode} services provided on {serviceDate}

We are formally appealing the denial of the above-referenced prior authorization request. The original request was denied on {denialDate} for the following reason: {denialReason}.

APPEAL REASON:
{appealReason}

CLINICAL JUSTIFICATION:
{clinicalJustification}

We believe this service is medically necessary and appropriate for this patient based on their clinical condition and medical history. We have included supporting documentation to substantiate this appeal.

Please review this appeal promptly and provide written notification of your determination. If you need any additional information, please contact our office at {clinicPhone}.

Thank you for your consideration.

Sincerely,

{providerName}, {providerNPI}
{practiceName}
{clinicAddress}
{clinicPhone}
      `.trim()
    };
  }

  async fillAppealForm(formTemplate, formData) {
    // Fill out insurance-specific appeal form
    // This would integrate with form filling libraries
    return {
      type: 'filled-form',
      content: 'Form content would be generated here',
      formData
    };
  }

  async sendStatusNotification(appealId, status, context) {
    const notificationService = require('./notificationService');
    const appeal = await SecureDataAccess.findById('appeals', appealId, context);
    
    await notificationService.sendNotification({
      type: 'APPEAL_STATUS_UPDATE',
      priority: status === 'denied' ? 'high' : 'medium',
      appealId,
      appealNumber: appeal.appealNumber,
      status,
      message: `Appeal ${appeal.appealNumber} status updated to ${status}`,
      recipients: [appeal.submittedBy],
      practiceId: context.practiceId
    });
  }

  async cancelAppealFollowUps(appealId, context) {
    const taskService = require('./taskService');
    await taskService.cancelTasksByReference('appeal-follow-up', appealId, context);
  }

  async createNextLevelAppealTask(appealId, context) {
    const taskService = require('./taskService');
    const appeal = await SecureDataAccess.findById('appeals', appealId, context);
    
    await taskService.createTask({
      type: 'next-level-appeal',
      title: `Consider Level ${appeal.appealLevel + 1} Appeal`,
      description: `Level ${appeal.appealLevel} appeal was denied. Consider submitting next level appeal.`,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      priority: 'high',
      assignedTo: appeal.submittedBy,
      relatedAppealId: appealId,
      practiceId: context.practiceId
    }, context);
  }
}

module.exports = new AppealManagementService();
```

### 2. Create Appeal API Endpoints
```javascript
// backend/routes/appeals.js

// Submit appeal for denied authorization
router.post('/api/authorization/:authorizationId/appeal', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { authorizationId } = req.params;
    const appealData = req.body;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await appealManagementService.submitAppeal(
      authorizationId,
      appealData,
      context
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error submitting appeal:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update appeal status
router.put('/api/appeals/:appealId/status', authenticate, authorize(['provider', 'admin']), async (req, res) => {
  try {
    const { appealId } = req.params;
    const statusData = req.body;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    await appealManagementService.updateAppealStatus(appealId, statusData, context);
    
    res.json({
      success: true,
      message: 'Appeal status updated successfully'
    });
  } catch (error) {
    console.error('Error updating appeal status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get appeal details
router.get('/api/appeals/:appealId', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { appealId } = req.params;
    const { includeHistory = 'true', includeDocuments = 'false' } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const appeal = await SecureDataAccess.findById('appeals', appealId, context);
    
    if (!appeal) {
      return res.status(404).json({
        success: false,
        error: 'Appeal not found'
      });
    }

    // Add history if requested
    if (includeHistory === 'true') {
      appeal.history = await SecureDataAccess.query('appealhistory', {
        appealId,
        practiceId: context.practiceId
      }, { sort: { createdAt: -1 } }, context);
    }

    // Add documents if requested
    if (includeDocuments === 'true') {
      appeal.documents = await SecureDataAccess.query('appealdocuments', {
        appealId,
        practiceId: context.practiceId
      }, context);
    }

    res.json({
      success: true,
      data: appeal
    });
  } catch (error) {
    console.error('Error retrieving appeal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve appeal'
    });
  }
});

// Get appeals by status
router.get('/api/appeals/by-status/:status', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { status } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const appeals = await SecureDataAccess.query('appeals', {
      status,
      practiceId: context.practiceId
    }, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort: { lastUpdated: -1 }
    }, context);

    res.json({
      success: true,
      data: appeals,
      count: appeals.length,
      status
    });
  } catch (error) {
    console.error('Error retrieving appeals by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve appeals'
    });
  }
});
```

## Required Endpoints

### POST /api/authorization/:authorizationId/appeal
**Description**: Submit appeal for denied authorization
**Access**: Providers, Nurses
**Request Body**:
```json
{
  "appealLevel": 1,
  "appealType": "medical-necessity",
  "appealReason": "Patient requires this service due to chronic condition that has not responded to conservative treatment...",
  "clinicalJustification": "Based on patient's medical history and current symptoms, this service is medically necessary...",
  "priorTreatmentHistory": "Patient has tried medications X, Y, Z without improvement...",
  "alternativesTried": "Conservative treatments attempted include...",
  "supportingDocuments": [
    {
      "id": "doc123",
      "type": "clinical-notes",
      "description": "Progress notes from last 3 visits"
    }
  ],
  "urgentAppeal": false,
  "additionalInformation": "Patient's condition has worsened..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "appeal": {
      "appealNumber": "APP-20241219-0001",
      "authorizationId": "60d5eca7f1b2c8b1d8e4f89a",
      "status": "submitted",
      "appealLevel": 1,
      "appealDeadline": "2025-02-17T23:59:59Z",
      "submittedDate": "2024-12-19T10:30:00Z"
    },
    "appealPacket": {
      "coverLetter": {...},
      "appealForm": {...},
      "clinicalDocumentation": [...]
    },
    "message": "Appeal submitted automatically to insurance"
  }
}
```

### PUT /api/appeals/:appealId/status
**Description**: Update appeal status
**Access**: Providers, Admins

### GET /api/appeals/:appealId
**Description**: Get appeal details with optional history
**Access**: Providers, Nurses

### GET /api/appeals/by-status/:status
**Description**: Get appeals by status
**Access**: Providers, Nurses

## Data Models Required

### Appeals Collection
```javascript
{
  appealNumber: String,
  authorizationId: ObjectId,
  patientId: ObjectId,
  practiceId: String,
  payerId: String,
  insuranceCompany: String,
  
  // Appeal details
  appealLevel: Number,
  appealType: String,
  appealReason: String,
  clinicalJustification: String,
  priorTreatmentHistory: String,
  alternativesTried: String,
  additionalInformation: String,
  urgentAppeal: Boolean,
  
  // Original service details
  originalServiceCode: String,
  originalServiceDate: Date,
  originalDenialReason: String,
  originalDenialDate: Date,
  
  // Provider information
  submittingProvider: ObjectId,
  submittingProviderNPI: String,
  
  // Status tracking
  status: String, // preparing, submitted, in-review, approved, denied, withdrawn
  submittedDate: Date,
  responseDate: Date,
  responseDetails: String,
  appealDeadline: Date,
  confirmationNumber: String,
  submissionMethod: String,
  
  // Administrative
  submittedBy: ObjectId,
  createdAt: Date,
  lastUpdated: Date
}
```

### AppealHistory Collection
```javascript
{
  appealId: ObjectId,
  status: String,
  notes: String,
  createdBy: ObjectId,
  createdAt: Date
}
```

### AppealDocuments Collection
```javascript
{
  appealId: ObjectId,
  documentId: ObjectId,
  type: String,
  description: String,
  required: Boolean,
  associatedAt: Date
}
```

### AppealCounters Collection
```javascript
{
  practiceId: String,
  date: String, // YYYYMMDD format
  sequence: Number
}
```

## Test Cases

### 1. Basic Appeal Submission
- Submit appeal for denied authorization
- Verify appeal number generated
- Check documentation prepared
- Verify deadline calculated correctly

### 2. Appeal Validation
- Test missing required fields
- Test invalid appeal type
- Test appeal after deadline
- Verify error handling

### 3. Document Generation
- Verify cover letter generated
- Check clinical documentation gathered
- Test insurance-specific forms
- Verify supporting evidence included

### 4. Auto-Submission
- Test X12 275 submission
- Test REST API submission
- Test email submission
- Handle submission failures

### 5. Status Updates
- Update appeal to approved
- Update appeal to denied
- Test notification sending
- Verify status history maintained

### 6. Follow-up Scheduling
- Verify follow-up tasks created
- Test urgent appeal timelines
- Check task assignment
- Verify task cancellation on approval

### 7. Multi-Level Appeals
- Submit second level appeal
- Test level validation
- Check maximum levels enforced
- Verify appeal chain tracking

## Dependencies
- SecureDataAccess service
- Insurance provider APIs
- X12 processing libraries
- Email service
- Portal submission service
- Document service
- Task service
- Notification service
- AuditLog for compliance

## Success Criteria
- [ ] Appeal submission workflow complete
- [ ] Automatic documentation generation
- [ ] Multiple submission methods supported
- [ ] Appeal deadline tracking functional
- [ ] Status update system working
- [ ] Follow-up task scheduling operational
- [ ] Multi-level appeal support
- [ ] Clinical documentation gathering
- [ ] Supporting evidence collection
- [ ] Complete audit trail maintained
- [ ] Notification system integrated
- [ ] Appeal packet generation working

## Notes
- Consider integration with medical literature databases
- May need OCR for processing denial letters
- Future enhancement: AI-powered appeal success prediction
- Consider adding peer review process
- May need integration with external appeal services
- Consider adding template library for common appeals