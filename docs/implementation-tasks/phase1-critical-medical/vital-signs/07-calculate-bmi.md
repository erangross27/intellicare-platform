# Calculate BMI

## Function Details
- **Name**: calculateBMI
- **Status**: Not Implemented  
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 2 hours

## Problem Description
Healthcare providers need automatic BMI (Body Mass Index) calculation from patient height and weight measurements. The system must support multiple units (metric and imperial), provide BMI categorization, track BMI trends over time, and generate appropriate health recommendations based on BMI values.

## Implementation Steps

### 1. Create BMI Calculation Service
```javascript
// backend/services/bmiCalculationService.js

const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');

class BMICalculationService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('bmi-calculation-service');
  }

  async calculateBMI(weight, height, options = {}) {
    const {
      weightUnit = 'lbs',
      heightUnit = 'inches',
      patientAge = null,
      patientGender = null,
      includePercentile = false,
      includeRecommendations = true
    } = options;

    // Validate inputs
    if (!this.validateInputs(weight, height)) {
      throw new Error('Invalid weight or height values');
    }

    // Convert to metric units
    const weightKg = this.convertToKg(weight, weightUnit);
    const heightM = this.convertToMeters(height, heightUnit);

    // Calculate BMI
    const bmi = weightKg / (heightM * heightM);
    const roundedBMI = Math.round(bmi * 10) / 10;

    // Get BMI category
    const category = this.getBMICategory(roundedBMI, patientAge);

    // Calculate ideal weight range
    const idealWeightRange = this.calculateIdealWeightRange(heightM, weightUnit);

    // Calculate weight change needed
    const weightChangeNeeded = this.calculateWeightChangeNeeded(
      weightKg, 
      heightM, 
      weightUnit
    );

    // Build result object
    const result = {
      bmi: roundedBMI,
      category: category.name,
      categoryDetails: category,
      weightKg,
      heightM,
      idealWeightRange,
      weightChangeNeeded
    };

    // Add percentile if requested (for children)
    if (includePercentile && patientAge && patientAge < 20) {
      result.percentile = await this.calculateBMIPercentile(
        roundedBMI, 
        patientAge, 
        patientGender
      );
    }

    // Add health recommendations
    if (includeRecommendations) {
      result.recommendations = this.getHealthRecommendations(category.name, roundedBMI);
    }

    // Add health risks
    result.healthRisks = this.getHealthRisks(category.name);

    return result;
  }

  async calculateAndStoreBMI(patientId, weight, height, options = {}, context) {
    // Calculate BMI
    const bmiResult = await this.calculateBMI(weight.value, height.value, {
      weightUnit: weight.unit,
      heightUnit: height.unit,
      ...options
    });

    // Store BMI record
    const bmiRecord = {
      patientId,
      practiceId: context.practiceId,
      date: new Date(),
      weight: weight,
      height: height,
      bmi: bmiResult.bmi,
      category: bmiResult.category,
      percentile: bmiResult.percentile,
      calculatedBy: context.userId
    };

    await SecureDataAccess.create('bmirecords', bmiRecord, context);

    // Check for significant changes
    await this.checkBMIChanges(patientId, bmiResult, context);

    // Create audit log
    await AuditLog.create({
      action: 'CALCULATE_BMI',
      userId: context.userId,
      patientId,
      practiceId: context.practiceId,
      details: {
        bmi: bmiResult.bmi,
        category: bmiResult.category
      },
      timestamp: new Date()
    });

    return bmiResult;
  }

  async getBMIHistory(patientId, options = {}, context) {
    const {
      startDate,
      endDate = new Date(),
      limit = 100,
      includeAnalysis = true
    } = options;

    // Build query
    const query = {
      patientId,
      practiceId: context.practiceId
    };

    if (startDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Get BMI records
    const records = await SecureDataAccess.query('bmirecords', query, {
      limit,
      sort: { date: -1 }
    }, context);

    if (records.length === 0) {
      return {
        records: [],
        analysis: null
      };
    }

    const result = {
      records,
      latest: records[0],
      earliest: records[records.length - 1]
    };

    if (includeAnalysis && records.length > 1) {
      result.analysis = this.analyzeBMITrend(records);
    }

    return result;
  }

  analyzeBMITrend(records) {
    // Sort by date
    const sorted = records.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate changes
    const firstBMI = sorted[0].bmi;
    const lastBMI = sorted[sorted.length - 1].bmi;
    const change = lastBMI - firstBMI;
    const percentChange = (change / firstBMI) * 100;

    // Calculate rate of change
    const daysDiff = (new Date(sorted[sorted.length - 1].date) - new Date(sorted[0].date)) / (1000 * 60 * 60 * 24);
    const monthlyRate = (change / daysDiff) * 30;

    // Determine trend
    let trend;
    if (Math.abs(change) < 0.5) {
      trend = 'stable';
    } else if (change > 0) {
      trend = monthlyRate > 1 ? 'increasing-rapidly' : 'increasing';
    } else {
      trend = monthlyRate < -1 ? 'decreasing-rapidly' : 'decreasing';
    }

    // Category changes
    const categoryChanges = [];
    let previousCategory = sorted[0].category;
    sorted.forEach((record, index) => {
      if (record.category !== previousCategory) {
        categoryChanges.push({
          from: previousCategory,
          to: record.category,
          date: record.date,
          bmi: record.bmi
        });
        previousCategory = record.category;
      }
    });

    // Statistics
    const bmiValues = records.map(r => r.bmi);
    const average = bmiValues.reduce((sum, val) => sum + val, 0) / bmiValues.length;
    const min = Math.min(...bmiValues);
    const max = Math.max(...bmiValues);

    return {
      trend,
      totalChange: Math.round(change * 10) / 10,
      percentChange: Math.round(percentChange * 10) / 10,
      monthlyRate: Math.round(monthlyRate * 10) / 10,
      categoryChanges,
      statistics: {
        average: Math.round(average * 10) / 10,
        min,
        max,
        range: Math.round((max - min) * 10) / 10
      },
      projection: this.projectBMI(sorted, 90) // 90-day projection
    };
  }

  projectBMI(records, days) {
    if (records.length < 3) return null;

    // Simple linear regression for projection
    const n = records.length;
    const recentRecords = records.slice(-Math.min(10, n)); // Use last 10 records
    
    // Calculate trend line
    const x = recentRecords.map((_, i) => i);
    const y = recentRecords.map(r => r.bmi);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate days between records
    const daysBetween = (new Date(recentRecords[n-1].date) - new Date(recentRecords[0].date)) / (1000 * 60 * 60 * 24) / (n - 1);
    
    // Project future BMI
    const daysAhead = days / daysBetween;
    const projectedBMI = intercept + slope * (n - 1 + daysAhead);
    
    return {
      projectedBMI: Math.round(projectedBMI * 10) / 10,
      projectedCategory: this.getBMICategory(projectedBMI).name,
      daysAhead: days,
      confidence: this.calculateProjectionConfidence(recentRecords)
    };
  }

  calculateProjectionConfidence(records) {
    // Calculate R-squared for confidence
    const bmiValues = records.map(r => r.bmi);
    const mean = bmiValues.reduce((sum, val) => sum + val, 0) / bmiValues.length;
    
    const variance = bmiValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    const stdDev = Math.sqrt(variance / bmiValues.length);
    const cv = stdDev / mean;
    
    if (cv < 0.02) return 'high';
    if (cv < 0.05) return 'medium';
    return 'low';
  }

  async checkBMIChanges(patientId, currentBMI, context) {
    // Get previous BMI
    const previousRecord = await SecureDataAccess.findOne('bmirecords', {
      patientId,
      practiceId: context.practiceId,
      date: { $lt: new Date() }
    }, { sort: { date: -1 } }, context);

    if (!previousRecord) return;

    const change = currentBMI.bmi - previousRecord.bmi;
    const daysSince = (Date.now() - previousRecord.date) / (1000 * 60 * 60 * 24);
    
    // Alert if rapid change (>1 BMI point per month)
    const monthlyChange = (change / daysSince) * 30;
    
    if (Math.abs(monthlyChange) > 1) {
      await this.createBMIChangeAlert(patientId, {
        previousBMI: previousRecord.bmi,
        currentBMI: currentBMI.bmi,
        change,
        monthlyChange,
        daysSince
      }, context);
    }

    // Alert if category changed
    if (currentBMI.category !== previousRecord.category) {
      await this.createCategoryChangeAlert(patientId, {
        previousCategory: previousRecord.category,
        currentCategory: currentBMI.category,
        currentBMI: currentBMI.bmi
      }, context);
    }
  }

  async createBMIChangeAlert(patientId, changeData, context) {
    const alert = {
      patientId,
      practiceId: context.practiceId,
      type: 'bmi-rapid-change',
      severity: Math.abs(changeData.monthlyChange) > 2 ? 'warning' : 'info',
      message: `Rapid BMI change detected: ${changeData.change > 0 ? '+' : ''}${changeData.change.toFixed(1)} in ${Math.round(changeData.daysSince)} days`,
      details: changeData,
      createdAt: new Date()
    };

    await SecureDataAccess.create('bmialerts', alert, context);
  }

  async createCategoryChangeAlert(patientId, changeData, context) {
    const alert = {
      patientId,
      practiceId: context.practiceId,
      type: 'bmi-category-change',
      severity: 'info',
      message: `BMI category changed from ${changeData.previousCategory} to ${changeData.currentCategory}`,
      details: changeData,
      createdAt: new Date()
    };

    await SecureDataAccess.create('bmialerts', alert, context);
  }

  // Utility methods
  validateInputs(weight, height) {
    if (!weight || weight <= 0 || weight > 1000) return false;
    if (!height || height <= 0 || height > 300) return false;
    return true;
  }

  convertToKg(weight, unit) {
    switch (unit.toLowerCase()) {
      case 'kg':
        return weight;
      case 'lbs':
      case 'pounds':
        return weight * 0.453592;
      case 'g':
        return weight / 1000;
      case 'oz':
        return weight * 0.0283495;
      default:
        throw new Error(`Unknown weight unit: ${unit}`);
    }
  }

  convertToMeters(height, unit) {
    switch (unit.toLowerCase()) {
      case 'm':
      case 'meters':
        return height;
      case 'cm':
        return height / 100;
      case 'inches':
      case 'in':
        return height * 0.0254;
      case 'feet':
      case 'ft':
        return height * 0.3048;
      default:
        throw new Error(`Unknown height unit: ${unit}`);
    }
  }

  getBMICategory(bmi, age = null) {
    // For children and teens (ages 2-19), use percentile-based categories
    if (age && age >= 2 && age < 20) {
      return this.getChildBMICategory(bmi, age);
    }

    // Adult categories
    if (bmi < 16) {
      return {
        name: 'severe-underweight',
        display: 'Severely Underweight',
        range: '< 16',
        color: '#d32f2f',
        severity: 'high'
      };
    } else if (bmi < 18.5) {
      return {
        name: 'underweight',
        display: 'Underweight',
        range: '16 - 18.4',
        color: '#f57c00',
        severity: 'medium'
      };
    } else if (bmi < 25) {
      return {
        name: 'normal',
        display: 'Normal Weight',
        range: '18.5 - 24.9',
        color: '#388e3c',
        severity: 'none'
      };
    } else if (bmi < 30) {
      return {
        name: 'overweight',
        display: 'Overweight',
        range: '25 - 29.9',
        color: '#fbc02d',
        severity: 'low'
      };
    } else if (bmi < 35) {
      return {
        name: 'obese-class-1',
        display: 'Obese Class I',
        range: '30 - 34.9',
        color: '#f57c00',
        severity: 'medium'
      };
    } else if (bmi < 40) {
      return {
        name: 'obese-class-2',
        display: 'Obese Class II',
        range: '35 - 39.9',
        color: '#e64a19',
        severity: 'high'
      };
    } else {
      return {
        name: 'obese-class-3',
        display: 'Obese Class III (Morbidly Obese)',
        range: '≥ 40',
        color: '#d32f2f',
        severity: 'critical'
      };
    }
  }

  getChildBMICategory(bmi, age) {
    // Simplified - would need CDC growth charts for accurate percentiles
    // This is a placeholder that should be replaced with actual percentile data
    return {
      name: 'pediatric',
      display: 'Pediatric BMI',
      note: 'Percentile calculation required for accurate categorization',
      age
    };
  }

  calculateIdealWeightRange(heightM, unit) {
    // Using BMI range 18.5-24.9 for ideal weight
    const minWeightKg = 18.5 * heightM * heightM;
    const maxWeightKg = 24.9 * heightM * heightM;

    if (unit === 'kg') {
      return {
        min: Math.round(minWeightKg * 10) / 10,
        max: Math.round(maxWeightKg * 10) / 10,
        unit
      };
    } else if (unit === 'lbs' || unit === 'pounds') {
      return {
        min: Math.round(minWeightKg * 2.20462 * 10) / 10,
        max: Math.round(maxWeightKg * 2.20462 * 10) / 10,
        unit: 'lbs'
      };
    }
  }

  calculateWeightChangeNeeded(currentWeightKg, heightM, unit) {
    // Calculate weight needed to reach BMI 24.9 (upper normal) or 18.5 (lower normal)
    const currentBMI = currentWeightKg / (heightM * heightM);
    let targetWeightKg;
    let change;

    if (currentBMI < 18.5) {
      // Underweight - target lower normal
      targetWeightKg = 18.5 * heightM * heightM;
      change = targetWeightKg - currentWeightKg;
    } else if (currentBMI > 24.9) {
      // Overweight/obese - target upper normal
      targetWeightKg = 24.9 * heightM * heightM;
      change = currentWeightKg - targetWeightKg;
    } else {
      // Normal weight
      return {
        needed: false,
        message: 'Weight is within normal range'
      };
    }

    const changeInUnit = unit === 'kg' ? change : change * 2.20462;

    return {
      needed: true,
      amount: Math.round(Math.abs(changeInUnit) * 10) / 10,
      direction: currentBMI < 18.5 ? 'gain' : 'lose',
      unit: unit === 'kg' ? 'kg' : 'lbs',
      targetBMI: currentBMI < 18.5 ? 18.5 : 24.9
    };
  }

  getHealthRecommendations(category, bmi) {
    const recommendations = {
      'severe-underweight': [
        'Urgent medical evaluation recommended',
        'Consult with nutritionist for meal planning',
        'Consider underlying medical conditions',
        'Gradual, monitored weight gain program'
      ],
      'underweight': [
        'Increase caloric intake with nutrient-dense foods',
        'Add healthy fats and proteins to diet',
        'Strength training to build muscle mass',
        'Regular monitoring of weight gain progress'
      ],
      'normal': [
        'Maintain current healthy weight',
        'Continue balanced diet and regular exercise',
        'Annual health screenings recommended',
        'Focus on overall wellness and fitness'
      ],
      'overweight': [
        'Aim for gradual weight loss (1-2 lbs per week)',
        'Reduce caloric intake by 500-750 calories/day',
        'Increase physical activity to 150 min/week',
        'Consider consultation with nutritionist'
      ],
      'obese-class-1': [
        'Medical evaluation for weight management program',
        'Structured diet and exercise plan required',
        'Screen for obesity-related conditions',
        'Consider behavioral counseling'
      ],
      'obese-class-2': [
        'Comprehensive medical weight loss program',
        'Evaluate for bariatric surgery eligibility',
        'Intensive lifestyle modification',
        'Regular monitoring for complications'
      ],
      'obese-class-3': [
        'Urgent medical intervention required',
        'Strong consideration for bariatric surgery',
        'Multidisciplinary team approach',
        'Aggressive management of comorbidities'
      ]
    };

    return recommendations[category] || [];
  }

  getHealthRisks(category) {
    const risks = {
      'severe-underweight': [
        'Malnutrition',
        'Weakened immune system',
        'Osteoporosis',
        'Fertility issues',
        'Anemia'
      ],
      'underweight': [
        'Nutritional deficiencies',
        'Decreased immune function',
        'Bone density loss',
        'Irregular menstruation'
      ],
      'normal': [
        'Low health risks related to weight'
      ],
      'overweight': [
        'Type 2 diabetes',
        'Hypertension',
        'Sleep apnea',
        'Elevated cholesterol'
      ],
      'obese-class-1': [
        'Cardiovascular disease',
        'Type 2 diabetes',
        'Sleep apnea',
        'Osteoarthritis',
        'Metabolic syndrome'
      ],
      'obese-class-2': [
        'High risk of heart disease',
        'Stroke',
        'Severe sleep apnea',
        'Non-alcoholic fatty liver disease',
        'Multiple joint problems'
      ],
      'obese-class-3': [
        'Life-threatening cardiovascular events',
        'Severe diabetes complications',
        'Respiratory failure',
        'Multiple organ dysfunction',
        'Significantly reduced life expectancy'
      ]
    };

    return risks[category] || [];
  }

  async calculateBMIPercentile(bmi, age, gender) {
    // This would need integration with CDC growth charts
    // Placeholder implementation
    return {
      percentile: null,
      message: 'CDC growth chart integration required for percentile calculation'
    };
  }
}

module.exports = new BMICalculationService();
```

### 2. Create BMI API Endpoints
```javascript
// backend/routes/vitals.js (additions)

// Calculate BMI
router.post('/api/vitals/calculate-bmi', authenticate, async (req, res) => {
  try {
    const { weight, height, weightUnit, heightUnit, patientAge, patientGender } = req.body;

    const result = await bmiCalculationService.calculateBMI(weight, height, {
      weightUnit,
      heightUnit,
      patientAge,
      patientGender,
      includeRecommendations: true
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error calculating BMI:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Calculate and store BMI for patient
router.post('/api/vitals/patient/:patientId/calculate-bmi', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { weight, height } = req.body;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    // Get patient info for age and gender
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    
    const result = await bmiCalculationService.calculateAndStoreBMI(
      patientId,
      weight,
      height,
      {
        patientAge: calculateAge(patient.dateOfBirth),
        patientGender: patient.gender
      },
      context
    );
    
    res.json({
      success: true,
      data: result,
      message: 'BMI calculated and stored successfully'
    });
  } catch (error) {
    console.error('Error calculating patient BMI:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get BMI history
router.get('/api/vitals/patient/:patientId/bmi-history', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await bmiCalculationService.getBMIHistory(patientId, {
      startDate,
      endDate,
      limit: parseInt(limit),
      includeAnalysis: true
    }, context);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error retrieving BMI history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve BMI history'
    });
  }
});

// Helper function
function calculateAge(dateOfBirth) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}
```

## Required Endpoints

### POST /api/vitals/calculate-bmi
**Description**: Calculate BMI from weight and height
**Access**: All authenticated users
**Request Body**:
```json
{
  "weight": 170,
  "height": 70,
  "weightUnit": "lbs",
  "heightUnit": "inches",
  "patientAge": 35,
  "patientGender": "male"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "bmi": 24.4,
    "category": "normal",
    "categoryDetails": {
      "name": "normal",
      "display": "Normal Weight",
      "range": "18.5 - 24.9",
      "color": "#388e3c"
    },
    "idealWeightRange": {
      "min": 128.9,
      "max": 173.4,
      "unit": "lbs"
    },
    "weightChangeNeeded": {
      "needed": false,
      "message": "Weight is within normal range"
    },
    "recommendations": [
      "Maintain current healthy weight",
      "Continue balanced diet and regular exercise"
    ],
    "healthRisks": [
      "Low health risks related to weight"
    ]
  }
}
```

### POST /api/vitals/patient/:patientId/calculate-bmi
**Description**: Calculate and store BMI for a patient
**Access**: Providers, Nurses

### GET /api/vitals/patient/:patientId/bmi-history
**Description**: Get BMI history and trend analysis
**Access**: Providers, Nurses

## Data Models Required

### BMIRecords Collection
```javascript
{
  patientId: ObjectId,
  practiceId: String,
  date: Date,
  weight: { value: Number, unit: String },
  height: { value: Number, unit: String },
  bmi: Number,
  category: String,
  percentile: Object, // For pediatric
  calculatedBy: ObjectId
}
```

### BMIAlerts Collection
```javascript
{
  patientId: ObjectId,
  practiceId: String,
  type: String,
  severity: String,
  message: String,
  details: Object,
  createdAt: Date
}
```

## Test Cases

### 1. Basic BMI Calculation
- Test with imperial units (lbs/inches)
- Test with metric units (kg/cm)
- Verify correct BMI value
- Check category assignment

### 2. Edge Cases
- Test extreme values
- Test unit conversions
- Test invalid inputs
- Verify error handling

### 3. Category Boundaries
- Test values at category boundaries
- Verify correct categorization
- Check color coding

### 4. BMI History
- Store multiple BMI records
- Retrieve history with analysis
- Verify trend calculation

### 5. Weight Change Recommendations
- Test underweight recommendations
- Test overweight recommendations
- Verify ideal weight range

### 6. Pediatric BMI
- Test with child age
- Verify percentile request
- Check age-appropriate categories

### 7. Rapid Change Detection
- Create rapid BMI change
- Verify alert generation
- Check monthly rate calculation

## Dependencies
- SecureDataAccess service
- AuditLog for tracking
- Patient demographic data
- CDC growth charts (future)

## Success Criteria
- [ ] Accurate BMI calculations
- [ ] Multiple unit support
- [ ] Correct categorization
- [ ] Ideal weight range calculated
- [ ] Health recommendations provided
- [ ] BMI history tracked
- [ ] Trend analysis functional
- [ ] Rapid change alerts work
- [ ] Category change detection
- [ ] Audit trail maintained

## Notes
- Future enhancement: integrate CDC growth charts for pediatric percentiles
- Consider adding waist-to-hip ratio calculation
- May need body composition analysis integration
- Consider adding ethnic-specific BMI ranges
- Future: integrate with nutrition planning system