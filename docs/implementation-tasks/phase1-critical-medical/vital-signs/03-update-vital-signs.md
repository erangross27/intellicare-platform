# Update Vital Signs

## Function Details
- **Name**: updateVitalSigns
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 3 hours

## Problem Description
Healthcare providers need the ability to correct or update vital sign records after initial entry. This includes fixing data entry errors, adding missing measurements, or updating notes. The system must maintain a complete audit trail of all changes while preserving data integrity and clinical accuracy.

## Implementation Steps

### 1. Extend Vital Signs Service for Updates
```javascript
// backend/services/vitalSignsService.js (addition to existing service)

class VitalSignsService {
  // ... existing code ...

  async updateVitalSigns(vitalSignId, updates, context) {
    // Retrieve original vital signs
    const original = await SecureDataAccess.findById('vitalsigns', vitalSignId, context);
    
    if (!original) {
      throw new Error('Vital signs record not found');
    }

    // Verify practice isolation
    if (original.practiceId !== context.practiceId) {
      throw new Error('Access denied - practice mismatch');
    }

    // Check if record is locked (older than 24 hours)
    const hoursOld = (Date.now() - original.dateRecorded) / (1000 * 60 * 60);
    if (hoursOld > 24 && context.role !== 'provider' && context.role !== 'admin') {
      throw new Error('Only providers can modify vital signs older than 24 hours');
    }

    // Prepare update data
    const updateData = {
      ...updates,
      practiceId: context.practiceId, // Ensure practice ID cannot be changed
      patientId: original.patientId // Ensure patient ID cannot be changed
    };

    // Recalculate BMI if weight or height changed
    if (updates.vitals) {
      const mergedVitals = { ...original.vitals, ...updates.vitals };
      if (mergedVitals.weight && mergedVitals.height) {
        updateData.vitals = this.calculateBMI(mergedVitals);
      }

      // Check for new alerts based on updated values
      const alerts = this.checkVitalAlerts(mergedVitals);
      if (alerts.length > 0) {
        updateData.alerts = alerts;
        updateData.followUpRequired = alerts.some(a => a.severity === 'critical');
      }
    }

    // Add audit trail entry
    const auditEntry = {
      action: 'UPDATE',
      performedBy: context.userId,
      timestamp: new Date(),
      changes: this.getChanges(original, updateData)
    };

    // Update using SecureDataAccess
    const updated = await SecureDataAccess.update('vitalsigns', vitalSignId, {
      ...updateData,
      $push: { auditTrail: auditEntry }
    }, context);

    // Create system audit log
    await AuditLog.create({
      action: 'UPDATE_VITAL_SIGNS',
      userId: context.userId,
      patientId: original.patientId,
      practiceId: context.practiceId,
      details: {
        vitalSignsId: vitalSignId,
        changes: auditEntry.changes,
        newAlerts: updateData.alerts
      },
      timestamp: new Date()
    });

    // Send alert if new critical values detected
    if (updateData.alerts?.some(a => a.severity === 'critical')) {
      await this.sendCriticalVitalAlert(original.patientId, updateData.alerts, context);
    }

    return updated;
  }

  async partialUpdateVitalSigns(vitalSignId, partialUpdates, context) {
    // For updating only specific vital parameters
    const original = await SecureDataAccess.findById('vitalsigns', vitalSignId, context);
    
    if (!original) {
      throw new Error('Vital signs record not found');
    }

    // Build update object preserving existing values
    const vitalsUpdate = {};
    Object.keys(partialUpdates).forEach(key => {
      if (original.vitals[key]) {
        vitalsUpdate[`vitals.${key}`] = {
          ...original.vitals[key],
          ...partialUpdates[key],
          updatedAt: new Date()
        };
      }
    });

    return await this.updateVitalSigns(vitalSignId, vitalsUpdate, context);
  }

  async addMissingVital(vitalSignId, vitalType, vitalData, context) {
    // Add a missing vital parameter to existing record
    const original = await SecureDataAccess.findById('vitalsigns', vitalSignId, context);
    
    if (!original) {
      throw new Error('Vital signs record not found');
    }

    if (original.vitals[vitalType]) {
      throw new Error(`${vitalType} already exists in this record`);
    }

    const update = {
      [`vitals.${vitalType}`]: {
        ...vitalData,
        addedAt: new Date()
      }
    };

    // Recalculate BMI if adding weight or height
    if ((vitalType === 'weight' && original.vitals.height) ||
        (vitalType === 'height' && original.vitals.weight)) {
      const mergedVitals = { ...original.vitals };
      mergedVitals[vitalType] = vitalData;
      update.vitals = { ...update.vitals, bmi: this.calculateBMIValue(mergedVitals) };
    }

    return await this.updateVitalSigns(vitalSignId, update, context);
  }

  async correctVitalSign(vitalSignId, corrections, reason, context) {
    // Special function for error corrections with mandatory reason
    if (!reason || reason.trim().length < 10) {
      throw new Error('Correction reason must be at least 10 characters');
    }

    const correctionData = {
      ...corrections,
      correctionReason: reason,
      correctedBy: context.userId,
      correctedAt: new Date()
    };

    const result = await this.updateVitalSigns(vitalSignId, correctionData, context);

    // Send notification about correction
    await this.notifyVitalCorrection(vitalSignId, reason, context);

    return result;
  }

  calculateBMI(vitals) {
    if (!vitals.weight || !vitals.height) return vitals;

    const weight = vitals.weight.unit === 'kg' ? 
      vitals.weight.value : vitals.weight.value * 0.453592;
    const height = vitals.height.unit === 'cm' ? 
      vitals.height.value / 100 : vitals.height.value * 0.0254;
    
    const bmiValue = weight / (height * height);
    
    let category;
    if (bmiValue < 18.5) category = 'underweight';
    else if (bmiValue < 25) category = 'normal';
    else if (bmiValue < 30) category = 'overweight';
    else if (bmiValue < 40) category = 'obese';
    else category = 'morbidly-obese';

    return {
      ...vitals,
      bmi: { value: bmiValue, category }
    };
  }

  getChanges(original, updated) {
    const changes = {};
    
    // Compare vitals
    if (updated.vitals) {
      Object.keys(updated.vitals).forEach(key => {
        if (JSON.stringify(original.vitals[key]) !== JSON.stringify(updated.vitals[key])) {
          changes[`vitals.${key}`] = {
            from: original.vitals[key],
            to: updated.vitals[key]
          };
        }
      });
    }

    // Compare other fields
    ['notes', 'encounterType', 'followUpRequired'].forEach(field => {
      if (updated[field] !== undefined && original[field] !== updated[field]) {
        changes[field] = {
          from: original[field],
          to: updated[field]
        };
      }
    });

    return changes;
  }

  async notifyVitalCorrection(vitalSignId, reason, context) {
    // Notify relevant parties about vital sign correction
    const notificationService = require('./notificationService');
    await notificationService.sendNotification({
      type: 'VITAL_SIGN_CORRECTED',
      vitalSignId,
      reason,
      correctedBy: context.userId,
      practiceId: context.practiceId
    });
  }
}
```

### 2. Create Update API Endpoints
```javascript
// backend/routes/vitals.js (additions)

// Update vital signs
router.put('/api/vitals/:id', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.updateVitalSigns(id, updates, context);
    
    res.json({
      success: true,
      data: result,
      message: 'Vital signs updated successfully'
    });
  } catch (error) {
    console.error('Error updating vital signs:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
});

// Partial update for specific vital parameters
router.patch('/api/vitals/:id/partial', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { id } = req.params;
    const partialUpdates = req.body;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.partialUpdateVitalSigns(id, partialUpdates, context);
    
    res.json({
      success: true,
      data: result,
      message: 'Vital parameters updated successfully'
    });
  } catch (error) {
    console.error('Error partially updating vital signs:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Add missing vital parameter
router.post('/api/vitals/:id/add-parameter', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { id } = req.params;
    const { vitalType, vitalData } = req.body;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.addMissingVital(id, vitalType, vitalData, context);
    
    res.json({
      success: true,
      data: result,
      message: `${vitalType} added successfully`
    });
  } catch (error) {
    console.error('Error adding vital parameter:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Correct vital signs with reason
router.post('/api/vitals/:id/correct', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { id } = req.params;
    const { corrections, reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Correction reason must be at least 10 characters'
      });
    }

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.correctVitalSign(id, corrections, reason, context);
    
    res.json({
      success: true,
      data: result,
      message: 'Vital signs corrected and documented'
    });
  } catch (error) {
    console.error('Error correcting vital signs:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

## Required Endpoints

### PUT /api/vitals/:id
**Description**: Update entire vital signs record
**Access**: Providers, Nurses
**Request Body**:
```json
{
  "vitals": {
    "bloodPressure": {
      "systolic": 125,
      "diastolic": 82,
      "position": "sitting"
    },
    "heartRate": {
      "value": 75,
      "rhythm": "regular"
    }
  },
  "notes": "Updated after rechecking blood pressure"
}
```

### PATCH /api/vitals/:id/partial
**Description**: Update specific vital parameters only
**Access**: Providers, Nurses
**Request Body**:
```json
{
  "bloodPressure": {
    "systolic": 125,
    "diastolic": 82
  }
}
```

### POST /api/vitals/:id/add-parameter
**Description**: Add a missing vital parameter to existing record
**Access**: Providers, Nurses
**Request Body**:
```json
{
  "vitalType": "bloodGlucose",
  "vitalData": {
    "value": 95,
    "fasting": true,
    "unit": "mg/dL"
  }
}
```

### POST /api/vitals/:id/correct
**Description**: Correct vital signs with mandatory reason
**Access**: Providers, Nurses
**Request Body**:
```json
{
  "corrections": {
    "vitals": {
      "temperature": {
        "value": 98.6,
        "method": "oral",
        "unit": "F"
      }
    }
  },
  "reason": "Temperature was incorrectly recorded as 96.8 instead of 98.6"
}
```

## Data Models Required

Updates to existing VitalSigns model:
- Audit trail array for tracking all changes
- Correction fields (reason, correctedBy, correctedAt)
- Update timestamps for individual vital parameters

## Test Cases

### 1. Basic Update
- Update vital signs within 24 hours
- Verify changes tracked in audit trail
- Check BMI recalculation

### 2. Time-based Restrictions
- Attempt update after 24 hours as nurse (should fail)
- Attempt update after 24 hours as provider (should succeed)
- Verify appropriate error messages

### 3. Partial Updates
- Update single vital parameter
- Verify other parameters unchanged
- Check audit trail for specific changes

### 4. Add Missing Parameter
- Add missing vital to existing record
- Verify BMI calculation when adding weight/height
- Check parameter cannot be added twice

### 5. Correction with Reason
- Correct vital with valid reason
- Attempt correction without reason (should fail)
- Verify notification sent

### 6. Alert Generation
- Update to critical values
- Verify new alerts generated
- Check notification system triggered

### 7. Practice Isolation
- Attempt cross-practice update (should fail)
- Verify practice ID preserved in updates

## Dependencies
- SecureDataAccess service for database operations
- AuditLog model for tracking
- Authentication/Authorization middleware
- Notification service for corrections
- Existing VitalSigns model

## Success Criteria
- [ ] Updates preserve data integrity
- [ ] Complete audit trail maintained
- [ ] Time-based restrictions enforced
- [ ] BMI recalculated when needed
- [ ] Alerts generated for critical values
- [ ] Corrections require documentation
- [ ] Partial updates work correctly
- [ ] Missing parameters can be added
- [ ] Multi-tenant isolation maintained
- [ ] Notifications sent for corrections

## Notes
- Consider implementing field-level permissions for sensitive updates
- May need approval workflow for significant changes
- Future enhancement: version history with rollback capability
- Consider adding comparison view for before/after values
- May need integration with clinical decision support for validation