// IntelliCare Medication Prescription Service
// Complete e-prescribing with DEA compliance, drug interactions, and formulary checking
// ⚠️ CRITICAL: E-prescribing functionality affecting patient treatment

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class MedicationPrescriptionService {
  constructor() {
    this.serviceToken = null;
    this.drugDatabase = new Map(); // In-memory drug database cache
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('medication-prescription-service');
      
      // Load common medications into cache
      await this.loadCommonMedications();
      
      this.initialized = true;
      console.log('✅ [MedicationPrescriptionService] Initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ [MedicationPrescriptionService] Initialization failed:', error);
      throw error;
    }
  }

  // Helper methods for service access - CRITICAL for prescription operations
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  getDrugInteractionService() {
    return getServiceProxy().getService('drugInteractionService');
  }

  async loadCommonMedications() {
    // Common medications database (simplified for MVP)
    const commonDrugs = [
      { rxcui: '29046', genericName: 'Lisinopril', brandName: 'Prinivil', defaultStrength: '10mg', dosageForm: 'tablet', therapeuticClass: 'ACE Inhibitor', deaSchedule: null },
      { rxcui: '83367', genericName: 'Atorvastatin', brandName: 'Lipitor', defaultStrength: '20mg', dosageForm: 'tablet', therapeuticClass: 'Statin', deaSchedule: null },
      { rxcui: '860975', genericName: 'Metformin', brandName: 'Glucophage', defaultStrength: '500mg', dosageForm: 'tablet', therapeuticClass: 'Antidiabetic', deaSchedule: null },
      { rxcui: '197361', genericName: 'Amlodipine', brandName: 'Norvasc', defaultStrength: '5mg', dosageForm: 'tablet', therapeuticClass: 'Calcium Channel Blocker', deaSchedule: null },
      { rxcui: '1719286', genericName: 'Amoxicillin', brandName: 'Amoxil', defaultStrength: '500mg', dosageForm: 'capsule', therapeuticClass: 'Antibiotic', deaSchedule: null },
      { rxcui: '131725', genericName: 'Omeprazole', brandName: 'Prilosec', defaultStrength: '20mg', dosageForm: 'capsule', therapeuticClass: 'Proton Pump Inhibitor', deaSchedule: null },
      { rxcui: '7804', genericName: 'Oxycodone', brandName: 'OxyContin', defaultStrength: '5mg', dosageForm: 'tablet', therapeuticClass: 'Opioid Analgesic', deaSchedule: 'II' },
      { rxcui: '2670', genericName: 'Alprazolam', brandName: 'Xanax', defaultStrength: '0.5mg', dosageForm: 'tablet', therapeuticClass: 'Benzodiazepine', deaSchedule: 'IV' },
      { rxcui: '11289', genericName: 'Warfarin', brandName: 'Coumadin', defaultStrength: '5mg', dosageForm: 'tablet', therapeuticClass: 'Anticoagulant', deaSchedule: null },
      { rxcui: '202479', genericName: 'Aspirin', brandName: 'Bayer', defaultStrength: '81mg', dosageForm: 'tablet', therapeuticClass: 'NSAID', deaSchedule: null }
    ];

    commonDrugs.forEach(drug => {
      this.drugDatabase.set(drug.rxcui, drug);
      this.drugDatabase.set(drug.genericName.toLowerCase(), drug);
    });
  }

  async prescribeMedication(prescriptionRequest, context) {
    try {
      // Validate prescriber authorization
      const prescriberAuth = await this.validatePrescriberAuthorization(
        prescriptionRequest.prescriberId || context.userId, 
        context
      );
      
      // Get patient information
      const patient = await this.getPatientInfo(prescriptionRequest.patientId, context);
      
      // Validate and normalize medication
      const medication = await this.validateMedication(prescriptionRequest.medication, context);
      
      // Check for drug allergies
      const allergyCheck = await this.checkAllergies(medication, patient, context);
      if (allergyCheck.hasAllergy) {
        throw new Error(`Patient has allergy to ${allergyCheck.allergen}: ${allergyCheck.reaction}`);
      }
      
      // Check drug interactions
      const interactions = await this.checkDrugInteractions(medication, patient, context);
      
      // Check insurance formulary
      const formularyCheck = await this.checkFormulary(medication, patient, context);
      
      // Handle controlled substances
      if (medication.deaSchedule) {
        await this.validateControlledSubstance(medication, prescriberAuth, prescriptionRequest, context);
      }
      
      // Create prescription record
      const prescription = await this.createPrescriptionRecord({
        ...prescriptionRequest,
        medication,
        patient,
        prescriber: prescriberAuth.prescriber,
        interactions,
        formularyCheck,
        practiceId: context.practiceId
      }, context);
      
      // Transmit to pharmacy if requested
      if (prescriptionRequest.transmitToPharmacy && prescriptionRequest.pharmacyId) {
        await this.transmitToPharmacy(prescription, prescriptionRequest.pharmacyId, context);
      }
      
      // Audit log
      await this.auditPrescription(prescription, context);
      
      return {
        success: true,
        prescriptionId: prescription._id,
        medication: {
          name: medication.genericName,
          brandName: medication.brandName,
          strength: prescriptionRequest.medication.strength || medication.defaultStrength,
          dosageForm: medication.dosageForm
        },
        alerts: [
          ...(interactions.significantInteractions || []),
          ...(formularyCheck.alerts || [])
        ],
        formulary: {
          covered: formularyCheck.covered,
          tier: formularyCheck.tier,
          copay: formularyCheck.copay,
          priorAuthRequired: formularyCheck.priorAuthRequired
        },
        transmitted: prescriptionRequest.transmitToPharmacy || false
      };
      
    } catch (error) {
      console.error('[MedicationPrescriptionService] Prescription failed:', error);
      throw error;
    }
  }

  async validatePrescriberAuthorization(prescriberId, context) {
    const contextWithApi = {
      serviceId: 'medication-prescription-service',
      operation: 'validate-prescriber',
      practiceId: context.practiceId || 'global'
    };
    const prescriber = await this.getSecureDataAccess().query('users', { _id: prescriberId }, {}, contextWithApi);
    
    if (!prescriber || prescriber.length === 0) {
      throw new Error('Prescriber not found');
    }
    
    const prescriberData = prescriber[0];
    
    // Check if user has prescribing privileges
    const hasPrivileges = prescriberData.role && 
      ['physician', 'nurse_practitioner', 'physician_assistant'].includes(prescriberData.role);
    
    if (!hasPrivileges) {
      throw new Error('User does not have prescribing privileges');
    }
    
    return {
      authorized: true,
      prescriber: prescriberData,
      deaNumber: prescriberData.deaNumber || null,
      licenseNumber: prescriberData.licenseNumber || null
    };
  }

  async getPatientInfo(patientId, context) {
    const contextWithApi = {
      serviceId: 'medication-prescription-service',
      operation: 'get-patient-info',
      practiceId: context.practiceId || 'global'
    };
    const patients = await this.getSecureDataAccess().query('patients', { _id: patientId }, {}, contextWithApi);
    
    if (!patients || patients.length === 0) {
      throw new Error('Patient not found');
    }
    
    const patient = patients[0];
    
    // Get current medications
    const currentMedications = await this.getSecureDataAccess().query(
      'medications',
      { patientId: patient._id, status: 'active' },
      { sort: { startDate: -1 } },
      contextWithApi
    );
    
    // Get allergies
    const allergies = await this.getSecureDataAccess().query(
      'allergies',
      { patientId: patient._id },
      {},
      contextWithApi
    );
    
    // Get insurance info
    const insurance = await this.getSecureDataAccess().query(
      'insurance',
      { patientId: patient._id, status: 'active' },
      {},
      contextWithApi
    );
    
    return {
      ...patient,
      currentMedications: currentMedications || [],
      allergies: allergies || [],
      insurance: insurance?.[0] || null
    };
  }

  async validateMedication(medicationInput, context) {
    // Look up medication in database
    let medication;
    
    if (medicationInput.rxcui) {
      medication = this.drugDatabase.get(medicationInput.rxcui);
    } else if (medicationInput.genericName) {
      medication = this.drugDatabase.get(medicationInput.genericName.toLowerCase());
    }
    
    if (!medication) {
      // If not in cache, create basic medication record
      medication = {
        rxcui: medicationInput.rxcui || `custom-${Date.now()}`,
        genericName: medicationInput.genericName,
        brandName: medicationInput.brandName,
        defaultStrength: medicationInput.strength,
        dosageForm: medicationInput.dosageForm || 'tablet',
        therapeuticClass: medicationInput.therapeuticClass || 'Other',
        deaSchedule: medicationInput.deaSchedule || null
      };
    }
    
    return medication;
  }

  async checkAllergies(medication, patient, context) {
    if (!patient.allergies || patient.allergies.length === 0) {
      return { hasAllergy: false };
    }
    
    // Check if patient has allergy to this medication
    const allergy = patient.allergies.find(a => {
      const allergen = a.allergen?.toLowerCase();
      const medName = medication.genericName?.toLowerCase();
      const brandName = medication.brandName?.toLowerCase();
      
      return allergen && (
        allergen.includes(medName) || 
        (brandName && allergen.includes(brandName)) ||
        (medication.therapeuticClass && allergen.includes(medication.therapeuticClass.toLowerCase()))
      );
    });
    
    if (allergy) {
      return {
        hasAllergy: true,
        allergen: allergy.allergen,
        reaction: allergy.reaction || 'Unknown reaction',
        severity: allergy.severity || 'moderate'
      };
    }
    
    return { hasAllergy: false };
  }

  async checkDrugInteractions(medication, patient, context) {
    const interactions = {
      contraindicated: [],
      significantInteractions: [],
      minorInteractions: []
    };
    
    if (!patient.currentMedications || patient.currentMedications.length === 0) {
      return interactions;
    }
    
    // Simplified interaction checking - in production would use external API
    const knownInteractions = {
      'warfarin': {
        'aspirin': { severity: 'major', description: 'Increased bleeding risk' },
        'omeprazole': { severity: 'moderate', description: 'May increase warfarin levels' }
      },
      'lisinopril': {
        'potassium': { severity: 'major', description: 'Risk of hyperkalemia' }
      }
    };
    
    // Check for interactions
    patient.currentMedications.forEach(currentMed => {
      const medName = currentMed.genericName?.toLowerCase();
      const newMedName = medication.genericName?.toLowerCase();
      
      if (knownInteractions[medName]?.[newMedName]) {
        const interaction = knownInteractions[medName][newMedName];
        if (interaction.severity === 'contraindicated') {
          interactions.contraindicated.push({
            medication: currentMed.genericName,
            description: interaction.description
          });
        } else if (interaction.severity === 'major') {
          interactions.significantInteractions.push({
            medication: currentMed.genericName,
            severity: interaction.severity,
            description: interaction.description
          });
        } else {
          interactions.minorInteractions.push({
            medication: currentMed.genericName,
            description: interaction.description
          });
        }
      }
    });
    
    return interactions;
  }

  async checkFormulary(medication, patient, context) {
    if (!patient.insurance) {
      return {
        covered: false,
        status: 'no_insurance',
        alerts: [{
          type: 'warning',
          message: 'Patient has no active insurance coverage'
        }]
      };
    }
    
    // Simplified formulary check - in production would use insurance API
    const commonFormulary = {
      'lisinopril': { covered: true, tier: 1, copay: 10, priorAuth: false },
      'atorvastatin': { covered: true, tier: 2, copay: 25, priorAuth: false },
      'metformin': { covered: true, tier: 1, copay: 10, priorAuth: false },
      'oxycodone': { covered: true, tier: 3, copay: 50, priorAuth: true }
    };
    
    const formularyInfo = commonFormulary[medication.genericName?.toLowerCase()];
    
    if (formularyInfo) {
      return {
        covered: formularyInfo.covered,
        tier: formularyInfo.tier,
        copay: formularyInfo.copay,
        priorAuthRequired: formularyInfo.priorAuth,
        alerts: formularyInfo.priorAuth ? [{
          type: 'info',
          message: 'Prior authorization required for this medication'
        }] : []
      };
    }
    
    // Default response for medications not in formulary
    return {
      covered: false,
      status: 'not_in_formulary',
      alternatives: ['Generic alternative may be available'],
      alerts: [{
        type: 'warning',
        message: 'Medication may not be covered - check with insurance'
      }]
    };
  }

  async validateControlledSubstance(medication, prescriberAuth, prescriptionRequest, context) {
    if (!prescriberAuth.deaNumber) {
      throw new Error('DEA registration required to prescribe controlled substances');
    }
    
    // Check schedule-specific restrictions
    const schedule = medication.deaSchedule;
    
    if (schedule === 'II') {
      // Schedule II restrictions
      if (prescriptionRequest.refills && prescriptionRequest.refills > 0) {
        throw new Error('Schedule II medications cannot have refills');
      }
      if (prescriptionRequest.quantity > 30) {
        console.warn('Large quantity prescribed for Schedule II medication');
      }
    } else if (['III', 'IV', 'V'].includes(schedule)) {
      // Schedule III-V restrictions
      if (prescriptionRequest.refills > 5) {
        throw new Error(`Schedule ${schedule} medications limited to 5 refills`);
      }
    }
    
    return true;
  }

  async createPrescriptionRecord(data, context) {
    const prescriptionData = {
      prescriptionId: `RX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId: data.patient._id,
      prescriberId: data.prescriber._id,
      practiceId: data.practiceId,
      
      medication: {
        rxcui: data.medication.rxcui,
        genericName: data.medication.genericName,
        brandName: data.medication.brandName,
        strength: data.medication.strength || data.medication.defaultStrength,
        dosageForm: data.medication.dosageForm,
        therapeuticClass: data.medication.therapeuticClass,
        deaSchedule: data.medication.deaSchedule
      },
      
      dosage: {
        amount: data.dosage?.amount || '1',
        frequency: data.dosage?.frequency || 'once daily',
        route: data.dosage?.route || 'oral',
        duration: data.dosage?.duration,
        instructions: data.instructions
      },
      
      quantity: data.quantity || 30,
      refills: data.refills || 0,
      daysSupply: data.daysSupply || 30,
      
      indication: data.indication,
      
      formulary: data.formularyCheck,
      interactions: data.interactions,
      
      status: 'active',
      prescribedAt: new Date(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    };
    
    // Save to database
    const contextWithApi = {
      serviceId: 'medication-prescription-service',
      operation: 'create-prescription',
      practiceId: context.practiceId || 'global'
    };
    const prescription = await this.getSecureDataAccess().create(
      'prescriptions',
      prescriptionData,
      contextWithApi
    );
    
    // Also add to patient's medication list
    await this.getSecureDataAccess().create(
      'medications',
      {
        patientId: data.patient._id,
        prescriptionId: prescription._id,
        ...prescriptionData.medication,
        dosage: prescriptionData.dosage,
        startDate: new Date(),
        status: 'active',
        prescribedBy: data.prescriber.name
      },
      contextWithApi
    );
    
    return prescription;
  }

  async transmitToPharmacy(prescription, pharmacyId, context) {
    // Simplified pharmacy transmission - in production would use NCPDP SCRIPT
    console.log(`Transmitting prescription ${prescription.prescriptionId} to pharmacy ${pharmacyId}`);
    
    // Update prescription with transmission status
    const contextWithApi = {
      serviceId: 'medication-prescription-service',
      operation: 'transmit-to-pharmacy',
      practiceId: context.practiceId || 'global'
    };
    await this.getSecureDataAccess().update(
      'prescriptions',
      { _id: prescription._id },
      {
        transmission: {
          status: 'transmitted',
          pharmacyId: pharmacyId,
          transmittedAt: new Date()
        }
      },
      contextWithApi
    );
    
    return { transmitted: true, pharmacyId };
  }

  async auditPrescription(prescription, context) {
    await AuditLog.create({
      action: 'PRESCRIBE_MEDICATION',
      userId: context.userId,
      practiceId: context.practiceId,
      patientId: prescription.patientId,
      details: {
        prescriptionId: prescription._id,
        medication: prescription.medication.genericName,
        deaSchedule: prescription.medication.deaSchedule,
        quantity: prescription.quantity,
        refills: prescription.refills
      },
      timestamp: new Date(),
      priority: prescription.medication.deaSchedule ? 'high' : 'normal'
    });
  }

  // Additional utility methods
  async getMedicationHistory(patientId, context) {
    const contextWithApi = {
      serviceId: 'medication-prescription-service',
      operation: 'get-medication-history',
      practiceId: context.practiceId || 'global'
    };
    return await this.getSecureDataAccess().query(
      'medications',
      { patientId },
      { sort: { startDate: -1 } },
      contextWithApi
    );
  }

  async getPrescriptionDetails(prescriptionId, context) {
    const contextWithApi = {
      serviceId: 'medication-prescription-service',
      operation: 'get-prescription-details',
      practiceId: context.practiceId || 'global'
    };
    const prescriptions = await this.getSecureDataAccess().query('prescriptions', { _id: prescriptionId }, {}, contextWithApi);
    return prescriptions?.[0] || null;
  }

  async cancelPrescription(prescriptionId, reason, context) {
    const contextWithApi = {
      serviceId: 'medication-prescription-service',
      operation: 'cancel-prescription',
      practiceId: context.practiceId || 'global'
    };
    const prescription = await this.getSecureDataAccess().update(
      'prescriptions',
      { _id: prescriptionId },
      {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledBy: context.userId
      },
      contextWithApi
    );
    
    // Also update medication status
    await this.getSecureDataAccess().update(
      'medications',
      { prescriptionId },
      { status: 'discontinued', discontinuedDate: new Date() },
      contextWithApi
    );
    
    await AuditLog.create({
      action: 'CANCEL_PRESCRIPTION',
      userId: context.userId,
      practiceId: context.practiceId,
      details: { prescriptionId, reason },
      timestamp: new Date()
    });
    
    return prescription;
  }
}

// Create and export singleton instance
const medicationPrescriptionService = new MedicationPrescriptionService();

// Register service with proxy manager - CRITICAL for e-prescribing
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('medicationPrescriptionService', () => medicationPrescriptionService);
}

module.exports = medicationPrescriptionService;