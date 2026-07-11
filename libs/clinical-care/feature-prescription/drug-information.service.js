/**
 * Enhanced FDA Information Service
 * Comprehensive FDA data service integrating ALL OpenFDA APIs for drugs, devices,
 * food, tobacco, adverse events, labeling, and enforcement actions.
 * 
 * Features:
 * - OpenFDA drug database integration (100,000+ drugs)
 * - Medical device recalls and adverse events (500,000+ devices)
 * - Food enforcement and recalls tracking (10,000+ food products)
 * - Tobacco product oversight and compliance monitoring
 * - Comprehensive adverse event monitoring across all categories
 * - Drug labeling and prescribing information
 * - NDC number validation and lookup
 * - Multi-category recall and enforcement tracking
 * - Drug interaction checking
 * - Prescription validation and verification
 * - Real-time safety monitoring across all FDA domains
 */

// Migrated to DDD NX architecture - Clinical Care Context - Prescription Feature
// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

const crypto = require('crypto');

class EnhancedFDAInformationService {
  constructor() {
    this.serviceId = 'drug-information-service';
    this.serviceToken = null;
    this.initialized = false;
    this.alertThresholds = {
      adverseEvents: 10, // Alert if more than 10 events in 30 days
      recallSeverity: 'Class I', // Alert on Class I recalls
      interactionSeverity: 'major', // Alert on major interactions
      deviceEvents: 5, // Alert on device adverse events
      foodRecalls: 3 // Alert on food recalls
    };
    
    // Drug interaction categories
    this.interactionLevels = {
      MAJOR: { severity: 5, description: 'May be life-threatening or require medical intervention' },
      MODERATE: { severity: 3, description: 'May cause clinically significant effects' },
      MINOR: { severity: 1, description: 'Limited clinical significance' }
    };
    
    // FDA API categories
    this.fdaCategories = {
      DRUG: 'drug',
      DEVICE: 'device', 
      FOOD: 'food',
      TOBACCO: 'tobacco'
    };
    
    // Medical device classifications
    this.deviceClasses = {
      'Class I': { risk: 'LOW', description: 'Low risk devices (bandages, gloves)' },
      'Class II': { risk: 'MODERATE', description: 'Moderate risk devices (X-ray machines, wheelchairs)' },
      'Class III': { risk: 'HIGH', description: 'High risk devices (pacemakers, implants)' }
    };
    
    // Common drug interaction pairs
    this.knownInteractions = new Map();
    this.initializeKnownInteractions();
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      
      // Authenticate service
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize external API gateway
      const externalApiGateway = proxy.getService('externalApiGatewayService');
      await externalApiGateway.initialize();
      
      // Load drug interaction database
      await this.loadDrugInteractions();
      
      // Start safety monitoring
      this.startSafetyMonitoring();
      
      this.initialized = true;
      console.log('✅ Drug Information Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Drug Information Service:', error);
      throw error;
    }
  }

  /**
   * Initialize known drug interactions database
   */
  initializeKnownInteractions() {
    // Major drug interactions (examples)
    this.knownInteractions.set('warfarin+aspirin', {
      level: 'MAJOR',
      description: 'Increased bleeding risk',
      mechanism: 'Additive anticoagulant effects',
      management: 'Monitor INR closely, consider alternative therapy'
    });
    
    this.knownInteractions.set('digoxin+amiodarone', {
      level: 'MAJOR', 
      description: 'Digoxin toxicity risk',
      mechanism: 'Decreased digoxin clearance',
      management: 'Reduce digoxin dose by 50%, monitor levels'
    });
    
    this.knownInteractions.set('metformin+contrast', {
      level: 'MAJOR',
      description: 'Lactic acidosis risk',
      mechanism: 'Impaired renal function',
      management: 'Discontinue metformin before contrast, restart after 48 hours'
    });
  }

  /**
   * Search drug information by name or NDC
   */
  async searchDrug(query, options = {}) {
    await this.initialize();
    
    try {
      const searchParams = {
        search: `openfda.brand_name:"${query}" OR openfda.generic_name:"${query}"`,
        limit: options.limit || 10
      };
      
      const proxy = getServiceProxy();
      const externalApiGateway = proxy.getService('externalApiGatewayService');
      const result = await externalApiGateway.makeRequest(
        'openFDA', 
        '/drug/label.json',
        searchParams,
        { userId: options.userId }
      );
      
      const drugs = result.results?.map(drug => this.formatDrugInfo(drug)) || [];
      
      await this.logDrugSearch(query, drugs.length, options.userId);
      
      return {
        query: query,
        totalResults: result.meta?.results?.total || 0,
        drugs: drugs,
        searchTime: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Drug search error:', error);
      throw new Error(`Failed to search drug information: ${error.message}`);
    }
  }

  /**
   * Get drug information by NDC number
   */
  async getDrugByNDC(ndcNumber, options = {}) {
    await this.initialize();
    
    try {
      // Validate NDC format
      const cleanNDC = this.validateAndFormatNDC(ndcNumber);
      
      const searchParams = {
        search: `openfda.product_ndc:"${cleanNDC}"`,
        limit: 1
      };
      
      const result = await externalApiGateway.makeRequest(
        'openFDA',
        '/drug/label.json',
        searchParams,
        { userId: options.userId }
      );
      
      if (!result.results || result.results.length === 0) {
        throw new Error(`No drug found with NDC: ${ndcNumber}`);
      }
      
      const drugInfo = this.formatDrugInfo(result.results[0]);
      
      await this.logDrugLookup(ndcNumber, 'NDC', options.userId);
      
      return drugInfo;
      
    } catch (error) {
      console.error('NDC lookup error:', error);
      throw new Error(`Failed to lookup drug by NDC: ${error.message}`);
    }
  }

  /**
   * Check drug adverse events and safety information
   */
  async checkDrugSafety(drugName, options = {}) {
    await this.initialize();
    
    try {
      // Get recent adverse events
      const adverseEvents = await this.getAdverseEvents(drugName, options);
      
      // Check for recalls and enforcement actions
      const recalls = await this.getDrugRecalls(drugName, options);
      
      // Calculate safety score
      const safetyScore = this.calculateSafetyScore(adverseEvents, recalls);
      
      // Generate safety alerts if needed
      const alerts = this.generateSafetyAlerts(adverseEvents, recalls, safetyScore);
      
      const safetyInfo = {
        drugName: drugName,
        safetyScore: safetyScore,
        riskLevel: this.getRiskLevel(safetyScore),
        adverseEvents: {
          total: adverseEvents.length,
          recent: adverseEvents.filter(e => this.isRecent(e.receivedate, 30)).length,
          serious: adverseEvents.filter(e => e.serious === '1').length
        },
        recalls: {
          total: recalls.length,
          classI: recalls.filter(r => r.classification === 'Class I').length,
          recent: recalls.filter(r => this.isRecent(r.report_date, 90)).length
        },
        alerts: alerts,
        lastUpdated: new Date().toISOString()
      };
      
      await this.logSafetyCheck(drugName, safetyInfo, options.userId);
      
      return safetyInfo;
      
    } catch (error) {
      console.error('Drug safety check error:', error);
      throw new Error(`Failed to check drug safety: ${error.message}`);
    }
  }

  /**
   * Get adverse events for a drug
   */
  async getAdverseEvents(drugName, options = {}) {
    const searchParams = {
      search: `patient.drug.medicinalproduct:"${drugName}"`,
      limit: options.limit || 100,
      count: 'receivedate'
    };
    
    const result = await externalApiGateway.makeRequest(
      'openFDA',
      '/drug/event.json',
      searchParams,
      { userId: options.userId }
    );
    
    return result.results || [];
  }

  /**
   * Get drug recalls and enforcement actions
   */
  async getDrugRecalls(drugName, options = {}) {
    const searchParams = {
      search: `openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}"`,
      limit: options.limit || 50
    };
    
    const result = await externalApiGateway.makeRequest(
      'openFDA',
      '/drug/enforcement.json',
      searchParams,
      { userId: options.userId }
    );
    
    return result.results || [];
  }

  /**
   * Check drug interactions between multiple medications
   */
  async checkDrugInteractions(medications, options = {}) {
    await this.initialize();
    
    try {
      const interactions = [];
      const medications_clean = medications.map(med => med.toLowerCase().trim());
      
      // Check all pairs of medications
      for (let i = 0; i < medications_clean.length; i++) {
        for (let j = i + 1; j < medications_clean.length; j++) {
          const med1 = medications_clean[i];
          const med2 = medications_clean[j];
          
          // Check known interactions
          const interactionKey = `${med1}+${med2}`;
          const reverseKey = `${med2}+${med1}`;
          
          const interaction = this.knownInteractions.get(interactionKey) || 
                            this.knownInteractions.get(reverseKey);
          
          if (interaction) {
            interactions.push({
              drug1: medications[i],
              drug2: medications[j],
              severity: interaction.level,
              description: interaction.description,
              mechanism: interaction.mechanism,
              management: interaction.management,
              source: 'known_interactions'
            });
          }
          
          // TODO: Add AI-based interaction checking using drug properties
        }
      }
      
      // Sort by severity
      interactions.sort((a, b) => {
        const severityOrder = { 'MAJOR': 3, 'MODERATE': 2, 'MINOR': 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
      
      const result = {
        medications: medications,
        totalInteractions: interactions.length,
        majorInteractions: interactions.filter(i => i.severity === 'MAJOR').length,
        moderateInteractions: interactions.filter(i => i.severity === 'MODERATE').length,
        minorInteractions: interactions.filter(i => i.severity === 'MINOR').length,
        interactions: interactions,
        riskAssessment: this.assessInteractionRisk(interactions),
        checkedAt: new Date().toISOString()
      };
      
      await this.logInteractionCheck(medications, result, options.userId);
      
      return result;
      
    } catch (error) {
      console.error('Drug interaction check error:', error);
      throw new Error(`Failed to check drug interactions: ${error.message}`);
    }
  }

  /**
   * Validate prescription information
   */
  async validatePrescription(prescriptionData, options = {}) {
    await this.initialize();
    
    try {
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        drug: null,
        safety: null
      };
      
      // Validate NDC if provided
      if (prescriptionData.ndc) {
        try {
          validation.drug = await this.getDrugByNDC(prescriptionData.ndc, options);
        } catch (error) {
          validation.errors.push(`Invalid NDC number: ${prescriptionData.ndc}`);
          validation.isValid = false;
        }
      }
      
      // Validate drug name
      if (prescriptionData.drugName && !validation.drug) {
        const searchResult = await this.searchDrug(prescriptionData.drugName, { limit: 1, ...options });
        if (searchResult.drugs.length === 0) {
          validation.errors.push(`Drug not found: ${prescriptionData.drugName}`);
          validation.isValid = false;
        } else {
          validation.drug = searchResult.drugs[0];
        }
      }
      
      // Check drug safety
      if (validation.drug) {
        validation.safety = await this.checkDrugSafety(validation.drug.brandName || validation.drug.genericName, options);
        
        if (validation.safety.riskLevel === 'HIGH') {
          validation.warnings.push('High-risk medication - requires careful monitoring');
        }
        
        if (validation.safety.recalls.classI > 0) {
          validation.errors.push('Drug has active Class I recalls');
          validation.isValid = false;
        }
      }
      
      // Validate dosage format
      if (prescriptionData.dosage) {
        if (!this.validateDosage(prescriptionData.dosage)) {
          validation.errors.push('Invalid dosage format');
          validation.isValid = false;
        }
      }
      
      // Check interactions with existing medications
      if (prescriptionData.existingMedications && prescriptionData.drugName) {
        const allMeds = [...prescriptionData.existingMedications, prescriptionData.drugName];
        const interactions = await this.checkDrugInteractions(allMeds, options);
        
        if (interactions.majorInteractions > 0) {
          validation.errors.push(`${interactions.majorInteractions} major drug interactions detected`);
          validation.isValid = false;
        }
        
        if (interactions.moderateInteractions > 0) {
          validation.warnings.push(`${interactions.moderateInteractions} moderate drug interactions detected`);
        }
        
        validation.interactions = interactions;
      }
      
      await this.logPrescriptionValidation(prescriptionData, validation, options.userId);
      
      return validation;
      
    } catch (error) {
      console.error('Prescription validation error:', error);
      throw new Error(`Failed to validate prescription: ${error.message}`);
    }
  }

  /**
   * Format drug information from OpenFDA response
   */
  formatDrugInfo(fdaDrug) {
    return {
      id: fdaDrug.id,
      brandName: fdaDrug.openfda?.brand_name?.[0],
      genericName: fdaDrug.openfda?.generic_name?.[0],
      manufacturer: fdaDrug.openfda?.manufacturer_name?.[0],
      ndc: fdaDrug.openfda?.product_ndc?.[0],
      rxcui: fdaDrug.openfda?.rxcui?.[0],
      dosageForm: fdaDrug.dosage_form?.[0],
      route: fdaDrug.route?.[0],
      strength: fdaDrug.strength?.[0],
      indications: fdaDrug.indications_and_usage?.[0],
      contraindications: fdaDrug.contraindications?.[0],
      warnings: fdaDrug.warnings?.[0],
      adverseReactions: fdaDrug.adverse_reactions?.[0],
      dosageAndAdministration: fdaDrug.dosage_and_administration?.[0],
      drugInteractions: fdaDrug.drug_interactions?.[0],
      pregnancy: fdaDrug.pregnancy?.[0],
      pediatricUse: fdaDrug.pediatric_use?.[0],
      geriatricUse: fdaDrug.geriatric_use?.[0],
      overdosage: fdaDrug.overdosage?.[0],
      clinicalPharmacology: fdaDrug.clinical_pharmacology?.[0],
      version: fdaDrug.version,
      setId: fdaDrug.set_id
    };
  }

  /**
   * Validate and format NDC number
   */
  validateAndFormatNDC(ndc) {
    // Remove any hyphens or spaces
    const clean = ndc.replace(/[-\s]/g, '');
    
    // NDC should be 10 or 11 digits
    if (!/^\d{10,11}$/.test(clean)) {
      throw new Error('Invalid NDC format - must be 10 or 11 digits');
    }
    
    // Return clean NDC
    return clean;
  }

  /**
   * Calculate drug safety score
   */
  calculateSafetyScore(adverseEvents, recalls) {
    let score = 100; // Start with perfect score
    
    // Deduct for adverse events
    const recentEvents = adverseEvents.filter(e => this.isRecent(e.receivedate, 30)).length;
    score -= Math.min(recentEvents * 2, 30); // Max 30 points for adverse events
    
    // Deduct for recalls
    const classIRecalls = recalls.filter(r => r.classification === 'Class I').length;
    const classIIRecalls = recalls.filter(r => r.classification === 'Class II').length;
    
    score -= classIRecalls * 20; // 20 points per Class I recall
    score -= classIIRecalls * 10; // 10 points per Class II recall
    
    return Math.max(score, 0); // Never go below 0
  }

  /**
   * Get risk level based on safety score
   */
  getRiskLevel(score) {
    if (score >= 80) return 'LOW';
    if (score >= 60) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Generate safety alerts
   */
  generateSafetyAlerts(adverseEvents, recalls, safetyScore) {
    const alerts = [];
    
    if (safetyScore < 60) {
      alerts.push({
        type: 'HIGH_RISK',
        message: 'This medication has significant safety concerns',
        severity: 'HIGH'
      });
    }
    
    const classIRecalls = recalls.filter(r => r.classification === 'Class I');
    if (classIRecalls.length > 0) {
      alerts.push({
        type: 'CLASS_I_RECALL',
        message: `${classIRecalls.length} Class I recall(s) - may cause serious adverse health consequences`,
        severity: 'CRITICAL'
      });
    }
    
    const recentEvents = adverseEvents.filter(e => this.isRecent(e.receivedate, 30)).length;
    if (recentEvents > this.alertThresholds.adverseEvents) {
      alerts.push({
        type: 'FREQUENT_ADVERSE_EVENTS',
        message: `${recentEvents} adverse events reported in the last 30 days`,
        severity: 'MEDIUM'
      });
    }
    
    return alerts;
  }

  /**
   * Assess drug interaction risk
   */
  assessInteractionRisk(interactions) {
    const majorCount = interactions.filter(i => i.severity === 'MAJOR').length;
    const moderateCount = interactions.filter(i => i.severity === 'MODERATE').length;
    
    if (majorCount > 0) {
      return {
        level: 'HIGH',
        message: `${majorCount} major interaction(s) detected - immediate attention required`,
        recommendations: [
          'Consult with prescribing physician immediately',
          'Consider alternative medications',
          'Implement intensive monitoring protocol'
        ]
      };
    }
    
    if (moderateCount > 2) {
      return {
        level: 'MEDIUM', 
        message: `${moderateCount} moderate interactions detected - monitoring required`,
        recommendations: [
          'Monitor patient closely for adverse effects',
          'Consider dose adjustments',
          'Schedule follow-up within 1-2 weeks'
        ]
      };
    }
    
    return {
      level: 'LOW',
      message: 'No significant drug interactions detected',
      recommendations: ['Continue standard monitoring protocols']
    };
  }

  /**
   * Validate dosage format
   */
  validateDosage(dosage) {
    // Basic dosage format validation
    const dosagePattern = /^\d+(\.\d+)?\s*(mg|g|mcg|units?)\s*(per|\/)\s*(day|dose|hour|kg|m2)(\s*x\s*\d+\s*(days?|weeks?|months?))?$/i;
    return dosagePattern.test(dosage.trim());
  }

  /**
   * Check if date is within specified days
   */
  isRecent(dateString, days) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return date > cutoff;
  }

  /**
   * Load drug interactions from database
   */
  async loadDrugInteractions() {
    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      };
      
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const interactions = await SecureDataAccess.query(
        'drug_interactions',
        {},
        { limit: 1000 },
        context
      );
      
      for (const interaction of interactions) {
        const key = `${interaction.drug1.toLowerCase()}+${interaction.drug2.toLowerCase()}`;
        this.knownInteractions.set(key, {
          level: interaction.severity,
          description: interaction.description,
          mechanism: interaction.mechanism,
          management: interaction.management
        });
      }
      
      console.log(`✅ Loaded ${interactions.length} drug interactions`);
    } catch (error) {
      console.warn('⚠️ Could not load drug interactions from database:', error.message);
    }
  }

  /**
   * Start safety monitoring for critical alerts
   */
  startSafetyMonitoring() {
    // Check for new FDA alerts every hour
    setInterval(async () => {
      try {
        await this.checkForNewAlerts();
      } catch (error) {
        console.error('Safety monitoring error:', error);
      }
    }, 3600000); // 1 hour
  }

  /**
   * Check for new FDA safety alerts
   */
  async checkForNewAlerts() {
    try {
      // Get recent enforcement reports (recalls)
      const recentRecalls = await externalApiGateway.makeRequest(
        'openFDA',
        '/drug/enforcement.json',
        {
          search: 'report_date:[2024-01-01 TO 2025-12-31]',
          limit: 100
        }
      );
      
      // Process and alert on Class I recalls
      const classIRecalls = recentRecalls.results?.filter(r => r.classification === 'Class I') || [];
      
      for (const recall of classIRecalls) {
        await this.processSafetyAlert(recall);
      }
      
    } catch (error) {
      console.error('Failed to check for new alerts:', error);
    }
  }

  /**
   * Process safety alert
   */
  async processSafetyAlert(recall) {
    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      };
      
      await SecureDataAccess.insert('safety_alerts', {
        type: 'FDA_RECALL',
        severity: 'CRITICAL',
        productDescription: recall.product_description,
        reasonForRecall: recall.reason_for_recall,
        classification: recall.classification,
        distributionPattern: recall.distribution_pattern,
        recallInitiationDate: recall.recall_initiation_date,
        reportDate: recall.report_date,
        alertDate: new Date(),
        processed: false
      }, context);
      
    } catch (error) {
      console.error('Failed to process safety alert:', error);
    }
  }

  // ========== MEDICAL DEVICE APIS ==========

  /**
   * Search medical devices in FDA database
   */
  async searchMedicalDevices(query, options = {}) {
    await this.initialize();
    
    try {
      const limit = Math.min(options.limit || 20, 100);
      const searchQuery = `device_name:"${query}" OR brand_name:"${query}"`;
      
      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/device/510k.json',
        {
          search: searchQuery,
          limit: limit
        }
      );
      
      if (!response.results) {
        return { devices: [], total: 0, searchTerm: query };
      }
      
      const devices = response.results.map(device => ({
        deviceName: device.device_name,
        brandName: device.brand_name,
        applicant: device.applicant,
        kNumber: device.k_number,
        dateReceived: device.date_received,
        decisionDate: device.decision_date,
        deviceClass: device.device_class,
        productCode: device.product_code,
        medicalSpecialty: device.medical_specialty_description,
        deviceDescription: device.device_description,
        intendedUse: device.intended_use,
        regulationNumber: device.regulation_number,
        clearanceType: device.clearance_type
      }));
      
      await this.logDeviceSearch(query, devices.length, options.userId);
      
      return {
        devices: devices,
        total: response.meta?.results?.total || devices.length,
        searchTerm: query,
        searchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Medical device search error:', error);
      throw new Error(`Failed to search medical devices: ${error.message}`);
    }
  }

  /**
   * Get medical device recalls
   */
  async getDeviceRecalls(options = {}) {
    await this.initialize();
    
    try {
      const limit = Math.min(options.limit || 50, 100);
      const classification = options.classification; // 'Class I', 'Class II', 'Class III'
      const dateRange = options.dateFrom ? `[${options.dateFrom} TO ${options.dateTo || 'NOW'}]` : '[2020-01-01 TO NOW]';
      
      let searchQuery = `report_date:${dateRange}`;
      if (classification) {
        searchQuery += ` AND classification:"${classification}"`;
      }
      
      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/device/recall.json',
        {
          search: searchQuery,
          limit: limit,
          sort: 'report_date:desc'
        }
      );
      
      if (!response.results) {
        return { recalls: [], total: 0 };
      }
      
      const recalls = response.results.map(recall => ({
        productType: recall.product_type,
        productDescription: recall.product_description,
        manufacturer: recall.recalling_firm,
        classification: recall.classification,
        reasonForRecall: recall.reason_for_recall,
        recallInitiationDate: recall.recall_initiation_date,
        reportDate: recall.report_date,
        distributionPattern: recall.distribution_pattern,
        productQuantity: recall.product_quantity,
        eventId: recall.event_id,
        recallNumber: recall.recall_number,
        riskLevel: this.deviceClasses[recall.classification]?.risk || 'UNKNOWN',
        actionTaken: recall.action
      }));
      
      await this.logDeviceRecalls(recalls.length, classification, options.userId);
      
      return {
        recalls: recalls,
        total: response.meta?.results?.total || recalls.length,
        classification: classification,
        searchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Device recalls error:', error);
      throw new Error(`Failed to get device recalls: ${error.message}`);
    }
  }

  /**
   * Get device adverse events
   */
  async getDeviceAdverseEvents(deviceName, options = {}) {
    await this.initialize();
    
    try {
      const limit = Math.min(options.limit || 20, 100);
      const searchQuery = `device.brand_name:"${deviceName}" OR device.generic_name:"${deviceName}"`;
      
      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/device/event.json',
        {
          search: searchQuery,
          limit: limit,
          sort: 'date_received:desc'
        }
      );
      
      if (!response.results) {
        return { events: [], total: 0, deviceName };
      }
      
      const events = response.results.map(event => ({
        eventType: event.event_type,
        dateReceived: event.date_received,
        deviceInfo: {
          brandName: event.device?.[0]?.brand_name,
          genericName: event.device?.[0]?.generic_name,
          manufacturer: event.device?.[0]?.manufacturer_d_name,
          deviceClass: event.device?.[0]?.device_class
        },
        patientInfo: {
          age: event.patient?.[0]?.patient_age,
          sex: event.patient?.[0]?.patient_sex,
          weight: event.patient?.[0]?.patient_weight
        },
        adverseEventFlag: event.adverse_event_flag,
        eventDescription: event.mdr_text?.[0]?.text,
        reportNumber: event.mdr_report_key,
        reporterType: event.reporter_occupation_code,
        dateOfEvent: event.date_of_event
      }));
      
      await this.logDeviceEvents(deviceName, events.length, options.userId);
      
      return {
        events: events,
        total: response.meta?.results?.total || events.length,
        deviceName: deviceName,
        searchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Device adverse events error:', error);
      throw new Error(`Failed to get device adverse events: ${error.message}`);
    }
  }

  // ========== FOOD ENFORCEMENT APIS ==========

  /**
   * Get food enforcement reports (recalls)
   */
  async getFoodEnforcement(options = {}) {
    await this.initialize();
    
    try {
      const limit = Math.min(options.limit || 50, 100);
      const classification = options.classification; // 'Class I', 'Class II', 'Class III'
      const dateRange = options.dateFrom ? `[${options.dateFrom} TO ${options.dateTo || 'NOW'}]` : '[2020-01-01 TO NOW]';
      
      let searchQuery = `report_date:${dateRange}`;
      if (classification) {
        searchQuery += ` AND classification:"${classification}"`;
      }
      
      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/food/enforcement.json',
        {
          search: searchQuery,
          limit: limit,
          sort: 'report_date:desc'
        }
      );
      
      if (!response.results) {
        return { enforcements: [], total: 0 };
      }
      
      const enforcements = response.results.map(item => ({
        productDescription: item.product_description,
        recallingFirm: item.recalling_firm,
        classification: item.classification,
        reasonForRecall: item.reason_for_recall,
        recallInitiationDate: item.recall_initiation_date,
        reportDate: item.report_date,
        distributionPattern: item.distribution_pattern,
        productQuantity: item.product_quantity,
        eventId: item.event_id,
        recallNumber: item.recall_number,
        status: item.status,
        city: item.city,
        state: item.state,
        country: item.country,
        voluntaryMandated: item.voluntary_mandated,
        initialFirmNotification: item.initial_firm_notification
      }));
      
      await this.logFoodEnforcement(enforcements.length, classification, options.userId);
      
      return {
        enforcements: enforcements,
        total: response.meta?.results?.total || enforcements.length,
        classification: classification,
        searchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Food enforcement error:', error);
      throw new Error(`Failed to get food enforcement reports: ${error.message}`);
    }
  }

  /**
   * Search food products by keyword
   */
  async searchFoodProducts(query, options = {}) {
    await this.initialize();
    
    try {
      const limit = Math.min(options.limit || 20, 100);
      const searchQuery = `product_description:"${query}"`;
      
      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/food/enforcement.json',
        {
          search: searchQuery,
          limit: limit,
          sort: 'report_date:desc'
        }
      );
      
      if (!response.results) {
        return { products: [], total: 0, searchTerm: query };
      }
      
      // Extract unique products from enforcement records
      const productsMap = new Map();
      
      response.results.forEach(item => {
        const key = `${item.recalling_firm}-${item.product_description}`.toLowerCase();
        if (!productsMap.has(key)) {
          productsMap.set(key, {
            productDescription: item.product_description,
            manufacturer: item.recalling_firm,
            city: item.city,
            state: item.state,
            country: item.country,
            lastReportDate: item.report_date,
            totalRecalls: 1,
            classifications: [item.classification]
          });
        } else {
          const existing = productsMap.get(key);
          existing.totalRecalls++;
          if (!existing.classifications.includes(item.classification)) {
            existing.classifications.push(item.classification);
          }
        }
      });
      
      const products = Array.from(productsMap.values());
      
      await this.logFoodSearch(query, products.length, options.userId);
      
      return {
        products: products,
        total: products.length,
        searchTerm: query,
        searchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Food product search error:', error);
      throw new Error(`Failed to search food products: ${error.message}`);
    }
  }

  // ========== TOBACCO PRODUCT APIS ==========

  /**
   * Get tobacco product applications
   */
  async getTobaccoProducts(options = {}) {
    await this.initialize();
    
    try {
      const limit = Math.min(options.limit || 50, 100);
      const productType = options.productType; // 'Cigarette', 'Smokeless Tobacco', etc.
      
      let searchQuery = '*';
      if (productType) {
        searchQuery = `product_type:"${productType}"`;
      }
      
      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/tobacco/problem.json',
        {
          search: searchQuery,
          limit: limit
        }
      );
      
      if (!response.results) {
        return { products: [], total: 0 };
      }
      
      const products = response.results.map(item => ({
        productType: item.product_type,
        brandName: item.brand_name,
        manufacturer: item.manufacturer,
        problemDescription: item.problem_description,
        dateSubmitted: item.date_submitted,
        reportId: item.report_id,
        nonuser: item.nonuser
      }));
      
      await this.logTobaccoProducts(products.length, productType, options.userId);
      
      return {
        products: products,
        total: response.meta?.results?.total || products.length,
        productType: productType,
        searchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Tobacco products error:', error);
      throw new Error(`Failed to get tobacco products: ${error.message}`);
    }
  }

  // ========== COMPREHENSIVE FDA SEARCH ==========

  /**
   * Search across all FDA categories (drugs, devices, food, tobacco)
   */
  async searchAllFDACategories(query, options = {}) {
    await this.initialize();
    
    try {
      const results = {
        query: query,
        searchedAt: new Date().toISOString(),
        categories: {}
      };
      
      // Search drugs
      try {
        const drugs = await this.searchDrug(query, { limit: options.limit || 10 });
        results.categories.drugs = {
          found: drugs.drugs?.length || 0,
          data: drugs.drugs || []
        };
      } catch (error) {
        results.categories.drugs = { found: 0, error: error.message };
      }
      
      // Search devices
      try {
        const devices = await this.searchMedicalDevices(query, { limit: options.limit || 10 });
        results.categories.devices = {
          found: devices.devices?.length || 0,
          data: devices.devices || []
        };
      } catch (error) {
        results.categories.devices = { found: 0, error: error.message };
      }
      
      // Search food products
      try {
        const food = await this.searchFoodProducts(query, { limit: options.limit || 10 });
        results.categories.food = {
          found: food.products?.length || 0,
          data: food.products || []
        };
      } catch (error) {
        results.categories.food = { found: 0, error: error.message };
      }
      
      // Calculate totals
      results.totalFound = Object.values(results.categories).reduce((sum, cat) => sum + (cat.found || 0), 0);
      
      await this.logComprehensiveSearch(query, results.totalFound, options.userId);
      
      return results;
      
    } catch (error) {
      console.error('Comprehensive FDA search error:', error);
      throw new Error(`Failed to search all FDA categories: ${error.message}`);
    }
  }

  // Audit logging methods
  async logDrugSearch(query, resultCount, userId) {
    await this.auditLog('DRUG_SEARCH', { query, resultCount }, userId);
  }

  async logDrugLookup(identifier, type, userId) {
    await this.auditLog('DRUG_LOOKUP', { identifier, type }, userId);
  }

  async logSafetyCheck(drugName, safetyInfo, userId) {
    await this.auditLog('DRUG_SAFETY_CHECK', { drugName, safetyScore: safetyInfo.safetyScore }, userId);
  }

  async logInteractionCheck(medications, result, userId) {
    await this.auditLog('DRUG_INTERACTION_CHECK', { 
      medications, 
      totalInteractions: result.totalInteractions,
      majorInteractions: result.majorInteractions 
    }, userId);
  }

  async logPrescriptionValidation(prescriptionData, validation, userId) {
    await this.auditLog('PRESCRIPTION_VALIDATION', { 
      drugName: prescriptionData.drugName,
      isValid: validation.isValid,
      errorCount: validation.errors.length 
    }, userId);
  }

  // New audit logging methods for enhanced FDA APIs
  async logDeviceSearch(query, resultCount, userId) {
    await this.auditLog('DEVICE_SEARCH', { query, resultCount }, userId);
  }

  async logDeviceRecalls(resultCount, classification, userId) {
    await this.auditLog('DEVICE_RECALLS', { resultCount, classification }, userId);
  }

  async logDeviceEvents(deviceName, eventCount, userId) {
    await this.auditLog('DEVICE_ADVERSE_EVENTS', { deviceName, eventCount }, userId);
  }

  async logFoodEnforcement(resultCount, classification, userId) {
    await this.auditLog('FOOD_ENFORCEMENT', { resultCount, classification }, userId);
  }

  async logFoodSearch(query, resultCount, userId) {
    await this.auditLog('FOOD_SEARCH', { query, resultCount }, userId);
  }

  async logTobaccoProducts(resultCount, productType, userId) {
    await this.auditLog('TOBACCO_PRODUCTS', { resultCount, productType }, userId);
  }

  async logComprehensiveSearch(query, totalFound, userId) {
    await this.auditLog('COMPREHENSIVE_FDA_SEARCH', { query, totalFound }, userId);
  }

  async auditLog(action, details, userId) {
    try {
      const context = {
        serviceId: 'enhanced-fda-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      };
      
      await SecureDataAccess.insert('audit_logs', {
        action: action,
        resourceType: 'fda_information',
        userId: userId || 'system',
        details: details,
        timestamp: new Date()
      }, context);
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}

// Create and export singleton
const enhancedFDAInformationService = new EnhancedFDAInformationService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('drugInformationService', () => enhancedFDAInformationService);
  proxy.registerService('enhancedFDAInformationService', () => enhancedFDAInformationService);
}

module.exports = enhancedFDAInformationService;