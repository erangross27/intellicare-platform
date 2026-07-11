# Process Payment - Implementation Task

## Function Details
- **Function Name**: `processPayment`
- **Location**: `backend/services/paymentProcessingService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Estimated Time**: 4-5 days
- **Complexity**: High

## Problem Description
Implement comprehensive payment processing functionality for insurance payments, including ERA (Electronic Remittance Advice) processing, payment posting, adjustment handling, patient responsibility calculation, and integration with accounting systems. The system must handle various payment types, denials, adjustments, and compliance with healthcare payment standards.

## Implementation Steps

### 1. Payment Processing Service Implementation

```javascript
// File: backend/services/paymentProcessingService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const NotificationService = require('./notificationService');
const AccountingService = require('./accountingService');
const PatientBillingService = require('./patientBillingService');

class PaymentProcessingService {
  constructor() {
    this.adjustmentCodes = {
      // CARC (Claim Adjustment Reason Codes)
      '1': 'Deductible Amount',
      '2': 'Coinsurance Amount', 
      '3': 'Co-payment Amount',
      '4': 'The procedure code is inconsistent with the modifier used',
      '11': 'The diagnosis is inconsistent with the procedure',
      '16': 'Claim/service lacks information which is needed for adjudication',
      '18': 'Exact duplicate claim/service',
      '23': 'The impact of prior payer(s) adjudication including payments and/or adjustments',
      '45': 'Charge exceeds fee schedule/maximum allowable or contracted/legislated fee arrangement',
      '96': 'Non-covered charges',
      '97': 'The benefit for this service is included in the payment/allowance for another service/procedure',
      '171': 'Payment is denied when performed/billed by this type of provider',
      // RARC (Remittance Advice Remark Codes)
      'N1': 'Alert: Refer to the Web site, telephone number, or address shown on this document for additional information',
      'N4': 'Alert: This payment is being made conditionally',
      'N15': 'Services for a newborn must be billed separately',
      'N19': 'Procedure code incidental to primary procedure'
    };
  }

  async processPayment(paymentData, context) {
    try {
      // Validate payment data
      await this.validatePaymentData(paymentData, context);

      let result;
      
      switch (paymentData.type) {
        case 'era_835':
          result = await this.processERA835(paymentData, context);
          break;
        case 'manual_check':
          result = await this.processManualCheck(paymentData, context);
          break;
        case 'eft':
          result = await this.processEFT(paymentData, context);
          break;
        case 'patient_payment':
          result = await this.processPatientPayment(paymentData, context);
          break;
        default:
          throw new Error('Unsupported payment type');
      }

      // Post to accounting system
      await this.postToAccounting(result, context);

      // Create audit trail
      await this.createAuditTrail(paymentData, result, context);

      return result;

    } catch (error) {
      await AuditLog.create({
        action: 'PAYMENT_PROCESSING_ERROR',
        paymentId: paymentData.id,
        error: error.message,
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async processERA835(eraData, context) {
    const era = eraData.eraFile;
    const processedPayments = [];

    // Parse ERA file sections
    const payerInfo = this.parsePayerInfo(era);
    const payeeInfo = this.parsePayeeInfo(era);
    const claimsInfo = this.parseClaimsInfo(era);

    for (const claim of claimsInfo) {
      const payment = await this.processClaimPayment(claim, payerInfo, context);
      processedPayments.push(payment);
    }

    return {
      type: 'era_835',
      payerInfo,
      payeeInfo,
      totalPayments: processedPayments.length,
      totalAmount: processedPayments.reduce((sum, p) => sum + p.paidAmount, 0),
      processedPayments,
      processedAt: new Date()
    };
  }

  parsePayerInfo(era) {
    return {
      payerId: era.payerId,
      payerName: era.payerName,
      payerAddress: era.payerAddress,
      payerContactInfo: era.payerContactInfo,
      paymentDate: era.paymentDate,
      paymentMethod: era.paymentMethod,
      traceNumber: era.traceNumber
    };
  }

  parsePayeeInfo(era) {
    return {
      payeeId: era.payeeId,
      payeeName: era.payeeName,
      payeeNPI: era.payeeNPI,
      payeeTaxId: era.payeeTaxId
    };
  }

  parseClaimsInfo(era) {
    return era.claims.map(claim => ({
      claimNumber: claim.claimNumber,
      patientName: claim.patientName,
      patientId: claim.patientId,
      serviceDate: claim.serviceDate,
      totalCharges: parseFloat(claim.totalCharges),
      totalPaid: parseFloat(claim.totalPaid),
      patientResponsibility: parseFloat(claim.patientResponsibility),
      services: claim.services.map(service => ({
        procedureCode: service.procedureCode,
        modifier: service.modifier,
        chargeAmount: parseFloat(service.chargeAmount),
        paidAmount: parseFloat(service.paidAmount),
        adjustments: service.adjustments.map(adj => ({
          groupCode: adj.groupCode,
          reasonCode: adj.reasonCode,
          amount: parseFloat(adj.amount),
          quantity: parseFloat(adj.quantity) || 0
        }))
      }))
    }));
  }

  async processClaimPayment(claimData, payerInfo, context) {
    try {
      // Find the claim in our system
      const claims = await SecureDataAccess.query('claims',
        { claimNumber: claimData.claimNumber },
        {},
        context
      );

      if (!claims.length) {
        throw new Error(`Claim ${claimData.claimNumber} not found in system`);
      }

      const claim = claims[0];
      const payment = {
        claimId: claim._id,
        claimNumber: claimData.claimNumber,
        payerId: payerInfo.payerId,
        payerName: payerInfo.payerName,
        paymentDate: payerInfo.paymentDate,
        paidAmount: claimData.totalPaid,
        adjustments: [],
        services: [],
        patientResponsibility: claimData.patientResponsibility,
        status: 'processed'
      };

      // Process each service line
      for (const service of claimData.services) {
        const processedService = await this.processServicePayment(
          service, 
          claim, 
          payerInfo, 
          context
        );
        payment.services.push(processedService);
      }

      // Calculate total adjustments
      payment.totalAdjustments = payment.services.reduce((sum, s) => 
        sum + s.adjustments.reduce((adjSum, adj) => adjSum + adj.amount, 0), 0
      );

      // Post payment to claim
      await this.postPaymentToClaim(claim._id, payment, context);

      // Update claim status
      await this.updateClaimStatus(claim._id, payment, context);

      // Handle patient responsibility
      if (payment.patientResponsibility > 0) {
        await this.createPatientBilling(claim, payment, context);
      }

      return payment;

    } catch (error) {
      console.error('Error processing claim payment:', error);
      return {
        claimNumber: claimData.claimNumber,
        error: error.message,
        status: 'error'
      };
    }
  }

  async processServicePayment(serviceData, claim, payerInfo, context) {
    const service = {
      procedureCode: serviceData.procedureCode,
      modifier: serviceData.modifier,
      chargeAmount: serviceData.chargeAmount,
      paidAmount: serviceData.paidAmount,
      adjustments: [],
      allowedAmount: serviceData.chargeAmount - serviceData.adjustments.reduce((sum, adj) => {
        return adj.groupCode === 'CO' ? sum + adj.amount : sum;
      }, 0)
    };

    // Process adjustments
    for (const adjustment of serviceData.adjustments) {
      const processedAdjustment = {
        groupCode: adjustment.groupCode,
        reasonCode: adjustment.reasonCode,
        amount: adjustment.amount,
        quantity: adjustment.quantity,
        description: this.adjustmentCodes[adjustment.reasonCode] || 'Unknown adjustment',
        type: this.determineAdjustmentType(adjustment.groupCode, adjustment.reasonCode)
      };

      service.adjustments.push(processedAdjustment);

      // Handle specific adjustment types
      switch (processedAdjustment.type) {
        case 'contractual':
          await this.handleContractualAdjustment(processedAdjustment, claim, context);
          break;
        case 'deductible':
          await this.handleDeductibleAdjustment(processedAdjustment, claim, context);
          break;
        case 'coinsurance':
          await this.handleCoinsuranceAdjustment(processedAdjustment, claim, context);
          break;
        case 'copayment':
          await this.handleCopaymentAdjustment(processedAdjustment, claim, context);
          break;
      }
    }

    return service;
  }

  determineAdjustmentType(groupCode, reasonCode) {
    // CO = Contractual Obligation, CR = Correction and Reversal, OA = Other Adjustments, PI = Payer Initiated, PR = Patient Responsibility
    const typeMap = {
      'CO': {
        '1': 'deductible',
        '2': 'coinsurance',
        '3': 'copayment',
        '45': 'contractual',
        '96': 'non_covered'
      },
      'PR': {
        '1': 'deductible',
        '2': 'coinsurance', 
        '3': 'copayment'
      },
      'PI': 'payer_adjustment',
      'OA': 'other'
    };

    return typeMap[groupCode]?.[reasonCode] || typeMap[groupCode] || 'unknown';
  }

  async postPaymentToClaim(claimId, payment, context) {
    const paymentRecord = {
      claimId,
      payerId: payment.payerId,
      paymentDate: payment.paymentDate,
      paidAmount: payment.paidAmount,
      adjustments: payment.adjustments,
      services: payment.services,
      patientResponsibility: payment.patientResponsibility,
      status: 'posted',
      postedBy: context.userId,
      postedAt: new Date()
    };

    await SecureDataAccess.create('claim_payments', paymentRecord, context);

    // Update claim totals
    await SecureDataAccess.update('claims',
      { _id: claimId },
      {
        $inc: {
          totalPaid: payment.paidAmount,
          totalAdjustments: payment.totalAdjustments
        },
        $set: {
          lastPaymentDate: payment.paymentDate,
          paymentStatus: payment.patientResponsibility > 0 ? 'partial' : 'paid'
        }
      },
      context
    );
  }

  async updateClaimStatus(claimId, payment, context) {
    const claim = await SecureDataAccess.query('claims', { _id: claimId }, {}, context);
    const claimData = claim[0];
    
    const totalReceived = (claimData.totalPaid || 0) + payment.paidAmount;
    const totalCharges = claimData.totalCharges || 0;
    
    let newStatus = 'processed';
    
    if (totalReceived >= totalCharges) {
      newStatus = 'paid_in_full';
    } else if (payment.patientResponsibility > 0) {
      newStatus = 'patient_billing';
    } else if (totalReceived > 0) {
      newStatus = 'partially_paid';
    }

    await SecureDataAccess.update('claims',
      { _id: claimId },
      { $set: { status: newStatus } },
      context
    );
  }

  async createPatientBilling(claim, payment, context) {
    const patientBillingService = new PatientBillingService();
    
    await patientBillingService.createPatientStatement({
      patientId: claim.patientId,
      claimId: claim._id,
      amount: payment.patientResponsibility,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      services: payment.services,
      adjustments: payment.services.flatMap(s => s.adjustments.filter(adj => 
        adj.type === 'deductible' || adj.type === 'coinsurance' || adj.type === 'copayment'
      ))
    }, context);
  }

  async processManualCheck(checkData, context) {
    const payment = {
      type: 'manual_check',
      checkNumber: checkData.checkNumber,
      checkDate: checkData.checkDate,
      payerId: checkData.payerId,
      payerName: checkData.payerName,
      amount: checkData.amount,
      claimAllocations: checkData.claimAllocations || [],
      processedAt: new Date()
    };

    // Process each claim allocation
    for (const allocation of payment.claimAllocations) {
      await this.postManualPayment(allocation, payment, context);
    }

    return payment;
  }

  async processEFT(eftData, context) {
    const payment = {
      type: 'eft',
      transactionId: eftData.transactionId,
      bankAccount: eftData.bankAccount,
      routingNumber: eftData.routingNumber,
      amount: eftData.amount,
      effectiveDate: eftData.effectiveDate,
      payerId: eftData.payerId,
      payerName: eftData.payerName,
      processedAt: new Date()
    };

    // Match with ERA if available
    if (eftData.eraReference) {
      const era = await SecureDataAccess.query('era_files',
        { reference: eftData.eraReference },
        {},
        context
      );
      
      if (era.length > 0) {
        payment.eraId = era[0]._id;
        // Process ERA details if not already processed
      }
    }

    return payment;
  }

  async processPatientPayment(paymentData, context) {
    const payment = {
      type: 'patient_payment',
      patientId: paymentData.patientId,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      paymentDate: paymentData.paymentDate,
      reference: paymentData.reference,
      allocations: paymentData.allocations || [],
      processedAt: new Date()
    };

    // Apply to patient statements/balances
    for (const allocation of payment.allocations) {
      await this.applyPatientPayment(allocation, payment, context);
    }

    return payment;
  }

  async postToAccounting(paymentResult, context) {
    const accountingService = new AccountingService();
    
    const journalEntry = {
      type: 'payment_receipt',
      date: paymentResult.paymentDate || paymentResult.processedAt,
      entries: []
    };

    // Debit: Cash/Bank Account
    journalEntry.entries.push({
      account: this.getCashAccount(paymentResult.type),
      debit: paymentResult.totalAmount || paymentResult.amount,
      description: `Payment received - ${paymentResult.payerName || 'Patient'}`
    });

    // Credit: Accounts Receivable
    journalEntry.entries.push({
      account: 'accounts_receivable',
      credit: paymentResult.totalAmount || paymentResult.amount,
      description: `Payment applied to AR`
    });

    // Handle adjustments as separate entries
    if (paymentResult.totalAdjustments) {
      journalEntry.entries.push({
        account: 'contractual_adjustments',
        debit: paymentResult.totalAdjustments,
        description: 'Contractual adjustments'
      });
    }

    await accountingService.createJournalEntry(journalEntry, context);
  }

  getCashAccount(paymentType) {
    const accounts = {
      'era_835': 'eft_deposits',
      'eft': 'eft_deposits',
      'manual_check': 'cash_checks',
      'patient_payment': 'patient_payments'
    };
    return accounts[paymentType] || 'general_cash';
  }

  async validatePaymentData(paymentData, context) {
    const requiredFields = ['type', 'amount'];
    
    for (const field of requiredFields) {
      if (!paymentData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (paymentData.amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Type-specific validations
    switch (paymentData.type) {
      case 'era_835':
        if (!paymentData.eraFile) {
          throw new Error('ERA file required for ERA payments');
        }
        break;
      case 'manual_check':
        if (!paymentData.checkNumber) {
          throw new Error('Check number required for manual checks');
        }
        break;
      case 'patient_payment':
        if (!paymentData.patientId) {
          throw new Error('Patient ID required for patient payments');
        }
        break;
    }
  }

  async createAuditTrail(paymentData, result, context) {
    await AuditLog.create({
      action: 'PROCESS_PAYMENT',
      paymentType: paymentData.type,
      amount: paymentData.amount,
      payerId: paymentData.payerId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        paymentId: result.id,
        processedClaims: result.processedPayments?.length || 0,
        totalAdjustments: result.totalAdjustments
      },
      timestamp: new Date()
    });
  }
}

module.exports = PaymentProcessingService;
```

### 2. API Endpoints Implementation

```javascript
// File: backend/routes/payments.js
const express = require('express');
const router = express.Router();
const PaymentProcessingService = require('../services/paymentProcessingService');
const { requireAuth } = require('../middleware/auth');
const productionKMS = require('../services/productionKMS');

router.post('/process', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'payment-processing-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_PAYMENT_PROCESSING_KEY')
    };

    const paymentService = new PaymentProcessingService();
    const result = await paymentService.processPayment(req.body, context);

    res.json({
      success: true,
      payment: result,
      message: {
        he: 'התשלום עובד בהצלחה',
        en: 'Payment processed successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בעיבוד תשלום',
        en: 'Error processing payment'
      },
      details: error.message
    });
  }
});

router.post('/era/upload', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'payment-processing-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_PAYMENT_PROCESSING_KEY')
    };

    const paymentData = {
      type: 'era_835',
      eraFile: req.body.eraFile,
      payerId: req.body.payerId,
      paymentDate: req.body.paymentDate
    };

    const paymentService = new PaymentProcessingService();
    const result = await paymentService.processPayment(paymentData, context);

    res.json({
      success: true,
      processedPayments: result.processedPayments,
      totalAmount: result.totalAmount,
      message: {
        he: `${result.totalPayments} תשלומים עובדו בהצלחה`,
        en: `${result.totalPayments} payments processed successfully`
      }
    });

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בעיבוד קובץ ERA',
        en: 'Error processing ERA file'
      },
      details: error.message
    });
  }
});

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'payment-processing-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_PAYMENT_PROCESSING_KEY')
    };

    const { startDate, endDate } = req.query;

    const pipeline = [
      {
        $match: {
          practiceId: context.practiceId,
          paymentDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$paidAmount' },
          count: { $sum: 1 }
        }
      }
    ];

    const summary = await SecureDataAccess.aggregate('claim_payments', pipeline, context);

    res.json({ summary });
  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בקבלת סיכום תשלומים',
        en: 'Error retrieving payment summary'
      },
      details: error.message
    });
  }
});
```

### 3. Data Models

```javascript
// File: backend/models/ClaimPayment.js
const mongoose = require('mongoose');

const adjustmentSchema = new mongoose.Schema({
  groupCode: String, // CO, CR, OA, PI, PR
  reasonCode: String,
  amount: Number,
  quantity: Number,
  description: String,
  type: {
    type: String,
    enum: ['contractual', 'deductible', 'coinsurance', 'copayment', 'non_covered', 'other']
  }
});

const servicePaymentSchema = new mongoose.Schema({
  procedureCode: String,
  modifier: String,
  chargeAmount: Number,
  paidAmount: Number,
  allowedAmount: Number,
  adjustments: [adjustmentSchema]
});

const claimPaymentSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Claim'
  },
  payerId: String,
  payerName: String,
  paymentDate: Date,
  paidAmount: {
    type: Number,
    required: true
  },
  totalAdjustments: {
    type: Number,
    default: 0
  },
  patientResponsibility: {
    type: Number,
    default: 0
  },
  services: [servicePaymentSchema],
  status: {
    type: String,
    enum: ['pending', 'processed', 'posted', 'reversed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['era_835', 'eft', 'check', 'cash', 'credit_card']
  },
  eraId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ERAFile'
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  postedAt: Date,
  reconciled: {
    type: Boolean,
    default: false
  },
  reconciledAt: Date,
  notes: String
}, {
  timestamps: true
});

claimPaymentSchema.index({ claimId: 1, paymentDate: -1 });
claimPaymentSchema.index({ payerId: 1, paymentDate: -1 });

module.exports = mongoose.model('ClaimPayment', claimPaymentSchema);
```

### 4. Frontend Component

```jsx
// File: frontend-vite/src/components/payments/PaymentProcessor.jsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Upload, DollarSign, FileText, CreditCard } from 'lucide-react';
import secureApi from '../../services/secureApiClient';

const PaymentProcessor = ({ onPaymentProcessed }) => {
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('era');

  const processERA = async (eraFile) => {
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('eraFile', eraFile);
      formData.append('payerId', 'auto-detect');

      const response = await secureApi.post('/api/payments/era/upload', formData);
      onPaymentProcessed?.(response.data);
    } catch (error) {
      console.error('Error processing ERA:', error);
    } finally {
      setProcessing(false);
    }
  };

  const processManualPayment = async (paymentData) => {
    setProcessing(true);
    try {
      const response = await secureApi.post('/api/payments/process', paymentData);
      onPaymentProcessed?.(response.data);
    } catch (error) {
      console.error('Error processing payment:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Payment Processing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex space-x-1 border-b">
            {[
              { id: 'era', label: 'ERA Files', icon: FileText },
              { id: 'manual', label: 'Manual Entry', icon: CreditCard },
              { id: 'batch', label: 'Batch Upload', icon: Upload }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm ${
                  activeTab === tab.id 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ERA Processing */}
          {activeTab === 'era' && (
            <ERAProcessor 
              onProcess={processERA} 
              processing={processing} 
            />
          )}

          {/* Manual Payment Entry */}
          {activeTab === 'manual' && (
            <ManualPaymentEntry 
              onProcess={processManualPayment} 
              processing={processing} 
            />
          )}

          {/* Batch Upload */}
          {activeTab === 'batch' && (
            <BatchUploader 
              onProcess={processERA} 
              processing={processing} 
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ERAProcessor = ({ onProcess, processing }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onProcess(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium mb-2">Upload ERA File</h3>
        <p className="text-gray-600 mb-4">
          Drag and drop your ERA (835) file here, or click to browse
        </p>
        <input
          type="file"
          accept=".txt,.835,.x12"
          onChange={(e) => e.target.files[0] && onProcess(e.target.files[0])}
          className="hidden"
          id="era-upload"
        />
        <label htmlFor="era-upload">
          <Button variant="outline" disabled={processing}>
            {processing ? 'Processing...' : 'Browse Files'}
          </Button>
        </label>
      </div>
    </div>
  );
};

const ManualPaymentEntry = ({ onProcess, processing }) => {
  const [paymentData, setPaymentData] = useState({
    type: 'manual_check',
    checkNumber: '',
    checkDate: '',
    payerName: '',
    amount: '',
    claimAllocations: []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onProcess(paymentData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Payment Type</label>
          <select
            value={paymentData.type}
            onChange={(e) => setPaymentData(prev => ({...prev, type: e.target.value}))}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="manual_check">Check</option>
            <option value="eft">EFT</option>
            <option value="patient_payment">Patient Payment</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            value={paymentData.amount}
            onChange={(e) => setPaymentData(prev => ({...prev, amount: e.target.value}))}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Check Number</label>
          <input
            type="text"
            value={paymentData.checkNumber}
            onChange={(e) => setPaymentData(prev => ({...prev, checkNumber: e.target.value}))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Payment Date</label>
          <input
            type="date"
            value={paymentData.checkDate}
            onChange={(e) => setPaymentData(prev => ({...prev, checkDate: e.target.value}))}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Payer Name</label>
          <input
            type="text"
            value={paymentData.payerName}
            onChange={(e) => setPaymentData(prev => ({...prev, payerName: e.target.value}))}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>
      </div>

      <Button type="submit" disabled={processing} className="w-full">
        {processing ? 'Processing Payment...' : 'Process Payment'}
      </Button>
    </form>
  );
};

export default PaymentProcessor;
```

## Test Cases

### 1. Unit Tests

```javascript
// File: backend/tests/paymentProcessingService.test.js
const PaymentProcessingService = require('../services/paymentProcessingService');

describe('PaymentProcessingService', () => {
  let service;
  let mockContext;

  beforeEach(() => {
    service = new PaymentProcessingService();
    mockContext = {
      userId: 'user123',
      practiceId: 'clinic123'
    };
  });

  test('should process ERA payment successfully', async () => {
    const eraData = {
      type: 'era_835',
      eraFile: {
        payerId: 'payer123',
        claims: [{
          claimNumber: 'CLM001',
          totalPaid: 100.00,
          services: [{
            procedureCode: '99213',
            paidAmount: 100.00,
            adjustments: []
          }]
        }]
      }
    };

    const result = await service.processPayment(eraData, mockContext);
    expect(result.type).toBe('era_835');
    expect(result.processedPayments).toHaveLength(1);
  });

  test('should determine adjustment type correctly', () => {
    const type1 = service.determineAdjustmentType('CO', '1');
    expect(type1).toBe('deductible');

    const type2 = service.determineAdjustmentType('PR', '2');
    expect(type2).toBe('coinsurance');
  });
});
```

## Dependencies
- SecureDataAccess service
- Audit logging system
- Accounting service integration
- Patient billing service
- Notification service
- X12 parsing capabilities

## Success Criteria
- [ ] ERA files processed correctly with all payment details
- [ ] Manual payments posted accurately
- [ ] Adjustments categorized and handled properly
- [ ] Patient responsibility calculated and billed
- [ ] Accounting integration working
- [ ] Audit trail maintained for all transactions
- [ ] Real-time payment posting updates
- [ ] Error handling for invalid/duplicate payments
- [ ] Performance handles high-volume processing
- [ ] Compliance with healthcare payment standards