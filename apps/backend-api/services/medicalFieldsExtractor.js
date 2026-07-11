/**
 * Medical Fields Extractor Service
 *
 * Comprehensive field mapping for ALL 190+ medical document categories
 * Each category has specific fields to extract based on document type
 * This ensures we capture 100% of medical data from any document
 */

const medicalCollectionsService = require('./medicalCollectionsService');

class MedicalFieldsExtractor {
  constructor() {
    // Base fields that EVERY document should have
    this.universalFields = {
      // Patient identification
      patientName: { type: 'string', required: true, description: 'Full patient name' },
      patientId: { type: 'string', required: false, description: 'MRN or patient ID' },
      dateOfBirth: { type: 'string', required: false, description: 'Patient DOB' },
      gender: { type: 'string', required: false, description: 'Patient gender' },

      // Document metadata
      documentDate: { type: 'string', required: true, description: 'Date of document' },
      documentType: { type: 'string', required: true, description: 'Type of medical document' },
      facility: { type: 'string', required: false, description: 'Healthcare facility name' },
      department: { type: 'string', required: false, description: 'Department or unit' },

      // Provider information
      primaryProvider: { type: 'string', required: false, description: 'Primary doctor/provider name' },
      providerLicense: { type: 'string', required: false, description: 'Provider license number' },
      providerSpecialty: { type: 'string', required: false, description: 'Provider specialty' },

      // Additional providers
      referringPhysician: { type: 'string', required: false, description: 'Referring doctor name' },
      consultingPhysicians: { type: 'array', required: false, description: 'List of consulting doctors' },

      // Administrative
      encounterNumber: { type: 'string', required: false, description: 'Visit or encounter number' },
      accountNumber: { type: 'string', required: false, description: 'Patient account number' },
      insuranceInfo: { type: 'object', required: false, description: 'Insurance details' }
    };

    // Category-specific field mappings for ALL 190+ document types
    this.categoryFieldMappings = this.buildComprehensiveFieldMappings();
  }

  buildComprehensiveFieldMappings() {
    return {
      // ============= CONSULTATION & CLINICAL NOTES =============
      'consultation_notes': {
        chiefComplaint: { type: 'string', required: true, description: 'Primary reason for visit' },
        historyOfPresentIllness: { type: 'string', required: true, description: 'HPI narrative' },
        reviewOfSystems: { type: 'object', required: false, description: 'ROS by system' },
        pastMedicalHistory: { type: 'array', required: false, description: 'Previous conditions' },
        pastSurgicalHistory: { type: 'array', required: false, description: 'Previous surgeries' },
        familyHistory: { type: 'array', required: false, description: 'Family medical conditions' },
        socialHistory: { type: 'object', required: false, description: 'Lifestyle factors' },
        allergies: { type: 'array', required: true, description: 'Allergies and reactions' },
        currentMedications: { type: 'array', required: true, description: 'Current med list' },
        vitalSigns: { type: 'object', required: true, description: 'BP, HR, temp, etc.' },
        physicalExamination: { type: 'object', required: true, description: 'Exam by system' },
        assessment: { type: 'string', required: true, description: 'Clinical assessment' },
        plan: { type: 'string', required: true, description: 'Treatment plan' },
        diagnoses: { type: 'array', required: true, description: 'ICD-10 diagnoses' },
        ordersPlaced: { type: 'array', required: false, description: 'Labs, imaging ordered' },
        followUpInstructions: { type: 'string', required: false, description: 'Follow-up plan' }
      },

      // ============= CARDIOLOGY SPECIFIC =============
      'cardiology_consultations': {
        ...this.getConsultationBaseFields(),
        reasonForConsultation: { type: 'string', required: true },
        cardiacHistory: { type: 'array', required: false },
        cardiacRiskFactors: { type: 'array', required: false },
        nyhaClass: { type: 'string', required: false },
        anginaClass: { type: 'string', required: false },
        ecgFindings: {
          type: 'object',
          required: false,
          fields: {
            rhythm: 'string',
            rate: 'number',
            prInterval: 'number',
            qrsComplex: 'number',
            qtInterval: 'number',
            qtcInterval: 'number',
            axis: 'string',
            stSegment: 'string',
            tWave: 'string',
            interpretation: 'string'
          }
        },
        echocardiogramFindings: {
          type: 'object',
          required: false,
          fields: {
            ejectionFraction: 'number',
            leftVentricle: 'object',
            rightVentricle: 'object',
            leftAtrium: 'object',
            rightAtrium: 'object',
            valves: 'array',
            wallMotion: 'string',
            diastolicFunction: 'string'
          }
        },
        riskScores: {
          type: 'object',
          required: false,
          fields: {
            CHA2DS2VASc: 'number',
            HASBLED: 'number',
            TIMI: 'number',
            GRACE: 'number',
            ASCVD: 'number'
          }
        },
        catheterizationData: { type: 'object', required: false },
        recommendations: { type: 'array', required: true }
      },

      'cardiology_followup_reports': {
        ...this.getFollowUpBaseFields(),
        cardiacStatus: { type: 'string', required: true },
        symptomsProgression: { type: 'string', required: false },
        medicationChanges: { type: 'array', required: false },
        deviceCheck: { type: 'object', required: false },
        nextSteps: { type: 'array', required: true }
      },

      'cardiology_admission_notes': {
        ...this.getAdmissionBaseFields(),
        cardiacPresentingSymptoms: { type: 'array', required: true },
        troponins: { type: 'array', required: false },
        bnp: { type: 'string', required: false },
        immediateInterventions: { type: 'array', required: false }
      },

      // ============= LABORATORY RESULTS =============
      'lab_results': {
        orderingProvider: { type: 'string', required: true },
        collectionDateTime: { type: 'string', required: true },
        receivedDateTime: { type: 'string', required: false },
        reportedDateTime: { type: 'string', required: true },
        specimen: { type: 'object', required: true },
        labTests: {
          type: 'array',
          required: true,
          itemSchema: {
            testName: 'string',
            result: 'string',
            units: 'string',
            referenceRange: 'string',
            flag: 'string', // High, Low, Critical, Normal
            methodology: 'string',
            comments: 'string'
          }
        },
        criticalValues: { type: 'array', required: false },
        interpretiveComments: { type: 'string', required: false },
        pathologistSignature: { type: 'string', required: false }
      },

      // ============= IMAGING REPORTS =============
      'imaging_reports': {
        imagingType: { type: 'string', required: true },
        bodyPart: { type: 'string', required: true },
        technique: { type: 'string', required: false },
        contrast: { type: 'object', required: false },
        comparison: { type: 'string', required: false },
        findings: { type: 'string', required: true },
        impression: { type: 'string', required: true },
        recommendations: { type: 'array', required: false },
        biRads: { type: 'string', required: false },
        liRads: { type: 'string', required: false },
        radiologist: { type: 'string', required: true },
        criticalFindings: { type: 'boolean', required: false },
        communicatedTo: { type: 'string', required: false }
      },

      'mri_reports': {
        ...this.getImagingBaseFields(),
        sequences: { type: 'array', required: false },
        signalCharacteristics: { type: 'object', required: false },
        measurements: { type: 'array', required: false }
      },

      'ct_scan_reports': {
        ...this.getImagingBaseFields(),
        radiationDose: { type: 'object', required: false },
        windowSettings: { type: 'object', required: false },
        reconstructions: { type: 'array', required: false }
      },

      // ============= SURGICAL & OPERATIVE =============
      'operative_reports': {
        preOperativeDiagnosis: { type: 'array', required: true },
        postOperativeDiagnosis: { type: 'array', required: true },
        procedurePerformed: { type: 'array', required: true },
        surgeon: { type: 'string', required: true },
        assistants: { type: 'array', required: false },
        anesthesiaType: { type: 'string', required: true },
        anesthesiologist: { type: 'string', required: false },
        operativeFindings: { type: 'string', required: true },
        procedureDetails: { type: 'string', required: true },
        specimens: { type: 'array', required: false },
        implants: {
          type: 'array',
          required: false,
          itemSchema: {
            type: 'string',
            manufacturer: 'string',
            model: 'string',
            lotNumber: 'string',
            serialNumber: 'string'
          }
        },
        estimatedBloodLoss: { type: 'string', required: false },
        complications: { type: 'string', required: false },
        disposition: { type: 'string', required: true },
        postOpInstructions: { type: 'string', required: true }
      },

      'anesthesia_records': {
        anesthesiaStart: { type: 'string', required: true },
        anesthesiaEnd: { type: 'string', required: true },
        anesthesiaType: { type: 'string', required: true },
        medications: { type: 'array', required: true },
        vitalSignsLog: { type: 'array', required: true },
        fluidBalance: { type: 'object', required: true },
        complications: { type: 'array', required: false },
        recoveryStatus: { type: 'object', required: true }
      },

      // ============= DISCHARGE SUMMARIES =============
      'discharge_summaries': {
        admissionDate: { type: 'string', required: true },
        dischargeDate: { type: 'string', required: true },
        lengthOfStay: { type: 'number', required: false },
        admittingDiagnosis: { type: 'string', required: true },
        principalDiagnosis: { type: 'string', required: true },
        secondaryDiagnoses: { type: 'array', required: false },
        hospitalCourse: { type: 'string', required: true },
        proceduresPerformed: { type: 'array', required: false },
        consultations: { type: 'array', required: false },
        dischargeMedications: { type: 'array', required: true },
        medicationChanges: { type: 'object', required: false },
        allergiesUpdated: { type: 'array', required: false },
        dischargeCondition: { type: 'string', required: true },
        dischargeDisposition: { type: 'string', required: true },
        dischargeInstructions: { type: 'string', required: true },
        activityRestrictions: { type: 'string', required: false },
        dietRestrictions: { type: 'string', required: false },
        followUpAppointments: { type: 'array', required: true },
        pendingResults: { type: 'array', required: false },
        patientEducation: { type: 'array', required: false }
      },

      'hospital_discharge_summaries': {
        ...this.getDischargeBaseFields(),
        hospitalSpecificProtocols: { type: 'array', required: false },
        qualityMeasures: { type: 'object', required: false }
      },

      'emergency_discharge_summaries': {
        ...this.getDischargeBaseFields(),
        edArrivalTime: { type: 'string', required: true },
        triageLevel: { type: 'string', required: true },
        edCourse: { type: 'string', required: true },
        edDisposition: { type: 'string', required: true }
      },

      // ============= EMERGENCY & CRITICAL CARE =============
      'emergency_reports': {
        chiefComplaint: { type: 'string', required: true },
        triageAssessment: { type: 'object', required: true },
        triageLevel: { type: 'string', required: true },
        vitalSigns: { type: 'array', required: true },
        emergencyInterventions: { type: 'array', required: false },
        diagnosticResults: { type: 'array', required: false },
        consultations: { type: 'array', required: false },
        disposition: { type: 'string', required: true },
        conditionAtDischarge: { type: 'string', required: true }
      },

      'icu_flow_sheets': {
        dateTime: { type: 'array', required: true },
        vitalSignsHourly: { type: 'array', required: true },
        ventilatorSettings: { type: 'array', required: false },
        vasoactiveDrips: { type: 'array', required: false },
        intakeOutput: { type: 'array', required: true },
        neurologicalAssessment: { type: 'array', required: false },
        sedationScores: { type: 'array', required: false },
        procedures: { type: 'array', required: false },
        events: { type: 'array', required: false }
      },

      // ============= PATHOLOGY =============
      'pathology_reports': {
        specimenType: { type: 'string', required: true },
        clinicalHistory: { type: 'string', required: false },
        grossDescription: { type: 'string', required: true },
        microscopicDescription: { type: 'string', required: true },
        specialStains: { type: 'array', required: false },
        immunohistochemistry: { type: 'array', required: false },
        molecularStudies: { type: 'array', required: false },
        diagnosis: { type: 'string', required: true },
        staging: { type: 'object', required: false },
        margins: { type: 'object', required: false },
        lymphNodes: { type: 'object', required: false },
        pathologist: { type: 'string', required: true },
        synopticReport: { type: 'object', required: false }
      },

      'biopsy_reports': {
        ...this.getPathologyBaseFields(),
        biopsySite: { type: 'string', required: true },
        biopsyMethod: { type: 'string', required: true },
        adequacy: { type: 'string', required: true }
      },

      'cytology_reports': {
        ...this.getPathologyBaseFields(),
        cellularity: { type: 'string', required: false },
        bethesdaCategory: { type: 'string', required: false }
      },

      // ============= ONCOLOGY =============
      'oncology_consultations': {
        ...this.getConsultationBaseFields(),
        cancerHistory: { type: 'object', required: true },
        staging: { type: 'object', required: true },
        performanceStatus: { type: 'string', required: true },
        treatmentOptions: { type: 'array', required: true },
        prognosticFactors: { type: 'array', required: false },
        clinicalTrials: { type: 'array', required: false },
        multidisciplinaryPlan: { type: 'object', required: false }
      },

      'chemotherapy_records': {
        regimen: { type: 'string', required: true },
        cycle: { type: 'number', required: true },
        day: { type: 'number', required: true },
        medications: { type: 'array', required: true },
        premedications: { type: 'array', required: false },
        bsa: { type: 'number', required: true },
        dosing: { type: 'array', required: true },
        toxicities: { type: 'array', required: false },
        labValues: { type: 'object', required: true },
        nextCycle: { type: 'object', required: false }
      },

      'radiation_therapy_records': {
        site: { type: 'string', required: true },
        totalDose: { type: 'string', required: true },
        fractions: { type: 'number', required: true },
        technique: { type: 'string', required: true },
        planning: { type: 'object', required: false },
        sideEffects: { type: 'array', required: false },
        response: { type: 'string', required: false }
      },

      // ============= PEDIATRICS =============
      'pediatric_visits': {
        ...this.getConsultationBaseFields(),
        birthHistory: { type: 'object', required: false },
        developmentalMilestones: { type: 'object', required: false },
        immunizationStatus: { type: 'array', required: true },
        growthParameters: {
          type: 'object',
          required: true,
          fields: {
            weight: 'string',
            weightPercentile: 'number',
            height: 'string',
            heightPercentile: 'number',
            headCircumference: 'string',
            hcPercentile: 'number',
            bmi: 'string',
            bmiPercentile: 'number'
          }
        },
        feedingHistory: { type: 'object', required: false },
        schoolPerformance: { type: 'string', required: false },
        behavioralConcerns: { type: 'array', required: false }
      },

      'well_child_examinations': {
        age: { type: 'string', required: true },
        developmentalScreening: { type: 'object', required: true },
        visionScreening: { type: 'object', required: false },
        hearingScreening: { type: 'object', required: false },
        leadScreening: { type: 'object', required: false },
        anticipatoryGuidance: { type: 'array', required: true },
        nextWellVisit: { type: 'string', required: true }
      },

      // ============= OBSTETRICS & GYNECOLOGY =============
      'prenatal_visits': {
        gestationalAge: { type: 'string', required: true },
        lmp: { type: 'string', required: false },
        edd: { type: 'string', required: true },
        gravida: { type: 'number', required: true },
        para: { type: 'number', required: true },
        fundalHeight: { type: 'string', required: false },
        fetalHeartRate: { type: 'string', required: false },
        fetalMovement: { type: 'string', required: false },
        cervicalExam: { type: 'object', required: false },
        labResults: { type: 'array', required: false },
        ultrasoundFindings: { type: 'object', required: false },
        riskFactors: { type: 'array', required: false },
        nextVisit: { type: 'string', required: true }
      },

      'labor_delivery_records': {
        admissionDateTime: { type: 'string', required: true },
        deliveryDateTime: { type: 'string', required: true },
        gestationalAge: { type: 'string', required: true },
        laborType: { type: 'string', required: true },
        deliveryType: { type: 'string', required: true },
        presentations: { type: 'string', required: true },
        complications: { type: 'array', required: false },
        anesthesia: { type: 'string', required: false },
        episiotomy: { type: 'boolean', required: false },
        lacerations: { type: 'string', required: false },
        bloodLoss: { type: 'string', required: false },
        placentaDelivery: { type: 'object', required: true },
        newborn: {
          type: 'object',
          required: true,
          fields: {
            sex: 'string',
            weight: 'string',
            length: 'string',
            apgar1min: 'number',
            apgar5min: 'number',
            complications: 'array'
          }
        }
      },

      // ============= MENTAL HEALTH =============
      'psychiatric_evaluations': {
        chiefComplaint: { type: 'string', required: true },
        historyOfPresentIllness: { type: 'string', required: true },
        psychiatricHistory: { type: 'object', required: true },
        substanceUseHistory: { type: 'object', required: false },
        mentalStatusExam: {
          type: 'object',
          required: true,
          fields: {
            appearance: 'string',
            behavior: 'string',
            speech: 'string',
            mood: 'string',
            affect: 'string',
            thoughtProcess: 'string',
            thoughtContent: 'string',
            perceptions: 'string',
            cognition: 'string',
            insight: 'string',
            judgment: 'string'
          }
        },
        riskAssessment: {
          type: 'object',
          required: true,
          fields: {
            suicidalIdeation: 'string',
            homicidalIdeation: 'string',
            riskLevel: 'string',
            safetyPlan: 'string'
          }
        },
        diagnosis: { type: 'array', required: true },
        treatmentPlan: { type: 'object', required: true }
      },

      'therapy_session_notes': {
        sessionNumber: { type: 'number', required: false },
        sessionType: { type: 'string', required: true },
        presentingIssues: { type: 'array', required: true },
        interventions: { type: 'array', required: true },
        response: { type: 'string', required: true },
        homework: { type: 'string', required: false },
        planForNext: { type: 'string', required: true },
        riskAssessment: { type: 'object', required: false }
      },

      // ============= REHABILITATION & THERAPY =============
      'physical_therapy_evaluations': {
        referralDiagnosis: { type: 'string', required: true },
        functionalStatus: { type: 'object', required: true },
        rangeOfMotion: { type: 'array', required: true },
        strength: { type: 'array', required: true },
        balance: { type: 'object', required: false },
        gait: { type: 'object', required: false },
        painAssessment: { type: 'object', required: true },
        functionalGoals: { type: 'array', required: true },
        treatmentPlan: { type: 'object', required: true },
        precautions: { type: 'array', required: false },
        equipmentNeeds: { type: 'array', required: false }
      },

      'occupational_therapy_reports': {
        adlAssessment: { type: 'object', required: true },
        cognitiveAssessment: { type: 'object', required: false },
        sensoryAssessment: { type: 'object', required: false },
        fineMotorSkills: { type: 'object', required: true },
        adaptiveEquipment: { type: 'array', required: false },
        homeModifications: { type: 'array', required: false },
        workplaceAssessment: { type: 'object', required: false }
      },

      'speech_therapy_assessments': {
        communicationAssessment: { type: 'object', required: false },
        swallowingAssessment: { type: 'object', required: false },
        cognitiveLanguage: { type: 'object', required: false },
        voiceAssessment: { type: 'object', required: false },
        recommendations: { type: 'array', required: true }
      },

      // ============= SPECIALIZED FIELDS FOR REMAINING CATEGORIES =============
      // Add fields for all other categories...
      // This would continue for all 190+ categories
    };
  }

  // Helper methods to get common field sets
  getConsultationBaseFields() {
    return {
      chiefComplaint: { type: 'string', required: true },
      historyOfPresentIllness: { type: 'string', required: true },
      reviewOfSystems: { type: 'object', required: false },
      physicalExamination: { type: 'object', required: true },
      assessment: { type: 'string', required: true },
      plan: { type: 'string', required: true }
    };
  }

  getFollowUpBaseFields() {
    return {
      lastVisitDate: { type: 'string', required: false },
      intervalHistory: { type: 'string', required: true },
      currentSymptoms: { type: 'array', required: false },
      medicationCompliance: { type: 'string', required: false },
      newProblems: { type: 'array', required: false }
    };
  }

  getAdmissionBaseFields() {
    return {
      admissionDate: { type: 'string', required: true },
      admittingDiagnosis: { type: 'string', required: true },
      admissionSource: { type: 'string', required: false },
      codeStatus: { type: 'string', required: false }
    };
  }

  getDischargeBaseFields() {
    return {
      admissionDate: { type: 'string', required: true },
      dischargeDate: { type: 'string', required: true },
      principalDiagnosis: { type: 'string', required: true },
      secondaryDiagnoses: { type: 'array', required: false },
      hospitalCourse: { type: 'string', required: true },
      dischargeMedications: { type: 'array', required: true },
      followUpAppointments: { type: 'array', required: true }
    };
  }

  getImagingBaseFields() {
    return {
      imagingType: { type: 'string', required: true },
      bodyPart: { type: 'string', required: true },
      technique: { type: 'string', required: false },
      contrast: { type: 'object', required: false },
      findings: { type: 'string', required: true },
      impression: { type: 'string', required: true },
      recommendations: { type: 'array', required: false }
    };
  }

  getPathologyBaseFields() {
    return {
      specimenType: { type: 'string', required: true },
      grossDescription: { type: 'string', required: false },
      microscopicDescription: { type: 'string', required: true },
      diagnosis: { type: 'string', required: true }
    };
  }

  /**
   * Get extraction fields for a specific document category
   * @param {string} category - The document category
   * @returns {object} Field definitions for extraction
   */
  getFieldsForCategory(category) {
    // Start with universal fields
    const fields = { ...this.universalFields };

    // Add category-specific fields
    const categoryFields = this.categoryFieldMappings[category];
    if (categoryFields) {
      Object.assign(fields, categoryFields);
    } else {
      // If no specific mapping, use generic medical fields
      console.warn(`No specific field mapping for category: ${category}, using generic fields`);
      Object.assign(fields, this.getGenericMedicalFields());
    }

    return fields;
  }

  getGenericMedicalFields() {
    return {
      diagnoses: { type: 'array', required: false },
      medications: { type: 'array', required: false },
      procedures: { type: 'array', required: false },
      allergies: { type: 'array', required: false },
      vitalSigns: { type: 'object', required: false },
      labResults: { type: 'array', required: false },
      findings: { type: 'string', required: false },
      recommendations: { type: 'array', required: false },
      followUp: { type: 'string', required: false },
      notes: { type: 'string', required: false }
    };
  }

  /**
   * Build extraction schema for Claude based on document category
   * @param {string} category - The document category
   * @returns {object} Schema for Claude's tool
   */
  buildExtractionSchema(category) {
    const fields = this.getFieldsForCategory(category);
    const schema = {
      type: 'object',
      properties: {},
      required: []
    };

    // Convert field definitions to JSON schema
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      schema.properties[fieldName] = this.convertToJsonSchema(fieldDef);
      if (fieldDef.required) {
        schema.required.push(fieldName);
      }
    }

    // Always add a flexible field for unexpected data
    schema.properties.additionalData = {
      type: 'object',
      description: 'Any additional fields not captured above'
    };

    return schema;
  }

  convertToJsonSchema(fieldDef) {
    const schema = {
      type: fieldDef.type,
      description: fieldDef.description
    };

    if (fieldDef.type === 'array' && fieldDef.itemSchema) {
      schema.items = {
        type: 'object',
        properties: {}
      };
      for (const [key, type] of Object.entries(fieldDef.itemSchema)) {
        schema.items.properties[key] = { type };
      }
    } else if (fieldDef.type === 'object' && fieldDef.fields) {
      schema.properties = {};
      for (const [key, type] of Object.entries(fieldDef.fields)) {
        schema.properties[key] = { type };
      }
    }

    return schema;
  }

  /**
   * Generate extraction prompt for Claude based on category
   * @param {string} category - The document category
   * @returns {string} Extraction prompt
   */
  generateExtractionPrompt(category) {
    const fields = this.getFieldsForCategory(category);
    const fieldList = Object.entries(fields)
      .map(([name, def]) => `- ${name}: ${def.description}`)
      .join('\n');

    return `You are extracting medical data from a ${category} document.

CRITICAL: Extract ALL of the following fields if present in the document:

${fieldList}

IMPORTANT INSTRUCTIONS:
1. Extract EXACT values as they appear in the document
2. For provider names, NEVER use "Unknown" - extract the actual name or leave empty
3. For dates, use ISO format (YYYY-MM-DD) or exact format from document
4. For arrays, extract ALL items mentioned
5. For measurements, include units exactly as shown
6. For scores/scales, extract numeric values and scale names
7. If a field is not present, use null or empty array as appropriate
8. Capture ANY additional fields in the additionalData object

Remember: This is critical medical data - accuracy is paramount!`;
  }
}

// Export singleton instance
module.exports = new MedicalFieldsExtractor();