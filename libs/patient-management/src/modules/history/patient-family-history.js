/**
 * Patient Family History Module
 * Handles family medical history tracking including genetic conditions and hereditary diseases
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientFamilyHistory {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-family-history');
    this.initialized = true;
    console.log('✅ [PatientFamilyHistory] Service initialized');
  }

  /**
   * Add family history entry for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} familyHistoryData - Family history data
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Addition result
   */
  async addFamilyHistoryEntry(patientId, familyHistoryData, practiceContext, session) {
    console.log('👨‍👩‍👧‍👦 [PatientFamilyHistory] Adding family history entry:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const validation = this.validateFamilyHistoryData(familyHistoryData);
      if (!validation.success) {
        return validation;
      }

      const historyEntry = {
        patientId,
        ...validation.processedData,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: session?.userId || 'system',
        practiceId: practiceContext.practiceId
      };

      const context = {
        serviceId: 'patient-family-history',
        operation: 'add-family-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.create('family_history', historyEntry, context);

      // Create audit trail
      await this.createAuditTrail(patientId, 'ADD_FAMILY_HISTORY', familyHistoryData, session, practiceContext);

      return {
        success: true,
        familyHistoryEntry: result,
        message: 'Family history entry added successfully'
      };

    } catch (error) {
      console.error('❌ [PatientFamilyHistory] Add entry failed:', error);
      return {
        success: false,
        error: 'ADD_FAMILY_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get family history for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Query options
   * @returns {Object} Family history
   */
  async getFamilyHistory(patientId, practiceContext, options = {}) {
    console.log('👨‍👩‍👧‍👦 [PatientFamilyHistory] Getting family history:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const context = {
        serviceId: 'patient-family-history',
        operation: 'get-family-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const queryOptions = {
        sort: { relationship: 1, createdAt: -1 },
        limit: options.limit || 100,
        skip: options.skip || 0
      };

      const query = { patientId };
      
      // Filter by relationship if specified
      if (options.relationship) {
        query.relationship = options.relationship;
      }
      
      // Filter by condition if specified
      if (options.condition) {
        query.condition = { $regex: options.condition, $options: 'i' };
      }

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const results = await SecureDataAccess.query('family_history', query, queryOptions, context);

      // Group by relationship for better organization
      const groupedHistory = this.groupByRelationship(results);

      return {
        success: true,
        familyHistory: results,
        groupedHistory,
        totalCount: results.length,
        message: 'Family history retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientFamilyHistory] Get family history failed:', error);
      return {
        success: false,
        error: 'GET_FAMILY_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Update family history entry
   * @param {string} entryId - Family history entry ID
   * @param {Object} updateData - Data to update
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Update result
   */
  async updateFamilyHistoryEntry(entryId, updateData, practiceContext, session) {
    console.log('👨‍👩‍👧‍👦 [PatientFamilyHistory] Updating family history entry:', entryId);

    try {
      const validation = this.validateFamilyHistoryData(updateData, true);
      if (!validation.success) {
        return validation;
      }

      const updateRecord = {
        ...validation.processedData,
        updatedAt: new Date(),
        updatedBy: session?.userId || 'system'
      };

      const context = {
        serviceId: 'patient-family-history',
        operation: 'update-family-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.update(
        'family_history',
        { _id: entryId },
        updateRecord,
        context
      );

      if (!result || result.matchedCount === 0) {
        return {
          success: false,
          error: 'ENTRY_NOT_FOUND',
          message: 'Family history entry not found'
        };
      }

      return {
        success: true,
        updatedCount: result.modifiedCount,
        message: 'Family history entry updated successfully'
      };

    } catch (error) {
      console.error('❌ [PatientFamilyHistory] Update entry failed:', error);
      return {
        success: false,
        error: 'UPDATE_FAMILY_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Analyze family history for genetic risk factors
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Risk analysis
   */
  async analyzeFamilyRiskFactors(patientId, practiceContext) {
    console.log('🧬 [PatientFamilyHistory] Analyzing genetic risk factors:', patientId);

    try {
      const familyHistory = await this.getFamilyHistory(patientId, practiceContext);
      if (!familyHistory.success) {
        return familyHistory;
      }

      const riskAnalysis = this.calculateGeneticRisks(familyHistory.familyHistory);

      return {
        success: true,
        riskAnalysis,
        recommendations: this.generateRiskRecommendations(riskAnalysis),
        message: 'Family risk analysis completed'
      };

    } catch (error) {
      console.error('❌ [PatientFamilyHistory] Risk analysis failed:', error);
      return {
        success: false,
        error: 'RISK_ANALYSIS_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Validate family history data
   */
  validateFamilyHistoryData(data, isUpdate = false) {
    const errors = [];
    const processedData = {};

    // Required fields for new entries
    if (!isUpdate) {
      if (!data.relationship) {
        errors.push('Family relationship is required');
      }
      if (!data.condition) {
        errors.push('Medical condition is required');
      }
    }

    // Validate relationship
    if (data.relationship) {
      const validRelationships = [
        'mother', 'father', 'sister', 'brother', 'maternal_grandmother', 'maternal_grandfather',
        'paternal_grandmother', 'paternal_grandfather', 'aunt', 'uncle', 'cousin', 'child', 'other'
      ];
      if (validRelationships.includes(data.relationship)) {
        processedData.relationship = data.relationship;
      } else {
        errors.push(`Invalid relationship. Must be one of: ${validRelationships.join(', ')}`);
      }
    }

    // Validate condition
    if (data.condition) {
      processedData.condition = data.condition.trim();
    }

    // Validate age at diagnosis
    if (data.ageAtDiagnosis) {
      const age = parseInt(data.ageAtDiagnosis);
      if (isNaN(age) || age < 0 || age > 120) {
        errors.push('Age at diagnosis must be a valid number between 0 and 120');
      } else {
        processedData.ageAtDiagnosis = age;
      }
    }

    // Validate severity
    if (data.severity) {
      const validSeverities = ['mild', 'moderate', 'severe'];
      if (validSeverities.includes(data.severity)) {
        processedData.severity = data.severity;
      } else {
        errors.push(`Invalid severity. Must be one of: ${validSeverities.join(', ')}`);
      }
    }

    // Validate status
    if (data.status) {
      const validStatuses = ['living', 'deceased'];
      if (validStatuses.includes(data.status)) {
        processedData.status = data.status;
      } else {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Optional fields
    ['notes', 'causeOfDeath', 'ageAtDeath', 'geneticTesting'].forEach(field => {
      if (data[field]) {
        processedData[field] = data[field].toString().trim();
      }
    });

    // Boolean fields
    if (typeof data.isGenetic !== 'undefined') {
      processedData.isGenetic = Boolean(data.isGenetic);
    }

    return {
      success: errors.length === 0,
      errors,
      processedData,
      message: errors.length === 0 ? 'Validation passed' : 'Validation failed'
    };
  }

  /**
   * Group family history by relationship
   */
  groupByRelationship(familyHistory) {
    const grouped = {};
    
    familyHistory.forEach(entry => {
      const relationship = entry.relationship || 'other';
      if (!grouped[relationship]) {
        grouped[relationship] = [];
      }
      grouped[relationship].push(entry);
    });

    return grouped;
  }

  /**
   * Calculate genetic risk factors
   */
  calculateGeneticRisks(familyHistory) {
    const risks = {
      cardiovascular: { score: 0, conditions: [] },
      cancer: { score: 0, conditions: [] },
      diabetes: { score: 0, conditions: [] },
      mentalHealth: { score: 0, conditions: [] },
      autoimmune: { score: 0, conditions: [] }
    };

    const riskConditions = {
      cardiovascular: ['heart disease', 'stroke', 'hypertension', 'heart attack'],
      cancer: ['cancer', 'tumor', 'leukemia', 'lymphoma'],
      diabetes: ['diabetes', 'type 1 diabetes', 'type 2 diabetes'],
      mentalHealth: ['depression', 'anxiety', 'bipolar', 'schizophrenia'],
      autoimmune: ['lupus', 'rheumatoid arthritis', 'multiple sclerosis', 'crohns']
    };

    familyHistory.forEach(entry => {
      const condition = entry.condition.toLowerCase();
      const relationshipWeight = this.getRelationshipWeight(entry.relationship);

      Object.keys(riskConditions).forEach(category => {
        riskConditions[category].forEach(riskCondition => {
          if (condition.includes(riskCondition)) {
            risks[category].score += relationshipWeight;
            risks[category].conditions.push({
              condition: entry.condition,
              relationship: entry.relationship,
              weight: relationshipWeight
            });
          }
        });
      });
    });

    return risks;
  }

  /**
   * Get relationship weight for risk calculation
   */
  getRelationshipWeight(relationship) {
    const weights = {
      'mother': 3, 'father': 3,
      'sister': 2, 'brother': 2,
      'maternal_grandmother': 1.5, 'maternal_grandfather': 1.5,
      'paternal_grandmother': 1.5, 'paternal_grandfather': 1.5,
      'aunt': 1, 'uncle': 1, 'cousin': 0.5,
      'child': 3, 'other': 0.5
    };
    return weights[relationship] || 0.5;
  }

  /**
   * Generate risk-based recommendations
   */
  generateRiskRecommendations(riskAnalysis) {
    const recommendations = [];

    Object.keys(riskAnalysis).forEach(category => {
      const risk = riskAnalysis[category];
      if (risk.score >= 3) {
        recommendations.push({
          category,
          priority: 'high',
          recommendation: `Consider genetic counseling and regular screening for ${category} conditions`
        });
      } else if (risk.score >= 1.5) {
        recommendations.push({
          category,
          priority: 'moderate',
          recommendation: `Monitor for ${category} conditions and maintain healthy lifestyle`
        });
      }
    });

    return recommendations;
  }

  /**
   * Create audit trail for family history operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data: { relationship: data.relationship, condition: data.condition },
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientFamilyHistory] Audit trail created:', auditRecord);
  }
}

// Create singleton instance
const patientFamilyHistory = new PatientFamilyHistory();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientFamilyHistory', () => patientFamilyHistory);
}

module.exports = patientFamilyHistory;