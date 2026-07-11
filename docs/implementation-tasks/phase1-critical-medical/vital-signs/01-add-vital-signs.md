# Add Vital Signs

## Function Details
- **Name**: addVitalSigns
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 4 hours

## Problem Description
The system currently lacks the ability to record patient vital signs. Healthcare providers need to document blood pressure, heart rate, temperature, respiratory rate, oxygen saturation, weight, height, and BMI during patient encounters. This is essential for clinical assessment and monitoring patient health status.

## Implementation Steps

### 1. Create Vital Signs Data Model
```javascript
// backend/models/VitalSigns.js
const vitalSignsSchema = new Schema({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  practiceId: {
    type: String,
    required: true,
    index: true
  },
  recordedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  encounterType: {
    type: String,
    enum: ['routine', 'emergency', 'telehealth', 'home-visit', 'pre-op', 'post-op'],
    required: true
  },
  dateRecorded: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  vitals: {
    bloodPressure: {
      systolic: { type: Number, min: 40, max: 300 },
      diastolic: { type: Number, min: 20, max: 200 },
      position: { type: String, enum: ['sitting', 'standing', 'lying', 'left-arm', 'right-arm'] },
      unit: { type: String, default: 'mmHg' }
    },
    heartRate: {
      value: { type: Number, min: 20, max: 300 },
      rhythm: { type: String, enum: ['regular', 'irregular', 'tachycardic', 'bradycardic'] },
      unit: { type: String, default: 'bpm' }
    },
    respiratoryRate: {
      value: { type: Number, min: 5, max: 60 },
      pattern: { type: String, enum: ['regular', 'irregular', 'labored', 'shallow'] },
      unit: { type: String, default: 'breaths/min' }
    },
    temperature: {
      value: { type: Number, min: 85, max: 115 },
      method: { type: String, enum: ['oral', 'rectal', 'axillary', 'temporal', 'tympanic'] },
      unit: { type: String, enum: ['F', 'C'], default: 'F' }
    },
    oxygenSaturation: {
      value: { type: Number, min: 50, max: 100 },
      onOxygen: { type: Boolean, default: false },
      oxygenFlow: { type: Number }, // L/min if on oxygen
      unit: { type: String, default: '%' }
    },
    weight: {
      value: { type: Number, min: 0.5, max: 1000 },
      unit: { type: String, enum: ['kg', 'lbs'], default: 'lbs' }
    },
    height: {
      value: { type: Number, min: 10, max: 300 },
      unit: { type: String, enum: ['cm', 'inches'], default: 'inches' }
    },
    bmi: {
      value: { type: Number },
      category: { type: String, enum: ['underweight', 'normal', 'overweight', 'obese', 'morbidly-obese'] }
    },
    painScore: {
      value: { type: Number, min: 0, max: 10 },
      location: String,
      description: String
    },
    bloodGlucose: {
      value: { type: Number, min: 20, max: 600 },
      fasting: { type: Boolean },
      unit: { type: String, enum: ['mg/dL', 'mmol/L'], default: 'mg/dL' }
    }
  },
  alerts: [{
    type: {
      type: String,
      enum: ['critical-high', 'critical-low', 'abnormal-high', 'abnormal-low', 'trending-worse']
    },
    parameter: String,
    message: String,
    severity: { type: String, enum: ['critical', 'warning', 'info'] }
  }],
  notes: String,
  followUpRequired: Boolean,
  isDeleted: { type: Boolean, default: false },
  auditTrail: [{
    action: String,
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    changes: Schema.Types.Mixed
  }]
});

// Auto-calculate BMI
vitalSignsSchema.pre('save', function(next) {
  if (this.vitals.weight && this.vitals.height) {
    const weight = this.vitals.weight.unit === 'kg' ? 
      this.vitals.weight.value : this.vitals.weight.value * 0.453592;
    const height = this.vitals.height.unit === 'cm' ? 
      this.vitals.height.value / 100 : this.vitals.height.value * 0.0254;
    
    this.vitals.bmi.value = weight / (height * height);
    
    if (this.vitals.bmi.value < 18.5) this.vitals.bmi.category = 'underweight';
    else if (this.vitals.bmi.value < 25) this.vitals.bmi.category = 'normal';
    else if (this.vitals.bmi.value < 30) this.vitals.bmi.category = 'overweight';
    else if (this.vitals.bmi.value < 40) this.vitals.bmi.category = 'obese';
    else this.vitals.bmi.category = 'morbidly-obese';
  }
  next();
});
```

### 2. Create Vital Signs Service
```javascript
// backend/services/vitalSignsService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');

class VitalSignsService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('vital-signs-service');
  }

  async addVitalSigns(vitalData, context) {
    // Check for abnormal values
    const alerts = this.checkVitalAlerts(vitalData.vitals);
    
    // Add alerts to vital data
    if (alerts.length > 0) {
      vitalData.alerts = alerts;
      vitalData.followUpRequired = alerts.some(a => a.severity === 'critical');
    }

    // Save vital signs using SecureDataAccess
    const result = await SecureDataAccess.create('vitalsigns', vitalData, context);

    // Create audit log
    await AuditLog.create({
      action: 'ADD_VITAL_SIGNS',
      userId: context.userId,
      patientId: vitalData.patientId,
      practiceId: context.practiceId,
      details: { vitalSignsId: result._id, alerts },
      timestamp: new Date()
    });

    // Send critical alerts if needed
    if (alerts.some(a => a.severity === 'critical')) {
      await this.sendCriticalVitalAlert(vitalData.patientId, alerts, context);
    }

    return result;
  }

  checkVitalAlerts(vitals) {
    const alerts = [];

    // Blood pressure checks
    if (vitals.bloodPressure) {
      if (vitals.bloodPressure.systolic > 180 || vitals.bloodPressure.diastolic > 120) {
        alerts.push({
          type: 'critical-high',
          parameter: 'bloodPressure',
          message: 'Hypertensive crisis - immediate medical attention required',
          severity: 'critical'
        });
      } else if (vitals.bloodPressure.systolic < 90 || vitals.bloodPressure.diastolic < 60) {
        alerts.push({
          type: 'critical-low',
          parameter: 'bloodPressure',
          message: 'Hypotension detected',
          severity: 'warning'
        });
      }
    }

    // Heart rate checks
    if (vitals.heartRate) {
      if (vitals.heartRate.value > 150) {
        alerts.push({
          type: 'critical-high',
          parameter: 'heartRate',
          message: 'Severe tachycardia',
          severity: 'critical'
        });
      } else if (vitals.heartRate.value < 40) {
        alerts.push({
          type: 'critical-low',
          parameter: 'heartRate',
          message: 'Severe bradycardia',
          severity: 'critical'
        });
      }
    }

    // Oxygen saturation checks
    if (vitals.oxygenSaturation) {
      if (vitals.oxygenSaturation.value < 90) {
        alerts.push({
          type: 'critical-low',
          parameter: 'oxygenSaturation',
          message: 'Hypoxemia - oxygen therapy may be required',
          severity: vitals.oxygenSaturation.value < 85 ? 'critical' : 'warning'
        });
      }
    }

    // Temperature checks
    if (vitals.temperature) {
      const tempF = vitals.temperature.unit === 'C' ? 
        (vitals.temperature.value * 9/5) + 32 : vitals.temperature.value;
      
      if (tempF > 104) {
        alerts.push({
          type: 'critical-high',
          parameter: 'temperature',
          message: 'Hyperpyrexia - immediate cooling measures required',
          severity: 'critical'
        });
      } else if (tempF < 95) {
        alerts.push({
          type: 'critical-low',
          parameter: 'temperature',
          message: 'Hypothermia detected',
          severity: 'warning'
        });
      }
    }

    return alerts;
  }

  async sendCriticalVitalAlert(patientId, alerts, context) {
    // Implementation for sending alerts to medical staff
    const notificationService = require('./notificationService');
    await notificationService.sendUrgentAlert({
      type: 'CRITICAL_VITALS',
      patientId,
      alerts,
      practiceId: context.practiceId
    });
  }
}

module.exports = new VitalSignsService();
```

### 3. Create API Endpoint
```javascript
// backend/routes/vitals.js
router.post('/api/vitals/add', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const vitalData = {
      ...req.body,
      practiceId: req.practice.id,
      recordedBy: req.user.id
    };

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.addVitalSigns(vitalData, context);
    
    res.json({
      success: true,
      data: result,
      message: result.alerts?.length > 0 ? 
        'Vital signs recorded with alerts' : 'Vital signs recorded successfully'
    });
  } catch (error) {
    console.error('Error adding vital signs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record vital signs'
    });
  }
});
```

## Required Endpoints

### POST /api/vitals/add
**Description**: Record new vital signs for a patient
**Access**: Providers, Nurses
**Request Body**:
```json
{
  "patientId": "60d5eca7f1b2c8b1d8e4f89a",
  "encounterType": "routine",
  "vitals": {
    "bloodPressure": {
      "systolic": 120,
      "diastolic": 80,
      "position": "sitting"
    },
    "heartRate": {
      "value": 72,
      "rhythm": "regular"
    },
    "respiratoryRate": {
      "value": 16,
      "pattern": "regular"
    },
    "temperature": {
      "value": 98.6,
      "method": "oral",
      "unit": "F"
    },
    "oxygenSaturation": {
      "value": 98,
      "onOxygen": false
    },
    "weight": {
      "value": 170,
      "unit": "lbs"
    },
    "height": {
      "value": 70,
      "unit": "inches"
    },
    "painScore": {
      "value": 0
    }
  },
  "notes": "Patient appears comfortable, no distress noted"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "60d5eca7f1b2c8b1d8e4f89b",
    "patientId": "60d5eca7f1b2c8b1d8e4f89a",
    "vitals": {...},
    "bmi": {
      "value": 24.4,
      "category": "normal"
    },
    "alerts": [],
    "dateRecorded": "2024-12-19T10:30:00Z"
  },
  "message": "Vital signs recorded successfully"
}
```

## Data Models Required

### VitalSigns Collection
- Patient reference with indexing
- Comprehensive vital parameters
- Alert system for abnormal values
- Audit trail for changes
- Soft delete capability

### Related Collections
- Patients (for patient reference)
- Users (for recorded by reference)
- AuditLog (for tracking changes)

## Test Cases

### 1. Normal Vital Signs Recording
- Input valid vital signs within normal ranges
- Verify successful storage
- Check BMI calculation
- Confirm no alerts generated

### 2. Critical Value Detection
- Input critical values (e.g., BP 200/120)
- Verify critical alert generation
- Check notification system triggered
- Confirm follow-up flag set

### 3. Incomplete Vital Signs
- Submit partial vital signs (e.g., only BP and pulse)
- Verify system accepts partial data
- Check BMI not calculated without height/weight

### 4. Unit Conversion
- Test metric vs imperial units
- Verify correct BMI calculation with different units
- Check temperature F/C conversion

### 5. Permission Testing
- Verify only authorized roles can add vitals
- Test audit trail creation
- Confirm practice isolation

## Dependencies
- SecureDataAccess service for database operations
- AuditLog model for tracking
- Authentication/Authorization middleware
- Notification service for alerts
- ServiceAccountManager for service authentication

## Success Criteria
- [ ] Vital signs model created with all parameters
- [ ] Service handles normal and abnormal values
- [ ] Alert system identifies critical values
- [ ] BMI auto-calculation works correctly
- [ ] API endpoint secured with proper authorization
- [ ] Audit trail records all additions
- [ ] Critical alerts trigger notifications
- [ ] Unit conversions work correctly
- [ ] Partial vital signs accepted
- [ ] Multi-tenant isolation enforced

## Notes
- Consider integration with medical devices for automatic vital sign capture
- May need to add pediatric-specific normal ranges
- Future enhancement: trend analysis and graphing capabilities
- Consider adding vital sign templates for different encounter types
- May need integration with EHR systems for data exchange