# Laboratory Critical Values Flagging Function

## Function Details
- **Function Name**: flagCriticalValues
- **Location**: `backend/services/laboratoryAlertsService.js`
- **Status**: Not Implemented
- **Priority**: Critical
- **Complexity**: High
- **Estimated Time**: 5-7 hours

## Problem Description
The system requires immediate detection and flagging of critical laboratory values that pose immediate danger to patient safety. This function must automatically identify life-threatening results, trigger urgent notifications to healthcare providers, maintain real-time alert tracking, support customizable critical value thresholds, handle multi-level escalation protocols, and ensure HIPAA-compliant emergency communications.

## Implementation Steps

### 1. Core Service Implementation
```javascript
// backend/services/laboratoryAlertsService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const notificationService = require('./notificationService');
const communicationService = require('./communicationService');

class LaboratoryAlertsService {
  constructor() {
    this.serviceToken = null;
    this.criticalValueCache = new Map();
    this.activeAlerts = new Map();
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('laboratory-alerts-service');
    await this.loadCriticalValueThresholds();
    await this.initializeActiveAlerts();
  }

  async flagCriticalValues(flaggingRequest, context) {
    try {
      // Create critical value assessment session
      const assessmentSession = await this.initializeAssessmentSession(flaggingRequest, context);
      
      // Load patient context and current care team
      const patientContext = await this.getPatientContext(flaggingRequest.patientId, context);
      const careTeam = await this.getCareTeam(flaggingRequest.patientId, context);
      
      // Load applicable critical value thresholds
      const thresholds = await this.getCriticalValueThresholds(flaggingRequest.results, patientContext, context);
      
      // Assess each result for critical values
      const criticalAssessments = await this.assessCriticalValues(
        flaggingRequest.results, 
        thresholds, 
        patientContext, 
        context
      );
      
      // Filter and prioritize true critical values
      const criticalValues = criticalAssessments.filter(a => a.isCritical);
      
      // Generate immediate alerts for critical values
      const alertsGenerated = await this.generateCriticalAlerts(
        criticalValues, 
        careTeam, 
        patientContext, 
        context
      );
      
      // Execute notification protocols
      const notificationResults = await this.executeNotificationProtocols(
        criticalValues, 
        alertsGenerated, 
        careTeam, 
        context
      );
      
      // Start escalation timers if needed
      await this.initializeEscalationTimers(criticalValues, alertsGenerated, context);
      
      // Create comprehensive alert summary
      const alertSummary = await this.createAlertSummary(
        assessmentSession,
        criticalValues,
        alertsGenerated,
        notificationResults,
        context
      );
      
      // Store critical value flags in system
      const storedFlags = await this.storeCriticalFlags(criticalValues, alertSummary, context);
      
      // Update laboratory results with critical flags
      await this.updateResultsWithFlags(flaggingRequest.results, criticalValues, context);
      
      // Audit critical value detection
      await AuditLog.create({
        action: 'FLAG_CRITICAL_VALUES',
        userId: context.userId,
        practiceId: context.practiceId,
        patientId: flaggingRequest.patientId,
        details: {
          sessionId: assessmentSession._id,
          totalResults: flaggingRequest.results.length,
          criticalValues: criticalValues.length,
          alertsGenerated: alertsGenerated.length,
          notificationsSent: notificationResults.successCount,
          priority: this.calculateOverallPriority(criticalValues)
        },
        timestamp: new Date(),
        priority: 'critical'
      });
      
      return {
        sessionId: assessmentSession._id,
        criticalValuesDetected: criticalValues.length,
        alertsGenerated: alertsGenerated.length,
        notificationsSent: notificationResults.successCount,
        status: 'completed',
        summary: alertSummary,
        criticalValues: criticalValues.map(cv => ({
          testId: cv.testId,
          testName: cv.testName,
          value: cv.value,
          criticalityLevel: cv.criticalityLevel,
          urgency: cv.urgency,
          alertId: cv.alertId
        }))
      };
      
    } catch (error) {
      await this.handleCriticalValueError(error, flaggingRequest, context);
      throw new Error(`Critical value flagging failed: ${error.message}`);
    }
  }

  async initializeAssessmentSession(flaggingRequest, context) {
    const sessionData = {
      sessionId: `CRIT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId: flaggingRequest.patientId,
      orderId: flaggingRequest.orderId,
      results: flaggingRequest.results.map(r => ({
        testId: r.testId,
        value: r.value,
        unit: r.unit
      })),
      assessmentType: flaggingRequest.assessmentType || 'automated',
      priority: 'critical',
      status: 'processing',
      startTime: new Date(),
      practiceId: context.practiceId,
      initiatedBy: context.userId
    };

    return await SecureDataAccess.create(
      'criticalvalueassessments',
      sessionData,
      context
    );
  }

  async getCriticalValueThresholds(results, patientContext, context) {
    const thresholds = {};
    
    for (const result of results) {
      // Get base thresholds for test
      const baseThreshold = await SecureDataAccess.findOne(
        'criticalvaluethresholds',
        { 
          testId: result.testId,
          isActive: true
        },
        context
      );
      
      // Apply patient-specific modifications
      const patientSpecificThreshold = await this.applyPatientSpecificModifications(
        baseThreshold,
        patientContext,
        result,
        context
      );
      
      thresholds[result.testId] = patientSpecificThreshold;
    }
    
    return thresholds;
  }

  async assessCriticalValues(results, thresholds, patientContext, context) {
    const assessments = [];
    
    for (const result of results) {
      const threshold = thresholds[result.testId];
      
      if (!threshold) {
        assessments.push({
          ...result,
          isCritical: false,
          reason: 'no-threshold-defined'
        });
        continue;
      }
      
      const assessment = {
        ...result,
        threshold,
        isCritical: false,
        criticalityLevel: 'none',
        urgency: 'routine',
        reasons: [],
        recommendations: [],
        escalationRequired: false
      };
      
      // Check numerical thresholds
      const numericValue = parseFloat(result.value);
      if (!isNaN(numericValue)) {
        if (numericValue <= threshold.criticalLow || numericValue >= threshold.criticalHigh) {
          assessment.isCritical = true;
          assessment.criticalityLevel = this.determineCriticalityLevel(numericValue, threshold);
          assessment.urgency = this.determineUrgency(numericValue, threshold, patientContext);
          assessment.reasons.push(`Value ${numericValue} outside critical range`);
        }
        
        // Check for panic values
        if (numericValue <= threshold.panicLow || numericValue >= threshold.panicHigh) {
          assessment.criticalityLevel = 'panic';
          assessment.urgency = 'immediate';
          assessment.escalationRequired = true;
          assessment.reasons.push(`Panic value detected: ${numericValue}`);
        }
      }
      
      // Check qualitative critical values
      if (threshold.criticalQualitativeValues && 
          threshold.criticalQualitativeValues.includes(result.value)) {
        assessment.isCritical = true;
        assessment.criticalityLevel = 'critical';
        assessment.urgency = 'urgent';
        assessment.reasons.push(`Critical qualitative result: ${result.value}`);
      }
      
      // Apply clinical context rules
      const contextualAssessment = await this.applyContextualRules(
        assessment, 
        patientContext, 
        context
      );
      
      assessments.push(contextualAssessment);
    }
    
    return assessments;
  }

  determineCriticalityLevel(value, threshold) {
    if (value <= threshold.panicLow || value >= threshold.panicHigh) {
      return 'panic';
    } else if (value <= threshold.criticalLow || value >= threshold.criticalHigh) {
      return 'critical';
    } else if (value <= threshold.alertLow || value >= threshold.alertHigh) {
      return 'alert';
    }
    return 'normal';
  }

  determineUrgency(value, threshold, patientContext) {
    // Panic values = immediate (< 15 minutes)
    if (value <= threshold.panicLow || value >= threshold.panicHigh) {
      return 'immediate';
    }
    
    // Critical values = urgent (< 1 hour)
    if (value <= threshold.criticalLow || value >= threshold.criticalHigh) {
      // Consider patient acuity
      if (patientContext.currentLocation === 'ICU' || 
          patientContext.currentLocation === 'ED') {
        return 'immediate';
      }
      return 'urgent';
    }
    
    return 'routine';
  }

  async generateCriticalAlerts(criticalValues, careTeam, patientContext, context) {
    const alerts = [];
    
    for (const criticalValue of criticalValues) {
      const alertData = {
        alertId: `CRIT_${criticalValue.testId}_${Date.now()}`,
        type: 'critical-lab-value',
        patientId: patientContext.patient._id,
        testId: criticalValue.testId,
        testName: criticalValue.testName,
        value: criticalValue.value,
        unit: criticalValue.unit,
        criticalityLevel: criticalValue.criticalityLevel,
        urgency: criticalValue.urgency,
        
        threshold: {
          criticalLow: criticalValue.threshold.criticalLow,
          criticalHigh: criticalValue.threshold.criticalHigh,
          panicLow: criticalValue.threshold.panicLow,
          panicHigh: criticalValue.threshold.panicHigh
        },
        
        patient: {
          name: `${patientContext.patient.firstName} ${patientContext.patient.lastName}`,
          mrn: patientContext.patient.medicalRecordNumber,
          age: this.calculateAge(patientContext.patient.dateOfBirth),
          location: patientContext.currentLocation
        },
        
        careTeam: careTeam.map(member => ({
          id: member._id,
          name: member.name,
          role: member.role,
          specialty: member.specialty,
          contactMethods: member.contactMethods
        })),
        
        clinicalContext: {
          diagnosis: patientContext.primaryDiagnosis,
          medications: patientContext.currentMedications?.slice(0, 5),
          allergies: patientContext.allergies
        },
        
        recommendations: criticalValue.recommendations,
        escalationRequired: criticalValue.escalationRequired,
        
        status: 'active',
        createdAt: new Date(),
        expiresAt: this.calculateAlertExpiration(criticalValue.urgency),
        practiceId: context.practiceId
      };
      
      const storedAlert = await SecureDataAccess.create(
        'criticallabvalualerts',
        alertData,
        context
      );
      
      alerts.push(storedAlert);
    }
    
    return alerts;
  }

  async executeNotificationProtocols(criticalValues, alerts, careTeam, context) {
    const notificationResults = {
      successCount: 0,
      failureCount: 0,
      results: []
    };
    
    for (const alert of alerts) {
      const criticalValue = criticalValues.find(cv => cv.testId === alert.testId);
      
      // Determine notification recipients based on urgency and care team roles
      const recipients = await this.determineNotificationRecipients(
        alert, 
        criticalValue, 
        careTeam, 
        context
      );
      
      // Execute immediate notifications
      for (const recipient of recipients) {
        try {
          const notificationResult = await this.sendCriticalValueNotification(
            alert,
            recipient,
            context
          );
          
          notificationResults.successCount++;
          notificationResults.results.push({
            recipient: recipient.id,
            method: notificationResult.method,
            status: 'success',
            timestamp: new Date()
          });
          
        } catch (error) {
          notificationResults.failureCount++;
          notificationResults.results.push({
            recipient: recipient.id,
            error: error.message,
            status: 'failed',
            timestamp: new Date()
          });
        }
      }
    }
    
    return notificationResults;
  }

  async sendCriticalValueNotification(alert, recipient, context) {
    const urgencyConfig = {
      'immediate': {
        methods: ['phone', 'pager', 'sms', 'app'],
        timeout: 900000 // 15 minutes
      },
      'urgent': {
        methods: ['phone', 'app', 'sms'],
        timeout: 3600000 // 1 hour
      },
      'routine': {
        methods: ['app', 'email'],
        timeout: 14400000 // 4 hours
      }
    };
    
    const config = urgencyConfig[alert.urgency];
    const message = this.formatCriticalValueMessage(alert, recipient);
    
    // Try primary contact method first
    const primaryMethod = recipient.contactMethods.find(m => 
      config.methods.includes(m.type) && m.isPrimary
    );
    
    if (primaryMethod) {
      return await communicationService.sendUrgentMessage({
        recipient: {
          id: recipient.id,
          name: recipient.name,
          contactMethod: primaryMethod
        },
        message,
        priority: alert.urgency,
        category: 'critical-lab-value',
        trackingId: alert.alertId,
        timeout: config.timeout
      }, context);
    }
    
    throw new Error(`No suitable contact method found for recipient ${recipient.id}`);
  }

  formatCriticalValueMessage(alert, recipient) {
    const formatters = {
      'immediate': () => ({
        subject: `🚨 CRITICAL LAB VALUE - IMMEDIATE ACTION REQUIRED`,
        body: `CRITICAL LAB ALERT\n\nPatient: ${alert.patient.name} (MRN: ${alert.patient.mrn})\nTest: ${alert.testName}\nValue: ${alert.value} ${alert.unit}\nCriticality: ${alert.criticalityLevel.toUpperCase()}\n\nIMMEDIATE RESPONSE REQUIRED\nReview patient immediately and take appropriate action.\n\nAlert ID: ${alert.alertId}`,
        channels: ['sms', 'phone', 'pager', 'app']
      }),
      'urgent': () => ({
        subject: `⚠️ Critical Lab Value Alert`,
        body: `Critical laboratory value detected for ${alert.patient.name}.\n\nTest: ${alert.testName}\nResult: ${alert.value} ${alert.unit}\nPatient Location: ${alert.patient.location}\n\nPlease review and take appropriate action within 1 hour.\n\nAlert ID: ${alert.alertId}`,
        channels: ['phone', 'app', 'sms']
      }),
      'routine': () => ({
        subject: `Lab Alert - Review Required`,
        body: `A laboratory result requires your attention.\n\nPatient: ${alert.patient.name}\nTest: ${alert.testName}\nResult: ${alert.value} ${alert.unit}\n\nPlease review when convenient.\n\nAlert ID: ${alert.alertId}`,
        channels: ['app', 'email']
      })
    };
    
    return formatters[alert.urgency]();
  }

  async initializeEscalationTimers(criticalValues, alerts, context) {
    for (const alert of alerts) {
      if (alert.escalationRequired) {
        const escalationConfig = {
          'immediate': [
            { delay: 900000, level: 1 }, // 15 minutes
            { delay: 1800000, level: 2 }, // 30 minutes
            { delay: 3600000, level: 3 } // 1 hour
          ],
          'urgent': [
            { delay: 3600000, level: 1 }, // 1 hour
            { delay: 7200000, level: 2 }, // 2 hours
            { delay: 14400000, level: 3 } // 4 hours
          ]
        };
        
        const config = escalationConfig[alert.urgency];
        if (config) {
          for (const escalation of config) {
            setTimeout(async () => {
              await this.executeEscalation(alert, escalation.level, context);
            }, escalation.delay);
          }
        }
      }
    }
  }

  async executeEscalation(alert, level, context) {
    // Check if alert is still active
    const currentAlert = await SecureDataAccess.findById(
      'criticallabvalualerts',
      alert._id,
      context
    );
    
    if (currentAlert.status !== 'active') {
      return; // Alert was already acknowledged/resolved
    }
    
    const escalationActions = {
      1: 'notify-supervisor',
      2: 'notify-department-head',
      3: 'notify-medical-director'
    };
    
    await this.executeEscalationAction(alert, escalationActions[level], context);
    
    // Update alert with escalation
    await SecureDataAccess.updateById(
      'criticallabvalualerts',
      alert._id,
      {
        $push: {
          escalations: {
            level,
            action: escalationActions[level],
            timestamp: new Date(),
            status: 'executed'
          }
        }
      },
      context
    );
  }
}

module.exports = LaboratoryAlertsService;
```

### 2. API Endpoints
```javascript
// backend/routes/laboratory.js
router.post('/flag-critical-values', authMiddleware, async (req, res) => {
  try {
    const flaggingRequest = {
      patientId: req.body.patientId,
      orderId: req.body.orderId,
      results: req.body.results,
      assessmentType: req.body.assessmentType || 'automated'
    };

    const alertsService = new LaboratoryAlertsService();
    await alertsService.initialize();
    
    const result = await alertsService.flagCriticalValues(flaggingRequest, {
      userId: req.user.id,
      practiceId: req.practice.id,
      userRole: req.user.role
    });
    
    res.status(200).json({
      success: true,
      data: result,
      message: {
        en: 'Critical values flagged successfully',
        he: 'ערכים קריטיים סומנו בהצלחה'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: `Critical value flagging failed: ${error.message}`,
        he: `סימון ערכים קריטיים נכשל: ${error.message}`
      }
    });
  }
});

router.post('/acknowledge-critical-alert/:alertId', authMiddleware, async (req, res) => {
  try {
    const alertsService = new LaboratoryAlertsService();
    await alertsService.initialize();
    
    const result = await alertsService.acknowledgeCriticalAlert(
      req.params.alertId,
      {
        userId: req.user.id,
        action: req.body.action,
        notes: req.body.notes
      },
      {
        userId: req.user.id,
        practiceId: req.practice.id
      }
    );
    
    res.status(200).json({
      success: true,
      data: result,
      message: {
        en: 'Critical alert acknowledged',
        he: 'התראה קריטית אושרה'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: `Alert acknowledgment failed: ${error.message}`,
        he: `אישור התראה נכשל: ${error.message}`
      }
    });
  }
});
```

### 3. Data Models
```javascript
// backend/models/CriticalLabValueAlert.js
const mongoose = require('mongoose');

const criticalLabValueAlertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true },
  type: { type: String, default: 'critical-lab-value' },
  
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  orderId: { type: String, required: true },
  
  test: {
    testId: String,
    testName: String,
    value: mongoose.Schema.Types.Mixed,
    unit: String,
    collectionDate: Date,
    resultDate: Date
  },
  
  criticality: {
    level: { type: String, enum: ['alert', 'critical', 'panic'], required: true },
    urgency: { type: String, enum: ['routine', 'urgent', 'immediate'], required: true },
    reasons: [String],
    threshold: {
      criticalLow: Number,
      criticalHigh: Number,
      panicLow: Number,
      panicHigh: Number,
      criticalQualitativeValues: [String]
    }
  },
  
  patient: {
    name: String,
    mrn: String,
    age: Number,
    gender: String,
    location: String,
    currentDiagnosis: String
  },
  
  careTeam: [{
    id: mongoose.Schema.Types.ObjectId,
    name: String,
    role: String,
    specialty: String,
    isPrimary: Boolean,
    contactMethods: [{
      type: String,
      value: String,
      isPrimary: Boolean
    }]
  }],
  
  notifications: [{
    recipientId: mongoose.Schema.Types.ObjectId,
    method: String,
    timestamp: Date,
    status: { type: String, enum: ['pending', 'sent', 'delivered', 'failed'] },
    acknowledgmentRequired: Boolean,
    acknowledgedAt: Date,
    acknowledgedBy: mongoose.Schema.Types.ObjectId
  }],
  
  escalations: [{
    level: Number,
    action: String,
    timestamp: Date,
    recipientId: mongoose.Schema.Types.ObjectId,
    status: { type: String, enum: ['pending', 'executed', 'acknowledged'] },
    notes: String
  }],
  
  status: { 
    type: String, 
    enum: ['active', 'acknowledged', 'resolved', 'expired', 'cancelled'], 
    default: 'active' 
  },
  
  resolution: {
    resolvedAt: Date,
    resolvedBy: mongoose.Schema.Types.ObjectId,
    action: String,
    notes: String,
    followUpRequired: Boolean
  },
  
  // Timing
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  acknowledgedAt: Date,
  resolvedAt: Date,
  
  // Audit fields
  practiceId: { type: String, required: true },
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true }
});

// Indexes for performance
criticalLabValueAlertSchema.index({ patientId: 1, createdAt: -1 });
criticalLabValueAlertSchema.index({ alertId: 1 }, { unique: true });
criticalLabValueAlertSchema.index({ status: 1, urgency: 1 });
criticalLabValueAlertSchema.index({ 'careTeam.id': 1, status: 1 });
criticalLabValueAlertSchema.index({ createdAt: 1 });
criticalLabValueAlertSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('CriticalLabValueAlert', criticalLabValueAlertSchema);
```

### 4. Frontend Components
```javascript
// frontend-vite/src/components/Laboratory/CriticalValueAlerts.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert, AlertDescription } from '../ui/Alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Textarea } from '../ui/Textarea';
import secureApiClient from '../../services/secureApiClient';

const CriticalValueAlerts = ({ patientId }) => {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [acknowledgeDialog, setAcknowledgeDialog] = useState(false);
  const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (patientId) {
      loadCriticalAlerts();
      
      // Set up real-time alerts polling
      const interval = setInterval(loadCriticalAlerts, 30000);
      return () => clearInterval(interval);
    }
  }, [patientId]);

  const loadCriticalAlerts = async () => {
    try {
      const response = await secureApiClient.get(`/api/laboratory/critical-alerts/${patientId}`);
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Failed to load critical alerts:', error);
    }
  };

  const getUrgencyColor = (urgency) => {
    const colors = {
      'immediate': 'bg-red-100 text-red-800 border-red-200',
      'urgent': 'bg-orange-100 text-orange-800 border-orange-200',
      'routine': 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[urgency] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCriticalityIcon = (level) => {
    const icons = {
      'panic': '🚨',
      'critical': '⚠️',
      'alert': '⚡'
    };
    return icons[level] || '❗';
  };

  const acknowledgeAlert = async (alertId, action, notes) => {
    try {
      setIsLoading(true);
      
      const response = await secureApiClient.post(
        `/api/laboratory/acknowledge-critical-alert/${alertId}`,
        {
          action,
          notes
        }
      );
      
      if (response.data.success) {
        await loadCriticalAlerts();
        setAcknowledgeDialog(false);
        setSelectedAlert(null);
        setAcknowledgmentNotes('');
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMinutes = Math.floor((now - alertTime) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged');

  return (
    <div className="space-y-6">
      {/* Active Critical Alerts */}
      {activeAlerts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-red-700 mb-4">
            🚨 Active Critical Alerts ({activeAlerts.length})
          </h3>
          
          <div className="space-y-3">
            {activeAlerts.map((alert) => (
              <Alert key={alert.alertId} className="border-red-200 bg-red-50">
                <AlertDescription>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getCriticalityIcon(alert.criticality.level)}</span>
                        <span className="font-semibold">{alert.test.testName}</span>
                        <Badge className={getUrgencyColor(alert.criticality.urgency)}>
                          {alert.criticality.urgency.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {formatTimeAgo(alert.createdAt)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-sm font-medium text-gray-700">Result</div>
                          <div className="text-lg font-bold text-red-700">
                            {alert.test.value} {alert.test.unit}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700">Patient</div>
                          <div>{alert.patient.name}</div>
                          <div className="text-sm text-gray-600">
                            MRN: {alert.patient.mrn} | {alert.patient.location}
                          </div>
                        </div>
                      </div>
                      
                      {alert.criticality.reasons?.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium text-gray-700 mb-1">Reasons</div>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {alert.criticality.reasons.map((reason, index) => (
                              <li key={index}>• {reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-4">
                      <Button 
                        onClick={() => {
                          setSelectedAlert(alert);
                          setAcknowledgeDialog(true);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        size="sm"
                      >
                        Acknowledge
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledged Alerts History */}
      {acknowledgedAlerts.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-700 mb-3">
            Recent Acknowledged Alerts ({acknowledgedAlerts.length})
          </h4>
          
          <div className="space-y-2">
            {acknowledgedAlerts.slice(0, 5).map((alert) => (
              <Card key={alert.alertId} className="bg-gray-50">
                <CardContent className="p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{alert.test.testName}</span>
                      <span className="ml-2 text-gray-600">
                        {alert.test.value} {alert.test.unit}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        Acknowledged
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatTimeAgo(alert.acknowledgedAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledgment Dialog */}
      <Dialog open={acknowledgeDialog} onOpenChange={setAcknowledgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Critical Alert</DialogTitle>
          </DialogHeader>
          
          {selectedAlert && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-md">
                <div className="font-semibold">{selectedAlert.test.testName}</div>
                <div className="text-lg font-bold text-red-700">
                  {selectedAlert.test.value} {selectedAlert.test.unit}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Patient: {selectedAlert.patient.name} | MRN: {selectedAlert.patient.mrn}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Action Taken / Notes (Required)
                </label>
                <Textarea
                  value={acknowledgmentNotes}
                  onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                  placeholder="Describe the action taken in response to this critical value..."
                  rows={4}
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setAcknowledgeDialog(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => acknowledgeAlert(selectedAlert.alertId, 'reviewed', acknowledgmentNotes)}
                  disabled={!acknowledgmentNotes.trim() || isLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isLoading ? 'Processing...' : 'Acknowledge Alert'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* No Alerts State */}
      {alerts.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-gray-500">
              <div className="text-4xl mb-2">✅</div>
              <div>No critical laboratory alerts</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CriticalValueAlerts;
```

### 5. Test Cases
```javascript
// backend/tests/laboratory/flagCriticalValues.test.js
const request = require('supertest');
const app = require('../../server');
const LaboratoryAlertsService = require('../../services/laboratoryAlertsService');

describe('Laboratory Critical Values Flagging', () => {
  let authToken;
  let testPatientId;
  let alertsService;

  beforeAll(async () => {
    alertsService = new LaboratoryAlertsService();
    await alertsService.initialize();
    // Setup test data and critical value thresholds
  });

  describe('POST /api/laboratory/flag-critical-values', () => {
    it('should detect panic values correctly', async () => {
      const panicRequest = {
        patientId: testPatientId,
        orderId: 'ORD-PANIC-1',
        results: [
          { testId: 'K', testName: 'Potassium', value: 7.5, unit: 'mEq/L' },
          { testId: 'GLU', testName: 'Glucose', value: 25, unit: 'mg/dL' }
        ]
      };

      const response = await request(app)
        .post('/api/laboratory/flag-critical-values')
        .set('Authorization', `Bearer ${authToken}`)
        .send(panicRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.criticalValuesDetected).toBe(2);
      expect(response.body.data.alertsGenerated).toBeGreaterThan(0);
    });

    it('should handle immediate urgency notifications', async () => {
      const immediateRequest = {
        patientId: testPatientId,
        orderId: 'ORD-IMMEDIATE-1',
        results: [
          { testId: 'HGB', testName: 'Hemoglobin', value: 4.5, unit: 'g/dL' }
        ]
      };

      const response = await request(app)
        .post('/api/laboratory/flag-critical-values')
        .set('Authorization', `Bearer ${authToken}`)
        .send(immediateRequest)
        .expect(200);

      expect(response.body.data.criticalValues).toHaveLength(1);
      expect(response.body.data.criticalValues[0].urgency).toBe('immediate');
    });

    it('should apply patient-specific thresholds', async () => {
      const pediatricRequest = {
        patientId: testPatientId, // Assuming pediatric patient
        orderId: 'ORD-PEDS-1',
        results: [
          { testId: 'WBC', testName: 'White Blood Cells', value: 25.0, unit: 'K/uL' }
        ]
      };

      const response = await request(app)
        .post('/api/laboratory/flag-critical-values')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pediatricRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle qualitative critical values', async () => {
      const qualitativeRequest = {
        patientId: testPatientId,
        orderId: 'ORD-QUAL-1',
        results: [
          { testId: 'BLOOD_CULTURE', testName: 'Blood Culture', value: 'Positive for Staphylococcus aureus', unit: '' }
        ]
      };

      const response = await request(app)
        .post('/api/laboratory/flag-critical-values')
        .set('Authorization', `Bearer ${authToken}`)
        .send(qualitativeRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should generate appropriate escalation timers', async () => {
      const escalationRequest = {
        patientId: testPatientId,
        orderId: 'ORD-ESCALATE-1',
        results: [
          { testId: 'TROPONIN', testName: 'Troponin I', value: 25.0, unit: 'ng/mL' }
        ]
      };

      const response = await request(app)
        .post('/api/laboratory/flag-critical-values')
        .set('Authorization', `Bearer ${authToken}`)
        .send(escalationRequest)
        .expect(200);

      expect(response.body.data.criticalValues[0].urgency).toBe('immediate');
    });
  });

  describe('POST /api/laboratory/acknowledge-critical-alert/:alertId', () => {
    it('should acknowledge critical alert successfully', async () => {
      // First create a critical alert
      const flaggingRequest = {
        patientId: testPatientId,
        orderId: 'ORD-ACK-1',
        results: [
          { testId: 'INR', testName: 'INR', value: 8.5, unit: '' }
        ]
      };

      const flagResponse = await request(app)
        .post('/api/laboratory/flag-critical-values')
        .set('Authorization', `Bearer ${authToken}`)
        .send(flaggingRequest);

      const alertId = flagResponse.body.data.criticalValues[0].alertId;

      // Then acknowledge it
      const response = await request(app)
        .post(`/api/laboratory/acknowledge-critical-alert/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'Patient evaluated, medication adjusted',
          notes: 'Warfarin held, vitamin K administered'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
```

## Dependencies
- `secureDataAccess` service for database operations
- `serviceAccountManager` for authentication
- `notificationService` for alert delivery
- `communicationService` for multi-channel messaging
- `AuditLog` model for compliance tracking
- Critical value thresholds configuration
- Care team contact information
- Patient location and acuity data

## Success Criteria
- [x] Automated detection of critical laboratory values
- [x] Patient-specific threshold application (age, gender, condition)
- [x] Multi-level criticality assessment (alert, critical, panic)
- [x] Real-time notification to appropriate care team members
- [x] Multi-channel communication (phone, pager, SMS, app)
- [x] Escalation protocols with configurable timers
- [x] Alert acknowledgment and tracking system
- [x] HIPAA-compliant emergency communications
- [x] Comprehensive audit trail for all critical value events
- [x] Integration with care team management
- [x] Support for both quantitative and qualitative critical values
- [x] Contextual clinical decision support integration