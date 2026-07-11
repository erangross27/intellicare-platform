/**
 * Redis Data Synchronization Service
 * Pre-populates Redis with all data and keeps it synchronized with MongoDB
 * This ensures all queries are served from cache with <50ms response time
 */

const redis = require('./redisCache');
const SecureDataAccess = require('./secureDataAccess');
const medicalDataService = require('./medicalDataService');
const serviceAccountManager = require('./serviceAccountManager');
const { ObjectId } = require('mongodb');

class RedisDataSync {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    this.medicalCollections = [
      'lab_results', 'medications', 'diagnoses', 'vital_signs', 'allergies',
      'consultation_notes', 'prescriptions', 'medical_history', 'chief_complaints',
      'recommendations', 'diabetes_management_notes'
    ];
    this.coreCollections = [
      'patients', 'appointments', 'users', 'documents', 'patient_provider'
    ];
  }

  /**
   * Initialize the service with authentication and pre-populate cache
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔄 Initializing Redis Data Sync Service...');

      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('redis-data-sync');

      // Ensure Redis is connected
      if (!redis || !redis.status || redis.status !== 'ready') {
        console.log('⚠️ Redis not ready, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      this.initialized = true;
      console.log('✅ Redis Data Sync Service initialized');

      // Pre-populate cache on server startup
      console.log('🚀 Starting cache pre-population...');
      this.initializeCache()
        .then(result => {
          console.log(`✅ Cache pre-population completed: ${result.practicesCached} practices cached in ${result.duration}ms`);
        })
        .catch(error => {
          console.error('❌ Cache pre-population failed:', error);
          // Don't throw - allow server to continue without pre-populated cache
        });

    } catch (error) {
      console.error('❌ Failed to initialize Redis Data Sync:', error);
      throw error;
    }
  }

  /**
   * Pre-load all data into Redis on server startup
   * This is the initial cache warming
   */
  async initializeCache() {
    const startTime = Date.now();
    console.log('🚀 Pre-loading all data into Redis...');

    try {
      await this.initialize();

      // Dynamically discover all practices from the database
      let practices = [];

      // Use MongoDB directly to list all practice databases
      const { MongoClient } = require('mongodb');
      let client;

      try {
        // Connect to MongoDB to list databases using credentials from KMS
        const productionKMS = require('./productionKMS');
        if (!productionKMS.initialized) {
          await productionKMS.initialize();
        }

        const username = await productionKMS.getInternalKey('MONGODB_APP_USERNAME') || 'intellicare_app';
        const password = await productionKMS.getInternalKey('MONGODB_APP_PASSWORD');

        let mongoUrl;
        if (username && password) {
          mongoUrl = `mongodb://${username}:${encodeURIComponent(password)}@localhost:27017?authSource=admin`;
        } else {
          // Fallback to no auth if KMS doesn't have credentials
          mongoUrl = 'mongodb://localhost:27017';
        }

        client = new MongoClient(mongoUrl);
        await client.connect();

        // List all databases
        const admin = client.db().admin();
        const dbList = await admin.listDatabases();

        // Find all practice databases (format: intellicare_practice_{subdomain})
        const practiceDatabases = dbList.databases
          .filter(db => db.name.startsWith('intellicare_practice_') &&
                       db.name !== 'intellicare_practice_global')
          .map(db => {
            const subdomain = db.name.replace('intellicare_practice_', '');
            return {
              _id: subdomain,
              name: `${subdomain} Practice`,
              subdomain: subdomain,
              active: true
            };
          });

        practices = practiceDatabases;
        console.log(`📊 Dynamically found ${practices.length} practice databases: ${practices.map(p => p.subdomain).join(', ')}`);

      } catch (error) {
        console.error('❌ Failed to dynamically discover practices:', error.message);

        // Fallback: Try to get from global database
        try {
          practices = await SecureDataAccess.query(
            'practices',
            {},
            {},
            {
              serviceId: 'redis-data-sync',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              operation: 'cache-warming',
              practiceId: 'global'
            }
          );
        } catch (err) {
          console.log('⚠️ Could not query practices from global database');
        }
      } finally {
        if (client) {
          await client.close();
        }
      }

      // Ensure we have at least some practices to cache
      if (practices.length === 0) {
        console.log('⚠️ No practices found - cache initialization skipped');
        return { success: true, duration: 0, practicesCached: 0 };
      }

      console.log(`📊 Found ${practices.length} practices to cache`);

      // Process each practice
      for (const practice of practices) {
        await this.cachePracticeData(practice);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Redis pre-population complete in ${duration}ms`);

      // Set a flag indicating cache is warmed
      await redis.set('cache:warmed', true, 86400); // 24 hour expiry in seconds

      return { success: true, duration, practicesCached: practices.length };

    } catch (error) {
      console.error('❌ Failed to initialize cache:', error);
      throw error;
    }
  }

  /**
   * Cache all data for a specific practice
   */
  async cachePracticeData(practice) {
    const practiceStart = Date.now();
    console.log(`   📁 Caching data for practice: ${practice.name} (${practice.subdomain})`);

    try {
      const context = {
        serviceId: 'redis-data-sync',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'cache-practice-data',
        practiceId: practice._id.toString(),
        practiceSubdomain: practice.subdomain
      };

      // Initialize medicalDataService for this practice if needed
      if (!medicalDataService.initialized ||
          medicalDataService.lastInitContext !== JSON.stringify({
            practiceId: context.practiceId,
            practiceSubdomain: context.practiceSubdomain
          })) {
        await medicalDataService.initialize(context);
      }

      // Cache all core collections for this practice
      console.log('📊 Starting comprehensive cache for practice:', practice.subdomain);

      // 1. Cache all patients (most important)
      console.log('👥 Caching patients list...');
      const patients = await this.cachePatientsList(practice.subdomain, context);

      // 2. Cache all appointments
      console.log('📅 Caching appointments...');
      await this.cacheCollection('appointments', practice.subdomain, context);

      // 3. Cache all users
      console.log('👤 Caching users...');
      await this.cacheCollection('users', practice.subdomain, context);

      // 4. Cache all documents metadata
      console.log('📄 Caching documents...');
      await this.cacheCollection('documents', practice.subdomain, context);

      // Batch process patients for better performance
      const BATCH_SIZE = 5;
      const batches = [];

      for (let i = 0; i < patients.length; i += BATCH_SIZE) {
        batches.push(patients.slice(i, i + BATCH_SIZE));
      }

      let cachedCount = 0;
      for (const batch of batches) {
        // Process batch in parallel
        await Promise.all(
          batch.map(async (patient) => {
            await this.cachePatientMedicalHistory(
              practice.subdomain,
              patient._id.toString(),
              context
            );
          })
        );

        cachedCount += batch.length;
        console.log(`      ✅ Cached ${cachedCount}/${patients.length} patients`);
      }

      // Pre-cache common AI function mappings for this practice
      await this.cacheFunctionMappings(practice.subdomain);

      // Cache metadata
      await this.cachePracticeMetadata(practice.subdomain, {
        patientCount: patients.length,
        lastUpdated: new Date().toISOString(),
        collections: this.medicalCollections,
        cacheWarmed: true
      });

      const duration = Date.now() - practiceStart;
      console.log(`   ✅ Practice ${practice.subdomain}: ${patients.length} patients cached in ${duration}ms`);

    } catch (error) {
      console.error(`   ❌ Failed to cache practice ${practice.subdomain}:`, error.message);
    }
  }

  /**
   * Cache any collection for a practice
   */
  async cacheCollection(collectionName, practiceSubdomain, context) {
    try {
      const data = await SecureDataAccess.query(
        collectionName,
        { deleted: { $ne: true } },
        {},
        context
      );

      if (data && data.length > 0) {
        // Store in Redis with optimized key
        const cacheKey = `practice:${practiceSubdomain}:${collectionName}:all`;
        await redis.set(
          cacheKey,
          data, // redis.set will handle JSON.stringify
          3600  // TTL in seconds (1 hour)
        );

        console.log(`      📝 Cached ${data.length} ${collectionName} records for ${practiceSubdomain}`);
        return data;
      }

      return [];
    } catch (error) {
      console.error(`Failed to cache ${collectionName}:`, error.message);
      return [];
    }
  }

  /**
   * Cache the list of all patients for a practice
   */
  async cachePatientsList(practiceSubdomain, context) {
    try {
      const patients = await SecureDataAccess.query(
        'patients',
        { deleted: { $ne: true } },
        {
          projection: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            nationalId: 1,
            ssn: 1,
            dateOfBirth: 1,
            phone: 1,
            email: 1,
            address: 1,
            medicalRecordNumber: 1,
            lastVisit: 1
          },
          sort: { lastName: 1, firstName: 1 }
        },
        context
      );

      // Store in Redis with TTL
      const cacheKey = `practice:${practiceSubdomain}:patients:all`;
      await redis.set(
        cacheKey,
        patients,  // redis.set will handle JSON.stringify
        3600 // TTL in seconds (1 hour)
      );

      console.log(`      📝 Cached ${patients.length} patients for ${practiceSubdomain}`);
      return patients;

    } catch (error) {
      console.error(`Failed to cache patients list:`, error);
      return [];
    }
  }

  /**
   * Cache medical history for a specific patient
   */
  async cachePatientMedicalHistory(practiceSubdomain, patientId, context) {
    try {
      // Get AI clinical insights using the existing optimized function
      const history = await medicalDataService.getAIClinicalInsights(patientId, context);

      // Store in Redis
      const cacheKey = `practice:${practiceSubdomain}:patient:${patientId}:history`;
      await redis.set(
        cacheKey,
        history,  // redis.set will handle JSON.stringify
        3600 // TTL in seconds (1 hour)
      );

      // Also cache a summary for quick stats
      const summary = {
        totalRecords: Object.values(history).flat().length,
        collections: Object.keys(history),
        lastUpdated: new Date().toISOString()
      };

      await redis.set(
        `practice:${practiceSubdomain}:patient:${patientId}:summary`,
        summary,  // redis.set will handle JSON.stringify
        3600 // TTL in seconds
      );

      return history;

    } catch (error) {
      console.error(`Failed to cache medical history for patient ${patientId}:`, error.message);
      return {};
    }
  }

  /**
   * Cache practice metadata
   */
  async cachePracticeMetadata(practiceSubdomain, metadata) {
    const cacheKey = `practice:${practiceSubdomain}:metadata`;
    await redis.set(
      cacheKey,
      metadata,  // redis.set will handle JSON.stringify
      86400 // TTL in seconds (24 hours)
    );
  }

  /**
   * Refresh patient list when patients collection changes
   */
  async refreshPatientsList(practiceSubdomain, practiceId) {
    console.log(`🔄 Refreshing patients list for ${practiceSubdomain}`);

    const context = {
      serviceId: 'redis-data-sync',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      operation: 'refresh-patients',
      practiceId: practiceId,
      practiceSubdomain: practiceSubdomain
    };

    await this.cachePatientsList(practiceSubdomain, context);
  }

  /**
   * Refresh patient medical history when medical data changes
   */
  async refreshPatientHistory(practiceSubdomain, practiceId, patientId) {
    console.log(`🔄 Refreshing medical history for patient ${patientId}`);

    const context = {
      serviceId: 'redis-data-sync',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      operation: 'refresh-medical-history',
      practiceId: practiceId,
      practiceSubdomain: practiceSubdomain
    };

    await this.cachePatientMedicalHistory(practiceSubdomain, patientId, context);
  }

  /**
   * Handle database changes from MongoDB Change Streams
   * This is called whenever data changes in MongoDB
   */
  async onDataChange(change) {
    try {
      const { operationType, ns, fullDocument, documentKey } = change;
      const collection = ns?.coll;

      if (!collection) return;

      console.log(`📝 Processing ${operationType} on ${collection}`);

      // Get practice information from the change
      const practiceId = fullDocument?.practiceId || change.practiceId;
      const practiceSubdomain = fullDocument?.practiceSubdomain || change.practiceSubdomain;

      if (!practiceSubdomain || !practiceId) {
        // Try to get practice info from the database name
        const dbName = ns?.db;
        if (dbName && dbName.startsWith('intellicare_practice_')) {
          const subdomain = dbName.replace('intellicare_practice_', '');

          // Get practice details
          const practices = await SecureDataAccess.query(
            'practices',
            { subdomain: subdomain },
            { limit: 1 },
            {
              serviceId: 'redis-data-sync',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              operation: 'get-practice',
              practiceId: 'global'
            }
          );

          if (practices && practices.length > 0) {
            await this.handleCollectionChange(
              collection,
              practices[0].subdomain,
              practices[0]._id.toString(),
              fullDocument,
              operationType
            );
          }
        }
      } else {
        await this.handleCollectionChange(
          collection,
          practiceSubdomain,
          practiceId,
          fullDocument,
          operationType
        );
      }

    } catch (error) {
      console.error('❌ Error handling data change:', error);
    }
  }

  /**
   * Handle specific collection changes
   */
  async handleCollectionChange(collection, practiceSubdomain, practiceId, document, operation) {
    // Handle patient collection changes
    if (collection === 'patients') {
      await this.refreshPatientsList(practiceSubdomain, practiceId);

      // If patient was added/updated, also cache their medical history
      if (document && document._id && (operation === 'insert' || operation === 'update')) {
        await this.refreshPatientHistory(
          practiceSubdomain,
          practiceId,
          document._id.toString()
        );
      }
    }

    // Handle medical collection changes
    if (this.medicalCollections.includes(collection)) {
      const patientId = document?.patientId || document?.patient_id;
      if (patientId) {
        await this.refreshPatientHistory(
          practiceSubdomain,
          practiceId,
          patientId.toString()
        );
      }
    }
  }

  /**
   * Check if cache is warmed and ready
   */
  async isCacheWarmed() {
    try {
      const warmed = await redis.get('cache:warmed');
      // redis.get returns parsed JSON, so check for boolean true
      return warmed === true || warmed === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Cache common function mappings for faster AI responses
   */
  async cacheFunctionMappings(practiceSubdomain) {
    try {
      // Pre-cache common function mappings
      const commonMappings = [
        { query: 'list patients', functions: ['listAllPatients'] },
        { query: 'show patients', functions: ['listAllPatients'] },
        { query: 'patient history', functions: ['getPatientMedicalHistory'] },
        { query: 'medical history', functions: ['getPatientMedicalHistory'] },
        { query: 'add patient', functions: ['addNewPatient'] },
        { query: 'schedule appointment', functions: ['scheduleAppointment'] },
        { query: 'הצג מטופלים', functions: ['listAllPatients'] },
        { query: 'רשימת מטופלים', functions: ['listAllPatients'] }
      ];

      for (const mapping of commonMappings) {
        const cacheKey = `practice:${practiceSubdomain}:function:${mapping.query}`;
        await redis.set(cacheKey, mapping.functions, 1800); // 30 minutes TTL
      }

      console.log(`      📚 Cached ${commonMappings.length} function mappings`);
    } catch (error) {
      console.error('Failed to cache function mappings:', error);
    }
  }

  /**
   * Get cached data with fallback to database
   */
  async getCachedOrFetch(key, fetchFunction, ttl = 3600) {
    try {
      // Try to get from cache first
      const cached = await redis.get(key);
      if (cached) {
        console.log(`⚡ Cache HIT: ${key}`);
        return cached;
      }

      // Fetch from database
      console.log(`📊 Cache MISS: ${key} - fetching from database`);
      const data = await fetchFunction();

      // Store in cache
      if (data) {
        await redis.set(key, data, ttl);
      }

      return data;
    } catch (error) {
      console.error(`Cache error for ${key}:`, error);
      // Fallback to fetch function on error
      return await fetchFunction();
    }
  }

  /**
   * Warm cache for specific patient on access
   */
  async warmPatientCache(practiceSubdomain, patientId) {
    const cacheKey = `practice:${practiceSubdomain}:patient:${patientId}:history`;

    // Check if already cached
    const exists = await redis.exists(cacheKey);
    if (exists) {
      return; // Already cached
    }

    // Fetch and cache
    const context = {
      serviceId: 'redis-data-sync',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      operation: 'warm-patient-cache',
      practiceId: practiceSubdomain,
      practiceSubdomain: practiceSubdomain
    };

    await this.cachePatientMedicalHistory(practiceSubdomain, patientId, context);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const keys = await redis.keys('practice:*');
      const stats = {
        totalKeys: keys.length,
        practices: new Set(),
        patients: 0,
        histories: 0,
        functionMappings: 0
      };

      for (const key of keys) {
        const parts = key.split(':');
        if (parts[0] === 'practice' && parts[1]) {
          stats.practices.add(parts[1]);
        }
        if (key.includes(':patients:all')) {
          stats.patients++;
        }
        if (key.includes(':history')) {
          stats.histories++;
        }
        if (key.includes(':function:')) {
          stats.functionMappings++;
        }
      }

      stats.practices = stats.practices.size;
      return stats;

    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const redisDataSync = new RedisDataSync();

module.exports = redisDataSync;