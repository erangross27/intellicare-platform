/**
 * Comprehensive Medical Data Extractor
 *
 * This service provides dynamic extraction schemas for ALL medical document types
 * Ensures 100% data capture from any medical document
 */

const medicalFieldsExtractor = require('./medicalFieldsExtractor');
const medicalCollectionsService = require('./medicalCollectionsService');

class ComprehensiveExtractor {
  /**
   * Build a comprehensive extraction tool schema for Claude
   * This includes ALL possible medical fields organized by category
   * @returns {object} Tool definition for Claude
   */
  buildComprehensiveExtractionTool() {
    const allCollections = medicalCollectionsService.getAllCollections();

    return {
      name: 'extract_all_medical_data',
      description: 'Extract comprehensive medical information from any document type',
      input_schema: {
        type: 'object',
        properties: {
          // ========== PATIENT IDENTIFICATION ==========
          patientName: { type: 'string', description: 'Full patient name' },
          patientId: { type: 'string', description: 'MRN or patient ID' },
          dateOfBirth: { type: 'string', description: 'Patient date of birth' },
          age: { type: 'string', description: 'Patient age' },
          gender: { type: 'string', description: 'Patient gender' },

          // ========== DOCUMENT METADATA ==========
          category: {
            type: 'string',
            enum: allCollections,
            description: 'Document category from 190+ types'
          },
          documentDate: { type: 'string', description: 'Date of document' },
          documentType: { type: 'string', description: 'Type of document' },
          encounterNumber: { type: 'string', description: 'Visit/encounter number' },

          // ========== PROVIDER INFORMATION ==========
          primaryProvider: { type: 'string', description: 'Primary physician name' },
          providerSpecialty: { type: 'string', description: 'Provider specialty' },
          providerLicense: { type: 'string', description: 'License number' },
          referringPhysician: { type: 'string', description: 'Referring doctor' },
          consultingPhysicians: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of consulting doctors'
          },

          // ========== FACILITY INFORMATION ==========
          facility: { type: 'string', description: 'Healthcare facility' },
          department: { type: 'string', description: 'Department/unit' },
          room: { type: 'string', description: 'Room/bed number' },

          // ========== CLINICAL DATA - CORE ==========
          chiefComplaint: { type: 'string', description: 'Chief complaint' },
          historyOfPresentIllness: { type: 'string', description: 'HPI' },
          reviewOfSystems: { type: 'object', description: 'ROS by system' },

          // ========== DIAGNOSES ==========
          diagnoses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                diagnosis: { type: 'string' },
                icdCode: { type: 'string' },
                type: { type: 'string' },
                date: { type: 'string' },
                status: { type: 'string' }
              }
            }
          },
          admittingDiagnosis: { type: 'string' },
          dischargeDiagnosis: { type: 'string' },
          preOperativeDiagnosis: { type: 'string' },
          postOperativeDiagnosis: { type: 'string' },

          // ========== MEDICATIONS ==========
          medications: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                genericName: { type: 'string' },
                dosage: { type: 'string' },
                frequency: { type: 'string' },
                route: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                prescriber: { type: 'string' },
                indication: { type: 'string' },
                instructions: { type: 'string' }
              }
            }
          },
          dischargeMedications: { type: 'array', items: { type: 'object' } },
          premedications: { type: 'array', items: { type: 'object' } },

          // ========== ALLERGIES ==========
          allergies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                allergen: { type: 'string' },
                reaction: { type: 'string' },
                severity: { type: 'string' },
                type: { type: 'string' }
              }
            }
          },

          // ========== VITAL SIGNS ==========
          vitalSigns: {
            type: 'object',
            properties: {
              bloodPressure: { type: 'string' },
              heartRate: { type: 'string' },
              temperature: { type: 'string' },
              respiratoryRate: { type: 'string' },
              oxygenSaturation: { type: 'string' },
              weight: { type: 'string' },
              height: { type: 'string' },
              bmi: { type: 'string' },
              painScore: { type: 'string' }
            }
          },
          vitalSignsTable: { type: 'array', items: { type: 'object' } },

          // ========== PHYSICAL EXAMINATION ==========
          physicalExamination: {
            type: 'object',
            properties: {
              general: { type: 'string' },
              heent: { type: 'string' },
              cardiovascular: { type: 'string' },
              respiratory: { type: 'string' },
              gastrointestinal: { type: 'string' },
              genitourinary: { type: 'string' },
              musculoskeletal: { type: 'string' },
              neurological: { type: 'string' },
              psychiatric: { type: 'string' },
              skin: { type: 'string' },
              lymphatic: { type: 'string' }
            }
          },

          // ========== LABORATORY RESULTS ==========
          labResults: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                testName: { type: 'string' },
                result: { type: 'string' },
                units: { type: 'string' },
                referenceRange: { type: 'string' },
                flag: { type: 'string' },
                date: { type: 'string' },
                interpretation: { type: 'string' }
              }
            }
          },
          criticalValues: { type: 'array', items: { type: 'string' } },

          // ========== IMAGING ==========
          imaging: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                bodyPart: { type: 'string' },
                date: { type: 'string' },
                findings: { type: 'string' },
                impression: { type: 'string' },
                technique: { type: 'string' },
                contrast: { type: 'object' },
                recommendations: { type: 'array' }
              }
            }
          },

          // ========== PROCEDURES ==========
          procedures: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                date: { type: 'string' },
                time: { type: 'string' },
                provider: { type: 'string' },
                findings: { type: 'string' },
                technique: { type: 'string' },
                complications: { type: 'string' },
                outcome: { type: 'string' },
                specimens: { type: 'array' },
                implants: { type: 'array' }
              }
            }
          },

          // ========== CARDIOLOGY SPECIFIC ==========
          ecgFindings: {
            type: 'object',
            properties: {
              rhythm: { type: 'string' },
              rate: { type: 'number' },
              prInterval: { type: 'string' },
              qrsComplex: { type: 'string' },
              qtInterval: { type: 'string' },
              qtcInterval: { type: 'string' },
              axis: { type: 'string' },
              interpretation: { type: 'string' }
            }
          },
          echoFindings: {
            type: 'object',
            properties: {
              ejectionFraction: { type: 'string' },
              chamberSizes: { type: 'object' },
              valves: { type: 'array' },
              wallMotion: { type: 'string' }
            }
          },
          cardiacRiskScores: {
            type: 'object',
            properties: {
              CHA2DS2VASc: { type: 'number' },
              HASBLED: { type: 'number' },
              TIMI: { type: 'number' },
              GRACE: { type: 'number' }
            }
          },

          // ========== SURGICAL/OPERATIVE ==========
          surgicalDetails: {
            type: 'object',
            properties: {
              surgeon: { type: 'string' },
              assistants: { type: 'array' },
              anesthesiaType: { type: 'string' },
              anesthesiologist: { type: 'string' },
              operativeFindings: { type: 'string' },
              estimatedBloodLoss: { type: 'string' },
              specimens: { type: 'array' },
              drains: { type: 'array' },
              complications: { type: 'string' }
            }
          },
          implants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                manufacturer: { type: 'string' },
                model: { type: 'string' },
                serialNumber: { type: 'string' },
                lotNumber: { type: 'string' },
                size: { type: 'string' }
              }
            }
          },

          // ========== PATHOLOGY ==========
          pathologyFindings: {
            type: 'object',
            properties: {
              specimenType: { type: 'string' },
              grossDescription: { type: 'string' },
              microscopicDescription: { type: 'string' },
              specialStains: { type: 'array' },
              immunohistochemistry: { type: 'array' },
              diagnosis: { type: 'string' },
              staging: { type: 'object' },
              margins: { type: 'object' }
            }
          },

          // ========== HOSPITAL COURSE ==========
          hospitalCourse: { type: 'string' },
          admissionDate: { type: 'string' },
          dischargeDate: { type: 'string' },
          lengthOfStay: { type: 'number' },
          dischargeDisposition: { type: 'string' },
          dischargeCondition: { type: 'string' },

          // ========== MEDICAL HISTORY ==========
          medicalHistory: {
            type: 'object',
            properties: {
              conditions: { type: 'array', items: { type: 'string' } },
              surgicalHistory: { type: 'array', items: { type: 'string' } },
              familyHistory: { type: 'array', items: { type: 'string' } },
              socialHistory: {
                type: 'object',
                properties: {
                  tobacco: { type: 'string' },
                  alcohol: { type: 'string' },
                  drugs: { type: 'string' },
                  exercise: { type: 'string' },
                  diet: { type: 'string' },
                  occupation: { type: 'string' },
                  caffeine: { type: 'string' },
                  stress: { type: 'string' },
                  sleep: { type: 'string' }
                }
              }
            }
          },

          // ========== RISK FACTORS ==========
          riskFactors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                factor: { type: 'string' },
                category: { type: 'string' },
                severity: { type: 'string' }
              }
            }
          },

          // ========== RECOMMENDATIONS & FOLLOW-UP ==========
          recommendations: { type: 'array', items: { type: 'string' } },
          followUpAppointments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                specialty: { type: 'string' },
                provider: { type: 'string' },
                timing: { type: 'string' },
                reason: { type: 'string' },
                isScheduled: { type: 'boolean' },
                scheduledDate: { type: 'string' }
              }
            }
          },
          dischargeInstructions: { type: 'string' },
          activityRestrictions: { type: 'string' },
          dietRestrictions: { type: 'string' },

          // ========== ASSESSMENT & PLAN ==========
          assessment: { type: 'string' },
          plan: { type: 'string' },
          assessmentAndPlan: { type: 'string' },
          clinicalImpression: { type: 'string' },
          prognosis: { type: 'string' },

          // ========== PATIENT EDUCATION ==========
          patientEducation: { type: 'array', items: { type: 'string' } },
          educationProvided: { type: 'string' },

          // ========== IMMUNIZATIONS ==========
          vaccinations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                vaccine: { type: 'string' },
                date: { type: 'string' },
                manufacturer: { type: 'string' },
                lotNumber: { type: 'string' },
                site: { type: 'string' },
                dose: { type: 'string' }
              }
            }
          },

          // ========== MENTAL STATUS ==========
          mentalStatusExam: {
            type: 'object',
            properties: {
              appearance: { type: 'string' },
              behavior: { type: 'string' },
              speech: { type: 'string' },
              mood: { type: 'string' },
              affect: { type: 'string' },
              thoughtProcess: { type: 'string' },
              thoughtContent: { type: 'string' },
              cognition: { type: 'string' },
              insight: { type: 'string' },
              judgment: { type: 'string' }
            }
          },

          // ========== OBSTETRICS ==========
          obstetricsData: {
            type: 'object',
            properties: {
              gestationalAge: { type: 'string' },
              edd: { type: 'string' },
              gravida: { type: 'number' },
              para: { type: 'number' },
              fetalHeartRate: { type: 'string' },
              fundalHeight: { type: 'string' }
            }
          },

          // ========== PEDIATRICS ==========
          pediatricData: {
            type: 'object',
            properties: {
              birthWeight: { type: 'string' },
              apgarScores: { type: 'object' },
              growthPercentiles: { type: 'object' },
              developmentalMilestones: { type: 'array' },
              immunizationStatus: { type: 'string' }
            }
          },

          // ========== REHABILITATION ==========
          functionalStatus: {
            type: 'object',
            properties: {
              adls: { type: 'object' },
              mobility: { type: 'string' },
              transfers: { type: 'string' },
              gait: { type: 'string' },
              balance: { type: 'string' },
              cognition: { type: 'string' }
            }
          },

          // ========== SCORES & SCALES ==========
          clinicalScores: {
            type: 'object',
            properties: {
              glasgowComaScale: { type: 'number' },
              painScale: { type: 'number' },
              mmse: { type: 'number' },
              phq9: { type: 'number' },
              gad7: { type: 'number' },
              apacheII: { type: 'number' },
              sofa: { type: 'number' }
            }
          },

          // ========== ADDITIONAL NOTES ==========
          additionalNotes: { type: 'string' },
          clinicalNotes: { type: 'string' },
          nursingNotes: { type: 'string' },
          progressNotes: { type: 'string' },

          // ========== SIGNATURES ==========
          signatures: {
            type: 'object',
            properties: {
              primaryProvider: { type: 'string' },
              dateTime: { type: 'string' },
              electronicSignature: { type: 'boolean' }
            }
          },

          // ========== FLEXIBLE FIELD FOR UNEXPECTED DATA ==========
          additionalData: {
            type: 'object',
            description: 'Any additional fields not captured above - store as key-value pairs'
          }
        },
        required: ['patientName', 'category', 'documentDate']
      }
    };
  }

  /**
   * Generate comprehensive extraction prompt
   * @returns {string} Extraction instructions
   */
  generateComprehensivePrompt() {
    return `You are an expert medical data extractor. Your task is to extract ALL medical information from this document.

CRITICAL INSTRUCTIONS:
1. Extract EVERY piece of medical data visible in the document
2. Use the exact field names provided in the schema
3. For provider names, NEVER use "Unknown" or placeholder values
4. Include all measurements with their units
5. Extract all dates in their original format
6. Capture arrays of items completely (medications, diagnoses, procedures, etc.)
7. Include all scores, scales, and clinical assessments
8. Extract narrative sections in full (hospital course, HPI, etc.)
9. Preserve all numerical values exactly as shown
10. Store any unexpected fields in additionalData object

IMPORTANT:
- This is critical medical data - 100% accuracy is required
- If a field is not present, use null or empty array
- Extract data even if partially visible or abbreviated
- Include all acronyms and medical abbreviations as-is
- Capture all consulting physicians and specialists mentioned
- Extract all follow-up instructions and recommendations
- Include all vital sign measurements with timestamps if available

Remember: We need COMPLETE extraction - miss nothing!`;
  }
}

module.exports = new ComprehensiveExtractor();