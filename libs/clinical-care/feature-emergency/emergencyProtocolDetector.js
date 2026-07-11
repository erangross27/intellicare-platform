/**
 * Emergency Protocol Detector - Modular Version
 * Real-time emergency detection and alert system
 * Migrated to DDD NX architecture - Clinical Care Context - Emergency Feature
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class EmergencyProtocolDetector {
  constructor() {
    this.serviceId = 'emergency-protocol-detector';
    this.serviceToken = null;
    this.initialized = false;
    
    // Emergency detection patterns
    this.emergencyPatterns = {
      vital_signs: {
        heart_rate: { critical_high: 120, critical_low: 50 },
        blood_pressure: { 
          systolic: { critical_high: 180, critical_low: 90 },
          diastolic: { critical_high: 110, critical_low: 60 }
        },
        temperature: { critical_high: 104, critical_low: 95 },
        oxygen_saturation: { critical_low: 90 },
        respiratory_rate: { critical_high: 24, critical_low: 12 }
      },
      
      symptoms: [
        'chest pain',
        'difficulty breathing',
        'severe bleeding',
        'unconscious',
        'seizure',
        'severe burn',
        'suspected overdose',
        'severe allergic reaction',
        'head injury',
        'broken bone',
        'severe abdominal pain',
        'stroke symptoms'
      ],
      
      lab_values: {
        glucose: { critical_high: 400, critical_low: 70 },
        potassium: { critical_high: 6.0, critical_low: 3.0 },
        sodium: { critical_high: 150, critical_low: 130 },
        creatinine: { critical_high: 3.0 }
      }
    };
    
    // Alert levels
    this.alertLevels = {
      LOW: 'low',
      MEDIUM: 'medium', 
      HIGH: 'high',
      CRITICAL: 'critical'
    };
    
    // Active emergency protocols
    this.activeProtocols = new Map();
    this.emergencyHistory = [];
  }

  async initialize() {
    if (this.initialized) return this;

    try {
      const proxy = getServiceProxy();
      
      // Authenticate service
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Load emergency protocols from database
      await this.loadEmergencyProtocols();
      
      this.initialized = true;
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'emergency-protocol-detector',
        timestamp: new Date()
      }, context);
      
      console.log('✅ Emergency Protocol Detector initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Emergency Protocol Detector:', error);
      throw error;
    }
  }

  /**
   * Load emergency protocols from database
   */
  async loadEmergencyProtocols() {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'load_protocols',
        practiceId: 'global'
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const protocols = await SecureDataAccess.query(
        'emergency_protocols',
        { active: true },
        {},
        context
      );

      console.log(`📋 Loaded ${protocols.length} emergency protocols`);
      return protocols;
    } catch (error) {
      console.error('Failed to load emergency protocols:', error);
      return [];
    }
  }

  /**
   * Detect emergency conditions in patient data
   */
  async detectEmergency(patientData, practiceId) {
    try {
      const detectedEmergencies = [];
      
      // Check vital signs
      if (patientData.vitals) {
        const vitalEmergencies = this.checkVitalSigns(patientData.vitals);
        detectedEmergencies.push(...vitalEmergencies);
      }
      
      // Check symptoms
      if (patientData.symptoms) {
        const symptomEmergencies = this.checkSymptoms(patientData.symptoms);
        detectedEmergencies.push(...symptomEmergencies);
      }
      
      // Check lab values
      if (patientData.labResults) {
        const labEmergencies = this.checkLabValues(patientData.labResults);
        detectedEmergencies.push(...labEmergencies);
      }
      
      // Check medication interactions
      if (patientData.medications) {
        const drugEmergencies = this.checkDrugInteractions(patientData.medications);
        detectedEmergencies.push(...drugEmergencies);
      }
      
      // Process detected emergencies
      if (detectedEmergencies.length > 0) {
        await this.processEmergencies(detectedEmergencies, patientData, practiceId);
      }
      
      return {
        emergenciesDetected: detectedEmergencies.length > 0,
        emergencies: detectedEmergencies,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('Emergency detection error:', error);
      throw error;
    }
  }

  /**
   * Check vital signs for emergency conditions
   */
  checkVitalSigns(vitals) {
    const emergencies = [];
    const patterns = this.emergencyPatterns.vital_signs;
    
    // Heart rate
    if (vitals.heartRate) {
      if (vitals.heartRate > patterns.heart_rate.critical_high) {
        emergencies.push({
          type: 'vital_signs',
          category: 'tachycardia',
          severity: this.alertLevels.CRITICAL,
          value: vitals.heartRate,
          threshold: patterns.heart_rate.critical_high,
          message: `Critical tachycardia: ${vitals.heartRate} bpm`
        });
      } else if (vitals.heartRate < patterns.heart_rate.critical_low) {
        emergencies.push({
          type: 'vital_signs',
          category: 'bradycardia',
          severity: this.alertLevels.CRITICAL,
          value: vitals.heartRate,
          threshold: patterns.heart_rate.critical_low,
          message: `Critical bradycardia: ${vitals.heartRate} bpm`
        });
      }
    }
    
    // Blood pressure
    if (vitals.systolicBP && vitals.diastolicBP) {
      if (vitals.systolicBP > patterns.blood_pressure.systolic.critical_high || 
          vitals.diastolicBP > patterns.blood_pressure.diastolic.critical_high) {
        emergencies.push({
          type: 'vital_signs',
          category: 'hypertensive_crisis',
          severity: this.alertLevels.CRITICAL,
          value: `${vitals.systolicBP}/${vitals.diastolicBP}`,
          message: `Hypertensive crisis: ${vitals.systolicBP}/${vitals.diastolicBP} mmHg`
        });
      }
      
      if (vitals.systolicBP < patterns.blood_pressure.systolic.critical_low || 
          vitals.diastolicBP < patterns.blood_pressure.diastolic.critical_low) {
        emergencies.push({
          type: 'vital_signs',
          category: 'hypotension',
          severity: this.alertLevels.HIGH,
          value: `${vitals.systolicBP}/${vitals.diastolicBP}`,
          message: `Severe hypotension: ${vitals.systolicBP}/${vitals.diastolicBP} mmHg`
        });
      }
    }
    
    // Temperature
    if (vitals.temperature) {
      if (vitals.temperature > patterns.temperature.critical_high) {
        emergencies.push({
          type: 'vital_signs',
          category: 'hyperthermia',
          severity: this.alertLevels.CRITICAL,
          value: vitals.temperature,
          threshold: patterns.temperature.critical_high,
          message: `Critical hyperthermia: ${vitals.temperature}°F`
        });
      } else if (vitals.temperature < patterns.temperature.critical_low) {
        emergencies.push({
          type: 'vital_signs',
          category: 'hypothermia',
          severity: this.alertLevels.CRITICAL,
          value: vitals.temperature,
          threshold: patterns.temperature.critical_low,
          message: `Critical hypothermia: ${vitals.temperature}°F`
        });
      }
    }
    
    // Oxygen saturation
    if (vitals.oxygenSaturation && vitals.oxygenSaturation < patterns.oxygen_saturation.critical_low) {
      emergencies.push({
        type: 'vital_signs',
        category: 'hypoxemia',
        severity: this.alertLevels.CRITICAL,
        value: vitals.oxygenSaturation,
        threshold: patterns.oxygen_saturation.critical_low,
        message: `Critical hypoxemia: ${vitals.oxygenSaturation}%`
      });
    }
    
    return emergencies;
  }

  /**
   * Check symptoms for emergency indicators
   */
  checkSymptoms(symptoms) {
    const emergencies = [];
    const emergencySymptoms = this.emergencyPatterns.symptoms;
    
    for (const symptom of symptoms) {
      const symptomLower = symptom.toLowerCase();
      
      for (const emergencySymptom of emergencySymptoms) {
        if (symptomLower.includes(emergencySymptom)) {
          let severity = this.alertLevels.HIGH;
          
          // Determine severity based on specific symptoms
          if (['chest pain', 'difficulty breathing', 'unconscious', 'seizure'].includes(emergencySymptom)) {
            severity = this.alertLevels.CRITICAL;
          }
          
          emergencies.push({
            type: 'symptoms',
            category: emergencySymptom.replace(/\s+/g, '_'),
            severity: severity,
            symptom: symptom,
            message: `Emergency symptom detected: ${symptom}`
          });
          break; // Don't double-count symptoms
        }
      }
    }
    
    return emergencies;
  }

  /**
   * Check lab values for critical results
   */
  checkLabValues(labResults) {
    const emergencies = [];
    const patterns = this.emergencyPatterns.lab_values;
    
    for (const [testName, value] of Object.entries(labResults)) {
      const testPattern = patterns[testName.toLowerCase()];
      if (!testPattern) continue;
      
      if (testPattern.critical_high && value > testPattern.critical_high) {
        emergencies.push({
          type: 'lab_values',
          category: `${testName}_high`,
          severity: this.alertLevels.CRITICAL,
          test: testName,
          value: value,
          threshold: testPattern.critical_high,
          message: `Critical high ${testName}: ${value}`
        });
      }
      
      if (testPattern.critical_low && value < testPattern.critical_low) {
        emergencies.push({
          type: 'lab_values',
          category: `${testName}_low`,
          severity: this.alertLevels.CRITICAL,
          test: testName,
          value: value,
          threshold: testPattern.critical_low,
          message: `Critical low ${testName}: ${value}`
        });
      }
    }
    
    return emergencies;
  }

  /**
   * Check for dangerous drug interactions
   */
  checkDrugInteractions(medications) {
    const emergencies = [];
    
    // Known dangerous combinations
    const dangerousInteractions = [
      {
        drugs: ['warfarin', 'aspirin'],
        risk: 'severe_bleeding',
        severity: this.alertLevels.HIGH
      },
      {
        drugs: ['digoxin', 'furosemide'],
        risk: 'digitalis_toxicity',
        severity: this.alertLevels.HIGH
      },
      {
        drugs: ['phenytoin', 'warfarin'],
        risk: 'bleeding_risk',
        severity: this.alertLevels.MEDIUM
      }
    ];
    
    // Check current medications against interaction database
    const currentDrugs = medications.map(med => med.name.toLowerCase());
    
    for (const interaction of dangerousInteractions) {
      const matchingDrugs = interaction.drugs.filter(drug => 
        currentDrugs.some(currentDrug => currentDrug.includes(drug))
      );
      
      if (matchingDrugs.length >= 2) {
        emergencies.push({
          type: 'drug_interaction',
          category: interaction.risk,
          severity: interaction.severity,
          drugs: matchingDrugs,
          message: `Dangerous drug interaction: ${matchingDrugs.join(' + ')}`
        });
      }
    }
    
    return emergencies;
  }

  /**
   * Process detected emergencies
   */
  async processEmergencies(emergencies, patientData, practiceId) {
    try {
      for (const emergency of emergencies) {
        // Create emergency record
        const emergencyRecord = {
          emergencyId: `EMG_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          patientId: patientData.patientId,
          practiceId: practiceId,
          type: emergency.type,
          category: emergency.category,
          severity: emergency.severity,
          message: emergency.message,
          data: emergency,
          detectedAt: new Date(),
          status: 'active',
          acknowledged: false
        };
        
        // Store emergency record
        const context = {
          serviceId: this.serviceId,
          operation: 'create_emergency',
          practiceId: practiceId
        };
        
        await SecureDataAccess.create('emergencies', emergencyRecord, context);
        
        // Trigger alerts
        await this.triggerEmergencyAlert(emergencyRecord, patientData, practiceId);
        
        // Add to active protocols
        this.activeProtocols.set(emergencyRecord.emergencyId, emergencyRecord);
        
        console.log(`🚨 Emergency detected: ${emergency.message}`);
      }
      
      // Add to history
      this.emergencyHistory.push({
        timestamp: new Date(),
        patientId: patientData.patientId,
        practiceId: practiceId,
        emergencyCount: emergencies.length,
        maxSeverity: this.getMaxSeverity(emergencies)
      });
      
    } catch (error) {
      console.error('Failed to process emergencies:', error);
      throw error;
    }
  }

  /**
   * Trigger emergency alert
   */
  async triggerEmergencyAlert(emergency, patientData, practiceId) {
    try {
      // Create alert notification
      const alert = {
        alertId: `ALERT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        emergencyId: emergency.emergencyId,
        patientId: patientData.patientId,
        practiceId: practiceId,
        severity: emergency.severity,
        message: emergency.message,
        alertType: 'emergency_detection',
        recipients: await this.getAlertRecipients(emergency.severity, practiceId),
        createdAt: new Date(),
        status: 'pending'
      };
      
      // Store alert
      const context = {
        serviceId: this.serviceId,
        operation: 'create_alert',
        practiceId: practiceId
      };
      
      await SecureDataAccess.create('emergency_alerts', alert, context);
      
      // Send immediate notifications for critical emergencies
      if (emergency.severity === this.alertLevels.CRITICAL) {
        await this.sendImmediateNotification(alert, patientData);
      }
      
      console.log(`📢 Emergency alert triggered: ${alert.alertId}`);
      
    } catch (error) {
      console.error('Failed to trigger emergency alert:', error);
    }
  }

  /**
   * Get alert recipients based on severity
   */
  async getAlertRecipients(severity, practiceId) {
    // In a real implementation, this would fetch from staff database
    const recipients = [];
    
    switch (severity) {
      case this.alertLevels.CRITICAL:
        recipients.push('emergency_physician', 'charge_nurse', 'administrator');
        break;
      case this.alertLevels.HIGH:
        recipients.push('attending_physician', 'charge_nurse');
        break;
      case this.alertLevels.MEDIUM:
        recipients.push('attending_physician');
        break;
      default:
        recipients.push('nurse');
    }
    
    return recipients;
  }

  /**
   * Send immediate notification for critical emergencies
   */
  async sendImmediateNotification(alert, patientData) {
    // Implementation would integrate with notification services
    // (email, SMS, pager systems, etc.)
    console.log(`🚨 IMMEDIATE NOTIFICATION: ${alert.message} for patient ${patientData.name}`);
  }

  /**
   * Acknowledge emergency
   */
  async acknowledgeEmergency(emergencyId, userId, practiceId) {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'acknowledge_emergency',
        practiceId: practiceId
      };
      
      const updateData = {
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      };
      
      await SecureDataAccess.update(
        'emergencies',
        { emergencyId: emergencyId },
        updateData,
        context
      );
      
      // Update active protocols
      if (this.activeProtocols.has(emergencyId)) {
        const protocol = this.activeProtocols.get(emergencyId);
        Object.assign(protocol, updateData);
      }
      
      console.log(`✅ Emergency acknowledged: ${emergencyId} by user ${userId}`);
      
      return { success: true, acknowledgedAt: updateData.acknowledgedAt };
      
    } catch (error) {
      console.error('Failed to acknowledge emergency:', error);
      throw error;
    }
  }

  /**
   * Resolve emergency
   */
  async resolveEmergency(emergencyId, userId, resolution, practiceId) {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'resolve_emergency',
        practiceId: practiceId
      };
      
      const updateData = {
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolution: resolution
      };
      
      await SecureDataAccess.update(
        'emergencies',
        { emergencyId: emergencyId },
        updateData,
        context
      );
      
      // Remove from active protocols
      this.activeProtocols.delete(emergencyId);
      
      console.log(`🎯 Emergency resolved: ${emergencyId} by user ${userId}`);
      
      return { success: true, resolvedAt: updateData.resolvedAt };
      
    } catch (error) {
      console.error('Failed to resolve emergency:', error);
      throw error;
    }
  }

  /**
   * Get active emergencies
   */
  async getActiveEmergencies(practiceId) {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'get_active_emergencies',
        practiceId: practiceId
      };
      
      const activeEmergencies = await SecureDataAccess.query(
        'emergencies',
        { status: 'active', practiceId: practiceId },
        { sort: { detectedAt: -1 } },
        context
      );
      
      return activeEmergencies;
      
    } catch (error) {
      console.error('Failed to get active emergencies:', error);
      throw error;
    }
  }

  /**
   * Get emergency statistics
   */
  getEmergencyStats() {
    const stats = {
      activeProtocols: this.activeProtocols.size,
      totalDetected: this.emergencyHistory.length,
      recentHistory: this.emergencyHistory.slice(-10),
      severityBreakdown: {}
    };
    
    // Calculate severity breakdown
    for (const level of Object.values(this.alertLevels)) {
      stats.severityBreakdown[level] = 0;
    }
    
    for (const [id, protocol] of this.activeProtocols) {
      stats.severityBreakdown[protocol.severity]++;
    }
    
    return stats;
  }

  /**
   * Get maximum severity from list of emergencies
   */
  getMaxSeverity(emergencies) {
    const severityOrder = [
      this.alertLevels.LOW,
      this.alertLevels.MEDIUM,
      this.alertLevels.HIGH,
      this.alertLevels.CRITICAL
    ];
    
    let maxSeverity = this.alertLevels.LOW;
    
    for (const emergency of emergencies) {
      const currentIndex = severityOrder.indexOf(emergency.severity);
      const maxIndex = severityOrder.indexOf(maxSeverity);
      
      if (currentIndex > maxIndex) {
        maxSeverity = emergency.severity;
      }
    }
    
    return maxSeverity;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      activeProtocols: this.activeProtocols.size,
      totalDetected: this.emergencyHistory.length,
      availablePatterns: Object.keys(this.emergencyPatterns)
    };
  }
}

// Create and export singleton
const emergencyProtocolDetector = new EmergencyProtocolDetector();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('emergencyProtocolDetector', () => emergencyProtocolDetector);
}

module.exports = emergencyProtocolDetector;