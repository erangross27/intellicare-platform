// Medical Data Formatting Utilities
// Provides medical data formatting for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class MedicalFormatters {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('medical-formatters');
    }

    // Format vital signs for display
    formatVitalSigns(vitalSigns) {
        if (!vitalSigns || typeof vitalSigns !== 'object') return '';
        
        const formatted = [];
        
        if (vitalSigns.bloodPressure) {
            const bp = vitalSigns.bloodPressure;
            if (bp.systolic && bp.diastolic) {
                formatted.push(`BP: ${bp.systolic}/${bp.diastolic} mmHg`);
            }
        }
        
        if (vitalSigns.heartRate) {
            formatted.push(`HR: ${vitalSigns.heartRate} bpm`);
        }
        
        if (vitalSigns.temperature) {
            const temp = vitalSigns.temperature;
            if (typeof temp === 'object' && temp.value) {
                formatted.push(`Temp: ${temp.value}°${temp.unit || 'F'}`);
            } else {
                formatted.push(`Temp: ${temp}°F`);
            }
        }
        
        if (vitalSigns.respiratoryRate) {
            formatted.push(`RR: ${vitalSigns.respiratoryRate}/min`);
        }
        
        if (vitalSigns.oxygenSaturation) {
            formatted.push(`O2 Sat: ${vitalSigns.oxygenSaturation}%`);
        }
        
        return formatted.join(', ');
    }

    // Format medication for display
    formatMedication(medication) {
        if (!medication || typeof medication !== 'object') return '';
        
        const parts = [];
        
        if (medication.medicationName || medication.name) {
            parts.push(medication.medicationName || medication.name);
        }
        
        if (medication.dosage) {
            let dosage = medication.dosage;
            if (medication.dosageUnit || medication.unit) {
                dosage += medication.dosageUnit || medication.unit;
            }
            parts.push(dosage);
        }
        
        if (medication.frequency) {
            parts.push(medication.frequency);
        }
        
        if (medication.route) {
            parts.push(`(${medication.route})`);
        }
        
        return parts.join(' ');
    }

    // Format lab result for display
    formatLabResult(labResult) {
        if (!labResult || typeof labResult !== 'object') return '';
        
        const parts = [];
        
        if (labResult.testType || labResult.test) {
            parts.push(labResult.testType || labResult.test);
        }
        
        if (labResult.value !== undefined) {
            let value = labResult.value;
            if (labResult.unit) {
                value += ` ${labResult.unit}`;
            }
            parts.push(value);
        }
        
        // Add abnormal flags
        if (labResult.abnormalFlags && labResult.abnormalFlags.length > 0) {
            parts.push(`(${labResult.abnormalFlags.join(', ')})`);
        }
        
        return parts.join(': ');
    }

    // Format allergy for display
    formatAllergy(allergy) {
        if (!allergy || typeof allergy !== 'object') return '';
        
        let formatted = allergy.allergen || allergy.name || '';
        
        if (allergy.severity) {
            formatted += ` (${allergy.severity})`;
        }
        
        if (allergy.reaction) {
            formatted += ` - ${allergy.reaction}`;
        }
        
        return formatted;
    }

    // Format diagnosis for display
    formatDiagnosis(diagnosis) {
        if (!diagnosis || typeof diagnosis !== 'object') return '';
        
        const parts = [];
        
        if (diagnosis.description) {
            parts.push(diagnosis.description);
        }
        
        if (diagnosis.icdCode || diagnosis.code) {
            parts.push(`(${diagnosis.icdCode || diagnosis.code})`);
        }
        
        if (diagnosis.status && diagnosis.status !== 'active') {
            parts.push(`[${diagnosis.status}]`);
        }
        
        return parts.join(' ');
    }

    // Format BMI with category
    formatBMIWithCategory(bmi) {
        if (!bmi || isNaN(bmi)) return '';
        
        const category = this.getBMICategory(bmi);
        return `${bmi} (${category})`;
    }

    // Get BMI category
    getBMICategory(bmi) {
        if (bmi < 18.5) return 'Underweight';
        if (bmi < 25) return 'Normal weight';
        if (bmi < 30) return 'Overweight';
        return 'Obese';
    }

    // Format medical record number
    formatMRN(mrn) {
        if (!mrn) return mrn;
        
        // Common MRN formatting: XXXXXX-XX or XXX-XX-XXXX
        const cleaned = mrn.toString().replace(/\D/g, '');
        
        if (cleaned.length === 8) {
            return `${cleaned.slice(0, 6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length === 9) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
        }
        
        return mrn;
    }

    // Format date of birth with age
    formatDOBWithAge(dateOfBirth) {
        if (!dateOfBirth) return '';
        
        const dob = new Date(dateOfBirth);
        if (isNaN(dob.getTime())) return dateOfBirth;
        
        const age = this.calculateAge(dateOfBirth);
        const formattedDate = dob.toLocaleDateString();
        
        return `${formattedDate} (age ${age})`;
    }

    // Calculate age from date of birth
    calculateAge(dateOfBirth) {
        const birth = new Date(dateOfBirth);
        const today = new Date();
        
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }

    // Format appointment duration
    formatAppointmentDuration(minutes) {
        if (!minutes || minutes <= 0) return '';
        
        if (minutes < 60) {
            return `${minutes} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            
            if (remainingMinutes === 0) {
                return `${hours} hr`;
            } else {
                return `${hours}h ${remainingMinutes}m`;
            }
        }
    }

    // Format patient summary
    formatPatientSummary(patient) {
        if (!patient) return '';
        
        const parts = [];
        
        if (patient.firstName && patient.lastName) {
            parts.push(`${patient.firstName} ${patient.lastName}`);
        }
        
        if (patient.dateOfBirth) {
            const age = this.calculateAge(patient.dateOfBirth);
            parts.push(`Age ${age}`);
        }
        
        if (patient.gender) {
            parts.push(patient.gender);
        }
        
        if (patient.mrn) {
            parts.push(`MRN: ${this.formatMRN(patient.mrn)}`);
        }
        
        return parts.join(', ');
    }
}

// Register with service proxy
const medicalFormattersInstance = new MedicalFormatters();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('medicalFormatters', () => medicalFormattersInstance);
}

module.exports = medicalFormattersInstance;