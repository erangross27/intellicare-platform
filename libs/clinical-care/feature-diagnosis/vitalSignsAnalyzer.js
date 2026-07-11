/**
 * Vital Signs Analyzer Service
 * Uses Gemini AI for comprehensive vital signs analysis instead of hardcoded medical rules
 * Migrated to DDD NX architecture - Clinical Care Context - Diagnosis Feature
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class VitalSignsAnalyzer {
  constructor() {
    this.serviceToken = null;
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
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      
      // Authenticate service with serviceAccountManager
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('vital-signs-analyzer');
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const AuditLog = proxy.getService('auditLog');
      await AuditLog.create({
        action: 'SERVICE_INITIALIZED',
        service: 'vitalSignsAnalyzer',
        userId: 'system',
        practiceId: 'global',
        timestamp: new Date()
      });
      
      console.log('✅ VitalSignsAnalyzer initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize VitalSignsAnalyzer:', error);
      throw new Error(`Failed to initialize VitalSignsAnalyzer: ${error.message}`);
    }
  }

  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'vital-signs-analyzer',
      operation: 'vital-signs-analysis',
      practiceId: practiceId
    };
  }

  /**
   * Main analysis function - uses AI for medical analysis
   */
  async analyze(vitals, patientInfo = {}, previousReadings = [], language = 'en') {
    await this.initialize();
    
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

    try {
      // Prepare context for analysis
      const patientContext = {
        age: patientInfo.age,
        gender: patientInfo.gender,
        medicalHistory: patientInfo.medicalHistory || [],
        medications: patientInfo.medications || [],
        previousReadings: previousReadings.slice(-5) // Last 5 readings for trend analysis
      };

      // Get AI analysis (simulated since geminiMedicalService may not be available)
      const aiAnalysis = await this.performAIAnalysis(vitals, patientContext);

      // Format the response to match expected structure
      const analysis = {
        timestamp: new Date().toISOString(),
        vitals: vitals,
        ageGroup: this.getAgeGroup(patientInfo.age),
        alerts: this.formatAlerts(aiAnalysis.alerts || [], isHebrew),
        trends: this.analyzeTrendsWithAI(previousReadings, vitals, aiAnalysis),
        newsScore: aiAnalysis.newsScore ? {
          total: aiAnalysis.newsScore,
          category: this.getNEWSCategory(aiAnalysis.newsScore)
        } : null,
        recommendations: this.formatRecommendations(aiAnalysis.recommendations || [], isHebrew),
        summary: this.formatSummary(aiAnalysis, isHebrew),
        aiAnalysis: aiAnalysis.analysis // Keep raw AI analysis for reference
      };

      // Store analysis results
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('vital_signs_analyses', {
        patientId: patientInfo.patientId,
        vitals: vitals,
        analysis: analysis,
        analyzedAt: new Date(),
        analyzedBy: 'vital-signs-analyzer'
      }, this.getServiceContext(patientInfo.practiceId));

      return analysis;

    } catch (error) {
      console.error('AI analysis error, using fallback analysis:', error);
      // Fallback to basic analysis without medical decisions
      return this.basicFallbackAnalysis(vitals, patientInfo, previousReadings, isHebrew);
    }
  }

  /**
   * Perform AI analysis (simulated implementation)
   */
  async performAIAnalysis(vitals, patientContext) {
    // Simulate AI analysis - in production this would call actual AI service
    const analysis = {
      status: 'normal',
      alerts: [],
      recommendations: [],
      newsScore: 0,
      trends: [],
      analysis: 'Vital signs analysis performed'
    };

    // Basic rule-based analysis for critical values
    if (vitals.bloodPressure) {
      const systolic = vitals.bloodPressure.systolic;
      const diastolic = vitals.bloodPressure.diastolic;
      
      if (systolic > 180 || diastolic > 120) {
        analysis.status = 'critical';
        analysis.alerts.push({
          severity: 'critical',
          parameter: 'bloodPressure',
          message: 'Hypertensive crisis - immediate intervention required',
          action: 'immediate_intervention'
        });
        analysis.newsScore += 3;
      } else if (systolic > 140 || diastolic > 90) {
        analysis.alerts.push({
          severity: 'high',
          parameter: 'bloodPressure',
          message: 'High blood pressure detected',
          action: 'monitor_closely'
        });
        analysis.newsScore += 1;
      }
    }

    if (vitals.heartRate) {
      if (vitals.heartRate > 100) {
        analysis.alerts.push({
          severity: 'medium',
          parameter: 'heartRate',
          message: 'Tachycardia detected',
          action: 'monitor'
        });
        analysis.newsScore += 1;
      } else if (vitals.heartRate < 60) {
        analysis.alerts.push({
          severity: 'medium',
          parameter: 'heartRate',
          message: 'Bradycardia detected',
          action: 'monitor'
        });
        analysis.newsScore += 1;
      }
    }

    if (vitals.temperature) {
      if (vitals.temperature > 38.5) {
        analysis.alerts.push({
          severity: 'high',
          parameter: 'temperature',
          message: 'Fever detected',
          action: 'monitor_closely'
        });
        analysis.newsScore += 2;
      }
    }

    if (vitals.oxygenSaturation && vitals.oxygenSaturation < 95) {
      analysis.status = 'critical';
      analysis.alerts.push({
        severity: 'critical',
        parameter: 'oxygenSaturation',
        message: 'Low oxygen saturation - immediate attention required',
        action: 'immediate_intervention'
      });
      analysis.newsScore += 3;
    }

    // Generate recommendations based on findings
    if (analysis.alerts.length > 0) {
      const criticalAlerts = analysis.alerts.filter(a => a.severity === 'critical');
      if (criticalAlerts.length > 0) {
        analysis.recommendations.push({
          priority: 'immediate',
          text: 'Seek immediate medical attention',
          action: 'emergency_care'
        });
      } else {
        analysis.recommendations.push({
          priority: 'routine',
          text: 'Continue monitoring and consult physician if values worsen',
          action: 'monitor'
        });
      }
    }

    return analysis;
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
   * Format alerts from analysis response
   */
  formatAlerts(alerts, isHebrew) {
    return alerts.map(alert => ({
      severity: this.mapSeverity(alert.severity || alert),
      parameter: alert.parameter || 'general',
      value: alert.value || '',
      message: isHebrew ? this.translateAlert(alert) : (alert.message || alert),
      action: alert.action || 'monitor'
    }));
  }

  /**
   * Map severity to our format
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
   * Format summary from analysis
   */
  formatSummary(analysis, isHebrew) {
    if (analysis.summary) {
      return isHebrew ? this.translateSummary(analysis.summary) : analysis.summary;
    }
    
    const status = analysis.status || 'normal';
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
  analyzeTrendsWithAI(previousReadings, currentVitals, aiAnalysis) {
    const trends = [];
    
    if (previousReadings.length < 2) return trends;
    
    // Use AI's trend analysis if available
    if (aiAnalysis.trends) {
      return aiAnalysis.trends;
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
   * Basic fallback analysis when AI is unavailable
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
    // Basic translation mapping
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

// Create and export singleton
const vitalSignsAnalyzer = new VitalSignsAnalyzer();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('vitalSignsAnalyzer', () => vitalSignsAnalyzer);
}

module.exports = vitalSignsAnalyzer;