// IntelliCare Diagnostic Service - New Implementation with Function Calling
// Uses @google/genai SDK with native function calling for medical diagnosis
// PRESERVES ALL MEDICAL ANALYSIS DATA for doctors
// Migrated to DDD NX architecture - Clinical Care Context - Diagnosis Feature

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class DiagnosticServiceNew {
  constructor() {
    this.serviceId = 'diagnostic-service-new';
    this.serviceToken = null;
    this.initialized = false;
    // Gemini API Configuration - will be initialized later
    this.geminiApiKey = null;
    this.ai = null;

    // Comprehensive Medical Diagnosis Function - PRESERVES ALL ANALYSIS
    this.comprehensiveDiagnosisFunction = {
      name: "provide_comprehensive_medical_diagnosis",
      description: "Provide complete medical analysis with all diagnostic details for healthcare professionals",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          // PRIMARY DIAGNOSIS SECTION
          primaryDiagnosis: {
            type: SchemaType.STRING,
            description: "Most likely primary diagnosis with detailed explanation"
          },
          differentialDiagnoses: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                diagnosis: { type: SchemaType.STRING, description: "Alternative diagnosis" },
                probability: { type: SchemaType.STRING, description: "Likelihood percentage" },
                reasoning: { type: SchemaType.STRING, description: "Why this diagnosis is considered" }
              }
            },
            description: "Complete list of differential diagnoses with reasoning"
          },
          
          // DETAILED SYMPTOM ANALYSIS - PRESERVE ALL DETAILS
          symptomAnalysis: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                symptom: { type: SchemaType.STRING, description: "Symptom name" },
                clinicalSignificance: { type: SchemaType.STRING, description: "Detailed clinical significance and interpretation" },
                severity: { type: SchemaType.STRING, enum: ["MILD", "MODERATE", "SEVERE"], description: "Severity assessment" },
                duration: { type: SchemaType.STRING, description: "Duration considerations" },
                associatedFindings: { type: SchemaType.STRING, description: "Related clinical findings" },
                differentialConsiderations: { type: SchemaType.STRING, description: "What this symptom suggests or rules out" }
              }
            },
            description: "Comprehensive analysis of each symptom"
          },

          // CLINICAL ASSESSMENT
          confidence: {
            type: SchemaType.NUMBER,
            description: "Diagnostic confidence percentage (0-100)"
          },
          riskLevel: {
            type: SchemaType.STRING,
            enum: ["LOW", "MEDIUM", "HIGH"],
            description: "Overall patient risk level"
          },
          urgency: {
            type: SchemaType.STRING,
            enum: ["ROUTINE", "URGENT", "EMERGENCY"],
            description: "Clinical urgency level"
          },

          // REQUIRED INVESTIGATIONS - DETAILED
          requiredInvestigations: {
            type: SchemaType.OBJECT,
            properties: {
              laboratoryTests: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    test: { type: SchemaType.STRING, description: "Specific test name" },
                    indication: { type: SchemaType.STRING, description: "Why this test is needed" },
                    urgency: { type: SchemaType.STRING, enum: ["STAT", "URGENT", "ROUTINE"] }
                  }
                }
              },
              imagingStudies: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    study: { type: SchemaType.STRING, description: "Imaging study type" },
                    indication: { type: SchemaType.STRING, description: "Clinical indication" },
                    urgency: { type: SchemaType.STRING, enum: ["STAT", "URGENT", "ROUTINE"] }
                  }
                }
              },
              specialistConsultations: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    specialty: { type: SchemaType.STRING, description: "Medical specialty" },
                    indication: { type: SchemaType.STRING, description: "Reason for referral" },
                    urgency: { type: SchemaType.STRING, enum: ["STAT", "URGENT", "ROUTINE"] }
                  }
                }
              }
            }
          },

          // MONITORING PLAN - COMPREHENSIVE
          monitoringPlan: {
            type: SchemaType.OBJECT,
            properties: {
              vitalSigns: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "Specific vital signs to monitor"
              },
              followUpSchedule: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    timeframe: { type: SchemaType.STRING, description: "When to follow up" },
                    purpose: { type: SchemaType.STRING, description: "What to assess" },
                    urgency: { type: SchemaType.STRING, description: "How urgent" }
                  }
                }
              },
              warningSignsToWatch: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    sign: { type: SchemaType.STRING, description: "Warning sign" },
                    action: { type: SchemaType.STRING, description: "What to do if this occurs" },
                    urgency: { type: SchemaType.STRING, enum: ["IMMEDIATE", "URGENT", "PROMPT"] }
                  }
                }
              }
            }
          },

          // CLINICAL REASONING - PRESERVE MEDICAL THINKING
          clinicalReasoning: {
            type: SchemaType.STRING,
            description: "Detailed explanation of the diagnostic reasoning process and clinical decision-making"
          },

          // ADDITIONAL CONSIDERATIONS
          riskFactors: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Relevant risk factors identified"
          },
          prognosticFactors: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Factors affecting prognosis"
          },
          patientEducationPoints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Key points for patient education"
          }
        },
        required: ["primaryDiagnosis", "symptomAnalysis", "confidence", "riskLevel", "clinicalReasoning"]
      }
    };

    // Treatment Recommendations Function - COMPREHENSIVE
    this.treatmentRecommendationsFunction = {
      name: "provide_comprehensive_treatment_recommendations",
      description: "Provide detailed treatment recommendations with complete medical rationale",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          // IMMEDIATE ACTIONS
          immediateActions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                action: { type: SchemaType.STRING, description: "Immediate action to take" },
                rationale: { type: SchemaType.STRING, description: "Medical rationale for this action" },
                priority: { type: SchemaType.STRING, enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] }
              }
            },
            description: "Immediate treatment actions with rationale"
          },

          // DETAILED MEDICATION RECOMMENDATIONS
          medications: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Medication name" },
                dosage: { type: SchemaType.STRING, description: "Specific dosage instructions" },
                frequency: { type: SchemaType.STRING, description: "How often to take" },
                duration: { type: SchemaType.STRING, description: "Treatment duration" },
                indication: { type: SchemaType.STRING, description: "Why this medication is prescribed" },
                contraindications: { type: SchemaType.STRING, description: "Important contraindications to consider" },
                sideEffectsToMonitor: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                interactions: { type: SchemaType.STRING, description: "Important drug interactions" },
                patientInstructions: { type: SchemaType.STRING, description: "Specific instructions for patient" }
              }
            }
          },

          // LIFESTYLE MODIFICATIONS
          lifestyleModifications: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                modification: { type: SchemaType.STRING, description: "Lifestyle change" },
                rationale: { type: SchemaType.STRING, description: "Why this change is important" },
                implementation: { type: SchemaType.STRING, description: "How to implement this change" },
                expectedBenefit: { type: SchemaType.STRING, description: "Expected clinical benefit" }
              }
            }
          },

          // COMPREHENSIVE FOLLOW-UP PLAN
          followUpPlan: {
            type: SchemaType.OBJECT,
            properties: {
              schedule: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    timeframe: { type: SchemaType.STRING, description: "When to follow up" },
                    purpose: { type: SchemaType.STRING, description: "What to assess at follow-up" },
                    assessments: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    adjustments: { type: SchemaType.STRING, description: "Potential treatment adjustments" }
                  }
                }
              },
              monitoringParameters: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    parameter: { type: SchemaType.STRING, description: "What to monitor" },
                    frequency: { type: SchemaType.STRING, description: "How often to check" },
                    targetValues: { type: SchemaType.STRING, description: "Target values or goals" },
                    actionIfAbnormal: { type: SchemaType.STRING, description: "What to do if abnormal" }
                  }
                }
              }
            }
          },

          // TREATMENT RATIONALE
          treatmentRationale: {
            type: SchemaType.STRING,
            description: "Comprehensive explanation of the treatment approach and medical reasoning"
          },

          // ALTERNATIVE TREATMENTS
          alternativeOptions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                option: { type: SchemaType.STRING, description: "Alternative treatment option" },
                indications: { type: SchemaType.STRING, description: "When to consider this option" },
                advantages: { type: SchemaType.STRING, description: "Advantages of this approach" },
                disadvantages: { type: SchemaType.STRING, description: "Potential disadvantages" }
              }
            }
          }
        },
        required: ["immediateActions", "treatmentRationale"]
      }
    };

    // Diagnostic Service initialized with Gemini
  }
  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      
      // Authenticate service with serviceAccountManager
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize secure config service
      const secureConfigService = proxy.getService('secureConfigService');
      await secureConfigService.initialize();
      
      // Get Gemini API key and initialize AI
      this.geminiApiKey = await secureConfigService.get('GEMINI_API_KEY');
      this.ai = new GoogleGenAI({
        apiKey: this.geminiApiKey
      });
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const AuditLog = proxy.getService('auditLog');
      await AuditLog.create({
        action: 'SERVICE_INITIALIZED',
        service: 'diagnosticServiceNew',
        timestamp: new Date()
      });
      
      console.log('✅ DiagnosticServiceNew initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize DiagnosticServiceNew:', error);
      throw new Error(`Failed to initialize DiagnosticServiceNew: ${error.message}`);
    }
  }


  // ===== MAIN DIAGNOSTIC METHODS =====

  async getComprehensiveDiagnosis(symptoms, age, gender, history, language = 'en') {
    try {
      console.log('🔍 Getting comprehensive diagnosis with function calling...');
      console.log(`📋 Patient: ${age}y ${gender}, Language: ${language}`);
      console.log(`🩺 Symptoms: ${symptoms}`);

      // Create comprehensive prompt for medical analysis
      const prompt = this.createDiagnosisPrompt(symptoms, age, gender, history, language);

      // Call Gemini with comprehensive diagnosis function
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{
            functionDeclarations: [this.comprehensiveDiagnosisFunction]
          }],
          temperature: 0.1 // Low temperature for medical accuracy
        }
      });

      // Handle function call response
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        console.log('🔧 Comprehensive diagnosis function called');
        console.log('📊 Confidence:', functionCall.args.confidence + '%');
        console.log('⚠️ Risk Level:', functionCall.args.riskLevel);

        // Convert to format compatible with existing system while preserving ALL data
        return this.formatDiagnosisResponse(functionCall.args, language);
      } else {
        // Fallback if no function call
        console.log('⚠️ No function call, using fallback diagnosis');
        return this.getFallbackDiagnosis(symptoms, language);
      }

    } catch (error) {
      console.error('❌ Comprehensive diagnosis error:', error.message);
      return this.getFallbackDiagnosis(symptoms, language);
    }
  }

  async getTreatmentRecommendations(symptoms, age, gender, history, diagnosis, language = 'en') {
    try {
      console.log('🔍 Getting treatment recommendations with function calling...');

      // Create treatment prompt
      const prompt = this.createTreatmentPrompt(symptoms, age, gender, history, diagnosis, language);

      // Call Gemini with treatment recommendations function
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{
            functionDeclarations: [this.treatmentRecommendationsFunction]
          }],
          temperature: 0.1
        }
      });

      // Handle function call response
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        console.log('🔧 Treatment recommendations function called');
        console.log('💊 Medications:', functionCall.args.medications?.length || 0);
        console.log('📋 Immediate actions:', functionCall.args.immediateActions?.length || 0);

        // Convert to format compatible with existing system while preserving ALL data
        return this.formatTreatmentResponse(functionCall.args, language);
      } else {
        // Fallback if no function call
        console.log('⚠️ No function call, using fallback recommendations');
        return this.getFallbackTreatment(diagnosis, language);
      }

    } catch (error) {
      console.error('❌ Treatment recommendations error:', error.message);
      return this.getFallbackTreatment(diagnosis, language);
    }
  }

  // ===== PROMPT CREATION METHODS =====

  createDiagnosisPrompt(symptoms, age, gender, history, language) {
    const isHebrew = language === 'he';

    if (isHebrew) {
      return `אתה רופא מומחה מנוסה. ספק ניתוח רפואי מקיף ומפורט למטופל הזה:

תסמינים: ${symptoms}
גיל: ${age}
מין: ${gender}
היסטוריה רפואית: ${history}

ספק ניתוח רפואי מקיף הכולל:
- אבחנה ראשית מפורטת עם הסבר
- אבחנות דיפרנציאליות עם הסתברויות
- ניתוח מפורט של כל תסמין
- חקירות נדרשות עם הצדקות
- תוכנית מעקב מקיפה
- הסבר הגיוני קליני מפורט

חשוב: ספק ניתוח מקצועי מלא לרופאים.`;
    } else {
      return `You are an experienced medical expert. Provide comprehensive medical analysis for this patient:

Symptoms: ${symptoms}
Age: ${age}
Gender: ${gender}
Medical History: ${history}

Provide complete medical analysis including:
- Detailed primary diagnosis with explanation
- Differential diagnoses with probabilities
- Comprehensive analysis of each symptom
- Required investigations with justifications
- Complete monitoring plan
- Detailed clinical reasoning

Important: Provide full professional analysis for healthcare providers.`;
    }
  }

  createTreatmentPrompt(symptoms, age, gender, history, diagnosis, language) {
    const isHebrew = language === 'he';

    if (isHebrew) {
      return `אתה רופא מומחה. ספק המלצות טיפול מקיפות ומפורטות:

מידע על המטופל:
תסמינים: ${symptoms}
גיל: ${age}
מין: ${gender}
היסטוריה רפואית: ${history}

אבחנה: ${diagnosis}

ספק המלצות טיפול מקיפות הכוללות:
- פעולות מיידיות עם הצדקות
- תרופות מפורטות עם מינונים והוראות
- שינויי אורח חיים עם יישום
- תוכנית מעקב מקיפה
- הסבר רפואי מפורט לגישת הטיפול

חשוב: ספק המלצות מקצועיות מלאות לרופאים.`;
    } else {
      return `You are a medical expert. Provide comprehensive treatment recommendations:

Patient Information:
Symptoms: ${symptoms}
Age: ${age}
Gender: ${gender}
Medical History: ${history}

Diagnosis: ${diagnosis}

Provide comprehensive treatment recommendations including:
- Immediate actions with rationale
- Detailed medications with dosages and instructions
- Lifestyle modifications with implementation
- Complete follow-up plan
- Detailed medical explanation of treatment approach

Important: Provide full professional recommendations for healthcare providers.`;
    }
  }

  // ===== RESPONSE FORMATTING METHODS - PRESERVE ALL DATA =====

  formatDiagnosisResponse(diagnosisData, language) {
    // Create comprehensive response that preserves ALL medical analysis
    const response = {
      success: true,
      language: language,

      // CORE DIAGNOSIS DATA
      primaryDiagnosis: diagnosisData.primaryDiagnosis,
      confidence: diagnosisData.confidence,
      riskLevel: diagnosisData.riskLevel,
      urgency: diagnosisData.urgency,

      // DETAILED MEDICAL ANALYSIS - PRESERVED
      differentialDiagnoses: diagnosisData.differentialDiagnoses || [],
      symptomAnalysis: diagnosisData.symptomAnalysis || [],
      clinicalReasoning: diagnosisData.clinicalReasoning,

      // CLINICAL ASSESSMENTS
      riskFactors: diagnosisData.riskFactors || [],
      prognosticFactors: diagnosisData.prognosticFactors || [],

      // INVESTIGATIONS - STRUCTURED
      requiredInvestigations: {
        laboratoryTests: diagnosisData.requiredInvestigations?.laboratoryTests || [],
        imagingStudies: diagnosisData.requiredInvestigations?.imagingStudies || [],
        specialistConsultations: diagnosisData.requiredInvestigations?.specialistConsultations || []
      },

      // MONITORING PLAN - COMPREHENSIVE
      monitoringPlan: {
        vitalSigns: diagnosisData.monitoringPlan?.vitalSigns || [],
        followUpSchedule: diagnosisData.monitoringPlan?.followUpSchedule || [],
        warningSignsToWatch: diagnosisData.monitoringPlan?.warningSignsToWatch || []
      },

      // PATIENT EDUCATION
      patientEducationPoints: diagnosisData.patientEducationPoints || [],

      // COMPATIBILITY WITH EXISTING SYSTEM
      prediction: diagnosisData.primaryDiagnosis, // For backward compatibility
      overallPrediction: diagnosisData.primaryDiagnosis,
      averageConfidence: diagnosisData.confidence,
      highestRiskLevel: diagnosisData.riskLevel,

      // METADATA
      timestamp: new Date().toISOString(),
      functionCalling: true,
      preservedAnalysis: true
    };

    console.log('✅ Formatted comprehensive diagnosis response');
    console.log(`📊 Preserved ${diagnosisData.symptomAnalysis?.length || 0} symptom analyses`);
    console.log(`🔬 Preserved ${diagnosisData.differentialDiagnoses?.length || 0} differential diagnoses`);

    return response;
  }

  formatTreatmentResponse(treatmentData, language) {
    // Create comprehensive treatment response preserving ALL recommendations
    const response = {
      success: true,
      language: language,

      // IMMEDIATE ACTIONS - DETAILED
      immediateActions: treatmentData.immediateActions || [],

      // MEDICATIONS - COMPREHENSIVE
      medications: treatmentData.medications || [],

      // LIFESTYLE MODIFICATIONS - DETAILED
      lifestyleModifications: treatmentData.lifestyleModifications || [],

      // FOLLOW-UP PLAN - STRUCTURED
      followUpPlan: treatmentData.followUpPlan || {},

      // TREATMENT RATIONALE - PRESERVED
      treatmentRationale: treatmentData.treatmentRationale,

      // ALTERNATIVE OPTIONS - PRESERVED
      alternativeOptions: treatmentData.alternativeOptions || [],

      // COMPATIBILITY WITH EXISTING SYSTEM
      recommendations: this.convertToLegacyRecommendations(treatmentData),
      combinedRecommendations: this.convertToLegacyRecommendations(treatmentData),

      // METADATA
      timestamp: new Date().toISOString(),
      functionCalling: true,
      preservedAnalysis: true
    };

    console.log('✅ Formatted comprehensive treatment response');
    console.log(`💊 Preserved ${treatmentData.medications?.length || 0} medication details`);
    console.log(`📋 Preserved ${treatmentData.immediateActions?.length || 0} immediate actions`);

    return response;
  }

  convertToLegacyRecommendations(treatmentData) {
    // Convert structured treatment data to legacy format for backward compatibility
    const recommendations = [];

    // Add immediate actions
    if (treatmentData.immediateActions) {
      treatmentData.immediateActions.forEach(action => {
        recommendations.push(`${action.action} (${action.rationale})`);
      });
    }

    // Add medications
    if (treatmentData.medications) {
      treatmentData.medications.forEach(med => {
        recommendations.push(`${med.name}: ${med.dosage} ${med.frequency} for ${med.duration} - ${med.indication}`);
      });
    }

    // Add lifestyle modifications
    if (treatmentData.lifestyleModifications) {
      treatmentData.lifestyleModifications.forEach(lifestyle => {
        recommendations.push(`${lifestyle.modification} - ${lifestyle.rationale}`);
      });
    }

    return recommendations;
  }

  // ===== FALLBACK METHODS =====

  getFallbackDiagnosis(symptoms, language) {
    const isHebrew = language === 'he';
    return {
      success: false,
      primaryDiagnosis: isHebrew ? 'נדרש ניתוח נוסף' : 'Further analysis required',
      confidence: 50,
      riskLevel: 'MEDIUM',
      symptomAnalysis: [],
      clinicalReasoning: isHebrew ? 'שגיאה בניתוח הפונקציה' : 'Function calling analysis error',
      fallback: true
    };
  }

  getFallbackTreatment(diagnosis, language) {
    const isHebrew = language === 'he';
    return {
      success: false,
      immediateActions: [{
        action: isHebrew ? 'התייעצות עם רופא' : 'Consult with physician',
        rationale: isHebrew ? 'נדרש ניתוח נוסף' : 'Further analysis required',
        priority: 'HIGH'
      }],
      treatmentRationale: isHebrew ? 'שגיאה בניתוח הטיפול' : 'Treatment analysis error',
      fallback: true
    };
  }
}

// Create and export singleton
const diagnosticServiceNew = new DiagnosticServiceNew();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('diagnosticServiceNew', () => diagnosticServiceNew);
}

module.exports = diagnosticServiceNew;