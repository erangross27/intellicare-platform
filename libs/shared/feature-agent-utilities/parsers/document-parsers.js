// Document Parser Utilities
// Provides document parsing utilities for AgentServiceV4

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class DocumentParsers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('document-parsers');
    }

    // Parse extracted text into structured medical data
    parseStructuredData(extractedText, documentType) {
        const structuredData = {
            patientInfo: this.extractPatientInfo(extractedText),
            medicalData: this.extractMedicalData(extractedText),
            medications: this.extractMedications(extractedText),
            diagnoses: this.extractDiagnoses(extractedText),
            procedures: this.extractProcedures(extractedText),
            labResults: this.extractLabResults(extractedText),
            vitalSigns: this.extractVitalSigns(extractedText),
            allergies: this.extractAllergies(extractedText)
        };
        
        return this.cleanEmptyFields(structuredData);
    }

    // Extract patient information from text
    extractPatientInfo(text) {
        const patientInfo = {};
        
        // Extract name patterns
        const nameMatch = text.match(/(?:Patient|Name|Patient Name)[:\s]*([A-Za-z\s]{2,50})/i);
        if (nameMatch) {
            patientInfo.name = nameMatch[1].trim();
        }
        
        // Extract DOB patterns
        const dobMatch = text.match(/(?:DOB|Date of Birth|Born)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
        if (dobMatch) {
            patientInfo.dateOfBirth = dobMatch[1];
        }
        
        // Extract ID patterns
        const idMatch = text.match(/(?:ID|Patient ID|Medical Record)[:\s]*([A-Za-z0-9]{5,20})/i);
        if (idMatch) {
            patientInfo.patientId = idMatch[1];
        }
        
        return patientInfo;
    }

    // Extract medical data
    extractMedicalData(text) {
        const medicalData = {};
        
        // Extract vital signs
        const vitalSigns = this.extractVitalSigns(text);
        if (Object.keys(vitalSigns).length > 0) {
            medicalData.vitalSigns = vitalSigns;
        }
        
        // Extract chief complaint
        const complaintMatch = text.match(/(?:Chief Complaint|CC|Complaint)[:\s]*([^\n\r]{10,200})/i);
        if (complaintMatch) {
            medicalData.chiefComplaint = complaintMatch[1].trim();
        }
        
        return medicalData;
    }

    // Extract medications from text
    extractMedications(text) {
        const medications = [];
        const medRegex = /(\w+)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?)\s*(?:(\d+)\s*(?:times?|x)\s*(?:daily|day|per day)|(?:once|twice|three times|four times)\s*(?:daily|day|per day)|BID|TID|QID|QD)/gi;
        
        let match;
        while ((match = medRegex.exec(text)) !== null) {
            medications.push({
                name: match[1],
                dosage: match[2],
                unit: match[3],
                frequency: match[4] || 'once daily'
            });
        }
        
        return medications;
    }

    // Extract diagnoses from text
    extractDiagnoses(text) {
        const diagnoses = [];
        
        // Look for diagnosis patterns
        const diagnosisPatterns = [
            /(?:Diagnosis|Dx|Impression)[:\s]*([^\n\r]{5,100})/gi,
            /(?:ICD-?10?)[:\s]*([A-Z]\d{2}(?:\.\d{1,4})?)/gi
        ];
        
        diagnosisPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                diagnoses.push({
                    description: match[1].trim()
                });
            }
        });
        
        return diagnoses;
    }

    // Extract procedures from text
    extractProcedures(text) {
        const procedures = [];
        
        const procedureMatch = text.match(/(?:Procedure|Treatment|Intervention)[:\s]*([^\n\r]{5,150})/gi);
        if (procedureMatch) {
            procedureMatch.forEach(match => {
                const procedure = match.replace(/(?:Procedure|Treatment|Intervention)[:\s]*/i, '').trim();
                if (procedure.length > 5) {
                    procedures.push({
                        description: procedure
                    });
                }
            });
        }
        
        return procedures;
    }

    // Extract lab results from text
    extractLabResults(text) {
        const labResults = [];
        
        // Common lab test patterns
        const labPatterns = [
            /(?:Glucose|Blood Sugar)[:\s]*(\d+(?:\.\d+)?)\s*(mg\/dL)?/gi,
            /(?:Hemoglobin|Hgb|HGB)[:\s]*(\d+(?:\.\d+)?)\s*(g\/dL)?/gi,
            /(?:Creatinine|Cr)[:\s]*(\d+(?:\.\d+)?)\s*(mg\/dL)?/gi,
            /(?:Cholesterol)[:\s]*(\d+(?:\.\d+)?)\s*(mg\/dL)?/gi
        ];
        
        labPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const testName = match[0].split(':')[0].trim();
                labResults.push({
                    test: testName,
                    value: match[1],
                    unit: match[2] || 'mg/dL'
                });
            }
        });
        
        return labResults;
    }

    // Extract vital signs from text
    extractVitalSigns(text) {
        const vitalSigns = {};
        
        // Blood pressure
        const bpMatch = text.match(/(?:BP|Blood Pressure)[:\s]*(\d{2,3})[\/\s]*(\d{2,3})/i);
        if (bpMatch) {
            vitalSigns.bloodPressure = {
                systolic: parseInt(bpMatch[1]),
                diastolic: parseInt(bpMatch[2])
            };
        }
        
        // Heart rate
        const hrMatch = text.match(/(?:HR|Heart Rate|Pulse)[:\s]*(\d{2,3})/i);
        if (hrMatch) {
            vitalSigns.heartRate = parseInt(hrMatch[1]);
        }
        
        // Temperature
        const tempMatch = text.match(/(?:Temp|Temperature)[:\s]*(\d{2,3}(?:\.\d)?)\s*([CF]?)/i);
        if (tempMatch) {
            vitalSigns.temperature = {
                value: parseFloat(tempMatch[1]),
                unit: tempMatch[2] || 'F'
            };
        }
        
        // Respiratory rate
        const rrMatch = text.match(/(?:RR|Respiratory Rate|Respiration)[:\s]*(\d{1,2})/i);
        if (rrMatch) {
            vitalSigns.respiratoryRate = parseInt(rrMatch[1]);
        }
        
        return vitalSigns;
    }

    // Extract allergies from text
    extractAllergies(text) {
        const allergies = [];
        
        const allergyMatch = text.match(/(?:Allergies|Allergy|Allergic to)[:\s]*([^\n\r]{3,200})/i);
        if (allergyMatch) {
            const allergenText = allergyMatch[1];
            const allergenList = allergenText.split(/[,;]/).map(a => a.trim());
            
            allergenList.forEach(allergen => {
                if (allergen.length > 2 && !allergen.toLowerCase().includes('none')) {
                    allergies.push({
                        allergen: allergen,
                        severity: 'unknown'
                    });
                }
            });
        }
        
        return allergies;
    }

    // Clean empty fields from structured data
    cleanEmptyFields(data) {
        const cleaned = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value) && value.length > 0) {
                cleaned[key] = value;
            } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
                cleaned[key] = value;
            } else if (typeof value === 'string' && value.trim().length > 0) {
                cleaned[key] = value;
            }
        }
        
        return cleaned;
    }

    // Classify document type based on content
    classifyDocumentType(extractedText, providedType) {
        if (providedType && providedType !== 'unknown') return providedType;
        
        const text = extractedText?.toLowerCase() || '';
        
        if (text.includes('lab') || text.includes('laboratory') || text.includes('test result')) {
            return 'lab_result';
        }
        if (text.includes('prescription') || text.includes('medication') || text.includes('rx')) {
            return 'prescription';
        }
        if (text.includes('imaging') || text.includes('x-ray') || text.includes('mri') || text.includes('ct')) {
            return 'imaging';
        }
        if (text.includes('discharge') || text.includes('summary')) {
            return 'discharge_summary';
        }
        if (text.includes('referral') || text.includes('refer')) {
            return 'referral';
        }
        
        return 'other';
    }

    // Assess medical relevance of extracted data
    assessMedicalRelevance(extractedData) {
        if (!extractedData) return 'low';
        
        const relevanceFactors = [
            extractedData.medications?.length || 0,
            extractedData.diagnoses?.length || 0,
            extractedData.procedures?.length || 0,
            extractedData.labResults?.length || 0,
            extractedData.vitalSigns ? 1 : 0
        ];
        
        const totalFactors = relevanceFactors.reduce((sum, factor) => sum + factor, 0);
        
        if (totalFactors >= 5) return 'high';
        if (totalFactors >= 2) return 'medium';
        return 'low';
    }

    // Assess text quality
    assessTextQuality(extractedText) {
        if (!extractedText) return 'poor';
        
        const length = extractedText.length;
        const words = extractedText.split(/\s+/).length;
        const avgWordLength = length / words;
        
        if (avgWordLength > 4 && words > 50) return 'excellent';
        if (avgWordLength > 3 && words > 20) return 'good';
        if (words > 10) return 'fair';
        return 'poor';
    }
}

const documentParsers = new DocumentParsers();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('documentParsers', () => documentParsers);
}

module.exports = documentParsers;