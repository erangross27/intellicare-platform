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

const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const externalApiGateway = require('./externalApiGatewayService');
const productionKMS = require('./productionKMS');
const encryptionService = require('./encryptionService');
const clinicDatabaseManager = require('./practiceDatabaseManager');

class EnhancedFDAInformationService {
  constructor() {
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

    // MongoDB connection for drug interactions database
    this.drugDbClient = null;
    this.drugDb = null;
    this.MONGO_URI = process.env.MONGODB_ADMIN_URI || 'mongodb://localhost:27017/?authSource=admin';
    this.DRUG_DATABASE = 'intellicare_drug_data';
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('drug-information-service');

      // Initialize external API gateway
      await externalApiGateway.initialize();

      // Connect to drug interactions database
      await this.connectToDrugDatabase();

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
   * Connect to drug interactions database (intellicare_drug_data)
   */
  async connectToDrugDatabase() {
    try {
      this.drugDbClient = new MongoClient(this.MONGO_URI, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000
      });

      await this.drugDbClient.connect();
      this.drugDb = this.drugDbClient.db(this.DRUG_DATABASE);

      console.log(`✅ Connected to ${this.DRUG_DATABASE} database for drug interactions`);
    } catch (error) {
      console.error('❌ Failed to connect to drug database:', error);
      throw error;
    }
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
   * Note: openFDA API returns 404 when no results found (not empty array)
   */
  async getAdverseEvents(drugName, options = {}) {
    const searchParams = {
      search: `patient.drug.medicinalproduct:"${drugName}"`,
      limit: options.limit || 100,
      count: 'receivedate'
    };

    try {
      const result = await externalApiGateway.makeRequest(
        'openFDA',
        '/drug/event.json',
        searchParams,
        { userId: options.userId }
      );

      return result.results || [];
    } catch (error) {
      // openFDA returns 404 when no results found - this is normal, not an error
      if (error.message.includes('404') || error.message.includes('Request failed with status code 404')) {
        console.log(`ℹ️ No adverse events found for ${drugName} (openFDA returned 404 - normal for no results)`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Get drug recalls and enforcement actions
   * Note: openFDA API returns 404 when no results found (not empty array)
   */
  async getDrugRecalls(drugName, options = {}) {
    const searchParams = {
      search: `openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}"`,
      limit: options.limit || 50
    };

    try {
      const result = await externalApiGateway.makeRequest(
        'openFDA',
        '/drug/enforcement.json',
        searchParams,
        { userId: options.userId }
      );

      return result.results || [];
    } catch (error) {
      // openFDA returns 404 when no results found - this is normal, not an error
      if (error.message.includes('404') || error.message.includes('Request failed with status code 404')) {
        console.log(`ℹ️ No recalls/enforcement found for ${drugName} (openFDA returned 404 - normal for no results)`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Check drug interactions between multiple medications
   */
  async checkDrugInteractions(medications, options = {}) {
    await this.initialize();

    try {
      console.log(`\n   🔬 Drug Interaction Service - Checking ${medications.length} medications`);
      console.log(`      Medications: ${medications.join(', ')}`);

      const interactions = [];
      const medications_clean = medications.map(med => med.toLowerCase().trim());

      // Check all pairs of medications against FDA database
      let pairsChecked = 0;
      let selfInteractionsSkipped = 0;
      for (let i = 0; i < medications_clean.length; i++) {
        for (let j = i + 1; j < medications_clean.length; j++) {
          const med1 = medications_clean[i];
          const med2 = medications_clean[j];

          // FILTER OUT SELF-INTERACTIONS: Skip if same drug appears twice
          if (med1 === med2) {
            selfInteractionsSkipped++;
            console.log(`      🚫 Skipped self-interaction: ${med1} vs ${med2} (same drug)`);
            continue;
          }

          pairsChecked++;

          // Query FDA database with indexed fields (drugA + drugB)
          // Database has compound index on (drugA, drugB) for fast lookups
          const interaction = await this.drugDb.collection('drug_interactions').findOne({
            $or: [
              { drugA: med1, drugB: med2 },
              { drugA: med2, drugB: med1 }
            ]
          });

          if (interaction) {
            console.log(`      ⚠️  Pair #${pairsChecked}: ${med1} + ${med2} → ${interaction.severity.toUpperCase()} (FDA)`);
            interactions.push({
              drug1: medications[i],
              drug2: medications[j],
              severity: interaction.severity.toUpperCase(),
              description: interaction.description,
              source: 'FDA_OpenFDA',
              fda_verified: true
            });
          }
          // Only log interactions found, skip "no interaction" logs to reduce noise
        }
      }

      if (selfInteractionsSkipped > 0) {
        console.log(`      🚫 Skipped ${selfInteractionsSkipped} self-interaction(s) (duplicate medications)`);
      }

      console.log(`      📊 Total pairs checked: ${pairsChecked}`);
      console.log(`      📊 Interactions found: ${interactions.length}`);
      console.log(`      📚 Using LOCAL database (not OpenFDA API)`)
      
      // Sort by severity (contraindicated > major > moderate > minor)
      interactions.sort((a, b) => {
        const severityOrder = {
          'CONTRAINDICATED': 4,
          'MAJOR': 3,
          'MODERATE': 2,
          'MINOR': 1
        };
        const sevA = a.severity.toUpperCase();
        const sevB = b.severity.toUpperCase();
        return (severityOrder[sevB] || 0) - (severityOrder[sevA] || 0);
      });
      
      const result = {
        medications: medications,
        totalInteractions: interactions.length,
        contraindicated: interactions.filter(i => i.severity.toUpperCase() === 'CONTRAINDICATED').length,
        majorInteractions: interactions.filter(i => i.severity.toUpperCase() === 'MAJOR').length,
        moderateInteractions: interactions.filter(i => i.severity.toUpperCase() === 'MODERATE').length,
        minorInteractions: interactions.filter(i => i.severity.toUpperCase() === 'MINOR').length,
        interactions: interactions,
        riskAssessment: this.assessInteractionRisk(interactions),
        checkedAt: new Date().toISOString(),
        source: 'FDA OpenFDA Database (Local)',
        databaseRecords: 'intellicare_drug_data'
      };
      
      await this.logInteractionCheck(medications, result, options.userId, options.practiceId);

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
   * Check for new FDA safety alerts and match against patient medications
   */
  async checkForNewAlerts() {
    try {
      // December 2025: Using iRES API (real-time source) instead of openFDA (quarterly batches)
      // iRES is the SOURCE system for FDA recall data - 131k+ records with real-time updates
      console.log('🔄 Fetching recalls from FDA iRES (real-time source)...');

      const iresResult = await this.getRecentDrugRecallsFromIRES({
        days: 30,  // Last 30 days
        limit: 100
      });

      // iRES already filters Class I and II - just use the normalized recalls
      const significantRecalls = iresResult.recalls || [];

      console.log(`📋 Found ${significantRecalls.length} significant FDA recalls from iRES (total in DB: ${iresResult.totalCount})`);

      for (const recall of significantRecalls) {
        // Transform iRES format to match processSafetyAlert expectations
        const normalizedRecall = {
          recall_number: recall.recallNumber,
          product_description: recall.productDescription,
          reason_for_recall: recall.reason,
          classification: recall.classification,
          recalling_firm: recall.firmName,
          city: recall.firmCity,
          state: recall.firmState,
          country: recall.firmCountry,
          recall_initiation_date: recall.recallInitiationDate,
          center_classification_date: recall.classificationDate,
          termination_date: recall.terminationDate,
          distribution_pattern: recall.distributionPattern,
          product_quantity: recall.quantity,
          source: 'FDA_IRES'  // Mark source for tracking
        };
        await this.processSafetyAlert(normalizedRecall);
      }

      return {
        processed: significantRecalls.length,
        source: 'FDA_IRES',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // If iRES fails, fall back to openFDA
      console.warn('⚠️ iRES API failed, falling back to openFDA:', error.message);

      try {
        const recentRecalls = await externalApiGateway.makeRequest(
          'openFDA',
          '/drug/enforcement.json',
          {
            search: 'report_date:[20240101 TO 20251231]',
            limit: 100
          }
        );

        const significantRecalls = recentRecalls.results?.filter(
          r => r.classification === 'Class I' || r.classification === 'Class II'
        ) || [];

        console.log(`📋 Fallback: Found ${significantRecalls.length} recalls from openFDA`);

        for (const recall of significantRecalls) {
          await this.processSafetyAlert(recall);
        }

        return {
          processed: significantRecalls.length,
          source: 'openFDA_fallback',
          timestamp: new Date().toISOString()
        };

      } catch (fallbackError) {
        // openFDA returns 404 when no results found - this is normal
        if (fallbackError.message?.includes('404') || fallbackError.message?.includes('No matches found')) {
          console.log('ℹ️ No new FDA alerts found (openFDA returned 404 - normal for no results)');
          return { processed: 0, source: 'openFDA_fallback', timestamp: new Date().toISOString() };
        }
        console.error('Failed to check for new alerts (both iRES and openFDA failed):', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Get real-time recalls from FDA iRES (Enforcement Reports) API
   * This is the SOURCE system for recall data - more up-to-date than openFDA
   * iRES contains 131k+ recall records with real-time updates
   * Added: December 2025
   *
   * @param {Object} options - Query options
   * @param {string} options.centerCd - Filter by FDA center: CDER (drugs), CDRH (devices), CFSAN (food), CBER (biologics)
   * @param {string} options.classificationTypes - Filter by class: 1, 2, 3, NC
   * @param {string} options.dateFrom - Start date (MM/DD/YYYY)
   * @param {string} options.dateTo - End date (MM/DD/YYYY)
   * @param {number} options.rows - Number of results (default: 50, max: 1000)
   * @param {string} options.sort - Sort field (default: recallinitiationdt)
   * @param {string} options.sortorder - Sort order: asc or desc (default: desc)
   * @returns {Promise<Object>} - iRES recall results with RESULTCOUNT and RESULT array
   */
  async getRecallsFromIRES(options = {}) {
    try {
      const {
        centerCd = null, // CDER, CDRH, CFSAN, CBER
        classificationTypes = ['1', '2'], // Class I and II by default
        dateFrom = null,
        dateTo = null,
        rows = 50,
        sort = 'recallinitiationdt',
        sortorder = 'desc'
      } = options;

      // Build display columns (comprehensive recall data)
      const displayColumns = [
        'productid', 'recalleventid', 'recallnum',
        'producttypeshort', 'productdescriptiontxt', 'productshortreasontxt',
        'firmlegalnam', 'firmcitynam', 'firmstateprvncnam', 'firmcountrynam',
        'centercd', 'centerclassificationtypetxt', 'centerclassificationdt',
        'recallinitiationdt', 'terminationdt',
        'distributionareasummarytxt', 'productdistributedquantity',
        'postedinternetdt', 'eventlmd'
      ].join(',');

      // Build filter array
      const filters = [];

      // Date range filter
      if (dateFrom) {
        filters.push(`{'eventlmdfrom':'${dateFrom}'}`);
      }
      if (dateTo) {
        filters.push(`{'eventlmdto':'${dateTo}'}`);
      }

      // Classification type filter (Class I, II, III, NC)
      if (classificationTypes && classificationTypes.length > 0) {
        const classTypes = classificationTypes.map(c => `'${c}'`).join(',');
        filters.push(`{'centerclassificationtypetxt':[${classTypes}]}`);
      }

      // Center filter (CDER for drugs, CDRH for devices, etc.)
      if (centerCd) {
        const centers = Array.isArray(centerCd) ? centerCd : [centerCd];
        const centerList = centers.map(c => `'${c}'`).join(',');
        filters.push(`{'centercd':[${centerList}]}`);
      }

      // Build payload for iRES API
      const payload = {
        displaycolumns: displayColumns,
        filter: `[${filters.join(',')}]`,
        start: 1,
        rows: Math.min(rows, 1000), // Max 1000 per request
        sort: sort,
        sortorder: sortorder
      };

      // Call iRES API via gateway
      const result = await externalApiGateway.makeFdaPostRequest(
        'fdaIRES',
        '/iresapi/recalls/',
        payload,
        { skipCache: options.skipCache || false }
      );

      console.log(`✅ iRES returned ${result.RESULTCOUNT || 0} recalls`);
      return result;

    } catch (error) {
      console.error('Failed to fetch recalls from iRES:', error.message);
      throw error;
    }
  }

  /**
   * Get recent drug recalls from iRES (real-time) instead of openFDA
   * @param {Object} options - Query options
   * @param {number} options.days - Number of days to look back (default: 30)
   * @param {number} options.limit - Max results (default: 100)
   * @returns {Promise<Object[]>} - Array of normalized recall records
   */
  async getRecentDrugRecallsFromIRES(options = {}) {
    const { days = 30, limit = 100 } = options;

    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const formatDate = (d) => `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;

    const result = await this.getRecallsFromIRES({
      centerCd: 'CDER', // Drugs only
      classificationTypes: ['1', '2'], // Class I and II
      dateFrom: formatDate(fromDate),
      dateTo: formatDate(toDate),
      rows: limit,
      sort: 'recallinitiationdt',
      sortorder: 'desc'
    });

    // Normalize iRES response to match our internal format
    const recalls = (result.RESULT || []).map(r => ({
      recallNumber: r.RECALLNUM,
      productId: r.PRODUCTID,
      productDescription: r.PRODUCTDESCRIPTIONTXT,
      reason: r.PRODUCTSHORTREASONTXT,
      classification: `Class ${r.CENTERCLASSIFICATIONTYPETXT || 'Unknown'}`,
      classificationCode: r.CENTERCLASSIFICATIONTYPETXT,
      firmName: r.FIRMLEGALNAM,
      firmCity: r.FIRMCITYNAM,
      firmState: r.FIRMSTATEPRVNCNAM,
      firmCountry: r.FIRMCOUNTRYNAM,
      centerCode: r.CENTERCD,
      recallInitiationDate: r.RECALLINITIATIONDT,
      classificationDate: r.CENTERCLASSIFICATIONDT,
      terminationDate: r.TERMINATIONDT,
      distributionPattern: r.DISTRIBUTIONAREASUMMARYTXT,
      quantity: r.PRODUCTDISTRIBUTEDQUANTITY,
      postedDate: r.POSTEDINTERNETDT,
      lastModified: r.EVENTLMD,
      source: 'FDA_IRES'
    }));

    return {
      totalCount: result.RESULTCOUNT || 0,
      recalls: recalls,
      source: 'FDA_IRES',
      queriedAt: new Date().toISOString()
    };
  }

  /**
   * Extract drug names from FDA recall product description
   * @param {string} productDescription - FDA recall product description
   * @returns {string[]} - Array of extracted drug names
   */
  extractDrugNamesFromRecall(productDescription) {
    if (!productDescription) return [];

    const drugNames = [];
    const description = productDescription.toLowerCase();

    // Common patterns in FDA recalls:
    // "Levothyroxine Sodium Tablets, USP, 50 mcg"
    // "Metformin Hydrochloride Extended-Release Tablets, 500 mg"
    // "LISINOPRIL TABLETS USP, 10 MG, 20 MG"

    // Extract the primary drug name (usually first word or words before dosage/form)
    const patterns = [
      // Match drug name before common suffixes
      /^([a-z]+(?:\s+[a-z]+)?)\s+(?:tablets?|capsules?|injection|solution|syrup|cream|ointment|gel|patch|inhaler)/i,
      // Match drug name with salt form
      /^([a-z]+(?:\s+(?:sodium|hydrochloride|hcl|sulfate|acetate|citrate|maleate|besylate|fumarate|succinate|tartrate))?)/i,
      // Match brand name patterns (capitalized)
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
    ];

    for (const pattern of patterns) {
      const match = productDescription.match(pattern);
      if (match && match[1]) {
        const drugName = match[1].trim().toLowerCase();
        if (drugName.length > 2 && !drugNames.includes(drugName)) {
          drugNames.push(drugName);
        }
      }
    }

    // Also extract any words that look like drug names (no numbers, reasonable length)
    const words = productDescription.split(/[\s,;]+/);
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (cleanWord.length >= 4 && cleanWord.length <= 30 &&
          !['tablets', 'capsules', 'injection', 'solution', 'extended', 'release', 'delayed', 'immediate'].includes(cleanWord)) {
        if (!drugNames.includes(cleanWord)) {
          drugNames.push(cleanWord);
          break; // Usually first significant word is the drug name
        }
      }
    }

    return drugNames;
  }

  /**
   * Normalize drug name for consistent matching
   * Removes salts, formulations, and converts to lowercase
   * @param {string} drugName - Original drug name
   * @returns {string} - Normalized drug name
   */
  normalizeDrugName(drugName) {
    if (!drugName) return '';
    return drugName
      .toLowerCase()
      .trim()
      // Remove common salt forms
      .replace(/\s+(sodium|hydrochloride|hcl|sulfate|acetate|citrate|maleate|tartrate|succinate|fumarate|besylate|mesylate|potassium|calcium)\b/gi, '')
      // Remove formulation types
      .replace(/\s+(tablets?|capsules?|solution|injection|suspension|syrup|cream|ointment|gel|patch|inhaler|spray)\b/gi, '')
      // Remove strength indicators
      .replace(/\s*\d+\s*(mg|mcg|ml|g|%|iu)\b/gi, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find patients affected by a recall - PRODUCTION OPTIMIZED
   * Uses aggregation pipelines, batch processing, and indexed queries
   * Designed for millions of patients across multiple practices
   *
   * @param {string[]} recalledDrugNames - Array of drug names from the recall
   * @param {Object} options - Processing options
   * @param {number} options.batchSize - Number of patients to process per batch (default: 1000)
   * @param {Function} options.onProgress - Progress callback (processed, total, practice)
   * @param {boolean} options.useNormalizedNames - Use normalized drug names for exact matching
   * @returns {Promise<Object[]>} - Array of affected patients with their medication details
   */
  async findAffectedPatients(recalledDrugNames, options = {}) {
    if (!recalledDrugNames || recalledDrugNames.length === 0) {
      return [];
    }

    const {
      batchSize = 1000,
      onProgress = null,
      useNormalizedNames = true
    } = options;

    const startTime = Date.now();
    console.log(`[FDA Recall] Starting patient search for ${recalledDrugNames.length} drug names`);

    try {
      // Normalize drug names for consistent matching
      const normalizedDrugNames = useNormalizedNames
        ? recalledDrugNames.map(name => this.normalizeDrugName(name))
        : recalledDrugNames;

      // Also keep original names for regex fallback
      const originalLowerNames = recalledDrugNames.map(name => name.toLowerCase().trim());

      // Get all practice databases
      let practices = [];
      try {
        if (!clinicDatabaseManager.isInitialized) {
          await clinicDatabaseManager.initialize();
        }
        practices = await clinicDatabaseManager.getAllClinicDatabases();
        console.log(`[FDA Recall] Found ${practices.length} practice databases to query`);
      } catch (dbError) {
        console.error('[FDA Recall] Error getting practice databases:', dbError.message);
        return [];
      }

      const allResults = [];
      let totalMedicationsFound = 0;
      let totalPatientsFound = 0;

      // Process practices in parallel (up to 5 concurrent)
      const CONCURRENT_PRACTICES = 5;
      for (let i = 0; i < practices.length; i += CONCURRENT_PRACTICES) {
        const practicesBatch = practices.slice(i, i + CONCURRENT_PRACTICES);

        const batchResults = await Promise.all(
          practicesBatch.map(practice =>
            this._findAffectedPatientsInPractice(
              practice,
              normalizedDrugNames,
              originalLowerNames,
              batchSize,
              onProgress
            )
          )
        );

        for (const result of batchResults) {
          if (result.patients.length > 0) {
            allResults.push(...result.patients);
            totalMedicationsFound += result.medicationsCount;
            totalPatientsFound += result.patients.length;
          }
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`[FDA Recall] Completed in ${elapsed}ms: ${totalPatientsFound} patients, ${totalMedicationsFound} medications across ${practices.length} practices`);

      return allResults;

    } catch (error) {
      console.error('Error finding affected patients:', error);
      return [];
    }
  }

  /**
   * Find affected patients in a single practice using aggregation pipeline
   * @private
   */
  async _findAffectedPatientsInPractice(practice, normalizedDrugNames, originalLowerNames, batchSize, onProgress) {
    const context = {
      serviceId: 'drug-information-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: practice.subdomain
    };

    console.log(`[FDA Recall] Querying practice: ${practice.subdomain} (${practice.name})`);

    try {
      // Build optimized query conditions
      // Use $in for exact matches (uses index) + $regex for fuzzy (fallback)
      const orConditions = [];

      // Exact match on normalized names (fast, uses index)
      if (normalizedDrugNames.length > 0) {
        orConditions.push({ normalizedDrugName: { $in: normalizedDrugNames } });
      }

      // Case-insensitive regex match on original names (slower but catches variations)
      for (const name of originalLowerNames) {
        // Use anchored regex for better performance
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        orConditions.push({ name: { $regex: new RegExp(escapedName, 'i') } });
        orConditions.push({ genericName: { $regex: new RegExp(escapedName, 'i') } });
      }

      // Use aggregation pipeline for efficient patient grouping
      const pipeline = [
        // Stage 1: Match active medications with drug names
        {
          $match: {
            $or: orConditions,
            active: true,
            status: 'active'
          }
        },
        // Stage 2: Group by patient to avoid N+1 queries
        {
          $group: {
            _id: '$patientId',
            medications: {
              $push: {
                medicationId: { $toString: '$_id' },
                name: '$name',
                genericName: '$genericName',
                dosage: '$dosage',
                frequency: '$frequency',
                prescriber: '$prescriber'
              }
            },
            medicationCount: { $sum: 1 }
          }
        },
        // Stage 3: Lookup patient details in same query (no N+1)
        {
          $lookup: {
            from: 'patients',
            localField: '_id',
            foreignField: '_id',
            as: 'patientInfo'
          }
        },
        // Stage 4: Unwind patient info
        {
          $unwind: {
            path: '$patientInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        // Stage 5: Lookup provider from patient_provider collection (most recent encounter)
        {
          $lookup: {
            from: 'patient_provider',
            let: { patId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$patientId', '$$patId'] } } },
              { $sort: { date: -1 } },
              { $limit: 1 },
              { $project: { provider: 1, providerRole: 1 } }
            ],
            as: 'providerInfo'
          }
        },
        // Stage 6: Unwind provider info
        {
          $unwind: {
            path: '$providerInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        // Stage 7: Project final shape with provider
        {
          $project: {
            _id: 0,
            patientId: { $toString: '$_id' },
            patientName: {
              $cond: {
                if: { $and: ['$patientInfo.firstName', '$patientInfo.lastName'] },
                then: { $concat: ['$patientInfo.firstName', ' ', '$patientInfo.lastName'] },
                else: {
                  $cond: {
                    if: '$patientInfo.firstName',
                    then: '$patientInfo.firstName',
                    else: {
                      $cond: {
                        if: '$patientInfo.lastName',
                        then: '$patientInfo.lastName',
                        else: 'Unknown Patient'
                      }
                    }
                  }
                }
              }
            },
            assignedProvider: { $ifNull: ['$providerInfo.provider', null] },
            providerRole: { $ifNull: ['$providerInfo.providerRole', null] },
            practiceSubdomain: { $literal: practice.subdomain },
            practiceName: { $literal: practice.name },
            affectedMedications: '$medications',
            medicationCount: 1
          }
        }
      ];

      // Execute aggregation through SecureDataAccess
      const results = await SecureDataAccess.aggregate('medications', pipeline, context);

      const medicationsCount = results.reduce((sum, r) => sum + (r.medicationCount || 0), 0);

      if (results.length > 0) {
        console.log(`[FDA Recall] Found ${results.length} affected patients (${medicationsCount} medications) in ${practice.subdomain}`);
      }

      // Call progress callback if provided
      if (onProgress) {
        onProgress(results.length, medicationsCount, practice.subdomain);
      }

      return {
        patients: results,
        medicationsCount: medicationsCount
      };

    } catch (error) {
      console.error(`[FDA Recall] Error querying practice ${practice.subdomain}:`, error.message);
      return { patients: [], medicationsCount: 0 };
    }
  }

  /**
   * Process FDA recall as a background job
   * Suitable for large-scale processing without blocking
   *
   * @param {Object} recall - FDA recall data
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Job status with results
   */
  async processRecallAsBackgroundJob(recall, options = {}) {
    const jobId = `recall_${recall.recall_number || Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    console.log(`[FDA Recall Job ${jobId}] Starting background processing`);

    const context = {
      serviceId: 'drug-information-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: 'global'
    };

    // Create job tracking record
    const jobRecord = {
      jobId,
      type: 'FDA_RECALL_PROCESSING',
      status: 'running',
      recallNumber: recall.recall_number,
      productDescription: recall.product_description,
      classification: recall.classification,
      startedAt: new Date(),
      progress: {
        practicesProcessed: 0,
        totalPractices: 0,
        patientsFound: 0,
        medicationsMatched: 0
      }
    };

    try {
      // Store job record
      await SecureDataAccess.insert('recall_processing_jobs', jobRecord, context);

      // Extract drug names
      const drugNames = this.extractDrugNamesFromRecall(recall.product_description);

      if (drugNames.length === 0) {
        jobRecord.status = 'completed';
        jobRecord.completedAt = new Date();
        jobRecord.result = { message: 'No drug names extracted from recall' };
        await SecureDataAccess.update('recall_processing_jobs',
          { jobId },
          { $set: jobRecord },
          context
        );
        return jobRecord;
      }

      // Find affected patients with progress tracking
      const affectedPatients = await this.findAffectedPatients(drugNames, {
        batchSize: options.batchSize || 1000,
        onProgress: async (patients, medications, practice) => {
          // Update job progress
          jobRecord.progress.practicesProcessed++;
          jobRecord.progress.patientsFound += patients;
          jobRecord.progress.medicationsMatched += medications;

          await SecureDataAccess.update('recall_processing_jobs',
            { jobId },
            { $set: { progress: jobRecord.progress, lastUpdated: new Date() } },
            context
          );
        }
      });

      // Create patient alerts in batches
      const ALERT_BATCH_SIZE = 100;
      let alertsCreated = 0;

      for (let i = 0; i < affectedPatients.length; i += ALERT_BATCH_SIZE) {
        const batch = affectedPatients.slice(i, i + ALERT_BATCH_SIZE);

        const alertDocs = batch.map(patient => ({
          type: 'PATIENT_RECALL_ALERT',
          recallNumber: recall.recall_number,
          classification: recall.classification,
          severity: recall.classification === 'Class I' ? 'CRITICAL' : 'HIGH',
          patientId: patient.patientId,
          patientName: patient.patientName,
          practiceSubdomain: patient.practiceSubdomain,
          practiceName: patient.practiceName,
          affectedMedications: patient.affectedMedications,
          productDescription: recall.product_description,
          reasonForRecall: recall.reason_for_recall,
          status: 'pending',
          createdAt: new Date(),
          acknowledgedAt: null,
          acknowledgedBy: null
        }));

        // Insert batch
        const practiceContext = {
          ...context,
          practiceId: batch[0].practiceSubdomain
        };

        try {
          await SecureDataAccess.insert('patient_recall_alerts', alertDocs, practiceContext);
          alertsCreated += alertDocs.length;
        } catch (insertError) {
          console.error(`[FDA Recall Job ${jobId}] Error inserting alerts batch:`, insertError.message);
        }
      }

      // Complete job
      const elapsed = Date.now() - startTime;
      jobRecord.status = 'completed';
      jobRecord.completedAt = new Date();
      jobRecord.durationMs = elapsed;
      jobRecord.result = {
        patientsAffected: affectedPatients.length,
        alertsCreated,
        drugNamesSearched: drugNames
      };

      await SecureDataAccess.update('recall_processing_jobs',
        { jobId },
        { $set: jobRecord },
        context
      );

      console.log(`[FDA Recall Job ${jobId}] Completed in ${elapsed}ms: ${affectedPatients.length} patients, ${alertsCreated} alerts`);

      return jobRecord;

    } catch (error) {
      // Mark job as failed
      jobRecord.status = 'failed';
      jobRecord.completedAt = new Date();
      jobRecord.error = error.message;

      try {
        await SecureDataAccess.update('recall_processing_jobs',
          { jobId },
          { $set: jobRecord },
          context
        );
      } catch (updateError) {
        console.error(`[FDA Recall Job ${jobId}] Failed to update job status:`, updateError.message);
      }

      console.error(`[FDA Recall Job ${jobId}] Failed:`, error.message);
      throw error;
    }
  }

  /**
   * Process safety alert - now with patient matching
   * @param {Object} recall - FDA recall data
   */
  async processSafetyAlert(recall) {
    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      };

      // Check if we already processed this recall (by recall_number or product_description hash)
      const recallId = recall.recall_number ||
        crypto.createHash('md5').update(recall.product_description || '').digest('hex');

      const existingAlerts = await SecureDataAccess.query('safety_alerts', {
        recallId: recallId
      }, {}, context);

      if (existingAlerts && existingAlerts.length > 0) {
        // UPDATE existing record with lastChecked timestamp and any new data from FDA
        const existingAlert = existingAlerts[0];
        const updateData = {
          lastChecked: new Date(),
          lastCheckedSource: recall.source || 'FDA_IRES',
          // Update fields that might have changed in FDA
          reasonForRecall: recall.reason_for_recall || existingAlert.reasonForRecall,
          distributionPattern: recall.distribution_pattern || existingAlert.distributionPattern,
          productQuantity: recall.product_quantity || existingAlert.productQuantity,
          terminationDate: recall.termination_date || existingAlert.terminationDate
        };

        await SecureDataAccess.update('safety_alerts',
          { recallId: recallId },
          { $set: updateData },
          context
        );
        console.log(`🔄 Recall ${recallId} updated with lastChecked: ${updateData.lastChecked.toISOString()}`);
        return { action: 'updated', recallId };
      }

      // Extract drug names from recall
      const recalledDrugNames = this.extractDrugNamesFromRecall(recall.product_description);
      console.log(`🔍 Extracted drug names from recall: ${recalledDrugNames.join(', ') || 'none found'}`);

      // Find affected patients
      const affectedPatients = await this.findAffectedPatients(recalledDrugNames);
      const hasAffectedPatients = affectedPatients.length > 0;

      console.log(`${hasAffectedPatients ? '⚠️' : '✅'} Recall ${recallId}: ${affectedPatients.length} patients affected`);

      // Determine severity based on classification and affected patients
      let severity = 'INFO';
      if (recall.classification === 'Class I') {
        severity = hasAffectedPatients ? 'CRITICAL' : 'HIGH';
      } else if (recall.classification === 'Class II') {
        severity = hasAffectedPatients ? 'HIGH' : 'MODERATE';
      }

      // Create the main recall alert
      const alertData = {
        type: 'FDA_RECALL',
        recallId: recallId,
        severity: severity,
        classification: recall.classification,
        productDescription: recall.product_description,
        reasonForRecall: recall.reason_for_recall,
        recallingFirm: recall.recalling_firm,
        distributionPattern: recall.distribution_pattern,
        recallInitiationDate: recall.recall_initiation_date,
        reportDate: recall.report_date,
        city: recall.city,
        state: recall.state,
        country: recall.country,
        voluntaryMandated: recall.voluntary_mandated,
        productQuantity: recall.product_quantity,
        codeInfo: recall.code_info,
        extractedDrugNames: recalledDrugNames,
        affectedPatientCount: affectedPatients.length,
        affectedPatients: affectedPatients,
        alertDate: new Date(),
        processed: false,
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        actionsTaken: []
      };

      await SecureDataAccess.insert('safety_alerts', alertData, context);

      // If patients are affected, create individual patient alerts for provider notification
      // Patient alerts go to the PRACTICE database, not global
      if (hasAffectedPatients) {
        for (const patient of affectedPatients) {
          // Use the patient's practice subdomain for the context
          // CRITICAL: practiceId determines which database the alert goes to
          const patientContext = {
            serviceId: 'drug-information-service',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: patient.practiceSubdomain,
            practiceSubdomain: patient.practiceSubdomain
          };

          console.log(`📍 [FDA Recall] Creating patient_recall_alert for ${patient.patientName} in practice: ${patient.practiceSubdomain}`);

          await SecureDataAccess.insert('patient_recall_alerts', {
            type: 'FDA_RECALL_PATIENT_NOTIFICATION',
            recallId: recallId,
            patientId: patient.patientId,
            patientName: patient.patientName,
            practiceSubdomain: patient.practiceSubdomain,
            practiceName: patient.practiceName,
            severity: severity,
            classification: recall.classification,
            productDescription: recall.product_description,
            reasonForRecall: recall.reason_for_recall,
            affectedMedications: patient.affectedMedications,
            recallingFirm: recall.recalling_firm,
            alertDate: new Date(),
            reviewed: false,
            reviewedBy: null,
            reviewedAt: null,
            actionTaken: null,
            notes: null
          }, patientContext);
        }

        console.log(`📨 Created ${affectedPatients.length} patient-specific recall alerts`);
      }

    } catch (error) {
      console.error('Failed to process safety alert:', error);
    }
  }

  /**
   * Get pending recall alerts for provider review
   * @param {Object} options - Filter options
   * @returns {Promise<Object[]>} - Array of pending alerts
   */
  async getPendingRecallAlerts(options = {}) {
    await this.initialize();

    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: options.practiceId || 'global'
      };

      const filter = {
        type: 'FDA_RECALL',
        acknowledged: false
      };

      if (options.severity) {
        filter.severity = options.severity;
      }

      if (options.hasAffectedPatients) {
        filter.affectedPatientCount = { $gt: 0 };
      }

      const alerts = await SecureDataAccess.query('safety_alerts', filter, {}, context);

      // Sort by severity and date
      const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MODERATE': 2, 'INFO': 3 };
      alerts.sort((a, b) => {
        const severityDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.alertDate) - new Date(a.alertDate);
      });

      return alerts;

    } catch (error) {
      console.error('Failed to get pending recall alerts:', error);
      throw error;
    }
  }

  /**
   * Get patient-specific recall alerts for a patient or provider
   * @param {Object} options - Filter options
   * @returns {Promise<Object[]>} - Array of patient alerts
   */
  async getPatientRecallAlerts(options = {}) {
    await this.initialize();

    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: options.practiceId || 'global'
      };

      const filter = {
        type: 'FDA_RECALL_PATIENT_NOTIFICATION'
      };

      if (options.patientId) {
        filter.patientId = options.patientId;
      }

      if (options.unreviewed) {
        filter.reviewed = false;
      }

      const alerts = await SecureDataAccess.query('patient_recall_alerts', filter, {}, context);

      // Sort by severity and date
      const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MODERATE': 2, 'INFO': 3 };
      alerts.sort((a, b) => {
        const severityDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.alertDate) - new Date(a.alertDate);
      });

      return alerts;

    } catch (error) {
      console.error('Failed to get patient recall alerts:', error);
      throw error;
    }
  }

  /**
   * Get recall alerts for a specific provider's patients
   * Only returns alerts where the provider is assigned to the patient
   * @param {Object} options - Filter options
   * @param {string} options.providerName - Provider's full name
   * @param {string} options.providerEmail - Provider's email
   * @param {string} options.userId - Provider's user ID
   * @param {string} options.practiceSubdomain - Practice subdomain
   * @returns {Promise<Array>} - Filtered alerts for provider's patients
   */
  async getProviderRecallAlerts(options = {}) {
    await this.initialize();

    const { providerName, providerEmail, userId, practiceSubdomain = 'yale' } = options;

    console.log(`[FDA Recall] Getting provider-specific alerts for: ${providerName || providerEmail || userId}`);

    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceSubdomain
      };

      // Step 1: Get all patient_recall_alerts
      const allAlerts = await SecureDataAccess.query('patient_recall_alerts', {
        type: 'FDA_RECALL_PATIENT_NOTIFICATION'
      }, {}, context);

      if (!allAlerts || allAlerts.length === 0) {
        console.log('[FDA Recall] No patient recall alerts found');
        return [];
      }

      console.log(`[FDA Recall] Found ${allAlerts.length} total patient recall alerts`);

      // Step 2: Get provider-patient relationships
      // We need to find patients where this provider is the assigned provider
      const providerPatients = await SecureDataAccess.query('patient_provider', {}, {
        projection: { patientId: 1, provider: 1 }
      }, context);

      // Build a set of patient IDs assigned to this provider
      // Normalize provider identifiers for matching
      const searchEmail = (providerEmail || providerName || '').toLowerCase();
      const searchName = (providerName || '').toLowerCase();
      
      // Extract username from email (e.g., "eran" from "eran@gross.support")
      const emailUsername = searchEmail.includes('@') ? searchEmail.split('@')[0] : '';
      
      console.log(`[FDA Recall] Searching for provider matches: email="${searchEmail}", name="${searchName}", username="${emailUsername}"`);
      
      const myPatientIds = new Set();
      for (const pp of providerPatients) {
        const providerStr = String(pp.provider || '').toLowerCase();
        
        // Match by: exact email, email contains, name contains, or username matches
        const emailMatch = searchEmail && (providerStr === searchEmail || providerStr.includes(searchEmail));
        const nameMatch = searchName && providerStr.includes(searchName);
        const usernameMatch = emailUsername && providerStr.includes(emailUsername);
        
        // Also check if the stored provider field contains an email that matches
        const providerHasEmail = providerStr.includes('@');
        const providerEmailMatch = providerHasEmail && searchEmail && providerStr.includes(searchEmail);

        if (emailMatch || nameMatch || usernameMatch || providerEmailMatch) {
          myPatientIds.add(String(pp.patientId));
          if (process.env.DEBUG_RECALLS === 'true') {
            console.log(`[FDA Recall] Matched patient ${pp.patientId} with provider "${pp.provider}"`);
          }
        }
      }

      console.log(`[FDA Recall] Provider has ${myPatientIds.size} assigned patients`);

      // Step 3: Filter alerts to only include this provider's patients
      const filteredAlerts = allAlerts.filter(alert => {
        const alertPatientId = String(alert.patientId);
        return myPatientIds.has(alertPatientId);
      });

      console.log(`[FDA Recall] ${filteredAlerts.length} alerts for this provider's patients`);

      // Step 4: Enrich with patient and medication info
      const enrichedAlerts = [];
      for (const alert of filteredAlerts) {
        // Get patient info
        let patientName = alert.patientName || 'Unknown Patient';
        if (!alert.patientName && alert.patientId) {
          try {
            const patients = await SecureDataAccess.query('patients', {
              _id: alert.patientId
            }, {
              projection: { firstName: 1, lastName: 1 }
            }, context);
            if (patients.length > 0) {
              const p = patients[0];
              patientName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown Patient';
            }
          } catch (e) { /* ignore */ }
        }

        // Extract medication info from affectedMedications array
        const firstMed = alert.affectedMedications?.[0];
        const medicationName = alert.medicationName || alert.drugName || firstMed?.name || 'Unknown';
        const medicationDosage = firstMed?.dosage || '';

        enrichedAlerts.push({
          _id: alert._id,
          patientId: alert.patientId ? String(alert.patientId) : null,
          patientName: patientName,
          medicationName: medicationName,
          medicationDosage: medicationDosage,
          affectedMedications: alert.affectedMedications || [],
          recallReason: alert.recallReason || alert.reasonForRecall || alert.reason,
          severity: alert.severity || 'HIGH',
          classification: alert.classification || alert.recallClass || 'Class II',
          alertDate: alert.alertDate || alert.createdAt,
          reviewed: alert.reviewed || false,
          acknowledged: alert.acknowledged || false,
          productDescription: alert.productDescription,
          recallId: alert.recallId,
          recallingFirm: alert.recallingFirm
        });
      }

      // Sort by severity and date
      const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MODERATE': 2, 'INFO': 3 };
      enrichedAlerts.sort((a, b) => {
        const severityDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.alertDate) - new Date(a.alertDate);
      });

      return enrichedAlerts;

    } catch (error) {
      console.error('Failed to get provider recall alerts:', error);
      throw error;
    }
  }

  /**
   * Acknowledge a recall alert (mark as reviewed by provider)
   * @param {string} alertId - Alert ID to acknowledge
   * @param {Object} acknowledgement - Acknowledgement details
   */
  async acknowledgeRecallAlert(alertId, acknowledgement = {}) {
    await this.initialize();

    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: acknowledgement.practiceId || 'global'
      };

      await SecureDataAccess.update('safety_alerts',
        { _id: alertId },
        {
          $set: {
            acknowledged: true,
            acknowledgedBy: acknowledgement.providerId || acknowledgement.userId,
            acknowledgedAt: new Date(),
            actionsTaken: acknowledgement.actionsTaken || []
          }
        },
        context
      );

      console.log(`✅ Recall alert ${alertId} acknowledged`);

    } catch (error) {
      console.error('Failed to acknowledge recall alert:', error);
      throw error;
    }
  }

  /**
   * Review a patient-specific recall alert
   * @param {string} alertId - Patient alert ID
   * @param {Object} review - Review details
   */
  async reviewPatientRecallAlert(alertId, review = {}) {
    await this.initialize();

    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: review.practiceId || 'global'
      };

      await SecureDataAccess.update('patient_recall_alerts',
        { _id: alertId },
        {
          $set: {
            reviewed: true,
            reviewedBy: review.providerId || review.userId,
            reviewedAt: new Date(),
            actionTaken: review.actionTaken,
            notes: review.notes
          }
        },
        context
      );

      console.log(`✅ Patient recall alert ${alertId} reviewed`);

    } catch (error) {
      console.error('Failed to review patient recall alert:', error);
      throw error;
    }
  }

  /**
   * Get recall alert statistics
   * @returns {Promise<Object>} - Statistics object
   */
  async getRecallAlertStats() {
    await this.initialize();

    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      };

      const [allAlerts, patientAlerts] = await Promise.all([
        SecureDataAccess.query('safety_alerts', { type: 'FDA_RECALL' }, {}, context),
        SecureDataAccess.query('patient_recall_alerts', { type: 'FDA_RECALL_PATIENT_NOTIFICATION' }, {}, context)
      ]);

      const stats = {
        totalRecalls: allAlerts.length,
        unacknowledgedRecalls: allAlerts.filter(a => !a.acknowledged).length,
        recallsWithAffectedPatients: allAlerts.filter(a => a.affectedPatientCount > 0).length,
        totalPatientAlerts: patientAlerts.length,
        unreviewedPatientAlerts: patientAlerts.filter(a => !a.reviewed).length,
        bySeverity: {
          critical: allAlerts.filter(a => a.severity === 'CRITICAL').length,
          high: allAlerts.filter(a => a.severity === 'HIGH').length,
          moderate: allAlerts.filter(a => a.severity === 'MODERATE').length,
          info: allAlerts.filter(a => a.severity === 'INFO').length
        },
        byClassification: {
          classI: allAlerts.filter(a => a.classification === 'Class I').length,
          classII: allAlerts.filter(a => a.classification === 'Class II').length,
          classIII: allAlerts.filter(a => a.classification === 'Class III').length
        }
      };

      return stats;

    } catch (error) {
      console.error('Failed to get recall alert stats:', error);
      throw error;
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
   * Note: Device recalls use different fields than drug recalls:
   * - event_date_posted (not report_date)
   * - recall_status (not classification)
   */
  async getDeviceRecalls(options = {}) {
    await this.initialize();

    try {
      const limit = Math.min(options.limit || 50, 100);
      const deviceName = options.deviceName;

      // Build search query - device recalls use different schema
      // Only add search if device name provided to avoid timeout issues with complex queries
      const requestParams = {
        limit: limit,
        sort: 'event_date_posted:desc'  // Sort by most recent
      };

      if (deviceName) {
        // Search in product description or recalling firm
        requestParams.search = `product_description:"${deviceName}" OR recalling_firm:"${deviceName}"`;
      }

      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/device/recall.json',
        requestParams
      );
      
      if (!response.results) {
        return { recalls: [], total: 0 };
      }

      // Device recall fields are different from drug recalls
      const recalls = response.results.map(recall => ({
        productDescription: recall.product_description,
        manufacturer: recall.recalling_firm,
        recallStatus: recall.recall_status,
        reasonForRecall: recall.reason_for_recall,
        recallInitiationDate: recall.event_date_initiated,
        postedDate: recall.event_date_posted,
        terminatedDate: recall.event_date_terminated,
        distributionPattern: recall.distribution_pattern,
        productQuantity: recall.product_quantity,
        recallNumber: recall.product_res_number,
        productCode: recall.product_code,
        actionTaken: recall.action,
        rootCause: recall.root_cause_description,
        additionalInfo: recall.additional_info_contact
      }));

      return {
        recalls: recalls,
        total: response.meta?.results?.total || recalls.length,
        searchedDevice: deviceName || 'all',
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

  /**
   * Get device safety profile with summarized adverse events
   * Shows breakdown by event type (injury, malfunction, death)
   */
  async getDeviceSafetyProfile(manufacturer, model, options = {}) {
    await this.initialize();

    try {
      const limit = Math.min(options.limit || 100, 1000);

      // Build search query for manufacturer and model
      const searchParts = [];
      if (manufacturer) {
        searchParts.push(`device.manufacturer_d_name:"${manufacturer}"`);
      }
      if (model) {
        searchParts.push(`device.brand_name:"${model}"`);
      }

      if (searchParts.length === 0) {
        return { error: 'Manufacturer or model required' };
      }

      const searchQuery = searchParts.join(' AND ');

      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/device/event.json',
        {
          search: searchQuery,
          limit: limit,
          sort: 'date_received:desc'
        }
      );

      if (!response.results || response.results.length === 0) {
        return {
          manufacturer,
          model,
          totalEvents: 0,
          eventsByType: {},
          commonIssues: [],
          lastUpdated: new Date().toISOString()
        };
      }

      // Aggregate events by type
      const eventsByType = {
        death: 0,
        injury: 0,
        malfunction: 0,
        other: 0
      };

      const issueDescriptions = [];

      response.results.forEach(event => {
        const eventType = (event.event_type || '').toLowerCase();
        if (eventType.includes('death')) {
          eventsByType.death++;
        } else if (eventType.includes('injury')) {
          eventsByType.injury++;
        } else if (eventType.includes('malfunction')) {
          eventsByType.malfunction++;
        } else {
          eventsByType.other++;
        }

        // Collect event descriptions for common issues
        if (event.mdr_text?.[0]?.text) {
          issueDescriptions.push(event.mdr_text[0].text.substring(0, 200));
        }
      });

      // Calculate percentages
      const total = response.meta?.results?.total || response.results.length;
      const eventBreakdown = Object.entries(eventsByType)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => ({
          type: type.charAt(0).toUpperCase() + type.slice(1),
          count,
          percentage: Math.round((count / response.results.length) * 100)
        }))
        .sort((a, b) => b.count - a.count);

      // Extract top 5 common issues (simplified - in production would use NLP)
      const commonIssues = issueDescriptions
        .slice(0, 5)
        .map((desc, idx) => ({
          rank: idx + 1,
          description: desc
        }));

      return {
        manufacturer,
        model,
        totalEvents: total,
        recentEvents: response.results.length,
        eventBreakdown,
        commonIssues,
        riskLevel: eventsByType.death > 0 ? 'HIGH' :
                   eventsByType.injury > 5 ? 'MODERATE' : 'LOW',
        lastUpdated: new Date().toISOString(),
        fdaLink: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfMAUDE/search.CFM`
      };

    } catch (error) {
      // openFDA returns 404 when no results found - this is normal
      if (error.message.includes('404') || error.message.includes('Request failed with status code 404')) {
        console.log(`ℹ️ No adverse events found for ${manufacturer} ${model} (openFDA returned 404 - normal for no results)`);
        return {
          manufacturer,
          model,
          totalEvents: 0,
          eventsByType: {},
          commonIssues: [],
          lastUpdated: new Date().toISOString()
        };
      }
      console.error('Device safety profile error:', error);
      throw new Error(`Failed to get device safety profile: ${error.message}`);
    }
  }

  // ========== DRUG SHORTAGE APIS ==========

  /**
   * Check for drug shortages and match against patient medications
   * Fetches current shortage data from FDA and creates alerts for affected patients
   */
  async checkForDrugShortages() {
    await this.initialize();

    try {
      console.log('🔍 [DrugShortages] Checking for current drug shortages...');

      // Fetch current drug shortages from FDA
      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/drug/shortages.json',
        {
          limit: 100,
          sort: 'meta.last_updated:desc'
        }
      );

      if (!response.results || response.results.length === 0) {
        console.log('ℹ️ [DrugShortages] No shortage data returned from FDA');
        return { checked: 0, newAlerts: 0 };
      }

      console.log(`📋 [DrugShortages] Found ${response.results.length} shortage records`);

      // Get global database for storing shortage alerts
      const globalDb = await clinicDatabaseManager.getGlobalDb();

      let newAlerts = 0;
      for (const shortage of response.results) {
        // Store/update in drug_shortages collection
        const shortageDoc = {
          genericName: shortage.generic_name || shortage.proprietary_name,
          proprietaryName: shortage.proprietary_name,
          reason: shortage.reason,
          status: shortage.status || 'Current',
          expectedResolution: shortage.expected_resolution_date,
          ndcNumbers: shortage.ndc_numbers || [],
          marketingCategory: shortage.marketing_category,
          lastUpdated: new Date(shortage.meta?.last_updated || Date.now()),
          fdaSource: 'drug/shortages.json',
          createdAt: new Date()
        };

        // Upsert shortage record
        await globalDb.collection('drug_shortages').updateOne(
          { genericName: shortageDoc.genericName },
          { $set: shortageDoc },
          { upsert: true }
        );

        // Match against patient medications across all practices
        const affectedPatients = await this.findPatientsWithMedication(shortageDoc);
        for (const patient of affectedPatients) {
          const created = await this.createDrugShortageAlert(patient, shortageDoc);
          if (created) newAlerts++;
        }
      }

      console.log(`✅ [DrugShortages] Processed ${response.results.length} shortages, created ${newAlerts} patient alerts`);

      return {
        checked: response.results.length,
        newAlerts,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      // openFDA returns 404 when no results found - this is normal
      if (error.message.includes('404') || error.message.includes('Request failed with status code 404')) {
        console.log('ℹ️ [DrugShortages] No shortage data available (openFDA returned 404)');
        return { checked: 0, newAlerts: 0 };
      }
      console.error('❌ [DrugShortages] Error checking drug shortages:', error);
      throw new Error(`Failed to check drug shortages: ${error.message}`);
    }
  }

  /**
   * Find patients across all practices who are taking a medication in shortage
   */
  async findPatientsWithMedication(shortage) {
    const affectedPatients = [];

    try {
      // Get all practice databases
      const practiceDbs = await clinicDatabaseManager.getAllClinicDatabases();

      // Normalize drug name for matching
      const drugName = this.normalizeDrugName(shortage.genericName);
      const proprietaryName = shortage.proprietaryName ? this.normalizeDrugName(shortage.proprietaryName) : null;

      for (const practiceDb of practiceDbs) {
        const db = practiceDb.db;

        // Build query to match by generic name, brand name, or NDC
        const matchConditions = [
          { normalizedDrugName: drugName },
          { genericName: { $regex: drugName, $options: 'i' } },
          { name: { $regex: drugName, $options: 'i' } }
        ];

        if (proprietaryName) {
          matchConditions.push({ name: { $regex: proprietaryName, $options: 'i' } });
        }

        if (shortage.ndcNumbers && shortage.ndcNumbers.length > 0) {
          matchConditions.push({ ndc: { $in: shortage.ndcNumbers } });
        }

        // Find patients with matching medications
        const patients = await db.collection('medications').aggregate([
          {
            $match: {
              $or: matchConditions,
              active: { $ne: false },
              status: { $nin: ['discontinued', 'inactive'] }
            }
          },
          {
            $lookup: {
              from: 'patients',
              localField: 'patientId',
              foreignField: '_id',
              as: 'patient'
            }
          },
          { $unwind: { path: '$patient', preserveNullAndEmptyArrays: false } },
          {
            $project: {
              patientId: '$patientId',
              patientName: { $concat: ['$patient.firstName', ' ', '$patient.lastName'] },
              medicationName: '$name',
              dosage: '$dosage',
              practiceSubdomain: practiceDb.subdomain,
              practiceName: practiceDb.name
            }
          }
        ]).toArray();

        affectedPatients.push(...patients);
      }

      console.log(`📋 [DrugShortages] Found ${affectedPatients.length} patients on ${shortage.genericName}`);
      return affectedPatients;

    } catch (error) {
      console.error('❌ [DrugShortages] Error finding patients:', error);
      return [];
    }
  }

  /**
   * Create a drug shortage alert for a specific patient
   */
  async createDrugShortageAlert(patient, shortage) {
    try {
      const practiceDb = await clinicDatabaseManager.getClinicDatabase(patient.practiceSubdomain);

      // Check if alert already exists
      const existing = await practiceDb.collection('patient_drug_shortage_alerts').findOne({
        patientId: patient.patientId,
        genericName: shortage.genericName,
        status: { $ne: 'resolved' }
      });

      if (existing) {
        return false; // Alert already exists
      }

      // Create new alert
      const alert = {
        patientId: patient.patientId,
        patientName: patient.patientName,
        genericName: shortage.genericName,
        proprietaryName: shortage.proprietaryName,
        medicationName: patient.medicationName,
        dosage: patient.dosage,
        reason: shortage.reason,
        expectedResolution: shortage.expectedResolution,
        severity: this.mapShortageToSeverity(shortage),
        status: 'active',
        alertDate: new Date(),
        notifiedAt: null,
        practiceSubdomain: patient.practiceSubdomain,
        practiceName: patient.practiceName
      };

      await practiceDb.collection('patient_drug_shortage_alerts').insertOne(alert);
      console.log(`✅ [DrugShortages] Created alert for ${patient.patientName} - ${shortage.genericName}`);
      return true;

    } catch (error) {
      console.error('❌ [DrugShortages] Error creating alert:', error);
      return false;
    }
  }

  /**
   * Get drug shortage alerts for a specific provider's patients
   */
  async getProviderDrugShortageAlerts(options = {}) {
    await this.initialize();

    try {
      const { providerId, practiceSubdomain, limit = 50 } = options;

      if (!providerId) {
        throw new Error('Provider ID is required');
      }

      const practiceDb = await clinicDatabaseManager.getClinicDatabase(practiceSubdomain);

      // Get provider's patients
      const providerPatients = await practiceDb.collection('patient_provider').find({
        providerId: providerId
      }).toArray();

      const patientIds = providerPatients.map(pp => pp.patientId);

      if (patientIds.length === 0) {
        return [];
      }

      // Get shortage alerts for provider's patients
      const alerts = await practiceDb.collection('patient_drug_shortage_alerts').find({
        patientId: { $in: patientIds },
        status: 'active'
      })
        .sort({ alertDate: -1 })
        .limit(limit)
        .toArray();

      return alerts;

    } catch (error) {
      console.error('❌ [DrugShortages] Error getting provider alerts:', error);
      throw new Error(`Failed to get provider drug shortage alerts: ${error.message}`);
    }
  }

  /**
   * Get current drug shortages list
   */
  async getDrugShortages(options = {}) {
    await this.initialize();

    try {
      const { limit = 50, status = 'Current' } = options;

      // openFDA status values: "Current", "Resolved", "To Be Discontinued"
      // Normalize status input to match openFDA expected values
      const normalizedStatus = status ?
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Current';

      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/drug/shortages.json',
        {
          limit: Math.min(limit, 100),
          search: normalizedStatus ? `status:"${normalizedStatus}"` : undefined
        }
      );

      if (!response.results) {
        return { shortages: [], total: 0 };
      }

      const shortages = response.results.map(s => ({
        genericName: s.generic_name || s.proprietary_name,
        proprietaryName: s.proprietary_name,
        reason: s.reason,
        status: s.status,
        expectedResolution: s.expected_resolution_date,
        ndcNumbers: s.ndc_numbers,
        lastUpdated: s.meta?.last_updated
      }));

      return {
        shortages,
        total: response.meta?.results?.total || shortages.length
      };

    } catch (error) {
      // openFDA returns 404 when no matches found - this is normal, not an error
      if (error.message.includes('404') || error.message.includes('No matches found')) {
        console.log('ℹ️ [DrugShortages] No shortages found (normal - openFDA returns 404 for no results)');
        return { shortages: [], total: 0, message: 'No drug shortages found matching your criteria' };
      }
      throw new Error(`Failed to get drug shortages: ${error.message}`);
    }
  }

  /**
   * Map shortage status to severity level
   */
  mapShortageToSeverity(shortage) {
    const status = (shortage.status || '').toLowerCase();
    const reason = (shortage.reason || '').toLowerCase();

    // Critical if no expected resolution or manufacturing issue
    if (!shortage.expectedResolution || reason.includes('discontinu')) {
      return 'high';
    }

    // Current shortages are medium
    if (status.includes('current') || status.includes('ongoing')) {
      return 'medium';
    }

    // Resolved or expected resolution soon is low
    return 'low';
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
      const reason = options.reason; // e.g., 'salmonella', 'listeria', 'undeclared'

      // Build simple request - avoid complex date range queries that timeout
      const requestParams = {
        limit: limit,
        sort: 'report_date:desc'
      };

      // Only add search if specific filters provided
      const searchParts = [];
      if (classification) {
        searchParts.push(`classification:"${classification}"`);
      }
      if (reason) {
        searchParts.push(`reason_for_recall:"${reason}"`);
      }
      if (searchParts.length > 0) {
        requestParams.search = searchParts.join(' AND ');
      }

      const response = await externalApiGateway.makeRequest(
        'openFDA',
        '/food/enforcement.json',
        requestParams
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

  async logInteractionCheck(medications, result, userId, practiceId) {
    await this.auditLog('DRUG_INTERACTION_CHECK', {
      medications,
      totalInteractions: result.totalInteractions,
      majorInteractions: result.majorInteractions
    }, userId, practiceId);
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

  // ========== DEVICE RECALL PATIENT MATCHING ==========

  /**
   * Check for new device recalls and match against patient devices
   * Similar to checkForNewAlerts() for drug recalls
   */
  async checkForDeviceRecallAlerts() {
    await this.initialize();
    console.log('[Device Recall] Checking for new device recalls...');

    try {
      // Fetch recent device recalls from FDA
      const recallData = await this.getDeviceRecalls({
        limit: 100,
        dateFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Last 90 days
      });

      if (!recallData.recalls || recallData.recalls.length === 0) {
        console.log('[Device Recall] No recent device recalls found');
        return { checked: 0, newAlerts: 0 };
      }

      console.log(`[Device Recall] Found ${recallData.recalls.length} recent device recalls`);

      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      };

      let newAlerts = 0;

      for (const recall of recallData.recalls) {
        // Check if we already have this recall
        const existing = await SecureDataAccess.query('device_safety_alerts', {
          recallNumber: recall.recallNumber
        }, {}, context);

        if (existing.length === 0) {
          // Store new recall
          await SecureDataAccess.insert('device_safety_alerts', {
            type: 'FDA_DEVICE_RECALL',
            recallNumber: recall.recallNumber,
            manufacturer: recall.manufacturer,
            productDescription: recall.productDescription,
            classification: recall.classification,
            reasonForRecall: recall.reasonForRecall,
            recallInitiationDate: recall.recallInitiationDate,
            reportDate: recall.reportDate,
            severity: this.mapDeviceClassToSeverity(recall.classification),
            status: 'active',
            createdAt: new Date()
          }, context);

          // Find affected patients
          await this.findPatientsWithDevice(recall);
          newAlerts++;
        }
      }

      console.log(`[Device Recall] Created ${newAlerts} new device recall alerts`);
      return { checked: recallData.recalls.length, newAlerts };

    } catch (error) {
      console.error('[Device Recall] Error checking for device recalls:', error);
      throw error;
    }
  }

  /**
   * Find patients who have a device matching the recall
   */
  async findPatientsWithDevice(recall) {
    await this.initialize();

    const manufacturerNormalized = (recall.manufacturer || '').toLowerCase().trim();
    const productNormalized = (recall.productDescription || '').toLowerCase();

    console.log(`[Device Recall] Searching for patients with device: ${manufacturerNormalized}`);

    try {
      // Get all practice databases
      const clinicDatabaseManager = require('./clinicDatabaseManager');
      const practiceDbs = await clinicDatabaseManager.getAllClinicDatabases();

      for (const practiceInfo of practiceDbs) {
        const practiceSubdomain = practiceInfo.subdomain || practiceInfo.name;

        const context = {
          serviceId: 'drug-information-service',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceSubdomain
        };

        // Check cardiac devices
        const cardiacDevices = await SecureDataAccess.query('cardiac_device_interrogations', {}, {}, context);

        for (const device of cardiacDevices) {
          const deviceManufacturer = (device.manufacturer || '').toLowerCase().trim();
          const deviceModel = (device.model || '').toLowerCase();
          const deviceType = (device.deviceType || '').toLowerCase();

          // Check for match
          const manufacturerMatch = manufacturerNormalized.includes(deviceManufacturer) ||
                                    deviceManufacturer.includes(manufacturerNormalized);
          const productMatch = productNormalized.includes(deviceModel) ||
                               productNormalized.includes(deviceType);

          if (manufacturerMatch || productMatch) {
            await this.createDeviceRecallAlert(device.patientId, recall, {
              deviceType: device.deviceType,
              manufacturer: device.manufacturer,
              model: device.model,
              practiceSubdomain
            });
          }
        }

        // Check respiratory devices
        const respiratoryDevices = await SecureDataAccess.query('respiratory_devices', {}, {}, context);

        for (const device of respiratoryDevices) {
          const deviceType = (device.type || '').toLowerCase();

          if (productNormalized.includes(deviceType)) {
            await this.createDeviceRecallAlert(device.patientId, recall, {
              deviceType: device.type,
              manufacturer: device.facility || 'Unknown',
              practiceSubdomain
            });
          }
        }

        // Check insulin pumps (if we have that collection)
        try {
          const insulinPumps = await SecureDataAccess.query('insulin_pump_settings', {}, {}, context);

          for (const pump of insulinPumps) {
            const pumpManufacturer = (pump.manufacturer || pump.brand || '').toLowerCase();

            if (manufacturerNormalized.includes(pumpManufacturer) ||
                productNormalized.includes('insulin pump')) {
              await this.createDeviceRecallAlert(pump.patientId, recall, {
                deviceType: 'Insulin Pump',
                manufacturer: pump.manufacturer || pump.brand,
                model: pump.model,
                practiceSubdomain
              });
            }
          }
        } catch (e) {
          // Collection may not exist
        }
      }

    } catch (error) {
      console.error('[Device Recall] Error finding patients with device:', error);
    }
  }

  /**
   * Create a patient-specific device recall alert
   */
  async createDeviceRecallAlert(patientId, recall, deviceInfo) {
    if (!patientId) return;

    const context = {
      serviceId: 'drug-information-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: deviceInfo.practiceSubdomain
    };

    try {
      // Check if alert already exists
      const existing = await SecureDataAccess.query('patient_device_recall_alerts', {
        patientId: patientId,
        recallNumber: recall.recallNumber
      }, {}, context);

      if (existing.length > 0) return;

      // Get patient name
      let patientName = 'Unknown Patient';
      try {
        const patients = await SecureDataAccess.query('patients', {
          _id: patientId
        }, { projection: { firstName: 1, lastName: 1 } }, context);

        if (patients.length > 0) {
          patientName = `${patients[0].firstName || ''} ${patients[0].lastName || ''}`.trim();
        }
      } catch (e) { /* ignore */ }

      await SecureDataAccess.insert('patient_device_recall_alerts', {
        type: 'FDA_DEVICE_RECALL_PATIENT_NOTIFICATION',
        patientId: patientId,
        patientName: patientName,
        recallNumber: recall.recallNumber,
        deviceType: deviceInfo.deviceType,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        productDescription: recall.productDescription,
        classification: recall.classification,
        reasonForRecall: recall.reasonForRecall,
        severity: this.mapDeviceClassToSeverity(recall.classification),
        alertDate: new Date(),
        reviewed: false,
        acknowledged: false
      }, context);

      console.log(`[Device Recall] Created alert for patient ${patientName} - ${deviceInfo.deviceType}`);

    } catch (error) {
      console.error('[Device Recall] Error creating patient alert:', error);
    }
  }

  /**
   * Get device recall alerts for a specific provider's patients
   */
  async getProviderDeviceRecallAlerts(options = {}) {
    await this.initialize();

    const { providerName, providerEmail, userId, practiceSubdomain = 'yale' } = options;

    console.log(`[Device Recall] Getting provider-specific device alerts for: ${providerName || providerEmail}`);

    try {
      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceSubdomain
      };

      // Get all device recall alerts
      const allAlerts = await SecureDataAccess.query('patient_device_recall_alerts', {
        type: 'FDA_DEVICE_RECALL_PATIENT_NOTIFICATION'
      }, {}, context);

      if (!allAlerts || allAlerts.length === 0) {
        return [];
      }

      // Get provider-patient relationships
      const providerPatients = await SecureDataAccess.query('patient_provider', {}, {
        projection: { patientId: 1, provider: 1 }
      }, context);

      const myPatientIds = new Set();
      for (const pp of providerPatients) {
        const providerStr = String(pp.provider || '').toLowerCase();
        const nameMatch = providerName && providerStr.includes(providerName.toLowerCase());
        const emailMatch = providerEmail && providerStr.includes(providerEmail.toLowerCase());

        if (nameMatch || emailMatch) {
          myPatientIds.add(String(pp.patientId));
        }
      }

      // Filter alerts to this provider's patients
      const filteredAlerts = allAlerts.filter(alert =>
        myPatientIds.has(String(alert.patientId))
      );

      // Sort by severity and date
      const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MODERATE': 2, 'INFO': 3 };
      filteredAlerts.sort((a, b) => {
        const severityDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.alertDate) - new Date(a.alertDate);
      });

      return filteredAlerts;

    } catch (error) {
      console.error('[Device Recall] Failed to get provider device alerts:', error);
      throw error;
    }
  }

  /**
   * Map FDA device classification to severity level
   */
  mapDeviceClassToSeverity(classification) {
    switch (classification) {
      case 'Class I':
        return 'CRITICAL'; // Most dangerous - death or serious injury
      case 'Class II':
        return 'HIGH'; // May cause temporary or reversible health problems
      case 'Class III':
        return 'MODERATE'; // Unlikely to cause adverse health consequences
      default:
        return 'HIGH';
    }
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

  // ============================================================================
  // FDA Data Dashboard API (DDAPI) Functions - December 2025
  // Inspections, Citations (FDA 483), Compliance Actions (Warning Letters)
  // ============================================================================

  /**
   * Get FDA 483 inspection citations (observations/violations)
   * Useful for checking if a drug manufacturer has compliance issues
   * @param {Object} options - Query options
   * @param {string} options.firmName - Manufacturer/firm name to search
   * @param {string} options.productType - Product type (Drugs, Devices, Food, etc.)
   * @param {string} options.fiscalYear - Fiscal year (e.g., '2024')
   * @param {number} options.limit - Max results (default: 50)
   * @returns {Promise<Object>} - Citations data
   */
  async getInspectionCitations(options = {}) {
    const { firmName, productType, fiscalYear, limit = 50 } = options;

    try {
      await this.initialize();

      // Build filters object for DDAPI - key: [values] format
      // DDAPI uses "LegalName" for partial match (LIKE %value%)
      const filters = {};

      if (firmName) {
        // LegalName uses Partial match type - will match LIKE %firmName%
        filters.LegalName = [firmName];
      }

      if (productType) {
        filters.ProductType = [productType];
      }

      if (fiscalYear) {
        filters.FiscalYear = [fiscalYear];
      }

      // Build payload for DDAPI - REQUIRED format per FDA docs
      // Per FDA docs: use empty strings for sort/sortorder to use defaults (avoids field name issues)
      const payload = {
        sort: '',                        // Empty = use default sort (primary key)
        sortorder: '',                   // Empty = use default order (asc)
        filters: filters,                // Object with fieldName: [values]
        columns: []                      // Empty = return all columns
      };

      // Only add optional params if non-default
      if (limit && limit < 5000) {
        payload.rows = Math.min(limit, 100);
        payload.start = 1;
      }

      console.log(`🔍 [DDAPI] Fetching inspection citations for: ${firmName || 'all firms'}`);

      const result = await externalApiGateway.makeFdaPostRequest(
        'fdaDDAPI',
        '/inspections_citations',
        payload,
        { skipCache: false }
      );

      // Normalize results for agent consumption
      // DDAPI returns { statuscode, message, resultcount, result: [...] }
      const citations = (result.result || result.results || result.data || []).map(c => ({
        firmName: c.LegalName || c.firmName,
        feiNumber: c.FEINumber || c.feiNumber,
        citationId: c.CitationID || c.citationId,
        inspectionId: c.InspectionID || c.inspectionId,
        actCfrNumber: c.ActCFRNumber || c.actCfrNumber,
        shortDescription: c.ShortDescription || c.shortDescription,
        longDescription: c.LongDescription || c.longDescription,
        productType: c.ProductType || c.productType,
        postedDate: c.PostedDate || c.postedDate,
        fiscalYear: c.FiscalYear || c.fiscalYear,
        city: c.City || c.city,
        state: c.State || c.state,
        country: c.Country || c.country,
        source: 'FDA_DDAPI_CITATIONS'
      }));

      console.log(`✅ [DDAPI] Found ${citations.length} inspection citations`);

      return {
        total: result.resultcount || result.totalrecordcount || citations.length,
        citations: citations,
        source: 'FDA_DDAPI',
        queriedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ [DDAPI] Failed to fetch inspection citations:', error.message);
      // Return empty result on error (don't fail the agent)
      return {
        total: 0,
        citations: [],
        error: error.message,
        source: 'FDA_DDAPI',
        queriedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get FDA compliance actions (warning letters, injunctions, seizures)
   * Shows regulatory enforcement against manufacturers
   * @param {Object} options - Query options
   * @param {string} options.firmName - Manufacturer/firm name to search
   * @param {string} options.actionType - Type of action (Warning Letter, Injunction, etc.)
   * @param {string} options.productType - Product type (Drugs, Devices, etc.)
   * @param {number} options.limit - Max results (default: 50)
   * @returns {Promise<Object>} - Compliance actions data
   */
  async getComplianceActions(options = {}) {
    const { firmName, actionType, productType, limit = 50 } = options;

    try {
      await this.initialize();

      // Build filters object for DDAPI - key: [values] format
      const filters = {};

      if (firmName) {
        // LegalName uses Partial match type - will match LIKE %firmName%
        filters.LegalName = [firmName];
      }

      if (actionType) {
        filters.ActionType = [actionType];
      }

      if (productType) {
        filters.ProductType = [productType];
      }

      // Build payload for DDAPI - REQUIRED format per FDA docs
      // Per FDA docs: use empty strings for sort/sortorder to use defaults (avoids field name issues)
      const payload = {
        sort: '',                        // Empty = use default sort (primary key)
        sortorder: '',                   // Empty = use default order (asc)
        filters: filters,                // Object with fieldName: [values]
        columns: []                      // Empty = return all columns
      };

      // Only add optional params if non-default
      if (limit && limit < 5000) {
        payload.rows = Math.min(limit, 100);
        payload.start = 1;
      }

      console.log(`🔍 [DDAPI] Fetching compliance actions for: ${firmName || 'all firms'}`);

      const result = await externalApiGateway.makeFdaPostRequest(
        'fdaDDAPI',
        '/compliance_actions',
        payload,
        { skipCache: false }
      );

      // Normalize results - DDAPI returns { statuscode, message, resultcount, result: [...] }
      const actions = (result.result || result.results || result.data || []).map(a => ({
        firmName: a.LegalName || a.firmName,
        feiNumber: a.FEINumber || a.feiNumber,
        actionType: a.ActionType || a.actionType,
        caseNumber: a.CaseInjunctionNumber || a.caseNumber,
        productType: a.ProductType || a.productType,
        issuingOffice: a.IssuingOffice || a.issuingOffice,
        subject: a.Subject || a.subject,
        letterIssueDate: a.LetterIssueDate || a.letterIssueDate,
        postedDate: a.PostedDate || a.postedDate,
        closeoutDate: a.CloseoutDate || a.closeoutDate,
        responseLetterPosted: a.ResponseLetterPosted || a.responseLetterPosted,
        city: a.City || a.city,
        state: a.State || a.state,
        country: a.Country || a.country,
        source: 'FDA_DDAPI_COMPLIANCE'
      }));

      console.log(`✅ [DDAPI] Found ${actions.length} compliance actions`);

      return {
        total: result.resultcount || result.totalrecordcount || actions.length,
        actions: actions,
        source: 'FDA_DDAPI',
        queriedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ [DDAPI] Failed to fetch compliance actions:', error.message);
      return {
        total: 0,
        actions: [],
        error: error.message,
        source: 'FDA_DDAPI',
        queriedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Check manufacturer compliance status - combines citations and compliance actions
   * Gives doctors a quick overview of regulatory issues for a drug manufacturer
   * @param {string} firmName - Manufacturer name (e.g., 'Pfizer', 'Teva')
   * @returns {Promise<Object>} - Compliance overview
   */
  async checkManufacturerCompliance(firmName) {
    if (!firmName) {
      return { error: 'Firm name is required' };
    }

    try {
      console.log(`🔍 [FDA] Checking compliance for manufacturer: ${firmName}`);

      // Fetch both citations and compliance actions in parallel
      const [citationsResult, actionsResult] = await Promise.all([
        this.getInspectionCitations({ firmName, limit: 20 }),
        this.getComplianceActions({ firmName, limit: 20 })
      ]);

      // Calculate risk level based on findings
      const totalIssues = citationsResult.total + actionsResult.total;
      const hasWarningLetters = actionsResult.actions.some(a =>
        (a.actionType || '').toLowerCase().includes('warning')
      );
      const hasInjunctions = actionsResult.actions.some(a =>
        (a.actionType || '').toLowerCase().includes('injunction')
      );

      let riskLevel = 'LOW';
      let riskDescription = 'No significant compliance issues found';

      if (hasInjunctions) {
        riskLevel = 'HIGH';
        riskDescription = 'FDA has taken legal action against this manufacturer';
      } else if (hasWarningLetters) {
        riskLevel = 'MODERATE';
        riskDescription = 'FDA has issued warning letters to this manufacturer';
      } else if (totalIssues > 10) {
        riskLevel = 'MODERATE';
        riskDescription = 'Multiple inspection findings on record';
      } else if (totalIssues > 0) {
        riskLevel = 'LOW';
        riskDescription = 'Minor compliance issues found';
      }

      return {
        firmName: firmName,
        riskLevel: riskLevel,
        riskDescription: riskDescription,
        summary: {
          totalCitations: citationsResult.total,
          totalComplianceActions: actionsResult.total,
          hasWarningLetters: hasWarningLetters,
          hasInjunctions: hasInjunctions
        },
        recentCitations: citationsResult.citations.slice(0, 5),
        recentActions: actionsResult.actions.slice(0, 5),
        source: 'FDA_DDAPI',
        queriedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ [FDA] Failed to check manufacturer compliance:', error.message);
      return {
        firmName: firmName,
        riskLevel: 'UNKNOWN',
        error: error.message,
        source: 'FDA_DDAPI',
        queriedAt: new Date().toISOString()
      };
    }
  }

  // ============================================================================
  // FDA FEI API - Facility/Establishment Registration Lookup
  // ============================================================================

  /**
   * Check if a manufacturer/facility is FDA registered
   * @param {string} firmName - Firm/manufacturer name to search
   * @returns {Promise<Object>} - Facility registration data
   */
  async checkFacilityRegistration(firmName) {
    if (!firmName) {
      return { error: 'Firm name is required', facilities: [] };
    }

    try {
      await this.initialize();

      console.log(`🔍 [FEI] Checking FDA registration for: ${firmName}`);

      // FEI API uses URL-encoded payload like iRES
      const payload = JSON.stringify({
        firmname: firmName
      });

      const result = await externalApiGateway.makeFdaPostRequest(
        'fdaFEI',
        '/feiapi/v1/firm/name/',
        payload,
        { skipCache: false }
      );

      // Normalize results
      const facilities = (result.RESULTS || result.results || result.data || []).map(f => ({
        feiNumber: f.FEINumber || f.fei_number,
        firmName: f.LegalName || f.legal_name || f.FirmName,
        dbaName: f.DBAName || f.dba_name,
        address: {
          line1: f.AddressLine1 || f.address_line_1,
          line2: f.AddressLine2 || f.address_line_2,
          city: f.City || f.city,
          state: f.State || f.state,
          zip: f.Zip || f.zip,
          country: f.Country || f.country
        },
        registrationStatus: f.RegistrationStatus || f.registration_status || 'Unknown',
        operationType: f.OperationType || f.operation_type,
        productTypes: f.ProductTypes || f.product_types || [],
        source: 'FDA_FEI'
      }));

      const isRegistered = facilities.length > 0;

      console.log(`✅ [FEI] Found ${facilities.length} registered facilities for ${firmName}`);

      return {
        firmName: firmName,
        isRegistered: isRegistered,
        facilityCount: facilities.length,
        facilities: facilities.slice(0, 20), // Limit results
        source: 'FDA_FEI',
        queriedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ [FEI] Failed to check facility registration:', error.message);
      return {
        firmName: firmName,
        isRegistered: null,
        error: error.message,
        source: 'FDA_FEI',
        queriedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get facility details by FEI number
   * @param {string} feiNumber - FDA Establishment Identifier
   * @returns {Promise<Object>} - Facility details
   */
  async getFacilityByFEI(feiNumber) {
    if (!feiNumber) {
      return { error: 'FEI number is required' };
    }

    try {
      await this.initialize();

      console.log(`🔍 [FEI] Looking up facility by FEI: ${feiNumber}`);

      const payload = JSON.stringify({
        fei: feiNumber
      });

      const result = await externalApiGateway.makeFdaPostRequest(
        'fdaFEI',
        '/feiapi/v1/fei/',
        payload,
        { skipCache: false }
      );

      const facility = result.RESULTS?.[0] || result.results?.[0] || result.data?.[0];

      if (!facility) {
        return {
          feiNumber: feiNumber,
          found: false,
          error: 'No facility found with this FEI number',
          source: 'FDA_FEI',
          queriedAt: new Date().toISOString()
        };
      }

      console.log(`✅ [FEI] Found facility: ${facility.LegalName || facility.FirmName}`);

      return {
        feiNumber: feiNumber,
        found: true,
        facility: {
          feiNumber: facility.FEINumber || facility.fei_number,
          firmName: facility.LegalName || facility.legal_name || facility.FirmName,
          dbaName: facility.DBAName || facility.dba_name,
          address: {
            line1: facility.AddressLine1 || facility.address_line_1,
            line2: facility.AddressLine2 || facility.address_line_2,
            city: facility.City || facility.city,
            state: facility.State || facility.state,
            zip: facility.Zip || facility.zip,
            country: facility.Country || facility.country
          },
          registrationStatus: facility.RegistrationStatus || facility.registration_status || 'Unknown',
          operationType: facility.OperationType || facility.operation_type,
          productTypes: facility.ProductTypes || facility.product_types || []
        },
        source: 'FDA_FEI',
        queriedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ [FEI] Failed to lookup facility by FEI:', error.message);
      return {
        feiNumber: feiNumber,
        found: false,
        error: error.message,
        source: 'FDA_FEI',
        queriedAt: new Date().toISOString()
      };
    }
  }

  async auditLog(action, details, userId, practiceId) {
    try {
      // Only create audit log if we have a valid practice context
      if (!practiceId) {
        console.warn('⚠️ [drugInformationService] No practiceId provided for audit log, skipping');
        return;
      }

      const context = {
        serviceId: 'drug-information-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceId  // Use actual practice ID - no fallback to 'global'
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

module.exports = new EnhancedFDAInformationService();