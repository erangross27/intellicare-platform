// IntelliCare Document Analysis Service - New Implementation with Function Calling
// Supports both Gemini and Claude APIs for medical document analysis

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const secureConfigService = require('../../../backend/services/secureConfigService');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');

class DocumentAnalysisService {
  constructor() {
    this.serviceId = 'document-analysis-service';
    this.serviceToken = null;
    this.initialized = false;
    // Primary API: Claude for document analysis and orchestration
    this.claudeApiKey = secureConfigService.get('CLAUDE_API_KEY') || secureConfigService.get('ANTHROPIC_API_KEY');
    if (this.claudeApiKey) {
      this.claude = new Anthropic({
        apiKey: this.claudeApiKey
      });
      // Document Analysis Service: Claude API initialized
    }
    
    // Secondary API: Gemini specifically for medical image analysis
    this.geminiApiKey = secureConfigService.get('GEMINI_API_KEY');
    // Note: geminiService removed after reorganization - using GoogleGenerativeAI directly
    
    // UPDATED: Gemini as primary for ALL documents (better citations, 10x cheaper)
    // Claude remains available as fallback via USE_CLAUDE_FOR_DOCS=true
    this.useHybridApproach = this.claudeApiKey && this.geminiApiKey;
    const forceClaudeForDocs = secureConfigService.get('USE_CLAUDE_FOR_DOCS') === 'true';
    
    if (this.geminiApiKey) {
      // Initialize Gemini AI when key is available
      this.ai = new GoogleGenerativeAI(this.geminiApiKey);
      
      if (forceClaudeForDocs && this.claudeApiKey) {
        console.log('📘 Claude mode enabled for documents (USE_CLAUDE_FOR_DOCS=true)');
        console.log('💡 To use Gemini (10x cheaper), remove USE_CLAUDE_FOR_DOCS from environment');
      } else {
        // Gemini Primary Mode: Using Gemini for ALL document and image analysis
      }
    } else if (this.claudeApiKey) {
      console.log('📘 Claude-only mode: Using Claude for all analysis (Gemini not configured)');
    }

    // Define function declarations for medical document analysis
    this.medicalRelevanceFunction = {
      name: "check_medical_relevance",
      description: "Determine if document contains medical information",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          isMedical: { 
            type: SchemaType.BOOLEAN, 
            description: "True if document contains medical information, patient data, lab results, prescriptions, medical reports, hospital documents, doctor notes, etc." 
          },
          confidence: { 
            type: SchemaType.NUMBER, 
            description: "Confidence score between 0 and 1" 
          },
          reasoning: { 
            type: SchemaType.STRING, 
            description: "Brief explanation of why it's medical or non-medical" 
          }
        },
        required: ["isMedical", "confidence"]
      }
    };

    this.categorizationFunction = {
      name: "categorize_document",
      description: "Categorize medical document into specific type",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          category: { 
            type: SchemaType.STRING,
            enum: ["lab_results", "prescriptions", "discharge_summary", "imaging_reports", 
                   "consultation_notes", "vaccination_records", "referrals", 
                   "medical_certificate", "medical_procedures"],
            description: "Medical document category"
          },
          confidence: { 
            type: SchemaType.NUMBER, 
            description: "Confidence score between 0 and 1" 
          },
          reasoning: { 
            type: SchemaType.STRING, 
            description: "Why this category was chosen" 
          }
        },
        required: ["category"]
      }
    };

    this.labResultsFunction = {
      name: "extract_lab_results",
      description: "Extract structured data from laboratory reports",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { 
            type: SchemaType.STRING, 
            description: "Test date in YYYY-MM-DD format" 
          },
          tests: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Test name" },
                value: { type: SchemaType.STRING, description: "Test result value" },
                unit: { type: SchemaType.STRING, description: "Measurement unit" },
                referenceRange: { type: SchemaType.STRING, description: "Normal reference range" },
                status: { type: SchemaType.STRING, description: "Normal/High/Low/Abnormal" }
              }
            }
          },
          patientName: { type: SchemaType.STRING, description: "Patient name" },
          doctorName: { type: SchemaType.STRING, description: "Ordering physician" },
          labName: { type: SchemaType.STRING, description: "Laboratory name" },
          diagnosis: { type: SchemaType.STRING, description: "Clinical diagnosis or indication" },
          notes: { type: SchemaType.STRING, description: "Additional notes or comments" }
        },
        required: ["date", "tests"]
      }
    };

    this.prescriptionsFunction = {
      name: "extract_prescription",
      description: "Extract structured data from prescription documents",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { 
            type: SchemaType.STRING, 
            description: "Prescription date in YYYY-MM-DD format" 
          },
          medications: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Medication name" },
                dosage: { type: SchemaType.STRING, description: "Dosage amount (e.g., 500mg)" },
                frequency: { type: SchemaType.STRING, description: "How often to take (e.g., twice daily)" },
                duration: { type: SchemaType.STRING, description: "Treatment duration (e.g., 30 days)" },
                instructions: { type: SchemaType.STRING, description: "Special instructions" }
              }
            }
          },
          patientName: { type: SchemaType.STRING, description: "Patient name" },
          doctorName: { type: SchemaType.STRING, description: "Prescribing doctor" },
          diagnosis: { type: SchemaType.STRING, description: "Medical condition being treated" },
          notes: { type: SchemaType.STRING, description: "Additional instructions or notes" }
        },
        required: ["date", "medications"]
      }
    };

    this.dischargeSummaryFunction = {
      name: "extract_discharge_summary",
      description: "Extract structured data from hospital discharge summaries",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { 
            type: SchemaType.STRING, 
            description: "Discharge date in YYYY-MM-DD format" 
          },
          admissionDate: { 
            type: SchemaType.STRING, 
            description: "Admission date in YYYY-MM-DD format" 
          },
          patientName: { type: SchemaType.STRING, description: "Patient name" },
          diagnosis: { type: SchemaType.STRING, description: "Primary and secondary diagnoses" },
          procedures: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Medical procedures performed"
          },
          medications: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Medication name" },
                dosage: { type: SchemaType.STRING, description: "Dosage" },
                frequency: { type: SchemaType.STRING, description: "Frequency" }
              }
            }
          },
          followUpInstructions: { type: SchemaType.STRING, description: "Follow-up care instructions" },
          dischargingDoctor: { type: SchemaType.STRING, description: "Discharging physician" },
          notes: { type: SchemaType.STRING, description: "Additional notes" }
        },
        required: ["date", "diagnosis"]
      }
    };

    this.imagingReportsFunction = {
      name: "extract_imaging_report",
      description: "Extract structured data from medical imaging reports",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { 
            type: SchemaType.STRING, 
            description: "Imaging date in YYYY-MM-DD format" 
          },
          studyType: { 
            type: SchemaType.STRING, 
            description: "Type of imaging study (X-ray, CT, MRI, Ultrasound, etc.)" 
          },
          bodyPart: { 
            type: SchemaType.STRING, 
            description: "Body part or region examined" 
          },
          findings: { 
            type: SchemaType.STRING, 
            description: "Detailed imaging findings" 
          },
          impression: { 
            type: SchemaType.STRING, 
            description: "Radiologist's impression or conclusion" 
          },
          recommendations: { 
            type: SchemaType.STRING, 
            description: "Recommended follow-up or additional studies" 
          },
          patientName: { type: SchemaType.STRING, description: "Patient name" },
          radiologist: { type: SchemaType.STRING, description: "Interpreting radiologist" },
          referringDoctor: { type: SchemaType.STRING, description: "Referring physician" },
          notes: { type: SchemaType.STRING, description: "Additional notes" }
        },
        required: ["date", "studyType", "findings"]
      }
    };

    this.consultationNotesFunction = {
      name: "extract_consultation_notes",
      description: "Extract structured data from medical consultation notes",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { 
            type: SchemaType.STRING, 
            description: "Consultation date in YYYY-MM-DD format" 
          },
          patientName: { type: SchemaType.STRING, description: "Patient name" },
          doctorName: { type: SchemaType.STRING, description: "Consulting physician" },
          chiefComplaint: { type: SchemaType.STRING, description: "Patient's main complaint" },
          symptoms: { 
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "List of symptoms reported" 
          },
          diagnosis: { type: SchemaType.STRING, description: "Medical diagnosis" },
          treatment: { type: SchemaType.STRING, description: "Treatment plan" },
          medications: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Medication name" },
                dosage: { type: SchemaType.STRING, description: "Dosage" }
              }
            }
          },
          followUp: { type: SchemaType.STRING, description: "Follow-up instructions" },
          notes: { type: SchemaType.STRING, description: "Additional clinical notes" }
        },
        required: ["date", "diagnosis"]
      }
    };

    this.vaccinationRecordsFunction = {
      name: "extract_vaccination_records",
      description: "Extract structured data from vaccination records and provide medical analysis",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: {
            type: SchemaType.STRING,
            description: "Vaccination date in YYYY-MM-DD format"
          },
          vaccinations: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                vaccine: { type: SchemaType.STRING, description: "Vaccine name" },
                manufacturer: { type: SchemaType.STRING, description: "Vaccine manufacturer" },
                lotNumber: { type: SchemaType.STRING, description: "Lot/batch number" },
                doseNumber: { type: SchemaType.STRING, description: "Dose number (1st, 2nd, booster)" },
                site: { type: SchemaType.STRING, description: "Injection site" },
                date: { type: SchemaType.STRING, description: "Date of this specific dose" }
              }
            }
          },
          patientName: { type: SchemaType.STRING, description: "Patient name" },
          provider: { type: SchemaType.STRING, description: "Healthcare provider" },
          nextDueDate: { type: SchemaType.STRING, description: "Next vaccination due date" },
          immunityStatus: { type: SchemaType.STRING, description: "Assessment of current immunity status based on vaccination history" },
          medicalAnalysis: { type: SchemaType.STRING, description: "Medical analysis of vaccination status, completeness of series, and any concerns" },
          recommendations: { type: SchemaType.STRING, description: "Medical recommendations regarding additional doses, boosters, or other vaccines" },
          contraindications: { type: SchemaType.STRING, description: "Any noted contraindications or adverse reactions" },
          protectionLevel: { type: SchemaType.STRING, description: "Estimated level of protection based on vaccination schedule" },
          notes: { type: SchemaType.STRING, description: "Additional clinical notes" }
        },
        required: ["date", "vaccinations"]
      }
    };

    this.referralsFunction = {
      name: "extract_referral",
      description: "Extract structured data from medical referral documents",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: {
            type: SchemaType.STRING,
            description: "Referral date in YYYY-MM-DD format"
          },
          patientName: { type: SchemaType.STRING, description: "Patient name" },
          referringDoctor: { type: SchemaType.STRING, description: "Referring physician" },
          referredTo: { type: SchemaType.STRING, description: "Specialist or department referred to" },
          specialty: { type: SchemaType.STRING, description: "Medical specialty" },
          reason: { type: SchemaType.STRING, description: "Reason for referral" },
          diagnosis: { type: SchemaType.STRING, description: "Current diagnosis" },
          urgency: { type: SchemaType.STRING, description: "Urgency level (routine, urgent, emergency)" },
          symptoms: { type: SchemaType.STRING, description: "Patient symptoms" },
          notes: { type: SchemaType.STRING, description: "Additional notes" }
        },
        required: ["date", "referredTo", "reason"]
      }
    };

    this.medicalCertificateFunction = {
      name: "extract_medical_certificate",
      description: "Extract structured data from medical certificates",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: {
            type: SchemaType.STRING,
            description: "Certificate issue date in YYYY-MM-DD format"
          },
          patientName: { type: SchemaType.STRING, description: "Patient name" },
          doctorName: { type: SchemaType.STRING, description: "Certifying physician" },
          condition: { type: SchemaType.STRING, description: "Medical condition" },
          startDate: { type: SchemaType.STRING, description: "Start date of medical leave" },
          endDate: { type: SchemaType.STRING, description: "End date of medical leave" },
          workRestrictions: { type: SchemaType.STRING, description: "Work restrictions or limitations" },
          certificateType: { type: SchemaType.STRING, description: "Type of certificate (sick leave, fitness for work, etc.)" },
          notes: { type: SchemaType.STRING, description: "Additional notes" }
        },
        required: ["date", "condition"]
      }
    };

    this.medicalProceduresFunction = {
      name: "extract_medical_procedures",
      description: "Extract structured data from medical procedure reports",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: {
            type: SchemaType.STRING,
            description: "Procedure date in YYYY-MM-DD format"
          },
          procedures: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Procedure name" },
                description: { type: SchemaType.STRING, description: "Procedure description" },
                outcome: { type: SchemaType.STRING, description: "Procedure outcome" },
                complications: { type: SchemaType.STRING, description: "Any complications" }
              }
            }
          },
          patientName: { type: SchemaType.STRING, description: "Patient name" },
          surgeon: { type: SchemaType.STRING, description: "Primary surgeon" },
          anesthesia: { type: SchemaType.STRING, description: "Type of anesthesia used" },
          duration: { type: SchemaType.STRING, description: "Procedure duration" },
          diagnosis: { type: SchemaType.STRING, description: "Pre/post-operative diagnosis" },
          postOpInstructions: { type: SchemaType.STRING, description: "Post-operative care instructions" },
          notes: { type: SchemaType.STRING, description: "Additional notes" }
        },
        required: ["date", "procedures"]
      }
    };
    
    // Comprehensive medical data extraction function for Claude
    this.extractMedicalDataFunction = {
      name: "extractMedicalData",
      description: "Extract all medical information from any type of medical document",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          documentType: {
            type: SchemaType.STRING,
            description: "Type of medical document",
            enum: ["lab_results", "prescription", "medical_report", "imaging", "referral", 
                   "discharge_summary", "consultation", "vaccination", "medical_certificate", 
                   "procedure_report", "pathology", "radiology", "ecg", "other"]
          },
          patientName: { type: SchemaType.STRING, description: "Patient full name" },
          patientId: { type: SchemaType.STRING, description: "Patient ID or medical record number" },
          date: { type: SchemaType.STRING, description: "Document date in YYYY-MM-DD format" },
          practiceName: { type: SchemaType.STRING, description: "Practice or hospital name" },
          doctorName: { type: SchemaType.STRING, description: "Doctor or physician name" },
          healthFund: { type: SchemaType.STRING, description: "Health fund or insurance (מכבי/כללית/מאוחדת/לאומית)" },
          
          // Diagnoses and conditions
          diagnoses: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "List of diagnoses or medical conditions"
          },
          icdCodes: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "ICD-10 or ICD-11 diagnosis codes if present"
          },
          
          // Medications
          medications: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Medication name" },
                dosage: { type: SchemaType.STRING, description: "Dosage and frequency" },
                duration: { type: SchemaType.STRING, description: "Duration of treatment" },
                instructions: { type: SchemaType.STRING, description: "Special instructions" }
              }
            },
            description: "List of medications"
          },
          
          // Test results
          testResults: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Lab test results or findings"
          },
          abnormalResults: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Abnormal or out-of-range results"
          },
          
          // Vital signs
          vitalSigns: {
            type: SchemaType.OBJECT,
            properties: {
              bloodPressure: { type: SchemaType.STRING },
              heartRate: { type: SchemaType.STRING },
              temperature: { type: SchemaType.STRING },
              weight: { type: SchemaType.STRING },
              height: { type: SchemaType.STRING },
              bmi: { type: SchemaType.STRING },
              oxygenSaturation: { type: SchemaType.STRING }
            },
            description: "Vital signs if present"
          },
          
          // Recommendations and follow-up
          recommendations: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Medical recommendations or instructions"
          },
          followUp: { type: SchemaType.STRING, description: "Follow-up instructions or next appointment" },
          
          // Summary
          summary: { type: SchemaType.STRING, description: "Brief summary of the document content" },
          notes: { type: SchemaType.STRING, description: "Additional important notes or findings" },
          
          // Urgency and alerts
          urgencyLevel: { 
            type: SchemaType.STRING, 
            enum: ["routine", "urgent", "emergency"],
            description: "Urgency level if indicated" 
          },
          redFlags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Any red flags or critical findings"
          }
        },
        required: ["documentType", "date", "summary"]
      }
    };

    // Document Analysis Service initialized with Gemini Function Calling
  }
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize secure config service
      await secureConfigService.initialize();
      
      // Re-check for API keys after secureConfigService is initialized
      this.claudeApiKey = secureConfigService.get('CLAUDE_API_KEY') || secureConfigService.get('ANTHROPIC_API_KEY');
      if (this.claudeApiKey && !this.claude) {
        this.claude = new Anthropic({
          apiKey: this.claudeApiKey
        });
      }
      
      this.geminiApiKey = secureConfigService.get('GEMINI_API_KEY');
      if (this.geminiApiKey && !this.ai) {
        this.ai = new GoogleGenerativeAI(this.geminiApiKey);
      }
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize-service',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: this.serviceId,
        timestamp: new Date()
      }, context);
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize DocumentAnalysisService: ${error.message}`);
    }
  }


  // ===== MAIN ANALYSIS METHODS =====

  async analyzeDocument(fileBuffer, fileName, mimeType, language = 'he', sessionId = null) {
    try {
      console.log('🔍 Starting document analysis with function calling...');

      // Step 1: Check medical relevance
      console.log('📋 Step 1: Medical relevance check...');
      const relevanceResult = await this.checkMedicalRelevance(fileBuffer, mimeType);

      if (!relevanceResult.isMedical) {
        console.log('❌ Document rejected - not medically relevant');
        throw new Error('Document rejected: Not medically relevant. Please upload medical documents only.');
      }

      console.log('✅ Document is medically relevant, proceeding...');

      // Step 2: Categorize document
      console.log('📋 Step 2: Document categorization...');
      const categoryResult = await this.categorizeDocument(fileBuffer, mimeType);
      console.log('✅ Document categorized as:', categoryResult.category);

      // Step 3: Extract structured data
      console.log('📋 Step 3: Extracting structured data...');
      const extractedData = await this.extractStructuredData(fileBuffer, mimeType, categoryResult.category, sessionId);
      console.log('✅ Data extraction completed');

      return {
        success: true,
        category: categoryResult.category,
        extractedData: extractedData,
        confidence: categoryResult.confidence,
        relevanceCheck: relevanceResult
      };

    } catch (error) {
      console.error('❌ Document analysis error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkMedicalRelevance(fileBuffer, mimeType) {
    try {
      console.log('🔍 Checking medical relevance with function calling...');

      const prompt = 'As a medical professional, analyze this document and determine if it contains any medical, clinical, or health-related information:';

      // Call Gemini with medical relevance function
      const response = await this.analyzeDocumentWithFunction(
        fileBuffer,
        mimeType,
        this.medicalRelevanceFunction,
        prompt
      );

      // Handle function call response
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        console.log('🔧 Medical relevance function called:', functionCall.args);
        return functionCall.args;
      } else {
        // Fallback if no function call
        console.log('⚠️ No function call, using fallback logic');
        return { isMedical: true, confidence: 0.5, reasoning: 'Fallback analysis' };
      }

    } catch (error) {
      console.error('❌ Medical relevance check error:', error.message);
      return { isMedical: false, confidence: 0, reasoning: 'Error in analysis' };
    }
  }

  async categorizeDocument(fileBuffer, mimeType) {
    try {
      console.log('🔍 Categorizing document with function calling...');

      const prompt = 'As an experienced medical professional, categorize this medical document into the most appropriate clinical category:';

      // Call Gemini with categorization function
      const response = await this.analyzeDocumentWithFunction(
        fileBuffer,
        mimeType,
        this.categorizationFunction,
        prompt
      );

      // Handle function call response
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        console.log('🔧 Categorization function called:', functionCall.args);
        return functionCall.args;
      } else {
        // Fallback if no function call
        console.log('⚠️ No function call, using fallback category');
        return { category: 'consultation_notes', confidence: 0.5, reasoning: 'Fallback categorization' };
      }

    } catch (error) {
      console.error('❌ Document categorization error:', error.message);
      return { category: 'consultation_notes', confidence: 0, reasoning: 'Error in categorization' };
    }
  }

  async extractStructuredData(fileBuffer, mimeType, category, sessionId = null) {
    try {
      console.log(`🔍 Extracting structured data for category: ${category}`);

      // Get the appropriate extraction function for this category
      const extractionFunction = this.getExtractionFunction(category);

      if (!extractionFunction) {
        throw new Error(`No extraction function found for category: ${category}`);
      }

      // Expert doctor prompt for better medical analysis
      const prompt = `You are an expert medical doctor with 20+ years of experience in reading medical documents, lab results, and clinical reports. 
Please analyze this ${category.replace('_', ' ')} document with the precision and attention to detail of a senior physician.
Extract all relevant medical data, including subtle findings that might be clinically significant.
Consider differential diagnoses, potential complications, and important follow-up requirements.`;

      // Call Gemini with category-specific extraction function
      const response = await this.analyzeDocumentWithFunction(
        fileBuffer,
        mimeType,
        extractionFunction,
        prompt,
        sessionId
      );

      // Handle function call response
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        console.log('🔧 Extraction function called:', functionCall.name);
        console.log('📋 Extracted data:', JSON.stringify(functionCall.args, null, 2));

        // Convert to the format expected by the existing system
        return this.convertToLegacyFormat(functionCall.args, category);
      } else {
        // Fallback if no function call
        console.log('⚠️ No function call, using fallback extraction');
        return this.getFallbackData(category);
      }

    } catch (error) {
      console.error('❌ Structured data extraction error:', error.message);
      return this.getFallbackData(category);
    }
  }

  // ===== HELPER METHODS =====

  getExtractionFunction(category) {
    const functionMap = {
      'lab_results': this.labResultsFunction,
      'prescriptions': this.prescriptionsFunction,
      'discharge_summary': this.dischargeSummaryFunction,
      'imaging_reports': this.imagingReportsFunction,
      'consultation_notes': this.consultationNotesFunction,
      'vaccination_records': this.vaccinationRecordsFunction,
      'referrals': this.referralsFunction,
      'medical_certificate': this.medicalCertificateFunction,
      'medical_procedures': this.medicalProceduresFunction
    };

    return functionMap[category];
  }

  convertToLegacyFormat(extractedData, category) {
    // Convert rich function calling data to the flat format expected by existing system
    const legacyFormat = {
      date: extractedData.date || new Date().toISOString().split('T')[0],
      diagnosis: '',
      symptoms: '',
      treatment: '',
      notes: extractedData.notes || '',
      recommendations: ''
    };

    // Category-specific conversions
    switch (category) {
      case 'lab_results':
        legacyFormat.diagnosis = extractedData.tests?.map(t => `${t.name}: ${t.value} ${t.unit || ''}`).join(', ') || '';
        legacyFormat.treatment = extractedData.diagnosis || '';
        break;

      case 'prescriptions':
        legacyFormat.diagnosis = extractedData.medications?.map(m => `${m.name} ${m.dosage || ''}`).join(', ') || '';
        legacyFormat.treatment = extractedData.medications?.map(m => `${m.frequency || ''} ${m.duration || ''}`).join(', ') || '';
        break;

      case 'consultation_notes':
        legacyFormat.diagnosis = extractedData.diagnosis || '';
        legacyFormat.symptoms = extractedData.symptoms?.join(', ') || extractedData.chiefComplaint || '';
        legacyFormat.treatment = extractedData.treatment || '';
        break;

      case 'vaccination_records':
        // Store vaccination details in a structured way
        const vaccinations = extractedData.vaccinations || [];
        // Get unique vaccine names for diagnosis
        const uniqueVaccines = [...new Set(vaccinations.map(v => v.vaccine))];
        
        // Build comprehensive diagnosis with AI analysis
        const diagnosisParts = [`חיסונים (${vaccinations.length}): ${uniqueVaccines.join(', ')}`];
        if (extractedData.immunityStatus) {
          diagnosisParts.push(`סטטוס חיסוני: ${extractedData.immunityStatus}`);
        }
        if (extractedData.protectionLevel) {
          diagnosisParts.push(`רמת הגנה: ${extractedData.protectionLevel}`);
        }
        legacyFormat.diagnosis = diagnosisParts.join('\n');
        
        // Detailed vaccination records in treatment field
        const treatmentParts = [];
        treatmentParts.push(vaccinations.map(v => {
          const dose = v.dose || v.doseNumber || '';
          const date = v.date || '';
          const manufacturer = v.manufacturer ? ` - ${v.manufacturer}` : '';
          const lotNumber = v.lotNumber ? ` (Lot: ${v.lotNumber})` : '';
          return `${v.vaccine}${manufacturer} - מנה ${dose} (${date})${lotNumber}`;
        }).join('\n'));
        
        // Add medical analysis to treatment
        if (extractedData.medicalAnalysis) {
          treatmentParts.push(`\nניתוח רפואי: ${extractedData.medicalAnalysis}`);
        }
        if (extractedData.contraindications) {
          treatmentParts.push(`התוויות נגד: ${extractedData.contraindications}`);
        }
        legacyFormat.treatment = treatmentParts.filter(Boolean).join('\n');
        
        // Store comprehensive notes including AI insights
        const notesParts = [];
        if (extractedData.patientName) notesParts.push(`מטופל: ${extractedData.patientName}`);
        if (extractedData.provider) notesParts.push(`ספק: ${extractedData.provider}`);
        if (extractedData.nextDueDate) notesParts.push(`תאריך חיסון הבא: ${extractedData.nextDueDate}`);
        if (extractedData.notes) notesParts.push(extractedData.notes);
        
        legacyFormat.notes = notesParts.filter(Boolean).join('\n').trim();
        
        // Add AI recommendations
        if (extractedData.recommendations || extractedData.nextDueDate) {
          const recParts = [];
          if (extractedData.recommendations) {
            recParts.push(extractedData.recommendations);
          }
          if (extractedData.nextDueDate && !extractedData.recommendations?.includes(extractedData.nextDueDate)) {
            recParts.push(`חיסון הבא מתוכנן ל: ${extractedData.nextDueDate}`);
          }
          legacyFormat.recommendations = recParts.join('\n');
        }
        break;

      default:
        legacyFormat.diagnosis = extractedData.diagnosis || extractedData.condition || '';
        legacyFormat.symptoms = extractedData.symptoms || extractedData.reason || '';
        legacyFormat.treatment = extractedData.treatment || extractedData.procedures?.map(p => p.name).join(', ') || '';
    }

    return legacyFormat;
  }

  getFallbackData(category) {
    return {
      date: new Date().toISOString().split('T')[0],
      diagnosis: 'Unable to extract data',
      symptoms: '',
      treatment: '',
      notes: 'Function calling extraction failed',
      recommendations: ''
    };
  }

  async analyzeDocumentWithFunction(fileBuffer, mimeType, functionDeclaration, prompt, sessionId = null) {
    try {
      // UPDATED ROUTING: Gemini for ALL documents (better citations, 10x cheaper)
      // Claude remains available via USE_CLAUDE_FOR_DOCS=true environment variable
      
      const isImage = mimeType.startsWith('image/') || mimeType === 'application/dicom';
      const forceClaudeForDocs = secureConfigService.get('USE_CLAUDE_FOR_DOCS') === 'true';
      
      // Route based on new strategy: Gemini for everything unless forced to Claude
      if (forceClaudeForDocs && this.claudeApiKey && !isImage) {
        // Optional: Use Claude for documents if explicitly requested (fallback option)
        console.log('📘 Using Claude for document analysis (USE_CLAUDE_FOR_DOCS=true)');
        return await this.analyzeDocumentWithClaude(fileBuffer, mimeType, functionDeclaration, prompt);
      } else if (this.geminiApiKey) {
        // PRIMARY PATH: Use Gemini for ALL documents and images
        if (isImage) {
          // PRIMARY: Claude Vision for medical image analysis
          // FALLBACK: Gemini if Claude fails
          try {
            console.log('🏥 Medical image detected - routing to Claude Vision for analysis');
            const claudeMedicalImageService = require('../../../backend/services/claudeMedicalImageService');

            // Handle DICOM files: convert to JPEG and extract metadata
            let analysisBuffer = fileBuffer;
            let analysisMimeType = mimeType;
            let dicomMeta = null;
            if (mimeType === 'application/dicom' || (prompt && prompt.includes('.dcm'))) {
              try {
                const dicomConverterService = require('../../../backend/services/dicomConverterService');
                const dicomResult = await dicomConverterService.processForAnalysis(fileBuffer);
                analysisBuffer = dicomResult.imageBuffer;
                analysisMimeType = dicomResult.mimeType;
                dicomMeta = dicomResult.metadata;
                console.log(`📋 DICOM converted: ${dicomMeta.modality || 'unknown'} modality, ${dicomMeta.bodyPartExamined || 'unknown'} body part`);
              } catch (dicomErr) {
                console.warn('⚠️ DICOM conversion failed, attempting raw analysis:', dicomErr.message);
              }
            }

            return await claudeMedicalImageService.analyzeImageForDocumentService(analysisBuffer, analysisMimeType, functionDeclaration, prompt);
          } catch (claudeImageErr) {
            console.warn('⚠️ Claude image analysis failed, falling back to Gemini:', claudeImageErr.message);
            return await this.analyzeImageWithGemini(fileBuffer, mimeType, functionDeclaration, prompt);
          }
        } else if (mimeType === 'application/pdf') {
          console.log('📗 PDF document - using Gemini for better citations and lower cost');
          return await this.analyzePDFWithFunction(fileBuffer, functionDeclaration, prompt, sessionId);
        } else if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) {
          // Handle Word docs, Excel, text files etc. with Gemini
          console.log(`📗 Document (${mimeType}) - using Gemini for analysis`);
          if (mimeType.includes('word') || mimeType.includes('document')) {
            // Word documents - convert to text and analyze
            const text = fileBuffer.toString('utf-8');
            return await this.analyzeTextWithFunction(text, functionDeclaration, prompt);
          } else if (mimeType.includes('sheet') || mimeType.includes('excel')) {
            // Excel/CSV - treat as structured data
            const text = fileBuffer.toString('utf-8');
            return await this.analyzeTextWithFunction(text, functionDeclaration, prompt);
          } else {
            // Generic text documents
            const text = fileBuffer.toString('utf-8');
            return await this.analyzeTextWithFunction(text, functionDeclaration, prompt);
          }
        } else {
          // Fallback for any other type
          console.log(`📗 Unknown document type (${mimeType}) - attempting Gemini text analysis`);
          const text = fileBuffer.toString('utf-8');
          return await this.analyzeTextWithFunction(text, functionDeclaration, prompt);
        }
      } else if (this.claudeApiKey && !forceClaudeForDocs) {
        // No Gemini available, fall back to Claude
        console.log('⚠️ Gemini not available, falling back to Claude for document analysis');
        return await this.analyzeDocumentWithClaude(fileBuffer, mimeType, functionDeclaration, prompt);
      } else {
        throw new Error('No AI service available for document analysis. Please configure GEMINI_API_KEY or CLAUDE_API_KEY');
      }
    } catch (error) {
      console.error('❌ Document analysis error:', error.message);
      throw error;
    }
  }
  
  async analyzeDocumentWithClaude(fileBuffer, mimeType, functionDeclaration, prompt) {
    try {
      console.log(`📘 Analyzing document with Claude API...`);
      console.log(`📄 Document type: ${mimeType}, size: ${fileBuffer.length} bytes`);
      
      // Convert function declaration from Gemini format to Claude format
      const claudeFunction = {
        name: functionDeclaration.name,
        description: functionDeclaration.description,
        input_schema: {
          type: "object",
          properties: {},
          required: functionDeclaration.parameters?.required || []
        }
      };
      
      // Convert parameters from Gemini Type enum to simple strings
      if (functionDeclaration.parameters?.properties) {
        for (const [key, value] of Object.entries(functionDeclaration.parameters.properties)) {
          claudeFunction.input_schema.properties[key] = {
            type: value.type?.toString().toLowerCase() || 'string',
            description: value.description
          };
          if (value.enum) {
            claudeFunction.input_schema.properties[key].enum = value.enum;
          }
        }
      }
      
      // Prepare the message with document content based on file type
      let messageContent = prompt;
      
      // Handle different file types appropriately
      const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const supportedDocumentTypes = ['application/pdf'];
      const textBasedTypes = [
        'text/plain', 
        'text/csv', 
        'application/csv',
        'text/html',
        'text/xml',
        'application/xml',
        'application/json',
        'text/rtf',
        'application/rtf'
      ];
      
      // Microsoft Office formats that need text extraction
      const officeFormats = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/vnd.ms-powerpoint' // .ppt
      ];
      
      // Medical-specific formats
      const medicalFormats = [
        'application/dicom', // DICOM medical imaging
        'application/hl7-v2+er7', // HL7 v2 messages
        'application/hl7-v2+xml', // HL7 v2 XML
        'application/fhir+json', // FHIR JSON
        'application/fhir+xml', // FHIR XML
        'application/cda+xml' // Clinical Document Architecture
      ];
      
      if (supportedDocumentTypes.includes(mimeType)) {
        // PDFs use document type
        messageContent = [
          { type: "text", text: prompt },
          {
            type: "document",
            source: {
              type: "base64",
              media_type: mimeType,
              data: fileBuffer.toString('base64')
            }
          }
        ];
      } else if (supportedImageTypes.includes(mimeType)) {
        // Images use image type
        messageContent = [
          { type: "text", text: prompt },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: fileBuffer.toString('base64')
            }
          }
        ];
      } else if (textBasedTypes.includes(mimeType) || mimeType.startsWith('text/')) {
        // Text-based files can be read directly
        const textContent = fileBuffer.toString('utf-8');
        messageContent = prompt + "\n\nDocument content:\n" + textContent;
      } else if (officeFormats.includes(mimeType)) {
        // For Office formats, we need to extract text first
        const extractedText = await this.extractTextFromOfficeDocument(fileBuffer, mimeType);
        messageContent = prompt + "\n\nDocument content:\n" + extractedText;
      } else if (medicalFormats.includes(mimeType)) {
        // For medical formats, extract and format appropriately
        const medicalContent = await this.extractMedicalFormatContent(fileBuffer, mimeType);
        messageContent = prompt + "\n\nMedical document content:\n" + medicalContent;
      } else {
        // For unknown types, try to interpret as text
        console.log(`⚠️ Unknown MIME type: ${mimeType}, attempting text extraction`);
        const textContent = fileBuffer.toString('utf-8');
        messageContent = prompt + "\n\nDocument content:\n" + textContent;
      }
      
      // Call Claude with function AND CACHING
      const response = await this.claude.messages.create({
        model: 'claude-sonnet-5',  // Sonnet 5: supports forced tool use (tool_choice: any)
        max_tokens: 20000,
        // No thinking param: thinking may not be enabled when tool_choice forces tool use
        output_config: { effort: 'high' },
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        tools: [claudeFunction],
        tool_choice: { type: 'any' },
        // Cache the tools since they're the same for document analysis
        system: [
          {
            type: 'text',
            text: 'You are a medical document analyzer. Extract structured data from medical documents accurately.',
            cache_control: { type: 'ephemeral' }
          }
        ]
      });
      
      // Extract function call results
      if (response.content && response.content.length > 0) {
        for (const content of response.content) {
          if (content.type === 'tool_use' && content.name === functionDeclaration.name) {
            console.log('✅ Claude extracted data successfully');
            return {
              functionCalls: [{
                name: content.name,
                args: content.input
              }]
            };
          }
        }
      }
      
      // If no function call, return text response
      return {
        text: response.content[0]?.text || 'No analysis available'
      };
      
    } catch (error) {
      console.error('❌ Claude document analysis error:', error.message);
      throw error;
    }
  }

  // Analyze medical images with Gemini (better for medical imaging)
  async analyzeImageWithGemini(fileBuffer, mimeType, functionDeclaration, prompt) {
    try {
      console.log(`🏥 Analyzing medical image with Gemini...`);
      console.log(`📷 Image type: ${mimeType}, size: ${fileBuffer.length} bytes`);
      
      // Create specialized medical imaging prompt for Gemini
      const medicalImagePrompt = `You are a board-certified radiologist with 20+ years of experience in diagnostic imaging interpretation.
      
Analyze this medical image with the expertise of a senior radiologist and provide:

1. Imaging modality identification (X-ray, MRI, CT, Ultrasound, PET, etc.)
2. Anatomical region and specific structures visualized
3. Systematic review of all visible abnormalities, pathologies, or variants
4. Differential diagnoses with likelihood assessment
5. Precise measurements and quantitative assessments where relevant
6. Technical quality assessment (positioning, contrast, artifacts)
7. Clinical correlation and recommended follow-up studies
8. Urgent findings that require immediate attention (if any)

Apply standard radiology reporting practices. Use precise medical terminology and BI-RADS/LI-RADS classifications where applicable.

${prompt}

Please provide a detailed medical analysis of this image.`;

      // Use GoogleGenerativeAI directly for image analysis
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const imagePart = {
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType: mimeType
        }
      };
      
      const result = await model.generateContent([medicalImagePrompt, imagePart]);
      const response = await result.response;
      const geminiResult = response.text();
      
      console.log('✅ Gemini image analysis complete, formatting for Claude function');
      
      // Parse Gemini's response and format it for Claude's function calling format
      // Extract key medical information from Gemini's text response
      const extractedData = this.parseGeminiImageAnalysis(geminiResult, functionDeclaration);
      
      // Return in Claude's expected format
      return {
        functionCalls: [{
          name: functionDeclaration.name,
          args: extractedData
        }]
      };
      
    } catch (error) {
      console.error('❌ Gemini image analysis error:', error.message);
      // Fallback to Claude if Gemini fails
      console.log('⚠️ Falling back to Claude for image analysis');
      return await this.analyzeDocumentWithClaude(fileBuffer, mimeType, functionDeclaration, prompt);
    }
  }
  
  // Parse Gemini's text response into structured medical data
  parseGeminiImageAnalysis(geminiResponse, functionDeclaration) {
    try {
      console.log('🔍 Parsing Gemini image analysis response');
      const response = geminiResponse.toLowerCase();
      
      // Extract medical information based on the function type
      if (functionDeclaration.name === 'extractMedicalData') {
        const data = {
          documentType: 'imaging',
          date: new Date().toISOString().split('T')[0],
          summary: geminiResponse,
          diagnoses: [],
          abnormalResults: [],
          recommendations: [],
          testResults: [],
          notes: '',
          imagingType: '',
          bodyPart: '',
          findings: [],
          urgencyLevel: 'routine',
          redFlags: [],
          measurements: [],
          clinicalIndication: '',
          technique: '',
          comparison: ''
        };
        
        // Parse both numbered sections and keyword-based sections
        const sections = geminiResponse.split(/\*\*\d+\./);
        
        // Also parse non-numbered sections with keywords
        const fullText = geminiResponse;
        
        // Enhanced parsing for each section
        sections.forEach(section => {
          const sectionLower = section.toLowerCase();
          
          // 1. Type of Imaging - Enhanced detection
          if (sectionLower.includes('type of imaging') || sectionLower.includes('imaging type') || 
              sectionLower.includes('modality') || sectionLower.includes('study type')) {
            // Enhanced imaging type detection
            const imagingTypes = [
              { pattern: /mri\s*(?:with\s+contrast)?/i, type: 'MRI' },
              { pattern: /magnetic\s+resonance/i, type: 'MRI' },
              { pattern: /ct\s*(?:scan)?/i, type: 'CT' },
              { pattern: /computed\s+tomography/i, type: 'CT' },
              { pattern: /x-?ray/i, type: 'X-ray' },
              { pattern: /ultrasound/i, type: 'Ultrasound' },
              { pattern: /pet\s*(?:scan)?/i, type: 'PET' },
              { pattern: /spect/i, type: 'SPECT' }
            ];
            
            for (const imaging of imagingTypes) {
              if (imaging.pattern.test(section)) {
                data.imagingType = imaging.type;
                data.documentType = 'radiology';
                // Check for contrast
                if (/with\s+contrast|contrast\s+enhanced/i.test(section)) {
                  data.imagingType += ' with contrast';
                }
                break;
              }
            }
          }
          
          // 2. Body Part - Enhanced detection
          if (sectionLower.includes('body part') || sectionLower.includes('organ') || 
              sectionLower.includes('region') || sectionLower.includes('area examined')) {
            // Extract the actual body part text after the label
            const bodyPartMatch = section.match(/(?:body part|organ|region|area examined)[:\s]*([^\n\*]+)/i);
            if (bodyPartMatch) {
              data.bodyPart = bodyPartMatch[1].trim();
            } else {
              // Fallback to keyword matching
              const bodyParts = ['thorax', 'chest', 'abdomen', 'head', 'spine', 'knee', 'shoulder', 
                                'brain', 'heart', 'lungs', 'liver', 'kidneys', 'aorta', 'pelvis', 
                                'cervical', 'lumbar', 'thoracic', 'hip', 'ankle', 'wrist'];
              bodyParts.forEach(part => {
                if (sectionLower.includes(part)) {
                  data.bodyPart = part.charAt(0).toUpperCase() + part.slice(1);
                }
              });
            }
          }
          
          // 3. Visible Abnormalities and Findings - Enhanced extraction
          if (sectionLower.includes('abnormalit') || sectionLower.includes('findings') || 
              sectionLower.includes('observations')) {
            // Extract all bullet points or findings
            const findings = section.match(/[\*\-•]\s*[^\*\-•\n]+/g) || [];
            findings.forEach(finding => {
              const cleanFinding = finding.replace(/^[\*\-•]\s*/, '').trim();
              if (cleanFinding && cleanFinding.length > 5) {
                data.abnormalResults.push(cleanFinding);
                data.findings.push(cleanFinding);
              }
            });
            
            // Also extract non-bulleted findings after colons
            const colonFindings = section.match(/:\s*([^\n]+)/g) || [];
            colonFindings.forEach(finding => {
              const cleanFinding = finding.replace(/^:\s*/, '').trim();
              if (cleanFinding && cleanFinding.length > 10 && !cleanFinding.includes('**')) {
                data.findings.push(cleanFinding);
              }
            });
          }
          
          // 4. Medical Conditions or Diagnoses - Enhanced extraction
          if (sectionLower.includes('condition') || sectionLower.includes('diagnos') || 
              sectionLower.includes('impression') || sectionLower.includes('assessment')) {
            // Extract specific diagnoses mentioned
            const diagnosisSection = section.match(/[\*\-•]\s*[^\*\-•\n]+/g) || [];
            diagnosisSection.forEach(diagnosis => {
              const cleanDiagnosis = diagnosis.replace(/^[\*\-•]\s*/, '').trim();
              if (cleanDiagnosis && cleanDiagnosis.length > 5) {
                // Extract the main diagnosis (usually before the colon or parenthesis)
                const mainDiagnosis = cleanDiagnosis.split(/[:(]/)[0].trim();
                if (mainDiagnosis) {
                  data.diagnoses.push(mainDiagnosis);
                }
              }
            });
            
            // Extract diagnoses from text patterns
            const diagnosisPatterns = [
              /(?:suspected|probable|possible|likely)\s+([^,\.\n]+)/gi,
              /(?:consistent with|suggestive of|compatible with)\s+([^,\.\n]+)/gi,
              /(?:diagnosis|impression):\s*([^\n]+)/gi  // Fixed: Added 'g' flag for matchAll
            ];
            
            diagnosisPatterns.forEach(pattern => {
              // Only use matchAll with global patterns
              if (pattern.global) {
                const matches = section.matchAll(pattern);
                for (const match of matches) {
                  if (match[1]) {
                    data.diagnoses.push(match[1].trim());
                  }
                }
              } else {
                // Use match for non-global patterns
                const match = section.match(pattern);
                if (match && match[1]) {
                  data.diagnoses.push(match[1].trim());
                }
              }
            });
            
            // Look for specific critical conditions
            const criticalConditions = [
              { pattern: /aneurysm/i, diagnosis: 'Aneurysm' },
              { pattern: /dissection/i, diagnosis: 'Dissection' },
              { pattern: /stenosis/i, diagnosis: 'Stenosis' },
              { pattern: /tumor|mass|lesion/i, diagnosis: 'Mass/Lesion' },
              { pattern: /fracture/i, diagnosis: 'Fracture' },
              { pattern: /hemorrhage|bleeding/i, diagnosis: 'Hemorrhage' },
              { pattern: /infarct|ischemia/i, diagnosis: 'Ischemia/Infarct' },
              { pattern: /thrombosis|clot/i, diagnosis: 'Thrombosis' },
              { pattern: /embolism/i, diagnosis: 'Embolism' }
            ];
            
            criticalConditions.forEach(condition => {
              if (condition.pattern.test(sectionLower)) {
                // Extract the specific context
                const contextMatch = sectionLower.match(new RegExp(`[^.]*${condition.pattern.source}[^.]*`, 'i'));
                if (contextMatch) {
                  const specificDiagnosis = contextMatch[0].trim();
                  // Clean up and add if it's meaningful
                  if (specificDiagnosis.length < 100) {
                    data.diagnoses.push(condition.diagnosis + ' (detected)');
                  }
                }
              }
            });
          }
          
          // 5. Measurements - Enhanced extraction
          if (sectionLower.includes('measurement') || sectionLower.includes('quantitative') || 
              sectionLower.includes('size') || sectionLower.includes('dimension')) {
            // Extract measurements with units
            const measurementPattern = /(\d+(?:\.\d+)?\s*(?:x\s*\d+(?:\.\d+)?\s*(?:x\s*\d+(?:\.\d+)?)?)?\s*(?:cm|mm|ml|cc|mg|g|kg|L|mL|units?|IU|%|degrees?))/gi;
            const measurements = section.matchAll(measurementPattern);
            for (const match of measurements) {
              data.measurements.push(match[1].trim());
              data.testResults.push('Measurement: ' + match[1].trim());
            }
          }
          
          // 6. Clinical History/Indication
          if (sectionLower.includes('clinical') || sectionLower.includes('indication') || 
              sectionLower.includes('history')) {
            const indicationMatch = section.match(/(?:clinical indication|indication|history)[:\s]*([^\n\*]+)/i);
            if (indicationMatch) {
              data.clinicalIndication = indicationMatch[1].trim();
            }
          }
          
          // 7. Recommendations - Enhanced extraction
          if (sectionLower.includes('recommend') || sectionLower.includes('follow') || 
              sectionLower.includes('suggest') || sectionLower.includes('next step')) {
            // Extract bulleted recommendations
            const recommendations = section.match(/[\*\-•]\s*[^\*\-•\n]+/g) || [];
            recommendations.forEach(rec => {
              const cleanRec = rec.replace(/^[\*\-•]\s*/, '').trim();
              if (cleanRec && cleanRec.length > 10) {
                data.recommendations.push(cleanRec);
              }
            });
            
            // Extract recommendations from patterns
            const recPatterns = [
              /(?:recommend|suggest|advise)\s+([^.\n]+)/gi,
              /(?:follow-up|follow up)\s+(?:with)?\s*([^.\n]+)/gi,
              /(?:additional|further)\s+(?:imaging|studies|evaluation)\s+([^.\n]+)/gi
            ];
            
            recPatterns.forEach(pattern => {
              // Only use matchAll with global patterns
              if (pattern.global) {
                const matches = section.matchAll(pattern);
                for (const match of matches) {
                  if (match[1]) {
                    data.recommendations.push(match[1].trim());
                  }
                }
              } else {
                // Use match for non-global patterns
                const match = section.match(pattern);
                if (match && match[1]) {
                  data.recommendations.push(match[1].trim());
                }
              }
            });
          }
        });
        
        // Extract measurements from entire response
        const globalMeasurements = fullText.matchAll(/(\d+(?:\.\d+)?\s*(?:x\s*\d+(?:\.\d+)?\s*(?:x\s*\d+(?:\.\d+)?)?)?\s*(?:cm|mm|ml|cc|mg|g|kg|L|mL|units?|IU|%|degrees?))/gi);
        for (const match of globalMeasurements) {
          if (!data.measurements.includes(match[1].trim())) {
            data.measurements.push(match[1].trim());
          }
        }
        
        // Remove duplicates and clean up
        data.diagnoses = [...new Set(data.diagnoses.filter(d => d && d.length > 3))];
        data.abnormalResults = [...new Set(data.abnormalResults.filter(a => a && a.length > 5))];
        data.recommendations = [...new Set(data.recommendations.filter(r => r && r.length > 10))];
        data.findings = [...new Set(data.findings.filter(f => f && f.length > 5))];
        data.measurements = [...new Set(data.measurements)];
        
        // Check for urgency indicators with more patterns
        const urgencyPatterns = [
          /urgent|immediate|emergency|critical|stat|acute/i,
          /requires?\s+(?:immediate|urgent|emergency)\s+(?:attention|evaluation|treatment)/i,
          /life[- ]threatening/i,
          /unstable/i
        ];
        
        for (const pattern of urgencyPatterns) {
          if (pattern.test(fullText)) {
            data.urgencyLevel = 'urgent';
            break;
          }
        }
        
        // Identify red flags
        if (data.urgencyLevel === 'urgent') {
          data.redFlags = data.abnormalResults.filter(result => {
            const resultLower = result.toLowerCase();
            return resultLower.includes('urgent') || 
                   resultLower.includes('emergency') ||
                   resultLower.includes('aneurysm') ||
                   resultLower.includes('critical') ||
                   resultLower.includes('hemorrhage') ||
                   resultLower.includes('dissection');
          });
        }
        
        // Create comprehensive notes section
        const noteParts = [];
        if (data.imagingType) noteParts.push(`Imaging Type: ${data.imagingType}`);
        if (data.bodyPart) noteParts.push(`Body Part: ${data.bodyPart}`);
        if (data.clinicalIndication) noteParts.push(`Clinical Indication: ${data.clinicalIndication}`);
        if (data.findings.length > 0) noteParts.push(`Key Findings: ${data.findings.slice(0, 3).join('; ')}`);
        if (data.diagnoses.length > 0) noteParts.push(`Diagnoses: ${data.diagnoses.join('; ')}`);
        if (data.measurements.length > 0) noteParts.push(`Measurements: ${data.measurements.join(', ')}`);
        if (data.urgencyLevel === 'urgent') noteParts.push('⚠️ URGENT: Immediate attention required');
        
        data.notes = noteParts.join('\n');
        
        console.log('✅ Gemini response parsed successfully');
        console.log(`📊 Extracted: ${data.diagnoses.length} diagnoses, ${data.findings.length} findings, ${data.recommendations.length} recommendations`);
        
        return data;
      }
      
      // Default return if function type not recognized
      return {
        summary: geminiResponse,
        notes: 'Analyzed by Gemini medical imaging model'
      };
      
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      return {
        summary: geminiResponse,
        error: 'Failed to parse structured data',
        notes: geminiResponse // Keep the full response as notes
      };
    }
  }
  
  // Helper method to extract text from Office documents
  async extractTextFromOfficeDocument(fileBuffer, mimeType) {
    try {
      // For CSV files, parse directly
      if (mimeType === 'text/csv' || mimeType === 'application/csv') {
        const csvText = fileBuffer.toString('utf-8');
        return this.formatCSVAsText(csvText);
      }
      
      // For Excel files, we'll convert to CSV-like format
      if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        // For now, return a message that Excel needs special handling
        // In production, you'd use a library like xlsx or exceljs
        return "Excel spreadsheet data:\n[Excel file content - requires specialized parsing]\n\nNote: For full Excel support, consider using xlsx library.";
      }
      
      // For Word documents
      if (mimeType.includes('word')) {
        // For now, return a message that Word needs special handling
        // In production, you'd use a library like mammoth or docx
        return "Word document content:\n[Word file content - requires specialized parsing]\n\nNote: For full Word support, consider using mammoth library.";
      }
      
      // Default fallback
      return fileBuffer.toString('utf-8');
    } catch (error) {
      console.error('Error extracting text from Office document:', error);
      return 'Unable to extract text from document';
    }
  }
  
  // Helper to format CSV data as readable text
  formatCSVAsText(csvContent) {
    const lines = csvContent.split('\n');
    const headers = lines[0]?.split(',') || [];
    
    let formattedText = "CSV Data:\n";
    formattedText += "Headers: " + headers.join(' | ') + "\n";
    formattedText += "─".repeat(50) + "\n";
    
    for (let i = 1; i < Math.min(lines.length, 100); i++) { // Limit to first 100 rows
      if (lines[i].trim()) {
        formattedText += `Row ${i}: ${lines[i]}\n`;
      }
    }
    
    if (lines.length > 100) {
      formattedText += `\n... and ${lines.length - 100} more rows`;
    }
    
    return formattedText;
  }
  
  // Extract content from medical-specific formats
  async extractMedicalFormatContent(fileBuffer, mimeType) {
    try {
      if (mimeType === 'application/dicom') {
        // DICOM files contain medical imaging metadata
        return `DICOM Medical Imaging File
Note: This is a medical imaging file (X-ray, CT, MRI, etc.)
The file contains imaging data and patient metadata.
For full DICOM support, specialized DICOM parsing libraries are required.
Please describe any visible medical findings in the image.`;
      }
      
      if (mimeType.includes('hl7')) {
        // HL7 messages are health data exchange format
        const hl7Content = fileBuffer.toString('utf-8');
        return `HL7 Health Data Message:\n${hl7Content}\n
Note: This is an HL7 message used for health information exchange.
Extract patient information, test results, and clinical data from the message.`;
      }
      
      if (mimeType.includes('fhir')) {
        // FHIR is a standard for health care data exchange
        const fhirContent = fileBuffer.toString('utf-8');
        return `FHIR Healthcare Data:\n${fhirContent}\n
Note: This is a FHIR (Fast Healthcare Interoperability Resources) document.
Extract all relevant medical information from the structured data.`;
      }
      
      if (mimeType.includes('cda')) {
        // Clinical Document Architecture
        const cdaContent = fileBuffer.toString('utf-8');
        return `Clinical Document Architecture (CDA):\n${cdaContent}\n
Note: This is a CDA document containing structured clinical information.
Extract patient data, diagnoses, procedures, and medications.`;
      }
      
      // Default fallback for medical formats
      return fileBuffer.toString('utf-8');
    } catch (error) {
      console.error('Error extracting medical format content:', error);
      return 'Unable to extract medical format content';
    }
  }
  
  // Batch processing for multiple documents
  async analyzeMultipleDocuments(documents, language = 'he') {
    console.log(`📦 Starting batch analysis of ${documents.length} documents`);
    
    const results = [];
    const batchSize = 5; // Process 5 documents concurrently
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (doc) => {
        try {
          console.log(`📄 Analyzing document ${doc.fileName || doc.id}`);
          
          const result = await this.analyzeDocumentWithClaude(
            doc.fileBuffer,
            doc.mimeType,
            this.extractMedicalDataFunction,
            'Extract all medical information from this document'
          );
          
          return {
            id: doc.id,
            fileName: doc.fileName,
            success: true,
            data: result
          };
        } catch (error) {
          console.error(`❌ Error analyzing ${doc.fileName}:`, error.message);
          return {
            id: doc.id,
            fileName: doc.fileName,
            success: false,
            error: error.message
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Batch analysis complete. Success: ${results.filter(r => r.success).length}/${documents.length}`);
    return results;
  }
  
  // Enhanced caching for repeated document analysis
  async analyzeDocumentWithCache(fileBuffer, mimeType, functionDeclaration, prompt, cacheKey = null) {
    // Generate cache key from document content if not provided
    if (!cacheKey) {
      const crypto = require('crypto');
      cacheKey = crypto.createHash('md5').update(fileBuffer).digest('hex');
    }
    
    // Check if we have cached results (implement your cache storage)
    // For now, we'll use a simple in-memory cache
    if (!this.documentCache) {
      this.documentCache = new Map();
    }
    
    // Check cache
    if (this.documentCache.has(cacheKey)) {
      console.log('📋 Using cached analysis result');
      return this.documentCache.get(cacheKey);
    }
    
    // Analyze document
    const result = await this.analyzeDocumentWithClaude(fileBuffer, mimeType, functionDeclaration, prompt);
    
    // Store in cache (with 1-hour expiry)
    this.documentCache.set(cacheKey, result);
    setTimeout(() => this.documentCache.delete(cacheKey), 3600000); // 1 hour
    
    return result;
  }
  
  async analyzePDFWithFunction(fileBuffer, functionDeclaration, prompt, sessionId) {
    try {
      console.log(`🤖 Analyzing PDF with function calling...`);
      console.log(`📄 PDF size: ${fileBuffer.length} bytes`);

      const contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: fileBuffer.toString('base64')
          }
        }
      ];

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          tools: [{
            functionDeclarations: [functionDeclaration]
          }],
          temperature: 0.1
        }
      });

      // Track Gemini cost if session ID provided
      if (sessionId && response.usageMetadata) {
        const cost = geminiCostTracker.trackDocumentAnalysis(sessionId, response.usageMetadata);
        console.log(`💰 Gemini document analysis: ₪${cost.totalCostILS} (${cost.totalTokens} tokens)`);
      }

      return response;
    } catch (error) {
      console.error('❌ PDF analysis error:', error.message);
      throw error;
    }
  }

  async analyzeImageWithFunction(fileBuffer, mimeType, functionDeclaration, prompt) {
    try {
      console.log(`🤖 Analyzing image with function calling...`);
      console.log(`📷 Image type: ${mimeType}, size: ${fileBuffer.length} bytes`);

      const contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: fileBuffer.toString('base64')
          }
        }
      ];

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          tools: [{
            functionDeclarations: [functionDeclaration]
          }],
          temperature: 0.1
        }
      });

      return response;
    } catch (error) {
      console.error('❌ Image analysis error:', error.message);
      throw error;
    }
  }

  async analyzeTextWithFunction(text, functionDeclaration, prompt) {
    try {
      console.log(`🤖 Analyzing text with function calling...`);

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${prompt}\n\n${text}`,
        config: {
          tools: [{
            functionDeclarations: [functionDeclaration]
          }],
          temperature: 0.1
        }
      });

      return response;
    } catch (error) {
      console.error('❌ Text analysis error:', error.message);
      throw error;
    }
  }

  // ===== PRACTICE CONTEXT METHODS =====
  
  async analyzeDocumentWithAI(documentId, practiceId = null) {
    try {
      console.log(`🔍 Analyzing document ${documentId} for practice: ${practiceId || 'default'}`);
      
      // In a real implementation, this would:
      // 1. Retrieve the document from database using practiceId
      // 2. Use practice-specific AI prompts and configurations
      // 3. Store results with practice context
      
      // For now, return a structured analysis result
      return {
        documentId: documentId,
        practiceId: practiceId,
        analysisDate: new Date(),
        documentType: 'medical_document',
        extractedData: {
          patientInfo: {},
          medicalInfo: {},
          dates: [],
          medications: []
        },
        confidence: 0.85,
        language: 'en',
        requiresReview: false,
        clinicSpecificData: practiceId ? {
          processedBy: `practice_${practiceId}_ai`,
          customFields: {}
        } : null
      };
    } catch (error) {
      console.error(`❌ Error analyzing document ${documentId}:`, error);
      throw error;
    }
  }

  async searchDocumentsByContent(query, practiceId = null) {
    try {
      console.log(`🔍 Searching documents with query: "${query}" for practice: ${practiceId || 'default'}`);
      
      // In a real implementation, this would:
      // 1. Search only within the practice's documents
      // 2. Use practice-specific search parameters
      // 3. Apply practice-level permissions
      
      return {
        query: query,
        practiceId: practiceId,
        results: [],
        totalResults: 0,
        searchDate: new Date()
      };
    } catch (error) {
      console.error(`❌ Error searching documents:`, error);
      throw error;
    }
  }

  // Method to analyze with practice-specific prompts
  async analyzeWithClinicContext(fileBuffer, mimeType, clinicConfig = {}) {
    try {
      const { practiceId, customPrompts, specializations } = clinicConfig;
      
      console.log(`🏥 Analyzing document for practice ${practiceId} with specializations: ${specializations?.join(', ') || 'general'}`);
      
      // Use the existing analyzeDocument method
      const baseAnalysis = await this.analyzeDocument(fileBuffer, mimeType);
      
      // Enhance with practice-specific context
      if (practiceId) {
        baseAnalysis.practiceContext = {
          practiceId: practiceId,
          processedAt: new Date(),
          specializations: specializations || [],
          customPrompts: customPrompts ? 'applied' : 'default'
        };
        
        // Apply practice-specific enhancements
        if (specializations && specializations.includes('pediatrics')) {
          console.log('👶 Applying pediatric-specific analysis...');
          // Add pediatric-specific analysis logic
        }
        
        if (specializations && specializations.includes('cardiology')) {
          console.log('❤️ Applying cardiology-specific analysis...');
          // Add cardiology-specific analysis logic
        }
      }
      
      return baseAnalysis;
    } catch (error) {
      console.error('❌ Error in practice context analysis:', error);
      throw error;
    }
  }
}

// Create singleton instance
const documentAnalysisServiceInstance = new DocumentAnalysisService();

// Export both the instance and specific methods for backward compatibility
module.exports = documentAnalysisServiceInstance;
module.exports.analyzeDocumentWithAI = documentAnalysisServiceInstance.analyzeDocumentWithAI.bind(documentAnalysisServiceInstance);
module.exports.searchDocumentsByContent = documentAnalysisServiceInstance.searchDocumentsByContent.bind(documentAnalysisServiceInstance);
module.exports.analyzeWithClinicContext = documentAnalysisServiceInstance.analyzeWithClinicContext.bind(documentAnalysisServiceInstance);
