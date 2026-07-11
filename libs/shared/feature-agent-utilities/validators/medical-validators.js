// Medical Data Validation Utilities
// Provides medical-specific validation for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class MedicalValidators {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('medical-validators');
    }

    // Validate blood pressure reading
    validateBloodPressure(systolic, diastolic) {
        const sys = parseInt(systolic);
        const dia = parseInt(diastolic);
        
        if (isNaN(sys) || isNaN(dia)) {
            throw new Error('Blood pressure values must be numbers');
        }
        
        if (sys < 50 || sys > 300) {
            throw new Error('Systolic pressure must be between 50 and 300 mmHg');
        }
        
        if (dia < 30 || dia > 200) {
            throw new Error('Diastolic pressure must be between 30 and 200 mmHg');
        }
        
        if (sys <= dia) {
            throw new Error('Systolic pressure must be higher than diastolic pressure');
        }
        
        return true;
    }

    // Validate heart rate
    validateHeartRate(heartRate) {
        const hr = parseInt(heartRate);
        
        if (isNaN(hr)) {
            throw new Error('Heart rate must be a number');
        }
        
        if (hr < 30 || hr > 300) {
            throw new Error('Heart rate must be between 30 and 300 bpm');
        }
        
        return true;
    }

    // Validate temperature
    validateTemperature(temperature, unit = 'C') {
        const temp = parseFloat(temperature);
        
        if (isNaN(temp)) {
            throw new Error('Temperature must be a number');
        }
        
        if (unit === 'C') {
            if (temp < 30 || temp > 50) {
                throw new Error('Temperature must be between 30 and 50 degrees Celsius');
            }
        } else if (unit === 'F') {
            if (temp < 86 || temp > 122) {
                throw new Error('Temperature must be between 86 and 122 degrees Fahrenheit');
            }
        } else {
            throw new Error('Temperature unit must be C or F');
        }
        
        return true;
    }

    // Validate height
    validateHeight(height, unit = 'cm') {
        const h = parseFloat(height);
        
        if (isNaN(h)) {
            throw new Error('Height must be a number');
        }
        
        if (unit === 'cm') {
            if (h < 30 || h > 300) {
                throw new Error('Height must be between 30 and 300 cm');
            }
        } else if (unit === 'in') {
            if (h < 12 || h > 120) {
                throw new Error('Height must be between 12 and 120 inches');
            }
        } else {
            throw new Error('Height unit must be cm or in');
        }
        
        return true;
    }

    // Validate weight
    validateWeight(weight, unit = 'kg') {
        const w = parseFloat(weight);
        
        if (isNaN(w)) {
            throw new Error('Weight must be a number');
        }
        
        if (unit === 'kg') {
            if (w < 0.5 || w > 500) {
                throw new Error('Weight must be between 0.5 and 500 kg');
            }
        } else if (unit === 'lbs') {
            if (w < 1 || w > 1100) {
                throw new Error('Weight must be between 1 and 1100 lbs');
            }
        } else {
            throw new Error('Weight unit must be kg or lbs');
        }
        
        return true;
    }

    // Validate BMI
    validateBMI(bmi) {
        const b = parseFloat(bmi);
        
        if (isNaN(b)) {
            throw new Error('BMI must be a number');
        }
        
        if (b < 10 || b > 80) {
            throw new Error('BMI must be between 10 and 80');
        }
        
        return true;
    }

    // Validate medication dosage
    validateMedicationDosage(dosage, unit) {
        if (!dosage) {
            throw new Error('Dosage is required');
        }
        
        const dose = parseFloat(dosage);
        if (isNaN(dose) || dose <= 0) {
            throw new Error('Dosage must be a positive number');
        }
        
        if (!unit) {
            throw new Error('Dosage unit is required');
        }
        
        const validUnits = ['mg', 'g', 'mcg', 'ml', 'l', 'units', 'tablets', 'capsules'];
        if (!validUnits.includes(unit.toLowerCase())) {
            throw new Error(`Invalid dosage unit. Must be one of: ${validUnits.join(', ')}`);
        }
        
        return true;
    }

    // Validate lab result value
    validateLabValue(value, testType, normalRange) {
        const val = parseFloat(value);
        
        if (isNaN(val)) {
            throw new Error('Lab value must be a number');
        }
        
        // Check if value is within reasonable bounds for the test type
        const testBounds = this.getTestBounds(testType);
        if (testBounds && (val < testBounds.min || val > testBounds.max)) {
            throw new Error(`${testType} value ${val} is outside reasonable bounds (${testBounds.min}-${testBounds.max})`);
        }
        
        return true;
    }

    // Get reasonable bounds for different test types
    getTestBounds(testType) {
        const bounds = {
            'glucose': { min: 20, max: 800 },
            'cholesterol': { min: 50, max: 1000 },
            'triglycerides': { min: 20, max: 2000 },
            'hemoglobin': { min: 3, max: 25 },
            'hematocrit': { min: 10, max: 70 },
            'creatinine': { min: 0.1, max: 20 },
            'bun': { min: 2, max: 200 },
            'sodium': { min: 100, max: 200 },
            'potassium': { min: 1, max: 10 },
            'chloride': { min: 80, max: 130 }
        };
        
        return bounds[testType.toLowerCase()];
    }

    // Validate allergy severity
    validateAllergySeverity(severity) {
        if (!severity) {
            throw new Error('Allergy severity is required');
        }
        
        const validSeverities = ['mild', 'moderate', 'severe', 'life-threatening'];
        if (!validSeverities.includes(severity.toLowerCase())) {
            throw new Error(`Invalid allergy severity. Must be one of: ${validSeverities.join(', ')}`);
        }
        
        return true;
    }

    // Validate ICD-10 code
    validateICD10Code(code) {
        if (!code) {
            throw new Error('ICD-10 code is required');
        }
        
        // Basic ICD-10 format validation (simplified)
        const icd10Regex = /^[A-Z]\d{2}(\.[0-9A-Z]{1,4})?$/;
        if (!icd10Regex.test(code)) {
            throw new Error('Invalid ICD-10 code format');
        }
        
        return true;
    }

    // Validate medication frequency
    validateMedicationFrequency(frequency) {
        if (!frequency) {
            throw new Error('Medication frequency is required');
        }
        
        const validFrequencies = [
            'once daily', 'twice daily', 'three times daily', 'four times daily',
            'every 4 hours', 'every 6 hours', 'every 8 hours', 'every 12 hours',
            'as needed', 'prn', 'daily', 'weekly', 'monthly'
        ];
        
        const freqLower = frequency.toLowerCase();
        if (!validFrequencies.some(valid => freqLower.includes(valid))) {
            throw new Error('Invalid medication frequency');
        }
        
        return true;
    }

    // Validate vital signs collectively
    validateVitalSigns(vitals) {
        if (!vitals || typeof vitals !== 'object') {
            throw new Error('Vital signs must be an object');
        }
        
        if (vitals.systolic && vitals.diastolic) {
            this.validateBloodPressure(vitals.systolic, vitals.diastolic);
        }
        
        if (vitals.heartRate) {
            this.validateHeartRate(vitals.heartRate);
        }
        
        if (vitals.temperature) {
            this.validateTemperature(vitals.temperature, vitals.temperatureUnit);
        }
        
        return true;
    }

    // Validate prescription data
    validatePrescription(prescription) {
        if (!prescription || typeof prescription !== 'object') {
            throw new Error('Prescription must be an object');
        }
        
        const required = ['medicationName', 'dosage', 'frequency'];
        for (const field of required) {
            if (!prescription[field]) {
                throw new Error(`Prescription missing required field: ${field}`);
            }
        }
        
        this.validateMedicationDosage(prescription.dosage, prescription.dosageUnit);
        this.validateMedicationFrequency(prescription.frequency);
        
        return true;
    }
}

// Create and export singleton
const medicalValidators = new MedicalValidators();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('medicalValidators', () => medicalValidators);
}

module.exports = medicalValidators;