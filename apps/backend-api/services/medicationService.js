/**
 * MedicationService
 *
 * Domain: medication
 * Extracted from: agentServiceV4.js
 * Functions: 11
 *
 * Purpose: Handle all medication-related operations including safety checks and drug interactions
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations (no HTTP calls)
 * - Practice-aware multi-tenant isolation
 * - Proper error handling and logging
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AgentServiceHelpers = require('./agentServiceHelpers');
const MedicationHelpers = require('./utils/medicationHelpers');
const { ObjectId } = require('mongodb');

class MedicationService {
  constructor() {
    this.serviceName = 'medicationService';
    this.serviceAuth = null;
    this.medicationHelpers = new MedicationHelpers();
  }

  /**
   * Initialize service with authentication
   */
  async initialize() {
    if (!this.serviceAuth) {
      this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);
      console.log(`✅ ${this.serviceName} authenticated successfully`);
    }
    return this.serviceAuth;
  }

  /**
   * Create secure context for database operations
   * @param {Object} practiceContext - Practice context from request
   * @param {string} operation - Operation name
   * @returns {Object} Security context
   */
  createSecureContext(practiceContext, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || 'global',
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  /**
   * Normalize practice context to ensure consistent format
   * @param {Object} practiceContext - Raw practice context
   * @returns {Object} Normalized practice context
   */
  normalizePracticeContext(practiceContext) {
    if (!practiceContext) {
      return { id: 'global', subdomain: 'global' };
    }

    return {
      id: practiceContext.practiceId || practiceContext.id || 'global',
      subdomain: practiceContext.subdomain || practiceContext.practiceSubdomain || 'global',
      name: practiceContext.name || practiceContext.practiceName,
      language: practiceContext.language || 'en'
    };
  }

  /**
   * Build medication query filter that excludes expired medications
   * UNIVERSAL HELPER: Use this in ALL medication queries to ensure consistency
   *
   * @param {Object} baseFilter - Base MongoDB filter (e.g., { patientId: '123', name: 'Aspirin' })
   * @param {Object} options - Options for filter behavior
   * @param {boolean} options.includeExpired - Set to true to include expired medications (default: false)
   * @param {boolean} options.includeInactive - Set to true to include inactive medications (default: false)
   * @returns {Object} Enhanced filter with expiration logic
   */
  buildMedicationFilter(baseFilter, options = {}) {
    const { includeExpired = false, includeInactive = false } = options;
    const now = new Date();

    const filter = { ...baseFilter };

    // By default, exclude inactive medications (expired, discontinued, etc.)
    if (!includeInactive) {
      filter.active = true;
    }

    // By default, exclude medications that have expired
    // Expired = endDate exists AND endDate < now
    if (!includeExpired) {
      filter.$or = [
        { endDate: { $exists: false } },  // No end date = ongoing medication
        { endDate: null },                 // Null end date = ongoing medication
        { endDate: { $gt: now } }          // End date in future = still active
      ];
    }

    return filter;
  }

  // ============================================================================
  // SERVICE FUNCTIONS - EXTRACTED FROM agentServiceV4.js
  // ============================================================================

async addMedication(params, practiceContext, session) {
    try {
      // Extract patientId separately to check context
      let { patientId, ...medicationData } = params;
      
      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }
      
      // Validate required fields
      if (!patientId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
          : 'Patient ID required. Please search for a patient first');
      }
      
      if (!params.medicationName) {
        throw new Error(practiceContext.language === 'he' 
          ? 'שם התרופה חסר' 
          : 'Medication name is required');
      }
      
      if (!params.dosage) {
        throw new Error(practiceContext.language === 'he' 
          ? 'מינון התרופה חסר' 
          : 'Medication dosage is required');
      }
      
      // Structure medication data to match new schema
      const medicationEntry = {
        name: params.medicationName,
        dosage: `${params.dosage}${params.dosageUnit || 'mg'}`,
        frequency: params.frequency || 'once daily',
        route: params.route || 'Oral',
        startDate: params.startDate ? new Date(params.startDate) : new Date(),
        endDate: params.endDate ? new Date(params.endDate) : null,
        prescribedBy: params.prescribedBy || practiceContext.userName || 'AI Agent',
        prescribedDate: params.prescribedDate ? new Date(params.prescribedDate) : new Date(),
        source: 'Agent Service',
        active: true,
        notes: params.instructions || params.notes || ''
      };
      
      // Build security context for SecureDataAccess
      const context = AgentServiceHelpers.buildSecurityContext(
        'agentServiceV4',  // Use correct service name that matches registration
        this.serviceToken,
        practiceContext
      );

      // Convert patientId to ObjectId if string
      const patientObjId = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
        ? new ObjectId(patientId)
        : patientId;

      // Insert into medications collection (proper MongoDB pattern)
      // NOTE: Removed DUAL WRITE to patient.currentMedications (November 2025)
      // Medications are stored in the 'medications' collection only.
      // getMedications() queries by patientId - no embedded data needed.
      const medicationDocument = {
        ...medicationEntry,
        patientId: patientObjId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const insertResult = await SecureDataAccess.insert('medications', medicationDocument, context);

      if (!insertResult || !insertResult._id) {
        throw new Error('Failed to add medication to medications collection');
      }
      
      return {
        success: true,
        data: medicationEntry,
        message: practiceContext.language === 'he' 
          ? `התרופה ${params.medicationName} ${params.dosage}${params.dosageUnit || 'mg'} נוספה בהצלחה`
          : `Medication ${params.medicationName} ${params.dosage}${params.dosageUnit || 'mg'} added successfully`,
        summary: {
          medicationName: params.medicationName,
          dosage: `${params.dosage}${params.dosageUnit || 'mg'}`,
          frequency: params.frequency || 'once daily',
          route: params.route || 'Oral'
        }
      };
      
    } catch (error) {
      console.error('Error adding medication:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בהוספת תרופה: ${error.message}`
          : `Error adding medication: ${error.message}`
      };
    }
  }

async getMedications(params, practiceContext, session) {
    try {
      // Initialize service authentication if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      // Extract patientId and nationalId separately to check context
      let { patientId, nationalId, ...queryOptions } = params;
      
      // Priority: Use nationalId if provided (more user-friendly)
      if (nationalId && !patientId) {
        console.log(`🔍 Looking up patient by National ID for medications: ${nationalId}`);

        // Get patientService via serviceProxyManager
        const serviceProxyManager = require('./serviceProxyManager');
        const patientService = serviceProxyManager.get('patientService');

        if (!patientService) {
          throw new Error('patientService not available');
        }

        const searchResult = await patientService.searchPatients({
          query: nationalId
        }, practiceContext, session);

        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          // Fix: Use _id field from search result
          patientId = searchResult.data[0]._id;
          const patientName = `${searchResult.data[0].firstName || ''} ${searchResult.data[0].lastName || ''}`.trim() || searchResult.data[0].name || 'Unknown';
          console.log(`✅ Found patient for medications: ${patientName} (${patientId})`);
        } else {
          throw new Error(practiceContext.language === 'he'
            ? `לא נמצא מטופל עם תעודת זהות ${nationalId}`
            : `No patient found with National ID ${nationalId}`);
        }
      }
      
      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }
      
      // Validate patient ID
      if (!patientId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה מטופל או תעודת זהות. אנא חפש מטופל תחילה' 
          : 'Patient ID or National ID required. Please search for a patient first');
      }
      
      // Build query parameters
      const queryParams = {
        status: params.status || 'all',
        includeDiscontinued: params.includeDiscontinued !== false,
        includeHistory: params.includeHistory || false
      };
      
      // Add date filters if provided
      if (params.startDate) queryParams.startDate = params.startDate;
      if (params.endDate) queryParams.endDate = params.endDate;
      if (params.prescribedAfter) queryParams.prescribedAfter = params.prescribedAfter;

      // Build security context for SecureDataAccess - use service's own authentication
      const context = this.createSecureContext(practiceContext, 'get_medications');

      // Get patient record with currentMedications
      const patients = await SecureDataAccess.query('patients',
        { _id: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(patientId) : patientId },
        { limit: 1 },
        context
      );
      
      if (!patients || patients.length === 0) {
        throw new Error(practiceContext.language === 'he' 
          ? 'מטופל לא נמצא'
          : 'Patient not found');
      }
      
      const patient = patients[0];

      // Query medications from the medications collection (NOT from patient.medicalHistory)
      // Medications are stored in their own collection after batch processing
      // Use buildMedicationFilter to exclude expired medications by default
      const includeExpired = params.includeExpired || params.status === 'discontinued' || params.status === 'all';
      const includeInactive = params.includeInactive || params.status === 'discontinued' || params.status === 'all';

      const medicationFilter = this.buildMedicationFilter(
        { patientId: patient._id },
        { includeExpired, includeInactive }
      );

      const medications = await SecureDataAccess.query('medications',
        medicationFilter,
        {
          sort: { startDate: -1 }, // Most recent first
          limit: 100 // Reasonable limit
        },
        context
      );

      console.log(`✅ Found ${medications.length} medications for patient ${patient._id}`);

      if (medications.length === 0) {
        return {
          success: true,
          data: [],
          count: 0,
          message: practiceContext.language === 'he'
            ? 'לא נמצאו תרופות'
            : 'No medications found'
        };
      }

      const now = new Date();

      // Enhance medication data
      const enhancedMedications = medications.map(med => {
        const enhanced = { ...med };

        // Calculate days remaining if end date exists
        if (med.endDate) {
          const endDate = new Date(med.endDate);
          const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
          enhanced.daysRemaining = daysRemaining;
          enhanced.isExpiring = daysRemaining <= 7 && daysRemaining > 0;
          enhanced.isExpired = daysRemaining < 0;
        }

        // Calculate refills status
        if (med.refills !== undefined) {
          enhanced.refillsUsed = (med.refills - (med.refillsRemaining || 0));
          enhanced.needsRefill = med.refillsRemaining === 0 && med.status === 'active';
        }

        // Format display text
        enhanced.displayText = this.medicationHelpers.formatMedicationDisplay(med, practiceContext);

        return enhanced;
      });

      // Group medications by status
      const groupedMedications = {
        active: enhancedMedications.filter(m => m.status === 'active'),
        discontinued: enhancedMedications.filter(m => m.status === 'discontinued'),
        completed: enhancedMedications.filter(m => m.status === 'completed' || m.isExpired),
        all: enhancedMedications
      };
      
      // Format response based on requested view
      const viewType = params.view || 'all';
      const medicationsToReturn = viewType === 'grouped' ? groupedMedications : groupedMedications[params.status || 'all'];
      
      // Prepare grid data for display
      const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown';
      const gridData = Array.isArray(medicationsToReturn) ? medicationsToReturn.map(med => ({
        // Match field names to what medicalGridTemplateService expects
        patientName: patientName,
        medicationName: med.name || med.medication || med.medicationName,  // Grid expects 'medicationName'
        dosage: med.dosage || med.dose,
        frequency: med.frequency,
        route: med.route,  // CRITICAL: Was missing from grid!
        date: med.startDate || med.date,  // Grid expects 'date', data has 'startDate'
        provider: med.prescriber || med.prescribedBy || med.provider || 'Unknown',  // Grid expects 'provider', data has 'prescriber'
        status: med.status || 'active',
        refillsRemaining: med.refillsRemaining,
        notes: med.notes || med.instructions
      })) : [];

      // Wrap medications into a single document for the MedicationsListDocument template
      const wrappedDocument = {
        _id: `medications_${patientId}_all`,
        medications: enhancedMedications,  // MedicationsListDocument template expects this
        patientId: patientId,
        patientName: patientName,
        category: 'medications',
        title: `Current medications`,
        date: new Date().toISOString(),
        preview: `${enhancedMedications.length} medication${enhancedMedications.length === 1 ? '' : 's'}`
      };

      // Return artifact panel trigger with wrapped document data
      return {
        success: true,
        displayType: 'openArtifactPanel',
        artifactPanel: {
          patientId: patientId,
          category: 'medications',
          type: 'documents',  // Use document display for medications template
          data: [wrappedDocument]  // Pass wrapped document with medications array
        },
        data: gridData,  // Keep for backward compatibility
        count: Array.isArray(medicationsToReturn) ? medicationsToReturn.length : {
          active: groupedMedications.active.length,
          discontinued: groupedMedications.discontinued.length,
          completed: groupedMedications.completed.length,
          total: enhancedMedications.length
        },
        summary: this.medicationHelpers.generateMedicationSummary(groupedMedications, practiceContext),
        message: this.medicationHelpers.generateMedicationMessage(groupedMedications, practiceContext),
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error getting medications:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בטעינת תרופות: ${error.message}`
          : `Error loading medications: ${error.message}`
      };
    }
  }

async checkDrugInteractions(params, practiceContext, session) {
    try {
      // Extract patientId and check context (optional for drug interactions)
      let { patientId, ...interactionData } = params;
      
      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }
      
      // Parse medications if it's a JSON string (Claude sometimes sends stringified arrays)
      let medications = params.medications;
      if (typeof medications === 'string') {
        try {
          medications = JSON.parse(medications);
        } catch (e) {
          // If parsing fails, treat as single medication name
          medications = [medications];
        }
      }

      // Validate medications list
      if (!medications || !Array.isArray(medications) || medications.length === 0) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרשת רשימת תרופות'
          : 'Medications list is required');
      }

      // Update params with parsed array
      params.medications = medications;
      
      // Use the REAL drug information service with 185K+ interactions database
      const drugInformationService = require('./drugInformationService');

      // Check interactions using the comprehensive FDA database
      const fdaResult = await drugInformationService.checkDrugInteractions(params.medications, {
        userId: practiceContext.userId,
        practiceId: practiceContext.practiceId || practiceContext.subdomain || practiceContext.practiceSubdomain
      });

      // Transform FDA result structure to expected format
      const interactions = this._transformFDAInteractions(fdaResult);

      // Generate recommendations based on interactions
      const recommendations = this._generateInteractionRecommendations(
        interactions,
        practiceContext.language || 'en'
      );
      
      // Get patient allergies if available and check allergy-drug interactions
      let allergyInteractions = [];
      if (patientId && params.includeAllergies !== false && practiceContext.models?.Patient) {
        try {
          const Patient = practiceContext.models.Patient;
          const patient = await SecureDataAccess.query('patients', { _id: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(patientId) : patientId }, { limit: 1 }, {
    ...context
  })[0].select('allergies');
          
          if (patient?.allergies && patient.allergies.length > 0) {
            // Check each medication against patient's allergies
            params.medications.forEach(med => {
              const medName = typeof med === 'string' ? med : (med.name || med.medicationName);
              patient.allergies.forEach(allergy => {
                // Simple allergy check - in production, use comprehensive allergy database
                if (allergy.allergen?.toLowerCase().includes(medName.toLowerCase()) ||
                    medName.toLowerCase().includes(allergy.allergen?.toLowerCase())) {
                  allergyInteractions.push({
                    medication: medName,
                    allergen: allergy.allergen,
                    reaction: allergy.reaction || 'Unknown',
                    severity: allergy.severity || 'moderate'
                  });
                }
              });
            });
          }
        } catch (error) {
          console.log('Could not fetch patient allergies for interaction check:', error.message);
        }
      }
      
      // Build comprehensive interaction result
      const interactionResult = {
        patientId: patientId,
        medications: params.medications,
        interactions: {
          contraindicated: interactions.contraindicated || [],
          major: interactions.major || [],
          moderate: interactions.moderate || [],
          minor: interactions.minor || [],
          food: interactions.food || [],
          allergy: allergyInteractions
        },
        monitoring: interactions.monitoring || [],
        recommendations: recommendations,
        summary: {
          totalInteractions: 
            interactions.contraindicated.length + 
            interactions.major.length + 
            interactions.moderate.length + 
            interactions.minor.length +
            allergyInteractions.length,
          highestSeverity: interactions.contraindicated.length > 0 ? 'contraindicated' :
                          interactions.major.length > 0 ? 'major' :
                          interactions.moderate.length > 0 ? 'moderate' :
                          interactions.minor.length > 0 ? 'minor' : 'none',
          hasAllergyConflict: allergyInteractions.length > 0
        },
        timestamp: new Date().toISOString()
      };
      
      // Generate message based on severity
      let message;
      if (interactionResult.summary.highestSeverity === 'contraindicated') {
        message = practiceContext.language === 'he'
          ? '⚠️ אזהרה: יש תרופות שאסור לקחת יחד! יש להתייעץ עם רופא מיידית'
          : '⚠️ Warning: Contraindicated medications detected! Immediate medical consultation required';
      } else if (interactionResult.summary.highestSeverity === 'major') {
        message = practiceContext.language === 'he'
          ? '⚠️ נמצאו אינטראקציות משמעותיות בין התרופות. נדרשת התייעצות עם רופא'
          : '⚠️ Major drug interactions found. Medical consultation required';
      } else if (interactionResult.summary.highestSeverity === 'moderate') {
        message = practiceContext.language === 'he'
          ? `נמצאו ${interactionResult.summary.totalInteractions} אינטראקציות בינוניות`
          : `Found ${interactionResult.summary.totalInteractions} moderate interaction(s)`;
      } else if (interactionResult.summary.totalInteractions > 0) {
        message = practiceContext.language === 'he'
          ? `נמצאו ${interactionResult.summary.totalInteractions} אינטראקציות קלות`
          : `Found ${interactionResult.summary.totalInteractions} minor interaction(s)`;
      } else {
        message = practiceContext.language === 'he'
          ? '✅ לא נמצאו אינטראקציות בין התרופות'
          : '✅ No drug interactions found';
      }
      
      // Build detailed alerts
      const alerts = [];
      if (interactionResult.interactions.contraindicated.length > 0) {
        interactionResult.interactions.contraindicated.forEach(i => {
          alerts.push({ severity: 'critical', text: i.message });
        });
      }
      if (interactionResult.interactions.major.length > 0) {
        interactionResult.interactions.major.forEach(i => {
          alerts.push({ severity: 'high', text: i.message });
        });
      }
      if (allergyInteractions.length > 0) {
        allergyInteractions.forEach(a => {
          alerts.push({ 
            severity: 'high', 
            text: `${a.medication} may cause ${a.reaction} due to ${a.allergen} allergy` 
          });
        });
      }
      
      return {
        success: true,
        data: interactionResult,
        hasInteractions: interactionResult.summary.totalInteractions > 0,
        hasMajorInteractions: interactionResult.summary.highestSeverity === 'major' || 
                             interactionResult.summary.highestSeverity === 'contraindicated',
        interactionCount: interactionResult.summary.totalInteractions,
        alerts: alerts,
        recommendations: recommendations,
        message: message
      };
      
    } catch (error) {
      console.error('Error checking drug interactions:', error);
      return {
        success: false,
        error: error.message,
        hasInteractions: false,
        message: practiceContext.language === 'he' 
          ? `שגיאה בבדיקת אינטראקציות: ${error.message}`
          : `Error checking interactions: ${error.message}`
      };
    }
  }

async checkDrugAllergy(params, practiceContext, session) {
    try {
      console.log('💊 CHECKING DRUG ALLERGY via Internal Database');

      // Support multiple parameter names: drugName (from Claude), drug, medication
      const drugName = params.drugName || params.drug || params.medication;
      const patientId = params.patientId;

      // Validate required parameters
      if (!drugName) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש שם התרופה לבדיקה'
          : 'Medication name is required');
      }

      if (!patientId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה מטופל'
          : 'Patient ID is required');
      }

      const context = this.createSecureContext(practiceContext, 'check_drug_allergy');
      const patientIdObj = this.parseObjectId(patientId);

      // Query patient's allergies from database
      const allergies = await this._secureDataAccess.query(
        'allergies',
        { patientId: patientIdObj },
        {},
        context
      );

      console.log(`📋 Found ${allergies?.length || 0} allergies for patient`);

      // If no allergies, drug is safe
      if (!allergies || allergies.length === 0) {
        return {
          success: true,
          isSafe: true,
          hasAllergy: false,
          drugName: drugName,
          message: practiceContext.language === 'he'
            ? `✅ ${drugName} בטוח - למטופל אין אלרגיות ידועות`
            : `✅ ${drugName} is safe - patient has no known allergies`,
          allergyStatus: 'No known allergies',
          matchedAllergies: []
        };
      }

      // Check for direct allergy match or cross-reactivity
      const drugLower = drugName.toLowerCase();
      const matchedAllergies = [];

      for (const allergy of allergies) {
        const allergen = (allergy.allergen || allergy.substance || '').toLowerCase();

        // Direct match
        if (allergen.includes(drugLower) || drugLower.includes(allergen)) {
          matchedAllergies.push({
            allergen: allergy.allergen || allergy.substance,
            severity: allergy.severity || 'unknown',
            reaction: allergy.reaction || allergy.symptoms,
            type: 'direct'
          });
        }
      }

      // Check clinical decision support for drug interactions
      const cdsWarnings = await this._secureDataAccess.query(
        'clinical_decision_support',
        {
          patientId: patientIdObj,
          $or: [
            { 'drugInteractions.drug1': new RegExp(drugName, 'i') },
            { 'drugInteractions.drug2': new RegExp(drugName, 'i') },
            { 'contraindications.medication': new RegExp(drugName, 'i') }
          ]
        },
        { limit: 10 },
        context
      );

      console.log(`⚠️ Found ${cdsWarnings?.length || 0} CDS warnings for ${drugName}`);

      const isSafe = matchedAllergies.length === 0;

      return {
        success: true,
        isSafe: isSafe,
        hasAllergy: !isSafe,
        drugName: drugName,
        matchedAllergies: matchedAllergies,
        cdsWarnings: cdsWarnings || [],
        totalAllergies: allergies.length,
        message: isSafe
          ? (practiceContext.language === 'he'
              ? `✅ ${drugName} בטוח למטופל`
              : `✅ ${drugName} is safe for the patient`)
          : (practiceContext.language === 'he'
              ? `⚠️ אזהרה: ${drugName} עלול לגרום לתגובה אלרגית`
              : `⚠️ Warning: ${drugName} may cause allergic reaction`),
        warnings: matchedAllergies.map(a =>
          `Patient has known ${a.severity || ''} allergy to ${a.allergen}`
        )
      };
    } catch (error) {
      console.error('Error checking drug allergy:', error);
      throw error;
    }
  }

/**
   * Sync active prescriptions to medications collection
   * Called when prescription becomes active to create corresponding medication entry
   *
   * @param {string} prescriptionId - ID of the active prescription
   * @param {Object} prescription - Prescription document
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Sync result
   */
async syncActivePrescriptionToMedication(prescriptionId, prescription, practiceContext) {
    try {
      const context = this.createSecureContext(practiceContext, 'sync_prescription_to_medication');

      // CRITICAL FIX: Handle medications field that might be stored as JSON string
      let prescriptionMedications = prescription.medications;

      // If medications is a JSON string, parse it
      if (typeof prescriptionMedications === 'string') {
        try {
          prescriptionMedications = JSON.parse(prescriptionMedications);
          console.log(`[syncActivePrescriptionToMedication] Parsed medications from JSON string`);
        } catch (e) {
          console.warn(`[syncActivePrescriptionToMedication] Failed to parse medications JSON: ${e.message}`);
          return { success: false, reason: 'invalid_medications_format' };
        }
      }

      // Extract first medication from prescription (prescriptions can have multiple)
      if (!prescriptionMedications || !Array.isArray(prescriptionMedications) || prescriptionMedications.length === 0) {
        console.warn(`[syncActivePrescriptionToMedication] Prescription ${prescriptionId} has no medications`);
        return { success: false, reason: 'no_medications' };
      }

      const syncResults = [];

      for (const med of prescriptionMedications) {
        const medName = med.medicationName || med.name;
        const medDosage = med.dosage || `${med.strength}${med.unit || 'mg'}` || 'Unknown';

        // ENHANCED DUPLICATE CHECK: Use buildMedicationFilter to check for active, non-expired medications
        // This prevents duplicates from server reboots while allowing refills for expired medications
        const medicationFilter = this.buildMedicationFilter(
          {
            patientId: prescription.patientId,
            name: medName,
            dosage: medDosage
          },
          { includeExpired: false, includeInactive: false }  // Only check active, non-expired
        );

        const existingMedications = await SecureDataAccess.query(
          'medications',
          medicationFilter,
          { limit: 1 },
          context
        );

        if (existingMedications.length > 0) {
          const existing = existingMedications[0];
          console.log(`[syncActivePrescriptionToMedication] Medication already exists and not expired: ${medName} ${medDosage} (ID: ${existing._id}, expires: ${existing.endDate}, source: ${existing.source || 'unknown'})`);
          syncResults.push({
            medicationName: medName,
            medicationId: existing._id,
            status: 'already_exists',
            endDate: existing.endDate
          });
          continue;
        }

        // Calculate end date from validUntil or duration
        let endDate = new Date(prescription.validUntil);
        const durationDays = prescription.durationDays ||
                           (prescription.duration ? this._parseDurationToDays(prescription.duration) : 30);

        // If duration suggests medication runs out before prescription expires, use earlier date
        const prescriptionEndDate = new Date(prescription.startDate);
        prescriptionEndDate.setDate(prescriptionEndDate.getDate() + durationDays);

        if (prescriptionEndDate < endDate) {
          endDate = prescriptionEndDate;
        }

        // Extract and flatten name (handle both string and object formats)
        let medicationName = med.medicationName || med.name || 'Unknown';
        if (typeof medicationName === 'object' && medicationName !== null) {
          medicationName = medicationName.genericName || medicationName.name || 'Unknown';
        }

        // Extract and flatten dosage (handle both string and object formats)
        let medicationDosage = med.dosage || `${med.strength}${med.unit || 'mg'}` || 'Unknown';
        if (typeof medicationDosage === 'object' && medicationDosage !== null) {
          medicationDosage = medicationDosage.amount || medicationDosage.strength || 'Unknown';
        }

        // Create medication entry from prescription
        const medicationEntry = {
          patientId: prescription.patientId,
          documentId: med.documentId || prescription.documentId || null,
          name: medicationName,  // Now guaranteed to be a string
          genericName: med.genericName || null,
          dosage: medicationDosage,  // Now guaranteed to be a string
          frequency: med.frequency || 'As prescribed',
          route: med.route || 'oral',
          startDate: new Date(prescription.startDate),
          endDate: endDate,
          duration: prescription.duration || med.duration || '',
          durationDays: durationDays,
          durationUnit: 'days',
          prescriber: med.prescriber || prescription.prescribedBy || prescription.prescriberName || 'Unknown',
          indication: med.indication || prescription.indication || null,
          instructions: med.instructions || prescription.instructions || '',
          active: true,
          source: 'document_analysis',  // Match the source format from prescription sync
          drugInteractions: med.drugInteractions || prescription.drugInteractions || null,
          safetyWarning: med.safetyWarning || prescription.safetyWarning || null,
          prescriptionId: prescriptionId,
          aiProcessed: true  // Set to true since it came from prescription
          // ✅ Removed manual timestamps - SecureDataAccess.insert() automatically adds practice-local timestamps
          // (createdAt, createdAtUTC, createdAtTimezone, updatedAt, updatedAtUTC, updatedAtTimezone)
        };

        // DUAL WRITE #1: Insert into medications collection
        const insertedMedication = await SecureDataAccess.insert(
          'medications',
          medicationEntry,
          context
        );

        console.log(`[syncActivePrescriptionToMedication] Created medication from prescription: ${medicationEntry.name} (${insertedMedication._id})`);

        // NOTE: Removed DUAL WRITE to patient.currentMedications (November 2025)
        // Medications are stored in the 'medications' collection only.
        // getMedications() queries by patientId - no embedded data needed.
        // This follows proper MongoDB document model (reference pattern).

        // Register medication for expiration monitoring
        if (insertedMedication && insertedMedication._id && medicationEntry.endDate) {
          try {
            const prescriptionMonitoringService = require('./prescriptionMonitoringService');
            await prescriptionMonitoringService.registerMedication(
              {
                _id: insertedMedication._id,
                patientId: medicationEntry.patientId,
                endDate: medicationEntry.endDate
              },
              practiceContext.subdomain
            );
            console.log(`✅ [syncActivePrescriptionToMedication] Registered medication ${insertedMedication._id} for expiration monitoring (endDate: ${medicationEntry.endDate})`);
          } catch (error) {
            console.error(`⚠️ [syncActivePrescriptionToMedication] Failed to register for expiration monitoring:`, error.message);
            // Don't fail the sync if registration fails
          }
        }

        syncResults.push({
          medicationName: medicationEntry.name,
          medicationId: insertedMedication._id,
          status: 'synced'
        });
      }

      return {
        success: true,
        prescriptionId: prescriptionId,
        results: syncResults,
        message: `Synced ${syncResults.filter(r => r.status === 'synced').length} medications from prescription`
      };

    } catch (error) {
      console.error('[syncActivePrescriptionToMedication] Error:', error);
      return {
        success: false,
        error: error.message,
        prescriptionId: prescriptionId
      };
    }
  }

  /**
   * Helper: Parse duration string to days
   * Examples: "7 days", "1 week", "2 months"
   */
  _parseDurationToDays(durationStr) {
    if (!durationStr) return 30; // Default

    const durationLower = durationStr.toLowerCase();
    const match = durationStr.match(/(\d+)/);
    const number = match ? parseInt(match[1]) : 1;

    if (durationLower.includes('day')) return number;
    if (durationLower.includes('week')) return number * 7;
    if (durationLower.includes('month')) return number * 30;
    if (durationLower.includes('year')) return number * 365;

    return 30; // Default fallback
  }

async sendMedicationRefillReminders(params, practiceContext, session) {
    try {
      const { patientId, medicationType, daysBeforeExpiry = 7, method = 'sms' } = params;
      const isHebrew = session.language === 'he';
      
      // Calculate expiry date threshold
      const expiryThreshold = new Date();
      expiryThreshold.setDate(expiryThreshold.getDate() + daysBeforeExpiry);
      
      // Build query for prescriptions
      let query = { 
        practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId,
        status: 'active',
        expiryDate: { $lte: expiryThreshold }
      };
      
      if (patientId) {
        query.patientId = patientId;
      }
      
      if (medicationType) {
        query.medicationType = medicationType;
      }
      
      // Only get prescriptions that haven't been reminded recently
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      query.$or = [
        { lastRefillReminder: { $lt: oneWeekAgo } },
        { lastRefillReminder: null }
      ];
      
      const prescriptions = await SecureDataAccess.query(
        'prescriptions',
        query,
        { limit: 100, sort: { expiryDate: 1 } },
        {
          serviceId: this.serviceToken || 'agent-service',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      if (prescriptions.length === 0) {
        return {
          success: true,
          message: isHebrew 
            ? 'לא נמצאו מרשמים הדורשים תזכורת'
            : 'No prescriptions found requiring refill reminders',
          sent: 0
        };
      }
      
      let sent = 0;
      const errors = [];
      
      for (const prescription of prescriptions) {
        try {
          // Get patient details
          const patientResults = await SecureDataAccess.query(
            'patients',
            { _id: prescription.patientId }, { limit: 1 },
            {
              serviceId: this.serviceToken || 'agent-service',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId
            }
          );

          const patient = patientResults[0];
          
          if (!patient) continue;
          
          const daysLeft = Math.ceil((new Date(prescription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
          
          const reminderMessage = isHebrew 
            ? `תזכורת: המרשם שלך ל${prescription.medicationName} יפוג בעוד ${daysLeft} ימים. אנא צרו קשר לחידוש המרשם.`
            : `Reminder: Your prescription for ${prescription.medicationName} will expire in ${daysLeft} days. Please contact us to renew your prescription.`;
          
          // Send reminder based on method
          if ((method === 'sms' || method === 'both') && patient.phone) {
            await this.callAPI('/communication/sms', 'POST', {
              patientId: patient._id,
              message: reminderMessage,
              type: 'medication_refill'
            }, practiceContext);
            sent++;
          }
          
          if ((method === 'email' || method === 'both') && patient.email) {
            await this.callAPI('/communication/email', 'POST', {
              patientId: patient._id,
              subject: isHebrew ? 'תזכורת חידוש מרשם' : 'Prescription Refill Reminder',
              body: reminderMessage
            }, practiceContext);
            sent++;
          }
          
          // Mark reminder as sent
          await SecureDataAccess.update(
            'prescriptions',
            { _id: prescription._id },
            { lastRefillReminder: new Date() },
            {
              serviceId: this.serviceToken || 'agent-service',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId
            }
          );
          
        } catch (error) {
          errors.push({
            prescriptionId: prescription._id,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        message: isHebrew 
          ? `נשלחו ${sent} תזכורות חידוש מרשם`
          : `Sent ${sent} medication refill reminders`,
        sent,
        totalPrescriptions: prescriptions.length,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      console.error('Error sending medication refill reminders:', error);
      return {
        success: false,
        message: session.language === 'he' 
          ? 'שגיאה בשליחת תזכורות מרשם' 
          : 'Error sending medication refill reminders',
        error: error.message
      };
    }
  }

  /**
   * Transform FDA drug interaction result to expected format
   * FDA returns: { medications, totalInteractions, contraindicated: count, majorInteractions: count, interactions: [...] }
   * We need: { contraindicated: [], major: [], moderate: [], minor: [], food: [], monitoring: [] }
   * @private
   */
  _transformFDAInteractions(fdaResult) {
    const result = {
      contraindicated: [],
      major: [],
      moderate: [],
      minor: [],
      food: [],
      monitoring: []
    };

    // Transform FDA interactions array into categorized arrays
    if (fdaResult.interactions && Array.isArray(fdaResult.interactions)) {
      fdaResult.interactions.forEach(interaction => {
        const severity = interaction.severity?.toUpperCase() || 'MINOR';
        const interactionData = {
          medications: [interaction.drug1, interaction.drug2],
          description: interaction.description,
          severity: severity.toLowerCase(),
          action: this._getActionForSeverity(severity),
          source: interaction.source || 'FDA',
          fda_verified: interaction.fda_verified || false
        };

        // Categorize by severity
        if (severity === 'CONTRAINDICATED') {
          result.contraindicated.push(interactionData);
        } else if (severity === 'MAJOR') {
          result.major.push(interactionData);
          result.monitoring.push({
            medications: [interaction.drug1, interaction.drug2],
            monitoring: 'Regular lab tests and clinical assessment recommended'
          });
        } else if (severity === 'MODERATE') {
          result.moderate.push(interactionData);
        } else {
          result.minor.push(interactionData);
        }
      });
    }

    return result;
  }

  /**
   * Get recommended action based on interaction severity
   * @private
   */
  _getActionForSeverity(severity) {
    const actions = {
      'CONTRAINDICATED': 'Avoid combination - consult prescriber immediately',
      'MAJOR': 'Close monitoring required - consult prescriber',
      'MODERATE': 'Monitor for adverse effects',
      'MINOR': 'Be aware of potential interaction'
    };
    return actions[severity] || 'Consult healthcare provider';
  }

  /**
   * Generate recommendations based on interactions
   * @private
   */
  _generateInteractionRecommendations(interactions, language = 'en') {
    const recommendations = [];

    // Contraindicated medications
    if (interactions.contraindicated.length > 0) {
      recommendations.push({
        priority: 'critical',
        message: language === 'he'
          ? 'זוהו תרופות אסורות לשימוש יחד - יש להתייעץ עם רופא מיידית'
          : 'Contraindicated medications detected - immediate medical consultation required',
        actions: interactions.contraindicated.map(i => ({
          description: `${i.medications.join(' + ')}: ${i.description}`,
          recommendation: i.action
        }))
      });
    }

    // Major interactions
    if (interactions.major.length > 0) {
      recommendations.push({
        priority: 'high',
        message: language === 'he'
          ? 'זוהו אינטראקציות משמעותיות - נדרש ניטור צמוד'
          : 'Major interactions detected - close monitoring required',
        actions: interactions.major.map(i => ({
          description: `${i.medications.join(' + ')}: ${i.description}`,
          recommendation: i.action
        }))
      });
    }

    // Moderate interactions
    if (interactions.moderate.length > 0) {
      recommendations.push({
        priority: 'medium',
        message: language === 'he'
          ? 'זוהו אינטראקציות בינוניות - מומלץ לעקוב אחר תופעות לוואי'
          : 'Moderate interactions detected - monitor for adverse effects',
        actions: interactions.moderate.map(i => ({
          description: `${i.medications.join(' + ')}: ${i.description}`,
          recommendation: i.action
        }))
      });
    }

    // Food interactions
    if (interactions.food.length > 0) {
      recommendations.push({
        priority: 'low',
        message: language === 'he'
          ? 'זוהו אינטראקציות עם מזון - יש להקפיד על הנחיות השימוש'
          : 'Food interactions detected - follow administration guidelines',
        actions: interactions.food.map(i => ({
          description: `${i.medication} + ${i.food}: ${i.description}`,
          recommendation: i.action
        }))
      });
    }

    // No interactions found
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'info',
        message: language === 'he'
          ? 'לא זוהו אינטראקציות בין התרופות'
          : 'No significant drug interactions detected',
        actions: [{
          description: language === 'he'
            ? 'אין צורך בפעולה מיוחדת כרגע'
            : 'No special action required at this time',
          recommendation: language === 'he'
            ? 'המשך לקיחת התרופות לפי הוראות הרופא'
            : 'Continue medications as prescribed'
        }]
      });
    }

    return recommendations;
  }

}

module.exports = new MedicationService();
