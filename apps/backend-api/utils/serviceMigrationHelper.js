const fs = require('fs').promises;
const path = require('path');

class ServiceMigrationHelper {
  constructor() {
    this.migrationPatterns = [
      {
        name: 'Remove mongoose.connection',
        pattern: /mongoose\.connection\.(db|collection|model)/g,
        replacement: 'SecureDataAccess.query',
        warning: '// MIGRATED: Direct DB access replaced with SecureDataAccess'
      },
      {
        name: 'Replace databaseFactory.getClinicDatabase',
        pattern: /databaseFactory\.getClinicDatabase\((.*?)\)/g,
        replacement: 'DatabaseConnectionProvider.getConnection(this.serviceName, $1)',
        warning: '// MIGRATED: Using ConnectionProvider'
      },
      {
        name: 'Replace getAllClinicDatabases',
        pattern: /databaseFactory\.getAllClinicDatabases\(\)/g,
        replacement: 'ServiceRegistry.getCachedClinicDatabases()',
        warning: '// MIGRATED: Using cached version'
      },
      {
        name: 'Remove connection.on listeners',
        pattern: /connection\.on\(['"](\w+)['"]/g,
        replacement: '// REMOVED: Event listener - handled by DatabaseEventBus',
        warning: '// MIGRATED: Events now handled centrally'
      }
    ];
  }

  async migrateService(servicePath) {
    console.log(`📝 Migrating service: ${servicePath}`);

    try {
      // Backup original
      const backupPath = servicePath.replace('.js', '.backup.js');
      const content = await fs.readFile(servicePath, 'utf8');
      await fs.writeFile(backupPath, content);
      console.log(`💾 Backup created: ${backupPath}`);

      let modified = content;
      let changeCount = 0;

      // Apply migration patterns
      for (const pattern of this.migrationPatterns) {
        const matches = modified.match(pattern.pattern);
        if (matches && matches.length > 0) {
          console.log(`  Found ${matches.length} instances of: ${pattern.name}`);
          modified = modified.replace(pattern.pattern, `${pattern.warning}\n${pattern.replacement}`);
          changeCount += matches.length;
        }
      }

      // Add required imports if not present
      if (!modified.includes('ServiceRegistry')) {
        const imports = "const ServiceRegistry = require('./serviceRegistry');\n";
        modified = imports + modified;
      }

      if (!modified.includes('DatabaseConnectionProvider')) {
        const imports = "const DatabaseConnectionProvider = require('./databaseConnectionProvider');\n";
        modified = imports + modified;
      }

      if (changeCount > 0) {
        await fs.writeFile(servicePath, modified);
        console.log(`✅ Migrated ${servicePath} - ${changeCount} changes made`);
      } else {
        console.log(`ℹ️ No changes needed for ${servicePath}`);
      }

      return { success: true, changes: changeCount };

    } catch (error) {
      console.error(`❌ Migration failed for ${servicePath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async validateMigration(servicePath) {
    try {
      const content = await fs.readFile(servicePath, 'utf8');

      const issues = [];

      // Check for remaining direct DB access
      if (content.includes('mongoose.connection.')) {
        issues.push('Still contains direct mongoose.connection access');
      }

      if (content.includes('databaseFactory.getClinicDatabase') && !content.includes('// MIGRATED')) {
        issues.push('Still contains unmigrated databaseFactory calls');
      }

      if (content.match(/connection\.on\(['"]/)) {
        issues.push('Still contains connection event listeners');
      }

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      return { valid: false, issues: [error.message] };
    }
  }

  async rollback(servicePath) {
    const backupPath = servicePath.replace('.js', '.backup.js');
    try {
      const backup = await fs.readFile(backupPath, 'utf8');
      await fs.writeFile(servicePath, backup);
      console.log(`↩️ Rolled back ${servicePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Rollback failed for ${servicePath}:`, error.message);
      return false;
    }
  }
}

module.exports = new ServiceMigrationHelper();