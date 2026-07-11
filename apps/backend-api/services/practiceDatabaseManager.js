/**
 * Practice Database Manager Service
 * 
 * Handles practice-specific database operations that require SecureDataAccess.
 * This service breaks the circular dependency between databaseFactory and SecureDataAccess.
 * 
 * Initialization Order:
 * 1. databaseFactory (pure connection management)
 * 2. globalModelLoader (needs databaseFactory)
 * 3. SecureDataAccess (needs globalModelLoader)
 * 4. ClinicDatabaseManager (needs both databaseFactory and SecureDataAccess)
 */

const databaseFactory = require('../utils/databaseFactory');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');

class ClinicDatabaseManager {
  constructor() {
    this.serviceToken = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Authenticate with service account manager
      this.serviceToken = await serviceAccountManager.authenticate('practice-database-manager');
      this.isInitialized = true;
      console.log('✅ Practice Database Manager initialized');
    } catch (error) {
      console.error('❌ Practice Database Manager initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Get all practice databases for monitoring
   * @returns {Array} Array of practice database connections
   */
  async getAllClinicDatabases() {
    const practices = [];

    try {
      // Add timeout for global database operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Global database timeout')), 15000); // 15 second timeout
      });

      const globalDbPromise = databaseFactory.getGlobalDatabase();
      const globalDb = await Promise.race([globalDbPromise, timeoutPromise]);

      // Check if global database connection is alive
      if (!globalDb || globalDb.readyState !== 1) {
        console.log('⚠️ Global database not connected, using fallback practice list');
        throw new Error('Global database not connected');
      }

      // Import and register the Practice model if not already registered
      let Practice;
      try {
        Practice = globalDb.model('Practice');
      } catch (error) {
        // Model not registered, register it
        const ClinicModel = require('../models/Practice');
        Practice = ClinicModel.createModel ? ClinicModel.createModel(globalDb) : globalDb.model('Practice', ClinicModel);
      }

      // Check authentication before operations
      if (!this.serviceToken || !this.serviceToken.apiKey) {
        console.error('ClinicDatabaseManager not authenticated - cannot get practice databases');
        throw new Error('Service not authenticated');
      }
      
      // Add timeout for practice query with proper authentication
      const context = {
        serviceId: 'practice-database-manager',
        apiKey: this.serviceToken.apiKey, // Use real API key
        operation: 'getActiveClinics',
        practiceId: 'global'
      };
      
      const clinicDocs = await SecureDataAccess.query('practices', { status: 'active' }, {
        projection: 'subdomain name',
        maxTimeMS: 10000 // 10 second timeout
      }, context);

      for (const practice of clinicDocs) {
        try {
          // Get connection from databaseFactory
          const connections = databaseFactory.connections;
          
          // Only get practice database if connection exists and is healthy
          if (connections.has(`intellicare_practice_${practice.subdomain}`)) {
            const connection = connections.get(`intellicare_practice_${practice.subdomain}`);
            if (connection && connection.readyState === 1) {
              practices.push({
                subdomain: practice.subdomain,
                name: practice.name,
                db: connection
              });
            } else {
              console.log(`⚠️ Skipping practice ${practice.subdomain} - connection not healthy`);
            }
          } else {
            // Try to establish connection with timeout (internal call)
            const connectionPromise = databaseFactory.getPracticeDatabase(practice.subdomain, true);
            const connectionTimeout = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Connection timeout')), 5000); // 5 second timeout
            });
            
            try {
              const connection = await Promise.race([connectionPromise, connectionTimeout]);
              if (connection && connection.readyState === 1) {
                practices.push({
                  subdomain: practice.subdomain,
                  name: practice.name,
                  db: connection
                });
              }
            } catch (connError) {
              console.log(`⚠️ Failed to connect to practice ${practice.subdomain}:`, connError.message);
            }
          }
        } catch (error) {
          console.error(`Error getting database for practice ${practice.subdomain}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Failed to get practice databases:', error.message);
      
      // Fallback: return existing healthy connections
      const connections = databaseFactory.connections;
      for (const [key, connection] of connections) {
        if (key.startsWith('intellicare_practice_') && connection && connection.readyState === 1) {
          const subdomain = key.replace('intellicare_practice_', '');
          if (subdomain !== 'global') {
            practices.push({
              subdomain: subdomain,
              name: subdomain,
              db: connection
            });
          }
        }
      }
    }

    return practices;
  }

  /**
   * Get a single clinic database by subdomain
   * @param {string} practiceSubdomain - The practice subdomain
   * @returns {Object} Mongoose connection to the practice database
   */
  async getClinicDatabase(practiceSubdomain) {
    if (!practiceSubdomain) {
      throw new Error('Practice subdomain is required');
    }

    try {
      // Use databaseFactory to get the practice database connection
      const connection = await databaseFactory.getPracticeDatabase(practiceSubdomain, true);

      if (!connection || connection.readyState !== 1) {
        throw new Error(`Failed to connect to practice database: ${practiceSubdomain}`);
      }

      return connection;
    } catch (error) {
      console.error(`❌ Error getting clinic database for ${practiceSubdomain}:`, error.message);
      throw error;
    }
  }

  /**
   * Get health status for all practice databases
   * @returns {Object} Health status object
   */
  async getHealthStatus() {
    const health = {
      status: 'healthy',
      globalDatabase: false,
      clinicDatabases: {},
      totalClinics: 0,
      healthyClinics: 0,
      errors: []
    };

    try {
      // Check global database
      const globalDb = await databaseFactory.getGlobalDatabase();
      if (globalDb && globalDb.readyState === 1) {
        await globalDb.db.admin().ping();
        health.globalDatabase = true;
      } else {
        health.globalDatabase = false;
        health.errors.push('Global database not connected');
      }

      // Check practice databases
      const practices = await this.getAllClinicDatabases();
      health.totalClinics = practices.length;
      
      for (const practice of practices) {
        if (practice.db && practice.db.readyState === 1) {
          health.clinicDatabases[practice.subdomain] = true;
          health.healthyClinics++;
        } else {
          health.clinicDatabases[practice.subdomain] = false;
          health.errors.push(`Practice ${practice.subdomain} database not healthy`);
        }
      }

      // Determine overall status
      if (health.errors.length > 0) {
        health.status = 'degraded';
      }
      
      if (!health.globalDatabase || health.healthyClinics === 0) {
        health.status = 'unhealthy';
      }

    } catch (error) {
      health.status = 'unhealthy';
      health.errors.push(`Health check failed: ${error.message}`);
    }

    return health;
  }
}

// Create singleton instance
const clinicDatabaseManager = new ClinicDatabaseManager();

module.exports = clinicDatabaseManager;