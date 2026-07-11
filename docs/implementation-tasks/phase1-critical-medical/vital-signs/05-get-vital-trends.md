# Get Vital Trends

## Function Details
- **Name**: getVitalTrends
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 4 hours

## Problem Description
Healthcare providers need to analyze vital sign trends over time to identify patterns, deterioration, or improvement in patient health. The system must provide comprehensive trend analysis with visualizable data points, statistical calculations, and intelligent alerts for concerning trends.

## Implementation Steps

### 1. Create Trend Analysis Service
```javascript
// backend/services/vitalTrendsService.js

const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');

class VitalTrendsService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('vital-trends-service');
  }

  async getVitalTrends(patientId, options = {}, context) {
    const {
      startDate,
      endDate = new Date(),
      vitalTypes = ['all'],
      interval = 'daily', // hourly, daily, weekly, monthly
      includeStatistics = true,
      includeForecasting = false,
      includeBenchmarks = false,
      minDataPoints = 2
    } = options;

    // Calculate date range
    const dateRange = this.calculateDateRange(startDate, endDate, interval);
    
    // Build query
    const query = {
      patientId,
      practiceId: context.practiceId,
      isDeleted: false,
      dateRecorded: {
        $gte: dateRange.start,
        $lte: dateRange.end
      }
    };

    // Retrieve vital signs data
    const vitalRecords = await SecureDataAccess.query('vitalsigns', query, {
      sort: { dateRecorded: 1 }
    }, context);

    if (vitalRecords.length < minDataPoints) {
      return {
        success: false,
        message: `Insufficient data points. Found ${vitalRecords.length}, minimum required: ${minDataPoints}`,
        data: null
      };
    }

    // Process trends for requested vital types
    const trends = vitalTypes[0] === 'all' ? 
      this.processAllVitalTrends(vitalRecords, interval) :
      this.processSpecificVitalTrends(vitalRecords, vitalTypes, interval);

    // Add statistical analysis
    if (includeStatistics) {
      trends.statistics = this.calculateStatistics(vitalRecords, vitalTypes);
    }

    // Add forecasting if requested
    if (includeForecasting && vitalRecords.length >= 10) {
      trends.forecast = this.generateForecast(trends);
    }

    // Add benchmarks if requested
    if (includeBenchmarks) {
      trends.benchmarks = await this.getBenchmarks(patientId, vitalTypes, context);
    }

    // Identify concerning trends
    trends.alerts = this.identifyTrendAlerts(trends);

    // Create audit log
    await AuditLog.create({
      action: 'VIEW_VITAL_TRENDS',
      userId: context.userId,
      patientId,
      practiceId: context.practiceId,
      details: {
        dateRange: dateRange,
        vitalTypes: vitalTypes,
        recordCount: vitalRecords.length
      },
      timestamp: new Date()
    });

    return {
      success: true,
      data: trends,
      metadata: {
        patientId,
        dateRange,
        dataPoints: vitalRecords.length,
        interval,
        lastUpdated: vitalRecords[vitalRecords.length - 1]?.dateRecorded
      }
    };
  }

  processAllVitalTrends(records, interval) {
    const trends = {
      bloodPressure: {
        systolic: [],
        diastolic: [],
        map: [] // Mean Arterial Pressure
      },
      heartRate: [],
      respiratoryRate: [],
      temperature: [],
      oxygenSaturation: [],
      weight: [],
      bmi: [],
      painScore: [],
      bloodGlucose: []
    };

    // Group records by interval
    const grouped = this.groupByInterval(records, interval);

    Object.keys(grouped).forEach(intervalKey => {
      const intervalRecords = grouped[intervalKey];
      const aggregated = this.aggregateVitals(intervalRecords);
      
      // Blood Pressure
      if (aggregated.bloodPressure) {
        trends.bloodPressure.systolic.push({
          x: intervalKey,
          y: aggregated.bloodPressure.systolic,
          count: aggregated.bloodPressure.count
        });
        trends.bloodPressure.diastolic.push({
          x: intervalKey,
          y: aggregated.bloodPressure.diastolic,
          count: aggregated.bloodPressure.count
        });
        // Calculate MAP: (2 * diastolic + systolic) / 3
        const map = (2 * aggregated.bloodPressure.diastolic + aggregated.bloodPressure.systolic) / 3;
        trends.bloodPressure.map.push({
          x: intervalKey,
          y: Math.round(map),
          count: aggregated.bloodPressure.count
        });
      }

      // Other vitals
      ['heartRate', 'respiratoryRate', 'temperature', 'oxygenSaturation', 'weight', 'bmi', 'painScore', 'bloodGlucose'].forEach(vitalType => {
        if (aggregated[vitalType]) {
          trends[vitalType].push({
            x: intervalKey,
            y: aggregated[vitalType].value,
            count: aggregated[vitalType].count,
            min: aggregated[vitalType].min,
            max: aggregated[vitalType].max
          });
        }
      });
    });

    return trends;
  }

  aggregateVitals(records) {
    const aggregated = {};

    // Blood Pressure aggregation
    const bpValues = records
      .filter(r => r.vitals.bloodPressure)
      .map(r => r.vitals.bloodPressure);
    
    if (bpValues.length > 0) {
      aggregated.bloodPressure = {
        systolic: Math.round(bpValues.reduce((sum, bp) => sum + bp.systolic, 0) / bpValues.length),
        diastolic: Math.round(bpValues.reduce((sum, bp) => sum + bp.diastolic, 0) / bpValues.length),
        count: bpValues.length
      };
    }

    // Aggregate other vitals
    const vitalMappings = {
      heartRate: 'vitals.heartRate.value',
      respiratoryRate: 'vitals.respiratoryRate.value',
      temperature: 'vitals.temperature.value',
      oxygenSaturation: 'vitals.oxygenSaturation.value',
      weight: 'vitals.weight.value',
      bmi: 'vitals.bmi.value',
      painScore: 'vitals.painScore.value',
      bloodGlucose: 'vitals.bloodGlucose.value'
    };

    Object.keys(vitalMappings).forEach(key => {
      const values = records
        .map(r => this.getNestedValue(r, vitalMappings[key]))
        .filter(v => v !== null && v !== undefined);
      
      if (values.length > 0) {
        aggregated[key] = {
          value: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length * 10) / 10,
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });

    return aggregated;
  }

  calculateStatistics(records, vitalTypes) {
    const stats = {};

    // Calculate for each vital type
    const processVital = (vitalName, accessor) => {
      const values = records
        .map(r => accessor(r))
        .filter(v => v !== null && v !== undefined);
      
      if (values.length === 0) return null;

      const sorted = values.sort((a, b) => a - b);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      
      // Calculate standard deviation
      const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
      const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
      const stdDev = Math.sqrt(variance);

      return {
        mean: Math.round(mean * 10) / 10,
        median: sorted[Math.floor(sorted.length / 2)],
        mode: this.calculateMode(values),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        range: sorted[sorted.length - 1] - sorted[0],
        standardDeviation: Math.round(stdDev * 10) / 10,
        percentiles: {
          p25: sorted[Math.floor(sorted.length * 0.25)],
          p50: sorted[Math.floor(sorted.length * 0.50)],
          p75: sorted[Math.floor(sorted.length * 0.75)],
          p95: sorted[Math.floor(sorted.length * 0.95)]
        },
        trend: this.calculateTrendLine(values),
        variability: stdDev / mean, // Coefficient of variation
        dataPoints: values.length
      };
    };

    // Process each vital type
    stats.bloodPressure = {
      systolic: processVital('bloodPressure.systolic', r => r.vitals.bloodPressure?.systolic),
      diastolic: processVital('bloodPressure.diastolic', r => r.vitals.bloodPressure?.diastolic)
    };
    
    stats.heartRate = processVital('heartRate', r => r.vitals.heartRate?.value);
    stats.temperature = processVital('temperature', r => r.vitals.temperature?.value);
    stats.oxygenSaturation = processVital('oxygenSaturation', r => r.vitals.oxygenSaturation?.value);
    stats.weight = processVital('weight', r => r.vitals.weight?.value);
    stats.bmi = processVital('bmi', r => r.vitals.bmi?.value);

    return stats;
  }

  calculateTrendLine(values) {
    if (values.length < 2) return 'insufficient-data';
    
    // Simple linear regression
    const n = values.length;
    const indices = Array.from({length: n}, (_, i) => i);
    
    const sumX = indices.reduce((sum, x) => sum + x, 0);
    const sumY = values.reduce((sum, y) => sum + y, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (Math.abs(slope) < 0.01) return 'stable';
    if (slope > 0.1) return 'increasing-rapidly';
    if (slope > 0.01) return 'increasing';
    if (slope < -0.1) return 'decreasing-rapidly';
    if (slope < -0.01) return 'decreasing';
    return 'stable';
  }

  identifyTrendAlerts(trends) {
    const alerts = [];

    // Check blood pressure trends
    if (trends.bloodPressure?.systolic?.length > 0) {
      const lastBP = trends.bloodPressure.systolic[trends.bloodPressure.systolic.length - 1];
      if (lastBP.y > 140) {
        alerts.push({
          type: 'hypertension-trend',
          severity: lastBP.y > 160 ? 'critical' : 'warning',
          message: 'Sustained elevated blood pressure detected',
          value: lastBP.y
        });
      }
    }

    // Check heart rate variability
    if (trends.statistics?.heartRate?.variability > 0.2) {
      alerts.push({
        type: 'heart-rate-variability',
        severity: 'warning',
        message: 'High heart rate variability detected',
        value: trends.statistics.heartRate.variability
      });
    }

    // Check oxygen saturation trends
    const o2Trend = trends.statistics?.oxygenSaturation?.trend;
    if (o2Trend === 'decreasing' || o2Trend === 'decreasing-rapidly') {
      alerts.push({
        type: 'oxygen-declining',
        severity: 'warning',
        message: 'Declining oxygen saturation trend',
        trend: o2Trend
      });
    }

    // Check weight changes
    if (trends.weight?.length >= 2) {
      const firstWeight = trends.weight[0].y;
      const lastWeight = trends.weight[trends.weight.length - 1].y;
      const percentChange = ((lastWeight - firstWeight) / firstWeight) * 100;
      
      if (Math.abs(percentChange) > 5) {
        alerts.push({
          type: 'weight-change',
          severity: Math.abs(percentChange) > 10 ? 'warning' : 'info',
          message: percentChange > 0 ? 'Significant weight gain' : 'Significant weight loss',
          change: `${percentChange.toFixed(1)}%`
        });
      }
    }

    return alerts;
  }

  generateForecast(trends) {
    // Simple forecasting using linear regression
    const forecast = {};
    
    Object.keys(trends).forEach(vitalType => {
      if (Array.isArray(trends[vitalType]) && trends[vitalType].length >= 10) {
        const values = trends[vitalType].map(t => t.y);
        const trendLine = this.calculateTrendLine(values);
        
        // Project next 3 data points
        forecast[vitalType] = {
          trend: trendLine,
          nextValues: this.projectValues(values, 3),
          confidence: this.calculateConfidence(values)
        };
      }
    });

    return forecast;
  }

  projectValues(values, count) {
    // Simple linear projection
    const n = values.length;
    const lastValue = values[n - 1];
    const avgChange = (values[n - 1] - values[0]) / n;
    
    return Array.from({length: count}, (_, i) => 
      Math.round((lastValue + avgChange * (i + 1)) * 10) / 10
    );
  }

  calculateConfidence(values) {
    // Based on consistency of data
    const stdDev = this.calculateStandardDeviation(values);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const cv = stdDev / mean;
    
    if (cv < 0.1) return 'high';
    if (cv < 0.2) return 'medium';
    return 'low';
  }

  // Helper methods
  groupByInterval(records, interval) {
    const grouped = {};
    
    records.forEach(record => {
      const key = this.getIntervalKey(record.dateRecorded, interval);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(record);
    });
    
    return grouped;
  }

  getIntervalKey(date, interval) {
    const d = new Date(date);
    switch (interval) {
      case 'hourly':
        return `${d.toISOString().slice(0, 13)}:00`;
      case 'daily':
        return d.toISOString().slice(0, 10);
      case 'weekly':
        const week = Math.floor(d.getDate() / 7);
        return `${d.getFullYear()}-W${week}`;
      case 'monthly':
        return d.toISOString().slice(0, 7);
      default:
        return d.toISOString();
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  calculateMode(values) {
    const frequency = {};
    values.forEach(v => {
      frequency[v] = (frequency[v] || 0) + 1;
    });
    
    let maxFreq = 0;
    let mode = null;
    Object.entries(frequency).forEach(([value, freq]) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = parseFloat(value);
      }
    });
    
    return mode;
  }

  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(variance);
  }

  calculateDateRange(startDate, endDate, interval) {
    const end = new Date(endDate);
    let start;
    
    if (startDate) {
      start = new Date(startDate);
    } else {
      // Default ranges based on interval
      start = new Date(end);
      switch (interval) {
        case 'hourly':
          start.setHours(start.getHours() - 24);
          break;
        case 'daily':
          start.setDate(start.getDate() - 30);
          break;
        case 'weekly':
          start.setDate(start.getDate() - 90);
          break;
        case 'monthly':
          start.setFullYear(start.getFullYear() - 1);
          break;
      }
    }
    
    return { start, end };
  }

  async getBenchmarks(patientId, vitalTypes, context) {
    // Get patient demographics for appropriate benchmarks
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    
    const benchmarks = {};
    const age = this.calculateAge(patient.dateOfBirth);
    const gender = patient.gender;
    
    // Normal ranges based on age and gender
    benchmarks.bloodPressure = {
      systolic: { min: 90, max: 120, optimal: 115 },
      diastolic: { min: 60, max: 80, optimal: 75 }
    };
    
    benchmarks.heartRate = {
      min: 60,
      max: 100,
      optimal: age < 18 ? 80 : 70,
      athletic: 50
    };
    
    benchmarks.temperature = {
      min: 97.0,
      max: 99.0,
      optimal: 98.6,
      unit: 'F'
    };
    
    benchmarks.oxygenSaturation = {
      min: 95,
      max: 100,
      optimal: 98
    };
    
    benchmarks.bmi = {
      underweight: 18.5,
      normal: { min: 18.5, max: 24.9 },
      overweight: { min: 25, max: 29.9 },
      obese: 30
    };
    
    return benchmarks;
  }

  calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}

module.exports = new VitalTrendsService();
```

### 2. Create Trend Analysis API Endpoints
```javascript
// backend/routes/vitals.js (additions)

// Get vital trends
router.get('/api/vitals/patient/:patientId/trends', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const {
      startDate,
      endDate,
      vitalTypes,
      interval = 'daily',
      includeStatistics = 'true',
      includeForecasting = 'false',
      includeBenchmarks = 'false'
    } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const options = {
      startDate,
      endDate,
      vitalTypes: vitalTypes ? vitalTypes.split(',') : ['all'],
      interval,
      includeStatistics: includeStatistics === 'true',
      includeForecasting: includeForecasting === 'true',
      includeBenchmarks: includeBenchmarks === 'true'
    };

    const result = await vitalTrendsService.getVitalTrends(patientId, options, context);
    
    res.json(result);
  } catch (error) {
    console.error('Error retrieving vital trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vital trends'
    });
  }
});
```

## Required Endpoints

### GET /api/vitals/patient/:patientId/trends
**Description**: Analyze vital sign trends over time
**Access**: Providers, Nurses
**Query Parameters**:
- `startDate` (ISO date): Start date for analysis
- `endDate` (ISO date): End date for analysis
- `vitalTypes` (comma-separated): Specific vitals to analyze
- `interval` (string): Grouping interval (hourly/daily/weekly/monthly)
- `includeStatistics` (boolean): Include statistical analysis
- `includeForecasting` (boolean): Include trend forecasting
- `includeBenchmarks` (boolean): Include normal benchmarks

**Response**:
```json
{
  "success": true,
  "data": {
    "bloodPressure": {
      "systolic": [
        { "x": "2024-12-01", "y": 120, "count": 3 },
        { "x": "2024-12-02", "y": 122, "count": 2 }
      ],
      "diastolic": [...],
      "map": [...]
    },
    "heartRate": [...],
    "statistics": {
      "bloodPressure": {
        "systolic": {
          "mean": 121,
          "median": 120,
          "standardDeviation": 3.2,
          "trend": "stable",
          "percentiles": {
            "p25": 118,
            "p50": 120,
            "p75": 124,
            "p95": 130
          }
        }
      }
    },
    "alerts": [
      {
        "type": "hypertension-trend",
        "severity": "warning",
        "message": "Sustained elevated blood pressure detected"
      }
    ],
    "forecast": {
      "bloodPressure": {
        "trend": "increasing",
        "nextValues": [123, 124, 125],
        "confidence": "medium"
      }
    },
    "benchmarks": {
      "bloodPressure": {
        "systolic": { "min": 90, "max": 120, "optimal": 115 }
      }
    }
  },
  "metadata": {
    "patientId": "...",
    "dateRange": {
      "start": "2024-11-01",
      "end": "2024-12-19"
    },
    "dataPoints": 45,
    "interval": "daily"
  }
}
```

## Data Models Required

Uses existing VitalSigns collection with:
- Aggregation pipelines for grouping
- Statistical calculations
- Trend analysis algorithms

## Test Cases

### 1. Basic Trend Analysis
- Request trends for all vitals
- Verify correct grouping by interval
- Check data point aggregation

### 2. Statistical Analysis
- Verify mean, median, mode calculations
- Check standard deviation accuracy
- Test percentile calculations

### 3. Alert Generation
- Test hypertension trend detection
- Verify weight change alerts
- Check oxygen saturation warnings

### 4. Forecasting
- Request with forecasting enabled
- Verify projection calculations
- Check confidence levels

### 5. Benchmarks
- Request with benchmarks
- Verify age-appropriate ranges
- Check gender-specific values

### 6. Insufficient Data
- Request with too few data points
- Verify appropriate error message
- Check minimum threshold enforcement

### 7. Performance
- Test with large datasets (1000+ records)
- Verify response time acceptable
- Check memory usage

## Dependencies
- SecureDataAccess service for database operations
- AuditLog model for tracking
- VitalSigns collection
- Statistical calculation libraries
- Patient demographics for benchmarks

## Success Criteria
- [ ] Trends calculated accurately
- [ ] Multiple interval groupings work
- [ ] Statistical analysis correct
- [ ] Alerts identify concerning patterns
- [ ] Forecasting provides projections
- [ ] Benchmarks age/gender appropriate
- [ ] Performance acceptable for large datasets
- [ ] Visualization-ready data format
- [ ] Audit trail maintained
- [ ] Multi-tenant isolation preserved

## Notes
- Consider caching trend calculations for performance
- May need machine learning for advanced forecasting
- Future enhancement: population-based benchmarks
- Consider adding export to chart formats
- May need integration with visualization libraries