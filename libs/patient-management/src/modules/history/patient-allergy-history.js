/**
 * Patient Allergy History Module
 * Handles allergy and adverse reaction tracking with severity assessment and cross-references
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientAllergyHistory {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-allergy-history');
    this.initialized = true;
    console.log('✅ [PatientAllergyHistory] Service initialized');
  }

  /**
   * Add allergy history entry for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} allergyData - Allergy history data
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Addition result
   */
  async addAllergyHistoryEntry(patientId, allergyData, practiceContext, session) {
    console.log('🚨 [PatientAllergyHistory] Adding allergy history entry:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const validation = this.validateAllergyData(allergyData);
      if (!validation.success) {
        return validation;
      }

      // Check for duplicate allergies
      const duplicateCheck = await this.checkDuplicateAllergy(patientId, allergyData.allergen, practiceContext);
      if (duplicateCheck.isDuplicate) {
        return {
          success: false,
          error: 'DUPLICATE_ALLERGY',
          message: 'This allergy is already recorded for the patient'
        };
      }

      // Get cross-references for related substances
      const crossReferences = this.getCrossReferences(allergyData.allergen, allergyData.category);

      const allergyEntry = {
        patientId,
        ...validation.processedData,
        crossReferences,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: session?.userId || 'system',
        practiceId: practiceContext.practiceId
      };

      const context = {
        serviceId: 'patient-allergy-history',
        operation: 'add-allergy-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.create('allergy_history', allergyEntry, context);

      // Create audit trail
      await this.createAuditTrail(patientId, 'ADD_ALLERGY_HISTORY', allergyData, session, practiceContext);

      return {
        success: true,
        allergyEntry: result,
        crossReferences,
        message: 'Allergy history entry added successfully'
      };

    } catch (error) {
      console.error('❌ [PatientAllergyHistory] Add entry failed:', error);
      return {
        success: false,
        error: 'ADD_ALLERGY_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get allergy history for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Query options
   * @returns {Object} Allergy history
   */
  async getAllergyHistory(patientId, practiceContext, options = {}) {
    console.log('🚨 [PatientAllergyHistory] Getting allergy history:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const context = {
        serviceId: 'patient-allergy-history',
        operation: 'get-allergy-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const queryOptions = {
        sort: { severity: -1, dateIdentified: -1 },
        limit: options.limit || 100,
        skip: options.skip || 0
      };

      const query = { patientId };
      
      // Filter by category if specified
      if (options.category) {
        query.category = options.category;
      }
      
      // Filter by severity if specified
      if (options.severity) {
        query.severity = options.severity;
      }

      // Filter by status if specified
      if (options.status) {
        query.status = options.status;
      }

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const results = await SecureDataAccess.query('allergy_history', query, queryOptions, context);

      // Get critical allergies (severe reactions)
      const criticalAllergies = results.filter(allergy => allergy.severity === 'severe' || allergy.severity === 'life_threatening');
      
      // Calculate allergy risk profile
      const riskProfile = this.calculateAllergyRiskProfile(results);

      return {
        success: true,
        allergyHistory: results,
        criticalAllergies,
        riskProfile,
        totalCount: results.length,
        message: 'Allergy history retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientAllergyHistory] Get allergy history failed:', error);
      return {
        success: false,
        error: 'GET_ALLERGY_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Update allergy history entry
   * @param {string} entryId - Allergy history entry ID
   * @param {Object} updateData - Data to update
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Update result
   */
  async updateAllergyHistoryEntry(entryId, updateData, practiceContext, session) {
    console.log('🚨 [PatientAllergyHistory] Updating allergy history entry:', entryId);

    try {
      const validation = this.validateAllergyData(updateData, true);
      if (!validation.success) {
        return validation;
      }

      const updateRecord = {
        ...validation.processedData,
        updatedAt: new Date(),
        updatedBy: session?.userId || 'system'
      };

      const context = {
        serviceId: 'patient-allergy-history',
        operation: 'update-allergy-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.update(
        'allergy_history',
        { _id: entryId },
        updateRecord,
        context
      );

      if (!result || result.matchedCount === 0) {
        return {
          success: false,
          error: 'ENTRY_NOT_FOUND',
          message: 'Allergy history entry not found'
        };
      }

      return {
        success: true,
        updatedCount: result.modifiedCount,
        message: 'Allergy history entry updated successfully'
      };

    } catch (error) {
      console.error('❌ [PatientAllergyHistory] Update entry failed:', error);
      return {
        success: false,
        error: 'UPDATE_ALLERGY_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Check for duplicate allergies
   */
  async checkDuplicateAllergy(patientId, allergen, practiceContext) {
    try {
      const context = {
        serviceId: 'patient-allergy-history',
        operation: 'check-duplicate',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const existing = await SecureDataAccess.query(
        'allergy_history',
        { 
          patientId,
          allergen: { $regex: `^${allergen}$`, $options: 'i' },
          status: { $ne: 'resolved' }
        },
        { limit: 1 },
        context
      );

      return { isDuplicate: existing.length > 0 };

    } catch (error) {
      console.error('❌ [PatientAllergyHistory] Duplicate check failed:', error);
      return { isDuplicate: false };
    }
  }

  /**
   * Get cross-references for related allergens
   */
  getCrossReferences(allergen, category) {
    const crossReferenceMap = {
      // Drug allergies
      'penicillin': ['amoxicillin', 'ampicillin', 'methicillin'],
      'aspirin': ['ibuprofen', 'naproxen', 'diclofenac'],
      'codeine': ['morphine', 'oxycodone', 'hydrocodone'],
      
      // Food allergies
      'peanuts': ['tree nuts', 'soy'],
      'shellfish': ['crustaceans', 'mollusks'],
      'milk': ['dairy products', 'casein', 'whey'],
      
      // Environmental allergies
      'pollen': ['grass pollen', 'tree pollen', 'ragweed'],
      'dust mites': ['dust', 'feathers', 'animal dander'],
      'mold': ['fungi', 'yeast']
    };

    const allergenLower = allergen.toLowerCase();
    return crossReferenceMap[allergenLower] || [];
  }

  /**
   * Validate allergy data
   */
  validateAllergyData(data, isUpdate = false) {
    const errors = [];
    const processedData = {};

    // Required fields for new entries
    if (!isUpdate) {
      if (!data.allergen) {
        errors.push('Allergen is required');
      }
      if (!data.category) {
        errors.push('Allergy category is required');
      }
      if (!data.severity) {
        errors.push('Severity is required');
      }
    }

    // Validate allergen
    if (data.allergen) {
      processedData.allergen = data.allergen.trim();
    }

    // Validate category
    if (data.category) {
      const validCategories = ['drug', 'food', 'environmental', 'contact', 'insect', 'latex', 'other'];
      if (validCategories.includes(data.category)) {
        processedData.category = data.category;
      } else {
        errors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }
    }

    // Validate severity
    if (data.severity) {
      const validSeverities = ['mild', 'moderate', 'severe', 'life_threatening'];
      if (validSeverities.includes(data.severity)) {
        processedData.severity = data.severity;
      } else {
        errors.push(`Invalid severity. Must be one of: ${validSeverities.join(', ')}`);
      }
    }

    // Validate reaction type
    if (data.reactionType) {
      const validTypes = ['skin', 'respiratory', 'gastrointestinal', 'cardiovascular', 'neurological', 'systemic'];
      if (validTypes.includes(data.reactionType)) {
        processedData.reactionType = data.reactionType;
      } else {
        errors.push(`Invalid reaction type. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    // Validate status
    if (data.status) {
      const validStatuses = ['active', 'resolved', 'suspected', 'inactive'];
      if (validStatuses.includes(data.status)) {
        processedData.status = data.status;
      } else {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    } else if (!isUpdate) {
      processedData.status = 'active'; // Default status
    }

    // Validate date identified
    if (data.dateIdentified) {
      const dateIdentified = new Date(data.dateIdentified);
      if (isNaN(dateIdentified.getTime())) {
        errors.push('Invalid date identified format');
      } else if (dateIdentified > new Date()) {
        errors.push('Date identified cannot be in the future');
      } else {
        processedData.dateIdentified = dateIdentified;
      }
    }

    // Optional text fields
    ['symptoms', 'treatment', 'notes', 'identifiedBy', 'verificationMethod'].forEach(field => {
      if (data[field]) {
        processedData[field] = data[field].toString().trim();
      }
    });

    // Boolean fields
    ['requiresEpiPen', 'verified', 'hereditary'].forEach(field => {
      if (typeof data[field] !== 'undefined') {
        processedData[field] = Boolean(data[field]);
      }
    });

    return {
      success: errors.length === 0,
      errors,
      processedData,
      message: errors.length === 0 ? 'Validation passed' : 'Validation failed'
    };
  }

  /**
   * Calculate allergy risk profile
   */
  calculateAllergyRiskProfile(allergyHistory) {
    const profile = {
      totalAllergies: allergyHistory.length,
      severityBreakdown: {
        mild: 0,
        moderate: 0,
        severe: 0,
        life_threatening: 0
      },
      categoryBreakdown: {},
      requiresEpiPen: false,
      riskScore: 0
    };

    let riskScore = 0;

    allergyHistory.forEach(allergy => {
      // Count by severity
      if (profile.severityBreakdown[allergy.severity]) {
        profile.severityBreakdown[allergy.severity]++;
      }

      // Count by category
      const category = allergy.category || 'other';
      profile.categoryBreakdown[category] = (profile.categoryBreakdown[category] || 0) + 1;

      // Check for EpiPen requirement
      if (allergy.requiresEpiPen) {
        profile.requiresEpiPen = true;
      }

      // Calculate risk score
      const severityScores = { mild: 1, moderate: 2, severe: 4, life_threatening: 8 };
      riskScore += severityScores[allergy.severity] || 0;
    });

    profile.riskScore = riskScore;

    // Determine risk level
    if (riskScore >= 8) {
      profile.riskLevel = 'high';
    } else if (riskScore >= 4) {
      profile.riskLevel = 'moderate';
    } else if (riskScore >= 1) {
      profile.riskLevel = 'low';
    } else {
      profile.riskLevel = 'none';
    }

    return profile;
  }

  /**
   * Create audit trail for allergy history operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data: { 
        allergen: data.allergen, 
        category: data.category,
        severity: data.severity 
      },
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientAllergyHistory] Audit trail created:', auditRecord);
  }
}

// Create singleton instance
const patientAllergyHistory = new PatientAllergyHistory();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientAllergyHistory', () => patientAllergyHistory);
}

module.exports = patientAllergyHistory;