/**
 * Lab Result Interpreter Service
 * Analyzes and interprets laboratory test results
 */

const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');

class LabResultInterpreter {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.referenceRanges = new Map();
    this.interpretationRules = new Map();
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    
    this.serviceToken = await serviceAccountManager.authenticate('lab-result-interpreter-service');
    this.initialized = true;
    console.log('✅ Lab Result Interpreter Service initialized with security token');
    
    // Load reference ranges
    await this.loadReferenceRanges();
  }

  async loadReferenceRanges() {
    // Common lab test reference ranges
    this.referenceRanges.set('glucose', {
      min: 70,
      max: 100,
      unit: 'mg/dL',
      critical: { min: 40, max: 400 }
    });
    
    this.referenceRanges.set('hemoglobin', {
      male: { min: 14.0, max: 18.0 },
      female: { min: 12.0, max: 16.0 },
      unit: 'g/dL'
    });
    
    this.referenceRanges.set('cholesterol', {
      desirable: { max: 200 },
      borderline: { min: 200, max: 239 },
      high: { min: 240 },
      unit: 'mg/dL'
    });
  }

  async interpretResult(testName, value, patientInfo = {}) {
    if (!this.initialized) await this.initialize();
    
    const context = {
      serviceId: 'lab-result-interpreter-service',
      operation: 'interpret-result',
      practiceId: patientInfo.practiceId || 'global'
    };
    
    const range = this.referenceRanges.get(testName.toLowerCase());
    if (!range) {
      return {
        testName,
        value,
        interpretation: 'Reference range not available',
        status: 'unknown'
      };
    }
    
    const result = {
      testName,
      value,
      unit: range.unit,
      referenceRange: range,
      interpretation: '',
      status: 'normal',
      recommendations: []
    };
    
    // Interpret based on test type
    if (testName.toLowerCase() === 'glucose') {
      if (value < range.min) {
        result.status = 'low';
        result.interpretation = 'Hypoglycemia - blood glucose below normal range';
        result.recommendations.push('Monitor for symptoms of low blood sugar');
      } else if (value > range.max) {
        result.status = 'high';
        result.interpretation = 'Hyperglycemia - blood glucose above normal range';
        result.recommendations.push('Consider diabetes screening');
      }
    }
    
    // Store interpretation in database
    await SecureDataAccess.create('lab_interpretations', result, context);
    
    return result;
  }

  async interpretBatch(labResults, patientInfo = {}) {
    if (!this.initialized) await this.initialize();
    
    const interpretations = [];
    
    for (const result of labResults) {
      const interpretation = await this.interpretResult(
        result.testName, 
        result.value, 
        patientInfo
      );
      interpretations.push(interpretation);
    }
    
    return {
      patientId: patientInfo.patientId,
      interpretations,
      overallAssessment: this.generateOverallAssessment(interpretations),
      timestamp: new Date()
    };
  }

  generateOverallAssessment(interpretations) {
    const abnormal = interpretations.filter(i => i.status !== 'normal');
    
    if (abnormal.length === 0) {
      return 'All test results are within normal limits';
    }
    
    return `${abnormal.length} test(s) outside normal range - clinical correlation recommended`;
  }
}

module.exports = new LabResultInterpreter();