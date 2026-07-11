# Task 2.6: Add Batch Operations

## 📋 **Task Overview**
**Phase:** 2 (Implementation & Data Integrity)  
**Time Estimate:** 30 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

Add atomic batch processing capabilities to handle multiple document uploads and operations safely, preventing data inconsistency.

## 🎯 **Objective**
Implement batch operations that:
- Process multiple documents atomically
- Ensure data consistency across operations
- Provide rollback capabilities on failures
- Optimize performance for bulk operations

## 🚨 **Data Integrity Risk**
**MEDIUM:** Without atomic operations, partial failures can leave data in inconsistent states.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add batch processing capabilities**

## 🔍 **Current Batch Processing Issues**

### **Issue 1: Non-Atomic Document Processing**
```javascript
// CURRENT - DATA CONSISTENCY RISK
for (const fileInfo of pendingUpload.files) {
  const document = new Document({...});
  await document.save(); // ❌ If this fails after some succeed, data is inconsistent
}
```

### **Issue 2: No Rollback on Partial Failures**
```javascript
// CURRENT - NO ROLLBACK
// If document 3 of 5 fails, documents 1-2 are already saved
// No way to rollback the partial operation
```

### **Issue 3: Inefficient Individual Operations**
```javascript
// CURRENT - INEFFICIENT
for (const file of files) {
  await processFile(file); // ❌ Sequential processing, no batching
}
```

## ✅ **Batch Operations System**

### **1. Batch Processing Framework**
```javascript
// ADD at top of file after imports:
const mongoose = require('mongoose');

// Batch operation wrapper
class BatchOperation {
  constructor(practiceContext) {
    this.practiceContext = practiceContext;
    this.operations = [];
    this.session = null;
    this.results = [];
    this.errors = [];
  }
  
  // Add operation to batch
  addOperation(type, data, validator = null) {
    const operation = {
      id: crypto.randomBytes(8).toString('hex'),
      type: type,
      data: data,
      validator: validator,
      status: 'pending'
    };
    
    this.operations.push(operation);
    return operation.id;
  }
  
  // Execute all operations in batch
  async execute() {
    if (this.operations.length === 0) {
      return { success: true, results: [], errors: [] };
    }
    
    // Start MongoDB session for transactions
    this.session = await mongoose.startSession();
    
    try {
      await this.session.withTransaction(async () => {
        for (const operation of this.operations) {
          try {
            // Validate operation if validator provided
            if (operation.validator) {
              const validation = await operation.validator(operation.data);
              if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
              }
            }
            
            // Execute operation based on type
            const result = await this.executeOperation(operation);
            
            operation.status = 'completed';
            operation.result = result;
            this.results.push({
              operationId: operation.id,
              type: operation.type,
              success: true,
              result: result
            });
            
          } catch (error) {
            operation.status = 'failed';
            operation.error = error;
            this.errors.push({
              operationId: operation.id,
              type: operation.type,
              success: false,
              error: error.message
            });
            
            // Throw to trigger transaction rollback
            throw error;
          }
        }
      });
      
      return {
        success: true,
        results: this.results,
        errors: this.errors,
        totalOperations: this.operations.length,
        successCount: this.results.length,
        errorCount: this.errors.length
      };
      
    } catch (error) {
      console.error('❌ Batch operation failed:', error);
      
      return {
        success: false,
        results: this.results,
        errors: this.errors,
        totalOperations: this.operations.length,
        successCount: this.results.length,
        errorCount: this.errors.length,
        rollbackPerformed: true,
        error: error.message
      };
      
    } finally {
      if (this.session) {
        await this.session.endSession();
      }
    }
  }
  
  // Execute individual operation
  async executeOperation(operation) {
    const { type, data } = operation;
    
    switch (type) {
      case 'CREATE_DOCUMENT':
        return await this.createDocument(data);
      
      case 'UPDATE_PATIENT':
        return await this.updatePatient(data);
      
      case 'CREATE_HISTORY':
        return await this.createHistory(data);
      
      case 'UPDATE_UPLOAD_STATUS':
        return await this.updateUploadStatus(data);
      
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }
  
  // Document creation operation
  async createDocument(data) {
    const Document = this.practiceContext.models.Document;
    const document = new Document(data);
    
    const savedDocument = await document.save({ session: this.session });
    
    return {
      documentId: savedDocument._id,
      filename: data.originalName,
      size: data.fileSize
    };
  }
  
  // Patient update operation
  async updatePatient(data) {
    const Patient = this.practiceContext.models.Patient;
    
    const result = await Patient.updateOne(
      { _id: data.patientId },
      { $set: data.updates },
      { session: this.session }
    );
    
    return {
      patientId: data.patientId,
      modifiedCount: result.modifiedCount
    };
  }
  
  // History creation operation
  async createHistory(data) {
    const Patient = this.practiceContext.models.Patient;
    
    const result = await Patient.updateOne(
      { _id: data.patientId },
      { 
        $push: { 
          medicalHistory: {
            category: data.category,
            diagnosis: data.diagnosis,
            symptoms: data.symptoms,
            treatment: data.treatment,
            notes: data.notes,
            date: new Date(),
            addedBy: this.practiceContext.user._id
          }
        }
      },
      { session: this.session }
    );
    
    return {
      patientId: data.patientId,
      historyAdded: result.modifiedCount > 0
    };
  }
  
  // Upload status update operation
  async updateUploadStatus(data) {
    const PendingUpload = this.practiceContext.models.PendingUpload;
    
    const result = await PendingUpload.updateOne(
      { uploadId: data.uploadId },
      { 
        $set: {
          status: data.status,
          completedAt: new Date(),
          results: data.results
        }
      },
      { session: this.session }
    );
    
    return {
      uploadId: data.uploadId,
      statusUpdated: result.modifiedCount > 0
    };
  }
}
```

### **2. Document Upload Batch Processing**
```javascript
// BEFORE - Non-atomic processing:
for (const fileInfo of pendingUpload.files) {
  const document = new Document({...});
  await document.save();
}

// AFTER - Atomic batch processing:
router.post('/process-pending-upload',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    try {
      const { uploadId, patientName } = req.body;
      
      // Find pending upload and patient
      const pendingUpload = await dbOperation(/* ... */);
      const patient = await dbOperation(/* ... */);
      
      // Create batch operation
      const batch = new BatchOperation(req.practiceContext);
      
      // Add document creation operations to batch
      const documentValidations = [];
      
      for (const fileInfo of pendingUpload.files) {
        // Validate each file
        const validator = async (data) => {
          // Check for duplicates
          const existing = await req.models.Document.findOne({
            patientId: data.patientId,
            originalName: data.originalName
          });
          
          if (existing) {
            return {
              isValid: false,
              errors: [`Duplicate file: ${data.originalName}`]
            };
          }
          
          return { isValid: true, errors: [] };
        };
        
        // Add document creation to batch
        const operationId = batch.addOperation('CREATE_DOCUMENT', {
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
        }, validator);
        
        documentValidations.push({
          operationId: operationId,
          filename: fileInfo.originalName
        });
      }
      
      // Add upload status update to batch
      batch.addOperation('UPDATE_UPLOAD_STATUS', {
        uploadId: uploadId,
        status: 'completed',
        results: [] // Will be populated after execution
      });
      
      // Execute batch operation
      const batchResult = await batch.execute();
      
      if (batchResult.success) {
        // All operations succeeded
        await auditLog(req, 'BATCH_UPLOAD_SUCCESS', {
          uploadId: uploadId,
          patientId: patient._id,
          operationCount: batchResult.totalOperations,
          successCount: batchResult.successCount
        });
        
        res.json({
          success: true,
          message: getLocalizedSuccess(req.country, 'UPLOAD_COMPLETED'),
          data: {
            uploadId: uploadId,
            batchResult: batchResult,
            documentsCreated: batchResult.results.filter(r => r.type === 'CREATE_DOCUMENT').length
          }
        });
        
      } else {
        // Batch failed, all operations rolled back
        await auditLog(req, 'BATCH_UPLOAD_FAILED', {
          uploadId: uploadId,
          patientId: patient._id,
          operationCount: batchResult.totalOperations,
          errorCount: batchResult.errorCount,
          rollbackPerformed: batchResult.rollbackPerformed,
          errors: batchResult.errors
        });
        
        return sendLocalizedError(res, req.country, 'BATCH_OPERATION_FAILED', {
          details: `${batchResult.errorCount} operations failed. All changes rolled back.`,
          errors: batchResult.errors.map(e => e.error).join(', ')
        }, 400);
      }
      
    } catch (error) {
      throw error;
    }
  })
);
```

### **3. Bulk History Operations**
```javascript
// ADD: Bulk history addition
const addBulkHistory = async (req, res) => {
  try {
    const { patientName, historyEntries } = req.body;
    
    // Validate input
    if (!historyEntries || !Array.isArray(historyEntries) || historyEntries.length === 0) {
      return sendLocalizedError(res, req.country, 'INVALID_INPUT', {
        details: 'History entries array is required'
      }, 400);
    }
    
    // Find patient
    const patient = await dbOperation(/* ... find patient ... */);
    
    if (!patient) {
      return sendLocalizedError(res, req.country, 'PATIENT_NOT_FOUND', {}, 404);
    }
    
    // Create batch operation
    const batch = new BatchOperation(req.practiceContext);
    
    // Add history creation operations
    for (const entry of historyEntries) {
      const validator = async (data) => {
        // Validate required fields
        const required = ['category', 'diagnosis'];
        const missing = required.filter(field => !data[field]);
        
        if (missing.length > 0) {
          return {
            isValid: false,
            errors: [`Missing required fields: ${missing.join(', ')}`]
          };
        }
        
        return { isValid: true, errors: [] };
      };
      
      batch.addOperation('CREATE_HISTORY', {
        patientId: patient._id,
        category: entry.category,
        diagnosis: entry.diagnosis,
        symptoms: entry.symptoms,
        treatment: entry.treatment,
        notes: entry.notes
      }, validator);
    }
    
    // Execute batch
    const batchResult = await batch.execute();
    
    if (batchResult.success) {
      res.json({
        success: true,
        message: getLocalizedSuccess(req.country, 'BULK_HISTORY_ADDED'),
        data: {
          patientId: patient._id,
          entriesAdded: batchResult.successCount,
          batchResult: batchResult
        }
      });
    } else {
      return sendLocalizedError(res, req.country, 'BULK_OPERATION_FAILED', {
        details: batchResult.error
      }, 400);
    }
    
  } catch (error) {
    await handleRouteError(req, res, error, 'ADD_BULK_HISTORY');
  }
};

// Add route for bulk history
router.post('/bulk-history',
  generalRateLimit,
  aiRateLimit,
  practiceAuth,
  requireAuth,
  detectCountry,
  validateRequest,
  asyncHandler(addBulkHistory)
);
```

### **4. Batch Performance Optimization**
```javascript
// ADD: Performance optimization for batch operations
const optimizeBatchOperation = (batch) => {
  // Group similar operations
  const operationGroups = {};
  
  batch.operations.forEach(op => {
    if (!operationGroups[op.type]) {
      operationGroups[op.type] = [];
    }
    operationGroups[op.type].push(op);
  });
  
  // Optimize document creation operations
  if (operationGroups['CREATE_DOCUMENT']) {
    const docs = operationGroups['CREATE_DOCUMENT'];
    
    // Use insertMany for better performance
    batch.bulkCreateDocuments = async (session) => {
      const Document = batch.practiceContext.models.Document;
      const documentsData = docs.map(op => op.data);
      
      const result = await Document.insertMany(documentsData, { session });
      
      return result.map((doc, index) => ({
        operationId: docs[index].id,
        documentId: doc._id,
        filename: doc.originalName
      }));
    };
  }
  
  return batch;
};
```

### **5. Batch Monitoring and Metrics**
```javascript
// ADD: Batch operation monitoring
const monitorBatchOperation = (batch) => {
  const startTime = Date.now();
  const originalExecute = batch.execute.bind(batch);
  
  batch.execute = async function() {
    console.log(`🔄 Starting batch operation with ${this.operations.length} operations`);
    
    const result = await originalExecute();
    
    const duration = Date.now() - startTime;
    const metrics = {
      duration: duration,
      operationCount: this.operations.length,
      successCount: result.successCount,
      errorCount: result.errorCount,
      throughput: this.operations.length / (duration / 1000) // ops per second
    };
    
    console.log(`✅ Batch operation completed:`, metrics);
    
    // Log performance metrics
    if (this.practiceContext.req && this.practiceContext.req.auditLog) {
      this.practiceContext.req.auditLog('BATCH_OPERATION_METRICS', metrics);
    }
    
    return result;
  };
  
  return batch;
};
```

## ⚠️ **Data Integrity Notes**
- **🚨 CRITICAL:** Batch operations ensure data consistency
- **🚨 CRITICAL:** Transaction rollback prevents partial failures
- **🚨 CRITICAL:** Validation prevents invalid data insertion
- **❌ DON'T SKIP:** This prevents data corruption from partial operations

## 🧪 **Testing After Implementation**
1. **Test atomic operations:**
   - Create batch with some invalid operations
   - Verify all operations are rolled back on failure

2. **Test performance:**
   - Compare batch vs individual operations
   - Verify improved throughput

3. **Test error handling:**
   - Test various failure scenarios
   - Verify proper rollback behavior

## ✅ **Success Criteria**
- [ ] Batch operation framework implemented
- [ ] Document uploads processed atomically
- [ ] Transaction rollback working on failures
- [ ] Performance optimization active
- [ ] Monitoring and metrics functional
- [ ] All operations validated before execution

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 2.7:** Add Transaction Support

## 📝 **CRITICAL NOTES**
- **ENSURES DATA CONSISTENCY** - atomic operations critical
- **PREVENTS PARTIAL FAILURES** - rollback essential
- **IMPROVES PERFORMANCE** - batch processing more efficient
- **TEST THOROUGHLY** - verify all failure scenarios handled
