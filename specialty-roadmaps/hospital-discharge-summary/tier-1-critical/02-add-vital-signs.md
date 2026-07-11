# Task 02: addVitalSigns() Tool

**Priority**: CRITICAL
**Timeline**: 2-3 days
**Complexity**: Low-Medium
**Dependencies**: vital_signs collection schema

## Problem Statement

Hospital discharge summaries contain vital signs measurements that are critical for trending analysis, clinical alerts, and quality metrics. Currently, IntelliCare extracts vital signs as unstructured text, preventing automated trending and alerting.

**Example from David Wilson**:
- Blood Pressure: 142/88 mmHg
- Temperature: 37.2°C
- Pulse: 88 bpm
- Respiratory Rate: 18/min
- SpO2: 95% on room air

**Current Gap**: No structured storage, no trending capability, no abnormal value alerts

## Tool Specification

### Function Name
`addVitalSigns()`

### Parameters
```javascript
{
  patientId: string,              // Required
  measurementDate: string,        // ISO datetime (when measured)
  bloodPressure: {                // Optional
    systolic: number,             // mmHg
    diastolic: number,            // mmHg
    position: string              // "sitting" | "standing" | "lying"
  },
  temperature: {                  // Optional
    value: number,                // Celsius or Fahrenheit
    unit: string,                 // "C" | "F"
    route: string                 // "oral" | "rectal" | "axillary" | "tympanic"
  },
  pulse: {                        // Optional
    value: number,                // bpm
    rhythm: string                // "regular" | "irregular"
  },
  respiratoryRate: number,        // breaths/min (optional)
  oxygenSaturation: {             // Optional
    value: number,                // percentage (0-100)
    onOxygen: boolean,
    flowRate: number,             // L/min if onOxygen
    device: string                // "nasal cannula" | "face mask" | "room air"
  },
  weight: {                       // Optional
    value: number,
    unit: string                  // "kg" | "lbs"
  },
  height: {                       // Optional
    value: number,
    unit: string                  // "cm" | "inches"
  },
  bmi: number,                    // Calculated (optional)
  measuredBy: string,             // Provider/nurse ID or name (optional)
  location: string,               // "hospital" | "clinic" | "home" (optional)
  notes: string                   // Additional context (optional)
}
```

### Return Value
```javascript
{
  success: boolean,
  vitalSignsId: string,
  alerts: [                       // Abnormal values detected
    {
      parameter: string,          // "bloodPressure" | "temperature" | etc.
      value: string,
      severity: string,           // "critical" | "abnormal" | "borderline"
      message: string
    }
  ],
  message: string
}
```

## Implementation Checklist

### Step 1: Schema Definition
**File**: `apps/backend-api/services/collectionSchemas.js`

- [ ] Verify vital_signs collection schema exists
- [ ] Add nested object support for BP, temp, pulse, SpO2
- [ ] Add validation rules for normal ranges
- [ ] Add indexes: patientId, measurementDate

### Step 2: Collection Registration
**File**: `apps/backend-api/services/medicalCollectionsService.js`

- [ ] Verify vital_signs in allCollections array

### Step 3: Service Implementation
**File**: `apps/backend-api/services/vitalSignsService.js` (create if doesn't exist)

```javascript
async addVitalSigns(params, practiceContext) {
  const context = {
    serviceId: 'vital-signs-service',
    operation: 'create',
    practiceId: practiceContext.subdomain
  };

  // Validate vital signs ranges
  const alerts = this.checkAbnormalValues(params);

  // Calculate BMI if height and weight provided
  if (params.height && params.weight) {
    params.bmi = this.calculateBMI(params.height, params.weight);
  }

  // Create vital signs record
  const vitalSigns = {
    ...params,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await SecureDataAccess.insert(
    'vital_signs',
    vitalSigns,
    context
  );

  // Log alerts if any
  if (alerts.length > 0 && process.env.QUIET_LOGS !== 'true') {
    console.log(`⚠️ [Vital Signs] Abnormal values detected for patient ${params.patientId}:`, alerts);
  }

  return {
    success: true,
    vitalSignsId: result._id,
    alerts: alerts,
    message: practiceContext.language === 'he'
      ? 'סימנים חיוניים נוספו בהצלחה'
      : 'Vital signs added successfully'
  };
}

checkAbnormalValues(params) {
  const alerts = [];

  // Blood pressure alerts
  if (params.bloodPressure) {
    const { systolic, diastolic } = params.bloodPressure;
    if (systolic >= 180 || diastolic >= 120) {
      alerts.push({
        parameter: 'bloodPressure',
        value: `${systolic}/${diastolic}`,
        severity: 'critical',
        message: 'Hypertensive crisis'
      });
    } else if (systolic >= 140 || diastolic >= 90) {
      alerts.push({
        parameter: 'bloodPressure',
        value: `${systolic}/${diastolic}`,
        severity: 'abnormal',
        message: 'Elevated blood pressure'
      });
    }
  }

  // Temperature alerts
  if (params.temperature) {
    const tempC = params.temperature.unit === 'F'
      ? (params.temperature.value - 32) * 5/9
      : params.temperature.value;

    if (tempC >= 39.4) {
      alerts.push({
        parameter: 'temperature',
        value: `${params.temperature.value}${params.temperature.unit}`,
        severity: 'critical',
        message: 'High fever'
      });
    } else if (tempC >= 38.0) {
      alerts.push({
        parameter: 'temperature',
        value: `${params.temperature.value}${params.temperature.unit}`,
        severity: 'abnormal',
        message: 'Fever'
      });
    }
  }

  // SpO2 alerts
  if (params.oxygenSaturation) {
    if (params.oxygenSaturation.value < 90) {
      alerts.push({
        parameter: 'oxygenSaturation',
        value: `${params.oxygenSaturation.value}%`,
        severity: 'critical',
        message: 'Severe hypoxemia'
      });
    } else if (params.oxygenSaturation.value < 94) {
      alerts.push({
        parameter: 'oxygenSaturation',
        value: `${params.oxygenSaturation.value}%`,
        severity: 'abnormal',
        message: 'Low oxygen saturation'
      });
    }
  }

  return alerts;
}

calculateBMI(height, weight) {
  // Convert to metric
  let heightM = height.unit === 'cm' ? height.value / 100 : height.value * 0.0254;
  let weightKg = weight.unit === 'kg' ? weight.value : weight.value * 0.453592;

  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}
```

### Step 4: Function Registration
**File**: `apps/backend-api/services/utils/aiHelpers.js`

- [ ] Add addVitalSigns to getAllPlatformFunctions() (lines 1000-1300)
- [ ] Include clear description for Claude
- [ ] Define parameter schema with nested objects

### Step 5: Agent System Prompt
**File**: `apps/backend-api/services/agentSystemPrompt.js`

- [ ] Add addVitalSigns to ALL_FUNCTION_NAMES array
- [ ] Add usage instructions for discharge summary processing

### Step 6: Route Integration (if needed)
**File**: `apps/backend-api/routes/agent.js`

- [ ] Verify function executes through agentServiceV4.executeFunction()

## Testing Strategy

### Unit Tests
```javascript
// Test 1: Add complete vital signs
await addVitalSigns({
  patientId: 'helen_cox',
  measurementDate: '2025-10-15T08:30:00Z',
  bloodPressure: { systolic: 142, diastolic: 88, position: 'sitting' },
  temperature: { value: 37.2, unit: 'C', route: 'oral' },
  pulse: { value: 88, rhythm: 'regular' },
  respiratoryRate: 18,
  oxygenSaturation: { value: 95, onOxygen: false, device: 'room air' },
  measuredBy: 'Nurse Johnson',
  location: 'hospital'
});

// Test 2: Abnormal value detection
// Should return alerts for elevated BP

// Test 3: BMI calculation
// Should auto-calculate from height/weight

// Test 4: Temperature unit conversion
// Should detect fever regardless of C or F
```

### Integration Test
```javascript
// Process David Wilson discharge summary
// Verify all vital signs extracted:
// - BP: 142/88 mmHg
// - Temp: 37.2°C
// - Pulse: 88 bpm
// - RR: 18/min
// - SpO2: 95% room air
```

## Normal Ranges Reference

| Parameter | Normal Range | Borderline | Abnormal | Critical |
|-----------|--------------|------------|----------|----------|
| BP Systolic | 90-120 mmHg | 120-139 | 140-179 | ≥180 |
| BP Diastolic | 60-80 mmHg | 80-89 | 90-119 | ≥120 |
| Temperature | 36.1-37.2°C | 37.3-37.9 | 38.0-39.3 | ≥39.4 |
| Pulse | 60-100 bpm | 50-59, 101-110 | 40-49, 111-130 | <40, >130 |
| Respiratory Rate | 12-20/min | 10-11, 21-24 | 8-9, 25-29 | <8, ≥30 |
| SpO2 | 95-100% | 94% | 90-93% | <90% |
| BMI | 18.5-24.9 | 25-29.9 | 30-39.9 | ≥40 |

## Success Criteria

- ✅ Tool stores vital signs in vital_signs collection
- ✅ All parameters supported (BP, temp, pulse, RR, SpO2, weight, height)
- ✅ Abnormal value detection working
- ✅ BMI auto-calculation implemented
- ✅ Multi-tenant isolation maintained
- ✅ Claude successfully calls function during discharge summary processing
- ✅ David Wilson's vital signs extracted and stored correctly

## Future Enhancements

- Trending analysis (detect deterioration)
- Graphing for patient portal
- Integration with remote monitoring devices
- Real-time alerts for critical values

## Related Tasks

- Task 01: createDiagnosis() - Clinical context for vital signs
- Task 06: createCarePlan() - Vital sign targets in care plans

## References

- **Normal Vital Signs**: https://www.ncbi.nlm.nih.gov/books/NBK553223/
- **IntelliCare Security**: CLAUDE.md lines 71-100
- **6-Step Checklist**: CLAUDE.md lines 21-69
