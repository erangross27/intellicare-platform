/**
 * LabService
 *
 * Domain: lab
 * Extracted from: agentServiceV4.js
 * Functions: 19
 *
 * Purpose: Handle all lab, imaging, vital signs, and vaccination operations
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
const { ObjectId } = require('mongodb');

class LabService {
  constructor() {
    this.serviceName = 'labService';
    this.serviceAuth = null;
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

  // ============================================================================
  // SERVICE FUNCTIONS - EXTRACTED FROM agentServiceV4.js
  // ============================================================================

async addLabResult(params, practiceContext, session) {
    try {
      // Extract patientId separately to check context
      let { patientId, ...labData } = params;
      
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
      
      if (!params.testType) {
        throw new Error(practiceContext.language === 'he' 
          ? 'סוג הבדיקה חסר' 
          : 'Test type is required');
      }
      
      if (!params.results || Object.keys(params.results).length === 0) {
        throw new Error(practiceContext.language === 'he' 
          ? 'תוצאות הבדיקה חסרות' 
          : 'Test results are required');
      }
      
      // Get patient info for age/gender-specific reference ranges
      let patient = null;
      try {
        const patientResponse = await this.callAPI(`/patients/${patientId}`, 'GET', {}, practiceContext);
        patient = patientResponse.data;
      } catch (error) {
        console.log('Could not fetch patient data for lab analysis');
      }

      // Structure enhanced lab data (use results directly if they exist)
      const enhancedLabData = {
        patientId: patientId,
        testType: params.testType,
        testDate: params.testDate || new Date().toISOString(),
        labName: params.labName,
        orderedBy: params.orderedBy || practiceContext.userId || 'agent',

        // Results data - use what was provided
        results: params.results || {},
        methodology: params.methodology,
        specimen: params.specimen || 'blood',
        fastingStatus: params.fastingStatus,
        
        // Metadata
        recordedBy: practiceContext.userId || 'agent',
        recordedAt: new Date().toISOString(),
        status: 'final',
        version: 1
      };
      
      // Save lab result
      const response = await this.callAPI(
        `/medical-data/patients/${patientId}/lab-results`, 
        'POST', 
        enhancedLabData, 
        practiceContext
      );
      
      return {
        success: true,
        data: response.data,
        labResultId: response.data._id || response.data.id,
        testType: params.testType,
        message: `Lab result for ${params.testType} added successfully`,
        summary: {
          testType: params.testType,
          testDate: enhancedLabData.testDate,
          status: 'final'
        }
      };
      
    } catch (error) {
      console.error('Error adding lab result:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בהוספת תוצאות מעבדה: ${error.message}`
          : `Error adding lab result: ${error.message}`
      };
    }
  }

async getLabResults(params, practiceContext, session) {
    try {
      // Initialize service authentication if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      // Extract all possible identifiers
      let { patientId, nationalId, ssn, ...queryOptions } = params;

      // Resolve SSN/nationalId to patientId if needed
      if ((ssn || nationalId) && !patientId) {
        const patientService = require('./patientService');
        const identifier = ssn || nationalId;
        const identifierType = ssn ? 'SSN' : 'National ID';

        console.log(`🔍 Resolving patient by ${identifierType}: ${identifier}`);

        // Build temporary context for patient search
        const searchContext = this.createSecureContext(practiceContext, 'search_patient_for_labs');

        const searchResult = await patientService.searchPatients({ query: identifier }, practiceContext, session, searchContext);

        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const patient = searchResult.data[0];
          const rawId = patient._id || patient.patientId;
          patientId = rawId && typeof rawId === 'object' && rawId.toString ? rawId.toString() : rawId;
          const patientName = patient.name || `${patient.firstName} ${patient.lastName}`.trim();
          console.log(`✅ Resolved to patient: ${patientName} (ID: ${patientId})`);
        } else {
          throw new Error(`No patient found with ${identifierType} ${identifier}`);
        }
      }

      // Check context if still no patientId
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }

      // Validate patient ID
      if (!patientId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה'
          : 'Patient ID required. Please search for a patient first');
      }

      // Build security context for SecureDataAccess - use service's own authentication
      const context = this.createSecureContext(practiceContext, 'get_lab_results');

      // Build query filter - convert patientId to ObjectId if needed
      const filter = {
        patientId: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId
      };

      // Add date range filters
      if (params.dateFrom || params.dateTo) {
        filter.testDate = {};
        if (params.dateFrom) filter.testDate.$gte = new Date(params.dateFrom);
        if (params.dateTo) filter.testDate.$lte = new Date(params.dateTo);
      }

      // Add test type filters
      if (params.testType) filter.testType = params.testType;
      if (params.testCategory) filter.testCategory = params.testCategory;
      if (params.status) filter.status = params.status;

      // Build query options
      const queryOpts = {
        sort: { testDate: params.sort === 'asc' ? 1 : -1 },
        limit: params.limit || 100
      };

      // Query lab results directly using SecureDataAccess
      let labResults = await SecureDataAccess.query('lab_results', filter, queryOpts, context);

      // Apply abnormal/critical filters after query if needed
      if (params.abnormalOnly) {
        labResults = labResults.filter(result => result.abnormalFlags?.length > 0);
      }
      if (params.criticalOnly) {
        labResults = labResults.filter(result => result.criticalFlags?.length > 0);
      }

      console.log(`✅ Found ${labResults.length} lab results for patient ${patientId}`);

      // Get patient name for display
      const patients = await SecureDataAccess.query('patients',
        { _id: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(patientId) : patientId },
        { limit: 1 },
        context
      );

      const patient = patients && patients.length > 0 ? patients[0] : null;
      const patientName = patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown' : 'Unknown';

      if (!labResults || labResults.length === 0) {
        return {
          success: true,
          data: [],
          count: 0,
          message: practiceContext.language === 'he'
            ? 'לא נמצאו תוצאות מעבדה'
            : 'No lab results found',
          displayType: 'openArtifactPanel',
          artifactPanel: {
            patientId: patientId,
            category: 'lab_results',
            type: 'documents',
            data: []
          }
        };
      }

      // Wrap lab results into a single document for the LabResultsDocument template
      const wrappedDocument = {
        _id: `lab_results_${patientId}_all`,
        lab_results: labResults,  // LabResultsDocument template expects this
        patientId: patientId,
        patientName: patientName,
        category: 'lab_results',
        title: `Laboratory Results`,
        date: new Date().toISOString(),
        preview: `${labResults.length} lab result${labResults.length === 1 ? '' : 's'}`
      };

      // Return artifact panel trigger with wrapped document data
      return {
        success: true,
        displayType: 'openArtifactPanel',
        artifactPanel: {
          patientId: patientId,
          category: 'lab_results',
          type: 'documents',  // Use document display for lab results template
          data: [wrappedDocument]  // Pass wrapped document with lab_results array
        },
        data: labResults,  // Keep for backward compatibility
        count: labResults.length,
        message: practiceContext.language === 'he'
          ? `נמצאו ${labResults.length} תוצאות מעבדה`
          : `Found ${labResults.length} lab results`
      };
      
    } catch (error) {
      console.error('Error getting lab results:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בטעינת תוצאות מעבדה: ${error.message}`
          : `Error loading lab results: ${error.message}`
      };
    }
  }

async interpretLabResults(params, practiceContext, session) {
    try {
      console.log('🔬 INTERPRETING LAB RESULTS via Gemini Medical Service');
      
      // Validate lab results
      if (!params.labResults && !params.results) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרשות תוצאות מעבדה לפענוח' 
          : 'Lab results are required for interpretation');
      }
      
      // Use the lab result interpreter service which now uses Gemini
      const labResultInterpreter = require('./labResultInterpreter');
      
      // Get lab results
      const labResults = params.labResults || params.results;
      
      // Prepare patient context
      const patientContext = {
        age: params.patientAge,
        gender: params.patientGender,
        medicalHistory: params.medicalHistory || [],
        medications: params.medications || []
      };
      
      // Interpret using Gemini Medical Service
      const result = await labResultInterpreter.interpret(
        labResults,
        patientContext,
        params.previousResults || [],
        practiceContext.language || 'en'
      );
      
      // Format response
      let message = '';
      const hasCritical = result.criticalValues?.length > 0;
      const hasAbnormal = result.abnormalValues?.length > 0;
      
      if (hasCritical) {
        message = practiceContext.language === 'he'
          ? `🚨 ${result.criticalValues.length} ערכים קריטיים דורשים התייחסות מיידית!`
          : `🚨 ${result.criticalValues.length} critical values require immediate attention!`;
      } else if (hasAbnormal) {
        message = practiceContext.language === 'he'
          ? `⚠️ ${result.abnormalValues.length} ערכים חריגים נמצאו`
          : `⚠️ ${result.abnormalValues.length} abnormal values found`;
      } else {
        message = practiceContext.language === 'he'
          ? '✅ כל תוצאות המעבדה בטווח התקין'
          : '✅ All lab results within normal range';
      }
      
      return {
        success: true,
        results: result.results,
        criticalValues: result.criticalValues,
        abnormalValues: result.abnormalValues,
        patterns: result.patterns,
        deltaChecks: result.deltaChecks,
        recommendations: result.recommendations,
        suggestedTests: result.suggestedTests,
        summary: result.summary,
        message: message,
        details: result
      };
    } catch (error) {
      console.error('Error interpreting lab results:', error);
      throw error;
    }
  }

async addImagingResult(params, practiceContext) {
    const imagingData = {
      patientId: params.patientId,
      imagingType: params.imagingType,
      bodyPart: params.bodyPart,
      date: params.date || new Date().toISOString(),
      findings: params.findings,
      radiologistNotes: params.radiologistNotes,
      urgentFindings: params.urgentFindings || false,
      uploadedBy: practiceContext.userId || 'agent'
    };
    
    const addImagingContext = {
      serviceId: this.serviceName,
      operation: 'add_imaging_result',
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
      apiKey: this.serviceAuth?.apiKey || this.serviceToken
    };

    const newImaging = await SecureDataAccess.insert(
      'imaging_results',
      {
        ...imagingData,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      addImagingContext
    );

    return {
      success: true,
      data: newImaging,
      message: practiceContext.language === 'he'
        ? `תוצאות ה${params.imagingType} נוספו בהצלחה`
        : `${params.imagingType} results added successfully`
    };
  }

async getImagingResults(params, practiceContext) {
    const { patientId, imagingType, dateFrom, dateTo } = params;
    
    const queryParams = {};
    if (imagingType) queryParams.imagingType = imagingType;
    if (dateFrom) queryParams.dateFrom = dateFrom;
    if (dateTo) queryParams.dateTo = dateTo;
    
    const getImagingContext = {
      serviceId: this.serviceName,
      operation: 'get_imaging_results',
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
      apiKey: this.serviceAuth?.apiKey || this.serviceToken
    };

    const filter = { patientId };
    if (imagingType) filter.imagingType = imagingType;
    if (dateFrom || dateTo) {
      filter.studyDate = {};
      if (dateFrom) filter.studyDate.$gte = new Date(dateFrom);
      if (dateTo) filter.studyDate.$lte = new Date(dateTo);
    }

    const imagingResults = await SecureDataAccess.query(
      'imaging_results',
      filter,
      { sort: { studyDate: -1 } },
      getImagingContext
    );

    return {
      success: true,
      data: imagingResults,
      count: imagingResults.length,
      message: practiceContext.language === 'he'
        ? `נמצאו ${imagingResults.length} תוצאות הדמיה`
        : `Found ${imagingResults.length} imaging results`
    };
  }

async addVitalSigns(params, practiceContext, session) {
    try {
      // Extract patientId separately to check context
      let { patientId, ...vitalData } = params;
      
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
      
      // Validate at least one vital sign is provided
      const vitalFields = ['bloodPressure', 'pulse', 'temperature', 'oxygenSaturation', 'respiratoryRate', 'weight', 'height'];
      const providedVitals = vitalFields.filter(field => params[field] !== undefined && params[field] !== null);
      
      if (providedVitals.length === 0) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש לפחות סימן חיוני אחד' 
          : 'At least one vital sign is required');
      }
      
      // Get patient info for validation
      let patient = null;
      try {
        const patientResponse = await this.callAPI(`/patients/${patientId}`, 'GET', {}, practiceContext);
        patient = patientResponse.data;
      } catch (error) {
        console.log('Could not fetch patient data for vital signs validation');
      }
      
      // Validate and analyze vital signs
      const vitalAnalysis = this.analyzeVitalSigns(params, patient);
      
      // Structure enhanced vital signs data
      const enhancedVitalData = {
        patientId: patientId,
        recordedAt: params.recordedAt || new Date().toISOString(),
        recordedBy: params.recordedBy || practiceContext.userId || 'agent',
        
        // Core vital signs
        bloodPressure: params.bloodPressure,
        pulse: params.pulse,
        temperature: params.temperature,
        oxygenSaturation: params.oxygenSaturation,
        respiratoryRate: params.respiratoryRate,
        weight: params.weight,
        height: params.height,
        
        // Additional measurements
        painScale: params.painScale,
        glucoseLevel: params.glucoseLevel,
        bmi: this.calculateBMI(params.weight, params.height),
        
        // Analysis results
        analysis: vitalAnalysis.analysis,
        alerts: vitalAnalysis.alerts,
        overallStatus: vitalAnalysis.overallStatus,
        abnormalFlags: vitalAnalysis.abnormalFlags,
        criticalFlags: vitalAnalysis.criticalFlags,
        
        // Context
        location: params.location || 'practice',
        position: params.position || 'sitting',
        activity: params.activity || 'resting',
        notes: params.notes,
        
        // Metadata
        version: 1,
        status: 'final'
      };
      
      // Calculate BMI if weight and height provided
      if (params.weight && params.height) {
        enhancedVitalData.bmi = this.calculateBMI(params.weight, params.height);
      } else if (params.weight && patient?.height) {
        enhancedVitalData.bmi = this.calculateBMI(params.weight, patient.height);
      }
      
      // Save vital signs using SecureDataAccess
      const securityContext = {
        serviceId: this.serviceName,
        operation: 'add_vital_signs',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      const response = await SecureDataAccess.insert(
        'vitals',
        {
          ...enhancedVitalData,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        securityContext
      );
      
      // Generate recommendations
      const recommendations = this.generateVitalSignsRecommendations(vitalAnalysis, practiceContext);
      
      return {
        success: true,
        data: response.data,
        vitalSignsId: response.data._id || response.data.id,
        overallStatus: vitalAnalysis.overallStatus,
        alerts: vitalAnalysis.alerts,
        abnormalCount: vitalAnalysis.abnormalFlags.length,
        criticalCount: vitalAnalysis.criticalFlags.length,
        bmi: enhancedVitalData.bmi,
        recommendations: recommendations,
        message: this.generateVitalSignsMessage(vitalAnalysis, providedVitals, practiceContext),
        summary: {
          recordedAt: enhancedVitalData.recordedAt,
          vitalsRecorded: providedVitals,
          status: vitalAnalysis.overallStatus,
          abnormalCount: vitalAnalysis.abnormalFlags.length,
          criticalCount: vitalAnalysis.criticalFlags.length
        }
      };
      
    } catch (error) {
      console.error('Error adding vital signs:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בהוספת סימנים חיוניים: ${error.message}`
          : `Error adding vital signs: ${error.message}`
      };
    }
  }

async getVitalSigns(params, practiceContext, session) {
    try {
      // Extract patientId separately to check context
      let { patientId, ...queryOptions } = params;

      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }

      // Validate patient ID
      if (!patientId) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה'
          : 'Patient ID required. Please search for a patient first');
      }

      // Build security context for SecureDataAccess
      const context = AgentServiceHelpers.buildSecurityContext(
        'agentServiceV4',
        this.serviceToken,
        practiceContext
      );

      // Get patient record first (following getMedications pattern exactly)
      // Convert string to ObjectId for _id queries - MongoDB requires ObjectId for _id field
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

      // Build query filter using patient._id from database (already ObjectId)
      const filter = { patientId: patient._id };

      // Add date filters if provided
      if (params.dateFrom || params.dateTo) {
        filter.date = {};
        if (params.dateFrom) filter.date.$gte = new Date(params.dateFrom);
        if (params.dateTo) filter.date.$lte = new Date(params.dateTo);
      }

      // Add vital type filter if provided
      if (params.vitalType) {
        filter.type = params.vitalType;
      }

      // Build query options
      const options = {
        sort: { date: params.sort === 'asc' ? 1 : -1 },
        limit: params.latestOnly ? 1 : (params.limit || 20)
      };

      // Query vital signs from database using SecureDataAccess
      const vitalSigns = await SecureDataAccess.query('vital_signs', filter, options, context);

      if (!vitalSigns || vitalSigns.length === 0) {
        return {
          success: true,
          data: [],
          count: 0,
          message: practiceContext.language === 'he'
            ? 'לא נמצאו מדידות סימנים חיוניים'
            : 'No vital signs found'
        };
      }

      // Process vital signs (vitalSigns is already an array from SecureDataAccess)
      const vitals = vitalSigns;

      // Format vital signs with basic date formatting
      const formattedVitals = vitals.map(vital => ({
        ...vital,
        formattedDate: vital.date ? new Date(vital.date).toLocaleString(
          practiceContext.language === 'he' ? 'he-IL' : 'en-US'
        ) : '-'
      }));

      // Build full patient name for display
      const fullPatientName = patient.firstName && patient.lastName
        ? `${patient.firstName} ${patient.lastName}`
        : patient.name || 'Patient';

      return {
        success: true,
        data: formattedVitals,
        count: formattedVitals.length,
        patientName: fullPatientName,  // CRITICAL: Include patient name for pinned grids
        patientId: patient._id.toString(),  // Include patientId for consistency
        message: practiceContext.language === 'he'
          ? `נמצאו ${formattedVitals.length} מדידות סימנים חיוניים`
          : `Found ${formattedVitals.length} vital signs records`
      };
      
    } catch (error) {
      console.error('Error getting vital signs:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בטעינת סימנים חיוניים: ${error.message}`
          : `Error loading vital signs: ${error.message}`
      };
    }
  }

async addVaccination(params, practiceContext, session) {
    try {
      // Extract patientId separately to check context
      let { patientId, ...vaccinationData } = params;
      
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
      
      if (!params.vaccineName) {
        throw new Error(practiceContext.language === 'he' 
          ? 'שם החיסון חסר' 
          : 'Vaccine name is required');
      }
      
      // Get patient info for age-appropriate vaccine validation
      const patientResponse = await this.callAPI(
        `/patients/${patientId}`, 
        'GET', 
        null, 
        practiceContext
      );
      const patient = patientResponse.data;
      
      // Validate vaccine appropriateness for patient age
      const ageValidation = this.validateVaccineForAge(params.vaccineName, patient.age);
      if (!ageValidation.appropriate && !params.override) {
        throw new Error(practiceContext.language === 'he' 
          ? `החיסון ${params.vaccineName} לא מומלץ לגיל ${patient.age}: ${ageValidation.reason}`
          : `Vaccine ${params.vaccineName} not recommended for age ${patient.age}: ${ageValidation.reason}`);
      }
      
      // Check for existing vaccinations to avoid duplicates
      const existingVaccinationsResponse = await this.callAPI(
        `/medical-data/patients/${patientId}/vaccinations`, 
        'GET', 
        { vaccineName: params.vaccineName }, 
        practiceContext
      );
      const existingVaccinations = existingVaccinationsResponse.data || [];
      
      // Check for recent duplicate
      const recentDuplicate = existingVaccinations.find(v => {
        const daysDifference = Math.abs(
          (new Date() - new Date(v.dateAdministered)) / (1000 * 60 * 60 * 24)
        );
        return daysDifference < 30; // Within 30 days
      });
      
      if (recentDuplicate && !params.allowDuplicate) {
        throw new Error(practiceContext.language === 'he' 
          ? `החיסון ${params.vaccineName} ניתן כבר ב-${new Date(recentDuplicate.dateAdministered).toLocaleDateString('he-IL')}`
          : `Vaccine ${params.vaccineName} was already given on ${new Date(recentDuplicate.dateAdministered).toLocaleDateString('en-US')}`);
      }
      
      // Determine vaccine series information
      const seriesInfo = this.getVaccineSeriesInfo(params.vaccineName, existingVaccinations);
      
      // Calculate next dose date if part of a series
      const nextDoseDate = this.calculateNextDoseDate(params.vaccineName, params.dateAdministered || new Date().toISOString(), seriesInfo);
      
      // Structure vaccination data
      const enhancedVaccinationData = {
        patientId: patientId,
        vaccineName: params.vaccineName,
        manufacturer: params.manufacturer,
        lotNumber: params.lotNumber,
        site: params.site || 'left arm', // Default injection site
        
        // Dates
        dateAdministered: params.dateAdministered || new Date().toISOString(),
        nextDoseDate: nextDoseDate,
        
        // Series information
        doseNumber: seriesInfo.nextDoseNumber,
        seriesComplete: seriesInfo.isComplete,
        
        // Clinical details
        administeredBy: params.administeredBy || practiceContext.userId || 'agent',
        practice: practiceContext.practiceId,
        notes: params.notes,
        
        // Adverse reactions
        adverseReactions: params.adverseReactions || 'none reported',
        
        // Verification
        verified: true,
        verifiedBy: practiceContext.userId || 'agent',
        verificationDate: new Date().toISOString(),
        
        // Metadata
        recordedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'completed'
      };
      
      // Save vaccination
      const response = await this.callAPI(
        `/medical-data/patients/${patientId}/vaccinations`, 
        'POST', 
        enhancedVaccinationData, 
        practiceContext
      );
      
      // Generate vaccination card/certificate info
      const vaccinationCard = this.generateVaccinationCard(enhancedVaccinationData, patient, practiceContext);
      
      // Generate reminders for next doses
      const reminders = this.generateVaccinationReminders(enhancedVaccinationData, practiceContext);
      
      return {
        success: true,
        data: response.data,
        vaccinationId: response.data._id || response.data.id,
        message: this.generateVaccinationMessage(enhancedVaccinationData, seriesInfo, practiceContext),
        vaccinationCard: vaccinationCard,
        nextDose: nextDoseDate ? {
          date: nextDoseDate,
          doseNumber: seriesInfo.nextDoseNumber + 1,
          message: practiceContext.language === 'he' 
            ? `המנה הבאה מתוכננת ל-${new Date(nextDoseDate).toLocaleDateString('he-IL')}`
            : `Next dose scheduled for ${new Date(nextDoseDate).toLocaleDateString('en-US')}`
        } : null,
        reminders: reminders,
        seriesInfo: seriesInfo,
        summary: {
          vaccine: params.vaccineName,
          dose: seriesInfo.nextDoseNumber,
          site: enhancedVaccinationData.site,
          date: enhancedVaccinationData.dateAdministered
        }
      };
      
    } catch (error) {
      console.error('Error adding vaccination:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה ברישום חיסון: ${error.message}`
          : `Error recording vaccination: ${error.message}`
      };
    }
  }

async getVaccinations(params, practiceContext, session) {
    try {
      // Extract patientId separately to check context
      let { patientId, ...queryOptions } = params;
      
      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }
      
      // Validate patient ID
      if (!patientId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
          : 'Patient ID required. Please search for a patient first');
      }
      
      // Build query parameters
      const queryParams = {
        includeScheduled: params.includeScheduled || false,
        includePending: params.includePending || false,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        vaccineType: params.vaccineType
      };
      
      // Get patient info for age-appropriate analysis
      const patientResponse = await this.callAPI(
        `/patients/${patientId}`, 
        'GET', 
        null, 
        practiceContext
      );
      const patient = patientResponse.data;
      
      // Get vaccinations
      const response = await this.callAPI(
        `/medical-data/patients/${patientId}/vaccinations`, 
        'GET', 
        queryParams, 
        practiceContext
      );
      
      if (!response.data || response.data.length === 0) {
        // Generate age-appropriate recommendations
        const recommendations = this.generateVaccinationRecommendations(patient, [], practiceContext);
        
        return {
          success: true,
          data: [],
          count: 0,
          recommendations: recommendations,
          message: practiceContext.language === 'he' 
            ? 'לא נמצאו חיסונים קודמים'
            : 'No previous vaccinations found'
        };
      }
      
      // Process and enhance vaccinations
      const vaccinations = Array.isArray(response.data) ? response.data : [response.data];
      
      const enhancedVaccinations = vaccinations.map(vaccination => {
        const enhanced = { ...vaccination };
        
        // Add series information
        const existingVaccinations = vaccinations.filter(v => 
          v.vaccineName.toLowerCase().includes(vaccination.vaccineName.toLowerCase().split(' ')[0])
        );
        enhanced.seriesInfo = this.getVaccineSeriesInfo(vaccination.vaccineName, existingVaccinations);
        
        // Calculate time since vaccination
        const timeSince = this.calculateTimeSinceVaccination(vaccination.dateAdministered);
        enhanced.timeSince = timeSince;
        
        // Check if booster is needed
        enhanced.boosterInfo = this.checkBoosterNeeded(vaccination, timeSince);
        
        // Format dates
        enhanced.formattedDate = new Date(vaccination.dateAdministered).toLocaleDateString(
          practiceContext.language === 'he' ? 'he-IL' : 'en-US'
        );
        
        // Add vaccination status
        enhanced.status = this.determineVaccinationStatus(vaccination, timeSince);
        
        return enhanced;
      });
      
      // Sort by date (most recent first)
      enhancedVaccinations.sort((a, b) => new Date(b.dateAdministered) - new Date(a.dateAdministered));
      
      // Group vaccinations
      const groupedVaccinations = this.groupVaccinations(enhancedVaccinations);
      
      // Generate vaccination schedule analysis
      const scheduleAnalysis = this.analyzeVaccinationSchedule(enhancedVaccinations, patient);
      
      // Generate recommendations for missing/due vaccinations
      const recommendations = this.generateVaccinationRecommendations(patient, enhancedVaccinations, practiceContext);
      
      // Generate alerts for overdue or expiring vaccinations
      const alerts = this.generateVaccinationAlerts(enhancedVaccinations, recommendations, practiceContext);
      
      // Generate summary
      const summary = this.generateVaccinationSummary(enhancedVaccinations, patient, practiceContext);
      
      return {
        success: true,
        data: enhancedVaccinations,
        grouped: groupedVaccinations,
        scheduleAnalysis: scheduleAnalysis,
        recommendations: recommendations,
        alerts: alerts,
        summary: summary,
        count: enhancedVaccinations.length,
        upToDateCount: enhancedVaccinations.filter(v => v.status === 'current').length,
        message: this.generateVaccinationsMessage(enhancedVaccinations, recommendations, practiceContext),
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error getting vaccinations:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בטעינת חיסונים: ${error.message}`
          : `Error loading vaccinations: ${error.message}`
      };
    }
  }

async getDoctorAvailability(params, practiceContext, session) {
    try {
      const isHebrew = session.language === 'he';
      const url = `/providers/${params.providerId}/availability${params.date ? `?date=${params.date}` : ''}`;
      const result = await this.callAPI(url, 'GET', {}, practiceContext);
      
      if (result.success && result.data) {
        let message = isHebrew 
          ? `זמינות ${result.data.providerName}:\n`
          : `Availability for ${result.data.providerName}:\n`;
        
        if (params.date && result.data.available !== undefined) {
          message += result.data.available 
            ? (isHebrew ? '✅ זמין בתאריך זה' : '✅ Available on this date')
            : (isHebrew ? '❌ לא זמין בתאריך זה' : '❌ Not available on this date');
          
          if (result.data.slots) {
            message += isHebrew ? '\n\nחלונות זמן:' : '\n\nTime slots:';
            result.data.slots.forEach(slot => {
              message += `\n• ${slot.startTime} - ${slot.endTime}`;
            });
          }
        } else if (result.data.regularSchedule) {
          const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
          const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          
          message += isHebrew ? '\nלוח זמנים שבועי:' : '\nWeekly schedule:';
          result.data.regularSchedule.forEach(day => {
            const dayName = isHebrew ? days[day.dayOfWeek] : daysEn[day.dayOfWeek];
            message += `\n${dayName}: `;
            day.slots.forEach((slot, i) => {
              if (i > 0) message += ', ';
              message += `${slot.startTime}-${slot.endTime}`;
            });
          });
        }
        
        return {
          success: true,
          message,
          data: result.data
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error getting provider availability:', error);
      return {
        success: false,
        message: session.language === 'he' ? 'שגיאה בקבלת זמינות' : 'Error getting availability',
        error: error.message
      };
    }
  }

async setDoctorAvailability(params, practiceContext, session) {
    try {
      const isHebrew = session.language === 'he';
      // INFRASTRUCTURE: Provider scheduling and availability management - Keep as callAPI
      const result = await this.callAPI(`/providers/${params.providerId}/availability`, 'POST', params, practiceContext);
      
      return {
        success: result.success,
        message: result.success 
          ? (isHebrew ? 'זמינות עודכנה בהצלחה' : 'Availability updated successfully')
          : result.error,
        data: result.data
      };
    } catch (error) {
      console.error('Error setting provider availability:', error);
      return {
        success: false,
        message: session.language === 'he' ? 'שגיאה בעדכון זמינות' : 'Error updating availability',
        error: error.message
      };
    }
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Calculate BMI (Body Mass Index)
   * @param {number} weight - Weight in kg
   * @param {number} height - Height in cm
   * @returns {string|null} BMI value with 1 decimal place, or null if missing data
   */
  calculateBMI(weight, height) {
    if (!weight || !height) return null;
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  }

  /**
   * Analyze vital signs for abnormalities and generate alerts
   * @param {Object} params - Vital signs parameters (current reading)
   * @param {Object} patient - Patient data for context (age, medical history)
   * @returns {Object} Analysis with alerts, flags, and overall status
   */
  analyzeVitalSigns(params, patient) {
    const analysis = {
      analysis: [],
      alerts: [],
      overallStatus: 'normal',
      abnormalFlags: [],
      criticalFlags: []
    };

    // Blood Pressure Analysis
    if (params.bloodPressure) {
      const [systolic, diastolic] = params.bloodPressure.split('/').map(v => parseInt(v.trim()));

      if (systolic >= 180 || diastolic >= 120) {
        analysis.criticalFlags.push('blood_pressure');
        analysis.overallStatus = 'critical';
        analysis.alerts.push({
          severity: 'CRITICAL',
          category: 'Blood Pressure',
          message: `Hypertensive crisis: ${params.bloodPressure} mmHg`,
          action: 'Immediate medical attention required'
        });
        analysis.analysis.push(`Critical hypertension detected (${params.bloodPressure})`);
      } else if (systolic >= 140 || diastolic >= 90) {
        analysis.abnormalFlags.push('blood_pressure');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'HIGH',
          category: 'Blood Pressure',
          message: `Hypertension stage 2: ${params.bloodPressure} mmHg`,
          action: 'Medication adjustment may be needed'
        });
        analysis.analysis.push(`Elevated blood pressure (${params.bloodPressure})`);
      } else if (systolic >= 130 || diastolic >= 80) {
        analysis.abnormalFlags.push('blood_pressure');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'Blood Pressure',
          message: `Hypertension stage 1: ${params.bloodPressure} mmHg`,
          action: 'Monitor and lifestyle modifications recommended'
        });
        analysis.analysis.push(`Borderline high blood pressure (${params.bloodPressure})`);
      } else if (systolic < 90 || diastolic < 60) {
        analysis.abnormalFlags.push('blood_pressure');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'Blood Pressure',
          message: `Hypotension: ${params.bloodPressure} mmHg`,
          action: 'Evaluate for underlying causes'
        });
        analysis.analysis.push(`Low blood pressure (${params.bloodPressure})`);
      } else {
        analysis.analysis.push(`Blood pressure normal (${params.bloodPressure})`);
      }
    }

    // Heart Rate (Pulse) Analysis
    if (params.pulse) {
      const pulse = parseInt(params.pulse);

      if (pulse > 150) {
        analysis.criticalFlags.push('pulse');
        analysis.overallStatus = 'critical';
        analysis.alerts.push({
          severity: 'CRITICAL',
          category: 'Heart Rate',
          message: `Severe tachycardia: ${pulse} bpm`,
          action: 'Cardiac evaluation needed immediately'
        });
        analysis.analysis.push(`Critical tachycardia detected (${pulse} bpm)`);
      } else if (pulse > 100) {
        analysis.abnormalFlags.push('pulse');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'Heart Rate',
          message: `Tachycardia: ${pulse} bpm`,
          action: 'Monitor and evaluate for causes'
        });
        analysis.analysis.push(`Elevated heart rate (${pulse} bpm)`);
      } else if (pulse < 50) {
        analysis.abnormalFlags.push('pulse');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'Heart Rate',
          message: `Bradycardia: ${pulse} bpm`,
          action: 'Evaluate for underlying causes'
        });
        analysis.analysis.push(`Low heart rate (${pulse} bpm)`);
      } else {
        analysis.analysis.push(`Heart rate normal (${pulse} bpm)`);
      }
    }

    // Temperature Analysis
    if (params.temperature) {
      const temp = parseFloat(params.temperature);

      if (temp >= 39.5) {
        analysis.criticalFlags.push('temperature');
        analysis.overallStatus = 'critical';
        analysis.alerts.push({
          severity: 'CRITICAL',
          category: 'Temperature',
          message: `High fever: ${temp}°C`,
          action: 'Immediate medical attention required'
        });
        analysis.analysis.push(`High fever detected (${temp}°C)`);
      } else if (temp >= 38.0) {
        analysis.abnormalFlags.push('temperature');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'Temperature',
          message: `Fever: ${temp}°C`,
          action: 'Monitor and consider antipyretics'
        });
        analysis.analysis.push(`Fever present (${temp}°C)`);
      } else if (temp < 35.0) {
        analysis.criticalFlags.push('temperature');
        analysis.overallStatus = 'critical';
        analysis.alerts.push({
          severity: 'CRITICAL',
          category: 'Temperature',
          message: `Hypothermia: ${temp}°C`,
          action: 'Immediate warming measures needed'
        });
        analysis.analysis.push(`Hypothermia detected (${temp}°C)`);
      } else {
        analysis.analysis.push(`Temperature normal (${temp}°C)`);
      }
    }

    // Oxygen Saturation Analysis
    if (params.oxygenSaturation) {
      const o2sat = parseInt(params.oxygenSaturation);

      if (o2sat < 90) {
        analysis.criticalFlags.push('oxygen_saturation');
        analysis.overallStatus = 'critical';
        analysis.alerts.push({
          severity: 'CRITICAL',
          category: 'Oxygen Saturation',
          message: `Severe hypoxemia: ${o2sat}%`,
          action: 'Oxygen therapy and immediate evaluation needed'
        });
        analysis.analysis.push(`Critical low oxygen saturation (${o2sat}%)`);
      } else if (o2sat < 95) {
        analysis.abnormalFlags.push('oxygen_saturation');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'Oxygen Saturation',
          message: `Low oxygen saturation: ${o2sat}%`,
          action: 'Evaluate respiratory function'
        });
        analysis.analysis.push(`Low oxygen saturation (${o2sat}%)`);
      } else {
        analysis.analysis.push(`Oxygen saturation normal (${o2sat}%)`);
      }
    }

    // Respiratory Rate Analysis
    if (params.respiratoryRate) {
      const rr = parseInt(params.respiratoryRate);

      if (rr > 30) {
        analysis.criticalFlags.push('respiratory_rate');
        analysis.overallStatus = 'critical';
        analysis.alerts.push({
          severity: 'CRITICAL',
          category: 'Respiratory Rate',
          message: `Severe tachypnea: ${rr} breaths/min`,
          action: 'Evaluate for respiratory distress'
        });
        analysis.analysis.push(`Critical high respiratory rate (${rr} breaths/min)`);
      } else if (rr > 20) {
        analysis.abnormalFlags.push('respiratory_rate');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'Respiratory Rate',
          message: `Tachypnea: ${rr} breaths/min`,
          action: 'Monitor respiratory function'
        });
        analysis.analysis.push(`Elevated respiratory rate (${rr} breaths/min)`);
      } else if (rr < 12) {
        analysis.abnormalFlags.push('respiratory_rate');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'Respiratory Rate',
          message: `Bradypnea: ${rr} breaths/min`,
          action: 'Evaluate for respiratory depression'
        });
        analysis.analysis.push(`Low respiratory rate (${rr} breaths/min)`);
      } else {
        analysis.analysis.push(`Respiratory rate normal (${rr} breaths/min)`);
      }
    }

    // Glucose Level Analysis
    if (params.glucoseLevel) {
      const glucose = parseInt(params.glucoseLevel);

      if (glucose > 250) {
        analysis.criticalFlags.push('glucose');
        analysis.overallStatus = 'critical';
        analysis.alerts.push({
          severity: 'CRITICAL',
          category: 'Blood Glucose',
          message: `Severe hyperglycemia: ${glucose} mg/dL`,
          action: 'Immediate diabetes management required'
        });
        analysis.analysis.push(`Critical high blood glucose (${glucose} mg/dL)`);
      } else if (glucose > 180) {
        analysis.abnormalFlags.push('glucose');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'Blood Glucose',
          message: `Hyperglycemia: ${glucose} mg/dL`,
          action: 'Diabetes medication adjustment may be needed'
        });
        analysis.analysis.push(`Elevated blood glucose (${glucose} mg/dL)`);
      } else if (glucose < 70) {
        analysis.criticalFlags.push('glucose');
        analysis.overallStatus = 'critical';
        analysis.alerts.push({
          severity: 'CRITICAL',
          category: 'Blood Glucose',
          message: `Hypoglycemia: ${glucose} mg/dL`,
          action: 'Immediate glucose administration needed'
        });
        analysis.analysis.push(`Critical low blood glucose (${glucose} mg/dL)`);
      } else {
        analysis.analysis.push(`Blood glucose normal (${glucose} mg/dL)`);
      }
    }

    // BMI Analysis (if weight and height available)
    if (params.weight && (params.height || patient?.height)) {
      const height = params.height || patient?.height;
      const bmi = parseFloat(this.calculateBMI(params.weight, height));

      if (bmi >= 40) {
        analysis.abnormalFlags.push('bmi');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'HIGH',
          category: 'BMI',
          message: `Class III obesity (BMI: ${bmi})`,
          action: 'Weight management and bariatric evaluation recommended'
        });
        analysis.analysis.push(`Severe obesity (BMI: ${bmi})`);
      } else if (bmi >= 30) {
        analysis.abnormalFlags.push('bmi');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'BMI',
          message: `Obesity (BMI: ${bmi})`,
          action: 'Weight management recommended'
        });
        analysis.analysis.push(`Obesity detected (BMI: ${bmi})`);
      } else if (bmi >= 25) {
        analysis.abnormalFlags.push('bmi');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'LOW',
          category: 'BMI',
          message: `Overweight (BMI: ${bmi})`,
          action: 'Lifestyle modifications recommended'
        });
        analysis.analysis.push(`Overweight (BMI: ${bmi})`);
      } else if (bmi < 18.5) {
        analysis.abnormalFlags.push('bmi');
        if (analysis.overallStatus === 'normal') analysis.overallStatus = 'abnormal';
        analysis.alerts.push({
          severity: 'MODERATE',
          category: 'BMI',
          message: `Underweight (BMI: ${bmi})`,
          action: 'Nutritional assessment recommended'
        });
        analysis.analysis.push(`Underweight (BMI: ${bmi})`);
      } else {
        analysis.analysis.push(`BMI normal (${bmi})`);
      }
    }

    return analysis;
  }

  /**
   * Generate clinical recommendations based on vital signs analysis
   * @param {Object} vitalAnalysis - Analysis object from analyzeVitalSigns
   * @param {Object} practiceContext - Practice context with language settings
   * @returns {Array} Array of recommendation objects
   */
  generateVitalSignsRecommendations(vitalAnalysis, practiceContext) {
    const recommendations = [];
    const isHebrew = practiceContext?.language === 'he';

    // Generate recommendations based on alerts
    if (vitalAnalysis.alerts && vitalAnalysis.alerts.length > 0) {
      vitalAnalysis.alerts.forEach(alert => {
        const recommendation = {
          severity: alert.severity,
          category: alert.category,
          action: alert.action,
          priority: alert.severity === 'CRITICAL' ? 'immediate' : alert.severity === 'HIGH' ? 'urgent' : 'routine'
        };

        recommendations.push(recommendation);
      });
    }

    // Add general recommendations based on overall status
    if (vitalAnalysis.overallStatus === 'critical') {
      recommendations.push({
        severity: 'CRITICAL',
        category: isHebrew ? 'המלצה כללית' : 'General Recommendation',
        action: isHebrew
          ? 'נדרשת התייעצות רפואית דחופה'
          : 'Urgent medical consultation required',
        priority: 'immediate'
      });
    } else if (vitalAnalysis.overallStatus === 'abnormal') {
      recommendations.push({
        severity: 'MODERATE',
        category: isHebrew ? 'המלצה כללית' : 'General Recommendation',
        action: isHebrew
          ? 'מומלץ לעקוב ולהתייעץ עם רופא'
          : 'Follow-up and medical consultation recommended',
        priority: 'routine'
      });
    }

    return recommendations;
  }

  /**
   * Generate user-friendly message summarizing vital signs results
   * @param {Object} vitalAnalysis - Analysis object from analyzeVitalSigns
   * @param {Array} providedVitals - Array of vital sign names that were measured
   * @param {Object} practiceContext - Practice context with language settings
   * @returns {string} Summary message
   */
  generateVitalSignsMessage(vitalAnalysis, providedVitals, practiceContext) {
    const isHebrew = practiceContext?.language === 'he';

    if (vitalAnalysis.overallStatus === 'critical') {
      const criticalCount = vitalAnalysis.criticalFlags.length;
      return isHebrew
        ? `סימנים חיוניים נרשמו בהצלחה. ⚠️ זוהו ${criticalCount} ממצאים קריטיים הדורשים טיפול דחוף!`
        : `Vital signs recorded successfully. ⚠️ ${criticalCount} critical finding${criticalCount > 1 ? 's' : ''} detected requiring immediate attention!`;
    } else if (vitalAnalysis.overallStatus === 'abnormal') {
      const abnormalCount = vitalAnalysis.abnormalFlags.length;
      return isHebrew
        ? `סימנים חיוניים נרשמו בהצלחה. זוהו ${abnormalCount} ממצאים חריגים הדורשים מעקב.`
        : `Vital signs recorded successfully. ${abnormalCount} abnormal finding${abnormalCount > 1 ? 's' : ''} detected requiring follow-up.`;
    } else {
      const vitalsCount = providedVitals.length;
      return isHebrew
        ? `סימנים חיוניים נרשמו בהצלחה. כל ${vitalsCount} המדדים בטווח תקין.`
        : `Vital signs recorded successfully. All ${vitalsCount} measurement${vitalsCount > 1 ? 's' : ''} are within normal range.`;
    }
  }

}

module.exports = new LabService();
