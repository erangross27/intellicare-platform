/**
 * Vital Signs Analyzer Service
 * Provides basic vital signs analysis functionality
 */

// const geminiMedicalService = require('./geminiMedicalService'); // Service deleted - no longer using Gemini

const serviceAccountManager = require('./serviceAccountManager');
const SecureDataAccess = require('./secureDataAccess');

class VitalSignsAnalyzer {
  constructor() {
    this.initialized = false;
    // Keep minimal fallback ranges for when API is unavailable
    // These are NOT medical decisions, just data validation ranges
    this.validationRanges = {
      bloodPressure: {
        systolic: { min: 40, max: 300 },
        diastolic: { min: 20, max: 200 }
      },
      heartRate: { min: 20, max: 300 },
      temperature: { min: 30, max: 45 },
      respiratoryRate: { min: 0, max: 60 },
      oxygenSaturation: { min: 0, max: 100 }
    };
  }
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('vital-signs-analyzer');
      
      // Initialize secure config service
      // SecureConfigService already initialized globally
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      await SecureDataAccess.insert('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'vitalSignsAnalyzer',
        timestamp: new Date()
      }, {
        serviceId: 'vital-signs-analyzer',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      });
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize VitalSignsAnalyzer: ${error.message}`);
    }
  }


  /**
   * Main analysis function - provides basic vital signs analysis
   */
  async analyze(vitals, patientInfo = {}, previousReadings = [], language = 'en') {
    const isHebrew = language === 'he';
    
    // Validate input data
    const validationErrors = this.validateVitals(vitals);
    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors,
        message: isHebrew 
          ? 'נתונים לא תקינים' 
          : 'Invalid vital signs data'
      };
    }

    // Return basic analysis without AI
    return this.basicFallbackAnalysis(vitals, patientInfo, previousReadings, isHebrew);
  }

  /**
   * Validate vital signs are within possible ranges (not medical assessment)
   */
  validateVitals(vitals) {
    const errors = [];
    
    if (vitals.bloodPressure) {
      const bp = vitals.bloodPressure;
      if (bp.systolic < this.validationRanges.bloodPressure.systolic.min ||
          bp.systolic > this.validationRanges.bloodPressure.systolic.max) {
        errors.push('Invalid systolic blood pressure value');
      }
      if (bp.diastolic < this.validationRanges.bloodPressure.diastolic.min ||
          bp.diastolic > this.validationRanges.bloodPressure.diastolic.max) {
        errors.push('Invalid diastolic blood pressure value');
      }
    }
    
    if (vitals.heartRate !== undefined) {
      if (vitals.heartRate < this.validationRanges.heartRate.min ||
          vitals.heartRate > this.validationRanges.heartRate.max) {
        errors.push('Invalid heart rate value');
      }
    }
    
    if (vitals.temperature !== undefined) {
      if (vitals.temperature < this.validationRanges.temperature.min ||
          vitals.temperature > this.validationRanges.temperature.max) {
        errors.push('Invalid temperature value');
      }
    }
    
    return errors;
  }

  /**
   * Format alerts from Gemini response
   */
  formatAlerts(geminiAlerts, isHebrew) {
    return geminiAlerts.map(alert => ({
      severity: this.mapSeverity(alert.severity || alert),
      parameter: alert.parameter || 'general',
      value: alert.value || '',
      message: isHebrew ? this.translateAlert(alert) : (alert.message || alert),
      action: alert.action || 'monitor'
    }));
  }

  /**
   * Map Gemini severity to our format
   */
  mapSeverity(severity) {
    const severityMap = {
      'immediate': 'critical',
      'urgent': 'high',
      'moderate': 'medium',
      'low': 'low',
      'normal': 'normal'
    };
    return severityMap[severity] || severity || 'medium';
  }

  /**
   * Format recommendations
   */
  formatRecommendations(recommendations, isHebrew) {
    return recommendations.map(rec => ({
      priority: rec.priority || 'routine',
      text: isHebrew ? this.translateRecommendation(rec) : (rec.text || rec),
      action: rec.action || 'monitor'
    }));
  }

  /**
   * Format summary from Gemini analysis
   */
  formatSummary(geminiAnalysis, isHebrew) {
    if (geminiAnalysis.summary) {
      return isHebrew ? this.translateSummary(geminiAnalysis.summary) : geminiAnalysis.summary;
    }
    
    const status = geminiAnalysis.status || 'normal';
    if (status === 'critical') {
      return isHebrew
        ? 'מצב קריטי - נדרשת התערבות מיידית'
        : 'Critical condition - Immediate intervention required';
    } else if (status === 'abnormal') {
      return isHebrew
        ? 'נמצאו ערכים חריגים - נדרש מעקב'
        : 'Abnormal values detected - Monitoring required';
    } else {
      return isHebrew
        ? 'סימנים חיוניים תקינים'
        : 'Vital signs within normal limits';
    }
  }

  /**
   * Analyze trends with AI assistance
   */
  analyzeTrendsWithAI(previousReadings, currentVitals, geminiAnalysis) {
    const trends = [];
    
    if (previousReadings.length < 2) return trends;
    
    // Use Gemini's trend analysis if available
    if (geminiAnalysis.trends) {
      return geminiAnalysis.trends;
    }
    
    // Basic trend calculation (not medical interpretation)
    const last = previousReadings[previousReadings.length - 1];
    
    if (currentVitals.bloodPressure && last.bloodPressure) {
      const change = currentVitals.bloodPressure.systolic - last.bloodPressure.systolic;
      if (Math.abs(change) > 10) {
        trends.push({
          parameter: 'bloodPressure',
          direction: change > 0 ? 'increasing' : 'decreasing',
          change: `${Math.abs(change)} mmHg`
        });
      }
    }
    
    if (currentVitals.heartRate && last.heartRate) {
      const change = currentVitals.heartRate - last.heartRate;
      if (Math.abs(change) > 10) {
        trends.push({
          parameter: 'heartRate',
          direction: change > 0 ? 'increasing' : 'decreasing',
          change: `${Math.abs(change)} bpm`
        });
      }
    }
    
    return trends;
  }

  /**
   * Basic fallback analysis when API is unavailable
   * NO medical decisions - just data formatting
   */
  basicFallbackAnalysis(vitals, patientInfo, previousReadings, isHebrew) {
    return {
      timestamp: new Date().toISOString(),
      vitals: vitals,
      ageGroup: this.getAgeGroup(patientInfo.age),
      alerts: [],
      trends: this.calculateBasicTrends(previousReadings, vitals),
      newsScore: null,
      recommendations: [{
        priority: 'routine',
        text: isHebrew 
          ? 'נדרשת הערכה רפואית - המערכת לא זמינה כעת'
          : 'Medical evaluation required - System temporarily unavailable',
        action: 'consult_physician'
      }],
      summary: isHebrew
        ? 'נתונים נרשמו - נדרשת הערכה רפואית'
        : 'Data recorded - Medical evaluation required',
      fallbackMode: true
    };
  }

  /**
   * Calculate basic trends without medical interpretation
   */
  calculateBasicTrends(previousReadings, currentVitals) {
    if (!previousReadings || previousReadings.length === 0) return [];
    
    const trends = [];
    const last = previousReadings[previousReadings.length - 1];
    
    // Just report changes, no medical interpretation
    if (currentVitals.bloodPressure && last.bloodPressure) {
      const systolicChange = currentVitals.bloodPressure.systolic - last.bloodPressure.systolic;
      const diastolicChange = currentVitals.bloodPressure.diastolic - last.bloodPressure.diastolic;
      
      trends.push({
        parameter: 'bloodPressure',
        current: `${currentVitals.bloodPressure.systolic}/${currentVitals.bloodPressure.diastolic}`,
        previous: `${last.bloodPressure.systolic}/${last.bloodPressure.diastolic}`,
        change: `${systolicChange > 0 ? '+' : ''}${systolicChange}/${diastolicChange > 0 ? '+' : ''}${diastolicChange}`
      });
    }
    
    if (currentVitals.heartRate && last.heartRate) {
      const change = currentVitals.heartRate - last.heartRate;
      trends.push({
        parameter: 'heartRate',
        current: currentVitals.heartRate,
        previous: last.heartRate,
        change: `${change > 0 ? '+' : ''}${change}`
      });
    }
    
    return trends;
  }

  /**
   * Helper: Get age group (for display purposes only)
   */
  getAgeGroup(age) {
    if (!age) return 'adult';
    if (age <= 12) return 'pediatric';
    if (age >= 65) return 'elderly';
    return 'adult';
  }

  /**
   * Helper: Get NEWS category name
   */
  getNEWSCategory(score) {
    if (score === 0) return 'low';
    if (score >= 1 && score <= 4) return 'medium';
    if (score >= 5 && score <= 6) return 'high';
    if (score >= 7) return 'critical';
    return 'unknown';
  }

  /**
   * Translation helpers
   */
  translateAlert(alert) {
    // Basic translation mapping - can be enhanced
    const message = alert.message || alert;
    const translations = {
      'High blood pressure': 'לחץ דם גבוה',
      'Low blood pressure': 'לחץ דם נמוך',
      'High heart rate': 'דופק מהיר',
      'Low heart rate': 'דופק איטי',
      'Fever': 'חום',
      'Low oxygen': 'רמת חמצן נמוכה'
    };
    
    for (const [en, he] of Object.entries(translations)) {
      if (message.includes(en)) {
        return message.replace(en, he);
      }
    }
    
    return message;
  }

  translateRecommendation(rec) {
    const text = rec.text || rec;
    const translations = {
      'Monitor closely': 'נדרש מעקב צמוד',
      'Seek immediate medical attention': 'פנה לטיפול רפואי מיידי',
      'Continue monitoring': 'המשך מעקב',
      'Consult physician': 'התייעץ עם רופא'
    };
    
    for (const [en, he] of Object.entries(translations)) {
      if (text.includes(en)) {
        return text.replace(en, he);
      }
    }
    
    return text;
  }

  translateSummary(summary) {
    const translations = {
      'Critical condition': 'מצב קריטי',
      'Abnormal values': 'ערכים חריגים',
      'Normal limits': 'טווח תקין',
      'Immediate intervention': 'התערבות מיידית',
      'Monitoring required': 'נדרש מעקב'
    };
    
    let translated = summary;
    for (const [en, he] of Object.entries(translations)) {
      translated = translated.replace(en, he);
    }
    
    return translated;
  }
}

module.exports = new VitalSignsAnalyzer();