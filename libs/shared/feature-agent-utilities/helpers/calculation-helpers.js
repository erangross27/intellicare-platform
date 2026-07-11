// Calculation Helper Utilities
// Provides mathematical calculation utilities for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class CalculationHelpers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('calculation-helpers');
    }

    // Calculate age from birth date
    calculateAge(dateOfBirth) {
        if (!dateOfBirth) return null;
        
        const birth = new Date(dateOfBirth);
        if (isNaN(birth.getTime())) return null;
        
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }

    // Calculate BMI
    calculateBMI(weight, height, weightUnit = 'kg', heightUnit = 'cm') {
        if (!weight || !height || weight <= 0 || height <= 0) return null;
        
        // Convert to standard units (kg and meters)
        let weightKg = weight;
        let heightM = height;
        
        // Convert weight to kg
        if (weightUnit === 'lbs' || weightUnit === 'pounds') {
            weightKg = weight * 0.453592;
        }
        
        // Convert height to meters
        if (heightUnit === 'cm') {
            heightM = height / 100;
        } else if (heightUnit === 'in' || heightUnit === 'inches') {
            heightM = height * 0.0254;
        } else if (heightUnit === 'ft' || heightUnit === 'feet') {
            heightM = height * 0.3048;
        }
        
        const bmi = weightKg / (heightM * heightM);
        return Math.round(bmi * 10) / 10; // Round to 1 decimal place
    }

    // Get BMI category
    getBMICategory(bmi) {
        if (bmi < 18.5) return 'underweight';
        if (bmi < 25) return 'normal';
        if (bmi < 30) return 'overweight';
        return 'obese';
    }

    // Calculate ideal body weight (Devine formula)
    calculateIdealBodyWeight(height, gender, heightUnit = 'cm') {
        if (!height || height <= 0) return null;
        
        let heightCm = height;
        
        // Convert height to cm
        if (heightUnit === 'in' || heightUnit === 'inches') {
            heightCm = height * 2.54;
        } else if (heightUnit === 'ft' || heightUnit === 'feet') {
            heightCm = height * 30.48;
        }
        
        // Devine formula
        const heightInches = heightCm / 2.54;
        
        if (gender?.toLowerCase() === 'male' || gender?.toLowerCase() === 'm') {
            return 50 + 2.3 * (heightInches - 60);
        } else {
            return 45.5 + 2.3 * (heightInches - 60);
        }
    }

    // Calculate body surface area (BSA) using Mosteller formula
    calculateBSA(weight, height, weightUnit = 'kg', heightUnit = 'cm') {
        if (!weight || !height || weight <= 0 || height <= 0) return null;
        
        // Convert to standard units
        let weightKg = weight;
        let heightCm = height;
        
        if (weightUnit === 'lbs') {
            weightKg = weight * 0.453592;
        }
        
        if (heightUnit === 'in') {
            heightCm = height * 2.54;
        }
        
        // Mosteller formula: BSA = sqrt((height(cm) × weight(kg)) / 3600)
        const bsa = Math.sqrt((heightCm * weightKg) / 3600);
        return Math.round(bsa * 100) / 100; // Round to 2 decimal places
    }

    // Calculate creatinine clearance (Cockcroft-Gault equation)
    calculateCreatinineClearance(age, weight, gender, creatinine, weightUnit = 'kg') {
        if (!age || !weight || !creatinine || age <= 0 || weight <= 0 || creatinine <= 0) return null;
        
        let weightKg = weight;
        if (weightUnit === 'lbs') {
            weightKg = weight * 0.453592;
        }
        
        // Cockcroft-Gault equation
        let ccr = ((140 - age) * weightKg) / (72 * creatinine);
        
        // Multiply by 0.85 for females
        if (gender?.toLowerCase() === 'female' || gender?.toLowerCase() === 'f') {
            ccr *= 0.85;
        }
        
        return Math.round(ccr * 100) / 100;
    }

    // Calculate estimated glomerular filtration rate (eGFR) using CKD-EPI equation
    calculateEGFR(age, gender, race, creatinine) {
        if (!age || !creatinine || age <= 0 || creatinine <= 0) return null;
        
        const isFemale = gender?.toLowerCase() === 'female' || gender?.toLowerCase() === 'f';
        const isBlack = race?.toLowerCase().includes('black') || race?.toLowerCase().includes('african');
        
        let eGFR;
        
        if (isFemale) {
            if (creatinine <= 0.7) {
                eGFR = 144 * Math.pow(creatinine / 0.7, -0.329) * Math.pow(0.993, age);
            } else {
                eGFR = 144 * Math.pow(creatinine / 0.7, -1.209) * Math.pow(0.993, age);
            }
        } else {
            if (creatinine <= 0.9) {
                eGFR = 141 * Math.pow(creatinine / 0.9, -0.411) * Math.pow(0.993, age);
            } else {
                eGFR = 141 * Math.pow(creatinine / 0.9, -1.209) * Math.pow(0.993, age);
            }
        }
        
        if (isBlack) {
            eGFR *= 1.159;
        }
        
        return Math.round(eGFR * 100) / 100;
    }

    // Calculate mean arterial pressure
    calculateMAP(systolic, diastolic) {
        if (!systolic || !diastolic || systolic <= 0 || diastolic <= 0) return null;
        
        const map = diastolic + (systolic - diastolic) / 3;
        return Math.round(map * 10) / 10;
    }

    // Calculate pulse pressure
    calculatePulsePressure(systolic, diastolic) {
        if (!systolic || !diastolic || systolic <= 0 || diastolic <= 0) return null;
        
        return systolic - diastolic;
    }

    // Calculate medication dosage based on weight
    calculateWeightBasedDosage(weight, dosagePerKg, weightUnit = 'kg') {
        if (!weight || !dosagePerKg || weight <= 0 || dosagePerKg <= 0) return null;
        
        let weightKg = weight;
        if (weightUnit === 'lbs') {
            weightKg = weight * 0.453592;
        }
        
        return weightKg * dosagePerKg;
    }

    // Calculate medication dosage based on BSA
    calculateBSABasedDosage(weight, height, dosagePerM2, weightUnit = 'kg', heightUnit = 'cm') {
        const bsa = this.calculateBSA(weight, height, weightUnit, heightUnit);
        if (!bsa || !dosagePerM2 || dosagePerM2 <= 0) return null;
        
        return bsa * dosagePerM2;
    }

    // Calculate percentage change
    calculatePercentageChange(oldValue, newValue) {
        if (oldValue === 0 || oldValue === null || oldValue === undefined) return null;
        if (newValue === null || newValue === undefined) return null;
        
        const change = ((newValue - oldValue) / oldValue) * 100;
        return Math.round(change * 100) / 100;
    }

    // Calculate average from array
    calculateAverage(values) {
        if (!Array.isArray(values) || values.length === 0) return null;
        
        const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (validValues.length === 0) return null;
        
        const sum = validValues.reduce((acc, val) => acc + val, 0);
        return Math.round((sum / validValues.length) * 100) / 100;
    }

    // Calculate standard deviation
    calculateStandardDeviation(values) {
        const avg = this.calculateAverage(values);
        if (avg === null) return null;
        
        const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        
        const squaredDifferences = validValues.map(value => Math.pow(value - avg, 2));
        const avgSquaredDifference = this.calculateAverage(squaredDifferences);
        
        return Math.sqrt(avgSquaredDifference);
    }

    // Calculate confidence interval
    calculateConfidenceInterval(values, confidenceLevel = 0.95) {
        const avg = this.calculateAverage(values);
        const std = this.calculateStandardDeviation(values);
        
        if (avg === null || std === null) return null;
        
        const n = values.length;
        const zScore = confidenceLevel === 0.95 ? 1.96 : 2.58; // 95% or 99%
        const margin = zScore * (std / Math.sqrt(n));
        
        return {
            lower: avg - margin,
            upper: avg + margin,
            average: avg
        };
    }

    // Round to specified decimal places
    roundToDecimal(value, decimals = 2) {
        if (typeof value !== 'number' || isNaN(value)) return value;
        
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    // Convert units
    convertUnits(value, fromUnit, toUnit, category = 'weight') {
        if (typeof value !== 'number' || isNaN(value)) return null;
        
        const conversions = {
            weight: {
                'kg_lbs': 2.20462,
                'lbs_kg': 0.453592,
                'g_oz': 0.035274,
                'oz_g': 28.3495
            },
            length: {
                'cm_in': 0.393701,
                'in_cm': 2.54,
                'ft_cm': 30.48,
                'cm_ft': 0.0328084,
                'm_ft': 3.28084,
                'ft_m': 0.3048
            },
            temperature: {
                'c_f': (c) => (c * 9/5) + 32,
                'f_c': (f) => (f - 32) * 5/9
            }
        };
        
        const conversionKey = `${fromUnit}_${toUnit}`;
        const categoryConversions = conversions[category];
        
        if (!categoryConversions) return null;
        
        if (typeof categoryConversions[conversionKey] === 'function') {
            return categoryConversions[conversionKey](value);
        } else if (categoryConversions[conversionKey]) {
            return value * categoryConversions[conversionKey];
        }
        
        return null;
    }
}

// Register with service proxy
const calculationHelpersInstance = new CalculationHelpers();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('calculationHelpers', () => calculationHelpersInstance);
}

module.exports = calculationHelpersInstance;