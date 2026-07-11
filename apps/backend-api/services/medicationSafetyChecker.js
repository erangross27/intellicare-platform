/**
 * Medication Safety Checker Service
 * Orchestrates drug interaction checking and allergy cross-sensitivity detection
 * Integrates drugInformationService + allergyChecker for comprehensive safety analysis
 */

const drugInformationService = require('./drugInformationService');
const allergyChecker = require('./allergyChecker');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');

class MedicationSafetyChecker {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('medication-safety-checker');

      // Initialize dependent services
      await drugInformationService.initialize();
      await allergyChecker.initialize();

      this.initialized = true;
      console.log('✅ Medication Safety Checker initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Medication Safety Checker:', error);
      throw error;
    }
  }

  /**
   * Comprehensive safety check for new medication
   * @param {string} patientId - Patient ID
   * @param {string} medicationName - New medication to check
   * @param {Object} context - Security context
   * @param {Array} currentDocumentMedications - Medications from the current document being processed
   * @returns {Object} Safety report with interactions, allergies, alternatives
   */
  async checkNewMedication(patientId, medicationName, context, currentDocumentMedications = []) {
    await this.initialize();

    try {
      console.log(`\n🔍 Safety Check: ${medicationName}`);

      // Get patient's current medications from database
      const dbMedications = await this.getPatientMedications(patientId, context);

      // Combine database medications with current document medications
      const allCurrentMeds = [
        ...dbMedications,
        ...currentDocumentMedications.map(med => ({
          name: med.name || med.medication || (typeof med === 'string' ? med.split(' ')[0] : ''),
          source: 'current_document'
        }))
      ];

      console.log(`   📋 Current medications: ${allCurrentMeds.length} found`);
      console.log(`      - From database: ${dbMedications.length}`);
      console.log(`      - From current document: ${currentDocumentMedications.length}`);
      if (allCurrentMeds.length > 0) {
        console.log(`      - ${allCurrentMeds.map(m => m.name || m.medication).join(', ')}`);
      }

      // Get patient's allergies
      const patientAllergies = await this.getPatientAllergies(patientId, context);
      console.log(`   🚫 Patient allergies: ${patientAllergies.length} found`);
      if (patientAllergies.length > 0) {
        console.log(`      - ${patientAllergies.map(a => a.allergen).join(', ')}`);
      }

      // Build medication list including new medication
      const allMedicationNames = [
        ...allCurrentMeds.map(m => m.name || m.medication),
        medicationName
      ].filter(Boolean);

      // Check drug interactions
      console.log(`   🔬 Checking interactions for ${allMedicationNames.length} medications...`);
      const drugInteractions = await this.checkDrugInteractions(allMedicationNames, context);
      console.log(`      → ${drugInteractions.totalInteractions} interactions found (${drugInteractions.majorInteractions} major, ${drugInteractions.moderateInteractions} moderate)`);

      // Check allergy cross-sensitivity
      console.log(`   💊 Checking allergy cross-sensitivity...`);
      const allergyCheck = await this.checkAllergies(patientAllergies, medicationName, context);
      console.log(`      → Direct allergy: ${allergyCheck.directAllergy ? 'YES ⛔' : 'No'}`);
      console.log(`      → Cross-sensitivity: ${allergyCheck.crossSensitivity?.length || 0} found`);

      // Generate safety report
      const safetyReport = this.generateSafetyReport({
        medicationName,
        drugInteractions,
        allergyCheck,
        currentMedications: allCurrentMeds,
        patientAllergies
      });

      console.log(`   📊 Safety Report: ${safetyReport.summary}`);

      // Log safety check
      await this.logSafetyCheck(patientId, medicationName, safetyReport, context);

      return safetyReport;

    } catch (error) {
      console.error('Medication safety check error:', error);
      return {
        hasWarnings: false,
        hasErrors: true,
        errorMessage: `Safety check failed: ${error.message}`,
        cannotVerifySafety: true
      };
    }
  }

  /**
   * Check drug interactions for medication list
   */
  async checkDrugInteractions(medications, context) {
    try {
      if (medications.length < 2) {
        return {
          totalInteractions: 0,
          majorInteractions: 0,
          moderateInteractions: 0,
          minorInteractions: 0,
          interactions: []
        };
      }

      const result = await drugInformationService.checkDrugInteractions(medications, {
        userId: context.userId || 'system'
      });

      return result;

    } catch (error) {
      console.error('Drug interaction check error:', error);
      return {
        totalInteractions: 0,
        majorInteractions: 0,
        moderateInteractions: 0,
        minorInteractions: 0,
        interactions: [],
        error: error.message
      };
    }
  }

  /**
   * Check allergy cross-sensitivity
   */
  async checkAllergies(patientAllergies, medication, context) {
    try {
      if (!patientAllergies || patientAllergies.length === 0) {
        return {
          safe: true,
          directAllergy: false,
          crossSensitivity: [],
          warnings: []
        };
      }

      const result = await allergyChecker.checkAllergies(
        patientAllergies,
        medication,
        'en',
        { patientContext: context }
      );

      return result;

    } catch (error) {
      console.error('Allergy check error:', error);
      return {
        safe: true,
        directAllergy: false,
        crossSensitivity: [],
        warnings: [],
        error: error.message
      };
    }
  }

  /**
   * Get patient's current medications
   */
  async getPatientMedications(patientId, context) {
    try {
      const medications = await SecureDataAccess.query(
        'medications',
        { patientId: patientId, status: { $in: ['active', 'current'] } },
        { limit: 100 },
        {
          serviceId: 'medication-safety-checker',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: context.practiceId || 'global'
        }
      );

      return medications || [];

    } catch (error) {
      console.error('Failed to get patient medications:', error);
      return [];
    }
  }

  /**
   * Get patient's allergies
   */
  async getPatientAllergies(patientId, context) {
    try {
      const allergies = await SecureDataAccess.query(
        'allergies',
        { patientId: patientId },
        { limit: 100 },
        {
          serviceId: 'medication-safety-checker',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: context.practiceId || 'global'
        }
      );

      return allergies.map(a => ({
        allergen: a.allergen || a.Allergen,
        reaction: a.reaction || a.Reaction,
        severity: a.severity || a.Severity || 'unknown'
      }));

    } catch (error) {
      console.error('Failed to get patient allergies:', error);
      return [];
    }
  }

  /**
   * Generate comprehensive safety report
   */
  generateSafetyReport({ medicationName, drugInteractions, allergyCheck, currentMedications, patientAllergies }) {
    const report = {
      medicationName,
      isSafe: true,
      hasWarnings: false,
      hasErrors: false,
      warnings: [],
      errors: [],
      alternatives: [],
      summary: ''
    };

    // Check drug interactions
    if (drugInteractions.majorInteractions > 0) {
      report.isSafe = false;
      report.hasErrors = true;

      drugInteractions.interactions
        .filter(i => i.severity === 'MAJOR')
        .forEach(interaction => {
          report.errors.push({
            type: 'MAJOR_DRUG_INTERACTION',
            severity: 'CRITICAL',
            message: `Major interaction with ${interaction.drug1 === medicationName ? interaction.drug2 : interaction.drug1}: ${interaction.description}`,
            management: interaction.management,
            source: 'FDA Drug Interaction Database'
          });
        });
    }

    if (drugInteractions.moderateInteractions > 0) {
      report.hasWarnings = true;

      drugInteractions.interactions
        .filter(i => i.severity === 'MODERATE')
        .forEach(interaction => {
          report.warnings.push({
            type: 'MODERATE_DRUG_INTERACTION',
            severity: 'MEDIUM',
            message: `Moderate interaction with ${interaction.drug1 === medicationName ? interaction.drug2 : interaction.drug1}: ${interaction.description}`,
            management: interaction.management,
            source: 'FDA Drug Interaction Database'
          });
        });
    }

    // Check allergy
    if (allergyCheck.directAllergy) {
      report.isSafe = false;
      report.hasErrors = true;

      report.errors.push({
        type: 'DIRECT_ALLERGY',
        severity: 'CRITICAL',
        message: `Patient has direct allergy to ${medicationName} - DO NOT ADMINISTER`,
        allergyReaction: allergyCheck.severity,
        source: 'Patient Allergy Record'
      });

      if (allergyCheck.alternatives && allergyCheck.alternatives.length > 0) {
        report.alternatives = allergyCheck.alternatives;
      }
    }

    if (allergyCheck.crossSensitivity && allergyCheck.crossSensitivity.length > 0) {
      const highRiskCross = allergyCheck.crossSensitivity.filter(cs => cs.risk === 'high');
      const moderateRiskCross = allergyCheck.crossSensitivity.filter(cs => cs.risk === 'moderate');

      if (highRiskCross.length > 0) {
        report.isSafe = false;
        report.hasErrors = true;

        highRiskCross.forEach(cross => {
          report.errors.push({
            type: 'HIGH_CROSS_SENSITIVITY',
            severity: 'HIGH',
            message: `High risk cross-sensitivity: Patient allergic to ${cross.allergen}, ${cross.rate} risk with ${medicationName}`,
            mechanism: cross.mechanism,
            source: 'Allergy Cross-Sensitivity Database'
          });
        });
      }

      if (moderateRiskCross.length > 0) {
        report.hasWarnings = true;

        moderateRiskCross.forEach(cross => {
          report.warnings.push({
            type: 'MODERATE_CROSS_SENSITIVITY',
            severity: 'MEDIUM',
            message: `Moderate cross-sensitivity risk: Patient allergic to ${cross.allergen}, ${cross.rate} risk with ${medicationName}`,
            mechanism: cross.mechanism,
            source: 'Allergy Cross-Sensitivity Database'
          });
        });
      }
    }

    // Generate summary
    report.summary = this.generateSummary(report);

    return report;
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(report) {
    if (report.hasErrors) {
      const errorCount = report.errors.length;
      const warningCount = report.warnings.length;

      let summary = `⛔ ${errorCount} critical safety issue${errorCount > 1 ? 's' : ''} detected`;
      if (warningCount > 0) {
        summary += `, ${warningCount} warning${warningCount > 1 ? 's' : ''}`;
      }
      summary += '. DO NOT PRESCRIBE without review.';

      return summary;
    }

    if (report.hasWarnings) {
      return `⚠️ ${report.warnings.length} warning${report.warnings.length > 1 ? 's' : ''} - Use with caution and monitoring`;
    }

    return '✅ No safety concerns detected';
  }

  /**
   * Log safety check to audit trail
   */
  async logSafetyCheck(patientId, medicationName, safetyReport, context) {
    try {
      await SecureDataAccess.insert('audit_logs', {
        action: 'MEDICATION_SAFETY_CHECK',
        resourceType: 'medication',
        patientId: patientId,
        medication: medicationName,
        safetyStatus: safetyReport.isSafe ? 'SAFE' : 'UNSAFE',
        errorCount: safetyReport.errors?.length || 0,
        warningCount: safetyReport.warnings?.length || 0,
        timestamp: new Date()
      }, {
        serviceId: 'medication-safety-checker',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: context.practiceId || 'global'
      });
    } catch (error) {
      console.error('Failed to log safety check:', error);
    }
  }
}

module.exports = new MedicationSafetyChecker();
