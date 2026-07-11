# Delete Vital Signs

## Function Details
- **Name**: deleteVitalSigns
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 2 hours

## Problem Description
Healthcare providers occasionally need to remove erroneous vital sign records. Due to medical record retention requirements, the system must implement soft deletion with complete audit trails. Only authorized personnel should be able to delete records, and deletions must be fully documented with reasons.

## Implementation Steps

### 1. Implement Soft Delete Service Methods
```javascript
// backend/services/vitalSignsService.js (addition to existing service)

class VitalSignsService {
  // ... existing code ...

  async deleteVitalSigns(vitalSignId, reason, context) {
    // Validate deletion reason
    if (!reason || reason.trim().length < 20) {
      throw new Error('Deletion reason must be at least 20 characters');
    }

    // Retrieve vital signs record
    const vitalRecord = await SecureDataAccess.findById('vitalsigns', vitalSignId, context);
    
    if (!vitalRecord) {
      throw new Error('Vital signs record not found');
    }

    // Verify practice isolation
    if (vitalRecord.practiceId !== context.practiceId) {
      throw new Error('Access denied - practice mismatch');
    }

    // Check if already deleted
    if (vitalRecord.isDeleted) {
      throw new Error('Vital signs record is already deleted');
    }

    // Only providers and admins can delete
    if (context.role !== 'provider' && context.role !== 'admin') {
      throw new Error('Only providers and administrators can delete vital signs');
    }

    // Check age of record (cannot delete if older than 7 days without admin approval)
    const daysOld = (Date.now() - vitalRecord.dateRecorded) / (1000 * 60 * 60 * 24);
    if (daysOld > 7 && context.role !== 'admin') {
      throw new Error('Records older than 7 days require administrator approval for deletion');
    }

    // Prepare deletion data
    const deletionData = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: context.userId,
      deletionReason: reason,
      originalData: JSON.stringify(vitalRecord) // Archive original data
    };

    // Add audit trail entry
    const auditEntry = {
      action: 'DELETE',
      performedBy: context.userId,
      timestamp: new Date(),
      reason: reason
    };

    // Perform soft delete
    const result = await SecureDataAccess.update('vitalsigns', vitalSignId, {
      ...deletionData,
      $push: { auditTrail: auditEntry }
    }, context);

    // Create system audit log
    await AuditLog.create({
      action: 'DELETE_VITAL_SIGNS',
      userId: context.userId,
      patientId: vitalRecord.patientId,
      practiceId: context.practiceId,
      severity: 'high',
      details: {
        vitalSignsId: vitalSignId,
        reason: reason,
        recordAge: Math.floor(daysOld),
        originalValues: vitalRecord.vitals
      },
      timestamp: new Date()
    });

    // Notify relevant parties
    await this.notifyVitalDeletion(vitalSignId, vitalRecord.patientId, reason, context);

    return {
      success: true,
      message: 'Vital signs record deleted successfully',
      deletionId: result._id
    };
  }

  async bulkDeleteVitalSigns(vitalSignIds, reason, context) {
    // Bulk deletion with validation
    if (!Array.isArray(vitalSignIds) || vitalSignIds.length === 0) {
      throw new Error('Invalid vital sign IDs provided');
    }

    if (vitalSignIds.length > 10) {
      throw new Error('Cannot delete more than 10 records at once');
    }

    // Only admins can perform bulk deletions
    if (context.role !== 'admin') {
      throw new Error('Only administrators can perform bulk deletions');
    }

    const results = [];
    const errors = [];

    for (const id of vitalSignIds) {
      try {
        const result = await this.deleteVitalSigns(id, reason, context);
        results.push({ id, ...result });
      } catch (error) {
        errors.push({ id, error: error.message });
      }
    }

    return {
      success: results.length > 0,
      deleted: results,
      failed: errors,
      summary: `${results.length} deleted, ${errors.length} failed`
    };
  }

  async restoreVitalSigns(vitalSignId, reason, context) {
    // Restore soft-deleted record
    if (!reason || reason.trim().length < 20) {
      throw new Error('Restoration reason must be at least 20 characters');
    }

    // Only admins can restore
    if (context.role !== 'admin') {
      throw new Error('Only administrators can restore deleted vital signs');
    }

    const vitalRecord = await SecureDataAccess.findById('vitalsigns', vitalSignId, {
      ...context,
      includeDeleted: true
    });
    
    if (!vitalRecord) {
      throw new Error('Vital signs record not found');
    }

    if (!vitalRecord.isDeleted) {
      throw new Error('Vital signs record is not deleted');
    }

    // Restore the record
    const restorationData = {
      isDeleted: false,
      restoredAt: new Date(),
      restoredBy: context.userId,
      restorationReason: reason
    };

    // Add audit trail entry
    const auditEntry = {
      action: 'RESTORE',
      performedBy: context.userId,
      timestamp: new Date(),
      reason: reason
    };

    const result = await SecureDataAccess.update('vitalsigns', vitalSignId, {
      ...restorationData,
      $push: { auditTrail: auditEntry }
    }, context);

    // Create audit log
    await AuditLog.create({
      action: 'RESTORE_VITAL_SIGNS',
      userId: context.userId,
      patientId: vitalRecord.patientId,
      practiceId: context.practiceId,
      severity: 'medium',
      details: {
        vitalSignsId: vitalSignId,
        reason: reason,
        deletedDuration: Date.now() - vitalRecord.deletedAt
      },
      timestamp: new Date()
    });

    return {
      success: true,
      message: 'Vital signs record restored successfully',
      data: result
    };
  }

  async getDeletedVitalSigns(patientId, context) {
    // Retrieve deleted vital signs for audit purposes
    if (context.role !== 'admin' && context.role !== 'provider') {
      throw new Error('Insufficient permissions to view deleted records');
    }

    const query = {
      patientId,
      practiceId: context.practiceId,
      isDeleted: true
    };

    const deletedRecords = await SecureDataAccess.query('vitalsigns', query, {
      sort: { deletedAt: -1 }
    }, { ...context, includeDeleted: true });

    // Create audit log for viewing deleted records
    await AuditLog.create({
      action: 'VIEW_DELETED_VITAL_SIGNS',
      userId: context.userId,
      patientId,
      practiceId: context.practiceId,
      details: { recordCount: deletedRecords.length },
      timestamp: new Date()
    });

    return deletedRecords.map(record => ({
      ...record,
      viewedBy: context.userId,
      viewedAt: new Date()
    }));
  }

  async notifyVitalDeletion(vitalSignId, patientId, reason, context) {
    const notificationService = require('./notificationService');
    await notificationService.sendNotification({
      type: 'VITAL_SIGN_DELETED',
      priority: 'high',
      vitalSignId,
      patientId,
      reason,
      deletedBy: context.userId,
      practiceId: context.practiceId,
      recipients: ['medical-director', 'compliance-officer']
    });
  }
}
```

### 2. Create Deletion API Endpoints
```javascript
// backend/routes/vitals.js (additions)

// Soft delete vital signs
router.delete('/api/vitals/:id', authenticate, authorize(['provider', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Deletion reason must be at least 20 characters'
      });
    }

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.deleteVitalSigns(id, reason, context);
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting vital signs:', error);
    res.status(error.message.includes('not found') ? 404 : 403).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk delete vital signs (admin only)
router.post('/api/vitals/bulk-delete', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { vitalSignIds, reason } = req.body;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.bulkDeleteVitalSigns(vitalSignIds, reason, context);
    
    res.json(result);
  } catch (error) {
    console.error('Error bulk deleting vital signs:', error);
    res.status(403).json({
      success: false,
      error: error.message
    });
  }
});

// Restore deleted vital signs (admin only)
router.post('/api/vitals/:id/restore', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Restoration reason must be at least 20 characters'
      });
    }

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.restoreVitalSigns(id, reason, context);
    
    res.json(result);
  } catch (error) {
    console.error('Error restoring vital signs:', error);
    res.status(403).json({
      success: false,
      error: error.message
    });
  }
});

// Get deleted vital signs for patient
router.get('/api/vitals/patient/:patientId/deleted', authenticate, authorize(['provider', 'admin']), async (req, res) => {
  try {
    const { patientId } = req.params;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.getDeletedVitalSigns(patientId, context);
    
    res.json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error('Error retrieving deleted vital signs:', error);
    res.status(403).json({
      success: false,
      error: error.message
    });
  }
});
```

## Required Endpoints

### DELETE /api/vitals/:id
**Description**: Soft delete a vital signs record
**Access**: Providers, Admins
**Request Body**:
```json
{
  "reason": "Duplicate entry - patient vitals were recorded twice by mistake"
}
```

### POST /api/vitals/bulk-delete
**Description**: Bulk delete multiple vital signs records
**Access**: Admins only
**Request Body**:
```json
{
  "vitalSignIds": ["id1", "id2", "id3"],
  "reason": "Test data cleanup - removing test patient vital signs"
}
```

### POST /api/vitals/:id/restore
**Description**: Restore a soft-deleted vital signs record
**Access**: Admins only
**Request Body**:
```json
{
  "reason": "Record was deleted by mistake - restoring valid patient data"
}
```

### GET /api/vitals/patient/:patientId/deleted
**Description**: Retrieve deleted vital signs for audit
**Access**: Providers, Admins

## Data Models Required

Updates to VitalSigns model:
- `isDeleted` (Boolean): Soft delete flag
- `deletedAt` (Date): Deletion timestamp
- `deletedBy` (ObjectId): User who deleted
- `deletionReason` (String): Reason for deletion
- `originalData` (String): JSON archive of original data
- `restoredAt` (Date): Restoration timestamp (if applicable)
- `restoredBy` (ObjectId): User who restored
- `restorationReason` (String): Reason for restoration

## Test Cases

### 1. Basic Soft Delete
- Delete record with valid reason
- Verify soft delete flag set
- Check audit trail updated
- Confirm notification sent

### 2. Permission Testing
- Attempt delete as nurse (should fail)
- Delete as provider (should succeed for recent)
- Delete as admin (should succeed for any age)

### 3. Age Restrictions
- Delete record < 7 days old as provider (success)
- Delete record > 7 days old as provider (fail)
- Delete record > 7 days old as admin (success)

### 4. Bulk Deletion
- Bulk delete as admin
- Verify all records processed
- Check partial success handling

### 5. Restoration
- Restore deleted record as admin
- Verify data integrity maintained
- Check restoration audit trail

### 6. Duplicate Operations
- Attempt to delete already deleted record
- Attempt to restore non-deleted record
- Verify appropriate error messages

### 7. Audit Trail
- Verify all deletions logged
- Check viewing deleted records logged
- Confirm high severity for deletions

## Dependencies
- SecureDataAccess service for database operations
- AuditLog model for tracking
- Authentication/Authorization middleware
- Notification service for alerts
- Existing VitalSigns model

## Success Criteria
- [ ] Soft delete implementation complete
- [ ] Original data archived on deletion
- [ ] Complete audit trail maintained
- [ ] Age-based restrictions enforced
- [ ] Role-based permissions working
- [ ] Restoration capability functional
- [ ] Bulk operations for admins
- [ ] Notifications sent for deletions
- [ ] Deleted records queryable for audit
- [ ] Multi-tenant isolation preserved

## Notes
- Consider implementing retention policies for permanent deletion
- May need legal review for compliance with medical record laws
- Future enhancement: scheduled purge of old deleted records
- Consider adding approval workflow for sensitive deletions
- May need export capability before permanent deletion