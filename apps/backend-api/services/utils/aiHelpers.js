/**
 * AiHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.477Z
 */

const UtilityHelpers = require('./utilityHelpers');
const generatedMedicalFunctions = require('../optimizedMedicalFunctions');
const unifiedMedicalSchemas = require('../unifiedMedicalSchemas');
const { getGeneratedDescriptions } = require('./generated-short-descriptions');

class AiHelpers {
    constructor() {
        // Function cache to avoid regenerating functions on every call
        this.FUNCTION_CACHE = {
            initialized: false,
            initializing: false,  // Prevent concurrent initialization
            all: {},  // Will store all functions by language-country combo
            minimal: {},  // Will store minimal function sets
            byCategory: {},  // Will store functions grouped by category
            wrapped: null  // Will store wrapped functions for learning
        };

        // Track if duplicate warnings have been shown to avoid log spam
        this.duplicateWarningsShown = false;

        // Utility helpers for common operations
        this.utilityHelpers = new UtilityHelpers();
    }

    /**
     * Extract collection name from function name
     * Examples: getMedications → medications, createDiagnoses → diagnoses, addVitalSigns → vital_signs
     * @param {string} functionName - Function name (e.g., 'getMedications', 'createDiagnoses')
     * @returns {string} Collection name in snake_case (e.g., 'medications', 'vital_signs')
     */
    extractCollectionFromFunctionName(functionName) {
        const prefixes = ['get', 'create', 'update', 'delete', 'search', 'add'];
        let collectionName = functionName;

        // Remove function prefix (get/create/update/delete/search/add)
        for (const prefix of prefixes) {
            if (functionName.toLowerCase().startsWith(prefix)) {
                collectionName = functionName.slice(prefix.length);
                break;
            }
        }

        // Convert PascalCase to snake_case while preserving plurals
        // Examples: ConsultationNotes → consultation_notes, Prescriptions → prescriptions
        // VitalSigns → vital_signs
        return collectionName
            .replace(/([A-Z])/g, '_$1')  // Add underscore before capitals
            .toLowerCase()
            .replace(/^_/, '');  // Remove leading underscore (e.g., _consultation_notes → consultation_notes)

        // Note: This preserves plural 's' - ConsultationNotes becomes consultation_notes (plural), not consultation_note (singular)
    }

    getEssentialFunctions(language, clinicCountry, message) {
      const isHebrew = language === 'he';
      const messageLower = message.toLowerCase();
      
      // Detect what the user is asking for
      const isPatientQuery = messageLower.includes('patient') || messageLower.includes('מטופל');
      const isDeleteQuery = messageLower.includes('delete') || messageLower.includes('מחק') || messageLower.includes('מחיקה') || messageLower.includes('הסר');
      const isDocumentQuery = messageLower.includes('document') || messageLower.includes('מסמך') || messageLower.includes('מסמכים');
      const isDiagnosisQuery = messageLower.includes('diagnos') || messageLower.includes('אבחון');
      const isAppointmentQuery = messageLower.includes('appointment') || messageLower.includes('תור') || messageLower.includes('פגישה');
      const isAllergyQuery = messageLower.includes('allerg') || messageLower.includes('אלרגי');
      
      const essentialFunctions = [];
      
      // Always include patient functions
      // Removed duplicate searchPatients - keeping the more comprehensive version below
      
      // Add allergy functions if relevant
      if (isAllergyQuery) {
        const allFunctions = this.getAllPlatformFunctions(language, clinicCountry);
        const allergyFunc = allFunctions.find(f => f.name === 'checkPatientsForAllergies');
        if (allergyFunc) {
          essentialFunctions.push(allergyFunc);
        }
      }
      
      // Add document functions if relevant
      if (isDocumentQuery) {
        essentialFunctions.push(
          {
            name: "listDocuments",
            description: isHebrew ? "הצג רשימת מסמכים" : "List documents",
            parameters: {
              type: "object",
              properties: {
                patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
                documentType: { type: "string", description: isHebrew ? "סוג מסמך" : "Document type" }
              },
              required: []
            }
          }
        );
      }
      
      // Add diagnosis functions if relevant  
      if (isDiagnosisQuery) {
        essentialFunctions.push(
          {
            name: "generateDiagnosis",
            description: isHebrew ? "צור אבחון רפואי" : "Generate medical diagnosis",
            parameters: {
              type: "object",
              properties: {
                symptoms: { type: "string", description: isHebrew ? "תסמינים" : "Symptoms" },
                patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" }
              },
              required: ["symptoms"]
            }
          }
        );
      }
      
      return essentialFunctions.filter(f => f).map(f => {
        if (f.parameters && f.parameters.properties) {
          f.parameters.properties = this.utilityHelpers.cleanUndefinedProperties(f.parameters.properties);
        }
        return f;
      });
    }

    getMinimalFunctionsForClaude(language, clinicCountry) {
      try {
        const isHebrew = language === 'he';
        const isIsrael = clinicCountry === 'Israel';
        
        // Get full functions then simplify descriptions
        const fullFunctions = this.getAllPlatformFunctions(language, clinicCountry);
        
        // Add null check - prevents filter errors downstream
        if (!fullFunctions || !Array.isArray(fullFunctions)) {
          console.error('⚠️ getAllPlatformFunctions returned invalid data');
          return [];
        }
        
        // CRITICAL FIX: Deduplicate functions by name to prevent "Tool names must be unique" error
        const seenNames = new Set();
        const deduplicatedFunctions = fullFunctions.filter(func => {
          if (!func || !func.name) {
            console.warn('⚠️ Invalid function object:', func);
            return false;
          }
          
          if (seenNames.has(func.name)) {
            console.warn(`⚠️ Duplicate function name found and removed: ${func.name}`);
            return false;
          }
          
          seenNames.add(func.name);
          return true;
        });
        
        console.log(`🔧 Functions after deduplication: ${deduplicatedFunctions.length} (was ${fullFunctions.length})`);
        
        // Return functions with proper Claude schema
        return deduplicatedFunctions.map(func => {
          return {
            name: func.name,
            description: (func.description || '').substring(0, 80), // Short but meaningful descriptions
            input_schema: func.parameters || {
              type: "object",
              properties: {},
              required: []
            }
          };
        });
        
      } catch (error) {
        console.error('⚠️ Error in getMinimalFunctionsForClaude:', error);
        return [];
      }
    }

    simplifyParameters(params, isHebrew) {
      if (!params || !params.properties) return params;
      
      const simplified = {
        type: params.type,
        properties: {},
        required: params.required || []
      };
      
      // Shorten all parameter descriptions
      for (const [key, value] of Object.entries(params.properties)) {
        if (!value) continue;
        
        simplified.properties[key] = {
          type: value.type
        };
        
        // Add enum if exists
        if (value.enum) {
          simplified.properties[key].enum = value.enum;
        }
        
        // NO DESCRIPTIONS - Claude understands from parameter names!
        // This saves 50-80% of tokens
      }
      
      return simplified;
    }

        getShortDescription(functionName, isHebrew) {
      const descriptions = {
        addAllergy: isHebrew ? "הוסף אלרגיה" : "Add allergy",
        addDiagnosis: isHebrew ? "הוסף אבחנה" : "Add diagnosis",
        addFullMedicalReport: isHebrew ? "הוסף דוח מלא" : "Add full report",
        addImagingResult: isHebrew ? "הוסף דימות" : "Add imaging",
        addLabResult: isHebrew ? "הוסף בדיקה" : "Add lab result",
        addMedicalHistory: isHebrew ? "הוסף היסטוריה רפואית" : "Add medical history",
        addMedication: isHebrew ? "הוסף תרופה" : "Add medication",
        addPatient: isHebrew ? "הוסף מטופל" : "Add patient",
        addUserRole: isHebrew ? "הוסף הרשאה" : "Add role",
        addUserSpecialty: isHebrew ? "הוסף התמחות" : "Add specialty",
        addVaccination: isHebrew ? "הוסף חיסון" : "Add vaccine",
        addVitalSigns: isHebrew ? "הוסף סימנים" : "Add vitals",
        analyzeSymptoms: isHebrew ? "נתח סימפטומים" : "Analyze symptoms",
        analyzeMedicalImage: isHebrew ? "נתח תמונה רפואית" : "Analyze medical image (X-ray, CT, MRI, Ultrasound)",
        compareMedicalImages: isHebrew ? "השווה תמונות רפואיות" : "Compare two medical images",
        getMedicalImageHistory: isHebrew ? "היסטוריית תמונות רפואיות" : "Get patient medical image history",
        startMedicareImport: isHebrew ? "ייבוא נתוני מדיקר" : "Start Medicare data import for a patient (Blue Button 2.0)",
        checkMedicareImportStatus: isHebrew ? "בדוק סטטוס ייבוא מדיקר" : "Check if patient completed Medicare data import",
        analyzeUploadedDocuments: isHebrew ? "נתח מסמכים" : "Analyze documents",
        anonymizePatientData: isHebrew ? "הסר מידע מזהה" : "Anonymize patient data",
        blockDoctorTime: isHebrew ? "חסום זמן" : "Block time",
        cancelAppointment: isHebrew ? "בטל תור" : "Cancel appointment",
        checkCalendarConflicts: isHebrew ? "בדוק התנגשויות" : "Check conflicts",
        checkCollectionHasData: isHebrew ? "בדוק נתונים בקולקציה" : "Check collection data",
        checkDrugInteractions: isHebrew ? "בדוק אינטראקציות" : "Check interactions",
        checkMedicationCoverageAPI: isHebrew ? "בדוק כיסוי תרופה API" : "Check medication coverage (API)",
        checkMedicationEntitlement: isHebrew ? "בדוק זכאות תרופה" : "Check medication entitlement",
        cleanupAppointmentReferences: isHebrew ? "נקה התייחסויות לפגישה" : "Cleanup appointment refs",
        createAbnormalResult: isHebrew ? "Create Abnormal Result Record" : "Create Abnormal Result Record",
        createAbnormalResults: isHebrew ? "Create Abnormal Results Record" : "Create Abnormal Results Record",
        createAccessPlanning: isHebrew ? "Create Access Planning Record" : "Create Access Planning Record",
        createAcmgGuidelinesReference: isHebrew ? "Create Acmg Guidelines Reference Record" : "Create Acmg Guidelines Reference Record",
        createAcuteKidneyInjury: isHebrew ? "Create Acute Kidney Injury Record" : "Create Acute Kidney Injury Record",
        createAddictionMedicineConsultation: isHebrew ? "Create Addiction Medicine Consultation Record" : "Create Addiction Medicine Consultation Record",
        createAddictionMedicineConsultations: isHebrew ? "Create Addiction Medicine Consultations Record" : "Create Addiction Medicine Consultations Record",
        createAdhdAssessment: isHebrew ? "Create Adhd Assessment Record" : "Create Adhd Assessment Record",
        createAdministrativeData: isHebrew ? "Create Administrative Data Record" : "Create Administrative Data Record",
        createAdmissionAssessment: isHebrew ? "Assess Patient Admission" : "Assess Patient Admission",
        createAdmissionAssessments: isHebrew ? "Create Admission Assessments Record" : "Create Admission Assessments Record",
        createAdmissionDecision: isHebrew ? "Create Admission Decision Record" : "Create Admission Decision Record",
        createAdmissionDecisions: isHebrew ? "Create Admission Decisions Record" : "Create Admission Decisions Record",
        createAdmissionRecommendation: isHebrew ? "Create Admission Recommendation Record" : "Create Admission Recommendation Record",
        createAdmissionRecommendations: isHebrew ? "Create Admission Recommendations Record" : "Create Admission Recommendations Record",
        createAdultDayProgramInfo: isHebrew ? "Create Adult Day Program Info Record" : "Create Adult Day Program Info Record",
        createAdvanceCarePlanning: isHebrew ? "Create Advance Care Planning Record" : "Create Advance Care Planning Record",
        createGoalsOfCareDiscussions: isHebrew ? "Create Advanced Directives Record" : "Create Advanced Directives Record",
        createAdvanceDirective: isHebrew ? "Create Advance Directive Record" : "Create Advance Directive Record",
        createAdvanceDirectiveDiscussion: isHebrew ? "Create Advance Directive Discussion Record" : "Create Advance Directive Discussion Record",
        createGeriatricCarePlanning: isHebrew ? "Create Advanced Care Planning Record" : "Create Advanced Care Planning Record",
        createAdvancedDirective: isHebrew ? "Healthcare Decision Guide" : "Healthcare Decision Guide",
        createAdvanceDirectives: isHebrew ? "Create Advance Directives Record" : "Create Advance Directives Record",
        createAirwayManagementRecords: isHebrew ? "Create Airway Management Records Record" : "Create Airway Management Records Record",
        createAllergies: isHebrew ? "Create Allergies Record" : "Create Allergies Record",
        createAllergiesAssessment: isHebrew ? "Assess patient allergies" : "Assess patient allergies",
        createAllergiesAssessments: isHebrew ? "Create Allergies Assessments Record" : "Create Allergies Assessments Record",
        createAllergy: isHebrew ? "Track Allergy Details" : "Track Allergy Details",
        createAllergyAssessment: isHebrew ? "Create Allergy Assessment Record" : "Create Allergy Assessment Record",
        createAllergyAssessments: isHebrew ? "Create Allergy Assessments Record" : "Create Allergy Assessments Record",
        createAllergyImmunologyAssessment: isHebrew ? "Create Allergy Immunology Assessment Record" : "Create Allergy Immunology Assessment Record",
        createAllergySkinTesting: isHebrew ? "Create Allergy Skin Testing Record" : "Create Allergy Skin Testing Record",
        createAmniocentesisReport: isHebrew ? "Generate Amniocentesis Report" : "Generate Amniocentesis Report",
        createAmniocentesisReports: isHebrew ? "Create Amniocentesis Reports Record" : "Create Amniocentesis Reports Record",
        createAmnioticFluidAssessment: isHebrew ? "Create Amniotic Fluid Assessment Record" : "Create Amniotic Fluid Assessment Record",
        createAmnioticFluidIndexCurrent: isHebrew ? "Create Amniotic Fluid Index Current Record" : "Create Amniotic Fluid Index Current Record",
        createAnatomyScanResult: isHebrew ? "Create Anatomy Scan Result Record" : "Create Anatomy Scan Result Record",
        createAnesthesiaComplications: isHebrew ? "Create Anesthesia Complications Record" : "Create Anesthesia Complications Record",
        createAnesthesiaConsent: isHebrew ? "Create Anesthesia Consent Record" : "Create Anesthesia Consent Record",
        createAnesthesiaRecord: isHebrew ? "Generate Anesthesia Documentation" : "Generate Anesthesia Documentation",
        createAnesthesiaRecords: isHebrew ? "Create Anesthesia Records Record" : "Create Anesthesia Records Record",
        createAnesthesiologyAssessment: isHebrew ? "Create Anesthesiology Assessment Record" : "Create Anesthesiology Assessment Record",
        createAnnualPhysicalExamination: isHebrew ? "Create Annual Physical Examination Record" : "Create Annual Physical Examination Record",
        createAntibiogramReport: isHebrew ? "Generate Antibiogram Report" : "Generate Antibiogram Report",
        createAntibiogramReports: isHebrew ? "Create Antibiogram Reports Record" : "Create Antibiogram Reports Record",
        createAntibioticStewardship: isHebrew ? "Create Antibiotic Stewardship Record" : "Create Antibiotic Stewardship Record",
        createAnticipatoryGuidance: isHebrew ? "Create Anticipatory Guidance Record" : "Create Anticipatory Guidance Record",
        createAnticoagulationManagement: isHebrew ? "Create Anticoagulation Management Record" : "Create Anticoagulation Management Record",
        createAntimicrobialSusceptibility: isHebrew ? "Create Antimicrobial Susceptibility Record" : "Create Antimicrobial Susceptibility Record",
        createApgarScore: isHebrew ? "Calculate Newborn Health" : "Calculate Newborn Health",
        createApgarScores: isHebrew ? "Create Apgar Scores Record" : "Create Apgar Scores Record",
        createAppetiteStimulant: isHebrew ? "Create Appetite Stimulant Record" : "Create Appetite Stimulant Record",
        createAppetiteStimulants: isHebrew ? "Create Appetite Stimulants Record" : "Create Appetite Stimulants Record",
        createAppointment: isHebrew ? "Schedule medical visit" : "Schedule medical visit",
        createAppointments: isHebrew ? "Create Appointments Record" : "Create Appointments Record",
        createArterialBloodGas: isHebrew ? "Create Arterial Blood Gas Record" : "Create Arterial Blood Gas Record",
        createArterialBloodGases: isHebrew ? "Create Arterial Blood Gases Record" : "Create Arterial Blood Gases Record",
        createArthritisAssessment: isHebrew ? "Assess Arthritis Condition" : "Assess Arthritis Condition",
        createArthritisAssessments: isHebrew ? "Create Arthritis Assessments Record" : "Create Arthritis Assessments Record",
        createArticularCartilage: isHebrew ? "Create Articular Cartilage Record" : "Create Articular Cartilage Record",
        createAssessmentPlan: isHebrew ? "Create Assessment Plan Record" : "Create Assessment Plan Record",
        createAssessmentPlans: isHebrew ? "Create Assessment Plans Record" : "Create Assessment Plans Record",
        createAssistiveDevice: isHebrew ? "Create Assistive Device Record" : "Create Assistive Device Record",
        createAssistiveDevices: isHebrew ? "Create Assistive Devices Record" : "Create Assistive Devices Record",
        createAsthmaActionPlan: isHebrew ? "Create Asthma Action Plan Record" : "Create Asthma Action Plan Record",
        createAsthmaAssessment: isHebrew ? "Create Asthma Assessment Record" : "Create Asthma Assessment Record",
        createAsthmaAssessments: isHebrew ? "Create Asthma Assessments Record" : "Create Asthma Assessments Record",
        createAsthmaManagementNote: isHebrew ? "Asthma Care Documentation" : "Asthma Care Documentation",
        createAsthmaManagementNotes: isHebrew ? "Create Asthma Management Notes Record" : "Create Asthma Management Notes Record",
        createAthleteSpecificData: isHebrew ? "Create Athlete Specific Data Record" : "Create Athlete Specific Data Record",
        createAthleticInjuryAssessment: isHebrew ? "Create Athletic Injury Assessment Record" : "Create Athletic Injury Assessment Record",
        createAudiometryReport: isHebrew ? "Generate Audiometry Report" : "Generate Audiometry Report",
        createAudiometryReports: isHebrew ? "Create Audiometry Reports Record" : "Create Audiometry Reports Record",
        createAutoantibodyProfile: isHebrew ? "Create Autoantibody Profile Record" : "Create Autoantibody Profile Record",
        createAutoimmuneEvaluation: isHebrew ? "Assess Autoimmune Condition" : "Assess Autoimmune Condition",
        createAutoimmuneEvaluations: isHebrew ? "Create Autoimmune Evaluations Record" : "Create Autoimmune Evaluations Record",
        createAutoimmunePanel: isHebrew ? "Autoimmune Disease Panel" : "Autoimmune Disease Panel",
        createAutoimmunePanels: isHebrew ? "Create Autoimmune Panels Record" : "Create Autoimmune Panels Record",
        createAutopsyReport: isHebrew ? "Generate Autopsy Report" : "Generate Autopsy Report",
        createAutopsyReports: isHebrew ? "Create Autopsy Reports Record" : "Create Autopsy Reports Record",
        createBarriersPsychosocialIssue: isHebrew ? "Create Barriers Psychosocial Issue Record" : "Create Barriers Psychosocial Issue Record",
        createBarriersPsychosocialIssues: isHebrew ? "Create Barriers Psychosocial Issues Record" : "Create Barriers Psychosocial Issues Record",
        createBasalRateAdjustment: isHebrew ? "Create Basal Rate Adjustment Record" : "Create Basal Rate Adjustment Record",
        createBasalRateAdjustments: isHebrew ? "Create Basal Rate Adjustments Record" : "Create Basal Rate Adjustments Record",
        createBehavioralAssessment: isHebrew ? "Create Behavioral Assessment Record" : "Create Behavioral Assessment Record",
        createBehavioralHealthGoals: isHebrew ? "Create Behavioral Health Goals Record" : "Create Behavioral Health Goals Record",
        createBiologicTherapy: isHebrew ? "Create Biologic Therapy Record" : "Create Biologic Therapy Record",
        createBiologicTherapyRecord: isHebrew ? "Create Biologic Therapy Record Record" : "Create Biologic Therapy Record Record",
        createBiologicTherapyRecords: isHebrew ? "Create Biologic Therapy Records Record" : "Create Biologic Therapy Records Record",
        createBiopsyReport: isHebrew ? "Generate Biopsy Report" : "Generate Biopsy Report",
        createBiopsychosocialFormulation: isHebrew ? "Create Biopsychosocial Formulation Record" : "Create Biopsychosocial Formulation Record",
        createBiopsyReports: isHebrew ? "Create Biopsy Reports Record" : "Create Biopsy Reports Record",
        createBirthHistory: isHebrew ? "Create Birth History Record" : "Create Birth History Record",
        createBirthPlan: isHebrew ? "Create Birth Plan Record" : "Create Birth Plan Record",
        createBleedingRiskAssessment: isHebrew ? "Create Bleeding Risk Assessment Record" : "Create Bleeding Risk Assessment Record",
        createBloodDisorderReport: isHebrew ? "Generate Blood Disorder Report" : "Generate Blood Disorder Report",
        createBloodDisorderReports: isHebrew ? "Create Blood Disorder Reports Record" : "Create Blood Disorder Reports Record",
        createBloodGlucoseLog: isHebrew ? "Track Blood Sugar" : "Track Blood Sugar",
        createBloodGlucoseLogs: isHebrew ? "Create Blood Glucose Logs Record" : "Create Blood Glucose Logs Record",
        createBloodGlucoseMonitoring: isHebrew ? "Create Blood Glucose Monitoring Record" : "Create Blood Glucose Monitoring Record",
        createBloodPressureReading: isHebrew ? "Create Blood Pressure Reading Record" : "Create Blood Pressure Reading Record",
        createBloodPressureReadings: isHebrew ? "Create Blood Pressure Readings Record" : "Create Blood Pressure Readings Record",
        createBloodProduct: isHebrew ? "Create Blood Product Record" : "Create Blood Product Record",
        createBloodProducts: isHebrew ? "Create Blood Products Record" : "Create Blood Products Record",
        createBloodProductsOrdered: isHebrew ? "Create Blood Products Ordered Record" : "Create Blood Products Ordered Record",
        createBloodSampleCollectionStatu: isHebrew ? "Create Blood Sample Collection Statu Record" : "Create Blood Sample Collection Statu Record",
        createBloodSampleCollectionStatus: isHebrew ? "Create Blood Sample Collection Status Record" : "Create Blood Sample Collection Status Record",
        createBloodSmear: isHebrew ? "Prepare blood slide" : "Prepare blood slide",
        createBloodSmears: isHebrew ? "Create Blood Smears Record" : "Create Blood Smears Record",
        createBolusAdjustment: isHebrew ? "Create Bolus Adjustment Record" : "Create Bolus Adjustment Record",
        createBolusAdjustments: isHebrew ? "Create Bolus Adjustments Record" : "Create Bolus Adjustments Record",
        createBoneHealth: isHebrew ? "Create Bone Health Record" : "Create Bone Health Record",
        createBoneMarrowReport: isHebrew ? "Generate Bone Marrow Report" : "Generate Bone Marrow Report",
        createBoneMarrowReports: isHebrew ? "Create Bone Marrow Reports Record" : "Create Bone Marrow Reports Record",
        createBoneMarrowStudies: isHebrew ? "Create Bone Marrow Studies Record" : "Create Bone Marrow Studies Record",
        createBoneMarrowStudy: isHebrew ? "Analyze bone marrow" : "Analyze bone marrow",
        createBoneScanReport: isHebrew ? "Generate bone scan report" : "Generate bone scan report",
        createBoneScanReports: isHebrew ? "Create Bone Scan Reports Record" : "Create Bone Scan Reports Record",
        createBrainTumorCharacteristic: isHebrew ? "Brain Tumor Trait" : "Brain Tumor Trait",
        createBrainTumorCharacteristics: isHebrew ? "Create Brain Tumor Characteristics Record" : "Create Brain Tumor Characteristics Record",
        createBrainTumorMolecularMarker: isHebrew ? "Create Brain Tumor Molecular Marker Record" : "Create Brain Tumor Molecular Marker Record",
        createBrainTumorMolecularMarkers: isHebrew ? "Create Brain Tumor Molecular Markers Record" : "Create Brain Tumor Molecular Markers Record",
        createBreastfeedingRecommendation: isHebrew ? "Create Breastfeeding Recommendation Record" : "Create Breastfeeding Recommendation Record",
        createCamIcu: isHebrew ? "Create Cam Icu Record" : "Create Cam Icu Record",
        createCancerDiagnosi: isHebrew ? "Create Cancer Diagnosi Record" : "Create Cancer Diagnosi Record",
        createCancerDiagnosis: isHebrew ? "Create Cancer Diagnosis Record" : "Create Cancer Diagnosis Record",
        createCancerRelatedSideEffect: isHebrew ? "Create Cancer Related Side Effect Record" : "Create Cancer Related Side Effect Record",
        createCancerRelatedSideEffects: isHebrew ? "Create Cancer Related Side Effects Record" : "Create Cancer Related Side Effects Record",
        createCancerScreeningRecords: isHebrew ? "Create Cancer Screening Records Record" : "Create Cancer Screening Records Record",
        createCancerStaging: isHebrew ? "Create Cancer Staging Record" : "Create Cancer Staging Record",
        createCancerSurveillance: isHebrew ? "Create Cancer Surveillance Record" : "Create Cancer Surveillance Record",
        createCarbohydrateCountingEducation: isHebrew ? "Create Carbohydrate Counting Education Record" : "Create Carbohydrate Counting Education Record",
        createCardiacCatheterizationReport: isHebrew ? "Generate Cardiac Catheterization Report" : "Generate Cardiac Catheterization Report",
        createCardiacCatheterizationReports: isHebrew ? "Create Cardiac Catheterization Reports Record" : "Create Cardiac Catheterization Reports Record",
        createCardiacDeviceInterrogation: isHebrew ? "Create Cardiac Device Interrogation Record" : "Create Cardiac Device Interrogation Record",
        createCardiacDeviceInterrogations: isHebrew ? "Create Cardiac Device Interrogations Record" : "Create Cardiac Device Interrogations Record",
        createCardiacMonitoring: isHebrew ? "Create Cardiac Monitoring Record" : "Create Cardiac Monitoring Record",
        createCardiacRehabilitationReport: isHebrew ? "Generate Cardiac Rehab Report" : "Generate Cardiac Rehab Report",
        createCardiacRehabilitationReports: isHebrew ? "Create Cardiac Rehabilitation Reports Record" : "Create Cardiac Rehabilitation Reports Record",
        createCardiologyAdmissionNote: isHebrew ? "Generate Cardiology Admission Note" : "Generate Cardiology Admission Note",
        createCardiologyAdmissionNotes: isHebrew ? "Create Cardiology Admission Notes Record" : "Create Cardiology Admission Notes Record",
        createCardiologyAssessment: isHebrew ? "Create Cardiology Assessment Record" : "Create Cardiology Assessment Record",
        createCardiologyConsultation: isHebrew ? "Request cardiac evaluation" : "Request cardiac evaluation",
        createCardiologyConsultations: isHebrew ? "Create Cardiology Consultations Record" : "Create Cardiology Consultations Record",
        createCardiologyFollowupReport: isHebrew ? "Generate Cardiology Followup Report" : "Generate Cardiology Followup Report",
        createCardiologyFollowupReports: isHebrew ? "Create Cardiology Followup Reports Record" : "Create Cardiology Followup Reports Record",
        createCardiovascularRiskReduction: isHebrew ? "Create Cardiovascular Risk Reduction Record" : "Create Cardiovascular Risk Reduction Record",
        createCardiovascularRiskScreening: isHebrew ? "Create Cardiovascular Risk Screening Record" : "Create Cardiovascular Risk Screening Record",
        createCareCoordination: isHebrew ? "Create Care Coordination Record" : "Create Care Coordination Record",
        createCareCoordinationNote: isHebrew ? "Craft Care Coordination" : "Craft Care Coordination",
        createCareCoordinationNotes: isHebrew ? "Create Care Coordination Notes Record" : "Create Care Coordination Notes Record",
        createCareGap: isHebrew ? "Track Patient Gaps" : "Track Patient Gaps",
        createCareGaps: isHebrew ? "Create Care Gaps Record" : "Create Care Gaps Record",
        createCaregiverSupportGroups: isHebrew ? "Create Caregiver Support Groups Record" : "Create Caregiver Support Groups Record",
        createCareTeam: isHebrew ? "Create Care Team Record" : "Create Care Team Record",
        createCareTeamInfo: isHebrew ? "Create Care Team Info Record" : "Create Care Team Info Record",
        createCaregiverAssessment: isHebrew ? "Create Caregiver Assessment Record" : "Create Caregiver Assessment Record",
        createCaregiverSupport: isHebrew ? "Create Caregiver Support Record" : "Create Caregiver Support Record",
        createCaregiverSupportGroup: isHebrew ? "Create Caregiver Support Group Record" : "Create Caregiver Support Group Record",
        createCascadeTestingProtocol: isHebrew ? "Create Cascade Testing Protocol Record" : "Create Cascade Testing Protocol Record",
        createCaseManagement: isHebrew ? "Create Case Management Record" : "Create Case Management Record",
        createCaseSummaries: isHebrew ? "Create Case Summaries Record" : "Create Case Summaries Record",
        createCaseSummary: isHebrew ? "Generate Case Summary" : "Generate Case Summary",
        createCellFreeDnaResult: isHebrew ? "Create Cell Free Dna Result Record" : "Create Cell Free Dna Result Record",
        createCervicalAssessment: isHebrew ? "Create Cervical Assessment Record" : "Create Cervical Assessment Record",
        createCervicalLengthMeasurement: isHebrew ? "Create Cervical Length Measurement Record" : "Create Cervical Length Measurement Record",
        createCesareanThreshold: isHebrew ? "Create Cesarean Threshold Record" : "Create Cesarean Threshold Record",
        createCgmData: isHebrew ? "Create Cgm Data Record" : "Create Cgm Data Record",
        createChallengeTest: isHebrew ? "Create Challenge Test Record" : "Create Challenge Test Record",
        createChallengeTests: isHebrew ? "Create Challenge Tests Record" : "Create Challenge Tests Record",
        createChatSession: isHebrew ? "צור שיחה" : "Create chat",
        createChemotherapyRecord: isHebrew ? "Create Cancer Treatment Record" : "Create Cancer Treatment Record",
        createChemotherapyRecords: isHebrew ? "Create Chemotherapy Records Record" : "Create Chemotherapy Records Record",
        createChemotherapyRegimen: isHebrew ? "Create Chemotherapy Regimen Record" : "Create Chemotherapy Regimen Record",
        createChiefComplaint: isHebrew ? "Create Chief Complaint Record" : "Create Chief Complaint Record",
        createChiefComplaints: isHebrew ? "Create Chief Complaints Record" : "Create Chief Complaints Record",
        createChildrenSpecificRisk: isHebrew ? "Create Children Specific Risk Record" : "Create Children Specific Risk Record",
        createChronicDiseaseGoals: isHebrew ? "Create Chronic Disease Goals Record" : "Create Chronic Disease Goals Record",
        createChronicDiseaseManagement: isHebrew ? "Create Chronic Disease Management Record" : "Create Chronic Disease Management Record",
        createChronicPainAssessment: isHebrew ? "Create Chronic Pain Assessment Record" : "Create Chronic Pain Assessment Record",
        createCkdAssessment: isHebrew ? "Create Ckd Assessment Record" : "Create Ckd Assessment Record",
        createCkdManagement: isHebrew ? "Create Ckd Management Record" : "Create Ckd Management Record",
        createClinicalDecisionSupport: isHebrew ? "Enhance medical decision-making" : "Enhance medical decision-making",
        createClinicalRiskScore: isHebrew ? "Create Clinical Risk Score Record" : "Create Clinical Risk Score Record",
        createClinicalRiskScores: isHebrew ? "Create Detailed Risk Assessment" : "CLINICAL RISK SCORES - Create detailed risk score assessment (APACHE II, SOFA, CHA2DS2-VASc, MELD, Wells). Use this for comprehensive risk assessments with predicted mortality, morbidity, component scores, vital signs, lab values, and treatment recommendations.",
        createClinicalScore: isHebrew ? "Calculate Patient Risk" : "CLINICAL SCORES - Create simple clinical score record (ASA, RCRI, Mallampati, NIHSS values). Use this for storing individual score values without detailed risk analysis.",
        createClinicalScores: isHebrew ? "Create Clinical Scores Record" : "Create Clinical Scores Record",
        createClinicalTrial: isHebrew ? "Create Clinical Trial Record" : "Create Clinical Trial Record",
        createClinicalTrialDocument: isHebrew ? "Generate Clinical Trial Document" : "Generate Clinical Trial Document",
        createClinicalTrialDocuments: isHebrew ? "Create Clinical Trial Documents Record" : "Create Clinical Trial Documents Record",
        createClinicalTrials: isHebrew ? "Create Clinical Trials Record" : "Create Clinical Trials Record",
        createClosureTechnique: isHebrew ? "Create Closure Technique Record" : "Create Closure Technique Record",
        createCmvMonitoringPlan: isHebrew ? "Create Cmv Monitoring Plan Record" : "Create Cmv Monitoring Plan Record",
        createCoagulationStudies: isHebrew ? "Create Coagulation Studies Record" : "Create Coagulation Studies Record",
        createCoagulationStudy: isHebrew ? "Assess Blood Clotting" : "Assess Blood Clotting",
        createCodeBlueSummaries: isHebrew ? "Create Code Blue Summaries Record" : "Create Code Blue Summaries Record",
        createCodeBlueSummary: isHebrew ? "Compile Code Blue details" : "Compile Code Blue details",
        createCognitiveEvaluation: isHebrew ? "Assess Cognitive Performance" : "Assess Cognitive Performance",
        createCognitiveEvaluations: isHebrew ? "Create Cognitive Evaluations Record" : "Create Cognitive Evaluations Record",
        createCognitiveRehabilitationReport: isHebrew ? "Generate Cognitive Rehab Report" : "Generate Cognitive Rehab Report",
        createCognitiveRehabilitationReports: isHebrew ? "Create Cognitive Rehabilitation Reports Record" : "Create Cognitive Rehabilitation Reports Record",
        createCognitiveScreening: isHebrew ? "Create Cognitive Screening Record" : "Create Cognitive Screening Record",
        createColonoscopyReport: isHebrew ? "Generate Colonoscopy Report" : "Generate Colonoscopy Report",
        createColonoscopyReports: isHebrew ? "Create Colonoscopy Reports Record" : "Create Colonoscopy Reports Record",
        createColorectalColonoscopies: isHebrew ? "Create Colorectal Colonoscopies Record" : "Create Colorectal Colonoscopies Record",
        createColorectalColonoscopy: isHebrew ? "Colon Cancer Screening" : "Colon Cancer Screening",
        createColorectalSurgeryAssessment: isHebrew ? "Create Colorectal Surgery Assessment Record" : "Create Colorectal Surgery Assessment Record",
        createColorectalSurgeryConsultation: isHebrew ? "Schedule Colorectal Consultation" : "Schedule Colorectal Consultation",
        createColorectalSurgeryConsultations: isHebrew ? "Create Colorectal Surgery Consultations Record" : "Create Colorectal Surgery Consultations Record",
        createCommunicationPreference: isHebrew ? "Create Communication Preference Record" : "Create Communication Preference Record",
        createCommunicationPreferences: isHebrew ? "Create Communication Preferences Record" : "Create Communication Preferences Record",
        createComplication: isHebrew ? "Create Complication Record" : "Create Complication Record",
        createComplications: isHebrew ? "Create Complications Record" : "Create Complications Record",
        createComponentAllergenTesting: isHebrew ? "Create Component Allergen Testing Record" : "Create Component Allergen Testing Record",
        createComprehensiveCardiomyopathyPanel: isHebrew ? "Create Comprehensive Cardiomyopathy Panel Record" : "Create Comprehensive Cardiomyopathy Panel Record",
        createCompressionTherapy: isHebrew ? "Create Compression Therapy Record" : "Create Compression Therapy Record",
        createConcussionAssessment: isHebrew ? "Create Concussion Assessment Record" : "Create Concussion Assessment Record",
        createConnectiveTissueDiseaseAssessment: isHebrew ? "Create Connective Tissue Disease Assessment Record" : "Create Connective Tissue Disease Assessment Record",
        createConsultationDetail: isHebrew ? "Create Consultation Detail Record" : "Create Consultation Detail Record",
        createConsultationDetails: isHebrew ? "Create Consultation Details Record" : "Create Consultation Details Record",
        createConsultationNote: isHebrew ? "Create Consultation Note Record" : "Create Consultation Note Record",
        createConsultationNotes: isHebrew ? "Draft medical consultation" : "Draft medical consultation",
        createConsultationRequests: isHebrew ? "Create Consultation Requests Record" : "Create Consultation Requests Record",
        createConsultationTimeline: isHebrew ? "Create Consultation Timeline Record" : "Create Consultation Timeline Record",
        createContinuousGlucoseMonitor: isHebrew ? "Create Continuous Glucose Monitor Record" : "Create Continuous Glucose Monitor Record",
        createContinuousGlucoseMonitorDiscussion: isHebrew ? "Create Continuous Glucose Monitor Discussion Record" : "Create Continuous Glucose Monitor Discussion Record",
        createContinuousInfusion: isHebrew ? "Create Continuous Infusion Record" : "Create Continuous Infusion Record",
        createContinuousInfusions: isHebrew ? "Create Continuous Infusions Record" : "Create Continuous Infusions Record",
        createContractionMonitoring: isHebrew ? "Create Contraction Monitoring Record" : "Create Contraction Monitoring Record",
        createCopdAssessment: isHebrew ? "Assess COPD status" : "Assess COPD status",
        createCopdAssessments: isHebrew ? "Create Copd Assessments Record" : "Create Copd Assessments Record",
        createCpapManagement: isHebrew ? "Create Cpap Management Record" : "Create Cpap Management Record",
        createCriticalViewOfSafety: isHebrew ? "Create Critical View Of Safety Record" : "Create Critical View Of Safety Record",
        createCulturalConsideration: isHebrew ? "Create Cultural Consideration Record" : "Create Cultural Consideration Record",
        createCulturalConsiderations: isHebrew ? "Create Cultural Considerations Record" : "Create Cultural Considerations Record",
        createCurrentDialysi: isHebrew ? "Create Current Dialysi Record" : "Create Current Dialysi Record",
        createCurrentDialysis: isHebrew ? "Create Current Dialysis Record" : "Create Current Dialysis Record",
        createCurrentPregnancy: isHebrew ? "Create Current Pregnancy Record" : "Create Current Pregnancy Record",
        createCystoscopyReport: isHebrew ? "Generate Cystoscopy Report" : "Generate Cystoscopy Report",
        createCystoscopyReports: isHebrew ? "Create Cystoscopy Reports Record" : "Create Cystoscopy Reports Record",
        createCytogenetic: isHebrew ? "Create Cytogenetic Record" : "Create Cytogenetic Record",
        createCytogenetics: isHebrew ? "Create Cytogenetics Record" : "Create Cytogenetics Record",
        createCytologyReport: isHebrew ? "Generate Cytology Report" : "Generate Cytology Report",
        createCytologyReports: isHebrew ? "Create Cytology Reports Record" : "Create Cytology Reports Record",
        createdAt: isHebrew ? "Create d At Record" : "Create d At Record",
        createDataManagementInstruction: isHebrew ? "Create Data Management Instruction Record" : "Create Data Management Instruction Record",
        createDataManagementInstructions: isHebrew ? "Create Data Management Instructions Record" : "Create Data Management Instructions Record",
        createDayProgram: isHebrew ? "Create Day Program Record" : "Create Day Program Record",
        createDayPrograms: isHebrew ? "Create Day Programs Record" : "Create Day Programs Record",
        createDaytimeSleepinessAssessment: isHebrew ? "Create Daytime Sleepiness Assessment Record" : "Create Daytime Sleepiness Assessment Record",
        createDeepBrainStimulation: isHebrew ? "Create Deep Brain Stimulation Record" : "Create Deep Brain Stimulation Record",
        createDeliveryPlanning: isHebrew ? "Create Delivery Planning Record" : "Create Delivery Planning Record",
        createDementiaAssessment: isHebrew ? "Create Dementia Assessment Record" : "Create Dementia Assessment Record",
        createDementiaEducation: isHebrew ? "Create Dementia Education Record" : "Create Dementia Education Record",
        createDentalExaminationReport: isHebrew ? "Generate Dental Exam Report" : "Generate Dental Exam Report",
        createDentalExaminationReports: isHebrew ? "Create Dental Examination Reports Record" : "Create Dental Examination Reports Record",
        createDepartment: isHebrew ? "Create Department Record" : "Create Department Record",
        createDepressionScreening: isHebrew ? "Create Depression Screening Record" : "Create Depression Screening Record",
        createDermatologyAssessment: isHebrew ? "Create Dermatology Assessment Record" : "Create Dermatology Assessment Record",
        createDermatologyConsultation: isHebrew ? "Schedule Skin Consultation" : "Schedule Skin Consultation",
        createDermatologyConsultations: isHebrew ? "Create Dermatology Consultations Record" : "Create Dermatology Consultations Record",
        createDermatologyProcedureNote: isHebrew ? "Generate Dermatology Procedure Note" : "Generate Dermatology Procedure Note",
        createDermatologyProcedureNotes: isHebrew ? "Create Dermatology Procedure Notes Record" : "Create Dermatology Procedure Notes Record",
        createDetailedFamilyPedigree: isHebrew ? "Create Detailed Family Pedigree Record" : "Create Detailed Family Pedigree Record",
        createDevelopmentalAssessment: isHebrew ? "Assess Child Development" : "Assess Child Development",
        createDevelopmentalAssessments: isHebrew ? "Create Developmental Assessments Record" : "Create Developmental Assessments Record",
        createDevelopmentalMilestone: isHebrew ? "Create Developmental Milestone Record" : "Create Developmental Milestone Record",
        createDevelopmentalMilestones: isHebrew ? "Create Developmental Milestones Record" : "Create Developmental Milestones Record",
        createDexaScanReport: isHebrew ? "Generate DEXA Scan Summary" : "Generate DEXA Scan Summary",
        createDexaScanReports: isHebrew ? "Create Dexa Scan Reports Record" : "Create Dexa Scan Reports Record",
        createDiabetesEducation: isHebrew ? "Create Diabetes Education Record" : "Create Diabetes Education Record",
        createDiabetesEducator: isHebrew ? "Create Diabetes Educator Record" : "Create Diabetes Educator Record",
        createDiabetesEducatorTraining: isHebrew ? "Create Diabetes Educator Training Record" : "Create Diabetes Educator Training Record",
        createDiabetesManagement: isHebrew ? "Create Diabetes Management Record" : "Create Diabetes Management Record",
        createDiabetesManagementNote: isHebrew ? "Diabetes Care Documentation" : "Diabetes Care Documentation",
        createDiabetesManagementNotes: isHebrew ? "Create Diabetes Management Notes Record" : "Create Diabetes Management Notes Record",
        createDiabetesManagementPlan: isHebrew ? "Create Diabetes Management Plan Record" : "Create Diabetes Management Plan Record",
        createDiabetesQualityMetric: isHebrew ? "Create Diabetes Quality Metric Record" : "Create Diabetes Quality Metric Record",
        createDiabetesQualityMetrics: isHebrew ? "Create Diabetes Quality Metrics Record" : "Create Diabetes Quality Metrics Record",
        createDiabetesSupplies: isHebrew ? "Create Diabetes Supplies Record" : "Create Diabetes Supplies Record",
        createDiabetesSupply: isHebrew ? "Create Diabetes Supply Record" : "Create Diabetes Supply Record",
        createDiabeticNephropathy: isHebrew ? "Create Diabetic Nephropathy Record" : "Create Diabetic Nephropathy Record",
        createDiagnos: isHebrew ? "Generate Medical Diagnosis" : "Generate Medical Diagnosis",
        createDiagnoses: isHebrew ? "Create Diagnoses Record" : "Create Diagnoses Record",
        createDiagnosticImpression: isHebrew ? "Create Diagnostic Impression Record" : "Create Diagnostic Impression Record",
        createDiagnosticStudies: isHebrew ? "Create Diagnostic Studies Record" : "Create Diagnostic Studies Record",
        createDiagnosticStudy: isHebrew ? "Create Diagnostic Study Record" : "Create Diagnostic Study Record",
        createDialysateComposition: isHebrew ? "Create Dialysate Composition Record" : "Create Dialysate Composition Record",
        createDialysisPlanning: isHebrew ? "Create Dialysis Planning Record" : "Create Dialysis Planning Record",
        createDialysisPrescription: isHebrew ? "Create Dialysis Prescription Record" : "Create Dialysis Prescription Record",
        createDialysisRecord: isHebrew ? "Create Dialysis Entry" : "Create Dialysis Entry",
        createDialysisRecords: isHebrew ? "Create Dialysis Records Record" : "Create Dialysis Records Record",
        createDialysisRunSheet: isHebrew ? "Generate Dialysis Run Sheet" : "Generate Dialysis Run Sheet",
        createDialysisRunSheets: isHebrew ? "Create Dialysis Run Sheets Record" : "Create Dialysis Run Sheets Record",
        createDialyzer: isHebrew ? "Create Dialyzer Record" : "Create Dialyzer Record",
        createDietaryIntervention: isHebrew ? "Create Dietary Intervention Record" : "Create Dietary Intervention Record",
        createDietaryInterventions: isHebrew ? "Create Dietary Interventions Record" : "Create Dietary Interventions Record",
        createDisabilityEvaluation: isHebrew ? "Assess disability status" : "Assess disability status",
        createDisabilityEvaluations: isHebrew ? "Create Disability Evaluations Record" : "Create Disability Evaluations Record",
        createDischargePlanning: isHebrew ? "Create Discharge Planning Record" : "Create Discharge Planning Record",
        createDischargeSummaries: isHebrew ? "Generate Patient Discharge Summary" : "Generate Patient Discharge Summary",
        createDischargeSummary: isHebrew ? "Create Discharge Summary Record" : "Create Discharge Summary Record",
        createDiseaseActivityScore: isHebrew ? "Create Disease Activity Score Record" : "Create Disease Activity Score Record",
        createDiseaseActivityScores: isHebrew ? "Create Disease Activity Scores Record" : "Create Disease Activity Scores Record",
        createDiseaseSeverity: isHebrew ? "Create Disease Severity Record" : "Create Disease Severity Record",
        createDnrOrder: isHebrew ? "Create DNR Order" : "Create DNR Order",
        createDnrOrders: isHebrew ? "Create Dnr Orders Record" : "Create Dnr Orders Record",
        createDoctorsMedicationRecommendation: isHebrew ? "Create Doctors Medication Recommendation Record" : "Create Doctors Medication Recommendation Record",
        createDoctorsMedicationRecommendations: isHebrew ? "Create Doctors Medication Recommendations Record" : "Create Doctors Medication Recommendations Record",
        createDoctorsMedicationsRecommendation: isHebrew ? "Create Doctors Medications Recommendation Record" : "Create Doctors Medications Recommendation Record",
        createDoctorsMedicationsRecommendations: isHebrew ? "Create Doctors Medications Recommendations Record" : "Create Doctors Medications Recommendations Record",
        createDoctorsMedicationsRecommendationsOptimization: isHebrew ? "Create Doctors Medications Recommendations Optimization Record" : "Create Doctors Medications Recommendations Optimization Record",
        createDoctorsMedicationsRecommendationsOptimizations: isHebrew ? "Create Doctors Medications Recommendations Optimizations Record" : "Create Doctors Medications Recommendations Optimizations Record",
        createDocumentMetadata: isHebrew ? "Create Document Metadata Record" : "Create Document Metadata Record",
        createDocumentType: isHebrew ? "Create Document Type Record" : "Create Document Type Record",
        createDownloadGlucometer: isHebrew ? "Create Download Glucometer Record" : "Create Download Glucometer Record",
        createDurableMedicalEquipmentOrders: isHebrew ? "Create Durable Medical Equipment Orders Record" : "Create Durable Medical Equipment Orders Record",
        createDvtProphylaxi: isHebrew ? "Create Dvt Prophylaxi Record" : "Create Dvt Prophylaxi Record",
        createDvtProphylaxis: isHebrew ? "Create Dvt Prophylaxis Record" : "Create Dvt Prophylaxis Record",
        createEarlyChildhoodDevelopment: isHebrew ? "Create Early Childhood Development Record" : "Create Early Childhood Development Record",
        createEarlyMaternityLeave: isHebrew ? "Create Early Maternity Leave Record" : "Create Early Maternity Leave Record",
        createEcgReport: isHebrew ? "Generate ECG Report" : "Generate ECG Report",
        createEcgReports: isHebrew ? "Create Ecg Reports Record" : "Create Ecg Reports Record",
        createEchoReport: isHebrew ? "Generate Echo Report" : "Generate Echo Report",
        createEchoReports: isHebrew ? "Create Echo Reports Record" : "Create Echo Reports Record",
        createEdCourse: isHebrew ? "Create Ed Course Record" : "Create Ed Course Record",
        createEdDisposition: isHebrew ? "Create Ed Disposition Record" : "Create Ed Disposition Record",
        createEdTriageAssessment: isHebrew ? "Create Ed Triage Assessment Record" : "Create Ed Triage Assessment Record",
        createEducationInitiated: isHebrew ? "Create Education Initiated Record" : "Create Education Initiated Record",
        createEegReport: isHebrew ? "Generate EEG Report" : "Generate EEG Report",
        createEegReports: isHebrew ? "Create Eeg Reports Record" : "Create Eeg Reports Record",
        createElderAbuseScreening: isHebrew ? "Create Elder Abuse Screening Record" : "Create Elder Abuse Screening Record",
        createEmergencyAirwayManagement: isHebrew ? "Create Emergency Airway Management Record" : "Create Emergency Airway Management Record",
        createEmergencyAssessment: isHebrew ? "Create Emergency Assessment Record" : "Create Emergency Assessment Record",
        createEmergencyDischargeSummaries: isHebrew ? "Create Emergency Discharge Summaries Record" : "Create Emergency Discharge Summaries Record",
        createEmergencyDischargeSummary: isHebrew ? "Generate Emergency Discharge Summary" : "Generate Emergency Discharge Summary",
        createEmergencyDisposition: isHebrew ? "Create Emergency Disposition Record" : "Create Emergency Disposition Record",
        createEmergencyInformation: isHebrew ? "Create Emergency Information Record" : "Create Emergency Information Record",
        createEmergencyObservationUnit: isHebrew ? "Create Emergency Observation Unit Record" : "Create Emergency Observation Unit Record",
        createEmergencyProcedures: isHebrew ? "Create Emergency Procedures Record" : "Create Emergency Procedures Record",
        createEmergencyReport: isHebrew ? "Generate Emergency Details" : "Generate Emergency Details",
        createEmergencyReports: isHebrew ? "Create Emergency Reports Record" : "Create Emergency Reports Record",
        createEmgReport: isHebrew ? "Generate EMG Report" : "Generate EMG Report",
        createEmgReports: isHebrew ? "Create Emg Reports Record" : "Create Emg Reports Record",
        createEmploymentCounseling: isHebrew ? "Create Employment Counseling Record" : "Create Employment Counseling Record",
        createEmsRunReport: isHebrew ? "Generate EMS Run Report" : "Generate EMS Run Report",
        createEmsRunReports: isHebrew ? "Create Ems Run Reports Record" : "Create Ems Run Reports Record",
        createEndocrineLabResult: isHebrew ? "Create Endocrine Lab Result Record" : "Create Endocrine Lab Result Record",
        createEndocrineLabResults: isHebrew ? "Create Endocrine Lab Results Record" : "Create Endocrine Lab Results Record",
        createEndocrineTherapy: isHebrew ? "Create Endocrine Therapy Record" : "Create Endocrine Therapy Record",
        createEndocrinologyAssessment: isHebrew ? "Create Endocrinology Assessment Record" : "Create Endocrinology Assessment Record",
        createEndocrinologyConsultation: isHebrew ? "Schedule Hormone Consultation" : "Schedule Hormone Consultation",
        createEndocrinologyConsultations: isHebrew ? "Create Endocrinology Consultations Record" : "Create Endocrinology Consultations Record",
        createEndoscopyFinding: isHebrew ? "Create Endoscopy Finding Record" : "Create Endoscopy Finding Record",
        createEndoscopyFindings: isHebrew ? "Create Endoscopy Findings Record" : "Create Endoscopy Findings Record",
        createEndoscopyReport: isHebrew ? "Generate Endoscopy Report" : "Generate Endoscopy Report",
        createEndoscopyReports: isHebrew ? "Create Endoscopy Reports Record" : "Create Endoscopy Reports Record",
        createEntAssessment: isHebrew ? "Create Ent Assessment Record" : "Create Ent Assessment Record",
        createEntConsultation: isHebrew ? "Schedule Medical Consultation" : "Schedule Medical Consultation",
        createEntConsultations: isHebrew ? "Create Ent Consultations Record" : "Create Ent Consultations Record",
        createEnvironmentalExposure: isHebrew ? "Create Environmental Exposure Record" : "Create Environmental Exposure Record",
        createEnvironmentalExposures: isHebrew ? "Create Environmental Exposures Record" : "Create Environmental Exposures Record",
        createEpilepsyAssessment: isHebrew ? "Create Epilepsy Assessment Record" : "Create Epilepsy Assessment Record",
        createErgonomicAssessment: isHebrew ? "Create Ergonomic Assessment Record" : "Create Ergonomic Assessment Record",
        createEstimatedBloodLoss: isHebrew ? "Create Estimated Blood Loss Record" : "Create Estimated Blood Loss Record",
        createEstimatedDeliveryDate: isHebrew ? "Create Estimated Delivery Date Record" : "Create Estimated Delivery Date Record",
        createEstimatedTimeToDialysi: isHebrew ? "Create Estimated Time To Dialysi Record" : "Create Estimated Time To Dialysi Record",
        createEstimatedTimeToDialysis: isHebrew ? "Create Estimated Time To Dialysis Record" : "Create Estimated Time To Dialysis Record",
        createExcessiveGlucoseMonitoring: isHebrew ? "Create Excessive Glucose Monitoring Record" : "Create Excessive Glucose Monitoring Record",
        createExercisePrescription: isHebrew ? "Create Exercise Prescription Record" : "Create Exercise Prescription Record",
        createExerciseProgram: isHebrew ? "Create Exercise Program Record" : "Create Exercise Program Record",
        createExerciseRecommendation: isHebrew ? "Create Exercise Recommendation Record" : "Create Exercise Recommendation Record",
        createExerciseRecommendations: isHebrew ? "Create Exercise Recommendations Record" : "Create Exercise Recommendations Record",
        createExtendedFamilyHistory: isHebrew ? "Create Extended Family History Record" : "Create Extended Family History Record",
        createExtraintestinalManifestation: isHebrew ? "Create Extraintestinal Manifestation Record" : "Create Extraintestinal Manifestation Record",
        createExtraintestinalManifestations: isHebrew ? "Create Extraintestinal Manifestations Record" : "Create Extraintestinal Manifestations Record",
        createFacility: isHebrew ? "Create Facility Record" : "Create Facility Record",
        createFallPreventionEducation: isHebrew ? "Create Fall Prevention Education Record" : "Create Fall Prevention Education Record",
        createFallRiskAssessment: isHebrew ? "Fall Risk Evaluation" : "Fall Risk Evaluation",
        createFallRiskAssessments: isHebrew ? "Create Fall Risk Assessments Record" : "Create Fall Risk Assessments Record",
        createFallsPreventionProgramAssessment: isHebrew ? "Create Falls Prevention Program Assessment Record" : "Create Falls Prevention Program Assessment Record",
        createFamilyHistory: isHebrew ? "Create Family History Record" : "Create Family History Record",
        createFamilyMedicineAssessment: isHebrew ? "Create Family Medicine Assessment Record" : "Create Family Medicine Assessment Record",
        createFamilyMeetingDecision: isHebrew ? "Create Family Meeting Decision Record" : "Create Family Meeting Decision Record",
        createFamilyMeetingDecisions: isHebrew ? "Create Family Meeting Decisions Record" : "Create Family Meeting Decisions Record",
        createFamilyMeetingNote: isHebrew ? "Create Family Meeting Note Record" : "Create Family Meeting Note Record",
        createFamilyMeetingNotes: isHebrew ? "Create Family Meeting Notes Record" : "Create Family Meeting Notes Record",
        createFecalCalprotectin: isHebrew ? "Create Fecal Calprotectin Record" : "Create Fecal Calprotectin Record",
        createFertilityTracking: isHebrew ? "Create Fertility Tracking Record" : "Create Fertility Tracking Record",
        createFetalAssessment: isHebrew ? "Create Fetal Assessment Record" : "Create Fetal Assessment Record",
        createFetalEcho: isHebrew ? "Create Fetal Echo Record" : "Create Fetal Echo Record",
        createFetalEchoResult: isHebrew ? "Create Fetal Echo Result Record" : "Create Fetal Echo Result Record",
        createFetalEchoResults: isHebrew ? "Create Fetal Echo Results Record" : "Create Fetal Echo Results Record",
        createFetalSurveillance: isHebrew ? "Create Fetal Surveillance Record" : "Create Fetal Surveillance Record",
        createFetalUltrasound: isHebrew ? "Create Fetal Ultrasound Record" : "Create Fetal Ultrasound Record",
        createFirstTrimesterBleeding: isHebrew ? "Create First Trimester Bleeding Record" : "Create First Trimester Bleeding Record",
        createFirstTrimesterScreenResult: isHebrew ? "Create First Trimester Screen Result Record" : "Create First Trimester Screen Result Record",
        createFitnessForDutyEvaluation: isHebrew ? "Assess fitness readiness" : "Assess fitness readiness",
        createFitnessForDutyEvaluations: isHebrew ? "Create Fitness For Duty Evaluations Record" : "Create Fitness For Duty Evaluations Record",
        createFlareManagement: isHebrew ? "Create Flare Management Record" : "Create Flare Management Record",
        createFlowCytometryReport: isHebrew ? "Generate Flow Cytometry Report" : "Generate Flow Cytometry Report",
        createFlowCytometryReports: isHebrew ? "Create Flow Cytometry Reports Record" : "Create Flow Cytometry Reports Record",
        createFluidElectrolyteManagement: isHebrew ? "Create Fluid Electrolyte Management Record" : "Create Fluid Electrolyte Management Record",
        createFluidIntake: isHebrew ? "Create Fluid Intake Record" : "Create Fluid Intake Record",
        createFluidOutput: isHebrew ? "Create Fluid Output Record" : "Create Fluid Output Record",
        createFmlaDocumentationNote: isHebrew ? "Create Fmla Documentation Note Record" : "Create Fmla Documentation Note Record",
        createFollowUp: isHebrew ? "Create Follow Up Record" : "Create Follow Up Record",
        createFollowUpAppointment: isHebrew ? "Schedule follow-up visit" : "Schedule follow-up visit",
        createFollowUpAppointments: isHebrew ? "Create Follow Up Appointments Record" : "Create Follow Up Appointments Record",
        createFollowUpEnhanced: isHebrew ? "Create Follow Up Enhanced Record" : "Create Follow Up Enhanced Record",
        createFollowUpIntelligence: isHebrew ? "Enhance Follow-up Intelligence" : "Enhance Follow-up Intelligence",
        createFollowUpPlan: isHebrew ? "Create Follow Up Plan Record" : "Create Follow Up Plan Record",
        createFollowUps: isHebrew ? "Create Follow Ups Record" : "Create Follow Ups Record",
        createFoodInsecurity: isHebrew ? "Create Food Insecurity Record" : "Create Food Insecurity Record",
        createFootExam: isHebrew ? "Create Foot Exam Record" : "Create Foot Exam Record",
        createFrailtyAssessment: isHebrew ? "Create Frailty Assessment Record" : "Create Frailty Assessment Record",
        createFunctionalAssessment: isHebrew ? "Create Functional Assessment Record" : "Create Functional Assessment Record",
        createFunctionalAssessments: isHebrew ? "Create Functional Assessments Record" : "Create Functional Assessments Record",
        createFunctionalMriStudies: isHebrew ? "Create Functional Mri Studies Record" : "Create Functional Mri Studies Record",
        createFunctionalMriStudy: isHebrew ? "Generates Brain Imaging Study" : "Generates Brain Imaging Study",
        createFunctionalStatu: isHebrew ? "Create Functional Statu Record" : "Create Functional Statu Record",
        createFunctionalStatus: isHebrew ? "Create Functional Status Record" : "Create Functional Status Record",
        createGaitAnalysi: isHebrew ? "Create Gait Analysi Record" : "Create Gait Analysi Record",
        createGaitAnalysis: isHebrew ? "Create Gait Analysis Record" : "Create Gait Analysis Record",
        createGastroenterologyConsultation: isHebrew ? "Schedule Digestive Consultation" : "Schedule Digestive Consultation",
        createGastroenterologyConsultations: isHebrew ? "Create Gastroenterology Consultations Record" : "Create Gastroenterology Consultations Record",
        createGdmRecurrenceRisk: isHebrew ? "Create Gdm Recurrence Risk Record" : "Create Gdm Recurrence Risk Record",
        createGeneticOncology: isHebrew ? "Create Genetic Oncology Record" : "Create Genetic Oncology Record",
        createGeneticTestingReport: isHebrew ? "Genetic Test Summary" : "Genetic Test Summary",
        createGeneticsPsychosocialAssessment: isHebrew ? "Create Genetics Psychosocial Assessment Record" : "Create Genetics Psychosocial Assessment Record",
        createGeneticTestingReports: isHebrew ? "Create Genetic Testing Reports Record" : "Create Genetic Testing Reports Record",
        createGeriatricAssessment: isHebrew ? "Elderly Health Evaluation" : "Elderly Health Evaluation",
        createGeriatricAssessments: isHebrew ? "Create Geriatric Assessments Record" : "Create Geriatric Assessments Record",
        createGeriatricCognitiveAssessment: isHebrew ? "Create Geriatric Cognitive Assessment Record" : "Create Geriatric Cognitive Assessment Record",
        createGeriatricMedication: isHebrew ? "Create Geriatric Medication Record" : "Create Geriatric Medication Record",
        createGeriatricMedications: isHebrew ? "Create Geriatric Medications Record" : "Create Geriatric Medications Record",
        createGeriatricNutritionalAssessment: isHebrew ? "Create Geriatric Nutritional Assessment Record" : "Create Geriatric Nutritional Assessment Record",
        createGestationalDiabete: isHebrew ? "Create Gestational Diabete Record" : "Create Gestational Diabete Record",
        createGestationalDiabetes: isHebrew ? "Create Gestational Diabetes Record" : "Create Gestational Diabetes Record",
        createGiRiskAssessment: isHebrew ? "Assess GI Risk" : "Assess GI Risk",
        createGlasgowComaScale: isHebrew ? "Create Glasgow Coma Scale Record" : "Create Glasgow Coma Scale Record",
        createGlaucomaAssessment: isHebrew ? "Glaucoma Risk Evaluation" : "Glaucoma Risk Evaluation",
        createGlaucomaAssessments: isHebrew ? "Create Glaucoma Assessments Record" : "Create Glaucoma Assessments Record",
        createGlaucomaManagement: isHebrew ? "Create Glaucoma Management Record" : "Create Glaucoma Management Record",
        createGlomerularDisease: isHebrew ? "Create Glomerular Disease Record" : "Create Glomerular Disease Record",
        createGlucometerDownloadSchedule: isHebrew ? "Create Glucometer Download Schedule Record" : "Create Glucometer Download Schedule Record",
        createGlucoseMonitoringFrequency: isHebrew ? "Create Glucose Monitoring Frequency Record" : "Create Glucose Monitoring Frequency Record",
        createGlucoseMonitoringGoal: isHebrew ? "Create Glucose Monitoring Goal Record" : "Create Glucose Monitoring Goal Record",
        createGlucoseMonitoringGoals: isHebrew ? "Create Glucose Monitoring Goals Record" : "Create Glucose Monitoring Goals Record",
        createGlucoseTestingWeek: isHebrew ? "Create Glucose Testing Week Record" : "Create Glucose Testing Week Record",
        createGlucoseTestingWeeks: isHebrew ? "Create Glucose Testing Weeks Record" : "Create Glucose Testing Weeks Record",
        createGoalsOfCareDiscussion: isHebrew ? "Create Goals Of Care Discussion Record" : "Create Goals Of Care Discussion Record",
        createGoutAssessment: isHebrew ? "Create Gout Assessment Record" : "Create Gout Assessment Record",
        createGrowthParameter: isHebrew ? "Create Growth Parameter Record" : "Create Growth Parameter Record",
        createGrowthParameters: isHebrew ? "Create Growth Parameters Record" : "Create Growth Parameters Record",
        createGrowthUltrasoundSchedule: isHebrew ? "Create Growth Ultrasound Schedule Record" : "Create Growth Ultrasound Schedule Record",
        createGuidelineCompliance: isHebrew ? "Ensure Regulatory Adherence" : "Ensure Regulatory Adherence",
        createGynecologyConsultation: isHebrew ? "Schedule Gynecology Appointment" : "Schedule Gynecology Appointment",
        createGynecologyConsultations: isHebrew ? "Create Gynecology Consultations Record" : "Create Gynecology Consultations Record",
        createHeadacheAssessment: isHebrew ? "Create Headache Assessment Record" : "Create Headache Assessment Record",
        createHeader: isHebrew ? "Create Header Record" : "Create Header Record",
        createHeaders: isHebrew ? "Create Headers Record" : "Create Headers Record",
        createHealthCoachingNotes: isHebrew ? "Create Health Coaching Notes Record" : "Create Health Coaching Notes Record",
        createHealthMaintenance: isHebrew ? "צור רשומת תחזוקת בריאות" : "Create health maintenance record",
        createHeightMeasurement: isHebrew ? "Create Height Measurement Record" : "Create Height Measurement Record",
        createHeightMeasurements: isHebrew ? "Create Height Measurements Record" : "Create Height Measurements Record",
        createHematologyAssessment: isHebrew ? "Create Hematology Assessment Record" : "Create Hematology Assessment Record",
        createHematologyConsultation: isHebrew ? "Request hematology consultation" : "Request hematology consultation",
        createHematologyConsultations: isHebrew ? "Create Hematology Consultations Record" : "Create Hematology Consultations Record",
        createHepatitisCHistory: isHebrew ? "Create Hepatitis C History Record" : "Create Hepatitis C History Record",
        createHepatitisCManagement: isHebrew ? "Create Hepatitis C Management Record" : "Create Hepatitis C Management Record",
        createHistoryPresentIllness: isHebrew ? "Document patient's symptoms" : "Document patient's symptoms",
        createHivHistory: isHebrew ? "Create Hiv History Record" : "Create Hiv History Record",
        createHomeHealthNote: isHebrew ? "Document Patient Care" : "Document Patient Care",
        createHomeHealthNotes: isHebrew ? "Create Home Health Notes Record" : "Create Home Health Notes Record",
        createHomeHealthOrders: isHebrew ? "Create Home Health Orders Record" : "Create Home Health Orders Record",
        createHomeMonitoring: isHebrew ? "Create Home Monitoring Record" : "Create Home Monitoring Record",
        createHomeSafety: isHebrew ? "Create Home Safety Record" : "Create Home Safety Record",
        createHomicideRiskAssessment: isHebrew ? "Create Homicide Risk Assessment Record" : "Create Homicide Risk Assessment Record",
        createHormonePanel: isHebrew ? "Hormone Data Interface" : "Hormone Data Interface",
        createHormonePanels: isHebrew ? "Create Hormone Panels Record" : "Create Hormone Panels Record",
        createHormoneTherapyRecord: isHebrew ? "Create Hormone Therapy" : "Create Hormone Therapy",
        createHormoneTherapyRecords: isHebrew ? "Create Hormone Therapy Records Record" : "Create Hormone Therapy Records Record",
        createHospiceNote: isHebrew ? "Document patient care" : "Document patient care",
        createHospiceNotes: isHebrew ? "Create Hospice Notes Record" : "Create Hospice Notes Record",
        createHospitalAdmissionNote: isHebrew ? "Generate Hospital Admission Note" : "Generate Hospital Admission Note",
        createHospitalAdmissionNotes: isHebrew ? "Create Hospital Admission Notes Record" : "Create Hospital Admission Notes Record",
        createHospitalCourse: isHebrew ? "Create Hospital Course Record" : "Create Hospital Course Record",
        createHospitalDischargeSummaries: isHebrew ? "Create Hospital Discharge Summaries Record" : "Create Hospital Discharge Summaries Record",
        createHospitalDischargeSummary: isHebrew ? "Generate Hospital Discharge Summary" : "Generate Hospital Discharge Summary",
        createHospitalTransferNote: isHebrew ? "Hospital Transfer Summary" : "Hospital Transfer Summary",
        createHospitalTransferNotes: isHebrew ? "Create Hospital Transfer Notes Record" : "Create Hospital Transfer Notes Record",
        createHourlyVitalSign: isHebrew ? "Create Hourly Vital Sign Record" : "Create Hourly Vital Sign Record",
        createHourlyVitalSigns: isHebrew ? "Create Hourly Vital Signs Record" : "Create Hourly Vital Signs Record",
        createHydrationManagement: isHebrew ? "Create Hydration Management Record" : "Create Hydration Management Record",
        createHypertensiveNephropathy: isHebrew ? "Create Hypertensive Nephropathy Record" : "Create Hypertensive Nephropathy Record",
        createHypoglycemiaManagement: isHebrew ? "Create Hypoglycemia Management Record" : "Create Hypoglycemia Management Record",
        createHypoglycemiaProtocol: isHebrew ? "Create Hypoglycemia Protocol Record" : "Create Hypoglycemia Protocol Record",
        createIbdAssessment: isHebrew ? "Create Ibd Assessment Record" : "Create Ibd Assessment Record",
        createIbdBiomarker: isHebrew ? "Create Ibd Biomarker Record" : "Create Ibd Biomarker Record",
        createIbdBiomarkers: isHebrew ? "Create Ibd Biomarkers Record" : "Create Ibd Biomarkers Record",
        createIbdConsultationDetail: isHebrew ? "Create Ibd Consultation Detail Record" : "Create Ibd Consultation Detail Record",
        createIbdConsultationDetails: isHebrew ? "Create Ibd Consultation Details Record" : "Create Ibd Consultation Details Record",
        createIbdSurgicalPlanning: isHebrew ? "Create Ibd Surgical Planning Record" : "Create Ibd Surgical Planning Record",
        createIcuFlowSheet: isHebrew ? "Generate ICU flowsheet" : "Generate ICU flowsheet",
        createIcuFlowSheets: isHebrew ? "Create Icu Flow Sheets Record" : "Create Icu Flow Sheets Record",
        createImagingOrder: isHebrew ? "Request medical imaging" : "Request medical imaging",
        createImagingOrders: isHebrew ? "Create Imaging Orders Record" : "Create Imaging Orders Record",
        createImagingReport: isHebrew ? "Create Imaging Report Record" : "Create Imaging Report Record",
        createImagingReports: isHebrew ? "Generate Imaging Report" : "Generate Imaging Report",
        createImmediateIntervention: isHebrew ? "Create Immediate Intervention Record" : "Create Immediate Intervention Record",
        createImmediateInterventions: isHebrew ? "Create Immediate Interventions Record" : "Create Immediate Interventions Record",
        createImmediateRecommendation: isHebrew ? "Create Immediate Recommendation Record" : "Create Immediate Recommendation Record",
        createImmediateRecommendations: isHebrew ? "Create Immediate Recommendations Record" : "Create Immediate Recommendations Record",
        createImmuneFunctionTest: isHebrew ? "Create Immune Function Test Record" : "Create Immune Function Test Record",
        createImmuneFunctionTests: isHebrew ? "Create Immune Function Tests Record" : "Create Immune Function Tests Record",
        createImmuneReconstitutionPlanning: isHebrew ? "Create Immune Reconstitution Planning Record" : "Create Immune Reconstitution Planning Record",
        createImmunizationRecord: isHebrew ? "Create Immunization Record Record" : "Create Immunization Record Record",
        createImmunizationSchedule: isHebrew ? "Create Immunization Schedule Record" : "Create Immunization Schedule Record",
        createImmunizationStatu: isHebrew ? "Create Immunization Statu Record" : "Create Immunization Statu Record",
        createImmunizationStatus: isHebrew ? "Create Immunization Status Record" : "Create Immunization Status Record",
        createIndianDietExchangeList: isHebrew ? "Create Indian Diet Exchange List Record" : "Create Indian Diet Exchange List Record",
        createIndianDietExchangeLists: isHebrew ? "Create Indian Diet Exchange Lists Record" : "Create Indian Diet Exchange Lists Record",
        createInfectionControlRecords: isHebrew ? "Create Infection Control Records Record" : "Create Infection Control Records Record",
        createInfectionRiskMonitoring: isHebrew ? "Create Infection Risk Monitoring Record" : "Create Infection Risk Monitoring Record",
        createInfectionSurveillance: isHebrew ? "Create Infection Surveillance Record" : "Create Infection Surveillance Record",
        createInfectiousDiseaseAssessment: isHebrew ? "Create Infectious Disease Assessment Record" : "Create Infectious Disease Assessment Record",
        createInflammatoryBowelReport: isHebrew ? "Generate Bowel Disease Report" : "Generate Bowel Disease Report",
        createInflammatoryBowelReports: isHebrew ? "Create Inflammatory Bowel Reports Record" : "Create Inflammatory Bowel Reports Record",
        createInflammatoryMarker: isHebrew ? "Create Inflammatory Marker Record" : "Create Inflammatory Marker Record",
        createInflammatoryMarkers: isHebrew ? "Create Inflammatory Markers Record" : "Create Inflammatory Markers Record",
        createInfliximabDrugMonitoring: isHebrew ? "Create Infliximab Drug Monitoring Record" : "Create Infliximab Drug Monitoring Record",
        createInfusionTherapy: isHebrew ? "Create Infusion Therapy Record" : "Create Infusion Therapy Record",
        createInheritancePatternDetail: isHebrew ? "Create Inheritance Pattern Detail Record" : "Create Inheritance Pattern Detail Record",
        createInheritancePatternDetails: isHebrew ? "Create Inheritance Pattern Details Record" : "Create Inheritance Pattern Details Record",
        createInjuryDetail: isHebrew ? "Create Injury Detail Record" : "Create Injury Detail Record",
        createInjuryDetails: isHebrew ? "Create Injury Details Record" : "Create Injury Details Record",
        createInsomniaAssessment: isHebrew ? "Create Insomnia Assessment Record" : "Create Insomnia Assessment Record",
        createInsulinAdjustmentProtocol: isHebrew ? "Create Insulin Adjustment Protocol Record" : "Create Insulin Adjustment Protocol Record",
        createInsulinPumpSetting: isHebrew ? "Create Insulin Pump Setting Record" : "Create Insulin Pump Setting Record",
        createInsulinPumpSettings: isHebrew ? "Create Insulin Pump Settings Record" : "Create Insulin Pump Settings Record",
        createInsulinRegimen: isHebrew ? "Create Insulin Regimen Record" : "Create Insulin Regimen Record",
        createInsulinStorageInstruction: isHebrew ? "Create Insulin Storage Instruction Record" : "Create Insulin Storage Instruction Record",
        createInsulinStorageInstructions: isHebrew ? "Create Insulin Storage Instructions Record" : "Create Insulin Storage Instructions Record",
        createInsulinTimingInstruction: isHebrew ? "Create Insulin Timing Instruction Record" : "Create Insulin Timing Instruction Record",
        createInsulinTimingInstructions: isHebrew ? "Create Insulin Timing Instructions Record" : "Create Insulin Timing Instructions Record",
        createInsuranceAuthorization: isHebrew ? "צור אישור ביטוח" : "Create insurance authorization (coverage verification, copay assistance)",
        createInsuranceAuthorizations: isHebrew ? "Create Insurance Authorizations Record" : "Create Insurance Authorizations Record",
        createInsuranceForm: isHebrew ? "Generate Insurance Form" : "Generate Insurance Form",
        createInsuranceForms: isHebrew ? "Create Insurance Forms Record" : "Create Insurance Forms Record",
        createIntakeOutputRecord: isHebrew ? "Track patient fluids" : "Track patient fluids",
        createIntakeOutputRecords: isHebrew ? "Create Intake Output Records Record" : "Create Intake Output Records Record",
        createIntegrativeOncology: isHebrew ? "Create Integrative Oncology Record" : "Create Integrative Oncology Record",
        createIntelligentRecommendation: isHebrew ? "Smart content suggestion" : "Smart content suggestion",
        createIntelligentRecommendations: isHebrew ? "Create Intelligent Recommendations Record" : "Create Intelligent Recommendations Record",
        createInterPregnancyWeightManagement: isHebrew ? "Create Inter Pregnancy Weight Management Record" : "Create Inter Pregnancy Weight Management Record",
        createIntervalHistory: isHebrew ? "Create Interval History Record" : "Create Interval History Record",
        createInterventionalPainProcedures: isHebrew ? "Create Interventional Pain Procedures Record" : "Create Interventional Pain Procedures Record",
        createInterventionalRadiologyNote: isHebrew ? "Radiology Procedure Note" : "Radiology Procedure Note",
        createInterventionalRadiologyNotes: isHebrew ? "Create Interventional Radiology Notes Record" : "Create Interventional Radiology Notes Record",
        createIntradialyticMonitoring: isHebrew ? "Create Intradialytic Monitoring Record" : "Create Intradialytic Monitoring Record",
        createIntraoperativeCholangiography: isHebrew ? "Create Intraoperative Cholangiography Record" : "Create Intraoperative Cholangiography Record",
        createIntraoperativeFinding: isHebrew ? "Create Intraoperative Finding Record" : "Create Intraoperative Finding Record",
        createIntraoperativeFindings: isHebrew ? "Create Intraoperative Findings Record" : "Create Intraoperative Findings Record",
        createIntraoperativeImaging: isHebrew ? "Create Intraoperative Imaging Record" : "Create Intraoperative Imaging Record",
        createIntraoperativeMonitoring: isHebrew ? "Create Intraoperative Monitoring Record" : "Create Intraoperative Monitoring Record",
        createIsolationPrecautions: isHebrew ? "Create Isolation Precautions Record" : "Create Isolation Precautions Record",
        createIvInfusion: isHebrew ? "Create Iv Infusion Record" : "Create Iv Infusion Record",
        createIvInfusions: isHebrew ? "Create Iv Infusions Record" : "Create Iv Infusions Record",
        createJobHazardAnalysis: isHebrew ? "Create Job Hazard Analysis Record" : "Create Job Hazard Analysis Record",
        createKetoneMonitoringInstruction: isHebrew ? "Create Ketone Monitoring Instruction Record" : "Create Ketone Monitoring Instruction Record",
        createKetoneMonitoringInstructions: isHebrew ? "Create Ketone Monitoring Instructions Record" : "Create Ketone Monitoring Instructions Record",
        createKidneyDiseaseProgressionTimeline: isHebrew ? "Create Kidney Disease Progression Timeline Record" : "Create Kidney Disease Progression Timeline Record",
        createKidneyFunctionReport: isHebrew ? "Assess Kidney Health" : "Assess Kidney Health",
        createKidneyFunctionReports: isHebrew ? "Create Kidney Function Reports Record" : "Create Kidney Function Reports Record",
        createLaborDeliveryRecords: isHebrew ? "Create Labor Delivery Records Record" : "Create Labor Delivery Records Record",
        createLabOrder: isHebrew ? "Generate Lab Order" : "Generate Lab Order",
        createLabOrders: isHebrew ? "Create Lab Orders Record" : "Create Lab Orders Record",
        createLabResult: isHebrew ? "Create Lab Result Record" : "Create Lab Result Record",
        createLabResults: isHebrew ? "Generate Lab Result" : "Generate Lab Result",
        createLabSchedule: isHebrew ? "Create Lab Schedule Record" : "Create Lab Schedule Record",
        createLaborDeliveryRecord: isHebrew ? "Create Labor Record" : "Create Labor Record",
        createLaboratoryResult: isHebrew ? "Create Laboratory Result Record" : "Create Laboratory Result Record",
        createLaryngoscopyReport: isHebrew ? "Generate Laryngoscopy Report" : "Generate Laryngoscopy Report",
        createLaryngoscopyReports: isHebrew ? "Create Laryngoscopy Reports Record" : "Create Laryngoscopy Reports Record",
        createLifestyleAssessment: isHebrew ? "Create Lifestyle Assessment Record" : "Create Lifestyle Assessment Record",
        createLifestyleAssessments: isHebrew ? "Create Lifestyle Assessments Record" : "Create Lifestyle Assessments Record",
        createLifestyleCounseling: isHebrew ? "Create Lifestyle Counseling Record" : "Create Lifestyle Counseling Record",
        createLifestyleRiskAssessment: isHebrew ? "Create Lifestyle Risk Assessment Record" : "Create Lifestyle Risk Assessment Record",
        createLigamentReconstruction: isHebrew ? "Create Ligament Reconstruction Record" : "Create Ligament Reconstruction Record",
        createLiverFunctionAssessment: isHebrew ? "Assess Liver Health" : "Assess Liver Health",
        createLiverFunctionAssessments: isHebrew ? "Create Liver Function Assessments Record" : "Create Liver Function Assessments Record",
        createLupusAssessment: isHebrew ? "Create Lupus Assessment Record" : "Create Lupus Assessment Record",
        createLymphNodeCytomorphology: isHebrew ? "Create Lymph Node Cytomorphology Record" : "Create Lymph Node Cytomorphology Record",
        createMacrosomiaThreshold: isHebrew ? "Create Macrosomia Threshold Record" : "Create Macrosomia Threshold Record",
        createMalnutritionRiskAssessment: isHebrew ? "Create Malnutrition Risk Assessment Record" : "Create Malnutrition Risk Assessment Record",
        createMammographyReport: isHebrew ? "Generate Mammography Report" : "Generate Mammography Report",
        createMammographyReports: isHebrew ? "Create Mammography Reports Record" : "Create Mammography Reports Record",
        createMaternalFetalReport: isHebrew ? "Generate Maternal-Fetal Report" : "Generate Maternal-Fetal Report",
        createMaternalFetalReports: isHebrew ? "Create Maternal Fetal Reports Record" : "Create Maternal Fetal Reports Record",
        createMaternalLab: isHebrew ? "Create Maternal Lab Record" : "Create Maternal Lab Record",
        createMaternalLabs: isHebrew ? "Create Maternal Labs Record" : "Create Maternal Labs Record",
        createMaternalWeightMonitoring: isHebrew ? "Create Maternal Weight Monitoring Record" : "Create Maternal Weight Monitoring Record",
        createMayoScore: isHebrew ? "Create Mayo Score Record" : "Create Mayo Score Record",
        createMechanismOfInjury: isHebrew ? "Create Mechanism Of Injury Record" : "Create Mechanism Of Injury Record",
        createMedicalAlert: isHebrew ? "Create Medical Alert Record" : "Create Medical Alert Record",
        createMedicalAlerts: isHebrew ? "Create Medical Alerts Record" : "Create Medical Alerts Record",
        createMedicalCertificate: isHebrew ? "Generate Medical Certificate" : "Generate Medical Certificate",
        createMedicalCertificates: isHebrew ? "Create Medical Certificates Record" : "Create Medical Certificates Record",
        createMedicalGeneticist: isHebrew ? "Create Medical Geneticist Record" : "Create Medical Geneticist Record",
        createMedicalHistory: isHebrew ? "Track patient records" : "Track patient records",
        createMedicalPowerOfAttorney: isHebrew ? "Authorize Medical Decisions" : "Authorize Medical Decisions",
        createMedicalProcedure: isHebrew ? "Create Medical Record" : "Create Medical Record",
        createMedicalProcedures: isHebrew ? "Create Medical Procedures Record" : "Create Medical Procedures Record",
        createMedicalReconciliationForm: isHebrew ? "Generate Medical Reconciliation Form" : "Generate Medical Reconciliation Form",
        createMedicalReconciliationForms: isHebrew ? "Create Medical Reconciliation Forms Record" : "Create Medical Reconciliation Forms Record",
        createMedication: isHebrew ? "Create medication record" : "Create medication record",
        createMedicationAccessProgram: isHebrew ? "Create Medication Access Program Record" : "Create Medication Access Program Record",
        createMedicationAccessPrograms: isHebrew ? "Create Medication Access Programs Record" : "Create Medication Access Programs Record",
        createMedicationAdministrationRecord: isHebrew ? "Track medication administration" : "Track medication administration",
        createMedicationAdministrationRecords: isHebrew ? "Create Medication Administration Records Record" : "Create Medication Administration Records Record",
        createMedicationChangesDiscontinued: isHebrew ? "Create Medication Changes Discontinued Record" : "Create Medication Changes Discontinued Record",
        createMedicationChangesDose: isHebrew ? "Create Medication Changes Dose Record" : "Create Medication Changes Dose Record",
        createMedicationChangesNew: isHebrew ? "Create Medication Changes New Record" : "Create Medication Changes New Record",
        createMedicationDeprescribing: isHebrew ? "Create Medication Deprescribing Record" : "Create Medication Deprescribing Record",
        createMedicationOptimization: isHebrew ? "Medication Efficiency Planner" : "Medication Efficiency Planner",
        createMedicationRecommendation: isHebrew ? "Create Medication Recommendation Record" : "Create Medication Recommendation Record",
        createMedicationRecommendations: isHebrew ? "Create medication recommendation" : "Create medication recommendation",
        createMedicationReconciliation: isHebrew ? "Create Medication Reconciliation Record" : "Create Medication Reconciliation Record",
        createMedicationRenalDosing: isHebrew ? "Create Medication Renal Dosing Record" : "Create Medication Renal Dosing Record",
        createMedications: isHebrew ? "Create Medications Record" : "Create Medications Record",
        createMedicationSafety: isHebrew ? "Create medication safety record" : "Create medication safety record",
        createMedicationSafetyAlert: isHebrew ? "Create Medication Safety Alert Record" : "Create Medication Safety Alert Record",
        createMedicationsAdministered: isHebrew ? "Create Medications Administered Record" : "Create Medications Administered Record",
        createMedicationSafetyAlerts: isHebrew ? "Create Medication Safety Alerts Record" : "Create Medication Safety Alerts Record",
        createMeniscusRepair: isHebrew ? "Create Meniscus Repair Record" : "Create Meniscus Repair Record",
        createMentalHealthAssessment: isHebrew ? "Mental Health Evaluation" : "Mental Health Evaluation",
        createMentalHealthAssessments: isHebrew ? "Create Mental Health Assessments Record" : "Create Mental Health Assessments Record",
        createMentalHealthResource: isHebrew ? "Create Mental Health Resource Record" : "Create Mental Health Resource Record",
        createMentalHealthResources: isHebrew ? "Create Mental Health Resources Record" : "Create Mental Health Resources Record",
        createMentalStatusExam: isHebrew ? "Assess Patient Cognition" : "Assess Patient Cognition",
        createMentalStatusExams: isHebrew ? "Create Mental Status Exams Record" : "Create Mental Status Exams Record",
        createMicrobiologyCultureReport: isHebrew ? "Generate Microbiology Culture Report" : "Generate Microbiology Culture Report",
        createMicrobiologyCultureReports: isHebrew ? "Create Microbiology Culture Reports Record" : "Create Microbiology Culture Reports Record",
        createMineralBoneDisease: isHebrew ? "Create Mineral Bone Disease Record" : "Create Mineral Bone Disease Record",
        createMonitoringPlan: isHebrew ? "Create Monitoring Plan Record" : "Create Monitoring Plan Record",
        createMonitoringPlans: isHebrew ? "Create Monitoring Plans Record" : "Create Monitoring Plans Record",
        createMonitoringReport: isHebrew ? "Generate Monitoring Report" : "Generate Monitoring Report",
        createMonitoringReports: isHebrew ? "Create Monitoring Reports Record" : "Create Monitoring Reports Record",
        createMoodPsychologicalAssessment: isHebrew ? "Create Mood Psychological Assessment Record" : "Create Mood Psychological Assessment Record",
        createMortalityRiskAssessment: isHebrew ? "Create Mortality Risk Assessment Record" : "Create Mortality Risk Assessment Record",
        createMotorComplication: isHebrew ? "Create Motor Complication Record" : "Create Motor Complication Record",
        createMotorComplications: isHebrew ? "Create Motor Complications Record" : "Create Motor Complications Record",
        createMovementDisorderAssessment: isHebrew ? "Create Movement Disorder Assessment Record" : "Create Movement Disorder Assessment Record",
        createMriReport: isHebrew ? "Generate MRI Report" : "Generate MRI Report",
        createMriReports: isHebrew ? "Create Mri Reports Record" : "Create Mri Reports Record",
        createMultimodalPainTherapy: isHebrew ? "Create Multimodal Pain Therapy Record" : "Create Multimodal Pain Therapy Record",
        createMultipleSclerosisAssessment: isHebrew ? "Create Multiple Sclerosis Assessment Record" : "Create Multiple Sclerosis Assessment Record",
        createMyelomaSpecificData: isHebrew ? "Create Myeloma Specific Data Record" : "Create Myeloma Specific Data Record",
        createMyositisAssessment: isHebrew ? "Create Myositis Assessment Record" : "Create Myositis Assessment Record",
        createNarcolepsyAssessment: isHebrew ? "Create Narcolepsy Assessment Record" : "Create Narcolepsy Assessment Record",
        createNephrologyConsultation: isHebrew ? "Request kidney evaluation" : "Request kidney evaluation",
        createNephrologyConsultationDetail: isHebrew ? "Create Nephrology Consultation Detail Record" : "Create Nephrology Consultation Detail Record",
        createNephrologyConsultationDetails: isHebrew ? "Create Nephrology Consultation Details Record" : "Create Nephrology Consultation Details Record",
        createNephrologyConsultations: isHebrew ? "Create Nephrology Consultations Record" : "Create Nephrology Consultations Record",
        createNeuroImaging: isHebrew ? "Create Neuro Imaging Record" : "Create Neuro Imaging Record",
        createNeurologicalAssessment: isHebrew ? "Create Neurological Assessment Record" : "Create Neurological Assessment Record",
        createNeurologicalExam: isHebrew ? "Create Neurological Exam Record" : "Create Neurological Exam Record",
        createNeurologicalExamination: isHebrew ? "Create Neurological Examination Record" : "Create Neurological Examination Record",
        createNeurologicalFinding: isHebrew ? "Create Neurological Finding Record" : "Create Neurological Finding Record",
        createNeurologicalFindings: isHebrew ? "Create Neurological Findings Record" : "Create Neurological Findings Record",
        createNeurologyConsultation: isHebrew ? "Request neurological evaluation" : "Request neurological evaluation",
        createNeurologyConsultations: isHebrew ? "Create Neurology Consultations Record" : "Create Neurology Consultations Record",
        createNeurologyProgressNote: isHebrew ? "Document Patient Neurological Assessment" : "Document Patient Neurological Assessment",
        createNeurologyProgressNotes: isHebrew ? "Create Neurology Progress Notes Record" : "Create Neurology Progress Notes Record",
        createNeuromuscularDisorder: isHebrew ? "Create Neuromuscular Disorder Record" : "Create Neuromuscular Disorder Record",
        createNeuropsychologicalAssessments: isHebrew ? "Create Neuropsychological Assessments Record" : "Create Neuropsychological Assessments Record",
        createNeuropsychTesting: isHebrew ? "Create Neuropsych Testing Record" : "Create Neuropsych Testing Record",
        createNeuropsychologicalAssessment: isHebrew ? "Assess Cognitive Function" : "Assess Cognitive Function",
        createNeurosurgeryAssessment: isHebrew ? "Create Neurosurgery Assessment Record" : "Create Neurosurgery Assessment Record",
        createNeurosurgeryConsultation: isHebrew ? "Request Neurosurgical Evaluation" : "Request Neurosurgical Evaluation",
        createNeurosurgeryConsultations: isHebrew ? "Create Neurosurgery Consultations Record" : "Create Neurosurgery Consultations Record",
        createNeurovascularExam: isHebrew ? "Create Neurovascular Exam Record" : "Create Neurovascular Exam Record",
        createNewbornScreeningResult: isHebrew ? "Record newborn screening" : "Record newborn screening",
        createNewbornScreeningResults: isHebrew ? "Create Newborn Screening Results Record" : "Create Newborn Screening Results Record",
        createNicuProgressNote: isHebrew ? "Document NICU Patient Progress" : "Document NICU Patient Progress",
        createNicuProgressNotes: isHebrew ? "Create Nicu Progress Notes Record" : "Create Nicu Progress Notes Record",
        createNonMotorSymptom: isHebrew ? "Create Non Motor Symptom Record" : "Create Non Motor Symptom Record",
        createNonMotorSymptoms: isHebrew ? "Create Non Motor Symptoms Record" : "Create Non Motor Symptoms Record",
        createNtScanResult: isHebrew ? "Create Nt Scan Result Record" : "Create Nt Scan Result Record",
        createNuclearMedicineAssessment: isHebrew ? "Create Nuclear Medicine Assessment Record" : "Create Nuclear Medicine Assessment Record",
        createNuclearMedicineStudies: isHebrew ? "Create Nuclear Medicine Studies Record" : "Create Nuclear Medicine Studies Record",
        createNuclearMedicineStudy: isHebrew ? "Create Nuclear Medicine Study Record" : "Create Nuclear Medicine Study Record",
        createNurseSignature: isHebrew ? "Create Nurse Signature Record" : "Create Nurse Signature Record",
        createNurseSignatures: isHebrew ? "Create Nurse Signatures Record" : "Create Nurse Signatures Record",
        createNursingAssessment: isHebrew ? "Nursing Assessment Creation" : "Nursing Assessment Creation",
        createNursingAssessments: isHebrew ? "Create Nursing Assessments Record" : "Create Nursing Assessments Record",
        createNursingNote: isHebrew ? "Document Patient Care" : "Document Patient Care",
        createNursingNotes: isHebrew ? "Create Nursing Notes Record" : "Create Nursing Notes Record",
        createNutritionalStatus: isHebrew ? "Create Nutritional Status Record" : "Create Nutritional Status Record",
        createNutritionAssessment: isHebrew ? "Assess patient nutrition" : "Assess patient nutrition",
        createNutritionalAssessment: isHebrew ? "Create Nutritional Assessment Record" : "Create Nutritional Assessment Record",
        createNutritionalStatu: isHebrew ? "Create Nutritional Statu Record" : "Create Nutritional Statu Record",
        createNutritionalSupplementation: isHebrew ? "Create Nutritional Supplementation Record" : "Create Nutritional Supplementation Record",
        createNutritionalSupport: isHebrew ? "Create Nutritional Support Record" : "Create Nutritional Support Record",
        createNutritionAssessments: isHebrew ? "Create Nutrition Assessments Record" : "Create Nutrition Assessments Record",
        createObstetricHistory: isHebrew ? "Create Obstetric History Record" : "Create Obstetric History Record",
        createObstetricUltrasoundReport: isHebrew ? "Generate Obstetric Ultrasound Report" : "Generate Obstetric Ultrasound Report",
        createObstetricUltrasoundReports: isHebrew ? "Create Obstetric Ultrasound Reports Record" : "Create Obstetric Ultrasound Reports Record",
        createOccupationalExposureRecords: isHebrew ? "Create Occupational Exposure Records Record" : "Create Occupational Exposure Records Record",
        createOccupationalHealthAssessment: isHebrew ? "Create Occupational Health Assessment Record" : "Create Occupational Health Assessment Record",
        createOccupationalMedicineEvaluation: isHebrew ? "Create Occupational Medicine Evaluation Record" : "Create Occupational Medicine Evaluation Record",
        createOccupationalMedicineEvaluations: isHebrew ? "Create Occupational Medicine Evaluations Record" : "Create Occupational Medicine Evaluations Record",
        createOccupationalTherapyReport: isHebrew ? "Generate Therapy Assessment" : "Generate Therapy Assessment",
        createOccupationalTherapyReports: isHebrew ? "Create Occupational Therapy Reports Record" : "Create Occupational Therapy Reports Record",
        createOmissionsRefusal: isHebrew ? "Create Omissions Refusal Record" : "Create Omissions Refusal Record",
        createOmissionsRefusals: isHebrew ? "Create Omissions Refusals Record" : "Create Omissions Refusals Record",
        createOncologicEmergencies: isHebrew ? "Create Oncologic Emergencies Record" : "Create Oncologic Emergencies Record",
        createOncologicEmergency: isHebrew ? "Create Oncologic Emergency Record" : "Create Oncologic Emergency Record",
        createOncologyConsultation: isHebrew ? "Schedule Cancer Consultation" : "Schedule Cancer Consultation",
        createOncologyConsultations: isHebrew ? "Create Oncology Consultations Record" : "Create Oncology Consultations Record",
        createOncologyFollowupReport: isHebrew ? "Generate Oncology Followup Report" : "Generate Oncology Followup Report",
        createOncologyFollowupReports: isHebrew ? "Create Oncology Followup Reports Record" : "Create Oncology Followup Reports Record",
        createOncologyTeam: isHebrew ? "Create Oncology Team Record" : "Create Oncology Team Record",
        createOncologyTreatmentPlan: isHebrew ? "Design Cancer Treatment" : "Design Cancer Treatment",
        createOncologyTreatmentPlans: isHebrew ? "Create Oncology Treatment Plans Record" : "Create Oncology Treatment Plans Record",
        createOperativeDetail: isHebrew ? "Create Operative Detail Record" : "Create Operative Detail Record",
        createOperativeDetails: isHebrew ? "Create Operative Details Record" : "Create Operative Details Record",
        createOperativeReport: isHebrew ? "Generate Operative Report" : "Generate Operative Report",
        createOperativeReportDetail: isHebrew ? "Create Operative Report Detail Record" : "Create Operative Report Detail Record",
        createOperativeReportDetails: isHebrew ? "Create Operative Report Details Record" : "Create Operative Report Details Record",
        createOperativeReports: isHebrew ? "Create Operative Reports Record" : "Create Operative Reports Record",
        createOperativeTechnique: isHebrew ? "Create Operative Technique Record" : "Create Operative Technique Record",
        createOperativeTime: isHebrew ? "Create Operative Time Record" : "Create Operative Time Record",
        createOphthalmologyExam: isHebrew ? "Create Ophthalmology Exam Record" : "Create Ophthalmology Exam Record",
        createOphthalmologyExamination: isHebrew ? "Create Eye Exam" : "Create Eye Exam",
        createOphthalmologyExaminations: isHebrew ? "Create Ophthalmology Examinations Record" : "Create Ophthalmology Examinations Record",
        createOpioidRiskAssessment: isHebrew ? "Create Opioid Risk Assessment Record" : "Create Opioid Risk Assessment Record",
        createOpportunisticInfections: isHebrew ? "Create Opportunistic Infections Record" : "Create Opportunistic Infections Record",
        createOptimizationStat: isHebrew ? "Create Optimization Stat Record" : "Create Optimization Stat Record",
        createOptimizationStats: isHebrew ? "Create Optimization Stats Record" : "Create Optimization Stats Record",
        createOralSurgeryReport: isHebrew ? "Generate Oral Surgery Report" : "Generate Oral Surgery Report",
        createOralSurgeryReports: isHebrew ? "Create Oral Surgery Reports Record" : "Create Oral Surgery Reports Record",
        createOrthodonticTreatmentPlan: isHebrew ? "Design Dental Treatment" : "Design Dental Treatment",
        createOrthodonticTreatmentPlans: isHebrew ? "Create Orthodontic Treatment Plans Record" : "Create Orthodontic Treatment Plans Record",
        createOrthopedicAssessment: isHebrew ? "Create Orthopedic Assessment Record" : "Create Orthopedic Assessment Record",
        createOrthopedicConsultation: isHebrew ? "Schedule Bone Consultation" : "Schedule Bone Consultation",
        createOrthopedicConsultations: isHebrew ? "Create Orthopedic Consultations Record" : "Create Orthopedic Consultations Record",
        createOrthopedicFollowupNote: isHebrew ? "Orthopedic Patient Follow-up" : "Orthopedic Patient Follow-up",
        createOrthopedicFollowupNotes: isHebrew ? "Create Orthopedic Followup Notes Record" : "Create Orthopedic Followup Notes Record",
        createOrthopedicImaging: isHebrew ? "Create Orthopedic Imaging Record" : "Create Orthopedic Imaging Record",
        createOrthopedicOperativeReport: isHebrew ? "Generate Orthopedic Surgery Report" : "Generate Orthopedic Surgery Report",
        createOrthopedicOperativeReports: isHebrew ? "Create Orthopedic Operative Reports Record" : "Create Orthopedic Operative Reports Record",
        createOrthopedicProcedure: isHebrew ? "Create Orthopedic Procedure Record" : "Create Orthopedic Procedure Record",
        createOrthopedicProcedures: isHebrew ? "Create Orthopedic Procedures Record" : "Create Orthopedic Procedures Record",
        createOutcomesPrediction: isHebrew ? "Forecast Potential Outcomes" : "Forecast Potential Outcomes",
        createOvertrainingAssessment: isHebrew ? "Create Overtraining Assessment Record" : "Create Overtraining Assessment Record",
        createPainAssessmentForm: isHebrew ? "Pain Assessment Form" : "Pain Assessment Form",
        createPainAssessmentForms: isHebrew ? "Create Pain Assessment Forms Record" : "Create Pain Assessment Forms Record",
        createPainFunctionalAssessment: isHebrew ? "Create Pain Functional Assessment Record" : "Create Pain Functional Assessment Record",
        createPainManagement: isHebrew ? "Create Pain Management Record" : "Create Pain Management Record",
        createPainManagementNote: isHebrew ? "Document patient pain" : "Document patient pain",
        createPainManagementNotes: isHebrew ? "Create Pain Management Notes Record" : "Create Pain Management Notes Record",
        createPainManagementPlan: isHebrew ? "Create Pain Management Plan Record" : "Create Pain Management Plan Record",
        createPainMedicationAgreements: isHebrew ? "Create Pain Medication Agreements Record" : "Create Pain Medication Agreements Record",
        createPalliativeCare: isHebrew ? "Create Palliative Care Record" : "Create Palliative Care Record",
        createPalliativeCareNeed: isHebrew ? "Create Palliative Care Need Record" : "Create Palliative Care Need Record",
        createPalliativeCareNeeds: isHebrew ? "Create Palliative Care Needs Record" : "Create Palliative Care Needs Record",
        createParentalConcern: isHebrew ? "Create Parental Concern Record" : "Create Parental Concern Record",
        createParentalConcerns: isHebrew ? "Create Parental Concerns Record" : "Create Parental Concerns Record",
        createParkinsonianFeatures: isHebrew ? "Create Parkinsonian Features Record" : "Create Parkinsonian Features Record",
        createParkinsonMedication: isHebrew ? "Create Parkinson Medication Record" : "Create Parkinson Medication Record",
        createParkinsonianFeature: isHebrew ? "Create Parkinsonian Feature Record" : "Create Parkinsonian Feature Record",
        createParkinsonMedications: isHebrew ? "Create Parkinson Medications Record" : "Create Parkinson Medications Record",
        createPartnerInvolvement: isHebrew ? "Create Partner Involvement Record" : "Create Partner Involvement Record",
        createPartnerInvolvementDiabetesManagement: isHebrew ? "Create Partner Involvement Diabetes Management Record" : "Create Partner Involvement Diabetes Management Record",
        createPastMedicalHistory: isHebrew ? "צור רשומת היסטוריה רפואית קודמת" : "Create Past Medical History Record",
        createPastOcularHistory: isHebrew ? "Create Past Ocular History Record" : "Create Past Ocular History Record",
        createPathologyGrossDescription: isHebrew ? "Create Pathology Gross Description Record" : "Create Pathology Gross Description Record",
        createPathologyReport: isHebrew ? "Generate Pathology Report" : "Generate Pathology Report",
        createPathologyReports: isHebrew ? "Create Pathology Reports Record" : "Create Pathology Reports Record",
        createPatientCareGoals: isHebrew ? "Create Patient Care Goals Record" : "Create Patient Care Goals Record",
        createPatientEducationContext: isHebrew ? "Patient Education Setup" : "Patient Education Setup",
        createPatientEducationRecord: isHebrew ? "Create Patient Record" : "Create Patient Record",
        createPatientEducationRecords: isHebrew ? "Create Patient Education Records Record" : "Create Patient Education Records Record",
        createPatientEmotionalResponse: isHebrew ? "Create Patient Emotional Response Record" : "Create Patient Emotional Response Record",
        createPatientInstruction: isHebrew ? "Create Patient Instruction Record" : "Create Patient Instruction Record",
        createPatientInstructions: isHebrew ? "Create Patient Instructions Record" : "Create Patient Instructions Record",
        createPatientPositioning: isHebrew ? "Create Patient Positioning Record" : "Create Patient Positioning Record",
        createPatientProvider: isHebrew ? "Create Patient Provider Record" : "Create Patient Provider Record",
        createPatientSpecificCarePlan: isHebrew ? "Personalized Patient Care" : "Personalized Patient Care",
        createPediatricGrowthChart: isHebrew ? "Track child growth" : "Track child growth",
        createPediatricGrowthCharts: isHebrew ? "Create Pediatric Growth Charts Record" : "Create Pediatric Growth Charts Record",
        createPediatricScreening: isHebrew ? "Create Pediatric Screening Record" : "Create Pediatric Screening Record",
        createPediatricVaccinationRecord: isHebrew ? "Track Child Immunizations" : "Track Child Immunizations",
        createPediatricVaccinationRecords: isHebrew ? "Create Pediatric Vaccination Records Record" : "Create Pediatric Vaccination Records Record",
        createPediatricVisit: isHebrew ? "Schedule Child Checkup" : "Schedule Child Checkup",
        createPediatricVisits: isHebrew ? "Create Pediatric Visits Record" : "Create Pediatric Visits Record",
        createPerformanceAssessment: isHebrew ? "Create Performance Assessment Record" : "Create Performance Assessment Record",
        createPerformanceStatu: isHebrew ? "Create Performance Statu Record" : "Create Performance Statu Record",
        createPerformanceStatus: isHebrew ? "Create Performance Status Record" : "Create Performance Status Record",
        createPerinatalMentalHealthReferral: isHebrew ? "Create Perinatal Mental Health Referral Record" : "Create Perinatal Mental Health Referral Record",
        createPeriodontalChart: isHebrew ? "Dental Examination Record" : "Dental Examination Record",
        createPeriodontalCharts: isHebrew ? "Create Periodontal Charts Record" : "Create Periodontal Charts Record",
        createPeripheralNeuropathy: isHebrew ? "Create Peripheral Neuropathy Record" : "Create Peripheral Neuropathy Record",
        createPetScanReport: isHebrew ? "Generate Pet Scan Report" : "Generate Pet Scan Report",
        createPetScanReports: isHebrew ? "Create Pet Scan Reports Record" : "Create Pet Scan Reports Record",
        createPharmacyReview: isHebrew ? "Create Pharmacy Review Record" : "Create Pharmacy Review Record",
        createPhysicalExamination: isHebrew ? "Create Physical Examination Record" : "Create Physical Examination Record",
        createPhysicalExaminations: isHebrew ? "Create Physical Examinations Record" : "Create Physical Examinations Record",
        createPhysicalTherapyEvaluation: isHebrew ? "Physical Therapy Assessment" : "Physical Therapy Assessment",
        createPhysicalTherapyEvaluations: isHebrew ? "Create Physical Therapy Evaluations Record" : "Create Physical Therapy Evaluations Record",
        createPhysicalTherapyNote: isHebrew ? "Physical Therapy Documentation" : "Physical Therapy Documentation",
        createPhysicalTherapyNotes: isHebrew ? "Create Physical Therapy Notes Record" : "Create Physical Therapy Notes Record",
        createPlasticSurgeryAssessment: isHebrew ? "Create Plastic Surgery Assessment Record" : "Create Plastic Surgery Assessment Record",
        createPlasticSurgeryConsultation: isHebrew ? "Schedule cosmetic consultation" : "Schedule cosmetic consultation",
        createPlasticSurgeryConsultations: isHebrew ? "Create Plastic Surgery Consultations Record" : "Create Plastic Surgery Consultations Record",
        createPmrAssessment: isHebrew ? "Create Pmr Assessment Record" : "Create Pmr Assessment Record",
        createPneumoperitoneum: isHebrew ? "Create Pneumoperitoneum Record" : "Create Pneumoperitoneum Record",
        createPodiatryExamination: isHebrew ? "Create Podiatry Examination Record" : "Create Podiatry Examination Record",
        createPodiatryExaminations: isHebrew ? "Create Podiatry Examinations Record" : "Create Podiatry Examinations Record",
        createPointOfCareUltrasoundHeartRate: isHebrew ? "Create Point Of Care Ultrasound Heart Rate Record" : "Create Point Of Care Ultrasound Heart Rate Record",
        createPoisonControlReport: isHebrew ? "Generate Poison Control Report" : "Generate Poison Control Report",
        createPoisonControlReports: isHebrew ? "Create Poison Control Reports Record" : "Create Poison Control Reports Record",
        createPolycysticKidneyDisease: isHebrew ? "Create Polycystic Kidney Disease Record" : "Create Polycystic Kidney Disease Record",
        createPolypharmacy: isHebrew ? "Create Polypharmacy Record" : "Create Polypharmacy Record",
        createPolypharmacyReview: isHebrew ? "Medication Safety Assessment" : "Medication Safety Assessment",
        createPolypharmacyReviews: isHebrew ? "Create Polypharmacy Reviews Record" : "Create Polypharmacy Reviews Record",
        createPortPlacement: isHebrew ? "Create Port Placement Record" : "Create Port Placement Record",
        createPostDialysisAssessment: isHebrew ? "Create Post Dialysis Assessment Record" : "Create Post Dialysis Assessment Record",
        createPostoperativeOrders: isHebrew ? "Create Postoperative Orders Record" : "Create Postoperative Orders Record",
        createPostoperativePainManagement: isHebrew ? "Create Postoperative Pain Management Record" : "Create Postoperative Pain Management Record",
        createPostOperativeReports: isHebrew ? "Create Post Operative Reports Record" : "Create Post Operative Reports Record",
        createPostOpTesting: isHebrew ? "Create Post Op Testing Record" : "Create Post Op Testing Record",
        createPostOperativeReport: isHebrew ? "Generate Patient Surgical Summary" : "Generate Patient Surgical Summary",
        createPostopTesting: isHebrew ? "Create Postop Testing Record" : "Create Postop Testing Record",
        createPostoperativeCondition: isHebrew ? "Create Postoperative Condition Record" : "Create Postoperative Condition Record",
        createPostoperativeOrder: isHebrew ? "Create Postoperative Order Record" : "Create Postoperative Order Record",
        createPostpartumDiabetesRisk: isHebrew ? "Create Postpartum Diabetes Risk Record" : "Create Postpartum Diabetes Risk Record",
        createPostpartumGlucoseMonitoring: isHebrew ? "Create Postpartum Glucose Monitoring Record" : "Create Postpartum Glucose Monitoring Record",
        createPostpartumNote: isHebrew ? "Postpartum medical documentation" : "Postpartum medical documentation",
        createPostpartumNotes: isHebrew ? "Create Postpartum Notes Record" : "Create Postpartum Notes Record",
        createPostpartumPlanning: isHebrew ? "Create Postpartum Planning Record" : "Create Postpartum Planning Record",
        createPotentialTestingOutcome: isHebrew ? "Create Potential Testing Outcome Record" : "Create Potential Testing Outcome Record",
        createPotentialTestingOutcomes: isHebrew ? "Create Potential Testing Outcomes Record" : "Create Potential Testing Outcomes Record",
        createPreChemotherapyWorkup: isHebrew ? "Create Pre Chemotherapy Workup Record" : "Create Pre Chemotherapy Workup Record",
        createPreDialysisAssessment: isHebrew ? "Create Pre Dialysis Assessment Record" : "Create Pre Dialysis Assessment Record",
        createPreEmploymentPhysical: isHebrew ? "Create Pre Employment Physical Record" : "Create Pre Employment Physical Record",
        createPregnancyComplications: isHebrew ? "Create Pregnancy Complications Record" : "Create Pregnancy Complications Record",
        createPregnancySymptoms: isHebrew ? "Create Pregnancy Symptoms Record" : "Create Pregnancy Symptoms Record",
        createPrenatalTestingReports: isHebrew ? "Create Prenatal Testing Reports Record" : "Create Prenatal Testing Reports Record",
        createPrenatalVisits: isHebrew ? "Create Prenatal Visits Record" : "Create Prenatal Visits Record",
        createPreOperativeAssessment: isHebrew ? "Prepare Patient Evaluation" : "Prepare Patient Evaluation",
        createPreOperativeAssessments: isHebrew ? "Create Pre Operative Assessments Record" : "Create Pre Operative Assessments Record",
        createPreoperativeEvaluation: isHebrew ? "Create Preoperative Evaluation Record" : "Create Preoperative Evaluation Record",
        createPreOperativePreparation: isHebrew ? "Create Pre Operative Preparation Record" : "Create Pre Operative Preparation Record",
        createPrePregnancyWeight: isHebrew ? "Create Pre Pregnancy Weight Record" : "Create Pre Pregnancy Weight Record",
        createPreconceptionCounseling: isHebrew ? "Create Preconception Counseling Record" : "Create Preconception Counseling Record",
        createPreeclampsiaMonitoring: isHebrew ? "Create Preeclampsia Monitoring Record" : "Create Preeclampsia Monitoring Record",
        createPregnancyComplication: isHebrew ? "Create Pregnancy Complication Record" : "Create Pregnancy Complication Record",
        createPregnancyCourse: isHebrew ? "Create Pregnancy Course Record" : "Create Pregnancy Course Record",
        createPregnancyRiskAssessment: isHebrew ? "Create Pregnancy Risk Assessment Record" : "Create Pregnancy Risk Assessment Record",
        createPregnancySymptom: isHebrew ? "Create Pregnancy Symptom Record" : "Create Pregnancy Symptom Record",
        createPrenatalEducation: isHebrew ? "Create Prenatal Education Record" : "Create Prenatal Education Record",
        createPrenatalScreening: isHebrew ? "Create Prenatal Screening Record" : "Create Prenatal Screening Record",
        createPrenatalTestingReport: isHebrew ? "Generate Prenatal Test Report" : "Generate Prenatal Test Report",
        createPrenatalVisit: isHebrew ? "Schedule pregnancy checkup" : "Schedule pregnancy checkup",
        createPreoperativePreparation: isHebrew ? "Create Preoperative Preparation Record" : "Create Preoperative Preparation Record",
        createPrepAndDrape: isHebrew ? "Create Prep And Drape Record" : "Create Prep And Drape Record",
        createPrescription: isHebrew ? "Create Prescription Record" : "Create Prescription Record",
        createPrescriptions: isHebrew ? "צור מרשם" : "Create prescription",
        createPressureInjury: isHebrew ? "Create Pressure Injury Record" : "Create Pressure Injury Record",
        createPressureUlcerRisk: isHebrew ? "Create Pressure Ulcer Risk Record" : "Create Pressure Ulcer Risk Record",
        createPreventiveBiomarker: isHebrew ? "Create Preventive Biomarker Record" : "Create Preventive Biomarker Record",
        createPreventiveBiomarkers: isHebrew ? "Create Preventive Biomarkers Record" : "Create Preventive Biomarkers Record",
        createPreventiveCare: isHebrew ? "Create Preventive Care Record" : "Create Preventive Care Record",
        createPreventiveMedicineAssessment: isHebrew ? "Create Preventive Medicine Assessment Record" : "Create Preventive Medicine Assessment Record",
        createPreventiveMedicineAssessments: isHebrew ? "Create Preventive Medicine Assessments Record" : "Create Preventive Medicine Assessments Record",
        createPrimaryProphylaxi: isHebrew ? "Create Primary Prophylaxi Record" : "Create Primary Prophylaxi Record",
        createPrimaryProphylaxis: isHebrew ? "Create Primary Prophylaxis Record" : "Create Primary Prophylaxis Record",
        createPriorAuthorizationForm: isHebrew ? "Generate Prior Authorization Form" : "Generate Prior Authorization Form",
        createPriorAuthorizationForms: isHebrew ? "Create Prior Authorization Forms Record" : "Create Prior Authorization Forms Record",
        createPriorAuthorizationStatu: isHebrew ? "Create Prior Authorization Statu Record" : "Create Prior Authorization Statu Record",
        createPriorAuthorizationStatus: isHebrew ? "Create Prior Authorization Status Record" : "Create Prior Authorization Status Record",
        createPrnMedication: isHebrew ? "Create Prn Medication Record" : "Create Prn Medication Record",
        createPrnMedications: isHebrew ? "Create Prn Medications Record" : "Create Prn Medications Record",
        createProceduralSedation: isHebrew ? "Create Procedural Sedation Record" : "Create Procedural Sedation Record",
        createProcedureRequests: isHebrew ? "Create Procedure Requests Record" : "Create Procedure Requests Record",
        createProceduresIntervention: isHebrew ? "Create Procedures Intervention Record" : "Create Procedures Intervention Record",
        createProceduresInterventions: isHebrew ? "Create Procedures Interventions Record" : "Create Procedures Interventions Record",
        createPrognosi: isHebrew ? "Create Prognosi Record" : "Create Prognosi Record",
        createPrognosis: isHebrew ? "Create Prognosis Assessment" : "Create Prognosis Assessment",
        createPrognosisDiscussion: isHebrew ? "Create Prognosis Discussion Record" : "Create Prognosis Discussion Record",
        createPrognosisRecord: isHebrew ? "Create Patient Prognosis" : "Create Patient Prognosis",
        createPrognosisRecords: isHebrew ? "Create Prognosis Records Record" : "Create Prognosis Records Record",
        createPrognosticFactor: isHebrew ? "Create Prognostic Factor Record" : "Create Prognostic Factor Record",
        createPrognosticFactors: isHebrew ? "Create Prognostic Factors Record" : "Create Prognostic Factors Record",
        createProgressNote: isHebrew ? "Document Patient Visit" : "Document Patient Visit",
        createProgressNotes: isHebrew ? "Create Progress Notes Record" : "Create Progress Notes Record",
        createProphylacticMedication: isHebrew ? "Create Prophylactic Medication Record" : "Create Prophylactic Medication Record",
        createProphylacticMedications: isHebrew ? "Create Prophylactic Medications Record" : "Create Prophylactic Medications Record",
        createProposedArtSwitch: isHebrew ? "Create Proposed Art Switch Record" : "Create Proposed Art Switch Record",
        createProteinuriaAssessment: isHebrew ? "Create Proteinuria Assessment Record" : "Create Proteinuria Assessment Record",
        createProviderInfo: isHebrew ? "Create Provider Info Record" : "Create Provider Info Record",
        createPscManagement: isHebrew ? "Create Psc Management Record" : "Create Psc Management Record",
        createPsychiatricAssessmentScale: isHebrew ? "Create Psychiatric Assessment Scale Record" : "Create Psychiatric Assessment Scale Record",
        createPsychiatricAssessmentScales: isHebrew ? "Create Psychiatric Assessment Scales Record" : "Create Psychiatric Assessment Scales Record",
        createPsychiatricDischargeSummaries: isHebrew ? "Create Psychiatric Discharge Summaries Record" : "Create Psychiatric Discharge Summaries Record",
        createPsychiatricDischargeSummary: isHebrew ? "Generate Psychiatric Discharge Summary" : "Generate Psychiatric Discharge Summary",
        createPsychiatricEvaluation: isHebrew ? "Mental Health Assessment" : "Mental Health Assessment",
        createPsychiatricEvaluations: isHebrew ? "Create Psychiatric Evaluations Record" : "Create Psychiatric Evaluations Record",
        createPsychiatricHistory: isHebrew ? "Create Psychiatric History Record" : "Create Psychiatric History Record",
        createPsychiatricProgressNote: isHebrew ? "Mental Health Assessment" : "Mental Health Assessment",
        createPsychiatricProgressNotes: isHebrew ? "Create Psychiatric Progress Notes Record" : "Create Psychiatric Progress Notes Record",
        createPsychiatricReview: isHebrew ? "Create Psychiatric Review Record" : "Create Psychiatric Review Record",
        createPsychiatricTreatmentPlan: isHebrew ? "Create Psychiatric Treatment Plan Record" : "Create Psychiatric Treatment Plan Record",
        createPsychosocialAssessment: isHebrew ? "Create Psychosocial Assessment Record" : "Create Psychosocial Assessment Record",
        createPsychosocialAssessments: isHebrew ? "Create Psychosocial Assessments Record" : "Create Psychosocial Assessments Record",
        createPsychosocialFactor: isHebrew ? "Create Psychosocial Factor Record" : "Create Psychosocial Factor Record",
        createPsychosocialFactors: isHebrew ? "Create Psychosocial Factors Record" : "Create Psychosocial Factors Record",
        createPsychosocialOncology: isHebrew ? "Create Psychosocial Oncology Record" : "Create Psychosocial Oncology Record",
        createPsychosocialSupportService: isHebrew ? "Create Psychosocial Support Service Record" : "Create Psychosocial Support Service Record",
        createPsychosocialSupportServices: isHebrew ? "Create Psychosocial Support Services Record" : "Create Psychosocial Support Services Record",
        createPsychotropicMedication: isHebrew ? "Create Psychotropic Medication Record" : "Create Psychotropic Medication Record",
        createPsychotropicMedications: isHebrew ? "Create Psychotropic Medications Record" : "Create Psychotropic Medications Record",
        createPulmonaryFunctionTest: isHebrew ? "Lung Function Assessment" : "Lung Function Assessment",
        createPulmonaryFunctionTests: isHebrew ? "Create Pulmonary Function Tests Record" : "Create Pulmonary Function Tests Record",
        createPulmonaryImaging: isHebrew ? "Create Pulmonary Imaging Record" : "Create Pulmonary Imaging Record",
        createPulmonaryRehabilitation: isHebrew ? "Create Pulmonary Rehabilitation Record" : "Create Pulmonary Rehabilitation Record",
        createPulmonaryRehabilitationNote: isHebrew ? "Pulmonary Rehab Documentation" : "Pulmonary Rehab Documentation",
        createPulmonaryRehabilitationNotes: isHebrew ? "Create Pulmonary Rehabilitation Notes Record" : "Create Pulmonary Rehabilitation Notes Record",
        createPulmonologyConsultation: isHebrew ? "Request pulmonology consultation" : "Request pulmonology consultation",
        createPulmonologyConsultations: isHebrew ? "Create Pulmonology Consultations Record" : "Create Pulmonology Consultations Record",
        createPumpAdvancedSetting: isHebrew ? "Create Pump Advanced Setting Record" : "Create Pump Advanced Setting Record",
        createPumpAdvancedSettings: isHebrew ? "Create Pump Advanced Settings Record" : "Create Pump Advanced Settings Record",
        createPumpDownloadAnalysi: isHebrew ? "Create Pump Download Analysi Record" : "Create Pump Download Analysi Record",
        createPumpDownloadAnalysis: isHebrew ? "Create Pump Download Analysis Record" : "Create Pump Download Analysis Record",
        createQualityAssurance: isHebrew ? "Create Quality Assurance Record" : "Create Quality Assurance Record",
        createQualityMetric: isHebrew ? "Create Quality Metric Record" : "Create Quality Metric Record",
        createQualityMetrics: isHebrew ? "Create Quality Metrics Record" : "Create Quality Metrics Record",
        createRadiationOncology: isHebrew ? "Create Radiation Oncology Record" : "Create Radiation Oncology Record",
        createRadiationTherapy: isHebrew ? "Create Radiation Therapy Record" : "Create Radiation Therapy Record",
        createRadiationTherapyRecord: isHebrew ? "Create Radiation Therapy" : "Create Radiation Therapy",
        createRadiationTherapyRecords: isHebrew ? "Create Radiation Therapy Records Record" : "Create Radiation Therapy Records Record",
        createRadiologyFinding: isHebrew ? "Create Radiology Finding Record" : "Create Radiology Finding Record",
        createRadiologyFindings: isHebrew ? "Create Radiology Findings Record" : "Create Radiology Findings Record",
        createRadiologyReport: isHebrew ? "Generate Radiology Report" : "Generate Radiology Report",
        createRadiologyReports: isHebrew ? "Create Radiology Reports Record" : "Create Radiology Reports Record",
        createRapidResponseSummaries: isHebrew ? "Create Rapid Response Summaries Record" : "Create Rapid Response Summaries Record",
        createRapidResponseSummary: isHebrew ? "Rapid Response Summary" : "Rapid Response Summary",
        createReadmissionRiskAssessment: isHebrew ? "Create Readmission Risk Assessment Record" : "Create Readmission Risk Assessment Record",
        createReasonForReferral: isHebrew ? "Create Reason For Referral Record" : "Create Reason For Referral Record",
        createRecommendation: isHebrew ? "Suggest Personalized Content" : "Suggest Personalized Content",
        createReferral: isHebrew ? "צור הפניה" : "Create referral",
        createReferrals: isHebrew ? "Create Referrals Record" : "Create Referrals Record",
        createReferralsPlaced: isHebrew ? "Create Referrals Placed Record" : "Create Referrals Placed Record",
        createRegionalAnesthesiaRecords: isHebrew ? "Create Regional Anesthesia Records Record" : "Create Regional Anesthesia Records Record",
        createRehabilitationGoals: isHebrew ? "Create Rehabilitation Goals Record" : "Create Rehabilitation Goals Record",
        createRehabilitationProgressNote: isHebrew ? "Track Patient Recovery" : "Track Patient Recovery",
        createRehabilitationProgressNotes: isHebrew ? "Create Rehabilitation Progress Notes Record" : "Create Rehabilitation Progress Notes Record",
        createRehabilitationProtocol: isHebrew ? "Create Rehabilitation Protocol Record" : "Create Rehabilitation Protocol Record",
        createReminder: isHebrew ? "צור תזכורת" : "Create reminder",
        createRenalAnemia: isHebrew ? "Create Renal Anemia Record" : "Create Renal Anemia Record",
        createRenalNutrition: isHebrew ? "Create Renal Nutrition Record" : "Create Renal Nutrition Record",
        createRenalProtectionPlan: isHebrew ? "Create Renal Protection Plan Record" : "Create Renal Protection Plan Record",
        createReproductiveHistory: isHebrew ? "Create Reproductive History Record" : "Create Reproductive History Record",
        createRescueTherapyOption: isHebrew ? "Create Rescue Therapy Option Record" : "Create Rescue Therapy Option Record",
        createRescueTherapyOptions: isHebrew ? "Create Rescue Therapy Options Record" : "Create Rescue Therapy Options Record",
        createResearchConsentForm: isHebrew ? "Generate Research Consent Form" : "Generate Research Consent Form",
        createResearchConsentForms: isHebrew ? "Create Research Consent Forms Record" : "Create Research Consent Forms Record",
        createRespiratoryDevice: isHebrew ? "Create Respiratory Device Record" : "Create Respiratory Device Record",
        createRespiratoryDevices: isHebrew ? "Create Respiratory Devices Record" : "Create Respiratory Devices Record",
        createRespiratoryInfection: isHebrew ? "Create Respiratory Infection Record" : "Create Respiratory Infection Record",
        createRespiratoryInfections: isHebrew ? "Create Respiratory Infections Record" : "Create Respiratory Infections Record",
        createRespiratoryMedication: isHebrew ? "Create Respiratory Medication Record" : "Create Respiratory Medication Record",
        createRespiratoryMedications: isHebrew ? "Create Respiratory Medications Record" : "Create Respiratory Medications Record",
        createRespiteCare: isHebrew ? "Create Respite Care Record" : "Create Respite Care Record",
        createResponseAssessment: isHebrew ? "Create Response Assessment Record" : "Create Response Assessment Record",
        createResuscitationRecords: isHebrew ? "Create Resuscitation Records Record" : "Create Resuscitation Records Record",
        createRetinalExamination: isHebrew ? "Conduct Eye Assessment" : "Conduct Eye Assessment",
        createRetinalExaminations: isHebrew ? "Create Retinal Examinations Record" : "Create Retinal Examinations Record",
        createReturnToPlayProtocol: isHebrew ? "Create Return To Play Protocol Record" : "Create Return To Play Protocol Record",
        createReturnToSport: isHebrew ? "Create Return To Sport Record" : "Create Return To Sport Record",
        createReturnToWorkPlan: isHebrew ? "Create Return To Work Plan Record" : "Create Return To Work Plan Record",
        createReviewOfSystem: isHebrew ? "Create Review Of System Record" : "Create Review Of System Record",
        createReviewOfSystems: isHebrew ? "Create Review Of Systems Record" : "Create Review Of Systems Record",
        createRheumatoidArthritisAssessment: isHebrew ? "Create Rheumatoid Arthritis Assessment Record" : "Create Rheumatoid Arthritis Assessment Record",
        createRheumatologicAssessment: isHebrew ? "Create Rheumatologic Assessment Record" : "Create Rheumatologic Assessment Record",
        createRheumatologicMonitoring: isHebrew ? "Create Rheumatologic Monitoring Record" : "Create Rheumatologic Monitoring Record",
        createRheumatologicTreatment: isHebrew ? "Create Rheumatologic Treatment Record" : "Create Rheumatologic Treatment Record",
        createRheumatologyConsultation: isHebrew ? "Schedule Rheumatology Consultation" : "Schedule Rheumatology Consultation",
        createRheumatologyConsultations: isHebrew ? "Create Rheumatology Consultations Record" : "Create Rheumatology Consultations Record",
        createRiskCalculator: isHebrew ? "Create Risk Calculator Record" : "Create Risk Calculator Record",
        createRiskCalculators: isHebrew ? "Create Risk Calculators Record" : "Create Risk Calculators Record",
        createRiskCounseling: isHebrew ? "Create Risk Counseling Record" : "Create Risk Counseling Record",
        createRiskFactor: isHebrew ? "Assess Risk Level" : "Assess Risk Level",
        createRiskFactors: isHebrew ? "Create Risk Factors Record" : "Create Risk Factors Record",
        createSafetyPlanning: isHebrew ? "Create Safety Planning Record" : "Create Safety Planning Record",
        createScheduledMedication: isHebrew ? "Create Scheduled Medication Record" : "Create Scheduled Medication Record",
        createScheduledMedications: isHebrew ? "Create Scheduled Medications Record" : "Create Scheduled Medications Record",
        createSchoolHealthForm: isHebrew ? "School Health Registration" : "School Health Registration",
        createSchoolHealthForms: isHebrew ? "Create School Health Forms Record" : "Create School Health Forms Record",
        createSchoolPerformance: isHebrew ? "Create School Performance Record" : "Create School Performance Record",
        createSclerodermaAssessment: isHebrew ? "Create Scleroderma Assessment Record" : "Create Scleroderma Assessment Record",
        createScreeningCompliance: isHebrew ? "Create Screening Compliance Record" : "Create Screening Compliance Record",
        createSecondaryProphylaxis: isHebrew ? "Create Secondary Prophylaxis Record" : "Create Secondary Prophylaxis Record",
        createSecondOpinionReport: isHebrew ? "Generate Medical Report" : "Generate Medical Report",
        createSecondaryProphylaxi: isHebrew ? "Create Secondary Prophylaxi Record" : "Create Secondary Prophylaxi Record",
        createSecondOpinionReports: isHebrew ? "Create Second Opinion Reports Record" : "Create Second Opinion Reports Record",
        createSedationRecords: isHebrew ? "Create Sedation Records Record" : "Create Sedation Records Record",
        createSepsisManagement: isHebrew ? "Create Sepsis Management Record" : "Create Sepsis Management Record",
        createShiftHandoffNote: isHebrew ? "Shift Handoff Note" : "Shift Handoff Note",
        createShiftHandoffNotes: isHebrew ? "Create Shift Handoff Notes Record" : "Create Shift Handoff Notes Record",
        createSingleEmbryoTransfer: isHebrew ? "Create Single Embryo Transfer Record" : "Create Single Embryo Transfer Record",
        createSingleEmbryoTransferDetail: isHebrew ? "Create Single Embryo Transfer Detail Record" : "Create Single Embryo Transfer Detail Record",
        createSingleEmbryoTransferDetails: isHebrew ? "Create Single Embryo Transfer Details Record" : "Create Single Embryo Transfer Details Record",
        createSjogrensSyndromeAssessment: isHebrew ? "Create Sjogrens Syndrome Assessment Record" : "Create Sjogrens Syndrome Assessment Record",
        createSkinBiopsyReport: isHebrew ? "Generate Skin Biopsy Report" : "Generate Skin Biopsy Report",
        createSkinBiopsyReports: isHebrew ? "Create Skin Biopsy Reports Record" : "Create Skin Biopsy Reports Record",
        createSleepApneaManagement: isHebrew ? "Create Sleep Apnea Management Record" : "Create Sleep Apnea Management Record",
        createSleepDisorderAssessment: isHebrew ? "Create Sleep Disorder Assessment Record" : "Create Sleep Disorder Assessment Record",
        createSleepDisturbance: isHebrew ? "Create Sleep Disturbance Record" : "Create Sleep Disturbance Record",
        createSleepDisturbances: isHebrew ? "Create Sleep Disturbances Record" : "Create Sleep Disturbances Record",
        createSleepHygieneEducation: isHebrew ? "Create Sleep Hygiene Education Record" : "Create Sleep Hygiene Education Record",
        createSleepStudyReport: isHebrew ? "Generate Sleep Study Report" : "Generate Sleep Study Report",
        createSleepStudyReports: isHebrew ? "Create Sleep Study Reports Record" : "Create Sleep Study Reports Record",
        createSoapNote: isHebrew ? "Document Patient Encounter" : "Document Patient Encounter",
        createSoapNotes: isHebrew ? "Create Soap Notes Record" : "Create Soap Notes Record",
        createSocialDeterminantsOfHealth: isHebrew ? "Create Social Determinants Of Health Record" : "Create Social Determinants Of Health Record",
        createSocialFunctionalAssessment: isHebrew ? "Create Social Functional Assessment Record" : "Create Social Functional Assessment Record",
        createSocialHistory: isHebrew ? "Create Social History Record" : "Create Social History Record",
        createSocialSupport: isHebrew ? "Create Social Support Record" : "Create Social Support Record",
        createSocialWork: isHebrew ? "Create Social Work Record" : "Create Social Work Record",
        createSocialWorkNote: isHebrew ? "Document Social Interaction" : "Document Social Interaction",
        createSocialWorkNotes: isHebrew ? "Create Social Work Notes Record" : "Create Social Work Notes Record",
        createSource: isHebrew ? "Create Source Record" : "Create Source Record",
        createSouthAsianNutritionist: isHebrew ? "Create South Asian Nutritionist Record" : "Create South Asian Nutritionist Record",
        createSpecialtyField: isHebrew ? "Create Specialty Field Record" : "Create Specialty Field Record",
        createSpecialtyFields: isHebrew ? "Create Specialty Fields Record" : "Create Specialty Fields Record",
        createSpecificIgeTest: isHebrew ? "Generates IGE test" : "Generates IGE test",
        createSpecificIgeTests: isHebrew ? "Create Specific Ige Tests Record" : "Create Specific Ige Tests Record",
        createSpecimen: isHebrew ? "Create Specimen Record" : "Create Specimen Record",
        createSpecimens: isHebrew ? "Create Specimens Record" : "Create Specimens Record",
        createSpeechTherapyAssessment: isHebrew ? "Craft Speech Therapy Evaluation" : "Craft Speech Therapy Evaluation",
        createSpeechTherapyAssessments: isHebrew ? "Create Speech Therapy Assessments Record" : "Create Speech Therapy Assessments Record",
        createSpondyloarthritisAssessment: isHebrew ? "Create Spondyloarthritis Assessment Record" : "Create Spondyloarthritis Assessment Record",
        createSpongeInstrumentCount: isHebrew ? "Create Sponge Instrument Count Record" : "Create Sponge Instrument Count Record",
        createSpongeInstrumentCounts: isHebrew ? "Create Sponge Instrument Counts Record" : "Create Sponge Instrument Counts Record",
        createSportsMedicineEvaluation: isHebrew ? "Create Sports Medicine Evaluation Record" : "Create Sports Medicine Evaluation Record",
        createSportsMedicineEvaluations: isHebrew ? "Create Sports Medicine Evaluations Record" : "Create Sports Medicine Evaluations Record",
        createSportsNutritionPlan: isHebrew ? "Create Sports Nutrition Plan Record" : "Create Sports Nutrition Plan Record",
        createSportsPhysicalExamination: isHebrew ? "Create Sports Physical Examination Record" : "Create Sports Physical Examination Record",
        createStagingSummary: isHebrew ? "Create Staging Summary Record" : "Create Staging Summary Record",
        createStressManagementReferral: isHebrew ? "Create Stress Management Referral Record" : "Create Stress Management Referral Record",
        createStressManagementReferrals: isHebrew ? "Create Stress Management Referrals Record" : "Create Stress Management Referrals Record",
        createStressTestReport: isHebrew ? "Generate Stress Test Report" : "Generate Stress Test Report",
        createStressTestReports: isHebrew ? "Create Stress Test Reports Record" : "Create Stress Test Reports Record",
        createStrokeAssessment: isHebrew ? "Create Stroke Assessment Record" : "Create Stroke Assessment Record",
        createSubstanceUseAssessment: isHebrew ? "Create Substance Use Assessment Record" : "Create Substance Use Assessment Record",
        createSuicideRiskAssessment: isHebrew ? "Create Suicide Risk Assessment Record" : "Create Suicide Risk Assessment Record",
        createSupplementationPlan: isHebrew ? "Create Supplementation Plan Record" : "Create Supplementation Plan Record",
        createSupplementationPlans: isHebrew ? "Create Supplementation Plans Record" : "Create Supplementation Plans Record",
        createSupportGroupReferral: isHebrew ? "Create Support Group Referral Record" : "Create Support Group Referral Record",
        createSupportiveCare: isHebrew ? "Create Supportive Care Record" : "Create Supportive Care Record",
        createSurgicalApproach: isHebrew ? "Create Surgical Approach Record" : "Create Surgical Approach Record",
        createSurgicalConsentForm: isHebrew ? "Generate surgical consent document" : "Generate surgical consent document",
        createSurgicalConsentForms: isHebrew ? "Create Surgical Consent Forms Record" : "Create Surgical Consent Forms Record",
        createSurgicalHistory: isHebrew ? "Create Surgical History Record" : "Create Surgical History Record",
        createSurgicalOncology: isHebrew ? "Create Surgical Oncology Record" : "Create Surgical Oncology Record",
        createSurgicalStep: isHebrew ? "Create Surgical Step Record" : "Create Surgical Step Record",
        createSurgicalSteps: isHebrew ? "Create Surgical Steps Record" : "Create Surgical Steps Record",
        createSurgicalTeam: isHebrew ? "Create Surgical Team Record" : "Create Surgical Team Record",
        createSurvivorshipCarePlan: isHebrew ? "Create Survivorship Care Plan Record" : "Create Survivorship Care Plan Record",
        createSymptomProgression: isHebrew ? "Create Symptom Progression Record" : "Create Symptom Progression Record",
        createSymptomProgressionTimeline: isHebrew ? "Create Symptom Progression Timeline Record" : "Create Symptom Progression Timeline Record",
        createTelemedicineEncounter: isHebrew ? "Schedule Virtual Consultation" : "Schedule Virtual Consultation",
        createTelemedicineEncounters: isHebrew ? "Create Telemedicine Encounters Record" : "Create Telemedicine Encounters Record",
        createTherapyProgressNote: isHebrew ? "Track Patient Progress" : "Track Patient Progress",
        createTherapyProgressNotes: isHebrew ? "Create Therapy Progress Notes Record" : "Create Therapy Progress Notes Record",
        createTherapyRequests: isHebrew ? "Create Therapy Requests Record" : "Create Therapy Requests Record",
        createTherapySessionNote: isHebrew ? "Document therapy session" : "Document therapy session",
        createTherapySessionNotes: isHebrew ? "Create Therapy Session Notes Record" : "Create Therapy Session Notes Record",
        createThoracicSurgeryAssessment: isHebrew ? "Create Thoracic Surgery Assessment Record" : "Create Thoracic Surgery Assessment Record",
        createThyroidEvaluation: isHebrew ? "Thyroid Health Assessment" : "Thyroid Health Assessment",
        createThyroidEvaluations: isHebrew ? "Create Thyroid Evaluations Record" : "Create Thyroid Evaluations Record",
        createThyroidManagement: isHebrew ? "Create Thyroid Management Record" : "Create Thyroid Management Record",
        createTotalWeightGain: isHebrew ? "Create Total Weight Gain Record" : "Create Total Weight Gain Record",
        createTourniquetData: isHebrew ? "Create Tourniquet Data Record" : "Create Tourniquet Data Record",
        createToxicityAssessment: isHebrew ? "Create Toxicity Assessment Record" : "Create Toxicity Assessment Record",
        createToxicologyReport: isHebrew ? "Generate Toxicology Analysis" : "Generate Toxicology Analysis",
        createToxicologyReports: isHebrew ? "Create Toxicology Reports Record" : "Create Toxicology Reports Record",
        createTractographyStudies: isHebrew ? "Create Tractography Studies Record" : "Create Tractography Studies Record",
        createTractographyStudy: isHebrew ? "Generate Brain Connectivity Map" : "Generate Brain Connectivity Map",
        createTransferSummaries: isHebrew ? "Create Transfer Summaries Record" : "Create Transfer Summaries Record",
        createTransferSummary: isHebrew ? "Generate transfer summary" : "Generate transfer summary",
        createTransplantAssessment: isHebrew ? "Create Transplant Assessment Record" : "Create Transplant Assessment Record",
        createTransplantEvaluation: isHebrew ? "Medical transplant assessment" : "Medical transplant assessment",
        createTransplantEvaluations: isHebrew ? "Create Transplant Evaluations Record" : "Create Transplant Evaluations Record",
        createTraumaAssessment: isHebrew ? "Create Trauma Assessment Record" : "Create Trauma Assessment Record",
        createTraumaFlowSheet: isHebrew ? "Track Patient Trauma" : "Track Patient Trauma",
        createTraumaFlowSheets: isHebrew ? "Create Trauma Flow Sheets Record" : "Create Trauma Flow Sheets Record",
        createTraumaScoring: isHebrew ? "Create Trauma Scoring Record" : "Create Trauma Scoring Record",
        createTravelHealthCertificate: isHebrew ? "Generate Travel Certificate" : "Generate Travel Certificate",
        createTravelHealthCertificates: isHebrew ? "Create Travel Health Certificates Record" : "Create Travel Health Certificates Record",
        createTravelMedicineAssessment: isHebrew ? "Create Travel Medicine Assessment Record" : "Create Travel Medicine Assessment Record",
        createTravelVaccinationRecords: isHebrew ? "Create Travel Vaccination Records Record" : "Create Travel Vaccination Records Record",
        createTreatmentCours: isHebrew ? "Create Treatment Cours Record" : "Create Treatment Cours Record",
        createTreatmentCourses: isHebrew ? "Create Treatment Courses Record" : "Create Treatment Courses Record",
        createTreatmentGoal: isHebrew ? "Create Treatment Goal Record" : "Create Treatment Goal Record",
        createTreatmentGoals: isHebrew ? "Create Treatment Goals Record" : "Create Treatment Goals Record",
        createTreatmentPlan: isHebrew ? "Design Patient Treatment" : "Design Patient Treatment",
        createTreatmentPlans: isHebrew ? "Create Treatment Plans Record" : "Create Treatment Plans Record",
        createTreatmentSummary: isHebrew ? "Create Treatment Summary Record" : "Create Treatment Summary Record",
        createTrendAnalysi: isHebrew ? "Create Trend Analysi Record" : "Create Trend Analysi Record",
        createTrendAnalysis: isHebrew ? "Create Trend Analysis Record" : "Create Trend Analysis Record",
        createTrendingAnalysi: isHebrew ? "Trend Data Generator" : "Trend Data Generator",
        createTrendingAnalysis: isHebrew ? "Create Trending Analysis Record" : "Create Trending Analysis Record",
        createTriageData: isHebrew ? "Create Triage Data Record" : "Create Triage Data Record",
        createTropicalDiseaseAssessment: isHebrew ? "Create Tropical Disease Assessment Record" : "Create Tropical Disease Assessment Record",
        createTumorBoardNote: isHebrew ? "Generate tumor board note" : "Generate tumor board note",
        createTumorBoardNotes: isHebrew ? "Create Tumor Board Notes Record" : "Create Tumor Board Notes Record",
        createTumorMarker: isHebrew ? "Create Tumor Marker Record" : "Create Tumor Marker Record",
        createTumorMarkerPanel: isHebrew ? "Tumor Marker Analysis" : "Tumor Marker Analysis",
        createTumorMarkerPanels: isHebrew ? "Create Tumor Marker Panels Record" : "Create Tumor Marker Panels Record",
        createTumorMarkers: isHebrew ? "Create Tumor Markers Record" : "Create Tumor Markers Record",
        createUltrasoundObReport: isHebrew ? "Generate Ultrasound Observation Report" : "Generate Ultrasound Observation Report",
        createUltrasoundObReports: isHebrew ? "Create Ultrasound Ob Reports Record" : "Create Ultrasound Ob Reports Record",
        createUmbilicalArteryDoppler: isHebrew ? "Create Umbilical Artery Doppler Record" : "Create Umbilical Artery Doppler Record",
        createUnifiedMedicalDocument: isHebrew ? "Create Unified Medical Document Record" : "Create Unified Medical Document Record",
        createUrodynamicStudies: isHebrew ? "Create Urodynamic Studies Record" : "Create Urodynamic Studies Record",
        createUrodynamicStudy: isHebrew ? "Create Urodynamic Assessment" : "Create Urodynamic Assessment",
        createUrologyAssessment: isHebrew ? "Create Urology Assessment Record" : "Create Urology Assessment Record",
        createUrologyConsultation: isHebrew ? "Schedule Urology Appointment" : "Schedule Urology Appointment",
        createUrologyConsultations: isHebrew ? "Create Urology Consultations Record" : "Create Urology Consultations Record",
        createUser: isHebrew ? "צור משתמש" : "Create user",
        createVaccinationRecord: isHebrew ? "Track vaccine details" : "Track vaccine details",
        createVaccinationRecords: isHebrew ? "Create Vaccination Records Record" : "Create Vaccination Records Record",
        createVariantInterpretationGuideline: isHebrew ? "Create Variant Interpretation Guideline Record" : "Create Variant Interpretation Guideline Record",
        createVariantInterpretationGuidelines: isHebrew ? "Create Variant Interpretation Guidelines Record" : "Create Variant Interpretation Guidelines Record",
        createVasculitisAssessment: isHebrew ? "Create Vasculitis Assessment Record" : "Create Vasculitis Assessment Record",
        createVenousThromboembolismRisk: isHebrew ? "Create Venous Thromboembolism Risk Record" : "Create Venous Thromboembolism Risk Record",
        createVentilatorSetting: isHebrew ? "Create Ventilator Setting Record" : "Create Ventilator Setting Record",
        createVentilatorSettings: isHebrew ? "Create Ventilator Settings Record" : "Create Ventilator Settings Record",
        createVisualAcuityReport: isHebrew ? "Generate Vision Assessment" : "Generate Vision Assessment",
        createVisualAcuityReports: isHebrew ? "Create Visual Acuity Reports Record" : "Create Visual Acuity Reports Record",
        createVitalSign: isHebrew ? "Record Patient Vitals" : "Record Patient Vitals",
        createVitalSigns: isHebrew ? "Create Vital Signs Record" : "Create Vital Signs Record",
        createVitalSignsLog: isHebrew ? "Track Patient Vitals" : "Track Patient Vitals",
        createVitalSignsLogs: isHebrew ? "Create Vital Signs Logs Record" : "Create Vital Signs Logs Record",
        createVitalSignsMonitoring: isHebrew ? "Create Vital Signs Monitoring Record" : "Create Vital Signs Monitoring Record",
        createVitalSignsTable: isHebrew ? "Create Vital Signs Table Record" : "Create Vital Signs Table Record",
        createWeeklyVirtualCheckIn: isHebrew ? "Create Weekly Virtual Check In Record" : "Create Weekly Virtual Check In Record",
        createWeeklyVirtualCheckIns: isHebrew ? "Create Weekly Virtual Check Ins Record" : "Create Weekly Virtual Check Ins Record",
        createWeightMeasurement: isHebrew ? "Create Weight Measurement Record" : "Create Weight Measurement Record",
        createWeightMeasurements: isHebrew ? "Create Weight Measurements Record" : "Create Weight Measurements Record",
        createWeightMonitoring: isHebrew ? "Create Weight Monitoring Record" : "Create Weight Monitoring Record",
        createWellChildExamination: isHebrew ? "Record child's health" : "Record child's health",
        createWellChildExaminations: isHebrew ? "Create Well Child Examinations Record" : "Create Well Child Examinations Record",
        createWellChildSummary: isHebrew ? "Create Well Child Summary Record" : "Create Well Child Summary Record",
        createWellnessVisitDocumentation: isHebrew ? "Create Wellness Visit Documentation Record" : "Create Wellness Visit Documentation Record",
        createWorkAccommodation: isHebrew ? "Create Work Accommodation Record" : "Create Work Accommodation Record",
        createWorkAccommodations: isHebrew ? "Create Work Accommodations Record" : "Create Work Accommodations Record",
        createWorkersCompensationEvaluation: isHebrew ? "Create Workers Compensation Evaluation Record" : "Create Workers Compensation Evaluation Record",
        createWorkersCompEvaluations: isHebrew ? "Create Workers Comp Evaluations Record" : "Create Workers Comp Evaluations Record",
        createWorkplaceAccommodations: isHebrew ? "Create Workplace Accommodations Record" : "Create Workplace Accommodations Record",
        createWorkplaceInjuryReport: isHebrew ? "Create Workplace Injury Report Record" : "Create Workplace Injury Report Record",
        createWorkRestriction: isHebrew ? "Create Work Restriction Record" : "Create Work Restriction Record",
        createWorkersCompEvaluation: isHebrew ? "Workers' Comp Assessment" : "Workers' Comp Assessment",
        createWorkplaceAccommodation: isHebrew ? "Create Workplace Accommodation Record" : "Create Workplace Accommodation Record",
        createWorkRestrictions: isHebrew ? "Create Work Restrictions Record" : "Create Work Restrictions Record",
        createWoundCareAssessment: isHebrew ? "Create Wound Care Assessment Record" : "Create Wound Care Assessment Record",
        createWoundCareAssessments: isHebrew ? "Create Wound Care Assessments Record" : "Create Wound Care Assessments Record",
        createWoundCareDocumentation: isHebrew ? "Document Wound Details" : "Document Wound Details",
        createWoundCareNote: isHebrew ? "Document Patient Wound" : "Document Patient Wound",
        createWoundCareNotes: isHebrew ? "Create Wound Care Notes Record" : "Create Wound Care Notes Record",
        default: isHebrew ? "פונקציה" : "Function",
        deleteAbnormalResult: isHebrew ? "Delete Abnormal Result" : "Delete Abnormal Result",
        deleteAbnormalResults: isHebrew ? "Delete Abnormal Results" : "Delete Abnormal Results",
        deleteAccessPlanning: isHebrew ? "Delete Access Planning" : "Delete Access Planning",
        deleteAcmgGuidelinesReference: isHebrew ? "Delete Acmg Guidelines Reference" : "Delete Acmg Guidelines Reference",
        deleteAcuteKidneyInjury: isHebrew ? "Delete Acute Kidney Injury" : "Delete Acute Kidney Injury",
        deleteAddictionMedicineConsultation: isHebrew ? "Delete Addiction Medicine Consultation" : "Delete Addiction Medicine Consultation",
        deleteAddictionMedicineConsultations: isHebrew ? "Delete Addiction Medicine Consultations" : "Delete Addiction Medicine Consultations",
        deleteAdhdAssessment: isHebrew ? "Delete Adhd Assessment" : "Delete Adhd Assessment",
        deleteAdministrativeData: isHebrew ? "Delete Administrative Data" : "Delete Administrative Data",
        deleteAdmissionAssessment: isHebrew ? "Remove admission assessment" : "Remove admission assessment",
        deleteAdmissionAssessments: isHebrew ? "Delete Admission Assessments" : "Delete Admission Assessments",
        deleteAdmissionDecision: isHebrew ? "Delete Admission Decision" : "Delete Admission Decision",
        deleteAdmissionDecisions: isHebrew ? "Delete Admission Decisions" : "Delete Admission Decisions",
        deleteAdmissionRecommendation: isHebrew ? "Delete Admission Recommendation" : "Delete Admission Recommendation",
        deleteAdmissionRecommendations: isHebrew ? "Delete Admission Recommendations" : "Delete Admission Recommendations",
        deleteAdultDayProgramInfo: isHebrew ? "Delete Adult Day Program Info" : "Delete Adult Day Program Info",
        deleteAdvanceCarePlanning: isHebrew ? "Delete Advance Care Planning" : "Delete Advance Care Planning",
        deleteGoalsOfCareDiscussions: isHebrew ? "Delete Advanced Directives" : "Delete Advanced Directives",
        deleteAdvanceDirective: isHebrew ? "Delete Advance Directive" : "Delete Advance Directive",
        deleteAdvanceDirectiveDiscussion: isHebrew ? "Delete Advance Directive Discussion" : "Delete Advance Directive Discussion",
        deleteGeriatricCarePlanning: isHebrew ? "Delete Advanced Care Planning" : "Delete Advanced Care Planning",
        deleteAdvancedDirective: isHebrew ? "Remove patient directive" : "Remove patient directive",
        deleteAdvanceDirectives: isHebrew ? "Delete Advance Directives" : "Delete Advance Directives",
        deleteAirwayManagementRecords: isHebrew ? "Delete Airway Management Records" : "Delete Airway Management Records",
        deleteAllergies: isHebrew ? "Delete Allergies" : "Delete Allergies",
        deleteAllergiesAssessment: isHebrew ? "Remove allergy assessment" : "Remove allergy assessment",
        deleteAllergiesAssessments: isHebrew ? "Delete Allergies Assessments" : "Delete Allergies Assessments",
        deleteAllergy: isHebrew ? "Remove patient allergy" : "Remove patient allergy",
        deleteAllergyAssessment: isHebrew ? "Delete Allergy Assessment" : "Delete Allergy Assessment",
        deleteAllergyAssessments: isHebrew ? "Delete Allergy Assessments" : "Delete Allergy Assessments",
        deleteAllergyImmunologyAssessment: isHebrew ? "Delete Allergy Immunology Assessment" : "Delete Allergy Immunology Assessment",
        deleteAllergySkinTesting: isHebrew ? "Delete Allergy Skin Testing" : "Delete Allergy Skin Testing",
        deleteAmniocentesisReport: isHebrew ? "Delete amniocentesis report" : "Delete amniocentesis report",
        deleteAmniocentesisReports: isHebrew ? "Delete Amniocentesis Reports" : "Delete Amniocentesis Reports",
        deleteAmnioticFluidAssessment: isHebrew ? "Delete Amniotic Fluid Assessment" : "Delete Amniotic Fluid Assessment",
        deleteAmnioticFluidIndexCurrent: isHebrew ? "Delete Amniotic Fluid Index Current" : "Delete Amniotic Fluid Index Current",
        deleteAnatomyScanResult: isHebrew ? "Delete Anatomy Scan Result" : "Delete Anatomy Scan Result",
        deleteAnesthesiaComplications: isHebrew ? "Delete Anesthesia Complications" : "Delete Anesthesia Complications",
        deleteAnesthesiaConsent: isHebrew ? "Delete Anesthesia Consent" : "Delete Anesthesia Consent",
        deleteAnesthesiaRecord: isHebrew ? "Delete anesthesia record" : "Delete anesthesia record",
        deleteAnesthesiaRecords: isHebrew ? "Delete Anesthesia Records" : "Delete Anesthesia Records",
        deleteAnesthesiologyAssessment: isHebrew ? "Delete Anesthesiology Assessment" : "Delete Anesthesiology Assessment",
        deleteAnnualPhysicalExamination: isHebrew ? "Delete Annual Physical Examination" : "Delete Annual Physical Examination",
        deleteAntibiogramReport: isHebrew ? "Delete antibiogram report" : "Delete antibiogram report",
        deleteAntibiogramReports: isHebrew ? "Delete Antibiogram Reports" : "Delete Antibiogram Reports",
        deleteAntibioticStewardship: isHebrew ? "Delete Antibiotic Stewardship" : "Delete Antibiotic Stewardship",
        deleteAnticipatoryGuidance: isHebrew ? "Delete Anticipatory Guidance" : "Delete Anticipatory Guidance",
        deleteAnticoagulationManagement: isHebrew ? "Delete Anticoagulation Management" : "Delete Anticoagulation Management",
        deleteAntimicrobialSusceptibility: isHebrew ? "Delete Antimicrobial Susceptibility" : "Delete Antimicrobial Susceptibility",
        deleteApgarScore: isHebrew ? "Remove Apgar record" : "Remove Apgar record",
        deleteApgarScores: isHebrew ? "Delete Apgar Scores" : "Delete Apgar Scores",
        deleteAppetiteStimulant: isHebrew ? "Delete Appetite Stimulant" : "Delete Appetite Stimulant",
        deleteAppetiteStimulants: isHebrew ? "Delete Appetite Stimulants" : "Delete Appetite Stimulants",
        deleteAppointment: isHebrew ? "מחק תור" : "Delete appointment",
        deleteAppointments: isHebrew ? "Delete Appointments" : "Delete Appointments",
        deleteArterialBloodGas: isHebrew ? "Delete Arterial Blood Gas" : "Delete Arterial Blood Gas",
        deleteArterialBloodGases: isHebrew ? "Delete Arterial Blood Gases" : "Delete Arterial Blood Gases",
        deleteArthritisAssessment: isHebrew ? "Delete arthritis assessment" : "Delete arthritis assessment",
        deleteArthritisAssessments: isHebrew ? "Delete Arthritis Assessments" : "Delete Arthritis Assessments",
        deleteArticularCartilage: isHebrew ? "Delete Articular Cartilage" : "Delete Articular Cartilage",
        deleteAssessmentPlan: isHebrew ? "Delete Assessment Plan" : "Delete Assessment Plan",
        deleteAssessmentPlans: isHebrew ? "Delete Assessment Plans" : "Delete Assessment Plans",
        deleteAssistiveDevice: isHebrew ? "Delete Assistive Device" : "Delete Assistive Device",
        deleteAssistiveDevices: isHebrew ? "Delete Assistive Devices" : "Delete Assistive Devices",
        deleteAsthmaActionPlan: isHebrew ? "Delete Asthma Action Plan" : "Delete Asthma Action Plan",
        deleteAsthmaAssessment: isHebrew ? "Delete Asthma Assessment" : "Delete Asthma Assessment",
        deleteAsthmaAssessments: isHebrew ? "Delete Asthma Assessments" : "Delete Asthma Assessments",
        deleteAsthmaManagementNote: isHebrew ? "Delete Asthma Note" : "Delete Asthma Note",
        deleteAsthmaManagementNotes: isHebrew ? "Delete Asthma Management Notes" : "Delete Asthma Management Notes",
        deleteAthleteSpecificData: isHebrew ? "Delete Athlete Specific Data" : "Delete Athlete Specific Data",
        deleteAthleticInjuryAssessment: isHebrew ? "Delete Athletic Injury Assessment" : "Delete Athletic Injury Assessment",
        deleteAudiometryReport: isHebrew ? "Delete Audiometry Report" : "Delete Audiometry Report",
        deleteAudiometryReports: isHebrew ? "Delete Audiometry Reports" : "Delete Audiometry Reports",
        deleteAutoantibodyProfile: isHebrew ? "Delete Autoantibody Profile" : "Delete Autoantibody Profile",
        deleteAutoimmuneEvaluation: isHebrew ? "Remove Autoimmune Assessment" : "Remove Autoimmune Assessment",
        deleteAutoimmuneEvaluations: isHebrew ? "Delete Autoimmune Evaluations" : "Delete Autoimmune Evaluations",
        deleteAutoimmunePanel: isHebrew ? "Remove Autoimmune Panel" : "Remove Autoimmune Panel",
        deleteAutoimmunePanels: isHebrew ? "Delete Autoimmune Panels" : "Delete Autoimmune Panels",
        deleteAutopsyReport: isHebrew ? "Delete medical report" : "Delete medical report",
        deleteAutopsyReports: isHebrew ? "Delete Autopsy Reports" : "Delete Autopsy Reports",
        deleteBarriersPsychosocialIssue: isHebrew ? "Delete Barriers Psychosocial Issue" : "Delete Barriers Psychosocial Issue",
        deleteBarriersPsychosocialIssues: isHebrew ? "Delete Barriers Psychosocial Issues" : "Delete Barriers Psychosocial Issues",
        deleteBasalRateAdjustment: isHebrew ? "Delete Basal Rate Adjustment" : "Delete Basal Rate Adjustment",
        deleteBasalRateAdjustments: isHebrew ? "Delete Basal Rate Adjustments" : "Delete Basal Rate Adjustments",
        deleteBehavioralAssessment: isHebrew ? "Delete Behavioral Assessment" : "Delete Behavioral Assessment",
        deleteBehavioralHealthGoals: isHebrew ? "Delete Behavioral Health Goals" : "Delete Behavioral Health Goals",
        deleteBiologicTherapy: isHebrew ? "Delete Biologic Therapy" : "Delete Biologic Therapy",
        deleteBiologicTherapyRecord: isHebrew ? "Delete Biologic Therapy Record" : "Delete Biologic Therapy Record",
        deleteBiologicTherapyRecords: isHebrew ? "Delete Biologic Therapy Records" : "Delete Biologic Therapy Records",
        deleteBiopsyReport: isHebrew ? "Delete biopsy record" : "Delete biopsy record",
        deleteBiopsychosocialFormulation: isHebrew ? "Delete Biopsychosocial Formulation" : "Delete Biopsychosocial Formulation",
        deleteBiopsyReports: isHebrew ? "Delete Biopsy Reports" : "Delete Biopsy Reports",
        deleteBirthHistory: isHebrew ? "Delete Birth History" : "Delete Birth History",
        deleteBirthPlan: isHebrew ? "Delete Birth Plan" : "Delete Birth Plan",
        deleteBleedingRiskAssessment: isHebrew ? "Delete Bleeding Risk Assessment" : "Delete Bleeding Risk Assessment",
        deleteBloodDisorderReport: isHebrew ? "Delete Blood Disorder Report" : "Delete Blood Disorder Report",
        deleteBloodDisorderReports: isHebrew ? "Delete Blood Disorder Reports" : "Delete Blood Disorder Reports",
        deleteBloodGlucoseLog: isHebrew ? "Delete glucose record" : "Delete glucose record",
        deleteBloodGlucoseLogs: isHebrew ? "Delete Blood Glucose Logs" : "Delete Blood Glucose Logs",
        deleteBloodGlucoseMonitoring: isHebrew ? "Delete Blood Glucose Monitoring" : "Delete Blood Glucose Monitoring",
        deleteBloodPressureReading: isHebrew ? "Delete Blood Pressure Reading" : "Delete Blood Pressure Reading",
        deleteBloodPressureReadings: isHebrew ? "Delete Blood Pressure Readings" : "Delete Blood Pressure Readings",
        deleteBloodProduct: isHebrew ? "Delete Blood Product" : "Delete Blood Product",
        deleteBloodProducts: isHebrew ? "Delete Blood Products" : "Delete Blood Products",
        deleteBloodProductsOrdered: isHebrew ? "Delete Blood Products Ordered" : "Delete Blood Products Ordered",
        deleteBloodSampleCollectionStatu: isHebrew ? "Delete Blood Sample Collection Statu" : "Delete Blood Sample Collection Statu",
        deleteBloodSampleCollectionStatus: isHebrew ? "Delete Blood Sample Collection Status" : "Delete Blood Sample Collection Status",
        deleteBloodSmear: isHebrew ? "Remove blood sample" : "Remove blood sample",
        deleteBloodSmears: isHebrew ? "Delete Blood Smears" : "Delete Blood Smears",
        deleteBolusAdjustment: isHebrew ? "Delete Bolus Adjustment" : "Delete Bolus Adjustment",
        deleteBolusAdjustments: isHebrew ? "Delete Bolus Adjustments" : "Delete Bolus Adjustments",
        deleteBoneHealth: isHebrew ? "Delete Bone Health" : "Delete Bone Health",
        deleteBoneMarrowReport: isHebrew ? "Delete Bone Marrow Report" : "Delete Bone Marrow Report",
        deleteBoneMarrowReports: isHebrew ? "Delete Bone Marrow Reports" : "Delete Bone Marrow Reports",
        deleteBoneMarrowStudies: isHebrew ? "Delete Bone Marrow Studies" : "Delete Bone Marrow Studies",
        deleteBoneMarrowStudy: isHebrew ? "Delete Bone Marrow Study" : "Delete Bone Marrow Study",
        deleteBoneScanReport: isHebrew ? "Delete bone scan report" : "Delete bone scan report",
        deleteBoneScanReports: isHebrew ? "Delete Bone Scan Reports" : "Delete Bone Scan Reports",
        deleteBrainTumorCharacteristic: isHebrew ? "Remove Brain Tumor" : "Remove Brain Tumor",
        deleteBrainTumorCharacteristics: isHebrew ? "Delete Brain Tumor Characteristics" : "Delete Brain Tumor Characteristics",
        deleteBrainTumorMolecularMarker: isHebrew ? "Delete Brain Tumor Molecular Marker" : "Delete Brain Tumor Molecular Marker",
        deleteBrainTumorMolecularMarkers: isHebrew ? "Delete Brain Tumor Molecular Markers" : "Delete Brain Tumor Molecular Markers",
        deleteBreastfeedingRecommendation: isHebrew ? "Delete Breastfeeding Recommendation" : "Delete Breastfeeding Recommendation",
        deleteCamIcu: isHebrew ? "Delete Cam Icu" : "Delete Cam Icu",
        deleteCancerDiagnosi: isHebrew ? "Delete Cancer Diagnosi" : "Delete Cancer Diagnosi",
        deleteCancerDiagnosis: isHebrew ? "Delete Cancer Diagnosis" : "Delete Cancer Diagnosis",
        deleteCancerRelatedSideEffect: isHebrew ? "Delete Cancer Related Side Effect" : "Delete Cancer Related Side Effect",
        deleteCancerRelatedSideEffects: isHebrew ? "Delete Cancer Related Side Effects" : "Delete Cancer Related Side Effects",
        deleteCancerScreeningRecords: isHebrew ? "Delete Cancer Screening Records" : "Delete Cancer Screening Records",
        deleteCancerStaging: isHebrew ? "Delete Cancer Staging" : "Delete Cancer Staging",
        deleteCancerSurveillance: isHebrew ? "Delete Cancer Surveillance" : "Delete Cancer Surveillance",
        deleteCarbohydrateCountingEducation: isHebrew ? "Delete Carbohydrate Counting Education" : "Delete Carbohydrate Counting Education",
        deleteCardiacCatheterizationReport: isHebrew ? "Delete Cardiac Report" : "Delete Cardiac Report",
        deleteCardiacCatheterizationReports: isHebrew ? "Delete Cardiac Catheterization Reports" : "Delete Cardiac Catheterization Reports",
        deleteCardiacDeviceInterrogation: isHebrew ? "Delete Cardiac Device Interrogation" : "Delete Cardiac Device Interrogation",
        deleteCardiacDeviceInterrogations: isHebrew ? "Delete Cardiac Device Interrogations" : "Delete Cardiac Device Interrogations",
        deleteCardiacMonitoring: isHebrew ? "Delete Cardiac Monitoring Record" : "Delete Cardiac Monitoring Record",
        deleteCardiacRehabilitationReport: isHebrew ? "Delete Cardiac Report" : "Delete Cardiac Report",
        deleteCardiacRehabilitationReports: isHebrew ? "Delete Cardiac Rehabilitation Reports" : "Delete Cardiac Rehabilitation Reports",
        deleteCardiologyAdmissionNote: isHebrew ? "Delete Cardiology Note" : "Delete Cardiology Note",
        deleteCardiologyAdmissionNotes: isHebrew ? "Delete Cardiology Admission Notes" : "Delete Cardiology Admission Notes",
        deleteCardiologyAssessment: isHebrew ? "Delete Cardiology Assessment" : "Delete Cardiology Assessment",
        deleteCardiologyConsultation: isHebrew ? "Remove cardiology consultation" : "Remove cardiology consultation",
        deleteCardiologyConsultations: isHebrew ? "Delete Cardiology Consultations" : "Delete Cardiology Consultations",
        deleteCardiologyFollowupReport: isHebrew ? "Delete Cardiology Report" : "Delete Cardiology Report",
        deleteCardiologyFollowupReports: isHebrew ? "Delete Cardiology Followup Reports" : "Delete Cardiology Followup Reports",
        deleteCardiovascularRiskReduction: isHebrew ? "Delete Cardiovascular Risk Reduction" : "Delete Cardiovascular Risk Reduction",
        deleteCardiovascularRiskScreening: isHebrew ? "Delete Cardiovascular Risk Screening" : "Delete Cardiovascular Risk Screening",
        deleteCareCoordination: isHebrew ? "Delete Care Coordination" : "Delete Care Coordination",
        deleteCareCoordinationNote: isHebrew ? "Delete Care Note" : "Delete Care Note",
        deleteCareCoordinationNotes: isHebrew ? "Delete Care Coordination Notes" : "Delete Care Coordination Notes",
        deleteCareGap: isHebrew ? "Remove Care Gap" : "Remove Care Gap",
        deleteCareGaps: isHebrew ? "Delete Care Gaps" : "Delete Care Gaps",
        deleteCaregiverSupportGroups: isHebrew ? "Delete Caregiver Support Groups" : "Delete Caregiver Support Groups",
        deleteCareTeam: isHebrew ? "Delete Care Team" : "Delete Care Team",
        deleteCareTeamInfo: isHebrew ? "Delete Care Team Info" : "Delete Care Team Info",
        deleteCaregiverAssessment: isHebrew ? "Delete Caregiver Assessment" : "Delete Caregiver Assessment",
        deleteCaregiverSupport: isHebrew ? "Delete Caregiver Support" : "Delete Caregiver Support",
        deleteCaregiverSupportGroup: isHebrew ? "Delete Caregiver Support Group" : "Delete Caregiver Support Group",
        deleteCascadeTestingProtocol: isHebrew ? "Delete Cascade Testing Protocol" : "Delete Cascade Testing Protocol",
        deleteCaseManagement: isHebrew ? "Delete Case Management" : "Delete Case Management",
        deleteCaseSummaries: isHebrew ? "Delete Case Summaries" : "Delete Case Summaries",
        deleteCaseSummary: isHebrew ? "Delete Case Summary" : "Delete Case Summary",
        deleteCellFreeDnaResult: isHebrew ? "Delete Cell Free Dna Result" : "Delete Cell Free Dna Result",
        deleteCervicalAssessment: isHebrew ? "Delete Cervical Assessment" : "Delete Cervical Assessment",
        deleteCervicalLengthMeasurement: isHebrew ? "Delete Cervical Length Measurement" : "Delete Cervical Length Measurement",
        deleteCesareanThreshold: isHebrew ? "Delete Cesarean Threshold" : "Delete Cesarean Threshold",
        deleteCgmData: isHebrew ? "Delete Cgm Data" : "Delete Cgm Data",
        deleteChallengeTest: isHebrew ? "Delete Challenge Test" : "Delete Challenge Test",
        deleteChallengeTests: isHebrew ? "Delete Challenge Tests" : "Delete Challenge Tests",
        deleteChemotherapyRecord: isHebrew ? "Delete Cancer Treatment" : "Delete Cancer Treatment",
        deleteChemotherapyRecords: isHebrew ? "Delete Chemotherapy Records" : "Delete Chemotherapy Records",
        deleteChemotherapyRegimen: isHebrew ? "Delete Chemotherapy Regimen" : "Delete Chemotherapy Regimen",
        deleteChiefComplaint: isHebrew ? "Delete Chief Complaint" : "Delete Chief Complaint",
        deleteChiefComplaints: isHebrew ? "Delete Chief Complaints" : "Delete Chief Complaints",
        deleteChildrenSpecificRisk: isHebrew ? "Delete Children Specific Risk" : "Delete Children Specific Risk",
        deleteChronicDiseaseGoals: isHebrew ? "Delete Chronic Disease Goals" : "Delete Chronic Disease Goals",
        deleteChronicDiseaseManagement: isHebrew ? "Delete Chronic Disease Management" : "Delete Chronic Disease Management",
        deleteChronicPainAssessment: isHebrew ? "Delete Chronic Pain Assessment" : "Delete Chronic Pain Assessment",
        deleteCkdAssessment: isHebrew ? "Delete Ckd Assessment" : "Delete Ckd Assessment",
        deleteCkdManagement: isHebrew ? "Delete Ckd Management" : "Delete Ckd Management",
        deleteClinicalDecisionSupport: isHebrew ? "Remove Clinical Support" : "Remove Clinical Support",
        deleteClinicalRiskScore: isHebrew ? "Delete Clinical Risk Score" : "Delete Clinical Risk Score",
        deleteClinicalRiskScores: isHebrew ? "Delete Clinical Risk Scores" : "Delete Clinical Risk Scores",
        deleteClinicalScore: isHebrew ? "Delete clinical score" : "Delete clinical score",
        deleteClinicalScores: isHebrew ? "Delete Clinical Scores" : "Delete Clinical Scores",
        deleteClinicalTrial: isHebrew ? "Delete Clinical Trial" : "Delete Clinical Trial",
        deleteClinicalTrialDocument: isHebrew ? "Delete Clinical Trial Document" : "Delete Clinical Trial Document",
        deleteClinicalTrialDocuments: isHebrew ? "Delete Clinical Trial Documents" : "Delete Clinical Trial Documents",
        deleteClinicalTrials: isHebrew ? "Delete Clinical Trials" : "Delete Clinical Trials",
        deleteClosureTechnique: isHebrew ? "Delete Closure Technique" : "Delete Closure Technique",
        deleteCmvMonitoringPlan: isHebrew ? "Delete Cmv Monitoring Plan" : "Delete Cmv Monitoring Plan",
        deleteCoagulationStudies: isHebrew ? "Delete Coagulation Studies" : "Delete Coagulation Studies",
        deleteCoagulationStudy: isHebrew ? "Remove Coagulation Test" : "Remove Coagulation Test",
        deleteCodeBlueSummaries: isHebrew ? "Delete Code Blue Summaries" : "Delete Code Blue Summaries",
        deleteCodeBlueSummary: isHebrew ? "Remove Code Blue Summary" : "Remove Code Blue Summary",
        deleteCognitiveEvaluation: isHebrew ? "Delete cognitive evaluation" : "Delete cognitive evaluation",
        deleteCognitiveEvaluations: isHebrew ? "Delete Cognitive Evaluations" : "Delete Cognitive Evaluations",
        deleteCognitiveRehabilitationReport: isHebrew ? "Delete Cognitive Report" : "Delete Cognitive Report",
        deleteCognitiveRehabilitationReports: isHebrew ? "Delete Cognitive Rehabilitation Reports" : "Delete Cognitive Rehabilitation Reports",
        deleteCognitiveScreening: isHebrew ? "Delete Cognitive Screening" : "Delete Cognitive Screening",
        deleteColonoscopyReport: isHebrew ? "Delete colonoscopy report" : "Delete colonoscopy report",
        deleteColonoscopyReports: isHebrew ? "Delete Colonoscopy Reports" : "Delete Colonoscopy Reports",
        deleteColorectalColonoscopies: isHebrew ? "Delete Colorectal Colonoscopies" : "Delete Colorectal Colonoscopies",
        deleteColorectalColonoscopy: isHebrew ? "Remove Colon Screening" : "Remove Colon Screening",
        deleteColorectalSurgeryAssessment: isHebrew ? "Delete Colorectal Surgery Assessment" : "Delete Colorectal Surgery Assessment",
        deleteColorectalSurgeryConsultation: isHebrew ? "Remove colorectal consultation" : "Remove colorectal consultation",
        deleteColorectalSurgeryConsultations: isHebrew ? "Delete Colorectal Surgery Consultations" : "Delete Colorectal Surgery Consultations",
        deleteCommunicationPreference: isHebrew ? "Delete Communication Preference" : "Delete Communication Preference",
        deleteCommunicationPreferences: isHebrew ? "Delete Communication Preferences" : "Delete Communication Preferences",
        deleteComplication: isHebrew ? "Delete Complication" : "Delete Complication",
        deleteComplications: isHebrew ? "Delete Complications" : "Delete Complications",
        deleteComponentAllergenTesting: isHebrew ? "Delete Component Allergen Testing" : "Delete Component Allergen Testing",
        deleteComprehensiveCardiomyopathyPanel: isHebrew ? "Delete Comprehensive Cardiomyopathy Panel" : "Delete Comprehensive Cardiomyopathy Panel",
        deleteCompressionTherapy: isHebrew ? "Delete Compression Therapy" : "Delete Compression Therapy",
        deleteConcussionAssessment: isHebrew ? "Delete Concussion Assessment" : "Delete Concussion Assessment",
        deleteConnectiveTissueDiseaseAssessment: isHebrew ? "Delete Connective Tissue Disease Assessment" : "Delete Connective Tissue Disease Assessment",
        deleteConsultationDetail: isHebrew ? "Delete Consultation Detail" : "Delete Consultation Detail",
        deleteConsultationDetails: isHebrew ? "Delete Consultation Details" : "Delete Consultation Details",
        deleteConsultationNote: isHebrew ? "Delete Consultation Note" : "Delete Consultation Note",
        deleteConsultationNotes: isHebrew ? "Delete consultation note" : "Delete consultation note",
        deleteConsultationRequests: isHebrew ? "Delete Consultation Requests" : "Delete Consultation Requests",
        deleteConsultationTimeline: isHebrew ? "Delete Consultation Timeline" : "Delete Consultation Timeline",
        deleteContinuousGlucoseMonitor: isHebrew ? "Delete Continuous Glucose Monitor" : "Delete Continuous Glucose Monitor",
        deleteContinuousGlucoseMonitorDiscussion: isHebrew ? "Delete Continuous Glucose Monitor Discussion" : "Delete Continuous Glucose Monitor Discussion",
        deleteContinuousInfusion: isHebrew ? "Delete Continuous Infusion" : "Delete Continuous Infusion",
        deleteContinuousInfusions: isHebrew ? "Delete Continuous Infusions" : "Delete Continuous Infusions",
        deleteContractionMonitoring: isHebrew ? "Delete Contraction Monitoring" : "Delete Contraction Monitoring",
        deleteCopdAssessment: isHebrew ? "Delete COPD assessment" : "Delete COPD assessment",
        deleteCopdAssessments: isHebrew ? "Delete Copd Assessments" : "Delete Copd Assessments",
        deleteCpapManagement: isHebrew ? "Delete Cpap Management" : "Delete Cpap Management",
        deleteCriticalViewOfSafety: isHebrew ? "Delete Critical View Of Safety" : "Delete Critical View Of Safety",
        deleteCulturalConsideration: isHebrew ? "Delete Cultural Consideration" : "Delete Cultural Consideration",
        deleteCulturalConsiderations: isHebrew ? "Delete Cultural Considerations" : "Delete Cultural Considerations",
        deleteCurrentDialysi: isHebrew ? "Delete Current Dialysi" : "Delete Current Dialysi",
        deleteCurrentDialysis: isHebrew ? "Delete Current Dialysis" : "Delete Current Dialysis",
        deleteCurrentPregnancy: isHebrew ? "Delete Current Pregnancy" : "Delete Current Pregnancy",
        deleteCystoscopyReport: isHebrew ? "Delete Cystoscopy Report" : "Delete Cystoscopy Report",
        deleteCystoscopyReports: isHebrew ? "Delete Cystoscopy Reports" : "Delete Cystoscopy Reports",
        deleteCytogenetic: isHebrew ? "Delete Cytogenetic" : "Delete Cytogenetic",
        deleteCytogenetics: isHebrew ? "Delete Cytogenetics" : "Delete Cytogenetics",
        deleteCytologyReport: isHebrew ? "Delete cytology report" : "Delete cytology report",
        deleteCytologyReports: isHebrew ? "Delete Cytology Reports" : "Delete Cytology Reports",
        deleteDataManagementInstruction: isHebrew ? "Delete Data Management Instruction" : "Delete Data Management Instruction",
        deleteDataManagementInstructions: isHebrew ? "Delete Data Management Instructions" : "Delete Data Management Instructions",
        deleteDayProgram: isHebrew ? "Delete Day Program" : "Delete Day Program",
        deleteDayPrograms: isHebrew ? "Delete Day Programs" : "Delete Day Programs",
        deleteDaytimeSleepinessAssessment: isHebrew ? "Delete Daytime Sleepiness Assessment" : "Delete Daytime Sleepiness Assessment",
        deleteDeepBrainStimulation: isHebrew ? "Delete Deep Brain Stimulation" : "Delete Deep Brain Stimulation",
        deleteDeliveryPlanning: isHebrew ? "Delete Delivery Planning" : "Delete Delivery Planning",
        deleteDementiaAssessment: isHebrew ? "Delete Dementia Assessment" : "Delete Dementia Assessment",
        deleteDementiaEducation: isHebrew ? "Delete Dementia Education" : "Delete Dementia Education",
        deleteDentalExaminationReport: isHebrew ? "Delete dental report" : "Delete dental report",
        deleteDentalExaminationReports: isHebrew ? "Delete Dental Examination Reports" : "Delete Dental Examination Reports",
        deleteDepartment: isHebrew ? "Delete Department" : "Delete Department",
        deleteDepressionScreening: isHebrew ? "Delete Depression Screening" : "Delete Depression Screening",
        deleteDermatologyAssessment: isHebrew ? "Delete Dermatology Assessment" : "Delete Dermatology Assessment",
        deleteDermatologyConsultation: isHebrew ? "Delete Dermatology Consultation" : "Delete Dermatology Consultation",
        deleteDermatologyConsultations: isHebrew ? "Delete Dermatology Consultations" : "Delete Dermatology Consultations",
        deleteDermatologyProcedureNote: isHebrew ? "Delete Dermatology Note" : "Delete Dermatology Note",
        deleteDermatologyProcedureNotes: isHebrew ? "Delete Dermatology Procedure Notes" : "Delete Dermatology Procedure Notes",
        deleteDetailedFamilyPedigree: isHebrew ? "Delete Detailed Family Pedigree" : "Delete Detailed Family Pedigree",
        deleteDevelopmentalAssessment: isHebrew ? "Delete developmental assessment" : "Delete developmental assessment",
        deleteDevelopmentalAssessments: isHebrew ? "Delete Developmental Assessments" : "Delete Developmental Assessments",
        deleteDevelopmentalMilestone: isHebrew ? "Delete Developmental Milestone" : "Delete Developmental Milestone",
        deleteDevelopmentalMilestones: isHebrew ? "Delete Developmental Milestones" : "Delete Developmental Milestones",
        deleteDexaScanReport: isHebrew ? "Delete DEXA scan report" : "Delete DEXA scan report",
        deleteDexaScanReports: isHebrew ? "Delete Dexa Scan Reports" : "Delete Dexa Scan Reports",
        deleteDiabetesEducation: isHebrew ? "Delete Diabetes Education" : "Delete Diabetes Education",
        deleteDiabetesEducator: isHebrew ? "Delete Diabetes Educator" : "Delete Diabetes Educator",
        deleteDiabetesEducatorTraining: isHebrew ? "Delete Diabetes Educator Training" : "Delete Diabetes Educator Training",
        deleteDiabetesManagement: isHebrew ? "Delete Diabetes Management" : "Delete Diabetes Management",
        deleteDiabetesManagementNote: isHebrew ? "Delete Diabetes Note" : "Delete Diabetes Note",
        deleteDiabetesManagementNotes: isHebrew ? "Delete Diabetes Management Notes" : "Delete Diabetes Management Notes",
        deleteDiabetesManagementPlan: isHebrew ? "Delete Diabetes Management Plan" : "Delete Diabetes Management Plan",
        deleteDiabetesQualityMetric: isHebrew ? "Delete Diabetes Quality Metric" : "Delete Diabetes Quality Metric",
        deleteDiabetesQualityMetrics: isHebrew ? "Delete Diabetes Quality Metrics" : "Delete Diabetes Quality Metrics",
        deleteDiabetesSupplies: isHebrew ? "Delete Diabetes Supplies" : "Delete Diabetes Supplies",
        deleteDiabetesSupply: isHebrew ? "Delete Diabetes Supply" : "Delete Diabetes Supply",
        deleteDiabeticNephropathy: isHebrew ? "Delete Diabetic Nephropathy" : "Delete Diabetic Nephropathy",
        deleteDiagnos: isHebrew ? "Delete Diagnosis Record" : "Delete Diagnosis Record",
        deleteDiagnoses: isHebrew ? "Delete Diagnoses" : "Delete Diagnoses",
        deleteDiagnosis: isHebrew ? "מחק אבחנה" : "Delete diagnosis",
        deleteDiagnosticImpression: isHebrew ? "Delete Diagnostic Impression" : "Delete Diagnostic Impression",
        deleteDiagnosticStudies: isHebrew ? "Delete Diagnostic Studies" : "Delete Diagnostic Studies",
        deleteDiagnosticStudy: isHebrew ? "Delete Diagnostic Study" : "Delete Diagnostic Study",
        deleteDialysateComposition: isHebrew ? "Delete Dialysate Composition" : "Delete Dialysate Composition",
        deleteDialysisPlanning: isHebrew ? "Delete Dialysis Planning" : "Delete Dialysis Planning",
        deleteDialysisPrescription: isHebrew ? "Delete Dialysis Prescription" : "Delete Dialysis Prescription",
        deleteDialysisRecord: isHebrew ? "Delete dialysis record" : "Delete dialysis record",
        deleteDialysisRecords: isHebrew ? "Delete Dialysis Records" : "Delete Dialysis Records",
        deleteDialysisRunSheet: isHebrew ? "Delete Dialysis Record" : "Delete Dialysis Record",
        deleteDialysisRunSheets: isHebrew ? "Delete Dialysis Run Sheets" : "Delete Dialysis Run Sheets",
        deleteDialyzer: isHebrew ? "Delete Dialyzer" : "Delete Dialyzer",
        deleteDietaryIntervention: isHebrew ? "Delete Dietary Intervention" : "Delete Dietary Intervention",
        deleteDietaryInterventions: isHebrew ? "Delete Dietary Interventions" : "Delete Dietary Interventions",
        deleteDisabilityEvaluation: isHebrew ? "Remove disability assessment" : "Remove disability assessment",
        deleteDisabilityEvaluations: isHebrew ? "Delete Disability Evaluations" : "Delete Disability Evaluations",
        deleteDischargePlanning: isHebrew ? "Delete Discharge Planning" : "Delete Discharge Planning",
        deleteDischargeSummaries: isHebrew ? "Delete Discharge Summary" : "Delete Discharge Summary",
        deleteDischargeSummary: isHebrew ? "Delete Discharge Summary" : "Delete Discharge Summary",
        deleteDiseaseActivityScore: isHebrew ? "Delete Disease Activity Score" : "Delete Disease Activity Score",
        deleteDiseaseActivityScores: isHebrew ? "Delete Disease Activity Scores" : "Delete Disease Activity Scores",
        deleteDiseaseSeverity: isHebrew ? "Delete Disease Severity" : "Delete Disease Severity",
        deleteDnrOrder: isHebrew ? "Cancel donor request" : "Cancel donor request",
        deleteDnrOrders: isHebrew ? "Delete Dnr Orders" : "Delete Dnr Orders",
        deleteDoctorsMedicationRecommendation: isHebrew ? "Delete Doctors Medication Recommendation" : "Delete Doctors Medication Recommendation",
        deleteDoctorsMedicationRecommendations: isHebrew ? "Delete Doctors Medication Recommendations" : "Delete Doctors Medication Recommendations",
        deleteDoctorsMedicationsRecommendation: isHebrew ? "Delete Doctors Medications Recommendation" : "Delete Doctors Medications Recommendation",
        deleteDoctorsMedicationsRecommendations: isHebrew ? "Delete Doctors Medications Recommendations" : "Delete Doctors Medications Recommendations",
        deleteDoctorsMedicationsRecommendationsOptimization: isHebrew ? "Delete Doctors Medications Recommendations Optimization" : "Delete Doctors Medications Recommendations Optimization",
        deleteDoctorsMedicationsRecommendationsOptimizations: isHebrew ? "Delete Doctors Medications Recommendations Optimizations" : "Delete Doctors Medications Recommendations Optimizations",
        deleteDocument: isHebrew ? "מחק מסמך" : "Delete document",
        deleteDocumentMetadata: isHebrew ? "Delete Document Metadata" : "Delete Document Metadata",
        deleteDocumentType: isHebrew ? "Delete Document Type" : "Delete Document Type",
        deleteDownloadGlucometer: isHebrew ? "Delete Download Glucometer" : "Delete Download Glucometer",
        deleteDurableMedicalEquipmentOrders: isHebrew ? "Delete Durable Medical Equipment Orders" : "Delete Durable Medical Equipment Orders",
        deleteDvtProphylaxi: isHebrew ? "Delete Dvt Prophylaxi" : "Delete Dvt Prophylaxi",
        deleteDvtProphylaxis: isHebrew ? "Delete Dvt Prophylaxis" : "Delete Dvt Prophylaxis",
        deleteEarlyChildhoodDevelopment: isHebrew ? "Delete Early Childhood Development" : "Delete Early Childhood Development",
        deleteEarlyMaternityLeave: isHebrew ? "Delete Early Maternity Leave" : "Delete Early Maternity Leave",
        deleteEcgReport: isHebrew ? "Delete ECG report" : "Delete ECG report",
        deleteEcgReports: isHebrew ? "Delete Ecg Reports" : "Delete Ecg Reports",
        deleteEchoReport: isHebrew ? "Delete Echo Report" : "Delete Echo Report",
        deleteEchoReports: isHebrew ? "Delete Echo Reports" : "Delete Echo Reports",
        deleteEdCourse: isHebrew ? "Delete Ed Course" : "Delete Ed Course",
        deleteEdDisposition: isHebrew ? "Delete Ed Disposition" : "Delete Ed Disposition",
        deleteEdTriageAssessment: isHebrew ? "Delete Ed Triage Assessment" : "Delete Ed Triage Assessment",
        deleteEducationInitiated: isHebrew ? "Delete Education Initiated" : "Delete Education Initiated",
        deleteEegReport: isHebrew ? "Delete EEG Report" : "Delete EEG Report",
        deleteEegReports: isHebrew ? "Delete Eeg Reports" : "Delete Eeg Reports",
        deleteElderAbuseScreening: isHebrew ? "Delete Elder Abuse Screening" : "Delete Elder Abuse Screening",
        deleteEmergencyAirwayManagement: isHebrew ? "Delete Emergency Airway Management" : "Delete Emergency Airway Management",
        deleteEmergencyAssessment: isHebrew ? "Delete Emergency Assessment" : "Delete Emergency Assessment",
        deleteEmergencyDischargeSummaries: isHebrew ? "Delete Emergency Discharge Summaries" : "Delete Emergency Discharge Summaries",
        deleteEmergencyDischargeSummary: isHebrew ? "Remove Emergency Discharge" : "Remove Emergency Discharge",
        deleteEmergencyDisposition: isHebrew ? "Delete Emergency Disposition" : "Delete Emergency Disposition",
        deleteEmergencyInformation: isHebrew ? "Delete Emergency Information" : "Delete Emergency Information",
        deleteEmergencyObservationUnit: isHebrew ? "Delete Emergency Observation Unit" : "Delete Emergency Observation Unit",
        deleteEmergencyProcedures: isHebrew ? "Delete Emergency Procedures" : "Delete Emergency Procedures",
        deleteEmergencyReport: isHebrew ? "Delete Emergency Report" : "Delete Emergency Report",
        deleteEmergencyReports: isHebrew ? "Delete Emergency Reports" : "Delete Emergency Reports",
        deleteEmgReport: isHebrew ? "Delete Emergency Report" : "Delete Emergency Report",
        deleteEmgReports: isHebrew ? "Delete Emg Reports" : "Delete Emg Reports",
        deleteEmploymentCounseling: isHebrew ? "Delete Employment Counseling" : "Delete Employment Counseling",
        deleteEmsRunReport: isHebrew ? "Delete EMR Report" : "Delete EMR Report",
        deleteEmsRunReports: isHebrew ? "Delete Ems Run Reports" : "Delete Ems Run Reports",
        deleteEndocrineLabResult: isHebrew ? "Delete Endocrine Lab Result" : "Delete Endocrine Lab Result",
        deleteEndocrineLabResults: isHebrew ? "Delete Endocrine Lab Results" : "Delete Endocrine Lab Results",
        deleteEndocrineTherapy: isHebrew ? "Delete Endocrine Therapy" : "Delete Endocrine Therapy",
        deleteEndocrinologyAssessment: isHebrew ? "Delete Endocrinology Assessment" : "Delete Endocrinology Assessment",
        deleteEndocrinologyConsultation: isHebrew ? "Delete Endocrinology Consultation" : "Delete Endocrinology Consultation",
        deleteEndocrinologyConsultations: isHebrew ? "Delete Endocrinology Consultations" : "Delete Endocrinology Consultations",
        deleteEndoscopyFinding: isHebrew ? "Delete Endoscopy Finding" : "Delete Endoscopy Finding",
        deleteEndoscopyFindings: isHebrew ? "Delete Endoscopy Findings" : "Delete Endoscopy Findings",
        deleteEndoscopyReport: isHebrew ? "Delete Endoscopy Report" : "Delete Endoscopy Report",
        deleteEndoscopyReports: isHebrew ? "Delete Endoscopy Reports" : "Delete Endoscopy Reports",
        deleteEntAssessment: isHebrew ? "Delete Ent Assessment" : "Delete Ent Assessment",
        deleteEntConsultation: isHebrew ? "Delete Consultation Record" : "Delete Consultation Record",
        deleteEntConsultations: isHebrew ? "Delete Ent Consultations" : "Delete Ent Consultations",
        deleteEnvironmentalExposure: isHebrew ? "Delete Environmental Exposure" : "Delete Environmental Exposure",
        deleteEnvironmentalExposures: isHebrew ? "Delete Environmental Exposures" : "Delete Environmental Exposures",
        deleteEpilepsyAssessment: isHebrew ? "Delete Epilepsy Assessment" : "Delete Epilepsy Assessment",
        deleteErgonomicAssessment: isHebrew ? "Delete Ergonomic Assessment" : "Delete Ergonomic Assessment",
        deleteEstimatedBloodLoss: isHebrew ? "Delete Estimated Blood Loss" : "Delete Estimated Blood Loss",
        deleteEstimatedDeliveryDate: isHebrew ? "Delete Estimated Delivery Date" : "Delete Estimated Delivery Date",
        deleteEstimatedTimeToDialysi: isHebrew ? "Delete Estimated Time To Dialysi" : "Delete Estimated Time To Dialysi",
        deleteEstimatedTimeToDialysis: isHebrew ? "Delete Estimated Time To Dialysis" : "Delete Estimated Time To Dialysis",
        deleteExcessiveGlucoseMonitoring: isHebrew ? "Delete Excessive Glucose Monitoring" : "Delete Excessive Glucose Monitoring",
        deleteExercisePrescription: isHebrew ? "Delete Exercise Prescription" : "Delete Exercise Prescription",
        deleteExerciseProgram: isHebrew ? "Delete Exercise Program" : "Delete Exercise Program",
        deleteExerciseRecommendation: isHebrew ? "Delete Exercise Recommendation" : "Delete Exercise Recommendation",
        deleteExerciseRecommendations: isHebrew ? "Delete Exercise Recommendations" : "Delete Exercise Recommendations",
        deleteExtendedFamilyHistory: isHebrew ? "Delete Extended Family History" : "Delete Extended Family History",
        deleteExtraintestinalManifestation: isHebrew ? "Delete Extraintestinal Manifestation" : "Delete Extraintestinal Manifestation",
        deleteExtraintestinalManifestations: isHebrew ? "Delete Extraintestinal Manifestations" : "Delete Extraintestinal Manifestations",
        deleteFacility: isHebrew ? "Delete Facility" : "Delete Facility",
        deleteFallPreventionEducation: isHebrew ? "Delete Fall Prevention Education" : "Delete Fall Prevention Education",
        deleteFallRiskAssessment: isHebrew ? "Delete Fall Risk" : "Delete Fall Risk",
        deleteFallRiskAssessments: isHebrew ? "Delete Fall Risk Assessments" : "Delete Fall Risk Assessments",
        deleteFallsPreventionProgramAssessment: isHebrew ? "Delete Falls Prevention Program Assessment" : "Delete Falls Prevention Program Assessment",
        deleteFamilyHistory: isHebrew ? "Delete Family History" : "Delete Family History",
        deleteFamilyMedicineAssessment: isHebrew ? "Delete Family Medicine Assessment" : "Delete Family Medicine Assessment",
        deleteFamilyMeetingDecision: isHebrew ? "Delete Family Meeting Decision" : "Delete Family Meeting Decision",
        deleteFamilyMeetingDecisions: isHebrew ? "Delete Family Meeting Decisions" : "Delete Family Meeting Decisions",
        deleteFamilyMeetingNote: isHebrew ? "Delete Family Meeting Note" : "Delete Family Meeting Note",
        deleteFamilyMeetingNotes: isHebrew ? "Delete Family Meeting Notes" : "Delete Family Meeting Notes",
        deleteFecalCalprotectin: isHebrew ? "Delete Fecal Calprotectin" : "Delete Fecal Calprotectin",
        deleteFertilityTracking: isHebrew ? "Delete Fertility Tracking" : "Delete Fertility Tracking",
        deleteFetalAssessment: isHebrew ? "Delete Fetal Assessment" : "Delete Fetal Assessment",
        deleteFetalEcho: isHebrew ? "Delete Fetal Echo" : "Delete Fetal Echo",
        deleteFetalEchoResult: isHebrew ? "Delete Fetal Echo Result" : "Delete Fetal Echo Result",
        deleteFetalEchoResults: isHebrew ? "Delete Fetal Echo Results" : "Delete Fetal Echo Results",
        deleteFetalSurveillance: isHebrew ? "Delete Fetal Surveillance" : "Delete Fetal Surveillance",
        deleteFetalUltrasound: isHebrew ? "Delete Fetal Ultrasound" : "Delete Fetal Ultrasound",
        deleteFirstTrimesterBleeding: isHebrew ? "Delete First Trimester Bleeding" : "Delete First Trimester Bleeding",
        deleteFirstTrimesterScreenResult: isHebrew ? "Delete First Trimester Screen Result" : "Delete First Trimester Screen Result",
        deleteFitnessForDutyEvaluation: isHebrew ? "Remove Fitness Evaluation" : "Remove Fitness Evaluation",
        deleteFitnessForDutyEvaluations: isHebrew ? "Delete Fitness For Duty Evaluations" : "Delete Fitness For Duty Evaluations",
        deleteFlareManagement: isHebrew ? "Delete Flare Management" : "Delete Flare Management",
        deleteFlowCytometryReport: isHebrew ? "Delete Flow Report" : "Delete Flow Report",
        deleteFlowCytometryReports: isHebrew ? "Delete Flow Cytometry Reports" : "Delete Flow Cytometry Reports",
        deleteFluidElectrolyteManagement: isHebrew ? "Delete Fluid Electrolyte Management" : "Delete Fluid Electrolyte Management",
        deleteFluidIntake: isHebrew ? "Delete Fluid Intake" : "Delete Fluid Intake",
        deleteFluidOutput: isHebrew ? "Delete Fluid Output" : "Delete Fluid Output",
        deleteFmlaDocumentationNote: isHebrew ? "Delete Fmla Documentation Note" : "Delete Fmla Documentation Note",
        deleteFollowUp: isHebrew ? "Delete Follow Up" : "Delete Follow Up",
        deleteFollowUpAppointment: isHebrew ? "Cancel follow-up appointment" : "Cancel follow-up appointment",
        deleteFollowUpAppointments: isHebrew ? "Delete Follow Up Appointments" : "Delete Follow Up Appointments",
        deleteFollowUpEnhanced: isHebrew ? "Delete Follow Up Enhanced" : "Delete Follow Up Enhanced",
        deleteFollowUpIntelligence: isHebrew ? "Remove Follow-up Intelligence" : "Remove Follow-up Intelligence",
        deleteFollowUpPlan: isHebrew ? "Delete Follow Up Plan" : "Delete Follow Up Plan",
        deleteFollowUps: isHebrew ? "Delete Follow Ups" : "Delete Follow Ups",
        deleteFoodInsecurity: isHebrew ? "Delete Food Insecurity" : "Delete Food Insecurity",
        deleteFootExam: isHebrew ? "Delete Foot Exam" : "Delete Foot Exam",
        deleteFrailtyAssessment: isHebrew ? "Delete Frailty Assessment" : "Delete Frailty Assessment",
        deleteFullMedicalReport: isHebrew ? "מחק דוח מלא" : "Delete full report",
        deleteFunctionalAssessment: isHebrew ? "Delete Functional Assessment" : "Delete Functional Assessment",
        deleteFunctionalAssessments: isHebrew ? "Delete Functional Assessments" : "Delete Functional Assessments",
        deleteFunctionalMriStudies: isHebrew ? "Delete Functional Mri Studies" : "Delete Functional Mri Studies",
        deleteFunctionalMriStudy: isHebrew ? "Delete MRI Study" : "Delete MRI Study",
        deleteFunctionalStatu: isHebrew ? "Delete Functional Statu" : "Delete Functional Statu",
        deleteFunctionalStatus: isHebrew ? "Delete Functional Status" : "Delete Functional Status",
        deleteGaitAnalysi: isHebrew ? "Delete Gait Analysi" : "Delete Gait Analysi",
        deleteGaitAnalysis: isHebrew ? "Delete Gait Analysis" : "Delete Gait Analysis",
        deleteGastroenterologyConsultation: isHebrew ? "Delete Gastroenterology Consultation" : "Delete Gastroenterology Consultation",
        deleteGastroenterologyConsultations: isHebrew ? "Delete Gastroenterology Consultations" : "Delete Gastroenterology Consultations",
        deleteGdmRecurrenceRisk: isHebrew ? "Delete Gdm Recurrence Risk" : "Delete Gdm Recurrence Risk",
        deleteGeneticOncology: isHebrew ? "Delete Genetic Oncology" : "Delete Genetic Oncology",
        deleteGeneticTestingReport: isHebrew ? "Delete genetic report" : "Delete genetic report",
        deleteGeneticsPsychosocialAssessment: isHebrew ? "Delete Genetics Psychosocial Assessment" : "Delete Genetics Psychosocial Assessment",
        deleteGeneticTestingReports: isHebrew ? "Delete Genetic Testing Reports" : "Delete Genetic Testing Reports",
        deleteGeriatricAssessment: isHebrew ? "Remove Elderly Assessment" : "Remove Elderly Assessment",
        deleteGeriatricAssessments: isHebrew ? "Delete Geriatric Assessments" : "Delete Geriatric Assessments",
        deleteGeriatricCognitiveAssessment: isHebrew ? "Delete Geriatric Cognitive Assessment" : "Delete Geriatric Cognitive Assessment",
        deleteGeriatricMedication: isHebrew ? "Delete Geriatric Medication" : "Delete Geriatric Medication",
        deleteGeriatricMedications: isHebrew ? "Delete Geriatric Medications" : "Delete Geriatric Medications",
        deleteGeriatricNutritionalAssessment: isHebrew ? "Delete Geriatric Nutritional Assessment" : "Delete Geriatric Nutritional Assessment",
        deleteGestationalDiabete: isHebrew ? "Delete Gestational Diabete" : "Delete Gestational Diabete",
        deleteGestationalDiabetes: isHebrew ? "Delete Gestational Diabetes" : "Delete Gestational Diabetes",
        deleteGiRiskAssessment: isHebrew ? "Delete Risk Assessment" : "Delete Risk Assessment",
        deleteGlasgowComaScale: isHebrew ? "Delete Glasgow Coma Scale" : "Delete Glasgow Coma Scale",
        deleteGlaucomaAssessment: isHebrew ? "Remove Glaucoma Assessment" : "Remove Glaucoma Assessment",
        deleteGlaucomaAssessments: isHebrew ? "Delete Glaucoma Assessments" : "Delete Glaucoma Assessments",
        deleteGlaucomaManagement: isHebrew ? "Delete Glaucoma Management" : "Delete Glaucoma Management",
        deleteGlomerularDisease: isHebrew ? "Delete Glomerular Disease" : "Delete Glomerular Disease",
        deleteGlucometerDownloadSchedule: isHebrew ? "Delete Glucometer Download Schedule" : "Delete Glucometer Download Schedule",
        deleteGlucoseMonitoringFrequency: isHebrew ? "Delete Glucose Monitoring Frequency" : "Delete Glucose Monitoring Frequency",
        deleteGlucoseMonitoringGoal: isHebrew ? "Delete Glucose Monitoring Goal" : "Delete Glucose Monitoring Goal",
        deleteGlucoseMonitoringGoals: isHebrew ? "Delete Glucose Monitoring Goals" : "Delete Glucose Monitoring Goals",
        deleteGlucoseTestingWeek: isHebrew ? "Delete Glucose Testing Week" : "Delete Glucose Testing Week",
        deleteGlucoseTestingWeeks: isHebrew ? "Delete Glucose Testing Weeks" : "Delete Glucose Testing Weeks",
        deleteGoalsOfCareDiscussion: isHebrew ? "Delete Goals Of Care Discussion" : "Delete Goals Of Care Discussion",
        deleteGoutAssessment: isHebrew ? "Delete Gout Assessment" : "Delete Gout Assessment",
        deleteGrowthParameter: isHebrew ? "Delete Growth Parameter" : "Delete Growth Parameter",
        deleteGrowthParameters: isHebrew ? "Delete Growth Parameters" : "Delete Growth Parameters",
        deleteGrowthUltrasoundSchedule: isHebrew ? "Delete Growth Ultrasound Schedule" : "Delete Growth Ultrasound Schedule",
        deleteGuidelineCompliance: isHebrew ? "Delete Guideline Compliance" : "Delete Guideline Compliance",
        deleteGynecologyConsultation: isHebrew ? "Remove gynecology consultation" : "Remove gynecology consultation",
        deleteGynecologyConsultations: isHebrew ? "Delete Gynecology Consultations" : "Delete Gynecology Consultations",
        deleteHeadacheAssessment: isHebrew ? "Delete Headache Assessment" : "Delete Headache Assessment",
        deleteHeader: isHebrew ? "Delete Header" : "Delete Header",
        deleteHeaders: isHebrew ? "Delete Headers" : "Delete Headers",
        deleteHealthCoachingNotes: isHebrew ? "Delete Health Coaching Notes" : "Delete Health Coaching Notes",
        deleteHealthMaintenance: isHebrew ? "מחק תחזוקת בריאות" : "Delete health maintenance record",
        deleteHeightMeasurement: isHebrew ? "Delete Height Measurement" : "Delete Height Measurement",
        deleteHeightMeasurements: isHebrew ? "Delete Height Measurements" : "Delete Height Measurements",
        deleteHematologyAssessment: isHebrew ? "Delete Hematology Assessment" : "Delete Hematology Assessment",
        deleteHematologyConsultation: isHebrew ? "Remove Hematology Consultation" : "Remove Hematology Consultation",
        deleteHematologyConsultations: isHebrew ? "Delete Hematology Consultations" : "Delete Hematology Consultations",
        deleteHepatitisCHistory: isHebrew ? "Delete Hepatitis C History" : "Delete Hepatitis C History",
        deleteHepatitisCManagement: isHebrew ? "Delete Hepatitis C Management" : "Delete Hepatitis C Management",
        deleteHistoryPresentIllness: isHebrew ? "Remove patient history" : "Remove patient history",
        deleteHivHistory: isHebrew ? "Delete Hiv History" : "Delete Hiv History",
        deleteHomeHealthNote: isHebrew ? "Delete Health Note" : "Delete Health Note",
        deleteHomeHealthNotes: isHebrew ? "Delete Home Health Notes" : "Delete Home Health Notes",
        deleteHomeHealthOrders: isHebrew ? "Delete Home Health Orders" : "Delete Home Health Orders",
        deleteHomeMonitoring: isHebrew ? "Delete Home Monitoring" : "Delete Home Monitoring",
        deleteHomeSafety: isHebrew ? "Delete Home Safety" : "Delete Home Safety",
        deleteHomicideRiskAssessment: isHebrew ? "Delete Homicide Risk Assessment" : "Delete Homicide Risk Assessment",
        deleteHormonePanel: isHebrew ? "Remove hormone panel" : "Remove hormone panel",
        deleteHormonePanels: isHebrew ? "Delete Hormone Panels" : "Delete Hormone Panels",
        deleteHormoneTherapyRecord: isHebrew ? "Delete Hormone Record" : "Delete Hormone Record",
        deleteHormoneTherapyRecords: isHebrew ? "Delete Hormone Therapy Records" : "Delete Hormone Therapy Records",
        deleteHospiceNote: isHebrew ? "Delete Hospice Note" : "Delete Hospice Note",
        deleteHospiceNotes: isHebrew ? "Delete Hospice Notes" : "Delete Hospice Notes",
        deleteHospitalAdmissionNote: isHebrew ? "Delete Hospital Admission" : "Delete Hospital Admission",
        deleteHospitalAdmissionNotes: isHebrew ? "Delete Hospital Admission Notes" : "Delete Hospital Admission Notes",
        deleteHospitalCourse: isHebrew ? "Delete Hospital Course" : "Delete Hospital Course",
        deleteHospitalDischargeSummaries: isHebrew ? "Delete Hospital Discharge Summaries" : "Delete Hospital Discharge Summaries",
        deleteHospitalDischargeSummary: isHebrew ? "Remove Hospital Discharge" : "Remove Hospital Discharge",
        deleteHospitalTransferNote: isHebrew ? "Delete hospital transfer note" : "Delete hospital transfer note",
        deleteHospitalTransferNotes: isHebrew ? "Delete Hospital Transfer Notes" : "Delete Hospital Transfer Notes",
        deleteHourlyVitalSign: isHebrew ? "Delete Hourly Vital Sign" : "Delete Hourly Vital Sign",
        deleteHourlyVitalSigns: isHebrew ? "Delete Hourly Vital Signs" : "Delete Hourly Vital Signs",
        deleteHydrationManagement: isHebrew ? "Delete Hydration Management" : "Delete Hydration Management",
        deleteHypertensiveNephropathy: isHebrew ? "Delete Hypertensive Nephropathy" : "Delete Hypertensive Nephropathy",
        deleteHypoglycemiaManagement: isHebrew ? "Delete Hypoglycemia Management" : "Delete Hypoglycemia Management",
        deleteHypoglycemiaProtocol: isHebrew ? "Delete Hypoglycemia Protocol" : "Delete Hypoglycemia Protocol",
        deleteIbdAssessment: isHebrew ? "Delete Ibd Assessment" : "Delete Ibd Assessment",
        deleteIbdBiomarker: isHebrew ? "Delete Ibd Biomarker" : "Delete Ibd Biomarker",
        deleteIbdBiomarkers: isHebrew ? "Delete Ibd Biomarkers" : "Delete Ibd Biomarkers",
        deleteIbdConsultationDetail: isHebrew ? "Delete Ibd Consultation Detail" : "Delete Ibd Consultation Detail",
        deleteIbdConsultationDetails: isHebrew ? "Delete Ibd Consultation Details" : "Delete Ibd Consultation Details",
        deleteIbdSurgicalPlanning: isHebrew ? "Delete Ibd Surgical Planning" : "Delete Ibd Surgical Planning",
        deleteIcuFlowSheet: isHebrew ? "Delete ICU flowsheet" : "Delete ICU flowsheet",
        deleteIcuFlowSheets: isHebrew ? "Delete Icu Flow Sheets" : "Delete Icu Flow Sheets",
        deleteImagingOrder: isHebrew ? "Cancel imaging request" : "Cancel imaging request",
        deleteImagingOrders: isHebrew ? "Delete Imaging Orders" : "Delete Imaging Orders",
        deleteImagingReport: isHebrew ? "Delete Imaging Report" : "Delete Imaging Report",
        deleteImagingReports: isHebrew ? "Delete Medical Report" : "Delete Medical Report",
        deleteImmediateIntervention: isHebrew ? "Delete Immediate Intervention" : "Delete Immediate Intervention",
        deleteImmediateInterventions: isHebrew ? "Delete Immediate Interventions" : "Delete Immediate Interventions",
        deleteImmediateRecommendation: isHebrew ? "Delete Immediate Recommendation" : "Delete Immediate Recommendation",
        deleteImmediateRecommendations: isHebrew ? "Delete Immediate Recommendations" : "Delete Immediate Recommendations",
        deleteImmuneFunctionTest: isHebrew ? "Delete Immune Function Test" : "Delete Immune Function Test",
        deleteImmuneFunctionTests: isHebrew ? "Delete Immune Function Tests" : "Delete Immune Function Tests",
        deleteImmuneReconstitutionPlanning: isHebrew ? "Delete Immune Reconstitution Planning" : "Delete Immune Reconstitution Planning",
        deleteImmunizationRecord: isHebrew ? "Delete Immunization Record" : "Delete Immunization Record",
        deleteImmunizationSchedule: isHebrew ? "Delete Immunization Schedule" : "Delete Immunization Schedule",
        deleteImmunizationStatu: isHebrew ? "Delete Immunization Statu" : "Delete Immunization Statu",
        deleteImmunizationStatus: isHebrew ? "Delete Immunization Status" : "Delete Immunization Status",
        deleteIndianDietExchangeList: isHebrew ? "Delete Indian Diet Exchange List" : "Delete Indian Diet Exchange List",
        deleteIndianDietExchangeLists: isHebrew ? "Delete Indian Diet Exchange Lists" : "Delete Indian Diet Exchange Lists",
        deleteInfectionControlRecords: isHebrew ? "Delete Infection Control Records" : "Delete Infection Control Records",
        deleteInfectionRiskMonitoring: isHebrew ? "Delete Infection Risk Monitoring" : "Delete Infection Risk Monitoring",
        deleteInfectionSurveillance: isHebrew ? "Delete Infection Surveillance" : "Delete Infection Surveillance",
        deleteInfectiousDiseaseAssessment: isHebrew ? "Delete Infectious Disease Assessment" : "Delete Infectious Disease Assessment",
        deleteInflammatoryBowelReport: isHebrew ? "Delete IBD Report" : "Delete IBD Report",
        deleteInflammatoryBowelReports: isHebrew ? "Delete Inflammatory Bowel Reports" : "Delete Inflammatory Bowel Reports",
        deleteInflammatoryMarker: isHebrew ? "Delete Inflammatory Marker" : "Delete Inflammatory Marker",
        deleteInflammatoryMarkers: isHebrew ? "Delete Inflammatory Markers" : "Delete Inflammatory Markers",
        deleteInfliximabDrugMonitoring: isHebrew ? "Delete Infliximab Drug Monitoring" : "Delete Infliximab Drug Monitoring",
        deleteInfusionTherapy: isHebrew ? "Delete Infusion Therapy" : "Delete Infusion Therapy",
        deleteInheritancePatternDetail: isHebrew ? "Delete Inheritance Pattern Detail" : "Delete Inheritance Pattern Detail",
        deleteInheritancePatternDetails: isHebrew ? "Delete Inheritance Pattern Details" : "Delete Inheritance Pattern Details",
        deleteInjuryDetail: isHebrew ? "Delete Injury Detail" : "Delete Injury Detail",
        deleteInjuryDetails: isHebrew ? "Delete Injury Details" : "Delete Injury Details",
        deleteInsomniaAssessment: isHebrew ? "Delete Insomnia Assessment" : "Delete Insomnia Assessment",
        deleteInsulinAdjustmentProtocol: isHebrew ? "Delete Insulin Adjustment Protocol" : "Delete Insulin Adjustment Protocol",
        deleteInsulinPumpSetting: isHebrew ? "Delete Insulin Pump Setting" : "Delete Insulin Pump Setting",
        deleteInsulinPumpSettings: isHebrew ? "Delete Insulin Pump Settings" : "Delete Insulin Pump Settings",
        deleteInsulinRegimen: isHebrew ? "Delete Insulin Regimen" : "Delete Insulin Regimen",
        deleteInsulinStorageInstruction: isHebrew ? "Delete Insulin Storage Instruction" : "Delete Insulin Storage Instruction",
        deleteInsulinStorageInstructions: isHebrew ? "Delete Insulin Storage Instructions" : "Delete Insulin Storage Instructions",
        deleteInsulinTimingInstruction: isHebrew ? "Delete Insulin Timing Instruction" : "Delete Insulin Timing Instruction",
        deleteInsulinTimingInstructions: isHebrew ? "Delete Insulin Timing Instructions" : "Delete Insulin Timing Instructions",
        deleteInsuranceAuthorization: isHebrew ? "מחק אישור ביטוח" : "Delete insurance authorization",
        deleteInsuranceAuthorizations: isHebrew ? "Delete Insurance Authorizations" : "Delete Insurance Authorizations",
        deleteInsuranceForm: isHebrew ? "Remove insurance document" : "Remove insurance document",
        deleteInsuranceForms: isHebrew ? "Delete Insurance Forms" : "Delete Insurance Forms",
        deleteIntakeOutputRecord: isHebrew ? "Delete intake/output record" : "Delete intake/output record",
        deleteIntakeOutputRecords: isHebrew ? "Delete Intake Output Records" : "Delete Intake Output Records",
        deleteIntegrativeOncology: isHebrew ? "Delete Integrative Oncology" : "Delete Integrative Oncology",
        deleteIntelligentRecommendation: isHebrew ? "Remove recommendation" : "Remove recommendation",
        deleteIntelligentRecommendations: isHebrew ? "Delete Intelligent Recommendations" : "Delete Intelligent Recommendations",
        deleteInterPregnancyWeightManagement: isHebrew ? "Delete Inter Pregnancy Weight Management" : "Delete Inter Pregnancy Weight Management",
        deleteIntervalHistory: isHebrew ? "Delete Interval History" : "Delete Interval History",
        deleteInterventionalPainProcedures: isHebrew ? "Delete Interventional Pain Procedures" : "Delete Interventional Pain Procedures",
        deleteInterventionalRadiologyNote: isHebrew ? "Delete radiology note" : "Delete radiology note",
        deleteInterventionalRadiologyNotes: isHebrew ? "Delete Interventional Radiology Notes" : "Delete Interventional Radiology Notes",
        deleteIntradialyticMonitoring: isHebrew ? "Delete Intradialytic Monitoring" : "Delete Intradialytic Monitoring",
        deleteIntraoperativeCholangiography: isHebrew ? "Delete Intraoperative Cholangiography" : "Delete Intraoperative Cholangiography",
        deleteIntraoperativeFinding: isHebrew ? "Delete Intraoperative Finding" : "Delete Intraoperative Finding",
        deleteIntraoperativeFindings: isHebrew ? "Delete Intraoperative Findings" : "Delete Intraoperative Findings",
        deleteIntraoperativeImaging: isHebrew ? "Delete Intraoperative Imaging" : "Delete Intraoperative Imaging",
        deleteIntraoperativeMonitoring: isHebrew ? "Delete Intraoperative Monitoring" : "Delete Intraoperative Monitoring",
        deleteIsolationPrecautions: isHebrew ? "Delete Isolation Precautions" : "Delete Isolation Precautions",
        deleteIvInfusion: isHebrew ? "Delete Iv Infusion" : "Delete Iv Infusion",
        deleteIvInfusions: isHebrew ? "Delete Iv Infusions" : "Delete Iv Infusions",
        deleteJobHazardAnalysis: isHebrew ? "Delete Job Hazard Analysis" : "Delete Job Hazard Analysis",
        deleteKetoneMonitoringInstruction: isHebrew ? "Delete Ketone Monitoring Instruction" : "Delete Ketone Monitoring Instruction",
        deleteKetoneMonitoringInstructions: isHebrew ? "Delete Ketone Monitoring Instructions" : "Delete Ketone Monitoring Instructions",
        deleteKidneyDiseaseProgressionTimeline: isHebrew ? "Delete Kidney Disease Progression Timeline" : "Delete Kidney Disease Progression Timeline",
        deleteKidneyFunctionReport: isHebrew ? "Delete kidney report" : "Delete kidney report",
        deleteKidneyFunctionReports: isHebrew ? "Delete Kidney Function Reports" : "Delete Kidney Function Reports",
        deleteLaborDeliveryRecords: isHebrew ? "Delete Labor Delivery Records" : "Delete Labor Delivery Records",
        deleteLabOrder: isHebrew ? "Cancel medical order" : "Cancel medical order",
        deleteLabOrders: isHebrew ? "Delete Lab Orders" : "Delete Lab Orders",
        deleteLabResult: isHebrew ? "Delete Lab Result" : "Delete Lab Result",
        deleteLabResults: isHebrew ? "Delete lab result" : "Delete lab result",
        deleteLabSchedule: isHebrew ? "Delete Lab Schedule" : "Delete Lab Schedule",
        deleteLaborDeliveryRecord: isHebrew ? "Delete Labor Record" : "Delete Labor Record",
        deleteLaboratoryResult: isHebrew ? "Delete Laboratory Result" : "Delete Laboratory Result",
        deleteLaryngoscopyReport: isHebrew ? "Delete Laryngoscopy Report" : "Delete Laryngoscopy Report",
        deleteLaryngoscopyReports: isHebrew ? "Delete Laryngoscopy Reports" : "Delete Laryngoscopy Reports",
        deleteLifestyleAssessment: isHebrew ? "Delete Lifestyle Assessment" : "Delete Lifestyle Assessment",
        deleteLifestyleAssessments: isHebrew ? "Delete Lifestyle Assessments" : "Delete Lifestyle Assessments",
        deleteLifestyleCounseling: isHebrew ? "Delete Lifestyle Counseling" : "Delete Lifestyle Counseling",
        deleteLifestyleRiskAssessment: isHebrew ? "Delete Lifestyle Risk Assessment" : "Delete Lifestyle Risk Assessment",
        deleteLigamentReconstruction: isHebrew ? "Delete Ligament Reconstruction" : "Delete Ligament Reconstruction",
        deleteLiverFunctionAssessment: isHebrew ? "Remove liver assessment" : "Remove liver assessment",
        deleteLiverFunctionAssessments: isHebrew ? "Delete Liver Function Assessments" : "Delete Liver Function Assessments",
        deleteLupusAssessment: isHebrew ? "Delete Lupus Assessment" : "Delete Lupus Assessment",
        deleteLymphNodeCytomorphology: isHebrew ? "Delete Lymph Node Cytomorphology" : "Delete Lymph Node Cytomorphology",
        deleteMacrosomiaThreshold: isHebrew ? "Delete Macrosomia Threshold" : "Delete Macrosomia Threshold",
        deleteMalnutritionRiskAssessment: isHebrew ? "Delete Malnutrition Risk Assessment" : "Delete Malnutrition Risk Assessment",
        deleteMammographyReport: isHebrew ? "Delete mammography report" : "Delete mammography report",
        deleteMammographyReports: isHebrew ? "Delete Mammography Reports" : "Delete Mammography Reports",
        deleteMaternalFetalReport: isHebrew ? "Delete Maternal-Fetal Report" : "Delete Maternal-Fetal Report",
        deleteMaternalFetalReports: isHebrew ? "Delete Maternal Fetal Reports" : "Delete Maternal Fetal Reports",
        deleteMaternalLab: isHebrew ? "Delete Maternal Lab" : "Delete Maternal Lab",
        deleteMaternalLabs: isHebrew ? "Delete Maternal Labs" : "Delete Maternal Labs",
        deleteMaternalWeightMonitoring: isHebrew ? "Delete Maternal Weight Monitoring" : "Delete Maternal Weight Monitoring",
        deleteMayoScore: isHebrew ? "Delete Mayo Score" : "Delete Mayo Score",
        deleteMechanismOfInjury: isHebrew ? "Delete Mechanism Of Injury" : "Delete Mechanism Of Injury",
        deleteMedicalAlert: isHebrew ? "Delete Medical Alert" : "Delete Medical Alert",
        deleteMedicalAlerts: isHebrew ? "Delete Medical Alerts" : "Delete Medical Alerts",
        deleteMedicalCertificate: isHebrew ? "Delete Medical Certificate" : "Delete Medical Certificate",
        deleteMedicalCertificates: isHebrew ? "Delete Medical Certificates" : "Delete Medical Certificates",
        deleteMedicalData: isHebrew ? "מחק נתונים רפואיים" : "Delete medical data",
        deleteMedicalGeneticist: isHebrew ? "Delete Medical Geneticist" : "Delete Medical Geneticist",
        deleteMedicalHistory: isHebrew ? "מחק היסטוריה רפואית" : "Delete medical history",
        deleteMedicalPowerOfAttorney: isHebrew ? "Revoke medical authorization" : "Revoke medical authorization",
        deleteMedicalProcedure: isHebrew ? "Remove medical procedure" : "Remove medical procedure",
        deleteMedicalProcedures: isHebrew ? "Delete Medical Procedures" : "Delete Medical Procedures",
        deleteMedicalReconciliationForm: isHebrew ? "Delete Medical Form" : "Delete Medical Form",
        deleteMedicalReconciliationForms: isHebrew ? "Delete Medical Reconciliation Forms" : "Delete Medical Reconciliation Forms",
        deleteMedication: isHebrew ? "Remove medication entry" : "Remove medication entry",
        deleteMedicationAccessProgram: isHebrew ? "Delete Medication Access Program" : "Delete Medication Access Program",
        deleteMedicationAccessPrograms: isHebrew ? "Delete Medication Access Programs" : "Delete Medication Access Programs",
        deleteMedicationAdministrationRecord: isHebrew ? "Delete Medication Record" : "Delete Medication Record",
        deleteMedicationAdministrationRecords: isHebrew ? "Delete Medication Administration Records" : "Delete Medication Administration Records",
        deleteMedicationChangesDiscontinued: isHebrew ? "Delete Medication Changes Discontinued" : "Delete Medication Changes Discontinued",
        deleteMedicationChangesDose: isHebrew ? "Delete Medication Changes Dose" : "Delete Medication Changes Dose",
        deleteMedicationChangesNew: isHebrew ? "Delete Medication Changes New" : "Delete Medication Changes New",
        deleteMedicationDeprescribing: isHebrew ? "Delete Medication Deprescribing" : "Delete Medication Deprescribing",
        deleteMedicationOptimization: isHebrew ? "Remove medication optimization" : "Remove medication optimization",
        deleteMedicationRecommendation: isHebrew ? "Delete Medication Recommendation" : "Delete Medication Recommendation",
        deleteMedicationRecommendations: isHebrew ? "Delete medication recommendation" : "Delete medication recommendation",
        deleteMedicationReconciliation: isHebrew ? "Delete Medication Reconciliation" : "Delete Medication Reconciliation",
        deleteMedicationRenalDosing: isHebrew ? "Delete Medication Renal Dosing" : "Delete Medication Renal Dosing",
        deleteMedications: isHebrew ? "Delete Medications" : "Delete Medications",
        deleteMedicationSafety: isHebrew ? "Delete medication safety record" : "Delete medication safety record",
        deleteMedicationSafetyAlert: isHebrew ? "Delete Medication Safety Alert" : "Delete Medication Safety Alert",
        deleteMedicationsAdministered: isHebrew ? "Delete Medications Administered" : "Delete Medications Administered",
        deleteMedicationSafetyAlerts: isHebrew ? "Delete Medication Safety Alerts" : "Delete Medication Safety Alerts",
        deleteMeniscusRepair: isHebrew ? "Delete Meniscus Repair" : "Delete Meniscus Repair",
        deleteMentalHealthAssessment: isHebrew ? "Delete mental health assessment" : "Delete mental health assessment",
        deleteMentalHealthAssessments: isHebrew ? "Delete Mental Health Assessments" : "Delete Mental Health Assessments",
        deleteMentalHealthResource: isHebrew ? "Delete Mental Health Resource" : "Delete Mental Health Resource",
        deleteMentalHealthResources: isHebrew ? "Delete Mental Health Resources" : "Delete Mental Health Resources",
        deleteMentalStatusExam: isHebrew ? "Delete Mental Status Exam" : "Delete Mental Status Exam",
        deleteMentalStatusExams: isHebrew ? "Delete Mental Status Exams" : "Delete Mental Status Exams",
        deleteMicrobiologyCultureReport: isHebrew ? "Delete Culture Report" : "Delete Culture Report",
        deleteMicrobiologyCultureReports: isHebrew ? "Delete Microbiology Culture Reports" : "Delete Microbiology Culture Reports",
        deleteMineralBoneDisease: isHebrew ? "Delete Mineral Bone Disease" : "Delete Mineral Bone Disease",
        deleteMonitoringPlan: isHebrew ? "Delete Monitoring Plan" : "Delete Monitoring Plan",
        deleteMonitoringPlans: isHebrew ? "Delete Monitoring Plans" : "Delete Monitoring Plans",
        deleteMonitoringReport: isHebrew ? "Delete Monitoring Report" : "Delete Monitoring Report",
        deleteMonitoringReports: isHebrew ? "Delete Monitoring Reports" : "Delete Monitoring Reports",
        deleteMoodPsychologicalAssessment: isHebrew ? "Delete Mood Psychological Assessment" : "Delete Mood Psychological Assessment",
        deleteMortalityRiskAssessment: isHebrew ? "Delete Mortality Risk Assessment" : "Delete Mortality Risk Assessment",
        deleteMotorComplication: isHebrew ? "Delete Motor Complication" : "Delete Motor Complication",
        deleteMotorComplications: isHebrew ? "Delete Motor Complications" : "Delete Motor Complications",
        deleteMovementDisorderAssessment: isHebrew ? "Delete Movement Disorder Assessment" : "Delete Movement Disorder Assessment",
        deleteMriReport: isHebrew ? "Delete MRI report" : "Delete MRI report",
        deleteMriReports: isHebrew ? "Delete Mri Reports" : "Delete Mri Reports",
        deleteMultimodalPainTherapy: isHebrew ? "Delete Multimodal Pain Therapy" : "Delete Multimodal Pain Therapy",
        deleteMultipleSclerosisAssessment: isHebrew ? "Delete Multiple Sclerosis Assessment" : "Delete Multiple Sclerosis Assessment",
        deleteMyelomaSpecificData: isHebrew ? "Delete Myeloma Specific Data" : "Delete Myeloma Specific Data",
        deleteMyositisAssessment: isHebrew ? "Delete Myositis Assessment" : "Delete Myositis Assessment",
        deleteNarcolepsyAssessment: isHebrew ? "Delete Narcolepsy Assessment" : "Delete Narcolepsy Assessment",
        deleteNephrologyConsultation: isHebrew ? "Remove Nephrology Consultation" : "Remove Nephrology Consultation",
        deleteNephrologyConsultationDetail: isHebrew ? "Delete Nephrology Consultation Detail" : "Delete Nephrology Consultation Detail",
        deleteNephrologyConsultationDetails: isHebrew ? "Delete Nephrology Consultation Details" : "Delete Nephrology Consultation Details",
        deleteNephrologyConsultations: isHebrew ? "Delete Nephrology Consultations" : "Delete Nephrology Consultations",
        deleteNeuroImaging: isHebrew ? "Delete Neuro Imaging" : "Delete Neuro Imaging",
        deleteNeurologicalAssessment: isHebrew ? "Delete Neurological Assessment" : "Delete Neurological Assessment",
        deleteNeurologicalExam: isHebrew ? "Delete Neurological Exam" : "Delete Neurological Exam",
        deleteNeurologicalExamination: isHebrew ? "Delete Neurological Examination" : "Delete Neurological Examination",
        deleteNeurologicalFinding: isHebrew ? "Delete Neurological Finding" : "Delete Neurological Finding",
        deleteNeurologicalFindings: isHebrew ? "Delete Neurological Findings" : "Delete Neurological Findings",
        deleteNeurologyConsultation: isHebrew ? "Remove Neurology Consultation" : "Remove Neurology Consultation",
        deleteNeurologyConsultations: isHebrew ? "Delete Neurology Consultations" : "Delete Neurology Consultations",
        deleteNeurologyProgressNote: isHebrew ? "Delete Neurology Note" : "Delete Neurology Note",
        deleteNeurologyProgressNotes: isHebrew ? "Delete Neurology Progress Notes" : "Delete Neurology Progress Notes",
        deleteNeuromuscularDisorder: isHebrew ? "Delete Neuromuscular Disorder" : "Delete Neuromuscular Disorder",
        deleteNeuropsychologicalAssessments: isHebrew ? "Delete Neuropsychological Assessments" : "Delete Neuropsychological Assessments",
        deleteNeuropsychTesting: isHebrew ? "Delete Neuropsych Testing" : "Delete Neuropsych Testing",
        deleteNeuropsychologicalAssessment: isHebrew ? "Delete neuropsych assessment" : "Delete neuropsych assessment",
        deleteNeurosurgeryAssessment: isHebrew ? "Delete Neurosurgery Assessment" : "Delete Neurosurgery Assessment",
        deleteNeurosurgeryConsultation: isHebrew ? "Remove Neurosurgery Consultation" : "Remove Neurosurgery Consultation",
        deleteNeurosurgeryConsultations: isHebrew ? "Delete Neurosurgery Consultations" : "Delete Neurosurgery Consultations",
        deleteNeurovascularExam: isHebrew ? "Delete Neurovascular Exam" : "Delete Neurovascular Exam",
        deleteNewbornScreeningResult: isHebrew ? "Delete screening result" : "Delete screening result",
        deleteNewbornScreeningResults: isHebrew ? "Delete Newborn Screening Results" : "Delete Newborn Screening Results",
        deleteNicuProgressNote: isHebrew ? "Delete NICU Progress Note" : "Delete NICU Progress Note",
        deleteNicuProgressNotes: isHebrew ? "Delete Nicu Progress Notes" : "Delete Nicu Progress Notes",
        deleteNonMotorSymptom: isHebrew ? "Delete Non Motor Symptom" : "Delete Non Motor Symptom",
        deleteNonMotorSymptoms: isHebrew ? "Delete Non Motor Symptoms" : "Delete Non Motor Symptoms",
        deleteNtScanResult: isHebrew ? "Delete Nt Scan Result" : "Delete Nt Scan Result",
        deleteNuclearMedicineAssessment: isHebrew ? "Delete Nuclear Medicine Assessment" : "Delete Nuclear Medicine Assessment",
        deleteNuclearMedicineStudies: isHebrew ? "Delete Nuclear Medicine Studies" : "Delete Nuclear Medicine Studies",
        deleteNuclearMedicineStudy: isHebrew ? "Delete Nuclear Medicine Study" : "Delete Nuclear Medicine Study",
        deleteNurseSignature: isHebrew ? "Delete Nurse Signature" : "Delete Nurse Signature",
        deleteNurseSignatures: isHebrew ? "Delete Nurse Signatures" : "Delete Nurse Signatures",
        deleteNursingAssessment: isHebrew ? "Delete nursing record" : "Delete nursing record",
        deleteNursingAssessments: isHebrew ? "Delete Nursing Assessments" : "Delete Nursing Assessments",
        deleteNursingNote: isHebrew ? "Delete nursing note" : "Delete nursing note",
        deleteNursingNotes: isHebrew ? "Delete Nursing Notes" : "Delete Nursing Notes",
        deleteNutritionalStatus: isHebrew ? "Delete Nutritional Status" : "Delete Nutritional Status",
        deleteNutritionAssessment: isHebrew ? "Delete nutrition record" : "Delete nutrition record",
        deleteNutritionalAssessment: isHebrew ? "Delete Nutritional Assessment" : "Delete Nutritional Assessment",
        deleteNutritionalStatu: isHebrew ? "Delete Nutritional Statu" : "Delete Nutritional Statu",
        deleteNutritionalSupplementation: isHebrew ? "Delete Nutritional Supplementation" : "Delete Nutritional Supplementation",
        deleteNutritionalSupport: isHebrew ? "Delete Nutritional Support" : "Delete Nutritional Support",
        deleteNutritionAssessments: isHebrew ? "Delete Nutrition Assessments" : "Delete Nutrition Assessments",
        deleteObstetricHistory: isHebrew ? "Delete Obstetric History" : "Delete Obstetric History",
        deleteObstetricUltrasoundReport: isHebrew ? "Delete Ultrasound Report" : "Delete Ultrasound Report",
        deleteObstetricUltrasoundReports: isHebrew ? "Delete Obstetric Ultrasound Reports" : "Delete Obstetric Ultrasound Reports",
        deleteOccupationalExposureRecords: isHebrew ? "Delete Occupational Exposure Records" : "Delete Occupational Exposure Records",
        deleteOccupationalHealthAssessment: isHebrew ? "Delete Occupational Health Assessment" : "Delete Occupational Health Assessment",
        deleteOccupationalMedicineEvaluation: isHebrew ? "Delete Occupational Medicine Evaluation" : "Delete Occupational Medicine Evaluation",
        deleteOccupationalMedicineEvaluations: isHebrew ? "Delete Occupational Medicine Evaluations" : "Delete Occupational Medicine Evaluations",
        deleteOccupationalTherapyReport: isHebrew ? "Delete Therapy Report" : "Delete Therapy Report",
        deleteOccupationalTherapyReports: isHebrew ? "Delete Occupational Therapy Reports" : "Delete Occupational Therapy Reports",
        deleteOmissionsRefusal: isHebrew ? "Delete Omissions Refusal" : "Delete Omissions Refusal",
        deleteOmissionsRefusals: isHebrew ? "Delete Omissions Refusals" : "Delete Omissions Refusals",
        deleteOncologicEmergencies: isHebrew ? "Delete Oncologic Emergencies" : "Delete Oncologic Emergencies",
        deleteOncologicEmergency: isHebrew ? "Delete Oncologic Emergency" : "Delete Oncologic Emergency",
        deleteOncologyConsultation: isHebrew ? "Remove Oncology Consultation" : "Remove Oncology Consultation",
        deleteOncologyConsultations: isHebrew ? "Delete Oncology Consultations" : "Delete Oncology Consultations",
        deleteOncologyFollowupReport: isHebrew ? "Delete Oncology Report" : "Delete Oncology Report",
        deleteOncologyFollowupReports: isHebrew ? "Delete Oncology Followup Reports" : "Delete Oncology Followup Reports",
        deleteOncologyTeam: isHebrew ? "Delete Oncology Team" : "Delete Oncology Team",
        deleteOncologyTreatmentPlan: isHebrew ? "Remove Cancer Treatment" : "Remove Cancer Treatment",
        deleteOncologyTreatmentPlans: isHebrew ? "Delete Oncology Treatment Plans" : "Delete Oncology Treatment Plans",
        deleteOperativeDetail: isHebrew ? "Delete Operative Detail" : "Delete Operative Detail",
        deleteOperativeDetails: isHebrew ? "Delete Operative Details" : "Delete Operative Details",
        deleteOperativeReport: isHebrew ? "Delete medical report" : "Delete medical report",
        deleteOperativeReportDetail: isHebrew ? "Delete Operative Report Detail" : "Delete Operative Report Detail",
        deleteOperativeReportDetails: isHebrew ? "Delete Operative Report Details" : "Delete Operative Report Details",
        deleteOperativeReports: isHebrew ? "Delete Operative Reports" : "Delete Operative Reports",
        deleteOperativeTechnique: isHebrew ? "Delete Operative Technique" : "Delete Operative Technique",
        deleteOperativeTime: isHebrew ? "Delete Operative Time" : "Delete Operative Time",
        deleteOphthalmologyExam: isHebrew ? "Delete Ophthalmology Exam" : "Delete Ophthalmology Exam",
        deleteOphthalmologyExamination: isHebrew ? "Delete Eye Exam" : "Delete Eye Exam",
        deleteOphthalmologyExaminations: isHebrew ? "Delete Ophthalmology Examinations" : "Delete Ophthalmology Examinations",
        deleteOpioidRiskAssessment: isHebrew ? "Delete Opioid Risk Assessment" : "Delete Opioid Risk Assessment",
        deleteOpportunisticInfections: isHebrew ? "Delete Opportunistic Infections" : "Delete Opportunistic Infections",
        deleteOptimizationStat: isHebrew ? "Delete Optimization Stat" : "Delete Optimization Stat",
        deleteOptimizationStats: isHebrew ? "Delete Optimization Stats" : "Delete Optimization Stats",
        deleteOralSurgeryReport: isHebrew ? "Delete Oral Surgery Report" : "Delete Oral Surgery Report",
        deleteOralSurgeryReports: isHebrew ? "Delete Oral Surgery Reports" : "Delete Oral Surgery Reports",
        deleteOrthodonticTreatmentPlan: isHebrew ? "Remove Orthodontic Plan" : "Remove Orthodontic Plan",
        deleteOrthodonticTreatmentPlans: isHebrew ? "Delete Orthodontic Treatment Plans" : "Delete Orthodontic Treatment Plans",
        deleteOrthopedicAssessment: isHebrew ? "Delete Orthopedic Assessment" : "Delete Orthopedic Assessment",
        deleteOrthopedicConsultation: isHebrew ? "Delete Orthopedic Consultation" : "Delete Orthopedic Consultation",
        deleteOrthopedicConsultations: isHebrew ? "Delete Orthopedic Consultations" : "Delete Orthopedic Consultations",
        deleteOrthopedicFollowupNote: isHebrew ? "Delete Orthopedic Note" : "Delete Orthopedic Note",
        deleteOrthopedicFollowupNotes: isHebrew ? "Delete Orthopedic Followup Notes" : "Delete Orthopedic Followup Notes",
        deleteOrthopedicImaging: isHebrew ? "Delete Orthopedic Imaging" : "Delete Orthopedic Imaging",
        deleteOrthopedicOperativeReport: isHebrew ? "Delete Orthopedic Report" : "Delete Orthopedic Report",
        deleteOrthopedicOperativeReports: isHebrew ? "Delete Orthopedic Operative Reports" : "Delete Orthopedic Operative Reports",
        deleteOrthopedicProcedure: isHebrew ? "Delete Orthopedic Procedure" : "Delete Orthopedic Procedure",
        deleteOrthopedicProcedures: isHebrew ? "Delete Orthopedic Procedures" : "Delete Orthopedic Procedures",
        deleteOutcomesPrediction: isHebrew ? "Delete outcome predictions" : "Delete outcome predictions",
        deleteOvertrainingAssessment: isHebrew ? "Delete Overtraining Assessment" : "Delete Overtraining Assessment",
        deletePainAssessmentForm: isHebrew ? "Delete Pain Form" : "Delete Pain Form",
        deletePainAssessmentForms: isHebrew ? "Delete Pain Assessment Forms" : "Delete Pain Assessment Forms",
        deletePainFunctionalAssessment: isHebrew ? "Delete Pain Functional Assessment" : "Delete Pain Functional Assessment",
        deletePainManagement: isHebrew ? "Delete Pain Management" : "Delete Pain Management",
        deletePainManagementNote: isHebrew ? "Delete Pain Note" : "Delete Pain Note",
        deletePainManagementNotes: isHebrew ? "Delete Pain Management Notes" : "Delete Pain Management Notes",
        deletePainManagementPlan: isHebrew ? "Delete Pain Management Plan" : "Delete Pain Management Plan",
        deletePainMedicationAgreements: isHebrew ? "Delete Pain Medication Agreements" : "Delete Pain Medication Agreements",
        deletePalliativeCare: isHebrew ? "Delete Palliative Care" : "Delete Palliative Care",
        deletePalliativeCareNeed: isHebrew ? "Delete Palliative Care Need" : "Delete Palliative Care Need",
        deletePalliativeCareNeeds: isHebrew ? "Delete Palliative Care Needs" : "Delete Palliative Care Needs",
        deleteParentalConcern: isHebrew ? "Delete Parental Concern" : "Delete Parental Concern",
        deleteParentalConcerns: isHebrew ? "Delete Parental Concerns" : "Delete Parental Concerns",
        deleteParkinsonianFeatures: isHebrew ? "Delete Parkinsonian Features" : "Delete Parkinsonian Features",
        deleteParkinsonMedication: isHebrew ? "Delete Parkinson Medication" : "Delete Parkinson Medication",
        deleteParkinsonianFeature: isHebrew ? "Delete Parkinsonian Feature" : "Delete Parkinsonian Feature",
        deleteParkinsonMedications: isHebrew ? "Delete Parkinson Medications" : "Delete Parkinson Medications",
        deletePartnerInvolvement: isHebrew ? "Delete Partner Involvement" : "Delete Partner Involvement",
        deletePartnerInvolvementDiabetesManagement: isHebrew ? "Delete Partner Involvement Diabetes Management" : "Delete Partner Involvement Diabetes Management",
        deletePastMedicalHistory: isHebrew ? "מחק היסטוריה רפואית קודמת" : "Delete Past Medical History",
        deletePastOcularHistory: isHebrew ? "Delete Past Ocular History" : "Delete Past Ocular History",
        deletePathologyGrossDescription: isHebrew ? "Delete Pathology Gross Description" : "Delete Pathology Gross Description",
        deletePathologyReport: isHebrew ? "Delete medical report" : "Delete medical report",
        deletePathologyReports: isHebrew ? "Delete Pathology Reports" : "Delete Pathology Reports",
        deletePatientBySearch: isHebrew ? "מחק מטופל" : "Delete patient",
        deletePatientCareGoals: isHebrew ? "Delete Patient Care Goals" : "Delete Patient Care Goals",
        deletePatientEducationContext: isHebrew ? "Remove patient education context" : "Remove patient education context",
        deletePatientEducationRecord: isHebrew ? "Delete patient record" : "Delete patient record",
        deletePatientEducationRecords: isHebrew ? "Delete Patient Education Records" : "Delete Patient Education Records",
        deletePatientEmotionalResponse: isHebrew ? "Delete Patient Emotional Response" : "Delete Patient Emotional Response",
        deletePatientInstruction: isHebrew ? "Delete Patient Instruction" : "Delete Patient Instruction",
        deletePatientInstructions: isHebrew ? "Delete Patient Instructions" : "Delete Patient Instructions",
        deletePatientPositioning: isHebrew ? "Delete Patient Positioning" : "Delete Patient Positioning",
        deletePatientProvider: isHebrew ? "Delete Patient Provider" : "Delete Patient Provider",
        deletePatientSpecificCarePlan: isHebrew ? "Remove Patient Care Plan" : "Remove Patient Care Plan",
        deletePediatricGrowthChart: isHebrew ? "Delete pediatric chart" : "Delete pediatric chart",
        deletePediatricGrowthCharts: isHebrew ? "Delete Pediatric Growth Charts" : "Delete Pediatric Growth Charts",
        deletePediatricScreening: isHebrew ? "Delete Pediatric Screening" : "Delete Pediatric Screening",
        deletePediatricVaccinationRecord: isHebrew ? "Delete Pediatric Vaccination" : "Delete Pediatric Vaccination",
        deletePediatricVaccinationRecords: isHebrew ? "Delete Pediatric Vaccination Records" : "Delete Pediatric Vaccination Records",
        deletePediatricVisit: isHebrew ? "Delete pediatric visit" : "Delete pediatric visit",
        deletePediatricVisits: isHebrew ? "Delete Pediatric Visits" : "Delete Pediatric Visits",
        deletePerformanceAssessment: isHebrew ? "Delete Performance Assessment" : "Delete Performance Assessment",
        deletePerformanceStatu: isHebrew ? "Delete Performance Statu" : "Delete Performance Statu",
        deletePerformanceStatus: isHebrew ? "Delete Performance Status" : "Delete Performance Status",
        deletePerinatalMentalHealthReferral: isHebrew ? "Delete Perinatal Mental Health Referral" : "Delete Perinatal Mental Health Referral",
        deletePeriodontalChart: isHebrew ? "Delete Periodontal Record" : "Delete Periodontal Record",
        deletePeriodontalCharts: isHebrew ? "Delete Periodontal Charts" : "Delete Periodontal Charts",
        deletePeripheralNeuropathy: isHebrew ? "Delete Peripheral Neuropathy" : "Delete Peripheral Neuropathy",
        deletePetScanReport: isHebrew ? "Delete Pet Scan" : "Delete Pet Scan",
        deletePetScanReports: isHebrew ? "Delete Pet Scan Reports" : "Delete Pet Scan Reports",
        deletePharmacyReview: isHebrew ? "Delete Pharmacy Review" : "Delete Pharmacy Review",
        deletePhysicalExamination: isHebrew ? "Delete Physical Examination" : "Delete Physical Examination",
        deletePhysicalExaminations: isHebrew ? "Delete Physical Examinations" : "Delete Physical Examinations",
        deletePhysicalTherapyEvaluation: isHebrew ? "Delete Physical Therapy Evaluation" : "Delete Physical Therapy Evaluation",
        deletePhysicalTherapyEvaluations: isHebrew ? "Delete Physical Therapy Evaluations" : "Delete Physical Therapy Evaluations",
        deletePhysicalTherapyNote: isHebrew ? "Delete therapy note" : "Delete therapy note",
        deletePhysicalTherapyNotes: isHebrew ? "Delete Physical Therapy Notes" : "Delete Physical Therapy Notes",
        deletePlasticSurgeryAssessment: isHebrew ? "Delete Plastic Surgery Assessment" : "Delete Plastic Surgery Assessment",
        deletePlasticSurgeryConsultation: isHebrew ? "Cancel cosmetic consultation" : "Cancel cosmetic consultation",
        deletePlasticSurgeryConsultations: isHebrew ? "Delete Plastic Surgery Consultations" : "Delete Plastic Surgery Consultations",
        deletePmrAssessment: isHebrew ? "Delete Pmr Assessment" : "Delete Pmr Assessment",
        deletePneumoperitoneum: isHebrew ? "Delete Pneumoperitoneum" : "Delete Pneumoperitoneum",
        deletePodiatryExamination: isHebrew ? "Delete Podiatry Examination" : "Delete Podiatry Examination",
        deletePodiatryExaminations: isHebrew ? "Delete Podiatry Examinations" : "Delete Podiatry Examinations",
        deletePointOfCareUltrasoundHeartRate: isHebrew ? "Delete Point Of Care Ultrasound Heart Rate" : "Delete Point Of Care Ultrasound Heart Rate",
        deletePoisonControlReport: isHebrew ? "Delete Poison Report" : "Delete Poison Report",
        deletePoisonControlReports: isHebrew ? "Delete Poison Control Reports" : "Delete Poison Control Reports",
        deletePolycysticKidneyDisease: isHebrew ? "Delete Polycystic Kidney Disease" : "Delete Polycystic Kidney Disease",
        deletePolypharmacy: isHebrew ? "Delete Polypharmacy" : "Delete Polypharmacy",
        deletePolypharmacyReview: isHebrew ? "Remove medication review" : "Remove medication review",
        deletePolypharmacyReviews: isHebrew ? "Delete Polypharmacy Reviews" : "Delete Polypharmacy Reviews",
        deletePortPlacement: isHebrew ? "Delete Port Placement" : "Delete Port Placement",
        deletePostDialysisAssessment: isHebrew ? "Delete Post Dialysis Assessment" : "Delete Post Dialysis Assessment",
        deletePostoperativeOrders: isHebrew ? "Delete Postoperative Orders" : "Delete Postoperative Orders",
        deletePostoperativePainManagement: isHebrew ? "Delete Postoperative Pain Management" : "Delete Postoperative Pain Management",
        deletePostOperativeReports: isHebrew ? "Delete Post Operative Reports" : "Delete Post Operative Reports",
        deletePostOpTesting: isHebrew ? "Delete Post Op Testing" : "Delete Post Op Testing",
        deletePostOperativeReport: isHebrew ? "Delete Patient Report" : "Delete Patient Report",
        deletePostopTesting: isHebrew ? "Delete Postop Testing" : "Delete Postop Testing",
        deletePostoperativeCondition: isHebrew ? "Delete Postoperative Condition" : "Delete Postoperative Condition",
        deletePostoperativeOrder: isHebrew ? "Delete Postoperative Order" : "Delete Postoperative Order",
        deletePostpartumDiabetesRisk: isHebrew ? "Delete Postpartum Diabetes Risk" : "Delete Postpartum Diabetes Risk",
        deletePostpartumGlucoseMonitoring: isHebrew ? "Delete Postpartum Glucose Monitoring" : "Delete Postpartum Glucose Monitoring",
        deletePostpartumNote: isHebrew ? "Delete Postpartum Note" : "Delete Postpartum Note",
        deletePostpartumNotes: isHebrew ? "Delete Postpartum Notes" : "Delete Postpartum Notes",
        deletePostpartumPlanning: isHebrew ? "Delete Postpartum Planning" : "Delete Postpartum Planning",
        deletePotentialTestingOutcome: isHebrew ? "Delete Potential Testing Outcome" : "Delete Potential Testing Outcome",
        deletePotentialTestingOutcomes: isHebrew ? "Delete Potential Testing Outcomes" : "Delete Potential Testing Outcomes",
        deletePreChemotherapyWorkup: isHebrew ? "Delete Pre Chemotherapy Workup" : "Delete Pre Chemotherapy Workup",
        deletePreDialysisAssessment: isHebrew ? "Delete Pre Dialysis Assessment" : "Delete Pre Dialysis Assessment",
        deletePreEmploymentPhysical: isHebrew ? "Delete Pre Employment Physical" : "Delete Pre Employment Physical",
        deletePregnancyComplications: isHebrew ? "Delete Pregnancy Complications" : "Delete Pregnancy Complications",
        deletePregnancySymptoms: isHebrew ? "Delete Pregnancy Symptoms" : "Delete Pregnancy Symptoms",
        deletePrenatalTestingReports: isHebrew ? "Delete Prenatal Testing Reports" : "Delete Prenatal Testing Reports",
        deletePrenatalVisits: isHebrew ? "Delete Prenatal Visits" : "Delete Prenatal Visits",
        deletePreOperativeAssessment: isHebrew ? "Remove Patient Assessment" : "Remove Patient Assessment",
        deletePreOperativeAssessments: isHebrew ? "Delete Pre Operative Assessments" : "Delete Pre Operative Assessments",
        deletePreoperativeEvaluation: isHebrew ? "Delete Preoperative Evaluation" : "Delete Preoperative Evaluation",
        deletePreOperativePreparation: isHebrew ? "Delete Pre Operative Preparation" : "Delete Pre Operative Preparation",
        deletePrePregnancyWeight: isHebrew ? "Delete Pre Pregnancy Weight" : "Delete Pre Pregnancy Weight",
        deletePreconceptionCounseling: isHebrew ? "Delete Preconception Counseling" : "Delete Preconception Counseling",
        deletePreeclampsiaMonitoring: isHebrew ? "Delete Preeclampsia Monitoring" : "Delete Preeclampsia Monitoring",
        deletePregnancyComplication: isHebrew ? "Delete Pregnancy Complication" : "Delete Pregnancy Complication",
        deletePregnancyCourse: isHebrew ? "Delete Pregnancy Course" : "Delete Pregnancy Course",
        deletePregnancyRiskAssessment: isHebrew ? "Delete Pregnancy Risk Assessment" : "Delete Pregnancy Risk Assessment",
        deletePregnancySymptom: isHebrew ? "Delete Pregnancy Symptom" : "Delete Pregnancy Symptom",
        deletePrenatalEducation: isHebrew ? "Delete Prenatal Education" : "Delete Prenatal Education",
        deletePrenatalScreening: isHebrew ? "Delete Prenatal Screening" : "Delete Prenatal Screening",
        deletePrenatalTestingReport: isHebrew ? "Delete prenatal report" : "Delete prenatal report",
        deletePrenatalVisit: isHebrew ? "Delete prenatal visit" : "Delete prenatal visit",
        deletePreoperativePreparation: isHebrew ? "Delete Preoperative Preparation" : "Delete Preoperative Preparation",
        deletePrepAndDrape: isHebrew ? "Delete Prep And Drape" : "Delete Prep And Drape",
        deletePrescription: isHebrew ? "Delete Prescription" : "Delete Prescription",
        deletePrescriptions: isHebrew ? "Remove prescription record" : "Remove prescription record",
        deletePressureInjury: isHebrew ? "Delete Pressure Injury" : "Delete Pressure Injury",
        deletePressureUlcerRisk: isHebrew ? "Delete Pressure Ulcer Risk" : "Delete Pressure Ulcer Risk",
        deletePreventiveBiomarker: isHebrew ? "Delete Preventive Biomarker" : "Delete Preventive Biomarker",
        deletePreventiveBiomarkers: isHebrew ? "Delete Preventive Biomarkers" : "Delete Preventive Biomarkers",
        deletePreventiveCare: isHebrew ? "Delete Preventive Care" : "Delete Preventive Care",
        deletePreventiveMedicineAssessment: isHebrew ? "Delete Preventive Medicine Assessment" : "Delete Preventive Medicine Assessment",
        deletePreventiveMedicineAssessments: isHebrew ? "Delete Preventive Medicine Assessments" : "Delete Preventive Medicine Assessments",
        deletePrimaryProphylaxi: isHebrew ? "Delete Primary Prophylaxi" : "Delete Primary Prophylaxi",
        deletePrimaryProphylaxis: isHebrew ? "Delete Primary Prophylaxis" : "Delete Primary Prophylaxis",
        deletePriorAuthorizationForm: isHebrew ? "Delete Authorization Form" : "Delete Authorization Form",
        deletePriorAuthorizationForms: isHebrew ? "Delete Prior Authorization Forms" : "Delete Prior Authorization Forms",
        deletePriorAuthorizationStatu: isHebrew ? "Delete Prior Authorization Statu" : "Delete Prior Authorization Statu",
        deletePriorAuthorizationStatus: isHebrew ? "Delete Prior Authorization Status" : "Delete Prior Authorization Status",
        deletePrnMedication: isHebrew ? "Delete Prn Medication" : "Delete Prn Medication",
        deletePrnMedications: isHebrew ? "Delete Prn Medications" : "Delete Prn Medications",
        deleteProceduralSedation: isHebrew ? "Delete Procedural Sedation" : "Delete Procedural Sedation",
        deleteProcedureRequests: isHebrew ? "Delete Procedure Requests" : "Delete Procedure Requests",
        deleteProceduresIntervention: isHebrew ? "Delete Procedures Intervention" : "Delete Procedures Intervention",
        deleteProceduresInterventions: isHebrew ? "Delete Procedures Interventions" : "Delete Procedures Interventions",
        deletePrognosi: isHebrew ? "Delete Prognosi" : "Delete Prognosi",
        deletePrognosis: isHebrew ? "Delete Prognosis Assessment" : "Delete Prognosis Assessment",
        deletePrognosisDiscussion: isHebrew ? "Delete Prognosis Discussion" : "Delete Prognosis Discussion",
        deletePrognosisRecord: isHebrew ? "Delete medical record" : "Delete medical record",
        deletePrognosisRecords: isHebrew ? "Delete Prognosis Records" : "Delete Prognosis Records",
        deletePrognosticFactor: isHebrew ? "Delete Prognostic Factor" : "Delete Prognostic Factor",
        deletePrognosticFactors: isHebrew ? "Delete Prognostic Factors" : "Delete Prognostic Factors",
        deleteProgressNote: isHebrew ? "Delete Patient Note" : "Delete Patient Note",
        deleteProgressNotes: isHebrew ? "Delete Progress Notes" : "Delete Progress Notes",
        deleteProphylacticMedication: isHebrew ? "Delete Prophylactic Medication" : "Delete Prophylactic Medication",
        deleteProphylacticMedications: isHebrew ? "Delete Prophylactic Medications" : "Delete Prophylactic Medications",
        deleteProposedArtSwitch: isHebrew ? "Delete Proposed Art Switch" : "Delete Proposed Art Switch",
        deleteProteinuriaAssessment: isHebrew ? "Delete Proteinuria Assessment" : "Delete Proteinuria Assessment",
        deleteProviderInfo: isHebrew ? "Delete Provider Info" : "Delete Provider Info",
        deletePscManagement: isHebrew ? "Delete Psc Management" : "Delete Psc Management",
        deletePsychiatricAssessmentScale: isHebrew ? "Delete Psychiatric Assessment Scale" : "Delete Psychiatric Assessment Scale",
        deletePsychiatricAssessmentScales: isHebrew ? "Delete Psychiatric Assessment Scales" : "Delete Psychiatric Assessment Scales",
        deletePsychiatricDischargeSummaries: isHebrew ? "Delete Psychiatric Discharge Summaries" : "Delete Psychiatric Discharge Summaries",
        deletePsychiatricDischargeSummary: isHebrew ? "Delete Psychiatric Summary" : "Delete Psychiatric Summary",
        deletePsychiatricEvaluation: isHebrew ? "Remove Psychiatric Evaluation" : "Remove Psychiatric Evaluation",
        deletePsychiatricEvaluations: isHebrew ? "Delete Psychiatric Evaluations" : "Delete Psychiatric Evaluations",
        deletePsychiatricHistory: isHebrew ? "Delete Psychiatric History" : "Delete Psychiatric History",
        deletePsychiatricProgressNote: isHebrew ? "Delete Psychiatric Note" : "Delete Psychiatric Note",
        deletePsychiatricProgressNotes: isHebrew ? "Delete Psychiatric Progress Notes" : "Delete Psychiatric Progress Notes",
        deletePsychiatricReview: isHebrew ? "Delete Psychiatric Review" : "Delete Psychiatric Review",
        deletePsychiatricTreatmentPlan: isHebrew ? "Delete Psychiatric Treatment Plan" : "Delete Psychiatric Treatment Plan",
        deletePsychosocialAssessment: isHebrew ? "Delete Psychosocial Assessment" : "Delete Psychosocial Assessment",
        deletePsychosocialAssessments: isHebrew ? "Delete Psychosocial Assessments" : "Delete Psychosocial Assessments",
        deletePsychosocialFactor: isHebrew ? "Delete Psychosocial Factor" : "Delete Psychosocial Factor",
        deletePsychosocialFactors: isHebrew ? "Delete Psychosocial Factors" : "Delete Psychosocial Factors",
        deletePsychosocialOncology: isHebrew ? "Delete Psychosocial Oncology" : "Delete Psychosocial Oncology",
        deletePsychosocialSupportService: isHebrew ? "Delete Psychosocial Support Service" : "Delete Psychosocial Support Service",
        deletePsychosocialSupportServices: isHebrew ? "Delete Psychosocial Support Services" : "Delete Psychosocial Support Services",
        deletePsychotropicMedication: isHebrew ? "Delete Psychotropic Medication" : "Delete Psychotropic Medication",
        deletePsychotropicMedications: isHebrew ? "Delete Psychotropic Medications" : "Delete Psychotropic Medications",
        deletePulmonaryFunctionTest: isHebrew ? "Delete Lung Test" : "Delete Lung Test",
        deletePulmonaryFunctionTests: isHebrew ? "Delete Pulmonary Function Tests" : "Delete Pulmonary Function Tests",
        deletePulmonaryImaging: isHebrew ? "Delete Pulmonary Imaging" : "Delete Pulmonary Imaging",
        deletePulmonaryRehabilitation: isHebrew ? "Delete Pulmonary Rehabilitation" : "Delete Pulmonary Rehabilitation",
        deletePulmonaryRehabilitationNote: isHebrew ? "Delete Pulmonary Rehabilitation" : "Delete Pulmonary Rehabilitation",
        deletePulmonaryRehabilitationNotes: isHebrew ? "Delete Pulmonary Rehabilitation Notes" : "Delete Pulmonary Rehabilitation Notes",
        deletePulmonologyConsultation: isHebrew ? "Remove Pulmonology Consultation" : "Remove Pulmonology Consultation",
        deletePulmonologyConsultations: isHebrew ? "Delete Pulmonology Consultations" : "Delete Pulmonology Consultations",
        deletePumpAdvancedSetting: isHebrew ? "Delete Pump Advanced Setting" : "Delete Pump Advanced Setting",
        deletePumpAdvancedSettings: isHebrew ? "Delete Pump Advanced Settings" : "Delete Pump Advanced Settings",
        deletePumpDownloadAnalysi: isHebrew ? "Delete Pump Download Analysi" : "Delete Pump Download Analysi",
        deletePumpDownloadAnalysis: isHebrew ? "Delete Pump Download Analysis" : "Delete Pump Download Analysis",
        deleteQualityAssurance: isHebrew ? "Delete Quality Assurance" : "Delete Quality Assurance",
        deleteQualityMetric: isHebrew ? "Delete Quality Metric" : "Delete Quality Metric",
        deleteQualityMetrics: isHebrew ? "Delete Quality Metrics" : "Delete Quality Metrics",
        deleteRadiationOncology: isHebrew ? "Delete Radiation Oncology" : "Delete Radiation Oncology",
        deleteRadiationTherapy: isHebrew ? "Delete Radiation Therapy" : "Delete Radiation Therapy",
        deleteRadiationTherapyRecord: isHebrew ? "Delete radiation record" : "Delete radiation record",
        deleteRadiationTherapyRecords: isHebrew ? "Delete Radiation Therapy Records" : "Delete Radiation Therapy Records",
        deleteRadiologyFinding: isHebrew ? "Delete Radiology Finding" : "Delete Radiology Finding",
        deleteRadiologyFindings: isHebrew ? "Delete Radiology Findings" : "Delete Radiology Findings",
        deleteRadiologyReport: isHebrew ? "Delete radiology report" : "Delete radiology report",
        deleteRadiologyReports: isHebrew ? "Delete Radiology Reports" : "Delete Radiology Reports",
        deleteRapidResponseSummaries: isHebrew ? "Delete Rapid Response Summaries" : "Delete Rapid Response Summaries",
        deleteRapidResponseSummary: isHebrew ? "Delete Response Summary" : "Delete Response Summary",
        deleteReadmissionRiskAssessment: isHebrew ? "Delete Readmission Risk Assessment" : "Delete Readmission Risk Assessment",
        deleteReasonForReferral: isHebrew ? "Delete Reason For Referral" : "Delete Reason For Referral",
        deleteRecommendation: isHebrew ? "Remove recommendation item" : "Remove recommendation item",
        deleteReferral: isHebrew ? "Remove referral record" : "Remove referral record",
        deleteReferrals: isHebrew ? "Delete Referrals" : "Delete Referrals",
        deleteReferralsPlaced: isHebrew ? "Delete Referrals Placed" : "Delete Referrals Placed",
        deleteRegionalAnesthesiaRecords: isHebrew ? "Delete Regional Anesthesia Records" : "Delete Regional Anesthesia Records",
        deleteRehabilitationGoals: isHebrew ? "Delete Rehabilitation Goals" : "Delete Rehabilitation Goals",
        deleteRehabilitationProgressNote: isHebrew ? "Delete Rehabilitation Note" : "Delete Rehabilitation Note",
        deleteRehabilitationProgressNotes: isHebrew ? "Delete Rehabilitation Progress Notes" : "Delete Rehabilitation Progress Notes",
        deleteRehabilitationProtocol: isHebrew ? "Delete Rehabilitation Protocol" : "Delete Rehabilitation Protocol",
        deleteReminder: isHebrew ? "מחק תזכורת" : "Delete reminder",
        deleteRenalAnemia: isHebrew ? "Delete Renal Anemia" : "Delete Renal Anemia",
        deleteRenalNutrition: isHebrew ? "Delete Renal Nutrition" : "Delete Renal Nutrition",
        deleteRenalProtectionPlan: isHebrew ? "Delete Renal Protection Plan" : "Delete Renal Protection Plan",
        deleteReproductiveHistory: isHebrew ? "Delete Reproductive History" : "Delete Reproductive History",
        deleteRescueTherapyOption: isHebrew ? "Delete Rescue Therapy Option" : "Delete Rescue Therapy Option",
        deleteRescueTherapyOptions: isHebrew ? "Delete Rescue Therapy Options" : "Delete Rescue Therapy Options",
        deleteResearchConsentForm: isHebrew ? "Delete research consent" : "Delete research consent",
        deleteResearchConsentForms: isHebrew ? "Delete Research Consent Forms" : "Delete Research Consent Forms",
        deleteRespiratoryDevice: isHebrew ? "Delete Respiratory Device" : "Delete Respiratory Device",
        deleteRespiratoryDevices: isHebrew ? "Delete Respiratory Devices" : "Delete Respiratory Devices",
        deleteRespiratoryInfection: isHebrew ? "Delete Respiratory Infection" : "Delete Respiratory Infection",
        deleteRespiratoryInfections: isHebrew ? "Delete Respiratory Infections" : "Delete Respiratory Infections",
        deleteRespiratoryMedication: isHebrew ? "Delete Respiratory Medication" : "Delete Respiratory Medication",
        deleteRespiratoryMedications: isHebrew ? "Delete Respiratory Medications" : "Delete Respiratory Medications",
        deleteRespiteCare: isHebrew ? "Delete Respite Care" : "Delete Respite Care",
        deleteResponseAssessment: isHebrew ? "Delete Response Assessment" : "Delete Response Assessment",
        deleteResuscitationRecords: isHebrew ? "Delete Resuscitation Records" : "Delete Resuscitation Records",
        deleteRetinalExamination: isHebrew ? "Delete Retinal Exam" : "Delete Retinal Exam",
        deleteRetinalExaminations: isHebrew ? "Delete Retinal Examinations" : "Delete Retinal Examinations",
        deleteReturnToPlayProtocol: isHebrew ? "Delete Return To Play Protocol" : "Delete Return To Play Protocol",
        deleteReturnToSport: isHebrew ? "Delete Return To Sport" : "Delete Return To Sport",
        deleteReturnToWorkPlan: isHebrew ? "Delete Return To Work Plan" : "Delete Return To Work Plan",
        deleteReviewOfSystem: isHebrew ? "Delete Review Of System" : "Delete Review Of System",
        deleteReviewOfSystems: isHebrew ? "Delete Review Of Systems" : "Delete Review Of Systems",
        deleteRheumatoidArthritisAssessment: isHebrew ? "Delete Rheumatoid Arthritis Assessment" : "Delete Rheumatoid Arthritis Assessment",
        deleteRheumatologicAssessment: isHebrew ? "Delete Rheumatologic Assessment" : "Delete Rheumatologic Assessment",
        deleteRheumatologicMonitoring: isHebrew ? "Delete Rheumatologic Monitoring" : "Delete Rheumatologic Monitoring",
        deleteRheumatologicTreatment: isHebrew ? "Delete Rheumatologic Treatment" : "Delete Rheumatologic Treatment",
        deleteRheumatologyConsultation: isHebrew ? "Delete Rheumatology Consultation" : "Delete Rheumatology Consultation",
        deleteRheumatologyConsultations: isHebrew ? "Delete Rheumatology Consultations" : "Delete Rheumatology Consultations",
        deleteRiskCalculator: isHebrew ? "Delete Risk Calculator" : "Delete Risk Calculator",
        deleteRiskCalculators: isHebrew ? "Delete Risk Calculators" : "Delete Risk Calculators",
        deleteRiskCounseling: isHebrew ? "Delete Risk Counseling" : "Delete Risk Counseling",
        deleteRiskFactor: isHebrew ? "Remove Risk Factor" : "Remove Risk Factor",
        deleteRiskFactors: isHebrew ? "Delete Risk Factors" : "Delete Risk Factors",
        deleteSafetyPlanning: isHebrew ? "Delete Safety Planning" : "Delete Safety Planning",
        deleteScheduledMedication: isHebrew ? "Delete Scheduled Medication" : "Delete Scheduled Medication",
        deleteScheduledMedications: isHebrew ? "Delete Scheduled Medications" : "Delete Scheduled Medications",
        deleteSchoolHealthForm: isHebrew ? "Delete School Health Form" : "Delete School Health Form",
        deleteSchoolHealthForms: isHebrew ? "Delete School Health Forms" : "Delete School Health Forms",
        deleteSchoolPerformance: isHebrew ? "Delete School Performance" : "Delete School Performance",
        deleteSclerodermaAssessment: isHebrew ? "Delete Scleroderma Assessment" : "Delete Scleroderma Assessment",
        deleteScreeningCompliance: isHebrew ? "Delete Screening Compliance" : "Delete Screening Compliance",
        deleteSecondaryProphylaxis: isHebrew ? "Delete Secondary Prophylaxis" : "Delete Secondary Prophylaxis",
        deleteSecondOpinionReport: isHebrew ? "Delete Second Opinion" : "Delete Second Opinion",
        deleteSecondaryProphylaxi: isHebrew ? "Delete Secondary Prophylaxi" : "Delete Secondary Prophylaxi",
        deleteSecondOpinionReports: isHebrew ? "Delete Second Opinion Reports" : "Delete Second Opinion Reports",
        deleteSedationRecords: isHebrew ? "Delete Sedation Records" : "Delete Sedation Records",
        deleteSepsisManagement: isHebrew ? "Delete Sepsis Management" : "Delete Sepsis Management",
        deleteShiftHandoffNote: isHebrew ? "Delete Shift Note" : "Delete Shift Note",
        deleteShiftHandoffNotes: isHebrew ? "Delete Shift Handoff Notes" : "Delete Shift Handoff Notes",
        deleteSingleEmbryoTransfer: isHebrew ? "Delete Single Embryo Transfer" : "Delete Single Embryo Transfer",
        deleteSingleEmbryoTransferDetail: isHebrew ? "Delete Single Embryo Transfer Detail" : "Delete Single Embryo Transfer Detail",
        deleteSingleEmbryoTransferDetails: isHebrew ? "Delete Single Embryo Transfer Details" : "Delete Single Embryo Transfer Details",
        deleteSjogrensSyndromeAssessment: isHebrew ? "Delete Sjogrens Syndrome Assessment" : "Delete Sjogrens Syndrome Assessment",
        deleteSkinBiopsyReport: isHebrew ? "Delete skin biopsy" : "Delete skin biopsy",
        deleteSkinBiopsyReports: isHebrew ? "Delete Skin Biopsy Reports" : "Delete Skin Biopsy Reports",
        deleteSleepApneaManagement: isHebrew ? "Delete Sleep Apnea Management" : "Delete Sleep Apnea Management",
        deleteSleepDisorderAssessment: isHebrew ? "Delete Sleep Disorder Assessment" : "Delete Sleep Disorder Assessment",
        deleteSleepDisturbance: isHebrew ? "Delete Sleep Disturbance" : "Delete Sleep Disturbance",
        deleteSleepDisturbances: isHebrew ? "Delete Sleep Disturbances" : "Delete Sleep Disturbances",
        deleteSleepHygieneEducation: isHebrew ? "Delete Sleep Hygiene Education" : "Delete Sleep Hygiene Education",
        deleteSleepStudyReport: isHebrew ? "Delete Sleep Study" : "Delete Sleep Study",
        deleteSleepStudyReports: isHebrew ? "Delete Sleep Study Reports" : "Delete Sleep Study Reports",
        deleteSoapNote: isHebrew ? "Delete patient note" : "Delete patient note",
        deleteSoapNotes: isHebrew ? "Delete Soap Notes" : "Delete Soap Notes",
        deleteSocialDeterminantsOfHealth: isHebrew ? "Delete Social Determinants Of Health" : "Delete Social Determinants Of Health",
        deleteSocialFunctionalAssessment: isHebrew ? "Delete Social Functional Assessment" : "Delete Social Functional Assessment",
        deleteSocialHistory: isHebrew ? "Delete Social History" : "Delete Social History",
        deleteSocialSupport: isHebrew ? "Delete Social Support" : "Delete Social Support",
        deleteSocialWork: isHebrew ? "Delete Social Work" : "Delete Social Work",
        deleteSocialWorkNote: isHebrew ? "Delete Social Work Note" : "Delete Social Work Note",
        deleteSocialWorkNotes: isHebrew ? "Delete Social Work Notes" : "Delete Social Work Notes",
        deleteSource: isHebrew ? "Delete Source" : "Delete Source",
        deleteSouthAsianNutritionist: isHebrew ? "Delete South Asian Nutritionist" : "Delete South Asian Nutritionist",
        deleteSpecialtyField: isHebrew ? "Delete Specialty Field" : "Delete Specialty Field",
        deleteSpecialtyFields: isHebrew ? "Delete Specialty Fields" : "Delete Specialty Fields",
        deleteSpecificIgeTest: isHebrew ? "Delete IGE Test" : "Delete IGE Test",
        deleteSpecificIgeTests: isHebrew ? "Delete Specific Ige Tests" : "Delete Specific Ige Tests",
        deleteSpecimen: isHebrew ? "Delete Specimen" : "Delete Specimen",
        deleteSpecimens: isHebrew ? "Delete Specimens" : "Delete Specimens",
        deleteSpeechTherapyAssessment: isHebrew ? "Delete speech assessment" : "Delete speech assessment",
        deleteSpeechTherapyAssessments: isHebrew ? "Delete Speech Therapy Assessments" : "Delete Speech Therapy Assessments",
        deleteSpondyloarthritisAssessment: isHebrew ? "Delete Spondyloarthritis Assessment" : "Delete Spondyloarthritis Assessment",
        deleteSpongeInstrumentCount: isHebrew ? "Delete Sponge Instrument Count" : "Delete Sponge Instrument Count",
        deleteSpongeInstrumentCounts: isHebrew ? "Delete Sponge Instrument Counts" : "Delete Sponge Instrument Counts",
        deleteSportsMedicineEvaluation: isHebrew ? "Delete Sports Medicine Evaluation" : "Delete Sports Medicine Evaluation",
        deleteSportsMedicineEvaluations: isHebrew ? "Delete Sports Medicine Evaluations" : "Delete Sports Medicine Evaluations",
        deleteSportsNutritionPlan: isHebrew ? "Delete Sports Nutrition Plan" : "Delete Sports Nutrition Plan",
        deleteSportsPhysicalExamination: isHebrew ? "Delete Sports Physical Examination" : "Delete Sports Physical Examination",
        deleteStagingSummary: isHebrew ? "Delete Staging Summary" : "Delete Staging Summary",
        deleteStressManagementReferral: isHebrew ? "Delete Stress Management Referral" : "Delete Stress Management Referral",
        deleteStressManagementReferrals: isHebrew ? "Delete Stress Management Referrals" : "Delete Stress Management Referrals",
        deleteStressTestReport: isHebrew ? "Delete Stress Report" : "Delete Stress Report",
        deleteStressTestReports: isHebrew ? "Delete Stress Test Reports" : "Delete Stress Test Reports",
        deleteStrokeAssessment: isHebrew ? "Delete Stroke Assessment" : "Delete Stroke Assessment",
        deleteSubstanceUseAssessment: isHebrew ? "Delete Substance Use Assessment" : "Delete Substance Use Assessment",
        deleteSuicideRiskAssessment: isHebrew ? "Delete Suicide Risk Assessment" : "Delete Suicide Risk Assessment",
        deleteSupplementationPlan: isHebrew ? "Delete Supplementation Plan" : "Delete Supplementation Plan",
        deleteSupplementationPlans: isHebrew ? "Delete Supplementation Plans" : "Delete Supplementation Plans",
        deleteSupportGroupReferral: isHebrew ? "Delete Support Group Referral" : "Delete Support Group Referral",
        deleteSupportiveCare: isHebrew ? "Delete Supportive Care" : "Delete Supportive Care",
        deleteSurgicalApproach: isHebrew ? "Delete Surgical Approach" : "Delete Surgical Approach",
        deleteSurgicalConsentForm: isHebrew ? "Delete consent form" : "Delete consent form",
        deleteSurgicalConsentForms: isHebrew ? "Delete Surgical Consent Forms" : "Delete Surgical Consent Forms",
        deleteSurgicalHistory: isHebrew ? "Delete Surgical History" : "Delete Surgical History",
        deleteSurgicalOncology: isHebrew ? "Delete Surgical Oncology" : "Delete Surgical Oncology",
        deleteSurgicalStep: isHebrew ? "Delete Surgical Step" : "Delete Surgical Step",
        deleteSurgicalSteps: isHebrew ? "Delete Surgical Steps" : "Delete Surgical Steps",
        deleteSurgicalTeam: isHebrew ? "Delete Surgical Team" : "Delete Surgical Team",
        deleteSurvivorshipCarePlan: isHebrew ? "Delete Survivorship Care Plan" : "Delete Survivorship Care Plan",
        deleteSymptomProgression: isHebrew ? "Delete Symptom Progression" : "Delete Symptom Progression",
        deleteSymptomProgressionTimeline: isHebrew ? "Delete Symptom Progression Timeline" : "Delete Symptom Progression Timeline",
        deleteTelemedicineEncounter: isHebrew ? "Remove Telemedicine Encounter" : "Remove Telemedicine Encounter",
        deleteTelemedicineEncounters: isHebrew ? "Delete Telemedicine Encounters" : "Delete Telemedicine Encounters",
        deleteTherapyProgressNote: isHebrew ? "Delete therapy note" : "Delete therapy note",
        deleteTherapyProgressNotes: isHebrew ? "Delete Therapy Progress Notes" : "Delete Therapy Progress Notes",
        deleteTherapyRequests: isHebrew ? "Delete Therapy Requests" : "Delete Therapy Requests",
        deleteTherapySessionNote: isHebrew ? "Delete therapy note" : "Delete therapy note",
        deleteTherapySessionNotes: isHebrew ? "Delete Therapy Session Notes" : "Delete Therapy Session Notes",
        deleteThoracicSurgeryAssessment: isHebrew ? "Delete Thoracic Surgery Assessment" : "Delete Thoracic Surgery Assessment",
        deleteThyroidEvaluation: isHebrew ? "Remove thyroid assessment" : "Remove thyroid assessment",
        deleteThyroidEvaluations: isHebrew ? "Delete Thyroid Evaluations" : "Delete Thyroid Evaluations",
        deleteThyroidManagement: isHebrew ? "Delete Thyroid Management" : "Delete Thyroid Management",
        deleteTotalWeightGain: isHebrew ? "Delete Total Weight Gain" : "Delete Total Weight Gain",
        deleteTourniquetData: isHebrew ? "Delete Tourniquet Data" : "Delete Tourniquet Data",
        deleteToxicityAssessment: isHebrew ? "Delete Toxicity Assessment" : "Delete Toxicity Assessment",
        deleteToxicologyReport: isHebrew ? "Delete toxicology report" : "Delete toxicology report",
        deleteToxicologyReports: isHebrew ? "Delete Toxicology Reports" : "Delete Toxicology Reports",
        deleteTractographyStudies: isHebrew ? "Delete Tractography Studies" : "Delete Tractography Studies",
        deleteTractographyStudy: isHebrew ? "Delete Tractography Study" : "Delete Tractography Study",
        deleteTransferSummaries: isHebrew ? "Delete Transfer Summaries" : "Delete Transfer Summaries",
        deleteTransferSummary: isHebrew ? "Remove transfer summary" : "Remove transfer summary",
        deleteTransplantAssessment: isHebrew ? "Delete Transplant Assessment" : "Delete Transplant Assessment",
        deleteTransplantEvaluation: isHebrew ? "Remove Transplant Evaluation" : "Remove Transplant Evaluation",
        deleteTransplantEvaluations: isHebrew ? "Delete Transplant Evaluations" : "Delete Transplant Evaluations",
        deleteTraumaAssessment: isHebrew ? "Delete Trauma Assessment" : "Delete Trauma Assessment",
        deleteTraumaFlowSheet: isHebrew ? "Remove Trauma Record" : "Remove Trauma Record",
        deleteTraumaFlowSheets: isHebrew ? "Delete Trauma Flow Sheets" : "Delete Trauma Flow Sheets",
        deleteTraumaScoring: isHebrew ? "Delete Trauma Scoring" : "Delete Trauma Scoring",
        deleteTravelHealthCertificate: isHebrew ? "Delete Health Certificate" : "Delete Health Certificate",
        deleteTravelHealthCertificates: isHebrew ? "Delete Travel Health Certificates" : "Delete Travel Health Certificates",
        deleteTravelMedicineAssessment: isHebrew ? "Delete Travel Medicine Assessment" : "Delete Travel Medicine Assessment",
        deleteTravelVaccinationRecords: isHebrew ? "Delete Travel Vaccination Records" : "Delete Travel Vaccination Records",
        deleteTreatmentCours: isHebrew ? "Delete Treatment Cours" : "Delete Treatment Cours",
        deleteTreatmentCourses: isHebrew ? "Delete Treatment Courses" : "Delete Treatment Courses",
        deleteTreatmentGoal: isHebrew ? "Delete Treatment Goal" : "Delete Treatment Goal",
        deleteTreatmentGoals: isHebrew ? "Delete Treatment Goals" : "Delete Treatment Goals",
        deleteTreatmentPlan: isHebrew ? "Remove Treatment Plan" : "Remove Treatment Plan",
        deleteTreatmentPlans: isHebrew ? "Delete Treatment Plans" : "Delete Treatment Plans",
        deleteTreatmentSummary: isHebrew ? "Delete Treatment Summary" : "Delete Treatment Summary",
        deleteTrendAnalysi: isHebrew ? "Delete Trend Analysi" : "Delete Trend Analysi",
        deleteTrendAnalysis: isHebrew ? "Delete Trend Analysis" : "Delete Trend Analysis",
        deleteTrendingAnalysi: isHebrew ? "Delete Trending Analysis" : "Delete Trending Analysis",
        deleteTrendingAnalysis: isHebrew ? "Delete Trending Analysis" : "Delete Trending Analysis",
        deleteTriageData: isHebrew ? "Delete Triage Data" : "Delete Triage Data",
        deleteTropicalDiseaseAssessment: isHebrew ? "Delete Tropical Disease Assessment" : "Delete Tropical Disease Assessment",
        deleteTumorBoardNote: isHebrew ? "Delete Tumor Note" : "Delete Tumor Note",
        deleteTumorBoardNotes: isHebrew ? "Delete Tumor Board Notes" : "Delete Tumor Board Notes",
        deleteTumorMarker: isHebrew ? "Delete Tumor Marker" : "Delete Tumor Marker",
        deleteTumorMarkerPanel: isHebrew ? "Delete Tumor Markers" : "Delete Tumor Markers",
        deleteTumorMarkerPanels: isHebrew ? "Delete Tumor Marker Panels" : "Delete Tumor Marker Panels",
        deleteTumorMarkers: isHebrew ? "Delete Tumor Markers" : "Delete Tumor Markers",
        deleteUltrasoundObReport: isHebrew ? "Delete Ultrasound Report" : "Delete Ultrasound Report",
        deleteUltrasoundObReports: isHebrew ? "Delete Ultrasound Ob Reports" : "Delete Ultrasound Ob Reports",
        deleteUmbilicalArteryDoppler: isHebrew ? "Delete Umbilical Artery Doppler" : "Delete Umbilical Artery Doppler",
        deleteUnifiedMedicalDocument: isHebrew ? "Delete Unified Medical Document" : "Delete Unified Medical Document",
        deleteUrodynamicStudies: isHebrew ? "Delete Urodynamic Studies" : "Delete Urodynamic Studies",
        deleteUrodynamicStudy: isHebrew ? "Delete Urodynamic Study" : "Delete Urodynamic Study",
        deleteUrologyAssessment: isHebrew ? "Delete Urology Assessment" : "Delete Urology Assessment",
        deleteUrologyConsultation: isHebrew ? "Remove Urology Consultation" : "Remove Urology Consultation",
        deleteUrologyConsultations: isHebrew ? "Delete Urology Consultations" : "Delete Urology Consultations",
        deleteVaccinationRecord: isHebrew ? "Delete vaccination record" : "Delete vaccination record",
        deleteVaccinationRecords: isHebrew ? "Delete Vaccination Records" : "Delete Vaccination Records",
        deleteVariantInterpretationGuideline: isHebrew ? "Delete Variant Interpretation Guideline" : "Delete Variant Interpretation Guideline",
        deleteVariantInterpretationGuidelines: isHebrew ? "Delete Variant Interpretation Guidelines" : "Delete Variant Interpretation Guidelines",
        deleteVasculitisAssessment: isHebrew ? "Delete Vasculitis Assessment" : "Delete Vasculitis Assessment",
        deleteVenousThromboembolismRisk: isHebrew ? "Delete Venous Thromboembolism Risk" : "Delete Venous Thromboembolism Risk",
        deleteVentilatorSetting: isHebrew ? "Delete Ventilator Setting" : "Delete Ventilator Setting",
        deleteVentilatorSettings: isHebrew ? "Delete Ventilator Settings" : "Delete Ventilator Settings",
        deleteVisualAcuityReport: isHebrew ? "Delete Vision Report" : "Delete Vision Report",
        deleteVisualAcuityReports: isHebrew ? "Delete Visual Acuity Reports" : "Delete Visual Acuity Reports",
        deleteVitalSign: isHebrew ? "Remove vital sign" : "Remove vital sign",
        deleteVitalSigns: isHebrew ? "Delete Vital Signs" : "Delete Vital Signs",
        deleteVitalSignsLog: isHebrew ? "Delete Vital Signs" : "Delete Vital Signs",
        deleteVitalSignsLogs: isHebrew ? "Delete Vital Signs Logs" : "Delete Vital Signs Logs",
        deleteVitalSignsMonitoring: isHebrew ? "Delete Vital Signs Monitoring" : "Delete Vital Signs Monitoring",
        deleteVitalSignsTable: isHebrew ? "Delete Vital Signs Table" : "Delete Vital Signs Table",
        deleteWeeklyVirtualCheckIn: isHebrew ? "Delete Weekly Virtual Check In" : "Delete Weekly Virtual Check In",
        deleteWeeklyVirtualCheckIns: isHebrew ? "Delete Weekly Virtual Check Ins" : "Delete Weekly Virtual Check Ins",
        deleteWeightMeasurement: isHebrew ? "Delete Weight Measurement" : "Delete Weight Measurement",
        deleteWeightMeasurements: isHebrew ? "Delete Weight Measurements" : "Delete Weight Measurements",
        deleteWeightMonitoring: isHebrew ? "Delete Weight Monitoring" : "Delete Weight Monitoring",
        deleteWellChildExamination: isHebrew ? "Delete child exam" : "Delete child exam",
        deleteWellChildExaminations: isHebrew ? "Delete Well Child Examinations" : "Delete Well Child Examinations",
        deleteWellChildSummary: isHebrew ? "Delete Well Child Summary" : "Delete Well Child Summary",
        deleteWellnessVisitDocumentation: isHebrew ? "Delete Wellness Visit Documentation" : "Delete Wellness Visit Documentation",
        deleteWorkAccommodation: isHebrew ? "Delete Work Accommodation" : "Delete Work Accommodation",
        deleteWorkAccommodations: isHebrew ? "Delete Work Accommodations" : "Delete Work Accommodations",
        deleteWorkersCompensationEvaluation: isHebrew ? "Delete Workers Compensation Evaluation" : "Delete Workers Compensation Evaluation",
        deleteWorkersCompEvaluations: isHebrew ? "Delete Workers Comp Evaluations" : "Delete Workers Comp Evaluations",
        deleteWorkplaceAccommodations: isHebrew ? "Delete Workplace Accommodations" : "Delete Workplace Accommodations",
        deleteWorkplaceInjuryReport: isHebrew ? "Delete Workplace Injury Report" : "Delete Workplace Injury Report",
        deleteWorkRestriction: isHebrew ? "Delete Work Restriction" : "Delete Work Restriction",
        deleteWorkersCompEvaluation: isHebrew ? "Delete Workers Comp Evaluation" : "Delete Workers Comp Evaluation",
        deleteWorkplaceAccommodation: isHebrew ? "Delete Workplace Accommodation" : "Delete Workplace Accommodation",
        deleteWorkRestrictions: isHebrew ? "Delete Work Restrictions" : "Delete Work Restrictions",
        deleteWoundCareAssessment: isHebrew ? "Delete Wound Care Assessment" : "Delete Wound Care Assessment",
        deleteWoundCareAssessments: isHebrew ? "Delete Wound Care Assessments" : "Delete Wound Care Assessments",
        deleteWoundCareDocumentation: isHebrew ? "Delete wound documentation" : "Delete wound documentation",
        deleteWoundCareNote: isHebrew ? "Delete wound note" : "Delete wound note",
        deleteWoundCareNotes: isHebrew ? "Delete Wound Care Notes" : "Delete Wound Care Notes",
        description: isHebrew ? "חפש נתונים מנהליים" : "Search administrative data",
        disableCalendarSync: isHebrew ? "בטל סנכרון" : "Disable sync",
        enableCalendarSync: isHebrew ? "הפעל סנכרון" : "Enable sync",
        ensurePatientIdIndex: isHebrew ? "ודא אינדקס" : "Ensure index",
        exportAuditLogs: isHebrew ? "יצא לוגים" : "Export logs",
        findAvailableSlots: isHebrew ? "מצא זמנים" : "Find slots",
        findCoveredAlternatives: isHebrew ? "מצא חלופות מכוסות" : "Find covered drug alternatives",
        fuzzyPatientSearch: isHebrew ? "חיפוש מטופל (תיקון שגיאות)" : "Fuzzy patient search",
        generateClinicReport: isHebrew ? "דוח מרפאה" : "Practice report",
        generateComplianceReport: isHebrew ? "דוח ציות" : "Compliance report",
        generateDiagnosis: isHebrew ? "אבחון" : "Diagnosis",
        getAIClinicalInsights: isHebrew ? "תובנות קליניות AI" : "AI clinical insights",
        getAbnormalResults: isHebrew ? "Retrieve Abnormal Results" : "Retrieve Abnormal Results",
        getAccessPlanning: isHebrew ? "Retrieve Access Planning" : "Retrieve Access Planning",
        getAcmgGuidelinesReference: isHebrew ? "Retrieve Acmg Guidelines Reference" : "Retrieve Acmg Guidelines Reference",
        getAcuteKidneyInjury: isHebrew ? "Retrieve Acute Kidney Injury" : "Retrieve Acute Kidney Injury",
        getAddictionMedicineConsultations: isHebrew ? "Retrieve Addiction Medicine Consultations" : "Retrieve Addiction Medicine Consultations",
        getAdhdAssessment: isHebrew ? "Retrieve Adhd Assessment" : "Retrieve Adhd Assessment",
        getAdministrativeData: isHebrew ? "Retrieve Administrative Data" : "Retrieve Administrative Data",
        getAdmissionAssessments: isHebrew ? "Retrieve Admission Assessments" : "Retrieve Admission Assessments",
        getAdmissionDecisions: isHebrew ? "Retrieve Admission Decisions" : "Retrieve Admission Decisions",
        getAdmissionRecommendations: isHebrew ? "Retrieve Admission Recommendations" : "Retrieve Admission Recommendations",
        getAdultDayProgramInfo: isHebrew ? "Retrieve Adult Day Program Info" : "Retrieve Adult Day Program Info",
        getAdvanceCarePlanning: isHebrew ? "Retrieve Advance Care Planning" : "Retrieve Advance Care Planning",
        getAdvanceDirectiveDiscussion: isHebrew ? "Retrieve Advance Directive Discussion" : "Retrieve Advance Directive Discussion",
        getAdvanceDirectives: isHebrew ? "Retrieve Advance Directives" : "Retrieve Advance Directives",
        getGeriatricCarePlanning: isHebrew ? "Retrieve Advanced Care Planning" : "Retrieve Advanced Care Planning",
        getGoalsOfCareDiscussions: isHebrew ? "Retrieve Patient Directives" : "Retrieve Patient Directives",
        getAirwayManagementRecords: isHebrew ? "Retrieve Airway Management Records" : "Retrieve Airway Management Records",
        getAllergies: isHebrew ? "הצג אלרגיות" : "Get allergies",
        getAllergiesAssessments: isHebrew ? "Retrieve Allergy Assessments" : "Retrieve Allergy Assessments",
        getAllergyAssessments: isHebrew ? "Retrieve Allergy Assessments" : "Retrieve Allergy Assessments",
        getAllergyImmunologyAssessment: isHebrew ? "Retrieve Allergy Immunology Assessment" : "Retrieve Allergy Immunology Assessment",
        getAllergySkinTesting: isHebrew ? "Retrieve Allergy Skin Testing" : "Retrieve Allergy Skin Testing",
        getAmniocentesisReports: isHebrew ? "Retrieve Amniocentesis Reports" : "Retrieve Amniocentesis Reports",
        getAmnioticFluidAssessment: isHebrew ? "Retrieve Amniotic Fluid Assessment" : "Retrieve Amniotic Fluid Assessment",
        getAmnioticFluidIndexCurrent: isHebrew ? "Retrieve Amniotic Fluid Index Current" : "Retrieve Amniotic Fluid Index Current",
        getAnatomyScanResult: isHebrew ? "Retrieve Anatomy Scan Result" : "Retrieve Anatomy Scan Result",
        getAnesthesiaComplications: isHebrew ? "Retrieve Anesthesia Complications" : "Retrieve Anesthesia Complications",
        getAnesthesiaConsent: isHebrew ? "Retrieve Anesthesia Consent" : "Retrieve Anesthesia Consent",
        getAnesthesiaRecords: isHebrew ? "Retrieve Anesthesia Records" : "Retrieve Anesthesia Records",
        getAnesthesiologyAssessment: isHebrew ? "Retrieve Anesthesiology Assessment" : "Retrieve Anesthesiology Assessment",
        getAnnualPhysicalExamination: isHebrew ? "Retrieve Annual Physical Examination" : "Retrieve Annual Physical Examination",
        getAntibiogramReports: isHebrew ? "Retrieve Antibiogram Reports" : "Retrieve Antibiogram Reports",
        getAntibioticStewardship: isHebrew ? "Retrieve Antibiotic Stewardship" : "Retrieve Antibiotic Stewardship",
        getAnticipatoryGuidance: isHebrew ? "Retrieve Anticipatory Guidance" : "Retrieve Anticipatory Guidance",
        getAnticoagulationManagement: isHebrew ? "ניהול נוגדי קרישה" : "ANTICOAGULATION MANAGEMENT - Get anticoagulation therapy management records (warfarin, heparin, DOACs). Includes INR/aPTT monitoring, target ranges, dose adjustments, bleeding/thrombotic events, drug interactions, dietary considerations, and duration plans. Do NOT use getCoagulationStudies - that is for LAB RESULTS (PT, INR, PTT, fibrinogen, D-dimer), not therapy management.",
        getAntimicrobialSusceptibility: isHebrew ? "Retrieve Antimicrobial Susceptibility" : "Retrieve Antimicrobial Susceptibility",
        getApgarScores: isHebrew ? "Newborn health assessment" : "Newborn health assessment",
        getAppetiteStimulants: isHebrew ? "Retrieve Appetite Stimulants" : "Retrieve Appetite Stimulants",
        getAppointments: isHebrew ? "הצג תורים" : "Get appointments",
        getArterialBloodGases: isHebrew ? "Retrieve Arterial Blood Gases" : "Retrieve Arterial Blood Gases",
        getArthritisAssessments: isHebrew ? "Retrieve Arthritis Evaluations" : "Retrieve Arthritis Evaluations",
        getArticularCartilage: isHebrew ? "Retrieve Articular Cartilage" : "Retrieve Articular Cartilage",
        getAssessmentPlans: isHebrew ? "Retrieve Assessment Plans" : "Retrieve Assessment Plans",
        getAssistiveDevices: isHebrew ? "Retrieve Assistive Devices" : "Retrieve Assistive Devices",
        getAsthmaActionPlan: isHebrew ? "Retrieve Asthma Action Plan" : "Retrieve Asthma Action Plan",
        getAsthmaAssessments: isHebrew ? "Retrieve Asthma Assessments" : "Retrieve Asthma Assessments",
        getAsthmaManagementNotes: isHebrew ? "Retrieve Asthma Notes" : "Retrieve Asthma Notes",
        getAthleteSpecificData: isHebrew ? "Retrieve Athlete Specific Data" : "Retrieve Athlete Specific Data",
        getAthleticInjuryAssessment: isHebrew ? "Retrieve Athletic Injury Assessment" : "Retrieve Athletic Injury Assessment",
        getAudiometryReports: isHebrew ? "Retrieve Audiometry Records" : "Retrieve Audiometry Records",
        getAutoantibodyProfile: isHebrew ? "Retrieve Autoantibody Profile" : "Retrieve Autoantibody Profile",
        getAutoimmuneEvaluations: isHebrew ? "Retrieve Autoimmune Tests" : "Retrieve Autoimmune Tests",
        getAutoimmunePanels: isHebrew ? "Autoimmune Disease Screening" : "Autoimmune Disease Screening",
        getAutopsyReports: isHebrew ? "Retrieve Autopsy Documents" : "Retrieve Autopsy Documents",
        getBarriersPsychosocialIssues: isHebrew ? "חסמים ובעיות פסיכוסוציאליות" : "BARRIERS TO CARE AND PSYCHOSOCIAL ISSUES - Get patient BARRIERS to care (obstacles preventing access/adherence). Includes financial barriers, transportation issues, housing instability, food insecurity, SDOH social determinants, health literacy, language barriers, interventions provided, social work referrals. Use when user asks about 'barriers', 'obstacles to care', 'SDOH', 'social work'. NOT for clinical psychosocial assessments - use getPsychosocialAssessments instead.",
        getBasalRateAdjustments: isHebrew ? "Retrieve Basal Rate Adjustments" : "Retrieve Basal Rate Adjustments",
        getBehavioralAssessment: isHebrew ? "Retrieve Behavioral Assessment" : "Retrieve Behavioral Assessment",
        getBehavioralHealthGoals: isHebrew ? "Retrieve Behavioral Health Goals" : "Retrieve Behavioral Health Goals",
        getBiologicTherapy: isHebrew ? "Retrieve Biologic Therapy" : "Retrieve Biologic Therapy",
        getBiologicTherapyRecords: isHebrew ? "Retrieve Biologic Therapy Records" : "Retrieve Biologic Therapy Records",
        getBiopsyReports: isHebrew ? "Retrieve Medical Biopsy Reports" : "Retrieve Medical Biopsy Reports",
        getBiopsychosocialFormulation: isHebrew ? "Retrieve Biopsychosocial Formulation" : "Retrieve Biopsychosocial Formulation",
        getBirthHistory: isHebrew ? "Retrieve Birth History" : "Retrieve Birth History",
        getBirthPlan: isHebrew ? "Retrieve Birth Plan" : "Retrieve Birth Plan",
        getBleedingRiskAssessment: isHebrew ? "Retrieve Bleeding Risk Assessment" : "Retrieve Bleeding Risk Assessment",
        getBloodDisorderReports: isHebrew ? "Retrieve Blood Disorder Reports" : "Retrieve Blood Disorder Reports",
        getBloodGlucoseLogs: isHebrew ? "Track glucose readings" : "Track glucose readings",
        getBloodGlucoseMonitoring: isHebrew ? "Retrieve Blood Glucose Monitoring" : "Retrieve Blood Glucose Monitoring",
        getBloodPressureReadings: isHebrew ? "BLOOD PRESSURE READINGS - Get BP readings, home BP logs, office BP, systolic/diastolic history, hypertension tracking. Use for blood pressure specific data, NOT general vital signs." : "BLOOD PRESSURE READINGS - Get BP readings, home BP logs, office BP, systolic/diastolic history, hypertension tracking. Use for blood pressure specific data, NOT general vital signs.",
        getBloodProducts: isHebrew ? "Retrieve Blood Products" : "Retrieve Blood Products",
        getBloodProductsOrdered: isHebrew ? "Retrieve Blood Products Ordered" : "Retrieve Blood Products Ordered",
        getBloodSampleCollectionStatus: isHebrew ? "Retrieve Blood Sample Collection Status" : "Retrieve Blood Sample Collection Status",
        getBloodSmears: isHebrew ? "Retrieve Blood Smears" : "Retrieve Blood Smears",
        getBolusAdjustments: isHebrew ? "Retrieve Bolus Adjustments" : "Retrieve Bolus Adjustments",
        getBoneHealth: isHebrew ? "Retrieve Bone Health" : "Retrieve Bone Health",
        getBoneMarrowReports: isHebrew ? "Retrieve Bone Marrow Reports" : "Retrieve Bone Marrow Reports",
        getBoneMarrowStudies: isHebrew ? "Analyze bone marrow" : "Analyze bone marrow",
        getBoneScanReports: isHebrew ? "Retrieve Bone Scan Reports" : "Retrieve Bone Scan Reports",
        getBrainTumorCharacteristics: isHebrew ? "Retrieve Brain Tumor Details" : "Retrieve Brain Tumor Details",
        getBrainTumorMolecularMarkers: isHebrew ? "Retrieve Brain Tumor Molecular Markers" : "Retrieve Brain Tumor Molecular Markers",
        getBreastfeedingRecommendation: isHebrew ? "Retrieve Breastfeeding Recommendation" : "Retrieve Breastfeeding Recommendation",
        getCalendarSyncStatus: isHebrew ? "סטטוס סנכרון" : "Sync status",
        getCamIcu: isHebrew ? "Retrieve Cam Icu" : "Retrieve Cam Icu",
        getCancelledAppointments: isHebrew ? "הצג תורים מבוטלים" : "Get cancelled appointments",
        getCancerDiagnosis: isHebrew ? "Retrieve Cancer Diagnosis" : "Retrieve Cancer Diagnosis",
        getCancerRelatedSideEffects: isHebrew ? "Retrieve Cancer Related Side Effects" : "Retrieve Cancer Related Side Effects",
        getCancerScreeningRecords: isHebrew ? "Retrieve Cancer Screening Records" : "Retrieve Cancer Screening Records",
        getCancerStaging: isHebrew ? "Retrieve Cancer Staging" : "Retrieve Cancer Staging",
        getCancerSurveillance: isHebrew ? "Retrieve Cancer Surveillance" : "Retrieve Cancer Surveillance",
        getCarbohydrateCountingEducation: isHebrew ? "Retrieve Carbohydrate Counting Education" : "Retrieve Carbohydrate Counting Education",
        getCardiacCatheterizationReports: isHebrew ? "Retrieve Cardiac Reports" : "Retrieve Cardiac Reports",
        getCardiacDeviceInterrogations: isHebrew ? "Retrieve Cardiac Device Interrogations" : "Retrieve Cardiac Device Interrogations",
        getCardiacMonitoring: isHebrew ? "Retrieve Cardiac Monitoring Records" : "Retrieve Cardiac Monitoring Records",
        getCardiacRehabilitationReports: isHebrew ? "Retrieve Cardiac Rehab Reports" : "Retrieve Cardiac Rehab Reports",
        getCardiologyAdmissionNotes: isHebrew ? "Retrieve Cardiology Admission Notes" : "Retrieve Cardiology Admission Notes",
        getCardiologyAssessment: isHebrew ? "Retrieve Cardiology Assessment" : "Retrieve Cardiology Assessment",
        getCardiologyConsultations: isHebrew ? "Request cardiac evaluations" : "Request cardiac evaluations",
        getCardiologyFollowupReports: isHebrew ? "Retrieve Cardiology Reports" : "Retrieve Cardiology Reports",
        getCardiovascularRiskReduction: isHebrew ? "Retrieve Cardiovascular Risk Reduction" : "Retrieve Cardiovascular Risk Reduction",
        getCardiovascularRiskScreening: isHebrew ? "Retrieve Cardiovascular Risk Screening" : "Retrieve Cardiovascular Risk Screening",
        getCareCoordination: isHebrew ? "Retrieve Care Coordination" : "Retrieve Care Coordination",
        getCareCoordinationNotes: isHebrew ? "Retrieve Care Notes" : "Retrieve Care Notes",
        getCareGaps: isHebrew ? "Retrieve Patient Gaps" : "Retrieve Patient Gaps",
        getCareTeam: isHebrew ? "Retrieve Care Team" : "Retrieve Care Team",
        getCareTeamInfo: isHebrew ? "Retrieve Care Team Info" : "Retrieve Care Team Info",
        getCaregiverAssessment: isHebrew ? "Retrieve Caregiver Assessment" : "Retrieve Caregiver Assessment",
        getCaregiverSupport: isHebrew ? "Retrieve Caregiver Support" : "Retrieve Caregiver Support",
        getCaregiverSupportGroups: isHebrew ? "Retrieve Caregiver Support Groups" : "Retrieve Caregiver Support Groups",
        getCascadeTestingProtocol: isHebrew ? "Retrieve Cascade Testing Protocol" : "Retrieve Cascade Testing Protocol",
        getCaseManagement: isHebrew ? "Retrieve Case Management" : "Retrieve Case Management",
        getCaseSummaries: isHebrew ? "Retrieve Case Summaries" : "Retrieve Case Summaries",
        getCellFreeDnaResult: isHebrew ? "Retrieve Cell Free Dna Result" : "Retrieve Cell Free Dna Result",
        getCervicalAssessment: isHebrew ? "Retrieve Cervical Assessment" : "Retrieve Cervical Assessment",
        getCervicalLengthMeasurement: isHebrew ? "Retrieve Cervical Length Measurement" : "Retrieve Cervical Length Measurement",
        getCesareanThreshold: isHebrew ? "Retrieve Cesarean Threshold" : "Retrieve Cesarean Threshold",
        getCgmData: isHebrew ? "Retrieve Cgm Data" : "Retrieve Cgm Data",
        getChallengeTests: isHebrew ? "Retrieve Challenge Tests" : "Retrieve Challenge Tests",
        getChemotherapyRecords: isHebrew ? "Retrieve Cancer Treatments" : "Retrieve Cancer Treatments",
        getChemotherapyRegimen: isHebrew ? "Retrieve Chemotherapy Regimen" : "Retrieve Chemotherapy Regimen",
        getChiefComplaints: isHebrew ? "Retrieve Chief Complaints" : "Retrieve Chief Complaints",
        getChildrenSpecificRisk: isHebrew ? "Retrieve Children Specific Risk" : "Retrieve Children Specific Risk",
        getChronicDiseaseGoals: isHebrew ? "Retrieve Chronic Disease Goals" : "Retrieve Chronic Disease Goals",
        getChronicDiseaseManagement: isHebrew ? "Retrieve Chronic Disease Management" : "Retrieve Chronic Disease Management",
        getChronicPainAssessment: isHebrew ? "Retrieve Chronic Pain Assessment" : "Retrieve Chronic Pain Assessment",
        getCkdAssessment: isHebrew ? "Retrieve Ckd Assessment" : "Retrieve Ckd Assessment",
        getCkdManagement: isHebrew ? "Retrieve Ckd Management" : "Retrieve Ckd Management",
        getClinicInfo: isHebrew ? "פרטי מרפאה" : "Practice info",
        getClinicStatistics: isHebrew ? "סטטיסטיקה" : "Statistics",
        getClinicalDecisionSupport: isHebrew ? "Retrieve medical guidance" : "Retrieve medical guidance",
        getClinicalRiskScores: isHebrew ? "Detailed Risk Assessments" : "CLINICAL RISK SCORES - Get detailed risk score assessments (APACHE II, SOFA, CHA2DS2-VASc, MELD, Wells, Child-Pugh). Use for comprehensive risk analysis with predicted mortality, morbidity, component scores, vital signs used, lab values, comorbidity factors, and treatment recommendations.",
        getClinicalScores: isHebrew ? "Calculate Patient Scores" : "CLINICAL SCORES - Get simple clinical score values (ASA, RCRI, Mallampati, NIHSS). Use for individual score values without detailed analysis.",
        getClinicalTrialDocuments: isHebrew ? "Retrieve Clinical Trial Docs" : "Retrieve Clinical Trial Docs",
        getClinicalTrials: isHebrew ? "Retrieve Clinical Trials" : "Retrieve Clinical Trials",
        getClosureTechnique: isHebrew ? "Retrieve Closure Technique" : "Retrieve Closure Technique",
        getCmvMonitoringPlan: isHebrew ? "Retrieve Cmv Monitoring Plan" : "Retrieve Cmv Monitoring Plan",
        getCoagulationStudies: isHebrew ? "Blood clotting tests" : "Blood clotting tests",
        getCodeBlueSummaries: isHebrew ? "Retrieve Code Blue Summaries" : "Retrieve Code Blue Summaries",
        getCognitiveEvaluations: isHebrew ? "Retrieve Cognitive Assessments" : "Retrieve Cognitive Assessments",
        getCognitiveRehabilitationReports: isHebrew ? "Retrieve Cognitive Rehabilitation Reports" : "Retrieve Cognitive Rehabilitation Reports",
        getCognitiveScreening: isHebrew ? "Retrieve Cognitive Screening" : "Retrieve Cognitive Screening",
        getCollectionsWithData: isHebrew ? "קולקציות עם נתונים" : "Collections with data",
        getColonoscopyReports: isHebrew ? "Retrieve Colonoscopy Documents" : "Retrieve Colonoscopy Documents",
        getColorectalColonoscopies: isHebrew ? "Screen Colon Cancer" : "Screen Colon Cancer",
        getColorectalSurgeryAssessment: isHebrew ? "Retrieve Colorectal Surgery Assessment" : "Retrieve Colorectal Surgery Assessment",
        getColorectalSurgeryConsultations: isHebrew ? "Colorectal Surgery Consultations" : "Colorectal Surgery Consultations",
        getCommunicationPreferences: isHebrew ? "Retrieve Communication Preferences" : "Retrieve Communication Preferences",
        getComplications: isHebrew ? "Retrieve Complications" : "Retrieve Complications",
        getComponentAllergenTesting: isHebrew ? "Retrieve Component Allergen Testing" : "Retrieve Component Allergen Testing",
        getComprehensiveCardiomyopathyPanel: isHebrew ? "Retrieve Comprehensive Cardiomyopathy Panel" : "Retrieve Comprehensive Cardiomyopathy Panel",
        getCompressionTherapy: isHebrew ? "Retrieve Compression Therapy" : "Retrieve Compression Therapy",
        getConcussionAssessment: isHebrew ? "Retrieve Concussion Assessment" : "Retrieve Concussion Assessment",
        getConnectiveTissueDiseaseAssessment: isHebrew ? "Retrieve Connective Tissue Disease Assessment" : "Retrieve Connective Tissue Disease Assessment",
        getConsultationDetails: isHebrew ? "פרטי ייעוץ מומחה מפורטים" : "CONSULTATION DETAILS - Get consultation details, specialist referrals, diagnostic impressions, therapeutic recommendations (use this when user asks for 'consultation details')",
        getConsultationNotes: isHebrew ? "הערות ייעוץ" : "CONSULTATION NOTES - Get consultation notes, clinical notes from specialist visits (use this when user asks for 'consultation notes')",
        getConsultationRequests: isHebrew ? "Retrieve Consultation Requests" : "Retrieve Consultation Requests",
        getConsultationTimeline: isHebrew ? "Retrieve Consultation Timeline" : "Retrieve Consultation Timeline",
        getContinuousGlucoseMonitor: isHebrew ? "Retrieve Continuous Glucose Monitor" : "Retrieve Continuous Glucose Monitor",
        getContinuousGlucoseMonitorDiscussion: isHebrew ? "Retrieve Continuous Glucose Monitor Discussion" : "Retrieve Continuous Glucose Monitor Discussion",
        getContinuousInfusions: isHebrew ? "Retrieve Continuous Infusions" : "Retrieve Continuous Infusions",
        getContractionMonitoring: isHebrew ? "Retrieve Contraction Monitoring" : "Retrieve Contraction Monitoring",
        getCopdAssessments: isHebrew ? "Retrieve COPD Assessments" : "Retrieve COPD Assessments",
        getCpapManagement: isHebrew ? "Retrieve Cpap Management" : "Retrieve Cpap Management",
        getCriticalViewOfSafety: isHebrew ? "Retrieve Critical View Of Safety" : "Retrieve Critical View Of Safety",
        getCulturalConsiderations: isHebrew ? "Retrieve Cultural Considerations" : "Retrieve Cultural Considerations",
        getCurrentDialysis: isHebrew ? "Retrieve Current Dialysis" : "Retrieve Current Dialysis",
        getCurrentPregnancy: isHebrew ? "Retrieve Current Pregnancy" : "Retrieve Current Pregnancy",
        getCystoscopyReports: isHebrew ? "Retrieve Cystoscopy Reports" : "Retrieve Cystoscopy Reports",
        getCytogenetics: isHebrew ? "Retrieve Cytogenetics" : "Retrieve Cytogenetics",
        getCytologyReports: isHebrew ? "Retrieve Cytology Reports" : "Retrieve Cytology Reports",
        getDataManagementInstructions: isHebrew ? "Retrieve Data Management Instructions" : "Retrieve Data Management Instructions",
        getDayPrograms: isHebrew ? "Retrieve Day Programs" : "Retrieve Day Programs",
        getDaytimeSleepinessAssessment: isHebrew ? "Retrieve Daytime Sleepiness Assessment" : "Retrieve Daytime Sleepiness Assessment",
        getDeepBrainStimulation: isHebrew ? "Retrieve Deep Brain Stimulation" : "Retrieve Deep Brain Stimulation",
        getDeliveryPlanning: isHebrew ? "Retrieve Delivery Planning" : "Retrieve Delivery Planning",
        getDementiaAssessment: isHebrew ? "Retrieve Dementia Assessment" : "Retrieve Dementia Assessment",
        getDementiaEducation: isHebrew ? "Retrieve Dementia Education" : "Retrieve Dementia Education",
        getDentalExaminationReports: isHebrew ? "Retrieve Dental Exam Reports" : "Retrieve Dental Exam Reports",
        getDepartment: isHebrew ? "Retrieve Department" : "Retrieve Department",
        getDepressionScreening: isHebrew ? "Retrieve Depression Screening" : "Retrieve Depression Screening",
        getDermatologyAssessment: isHebrew ? "Retrieve Dermatology Assessment" : "Retrieve Dermatology Assessment",
        getDermatologyConsultations: isHebrew ? "Retrieve Dermatology Consultations" : "Retrieve Dermatology Consultations",
        getDermatologyProcedureNotes: isHebrew ? "Retrieve Dermatology Notes" : "Retrieve Dermatology Notes",
        getDetailedFamilyPedigree: isHebrew ? "Retrieve Detailed Family Pedigree" : "Retrieve Detailed Family Pedigree",
        getDevelopmentalAssessments: isHebrew ? "Retrieve Developmental Assessments" : "Retrieve Developmental Assessments",
        getDevelopmentalMilestones: isHebrew ? "Retrieve Developmental Milestones" : "Retrieve Developmental Milestones",
        getDexaScanReports: isHebrew ? "Retrieve Dexa Scan Reports" : "Retrieve Dexa Scan Reports",
        getDiabetesEducation: isHebrew ? "Retrieve Diabetes Education" : "Retrieve Diabetes Education",
        getDiabetesEducator: isHebrew ? "Retrieve Diabetes Educator" : "Retrieve Diabetes Educator",
        getDiabetesEducatorTraining: isHebrew ? "Retrieve Diabetes Educator Training" : "Retrieve Diabetes Educator Training",
        getDiabetesManagement: isHebrew ? "DIABETES MANAGEMENT - רשומות ניהול סוכרת מלאות עם HbA1c, גלוקוז, אינסולין, סיבוכים. לא getDiabetesManagementNotes" : "DIABETES MANAGEMENT - Get full diabetes care records including HbA1c, glucose, insulin, complications, cardiovascular, lifestyle. Use for 'diabetes management', 'diabetes records', 'diabetic care'. NOTE: This is DIFFERENT from getDiabetesManagementNotes which is for clinical notes - use THIS function for diabetes management records",
        getDiabetesManagementNotes: isHebrew ? "DIABETES NOTES - הערות קליניות לניהול סוכרת. לא getDiabetesManagement" : "DIABETES NOTES - Get clinical documentation notes about diabetes management. Use ONLY when user specifically asks for 'diabetes notes' or 'dm notes'. NOTE: This is DIFFERENT from getDiabetesManagement which returns full diabetes care records - if user says 'diabetes management' without 'notes', use getDiabetesManagement instead",
        getDiabetesManagementPlan: isHebrew ? "Retrieve Diabetes Management Plan" : "Retrieve Diabetes Management Plan",
        getDiabetesQualityMetrics: isHebrew ? "Retrieve Diabetes Quality Metrics" : "Retrieve Diabetes Quality Metrics",
        getDiabetesSupplies: isHebrew ? "Retrieve Diabetes Supplies" : "Retrieve Diabetes Supplies",
        getDiabeticNephropathy: isHebrew ? "Retrieve Diabetic Nephropathy" : "Retrieve Diabetic Nephropathy",
        getDiagnoses: isHebrew ? "הצג אבחנות" : "Get diagnoses",
        getDiagnosticImpression: isHebrew ? "Retrieve Diagnostic Impression" : "Retrieve Diagnostic Impression",
        getDiagnosticStudies: isHebrew ? "Retrieve Diagnostic Studies" : "Retrieve Diagnostic Studies",
        getDialysateComposition: isHebrew ? "Retrieve Dialysate Composition" : "Retrieve Dialysate Composition",
        getDialysisPlanning: isHebrew ? "Retrieve Dialysis Planning" : "Retrieve Dialysis Planning",
        getDialysisPrescription: isHebrew ? "Retrieve Dialysis Prescription" : "Retrieve Dialysis Prescription",
        getDialysisRecords: isHebrew ? "Retrieve Dialysis Records" : "Retrieve Dialysis Records",
        getDialysisRunSheets: isHebrew ? "Retrieve Dialysis Records" : "Retrieve Dialysis Records",
        getDialyzer: isHebrew ? "Retrieve Dialyzer" : "Retrieve Dialyzer",
        getDietaryInterventions: isHebrew ? "Retrieve Dietary Interventions" : "Retrieve Dietary Interventions",
        getDisabilityEvaluations: isHebrew ? "Retrieve Disability Assessments" : "Retrieve Disability Assessments",
        getDischargePlanning: isHebrew ? "Retrieve Discharge Planning" : "Retrieve Discharge Planning",
        getDischargeSummaries: isHebrew ? "Retrieve Patient Discharge" : "Retrieve Patient Discharge",
        getDiseaseActivityScores: isHebrew ? "Retrieve Disease Activity Scores" : "Retrieve Disease Activity Scores",
        getDiseaseSeverity: isHebrew ? "Retrieve Disease Severity" : "Retrieve Disease Severity",
        getDnrOrders: isHebrew ? "Retrieve DNR orders" : "Retrieve DNR orders",
        getDoctorsMedicationRecommendations: isHebrew ? "Retrieve Doctors Medication Recommendations" : "Retrieve Doctors Medication Recommendations",
        getDoctorsMedicationsRecommendations: isHebrew ? "Retrieve Doctors Medications Recommendations" : "Retrieve Doctors Medications Recommendations",
        getDoctorsMedicationsRecommendationsOptimizations: isHebrew ? "Retrieve Doctors Medications Recommendations Optimizations" : "Retrieve Doctors Medications Recommendations Optimizations",
        getDocumentMetadata: isHebrew ? "Retrieve Document Metadata" : "Retrieve Document Metadata",
        getDocumentType: isHebrew ? "Retrieve Document Type" : "Retrieve Document Type",
        getDocuments: isHebrew ? "הצג מסמכים" : "Get documents",
        getDownloadGlucometer: isHebrew ? "Retrieve Download Glucometer" : "Retrieve Download Glucometer",
        getDurableMedicalEquipmentOrders: isHebrew ? "Retrieve Durable Medical Equipment Orders" : "Retrieve Durable Medical Equipment Orders",
        getDvtProphylaxis: isHebrew ? "Retrieve Dvt Prophylaxis" : "Retrieve Dvt Prophylaxis",
        getEarlyChildhoodDevelopment: isHebrew ? "Retrieve Early Childhood Development" : "Retrieve Early Childhood Development",
        getEarlyMaternityLeave: isHebrew ? "Retrieve Early Maternity Leave" : "Retrieve Early Maternity Leave",
        getEcgReports: isHebrew ? "Retrieve ECG Reports" : "Retrieve ECG Reports",
        getEchoReports: isHebrew ? "Retrieve Echo Reports" : "Retrieve Echo Reports",
        getEdCourse: isHebrew ? "Retrieve Ed Course" : "Retrieve Ed Course",
        getEdDisposition: isHebrew ? "Retrieve Ed Disposition" : "Retrieve Ed Disposition",
        getEdTriageAssessment: isHebrew ? "Retrieve Ed Triage Assessment" : "Retrieve Ed Triage Assessment",
        getEducationInitiated: isHebrew ? "Retrieve Education Initiated" : "Retrieve Education Initiated",
        getEegReports: isHebrew ? "Retrieve EEG Reports" : "Retrieve EEG Reports",
        getElderAbuseScreening: isHebrew ? "Retrieve Elder Abuse Screening" : "Retrieve Elder Abuse Screening",
        getEmergencyAirwayManagement: isHebrew ? "Retrieve Emergency Airway Management" : "Retrieve Emergency Airway Management",
        getEmergencyAssessment: isHebrew ? "Retrieve Emergency Assessment" : "Retrieve Emergency Assessment",
        getEmergencyDischargeSummaries: isHebrew ? "Retrieve Emergency Discharge" : "Retrieve Emergency Discharge",
        getEmergencyDisposition: isHebrew ? "Retrieve Emergency Disposition" : "Retrieve Emergency Disposition",
        getEmergencyInformation: isHebrew ? "Retrieve Emergency Information" : "Retrieve Emergency Information",
        getEmergencyObservationUnit: isHebrew ? "Retrieve Emergency Observation Unit" : "Retrieve Emergency Observation Unit",
        getEmergencyProcedures: isHebrew ? "Retrieve Emergency Procedures" : "Retrieve Emergency Procedures",
        getEmergencyReports: isHebrew ? "Fetch Emergency Alerts" : "Fetch Emergency Alerts",
        getEmgReports: isHebrew ? "Retrieve EMG Reports" : "Retrieve EMG Reports",
        getEmploymentCounseling: isHebrew ? "Retrieve Employment Counseling" : "Retrieve Employment Counseling",
        getEmsRunReports: isHebrew ? "Retrieve Emergency Reports" : "Retrieve Emergency Reports",
        getEndocrineLabResults: isHebrew ? "Retrieve Endocrine Lab Results" : "Retrieve Endocrine Lab Results",
        getEndocrineTherapy: isHebrew ? "Retrieve Endocrine Therapy" : "Retrieve Endocrine Therapy",
        getEndocrinologyAssessment: isHebrew ? "Retrieve Endocrinology Assessment" : "Retrieve Endocrinology Assessment",
        getEndocrinologyConsultations: isHebrew ? "Retrieve Endocrinology Consultations" : "Retrieve Endocrinology Consultations",
        getEndoscopyFindings: isHebrew ? "Retrieve Endoscopy Findings" : "Retrieve Endoscopy Findings",
        getEndoscopyReports: isHebrew ? "Retrieve Endoscopy Reports" : "Retrieve Endoscopy Reports",
        getEntAssessment: isHebrew ? "Retrieve Ent Assessment" : "Retrieve Ent Assessment",
        getEntConsultations: isHebrew ? "Retrieve Patient Consultations" : "Retrieve Patient Consultations",
        getEnvironmentalExposures: isHebrew ? "Retrieve Environmental Exposures" : "Retrieve Environmental Exposures",
        getEpilepsyAssessment: isHebrew ? "Retrieve Epilepsy Assessment" : "Retrieve Epilepsy Assessment",
        getErgonomicAssessment: isHebrew ? "Retrieve Ergonomic Assessment" : "Retrieve Ergonomic Assessment",
        getEstimatedBloodLoss: isHebrew ? "Retrieve Estimated Blood Loss" : "Retrieve Estimated Blood Loss",
        getEstimatedDeliveryDate: isHebrew ? "Retrieve Estimated Delivery Date" : "Retrieve Estimated Delivery Date",
        getEstimatedTimeToDialysis: isHebrew ? "Retrieve Estimated Time To Dialysis" : "Retrieve Estimated Time To Dialysis",
        getExcessiveGlucoseMonitoring: isHebrew ? "Retrieve Excessive Glucose Monitoring" : "Retrieve Excessive Glucose Monitoring",
        getExercisePrescription: isHebrew ? "Retrieve Exercise Prescription" : "Retrieve Exercise Prescription",
        getExerciseProgram: isHebrew ? "Retrieve Exercise Program" : "Retrieve Exercise Program",
        getExerciseRecommendations: isHebrew ? "Retrieve Exercise Recommendations" : "Retrieve Exercise Recommendations",
        getExtendedFamilyHistory: isHebrew ? "Retrieve Extended Family History" : "Retrieve Extended Family History",
        getExtraintestinalManifestations: isHebrew ? "Retrieve Extraintestinal Manifestations" : "Retrieve Extraintestinal Manifestations",
        getFacility: isHebrew ? "Retrieve Facility" : "Retrieve Facility",
        getFallPreventionEducation: isHebrew ? "Retrieve Fall Prevention Education" : "Retrieve Fall Prevention Education",
        getFallRiskAssessments: isHebrew ? "Fall Risk Assessment" : "Fall Risk Assessment",
        getFallsPreventionProgramAssessment: isHebrew ? "Retrieve Falls Prevention Program Assessment" : "Retrieve Falls Prevention Program Assessment",
        getFamilyHistory: isHebrew ? "Retrieve Family History" : "Retrieve Family History",
        getFamilyMedicineAssessment: isHebrew ? "Retrieve Family Medicine Assessment" : "Retrieve Family Medicine Assessment",
        getFamilyMeetingDecisions: isHebrew ? "Retrieve Family Meeting Decisions" : "Retrieve Family Meeting Decisions",
        getFamilyMeetingNotes: isHebrew ? "Retrieve Family Meeting Notes" : "Retrieve Family Meeting Notes",
        getFecalCalprotectin: isHebrew ? "Retrieve Fecal Calprotectin" : "Retrieve Fecal Calprotectin",
        getFertilityTracking: isHebrew ? "Retrieve Fertility Tracking" : "Retrieve Fertility Tracking",
        getFetalAssessment: isHebrew ? "Retrieve Fetal Assessment" : "Retrieve Fetal Assessment",
        getFetalEcho: isHebrew ? "Retrieve Fetal Echo" : "Retrieve Fetal Echo",
        getFetalEchoResults: isHebrew ? "Retrieve Fetal Echo Results" : "Retrieve Fetal Echo Results",
        getFetalSurveillance: isHebrew ? "Retrieve Fetal Surveillance" : "Retrieve Fetal Surveillance",
        getFetalUltrasound: isHebrew ? "Retrieve Fetal Ultrasound" : "Retrieve Fetal Ultrasound",
        getFirstTrimesterBleeding: isHebrew ? "Retrieve First Trimester Bleeding" : "Retrieve First Trimester Bleeding",
        getFirstTrimesterScreenResult: isHebrew ? "Retrieve First Trimester Screen Result" : "Retrieve First Trimester Screen Result",
        getFitnessForDutyEvaluations: isHebrew ? "Assess Personnel Readiness" : "Assess Personnel Readiness",
        getFlareManagement: isHebrew ? "Retrieve Flare Management" : "Retrieve Flare Management",
        getFlowCytometryReports: isHebrew ? "Retrieve Cytometry Reports" : "Retrieve Cytometry Reports",
        getFluidElectrolyteManagement: isHebrew ? "Retrieve Fluid Electrolyte Management" : "Retrieve Fluid Electrolyte Management",
        getFluidIntake: isHebrew ? "Retrieve Fluid Intake" : "Retrieve Fluid Intake",
        getFluidOutput: isHebrew ? "Retrieve Fluid Output" : "Retrieve Fluid Output",
        getFmlaDocumentationNote: isHebrew ? "Retrieve Fmla Documentation Note" : "Retrieve Fmla Documentation Note",
        getFormularyInfo: isHebrew ? "חפש במאגר תרופות" : "Look up drug in formulary",
        getFollowUpAppointments: isHebrew ? "Schedule follow-up visits" : "Schedule follow-up visits",
        getFollowUpEnhanced: isHebrew ? "Retrieve Follow Up Enhanced" : "Retrieve Follow Up Enhanced",
        getFollowUpIntelligence: isHebrew ? "Retrieve Follow-up Insights" : "Retrieve Follow-up Insights",
        getFollowUpPlan: isHebrew ? "תוכנית מעקב" : "FOLLOW-UP PLAN - Get follow-up plan including interval, reason for follow-up, modality, monitoring parameters, medications, labs, imaging, referrals, restrictions, and patient education",
        getFollowUps: isHebrew ? "Retrieve Follow-up Recommendations" : "Retrieve Follow-up Recommendations",
        getFoodInsecurity: isHebrew ? "Retrieve Food Insecurity" : "Retrieve Food Insecurity",
        getFootExam: isHebrew ? "Retrieve Foot Exam" : "Retrieve Foot Exam",
        getFrailtyAssessment: isHebrew ? "Retrieve Frailty Assessment" : "Retrieve Frailty Assessment",
        getFullMedicalReport: isHebrew ? "הצג דוח מלא" : "Get full report",
        getFunctionalAssessments: isHebrew ? "Retrieve Functional Assessments" : "Retrieve Functional Assessments",
        getFunctionalMriStudies: isHebrew ? "Retrieve Brain Imaging Studies" : "Retrieve Brain Imaging Studies",
        getFunctionalStatus: isHebrew ? "Retrieve Functional Status" : "Retrieve Functional Status",
        getGaitAnalysis: isHebrew ? "Retrieve Gait Analysis" : "Retrieve Gait Analysis",
        getGastroenterologyConsultations: isHebrew ? "Request Gastro Consultations" : "Request Gastro Consultations",
        getGdmRecurrenceRisk: isHebrew ? "Retrieve Gdm Recurrence Risk" : "Retrieve Gdm Recurrence Risk",
        getGeneticOncology: isHebrew ? "Retrieve Genetic Oncology" : "Retrieve Genetic Oncology",
        getGeneticTestingReports: isHebrew ? "Retrieve Genetic Reports" : "Retrieve Genetic Reports",
        getGeneticsPsychosocialAssessment: isHebrew ? "Retrieve Genetics Psychosocial Assessment" : "Retrieve Genetics Psychosocial Assessment",
        getGeriatricAssessments: isHebrew ? "Retrieve Elderly Evaluations" : "Retrieve Elderly Evaluations",
        getGeriatricCognitiveAssessment: isHebrew ? "Retrieve Geriatric Cognitive Assessment" : "Retrieve Geriatric Cognitive Assessment",
        getGeriatricMedications: isHebrew ? "Retrieve Geriatric Medications" : "Retrieve Geriatric Medications",
        getGeriatricNutritionalAssessment: isHebrew ? "Retrieve Geriatric Nutritional Assessment" : "Retrieve Geriatric Nutritional Assessment",
        getGestationalDiabetes: isHebrew ? "Retrieve Gestational Diabetes" : "Retrieve Gestational Diabetes",
        getGiRiskAssessment: isHebrew ? "Assess GI Risk" : "Assess GI Risk",
        getGlasgowComaScale: isHebrew ? "Retrieve Glasgow Coma Scale" : "Retrieve Glasgow Coma Scale",
        getGlaucomaAssessments: isHebrew ? "Retrieve Glaucoma Evaluations" : "Retrieve Glaucoma Evaluations",
        getGlaucomaManagement: isHebrew ? "Retrieve Glaucoma Management" : "Retrieve Glaucoma Management",
        getGlomerularDisease: isHebrew ? "Retrieve Glomerular Disease" : "Retrieve Glomerular Disease",
        getGlucometerDownloadSchedule: isHebrew ? "Retrieve Glucometer Download Schedule" : "Retrieve Glucometer Download Schedule",
        getGlucoseMonitoringFrequency: isHebrew ? "Retrieve Glucose Monitoring Frequency" : "Retrieve Glucose Monitoring Frequency",
        getGlucoseMonitoringGoals: isHebrew ? "Retrieve Glucose Monitoring Goals" : "Retrieve Glucose Monitoring Goals",
        getGlucoseTestingWeeks: isHebrew ? "Retrieve Glucose Testing Weeks" : "Retrieve Glucose Testing Weeks",
        getGoalsOfCareDiscussion: isHebrew ? "Retrieve Goals Of Care Discussion" : "Retrieve Goals Of Care Discussion",
        getGoutAssessment: isHebrew ? "Retrieve Gout Assessment" : "Retrieve Gout Assessment",
        getGrowthParameters: isHebrew ? "Retrieve Growth Parameters" : "Retrieve Growth Parameters",
        getGrowthUltrasoundSchedule: isHebrew ? "Retrieve Growth Ultrasound Schedule" : "Retrieve Growth Ultrasound Schedule",
        getGuidelineCompliance: isHebrew ? "Check guideline adherence" : "Check guideline adherence",
        getGynecologyConsultations: isHebrew ? "Retrieve Gynecology Consultations" : "Retrieve Gynecology Consultations",
        getHeadacheAssessment: isHebrew ? "Retrieve Headache Assessment" : "Retrieve Headache Assessment",
        getHeaders: isHebrew ? "Retrieve Headers" : "Retrieve Headers",
        getHealthCoachingNotes: isHebrew ? "Retrieve Health Coaching Notes" : "Retrieve Health Coaching Notes",
        getHealthMaintenance: isHebrew ? "הצג תחזוקת בריאות" : "Retrieve health maintenance records",
        getHeightMeasurements: isHebrew ? "Retrieve Height Measurements" : "Retrieve Height Measurements",
        getHematologyAssessment: isHebrew ? "Retrieve Hematology Assessment" : "Retrieve Hematology Assessment",
        getHematologyConsultations: isHebrew ? "Request hematology consultations" : "Request hematology consultations",
        getHepatitisCHistory: isHebrew ? "Retrieve Hepatitis C History" : "Retrieve Hepatitis C History",
        getHepatitisCManagement: isHebrew ? "Retrieve Hepatitis C Management" : "Retrieve Hepatitis C Management",
        getHistoryPresentIllness: isHebrew ? "Retrieve Patient's Illness History" : "Retrieve Patient's Illness History",
        getHivHistory: isHebrew ? "Retrieve Hiv History" : "Retrieve Hiv History",
        getHomeHealthNotes: isHebrew ? "Retrieve Home Health Notes" : "Retrieve Home Health Notes",
        getHomeHealthOrders: isHebrew ? "Retrieve Home Health Orders" : "Retrieve Home Health Orders",
        getHomeMonitoring: isHebrew ? "Retrieve Home Monitoring" : "Retrieve Home Monitoring",
        getHomeSafety: isHebrew ? "Retrieve Home Safety" : "Retrieve Home Safety",
        getHomicideRiskAssessment: isHebrew ? "Retrieve Homicide Risk Assessment" : "Retrieve Homicide Risk Assessment",
        getHormonePanels: isHebrew ? "Retrieve Hormone Tests" : "Retrieve Hormone Tests",
        getHormoneTherapyRecords: isHebrew ? "Retrieve Hormone Therapy" : "Retrieve Hormone Therapy",
        getHospiceNotes: isHebrew ? "Retrieve Hospice Notes" : "Retrieve Hospice Notes",
        getHospitalAdmissionNotes: isHebrew ? "Retrieve Hospital Admission" : "Retrieve Hospital Admission",
        getHospitalCourse: isHebrew ? "Retrieve Hospital Course" : "Retrieve Hospital Course",
        getHospitalDischargeSummaries: isHebrew ? "Retrieve Hospital Discharge Records" : "Retrieve Hospital Discharge Records",
        getHospitalTransferNotes: isHebrew ? "Hospital Transfer Details" : "Hospital Transfer Details",
        getHourlyVitalSigns: isHebrew ? "Retrieve Hourly Vital Signs" : "Retrieve Hourly Vital Signs",
        getHydrationManagement: isHebrew ? "Retrieve Hydration Management" : "Retrieve Hydration Management",
        getHypertensiveNephropathy: isHebrew ? "Retrieve Hypertensive Nephropathy" : "Retrieve Hypertensive Nephropathy",
        getHypoglycemiaManagement: isHebrew ? "Retrieve Hypoglycemia Management" : "Retrieve Hypoglycemia Management",
        getHypoglycemiaProtocol: isHebrew ? "Retrieve Hypoglycemia Protocol" : "Retrieve Hypoglycemia Protocol",
        getIbdAssessment: isHebrew ? "Retrieve Ibd Assessment" : "Retrieve Ibd Assessment",
        getIbdBiomarkers: isHebrew ? "Retrieve Ibd Biomarkers" : "Retrieve Ibd Biomarkers",
        getIbdConsultationDetails: isHebrew ? "Retrieve Ibd Consultation Details" : "Retrieve Ibd Consultation Details",
        getIbdSurgicalPlanning: isHebrew ? "Retrieve Ibd Surgical Planning" : "Retrieve Ibd Surgical Planning",
        getIcuFlowSheets: isHebrew ? "Retrieve ICU flowsheets" : "Retrieve ICU flowsheets",
        getImagingOrders: isHebrew ? "הצג דימות ממתינות" : "Get pending imaging orders",
        getImagingReports: isHebrew ? "Retrieve Medical Reports" : "Retrieve Medical Reports",
        getImagingResults: isHebrew ? "תוצאות דימות רגילות (רנטגן, CT, MRI)" : "IMAGING RESULTS - Get standard radiology reports (X-ray, CT, MRI, ultrasound) with interpretations. NOT for advanced neuroimaging - use getNeuroImaging instead",
        getImmediateInterventions: isHebrew ? "Retrieve Immediate Interventions" : "Retrieve Immediate Interventions",
        getImmediateRecommendations: isHebrew ? "Retrieve Immediate Recommendations" : "Retrieve Immediate Recommendations",
        getImmuneFunctionTests: isHebrew ? "Retrieve Immune Function Tests" : "Retrieve Immune Function Tests",
        getImmuneReconstitutionPlanning: isHebrew ? "Retrieve Immune Reconstitution Planning" : "Retrieve Immune Reconstitution Planning",
        getImmunizationRecord: isHebrew ? "Retrieve Immunization Record" : "Retrieve Immunization Record",
        getImmunizationSchedule: isHebrew ? "Retrieve Immunization Schedule" : "Retrieve Immunization Schedule",
        getImmunizationStatus: isHebrew ? "Retrieve Immunization Status" : "Retrieve Immunization Status",
        getIndianDietExchangeLists: isHebrew ? "Retrieve Indian Diet Exchange Lists" : "Retrieve Indian Diet Exchange Lists",
        getInfectionControlRecords: isHebrew ? "Retrieve Infection Control Records" : "Retrieve Infection Control Records",
        getInfectionRiskMonitoring: isHebrew ? "Retrieve Infection Risk Monitoring" : "Retrieve Infection Risk Monitoring",
        getInfectionSurveillance: isHebrew ? "Retrieve Infection Surveillance" : "Retrieve Infection Surveillance",
        getInfectiousDiseaseAssessment: isHebrew ? "Retrieve Infectious Disease Assessment" : "Retrieve Infectious Disease Assessment",
        getInflammatoryBowelReports: isHebrew ? "Retrieve Bowel Reports" : "Retrieve Bowel Reports",
        getInflammatoryMarkers: isHebrew ? "Retrieve Inflammatory Markers" : "Retrieve Inflammatory Markers",
        getInfliximabDrugMonitoring: isHebrew ? "Retrieve Infliximab Drug Monitoring" : "Retrieve Infliximab Drug Monitoring",
        getInfusionTherapy: isHebrew ? "Retrieve Infusion Therapy" : "Retrieve Infusion Therapy",
        getInheritancePatternDetails: isHebrew ? "Retrieve Inheritance Pattern Details" : "Retrieve Inheritance Pattern Details",
        getInjuryDetails: isHebrew ? "Retrieve Injury Details" : "Retrieve Injury Details",
        getInsomniaAssessment: isHebrew ? "Retrieve Insomnia Assessment" : "Retrieve Insomnia Assessment",
        getInsulinAdjustmentProtocol: isHebrew ? "Retrieve Insulin Adjustment Protocol" : "Retrieve Insulin Adjustment Protocol",
        getInsulinPumpSettings: isHebrew ? "Retrieve Insulin Pump Settings" : "Retrieve Insulin Pump Settings",
        getInsulinRegimen: isHebrew ? "Retrieve Insulin Regimen" : "Retrieve Insulin Regimen",
        getInsulinStorageInstructions: isHebrew ? "Retrieve Insulin Storage Instructions" : "Retrieve Insulin Storage Instructions",
        getInsulinTimingInstructions: isHebrew ? "Retrieve Insulin Timing Instructions" : "Retrieve Insulin Timing Instructions",
        getInsuranceAuthorizations: isHebrew ? "אישורי ביטוח" : "INSURANCE AUTHORIZATIONS - Get insurance authorizations (coverage verification, copay assistance, medication coverage)",
        getInsuranceForms: isHebrew ? "Request Insurance Documents" : "Request Insurance Documents",
        getIntakeOutputRecords: isHebrew ? "Track patient fluids" : "Track patient fluids",
        getIntegrativeOncology: isHebrew ? "Retrieve Integrative Oncology" : "Retrieve Integrative Oncology",
        getIntelligentRecommendations: isHebrew ? "Smart content suggestions" : "Smart content suggestions",
        getInterPregnancyWeightManagement: isHebrew ? "Retrieve Inter Pregnancy Weight Management" : "Retrieve Inter Pregnancy Weight Management",
        getIntervalHistory: isHebrew ? "Retrieve Interval History" : "Retrieve Interval History",
        getInterventionalPainProcedures: isHebrew ? "Retrieve Interventional Pain Procedures" : "Retrieve Interventional Pain Procedures",
        getInterventionalRadiologyNotes: isHebrew ? "Retrieve radiology interventions" : "Retrieve radiology interventions",
        getIntradialyticMonitoring: isHebrew ? "Retrieve Intradialytic Monitoring" : "Retrieve Intradialytic Monitoring",
        getIntraoperativeCholangiography: isHebrew ? "Retrieve Intraoperative Cholangiography" : "Retrieve Intraoperative Cholangiography",
        getIntraoperativeFindings: isHebrew ? "ממצאים תוך ניתוחיים" : "INTRAOPERATIVE FINDINGS - Get intraoperative findings (anatomy, pathology, adhesions, contamination)",
        getIntraoperativeImaging: isHebrew ? "הדמיה תוך ניתוחית" : "INTRAOPERATIVE IMAGING - Get intraoperative imaging (cholangiography, fluoroscopy, ultrasound during surgery)",
        getIntraoperativeMonitoring: isHebrew ? "Retrieve Intraoperative Monitoring" : "Retrieve Intraoperative Monitoring",
        getIsolationPrecautions: isHebrew ? "Retrieve Isolation Precautions" : "Retrieve Isolation Precautions",
        getIvInfusions: isHebrew ? "Retrieve Iv Infusions" : "Retrieve Iv Infusions",
        getJobHazardAnalysis: isHebrew ? "Retrieve Job Hazard Analysis" : "Retrieve Job Hazard Analysis",
        getKetoneMonitoringInstructions: isHebrew ? "Retrieve Ketone Monitoring Instructions" : "Retrieve Ketone Monitoring Instructions",
        getKidneyDiseaseProgressionTimeline: isHebrew ? "Retrieve Kidney Disease Progression Timeline" : "Retrieve Kidney Disease Progression Timeline",
        getKidneyFunctionReports: isHebrew ? "Retrieve Kidney Reports" : "Retrieve Kidney Reports",
        getLabOrders: isHebrew ? "Retrieve Lab Orders" : "Retrieve Lab Orders",
        getLabResults: isHebrew ? "הצג בדיקות" : "Get lab results",
        getLabSchedule: isHebrew ? "Retrieve Lab Schedule" : "Retrieve Lab Schedule",
        getLaborDeliveryRecords: isHebrew ? "Retrieve Labor Delivery" : "Retrieve Labor Delivery",
        getLaryngoscopyReports: isHebrew ? "Retrieve Laryngoscopy Reports" : "Retrieve Laryngoscopy Reports",
        getLifestyleAssessments: isHebrew ? "Retrieve Lifestyle Assessments" : "Retrieve Lifestyle Assessments",
        getLifestyleCounseling: isHebrew ? "Retrieve Lifestyle Counseling" : "Retrieve Lifestyle Counseling",
        getLifestyleRiskAssessment: isHebrew ? "Retrieve Lifestyle Risk Assessment" : "Retrieve Lifestyle Risk Assessment",
        getLigamentReconstruction: isHebrew ? "Retrieve Ligament Reconstruction" : "Retrieve Ligament Reconstruction",
        getLiverFunctionAssessments: isHebrew ? "Retrieve Liver Tests" : "Retrieve Liver Tests",
        getLupusAssessment: isHebrew ? "Retrieve Lupus Assessment" : "Retrieve Lupus Assessment",
        getLymphNodeCytomorphology: isHebrew ? "Retrieve Lymph Node Cytomorphology" : "Retrieve Lymph Node Cytomorphology",
        getMacrosomiaThreshold: isHebrew ? "Retrieve Macrosomia Threshold" : "Retrieve Macrosomia Threshold",
        getMalnutritionRiskAssessment: isHebrew ? "Retrieve Malnutrition Risk Assessment" : "Retrieve Malnutrition Risk Assessment",
        getMammographyReports: isHebrew ? "Retrieve Mammography Reports" : "Retrieve Mammography Reports",
        getMaternalFetalReports: isHebrew ? "Retrieve Maternal-Fetal Reports" : "Retrieve Maternal-Fetal Reports",
        getMaternalLabs: isHebrew ? "Retrieve Maternal Labs" : "Retrieve Maternal Labs",
        getMaternalWeightMonitoring: isHebrew ? "Retrieve Maternal Weight Monitoring" : "Retrieve Maternal Weight Monitoring",
        getMayoScore: isHebrew ? "Retrieve Mayo Score" : "Retrieve Mayo Score",
        getMechanismOfInjury: isHebrew ? "Retrieve Mechanism Of Injury" : "Retrieve Mechanism Of Injury",
        getMedicalAlerts: isHebrew ? "Retrieve Medical Alerts" : "Retrieve Medical Alerts",
        getMedicalCertificates: isHebrew ? "Retrieve Medical Certificates" : "Retrieve Medical Certificates",
        // getMedicalData: REMOVED - Agent should use specific functions like getCardiacRehabilitationReports
        getMedicalGeneticist: isHebrew ? "Retrieve Medical Geneticist" : "Retrieve Medical Geneticist",
        getMedicalHistory: isHebrew ? "MEDICAL HISTORY - קבל היסטוריה רפואית מלאה" : "MEDICAL HISTORY - Get patient's complete medical history",
        getMedicalPowerOfAttorney: isHebrew ? "Retrieve legal healthcare authorization" : "Retrieve legal healthcare authorization",
        getMedicalProcedures: isHebrew ? "Retrieve Medical Procedures" : "Retrieve Medical Procedures",
        getMedicalReconciliationForms: isHebrew ? "Retrieve Medical Reconciliation Forms" : "Retrieve Medical Reconciliation Forms",
        getMedicationAccessPrograms: isHebrew ? "Retrieve Medication Access Programs" : "Retrieve Medication Access Programs",
        getMedicationAdministrationRecords: isHebrew ? "Retrieve medication records" : "Retrieve medication records",
        getMedicationChangesDiscontinued: isHebrew ? "Retrieve Medication Changes Discontinued" : "Retrieve Medication Changes Discontinued",
        getMedicationChangesDose: isHebrew ? "Retrieve Medication Changes Dose" : "Retrieve Medication Changes Dose",
        getMedicationChangesNew: isHebrew ? "Retrieve Medication Changes New" : "Retrieve Medication Changes New",
        getMedicationDeprescribing: isHebrew ? "Retrieve Medication Deprescribing" : "Retrieve Medication Deprescribing",
        getMedicationOptimization: isHebrew ? "Medication Optimization Strategy" : "Medication Optimization Strategy",
        getBurnFluidResuscitation: isHebrew ? "Get burn fluid resuscitation" : "Get burn fluid resuscitation",
        createBurnFluidResuscitation: isHebrew ? "Create burn fluid resuscitation" : "Create burn fluid resuscitation",
        updateBurnFluidResuscitation: isHebrew ? "Update burn fluid resuscitation" : "Update burn fluid resuscitation",
        deleteBurnFluidResuscitation: isHebrew ? "Delete burn fluid resuscitation" : "Delete burn fluid resuscitation",
        getBurnRehabilitation: isHebrew ? "Get burn rehabilitation" : "Get burn rehabilitation",
        createBurnRehabilitation: isHebrew ? "Create burn rehabilitation" : "Create burn rehabilitation",
        updateBurnRehabilitation: isHebrew ? "Update burn rehabilitation" : "Update burn rehabilitation",
        deleteBurnRehabilitation: isHebrew ? "Delete burn rehabilitation" : "Delete burn rehabilitation",
        getSkinGraftingEvaluation: isHebrew ? "Get skin grafting evaluation" : "Get skin grafting evaluation",
        createSkinGraftingEvaluation: isHebrew ? "Create skin grafting evaluation" : "Create skin grafting evaluation",
        updateSkinGraftingEvaluation: isHebrew ? "Update skin grafting evaluation" : "Update skin grafting evaluation",
        deleteSkinGraftingEvaluation: isHebrew ? "Delete skin grafting evaluation" : "Delete skin grafting evaluation",
        getBurnWoundCare: isHebrew ? "Get burn wound care" : "Get burn wound care",
        createBurnWoundCare: isHebrew ? "Create burn wound care" : "Create burn wound care",
        updateBurnWoundCare: isHebrew ? "Update burn wound care" : "Update burn wound care",
        deleteBurnWoundCare: isHebrew ? "Delete burn wound care" : "Delete burn wound care",
        getBurnAssessment: isHebrew ? "Get burn assessment" : "Get burn assessment",
        createBurnAssessment: isHebrew ? "Create burn assessment" : "Create burn assessment",
        updateBurnAssessment: isHebrew ? "Update burn assessment" : "Update burn assessment",
        deleteBurnAssessment: isHebrew ? "Delete burn assessment" : "Delete burn assessment",
        getDecompressionSicknessTreatment: isHebrew ? "Get decompression sickness treatment" : "Get decompression sickness treatment",
        createDecompressionSicknessTreatment: isHebrew ? "Create decompression sickness treatment" : "Create decompression sickness treatment",
        updateDecompressionSicknessTreatment: isHebrew ? "Update decompression sickness treatment" : "Update decompression sickness treatment",
        deleteDecompressionSicknessTreatment: isHebrew ? "Delete decompression sickness treatment" : "Delete decompression sickness treatment",
        getWoundHealingHyperbaric: isHebrew ? "Get wound healing hyperbaric" : "Get wound healing hyperbaric",
        createWoundHealingHyperbaric: isHebrew ? "Create wound healing hyperbaric" : "Create wound healing hyperbaric",
        updateWoundHealingHyperbaric: isHebrew ? "Update wound healing hyperbaric" : "Update wound healing hyperbaric",
        deleteWoundHealingHyperbaric: isHebrew ? "Delete wound healing hyperbaric" : "Delete wound healing hyperbaric",
        getHyperbaricOxygenTherapy: isHebrew ? "Get hyperbaric oxygen therapy" : "Get hyperbaric oxygen therapy",
        createHyperbaricOxygenTherapy: isHebrew ? "Create hyperbaric oxygen therapy" : "Create hyperbaric oxygen therapy",
        updateHyperbaricOxygenTherapy: isHebrew ? "Update hyperbaric oxygen therapy" : "Update hyperbaric oxygen therapy",
        deleteHyperbaricOxygenTherapy: isHebrew ? "Delete hyperbaric oxygen therapy" : "Delete hyperbaric oxygen therapy",
        getPharmacistConsultation: isHebrew ? "Get pharmacist consultation" : "Get pharmacist consultation",
        createPharmacistConsultation: isHebrew ? "Create pharmacist consultation" : "Create pharmacist consultation",
        updatePharmacistConsultation: isHebrew ? "Update pharmacist consultation" : "Update pharmacist consultation",
        deletePharmacistConsultation: isHebrew ? "Delete pharmacist consultation" : "Delete pharmacist consultation",
        getMedicationActionPlan: isHebrew ? "Get medication action plan" : "Get medication action plan",
        createMedicationActionPlan: isHebrew ? "Create medication action plan" : "Create medication action plan",
        updateMedicationActionPlan: isHebrew ? "Update medication action plan" : "Update medication action plan",
        deleteMedicationActionPlan: isHebrew ? "Delete medication action plan" : "Delete medication action plan",
        getComprehensiveMedicationReview: isHebrew ? "Get comprehensive medication review" : "Get comprehensive medication review",
        createComprehensiveMedicationReview: isHebrew ? "Create comprehensive medication review" : "Create comprehensive medication review",
        updateComprehensiveMedicationReview: isHebrew ? "Update comprehensive medication review" : "Update comprehensive medication review",
        deleteComprehensiveMedicationReview: isHebrew ? "Delete comprehensive medication review" : "Delete comprehensive medication review",
        getMedicationTherapyManagement: isHebrew ? "Get medication therapy management" : "Get medication therapy management",
        createMedicationTherapyManagement: isHebrew ? "Create medication therapy management" : "Create medication therapy management",
        updateMedicationTherapyManagement: isHebrew ? "Update medication therapy management" : "Update medication therapy management",
        deleteMedicationTherapyManagement: isHebrew ? "Delete medication therapy management" : "Delete medication therapy management",
        getVisionTherapyAssessment: isHebrew ? "Get vision therapy assessment" : "Get vision therapy assessment",
        createVisionTherapyAssessment: isHebrew ? "Create vision therapy assessment" : "Create vision therapy assessment",
        updateVisionTherapyAssessment: isHebrew ? "Update vision therapy assessment" : "Update vision therapy assessment",
        deleteVisionTherapyAssessment: isHebrew ? "Delete vision therapy assessment" : "Delete vision therapy assessment",
        getLowVisionEvaluation: isHebrew ? "Get low vision evaluation" : "Get low vision evaluation",
        createLowVisionEvaluation: isHebrew ? "Create low vision evaluation" : "Create low vision evaluation",
        updateLowVisionEvaluation: isHebrew ? "Update low vision evaluation" : "Update low vision evaluation",
        deleteLowVisionEvaluation: isHebrew ? "Delete low vision evaluation" : "Delete low vision evaluation",
        getContactLensFitting: isHebrew ? "Get contact lens fitting" : "Get contact lens fitting",
        createContactLensFitting: isHebrew ? "Create contact lens fitting" : "Create contact lens fitting",
        updateContactLensFitting: isHebrew ? "Update contact lens fitting" : "Update contact lens fitting",
        deleteContactLensFitting: isHebrew ? "Delete contact lens fitting" : "Delete contact lens fitting",
        getOptometryExamination: isHebrew ? "Get optometry examination" : "Get optometry examination",
        createOptometryExamination: isHebrew ? "Create optometry examination" : "Create optometry examination",
        updateOptometryExamination: isHebrew ? "Update optometry examination" : "Update optometry examination",
        deleteOptometryExamination: isHebrew ? "Delete optometry examination" : "Delete optometry examination",
        getChiropracticTreatmentPlan: isHebrew ? "Get chiropractic treatment plan" : "Get chiropractic treatment plan",
        createChiropracticTreatmentPlan: isHebrew ? "Create chiropractic treatment plan" : "Create chiropractic treatment plan",
        updateChiropracticTreatmentPlan: isHebrew ? "Update chiropractic treatment plan" : "Update chiropractic treatment plan",
        deleteChiropracticTreatmentPlan: isHebrew ? "Delete chiropractic treatment plan" : "Delete chiropractic treatment plan",
        getChiropracticXRayReview: isHebrew ? "Get chiropractic x ray review" : "Get chiropractic x ray review",
        createChiropracticXRayReview: isHebrew ? "Create chiropractic x ray review" : "Create chiropractic x ray review",
        updateChiropracticXRayReview: isHebrew ? "Update chiropractic x ray review" : "Update chiropractic x ray review",
        deleteChiropracticXRayReview: isHebrew ? "Delete chiropractic x ray review" : "Delete chiropractic x ray review",
        getSpinalManipulationRecord: isHebrew ? "Get spinal manipulation record" : "Get spinal manipulation record",
        createSpinalManipulationRecord: isHebrew ? "Create spinal manipulation record" : "Create spinal manipulation record",
        updateSpinalManipulationRecord: isHebrew ? "Update spinal manipulation record" : "Update spinal manipulation record",
        deleteSpinalManipulationRecord: isHebrew ? "Delete spinal manipulation record" : "Delete spinal manipulation record",
        getChiropracticConsultation: isHebrew ? "Get chiropractic consultation" : "Get chiropractic consultation",
        createChiropracticConsultation: isHebrew ? "Create chiropractic consultation" : "Create chiropractic consultation",
        updateChiropracticConsultation: isHebrew ? "Update chiropractic consultation" : "Update chiropractic consultation",
        deleteChiropracticConsultation: isHebrew ? "Delete chiropractic consultation" : "Delete chiropractic consultation",
        getCpapBipapManagement: isHebrew ? "Get cpap bipap management" : "Get cpap bipap management",
        createCpapBipapManagement: isHebrew ? "Create cpap bipap management" : "Create cpap bipap management",
        updateCpapBipapManagement: isHebrew ? "Update cpap bipap management" : "Update cpap bipap management",
        deleteCpapBipapManagement: isHebrew ? "Delete cpap bipap management" : "Delete cpap bipap management",
        getBronchialHygieneTherapy: isHebrew ? "Get bronchial hygiene therapy" : "Get bronchial hygiene therapy",
        createBronchialHygieneTherapy: isHebrew ? "Create bronchial hygiene therapy" : "Create bronchial hygiene therapy",
        updateBronchialHygieneTherapy: isHebrew ? "Update bronchial hygiene therapy" : "Update bronchial hygiene therapy",
        deleteBronchialHygieneTherapy: isHebrew ? "Delete bronchial hygiene therapy" : "Delete bronchial hygiene therapy",
        getAirwayClearanceTherapy: isHebrew ? "Get airway clearance therapy" : "Get airway clearance therapy",
        createAirwayClearanceTherapy: isHebrew ? "Create airway clearance therapy" : "Create airway clearance therapy",
        updateAirwayClearanceTherapy: isHebrew ? "Update airway clearance therapy" : "Update airway clearance therapy",
        deleteAirwayClearanceTherapy: isHebrew ? "Delete airway clearance therapy" : "Delete airway clearance therapy",
        getVentilatorWeaningProtocol: isHebrew ? "Get ventilator weaning protocol" : "Get ventilator weaning protocol",
        createVentilatorWeaningProtocol: isHebrew ? "Create ventilator weaning protocol" : "Create ventilator weaning protocol",
        updateVentilatorWeaningProtocol: isHebrew ? "Update ventilator weaning protocol" : "Update ventilator weaning protocol",
        deleteVentilatorWeaningProtocol: isHebrew ? "Delete ventilator weaning protocol" : "Delete ventilator weaning protocol",
        getOxygenTitrationProtocol: isHebrew ? "Get oxygen titration protocol" : "Get oxygen titration protocol",
        createOxygenTitrationProtocol: isHebrew ? "Create oxygen titration protocol" : "Create oxygen titration protocol",
        updateOxygenTitrationProtocol: isHebrew ? "Update oxygen titration protocol" : "Update oxygen titration protocol",
        deleteOxygenTitrationProtocol: isHebrew ? "Delete oxygen titration protocol" : "Delete oxygen titration protocol",
        getRespiratoryTherapyAssessment: isHebrew ? "Get respiratory therapy assessment" : "Get respiratory therapy assessment",
        createRespiratoryTherapyAssessment: isHebrew ? "Create respiratory therapy assessment" : "Create respiratory therapy assessment",
        updateRespiratoryTherapyAssessment: isHebrew ? "Update respiratory therapy assessment" : "Update respiratory therapy assessment",
        deleteRespiratoryTherapyAssessment: isHebrew ? "Delete respiratory therapy assessment" : "Delete respiratory therapy assessment",
        getNutritionLabMonitoring: isHebrew ? "Get nutrition lab monitoring" : "Get nutrition lab monitoring",
        createNutritionLabMonitoring: isHebrew ? "Create nutrition lab monitoring" : "Create nutrition lab monitoring",
        updateNutritionLabMonitoring: isHebrew ? "Update nutrition lab monitoring" : "Update nutrition lab monitoring",
        deleteNutritionLabMonitoring: isHebrew ? "Delete nutrition lab monitoring" : "Delete nutrition lab monitoring",
        getParenteralNutritionMonitoring: isHebrew ? "Get parenteral nutrition monitoring" : "Get parenteral nutrition monitoring",
        createParenteralNutritionMonitoring: isHebrew ? "Create parenteral nutrition monitoring" : "Create parenteral nutrition monitoring",
        updateParenteralNutritionMonitoring: isHebrew ? "Update parenteral nutrition monitoring" : "Update parenteral nutrition monitoring",
        deleteParenteralNutritionMonitoring: isHebrew ? "Delete parenteral nutrition monitoring" : "Delete parenteral nutrition monitoring",
        getTubeFeedingOrder: isHebrew ? "Get tube feeding order" : "Get tube feeding order",
        createTubeFeedingOrder: isHebrew ? "Create tube feeding order" : "Create tube feeding order",
        updateTubeFeedingOrder: isHebrew ? "Update tube feeding order" : "Update tube feeding order",
        deleteTubeFeedingOrder: isHebrew ? "Delete tube feeding order" : "Delete tube feeding order",
        getNutritionSupportConsultation: isHebrew ? "Get nutrition support consultation" : "Get nutrition support consultation",
        createNutritionSupportConsultation: isHebrew ? "Create nutrition support consultation" : "Create nutrition support consultation",
        updateNutritionSupportConsultation: isHebrew ? "Update nutrition support consultation" : "Update nutrition support consultation",
        deleteNutritionSupportConsultation: isHebrew ? "Delete nutrition support consultation" : "Delete nutrition support consultation",
        getEnteralFeedingAssessment: isHebrew ? "Get enteral feeding assessment" : "Get enteral feeding assessment",
        createEnteralFeedingAssessment: isHebrew ? "Create enteral feeding assessment" : "Create enteral feeding assessment",
        updateEnteralFeedingAssessment: isHebrew ? "Update enteral feeding assessment" : "Update enteral feeding assessment",
        deleteEnteralFeedingAssessment: isHebrew ? "Delete enteral feeding assessment" : "Delete enteral feeding assessment",
        getTpnManagement: isHebrew ? "Get tpn management" : "Get tpn management",
        createTpnManagement: isHebrew ? "Create tpn management" : "Create tpn management",
        updateTpnManagement: isHebrew ? "Update tpn management" : "Update tpn management",
        deleteTpnManagement: isHebrew ? "Delete tpn management" : "Delete tpn management",
        getMedicationDosingRecommendation: isHebrew ? "Get medication dosing recommendation" : "Get medication dosing recommendation",
        createMedicationDosingRecommendation: isHebrew ? "Create medication dosing recommendation" : "Create medication dosing recommendation",
        updateMedicationDosingRecommendation: isHebrew ? "Update medication dosing recommendation" : "Update medication dosing recommendation",
        deleteMedicationDosingRecommendation: isHebrew ? "Delete medication dosing recommendation" : "Delete medication dosing recommendation",
        getDrugGeneInteractionReport: isHebrew ? "Get drug gene interaction report" : "Get drug gene interaction report",
        createDrugGeneInteractionReport: isHebrew ? "Create drug gene interaction report" : "Create drug gene interaction report",
        updateDrugGeneInteractionReport: isHebrew ? "Update drug gene interaction report" : "Update drug gene interaction report",
        deleteDrugGeneInteractionReport: isHebrew ? "Delete drug gene interaction report" : "Delete drug gene interaction report",
        getCyp450PanelResults: isHebrew ? "Get cyp450 panel results" : "Get cyp450 panel results",
        createCyp450PanelResults: isHebrew ? "Create cyp450 panel result" : "Create cyp450 panel result",
        updateCyp450PanelResults: isHebrew ? "Update cyp450 panel result" : "Update cyp450 panel result",
        deleteCyp450PanelResults: isHebrew ? "Delete cyp450 panel result" : "Delete cyp450 panel result",
        getPharmacogenomicTesting: isHebrew ? "Get pharmacogenomic testing" : "Get pharmacogenomic testing",
        createPharmacogenomicTesting: isHebrew ? "Create pharmacogenomic testing" : "Create pharmacogenomic testing",
        updatePharmacogenomicTesting: isHebrew ? "Update pharmacogenomic testing" : "Update pharmacogenomic testing",
        deletePharmacogenomicTesting: isHebrew ? "Delete pharmacogenomic testing" : "Delete pharmacogenomic testing",
        getSyphilisTreatmentFollowUp: isHebrew ? "Get syphilis treatment follow up" : "Get syphilis treatment follow up",
        createSyphilisTreatmentFollowUp: isHebrew ? "Create syphilis treatment follow up" : "Create syphilis treatment follow up",
        updateSyphilisTreatmentFollowUp: isHebrew ? "Update syphilis treatment follow up" : "Update syphilis treatment follow up",
        deleteSyphilisTreatmentFollowUp: isHebrew ? "Delete syphilis treatment follow up" : "Delete syphilis treatment follow up",
        getPartnerNotification: isHebrew ? "Get partner notification" : "Get partner notification",
        createPartnerNotification: isHebrew ? "Create partner notification" : "Create partner notification",
        updatePartnerNotification: isHebrew ? "Update partner notification" : "Update partner notification",
        deletePartnerNotification: isHebrew ? "Delete partner notification" : "Delete partner notification",
        getSexualHealthCounseling: isHebrew ? "Get sexual health counseling" : "Get sexual health counseling",
        createSexualHealthCounseling: isHebrew ? "Create sexual health counseling" : "Create sexual health counseling",
        updateSexualHealthCounseling: isHebrew ? "Update sexual health counseling" : "Update sexual health counseling",
        deleteSexualHealthCounseling: isHebrew ? "Delete sexual health counseling" : "Delete sexual health counseling",
        getHivPrepManagement: isHebrew ? "Get hiv prep management" : "Get hiv prep management",
        createHivPrepManagement: isHebrew ? "Create hiv prep management" : "Create hiv prep management",
        updateHivPrepManagement: isHebrew ? "Update hiv prep management" : "Update hiv prep management",
        deleteHivPrepManagement: isHebrew ? "Delete hiv prep management" : "Delete hiv prep management",
        getHivPepProphylaxis: isHebrew ? "Get hiv pep prophylaxis" : "Get hiv pep prophylaxis",
        createHivPepProphylaxis: isHebrew ? "Create hiv pep prophylaxi" : "Create hiv pep prophylaxi",
        updateHivPepProphylaxis: isHebrew ? "Update hiv pep prophylaxi" : "Update hiv pep prophylaxi",
        deleteHivPepProphylaxis: isHebrew ? "Delete hiv pep prophylaxi" : "Delete hiv pep prophylaxi",
        getStiScreeningPanel: isHebrew ? "Get sti screening panel" : "Get sti screening panel",
        createStiScreeningPanel: isHebrew ? "Create sti screening panel" : "Create sti screening panel",
        updateStiScreeningPanel: isHebrew ? "Update sti screening panel" : "Update sti screening panel",
        deleteStiScreeningPanel: isHebrew ? "Delete sti screening panel" : "Delete sti screening panel",
        getFertilityPreservation: isHebrew ? "Get fertility preservation" : "Get fertility preservation",
        createFertilityPreservation: isHebrew ? "Create fertility preservation" : "Create fertility preservation",
        updateFertilityPreservation: isHebrew ? "Update fertility preservation" : "Update fertility preservation",
        deleteFertilityPreservation: isHebrew ? "Delete fertility preservation" : "Delete fertility preservation",
        getSurrogacyEvaluation: isHebrew ? "Get surrogacy evaluation" : "Get surrogacy evaluation",
        createSurrogacyEvaluation: isHebrew ? "Create surrogacy evaluation" : "Create surrogacy evaluation",
        updateSurrogacyEvaluation: isHebrew ? "Update surrogacy evaluation" : "Update surrogacy evaluation",
        deleteSurrogacyEvaluation: isHebrew ? "Delete surrogacy evaluation" : "Delete surrogacy evaluation",
        getDonorEggCycle: isHebrew ? "Get donor egg cycle" : "Get donor egg cycle",
        createDonorEggCycle: isHebrew ? "Create donor egg cycle" : "Create donor egg cycle",
        updateDonorEggCycle: isHebrew ? "Update donor egg cycle" : "Update donor egg cycle",
        deleteDonorEggCycle: isHebrew ? "Delete donor egg cycle" : "Delete donor egg cycle",
        getIntrauterineInsemination: isHebrew ? "Get intrauterine insemination" : "Get intrauterine insemination",
        createIntrauterineInsemination: isHebrew ? "Create intrauterine insemination" : "Create intrauterine insemination",
        updateIntrauterineInsemination: isHebrew ? "Update intrauterine insemination" : "Update intrauterine insemination",
        deleteIntrauterineInsemination: isHebrew ? "Delete intrauterine insemination" : "Delete intrauterine insemination",
        getFertilityMedicationManagement: isHebrew ? "Get fertility medication management" : "Get fertility medication management",
        createFertilityMedicationManagement: isHebrew ? "Create fertility medication management" : "Create fertility medication management",
        updateFertilityMedicationManagement: isHebrew ? "Update fertility medication management" : "Update fertility medication management",
        deleteFertilityMedicationManagement: isHebrew ? "Delete fertility medication management" : "Delete fertility medication management",
        getOvarianStimulationProtocol: isHebrew ? "Get ovarian stimulation protocol" : "Get ovarian stimulation protocol",
        createOvarianStimulationProtocol: isHebrew ? "Create ovarian stimulation protocol" : "Create ovarian stimulation protocol",
        updateOvarianStimulationProtocol: isHebrew ? "Update ovarian stimulation protocol" : "Update ovarian stimulation protocol",
        deleteOvarianStimulationProtocol: isHebrew ? "Delete ovarian stimulation protocol" : "Delete ovarian stimulation protocol",
        getSpermAnalysis: isHebrew ? "Get sperm analysis" : "Get sperm analysis",
        createSpermAnalysis: isHebrew ? "Create sperm analysi" : "Create sperm analysi",
        updateSpermAnalysis: isHebrew ? "Update sperm analysi" : "Update sperm analysi",
        deleteSpermAnalysis: isHebrew ? "Delete sperm analysi" : "Delete sperm analysi",
        getEmbryoTransferProcedure: isHebrew ? "Get embryo transfer procedure" : "Get embryo transfer procedure",
        createEmbryoTransferProcedure: isHebrew ? "Create embryo transfer procedure" : "Create embryo transfer procedure",
        updateEmbryoTransferProcedure: isHebrew ? "Update embryo transfer procedure" : "Update embryo transfer procedure",
        deleteEmbryoTransferProcedure: isHebrew ? "Delete embryo transfer procedure" : "Delete embryo transfer procedure",
        getEggRetrievalProcedure: isHebrew ? "Get egg retrieval procedure" : "Get egg retrieval procedure",
        createEggRetrievalProcedure: isHebrew ? "Create egg retrieval procedure" : "Create egg retrieval procedure",
        updateEggRetrievalProcedure: isHebrew ? "Update egg retrieval procedure" : "Update egg retrieval procedure",
        deleteEggRetrievalProcedure: isHebrew ? "Delete egg retrieval procedure" : "Delete egg retrieval procedure",
        getIvfCycleMonitoring: isHebrew ? "Get ivf cycle monitoring" : "Get ivf cycle monitoring",
        createIvfCycleMonitoring: isHebrew ? "Create ivf cycle monitoring" : "Create ivf cycle monitoring",
        updateIvfCycleMonitoring: isHebrew ? "Update ivf cycle monitoring" : "Update ivf cycle monitoring",
        deleteIvfCycleMonitoring: isHebrew ? "Delete ivf cycle monitoring" : "Delete ivf cycle monitoring",
        getOralPathologyBiopsy: isHebrew ? "Get oral pathology biopsy" : "Get oral pathology biopsy",
        createOralPathologyBiopsy: isHebrew ? "Create oral pathology biopsy" : "Create oral pathology biopsy",
        updateOralPathologyBiopsy: isHebrew ? "Update oral pathology biopsy" : "Update oral pathology biopsy",
        deleteOralPathologyBiopsy: isHebrew ? "Delete oral pathology biopsy" : "Delete oral pathology biopsy",
        getDentalImplantSurgery: isHebrew ? "Get dental implant surgery" : "Get dental implant surgery",
        createDentalImplantSurgery: isHebrew ? "Create dental implant surgery" : "Create dental implant surgery",
        updateDentalImplantSurgery: isHebrew ? "Update dental implant surgery" : "Update dental implant surgery",
        deleteDentalImplantSurgery: isHebrew ? "Delete dental implant surgery" : "Delete dental implant surgery",
        getOrthognathicSurgeryEvaluation: isHebrew ? "Get orthognathic surgery evaluation" : "Get orthognathic surgery evaluation",
        createOrthognathicSurgeryEvaluation: isHebrew ? "Create orthognathic surgery evaluation" : "Create orthognathic surgery evaluation",
        updateOrthognathicSurgeryEvaluation: isHebrew ? "Update orthognathic surgery evaluation" : "Update orthognathic surgery evaluation",
        deleteOrthognathicSurgeryEvaluation: isHebrew ? "Delete orthognathic surgery evaluation" : "Delete orthognathic surgery evaluation",
        getJawReconstruction: isHebrew ? "Get jaw reconstruction" : "Get jaw reconstruction",
        createJawReconstruction: isHebrew ? "Create jaw reconstruction" : "Create jaw reconstruction",
        updateJawReconstruction: isHebrew ? "Update jaw reconstruction" : "Update jaw reconstruction",
        deleteJawReconstruction: isHebrew ? "Delete jaw reconstruction" : "Delete jaw reconstruction",
        getFacialTraumaAssessment: isHebrew ? "Get facial trauma assessment" : "Get facial trauma assessment",
        createFacialTraumaAssessment: isHebrew ? "Create facial trauma assessment" : "Create facial trauma assessment",
        updateFacialTraumaAssessment: isHebrew ? "Update facial trauma assessment" : "Update facial trauma assessment",
        deleteFacialTraumaAssessment: isHebrew ? "Delete facial trauma assessment" : "Delete facial trauma assessment",
        getTmjAssessment: isHebrew ? "Get tmj assessment" : "Get tmj assessment",
        createTmjAssessment: isHebrew ? "Create tmj assessment" : "Create tmj assessment",
        updateTmjAssessment: isHebrew ? "Update tmj assessment" : "Update tmj assessment",
        deleteTmjAssessment: isHebrew ? "Delete tmj assessment" : "Delete tmj assessment",
        getFootOrthoticsAssessment: isHebrew ? "Get foot orthotics assessment" : "Get foot orthotics assessment",
        createFootOrthoticsAssessment: isHebrew ? "Create foot orthotics assessment" : "Create foot orthotics assessment",
        updateFootOrthoticsAssessment: isHebrew ? "Update foot orthotics assessment" : "Update foot orthotics assessment",
        deleteFootOrthoticsAssessment: isHebrew ? "Delete foot orthotics assessment" : "Delete foot orthotics assessment",
        getPlantarFasciitisManagement: isHebrew ? "Get plantar fasciitis management" : "Get plantar fasciitis management",
        createPlantarFasciitisManagement: isHebrew ? "Create plantar fasciitis management" : "Create plantar fasciitis management",
        updatePlantarFasciitisManagement: isHebrew ? "Update plantar fasciitis management" : "Update plantar fasciitis management",
        deletePlantarFasciitisManagement: isHebrew ? "Delete plantar fasciitis management" : "Delete plantar fasciitis management",
        getIngrownToenailTreatment: isHebrew ? "Get ingrown toenail treatment" : "Get ingrown toenail treatment",
        createIngrownToenailTreatment: isHebrew ? "Create ingrown toenail treatment" : "Create ingrown toenail treatment",
        updateIngrownToenailTreatment: isHebrew ? "Update ingrown toenail treatment" : "Update ingrown toenail treatment",
        deleteIngrownToenailTreatment: isHebrew ? "Delete ingrown toenail treatment" : "Delete ingrown toenail treatment",
        getHeelPainAssessment: isHebrew ? "Get heel pain assessment" : "Get heel pain assessment",
        createHeelPainAssessment: isHebrew ? "Create heel pain assessment" : "Create heel pain assessment",
        updateHeelPainAssessment: isHebrew ? "Update heel pain assessment" : "Update heel pain assessment",
        deleteHeelPainAssessment: isHebrew ? "Delete heel pain assessment" : "Delete heel pain assessment",
        getFootReconstruction: isHebrew ? "Get foot reconstruction" : "Get foot reconstruction",
        createFootReconstruction: isHebrew ? "Create foot reconstruction" : "Create foot reconstruction",
        updateFootReconstruction: isHebrew ? "Update foot reconstruction" : "Update foot reconstruction",
        deleteFootReconstruction: isHebrew ? "Delete foot reconstruction" : "Delete foot reconstruction",
        getBunionSurgeryEvaluation: isHebrew ? "Get bunion surgery evaluation" : "Get bunion surgery evaluation",
        createBunionSurgeryEvaluation: isHebrew ? "Create bunion surgery evaluation" : "Create bunion surgery evaluation",
        updateBunionSurgeryEvaluation: isHebrew ? "Update bunion surgery evaluation" : "Update bunion surgery evaluation",
        deleteBunionSurgeryEvaluation: isHebrew ? "Delete bunion surgery evaluation" : "Delete bunion surgery evaluation",
        getDiabeticFootAssessment: isHebrew ? "Get diabetic foot assessment" : "Get diabetic foot assessment",
        createDiabeticFootAssessment: isHebrew ? "Create diabetic foot assessment" : "Create diabetic foot assessment",
        updateDiabeticFootAssessment: isHebrew ? "Update diabetic foot assessment" : "Update diabetic foot assessment",
        deleteDiabeticFootAssessment: isHebrew ? "Delete diabetic foot assessment" : "Delete diabetic foot assessment",
        getPodiatryConsultations: isHebrew ? "Get podiatry consultations" : "Get podiatry consultations",
        createPodiatryConsultations: isHebrew ? "Create podiatry consultation" : "Create podiatry consultation",
        updatePodiatryConsultations: isHebrew ? "Update podiatry consultation" : "Update podiatry consultation",
        deletePodiatryConsultations: isHebrew ? "Delete podiatry consultation" : "Delete podiatry consultation",
        getStemCellTransplantAssessment: isHebrew ? "Get stem cell transplant assessment" : "Get stem cell transplant assessment",
        createStemCellTransplantAssessment: isHebrew ? "Create stem cell transplant assessment" : "Create stem cell transplant assessment",
        updateStemCellTransplantAssessment: isHebrew ? "Update stem cell transplant assessment" : "Update stem cell transplant assessment",
        deleteStemCellTransplantAssessment: isHebrew ? "Delete stem cell transplant assessment" : "Delete stem cell transplant assessment",
        getBoneMarrowTransplantFollowUp: isHebrew ? "Get bone marrow transplant follow up" : "Get bone marrow transplant follow up",
        createBoneMarrowTransplantFollowUp: isHebrew ? "Create bone marrow transplant follow up" : "Create bone marrow transplant follow up",
        updateBoneMarrowTransplantFollowUp: isHebrew ? "Update bone marrow transplant follow up" : "Update bone marrow transplant follow up",
        deleteBoneMarrowTransplantFollowUp: isHebrew ? "Delete bone marrow transplant follow up" : "Delete bone marrow transplant follow up",
        getBoneMarrowTransplantEvaluation: isHebrew ? "Get bone marrow transplant evaluation" : "Get bone marrow transplant evaluation",
        createBoneMarrowTransplantEvaluation: isHebrew ? "Create bone marrow transplant evaluation" : "Create bone marrow transplant evaluation",
        updateBoneMarrowTransplantEvaluation: isHebrew ? "Update bone marrow transplant evaluation" : "Update bone marrow transplant evaluation",
        deleteBoneMarrowTransplantEvaluation: isHebrew ? "Delete bone marrow transplant evaluation" : "Delete bone marrow transplant evaluation",
        getPancreasTransplantFollowUp: isHebrew ? "Get pancreas transplant follow up" : "Get pancreas transplant follow up",
        createPancreasTransplantFollowUp: isHebrew ? "Create pancreas transplant follow up" : "Create pancreas transplant follow up",
        updatePancreasTransplantFollowUp: isHebrew ? "Update pancreas transplant follow up" : "Update pancreas transplant follow up",
        deletePancreasTransplantFollowUp: isHebrew ? "Delete pancreas transplant follow up" : "Delete pancreas transplant follow up",
        getPancreasTransplantEvaluation: isHebrew ? "Get pancreas transplant evaluation" : "Get pancreas transplant evaluation",
        createPancreasTransplantEvaluation: isHebrew ? "Create pancreas transplant evaluation" : "Create pancreas transplant evaluation",
        updatePancreasTransplantEvaluation: isHebrew ? "Update pancreas transplant evaluation" : "Update pancreas transplant evaluation",
        deletePancreasTransplantEvaluation: isHebrew ? "Delete pancreas transplant evaluation" : "Delete pancreas transplant evaluation",
        getKidneyTransplantFollowUp: isHebrew ? "Get kidney transplant follow up" : "Get kidney transplant follow up",
        createKidneyTransplantFollowUp: isHebrew ? "Create kidney transplant follow up" : "Create kidney transplant follow up",
        updateKidneyTransplantFollowUp: isHebrew ? "Update kidney transplant follow up" : "Update kidney transplant follow up",
        deleteKidneyTransplantFollowUp: isHebrew ? "Delete kidney transplant follow up" : "Delete kidney transplant follow up",
        getLungTransplantFollowUp: isHebrew ? "Get lung transplant follow up" : "Get lung transplant follow up",
        createLungTransplantFollowUp: isHebrew ? "Create lung transplant follow up" : "Create lung transplant follow up",
        updateLungTransplantFollowUp: isHebrew ? "Update lung transplant follow up" : "Update lung transplant follow up",
        deleteLungTransplantFollowUp: isHebrew ? "Delete lung transplant follow up" : "Delete lung transplant follow up",
        getLungTransplantEvaluation: isHebrew ? "Get lung transplant evaluation" : "Get lung transplant evaluation",
        createLungTransplantEvaluation: isHebrew ? "Create lung transplant evaluation" : "Create lung transplant evaluation",
        updateLungTransplantEvaluation: isHebrew ? "Update lung transplant evaluation" : "Update lung transplant evaluation",
        deleteLungTransplantEvaluation: isHebrew ? "Delete lung transplant evaluation" : "Delete lung transplant evaluation",
        getHeartTransplantFollowUp: isHebrew ? "Get heart transplant follow up" : "Get heart transplant follow up",
        createHeartTransplantFollowUp: isHebrew ? "Create heart transplant follow up" : "Create heart transplant follow up",
        updateHeartTransplantFollowUp: isHebrew ? "Update heart transplant follow up" : "Update heart transplant follow up",
        deleteHeartTransplantFollowUp: isHebrew ? "Delete heart transplant follow up" : "Delete heart transplant follow up",
        getHeartTransplantEvaluation: isHebrew ? "Get heart transplant evaluation" : "Get heart transplant evaluation",
        createHeartTransplantEvaluation: isHebrew ? "Create heart transplant evaluation" : "Create heart transplant evaluation",
        updateHeartTransplantEvaluation: isHebrew ? "Update heart transplant evaluation" : "Update heart transplant evaluation",
        deleteHeartTransplantEvaluation: isHebrew ? "Delete heart transplant evaluation" : "Delete heart transplant evaluation",
        getLiverTransplantFollowUp: isHebrew ? "Get liver transplant follow up" : "Get liver transplant follow up",
        createLiverTransplantFollowUp: isHebrew ? "Create liver transplant follow up" : "Create liver transplant follow up",
        updateLiverTransplantFollowUp: isHebrew ? "Update liver transplant follow up" : "Update liver transplant follow up",
        deleteLiverTransplantFollowUp: isHebrew ? "Delete liver transplant follow up" : "Delete liver transplant follow up",
        getVaricoseVeinTreatment: isHebrew ? "Get varicose vein treatment" : "Get varicose vein treatment",
        createVaricoseVeinTreatment: isHebrew ? "Create varicose vein treatment" : "Create varicose vein treatment",
        updateVaricoseVeinTreatment: isHebrew ? "Update varicose vein treatment" : "Update varicose vein treatment",
        deleteVaricoseVeinTreatment: isHebrew ? "Delete varicose vein treatment" : "Delete varicose vein treatment",
        getPeripheralArteryDisease: isHebrew ? "Get peripheral artery disease" : "Get peripheral artery disease",
        createPeripheralArteryDisease: isHebrew ? "Create peripheral artery disease" : "Create peripheral artery disease",
        updatePeripheralArteryDisease: isHebrew ? "Update peripheral artery disease" : "Update peripheral artery disease",
        deletePeripheralArteryDisease: isHebrew ? "Delete peripheral artery disease" : "Delete peripheral artery disease",
        getAorticAneurysmSurveillance: isHebrew ? "Get aortic aneurysm surveillance" : "Get aortic aneurysm surveillance",
        createAorticAneurysmSurveillance: isHebrew ? "Create aortic aneurysm surveillance" : "Create aortic aneurysm surveillance",
        updateAorticAneurysmSurveillance: isHebrew ? "Update aortic aneurysm surveillance" : "Update aortic aneurysm surveillance",
        deleteAorticAneurysmSurveillance: isHebrew ? "Delete aortic aneurysm surveillance" : "Delete aortic aneurysm surveillance",
        getVenousInsufficiencyAssessment: isHebrew ? "Get venous insufficiency assessment" : "Get venous insufficiency assessment",
        createVenousInsufficiencyAssessment: isHebrew ? "Create venous insufficiency assessment" : "Create venous insufficiency assessment",
        updateVenousInsufficiencyAssessment: isHebrew ? "Update venous insufficiency assessment" : "Update venous insufficiency assessment",
        deleteVenousInsufficiencyAssessment: isHebrew ? "Delete venous insufficiency assessment" : "Delete venous insufficiency assessment",
        getVascularBypassSurgery: isHebrew ? "Get vascular bypass surgery" : "Get vascular bypass surgery",
        createVascularBypassSurgery: isHebrew ? "Create vascular bypass surgery" : "Create vascular bypass surgery",
        updateVascularBypassSurgery: isHebrew ? "Update vascular bypass surgery" : "Update vascular bypass surgery",
        deleteVascularBypassSurgery: isHebrew ? "Delete vascular bypass surgery" : "Delete vascular bypass surgery",
        getLiverTransplantEvaluation: isHebrew ? "Get liver transplant evaluation" : "Get liver transplant evaluation",
        createLiverTransplantEvaluation: isHebrew ? "Create liver transplant evaluation" : "Create liver transplant evaluation",
        updateLiverTransplantEvaluation: isHebrew ? "Update liver transplant evaluation" : "Update liver transplant evaluation",
        deleteLiverTransplantEvaluation: isHebrew ? "Delete liver transplant evaluation" : "Delete liver transplant evaluation",
        getVascularSurgeryAssessment: isHebrew ? "Get vascular surgery assessment" : "Get vascular surgery assessment",
        createVascularSurgeryAssessment: isHebrew ? "Create vascular surgery assessment" : "Create vascular surgery assessment",
        updateVascularSurgeryAssessment: isHebrew ? "Update vascular surgery assessment" : "Update vascular surgery assessment",
        deleteVascularSurgeryAssessment: isHebrew ? "Delete vascular surgery assessment" : "Delete vascular surgery assessment",
        getMedicationRecommendations: isHebrew ? "Get medication recommendations" : "Get medication recommendations",
        getMedicationReconciliation: isHebrew ? "Retrieve Medication Reconciliation Records" : "Retrieve Medication Reconciliation Records",
        getMedicationRenalDosing: isHebrew ? "Retrieve Medication Renal Dosing" : "Retrieve Medication Renal Dosing",
        getMedicationSafety: isHebrew ? "Get medication safety data" : "MEDICATION SAFETY - Get medication safety data including avoid medications, drug interactions, renal dosing adjustments, contrast restrictions",
        getMedicationSafetyAlerts: isHebrew ? "Retrieve Medication Safety Alerts" : "Retrieve Medication Safety Alerts",
        getMedications: isHebrew ? "הצג תרופות" : "Get medications",
        getMedicationsAdministered: isHebrew ? "Retrieve Medications Administered" : "Retrieve Medications Administered",
        getMeniscusRepair: isHebrew ? "Retrieve Meniscus Repair" : "Retrieve Meniscus Repair",
        getMentalHealthAssessments: isHebrew ? "Retrieve Mental Health Assessments" : "Retrieve Mental Health Assessments",
        getMentalHealthResources: isHebrew ? "Retrieve Mental Health Resources" : "Retrieve Mental Health Resources",
        getMentalStatusExams: isHebrew ? "Retrieve Mental Status" : "Retrieve Mental Status",
        getMicrobiologyCultureReports: isHebrew ? "Retrieve Microbiology Culture Reports" : "Retrieve Microbiology Culture Reports",
        getMineralBoneDisease: isHebrew ? "Retrieve Mineral Bone Disease" : "Retrieve Mineral Bone Disease",
        getMonitoringPlans: isHebrew ? "Retrieve Monitoring Plans" : "Retrieve Monitoring Plans",
        getMonitoringReports: isHebrew ? "Retrieve Monitoring Reports" : "Retrieve Monitoring Reports",
        getMoodPsychologicalAssessment: isHebrew ? "Retrieve Mood Psychological Assessment" : "Retrieve Mood Psychological Assessment",
        getMortalityRiskAssessment: isHebrew ? "Retrieve Mortality Risk Assessment" : "Retrieve Mortality Risk Assessment",
        getMotorComplications: isHebrew ? "Retrieve Motor Complications" : "Retrieve Motor Complications",
        getMovementDisorderAssessment: isHebrew ? "Retrieve Movement Disorder Assessment" : "Retrieve Movement Disorder Assessment",
        getMriReports: isHebrew ? "Retrieve MRI Reports" : "Retrieve MRI Reports",
        getMultimodalPainTherapy: isHebrew ? "Retrieve Multimodal Pain Therapy" : "Retrieve Multimodal Pain Therapy",
        getMultipleSclerosisAssessment: isHebrew ? "Retrieve Multiple Sclerosis Assessment" : "Retrieve Multiple Sclerosis Assessment",
        getMyelomaSpecificData: isHebrew ? "Retrieve Myeloma Specific Data" : "Retrieve Myeloma Specific Data",
        getMyositisAssessment: isHebrew ? "Retrieve Myositis Assessment" : "Retrieve Myositis Assessment",
        getNarcolepsyAssessment: isHebrew ? "Retrieve Narcolepsy Assessment" : "Retrieve Narcolepsy Assessment",
        getNephrologyConsultationDetails: isHebrew ? "Retrieve Nephrology Consultation Details" : "Retrieve Nephrology Consultation Details",
        getNephrologyConsultations: isHebrew ? "Request nephrology consultations" : "Request nephrology consultations",
        getNeuroImaging: isHebrew ? "הדמיה פונקציונלית מתקדמת (fMRI, DTI, טרקטוגרפיה)" : "NEURO IMAGING - Get advanced functional neuroimaging (fMRI, DTI, tractography), brain mapping, pre-surgical planning, motor/language mapping, eloquent cortex",
        getNeurologicalAssessment: isHebrew ? "Retrieve Neurological Assessment" : "Retrieve Neurological Assessment",
        getNeurologicalExam: isHebrew ? "Retrieve Neurological Exam" : "Retrieve Neurological Exam",
        getNeurologicalExamination: isHebrew ? "Retrieve Neurological Examination" : "Retrieve Neurological Examination",
        getNeurologicalFindings: isHebrew ? "ממצאים נוירולוגיים" : "NEUROLOGICAL FINDINGS - Get neurological study findings including brain, spinal cord, peripheral nerve, cranial nerve, motor, sensory, reflex, cerebellar, and brainstem findings with assessment and recommendations",
        getNeurologyConsultations: isHebrew ? "Request neurology evaluations" : "Request neurology evaluations",
        getNeurologyProgressNotes: isHebrew ? "Retrieve Neurology Notes" : "Retrieve Neurology Notes",
        getNeuromuscularDisorder: isHebrew ? "Retrieve Neuromuscular Disorder" : "Retrieve Neuromuscular Disorder",
        getNeuropsychTesting: isHebrew ? "Retrieve Neuropsych Testing" : "Retrieve Neuropsych Testing",
        getNeuropsychologicalAssessments: isHebrew ? "Retrieve Cognitive Evaluations" : "Retrieve Cognitive Evaluations",
        getNeurosurgeryAssessment: isHebrew ? "הערכה נוירוכירורגית (fMRI, DTI, מיפוי גידול)" : "NEUROSURGERY ASSESSMENT - Get comprehensive neurosurgery assessment including functional MRI, tractography, tumor characteristics, intraoperative monitoring plan, ventriculostomy, surgical consultation, SMA management protocol, and tumor treating fields",
        getNeurosurgeryConsultations: isHebrew ? "Request neurosurgery consultations" : "Request neurosurgery consultations",
        getNeurovascularExam: isHebrew ? "Retrieve Neurovascular Exam" : "Retrieve Neurovascular Exam",
        getNewbornScreeningResults: isHebrew ? "Retrieve Newborn Test Results" : "Retrieve Newborn Test Results",
        getNicuProgressNotes: isHebrew ? "Retrieve NICU Progress Notes" : "Retrieve NICU Progress Notes",
        getNonMotorSymptoms: isHebrew ? "Retrieve Non Motor Symptoms" : "Retrieve Non Motor Symptoms",
        getNtScanResult: isHebrew ? "Retrieve Nt Scan Result" : "Retrieve Nt Scan Result",
        getNuclearMedicineAssessment: isHebrew ? "Retrieve Nuclear Medicine Assessment" : "Retrieve Nuclear Medicine Assessment",
        getNuclearMedicineStudies: isHebrew ? "Retrieve Nuclear Medicine Studies" : "Retrieve Nuclear Medicine Studies",
        getNurseSignatures: isHebrew ? "Retrieve Nurse Signatures" : "Retrieve Nurse Signatures",
        getNursingAssessments: isHebrew ? "Retrieve Nursing Assessments" : "Retrieve Nursing Assessments",
        getNursingNotes: isHebrew ? "Retrieve Nursing Documentation" : "Retrieve Nursing Documentation",
        getNutritionalAssessment: isHebrew ? "Retrieve Nutritional Assessment" : "Retrieve Nutritional Assessment",
        getNutritionalStatus: isHebrew ? "Retrieve Nutritional Status" : "Retrieve Nutritional Status",
        getNutritionalSupplementation: isHebrew ? "Retrieve Nutritional Supplementation" : "Retrieve Nutritional Supplementation",
        getNutritionalSupport: isHebrew ? "Retrieve Nutritional Support" : "Retrieve Nutritional Support",
        getObstetricHistory: isHebrew ? "Retrieve Obstetric History" : "Retrieve Obstetric History",
        getObstetricUltrasoundReports: isHebrew ? "Retrieve Obstetric Ultrasound" : "Retrieve Obstetric Ultrasound",
        getOccupationalExposureRecords: isHebrew ? "Retrieve Occupational Exposure Records" : "Retrieve Occupational Exposure Records",
        getOccupationalHealthAssessment: isHebrew ? "Retrieve Occupational Health Assessment" : "Retrieve Occupational Health Assessment",
        getOccupationalMedicineEvaluations: isHebrew ? "Retrieve Occupational Medicine Evaluations" : "Retrieve Occupational Medicine Evaluations",
        getOccupationalTherapyReports: isHebrew ? "Retrieve Therapy Reports" : "Retrieve Therapy Reports",
        getOmissionsRefusals: isHebrew ? "Retrieve Omissions Refusals" : "Retrieve Omissions Refusals",
        getOncologicEmergencies: isHebrew ? "Retrieve Oncologic Emergencies" : "Retrieve Oncologic Emergencies",
        getOncologyConsultations: isHebrew ? "Retrieve Cancer Consultations" : "Retrieve Cancer Consultations",
        getOncologyFollowupReports: isHebrew ? "Retrieve Oncology Reports" : "Retrieve Oncology Reports",
        getOncologyTeam: isHebrew ? "Retrieve Oncology Team" : "Retrieve Oncology Team",
        getOncologyTreatmentPlans: isHebrew ? "Retrieve Cancer Treatments" : "Retrieve Cancer Treatments",
        getOperativeDetails: isHebrew ? "Retrieve Operative Details" : "Retrieve Operative Details",
        getOperativeReportDetails: isHebrew ? "Retrieve DETAILED Surgery Info - surgeon name, assistants, procedure name, diagnosis, findings, specimens, blood loss, complications" : "Retrieve DETAILED Surgery Info - surgeon name, assistants, procedure name, diagnosis, findings, specimens, blood loss, complications",
        getOperativeReports: isHebrew ? "Retrieve General Operative Report Summaries" : "Retrieve General Operative Report Summaries",
        getOperativeTechnique: isHebrew ? "Retrieve Operative Technique" : "Retrieve Operative Technique",
        getOperativeTime: isHebrew ? "Retrieve Operative Time" : "Retrieve Operative Time",
        getOphthalmologyExam: isHebrew ? "Retrieve Ophthalmology Exam" : "Retrieve Ophthalmology Exam",
        getOphthalmologyExaminations: isHebrew ? "Retrieve Eye Exams" : "Retrieve Eye Exams",
        getOpioidRiskAssessment: isHebrew ? "Retrieve Opioid Risk Assessment" : "Retrieve Opioid Risk Assessment",
        getOpportunisticInfections: isHebrew ? "Retrieve Opportunistic Infections" : "Retrieve Opportunistic Infections",
        getOptimizationStats: isHebrew ? "Retrieve Optimization Stats" : "Retrieve Optimization Stats",
        getOralSurgeryReports: isHebrew ? "Retrieve Oral Surgery Reports" : "Retrieve Oral Surgery Reports",
        getOrthodonticTreatmentPlans: isHebrew ? "Retrieve Orthodontic Plans" : "Retrieve Orthodontic Plans",
        getOrthopedicAssessment: isHebrew ? "Retrieve Orthopedic Assessment" : "Retrieve Orthopedic Assessment",
        getOrthopedicConsultations: isHebrew ? "Retrieve Orthopedic Consultations" : "Retrieve Orthopedic Consultations",
        getOrthopedicFollowupNotes: isHebrew ? "Retrieve Orthopedic Notes" : "Retrieve Orthopedic Notes",
        getOrthopedicImaging: isHebrew ? "Retrieve Orthopedic Imaging" : "Retrieve Orthopedic Imaging",
        getOrthopedicOperativeReports: isHebrew ? "Retrieve Orthopedic Reports" : "Retrieve Orthopedic Reports",
        getOrthopedicProcedures: isHebrew ? "Retrieve Orthopedic Procedures" : "Retrieve Orthopedic Procedures",
        getOutcomesPrediction: isHebrew ? "Predict Future Outcomes" : "Predict Future Outcomes",
        getOvertrainingAssessment: isHebrew ? "Retrieve Overtraining Assessment" : "Retrieve Overtraining Assessment",
        getPainAssessmentForms: isHebrew ? "Retrieve Pain Assessment" : "Retrieve Pain Assessment",
        getPainFunctionalAssessment: isHebrew ? "Retrieve Pain Functional Assessment" : "Retrieve Pain Functional Assessment",
        getPainManagement: isHebrew ? "Retrieve Pain Management" : "Retrieve Pain Management",
        getPainManagementNotes: isHebrew ? "Retrieve Pain Notes" : "Retrieve Pain Notes",
        getPainManagementPlan: isHebrew ? "Retrieve Pain Management Plan" : "Retrieve Pain Management Plan",
        getPainMedicationAgreements: isHebrew ? "Retrieve Pain Medication Agreements" : "Retrieve Pain Medication Agreements",
        getPalliativeCare: isHebrew ? "Retrieve Palliative Care" : "Retrieve Palliative Care",
        getPalliativeCareNeeds: isHebrew ? "Retrieve Palliative Care Needs" : "Retrieve Palliative Care Needs",
        getParentalConcerns: isHebrew ? "Retrieve Parental Concerns" : "Retrieve Parental Concerns",
        getParkinsonMedications: isHebrew ? "Retrieve Parkinson Medications" : "Retrieve Parkinson Medications",
        getParkinsonianFeatures: isHebrew ? "Retrieve Parkinsonian Features" : "Retrieve Parkinsonian Features",
        getPartnerInvolvement: isHebrew ? "Retrieve Partner Involvement" : "Retrieve Partner Involvement",
        getPartnerInvolvementDiabetesManagement: isHebrew ? "Retrieve Partner Involvement Diabetes Management" : "Retrieve Partner Involvement Diabetes Management",
        getPastMedicalHistory: isHebrew ? "קבל היסטוריה רפואית קודמת" : "Retrieve Past Medical History",
        getPastOcularHistory: isHebrew ? "Retrieve Past Ocular History" : "Retrieve Past Ocular History",
        getPathologyGrossDescription: isHebrew ? "Retrieve Pathology Gross Description" : "Retrieve Pathology Gross Description",
        getPathologyReports: isHebrew ? "Retrieve Medical Reports" : "Retrieve Medical Reports",
        getPatientCareGoals: isHebrew ? "יעדי טיפול של מטופל - עדיפות, מצבים מטופלים, התערבויות" : "Get patient care goals - priority, addressed conditions, interventions, barriers",
        getPatientConsents: isHebrew ? "קבל הסכמות מטופל" : "Get patient consents",
        getPatientDetails: isHebrew ? "פרטי מטופל" : "Patient details",
        getPatientEducationContext: isHebrew ? "Patient Education Details" : "Patient Education Details",
        getPatientEducationRecords: isHebrew ? "Retrieve Patient Education" : "Retrieve Patient Education",
        getPatientEmotionalResponse: isHebrew ? "Retrieve Patient Emotional Response" : "Retrieve Patient Emotional Response",
        getPatientInstructions: isHebrew ? "Retrieve Patient Instructions" : "Retrieve Patient Instructions",
        getPatientPositioning: isHebrew ? "Retrieve Patient Positioning" : "Retrieve Patient Positioning",
        getPatientProvider: isHebrew ? "הצג רופא של מטופל" : "Get patient's assigned provider",
        getPatientSpecificCarePlan: isHebrew ? "Retrieve Patient Care Plan" : "Retrieve Patient Care Plan",
        getPatientsList: isHebrew ? "רשימת מטופלים" : "Patients list",
        getPediatricGrowthCharts: isHebrew ? "Pediatric Growth Tracking" : "Pediatric Growth Tracking",
        getPediatricScreening: isHebrew ? "Retrieve Pediatric Screening" : "Retrieve Pediatric Screening",
        getPediatricVaccinationRecords: isHebrew ? "Retrieve Child Vaccines" : "Retrieve Child Vaccines",
        getPediatricVisits: isHebrew ? "Count Child Checkups" : "Count Child Checkups",
        getPerformanceAssessment: isHebrew ? "Retrieve Performance Assessment" : "Retrieve Performance Assessment",
        getPerformanceStatus: isHebrew ? "Retrieve Performance Status" : "Retrieve Performance Status",
        getPerinatalMentalHealthReferral: isHebrew ? "Retrieve Perinatal Mental Health Referral" : "Retrieve Perinatal Mental Health Referral",
        getPeriodontalCharts: isHebrew ? "Retrieve Dental Records" : "Retrieve Dental Records",
        getPeripheralNeuropathy: isHebrew ? "Retrieve Peripheral Neuropathy" : "Retrieve Peripheral Neuropathy",
        getPetScanReports: isHebrew ? "Retrieve Pet Scans" : "Retrieve Pet Scans",
        getPharmacyReview: isHebrew ? "Retrieve Pharmacy Review" : "Retrieve Pharmacy Review",
        getPhysicalExaminations: isHebrew ? "Retrieve Physical Examinations" : "Retrieve Physical Examinations",
        getPhysicalTherapyEvaluations: isHebrew ? "Physical Therapy Assessments" : "Physical Therapy Assessments",
        getPhysicalTherapyNotes: isHebrew ? "Retrieve Physical Therapy Notes" : "Retrieve Physical Therapy Notes",
        getPlasticSurgeryAssessment: isHebrew ? "Retrieve Plastic Surgery Assessment" : "Retrieve Plastic Surgery Assessment",
        getPlasticSurgeryConsultations: isHebrew ? "Book Cosmetic Consultations" : "Book Cosmetic Consultations",
        getPmrAssessment: isHebrew ? "Retrieve Pmr Assessment" : "Retrieve Pmr Assessment",
        getPneumoperitoneum: isHebrew ? "Retrieve Pneumoperitoneum" : "Retrieve Pneumoperitoneum",
        getPodiatryExaminations: isHebrew ? "Retrieve Podiatry Examinations" : "Retrieve Podiatry Examinations",
        getPointOfCareUltrasoundHeartRate: isHebrew ? "Retrieve Point Of Care Ultrasound Heart Rate" : "Retrieve Point Of Care Ultrasound Heart Rate",
        getPoisonControlReports: isHebrew ? "Retrieve Poison Reports" : "Retrieve Poison Reports",
        getPolycysticKidneyDisease: isHebrew ? "Retrieve Polycystic Kidney Disease" : "Retrieve Polycystic Kidney Disease",
        getPolypharmacy: isHebrew ? "Retrieve Polypharmacy" : "Retrieve Polypharmacy",
        getPolypharmacyReviews: isHebrew ? "Retrieve Medication Interactions" : "Retrieve Medication Interactions",
        getPortPlacement: isHebrew ? "Retrieve Port Placement" : "Retrieve Port Placement",
        getPostDialysisAssessment: isHebrew ? "Retrieve Post Dialysis Assessment" : "Retrieve Post Dialysis Assessment",
        getPostoperativePainManagement: isHebrew ? "Retrieve Postoperative Pain Management" : "Retrieve Postoperative Pain Management",
        getPostOpTesting: isHebrew ? "Retrieve Post Op Testing" : "Retrieve Post Op Testing",
        getPostOperativeReports: isHebrew ? "Retrieve Surgical Reports" : "Retrieve Surgical Reports",
        getPostopTesting: isHebrew ? "Retrieve Postop Testing" : "Retrieve Postop Testing",
        getPostoperativeCondition: isHebrew ? "Retrieve Postoperative Condition" : "Retrieve Postoperative Condition",
        getPostoperativeOrders: isHebrew ? "Retrieve Postoperative Orders" : "Retrieve Postoperative Orders",
        getPostpartumDiabetesRisk: isHebrew ? "Retrieve Postpartum Diabetes Risk" : "Retrieve Postpartum Diabetes Risk",
        getPostpartumGlucoseMonitoring: isHebrew ? "Retrieve Postpartum Glucose Monitoring" : "Retrieve Postpartum Glucose Monitoring",
        getPostpartumNotes: isHebrew ? "Retrieve Postpartum Notes" : "Retrieve Postpartum Notes",
        getPostpartumPlanning: isHebrew ? "Retrieve Postpartum Planning" : "Retrieve Postpartum Planning",
        getPotentialTestingOutcomes: isHebrew ? "Retrieve Potential Testing Outcomes" : "Retrieve Potential Testing Outcomes",
        getPreChemotherapyWorkup: isHebrew ? "Retrieve Pre Chemotherapy Workup" : "Retrieve Pre Chemotherapy Workup",
        getPreDialysisAssessment: isHebrew ? "Retrieve Pre Dialysis Assessment" : "Retrieve Pre Dialysis Assessment",
        getPreEmploymentPhysical: isHebrew ? "Retrieve Pre Employment Physical" : "Retrieve Pre Employment Physical",
        getPreOperativeAssessments: isHebrew ? "Retrieve Pre-Op Assessments" : "Retrieve Pre-Op Assessments",
        getPreoperativeEvaluation: isHebrew ? "Retrieve Preoperative Evaluation" : "Retrieve Preoperative Evaluation",
        getPreOperativePreparation: isHebrew ? "Retrieve Pre Operative Preparation" : "Retrieve Pre Operative Preparation",
        getPrePregnancyWeight: isHebrew ? "Retrieve Pre Pregnancy Weight" : "Retrieve Pre Pregnancy Weight",
        getPreconceptionCounseling: isHebrew ? "Retrieve Preconception Counseling" : "Retrieve Preconception Counseling",
        getPreeclampsiaMonitoring: isHebrew ? "Retrieve Preeclampsia Monitoring" : "Retrieve Preeclampsia Monitoring",
        getPregnancyComplications: isHebrew ? "Retrieve Pregnancy Complications" : "Retrieve Pregnancy Complications",
        getPregnancyCourse: isHebrew ? "Retrieve Pregnancy Course" : "Retrieve Pregnancy Course",
        getPregnancyRiskAssessment: isHebrew ? "Retrieve Pregnancy Risk Assessment" : "Retrieve Pregnancy Risk Assessment",
        getPregnancySymptoms: isHebrew ? "Retrieve Pregnancy Symptoms" : "Retrieve Pregnancy Symptoms",
        getPrenatalEducation: isHebrew ? "Retrieve Prenatal Education" : "Retrieve Prenatal Education",
        getPrenatalScreening: isHebrew ? "Retrieve Prenatal Screening" : "Retrieve Prenatal Screening",
        getPrenatalTestingReports: isHebrew ? "Retrieve Prenatal Test Reports" : "Retrieve Prenatal Test Reports",
        getPrenatalVisits: isHebrew ? "Track pregnancy checkups" : "Track pregnancy checkups",
        getPreoperativePreparation: isHebrew ? "Retrieve Preoperative Preparation" : "Retrieve Preoperative Preparation",
        getPrepAndDrape: isHebrew ? "Retrieve Prep And Drape" : "Retrieve Prep And Drape",
        getPrescriptions: isHebrew ? "הצג מרשמים" : "Get prescriptions",
        getPressureInjury: isHebrew ? "Retrieve Pressure Injury" : "Retrieve Pressure Injury",
        getPressureUlcerRisk: isHebrew ? "Retrieve Pressure Ulcer Risk" : "Retrieve Pressure Ulcer Risk",
        getPreventiveBiomarkers: isHebrew ? "Retrieve Preventive Biomarkers" : "Retrieve Preventive Biomarkers",
        getPreventiveCare: isHebrew ? "Retrieve Preventive Care" : "Retrieve Preventive Care",
        getPreventiveMedicineAssessments: isHebrew ? "Retrieve Preventive Medicine Assessments" : "Retrieve Preventive Medicine Assessments",
        getPrimaryProphylaxis: isHebrew ? "Retrieve Primary Prophylaxis" : "Retrieve Primary Prophylaxis",
        getPriorAuthorizationForms: isHebrew ? "Request Medical Authorization" : "Request Medical Authorization",
        getPriorAuthorizationStatus: isHebrew ? "Retrieve Prior Authorization Status" : "Retrieve Prior Authorization Status",
        getPrnMedications: isHebrew ? "Retrieve Prn Medications" : "Retrieve Prn Medications",
        getProceduralSedation: isHebrew ? "Retrieve Procedural Sedation" : "Retrieve Procedural Sedation",
        getProcedureRequests: isHebrew ? "Retrieve Procedure Requests" : "Retrieve Procedure Requests",
        getProceduresInterventions: isHebrew ? "Retrieve Procedures Interventions" : "Retrieve Procedures Interventions",
        getPrognosis: isHebrew ? "Retrieve Prognosis Assessments" : "PROGNOSIS - Get patient prognosis assessments (short-term outlook, long-term outlook, risk factors, protective factors, treatment response). Use when user asks for 'prognosis' or 'outlook'. Do NOT also call getOutcomesPredictions - choose ONE function only.",
        getPrognosisDiscussion: isHebrew ? "Retrieve Prognosis Discussion" : "Retrieve Prognosis Discussion",
        getPrognosisRecords: isHebrew ? "Retrieve Patient Prognoses" : "PROGNOSIS RECORDS - Get historical prognosis records with diagnosis, mortality risk, survival statistics. Use when user asks for 'prognosis records' or 'prognosis history'.",
        getPrognosticFactors: isHebrew ? "Retrieve Prognostic Factors" : "Retrieve Prognostic Factors",
        getProgressNotes: isHebrew ? "Retrieve Patient Notes" : "Retrieve Patient Notes",
        getProphylacticMedications: isHebrew ? "Retrieve Prophylactic Medications" : "Retrieve Prophylactic Medications",
        getProposedArtSwitch: isHebrew ? "Retrieve Proposed Art Switch" : "Retrieve Proposed Art Switch",
        getProteinuriaAssessment: isHebrew ? "Retrieve Proteinuria Assessment" : "Retrieve Proteinuria Assessment",
        getDoctorAppointments: isHebrew ? "תורים של רופא" : "Doctor appointments",
        getDoctorAvailability: isHebrew ? "זמינות רופא" : "Doctor availability",
        getProviderInfo: isHebrew ? "Retrieve Provider Info" : "Retrieve Provider Info",
        getDoctorSchedule: isHebrew ? "לוח זמנים" : "Get schedule",
        getPscManagement: isHebrew ? "Retrieve Psc Management" : "Retrieve Psc Management",
        getPsychiatricAssessmentScales: isHebrew ? "Retrieve Psychiatric Assessment Scales" : "Retrieve Psychiatric Assessment Scales",
        getPsychiatricDischargeSummaries: isHebrew ? "Retrieve Psychiatric Summaries" : "Retrieve Psychiatric Summaries",
        getPsychiatricEvaluations: isHebrew ? "Retrieve Mental Health Assessments" : "Retrieve Mental Health Assessments",
        getPsychiatricHistory: isHebrew ? "Retrieve Psychiatric History" : "Retrieve Psychiatric History",
        getPsychiatricProgressNotes: isHebrew ? "Retrieve Mental Health Records" : "Retrieve Mental Health Records",
        getPsychiatricReview: isHebrew ? "Retrieve Psychiatric Review" : "Retrieve Psychiatric Review",
        getPsychiatricTreatmentPlan: isHebrew ? "Retrieve Psychiatric Treatment Plan" : "Retrieve Psychiatric Treatment Plan",
        getPsychosocialAssessments: isHebrew ? "הערכות פסיכוסוציאליות קליניות" : "PSYCHOSOCIAL ASSESSMENTS (Clinical) - Get clinical psychosocial assessments with Edinburgh scores, anxiety screening, domestic violence screening, substance use screening, housing/financial/relationship stress, postpartum depression screening, findings, assessment, plan. Use for FORMAL CLINICAL assessments. NOT for barriers to care - use getBarriersPsychosocialIssues instead.",
        getPsychosocialFactors: isHebrew ? "גורמים פסיכוסוציאליים" : "PSYCHOSOCIAL FACTORS - Get patient psychosocial factors including STRESSORS (work stress, family pressure, anxiety, sleep issues), SUPPORT systems (family, partner support), COPING STRATEGIES (how patient manages stress, dietary compliance, glucose monitoring habits), MENTAL HEALTH status (anxiety, depression, adjustment disorders), findings, assessment, plan, and notes. Use when user asks for 'psychosocial factors', 'stressors', 'coping strategies', 'support system', 'mental health factors', or psychological/emotional factors affecting care. NOT for clinical screening tools - use getPsychosocialAssessments. NOT for barriers to care - use getBarriersPsychosocialIssues.",
        getPsychosocialOncology: isHebrew ? "Retrieve Psychosocial Oncology" : "Retrieve Psychosocial Oncology",
        getPsychosocialSupportServices: isHebrew ? "Retrieve Psychosocial Support Services" : "Retrieve Psychosocial Support Services",
        getPsychotropicMedications: isHebrew ? "Retrieve Psychotropic Medications" : "Retrieve Psychotropic Medications",
        getPulmonaryFunctionTests: isHebrew ? "Lung Function Assessment" : "Lung Function Assessment",
        getPulmonaryImaging: isHebrew ? "Retrieve Pulmonary Imaging" : "Retrieve Pulmonary Imaging",
        getPulmonaryRehabilitation: isHebrew ? "Retrieve Pulmonary Rehabilitation" : "Retrieve Pulmonary Rehabilitation",
        getPulmonaryRehabilitationNotes: isHebrew ? "Retrieve Pulmonary Rehab Notes" : "Retrieve Pulmonary Rehab Notes",
        getPulmonologyConsultations: isHebrew ? "Retrieve Pulmonology Consultations" : "Retrieve Pulmonology Consultations",
        getPumpAdvancedSettings: isHebrew ? "Retrieve Pump Advanced Settings" : "Retrieve Pump Advanced Settings",
        getPumpDownloadAnalysis: isHebrew ? "Retrieve Pump Download Analysis" : "Retrieve Pump Download Analysis",
        getQualityAssurance: isHebrew ? "Retrieve Quality Assurance" : "Retrieve Quality Assurance",
        getQualityMetrics: isHebrew ? "Retrieve Quality Metrics" : "Retrieve Quality Metrics",
        getRadiationOncology: isHebrew ? "Retrieve Radiation Oncology" : "Retrieve Radiation Oncology",
        getRadiationTherapy: isHebrew ? "Retrieve Radiation Therapy" : "Retrieve Radiation Therapy",
        getRadiationTherapyRecords: isHebrew ? "Retrieve Radiation Therapy" : "Retrieve Radiation Therapy",
        getRadiologyFindings: isHebrew ? "ממצאי הדמיה (BI-RADS, TI-RADS, PI-RADS)" : "RADIOLOGY FINDINGS - Get radiology study findings with RADS scores (BI-RADS, TI-RADS, PI-RADS), imaging modality, technique, contrast information, anatomic findings, impression, and clinical significance",
        getRadiologyReports: isHebrew ? "Retrieve Radiology Reports" : "Retrieve Radiology Reports",
        getRapidResponseSummaries: isHebrew ? "Fetch Response Summaries" : "Fetch Response Summaries",
        getReadmissionRiskAssessment: isHebrew ? "Retrieve Readmission Risk Assessment" : "Retrieve Readmission Risk Assessment",
        getReasonForReferral: isHebrew ? "סיבת ההפניה - מדוע המטופל הופנה" : "REASON FOR REFERRAL - Get why patient was referred including referral indication, clinical findings, assessment, and plan. Use when user asks about 'reason for referral', 'why referred', 'referral reason', or 'indication for referral'. NOTE: This is different from getReferrals which returns referral orders/requests - use getReasonForReferral for the clinical reasoning behind a referral.",
        getRecommendations: isHebrew ? "Suggest personalized content" : "Suggest personalized content",
        getReferrals: isHebrew ? "הצג הפניות" : "REFERRALS - Get referral orders/requests to specialists including specialty, urgency, status, and referring provider. Use when user asks to see 'referrals', 'specialist referrals', or 'referral orders'. NOTE: This is different from getReasonForReferral which returns the clinical reasoning for why patient was referred. IMPORTANT: If the user says 'referrals placed' or 'placed referrals', use getReferralsPlaced instead - that is a DIFFERENT collection.",
        getReferralsPlaced: isHebrew ? "הצג הפניות שהונפקו" : "REFERRALS PLACED - Get referrals that have been PLACED/ISSUED for a patient including specialty, reason, urgency, provider, date, status, referring provider, and notes. Use when user asks for 'referrals placed', 'placed referrals', or 'referrals-placed'. IMPORTANT: This is DIFFERENT from getReferrals which returns general referral orders. If user specifically says 'referrals placed', ALWAYS use this function, NOT getReferrals.",
        getRegionalAnesthesiaRecords: isHebrew ? "Retrieve Regional Anesthesia Records" : "Retrieve Regional Anesthesia Records",
        getRehabilitationGoals: isHebrew ? "Retrieve Rehabilitation Goals" : "Retrieve Rehabilitation Goals",
        getRehabilitationProgressNotes: isHebrew ? "Track Patient Recovery" : "Track Patient Recovery",
        getRehabilitationProtocol: isHebrew ? "Retrieve Rehabilitation Protocol" : "Retrieve Rehabilitation Protocol",
        getReminders: isHebrew ? "הצג תזכורות" : "Get reminders",
        getRenalAnemia: isHebrew ? "Retrieve Renal Anemia" : "Retrieve Renal Anemia",
        getRenalNutrition: isHebrew ? "Retrieve Renal Nutrition" : "Retrieve Renal Nutrition",
        getRenalProtectionPlan: isHebrew ? "Retrieve Renal Protection Plan" : "Retrieve Renal Protection Plan",
        getReproductiveHistory: isHebrew ? "Retrieve Reproductive History" : "Retrieve Reproductive History",
        getRescueTherapyOptions: isHebrew ? "Retrieve Rescue Therapy Options" : "Retrieve Rescue Therapy Options",
        getResearchConsentForms: isHebrew ? "Request research consent" : "Request research consent",
        getRespiratoryDevices: isHebrew ? "Retrieve Respiratory Devices" : "Retrieve Respiratory Devices",
        getRespiratoryInfections: isHebrew ? "Retrieve Respiratory Infections" : "Retrieve Respiratory Infections",
        getRespiratoryMedications: isHebrew ? "Retrieve Respiratory Medications" : "Retrieve Respiratory Medications",
        getRespiteCare: isHebrew ? "Retrieve Respite Care" : "Retrieve Respite Care",
        getResponseAssessment: isHebrew ? "Retrieve Response Assessment" : "Retrieve Response Assessment",
        getResuscitationRecords: isHebrew ? "Retrieve Resuscitation Records" : "Retrieve Resuscitation Records",
        getRetinalExaminations: isHebrew ? "Retrieve Retinal Exams" : "Retrieve Retinal Exams",
        getReturnToPlayProtocol: isHebrew ? "Retrieve Return To Play Protocol" : "Retrieve Return To Play Protocol",
        getReturnToSport: isHebrew ? "Retrieve Return To Sport" : "Retrieve Return To Sport",
        getReturnToWorkPlan: isHebrew ? "Retrieve Return To Work Plan" : "Retrieve Return To Work Plan",
        getReviewOfSystems: isHebrew ? "Retrieve Review Of Systems" : "Retrieve Review Of Systems",
        getRheumatoidArthritisAssessment: isHebrew ? "Retrieve Rheumatoid Arthritis Assessment" : "Retrieve Rheumatoid Arthritis Assessment",
        getRheumatologicAssessment: isHebrew ? "Retrieve Rheumatologic Assessment" : "Retrieve Rheumatologic Assessment",
        getRheumatologicMonitoring: isHebrew ? "Retrieve Rheumatologic Monitoring" : "Retrieve Rheumatologic Monitoring",
        getRheumatologicTreatment: isHebrew ? "Retrieve Rheumatologic Treatment" : "Retrieve Rheumatologic Treatment",
        getRheumatologyConsultations: isHebrew ? "Retrieve Rheumatology Consultations" : "Retrieve Rheumatology Consultations",
        getRiskCalculators: isHebrew ? "Retrieve Risk Calculators" : "Retrieve Risk Calculators",
        getRiskCounseling: isHebrew ? "Retrieve Risk Counseling" : "Retrieve Risk Counseling",
        getRiskFactors: isHebrew ? "Identify health risks" : "Identify health risks",
        getSafetyPlanning: isHebrew ? "Retrieve Safety Planning" : "Retrieve Safety Planning",
        getScheduledMedications: isHebrew ? "Retrieve Scheduled Medications" : "Retrieve Scheduled Medications",
        getSchoolHealthForms: isHebrew ? "Request student health documents" : "Request student health documents",
        getSchoolPerformance: isHebrew ? "Retrieve School Performance" : "Retrieve School Performance",
        getSclerodermaAssessment: isHebrew ? "Retrieve Scleroderma Assessment" : "Retrieve Scleroderma Assessment",
        getScreeningCompliance: isHebrew ? "Retrieve Screening Compliance" : "Retrieve Screening Compliance",
        getSecondOpinionReports: isHebrew ? "Medical consultation summaries" : "Medical consultation summaries",
        getSecondaryProphylaxis: isHebrew ? "Retrieve Secondary Prophylaxis" : "Retrieve Secondary Prophylaxis",
        getSedationRecords: isHebrew ? "Retrieve Sedation Records" : "Retrieve Sedation Records",
        getSepsisManagement: isHebrew ? "Retrieve Sepsis Management" : "Retrieve Sepsis Management",
        getShiftHandoffNotes: isHebrew ? "Retrieve Shift Notes" : "Retrieve Shift Notes",
        getSingleEmbryoTransfer: isHebrew ? "Retrieve Single Embryo Transfer" : "Retrieve Single Embryo Transfer",
        getSingleEmbryoTransferDetails: isHebrew ? "Retrieve Single Embryo Transfer Details" : "Retrieve Single Embryo Transfer Details",
        getSjogrensSyndromeAssessment: isHebrew ? "Retrieve Sjogrens Syndrome Assessment" : "Retrieve Sjogrens Syndrome Assessment",
        getSkinBiopsyReports: isHebrew ? "Retrieve Skin Biopsy Reports" : "Retrieve Skin Biopsy Reports",
        getSleepApneaManagement: isHebrew ? "Retrieve Sleep Apnea Management" : "Retrieve Sleep Apnea Management",
        getSleepDisorderAssessment: isHebrew ? "Retrieve Sleep Disorder Assessment" : "Retrieve Sleep Disorder Assessment",
        getSleepDisturbances: isHebrew ? "Retrieve Sleep Disturbances" : "Retrieve Sleep Disturbances",
        getSleepHygieneEducation: isHebrew ? "Retrieve Sleep Hygiene Education" : "Retrieve Sleep Hygiene Education",
        getSleepStudyReports: isHebrew ? "Retrieve Sleep Study Reports" : "Retrieve Sleep Study Reports",
        getSoapNotes: isHebrew ? "Retrieve medical notes" : "Retrieve medical notes",
        getSocialDeterminantsOfHealth: isHebrew ? "Retrieve Social Determinants Of Health" : "Retrieve Social Determinants Of Health",
        getSocialFunctionalAssessment: isHebrew ? "Retrieve Social Functional Assessment" : "Retrieve Social Functional Assessment",
        getSocialHistory: isHebrew ? "Retrieve Social History" : "Retrieve Social History",
        getSocialSupport: isHebrew ? "Retrieve Social Support" : "Retrieve Social Support",
        getSocialWork: isHebrew ? "Retrieve Social Work" : "Retrieve Social Work",
        getSocialWorkNotes: isHebrew ? "Retrieve social work notes" : "Retrieve social work notes",
        getSource: isHebrew ? "Retrieve Source" : "Retrieve Source",
        getSouthAsianNutritionist: isHebrew ? "Retrieve South Asian Nutritionist" : "Retrieve South Asian Nutritionist",
        getSpecialtyFields: isHebrew ? "Retrieve Specialty Fields" : "Retrieve Specialty Fields",
        getSpecificIgeTests: isHebrew ? "Retrieve Specific IGE Tests" : "Retrieve Specific IGE Tests",
        getSpecimens: isHebrew ? "Retrieve Specimens" : "Retrieve Specimens",
        getSpeechTherapyAssessments: isHebrew ? "Retrieve Speech Therapy Assessments" : "Retrieve Speech Therapy Assessments",
        getSpondyloarthritisAssessment: isHebrew ? "Retrieve Spondyloarthritis Assessment" : "Retrieve Spondyloarthritis Assessment",
        getSpongeInstrumentCounts: isHebrew ? "Retrieve Sponge Instrument Counts" : "Retrieve Sponge Instrument Counts",
        getSportsMedicineEvaluations: isHebrew ? "Retrieve Sports Medicine Evaluations" : "Retrieve Sports Medicine Evaluations",
        getSportsNutritionPlan: isHebrew ? "Retrieve Sports Nutrition Plan" : "Retrieve Sports Nutrition Plan",
        getSportsPhysicalExamination: isHebrew ? "Retrieve Sports Physical Examination" : "Retrieve Sports Physical Examination",
        getStagingSummary: isHebrew ? "Retrieve Staging Summary" : "Retrieve Staging Summary",
        getStressManagementReferrals: isHebrew ? "Retrieve Stress Management Referrals" : "Retrieve Stress Management Referrals",
        getStressTestReports: isHebrew ? "Retrieve Stress Test Reports" : "Retrieve Stress Test Reports",
        getStrokeAssessment: isHebrew ? "Retrieve Stroke Assessment" : "Retrieve Stroke Assessment",
        getSubstanceUseAssessment: isHebrew ? "Retrieve Substance Use Assessment" : "Retrieve Substance Use Assessment",
        getSuicideRiskAssessment: isHebrew ? "Retrieve Suicide Risk Assessment" : "Retrieve Suicide Risk Assessment",
        getSupplementationPlans: isHebrew ? "Retrieve Supplementation Plans" : "Retrieve Supplementation Plans",
        getSupportGroupReferral: isHebrew ? "Retrieve Support Group Referral" : "Retrieve Support Group Referral",
        getSupportiveCare: isHebrew ? "Retrieve Supportive Care" : "Retrieve Supportive Care",
        getSurgicalApproach: isHebrew ? "Retrieve Surgical Approach" : "Retrieve Surgical Approach",
        getSurgicalConsentForms: isHebrew ? "Retrieve surgical consent" : "Retrieve surgical consent",
        getSurgicalHistory: isHebrew ? "Retrieve Surgical History" : "Retrieve Surgical History",
        getSurgicalOncology: isHebrew ? "Retrieve Surgical Oncology" : "Retrieve Surgical Oncology",
        getSurgicalSteps: isHebrew ? "Retrieve Surgical Steps" : "Retrieve Surgical Steps",
        getSurgicalTeam: isHebrew ? "Retrieve Surgical Team" : "Retrieve Surgical Team",
        getSurvivorshipCarePlan: isHebrew ? "Retrieve Survivorship Care Plan" : "Retrieve Survivorship Care Plan",
        getSymptomProgression: isHebrew ? "Retrieve Symptom Progression" : "Retrieve Symptom Progression",
        getSymptomProgressionTimeline: isHebrew ? "Retrieve Symptom Progression Timeline" : "Retrieve Symptom Progression Timeline",
        getSystemHealth: isHebrew ? "בריאות מערכת" : "System health",
        getTelemedicineEncounters: isHebrew ? "Retrieve Telemedicine Encounters" : "Retrieve Telemedicine Encounters",
        getTherapyProgressNotes: isHebrew ? "Track Patient Progress" : "Track Patient Progress",
        getTherapyRequests: isHebrew ? "Retrieve Therapy Requests" : "Retrieve Therapy Requests",
        getTherapySessionNotes: isHebrew ? "Retrieve Therapy Notes" : "Retrieve Therapy Notes",
        getThoracicSurgeryAssessment: isHebrew ? "Retrieve Thoracic Surgery Assessment" : "Retrieve Thoracic Surgery Assessment",
        getThyroidEvaluations: isHebrew ? "Retrieve Thyroid Tests" : "Retrieve Thyroid Tests",
        getThyroidManagement: isHebrew ? "Retrieve Thyroid Management" : "Retrieve Thyroid Management",
        getTotalWeightGain: isHebrew ? "Retrieve Total Weight Gain" : "Retrieve Total Weight Gain",
        getTourniquetData: isHebrew ? "Retrieve Tourniquet Data" : "Retrieve Tourniquet Data",
        getToxicityAssessment: isHebrew ? "Retrieve Toxicity Assessment" : "Retrieve Toxicity Assessment",
        getToxicologyReports: isHebrew ? "Retrieve Toxicology Reports" : "Retrieve Toxicology Reports",
        getTractographyStudies: isHebrew ? "Retrieve Brain Connectivity" : "Retrieve Brain Connectivity",
        getTransferSummaries: isHebrew ? "Retrieve transfer summaries" : "Retrieve transfer summaries",
        getTransplantAssessment: isHebrew ? "Retrieve Transplant Assessment" : "Retrieve Transplant Assessment",
        getTransplantEvaluations: isHebrew ? "Retrieve Transplant Assessments" : "Retrieve Transplant Assessments",
        getTraumaAssessment: isHebrew ? "Retrieve Trauma Assessment" : "Retrieve Trauma Assessment",
        getTraumaFlowSheets: isHebrew ? "Retrieve Trauma Sheets" : "Retrieve Trauma Sheets",
        getTraumaScoring: isHebrew ? "Retrieve Trauma Scoring" : "Retrieve Trauma Scoring",
        getTravelHealthCertificates: isHebrew ? "Retrieve Travel Certificates" : "Retrieve Travel Certificates",
        getTravelMedicineAssessment: isHebrew ? "Retrieve Travel Medicine Assessment" : "Retrieve Travel Medicine Assessment",
        getTravelVaccinationRecords: isHebrew ? "Retrieve Travel Vaccination Records" : "Retrieve Travel Vaccination Records",
        getTreatmentCourses: isHebrew ? "Retrieve Treatment Courses" : "Retrieve Treatment Courses",
        getTreatmentGoals: isHebrew ? "Retrieve Treatment Goals" : "Retrieve Treatment Goals",
        getTreatmentPlans: isHebrew ? "Retrieve Treatment Options" : "Retrieve Treatment Options",
        getTreatmentSummary: isHebrew ? "Retrieve Treatment Summary" : "Retrieve Treatment Summary",
        getTrendAnalysis: isHebrew ? "Retrieve Trend Analysis" : "Retrieve Trend Analysis",
        getTrendingAnalysis: isHebrew ? "Retrieve trending insights" : "Retrieve trending insights",
        getTriageData: isHebrew ? "Retrieve Triage Data" : "Retrieve Triage Data",
        getTropicalDiseaseAssessment: isHebrew ? "Retrieve Tropical Disease Assessment" : "Retrieve Tropical Disease Assessment",
        getTumorBoardNotes: isHebrew ? "Retrieve Tumor Board Notes" : "Retrieve Tumor Board Notes",
        getTumorMarkerPanels: isHebrew ? "Retrieve Tumor Markers" : "Retrieve Tumor Markers",
        getTumorMarkers: isHebrew ? "Retrieve Tumor Markers" : "Retrieve Tumor Markers",
        getUltrasoundObReports: isHebrew ? "Retrieve Ultrasound Reports" : "Retrieve Ultrasound Reports",
        getUmbilicalArteryDoppler: isHebrew ? "Retrieve Umbilical Artery Doppler" : "Retrieve Umbilical Artery Doppler",
        getUrodynamicStudies: isHebrew ? "Retrieve Urodynamic Tests" : "Retrieve Urodynamic Tests",
        getUrologyAssessment: isHebrew ? "Retrieve Urology Assessment" : "Retrieve Urology Assessment",
        getUrologyConsultations: isHebrew ? "Retrieve Urology Consultations" : "Retrieve Urology Consultations",
        getUsersBySpecialty: isHebrew ? "חפש לפי התמחות" : "Search by specialty",
        getVaccinationRecords: isHebrew ? "הצג חיסונים" : "Get vaccination records",
        getVaccinations: isHebrew ? "קבל חיסונים" : "Get vaccinations",
        getVariantInterpretationGuidelines: isHebrew ? "Retrieve Variant Interpretation Guidelines" : "Retrieve Variant Interpretation Guidelines",
        getVasculitisAssessment: isHebrew ? "Retrieve Vasculitis Assessment" : "Retrieve Vasculitis Assessment",
        getVenousThromboembolismRisk: isHebrew ? "Retrieve Venous Thromboembolism Risk" : "Retrieve Venous Thromboembolism Risk",
        getVentilatorSettings: isHebrew ? "Retrieve Ventilator Settings" : "Retrieve Ventilator Settings",
        getVisualAcuityReports: isHebrew ? "Retrieve Vision Reports" : "Retrieve Vision Reports",
        getVitalSigns: isHebrew ? "הצג סימנים" : "Get vitals",
        getVitalSignsLogs: isHebrew ? "Retrieve Vital Logs" : "Retrieve Vital Logs",
        getVitalSignsMonitoring: isHebrew ? "Retrieve Vital Signs Monitoring" : "Retrieve Vital Signs Monitoring",
        getVitalSignsTable: isHebrew ? "Retrieve Vital Signs Table" : "Retrieve Vital Signs Table",
        getWeeklyVirtualCheckIns: isHebrew ? "Retrieve Weekly Virtual Check Ins" : "Retrieve Weekly Virtual Check Ins",
        getWeightMeasurements: isHebrew ? "Retrieve Weight Measurements" : "Retrieve Weight Measurements",
        getWeightMonitoring: isHebrew ? "Retrieve Weight Monitoring" : "Retrieve Weight Monitoring",
        getWellChildExaminations: isHebrew ? "Child Health Checkups" : "Child Health Checkups",
        getWellChildSummary: isHebrew ? "Retrieve Well Child Summary" : "Retrieve Well Child Summary",
        getWellnessVisitDocumentation: isHebrew ? "Retrieve Wellness Visit Documentation" : "Retrieve Wellness Visit Documentation",
        getWorkAccommodations: isHebrew ? "Retrieve Work Accommodations" : "Retrieve Work Accommodations",
        getWorkersCompensationEvaluation: isHebrew ? "Retrieve Workers Compensation Evaluation" : "Retrieve Workers Compensation Evaluation",
        getWorkplaceInjuryReport: isHebrew ? "Retrieve Workplace Injury Report" : "Retrieve Workplace Injury Report",
        getWorkRestrictions: isHebrew ? "Work Restrictions - lifting limits, return to work dates, duty limitations" : "Work Restrictions - lifting limits, return to work dates, duty limitations",
        getWorkersCompEvaluations: isHebrew ? "Workers' Compensation Assessments" : "Workers' Compensation Assessments",
        getWorkplaceAccommodations: isHebrew ? "Retrieve Workplace Accommodations" : "Retrieve Workplace Accommodations",
        getWoundCareAssessments: isHebrew ? "Retrieve Wound Care Assessments" : "Retrieve Wound Care Assessments",
        getWoundCareDocumentation: isHebrew ? "Retrieve Wound Care Records" : "Retrieve Wound Care Records",
        getWoundCareNotes: isHebrew ? "Retrieve Wound Notes" : "Retrieve Wound Notes",
        initialize: isHebrew ? "אתחל שירות" : "Initialize service",
        listPatientMedicalCategories: isHebrew ? "קטגוריות רפואיות" : "Medical categories",
        lookupDoctor: isHebrew ? "חפש רופא" : "Lookup doctor",
        previewPendingDocument: isHebrew ? "הצג מידע על מסמך" : "Preview document info",
        recommendTreatment: isHebrew ? "המלץ טיפול" : "Recommend treatment",
        removeUserRole: isHebrew ? "הסר הרשאה" : "Remove role",
        removeUserSpecialty: isHebrew ? "הסר התמחות" : "Remove specialty",
        requestPermission: isHebrew ? "בקש הרשאה מהמנהל" : "Request permission from admin",
        getPendingPermissionRequests: isHebrew ? "בקשות הרשאה ממתינות" : "List pending permission requests",
        approvePermissionRequest: isHebrew ? "אשר בקשת הרשאה" : "Approve permission request",
        denyPermissionRequest: isHebrew ? "דחה בקשת הרשאה" : "Deny permission request",
        runBackup: isHebrew ? "גיבוי" : "Backup",
        scheduleAppointment: isHebrew ? "קבע תור" : "Schedule appointment",
        sendCalendarSyncEmail: isHebrew ? "שלח קישור יומן" : "Send calendar link",
        setDoctorAvailability: isHebrew ? "עדכן זמינות" : "Set availability",
        storeExtractedMedicalData: isHebrew ? "שמור נתונים מחולצים" : "Store extracted data",
        storeMedicalData: isHebrew ? "שמור נתונים רפואיים" : "Store medical data",
        syncActivePrescriptionToMedication: isHebrew ? "סנכרן מרשם לתרופות" : "Sync prescription",
        syncWithGoogleCalendar: isHebrew ? "סנכרון גוגל" : "Google sync",
        updateAbnormalResult: isHebrew ? "Update Abnormal Result" : "Update Abnormal Result",
        updateAbnormalResults: isHebrew ? "Update Abnormal Results" : "Update Abnormal Results",
        updateAccessPlanning: isHebrew ? "Update Access Planning" : "Update Access Planning",
        updateAcmgGuidelinesReference: isHebrew ? "Update Acmg Guidelines Reference" : "Update Acmg Guidelines Reference",
        updateAcuteKidneyInjury: isHebrew ? "Update Acute Kidney Injury" : "Update Acute Kidney Injury",
        updateAddictionMedicineConsultation: isHebrew ? "Update Addiction Medicine Consultation" : "Update Addiction Medicine Consultation",
        updateAddictionMedicineConsultations: isHebrew ? "Update Addiction Medicine Consultations" : "Update Addiction Medicine Consultations",
        updateAdhdAssessment: isHebrew ? "Update Adhd Assessment" : "Update Adhd Assessment",
        updateAdministrativeData: isHebrew ? "Update Administrative Data" : "Update Administrative Data",
        updateAdmissionAssessment: isHebrew ? "Modify admission assessment" : "Modify admission assessment",
        updateAdmissionAssessments: isHebrew ? "Update Admission Assessments" : "Update Admission Assessments",
        updateAdmissionDecision: isHebrew ? "Update Admission Decision" : "Update Admission Decision",
        updateAdmissionDecisions: isHebrew ? "Update Admission Decisions" : "Update Admission Decisions",
        updateAdmissionRecommendation: isHebrew ? "Update Admission Recommendation" : "Update Admission Recommendation",
        updateAdmissionRecommendations: isHebrew ? "Update Admission Recommendations" : "Update Admission Recommendations",
        updateAdultDayProgramInfo: isHebrew ? "Update Adult Day Program Info" : "Update Adult Day Program Info",
        updateAdvanceCarePlanning: isHebrew ? "Update Advance Care Planning" : "Update Advance Care Planning",
        updateGoalsOfCareDiscussions: isHebrew ? "Update Advanced Directives" : "Update Advanced Directives",
        updateAdvanceDirective: isHebrew ? "Update Advance Directive" : "Update Advance Directive",
        updateAdvanceDirectiveDiscussion: isHebrew ? "Update Advance Directive Discussion" : "Update Advance Directive Discussion",
        updateGeriatricCarePlanning: isHebrew ? "Update Advanced Care Planning" : "Update Advanced Care Planning",
        updateAdvancedDirective: isHebrew ? "Update Patient Preferences" : "Update Patient Preferences",
        updateAdvanceDirectives: isHebrew ? "Update Advance Directives" : "Update Advance Directives",
        updateAirwayManagementRecords: isHebrew ? "Update Airway Management Records" : "Update Airway Management Records",
        updateAllergies: isHebrew ? "Update Allergies" : "Update Allergies",
        updateAllergiesAssessment: isHebrew ? "Update Allergy Status" : "Update Allergy Status",
        updateAllergiesAssessments: isHebrew ? "Update Allergies Assessments" : "Update Allergies Assessments",
        updateAllergy: isHebrew ? "Modify allergy record" : "Modify allergy record",
        updateAllergyAssessment: isHebrew ? "Update Allergy Assessment" : "Update Allergy Assessment",
        updateAllergyAssessments: isHebrew ? "Update Allergy Assessments" : "Update Allergy Assessments",
        updateAllergyImmunologyAssessment: isHebrew ? "Update Allergy Immunology Assessment" : "Update Allergy Immunology Assessment",
        updateAllergySkinTesting: isHebrew ? "Update Allergy Skin Testing" : "Update Allergy Skin Testing",
        updateAmniocentesisReport: isHebrew ? "Update Amnio Report" : "Update Amnio Report",
        updateAmniocentesisReports: isHebrew ? "Update Amniocentesis Reports" : "Update Amniocentesis Reports",
        updateAmnioticFluidAssessment: isHebrew ? "Update Amniotic Fluid Assessment" : "Update Amniotic Fluid Assessment",
        updateAmnioticFluidIndexCurrent: isHebrew ? "Update Amniotic Fluid Index Current" : "Update Amniotic Fluid Index Current",
        updateAnatomyScanResult: isHebrew ? "Update Anatomy Scan Result" : "Update Anatomy Scan Result",
        updateAnesthesiaComplications: isHebrew ? "Update Anesthesia Complications" : "Update Anesthesia Complications",
        updateAnesthesiaConsent: isHebrew ? "Update Anesthesia Consent" : "Update Anesthesia Consent",
        updateAnesthesiaRecord: isHebrew ? "Update Patient Anesthesia" : "Update Patient Anesthesia",
        updateAnesthesiaRecords: isHebrew ? "Update Anesthesia Records" : "Update Anesthesia Records",
        updateAnesthesiologyAssessment: isHebrew ? "Update Anesthesiology Assessment" : "Update Anesthesiology Assessment",
        updateAnnualPhysicalExamination: isHebrew ? "Update Annual Physical Examination" : "Update Annual Physical Examination",
        updateAntibiogramReport: isHebrew ? "Update Antibiogram Report" : "Update Antibiogram Report",
        updateAntibiogramReports: isHebrew ? "Update Antibiogram Reports" : "Update Antibiogram Reports",
        updateAntibioticStewardship: isHebrew ? "Update Antibiotic Stewardship" : "Update Antibiotic Stewardship",
        updateAnticipatoryGuidance: isHebrew ? "Update Anticipatory Guidance" : "Update Anticipatory Guidance",
        updateAnticoagulationManagement: isHebrew ? "Update Anticoagulation Management" : "Update Anticoagulation Management",
        updateAntimicrobialSusceptibility: isHebrew ? "Update Antimicrobial Susceptibility" : "Update Antimicrobial Susceptibility",
        updateApgarScore: isHebrew ? "Calculate Newborn Health" : "Calculate Newborn Health",
        updateApgarScores: isHebrew ? "Update Apgar Scores" : "Update Apgar Scores",
        updateAppetiteStimulant: isHebrew ? "Update Appetite Stimulant" : "Update Appetite Stimulant",
        updateAppetiteStimulants: isHebrew ? "Update Appetite Stimulants" : "Update Appetite Stimulants",
        updateAppointment: isHebrew ? "עדכן תור" : "Update appointment",
        updateAppointments: isHebrew ? "Update Appointments" : "Update Appointments",
        updateArterialBloodGas: isHebrew ? "Update Arterial Blood Gas" : "Update Arterial Blood Gas",
        updateArterialBloodGases: isHebrew ? "Update Arterial Blood Gases" : "Update Arterial Blood Gases",
        updateArthritisAssessment: isHebrew ? "Modify arthritis evaluation" : "Modify arthritis evaluation",
        updateArthritisAssessments: isHebrew ? "Update Arthritis Assessments" : "Update Arthritis Assessments",
        updateArticularCartilage: isHebrew ? "Update Articular Cartilage" : "Update Articular Cartilage",
        updateAssessmentPlan: isHebrew ? "Update Assessment Plan" : "Update Assessment Plan",
        updateAssessmentPlans: isHebrew ? "Update Assessment Plans" : "Update Assessment Plans",
        updateAssistiveDevice: isHebrew ? "Update Assistive Device" : "Update Assistive Device",
        updateAssistiveDevices: isHebrew ? "Update Assistive Devices" : "Update Assistive Devices",
        updateAsthmaActionPlan: isHebrew ? "Update Asthma Action Plan" : "Update Asthma Action Plan",
        updateAsthmaAssessment: isHebrew ? "Update Asthma Assessment" : "Update Asthma Assessment",
        updateAsthmaAssessments: isHebrew ? "Update Asthma Assessments" : "Update Asthma Assessments",
        updateAsthmaManagementNote: isHebrew ? "Update Asthma Note" : "Update Asthma Note",
        updateAsthmaManagementNotes: isHebrew ? "Update Asthma Management Notes" : "Update Asthma Management Notes",
        updateAthleteSpecificData: isHebrew ? "Update Athlete Specific Data" : "Update Athlete Specific Data",
        updateAthleticInjuryAssessment: isHebrew ? "Update Athletic Injury Assessment" : "Update Athletic Injury Assessment",
        updateAudiometryReport: isHebrew ? "Update Audiometry Report" : "Update Audiometry Report",
        updateAudiometryReports: isHebrew ? "Update Audiometry Reports" : "Update Audiometry Reports",
        updateAutoantibodyProfile: isHebrew ? "Update Autoantibody Profile" : "Update Autoantibody Profile",
        updateAutoimmuneEvaluation: isHebrew ? "Assess Autoimmune Status" : "Assess Autoimmune Status",
        updateAutoimmuneEvaluations: isHebrew ? "Update Autoimmune Evaluations" : "Update Autoimmune Evaluations",
        updateAutoimmunePanel: isHebrew ? "Update Autoimmune Panel" : "Update Autoimmune Panel",
        updateAutoimmunePanels: isHebrew ? "Update Autoimmune Panels" : "Update Autoimmune Panels",
        updateAutopsyReport: isHebrew ? "Update Medical Record" : "Update Medical Record",
        updateAutopsyReports: isHebrew ? "Update Autopsy Reports" : "Update Autopsy Reports",
        updateBarriersPsychosocialIssue: isHebrew ? "Update Barriers Psychosocial Issue" : "Update Barriers Psychosocial Issue",
        updateBarriersPsychosocialIssues: isHebrew ? "Update Barriers Psychosocial Issues" : "Update Barriers Psychosocial Issues",
        updateBasalRateAdjustment: isHebrew ? "Update Basal Rate Adjustment" : "Update Basal Rate Adjustment",
        updateBasalRateAdjustments: isHebrew ? "Update Basal Rate Adjustments" : "Update Basal Rate Adjustments",
        updateBehavioralAssessment: isHebrew ? "Update Behavioral Assessment" : "Update Behavioral Assessment",
        updateBehavioralHealthGoals: isHebrew ? "Update Behavioral Health Goals" : "Update Behavioral Health Goals",
        updateBiologicTherapy: isHebrew ? "Update Biologic Therapy" : "Update Biologic Therapy",
        updateBiologicTherapyRecord: isHebrew ? "Update Biologic Therapy Record" : "Update Biologic Therapy Record",
        updateBiologicTherapyRecords: isHebrew ? "Update Biologic Therapy Records" : "Update Biologic Therapy Records",
        updateBiopsyReport: isHebrew ? "Update Medical Report" : "Update Medical Report",
        updateBiopsychosocialFormulation: isHebrew ? "Update Biopsychosocial Formulation" : "Update Biopsychosocial Formulation",
        updateBiopsyReports: isHebrew ? "Update Biopsy Reports" : "Update Biopsy Reports",
        updateBirthHistory: isHebrew ? "Update Birth History" : "Update Birth History",
        updateBirthPlan: isHebrew ? "Update Birth Plan" : "Update Birth Plan",
        updateBleedingRiskAssessment: isHebrew ? "Update Bleeding Risk Assessment" : "Update Bleeding Risk Assessment",
        updateBloodDisorderReport: isHebrew ? "Update Blood Disorder" : "Update Blood Disorder",
        updateBloodDisorderReports: isHebrew ? "Update Blood Disorder Reports" : "Update Blood Disorder Reports",
        updateBloodGlucoseLog: isHebrew ? "Track glucose records" : "Track glucose records",
        updateBloodGlucoseLogs: isHebrew ? "Update Blood Glucose Logs" : "Update Blood Glucose Logs",
        updateBloodGlucoseMonitoring: isHebrew ? "Update Blood Glucose Monitoring" : "Update Blood Glucose Monitoring",
        updateBloodPressureReading: isHebrew ? "Update Blood Pressure Reading" : "Update Blood Pressure Reading",
        updateBloodPressureReadings: isHebrew ? "Update Blood Pressure Readings" : "Update Blood Pressure Readings",
        updateBloodProduct: isHebrew ? "Update Blood Product" : "Update Blood Product",
        updateBloodProducts: isHebrew ? "Update Blood Products" : "Update Blood Products",
        updateBloodProductsOrdered: isHebrew ? "Update Blood Products Ordered" : "Update Blood Products Ordered",
        updateBloodSampleCollectionStatu: isHebrew ? "Update Blood Sample Collection Statu" : "Update Blood Sample Collection Statu",
        updateBloodSampleCollectionStatus: isHebrew ? "Update Blood Sample Collection Status" : "Update Blood Sample Collection Status",
        updateBloodSmear: isHebrew ? "Modify blood smear" : "Modify blood smear",
        updateBloodSmears: isHebrew ? "Update Blood Smears" : "Update Blood Smears",
        updateBolusAdjustment: isHebrew ? "Update Bolus Adjustment" : "Update Bolus Adjustment",
        updateBolusAdjustments: isHebrew ? "Update Bolus Adjustments" : "Update Bolus Adjustments",
        updateBoneHealth: isHebrew ? "Update Bone Health" : "Update Bone Health",
        updateBoneMarrowReport: isHebrew ? "Update Bone Marrow" : "Update Bone Marrow",
        updateBoneMarrowReports: isHebrew ? "Update Bone Marrow Reports" : "Update Bone Marrow Reports",
        updateBoneMarrowStudies: isHebrew ? "Update Bone Marrow Studies" : "Update Bone Marrow Studies",
        updateBoneMarrowStudy: isHebrew ? "Modify bone marrow" : "Modify bone marrow",
        updateBoneScanReport: isHebrew ? "Update Bone Scan" : "Update Bone Scan",
        updateBoneScanReports: isHebrew ? "Update Bone Scan Reports" : "Update Bone Scan Reports",
        updateBrainTumorCharacteristic: isHebrew ? "Modify Brain Tumor" : "Modify Brain Tumor",
        updateBrainTumorCharacteristics: isHebrew ? "Update Brain Tumor Characteristics" : "Update Brain Tumor Characteristics",
        updateBrainTumorMolecularMarker: isHebrew ? "Update Brain Tumor Molecular Marker" : "Update Brain Tumor Molecular Marker",
        updateBrainTumorMolecularMarkers: isHebrew ? "Update Brain Tumor Molecular Markers" : "Update Brain Tumor Molecular Markers",
        updateBreastfeedingRecommendation: isHebrew ? "Update Breastfeeding Recommendation" : "Update Breastfeeding Recommendation",
        updateCamIcu: isHebrew ? "Update Cam Icu" : "Update Cam Icu",
        updateCancerDiagnosi: isHebrew ? "Update Cancer Diagnosi" : "Update Cancer Diagnosi",
        updateCancerDiagnosis: isHebrew ? "Update Cancer Diagnosis" : "Update Cancer Diagnosis",
        updateCancerRelatedSideEffect: isHebrew ? "Update Cancer Related Side Effect" : "Update Cancer Related Side Effect",
        updateCancerRelatedSideEffects: isHebrew ? "Update Cancer Related Side Effects" : "Update Cancer Related Side Effects",
        updateCancerScreeningRecords: isHebrew ? "Update Cancer Screening Records" : "Update Cancer Screening Records",
        updateCancerStaging: isHebrew ? "Update Cancer Staging" : "Update Cancer Staging",
        updateCancerSurveillance: isHebrew ? "Update Cancer Surveillance" : "Update Cancer Surveillance",
        updateCarbohydrateCountingEducation: isHebrew ? "Update Carbohydrate Counting Education" : "Update Carbohydrate Counting Education",
        updateCardiacCatheterizationReport: isHebrew ? "Update Cardiac Report" : "Update Cardiac Report",
        updateCardiacCatheterizationReports: isHebrew ? "Update Cardiac Catheterization Reports" : "Update Cardiac Catheterization Reports",
        updateCardiacDeviceInterrogation: isHebrew ? "Update Cardiac Device Interrogation" : "Update Cardiac Device Interrogation",
        updateCardiacDeviceInterrogations: isHebrew ? "Update Cardiac Device Interrogations" : "Update Cardiac Device Interrogations",
        updateCardiacMonitoring: isHebrew ? "Update Cardiac Monitoring Record" : "Update Cardiac Monitoring Record",
        updateCardiacRehabilitationReport: isHebrew ? "Update Cardiac Report" : "Update Cardiac Report",
        updateCardiacRehabilitationReports: isHebrew ? "Update Cardiac Rehabilitation Reports" : "Update Cardiac Rehabilitation Reports",
        updateCardiologyAdmissionNote: isHebrew ? "Update Cardiology Admission" : "Update Cardiology Admission",
        updateCardiologyAdmissionNotes: isHebrew ? "Update Cardiology Admission Notes" : "Update Cardiology Admission Notes",
        updateCardiologyAssessment: isHebrew ? "Update Cardiology Assessment" : "Update Cardiology Assessment",
        updateCardiologyConsultation: isHebrew ? "Update Cardiology Consultation" : "Update Cardiology Consultation",
        updateCardiologyConsultations: isHebrew ? "Update Cardiology Consultations" : "Update Cardiology Consultations",
        updateCardiologyFollowupReport: isHebrew ? "Update Cardiology Report" : "Update Cardiology Report",
        updateCardiologyFollowupReports: isHebrew ? "Update Cardiology Followup Reports" : "Update Cardiology Followup Reports",
        updateCardiovascularRiskReduction: isHebrew ? "Update Cardiovascular Risk Reduction" : "Update Cardiovascular Risk Reduction",
        updateCardiovascularRiskScreening: isHebrew ? "Update Cardiovascular Risk Screening" : "Update Cardiovascular Risk Screening",
        updateCareCoordination: isHebrew ? "Update Care Coordination" : "Update Care Coordination",
        updateCareCoordinationNote: isHebrew ? "Update Care Note" : "Update Care Note",
        updateCareCoordinationNotes: isHebrew ? "Update Care Coordination Notes" : "Update Care Coordination Notes",
        updateCareGap: isHebrew ? "Track patient care" : "Track patient care",
        updateCareGaps: isHebrew ? "Update Care Gaps" : "Update Care Gaps",
        updateCaregiverSupportGroups: isHebrew ? "Update Caregiver Support Groups" : "Update Caregiver Support Groups",
        updateCareTeam: isHebrew ? "Update Care Team" : "Update Care Team",
        updateCareTeamInfo: isHebrew ? "Update Care Team Info" : "Update Care Team Info",
        updateCaregiverAssessment: isHebrew ? "Update Caregiver Assessment" : "Update Caregiver Assessment",
        updateCaregiverSupport: isHebrew ? "Update Caregiver Support" : "Update Caregiver Support",
        updateCaregiverSupportGroup: isHebrew ? "Update Caregiver Support Group" : "Update Caregiver Support Group",
        updateCascadeTestingProtocol: isHebrew ? "Update Cascade Testing Protocol" : "Update Cascade Testing Protocol",
        updateCaseManagement: isHebrew ? "Update Case Management" : "Update Case Management",
        updateCaseSummaries: isHebrew ? "Update Case Summaries" : "Update Case Summaries",
        updateCaseSummary: isHebrew ? "Update Case Details" : "Update Case Details",
        updateCellFreeDnaResult: isHebrew ? "Update Cell Free Dna Result" : "Update Cell Free Dna Result",
        updateCervicalAssessment: isHebrew ? "Update Cervical Assessment" : "Update Cervical Assessment",
        updateCervicalLengthMeasurement: isHebrew ? "Update Cervical Length Measurement" : "Update Cervical Length Measurement",
        updateCesareanThreshold: isHebrew ? "Update Cesarean Threshold" : "Update Cesarean Threshold",
        updateCgmData: isHebrew ? "Update Cgm Data" : "Update Cgm Data",
        updateChallengeTest: isHebrew ? "Update Challenge Test" : "Update Challenge Test",
        updateChallengeTests: isHebrew ? "Update Challenge Tests" : "Update Challenge Tests",
        updateChemotherapyRecord: isHebrew ? "Update Cancer Treatment" : "Update Cancer Treatment",
        updateChemotherapyRecords: isHebrew ? "Update Chemotherapy Records" : "Update Chemotherapy Records",
        updateChemotherapyRegimen: isHebrew ? "Update Chemotherapy Regimen" : "Update Chemotherapy Regimen",
        updateChiefComplaint: isHebrew ? "Update Chief Complaint" : "Update Chief Complaint",
        updateChiefComplaints: isHebrew ? "Update Chief Complaints" : "Update Chief Complaints",
        updateChildrenSpecificRisk: isHebrew ? "Update Children Specific Risk" : "Update Children Specific Risk",
        updateChronicDiseaseGoals: isHebrew ? "Update Chronic Disease Goals" : "Update Chronic Disease Goals",
        updateChronicDiseaseManagement: isHebrew ? "Update Chronic Disease Management" : "Update Chronic Disease Management",
        updateChronicPainAssessment: isHebrew ? "Update Chronic Pain Assessment" : "Update Chronic Pain Assessment",
        updateCkdAssessment: isHebrew ? "Update Ckd Assessment" : "Update Ckd Assessment",
        updateCkdManagement: isHebrew ? "Update Ckd Management" : "Update Ckd Management",
        updateClinicalRiskScores: isHebrew ? "Update Clinical Risk Scores" : "Update Clinical Risk Scores",
        updateClinicalScores: isHebrew ? "Update Clinical Scores" : "Update Clinical Scores",
        updateClinicalTrialDocuments: isHebrew ? "Update Clinical Trial Documents" : "Update Clinical Trial Documents",
        updateClinicalTrials: isHebrew ? "Update Clinical Trials" : "Update Clinical Trials",
        updateClinicSettings: isHebrew ? "עדכן הגדרות" : "Update settings",
        updateClinicalDecisionSupport: isHebrew ? "Enhance medical guidance" : "Enhance medical guidance",
        updateClinicalRiskScore: isHebrew ? "Update Clinical Risk Score" : "Update Clinical Risk Score",
        updateClinicalScore: isHebrew ? "Modify patient assessment" : "Modify patient assessment",
        updateClinicalTrial: isHebrew ? "Update Clinical Trial" : "Update Clinical Trial",
        updateClinicalTrialDocument: isHebrew ? "Update Clinical Trial" : "Update Clinical Trial",
        updateClosureTechnique: isHebrew ? "Update Closure Technique" : "Update Closure Technique",
        updateCmvMonitoringPlan: isHebrew ? "Update Cmv Monitoring Plan" : "Update Cmv Monitoring Plan",
        updateCoagulationStudies: isHebrew ? "Update Coagulation Studies" : "Update Coagulation Studies",
        updateCoagulationStudy: isHebrew ? "Modify Coagulation Test" : "Modify Coagulation Test",
        updateCodeBlueSummaries: isHebrew ? "Update Code Blue Summaries" : "Update Code Blue Summaries",
        updateCodeBlueSummary: isHebrew ? "Update Code Blue Summary" : "Update Code Blue Summary",
        updateCognitiveEvaluation: isHebrew ? "Assess cognitive performance" : "Assess cognitive performance",
        updateCognitiveEvaluations: isHebrew ? "Update Cognitive Evaluations" : "Update Cognitive Evaluations",
        updateCognitiveRehabilitationReport: isHebrew ? "Update Cognitive Rehabilitation" : "Update Cognitive Rehabilitation",
        updateCognitiveRehabilitationReports: isHebrew ? "Update Cognitive Rehabilitation Reports" : "Update Cognitive Rehabilitation Reports",
        updateCognitiveScreening: isHebrew ? "Update Cognitive Screening" : "Update Cognitive Screening",
        updateColonoscopyReport: isHebrew ? "Update Colonoscopy Report" : "Update Colonoscopy Report",
        updateColonoscopyReports: isHebrew ? "Update Colonoscopy Reports" : "Update Colonoscopy Reports",
        updateColorectalColonoscopies: isHebrew ? "Update Colorectal Colonoscopies" : "Update Colorectal Colonoscopies",
        updateColorectalColonoscopy: isHebrew ? "Update Colonoscopy Screening" : "Update Colonoscopy Screening",
        updateColorectalSurgeryAssessment: isHebrew ? "Update Colorectal Surgery Assessment" : "Update Colorectal Surgery Assessment",
        updateColorectalSurgeryConsultation: isHebrew ? "Update Colorectal Consultation" : "Update Colorectal Consultation",
        updateColorectalSurgeryConsultations: isHebrew ? "Update Colorectal Surgery Consultations" : "Update Colorectal Surgery Consultations",
        updateCommunicationPreference: isHebrew ? "Update Communication Preference" : "Update Communication Preference",
        updateCommunicationPreferences: isHebrew ? "Update Communication Preferences" : "Update Communication Preferences",
        updateComplication: isHebrew ? "Update Complication" : "Update Complication",
        updateComplications: isHebrew ? "Update Complications" : "Update Complications",
        updateComponentAllergenTesting: isHebrew ? "Update Component Allergen Testing" : "Update Component Allergen Testing",
        updateComprehensiveCardiomyopathyPanel: isHebrew ? "Update Comprehensive Cardiomyopathy Panel" : "Update Comprehensive Cardiomyopathy Panel",
        updateCompressionTherapy: isHebrew ? "Update Compression Therapy" : "Update Compression Therapy",
        updateConcussionAssessment: isHebrew ? "Update Concussion Assessment" : "Update Concussion Assessment",
        updateConnectiveTissueDiseaseAssessment: isHebrew ? "Update Connective Tissue Disease Assessment" : "Update Connective Tissue Disease Assessment",
        updateConsultationDetail: isHebrew ? "Update Consultation Detail" : "Update Consultation Detail",
        updateConsultationDetails: isHebrew ? "Update Consultation Details" : "Update Consultation Details",
        updateConsultationNote: isHebrew ? "Update Consultation Note" : "Update Consultation Note",
        updateConsultationNotes: isHebrew ? "Update Patient Note" : "Update Patient Note",
        updateConsultationRequests: isHebrew ? "Update Consultation Requests" : "Update Consultation Requests",
        updateConsultationTimeline: isHebrew ? "Update Consultation Timeline" : "Update Consultation Timeline",
        updateContinuousGlucoseMonitor: isHebrew ? "Update Continuous Glucose Monitor" : "Update Continuous Glucose Monitor",
        updateContinuousGlucoseMonitorDiscussion: isHebrew ? "Update Continuous Glucose Monitor Discussion" : "Update Continuous Glucose Monitor Discussion",
        updateContinuousInfusion: isHebrew ? "Update Continuous Infusion" : "Update Continuous Infusion",
        updateContinuousInfusions: isHebrew ? "Update Continuous Infusions" : "Update Continuous Infusions",
        updateContractionMonitoring: isHebrew ? "Update Contraction Monitoring" : "Update Contraction Monitoring",
        updateCopdAssessment: isHebrew ? "Assess COPD status" : "Assess COPD status",
        updateCopdAssessments: isHebrew ? "Update Copd Assessments" : "Update Copd Assessments",
        updateCpapManagement: isHebrew ? "Update Cpap Management" : "Update Cpap Management",
        updateCriticalViewOfSafety: isHebrew ? "Update Critical View Of Safety" : "Update Critical View Of Safety",
        updateCulturalConsideration: isHebrew ? "Update Cultural Consideration" : "Update Cultural Consideration",
        updateCulturalConsiderations: isHebrew ? "Update Cultural Considerations" : "Update Cultural Considerations",
        updateCurrentDialysi: isHebrew ? "Update Current Dialysi" : "Update Current Dialysi",
        updateCurrentDialysis: isHebrew ? "Update Current Dialysis" : "Update Current Dialysis",
        updateCurrentPregnancy: isHebrew ? "Update Current Pregnancy" : "Update Current Pregnancy",
        updateCystoscopyReport: isHebrew ? "Update Cystoscopy Report" : "Update Cystoscopy Report",
        updateCystoscopyReports: isHebrew ? "Update Cystoscopy Reports" : "Update Cystoscopy Reports",
        updateCytogenetic: isHebrew ? "Update Cytogenetic" : "Update Cytogenetic",
        updateCytogenetics: isHebrew ? "Update Cytogenetics" : "Update Cytogenetics",
        updateCytologyReport: isHebrew ? "Update Cytology Report" : "Update Cytology Report",
        updateCytologyReports: isHebrew ? "Update Cytology Reports" : "Update Cytology Reports",
        updatedAt: isHebrew ? "Update d At" : "Update d At",
        updateDataManagementInstruction: isHebrew ? "Update Data Management Instruction" : "Update Data Management Instruction",
        updateDataManagementInstructions: isHebrew ? "Update Data Management Instructions" : "Update Data Management Instructions",
        updateDayProgram: isHebrew ? "Update Day Program" : "Update Day Program",
        updateDayPrograms: isHebrew ? "Update Day Programs" : "Update Day Programs",
        updateDaytimeSleepinessAssessment: isHebrew ? "Update Daytime Sleepiness Assessment" : "Update Daytime Sleepiness Assessment",
        updateDeepBrainStimulation: isHebrew ? "Update Deep Brain Stimulation" : "Update Deep Brain Stimulation",
        updateDeliveryPlanning: isHebrew ? "Update Delivery Planning" : "Update Delivery Planning",
        updateDementiaAssessment: isHebrew ? "Update Dementia Assessment" : "Update Dementia Assessment",
        updateDementiaEducation: isHebrew ? "Update Dementia Education" : "Update Dementia Education",
        updateDentalExaminationReport: isHebrew ? "Update Dental Exam" : "Update Dental Exam",
        updateDentalExaminationReports: isHebrew ? "Update Dental Examination Reports" : "Update Dental Examination Reports",
        updateDepartment: isHebrew ? "Update Department" : "Update Department",
        updateDepressionScreening: isHebrew ? "Update Depression Screening" : "Update Depression Screening",
        updateDermatologyAssessment: isHebrew ? "Update Dermatology Assessment" : "Update Dermatology Assessment",
        updateDermatologyConsultation: isHebrew ? "Update Skin Consultation" : "Update Skin Consultation",
        updateDermatologyConsultations: isHebrew ? "Update Dermatology Consultations" : "Update Dermatology Consultations",
        updateDermatologyProcedureNote: isHebrew ? "Update Skin Procedure" : "Update Skin Procedure",
        updateDermatologyProcedureNotes: isHebrew ? "Update Dermatology Procedure Notes" : "Update Dermatology Procedure Notes",
        updateDetailedFamilyPedigree: isHebrew ? "Update Detailed Family Pedigree" : "Update Detailed Family Pedigree",
        updateDevelopmentalAssessment: isHebrew ? "Modify developmental assessment" : "Modify developmental assessment",
        updateDevelopmentalAssessments: isHebrew ? "Update Developmental Assessments" : "Update Developmental Assessments",
        updateDevelopmentalMilestone: isHebrew ? "Update Developmental Milestone" : "Update Developmental Milestone",
        updateDevelopmentalMilestones: isHebrew ? "Update Developmental Milestones" : "Update Developmental Milestones",
        updateDexaScanReport: isHebrew ? "Update Bone Density" : "Update Bone Density",
        updateDexaScanReports: isHebrew ? "Update Dexa Scan Reports" : "Update Dexa Scan Reports",
        updateDiabetesEducation: isHebrew ? "Update Diabetes Education" : "Update Diabetes Education",
        updateDiabetesEducator: isHebrew ? "Update Diabetes Educator" : "Update Diabetes Educator",
        updateDiabetesEducatorTraining: isHebrew ? "Update Diabetes Educator Training" : "Update Diabetes Educator Training",
        updateDiabetesManagement: isHebrew ? "Update Diabetes Management" : "Update Diabetes Management",
        updateDiabetesManagementNote: isHebrew ? "Update Diabetes Note" : "Update Diabetes Note",
        updateDiabetesManagementNotes: isHebrew ? "Update Diabetes Management Notes" : "Update Diabetes Management Notes",
        updateDiabetesManagementPlan: isHebrew ? "Update Diabetes Management Plan" : "Update Diabetes Management Plan",
        updateDiabetesQualityMetric: isHebrew ? "Update Diabetes Quality Metric" : "Update Diabetes Quality Metric",
        updateDiabetesQualityMetrics: isHebrew ? "Update Diabetes Quality Metrics" : "Update Diabetes Quality Metrics",
        updateDiabetesSupplies: isHebrew ? "Update Diabetes Supplies" : "Update Diabetes Supplies",
        updateDiabetesSupply: isHebrew ? "Update Diabetes Supply" : "Update Diabetes Supply",
        updateDiabeticNephropathy: isHebrew ? "Update Diabetic Nephropathy" : "Update Diabetic Nephropathy",
        updateDiagnos: isHebrew ? "Update Medical Diagnosis" : "Update Medical Diagnosis",
        updateDiagnoses: isHebrew ? "Update Diagnoses" : "Update Diagnoses",
        updateDiagnosis: isHebrew ? "עדכן אבחנה" : "Update diagnosis",
        updateDiagnosticImpression: isHebrew ? "Update Diagnostic Impression" : "Update Diagnostic Impression",
        updateDiagnosticStudies: isHebrew ? "Update Diagnostic Studies" : "Update Diagnostic Studies",
        updateDiagnosticStudy: isHebrew ? "Update Diagnostic Study" : "Update Diagnostic Study",
        updateDialysateComposition: isHebrew ? "Update Dialysate Composition" : "Update Dialysate Composition",
        updateDialysisPlanning: isHebrew ? "Update Dialysis Planning" : "Update Dialysis Planning",
        updateDialysisPrescription: isHebrew ? "Update Dialysis Prescription" : "Update Dialysis Prescription",
        updateDialysisRecord: isHebrew ? "Update Dialysis Record" : "Update Dialysis Record",
        updateDialysisRecords: isHebrew ? "Update Dialysis Records" : "Update Dialysis Records",
        updateDialysisRunSheet: isHebrew ? "Update Dialysis Records" : "Update Dialysis Records",
        updateDialysisRunSheets: isHebrew ? "Update Dialysis Run Sheets" : "Update Dialysis Run Sheets",
        updateDialyzer: isHebrew ? "Update Dialyzer" : "Update Dialyzer",
        updateDietaryIntervention: isHebrew ? "Update Dietary Intervention" : "Update Dietary Intervention",
        updateDietaryInterventions: isHebrew ? "Update Dietary Interventions" : "Update Dietary Interventions",
        updateDisabilityEvaluation: isHebrew ? "Assess disability status" : "Assess disability status",
        updateDisabilityEvaluations: isHebrew ? "Update Disability Evaluations" : "Update Disability Evaluations",
        updateDischargePlanning: isHebrew ? "Update Discharge Planning" : "Update Discharge Planning",
        updateDischargeSummaries: isHebrew ? "Update Patient Discharge" : "Update Patient Discharge",
        updateDischargeSummary: isHebrew ? "Update Discharge Summary" : "Update Discharge Summary",
        updateDiseaseActivityScore: isHebrew ? "Update Disease Activity Score" : "Update Disease Activity Score",
        updateDiseaseActivityScores: isHebrew ? "Update Disease Activity Scores" : "Update Disease Activity Scores",
        updateDiseaseSeverity: isHebrew ? "Update Disease Severity" : "Update Disease Severity",
        updateDnrOrder: isHebrew ? "Update DNR Order" : "Update DNR Order",
        updateDnrOrders: isHebrew ? "Update Dnr Orders" : "Update Dnr Orders",
        updateDoctorsMedicationRecommendation: isHebrew ? "Update Doctors Medication Recommendation" : "Update Doctors Medication Recommendation",
        updateDoctorsMedicationRecommendations: isHebrew ? "Update Doctors Medication Recommendations" : "Update Doctors Medication Recommendations",
        updateDoctorsMedicationsRecommendation: isHebrew ? "Update Doctors Medications Recommendation" : "Update Doctors Medications Recommendation",
        updateDoctorsMedicationsRecommendations: isHebrew ? "Update Doctors Medications Recommendations" : "Update Doctors Medications Recommendations",
        updateDoctorsMedicationsRecommendationsOptimization: isHebrew ? "Update Doctors Medications Recommendations Optimization" : "Update Doctors Medications Recommendations Optimization",
        updateDoctorsMedicationsRecommendationsOptimizations: isHebrew ? "Update Doctors Medications Recommendations Optimizations" : "Update Doctors Medications Recommendations Optimizations",
        updateDocumentMetadata: isHebrew ? "Update Document Metadata" : "Update Document Metadata",
        updateDocumentType: isHebrew ? "Update Document Type" : "Update Document Type",
        updateDownloadGlucometer: isHebrew ? "Update Download Glucometer" : "Update Download Glucometer",
        updateDurableMedicalEquipmentOrders: isHebrew ? "Update Durable Medical Equipment Orders" : "Update Durable Medical Equipment Orders",
        updateDvtProphylaxi: isHebrew ? "Update Dvt Prophylaxi" : "Update Dvt Prophylaxi",
        updateDvtProphylaxis: isHebrew ? "Update Dvt Prophylaxis" : "Update Dvt Prophylaxis",
        updateEarlyChildhoodDevelopment: isHebrew ? "Update Early Childhood Development" : "Update Early Childhood Development",
        updateEarlyMaternityLeave: isHebrew ? "Update Early Maternity Leave" : "Update Early Maternity Leave",
        updateEcgReport: isHebrew ? "Modify ECG report" : "Modify ECG report",
        updateEcgReports: isHebrew ? "Update Ecg Reports" : "Update Ecg Reports",
        updateEchoReport: isHebrew ? "Update Echo Report" : "Update Echo Report",
        updateEchoReports: isHebrew ? "Update Echo Reports" : "Update Echo Reports",
        updateEdCourse: isHebrew ? "Update Ed Course" : "Update Ed Course",
        updateEdDisposition: isHebrew ? "Update Ed Disposition" : "Update Ed Disposition",
        updateEdTriageAssessment: isHebrew ? "Update Ed Triage Assessment" : "Update Ed Triage Assessment",
        updateEducationInitiated: isHebrew ? "Update Education Initiated" : "Update Education Initiated",
        updateEegReport: isHebrew ? "Modify EEG report" : "Modify EEG report",
        updateEegReports: isHebrew ? "Update Eeg Reports" : "Update Eeg Reports",
        updateElderAbuseScreening: isHebrew ? "Update Elder Abuse Screening" : "Update Elder Abuse Screening",
        updateEmergencyAirwayManagement: isHebrew ? "Update Emergency Airway Management" : "Update Emergency Airway Management",
        updateEmergencyAssessment: isHebrew ? "Update Emergency Assessment" : "Update Emergency Assessment",
        updateEmergencyDischargeSummaries: isHebrew ? "Update Emergency Discharge Summaries" : "Update Emergency Discharge Summaries",
        updateEmergencyDischargeSummary: isHebrew ? "Update Emergency Discharge" : "Update Emergency Discharge",
        updateEmergencyDisposition: isHebrew ? "Update Emergency Disposition" : "Update Emergency Disposition",
        updateEmergencyInformation: isHebrew ? "Update Emergency Information" : "Update Emergency Information",
        updateEmergencyObservationUnit: isHebrew ? "Update Emergency Observation Unit" : "Update Emergency Observation Unit",
        updateEmergencyProcedures: isHebrew ? "Update Emergency Procedures" : "Update Emergency Procedures",
        updateEmergencyReport: isHebrew ? "Update Emergency Details" : "Update Emergency Details",
        updateEmergencyReports: isHebrew ? "Update Emergency Reports" : "Update Emergency Reports",
        updateEmgReport: isHebrew ? "Update Emergency Report" : "Update Emergency Report",
        updateEmgReports: isHebrew ? "Update Emg Reports" : "Update Emg Reports",
        updateEmploymentCounseling: isHebrew ? "Update Employment Counseling" : "Update Employment Counseling",
        updateEmsRunReport: isHebrew ? "Update EMS Report" : "Update EMS Report",
        updateEmsRunReports: isHebrew ? "Update Ems Run Reports" : "Update Ems Run Reports",
        updateEndocrineLabResult: isHebrew ? "Update Endocrine Lab Result" : "Update Endocrine Lab Result",
        updateEndocrineLabResults: isHebrew ? "Update Endocrine Lab Results" : "Update Endocrine Lab Results",
        updateEndocrineTherapy: isHebrew ? "Update Endocrine Therapy" : "Update Endocrine Therapy",
        updateEndocrinologyAssessment: isHebrew ? "Update Endocrinology Assessment" : "Update Endocrinology Assessment",
        updateEndocrinologyConsultation: isHebrew ? "Update Endocrinology Consultation" : "Update Endocrinology Consultation",
        updateEndocrinologyConsultations: isHebrew ? "Update Endocrinology Consultations" : "Update Endocrinology Consultations",
        updateEndoscopyFinding: isHebrew ? "Update Endoscopy Finding" : "Update Endoscopy Finding",
        updateEndoscopyFindings: isHebrew ? "Update Endoscopy Findings" : "Update Endoscopy Findings",
        updateEndoscopyReport: isHebrew ? "Update Endoscopy Details" : "Update Endoscopy Details",
        updateEndoscopyReports: isHebrew ? "Update Endoscopy Reports" : "Update Endoscopy Reports",
        updateEntAssessment: isHebrew ? "Update Ent Assessment" : "Update Ent Assessment",
        updateEntConsultation: isHebrew ? "Update Consultation Details" : "Update Consultation Details",
        updateEntConsultations: isHebrew ? "Update Ent Consultations" : "Update Ent Consultations",
        updateEnvironmentalExposure: isHebrew ? "Update Environmental Exposure" : "Update Environmental Exposure",
        updateEnvironmentalExposures: isHebrew ? "Update Environmental Exposures" : "Update Environmental Exposures",
        updateEpilepsyAssessment: isHebrew ? "Update Epilepsy Assessment" : "Update Epilepsy Assessment",
        updateErgonomicAssessment: isHebrew ? "Update Ergonomic Assessment" : "Update Ergonomic Assessment",
        updateEstimatedBloodLoss: isHebrew ? "Update Estimated Blood Loss" : "Update Estimated Blood Loss",
        updateEstimatedDeliveryDate: isHebrew ? "Update Estimated Delivery Date" : "Update Estimated Delivery Date",
        updateEstimatedTimeToDialysi: isHebrew ? "Update Estimated Time To Dialysi" : "Update Estimated Time To Dialysi",
        updateEstimatedTimeToDialysis: isHebrew ? "Update Estimated Time To Dialysis" : "Update Estimated Time To Dialysis",
        updateExcessiveGlucoseMonitoring: isHebrew ? "Update Excessive Glucose Monitoring" : "Update Excessive Glucose Monitoring",
        updateExercisePrescription: isHebrew ? "Update Exercise Prescription" : "Update Exercise Prescription",
        updateExerciseProgram: isHebrew ? "Update Exercise Program" : "Update Exercise Program",
        updateExerciseRecommendation: isHebrew ? "Update Exercise Recommendation" : "Update Exercise Recommendation",
        updateExerciseRecommendations: isHebrew ? "Update Exercise Recommendations" : "Update Exercise Recommendations",
        updateExistingCollections: isHebrew ? "עדכן קולקציות" : "Update collections",
        updateExtendedFamilyHistory: isHebrew ? "Update Extended Family History" : "Update Extended Family History",
        updateExtraintestinalManifestation: isHebrew ? "Update Extraintestinal Manifestation" : "Update Extraintestinal Manifestation",
        updateExtraintestinalManifestations: isHebrew ? "Update Extraintestinal Manifestations" : "Update Extraintestinal Manifestations",
        updateFacility: isHebrew ? "Update Facility" : "Update Facility",
        updateFallPreventionEducation: isHebrew ? "Update Fall Prevention Education" : "Update Fall Prevention Education",
        updateFallRiskAssessment: isHebrew ? "Assess Fall Risk" : "Assess Fall Risk",
        updateFallRiskAssessments: isHebrew ? "Update Fall Risk Assessments" : "Update Fall Risk Assessments",
        updateFallsPreventionProgramAssessment: isHebrew ? "Update Falls Prevention Program Assessment" : "Update Falls Prevention Program Assessment",
        updateFamilyHistory: isHebrew ? "Update Family History" : "Update Family History",
        updateFamilyMedicineAssessment: isHebrew ? "Update Family Medicine Assessment" : "Update Family Medicine Assessment",
        updateFamilyMeetingDecision: isHebrew ? "Update Family Meeting Decision" : "Update Family Meeting Decision",
        updateFamilyMeetingDecisions: isHebrew ? "Update Family Meeting Decisions" : "Update Family Meeting Decisions",
        updateFamilyMeetingNote: isHebrew ? "Update Family Meeting Note" : "Update Family Meeting Note",
        updateFamilyMeetingNotes: isHebrew ? "Update Family Meeting Notes" : "Update Family Meeting Notes",
        updateFecalCalprotectin: isHebrew ? "Update Fecal Calprotectin" : "Update Fecal Calprotectin",
        updateFertilityTracking: isHebrew ? "Update Fertility Tracking" : "Update Fertility Tracking",
        updateFetalAssessment: isHebrew ? "Update Fetal Assessment" : "Update Fetal Assessment",
        updateFetalEcho: isHebrew ? "Update Fetal Echo" : "Update Fetal Echo",
        updateFetalEchoResult: isHebrew ? "Update Fetal Echo Result" : "Update Fetal Echo Result",
        updateFetalEchoResults: isHebrew ? "Update Fetal Echo Results" : "Update Fetal Echo Results",
        updateFetalSurveillance: isHebrew ? "Update Fetal Surveillance" : "Update Fetal Surveillance",
        updateFetalUltrasound: isHebrew ? "Update Fetal Ultrasound" : "Update Fetal Ultrasound",
        updateFirstTrimesterBleeding: isHebrew ? "Update First Trimester Bleeding" : "Update First Trimester Bleeding",
        updateFirstTrimesterScreenResult: isHebrew ? "Update First Trimester Screen Result" : "Update First Trimester Screen Result",
        updateFitnessForDutyEvaluation: isHebrew ? "Assess personnel readiness" : "Assess personnel readiness",
        updateFitnessForDutyEvaluations: isHebrew ? "Update Fitness For Duty Evaluations" : "Update Fitness For Duty Evaluations",
        updateFlareManagement: isHebrew ? "Update Flare Management" : "Update Flare Management",
        updateFlowCytometryReport: isHebrew ? "Update Flow Cytometry" : "Update Flow Cytometry",
        updateFlowCytometryReports: isHebrew ? "Update Flow Cytometry Reports" : "Update Flow Cytometry Reports",
        updateFluidElectrolyteManagement: isHebrew ? "Update Fluid Electrolyte Management" : "Update Fluid Electrolyte Management",
        updateFluidIntake: isHebrew ? "Update Fluid Intake" : "Update Fluid Intake",
        updateFluidOutput: isHebrew ? "Update Fluid Output" : "Update Fluid Output",
        updateFmlaDocumentationNote: isHebrew ? "Update Fmla Documentation Note" : "Update Fmla Documentation Note",
        updateFollowUp: isHebrew ? "Update Follow Up" : "Update Follow Up",
        updateFollowUpAppointment: isHebrew ? "Schedule follow-up appointment" : "Schedule follow-up appointment",
        updateFollowUpAppointments: isHebrew ? "Update Follow Up Appointments" : "Update Follow Up Appointments",
        updateFollowUpEnhanced: isHebrew ? "Update Follow Up Enhanced" : "Update Follow Up Enhanced",
        updateFollowUpIntelligence: isHebrew ? "Enhance follow-up intelligence" : "Enhance follow-up intelligence",
        updateFollowUpPlan: isHebrew ? "Update Follow Up Plan" : "Update Follow Up Plan",
        updateFollowUps: isHebrew ? "Update Follow Ups" : "Update Follow Ups",
        updateFoodInsecurity: isHebrew ? "Update Food Insecurity" : "Update Food Insecurity",
        updateFootExam: isHebrew ? "Update Foot Exam" : "Update Foot Exam",
        updateFrailtyAssessment: isHebrew ? "Update Frailty Assessment" : "Update Frailty Assessment",
        updateFullMedicalReport: isHebrew ? "עדכן דוח מלא" : "Update full report",
        updateFunctionalAssessment: isHebrew ? "Update Functional Assessment" : "Update Functional Assessment",
        updateFunctionalAssessments: isHebrew ? "Update Functional Assessments" : "Update Functional Assessments",
        updateFunctionalMriStudies: isHebrew ? "Update Functional Mri Studies" : "Update Functional Mri Studies",
        updateFunctionalMriStudy: isHebrew ? "Update Brain Scan" : "Update Brain Scan",
        updateFunctionalStatu: isHebrew ? "Update Functional Statu" : "Update Functional Statu",
        updateFunctionalStatus: isHebrew ? "Update Functional Status" : "Update Functional Status",
        updateGaitAnalysi: isHebrew ? "Update Gait Analysi" : "Update Gait Analysi",
        updateGaitAnalysis: isHebrew ? "Update Gait Analysis" : "Update Gait Analysis",
        updateGastroenterologyConsultation: isHebrew ? "Update Gastroenterology Consultation" : "Update Gastroenterology Consultation",
        updateGastroenterologyConsultations: isHebrew ? "Update Gastroenterology Consultations" : "Update Gastroenterology Consultations",
        updateGdmRecurrenceRisk: isHebrew ? "Update Gdm Recurrence Risk" : "Update Gdm Recurrence Risk",
        updateGeneticOncology: isHebrew ? "Update Genetic Oncology" : "Update Genetic Oncology",
        updateGeneticTestingReport: isHebrew ? "Modify genetic test report" : "Modify genetic test report",
        updateGeneticsPsychosocialAssessment: isHebrew ? "Update Genetics Psychosocial Assessment" : "Update Genetics Psychosocial Assessment",
        updateGeneticTestingReports: isHebrew ? "Update Genetic Testing Reports" : "Update Genetic Testing Reports",
        updateGeriatricAssessment: isHebrew ? "Modify Elderly Evaluation" : "Modify Elderly Evaluation",
        updateGeriatricAssessments: isHebrew ? "Update Geriatric Assessments" : "Update Geriatric Assessments",
        updateGeriatricCognitiveAssessment: isHebrew ? "Update Geriatric Cognitive Assessment" : "Update Geriatric Cognitive Assessment",
        updateGeriatricMedication: isHebrew ? "Update Geriatric Medication" : "Update Geriatric Medication",
        updateGeriatricMedications: isHebrew ? "Update Geriatric Medications" : "Update Geriatric Medications",
        updateGeriatricNutritionalAssessment: isHebrew ? "Update Geriatric Nutritional Assessment" : "Update Geriatric Nutritional Assessment",
        updateGestationalDiabete: isHebrew ? "Update Gestational Diabete" : "Update Gestational Diabete",
        updateGestationalDiabetes: isHebrew ? "Update Gestational Diabetes" : "Update Gestational Diabetes",
        updateGiRiskAssessment: isHebrew ? "Assess GI Risk" : "Assess GI Risk",
        updateGlasgowComaScale: isHebrew ? "Update Glasgow Coma Scale" : "Update Glasgow Coma Scale",
        updateGlaucomaAssessment: isHebrew ? "Assess Glaucoma Status" : "Assess Glaucoma Status",
        updateGlaucomaAssessments: isHebrew ? "Update Glaucoma Assessments" : "Update Glaucoma Assessments",
        updateGlaucomaManagement: isHebrew ? "Update Glaucoma Management" : "Update Glaucoma Management",
        updateGlomerularDisease: isHebrew ? "Update Glomerular Disease" : "Update Glomerular Disease",
        updateGlucometerDownloadSchedule: isHebrew ? "Update Glucometer Download Schedule" : "Update Glucometer Download Schedule",
        updateGlucoseMonitoringFrequency: isHebrew ? "Update Glucose Monitoring Frequency" : "Update Glucose Monitoring Frequency",
        updateGlucoseMonitoringGoal: isHebrew ? "Update Glucose Monitoring Goal" : "Update Glucose Monitoring Goal",
        updateGlucoseMonitoringGoals: isHebrew ? "Update Glucose Monitoring Goals" : "Update Glucose Monitoring Goals",
        updateGlucoseTestingWeek: isHebrew ? "Update Glucose Testing Week" : "Update Glucose Testing Week",
        updateGlucoseTestingWeeks: isHebrew ? "Update Glucose Testing Weeks" : "Update Glucose Testing Weeks",
        updateGoalsOfCareDiscussion: isHebrew ? "Update Goals Of Care Discussion" : "Update Goals Of Care Discussion",
        updateGoutAssessment: isHebrew ? "Update Gout Assessment" : "Update Gout Assessment",
        updateGrowthParameter: isHebrew ? "Update Growth Parameter" : "Update Growth Parameter",
        updateGrowthParameters: isHebrew ? "Update Growth Parameters" : "Update Growth Parameters",
        updateGrowthUltrasoundSchedule: isHebrew ? "Update Growth Ultrasound Schedule" : "Update Growth Ultrasound Schedule",
        updateGuidelineCompliance: isHebrew ? "Check guideline adherence" : "Check guideline adherence",
        updateGynecologyConsultation: isHebrew ? "Update Gynecology Consultation" : "Update Gynecology Consultation",
        updateGynecologyConsultations: isHebrew ? "Update Gynecology Consultations" : "Update Gynecology Consultations",
        updateHeadacheAssessment: isHebrew ? "Update Headache Assessment" : "Update Headache Assessment",
        updateHeader: isHebrew ? "Update Header" : "Update Header",
        updateHeaders: isHebrew ? "Update Headers" : "Update Headers",
        updateHealthCoachingNotes: isHebrew ? "Update Health Coaching Notes" : "Update Health Coaching Notes",
        updateHealthMaintenance: isHebrew ? "עדכן תחזוקת בריאות" : "Update health maintenance record",
        updateHeightMeasurement: isHebrew ? "Update Height Measurement" : "Update Height Measurement",
        updateHeightMeasurements: isHebrew ? "Update Height Measurements" : "Update Height Measurements",
        updateHematologyAssessment: isHebrew ? "Update Hematology Assessment" : "Update Hematology Assessment",
        updateHematologyConsultation: isHebrew ? "Update Hematology Consultation" : "Update Hematology Consultation",
        updateHematologyConsultations: isHebrew ? "Update Hematology Consultations" : "Update Hematology Consultations",
        updateHepatitisCHistory: isHebrew ? "Update Hepatitis C History" : "Update Hepatitis C History",
        updateHepatitisCManagement: isHebrew ? "Update Hepatitis C Management" : "Update Hepatitis C Management",
        updateHistoryPresentIllness: isHebrew ? "Update Patient History" : "Update Patient History",
        updateHivHistory: isHebrew ? "Update Hiv History" : "Update Hiv History",
        updateHomeHealthNote: isHebrew ? "Update Health Record" : "Update Health Record",
        updateHomeHealthNotes: isHebrew ? "Update Home Health Notes" : "Update Home Health Notes",
        updateHomeHealthOrders: isHebrew ? "Update Home Health Orders" : "Update Home Health Orders",
        updateHomeMonitoring: isHebrew ? "Update Home Monitoring" : "Update Home Monitoring",
        updateHomeSafety: isHebrew ? "Update Home Safety" : "Update Home Safety",
        updateHomicideRiskAssessment: isHebrew ? "Update Homicide Risk Assessment" : "Update Homicide Risk Assessment",
        updateHormonePanel: isHebrew ? "Update Hormone Data" : "Update Hormone Data",
        updateHormonePanels: isHebrew ? "Update Hormone Panels" : "Update Hormone Panels",
        updateHormoneTherapyRecord: isHebrew ? "Update Hormone Therapy" : "Update Hormone Therapy",
        updateHormoneTherapyRecords: isHebrew ? "Update Hormone Therapy Records" : "Update Hormone Therapy Records",
        updateHospiceNote: isHebrew ? "Update Hospice Note" : "Update Hospice Note",
        updateHospiceNotes: isHebrew ? "Update Hospice Notes" : "Update Hospice Notes",
        updateHospitalAdmissionNote: isHebrew ? "Update Hospital Admission" : "Update Hospital Admission",
        updateHospitalAdmissionNotes: isHebrew ? "Update Hospital Admission Notes" : "Update Hospital Admission Notes",
        updateHospitalCourse: isHebrew ? "Update Hospital Course" : "Update Hospital Course",
        updateHospitalDischargeSummaries: isHebrew ? "Update Hospital Discharge Summaries" : "Update Hospital Discharge Summaries",
        updateHospitalDischargeSummary: isHebrew ? "Update Patient Discharge" : "Update Patient Discharge",
        updateHospitalTransferNote: isHebrew ? "Update Hospital Transfer" : "Update Hospital Transfer",
        updateHospitalTransferNotes: isHebrew ? "Update Hospital Transfer Notes" : "Update Hospital Transfer Notes",
        updateHourlyVitalSign: isHebrew ? "Update Hourly Vital Sign" : "Update Hourly Vital Sign",
        updateHourlyVitalSigns: isHebrew ? "Update Hourly Vital Signs" : "Update Hourly Vital Signs",
        updateHydrationManagement: isHebrew ? "Update Hydration Management" : "Update Hydration Management",
        updateHypertensiveNephropathy: isHebrew ? "Update Hypertensive Nephropathy" : "Update Hypertensive Nephropathy",
        updateHypoglycemiaManagement: isHebrew ? "Update Hypoglycemia Management" : "Update Hypoglycemia Management",
        updateHypoglycemiaProtocol: isHebrew ? "Update Hypoglycemia Protocol" : "Update Hypoglycemia Protocol",
        updateIbdAssessment: isHebrew ? "Update Ibd Assessment" : "Update Ibd Assessment",
        updateIbdBiomarker: isHebrew ? "Update Ibd Biomarker" : "Update Ibd Biomarker",
        updateIbdBiomarkers: isHebrew ? "Update Ibd Biomarkers" : "Update Ibd Biomarkers",
        updateIbdConsultationDetail: isHebrew ? "Update Ibd Consultation Detail" : "Update Ibd Consultation Detail",
        updateIbdConsultationDetails: isHebrew ? "Update Ibd Consultation Details" : "Update Ibd Consultation Details",
        updateIbdSurgicalPlanning: isHebrew ? "Update Ibd Surgical Planning" : "Update Ibd Surgical Planning",
        updateIcuFlowSheet: isHebrew ? "Update ICU chart" : "Update ICU chart",
        updateIcuFlowSheets: isHebrew ? "Update Icu Flow Sheets" : "Update Icu Flow Sheets",
        updateImagingOrder: isHebrew ? "Update Imaging Request" : "Update Imaging Request",
        updateImagingOrders: isHebrew ? "Update Imaging Orders" : "Update Imaging Orders",
        updateImagingReport: isHebrew ? "Update Imaging Report" : "Update Imaging Report",
        updateImagingReports: isHebrew ? "Modify imaging report" : "Modify imaging report",
        updateImmediateIntervention: isHebrew ? "Update Immediate Intervention" : "Update Immediate Intervention",
        updateImmediateInterventions: isHebrew ? "Update Immediate Interventions" : "Update Immediate Interventions",
        updateImmediateRecommendation: isHebrew ? "Update Immediate Recommendation" : "Update Immediate Recommendation",
        updateImmediateRecommendations: isHebrew ? "Update Immediate Recommendations" : "Update Immediate Recommendations",
        updateImmuneFunctionTest: isHebrew ? "Update Immune Function Test" : "Update Immune Function Test",
        updateImmuneFunctionTests: isHebrew ? "Update Immune Function Tests" : "Update Immune Function Tests",
        updateImmuneReconstitutionPlanning: isHebrew ? "Update Immune Reconstitution Planning" : "Update Immune Reconstitution Planning",
        updateImmunizationRecord: isHebrew ? "Update Immunization Record" : "Update Immunization Record",
        updateImmunizationSchedule: isHebrew ? "Update Immunization Schedule" : "Update Immunization Schedule",
        updateImmunizationStatu: isHebrew ? "Update Immunization Statu" : "Update Immunization Statu",
        updateImmunizationStatus: isHebrew ? "Update Immunization Status" : "Update Immunization Status",
        updateIndianDietExchangeList: isHebrew ? "Update Indian Diet Exchange List" : "Update Indian Diet Exchange List",
        updateIndianDietExchangeLists: isHebrew ? "Update Indian Diet Exchange Lists" : "Update Indian Diet Exchange Lists",
        updateInfectionControlRecords: isHebrew ? "Update Infection Control Records" : "Update Infection Control Records",
        updateInfectionRiskMonitoring: isHebrew ? "Update Infection Risk Monitoring" : "Update Infection Risk Monitoring",
        updateInfectionSurveillance: isHebrew ? "Update Infection Surveillance" : "Update Infection Surveillance",
        updateInfectiousDiseaseAssessment: isHebrew ? "Update Infectious Disease Assessment" : "Update Infectious Disease Assessment",
        updateInflammatoryBowelReport: isHebrew ? "Modify Bowel Report" : "Modify Bowel Report",
        updateInflammatoryBowelReports: isHebrew ? "Update Inflammatory Bowel Reports" : "Update Inflammatory Bowel Reports",
        updateInflammatoryMarker: isHebrew ? "Update Inflammatory Marker" : "Update Inflammatory Marker",
        updateInflammatoryMarkers: isHebrew ? "Update Inflammatory Markers" : "Update Inflammatory Markers",
        updateInfliximabDrugMonitoring: isHebrew ? "Update Infliximab Drug Monitoring" : "Update Infliximab Drug Monitoring",
        updateInfusionTherapy: isHebrew ? "Update Infusion Therapy" : "Update Infusion Therapy",
        updateInheritancePatternDetail: isHebrew ? "Update Inheritance Pattern Detail" : "Update Inheritance Pattern Detail",
        updateInheritancePatternDetails: isHebrew ? "Update Inheritance Pattern Details" : "Update Inheritance Pattern Details",
        updateInjuryDetail: isHebrew ? "Update Injury Detail" : "Update Injury Detail",
        updateInjuryDetails: isHebrew ? "Update Injury Details" : "Update Injury Details",
        updateInsomniaAssessment: isHebrew ? "Update Insomnia Assessment" : "Update Insomnia Assessment",
        updateInsulinAdjustmentProtocol: isHebrew ? "Update Insulin Adjustment Protocol" : "Update Insulin Adjustment Protocol",
        updateInsulinPumpSetting: isHebrew ? "Update Insulin Pump Setting" : "Update Insulin Pump Setting",
        updateInsulinPumpSettings: isHebrew ? "Update Insulin Pump Settings" : "Update Insulin Pump Settings",
        updateInsulinRegimen: isHebrew ? "Update Insulin Regimen" : "Update Insulin Regimen",
        updateInsulinStorageInstruction: isHebrew ? "Update Insulin Storage Instruction" : "Update Insulin Storage Instruction",
        updateInsulinStorageInstructions: isHebrew ? "Update Insulin Storage Instructions" : "Update Insulin Storage Instructions",
        updateInsulinTimingInstruction: isHebrew ? "Update Insulin Timing Instruction" : "Update Insulin Timing Instruction",
        updateInsulinTimingInstructions: isHebrew ? "Update Insulin Timing Instructions" : "Update Insulin Timing Instructions",
        updateInsuranceAuthorization: isHebrew ? "עדכן אישור ביטוח" : "Update insurance authorization",
        updateInsuranceAuthorizations: isHebrew ? "Update Insurance Authorizations" : "Update Insurance Authorizations",
        updateInsuranceForm: isHebrew ? "Modify insurance details" : "Modify insurance details",
        updateInsuranceForms: isHebrew ? "Update Insurance Forms" : "Update Insurance Forms",
        updateIntakeOutputRecord: isHebrew ? "Track patient fluids" : "Track patient fluids",
        updateIntakeOutputRecords: isHebrew ? "Update Intake Output Records" : "Update Intake Output Records",
        updateIntegrativeOncology: isHebrew ? "Update Integrative Oncology" : "Update Integrative Oncology",
        updateIntelligentRecommendation: isHebrew ? "Refresh personalized suggestions" : "Refresh personalized suggestions",
        updateIntelligentRecommendations: isHebrew ? "Update Intelligent Recommendations" : "Update Intelligent Recommendations",
        updateInterPregnancyWeightManagement: isHebrew ? "Update Inter Pregnancy Weight Management" : "Update Inter Pregnancy Weight Management",
        updateIntervalHistory: isHebrew ? "Update Interval History" : "Update Interval History",
        updateInterventionalPainProcedures: isHebrew ? "Update Interventional Pain Procedures" : "Update Interventional Pain Procedures",
        updateInterventionalRadiologyNote: isHebrew ? "Update IR Note" : "Update IR Note",
        updateInterventionalRadiologyNotes: isHebrew ? "Update Interventional Radiology Notes" : "Update Interventional Radiology Notes",
        updateIntradialyticMonitoring: isHebrew ? "Update Intradialytic Monitoring" : "Update Intradialytic Monitoring",
        updateIntraoperativeCholangiography: isHebrew ? "Update Intraoperative Cholangiography" : "Update Intraoperative Cholangiography",
        updateIntraoperativeFinding: isHebrew ? "Update Intraoperative Finding" : "Update Intraoperative Finding",
        updateIntraoperativeFindings: isHebrew ? "Update Intraoperative Findings" : "Update Intraoperative Findings",
        updateIntraoperativeImaging: isHebrew ? "Update Intraoperative Imaging" : "Update Intraoperative Imaging",
        updateIntraoperativeMonitoring: isHebrew ? "Update Intraoperative Monitoring" : "Update Intraoperative Monitoring",
        updateIsolationPrecautions: isHebrew ? "Update Isolation Precautions" : "Update Isolation Precautions",
        updateIvInfusion: isHebrew ? "Update Iv Infusion" : "Update Iv Infusion",
        updateIvInfusions: isHebrew ? "Update Iv Infusions" : "Update Iv Infusions",
        updateJobHazardAnalysis: isHebrew ? "Update Job Hazard Analysis" : "Update Job Hazard Analysis",
        updateKetoneMonitoringInstruction: isHebrew ? "Update Ketone Monitoring Instruction" : "Update Ketone Monitoring Instruction",
        updateKetoneMonitoringInstructions: isHebrew ? "Update Ketone Monitoring Instructions" : "Update Ketone Monitoring Instructions",
        updateKidneyDiseaseProgressionTimeline: isHebrew ? "Update Kidney Disease Progression Timeline" : "Update Kidney Disease Progression Timeline",
        updateKidneyFunctionReport: isHebrew ? "Modify kidney report" : "Modify kidney report",
        updateKidneyFunctionReports: isHebrew ? "Update Kidney Function Reports" : "Update Kidney Function Reports",
        updateLaborDeliveryRecords: isHebrew ? "Update Labor Delivery Records" : "Update Labor Delivery Records",
        updateLabOrder: isHebrew ? "Update Lab Order" : "Update Lab Order",
        updateLabOrders: isHebrew ? "Update Lab Orders" : "Update Lab Orders",
        updateLabResult: isHebrew ? "Update Lab Result" : "Update Lab Result",
        updateLabResults: isHebrew ? "Update Lab Result" : "Update Lab Result",
        updateLabSchedule: isHebrew ? "Update Lab Schedule" : "Update Lab Schedule",
        updateLaborDeliveryRecord: isHebrew ? "Update Labor Record" : "Update Labor Record",
        updateLaboratoryResult: isHebrew ? "Update Laboratory Result" : "Update Laboratory Result",
        updateLaryngoscopyReport: isHebrew ? "Update Laryngoscopy Details" : "Update Laryngoscopy Details",
        updateLaryngoscopyReports: isHebrew ? "Update Laryngoscopy Reports" : "Update Laryngoscopy Reports",
        updateLifestyleAssessment: isHebrew ? "Update Lifestyle Assessment" : "Update Lifestyle Assessment",
        updateLifestyleAssessments: isHebrew ? "Update Lifestyle Assessments" : "Update Lifestyle Assessments",
        updateLifestyleCounseling: isHebrew ? "Update Lifestyle Counseling" : "Update Lifestyle Counseling",
        updateLifestyleRiskAssessment: isHebrew ? "Update Lifestyle Risk Assessment" : "Update Lifestyle Risk Assessment",
        updateLigamentReconstruction: isHebrew ? "Update Ligament Reconstruction" : "Update Ligament Reconstruction",
        updateLiverFunctionAssessment: isHebrew ? "Assess liver health" : "Assess liver health",
        updateLiverFunctionAssessments: isHebrew ? "Update Liver Function Assessments" : "Update Liver Function Assessments",
        updateLupusAssessment: isHebrew ? "Update Lupus Assessment" : "Update Lupus Assessment",
        updateLymphNodeCytomorphology: isHebrew ? "Update Lymph Node Cytomorphology" : "Update Lymph Node Cytomorphology",
        updateMacrosomiaThreshold: isHebrew ? "Update Macrosomia Threshold" : "Update Macrosomia Threshold",
        updateMalnutritionRiskAssessment: isHebrew ? "Update Malnutrition Risk Assessment" : "Update Malnutrition Risk Assessment",
        updateMammographyReport: isHebrew ? "Modify mammography report" : "Modify mammography report",
        updateMammographyReports: isHebrew ? "Update Mammography Reports" : "Update Mammography Reports",
        updateMaternalFetalReport: isHebrew ? "Update Maternal-Fetal Status" : "Update Maternal-Fetal Status",
        updateMaternalFetalReports: isHebrew ? "Update Maternal Fetal Reports" : "Update Maternal Fetal Reports",
        updateMaternalLab: isHebrew ? "Update Maternal Lab" : "Update Maternal Lab",
        updateMaternalLabs: isHebrew ? "Update Maternal Labs" : "Update Maternal Labs",
        updateMaternalWeightMonitoring: isHebrew ? "Update Maternal Weight Monitoring" : "Update Maternal Weight Monitoring",
        updateMayoScore: isHebrew ? "Update Mayo Score" : "Update Mayo Score",
        updateMechanismOfInjury: isHebrew ? "Update Mechanism Of Injury" : "Update Mechanism Of Injury",
        updateMedicalAlert: isHebrew ? "Update Medical Alert" : "Update Medical Alert",
        updateMedicalAlerts: isHebrew ? "Update Medical Alerts" : "Update Medical Alerts",
        updateMedicalCertificate: isHebrew ? "Modify medical certificate" : "Modify medical certificate",
        updateMedicalCertificates: isHebrew ? "Update Medical Certificates" : "Update Medical Certificates",
        updateMedicalGeneticist: isHebrew ? "Update Medical Geneticist" : "Update Medical Geneticist",
        updateMedicalHistory: isHebrew ? "עדכן היסטוריה רפואית" : "Update medical history",
        updateMedicalPowerOfAttorney: isHebrew ? "Update Medical Authorization" : "Update Medical Authorization",
        updateMedicalProcedure: isHebrew ? "Update Medical Record" : "Update Medical Record",
        updateMedicalProcedures: isHebrew ? "Update Medical Procedures" : "Update Medical Procedures",
        updateMedicalReconciliationForm: isHebrew ? "Update Medical Records" : "Update Medical Records",
        updateMedicalReconciliationForms: isHebrew ? "Update Medical Reconciliation Forms" : "Update Medical Reconciliation Forms",
        updateMedication: isHebrew ? "Modify medication details" : "Modify medication details",
        updateMedicationAccessProgram: isHebrew ? "Update Medication Access Program" : "Update Medication Access Program",
        updateMedicationAccessPrograms: isHebrew ? "Update Medication Access Programs" : "Update Medication Access Programs",
        updateMedicationAdministrationRecord: isHebrew ? "Update Medication Record" : "Update Medication Record",
        updateMedicationAdministrationRecords: isHebrew ? "Update Medication Administration Records" : "Update Medication Administration Records",
        updateMedicationChangesDiscontinued: isHebrew ? "Update Medication Changes Discontinued" : "Update Medication Changes Discontinued",
        updateMedicationChangesDose: isHebrew ? "Update Medication Changes Dose" : "Update Medication Changes Dose",
        updateMedicationChangesNew: isHebrew ? "Update Medication Changes New" : "Update Medication Changes New",
        updateMedicationDeprescribing: isHebrew ? "Update Medication Deprescribing" : "Update Medication Deprescribing",
        updateMedicationOptimization: isHebrew ? "Optimize medication management" : "Optimize medication management",
        updateMedicationRecommendation: isHebrew ? "Update Medication Recommendation" : "Update Medication Recommendation",
        updateMedicationRecommendations: isHebrew ? "Update medication recommendation" : "Update medication recommendation",
        updateMedicationReconciliation: isHebrew ? "Update Medication Reconciliation" : "Update Medication Reconciliation",
        updateMedicationRenalDosing: isHebrew ? "Update Medication Renal Dosing" : "Update Medication Renal Dosing",
        updateMedications: isHebrew ? "Update Medications" : "Update Medications",
        updateMedicationSafety: isHebrew ? "Update medication safety record" : "Update medication safety record",
        updateMedicationSafetyAlert: isHebrew ? "Update Medication Safety Alert" : "Update Medication Safety Alert",
        updateMedicationsAdministered: isHebrew ? "Update Medications Administered" : "Update Medications Administered",
        updateMedicationSafetyAlerts: isHebrew ? "Update Medication Safety Alerts" : "Update Medication Safety Alerts",
        updateMeniscusRepair: isHebrew ? "Update Meniscus Repair" : "Update Meniscus Repair",
        updateMentalHealthAssessment: isHebrew ? "Modify mental health evaluation" : "Modify mental health evaluation",
        updateMentalHealthAssessments: isHebrew ? "Update Mental Health Assessments" : "Update Mental Health Assessments",
        updateMentalHealthResource: isHebrew ? "Update Mental Health Resource" : "Update Mental Health Resource",
        updateMentalHealthResources: isHebrew ? "Update Mental Health Resources" : "Update Mental Health Resources",
        updateMentalStatusExam: isHebrew ? "Assess patient cognition" : "Assess patient cognition",
        updateMentalStatusExams: isHebrew ? "Update Mental Status Exams" : "Update Mental Status Exams",
        updateMicrobiologyCultureReport: isHebrew ? "Update Culture Results" : "Update Culture Results",
        updateMicrobiologyCultureReports: isHebrew ? "Update Microbiology Culture Reports" : "Update Microbiology Culture Reports",
        updateMineralBoneDisease: isHebrew ? "Update Mineral Bone Disease" : "Update Mineral Bone Disease",
        updateMonitoringPlan: isHebrew ? "Update Monitoring Plan" : "Update Monitoring Plan",
        updateMonitoringPlans: isHebrew ? "Update Monitoring Plans" : "Update Monitoring Plans",
        updateMonitoringReport: isHebrew ? "Update Monitoring Report" : "Update Monitoring Report",
        updateMonitoringReports: isHebrew ? "Update Monitoring Reports" : "Update Monitoring Reports",
        updateMoodPsychologicalAssessment: isHebrew ? "Update Mood Psychological Assessment" : "Update Mood Psychological Assessment",
        updateMortalityRiskAssessment: isHebrew ? "Update Mortality Risk Assessment" : "Update Mortality Risk Assessment",
        updateMotorComplication: isHebrew ? "Update Motor Complication" : "Update Motor Complication",
        updateMotorComplications: isHebrew ? "Update Motor Complications" : "Update Motor Complications",
        updateMovementDisorderAssessment: isHebrew ? "Update Movement Disorder Assessment" : "Update Movement Disorder Assessment",
        updateMriReport: isHebrew ? "Modify MRI report" : "Modify MRI report",
        updateMriReports: isHebrew ? "Update Mri Reports" : "Update Mri Reports",
        updateMultimodalPainTherapy: isHebrew ? "Update Multimodal Pain Therapy" : "Update Multimodal Pain Therapy",
        updateMultipleSclerosisAssessment: isHebrew ? "Update Multiple Sclerosis Assessment" : "Update Multiple Sclerosis Assessment",
        updateMyelomaSpecificData: isHebrew ? "Update Myeloma Specific Data" : "Update Myeloma Specific Data",
        updateMyositisAssessment: isHebrew ? "Update Myositis Assessment" : "Update Myositis Assessment",
        updateNarcolepsyAssessment: isHebrew ? "Update Narcolepsy Assessment" : "Update Narcolepsy Assessment",
        updateNephrologyConsultation: isHebrew ? "Request nephrology review" : "Request nephrology review",
        updateNephrologyConsultationDetail: isHebrew ? "Update Nephrology Consultation Detail" : "Update Nephrology Consultation Detail",
        updateNephrologyConsultationDetails: isHebrew ? "Update Nephrology Consultation Details" : "Update Nephrology Consultation Details",
        updateNephrologyConsultations: isHebrew ? "Update Nephrology Consultations" : "Update Nephrology Consultations",
        updateNeuroImaging: isHebrew ? "Update Neuro Imaging" : "Update Neuro Imaging",
        updateNeurologicalAssessment: isHebrew ? "Update Neurological Assessment" : "Update Neurological Assessment",
        updateNeurologicalExam: isHebrew ? "Update Neurological Exam" : "Update Neurological Exam",
        updateNeurologicalExamination: isHebrew ? "Update Neurological Examination" : "Update Neurological Examination",
        updateNeurologicalFinding: isHebrew ? "Update Neurological Finding" : "Update Neurological Finding",
        updateNeurologicalFindings: isHebrew ? "Update Neurological Findings" : "Update Neurological Findings",
        updateNeurologyConsultation: isHebrew ? "Update Neurology Consultation" : "Update Neurology Consultation",
        updateNeurologyConsultations: isHebrew ? "Update Neurology Consultations" : "Update Neurology Consultations",
        updateNeurologyProgressNote: isHebrew ? "Update Neurology Note" : "Update Neurology Note",
        updateNeurologyProgressNotes: isHebrew ? "Update Neurology Progress Notes" : "Update Neurology Progress Notes",
        updateNeuromuscularDisorder: isHebrew ? "Update Neuromuscular Disorder" : "Update Neuromuscular Disorder",
        updateNeuropsychologicalAssessments: isHebrew ? "Update Neuropsychological Assessments" : "Update Neuropsychological Assessments",
        updateNeuropsychTesting: isHebrew ? "Update Neuropsych Testing" : "Update Neuropsych Testing",
        updateNeuropsychologicalAssessment: isHebrew ? "Modify Neuropsych Evaluation" : "Modify Neuropsych Evaluation",
        updateNeurosurgeryAssessment: isHebrew ? "Update Neurosurgery Assessment" : "Update Neurosurgery Assessment",
        updateNeurosurgeryConsultation: isHebrew ? "Update Neurosurgery Consultation" : "Update Neurosurgery Consultation",
        updateNeurosurgeryConsultations: isHebrew ? "Update Neurosurgery Consultations" : "Update Neurosurgery Consultations",
        updateNeurovascularExam: isHebrew ? "Update Neurovascular Exam" : "Update Neurovascular Exam",
        updateNewbornScreeningResult: isHebrew ? "Update Newborn Screening" : "Update Newborn Screening",
        updateNewbornScreeningResults: isHebrew ? "Update Newborn Screening Results" : "Update Newborn Screening Results",
        updateNicuProgressNote: isHebrew ? "Update NICU Progress" : "Update NICU Progress",
        updateNicuProgressNotes: isHebrew ? "Update Nicu Progress Notes" : "Update Nicu Progress Notes",
        updateNonMotorSymptom: isHebrew ? "Update Non Motor Symptom" : "Update Non Motor Symptom",
        updateNonMotorSymptoms: isHebrew ? "Update Non Motor Symptoms" : "Update Non Motor Symptoms",
        updateNtScanResult: isHebrew ? "Update Nt Scan Result" : "Update Nt Scan Result",
        updateNuclearMedicineAssessment: isHebrew ? "Update Nuclear Medicine Assessment" : "Update Nuclear Medicine Assessment",
        updateNuclearMedicineStudies: isHebrew ? "Update Nuclear Medicine Studies" : "Update Nuclear Medicine Studies",
        updateNuclearMedicineStudy: isHebrew ? "Update Nuclear Medicine Study" : "Update Nuclear Medicine Study",
        updateNurseSignature: isHebrew ? "Update Nurse Signature" : "Update Nurse Signature",
        updateNurseSignatures: isHebrew ? "Update Nurse Signatures" : "Update Nurse Signatures",
        updateNursingAssessment: isHebrew ? "Update Patient Assessment" : "Update Patient Assessment",
        updateNursingAssessments: isHebrew ? "Update Nursing Assessments" : "Update Nursing Assessments",
        updateNursingNote: isHebrew ? "Update Patient Note" : "Update Patient Note",
        updateNursingNotes: isHebrew ? "Update Nursing Notes" : "Update Nursing Notes",
        updateNutritionalStatus: isHebrew ? "Update Nutritional Status" : "Update Nutritional Status",
        updateNutritionAssessment: isHebrew ? "Modify nutrition assessment" : "Modify nutrition assessment",
        updateNutritionalAssessment: isHebrew ? "Update Nutritional Assessment" : "Update Nutritional Assessment",
        updateNutritionalStatu: isHebrew ? "Update Nutritional Statu" : "Update Nutritional Statu",
        updateNutritionalSupplementation: isHebrew ? "Update Nutritional Supplementation" : "Update Nutritional Supplementation",
        updateNutritionalSupport: isHebrew ? "Update Nutritional Support" : "Update Nutritional Support",
        updateNutritionAssessments: isHebrew ? "Update Nutrition Assessments" : "Update Nutrition Assessments",
        updateObstetricHistory: isHebrew ? "Update Obstetric History" : "Update Obstetric History",
        updateObstetricUltrasoundReport: isHebrew ? "Modify Obstetric Ultrasound" : "Modify Obstetric Ultrasound",
        updateObstetricUltrasoundReports: isHebrew ? "Update Obstetric Ultrasound Reports" : "Update Obstetric Ultrasound Reports",
        updateOccupationalExposureRecords: isHebrew ? "Update Occupational Exposure Records" : "Update Occupational Exposure Records",
        updateOccupationalHealthAssessment: isHebrew ? "Update Occupational Health Assessment" : "Update Occupational Health Assessment",
        updateOccupationalMedicineEvaluation: isHebrew ? "Update Occupational Medicine Evaluation" : "Update Occupational Medicine Evaluation",
        updateOccupationalMedicineEvaluations: isHebrew ? "Update Occupational Medicine Evaluations" : "Update Occupational Medicine Evaluations",
        updateOccupationalTherapyReport: isHebrew ? "Update Therapy Report" : "Update Therapy Report",
        updateOccupationalTherapyReports: isHebrew ? "Update Occupational Therapy Reports" : "Update Occupational Therapy Reports",
        updateOmissionsRefusal: isHebrew ? "Update Omissions Refusal" : "Update Omissions Refusal",
        updateOmissionsRefusals: isHebrew ? "Update Omissions Refusals" : "Update Omissions Refusals",
        updateOncologicEmergencies: isHebrew ? "Update Oncologic Emergencies" : "Update Oncologic Emergencies",
        updateOncologicEmergency: isHebrew ? "Update Oncologic Emergency" : "Update Oncologic Emergency",
        updateOncologyConsultation: isHebrew ? "Update Cancer Consultation" : "Update Cancer Consultation",
        updateOncologyConsultations: isHebrew ? "Update Oncology Consultations" : "Update Oncology Consultations",
        updateOncologyFollowupReport: isHebrew ? "Update Cancer Followup" : "Update Cancer Followup",
        updateOncologyFollowupReports: isHebrew ? "Update Oncology Followup Reports" : "Update Oncology Followup Reports",
        updateOncologyTeam: isHebrew ? "Update Oncology Team" : "Update Oncology Team",
        updateOncologyTreatmentPlan: isHebrew ? "Modify Cancer Treatment" : "Modify Cancer Treatment",
        updateOncologyTreatmentPlans: isHebrew ? "Update Oncology Treatment Plans" : "Update Oncology Treatment Plans",
        updateOperativeDetail: isHebrew ? "Update Operative Detail" : "Update Operative Detail",
        updateOperativeDetails: isHebrew ? "Update Operative Details" : "Update Operative Details",
        updateOperativeReport: isHebrew ? "Update Medical Report" : "Update Medical Report",
        updateOperativeReportDetail: isHebrew ? "Update Operative Report Detail" : "Update Operative Report Detail",
        updateOperativeReportDetails: isHebrew ? "Update Operative Report Details" : "Update Operative Report Details",
        updateOperativeReports: isHebrew ? "Update Operative Reports" : "Update Operative Reports",
        updateOperativeTechnique: isHebrew ? "Update Operative Technique" : "Update Operative Technique",
        updateOperativeTime: isHebrew ? "Update Operative Time" : "Update Operative Time",
        updateOphthalmologyExam: isHebrew ? "Update Ophthalmology Exam" : "Update Ophthalmology Exam",
        updateOphthalmologyExamination: isHebrew ? "Update Eye Exam" : "Update Eye Exam",
        updateOphthalmologyExaminations: isHebrew ? "Update Ophthalmology Examinations" : "Update Ophthalmology Examinations",
        updateOpioidRiskAssessment: isHebrew ? "Update Opioid Risk Assessment" : "Update Opioid Risk Assessment",
        updateOpportunisticInfections: isHebrew ? "Update Opportunistic Infections" : "Update Opportunistic Infections",
        updateOptimizationStat: isHebrew ? "Update Optimization Stat" : "Update Optimization Stat",
        updateOptimizationStats: isHebrew ? "Update Optimization Stats" : "Update Optimization Stats",
        updateOralSurgeryReport: isHebrew ? "Update Oral Surgery Report" : "Update Oral Surgery Report",
        updateOralSurgeryReports: isHebrew ? "Update Oral Surgery Reports" : "Update Oral Surgery Reports",
        updateOrthodonticTreatmentPlan: isHebrew ? "Modify Orthodontic Plan" : "Modify Orthodontic Plan",
        updateOrthodonticTreatmentPlans: isHebrew ? "Update Orthodontic Treatment Plans" : "Update Orthodontic Treatment Plans",
        updateOrthopedicAssessment: isHebrew ? "Update Orthopedic Assessment" : "Update Orthopedic Assessment",
        updateOrthopedicConsultation: isHebrew ? "Update Orthopedic Consultation" : "Update Orthopedic Consultation",
        updateOrthopedicConsultations: isHebrew ? "Update Orthopedic Consultations" : "Update Orthopedic Consultations",
        updateOrthopedicFollowupNote: isHebrew ? "Update Orthopedic Note" : "Update Orthopedic Note",
        updateOrthopedicFollowupNotes: isHebrew ? "Update Orthopedic Followup Notes" : "Update Orthopedic Followup Notes",
        updateOrthopedicImaging: isHebrew ? "Update Orthopedic Imaging" : "Update Orthopedic Imaging",
        updateOrthopedicOperativeReport: isHebrew ? "Update Orthopedic Report" : "Update Orthopedic Report",
        updateOrthopedicOperativeReports: isHebrew ? "Update Orthopedic Operative Reports" : "Update Orthopedic Operative Reports",
        updateOrthopedicProcedure: isHebrew ? "Update Orthopedic Procedure" : "Update Orthopedic Procedure",
        updateOrthopedicProcedures: isHebrew ? "Update Orthopedic Procedures" : "Update Orthopedic Procedures",
        updateOutcomesPrediction: isHebrew ? "Forecast outcome probabilities" : "Forecast outcome probabilities",
        updateOvertrainingAssessment: isHebrew ? "Update Overtraining Assessment" : "Update Overtraining Assessment",
        updatePainAssessmentForm: isHebrew ? "Modify pain assessment" : "Modify pain assessment",
        updatePainAssessmentForms: isHebrew ? "Update Pain Assessment Forms" : "Update Pain Assessment Forms",
        updatePainFunctionalAssessment: isHebrew ? "Update Pain Functional Assessment" : "Update Pain Functional Assessment",
        updatePainManagement: isHebrew ? "Update Pain Management" : "Update Pain Management",
        updatePainManagementNote: isHebrew ? "Update Pain Note" : "Update Pain Note",
        updatePainManagementNotes: isHebrew ? "Update Pain Management Notes" : "Update Pain Management Notes",
        updatePainManagementPlan: isHebrew ? "Update Pain Management Plan" : "Update Pain Management Plan",
        updatePainMedicationAgreements: isHebrew ? "Update Pain Medication Agreements" : "Update Pain Medication Agreements",
        updatePalliativeCare: isHebrew ? "Update Palliative Care" : "Update Palliative Care",
        updatePalliativeCareNeed: isHebrew ? "Update Palliative Care Need" : "Update Palliative Care Need",
        updatePalliativeCareNeeds: isHebrew ? "Update Palliative Care Needs" : "Update Palliative Care Needs",
        updateParentalConcern: isHebrew ? "Update Parental Concern" : "Update Parental Concern",
        updateParentalConcerns: isHebrew ? "Update Parental Concerns" : "Update Parental Concerns",
        updateParkinsonianFeatures: isHebrew ? "Update Parkinsonian Features" : "Update Parkinsonian Features",
        updateParkinsonMedication: isHebrew ? "Update Parkinson Medication" : "Update Parkinson Medication",
        updateParkinsonianFeature: isHebrew ? "Update Parkinsonian Feature" : "Update Parkinsonian Feature",
        updateParkinsonMedications: isHebrew ? "Update Parkinson Medications" : "Update Parkinson Medications",
        updatePartnerInvolvement: isHebrew ? "Update Partner Involvement" : "Update Partner Involvement",
        updatePartnerInvolvementDiabetesManagement: isHebrew ? "Update Partner Involvement Diabetes Management" : "Update Partner Involvement Diabetes Management",
        updatePastMedicalHistory: isHebrew ? "עדכן היסטוריה רפואית קודמת" : "Update Past Medical History",
        updatePastOcularHistory: isHebrew ? "Update Past Ocular History" : "Update Past Ocular History",
        updatePathologyGrossDescription: isHebrew ? "Update Pathology Gross Description" : "Update Pathology Gross Description",
        updatePathologyReport: isHebrew ? "Update Medical Report" : "Update Medical Report",
        updatePathologyReports: isHebrew ? "Update Pathology Reports" : "Update Pathology Reports",
        updatePatient: isHebrew ? "עדכן מטופל" : "Update patient",
        updatePatientCareGoals: isHebrew ? "Update Patient Care Goals" : "Update Patient Care Goals",
        updatePatientEducationContext: isHebrew ? "Update Patient Context" : "Update Patient Context",
        updatePatientEducationRecord: isHebrew ? "Update Patient Record" : "Update Patient Record",
        updatePatientEducationRecords: isHebrew ? "Update Patient Education Records" : "Update Patient Education Records",
        updatePatientEmotionalResponse: isHebrew ? "Update Patient Emotional Response" : "Update Patient Emotional Response",
        updatePatientInstruction: isHebrew ? "Update Patient Instruction" : "Update Patient Instruction",
        updatePatientInstructions: isHebrew ? "Update Patient Instructions" : "Update Patient Instructions",
        updatePatientPositioning: isHebrew ? "Update Patient Positioning" : "Update Patient Positioning",
        updatePatientProvider: isHebrew ? "Update Patient Provider" : "Update Patient Provider",
        updatePatientSpecificCarePlan: isHebrew ? "Modify Patient Care Plan" : "Modify Patient Care Plan",
        updatePediatricGrowthChart: isHebrew ? "Track child growth" : "Track child growth",
        updatePediatricGrowthCharts: isHebrew ? "Update Pediatric Growth Charts" : "Update Pediatric Growth Charts",
        updatePediatricScreening: isHebrew ? "Update Pediatric Screening" : "Update Pediatric Screening",
        updatePediatricVaccinationRecord: isHebrew ? "Update Child Vaccines" : "Update Child Vaccines",
        updatePediatricVaccinationRecords: isHebrew ? "Update Pediatric Vaccination Records" : "Update Pediatric Vaccination Records",
        updatePediatricVisit: isHebrew ? "Update Child Checkup" : "Update Child Checkup",
        updatePediatricVisits: isHebrew ? "Update Pediatric Visits" : "Update Pediatric Visits",
        updatePerformanceAssessment: isHebrew ? "Update Performance Assessment" : "Update Performance Assessment",
        updatePerformanceStatu: isHebrew ? "Update Performance Statu" : "Update Performance Statu",
        updatePerformanceStatus: isHebrew ? "Update Performance Status" : "Update Performance Status",
        updatePerinatalMentalHealthReferral: isHebrew ? "Update Perinatal Mental Health Referral" : "Update Perinatal Mental Health Referral",
        updatePeriodontalChart: isHebrew ? "Update Dental Records" : "Update Dental Records",
        updatePeriodontalCharts: isHebrew ? "Update Periodontal Charts" : "Update Periodontal Charts",
        updatePeripheralNeuropathy: isHebrew ? "Update Peripheral Neuropathy" : "Update Peripheral Neuropathy",
        updatePetScanReport: isHebrew ? "Update Pet Scan" : "Update Pet Scan",
        updatePetScanReports: isHebrew ? "Update Pet Scan Reports" : "Update Pet Scan Reports",
        updatePharmacyReview: isHebrew ? "Update Pharmacy Review" : "Update Pharmacy Review",
        updatePhysicalExamination: isHebrew ? "Update Physical Examination" : "Update Physical Examination",
        updatePhysicalExaminations: isHebrew ? "Update Physical Examinations" : "Update Physical Examinations",
        updatePhysicalTherapyEvaluation: isHebrew ? "Update PT Evaluation" : "Update PT Evaluation",
        updatePhysicalTherapyEvaluations: isHebrew ? "Update Physical Therapy Evaluations" : "Update Physical Therapy Evaluations",
        updatePhysicalTherapyNote: isHebrew ? "Update PT Note" : "Update PT Note",
        updatePhysicalTherapyNotes: isHebrew ? "Update Physical Therapy Notes" : "Update Physical Therapy Notes",
        updatePlasticSurgeryAssessment: isHebrew ? "Update Plastic Surgery Assessment" : "Update Plastic Surgery Assessment",
        updatePlasticSurgeryConsultation: isHebrew ? "Schedule plastic surgery" : "Schedule plastic surgery",
        updatePlasticSurgeryConsultations: isHebrew ? "Update Plastic Surgery Consultations" : "Update Plastic Surgery Consultations",
        updatePmrAssessment: isHebrew ? "Update Pmr Assessment" : "Update Pmr Assessment",
        updatePneumoperitoneum: isHebrew ? "Update Pneumoperitoneum" : "Update Pneumoperitoneum",
        updatePodiatryExamination: isHebrew ? "Update Podiatry Examination" : "Update Podiatry Examination",
        updatePodiatryExaminations: isHebrew ? "Update Podiatry Examinations" : "Update Podiatry Examinations",
        updatePointOfCareUltrasoundHeartRate: isHebrew ? "Update Point Of Care Ultrasound Heart Rate" : "Update Point Of Care Ultrasound Heart Rate",
        updatePoisonControlReport: isHebrew ? "Update Poison Control" : "Update Poison Control",
        updatePoisonControlReports: isHebrew ? "Update Poison Control Reports" : "Update Poison Control Reports",
        updatePolycysticKidneyDisease: isHebrew ? "Update Polycystic Kidney Disease" : "Update Polycystic Kidney Disease",
        updatePolypharmacy: isHebrew ? "Update Polypharmacy" : "Update Polypharmacy",
        updatePolypharmacyReview: isHebrew ? "Assess medication interactions" : "Assess medication interactions",
        updatePolypharmacyReviews: isHebrew ? "Update Polypharmacy Reviews" : "Update Polypharmacy Reviews",
        updatePortPlacement: isHebrew ? "Update Port Placement" : "Update Port Placement",
        updatePostDialysisAssessment: isHebrew ? "Update Post Dialysis Assessment" : "Update Post Dialysis Assessment",
        updatePostoperativeOrders: isHebrew ? "Update Postoperative Orders" : "Update Postoperative Orders",
        updatePostoperativePainManagement: isHebrew ? "Update Postoperative Pain Management" : "Update Postoperative Pain Management",
        updatePostOperativeReports: isHebrew ? "Update Post Operative Reports" : "Update Post Operative Reports",
        updatePostOpTesting: isHebrew ? "Update Post Op Testing" : "Update Post Op Testing",
        updatePostOperativeReport: isHebrew ? "Update Patient Record" : "Update Patient Record",
        updatePostopTesting: isHebrew ? "Update Postop Testing" : "Update Postop Testing",
        updatePostoperativeCondition: isHebrew ? "Update Postoperative Condition" : "Update Postoperative Condition",
        updatePostoperativeOrder: isHebrew ? "Update Postoperative Order" : "Update Postoperative Order",
        updatePostpartumDiabetesRisk: isHebrew ? "Update Postpartum Diabetes Risk" : "Update Postpartum Diabetes Risk",
        updatePostpartumGlucoseMonitoring: isHebrew ? "Update Postpartum Glucose Monitoring" : "Update Postpartum Glucose Monitoring",
        updatePostpartumNote: isHebrew ? "Update Postpartum Note" : "Update Postpartum Note",
        updatePostpartumNotes: isHebrew ? "Update Postpartum Notes" : "Update Postpartum Notes",
        updatePostpartumPlanning: isHebrew ? "Update Postpartum Planning" : "Update Postpartum Planning",
        updatePotentialTestingOutcome: isHebrew ? "Update Potential Testing Outcome" : "Update Potential Testing Outcome",
        updatePotentialTestingOutcomes: isHebrew ? "Update Potential Testing Outcomes" : "Update Potential Testing Outcomes",
        updatePreChemotherapyWorkup: isHebrew ? "Update Pre Chemotherapy Workup" : "Update Pre Chemotherapy Workup",
        updatePreDialysisAssessment: isHebrew ? "Update Pre Dialysis Assessment" : "Update Pre Dialysis Assessment",
        updatePreEmploymentPhysical: isHebrew ? "Update Pre Employment Physical" : "Update Pre Employment Physical",
        updatePregnancyComplications: isHebrew ? "Update Pregnancy Complications" : "Update Pregnancy Complications",
        updatePregnancySymptoms: isHebrew ? "Update Pregnancy Symptoms" : "Update Pregnancy Symptoms",
        updatePrenatalTestingReports: isHebrew ? "Update Prenatal Testing Reports" : "Update Prenatal Testing Reports",
        updatePrenatalVisits: isHebrew ? "Update Prenatal Visits" : "Update Prenatal Visits",
        updatePreOperativeAssessment: isHebrew ? "Modify Pre-Op Assessment" : "Modify Pre-Op Assessment",
        updatePreOperativeAssessments: isHebrew ? "Update Pre Operative Assessments" : "Update Pre Operative Assessments",
        updatePreoperativeEvaluation: isHebrew ? "Update Preoperative Evaluation" : "Update Preoperative Evaluation",
        updatePreOperativePreparation: isHebrew ? "Update Pre Operative Preparation" : "Update Pre Operative Preparation",
        updatePrePregnancyWeight: isHebrew ? "Update Pre Pregnancy Weight" : "Update Pre Pregnancy Weight",
        updatePreconceptionCounseling: isHebrew ? "Update Preconception Counseling" : "Update Preconception Counseling",
        updatePreeclampsiaMonitoring: isHebrew ? "Update Preeclampsia Monitoring" : "Update Preeclampsia Monitoring",
        updatePregnancyComplication: isHebrew ? "Update Pregnancy Complication" : "Update Pregnancy Complication",
        updatePregnancyCourse: isHebrew ? "Update Pregnancy Course" : "Update Pregnancy Course",
        updatePregnancyRiskAssessment: isHebrew ? "Update Pregnancy Risk Assessment" : "Update Pregnancy Risk Assessment",
        updatePregnancySymptom: isHebrew ? "Update Pregnancy Symptom" : "Update Pregnancy Symptom",
        updatePrenatalEducation: isHebrew ? "Update Prenatal Education" : "Update Prenatal Education",
        updatePrenatalScreening: isHebrew ? "Update Prenatal Screening" : "Update Prenatal Screening",
        updatePrenatalTestingReport: isHebrew ? "Update Prenatal Test" : "Update Prenatal Test",
        updatePrenatalVisit: isHebrew ? "Update Prenatal Record" : "Update Prenatal Record",
        updatePreoperativePreparation: isHebrew ? "Update Preoperative Preparation" : "Update Preoperative Preparation",
        updatePrepAndDrape: isHebrew ? "Update Prep And Drape" : "Update Prep And Drape",
        updatePrescription: isHebrew ? "Update Prescription" : "Update Prescription",
        updatePrescriptions: isHebrew ? "עדכן מרשם" : "Update prescription",
        updatePressureInjury: isHebrew ? "Update Pressure Injury" : "Update Pressure Injury",
        updatePressureUlcerRisk: isHebrew ? "Update Pressure Ulcer Risk" : "Update Pressure Ulcer Risk",
        updatePreventiveBiomarker: isHebrew ? "Update Preventive Biomarker" : "Update Preventive Biomarker",
        updatePreventiveBiomarkers: isHebrew ? "Update Preventive Biomarkers" : "Update Preventive Biomarkers",
        updatePreventiveCare: isHebrew ? "Update Preventive Care" : "Update Preventive Care",
        updatePreventiveMedicineAssessment: isHebrew ? "Update Preventive Medicine Assessment" : "Update Preventive Medicine Assessment",
        updatePreventiveMedicineAssessments: isHebrew ? "Update Preventive Medicine Assessments" : "Update Preventive Medicine Assessments",
        updatePrimaryProphylaxi: isHebrew ? "Update Primary Prophylaxi" : "Update Primary Prophylaxi",
        updatePrimaryProphylaxis: isHebrew ? "Update Primary Prophylaxis" : "Update Primary Prophylaxis",
        updatePriorAuthorizationForm: isHebrew ? "Update Authorization Form" : "Update Authorization Form",
        updatePriorAuthorizationForms: isHebrew ? "Update Prior Authorization Forms" : "Update Prior Authorization Forms",
        updatePriorAuthorizationStatu: isHebrew ? "Update Prior Authorization Statu" : "Update Prior Authorization Statu",
        updatePriorAuthorizationStatus: isHebrew ? "Update Prior Authorization Status" : "Update Prior Authorization Status",
        updatePrnMedication: isHebrew ? "Update Prn Medication" : "Update Prn Medication",
        updatePrnMedications: isHebrew ? "Update Prn Medications" : "Update Prn Medications",
        updateProceduralSedation: isHebrew ? "Update Procedural Sedation" : "Update Procedural Sedation",
        updateProcedureRequests: isHebrew ? "Update Procedure Requests" : "Update Procedure Requests",
        updateProceduresIntervention: isHebrew ? "Update Procedures Intervention" : "Update Procedures Intervention",
        updateProceduresInterventions: isHebrew ? "Update Procedures Interventions" : "Update Procedures Interventions",
        updatePrognosi: isHebrew ? "Update Prognosi" : "Update Prognosi",
        updatePrognosis: isHebrew ? "Update Prognosis Assessment" : "Update Prognosis Assessment",
        updatePrognosisDiscussion: isHebrew ? "Update Prognosis Discussion" : "Update Prognosis Discussion",
        updatePrognosisRecord: isHebrew ? "Update Patient Prognosis" : "Update Patient Prognosis",
        updatePrognosisRecords: isHebrew ? "Update Prognosis Records" : "Update Prognosis Records",
        updatePrognosticFactor: isHebrew ? "Update Prognostic Factor" : "Update Prognostic Factor",
        updatePrognosticFactors: isHebrew ? "Update Prognostic Factors" : "Update Prognostic Factors",
        updateProgressNote: isHebrew ? "Track patient progress" : "Track patient progress",
        updateProgressNotes: isHebrew ? "Update Progress Notes" : "Update Progress Notes",
        updateProphylacticMedication: isHebrew ? "Update Prophylactic Medication" : "Update Prophylactic Medication",
        updateProphylacticMedications: isHebrew ? "Update Prophylactic Medications" : "Update Prophylactic Medications",
        updateProposedArtSwitch: isHebrew ? "Update Proposed Art Switch" : "Update Proposed Art Switch",
        updateProteinuriaAssessment: isHebrew ? "Update Proteinuria Assessment" : "Update Proteinuria Assessment",
        updateProviderInfo: isHebrew ? "Update Provider Info" : "Update Provider Info",
        updateDoctorSettings: isHebrew ? "הגדרות רופא" : "Doctor settings",
        updatePscManagement: isHebrew ? "Update Psc Management" : "Update Psc Management",
        updatePsychiatricAssessmentScale: isHebrew ? "Update Psychiatric Assessment Scale" : "Update Psychiatric Assessment Scale",
        updatePsychiatricAssessmentScales: isHebrew ? "Update Psychiatric Assessment Scales" : "Update Psychiatric Assessment Scales",
        updatePsychiatricDischargeSummaries: isHebrew ? "Update Psychiatric Discharge Summaries" : "Update Psychiatric Discharge Summaries",
        updatePsychiatricDischargeSummary: isHebrew ? "Update Psychiatric Discharge" : "Update Psychiatric Discharge",
        updatePsychiatricEvaluation: isHebrew ? "Modify Psychiatric Assessment" : "Modify Psychiatric Assessment",
        updatePsychiatricEvaluations: isHebrew ? "Update Psychiatric Evaluations" : "Update Psychiatric Evaluations",
        updatePsychiatricHistory: isHebrew ? "Update Psychiatric History" : "Update Psychiatric History",
        updatePsychiatricProgressNote: isHebrew ? "Document Patient Progress" : "Document Patient Progress",
        updatePsychiatricProgressNotes: isHebrew ? "Update Psychiatric Progress Notes" : "Update Psychiatric Progress Notes",
        updatePsychiatricReview: isHebrew ? "Update Psychiatric Review" : "Update Psychiatric Review",
        updatePsychiatricTreatmentPlan: isHebrew ? "Update Psychiatric Treatment Plan" : "Update Psychiatric Treatment Plan",
        updatePsychosocialAssessment: isHebrew ? "Update Psychosocial Assessment" : "Update Psychosocial Assessment",
        updatePsychosocialAssessments: isHebrew ? "Update Psychosocial Assessments" : "Update Psychosocial Assessments",
        updatePsychosocialFactor: isHebrew ? "Update Psychosocial Factor" : "Update Psychosocial Factor",
        updatePsychosocialFactors: isHebrew ? "Update Psychosocial Factors" : "Update Psychosocial Factors",
        updatePsychosocialOncology: isHebrew ? "Update Psychosocial Oncology" : "Update Psychosocial Oncology",
        updatePsychosocialSupportService: isHebrew ? "Update Psychosocial Support Service" : "Update Psychosocial Support Service",
        updatePsychosocialSupportServices: isHebrew ? "Update Psychosocial Support Services" : "Update Psychosocial Support Services",
        updatePsychotropicMedication: isHebrew ? "Update Psychotropic Medication" : "Update Psychotropic Medication",
        updatePsychotropicMedications: isHebrew ? "Update Psychotropic Medications" : "Update Psychotropic Medications",
        updatePulmonaryFunctionTest: isHebrew ? "Modify lung test" : "Modify lung test",
        updatePulmonaryFunctionTests: isHebrew ? "Update Pulmonary Function Tests" : "Update Pulmonary Function Tests",
        updatePulmonaryImaging: isHebrew ? "Update Pulmonary Imaging" : "Update Pulmonary Imaging",
        updatePulmonaryRehabilitation: isHebrew ? "Update Pulmonary Rehabilitation" : "Update Pulmonary Rehabilitation",
        updatePulmonaryRehabilitationNote: isHebrew ? "Update Pulmonary Rehabilitation" : "Update Pulmonary Rehabilitation",
        updatePulmonaryRehabilitationNotes: isHebrew ? "Update Pulmonary Rehabilitation Notes" : "Update Pulmonary Rehabilitation Notes",
        updatePulmonologyConsultation: isHebrew ? "Update Lung Consultation" : "Update Lung Consultation",
        updatePulmonologyConsultations: isHebrew ? "Update Pulmonology Consultations" : "Update Pulmonology Consultations",
        updatePumpAdvancedSetting: isHebrew ? "Update Pump Advanced Setting" : "Update Pump Advanced Setting",
        updatePumpAdvancedSettings: isHebrew ? "Update Pump Advanced Settings" : "Update Pump Advanced Settings",
        updatePumpDownloadAnalysi: isHebrew ? "Update Pump Download Analysi" : "Update Pump Download Analysi",
        updatePumpDownloadAnalysis: isHebrew ? "Update Pump Download Analysis" : "Update Pump Download Analysis",
        updateQualityAssurance: isHebrew ? "Update Quality Assurance" : "Update Quality Assurance",
        updateQualityMetric: isHebrew ? "Update Quality Metric" : "Update Quality Metric",
        updateQualityMetrics: isHebrew ? "Update Quality Metrics" : "Update Quality Metrics",
        updateRadiationOncology: isHebrew ? "Update Radiation Oncology" : "Update Radiation Oncology",
        updateRadiationTherapy: isHebrew ? "Update Radiation Therapy" : "Update Radiation Therapy",
        updateRadiationTherapyRecord: isHebrew ? "Update Radiation Therapy" : "Update Radiation Therapy",
        updateRadiationTherapyRecords: isHebrew ? "Update Radiation Therapy Records" : "Update Radiation Therapy Records",
        updateRadiologyFinding: isHebrew ? "Update Radiology Finding" : "Update Radiology Finding",
        updateRadiologyFindings: isHebrew ? "Update Radiology Findings" : "Update Radiology Findings",
        updateRadiologyReport: isHebrew ? "Update Radiology Report" : "Update Radiology Report",
        updateRadiologyReports: isHebrew ? "Update Radiology Reports" : "Update Radiology Reports",
        updateRapidResponseSummaries: isHebrew ? "Update Rapid Response Summaries" : "Update Rapid Response Summaries",
        updateRapidResponseSummary: isHebrew ? "Update Response Summary" : "Update Response Summary",
        updateReadmissionRiskAssessment: isHebrew ? "Update Readmission Risk Assessment" : "Update Readmission Risk Assessment",
        updateReasonForReferral: isHebrew ? "Update Reason For Referral" : "Update Reason For Referral",
        updateRecommendation: isHebrew ? "Modify recommendation details" : "Modify recommendation details",
        updateReferral: isHebrew ? "Track referral status" : "Track referral status",
        updateReferrals: isHebrew ? "Update Referrals" : "Update Referrals",
        updateReferralsPlaced: isHebrew ? "Update Referrals Placed" : "Update Referrals Placed",
        updateRegionalAnesthesiaRecords: isHebrew ? "Update Regional Anesthesia Records" : "Update Regional Anesthesia Records",
        updateRehabilitationGoals: isHebrew ? "Update Rehabilitation Goals" : "Update Rehabilitation Goals",
        updateRehabilitationProgressNote: isHebrew ? "Track Patient Recovery" : "Track Patient Recovery",
        updateRehabilitationProgressNotes: isHebrew ? "Update Rehabilitation Progress Notes" : "Update Rehabilitation Progress Notes",
        updateRehabilitationProtocol: isHebrew ? "Update Rehabilitation Protocol" : "Update Rehabilitation Protocol",
        updateReminder: isHebrew ? "עדכן תזכורת" : "Update reminder",
        updateRenalAnemia: isHebrew ? "Update Renal Anemia" : "Update Renal Anemia",
        updateRenalNutrition: isHebrew ? "Update Renal Nutrition" : "Update Renal Nutrition",
        updateRenalProtectionPlan: isHebrew ? "Update Renal Protection Plan" : "Update Renal Protection Plan",
        updateReproductiveHistory: isHebrew ? "Update Reproductive History" : "Update Reproductive History",
        updateRescueTherapyOption: isHebrew ? "Update Rescue Therapy Option" : "Update Rescue Therapy Option",
        updateRescueTherapyOptions: isHebrew ? "Update Rescue Therapy Options" : "Update Rescue Therapy Options",
        updateResearchConsentForm: isHebrew ? "Update Research Consent" : "Update Research Consent",
        updateResearchConsentForms: isHebrew ? "Update Research Consent Forms" : "Update Research Consent Forms",
        updateRespiratoryDevice: isHebrew ? "Update Respiratory Device" : "Update Respiratory Device",
        updateRespiratoryDevices: isHebrew ? "Update Respiratory Devices" : "Update Respiratory Devices",
        updateRespiratoryInfection: isHebrew ? "Update Respiratory Infection" : "Update Respiratory Infection",
        updateRespiratoryInfections: isHebrew ? "Update Respiratory Infections" : "Update Respiratory Infections",
        updateRespiratoryMedication: isHebrew ? "Update Respiratory Medication" : "Update Respiratory Medication",
        updateRespiratoryMedications: isHebrew ? "Update Respiratory Medications" : "Update Respiratory Medications",
        updateRespiteCare: isHebrew ? "Update Respite Care" : "Update Respite Care",
        updateResponseAssessment: isHebrew ? "Update Response Assessment" : "Update Response Assessment",
        updateResuscitationRecords: isHebrew ? "Update Resuscitation Records" : "Update Resuscitation Records",
        updateRetinalExamination: isHebrew ? "Record retinal exam details" : "Record retinal exam details",
        updateRetinalExaminations: isHebrew ? "Update Retinal Examinations" : "Update Retinal Examinations",
        updateReturnToPlayProtocol: isHebrew ? "Update Return To Play Protocol" : "Update Return To Play Protocol",
        updateReturnToSport: isHebrew ? "Update Return To Sport" : "Update Return To Sport",
        updateReturnToWorkPlan: isHebrew ? "Update Return To Work Plan" : "Update Return To Work Plan",
        updateReviewOfSystem: isHebrew ? "Update Review Of System" : "Update Review Of System",
        updateReviewOfSystems: isHebrew ? "Update Review Of Systems" : "Update Review Of Systems",
        updateRheumatoidArthritisAssessment: isHebrew ? "Update Rheumatoid Arthritis Assessment" : "Update Rheumatoid Arthritis Assessment",
        updateRheumatologicAssessment: isHebrew ? "Update Rheumatologic Assessment" : "Update Rheumatologic Assessment",
        updateRheumatologicMonitoring: isHebrew ? "Update Rheumatologic Monitoring" : "Update Rheumatologic Monitoring",
        updateRheumatologicTreatment: isHebrew ? "Update Rheumatologic Treatment" : "Update Rheumatologic Treatment",
        updateRheumatologyConsultation: isHebrew ? "Update Rheumatology Consultation" : "Update Rheumatology Consultation",
        updateRheumatologyConsultations: isHebrew ? "Update Rheumatology Consultations" : "Update Rheumatology Consultations",
        updateRiskCalculator: isHebrew ? "Update Risk Calculator" : "Update Risk Calculator",
        updateRiskCalculators: isHebrew ? "Update Risk Calculators" : "Update Risk Calculators",
        updateRiskCounseling: isHebrew ? "Update Risk Counseling" : "Update Risk Counseling",
        updateRiskFactor: isHebrew ? "Modify risk assessment" : "Modify risk assessment",
        updateRiskFactors: isHebrew ? "Update Risk Factors" : "Update Risk Factors",
        updateSafetyPlanning: isHebrew ? "Update Safety Planning" : "Update Safety Planning",
        updateScheduledMedication: isHebrew ? "Update Scheduled Medication" : "Update Scheduled Medication",
        updateScheduledMedications: isHebrew ? "Update Scheduled Medications" : "Update Scheduled Medications",
        updateSchoolHealthForm: isHebrew ? "Update Health Form" : "Update Health Form",
        updateSchoolHealthForms: isHebrew ? "Update School Health Forms" : "Update School Health Forms",
        updateSchoolPerformance: isHebrew ? "Update School Performance" : "Update School Performance",
        updateSclerodermaAssessment: isHebrew ? "Update Scleroderma Assessment" : "Update Scleroderma Assessment",
        updateScreeningCompliance: isHebrew ? "Update Screening Compliance" : "Update Screening Compliance",
        updateSecondaryProphylaxis: isHebrew ? "Update Secondary Prophylaxis" : "Update Secondary Prophylaxis",
        updateSecondOpinionReport: isHebrew ? "Modify second opinion" : "Modify second opinion",
        updateSecondaryProphylaxi: isHebrew ? "Update Secondary Prophylaxi" : "Update Secondary Prophylaxi",
        updateSecondOpinionReports: isHebrew ? "Update Second Opinion Reports" : "Update Second Opinion Reports",
        updateSedationRecords: isHebrew ? "Update Sedation Records" : "Update Sedation Records",
        updateSepsisManagement: isHebrew ? "Update Sepsis Management" : "Update Sepsis Management",
        updateShiftHandoffNote: isHebrew ? "Update Shift Note" : "Update Shift Note",
        updateShiftHandoffNotes: isHebrew ? "Update Shift Handoff Notes" : "Update Shift Handoff Notes",
        updateSingleEmbryoTransfer: isHebrew ? "Update Single Embryo Transfer" : "Update Single Embryo Transfer",
        updateSingleEmbryoTransferDetail: isHebrew ? "Update Single Embryo Transfer Detail" : "Update Single Embryo Transfer Detail",
        updateSingleEmbryoTransferDetails: isHebrew ? "Update Single Embryo Transfer Details" : "Update Single Embryo Transfer Details",
        updateSjogrensSyndromeAssessment: isHebrew ? "Update Sjogrens Syndrome Assessment" : "Update Sjogrens Syndrome Assessment",
        updateSkinBiopsyReport: isHebrew ? "Update Skin Biopsy" : "Update Skin Biopsy",
        updateSkinBiopsyReports: isHebrew ? "Update Skin Biopsy Reports" : "Update Skin Biopsy Reports",
        updateSleepApneaManagement: isHebrew ? "Update Sleep Apnea Management" : "Update Sleep Apnea Management",
        updateSleepDisorderAssessment: isHebrew ? "Update Sleep Disorder Assessment" : "Update Sleep Disorder Assessment",
        updateSleepDisturbance: isHebrew ? "Update Sleep Disturbance" : "Update Sleep Disturbance",
        updateSleepDisturbances: isHebrew ? "Update Sleep Disturbances" : "Update Sleep Disturbances",
        updateSleepHygieneEducation: isHebrew ? "Update Sleep Hygiene Education" : "Update Sleep Hygiene Education",
        updateSleepStudyReport: isHebrew ? "Update Sleep Report" : "Update Sleep Report",
        updateSleepStudyReports: isHebrew ? "Update Sleep Study Reports" : "Update Sleep Study Reports",
        updateSoapNote: isHebrew ? "Update Patient Record" : "Update Patient Record",
        updateSoapNotes: isHebrew ? "Update Soap Notes" : "Update Soap Notes",
        updateSocialDeterminantsOfHealth: isHebrew ? "Update Social Determinants Of Health" : "Update Social Determinants Of Health",
        updateSocialFunctionalAssessment: isHebrew ? "Update Social Functional Assessment" : "Update Social Functional Assessment",
        updateSocialHistory: isHebrew ? "Update Social History" : "Update Social History",
        updateSocialSupport: isHebrew ? "Update Social Support" : "Update Social Support",
        updateSocialWork: isHebrew ? "Update Social Work" : "Update Social Work",
        updateSocialWorkNote: isHebrew ? "Update Social Note" : "Update Social Note",
        updateSocialWorkNotes: isHebrew ? "Update Social Work Notes" : "Update Social Work Notes",
        updateSource: isHebrew ? "Update Source" : "Update Source",
        updateSouthAsianNutritionist: isHebrew ? "Update South Asian Nutritionist" : "Update South Asian Nutritionist",
        updateSpecialtyField: isHebrew ? "Update Specialty Field" : "Update Specialty Field",
        updateSpecialtyFields: isHebrew ? "Update Specialty Fields" : "Update Specialty Fields",
        updateSpecificIgeTest: isHebrew ? "Update IGE Test" : "Update IGE Test",
        updateSpecificIgeTests: isHebrew ? "Update Specific Ige Tests" : "Update Specific Ige Tests",
        updateSpecimen: isHebrew ? "Update Specimen" : "Update Specimen",
        updateSpecimens: isHebrew ? "Update Specimens" : "Update Specimens",
        updateSpeechTherapyAssessment: isHebrew ? "Update Speech Assessment" : "Update Speech Assessment",
        updateSpeechTherapyAssessments: isHebrew ? "Update Speech Therapy Assessments" : "Update Speech Therapy Assessments",
        updateSpondyloarthritisAssessment: isHebrew ? "Update Spondyloarthritis Assessment" : "Update Spondyloarthritis Assessment",
        updateSpongeInstrumentCount: isHebrew ? "Update Sponge Instrument Count" : "Update Sponge Instrument Count",
        updateSpongeInstrumentCounts: isHebrew ? "Update Sponge Instrument Counts" : "Update Sponge Instrument Counts",
        updateSportsMedicineEvaluation: isHebrew ? "Update Sports Medicine Evaluation" : "Update Sports Medicine Evaluation",
        updateSportsMedicineEvaluations: isHebrew ? "Update Sports Medicine Evaluations" : "Update Sports Medicine Evaluations",
        updateSportsNutritionPlan: isHebrew ? "Update Sports Nutrition Plan" : "Update Sports Nutrition Plan",
        updateSportsPhysicalExamination: isHebrew ? "Update Sports Physical Examination" : "Update Sports Physical Examination",
        updateStagingSummary: isHebrew ? "Update Staging Summary" : "Update Staging Summary",
        updateStressManagementReferral: isHebrew ? "Update Stress Management Referral" : "Update Stress Management Referral",
        updateStressManagementReferrals: isHebrew ? "Update Stress Management Referrals" : "Update Stress Management Referrals",
        updateStressTestReport: isHebrew ? "Modify stress test report" : "Modify stress test report",
        updateStressTestReports: isHebrew ? "Update Stress Test Reports" : "Update Stress Test Reports",
        updateStrokeAssessment: isHebrew ? "Update Stroke Assessment" : "Update Stroke Assessment",
        updateSubstanceUseAssessment: isHebrew ? "Update Substance Use Assessment" : "Update Substance Use Assessment",
        updateSuicideRiskAssessment: isHebrew ? "Update Suicide Risk Assessment" : "Update Suicide Risk Assessment",
        updateSupplementationPlan: isHebrew ? "Update Supplementation Plan" : "Update Supplementation Plan",
        updateSupplementationPlans: isHebrew ? "Update Supplementation Plans" : "Update Supplementation Plans",
        updateSupportGroupReferral: isHebrew ? "Update Support Group Referral" : "Update Support Group Referral",
        updateSupportiveCare: isHebrew ? "Update Supportive Care" : "Update Supportive Care",
        updateSurgicalApproach: isHebrew ? "Update Surgical Approach" : "Update Surgical Approach",
        updateSurgicalConsentForm: isHebrew ? "Update Patient Consent" : "Update Patient Consent",
        updateSurgicalConsentForms: isHebrew ? "Update Surgical Consent Forms" : "Update Surgical Consent Forms",
        updateSurgicalHistory: isHebrew ? "Update Surgical History" : "Update Surgical History",
        updateSurgicalOncology: isHebrew ? "Update Surgical Oncology" : "Update Surgical Oncology",
        updateSurgicalStep: isHebrew ? "Update Surgical Step" : "Update Surgical Step",
        updateSurgicalSteps: isHebrew ? "Update Surgical Steps" : "Update Surgical Steps",
        updateSurgicalTeam: isHebrew ? "Update Surgical Team" : "Update Surgical Team",
        updateSurvivorshipCarePlan: isHebrew ? "Update Survivorship Care Plan" : "Update Survivorship Care Plan",
        updateSymptomProgression: isHebrew ? "Update Symptom Progression" : "Update Symptom Progression",
        updateSymptomProgressionTimeline: isHebrew ? "Update Symptom Progression Timeline" : "Update Symptom Progression Timeline",
        updateTelemedicineEncounter: isHebrew ? "Modify Telemedicine Session" : "Modify Telemedicine Session",
        updateTelemedicineEncounters: isHebrew ? "Update Telemedicine Encounters" : "Update Telemedicine Encounters",
        updateTherapyProgressNote: isHebrew ? "Track Patient Progress" : "Track Patient Progress",
        updateTherapyProgressNotes: isHebrew ? "Update Therapy Progress Notes" : "Update Therapy Progress Notes",
        updateTherapyRequests: isHebrew ? "Update Therapy Requests" : "Update Therapy Requests",
        updateTherapySessionNote: isHebrew ? "Update Session Note" : "Update Session Note",
        updateTherapySessionNotes: isHebrew ? "Update Therapy Session Notes" : "Update Therapy Session Notes",
        updateThoracicSurgeryAssessment: isHebrew ? "Update Thoracic Surgery Assessment" : "Update Thoracic Surgery Assessment",
        updateThyroidEvaluation: isHebrew ? "Assess thyroid status" : "Assess thyroid status",
        updateThyroidEvaluations: isHebrew ? "Update Thyroid Evaluations" : "Update Thyroid Evaluations",
        updateThyroidManagement: isHebrew ? "Update Thyroid Management" : "Update Thyroid Management",
        updateTotalWeightGain: isHebrew ? "Update Total Weight Gain" : "Update Total Weight Gain",
        updateTourniquetData: isHebrew ? "Update Tourniquet Data" : "Update Tourniquet Data",
        updateToxicityAssessment: isHebrew ? "Update Toxicity Assessment" : "Update Toxicity Assessment",
        updateToxicologyReport: isHebrew ? "Update Toxicology Details" : "Update Toxicology Details",
        updateToxicologyReports: isHebrew ? "Update Toxicology Reports" : "Update Toxicology Reports",
        updateTractographyStudies: isHebrew ? "Update Tractography Studies" : "Update Tractography Studies",
        updateTractographyStudy: isHebrew ? "Update Tractography Data" : "Update Tractography Data",
        updateTransferSummaries: isHebrew ? "Update Transfer Summaries" : "Update Transfer Summaries",
        updateTransferSummary: isHebrew ? "Update Transfer Details" : "Update Transfer Details",
        updateTransplantAssessment: isHebrew ? "Update Transplant Assessment" : "Update Transplant Assessment",
        updateTransplantEvaluation: isHebrew ? "Modify transplant assessment" : "Modify transplant assessment",
        updateTransplantEvaluations: isHebrew ? "Update Transplant Evaluations" : "Update Transplant Evaluations",
        updateTraumaAssessment: isHebrew ? "Update Trauma Assessment" : "Update Trauma Assessment",
        updateTraumaFlowSheet: isHebrew ? "Update Trauma Records" : "Update Trauma Records",
        updateTraumaFlowSheets: isHebrew ? "Update Trauma Flow Sheets" : "Update Trauma Flow Sheets",
        updateTraumaScoring: isHebrew ? "Update Trauma Scoring" : "Update Trauma Scoring",
        updateTravelHealthCertificate: isHebrew ? "Modify Travel Certificate" : "Modify Travel Certificate",
        updateTravelHealthCertificates: isHebrew ? "Update Travel Health Certificates" : "Update Travel Health Certificates",
        updateTravelMedicineAssessment: isHebrew ? "Update Travel Medicine Assessment" : "Update Travel Medicine Assessment",
        updateTravelVaccinationRecords: isHebrew ? "Update Travel Vaccination Records" : "Update Travel Vaccination Records",
        updateTreatmentCours: isHebrew ? "Update Treatment Cours" : "Update Treatment Cours",
        updateTreatmentCourses: isHebrew ? "Update Treatment Courses" : "Update Treatment Courses",
        updateTreatmentGoal: isHebrew ? "Update Treatment Goal" : "Update Treatment Goal",
        updateTreatmentGoals: isHebrew ? "Update Treatment Goals" : "Update Treatment Goals",
        updateTreatmentPlan: isHebrew ? "Modify Patient Treatment" : "Modify Patient Treatment",
        updateTreatmentPlans: isHebrew ? "Update Treatment Plans" : "Update Treatment Plans",
        updateTreatmentSummary: isHebrew ? "Update Treatment Summary" : "Update Treatment Summary",
        updateTrendAnalysi: isHebrew ? "Update Trend Analysi" : "Update Trend Analysi",
        updateTrendAnalysis: isHebrew ? "Update Trend Analysis" : "Update Trend Analysis",
        updateTrendingAnalysi: isHebrew ? "Analyze trending data" : "Analyze trending data",
        updateTrendingAnalysis: isHebrew ? "Update Trending Analysis" : "Update Trending Analysis",
        updateTriageData: isHebrew ? "Update Triage Data" : "Update Triage Data",
        updateTropicalDiseaseAssessment: isHebrew ? "Update Tropical Disease Assessment" : "Update Tropical Disease Assessment",
        updateTumorBoardNote: isHebrew ? "Update Tumor Note" : "Update Tumor Note",
        updateTumorBoardNotes: isHebrew ? "Update Tumor Board Notes" : "Update Tumor Board Notes",
        updateTumorMarker: isHebrew ? "Update Tumor Marker" : "Update Tumor Marker",
        updateTumorMarkerPanel: isHebrew ? "Update Tumor Markers" : "Update Tumor Markers",
        updateTumorMarkerPanels: isHebrew ? "Update Tumor Marker Panels" : "Update Tumor Marker Panels",
        updateTumorMarkers: isHebrew ? "Update Tumor Markers" : "Update Tumor Markers",
        updateUltrasoundObReport: isHebrew ? "Update Ultrasound Report" : "Update Ultrasound Report",
        updateUltrasoundObReports: isHebrew ? "Update Ultrasound Ob Reports" : "Update Ultrasound Ob Reports",
        updateUmbilicalArteryDoppler: isHebrew ? "Update Umbilical Artery Doppler" : "Update Umbilical Artery Doppler",
        updateUnifiedMedicalDocument: isHebrew ? "Update Unified Medical Document" : "Update Unified Medical Document",
        updateUrodynamicStudies: isHebrew ? "Update Urodynamic Studies" : "Update Urodynamic Studies",
        updateUrodynamicStudy: isHebrew ? "Update Urodynamic Study" : "Update Urodynamic Study",
        updateUrologyAssessment: isHebrew ? "Update Urology Assessment" : "Update Urology Assessment",
        updateUrologyConsultation: isHebrew ? "Update Urology Consultation" : "Update Urology Consultation",
        updateUrologyConsultations: isHebrew ? "Update Urology Consultations" : "Update Urology Consultations",
        updateUserSpecialties: isHebrew ? "עדכן התמחויות" : "Update specialties",
        updateVaccinationRecord: isHebrew ? "Update Vaccination Status" : "Update Vaccination Status",
        updateVaccinationRecords: isHebrew ? "Update Vaccination Records" : "Update Vaccination Records",
        updateVariantInterpretationGuideline: isHebrew ? "Update Variant Interpretation Guideline" : "Update Variant Interpretation Guideline",
        updateVariantInterpretationGuidelines: isHebrew ? "Update Variant Interpretation Guidelines" : "Update Variant Interpretation Guidelines",
        updateVasculitisAssessment: isHebrew ? "Update Vasculitis Assessment" : "Update Vasculitis Assessment",
        updateVenousThromboembolismRisk: isHebrew ? "Update Venous Thromboembolism Risk" : "Update Venous Thromboembolism Risk",
        updateVentilatorSetting: isHebrew ? "Update Ventilator Setting" : "Update Ventilator Setting",
        updateVentilatorSettings: isHebrew ? "Update Ventilator Settings" : "Update Ventilator Settings",
        updateVisualAcuityReport: isHebrew ? "Update Vision Report" : "Update Vision Report",
        updateVisualAcuityReports: isHebrew ? "Update Visual Acuity Reports" : "Update Visual Acuity Reports",
        updateVitalSign: isHebrew ? "Monitor patient health" : "Monitor patient health",
        updateVitalSigns: isHebrew ? "Update Vital Signs" : "Update Vital Signs",
        updateVitalSignsLog: isHebrew ? "Record patient vitals" : "Record patient vitals",
        updateVitalSignsLogs: isHebrew ? "Update Vital Signs Logs" : "Update Vital Signs Logs",
        updateVitalSignsMonitoring: isHebrew ? "Update Vital Signs Monitoring" : "Update Vital Signs Monitoring",
        updateVitalSignsTable: isHebrew ? "Update Vital Signs Table" : "Update Vital Signs Table",
        updateWeeklyVirtualCheckIn: isHebrew ? "Update Weekly Virtual Check In" : "Update Weekly Virtual Check In",
        updateWeeklyVirtualCheckIns: isHebrew ? "Update Weekly Virtual Check Ins" : "Update Weekly Virtual Check Ins",
        updateWeightMeasurement: isHebrew ? "Update Weight Measurement" : "Update Weight Measurement",
        updateWeightMeasurements: isHebrew ? "Update Weight Measurements" : "Update Weight Measurements",
        updateWeightMonitoring: isHebrew ? "Update Weight Monitoring" : "Update Weight Monitoring",
        updateWellChildExamination: isHebrew ? "Update Child Exam" : "Update Child Exam",
        updateWellChildExaminations: isHebrew ? "Update Well Child Examinations" : "Update Well Child Examinations",
        updateWellChildSummary: isHebrew ? "Update Well Child Summary" : "Update Well Child Summary",
        updateWellnessVisitDocumentation: isHebrew ? "Update Wellness Visit Documentation" : "Update Wellness Visit Documentation",
        updateWorkAccommodation: isHebrew ? "Update Work Accommodation" : "Update Work Accommodation",
        updateWorkAccommodations: isHebrew ? "Update Work Accommodations" : "Update Work Accommodations",
        updateWorkersCompensationEvaluation: isHebrew ? "Update Workers Compensation Evaluation" : "Update Workers Compensation Evaluation",
        updateWorkersCompEvaluations: isHebrew ? "Update Workers Comp Evaluations" : "Update Workers Comp Evaluations",
        updateWorkplaceAccommodations: isHebrew ? "Update Workplace Accommodations" : "Update Workplace Accommodations",
        updateWorkplaceInjuryReport: isHebrew ? "Update Workplace Injury Report" : "Update Workplace Injury Report",
        updateWorkRestriction: isHebrew ? "Update Work Restriction" : "Update Work Restriction",
        updateWorkersCompEvaluation: isHebrew ? "Modify Workers' Compensation Assessment" : "Modify Workers' Compensation Assessment",
        updateWorkplaceAccommodation: isHebrew ? "Update Workplace Accommodation" : "Update Workplace Accommodation",
        updateWorkRestrictions: isHebrew ? "Update Work Restrictions" : "Update Work Restrictions",
        updateWoundCareAssessment: isHebrew ? "Update Wound Care Assessment" : "Update Wound Care Assessment",
        updateWoundCareAssessments: isHebrew ? "Update Wound Care Assessments" : "Update Wound Care Assessments",
        updateWoundCareDocumentation: isHebrew ? "Update Wound Records" : "Update Wound Records",
        updateWoundCareNote: isHebrew ? "Update Wound Documentation" : "Update Wound Documentation",
        updateWoundCareNotes: isHebrew ? "Update Wound Care Notes" : "Update Wound Care Notes",
        verifyInsurance: isHebrew ? "אמת ביטוח" : "Verify insurance",
        captureCharge: isHebrew ? "רשום חיוב עבור שירות" : "Capture charge for a service",
        getPatientCharges: isHebrew ? "הצג חיובים של מטופל" : "Get patient charges",
        generateInvoice: isHebrew ? "צור חשבונית" : "Generate invoice for patient",
        processPayment: isHebrew ? "רשום תשלום" : "Record a payment against an invoice",
        getOutstandingBalances: isHebrew ? "הצג יתרות חוב" : "Get outstanding balances for a patient",
        createPaymentPlan: isHebrew ? "צור תוכנית תשלומים" : "Create installment payment plan",
        getRevenueReport: isHebrew ? "הצג דוח הכנסות" : "Get revenue report for a date range",
        getPaymentHistory: isHebrew ? "הצג היסטוריית תשלומים" : "Get payment history for a patient",
        updateCharge: isHebrew ? "עדכן חיוב" : "Update an existing charge (CPT code, amount, diagnosis, etc.)",
        voidCharge: isHebrew ? "בטל חיוב" : "Void/cancel a charge (maintains audit trail)",
        voidInvoice: isHebrew ? "בטל חשבונית" : "Void/cancel an invoice",
        refundPayment: isHebrew ? "החזר תשלום" : "Refund a completed payment (full or partial)",
        updatePaymentPlan: isHebrew ? "עדכן תוכנית תשלומים" : "Update a payment plan (installments, amount, etc.)",
        cancelPaymentPlan: isHebrew ? "בטל תוכנית תשלומים" : "Cancel a payment plan",
      };

      // Merge with generated descriptions (get* functions with better descriptions from collectionSystemPrompts.json)
      const generatedDescs = getGeneratedDescriptions(isHebrew);
      const mergedDescriptions = { ...descriptions, ...generatedDescs };

      return mergedDescriptions[functionName] || functionName;
    }

    getAllPlatformFunctions(language, clinicCountry) {
      // Check cache first to avoid regenerating functions
      const cacheKey = `${language}-${clinicCountry}`;
      // Handle concurrent initialization
      if (this.FUNCTION_CACHE.initializing) {
        // Another request is initializing, wait a bit and try to use cache
        console.log('⏳ Function cache is being initialized by another request...');
        // Return basic set to avoid duplicate work
        if (this.FUNCTION_CACHE.all[cacheKey]) {
          return this.FUNCTION_CACHE.all[cacheKey];
        }
      }
  
      if (this.FUNCTION_CACHE.initialized && this.FUNCTION_CACHE.all[cacheKey]) {
        if (process.env.QUIET_LOGS !== 'true') console.log(`⚡ Using cached functions for ${cacheKey}`);
        return this.FUNCTION_CACHE.all[cacheKey];
      }
  
      const isHebrew = language === 'he';
      const isIsrael = clinicCountry === 'Israel';
      const isUSA = clinicCountry === 'United States' || clinicCountry === 'USA' || clinicCountry === 'US';
  
      const platformFunctions = [
    // ========== MEDICAL FUNCTIONS ONLY ==========
    // Compliance/Security functions moved to complianceHelpers.js
    // 130 orphaned functions deleted
    // Keeping 255 medical + infrastructure functions

{
          name: "addPatient",
          description: isHebrew 
            ? "הוסף מטופל חדש למערכת - חובה לאסוף את כל השדות הנדרשים לפני הקריאה לפונקציה"
            : "Add a new patient to the system - MUST collect all required fields before calling",
          parameters: {
            type: "object",
            properties: {
              firstName: { type: "string", description: isHebrew ? "שם פרטי (חובה)" : "First name (required)" },
              lastName: { type: "string", description: isHebrew ? "שם משפחה (חובה)" : "Last name (required)" },
              dateOfBirth: { type: "string", description: isHebrew ? "תאריך לידה (חובה)" : "Date of birth (required)" },
              country: { type: "string", description: isHebrew ? "מדינה (חובה)" : "Country (required)", enum: ["Israel", "USA", "Other"] },
              nationalId: isIsrael ? { type: "string", description: "תעודת זהות 9 ספרות (חובה)" } : (!isUSA ? { type: "string", description: "National ID (required)" } : undefined),
              socialSecurityNumber: isUSA ? { type: "string", description: "Social Security Number (SSN) (required)" } : undefined,
              phone: { type: "string", description: isHebrew ? "טלפון (חובה)" : "Phone (required)" },
              email: { type: "string", description: isHebrew ? "אימייל (חובה)" : "Email (required)" },
              street: { type: "string", description: isHebrew ? "רחוב ומספר בית (חובה)" : "Street and number (required)" },
              city: { type: "string", description: isHebrew ? "עיר (חובה)" : "City (required)" },
              state: isUSA ? { type: "string", description: "State (required)" } : undefined,
              zipCode: { type: "string", description: isHebrew ? "מיקוד (חובה)" : "ZIP code (required)" },
              gender: { type: "string", description: isHebrew ? "מין" : "Gender", enum: ["Male", "Female", "Other"] },
              bloodType: { type: "string", description: isHebrew ? "סוג דם" : "Blood type", enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
              allergies: { type: "string", description: isHebrew ? "אלרגיות" : "Allergies" },
              emergencyContact: { type: "string", description: isHebrew ? "איש קשר לחירום" : "Emergency contact name" },
              emergencyContactPhone: { type: "string", description: isHebrew ? "טלפון איש קשר לחירום" : "Emergency contact phone" },
              preferredLanguage: { type: "string", description: isHebrew ? "שפה מועדפת" : "Preferred language", enum: ["English", "Spanish", "Hebrew", "Other"] },
              healthFund: isIsrael ? { type: "string", description: "קופת חולים (חובה)", enum: ["כללית", "מכבי", "מאוחדת", "לאומית"] } : undefined,
              insuranceProvider: isUSA ? { type: "string", description: "Insurance provider (required)" } : undefined,
              insuranceNumber: isUSA ? { type: "string", description: "Insurance number" } : undefined,
              doctorSummary: { type: "string", description: isHebrew ? "סיכום רופא" : "Doctor summary" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status", enum: ["Active", "Inactive", "Deceased"] }
            },
            required: isIsrael 
              ? ["firstName", "lastName", "dateOfBirth", "country", "nationalId", "phone", "email", "street", "city", "zipCode", "healthFund"]
              : (isUSA 
                ? ["firstName", "lastName", "dateOfBirth", "country", "socialSecurityNumber", "phone", "email", "street", "city", "state", "zipCode", "insuranceProvider"]
                : ["firstName", "lastName", "dateOfBirth", "country", "nationalId", "phone", "email", "street", "city", "zipCode"])
          }
        },

{
          name: "updatePatient",
          description: isHebrew 
            ? "עדכן פרטי מטופל. יכול להשתמש ב-nationalId (עדיף) או patientId מתוצאות חיפוש"
            : "Update patient details. Can use SSN/national ID (preferred) or patientId from search results",
          parameters: {
            type: "object",
            properties: {
              nationalId: isIsrael ? { 
                type: "string", 
                description: "תעודת זהות של המטופל - השתמש בזה! המערכת תמצא את המטופל אוטומטית"
              } : (!isUSA ? {
                type: "string",
                description: "Patient's national ID - USE THIS! System will find patient automatically"
              } : undefined),
              socialSecurityNumber: isUSA ? {
                type: "string",
                description: "Patient's SSN - USE THIS! System will find patient automatically"
              } : undefined,
              patientId: { 
                type: "string", 
                description: isHebrew 
                  ? "מזהה מטופל - אופציונלי, עדיף להשתמש ב-nationalId"
                  : "Patient ID - optional, prefer using nationalId instead"
              },
              firstName: { type: "string", description: isHebrew ? "שם פרטי" : "First name" },
              lastName: { type: "string", description: isHebrew ? "שם משפחה" : "Last name" },
              phone: { type: "string", description: isHebrew ? "טלפון" : "Phone" },
              email: { type: "string", description: isHebrew ? "אימייל" : "Email" },
              street: { type: "string", description: isHebrew ? "רחוב כולל מספר בית" : "Street including building number" },
              city: { type: "string", description: isHebrew ? "עיר" : "City" },
              state: isUSA ? { type: "string", description: "State" } : undefined,
              zipCode: { type: "string", description: isHebrew ? "מיקוד" : "ZIP" },
              gender: { type: "string", description: isHebrew ? "מין" : "Gender", enum: ["Male", "Female", "Other"] },
              bloodType: { type: "string", description: isHebrew ? "סוג דם" : "Blood type", enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
              allergies: { type: "string", description: isHebrew ? "אלרגיות" : "Allergies" },
              emergencyContact: { type: "string", description: isHebrew ? "איש קשר לחירום" : "Emergency contact name" },
              emergencyContactPhone: { type: "string", description: isHebrew ? "טלפון איש קשר לחירום" : "Emergency contact phone" },
              preferredLanguage: { type: "string", description: isHebrew ? "שפה מועדפת" : "Preferred language", enum: ["English", "Spanish", "Hebrew", "Other"] },
              healthFund: isIsrael ? { type: "string", description: "קופת חולים", enum: ["כללית", "מכבי", "מאוחדת", "לאומית"] } : undefined,
              insuranceProvider: isUSA ? { type: "string", description: "Insurance provider" } : undefined,
              insuranceNumber: isUSA ? { type: "string", description: "Insurance number" } : undefined,
              doctorSummary: { type: "string", description: isHebrew ? "סיכום רופא" : "Doctor summary" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status", enum: ["Active", "Inactive", "Deceased"] },
              dateOfBirth: { type: "string", description: isHebrew ? "תאריך לידה" : "Date of birth" }
            },
            required: []  // Either nationalId OR patientId needed, but not required to allow context usage
          }
        },

{
          name: "deletePatientBySearch", 
          description: isHebrew 
            ? "מחוק מטופל לפי שם או תעודת זהות"
            : (isUSA ? "Delete patient by name or SSN" : "Delete patient by name or national ID"),
          parameters: {
            type: "object",
            properties: {
              searchQuery: {
                type: "string",
                description: isHebrew
                  ? "שם המטופל או תעודת הזהות שלו"
                  : "Patient name or national ID"
              }
            },
            required: ["searchQuery"]
          }
        },

{
          name: "searchPatients",
          description: isHebrew
            ? "חפש מטופלים במערכת - תומך בטעויות כתיב! אם המשתמש כתב שם עם שגיאות, תשתמש בשם כמו שהוא והמערכת תמצא את המטופל הנכון אוטומטית"
            : "Search for patients - TYPO TOLERANT! If the user misspells a name (like 'Hellen' instead of 'Helen' or 'Richrd' instead of 'Richard'), use the name AS-IS. The system automatically handles typos, misspellings, and finds the correct patient.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: isHebrew
                  ? "שם המטופל בדיוק כפי שהמשתמש כתב אותו (כולל שגיאות כתיב). המערכת תמצא אוטומטית את המטופל הנכון"
                  : "Patient name EXACTLY as user typed it (including typos). System will automatically find the correct patient match"
              },
              filter: { type: "string", description: isHebrew ? "סינון (אופציונלי)" : "Filter (optional)" }
            },
            required: []
          }
        },

{
          name: "countPatients",
          description: isHebrew ? "ספור כמה מטופלים יש במערכת" : "Count total number of patients in the system",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },

{
          name: "searchPatientsByName",
          description: isHebrew
            ? "חפש מטופלים לפי שם - תומך בטעויות כתיב! השתמש בשם בדיוק כפי שהמשתמש כתב אותו"
            : "Search patients by name - TYPO TOLERANT! Use the name EXACTLY as the user typed it. System handles typos automatically (e.g., 'Hellen Cox' finds 'Helen Cox')",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: isHebrew
                  ? "שם המטופל בדיוק כפי שהמשתמש כתב (כולל שגיאות). המערכת תמצא את המטופל הנכון"
                  : "Patient name EXACTLY as user typed (including typos). System will find correct match"
              }
            },
            required: ["name"]
          }
        },

{
          name: "listAllPatients",
          description: isHebrew 
            ? "הצג רשימה של כל המטופלים במערכת"
            : "List all patients in the system",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: isHebrew ? "מספר מטופלים מקסימלי להציג (ברירת מחדל: 100)" : "Maximum number of patients to show (default: 100)" }
            },
            required: []
          }
        },

{
          name: "findPatient",
          description: isHebrew 
            ? "מצא מטופל לפי כל סוג של מידע - שם, תעודת זהות, טלפון, אימייל"
            : "Find patient by any information - name, ID, phone, email",
          parameters: {
            type: "object",
            properties: {
              searchQuery: { type: "string", description: isHebrew ? "כל מידע על המטופל" : "Any patient information" }
            },
            required: ["searchQuery"]
          }
        },

{
          name: "getPatientDetails",
          description: isHebrew
            ? "קבל פרטי מטופל מלאים - תומך בחיפוש לפי מזהה, שם, אימייל, תעודת זהות או SSN"
            : "Get complete patient details - supports flexible lookup by ID, name, email, national ID, or SSN. Returns demographics, contact info, insurance, emergency contacts, and medical information",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (MongoDB ID)" : "Patient ID (MongoDB ObjectId)" },
              firstName: { type: "string", description: isHebrew ? "שם פרטי" : "First name - for name-based lookup" },
              lastName: { type: "string", description: isHebrew ? "שם משפחה" : "Last name - for name-based lookup" },
              email: { type: "string", description: isHebrew ? "אימייל" : "Email address - alternative lookup method" },
              nationalId: { type: "string", description: isHebrew ? "תעודת זהות" : "National ID - alternative lookup method" },
              socialSecurityNumber: { type: "string", description: isHebrew ? "מספר ביטוח לאומי (SSN)" : "Social Security Number (SSN) - alternative lookup method" },
              ssn: { type: "string", description: isHebrew ? "SSN (חלופה ל-socialSecurityNumber)" : "SSN (alternative to socialSecurityNumber)" }
            },
            required: []  // At least ONE identifier needed (patientId OR firstName+lastName OR email OR nationalId OR ssn)
          }
        },

{
          name: "getPatientsNeedingFollowUp",
          description: isHebrew 
            ? "קבל רשימת מטופלים שצריכים מעקב"
            : "Get list of patients needing follow-up",
          parameters: {
            type: "object",
            properties: {
              dateRange: { 
                type: "string", 
                description: isHebrew ? "טווח תאריכים (today, week, month, overdue)" : "Date range (today, week, month, overdue)",
                enum: ["today", "week", "month", "overdue", "all"]
              },
              urgency: { 
                type: "string", 
                description: isHebrew ? "דחיפות המעקב" : "Follow-up urgency",
                enum: ["high", "medium", "low", "all"]
              },
              department: {
                type: "string",
                description: isHebrew ? "מחלקה ספציפית" : "Specific department"
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר מקסימלי של תוצאות" : "Maximum number of results"
              }
            },
            required: []
          }
        },

{
          name: "getPatientFollowUpDetails",
          description: isHebrew 
            ? "קבל פרטי מעקב עבור מטופל ספציפי"
            : "Get follow-up details for specific patient",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל" : "Patient ID"
              },
              includeHistory: {
                type: "boolean",
                description: isHebrew ? "כלול היסטוריית מעקבים קודמים" : "Include previous follow-up history"
              }
            },
            required: ["patientId"]
          }
        },

{
          name: "scheduleFollowUp",
          description: isHebrew
            ? "תזמן מעקב למטופל. השתמש בשדות appointmentDate ו-appointmentTime או followUpDate"
            : "Schedule a follow-up appointment for patient. Use appointmentDate and appointmentTime parameters to specify when, NOT followUpDate",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל" : "Patient ID"
              },
              appointmentDate: {
                type: "string",
                description: isHebrew
                  ? "תאריך התור (YYYY-MM-DD, לדוגמה: '2025-08-15'). השתמש בשדה זה עבור התאריך"
                  : "Appointment date (YYYY-MM-DD format, e.g., '2025-08-15'). Use this field for the date, NOT followUpDate"
              },
              appointmentTime: {
                type: "string",
                description: isHebrew
                  ? "שעת התור (HH:MM בפורמט 24 שעות, לדוגמה: '14:00', '09:30')"
                  : "Appointment time (HH:MM in 24-hour format, e.g., '14:00', '09:30')"
              },
              reason: {
                type: "string",
                description: isHebrew ? "סיבת המעקב" : "Reason for follow-up appointment"
              },
              specialty: {
                type: "string",
                description: isHebrew
                  ? "התמחות (לדוגמה: 'Cardiology', 'Neurology', 'Gastroenterology')"
                  : "Medical specialty (e.g., 'Cardiology', 'Neurology', 'Gastroenterology'). Optional"
              },
              urgency: {
                type: "string",
                description: isHebrew ? "דחיפות" : "Urgency level. Optional",
                enum: ["high", "medium", "low"]
              },
              department: {
                type: "string",
                description: isHebrew ? "מחלקה" : "Department. Optional"
              },
              notes: {
                type: "string",
                description: isHebrew ? "הערות נוספות" : "Additional notes. Optional"
              },
              followUpDate: {
                type: "string",
                description: isHebrew
                  ? "תאריך מעקב (פורמט ישן - legacy parameter). השתמש ב-appointmentDate + appointmentTime במקום"
                  : "Follow-up date (legacy parameter for backwards compatibility). Prefer using appointmentDate + appointmentTime instead. Format: ISO date string or YYYY-MM-DD"
              }
            },
            required: ["patientId", "appointmentDate", "appointmentTime", "reason"]
          }
        },

{
          name: "updateFollowUpStatus",
          description: isHebrew 
            ? "עדכן סטטוס מעקב"
            : "Update follow-up status",
          parameters: {
            type: "object",
            properties: {
              followUpId: { 
                type: "string", 
                description: isHebrew ? "מזהה מעקב" : "Follow-up ID"
              },
              status: {
                type: "string",
                description: isHebrew ? "סטטוס חדש" : "New status",
                enum: ["completed", "cancelled", "rescheduled", "no-show"]
              },
              completionNotes: {
                type: "string",
                description: isHebrew ? "הערות סיום" : "Completion notes"
              },
              newDate: {
                type: "string",
                description: isHebrew ? "תאריך חדש (אם נדחה)" : "New date (if rescheduled)"
              }
            },
            required: ["followUpId", "status"]
          }
        },

{
          name: "deleteFollowUp",
          description: isHebrew 
            ? "מחק מעקב"
            : "Delete follow-up",
          parameters: {
            type: "object",
            properties: {
              followUpId: { 
                type: "string", 
                description: isHebrew ? "מזהה מעקב" : "Follow-up ID"
              },
              reason: {
                type: "string",
                description: isHebrew ? "סיבת המחיקה" : "Reason for deletion"
              }
            },
            required: ["followUpId"]
          }
        },


{
          name: "addMedicalHistory",
          description: isHebrew
            ? "הוסף רשומה להיסטוריה רפואית של המטופל. תומך בקטגוריות שונות: consultation_notes, past_medical_history, surgical_history, family_history, social_history"
            : "Add medical history record for patient. Supports multiple categories: consultation_notes, past_medical_history, surgical_history, family_history, social_history",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew
                  ? "מזהה מטופל (אופציונלי אם יש בהקשר או משתמש ב-nationalId)"
                  : "Patient ID (optional if using nationalId or patient in context)"
              },
              nationalId: {
                type: "string",
                description: isHebrew
                  ? "תעודת זהות של המטופל (אלטרנטיבה ל-patientId, המערכת תמצא את המטופל)"
                  : "Patient's national ID/SSN (alternative to patientId, system will find patient)"
              },
              category: {
                type: "string",
                description: isHebrew
                  ? "קטגוריית ההיסטוריה הרפואית"
                  : "Medical history category (e.g., 'consultation_notes', 'past_medical_history', 'surgical_history', 'family_history', 'social_history'). Defaults to 'consultation_notes'",
                enum: ["consultation_notes", "past_medical_history", "surgical_history", "family_history", "social_history"]
              },
              date: {
                type: "string",
                description: isHebrew
                  ? "תאריך הרשומה (YYYY-MM-DD, ברירת מחדל: היום)"
                  : "Date of the record (YYYY-MM-DD format, e.g., '2025-10-31'). Defaults to today if not specified"
              },
              diagnosis: {
                type: "string",
                description: isHebrew
                  ? "אבחנה רפואית"
                  : "Medical diagnosis (e.g., 'Type 2 Diabetes', 'Hypertension', 'Asthma')"
              },
              symptoms: {
                type: "string",
                description: isHebrew
                  ? "תסמינים"
                  : "Symptoms described (e.g., 'Chest pain', 'Shortness of breath', 'Fatigue')"
              },
              treatment: {
                type: "string",
                description: isHebrew
                  ? "טיפול שניתן"
                  : "Treatment provided or recommended"
              },
              notes: {
                type: "string",
                description: isHebrew
                  ? "הערות נוספות"
                  : "Additional clinical notes or observations"
              },
              provider: {
                type: "string",
                description: isHebrew
                  ? "שם הרופא/ספק"
                  : "Provider name who created this record"
              }
            },
            required: []
          }
        },

{
          name: "updateMedicalHistory",
          description: isHebrew
            ? "עדכן רשומת היסטוריה רפואית קיימת"
            : "Update existing medical history record",
          parameters: {
            type: "object",
            properties: {
              nationalId: {
                type: "string",
                description: isHebrew
                  ? "תעודת זהות של המטופל"
                  : "Patient's national ID/SSN to identify the patient"
              },
              entryId: {
                type: "string",
                description: isHebrew
                  ? "מזהה הרשומה לעדכון"
                  : "Entry ID of the medical history record to update (required)"
              },
              diagnosis: {
                type: "string",
                description: isHebrew
                  ? "אבחנה מעודכנת"
                  : "Updated diagnosis"
              },
              symptoms: {
                type: "string",
                description: isHebrew
                  ? "תסמינים מעודכנים"
                  : "Updated symptoms"
              },
              treatment: {
                type: "string",
                description: isHebrew
                  ? "טיפול מעודכן"
                  : "Updated treatment"
              },
              notes: {
                type: "string",
                description: isHebrew
                  ? "הערות מעודכנות"
                  : "Updated notes"
              },
              status: {
                type: "string",
                description: isHebrew
                  ? "סטטוס (פעיל/לא פעיל)"
                  : "Status (active/inactive)"
              }
            },
            required: ["entryId"]
          }
        },

{
          name: "deleteMedicalHistory",
          description: isHebrew
            ? "מחק רשומת היסטוריה רפואית"
            : "Delete medical history record",
          parameters: {
            type: "object",
            properties: {
              nationalId: {
                type: "string",
                description: isHebrew
                  ? "תעודת זהות של המטופל"
                  : "Patient's national ID/SSN to identify the patient"
              },
              entryId: {
                type: "string",
                description: isHebrew
                  ? "מזהה הרשומה למחיקה"
                  : "Entry ID of the medical history record to delete (required)"
              },
              reason: {
                type: "string",
                description: isHebrew
                  ? "סיבת המחיקה"
                  : "Reason for deletion (for audit trail)"
              }
            },
            required: ["entryId"]
          }
        },

{
          name: "fuzzyPatientSearch",
          description: isHebrew
            ? "חיפוש מטופל עם תמיכה בשגיאות כתיב ושמות לא מדויקים. משתמש ב-AI לתיקון טעויות אוטומטי"
            : "Search for patient with typo-tolerant fuzzy matching. Uses AI to automatically correct spelling mistakes and find closest matches (e.g., 'Heln Cox' finds 'Helen Cox', 'Richrd Philips' finds 'Richard Phillips')",
          parameters: {
            type: "object",
            properties: {
              searchQuery: {
                type: "string",
                description: isHebrew
                  ? "שם המטופל לחיפוש (מספיק שם פרטי או משפחה, או שניהם עם שגיאות כתיב)"
                  : "Patient name to search for (can be first name, last name, or both, with typos or misspellings). Examples: 'Helen Cox', 'Heln Cox', 'Richrd Philips', 'Jon Smith'"
              }
            },
            required: ["searchQuery"]
          }
        },

{
          name: "anonymizePatientData",
          description: isHebrew
            ? "הסר מידע מזהה מנתוני מטופל לצורכי מחקר או שיתוף. מחזיר גרסה מוסתרת של הנתונים"
            : "Remove identifying information from patient data for research or sharing purposes. Returns anonymized version of patient data with PHI removed or pseudonymized",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew
                  ? "מזהה מטופל (MongoDB ObjectId או תעודת זהות)"
                  : "Patient ID (can be MongoDB ObjectId or national ID/SSN). Examples: '507f1f77bcf86cd799439011', '123-45-6789'"
              },
              purpose: {
                type: "string",
                description: isHebrew
                  ? "מטרת האנונימיזציה (research, sharing, analytics)"
                  : "Purpose of anonymization. Options: 'research' (default), 'sharing', 'analytics'. Determines level of data preservation",
                enum: ["research", "sharing", "analytics"]
              },
              dataTypes: {
                type: "array",
                items: { type: "string" },
                description: isHebrew
                  ? "שדות לשמור (לא להסתיר). למשל: ['gender', 'age', 'diagnosis']"
                  : "Fields to preserve (not anonymize). Examples: ['gender', 'age', 'diagnosis', 'medications']. These fields will remain visible in anonymized output"
              }
            },
            required: ["patientId"]
          }
        },

{
  name: "checkCollectionHasData",
  description: isHebrew
    ? "בדוק אם למטופל יש נתונים בקולקציה ספציפית. מחזיר true אם יש נתונים, false אם אין"
    : "Check if patient has data in a specific medical collection. Returns true if data exists, false if collection is empty. Use this before trying to fetch collection data to avoid empty results",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל (MongoDB ObjectId או תעודת זהות)"
          : "Patient ID (can be MongoDB ObjectId or national ID). Required to identify which patient's data to check. Example: '507f1f77bcf86cd799439011' or '123-45-6789'"
      },
      collectionName: {
        type: "string",
        description: isHebrew
          ? "שם הקולקציה לבדיקה (לדוגמה: 'labs', 'medications', 'vitals', 'allergies')"
          : "Medical collection name to check for data. Examples: 'labs', 'medications', 'vitals', 'allergies', 'diagnoses', 'imaging_results'. Use exact collection name from medical data structure"
      }
    },
    required: ["patientId", "collectionName"]
  }
},

{
  name: "deleteMedicalData",
  description: isHebrew
    ? "מחק נתונים רפואיים של מטופל בקטגוריה ספציפית או כל הנתונים. שימוש זהיר! פעולה בלתי הפיכה"
    : "Delete patient's medical data in a specific category or all data. Use with caution! This operation is irreversible. Returns summary of deleted collections and any failures",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל (MongoDB ObjectId או תעודת זהות)"
          : "Patient ID (can be MongoDB ObjectId or national ID). Required to identify which patient's data to delete. Example: '507f1f77bcf86cd799439011' or '123-45-6789'"
      },
      category: {
        type: "string",
        description: isHebrew
          ? "קטגוריית הנתונים למחיקה (אופציונלי, אם לא מצוין - מוחק הכל). לדוגמה: 'labs', 'medications', 'diagnoses'"
          : "Medical data category to delete (optional, if omitted deletes ALL data). Examples: 'labs' (delete only lab results), 'medications' (delete only medications), 'diagnoses' (delete only diagnoses). Leave empty to delete all medical data"
      }
    },
    required: ["patientId"]
  }
},

{
  name: "ensurePatientIdIndex",
  description: isHebrew
    ? "ודא שיש אינדקס על שדה patientId בקולקציה. משפר ביצועי שאילתות"
    : "Ensure patientId field has database index on a medical collection. Improves query performance for patient data lookups. Automatically creates index if not exists",
  parameters: {
    type: "object",
    properties: {
      collectionName: {
        type: "string",
        description: isHebrew
          ? "שם הקולקציה ליצירת אינדקס. לדוגמה: 'labs', 'medications', 'diagnoses'"
          : "Medical collection name to create index on. Examples: 'labs', 'medications', 'diagnoses', 'vitals', 'allergies', 'imaging_results'. Use exact collection name from medical data structure"
      }
    },
    required: ["collectionName"]
  }
},

{
  name: "getAIClinicalInsights",
  description: isHebrew
    ? "קבל תובנות קליניות מבוססות AI עבור מטופל. מנתח את כל הנתונים הרפואיים ומחזיר המלצות"
    : "Get AI-powered clinical insights for a patient. Analyzes all medical data and returns recommendations, risk assessments, and clinical decision support",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל (MongoDB ObjectId או תעודת זהות)"
          : "Patient ID (can be MongoDB ObjectId or national ID). Required to identify which patient to analyze. Example: '507f1f77bcf86cd799439011' or '123-45-6789'"
      }
    },
    required: ["patientId"]
  }
},

{
  name: "getCollectionsWithData",
  description: isHebrew
    ? "קבל רשימה של קולקציות שיש בהן נתונים עבור מטופל. מחזיר רק קולקציות לא ריקות"
    : "Get list of medical collections that have data for a patient. Returns only non-empty collections with record counts. Use this to discover what medical data exists for a patient",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל (MongoDB ObjectId או תעודת זהות)"
          : "Patient ID (can be MongoDB ObjectId or national ID). Required to identify which patient's collections to check. Example: '507f1f77bcf86cd799439011' or '123-45-6789'"
      }
    },
    required: ["patientId"]
  }
},

// REMOVED: getMedicalData - Agent should use specific functions like getCardiacRehabilitationReports, getMedications, etc.
// The generic getMedicalData was causing hasArtifactPanel: false because it bypasses the optimizedMedicalFunctions wrapper

{
  name: "syncActivePrescriptionToMedication",
  description: isHebrew
    ? "סנכרן מרשם פעיל לרשימת התרופות. מעדכן תרופות פעילות של מטופל"
    : "Sync active prescription to medication list. Updates patient's active medications from prescription. Automatically keeps medication list in sync with prescriptions",
  parameters: {
    type: "object",
    properties: {
      prescriptionId: {
        type: "string",
        description: isHebrew
          ? "מזהה מרשם (MongoDB ObjectId)"
          : "Prescription ID (MongoDB ObjectId). Required to identify which prescription to sync. Example: '507f1f77bcf86cd799439011'"
      },
      prescription: {
        type: "object",
        description: isHebrew
          ? "אובייקט מרשם (אופציונלי אם כבר מועבר)"
          : "Prescription object (optional if already passed). Contains medication details to sync"
      }
    },
    required: ["prescriptionId"]
  }
},

{
  name: "getDiagnoses",
  description: isHebrew
    ? "קבל רשימת אבחנות של מטופל. תומך בסינון לפי סטטוס ותאריך"
    : "Get patient's diagnosis list. Supports filtering by status (active/resolved/all) and date range. Returns diagnosis history with ICD codes",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל (MongoDB ObjectId או תעודת זהות)"
          : "Patient ID (can be MongoDB ObjectId or national ID). Required to identify which patient's diagnoses to retrieve. Example: '507f1f77bcf86cd799439011' or '123-45-6789'"
      },
      status: {
        type: "string",
        description: isHebrew
          ? "סטטוס אבחנה (active, resolved, all). ברירת מחדל: active"
          : "Diagnosis status filter (active, resolved, all). Default: active. Use 'active' for current diagnoses, 'resolved' for past diagnoses, 'all' for complete history",
        enum: ["active", "resolved", "all"]
      },
      limit: {
        type: "number",
        description: isHebrew ? "מספר תוצאות מקסימלי" : "Maximum number of results to return. Default: 50"
      }
    },
    required: ["patientId"]
  }
},

{
  name: "getVaccinations",
  description: isHebrew
    ? "קבל רשימת חיסונים של מטופל. מחזיר היסטוריית חיסונים"
    : "Get patient's vaccination records. Returns vaccination history with dates, vaccine types, and lot numbers. Includes immunization schedule tracking",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל (MongoDB ObjectId או תעודת זהות)"
          : "Patient ID (can be MongoDB ObjectId or national ID). Required to identify which patient's vaccination records to retrieve. Example: '507f1f77bcf86cd799439011' or '123-45-6789'"
      },
      vaccineType: {
        type: "string",
        description: isHebrew
          ? "סוג חיסון לסינון (אופציונלי). לדוגמה: 'COVID-19', 'Influenza', 'MMR'"
          : "Vaccine type to filter by (optional). Examples: 'COVID-19', 'Influenza', 'MMR', 'Tdap', 'Hepatitis B'. Leave empty for all vaccinations"
      },
      limit: {
        type: "number",
        description: isHebrew ? "מספר תוצאות מקסימלי" : "Maximum number of results to return. Default: 50"
      }
    },
    required: ["patientId"]
  }
},

{
  name: "cleanupAppointmentReferences",
  description: isHebrew
    ? "נקה התייחסויות לפגישה מרשומות קשורות. מוחק התייחסויות אחרי ביטול פגישה"
    : "Clean up appointment references from related records. Removes appointment references from provider and patient schedules after cancellation. Maintains data consistency",
  parameters: {
    type: "object",
    properties: {
      appointmentId: {
        type: "string",
        description: isHebrew
          ? "מזהה פגישה (MongoDB ObjectId)"
          : "Appointment ID (MongoDB ObjectId). Required to identify which appointment references to clean. Example: '507f1f77bcf86cd799439011'"
      },
      providerId: {
        type: "string",
        description: isHebrew
          ? "מזהה רופא (אופציונלי). אם מסופק, ניקוי ממוקד"
          : "Provider ID (optional). If provided, only cleans references from this provider's schedule. Example: '507f1f77bcf86cd799439011'"
      },
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל (אופציונלי). אם מסופק, ניקוי ממוקד"
          : "Patient ID (optional). If provided, only cleans references from this patient's appointments. Example: '507f1f77bcf86cd799439011'"
      }
    },
    required: ["appointmentId"]
  }
},

{
  name: "lookupDoctor",
  description: isHebrew
    ? "חפש רופא לפי שם, אימייל, או מזהה. מחזיר מידע על הרופא"
    : "Look up a doctor by name, email, or ID. Returns doctor information including specialties, schedule, and contact details. Supports fuzzy name matching",
  parameters: {
    type: "object",
    properties: {
      nameOrEmailOrId: {
        type: "string",
        description: isHebrew
          ? "שם, אימייל, או מזהה של הרופא. לדוגמה: 'Dr. Smith', 'smith@clinic.com', או '507f1f77bcf86cd799439011'"
          : "Provider name, email, or ID to search for. Examples: 'Dr. Smith' (name), 'smith@clinic.com' (email), '507f1f77bcf86cd799439011' (MongoDB ObjectId). Supports partial name matching"
      }
    },
    required: ["nameOrEmailOrId"]
  }
},

{
  name: "storeExtractedMedicalData",
  description: isHebrew
    ? "שמור נתונים רפואיים מחולצים ממסמך. מקשר לתיעוד המקור"
    : "Store extracted medical data from a document. Links data to source document for traceability. Automatically categorizes and indexes extracted information",
  parameters: {
    type: "object",
    properties: {
      extractedData: {
        type: "object",
        description: isHebrew
          ? "אובייקט נתונים מחולצים עם קטגוריות (labs, medications, diagnoses, וכו')"
          : "Extracted data object with categories. Example: { labs: [{...}], medications: [{...}], diagnoses: [{...}] }. Each category contains array of extracted records"
      },
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל (MongoDB ObjectId או תעודת זהות)"
          : "Patient ID (can be MongoDB ObjectId or national ID). Required to identify which patient this data belongs to. Example: '507f1f77bcf86cd799439011'"
      },
      documentId: {
        type: "string",
        description: isHebrew
          ? "מזהה מסמך מקור (MongoDB ObjectId)"
          : "Source document ID (MongoDB ObjectId). Required to link extracted data to original document for audit trail. Example: '507f1f77bcf86cd799439011'"
      }
    },
    required: ["extractedData", "patientId", "documentId"]
  }
},

{
  name: "storeMedicalData",
  description: isHebrew
    ? "שמור נתונים רפואיים בקטגוריה ספציפית. API כללי לשמירת נתונים"
    : "Store medical data in a specific category. General-purpose API for saving medical records. Validates data format and creates audit trail",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew ? "מזהה מטופל" : "Patient ID"
      },
      documentId: {
        type: "string",
        description: isHebrew ? "מזהה מסמך" : "Document ID (optional, links data to source document)"
      },
      extractedData: {
        type: "object",
        description: isHebrew
          ? "נתונים שחולצו מהמסמך"
          : "Extracted data from document processing. Contains parsed medical information"
      },
      category: {
        type: "string",
        description: isHebrew
          ? "קטגוריית הנתונים. לדוגמה: 'labs', 'medications', 'diagnoses'"
          : "Medical data category to store in. Examples: 'labs' (laboratory results), 'medications' (medication records), 'diagnoses' (diagnosis records), 'vitals' (vital signs). Use exact category name"
      },
      data: {
        type: "object",
        description: isHebrew
          ? "אובייקט נתונים לשמירה. חייב להתאים למבנה הקטגוריה"
          : "Data object to store. Must match category schema. Example for labs: { testName: 'CBC', result: '...' }, for medications: { name: 'Aspirin', dosage: '81mg' }"
      }
    },
    required: ["patientId", "extractedData"]
  }
},

{
  name: "addMedication",
  description: isHebrew
    ? "הוסף תרופה חדשה לרשימת התרופות של מטופל"
    : "Add new medication to patient's medication list. Records medication name, dosage, frequency, and prescribing information",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל"
          : "Patient ID. Required to identify which patient. Example: '507f1f77bcf86cd799439011'"
      },
      name: {
        type: "string",
        description: isHebrew
          ? "שם התרופה"
          : "Medication name. Example: 'Aspirin', 'Lisinopril'"
      },
      dosage: {
        type: "string",
        description: isHebrew
          ? "מינון"
          : "Dosage amount. Example: '81mg', '10mg', '500mg'"
      },
      frequency: {
        type: "string",
        description: isHebrew
          ? "תדירות נטילה"
          : "Frequency of administration. Example: 'once daily', 'twice daily', 'as needed'"
      }
    },
    required: ["patientId", "name"]
  }
},

{
  name: "createPrescriptions",
  description: isHebrew
    ? "צור מרשם חדש למטופל - תומך בשני פורמטים: medications array או שדות בודדים"
    : "Create new prescription for patient. Supports TWO formats: (1) medications array OR (2) individual medication fields for single medication",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל (חובה)"
          : "Patient ID (required). Example: '507f1f77bcf86cd799439011'"
      },
      medications: {
        type: "array",
        items: { type: "object" },
        description: isHebrew
          ? "רשימת תרופות (פורמט 1) - השתמש בזה למספר תרופות"
          : "Array of medications (Format 1) - Use for multiple medications. Example: [{ medicationName: 'Aspirin', dosage: '81mg', frequency: 'daily' }]"
      },
      medicationName: {
        type: "string",
        description: isHebrew
          ? "שם תרופה (פורמט 2) - השתמש בזה לתרופה בודדת במקום medications array"
          : "Medication name (Format 2) - Use for single medication instead of medications array"
      },
      name: {
        type: "string",
        description: isHebrew
          ? "שם תרופה (פורמט 2) - חלופה ל-medicationName"
          : "Medication name (Format 2) - Alternative to medicationName"
      },
      genericName: {
        type: "string",
        description: isHebrew
          ? "שם גנרי (פורמט 2)"
          : "Generic medication name (Format 2)"
      },
      dosage: {
        type: "string",
        description: isHebrew
          ? "מינון (פורמט 2) - לדוגמה: '500mg'"
          : "Dosage (Format 2). Example: '500mg', '1 tablet'"
      },
      strength: {
        type: "string",
        description: isHebrew
          ? "עוצמה (פורמט 2)"
          : "Medication strength (Format 2). Example: '250mg'"
      },
      unit: {
        type: "string",
        description: isHebrew
          ? "יחידה (פורמט 2)"
          : "Dosage unit (Format 2). Example: 'mg', 'ml', 'tablets'"
      },
      frequency: {
        type: "string",
        description: isHebrew
          ? "תדירות (פורמט 2) - לדוגמה: 'daily', 'twice daily'"
          : "Frequency (Format 2). Example: 'daily', 'twice daily', 'every 6 hours'"
      },
      route: {
        type: "string",
        description: isHebrew
          ? "דרך מתן (פורמט 2)"
          : "Route of administration (Format 2). Example: 'oral', 'IV', 'topical'"
      },
      duration: {
        type: "string",
        description: isHebrew
          ? "משך הטיפול (פורמט 2)"
          : "Treatment duration (Format 2). Example: '7 days', '2 weeks'"
      },
      indication: {
        type: "string",
        description: isHebrew
          ? "סיבה קלינית למרשם"
          : "Clinical indication for medication. Example: 'Atrial fibrillation stroke prevention', 'Type 2 diabetes management'"
      },
      instructions: {
        type: "string",
        description: isHebrew
          ? "הוראות למטופל"
          : "Patient instructions for medication. Example: 'Take with food', 'Avoid alcohol', 'Take at bedtime'"
      },
      prescriber: {
        type: "string",
        description: isHebrew
          ? "שם רופא מרשם"
          : "Prescriber name. Example: 'Dr. Thomas Chen, MD, FACC'"
      },
      providerId: {
        type: "string",
        description: isHebrew
          ? "מזהה רופא מרשם"
          : "Prescribing provider ID. Example: '507f1f77bcf86cd799439011'"
      },
      drugInteractions: {
        type: "string",
        description: isHebrew
          ? "אינטראקציות תרופתיות ידועות"
          : "Known drug interactions or warnings. Example: 'May interact with warfarin', 'Avoid NSAIDs'"
      },
      safetyWarning: {
        type: "string",
        description: isHebrew
          ? "אזהרות בטיחות"
          : "Safety warnings or precautions. Example: 'Bleeding risk - monitor INR', 'May cause dizziness'"
      },
      documentId: {
        type: "string",
        description: isHebrew
          ? "מזהה מסמך מקור (אם רלוונטי)"
          : "Source document ID if prescription created from document analysis"
      }
    },
    required: ["patientId"]  // Either medications OR (medicationName/name + other fields)
  }
},

{
  name: "getPrescriptions",
  description: isHebrew
    ? "קבל רשימת מרשמים של מטופל. תומך בחיפוש לפי תעודת זהות או מזהה מטופל"
    : "Get patient's prescription list. Returns active and historical prescriptions with medication details. Supports lookup by national ID or patient ID",
  parameters: {
    type: "object",
    properties: {
      nationalId: {
        type: "string",
        description: isHebrew
          ? "תעודת זהות של המטופל - המערכת תמצא את המטופל אוטומטית"
          : "Patient's national ID - System will find patient automatically"
      },
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל מהמערכת (MongoDB ID)"
          : "Patient ID from system (MongoDB ID). Example: '507f1f77bcf86cd799439011'"
      },
      status: {
        type: "string",
        description: isHebrew
          ? "סטטוס מרשם (active, expired, all)"
          : "Prescription status filter. Options: 'active', 'expired', 'all'. Default: 'active'",
        enum: ["active", "expired", "all"]
      }
    },
    required: []  // Either nationalId OR patientId needed
  }
},

{
  name: "updatePrescriptions",
  description: isHebrew
    ? "עדכן מרשם קיים"
    : "Update existing prescription. Modify medications, dosages, or prescription status",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew ? "מזהה מטופל" : "Patient ID"
      },
      recordId: {
        type: "string",
        description: isHebrew ? "מזהה רשומה" : "Record ID (prescription record to update)"
      },
      medicationName: {
        type: "string",
        description: isHebrew ? "שם תרופה" : "Medication name"
      },
      prescriptionId: {
        type: "string",
        description: isHebrew
          ? "מזהה מרשם"
          : "Prescription ID to update. Required. Example: '507f1f77bcf86cd799439011'"
      },
      updates: {
        type: "object",
        description: isHebrew
          ? "שדות לעדכון"
          : "Fields to update. Example: { status: 'inactive', medications: [...] }"
      }
    },
    required: ["updates"]
  }
},

{
  name: "getImagingResults",
  description: isHebrew
    ? "קבל תוצאות הדמיה של מטופל"
    : "Get patient's imaging results. Returns X-rays, MRIs, CT scans, and other imaging studies with reports",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל"
          : "Patient ID. Required. Example: '507f1f77bcf86cd799439011'"
      },
      imagingType: {
        type: "string",
        description: isHebrew
          ? "סוג הדמיה (X-Ray, MRI, CT, Ultrasound)"
          : "Imaging type filter. Examples: 'X-Ray', 'MRI', 'CT', 'Ultrasound'. Leave empty for all types"
      },
      dateFrom: {
        type: "string",
        description: isHebrew
          ? "תאריך התחלה"
          : "Start date filter. Format: YYYY-MM-DD. Example: '2024-01-01'"
      },
      dateTo: {
        type: "string",
        description: isHebrew
          ? "תאריך סיום"
          : "End date filter. Format: YYYY-MM-DD. Example: '2025-10-31'"
      }
    },
    required: ["patientId"]
  }
},

{
  name: "getPatientConsents",
  description: isHebrew
    ? "קבל הסכמות מטופל"
    : "Get patient consents. Returns patient consent records for treatments, data sharing, and privacy agreements",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל"
          : "Patient ID. Required. Example: '507f1f77bcf86cd799439011'"
      },
      consentType: {
        type: "string",
        description: isHebrew
          ? "סוג הסכמה (treatment, data_sharing, privacy)"
          : "Consent type filter. Examples: 'treatment', 'data_sharing', 'privacy'. Leave empty for all types"
      }
    },
    required: ["patientId"]
  }
},

{
  name: "getPatientsList",
  description: isHebrew
    ? "קבל רשימת מטופלים"
    : "Get list of patients. Returns patient directory with basic demographics. Supports filtering and pagination",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: isHebrew
          ? "מספר תוצאות מקסימלי"
          : "Maximum number of results. Default: 50. Example: 100"
      },
      offset: {
        type: "number",
        description: isHebrew
          ? "תזוזה לפאגינציה"
          : "Offset for pagination. Default: 0. Example: 50"
      },
      search: {
        type: "string",
        description: isHebrew
          ? "חיפוש לפי שם או תעודת זהות"
          : "Search query for name or ID. Example: 'John', 'Smith', '123-45-6789'"
      }
    }
  }
},

{
  name: "listPatientMedicalCategories",
  description: isHebrew
    ? "רשום קטגוריות רפואיות זמינות למטופל"
    : "List available medical data categories for patient. Returns which types of medical data exist (labs, medications, diagnoses, etc.)",
  parameters: {
    type: "object",
    properties: {
      patientId: {
        type: "string",
        description: isHebrew
          ? "מזהה מטופל"
          : "Patient ID. Required. Example: '507f1f77bcf86cd799439011'"
      }
    },
    required: ["patientId"]
  }
},

{
  name: "updateExistingCollections",
  description: isHebrew
    ? "עדכן קולקציות קיימות במערכת. פעולת תחזוקה"
    : "Update existing medical collections in the system. Maintenance operation for refreshing collection metadata and indexes. Admin function",
  parameters: {
    type: "object",
    properties: {}
  }
},

{
  name: "initialize",
  description: isHebrew
    ? "אתחל את שירות הנתונים הרפואיים. נדרש בהפעלה"
    : "Initialize medical data service. Required on startup. Sets up database connections, collection mappings, and indexes for medical data access",
  parameters: {
    type: "object",
    properties: {}
  }
},

{
          // Renamed from "searchPatients" (June 2026): the name collided with the
          // typo-tolerant name search above; the registry's last-wins dedup made the
          // model see THIS schema while the dispatcher executed the name search,
          // silently ignoring all criteria args. Wired to searchPatientsUniversal.
          name: "searchPatientsByCriteria",
          description: isHebrew
            ? "חיפוש מטופלים מתקדם לפי קריטריונים קליניים - מצבים רפואיים, תרופות, אלרגיות, גיל, מיקום (מחזיר שמות ותעודות זהות בלבד). לחיפוש לפי שם השתמש ב-searchPatients"
            : "Advanced patient search by CLINICAL CRITERIA - medical conditions, medications, allergies, age range, location, gender (returns names and IDs only). For searching by patient NAME use searchPatients/searchPatientsByName instead",
          parameters: {
            type: "object",
            properties: {
              medicalConditions: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "מצבים רפואיים לחיפוש" : "Medical conditions to search for"
              },
              medications: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "תרופות לחיפוש" : "Medications to search for"
              },
              allergies: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "אלרגיות לחיפוש" : "Allergies to search for"
              },
              ageRange: {
                type: "object",
                properties: {
                  min: { type: "number" },
                  max: { type: "number" }
                },
                description: isHebrew ? "טווח גילאים" : "Age range"
              },
              location: {
                type: "object",
                properties: {
                  city: { type: "string" },
                  state: { type: "string" },
                  zipCode: { type: "string" }
                },
                description: isHebrew ? "מיקום גיאוגרפי" : "Geographic location"
              },
              gender: {
                type: "string",
                enum: ["Male", "Female"],
                description: isHebrew ? "מין" : "Gender"
              },
              page: {
                type: "number",
                default: 1,
                description: isHebrew ? "מספר עמוד" : "Page number"
              },
              batchSize: {
                type: "number",
                default: 50,
                maximum: 100,
                description: isHebrew ? "גודל אצווה" : "Batch size"
              },
              mode: {
                type: "string",
                enum: ["fresh", "progressive"],
                description: isHebrew ? "מצב חיפוש - fresh מתחיל חדש, progressive מסנן קודם" : "Search mode - fresh starts new, progressive filters previous"
              }
            },
            required: []
          }
        },

{
          name: "getPatientsForFollowUp",
          description: isHebrew
            ? "קבל רשימת מטופלים הזקוקים למעקב"
            : "Get patients requiring follow-up",
          parameters: {
            type: "object",
            properties: {
              condition: {
                type: "string",
                description: isHebrew ? "מצב רפואי ספציפי (אופציונלי)" : "Specific medical condition (optional)"
              },
              dateRange: {
                type: "string",
                enum: ["today", "week", "month", "overdue"],
                description: isHebrew ? "טווח זמן" : "Date range"
              },
              urgentOnly: {
                type: "boolean",
                description: isHebrew ? "רק מקרים דחופים" : "Urgent cases only"
              },
              provider: {
                type: "string",
                description: isHebrew ? "רופא מטפל" : "Managing provider"
              }
            },
            required: []
          }
        },

{
          name: "addPatientCondition",
          description: isHebrew
            ? "הוסף מצב רפואי למטופל"
            : "Add medical condition to patient",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל" : "Patient ID"
              },
              condition: {
                type: "string",
                description: isHebrew ? "שם המצב הרפואי" : "Condition name"
              },
              icdCode: {
                type: "string",
                description: isHebrew ? "קוד ICD" : "ICD code"
              },
              diagnosisDate: {
                type: "string",
                description: isHebrew ? "תאריך אבחון" : "Diagnosis date"
              },
              severity: {
                type: "string",
                enum: ["mild", "moderate", "severe", "critical"],
                description: isHebrew ? "חומרת המצב" : "Severity"
              },
              status: {
                type: "string",
                enum: ["active", "chronic", "resolved"],
                description: isHebrew ? "סטטוס" : "Status"
              },
              followUpRequired: {
                type: "boolean",
                description: isHebrew ? "נדרש מעקב" : "Follow-up required"
              },
              nextFollowUp: {
                type: "string",
                description: isHebrew ? "תאריך מעקב הבא" : "Next follow-up date"
              },
              managingProvider: {
                type: "string",
                description: isHebrew ? "רופא מטפל" : "Managing provider"
              }
            },
            required: ["patientId", "condition"]
          }
        },

{
          name: "updatePatientCondition",
          description: isHebrew
            ? "עדכן מצב רפואי של מטופל"
            : "Update patient medical condition",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל" : "Patient ID"
              },
              condition: {
                type: "string",
                description: isHebrew ? "שם המצב לעדכון" : "Condition to update"
              },
              updates: {
                type: "object",
                description: isHebrew ? "שדות לעדכון" : "Fields to update"
              }
            },
            required: ["patientId", "condition", "updates"]
          }
        },

{
          name: "getPatientConditions",
          description: isHebrew
            ? "קבל רשימת מצבים רפואיים של מטופל"
            : "Get patient medical conditions",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל" : "Patient ID"
              },
              activeOnly: {
                type: "boolean",
                description: isHebrew ? "רק מצבים פעילים" : "Active conditions only"
              }
            },
            required: ["patientId"]
          }
        },

{
          name: "getConditionStatistics",
          description: isHebrew
            ? "קבל סטטיסטיקות על מצבים רפואיים"
            : "Get medical condition statistics",
          parameters: {
            type: "object",
            properties: {
              condition: {
                type: "string",
                description: isHebrew ? "מצב רפואי ספציפי (אופציונלי)" : "Specific condition (optional)"
              },
              dateRange: {
                type: "string",
                enum: ["all", "month", "quarter", "year"],
                description: isHebrew ? "טווח זמן" : "Date range"
              }
            },
            required: []
          }
        },

{
          name: "analyzeSymptoms",
          description: isHebrew 
            ? "נתח סימפטומים ותן אבחנה רפואית מקיפה באמצעות Gemini AI"
            : "Analyze symptoms and provide comprehensive medical diagnosis using Gemini AI",
          parameters: {
            type: "object",
            properties: {
              patientId: { 
                type: "string", 
                description: isHebrew ? "מזהה מטופל" : "Patient ID" 
              },
              nationalId: { 
                type: "string", 
                description: isHebrew 
                  ? "תעודת זהות של המטופל - השתמש בזה! המערכת תמצא את המטופל אוטומטית"
                  : "Patient's national ID - USE THIS! System will find patient automatically"
              },
              symptoms: { 
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "רשימת הסימפטומים שהמטופל מתאר" : "List of symptoms the patient describes" 
              },
              duration: { 
                type: "string", 
                description: isHebrew ? "משך הסימפטומים (למשל: 3 ימים, שבוע)" : "Duration of symptoms (e.g., 3 days, a week)" 
              },
              severity: { 
                type: "string", 
                description: isHebrew ? "חומרת הסימפטומים" : "Severity of symptoms",
                enum: ["mild", "moderate", "severe"]
              },
              additionalInfo: { 
                type: "string", 
                description: isHebrew ? "מידע נוסף רלוונטי" : "Additional relevant information" 
              }
            },
            required: ["symptoms"]
          }
        },

{
          name: "analyzeUploadedDocuments",
          description: isHebrew
            ? "נתח מסמכים רפואיים שהועלו - השתמש בפונקציה זו כאשר המשתמש אומר 'נתח', 'עבד מסמכים', או 'זהה נתונים במסמכים'"
            : "Analyze uploaded medical documents - USE THIS when user says 'analyze', 'process documents', or 'extract data from documents'",
          parameters: {
            type: "object",
            properties: {
              uploadId: {
                type: "string",
                description: isHebrew
                  ? "מזהה ההעלאה של המסמכים (חובה)"
                  : "Upload ID of the documents (required)"
              },
              patientId: {
                type: "string",
                description: isHebrew
                  ? "מזהה המטופל אם ידוע"
                  : "Patient ID if known"
              }
            },
            required: ["uploadId"]
          }
        },

{
          name: "importPatientsFromCSV",
          description: isHebrew 
            ? "ייבא רשימת מטופלים מקובץ CSV שהועלה"
            : "Import a list of patients from an uploaded CSV file",
          parameters: {
            type: "object",
            properties: {
              uploadId: { 
                type: "string", 
                description: isHebrew 
                  ? "מזהה ההעלאה של קובץ ה-CSV"
                  : "Upload ID of the CSV file"
              },
              fileIndex: { 
                type: "number", 
                description: isHebrew 
                  ? "אינדקס הקובץ ברשימת הקבצים שהועלו (ברירת מחדל: 0)"
                  : "Index of the file in the uploaded files list (default: 0)"
              },
              mappings: {
                type: "object",
                description: isHebrew 
                  ? "מיפוי עמודות CSV לשדות מטופל (אופציונלי - ינסה לזהות אוטומטית)"
                  : "CSV column to patient field mappings (optional - will try to auto-detect)",
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  nationalId: { type: "string" },
                  socialSecurityNumber: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  dateOfBirth: { type: "string" },
                  gender: { type: "string" },
                  bloodType: { type: "string" },
                  street: { type: "string" },
                  city: { type: "string" },
                  state: { type: "string" },
                  zipCode: { type: "string" },
                  country: { type: "string" },
                  allergies: { type: "string" },
                  emergencyContact: { type: "string" },
                  emergencyContactPhone: { type: "string" },
                  insuranceProvider: { type: "string" },
                  insuranceNumber: { type: "string" },
                  preferredLanguage: { type: "string" },
                  status: { type: "string" },
                  doctorSummary: { type: "string" },
                  healthFund: { type: "string" }
                }
              }
            },
            required: ["uploadId"]
          }
        },

{
          name: "importUsersFromCSV",
          description: isHebrew 
            ? "ייבא רשימת משתמשים (רופאים, אחיות, צוות) מקובץ CSV שהועלה"
            : "Import a list of users (doctors, nurses, staff) from an uploaded CSV file",
          parameters: {
            type: "object",
            properties: {
              uploadId: { 
                type: "string", 
                description: isHebrew 
                  ? "מזהה ההעלאה של קובץ ה-CSV"
                  : "Upload ID of the CSV file"
              },
              fileIndex: { 
                type: "number", 
                description: isHebrew 
                  ? "אינדקס הקובץ ברשימת הקבצים שהועלו (ברירת מחדל: 0)"
                  : "Index of the file in the uploaded files list (default: 0)"
              },
              mappings: {
                type: "object",
                description: isHebrew 
                  ? "מיפוי שדות CSV לשדות משתמש (אופציונלי - יוחזר לאישור אם לא סופק)"
                  : "Mapping of CSV fields to user fields (optional - will return for confirmation if not provided)"
              }
            },
            required: ["uploadId"]
          }
        },

{
          name: "recommendTreatment",
          description: isHebrew 
            ? "המלץ על טיפול מתאים"
            : "Recommend appropriate treatment",
          parameters: {
            type: "object",
            properties: {
              diagnosis: { type: "string", description: isHebrew ? "אבחנה" : "Diagnosis" },
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              allergies: { type: "array", items: { type: "string" }, description: isHebrew ? "אלרגיות" : "Allergies" },
              currentMedications: { type: "array", items: { type: "string" }, description: isHebrew ? "תרופות נוכחיות" : "Current medications" }
            },
            required: ["diagnosis"]
          }
        },

{
          name: "checkDrugInteractions",
          description: isHebrew
            ? "בדוק אינטראקציות בין תרופות - חובה לספק רשימת תרופות"
            : "Check drug interactions between medications. IMPORTANT: You must provide the medications array. If you only have patientId, first fetch the patient's medications using getMedications, then call this function with the medications list.",
          parameters: {
            type: "object",
            properties: {
              medications: {
                type: "array",
                items: { type: "string" },
                description: isHebrew
                  ? "רשימת תרופות לבדיקה (חובה) - לדוגמה: ['Apixaban 5mg', 'Metoprolol 50mg', 'Lisinopril 20mg']"
                  : "REQUIRED: Array of medication names to check for interactions. Example: ['Apixaban 5mg', 'Metoprolol 50mg', 'Lisinopril 20mg']. If you don't have the medications list, fetch it first using getMedications(patientId)."
              },
              patientId: {
                type: "string",
                description: isHebrew
                  ? "מזהה מטופל (אופציונלי) - לשימוש עם medications"
                  : "Patient ID (optional) - used with medications array for context"
              }
            },
            required: ["medications"]
          }
        },

{
          name: "getDrugByNDC",
          description: isHebrew
            ? "חפש תרופה לפי מספר NDC (קוד תרופה לאומי) - מאפשר חיפוש מדויק על ידי מספר NDC"
            : "Look up drug information by NDC number (National Drug Code) - allows exact lookup using NDC number. Use this when you have the specific NDC code.",
          parameters: {
            type: "object",
            properties: {
              ndcNumber: {
                type: "string",
                description: isHebrew
                  ? "מספר NDC של התרופה (10-11 ספרות, לדוגמה: '0069-0155-07')"
                  : "Drug NDC number (10-11 digits, e.g., '0069-0155-07' or '00690155007')"
              }
            },
            required: ["ndcNumber"]
          }
        },

{
          name: "checkDrugSafety",
          description: isHebrew
            ? "בדוק בטיחות תרופה - מנתח אירועים שליליים, החזרות תרופות, וציון בטיחות. מחזיר רמת סיכון (LOW/MEDIUM/HIGH) ואזהרות בטיחות. השתמש בזה לפני רישום תרופות."
            : "Check drug safety profile - analyzes adverse events, recalls, and calculates safety score (0-100). Returns risk level (LOW/MEDIUM/HIGH) and safety alerts. Use this before prescribing medications.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew
                  ? "שם התרופה לבדיקת בטיחות (לדוגמה: 'Lisinopril', 'Metformin')"
                  : "Drug name to check safety for (e.g., 'Lisinopril', 'Metformin')"
              },
              limit: {
                type: "number",
                description: isHebrew
                  ? "מספר אירועי בטיחות לבדיקה (ברירת מחדל: 100)"
                  : "Number of safety events to check (default: 100)"
              }
            },
            required: ["drugName"]
          }
        },

// ─── RxNorm/RxNav Drug Nomenclature Tools (NLM) ───────────────
        {
          name: "searchDrug",
          description: isHebrew
            ? "חפש תרופה לפי שם - מחזיר שם סטנדרטי, קוד RxCUI, מרכיבים, מותגים, ותרופות גנריות. מטפל בשגיאות כתיב. לדוגמה: searchDrug('liptor') → Lipitor (atorvastatin)"
            : "Search for a drug by name using NLM RxNorm database. Returns standardized name, RxCUI code, and handles misspellings with fuzzy matching. Example: searchDrug('liptor') → finds Lipitor. Use this when patient or provider mentions a drug name.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew
                  ? "שם התרופה לחיפוש (לדוגמה: 'Lisinopril', 'liptor', 'metformin')"
                  : "Drug name to search for (e.g., 'Lisinopril', 'liptor', 'metformin'). Can include misspellings - fuzzy matching is supported."
              }
            },
            required: ["drugName"]
          }
        },

        {
          name: "getDrugAlternatives",
          description: isHebrew
            ? "מצא חלופות גנריות לתרופה ממותגת, או מותגים עבור תרופה גנרית. לדוגמה: getDrugAlternatives({ rxcui: '153165', type: 'brand-to-generic' }) → מחזיר חלופות גנריות ל-Lipitor"
            : "Find generic alternatives for a brand name drug, or brand options for a generic drug. Requires the RxCUI code (get it from searchDrug first). Use type 'brand-to-generic' or 'generic-to-brands'.",
          parameters: {
            type: "object",
            properties: {
              rxcui: {
                type: "string",
                description: isHebrew
                  ? "קוד RxCUI של התרופה (ניתן לקבל מ-searchDrug)"
                  : "RxCUI code of the drug (get this from searchDrug result). Example: '153165' for Lipitor"
              },
              type: {
                type: "string",
                enum: ["brand-to-generic", "generic-to-brands"],
                description: isHebrew
                  ? "סוג חיפוש: 'brand-to-generic' למציאת גנריות, 'generic-to-brands' למציאת מותגים"
                  : "Search type: 'brand-to-generic' to find generic alternatives, 'generic-to-brands' to find brand name options"
              }
            },
            required: ["rxcui", "type"]
          }
        },

        {
          name: "getDrugClass",
          description: isHebrew
            ? "קבל את הסיווג הטיפולי של תרופה (לדוגמה: מעכב ACE, חוסם בטא, סטטין). משתמש בסיווגי ATC ו-MESH."
            : "Get the therapeutic class of a drug (e.g., ACE inhibitor, beta-blocker, statin). Uses ATC and MESH classifications from NLM. Example: getDrugClass('metformin') → Biguanides, Antidiabetic Agents.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew
                  ? "שם התרופה (לדוגמה: 'metformin', 'lisinopril', 'atorvastatin')"
                  : "Drug name (e.g., 'metformin', 'lisinopril', 'atorvastatin')"
              }
            },
            required: ["drugName"]
          }
        },

        {
          name: "normalizeDrugName",
          description: isHebrew
            ? "המר שם תרופה חופשי לצורה סטנדרטית עם קוד RxCUI. מטפל בשגיאות כתיב ווריאציות. לדוגמה: normalizeDrugName('liptor 20mg') → Lipitor (atorvastatin), RxCUI: 153165"
            : "Convert a free-text drug name to its standardized RxNorm form with RxCUI code. Handles misspellings and variations. Example: 'liptor 20mg' → Lipitor (atorvastatin). Use this to standardize medication names in patient records.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew
                  ? "שם התרופה (טקסט חופשי, לדוגמה: 'liptor 20mg', 'lisinipril')"
                  : "Free-text drug name (e.g., 'liptor 20mg', 'lisinipril', 'metformin 500'). Can include misspellings."
              }
            },
            required: ["drugName"]
          }
        },

        // ─── End RxNorm Tools ──────────────────────────────────────────

        // ─── DailyMed Drug Labeling Tools (NLM) ─────────────────────────
{
          name: "getDrugPrescribingInfo",
          description: isHebrew
            ? "קבל מידע רשמי מלא על תרופה מה-FDA - כולל מינון, אזהרות, התוויות נגד, אינטראקציות. משתמש ב-DailyMed של ה-NLM."
            : "Get the official FDA prescribing information for a drug from NLM DailyMed. Returns key sections: indications, dosage, warnings, contraindications, drug interactions, adverse reactions. Use this for comprehensive drug information queries.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה (לדוגמה: 'Warfarin', 'Metformin')" : "Drug name (e.g., 'Warfarin', 'Metformin', 'Lisinopril')"
              }
            },
            required: ["drugName"]
          }
        },

{
          name: "getDrugBlackBoxWarning",
          description: isHebrew
            ? "קבל אזהרות קופסה שחורה (boxed warning) של תרופה - האזהרות החמורות ביותר של ה-FDA. כולל גם התוויות נגד."
            : "Get boxed (black box) warnings for a drug - the most serious FDA safety warnings. Also returns contraindications. Use when asked about drug dangers, serious warnings, or safety alerts.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה" : "Drug name (e.g., 'Warfarin', 'Methotrexate')"
              }
            },
            required: ["drugName"]
          }
        },

{
          name: "getDrugDosageInfo",
          description: isHebrew
            ? "קבל הנחיות מינון ומתן תרופה מתווית ה-FDA הרשמית"
            : "Get recommended dosage and administration instructions from the official FDA label. Use when asked about how much of a drug to take, dosing schedules, or administration routes.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה" : "Drug name (e.g., 'Metformin', 'Amoxicillin')"
              }
            },
            required: ["drugName"]
          }
        },

{
          name: "getDrugContraindications",
          description: isHebrew
            ? "קבל מידע על אינטראקציות בין תרופות מתווית ה-FDA - מתי אסור לשלב תרופות"
            : "Get drug interactions from the official FDA label. Shows which drugs should NOT be combined and why. Use when asked about drug-drug interactions or combining medications.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה" : "Drug name (e.g., 'Warfarin', 'Methotrexate')"
              }
            },
            required: ["drugName"]
          }
        },

{
          name: "getDrugPregnancyInfo",
          description: isHebrew
            ? "קבל מידע בטיחות תרופה בהריון והנקה מתווית ה-FDA"
            : "Get pregnancy and lactation safety information from the FDA label. Shows if a drug is safe during pregnancy, breastfeeding, and for pediatric/geriatric populations. Use when asked about drug safety in pregnancy.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה" : "Drug name (e.g., 'Lisinopril', 'Metformin')"
              }
            },
            required: ["drugName"]
          }
        },

{
          name: "getDrugImage",
          description: isHebrew
            ? "קבל תמונות של גלולת תרופה או אריזה מ-DailyMed"
            : "Get images of a drug pill or package from DailyMed. Returns image URLs. Use when asked to show what a pill looks like or identify a pill by appearance.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה לחיפוש" : "Drug name to search for"
              },
              setId: {
                type: "string",
                description: isHebrew ? "מזהה Set ID של DailyMed (אופציונלי, אם ידוע)" : "DailyMed Set ID (optional, if already known from a previous search)"
              }
            }
          }
        },

        // ─── End DailyMed Tools ──────────────────────────────────────────

        // ─── Medicaid Data API Tools (CMS data.medicaid.gov) ─────────────
        {
          name: "getMedicaidEnrollment",
          description: isHebrew
            ? "קבל נתוני הרשמה למדיקייד ו-CHIP לפי מדינה. מציג סך הרשמות, הרשמת ילדים, הרשמת CHIP, ומצב הרחבת מדיקייד."
            : "Get Medicaid and CHIP enrollment data for a US state. Shows total enrollment, child enrollment, CHIP enrollment, Medicaid expansion status, and application/determination counts. Data from CMS data.medicaid.gov.",
          parameters: {
            type: "object",
            properties: {
              state: {
                type: "string",
                description: isHebrew ? "קיצור מדינה (לדוגמה: 'NY', 'CA', 'TX')" : "US state abbreviation (e.g., 'NY', 'CA', 'TX')"
              },
              reportingPeriod: {
                type: "string",
                description: isHebrew ? "תקופת דיווח בפורמט YYYYMM (אופציונלי)" : "Reporting period in YYYYMM format (optional, e.g., '202406'). Returns most recent data if omitted."
              }
            },
            required: ["state"]
          }
        },
        {
          name: "getMedicaidDrugUtilization",
          description: isHebrew
            ? "קבל נתוני שימוש בתרופות תחת מדיקייד לפי שם תרופה ומדינה. מציג מספר מרשמים, יחידות שהוחזרו, וסכומי החזר."
            : "Get Medicaid drug utilization data (SDUD) for a specific drug. Shows number of prescriptions, units reimbursed, and total/Medicaid reimbursement amounts by state. Data from CMS State Drug Utilization Data.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה (לדוגמה: 'TRULICITY', 'METFORMIN')" : "Drug product name (e.g., 'TRULICITY', 'METFORMIN', 'LISINOPRIL')"
              },
              state: {
                type: "string",
                description: isHebrew ? "קיצור מדינה (אופציונלי)" : "US state abbreviation to filter by (optional, e.g., 'NY')"
              },
              year: {
                type: "number",
                description: isHebrew ? "שנה (2018-2020, ברירת מחדל: 2020)" : "Data year (2018-2020, default: 2020)"
              }
            },
            required: ["drugName"]
          }
        },
        {
          name: "checkMedicaidEligibility",
          description: isHebrew
            ? "בדוק מידע על זכאות מדיקייד למדינה. מציג נתוני הרשמה, מצב הרחבה, ומספרי הרשמה עדכניים."
            : "Check Medicaid eligibility context for a US state. Returns latest enrollment data, Medicaid expansion status, total/CHIP/child enrollment numbers. Note: individual eligibility depends on state-specific income, age, and disability rules.",
          parameters: {
            type: "object",
            properties: {
              state: {
                type: "string",
                description: isHebrew ? "קיצור מדינה (לדוגמה: 'NY', 'CA')" : "US state abbreviation (e.g., 'NY', 'CA')"
              }
            },
            required: ["state"]
          }
        },
        // ─── End Medicaid Data Tools ─────────────────────────────────────

{
          name: "validatePrescription",
          description: isHebrew
            ? "אמת מרשם תרופה - בודק תקינות NDC, בטיחות תרופה, אינטראקציות עם תרופות קיימות, ומינון. מחזיר שגיאות ואזהרות. השתמש בזה לפני אישור מרשם."
            : "Validate prescription - checks NDC validity, drug safety, interactions with existing medications, and dosage format. Returns validation errors and warnings. Use this before approving a prescription.",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew
                  ? "שם התרופה (לדוגמה: 'Lisinopril', 'Metformin')"
                  : "Drug name (e.g., 'Lisinopril', 'Metformin')"
              },
              ndc: {
                type: "string",
                description: isHebrew
                  ? "מספר NDC של התרופה (אופציונלי, לדוגמה: '0069-0155-07')"
                  : "Drug NDC number (optional, e.g., '0069-0155-07')"
              },
              dosage: {
                type: "string",
                description: isHebrew
                  ? "מינון (לדוגמה: '10mg per day', '500mg twice daily')"
                  : "Dosage (e.g., '10mg per day', '500mg twice daily')"
              },
              existingMedications: {
                type: "array",
                items: { type: "string" },
                description: isHebrew
                  ? "רשימת תרופות קיימות של המטופל (אופציונלי) - לבדיקת אינטראקציות"
                  : "Patient's existing medications (optional) - for interaction checking. Example: ['Aspirin', 'Metformin']"
              }
            },
            required: ["drugName"]
          }
        },

{
          name: "checkPatientsForAllergies",
          description: isHebrew
            ? "בדוק אם תרופה בטוחה למטופל ספציפי - בודק אלרגיות של המטופל כנגד תרופה מוצעת, כולל בדיקת רגישות צולבת (cross-sensitivity). מחזיר אזהרות, המלצות, וחלופות בטוחות במידת הצורך. חיוני לשימוש לפני מתן תרופות חדשות."
            : "Check if a medication is safe for a specific patient - checks patient allergies against proposed medication, including cross-sensitivity detection. Returns warnings, recommendations, and safe alternatives if needed. Critical to use before prescribing new medications.",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל (חובה)" : "Patient ID (required)"
              },
              medication: {
                type: "string",
                description: isHebrew ? "שם התרופה לבדיקה (חובה)" : "Medication name to check (required)"
              },
              language: {
                type: "string",
                description: isHebrew ? "שפת התגובה (en או he, ברירת מחדל en)" : "Response language (en or he, default en)",
                enum: ["en", "he"]
              }
            },
            required: ["patientId", "medication"]
          }
        },

{
          name: "checkDrugAllergy",
          description: isHebrew
            ? "בדוק אם תרופה בטוחה למטופל - משתמש במסד הנתונים הרפואי הפנימי. תומך במספר שמות פרמטרים"
            : "Check if a specific drug is safe for a patient - uses internal medical database. Supports multiple parameter names for flexibility",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל (חובה)" : "Patient ID (required)"
              },
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה לבדיקה (מועדף)" : "Drug name to check (preferred parameter name)"
              },
              drug: {
                type: "string",
                description: isHebrew ? "שם התרופה (חלופה)" : "Drug name (alternative parameter)"
              },
              medication: {
                type: "string",
                description: isHebrew ? "שם התרופה (חלופה)" : "Medication name (alternative parameter)"
              }
            },
            required: ["patientId"]  // drugName OR drug OR medication required
          }
        },

{
          name: "analyzeVitalSigns",
          description: isHebrew 
            ? "נתח סימנים חיוניים באמצעות Gemini AI וחשב ציון NEWS"
            : "Analyze vital signs using Gemini AI and calculate NEWS score",
          parameters: {
            type: "object",
            properties: {
              bloodPressure: { 
                type: "object", 
                properties: {
                  systolic: { type: "number" },
                  diastolic: { type: "number" }
                },
                description: isHebrew ? "לחץ דם" : "Blood pressure" 
              },
              heartRate: { type: "number", description: isHebrew ? "דופק" : "Heart rate" },
              temperature: { type: "number", description: isHebrew ? "חום גוף" : "Body temperature" },
              respiratoryRate: { type: "number", description: isHebrew ? "קצב נשימה" : "Respiratory rate" },
              oxygenSaturation: { type: "number", description: isHebrew ? "רוויון חמצן" : "Oxygen saturation" },
              patientAge: { type: "number", description: isHebrew ? "גיל המטופל" : "Patient age" },
              patientGender: { type: "string", description: isHebrew ? "מין המטופל" : "Patient gender" },
              medicalHistory: { 
                type: "array", 
                items: { type: "string" }, 
                description: isHebrew ? "היסטוריה רפואית" : "Medical history" 
              },
              medications: { 
                type: "array", 
                items: { type: "string" }, 
                description: isHebrew ? "תרופות נוכחיות" : "Current medications" 
              }
            },
            required: []
          }
        },

{
          name: "interpretLabResults",
          description: isHebrew 
            ? "פענח תוצאות מעבדה באמצעות Gemini AI וזהה ערכים קריטיים"
            : "Interpret lab results using Gemini AI and identify critical values",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew
                  ? "מזהה מטופל (לאחזור תוצאות מעבדה ממסד הנתונים)"
                  : "Patient ID (to retrieve lab results from database). Use this when you need to fetch lab results for interpretation"
              },
              labOrderId: {
                type: "string",
                description: isHebrew
                  ? "מזהה הזמנת מעבדה (אופציונלי, לאחזור תוצאות ספציפיות)"
                  : "Lab order ID (optional, to retrieve specific lab order results)"
              },
              labResults: {
                type: "object",
                description: isHebrew ? "תוצאות מעבדה (מפתח: שם בדיקה, ערך: תוצאה)" : "Lab results object (key: test name, value: result). Use this when you already have the results and don't need to fetch from database"
              },
              results: {
                type: "object",
                description: isHebrew ? "תוצאות מעבדה (חלופי)" : "Lab results (alternative format)"
              },
              patientAge: { type: "number", description: isHebrew ? "גיל המטופל" : "Patient age" },
              patientGender: { type: "string", description: isHebrew ? "מין המטופל" : "Patient gender" },
              medicalHistory: { 
                type: "array", 
                items: { type: "string" }, 
                description: isHebrew ? "היסטוריה רפואית" : "Medical history" 
              },
              medications: { 
                type: "array", 
                items: { type: "string" }, 
                description: isHebrew ? "תרופות נוכחיות" : "Current medications" 
              },
              previousResults: { 
                type: "array", 
                items: { type: "object" }, 
                description: isHebrew ? "תוצאות קודמות להשוואה" : "Previous results for comparison" 
              }
            },
            required: []
          }
        },

{
          name: "getDifferentialDiagnosis",
          description: isHebrew 
            ? "קבל אבחנה מבדלת על סמך תסמינים"
            : "Get differential diagnosis based on symptoms",
          parameters: {
            type: "object",
            properties: {
              symptoms: { type: "array", items: { type: "string" }, description: isHebrew ? "רשימת תסמינים" : "List of symptoms" },
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (אופציונלי)" : "Patient ID (optional)" },
              urgency: { type: "string", description: isHebrew ? "דחיפות" : "Urgency level", enum: ["routine", "urgent", "emergency"] }
            },
            required: ["symptoms"]
          }
        },

        // REMOVED: calculateMedicationDosing - Gemini-dependent function disabled
        // REMOVED: lookupClinicalGuidelines - Gemini-dependent function disabled

{
          name: "recommendTests",
          description: isHebrew 
            ? "המלץ על בדיקות רפואיות"
            : "Recommend medical tests",
          parameters: {
            type: "object",
            properties: {
              symptoms: { type: "array", items: { type: "string" }, description: isHebrew ? "רשימת תסמינים" : "List of symptoms" },
              diagnosis: { type: "string", description: isHebrew ? "אבחנה" : "Diagnosis" },
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (אופציונלי)" : "Patient ID (optional)" },
              urgency: { type: "string", description: isHebrew ? "דחיפות" : "Urgency level", enum: ["routine", "urgent", "emergency"] }
            },
            required: []
          }
        },

{
          name: "scheduleAppointment",
          description: isHebrew
            ? "קבע תור למטופל. אם המשתמש מציין מומחיות (לדוגמה: 'קרדיולוג', 'מומחה'), השתמש ב-getUsersBySpecialty כדי למצוא רופאים זמינים תחילה."
            : "Schedule patient appointment. IMPORTANT: If user specifies a specialty (e.g., 'cardiologist', 'specialist'), use getUsersBySpecialty to find available doctors first. Then use the doctor's full name in the 'doctor' parameter.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              patientName: { type: "string", description: isHebrew ? "שם מטופל" : "Patient name (optional if patientId provided)" },
              nationalId: { type: "string", description: isHebrew ? "תעודת זהות" : "National ID (alternative to patientId)" },
              date: { type: "string", description: isHebrew ? "תאריך" : "Date" },
              time: { type: "string", description: isHebrew ? "שעה" : "Time" },
              duration: { type: "number", description: isHebrew ? "משך בדקות" : "Duration in minutes" },
              type: { type: "string", description: isHebrew ? "סוג תור" : "Appointment type" },
              doctor: { type: "string", description: isHebrew ? "שם מלא של הרופא (לא מומחיות). אם מומחיות צוינה, השתמש ב-getUsersBySpecialty תחילה" : "Doctor's full name (NOT specialty). If specialty specified, use getUsersBySpecialty first to get actual doctor name." },
              providerName: { type: "string", description: isHebrew ? "שם ספק" : "Provider name (alias for doctor)" },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא" : "Doctor ID" },
              reason: { type: "string", description: isHebrew ? "סיבת ביקור" : "Visit reason" }
            },
            required: ["patientId", "date", "time"]
          }
        },

{
          name: "findAvailableSlots",
          description: isHebrew 
            ? "מצא זמנים פנויים לתור"
            : "Find available appointment slots",
          parameters: {
            type: "object",
            properties: {
              doctor: { type: "string", description: isHebrew ? "רופא" : "Doctor" },
              dateRange: { type: "string", description: isHebrew ? "טווח תאריכים" : "Date range" },
              duration: { type: "number", description: isHebrew ? "משך נדרש" : "Required duration" },
              preferredTime: { type: "string", description: isHebrew ? "זמן מועדף" : "Preferred time" }
            },
            required: ["doctor", "dateRange"]
          }
        },

{
          name: "updateAppointment",
          description: isHebrew
            ? "עדכן פרטי תור קיים"
            : "Update existing appointment",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string", description: isHebrew ? "מזהה תור" : "Appointment ID" },
              appointmentNumber: { type: "string", description: isHebrew ? "מספר תור" : "Appointment number" },
              doctor: { type: "string", description: isHebrew ? "רופא" : "Doctor name" },
              providerName: { type: "string", description: isHebrew ? "שם ספק" : "Provider name (alias for doctor)" },
              scheduledDate: { type: "string", description: isHebrew ? "תאריך חדש" : "New date" },
              scheduledTime: { type: "string", description: isHebrew ? "שעה חדשה" : "New time" },
              duration: { type: "number", description: isHebrew ? "משך חדש" : "New duration" },
              notes: { type: "string", description: isHebrew ? "הערות" : "Notes" }
            },
            required: []
          }
        },

{
          name: "rescheduleAppointment",
          description: isHebrew
            ? "דחה תור לזמן אחר"
            : "Reschedule appointment",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string", description: isHebrew ? "מזהה תור" : "Appointment ID" },
              appointmentNumber: { type: "string", description: isHebrew ? "מספר תור" : "Appointment number" },
              newDate: { type: "string", description: isHebrew ? "תאריך חדש" : "New date" },
              newTime: { type: "string", description: isHebrew ? "שעה חדשה" : "New time" },
              newProvider: { type: "string", description: isHebrew ? "ספק חדש" : "New provider" },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא" : "Doctor ID" },
              reason: { type: "string", description: isHebrew ? "סיבת דחייה" : "Reschedule reason" }
            },
            required: []
          }
        },

{
          name: "createChatSession",
          description: isHebrew 
            ? "התחל שיחת ייעוץ חדשה"
            : "Start new consultation chat",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              title: { type: "string", description: isHebrew ? "כותרת" : "Title" },
              type: { type: "string", description: isHebrew ? "סוג ייעוץ" : "Consultation type" }
            },
            required: ["title"]
          }
        },

{
          name: "createUser",
          description: isHebrew
            ? "צור משתמש חדש במערכת. שאל לאימייל אמיתי. ארבעה תפקידים בלבד: admin (מנהל), doctor (רופא), nurse (אחות), user (משתמש בסיסי - ברירת המחדל)"
            : "Create new system user. Ask for real email. Only four roles exist: admin, doctor, nurse, user (basic - the default).",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string", description: isHebrew ? "אימייל אמיתי של המשתמש (חובה לשאול)" : "User's real email address (MUST ask for this)" },
              firstName: { type: "string", description: isHebrew ? "שם פרטי" : "First name" },
              lastName: { type: "string", description: isHebrew ? "שם משפחה" : "Last name" },
              role: { type: "string", enum: ["admin", "doctor", "nurse", "user"], description: isHebrew ? "תפקיד: admin (מנהל), doctor (רופא), nurse (אחות) או user (משתמש בסיסי, ברירת המחדל)" : "Role: admin, doctor, nurse, or user (basic, the default)" },
              licenseNumber: { type: "string", description: isHebrew ? "מספר רישיון מקצועי" : "Professional license number" },
              specialization: { type: "string", description: isHebrew ? "התמחות/מקצוע" : "Specialization/Profession" }
            },
            required: ["email", "firstName", "lastName", "role"]
          }
        },

{
          name: "removeDoctorInfo",
          description: isHebrew
            ? "הסר מידע רופא ממשתמש - מנקה את כל הגדרות הרופא והתזמונים"
            : "Remove doctor information from user - cleans up all doctor settings and schedules",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש או אימייל (השתמש ב-'me' למשתמש הנוכחי)" : "User ID or email (use 'me' for current user)" }
            },
            required: ["userId"]
          }
        },

{
          name: "addDoctorLicense",
          description: isHebrew
            ? "הוסף מספר רישיון רפואי לרופא - השתמש ב-'me' למשתמש הנוכחי"
            : "Add medical license number for doctor - use 'me' for current user",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש או אימייל (השתמש ב-'me' למשתמש הנוכחי)" : "User ID or email (use 'me' for current user)" },
              licenseNumber: { type: "string", description: isHebrew ? "מספר רישיון רפואי" : "Medical license number" },
              licenseState: { type: "string", description: isHebrew ? "מדינה/אזור של הרישיון (אופציונלי)" : "License state/region (optional)" },
              licenseExpiry: { type: "string", description: isHebrew ? "תאריך תפוגת רישיון (אופציונלי)" : "License expiry date (optional)" }
            },
            required: ["userId", "licenseNumber"]
          }
        },

{
          name: "updateDoctorLicense",
          description: isHebrew
            ? "עדכן מספר רישיון רפואי קיים של רופא - השתמש ב-'me' למשתמש הנוכחי"
            : "Update existing medical license number for doctor - use 'me' for current user",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש או אימייל (השתמש ב-'me' למשתמש הנוכחי)" : "User ID or email (use 'me' for current user)" },
              licenseNumber: { type: "string", description: isHebrew ? "מספר רישיון רפואי" : "Medical license number" },
              licenseState: { type: "string", description: isHebrew ? "מדינה/אזור של הרישיון (אופציונלי)" : "License state/region (optional)" },
              licenseExpiry: { type: "string", description: isHebrew ? "תאריך תפוגת רישיון (אופציונלי)" : "License expiry date (optional)" }
            },
            required: ["userId", "licenseNumber"]
          }
        },

{
          name: "removeDoctorLicense",
          description: isHebrew
            ? "הסר מספר רישיון רפואי מרופא - השתמש ב-'me' למשתמש הנוכחי"
            : "Remove medical license number from doctor - use 'me' for current user",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש או אימייל (השתמש ב-'me' למשתמש הנוכחי)" : "User ID or email (use 'me' for current user)" }
            },
            required: ["userId"]
          }
        },

{
          name: "getDoctorLicense",
          description: isHebrew
            ? "קבל פרטי רישיון רפואי של רופא - השתמש ב-'me' למשתמש הנוכחי"
            : "Get medical license details for doctor - use 'me' for current user",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש או אימייל (השתמש ב-'me' למשתמש הנוכחי)" : "User ID or email (use 'me' for current user)" }
            },
            required: ["userId"]
          }
        },

{
          name: "checkDoctorStatus",
          description: isHebrew
            ? "בדוק אם המשתמש הנוכחי הוא רופא או צריך ליצור פרופיל רופא"
            : "Check if current user is a doctor or needs to create doctor profile",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "runBackup",
          description: isHebrew 
            ? "הרץ גיבוי של המערכת"
            : "Run system backup",
          parameters: {
            type: "object",
            properties: {
              backupType: { type: "string", description: isHebrew ? "סוג גיבוי" : "Backup type", enum: ["full", "incremental", "differential"] },
              description: { type: "string", description: isHebrew ? "תיאור" : "Description" }
            },
            required: ["backupType"]
          }
        },

{
          name: "getSystemHealth",
          description: isHebrew 
            ? "קבל מצב בריאות המערכת"
            : "Get system health status",
          parameters: {
            type: "object",
            properties: {
              includeDetails: { type: "boolean", description: isHebrew ? "כלול פרטים" : "Include details" }
            }
          }
        },

{
          name: "addLabResult",
          description: isHebrew
            ? "הוסף תוצאות בדיקת מעבדה למטופל - רקLOCATIONONLY לשימוש כאשר יש תוצאות בפועל (WBC, hemoglobin, וכו'). אם רק מזמינים בדיקה, השתמש ב-orderLabTest במקום"
            : "Add lab test results for a patient - ONLY use when you have ACTUAL test results (WBC count, hemoglobin values, etc.). If just ordering a test, use orderLabTest instead"
        },

{
          name: "getLabResults",
          description: isHebrew
            ? "INTERNAL USE ONLY - מחזיר מערך נתונים גולמי. אל תשתמש להצגה/צפייה. כאשר משתמש מבקש 'show lab results', השתמש ב-getMedicalDataByCategory עם category='lab_results' במקום כדי לפתוח פאנל ארטיפקט"
            : "INTERNAL USE ONLY - Returns raw data array. DO NOT use for display/viewing. When user requests 'show lab results', use getMedicalDataByCategory with category='lab_results' instead to open artifact panel",
          parameters: {
            type: "object",
            properties: {
              nationalId: { 
                type: "string", 
                description: isHebrew 
                  ? "תעודת זהות של המטופל - השתמש בזה! המערכת תמצא את המטופל אוטומטית"
                  : "Patient's national ID - USE THIS! System will find patient automatically"
              },
              patientId: { 
                type: "string", 
                description: isHebrew 
                  ? "מזהה מטופל - אופציונלי, עדיף להשתמש ב-nationalId"
                  : "Patient ID - optional, prefer using nationalId instead"
              },
              testType: { type: "string", description: isHebrew ? "סוג בדיקה (אופציונלי)" : "Test type (optional)" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך (אופציונלי)" : "From date (optional)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך (אופציונלי)" : "To date (optional)" }
            },
            required: []  // Either nationalId OR patientId needed
          }
        },

{
          name: "getMedications",
          description: isHebrew
            ? "קבל רשימת תרופות של מטופל כולל תרופות פעילות והיסטוריות עם פרטים (שם תרופה, מינון, תדירות, דרך מתן, הרופא שרשם את המרשם, תאריכי התחלה/סיום, סטטוס). כברירת מחדל, מסתירה תרופות שפג תוקפן - השתמש includeExpired:true כדי לראות תרופות שפג תוקפן. תומך בסינון תאריכים."
            : "Get patient's medication list including active and historical medications with details (medication name, dosage, frequency, route, prescriber who wrote the prescription, start/end dates, status). By default, hides expired medications - use includeExpired:true to see expired medications. Supports date filtering.",
          parameters: {
            type: "object",
            properties: {
              nationalId: {
                type: "string",
                description: isHebrew
                  ? "תעודת זהות של המטופל - המערכת תמצא את המטופל אוטומטית"
                  : "Patient's national ID - System will find patient automatically"
              },
              patientId: {
                type: "string",
                description: isHebrew
                  ? "מזהה מטופל מהמערכת (MongoDB ID)"
                  : "Patient ID from system (MongoDB ID)"
              },
              status: {
                type: "string",
                description: isHebrew ? "סטטוס התרופות להצגה" : "Medication status to show",
                enum: ["active", "discontinued", "completed", "all"],
                default: "all"
              },
              includeHistory: {
                type: "boolean",
                description: isHebrew ? "כלול היסטוריית תרופות" : "Include medication history",
                default: false
              },
              includeExpired: {
                type: "boolean",
                description: isHebrew ? "כלול תרופות שפג תוקפן - השתמש רק אם המשתמש מבקש במפורש" : "Include expired medications - use only if user explicitly requests",
                default: false
              },
              includeInactive: {
                type: "boolean",
                description: isHebrew ? "כלול תרופות לא פעילות (הופסקו, פג תוקפן)" : "Include inactive medications (discontinued, expired)",
                default: false
              },
              includeDiscontinued: {
                type: "boolean",
                description: isHebrew ? "כלול תרופות שהופסקו (ברירת מחדל: true)" : "Include discontinued medications (default: true)",
                default: true
              },
              startDate: {
                type: "string",
                description: isHebrew ? "סנן תרופות לפי תאריך התחלה (ISO format). דוגמה: '2025-01-01'" : "Filter medications by start date (ISO format). Example: '2025-01-01'"
              },
              endDate: {
                type: "string",
                description: isHebrew ? "סנן תרופות לפי תאריך סיום (ISO format). דוגמה: '2025-12-31'" : "Filter medications by end date (ISO format). Example: '2025-12-31'"
              },
              prescribedAfter: {
                type: "string",
                description: isHebrew ? "סנן תרופות שנרשמו אחרי תאריך מסוים (ISO format). דוגמה: '2025-06-01'" : "Filter medications prescribed after a specific date (ISO format). Example: '2025-06-01'"
              }
            },
            required: []  // Either nationalId OR patientId needed
          }
        },

{
          name: "createMedication",
          description: isHebrew
            ? "צור רשום תרופה חדש למטופל. שימוש כאשר הוספת תרופה חדשה לרשימת התרופות של המטופל"
            : "Create a new medication record for a patient. Use when adding a new medication to patient's medication list",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              data: {
                type: "object",
                description: isHebrew ? "נתוני התרופה" : "Medication data"
              },
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך קשור" : "Associated document ID" }
            },
            required: ["patientId", "data"]
          }
        },

{
          name: "updateMedication",
          description: isHebrew
            ? "עדכן רשום תרופה קיים. להפסיק תרופה: הגדר active:false ו-discontinuedDate ו-discontinuedReason"
            : "Update an existing medication record. To discontinue a medication, set active:false and provide discontinuedDate and discontinuedReason. The medicationId is the _id field from the medication document.",
          parameters: {
            type: "object",
            properties: {
              medicationId: { type: "string", description: isHebrew ? "מזהה תרופה (_id field)" : "Medication ID (the _id field from medication document)" },
              updates: {
                type: "object",
                description: isHebrew ? "שדות לעדכון" : "Fields to update"
              }
            },
            required: ["medicationId", "updates"]
          }
        },

{
          name: "deleteMedication",
          description: isHebrew
            ? "מחק רשום תרופה. שימוש כאשר מוחקים תרופה כפולה או שגויה מרשימת התרופות של המטופל"
            : "Delete a medication record. Use when removing a duplicate or incorrect medication from patient's medication list. The medicationId is the _id field from the medication document.",
          parameters: {
            type: "object",
            properties: {
              medicationId: { type: "string", description: isHebrew ? "מזהה תרופה למחיקה (_id field)" : "Medication ID to delete (the _id field from medication document)" }
            },
            required: ["medicationId"]
          }
        },

        {
          name: "getExpiredMedications",
          description: isHebrew
            ? "קבל רשימת תרופות שפג תוקפן עבור מטופל. תרופות אלו הופסקו אוטומטית עקב תום תקופת הטיפול"
            : "Get list of expired medications for a patient. These are medications that were automatically discontinued when their treatment period ended",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              limit: { type: "number", description: isHebrew ? "מספר מקסימלי של תוצאות" : "Maximum number of results" },
              sortBy: {
                type: "string",
                enum: ["endDate", "discontinuedDate", "name"],
                description: isHebrew ? "מיין לפי" : "Sort by"
              }
            },
            required: ["patientId"]
          }
        },

        {
          name: "deleteExpiredMedication",
          description: isHebrew
            ? "מחק לצמיתות תרופה שפג תוקפה מהיסטוריה הרפואית של המטופל. השתמש כאשר הרופא רוצה להסיר תרופה שפג תוקפה"
            : "Permanently delete an expired medication from patient's medical history. Use when doctor wants to remove an expired medication",
          parameters: {
            type: "object",
            properties: {
              recordId: { type: "string", description: isHebrew ? "מזהה רשומת התרופה למחיקה" : "Medication record ID to delete" }
            },
            required: ["recordId"]
          }
        },

        {
          name: "updateExpiredMedication",
          description: isHebrew
            ? "עדכן או הפעל מחדש תרופה שפג תוקפה. השתמש כאשר הרופא רוצה לחדש/להפעיל מחדש תרופה או לשנות פרטיה. כדי להפעיל מחדש: הגדר active=true ומחק discontinuedDate ו-discontinuedReason"
            : "Update or reactivate an expired medication. Use when doctor wants to renew/reactivate an expired medication or modify its details. To reactivate: set active=true and remove discontinuedDate and discontinuedReason",
          parameters: {
            type: "object",
            properties: {
              recordId: { type: "string", description: isHebrew ? "מזהה רשומת התרופה" : "Medication record ID" },
              updates: {
                type: "object",
                description: isHebrew
                  ? "שדות לעדכון. דוגמאות: active, endDate, dosage, frequency, discontinuedDate, discontinuedReason"
                  : "Fields to update. Examples: active, endDate, dosage, frequency, discontinuedDate, discontinuedReason"
              }
            },
            required: ["recordId", "updates"]
          }
        },

{
          name: "addDiagnosis",
          description: isHebrew
            ? "הוסף אבחנה חדשה למטופל. השתמש כאשר המשתמש מבקש להוסיף, לרשום או לתעד אבחנה חדשה"
            : "Add a new diagnosis for a patient. Use when user asks to add, record, or document a new diagnosis"
        },

{
          name: "updateDiagnosis",
          description: isHebrew
            ? "עדכן אבחנה קיימת. השתמש כאשר המשתמש מבקש לעדכן, לשנות או לתקן אבחנה"
            : "Update an existing diagnosis. Use when user asks to update, change, or correct a diagnosis"
        },

{
          name: "deleteDiagnosis",
          description: isHebrew
            ? "מחק אבחנה. השתמש כאשר המשתמש מבקש למחוק או להסיר אבחנה"
            : "Delete a diagnosis. Use when user asks to delete or remove a diagnosis",
          parameters: {
            type: "object",
            properties: {
              diagnosisId: { type: "string", description: isHebrew ? "מזהה אבחנה" : "Diagnosis ID" }
            },
            required: ["diagnosisId"]
          }
        },

{
          name: "addVitalSigns",
          description: isHebrew
            ? "הוסף סימנים חיוניים למטופל. נדרש לפחות מדד חיוני אחד"
            : "Add vital signs for patient. At least one vital sign measurement is required. Supports blood pressure, pulse, temperature, oxygen saturation, respiratory rate, weight, height, pain scale, and glucose level",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל" : "Patient ID"
              },
              data: {
                type: "object",
                description: isHebrew ? "נתוני סימנים חיוניים" : "Vital signs data"
              }
            },
            required: ["patientId", "data"]
          }
        },

{
          name: "getVitalSigns",
          description: isHebrew
            ? "קבל סימנים חיוניים כולל דופק, טמפרטורה, קצב נשימה, רוויון חמצן ו-BMI עם תאריכים ומגמות. תומך בסינון לפי תאריך, סוג סימן חיוני, וסדר מיון. השתמש כאשר המשתמש מבקש לראות, להציג, לבדוק או לסקור סימנים חיוניים או מדדי בריאות בסיסיים. לנתוני לחץ דם ספציפיים, השתמש ב-getBloodPressureReadings במקום"
            : "Get vital signs including pulse, temperature, respiratory rate, oxygen saturation, and BMI with dates and trends. Supports filtering by date range, vital type, and sort order. Use when user asks to see, show, view, or review vital signs or basic health metrics. For blood pressure specific data, use getBloodPressureReadings instead",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל" : "Patient ID"
              },
              dateFrom: {
                type: "string",
                description: isHebrew
                  ? "סנן סימנים חיוניים מתאריך זה והלאה (ISO format). דוגמה: '2025-01-01'"
                  : "Filter vital signs from this date onwards (ISO format). Example: '2025-01-01'"
              },
              dateTo: {
                type: "string",
                description: isHebrew
                  ? "סנן סימנים חיוניים עד תאריך זה (ISO format). דוגמה: '2025-12-31'"
                  : "Filter vital signs up to this date (ISO format). Example: '2025-12-31'"
              },
              vitalType: {
                type: "string",
                description: isHebrew
                  ? "סנן לפי סוג סימן חיוני ספציפי (לדוגמה: 'temperature', 'pulse', 'oxygen_saturation', 'respiratory_rate', 'bmi'). לנתוני לחץ דם, השתמש ב-getBloodPressureReadings במקום"
                  : "Filter by specific vital sign type (e.g., 'temperature', 'pulse', 'oxygen_saturation', 'respiratory_rate', 'bmi'). For blood pressure data, use getBloodPressureReadings instead"
              },
              sort: {
                type: "string",
                enum: ["asc", "desc"],
                description: isHebrew
                  ? "סדר מיון: 'asc' (מהישן לחדש) או 'desc' (מהחדש לישן, ברירת מחדל)"
                  : "Sort order: 'asc' (oldest first) or 'desc' (newest first, default)"
              },
              latestOnly: {
                type: "boolean",
                description: isHebrew
                  ? "החזר רק את המדידה האחרונה (true) או את כל המדידות (false, ברירת מחדל)"
                  : "Return only the most recent measurement (true) or all measurements (false, default)"
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר תוצאות מקסימלי (ברירת מחדל: 20)" : "Maximum number of results (default: 20)"
              }
            },
            required: ["patientId"]
          }
        },

{
          name: "addAllergy",
          description: isHebrew
            ? "הוסף אלרגיה למטופל"
            : "Add allergy for a patient"
        },

        {
          name: "getAllergiesAssessments",
          description: isHebrew ? "קבל הערכות אלרגיות כולל בדיקות מעבדה" : "Get allergy assessments including lab tests",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" }
            },
            required: ["patientId"]
          }
        },
        {
          name: "createAllergiesAssessment",
          description: isHebrew ? "צור הערכת אלרגיות חדשה" : "Create a new allergy assessment",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              data: { type: "object", description: isHebrew ? "נתוני הערכה" : "Assessment data" }
            },
            required: ["patientId", "data"]
          }
        },
        {
          name: "updateAllergiesAssessment",
          description: isHebrew ? "עדכן הערכת אלרגיות קיימת" : "Update an existing allergy assessment",
          parameters: {
            type: "object",
            properties: {
              assessmentId: { type: "string", description: isHebrew ? "מזהה הערכה" : "Assessment ID" },
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              data: { type: "object", description: isHebrew ? "נתוני עדכון" : "Update data" }
            },
            required: ["assessmentId", "patientId"]
          }
        },
        {
          name: "deleteAllergiesAssessment",
          description: isHebrew ? "מחק הערכת אלרגיות" : "Delete an allergy assessment",
          parameters: {
            type: "object",
            properties: {
              assessmentId: { type: "string", description: isHebrew ? "מזהה הערכה" : "Assessment ID" },
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" }
            },
            required: ["assessmentId", "patientId"]
          }
        },
        {
          name: "searchAllergiesAssessments",
          description: isHebrew ? "חפש בהערכות אלרגיות" : "Search allergy assessments",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              query: { type: "string", description: isHebrew ? "טקסט חיפוש" : "Search query" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getClinicalDecisionSupport",
          description: isHebrew
            ? "קבל המלצות תמיכה קלינית מבוססות AI כולל אבחנות דיפרנציאליות, המלצות לבדיקות, התרעות אינטראקציה ואזהרות קליניות. השתמש כאשר המשתמש מבקש לראות, להציג או לבדוק תמיכה בהחלטות קליניות, המלצות קליניות או ניתוח קליני"
            : "Get AI-generated clinical decision support including differential diagnoses, test recommendations, interaction alerts, and clinical warnings. Use when user asks to see, show, view, or review clinical decision support, clinical recommendations, or clinical analysis",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getTrendingAnalysis",
          description: isHebrew
            ? "קבל ניתוח מגמות מבוסס AI כולל שינויים בסימנים חיוניים, תוצאות מעבדה, תסמינים לאורך זמן ואזהרות להחמרה. השתמש כאשר המשתמש מבקש לראות, להציג או לבדוק מגמות, שינויים לאורך זמן, ניתוח טרנדים או התקדמות מצב"
            : "Get AI-generated trending analysis including changes in vital signs, lab results, symptoms over time, and deterioration alerts. Use when user asks to see, show, view, or review trends, changes over time, trending analysis, or condition progression",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getPatientCarePlan",
          description: isHebrew
            ? "קבל תוכנית טיפול מותאמת אישית מבוססת AI כולל יעדי טיפול, התערבויות מומלצות, לוחות זמנים למעקב וקריטריונים להצלחה. השתמש כאשר המשתמש מבקש לראות, להציג או לבדוק תוכנית טיפול, תכנית טיפולית או אסטרטגיית טיפול"
            : "Get AI-generated patient-specific care plan including treatment goals, recommended interventions, follow-up schedules, and success criteria. Use when user asks to see, show, view, or review care plan, treatment plan, or care strategy",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getPatientCareGoals",
          description: isHebrew
            ? "קבל יעדי טיפול של מטופל כולל תיאור יעד, קטגוריית יעד, עדיפות, סטטוס מחזור חיים, סטטוס השגה, מצבים מטופלים, התערבויות, מחסומים והערות תוצאה. השתמש כאשר המשתמש מבקש לראות יעדי טיפול, מטרות טיפול, יעדי מטופל או goals of care"
            : "Get patient care goals including goal description, goal category, goal priority (high/medium/low), lifecycle status, achievement status, addressed conditions, interventions, barriers, and outcome notes. Use when user asks to see, show, view, or review patient care goals, care goals, patient goals, treatment goals, or goals of care. NOTE: This is different from getPatientCarePlan which returns AI-generated care plans - use getPatientCareGoals for documented patient-expressed goals and preferences",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getFollowUpIntelligence",
          description: isHebrew
            ? "קבל מידע חכם למעקב מבוסס AI כולל פגישות מעקב מומלצות, בדיקות נדרשות, שאלות לשאול בביקור הבא ודגלים אדומים לפיקוח. השתמש כאשר המשתמש מבקש לראות, להציג או לבדוק מעקב, פגישות מעקב או תזכורות למעקב"
            : "Get AI-generated follow-up intelligence including recommended follow-up visits, required tests, questions to ask at next visit, and red flags to monitor. Use when user asks to see, show, view, or review follow-up, follow-up appointments, or follow-up reminders",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getFollowUps",
          description: isHebrew
            ? "קבל המלצות למעקב שנוצרו מניתוח מסמכים כולל ביקורי מעקב מומלצים, בדיקות נדרשות, תזמון ותאריכים. השתמש כאשר המשתמש מבקש לראות המלצות למעקב, תזכורות מעקב או משימות מעקב"
            : "Get follow-up recommendations generated from document analysis including recommended follow-up visits, required tests, timing, and dates. Use when user asks to see follow-up recommendations, follow-up reminders, or follow-up tasks",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results (default: 10)" },
              skip: { type: "number", description: isHebrew ? "דלג על תוצאות" : "Skip records (default: 0)" },
              sortBy: { type: "string", description: isHebrew ? "מיין לפי שדה" : "Sort by field (default: reportDate)" },
              sortOrder: { type: "number", description: isHebrew ? "סדר מיון (1 עולה, -1 יורד)" : "Sort order (1=ascending, -1=descending)" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getOutcomesPredictions",
          description: isHebrew
            ? "קבל תחזיות תוצאות מבוססות AI כולל פרוגנוזה, סיכונים לסיבוכים, תוצאות צפויות לטיפולים ולוחות זמנים להחלמה. השתמש כאשר המשתמש מבקש לראות, להציג או לבדוק פרוגנוזה, תחזיות, תוצאות צפויות או סיכויי החלמה"
            : "OUTCOMES PREDICTIONS - Get AI-generated predictions for complication risks, expected treatment outcomes, and recovery timelines. Use when user asks for 'predictions', 'outcomes', 'complications', or 'recovery chances'. Do NOT use for simple 'prognosis' requests - use getPrognosis instead.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getPsychiatricHistory",
          description: isHebrew
            ? "PSYCHIATRIC HISTORY - קבל היסטוריה פסיכיאטרית מלאה של המטופל כולל אפיזודות קודמות, אשפוזים, ניסיונות התאבדות, שימוש בסמים, טיפולים קודמים, היסטוריה משפחתית, ממצאים, הערכה ותוכנית טיפול. השתמש כאשר המשתמש מבקש 'psychiatric history', 'היסטוריה פסיכיאטרית', 'עבר פסיכיאטרי', או 'mental health history'. הערה: זה שונה מ-getPsychosocialAssessments שמחזיר הערכות פסיכוסוציאליות נוכחיות - השתמש בזה עבור היסטוריה פסיכיאטרית מתועדת"
            : "PSYCHIATRIC HISTORY - Get patient's complete psychiatric history including previous episodes (diagnoses, treatments, outcomes), hospitalizations, suicide attempts, substance abuse history, previous psychotherapy, family psychiatric history, findings, assessment, plan, recommendations, and notes. Use when user asks for 'psychiatric history', 'mental health history', 'past psychiatric', 'psych history', or 'previous mental health'. NOTE: This is DIFFERENT from getPsychosocialAssessments which returns current psychosocial assessments - use THIS function (getPsychiatricHistory) for documented psychiatric history records.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              nationalId: { type: "string", description: isHebrew ? "תעודת זהות - המערכת תמצא את המטופל אוטומטית" : "Patient's national ID - System will find patient automatically" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך (YYYY-MM-DD)" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך (YYYY-MM-DD)" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getMedicalHistory",
          description: isHebrew
            ? "MEDICAL HISTORY - קבל היסטוריה רפואית מלאה של המטופל כולל מצבים כרוניים, ניתוחים קודמים, אלרגיות, תרופות נוכחיות, היסטוריה משפחתית, היסטוריה חברתית (עישון, אלכוהול, סמים), אשפוזים, היסטוריה בריאות הנפש, סטטוס תפקודי וסוג דם. השתמש כאשר המשתמש מבקש 'medical history', 'היסטוריה רפואית', 'רקע רפואי', 'past medical', או 'health history'. הערה: זה שונה מ-getPastMedicalHistory שמחזיר רק היסטוריה רפואית קודמת - השתמש ב-getMedicalHistory עבור היסטוריה רפואית מלאה ומקיפה"
            : "MEDICAL HISTORY - Get patient's complete medical history including chief complaint, chronic conditions, past medical history, past surgeries, allergies, current medications, family history, social history (living status, employment, tobacco, alcohol, substances, legal history), hospitalizations, mental health history, immunization history, functional status, and blood type. Use when user asks for 'medical history', 'patient history', 'health history', 'past medical', 'complete history', 'full medical history', 'background', 'medical background', or 'history'. NOTE: This is the COMPREHENSIVE medical history collection. DIFFERENT from getPastMedicalHistory which returns only past_medical_history records, and DIFFERENT from getDiagnoses/getMedications/getLabResults which return specific data types.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              nationalId: { type: "string", description: isHebrew ? "תעודת זהות - המערכת תמצא את המטופל אוטומטית" : "Patient's national ID - System will find patient automatically" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך (YYYY-MM-DD)" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך (YYYY-MM-DD)" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getPsychosocialAssessments",
          description: isHebrew
            ? "PSYCHOSOCIAL ASSESSMENTS - קבל הערכות פסיכוסוציאליות נוכחיות כולל מצב נפשי, תמיכה חברתית, גורמי לחץ וסיכוני בריאות נפש. השתמש כאשר המשתמש מבקש 'psychosocial assessment', 'mental status', 'social support assessment'. הערה: זה שונה מ-getPsychiatricHistory - אם המשתמש מבקש 'psychiatric history' השתמש ב-getPsychiatricHistory במקום"
            : "PSYCHOSOCIAL ASSESSMENTS - Get current psychosocial assessments including mental status examination, social support evaluation, current stressors, and mental health risk factors. Use when user asks for 'psychosocial assessment', 'mental status', 'social support assessment', or 'current psychological evaluation'. NOTE: This is DIFFERENT from getPsychiatricHistory - if user asks for 'psychiatric history', 'mental health history', or 'past psychiatric' use getPsychiatricHistory instead.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              assessmentType: { type: "string", description: isHebrew ? "סוג ההערכה" : "Assessment type" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getPsychosocialAssessmentById",
          description: isHebrew
            ? "קבל הערכה פסיכוסוציאלית ספציפית לפי מזהה. השתמש כאשר המשתמש מבקש לראות הערכה ספציפית"
            : "Get a specific psychosocial assessment by ID. Use when user asks to view a specific assessment",
          parameters: {
            type: "object",
            properties: {
              assessmentId: { type: "string", description: isHebrew ? "מזהה הערכה" : "Assessment ID" }
            },
            required: ["assessmentId"]
          }
        },

{
          name: "searchPsychosocialAssessments",
          description: isHebrew
            ? "חפש בתוך הערכות פסיכוסוציאליות לפי טקסט חופשי. השתמש כאשר המשתמש מחפש נושא ספציפי בתוך ההערכות (למשל 'דיכאון', 'חרדה')"
            : "Search within psychosocial assessments by free text. Use when user searches for a specific topic within assessments (e.g., 'depression', 'anxiety')",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              query: { type: "string", description: isHebrew ? "מילות חיפוש" : "Search query" }
            },
            required: ["query"]
          }
        },

{
          name: "getQualityMetrics",
          description: isHebrew
            ? "קבל מדדי איכות טיפול כולל עמידה במדדי HEDIS, יעדי איכות קליניים, ציוני ביצוע ומדדי בטיחות. השתמש כאשר המשתמש מבקש לראות, להציג או לבדוק מדדי איכות, ציוני ביצוע או סטנדרטים של איכות טיפול"
            : "Get quality of care metrics including HEDIS measure compliance, clinical quality goals, performance scores, and safety metrics. Use when user asks to see, show, view, or review quality metrics, performance scores, or care quality standards",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "getCareGaps",
          description: isHebrew
            ? "קבל פערי טיפול מזוהים כולל בדיקות חסרות, חיסונים שלא בוצעו, סקרים שלא נעשו ושירותי מניעה שהוחמצו. השתמש כאשר המשתמש מבקש לראות, להציג או לבדוק פערי טיפול, בדיקות חסרות או משימות מניעה שלא בוצעו"
            : "Get identified care gaps including missing screenings, overdue vaccinations, incomplete preventive care, and missed preventive services. Use when user asks to see, show, view, or review care gaps, missing tests, or incomplete preventive tasks",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status (open/closed)" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "addVaccination",
          description: isHebrew
            ? "הוסף חיסון למטופל"
            : "Add vaccination record for a patient"
        },

{
          name: "getVaccinationRecords",
          description: isHebrew
            ? "הצג חיסונים של מטופל - USE THIS when user asks to see/show vaccination records"
            : "Get vaccination records (administered-vaccine log) - USE THIS only for 'vaccination records'. For 'immunization record' use getImmunizationRecord; for 'immunization status' use getImmunizationStatus.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              includeScheduled: { type: "boolean", description: isHebrew ? "כלול חיסונים מתוכננים" : "Include scheduled vaccinations" }
            },
            required: ["patientId"]
          }
        },

        // REMOVED: calculateMedicalScore - Gemini-dependent function disabled

{
          name: "createReferral",
          description: isHebrew
            ? "צור הפניה למומחה"
            : "Create referral to specialist"
        },

{
          name: "getReasonForReferral",
          description: isHebrew
            ? "סיבת ההפניה - מדוע המטופל הופנה למומחה או לטיפול"
            : "REASON FOR REFERRAL - Get WHY a patient was referred, including the clinical indication, findings, assessment, and plan. Use when user asks about 'reason for referral', 'why was patient referred', 'referral reason', 'indication for referral', or 'why referred'. This returns the CLINICAL REASONING behind a referral. NOTE: This is DIFFERENT from getReferrals which returns referral ORDERS/REQUESTS to specialists - if user says 'reason for referral' or 'why referred', use THIS function (getReasonForReferral), NOT getReferrals.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status", enum: ["pending", "completed", "cancelled", "in-progress", "all"] }
            },
            required: ["patientId"]
          }
        },

{
          name: "getReferrals",
          description: isHebrew
            ? "הצג הפניות של מטופל - הזמנות הפניה למומחים"
            : "REFERRALS - Get referral ORDERS/REQUESTS to specialists including specialty, urgency, status, and referring provider. Use when user asks to see 'referrals', 'specialist referrals', 'referral orders', or 'show me the referrals'. This returns referral ORDER documents. NOTE: This is DIFFERENT from getReasonForReferral which returns the CLINICAL REASONING for why patient was referred - if user says 'reason for referral' or 'why referred', use getReasonForReferral instead. IMPORTANT: If user says 'referrals placed' or 'placed referrals', use getReferralsPlaced instead - that is a DIFFERENT collection with placed/issued referrals.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status", enum: ["pending", "completed", "cancelled", "all"] }
            },
            required: ["patientId"]
          }
        },

{
          name: "addImagingResult",
          description: isHebrew
            ? "הוסף תוצאות הדמיה"
            : "Add imaging results"
        },

{
          name: "updateMedicationOptimization",
          description: isHebrew
            ? "עדכן אופטימיזציית תרופות קיימת"
            : "Update existing medication optimization document",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך" : "Document ID" },
              updates: {
                type: "object",
                description: isHebrew ? "עדכונים לבצע" : "Updates to apply",
                additionalProperties: true
              }
            },
            required: ["documentId", "updates"]
          }
        },

{
          name: "deleteMedicationOptimization",
          description: isHebrew
            ? "מחק אופטימיזציית תרופות"
            : "Delete medication optimization document",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך" : "Document ID" }
            },
            required: ["documentId"]
          }
        },

{
          name: "addToMedicationOptimization",
          description: isHebrew
            ? "הוסף פריטים למערך באופטימיזציית תרופות"
            : "Add items to array in medication optimization document",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך" : "Document ID" },
              fieldName: { type: "string", description: isHebrew ? "שם השדה" : "Field name (e.g., 'optimizations')" },
              newItems: {
                type: "array",
                description: isHebrew ? "פריטים להוספה" : "Items to add",
                items: { type: "object" }
              }
            },
            required: ["documentId", "fieldName", "newItems"]
          }
        },

{
          name: "updateClinicalDecisionSupport",
          description: isHebrew
            ? "עדכן תמיכה בהחלטות קליניות"
            : "Update clinical decision support document",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך" : "Document ID" },
              updates: { type: "object", description: isHebrew ? "עדכונים" : "Updates", additionalProperties: true }
            },
            required: ["documentId", "updates"]
          }
        },

{
          name: "deleteClinicalDecisionSupport",
          description: isHebrew ? "מחק תמיכה בהחלטות קליניות" : "Delete clinical decision support document",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך" : "Document ID" }
            },
            required: ["documentId"]
          }
        },

{
          name: "addToClinicalDecisionSupport",
          description: isHebrew ? "הוסף למערך" : "Add to array in clinical decision support",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך" : "Document ID" },
              fieldName: { type: "string", description: isHebrew ? "שם השדה" : "Field name" },
              newItems: { type: "array", items: { type: "object" } }
            },
            required: ["documentId", "fieldName", "newItems"]
          }
        },

{
          name: "updateTrendingAnalysis",
          description: isHebrew ? "עדכן ניתוח מגמות" : "Update trending analysis",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              updates: { type: "object", additionalProperties: true }
            },
            required: ["documentId", "updates"]
          }
        },

{
          name: "deleteTrendingAnalysis",
          description: isHebrew ? "מחק ניתוח מגמות" : "Delete trending analysis",
          parameters: {
            type: "object",
            properties: { documentId: { type: "string" } },
            required: ["documentId"]
          }
        },

{
          name: "addToTrendingAnalysis",
          description: isHebrew ? "הוסף נתוני מגמה" : "Add trend data",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              fieldName: { type: "string" },
              newItems: { type: "array", items: { type: "object" } }
            },
            required: ["documentId", "fieldName", "newItems"]
          }
        },

{
          name: "updateFollowUpIntelligence",
          description: isHebrew ? "עדכן מעקב חכם" : "Update follow-up intelligence",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              updates: { type: "object", additionalProperties: true }
            },
            required: ["documentId", "updates"]
          }
        },

{
          name: "deleteFollowUpIntelligence",
          description: isHebrew ? "מחק מעקב חכם" : "Delete follow-up intelligence",
          parameters: {
            type: "object",
            properties: { documentId: { type: "string" } },
            required: ["documentId"]
          }
        },

{
          name: "addToFollowUpIntelligence",
          description: isHebrew ? "הוסף משימת מעקב" : "Add follow-up task",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              fieldName: { type: "string" },
              newItems: { type: "array", items: { type: "object" } }
            },
            required: ["documentId", "fieldName", "newItems"]
          }
        },

{
          name: "updatePatientSpecificCarePlan",
          description: isHebrew ? "עדכן תוכנית טיפול מותאמת" : "Update patient-specific care plan",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              updates: { type: "object", additionalProperties: true }
            },
            required: ["documentId", "updates"]
          }
        },

{
          name: "deletePatientSpecificCarePlan",
          description: isHebrew ? "מחק תוכנית טיפול" : "Delete care plan",
          parameters: {
            type: "object",
            properties: { documentId: { type: "string" } },
            required: ["documentId"]
          }
        },

{
          name: "addToPatientSpecificCarePlan",
          description: isHebrew ? "הוסף למטרות טיפול" : "Add care plan goals",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              fieldName: { type: "string" },
              newItems: { type: "array", items: { type: "object" } }
            },
            required: ["documentId", "fieldName", "newItems"]
          }
        },

{
          name: "updateOutcomesPrediction",
          description: isHebrew ? "עדכן תחזית תוצאות" : "Update outcomes prediction",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              updates: { type: "object", additionalProperties: true }
            },
            required: ["documentId", "updates"]
          }
        },

{
          name: "deleteOutcomesPrediction",
          description: isHebrew ? "מחק תחזית" : "Delete prediction",
          parameters: {
            type: "object",
            properties: { documentId: { type: "string" } },
            required: ["documentId"]
          }
        },

{
          name: "addToOutcomesPrediction",
          description: isHebrew ? "הוסף גורם סיכון" : "Add risk factor",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              fieldName: { type: "string" },
              newItems: { type: "array", items: { type: "object" } }
            },
            required: ["documentId", "fieldName", "newItems"]
          }
        },

{
          name: "updateCareGaps",
          description: isHebrew ? "עדכן פערי טיפול" : "Update care gaps",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              updates: { type: "object", additionalProperties: true }
            },
            required: ["documentId", "updates"]
          }
        },

{
          name: "deleteCareGaps",
          description: isHebrew ? "מחק פערי טיפול" : "Delete care gaps",
          parameters: {
            type: "object",
            properties: { documentId: { type: "string" } },
            required: ["documentId"]
          }
        },

{
          name: "addToCareGaps",
          description: isHebrew ? "הוסף פער" : "Add gap",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              fieldName: { type: "string" },
              newItems: { type: "array", items: { type: "object" } }
            },
            required: ["documentId", "fieldName", "newItems"]
          }
        },

{
          name: "updatePatientEducationContext",
          description: isHebrew ? "עדכן הקשר חינוכי" : "Update patient education context",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              updates: { type: "object", additionalProperties: true }
            },
            required: ["documentId", "updates"]
          }
        },

{
          name: "deletePatientEducationContext",
          description: isHebrew ? "מחק הקשר חינוכי" : "Delete education context",
          parameters: {
            type: "object",
            properties: { documentId: { type: "string" } },
            required: ["documentId"]
          }
        },

{
          name: "addToPatientEducationContext",
          description: isHebrew ? "הוסף חומר לימוד" : "Add educational material",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              fieldName: { type: "string" },
              newItems: { type: "array", items: { type: "object" } }
            },
            required: ["documentId", "fieldName", "newItems"]
          }
        },

{
          name: "getClinicInfo",
          description: isHebrew
            ? "הצג פרטי מרפאה (למנהלים בלבד)"
            : "Get practice information (administrators only)",
          parameters: {
            type: "object",
            properties: {
              includeStats: { type: "boolean", description: isHebrew ? "כלול סטטיסטיקות" : "Include statistics" },
              includeFinancial: { type: "boolean", description: isHebrew ? "כלול נתונים פיננסיים (מנהלי מערכת בלבד)" : "Include financial data (system admins only)" }
            }
          }
        },

{
          name: "getClinicAddress",
          description: isHebrew 
            ? "חפש או הצג כתובת מרפאה - משתמש ב-Google Places API"
            : "Search or get practice address - uses Google Places API",
          parameters: {
            type: "object",
            properties: {
              practiceName: { type: "string", description: isHebrew ? "שם המרפאה לחיפוש" : "Practice name to search for" },
              searchQuery: { type: "string", description: isHebrew ? "מילת חיפוש חופשית" : "Free text search query" },
              includeAllClinics: { type: "boolean", description: isHebrew ? "הצג כל המרפאות במערכת" : "Show all practices in system" }
            }
          }
        },

{
          name: "updateClinicSettings",
          description: isHebrew 
            ? "עדכן הגדרות מרפאה"
            : "Update practice settings",
          parameters: {
            type: "object",
            properties: {
              workingHours: { type: "object", description: isHebrew ? "שעות פעילות" : "Working hours" },
              appointmentDuration: { type: "number", description: isHebrew ? "משך תור ברירת מחדל" : "Default appointment duration" },
              autoReminders: { type: "boolean", description: isHebrew ? "תזכורות אוטומטיות" : "Auto reminders" },
              language: { type: "string", description: isHebrew ? "שפת ברירת מחדל" : "Default language" }
            }
          }
        },

{
          name: "getClinicStatistics",
          description: isHebrew 
            ? "הצג סטטיסטיקות מרפאה"
            : "Get practice statistics",
          parameters: {
            type: "object",
            properties: {
              period: { type: "string", description: isHebrew ? "תקופה" : "Period", enum: ["today", "week", "month", "quarter", "year"] },
              metrics: { type: "array", items: { type: "string" }, description: isHebrew ? "מטריקות" : "Metrics" }
            },
            required: ["period"]
          }
        },

{
          name: "verifyInsurance",
          description: isHebrew 
            ? "אמת ביטוח רפואי"
            : "Verify medical insurance",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              insuranceInfo: {
                type: "object",
                description: isHebrew
                  ? "מידע ביטוח (אובייקט עם provider, policyNumber). אופציונלי אם מספקים insuranceProvider ו-policyNumber בנפרד"
                  : "Insurance information object (with provider, policyNumber fields). Optional if providing insuranceProvider and policyNumber separately"
              },
              insuranceProvider: { type: "string", description: isHebrew ? "חברת ביטוח" : "Insurance provider name (e.g., 'Blue Cross', 'Aetna', 'UnitedHealthcare')" },
              policyNumber: { type: "string", description: isHebrew ? "מספר פוליסה" : "Policy number" },
              service: {
                type: "string",
                description: isHebrew
                  ? "שירות לבדיקה (לדוגמה: 'MRI', 'Surgery', 'Physical Therapy')"
                  : "Service to verify (e.g., 'MRI', 'Surgery', 'Physical Therapy'). Use this field for service name, NOT just serviceType"
              },
              serviceType: { type: "string", description: isHebrew ? "סוג שירות" : "Service type category (e.g., 'imaging', 'procedure', 'therapy')" },
              medication: {
                type: "string",
                description: isHebrew
                  ? "שם תרופה לבדיקת כיסוי (לדוגמה: 'Humira', 'Lipitor'). אופציונלי"
                  : "Medication name to verify coverage (e.g., 'Humira', 'Lipitor', 'Advair'). Optional"
              }
            },
            required: ["patientId"]
          }
        },

{
          name: "submitInsuranceClaim",
          description: isHebrew
            ? "הגש תביעת ביטוח"
            : "Submit insurance claim",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              serviceDate: { type: "string", description: isHebrew ? "תאריך שירות" : "Service date" },
              serviceType: { type: "string", description: isHebrew ? "סוג שירות" : "Service type" },
              amount: { type: "number", description: isHebrew ? "סכום" : "Amount" },
              diagnosisCodes: { type: "array", items: { type: "string" }, description: isHebrew ? "קודי אבחנה" : "Diagnosis codes" }
            },
            required: ["patientId", "serviceDate", "serviceType", "amount"]
          }
        },

{
          name: "checkMedicationCoverageAPI",
          description: isHebrew
            ? "בדוק כיסוי ביטוחי לתרופה באמצעות API של CMS (זמין החל מינואר 2027). מחזיר מידע על דרגה, תשלום משותף, אישור מוקדם, טיפול צעדי, והגבלות כמות. העדף שימוש ב-RxCUI להתאמה מדויקת"
            : "Check medication insurance coverage using CMS Formulary API (available January 2027). Returns tier, copay, prior authorization, step therapy, and quantity limits. Prefer using RxCUI for exact match. NOTE: Currently returns 'not configured' error until insurance companies implement mandate - use verifyInsurance for hardcoded rules until then",
          parameters: {
            type: "object",
            properties: {
              insuranceCompany: {
                type: "string",
                description: isHebrew
                  ? "שם חברת הביטוח (לדוגמה: 'aetna', 'bluecross', 'uhc', 'cigna'). השתמש באותיות קטנות"
                  : "Insurance company identifier (e.g., 'aetna', 'bluecross', 'uhc', 'cigna'). Use lowercase. Use this field, NOT 'insuranceProvider'"
              },
              medication: {
                type: "string",
                description: isHebrew
                  ? "שם התרופה (התאמה מטושטשת, עשוי להחזיר מספר תוצאות). לדוגמה: 'metformin', 'lisinopril', 'atorvastatin'"
                  : "Medication name for fuzzy search (e.g., 'metformin', 'lisinopril', 'atorvastatin'). May return multiple matches. Use this OR rxcui, not both"
              },
              rxcui: {
                type: "string",
                description: isHebrew
                  ? "מזהה RxCUI (RXNORM) להתאמה מדויקת של תרופה. מועדף על פני שם תרופה. לדוגמה: '209459' עבור Acetaminophen 500 MG"
                  : "RxCUI (RXNORM identifier) for exact medication match (e.g., '209459' for Acetaminophen 500 MG). PREFERRED over medication name for accuracy. Use this field, NOT 'rxnormId' or 'drugId'"
              },
              planId: {
                type: "string",
                description: isHebrew
                  ? "מזהה תוכנית ספציפית לבדיקה (אופציונלי). אם לא מסופק, בודק בכל התוכניות הזמינות"
                  : "Optional specific plan ID to check (e.g., 'AETNA-GOLD-2027'). If not provided, checks all available plans for this insurer"
              }
            },
            required: ["insuranceCompany"]
          }
        },

{
          name: "createAppointment",
          description: isHebrew ? "צור תור חדש" : "Create new appointment"
        },

{
          name: "getAppointments",
          description: isHebrew ? "הצג תורים של מטופל" : "Get patient appointments",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status", enum: ["scheduled", "completed", "cancelled", "no-show"] },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date" }
            },
            required: ["patientId"]
          }
        },

{
          name: "cancelAppointment",
          description: isHebrew ? "בטל תור - מסמן את התור כ'מבוטל' אך שומר אותו בהיסטוריה" : "Cancel appointment - marks as 'cancelled' but keeps in history",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string", description: isHebrew ? "מזהה תור" : "Appointment ID" },
              appointmentNumber: { type: "string", description: isHebrew ? "מספר תור" : "Appointment number (alternative identifier)" },
              reason: { type: "string", description: isHebrew ? "סיבת ביטול" : "Cancellation reason" }
            },
            required: ["appointmentId"]
          }
        },

{
          name: "deleteAppointment",
          description: isHebrew ? "מחק תור לצמיתות - מסיר את התור לחלוטין מהמערכת" : "Permanently delete appointment - completely removes from system",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string", description: isHebrew ? "מזהה תור" : "Appointment ID" },
              appointmentNumber: { type: "string", description: isHebrew ? "מספר תור" : "Appointment number (alternative identifier)" },
              reason: { type: "string", description: isHebrew ? "סיבת מחיקה" : "Deletion reason" }
            },
            required: ["appointmentId"]
          }
        },

{
          name: "reinstateAppointment",
          description: isHebrew ? "החזר תור מבוטל - משנה תור מבוטל בחזרה לסטטוס 'מתוזמן'" : "Reinstate cancelled appointment - changes cancelled appointment back to 'scheduled' status",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string", description: isHebrew ? "מזהה תור" : "Appointment ID" },
              appointmentNumber: { type: "string", description: isHebrew ? "מספר תור" : "Appointment number" },
              reason: { type: "string", description: isHebrew ? "סיבת החזרה" : "Reason for reinstatement" }
            },
            required: []
          }
        },

{
          name: "getCancelledAppointments",
          description: isHebrew ? "הצג תורים מבוטלים - מציג רק תורים שבוטלו (לא נמחקו)" : "Show cancelled appointments - displays only cancelled (not deleted) appointments",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (אופציונלי)" : "Patient ID (optional)" },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא (אופציונלי)" : "Provider ID (optional)" },
              dateFrom: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              dateTo: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות מקסימלי" : "Maximum results" }
            }
          }
        },

{
          name: "getTodayAppointments",
          description: isHebrew ? "הצג תורים להיום" : "Get today's appointments",
          parameters: {
            type: "object",
            properties: {
              providerId: { type: "string", description: isHebrew ? "מזהה רופא (אופציונלי - ישתמש ברופא המחובר)" : "Provider ID (optional - uses authenticated provider)" }
            }
          }
        },

{
          name: "getOverdueAppointments",
          description: isHebrew ? "הצג תורים שעברו" : "Get overdue appointments",
          parameters: {
            type: "object",
            properties: {}
          }
        },

        // ========== REMINDERS (SYSTEM/OPERATIONAL) ==========
        {
          name: "getReminders",
          description: isHebrew ? "הצג תזכורות של מטופל" : "Get patient reminders and notifications",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (ISO format)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (ISO format)" },
              reminderType: { type: "string", description: isHebrew ? "סוג תזכורת" : "Reminder type (email, sms, push)" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status (scheduled, sent, delivered, failed)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות מקסימלי" : "Maximum number of results" }
            },
            required: ["patientId"]
          }
        },

        {
          name: "createReminder",
          description: isHebrew ? "צור תזכורת חדשה למטופל" : "Create a new reminder for patient",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              reminderType: { type: "string", description: isHebrew ? "סוג תזכורת" : "Reminder type (email, sms, push)" },
              dateTime: { type: "string", description: isHebrew ? "תאריך ושעה" : "Date and time (ISO format)" },
              appointmentId: { type: "string", description: isHebrew ? "מזהה תור" : "Appointment ID (optional)" },
              message: { type: "string", description: isHebrew ? "הודעה" : "Reminder message" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status (scheduled, sent)" }
            },
            required: ["patientId", "reminderType", "dateTime", "message"]
          }
        },

        {
          name: "updateReminder",
          description: isHebrew ? "עדכן תזכורת קיימת" : "Update an existing reminder",
          parameters: {
            type: "object",
            properties: {
              recordId: { type: "string", description: isHebrew ? "מזהה תזכורת" : "Reminder ID" },
              reminderType: { type: "string", description: isHebrew ? "סוג תזכורת" : "Reminder type" },
              dateTime: { type: "string", description: isHebrew ? "תאריך ושעה" : "Date and time" },
              message: { type: "string", description: isHebrew ? "הודעה" : "Message" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status" }
            },
            required: ["recordId"]
          }
        },

        {
          name: "deleteReminder",
          description: isHebrew ? "מחק תזכורת" : "Delete a reminder",
          parameters: {
            type: "object",
            properties: {
              recordId: { type: "string", description: isHebrew ? "מזהה תזכורת" : "Reminder ID" }
            },
            required: ["recordId"]
          }
        },

        {
          name: "searchReminders",
          description: isHebrew ? "חפש תזכורות לפי טקסט" : "Search reminders by text",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              searchText: { type: "string", description: isHebrew ? "טקסט לחיפוש" : "Search text" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות מקסימלי" : "Maximum results" }
            },
            required: ["patientId", "searchText"]
          }
        },

{
          name: "getInsuranceDetails",
          description: isHebrew ? "הצג פרטי ביטוח" : "Get insurance details",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" }
            },
            required: ["patientId"]
          }
        },

{
          name: "updateInsurance",
          description: isHebrew ? "עדכן פרטי ביטוח" : "Update insurance details",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              provider: { type: "string", description: isHebrew ? "חברת ביטוח" : "Insurance provider" },
              policyNumber: { type: "string", description: isHebrew ? "מספר פוליסה" : "Policy number" },
              groupNumber: { type: "string", description: isHebrew ? "מספר קבוצה" : "Group number" },
              validFrom: { type: "string", description: isHebrew ? "תקף מתאריך" : "Valid from" },
              validTo: { type: "string", description: isHebrew ? "תקף עד" : "Valid to" }
            },
            required: ["patientId", "provider", "policyNumber"]
          }
        },

{
          name: "orderImaging",
          description: isHebrew ? "הזמן בדיקת דימות" : "Order imaging study",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              imagingType: { type: "string", description: isHebrew ? "סוג דימות" : "Imaging type", enum: ["X-Ray", "CT", "MRI", "Ultrasound", "PET"] },
              bodyPart: { type: "string", description: isHebrew ? "איבר" : "Body part" },
              indication: { type: "string", description: isHebrew ? "אינדיקציה" : "Indication" },
              urgency: { type: "string", description: isHebrew ? "דחיפות" : "Urgency", enum: ["routine", "urgent", "stat"] }
            },
            required: ["patientId", "imagingType", "bodyPart", "indication"]
          }
        },

{
          name: "uploadImagingResult",
          description: isHebrew ? "העלה תוצאת דימות" : "Upload imaging result",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              imagingType: { type: "string", description: isHebrew ? "סוג דימות" : "Imaging type" },
              performedDate: { type: "string", description: isHebrew ? "תאריך ביצוע" : "Performed date" },
              findings: { type: "string", description: isHebrew ? "ממצאים" : "Findings" },
              impression: { type: "string", description: isHebrew ? "רושם" : "Impression" },
              radiologist: { type: "string", description: isHebrew ? "רדיולוג" : "Radiologist" }
            },
            required: ["patientId", "imagingType", "performedDate", "findings"]
          }
        },

// ========== MEDICAL IMAGE ANALYSIS (Claude Vision) ==========
{
          name: "analyzeMedicalImage",
          description: isHebrew
            ? "נתח תמונה רפואית (צילום רנטגן, CT, MRI, אולטרסאונד, ממוגרפיה) באמצעות AI. התמונה חייבת להיות מועלית קודם דרך הצ'אט. מחזיר דוח רדיולוגי מובנה עם ממצאים, רושם והמלצות. התמונה מוצפנת ונשמרת במסד הנתונים."
            : "Analyze a medical image (X-ray, CT, MRI, Ultrasound, Mammogram, PET) using Claude Vision AI. The image MUST be uploaded first via the chat file upload. Returns a structured radiology report with technique, findings, impression, recommendations, and urgency level. The image is encrypted and saved to the medical_images collection linked to the patient. Use this when a user uploads a medical image and asks you to analyze it. Do NOT use analyzeUploadedDocuments for medical images - use this function instead.",
          parameters: {
            type: "object",
            properties: {
              uploadId: {
                type: "string",
                description: isHebrew
                  ? "מזהה ההעלאה מהצ'אט (מתקבל כשהמשתמש מעלה קובץ). דוגמה: 'batch_1738000000000_abc123'"
                  : "Upload ID from the chat file upload (received when user uploads a file). Example: 'batch_1738000000000_abc123'. Use this ID, NOT a file path or URL."
              },
              patientId: {
                type: "string",
                description: isHebrew
                  ? "מזהה המטופל. חובה. דוגמה: '507f1f77bcf86cd799439011'"
                  : "Patient ID. Required. Example: '507f1f77bcf86cd799439011'. If unknown, ask the user which patient this image belongs to."
              },
              modality: {
                type: "string",
                description: isHebrew
                  ? "סוג הדימות. אם לא ידוע, השתמש ב-general והמערכת תזהה אוטומטית."
                  : "Imaging modality. If unknown, use 'general' and the system will auto-detect. Examples: 'xray' for chest/bone X-rays, 'ct' for CT scans, 'mri' for MRI studies, 'ultrasound' for ultrasound, 'mammogram' for breast imaging, 'pet' for PET scans.",
                enum: ["xray", "ct", "mri", "ultrasound", "mammogram", "pet", "general"]
              },
              bodyPart: {
                type: "string",
                description: isHebrew
                  ? "חלק הגוף שצולם. דוגמה: 'chest', 'brain', 'knee', 'abdomen'"
                  : "Body part examined. Examples: 'chest', 'brain', 'knee', 'abdomen', 'spine', 'shoulder', 'pelvis'. Optional but improves analysis accuracy."
              },
              clinicalHistory: {
                type: "string",
                description: isHebrew
                  ? "היסטוריה קלינית רלוונטית. דוגמה: 'כאב בחזה חד שהחל לפני 3 ימים'"
                  : "Relevant clinical history for context. Examples: 'Acute chest pain started 3 days ago', 'Follow-up after knee replacement', 'Screening mammogram age 50'. Optional but significantly improves analysis."
              }
            },
            required: ["uploadId", "patientId"]
          }
        },

{
          name: "compareMedicalImages",
          description: isHebrew
            ? "השווה שתי תמונות רפואיות (לפני ואחרי, מעקב). שתי התמונות חייבות להיות מועלות דרך הצ'אט. מחזיר דוח השוואה עם שינויים, התקדמות וממצאים חדשים."
            : "Compare two medical images (e.g., prior vs current study, pre/post treatment). Both images MUST be uploaded via chat. Returns comparison report with changes, progression (improved/worsened/stable), new findings, resolved findings, and recommendations. Use when user uploads two images and asks to compare them.",
          parameters: {
            type: "object",
            properties: {
              uploadId1: {
                type: "string",
                description: isHebrew
                  ? "מזהה ההעלאה של התמונה הראשונה (קודמת)"
                  : "Upload ID of the first (prior/baseline) image. Example: 'batch_1738000000000_abc123'"
              },
              uploadId2: {
                type: "string",
                description: isHebrew
                  ? "מזהה ההעלאה של התמונה השנייה (נוכחית)"
                  : "Upload ID of the second (current/follow-up) image. Example: 'batch_1738000000001_def456'"
              },
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה המטופל" : "Patient ID. Required."
              },
              modality: {
                type: "string",
                description: isHebrew ? "סוג הדימות" : "Imaging modality (same for both images)",
                enum: ["xray", "ct", "mri", "ultrasound", "mammogram", "pet", "general"]
              },
              clinicalHistory: {
                type: "string",
                description: isHebrew ? "היסטוריה קלינית רלוונטית" : "Relevant clinical history for comparison context"
              }
            },
            required: ["uploadId1", "uploadId2", "patientId"]
          }
        },

{
          name: "getMedicalImageHistory",
          description: isHebrew
            ? "קבל היסטוריית תמונות רפואיות של מטופל. מחזיר רשימת כל התמונות שהועלו ונותחו כולל סיכום ממצאים."
            : "Get patient's medical image analysis history. Returns list of all uploaded and analyzed medical images with analysis summaries (impression, urgency, modality). Does NOT return the actual images, only metadata and analysis results. Use to review past imaging analyses.",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה המטופל" : "Patient ID. Required."
              },
              modality: {
                type: "string",
                description: isHebrew ? "סנן לפי סוג דימות" : "Filter by imaging modality. Leave empty for all types.",
                enum: ["xray", "ct", "mri", "ultrasound", "mammogram", "pet", "general"]
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר תוצאות מרבי" : "Maximum number of results. Default: 20"
              }
            },
            required: ["patientId"]
          }
        },

// ========== BLUE BUTTON 2.0 / MEDICARE IMPORT ==========
{
          name: "startMedicareImport",
          description: isHebrew
            ? "התחל ייבוא נתוני מדיקר עבור מטופל. המטופל יתבקש להתחבר למדיקר.gov כדי לאשר שיתוף נתונים. מחזיר קישור שהמטופל צריך ללחוץ עליו. השתמש כשצוות המרפאה רוצה לייבא היסטוריית תביעות, כיסוי ביטוחי ודמוגרפיה ממדיקר."
            : "Start Medicare data import for a patient using CMS Blue Button 2.0. Returns an authUrl field containing the patient link. IMPORTANT: Display the authUrl as a raw URL (NOT markdown) so the patient can click it. Also display the message field. Use checkMedicareImportStatus to check if the patient completed the import.",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew
                  ? "מזהה המטופל (אופציונלי). אם לא ידוע, המערכת תיצור מטופל חדש מנתוני מדיקר."
                  : "Patient ID (optional). If provided, Medicare data will be linked to this patient. If not provided, a new patient record can be created from the imported Medicare data."
              }
            },
            required: []
          }
        },

{
          name: "checkMedicareImportStatus",
          description: isHebrew
            ? "בדוק אם המטופל סיים את ייבוא נתוני מדיקר. מחזיר סטטוס (ממתין/הושלם) ונתוני מטופל אם הייבוא הושלם."
            : "Check if a patient has completed the Medicare data import process. Returns the import status (pending/completed) and imported patient data if completed. Patient data includes: demographics (name, DOB, address), insurance coverage (Part A, B, D, Medicare Advantage), medical history (diagnoses, procedures from claims), and provider list. Use this after calling startMedicareImport to poll for completion.",
          parameters: {
            type: "object",
            properties: {
              importSessionId: {
                type: "string",
                description: isHebrew
                  ? "מזהה סשן הייבוא שהתקבל מ-startMedicareImport. דוגמה: 'import_1738000000000_abc123def'"
                  : "Import session ID returned by startMedicareImport. Example: 'import_1738000000000_abc123def'. Use this exact ID, NOT a patient ID."
              }
            },
            required: ["importSessionId"]
          }
        },

{
          name: "updateReferralStatus",
          description: isHebrew ? "עדכן סטטוס הפניה" : "Update referral status",
          parameters: {
            type: "object",
            properties: {
              referralId: { type: "string", description: isHebrew ? "מזהה הפניה" : "Referral ID" },
              status: { type: "string", description: isHebrew ? "סטטוס חדש" : "New status", enum: ["pending", "approved", "completed", "expired"] },
              notes: { type: "string", description: isHebrew ? "הערות" : "Notes" }
            },
            required: ["referralId", "status"]
          }
        },

{
          name: "searchDrugInformation",
          description: isHebrew ? "חפש מידע על תרופה במאגר FDA" : "Search drug information in FDA database",
          parameters: {
            type: "object",
            properties: {
              drugName: { type: "string", description: isHebrew ? "שם התרופה" : "Drug name" },
              ndc: { type: "string", description: isHebrew ? "מספר NDC" : "NDC number" },
              limit: { type: "number", description: isHebrew ? "מגבלת תוצאות" : "Result limit" }
            },
            required: ["drugName"]
          }
        },

{
          name: "searchApiDoctors",
          description: isHebrew ? "חפש בספריית הבריאות החיצונית של CMS/BetterDoctor - רק כאשר המשתמש מבקש חיפוש חיצוני" : "Search the external CMS/BetterDoctor healthcare directory (ONLY use when the user explicitly requests an external API or directory search, NOT for internal doctor lookup)",
          parameters: {
            type: "object",
            properties: {
              specialty: { type: "string", description: isHebrew ? "התמחות" : "Medical specialty" },
              location: { type: "string", description: isHebrew ? "מיקום" : "Location (city, state, or zip)" },
              insuranceNetwork: { type: "string", description: isHebrew ? "רשת ביטוח" : "Insurance network" },
              radius: { type: "number", description: isHebrew ? "רדיוס חיפוש במיילים" : "Search radius in miles" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            }
          }
        },

{
          name: "getDoctorByNPI",
          description: isHebrew ? "הצג רופא לפי מספר NPI" : "Get doctor by NPI number",
          parameters: {
            type: "object",
            properties: {
              npi: { type: "string", description: isHebrew ? "מספר NPI" : "NPI number" }
            },
            required: ["npi"]
          }
        },

{
          name: "verifyInsuranceNetwork",
          description: isHebrew ? "אמת רשת ביטוח של ספק" : "Verify provider insurance network",
          parameters: {
            type: "object",
            properties: {
              providerNPI: { type: "string", description: isHebrew ? "מספר NPI של הספק" : "Provider NPI number" },
              insurancePlan: { type: "string", description: isHebrew ? "תוכנית ביטוח" : "Insurance plan" }
            },
            required: ["providerNPI", "insurancePlan"]
          }
        },

{
          name: "getDoctorSpecialties",
          description: isHebrew ? "הצג רשימת התמחויות רפואיות" : "Get list of medical specialties",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "testExternalAPIConnection",
          description: isHebrew ? "בדק חיבור לAPI חיצוני" : "Test external API connection",
          parameters: {
            type: "object",
            properties: {
              providerId: { 
                type: "string", 
                description: isHebrew ? "מזהה ספק API" : "API provider ID",
                enum: ["openFDA", "cms", "clinicalTrials", "pubmed", "betterDoctor"]
              }
            },
            required: ["providerId"]
          }
        },

{
          name: "getExternalAPIHealth",
          description: isHebrew ? "הצג מצב בריאות APIs חיצוניים" : "Get external APIs health status",
          parameters: {
            type: "object",
            properties: {
              providerId: { type: "string", description: isHebrew ? "מזהה ספק API (אופציונלי)" : "API provider ID (optional)" }
            }
          }
        },

{
          name: "clearExternalAPICache",
          description: isHebrew ? "נקה מטמון APIs חיצוניים" : "Clear external APIs cache",
          parameters: {
            type: "object",
            properties: {
              providerId: { type: "string", description: isHebrew ? "מזהה ספק API (אופציונלי)" : "API provider ID (optional)" }
            }
          }
        },

{
          name: "searchMedicalDevices", 
          description: isHebrew ? "חפש מכשירים רפואיים במאגר FDA" : "Search FDA medical device database",
          parameters: {
            type: "object",
            properties: {
              deviceName: { type: "string", description: isHebrew ? "שם המכשיר" : "Device name" },
              deviceClass: {
                type: "string",
                description: isHebrew ? "סיווג מכשיר" : "Device classification",
                enum: ["Class I", "Class II", "Class III", "all"]
              },
              manufacturer: { type: "string", description: isHebrew ? "יצרן" : "Manufacturer" }
            },
            required: ["deviceName"]
          }
        },

{
          name: "checkDrugAdverseEvents",
          description: isHebrew ? "בדוק אירועים לוואיים של תרופה" : "Check drug adverse events from FDA FAERS database",
          parameters: {
            type: "object",
            properties: {
              drugName: { type: "string", description: isHebrew ? "שם התרופה" : "Drug name" },
              seriousOnly: { type: "boolean", description: isHebrew ? "רק אירועים חמורים" : "Serious events only" },
              ageGroup: { type: "string", description: isHebrew ? "קבוצת גיל" : "Age group" }
            },
            required: ["drugName"]
          }
        },

        // ========== FDA DRUG SHORTAGES ==========
        {
          name: "getDrugShortages",
          description: isHebrew
            ? "קבל רשימת מחסורים בתרופות מ-FDA. שימושי לבדיקה אם תרופה מסוימת במחסור ולמציאת חלופות."
            : "Get current drug shortages from FDA. Useful for checking if a specific medication is in shortage and finding alternatives. Example: 'Is metformin in shortage?' or 'What drugs are currently in shortage?'",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה לחיפוש (אופציונלי)" : "Drug name to search for (optional). Example: 'Metformin', 'Amoxicillin'"
              },
              status: {
                type: "string",
                description: isHebrew ? "סטטוס מחסור" : "Shortage status filter",
                enum: ["current", "resolved", "discontinued", "all"]
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר תוצאות מקסימלי" : "Maximum number of results (default: 50)"
              }
            },
            required: []
          }
        },

        // ========== FDA DRUG RECALLS ==========
        {
          name: "getDrugRecalls",
          description: isHebrew
            ? "קבל החזרות תרופות מ-FDA. בדוק אם תרופה ספציפית הוחזרה או קבל רשימת החזרות אחרונות."
            : "Get drug recalls from FDA. Check if a specific medication has been recalled or get recent recalls. Example: 'Has lisinopril been recalled?' or 'What are the recent Class I drug recalls?'",
          parameters: {
            type: "object",
            properties: {
              drugName: {
                type: "string",
                description: isHebrew ? "שם התרופה לחיפוש" : "Drug name to search for. Example: 'Metformin', 'Valsartan'"
              },
              classification: {
                type: "string",
                description: isHebrew ? "סיווג החזרה (I=מסוכן, II=עלול לגרום מחלה, III=לא סביר שיגרום נזק)" : "Recall classification. Class I = dangerous/defective, Class II = may cause illness, Class III = unlikely to cause harm",
                enum: ["Class I", "Class II", "Class III", "all"]
              },
              status: {
                type: "string",
                description: isHebrew ? "סטטוס החזרה" : "Recall status",
                enum: ["ongoing", "terminated", "completed", "all"]
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר תוצאות" : "Number of results (default: 20)"
              }
            },
            required: []
          }
        },

        // ========== FDA DEVICE RECALLS ==========
        {
          name: "getDeviceRecalls",
          description: isHebrew
            ? "קבל החזרות מכשור רפואי מ-FDA. בדוק החזרות למכשירים כמו קוצבי לב, משאבות אינסולין, מכשירי CPAP."
            : "Get medical device recalls from FDA. Check recalls for devices like pacemakers, insulin pumps, CPAP machines. Example: 'Are there recalls for Medtronic pacemakers?' or 'Recent Class I device recalls'",
          parameters: {
            type: "object",
            properties: {
              deviceName: {
                type: "string",
                description: isHebrew ? "שם או סוג המכשיר" : "Device name or type. Example: 'pacemaker', 'insulin pump', 'CPAP'"
              },
              manufacturer: {
                type: "string",
                description: isHebrew ? "שם היצרן" : "Manufacturer name. Example: 'Medtronic', 'Abbott', 'Philips'"
              },
              classification: {
                type: "string",
                description: isHebrew ? "סיווג החזרה" : "Recall classification",
                enum: ["Class I", "Class II", "Class III", "all"]
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר תוצאות" : "Number of results (default: 20)"
              }
            },
            required: []
          }
        },

        // ========== FDA DEVICE ADVERSE EVENTS ==========
        {
          name: "getDeviceAdverseEvents",
          description: isHebrew
            ? "קבל דיווחי אירועים לוואיים למכשור רפואי מ-FDA MAUDE database."
            : "Get adverse event reports for medical devices from FDA MAUDE database. Example: 'Adverse events reported for hip implants' or 'Safety issues with insulin pumps'",
          parameters: {
            type: "object",
            properties: {
              deviceName: {
                type: "string",
                description: isHebrew ? "שם המכשיר" : "Device name. Example: 'hip implant', 'insulin pump', 'defibrillator'"
              },
              manufacturer: {
                type: "string",
                description: isHebrew ? "יצרן" : "Manufacturer name"
              },
              eventType: {
                type: "string",
                description: isHebrew ? "סוג אירוע" : "Event type filter",
                enum: ["death", "injury", "malfunction", "all"]
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר תוצאות" : "Number of results (default: 20)"
              }
            },
            required: ["deviceName"]
          }
        },

        // ========== FDA DEVICE SAFETY PROFILE ==========
        {
          name: "getDeviceSafetyProfile",
          description: isHebrew
            ? "קבל פרופיל בטיחות מלא למכשיר רפואי - כולל החזרות ואירועים לוואיים."
            : "Get complete safety profile for a medical device - including recalls, adverse events, and risk assessment. Example: 'Safety profile for Medtronic pacemaker' or 'Is this insulin pump safe?'",
          parameters: {
            type: "object",
            properties: {
              manufacturer: {
                type: "string",
                description: isHebrew ? "יצרן המכשיר" : "Device manufacturer. Example: 'Medtronic', 'Abbott', 'Boston Scientific'"
              },
              model: {
                type: "string",
                description: isHebrew ? "דגם המכשיר" : "Device model or product name"
              }
            },
            required: ["manufacturer"]
          }
        },

        // ========== FDA FOOD RECALLS ==========
        {
          name: "getFoodRecalls",
          description: isHebrew
            ? "קבל החזרות מזון מ-FDA. שימושי לאלרגיות, זיהומים, ומזון מזוהם."
            : "Get food recalls and enforcement actions from FDA. Useful for allergies, contamination, and food safety alerts. Example: 'Recent food recalls for salmonella' or 'Peanut butter recalls'",
          parameters: {
            type: "object",
            properties: {
              productName: {
                type: "string",
                description: isHebrew ? "שם המוצר" : "Product name to search. Example: 'peanut butter', 'lettuce', 'baby formula'"
              },
              reason: {
                type: "string",
                description: isHebrew ? "סיבת ההחזרה" : "Recall reason",
                enum: ["salmonella", "listeria", "undeclared_allergen", "contamination", "all"]
              },
              classification: {
                type: "string",
                description: isHebrew ? "סיווג" : "Recall classification",
                enum: ["Class I", "Class II", "Class III", "all"]
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר תוצאות" : "Number of results (default: 20)"
              }
            },
            required: []
          }
        },

        // ========== FDA COMPREHENSIVE SEARCH ==========
        {
          name: "searchAllFDACategories",
          description: isHebrew
            ? "חיפוש מקיף בכל מאגרי FDA - תרופות, מכשירים, מזון. שימושי כשלא בטוחים באיזה קטגוריה לחפש."
            : "Comprehensive search across ALL FDA databases - drugs, devices, food. Useful when unsure which category to search. Example: 'Search FDA for metformin' or 'FDA information about Philips CPAP'",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: isHebrew ? "מונח חיפוש" : "Search term. Can be drug name, device name, food product, or manufacturer"
              },
              categories: {
                type: "array",
                items: { type: "string", enum: ["drugs", "devices", "food", "all"] },
                description: isHebrew ? "קטגוריות לחיפוש" : "Categories to search (default: all)"
              }
            },
            required: ["query"]
          }
        },

        // ========== FDA MANUFACTURER COMPLIANCE (DDAPI) ==========
        {
          name: "checkManufacturerCompliance",
          description: isHebrew
            ? "בדוק את מצב התאימות של יצרן תרופות מול FDA - מכתבי אזהרה, ממצאי פיקוח, צווי מניעה. שימושי לפני רישום תרופה מיצרן חדש. השתמש בכלי זה כשמישהו שואל על יצרן תרופות כמו Teva, Pfizer, Mylan."
            : "USE THIS TOOL when user asks about a DRUG MANUFACTURER/COMPANY (NOT a drug name). Checks FDA compliance status including warning letters, inspection findings (FDA 483), and injunctions. Returns risk level (HIGH/MODERATE/LOW). MANUFACTURER EXAMPLES: Teva, Pfizer, Mylan, Sun Pharma, Novartis, Merck, Johnson & Johnson, AbbVie, Bristol-Myers Squibb, Sanofi, GlaxoSmithKline, AstraZeneca, Eli Lilly, Amgen, Gilead. USER QUERY EXAMPLES: 'Does Teva have FDA compliance issues?', 'Is Pfizer a safe manufacturer?', 'Check FDA history for Mylan', 'Any warning letters for Sun Pharma?'. DO NOT use searchDrugInformation for manufacturer queries - that tool is for DRUG NAMES like Lisinopril, Metformin.",
          parameters: {
            type: "object",
            properties: {
              firmName: {
                type: "string",
                description: isHebrew ? "שם היצרן (לא שם התרופה!)" : "MANUFACTURER/COMPANY name (NOT drug name!). Examples: 'Pfizer', 'Teva', 'Mylan', 'Sun Pharma', 'Novartis'. If user says 'Teva' they mean the manufacturer, not a drug."
              }
            },
            required: ["firmName"]
          }
        },

        // ========== FDA INSPECTION CITATIONS ==========
        {
          name: "getInspectionCitations",
          description: isHebrew
            ? "קבל ממצאי פיקוח FDA (טפסי 483) עבור יצרן. מציג הפרות ותצפיות מבדיקות FDA. שימושי לבדיקת היסטוריית פיקוח של יצרנים."
            : "Get FDA Form 483 inspection citations/observations for a MANUFACTURER. Shows violations found during FDA facility inspections. Use when user asks about specific inspection findings, 483 forms, or manufacturing violations. EXAMPLES: 'FDA 483 findings for Teva', 'Inspection violations at generic drug manufacturers', 'What violations did FDA find at Pfizer?'. Returns: citation details, violation descriptions, inspection dates.",
          parameters: {
            type: "object",
            properties: {
              firmName: {
                type: "string",
                description: isHebrew ? "שם היצרן" : "MANUFACTURER name to search (e.g., 'Teva', 'Pfizer', 'Mylan')"
              },
              productType: {
                type: "string",
                description: isHebrew ? "סוג מוצר" : "Product type filter",
                enum: ["Drugs", "Devices", "Food", "Biologics", "all"]
              },
              fiscalYear: {
                type: "string",
                description: isHebrew ? "שנת כספים" : "Fiscal year filter. Example: '2024', '2023'"
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר תוצאות" : "Number of results (default: 50)"
              }
            },
            required: []
          }
        },

        // ========== FDA COMPLIANCE ACTIONS (WARNING LETTERS) ==========
        {
          name: "getComplianceActions",
          description: isHebrew
            ? "קבל פעולות אכיפה של FDA - מכתבי אזהרה, צווי מניעה, תפיסות. מראה פעולות רגולטוריות נגד יצרנים."
            : "Get FDA enforcement actions against MANUFACTURERS - warning letters, injunctions, seizures, consent decrees. Use when user asks about regulatory actions, warning letters, or FDA enforcement. EXAMPLES: 'FDA warning letters to drug manufacturers', 'Has Teva received warning letters?', 'Recent FDA enforcement actions', 'Injunctions against pharmaceutical companies'. Returns: action type, issue date, subject matter.",
          parameters: {
            type: "object",
            properties: {
              firmName: {
                type: "string",
                description: isHebrew ? "שם היצרן" : "MANUFACTURER name to search (e.g., 'Teva', 'Pfizer')"
              },
              actionType: {
                type: "string",
                description: isHebrew ? "סוג פעולה" : "Type of enforcement action filter",
                enum: ["Warning Letter", "Injunction", "Seizure", "Consent Decree", "all"]
              },
              productType: {
                type: "string",
                description: isHebrew ? "סוג מוצר" : "Product type filter",
                enum: ["Drugs", "Devices", "Food", "Biologics", "all"]
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר תוצאות" : "Number of results (default: 50)"
              }
            },
            required: []
          }
        },

        // ========== FDA FACILITY REGISTRATION (FEI API) ==========
        {
          name: "checkFacilityRegistration",
          description: isHebrew
            ? "בדוק אם יצרן/מפעל רשום ב-FDA. מראה רישום מתקנים, סוגי מוצרים מורשים, וכתובות. שימושי לאימות לפני עבודה עם יצרן."
            : "Check if a MANUFACTURER/FACILITY is FDA registered. Shows facility registration status, product types they are authorized to produce, and facility locations. Use when user asks about FDA registration status, facility verification, or where a drug is manufactured. EXAMPLES: 'Is Teva FDA registered?', 'Where are Pfizer facilities?', 'Is this manufacturer legitimate?'. Returns: FEI numbers, addresses, registration status, authorized product types.",
          parameters: {
            type: "object",
            properties: {
              firmName: {
                type: "string",
                description: isHebrew ? "שם היצרן/מפעל" : "MANUFACTURER or FACILITY name to search (e.g., 'Teva', 'Pfizer', 'Mylan')"
              }
            },
            required: ["firmName"]
          }
        },
        {
          name: "getFacilityByFEI",
          description: isHebrew
            ? "קבל פרטי מפעל לפי מספר FEI (מזהה מפעל FDA). שימושי כשיש לך מספר FEI ספציפי מממצאי פיקוח."
            : "Get facility details by FDA Establishment Identifier (FEI) number. Use when you have a specific FEI number from inspection findings or compliance actions. EXAMPLES: 'What facility is FEI 3004249948?', 'Look up FEI number from warning letter'. Returns: facility name, address, registration status, product types.",
          parameters: {
            type: "object",
            properties: {
              feiNumber: {
                type: "string",
                description: isHebrew ? "מספר FEI (מזהה מפעל FDA)" : "10-digit FDA Establishment Identifier (FEI) number (e.g., '3004249948')"
              }
            },
            required: ["feiNumber"]
          }
        },

{
          name: "searchHealthInsurancePlans",
          description: isHebrew ? "חפש תוכניות ביטוח בריאות ב-Healthcare.gov" : "Search health insurance plans on Healthcare.gov",
          parameters: {
            type: "object",
            properties: {
              zipCode: { type: "string", description: isHebrew ? "מיקוד" : "ZIP code" },
              householdIncome: { type: "number", description: isHebrew ? "הכנסה שנתית" : "Annual income" },
              householdSize: { type: "number", description: isHebrew ? "גודל משק בית" : "Household size" },
              coverageType: {
                type: "string",
                description: isHebrew ? "סוג כיסוי" : "Coverage type",
                enum: ["individual", "family", "small_business"]
              }
            },
            required: ["zipCode"]
          }
        },

{
          name: "getCDCHealthGuidelines",
          description: isHebrew ? "קבל הנחיות בריאות מ-CDC" : "Get health guidelines from CDC",
          parameters: {
            type: "object",
            properties: {
              topic: { type: "string", description: isHebrew ? "נושא" : "Topic" },
              audience: {
                type: "string",
                description: isHebrew ? "קהל יעד" : "Target audience",
                enum: ["healthcare_providers", "patients", "public", "all"]
              }
            },
            required: ["topic"]
          }
        },

{
          name: "findSubstanceAbuseTreatment",
          description: isHebrew ? "מצא מרכזי טיפול בהתמכרויות מ-SAMHSA" : "Find substance abuse treatment centers from SAMHSA",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string", description: isHebrew ? "מיקום (עיר, מדינה או מיקוד)" : "Location (city, state, or zip)" },
              treatmentType: {
                type: "string",
                description: isHebrew ? "סוג טיפול" : "Treatment type",
                enum: ["outpatient", "inpatient", "detox", "methadone", "all"]
              },
              acceptsMedicaid: { type: "boolean", description: isHebrew ? "מקבל Medicaid" : "Accepts Medicaid" },
              radius: { type: "number", description: isHebrew ? "רדיוס במיילים" : "Radius in miles" }
            },
            required: ["location"]
          }
        },

{
          name: "getHealthProfessionalShortageAreas",
          description: isHebrew ? "זהה אזורי מחסור במקצועות הבריאות מ-HRSA" : "Identify Health Professional Shortage Areas from HRSA",
          parameters: {
            type: "object",
            properties: {
              state: { type: "string", description: isHebrew ? "מדינה" : "State" },
              county: { type: "string", description: isHebrew ? "מחוז" : "County" },
              shortageType: {
                type: "string",
                description: isHebrew ? "סוג מחסור" : "Shortage type",
                enum: ["primary_care", "dental", "mental_health", "all"]
              }
            }
          }
        },

{
          name: "getNutritionData",
          description: isHebrew ? "קבל נתוני תזונה מ-USDA FoodData Central" : "Get nutrition data from USDA FoodData Central",
          parameters: {
            type: "object",
            properties: {
              foodName: { type: "string", description: isHebrew ? "שם מזון" : "Food name" },
              barcode: { type: "string", description: isHebrew ? "ברקוד מוצר" : "Product barcode" },
              nutrients: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "רכיבים תזונתיים ספציפיים" : "Specific nutrients"
              }
            },
            required: ["foodName"]
          }
        },

{
          name: "calculateNutritionNeeds",
          description: isHebrew ? "חשב צרכים תזונתיים מותאמים אישית" : "Calculate personalized nutrition needs",
          parameters: {
            type: "object",
            properties: {
              age: { type: "number", description: isHebrew ? "גיל" : "Age" },
              gender: { type: "string", description: isHebrew ? "מין" : "Gender" },
              weight: { type: "number", description: isHebrew ? "משקל (ק״ג)" : "Weight (kg)" },
              height: { type: "number", description: isHebrew ? "גובה (ס״מ)" : "Height (cm)" },
              activityLevel: {
                type: "string",
                description: isHebrew ? "רמת פעילות" : "Activity level",
                enum: ["sedentary", "light", "moderate", "active", "very_active"]
              },
              medicalConditions: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "מצבים רפואיים" : "Medical conditions"
              }
            },
            required: ["age", "gender", "weight", "height"]
          }
        },

{
          name: "getEnvironmentalHealthData",
          description: isHebrew ? "קבל נתוני בריאות סביבתית מ-EPA" : "Get environmental health data from EPA",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string", description: isHebrew ? "מיקום (מיקוד או עיר)" : "Location (zip or city)" },
              dataType: {
                type: "string",
                description: isHebrew ? "סוג נתונים" : "Data type",
                enum: ["air_quality", "water_quality", "toxic_releases", "all"]
              }
            },
            required: ["location"]
          }
        },

{
          name: "createBackup",
          description: isHebrew ? "צור גיבוי" : "Create backup",
          parameters: {
            type: "object",
            properties: {
              backupType: { type: "string", description: isHebrew ? "סוג גיבוי" : "Backup type", enum: ["full", "incremental", "differential"] },
              description: { type: "string", description: isHebrew ? "תיאור" : "Description" }
            },
            required: ["backupType"]
          }
        },

{
          name: "listBackups",
          description: isHebrew ? "הצג גיבויים" : "List backups",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: isHebrew ? "מגבלה" : "Limit" }
            }
          }
        },

{
          name: "restoreBackup",
          description: isHebrew ? "שחזר מגיבוי" : "Restore from backup",
          parameters: {
            type: "object",
            properties: {
              backupId: { type: "string", description: isHebrew ? "מזהה גיבוי" : "Backup ID" },
              targetEnvironment: { type: "string", description: isHebrew ? "סביבת יעד" : "Target environment" }
            },
            required: ["backupId"]
          }
        },

{
          name: "getSystemMetrics",
          description: isHebrew ? "הצג מדדי מערכת" : "Get system metrics",
          parameters: {
            type: "object",
            properties: {
              metricType: { type: "string", description: isHebrew ? "סוג מדד" : "Metric type", enum: ["cpu", "memory", "disk", "network", "all"] },
              period: { type: "string", description: isHebrew ? "תקופה" : "Period" }
            }
          }
        },

{
          name: "optimizeDatabase",
          description: isHebrew ? "בצע אופטימיזציה למסד נתונים" : "Optimize database",
          parameters: {
            type: "object",
            properties: {
              operation: { type: "string", description: isHebrew ? "פעולה" : "Operation", enum: ["reindex", "compact", "analyze", "vacuum"] }
            },
            required: ["operation"]
          }
        },

{
          name: "getDatabaseStats",
          description: isHebrew ? "הצג סטטיסטיקות מסד נתונים" : "Get database statistics",
          parameters: {
            type: "object",
            properties: {
              collection: { type: "string", description: isHebrew ? "אוסף" : "Collection" }
            }
          }
        },

{
          name: "clearCache",
          description: isHebrew ? "נקה מטמון" : "Clear cache",
          parameters: {
            type: "object",
            properties: {
              cacheType: { type: "string", description: isHebrew ? "סוג מטמון" : "Cache type", enum: ["query", "session", "api", "all"] }
            },
            required: ["cacheType"]
          }
        },

{
          name: "deactivateUser",
          description: isHebrew ? "השבת משתמש" : "Deactivate user",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" }
            },
            required: ["userId"]
          }
        },

{
          name: "deleteUser",
          description: isHebrew ? "מחק משתמש לצמיתות (רק למנהל המערכת)" : "Permanently delete user (system admin only)",
          parameters: {
            type: "object",
            properties: {
              email: { 
                type: "string", 
                description: isHebrew 
                  ? "כתובת האימייל של המשתמש למחיקה" 
                  : "Email address of the user to delete" 
              },
              confirmDelete: { type: "boolean", description: isHebrew ? "אישור מחיקה" : "Confirm deletion" },
              reason: { type: "string", description: isHebrew ? "סיבת המחיקה" : "Reason for deletion" }
            },
            required: ["email", "confirmDelete", "reason"]
          }
        },

{
          name: "resetUserPassword",
          description: isHebrew ? "אפס סיסמת משתמש" : "Reset user password",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              temporaryPassword: { type: "string", description: isHebrew ? "סיסמה זמנית" : "Temporary password" }
            },
            required: ["userId"]
          }
        },

{
          name: "sendBulkPatientSMS",
          description: isHebrew 
            ? "שלח SMS המוני למטופלים - למשל 'שלח תזכורת חיסון שפעת לכל המטופלים מעל גיל 65'"
            : "Send bulk SMS to patients - e.g. 'Send flu vaccination reminders to all patients over 65'",
          parameters: {
            type: "object",
            properties: {
              patientFilter: {
                type: "object",
                description: isHebrew ? "סינון מטופלים" : "Patient filter criteria",
                properties: {
                  ageMin: { type: "number", description: isHebrew ? "גיל מינימלי" : "Minimum age" },
                  ageMax: { type: "number", description: isHebrew ? "גיל מקסימלי" : "Maximum age" },
                  gender: { type: "string", description: isHebrew ? "מין" : "Gender", enum: ["male", "female"] },
                  conditions: { type: "array", items: { type: "string" }, description: isHebrew ? "מצבים רפואיים" : "Medical conditions" },
                  insurance: { type: "string", description: isHebrew ? "ביטוח" : "Insurance" },
                  communicationType: { type: "string", enum: ["sms"], description: isHebrew ? "סוג תקשורת" : "Communication type" }
                }
              },
              message: { type: "string", description: isHebrew ? "תוכן ההודעה" : "Message content" },
              campaignName: { type: "string", description: isHebrew ? "שם הקמפיין" : "Campaign name" },
              dryRun: { type: "boolean", description: isHebrew ? "הרצה לדוגמה" : "Dry run (preview only)" }
            },
            required: ["message"]
          }
        },

{
          name: "sendBulkPatientEmail",
          description: isHebrew 
            ? "שלח אימייל המוני למטופלים - למשל 'שלח הוראות לניהול סכרת לכל החולים הסכרתיים'"
            : "Send bulk email to patients - e.g. 'Send diabetes management instructions to all diabetic patients'",
          parameters: {
            type: "object",
            properties: {
              patientFilter: {
                type: "object",
                description: isHebrew ? "סינון מטופלים" : "Patient filter criteria",
                properties: {
                  ageMin: { type: "number", description: isHebrew ? "גיל מינימלי" : "Minimum age" },
                  ageMax: { type: "number", description: isHebrew ? "גיל מקסימלי" : "Maximum age" },
                  gender: { type: "string", description: isHebrew ? "מין" : "Gender", enum: ["male", "female"] },
                  conditions: { type: "array", items: { type: "string" }, description: isHebrew ? "מצבים רפואיים" : "Medical conditions" },
                  insurance: { type: "string", description: isHebrew ? "ביטוח" : "Insurance" },
                  communicationType: { type: "string", enum: ["email"], description: isHebrew ? "סוג תקשורת" : "Communication type" }
                }
              },
              subject: { type: "string", description: isHebrew ? "נושא" : "Subject" },
              body: { type: "string", description: isHebrew ? "תוכן ההודעה" : "Message body" },
              htmlBody: { type: "string", description: isHebrew ? "תוכן HTML" : "HTML body content" },
              campaignName: { type: "string", description: isHebrew ? "שם הקמפיין" : "Campaign name" },
              dryRun: { type: "boolean", description: isHebrew ? "הרצה לדוגמה" : "Dry run (preview only)" }
            },
            required: ["subject", "body"]
          }
        },

{
          name: "sendAppointmentConfirmationRequest",  
          description: isHebrew 
            ? "שלח בקשות אישור תורים - למשל 'שלח אישורי תורים למחר'"
            : "Send appointment confirmation requests - e.g. 'Send appointment confirmations for tomorrow'",
          parameters: {
            type: "object",
            properties: {
              appointmentDate: { type: "string", description: isHebrew ? "תאריך תורים" : "Appointment date" },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא" : "Provider ID" },
              method: { type: "string", enum: ["sms", "email", "both"], description: isHebrew ? "אמצעי תקשורת" : "Communication method" }
            },
            required: []
          }
        },

{
          name: "sendTestResultNotifications",
          description: isHebrew ? "שלח התראות תוצאות בדיקות" : "Send test result notifications",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (אופציונלי)" : "Patient ID (optional)" },
              testType: { type: "string", description: isHebrew ? "סוג בדיקה" : "Test type" },
              method: { type: "string", enum: ["sms", "email", "both"], description: isHebrew ? "אמצעי תקשורת" : "Communication method" }
            },
            required: []
          }
        },

{
          name: "sendMedicationRefillReminders",
          description: isHebrew ? "שלח תזכורות לחידוש מרשמים" : "Send medication refill reminders",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (אופציונלי)" : "Patient ID (optional)" },
              medicationType: { type: "string", description: isHebrew ? "סוג תרופה" : "Medication type" },
              daysBeforeExpiry: { type: "number", description: isHebrew ? "ימים לפני תפוגה" : "Days before expiry", default: 7 },
              method: { type: "string", enum: ["sms", "email", "both"], description: isHebrew ? "אמצעי תקשורת" : "Communication method" }
            },
            required: []
          }
        },

{
          name: "sendPatientPortalMessage",
          description: isHebrew 
            ? "שלח הודעה מאובטחת למטופל דרך פורטל המטופלים"
            : "Send secure message to patient through patient portal",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא (אופציונלי)" : "Provider ID (optional)" },
              message: { type: "string", description: isHebrew ? "תוכן ההודעה" : "Message content" },
              messageType: { 
                type: "string", 
                enum: ["GENERAL_INQUIRY", "PRESCRIPTION_REFILL", "SYMPTOM_REPORT", "APPOINTMENT_REQUEST", "TEST_RESULT_INQUIRY", "FOLLOW_UP"],
                description: isHebrew ? "סוג ההודעה" : "Message type" 
              },
              urgent: { type: "boolean", description: isHebrew ? "הודעה דחופה" : "Urgent message" }
            },
            required: ["patientId", "message"]
          }
        },

{
          name: "reportPatientSymptoms",
          description: isHebrew 
            ? "עבד דיווח תסמינים מהמטופל עם טריאז' אוטומטי"
            : "Process patient symptom report with automatic triage",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              symptoms: { 
                type: "array", 
                items: { type: "string" },
                description: isHebrew ? "רשימת תסמינים" : "List of symptoms" 
              },
              severity: { 
                type: "string", 
                enum: ["mild", "moderate", "severe"],
                description: isHebrew ? "חומרת התסמינים" : "Symptom severity" 
              },
              duration: { type: "string", description: isHebrew ? "משך התסמינים" : "Symptom duration" },
              additionalInfo: { type: "string", description: isHebrew ? "מידע נוסף" : "Additional information" },
              emergencyFlag: { type: "boolean", description: isHebrew ? "דגל חירום" : "Emergency flag" }
            },
            required: ["patientId", "symptoms"]
          }
        },

{
          name: "schedulePatientAppointment",
          description: isHebrew 
            ? "עבד בקשת תיאום תור מהמטופל"
            : "Process patient appointment scheduling request",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא מועדף (אופציונלי)" : "Preferred provider ID (optional)" },
              appointmentType: { type: "string", description: isHebrew ? "סוג התור" : "Appointment type" },
              preferredDate: { type: "string", description: isHebrew ? "תאריך מועדף" : "Preferred date" },
              preferredTime: { type: "string", description: isHebrew ? "שעה מועדפת" : "Preferred time" },
              reason: { type: "string", description: isHebrew ? "סיבת התור" : "Reason for appointment" },
              urgentRequest: { type: "boolean", description: isHebrew ? "בקשה דחופה" : "Urgent request" }
            },
            required: ["patientId", "appointmentType"]
          }
        },

{
          name: "getPatientMessageHistory",
          description: isHebrew 
            ? "הצג היסטוריית הודעות עם מטופל"
            : "Get patient message history and conversation threads",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא (אופציונלי)" : "Provider ID (optional)" },
              threadId: { type: "string", description: isHebrew ? "מזהה שרשור (אופציונלי)" : "Thread ID (optional)" },
              limit: { type: "number", description: isHebrew ? "מספר הודעות מקסימלי" : "Maximum messages", default: 50 }
            },
            required: ["patientId"]
          }
        },

{
          name: "parseTreatment",
          description: isHebrew ? "נתח תיאור טיפול" : "Parse treatment description",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: isHebrew ? "תיאור טיפול" : "Treatment description" },
              language: { type: "string", description: isHebrew ? "שפה" : "Language", enum: ["he", "en"] }
            },
            required: ["text"]
          }
        },

{
          name: "parseSymptoms",
          description: isHebrew ? "נתח סימפטומים" : "Parse symptoms",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: isHebrew ? "תיאור סימפטומים" : "Symptoms description" },
              language: { type: "string", description: isHebrew ? "שפה" : "Language", enum: ["he", "en"] }
            },
            required: ["text"]
          }
        },

{
          name: "parseLabResults",
          description: isHebrew ? "נתח תוצאות מעבדה" : "Parse lab results",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: isHebrew ? "תוצאות מעבדה" : "Lab results text" },
              format: { type: "string", description: isHebrew ? "פורמט" : "Format", enum: ["text", "table", "pdf"] }
            },
            required: ["text"]
          }
        },

{
          name: "getMFAStatus",
          description: isHebrew ? "בדוק סטטוס אימות דו-שלבי" : "Get MFA status",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" }
            }
          }
        },

{
          name: "setupMFA",
          description: isHebrew ? "הגדר אימות דו-שלבי" : "Setup MFA",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              method: { type: "string", description: isHebrew ? "שיטה" : "Method", enum: ["totp", "sms", "email"] }
            },
            required: ["userId"]
          }
        },

{
          name: "disableMFA",
          description: isHebrew ? "בטל אימות דו-שלבי" : "Disable MFA",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" }
            },
            required: ["userId", "reason"]
          }
        },

{
          name: "getTranslations",
          description: isHebrew ? "קבל תרגומים" : "Get translations",
          parameters: {
            type: "object",
            properties: {
              language: { type: "string", description: isHebrew ? "שפה" : "Language", enum: ["he", "en"] },
              keys: { type: "array", description: isHebrew ? "מפתחות" : "Keys", items: { type: "string" } }
            },
            required: ["language"]
          }
        },

{
          name: "updateTranslations",
          description: isHebrew ? "עדכן תרגומים" : "Update translations",
          parameters: {
            type: "object",
            properties: {
              language: { type: "string", description: isHebrew ? "שפה" : "Language", enum: ["he", "en"] },
              translations: { type: "object", description: isHebrew ? "תרגומים" : "Translations" }
            },
            required: ["language", "translations"]
          }
        },

{
          name: "getDeletedPatients",
          description: isHebrew ? "הצג מטופלים שנמחקו" : "Get deleted patients",
          parameters: {
            type: "object",
            properties: {
              startDate: { type: "string", description: isHebrew ? "מתאריך" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "עד תאריך" : "End date" }
            }
          }
        },

{
          name: "restorePatient",
          description: isHebrew ? "שחזר מטופל" : "Restore patient",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" }
            },
            required: ["patientId", "reason"]
          }
        },

{
          name: "permanentlyDeletePatient",
          description: isHebrew ? "מחק מטופל לצמיתות" : "Permanently delete patient",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              confirmation: { type: "string", description: isHebrew ? "אישור (הקלד 'מחק לצמיתות')" : "Confirmation (type 'permanently delete')" }
            },
            required: ["patientId", "confirmation"]
          }
        },

{
          name: "getGraphQLStats",
          description: isHebrew ? "קבל סטטיסטיקות GraphQL" : "Get GraphQL statistics",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "getGraphQLHealth",
          description: isHebrew ? "בדוק תקינות GraphQL" : "Check GraphQL health",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "configureGraphQL",
          description: isHebrew ? "הגדר GraphQL" : "Configure GraphQL",
          parameters: {
            type: "object",
            properties: {
              maxQueryDepth: { type: "number", description: isHebrew ? "עומק מקסימלי" : "Max query depth" },
              maxComplexity: { type: "number", description: isHebrew ? "מורכבות מקסימלית" : "Max complexity" },
              timeout: { type: "number", description: isHebrew ? "זמן קצוב" : "Timeout" }
            }
          }
        },

{
          name: "testGraphQLQuery",
          description: isHebrew ? "בדוק שאילתת GraphQL" : "Test GraphQL query",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: isHebrew ? "שאילתה" : "Query" },
              variables: { type: "object", description: isHebrew ? "משתנים" : "Variables" }
            },
            required: ["query"]
          }
        },

{
          name: "createSecret",
          description: isHebrew ? "צור סוד חדש" : "Create new secret",
          parameters: {
            type: "object",
            properties: {
              secretName: { type: "string", description: isHebrew ? "שם הסוד" : "Secret name" },
              value: { type: "string", description: isHebrew ? "ערך" : "Value" },
              description: { type: "string", description: isHebrew ? "תיאור" : "Description" },
              tags: { type: "array", description: isHebrew ? "תגיות" : "Tags", items: { type: "string" } }
            },
            required: ["secretName", "value"]
          }
        },

{
          name: "getSecret",
          description: isHebrew ? "קבל סוד" : "Get secret",
          parameters: {
            type: "object",
            properties: {
              secretName: { type: "string", description: isHebrew ? "שם הסוד" : "Secret name" }
            },
            required: ["secretName"]
          }
        },

{
          name: "rotateSecret",
          description: isHebrew ? "החלף סוד" : "Rotate secret",
          parameters: {
            type: "object",
            properties: {
              secretName: { type: "string", description: isHebrew ? "שם הסוד" : "Secret name" }
            },
            required: ["secretName"]
          }
        },

{
          name: "deleteSecret",
          description: isHebrew ? "מחק סוד" : "Delete secret",
          parameters: {
            type: "object",
            properties: {
              secretName: { type: "string", description: isHebrew ? "שם הסוד" : "Secret name" },
              force: { type: "boolean", description: isHebrew ? "מחיקה כפויה" : "Force delete" }
            },
            required: ["secretName"]
          }
        },

{
          name: "listSecrets",
          description: isHebrew ? "רשימת סודות" : "List secrets",
          parameters: {
            type: "object",
            properties: {
              tags: { type: "array", description: isHebrew ? "סנן לפי תגיות" : "Filter by tags", items: { type: "string" } }
            }
          }
        },

{
          name: "getTraces",
          description: isHebrew ? "קבל עקבות" : "Get traces",
          parameters: {
            type: "object",
            properties: {
              startTime: { type: "string", description: isHebrew ? "זמן התחלה" : "Start time" },
              endTime: { type: "string", description: isHebrew ? "זמן סיום" : "End time" },
              serviceName: { type: "string", description: isHebrew ? "שם שירות" : "Service name" }
            }
          }
        },

{
          name: "getMetrics",
          description: isHebrew ? "קבל מטריקות" : "Get metrics",
          parameters: {
            type: "object",
            properties: {
              metricName: { type: "string", description: isHebrew ? "שם מטריקה" : "Metric name" },
              period: { type: "string", description: isHebrew ? "תקופה" : "Period", enum: ["1h", "6h", "24h", "7d", "30d"] }
            }
          }
        },

{
          name: "getLoadBalancerStatus",
          description: isHebrew ? "קבל סטטוס איזון עומסים" : "Get load balancer status",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "updateLoadBalancerConfig",
          description: isHebrew ? "עדכן הגדרות איזון עומסים" : "Update load balancer config",
          parameters: {
            type: "object",
            properties: {
              algorithm: { type: "string", description: isHebrew ? "אלגוריתם" : "Algorithm", enum: ["round-robin", "least-connections", "ip-hash"] },
              healthCheckInterval: { type: "number", description: isHebrew ? "תדירות בדיקה" : "Health check interval" }
            }
          }
        },

{
          name: "getChatSessions",
          description: isHebrew ? "קבל שיחות" : "Get chat sessions",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              limit: { type: "number", description: isHebrew ? "מגבלה" : "Limit" },
              offset: { type: "number", description: isHebrew ? "הזזה" : "Offset" }
            }
          }
        },

{
          name: "updateChatSessionTitle",
          description: isHebrew ? "עדכן כותרת שיחה" : "Update chat session title",
          parameters: {
            type: "object",
            properties: {
              sessionId: { type: "string", description: isHebrew ? "מזהה שיחה" : "Session ID" },
              title: { type: "string", description: isHebrew ? "כותרת" : "Title" }
            },
            required: ["sessionId", "title"]
          }
        },

{
          name: "deleteChatSession",
          description: isHebrew ? "מחק שיחה" : "Delete chat session",
          parameters: {
            type: "object",
            properties: {
              sessionId: { type: "string", description: isHebrew ? "מזהה שיחה" : "Session ID" }
            },
            required: ["sessionId"]
          }
        },

{
          name: "searchChatSessions",
          description: isHebrew ? "חפש בשיחות" : "Search chat sessions",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: isHebrew ? "חיפוש" : "Search query" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date" }
            },
            required: ["query"]
          }
        },

{
          name: "getDiagnosisModels",
          description: isHebrew ? "קבל מודלי אבחון" : "Get diagnosis models",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "stopDiagnosis",
          description: isHebrew ? "עצור אבחון" : "Stop diagnosis",
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: isHebrew ? "מזהה משימה" : "Task ID" }
            },
            required: ["taskId"]
          }
        },

{
          name: "getDiagnosisStatus",
          description: isHebrew ? "קבל סטטוס אבחון" : "Get diagnosis status",
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: isHebrew ? "מזהה משימה" : "Task ID" }
            }
          }
        },

{
          name: "getAPIVersions",
          description: isHebrew ? "קבל גרסאות API" : "Get API versions",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "getAPIChangelog",
          description: isHebrew ? "קבל יומן שינויים" : "Get API changelog",
          parameters: {
            type: "object",
            properties: {
              version: { type: "string", description: isHebrew ? "גרסה" : "Version" }
            }
          }
        },

{
          name: "deprecateAPI",
          description: isHebrew ? "הכרז על API מיושן" : "Deprecate API",
          parameters: {
            type: "object",
            properties: {
              version: { type: "string", description: isHebrew ? "גרסה" : "Version" },
              sunsetDate: { type: "string", description: isHebrew ? "תאריך סיום" : "Sunset date" },
              migrationGuide: { type: "string", description: isHebrew ? "מדריך הגירה" : "Migration guide" }
            },
            required: ["version", "sunsetDate"]
          }
        },

{
          name: "batchUpdatePatients",
          description: isHebrew ? "עדכן מטופלים באצווה" : "Batch update patients",
          parameters: {
            type: "object",
            properties: {
              patientIds: { type: "array", description: isHebrew ? "מזהי מטופלים" : "Patient IDs", items: { type: "string" } },
              updates: { type: "object", description: isHebrew ? "עדכונים" : "Updates" }
            },
            required: ["patientIds", "updates"]
          }
        },

{
          name: "batchDeleteSessions",
          description: isHebrew ? "מחק שיחות באצווה" : "Batch delete sessions",
          parameters: {
            type: "object",
            properties: {
              sessionIds: { type: "array", description: isHebrew ? "מזהי שיחות" : "Session IDs", items: { type: "string" } },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" }
            },
            required: ["sessionIds"]
          }
        },

{
          name: "assignDocumentToPatient",
          description: isHebrew 
            ? "שייך מסמך למטופל ונתח אותו. השתמש בפונקציה זו כאשר יש לך מסמך שצריך לשייך למטופל" 
            : "Assign a document to a patient and analyze it. Use this when you have a document that needs to be assigned to a patient",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך או upload ID" : "Document ID or upload ID" },
              uploadId: { type: "string", description: isHebrew ? "מזהה העלאה (upload_xxx)" : "Upload ID (upload_xxx)" },
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              nationalId: { type: "string", description: isHebrew ? "תעודת זהות של המטופל" : "Patient's national ID" },
              analysisType: { type: "string", description: isHebrew ? "סוג ניתוח" : "Analysis type", enum: ["comprehensive", "ocr", "medical", "summary"] }
            },
            required: []
          }
        },

{
          name: "createWebhook",
          description: isHebrew ? "צור webhook" : "Create webhook",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: isHebrew ? "כתובת URL" : "URL" },
              events: { type: "array", description: isHebrew ? "אירועים" : "Events", items: { type: "string" } },
              secret: { type: "string", description: isHebrew ? "סוד" : "Secret" }
            },
            required: ["url", "events"]
          }
        },

{
          name: "listWebhooks",
          description: isHebrew ? "רשימת webhooks" : "List webhooks",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "deleteWebhook",
          description: isHebrew ? "מחק webhook" : "Delete webhook",
          parameters: {
            type: "object",
            properties: {
              webhookId: { type: "string", description: isHebrew ? "מזהה webhook" : "Webhook ID" }
            },
            required: ["webhookId"]
          }
        },

{
          name: "testWebhook",
          description: isHebrew ? "בדוק webhook" : "Test webhook",
          parameters: {
            type: "object",
            properties: {
              webhookId: { type: "string", description: isHebrew ? "מזהה webhook" : "Webhook ID" },
              payload: { type: "object", description: isHebrew ? "מטען" : "Payload" }
            },
            required: ["webhookId"]
          }
        },

{
          name: "getAllUsers",
          description: isHebrew ? "קבל כל המשתמשים" : "Get all users",
          parameters: {
            type: "object",
            properties: {
              includeInactive: { type: "boolean", description: isHebrew ? "כלול לא פעילים" : "Include inactive" },
              role: { type: "string", description: isHebrew ? "תפקיד" : "Role" }
            }
          }
        },

{
          name: "searchUsers",
          description: isHebrew ? "חפש משתמשים לפי שם, תואר, אימייל או תפקיד - מאפשר למצוא כל איש צוות במרפאה (רופאים, אחיות, מזכירות, מנהלי מעבדה וכו')" : "Search users by name, title, email or role - find any staff member in the practice (doctors, nurses, secretaries, lab managers, etc.)",
          parameters: {
            type: "object",
            properties: {
              searchTerm: { type: "string", description: isHebrew ? "מונח חיפוש (שם, תואר, אימייל)" : "Search term (name, title, email)" },
              role: { type: "string", description: isHebrew ? "תפקיד ספציפי (doctor, nurse, secretary, lab_manager, admin)" : "Specific role (doctor, nurse, secretary, lab_manager, admin)" },
              includeInactive: { type: "boolean", description: isHebrew ? "כלול משתמשים לא פעילים" : "Include inactive users" }
            }
          }
        },

{
          name: "getUsersBySpecialty",
          description: isHebrew ? "חפש רופאים לפי התמחות - מאפשר למצוא כל הרופאים עם התמחות ספציפית (קרדיולוגיה, נוירולוגיה, פסיכיאטריה וכו')" : "Search doctors by specialty - find all providers with a specific specialty (cardiology, neurology, psychiatry, etc.)",
          parameters: {
            type: "object",
            properties: {
              specialty: {
                type: "string",
                description: isHebrew ? "התמחות רפואית (cardiology, neurology, psychiatry, dermatology, gastroenterology, etc.)" : "Medical specialty (cardiology, neurology, psychiatry, dermatology, gastroenterology, etc.)"
              },
              limit: {
                type: "number",
                description: isHebrew ? "מספר מקסימלי של תוצאות (ברירת מחדל 50)" : "Maximum number of results (default 50)"
              }
            },
            required: ["specialty"]
          }
        },

{
          name: "updateUserSpecialties",
          description: isHebrew ? "עדכן את כל ההתמחויות של ספק רפואי (החלף את הרשימה הקיימת) - להגדרת התמחויות ראשוניות או לשינוי מלא" : "Update all specialties for a medical provider (replace existing list) - for initial specialty setup or complete change",
          parameters: {
            type: "object",
            properties: {
              userId: {
                type: "string",
                description: isHebrew ? "מזהה משתמש או אימייל של הרופא" : "User ID or email of the provider"
              },
              specialties: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "רשימת התמחויות (cardiology, neurology, psychiatry, etc.)" : "List of specialties (cardiology, neurology, psychiatry, etc.)"
              }
            },
            required: ["userId", "specialties"]
          }
        },

{
          name: "addUserSpecialty",
          description: isHebrew ? "הוסף התמחות בודדת לספק רפואי - להוספת התמחות נוספת ללא שינוי ההתמחויות הקיימות" : "Add a single specialty to a medical provider - add an additional specialty without changing existing ones",
          parameters: {
            type: "object",
            properties: {
              userId: {
                type: "string",
                description: isHebrew ? "מזהה משתמש או אימייל של הרופא" : "User ID or email of the provider"
              },
              specialty: {
                type: "string",
                description: isHebrew ? "התמחות להוספה (cardiology, neurology, psychiatry, etc.)" : "Specialty to add (cardiology, neurology, psychiatry, etc.)"
              }
            },
            required: ["userId", "specialty"]
          }
        },

{
          name: "removeUserSpecialty",
          description: isHebrew ? "הסר התמחות מספק רפואי - למחיקת התמחות בודדת מהרשימה" : "Remove a specialty from a medical provider - remove a single specialty from the list",
          parameters: {
            type: "object",
            properties: {
              userId: {
                type: "string",
                description: isHebrew ? "מזהה משתמש או אימייל של הרופא" : "User ID or email of the provider"
              },
              specialty: {
                type: "string",
                description: isHebrew ? "התמחות להסרה (cardiology, neurology, psychiatry, etc.)" : "Specialty to remove (cardiology, neurology, psychiatry, etc.)"
              }
            },
            required: ["userId", "specialty"]
          }
        },

{
          name: "setupUserAsDoctor",
          description: isHebrew ? "הפעל קביעת תורים ויומן עבור רופא (doctor) או אחות (nurse) קיימים - מאפשר להם לקבל פגישות ולנהל יומן. אין תפקיד 'ספק'; רק רופא או אחות ניתנים לתזמון" : "Enable appointment scheduling and a calendar for an existing Doctor or Nurse - lets them accept appointments and manage a schedule. There is no 'provider' role; only a doctor or nurse can be scheduled",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה המשתמש או האימייל" : "User ID or email" },
              appointmentDuration: { type: "number", description: isHebrew ? "משך פגישה ברירת מחדל בדקות (30 כברירת מחדל)" : "Default appointment duration in minutes (default 30)" },
              specialties: { type: "array", items: { type: "string" }, description: isHebrew ? "התמחויות" : "Specialties" },
              departments: { type: "array", items: { type: "string" }, description: isHebrew ? "מחלקות" : "Departments" },
              workingHours: { type: "object", description: isHebrew ? "שעות עבודה (אופציונלי)" : "Working hours (optional)" }
            },
            required: ["userId"]
          }
        },

{
          name: "assignAllPatientsToDoctor",
          description: isHebrew ? "שייך את כל המטופלים לרופא - יוצר רשומות patient_provider עבור כל המטופלים שלא משויכים לרופא זה. אם המשתמש אומר 'לי' או 'אלי', השתמש במידע מהסשן" : "Assign all patients to a doctor - creates patient_provider records for all patients not already assigned to this doctor. If user says 'me' or 'myself', use session info",
          parameters: {
            type: "object",
            properties: {
              providerName: { type: "string", description: isHebrew ? "שם הרופא (אופציונלי אם משתמשים בסשן)" : "Doctor name (optional if using session)" },
              providerEmail: { type: "string", description: isHebrew ? "אימייל הרופא (אופציונלי אם משתמשים בסשן)" : "Doctor email (optional if using session)" },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא (אופציונלי)" : "Doctor ID (optional)" },
              facility: { type: "string", description: isHebrew ? "שם המתקן/קליניקה (ברירת מחדל: המתקן הראשי)" : "Facility/clinic name (default: Main Facility)" },
              specialty: { type: "string", description: isHebrew ? "התמחות (ברירת מחדל: Primary Care)" : "Specialty (default: Primary Care)" },
              providerRole: { type: "string", description: isHebrew ? "תפקיד (ברירת מחדל: Primary Care Physician)" : "Role (default: Primary Care Physician)" },
              assignToUnassignedOnly: { type: "boolean", description: isHebrew ? "שייך רק מטופלים ללא ספק (ברירת מחדל: false)" : "Only assign patients with no provider (default: false)" }
            },
            required: []
          }
        },

{
          name: "getUserDetails",
          description: isHebrew ? "קבל פרטי משתמש" : "Get user details",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" }
            },
            required: ["userId"]
          }
        },

{
          name: "updateUserProfile",
          description: isHebrew ? "עדכן פרופיל משתמש" : "Update user profile",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              profileData: { type: "object", description: isHebrew ? "נתוני פרופיל" : "Profile data" }
            },
            required: ["userId", "profileData"]
          }
        },

{
          name: "getUserActivity",
          description: isHebrew ? "קבל פעילות משתמש" : "Get user activity",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              startDate: { type: "string", description: isHebrew ? "מתאריך" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "עד תאריך" : "End date" }
            },
            required: ["userId"]
          }
        },

{
          name: "suspendUser",
          description: isHebrew ? "השעה משתמש" : "Suspend user",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" },
              duration: { type: "string", description: isHebrew ? "משך זמן" : "Duration" }
            },
            required: ["userId", "reason"]
          }
        },

{
          name: "reactivateUser",
          description: isHebrew ? "הפעל מחדש משתמש" : "Reactivate user",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" }
            },
            required: ["userId"]
          }
        },

{
          name: "getRoles",
          description: isHebrew
            ? "קבל רשימת כל התפקידים במערכת (מובנים ומותאמים אישית) כולל הרשאות ורמות היררכיה"
            : "Get all roles in the system (built-in and custom) including permissions and hierarchy levels",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "assignRole",
          description: isHebrew
            ? "הקצה תפקיד למשתמש לפי כתובת אימייל. ארבעה תפקידים בלבד: admin, doctor, nurse, user (admin בלבד יכול להקצות)"
            : "Assign a role to a user by their email address. Only four roles exist: admin, doctor, nurse, user (admin only can assign)",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string", description: isHebrew ? "כתובת אימייל של המשתמש" : "User email address" },
              role: { type: "string", enum: ["admin", "doctor", "nurse", "user"], description: isHebrew ? "שם תפקיד: admin (מנהל), doctor (רופא), nurse (אחות) או user (משתמש בסיסי)" : "Role name: admin, doctor, nurse, or user (basic)" }
            },
            required: ["email", "role"]
          }
        },

{
          name: "getUserPermissions",
          description: isHebrew
            ? "קבל את כל ההרשאות של משתמש לפי כתובת אימייל"
            : "Get all permissions for a user by their email address",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string", description: isHebrew ? "כתובת אימייל של המשתמש" : "User email address" }
            },
            required: ["email"]
          }
        },

{
          name: "updateUserPermissions",
          description: isHebrew
            ? "עדכן הרשאות של משתמש לפי כתובת אימייל"
            : "Update permissions for a user by their email address",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string", description: isHebrew ? "כתובת אימייל של המשתמש" : "User email address" },
              permissions: { type: "array", items: { type: "string" }, description: isHebrew ? "רשימת הרשאות חדשה" : "New permissions list" }
            },
            required: ["email", "permissions"]
          }
        },

{
          name: "addUserRole",
          description: isHebrew
            ? "הוסף תפקיד למשתמש לפי כתובת אימייל. ארבעה תפקידים בלבד: admin, doctor, nurse, user"
            : "Add a role to a user by their email address. Only four roles exist: admin, doctor, nurse, user",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string", description: isHebrew ? "כתובת אימייל של המשתמש" : "User email address" },
              role: { type: "string", enum: ["admin", "doctor", "nurse", "user"], description: isHebrew ? "שם תפקיד: admin, doctor, nurse או user" : "Role name: admin, doctor, nurse, or user" }
            },
            required: ["email", "role"]
          }
        },

{
          name: "removeUserRole",
          description: isHebrew
            ? "הסר תפקיד ממשתמש לפי כתובת אימייל. ארבעה תפקידים בלבד: admin, doctor, nurse, user"
            : "Remove a role from a user by their email address. Only four roles exist: admin, doctor, nurse, user",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string", description: isHebrew ? "כתובת אימייל של המשתמש" : "User email address" },
              role: { type: "string", enum: ["admin", "doctor", "nurse", "user"], description: isHebrew ? "שם תפקיד: admin, doctor, nurse או user" : "Role name: admin, doctor, nurse, or user" }
            },
            required: ["email", "role"]
          }
        },

{
          name: "bulkUpdateRoles",
          description: isHebrew
            ? "עדכן תפקידים במרוכז למספר משתמשים לפי אימייל. ארבעה תפקידים בלבד: admin, doctor, nurse, user"
            : "Bulk update roles for multiple users by email address. Only four roles exist: admin, doctor, nurse, user",
          parameters: {
            type: "object",
            properties: {
              users: { type: "array", items: { type: "string" }, description: isHebrew ? "רשימת כתובות אימייל של משתמשים" : "List of user email addresses" },
              newRole: { type: "string", enum: ["admin", "doctor", "nurse", "user"], description: isHebrew ? "שם התפקיד החדש: admin, doctor, nurse או user" : "New role to assign: admin, doctor, nurse, or user" }
            },
            required: ["users", "newRole"]
          }
        },

{
          name: "createRole",
          description: isHebrew
            ? "צור תפקיד מותאם אישית חדש עם הרשאות ורמת היררכיה. תפקידים מובנים לא ניתנים לשינוי"
            : "Create a new custom role with permissions and hierarchy level. Built-in roles cannot be modified",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: isHebrew ? "שם תפקיד (אותיות קטנות, קו תחתון)" : "Role name (lowercase, snake_case)" },
              displayName: { type: "string", description: isHebrew ? "שם תצוגה" : "Display name" },
              permissions: { type: "array", items: { type: "string" }, description: isHebrew ? "רשימת הרשאות (השתמש ב-listAllPermissions לראות הרשאות זמינות)" : "List of permission IDs (use listAllPermissions to see available permissions)" },
              hierarchyLevel: { type: "number", description: isHebrew ? "רמת היררכיה 1-10 (10=מנהל)" : "Hierarchy level 1-10 (10=admin)" },
              description: { type: "string", description: isHebrew ? "תיאור התפקיד" : "Role description" }
            },
            required: ["name", "displayName"]
          }
        },

{
          name: "updateRole",
          description: isHebrew
            ? "עדכן תפקיד מותאם אישית (לא ניתן לעדכן תפקידי מערכת מובנים)"
            : "Update a custom role (cannot modify built-in system roles)",
          parameters: {
            type: "object",
            properties: {
              roleName: { type: "string", description: isHebrew ? "שם התפקיד לעדכון" : "Role name to update" },
              displayName: { type: "string", description: isHebrew ? "שם תצוגה חדש" : "New display name" },
              permissions: { type: "array", items: { type: "string" }, description: isHebrew ? "רשימת הרשאות מעודכנת" : "Updated permission list" },
              hierarchyLevel: { type: "number", description: isHebrew ? "רמת היררכיה חדשה 1-10" : "New hierarchy level 1-10" },
              description: { type: "string", description: isHebrew ? "תיאור מעודכן" : "Updated description" }
            },
            required: ["roleName"]
          }
        },

{
          name: "deleteRole",
          description: isHebrew
            ? "מחק תפקיד מותאם אישית. ציין reassignTo אם יש משתמשים משויכים. לא ניתן למחוק תפקידי מערכת"
            : "Delete a custom role. Specify reassignTo if users are assigned. Cannot delete system roles",
          parameters: {
            type: "object",
            properties: {
              roleName: { type: "string", description: isHebrew ? "שם התפקיד למחיקה" : "Role name to delete" },
              reassignTo: { type: "string", description: isHebrew ? "תפקיד חלופי למשתמשים משויכים" : "Role to reassign users to (optional)" }
            },
            required: ["roleName"]
          }
        },

{
          name: "listAllPermissions",
          description: isHebrew
            ? "הצג את כל ההרשאות הזמינות במערכת, מקובצות לפי קטגוריה"
            : "List all available permissions in the system, grouped by category",
          parameters: {
            type: "object",
            properties: {
              group: { type: "string", description: isHebrew ? "סנן לפי קבוצה: patients, documents, admin, practice, billing, compliance, medical_data" : "Filter by group: patients, documents, admin, practice, billing, compliance, medical_data" }
            }
          }
        },

{
          name: "cloneRole",
          description: isHebrew
            ? "שכפל תפקיד קיים לתפקיד מותאם אישית חדש עם שם חדש"
            : "Clone an existing role into a new custom role with a new name",
          parameters: {
            type: "object",
            properties: {
              sourceRoleName: { type: "string", description: isHebrew ? "שם התפקיד לשכפול" : "Source role name to clone from" },
              newName: { type: "string", description: isHebrew ? "שם התפקיד החדש" : "New role name" },
              newDisplayName: { type: "string", description: isHebrew ? "שם תצוגה לתפקיד החדש" : "Display name for the new role" }
            },
            required: ["sourceRoleName", "newName"]
          }
        },

{
          name: "cloneUserPermissions",
          description: isHebrew
            ? "העתק הרשאות ממשתמש אחד לאחר"
            : "Copy permissions from one user to another",
          parameters: {
            type: "object",
            properties: {
              sourceEmail: { type: "string", description: isHebrew ? "אימייל המשתמש להעתקה ממנו" : "Source user email to copy permissions from" },
              targetEmail: { type: "string", description: isHebrew ? "אימייל המשתמש להעתקה אליו" : "Target user email to copy permissions to" }
            },
            required: ["sourceEmail", "targetEmail"]
          }
        },

        // ========== PERMISSION REQUEST WORKFLOW ==========
        {
          name: "requestPermission",
          description: isHebrew
            ? "שלח בקשה למנהל המרפאה - או לשדרוג תפקיד (admin/doctor/nurse/user) דרך requestedRole, או להרשאה ספציפית דרך permission. השתמש כאשר למשתמש אין הרשאה לפעולה מסוימת והוא מעוניין לבקש אותה. אם לא ניתן לזהות את המשתמש אוטומטית, שאל את כתובת האימייל שלו והעבר אותה בפרמטר requesterEmail"
            : "Send a request to the practice administrator - either to upgrade the user's ROLE (admin/doctor/nurse/user) via requestedRole, or for a specific permission via permission. Use when a user lacks a required permission/role and wants to request it. If the user cannot be identified automatically, ask for their email and pass it in the requesterEmail parameter",
          parameters: {
            type: "object",
            properties: {
              requestedRole: { type: "string", enum: ["admin", "doctor", "nurse", "user"], description: isHebrew ? "תפקיד מבוקש (admin, doctor, nurse או user) - השתמש כשהמשתמש רוצה שדרוג תפקיד" : "Requested role (admin, doctor, nurse, or user) - use when the user wants a role upgrade" },
              permission: { type: "string", description: isHebrew ? "ההרשאה הנדרשת (למשל read:lab_results) - השתמש כשמבקשים הרשאה ספציפית ולא תפקיד" : "The required permission (e.g. read:lab_results) - use when requesting a specific permission rather than a role" },
              reason: { type: "string", description: isHebrew ? "סיבת הבקשה" : "Reason for the request" },
              requesterEmail: { type: "string", description: isHebrew ? "כתובת האימייל של המשתמש המבקש (אופציונלי - השתמש אם הזיהוי האוטומטי נכשל)" : "Email of the requesting user (optional - use if automatic identification fails)" }
            },
            required: ["reason"]
          }
        },
        {
          name: "getPendingPermissionRequests",
          description: isHebrew
            ? "הצג בקשות הרשאה ממתינות (למנהלים בלבד)"
            : "List pending permission requests (admin only)",
          parameters: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "approvePermissionRequest",
          description: isHebrew
            ? "אשר בקשת הרשאה או בקשת תפקיד (admin/doctor/nurse/user) והענק אותה למשתמש אוטומטית (למנהלים בלבד)"
            : "Approve a permission or role request (admin/doctor/nurse/user) and automatically grant it to the user (admin only)",
          parameters: {
            type: "object",
            properties: {
              requestId: { type: "string", description: isHebrew ? "מזהה הבקשה" : "Permission request ID" }
            },
            required: ["requestId"]
          }
        },
        {
          name: "denyPermissionRequest",
          description: isHebrew
            ? "דחה בקשת הרשאה או בקשת תפקיד (למנהלים בלבד)"
            : "Deny a permission or role request (admin only)",
          parameters: {
            type: "object",
            properties: {
              requestId: { type: "string", description: isHebrew ? "מזהה הבקשה" : "Permission request ID" },
              reason: { type: "string", description: isHebrew ? "סיבת הדחייה (אופציונלי)" : "Reason for denial (optional)" }
            },
            required: ["requestId"]
          }
        },

{
          name: "getAllClinics",
          description: isHebrew ? "קבל כל המרפאות" : "Get all practices",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status", enum: ["active", "inactive", "trial"] }
            }
          }
        },

{
          name: "createClinic",
          description: isHebrew ? "צור מרפאה חדשה" : "Create new practice",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: isHebrew ? "שם מרפאה" : "Practice name" },
              subdomain: { type: "string", description: isHebrew ? "תת-דומיין" : "Subdomain" },
              country: { type: "string", description: isHebrew ? "מדינה" : "Country" },
              state: { type: "string", description: isHebrew ? "מדינה/מחוז (נדרש עבור ארה\"ב)" : "State/Province (required for USA)" },
              city: { type: "string", description: isHebrew ? "עיר" : "City" },
              plan: { type: "string", description: isHebrew ? "תוכנית" : "Plan", enum: ["basic", "professional", "enterprise"] }
            },
            required: ["name", "subdomain", "country"]
          }
        },

{
          name: "updateClinic",
          description: isHebrew ? "עדכן מרפאה" : "Update practice",
          parameters: {
            type: "object",
            properties: {
              practiceId: { type: "string", description: isHebrew ? "מזהה מרפאה" : "Practice ID" },
              updates: { type: "object", description: isHebrew ? "עדכונים" : "Updates" }
            },
            required: ["practiceId", "updates"]
          }
        },

{
          name: "getClinicUsage",
          description: isHebrew ? "קבל שימוש מרפאה" : "Get practice usage",
          parameters: {
            type: "object",
            properties: {
              practiceId: { type: "string", description: isHebrew ? "מזהה מרפאה" : "Practice ID" },
              period: { type: "string", description: isHebrew ? "תקופה" : "Period", enum: ["day", "week", "month", "year"] }
            }
          }
        },

{
          name: "analyzeDatabase",
          description: isHebrew ? "נתח מסד נתונים" : "Analyze database",
          parameters: {
            type: "object",
            properties: {
              deep: { type: "boolean", description: isHebrew ? "ניתוח עמוק" : "Deep analysis" }
            }
          }
        },

{
          name: "rebuildIndexes",
          description: isHebrew ? "בנה מחדש אינדקסים" : "Rebuild indexes",
          parameters: {
            type: "object",
            properties: {
              collection: { type: "string", description: isHebrew ? "אוסף" : "Collection" }
            }
          }
        },

{
          name: "getCacheStatistics",
          description: isHebrew ? "קבל סטטיסטיקות מטמון" : "Get cache statistics",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "warmupCache",
          description: isHebrew ? "חמם מטמון" : "Warmup cache",
          parameters: {
            type: "object",
            properties: {
              cacheType: { type: "string", description: isHebrew ? "סוג מטמון" : "Cache type", enum: ["patient", "document", "query"] }
            }
          }
        },

{
          name: "performFailover",
          description: isHebrew ? "בצע מעבר חירום" : "Perform failover",
          parameters: {
            type: "object",
            properties: {
              targetRegion: { type: "string", description: isHebrew ? "אזור יעד" : "Target region" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" },
              confirmation: { type: "string", description: isHebrew ? "אישור" : "Confirmation" }
            },
            required: ["targetRegion", "reason", "confirmation"]
          }
        },

{
          name: "scheduleBackup",
          description: isHebrew ? "תזמן גיבוי" : "Schedule backup",
          parameters: {
            type: "object",
            properties: {
              backupType: { type: "string", description: isHebrew ? "סוג גיבוי" : "Backup type", enum: ["full", "incremental", "differential"] },
              schedule: { type: "string", description: isHebrew ? "תזמון" : "Schedule" },
              retention: { type: "number", description: isHebrew ? "שמירה (ימים)" : "Retention (days)" }
            },
            required: ["backupType", "schedule"]
          }
        },

{
          name: "restoreFromBackup",
          description: isHebrew ? "שחזר מגיבוי" : "Restore from backup",
          parameters: {
            type: "object",
            properties: {
              backupId: { type: "string", description: isHebrew ? "מזהה גיבוי" : "Backup ID" },
              targetEnvironment: { type: "string", description: isHebrew ? "סביבת יעד" : "Target environment" },
              confirmation: { type: "string", description: isHebrew ? "אישור" : "Confirmation" }
            },
            required: ["backupId", "confirmation"]
          }
        },

{
          name: "addServer",
          description: isHebrew ? "הוסף שרת" : "Add server",
          parameters: {
            type: "object",
            properties: {
              hostname: { type: "string", description: isHebrew ? "שם מארח" : "Hostname" },
              port: { type: "number", description: isHebrew ? "פורט" : "Port" },
              weight: { type: "number", description: isHebrew ? "משקל" : "Weight" }
            },
            required: ["hostname", "port"]
          }
        },

{
          name: "removeServer",
          description: isHebrew ? "הסר שרת" : "Remove server",
          parameters: {
            type: "object",
            properties: {
              serverId: { type: "string", description: isHebrew ? "מזהה שרת" : "Server ID" },
              graceful: { type: "boolean", description: isHebrew ? "הסרה מבוקרת" : "Graceful removal" }
            },
            required: ["serverId"]
          }
        },

{
          name: "drainServer",
          description: isHebrew ? "רוקן שרת" : "Drain server",
          parameters: {
            type: "object",
            properties: {
              serverId: { type: "string", description: isHebrew ? "מזהה שרת" : "Server ID" }
            },
            required: ["serverId"]
          }
        },

{
          name: "getServerHealth",
          description: isHebrew ? "קבל תקינות שרת" : "Get server health",
          parameters: {
            type: "object",
            properties: {
              serverId: { type: "string", description: isHebrew ? "מזהה שרת" : "Server ID" }
            },
            required: ["serverId"]
          }
        },

{
          name: "getSystemHealthDetailed",
          description: isHebrew ? "קבל תקינות מערכת מפורטת" : "Get detailed system health",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "updateVitalSigns",
          description: isHebrew ? "עדכן סימנים חיוניים" : "Update vital signs",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              bloodPressure: { type: "string", description: isHebrew ? "לחץ דם" : "Blood pressure" },
              pulse: { type: "number", description: isHebrew ? "דופק" : "Pulse" },
              temperature: { type: "number", description: isHebrew ? "חום" : "Temperature" },
              weight: { type: "number", description: isHebrew ? "משקל" : "Weight" },
              height: { type: "number", description: isHebrew ? "גובה" : "Height" },
              respiratoryRate: { type: "number", description: isHebrew ? "קצב נשימה" : "Respiratory rate" },
              oxygenSaturation: { type: "number", description: isHebrew ? "רוויון חמצן" : "Oxygen saturation" }
            },
            required: ["patientId"]
          }
        },

{
          name: "validateClinicToken",
          description: isHebrew ? "אמת טוקן מרפאה" : "Validate practice token",
          parameters: {
            type: "object",
            properties: {
              token: { type: "string", description: isHebrew ? "טוקן" : "Token" }
            },
            required: ["token"]
          }
        },

{
          name: "rotateClinicToken",
          description: isHebrew ? "החלף טוקן מרפאה" : "Rotate practice token",
          parameters: {
            type: "object",
            properties: {
              practiceId: { type: "string", description: isHebrew ? "מזהה מרפאה" : "Practice ID" }
            },
            required: ["practiceId"]
          }
        },

{
          name: "getAPIUsageStats",
          description: isHebrew ? "קבל סטטיסטיקות שימוש API" : "Get API usage statistics",
          parameters: {
            type: "object",
            properties: {
              endpoint: { type: "string", description: isHebrew ? "נקודת קצה" : "Endpoint" },
              timeRange: { type: "string", description: isHebrew ? "טווח זמן" : "Time range", enum: ["1h", "24h", "7d", "30d"] }
            }
          }
        },

{
          name: "testAPIEndpoint",
          description: isHebrew ? "בדוק נקודת קצה API" : "Test API endpoint",
          parameters: {
            type: "object",
            properties: {
              endpoint: { type: "string", description: isHebrew ? "נקודת קצה" : "Endpoint" },
              method: { type: "string", description: isHebrew ? "שיטה" : "Method", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
              payload: { type: "object", description: isHebrew ? "מטען" : "Payload" }
            },
            required: ["endpoint", "method"]
          }
        },

{
          name: "getPerformanceTrace",
          description: isHebrew ? "קבל עקבות ביצועים" : "Get performance trace",
          parameters: {
            type: "object",
            properties: {
              traceId: { type: "string", description: isHebrew ? "מזהה עקבה" : "Trace ID" }
            },
            required: ["traceId"]
          }
        },

{
          name: "scheduleDoctorMeeting",
          description: isHebrew ? "קבע פגישה מקצועית בין שני רופאים" : "Schedule a professional meeting between two doctors",
          parameters: {
            type: "object",
            properties: {
              targetProvider: { type: "string", description: isHebrew ? "שם או אימייל של הרופא שאיתו רוצים להיפגש" : "Name or email of the doctor to meet with" },
              subject: { type: "string", description: isHebrew ? "נושא הפגישה" : "Meeting subject" },
              description: { type: "string", description: isHebrew ? "תיאור הפגישה" : "Meeting description" },
              date: { type: "string", description: isHebrew ? "תאריך (YYYY-MM-DD)" : "Date (YYYY-MM-DD)" },
              time: { type: "string", description: isHebrew ? "שעה (HH:MM)" : "Time (HH:MM)" },
              duration: { type: "number", description: isHebrew ? "משך בדקות" : "Duration in minutes" },
              type: { type: "string", enum: ["consultation", "case_review", "general"], description: isHebrew ? "סוג הפגישה" : "Meeting type" }
            },
            required: ["targetProvider", "date", "time"]
          }
        },

{
          name: "getDoctorMeetings", 
          description: isHebrew ? "קבל רשימת פגישות מקצועיות בין רופאים" : "Get list of professional doctor meetings",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["pending", "confirmed", "rejected", "completed"], description: isHebrew ? "סטטוס הפגישה" : "Meeting status" }
            }
          }
        },

// REMOVED: getPatientProvider duplicate - Now handled by generatedMedicalFunctions.js
        // The auto-generated function has correct schema with patientId parameter
        // This duplicate was causing Claude to pass "name" instead of "patientId"

{
          name: "getAvailableMeetingTimes",
          description: isHebrew ? "מצא זמנים משותפים פנויים לשני ספקים" : "Find overlapping available time slots for two providers. Use when someone asks 'When can Dr. X and Dr. Y both meet?'",
          parameters: {
            type: "object",
            properties: {
              provider1: { type: "string", description: isHebrew ? "שם או אימייל של ספק ראשון" : "First provider name or email (e.g., 'Dr. Smith')" },
              provider2: { type: "string", description: isHebrew ? "שם או אימייל של ספק שני" : "Second provider name or email (e.g., 'Dr. Jones')" },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה (YYYY-MM-DD)" : "Start date in YYYY-MM-DD format (default: today)" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום (YYYY-MM-DD)" : "End date in YYYY-MM-DD format (default: 7 days from start)" },
              duration: { type: "number", description: isHebrew ? "משך פגישה בדקות" : "Meeting duration in minutes (default: 30)" }
            },
            required: ["provider1", "provider2"]
          }
        },

{
          name: "createRecurringMeeting",
          description: isHebrew ? "צור סדרת פגישות חוזרות בין ספקים" : "Create a recurring meeting series between providers (e.g., weekly team meeting, monthly case review)",
          parameters: {
            type: "object",
            properties: {
              targetProvider: { type: "string", description: isHebrew ? "שם הספק להיפגש איתו" : "Provider name or email to meet with" },
              subject: { type: "string", description: isHebrew ? "נושא הפגישה" : "Meeting subject (e.g., 'Weekly Case Review')" },
              description: { type: "string", description: isHebrew ? "תיאור" : "Meeting description" },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה (YYYY-MM-DD)" : "Start date in YYYY-MM-DD format" },
              time: { type: "string", description: isHebrew ? "שעה (HH:MM)" : "Meeting time in HH:MM 24-hour format (e.g., '09:00')" },
              duration: { type: "number", description: isHebrew ? "משך בדקות" : "Duration in minutes (default: 30)" },
              frequency: { type: "string", enum: ["daily", "weekly", "biweekly", "monthly"], description: isHebrew ? "תדירות" : "Recurrence frequency" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום סדרה (YYYY-MM-DD)" : "Series end date in YYYY-MM-DD (optional)" },
              numberOfOccurrences: { type: "number", description: isHebrew ? "מספר מופעים" : "Number of occurrences (optional, default: 52)" },
              daysOfWeek: { type: "array", items: { type: "string" }, description: isHebrew ? "ימי שבוע" : "Days of week for weekly/biweekly (e.g., ['monday', 'wednesday'])" },
              location: { type: "string", description: isHebrew ? "מיקום" : "Meeting location" },
              type: { type: "string", enum: ["consultation", "case_review", "general", "team_meeting"], description: isHebrew ? "סוג" : "Meeting type" },
              agenda: { type: "string", description: isHebrew ? "סדר יום" : "Meeting agenda" }
            },
            required: ["frequency"]
          }
        },

{
          name: "getRecurringMeetingSeries",
          description: isHebrew ? "קבל כל מופעי סדרת פגישות חוזרות" : "Get all instances of a recurring meeting series by its series ID",
          parameters: {
            type: "object",
            properties: {
              seriesId: { type: "string", description: isHebrew ? "מזהה סדרה" : "Series ID (e.g., 'SERIES-...')" }
            },
            required: ["seriesId"]
          }
        },

{
          name: "updateRecurringMeeting",
          description: isHebrew ? "עדכן פגישות חוזרות - מופע אחד, עתידיים, או כולם" : "Update recurring meetings. Scope: 'thisOnly' (one instance), 'thisAndFuture', or 'all' instances",
          parameters: {
            type: "object",
            properties: {
              seriesId: { type: "string", description: isHebrew ? "מזהה סדרה" : "Series ID" },
              meetingId: { type: "string", description: isHebrew ? "מזהה פגישה ספציפית" : "Specific meeting ID (for thisOnly or thisAndFuture scope)" },
              scope: { type: "string", enum: ["thisOnly", "thisAndFuture", "all"], description: isHebrew ? "טווח עדכון" : "Update scope: 'thisOnly', 'thisAndFuture', or 'all' (default: thisOnly)" },
              date: { type: "string", description: isHebrew ? "תאריך חדש (YYYY-MM-DD)" : "New date (YYYY-MM-DD)" },
              time: { type: "string", description: isHebrew ? "שעה חדשה (HH:MM)" : "New time (HH:MM)" },
              subject: { type: "string", description: isHebrew ? "נושא חדש" : "New subject" },
              description: { type: "string", description: isHebrew ? "תיאור חדש" : "New description" },
              location: { type: "string", description: isHebrew ? "מיקום חדש" : "New location" },
              agenda: { type: "string", description: isHebrew ? "סדר יום חדש" : "New agenda" },
              status: { type: "string", enum: ["scheduled", "confirmed", "cancelled"], description: isHebrew ? "סטטוס חדש" : "New status" }
            },
            required: ["seriesId"]
          }
        },

{
          name: "deleteRecurringMeetingSeries",
          description: isHebrew ? "מחק סדרת פגישות חוזרות (כולן או מנקודה מסוימת)" : "Delete a recurring meeting series. Use scope 'all' to delete entire series, or 'thisAndFuture' with meetingId to delete from a point forward",
          parameters: {
            type: "object",
            properties: {
              seriesId: { type: "string", description: isHebrew ? "מזהה סדרה" : "Series ID" },
              scope: { type: "string", enum: ["all", "thisAndFuture"], description: isHebrew ? "טווח מחיקה" : "Delete scope: 'all' or 'thisAndFuture' (default: all)" },
              meetingId: { type: "string", description: isHebrew ? "מזהה פגישה (לטווח thisAndFuture)" : "Meeting ID (for thisAndFuture scope)" }
            },
            required: ["seriesId"]
          }
        },

{
          name: "getDoctorAvailability",
          description: isHebrew ? "קבל זמינות של רופא" : "Get doctor availability",
          parameters: {
            type: "object",
            properties: {
              providerId: { type: "string", description: isHebrew ? "מזהה רופא" : "Doctor ID" },
              date: { type: "string", description: isHebrew ? "תאריך (YYYY-MM-DD)" : "Date (YYYY-MM-DD)" }
            },
            required: ["providerId"]
          }
        },

{
          name: "setDoctorAvailability",
          description: isHebrew ? "הגדר זמינות רופא" : "Set doctor availability",
          parameters: {
            type: "object",
            properties: {
              providerId: { type: "string", description: isHebrew ? "מזהה רופא" : "Doctor ID" },
              regularSchedule: { type: "array", description: isHebrew ? "לוח זמנים קבוע" : "Regular schedule" },
              specialAvailability: { type: "array", description: isHebrew ? "זמינות מיוחדת" : "Special availability" }
            },
            required: ["providerId"]
          }
        },

{
          name: "getDoctorAppointments",
          description: isHebrew ? "קבל פגישות של רופא" : "Get doctor appointments",
          parameters: {
            type: "object",
            properties: {
              providerId: { type: "string", description: isHebrew ? "מזהה רופא (אופציונלי - ישתמש ברופא המחובר)" : "Doctor ID (optional - uses authenticated doctor)" },
              date: { type: "string", description: isHebrew ? "תאריך" : "Date" },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status" }
            }
          }
        },

{
          name: "updateDoctorSettings",
          description: isHebrew ? "עדכן הגדרות רופא" : "Update doctor settings",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא" : "Doctor ID" },
              licenseNumber: { type: "string", description: isHebrew ? "מספר רישיון" : "License number" },
              specialties: { type: "array", description: isHebrew ? "התמחויות" : "Specialties", items: { type: "string" } },
              departments: { type: "array", description: isHebrew ? "מחלקות" : "Departments", items: { type: "string" } },
              appointmentSettings: { type: "object", description: isHebrew ? "הגדרות פגישות" : "Appointment settings" }
            },
            required: ["userId"]
          }
        },

{
          name: "getDoctorSchedule",
          description: isHebrew ? "קבל את לוח הזמנים (התורים) של רופא או אחות לפי טווח תאריכים. אם לא צוין מזהה - מחזיר את לוח הזמנים של המשתמש הנוכחי" : "Get a doctor's or nurse's schedule (their appointments) for a date range. If no id is given, returns the current user's schedule",
          parameters: {
            type: "object",
            properties: {
              providerId: { type: "string", description: isHebrew ? "מזהה הרופא/המשתמש (אופציונלי - ברירת מחדל: המשתמש הנוכחי)" : "The doctor's user ID (optional - defaults to the current user)" },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" }
            },
            required: []
          }
        },

{
          name: "analyzePatientFlow",
          description: isHebrew 
            ? "נתח זרימת מטופלים במרפאה" 
            : "Analyze patient flow in the practice",
          parameters: {
            type: "object",
            properties: {
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              departments: { type: "array", items: { type: "string" }, description: isHebrew ? "מחלקות" : "Departments" }
            },
            required: ["startDate", "endDate"]
          }
        },

{
          name: "compareMetrics",
          description: isHebrew 
            ? "השווה בין שתי מטריקות" 
            : "Compare two metrics",
          parameters: {
            type: "object",
            properties: {
              metric1: { type: "string", description: isHebrew ? "מטריקה ראשונה" : "First metric" },
              metric2: { type: "string", description: isHebrew ? "מטריקה שנייה" : "Second metric" },
              timeframe: { type: "string", description: isHebrew ? "טווח זמן" : "Time range" }
            },
            required: ["metric1", "metric2"]
          }
        },

{
          name: "prescribeMedication",
          description: isHebrew
            ? "רשום מרשם תרופה עם בדיקות אינטראקציה וכיסוי ביטוחי"
            : "Prescribe medication with interaction checking and insurance coverage",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל" : "Patient ID"
              },
              medicationName: {
                type: "string",
                description: isHebrew
                  ? "שם התרופה (לדוגמה: 'Lisinopril', 'Metformin', 'Atorvastatin'). השתמש בשדה זה עבור שם התרופה"
                  : "Medication name (e.g., 'Lisinopril', 'Metformin', 'Atorvastatin'). Use this field for the medication name, NOT 'medication' or 'genericName'"
              },
              dosage: {
                type: "string",
                description: isHebrew
                  ? "מינון (לדוגמה: '10mg', '500mg', '20mg')"
                  : "Dosage amount with unit (e.g., '10mg', '500mg', '20mg')"
              },
              frequency: {
                type: "string",
                description: isHebrew
                  ? "תדירות נטילה (לדוגמה: 'once daily', 'twice daily', 'three times daily')"
                  : "How often to take (e.g., 'once daily', 'twice daily', 'three times daily')"
              },
              route: {
                type: "string",
                description: isHebrew
                  ? "דרך מתן (לדוגמה: 'oral', 'IV', 'topical', 'injection')"
                  : "Route of administration (e.g., 'oral', 'IV', 'topical', 'injection'). Optional, defaults to 'oral'"
              },
              duration: {
                type: "string",
                description: isHebrew
                  ? "משך הטיפול (לדוגמה: '30 days', '3 months', 'ongoing')"
                  : "Duration of treatment (e.g., '30 days', '3 months', 'ongoing'). Optional"
              },
              instructions: {
                type: "string",
                description: isHebrew
                  ? "הוראות נטילה נוספות (לדוגמה: 'Take with food', 'Take at bedtime')"
                  : "Additional instructions (e.g., 'Take with food', 'Take at bedtime'). Optional"
              },
              indication: {
                type: "string",
                description: isHebrew
                  ? "סיבה רפואית למרשם (לדוגמה: 'Hypertension', 'Type 2 Diabetes', 'High Cholesterol')"
                  : "Medical reason for prescription (e.g., 'Hypertension', 'Type 2 Diabetes', 'High Cholesterol'). Optional"
              },
              quantity: {
                type: "number",
                description: isHebrew ? "מספר כדורים/יחידות (ברירת מחדל: 30)" : "Number of pills/units to dispense (default: 30). Optional"
              },
              refills: {
                type: "number",
                description: isHebrew ? "מספר חידושים (ברירת מחדל: 0)" : "Number of refills allowed (default: 0). Optional"
              },
              transmitToPharmacy: {
                type: "boolean",
                description: isHebrew ? "שלח לבית מרקחת (ברירת מחדל: false)" : "Send prescription to pharmacy (default: false). Optional"
              }
            },
            required: ["patientId", "medicationName", "dosage", "frequency"]
          }
        },

{
          name: "orderLabTest",
          description: isHebrew
            ? "הזמן בדיקת מעבדה - תומך בבדיקה בודדת או מספר בדיקות. השתמש בזה כאשר רוצים ליצור הזמנה חדשה (status='pending'). אם יש תוצאות בפועל, השתמש ב-addLabResult"
            : "Order laboratory test(s) - supports single test or multiple tests. Use this when creating a new test order (status='pending'). If you have actual results, use addLabResult instead",
          parameters: {
            type: "object",
            properties: {
              patientId: {
                type: "string",
                description: isHebrew ? "מזהה מטופל" : "Patient ID"
              },
              testName: {
                type: "string",
                description: isHebrew
                  ? "שם הבדיקה (למשל: 'CBC', 'Basic Metabolic Panel'). השתמש בשדה זה לבדיקה בודדת, או השתמש ב-tests למספר בדיקות"
                  : "Test name (e.g., 'CBC', 'Basic Metabolic Panel', 'Lipid Panel'). Use this field for single test, OR use 'tests' array for multiple tests"
              },
              testCode: {
                type: "string",
                description: isHebrew
                  ? "קוד הבדיקה (אופציונלי, אם ידוע)"
                  : "Test code (optional, if known)"
              },
              tests: {
                type: "array",
                description: isHebrew
                  ? "מערך של מספר בדיקות (אלטרנטיבה ל-testName לבדיקה בודדת). כל פריט יכול להיות מחרוזת (שם בדיקה) או אובייקט עם testName ו-clinicalIndication"
                  : "Array of multiple tests (alternative to single testName). Each item can be a string (test name) or object with testName and clinicalIndication",
                items: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "object",
                      properties: {
                        testName: { type: "string" },
                        clinicalIndication: { type: "string" }
                      }
                    }
                  ]
                }
              },
              priority: {
                type: "string",
                enum: ["routine", "urgent", "stat"],
                description: isHebrew ? "עדיפות (routine/urgent/stat)" : "Priority level (routine/urgent/stat)"
              },
              clinicalIndication: {
                type: "string",
                description: isHebrew
                  ? "אינדיקציה קלינית או סיבה לבדיקה"
                  : "Clinical indication or reason for test"
              },
              fastingRequired: {
                type: "boolean",
                description: isHebrew ? "האם נדרש צום לפני הבדיקה" : "Whether fasting is required before test"
              }
            },
            required: ["patientId"]
          }
        },

{
          name: "recordVitalSigns",
          description: isHebrew 
            ? "תעד סימנים חיוניים" 
            : "Record vital signs",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              bloodPressure: { type: "string", description: isHebrew ? "לחץ דם (120/80)" : "Blood pressure (120/80)" },
              heartRate: { type: "number", description: isHebrew ? "דופק" : "Heart rate" },
              temperature: { type: "number", description: isHebrew ? "טמפרטורה" : "Temperature" },
              respiratoryRate: { type: "number", description: isHebrew ? "קצב נשימה" : "Respiratory rate" },
              oxygenSaturation: { type: "number", description: isHebrew ? "רוויון חמצן %" : "Oxygen saturation %" }
            },
            required: ["patientId"]
          }
        },

{
          name: "analyzeVitalTrends",
          description: isHebrew 
            ? "נתח מגמות בסימנים חיוניים" 
            : "Analyze vital signs trends",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              timeRange: { 
                type: "string", 
                enum: ["last_24h", "last_week", "last_month"],
                description: isHebrew ? "טווח זמן" : "Time range" 
              },
              vitalType: { 
                type: "string", 
                enum: ["all", "blood_pressure", "heart_rate", "temperature", "oxygen"],
                description: isHebrew ? "סוג סימן חיוני" : "Vital type" 
              }
            },
            required: ["patientId"]
          }
        },

{
          name: "setVitalAlerts",
          description: isHebrew 
            ? "הגדר התראות לסימנים חיוניים חריגים" 
            : "Set alerts for abnormal vital signs",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              alertType: { 
                type: "string", 
                enum: ["high_bp", "low_bp", "tachycardia", "bradycardia", "fever", "hypoxia"],
                description: isHebrew ? "סוג התראה" : "Alert type" 
              },
              threshold: { type: "number", description: isHebrew ? "סף התראה" : "Alert threshold" },
              notifyMethods: { 
                type: "array", 
                items: { type: "string", enum: ["sms", "email", "push", "dashboard"] },
                description: isHebrew ? "דרכי התראה" : "Notification methods" 
              }
            },
            required: ["patientId", "alertType"]
          }
        },

{
          name: "createAssessment",
          description: isHebrew
            ? "יצירת הערכת כשירות עם שיטות מעקב ומדדי ביצוע"
            : "Create competency assessment with tracking methods and performance metrics",
          parameters: {
            type: "object",
            properties: {
              frameworkId: { type: "string", description: isHebrew ? "מזהה מסגרת כשירות" : "Competency framework ID" },
              assesseeId: { type: "string", description: isHebrew ? "מזהה נבחן" : "Assessee ID" },
              type: { 
                type: "string", 
                enum: ["initial", "annual", "remedial", "spot_check"],
                description: isHebrew ? "סוג הערכה" : "Assessment type" 
              },
              method: { 
                type: "string", 
                enum: ["observation", "simulation", "written_test", "peer_review"],
                description: isHebrew ? "שיטת הערכה" : "Assessment method" 
              },
              scheduledDate: { type: "string", description: isHebrew ? "תאריך מתוכנן" : "Scheduled date" }
            },
            required: ["frameworkId", "assesseeId", "type", "method"]
          }
        },

{
          name: "conductAssessment",
          description: isHebrew
            ? "ביצוע הערכת כשירות עם ציונים ומשוב"
            : "Conduct competency assessment with scores and feedback",
          parameters: {
            type: "object",
            properties: {
              assessmentId: { type: "string", description: isHebrew ? "מזהה הערכה" : "Assessment ID" },
              competencyScores: { 
                type: "object", 
                description: isHebrew ? "ציוני כשירות" : "Competency scores" 
              },
              feedback: { type: "string", description: isHebrew ? "משוב" : "Feedback" },
              actionItems: { 
                type: "array", 
                items: { type: "string" },
                description: isHebrew ? "פעולות מתקנות" : "Action items" 
              }
            },
            required: ["assessmentId", "competencyScores"]
          }
        },

{
          name: "createSkillsTest",
          description: isHebrew
            ? "יצירת מבחן מיומנויות עם שאלות וזמן מוגבל"
            : "Create skills test with questions and time limit",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: isHebrew ? "כותרת המבחן" : "Test title" },
              competencyArea: { type: "string", description: isHebrew ? "אזור כשירות" : "Competency area" },
              timeLimit: { type: "number", description: isHebrew ? "זמן מוגבל בדקות" : "Time limit in minutes" },
              passingScore: { type: "number", description: isHebrew ? "ציון עובר" : "Passing score" },
              maxAttempts: { type: "number", description: isHebrew ? "מספר ניסיונות מרבי" : "Maximum attempts" },
              questions: { 
                type: "array", 
                items: { type: "object" },
                description: isHebrew ? "רשימת שאלות" : "Question list" 
              }
            },
            required: ["title", "competencyArea", "questions"]
          }
        },

{
          name: "takeSkillsTest",
          description: isHebrew
            ? "התחלת מבחן מיומנויות עם שאלות מעורבבות"
            : "Start skills test with randomized questions",
          parameters: {
            type: "object",
            properties: {
              testId: { type: "string", description: isHebrew ? "מזהה מבחן" : "Test ID" },
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" }
            },
            required: ["testId", "userId"]
          }
        },

{
          name: "submitSkillsTest",
          description: isHebrew
            ? "הגשת מבחן מיומנויות עם תשובות וציון אוטומטי"
            : "Submit skills test with answers and automatic scoring",
          parameters: {
            type: "object",
            properties: {
              attemptId: { type: "string", description: isHebrew ? "מזהה ניסיון" : "Attempt ID" },
              answers: { 
                type: "object", 
                description: isHebrew ? "תשובות לשאלות" : "Question answers" 
              }
            },
            required: ["attemptId", "answers"]
          }
        },

{
          name: "createEducationProgram",
          description: isHebrew
            ? "יצירת תוכנית השכלה רציפה עם נקודות זכות ואישורים"
            : "Create continuing education program with credit hours and accreditation",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: isHebrew ? "כותרת התוכנית" : "Program title" },
              provider: { type: "string", description: isHebrew ? "ספק התוכנית" : "Program provider" },
              type: { 
                type: "string", 
                enum: ["cme", "cne", "cpe", "internal", "external"],
                description: isHebrew ? "סוג תוכנית" : "Program type" 
              },
              creditHours: { type: "number", description: isHebrew ? "שעות זכות" : "Credit hours" },
              creditType: { type: "string", description: isHebrew ? "סוג זכויות" : "Credit type" },
              accreditationBody: { type: "string", description: isHebrew ? "גוף אישור" : "Accreditation body" },
              format: { 
                type: "string", 
                enum: ["online", "in_person", "hybrid", "webinar"],
                description: isHebrew ? "פורמט" : "Format" 
              },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              cost: { type: "number", description: isHebrew ? "עלות" : "Cost" }
            },
            required: ["title", "provider", "type", "creditHours", "format"]
          }
        },

{
          name: "createHealthCampaign",
          description: isHebrew 
            ? "צור קמפיין רפואי מולטי-שלבי לחינוך מטופלים ומניעה - למשל 'צור קמפיין חיסון שפעת לכל המטופלים מעל גיל 65'"
            : "Create multi-step health campaign for patient education and prevention - e.g. 'Create flu vaccination campaign for all patients over 65'",
          parameters: {
            type: "object",
            properties: {
              campaignType: {
                type: "string",
                enum: ["flu_vaccination", "mammogram_screening", "diabetes_checkup", "medication_adherence", "blood_pressure_monitoring", "custom"],
                description: isHebrew ? "סוג הקמפיין (או 'custom' לקמפיין מותאם)" : "Campaign type (or 'custom' for custom campaign)"
              },
              patientFilter: {
                type: "object",
                description: isHebrew ? "מסנני מטופלים לקמפיין" : "Patient filters for campaign",
                properties: {
                  ageMin: { type: "number", description: isHebrew ? "גיל מינימלי" : "Minimum age" },
                  ageMax: { type: "number", description: isHebrew ? "גיל מקסימלי" : "Maximum age" },
                  gender: { type: "string", enum: ["male", "female"], description: isHebrew ? "מגדר" : "Gender" },
                  conditions: { type: "array", items: { type: "string" }, description: isHebrew ? "מצבים רפואיים" : "Medical conditions" },
                  lastVisitDays: { type: "number", description: isHebrew ? "ימים מביקור אחרון" : "Days since last visit" }
                }
              },
              customName: { 
                type: "object", 
                description: isHebrew ? "שם מותאם לקמפיין (רק אם campaignType='custom')" : "Custom campaign name (only if campaignType='custom')",
                properties: {
                  he: { type: "string" },
                  en: { type: "string" }
                }
              },
              customSteps: { 
                type: "array", 
                description: isHebrew ? "שלבים מותאמים (רק אם campaignType='custom')" : "Custom steps (only if campaignType='custom')",
                items: { 
                  type: "object",
                  properties: {
                    day: { type: "number", description: isHebrew ? "יום ביחס לתחילת הקמפיין" : "Day relative to campaign start" },
                    type: { type: "string", enum: ["sms", "email", "portal"], description: isHebrew ? "סוג התקשורת" : "Communication type" },
                    template: { type: "string", description: isHebrew ? "שם התבנית" : "Template name" }
                  }
                }
              },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה (YYYY-MM-DD)" : "Start date (YYYY-MM-DD)" },
              customDuration: { type: "number", description: isHebrew ? "משך הקמפיין בימים (רק למותאם)" : "Campaign duration in days (custom only)" }
            },
            required: ["campaignType", "patientFilter"]
          }
        },

{
          name: "startHealthCampaign",
          description: isHebrew
            ? "הפעל קמפיין רפואי שנוצר - 'הפעל את הקמפיין שנוצר עכשיו'"
            : "Start a created health campaign - 'Start the campaign that was just created'",
          parameters: {
            type: "object",
            properties: {
              campaignId: { type: "string", description: isHebrew ? "מזהה הקמפיין" : "Campaign ID" }
            },
            required: ["campaignId"]
          }
        },

{
          name: "pauseHealthCampaign",
          description: isHebrew
            ? "השהה קמפיין רפואי פעיל זמנית"
            : "Temporarily pause an active health campaign",
          parameters: {
            type: "object",
            properties: {
              campaignId: { type: "string", description: isHebrew ? "מזהה הקמפיין" : "Campaign ID" }
            },
            required: ["campaignId"]
          }
        },

{
          name: "resumeHealthCampaign",
          description: isHebrew
            ? "המשך קמפיין רפואי שהושהה"
            : "Resume a paused health campaign",
          parameters: {
            type: "object",
            properties: {
              campaignId: { type: "string", description: isHebrew ? "מזהה הקמפיין" : "Campaign ID" }
            },
            required: ["campaignId"]
          }
        },

{
          name: "getChannelPerformance",
          description: isHebrew
            ? "ניתוח ביצועים מפורט לכל ערוץ תקשורת - SMS, אימייל, פורטל"
            : "Detailed performance analysis for each communication channel - SMS, email, portal",
          parameters: {
            type: "object",
            properties: {
              timeRange: { type: "number", description: isHebrew ? "טווח זמן בימים" : "Time range in days" },
              includeOptimization: { type: "boolean", description: isHebrew ? "כלול המלצות אופטימיזציה" : "Include optimization recommendations" }
            }
          }
        },

{
          name: "getPatientEngagementInsights",
          description: isHebrew
            ? "תובנות מעורבות מטופלים - דפוסי תגובה, העדפות ערוצים, זמני פעילות"
            : "Patient engagement insights - response patterns, channel preferences, activity times",
          parameters: {
            type: "object",
            properties: {
              patientSegment: { 
                type: "string", 
                enum: ["all", "age_groups", "conditions", "engagement_level"], 
                description: isHebrew ? "קבוצת מטופלים לניתוח" : "Patient segment to analyze" 
              },
              timeRange: { type: "number", description: isHebrew ? "טווח זמן בימים" : "Time range in days" }
            }
          }
        },

        // Treatment Courses
        {
          name: "getTreatmentCourses",
          description: isHebrew
            ? "הצג קורסי טיפול של מטופל"
            : "Get treatment courses for a patient",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "תאריך סיום" : "End date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר מקסימלי של רשומות" : "Maximum number of records" }
            },
            required: ["patientId"]
          }
        },

        {
          name: "createTreatmentCourse",
          description: isHebrew
            ? "צור רשומת קורס טיפול חדשה"
            : "Create a new treatment course record",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              data: { type: "object", description: isHebrew ? "נתוני קורס טיפול" : "Treatment course data" },
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך משויך" : "Associated document ID" }
            },
            required: ["patientId", "data"]
          }
        },

        {
          name: "updateTreatmentCourse",
          description: isHebrew
            ? "עדכן רשומת קורס טיפול קיימת"
            : "Update an existing treatment course record",
          parameters: {
            type: "object",
            properties: {
              recordId: { type: "string", description: isHebrew ? "מזהה רשומה לעדכון" : "Record ID to update" },
              updates: { type: "object", description: isHebrew ? "שדות לעדכון" : "Fields to update" }
            },
            required: ["recordId", "updates"]
          }
        },

        {
          name: "deleteTreatmentCourse",
          description: isHebrew
            ? "מחק רשומת קורס טיפול"
            : "Delete a treatment course record",
          parameters: {
            type: "object",
            properties: {
              recordId: { type: "string", description: isHebrew ? "מזהה רשומה למחיקה" : "Record ID to delete" }
            },
            required: ["recordId"]
          }
        },

        {
          name: "searchTreatmentCourses",
          description: isHebrew
            ? "חפש קורסי טיפול"
            : "Search treatment courses",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              searchText: { type: "string", description: isHebrew ? "שאילתת חיפוש" : "Search query" },
              limit: { type: "number", description: isHebrew ? "מספר מקסימלי של תוצאות" : "Maximum number of results" }
            },
            required: ["patientId", "searchText"]
          }
        },

        // Administrative Data
        {
          name: "getAdministrativeData",
          description: isHebrew
            ? "הצג נתונים מנהליים של מטופל"
            : "Get administrative data for a patient",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              limit: { type: "number", description: isHebrew ? "מספר מקסימלי של רשומות" : "Maximum number of records" }
            },
            required: ["patientId"]
          }
        },

        {
          name: "createAdministrativeData",
          description: isHebrew
            ? "צור רשומת נתונים מנהליים חדשה"
            : "Create a new administrative data record",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              data: { type: "object", description: isHebrew ? "נתונים מנהליים" : "Administrative data" },
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך משויך" : "Associated document ID" }
            },
            required: ["patientId", "data"]
          }
        },

        {
          name: "updateAdministrativeData",
          description: isHebrew
            ? "עדכן רשומת נתונים מנהליים קיימת"
            : "Update an existing administrative data record",
          parameters: {
            type: "object",
            properties: {
              recordId: { type: "string", description: isHebrew ? "מזהה רשומה לעדכון" : "Record ID to update" },
              updates: { type: "object", description: isHebrew ? "שדות לעדכון" : "Fields to update" }
            },
            required: ["recordId", "updates"]
          }
        },

        {
          name: "deleteAdministrativeData",
          description: isHebrew
            ? "מחק רשומת נתונים מנהליים"
            : "Delete an administrative data record",
          parameters: {
            type: "object",
            properties: {
              recordId: { type: "string", description: isHebrew ? "מזהה רשומה למחיקה" : "Record ID to delete" }
            },
            required: ["recordId"]
          }
        },

        {
          name: "searchAdministrativeData",
          description: isHebrew
            ? "חפש נתונים מנהליים"
            : "Search administrative data",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              searchText: { type: "string", description: isHebrew ? "שאילתת חיפוש" : "Search query" },
              limit: { type: "number", description: isHebrew ? "מספר מקסימלי של תוצאות" : "Maximum number of results" }
            },
            required: ["patientId", "searchText"]
          }
        },

        // ========== BILLING & PAYMENTS (billingService) ==========
        {
          name: "captureCharge",
          description: isHebrew
            ? "רשום חיוב עבור שירות רפואי. דורש קוד CPT (למשל '99213' לביקור משרדי), קודי אבחנה ICD-10, וזיהוי מטופל. השתמש בפונקציה זו, לא ב-createInvoice, לרישום שירותים."
            : "Capture a charge for a medical service. Requires CPT code (e.g., '99213' for office visit, '99214' for detailed visit), ICD-10 diagnosis codes, and patient identification. Use this function, NOT createInvoice, when recording services rendered.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID (ObjectId string)" },
              cptCode: { type: "string", description: isHebrew ? "קוד CPT (למשל '99213', '99214', '99215')" : "CPT procedure code (e.g., '99213' for office visit level 3, '99214' for level 4, '99215' for level 5). Use this field, NOT 'serviceCode' or 'procedureCode'" },
              diagnosisCodes: { type: "array", items: { type: "string" }, description: isHebrew ? "קודי אבחנה ICD-10 (למשל ['E11.9', 'I10'])" : "ICD-10 diagnosis codes array (e.g., ['E11.9', 'I10']). At least one recommended." },
              providerId: { type: "string", description: isHebrew ? "מזהה רופא מטפל" : "Provider ID who rendered the service" },
              serviceDate: { type: "string", description: isHebrew ? "תאריך שירות בפורמט YYYY-MM-DD" : "Date of service in YYYY-MM-DD format (e.g., '2026-02-06'). Use this field, NOT 'date'" },
              units: { type: "number", description: isHebrew ? "מספר יחידות (ברירת מחדל: 1)" : "Number of units (default: 1). For time-based codes, calculated from duration." },
              modifiers: { type: "array", items: { type: "string" }, description: isHebrew ? "קודי modifier (למשל ['25', '59'])" : "CPT modifiers (e.g., ['25', '59']). Optional." },
              placeOfService: { type: "string", description: isHebrew ? "מקום שירות (ברירת מחדל: '11' למשרד)" : "Place of service code (default: '11' for office). '21' for hospital, '23' for ER." },
              appointmentId: { type: "string", description: isHebrew ? "מזהה תור (אם רלוונטי)" : "Associated appointment ID (optional)" }
            },
            required: ["patientId", "cptCode"]
          }
        },
        {
          name: "getPatientCharges",
          description: isHebrew
            ? "הצג את כל החיובים של מטופל. ניתן לסנן לפי סטטוס ותאריך."
            : "Get all charges for a patient. Can filter by status and date range.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID (ObjectId string)" },
              status: { type: "string", enum: ["captured", "pending", "billed", "paid"], description: isHebrew ? "סנן לפי סטטוס" : "Filter by charge status (optional)" },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה YYYY-MM-DD" : "Start date filter YYYY-MM-DD (optional)" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום YYYY-MM-DD" : "End date filter YYYY-MM-DD (optional)" }
            },
            required: ["patientId"]
          }
        },
        {
          name: "generateInvoice",
          description: isHebrew
            ? "צור חשבונית עבור חיובי מטופל. יוצר חשבונית סלף-פיי (תשלום עצמי) עם פרטי השירותים."
            : "Generate an invoice for patient charges. Creates a self-pay invoice with service details and due date. Use this AFTER captureCharge to bill the patient.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID (ObjectId string)" },
              chargeIds: { type: "array", items: { type: "string" }, description: isHebrew ? "רשימת מזהי חיובים לחשבונית" : "Array of charge IDs to include in invoice (optional - if not provided, includes all unbilled charges)" },
              description: { type: "string", description: isHebrew ? "תיאור חשבונית" : "Invoice description (e.g., 'Office visit - February 2026')" }
            },
            required: ["patientId"]
          }
        },
        {
          name: "processPayment",
          description: isHebrew
            ? "רשום תשלום כנגד חשבונית. השתמש בפונקציה זו לרישום תשלום שהתקבל. עדיין לא מחובר למעבד תשלומים חיצוני - רושם תשלום פנימית."
            : "Record a SINGLE payment against an invoice. Use this to record a received payment. IMPORTANT: Only call this function ONCE per user request - do NOT call it multiple times unless the user explicitly asks for multiple separate payments. NOTE: Not yet connected to external payment processor - records payment internally.",
          parameters: {
            type: "object",
            properties: {
              invoiceId: { type: "string", description: isHebrew ? "מזהה חשבונית" : "Invoice ID to pay against. Use this field, NOT 'invoice'" },
              amount: { type: "number", description: isHebrew ? "סכום תשלום" : "Payment amount in dollars (e.g., 150.00). Overpayments are accepted - any excess is tracked as credit balance." },
              paymentMethod: { type: "string", enum: ["cash", "check", "credit_card", "debit_card", "bank_transfer", "other"], description: isHebrew ? "אמצעי תשלום" : "Payment method. Use this field, NOT 'method'" },
              paymentDetails: { type: "object", description: isHebrew ? "פרטי תשלום (מספר צ'ק, 4 ספרות אחרונות של כרטיס וכו')" : "Payment details object (e.g., {checkNumber: '5032'} for checks, {last4: '4242'} for cards). This gets encrypted with PCI-level encryption." },
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (אם שונה מהחשבונית)" : "Patient ID (optional - defaults to invoice patient)" }
            },
            required: ["invoiceId", "amount", "paymentMethod"]
          }
        },
        {
          name: "getOutstandingBalances",
          description: isHebrew
            ? "הצג יתרות חוב פתוחות של מטופל - כל החשבוניות שטרם שולמו."
            : "Get outstanding (unpaid) balances for a patient. Returns all pending/overdue invoices and total balance owed.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID (ObjectId string)" }
            },
            required: ["patientId"]
          }
        },
        {
          name: "createPaymentPlan",
          description: isHebrew
            ? "צור תוכנית תשלומים בתשלומים חודשיים. מחשב אוטומטית את התשלום החודשי."
            : "Create an installment payment plan for a patient. Automatically calculates monthly payment amount. Example: $1200 total, $200 down payment, 10 installments = $100/month.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID (ObjectId string)" },
              totalAmount: { type: "number", description: isHebrew ? "סכום כולל לתשלום" : "Total amount to be paid (e.g., 1200.00)" },
              downPayment: { type: "number", description: isHebrew ? "מקדמה (ברירת מחדל: 0)" : "Down payment amount (default: 0). Example: 200.00" },
              numberOfInstallments: { type: "number", description: isHebrew ? "מספר תשלומים חודשיים" : "Number of monthly installments (e.g., 6, 10, 12)" },
              startDate: { type: "string", description: isHebrew ? "תאריך תחילת תשלומים YYYY-MM-DD" : "Payment plan start date YYYY-MM-DD (e.g., '2026-03-01')" },
              invoiceIds: { type: "array", items: { type: "string" }, description: isHebrew ? "מזהי חשבוניות הקשורות לתוכנית" : "Invoice IDs covered by this plan (optional)" }
            },
            required: ["patientId", "totalAmount", "numberOfInstallments", "startDate"]
          }
        },
        {
          name: "getRevenueReport",
          description: isHebrew
            ? "הפק דוח הכנסות לטווח תאריכים. כולל סיכום חיובים, תשלומים, תביעות, ופירוט לפי משלמים וספקים."
            : "Generate a revenue report for a date range. Includes summary of charges, payments, claims, payer breakdown, and provider productivity.",
          parameters: {
            type: "object",
            properties: {
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה YYYY-MM-DD" : "Report start date in YYYY-MM-DD format (e.g., '2026-01-01')" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום YYYY-MM-DD" : "Report end date in YYYY-MM-DD format (e.g., '2026-01-31')" }
            },
            required: ["startDate", "endDate"]
          }
        },
        {
          name: "getPaymentHistory",
          description: isHebrew
            ? "הצג היסטוריית תשלומים של מטופל. כולל כל התשלומים שנרשמו."
            : "Get payment history for a patient. Returns all recorded payments with transaction details.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID (ObjectId string)" },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה YYYY-MM-DD" : "Start date filter YYYY-MM-DD (optional)" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום YYYY-MM-DD" : "End date filter YYYY-MM-DD (optional)" }
            },
            required: ["patientId"]
          }
        },
        // ========== Credit Balance Management ==========
        {
          name: "getPatientCreditBalance",
          description: isHebrew
            ? "הצג יתרת זכות של מטופל. יתרות זכות נוצרות מתשלומי יתר."
            : "Get a patient's credit balance from overpayments. Shows all available credits and total balance. Use this when patient asks about their credit or before applying credit to a new invoice.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID (ObjectId string)" }
            },
            required: ["patientId"]
          }
        },
        {
          name: "applyCreditToInvoice",
          description: isHebrew
            ? "החל יתרת זכות על חשבונית. מנכה מיתרת הזכות של המטופל ומחיל על חשבונית פתוחה."
            : "Apply patient's credit balance to an EXISTING outstanding (unpaid) invoice. ONLY use when there is already an unpaid invoice — NEVER generate a new invoice just to apply credit. If no outstanding invoice exists, tell the user the credit is on file for their next visit. Call this at most ONCE per invoice.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID (ObjectId string)" },
              invoiceId: { type: "string", description: isHebrew ? "מזהה חשבונית" : "Invoice ID to apply credit to" },
              amount: { type: "number", description: isHebrew ? "סכום להחלה (אופציונלי)" : "Amount of credit to apply (optional - defaults to maximum available up to invoice balance)" }
            },
            required: ["patientId", "invoiceId"]
          }
        },
        // ========== Billing CRUD: Update / Void / Refund / Cancel ==========
        {
          name: "updateCharge",
          description: isHebrew
            ? "עדכן חיוב קיים - קוד CPT, אבחנה, סכום, יחידות"
            : "Update an existing charge. Use this to change CPT code, diagnosis codes, units, amount, or service date. Cannot update voided or already-billed charges.",
          parameters: {
            type: "object",
            properties: {
              chargeId: { type: "string", description: isHebrew ? "מזהה חיוב" : "Charge ID (the chargeId string, NOT MongoDB _id)" },
              cptCode: { type: "string", description: isHebrew ? "קוד CPT חדש" : "New CPT code (e.g. 99214). Optional - only if changing." },
              diagnosisCodes: { type: "array", items: { type: "string" }, description: isHebrew ? "קודי אבחנה ICD-10 חדשים" : "New ICD-10 diagnosis codes array (e.g. [\"E11.9\"]). Optional." },
              units: { type: "number", description: isHebrew ? "מספר יחידות" : "Number of units. Optional." },
              serviceDate: { type: "string", description: isHebrew ? "תאריך שירות YYYY-MM-DD" : "Service date YYYY-MM-DD. Optional." },
              placeOfService: { type: "string", description: isHebrew ? "מקום שירות" : "Place of service code (e.g. 11=Office). Optional." }
            },
            required: ["chargeId"]
          }
        },
        {
          name: "voidCharge",
          description: isHebrew
            ? "בטל חיוב - סמן כבטל עם סיבה. לא מוחק, שומר נתיב ביקורת"
            : "Void/cancel a charge. Marks as voided with reason (maintains audit trail - does NOT delete). Use for incorrect charges, duplicate entries, or billing errors.",
          parameters: {
            type: "object",
            properties: {
              chargeId: { type: "string", description: isHebrew ? "מזהה חיוב לביטול" : "Charge ID to void (the chargeId string)" },
              reason: { type: "string", description: isHebrew ? "סיבת ביטול" : "Reason for voiding (e.g. 'Duplicate charge', 'Wrong CPT code', 'Patient not seen')" }
            },
            required: ["chargeId", "reason"]
          }
        },
        {
          name: "voidInvoice",
          description: isHebrew
            ? "בטל חשבונית - סמן כבטלה. לא ניתן לבטל חשבונית ששולמה במלואה"
            : "Void/cancel an invoice. Cannot void a fully paid invoice (use refundPayment instead). Use for billing errors or cancelled services.",
          parameters: {
            type: "object",
            properties: {
              invoiceId: { type: "string", description: isHebrew ? "מזהה חשבונית" : "Invoice ID to void (the invoiceId string)" },
              reason: { type: "string", description: isHebrew ? "סיבת ביטול" : "Reason for voiding the invoice" }
            },
            required: ["invoiceId", "reason"]
          }
        },
        {
          name: "refundPayment",
          description: isHebrew
            ? "החזר תשלום - מלא או חלקי. רק תשלומים שהושלמו"
            : "Refund a completed payment (full or partial). Creates a refund record and adjusts the invoice balance. Can only refund completed payments.",
          parameters: {
            type: "object",
            properties: {
              paymentId: { type: "string", description: isHebrew ? "מזהה תשלום להחזר" : "Payment ID to refund (the paymentId string)" },
              refundAmount: { type: "number", description: isHebrew ? "סכום החזר (אופציונלי, ברירת מחדל: מלא)" : "Refund amount in dollars. Optional - defaults to full payment amount. Use for partial refunds." },
              reason: { type: "string", description: isHebrew ? "סיבת החזר" : "Reason for refund (e.g. 'Service not rendered', 'Overpayment', 'Patient request')" }
            },
            required: ["paymentId", "reason"]
          }
        },
        {
          name: "updatePaymentPlan",
          description: isHebrew
            ? "עדכן תוכנית תשלומים - מספר תשלומים, סכום חודשי, תאריך התחלה"
            : "Update an existing payment plan. Change number of installments, monthly payment amount, or start date. Cannot update cancelled plans.",
          parameters: {
            type: "object",
            properties: {
              planId: { type: "string", description: isHebrew ? "מזהה תוכנית תשלומים" : "Payment plan ID (the planId string)" },
              numberOfInstallments: { type: "number", description: isHebrew ? "מספר תשלומים חדש" : "New number of installments. Monthly payment auto-recalculated." },
              monthlyPayment: { type: "number", description: isHebrew ? "סכום חודשי חדש" : "New monthly payment amount in dollars." },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה חדש YYYY-MM-DD" : "New start date YYYY-MM-DD" }
            },
            required: ["planId"]
          }
        },
        {
          name: "cancelPaymentPlan",
          description: isHebrew
            ? "בטל תוכנית תשלומים - סמן כמבוטלת עם סיבה"
            : "Cancel a payment plan. Marks as cancelled with reason. Remaining balance will need to be handled separately (new plan or full payment).",
          parameters: {
            type: "object",
            properties: {
              planId: { type: "string", description: isHebrew ? "מזהה תוכנית תשלומים לביטול" : "Payment plan ID to cancel (the planId string)" },
              reason: { type: "string", description: isHebrew ? "סיבת ביטול" : "Reason for cancellation (e.g. 'Patient request', 'Insurance coverage changed', 'Account closed')" }
            },
            required: ["planId", "reason"]
          }
        },
        // ========== ICD-10-CM DIAGNOSIS CODE LOOKUP ==========
        {
          name: "searchDiagnosisCode",
          description: isHebrew
            ? "חפש קוד אבחנה ICD-10-CM לפי תיאור או קוד חלקי. מכיל 74,706 קודים רשמיים מ-CDC/CMS"
            : "Search ICD-10-CM diagnosis codes by description or partial code. Contains all 74,706 official 2026 codes from CDC/CMS. Example: 'diabetes type 2' returns E11.xx codes.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: isHebrew ? "מילת חיפוש - תיאור אבחנה או קוד חלקי (למשל 'diabetes' או 'E11')" : "Search term - diagnosis description or partial code (e.g. 'diabetes type 2', 'hypertension', 'E11', 'J45')" },
              maxResults: { type: "number", description: isHebrew ? "מספר תוצאות מקסימלי (ברירת מחדל 20)" : "Maximum results to return (default 20, max 50)" }
            },
            required: ["query"]
          }
        },
        {
          name: "validateDiagnosisCode",
          description: isHebrew
            ? "בדוק אם קוד ICD-10-CM תקין - מחזיר תיאור וקטגוריה אם הקוד קיים"
            : "Validate an ICD-10-CM diagnosis code. Checks against official 74,706 code set. Returns description and category if valid.",
          parameters: {
            type: "object",
            properties: {
              code: { type: "string", description: isHebrew ? "קוד ICD-10-CM לבדיקה (למשל 'E11.65')" : "ICD-10-CM code to validate (e.g. 'E11.65', 'I10', 'J45.20')" }
            },
            required: ["code"]
          }
        },
        {
          name: "suggestDiagnosisCodes",
          description: isHebrew
            ? "הצע קודי ICD-10-CM מתאימים לתיאור אבחנה קליני חופשי"
            : "Suggest ICD-10-CM codes for a clinical diagnosis description. Takes free text and returns matching codes ranked by relevance.",
          parameters: {
            type: "object",
            properties: {
              diagnosis: { type: "string", description: isHebrew ? "תיאור אבחנה קליני (למשל 'סוכרת סוג 2 עם רטינופתיה')" : "Clinical diagnosis description (e.g. 'type 2 diabetes with retinopathy', 'essential hypertension', 'acute bronchitis')" },
              maxResults: { type: "number", description: isHebrew ? "מספר הצעות מקסימלי (ברירת מחדל 10)" : "Maximum suggestions to return (default 10)" }
            },
            required: ["diagnosis"]
          }
        },
        {
          name: "getRelatedDiagnosisCodes",
          description: isHebrew
            ? "קבל קודי ICD-10-CM ספציפיים יותר תחת קוד כללי. למשל E11 מחזיר E11.00, E11.01 וכו'"
            : "Get more specific ICD-10-CM codes under a general/parent code. Example: E11 returns all E11.xx child codes (diabetes mellitus subtypes). Useful for finding the most specific billable code.",
          parameters: {
            type: "object",
            properties: {
              parentCode: { type: "string", description: isHebrew ? "קוד ICD-10 כללי (למשל 'E11' או 'I25')" : "Parent ICD-10 code to expand (e.g. 'E11', 'I25', 'J45')" },
              maxResults: { type: "number", description: isHebrew ? "מספר תוצאות מקסימלי (ברירת מחדל 50)" : "Maximum child codes to return (default 50)" }
            },
            required: ["parentCode"]
          }
        },
        // ========== MEDICATION ENTITLEMENT ==========
        {
          name: "checkMedicationEntitlement",
          description: isHebrew
            ? "בדוק זכאות מלאה לתרופה עבור מטופל - כולל פורמולרי, ביטוח, אזהרות בטיחות וחלופות זולות יותר"
            : "Comprehensive medication entitlement check for a patient. Combines Medicare Part D formulary lookup, insurance coverage rules, RxNorm drug identification, DailyMed safety warnings, and OpenFDA adverse events. Returns tier, copay estimate, prior auth requirements, covered alternatives, and safety alerts. Use this when a provider asks 'Is [drug] covered for [patient]?' or 'What will [drug] cost?'",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (MongoDB ObjectId)" : "Patient ID (MongoDB ObjectId). Get this from searchPatientsByName first." },
              drugName: { type: "string", description: isHebrew ? "שם תרופה (למשל 'metformin', 'Lipitor', 'atorvastatin')" : "Drug name to check - generic or brand (e.g. 'metformin', 'Lipitor', 'atorvastatin', 'Eliquis'). Use the common name, NOT RxCUI." }
            },
            required: ["patientId", "drugName"]
          }
        },
        {
          name: "findCoveredAlternatives",
          description: isHebrew
            ? "מצא חלופות מכוסות לתרופה - גנריות, ביוסימילריות, ותרופות באותה קבוצה בשכבה נמוכה יותר"
            : "Find covered alternatives for a medication. Returns generic equivalents, biosimilars, and same-class drugs at lower formulary tiers. Useful when a prescribed drug is expensive, not covered, or requires prior authorization. Example: findCoveredAlternatives('Lipitor') returns atorvastatin (generic, Tier 1) and other statins.",
          parameters: {
            type: "object",
            properties: {
              drugName: { type: "string", description: isHebrew ? "שם תרופה לחיפוש חלופות" : "Drug name to find alternatives for (e.g. 'Lipitor', 'Humira', 'Eliquis')" },
              insuranceType: { type: "string", description: isHebrew ? "סוג ביטוח (אופציונלי)" : "Insurance type for coverage rules (e.g. 'Medicare', 'PPO', 'HMO'). Optional - defaults to Medicare Part D formulary." }
            },
            required: ["drugName"]
          }
        },
        {
          name: "getFormularyInfo",
          description: isHebrew
            ? "חפש תרופה ישירות במאגר Medicare Part D - שכבה, אישור מוקדם, מגבלות כמות"
            : "Direct Medicare Part D formulary lookup. Returns tier level, prior authorization requirements, step therapy, quantity limits, and cost estimates for a drug. Use this for quick formulary checks without the full entitlement analysis. Example: getFormularyInfo('lisinopril') returns Tier 1, no prior auth, ~$3 copay.",
          parameters: {
            type: "object",
            properties: {
              drugName: { type: "string", description: isHebrew ? "שם תרופה לחיפוש (גנרי או מסחרי)" : "Drug name to look up (generic or brand, e.g. 'lisinopril', 'Jardiance', 'metformin')" }
            },
            required: ["drugName"]
          }
        },

        // ========== CLAIM TRACKING TOOLS ==========
        {
          name: "createClaim",
          description: isHebrew
            ? "צור תביעת ביטוח חדשה עבור מטופל עם קודי אבחנה ופרוצדורות"
            : "Create a new insurance claim for a patient. Include diagnosis codes (ICD-10), procedure codes (CPT), and charges. Example: 'Create a claim for patient X with diagnosis E11.9 and CPT 99213'.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              charges: { type: "array", description: isHebrew ? "רשימת חיובים" : "Array of charges, each with amount, cptCode, description. Example: [{amount: 150, cptCode: '99213', description: 'Office visit'}]",
                items: { type: "object", properties: { amount: { type: "number" }, cptCode: { type: "string" }, description: { type: "string" } } }
              },
              diagnosisCodes: { type: "array", description: isHebrew ? "קודי אבחנה ICD-10" : "ICD-10 diagnosis codes (e.g., ['E11.9', 'I10'])", items: { type: "string" } },
              procedureCodes: { type: "array", description: isHebrew ? "קודי פרוצדורה CPT" : "CPT procedure codes (e.g., ['99213', '85025'])", items: { type: "string" } }
            },
            required: ["patientId"]
          }
        },
        {
          name: "updateClaimStatus",
          description: isHebrew
            ? "עדכן סטטוס תביעה (טיוטה, מוכן, הוגש, ממתין, שולם, נדחה, ערעור)"
            : "Update a claim's status. Valid statuses: draft, ready, submitted, pending, paid, denied, appealed, void. Example: 'Mark claim YAL-xyz as paid'.",
          parameters: {
            type: "object",
            properties: {
              claimId: { type: "string", description: isHebrew ? "מספר תביעה או מזהה" : "Claim number (e.g., 'YAL-xxx-xxx') or claim ID" },
              status: { type: "string", description: isHebrew ? "סטטוס חדש" : "New status: draft, ready, submitted, pending, paid, denied, appealed, void" },
              notes: { type: "string", description: isHebrew ? "הערות לעדכון" : "Notes about the status change (e.g., 'Check received #1234', 'Denied - missing modifier')" }
            },
            required: ["claimId", "status"]
          }
        },
        {
          name: "getClaimsByStatus",
          description: isHebrew
            ? "הצג תביעות לפי סטטוס - כל התביעות הממתינות, ששולמו, שנדחו וכו'"
            : "Get all claims filtered by status. Use to find pending, denied, paid, or all claims. Example: 'Show me all denied claims' or 'Show all pending claims'.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", description: isHebrew ? "סטטוס לסינון (אופציונלי)" : "Status to filter by: draft, ready, submitted, pending, paid, denied, appealed. Omit for all claims." }
            },
            required: []
          }
        },
        {
          name: "getPatientClaims",
          description: isHebrew
            ? "הצג את כל התביעות של מטופל ספציפי"
            : "Get all claims for a specific patient. Shows claim numbers, statuses, amounts, and dates.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID to look up claims for" }
            },
            required: ["patientId"]
          }
        },
        {
          name: "getClaimAging",
          description: isHebrew
            ? "דו״ח הזדקנות תביעות - כמה תביעות לא שולמו ב-30/60/90/120+ ימים"
            : "Show claim aging report - how many unpaid claims are in each age bucket (0-30, 31-60, 61-90, 91-120, 120+ days). Critical for identifying revenue leakage.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        {
          name: "addClaimNote",
          description: isHebrew
            ? "הוסף הערת מעקב לתביעה (למשל: התקשרתי לביטוח, ממתין לתשובה)"
            : "Add a follow-up note to a claim. Example: 'Add note to claim YAL-xxx - Called insurance, awaiting response'.",
          parameters: {
            type: "object",
            properties: {
              claimId: { type: "string", description: isHebrew ? "מספר תביעה" : "Claim number or claim ID" },
              note: { type: "string", description: isHebrew ? "טקסט ההערה" : "Note text (e.g., 'Called Aetna, claim being reprocessed, expect 2 weeks')" }
            },
            required: ["claimId", "note"]
          }
        },
        {
          name: "getClaimsDashboard",
          description: isHebrew
            ? "לוח מחוונים של תביעות - סיכום כללי לפי סטטוס, סכומים, שיעור גבייה"
            : "Show billing claims dashboard with summary statistics: total claims by status, amounts, collection rate, average aging, and recent claims. Use when admin asks 'Show me the billing dashboard'.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },

        // ========== SESSION MANAGEMENT TOOLS (ADMIN) ==========
        {
          name: "getActiveSessions",
          description: isHebrew
            ? "הצג את כל המשתמשים המחוברים כרגע למערכת עם פרטי משתמש, זמן פעילות אחרון ותפקידים"
            : "Show all currently logged-in users with their details (name, email, role, last activity, practice). Use when admin asks 'Who is logged in?' or 'Show active sessions'.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        {
          name: "forceUserLogout",
          description: isHebrew
            ? "נתק משתמש מהמערכת בכוח - משמש לאירועי אבטחה או ניהול. דורש הרשאות מנהל"
            : "Force a user to log out by terminating all their active sessions. Use for security incidents or admin management. Requires admin privileges. Example: 'Force Dr. Smith to log out'.",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה המשתמש לניתוק" : "User ID to force logout. Get this from getActiveSessions or user lookup." },
              reason: { type: "string", description: isHebrew ? "סיבת הניתוק" : "Reason for force logout (e.g., 'security incident', 'account compromised', 'admin request')" }
            },
            required: ["userId"]
          }
        },
        {
          name: "getUserLoginHistory",
          description: isHebrew
            ? "הצג היסטוריית כניסות ויציאות של משתמש - חשוב לביקורת אבטחה ותאימות HIPAA"
            : "View login/logout history. Shows who logged in, when, and how (login method). Important for HIPAA compliance and security auditing. Can filter by user ID or show all users.",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש (אופציונלי - ללא סינון מציג הכל)" : "User ID to filter history for (optional - omit to show all users)" },
              limit: { type: "number", description: isHebrew ? "מספר רשומות מקסימלי (ברירת מחדל: 50)" : "Maximum number of entries to return (default: 50)" }
            },
            required: []
          }
        },
        {
          name: "getFailedLoginAttempts",
          description: isHebrew
            ? "הצג ניסיונות כניסה כושלים - חשוב לזיהוי התקפות brute force ותאימות HIPAA"
            : "View failed login attempts including invalid credentials, locked accounts, and MFA failures. Critical for detecting brute force attacks and HIPAA compliance monitoring.",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: isHebrew ? "מספר רשומות מקסימלי (ברירת מחדל: 50)" : "Maximum number of entries to return (default: 50)" }
            },
            required: []
          }
        },
        {
          name: "getSessionStats",
          description: isHebrew
            ? "הצג סטטיסטיקת מערכת - מספר חיבורים פעילים וטוקני CSRF"
            : "Get system session statistics: total active sessions count and CSRF token count. Quick overview of system activity.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },

        // ========== VISIT RECORDING ==========
        {
          name: "startVisitRecording",
          description: "Start recording a new patient visit. Call this when the doctor wants to record a visit encounter. Returns a visitId that the frontend uses to start audio capture.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "Patient ID to link the visit to" },
              visitType: { type: "string", enum: ["in-person", "telehealth", "phone"], description: "Type of visit", default: "in-person" },
              consentMethod: { type: "string", enum: ["verbal", "written", "pre-visit-form"], description: "How patient consent was obtained", default: "verbal" },
            },
            required: ["patientId"]
          }
        },
        {
          name: "startNewPatientVisit",
          description: "Start a new patient visit for manual documentation (no audio recording). Creates an empty visit and opens the artifact panel in compose mode where the doctor can type free-form visit notes. AI will then structure them into SOAP fields. Call this when the doctor says 'start new visit', 'manual visit', 'type visit notes', 'create visit', 'document visit', or similar.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "Patient ID to link the visit to" },
              visitType: { type: "string", enum: ["in-person", "telehealth", "phone"], description: "Type of visit", default: "in-person" },
            },
            required: ["patientId"]
          }
        },
        {
          name: "endVisitRecording",
          description: "End the current visit recording and generate an AI-structured SOAP note summary.",
          parameters: {
            type: "object",
            properties: {
              visitId: { type: "string", description: "Visit ID to end recording for" }
            },
            required: ["visitId"]
          }
        },
        {
          name: "getPatientVisits",
          description: "Get visit history for a patient. Returns list of past visits with dates, types, and SOAP summaries.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "Patient ID to get visit history for" },
              limit: { type: "number", description: "Maximum number of visits to return (default 10)" }
            },
            required: ["patientId"]
          }
        }
  ];

      // Filter and clean the hardcoded functions
      const hardcodedFunctions = platformFunctions.filter(f => f) // Remove undefined functions
       .map(f => {
         // Clean undefined properties from each function's parameters
         if (f.parameters && f.parameters.properties) {
           f.parameters.properties = this.utilityHelpers.cleanUndefinedProperties(f.parameters.properties);
         }
         return f;
       });
  
      // Add all generated medical functions (920 functions from 184 categories)
      // Convert them to the format expected by getAllPlatformFunctions
      const generatedFunctionsList = [];
  
      // Create a set of function names that are already in the hardcoded list
      const existingFunctionNames = new Set(hardcodedFunctions.map(f => f.name));
  
      for (const [functionName, functionDef] of Object.entries(generatedMedicalFunctions)) {
        // Skip if this function is already in the hardcoded list
        // (e.g., duplicate createAppointment)
        if (existingFunctionNames.has(functionName)) {
          // Only show duplicate warnings once to avoid log spam
          if (!this.duplicateWarningsShown) {
            console.log(`⚠️ Skipping duplicate generated function: ${functionName}`);
          }
          continue;
        }

        // Extract collection name from function name
        const collectionName = this.extractCollectionFromFunctionName(functionName);

        // Get dynamic schema from unified medical schemas
        let agentSchema = {};
        try {
          agentSchema = unifiedMedicalSchemas.getAgentSchema(collectionName);
        } catch (error) {
          // If schema doesn't exist, use empty object (function will still work)
          if (process.env.DEBUG_SCHEMA === 'true') {
            console.log(`⚠️ No schema found for collection: ${collectionName} (function: ${functionName})`);
          }
        }

        // Build parameter properties based on operation type
        let paramProperties = {
          patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" }
        };
        let required = ["patientId"];

        // Inject dynamic schema for operations that need data fields
        if (functionName.startsWith('create') || functionName.startsWith('add')) {
          // CREATE/ADD operations need data parameter with full schema
          paramProperties.data = {
            type: "object",
            properties: agentSchema,  // ← DYNAMIC SCHEMA INJECTION
            description: isHebrew ? `שדות נתונים עבור ${collectionName}` : `Data fields for ${collectionName}`
          };
          required.push("data");

          // Optional documentId for linking to source documents
          paramProperties.documentId = {
            type: "string",
            description: isHebrew ? "מזהה מסמך קשור" : "Associated document ID"
          };
        } else if (functionName.startsWith('update')) {
          // UPDATE operations need updates parameter with schema
          paramProperties.updates = {
            type: "object",
            properties: agentSchema,  // ← DYNAMIC SCHEMA INJECTION
            description: isHebrew ? "שדות לעדכון" : "Fields to update"
          };

          // Update also needs the record ID
          const idField = functionName.includes('Medication') ? 'medicationId' :
                         functionName.includes('Diagnosis') ? 'diagnosisId' :
                         functionName.includes('Allergy') ? 'allergyId' :
                         'recordId';
          paramProperties[idField] = {
            type: "string",
            description: isHebrew ? `מזהה ${collectionName}` : `${collectionName} ID`
          };
          required = [idField, "updates"];
        }
        // GET/DELETE/SEARCH operations only need basic parameters (patientId already added)

        // Convert the generated function format to match the expected format
        const convertedFunction = {
          name: functionName,
          description: functionDef.description,
          parameters: {
            type: "object",
            properties: paramProperties,
            required: required
          }
        };

        generatedFunctionsList.push(convertedFunction);
      }

      // Mark duplicate warnings as shown and provide summary
      if (!this.duplicateWarningsShown) {
        const duplicateCount = Object.keys(generatedMedicalFunctions).length - generatedFunctionsList.length;
        if (duplicateCount > 0) {
          console.log(`ℹ️ Skipped ${duplicateCount} duplicate functions (hardcoded versions take precedence)`);
        }
        this.duplicateWarningsShown = true;
      }

      console.log(`📚 Added ${generatedFunctionsList.length} generated medical functions to platform functions`);
  
      // Combine hardcoded and generated functions
      const allFunctions = [...hardcodedFunctions, ...generatedFunctionsList];
  
      // Cache the result for future use (reuse cacheKey from top of function)
      // Mark as initializing to prevent concurrent builds
      if (!this.FUNCTION_CACHE.initializing) {
        this.FUNCTION_CACHE.initializing = true;
      }
  
      this.FUNCTION_CACHE.all[cacheKey] = allFunctions;
      this.FUNCTION_CACHE.initialized = true;
      this.FUNCTION_CACHE.initializing = false;  // Done initializing
      console.log(`💾 Cached ${allFunctions.length} functions for ${cacheKey}`);
  
      return allFunctions;
    }

    getCompleteSystemInstruction(language, clinicCountry, practiceContext, currentContext) {
      const isHebrew = language === 'he';
      const practiceName = practiceContext?.name || 'IntelliCare';
      
      // Build context awareness message
      let contextNote = '';
      if (currentContext && currentContext.patientId && currentContext.patientName) {
        const timeSinceAction = Date.now() - (currentContext.lastActionTime || 0);
        const isRecent = timeSinceAction < 5 * 60 * 1000; // Context valid for 5 minutes
        
        if (isRecent) {
          if (isHebrew) {
            contextNote = `\n\n⚠️ הקשר נוכחי: מטופל ${currentContext.patientName} (מזהה: ${currentContext.patientId})\nאם המשתמש מבקש לעדכן פרטים, לשנות כתובת, להציג מסמכים, או כל פעולה אחרת ללא ציון שם, התייחס למטופל הזה.\nאל תשאל "לאיזה מטופל?" - אתה יודע שזה ${currentContext.patientName}.\nאם המשתמש אומר "הצג מסמכים" השתמש ב-getDocuments עם patientId: "${currentContext.patientId}"`;
          } else {
            contextNote = `\n\n⚠️ Current context: Patient ${currentContext.patientName} (ID: ${currentContext.patientId})\nIf the user asks to update details, change address, show documents, or any other action without specifying a name, refer to this patient.\nDon't ask "which patient?" - you know it's ${currentContext.patientName}.\nIf user says "show documents" use getDocuments with patientId: "${currentContext.patientId}"`;
          }
        }
      }
      
      if (isHebrew) {
        return `אתה העוזר הרפואי של ${practiceName}.
        
  🚨 חשוב - כללי ניהול מטופלים:
  **הוספת מטופל חדש:**
  - השתמש ב-addPatient ישירות - הפונקציה תבדוק אוטומטית אם המטופל קיים
  - אם המטופל כבר קיים, תקבל הודעה מתאימה
  
  **עדכון או מציאת מטופל:**
  - השתמש בפונקציות הרלוונטיות ישירות (updatePatient, getPatientDetails וכו')
  - הן יטפלו בחיפוש באופן אוטומטי

  🚨 עיצוב תגובות:
  - לעולם אל תשתמש בטבלאות markdown עם תו | (הן לא מוצגות נכון בממשק הצ'אט)
  - השתמש בנקודות או רשימות ממוספרות במקום טבלאות
  - במקום טבלה, השתמש בפורמט:
    • פריט: 123
    • שם: ערך${contextNote}`;
      } else {
        return `You are ${practiceName}'s medical assistant.

  ⛔⛔⛔ CRITICAL FORMATTING RULES ⛔⛔⛔
  1. NEVER use markdown tables with | pipe characters (they don't render)
  2. NEVER use plain - dashes for bullets (use • or emojis instead)
  3. Use emojis to make responses visually appealing

  ❌ WRONG:
  | Metric | Count |
  - Warning letters issued
  - No injunctions

  ✅ CORRECT - Use this style:
  📊 **Key Metrics:**
  • Total Citations: 20
  • Compliance Actions: 10
  • Warning Letters: Yes ⚠️
  • Injunctions: No ✅

  🏭 **Facilities with Warning Letters:**
  • Teva Pharmaceutical Industries (Jerusalem)
  • Teva Parenteral Medicines (Irvine, CA)

  📋 **Notable Citations:**
  1. Equipment cleaning procedures (21 CFR 211.67)
  2. Documentation requirements
  ⛔⛔⛔ END FORMATTING RULES ⛔⛔⛔

  📅 Appointments - schedule, reschedule, cancel, find slots
  📊 Reports - patient, practice, compliance, custom
  👥 User Management - roles, permissions, 2FA
  ⚙️ System Admin - backups, security, monitoring
  📈 Analytics - statistics, performance, trends
  
  Examples of what you can do:
  - "Add a new patient named John Smith"
  - "Show me all diabetic patients who haven't visited in 6 months"
  - "Analyze this blood test"
  - "Schedule appointment for John Smith next Tuesday"
  - "Generate HIPAA report for last quarter"
  - "Check interactions between aspirin and warfarin"
  
  🚨 IMPORTANT - Patient Management Rules:
  **When user says "add new patient" or "create patient":**
  - ALWAYS use addPatient function ONLY
  - DO NOT use any other function
  - The addPatient function will automatically check for duplicates internally
  - If patient already exists, you'll get an appropriate message
  
  **Updating or finding a patient:**
  - Use the relevant functions directly (updatePatient, getPatientDetails, etc.)
  - They will handle the search automatically
  
  **NEVER use interpretLabResults for patient management**
  
  🚨 When uploading documents:
  **Auto-detection**: 
  - If message contains "file uploaded:" or "העלאת קובץ:" or filename with extension (.pdf, .jpg, .png etc.):
    1. If there's current patient context (currentContext.patientId), use it
    2. If no context, ask "Which patient is this document for?"
    3. Then call analyzeDocument with the details
  
  - If user says "I want to upload a document" or "add document":
    1. If there's current patient context, say "Sure, I'm ready to receive the document for [patient name]. Just upload the file."
    2. If no context, ask "Which patient would you like to upload a document for?"
    3. Wait for file upload (user will upload through the interface)
  4. **Step 4**: Call analyzeDocument with:
     - documentPath: filename from step 1
     - patientId: found patient ID
     - documentType: based on filename content (prescription, lab_result, etc)
  5. **IMPORTANT**: Don't stop after searchPatients - always continue to analyzeDocument!
  
  Always:
  - Understand intent from natural language
  - Collect all required information conversationally
  - Execute the appropriate function
  - Provide clear, helpful responses
  - REMEMBER: NO markdown tables with | - use bullet points!

  You have access to ${this.getAllPlatformFunctions('en', clinicCountry).length} functions covering every aspect of the medical platform.${contextNote}`;
      }
    }

    updateSessionContext(session, functionName, args, result) {
      const now = Date.now();
      
      switch(functionName) {
        case 'searchPatients':
        case 'searchPatientsByName':
        case 'findPatient':
          // If search returned single patient, set as current context
          if (result.data && result.data.length === 1) {
            const patient = result.data[0];
            session.currentContext = {
              patientId: patient._id || patient.patientId,
              patientName: `${patient.firstName} ${patient.lastName}`,
              lastAction: 'search',
              lastActionTime: now
            };
            console.log(`🎯 Context set: Patient ${session.currentContext.patientName} (${session.currentContext.patientId})`);
          } else if (result.data && result.data.length > 1) {
            // Multiple patients - clear context unless user selects one
            console.log(`🎯 Multiple patients found - context pending selection`);
          }
          break;
        
        case 'listAllPatients':
          // Don't set context for bulk list operations
          console.log(`📋 Listed ${result.data?.length || 0} patients - context unchanged`);
          break;
          
        case 'getPatientDetails':
          // Set context to viewed patient
          if (result.data) {
            const patient = result.data;
            session.currentContext = {
              patientId: patient._id || patient.patientId,
              patientName: `${patient.firstName} ${patient.lastName}`,
              lastAction: 'view',
              lastActionTime: now
            };
            console.log(`🎯 Context set: Patient ${session.currentContext.patientName} (${session.currentContext.patientId})`);
          }
          break;
          
        case 'updatePatient':
          // Keep context after update
          session.currentContext.lastAction = 'update';
          session.currentContext.lastActionTime = now;
          console.log(`🎯 Context maintained: Patient ${session.currentContext.patientName} updated`);
          break;
          
        case 'addPatient':
          // Set context to newly added patient
          if (result.data) {
            const patient = result.data;
            session.currentContext = {
              patientId: patient._id || patient.patientId,
              patientName: `${patient.firstName} ${patient.lastName}`,
              lastAction: 'add',
              lastActionTime: now
            };
            console.log(`🎯 Context set: New patient ${session.currentContext.patientName} (${session.currentContext.patientId})`);
          }
          break;
      }
    }

    getFunctionGroups() {
      if (this.functionGroups) {
        return this.functionGroups; // Return cached version
      }
      
      // Get all platform functions
      const allFunctions = this.getAllPlatformFunctions('en', 'USA');
      
      // Organize functions by category with handlers
      const groups = {
        patient: {},
        appointment: {},
        document: {},
        billing: {},
        communication: {},
        workflow: {},
        reporting: {},
        administration: {}
      };
      
      // Process each function and categorize it
      for (const func of allFunctions) {
        if (!func || !func.name) continue;
        
        const category = this.categorizeFunctionName(func.name);
        const subcategory = this.getSubcategory(func.name, category);
        
        if (!groups[category]) groups[category] = {};
        if (!groups[category][subcategory]) groups[category][subcategory] = {};
        
        // Create function handler that wraps the actual function execution
        groups[category][subcategory][func.name] = {
          handler: async (...args) => {
            return await this.executeFunction(func.name, args[0] || {}, args[1]);
          },
          description: func.description,
          parameters: func.parameters,
          sensitive: this.isSensitiveFunction(func.name),
          critical: this.isCriticalFunction(func.name)
        };
      }
      
      // Cache the result
      this.functionGroups = groups;
      return groups;
    }

    categorizeFunctionName(functionName) {
      const lowerName = functionName.toLowerCase();
      
      if (lowerName.includes('patient') || lowerName.includes('user')) return 'patient';
      if (lowerName.includes('appointment') || lowerName.includes('schedule')) return 'appointment';
      if (lowerName.includes('document') || lowerName.includes('file') || lowerName.includes('upload')) return 'document';
      if (lowerName.includes('billing') || lowerName.includes('payment') || lowerName.includes('invoice')) return 'billing';
      if (lowerName.includes('message') || lowerName.includes('sms') || lowerName.includes('email')) return 'communication';
      if (lowerName.includes('workflow') || lowerName.includes('process')) return 'workflow';
      if (lowerName.includes('report') || lowerName.includes('analytics')) return 'reporting';
      
      return 'administration'; // Default category
    }

    getSubcategory(functionName, category) {
      const lowerName = functionName.toLowerCase();
      
      switch (category) {
        case 'patient':
          if (lowerName.includes('add') || lowerName.includes('create')) return 'creation';
          if (lowerName.includes('update') || lowerName.includes('edit')) return 'modification';
          if (lowerName.includes('search') || lowerName.includes('find') || lowerName.includes('get')) return 'retrieval';
          if (lowerName.includes('delete') || lowerName.includes('remove')) return 'deletion';
          return 'management';
          
        case 'appointment':
          if (lowerName.includes('create') || lowerName.includes('book')) return 'booking';
          if (lowerName.includes('cancel') || lowerName.includes('reschedule')) return 'modification';
          if (lowerName.includes('list') || lowerName.includes('get')) return 'retrieval';
          return 'scheduling';
          
        case 'document':
          if (lowerName.includes('upload') || lowerName.includes('create')) return 'creation';
          if (lowerName.includes('download') || lowerName.includes('get')) return 'retrieval';
          if (lowerName.includes('delete')) return 'deletion';
          return 'management';
          
        default:
          return 'general';
      }
    }
}

// Export singleton instance to ensure shared cache across all services
module.exports = new AiHelpers();
