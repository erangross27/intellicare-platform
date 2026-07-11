/**
 * Medication Entitlement Service
 * Combines multiple free data sources to assess medication coverage likelihood.
 *
 * Data Sources:
 * 1. Local Medicare Part D Formulary (120+ drugs in MongoDB)
 * 2. RxNorm (drug identification, generics, drug classes)
 * 3. InsuranceService (hardcoded coverage rules per insurance type)
 * 4. DailyMed (boxed warnings → indicates prior auth likely)
 * 5. OpenFDA/DrugInformationService (safety alerts, recalls)
 *
 * Returns coverage likelihood, tier, copay estimate, prior auth assessment,
 * generic alternatives, and step therapy requirements.
 */

const { MongoClient } = require('mongodb');
const serviceAccountManager = require('./serviceAccountManager');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'intellicare_billing_codes';
const FORMULARY_COLLECTION = 'medicare_formulary';

class MedicationEntitlementService {
  constructor() {
    this.initialized = false;
    this.formularyDb = null;
    this.mongoClient = null;
    this.rxNormService = null;
    this.insuranceService = null;
    this.dailyMedService = null;
    this.drugInformationService = null;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await serviceAccountManager.authenticate('medication-entitlement-service');

      // Connect to formulary database
      this.mongoClient = new MongoClient(MONGO_URI);
      await this.mongoClient.connect();
      this.formularyDb = this.mongoClient.db(DB_NAME).collection(FORMULARY_COLLECTION);

      // Lazy-load dependent services
      this.rxNormService = require('./rxNormService');
      this.insuranceService = require('./insuranceService');
      this.dailyMedService = require('./dailyMedService');
      this.drugInformationService = require('./drugInformationService');

      this.initialized = true;
      console.log('✅ MedicationEntitlementService initialized');
    } catch (error) {
      console.error('❌ MedicationEntitlementService init error:', error.message);
      throw error;
    }
  }

  // ─── Main Entitlement Check ──────────────────────────────────────────────

  /**
   * Check if a patient's insurance is likely to cover a specific medication.
   * Orchestrates calls to RxNorm, local formulary, insurance rules, and safety APIs.
   *
   * @param {string} patientId - Patient ObjectId
   * @param {string} drugName - Medication name (brand or generic)
   * @param {object} practiceDb - Practice database connection
   * @returns {object} Comprehensive entitlement assessment
   */
  async checkMedicationEntitlement(patientId, drugName, practiceDb) {
    await this.initialize();

    const assessment = {
      drug: drugName,
      rxcui: null,
      normalizedName: null,
      drugClass: null,
      insurancePlan: null,
      coverageLikelihood: 'unknown',
      tier: null,
      tierName: null,
      estimatedCopay: null,
      priorAuthRequired: false,
      priorAuthReason: null,
      stepTherapyRequired: false,
      stepTherapyDrugs: [],
      quantityLimit: null,
      genericAvailable: false,
      genericAlternatives: [],
      biosimilarsAvailable: [],
      specialtyDrug: false,
      controlledSubstance: false,
      safetyAlerts: [],
      dataSources: [],
      disclaimer: 'This is an estimate based on available data. Contact the insurance company for definitive coverage determination.'
    };

    try {
      // Step 1: Get patient's insurance info
      let insuranceInfo = null;
      if (practiceDb && patientId) {
        try {
          const patient = await practiceDb.collection('patients').findOne(
            { _id: typeof patientId === 'string' ? new (require('mongodb').ObjectId)(patientId) : patientId },
            { projection: { insuranceProvider: 1, insurancePlan: 1, insuranceType: 1, insurancePolicyNumber: 1, firstName: 1, lastName: 1 } }
          );
          if (patient) {
            insuranceInfo = {
              provider: patient.insuranceProvider || '',
              plan: patient.insurancePlan || '',
              type: patient.insuranceType || '',
              policyNumber: patient.insurancePolicyNumber || '',
              patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim()
            };
            assessment.insurancePlan = insuranceInfo.provider
              ? `${insuranceInfo.provider}${insuranceInfo.plan ? ' - ' + insuranceInfo.plan : ''}`
              : 'Not on file';
          }
        } catch (e) {
          // Patient lookup failed, continue without insurance info
          assessment.insurancePlan = 'Unable to retrieve';
        }
      }

      // Step 2: Normalize drug via RxNorm
      try {
        const rxResult = await this.rxNormService.normalizeDrugName(drugName);
        if (rxResult.rxcui) {
          assessment.rxcui = rxResult.rxcui;
          assessment.normalizedName = rxResult.normalizedName;
          assessment.dataSources.push('RxNorm (NLM)');

          // Get drug details (generics, brands, class)
          const details = await this.rxNormService.getDrugDetails(rxResult.rxcui);
          if (details) {
            assessment.genericAlternatives = (details.genericNames || []).slice(0, 5).map(g => g.name);
            assessment.genericAvailable = assessment.genericAlternatives.length > 0;
          }

          // Get drug classes
          try {
            const classes = await this.rxNormService.getDrugClasses(rxResult.normalizedName || drugName);
            if (classes.atcClasses?.length > 0) {
              assessment.drugClass = classes.atcClasses[0].className;
            } else if (classes.meshClasses?.length > 0) {
              assessment.drugClass = classes.meshClasses[0].className;
            }
          } catch (e) { /* class lookup optional */ }
        }
      } catch (e) {
        // RxNorm failed, continue with name-based lookup
      }

      // Step 3: Check local formulary database
      const formularyResult = await this._lookupFormulary(drugName, assessment.normalizedName);
      if (formularyResult) {
        assessment.tier = formularyResult.tier;
        assessment.tierName = formularyResult.tierName;
        assessment.estimatedCopay = formularyResult.estimatedCopay;
        assessment.priorAuthRequired = formularyResult.priorAuthRequired;
        assessment.priorAuthReason = formularyResult.priorAuthReason || null;
        assessment.stepTherapyRequired = formularyResult.stepTherapyRequired;
        assessment.stepTherapyDrugs = formularyResult.stepTherapyDrugs || [];
        assessment.quantityLimit = formularyResult.quantityLimit || null;
        assessment.specialtyDrug = formularyResult.specialtyDrug || false;
        assessment.controlledSubstance = formularyResult.controlledSubstance || false;
        assessment.genericAvailable = formularyResult.genericAvailable || assessment.genericAvailable;
        assessment.biosimilarsAvailable = formularyResult.biosimilarsAvailable || [];
        if (!assessment.drugClass && formularyResult.drugClass) {
          assessment.drugClass = formularyResult.drugClass;
        }
        assessment.dataSources.push('Medicare Part D Formulary (local)');

        // Determine coverage likelihood from tier
        if (formularyResult.tier <= 2) {
          assessment.coverageLikelihood = 'high';
        } else if (formularyResult.tier === 3) {
          assessment.coverageLikelihood = 'high';
        } else if (formularyResult.tier === 4) {
          assessment.coverageLikelihood = 'medium';
        } else if (formularyResult.tier === 5) {
          assessment.coverageLikelihood = formularyResult.priorAuthRequired ? 'medium' : 'high';
        }

        // Adjust for Part B drugs
        if (formularyResult.coveredUnderPartB) {
          assessment.coverageLikelihood = 'high';
          assessment.tierName = 'Part B (physician-administered)';
          assessment.estimatedCopay = '20% coinsurance after Part B deductible';
        }
      }

      // Step 4: Fall back to insurance service hardcoded rules if no formulary match
      if (!formularyResult && insuranceInfo?.provider) {
        try {
          const coverageResult = this.insuranceService.checkCoverage(
            insuranceInfo,
            null,
            drugName
          );
          if (coverageResult && !coverageResult.error) {
            assessment.coverageLikelihood = coverageResult.covered ? 'medium' : 'low';
            if (coverageResult.copayAmount) {
              assessment.estimatedCopay = `$${coverageResult.copayAmount}`;
            }
            if (coverageResult.requiresPriorAuth) {
              assessment.priorAuthRequired = true;
            }
            assessment.dataSources.push('Insurance Coverage Rules');
          }
        } catch (e) { /* insurance check optional */ }
      }

      // Step 5: Check for safety alerts (boxed warnings, recalls)
      try {
        const searchName = assessment.normalizedName || drugName;

        // Check DailyMed for boxed warnings
        const warnings = await this.dailyMedService.getDrugWarnings(searchName);
        if (warnings?.boxedWarning) {
          assessment.safetyAlerts.push({
            type: 'FDA Boxed Warning',
            summary: warnings.boxedWarning.substring(0, 200) + (warnings.boxedWarning.length > 200 ? '...' : '')
          });
          // Boxed warnings often mean prior auth is more likely
          if (!assessment.priorAuthRequired) {
            assessment.priorAuthRequired = true;
            assessment.priorAuthReason = 'FDA boxed warning - insurer may require prior authorization';
          }
          assessment.dataSources.push('DailyMed (FDA)');
        }
      } catch (e) { /* safety check optional */ }

      try {
        // Check OpenFDA for recalls
        const safety = await this.drugInformationService.checkDrugSafety(drugName);
        if (safety?.activeRecalls?.length > 0) {
          assessment.safetyAlerts.push({
            type: 'FDA Recall',
            summary: `Active recall: ${safety.activeRecalls[0].reason || 'See FDA for details'}`
          });
          assessment.coverageLikelihood = 'low';
          assessment.dataSources.push('OpenFDA');
        }
      } catch (e) { /* recall check optional */ }

      // Step 6: Final coverage determination if still unknown
      if (assessment.coverageLikelihood === 'unknown') {
        if (assessment.genericAvailable || assessment.genericAlternatives.length > 0) {
          assessment.coverageLikelihood = 'medium';
          assessment.estimatedCopay = assessment.estimatedCopay || '$5-$20 (estimated generic tier)';
        } else {
          assessment.coverageLikelihood = 'low';
          assessment.estimatedCopay = assessment.estimatedCopay || 'Unable to estimate';
        }
      }

    } catch (error) {
      assessment.error = error.message;
    }

    return assessment;
  }

  // ─── Find Covered Alternatives ───────────────────────────────────────────

  /**
   * Find alternative medications that are more likely to be covered.
   * Returns generics, biosimilars, and same-class drugs at lower tiers.
   *
   * @param {string} drugName - Original medication name
   * @param {string} insuranceType - Insurance type (medicare, private, etc.)
   * @returns {object} Covered alternatives with tier and copay info
   */
  async findCoveredAlternatives(drugName, insuranceType) {
    await this.initialize();

    const result = {
      originalDrug: drugName,
      alternatives: [],
      dataSources: []
    };

    try {
      // Step 1: Look up the original drug in formulary
      const original = await this._lookupFormulary(drugName, null);

      // Step 2: Find the drug class
      let drugClass = original?.drugClass;
      if (!drugClass) {
        try {
          const rxResult = await this.rxNormService.normalizeDrugName(drugName);
          if (rxResult.rxcui) {
            const classes = await this.rxNormService.getDrugClasses(rxResult.normalizedName || drugName);
            drugClass = classes.atcClasses?.[0]?.className || classes.meshClasses?.[0]?.className;
          }
        } catch (e) { /* fallback to name-based search */ }
      }

      // Step 3: Get generic alternatives from RxNorm
      try {
        const rxResult = await this.rxNormService.normalizeDrugName(drugName);
        if (rxResult.rxcui) {
          const generics = await this.rxNormService.getBrandToGeneric(rxResult.rxcui);
          if (generics.genericAlternatives?.length > 0) {
            for (const generic of generics.genericAlternatives.slice(0, 5)) {
              const formulary = await this._lookupFormulary(generic.name, null);
              result.alternatives.push({
                drugName: generic.name,
                type: 'Generic',
                tier: formulary?.tier || 1,
                tierName: formulary?.tierName || 'Preferred Generic (estimated)',
                estimatedCopay: formulary?.estimatedCopay || '$1-$10',
                savingsNote: 'Generic medications typically have the lowest copays'
              });
            }
            result.dataSources.push('RxNorm (NLM)');
          }
        }
      } catch (e) { /* generic lookup optional */ }

      // Step 4: Get biosimilars if available (for biologics)
      if (original?.biosimilarsAvailable?.length > 0) {
        for (const biosimilar of original.biosimilarsAvailable) {
          result.alternatives.push({
            drugName: biosimilar,
            type: 'Biosimilar',
            tier: original.tier,
            tierName: original.tierName,
            estimatedCopay: original.estimatedCopay,
            savingsNote: 'Biosimilars are typically covered at the same or lower tier than the reference biologic'
          });
        }
      }

      // Step 5: Find same-class drugs at lower tiers
      if (drugClass) {
        const sameClass = await this.formularyDb.find({
          drugClass: drugClass,
          drugNameLower: { $ne: drugName.toLowerCase() },
          tier: { $lte: (original?.tier || 3) }
        }).sort({ tier: 1 }).limit(5).toArray();

        for (const drug of sameClass) {
          // Don't duplicate alternatives already added
          if (!result.alternatives.some(a => a.drugName.toLowerCase() === drug.drugName.toLowerCase())) {
            result.alternatives.push({
              drugName: drug.drugName,
              brandNames: drug.brandNames,
              type: 'Same Class',
              drugClass: drug.drugClass,
              tier: drug.tier,
              tierName: drug.tierName,
              estimatedCopay: drug.estimatedCopay,
              savingsNote: drug.tier < (original?.tier || 5) ? 'Lower tier = lower cost' : 'Same class alternative'
            });
          }
        }
        if (sameClass.length > 0) result.dataSources.push('Medicare Part D Formulary');
      }

      // Sort alternatives by tier (cheapest first)
      result.alternatives.sort((a, b) => (a.tier || 99) - (b.tier || 99));

    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  // ─── Direct Formulary Lookup ─────────────────────────────────────────────

  /**
   * Look up a drug directly in the local Medicare formulary.
   * Returns tier, copay, prior auth, step therapy, and quantity limits.
   *
   * @param {string} query - Drug name (generic or brand)
   * @returns {object} Formulary entry or null
   */
  async getFormularyInfo(query) {
    await this.initialize();

    const result = await this._lookupFormulary(query, null);
    if (result) {
      return {
        found: true,
        ...result,
        source: 'Medicare Part D Formulary (local database)',
        disclaimer: 'Coverage varies by specific Medicare Part D plan. This reflects typical/standard benefit design.'
      };
    }

    // Try text search as fallback
    const textResults = await this.formularyDb.find(
      { $text: { $search: query } },
      { projection: { score: { $meta: 'textScore' } } }
    ).sort({ score: { $meta: 'textScore' } }).limit(5).toArray();

    if (textResults.length > 0) {
      return {
        found: true,
        exactMatch: false,
        possibleMatches: textResults.map(d => ({
          drugName: d.drugName,
          brandNames: d.brandNames,
          drugClass: d.drugClass,
          tier: d.tier,
          tierName: d.tierName,
          estimatedCopay: d.estimatedCopay
        })),
        source: 'Medicare Part D Formulary (local database)'
      };
    }

    return {
      found: false,
      query: query,
      message: `"${query}" not found in the local formulary database. This doesn't mean it's not covered — the database contains ~120 common drugs. Use checkMedicationEntitlement for a more comprehensive assessment that also queries RxNorm.`,
      source: 'Medicare Part D Formulary (local database)'
    };
  }

  // ─── Private Helper: Formulary Lookup ────────────────────────────────────

  async _lookupFormulary(drugName, normalizedName) {
    const searchTerms = [drugName.toLowerCase()];
    if (normalizedName) searchTerms.push(normalizedName.toLowerCase());

    // Try exact match on generic name
    for (const term of searchTerms) {
      const exact = await this.formularyDb.findOne({ drugNameLower: term });
      if (exact) return exact;
    }

    // Try brand name match
    for (const term of searchTerms) {
      const brand = await this.formularyDb.findOne({ brandNamesLower: term });
      if (brand) return brand;
    }

    // Try partial match
    for (const term of searchTerms) {
      const partial = await this.formularyDb.findOne({
        $or: [
          { drugNameLower: { $regex: term, $options: 'i' } },
          { brandNamesLower: { $regex: term, $options: 'i' } }
        ]
      });
      if (partial) return partial;
    }

    return null;
  }
}

// Singleton export
const medicationEntitlementService = new MedicationEntitlementService();
module.exports = medicationEntitlementService;
