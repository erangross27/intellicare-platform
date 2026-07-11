# Pharmacy Integration System

## Function Details
**Function Name**: integratePharmacy  
**Location**: backend/services/pharmacyIntegrationService.js  
**Status**: Not Implemented  
**Priority**: Critical (P1)  
**Complexity**: High  
**Estimated Time**: 12-16 hours  

## Problem Description
Comprehensive pharmacy integration system with SureScripts network connectivity, electronic prescribing (eRx), real-time pharmacy availability, prescription status tracking, fill history retrieval, and automated medication synchronization.

## Implementation Steps

### 1. Core Service Implementation

```javascript
// backend/services/pharmacyIntegrationService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const sureScriptsClient = require('./sureScriptsClient');
const ncpdpClient = require('./ncpdpClient');
const hl7Service = require('./hl7Service');

class PharmacyIntegrationService {
  constructor() {
    this.serviceToken = null;
    this.sureScriptsConnection = null;
    this.pharmacyDirectory = new Map();
    this.prescriptionQueue = new Map();
    this.statusPollingIntervals = new Map();
    this.networkConnections = new Map();
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('pharmacy-integration-service');
    await this.initializeSureScriptsConnection();
    await this.loadPharmacyDirectory();
    await this.setupNetworkConnections();
    await this.initializePollingServices();
  }

  async integratePharmacy(integrationRequest, context) {
    try {
      await this.validateIntegrationRequest(integrationRequest, context);
      
      let result;
      
      switch (integrationRequest.action) {
        case 'send_prescription':
          result = await this.sendElectronicPrescription(
            integrationRequest.prescriptionData,
            integrationRequest.pharmacyId,
            context
          );
          break;
          
        case 'check_status':
          result = await this.checkPrescriptionStatus(
            integrationRequest.prescriptionId,
            integrationRequest.pharmacyId,
            context
          );
          break;
          
        case 'get_fill_history':
          result = await this.getPatientFillHistory(
            integrationRequest.patientId,
            integrationRequest.timeRange,
            context
          );
          break;
          
        case 'find_pharmacies':
          result = await this.findPharmacies(
            integrationRequest.searchCriteria,
            context
          );
          break;
          
        case 'verify_insurance':
          result = await this.verifyInsuranceCoverage(
            integrationRequest.patientId,
            integrationRequest.medicationData,
            integrationRequest.pharmacyId,
            context
          );
          break;
          
        case 'cancel_prescription':
          result = await this.cancelPrescription(
            integrationRequest.prescriptionId,
            integrationRequest.reason,
            context
          );
          break;
          
        case 'refill_request':
          result = await this.processRefillRequest(
            integrationRequest.refillData,
            context
          );
          break;
          
        default:
          throw new Error('Invalid pharmacy integration action');
      }
      
      await this.auditPharmacyIntegration(integrationRequest, result, context);
      
      return result;
      
    } catch (error) {
      await this.handleIntegrationError(error, integrationRequest, context);
      throw error;
    }
  }

  async validateIntegrationRequest(request, context) {
    if (!request.action) {
      throw new Error('Action is required for pharmacy integration');
    }
    
    const validActions = [
      'send_prescription', 'check_status', 'get_fill_history', 
      'find_pharmacies', 'verify_insurance', 'cancel_prescription', 'refill_request'
    ];
    
    if (!validActions.includes(request.action)) {
      throw new Error('Invalid pharmacy integration action');
    }
    
    // Validate specific action requirements
    if (request.action === 'send_prescription' && !request.prescriptionData) {
      throw new Error('Prescription data is required for sending prescriptions');
    }
    
    if (request.action === 'check_status' && !request.prescriptionId) {
      throw new Error('Prescription ID is required for status checking');
    }
  }

  async sendElectronicPrescription(prescriptionData, pharmacyId, context) {
    // Validate prescription data
    await this.validatePrescriptionData(prescriptionData, context);
    
    // Get pharmacy information
    const pharmacy = await this.getPharmacyById(pharmacyId, context);
    if (!pharmacy) {
      throw new Error('Pharmacy not found');
    }
    
    // Check pharmacy capabilities
    await this.verifyPharmacyCapabilities(pharmacy, prescriptionData, context);
    
    // Get patient information
    const patient = await SecureDataAccess.findById('patients', prescriptionData.patientId, context);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    // Get prescriber information
    const prescriber = await SecureDataAccess.findById('users', prescriptionData.prescriberId, context);
    if (!prescriber) {
      throw new Error('Prescriber not found');
    }
    
    // Generate NCPDP SCRIPT message
    const scriptMessage = await this.generateNCPDPScript({
      messageType: 'NewRx',
      prescription: prescriptionData,
      patient: patient,
      prescriber: prescriber,
      pharmacy: pharmacy,
      timestamp: new Date()
    });
    
    // Send via SureScripts network
    const transmissionResult = await this.transmitPrescription(
      scriptMessage,
      pharmacy,
      context
    );
    
    // Store transmission record
    const transmissionRecord = await SecureDataAccess.create(
      'prescription_transmissions',
      {
        prescriptionId: prescriptionData.prescriptionId,
        pharmacyId: pharmacyId,
        patientId: prescriptionData.patientId,
        prescriberId: prescriptionData.prescriberId,
        transmissionId: transmissionResult.transmissionId,
        messageType: 'NewRx',
        scriptMessage: scriptMessage,
        status: 'transmitted',
        sentAt: new Date(),
        pharmacyConfirmation: transmissionResult.confirmation,
        networkProvider: 'SureScripts',
        practiceId: context.practiceId
      },
      context
    );
    
    // Start status polling
    await this.startStatusPolling(
      transmissionRecord._id,
      pharmacy,
      context
    );
    
    return {
      transmissionId: transmissionResult.transmissionId,
      status: 'sent',
      pharmacy: {
        id: pharmacy.ncpdpId,
        name: pharmacy.name,
        address: pharmacy.address
      },
      sentAt: new Date(),
      trackingInfo: {
        canTrack: true,
        expectedProcessingTime: pharmacy.avgProcessingTime || '2-4 hours',
        statusCheckUrl: `/api/pharmacy-integration/status/${transmissionRecord._id}`
      }
    };
  }

  async generateNCPDPScript(messageData) {
    const script = {
      // Header
      header: {
        messageType: messageData.messageType,
        version: '2017071',
        timestamp: messageData.timestamp.toISOString(),
        messageId: this.generateMessageId(),
        relatesToMessageId: messageData.relatesToMessageId || null
      },
      
      // Patient information
      patient: {
        identification: {
          patientId: messageData.patient._id,
          firstName: messageData.patient.demographics.firstName,
          lastName: messageData.patient.demographics.lastName,
          dateOfBirth: messageData.patient.demographics.dateOfBirth,
          gender: messageData.patient.demographics.gender,
          address: messageData.patient.demographics.address,
          phone: messageData.patient.demographics.phone
        },
        insurance: messageData.patient.insurance?.map(ins => ({
          planId: ins.planId,
          memberId: ins.memberId,
          groupNumber: ins.groupNumber,
          rxBin: ins.rxBin,
          rxPcn: ins.rxPcn,
          coverageType: ins.coverageType
        })) || []
      },
      
      // Prescriber information
      prescriber: {
        identification: {
          npi: messageData.prescriber.npi,
          deaNumber: messageData.prescriber.deaNumber,
          firstName: messageData.prescriber.profile.firstName,
          lastName: messageData.prescriber.profile.lastName,
          suffix: messageData.prescriber.profile.suffix,
          credentials: messageData.prescriber.credentials
        },
        contact: {
          address: messageData.prescriber.practice.address,
          phone: messageData.prescriber.practice.phone,
          fax: messageData.prescriber.practice.fax,
          email: messageData.prescriber.email
        },
        practice: {
          name: messageData.prescriber.practice.name,
          npi: messageData.prescriber.practice.npi
        }
      },
      
      // Pharmacy information
      pharmacy: {
        identification: {
          ncpdpId: messageData.pharmacy.ncpdpId,
          npi: messageData.pharmacy.npi,
          name: messageData.pharmacy.name,
          address: messageData.pharmacy.address,
          phone: messageData.pharmacy.phone,
          fax: messageData.pharmacy.fax
        }
      },
      
      // Medication information
      medication: {
        identification: {
          rxcui: messageData.prescription.medication.rxcui,
          ndc: messageData.prescription.medication.ndc,
          productName: messageData.prescription.medication.name,
          genericName: messageData.prescription.medication.genericName,
          strength: messageData.prescription.medication.strength,
          dosageForm: messageData.prescription.medication.dosageForm
        },
        directions: {
          sig: messageData.prescription.sig,
          quantity: messageData.prescription.quantity,
          daysSupply: messageData.prescription.daysSupply,
          refills: messageData.prescription.refills,
          genericSubstitution: messageData.prescription.allowGenericSubstitution || true,
          priorAuthorizationNumber: messageData.prescription.priorAuthNumber
        },
        clinical: {
          indication: messageData.prescription.indication,
          diagnosisCodes: messageData.prescription.diagnosisCodes || [],
          allergies: messageData.patient.allergies || [],
          currentMedications: messageData.prescription.currentMedications || []
        }
      },
      
      // Additional information
      additional: {
        prescriptionDate: messageData.prescription.prescribedDate,
        effectiveDate: messageData.prescription.startDate,
        expirationDate: messageData.prescription.expirationDate,
        priority: messageData.prescription.priority || 'routine',
        notes: messageData.prescription.pharmacistNotes,
        clinicalNotes: messageData.prescription.clinicalNotes
      }
    };
    
    return script;
  }

  async transmitPrescription(scriptMessage, pharmacy, context) {
    try {
      // Determine transmission method based on pharmacy capabilities
      let transmissionResult;
      
      if (pharmacy.capabilities.sureScripts) {
        transmissionResult = await this.sendViaSureScripts(scriptMessage, pharmacy, context);
      } else if (pharmacy.capabilities.directHL7) {
        transmissionResult = await this.sendViaDirectHL7(scriptMessage, pharmacy, context);
      } else if (pharmacy.capabilities.fax) {
        transmissionResult = await this.sendViaFax(scriptMessage, pharmacy, context);
      } else {
        throw new Error('No supported transmission method available for this pharmacy');
      }
      
      return transmissionResult;
      
    } catch (error) {
      throw new Error(`Prescription transmission failed: ${error.message}`);
    }
  }

  async sendViaSureScripts(scriptMessage, pharmacy, context) {
    const sureScriptsMessage = await this.formatForSureScripts(scriptMessage);
    
    const response = await sureScriptsClient.sendMessage({
      destinationId: pharmacy.sureScriptsId,
      messageType: scriptMessage.header.messageType,
      message: sureScriptsMessage,
      priority: scriptMessage.additional.priority
    });
    
    return {
      transmissionId: response.messageId,
      confirmation: response.acknowledgment,
      method: 'SureScripts',
      status: response.status,
      timestamp: new Date()
    };
  }

  async checkPrescriptionStatus(prescriptionId, pharmacyId, context) {
    const transmissionRecord = await SecureDataAccess.query(
      'prescription_transmissions',
      { 
        prescriptionId: prescriptionId,
        pharmacyId: pharmacyId 
      },
      { sort: { sentAt: -1 }, limit: 1 },
      context
    );
    
    if (!transmissionRecord || transmissionRecord.length === 0) {
      throw new Error('Prescription transmission record not found');
    }
    
    const transmission = transmissionRecord[0];
    const pharmacy = await this.getPharmacyById(pharmacyId, context);
    
    // Query status from pharmacy system
    let statusResult;
    
    if (pharmacy.capabilities.sureScripts) {
      statusResult = await this.checkStatusViaSureScripts(transmission, pharmacy, context);
    } else if (pharmacy.capabilities.directAPI) {
      statusResult = await this.checkStatusViaDirectAPI(transmission, pharmacy, context);
    } else {
      // Fallback to stored status
      statusResult = {
        status: transmission.status,
        lastUpdated: transmission.updatedAt,
        method: 'stored'
      };
    }
    
    // Update transmission record if status changed
    if (statusResult.status !== transmission.status) {
      await SecureDataAccess.update(
        'prescription_transmissions',
        transmission._id,
        {
          status: statusResult.status,
          statusDetails: statusResult.details,
          lastStatusCheck: new Date(),
          pharmacyResponse: statusResult.pharmacyResponse
        },
        context
      );
    }
    
    return {
      prescriptionId: prescriptionId,
      transmissionId: transmission.transmissionId,
      status: statusResult.status,
      statusDescription: this.getStatusDescription(statusResult.status),
      lastUpdated: statusResult.lastUpdated,
      pharmacy: {
        name: pharmacy.name,
        phone: pharmacy.phone
      },
      timeline: statusResult.timeline || [],
      estimatedReadyTime: statusResult.estimatedReadyTime,
      canCancel: this.canCancelPrescription(statusResult.status),
      canRefill: this.canRefillPrescription(statusResult.status)
    };
  }

  async getPatientFillHistory(patientId, timeRange, context) {
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    const defaultTimeRange = {
      startDate: new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)), // 1 year ago
      endDate: new Date()
    };
    
    const queryTimeRange = timeRange || defaultTimeRange;
    
    // Get fill history from multiple sources
    const fillHistory = [];
    
    // 1. From pharmacy networks (SureScripts)
    if (patient.pharmacies && patient.pharmacies.length > 0) {
      for (const pharmacyRef of patient.pharmacies) {
        try {
          const pharmacy = await this.getPharmacyById(pharmacyRef.pharmacyId, context);
          if (pharmacy.capabilities.historyRetrieval) {
            const pharmacyHistory = await this.getPharmacyFillHistory(
              patient,
              pharmacy,
              queryTimeRange,
              context
            );
            fillHistory.push(...pharmacyHistory);
          }
        } catch (error) {
          console.error(`Error retrieving history from pharmacy ${pharmacyRef.pharmacyId}:`, error);
        }
      }
    }
    
    // 2. From internal transmission records
    const internalFills = await SecureDataAccess.query(
      'prescription_transmissions',
      {
        patientId: patientId,
        status: { $in: ['filled', 'dispensed', 'picked_up'] },
        sentAt: {
          $gte: queryTimeRange.startDate,
          $lte: queryTimeRange.endDate
        }
      },
      { sort: { sentAt: -1 } },
      context
    );
    
    // Convert internal records to fill history format
    const internalFillHistory = await Promise.all(
      internalFills.map(async (transmission) => {
        const pharmacy = await this.getPharmacyById(transmission.pharmacyId, context);
        return {
          fillId: transmission._id,
          prescriptionId: transmission.prescriptionId,
          medication: transmission.medication || await this.getMedicationFromTransmission(transmission, context),
          pharmacy: {
            id: pharmacy.ncpdpId,
            name: pharmacy.name,
            address: pharmacy.address,
            phone: pharmacy.phone
          },
          fillDate: transmission.filledAt || transmission.sentAt,
          quantity: transmission.quantity,
          daysSupply: transmission.daysSupply,
          refillNumber: transmission.refillNumber || 0,
          prescriber: transmission.prescriber,
          copayAmount: transmission.copayAmount,
          insurancePaid: transmission.insurancePaid,
          totalCost: transmission.totalCost,
          source: 'internal'
        };
      })
    );
    
    fillHistory.push(...internalFillHistory);
    
    // 3. Deduplicate and sort
    const deduplicatedHistory = this.deduplicateFillHistory(fillHistory);
    const sortedHistory = deduplicatedHistory.sort((a, b) => 
      new Date(b.fillDate) - new Date(a.fillDate)
    );
    
    return {
      patientId: patientId,
      timeRange: queryTimeRange,
      totalFills: sortedHistory.length,
      fillHistory: sortedHistory,
      pharmacies: this.extractUniquePharmacies(sortedHistory),
      medications: this.extractUniqueMedications(sortedHistory),
      summary: {
        averageFillsPerMonth: this.calculateAverageFillsPerMonth(sortedHistory, queryTimeRange),
        mostUsedPharmacy: this.getMostUsedPharmacy(sortedHistory),
        totalCost: this.calculateTotalCost(sortedHistory)
      }
    };
  }

  async findPharmacies(searchCriteria, context) {
    const pharmacies = [];
    
    // Search criteria can include: location, name, services, network participation
    const {
      location,
      radius = 10, // miles
      name,
      services = [],
      networkParticipation = [],
      capabilities = [],
      specialties = []
    } = searchCriteria;
    
    let query = {};
    
    // Location-based search
    if (location) {
      if (location.zipCode) {
        query.zipCode = location.zipCode;
      } else if (location.coordinates) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [location.coordinates.longitude, location.coordinates.latitude]
            },
            $maxDistance: radius * 1609.34 // Convert miles to meters
          }
        };
      }
    }
    
    // Name search
    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }
    
    // Services filter
    if (services.length > 0) {
      query.services = { $in: services };
    }
    
    // Network participation filter
    if (networkParticipation.length > 0) {
      query.networkParticipation = { $in: networkParticipation };
    }
    
    // Capabilities filter
    if (capabilities.length > 0) {
      capabilities.forEach(capability => {
        query[`capabilities.${capability}`] = true;
      });
    }
    
    const searchResults = await SecureDataAccess.query(
      'pharmacies',
      query,
      { limit: 50, sort: { name: 1 } },
      context
    );
    
    // Enrich with real-time data
    const enrichedResults = await Promise.all(
      searchResults.map(async (pharmacy) => {
        const enrichedPharmacy = {
          ...pharmacy,
          distance: location && pharmacy.location ? 
            this.calculateDistance(location, pharmacy.location) : null,
          isOpen: await this.checkPharmacyHours(pharmacy),
          waitTime: await this.getEstimatedWaitTime(pharmacy),
          acceptingNewPatients: pharmacy.acceptingNewPatients !== false
        };
        
        // Add insurance acceptance info if patient provided
        if (searchCriteria.patientInsurance) {
          enrichedPharmacy.acceptsInsurance = await this.checkInsuranceAcceptance(
            pharmacy,
            searchCriteria.patientInsurance
          );
        }
        
        return enrichedPharmacy;
      })
    );
    
    return {
      searchCriteria: searchCriteria,
      totalResults: enrichedResults.length,
      pharmacies: enrichedResults.sort((a, b) => {
        // Sort by distance if location provided, otherwise by name
        if (location && a.distance !== null && b.distance !== null) {
          return a.distance - b.distance;
        }
        return a.name.localeCompare(b.name);
      })
    };
  }

  async verifyInsuranceCoverage(patientId, medicationData, pharmacyId, context) {
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    if (!patient || !patient.insurance || patient.insurance.length === 0) {
      throw new Error('No insurance information found for patient');
    }
    
    const pharmacy = await this.getPharmacyById(pharmacyId, context);
    if (!pharmacy) {
      throw new Error('Pharmacy not found');
    }
    
    const coverageResults = [];
    
    for (const insurance of patient.insurance) {
      try {
        const coverageResult = await this.checkCoverageWithPBM(
          insurance,
          medicationData,
          pharmacy,
          context
        );
        
        coverageResults.push({
          insurancePlan: {
            planName: insurance.planName,
            memberId: insurance.memberId,
            groupNumber: insurance.groupNumber
          },
          coverage: coverageResult.coverage,
          copay: coverageResult.copay,
          deductible: coverageResult.deductible,
          priorAuthRequired: coverageResult.priorAuthRequired,
          stepTherapyRequired: coverageResult.stepTherapyRequired,
          quantityLimits: coverageResult.quantityLimits,
          alternatives: coverageResult.alternatives || []
        });
      } catch (error) {
        coverageResults.push({
          insurancePlan: {
            planName: insurance.planName,
            memberId: insurance.memberId
          },
          coverage: {
            covered: false,
            reason: 'Unable to verify coverage',
            error: error.message
          }
        });
      }
    }
    
    // Determine best coverage option
    const bestCoverage = this.determineBestCoverage(coverageResults);
    
    return {
      patientId: patientId,
      medication: medicationData,
      pharmacy: {
        id: pharmacy.ncpdpId,
        name: pharmacy.name
      },
      coverageOptions: coverageResults,
      recommendedCoverage: bestCoverage,
      verifiedAt: new Date()
    };
  }

  async processRefillRequest(refillData, context) {
    const originalPrescription = await SecureDataAccess.findById(
      'prescriptions',
      refillData.originalPrescriptionId,
      context
    );
    
    if (!originalPrescription) {
      throw new Error('Original prescription not found');
    }
    
    // Validate refill eligibility
    const eligibilityCheck = await this.checkRefillEligibility(originalPrescription, context);
    if (!eligibilityCheck.eligible) {
      throw new Error(`Refill not eligible: ${eligibilityCheck.reason}`);
    }
    
    // Get pharmacy information
    const pharmacy = await this.getPharmacyById(refillData.pharmacyId, context);
    
    // Generate refill request message
    const refillMessage = await this.generateNCPDPScript({
      messageType: 'RefillRequest',
      prescription: originalPrescription,
      patient: await SecureDataAccess.findById('patients', originalPrescription.patientId, context),
      prescriber: await SecureDataAccess.findById('users', originalPrescription.prescriberId, context),
      pharmacy: pharmacy,
      refillInfo: {
        refillNumber: (originalPrescription.fillCount || 0) + 1,
        requestedQuantity: refillData.quantity || originalPrescription.quantity,
        requestedDate: refillData.requestedDate || new Date()
      },
      timestamp: new Date()
    });
    
    // Send refill request
    const transmissionResult = await this.transmitPrescription(refillMessage, pharmacy, context);
    
    // Update prescription record
    await SecureDataAccess.update(
      'prescriptions',
      originalPrescription._id,
      {
        $inc: { refillRequests: 1 },
        lastRefillRequest: new Date()
      },
      context
    );
    
    return {
      refillRequestId: transmissionResult.transmissionId,
      status: 'submitted',
      originalPrescriptionId: refillData.originalPrescriptionId,
      pharmacy: {
        name: pharmacy.name,
        phone: pharmacy.phone
      },
      submittedAt: new Date(),
      expectedProcessingTime: pharmacy.avgRefillProcessingTime || '1-2 hours'
    };
  }

  // Utility methods
  generateMessageId() {
    return `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStatusDescription(status) {
    const descriptions = {
      'transmitted': 'Prescription sent to pharmacy',
      'received': 'Pharmacy received prescription',
      'processing': 'Pharmacy is processing prescription',
      'ready': 'Prescription is ready for pickup',
      'dispensed': 'Prescription has been dispensed',
      'picked_up': 'Patient has picked up prescription',
      'cancelled': 'Prescription was cancelled',
      'rejected': 'Pharmacy rejected prescription',
      'error': 'Error processing prescription'
    };
    
    return descriptions[status] || 'Unknown status';
  }

  async auditPharmacyIntegration(request, result, context) {
    await AuditLog.create({
      action: 'PHARMACY_INTEGRATION',
      subAction: request.action.toUpperCase(),
      entityType: 'pharmacy_integration',
      entityId: result.transmissionId || result.requestId,
      patientId: request.prescriptionData?.patientId || request.patientId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        action: request.action,
        pharmacyId: request.pharmacyId,
        prescriptionId: request.prescriptionData?.prescriptionId || request.prescriptionId,
        transmissionMethod: result.method,
        status: result.status,
        networkProvider: result.networkProvider || 'unknown'
      },
      timestamp: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}

module.exports = new PharmacyIntegrationService();
```

### 2. API Endpoints

```javascript
// backend/routes/pharmacy-integration.js
const express = require('express');
const router = express.Router();
const pharmacyIntegrationService = require('../services/pharmacyIntegrationService');
const authMiddleware = require('../middleware/auth');
const auditMiddleware = require('../middleware/audit');

router.post('/integrate',
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const integrationRequest = {
        action: req.body.action,
        prescriptionData: req.body.prescriptionData,
        pharmacyId: req.body.pharmacyId,
        patientId: req.body.patientId,
        prescriptionId: req.body.prescriptionId,
        timeRange: req.body.timeRange,
        searchCriteria: req.body.searchCriteria,
        medicationData: req.body.medicationData,
        reason: req.body.reason,
        refillData: req.body.refillData
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await pharmacyIntegrationService.integratePharmacy(
        integrationRequest,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Pharmacy integration action completed successfully',
          he: 'פעולת אינטגרציה עם בית מרקחת הושלמה בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Pharmacy integration action failed',
          he: 'פעולת אינטגרציה עם בית מרקחת נכשלה'
        }
      });
    }
  }
);

router.post('/send-prescription',
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await pharmacyIntegrationService.sendElectronicPrescription(
        req.body.prescriptionData,
        req.body.pharmacyId,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Electronic prescription sent successfully',
          he: 'מרשם אלקטרוני נשלח בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to send electronic prescription',
          he: 'נכשל בשליחת מרשם אלקטרוני'
        }
      });
    }
  }
);

router.get('/status/:prescriptionId/:pharmacyId',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await pharmacyIntegrationService.checkPrescriptionStatus(
        req.params.prescriptionId,
        req.params.pharmacyId,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Prescription status retrieved successfully',
          he: 'סטטוס מרשם נשלף בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve prescription status',
          he: 'נכשל בשליפת סטטוס מרשם'
        }
      });
    }
  }
);

router.get('/patient/:patientId/fill-history',
  authMiddleware,
  async (req, res) => {
    try {
      const timeRange = req.query.startDate && req.query.endDate ? {
        startDate: new Date(req.query.startDate),
        endDate: new Date(req.query.endDate)
      } : null;

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await pharmacyIntegrationService.getPatientFillHistory(
        req.params.patientId,
        timeRange,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Fill history retrieved successfully',
          he: 'היסטוריית מילוי נשלפה בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve fill history',
          he: 'נכשל בשליפת היסטוריית מילוי'
        }
      });
    }
  }
);

router.post('/find-pharmacies',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await pharmacyIntegrationService.findPharmacies(
        req.body.searchCriteria,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Pharmacies found successfully',
          he: 'בתי מרקחת נמצאו בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to find pharmacies',
          he: 'נכשל במציאת בתי מרקחת'
        }
      });
    }
  }
);

router.post('/verify-insurance',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await pharmacyIntegrationService.verifyInsuranceCoverage(
        req.body.patientId,
        req.body.medicationData,
        req.body.pharmacyId,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Insurance coverage verified successfully',
          he: 'כיסוי ביטוחי אומת בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to verify insurance coverage',
          he: 'נכשל באימות כיסוי ביטוחי'
        }
      });
    }
  }
);

module.exports = router;
```

### 3. Data Models

```javascript
// backend/models/PrescriptionTransmission.js
const mongoose = require('mongoose');

const PrescriptionTransmissionSchema = new mongoose.Schema({
  transmissionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  prescriberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pharmacyId: {
    type: String,
    required: true,
    index: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  messageType: {
    type: String,
    enum: ['NewRx', 'RefillRequest', 'CancelRx', 'RxChangeRequest'],
    required: true
  },
  networkProvider: {
    type: String,
    enum: ['SureScripts', 'DirectHL7', 'Fax', 'Manual'],
    required: true
  },
  transmissionMethod: {
    type: String,
    enum: ['electronic', 'fax', 'phone', 'manual'],
    default: 'electronic'
  },
  scriptMessage: {
    header: {
      messageId: String,
      version: String,
      timestamp: Date,
      relatesToMessageId: String
    },
    patient: mongoose.Schema.Types.Mixed,
    prescriber: mongoose.Schema.Types.Mixed,
    pharmacy: mongoose.Schema.Types.Mixed,
    medication: mongoose.Schema.Types.Mixed,
    additional: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: [
      'queued', 'transmitted', 'received', 'processing', 'ready',
      'dispensed', 'picked_up', 'cancelled', 'rejected', 'error'
    ],
    default: 'queued',
    index: true
  },
  statusHistory: [{
    status: String,
    timestamp: Date,
    source: String,
    details: String
  }],
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  receivedAt: Date,
  processedAt: Date,
  readyAt: Date,
  dispensedAt: Date,
  pickedUpAt: Date,
  pharmacyConfirmation: {
    confirmationId: String,
    receivedAt: Date,
    acknowledgedBy: String,
    estimatedReadyTime: Date
  },
  pharmacyResponse: {
    responseId: String,
    responseType: String,
    message: String,
    timestamp: Date,
    data: mongoose.Schema.Types.Mixed
  },
  errorInfo: {
    errorCode: String,
    errorMessage: String,
    errorDetails: mongoose.Schema.Types.Mixed,
    timestamp: Date
  },
  refillInfo: {
    refillNumber: Number,
    originalTransmissionId: String,
    requestedQuantity: Number,
    requestedDate: Date
  },
  costInfo: {
    estimatedCost: Number,
    copayAmount: Number,
    insurancePaid: Number,
    totalCost: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  },
  lastStatusCheck: Date,
  nextStatusCheckAt: Date,
  statusPollingEnabled: {
    type: Boolean,
    default: true
  },
  metadata: {
    retryCount: {
      type: Number,
      default: 0
    },
    lastRetryAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }
});

// Indexes for performance
PrescriptionTransmissionSchema.index({ prescriptionId: 1, pharmacyId: 1 });
PrescriptionTransmissionSchema.index({ patientId: 1, sentAt: -1 });
PrescriptionTransmissionSchema.index({ status: 1, nextStatusCheckAt: 1 });
PrescriptionTransmissionSchema.index({ practiceId: 1, sentAt: -1 });

module.exports = mongoose.model('PrescriptionTransmission', PrescriptionTransmissionSchema);
```

```javascript
// backend/models/Pharmacy.js
const mongoose = require('mongoose');

const PharmacySchema = new mongoose.Schema({
  ncpdpId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  npi: String,
  name: {
    type: String,
    required: true,
    index: true
  },
  chainCode: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: {
      type: String,
      index: true
    },
    country: {
      type: String,
      default: 'US'
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number] // [longitude, latitude]
  },
  contact: {
    phone: String,
    fax: String,
    email: String,
    website: String
  },
  hours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },
  services: [{
    type: String,
    enum: [
      'prescription_filling', 'compounding', 'immunizations', 
      'medication_therapy_management', 'delivery', 'drive_through',
      'specialty_pharmacy', 'durable_medical_equipment', '24_hour'
    ]
  }],
  capabilities: {
    sureScripts: {
      type: Boolean,
      default: false
    },
    directHL7: {
      type: Boolean,
      default: false
    },
    fax: {
      type: Boolean,
      default: true
    },
    electronicPrescribing: {
      type: Boolean,
      default: false
    },
    statusUpdates: {
      type: Boolean,
      default: false
    },
    historyRetrieval: {
      type: Boolean,
      default: false
    },
    realTimeInventory: {
      type: Boolean,
      default: false
    }
  },
  networkParticipation: [{
    network: String,
    participantId: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending']
    }
  }],
  sureScriptsId: String,
  performanceMetrics: {
    avgProcessingTime: String, // e.g., "2-4 hours"
    avgRefillProcessingTime: String,
    successRate: Number, // percentage
    lastUpdated: Date
  },
  acceptingNewPatients: {
    type: Boolean,
    default: true
  },
  specialties: [String],
  insuranceAccepted: [{
    planName: String,
    planId: String,
    networkStatus: String
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'temporarily_closed'],
    default: 'active'
  },
  lastVerified: Date,
  metadata: {
    dataSource: String,
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    verificationSource: String
  }
});

// Geospatial index for location-based queries
PharmacySchema.index({ location: '2dsphere' });

// Other indexes
PharmacySchema.index({ name: 'text' });
PharmacySchema.index({ 'address.zipCode': 1, status: 1 });
PharmacySchema.index({ 'capabilities.sureScripts': 1 });

module.exports = mongoose.model('Pharmacy', PharmacySchema);
```

### 4. Frontend Components

```jsx
// frontend-vite/src/components/pharmacy/PharmacyIntegration.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Send, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Phone,
  Navigation,
  Pill,
  CreditCard
} from 'lucide-react';
import secureApiClient from '@/services/secureApiClient';
import { useTranslation } from '@/hooks/useTranslation';

const PharmacyIntegration = ({ prescriptionData, onPharmacySelected, onPrescriptionSent }) => {
  const { t } = useTranslation();
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState({
    location: { zipCode: '' },
    radius: 10,
    services: [],
    capabilities: ['electronicPrescribing']
  });
  const [insuranceVerification, setInsuranceVerification] = useState(null);
  const [transmissionStatus, setTransmissionStatus] = useState(null);

  const searchPharmacies = async () => {
    if (!searchCriteria.location.zipCode) return;
    
    setSearchLoading(true);
    try {
      const response = await secureApiClient.post('/api/pharmacy-integration/find-pharmacies', {
        searchCriteria: {
          ...searchCriteria,
          patientInsurance: prescriptionData?.patient?.insurance
        }
      });

      if (response.data.success) {
        setPharmacies(response.data.data.pharmacies);
      }
    } catch (error) {
      console.error('Error searching pharmacies:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const verifyInsurance = async (pharmacy) => {
    if (!prescriptionData?.patient?.id || !prescriptionData?.medication) return;

    try {
      const response = await secureApiClient.post('/api/pharmacy-integration/verify-insurance', {
        patientId: prescriptionData.patient.id,
        medicationData: prescriptionData.medication,
        pharmacyId: pharmacy.ncpdpId
      });

      if (response.data.success) {
        setInsuranceVerification(response.data.data);
      }
    } catch (error) {
      console.error('Error verifying insurance:', error);
    }
  };

  const sendPrescription = async () => {
    if (!selectedPharmacy || !prescriptionData) return;

    setLoading(true);
    try {
      const response = await secureApiClient.post('/api/pharmacy-integration/send-prescription', {
        prescriptionData: prescriptionData,
        pharmacyId: selectedPharmacy.ncpdpId
      });

      if (response.data.success) {
        setTransmissionStatus(response.data.data);
        if (onPrescriptionSent) {
          onPrescriptionSent(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error sending prescription:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectPharmacy = (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    if (onPharmacySelected) {
      onPharmacySelected(pharmacy);
    }
    verifyInsurance(pharmacy);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'text-green-600';
      case 'closed': return 'text-red-600';
      case 'closing_soon': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${(distance * 5280).toFixed(0)} ft`;
    }
    return `${distance.toFixed(1)} mi`;
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t({ en: 'Find Pharmacies', he: 'מצא בתי מרקחת' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t({ en: 'ZIP Code', he: 'מיקוד' })}
              </label>
              <Input
                value={searchCriteria.location.zipCode}
                onChange={(e) => setSearchCriteria(prev => ({
                  ...prev,
                  location: { ...prev.location, zipCode: e.target.value }
                }))}
                placeholder={t({ en: 'Enter ZIP code...', he: 'הכנס מיקוד...' })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                {t({ en: 'Radius (miles)', he: 'רדיוס (מייל)' })}
              </label>
              <select
                value={searchCriteria.radius}
                onChange={(e) => setSearchCriteria(prev => ({
                  ...prev,
                  radius: parseInt(e.target.value)
                }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value={5}>5 miles</option>
                <option value={10}>10 miles</option>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={searchPharmacies} 
                disabled={!searchCriteria.location.zipCode || searchLoading}
                className="w-full"
              >
                {searchLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t({ en: 'Searching...', he: 'מחפש...' })}
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    {t({ en: 'Search', he: 'חפש' })}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pharmacy Results */}
      {pharmacies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t({ en: 'Available Pharmacies', he: 'בתי מרקחת זמינים' })} ({pharmacies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pharmacies.map((pharmacy) => (
                <div
                  key={pharmacy.ncpdpId}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPharmacy?.ncpdpId === pharmacy.ncpdpId
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => selectPharmacy(pharmacy)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{pharmacy.name}</h4>
                        {pharmacy.isOpen !== undefined && (
                          <Badge 
                            variant={pharmacy.isOpen ? 'success' : 'secondary'}
                            className={pharmacy.isOpen ? '' : 'bg-red-100 text-red-800'}
                          >
                            {pharmacy.isOpen ? 
                              t({ en: 'Open', he: 'פתוח' }) : 
                              t({ en: 'Closed', he: 'סגור' })
                            }
                          </Badge>
                        )}
                        {pharmacy.acceptsInsurance && (
                          <Badge variant="outline">
                            {t({ en: 'Accepts Insurance', he: 'מקבל ביטוח' })}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {pharmacy.address.street}, {pharmacy.address.city}, {pharmacy.address.state} {pharmacy.address.zipCode}
                          {pharmacy.distance && (
                            <span className="ml-2 font-medium">
                              ({formatDistance(pharmacy.distance)})
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {pharmacy.contact.phone}
                        </div>
                        
                        {pharmacy.waitTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t({ en: 'Wait time:', he: 'זמן המתנה:' })} {pharmacy.waitTime}
                          </div>
                        )}
                      </div>
                      
                      {/* Services */}
                      {pharmacy.services && pharmacy.services.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {pharmacy.services.slice(0, 4).map((service, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {service.replace('_', ' ')}
                            </Badge>
                          ))}
                          {pharmacy.services.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{pharmacy.services.length - 4} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {pharmacy.capabilities?.electronicPrescribing && (
                        <div className="text-green-600">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                      )}
                      {selectedPharmacy?.ncpdpId === pharmacy.ncpdpId && (
                        <Badge variant="success">
                          {t({ en: 'Selected', he: 'נבחר' })}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insurance Verification */}
      {insuranceVerification && selectedPharmacy && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t({ en: 'Insurance Coverage Verification', he: 'אימות כיסוי ביטוחי' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insuranceVerification.coverageOptions.map((option, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium">{option.insurancePlan.planName}</h5>
                    <Badge variant={option.coverage.covered ? 'success' : 'destructive'}>
                      {option.coverage.covered ? 
                        t({ en: 'Covered', he: 'מכוסה' }) : 
                        t({ en: 'Not Covered', he: 'לא מכוסה' })
                      }
                    </Badge>
                  </div>
                  
                  {option.coverage.covered && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      {option.copay && (
                        <div>
                          <span className="font-medium">
                            {t({ en: 'Copay:', he: 'השתתפות עצמית:' })}
                          </span>
                          {' $' + option.copay}
                        </div>
                      )}
                      
                      {option.deductible && (
                        <div>
                          <span className="font-medium">
                            {t({ en: 'Deductible:', he: 'השתתפות:' })}
                          </span>
                          {' $' + option.deductible}
                        </div>
                      )}
                      
                      {option.priorAuthRequired && (
                        <div className="text-yellow-600">
                          <AlertCircle className="h-4 w-4 inline mr-1" />
                          {t({ en: 'Prior Auth Required', he: 'נדרש אישור מוקדם' })}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!option.coverage.covered && option.alternatives && option.alternatives.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                      <h6 className="font-medium text-blue-800 mb-1">
                        {t({ en: 'Covered Alternatives:', he: 'חלופות מכוסות:' })}
                      </h6>
                      <div className="text-sm text-blue-700">
                        {option.alternatives.slice(0, 3).join(', ')}
                        {option.alternatives.length > 3 && ` +${option.alternatives.length - 3} more`}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send Prescription */}
      {selectedPharmacy && !transmissionStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              {t({ en: 'Send Electronic Prescription', he: 'שלח מרשם אלקטרוני' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded border">
                <h5 className="font-medium mb-2">
                  {t({ en: 'Prescription Summary', he: 'סיכום מרשם' })}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">
                      {t({ en: 'Medication:', he: 'תרופה:' })}
                    </span>
                    {' ' + (prescriptionData?.medication?.name || 'N/A')}
                  </div>
                  <div>
                    <span className="font-medium">
                      {t({ en: 'Dosage:', he: 'מינון:' })}
                    </span>
                    {' ' + (prescriptionData?.dosage || 'N/A')}
                  </div>
                  <div>
                    <span className="font-medium">
                      {t({ en: 'Quantity:', he: 'כמות:' })}
                    </span>
                    {' ' + (prescriptionData?.quantity || 'N/A')}
                  </div>
                  <div>
                    <span className="font-medium">
                      {t({ en: 'Refills:', he: 'מילויים חוזרים:' })}
                    </span>
                    {' ' + (prescriptionData?.refills || 'N/A')}
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <h5 className="font-medium mb-2 text-blue-800">
                  {t({ en: 'Selected Pharmacy', he: 'בית מרקחת נבחר' })}
                </h5>
                <div className="text-sm text-blue-700">
                  <div className="font-medium">{selectedPharmacy.name}</div>
                  <div>{selectedPharmacy.address.street}, {selectedPharmacy.address.city}</div>
                  <div>{selectedPharmacy.contact.phone}</div>
                </div>
              </div>
              
              <Button 
                onClick={sendPrescription} 
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t({ en: 'Sending Prescription...', he: 'שולח מרשם...' })}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {t({ en: 'Send Electronic Prescription', he: 'שלח מרשם אלקטרוני' })}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transmission Status */}
      {transmissionStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {t({ en: 'Prescription Sent Successfully', he: 'מרשם נשלח בהצלחה' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div>
                    <strong>{t({ en: 'Transmission ID:', he: 'מזהה משלוח:' })}</strong>
                    {' ' + transmissionStatus.transmissionId}
                  </div>
                  <div>
                    <strong>{t({ en: 'Pharmacy:', he: 'בית מרקחת:' })}</strong>
                    {' ' + transmissionStatus.pharmacy.name}
                  </div>
                  <div>
                    <strong>{t({ en: 'Expected Processing Time:', he: 'זמן עיבוד צפוי:' })}</strong>
                    {' ' + transmissionStatus.trackingInfo.expectedProcessingTime}
                  </div>
                  {transmissionStatus.trackingInfo.statusCheckUrl && (
                    <div className="mt-3">
                      <Button variant="outline" size="sm">
                        <Clock className="h-4 w-4 mr-2" />
                        {t({ en: 'Track Status', he: 'עקוב אחר סטטוס' })}
                      </Button>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PharmacyIntegration;
```

### 5. Test Cases

```javascript
// backend/tests/pharmacyIntegrationService.test.js
const pharmacyIntegrationService = require('../services/pharmacyIntegrationService');
const SecureDataAccess = require('../services/secureDataAccess');

describe('PharmacyIntegrationService', () => {
  beforeAll(async () => {
    await pharmacyIntegrationService.initialize();
  });

  describe('sendElectronicPrescription', () => {
    test('should send prescription via SureScripts successfully', async () => {
      const mockPrescriptionData = {
        prescriptionId: 'rx123',
        patientId: 'patient123',
        prescriberId: 'doctor123',
        medication: {
          rxcui: '308136',
          name: 'Lisinopril 10mg',
          strength: '10mg',
          dosageForm: 'tablet'
        },
        dosage: '10mg',
        frequency: 'once daily',
        quantity: 30,
        daysSupply: 30,
        refills: 3,
        sig: 'Take one tablet by mouth daily'
      };

      const mockPharmacy = {
        ncpdpId: '1234567',
        name: 'Test Pharmacy',
        capabilities: { sureScripts: true },
        sureScriptsId: 'SP123456'
      };

      jest.spyOn(pharmacyIntegrationService, 'getPharmacyById')
        .mockResolvedValue(mockPharmacy);

      jest.spyOn(pharmacyIntegrationService, 'transmitPrescription')
        .mockResolvedValue({
          transmissionId: 'TX789',
          confirmation: { acknowledged: true },
          method: 'SureScripts'
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await pharmacyIntegrationService.sendElectronicPrescription(
        mockPrescriptionData,
        '1234567',
        context
      );

      expect(result.transmissionId).toBe('TX789');
      expect(result.status).toBe('sent');
      expect(result.pharmacy.name).toBe('Test Pharmacy');
    });

    test('should handle pharmacy not found error', async () => {
      jest.spyOn(pharmacyIntegrationService, 'getPharmacyById')
        .mockResolvedValue(null);

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      await expect(
        pharmacyIntegrationService.sendElectronicPrescription(
          { prescriptionId: 'rx123' },
          'invalid_pharmacy',
          context
        )
      ).rejects.toThrow('Pharmacy not found');
    });
  });

  describe('findPharmacies', () => {
    test('should find pharmacies by ZIP code', async () => {
      const searchCriteria = {
        location: { zipCode: '90210' },
        radius: 10,
        capabilities: ['electronicPrescribing']
      };

      const mockPharmacies = [
        {
          ncpdpId: '1234567',
          name: 'Beverly Hills Pharmacy',
          address: { zipCode: '90210' },
          capabilities: { electronicPrescribing: true }
        }
      ];

      jest.spyOn(SecureDataAccess, 'query')
        .mockResolvedValue(mockPharmacies);

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await pharmacyIntegrationService.findPharmacies(
        searchCriteria,
        context
      );

      expect(result.totalResults).toBe(1);
      expect(result.pharmacies[0].name).toBe('Beverly Hills Pharmacy');
    });

    test('should find pharmacies by location coordinates', async () => {
      const searchCriteria = {
        location: {
          coordinates: { latitude: 34.0522, longitude: -118.2437 }
        },
        radius: 5
      };

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      jest.spyOn(SecureDataAccess, 'query')
        .mockResolvedValue([]);

      const result = await pharmacyIntegrationService.findPharmacies(
        searchCriteria,
        context
      );

      expect(result.totalResults).toBe(0);
      expect(result.pharmacies).toHaveLength(0);
    });
  });

  describe('checkPrescriptionStatus', () => {
    test('should return current prescription status', async () => {
      const mockTransmission = {
        _id: 'tx123',
        transmissionId: 'TX789',
        status: 'ready',
        pharmacyId: '1234567',
        updatedAt: new Date()
      };

      const mockPharmacy = {
        ncpdpId: '1234567',
        name: 'Test Pharmacy',
        phone: '555-0123',
        capabilities: { sureScripts: true }
      };

      jest.spyOn(SecureDataAccess, 'query')
        .mockResolvedValue([mockTransmission]);

      jest.spyOn(pharmacyIntegrationService, 'getPharmacyById')
        .mockResolvedValue(mockPharmacy);

      jest.spyOn(pharmacyIntegrationService, 'checkStatusViaSureScripts')
        .mockResolvedValue({
          status: 'ready',
          lastUpdated: new Date(),
          estimatedReadyTime: new Date()
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await pharmacyIntegrationService.checkPrescriptionStatus(
        'rx123',
        '1234567',
        context
      );

      expect(result.status).toBe('ready');
      expect(result.transmissionId).toBe('TX789');
      expect(result.pharmacy.name).toBe('Test Pharmacy');
    });
  });

  describe('verifyInsuranceCoverage', () => {
    test('should verify insurance coverage successfully', async () => {
      const mockPatient = {
        _id: 'patient123',
        insurance: [{
          planName: 'Test Insurance',
          memberId: '123456789',
          rxBin: '123456',
          rxPcn: 'TEST'
        }]
      };

      const mockMedication = {
        rxcui: '308136',
        name: 'Lisinopril 10mg'
      };

      const mockPharmacy = {
        ncpdpId: '1234567',
        name: 'Test Pharmacy'
      };

      jest.spyOn(SecureDataAccess, 'findById')
        .mockResolvedValue(mockPatient);

      jest.spyOn(pharmacyIntegrationService, 'getPharmacyById')
        .mockResolvedValue(mockPharmacy);

      jest.spyOn(pharmacyIntegrationService, 'checkCoverageWithPBM')
        .mockResolvedValue({
          coverage: { covered: true },
          copay: 10,
          deductible: 0,
          priorAuthRequired: false
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await pharmacyIntegrationService.verifyInsuranceCoverage(
        'patient123',
        mockMedication,
        '1234567',
        context
      );

      expect(result.coverageOptions).toHaveLength(1);
      expect(result.coverageOptions[0].coverage.covered).toBe(true);
      expect(result.coverageOptions[0].copay).toBe(10);
    });
  });

  describe('utility functions', () => {
    test('should generate valid message ID', () => {
      const messageId = pharmacyIntegrationService.generateMessageId();
      expect(messageId).toMatch(/^MSG_\d+_[a-z0-9]{9}$/);
    });

    test('should get correct status description', () => {
      expect(pharmacyIntegrationService.getStatusDescription('transmitted'))
        .toBe('Prescription sent to pharmacy');
      expect(pharmacyIntegrationService.getStatusDescription('ready'))
        .toBe('Prescription is ready for pickup');
      expect(pharmacyIntegrationService.getStatusDescription('unknown'))
        .toBe('Unknown status');
    });
  });
});
```

## Dependencies
- SureScripts network connectivity
- NCPDP SCRIPT messaging standards
- HL7 integration capabilities
- Pharmacy directory services
- Insurance verification systems
- Real-time status polling
- Prescription management system

## Success Criteria
- ✅ Complete SureScripts network integration
- ✅ Electronic prescription transmission (NCPDP SCRIPT)
- ✅ Real-time prescription status tracking
- ✅ Pharmacy search and directory services
- ✅ Insurance coverage verification
- ✅ Multiple transmission methods (electronic, fax, direct)
- ✅ Comprehensive audit trail
- ✅ Error handling and retry mechanisms