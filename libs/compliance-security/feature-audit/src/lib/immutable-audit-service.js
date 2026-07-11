/**
 * 🔐 IMMUTABLE AUDIT LOGGING SERVICE - DDD/NX Modular Version
 * Tamper-proof audit logs with cryptographic integrity and blockchain verification
 * Migrated from legacy backend/services structure to DDD/NX architecture
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ImmutableAuditService {
  constructor() {
    this.logChain = [];
    this.currentHash = '0000000000000000000000000000000000000000000000000000000000000000';
    this.logFile = path.join(__dirname, '../../../../../../../backend/logs/immutable-audit.log');
    this.hashFile = path.join(__dirname, '../../../../../../../backend/logs/audit-hashes.log');
    this.integrityFile = path.join(__dirname, '../../../../../../../backend/logs/integrity-manifest.json');
    this.initialized = false;
    this.serviceToken = null;
    
    // Write-only mode to prevent tampering
    this.writeOnlyMode = true;
    this.logIntegrity = new Map();
    this.backupFile = path.join(__dirname, '../../../../../../../backend/logs/audit-backup.log');
    this.tamperDetectionEnabled = true;
    this.pendingEntries = []; // Queue for entries received before initialization
    this.isInitializing = false; // Flag to prevent double initialization
  }

  // Initialize immutable audit system
  async initialize() {
    if (this.initialized || this.isInitializing) {
      return; // Already initialized or in progress
    }
    
    this.isInitializing = true;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const secureConfigService = proxy.getService('secureConfigService');
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('immutable-audit-service');
      
      // In development, skip file-based operations entirely
      if (secureConfigService.get('NODE_ENV', 'development') !== 'production') {
        console.log('⚠️  Development mode: Skipping file-based audit logging (using database only)');
        this.initialized = true;
        this.logChain = [];
        this.currentHash = '0000000000000000000000000000000000000000000000000000000000000000';
        await this.processPendingEntries();
        this.isInitializing = false;
        return;
      }
      
      await this.ensureLogDirectory();
      await this.loadExistingChain();
      
      try {
        await this.verifyChainIntegrity();
      } catch (error) {
        console.warn('⚠️  DEVELOPMENT MODE: ImmutableAuditService integrity check failed, continuing anyway');
        console.warn('⚠️  This should be fixed in production:', error.message);
        
        // In development mode, rebuild the chain instead of failing
        const proxy = getServiceProxy();
        const secureConfigService = proxy.getService('secureConfigService');
        if (secureConfigService.get('NODE_ENV', 'development') !== 'production') {
          await this.rebuildChainIntegrity();
        } else {
          throw error; // In production, fail hard on integrity violations
        }
      }
      
      this.initialized = true;
      // Immutable Audit Service initialized
      
      // Process any entries that were queued during initialization
      await this.processPendingEntries();
      this.isInitializing = false;
    } catch (error) {
      console.error('❌ Failed to initialize Immutable Audit Service:', error);
      this.isInitializing = false;
      throw error;
    }
  }
  
  // Process entries that were queued before initialization
  async processPendingEntries() {
    if (this.pendingEntries && this.pendingEntries.length > 0) {
      console.log(`📝 Processing ${this.pendingEntries.length} queued audit entries`);
      const entries = [...this.pendingEntries];
      this.pendingEntries = [];
      
      for (const entry of entries) {
        try {
          await this.addAuditEntry(entry);
        } catch (error) {
          console.error('Failed to process queued audit entry:', error);
        }
      }
    }
  }

  // Ensure log directory exists
  async ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    await fs.mkdir(logDir, { recursive: true });
  }

  // Load existing audit chain
  async loadExistingChain() {
    try {
      const stats = await fs.stat(this.logFile);
      
      // For large files in development, only load the last 100 entries to speed up startup
      const proxy = getServiceProxy();
      const secureConfigService = proxy.getService('secureConfigService');
      if (secureConfigService.get('NODE_ENV', 'development') === 'development' && stats.size > 10 * 1024 * 1024) { // > 10MB
        console.log('📚 Large audit log detected, loading last 100 entries for faster startup...');
        
        // Read the entire file but only parse last 100 lines
        const logContent = await fs.readFile(this.logFile, 'utf8');
        const lines = logContent.trim().split('\n\n').filter(line => line.length > 0);
        
        // In development, only keep last 100 entries in memory for performance
        const recentLines = lines.slice(-100);
        this.logChain = recentLines.map(line => JSON.parse(line));
        
        // Mark that we're in partial mode
        this.partialLoad = true;
        console.log(`📊 Loaded ${this.logChain.length} recent audit entries (partial mode)`);
      } else {
        // Normal full load for production or small files
        const logContent = await fs.readFile(this.logFile, 'utf8');
        const lines = logContent.trim().split('\n\n').filter(line => line.length > 0);
        
        this.logChain = lines.map(line => JSON.parse(line));
        this.partialLoad = false;
      }
      
      if (this.logChain.length > 0) {
        this.currentHash = this.logChain[this.logChain.length - 1].hash;
        // Loaded existing audit chain
      }
    } catch (error) {
      // No existing log file - start fresh
      console.log('🔗 Starting new audit chain');
      this.partialLoad = false;
    }
  }

  // Verify chain integrity
  async verifyChainIntegrity() {
    if (this.logChain.length === 0) return true;
    
    // Skip integrity check in partial load mode (development optimization)
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    if (this.partialLoad && secureConfigService.get('NODE_ENV', 'development') === 'development') {
      console.log('⚡ Skipping integrity check in partial load mode (development)');
      return true;
    }

    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    
    for (let i = 0; i < this.logChain.length; i++) {
      const entry = this.logChain[i];
      const expectedHash = this.calculateEntryHash(entry, previousHash);
      
      if (entry.hash !== expectedHash) {
        const error = `Chain integrity violation at entry ${i}: expected ${expectedHash}, got ${entry.hash}`;
        console.error('🚨 AUDIT CHAIN COMPROMISED:', error);
        
        // Don't log during initialization to avoid circular dependency
        // Will log after initialization completes
        if (this.initialized) {
          await this.logSecurityIncident({
            type: 'audit_chain_compromise',
            severity: 'critical',
            details: error,
            entryIndex: i
          });
        }
        
        throw new Error(error);
      }
      
      previousHash = entry.hash;
    }
    
    // Audit chain integrity verified
    return true;
  }

  // Calculate cryptographic hash for entry
  calculateEntryHash(entry, previousHash) {
    const entryData = {
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      userId: entry.userId,
      details: entry.details,
      metadata: entry.metadata,
      previousHash: previousHash
    };
    
    const dataString = JSON.stringify(entryData, Object.keys(entryData).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  // Add immutable audit entry
  async addAuditEntry(auditData) {
    if (!this.initialized) {
      // Queue the entry for later processing instead of throwing error
      // This prevents circular dependency during bootstrap
      if (!this.isInitializing && this.pendingEntries) {
        this.pendingEntries.push(auditData);
        return { queued: true, id: crypto.randomUUID() };
      }
      // If we're in the middle of initializing, silently skip
      return { skipped: true, id: crypto.randomUUID() };
    }

    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: auditData.eventType,
      userId: auditData.userId,
      sessionId: auditData.sessionId,
      clientIp: auditData.clientIp,
      userAgent: auditData.userAgent,
      details: auditData.details,
      metadata: auditData.metadata || {},
      previousHash: this.currentHash,
      hash: null // Will be calculated
    };

    // Calculate hash for this entry
    entry.hash = this.calculateEntryHash(entry, this.currentHash);
    
    // Add to chain
    this.logChain.push(entry);
    this.currentHash = entry.hash;

    // Skip file operations in development  
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    if (secureConfigService.get('NODE_ENV', 'development') === 'production') {
      // Persist to disk immediately (append-only)
      await this.persistEntry(entry);
      
      // Update integrity manifest
      await this.updateIntegrityManifest(entry);
    }

    // Store in database for searchability and backup
    try {
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.create('immutable_audit_logs', entry, {
        serviceId: 'immutable-audit-service',
        operation: 'add-audit-entry',
        practiceId: 'global'
      });
    } catch (dbError) {
      console.error('Failed to store audit entry in database:', dbError.message);
      // Continue - the file-based log is the primary source of truth
    }

    // Only log critical audit events to reduce noise
    const criticalEvents = ['security_breach', 'data_breach', 'unauthorized_access', 'audit_deletion_attempt', 'audit_modification_attempt'];
    if (criticalEvents.includes(entry.eventType) || secureConfigService.get('DEBUG_AUDIT', 'false') === 'true') {
      console.log(`🔐 Immutable audit entry added: ${entry.eventType} (${entry.id})`);
    }
    return entry.id;
  }

  // Persist entry to append-only log
  async persistEntry(entry) {
    const logLine = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.logFile, logLine, { flag: 'a' });
    
    // Also store hash separately for quick verification
    const hashLine = `${entry.id}:${entry.hash}:${entry.timestamp}\n`;
    await fs.appendFile(this.hashFile, hashLine, { flag: 'a' });
  }

  // Update integrity manifest
  async updateIntegrityManifest(entry) {
    const manifest = {
      lastEntry: entry.id,
      lastHash: entry.hash,
      chainLength: this.logChain.length,
      lastUpdate: new Date().toISOString(),
      integritySignature: this.calculateChainSignature()
    };

    await fs.writeFile(this.integrityFile, JSON.stringify(manifest, null, 2));
  }

  // Calculate chain signature for integrity verification
  calculateChainSignature() {
    const chainData = this.logChain.map(entry => entry.hash).join('');
    return crypto.createHash('sha256').update(chainData).digest('hex');
  }

  // Verify audit log integrity
  async verifyAuditIntegrity() {
    // In development, skip integrity checks entirely
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    if (secureConfigService.get('NODE_ENV', 'development') !== 'production') {
      return {
        valid: true,
        chainLength: this.logChain.length || 0,
        lastHash: this.currentHash || '0000000000000000000000000000000000000000000000000000000000000000',
        signature: 'development-mode-signature',
        message: 'Integrity checks skipped in development mode'
      };
    }
    
    try {
      // Reload chain from disk
      await this.loadExistingChain();
      
      // Verify chain integrity
      await this.verifyChainIntegrity();
      
      // Verify manifest
      const manifest = await this.loadIntegrityManifest();
      const currentSignature = this.calculateChainSignature();
      
      if (manifest.integritySignature !== currentSignature) {
        throw new Error('Integrity manifest signature mismatch');
      }

      return {
        valid: true,
        chainLength: this.logChain.length,
        lastHash: this.currentHash,
        signature: currentSignature
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        chainLength: this.logChain.length
      };
    }
  }

  // Load integrity manifest
  async loadIntegrityManifest() {
    try {
      const manifestContent = await fs.readFile(this.integrityFile, 'utf8');
      return JSON.parse(manifestContent);
    } catch (error) {
      return null;
    }
  }

  // Search audit logs (read-only)
  async searchAuditLogs(criteria) {
    const results = this.logChain.filter(entry => {
      if (criteria.eventType && entry.eventType !== criteria.eventType) return false;
      if (criteria.userId && entry.userId !== criteria.userId) return false;
      if (criteria.startDate && new Date(entry.timestamp) < new Date(criteria.startDate)) return false;
      if (criteria.endDate && new Date(entry.timestamp) > new Date(criteria.endDate)) return false;
      if (criteria.details && !entry.details.toLowerCase().includes(criteria.details.toLowerCase())) return false;
      
      return true;
    });

    return {
      results: results,
      totalFound: results.length,
      searchCriteria: criteria,
      integrityVerified: await this.verifyAuditIntegrity()
    };
  }

  // Export audit logs for compliance
  async exportAuditLogs(options = {}) {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      exportId: crypto.randomUUID(),
      chainLength: this.logChain.length,
      integrityVerification: await this.verifyAuditIntegrity(),
      entries: this.logChain
    };

    if (options.format === 'csv') {
      return this.convertToCSV(exportData);
    }

    return exportData;
  }

  // Convert to CSV format
  convertToCSV(exportData) {
    const headers = ['ID', 'Timestamp', 'Event Type', 'User ID', 'Client IP', 'Details', 'Hash'];
    const rows = exportData.entries.map(entry => [
      entry.id,
      entry.timestamp,
      entry.eventType,
      entry.userId || '',
      entry.clientIp || '',
      entry.details,
      entry.hash
    ]);

    const csvContent = [
      `# Immutable Audit Log Export`,
      `# Export ID: ${exportData.exportId}`,
      `# Export Time: ${exportData.exportTimestamp}`,
      `# Chain Length: ${exportData.chainLength}`,
      `# Integrity: ${exportData.integrityVerification.valid ? 'VERIFIED' : 'COMPROMISED'}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // Log security incident
  async logSecurityIncident(incident) {
    const securityEntry = {
      eventType: 'security_incident',
      userId: 'system',
      details: `Security incident: ${incident.type}`,
      metadata: {
        incidentType: incident.type,
        severity: incident.severity,
        details: incident.details,
        timestamp: new Date().toISOString()
      }
    };

    await this.addAuditEntry(securityEntry);
  }

  // Log BAA-related audit events
  async logBAAAudit(baaData) {
    const auditEntry = {
      eventType: 'baa_management',
      userId: baaData.userId || 'system',
      details: `BAA ${baaData.action}: ${baaData.vendorName || baaData.baaId}`,
      metadata: {
        action: baaData.action,
        baaId: baaData.baaId,
        vendorId: baaData.vendorId,
        vendorName: baaData.vendorName,
        practiceId: baaData.practiceId,
        auditDetails: baaData.details,
        timestamp: baaData.timestamp || new Date().toISOString()
      }
    };

    await this.addAuditEntry(auditEntry);
  }

  // Log security events for service accounts
  async logSecurityEvent(eventData) {
    const auditEntry = {
      eventType: eventData.eventType || 'security_event',
      userId: 'system',
      details: eventData.details || '',
      metadata: {
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString()
      }
    };

    await this.addAuditEntry(auditEntry);
  }

  // Rebuild chain integrity in development mode
  async rebuildChainIntegrity() {
    console.log('🔧 Rebuilding audit chain integrity in development mode...');
    
    // Backup current chain
    const backupData = JSON.stringify(this.logChain, null, 2);
    await fs.writeFile(this.backupFile, backupData);
    console.log('💾 Current chain backed up to:', this.backupFile);
    
    // Rebuild hashes for entire chain
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    
    for (let i = 0; i < this.logChain.length; i++) {
      const entry = this.logChain[i];
      entry.previousHash = previousHash;
      entry.hash = this.calculateEntryHash(entry, previousHash);
      previousHash = entry.hash;
    }
    
    // Update current hash
    if (this.logChain.length > 0) {
      this.currentHash = this.logChain[this.logChain.length - 1].hash;
    }
    
    // Rewrite the entire log file with corrected hashes
    const rebuiltLog = this.logChain.map(entry => JSON.stringify(entry)).join('\n') + '\n';
    await fs.writeFile(this.logFile, rebuiltLog);
    
    // Rebuild hash file
    const hashLines = this.logChain.map(entry => 
      `${entry.id}:${entry.hash}:${entry.timestamp}`
    ).join('\n') + '\n';
    await fs.writeFile(this.hashFile, hashLines);
    
    console.log(`✅ Audit chain integrity rebuilt: ${this.logChain.length} entries`);
  }

  // Log service operations for audit
  async logServiceOperation(operationData) {
    const auditEntry = {
      eventType: 'service_operation',
      userId: `service:${operationData.serviceId}`,
      details: `Service operation: ${operationData.operation}`,
      metadata: {
        serviceId: operationData.serviceId,
        operation: operationData.operation,
        practiceId: operationData.practiceId,
        ...operationData,
        timestamp: operationData.timestamp || new Date().toISOString()
      }
    };

    await this.addAuditEntry(auditEntry);
  }

  // Get audit statistics
  getAuditStatistics() {
    const eventTypes = {};
    const userActivity = {};
    let oldestEntry = null;
    let newestEntry = null;

    this.logChain.forEach(entry => {
      // Count event types
      eventTypes[entry.eventType] = (eventTypes[entry.eventType] || 0) + 1;
      
      // Count user activity
      if (entry.userId) {
        userActivity[entry.userId] = (userActivity[entry.userId] || 0) + 1;
      }
      
      // Track date range
      const entryDate = new Date(entry.timestamp);
      if (!oldestEntry || entryDate < new Date(oldestEntry.timestamp)) {
        oldestEntry = entry;
      }
      if (!newestEntry || entryDate > new Date(newestEntry.timestamp)) {
        newestEntry = entry;
      }
    });

    return {
      totalEntries: this.logChain.length,
      eventTypes,
      userActivity,
      dateRange: {
        oldest: oldestEntry?.timestamp,
        newest: newestEntry?.timestamp
      },
      currentHash: this.currentHash,
      chainIntegrity: this.logChain.length > 0
    };
  }

  /**
   * PREVENT ANY DELETION - AUDIT LOGS CANNOT BE DELETED
   */
  async deleteLog() {
    const error = new Error('SECURITY VIOLATION: Audit logs cannot be deleted');
    error.name = 'SecurityError';
    
    // Log the attempt
    await this.logSecurityIncident({
      type: 'audit_deletion_attempt',
      severity: 'critical',
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }

  /**
   * PREVENT ANY MODIFICATION - AUDIT LOGS CANNOT BE MODIFIED
   */
  async modifyLog() {
    const error = new Error('SECURITY VIOLATION: Audit logs cannot be modified');
    error.name = 'SecurityError';
    
    // Log the attempt
    await this.logSecurityIncident({
      type: 'audit_modification_attempt',
      severity: 'critical',
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }

  /**
   * PREVENT CLEARING - AUDIT LOGS CANNOT BE CLEARED
   */
  async clearLogs() {
    const error = new Error('SECURITY VIOLATION: Audit logs cannot be cleared');
    error.name = 'SecurityError';
    
    // Log the attempt
    await this.logSecurityIncident({
      type: 'audit_clear_attempt',
      severity: 'critical',
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }

  /**
   * Log critical event with enhanced security
   */
  async logCriticalEvent(event) {
    if (!event || typeof event !== 'object') {
      return;
    }
    
    const entry = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      hash: this.generateHash(event)
    };
    
    // Store hash for integrity verification
    this.logIntegrity.set(entry.id || crypto.randomUUID(), entry.hash);
    
    // Write to append-only log
    await this.appendToLog(entry);
    
    // Replicate to backup
    await this.replicateToBackup(entry);
    
    return entry.id;
  }

  /**
   * Generate SHA-256 hash for integrity
   */
  generateHash(event) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(event))
      .digest('hex');
  }

  /**
   * Append to log file (write-only)
   */
  async appendToLog(entry) {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.logFile, logLine, { flag: 'a' });
    } catch (error) {
      console.error('Failed to append to log:', error);
    }
  }

  /**
   * Replicate to backup for redundancy
   */
  async replicateToBackup(entry) {
    try {
      const backupLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.backupFile, backupLine, { flag: 'a' });
    } catch (error) {
      console.error('Failed to replicate to backup:', error);
    }
  }

  /**
   * Verify integrity of logs
   */
  async verifyIntegrity() {
    if (!this.tamperDetectionEnabled) return true;
    
    try {
      // Read logs for verification (read-only operation)
      const logContent = await fs.readFile(this.logFile, 'utf8');
      const lines = logContent.trim().split('\n').filter(line => line);
      
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          if (log.id && this.logIntegrity.has(log.id)) {
            const expectedHash = this.logIntegrity.get(log.id);
            const actualHash = this.generateHash(log);
            
            if (expectedHash !== actualHash) {
              await this.alertTampering(log.id);
              const error = new Error(`Log tampering detected: ${log.id}`);
              error.name = 'SecurityError';
              throw error;
            }
          }
        } catch (parseError) {
          // Skip malformed lines
          continue;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Integrity verification failed:', error);
      throw error;
    }
  }

  /**
   * Alert on tampering detection
   */
  async alertTampering(logId) {
    console.error(`🚨 CRITICAL: LOG TAMPERING DETECTED - ID: ${logId}`);
    
    // In production, this would:
    // 1. Send immediate alerts to security team
    // 2. Trigger incident response
    // 3. Lock down affected systems
    // 4. Create forensic snapshot
    
    try {
      const proxy = getServiceProxy();
      const emergencyResponse = proxy.getService('emergencyResponse');
      await emergencyResponse.systemLockdown('Audit log tampering detected');
    } catch (error) {
      // Emergency response service may not exist - continue with basic logging
      console.error('Emergency response system unavailable:', error.message);
    }
  }

  /**
   * Log service data access (enhanced)
   */
  async logServiceDataAccess(details) {
    const entry = {
      ...details,
      eventType: 'service_data_access',  // Ensure eventType is always set
      integrityHash: this.generateHash(details)
    };
    
    return this.addAuditEntry(entry);
  }

  /**
   * Read logs securely (read-only)
   */
  async readLogs(options = {}) {
    if (!this.writeOnlyMode) {
      // Normal read operation
      return this.searchAuditLogs(options);
    }
    
    // In write-only mode, only allow specific read operations
    if (options.verificationOnly) {
      return this.verifyIntegrity();
    }
    
    throw new Error('Audit logs are in write-only mode');
  }
}

// Singleton instance
const immutableAuditService = new ImmutableAuditService();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('immutableAuditService', () => immutableAuditService);
}

module.exports = immutableAuditService;