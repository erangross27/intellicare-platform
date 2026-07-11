/**
 * Allergies Assessments CRUD Service
 * Handles get, create, update, delete, and search operations for allergies_assessments and allergy_immunology_assessment collections
 * These are the actual function implementations that Claude calls through agentServiceV4
 */

const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');

class AllergiesAssessmentsService {
  constructor() {
    this.serviceName = 'AllergiesAssessmentsService';
    this.serviceAuth = null;
  }

  /**
   * Initialize service with authentication
   */
  async initialize() {
    if (!this.serviceAuth) {
      this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);
      console.log(`✅ ${this.serviceName} authenticated successfully`);
    }
    return this.serviceAuth;
  }

  /**
   * GET allergies_assessments
   * Retrieves all allergy assessments for a patient with optional filtering
   * Returns artifact panel format for display
   */
  async getAllergiesAssessments(args, context) {
    try {
      const { patientId, dateFrom, dateTo, limit = 100, sortBy = 'date' } = args;

      console.log(`🔍 [getAllergiesAssessments] patientId: ${patientId}, type: ${typeof patientId}`);

      const objectId = new ObjectId(patientId);
      console.log(`✅ [getAllergiesAssessments] Converted to ObjectId: ${objectId}`);

      const filter = { patientId: objectId };
      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = new Date(dateFrom);
        if (dateTo) filter.date.$lte = new Date(dateTo);
      }

      const options = {
        limit,
        sort: sortBy === 'severity'
          ? { severity: -1, date: -1 }
          : { date: -1 }
      };

      console.log(`🔎 [getAllergiesAssessments] Filter: ${JSON.stringify(filter)}`);
      const result = await SecureDataAccess.query('allergy_assessments', filter, options, context);
      console.log(`📊 [getAllergiesAssessments] Query returned ${result?.length || 0} records`);

      // Return in artifact panel format
      return {
        success: true,
        displayType: 'openArtifactPanel',
        artifactPanel: {
          patientId: patientId,
          category: 'allergy_assessments',
          type: 'documents',
          data: result || []
        },
        data: result || []
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error in getAllergiesAssessments:`, error);
      throw error;
    }
  }

  /**
   * CREATE allergies_assessment
   * Creates a new allergy assessment record
   */
  async createAllergiesAssessment(args, context) {
    try {
      const { patientId, allergen, testName, severity, testResults = [], recommendations = [], performer, datePerformed } = args;

      const record = {
        patientId: new ObjectId(patientId),
        allergen,
        testName,
        severity,
        testResults,
        recommendations,
        performer,
        datePerformed: datePerformed ? new Date(datePerformed) : new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'manual_entry'
      };

      const result = await SecureDataAccess.insert('allergies_assessments', record, context);
      return result;
    } catch (error) {
      console.error(`[${this.serviceName}] Error in createAllergiesAssessment:`, error);
      throw error;
    }
  }

  /**
   * UPDATE allergies_assessment
   * Updates an existing allergy assessment record
   */
  async updateAllergiesAssessment(args, context) {
    try {
      const { recordId, allergen, severity, testResults, recommendations } = args;

      const updates = {
        ...(allergen && { allergen }),
        ...(severity && { severity }),
        ...(testResults && { testResults }),
        ...(recommendations && { recommendations }),
        updatedAt: new Date()
      };

      const result = await SecureDataAccess.update(
        'allergies_assessments',
        { _id: new ObjectId(recordId) },
        updates,
        context
      );
      return result;
    } catch (error) {
      console.error(`[${this.serviceName}] Error in updateAllergiesAssessment:`, error);
      throw error;
    }
  }

  /**
   * DELETE allergies_assessment
   * Deletes an allergy assessment record
   */
  async deleteAllergiesAssessment(args, context) {
    try {
      const { recordId } = args;

      const result = await SecureDataAccess.delete(
        'allergies_assessments',
        { _id: new ObjectId(recordId) },
        context
      );
      return result;
    } catch (error) {
      console.error(`[${this.serviceName}] Error in deleteAllergiesAssessment:`, error);
      throw error;
    }
  }

  /**
   * SEARCH allergies_assessments
   * Searches allergy assessments by text, allergen, severity, or date
   */
  async searchAllergiesAssessments(args, context) {
    try {
      const { patientId, searchText, severity, dateFrom, dateTo, limit = 50 } = args;

      const filter = { patientId: new ObjectId(patientId) };

      if (searchText) {
        filter.$or = [
          { allergen: { $regex: searchText, $options: 'i' } },
          { testName: { $regex: searchText, $options: 'i' } },
          { performer: { $regex: searchText, $options: 'i' } }
        ];
      }

      if (severity) {
        filter.severity = severity;
      }

      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = new Date(dateFrom);
        if (dateTo) filter.date.$lte = new Date(dateTo);
      }

      const options = { limit, sort: { date: -1 } };
      const result = await SecureDataAccess.query('allergy_assessments', filter, options, context);
      return result || [];
    } catch (error) {
      console.error(`[${this.serviceName}] Error in searchAllergiesAssessments:`, error);
      throw error;
    }
  }

  /**
   * CHECK patient allergies against proposed medication
   * Combines patient allergy data with cross-sensitivity checking
   * Critical for medication safety - prevents adverse allergic reactions
   */
  async checkPatientForAllergies(args, context) {
    try {
      const { patientId, medication, language = 'en' } = args;

      if (!patientId) {
        return {
          success: false,
          message: language === 'he' ? 'חסר מזהה מטופל' : 'Patient ID required'
        };
      }

      if (!medication) {
        return {
          success: false,
          message: language === 'he' ? 'חסר שם תרופה' : 'Medication name required'
        };
      }

      // Get patient allergies from database
      const { generatedMedicalFunctions } = require('./generatedMedicalFunctions');
      const allergiesResult = await generatedMedicalFunctions.getAllergies.handler({
        patientId: patientId
      }, context);

      if (!allergiesResult.success) {
        return {
          success: false,
          message: language === 'he'
            ? 'שגיאה בקריאת אלרגיות המטופל'
            : 'Error retrieving patient allergies'
        };
      }

      // Extract allergy list from result
      const patientAllergies = allergiesResult.data || [];

      // If no allergies, medication is safe
      if (patientAllergies.length === 0) {
        return {
          success: true,
          safe: true,
          message: language === 'he'
            ? 'אין אלרגיות רשומות למטופל - התרופה בטוחה'
            : 'No known allergies - Medication is safe',
          patientAllergies: [],
          checkResult: {
            safe: true,
            directAllergy: false,
            crossSensitivity: [],
            warnings: [],
            recommendations: [],
            alternatives: []
          }
        };
      }

      // Check medication against patient allergies using allergyChecker service
      const allergyChecker = require('./allergyChecker');
      const checkResult = await allergyChecker.checkAllergies(
        patientAllergies,
        medication,
        language,
        { patientId }
      );

      return {
        success: true,
        safe: checkResult.safe,
        medication: medication,
        patientAllergies: patientAllergies,
        checkResult: checkResult,
        message: checkResult.safe
          ? (language === 'he' ? 'התרופה בטוחה למטופל' : 'Medication is safe for patient')
          : (language === 'he' ? 'אזהרה: התרופה עלולה לגרום לתגובה אלרגית!' : 'WARNING: Medication may cause allergic reaction!')
      };

    } catch (error) {
      console.error(`[${this.serviceName}] Error in checkPatientForAllergies:`, error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }
}

module.exports = new AllergiesAssessmentsService();
