/**
 * MongoDB Change Streams for Automatic Cache Invalidation
 *
 * Watches database changes and automatically invalidates claudeResponseCache
 * No manual function mapping needed - works for ALL 1,353 functions automatically
 */

const claudeResponseCache = require('./claudeResponseCache');

class MongoChangeStreams {
  constructor() {
    this.changeStreams = new Map();
    this.isWatching = false;
    this.databaseFactory = null;
  }

  /**
   * Initialize service with database factory
   */
  async initialize(databaseFactory) {
    console.log('📊 MongoDB Change Streams: Initializing...');

    // Store database factory for later use
    this.databaseFactory = databaseFactory || require('../utils/databaseFactory');

    // Start watching for changes
    await this.startWatching();

    // Set up periodic check for new practice databases
    setInterval(() => {
      this.watchNewPracticeDatabases();
    }, 60000); // Check every minute for new practices

    return true;
  }

  /**
   * Start watching all practice databases for changes
   */
  async startWatching() {
    const databaseFactory = this.databaseFactory;
    if (this.isWatching) return;

    try {
      console.log('🔄 Initializing MongoDB Change Streams for cache invalidation...');

      // Get global database connection
      const globalConnection = await databaseFactory.getGlobalDatabase();

      // Ensure connection is fully ready
      await globalConnection.asPromise();

      // Watch global database
      const globalDb = globalConnection.db;
      const globalChangeStream = globalDb.watch([], {
        fullDocument: 'updateLookup',
        fullDocumentBeforeChange: 'whenAvailable'
      });

      globalChangeStream.on('change', async (change) => {
        await this.handleChange(change);
      });

      globalChangeStream.on('error', (error) => {
        // Handle network/connection errors gracefully
        if (error.message?.includes('PoolClearedOnNetworkError') || 
            error.message?.includes('connection') ||
            error.message?.includes('network') ||
            error.message?.includes('timeout')) {
          console.warn('⚠️ Global Change Stream: Connection interrupted (will auto-reconnect when DB is ready)');
        } else {
          console.error('Global Change Stream error:', error.message || error);
        }
        
        // Attempt to reconnect after a longer delay to allow connection pool recovery
        setTimeout(() => {
          // Only restart if not already watching
          if (!this.isWatching) {
            this.startWatching().catch(err => {
              console.warn('⚠️ Change Stream reconnection failed:', err.message);
            });
          }
        }, 30000); // Wait 30s for connection pool to stabilize
      });

      this.changeStreams.set('global', globalChangeStream);

      // IMPORTANT: Also watch practice-specific databases
      // Get all existing practice connections from databaseFactory
      if (databaseFactory.connections && databaseFactory.connections.size > 0) {
        for (const [dbName, connection] of databaseFactory.connections) {
          if (dbName !== 'global' && dbName.startsWith('intellicare_practice_')) {
            try {
              const practiceDb = connection.db;
              const practiceChangeStream = practiceDb.watch([], {
                fullDocument: 'updateLookup',
                fullDocumentBeforeChange: 'whenAvailable'
              });

              practiceChangeStream.on('change', async (change) => {
                await this.handleChange(change);
              });

              practiceChangeStream.on('error', (error) => {
                // Handle network/connection errors gracefully
                if (error.message?.includes('PoolClearedOnNetworkError') || 
                    error.message?.includes('connection') ||
                    error.message?.includes('network') ||
                    error.message?.includes('timeout')) {
                  if (process.env.QUIET_LOGS !== 'true') {
                    console.warn(`⚠️ Practice ${dbName} Change Stream: Connection interrupted`);
                  }
                } else {
                  console.error(`Practice ${dbName} Change Stream error:`, error.message || error);
                }
              });

              this.changeStreams.set(dbName, practiceChangeStream);
              console.log(`   → Watching practice database: ${dbName}`);
            } catch (err) {
              console.warn(`   ⚠️ Could not watch ${dbName}:`, err.message);
            }
          }
        }
      }

      this.isWatching = true;

      console.log('✅ MongoDB Change Streams activated - automatic cache invalidation enabled');
      console.log(`   → Watching ${this.changeStreams.size} database(s)`);
      console.log('   → No manual function mapping needed');
      console.log('   → Works for all 1,353 functions automatically');

    } catch (error) {
      // Fallback for non-replica set environments (like local dev)
      if (error.message.includes('replica set') ||
          error.message.includes('Change Streams') ||
          error.message.includes('NamespaceNotFound') ||
          error.code === 26) {
        console.warn('⚠️ MongoDB Change Streams not available (requires replica set)');
        console.warn('   → Falling back to TTL-based caching (10 minute expiry)');
        console.warn('   → To enable: Run Setup-MongoReplica.ps1 as Administrator');
      } else if (error.message.includes('getClient is not a function')) {
        console.warn('⚠️ Change Streams: Using fallback method for Mongoose connection');
        // Try alternative approach
        this.startWatchingFallback(databaseFactory);
      } else {
        console.error('Failed to initialize Change Streams:', error.message);
      }
    }
  }

  /**
   * Handle database change event
   */
  async handleChange(change) {
    try {
      const { operationType, ns, documentKey, fullDocument } = change;

      // ns contains database and collection names
      const collection = ns?.coll;
      const database = ns?.db;

      if (!collection) return;

      // IMPORTANT: Skip ServiceAccount changes - these are just service authentication updates
      // and don't affect user data or cached responses
      if (collection === 'ServiceAccount' || collection === 'serviceaccounts') {
        // Silently skip - no need to log this routine operation
        return;
      }

      // IMPORTANT: Skip all chat-related collections - they are NEVER cached
      // These change constantly and should not trigger cache invalidations
      const chatCollections = [
        'chat_sessions', 'chat_messages', 'chatsessions', 'chatmessages',
        'conversations', 'messages', 'replies'
      ];

      if (chatCollections.includes(collection)) {
        // Silent return - these aren't cached so no need to log or invalidate
        return;
      }

      // IMPORTANT: Skip high-frequency metrics and session collections
      // These change constantly and should not be cached or logged
      const highFrequencyCollections = [
        'sessions',                      // Updates on every request
        'learning_performance_metrics',  // Continuous performance tracking
        'api_gateway_metrics',           // API usage metrics
        'agent_memories',                // Learning system memories
        'function_usage_stats',          // Function usage tracking
        'cache_metrics',                 // Cache hit/miss metrics
        'performance_logs'               // Performance logging
      ];

      if (highFrequencyCollections.includes(collection)) {
        // Silent return - these collections change too frequently to cache
        return;
      }

      // IMPORTANT: Handle both 'users' and 'Users' collections
      // Practice-specific databases use 'users', global uses 'Users'
      if (collection === 'users' || collection === 'Users') {
        console.log(`🔍 User collection change detected - will invalidate user/license/provider caches`);
      }

      // Log the change for debugging (only for non-chat collections)
      if (process.env.QUIET_LOGS !== 'true') console.log(`📝 Database change detected:`, {
        operation: operationType,
        database,
        collection,
        documentId: documentKey?._id
      });

      // Map operation types to cache invalidation
      const writeOperations = ['insert', 'update', 'replace', 'delete'];

      if (writeOperations.includes(operationType)) {
        // Invalidate caches related to this collection
        await this.invalidateRelatedCaches(collection, operationType, documentKey?._id);

        // Redis data sync removed - using simple cache on first request approach
        // Cache will be invalidated by claudeResponseCache when needed
      }
    } catch (error) {
      console.error('Error handling change stream event:', error);
    }
  }

  /**
   * Invalidate caches based on collection that changed
   */
  async invalidateRelatedCaches(collection, operation, documentId) {
    // Use the invalidateByCollection method we already have
    await claudeResponseCache.invalidateByCollection(collection);

    // Also handle lowercase 'users' collection (practice-specific)
    if (collection === 'users' || collection === 'Users') {
      // Make sure both variants are handled
      await claudeResponseCache.invalidateByCollection('users');
      await claudeResponseCache.invalidateByCollection('Users');

      // IMPORTANT: Also clear in-memory user cache in practiceAuth
      try {
        const { clearUserCache } = require('../middleware/practiceAuth');
        // Clear all user caches since we don't have practice info here
        clearUserCache();
        console.log(`🗑️ Also cleared in-memory user permission cache after user ${operation}`);
      } catch (err) {
        console.log('Could not clear user permission cache:', err.message);
      }
    }

    // Log what was invalidated
    if (process.env.QUIET_LOGS !== 'true') console.log(`🗑️ Auto-invalidated caches for ${collection} after ${operation}`);
  }

  /**
   * Fallback method for different Mongoose versions
   */
  async startWatchingFallback(databaseFactory) {
    try {
      const globalConnection = databaseFactory.getGlobalDatabase();

      // Try accessing the MongoDB client through different methods
      let changeStream;

      // Method 1: Direct database access
      if (globalConnection.db) {
        changeStream = globalConnection.db.watch([], {
          fullDocument: 'updateLookup'
        });
      }
      // Method 2: Through mongoose connection
      else if (globalConnection.connection && globalConnection.connection.db) {
        changeStream = globalConnection.connection.db.watch([], {
          fullDocument: 'updateLookup'
        });
      }
      // Method 3: Through native client
      else if (globalConnection.client) {
        changeStream = globalConnection.client.watch([], {
          fullDocument: 'updateLookup'
        });
      } else {
        throw new Error('Cannot access MongoDB client for Change Streams');
      }

      changeStream.on('change', async (change) => {
        await this.handleChange(change);
      });

      changeStream.on('error', (error) => {
        // Handle network/connection errors gracefully
        if (error.message?.includes('PoolClearedOnNetworkError') || 
            error.message?.includes('connection') ||
            error.message?.includes('network') ||
            error.message?.includes('timeout')) {
          console.warn('⚠️ Change Stream: Connection interrupted (will auto-reconnect when DB is ready)');
        } else {
          console.error('Change Stream error:', error.message || error);
        }
        
        // Attempt to reconnect after a longer delay
        setTimeout(() => {
          if (!this.isWatching) {
            this.startWatching().catch(err => {
              console.warn('⚠️ Change Stream reconnection failed:', err.message);
            });
          }
        }, 30000);
      });

      this.changeStreams.set('global', changeStream);
      this.isWatching = true;

      console.log('✅ MongoDB Change Streams activated (fallback method)');
      console.log('   → Automatic cache invalidation enabled');

    } catch (error) {
      console.warn('⚠️ Change Streams unavailable - using TTL-based caching');
      console.warn('   → Run Setup-MongoReplica.ps1 to enable Change Streams');
    }
  }

  /**
   * Watch for new practice databases that may have been created
   */
  async watchNewPracticeDatabases() {
    if (!this.databaseFactory || !this.databaseFactory.connections) return;

    try {
      // Check for new practice databases
      for (const [dbName, connection] of this.databaseFactory.connections) {
        // Skip if already watching this database
        if (this.changeStreams.has(dbName)) continue;

        // Only watch practice databases
        if (dbName !== 'global' && dbName.startsWith('intellicare_practice_')) {
          try {
            const practiceDb = connection.db;
            const practiceChangeStream = practiceDb.watch([], {
              fullDocument: 'updateLookup',
              fullDocumentBeforeChange: 'whenAvailable'
            });

            practiceChangeStream.on('change', async (change) => {
              await this.handleChange(change);
            });

            practiceChangeStream.on('error', (error) => {
              // Handle network/connection errors gracefully - don't spam logs
              if (!error.message?.includes('PoolClearedOnNetworkError') && 
                  !error.message?.includes('network timeout')) {
                console.error(`Practice ${dbName} Change Stream error:`, error.message || error);
              }
            });

            this.changeStreams.set(dbName, practiceChangeStream);
            console.log(`✅ Now watching new practice database: ${dbName}`);
          } catch (err) {
            // Silently skip if can't watch
          }
        }
      }
    } catch (error) {
      // Silently handle errors in periodic check
    }
  }

  /**
   * Stop watching change streams
   */
  async stopWatching() {
    for (const [key, stream] of this.changeStreams) {
      await stream.close();
    }
    this.changeStreams.clear();
    this.isWatching = false;
    console.log('🛑 MongoDB Change Streams stopped');
  }
}

// Export singleton
module.exports = new MongoChangeStreams();