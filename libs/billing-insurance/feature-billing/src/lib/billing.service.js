// Billing Service
// Comprehensive billing and revenue cycle management service
// Handles charge capture, claim generation, insurance eligibility, and payment processing
// SECURITY: All database access through secureDataAccess

const crypto = require('crypto');

// Service proxy for lazy loading (prevents circular dependencies)
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class BillingService {
  constructor() {
    this.serviceId = 'billing-service';
    this.serviceToken = null;
    this.initialized = false;
    this.cptCodes = new Map();
    this.icd10Codes = new Map();
    this.payers = new Map();
    this.chargeCaptureQueue = [];
    this.claimProcessingQueue = [];
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      await this.loadBillingCodes();
      await this.loadPayerConfigurations();
      this.initialized = true;
      console.log('BillingService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BillingService:', error);
      throw error;
    }
  }

  getServiceContext(practiceId = 'global', operation = 'billing-operations') {
    return {
      serviceId: this.serviceId,
      operation,
      practiceId
    };
  }

  async loadBillingCodes() {
    try {
      const cptCodesData = await secureDataAccess.query(
        'billing_codes',
        { type: 'CPT', active: true },
        { limit: 10000 },
        this.getServiceContext('global', 'load-billing-codes')
      );

      const icd10CodesData = await secureDataAccess.query(
        'billing_codes',
        { type: 'ICD10', active: true },
        { limit: 50000 },
        this.getServiceContext('global', 'load-billing-codes')
      );

      cptCodesData.forEach(code => {
        this.cptCodes.set(code.code, {
          description: code.description,
          category: code.category,
          rvu: code.rvu,
          globalPeriod: code.globalPeriod,
          modifiers: code.modifiers || []
        });
      });

      icd10CodesData.forEach(code => {
        this.icd10Codes.set(code.code, {
          description: code.description,
          category: code.category,
          isValid: code.isValid
        });
      });
    } catch (error) {
      console.error('Failed to load billing codes:', error);
      this.cptCodes = new Map();
      this.icd10Codes = new Map();
    }
  }

  async loadPayerConfigurations() {
    try {
      const payersData = await secureDataAccess.query(
        'insurance_payers',
        { active: true },
        { limit: 1000 },
        this.getServiceContext('global', 'load-payer-configs')
      );

      payersData.forEach(payer => {
        this.payers.set(payer.payerId, {
          name: payer.name,
          type: payer.type,
          clearinghouse: payer.clearinghouse,
          ediFormat: payer.ediFormat,
          submissionEndpoint: payer.submissionEndpoint,
          requiresAuth: payer.requiresAuth,
          feeSchedule: payer.feeSchedule || {}
        });
      });
    } catch (error) {
      console.error('Failed to load payer configurations:', error);
      this.payers = new Map();
    }
  }

  async captureCharge(chargeData, context) {
    await this.initialize();

    try {
      const { 
        patientId, 
        providerId, 
        appointmentId,
        serviceDate,
        cptCode,
        modifiers = [],
        diagnosisCodes = [],
        units = 1,
        duration,
        placeOfService = '11'
      } = chargeData;

      if (!this.cptCodes.has(cptCode)) {
        throw new Error(`Invalid CPT code: ${cptCode}`);
      }

      diagnosisCodes.forEach(code => {
        if (!this.icd10Codes.has(code)) {
          throw new Error(`Invalid ICD-10 code: ${code}`);
        }
      });

      const cptInfo = this.cptCodes.get(cptCode);
      const baseRVU = cptInfo.rvu || 1.0;
      const calculatedUnits = this.calculateUnits(cptCode, duration, units);

      const charge = {
        chargeId: crypto.randomBytes(16).toString('hex'),
        patientId,
        providerId,
        appointmentId,
        practiceId: context.practiceId,
        serviceDate,
        captureDate: new Date(),
        cptCode,
        cptDescription: cptInfo.description,
        modifiers,
        diagnosisCodes,
        units: calculatedUnits,
        placeOfService,
        rvu: baseRVU * calculatedUnits,
        status: 'captured',
        billingStatus: 'pending',
        createdAt: new Date()
      };

      await secureDataAccess.create(
        'charges',
        charge,
        this.getServiceContext(context.practiceId, 'capture-charge')
      );

      // Log the charge capture in audit log
      await secureDataAccess.create('audit_logs', {
        action: 'CHARGE_CAPTURED',
        category: 'billing',
        patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: {
          chargeId: charge.chargeId,
          cptCode,
          amount: charge.rvu
        },
        timestamp: new Date()
      }, this.getServiceContext(context.practiceId, 'audit-charge-capture'));

      this.chargeCaptureQueue.push(charge);
      
      if (this.chargeCaptureQueue.length >= 10) {
        await this.processBatchCharges(context);
      }

      return charge;
    } catch (error) {
      console.error('Failed to capture charge:', error);
      throw error;
    }
  }

  calculateUnits(cptCode, duration, defaultUnits) {
    const timeBasedCodes = ['99213', '99214', '99215', '99232', '99233'];
    
    if (timeBasedCodes.includes(cptCode) && duration) {
      return Math.ceil(duration / 15);
    }
    
    return defaultUnits;
  }

  async processBatchCharges(context) {
    if (this.chargeCaptureQueue.length === 0) return;

    try {
      const batch = this.chargeCaptureQueue.splice(0, 10);
      
      for (const charge of batch) {
        const claim = await this.generateClaim(charge, context);
        if (claim) {
          this.claimProcessingQueue.push(claim);
        }
      }

      if (this.claimProcessingQueue.length >= 5) {
        await this.submitBatchClaims(context);
      }
    } catch (error) {
      console.error('Failed to process batch charges:', error);
      this.chargeCaptureQueue.unshift(...batch);
    }
  }

  async generateClaim(charge, context) {
    try {
      const patients = await secureDataAccess.query(
        'patients',
        { _id: charge.patientId },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'generate-claim')
      );
      const patient = patients[0];

      const providers = await secureDataAccess.query(
        'providers',
        { _id: charge.providerId },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'generate-claim')
      );
      const provider = providers[0];

      const insurance = await this.getPatientInsurance(charge.patientId, context);
      
      if (!insurance) {
        return await this.generateSelfPayInvoice(charge, patient, context);
      }

      const payer = this.payers.get(insurance.payerId);
      if (!payer) {
        throw new Error(`Payer configuration not found: ${insurance.payerId}`);
      }

      const claim = {
        claimId: crypto.randomBytes(16).toString('hex'),
        claimNumber: this.generateClaimNumber(context.practiceId),
        chargeId: charge.chargeId,
        patientId: charge.patientId,
        providerId: charge.providerId,
        practiceId: context.practiceId,
        payerId: insurance.payerId,
        payerName: payer.name,
        subscriberId: insurance.subscriberId,
        groupNumber: insurance.groupNumber,
        serviceDate: charge.serviceDate,
        billingProvider: {
          npi: provider.npi,
          taxId: provider.taxId,
          name: provider.name,
          address: provider.address
        },
        renderingProvider: {
          npi: provider.npi,
          name: provider.name
        },
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          address: patient.address
        },
        services: [{
          lineNumber: 1,
          serviceDate: charge.serviceDate,
          placeOfService: charge.placeOfService,
          cptCode: charge.cptCode,
          modifiers: charge.modifiers,
          diagnosisCodes: charge.diagnosisCodes,
          units: charge.units,
          chargeAmount: this.calculateChargeAmount(charge, payer.feeSchedule)
        }],
        totalCharge: this.calculateChargeAmount(charge, payer.feeSchedule),
        status: 'pending',
        createdAt: new Date()
      };

      await secureDataAccess.create(
        'claims',
        claim,
        this.getServiceContext(context.practiceId, 'create-claim')
      );

      return claim;
    } catch (error) {
      console.error('Failed to generate claim:', error);
      throw error;
    }
  }

  generateClaimNumber(practiceId) {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${practiceId.substring(0, 3).toUpperCase()}-${timestamp}-${random}`.toUpperCase();
  }

  calculateChargeAmount(charge, feeSchedule) {
    const baseFee = feeSchedule[charge.cptCode] || 100;
    return baseFee * charge.units;
  }

  async getPatientInsurance(patientId, context) {
    try {
      const insurances = await secureDataAccess.query(
        'patient_insurance',
        { patientId, active: true, priority: 'primary' },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'get-patient-insurance')
      );
      return insurances[0];
    } catch (error) {
      console.error('Failed to get patient insurance:', error);
      return null;
    }
  }

  async generateSelfPayInvoice(charge, patient, context) {
    try {
      const invoice = {
        invoiceId: crypto.randomBytes(16).toString('hex'),
        invoiceNumber: this.generateInvoiceNumber(context.practiceId),
        chargeId: charge.chargeId,
        patientId: charge.patientId,
        practiceId: context.practiceId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        serviceDate: charge.serviceDate,
        services: [{
          cptCode: charge.cptCode,
          description: charge.cptDescription,
          units: charge.units,
          unitPrice: 150,
          total: 150 * charge.units
        }],
        subtotal: 150 * charge.units,
        tax: 0,
        total: 150 * charge.units,
        status: 'pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date()
      };

      await secureDataAccess.create(
        'invoices',
        invoice,
        this.getServiceContext(context.practiceId, 'generate-self-pay-invoice')
      );

      return invoice;
    } catch (error) {
      console.error('Failed to generate self-pay invoice:', error);
      throw error;
    }
  }

  generateInvoiceNumber(practiceId) {
    const timestamp = Date.now().toString(36);
    return `INV-${practiceId.substring(0, 3).toUpperCase()}-${timestamp}`.toUpperCase();
  }

  async submitBatchClaims(context) {
    if (this.claimProcessingQueue.length === 0) return;

    try {
      const batch = this.claimProcessingQueue.splice(0, 5);
      const groupedByPayer = {};

      batch.forEach(claim => {
        if (!groupedByPayer[claim.payerId]) {
          groupedByPayer[claim.payerId] = [];
        }
        groupedByPayer[claim.payerId].push(claim);
      });

      for (const [payerId, claims] of Object.entries(groupedByPayer)) {
        await this.submitToClearinghouse(payerId, claims, context);
      }
    } catch (error) {
      console.error('Failed to submit batch claims:', error);
      this.claimProcessingQueue.unshift(...batch);
    }
  }

  async submitToClearinghouse(payerId, claims, context) {
    const payer = this.payers.get(payerId);
    if (!payer) {
      throw new Error(`Payer not found: ${payerId}`);
    }

    try {
      const ediData = this.generateEDI837(claims, payer.ediFormat);
      
      const submission = {
        submissionId: crypto.randomBytes(16).toString('hex'),
        payerId,
        clearinghouse: payer.clearinghouse,
        claimIds: claims.map(c => c.claimId),
        format: payer.ediFormat,
        submittedAt: new Date(),
        status: 'submitted'
      };

      await secureDataAccess.create(
        'claim_submissions',
        submission,
        this.getServiceContext(context.practiceId, 'submit-claims')
      );

      for (const claim of claims) {
        await secureDataAccess.update(
          'claims',
          { claimId: claim.claimId },
          { $set: { status: 'submitted', submissionId: submission.submissionId } },
          {},
          this.getServiceContext(context.practiceId, 'update-claim-status')
        );
      }

      await secureDataAccess.create('audit_logs', {
        action: 'CLAIMS_SUBMITTED',
        category: 'billing',
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: {
          submissionId: submission.submissionId,
          payerId,
          claimCount: claims.length
        },
        timestamp: new Date()
      }, this.getServiceContext(context.practiceId, 'audit-claims-submission'));

      return submission;
    } catch (error) {
      console.error('Failed to submit to clearinghouse:', error);
      throw error;
    }
  }

  generateEDI837(claims, format = '5010') {
    const segments = [];
    
    segments.push(`ISA*00*          *00*          *ZZ*${claims[0].practiceId}*ZZ*${claims[0].payerId}*${this.formatEDIDate(new Date())}*${this.formatEDITime(new Date())}*^*00501*000000001*0*P*:`);
    segments.push(`GS*HC*${claims[0].practiceId}*${claims[0].payerId}*${this.formatEDIDate(new Date())}*${this.formatEDITime(new Date())}*1*X*005010X222A1`);
    
    segments.push(`ST*837*0001*005010X222A1`);
    segments.push(`BHT*0019*00*${claims[0].submissionId || crypto.randomBytes(8).toString('hex')}*${this.formatEDIDate(new Date())}*${this.formatEDITime(new Date())}*CH`);
    
    claims.forEach((claim, index) => {
      segments.push(`NM1*85*2*${claim.billingProvider.name}****XX*${claim.billingProvider.npi}`);
      segments.push(`N3*${claim.billingProvider.address.street}`);
      segments.push(`N4*${claim.billingProvider.address.city}*${claim.billingProvider.address.state}*${claim.billingProvider.address.zip}`);
      
      segments.push(`NM1*IL*1*${claim.patient.lastName}*${claim.patient.firstName}****MI*${claim.subscriberId}`);
      segments.push(`N3*${claim.patient.address.street}`);
      segments.push(`N4*${claim.patient.address.city}*${claim.patient.address.state}*${claim.patient.address.zip}`);
      segments.push(`DMG*D8*${this.formatEDIDate(new Date(claim.patient.dateOfBirth))}*${claim.patient.gender}`);
      
      segments.push(`CLM*${claim.claimNumber}*${claim.totalCharge}***${claim.placeOfService}:B:1*Y*A*Y*Y`);
      
      claim.services.forEach((service, serviceIndex) => {
        segments.push(`LX*${serviceIndex + 1}`);
        segments.push(`SV1*HC:${service.cptCode}${service.modifiers.map(m => ':' + m).join('')}*${service.chargeAmount}*UN*${service.units}***1`);
        segments.push(`DTP*472*D8*${this.formatEDIDate(new Date(service.serviceDate))}`);
      });
    });
    
    segments.push(`SE*${segments.length - 1}*0001`);
    segments.push(`GE*1*1`);
    segments.push(`IEA*1*000000001`);
    
    return segments.join('~') + '~';
  }

  formatEDIDate(date) {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return year + month + day;
  }

  formatEDITime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return hours + minutes;
  }

  async verifyInsuranceEligibility(insuranceData, context) {
    await this.initialize();

    try {
      const { patientId, payerId, subscriberId, serviceDate } = insuranceData;

      const payer = this.payers.get(payerId);
      if (!payer) {
        throw new Error(`Payer not found: ${payerId}`);
      }

      const eligibilityRequest = {
        requestId: crypto.randomBytes(16).toString('hex'),
        patientId,
        payerId,
        subscriberId,
        serviceDate: serviceDate || new Date(),
        requestedAt: new Date(),
        status: 'pending'
      };

      await secureDataAccess.create(
        'eligibility_requests',
        eligibilityRequest,
        this.getServiceContext(context.practiceId, 'verify-insurance-eligibility')
      );

      const mockEligibilityResponse = {
        eligible: true,
        coverageActive: true,
        copay: 25,
        deductible: 1500,
        deductibleMet: 750,
        outOfPocketMax: 5000,
        outOfPocketMet: 1200,
        coinsurance: 20,
        benefits: {
          preventiveCare: { covered: true, copay: 0 },
          specialistVisit: { covered: true, copay: 50 },
          emergency: { covered: true, copay: 250 },
          labWork: { covered: true, coinsurance: 20 },
          imaging: { covered: true, coinsurance: 30, requiresAuth: true }
        }
      };

      await secureDataAccess.update(
        'eligibility_requests',
        { requestId: eligibilityRequest.requestId },
        { 
          $set: {
            status: 'completed',
            response: mockEligibilityResponse,
            completedAt: new Date()
          }
        },
        {},
        this.getServiceContext(context.practiceId, 'update-eligibility-request')
      );

      await secureDataAccess.create('audit_logs', {
        action: 'INSURANCE_ELIGIBILITY_VERIFIED',
        category: 'billing',
        patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: {
          payerId,
          eligible: mockEligibilityResponse.eligible
        },
        timestamp: new Date()
      }, this.getServiceContext(context.practiceId, 'audit-eligibility-verification'));

      return mockEligibilityResponse;
    } catch (error) {
      console.error('Failed to verify insurance eligibility:', error);
      throw error;
    }
  }

  async processPayment(paymentData, context) {
    await this.initialize();

    try {
      const {
        invoiceId,
        amount,
        paymentMethod,
        paymentDetails,
        patientId
      } = paymentData;

      const invoices = await secureDataAccess.query(
        'invoices',
        { invoiceId },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'process-payment')
      );
      const invoice = invoices[0];

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (amount > invoice.total - (invoice.paidAmount || 0)) {
        throw new Error('Payment amount exceeds outstanding balance');
      }

      const encryptedPaymentDetails = await encryptionService.encrypt(
        JSON.stringify(paymentDetails),
        'pci'
      );

      const payment = {
        paymentId: crypto.randomBytes(16).toString('hex'),
        transactionId: crypto.randomBytes(12).toString('hex').toUpperCase(),
        invoiceId,
        patientId: patientId || invoice.patientId,
        practiceId: context.practiceId,
        amount,
        paymentMethod,
        paymentDetails: encryptedPaymentDetails,
        status: 'processing',
        processedAt: new Date()
      };

      await secureDataAccess.create(
        'payments',
        payment,
        this.getServiceContext(context.practiceId, 'create-payment')
      );

      const mockProcessingResult = {
        success: true,
        authorizationCode: crypto.randomBytes(6).toString('hex').toUpperCase(),
        processorTransactionId: crypto.randomBytes(16).toString('hex')
      };

      if (mockProcessingResult.success) {
        payment.status = 'completed';
        payment.authorizationCode = mockProcessingResult.authorizationCode;

        await secureDataAccess.update(
          'payments',
          { paymentId: payment.paymentId },
          { 
            $set: {
              status: 'completed',
              authorizationCode: payment.authorizationCode
            }
          },
          {},
          this.getServiceContext(context.practiceId, 'update-payment-status')
        );

        const newPaidAmount = (invoice.paidAmount || 0) + amount;
        const newStatus = newPaidAmount >= invoice.total ? 'paid' : 'partial';

        await secureDataAccess.update(
          'invoices',
          { invoiceId },
          { 
            $set: {
              paidAmount: newPaidAmount,
              status: newStatus,
              lastPaymentDate: new Date()
            }
          },
          {},
          this.getServiceContext(context.practiceId, 'update-invoice-payment')
        );
      }

      await secureDataAccess.create('audit_logs', {
        action: 'PAYMENT_PROCESSED',
        category: 'billing',
        patientId: payment.patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: {
          paymentId: payment.paymentId,
          amount,
          method: paymentMethod,
          status: payment.status
        },
        timestamp: new Date()
      }, this.getServiceContext(context.practiceId, 'audit-payment-processing'));

      return {
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        status: payment.status,
        authorizationCode: payment.authorizationCode
      };
    } catch (error) {
      console.error('Failed to process payment:', error);
      throw error;
    }
  }

  async generateRevenueReport(dateRange, context) {
    await this.initialize();

    try {
      const { startDate, endDate } = dateRange;

      const charges = await secureDataAccess.query(
        'charges',
        {
          practiceId: context.practiceId,
          serviceDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        },
        { limit: 10000 },
        this.getServiceContext(context.practiceId, 'generate-revenue-report')
      );

      const payments = await secureDataAccess.query(
        'payments',
        {
          practiceId: context.practiceId,
          processedAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          status: 'completed'
        },
        { limit: 10000 },
        this.getServiceContext(context.practiceId, 'generate-revenue-report')
      );

      const claims = await secureDataAccess.query(
        'claims',
        {
          practiceId: context.practiceId,
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        },
        { limit: 10000 },
        this.getServiceContext(context.practiceId, 'generate-revenue-report')
      );

      const totalCharges = charges.reduce((sum, charge) => sum + (charge.rvu * 100), 0);
      const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const pendingClaims = claims.filter(c => c.status === 'pending' || c.status === 'submitted').length;
      const deniedClaims = claims.filter(c => c.status === 'denied').length;
      const paidClaims = claims.filter(c => c.status === 'paid').length;

      const report = {
        reportId: crypto.randomBytes(16).toString('hex'),
        practiceId: context.practiceId,
        dateRange: { startDate, endDate },
        summary: {
          totalCharges,
          totalPayments,
          outstandingBalance: totalCharges - totalPayments,
          chargeCount: charges.length,
          paymentCount: payments.length,
          averagePayment: payments.length > 0 ? totalPayments / payments.length : 0
        },
        claims: {
          total: claims.length,
          pending: pendingClaims,
          denied: deniedClaims,
          paid: paidClaims,
          denialRate: claims.length > 0 ? (deniedClaims / claims.length) * 100 : 0
        },
        payerBreakdown: this.calculatePayerBreakdown(claims, payments),
        providerProductivity: this.calculateProviderProductivity(charges),
        generatedAt: new Date()
      };

      await secureDataAccess.create(
        'revenue_reports',
        report,
        this.getServiceContext(context.practiceId, 'create-revenue-report')
      );

      return report;
    } catch (error) {
      console.error('Failed to generate revenue report:', error);
      throw error;
    }
  }

  calculatePayerBreakdown(claims, payments) {
    const breakdown = {};

    claims.forEach(claim => {
      if (!breakdown[claim.payerId]) {
        breakdown[claim.payerId] = {
          payerName: claim.payerName,
          claimCount: 0,
          totalBilled: 0,
          totalPaid: 0,
          deniedCount: 0
        };
      }
      breakdown[claim.payerId].claimCount++;
      breakdown[claim.payerId].totalBilled += claim.totalCharge;
      if (claim.status === 'denied') {
        breakdown[claim.payerId].deniedCount++;
      }
    });

    return Object.values(breakdown);
  }

  calculateProviderProductivity(charges) {
    const productivity = {};

    charges.forEach(charge => {
      if (!productivity[charge.providerId]) {
        productivity[charge.providerId] = {
          providerId: charge.providerId,
          chargeCount: 0,
          totalRVU: 0,
          totalCharges: 0
        };
      }
      productivity[charge.providerId].chargeCount++;
      productivity[charge.providerId].totalRVU += charge.rvu;
      productivity[charge.providerId].totalCharges += (charge.rvu * 100);
    });

    return Object.values(productivity);
  }

  async processRemittance(remittanceData, context) {
    await this.initialize();

    try {
      const { payerId, checkNumber, paymentAmount, claimPayments } = remittanceData;

      const remittance = {
        remittanceId: crypto.randomBytes(16).toString('hex'),
        payerId,
        checkNumber,
        paymentAmount,
        receivedDate: new Date(),
        status: 'processing',
        claimPayments: []
      };

      for (const claimPayment of claimPayments) {
        const claims = await secureDataAccess.query(
          'claims',
          { claimNumber: claimPayment.claimNumber },
          { limit: 1 },
          this.getServiceContext(context.practiceId, 'process-remittance')
        );
        const claim = claims[0];

        if (claim) {
          remittance.claimPayments.push({
            claimId: claim.claimId,
            claimNumber: claim.claimNumber,
            paidAmount: claimPayment.paidAmount,
            allowedAmount: claimPayment.allowedAmount,
            deductible: claimPayment.deductible,
            coinsurance: claimPayment.coinsurance,
            copay: claimPayment.copay,
            adjustmentReason: claimPayment.adjustmentReason
          });

          await secureDataAccess.update(
            'claims',
            { claimId: claim.claimId },
            {
              $set: {
                status: 'paid',
                paidAmount: claimPayment.paidAmount,
                allowedAmount: claimPayment.allowedAmount,
                paidDate: new Date()
              }
            },
            {},
            this.getServiceContext(context.practiceId, 'update-claim-remittance')
          );
        }
      }

      await secureDataAccess.create(
        'remittances',
        remittance,
        this.getServiceContext(context.practiceId, 'create-remittance')
      );

      await secureDataAccess.create('audit_logs', {
        action: 'REMITTANCE_PROCESSED',
        category: 'billing',
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: {
          remittanceId: remittance.remittanceId,
          payerId,
          paymentAmount,
          claimCount: remittance.claimPayments.length
        },
        timestamp: new Date()
      }, this.getServiceContext(context.practiceId, 'audit-remittance-processing'));

      return remittance;
    } catch (error) {
      console.error('Failed to process remittance:', error);
      throw error;
    }
  }

  async createPaymentPlan(planData, context) {
    await this.initialize();

    try {
      const {
        patientId,
        invoiceIds,
        totalAmount,
        downPayment,
        numberOfInstallments,
        startDate
      } = planData;

      const monthlyPayment = (totalAmount - downPayment) / numberOfInstallments;
      const installments = [];

      for (let i = 0; i < numberOfInstallments; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        installments.push({
          installmentNumber: i + 1,
          amount: monthlyPayment,
          dueDate,
          status: 'scheduled'
        });
      }

      const paymentPlan = {
        planId: crypto.randomBytes(16).toString('hex'),
        patientId,
        practiceId: context.practiceId,
        invoiceIds,
        totalAmount,
        downPayment,
        remainingBalance: totalAmount - downPayment,
        numberOfInstallments,
        monthlyPayment,
        installments,
        status: 'active',
        createdAt: new Date(),
        startDate
      };

      await secureDataAccess.create(
        'payment_plans',
        paymentPlan,
        this.getServiceContext(context.practiceId, 'create-payment-plan')
      );

      await secureDataAccess.create('audit_logs', {
        action: 'PAYMENT_PLAN_CREATED',
        category: 'billing',
        patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: {
          planId: paymentPlan.planId,
          totalAmount,
          installments: numberOfInstallments
        },
        timestamp: new Date()
      }, this.getServiceContext(context.practiceId, 'audit-payment-plan-creation'));

      return paymentPlan;
    } catch (error) {
      console.error('Failed to create payment plan:', error);
      throw error;
    }
  }
}

// Register with ServiceProxy for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('billingService', () => {
    return module.exports;
  });
}

module.exports = BillingService;