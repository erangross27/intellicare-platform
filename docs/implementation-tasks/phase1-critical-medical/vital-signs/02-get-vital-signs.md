# Get Vital Signs

## Function Details
- **Name**: getVitalSigns
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 3 hours

## Problem Description
Healthcare providers need to retrieve and view patient vital signs history. The system must provide access to current and historical vital signs data with filtering, sorting, and trend analysis capabilities. This is essential for monitoring patient health status over time and making informed clinical decisions.

## Implementation Steps

### 1. Extend Vital Signs Service
```javascript
// backend/services/vitalSignsService.js (addition to existing service)

class VitalSignsService {
  // ... existing code ...

  async getVitalSigns(patientId, options = {}, context) {
    const {
      limit = 50,
      offset = 0,
      startDate,
      endDate,
      encounterType,
      sortBy = 'dateRecorded',
      sortOrder = 'desc',
      includeDeleted = false,
      includeTrends = false,
      groupByDay = false
    } = options;

    // Build query
    const query = {
      patientId,
      practiceId: context.practiceId,
      isDeleted: includeDeleted ? { $in: [true, false] } : false
    };

    // Add date range filter
    if (startDate || endDate) {
      query.dateRecorded = {};
      if (startDate) query.dateRecorded.$gte = new Date(startDate);
      if (endDate) query.dateRecorded.$lte = new Date(endDate);
    }

    // Add encounter type filter
    if (encounterType) {
      query.encounterType = encounterType;
    }

    // Get vital signs using SecureDataAccess
    const vitals = await SecureDataAccess.query('vitalsigns', query, {
      limit,
      offset,
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: ['recordedBy', 'patientId']
    }, context);

    // Create audit log
    await AuditLog.create({
      action: 'VIEW_VITAL_SIGNS',
      userId: context.userId,
      patientId,
      practiceId: context.practiceId,
      details: { recordsRetrieved: vitals.length },
      timestamp: new Date()
    });

    // Add trend analysis if requested
    let trends = null;
    if (includeTrends && vitals.length > 1) {
      trends = this.calculateVitalTrends(vitals);
    }

    // Group by day if requested
    let groupedData = null;
    if (groupByDay) {
      groupedData = this.groupVitalsByDay(vitals);
    }

    return {
      vitals: groupByDay ? groupedData : vitals,
      trends,
      totalCount: await this.getVitalSignsCount(query, context),
      hasMore: vitals.length === limit,
      latestVitals: vitals[0] || null
    };
  }

  async getLatestVitalSigns(patientId, context) {
    const query = {
      patientId,
      practiceId: context.practiceId,
      isDeleted: false
    };

    const latest = await SecureDataAccess.findOne('vitalsigns', query, {
      sort: { dateRecorded: -1 }
    }, context);

    // Calculate time since last vitals
    if (latest) {
      const hoursSinceLast = (Date.now() - latest.dateRecorded) / (1000 * 60 * 60);
      latest.timeSinceRecorded = {
        hours: Math.floor(hoursSinceLast),
        days: Math.floor(hoursSinceLast / 24),
        isStale: hoursSinceLast > 24
      };
    }

    return latest;
  }

  async getVitalSignsCount(query, context) {
    return await SecureDataAccess.count('vitalsigns', query, context);
  }

  calculateVitalTrends(vitals) {
    if (vitals.length < 2) return null;

    const trends = {
      bloodPressure: { systolic: [], diastolic: [] },
      heartRate: [],
      temperature: [],
      oxygenSaturation: [],
      weight: [],
      bmi: []
    };

    // Extract values for trend calculation
    vitals.forEach(v => {
      if (v.vitals.bloodPressure) {
        trends.bloodPressure.systolic.push({
          value: v.vitals.bloodPressure.systolic,
          date: v.dateRecorded
        });
        trends.bloodPressure.diastolic.push({
          value: v.vitals.bloodPressure.diastolic,
          date: v.dateRecorded
        });
      }
      if (v.vitals.heartRate) {
        trends.heartRate.push({
          value: v.vitals.heartRate.value,
          date: v.dateRecorded
        });
      }
      if (v.vitals.temperature) {
        trends.temperature.push({
          value: v.vitals.temperature.value,
          date: v.dateRecorded,
          unit: v.vitals.temperature.unit
        });
      }
      if (v.vitals.oxygenSaturation) {
        trends.oxygenSaturation.push({
          value: v.vitals.oxygenSaturation.value,
          date: v.dateRecorded
        });
      }
      if (v.vitals.weight) {
        trends.weight.push({
          value: v.vitals.weight.value,
          date: v.dateRecorded,
          unit: v.vitals.weight.unit
        });
      }
      if (v.vitals.bmi) {
        trends.bmi.push({
          value: v.vitals.bmi.value,
          date: v.dateRecorded,
          category: v.vitals.bmi.category
        });
      }
    });

    // Calculate trend direction and statistics
    Object.keys(trends).forEach(key => {
      if (key === 'bloodPressure') {
        ['systolic', 'diastolic'].forEach(type => {
          if (trends.bloodPressure[type].length >= 2) {
            const values = trends.bloodPressure[type].map(t => t.value);
            trends.bloodPressure[type] = {
              data: trends.bloodPressure[type],
              direction: this.getTrendDirection(values),
              average: this.calculateAverage(values),
              min: Math.min(...values),
              max: Math.max(...values),
              lastChange: values[0] - values[1]
            };
          }
        });
      } else if (trends[key].length >= 2) {
        const values = trends[key].map(t => t.value);
        trends[key] = {
          data: trends[key],
          direction: this.getTrendDirection(values),
          average: this.calculateAverage(values),
          min: Math.min(...values),
          max: Math.max(...values),
          lastChange: values[0] - values[1]
        };
      }
    });

    return trends;
  }

  getTrendDirection(values) {
    if (values.length < 2) return 'insufficient-data';
    
    const recent = values.slice(0, Math.min(3, values.length));
    const older = values.slice(-Math.min(3, values.length));
    
    const recentAvg = this.calculateAverage(recent);
    const olderAvg = this.calculateAverage(older);
    
    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (Math.abs(percentChange) < 5) return 'stable';
    if (percentChange > 10) return 'increasing-rapidly';
    if (percentChange > 5) return 'increasing';
    if (percentChange < -10) return 'decreasing-rapidly';
    if (percentChange < -5) return 'decreasing';
    return 'stable';
  }

  calculateAverage(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  groupVitalsByDay(vitals) {
    const grouped = {};
    
    vitals.forEach(v => {
      const dateKey = new Date(v.dateRecorded).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          readings: [],
          dailyAverages: {}
        };
      }
      grouped[dateKey].readings.push(v);
    });

    // Calculate daily averages
    Object.keys(grouped).forEach(dateKey => {
      const dayVitals = grouped[dateKey].readings;
      const avgVitals = {
        bloodPressure: { systolic: [], diastolic: [] },
        heartRate: [],
        temperature: [],
        oxygenSaturation: []
      };

      dayVitals.forEach(v => {
        if (v.vitals.bloodPressure) {
          avgVitals.bloodPressure.systolic.push(v.vitals.bloodPressure.systolic);
          avgVitals.bloodPressure.diastolic.push(v.vitals.bloodPressure.diastolic);
        }
        if (v.vitals.heartRate) avgVitals.heartRate.push(v.vitals.heartRate.value);
        if (v.vitals.temperature) avgVitals.temperature.push(v.vitals.temperature.value);
        if (v.vitals.oxygenSaturation) avgVitals.oxygenSaturation.push(v.vitals.oxygenSaturation.value);
      });

      grouped[dateKey].dailyAverages = {
        bloodPressure: {
          systolic: avgVitals.bloodPressure.systolic.length > 0 ? 
            this.calculateAverage(avgVitals.bloodPressure.systolic) : null,
          diastolic: avgVitals.bloodPressure.diastolic.length > 0 ?
            this.calculateAverage(avgVitals.bloodPressure.diastolic) : null
        },
        heartRate: avgVitals.heartRate.length > 0 ?
          this.calculateAverage(avgVitals.heartRate) : null,
        temperature: avgVitals.temperature.length > 0 ?
          this.calculateAverage(avgVitals.temperature) : null,
        oxygenSaturation: avgVitals.oxygenSaturation.length > 0 ?
          this.calculateAverage(avgVitals.oxygenSaturation) : null
      };
    });

    return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}
```

### 2. Create API Endpoints
```javascript
// backend/routes/vitals.js (additions)

// Get vital signs history
router.get('/api/vitals/patient/:patientId', authenticate, authorize(['provider', 'nurse', 'medical-assistant']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const {
      limit = 50,
      offset = 0,
      startDate,
      endDate,
      encounterType,
      sortBy = 'dateRecorded',
      sortOrder = 'desc',
      includeTrends = false,
      groupByDay = false
    } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate,
      endDate,
      encounterType,
      sortBy,
      sortOrder,
      includeTrends: includeTrends === 'true',
      groupByDay: groupByDay === 'true'
    };

    const result = await vitalSignsService.getVitalSigns(patientId, options, context);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error retrieving vital signs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vital signs'
    });
  }
});

// Get latest vital signs
router.get('/api/vitals/patient/:patientId/latest', authenticate, authorize(['provider', 'nurse', 'medical-assistant']), async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalSignsService.getLatestVitalSigns(patientId, context);
    
    res.json({
      success: true,
      data: result,
      message: result ? 'Latest vital signs retrieved' : 'No vital signs found'
    });
  } catch (error) {
    console.error('Error retrieving latest vital signs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve latest vital signs'
    });
  }
});

// Get vital signs summary
router.get('/api/vitals/patient/:patientId/summary', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { days = 7 } = req.query;
    
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const result = await vitalSignsService.getVitalSigns(patientId, {
      startDate: startDate.toISOString(),
      includeTrends: true,
      groupByDay: true
    }, context);
    
    res.json({
      success: true,
      data: {
        summary: {
          totalReadings: result.totalCount,
          daysWithData: result.vitals?.length || 0,
          latestReading: result.latestVitals,
          trends: result.trends
        }
      }
    });
  } catch (error) {
    console.error('Error retrieving vital signs summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vital signs summary'
    });
  }
});
```

## Required Endpoints

### GET /api/vitals/patient/:patientId
**Description**: Retrieve vital signs history for a patient
**Access**: Providers, Nurses, Medical Assistants
**Query Parameters**:
- `limit` (number): Number of records to return (default: 50)
- `offset` (number): Number of records to skip (default: 0)
- `startDate` (ISO date): Start date for filtering
- `endDate` (ISO date): End date for filtering
- `encounterType` (string): Filter by encounter type
- `sortBy` (string): Field to sort by (default: dateRecorded)
- `sortOrder` (string): Sort order (asc/desc, default: desc)
- `includeTrends` (boolean): Include trend analysis
- `groupByDay` (boolean): Group results by day

**Response**:
```json
{
  "success": true,
  "data": {
    "vitals": [...],
    "trends": {
      "bloodPressure": {
        "systolic": {
          "direction": "stable",
          "average": 122,
          "min": 118,
          "max": 126,
          "lastChange": 2
        }
      },
      "heartRate": {
        "direction": "decreasing",
        "average": 72,
        "min": 68,
        "max": 78,
        "lastChange": -3
      }
    },
    "totalCount": 150,
    "hasMore": true,
    "latestVitals": {...}
  }
}
```

### GET /api/vitals/patient/:patientId/latest
**Description**: Get most recent vital signs for a patient
**Access**: Providers, Nurses, Medical Assistants

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "60d5eca7f1b2c8b1d8e4f89b",
    "patientId": "60d5eca7f1b2c8b1d8e4f89a",
    "vitals": {...},
    "dateRecorded": "2024-12-19T10:30:00Z",
    "timeSinceRecorded": {
      "hours": 2,
      "days": 0,
      "isStale": false
    }
  }
}
```

### GET /api/vitals/patient/:patientId/summary
**Description**: Get vital signs summary with trends
**Access**: Providers, Nurses
**Query Parameters**:
- `days` (number): Number of days to include (default: 7)

## Data Models Required

Uses existing VitalSigns collection with additional aggregation pipelines for:
- Trend analysis
- Daily grouping
- Statistical calculations

## Test Cases

### 1. Basic Retrieval
- Retrieve vital signs for valid patient
- Verify sorting and pagination
- Check practice isolation

### 2. Date Range Filtering
- Filter by date range
- Verify results within specified dates
- Test edge cases (single day, year range)

### 3. Trend Analysis
- Request with includeTrends=true
- Verify trend calculations
- Check direction determination logic

### 4. Daily Grouping
- Request with groupByDay=true
- Verify daily averages calculated correctly
- Check proper date grouping

### 5. Latest Vitals
- Get latest vital signs
- Verify time since recorded calculation
- Check stale data flag

### 6. Empty Results
- Request for patient with no vitals
- Verify appropriate response
- Check null handling

### 7. Permission Testing
- Verify different role access levels
- Test audit trail creation
- Confirm data isolation

## Dependencies
- SecureDataAccess service for database operations
- AuditLog model for tracking
- Authentication/Authorization middleware
- Existing VitalSigns model

## Success Criteria
- [ ] All endpoints return correct data
- [ ] Pagination works correctly
- [ ] Date filtering functions properly
- [ ] Trend analysis provides accurate calculations
- [ ] Daily grouping aggregates correctly
- [ ] Latest vitals includes time calculations
- [ ] Audit trails created for all queries
- [ ] Performance acceptable for large datasets
- [ ] Multi-tenant isolation maintained
- [ ] Error handling comprehensive

## Notes
- Consider caching frequently accessed vital signs
- May need to optimize queries for large datasets
- Future enhancement: export to PDF/CSV functionality
- Consider adding graphing endpoints for visualization
- May need websocket support for real-time vital monitoring