/**
 * Prescription Generator Service
 * Generates prescriptions with proper dosing, SIG writing, and safety checks
 * ⚠️ CRITICAL: Prescription generation affecting patient treatment
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PrescriptionGenerator {
  constructor() {
    this.initialized = false;
    // Standard dosing by age/weight
    this.pediatricDosing = {
      'amoxicillin': { dose: 25, unit: 'mg/kg', frequency: 'TID', max: 500 },
      'azithromycin': { dose: 10, unit: 'mg/kg', frequency: 'daily', max: 500 },
      'ibuprofen': { dose: 10, unit: 'mg/kg', frequency: 'q6h', max: 400 },
      'acetaminophen': { dose: 15, unit: 'mg/kg', frequency: 'q4-6h', max: 650 },
      'cephalexin': { dose: 25, unit: 'mg/kg', frequency: 'QID', max: 500 },
      'prednisolone': { dose: 1, unit: 'mg/kg', frequency: 'daily', max: 60 }
    };

    // Renal dosing adjustments
    this.renalAdjustments = {
      'metformin': {
        '30-45': { dose: '50%', frequency: 'same' },
        '<30': { dose: 'contraindicated', frequency: 'N/A' }
      },
      'gabapentin': {
        '30-59': { dose: '200-700mg', frequency: 'BID' },
        '15-29': { dose: '200-700mg', frequency: 'daily' },
        '<15': { dose: '100-300mg', frequency: 'daily' }
      },
      'ciprofloxacin': {
        '30-50': { dose: '250-500mg', frequency: 'q12h' },
        '<30': { dose: '250-500mg', frequency: 'q18h' }
      }
    };

    // Common SIG translations
    this.sigCodes = {
      'PO': 'by mouth',
      'QD': 'once daily',
      'BID': 'twice daily',
      'TID': 'three times daily',
      'QID': 'four times daily',
      'q4h': 'every 4 hours',
      'q6h': 'every 6 hours',
      'q8h': 'every 8 hours',
      'q12h': 'every 12 hours',
      'PRN': 'as needed',
      'AC': 'before meals',
      'PC': 'after meals',
      'HS': 'at bedtime',
      'STAT': 'immediately'
    };

    // Drug formulations
    this.formulations = {
      'amoxicillin': ['capsule', 'tablet', 'suspension'],
      'azithromycin': ['tablet', 'suspension', 'packet'],
      'ibuprofen': ['tablet', 'suspension', 'chewable'],
      'metformin': ['tablet', 'tablet ER'],
      'lisinopril': ['tablet'],
      'atorvastatin': ['tablet'],
      'albuterol': ['inhaler', 'nebulizer', 'tablet'],
      'insulin': ['vial', 'pen', 'cartridge']
    };

    // Duration recommendations
    this.standardDurations = {
      'antibiotic_uti': 3,
      'antibiotic_strep': 10,
      'antibiotic_pneumonia': 7,
      'antibiotic_skin': 7,
      'antiviral_flu': 5,
      'steroid_asthma': 5,
      'steroid_poison_ivy': 12,
      'ppi_gerd': 56,
      'nsaid_pain': 7
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const secureConfigService = proxy.getService('secureConfigService');
      
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('prescription-generator');
      
      // Initialize secure config service
      await secureConfigService.initialize();
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'prescriptionGenerator',
        timestamp: new Date()
      }, {
        serviceId: 'prescription-generator',
        operation: 'initialize',
        practiceId: 'global'
      });
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize PrescriptionGenerator: ${error.message}`);
    }
  }

  // Helper methods for service access - CRITICAL for prescription safety operations
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  getSecureConfigService() {
    return getServiceProxy().getService('secureConfigService');
  }

  getDrugInteractionService() {
    return getServiceProxy().getService('drugInteractionService');
  }

  /**
   * Generate a complete prescription
   */
  async generatePrescription(medicationData, patientData, prescriber) {
    await this.initialize();

    const prescription = {
      id: this.generateRxNumber(),
      date: new Date(),
      patient: {
        name: patientData.name,
        dob: patientData.dateOfBirth,
        age: this.calculateAge(patientData.dateOfBirth),
        weight: patientData.weight,
        allergies: patientData.allergies || []
      },
      prescriber: {
        name: prescriber.name,
        license: prescriber.licenseNumber,
        dea: prescriber.deaNumber || null
      },
      medication: {
        name: medicationData.drug,
        genericName: this.getGenericName(medicationData.drug),
        strength: '',
        formulation: '',
        quantity: 0,
        refills: 0,
        sig: '',
        daw: false,
        indication: medicationData.indication || ''
      },
      safety: {
        interactions: [],
        allergies: [],
        warnings: []
      }
    };

    // Calculate dosing
    const dosing = this.calculateDosing(
      medicationData.drug,
      patientData,
      medicationData.indication
    );

    prescription.medication.strength = dosing.strength;
    prescription.medication.formulation = dosing.formulation;

    // Generate SIG
    prescription.medication.sig = this.generateSIG(
      dosing,
      medicationData.route || 'PO',
      medicationData.frequency,
      medicationData.instructions
    );

    // Calculate quantity
    const duration = medicationData.duration || 
                    this.getStandardDuration(medicationData.indication);
    prescription.medication.quantity = this.calculateQuantity(
      dosing.frequency,
      duration,
      dosing.amount
    );

    // Determine refills
    prescription.medication.refills = this.determineRefills(
      medicationData.drug,
      medicationData.indication,
      medicationData.controlled
    );

    // Check safety
    prescription.safety = this.performSafetyChecks(
      medicationData.drug,
      patientData
    );

    // Add DEA schedule if controlled
    if (medicationData.controlled) {
      prescription.medication.schedule = this.getDEASchedule(medicationData.drug);
      prescription.requiresDEA = true;
    }

    // Generic substitution
    prescription.medication.daw = medicationData.brandRequired || false;

    return prescription;
  }

  /**
   * Calculate appropriate dosing
   */
  calculateDosing(drug, patientData, indication) {
    const age = this.calculateAge(patientData.dateOfBirth);
    const weight = patientData.weight;
    
    let dosing = {
      amount: '',
      strength: '',
      frequency: '',
      formulation: ''
    };

    // Pediatric dosing (< 18 years)
    if (age < 18 && weight && this.pediatricDosing[drug.toLowerCase()]) {
      const pedDose = this.pediatricDosing[drug.toLowerCase()];
      let calculatedDose = weight * pedDose.dose;
      
      // Don't exceed max dose
      if (pedDose.max && calculatedDose > pedDose.max) {
        calculatedDose = pedDose.max;
      }
      
      dosing.amount = Math.round(calculatedDose);
      dosing.strength = `${dosing.amount}mg`;
      dosing.frequency = pedDose.frequency;
      dosing.formulation = weight < 20 ? 'suspension' : 'tablet';
      
    } else {
      // Adult dosing
      dosing = this.getStandardAdultDosing(drug, indication);
    }

    // Renal adjustments
    if (patientData.eGFR && patientData.eGFR < 60) {
      dosing = this.adjustForRenal(drug, patientData.eGFR, dosing);
    }

    // Elderly adjustments (> 65)
    if (age > 65) {
      dosing = this.adjustForElderly(drug, dosing);
    }

    return dosing;
  }

  /**
   * Get standard adult dosing
   */
  getStandardAdultDosing(drug, indication) {
    const standardDoses = {
      'amoxicillin': { amount: 500, strength: '500mg', frequency: 'TID', formulation: 'capsule' },
      'azithromycin': { amount: 500, strength: '500mg', frequency: 'daily', formulation: 'tablet' },
      'ciprofloxacin': { amount: 500, strength: '500mg', frequency: 'BID', formulation: 'tablet' },
      'lisinopril': { amount: 10, strength: '10mg', frequency: 'daily', formulation: 'tablet' },
      'metformin': { amount: 500, strength: '500mg', frequency: 'BID', formulation: 'tablet' },
      'atorvastatin': { amount: 20, strength: '20mg', frequency: 'daily', formulation: 'tablet' },
      'omeprazole': { amount: 20, strength: '20mg', frequency: 'daily', formulation: 'capsule' },
      'ibuprofen': { amount: 400, strength: '400mg', frequency: 'TID', formulation: 'tablet' },
      'prednisone': { amount: 20, strength: '20mg', frequency: 'daily', formulation: 'tablet' },
      'albuterol': { amount: 2, strength: '90mcg', frequency: 'q4-6h PRN', formulation: 'inhaler' }
    };
    
    return standardDoses[drug.toLowerCase()] || {
      amount: 0,
      strength: 'TBD',
      frequency: 'TBD',
      formulation: 'tablet'
    };
  }

  /**
   * Generate SIG (Signetur - directions for use)
   */
  generateSIG(dosing, route, frequency, instructions) {
    let sig = '';
    
    // Amount and formulation
    if (dosing.formulation === 'inhaler') {
      sig = `Inhale ${dosing.amount} puff(s)`;
    } else if (dosing.formulation === 'suspension') {
      sig = `Take ${dosing.amount}mg (${dosing.amount/125*5}mL)`;
    } else {
      sig = `Take ${dosing.amount === 1 ? 'one' : dosing.amount} ${dosing.formulation}(s)`;
    }
    
    // Route
    sig += ` ${route === 'PO' ? 'by mouth' : route}`;
    
    // Frequency
    const freqText = this.sigCodes[frequency] || frequency;
    sig += ` ${freqText}`;
    
    // Special instructions
    if (instructions) {
      if (instructions.includes('food')) {
        sig += ' with food';
      }
      if (instructions.includes('empty')) {
        sig += ' on empty stomach';
      }
      if (instructions.includes('water')) {
        sig += ' with full glass of water';
      }
    }
    
    return sig;
  }

  /**
   * Calculate quantity to dispense
   */
  calculateQuantity(frequency, durationDays, amountPerDose) {
    const dosesPerDay = {
      'daily': 1,
      'BID': 2,
      'TID': 3,
      'QID': 4,
      'q4h': 6,
      'q6h': 4,
      'q8h': 3,
      'q12h': 2
    };
    
    const dailyDoses = dosesPerDay[frequency] || 1;
    const totalDoses = dailyDoses * durationDays;
    
    // Add 10% overage for inhalers/liquids
    const overage = frequency.includes('PRN') ? 1.3 : 1.1;
    
    return Math.ceil(totalDoses * overage);
  }

  /**
   * Determine number of refills
   */
  determineRefills(drug, indication, controlled) {
    // No refills for controlled substances Schedule II
    if (controlled === 'II') return 0;
    
    // Limited refills for Schedule III-V
    if (controlled === 'III' || controlled === 'IV' || controlled === 'V') {
      return Math.min(5, 6); // Max 6 months
    }
    
    // Antibiotics typically no refills
    if (this.isAntibiotic(drug)) return 0;
    
    // Chronic medications get more refills
    if (this.isChronicMedication(drug)) return 11; // 1 year
    
    // Default
    return 3;
  }

  /**
   * Perform safety checks
   */
  performSafetyChecks(drug, patientData) {
    const safety = {
      interactions: [],
      allergies: [],
      warnings: []
    };
    
    // Check allergies
    if (patientData.allergies) {
      patientData.allergies.forEach(allergy => {
        if (this.checkAllergyConflict(drug, allergy)) {
          safety.allergies.push({
            allergen: allergy,
            severity: 'high',
            message: `Patient allergic to ${allergy}`
          });
        }
      });
    }
    
    // Check pregnancy category
    if (patientData.pregnant) {
      const category = this.getPregnancyCategory(drug);
      if (category === 'X' || category === 'D') {
        safety.warnings.push({
          type: 'pregnancy',
          severity: 'high',
          message: `Category ${category} - ${category === 'X' ? 'Contraindicated' : 'Risk to fetus'}`
        });
      }
    }
    
    // Check age warnings
    const age = this.calculateAge(patientData.dateOfBirth);
    if (age < 2 && drug.toLowerCase() === 'aspirin') {
      safety.warnings.push({
        type: 'age',
        severity: 'high',
        message: 'Aspirin contraindicated in children < 2 years'
      });
    }
    
    // Check renal warnings
    if (patientData.eGFR && patientData.eGFR < 30) {
      if (['nsaid', 'metformin'].some(cat => drug.toLowerCase().includes(cat))) {
        safety.warnings.push({
          type: 'renal',
          severity: 'high',
          message: 'Use with caution in renal impairment'
        });
      }
    }
    
    return safety;
  }

  /**
   * Adjust dosing for renal impairment
   */
  adjustForRenal(drug, eGFR, dosing) {
    const adjustments = this.renalAdjustments[drug.toLowerCase()];
    if (!adjustments) return dosing;
    
    let adjustment;
    if (eGFR < 15) {
      adjustment = adjustments['<15'] || adjustments['<30'];
    } else if (eGFR < 30) {
      adjustment = adjustments['<30'] || adjustments['15-29'];
    } else if (eGFR < 60) {
      adjustment = adjustments['30-59'] || adjustments['30-45'];
    }
    
    if (adjustment) {
      if (adjustment.dose === 'contraindicated') {
        dosing.warning = 'Contraindicated in severe renal impairment';
      } else {
        dosing.strength = adjustment.dose;
        dosing.frequency = adjustment.frequency;
        dosing.note = `Adjusted for eGFR ${eGFR}`;
      }
    }
    
    return dosing;
  }

  /**
   * Adjust dosing for elderly
   */
  adjustForElderly(drug, dosing) {
    // Start low and go slow principle
    const elderlyAdjustments = {
      'lisinopril': { strength: '5mg', note: 'Start low in elderly' },
      'metoprolol': { strength: '25mg', note: 'Start low in elderly' },
      'gabapentin': { strength: '100mg', note: 'Start low in elderly' }
    };
    
    const adjustment = elderlyAdjustments[drug.toLowerCase()];
    if (adjustment) {
      dosing.strength = adjustment.strength;
      dosing.note = adjustment.note;
    }
    
    return dosing;
  }

  /**
   * Get standard duration for indication
   */
  getStandardDuration(indication) {
    if (!indication) return 30;
    
    const key = Object.keys(this.standardDurations).find(k => 
      indication.toLowerCase().includes(k.split('_')[1])
    );
    
    return this.standardDurations[key] || 30;
  }

  /**
   * Check for allergy conflicts
   */
  checkAllergyConflict(drug, allergy) {
    const allergyLower = allergy.toLowerCase();
    const drugLower = drug.toLowerCase();
    
    // Direct match
    if (drugLower.includes(allergyLower)) return true;
    
    // Cross-sensitivity
    if (allergyLower.includes('penicillin') && 
        (drugLower.includes('amoxicillin') || drugLower.includes('ampicillin'))) {
      return true;
    }
    
    if (allergyLower.includes('sulfa') && 
        drugLower.includes('trimethoprim')) {
      return true;
    }
    
    return false;
  }

  /**
   * Get pregnancy category
   */
  getPregnancyCategory(drug) {
    const categories = {
      'acetaminophen': 'B',
      'amoxicillin': 'B',
      'azithromycin': 'B',
      'lisinopril': 'X',
      'atorvastatin': 'X',
      'warfarin': 'X',
      'metformin': 'B',
      'ibuprofen': 'C/D',
      'ciprofloxacin': 'C'
    };
    
    return categories[drug.toLowerCase()] || 'C';
  }

  /**
   * Get DEA schedule
   */
  getDEASchedule(drug) {
    const schedules = {
      'morphine': 'II',
      'oxycodone': 'II',
      'fentanyl': 'II',
      'methylphenidate': 'II',
      'hydrocodone': 'II',
      'codeine': 'III',
      'tramadol': 'IV',
      'alprazolam': 'IV',
      'lorazepam': 'IV',
      'diazepam': 'IV',
      'zolpidem': 'IV'
    };
    
    return schedules[drug.toLowerCase()] || null;
  }

  /**
   * Check if drug is antibiotic
   */
  isAntibiotic(drug) {
    const antibiotics = [
      'amoxicillin', 'azithromycin', 'ciprofloxacin', 'cephalexin',
      'doxycycline', 'levofloxacin', 'metronidazole', 'trimethoprim'
    ];
    
    return antibiotics.some(a => drug.toLowerCase().includes(a));
  }

  /**
   * Check if chronic medication
   */
  isChronicMedication(drug) {
    const chronic = [
      'lisinopril', 'metoprolol', 'amlodipine', 'metformin',
      'atorvastatin', 'levothyroxine', 'omeprazole', 'sertraline'
    ];
    
    return chronic.some(c => drug.toLowerCase().includes(c));
  }

  /**
   * Get generic name
   */
  getGenericName(brandName) {
    const brandToGeneric = {
      'tylenol': 'acetaminophen',
      'motrin': 'ibuprofen',
      'zithromax': 'azithromycin',
      'cipro': 'ciprofloxacin',
      'prinivil': 'lisinopril',
      'lipitor': 'atorvastatin',
      'prilosec': 'omeprazole',
      'glucophage': 'metformin'
    };
    
    return brandToGeneric[brandName.toLowerCase()] || brandName;
  }

  /**
   * Calculate age from DOB
   */
  calculateAge(dob) {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Generate prescription number
   */
  generateRxNumber() {
    return `RX${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }

  /**
   * Format prescription for printing/display
   */
  formatPrescription(prescription, language = 'en') {
    const isHebrew = language === 'he';
    
    const formatted = {
      header: `${isHebrew ? 'מרשם' : 'Prescription'} #${prescription.id}`,
      date: prescription.date.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US'),
      patient: `${prescription.patient.name} (${isHebrew ? 'גיל' : 'Age'}: ${prescription.patient.age})`,
      medication: `${prescription.medication.name} ${prescription.medication.strength}`,
      sig: prescription.medication.sig,
      quantity: `${isHebrew ? 'כמות' : 'Qty'}: ${prescription.medication.quantity}`,
      refills: `${isHebrew ? 'מילויים חוזרים' : 'Refills'}: ${prescription.medication.refills}`,
      prescriber: prescription.prescriber.name,
      daw: prescription.medication.daw ? (isHebrew ? 'ללא החלפה גנרית' : 'Dispense as Written') : '',
      warnings: prescription.safety.warnings.map(w => w.message)
    };
    
    return formatted;
  }
}

// Create and export singleton instance
const prescriptionGenerator = new PrescriptionGenerator();

// Register service with proxy manager - CRITICAL for prescription safety
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('prescriptionGenerator', () => prescriptionGenerator);
}

module.exports = prescriptionGenerator;