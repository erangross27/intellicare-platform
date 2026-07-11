/**
 * Patient Registration Initialization Module
 * Handles initial setup and validation for patient registration
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientRegistrationInit {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Authenticate service
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-registration-init');
    this.initialized = true;
    console.log('✅ [PatientRegInit] Service initialized');
  }

  /**
   * Initialize patient registration process
   * @param {Object} params - Patient registration parameters
   * @param {Object} practiceContext - Practice context information
   * @param {Object} session - Current session
   * @returns {Object} Initialization result
   */
  async initializeRegistration(params, practiceContext, session) {
    console.log('🔍 [PatientRegInit] Starting patient registration initialization');
    console.log('🏥 Practice context:', {
      country: practiceContext.country,
      practiceId: practiceContext.practiceId,
      practiceSubdomain: practiceContext.practiceSubdomain,
      language: practiceContext.language
    });

    // CRITICAL: Prevent empty parameter calls (race condition protection)
    if (!params || Object.keys(params).length === 0) {
      console.log('🔴 CRITICAL: Registration called with empty params - rejecting!');
      return {
        success: false,
        error: 'EMPTY_PARAMS',
        message: 'Cannot initialize registration with empty parameters. This might be a duplicate call from parallel execution.'
      };
    }

    // Validate minimum required fields
    if (!params.firstName || !params.lastName) {
      console.log('❌ Missing required fields: firstName or lastName');
      return {
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: practiceContext.language === 'he' 
          ? 'שם פרטי ושם משפחה הם שדות חובה'
          : 'First name and last name are required fields'
      };
    }

    // Initialize registration context
    const registrationContext = {
      sessionId: session?.sessionId || `reg_${Date.now()}`,
      startTime: new Date(),
      practiceContext,
      params: { ...params },
      steps: {
        validation: 'pending',
        duplicateCheck: 'pending', 
        dataProcessing: 'pending',
        confirmation: 'pending'
      }
    };

    console.log('✅ [PatientRegInit] Registration context initialized');
    return {
      success: true,
      registrationContext,
      nextStep: 'validation',
      message: practiceContext.language === 'he'
        ? 'תהליך רישום המטופל התחיל'
        : 'Patient registration process started'
    };
  }

  /**
   * Validate session and context
   * @param {Object} session - Current session
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  validateSession(session, practiceContext) {
    if (!session) {
      return {
        success: false,
        error: 'NO_SESSION',
        message: 'No active session found'
      };
    }

    if (!practiceContext || !practiceContext.practiceId) {
      return {
        success: false,
        error: 'INVALID_CLINIC_CONTEXT',
        message: 'Invalid practice context'
      };
    }

    return {
      success: true,
      message: 'Session and context validated'
    };
  }

  /**
   * Get registration status for tracking
   * @param {string} sessionId - Session ID
   * @returns {Object} Registration status
   */
  async getRegistrationStatus(sessionId) {
    // This would typically query the database for status
    // For now, return a basic status structure
    return {
      sessionId,
      status: 'initialized',
      createdAt: new Date(),
      steps: {
        validation: 'pending',
        duplicateCheck: 'pending',
        dataProcessing: 'pending', 
        confirmation: 'pending'
      }
    };
  }

  /**
   * Clean up registration context on completion or error
   * @param {string} sessionId - Session ID to clean up
   */
  async cleanupRegistration(sessionId) {
    console.log(`🧹 [PatientRegInit] Cleaning up registration session: ${sessionId}`);
    // Implementation would remove temporary data, close resources, etc.
    return {
      success: true,
      message: 'Registration cleanup completed'
    };
  }
}

const patientRegistrationInit = new PatientRegistrationInit();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientRegistrationInit', () => patientRegistrationInit);
}

module.exports = patientRegistrationInit;