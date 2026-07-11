/**
 * 🌐 GLOBAL MODEL LOADER SERVICE
 * 
 * Manages platform-level models that need to exist in the global database.
 * These models are used across all practices and handle security, policies, and platform management.
 * 
 * SECURITY: This service ensures security-critical models are properly initialized
 * on the global database connection, preventing timeout issues.
 */

// Add this service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class GlobalModelLoader {
  constructor() {
    this.serviceToken = null;
    this.globalConnection = null;
    this.models = {};
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the global model loader
   */
  async initialize() {
    // Prevent multiple initialization attempts
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  /**
   * Internal initialization logic
   */
  async _performInitialization() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Get services through proxy to avoid circular dependencies
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const databaseFactory = proxy.getService('databaseFactory');
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('global-model-loader-service');

      // Get global database connection
      this.globalConnection = await databaseFactory.getGlobalDatabase();
      
      if (!this.globalConnection || this.globalConnection.readyState !== 1) {
        throw new Error('Global database connection is not ready');
      }

      // Load and register models on the global connection
      await this.loadGlobalModels();

      this.isInitialized = true;
      console.log('✅ Global Model Loader initialized');

    } catch (error) {
      console.error('❌ Global Model Loader initialization failed:', error);
      this.isInitialized = false;
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Load all global models and register them on the global connection
   */
  async loadGlobalModels() {
    try {
      // Check if models are already registered on the global connection
      if (!this.globalConnection.models.ServiceAccount) {
        // Load ServiceAccount model
        const ServiceAccountSchema = require('../../../../../backend/models/ServiceAccount').schema;
        this.models.ServiceAccount = this.globalConnection.model('ServiceAccount', ServiceAccountSchema);
      } else {
        this.models.ServiceAccount = this.globalConnection.models.ServiceAccount;
      }

      if (!this.globalConnection.models.DataAccessPolicy) {
        // Load DataAccessPolicy model  
        const DataAccessPolicySchema = require('../../../../../backend/models/DataAccessPolicy').schema;
        this.models.DataAccessPolicy = this.globalConnection.model('DataAccessPolicy', DataAccessPolicySchema);
      } else {
        this.models.DataAccessPolicy = this.globalConnection.models.DataAccessPolicy;
      }

      if (!this.globalConnection.models.Practice) {
        // Load Practice model (it's also global)
        const ClinicSchema = require('../../../../../backend/models/Practice').schema;
        this.models.Practice = this.globalConnection.model('Practice', ClinicSchema);
      } else {
        this.models.Practice = this.globalConnection.models.Practice;
      }

      // Create default data access policies if they don't exist
      await this.createDefaultPolicies();

    } catch (error) {
      console.error('❌ Failed to load global models:', error);
      throw error;
    }
  }

  /**
   * Create default data access policies for core collections
   */
  async createDefaultPolicies() {
    try {
      const coreCollections = [
        'patients', 'documents', 'appointments', 'users', 
        'audit_logs', 'chatsessions', 'chatmessages'
      ];

      for (const collection of coreCollections) {
        const existing = await this.models.DataAccessPolicy.findOne({
          serviceId: '*',
          targetCollection: collection,
          active: true
        });

        if (!existing) {
          console.log(`  Creating default policy for ${collection}...`);
          
          const defaultPolicy = new this.models.DataAccessPolicy({
            policyId: `default-${collection}`,
            policyName: `Default Policy for ${collection}`,
            serviceId: '*',
            targetCollection: collection,
            rowLevelSecurity: {
              enabled: true,
              customRules: new Map([['_deleted', { $ne: true }]])
            },
            allowedFields: ['*'],
            deniedFields: ['_securityMetadata'],
            fieldMasking: new Map(),
            sensitiveFields: [],
            accessControl: {
              defaultAccessLevel: 'internal'
            },
            auditConfig: {
              auditReads: true,
              auditWrites: true,
              detailLevel: 'basic'
            },
            compliance: {
              hipaaCompliant: true,
              gdprCompliant: true,
              encryptionRequired: true
            },
            createdBy: 'system'
          });

          await defaultPolicy.save();
          console.log(`  ✅ Created default policy for ${collection}`);
        }
      }

    } catch (error) {
      console.warn('⚠️ Warning: Failed to create default policies:', error.message);
      // Don't throw here as this is not critical for startup
    }
  }

  /**
   * Get a global model by name
   * @param {string} modelName - Name of the model to retrieve
   * @returns {mongoose.Model} The requested model
   */
  getModel(modelName) {
    if (!this.isInitialized) {
      throw new Error('Global Model Loader not initialized. Call initialize() first.');
    }

    if (!this.models[modelName]) {
      throw new Error(`Global model '${modelName}' not found. Available models: ${Object.keys(this.models).join(', ')}`);
    }

    return this.models[modelName];
  }

  /**
   * Get ServiceAccount model
   * @returns {mongoose.Model} ServiceAccount model
   */
  getServiceAccountModel() {
    return this.getModel('ServiceAccount');
  }

  /**
   * Get DataAccessPolicy model
   * @returns {mongoose.Model} DataAccessPolicy model
   */
  getDataAccessPolicyModel() {
    return this.getModel('DataAccessPolicy');
  }

  /**
   * Get Practice model
   * @returns {mongoose.Model} Practice model
   */
  getClinicModel() {
    return this.getModel('Practice');
  }

  /**
   * Check if the loader is initialized
   * @returns {boolean} True if initialized
   */
  isReady() {
    return this.isInitialized && 
           this.globalConnection && 
           this.globalConnection.readyState === 1;
  }

  /**
   * Get connection status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      connectionReady: this.globalConnection ? this.globalConnection.readyState === 1 : false,
      modelsLoaded: Object.keys(this.models),
      modelCount: Object.keys(this.models).length
    };
  }

  /**
   * Health check for the global model loader
   * @returns {Object} Health status
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      initialized: this.isInitialized,
      connection: false,
      models: {},
      errors: []
    };

    try {
      // Check connection
      if (this.globalConnection && this.globalConnection.readyState === 1) {
        await this.globalConnection.db.admin().ping();
        health.connection = true;
      } else {
        health.connection = false;
        health.errors.push('Global database connection not ready');
      }

      // Check models
      for (const [name, model] of Object.entries(this.models)) {
        try {
          // Try to perform a simple query to verify model works
          await model.estimatedDocumentCount();
          health.models[name] = true;
        } catch (error) {
          health.models[name] = false;
          health.errors.push(`${name} model error: ${error.message}`);
        }
      }

      // Determine overall status
      if (health.errors.length > 0) {
        health.status = 'degraded';
      }

      if (!health.initialized || !health.connection) {
        health.status = 'unhealthy';
      }

    } catch (error) {
      health.status = 'unhealthy';
      health.errors.push(`Health check failed: ${error.message}`);
    }

    return health;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up Global Model Loader...');
      
      // Clear models
      this.models = {};
      
      // Don't close the global connection as it's managed by databaseFactory
      this.globalConnection = null;
      
      this.isInitialized = false;
      this.initializationPromise = null;
      
      console.log('✅ Global Model Loader cleanup completed');
      
    } catch (error) {
      console.error('❌ Error during Global Model Loader cleanup:', error);
    }
  }
}

// Create singleton instance
const globalModelLoader = new GlobalModelLoader();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('globalModelLoader', () => {
    return globalModelLoader;
  });
}

module.exports = globalModelLoader;