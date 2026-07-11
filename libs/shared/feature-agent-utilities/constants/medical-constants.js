// Medical Constants
// Provides medical constants and reference values for AgentServiceV4

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/shared/feature-agent-utilities/ files (4 levels deep)
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class MedicalConstants {
    constructor() {
        this.serviceToken = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('medical-constants');
        this.initialized = true;
    }

    // Vital Signs Normal Ranges
    getVitalSignsRanges() {
        return {
            bloodPressure: {
                systolic: { min: 90, max: 140, unit: 'mmHg' },
                diastolic: { min: 60, max: 90, unit: 'mmHg' }
            },
            heartRate: {
                adult: { min: 60, max: 100, unit: 'bpm' },
                child: { min: 70, max: 120, unit: 'bpm' },
                infant: { min: 100, max: 160, unit: 'bpm' }
            },
            temperature: {
                celsius: { min: 36.1, max: 37.2, unit: '°C' },
                fahrenheit: { min: 97, max: 99, unit: '°F' }
            },
            respiratoryRate: {
                adult: { min: 12, max: 20, unit: '/min' },
                child: { min: 20, max: 30, unit: '/min' },
                infant: { min: 30, max: 60, unit: '/min' }
            },
            oxygenSaturation: {
                normal: { min: 95, max: 100, unit: '%' },
                critical: { min: 0, max: 90, unit: '%' }
            }
        };
    }

    // Lab Test Reference Ranges
    getLabReferenceRanges() {
        return {
            glucose: {
                fasting: { min: 70, max: 100, unit: 'mg/dL' },
                random: { min: 70, max: 140, unit: 'mg/dL' },
                postPrandial: { min: 70, max: 140, unit: 'mg/dL' }
            },
            cholesterol: {
                total: { min: 0, max: 200, unit: 'mg/dL' },
                ldl: { min: 0, max: 100, unit: 'mg/dL' },
                hdl: { 
                    male: { min: 40, max: 200, unit: 'mg/dL' },
                    female: { min: 50, max: 200, unit: 'mg/dL' }
                },
                triglycerides: { min: 0, max: 150, unit: 'mg/dL' }
            },
            completeBloodCount: {
                hemoglobin: {
                    male: { min: 13.8, max: 17.2, unit: 'g/dL' },
                    female: { min: 12.1, max: 15.1, unit: 'g/dL' }
                },
                hematocrit: {
                    male: { min: 40.7, max: 50.3, unit: '%' },
                    female: { min: 36.1, max: 44.3, unit: '%' }
                },
                whiteBloodCells: { min: 3.5, max: 10.5, unit: '10³/µL' },
                platelets: { min: 150, max: 450, unit: '10³/µL' }
            },
            kidneyFunction: {
                creatinine: {
                    male: { min: 0.74, max: 1.35, unit: 'mg/dL' },
                    female: { min: 0.59, max: 1.04, unit: 'mg/dL' }
                },
                bun: { min: 6, max: 24, unit: 'mg/dL' },
                gfr: { min: 90, max: 200, unit: 'mL/min/1.73m²' }
            },
            liverFunction: {
                alt: { min: 7, max: 56, unit: 'U/L' },
                ast: { min: 10, max: 40, unit: 'U/L' },
                bilirubin: {
                    total: { min: 0.3, max: 1.2, unit: 'mg/dL' },
                    direct: { min: 0, max: 0.3, unit: 'mg/dL' }
                }
            },
            electrolytes: {
                sodium: { min: 136, max: 145, unit: 'mmol/L' },
                potassium: { min: 3.5, max: 5.1, unit: 'mmol/L' },
                chloride: { min: 98, max: 107, unit: 'mmol/L' },
                co2: { min: 22, max: 29, unit: 'mmol/L' }
            }
        };
    }

    // BMI Categories
    getBMICategories() {
        return {
            underweight: { min: 0, max: 18.5 },
            normal: { min: 18.5, max: 24.9 },
            overweight: { min: 25, max: 29.9 },
            obese: { min: 30, max: 100 }
        };
    }

    // Medication Frequency Codes
    getMedicationFrequencies() {
        return {
            'QD': { description: 'Once daily', timesPerDay: 1 },
            'BID': { description: 'Twice daily', timesPerDay: 2 },
            'TID': { description: 'Three times daily', timesPerDay: 3 },
            'QID': { description: 'Four times daily', timesPerDay: 4 },
            'Q4H': { description: 'Every 4 hours', timesPerDay: 6 },
            'Q6H': { description: 'Every 6 hours', timesPerDay: 4 },
            'Q8H': { description: 'Every 8 hours', timesPerDay: 3 },
            'Q12H': { description: 'Every 12 hours', timesPerDay: 2 },
            'PRN': { description: 'As needed', timesPerDay: null },
            'QHS': { description: 'At bedtime', timesPerDay: 1 },
            'QAM': { description: 'Every morning', timesPerDay: 1 },
            'QPM': { description: 'Every evening', timesPerDay: 1 },
            'QWeek': { description: 'Once weekly', timesPerDay: 1/7 },
            'QMonth': { description: 'Once monthly', timesPerDay: 1/30 }
        };
    }

    // Medical Specialties
    getMedicalSpecialties() {
        return [
            'Family Medicine',
            'Internal Medicine', 
            'Pediatrics',
            'Cardiology',
            'Dermatology',
            'Endocrinology',
            'Gastroenterology',
            'Hematology',
            'Nephrology',
            'Neurology',
            'Oncology',
            'Pulmonology',
            'Rheumatology',
            'Urology',
            'Gynecology',
            'Obstetrics',
            'Orthopedics',
            'Ophthalmology',
            'Otolaryngology',
            'Surgery',
            'Anesthesiology',
            'Emergency Medicine',
            'Radiology',
            'Pathology',
            'Psychiatry',
            'Physical Medicine',
            'Preventive Medicine'
        ];
    }

    // Allergy Severity Levels
    getAllergySeverityLevels() {
        return {
            mild: { score: 1, description: 'Mild reaction' },
            moderate: { score: 2, description: 'Moderate reaction' },
            severe: { score: 3, description: 'Severe reaction' },
            'life-threatening': { score: 4, description: 'Life-threatening reaction' }
        };
    }

    // Common Allergen Categories
    getAllergenCategories() {
        return {
            food: [
                'Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Wheat', 
                'Soy', 'Fish', 'Shellfish', 'Sesame', 'Gluten'
            ],
            drug: [
                'Penicillin', 'Sulfa', 'Aspirin', 'NSAIDs', 
                'Codeine', 'Morphine', 'Latex', 'Contrast dye'
            ],
            environmental: [
                'Pollen', 'Dust mites', 'Mold', 'Pet dander', 
                'Grass', 'Tree pollen', 'Ragweed'
            ],
            contact: [
                'Nickel', 'Latex', 'Fragrances', 'Preservatives',
                'Adhesives', 'Rubber', 'Poison ivy'
            ]
        };
    }

    // Pain Scale
    getPainScale() {
        return {
            0: 'No pain',
            1: 'Mild pain',
            2: 'Mild pain',
            3: 'Moderate pain',
            4: 'Moderate pain',
            5: 'Moderate pain',
            6: 'Severe pain',
            7: 'Severe pain',
            8: 'Very severe pain',
            9: 'Very severe pain',
            10: 'Worst possible pain'
        };
    }

    // Emergency Vital Signs Thresholds
    getEmergencyThresholds() {
        return {
            bloodPressure: {
                systolicHigh: 180,
                systolicLow: 90,
                diastolicHigh: 110,
                diastolicLow: 60
            },
            heartRate: {
                tachycardia: 100,
                bradycardia: 60
            },
            temperature: {
                fever: 38.3, // Celsius
                hypothermia: 35.0 // Celsius
            },
            oxygenSaturation: {
                critical: 90
            }
        };
    }

    // Common Medical Abbreviations
    getMedicalAbbreviations() {
        return {
            'BP': 'Blood Pressure',
            'HR': 'Heart Rate',
            'RR': 'Respiratory Rate',
            'T': 'Temperature',
            'O2 Sat': 'Oxygen Saturation',
            'CBC': 'Complete Blood Count',
            'CMP': 'Comprehensive Metabolic Panel',
            'BUN': 'Blood Urea Nitrogen',
            'Cr': 'Creatinine',
            'GFR': 'Glomerular Filtration Rate',
            'ALT': 'Alanine Aminotransferase',
            'AST': 'Aspartate Aminotransferase',
            'BMI': 'Body Mass Index',
            'HTN': 'Hypertension',
            'DM': 'Diabetes Mellitus',
            'CAD': 'Coronary Artery Disease',
            'CHF': 'Congestive Heart Failure',
            'COPD': 'Chronic Obstructive Pulmonary Disease',
            'URI': 'Upper Respiratory Infection',
            'UTI': 'Urinary Tract Infection',
            'DVT': 'Deep Vein Thrombosis',
            'PE': 'Pulmonary Embolism'
        };
    }
}

// Create singleton instance
const medicalConstants = new MedicalConstants();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('medicalConstants', () => medicalConstants);
}

module.exports = medicalConstants;