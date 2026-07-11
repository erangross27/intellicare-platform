# Task 2.7: Add Transaction Support

## 📋 **Task Overview**
**Phase:** 2 (Implementation & Data Integrity)  
**Time Estimate:** 25 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

Add comprehensive database transaction support to ensure ACID compliance and data consistency across all database operations.

## 🎯 **Objective**
Implement transaction support that:
- Ensures ACID compliance for all database operations
- Provides automatic rollback on failures
- Supports nested transactions where needed
- Maintains data consistency across multiple collections

## 🚨 **Data Integrity Risk**
**MEDIUM:** Without proper transactions, database operations can leave data in inconsistent states.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add comprehensive transaction support**

## 🔍 **Current Transaction Issues**

### **Issue 1: No Transaction Support**
```javascript
// CURRENT - NO TRANSACTION SAFETY
const patient = await Patient.findOne({...});
const document = new Document({...});
await document.save(); // ❌ If this fails, no rollback of previous operations
await Patient.updateOne({...}); // ❌ Could succeed while document save failed
```

### **Issue 2: Cross-Collection Inconsistency**
```javascript
// CURRENT - INCONSISTENCY RISK
await Patient.updateOne({...}); // ✅ Succeeds
await Document.save(); // ❌ Fails - patient updated but document not saved
// Result: Inconsistent state
```

### **Issue 3: No Rollback Mechanism**
```javascript
// CURRENT - NO ROLLBACK
try {
  await operation1(); // ✅ Succeeds
  await operation2(); // ❌ Fails
  // No way to rollback operation1
} catch (error) {
  // Data is in inconsistent state
}
```

## ✅ **Comprehensive Transaction System**

### **1. Transaction Manager**
```javascript
// ADD at top of file after imports:
const mongoose = require('mongoose');

class TransactionManager {
  constructor(practiceContext) {
    this.practiceContext = practiceContext;
    this.session = null;
    this.operations = [];
    this.isActive = false;
  }
  
  // Start transaction
  async start() {
    if (this.isActive) {
      throw new Error('Transaction already active');
    }
    
    this.session = await mongoose.startSession();
    this.session.startTransaction();
    this.isActive = true;
    
    console.log('🔄 Transaction started');
    
    // Log transaction start
    if (this.practiceContext.req && this.practiceContext.req.auditLog) {
      this.practiceContext.req.auditLog('TRANSACTION_STARTED', {
        sessionId: this.session.id,
        timestamp: new Date()
      });
    }
    
    return this.session;
  }
  
  // Commit transaction
  async commit() {
    if (!this.isActive || !this.session) {
      throw new Error('No active transaction to commit');
    }
    
    try {
      await this.session.commitTransaction();
      console.log('✅ Transaction committed successfully');
      
      // Log transaction commit
      if (this.practiceContext.req && this.practiceContext.req.auditLog) {
        this.practiceContext.req.auditLog('TRANSACTION_COMMITTED', {
          sessionId: this.session.id,
          operationCount: this.operations.length,
          timestamp: new Date()
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Transaction commit failed:', error);
      await this.rollback();
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  // Rollback transaction
  async rollback() {
    if (!this.isActive || !this.session) {
      console.log('⚠️ No active transaction to rollback');
      return;
    }
    
    try {
      await this.session.abortTransaction();
      console.log('🔄 Transaction rolled back');
      
      // Log transaction rollback
      if (this.practiceContext.req && this.practiceContext.req.auditLog) {
        this.practiceContext.req.auditLog('TRANSACTION_ROLLED_BACK', {
          sessionId: this.session.id,
          operationCount: this.operations.length,
          timestamp: new Date()
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Transaction rollback failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  // Cleanup transaction
  async cleanup() {
    if (this.session) {
      await this.session.endSession();
      this.session = null;
    }
    this.isActive = false;
    this.operations = [];
  }
  
  // Execute operation within transaction
  async execute(operation, description = 'Unknown operation') {
    if (!this.isActive) {
      throw new Error('No active transaction');
    }
    
    const operationId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Executing operation: ${description}`);
      
      const result = await operation(this.session);
      
      const duration = Date.now() - startTime;
      
      // Track operation
      this.operations.push({
        id: operationId,
        description: description,
        duration: duration,
        success: true,
        timestamp: new Date()
      });
      
      console.log(`✅ Operation completed: ${description} (${duration}ms)`);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Track failed operation
      this.operations.push({
        id: operationId,
        description: description,
        duration: duration,
        success: false,
        error: error.message,
        timestamp: new Date()
      });
      
      console.error(`❌ Operation failed: ${description} (${duration}ms):`, error);
      throw error;
    }
  }
  
  // Get transaction statistics
  getStats() {
    return {
      isActive: this.isActive,
      operationCount: this.operations.length,
      successfulOperations: this.operations.filter(op => op.success).length,
      failedOperations: this.operations.filter(op => !op.success).length,
      totalDuration: this.operations.reduce((sum, op) => sum + op.duration, 0),
      sessionId: this.session?.id
    };
  }
}

// Transaction wrapper function
const withTransaction = async (practiceContext, operations) => {
  const txManager = new TransactionManager(practiceContext);
  
  try {
    await txManager.start();
    
    const results = [];
    
    // Execute all operations
    for (const operation of operations) {
      const result = await txManager.execute(operation.fn, operation.description);
      results.push(result);
    }
    
    await txManager.commit();
    
    return {
      success: true,
      results: results,
      stats: txManager.getStats()
    };
    
  } catch (error) {
    await txManager.rollback();
    
    return {
      success: false,
      error: error.message,
      stats: txManager.getStats()
    };
  }
};
```

### **2. Transactional Document Upload**
```javascript
// BEFORE - No transaction safety:
const document = new Document({...});
await document.save();
await Patient.updateOne({...});

// AFTER - With transaction support:
router.post('/process-pending-upload',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    try {
      const { uploadId, patientName } = req.body;
      
      // Find pending upload and patient (outside transaction)
      const pendingUpload = await dbOperation(/* ... */);
      const patient = await dbOperation(/* ... */);
      
      // Define transactional operations
      const operations = [
        {
          description: 'Create documents',
          fn: async (session) => {
            const Document = req.models.Document;
            const documents = [];
            
            for (const fileInfo of pendingUpload.files) {
              // Check for duplicates within transaction
              const existing = await Document.findOne({
                patientId: patient._id,
                originalName: fileInfo.originalName
              }).session(session);
              
              if (existing) {
                throw new Error(`Duplicate file: ${fileInfo.originalName}`);
              }
              
              const document = new Document({
                patientId: patient._id,
                originalName: fileInfo.originalName,
                fileType: fileInfo.fileType,
                fileSize: fileInfo.size,
                encryptedData: fileInfo.encryptedData,
                metadata: {
                  uploadDate: new Date(),
                  uploadedBy: req.user._id,
                  uploadId: uploadId
                }
              });
              
              const savedDoc = await document.save({ session });
              documents.push(savedDoc);
            }
            
            return documents;
          }
        },
        
        {
          description: 'Update patient last activity',
          fn: async (session) => {
            const Patient = req.models.Patient;
            
            const result = await Patient.updateOne(
              { _id: patient._id },
              { 
                $set: { 
                  lastActivity: new Date(),
                  lastDocumentUpload: new Date()
                }
              },
              { session }
            );
            
            return result;
          }
        },
        
        {
          description: 'Update pending upload status',
          fn: async (session) => {
            const PendingUpload = req.models.PendingUpload;
            
            const result = await PendingUpload.updateOne(
              { uploadId: uploadId },
              {
                $set: {
                  status: 'completed',
                  completedAt: new Date(),
                  processedFileCount: pendingUpload.files.length
                }
              },
              { session }
            );
            
            return result;
          }
        }
      ];
      
      // Execute all operations in transaction
      const txResult = await withTransaction(req.practiceContext, operations);
      
      if (txResult.success) {
        const [documents, patientUpdate, uploadUpdate] = txResult.results;
        
        // Log successful transaction
        await auditLog(req, 'TRANSACTIONAL_UPLOAD_SUCCESS', {
          uploadId: uploadId,
          patientId: patient._id,
          documentCount: documents.length,
          transactionStats: txResult.stats
        });
        
        res.json({
          success: true,
          message: getLocalizedSuccess(req.country, 'UPLOAD_COMPLETED'),
          data: {
            uploadId: uploadId,
            documentsCreated: documents.length,
            transactionStats: txResult.stats
          }
        });
        
      } else {
        // Transaction failed and rolled back
        await auditLog(req, 'TRANSACTIONAL_UPLOAD_FAILED', {
          uploadId: uploadId,
          patientId: patient._id,
          error: txResult.error,
          transactionStats: txResult.stats
        });
        
        return sendLocalizedError(res, req.country, 'UPLOAD_TRANSACTION_FAILED', {
          details: txResult.error
        }, 400);
      }
      
    } catch (error) {
      throw error;
    }
  })
);
```

### **3. Transactional History Operations**
```javascript
// ADD: Transactional history addition
const addHistoryWithTransaction = async (req, res) => {
  try {
    const { patient_name, category, diagnosis, symptoms, treatment, notes } = req.body;
    
    // Find patient (outside transaction)
    const patient = await dbOperation(/* ... find patient ... */);
    
    if (!patient) {
      return sendLocalizedError(res, req.country, 'PATIENT_NOT_FOUND', {}, 404);
    }
    
    // Define transactional operations
    const operations = [
      {
        description: 'Add medical history entry',
        fn: async (session) => {
          const Patient = req.models.Patient;
          
          const historyEntry = {
            category: category,
            diagnosis: diagnosis,
            symptoms: symptoms,
            treatment: treatment,
            notes: notes,
            date: new Date(),
            addedBy: req.user._id
          };
          
          const result = await Patient.updateOne(
            { _id: patient._id },
            { 
              $push: { medicalHistory: historyEntry },
              $set: { lastActivity: new Date() }
            },
            { session }
          );
          
          return { historyEntry, updateResult: result };
        }
      },
      
      {
        description: 'Update patient statistics',
        fn: async (session) => {
          const Patient = req.models.Patient;
          
          // Get current history count
          const patientWithHistory = await Patient.findById(patient._id).session(session);
          const historyCount = patientWithHistory.medicalHistory?.length || 0;
          
          const result = await Patient.updateOne(
            { _id: patient._id },
            { 
              $set: { 
                'statistics.totalHistoryEntries': historyCount,
                'statistics.lastHistoryUpdate': new Date()
              }
            },
            { session }
          );
          
          return result;
        }
      }
    ];
    
    // Execute transaction
    const txResult = await withTransaction(req.practiceContext, operations);
    
    if (txResult.success) {
      const [historyResult, statsResult] = txResult.results;
      
      await auditLog(req, 'HISTORY_ADDED_TRANSACTIONAL', {
        patientId: patient._id,
        category: category,
        diagnosis: diagnosis,
        transactionStats: txResult.stats
      });
      
      res.json({
        success: true,
        message: getLocalizedSuccess(req.country, 'HISTORY_ADDED'),
        data: {
          patientId: patient._id,
          historyEntry: historyResult.historyEntry,
          transactionStats: txResult.stats
        }
      });
      
    } else {
      return sendLocalizedError(res, req.country, 'HISTORY_TRANSACTION_FAILED', {
        details: txResult.error
      }, 400);
    }
    
  } catch (error) {
    await handleRouteError(req, res, error, 'ADD_HISTORY_TRANSACTIONAL');
  }
};

// Update existing route to use transactions
router.post('/add-history',
  // ... middleware ...
  asyncHandler(addHistoryWithTransaction)
);
```

### **4. Transaction Retry Logic**
```javascript
// ADD: Transaction retry mechanism
const withRetryableTransaction = async (practiceContext, operations, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Transaction attempt ${attempt}/${maxRetries}`);
      
      const result = await withTransaction(practiceContext, operations);
      
      if (result.success) {
        if (attempt > 1) {
          console.log(`✅ Transaction succeeded on attempt ${attempt}`);
        }
        return result;
      } else {
        lastError = new Error(result.error);
        
        // Check if error is retryable
        if (!isRetryableError(result.error)) {
          console.log(`❌ Non-retryable error, stopping attempts: ${result.error}`);
          break;
        }
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          console.log(`⏳ Retrying transaction in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
    } catch (error) {
      lastError = error;
      
      if (!isRetryableError(error.message) || attempt === maxRetries) {
        break;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ Retrying transaction in ${delay}ms due to error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`❌ Transaction failed after ${maxRetries} attempts:`, lastError);
  throw lastError;
};

const isRetryableError = (errorMessage) => {
  const retryableErrors = [
    'WriteConflict',
    'TransientTransactionError',
    'UnknownTransactionCommitResult',
    'Connection',
    'Timeout'
  ];
  
  return retryableErrors.some(error => errorMessage.includes(error));
};
```

### **5. Transaction Monitoring**
```javascript
// ADD: Transaction monitoring and metrics
const monitorTransactions = () => {
  const transactionMetrics = {
    total: 0,
    successful: 0,
    failed: 0,
    retried: 0,
    averageDuration: 0,
    totalDuration: 0
  };
  
  const originalWithTransaction = withTransaction;
  
  global.withTransaction = async (practiceContext, operations) => {
    const startTime = Date.now();
    transactionMetrics.total++;
    
    try {
      const result = await originalWithTransaction(practiceContext, operations);
      
      const duration = Date.now() - startTime;
      transactionMetrics.totalDuration += duration;
      transactionMetrics.averageDuration = transactionMetrics.totalDuration / transactionMetrics.total;
      
      if (result.success) {
        transactionMetrics.successful++;
      } else {
        transactionMetrics.failed++;
      }
      
      // Log metrics periodically
      if (transactionMetrics.total % 10 === 0) {
        console.log('📊 Transaction metrics:', transactionMetrics);
      }
      
      return result;
      
    } catch (error) {
      transactionMetrics.failed++;
      throw error;
    }
  };
  
  // Expose metrics endpoint
  return transactionMetrics;
};

// Start transaction monitoring
const txMetrics = monitorTransactions();

// Add metrics endpoint
router.get('/transaction-metrics',
  practiceAuth,
  requireAuth,
  (req, res) => {
    res.json({
      success: true,
      data: txMetrics
    });
  }
);
```

## ⚠️ **Transaction Notes**
- **🚨 CRITICAL:** Transactions ensure ACID compliance
- **🚨 CRITICAL:** Rollback prevents data corruption
- **🚨 CRITICAL:** Retry logic handles transient failures
- **❌ DON'T SKIP:** This is essential for data integrity

## 🧪 **Testing After Implementation**
1. **Test transaction rollback:**
   - Create operations that fail midway
   - Verify all changes are rolled back

2. **Test retry logic:**
   - Simulate transient errors
   - Verify retry mechanism works

3. **Test performance:**
   - Compare transactional vs non-transactional operations
   - Monitor transaction metrics

## ✅ **Success Criteria**
- [ ] Transaction manager implemented
- [ ] All critical operations use transactions
- [ ] Rollback working on failures
- [ ] Retry logic handling transient errors
- [ ] Transaction monitoring active
- [ ] ACID compliance maintained

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 3.4:** Add Metrics and Monitoring

## 📝 **CRITICAL NOTES**
- **ENSURES DATA INTEGRITY** - ACID compliance critical
- **PREVENTS DATA CORRUPTION** - rollback essential
- **HANDLES FAILURES GRACEFULLY** - retry logic important
- **TEST THOROUGHLY** - verify all transaction scenarios work
