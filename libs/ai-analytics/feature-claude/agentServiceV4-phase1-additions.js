// IntelliCare Agent Service V4 - Phase 1 Core Clinical Functions Additions
// This file contains the missing critical functions identified in the API mapping
// Migrated to DDD NX architecture - AI Analytics Context - Claude Feature

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}
const axios = require('axios');

/**
 * Phase 1 Core Clinical Functions - Missing Implementations
 * Based on API-FUNCTION-MAPPING.md analysis
 */
class Phase1ClinicalFunctions {
  constructor() {
    this.serviceId = 'agent-service-v4-phase1-additions';
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      this.initialized = true;
      console.log('✅ Phase1ClinicalFunctions initialized with authentication');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Phase1ClinicalFunctions:', error);
      throw error;
    }
  }

  // ========== APPOINTMENTS - Missing Functions ==========
  
  /**
   * Get detailed appointment information by ID
   * Priority: HIGH
   */
  async getAppointmentById(params, practiceContext, session) {
    if (!this.initialized) await this.initialize();

    try {
      const { appointmentId } = params;
      
      if (!appointmentId) {
        return {
          success: false,
          error: session?.language === 'he' 
            ? 'מזהה התור חסר' 
            : 'Appointment ID is required'
        };
      }
      
      const context = {
        serviceId: this.serviceId,
        operation: 'get-appointment-by-id',
        practiceId: practiceContext.practiceId || session?.practiceId
      };
      
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const appointments = await SecureDataAccess.query('appointments', { _id: appointmentId }, { limit: 1 }, context);
      const appointment = appointments[0];
      
      if (!appointment) {
        return {
          success: false,
          error: session?.language === 'he'
            ? 'התור לא נמצא'
            : 'Appointment not found'
        };
      }
      
      return {
        success: true,
        appointment,
        message: session?.language === 'he'
          ? 'פרטי התור נטענו בהצלחה'
          : 'Appointment details loaded successfully'
      };
    } catch (error) {
      console.error('Error in getAppointmentById:', error);
      return {
        success: false,
        error: session?.language === 'he'
          ? 'שגיאה בטעינת פרטי התור'
          : 'Error loading appointment details'
      };
    }
  }

  /**
   * Record vital signs during appointment
   * Priority: HIGH - Critical clinical function
   */
  async recordVitalSigns(params, practiceContext, session) {
    if (!this.initialized) await this.initialize();

    try {
      const { appointmentId, vitals } = params;
      
      if (!appointmentId || !vitals) {
        return {
          success: false,
          error: session?.language === 'he'
            ? 'מזהה התור וסימני חיים נדרשים'
            : 'Appointment ID and vital signs are required'
        };
      }
      
      // Define normal vital sign ranges
      const vitalRanges = {
        bloodPressure: {
          systolic: { min: 90, max: 180 },
          diastolic: { min: 40, max: 130 }
        },
        heartRate: { min: 40, max: 200 },
        temperature: { min: 35, max: 42 },
        weight: { min: 1, max: 300 },
        height: { min: 30, max: 250 },
        oxygenSaturation: { min: 70, max: 100 }
      };
      
      // Validate and flag abnormal values
      const abnormalVitals = [];
      
      if (vitals.bloodPressure) {
        const [systolic, diastolic] = vitals.bloodPressure.split('/').map(Number);
        if (systolic < vitalRanges.bloodPressure.systolic.min || 
            systolic > vitalRanges.bloodPressure.systolic.max ||
            diastolic < vitalRanges.bloodPressure.diastolic.min ||
            diastolic > vitalRanges.bloodPressure.diastolic.max) {
          abnormalVitals.push('bloodPressure');
        }
      }
      
      if (vitals.heartRate && (vitals.heartRate < vitalRanges.heartRate.min || 
          vitals.heartRate > vitalRanges.heartRate.max)) {
        abnormalVitals.push('heartRate');
      }
      
      if (vitals.temperature && (vitals.temperature < vitalRanges.temperature.min || 
          vitals.temperature > vitalRanges.temperature.max)) {
        abnormalVitals.push('temperature');
      }
      
      if (vitals.oxygenSaturation && vitals.oxygenSaturation < vitalRanges.oxygenSaturation.min) {
        abnormalVitals.push('oxygenSaturation');
      }
      
      const updateContext = {
        serviceId: this.serviceId,
        operation: 'record-vital-signs',
        practiceId: practiceContext.practiceId || session?.practiceId
      };
      
      const updateData = {
        vitals: {
          ...vitals,
          recordedAt: new Date(),
          recordedBy: session?.userId || 'system',
          abnormalFlags: abnormalVitals
        },
        lastModified: new Date()
      };
      
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.update(
        'appointments',
        { _id: appointmentId },
        updateData,
        updateContext
      );
      
      if (!result) {
        return {
          success: false,
          error: session?.language === 'he'
            ? 'התור לא נמצא'
            : 'Appointment not found'
        };
      }
      
      // Create audit log for vital signs recording
      const auditContext = {
        serviceId: this.serviceId,
        operation: 'audit-vitals-recorded',
        practiceId: practiceContext.practiceId || session?.practiceId
      };
      
      const AuditDataAccess = proxy.getService('secureDataAccess');
      await AuditDataAccess.create('audit_logs', {
        action: 'VITALS_RECORDED',
        entityType: 'appointment',
        entityId: appointmentId,
        performedBy: session?.userId || 'system',
        details: {
          vitals,
          abnormalFlags: abnormalVitals
        },
        practiceId: practiceContext.practiceId,
        createdAt: new Date()
      }, auditContext);
      
      const warningMessage = abnormalVitals.length > 0
        ? session?.language === 'he'
          ? ` ⚠️ נמצאו ערכים חריגים: ${abnormalVitals.join(', ')}`
          : ` ⚠️ Abnormal values detected: ${abnormalVitals.join(', ')}`
        : '';
      
      return {
        success: true,
        result,
        message: (session?.language === 'he'
          ? 'סימני חיים נרשמו בהצלחה'
          : 'Vital signs recorded successfully') + warningMessage,
        abnormalVitals: abnormalVitals
      };
    } catch (error) {
      console.error('Error in recordVitalSigns:', error);
      return {
        success: false,
        error: session?.language === 'he'
          ? 'שגיאה ברישום סימני חיים'
          : 'Error recording vital signs'
      };
    }
  }

  /**
   * Generate appointment summary
   * Priority: MEDIUM - Important for documentation
   */
  async generateAppointmentSummary(params, practiceContext, session) {
    if (!this.initialized) await this.initialize();

    try {
      const { appointmentId } = params;
      
      if (!appointmentId) {
        return {
          success: false,
          error: session?.language === 'he'
            ? 'מזהה התור נדרש'
            : 'Appointment ID is required'
        };
      }
      
      const context = {
        serviceId: this.serviceId,
        operation: 'generate-appointment-summary',
        practiceId: practiceContext.practiceId || session?.practiceId
      };
      
      // Get appointment details
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const appointments = await SecureDataAccess.query('appointments', { _id: appointmentId }, { limit: 1 }, context);
      const appointment = appointments[0];
      
      if (!appointment) {
        return {
          success: false,
          error: session?.language === 'he'
            ? 'התור לא נמצא'
            : 'Appointment not found'
        };
      }
      
      // Generate comprehensive summary
      const summary = {
        appointmentId,
        date: appointment.date,
        patient: appointment.patientId,
        provider: appointment.providerId,
        vitals: appointment.vitals || null,
        diagnosis: appointment.diagnosis || null,
        treatment: appointment.treatment || null,
        prescriptions: appointment.prescriptions || [],
        followUp: appointment.followUp || null,
        notes: appointment.notes || '',
        generatedAt: new Date(),
        generatedBy: session?.userId || 'system'
      };
      
      // Store summary  
      await SecureDataAccess.create('appointment_summaries', summary, context);
      
      return {
        success: true,
        summary,
        message: session?.language === 'he'
          ? 'סיכום התור נוצר בהצלחה'
          : 'Appointment summary generated successfully'
      };
    } catch (error) {
      console.error('Error in generateAppointmentSummary:', error);
      return {
        success: false,
        error: session?.language === 'he'
          ? 'שגיאה ביצירת סיכום התור'
          : 'Error generating appointment summary'
      };
    }
  }

  // ========== PATIENT DATA - Missing Functions ==========
  
  /**
   * Get patient vital signs history
   * Priority: HIGH - Essential for clinical decision making
   */
  async getPatientVitalHistory(params, practiceContext, session) {
    if (!this.initialized) await this.initialize();

    try {
      const { patientId, startDate, endDate, vitalType } = params;
      
      if (!patientId) {
        return {
          success: false,
          error: session?.language === 'he'
            ? 'מזהה מטופל נדרש'
            : 'Patient ID is required'
        };
      }
      
      const context = {
        serviceId: this.serviceId,
        operation: 'get-patient-vital-history',
        practiceId: practiceContext.practiceId || session?.practiceId
      };
      
      // Build query filter
      let filter = { patientId, 'vitals.recordedAt': { $exists: true } };
      
      if (startDate && endDate) {
        filter['vitals.recordedAt'] = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const appointments = await SecureDataAccess.query('appointments', filter, {
        sort: { 'vitals.recordedAt': -1 },
        limit: 100
      }, context);
      
      // Extract and organize vital signs
      const vitalHistory = appointments
        .filter(apt => apt.vitals)
        .map(apt => ({
          appointmentId: apt._id,
          date: apt.vitals.recordedAt,
          vitals: vitalType ? { [vitalType]: apt.vitals[vitalType] } : apt.vitals,
          abnormalFlags: apt.vitals.abnormalFlags || []
        }));
      
      return {
        success: true,
        vitalHistory,
        message: session?.language === 'he'
          ? `נמצאו ${vitalHistory.length} רשומות סימני חיים`
          : `Found ${vitalHistory.length} vital sign records`
      };
    } catch (error) {
      console.error('Error in getPatientVitalHistory:', error);
      return {
        success: false,
        error: session?.language === 'he'
          ? 'שגיאה בטעינת היסטוריית סימני חיים'
          : 'Error loading vital signs history'
      };
    }
  }

  // ========== API HELPER METHODS ==========
  
  /**
   * Generic API call helper with authentication
   */
  async callAPI(endpoint, method = 'GET', data = null, headers = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const proxy = getServiceProxy();
      const secureConfigService = proxy.getService('secureConfigService');
      const config = await secureConfigService.getConfig();
      const baseURL = config.api.baseURL || 'http://localhost:5000';
      
      const axiosConfig = {
        method,
        url: `${baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`,
          'Content-Type': 'application/json',
          ...headers
        }
      };
      
      if (data) {
        if (method === 'GET') {
          axiosConfig.params = data;
        } else {
          axiosConfig.data = data;
        }
      }
      
      const response = await axios(axiosConfig);
      return response.data;
      
    } catch (error) {
      console.error(`API call failed: ${endpoint}`, error.message);
      throw error;
    }
  }
}

// Create and export singleton
const phase1ClinicalFunctions = new Phase1ClinicalFunctions();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('phase1ClinicalFunctions', () => phase1ClinicalFunctions);
}

module.exports = phase1ClinicalFunctions;