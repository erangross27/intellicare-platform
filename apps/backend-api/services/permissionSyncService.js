/**
 * Permission Sync Service
 * Automatically grants permissions for newly created medical collections
 * Ensures admin users always have read access to all medical data
 */

class PermissionSyncService {
  constructor() {
    this.initialized = false;
    this._secureDataAccess = null;
    this.knownCollections = new Set();
  }

  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    await serviceAccountManager.authenticate('permission-sync');

    const SecureDataAccess = require('./secureDataAccess');
    this._secureDataAccess = SecureDataAccess;

    this.initialized = true;
    console.log('✅ PermissionSyncService initialized');
    return this;
  }

  /**
   * Ensure admin users have read permission for a collection
   * Called automatically when new medical data is stored
   */
  async ensureCollectionPermissions(collectionName, context) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Skip if we've already processed this collection
    if (this.knownCollections.has(collectionName)) {
      return;
    }

    try {
      // Grant both read and write permissions for medical collections
      const readPermission = `read:${collectionName}`;
      const writePermission = `write:${collectionName}`;

      // Find all admin users and users with system_admin permission
      const adminUsers = await this._secureDataAccess.query(
        'users',
        {
          $or: [
            { role: 'admin' },
            { permissions: 'system_admin' }
          ]
        },
        {},
        context
      );

      if (adminUsers.length === 0) {
        console.log(`⚠️ No admin users found to grant ${readPermission}, ${writePermission}`);
        return;
      }

      // Add both permissions to each admin user if they don't already have them
      let updatedCount = 0;
      for (const user of adminUsers) {
        const hasReadPermission = user.permissions && user.permissions.includes(readPermission);
        const hasWritePermission = user.permissions && user.permissions.includes(writePermission);

        if (!hasReadPermission || !hasWritePermission) {
          await this._secureDataAccess.update(
            'users',
            { _id: user._id },
            {
              $addToSet: {
                permissions: {
                  $each: [readPermission, writePermission]
                }
              }
            },
            context
          );
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        console.log(`✅ Auto-granted ${readPermission} and ${writePermission} to ${updatedCount} admin user(s)`);
      }

      // Mark as known so we don't process it again
      this.knownCollections.add(collectionName);

    } catch (error) {
      console.error(`❌ Error ensuring permissions for ${collectionName}:`, error);
      // Don't throw - permission sync is best-effort, shouldn't block data storage
    }
  }

  /**
   * Sync all existing collections with admin permissions
   * Useful for one-time migration or manual sync
   */
  async syncAllCollections(context) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const medicalCollectionsService = require('./medicalCollectionsService');
      const allCollections = medicalCollectionsService.getAllCollections();

      console.log(`🔄 Syncing permissions for ${allCollections.length} collections...`);

      for (const collection of allCollections) {
        // Clear cache to force permission grant
        this.knownCollections.delete(collection);
        await this.ensureCollectionPermissions(collection, context);
      }

      console.log(`✅ Permission sync complete`);

    } catch (error) {
      console.error('❌ Error during permission sync:', error);
      throw error;
    }
  }
}

// Singleton instance
const permissionSyncService = new PermissionSyncService();

module.exports = permissionSyncService;
