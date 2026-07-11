/**
 * 🔒 DATABASE CREATION GUARD
 *
 * CRITICAL SECURITY SERVICE: Prevents unauthorized database creation
 *
 * Problem: MongoDB automatically creates databases on first write operation
 * Solution: This guard validates ALL database connections before allowing access
 *
 * Features:
 * - Validates practice exists before allowing database connection
 * - Blocks test/demo databases in production
 * - Maintains whitelist of allowed databases
 * - Logs all database access attempts
 * - Prevents typos and injection attacks
 */

const mongoose = require('mongoose');

class DatabaseCreationGuard {
  constructor() {
    // Core databases that are always allowed
    this.alwaysAllowedDatabases = new Set([
      'intellicare_practice_global',  // Main production database
      'admin',                        // MongoDB admin
      'config',                       // MongoDB config
      'local'                         // MongoDB local
    ]);

    // Cached list of valid practice subdomains (refreshed periodically)
    this.validPracticeSubdomains = new Set();
    this.lastCacheRefresh = 0;
    this.cacheRefreshInterval = 5 * 60 * 1000; // 5 minutes

    // Blocked patterns (never allow these)
    this.blockedPatterns = [
      /test[-_]?practice/i,     // test-practice, test_practice, testpractice
      /demo[-_]?practice/i,     // demo-practice, demo_practice
      /temp[-_]?practice/i,     // temp-practice, temporary
      /example[-_]?practice/i,  // example-practice
      /localhost/i,             // localhost databases
      /\.\./,                   // Path traversal attempts
      /[<>:"|?*]/,             // Invalid characters
      /^intellicare_global$/    // Wrong database name (missing 'practice_')
    ];

    // Track database access attempts for security audit
    this.accessAttempts = new Map();
  }

  /**
   * Initialize the guard (load valid practices)
   */
  async initialize() {
    try {
      await this.refreshValidPractices();
      console.log('🔒 Database Creation Guard initialized');
      console.log(`   Valid practices: ${this.validPracticeSubdomains.size}`);

      // Refresh cache periodically
      setInterval(() => {
        this.refreshValidPractices().catch(console.error);
      }, this.cacheRefreshInterval);

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize DatabaseCreationGuard:', error);
      // Still allow core databases even if initialization fails
      return false;
    }
  }

  /**
   * Refresh the list of valid practice subdomains from database
   */
  async refreshValidPractices() {
    try {
      const conn = await mongoose.createConnection('mongodb://localhost:27017/intellicare_practice_global').asPromise();

      const practices = await conn.db.collection('practices').find(
        {
          active: true,
          subdomain: { $exists: true, $ne: null }
        },
        {
          projection: { subdomain: 1 }
        }
      ).toArray();

      // Clear and rebuild the set
      this.validPracticeSubdomains.clear();
      practices.forEach(p => {
        if (p.subdomain) {
          this.validPracticeSubdomains.add(p.subdomain);
        }
      });

      this.lastCacheRefresh = Date.now();
      await conn.close();

      return true;
    } catch (error) {
      console.error('⚠️ Failed to refresh practice list:', error.message);
      return false;
    }
  }

  /**
   * Validate if a database name is allowed
   * @param {string} databaseName - Full database name (e.g., intellicare_practice_testclinic)
   * @param {object} context - Additional context (serviceId, operation, etc.)
   * @returns {object} { allowed: boolean, reason: string }
   */
  async validateDatabaseAccess(databaseName, context = {}) {
    // Track access attempt
    this.logAccessAttempt(databaseName, context);

    // 1. Check if it's a core allowed database
    if (this.alwaysAllowedDatabases.has(databaseName)) {
      return { allowed: true, reason: 'Core system database' };
    }

    // 2. Check for blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(databaseName)) {
        console.error(`🚫 BLOCKED DATABASE: ${databaseName} matches blocked pattern: ${pattern}`);
        return {
          allowed: false,
          reason: `Database name matches blocked pattern: ${pattern}`
        };
      }
    }

    // 3. Check if it's in development/test environment
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = !isProduction;

    // In test/development, allow test databases but log warning
    if (isDevelopment && databaseName.includes('test')) {
      console.warn(`⚠️ TEST DATABASE IN DEVELOPMENT: ${databaseName}`);
      return {
        allowed: true,
        reason: 'Test database allowed in development environment'
      };
    }

    // 4. Validate practice database format
    if (databaseName.startsWith('intellicare_practice_')) {
      const subdomain = databaseName.replace('intellicare_practice_', '');

      // Check if subdomain is empty
      if (!subdomain || subdomain.length === 0) {
        return {
          allowed: false,
          reason: 'Empty subdomain not allowed'
        };
      }

      // Refresh cache if it's stale
      if (Date.now() - this.lastCacheRefresh > this.cacheRefreshInterval) {
        await this.refreshValidPractices();
      }

      // Check if practice exists
      if (this.validPracticeSubdomains.has(subdomain)) {
        return {
          allowed: true,
          reason: 'Valid registered practice'
        };
      } else {
        // Double-check with fresh data before rejecting
        await this.refreshValidPractices();

        if (this.validPracticeSubdomains.has(subdomain)) {
          return {
            allowed: true,
            reason: 'Valid registered practice (fresh check)'
          };
        } else {
          console.error(`🚫 UNREGISTERED PRACTICE: ${subdomain} not found in practices collection`);
          return {
            allowed: false,
            reason: `Practice '${subdomain}' not registered in system`
          };
        }
      }
    }

    // 5. Reject everything else
    console.error(`🚫 UNKNOWN DATABASE: ${databaseName} doesn't match any allowed pattern`);
    return {
      allowed: false,
      reason: 'Database name does not match IntelliCare naming convention'
    };
  }

  /**
   * Log access attempt for security audit
   */
  logAccessAttempt(databaseName, context) {
    const attempt = {
      timestamp: new Date().toISOString(),
      database: databaseName,
      serviceId: context.serviceId || 'unknown',
      operation: context.operation || 'unknown',
      allowed: null // Will be set later
    };

    // Store last 1000 attempts
    if (this.accessAttempts.size > 1000) {
      const firstKey = this.accessAttempts.keys().next().value;
      this.accessAttempts.delete(firstKey);
    }

    this.accessAttempts.set(`${Date.now()}_${Math.random()}`, attempt);
  }

  /**
   * Get security report of access attempts
   */
  getSecurityReport() {
    const attempts = Array.from(this.accessAttempts.values());
    const blocked = attempts.filter(a => a.allowed === false);
    const suspicious = attempts.filter(a =>
      a.database.includes('test') ||
      a.database.includes('demo') ||
      a.database === 'intellicare_global'
    );

    return {
      totalAttempts: attempts.length,
      blockedAttempts: blocked.length,
      suspiciousAttempts: suspicious.length,
      validPractices: this.validPracticeSubdomains.size,
      lastCacheRefresh: new Date(this.lastCacheRefresh).toISOString(),
      recentBlocked: blocked.slice(-10),
      recentSuspicious: suspicious.slice(-10)
    };
  }

  /**
   * Emergency shutdown - block all new database connections
   */
  emergencyShutdown() {
    console.error('🚨 EMERGENCY: Blocking all new database connections');
    this.validPracticeSubdomains.clear();
    this.alwaysAllowedDatabases.clear();
    this.alwaysAllowedDatabases.add('intellicare_practice_global'); // Keep only critical
  }
}

// Export as singleton
module.exports = new DatabaseCreationGuard();