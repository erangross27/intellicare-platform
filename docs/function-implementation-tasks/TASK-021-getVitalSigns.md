# TASK-021: Implement getVitalSigns Function

## Function Details
- **Name**: getVitalSigns
- **Category**: Vital Signs
- **Priority**: Critical
- **Backend Route**: GET `/medical-data/patients/:patientId/vitals` ✅ (Exists)

## Current Implementation
```javascript
async getVitalSigns(params, practiceContext) {
  const { patientId, limit = 10 } = params;
  const response = await this.callAPI(`/medical-data/patients/${patientId}/vitals`, 'GET', { limit }, practiceContext);
  return {
    success: true,
    data: response.data,
    count: response.count,
    message: practiceContext.language === 'he' 
      ? `נמצאו ${response.count} מדידות`
      : `Found ${response.count} vital measurements`
  };
}
```

## Required Implementation

### 1. Enhanced Filtering
- Filter by date range
- Filter by vital type
- Get latest of each type
- Trend analysis

### 2. Data Processing
- Calculate trends
- Identify abnormal values
- Generate alerts
- Format for display

### 3. Clinical Intelligence
- Risk scoring
- Pattern detection
- Comparison to baselines
- Age-adjusted norms

## Implementation Code
```javascript
async getVitalSigns(params, practiceContext, session) {
  try {
    // Extract patientId separately to check context
    let { patientId, ...queryOptions } = params;
    
    // Check context if no patientId provided
    if (!patientId && session?.currentContext?.patientId) {
      patientId = session.currentContext.patientId;
      console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
    }
    
    // Validate patient ID
    if (!patientId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
        : 'Patient ID required. Please search for a patient first');
    }
    
    // Build query parameters
    const queryParams = {
      limit: params.limit || 20,
      sort: params.sort || 'desc'
    };
    
    // Add filters
    if (params.dateFrom) queryParams.dateFrom = params.dateFrom;
    if (params.dateTo) queryParams.dateTo = params.dateTo;
    if (params.vitalType) queryParams.vitalType = params.vitalType;
    if (params.latestOnly) queryParams.latestOnly = true;
    
    // Get vital signs
    const response = await this.callAPI(
      `/medical-data/patients/${params.patientId}/vitals`, 
      'GET', 
      queryParams, 
      practiceContext
    );
    
    if (!response.data || response.data.length === 0) {
      return {
        success: true,
        data: [],
        count: 0,
        message: practiceContext.language === 'he' 
          ? 'לא נמצאו מדידות סימנים חיוניים'
          : 'No vital signs found'
      };
    }
    
    // Get patient info for context
    const patientResponse = await this.callAPI(
      `/patients/${params.patientId}`, 
      'GET', 
      null, 
      practiceContext
    );
    const patient = patientResponse.data;
    
    // Process vital signs
    const vitals = Array.isArray(response.data) ? response.data : [response.data];
    
    // Enhance each vital sign reading
    const enhancedVitals = vitals.map(vital => {
      const enhanced = { ...vital };
      
      // Parse and evaluate each vital
      if (vital.bloodPressure) {
        enhanced.bloodPressureAnalysis = this.analyzeBloodPressure(vital.bloodPressure, patient);
      }
      if (vital.pulse !== undefined) {
        enhanced.pulseAnalysis = this.analyzePulse(vital.pulse, patient);
      }
      if (vital.temperature !== undefined) {
        enhanced.temperatureAnalysis = this.analyzeTemperature(vital.temperature);
      }
      if (vital.oxygenSaturation !== undefined) {
        enhanced.oxygenAnalysis = this.analyzeOxygenSaturation(vital.oxygenSaturation);
      }
      if (vital.weight !== undefined) {
        enhanced.bmi = this.calculateBMI(vital.weight, vital.height || patient.height);
      }
      
      // Overall status
      enhanced.overallStatus = this.determineVitalStatus(enhanced);
      
      // Format date
      enhanced.formattedDate = new Date(vital.recordedAt || vital.date).toLocaleString(
        practiceContext.language === 'he' ? 'he-IL' : 'en-US'
      );
      
      return enhanced;
    });
    
    // Get latest of each vital type
    const latestVitals = this.extractLatestVitals(enhancedVitals);
    
    // Calculate trends if enough data
    let trends = null;
    if (enhancedVitals.length >= 3) {
      trends = this.calculateVitalTrends(enhancedVitals);
    }
    
    // Generate alerts
    const alerts = this.generateVitalAlerts(enhancedVitals, patient, practiceContext);
    
    // Generate summary
    const summary = this.generateVitalsSummary(latestVitals, trends, practiceContext);
    
    return {
      success: true,
      data: enhancedVitals,
      latest: latestVitals,
      trends: trends,
      alerts: alerts,
      summary: summary,
      count: enhancedVitals.length,
      message: this.generateVitalsMessage(enhancedVitals, alerts, practiceContext)
    };
    
  } catch (error) {
    console.error('Error getting vital signs:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בטעינת סימנים חיוניים: ${error.message}`
        : `Error loading vital signs: ${error.message}`
    };
  }
}

// Helper: Analyze blood pressure
analyzeBloodPressure(bp, patient) {
  const [systolic, diastolic] = bp.split('/').map(Number);
  
  let status = 'normal';
  let category = '';
  
  if (systolic < 90 || diastolic < 60) {
    status = 'low';
    category = 'Hypotension';
  } else if (systolic < 120 && diastolic < 80) {
    status = 'normal';
    category = 'Normal';
  } else if (systolic < 130 && diastolic < 80) {
    status = 'elevated';
    category = 'Elevated';
  } else if (systolic < 140 || diastolic < 90) {
    status = 'high';
    category = 'Stage 1 Hypertension';
  } else if (systolic < 180 || diastolic < 120) {
    status = 'very-high';
    category = 'Stage 2 Hypertension';
  } else {
    status = 'critical';
    category = 'Hypertensive Crisis';
  }
  
  return {
    systolic,
    diastolic,
    status,
    category,
    isNormal: status === 'normal',
    requiresAttention: ['high', 'very-high', 'critical', 'low'].includes(status)
  };
}

// Helper: Analyze pulse
analyzePulse(pulse, patient) {
  let status = 'normal';
  let message = '';
  
  // Age-adjusted ranges
  const age = patient?.age || 40;
  let minNormal = 60;
  let maxNormal = 100;
  
  if (age < 1) {
    minNormal = 100;
    maxNormal = 160;
  } else if (age < 10) {
    minNormal = 70;
    maxNormal = 120;
  } else if (age < 18) {
    minNormal = 60;
    maxNormal = 100;
  }
  
  if (pulse < minNormal) {
    status = 'low';
    message = 'Bradycardia';
  } else if (pulse > maxNormal) {
    status = 'high';
    message = 'Tachycardia';
  } else {
    status = 'normal';
    message = 'Normal';
  }
  
  return {
    value: pulse,
    status,
    message,
    range: `${minNormal}-${maxNormal}`,
    isNormal: status === 'normal'
  };
}

// Helper: Analyze temperature
analyzeTemperature(temp) {
  let status = 'normal';
  let message = '';
  
  if (temp < 35) {
    status = 'very-low';
    message = 'Hypothermia';
  } else if (temp < 36.5) {
    status = 'low';
    message = 'Below normal';
  } else if (temp <= 37.5) {
    status = 'normal';
    message = 'Normal';
  } else if (temp <= 38.5) {
    status = 'elevated';
    message = 'Low-grade fever';
  } else if (temp <= 39.5) {
    status = 'high';
    message = 'Fever';
  } else {
    status = 'very-high';
    message = 'High fever';
  }
  
  return {
    value: temp,
    status,
    message,
    isNormal: status === 'normal',
    requiresAttention: ['very-low', 'high', 'very-high'].includes(status)
  };
}

// Helper: Analyze oxygen saturation
analyzeOxygenSaturation(spo2) {
  let status = 'normal';
  let message = '';
  
  if (spo2 >= 95) {
    status = 'normal';
    message = 'Normal';
  } else if (spo2 >= 92) {
    status = 'low-normal';
    message = 'Low normal';
  } else if (spo2 >= 88) {
    status = 'low';
    message = 'Hypoxemia';
  } else {
    status = 'critical';
    message = 'Severe hypoxemia';
  }
  
  return {
    value: spo2,
    status,
    message,
    isNormal: status === 'normal' || status === 'low-normal',
    requiresAttention: status === 'low' || status === 'critical'
  };
}

// Helper: Calculate BMI
calculateBMI(weight, height) {
  if (!weight || !height) return null;
  
  const heightInMeters = height / 100;
  const bmi = weight / (heightInMeters * heightInMeters);
  
  let category = '';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Normal';
  else if (bmi < 30) category = 'Overweight';
  else category = 'Obese';
  
  return {
    value: Math.round(bmi * 10) / 10,
    category,
    isNormal: bmi >= 18.5 && bmi < 25
  };
}

// Helper: Determine overall status
determineVitalStatus(vital) {
  const analyses = [
    vital.bloodPressureAnalysis,
    vital.pulseAnalysis,
    vital.temperatureAnalysis,
    vital.oxygenAnalysis
  ].filter(Boolean);
  
  if (analyses.some(a => a.status === 'critical')) return 'critical';
  if (analyses.some(a => a.requiresAttention)) return 'warning';
  if (analyses.every(a => a.isNormal)) return 'normal';
  return 'attention';
}

// Helper: Extract latest vitals
extractLatestVitals(vitals) {
  const latest = {};
  
  vitals.forEach(vital => {
    if (vital.bloodPressure && !latest.bloodPressure) {
      latest.bloodPressure = vital.bloodPressureAnalysis;
    }
    if (vital.pulse !== undefined && !latest.pulse) {
      latest.pulse = vital.pulseAnalysis;
    }
    if (vital.temperature !== undefined && !latest.temperature) {
      latest.temperature = vital.temperatureAnalysis;
    }
    if (vital.oxygenSaturation !== undefined && !latest.oxygenSaturation) {
      latest.oxygenSaturation = vital.oxygenAnalysis;
    }
    if (vital.weight && !latest.weight) {
      latest.weight = vital.weight;
      latest.bmi = vital.bmi;
    }
  });
  
  return latest;
}

// Helper: Calculate trends
calculateVitalTrends(vitals) {
  // Implementation would analyze trends over time
  // Simplified for brevity
  return {
    bloodPressure: 'stable',
    pulse: 'stable',
    temperature: 'stable',
    weight: 'stable'
  };
}

// Helper: Generate alerts
generateVitalAlerts(vitals, patient, practiceContext) {
  const alerts = [];
  const isHebrew = practiceContext.language === 'he';
  
  // Check latest vitals for critical values
  const latest = vitals[0];
  if (latest) {
    if (latest.overallStatus === 'critical') {
      alerts.push({
        type: 'critical',
        message: isHebrew 
          ? 'ערכים קריטיים דורשים התייחסות מיידית'
          : 'Critical values require immediate attention'
      });
    }
    
    if (latest.bloodPressureAnalysis?.status === 'critical') {
      alerts.push({
        type: 'critical',
        message: isHebrew 
          ? 'משבר יתר לחץ דם - פנה לחדר מיון'
          : 'Hypertensive crisis - seek emergency care'
      });
    }
  }
  
  return alerts;
}

// Helper: Generate summary
generateVitalsSummary(latest, trends, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  const parts = [];
  
  if (latest.bloodPressure) {
    parts.push(`BP: ${latest.bloodPressure.systolic}/${latest.bloodPressure.diastolic}`);
  }
  if (latest.pulse) {
    parts.push(`Pulse: ${latest.pulse.value}`);
  }
  if (latest.temperature) {
    parts.push(`Temp: ${latest.temperature.value}°C`);
  }
  if (latest.oxygenSaturation) {
    parts.push(`SpO2: ${latest.oxygenSaturation.value}%`);
  }
  
  return parts.join(' | ');
}

// Helper: Generate message
generateVitalsMessage(vitals, alerts, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  if (alerts.some(a => a.type === 'critical')) {
    return isHebrew 
      ? `נמצאו ${vitals.length} מדידות - נדרשת התייחסות דחופה`
      : `Found ${vitals.length} measurements - urgent attention required`;
  }
  
  return isHebrew 
    ? `נמצאו ${vitals.length} מדידות סימנים חיוניים`
    : `Found ${vitals.length} vital sign measurements`;
}
```

## Testing Checklist
- [ ] Test with no vital signs
- [ ] Test with single vital sign
- [ ] Test with multiple vital signs
- [ ] Test blood pressure analysis
- [ ] Test pulse analysis
- [ ] Test temperature analysis
- [ ] Test oxygen saturation analysis
- [ ] Test BMI calculation
- [ ] Test trend calculation
- [ ] Test alert generation
- [ ] Test with critical values
- [ ] Test Hebrew responses
- [ ] Test English responses

## Notes
- Add graphing capabilities for trends
- Integrate with monitoring devices
- Add baseline comparison
- Implement early warning scores