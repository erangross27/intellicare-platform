// Lab Result Interpreter Service
// Interprets lab results using Gemini Medical AI

const serviceAccountManager = require('./serviceAccountManager');
const SecureDataAccess = require('./secureDataAccess');

class LabResultInterpreter {
  constructor() {
    this.initialized = false;
    this.normalRanges = {
      // Blood Chemistry
      glucose: { min: 70, max: 100, unit: 'mg/dL', name: 'Glucose (fasting)' },
      glucose_random: { min: 70, max: 140, unit: 'mg/dL', name: 'Glucose (random)' },
      hba1c: { min: 4, max: 5.6, unit: '%', name: 'HbA1c' },
      
      // Lipid Panel
      cholesterol_total: { min: 0, max: 200, unit: 'mg/dL', name: 'Total Cholesterol' },
      ldl: { min: 0, max: 100, unit: 'mg/dL', name: 'LDL Cholesterol' },
      hdl: { min: 40, max: 999, unit: 'mg/dL', name: 'HDL Cholesterol' },
      triglycerides: { min: 0, max: 150, unit: 'mg/dL', name: 'Triglycerides' },
      
      // Kidney Function
      creatinine: { min: 0.6, max: 1.2, unit: 'mg/dL', name: 'Creatinine' },
      bun: { min: 7, max: 20, unit: 'mg/dL', name: 'BUN' },
      egfr: { min: 90, max: 999, unit: 'mL/min/1.73m²', name: 'eGFR' },
      
      // Liver Function
      alt: { min: 7, max: 56, unit: 'U/L', name: 'ALT' },
      ast: { min: 10, max: 40, unit: 'U/L', name: 'AST' },
      alp: { min: 44, max: 147, unit: 'U/L', name: 'ALP' },
      bilirubin_total: { min: 0.3, max: 1.2, unit: 'mg/dL', name: 'Total Bilirubin' },
      
      // Complete Blood Count
      hemoglobin_male: { min: 13.5, max: 17.5, unit: 'g/dL', name: 'Hemoglobin (Male)' },
      hemoglobin_female: { min: 12.0, max: 15.5, unit: 'g/dL', name: 'Hemoglobin (Female)' },
      wbc: { min: 4.5, max: 11.0, unit: 'K/μL', name: 'White Blood Cells' },
      platelets: { min: 150, max: 450, unit: 'K/μL', name: 'Platelets' },
      
      // Thyroid
      tsh: { min: 0.4, max: 4.0, unit: 'mIU/L', name: 'TSH' },
      t4_free: { min: 0.8, max: 1.8, unit: 'ng/dL', name: 'Free T4' },
      t3_free: { min: 2.3, max: 4.2, unit: 'pg/mL', name: 'Free T3' },
      
      // Electrolytes
      sodium: { min: 136, max: 145, unit: 'mEq/L', name: 'Sodium' },
      potassium: { min: 3.5, max: 5.1, unit: 'mEq/L', name: 'Potassium' },
      chloride: { min: 98, max: 107, unit: 'mEq/L', name: 'Chloride' },
      calcium: { min: 8.5, max: 10.5, unit: 'mg/dL', name: 'Calcium' }
    };
  }
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('lab-result-interpreter');
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: 'lab-result-interpreter',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global',
        isSystemService: true,
        queryType: 'INTERNAL_SERVICE'
      };
      
      try {
        await SecureDataAccess.insert('audit_logs', {
          action: 'SERVICE_INITIALIZED',
          service: 'lab-result-interpreter',
          timestamp: new Date(),
          performedBy: context.serviceId
        }, context);
      } catch (auditError) {
        console.warn('Failed to log service initialization:', auditError.message);
      }
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize LabResultInterpreter: ${error.message}`);
    }
  }


  /**
   * Interpret lab results - Quick version without AI for speed
   */
  async interpret(labResults, patientContext = {}, previousResults = [], language = 'en') {
    try {
      // Quick analysis of abnormal values
      const abnormalValues = this.identifyAbnormalValues(labResults, patientContext);
      
      // Return quick interpretation without AI call (to avoid timeout)
      return {
        success: true,
        interpretation: {
          summary: this.generateSummary(abnormalValues, language),
          abnormalValues: abnormalValues,
          clinicalSignificance: this.assessClinicalSignificance(abnormalValues, language),
          recommendations: this.generateRecommendations(abnormalValues, language),
          trends: this.analyzeTrends(labResults, previousResults),
          urgency: this.assessUrgency(abnormalValues),
          followUp: this.suggestFollowUp(abnormalValues, language),
          detailedAnalysis: this.generateDetailedAnalysis(labResults, abnormalValues, language)
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error interpreting lab results:', error);
      throw error;
    }
  }

  /**
   * Identify abnormal values based on reference ranges
   */
  identifyAbnormalValues(labResults, patientContext = {}) {
    const abnormal = [];
    const gender = patientContext.gender || 'unknown';
    
    for (const [test, value] of Object.entries(labResults)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) continue;
      
      // Check gender-specific ranges
      let range = this.normalRanges[test.toLowerCase()];
      if (!range && test.toLowerCase().includes('hemoglobin')) {
        range = gender === 'female' ? this.normalRanges.hemoglobin_female : this.normalRanges.hemoglobin_male;
      }
      
      if (range) {
        if (numValue < range.min || numValue > range.max) {
          abnormal.push({
            test: range.name || test,
            value: numValue,
            unit: range.unit,
            reference: `${range.min}-${range.max}`,
            status: numValue < range.min ? 'LOW' : 'HIGH',
            severity: this.assessSeverity(test, numValue, range)
          });
        }
      }
    }
    
    return abnormal;
  }

  /**
   * Assess severity of abnormal value
   */
  assessSeverity(test, value, range) {
    const percentDeviation = Math.abs((value - (value < range.min ? range.min : range.max)) / (value < range.min ? range.min : range.max)) * 100;
    
    if (percentDeviation > 50) return 'HIGH';
    if (percentDeviation > 25) return 'MODERATE';
    return 'MILD';
  }

  /**
   * Generate summary of findings
   */
  generateSummary(abnormalValues, language = 'en') {
    if (abnormalValues.length === 0) {
      return language === 'he' 
        ? 'כל תוצאות המעבדה בטווח הנורמלי'
        : 'All lab results are within normal range';
    }
    
    const high = abnormalValues.filter(v => v.severity === 'HIGH').length;
    const moderate = abnormalValues.filter(v => v.severity === 'MODERATE').length;
    
    if (language === 'he') {
      if (high > 0) {
        return `נמצאו ${abnormalValues.length} ערכים חריגים, ${high} מהם דורשים התייחסות`;
      }
      return `נמצאו ${abnormalValues.length} ערכים חריגים`;
    } else {
      if (high > 0) {
        return `Found ${abnormalValues.length} abnormal values, ${high} requiring attention`;
      }
      return `Found ${abnormalValues.length} abnormal values`;
    }
  }

  /**
   * Assess clinical significance
   */
  assessClinicalSignificance(abnormalValues, language = 'en') {
    const significance = [];
    
    for (const abnormal of abnormalValues) {
      let message = '';
      const testName = abnormal.test.toLowerCase();
      
      // Add specific clinical significance based on test
      if (testName.includes('glucose')) {
        if (abnormal.status === 'HIGH') {
          message = language === 'he' 
            ? `${abnormal.test}: רמת סוכר גבוהה (${abnormal.value} ${abnormal.unit}) - יתכן סוכרת או טרום סוכרת`
            : `${abnormal.test}: Elevated glucose (${abnormal.value} ${abnormal.unit}) - possible diabetes or prediabetes`;
        } else if (abnormal.status === 'LOW') {
          message = language === 'he'
            ? `${abnormal.test}: רמת סוכר נמוכה (${abnormal.value} ${abnormal.unit}) - היפוגליקמיה`
            : `${abnormal.test}: Low glucose (${abnormal.value} ${abnormal.unit}) - hypoglycemia`;
        }
      } else if (testName.includes('hemoglobin')) {
        if (abnormal.status === 'LOW') {
          message = language === 'he'
            ? `${abnormal.test}: המוגלובין נמוך (${abnormal.value} ${abnormal.unit}) - יתכן אנמיה`
            : `${abnormal.test}: Low hemoglobin (${abnormal.value} ${abnormal.unit}) - possible anemia`;
        }
      } else if (testName.includes('creatinine')) {
        if (abnormal.status === 'HIGH') {
          message = language === 'he'
            ? `${abnormal.test}: קריאטינין גבוה (${abnormal.value} ${abnormal.unit}) - יתכן פגיעה בתפקוד הכליות`
            : `${abnormal.test}: Elevated creatinine (${abnormal.value} ${abnormal.unit}) - possible kidney dysfunction`;
        }
      } else if (testName.includes('alt') || testName.includes('ast')) {
        if (abnormal.status === 'HIGH') {
          message = language === 'he'
            ? `${abnormal.test}: אנזימי כבד גבוהים (${abnormal.value} ${abnormal.unit}) - יתכן פגיעה בכבד`
            : `${abnormal.test}: Elevated liver enzymes (${abnormal.value} ${abnormal.unit}) - possible liver damage`;
        }
      }
      
      if (message) {
        significance.push(message);
      }
    }
    
    return significance;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(abnormalValues, language = 'en') {
    const recommendations = [];
    const tests = abnormalValues.map(v => v.test.toLowerCase());
    
    // Check for specific conditions
    const hasGlucoseIssue = tests.some(t => t.includes('glucose'));
    const hasAnemiaIssue = tests.some(t => t.includes('hemoglobin')) && abnormalValues.some(v => v.status === 'LOW');
    const hasKidneyIssue = tests.some(t => t.includes('creatinine') || t.includes('bun') || t.includes('egfr'));
    const hasLiverIssue = tests.some(t => t.includes('alt') || t.includes('ast') || t.includes('bilirubin'));
    
    if (hasGlucoseIssue) {
      recommendations.push(language === 'he'
        ? 'מומלץ לחזור על בדיקת סוכר בצום ו-HbA1c'
        : 'Recommend repeat fasting glucose and HbA1c');
    }
    
    if (hasAnemiaIssue) {
      recommendations.push(language === 'he'
        ? 'מומלץ לבצע ספירת דם מלאה עם בדיקות ברזל'
        : 'Recommend complete blood count with iron studies');
    }
    
    if (hasKidneyIssue) {
      recommendations.push(language === 'he'
        ? 'מומלץ מעקב נפרולוגי ובדיקת שתן'
        : 'Recommend nephrology follow-up and urinalysis');
    }
    
    if (hasLiverIssue) {
      recommendations.push(language === 'he'
        ? 'מומלץ אולטרסאונד כבד ומעקב גסטרואנטרולוגי'
        : 'Recommend liver ultrasound and gastroenterology follow-up');
    }
    
    // Add general recommendation if high severity
    if (abnormalValues.some(v => v.severity === 'HIGH')) {
      recommendations.unshift(language === 'he'
        ? 'יש לפנות לרופא להערכה נוספת'
        : 'Consult physician for further evaluation');
    }
    
    return recommendations;
  }

  /**
   * Analyze trends if previous results available
   */
  analyzeTrends(currentResults, previousResults) {
    if (!previousResults || previousResults.length === 0) {
      return null;
    }
    
    const trends = {};
    const latest = previousResults[previousResults.length - 1];
    
    for (const [test, currentValue] of Object.entries(currentResults)) {
      if (latest[test]) {
        const current = parseFloat(currentValue);
        const previous = parseFloat(latest[test]);
        
        if (!isNaN(current) && !isNaN(previous)) {
          const change = ((current - previous) / previous) * 100;
          
          if (Math.abs(change) > 10) {
            trends[test] = {
              direction: change > 0 ? 'increasing' : 'decreasing',
              changePercent: Math.abs(change).toFixed(1),
              previousValue: previous,
              currentValue: current
            };
          }
        }
      }
    }
    
    return Object.keys(trends).length > 0 ? trends : null;
  }

  /**
   * Assess urgency level
   */
  assessUrgency(abnormalValues) {
    const highSeverity = abnormalValues.filter(v => v.severity === 'HIGH').length;
    
    if (highSeverity >= 3) return 'URGENT';
    if (highSeverity >= 1) return 'MODERATE';
    if (abnormalValues.length > 0) return 'ROUTINE';
    return 'NON-URGENT';
  }

  /**
   * Suggest follow-up timing
   */
  suggestFollowUp(abnormalValues, language = 'en') {
    const urgency = this.assessUrgency(abnormalValues);
    
    switch (urgency) {
      case 'URGENT':
        return language === 'he'
          ? 'מומלץ לקבוע תור לרופא תוך 1-3 ימים'
          : 'Schedule appointment within 1-3 days';
      
      case 'MODERATE':
        return language === 'he'
          ? 'מומלץ מעקב תוך 1-2 שבועות'
          : 'Follow-up in 1-2 weeks';
      
      case 'ROUTINE':
        return language === 'he'
          ? 'מעקב שגרתי תוך חודש'
          : 'Routine follow-up within a month';
      
      default:
        return language === 'he'
          ? 'אין צורך במעקב מיידי'
          : 'No immediate follow-up needed';
    }
  }

  /**
   * Generate detailed analysis
   */
  generateDetailedAnalysis(labResults, abnormalValues, language = 'en') {
    const analysis = {};
    
    // Group by category
    const categories = {
      'Metabolic': ['glucose', 'hba1c'],
      'Lipids': ['cholesterol', 'ldl', 'hdl', 'triglycerides'],
      'Kidney': ['creatinine', 'bun', 'egfr'],
      'Liver': ['alt', 'ast', 'alp', 'bilirubin'],
      'Blood': ['hemoglobin', 'wbc', 'platelets'],
      'Thyroid': ['tsh', 't4', 't3'],
      'Electrolytes': ['sodium', 'potassium', 'chloride', 'calcium']
    };
    
    for (const [category, tests] of Object.entries(categories)) {
      const categoryResults = {};
      let hasAbnormal = false;
      
      for (const test of tests) {
        const result = Object.entries(labResults).find(([k, v]) => k.toLowerCase().includes(test));
        if (result) {
          const [key, value] = result;
          const abnormal = abnormalValues.find(a => a.test.toLowerCase().includes(test));
          categoryResults[key] = {
            value: value,
            status: abnormal ? abnormal.status : 'NORMAL',
            reference: this.normalRanges[test]
          };
          if (abnormal) hasAbnormal = true;
        }
      }
      
      if (Object.keys(categoryResults).length > 0) {
        analysis[category] = {
          results: categoryResults,
          hasAbnormal: hasAbnormal
        };
      }
    }
    
    return analysis;
  }
}

module.exports = new LabResultInterpreter();