const { ObjectId, MongoClient } = require('mongodb');
const crypto = require('crypto');
const SecureDataAccess = require('./secureDataAccess');
const SecureConfigService = require('./secureConfigService');
const serviceAccountManager = require('./serviceAccountManager');
const encryptionService = require('./encryptionService');
// AuditLog - use SecureDataAccess.insert directly to avoid model enum restrictions

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

    // Reference database for official billing codes (public data, not patient data)
    this.billingCodesDb = null;
    this.billingCodesClient = null;
    this.BILLING_CODES_DB = 'intellicare_billing_codes';
  }

  async initialize() {
    if (this.initialized) return;

    try {
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

  async connectToBillingCodesDb() {
    try {
      // Same secure connection pattern as drugInformationService
      const SecureConfigService = require('./secureConfigService');
      const mongoUri = SecureConfigService.get('MONGODB_URI', 'mongodb://localhost:27017');
      this.billingCodesClient = new MongoClient(mongoUri, {
        maxPoolSize: 5,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 5000
      });
      await this.billingCodesClient.connect();
      this.billingCodesDb = this.billingCodesClient.db(this.BILLING_CODES_DB);
      console.log(`Connected to ${this.BILLING_CODES_DB} reference database`);
    } catch (error) {
      console.error('Failed to connect to billing codes database:', error);
      throw error;
    }
  }

  async loadBillingCodes() {
    try {
      // Connect to the official billing codes reference database
      await this.connectToBillingCodesDb();

      // Load CPT codes (9,801) with descriptions and RVUs
      const cptCodesData = await this.billingCodesDb.collection('cpt_codes')
        .find({}, { projection: { code: 1, description: 1, category: 1, totalRVU: 1, globalPeriod: 1 } })
        .toArray();

      cptCodesData.forEach(code => {
        this.cptCodes.set(code.code, {
          description: code.description,
          category: code.category,
          rvu: code.totalRVU || 1.0,
          globalPeriod: code.globalPeriod || 'XXX',
          modifiers: []
        });
      });

      // Load ICD-10 codes (74,706) - just code + description for validation and enrichment
      const icd10CodesData = await this.billingCodesDb.collection('icd10_codes')
        .find({}, { projection: { code: 1, description: 1, category: 1 } })
        .toArray();

      icd10CodesData.forEach(code => {
        this.icd10Codes.set(code.code, {
          description: code.description,
          category: code.category
        });
      });

      console.log(`Loaded ${this.cptCodes.size} CPT codes and ${this.icd10Codes.size} ICD-10 codes from ${this.BILLING_CODES_DB}`);
    } catch (error) {
      console.error('Failed to load billing codes:', error);
      this.cptCodes = new Map();
      this.icd10Codes = new Map();
    }
  }

  async loadPayerConfigurations() {
    try {
      const payersData = await SecureDataAccess.query(
        'insurance_payers',
        { active: true },
        { limit: 1000 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: 'global' }
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

  async _logAudit(data, context) {
    try {
      await SecureDataAccess.insert(
        'audit_logs',
        { ...data, timestamp: new Date(), createdAt: new Date() },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context?.practiceId || 'global' }
      );
    } catch (err) {
      console.error('Billing audit log failed (non-fatal):', err.message);
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

      // Validate required fields
      if (!patientId) {
        return { success: false, error: 'Missing patientId', message: 'Patient ID is required to capture a charge' };
      }
      if (!cptCode) {
        return { success: false, error: 'Missing cptCode', message: 'CPT code is required to capture a charge' };
      }

      // Guard: duplicate charge detection (same patient, same CPT, same date, within 5 minutes)
      const today = serviceDate || new Date().toISOString().split('T')[0];
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentCharges = await SecureDataAccess.query(
        'charges',
        { patientId, cptCode, serviceDate: today, status: { $ne: 'voided' }, createdAt: { $gte: fiveMinutesAgo } },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      if (recentCharges && recentCharges.length > 0) {
        return { success: false, error: 'Duplicate charge', message: `A charge for CPT ${cptCode} on ${today} was already captured for this patient within the last 5 minutes (Charge ID: ${recentCharges[0].chargeId}). Rejecting duplicate.` };
      }

      // Validate CPT code against official 9,801 codes from CMS Physician Fee Schedule
      if (this.cptCodes.size > 0 && !this.cptCodes.has(cptCode)) {
        return { success: false, error: `Invalid CPT code: ${cptCode}`, message: `CPT code ${cptCode} not found in official 2026 Medicare Physician Fee Schedule` };
      }

      // Validate ICD-10 codes against official 74,706 codes from CDC/CMS
      if (this.icd10Codes.size > 0) {
        for (const code of diagnosisCodes) {
          if (!this.icd10Codes.has(code)) {
            return { success: false, error: `Invalid ICD-10 code: ${code}`, message: `ICD-10 code ${code} not found in official 2026 ICD-10-CM code set` };
          }
        }
      }

      const cptInfo = this.cptCodes.get(cptCode) || { description: cptCode, rvu: 1.0 };
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
        diagnosisDescriptions: diagnosisCodes.map(code => {
          const info = this.icd10Codes.get(code);
          return info ? `${code} - ${info.description}` : code;
        }),
        units: calculatedUnits,
        placeOfService,
        rvu: baseRVU * calculatedUnits,
        status: 'captured',
        billingStatus: 'pending',
        createdAt: new Date()
      };

      await SecureDataAccess.insert(
        'charges',
        charge,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'CHARGE_CAPTURED',
        category: 'billing',
        patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { chargeId: charge.chargeId, cptCode, amount: charge.rvu }
      }, context);

      this.chargeCaptureQueue.push(charge);
      
      if (this.chargeCaptureQueue.length >= 10) {
        await this.processBatchCharges(context);
      }

      return charge;
    } catch (error) {
      console.error('[Billing] Failed to capture charge:', error.message);
      return { success: false, error: error.message, message: `Charge capture failed: ${error.message}` };
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
      const patients = await SecureDataAccess.query(
        'patients',
        { _id: charge.patientId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      const patient = patients[0];

      const providers = await SecureDataAccess.query(
        'patient_provider',
        { _id: charge.providerId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
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

      await SecureDataAccess.insert(
        'claims',
        claim,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
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
      const insurances = await SecureDataAccess.query(
        'patient_insurance',
        { patientId, active: true, priority: 'primary' },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      return insurances[0];
    } catch (error) {
      console.error('Failed to get patient insurance:', error);
      return null;
    }
  }

  async generateSelfPayInvoice(charge, patient, context) {
    try {
      // Prevent duplicate invoices for the same charge
      const existingInvoices = await SecureDataAccess.query(
        'invoices',
        { chargeId: charge.chargeId, status: { $nin: ['voided', 'cancelled'] } },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      if (existingInvoices && existingInvoices.length > 0) {
        return { success: false, error: 'Duplicate invoice', message: `An invoice (${existingInvoices[0].invoiceNumber}) already exists for this charge. Cannot create duplicate.` };
      }

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

      await SecureDataAccess.insert(
        'invoices',
        invoice,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      // Mark the charge as billed so it won't be picked up again for future invoices
      await SecureDataAccess.update(
        'charges',
        { chargeId: charge.chargeId },
        { billingStatus: 'billed', invoiceId: invoice.invoiceId, invoiceNumber: invoice.invoiceNumber, billedAt: new Date() },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      return invoice;
    } catch (error) {
      console.error('[Billing] Failed to generate invoice:', error.message);
      return { success: false, error: error.message, message: `Invoice generation failed: ${error.message}` };
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

      await SecureDataAccess.insert(
        'claim_submissions',
        submission,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      for (const claim of claims) {
        await SecureDataAccess.update(
          'claims',
          { claimId: claim.claimId },
          { status: 'submitted', submissionId: submission.submissionId },
          { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
        );
      }

      await this._logAudit({
        action: 'CLAIMS_SUBMITTED',
        category: 'billing',
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { submissionId: submission.submissionId, payerId, claimCount: claims.length }
      }, context);

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

      await SecureDataAccess.insert(
        'eligibility_requests',
        eligibilityRequest,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
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

      await SecureDataAccess.update(
        'eligibility_requests',
        { requestId: eligibilityRequest.requestId },
        { 
          status: 'completed',
          response: mockEligibilityResponse,
          completedAt: new Date()
        },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'INSURANCE_ELIGIBILITY_VERIFIED',
        category: 'billing',
        patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { payerId, eligible: mockEligibilityResponse.eligible }
      }, context);

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

      // Validate required fields
      if (!invoiceId) {
        return { success: false, error: 'Missing invoiceId', message: 'Invoice ID is required to process a payment' };
      }
      if (!amount || amount <= 0) {
        return { success: false, error: 'Invalid amount', message: 'Payment amount must be greater than zero' };
      }
      if (!paymentMethod) {
        return { success: false, error: 'Missing paymentMethod', message: 'Payment method is required (e.g., check, credit_card, cash)' };
      }

      const invoices = await SecureDataAccess.query(
        'invoices',
        { invoiceId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      const invoice = invoices[0];

      if (!invoice) {
        return { success: false, error: 'Invoice not found', message: 'No invoice found with the provided ID' };
      }

      // Guard: invoice already fully paid
      const outstandingBalance = invoice.total - (invoice.paidAmount || 0);
      if (outstandingBalance <= 0) {
        return { success: false, error: 'Invoice already paid', message: `Invoice ${invoice.invoiceNumber || invoiceId} is already fully paid ($${invoice.total}). No payment needed.` };
      }

      // Guard: duplicate payment detection (same invoice, same amount, within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentPayments = await SecureDataAccess.query(
        'payments',
        { invoiceId, amount: { $gte: amount * 0.99, $lte: amount * 1.01 }, status: 'completed', processedAt: { $gte: fiveMinutesAgo } },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      if (recentPayments && recentPayments.length > 0) {
        return { success: false, error: 'Duplicate payment', message: `A payment of $${amount.toFixed(2)} was already processed on this invoice within the last 5 minutes (Payment ID: ${recentPayments[0].paymentId}). Rejecting duplicate.` };
      }

      // Handle overpayment gracefully - accept payment, track credit
      let appliedAmount = amount;
      let creditAmount = 0;
      if (amount > outstandingBalance) {
        appliedAmount = outstandingBalance;
        creditAmount = Math.round((amount - outstandingBalance) * 100) / 100;
        console.log(`[Billing] Overpayment detected: $${amount} paid on $${outstandingBalance} balance. Applied: $${appliedAmount}, Credit: $${creditAmount}`);
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
        amount: appliedAmount,
        originalAmount: amount !== appliedAmount ? amount : undefined,
        creditAmount: creditAmount || undefined,
        paymentMethod,
        paymentDetails: encryptedPaymentDetails,
        status: 'processing',
        processedAt: new Date()
      };

      await SecureDataAccess.insert(
        'payments',
        payment,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      const mockProcessingResult = {
        success: true,
        authorizationCode: crypto.randomBytes(6).toString('hex').toUpperCase(),
        processorTransactionId: crypto.randomBytes(16).toString('hex')
      };

      if (mockProcessingResult.success) {
        payment.status = 'completed';
        payment.authorizationCode = mockProcessingResult.authorizationCode;

        await SecureDataAccess.update(
          'payments',
          { paymentId: payment.paymentId },
          { 
            status: 'completed',
            authorizationCode: payment.authorizationCode
          },
          { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
        );

        const newPaidAmount = (invoice.paidAmount || 0) + appliedAmount;
        const newStatus = newPaidAmount >= invoice.total ? 'paid' : 'partial';

        await SecureDataAccess.update(
          'invoices',
          { invoiceId },
          { 
            paidAmount: newPaidAmount,
            status: newStatus,
            lastPaymentDate: new Date()
          },
          { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
        );
      }

      // Store credit balance if overpayment
      if (creditAmount > 0 && payment.status === 'completed') {
        await SecureDataAccess.insert(
          'patient_credits',
          {
            creditId: crypto.randomBytes(16).toString('hex'),
            patientId: patientId || invoice.patientId,
            practiceId: context.practiceId,
            amount: creditAmount,
            remainingAmount: creditAmount,
            source: 'overpayment',
            sourcePaymentId: payment.paymentId,
            sourceInvoiceId: invoiceId,
            status: 'available',
            createdAt: new Date()
          },
          { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
        );
        console.log(`[Billing] Credit balance of $${creditAmount} stored for patient ${patientId || invoice.patientId}`);
      }

      await this._logAudit({
        action: 'PAYMENT_PROCESSED',
        category: 'billing',
        patientId: payment.patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { paymentId: payment.paymentId, amount: appliedAmount, creditAmount, method: paymentMethod, status: payment.status }
      }, context);

      const result = {
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        status: payment.status,
        amountApplied: appliedAmount,
        authorizationCode: payment.authorizationCode
      };
      if (creditAmount > 0) {
        result.creditAmount = creditAmount;
        result.message = `Payment of $${amount.toFixed(2)} received. $${appliedAmount.toFixed(2)} applied to invoice, $${creditAmount.toFixed(2)} credit balance created.`;
      }
      return result;
    } catch (error) {
      console.error('Failed to process payment:', error.message);
      return { success: false, error: error.message, message: `Payment processing failed: ${error.message}` };
    }
  }

  async generateRevenueReport(dateRange, context) {
    await this.initialize();

    try {
      const { startDate, endDate } = dateRange;

      const charges = await SecureDataAccess.query(
        'charges',
        {
          practiceId: context.practiceId,
          serviceDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        },
        { limit: 10000 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      const payments = await SecureDataAccess.query(
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
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      const claims = await SecureDataAccess.query(
        'claims',
        {
          practiceId: context.practiceId,
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        },
        { limit: 10000 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
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

      await SecureDataAccess.insert(
        'revenue_reports',
        report,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      return report;
    } catch (error) {
      console.error('[Billing] Failed to generate revenue report:', error.message);
      return { success: false, error: error.message, message: `Revenue report failed: ${error.message}` };
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
        const claims = await SecureDataAccess.query(
          'claims',
          { claimNumber: claimPayment.claimNumber },
          { limit: 1 },
          { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
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

          await SecureDataAccess.update(
            'claims',
            { claimId: claim.claimId },
            {
              status: 'paid',
              paidAmount: claimPayment.paidAmount,
              allowedAmount: claimPayment.allowedAmount,
              paidDate: new Date()
            },
            { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
          );
        }
      }

      await SecureDataAccess.insert(
        'remittances',
        remittance,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'REMITTANCE_PROCESSED',
        category: 'billing',
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { remittanceId: remittance.remittanceId, payerId, paymentAmount, claimCount: remittance.claimPayments.length }
      }, context);

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

      await SecureDataAccess.insert(
        'payment_plans',
        paymentPlan,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'PAYMENT_PLAN_CREATED',
        category: 'billing',
        patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { planId: paymentPlan.planId, totalAmount, installments: numberOfInstallments }
      }, context);

      return paymentPlan;
    } catch (error) {
      console.error('[Billing] Failed to create payment plan:', error.message);
      return { success: false, error: error.message, message: `Payment plan creation failed: ${error.message}` };
    }
  }
  // ========== UPDATE / VOID / DELETE OPERATIONS ==========

  async updateCharge(chargeId, updateData, context) {
    await this.initialize();
    try {
      const charges = await SecureDataAccess.query(
        'charges',
        { chargeId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      const charge = charges[0];
      if (!charge) return { success: false, error: 'Charge not found', message: `No charge found with ID ${chargeId}` };
      if (charge.status === 'voided') return { success: false, error: 'Charge is voided', message: 'Cannot update a voided charge' };
      if (charge.billingStatus === 'billed') return { success: false, error: 'Charge already billed', message: 'Cannot update a charge that has already been billed' };

      const allowedFields = ['cptCode', 'diagnosisCodes', 'units', 'modifiers', 'placeOfService', 'serviceDate', 'amount'];
      const updates = {};
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) updates[field] = updateData[field];
      }

      if (updates.cptCode && this.cptCodes.size > 0 && !this.cptCodes.has(updates.cptCode)) {
        return { success: false, error: `Invalid CPT code: ${updates.cptCode}`, message: `CPT code ${updates.cptCode} not found in official code set` };
      }
      if (updates.cptCode) {
        const cptInfo = this.cptCodes.get(updates.cptCode) || { description: updates.cptCode, rvu: 1.0 };
        updates.cptDescription = cptInfo.description;
        updates.rvu = cptInfo.rvu * (updates.units || charge.units || 1);
      }

      updates.updatedAt = new Date();
      await SecureDataAccess.update(
        'charges',
        { chargeId },
        updates,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'CHARGE_UPDATED',
        category: 'billing',
        patientId: charge.patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { chargeId, updatedFields: Object.keys(updates) }
      }, context);

      return { ...charge, ...updates };
    } catch (error) {
      console.error('[Billing] Failed to update charge:', error.message);
      return { success: false, error: error.message, message: `Charge update failed: ${error.message}` };
    }
  }

  async voidCharge(chargeId, reason, context) {
    await this.initialize();
    try {
      const charges = await SecureDataAccess.query(
        'charges',
        { chargeId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      const charge = charges[0];
      if (!charge) return { success: false, error: 'Charge not found', message: `No charge found with ID ${chargeId}` };
      if (charge.status === 'voided') return { success: false, error: 'Already voided', message: 'This charge is already voided' };

      await SecureDataAccess.update(
        'charges',
        { chargeId },
        { status: 'voided', billingStatus: 'voided', voidedAt: new Date(), voidReason: reason || 'No reason provided', voidedBy: context.userId },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'CHARGE_VOIDED',
        category: 'billing',
        patientId: charge.patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { chargeId, reason, originalCptCode: charge.cptCode, originalAmount: charge.rvu }
      }, context);

      return { chargeId, status: 'voided', voidedAt: new Date(), reason };
    } catch (error) {
      console.error('[Billing] Failed to void charge:', error.message);
      return { success: false, error: error.message, message: `Void charge failed: ${error.message}` };
    }
  }

  async voidInvoice(invoiceId, reason, context) {
    await this.initialize();
    try {
      const invoices = await SecureDataAccess.query(
        'invoices',
        { invoiceId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      const invoice = invoices[0];
      if (!invoice) return { success: false, error: 'Invoice not found', message: `No invoice found with ID ${invoiceId}` };
      if (invoice.status === 'voided') return { success: false, error: 'Already voided', message: 'This invoice is already voided' };
      if (invoice.status === 'paid') return { success: false, error: 'Invoice is paid', message: 'Cannot void a fully paid invoice. Process a refund instead.' };

      await SecureDataAccess.update(
        'invoices',
        { invoiceId },
        { status: 'voided', voidedAt: new Date(), voidReason: reason || 'No reason provided', voidedBy: context.userId },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'INVOICE_VOIDED',
        category: 'billing',
        patientId: invoice.patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { invoiceId, reason, originalTotal: invoice.total }
      }, context);

      return { invoiceId, status: 'voided', voidedAt: new Date(), reason };
    } catch (error) {
      console.error('[Billing] Failed to void invoice:', error.message);
      return { success: false, error: error.message, message: `Void invoice failed: ${error.message}` };
    }
  }

  async refundPayment(paymentId, refundAmount, reason, context) {
    await this.initialize();
    try {
      const payments = await SecureDataAccess.query(
        'payments',
        { paymentId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      const payment = payments[0];
      if (!payment) return { success: false, error: 'Payment not found', message: `No payment found with ID ${paymentId}` };
      if (payment.status === 'refunded') return { success: false, error: 'Already refunded', message: 'This payment has already been refunded' };
      if (payment.status !== 'completed') return { success: false, error: 'Not refundable', message: `Can only refund completed payments (current status: ${payment.status})` };

      const actualRefundAmount = refundAmount || payment.amount;
      if (actualRefundAmount > payment.amount) return { success: false, error: 'Amount too high', message: `Refund amount $${actualRefundAmount} exceeds original payment of $${payment.amount}` };

      const refund = {
        refundId: crypto.randomBytes(16).toString('hex'),
        originalPaymentId: paymentId,
        invoiceId: payment.invoiceId,
        patientId: payment.patientId,
        practiceId: context.practiceId,
        amount: actualRefundAmount,
        reason: reason || 'No reason provided',
        status: 'completed',
        refundedAt: new Date(),
        refundedBy: context.userId
      };

      await SecureDataAccess.insert(
        'refunds',
        refund,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      const newStatus = actualRefundAmount >= payment.amount ? 'refunded' : 'partial_refund';
      await SecureDataAccess.update(
        'payments',
        { paymentId },
        { status: newStatus, refundedAmount: actualRefundAmount, refundedAt: new Date() },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      // Update invoice balance
      if (payment.invoiceId) {
        const invoices = await SecureDataAccess.query(
          'invoices',
          { invoiceId: payment.invoiceId },
          { limit: 1 },
          { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
        );
        if (invoices[0]) {
          const newPaidAmount = Math.max(0, (invoices[0].paidAmount || 0) - actualRefundAmount);
          await SecureDataAccess.update(
            'invoices',
            { invoiceId: payment.invoiceId },
            { paidAmount: newPaidAmount, status: newPaidAmount >= invoices[0].total ? 'paid' : 'partial' },
            { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
          );
        }
      }

      await this._logAudit({
        action: 'PAYMENT_REFUNDED',
        category: 'billing',
        patientId: payment.patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { paymentId, refundId: refund.refundId, refundAmount: actualRefundAmount, reason }
      }, context);

      return refund;
    } catch (error) {
      console.error('[Billing] Failed to refund payment:', error.message);
      return { success: false, error: error.message, message: `Refund failed: ${error.message}` };
    }
  }

  async updatePaymentPlan(planId, updateData, context) {
    await this.initialize();
    try {
      const plans = await SecureDataAccess.query(
        'payment_plans',
        { planId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      const plan = plans[0];
      if (!plan) return { success: false, error: 'Plan not found', message: `No payment plan found with ID ${planId}` };
      if (plan.status === 'cancelled') return { success: false, error: 'Plan cancelled', message: 'Cannot update a cancelled payment plan' };

      const allowedFields = ['numberOfInstallments', 'monthlyPayment', 'startDate'];
      const updates = {};
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) updates[field] = updateData[field];
      }

      if (updates.numberOfInstallments) {
        const remaining = plan.remainingBalance;
        updates.monthlyPayment = remaining / updates.numberOfInstallments;
      }

      updates.updatedAt = new Date();
      await SecureDataAccess.update(
        'payment_plans',
        { planId },
        updates,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'PAYMENT_PLAN_UPDATED',
        category: 'billing',
        patientId: plan.patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { planId, updatedFields: Object.keys(updates) }
      }, context);

      return { ...plan, ...updates };
    } catch (error) {
      console.error('[Billing] Failed to update payment plan:', error.message);
      return { success: false, error: error.message, message: `Payment plan update failed: ${error.message}` };
    }
  }

  async cancelPaymentPlan(planId, reason, context) {
    await this.initialize();
    try {
      const plans = await SecureDataAccess.query(
        'payment_plans',
        { planId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      const plan = plans[0];
      if (!plan) return { success: false, error: 'Plan not found', message: `No payment plan found with ID ${planId}` };
      if (plan.status === 'cancelled') return { success: false, error: 'Already cancelled', message: 'This payment plan is already cancelled' };

      await SecureDataAccess.update(
        'payment_plans',
        { planId },
        { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason || 'No reason provided', cancelledBy: context.userId },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'PAYMENT_PLAN_CANCELLED',
        category: 'billing',
        patientId: plan.patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { planId, reason, remainingBalance: plan.remainingBalance }
      }, context);

      return { planId, status: 'cancelled', cancelledAt: new Date(), reason };
    } catch (error) {
      console.error('[Billing] Failed to cancel payment plan:', error.message);
      return { success: false, error: error.message, message: `Payment plan cancellation failed: ${error.message}` };
    }
  }

  async getPatientCreditBalance(patientId, context) {
    await this.initialize();

    try {
      const credits = await SecureDataAccess.query(
        'patient_credits',
        { patientId, status: 'available', remainingAmount: { $gt: 0 } },
        { limit: 100 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      const totalCredit = credits.reduce((sum, c) => sum + (c.remainingAmount || 0), 0);
      const roundedTotal = Math.round(totalCredit * 100) / 100;

      return {
        patientId,
        totalCreditBalance: roundedTotal,
        credits: credits.map(c => ({
          creditId: c.creditId,
          amount: c.amount,
          remainingAmount: c.remainingAmount,
          source: c.source,
          sourcePaymentId: c.sourcePaymentId,
          createdAt: c.createdAt
        }))
      };
    } catch (error) {
      console.error('[Billing] Failed to get credit balance:', error.message);
      return { success: false, error: error.message, message: `Credit balance lookup failed: ${error.message}` };
    }
  }

  async applyCreditToInvoice(patientId, invoiceId, amount, context) {
    await this.initialize();

    try {
      // Validate required fields
      if (!patientId) {
        return { success: false, error: 'Missing patientId', message: 'Patient ID is required' };
      }
      if (!invoiceId) {
        return { success: false, error: 'Missing invoiceId', message: 'Invoice ID is required to apply credit' };
      }

      // Guard: prevent duplicate credit application (same invoice, within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentCreditPayments = await SecureDataAccess.query(
        'payments',
        { invoiceId, paymentMethod: 'credit_balance', status: 'completed', processedAt: { $gte: fiveMinutesAgo } },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      if (recentCreditPayments && recentCreditPayments.length > 0) {
        return { success: false, error: 'Duplicate credit application', message: `Credit was already applied to this invoice within the last 5 minutes ($${recentCreditPayments[0].amount}). Rejecting duplicate.` };
      }

      // Get available credits
      const credits = await SecureDataAccess.query(
        'patient_credits',
        { patientId, status: 'available', remainingAmount: { $gt: 0 } },
        { limit: 100, sort: { createdAt: 1 } },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      const totalAvailable = credits.reduce((sum, c) => sum + (c.remainingAmount || 0), 0);
      if (totalAvailable <= 0) {
        return { success: false, error: 'No credit balance', message: `Patient has no available credit balance` };
      }

      // Get the invoice
      const invoices = await SecureDataAccess.query(
        'invoices',
        { invoiceId },
        { limit: 1 },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );
      const invoice = invoices[0];
      if (!invoice) {
        return { success: false, error: 'Invoice not found', message: 'No invoice found with the provided ID' };
      }

      const outstandingBalance = invoice.total - (invoice.paidAmount || 0);
      if (outstandingBalance <= 0) {
        return { success: false, error: 'Invoice already paid', message: `Invoice ${invoiceId} has already been fully paid` };
      }

      // Calculate how much credit to apply
      const applyAmount = Math.min(amount || totalAvailable, totalAvailable, outstandingBalance);
      let remaining = applyAmount;

      // Deduct from credits (oldest first)
      for (const credit of credits) {
        if (remaining <= 0) break;
        const deduction = Math.min(remaining, credit.remainingAmount);
        const newRemaining = Math.round((credit.remainingAmount - deduction) * 100) / 100;

        await SecureDataAccess.update(
          'patient_credits',
          { creditId: credit.creditId },
          {
            remainingAmount: newRemaining,
            status: newRemaining <= 0 ? 'used' : 'available'
          },
          { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
        );
        remaining = Math.round((remaining - deduction) * 100) / 100;
      }

      // Update invoice
      const newPaidAmount = (invoice.paidAmount || 0) + applyAmount;
      const newStatus = newPaidAmount >= invoice.total ? 'paid' : 'partial';

      await SecureDataAccess.update(
        'invoices',
        { invoiceId },
        {
          paidAmount: newPaidAmount,
          status: newStatus,
          lastPaymentDate: new Date()
        },
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      // Create a payment record for the credit application
      const creditPayment = {
        paymentId: crypto.randomBytes(16).toString('hex'),
        transactionId: crypto.randomBytes(12).toString('hex').toUpperCase(),
        invoiceId,
        patientId,
        practiceId: context.practiceId,
        amount: applyAmount,
        paymentMethod: 'credit_balance',
        status: 'completed',
        processedAt: new Date()
      };

      await SecureDataAccess.insert(
        'payments',
        creditPayment,
        { serviceId: this.serviceId, apiKey: this.serviceToken?.apiKey || this.serviceToken, practiceId: context.practiceId }
      );

      await this._logAudit({
        action: 'CREDIT_APPLIED',
        category: 'billing',
        patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: { invoiceId, amountApplied: applyAmount, newInvoiceStatus: newStatus }
      }, context);

      const newTotalCredit = Math.round((totalAvailable - applyAmount) * 100) / 100;

      return {
        amountApplied: applyAmount,
        invoiceId,
        invoiceStatus: newStatus,
        remainingCreditBalance: newTotalCredit,
        message: `$${applyAmount.toFixed(2)} credit applied to invoice ${invoice.invoiceNumber || invoiceId}. Remaining credit balance: $${newTotalCredit.toFixed(2)}`
      };
    } catch (error) {
      console.error('[Billing] Failed to apply credit:', error.message);
      return { success: false, error: error.message, message: `Credit application failed: ${error.message}` };
    }
  }

  // ========== ICD-10-CM CODE LOOKUP TOOLS ==========

  /**
   * Search ICD-10-CM codes by description text or partial code
   * Uses the 74,706 official codes loaded in memory + MongoDB text index
   * @param {string} query - Search term (description or code prefix)
   * @param {number} maxResults - Maximum results to return (default 20)
   */
  async searchICD10(query, maxResults = 20) {
    await this.initialize();

    if (!query || query.trim().length < 2) {
      return { success: false, error: 'Search query must be at least 2 characters' };
    }

    const searchTerm = query.trim();
    const results = [];

    // Check if query looks like a code (starts with letter + digit)
    const isCodeSearch = /^[A-Z]\d/i.test(searchTerm);

    if (isCodeSearch) {
      // Search by code prefix using in-memory Map (fast)
      const upperTerm = searchTerm.toUpperCase();
      for (const [code, info] of this.icd10Codes.entries()) {
        if (code.startsWith(upperTerm)) {
          results.push({ code, description: info.description, category: info.category });
          if (results.length >= maxResults) break;
        }
      }
    } else {
      // Search by description using MongoDB text index (handles stemming, relevance)
      try {
        const textResults = await this.billingCodesDb.collection('icd10_codes')
          .find(
            { $text: { $search: searchTerm } },
            { projection: { code: 1, description: 1, category: 1, score: { $meta: 'textScore' } } }
          )
          .sort({ score: { $meta: 'textScore' } })
          .limit(maxResults)
          .toArray();

        for (const r of textResults) {
          results.push({ code: r.code, description: r.description, category: r.category });
        }
      } catch (textErr) {
        // Fallback: regex search on in-memory Map if text index fails
        const lowerTerm = searchTerm.toLowerCase();
        for (const [code, info] of this.icd10Codes.entries()) {
          if (info.description && info.description.toLowerCase().includes(lowerTerm)) {
            results.push({ code, description: info.description, category: info.category });
            if (results.length >= maxResults) break;
          }
        }
      }
    }

    return {
      success: true,
      query: searchTerm,
      totalResults: results.length,
      results,
      source: 'ICD-10-CM 2026 (CDC/CMS)'
    };
  }

  /**
   * Validate an ICD-10-CM code - check if it exists in the official code set
   * @param {string} code - ICD-10-CM code to validate (e.g., "E11.65")
   */
  async validateICD10Code(code) {
    await this.initialize();

    if (!code || code.trim().length < 3) {
      return { success: false, error: 'Code must be at least 3 characters' };
    }

    const normalizedCode = code.trim().toUpperCase();
    // Try with and without decimal point
    const withDecimal = normalizedCode.includes('.') ? normalizedCode : null;
    const withoutDecimal = normalizedCode.replace('.', '');

    let match = null;
    if (withDecimal && this.icd10Codes.has(withDecimal)) {
      match = { code: withDecimal, ...this.icd10Codes.get(withDecimal) };
    } else {
      // Search by codeNoDecimal
      for (const [c, info] of this.icd10Codes.entries()) {
        if (c.replace('.', '') === withoutDecimal) {
          match = { code: c, ...info };
          break;
        }
      }
    }

    if (match) {
      return {
        success: true,
        valid: true,
        code: match.code,
        description: match.description,
        category: match.category,
        source: 'ICD-10-CM 2026 (CDC/CMS)'
      };
    }

    return {
      success: true,
      valid: false,
      code: normalizedCode,
      message: `Code ${normalizedCode} not found in the official 2026 ICD-10-CM code set (74,706 codes)`,
      source: 'ICD-10-CM 2026 (CDC/CMS)'
    };
  }

  /**
   * Get related/child codes under a parent code
   * e.g., E11 → E11.00, E11.01, E11.10, E11.21, ...
   * @param {string} parentCode - Parent ICD-10 code (e.g., "E11" or "E11.3")
   * @param {number} maxResults - Maximum results (default 50)
   */
  async getRelatedICD10Codes(parentCode, maxResults = 50) {
    await this.initialize();

    if (!parentCode || parentCode.trim().length < 2) {
      return { success: false, error: 'Parent code must be at least 2 characters' };
    }

    const prefix = parentCode.trim().toUpperCase();
    const results = [];

    // Collect all codes that start with the prefix
    for (const [code, info] of this.icd10Codes.entries()) {
      if (code.startsWith(prefix) && code !== prefix) {
        results.push({ code, description: info.description, category: info.category });
        if (results.length >= maxResults) break;
      }
    }

    // Also check if the exact parent code exists
    const parentInfo = this.icd10Codes.get(prefix);

    return {
      success: true,
      parentCode: prefix,
      parentDescription: parentInfo ? parentInfo.description : null,
      parentExists: !!parentInfo,
      childCodes: results,
      totalChildren: results.length,
      source: 'ICD-10-CM 2026 (CDC/CMS)'
    };
  }

  /**
   * Suggest ICD-10 codes for a clinical description (natural language)
   * Combines text search with code-prefix matching
   * @param {string} diagnosis - Free-text clinical description
   * @param {number} maxResults - Maximum suggestions (default 10)
   */
  async suggestICD10Codes(diagnosis, maxResults = 10) {
    await this.initialize();

    if (!diagnosis || diagnosis.trim().length < 3) {
      return { success: false, error: 'Diagnosis description must be at least 3 characters' };
    }

    // Use searchICD10 with the description
    const searchResult = await this.searchICD10(diagnosis, maxResults);

    return {
      success: true,
      diagnosis: diagnosis.trim(),
      suggestions: searchResult.results || [],
      totalSuggestions: searchResult.totalResults || 0,
      note: 'Suggestions based on text matching against 74,706 official ICD-10-CM codes. Verify clinical appropriateness before use.',
      source: 'ICD-10-CM 2026 (CDC/CMS)'
    };
  }

  // ========== CLAIM LIFECYCLE MANAGEMENT ==========

  /**
   * Create a new insurance claim
   */
  async createClaim(patientId, charges, diagnosisCodes, procedureCodes, context) {
    await this.initialize();
    const ctx = {
      serviceId: this.serviceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId,
      operation: 'createClaim'
    };

    // Get patient info
    const patients = await SecureDataAccess.query('patients', { _id: new ObjectId(patientId) }, { limit: 1 }, ctx);
    const patient = patients[0];

    const claim = {
      claimNumber: this.generateClaimNumber(context.practiceId),
      patientId: new ObjectId(patientId),
      patientName: patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : 'Unknown',
      diagnosisCodes: diagnosisCodes || [],
      procedureCodes: procedureCodes || [],
      charges: charges || [],
      totalAmount: (charges || []).reduce((sum, c) => sum + (c.amount || 0), 0),
      status: 'draft',
      statusHistory: [{ status: 'draft', date: new Date(), note: 'Claim created' }],
      notes: [],
      practiceId: context.practiceId,
      createdBy: context.userId || 'system',
      createdAt: new Date()
    };

    await SecureDataAccess.insert('claims', claim, ctx);
    return { success: true, claim };
  }

  /**
   * Update claim status with audit trail
   */
  async updateClaimStatus(claimId, status, notes, context) {
    await this.initialize();
    const validStatuses = ['draft', 'ready', 'submitted', 'pending', 'paid', 'denied', 'appealed', 'void'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Invalid status. Valid: ${validStatuses.join(', ')}` };
    }

    const ctx = {
      serviceId: this.serviceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId,
      operation: 'updateClaimStatus'
    };

    const claims = await SecureDataAccess.query('claims', { claimNumber: claimId }, { limit: 1 }, ctx);
    let claim = claims[0];
    if (!claim) {
      // Try by _id
      try {
        const claimsById = await SecureDataAccess.query('claims', { _id: new ObjectId(claimId) }, { limit: 1 }, ctx);
        claim = claimsById[0];
      } catch (e) { /* ignore */ }
    }
    if (!claim) return { success: false, error: 'Claim not found' };

    const updateData = {
      status: status,
      updatedAt: new Date()
    };

    // Build status history entry
    const historyEntry = { status, date: new Date(), note: notes || '' };
    if (status === 'paid') {
      updateData.paidAt = new Date();
    }

    await SecureDataAccess.update('claims', { _id: claim._id }, {
      $set: updateData,
      $push: { statusHistory: historyEntry }
    }, ctx);

    return { success: true, claimNumber: claim.claimNumber, previousStatus: claim.status, newStatus: status };
  }

  /**
   * Get claims filtered by status
   */
  async getClaimsByStatus(status, context) {
    await this.initialize();
    const ctx = {
      serviceId: this.serviceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId,
      operation: 'getClaimsByStatus'
    };

    const filter = {};
    if (status) filter.status = status;

    const claims = await SecureDataAccess.query('claims', filter, { sort: { createdAt: -1 }, limit: 100 }, ctx);

    return {
      success: true,
      status: status || 'all',
      totalClaims: claims.length,
      claims: claims.map(c => ({
        claimNumber: c.claimNumber || c.claimId,
        patientName: c.patientName || `${c.patient?.firstName || ''} ${c.patient?.lastName || ''}`.trim(),
        status: c.status,
        totalAmount: c.totalCharge || c.totalAmount || 0,
        serviceDate: c.serviceDate || c.createdAt,
        createdAt: c.createdAt,
        paidAt: c.paidAt || null
      }))
    };
  }

  /**
   * Get all claims for a specific patient
   */
  async getPatientClaims(patientId, context) {
    await this.initialize();
    const ctx = {
      serviceId: this.serviceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId,
      operation: 'getPatientClaims'
    };

    const claims = await SecureDataAccess.query('claims',
      { patientId: new ObjectId(patientId) },
      { sort: { createdAt: -1 }, limit: 100 }, ctx
    );

    return {
      success: true,
      patientId,
      totalClaims: claims.length,
      claims: claims.map(c => ({
        claimNumber: c.claimNumber || c.claimId,
        status: c.status,
        totalAmount: c.totalCharge || c.totalAmount || 0,
        serviceDate: c.serviceDate || c.createdAt,
        diagnosisCodes: c.diagnosisCodes || (c.services || []).flatMap(s => s.diagnosisCodes || []),
        createdAt: c.createdAt
      }))
    };
  }

  /**
   * Get claim aging report (30/60/90/120+ days)
   */
  async getClaimAging(context) {
    await this.initialize();
    const ctx = {
      serviceId: this.serviceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId,
      operation: 'getClaimAging'
    };

    const unpaidClaims = await SecureDataAccess.query('claims',
      { status: { $in: ['submitted', 'pending', 'appealed', 'ready'] } },
      { sort: { createdAt: 1 } }, ctx
    );

    const now = new Date();
    const aging = { '0-30': [], '31-60': [], '61-90': [], '91-120': [], '120+': [] };
    const totals = { '0-30': 0, '31-60': 0, '61-90': 0, '91-120': 0, '120+': 0 };

    for (const claim of unpaidClaims) {
      const days = Math.floor((now - new Date(claim.createdAt)) / (1000 * 60 * 60 * 24));
      const amount = claim.totalCharge || claim.totalAmount || 0;
      const entry = {
        claimNumber: claim.claimNumber || claim.claimId,
        patientName: claim.patientName || `${claim.patient?.firstName || ''} ${claim.patient?.lastName || ''}`.trim(),
        amount,
        daysOld: days,
        status: claim.status
      };

      if (days <= 30) { aging['0-30'].push(entry); totals['0-30'] += amount; }
      else if (days <= 60) { aging['31-60'].push(entry); totals['31-60'] += amount; }
      else if (days <= 90) { aging['61-90'].push(entry); totals['61-90'] += amount; }
      else if (days <= 120) { aging['91-120'].push(entry); totals['91-120'] += amount; }
      else { aging['120+'].push(entry); totals['120+'] += amount; }
    }

    return {
      success: true,
      totalUnpaidClaims: unpaidClaims.length,
      totalUnpaidAmount: Object.values(totals).reduce((a, b) => a + b, 0),
      aging: {
        '0-30 days': { count: aging['0-30'].length, amount: totals['0-30'], claims: aging['0-30'] },
        '31-60 days': { count: aging['31-60'].length, amount: totals['31-60'], claims: aging['31-60'] },
        '61-90 days': { count: aging['61-90'].length, amount: totals['61-90'], claims: aging['61-90'] },
        '91-120 days': { count: aging['91-120'].length, amount: totals['91-120'], claims: aging['91-120'] },
        '120+ days': { count: aging['120+'].length, amount: totals['120+'], claims: aging['120+'] }
      }
    };
  }

  /**
   * Add a follow-up note to a claim
   */
  async addClaimNote(claimId, note, context) {
    await this.initialize();
    const ctx = {
      serviceId: this.serviceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId,
      operation: 'addClaimNote'
    };

    const claims = await SecureDataAccess.query('claims', { claimNumber: claimId }, { limit: 1 }, ctx);
    let claim = claims[0];
    if (!claim) {
      try {
        const claimsById = await SecureDataAccess.query('claims', { _id: new ObjectId(claimId) }, { limit: 1 }, ctx);
        claim = claimsById[0];
      } catch (e) { /* ignore */ }
    }
    if (!claim) return { success: false, error: 'Claim not found' };

    const noteEntry = {
      text: note,
      addedBy: context.userId || 'system',
      addedAt: new Date()
    };

    await SecureDataAccess.update('claims', { _id: claim._id }, {
      $push: { notes: noteEntry },
      $set: { updatedAt: new Date() }
    }, ctx);

    return { success: true, claimNumber: claim.claimNumber, note: noteEntry };
  }

  /**
   * Get claims dashboard summary
   */
  async getClaimsDashboard(context) {
    await this.initialize();
    const ctx = {
      serviceId: this.serviceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId,
      operation: 'getClaimsDashboard'
    };

    const allClaims = await SecureDataAccess.query('claims', {}, { sort: { createdAt: -1 } }, ctx);

    const byStatus = {};
    let totalAmount = 0;
    let paidAmount = 0;
    let deniedAmount = 0;

    for (const claim of allClaims) {
      const status = claim.status || 'unknown';
      const amount = claim.totalCharge || claim.totalAmount || 0;
      if (!byStatus[status]) byStatus[status] = { count: 0, amount: 0 };
      byStatus[status].count++;
      byStatus[status].amount += amount;
      totalAmount += amount;
      if (status === 'paid') paidAmount += amount;
      if (status === 'denied') deniedAmount += amount;
    }

    // Calculate aging for unpaid
    const now = new Date();
    const unpaid = allClaims.filter(c => ['submitted', 'pending', 'appealed', 'ready'].includes(c.status));
    const avgAge = unpaid.length > 0
      ? Math.round(unpaid.reduce((sum, c) => sum + Math.floor((now - new Date(c.createdAt)) / (1000 * 60 * 60 * 24)), 0) / unpaid.length)
      : 0;

    return {
      success: true,
      totalClaims: allClaims.length,
      totalAmount,
      paidAmount,
      deniedAmount,
      outstandingAmount: totalAmount - paidAmount - deniedAmount,
      collectionRate: totalAmount > 0 ? `${Math.round((paidAmount / totalAmount) * 100)}%` : '0%',
      averageAgeDays: avgAge,
      byStatus,
      recentClaims: allClaims.slice(0, 10).map(c => ({
        claimNumber: c.claimNumber || c.claimId,
        patientName: c.patientName || `${c.patient?.firstName || ''} ${c.patient?.lastName || ''}`.trim(),
        status: c.status,
        amount: c.totalCharge || c.totalAmount || 0,
        createdAt: c.createdAt
      }))
    };
  }
}

module.exports = new BillingService();