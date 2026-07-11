# Verify Benefits - Implementation Task

## Function Details
- **Function Name**: `verifyBenefits`
- **Location**: `backend/services/benefitsVerificationService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Estimated Time**: 3-4 days
- **Complexity**: High

## Problem Description
Implement comprehensive benefits verification functionality to determine patient coverage details, deductibles, copayments, coinsurance, out-of-network penalties, and pre-authorization requirements. The system must integrate with multiple payers using various methods (X12 270/271, APIs, web portals) and provide real-time benefits information for treatment planning and patient financial counseling.

## Implementation Steps

### 1. Benefits Verification Service Implementation

```javascript
// File: backend/services/benefitsVerificationService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const X12TransactionService = require('./x12TransactionService');
const PayerAPIService = require('./payerAPIService');
const NotificationService = require('./notificationService');

class BenefitsVerificationService {
  constructor() {
    this.benefitCategories = {
      'medical': 'Medical Care',
      'preventive': 'Preventive Care',
      'diagnostic': 'Diagnostic Services',
      'laboratory': 'Laboratory Services',
      'radiology': 'Radiology Services',
      'surgical': 'Surgical Services',
      'emergency': 'Emergency Services',
      'urgent_care': 'Urgent Care',
      'specialist': 'Specialist Care',
      'mental_health': 'Mental Health Services',
      'substance_abuse': 'Substance Abuse Treatment',
      'maternity': 'Maternity Care',
      'prescription': 'Prescription Drugs',
      'dme': 'Durable Medical Equipment'
    };

    this.serviceTypeCodes = {
      '1': 'Medical Care',
      '2': 'Surgical',
      '3': 'Consultation',
      '4': 'Diagnostic X-Ray',
      '5': 'Diagnostic Lab',
      '6': 'Radiation Therapy',
      '12': 'Durable Medical Equipment',
      '13': 'Prosthetics',
      '14': 'Dental Care',
      '15': 'Vision Care',
      '30': 'Health Benefit Plan Coverage',
      '33': 'Chiropractic',
      '35': 'Dental Crowns',
      '41': 'Routine Preventive Dental',
      '42': 'Home Health Care',
      '47': 'Hospital',
      '48': 'Hospital - Inpatient',
      '49': 'Hospital - Outpatient',
      '50': 'Hospital - Emergency Accident',
      '86': 'Emergency Services',
      '88': 'Pharmacy',
      '98': 'Professional Physician Visit - Office',
      'A0': 'Transportation Services - Ambulance',
      'A4': 'Psychiatric',
      'A6': 'Psychotherapy',
      'A7': 'Psychiatric - Inpatient',
      'A8': 'Psychiatric - Outpatient',
      'AL': 'Vision Coverage',
      'F1': 'Medical Coverage'
    };
  }

  async verifyBenefits(verificationRequest, context) {
    try {
      // Validate request
      await this.validateVerificationRequest(verificationRequest, context);

      // Get patient and insurance information
      const patientInsurance = await this.getPatientInsurance(
        verificationRequest.patientId, 
        verificationRequest.insurancePriority || 1, 
        context
      );

      // Determine verification method based on payer capabilities
      const verificationMethod = await this.determineVerificationMethod(patientInsurance.payer, context);

      let benefitsData;
      
      switch (verificationMethod) {
        case 'x12_270_271':
          benefitsData = await this.verifyViaX12(verificationRequest, patientInsurance, context);
          break;
        case 'api':
          benefitsData = await this.verifyViaAPI(verificationRequest, patientInsurance, context);
          break;
        case 'portal':
          benefitsData = await this.verifyViaPortal(verificationRequest, patientInsurance, context);
          break;
        default:
          throw new Error('No verification method available for this payer');
      }

      // Process and standardize benefits data
      const standardizedBenefits = await this.standardizeBenefitsData(benefitsData, context);

      // Store verification result
      const verificationResult = await this.storeBenefitsVerification(
        verificationRequest, 
        standardizedBenefits, 
        patientInsurance, 
        context
      );

      // Calculate estimated patient costs for requested services
      if (verificationRequest.serviceCodes) {
        verificationResult.estimatedCosts = await this.calculateEstimatedCosts(
          verificationRequest.serviceCodes,
          standardizedBenefits,
          context
        );
      }

      // Create audit log
      await this.createAuditLog(verificationRequest, verificationResult, context);

      return verificationResult;

    } catch (error) {
      await AuditLog.create({
        action: 'BENEFITS_VERIFICATION_ERROR',
        patientId: verificationRequest.patientId,
        error: error.message,
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async getPatientInsurance(patientId, priority, context) {
    const insurance = await SecureDataAccess.query('patient_insurance',
      { 
        patientId, 
        priority,
        status: 'active',
        effectiveDate: { $lte: new Date() },
        $or: [
          { terminationDate: { $exists: false } },
          { terminationDate: { $gte: new Date() } }
        ]
      },
      { include: ['payer', 'member', 'subscriber'] },
      context
    );

    if (!insurance.length) {
      throw new Error('No active insurance found for patient');
    }

    return insurance[0];
  }

  async determineVerificationMethod(payer, context) {
    // Check payer capabilities
    const payerConfig = await SecureDataAccess.query('payer_configurations',
      { payerId: payer.id },
      {},
      context
    );

    if (!payerConfig.length) {
      throw new Error('Payer configuration not found');
    }

    const config = payerConfig[0];
    
    // Priority order: API > X12 > Portal
    if (config.capabilities.eligibilityAPI) {
      return 'api';
    } else if (config.capabilities.x12_270_271) {
      return 'x12_270_271';
    } else if (config.capabilities.webPortal) {
      return 'portal';
    }

    throw new Error('No supported verification method available');
  }

  async verifyViaX12(request, insurance, context) {
    const x12Service = new X12TransactionService();
    
    // Build X12 270 eligibility inquiry
    const eligibilityInquiry = {
      transactionSetHeader: {
        transactionSetIdentifierCode: '270',
        transactionSetControlNumber: this.generateControlNumber(),
        implementationConventionReference: '005010X279A1'
      },
      beginningOfHierarchicalTransaction: {
        hierarchicalStructureCode: '0022',
        transactionSetPurposeCode: '11', // Response
        referenceIdentification: request.referenceNumber || this.generateReferenceNumber(),
        date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        time: new Date().toTimeString().slice(0, 8).replace(/:/g, '')
      },
      informationSourceName: {
        entityIdentifierCode: 'PR',
        entityTypeQualifier: '2',
        nameLastOrOrganizationName: insurance.payer.name,
        identificationCodeQualifier: 'PI',
        identificationCode: insurance.payer.id
      },
      informationReceiverName: {
        entityIdentifierCode: '41',
        entityTypeQualifier: '2',
        nameLastOrOrganizationName: context.practice.name,
        identificationCodeQualifier: 'XX',
        identificationCode: context.practice.npi
      },
      subscriberHierarchicalLevel: {
        hierarchicalIDNumber: '1',
        hierarchicalParentIDNumber: '',
        hierarchicalLevelCode: '22',
        hierarchicalChildCode: '0'
      },
      subscriberInformation: {
        entityIdentifierCode: 'IL',
        entityTypeQualifier: '1',
        nameLastOrOrganizationName: insurance.subscriber.lastName,
        nameFirst: insurance.subscriber.firstName,
        nameMiddle: insurance.subscriber.middleName,
        identificationCodeQualifier: 'MI',
        identificationCode: insurance.memberId
      },
      subscriberDemographics: {
        dateTimePeriodFormatQualifier: 'D8',
        dateTimePeriod: insurance.subscriber.dateOfBirth.toISOString().slice(0, 10).replace(/-/g, ''),
        genderCode: insurance.subscriber.gender
      },
      eligibilityOrBenefitInquiry: request.serviceCodes ? 
        request.serviceCodes.map(serviceCode => ({
          eligibilityOrBenefitInformationCode: '1', // Active Coverage
          serviceTypeCode: this.mapServiceCodeToTypeCode(serviceCode),
          procedureIdentifier: serviceCode
        })) : [{
          eligibilityOrBenefitInformationCode: '1'
        }]
    };

    // Submit inquiry and get response
    const response = await x12Service.submitTransaction(
      '270', 
      eligibilityInquiry, 
      insurance.payer, 
      context
    );

    // Parse X12 271 response
    if (response.transactionSetIdentifierCode === '271') {
      return this.parseX12271Response(response);
    }

    throw new Error('Invalid response format from payer');
  }

  parseX12271Response(response271) {
    const benefitsData = {
      eligibilityStatus: this.parseEligibilityStatus(response271.eligibilityOrBenefitInformation),
      memberInfo: {
        memberId: response271.subscriberInformation.identificationCode,
        name: `${response271.subscriberInformation.nameFirst} ${response271.subscriberInformation.nameLastOrOrganizationName}`,
        dateOfBirth: response271.subscriberDemographics?.dateTimePeriod,
        gender: response271.subscriberDemographics?.genderCode
      },
      planInfo: {
        planName: response271.healthCareInformation?.planCoverageDescription,
        groupNumber: response271.healthCareInformation?.groupNumber,
        effectiveDate: response271.healthCareInformation?.planBeginDate,
        terminationDate: response271.healthCareInformation?.planEndDate
      },
      benefits: [],
      deductibles: [],
      copayments: [],
      coinsurance: [],
      outOfPocket: [],
      exclusions: [],
      limitations: []
    };

    // Parse benefit details
    if (response271.eligibilityOrBenefitInformation) {
      for (const benefit of response271.eligibilityOrBenefitInformation) {
        this.parseBenefitDetail(benefit, benefitsData);
      }
    }

    return benefitsData;
  }

  parseBenefitDetail(benefit, benefitsData) {
    const serviceType = this.serviceTypeCodes[benefit.serviceTypeCode] || 'General';
    const benefitType = benefit.eligibilityOrBenefitInformationCode;

    switch (benefitType) {
      case '1': // Active Coverage
        benefitsData.benefits.push({
          serviceType,
          status: 'active',
          coverageLevel: benefit.coverageLevel,
          networkIndicator: benefit.planNetworkIndicationCode
        });
        break;

      case '2': // Deductible
        benefitsData.deductibles.push({
          serviceType,
          amount: parseFloat(benefit.monetaryAmount),
          timePeriod: benefit.timePeriodQualifier,
          individual: benefit.entityTypeQualifier === '1',
          family: benefit.entityTypeQualifier === '2',
          remaining: parseFloat(benefit.percentageAsDecimal) * parseFloat(benefit.monetaryAmount)
        });
        break;

      case '3': // Out of Pocket
        benefitsData.outOfPocket.push({
          serviceType,
          amount: parseFloat(benefit.monetaryAmount),
          timePeriod: benefit.timePeriodQualifier,
          individual: benefit.entityTypeQualifier === '1',
          family: benefit.entityTypeQualifier === '2',
          remaining: parseFloat(benefit.percentageAsDecimal) * parseFloat(benefit.monetaryAmount)
        });
        break;

      case '4': // Copayment
        benefitsData.copayments.push({
          serviceType,
          amount: parseFloat(benefit.monetaryAmount),
          networkIndicator: benefit.planNetworkIndicationCode
        });
        break;

      case '5': // Coinsurance
        benefitsData.coinsurance.push({
          serviceType,
          percentage: parseFloat(benefit.percentageAsDecimal) * 100,
          networkIndicator: benefit.planNetworkIndicationCode
        });
        break;

      case '6': // Limitations
        benefitsData.limitations.push({
          serviceType,
          limitationType: benefit.quantityQualifier,
          quantity: parseFloat(benefit.quantity),
          timePeriod: benefit.timePeriodQualifier,
          description: benefit.messageText
        });
        break;

      case '7': // Exclusions
        benefitsData.exclusions.push({
          serviceType,
          reason: benefit.messageText,
          code: benefit.compositeCode
        });
        break;
    }
  }

  parseEligibilityStatus(eligibilityInfo) {
    if (!eligibilityInfo || !eligibilityInfo.length) {
      return 'unknown';
    }

    // Look for general eligibility status
    const generalEligibility = eligibilityInfo.find(info => 
      info.eligibilityOrBenefitInformationCode === '1'
    );

    return generalEligibility ? 'active' : 'inactive';
  }

  async verifyViaAPI(request, insurance, context) {
    const payerAPI = new PayerAPIService();
    
    const apiRequest = {
      member: {
        memberId: insurance.memberId,
        firstName: insurance.subscriber.firstName,
        lastName: insurance.subscriber.lastName,
        dateOfBirth: insurance.subscriber.dateOfBirth.toISOString().slice(0, 10),
        gender: insurance.subscriber.gender
      },
      provider: {
        npi: context.practice.npi,
        taxId: context.practice.taxId
      },
      serviceCodes: request.serviceCodes,
      serviceDate: request.serviceDate || new Date().toISOString().slice(0, 10)
    };

    const response = await payerAPI.checkEligibility(insurance.payer, apiRequest, context);
    
    return this.standardizeAPIResponse(response);
  }

  standardizeAPIResponse(apiResponse) {
    // Convert payer-specific API response to standard format
    return {
      eligibilityStatus: apiResponse.eligible ? 'active' : 'inactive',
      memberInfo: apiResponse.member,
      planInfo: apiResponse.plan,
      benefits: apiResponse.benefits || [],
      deductibles: apiResponse.deductibles || [],
      copayments: apiResponse.copayments || [],
      coinsurance: apiResponse.coinsurance || [],
      outOfPocket: apiResponse.outOfPocket || [],
      exclusions: apiResponse.exclusions || [],
      limitations: apiResponse.limitations || []
    };
  }

  async standardizeBenefitsData(benefitsData, context) {
    // Standardize and validate benefits data
    const standardized = {
      verificationDate: new Date(),
      eligibilityStatus: benefitsData.eligibilityStatus,
      memberInfo: benefitsData.memberInfo,
      planInfo: benefitsData.planInfo,
      networkStatus: benefitsData.networkStatus || 'in-network',
      benefits: this.categorizeBenefits(benefitsData.benefits),
      costSharing: {
        deductibles: this.standardizeDeductibles(benefitsData.deductibles),
        copayments: this.standardizeCopayments(benefitsData.copayments),
        coinsurance: this.standardizeCoinsurance(benefitsData.coinsurance),
        outOfPocket: this.standardizeOutOfPocket(benefitsData.outOfPocket)
      },
      limitations: benefitsData.limitations,
      exclusions: benefitsData.exclusions,
      priorAuthRequired: this.determinePriorAuthRequirement(benefitsData),
      referralRequired: this.determineReferralRequirement(benefitsData)
    };

    return standardized;
  }

  categorizeBenefits(benefits) {
    const categorized = {};
    
    for (const benefit of benefits) {
      const category = this.mapServiceTypeToCategory(benefit.serviceType);
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(benefit);
    }

    return categorized;
  }

  async calculateEstimatedCosts(serviceCodes, benefits, context) {
    const estimates = [];

    for (const serviceCode of serviceCodes) {
      const serviceCategory = this.mapServiceCodeToCategory(serviceCode);
      const estimate = await this.calculateServiceCost(serviceCode, serviceCategory, benefits, context);
      estimates.push(estimate);
    }

    return {
      services: estimates,
      totalEstimate: estimates.reduce((sum, est) => sum + est.patientCost, 0),
      disclaimer: 'This is an estimate only. Actual costs may vary based on specific services provided and contract terms.'
    };
  }

  async calculateServiceCost(serviceCode, category, benefits, context) {
    // Get typical charges for this service
    const feeSchedule = await SecureDataAccess.query('fee_schedule',
      { procedureCode: serviceCode },
      {},
      context
    );

    const standardCharge = feeSchedule.length > 0 ? feeSchedule[0].amount : 0;
    
    // Apply deductible
    const applicableDeductible = benefits.costSharing.deductibles.find(d => 
      d.serviceType === category || d.serviceType === 'General'
    );

    // Apply copay
    const applicableCopay = benefits.costSharing.copayments.find(c => 
      c.serviceType === category || c.serviceType === 'General'
    );

    // Apply coinsurance
    const applicableCoinsurance = benefits.costSharing.coinsurance.find(c => 
      c.serviceType === category || c.serviceType === 'General'
    );

    let patientCost = 0;
    let insurancePays = 0;

    if (applicableCopay) {
      // Copay-based
      patientCost = applicableCopay.amount;
      insurancePays = Math.max(0, standardCharge - patientCost);
    } else if (applicableCoinsurance) {
      // Coinsurance-based
      const deductibleAmount = applicableDeductible?.remaining || 0;
      const afterDeductible = Math.max(0, standardCharge - deductibleAmount);
      patientCost = deductibleAmount + (afterDeductible * applicableCoinsurance.percentage / 100);
      insurancePays = standardCharge - patientCost;
    } else {
      // Full coverage after deductible
      const deductibleAmount = applicableDeductible?.remaining || 0;
      patientCost = Math.min(deductibleAmount, standardCharge);
      insurancePays = standardCharge - patientCost;
    }

    return {
      serviceCode,
      description: await this.getServiceDescription(serviceCode, context),
      category,
      standardCharge,
      patientCost: Math.max(0, patientCost),
      insurancePays: Math.max(0, insurancePays),
      deductibleApplied: applicableDeductible?.remaining || 0,
      costBasis: applicableCopay ? 'copay' : applicableCoinsurance ? 'coinsurance' : 'after-deductible'
    };
  }

  async storeBenefitsVerification(request, benefits, insurance, context) {
    const verificationRecord = {
      patientId: request.patientId,
      insuranceId: insurance._id,
      payerId: insurance.payer.id,
      payerName: insurance.payer.name,
      verificationDate: new Date(),
      requestedServices: request.serviceCodes || [],
      eligibilityStatus: benefits.eligibilityStatus,
      networkStatus: benefits.networkStatus,
      benefitsData: benefits,
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      verifiedBy: context.userId,
      status: 'active'
    };

    const savedVerification = await SecureDataAccess.create(
      'benefits_verifications', 
      verificationRecord, 
      context
    );

    return {
      verificationId: savedVerification._id,
      ...benefits,
      expirationDate: verificationRecord.expirationDate
    };
  }

  mapServiceCodeToCategory(serviceCode) {
    const codeRanges = {
      'medical': ['99201', '99499'],
      'surgical': ['10021', '69990'],
      'radiology': ['70010', '79999'],
      'laboratory': ['80047', '89398'],
      'preventive': ['99381', '99429']
    };

    for (const [category, [start, end]] of Object.entries(codeRanges)) {
      if (serviceCode >= start && serviceCode <= end) {
        return category;
      }
    }

    return 'medical';
  }

  mapServiceCodeToTypeCode(serviceCode) {
    // Map CPT codes to X12 service type codes
    const codeMap = {
      '99': '98', // Office visits
      '90': '88', // Pharmacy
      '70': '4',  // Diagnostic X-Ray
      '80': '5',  // Diagnostic Lab
      '10': '2'   // Surgical
    };

    const prefix = serviceCode.substring(0, 2);
    return codeMap[prefix] || '1'; // Default to Medical Care
  }

  generateControlNumber() {
    return Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
  }

  generateReferenceNumber() {
    return 'BV' + Date.now().toString();
  }

  async validateVerificationRequest(request, context) {
    if (!request.patientId) {
      throw new Error('Patient ID is required');
    }

    if (request.serviceCodes && !Array.isArray(request.serviceCodes)) {
      throw new Error('Service codes must be an array');
    }

    if (request.serviceDate && new Date(request.serviceDate) > new Date()) {
      // Allow future dates for scheduling purposes
    }
  }

  async createAuditLog(request, result, context) {
    await AuditLog.create({
      action: 'VERIFY_BENEFITS',
      patientId: request.patientId,
      verificationId: result.verificationId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        eligibilityStatus: result.eligibilityStatus,
        serviceCodes: request.serviceCodes || [],
        estimatedCosts: result.estimatedCosts?.totalEstimate
      },
      timestamp: new Date()
    });
  }
}

module.exports = BenefitsVerificationService;
```

### 2. API Endpoints

```javascript
// File: backend/routes/benefits.js
const express = require('express');
const router = express.Router();
const BenefitsVerificationService = require('../services/benefitsVerificationService');
const { requireAuth } = require('../middleware/auth');

router.post('/verify', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      practice: req.practice,
      serviceId: 'benefits-verification-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_BENEFITS_VERIFICATION_KEY')
    };

    const benefitsService = new BenefitsVerificationService();
    const result = await benefitsService.verifyBenefits(req.body, context);

    res.json({
      success: true,
      verification: result,
      message: {
        he: 'אימות זכויות הושלם בהצלחה',
        en: 'Benefits verification completed successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה באימות זכויות',
        en: 'Error verifying benefits'
      },
      details: error.message
    });
  }
});

router.get('/patient/:patientId/history', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'benefits-verification-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_BENEFITS_VERIFICATION_KEY')
    };

    const verifications = await SecureDataAccess.query('benefits_verifications',
      { patientId },
      { 
        sort: { verificationDate: -1 },
        limit: 10
      },
      context
    );

    res.json({ verifications });
  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בקבלת היסטוריית אימותים',
        en: 'Error retrieving verification history'
      },
      details: error.message
    });
  }
});
```

### 3. Frontend Component

```jsx
// File: frontend-vite/src/components/benefits/BenefitsVerifier.jsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Shield, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import secureApi from '../../services/secureApiClient';

const BenefitsVerifier = ({ patientId, onVerificationComplete }) => {
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState(null);
  const [serviceCodes, setServiceCodes] = useState(['']);

  const verifyBenefits = async () => {
    setVerifying(true);
    try {
      const response = await secureApi.post('/api/benefits/verify', {
        patientId,
        serviceCodes: serviceCodes.filter(code => code.trim())
      });

      setVerification(response.data.verification);
      onVerificationComplete?.(response.data.verification);

    } catch (error) {
      console.error('Error verifying benefits:', error);
    } finally {
      setVerifying(false);
    }
  };

  const addServiceCode = () => {
    setServiceCodes([...serviceCodes, '']);
  };

  const updateServiceCode = (index, value) => {
    const newCodes = [...serviceCodes];
    newCodes[index] = value;
    setServiceCodes(newCodes);
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'inactive': 'bg-red-100 text-red-800',
      'unknown': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Verification Request */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Benefits Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Service Codes */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Service Codes (Optional)
              </label>
              {serviceCodes.map((code, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => updateServiceCode(index, e.target.value)}
                    placeholder="CPT Code (e.g., 99213)"
                    className="flex-1 border rounded-lg px-3 py-2"
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addServiceCode}>
                Add Service Code
              </Button>
            </div>

            {/* Verify Button */}
            <Button 
              onClick={verifyBenefits} 
              disabled={verifying || !patientId}
              className="w-full"
            >
              {verifying ? 'Verifying Benefits...' : 'Verify Benefits'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Verification Results */}
      {verification && (
        <div className="space-y-6">
          {/* Eligibility Status */}
          <Card>
            <CardHeader>
              <CardTitle>Eligibility Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                {verification.eligibilityStatus === 'active' ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                )}
                <div>
                  <Badge className={getStatusColor(verification.eligibilityStatus)}>
                    {verification.eligibilityStatus.toUpperCase()}
                  </Badge>
                  <p className="text-sm text-gray-600 mt-1">
                    Verified on {new Date(verification.verificationDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Member Info */}
              {verification.memberInfo && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Member ID:</strong> {verification.memberInfo.memberId}
                  </div>
                  <div>
                    <strong>Network Status:</strong> {verification.networkStatus}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Sharing */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Sharing Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Deductibles */}
                {verification.costSharing?.deductibles?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Deductibles</h4>
                    {verification.costSharing.deductibles.map((deductible, index) => (
                      <div key={index} className="p-2 bg-blue-50 rounded">
                        <div className="text-sm font-medium">{deductible.serviceType}</div>
                        <div className="text-sm">${deductible.amount}</div>
                        <div className="text-xs text-gray-600">
                          Remaining: ${deductible.remaining}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Copayments */}
                {verification.costSharing?.copayments?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Copayments</h4>
                    {verification.costSharing.copayments.map((copay, index) => (
                      <div key={index} className="p-2 bg-green-50 rounded">
                        <div className="text-sm font-medium">{copay.serviceType}</div>
                        <div className="text-sm">${copay.amount}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Coinsurance */}
                {verification.costSharing?.coinsurance?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Coinsurance</h4>
                    {verification.costSharing.coinsurance.map((coins, index) => (
                      <div key={index} className="p-2 bg-yellow-50 rounded">
                        <div className="text-sm font-medium">{coins.serviceType}</div>
                        <div className="text-sm">{coins.percentage}%</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Out of Pocket */}
                {verification.costSharing?.outOfPocket?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Out of Pocket Max</h4>
                    {verification.costSharing.outOfPocket.map((oop, index) => (
                      <div key={index} className="p-2 bg-purple-50 rounded">
                        <div className="text-sm font-medium">{oop.serviceType}</div>
                        <div className="text-sm">${oop.amount}</div>
                        <div className="text-xs text-gray-600">
                          Remaining: ${oop.remaining}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Estimated Costs */}
          {verification.estimatedCosts && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Estimated Patient Costs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {verification.estimatedCosts.services.map((service, index) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <div className="font-medium">{service.serviceCode}</div>
                        <div className="text-sm text-gray-600">{service.description}</div>
                        <div className="text-xs text-gray-500">
                          Basis: {service.costBasis}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${service.patientCost.toFixed(2)}</div>
                        <div className="text-sm text-gray-600">
                          of ${service.standardCharge.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t pt-3 flex justify-between font-bold">
                    <span>Total Estimated Cost:</span>
                    <span>${verification.estimatedCosts.totalEstimate.toFixed(2)}</span>
                  </div>
                  
                  <div className="text-xs text-gray-500 italic">
                    {verification.estimatedCosts.disclaimer}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Authorization Requirements */}
          <Card>
            <CardHeader>
              <CardTitle>Authorization Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  {verification.priorAuthRequired ? (
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <span>
                    Prior Authorization: {verification.priorAuthRequired ? 'Required' : 'Not Required'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {verification.referralRequired ? (
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <span>
                    Referral: {verification.referralRequired ? 'Required' : 'Not Required'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BenefitsVerifier;
```

## Test Cases

### Unit Tests

```javascript
// File: backend/tests/benefitsVerificationService.test.js
const BenefitsVerificationService = require('../services/benefitsVerificationService');

describe('BenefitsVerificationService', () => {
  let service;
  let mockContext;

  beforeEach(() => {
    service = new BenefitsVerificationService();
    mockContext = {
      userId: 'user123',
      practiceId: 'clinic123'
    };
  });

  test('should verify benefits successfully', async () => {
    const request = {
      patientId: 'patient123',
      serviceCodes: ['99213']
    };

    const result = await service.verifyBenefits(request, mockContext);
    expect(result.eligibilityStatus).toBeDefined();
  });

  test('should calculate estimated costs correctly', async () => {
    const serviceCodes = ['99213'];
    const benefits = {
      costSharing: {
        copayments: [{ serviceType: 'medical', amount: 25 }]
      }
    };

    const estimates = await service.calculateEstimatedCosts(serviceCodes, benefits, mockContext);
    expect(estimates.services).toHaveLength(1);
  });
});
```

## Dependencies
- SecureDataAccess service
- X12 transaction service
- Payer API integrations
- Audit logging system
- Notification service

## Success Criteria
- [ ] Benefits verified across multiple payer types
- [ ] X12 270/271 transactions working correctly
- [ ] API integrations functional
- [ ] Cost estimates calculated accurately
- [ ] Prior authorization requirements identified
- [ ] Multi-language support implemented
- [ ] Real-time verification capabilities
- [ ] Comprehensive audit trail
- [ ] Performance handles high verification volume
- [ ] Integration with scheduling and billing systems