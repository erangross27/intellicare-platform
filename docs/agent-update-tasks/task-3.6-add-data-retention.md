# Task 3.6: Add Data Retention Policies

## 📋 **Task Overview**
**Phase:** 3 (Utilities, Monitoring & Resilience)  
**Time Estimate:** 15 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

Add comprehensive data retention policies and cleanup mechanisms to prevent database bloat and ensure compliance with data retention requirements.

## 🎯 **Objective**
Implement data retention that:
- Automatically cleans up expired temporary data
- Enforces retention policies for different data types
- Prevents database bloat from accumulating data
- Ensures compliance with data protection regulations

## 🚨 **Storage Risk**
**LOW:** Without data retention, databases can grow indefinitely and performance can degrade over time.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add data retention and cleanup mechanisms**

## 🔍 **Current Data Retention Issues**

### **Issue 1: No Cleanup of Expired Uploads**
```javascript
// CURRENT - NO CLEANUP
const pendingUpload = new PendingUpload({
  uploadId,
  files: encryptedFiles,
  status: 'pending'
  // ❌ No expiration cleanup
  // ❌ Old uploads accumulate indefinitely
});
```

### **Issue 2: No Session Cleanup**
```javascript
// CURRENT - NO SESSION CLEANUP
// ❌ Old chat sessions never cleaned up
// ❌ Session data accumulates over time
```

### **Issue 3: No Log Retention Policy**
```javascript
// CURRENT - NO LOG CLEANUP
// ❌ Audit logs grow indefinitely
// ❌ Error logs never cleaned up
// ❌ Metrics data accumulates
```

## ✅ **Data Retention System**

### **1. Data Retention Manager**
```javascript
// ADD at top of file after imports:

class DataRetentionManager {
  constructor() {
    this.policies = new Map();
    this.isRunning = false;
    this.cleanupInterval = null;
    
    // Default retention policies (in milliseconds)
    this.setupDefaultPolicies();
    
    console.log('🗑️ Data retention manager initialized');
  }
  
  setupDefaultPolicies() {
    // Pending uploads - 24 hours
    this.addPolicy('pendingUploads', {
      collection: 'PendingUpload',
      field: 'createdAt',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      batchSize: 100,
      conditions: { status: { $in: ['pending', 'failed'] } }
    });
    
    // Completed uploads - 7 days
    this.addPolicy('completedUploads', {
      collection: 'PendingUpload',
      field: 'completedAt',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      batchSize: 100,
      conditions: { status: 'completed' }
    });
    
    // Temporary files - 1 hour
    this.addPolicy('tempFiles', {
      type: 'filesystem',
      path: path.join(__dirname, '../temp'),
      maxAge: 60 * 60 * 1000, // 1 hour
      batchSize: 50
    });
    
    // Error logs - 30 days
    this.addPolicy('errorLogs', {
      collection: 'ErrorLog',
      field: 'timestamp',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      batchSize: 1000
    });
    
    // Audit logs - 90 days (compliance requirement)
    this.addPolicy('auditLogs', {
      collection: 'AuditLog',
      field: 'timestamp',
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      batchSize: 1000
    });
    
    // Session data - 24 hours
    this.addPolicy('sessionData', {
      type: 'memory',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      cleanupFunction: this.cleanupSessions.bind(this)
    });
  }
  
  addPolicy(name, policy) {
    this.policies.set(name, {
      ...policy,
      lastRun: null,
      totalCleaned: 0,
      lastCleanedCount: 0
    });
    
    console.log(`📋 Added retention policy: ${name}`);
  }
  
  async runCleanup(policyName = null) {
    if (policyName) {
      return await this.runSinglePolicy(policyName);
    }
    
    const results = {};
    
    for (const [name, policy] of this.policies) {
      try {
        results[name] = await this.runSinglePolicy(name);
      } catch (error) {
        console.error(`❌ Cleanup failed for policy ${name}:`, error);
        results[name] = { success: false, error: error.message };
      }
    }
    
    return results;
  }
  
  async runSinglePolicy(policyName) {
    const policy = this.policies.get(policyName);
    
    if (!policy) {
      throw new Error(`Policy '${policyName}' not found`);
    }
    
    console.log(`🧹 Running cleanup for policy: ${policyName}`);
    
    const startTime = Date.now();
    let cleanedCount = 0;
    
    try {
      if (policy.type === 'filesystem') {
        cleanedCount = await this.cleanupFilesystem(policy);
      } else if (policy.type === 'memory') {
        cleanedCount = await policy.cleanupFunction();
      } else {
        cleanedCount = await this.cleanupDatabase(policy);
      }
      
      const duration = Date.now() - startTime;
      
      // Update policy stats
      policy.lastRun = new Date();
      policy.totalCleaned += cleanedCount;
      policy.lastCleanedCount = cleanedCount;
      
      console.log(`✅ Cleanup completed for ${policyName}: ${cleanedCount} items in ${duration}ms`);
      
      return {
        success: true,
        cleanedCount: cleanedCount,
        duration: duration,
        policy: policyName
      };
      
    } catch (error) {
      console.error(`❌ Cleanup failed for ${policyName}:`, error);
      throw error;
    }
  }
  
  async cleanupDatabase(policy) {
    const cutoffDate = new Date(Date.now() - policy.maxAge);
    
    // Build query
    const query = {
      [policy.field]: { $lt: cutoffDate },
      ...policy.conditions
    };
    
    let totalCleaned = 0;
    let hasMore = true;
    
    while (hasMore) {
      // Find documents to delete in batches
      const Model = global.models?.[policy.collection];
      
      if (!Model) {
        console.error(`❌ Model ${policy.collection} not found`);
        break;
      }
      
      const documents = await Model.find(query)
        .limit(policy.batchSize)
        .select('_id');
      
      if (documents.length === 0) {
        hasMore = false;
        break;
      }
      
      // Delete batch
      const deleteResult = await Model.deleteMany({
        _id: { $in: documents.map(doc => doc._id) }
      });
      
      totalCleaned += deleteResult.deletedCount;
      
      // Check if we have more to process
      if (documents.length < policy.batchSize) {
        hasMore = false;
      }
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return totalCleaned;
  }
  
  async cleanupFilesystem(policy) {
    const fs = require('fs').promises;
    const path = require('path');
    
    let cleanedCount = 0;
    
    try {
      if (!await this.pathExists(policy.path)) {
        return 0;
      }
      
      const files = await fs.readdir(policy.path);
      const cutoffTime = Date.now() - policy.maxAge;
      
      for (const file of files) {
        const filePath = path.join(policy.path, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            cleanedCount++;
            
            console.log(`🗑️ Deleted expired file: ${file}`);
          }
        } catch (error) {
          console.error(`❌ Error processing file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error(`❌ Filesystem cleanup error:`, error);
    }
    
    return cleanedCount;
  }
  
  async cleanupSessions() {
    // This would integrate with your session store
    // Example for in-memory sessions
    let cleanedCount = 0;
    
    if (global.sessionStore) {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      
      // Clean up expired sessions
      cleanedCount = await global.sessionStore.cleanup(cutoffTime);
    }
    
    return cleanedCount;
  }
  
  async pathExists(path) {
    try {
      await require('fs').promises.access(path);
      return true;
    } catch {
      return false;
    }
  }
  
  startScheduledCleanup(intervalMinutes = 60) {
    if (this.isRunning) {
      console.log('⚠️ Scheduled cleanup already running');
      return;
    }
    
    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;
    
    console.log(`⏰ Starting scheduled cleanup every ${intervalMinutes} minutes`);
    
    this.cleanupInterval = setInterval(async () => {
      try {
        console.log('🕐 Running scheduled data retention cleanup...');
        const results = await this.runCleanup();
        
        const totalCleaned = Object.values(results)
          .filter(r => r.success)
          .reduce((sum, r) => sum + r.cleanedCount, 0);
        
        console.log(`✅ Scheduled cleanup completed: ${totalCleaned} items cleaned`);
        
        // Emit metrics
        if (global.metrics) {
          global.metrics.emit('data_retention_cleanup', {
            totalCleaned: totalCleaned,
            results: results,
            timestamp: new Date()
          });
        }
        
      } catch (error) {
        console.error('❌ Scheduled cleanup error:', error);
      }
    }, intervalMs);
  }
  
  stopScheduledCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.isRunning = false;
      console.log('🛑 Scheduled cleanup stopped');
    }
  }
  
  getStatus() {
    const policies = {};
    
    for (const [name, policy] of this.policies) {
      policies[name] = {
        maxAge: policy.maxAge,
        lastRun: policy.lastRun,
        totalCleaned: policy.totalCleaned,
        lastCleanedCount: policy.lastCleanedCount,
        type: policy.type || 'database',
        collection: policy.collection
      };
    }
    
    return {
      isRunning: this.isRunning,
      policies: policies,
      totalPolicies: this.policies.size
    };
  }
}

// Create global data retention manager
const dataRetention = new DataRetentionManager();
global.dataRetention = dataRetention;

// Start scheduled cleanup (every hour)
dataRetention.startScheduledCleanup(60);
```

### **2. Enhanced PendingUpload Cleanup**
```javascript
// ADD: Enhanced pending upload cleanup
const cleanupExpiredUploads = async (practiceContext = null) => {
  try {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    
    let query = {
      createdAt: { $lt: cutoffDate },
      status: { $in: ['pending', 'failed'] }
    };
    
    // Add practice filter if provided
    if (practiceContext && practiceContext.practice) {
      query.practiceId = practiceContext.practice._id;
    }
    
    const PendingUpload = practiceContext?.models?.PendingUpload || 
                         global.models?.PendingUpload;
    
    if (!PendingUpload) {
      console.error('❌ PendingUpload model not available for cleanup');
      return 0;
    }
    
    // Find expired uploads
    const expiredUploads = await PendingUpload.find(query).limit(100);
    
    if (expiredUploads.length === 0) {
      return 0;
    }
    
    // Log cleanup
    console.log(`🧹 Cleaning up ${expiredUploads.length} expired uploads`);
    
    // Delete expired uploads
    const deleteResult = await PendingUpload.deleteMany({
      _id: { $in: expiredUploads.map(upload => upload._id) }
    });
    
    // Log audit trail
    if (practiceContext && practiceContext.req && practiceContext.req.auditLog) {
      practiceContext.req.auditLog('EXPIRED_UPLOADS_CLEANED', {
        cleanedCount: deleteResult.deletedCount,
        cutoffDate: cutoffDate
      });
    }
    
    return deleteResult.deletedCount;
    
  } catch (error) {
    console.error('❌ Upload cleanup error:', error);
    return 0;
  }
};

// Add to existing upload processing
router.post('/process-pending-upload',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    try {
      // Run cleanup before processing
      await cleanupExpiredUploads(req.practiceContext);
      
      // ... rest of upload processing ...
      
    } catch (error) {
      throw error;
    }
  })
);
```

### **3. Data Retention Endpoints**
```javascript
// ADD: Data retention management endpoints
router.get('/data-retention/status',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const status = dataRetention.getStatus();
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get retention status'
      });
    }
  }
);

router.post('/data-retention/cleanup',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const { policy = null } = req.body;
      
      // Log manual cleanup request
      await auditLog(req, 'MANUAL_DATA_CLEANUP', {
        policy: policy,
        requestedBy: req.user._id
      });
      
      const results = await dataRetention.runCleanup(policy);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);

router.post('/data-retention/policies',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const { name, policy } = req.body;
      
      if (!name || !policy) {
        return res.status(400).json({
          success: false,
          error: 'Policy name and configuration required'
        });
      }
      
      dataRetention.addPolicy(name, policy);
      
      await auditLog(req, 'DATA_RETENTION_POLICY_ADDED', {
        policyName: name,
        policy: policy,
        addedBy: req.user._id
      });
      
      res.json({
        success: true,
        message: `Policy '${name}' added successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);
```

### **4. Compliance Reporting**
```javascript
// ADD: Data retention compliance reporting
const generateRetentionReport = async (practiceId = null) => {
  try {
    const report = {
      timestamp: new Date(),
      practiceId: practiceId,
      policies: {},
      compliance: {
        status: 'compliant',
        issues: []
      }
    };
    
    // Check each policy
    for (const [name, policy] of dataRetention.policies) {
      const policyReport = {
        name: name,
        maxAge: policy.maxAge,
        lastRun: policy.lastRun,
        totalCleaned: policy.totalCleaned,
        status: 'compliant'
      };
      
      // Check if policy has run recently
      const maxRunAge = 2 * 60 * 60 * 1000; // 2 hours
      if (!policy.lastRun || (Date.now() - policy.lastRun.getTime()) > maxRunAge) {
        policyReport.status = 'warning';
        policyReport.issue = 'Policy has not run recently';
        report.compliance.issues.push(`Policy '${name}' has not run recently`);
      }
      
      report.policies[name] = policyReport;
    }
    
    // Overall compliance status
    if (report.compliance.issues.length > 0) {
      report.compliance.status = 'warning';
    }
    
    return report;
    
  } catch (error) {
    console.error('❌ Retention report generation error:', error);
    throw error;
  }
};

// Add compliance report endpoint
router.get('/data-retention/compliance-report',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const report = await generateRetentionReport(req.practice._id);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate compliance report'
      });
    }
  })
);
```

### **5. Graceful Shutdown Integration**
```javascript
// ADD: Graceful shutdown for data retention
const originalGracefulShutdown = gracefulShutdown;

const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, stopping data retention...`);
  
  // Stop scheduled cleanup
  if (global.dataRetention) {
    global.dataRetention.stopScheduledCleanup();
  }
  
  // Continue with original shutdown
  originalGracefulShutdown(signal);
};

// Update shutdown handlers
process.removeAllListeners('SIGTERM');
process.removeAllListeners('SIGINT');
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### **6. Data Retention Monitoring**
```javascript
// ADD: Data retention monitoring
const monitorDataRetention = () => {
  // Monitor retention metrics
  if (global.metrics) {
    global.metrics.on('data_retention_cleanup', (data) => {
      console.log(`📊 Data retention metrics: ${data.totalCleaned} items cleaned`);
      
      // Alert if cleanup is not working
      if (data.totalCleaned === 0) {
        console.log('⚠️ Data retention cleanup found no items to clean');
      }
    });
  }
  
  // Check retention health periodically
  setInterval(() => {
    const status = dataRetention.getStatus();
    
    // Check if any policies haven't run recently
    const staleThreshold = 4 * 60 * 60 * 1000; // 4 hours
    
    for (const [name, policy] of Object.entries(status.policies)) {
      if (!policy.lastRun || (Date.now() - new Date(policy.lastRun).getTime()) > staleThreshold) {
        console.log(`⚠️ Data retention policy '${name}' is stale`);
        
        if (global.alertSystem) {
          global.alertSystem.triggerAlert('DATA_RETENTION_STALE', {
            policy: name,
            lastRun: policy.lastRun,
            severity: 'warning'
          });
        }
      }
    }
  }, 60 * 60 * 1000); // Check every hour
};

// Start monitoring
monitorDataRetention();
```

## ⚠️ **Data Retention Notes**
- **🚨 IMPORTANT:** Retention policies prevent database bloat
- **🚨 IMPORTANT:** Compliance reporting ensures regulatory adherence
- **🚨 IMPORTANT:** Scheduled cleanup maintains system performance
- **❌ DON'T SKIP:** This is essential for long-term system health

## 🧪 **Testing After Implementation**
1. **Test retention policies:**
   - Create expired data and verify cleanup
   - Check policy execution and metrics

2. **Test compliance reporting:**
   - Generate compliance reports
   - Verify policy status tracking

3. **Test manual cleanup:**
   - Trigger manual cleanup operations
   - Verify audit logging

## ✅ **Success Criteria**
- [ ] Data retention manager operational
- [ ] Scheduled cleanup running
- [ ] All retention policies configured
- [ ] Compliance reporting working
- [ ] Manual cleanup endpoints functional
- [ ] Monitoring and alerting active

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 4.1:** Test Israeli Functions (Phase 4)

## 📝 **CRITICAL NOTES**
- **PREVENTS DATABASE BLOAT** - retention essential for performance
- **ENSURES COMPLIANCE** - regulatory requirements must be met
- **MAINTAINS SYSTEM HEALTH** - cleanup prevents resource exhaustion
- **TEST THOROUGHLY** - verify all cleanup operations work correctly
