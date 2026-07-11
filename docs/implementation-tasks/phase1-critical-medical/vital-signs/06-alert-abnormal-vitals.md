# Alert Abnormal Vitals

## Function Details
- **Name**: alertAbnormalVitals
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 4 hours

## Problem Description
The system must automatically detect abnormal vital signs and trigger appropriate alerts to healthcare providers. This includes immediate critical alerts, trend-based warnings, and protocol-driven escalations. The alert system must be intelligent, avoiding alert fatigue while ensuring critical situations are never missed.

## Implementation Steps

### 1. Create Alert Management Service
```javascript
// backend/services/vitalAlertsService.js

const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const notificationService = require('./notificationService');

class VitalAlertsService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('vital-alerts-service');
    this.alertThresholds = await this.loadAlertThresholds();
    this.activeAlerts = new Map(); // Track active alerts to prevent duplicates
  }

  async checkAndAlertVitals(vitalSignsData, context) {
    const alerts = [];
    const patientInfo = await this.getPatientInfo(vitalSignsData.patientId, context);
    
    // Get patient-specific thresholds
    const thresholds = await this.getPatientThresholds(patientInfo, context);
    
    // Check each vital parameter
    const vitalChecks = [
      this.checkBloodPressure(vitalSignsData.vitals.bloodPressure, thresholds),
      this.checkHeartRate(vitalSignsData.vitals.heartRate, thresholds),
      this.checkRespiratoryRate(vitalSignsData.vitals.respiratoryRate, thresholds),
      this.checkTemperature(vitalSignsData.vitals.temperature, thresholds),
      this.checkOxygenSaturation(vitalSignsData.vitals.oxygenSaturation, thresholds),
      this.checkBloodGlucose(vitalSignsData.vitals.bloodGlucose, thresholds, patientInfo)
    ];

    // Collect all alerts
    vitalChecks.forEach(check => {
      if (check && check.alert) {
        alerts.push(check);
      }
    });

    // Check for compound alerts (multiple abnormal values)
    const compoundAlerts = this.checkCompoundAlerts(alerts, vitalSignsData);
    alerts.push(...compoundAlerts);

    // Process and send alerts
    if (alerts.length > 0) {
      await this.processAlerts(alerts, vitalSignsData, patientInfo, context);
    }

    return {
      alerts,
      processed: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length
    };
  }

  async getPatientThresholds(patientInfo, context) {
    // Get customized thresholds based on patient conditions
    const conditions = patientInfo.medicalHistory?.conditions || [];
    const medications = patientInfo.medications || [];
    const age = this.calculateAge(patientInfo.dateOfBirth);
    
    let thresholds = { ...this.alertThresholds.default };
    
    // Adjust for age
    if (age < 1) {
      thresholds = { ...this.alertThresholds.infant };
    } else if (age < 12) {
      thresholds = { ...this.alertThresholds.pediatric };
    } else if (age > 65) {
      thresholds = { ...this.alertThresholds.geriatric };
    }
    
    // Adjust for medical conditions
    if (conditions.includes('hypertension')) {
      thresholds.bloodPressure.critical.high.systolic = 180;
      thresholds.bloodPressure.critical.high.diastolic = 110;
    }
    
    if (conditions.includes('diabetes')) {
      thresholds.bloodGlucose = {
        critical: { low: 54, high: 400 },
        warning: { low: 70, high: 250 },
        target: { min: 80, max: 180 }
      };
    }
    
    if (conditions.includes('copd')) {
      thresholds.oxygenSaturation.warning.low = 88;
      thresholds.oxygenSaturation.critical.low = 85;
    }
    
    // Adjust for medications
    if (medications.some(m => m.category === 'beta-blocker')) {
      thresholds.heartRate.warning.low = 50;
      thresholds.heartRate.critical.low = 45;
    }
    
    // Check for custom patient thresholds
    const customThresholds = await SecureDataAccess.findOne('patientthresholds', {
      patientId: patientInfo._id,
      practiceId: context.practiceId
    }, context);
    
    if (customThresholds) {
      thresholds = { ...thresholds, ...customThresholds.thresholds };
    }
    
    return thresholds;
  }

  checkBloodPressure(bp, thresholds) {
    if (!bp) return null;
    
    const alerts = [];
    
    // Hypertensive crisis
    if (bp.systolic >= 180 || bp.diastolic >= 120) {
      return {
        alert: true,
        severity: 'critical',
        type: 'hypertensive-crisis',
        message: `Hypertensive crisis: ${bp.systolic}/${bp.diastolic} mmHg`,
        values: { systolic: bp.systolic, diastolic: bp.diastolic },
        action: 'Immediate medical intervention required',
        protocol: 'HTN-CRISIS-001'
      };
    }
    
    // Stage 2 Hypertension
    if (bp.systolic >= 140 || bp.diastolic >= 90) {
      return {
        alert: true,
        severity: 'warning',
        type: 'hypertension-stage2',
        message: `Stage 2 Hypertension: ${bp.systolic}/${bp.diastolic} mmHg`,
        values: { systolic: bp.systolic, diastolic: bp.diastolic },
        action: 'Medication review recommended',
        protocol: 'HTN-STAGE2-001'
      };
    }
    
    // Hypotension
    if (bp.systolic < 90 || bp.diastolic < 60) {
      const severity = bp.systolic < 80 ? 'critical' : 'warning';
      return {
        alert: true,
        severity,
        type: 'hypotension',
        message: `Hypotension: ${bp.systolic}/${bp.diastolic} mmHg`,
        values: { systolic: bp.systolic, diastolic: bp.diastolic },
        action: severity === 'critical' ? 'Assess for shock' : 'Monitor closely',
        protocol: 'HYPOTENSION-001'
      };
    }
    
    return null;
  }

  checkHeartRate(hr, thresholds) {
    if (!hr) return null;
    
    // Severe tachycardia
    if (hr.value > 150) {
      return {
        alert: true,
        severity: 'critical',
        type: 'severe-tachycardia',
        message: `Severe tachycardia: ${hr.value} bpm`,
        values: { heartRate: hr.value, rhythm: hr.rhythm },
        action: 'ECG recommended, assess for arrhythmia',
        protocol: 'TACHYCARDIA-001'
      };
    }
    
    // Tachycardia
    if (hr.value > 100) {
      return {
        alert: true,
        severity: 'warning',
        type: 'tachycardia',
        message: `Tachycardia: ${hr.value} bpm`,
        values: { heartRate: hr.value },
        action: 'Assess for underlying cause',
        protocol: 'TACHYCARDIA-002'
      };
    }
    
    // Severe bradycardia
    if (hr.value < 40) {
      return {
        alert: true,
        severity: 'critical',
        type: 'severe-bradycardia',
        message: `Severe bradycardia: ${hr.value} bpm`,
        values: { heartRate: hr.value },
        action: 'Assess for heart block, consider atropine',
        protocol: 'BRADYCARDIA-001'
      };
    }
    
    // Bradycardia
    if (hr.value < 60) {
      return {
        alert: true,
        severity: 'info',
        type: 'bradycardia',
        message: `Bradycardia: ${hr.value} bpm`,
        values: { heartRate: hr.value },
        action: 'Monitor if symptomatic',
        protocol: 'BRADYCARDIA-002'
      };
    }
    
    // Irregular rhythm
    if (hr.rhythm === 'irregular') {
      return {
        alert: true,
        severity: 'warning',
        type: 'irregular-rhythm',
        message: 'Irregular heart rhythm detected',
        values: { heartRate: hr.value, rhythm: hr.rhythm },
        action: 'ECG recommended to assess rhythm',
        protocol: 'ARRHYTHMIA-001'
      };
    }
    
    return null;
  }

  checkOxygenSaturation(o2, thresholds) {
    if (!o2) return null;
    
    // Severe hypoxemia
    if (o2.value < 85) {
      return {
        alert: true,
        severity: 'critical',
        type: 'severe-hypoxemia',
        message: `Severe hypoxemia: ${o2.value}%`,
        values: { saturation: o2.value, onOxygen: o2.onOxygen },
        action: 'Immediate oxygen therapy required',
        protocol: 'HYPOXEMIA-001'
      };
    }
    
    // Hypoxemia
    if (o2.value < 92) {
      return {
        alert: true,
        severity: 'warning',
        type: 'hypoxemia',
        message: `Hypoxemia: ${o2.value}%`,
        values: { saturation: o2.value },
        action: 'Assess respiratory status, consider oxygen',
        protocol: 'HYPOXEMIA-002'
      };
    }
    
    // Low normal on oxygen
    if (o2.onOxygen && o2.value < 95) {
      return {
        alert: true,
        severity: 'warning',
        type: 'inadequate-oxygenation',
        message: `Low saturation despite oxygen: ${o2.value}%`,
        values: { saturation: o2.value, oxygenFlow: o2.oxygenFlow },
        action: 'Consider increasing oxygen flow',
        protocol: 'OXYGEN-001'
      };
    }
    
    return null;
  }

  checkTemperature(temp, thresholds) {
    if (!temp) return null;
    
    // Convert to Fahrenheit for comparison
    const tempF = temp.unit === 'C' ? (temp.value * 9/5) + 32 : temp.value;
    
    // Hyperpyrexia
    if (tempF > 106) {
      return {
        alert: true,
        severity: 'critical',
        type: 'hyperpyrexia',
        message: `Hyperpyrexia: ${temp.value}°${temp.unit}`,
        values: { temperature: temp.value, unit: temp.unit },
        action: 'Immediate cooling measures, assess for heat stroke',
        protocol: 'HYPERTHERMIA-001'
      };
    }
    
    // High fever
    if (tempF > 103) {
      return {
        alert: true,
        severity: 'warning',
        type: 'high-fever',
        message: `High fever: ${temp.value}°${temp.unit}`,
        values: { temperature: temp.value },
        action: 'Antipyretics recommended, assess for infection',
        protocol: 'FEVER-001'
      };
    }
    
    // Hypothermia
    if (tempF < 95) {
      const severity = tempF < 90 ? 'critical' : 'warning';
      return {
        alert: true,
        severity,
        type: 'hypothermia',
        message: `Hypothermia: ${temp.value}°${temp.unit}`,
        values: { temperature: temp.value },
        action: severity === 'critical' ? 'Active rewarming required' : 'Passive rewarming, monitor',
        protocol: 'HYPOTHERMIA-001'
      };
    }
    
    return null;
  }

  checkRespiratoryRate(rr, thresholds) {
    if (!rr) return null;
    
    // Severe tachypnea
    if (rr.value > 30) {
      return {
        alert: true,
        severity: 'critical',
        type: 'severe-tachypnea',
        message: `Severe tachypnea: ${rr.value} breaths/min`,
        values: { rate: rr.value, pattern: rr.pattern },
        action: 'Assess for respiratory distress',
        protocol: 'TACHYPNEA-001'
      };
    }
    
    // Tachypnea
    if (rr.value > 20) {
      return {
        alert: true,
        severity: 'warning',
        type: 'tachypnea',
        message: `Tachypnea: ${rr.value} breaths/min`,
        values: { rate: rr.value },
        action: 'Assess respiratory status',
        protocol: 'TACHYPNEA-002'
      };
    }
    
    // Bradypnea
    if (rr.value < 12) {
      const severity = rr.value < 8 ? 'critical' : 'warning';
      return {
        alert: true,
        severity,
        type: 'bradypnea',
        message: `Bradypnea: ${rr.value} breaths/min`,
        values: { rate: rr.value },
        action: severity === 'critical' ? 'Assess for respiratory depression' : 'Monitor closely',
        protocol: 'BRADYPNEA-001'
      };
    }
    
    // Labored breathing
    if (rr.pattern === 'labored') {
      return {
        alert: true,
        severity: 'warning',
        type: 'labored-breathing',
        message: 'Labored breathing pattern',
        values: { rate: rr.value, pattern: rr.pattern },
        action: 'Assess work of breathing',
        protocol: 'DYSPNEA-001'
      };
    }
    
    return null;
  }

  checkBloodGlucose(glucose, thresholds, patientInfo) {
    if (!glucose) return null;
    
    const isDiabetic = patientInfo.medicalHistory?.conditions?.includes('diabetes');
    
    // Convert to mg/dL if needed
    const valueMgDl = glucose.unit === 'mmol/L' ? glucose.value * 18 : glucose.value;
    
    // Severe hypoglycemia
    if (valueMgDl < 54) {
      return {
        alert: true,
        severity: 'critical',
        type: 'severe-hypoglycemia',
        message: `Severe hypoglycemia: ${glucose.value} ${glucose.unit}`,
        values: { glucose: glucose.value, unit: glucose.unit },
        action: 'Immediate glucose administration required',
        protocol: 'HYPOGLYCEMIA-001'
      };
    }
    
    // Hypoglycemia
    if (valueMgDl < 70) {
      return {
        alert: true,
        severity: 'warning',
        type: 'hypoglycemia',
        message: `Hypoglycemia: ${glucose.value} ${glucose.unit}`,
        values: { glucose: glucose.value },
        action: 'Administer 15g fast-acting carbohydrates',
        protocol: 'HYPOGLYCEMIA-002'
      };
    }
    
    // Severe hyperglycemia
    if (valueMgDl > 400) {
      return {
        alert: true,
        severity: 'critical',
        type: 'severe-hyperglycemia',
        message: `Severe hyperglycemia: ${glucose.value} ${glucose.unit}`,
        values: { glucose: glucose.value },
        action: 'Assess for DKA/HHS, check ketones',
        protocol: 'HYPERGLYCEMIA-001'
      };
    }
    
    // Hyperglycemia
    if (valueMgDl > 250 || (!isDiabetic && valueMgDl > 200)) {
      return {
        alert: true,
        severity: 'warning',
        type: 'hyperglycemia',
        message: `Hyperglycemia: ${glucose.value} ${glucose.unit}`,
        values: { glucose: glucose.value },
        action: 'Review insulin/medication regimen',
        protocol: 'HYPERGLYCEMIA-002'
      };
    }
    
    return null;
  }

  checkCompoundAlerts(alerts, vitalSignsData) {
    const compoundAlerts = [];
    
    // Check for sepsis criteria (SIRS)
    const hasFever = alerts.some(a => a.type === 'high-fever');
    const hasTachycardia = alerts.some(a => a.type.includes('tachycardia'));
    const hasTachypnea = alerts.some(a => a.type.includes('tachypnea'));
    
    if ((hasFever || vitalSignsData.vitals.temperature?.value < 96) && 
        (hasTachycardia || hasTachypnea)) {
      compoundAlerts.push({
        alert: true,
        severity: 'critical',
        type: 'possible-sepsis',
        message: 'Possible sepsis - multiple SIRS criteria met',
        action: 'Initiate sepsis protocol, blood cultures, antibiotics within 1 hour',
        protocol: 'SEPSIS-001',
        relatedAlerts: alerts.filter(a => 
          a.type.includes('fever') || 
          a.type.includes('tachycardia') || 
          a.type.includes('tachypnea')
        ).map(a => a.type)
      });
    }
    
    // Check for shock
    const hasHypotension = alerts.some(a => a.type === 'hypotension');
    const hasHypoxemia = alerts.some(a => a.type.includes('hypoxemia'));
    
    if (hasHypotension && (hasTachycardia || hasHypoxemia)) {
      compoundAlerts.push({
        alert: true,
        severity: 'critical',
        type: 'possible-shock',
        message: 'Possible shock - hypotension with compensatory signs',
        action: 'IV access, fluid resuscitation, assess shock type',
        protocol: 'SHOCK-001',
        relatedAlerts: alerts.filter(a => 
          a.type.includes('hypotension') || 
          a.type.includes('tachycardia') || 
          a.type.includes('hypoxemia')
        ).map(a => a.type)
      });
    }
    
    return compoundAlerts;
  }

  async processAlerts(alerts, vitalSignsData, patientInfo, context) {
    // Group alerts by severity
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.filter(a => a.severity === 'warning');
    const infoAlerts = alerts.filter(a => a.severity === 'info');
    
    // Process critical alerts immediately
    if (criticalAlerts.length > 0) {
      await this.sendCriticalAlert(criticalAlerts, vitalSignsData, patientInfo, context);
    }
    
    // Process warning alerts
    if (warningAlerts.length > 0) {
      await this.sendWarningAlert(warningAlerts, vitalSignsData, patientInfo, context);
    }
    
    // Store all alerts in database
    await this.storeAlerts(alerts, vitalSignsData, context);
    
    // Update alert dashboard
    await this.updateAlertDashboard(alerts, patientInfo, context);
    
    // Check for escalation
    await this.checkEscalation(alerts, patientInfo, context);
  }

  async sendCriticalAlert(alerts, vitalSignsData, patientInfo, context) {
    // Get on-call provider
    const onCallProvider = await this.getOnCallProvider(context.practiceId);
    
    // Send immediate notifications
    const notification = {
      type: 'CRITICAL_VITAL_ALERT',
      priority: 'urgent',
      patient: {
        id: patientInfo._id,
        name: `${patientInfo.firstName} ${patientInfo.lastName}`,
        mrn: patientInfo.mrn
      },
      alerts: alerts.map(a => ({
        type: a.type,
        message: a.message,
        action: a.action,
        protocol: a.protocol
      })),
      vitalSigns: vitalSignsData.vitals,
      timestamp: new Date(),
      requiresAcknowledgment: true
    };
    
    // Send via multiple channels
    await Promise.all([
      notificationService.sendPush(onCallProvider.id, notification),
      notificationService.sendSMS(onCallProvider.phone, this.formatSMSAlert(alerts, patientInfo)),
      notificationService.sendToNursingStation(context.practiceId, notification)
    ]);
    
    // Create urgent task
    await this.createUrgentTask(alerts, patientInfo, onCallProvider, context);
  }

  async sendWarningAlert(alerts, vitalSignsData, patientInfo, context) {
    const notification = {
      type: 'WARNING_VITAL_ALERT',
      priority: 'high',
      patient: {
        id: patientInfo._id,
        name: `${patientInfo.firstName} ${patientInfo.lastName}`,
        mrn: patientInfo.mrn
      },
      alerts: alerts.map(a => ({
        type: a.type,
        message: a.message,
        action: a.action
      })),
      timestamp: new Date()
    };
    
    // Send to care team
    await notificationService.sendToCareTeam(patientInfo._id, notification, context);
  }

  async storeAlerts(alerts, vitalSignsData, context) {
    const alertRecords = alerts.map(alert => ({
      patientId: vitalSignsData.patientId,
      practiceId: context.practiceId,
      vitalSignsId: vitalSignsData._id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      values: alert.values,
      action: alert.action,
      protocol: alert.protocol,
      createdAt: new Date(),
      createdBy: context.userId,
      status: 'active',
      acknowledged: false
    }));
    
    await SecureDataAccess.insertMany('vitalalerts', alertRecords, context);
    
    // Create audit log
    await AuditLog.create({
      action: 'VITAL_ALERTS_GENERATED',
      userId: context.userId,
      patientId: vitalSignsData.patientId,
      practiceId: context.practiceId,
      severity: alerts.some(a => a.severity === 'critical') ? 'critical' : 'high',
      details: {
        alertCount: alerts.length,
        criticalCount: alerts.filter(a => a.severity === 'critical').length,
        types: alerts.map(a => a.type)
      },
      timestamp: new Date()
    });
  }

  async checkEscalation(alerts, patientInfo, context) {
    // Check if alerts need escalation based on patterns
    const recentAlerts = await SecureDataAccess.query('vitalalerts', {
      patientId: patientInfo._id,
      practiceId: context.practiceId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      status: 'active'
    }, context);
    
    // Escalate if multiple critical alerts in 24 hours
    const criticalCount = recentAlerts.filter(a => a.severity === 'critical').length;
    if (criticalCount >= 3) {
      await this.escalateToMedicalDirector(patientInfo, recentAlerts, context);
    }
    
    // Escalate if same alert type recurring
    const alertTypes = {};
    recentAlerts.forEach(a => {
      alertTypes[a.type] = (alertTypes[a.type] || 0) + 1;
    });
    
    Object.entries(alertTypes).forEach(async ([type, count]) => {
      if (count >= 5) {
        await this.escalateRecurringAlert(type, count, patientInfo, context);
      }
    });
  }

  async loadAlertThresholds() {
    // Load configurable alert thresholds
    return {
      default: {
        bloodPressure: {
          critical: {
            high: { systolic: 180, diastolic: 120 },
            low: { systolic: 80, diastolic: 50 }
          },
          warning: {
            high: { systolic: 140, diastolic: 90 },
            low: { systolic: 90, diastolic: 60 }
          }
        },
        heartRate: {
          critical: { high: 150, low: 40 },
          warning: { high: 100, low: 60 }
        },
        temperature: {
          critical: { high: 106, low: 90 },
          warning: { high: 103, low: 95 }
        },
        oxygenSaturation: {
          critical: { low: 85 },
          warning: { low: 92 }
        },
        respiratoryRate: {
          critical: { high: 30, low: 8 },
          warning: { high: 20, low: 12 }
        }
      },
      pediatric: {
        // Age-specific thresholds for children
      },
      geriatric: {
        // Age-specific thresholds for elderly
      },
      infant: {
        // Age-specific thresholds for infants
      }
    };
  }

  // Helper methods
  calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  async getPatientInfo(patientId, context) {
    return await SecureDataAccess.findById('patients', patientId, context);
  }

  async getOnCallProvider(practiceId) {
    // Get current on-call provider for practice
    const schedule = await SecureDataAccess.findOne('oncallschedules', {
      practiceId,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() }
    });
    
    return schedule ? schedule.provider : null;
  }

  formatSMSAlert(alerts, patientInfo) {
    const critical = alerts[0]; // Send most critical
    return `CRITICAL ALERT: ${patientInfo.firstName} ${patientInfo.lastName} - ${critical.message}. Action: ${critical.action}`;
  }

  async createUrgentTask(alerts, patientInfo, provider, context) {
    // Create task in task management system
    const task = {
      type: 'urgent-vital-review',
      priority: 'urgent',
      patientId: patientInfo._id,
      assignedTo: provider.id,
      title: `Critical vital signs for ${patientInfo.firstName} ${patientInfo.lastName}`,
      description: alerts.map(a => `${a.message}: ${a.action}`).join('\n'),
      dueTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      createdAt: new Date(),
      status: 'pending'
    };
    
    await SecureDataAccess.create('tasks', task, context);
  }

  async updateAlertDashboard(alerts, patientInfo, context) {
    // Update real-time dashboard
    const dashboard = {
      practiceId: context.practiceId,
      patientId: patientInfo._id,
      alerts: alerts.map(a => ({
        type: a.type,
        severity: a.severity,
        message: a.message,
        timestamp: new Date()
      })),
      updatedAt: new Date()
    };
    
    // Broadcast to connected clients
    await notificationService.broadcastToDashboard(context.practiceId, dashboard);
  }

  async escalateToMedicalDirector(patientInfo, alerts, context) {
    // Escalate to medical director
    const medicalDirector = await this.getMedicalDirector(context.practiceId);
    
    await notificationService.sendEmail(medicalDirector.email, {
      subject: `ESCALATION: Multiple critical alerts for ${patientInfo.firstName} ${patientInfo.lastName}`,
      body: this.formatEscalationEmail(patientInfo, alerts),
      priority: 'high'
    });
  }

  async escalateRecurringAlert(alertType, count, patientInfo, context) {
    // Escalate recurring alerts
    await notificationService.sendToCareTeam(patientInfo._id, {
      type: 'RECURRING_ALERT_ESCALATION',
      message: `Alert type "${alertType}" has occurred ${count} times in 24 hours`,
      action: 'Review patient care plan and alert thresholds'
    }, context);
  }

  getMedicalDirector(practiceId) {
    return SecureDataAccess.findOne('users', {
      practiceId,
      role: 'medical-director'
    });
  }

  formatEscalationEmail(patientInfo, alerts) {
    // Format escalation email content
    return `
      Patient: ${patientInfo.firstName} ${patientInfo.lastName} (MRN: ${patientInfo.mrn})
      Critical Alerts in past 24 hours: ${alerts.filter(a => a.severity === 'critical').length}
      
      Recent Alerts:
      ${alerts.map(a => `- ${a.createdAt}: ${a.type} - ${a.message}`).join('\n')}
      
      Immediate review and intervention recommended.
    `;
  }
}

module.exports = new VitalAlertsService();
```

### 2. Create Alert API Endpoints
```javascript
// backend/routes/vitals.js (additions)

// Manually trigger vital alert check
router.post('/api/vitals/:id/check-alerts', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };
    
    // Get vital signs record
    const vitalSigns = await SecureDataAccess.findById('vitalsigns', id, context);
    
    if (!vitalSigns) {
      return res.status(404).json({
        success: false,
        error: 'Vital signs record not found'
      });
    }
    
    const result = await vitalAlertsService.checkAndAlertVitals(vitalSigns, context);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking vital alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check vital alerts'
    });
  }
});

// Get active alerts for patient
router.get('/api/vitals/patient/:patientId/alerts', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status = 'active', severity, limit = 50 } = req.query;
    
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };
    
    const query = {
      patientId,
      practiceId: context.practiceId,
      status
    };
    
    if (severity) {
      query.severity = severity;
    }
    
    const alerts = await SecureDataAccess.query('vitalalerts', query, {
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    }, context);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Error retrieving vital alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vital alerts'
    });
  }
});

// Acknowledge alert
router.post('/api/vitals/alerts/:alertId/acknowledge', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;
    
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };
    
    const update = {
      acknowledged: true,
      acknowledgedBy: context.userId,
      acknowledgedAt: new Date(),
      acknowledgmentNotes: notes,
      status: 'acknowledged'
    };
    
    const result = await SecureDataAccess.update('vitalalerts', alertId, update, context);
    
    res.json({
      success: true,
      data: result,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

// Update patient alert thresholds
router.put('/api/vitals/patient/:patientId/thresholds', authenticate, authorize(['provider']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { thresholds, reason } = req.body;
    
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };
    
    const thresholdData = {
      patientId,
      practiceId: context.practiceId,
      thresholds,
      reason,
      setBy: context.userId,
      setAt: new Date()
    };
    
    const result = await SecureDataAccess.upsert('patientthresholds', 
      { patientId, practiceId: context.practiceId },
      thresholdData,
      context
    );
    
    // Create audit log
    await AuditLog.create({
      action: 'UPDATE_ALERT_THRESHOLDS',
      userId: context.userId,
      patientId,
      practiceId: context.practiceId,
      details: { thresholds, reason },
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      data: result,
      message: 'Alert thresholds updated successfully'
    });
  } catch (error) {
    console.error('Error updating alert thresholds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert thresholds'
    });
  }
});
```

## Required Endpoints

### POST /api/vitals/:id/check-alerts
**Description**: Manually trigger alert check for vital signs
**Access**: Providers, Nurses

### GET /api/vitals/patient/:patientId/alerts
**Description**: Get alerts for a patient
**Access**: Providers, Nurses
**Query Parameters**:
- `status` (string): Alert status (active/acknowledged/resolved)
- `severity` (string): Filter by severity
- `limit` (number): Maximum results

### POST /api/vitals/alerts/:alertId/acknowledge
**Description**: Acknowledge an alert
**Access**: Providers, Nurses
**Request Body**:
```json
{
  "notes": "Administered medication as per protocol"
}
```

### PUT /api/vitals/patient/:patientId/thresholds
**Description**: Update custom alert thresholds for patient
**Access**: Providers only
**Request Body**:
```json
{
  "thresholds": {
    "bloodPressure": {
      "warning": { "high": { "systolic": 130 } }
    }
  },
  "reason": "Patient has white coat syndrome"
}
```

## Data Models Required

### VitalAlerts Collection
```javascript
{
  patientId: ObjectId,
  practiceId: String,
  vitalSignsId: ObjectId,
  type: String,
  severity: String, // critical, warning, info
  message: String,
  values: Object,
  action: String,
  protocol: String,
  status: String, // active, acknowledged, resolved
  acknowledged: Boolean,
  acknowledgedBy: ObjectId,
  acknowledgedAt: Date,
  acknowledgmentNotes: String,
  createdAt: Date,
  createdBy: ObjectId
}
```

### PatientThresholds Collection
```javascript
{
  patientId: ObjectId,
  practiceId: String,
  thresholds: Object,
  reason: String,
  setBy: ObjectId,
  setAt: Date
}
```

## Test Cases

### 1. Critical Alert Generation
- Input critical vital values
- Verify immediate alert sent
- Check multiple notification channels

### 2. Compound Alert Detection
- Input multiple abnormal values
- Verify sepsis/shock detection
- Check protocol activation

### 3. Custom Thresholds
- Set patient-specific thresholds
- Verify alerts use custom values
- Check threshold override works

### 4. Alert Escalation
- Generate multiple critical alerts
- Verify escalation triggered
- Check medical director notified

### 5. Alert Acknowledgment
- Acknowledge active alert
- Verify status updated
- Check audit trail

### 6. Age-Specific Alerts
- Test pediatric thresholds
- Test geriatric thresholds
- Verify age calculations

### 7. Medical Condition Adjustments
- Test diabetic glucose thresholds
- Test COPD oxygen levels
- Verify condition-based logic

## Dependencies
- SecureDataAccess service
- NotificationService for multi-channel alerts
- AuditLog for tracking
- On-call schedule system
- Task management system

## Success Criteria
- [ ] All vital parameters checked
- [ ] Critical alerts sent immediately
- [ ] Multiple notification channels work
- [ ] Compound alerts detected
- [ ] Custom thresholds supported
- [ ] Escalation logic functional
- [ ] Alert dashboard updates real-time
- [ ] Acknowledgment system works
- [ ] Age/condition adjustments applied
- [ ] Complete audit trail maintained

## Notes
- Consider machine learning for predictive alerts
- May need integration with paging systems
- Future enhancement: alert fatigue reduction algorithms
- Consider adding voice call alerts for critical situations
- May need integration with clinical protocols system