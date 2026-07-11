# Receive Lab Results - Implementation Task

## Function Details
- **Function Name**: `receiveResults`
- **Location**: `backend/services/labResultsReceivingService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Estimated Time**: 3-4 days
- **Complexity**: High

## Problem Description
Implement comprehensive laboratory results receiving functionality to accept, validate, process, and store results from multiple laboratory systems. The system must handle various data formats (HL7 ORU, CSV, XML, JSON), perform data validation, duplicate detection, result interpretation, and automatic distribution to healthcare providers. Integration with multiple laboratory information systems and real-time processing capabilities are required.

## Implementation Steps

### 1. Lab Results Receiving Service Implementation

```javascript
// File: backend/services/labResultsReceivingService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const HL7Parser = require('./hl7Parser');
const ValidationService = require('./validationService');
const NotificationService = require('./notificationService');
const ResultInterpretationService = require('./resultInterpretationService');

class LabResultsReceivingService {
  constructor() {
    this.supportedFormats = {
      'hl7_oru': 'HL7 ORU^R01 Messages',
      'csv': 'Comma Separated Values',
      'xml': 'XML Format',
      'json': 'JSON Format',
      'delimited': 'Pipe/Tab Delimited',
      'lis_api': 'Laboratory Information System API'
    };

    this.processingSteps = [
      'receive',
      'validate_format',
      'parse_data',
      'validate_content',
      'check_duplicates',
      'interpret_results',
      'store_results',
      'notify_providers',
      'update_orders'
    ];

    this.validationRules = {
      'required_fields': ['patient_id', 'test_code', 'result_value', 'result_date'],
      'numeric_tests': ['glucose', 'creatinine', 'hemoglobin', 'wbc', 'plt'],
      'text_tests': ['culture', 'microscopy', 'pathology'],
      'critical_value_tests': ['glucose', 'potassium', 'hemoglobin', 'plt', 'inr']
    };
  }

  async receiveResults(resultsData, context) {
    try {
      // Initialize processing session
      const processingSession = await this.initializeProcessingSession(resultsData, context);

      // Step 1: Validate incoming data format
      const formatValidation = await this.validateDataFormat(resultsData, context);
      await this.updateProcessingStep(processingSession._id, 'validate_format', formatValidation, context);

      // Step 2: Parse the results data
      const parsedResults = await this.parseResultsData(resultsData, formatValidation.detectedFormat, context);
      await this.updateProcessingStep(processingSession._id, 'parse_data', { count: parsedResults.length }, context);

      // Step 3: Validate content for each result
      const validatedResults = await this.validateResultsContent(parsedResults, context);
      await this.updateProcessingStep(processingSession._id, 'validate_content', validatedResults.summary, context);

      // Step 4: Check for duplicates
      const deduplicatedResults = await this.checkDuplicates(validatedResults.valid, context);
      await this.updateProcessingStep(processingSession._id, 'check_duplicates', { 
        duplicatesFound: validatedResults.valid.length - deduplicatedResults.length 
      }, context);

      // Step 5: Interpret results (abnormal flags, critical values)
      const interpretedResults = await this.interpretResults(deduplicatedResults, context);
      await this.updateProcessingStep(processingSession._id, 'interpret_results', {
        criticalValues: interpretedResults.filter(r => r.isCritical).length
      }, context);

      // Step 6: Store results in database
      const storedResults = await this.storeResults(interpretedResults, context);
      await this.updateProcessingStep(processingSession._id, 'store_results', { 
        stored: storedResults.length 
      }, context);

      // Step 7: Send notifications to providers
      const notifications = await this.notifyProviders(storedResults, context);
      await this.updateProcessingStep(processingSession._id, 'notify_providers', {
        notificationsSent: notifications.length
      }, context);

      // Step 8: Update related lab orders
      const orderUpdates = await this.updateLabOrders(storedResults, context);
      await this.updateProcessingStep(processingSession._id, 'update_orders', {
        ordersUpdated: orderUpdates.length
      }, context);

      // Complete processing session
      await this.completeProcessingSession(processingSession._id, {
        totalReceived: parsedResults.length,
        validResults: validatedResults.valid.length,
        invalidResults: validatedResults.invalid.length,
        duplicates: validatedResults.valid.length - deduplicatedResults.length,
        criticalValues: interpretedResults.filter(r => r.isCritical).length,
        stored: storedResults.length,
        notificationsSent: notifications.length,
        ordersUpdated: orderUpdates.length
      }, context);

      return {
        sessionId: processingSession._id,
        status: 'completed',
        summary: {
          totalReceived: parsedResults.length,
          processed: storedResults.length,
          criticalValues: interpretedResults.filter(r => r.isCritical).length,
          errors: validatedResults.invalid.length,
          duplicates: validatedResults.valid.length - deduplicatedResults.length
        },
        processingTime: new Date() - processingSession.startTime
      };

    } catch (error) {
      await AuditLog.create({
        action: 'RECEIVE_RESULTS_ERROR',
        error: error.message,
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async initializeProcessingSession(resultsData, context) {
    const session = {
      startTime: new Date(),
      dataSource: resultsData.source || 'unknown',
      dataFormat: resultsData.format || 'auto-detect',
      dataSize: JSON.stringify(resultsData).length,
      status: 'processing',
      steps: {},
      practiceId: context.practiceId,
      processedBy: context.userId
    };

    const savedSession = await SecureDataAccess.create('result_processing_sessions', session, context);

    await AuditLog.create({
      action: 'START_RESULTS_PROCESSING',
      sessionId: savedSession._id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        dataSource: session.dataSource,
        dataSize: session.dataSize
      },
      timestamp: new Date()
    });

    return savedSession;
  }

  async validateDataFormat(resultsData, context) {
    const validation = {
      isValid: false,
      detectedFormat: null,
      errors: [],
      warnings: []
    };

    try {
      // Auto-detect format if not specified
      if (resultsData.format) {
        validation.detectedFormat = resultsData.format;
      } else {
        validation.detectedFormat = await this.detectDataFormat(resultsData.data);
      }

      // Validate based on detected format
      switch (validation.detectedFormat) {
        case 'hl7_oru':
          validation = await this.validateHL7Format(resultsData.data, validation);
          break;
        case 'csv':
          validation = await this.validateCSVFormat(resultsData.data, validation);
          break;
        case 'xml':
          validation = await this.validateXMLFormat(resultsData.data, validation);
          break;
        case 'json':
          validation = await this.validateJSONFormat(resultsData.data, validation);
          break;
        default:
          validation.errors.push('Unsupported or unrecognized data format');
      }

      validation.isValid = validation.errors.length === 0;

    } catch (error) {
      validation.errors.push(`Format validation error: ${error.message}`);
    }

    return validation;
  }

  async detectDataFormat(data) {
    if (typeof data === 'string') {
      // Check for HL7 format
      if (data.includes('MSH|') && data.includes('OBR|') && data.includes('OBX|')) {
        return 'hl7_oru';
      }
      
      // Check for CSV format
      if (data.includes(',') && (data.includes('\n') || data.includes('\r'))) {
        return 'csv';
      }
      
      // Check for XML format
      if (data.trim().startsWith('<') && data.includes('</')) {
        return 'xml';
      }
      
      // Try parsing as JSON
      try {
        JSON.parse(data);
        return 'json';
      } catch (e) {
        // Not JSON
      }
    } else if (typeof data === 'object') {
      return 'json';
    }

    return 'unknown';
  }

  async validateHL7Format(data, validation) {
    try {
      const hl7Parser = new HL7Parser();
      const parsed = await hl7Parser.parse(data);
      
      if (!parsed.messageHeader) {
        validation.errors.push('Missing HL7 message header (MSH)');
      }
      
      if (parsed.messageHeader?.messageType !== 'ORU^R01') {
        validation.warnings.push('Expected ORU^R01 message type for lab results');
      }
      
      if (!parsed.observationRequest) {
        validation.errors.push('Missing observation request (OBR) segment');
      }
      
      if (!parsed.observations || parsed.observations.length === 0) {
        validation.errors.push('No observation (OBX) segments found');
      }

    } catch (error) {
      validation.errors.push(`HL7 parsing error: ${error.message}`);
    }

    return validation;
  }

  async validateCSVFormat(data, validation) {
    try {
      const lines = data.split(/\r?\n/);
      const headers = lines[0]?.split(',').map(h => h.trim());
      
      if (!headers || headers.length < 4) {
        validation.errors.push('CSV must have at least 4 columns');
      }

      const requiredHeaders = ['patient_id', 'test_code', 'result', 'date'];
      const missingHeaders = requiredHeaders.filter(h => 
        !headers.some(header => header.toLowerCase().includes(h))
      );

      if (missingHeaders.length > 0) {
        validation.warnings.push(`Recommended headers not found: ${missingHeaders.join(', ')}`);
      }

      if (lines.length < 2) {
        validation.errors.push('CSV must contain at least one data row');
      }

    } catch (error) {
      validation.errors.push(`CSV parsing error: ${error.message}`);
    }

    return validation;
  }

  async validateJSONFormat(data, validation) {
    try {
      let jsonData = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (!Array.isArray(jsonData)) {
        if (jsonData.results && Array.isArray(jsonData.results)) {
          jsonData = jsonData.results;
        } else {
          validation.errors.push('JSON must contain an array of results');
          return validation;
        }
      }

      if (jsonData.length === 0) {
        validation.errors.push('JSON array cannot be empty');
      }

      // Validate first few records for structure
      const sampleSize = Math.min(3, jsonData.length);
      for (let i = 0; i < sampleSize; i++) {
        const result = jsonData[i];
        const requiredFields = ['patientId', 'testCode', 'result'];
        const missingFields = requiredFields.filter(field => !result[field]);
        
        if (missingFields.length > 0) {
          validation.warnings.push(`Record ${i + 1} missing fields: ${missingFields.join(', ')}`);
        }
      }

    } catch (error) {
      validation.errors.push(`JSON parsing error: ${error.message}`);
    }

    return validation;
  }

  async parseResultsData(resultsData, format, context) {
    let parsedResults = [];

    try {
      switch (format) {
        case 'hl7_oru':
          parsedResults = await this.parseHL7Results(resultsData.data);
          break;
        case 'csv':
          parsedResults = await this.parseCSVResults(resultsData.data);
          break;
        case 'xml':
          parsedResults = await this.parseXMLResults(resultsData.data);
          break;
        case 'json':
          parsedResults = await this.parseJSONResults(resultsData.data);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Add metadata to each result
      parsedResults = parsedResults.map(result => ({
        ...result,
        receivedAt: new Date(),
        sourceFormat: format,
        sourceSystem: resultsData.source || 'unknown',
        processingId: context.sessionId
      }));

    } catch (error) {
      throw new Error(`Parsing failed: ${error.message}`);
    }

    return parsedResults;
  }

  async parseHL7Results(hl7Data) {
    const hl7Parser = new HL7Parser();
    const parsed = await hl7Parser.parse(hl7Data);
    const results = [];

    const patientInfo = parsed.patientIdentification;
    const observationRequest = parsed.observationRequest;

    for (const observation of parsed.observations) {
      results.push({
        patientId: patientInfo?.patientId || patientInfo?.patientIdList?.[0],
        patientName: `${patientInfo?.patientName?.familyName}, ${patientInfo?.patientName?.givenName}`,
        orderNumber: observationRequest?.placerOrderNumber,
        testCode: observation.observationIdentifier,
        testName: observation.observationText,
        result: observation.observationValue,
        units: observation.units,
        referenceRange: observation.referencesRange,
        abnormalFlag: observation.abnormalFlag,
        resultStatus: observation.observationResultStatus,
        resultDate: observation.observationDateTime,
        performingLab: observationRequest?.orderingProvider,
        specimenType: observationRequest?.specimenSource
      });
    }

    return results;
  }

  async parseCSVResults(csvData) {
    const lines = csvData.split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      const result = {};

      headers.forEach((header, index) => {
        result[this.mapCSVHeader(header)] = values[index] || '';
      });

      if (result.patientId && result.testCode && result.result) {
        results.push(result);
      }
    }

    return results;
  }

  async parseJSONResults(jsonData) {
    let data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    if (!Array.isArray(data)) {
      if (data.results && Array.isArray(data.results)) {
        data = data.results;
      } else {
        throw new Error('JSON data must be an array or contain a results array');
      }
    }

    return data.map(result => ({
      patientId: result.patientId || result.patient_id,
      patientName: result.patientName || result.patient_name,
      orderNumber: result.orderNumber || result.order_number,
      testCode: result.testCode || result.test_code,
      testName: result.testName || result.test_name,
      result: result.result || result.value,
      units: result.units || result.unit,
      referenceRange: result.referenceRange || result.reference_range,
      abnormalFlag: result.abnormalFlag || result.abnormal_flag,
      resultStatus: result.resultStatus || result.status || 'final',
      resultDate: result.resultDate || result.date,
      performingLab: result.performingLab || result.lab,
      specimenType: result.specimenType || result.specimen
    }));
  }

  mapCSVHeader(header) {
    const headerMap = {
      'patient_id': 'patientId',
      'patient_name': 'patientName',
      'order_number': 'orderNumber',
      'test_code': 'testCode',
      'test_name': 'testName',
      'result': 'result',
      'value': 'result',
      'units': 'units',
      'unit': 'units',
      'reference_range': 'referenceRange',
      'abnormal_flag': 'abnormalFlag',
      'status': 'resultStatus',
      'date': 'resultDate',
      'lab': 'performingLab',
      'specimen': 'specimenType'
    };

    return headerMap[header] || header;
  }

  async validateResultsContent(parsedResults, context) {
    const validationService = new ValidationService();
    const valid = [];
    const invalid = [];

    for (const result of parsedResults) {
      const validation = await this.validateSingleResult(result, validationService);
      
      if (validation.isValid) {
        valid.push({
          ...result,
          validation: validation
        });
      } else {
        invalid.push({
          ...result,
          validation: validation,
          errors: validation.errors
        });
      }
    }

    return {
      valid,
      invalid,
      summary: {
        total: parsedResults.length,
        valid: valid.length,
        invalid: invalid.length,
        validationRate: (valid.length / parsedResults.length * 100).toFixed(2)
      }
    };
  }

  async validateSingleResult(result, validationService) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Required field validation
    const requiredFields = ['patientId', 'testCode', 'result'];
    for (const field of requiredFields) {
      if (!result[field] || result[field].toString().trim() === '') {
        validation.errors.push(`Missing required field: ${field}`);
      }
    }

    // Patient ID validation
    if (result.patientId && !await this.validatePatientExists(result.patientId)) {
      validation.warnings.push('Patient ID not found in system');
    }

    // Test code validation
    if (result.testCode && !await this.validateTestCode(result.testCode)) {
      validation.warnings.push('Unknown test code');
    }

    // Result value validation
    if (result.testCode && result.result) {
      const valueValidation = await validationService.validateResultValue(
        result.testCode,
        result.result,
        result.units
      );
      if (!valueValidation.isValid) {
        validation.errors.push(...valueValidation.errors);
      }
    }

    // Date validation
    if (result.resultDate) {
      const date = new Date(result.resultDate);
      if (isNaN(date.getTime())) {
        validation.errors.push('Invalid result date format');
      } else if (date > new Date()) {
        validation.warnings.push('Result date is in the future');
      }
    }

    validation.isValid = validation.errors.length === 0;
    return validation;
  }

  async checkDuplicates(validResults, context) {
    const uniqueResults = [];
    const duplicateKeys = new Set();

    for (const result of validResults) {
      const duplicateKey = `${result.patientId}-${result.testCode}-${result.resultDate}-${result.result}`;
      
      if (duplicateKeys.has(duplicateKey)) {
        continue; // Skip duplicate
      }

      // Check against database
      const existingResults = await SecureDataAccess.query('lab_results',
        {
          patientId: result.patientId,
          testCode: result.testCode,
          resultDate: result.resultDate,
          result: result.result
        },
        { limit: 1 },
        context
      );

      if (existingResults.length === 0) {
        uniqueResults.push(result);
        duplicateKeys.add(duplicateKey);
      }
    }

    return uniqueResults;
  }

  async interpretResults(deduplicatedResults, context) {
    const interpretationService = new ResultInterpretationService();
    const interpretedResults = [];

    for (const result of deduplicatedResults) {
      try {
        const interpretation = await interpretationService.interpretResult(result, context);
        
        interpretedResults.push({
          ...result,
          interpretation,
          isCritical: interpretation.isCritical,
          criticalLevel: interpretation.criticalLevel,
          abnormalityLevel: interpretation.abnormalityLevel,
          clinicalSignificance: interpretation.clinicalSignificance
        });

      } catch (error) {
        console.error(`Error interpreting result for ${result.testCode}:`, error);
        interpretedResults.push({
          ...result,
          isCritical: false,
          interpretationError: error.message
        });
      }
    }

    return interpretedResults;
  }

  async storeResults(interpretedResults, context) {
    const storedResults = [];

    for (const result of interpretedResults) {
      try {
        const storedResult = await SecureDataAccess.create('lab_results', {
          patientId: result.patientId,
          patientName: result.patientName,
          orderNumber: result.orderNumber,
          testCode: result.testCode,
          testName: result.testName,
          result: result.result,
          units: result.units,
          referenceRange: result.referenceRange,
          abnormalFlag: result.abnormalFlag,
          resultStatus: result.resultStatus,
          resultDate: new Date(result.resultDate),
          performingLab: result.performingLab,
          specimenType: result.specimenType,
          isCritical: result.isCritical || false,
          criticalLevel: result.criticalLevel,
          abnormalityLevel: result.abnormalityLevel,
          clinicalSignificance: result.clinicalSignificance,
          sourceFormat: result.sourceFormat,
          sourceSystem: result.sourceSystem,
          receivedAt: result.receivedAt,
          processingId: result.processingId,
          validation: result.validation
        }, context);

        storedResults.push(storedResult);

        // Create audit log for stored result
        await AuditLog.create({
          action: 'STORE_LAB_RESULT',
          patientId: result.patientId,
          resultId: storedResult._id,
          testCode: result.testCode,
          userId: context.userId,
          practiceId: context.practiceId,
          details: {
            sourceSystem: result.sourceSystem,
            isCritical: result.isCritical
          },
          timestamp: new Date()
        });

      } catch (error) {
        console.error(`Error storing result:`, error);
      }
    }

    return storedResults;
  }

  async notifyProviders(storedResults, context) {
    const notifications = [];
    const criticalResults = storedResults.filter(r => r.isCritical);
    
    // Group results by patient and provider for efficient notification
    const resultsByProvider = {};
    
    for (const result of storedResults) {
      // Get ordering provider from lab order
      const orders = await SecureDataAccess.query('lab_orders',
        { orderNumber: result.orderNumber },
        { include: ['orderingProvider'] },
        context
      );

      if (orders.length > 0) {
        const providerId = orders[0].orderingProviderId;
        if (!resultsByProvider[providerId]) {
          resultsByProvider[providerId] = {
            provider: orders[0].orderingProvider,
            results: [],
            criticalResults: []
          };
        }
        
        resultsByProvider[providerId].results.push(result);
        if (result.isCritical) {
          resultsByProvider[providerId].criticalResults.push(result);
        }
      }
    }

    // Send notifications to each provider
    for (const [providerId, data] of Object.entries(resultsByProvider)) {
      if (data.criticalResults.length > 0) {
        // Immediate notification for critical values
        const criticalNotification = {
          type: 'critical_lab_results',
          priority: 'urgent',
          recipients: [data.provider.email, data.provider.phoneNumber],
          data: {
            providerName: data.provider.name,
            criticalCount: data.criticalResults.length,
            results: data.criticalResults.map(r => ({
              patientName: r.patientName,
              testName: r.testName,
              value: `${r.result} ${r.units}`,
              criticalLevel: r.criticalLevel
            }))
          }
        };

        await NotificationService.send(criticalNotification);
        notifications.push(criticalNotification);
      }

      if (data.results.length > 0) {
        // Regular notification for all results
        const regularNotification = {
          type: 'lab_results_available',
          priority: 'normal',
          recipients: [data.provider.email],
          data: {
            providerName: data.provider.name,
            totalResults: data.results.length,
            criticalResults: data.criticalResults.length,
            resultDate: new Date().toLocaleDateString()
          }
        };

        await NotificationService.send(regularNotification);
        notifications.push(regularNotification);
      }
    }

    return notifications;
  }

  async updateLabOrders(storedResults, context) {
    const orderUpdates = [];
    const orderNumbers = [...new Set(storedResults.map(r => r.orderNumber).filter(Boolean))];

    for (const orderNumber of orderNumbers) {
      try {
        const orderResults = storedResults.filter(r => r.orderNumber === orderNumber);
        const criticalCount = orderResults.filter(r => r.isCritical).length;

        await SecureDataAccess.update('lab_orders',
          { orderNumber },
          {
            $set: {
              status: 'completed',
              completedAt: new Date(),
              resultCount: orderResults.length,
              criticalResults: criticalCount
            }
          },
          context
        );

        orderUpdates.push({ orderNumber, resultCount: orderResults.length, criticalCount });

      } catch (error) {
        console.error(`Error updating order ${orderNumber}:`, error);
      }
    }

    return orderUpdates;
  }

  // Helper methods
  async validatePatientExists(patientId) {
    // Implementation would check if patient exists in system
    return true; // Simplified for demo
  }

  async validateTestCode(testCode) {
    // Implementation would check against test catalog
    return true; // Simplified for demo
  }

  async updateProcessingStep(sessionId, step, data, context) {
    await SecureDataAccess.update('result_processing_sessions',
      { _id: sessionId },
      {
        $set: {
          [`steps.${step}`]: {
            ...data,
            timestamp: new Date()
          }
        }
      },
      context
    );
  }

  async completeProcessingSession(sessionId, summary, context) {
    await SecureDataAccess.update('result_processing_sessions',
      { _id: sessionId },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          summary
        }
      },
      context
    );
  }
}

module.exports = LabResultsReceivingService;
```

### 2. API Endpoints

```javascript
// File: backend/routes/labResultsReceiving.js
const express = require('express');
const router = express.Router();
const LabResultsReceivingService = require('../services/labResultsReceivingService');
const { requireAuth } = require('../middleware/auth');

router.post('/receive', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'lab-results-receiving-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_LAB_RESULTS_RECEIVING_KEY')
    };

    const receivingService = new LabResultsReceivingService();
    const result = await receivingService.receiveResults(req.body, context);

    res.json({
      success: true,
      processing: result,
      message: {
        he: 'קבלת תוצאות מעבדה הושלמה',
        en: 'Lab results received successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בקבלת תוצאות מעבדה',
        en: 'Error receiving lab results'
      },
      details: error.message
    });
  }
});

router.post('/receive/hl7', async (req, res) => {
  try {
    // Special endpoint for HL7 ORU messages (may not require auth for lab systems)
    const context = {
      userId: 'system',
      practiceId: req.headers['practice-id'] || 'default',
      serviceId: 'lab-results-receiving-service',
      apiKey: 'system-key'
    };

    const resultsData = {
      data: req.body,
      format: 'hl7_oru',
      source: req.headers['lab-system'] || 'unknown'
    };

    const receivingService = new LabResultsReceivingService();
    const result = await receivingService.receiveResults(resultsData, context);

    res.status(200).send('ACK'); // HL7 acknowledgment

  } catch (error) {
    console.error('HL7 processing error:', error);
    res.status(500).send('NAK'); // HL7 negative acknowledgment
  }
});

router.get('/sessions/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'lab-results-receiving-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_LAB_RESULTS_RECEIVING_KEY')
    };

    const sessions = await SecureDataAccess.query('result_processing_sessions',
      { _id: sessionId },
      {},
      context
    );

    if (!sessions.length) {
      return res.status(404).json({
        error: {
          he: 'סשן עיבוד לא נמצא',
          en: 'Processing session not found'
        }
      });
    }

    res.json({ session: sessions[0] });
  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בקבלת מידע סשן',
        en: 'Error retrieving session information'
      },
      details: error.message
    });
  }
});
```

### 3. Data Models

```javascript
// File: backend/models/ResultProcessingSession.js
const mongoose = require('mongoose');

const processingStepSchema = new mongoose.Schema({
  timestamp: Date,
  status: String,
  data: mongoose.Schema.Types.Mixed,
  errors: [String],
  warnings: [String]
});

const resultProcessingSessionSchema = new mongoose.Schema({
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedAt: Date,
  dataSource: {
    type: String,
    required: true
  },
  dataFormat: String,
  dataSize: Number,
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  steps: {
    receive: processingStepSchema,
    validate_format: processingStepSchema,
    parse_data: processingStepSchema,
    validate_content: processingStepSchema,
    check_duplicates: processingStepSchema,
    interpret_results: processingStepSchema,
    store_results: processingStepSchema,
    notify_providers: processingStepSchema,
    update_orders: processingStepSchema
  },
  summary: {
    totalReceived: Number,
    validResults: Number,
    invalidResults: Number,
    duplicates: Number,
    criticalValues: Number,
    stored: Number,
    notificationsSent: Number,
    ordersUpdated: Number
  },
  practiceId: {
    type: String,
    required: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  errors: [String]
}, {
  timestamps: true
});

resultProcessingSessionSchema.index({ practiceId: 1, startTime: -1 });
resultProcessingSessionSchema.index({ status: 1, startTime: -1 });

module.exports = mongoose.model('ResultProcessingSession', resultProcessingSessionSchema);
```

### 4. Frontend Component

```jsx
// File: frontend-vite/src/components/lab/ResultsReceiver.jsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Upload, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import secureApi from '../../services/secureApiClient';

const ResultsReceiver = ({ onResultsReceived }) => {
  const [receiving, setReceiving] = useState(false);
  const [processingSession, setProcessingSession] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [dataFormat, setDataFormat] = useState('auto-detect');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileData({
          filename: file.name,
          content: e.target.result,
          size: file.size,
          type: file.type
        });
      };
      reader.readAsText(file);
    }
  };

  const receiveResults = async () => {
    if (!fileData) return;

    setReceiving(true);
    try {
      const resultsData = {
        data: fileData.content,
        format: dataFormat === 'auto-detect' ? undefined : dataFormat,
        source: `file_upload_${fileData.filename}`
      };

      const response = await secureApi.post('/api/lab-results/receive', resultsData);
      setProcessingSession(response.data.processing);
      onResultsReceived?.(response.data.processing);

    } catch (error) {
      console.error('Error receiving results:', error);
    } finally {
      setReceiving(false);
    }
  };

  const getStepStatus = (step, steps) => {
    if (!steps[step]) return 'pending';
    if (steps[step].errors && steps[step].errors.length > 0) return 'error';
    return 'completed';
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStepBadgeColor = (status) => {
    const colors = {
      'completed': 'bg-green-100 text-green-800',
      'error': 'bg-red-100 text-red-800',
      'pending': 'bg-gray-100 text-gray-600'
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  const processingSteps = [
    { key: 'validate_format', label: 'Validate Format' },
    { key: 'parse_data', label: 'Parse Data' },
    { key: 'validate_content', label: 'Validate Content' },
    { key: 'check_duplicates', label: 'Check Duplicates' },
    { key: 'interpret_results', label: 'Interpret Results' },
    { key: 'store_results', label: 'Store Results' },
    { key: 'notify_providers', label: 'Notify Providers' },
    { key: 'update_orders', label: 'Update Orders' }
  ];

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Lab Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* File Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Results File
              </label>
              <input
                type="file"
                accept=".txt,.csv,.xml,.json,.hl7"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Data Format
              </label>
              <select
                value={dataFormat}
                onChange={(e) => setDataFormat(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="auto-detect">Auto-detect</option>
                <option value="hl7_oru">HL7 ORU</option>
                <option value="csv">CSV</option>
                <option value="xml">XML</option>
                <option value="json">JSON</option>
              </select>
            </div>

            {/* File Info */}
            {fileData && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">{fileData.filename}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Size: {(fileData.size / 1024).toFixed(1)} KB
                </div>
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={receiveResults}
              disabled={receiving || !fileData}
              className="w-full"
            >
              {receiving ? 'Processing...' : 'Process Results File'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {processingSession && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary */}
              {processingSession.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {processingSession.summary.totalReceived || 0}
                    </div>
                    <div className="text-xs text-gray-600">Total Received</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {processingSession.summary.processed || 0}
                    </div>
                    <div className="text-xs text-gray-600">Processed</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">
                      {processingSession.summary.criticalValues || 0}
                    </div>
                    <div className="text-xs text-gray-600">Critical Values</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-600">
                      {processingSession.summary.errors || 0}
                    </div>
                    <div className="text-xs text-gray-600">Errors</div>
                  </div>
                </div>
              )}

              {/* Processing Steps */}
              <div className="space-y-3">
                <h4 className="font-medium">Processing Steps:</h4>
                {processingSteps.map((step, index) => {
                  const status = getStepStatus(step.key, processingSession.steps || {});
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full border">
                        {getStepIcon(status)}
                      </div>
                      
                      <div className="flex-1">
                        <span className="text-sm font-medium">{step.label}</span>
                      </div>
                      
                      <Badge className={getStepBadgeColor(status)}>
                        {status}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {/* Processing Time */}
              {processingSession.processingTime && (
                <div className="text-sm text-gray-600">
                  Processing completed in {Math.round(processingSession.processingTime / 1000)}s
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><strong>HL7 ORU:</strong> Standard HL7 lab result messages</div>
            <div><strong>CSV:</strong> Comma-separated values with headers</div>
            <div><strong>XML:</strong> Structured XML format</div>
            <div><strong>JSON:</strong> JavaScript Object Notation</div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-800">
              <strong>Note:</strong> The system will automatically detect critical values 
              and notify providers immediately. All results are validated before storage.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResultsReceiver;
```

## Test Cases

### Unit Tests

```javascript
// File: backend/tests/labResultsReceivingService.test.js
const LabResultsReceivingService = require('../services/labResultsReceivingService');

describe('LabResultsReceivingService', () => {
  let service;
  let mockContext;

  beforeEach(() => {
    service = new LabResultsReceivingService();
    mockContext = {
      userId: 'user123',
      practiceId: 'clinic123'
    };
  });

  test('should detect HL7 format correctly', async () => {
    const hl7Data = 'MSH|^~\\&|LAB|HOSPITAL|LIS|PRACTICE|20241220||ORU^R01|123|P|2.5\nOBR|1|123|456|80053^CMP|||20241220\nOBX|1|NM|GLU^Glucose|1|95|mg/dL|70-100|N|||F';
    
    const format = await service.detectDataFormat(hl7Data);
    expect(format).toBe('hl7_oru');
  });

  test('should validate JSON format correctly', async () => {
    const jsonData = [{ patientId: '123', testCode: 'GLU', result: '95' }];
    const validation = { errors: [], warnings: [] };
    
    const result = await service.validateJSONFormat(jsonData, validation);
    expect(result.errors.length).toBe(0);
  });

  test('should map CSV headers correctly', () => {
    expect(service.mapCSVHeader('patient_id')).toBe('patientId');
    expect(service.mapCSVHeader('test_code')).toBe('testCode');
  });
});
```

## Dependencies
- SecureDataAccess service
- HL7 parser service
- Validation service
- Result interpretation service
- Notification service
- Audit logging system

## Success Criteria
- [ ] Multiple data formats supported and parsed
- [ ] Comprehensive data validation implemented
- [ ] Duplicate detection working correctly
- [ ] Result interpretation and critical value detection
- [ ] Automatic provider notifications functional
- [ ] Laboratory order status updates working
- [ ] Complete audit trail maintained
- [ ] Error handling for invalid data
- [ ] Performance handles large result batches
- [ ] Integration with existing lab workflow