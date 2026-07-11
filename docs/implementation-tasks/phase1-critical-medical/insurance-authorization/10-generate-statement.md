# Generate Patient Statement - Implementation Task

## Function Details
- **Function Name**: `generateStatement`
- **Location**: `backend/services/patientStatementService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Estimated Time**: 3-4 days
- **Complexity**: Medium-High

## Problem Description
Implement comprehensive patient statement generation functionality for creating detailed billing statements that include charges, payments, adjustments, insurance information, and patient responsibilities. The system must support multiple formats (PDF, HTML, print), multi-language support (Hebrew/English), and compliance with healthcare billing regulations.

## Implementation Steps

### 1. Patient Statement Service Implementation

```javascript
// File: backend/services/patientStatementService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const PDFGenerator = require('./pdfGeneratorService');
const HTMLGenerator = require('./htmlGeneratorService');
const NotificationService = require('./notificationService');

class PatientStatementService {
  constructor() {
    this.statementTemplates = {
      standard: 'standard-statement',
      detailed: 'detailed-statement',
      summary: 'summary-statement',
      aging: 'aging-statement'
    };
  }

  async generateStatement(patientId, options = {}, context) {
    try {
      // Validate inputs
      await this.validateInputs(patientId, options, context);

      // Gather statement data
      const statementData = await this.gatherStatementData(patientId, options, context);

      // Generate statement in requested format
      const statement = await this.createStatement(statementData, options, context);

      // Store statement record
      const statementRecord = await this.storeStatement(statement, statementData, options, context);

      // Send notifications if requested
      if (options.sendNotification) {
        await this.sendStatementNotification(statementRecord, statementData, context);
      }

      // Create audit log
      await this.createAuditLog(patientId, statementRecord, context);

      return statementRecord;

    } catch (error) {
      await AuditLog.create({
        action: 'GENERATE_STATEMENT_ERROR',
        patientId,
        error: error.message,
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async gatherStatementData(patientId, options, context) {
    const startDate = options.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year back
    const endDate = options.endDate || new Date();

    // Get patient information
    const patients = await SecureDataAccess.query('patients',
      { _id: patientId },
      { include: ['demographics', 'insurance', 'contacts'] },
      context
    );

    if (!patients.length) {
      throw new Error('Patient not found');
    }

    const patient = patients[0];

    // Get all charges within date range
    const charges = await this.getPatientCharges(patientId, startDate, endDate, context);

    // Get all payments within date range  
    const payments = await this.getPatientPayments(patientId, startDate, endDate, context);

    // Get all adjustments
    const adjustments = await this.getPatientAdjustments(patientId, startDate, endDate, context);

    // Get current balance
    const currentBalance = await this.calculateCurrentBalance(patientId, context);

    // Get aging information
    const agingData = await this.calculateAgingData(patientId, context);

    // Get insurance information
    const insuranceInfo = await this.getInsuranceInformation(patientId, context);

    return {
      patient,
      statementDate: new Date(),
      statementPeriod: { startDate, endDate },
      charges,
      payments,
      adjustments,
      currentBalance,
      agingData,
      insuranceInfo,
      practice: context.practice,
      previousBalance: await this.getPreviousBalance(patientId, startDate, context)
    };
  }

  async getPatientCharges(patientId, startDate, endDate, context) {
    const charges = await SecureDataAccess.query('charges',
      {
        patientId,
        serviceDate: { $gte: startDate, $lte: endDate }
      },
      {
        sort: { serviceDate: 1 },
        include: ['services', 'diagnosis', 'provider']
      },
      context
    );

    return charges.map(charge => ({
      date: charge.serviceDate,
      description: charge.description,
      procedureCode: charge.procedureCode,
      procedureDescription: charge.procedureDescription,
      provider: charge.provider?.name,
      amount: charge.amount,
      insurancePaid: charge.insurancePaid || 0,
      adjustments: charge.adjustments || 0,
      patientResponsibility: charge.amount - (charge.insurancePaid || 0) - (charge.adjustments || 0),
      claimNumber: charge.claimNumber
    }));
  }

  async getPatientPayments(patientId, startDate, endDate, context) {
    const payments = await SecureDataAccess.query('patient_payments',
      {
        patientId,
        paymentDate: { $gte: startDate, $lte: endDate }
      },
      {
        sort: { paymentDate: 1 }
      },
      context
    );

    return payments.map(payment => ({
      date: payment.paymentDate,
      description: payment.description || 'Patient Payment',
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference,
      appliedTo: payment.appliedTo
    }));
  }

  async getPatientAdjustments(patientId, startDate, endDate, context) {
    const adjustments = await SecureDataAccess.query('patient_adjustments',
      {
        patientId,
        adjustmentDate: { $gte: startDate, $lte: endDate }
      },
      {
        sort: { adjustmentDate: 1 }
      },
      context
    );

    return adjustments.map(adjustment => ({
      date: adjustment.adjustmentDate,
      description: adjustment.description,
      amount: adjustment.amount,
      type: adjustment.type,
      reason: adjustment.reason
    }));
  }

  async calculateCurrentBalance(patientId, context) {
    const pipeline = [
      { $match: { patientId } },
      {
        $group: {
          _id: null,
          totalCharges: { $sum: '$amount' },
          totalPayments: { $sum: '$paidAmount' },
          totalAdjustments: { $sum: '$adjustmentAmount' }
        }
      }
    ];

    const result = await SecureDataAccess.aggregate('patient_transactions', pipeline, context);
    
    if (result.length === 0) return 0;

    const data = result[0];
    return (data.totalCharges || 0) - (data.totalPayments || 0) - (data.totalAdjustments || 0);
  }

  async calculateAgingData(patientId, context) {
    const today = new Date();
    const periods = {
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      days120: 0
    };

    const unpaidCharges = await SecureDataAccess.query('charges',
      {
        patientId,
        status: { $in: ['unpaid', 'partially_paid'] }
      },
      {},
      context
    );

    for (const charge of unpaidCharges) {
      const daysPast = Math.floor((today - charge.serviceDate) / (1000 * 60 * 60 * 24));
      const balance = charge.amount - (charge.paidAmount || 0);

      if (daysPast <= 30) {
        periods.current += balance;
      } else if (daysPast <= 60) {
        periods.days30 += balance;
      } else if (daysPast <= 90) {
        periods.days60 += balance;
      } else if (daysPast <= 120) {
        periods.days90 += balance;
      } else {
        periods.days120 += balance;
      }
    }

    return periods;
  }

  async getInsuranceInformation(patientId, context) {
    const insurance = await SecureDataAccess.query('patient_insurance',
      { patientId, status: 'active' },
      { sort: { priority: 1 } },
      context
    );

    return insurance.map(ins => ({
      priority: ins.priority,
      payerName: ins.payerName,
      policyNumber: ins.policyNumber,
      groupNumber: ins.groupNumber,
      effectiveDate: ins.effectiveDate,
      deductible: ins.deductible,
      deductibleMet: ins.deductibleMet,
      copay: ins.copay,
      coinsurance: ins.coinsurance
    }));
  }

  async createStatement(statementData, options, context) {
    const format = options.format || 'pdf';
    const template = options.template || 'standard';
    const language = options.language || 'en';

    const statementContent = {
      header: this.createStatementHeader(statementData, language),
      patientInfo: this.createPatientSection(statementData, language),
      accountSummary: this.createAccountSummary(statementData, language),
      transactionDetail: this.createTransactionDetail(statementData, language),
      insuranceInfo: this.createInsuranceSection(statementData, language),
      paymentInfo: this.createPaymentSection(statementData, language),
      footer: this.createStatementFooter(statementData, language)
    };

    switch (format.toLowerCase()) {
      case 'pdf':
        return await this.generatePDFStatement(statementContent, template, options, context);
      case 'html':
        return await this.generateHTMLStatement(statementContent, template, options, context);
      case 'print':
        return await this.generatePrintStatement(statementContent, template, options, context);
      default:
        throw new Error('Unsupported statement format');
    }
  }

  createStatementHeader(data, language) {
    const texts = {
      en: {
        title: 'Patient Statement',
        statementDate: 'Statement Date',
        accountNumber: 'Account Number',
        statementPeriod: 'Statement Period'
      },
      he: {
        title: 'דוח חשבון מטופל',
        statementDate: 'תאריך דוח',
        accountNumber: 'מספר חשבון',
        statementPeriod: 'תקופת דוח'
      }
    };

    const text = texts[language];

    return {
      practiceName: data.practice.name,
      clinicAddress: data.practice.address,
      clinicPhone: data.practice.phone,
      clinicEmail: data.practice.email,
      title: text.title,
      statementDate: data.statementDate.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US'),
      accountNumber: data.patient.accountNumber || data.patient._id,
      statementPeriod: `${data.statementPeriod.startDate.toLocaleDateString()} - ${data.statementPeriod.endDate.toLocaleDateString()}`
    };
  }

  createPatientSection(data, language) {
    const patient = data.patient;
    const texts = {
      en: {
        patientInfo: 'Patient Information',
        guarantor: 'Guarantor Information'
      },
      he: {
        patientInfo: 'פרטי מטופל',
        guarantor: 'פרטי ערב'
      }
    };

    return {
      title: texts[language].patientInfo,
      name: `${patient.firstName} ${patient.lastName}`,
      address: patient.address,
      phone: patient.phone,
      email: patient.email,
      dateOfBirth: patient.dateOfBirth?.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US'),
      guarantor: patient.guarantor ? {
        title: texts[language].guarantor,
        name: `${patient.guarantor.firstName} ${patient.guarantor.lastName}`,
        address: patient.guarantor.address,
        phone: patient.guarantor.phone
      } : null
    };
  }

  createAccountSummary(data, language) {
    const texts = {
      en: {
        title: 'Account Summary',
        previousBalance: 'Previous Balance',
        charges: 'New Charges',
        payments: 'Payments',
        adjustments: 'Adjustments',
        currentBalance: 'Current Balance',
        amountDue: 'Amount Due'
      },
      he: {
        title: 'סיכום חשבון',
        previousBalance: 'יתרה קודמת',
        charges: 'חיובים חדשים',
        payments: 'תשלומים',
        adjustments: 'התאמות',
        currentBalance: 'יתרה נוכחית',
        amountDue: 'סכום לתשלום'
      }
    };

    const text = texts[language];
    const totalCharges = data.charges.reduce((sum, charge) => sum + charge.amount, 0);
    const totalPayments = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalAdjustments = data.adjustments.reduce((sum, adj) => sum + adj.amount, 0);

    return {
      title: text.title,
      previousBalance: {
        label: text.previousBalance,
        amount: data.previousBalance
      },
      charges: {
        label: text.charges,
        amount: totalCharges
      },
      payments: {
        label: text.payments,
        amount: -totalPayments
      },
      adjustments: {
        label: text.adjustments,
        amount: -totalAdjustments
      },
      currentBalance: {
        label: text.currentBalance,
        amount: data.currentBalance
      },
      aging: data.agingData
    };
  }

  createTransactionDetail(data, language) {
    const texts = {
      en: {
        title: 'Transaction Detail',
        date: 'Date',
        description: 'Description',
        provider: 'Provider',
        charges: 'Charges',
        payments: 'Payments',
        balance: 'Balance'
      },
      he: {
        title: 'פירוט תנועות',
        date: 'תאריך',
        description: 'תיאור',
        provider: 'רופא',
        charges: 'חיובים',
        payments: 'תשלומים',
        balance: 'יתרה'
      }
    };

    const transactions = [];

    // Add charges
    for (const charge of data.charges) {
      transactions.push({
        date: charge.date,
        description: charge.description,
        provider: charge.provider,
        charges: charge.amount,
        payments: 0,
        type: 'charge'
      });
    }

    // Add payments
    for (const payment of data.payments) {
      transactions.push({
        date: payment.date,
        description: payment.description,
        provider: '',
        charges: 0,
        payments: payment.amount,
        type: 'payment'
      });
    }

    // Add adjustments
    for (const adjustment of data.adjustments) {
      transactions.push({
        date: adjustment.date,
        description: `${adjustment.description} (${adjustment.reason})`,
        provider: '',
        charges: 0,
        payments: adjustment.amount,
        type: 'adjustment'
      });
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let runningBalance = data.previousBalance;
    for (const transaction of transactions) {
      runningBalance += transaction.charges - transaction.payments;
      transaction.balance = runningBalance;
    }

    return {
      title: texts[language].title,
      headers: texts[language],
      transactions
    };
  }

  createInsuranceSection(data, language) {
    const texts = {
      en: {
        title: 'Insurance Information',
        primary: 'Primary Insurance',
        secondary: 'Secondary Insurance',
        policyNumber: 'Policy Number',
        groupNumber: 'Group Number',
        deductible: 'Deductible',
        deductibleMet: 'Deductible Met'
      },
      he: {
        title: 'מידע ביטוח',
        primary: 'ביטוח ראשי',
        secondary: 'ביטוח משני',
        policyNumber: 'מספר פוליסה',
        groupNumber: 'מספר קבוצה',
        deductible: 'השתתפות עצמית',
        deductibleMet: 'השתתפות שולמה'
      }
    };

    return {
      title: texts[language].title,
      insurances: data.insuranceInfo.map(ins => ({
        priority: ins.priority === 1 ? texts[language].primary : texts[language].secondary,
        payerName: ins.payerName,
        policyNumber: ins.policyNumber,
        groupNumber: ins.groupNumber,
        deductible: ins.deductible,
        deductibleMet: ins.deductibleMet
      }))
    };
  }

  createPaymentSection(data, language) {
    const texts = {
      en: {
        title: 'Payment Information',
        amountDue: 'Amount Due',
        dueDate: 'Due Date',
        paymentMethods: 'Payment Methods',
        onlinePortal: 'Online Portal',
        phone: 'By Phone',
        mail: 'By Mail',
        questions: 'Questions about your bill? Contact us:'
      },
      he: {
        title: 'מידע תשלום',
        amountDue: 'סכום לתשלום',
        dueDate: 'תאריך יעד',
        paymentMethods: 'דרכי תשלום',
        onlinePortal: 'פורטל אינטרנט',
        phone: 'בטלפון',
        mail: 'בדואר',
        questions: 'יש לך שאלות על החשבון? צור קשר:'
      }
    };

    return {
      title: texts[language].title,
      amountDue: data.currentBalance,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      paymentMethods: {
        online: {
          label: texts[language].onlinePortal,
          url: data.practice.patientPortalUrl
        },
        phone: {
          label: texts[language].phone,
          number: data.practice.billingPhone
        },
        mail: {
          label: texts[language].mail,
          address: data.practice.billingAddress
        }
      },
      contact: {
        label: texts[language].questions,
        phone: data.practice.billingPhone,
        email: data.practice.billingEmail
      }
    };
  }

  async generatePDFStatement(content, template, options, context) {
    const pdfGenerator = new PDFGenerator();
    
    const pdfOptions = {
      template: this.statementTemplates[template],
      format: 'A4',
      orientation: 'portrait',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      },
      language: options.language || 'en'
    };

    const pdfBuffer = await pdfGenerator.generateDocument(content, pdfOptions);

    return {
      format: 'pdf',
      content: pdfBuffer,
      mimeType: 'application/pdf',
      filename: `statement_${content.header.accountNumber}_${Date.now()}.pdf`
    };
  }

  async generateHTMLStatement(content, template, options, context) {
    const htmlGenerator = new HTMLGenerator();
    
    const htmlOptions = {
      template: this.statementTemplates[template],
      language: options.language || 'en',
      includeCss: true
    };

    const htmlContent = await htmlGenerator.generateDocument(content, htmlOptions);

    return {
      format: 'html',
      content: htmlContent,
      mimeType: 'text/html',
      filename: `statement_${content.header.accountNumber}_${Date.now()}.html`
    };
  }

  async storeStatement(statement, statementData, options, context) {
    const statementRecord = {
      patientId: statementData.patient._id,
      statementDate: statementData.statementDate,
      statementPeriod: statementData.statementPeriod,
      format: statement.format,
      template: options.template || 'standard',
      language: options.language || 'en',
      filename: statement.filename,
      fileSize: Buffer.byteLength(statement.content),
      currentBalance: statementData.currentBalance,
      totalCharges: statementData.charges.reduce((sum, c) => sum + c.amount, 0),
      totalPayments: statementData.payments.reduce((sum, p) => sum + p.amount, 0),
      status: 'generated',
      generatedBy: context.userId,
      sentDate: null
    };

    // Store file content securely
    const secureStorage = require('./secureFileStorage');
    const storagePath = await secureStorage.store(
      statement.content,
      statement.filename,
      'patient-statements',
      context
    );

    statementRecord.filePath = storagePath;

    const savedStatement = await SecureDataAccess.create('patient_statements', statementRecord, context);

    return {
      ...savedStatement,
      downloadUrl: `/api/statements/${savedStatement._id}/download`
    };
  }

  async sendStatementNotification(statementRecord, statementData, context) {
    const patient = statementData.patient;
    const notificationData = {
      type: 'patient_statement',
      recipients: [patient.email],
      data: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        statementDate: statementRecord.statementDate,
        currentBalance: statementRecord.currentBalance,
        downloadUrl: statementRecord.downloadUrl
      },
      attachments: [{
        filename: statementRecord.filename,
        path: statementRecord.filePath
      }]
    };

    await NotificationService.send(notificationData);

    // Update statement record
    await SecureDataAccess.update('patient_statements',
      { _id: statementRecord._id },
      { 
        $set: { 
          sentDate: new Date(),
          status: 'sent'
        }
      },
      context
    );
  }

  async createAuditLog(patientId, statementRecord, context) {
    await AuditLog.create({
      action: 'GENERATE_PATIENT_STATEMENT',
      patientId,
      statementId: statementRecord._id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        format: statementRecord.format,
        currentBalance: statementRecord.currentBalance,
        sentStatus: statementRecord.status
      },
      timestamp: new Date()
    });
  }

  async validateInputs(patientId, options, context) {
    if (!patientId) {
      throw new Error('Patient ID is required');
    }

    if (options.startDate && options.endDate && options.startDate > options.endDate) {
      throw new Error('Start date cannot be after end date');
    }

    const supportedFormats = ['pdf', 'html', 'print'];
    if (options.format && !supportedFormats.includes(options.format)) {
      throw new Error('Unsupported format. Supported formats: ' + supportedFormats.join(', '));
    }
  }
}

module.exports = PatientStatementService;
```

### 2. API Endpoints

```javascript
// File: backend/routes/statements.js
const express = require('express');
const router = express.Router();
const PatientStatementService = require('../services/patientStatementService');
const { requireAuth } = require('../middleware/auth');

router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { patientId, options = {} } = req.body;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      practice: req.practice,
      serviceId: 'patient-statement-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_PATIENT_STATEMENT_KEY')
    };

    const statementService = new PatientStatementService();
    const statement = await statementService.generateStatement(patientId, options, context);

    res.json({
      success: true,
      statement,
      message: {
        he: 'דוח חשבון נוצר בהצלחה',
        en: 'Statement generated successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה ביצירת דוח חשבון',
        en: 'Error generating statement'
      },
      details: error.message
    });
  }
});

router.get('/:statementId/download', requireAuth, async (req, res) => {
  try {
    const { statementId } = req.params;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'patient-statement-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_PATIENT_STATEMENT_KEY')
    };

    const statements = await SecureDataAccess.query('patient_statements',
      { _id: statementId },
      {},
      context
    );

    if (!statements.length) {
      return res.status(404).json({
        error: {
          he: 'דוח חשבון לא נמצא',
          en: 'Statement not found'
        }
      });
    }

    const statement = statements[0];
    const secureStorage = require('../services/secureFileStorage');
    const fileContent = await secureStorage.retrieve(statement.filePath, context);

    res.setHeader('Content-Type', statement.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${statement.filename}"`);
    res.send(fileContent);

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בהורדת דוח חשבון',
        en: 'Error downloading statement'
      },
      details: error.message
    });
  }
});
```

### 3. Frontend Component

```jsx
// File: frontend-vite/src/components/statements/StatementGenerator.jsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Download, FileText, Mail, Loader2 } from 'lucide-react';
import secureApi from '../../services/secureApiClient';

const StatementGenerator = ({ patientId, onStatementGenerated }) => {
  const [generating, setGenerating] = useState(false);
  const [options, setOptions] = useState({
    format: 'pdf',
    template: 'standard',
    language: 'en',
    sendEmail: false,
    startDate: '',
    endDate: ''
  });

  const generateStatement = async () => {
    setGenerating(true);
    try {
      const response = await secureApi.post('/api/statements/generate', {
        patientId,
        options
      });

      onStatementGenerated?.(response.data.statement);
      
      if (options.format === 'pdf') {
        // Auto-download PDF
        window.open(response.data.statement.downloadUrl, '_blank');
      }

    } catch (error) {
      console.error('Error generating statement:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Generate Patient Statement
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Format</label>
            <div className="flex gap-2">
              {['pdf', 'html'].map(format => (
                <Button
                  key={format}
                  variant={options.format === format ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOptions(prev => ({...prev, format}))}
                >
                  {format.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Template</label>
            <select
              value={options.template}
              onChange={(e) => setOptions(prev => ({...prev, template: e.target.value}))}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="standard">Standard</option>
              <option value="detailed">Detailed</option>
              <option value="summary">Summary</option>
              <option value="aging">Aging Report</option>
            </select>
          </div>

          {/* Language Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Language</label>
            <div className="flex gap-2">
              {[
                { value: 'en', label: 'English' },
                { value: 'he', label: 'עברית' }
              ].map(lang => (
                <Button
                  key={lang.value}
                  variant={options.language === lang.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOptions(prev => ({...prev, language: lang.value}))}
                >
                  {lang.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={options.startDate}
                onChange={(e) => setOptions(prev => ({...prev, startDate: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={options.endDate}
                onChange={(e) => setOptions(prev => ({...prev, endDate: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Email Option */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="sendEmail"
              checked={options.sendEmail}
              onChange={(e) => setOptions(prev => ({...prev, sendEmail: e.target.checked}))}
              className="rounded border-gray-300"
            />
            <label htmlFor="sendEmail" className="text-sm font-medium">
              Email statement to patient
            </label>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={generateStatement} 
            disabled={generating}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate Statement
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatementGenerator;
```

## Test Cases

### 1. Unit Tests

```javascript
// File: backend/tests/patientStatementService.test.js
const PatientStatementService = require('../services/patientStatementService');

describe('PatientStatementService', () => {
  let service;
  let mockContext;

  beforeEach(() => {
    service = new PatientStatementService();
    mockContext = {
      userId: 'user123',
      practiceId: 'clinic123'
    };
  });

  test('should generate statement successfully', async () => {
    const options = {
      format: 'pdf',
      template: 'standard',
      language: 'en'
    };

    const result = await service.generateStatement('patient123', options, mockContext);
    expect(result.format).toBe('pdf');
    expect(result.status).toBe('generated');
  });

  test('should calculate aging data correctly', async () => {
    const agingData = await service.calculateAgingData('patient123', mockContext);
    expect(agingData).toHaveProperty('current');
    expect(agingData).toHaveProperty('days30');
  });
});
```

## Dependencies
- SecureDataAccess service
- PDF generation service
- HTML generation service
- Secure file storage
- Notification service
- Audit logging system

## Success Criteria
- [ ] Statements generated in multiple formats (PDF, HTML)
- [ ] Multi-language support (Hebrew/English)
- [ ] Comprehensive transaction detail included
- [ ] Aging analysis calculated correctly
- [ ] Insurance information displayed accurately
- [ ] Email delivery functionality working
- [ ] Secure file storage and retrieval
- [ ] Audit trail maintained
- [ ] Performance handles high-volume generation
- [ ] Template customization capabilities