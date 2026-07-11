# Track Lab Results - Implementation Task

## Function Details
- **Function Name**: `trackLabResults`
- **Location**: `backend/services/labResultsTrackingService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Estimated Time**: 3-4 days
- **Complexity**: Medium-High

## Problem Description
Implement comprehensive laboratory results tracking functionality to monitor test status from order placement through result delivery. The system must handle real-time status updates from multiple laboratory systems, manage result notifications, track critical values, and provide automated follow-up for pending results. Integration with HL7 ORU messages and various LIS systems is required.

## Implementation Steps

### 1. Lab Results Tracking Service Implementation

```javascript
// File: backend/services/labResultsTrackingService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const HL7Service = require('./hl7Service');
const NotificationService = require('./notificationService');
const CriticalValueService = require('./criticalValueService');

class LabResultsTrackingService {
  constructor() {
    this.statusMappings = {
      'ordered': 'Order placed, awaiting laboratory processing',
      'received': 'Order received by laboratory',
      'collected': 'Specimen collected',
      'accessioned': 'Specimen accessioned and assigned lab number',
      'in_process': 'Testing in progress',
      'preliminary': 'Preliminary results available',
      'final': 'Final results available',
      'amended': 'Results have been amended',
      'cancelled': 'Order cancelled',
      'rejected': 'Specimen rejected',
      'hold': 'Results on hold pending review'
    };

    this.alertThresholds = {
      'routine': 72, // hours
      'urgent': 24,
      'stat': 4,
      'critical': 2
    };

    this.criticalValueActions = {
      'immediate_notify': 'Immediate phone notification required',
      'urgent_review': 'Urgent physician review required',
      'repeat_test': 'Consider repeat testing',
      'panic_value': 'Panic value - immediate intervention'
    };
  }

  async trackLabResults(trackingRequest, context) {
    try {
      // Validate tracking request
      await this.validateTrackingRequest(trackingRequest, context);

      // Get current tracking status
      const currentStatus = await this.getCurrentTrackingStatus(trackingRequest, context);

      // Query laboratory systems for updates
      const labUpdates = await this.queryLaboratorySystems(trackingRequest, context);

      // Process any new results
      const processedResults = await this.processNewResults(labUpdates, context);

      // Update tracking records
      const trackingUpdate = await this.updateTrackingRecords(
        trackingRequest,
        labUpdates,
        processedResults,
        context
      );

      // Handle critical values
      await this.handleCriticalValues(processedResults, context);

      // Check for overdue results
      await this.checkOverdueResults(trackingRequest, context);

      // Send notifications if needed
      await this.sendTrackingNotifications(trackingUpdate, context);

      return {
        trackingId: trackingUpdate._id,
        ordersTracked: labUpdates.length,
        newResults: processedResults.length,
        criticalValues: processedResults.filter(r => r.isCritical).length,
        overdueAlerts: trackingUpdate.overdueAlerts || 0,
        lastUpdated: new Date()
      };

    } catch (error) {
      await AuditLog.create({
        action: 'TRACK_LAB_RESULTS_ERROR',
        error: error.message,
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async getCurrentTrackingStatus(trackingRequest, context) {
    const query = {};
    
    if (trackingRequest.orderId) {
      query.orderId = trackingRequest.orderId;
    } else if (trackingRequest.patientId) {
      query.patientId = trackingRequest.patientId;
    } else if (trackingRequest.orderNumbers) {
      query.orderNumber = { $in: trackingRequest.orderNumbers };
    }

    if (trackingRequest.startDate) {
      query.orderDate = { $gte: new Date(trackingRequest.startDate) };
    }

    if (trackingRequest.endDate) {
      query.orderDate = query.orderDate ? 
        { ...query.orderDate, $lte: new Date(trackingRequest.endDate) } :
        { $lte: new Date(trackingRequest.endDate) };
    }

    const trackingRecords = await SecureDataAccess.query('lab_tracking',
      query,
      { sort: { lastUpdated: -1 } },
      context
    );

    return trackingRecords;
  }

  async queryLaboratorySystems(trackingRequest, context) {
    const labUpdates = [];

    // Get all laboratory configurations
    const labConfigs = await SecureDataAccess.query('laboratory_configurations',
      { status: 'active' },
      {},
      context
    );

    for (const labConfig of labConfigs) {
      try {
        let updates;
        
        switch (labConfig.integrationMethod) {
          case 'hl7':
            updates = await this.queryViaHL7(labConfig, trackingRequest, context);
            break;
          case 'api':
            updates = await this.queryViaAPI(labConfig, trackingRequest, context);
            break;
          case 'file_polling':
            updates = await this.queryViaFilePolling(labConfig, trackingRequest, context);
            break;
          case 'web_scraping':
            updates = await this.queryViaWebScraping(labConfig, trackingRequest, context);
            break;
          default:
            console.log(`Unsupported tracking method: ${labConfig.integrationMethod}`);
        }

        if (updates && updates.length > 0) {
          labUpdates.push(...updates.map(update => ({
            ...update,
            laboratoryId: labConfig.laboratoryId,
            laboratoryName: labConfig.name,
            integrationMethod: labConfig.integrationMethod
          })));
        }

      } catch (error) {
        console.error(`Failed to query ${labConfig.name}:`, error);
        // Continue with other labs even if one fails
      }
    }

    return labUpdates;
  }

  async queryViaHL7(labConfig, trackingRequest, context) {
    const hl7Service = new HL7Service();
    const updates = [];

    // Create HL7 QRY (Query) message to request order status
    const queryMessage = {
      messageHeader: {
        messageType: 'QRY^Q02',
        messageControlId: this.generateHL7ControlId(),
        timestamp: new Date().toISOString(),
        sendingApplication: 'IntelliCare',
        sendingFacility: context.practice.name,
        receivingApplication: labConfig.hl7Config.receivingApplication,
        receivingFacility: labConfig.name
      },
      queryDefinition: {
        queryTag: 'ORDER_STATUS',
        queryFormatCode: 'R',
        queryPriority: 'I',
        queryId: trackingRequest.orderId || 'ALL_PENDING'
      }
    };

    const response = await hl7Service.sendQuery(queryMessage, labConfig.hl7Config);

    if (response && response.queryResults) {
      for (const result of response.queryResults) {
        updates.push({
          orderNumber: result.orderNumber,
          labOrderId: result.labOrderId,
          status: this.mapHL7Status(result.orderStatus),
          statusTimestamp: result.statusTimestamp,
          expectedCompletion: result.expectedCompletion,
          specimenStatus: result.specimenStatus,
          testResults: result.testResults || []
        });
      }
    }

    return updates;
  }

  async queryViaAPI(labConfig, trackingRequest, context) {
    const lisService = require('./lisIntegrationService');
    const updates = [];

    const queryParams = {
      facilityId: context.practiceId,
      dateRange: {
        start: trackingRequest.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: trackingRequest.endDate || new Date()
      }
    };

    if (trackingRequest.orderId) {
      queryParams.orderId = trackingRequest.orderId;
    }

    if (trackingRequest.orderNumbers) {
      queryParams.orderNumbers = trackingRequest.orderNumbers;
    }

    const apiResponse = await lisService.queryOrderStatus(queryParams, labConfig.apiConfig);

    if (apiResponse && apiResponse.orders) {
      for (const order of apiResponse.orders) {
        updates.push({
          orderNumber: order.orderNumber,
          labOrderId: order.labOrderId,
          status: order.status,
          statusTimestamp: order.lastUpdated,
          expectedCompletion: order.expectedCompletion,
          testResults: order.results || [],
          specimenInfo: order.specimenInfo
        });
      }
    }

    return updates;
  }

  async queryViaFilePolling(labConfig, trackingRequest, context) {
    const filePollingService = require('./filePollingService');
    const updates = [];

    const pollingConfig = {
      directory: labConfig.fileConfig.directory,
      filePattern: labConfig.fileConfig.pattern,
      lastPolled: trackingRequest.lastPolled || new Date(Date.now() - 60 * 60 * 1000)
    };

    const files = await filePollingService.pollForFiles(pollingConfig);

    for (const file of files) {
      try {
        const fileData = await filePollingService.processFile(file, labConfig.fileConfig.format);
        
        if (fileData.type === 'results' || fileData.type === 'status') {
          for (const record of fileData.records) {
            updates.push({
              orderNumber: record.orderNumber,
              labOrderId: record.labOrderId,
              status: record.status,
              statusTimestamp: record.timestamp,
              testResults: record.results || [],
              sourceFile: file.filename
            });
          }
        }

        // Mark file as processed
        await filePollingService.markFileProcessed(file);

      } catch (error) {
        console.error(`Error processing file ${file.filename}:`, error);
      }
    }

    return updates;
  }

  async processNewResults(labUpdates, context) {
    const processedResults = [];

    for (const update of labUpdates) {
      if (update.testResults && update.testResults.length > 0) {
        for (const result of update.testResults) {
          const processedResult = await this.processIndividualResult(
            update,
            result,
            context
          );
          
          if (processedResult) {
            processedResults.push(processedResult);
          }
        }
      }
    }

    return processedResults;
  }

  async processIndividualResult(orderUpdate, testResult, context) {
    try {
      // Validate and standardize result format
      const standardizedResult = await this.standardizeResult(orderUpdate, testResult, context);

      // Check for critical values
      const criticalValueCheck = await this.checkCriticalValue(standardizedResult, context);

      // Store result in database
      const storedResult = await SecureDataAccess.create('lab_results', {
        orderNumber: orderUpdate.orderNumber,
        labOrderId: orderUpdate.labOrderId,
        laboratoryId: orderUpdate.laboratoryId,
        patientId: standardizedResult.patientId,
        testCode: standardizedResult.testCode,
        testName: standardizedResult.testName,
        result: standardizedResult.result,
        units: standardizedResult.units,
        referenceRange: standardizedResult.referenceRange,
        abnormalFlag: standardizedResult.abnormalFlag,
        resultStatus: standardizedResult.status,
        resultDate: standardizedResult.resultDate,
        performingLab: orderUpdate.laboratoryName,
        methodology: standardizedResult.methodology,
        isCritical: criticalValueCheck.isCritical,
        criticalLevel: criticalValueCheck.level,
        rawData: testResult,
        receivedAt: new Date()
      }, context);

      // Create audit log for new result
      await AuditLog.create({
        action: 'RECEIVE_LAB_RESULT',
        patientId: standardizedResult.patientId,
        resultId: storedResult._id,
        testCode: standardizedResult.testCode,
        userId: context.userId,
        practiceId: context.practiceId,
        details: {
          orderNumber: orderUpdate.orderNumber,
          laboratory: orderUpdate.laboratoryName,
          isCritical: criticalValueCheck.isCritical
        },
        timestamp: new Date()
      });

      return {
        ...storedResult,
        criticalValueCheck
      };

    } catch (error) {
      console.error('Error processing individual result:', error);
      return null;
    }
  }

  async standardizeResult(orderUpdate, testResult, context) {
    // Get order information for patient ID
    const orders = await SecureDataAccess.query('lab_orders',
      { orderNumber: orderUpdate.orderNumber },
      {},
      context
    );

    const order = orders.length > 0 ? orders[0] : null;

    return {
      patientId: order?.patientId || testResult.patientId,
      testCode: testResult.testCode || testResult.observationIdentifier,
      testName: testResult.testName || testResult.observationText,
      result: testResult.observationValue || testResult.result,
      units: testResult.units || testResult.observationUnits,
      referenceRange: testResult.referenceRange || testResult.referencesRange,
      abnormalFlag: testResult.abnormalFlag || this.determineAbnormalFlag(testResult),
      status: testResult.resultStatus || 'final',
      resultDate: testResult.observationDateTime || testResult.resultDate || new Date(),
      methodology: testResult.methodology
    };
  }

  async checkCriticalValue(result, context) {
    const criticalValueService = new CriticalValueService();
    
    return await criticalValueService.evaluateResult({
      testCode: result.testCode,
      testName: result.testName,
      value: result.result,
      units: result.units,
      patientId: result.patientId,
      resultDate: result.resultDate
    }, context);
  }

  async updateTrackingRecords(trackingRequest, labUpdates, processedResults, context) {
    const trackingData = {
      lastTrackingRun: new Date(),
      labSystemsQueried: labUpdates.map(u => u.laboratoryName),
      updatesReceived: labUpdates.length,
      newResultsProcessed: processedResults.length,
      criticalValuesFound: processedResults.filter(r => r.isCritical).length
    };

    // Update or create tracking record
    let trackingRecord = await SecureDataAccess.query('lab_tracking_sessions',
      { 
        practiceId: context.practiceId,
        sessionDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      },
      { sort: { createdAt: -1 }, limit: 1 },
      context
    );

    if (trackingRecord.length > 0) {
      await SecureDataAccess.update('lab_tracking_sessions',
        { _id: trackingRecord[0]._id },
        { $set: trackingData },
        context
      );
      trackingRecord = trackingRecord[0];
    } else {
      trackingRecord = await SecureDataAccess.create('lab_tracking_sessions', {
        ...trackingData,
        practiceId: context.practiceId,
        sessionDate: new Date(),
        createdBy: context.userId
      }, context);
    }

    return trackingRecord;
  }

  async handleCriticalValues(processedResults, context) {
    const criticalResults = processedResults.filter(r => r.criticalValueCheck.isCritical);

    for (const criticalResult of criticalResults) {
      try {
        // Create critical value alert
        await this.createCriticalValueAlert(criticalResult, context);

        // Send immediate notifications
        await this.sendCriticalValueNotifications(criticalResult, context);

        // Log critical value handling
        await AuditLog.create({
          action: 'HANDLE_CRITICAL_VALUE',
          patientId: criticalResult.patientId,
          resultId: criticalResult._id,
          userId: context.userId,
          practiceId: context.practiceId,
          details: {
            testCode: criticalResult.testCode,
            criticalLevel: criticalResult.criticalValueCheck.level,
            value: criticalResult.result,
            notificationsSent: true
          },
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error handling critical value:', error);
      }
    }
  }

  async createCriticalValueAlert(criticalResult, context) {
    const alert = {
      type: 'critical_lab_value',
      severity: criticalResult.criticalValueCheck.level,
      patientId: criticalResult.patientId,
      resultId: criticalResult._id,
      testCode: criticalResult.testCode,
      testName: criticalResult.testName,
      value: criticalResult.result,
      units: criticalResult.units,
      criticalRange: criticalResult.criticalValueCheck.criticalRange,
      actionRequired: criticalResult.criticalValueCheck.recommendedActions,
      status: 'active',
      createdBy: 'system',
      alertTimestamp: new Date(),
      acknowledgedBy: null,
      acknowledgedAt: null
    };

    return await SecureDataAccess.create('critical_value_alerts', alert, context);
  }

  async sendCriticalValueNotifications(criticalResult, context) {
    const notifications = [];

    // Get ordering provider and patient information
    const orders = await SecureDataAccess.query('lab_orders',
      { orderNumber: criticalResult.orderNumber },
      { include: ['orderingProvider', 'patient'] },
      context
    );

    if (orders.length === 0) return;

    const order = orders[0];
    const provider = order.orderingProvider;
    const patient = order.patient;

    // Immediate phone notification for panic values
    if (criticalResult.criticalValueCheck.level === 'panic') {
      notifications.push({
        type: 'critical_value_phone',
        priority: 'immediate',
        recipients: [provider.phone, provider.emergencyPhone].filter(Boolean),
        data: {
          patientName: `${patient.firstName} ${patient.lastName}`,
          testName: criticalResult.testName,
          value: `${criticalResult.result} ${criticalResult.units}`,
          criticalRange: criticalResult.criticalValueCheck.criticalRange,
          orderNumber: criticalResult.orderNumber,
          resultDate: criticalResult.resultDate
        }
      });
    }

    // Email notification
    notifications.push({
      type: 'critical_value_email',
      priority: 'urgent',
      recipients: [provider.email],
      data: {
        providerName: `Dr. ${provider.lastName}`,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientMRN: patient.mrn,
        testName: criticalResult.testName,
        value: `${criticalResult.result} ${criticalResult.units}`,
        referenceRange: criticalResult.referenceRange,
        criticalRange: criticalResult.criticalValueCheck.criticalRange,
        recommendedActions: criticalResult.criticalValueCheck.recommendedActions,
        orderNumber: criticalResult.orderNumber,
        resultDate: criticalResult.resultDate,
        laboratory: criticalResult.performingLab
      }
    });

    // SMS notification for urgent critical values
    if (['critical', 'panic'].includes(criticalResult.criticalValueCheck.level)) {
      notifications.push({
        type: 'critical_value_sms',
        priority: 'urgent',
        recipients: [provider.mobilePhone].filter(Boolean),
        data: {
          message: `CRITICAL LAB: ${patient.firstName} ${patient.lastName} - ${criticalResult.testName}: ${criticalResult.result} ${criticalResult.units}. Order: ${criticalResult.orderNumber}`
        }
      });
    }

    // Send all notifications
    for (const notification of notifications) {
      try {
        await NotificationService.send(notification);
      } catch (error) {
        console.error('Critical value notification failed:', error);
      }
    }

    return notifications;
  }

  async checkOverdueResults(trackingRequest, context) {
    const overdueThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const overdueOrders = await SecureDataAccess.query('lab_orders',
      {
        status: { $in: ['submitted', 'accepted', 'in_process'] },
        expectedResultDate: { $lt: overdueThreshold },
        practiceId: context.practiceId
      },
      {},
      context
    );

    for (const order of overdueOrders) {
      const hoursOverdue = Math.floor((new Date() - order.expectedResultDate) / (1000 * 60 * 60));
      const alertThreshold = this.alertThresholds[order.urgency] || 24;

      if (hoursOverdue >= alertThreshold) {
        await this.createOverdueAlert(order, hoursOverdue, context);
      }
    }

    return overdueOrders.length;
  }

  async createOverdueAlert(order, hoursOverdue, context) {
    const alert = {
      type: 'overdue_lab_result',
      severity: hoursOverdue > 72 ? 'high' : 'medium',
      orderId: order._id,
      orderNumber: order.orderNumber,
      patientId: order.patientId,
      hoursOverdue,
      expectedDate: order.expectedResultDate,
      urgency: order.urgency,
      tests: order.tests.map(t => ({ testCode: t.testCode, testName: t.testName })),
      status: 'active',
      createdAt: new Date()
    };

    await SecureDataAccess.create('overdue_alerts', alert, context);

    // Send notification to ordering provider
    const provider = await SecureDataAccess.query('providers',
      { _id: order.orderingProviderId },
      {},
      context
    );

    if (provider.length > 0) {
      await NotificationService.send({
        type: 'overdue_lab_results',
        recipients: [provider[0].email],
        data: {
          orderNumber: order.orderNumber,
          patientName: `Patient ${order.patientId}`, // Would normally resolve patient name
          hoursOverdue,
          tests: order.tests.length
        }
      });
    }
  }

  async sendTrackingNotifications(trackingUpdate, context) {
    // Send summary notification if significant activity
    if (trackingUpdate.newResultsProcessed > 0 || trackingUpdate.criticalValuesFound > 0) {
      const summary = {
        type: 'lab_tracking_summary',
        recipients: [context.user.email], // Lab manager or designated recipient
        data: {
          lastRun: trackingUpdate.lastTrackingRun,
          newResults: trackingUpdate.newResultsProcessed,
          criticalValues: trackingUpdate.criticalValuesFound,
          labSystems: trackingUpdate.labSystemsQueried
        }
      };

      await NotificationService.send(summary);
    }
  }

  // Helper methods
  mapHL7Status(hl7Status) {
    const statusMap = {
      'IP': 'in_process',
      'CM': 'final',
      'PA': 'preliminary',
      'CA': 'cancelled',
      'DC': 'cancelled',
      'ER': 'rejected',
      'HD': 'hold'
    };

    return statusMap[hl7Status] || hl7Status;
  }

  determineAbnormalFlag(result) {
    if (result.abnormalFlag) return result.abnormalFlag;
    
    // Simple logic - would be more sophisticated in practice
    if (result.referenceRange && result.observationValue) {
      // Basic range parsing (simplified)
      const range = result.referenceRange.split('-');
      if (range.length === 2) {
        const low = parseFloat(range[0]);
        const high = parseFloat(range[1]);
        const value = parseFloat(result.observationValue);
        
        if (value < low) return 'L';
        if (value > high) return 'H';
      }
    }
    
    return 'N';
  }

  generateHL7ControlId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
  }

  async validateTrackingRequest(request, context) {
    if (!request.orderId && !request.patientId && !request.orderNumbers) {
      throw new Error('At least one of orderId, patientId, or orderNumbers must be provided');
    }
  }
}

module.exports = LabResultsTrackingService;
```

### 2. API Endpoints

```javascript
// File: backend/routes/labTracking.js
const express = require('express');
const router = express.Router();
const LabResultsTrackingService = require('../services/labResultsTrackingService');
const { requireAuth } = require('../middleware/auth');

router.post('/track', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      user: req.user,
      practice: req.practice,
      serviceId: 'lab-results-tracking-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_LAB_TRACKING_KEY')
    };

    const trackingService = new LabResultsTrackingService();
    const result = await trackingService.trackLabResults(req.body, context);

    res.json({
      success: true,
      tracking: result,
      message: {
        he: 'מעקב תוצאות מעבדה הושלם',
        en: 'Lab results tracking completed'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה במעקב תוצאות מעבדה',
        en: 'Error tracking lab results'
      },
      details: error.message
    });
  }
});

router.get('/status/:orderId', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'lab-results-tracking-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_LAB_TRACKING_KEY')
    };

    const trackingService = new LabResultsTrackingService();
    const status = await trackingService.getCurrentTrackingStatus(
      { orderId },
      context
    );

    res.json({ status });
  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בקבלת סטטוס מעקב',
        en: 'Error retrieving tracking status'
      },
      details: error.message
    });
  }
});

router.get('/critical-values', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'lab-results-tracking-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_LAB_TRACKING_KEY')
    };

    const criticalValues = await SecureDataAccess.query('critical_value_alerts',
      { 
        practiceId: context.practiceId,
        status: 'active'
      },
      { 
        sort: { alertTimestamp: -1 },
        limit: 50
      },
      context
    );

    res.json({ criticalValues });
  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בקבלת ערכים קריטיים',
        en: 'Error retrieving critical values'
      },
      details: error.message
    });
  }
});
```

### 3. Data Models

```javascript
// File: backend/models/LabResult.js
const mongoose = require('mongoose');

const labResultSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true
  },
  labOrderId: String,
  laboratoryId: String,
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Patient'
  },
  testCode: {
    type: String,
    required: true
  },
  testName: {
    type: String,
    required: true
  },
  result: {
    type: String,
    required: true
  },
  units: String,
  referenceRange: String,
  abnormalFlag: {
    type: String,
    enum: ['N', 'L', 'H', 'LL', 'HH', 'A', '<', '>']
  },
  resultStatus: {
    type: String,
    enum: ['preliminary', 'final', 'corrected', 'amended'],
    default: 'final'
  },
  resultDate: {
    type: Date,
    required: true
  },
  performingLab: String,
  methodology: String,
  isCritical: {
    type: Boolean,
    default: false
  },
  criticalLevel: {
    type: String,
    enum: ['normal', 'abnormal', 'critical', 'panic']
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  rawData: mongoose.Schema.Types.Mixed,
  receivedAt: {
    type: Date,
    default: Date.now
  },
  notificationsSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

labResultSchema.index({ patientId: 1, resultDate: -1 });
labResultSchema.index({ orderNumber: 1 });
labResultSchema.index({ testCode: 1, resultDate: -1 });
labResultSchema.index({ isCritical: 1, reviewedAt: 1 });

module.exports = mongoose.model('LabResult', labResultSchema);
```

### 4. Frontend Component

```jsx
// File: frontend-vite/src/components/lab/LabResultsTracker.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { RefreshCw, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import secureApi from '../../services/secureApiClient';

const LabResultsTracker = ({ patientId, orderId }) => {
  const [tracking, setTracking] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [criticalValues, setCriticalValues] = useState([]);
  const [overdueResults, setOverdueResults] = useState([]);

  useEffect(() => {
    if (patientId || orderId) {
      startTracking();
      fetchCriticalValues();
    }
  }, [patientId, orderId]);

  const startTracking = async () => {
    setTracking(true);
    try {
      const trackingRequest = {};
      if (patientId) trackingRequest.patientId = patientId;
      if (orderId) trackingRequest.orderId = orderId;

      const response = await secureApi.post('/api/lab-tracking/track', trackingRequest);
      setTrackingData(response.data.tracking);
    } catch (error) {
      console.error('Error starting tracking:', error);
    } finally {
      setTracking(false);
    }
  };

  const fetchCriticalValues = async () => {
    try {
      const response = await secureApi.get('/api/lab-tracking/critical-values');
      setCriticalValues(response.data.criticalValues || []);
    } catch (error) {
      console.error('Error fetching critical values:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'ordered': 'bg-gray-100 text-gray-800',
      'received': 'bg-blue-100 text-blue-800',
      'collected': 'bg-purple-100 text-purple-800',
      'in_process': 'bg-yellow-100 text-yellow-800',
      'preliminary': 'bg-orange-100 text-orange-800',
      'final': 'bg-green-100 text-green-800',
      'critical': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'panic':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tracking Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lab Results Tracking</span>
            <Button
              onClick={startTracking}
              disabled={tracking}
              variant="outline"
              size="sm"
            >
              {tracking ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {tracking ? 'Tracking...' : 'Refresh Tracking'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trackingData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {trackingData.ordersTracked || 0}
                </div>
                <div className="text-sm text-gray-600">Orders Tracked</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {trackingData.newResults || 0}
                </div>
                <div className="text-sm text-gray-600">New Results</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {trackingData.criticalValues || 0}
                </div>
                <div className="text-sm text-gray-600">Critical Values</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {trackingData.overdueAlerts || 0}
                </div>
                <div className="text-sm text-gray-600">Overdue Alerts</div>
              </div>
            </div>
          )}
          
          {trackingData && (
            <div className="mt-4 text-sm text-gray-600">
              Last updated: {new Date(trackingData.lastUpdated).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Critical Values Alert */}
      {criticalValues.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Critical Values Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criticalValues.slice(0, 5).map((critical, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-white rounded border">
                  {getSeverityIcon(critical.severity)}
                  <div className="flex-1">
                    <div className="font-medium">{critical.testName}</div>
                    <div className="text-sm text-gray-600">
                      Value: {critical.value} {critical.units}
                      {critical.criticalRange && (
                        <span className="ml-2">
                          (Critical: {critical.criticalRange})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(critical.alertTimestamp).toLocaleString()}
                    </div>
                  </div>
                  <Badge className={getStatusColor('critical')}>
                    {critical.severity.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
            
            {criticalValues.length > 5 && (
              <div className="mt-3 text-sm text-gray-600">
                and {criticalValues.length - 5} more critical values...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tracking Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trackingData && trackingData.ordersTracked > 0 ? (
              <div className="text-sm text-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <span>Systems Queried:</span>
                  <span className="font-medium">Multiple labs</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span>Updates Received:</span>
                  <span className="font-medium">{trackingData.ordersTracked}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span>Results Processed:</span>
                  <span className="font-medium">{trackingData.newResults}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Critical Values:</span>
                  <span className="font-medium text-red-600">
                    {trackingData.criticalValues}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tracking activity yet</p>
                <p className="text-sm">Click "Refresh Tracking" to start monitoring</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { status: 'ordered', label: 'Ordered' },
              { status: 'received', label: 'Received' },
              { status: 'collected', label: 'Collected' },
              { status: 'in_process', label: 'In Process' },
              { status: 'preliminary', label: 'Preliminary' },
              { status: 'final', label: 'Final' },
              { status: 'critical', label: 'Critical Value' },
              { status: 'cancelled', label: 'Cancelled' }
            ].map(item => (
              <div key={item.status} className="flex items-center gap-2">
                <Badge className={getStatusColor(item.status)} variant="outline">
                  {item.label}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LabResultsTracker;
```

## Test Cases

### Unit Tests

```javascript
// File: backend/tests/labResultsTrackingService.test.js
const LabResultsTrackingService = require('../services/labResultsTrackingService');

describe('LabResultsTrackingService', () => {
  let service;
  let mockContext;

  beforeEach(() => {
    service = new LabResultsTrackingService();
    mockContext = {
      userId: 'user123',
      practiceId: 'clinic123',
      user: { email: 'test@practice.com' }
    };
  });

  test('should track lab results successfully', async () => {
    const trackingRequest = { patientId: 'patient123' };
    const result = await service.trackLabResults(trackingRequest, mockContext);
    
    expect(result.trackingId).toBeDefined();
    expect(result.lastUpdated).toBeDefined();
  });

  test('should map HL7 status correctly', () => {
    expect(service.mapHL7Status('IP')).toBe('in_process');
    expect(service.mapHL7Status('CM')).toBe('final');
  });

  test('should determine abnormal flag correctly', () => {
    const result = {
      observationValue: '150',
      referenceRange: '70-100'
    };
    
    expect(service.determineAbnormalFlag(result)).toBe('H');
  });
});
```

## Dependencies
- SecureDataAccess service
- HL7 integration service
- LIS integration service
- Critical value service
- Notification service
- File polling service
- Audit logging system

## Success Criteria
- [ ] Real-time tracking from multiple lab systems
- [ ] HL7 ORU message processing functional
- [ ] Critical value detection and alerting working
- [ ] Overdue result monitoring implemented
- [ ] Automated notifications sent correctly
- [ ] Status updates propagated to orders
- [ ] Complete audit trail maintained
- [ ] Multi-laboratory integration working
- [ ] Performance handles high result volume
- [ ] Emergency notification protocols functional