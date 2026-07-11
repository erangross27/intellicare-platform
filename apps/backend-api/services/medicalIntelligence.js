/**
 * Medical Intelligence Service
 * Provides intelligent analysis of medical data for proactive recommendations
 */

class MedicalIntelligenceService {
  constructor() {
    // Normal ranges for common tests
    this.normalRanges = {
      glucose: { min: 70, max: 100, criticalHigh: 200, unit: 'mg/dL' },
      a1c: { min: 4, max: 5.7, target: 7, high: 8, criticalHigh: 9, unit: '%' },
      systolic: { min: 90, max: 120, high: 140, criticalHigh: 180, unit: 'mmHg' },
      diastolic: { min: 60, max: 80, high: 90, criticalHigh: 120, unit: 'mmHg' },
      ldl: { max: 100, high: 130, criticalHigh: 160, unit: 'mg/dL' },
      hdl: { min: 40, low: 39, unit: 'mg/dL' },
      triglycerides: { max: 150, high: 200, criticalHigh: 500, unit: 'mg/dL' },
      creatinine: { max: 1.2, high: 1.5, criticalHigh: 2.0, unit: 'mg/dL' },
      bmi: { min: 18.5, max: 24.9, overweight: 25, obese: 30 },
      heartRate: { min: 60, max: 100, high: 110, criticalHigh: 150, unit: 'bpm' },
      // Respiratory parameters
      fev1_percent: { min: 80, low: 60, criticalLow: 50, unit: '%' },
      peakFlow_percent: { min: 80, low: 60, criticalLow: 50, unit: '%' },
      feno: { max: 25, high: 50, criticalHigh: 75, unit: 'ppb' },
      actScore: { min: 20, poor: 19, veryPoor: 15, unit: 'score' },
      ige: { max: 100, high: 200, criticalHigh: 400, unit: 'IU/mL' },
      // Cancer markers
      ca153: { max: 30, high: 35, criticalHigh: 40, unit: 'U/mL' },
      cea: { max: 3, high: 5, criticalHigh: 10, unit: 'ng/mL' },
      ca125: { max: 35, high: 50, criticalHigh: 100, unit: 'U/mL' }
    };

    // Medical protocols for common conditions
    this.protocols = {
      diabetes: {
        indicators: ['a1c', 'glucose', 'bmi'],
        thresholds: {
          controlled: { a1c: 7, glucose: 130 },
          uncontrolled: { a1c: 8, glucose: 180 },
          critical: { a1c: 9, glucose: 250 }
        },
        actions: {
          controlled: ['Continue current regimen', 'Monitor quarterly'],
          uncontrolled: ['Adjust medications', 'Endocrinology referral', 'Monthly monitoring'],
          critical: ['Urgent endocrinology', 'Consider insulin', 'Weekly monitoring']
        }
      },
      hypertension: {
        indicators: ['systolic', 'diastolic'],
        stages: {
          normal: { systolic: 120, diastolic: 80 },
          elevated: { systolic: 130, diastolic: 80 },
          stage1: { systolic: 140, diastolic: 90 },
          stage2: { systolic: 140, diastolic: 90 },
          crisis: { systolic: 180, diastolic: 120 }
        },
        actions: {
          elevated: ['Lifestyle modifications', 'Recheck in 3-6 months'],
          stage1: ['Consider medication', 'DASH diet', 'Recheck in 1 month'],
          stage2: ['Start medication', 'Lifestyle changes', 'Recheck in 2 weeks'],
          crisis: ['Immediate evaluation', 'Consider hospitalization']
        }
      }
    };
  }

  /**
   * Main entry point for analyzing ALL medical data
   * This is what Claude calls to get comprehensive insights
   */
  analyzeMedicalData(data) {
    const analysis = {
      alerts: [],
      trends: [],
      recommendations: [],
      riskScores: {},
      insights: [],
      followUpQuestions: [],
      suggestedActions: []
    };

    // Analyze based on data type
    if (data && typeof data === 'object') {
      // Patient list data
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.firstName && item.lastName) {
            // It's a patient
            const patientAnalysis = this.analyzePatientData(item);
            if (patientAnalysis.critical.length > 0) {
              patientAnalysis.critical.forEach(alert => {
                analysis.alerts.push({
                  severity: 'CRITICAL',
                  patient: `${item.firstName} ${item.lastName}`,
                  message: alert.message,
                  action: alert.action
                });
              });
            }
            if (patientAnalysis.high.length > 0) {
              patientAnalysis.high.forEach(alert => {
                analysis.alerts.push({
                  severity: 'HIGH',
                  patient: `${item.firstName} ${item.lastName}`,
                  message: alert.message,
                  action: alert.action
                });
              });
            }
          } else if (item.testName && item.result) {
            // It's a lab result
            const labAnalysis = this.analyzeLabResults([item]);
            if (labAnalysis.abnormal.length > 0) {
              labAnalysis.abnormal.forEach(lab => {
                analysis.alerts.push({
                  severity: lab.severity === 'critical' ? 'CRITICAL' : 'HIGH',
                  message: lab.message,
                  action: lab.action
                });
              });
            }
            analysis.recommendations.push(...labAnalysis.recommendations);
          }
        });
      }

      // Single patient data
      else if (data.firstName && data.lastName) {
        const patientAnalysis = this.analyzePatientData(data);
        analysis.alerts.push(...patientAnalysis.critical.map(a => ({...a, severity: 'CRITICAL'})));
        analysis.alerts.push(...patientAnalysis.high.map(a => ({...a, severity: 'HIGH'})));
        analysis.alerts.push(...patientAnalysis.moderate.map(a => ({...a, severity: 'MODERATE'})));
      }

      // Medical history with categories
      else if (data.lab_results || data.vital_signs || data.medications || data.diagnoses) {
        // Analyze lab results
        if (data.lab_results && Array.isArray(data.lab_results)) {
          const labAnalysis = this.analyzeLabResults(data.lab_results);
          labAnalysis.abnormal.forEach(lab => {
            analysis.alerts.push({
              severity: lab.severity === 'critical' ? 'CRITICAL' : 'HIGH',
              category: 'Lab Results',
              message: lab.message,
              action: lab.action,
              date: lab.date
            });
          });
          analysis.recommendations.push(...labAnalysis.recommendations);

          // Detect trends in lab values
          const trends = this.detectLabTrends(data.lab_results);
          analysis.trends.push(...trends);
        }

        // Analyze vital signs
        if (data.vital_signs && Array.isArray(data.vital_signs)) {
          const vitalAnalysis = this.analyzeVitalSigns(data.vital_signs);
          analysis.alerts.push(...vitalAnalysis.alerts);
          analysis.insights.push(...vitalAnalysis.insights);
        }

        // Analyze medications for interactions and compliance
        if (data.medications && Array.isArray(data.medications)) {
          const medAnalysis = this.analyzeMedications(data.medications, data.diagnoses);
          analysis.alerts.push(...medAnalysis.alerts);
          analysis.recommendations.push(...medAnalysis.recommendations);
        }

        // Calculate risk scores based on all data
        analysis.riskScores = this.calculateComprehensiveRisk(data);

        // Generate follow-up questions based on findings
        analysis.followUpQuestions = this.generateFollowUpQuestions(analysis);

        // Generate specific actionable suggestions
        analysis.suggestedActions = this.generateDetailedActions(analysis);
      }
    }

    return analysis;
  }

  /**
   * Analyze patient data for medical alerts
   */
  analyzePatientData(patient) {
    const alerts = {
      critical: [],
      high: [],
      moderate: [],
      suggestions: []
    };

    // Check A1C levels
    if (patient.lastA1C) {
      const a1c = parseFloat(patient.lastA1C);
      if (a1c >= this.normalRanges.a1c.criticalHigh) {
        alerts.critical.push({
          type: 'A1C',
          value: a1c,
          message: `Critical A1C: ${a1c}% (target <7%)`,
          action: 'Urgent endocrinology referral needed'
        });
      } else if (a1c >= this.normalRanges.a1c.high) {
        alerts.high.push({
          type: 'A1C',
          value: a1c,
          message: `High A1C: ${a1c}% (target <7%)`,
          action: 'Medication adjustment recommended'
        });
      }
    }

    // Check blood pressure
    if (patient.lastBP) {
      const [systolic, diastolic] = patient.lastBP.split('/').map(Number);
      if (systolic >= this.normalRanges.systolic.criticalHigh ||
          diastolic >= this.normalRanges.diastolic.criticalHigh) {
        alerts.critical.push({
          type: 'Blood Pressure',
          value: patient.lastBP,
          message: `Hypertensive crisis: ${patient.lastBP}`,
          action: 'Immediate medical attention required'
        });
      } else if (systolic >= this.normalRanges.systolic.high ||
                 diastolic >= this.normalRanges.diastolic.high) {
        alerts.high.push({
          type: 'Blood Pressure',
          value: patient.lastBP,
          message: `Hypertension: ${patient.lastBP}`,
          action: 'Blood pressure medication adjustment'
        });
      }
    }

    // Check missed appointments
    if (patient.missedAppointments > 2) {
      alerts.high.push({
        type: 'Compliance',
        value: patient.missedAppointments,
        message: `${patient.missedAppointments} missed appointments`,
        action: 'Contact patient for follow-up'
      });
    }

    // Check overdue labs
    if (patient.overdueLabs > 90) {
      alerts.moderate.push({
        type: 'Lab Work',
        value: patient.overdueLabs,
        message: `Labs overdue by ${patient.overdueLabs} days`,
        action: 'Schedule lab work immediately'
      });
    }

    return alerts;
  }

  /**
   * Analyze lab results for abnormalities
   */
  analyzeLabResults(labs) {
    const analysis = {
      abnormal: [],
      trends: [],
      recommendations: []
    };

    labs.forEach(lab => {
      const labName = lab.testName?.toLowerCase() || '';
      const value = parseFloat(lab.result);

      if (isNaN(value)) return;

      // Glucose analysis
      if (labName.includes('glucose') || labName.includes('blood sugar')) {
        if (value > this.normalRanges.glucose.criticalHigh) {
          analysis.abnormal.push({
            name: lab.testName,
            value: value,
            severity: 'critical',
            message: `Critical high glucose: ${value} mg/dL`,
            action: 'Immediate intervention required'
          });
        } else if (value > this.normalRanges.glucose.max) {
          analysis.abnormal.push({
            name: lab.testName,
            value: value,
            severity: 'high',
            message: `Elevated glucose: ${value} mg/dL`,
            action: 'Review diabetes management'
          });
        }
      }

      // A1C analysis
      if (labName.includes('a1c') || labName.includes('hemoglobin a1c')) {
        if (value > this.normalRanges.a1c.criticalHigh) {
          analysis.abnormal.push({
            name: lab.testName,
            value: value,
            severity: 'critical',
            message: `Critical A1C: ${value}%`,
            action: 'Urgent endocrinology referral'
          });
          analysis.recommendations.push('Consider insulin therapy');
          analysis.recommendations.push('Intensive diabetes education');
        } else if (value > this.normalRanges.a1c.high) {
          analysis.abnormal.push({
            name: lab.testName,
            value: value,
            severity: 'high',
            message: `Elevated A1C: ${value}%`,
            action: 'Adjust diabetes medications'
          });
          analysis.recommendations.push('Add or adjust GLP-1 agonist');
          analysis.recommendations.push('Review diet and exercise');
        }
      }

      // Kidney function
      if (labName.includes('creatinine')) {
        if (value > this.normalRanges.creatinine.criticalHigh) {
          analysis.abnormal.push({
            name: lab.testName,
            value: value,
            severity: 'critical',
            message: `Critical creatinine: ${value} mg/dL`,
            action: 'Urgent nephrology referral'
          });
          analysis.recommendations.push('Check for kidney disease progression');
          analysis.recommendations.push('Review all medications for renal dosing');
        }
      }
    });

    return analysis;
  }

  /**
   * Analyze vital signs for abnormalities and trends
   */
  analyzeVitalSigns(vitals) {
    const analysis = {
      alerts: [],
      insights: []
    };

    if (!vitals || !Array.isArray(vitals)) return analysis;

    // Get most recent vitals
    const recent = vitals.slice(0, 10);

    recent.forEach(vital => {
      // Blood pressure analysis
      if (vital.bloodPressure) {
        const [systolic, diastolic] = vital.bloodPressure.split('/').map(Number);
        if (systolic >= 180 || diastolic >= 120) {
          analysis.alerts.push({
            severity: 'CRITICAL',
            category: 'Vital Signs',
            message: `Hypertensive crisis: ${vital.bloodPressure}`,
            action: 'Immediate medical attention required',
            date: vital.date
          });
        } else if (systolic >= 140 || diastolic >= 90) {
          analysis.alerts.push({
            severity: 'HIGH',
            category: 'Vital Signs',
            message: `Hypertension: ${vital.bloodPressure}`,
            action: 'Medication adjustment needed',
            date: vital.date
          });
        }
      }

      // Heart rate analysis
      if (vital.heartRate) {
        const hr = parseInt(vital.heartRate);
        if (hr > 150) {
          analysis.alerts.push({
            severity: 'CRITICAL',
            category: 'Vital Signs',
            message: `Tachycardia: ${hr} bpm`,
            action: 'Cardiac evaluation needed',
            date: vital.date
          });
        } else if (hr < 50) {
          analysis.alerts.push({
            severity: 'HIGH',
            category: 'Vital Signs',
            message: `Bradycardia: ${hr} bpm`,
            action: 'Cardiac monitoring required',
            date: vital.date
          });
        }
      }

      // Temperature analysis
      if (vital.temperature) {
        const temp = parseFloat(vital.temperature);
        if (temp > 103) {
          analysis.alerts.push({
            severity: 'HIGH',
            category: 'Vital Signs',
            message: `High fever: ${temp}°F`,
            action: 'Infection workup needed',
            date: vital.date
          });
        }
      }

      // Oxygen saturation
      if (vital.oxygenSaturation) {
        const o2 = parseInt(vital.oxygenSaturation);
        if (o2 < 90) {
          analysis.alerts.push({
            severity: 'CRITICAL',
            category: 'Vital Signs',
            message: `Hypoxia: ${o2}% O2 saturation`,
            action: 'Oxygen therapy required',
            date: vital.date
          });
        } else if (o2 < 94) {
          analysis.alerts.push({
            severity: 'HIGH',
            category: 'Vital Signs',
            message: `Low oxygen: ${o2}% saturation`,
            action: 'Pulmonary evaluation needed',
            date: vital.date
          });
        }
      }
    });

    // Detect trends in vital signs
    if (vitals.length >= 3) {
      const bpTrend = this.detectBloodPressureTrend(vitals.slice(0, 5));
      if (bpTrend) analysis.insights.push(bpTrend);
    }

    return analysis;
  }

  /**
   * Detect trends in lab values over time
   */
  detectLabTrends(labs) {
    const trends = [];
    if (!labs || labs.length < 2) return trends;

    // Group labs by test name
    const grouped = {};
    labs.forEach(lab => {
      const name = lab.testName?.toLowerCase() || '';
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(lab);
    });

    // Analyze trends for each test
    Object.keys(grouped).forEach(testName => {
      const values = grouped[testName]
        .filter(l => l.result && !isNaN(parseFloat(l.result)))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      if (values.length >= 2) {
        const recent = parseFloat(values[0].result);
        const previous = parseFloat(values[1].result);
        const percentChange = ((recent - previous) / previous * 100).toFixed(1);

        // Check for concerning trends
        if (testName.includes('creatinine') && recent > previous) {
          trends.push({
            type: 'WORSENING',
            test: 'Creatinine',
            message: `Creatinine rising: ${previous}→${recent} mg/dL (+${percentChange}%)`,
            concern: 'Possible kidney function decline',
            action: 'Monitor renal function closely'
          });
        }

        if (testName.includes('a1c') && recent > previous && recent > 7) {
          trends.push({
            type: 'WORSENING',
            test: 'A1C',
            message: `A1C increasing: ${previous}%→${recent}% (+${percentChange}%)`,
            concern: 'Diabetes control deteriorating',
            action: 'Intensify diabetes management'
          });
        }

        if (testName.includes('glucose') && values.length >= 3) {
          const allIncreasing = values.every((v, i) =>
            i === values.length - 1 || parseFloat(v.result) > parseFloat(values[i + 1].result)
          );
          if (allIncreasing) {
            trends.push({
              type: 'CONCERNING',
              test: 'Glucose',
              message: `Glucose trending up over last ${values.length} readings`,
              concern: 'Progressive hyperglycemia',
              action: 'Urgent diabetes intervention needed'
            });
          }
        }
      }
    });

    return trends;
  }

  /**
   * Detect blood pressure trends
   */
  detectBloodPressureTrend(vitals) {
    const bpReadings = vitals
      .filter(v => v.bloodPressure)
      .map(v => {
        const [s, d] = v.bloodPressure.split('/').map(Number);
        return { systolic: s, diastolic: d, date: v.date };
      });

    if (bpReadings.length < 3) return null;

    const avgRecent = {
      systolic: bpReadings.slice(0, 2).reduce((sum, r) => sum + r.systolic, 0) / 2,
      diastolic: bpReadings.slice(0, 2).reduce((sum, r) => sum + r.diastolic, 0) / 2
    };

    const avgPrevious = {
      systolic: bpReadings.slice(2, 4).reduce((sum, r) => sum + r.systolic, 0) / 2,
      diastolic: bpReadings.slice(2, 4).reduce((sum, r) => sum + r.diastolic, 0) / 2
    };

    if (avgRecent.systolic > avgPrevious.systolic + 10) {
      return {
        type: 'TREND',
        message: `Blood pressure increasing: ${Math.round(avgPrevious.systolic)}/${Math.round(avgPrevious.diastolic)} → ${Math.round(avgRecent.systolic)}/${Math.round(avgRecent.diastolic)}`,
        concern: 'Hypertension worsening',
        action: 'Review antihypertensive therapy'
      };
    }

    return null;
  }

  /**
   * Analyze medications for interactions and compliance
   */
  analyzeMedications(medications, diagnoses) {
    const analysis = {
      alerts: [],
      recommendations: []
    };

    if (!medications || !Array.isArray(medications)) return analysis;

    // Check for polypharmacy
    const activeMeds = medications.filter(m => m.status === 'active' || !m.status);
    if (activeMeds.length > 10) {
      analysis.alerts.push({
        severity: 'MODERATE',
        category: 'Medications',
        message: `Polypharmacy: ${activeMeds.length} active medications`,
        action: 'Medication reconciliation recommended'
      });
      analysis.recommendations.push('Consider deprescribing unnecessary medications');
    }

    // Check for high-risk medications
    const highRisk = ['warfarin', 'insulin', 'digoxin', 'lithium'];
    activeMeds.forEach(med => {
      const medName = (med.name || med.medicationName || '').toLowerCase();
      if (highRisk.some(risk => medName.includes(risk))) {
        analysis.alerts.push({
          severity: 'HIGH',
          category: 'Medications',
          message: `High-risk medication: ${med.name || med.medicationName}`,
          action: 'Ensure appropriate monitoring'
        });
      }
    });

    // Check for diabetes medications without recent A1C
    const diabetesMeds = activeMeds.filter(m => {
      const name = (m.name || m.medicationName || '').toLowerCase();
      return name.includes('metformin') || name.includes('insulin') ||
             name.includes('glipizide') || name.includes('januvia');
    });

    if (diabetesMeds.length > 0) {
      analysis.recommendations.push('Check A1C if not done in last 3 months');
    }

    return analysis;
  }

  /**
   * Calculate comprehensive risk scores
   */
  calculateComprehensiveRisk(data) {
    const risks = {};

    // Cardiovascular risk based on multiple factors
    let cvScore = 0;
    if (data.vital_signs && data.vital_signs[0]) {
      const bp = data.vital_signs[0].bloodPressure;
      if (bp) {
        const [s] = bp.split('/').map(Number);
        if (s > 140) cvScore += 3;
        else if (s > 130) cvScore += 2;
      }
    }

    if (data.lab_results) {
      const ldl = data.lab_results.find(l => l.testName?.toLowerCase().includes('ldl'));
      if (ldl && parseFloat(ldl.result) > 160) cvScore += 3;

      const a1c = data.lab_results.find(l => l.testName?.toLowerCase().includes('a1c'));
      if (a1c && parseFloat(a1c.result) > 7) cvScore += 2;
    }

    if (data.diagnoses) {
      if (data.diagnoses.some(d => d.name?.toLowerCase().includes('diabetes'))) cvScore += 2;
      if (data.diagnoses.some(d => d.name?.toLowerCase().includes('hypertension'))) cvScore += 2;
    }

    risks.cardiovascular = {
      score: cvScore,
      level: cvScore > 7 ? 'HIGH' : cvScore > 4 ? 'MODERATE' : 'LOW',
      interpretation: cvScore > 7 ? 'High risk for cardiovascular events' :
                      cvScore > 4 ? 'Moderate cardiovascular risk' :
                      'Low cardiovascular risk'
    };

    // Diabetes complications risk
    if (data.diagnoses && data.diagnoses.some(d => d.name?.toLowerCase().includes('diabetes'))) {
      let dmScore = 0;

      const a1c = data.lab_results?.find(l => l.testName?.toLowerCase().includes('a1c'));
      if (a1c) {
        const value = parseFloat(a1c.result);
        if (value > 9) dmScore += 4;
        else if (value > 8) dmScore += 3;
        else if (value > 7) dmScore += 2;
      }

      const creatinine = data.lab_results?.find(l => l.testName?.toLowerCase().includes('creatinine'));
      if (creatinine && parseFloat(creatinine.result) > 1.5) dmScore += 3;

      risks.diabetesComplications = {
        score: dmScore,
        level: dmScore > 5 ? 'HIGH' : dmScore > 3 ? 'MODERATE' : 'LOW',
        interpretation: dmScore > 5 ? 'High risk for diabetes complications' :
                       dmScore > 3 ? 'Moderate risk, intensify management' :
                       'Well-controlled diabetes'
      };
    }

    return risks;
  }

  /**
   * Generate follow-up questions based on analysis
   */
  generateFollowUpQuestions(analysis) {
    const questions = [];

    if (analysis.alerts.some(a => a.severity === 'CRITICAL')) {
      questions.push('Should I schedule an urgent appointment for the critical findings?');
    }

    if (analysis.trends.some(t => t.type === 'WORSENING')) {
      questions.push('Would you like me to track these worsening trends more closely?');
    }

    if (analysis.riskScores.cardiovascular?.level === 'HIGH') {
      questions.push('Should I calculate a 10-year ASCVD risk score?');
    }

    if (analysis.recommendations.includes('Check A1C if not done in last 3 months')) {
      questions.push('Would you like me to order an A1C test?');
    }

    return questions;
  }

  /**
   * Generate detailed actionable suggestions
   */
  generateDetailedActions(analysis) {
    const actions = [];

    // Priority 1: Critical alerts
    analysis.alerts
      .filter(a => a.severity === 'CRITICAL')
      .forEach(alert => {
        actions.push({
          priority: 1,
          type: 'URGENT',
          action: alert.action,
          reason: alert.message,
          timeframe: 'Today'
        });
      });

    // Priority 2: High alerts
    analysis.alerts
      .filter(a => a.severity === 'HIGH')
      .forEach(alert => {
        actions.push({
          priority: 2,
          type: 'HIGH',
          action: alert.action,
          reason: alert.message,
          timeframe: 'Within 48 hours'
        });
      });

    // Priority 3: Recommendations
    analysis.recommendations.forEach(rec => {
      actions.push({
        priority: 3,
        type: 'RECOMMENDED',
        action: rec,
        timeframe: 'Next visit'
      });
    });

    // Priority 4: Monitoring for trends
    if (analysis.trends.length > 0) {
      actions.push({
        priority: 4,
        type: 'MONITORING',
        action: 'Set up trend monitoring alerts',
        reason: `${analysis.trends.length} concerning trends detected`,
        timeframe: 'Ongoing'
      });
    }

    return actions;
  }

  /**
   * Generate suggested actions based on medical data
   */
  generateSuggestedActions(data) {
    const actions = [];

    // Analyze each type of data and generate actions
    if (data.abnormalLabs && data.abnormalLabs.length > 0) {
      data.abnormalLabs.forEach(lab => {
        if (lab.severity === 'critical') {
          actions.push({
            priority: 'critical',
            action: lab.action,
            timeframe: 'immediately'
          });
        } else if (lab.severity === 'high') {
          actions.push({
            priority: 'high',
            action: lab.action,
            timeframe: 'within 48 hours'
          });
        }
      });
    }

    // Check for medication adjustments needed
    if (data.medicationConcerns) {
      actions.push({
        priority: 'high',
        action: 'Review and adjust medications',
        timeframe: 'at next appointment'
      });
    }

    // Check for overdue preventive care
    if (data.overdueScreenings) {
      actions.push({
        priority: 'moderate',
        action: 'Schedule preventive screenings',
        timeframe: 'within 2 weeks'
      });
    }

    return actions;
  }

  /**
   * Calculate risk scores for various conditions
   */
  calculateRiskScores(patientData) {
    const risks = {};

    // Cardiovascular risk
    let cvRisk = 0;
    if (patientData.age > 65) cvRisk += 2;
    if (patientData.smoker) cvRisk += 3;
    if (patientData.diabetic) cvRisk += 2;
    if (patientData.hypertensive) cvRisk += 2;
    if (patientData.ldl > 160) cvRisk += 2;

    risks.cardiovascular = {
      score: cvRisk,
      level: cvRisk > 7 ? 'high' : cvRisk > 4 ? 'moderate' : 'low'
    };

    // Diabetes complications risk
    if (patientData.diabetic) {
      let diabetesRisk = 0;
      if (patientData.a1c > 9) diabetesRisk += 3;
      else if (patientData.a1c > 8) diabetesRisk += 2;
      else if (patientData.a1c > 7) diabetesRisk += 1;

      if (patientData.duration > 10) diabetesRisk += 2;
      if (patientData.neuropathy) diabetesRisk += 2;
      if (patientData.retinopathy) diabetesRisk += 2;

      risks.diabetesComplications = {
        score: diabetesRisk,
        level: diabetesRisk > 5 ? 'high' : diabetesRisk > 3 ? 'moderate' : 'low'
      };
    }

    return risks;
  }

  /**
   * Format medical data for presentation
   */
  formatMedicalSummary(patientData, intent = 'general') {
    let summary = '';

    if (intent === 'quick') {
      // Brief overview
      summary = `${patientData.name}, ${patientData.age}y
Conditions: ${patientData.conditions.join(', ')}
Last visit: ${patientData.lastVisit}`;

      if (patientData.alerts?.critical?.length > 0) {
        summary += `\n🔴 CRITICAL: ${patientData.alerts.critical[0].message}`;
      }
    } else if (intent === 'detailed') {
      // Full medical summary
      summary = this.generateDetailedSummary(patientData);
    }

    return summary;
  }

  /**
   * Generate detailed medical summary
   */
  generateDetailedSummary(data) {
    let summary = `MEDICAL SUMMARY\n`;
    summary += `${'='.repeat(50)}\n\n`;

    // Demographics
    summary += `PATIENT: ${data.name} (${data.age}y ${data.gender})\n`;
    summary += `MRN: ${data.mrn}\n\n`;

    // Active conditions
    if (data.conditions?.length > 0) {
      summary += `ACTIVE CONDITIONS:\n`;
      data.conditions.forEach(condition => {
        summary += `• ${condition}\n`;
      });
      summary += '\n';
    }

    // Current medications
    if (data.medications?.length > 0) {
      summary += `CURRENT MEDICATIONS:\n`;
      data.medications.slice(0, 5).forEach(med => {
        summary += `• ${med.name} ${med.dosage} - ${med.frequency}\n`;
      });
      if (data.medications.length > 5) {
        summary += `... and ${data.medications.length - 5} more\n`;
      }
      summary += '\n';
    }

    // Recent labs
    if (data.recentLabs?.length > 0) {
      summary += `RECENT LABS:\n`;
      data.recentLabs.slice(0, 5).forEach(lab => {
        summary += `• ${lab.name}: ${lab.value} ${lab.unit || ''}`;
        if (lab.abnormal) summary += ' (ABNORMAL)';
        summary += '\n';
      });
      summary += '\n';
    }

    // Alerts
    if (data.alerts) {
      if (data.alerts.critical?.length > 0) {
        summary += `🔴 CRITICAL ALERTS:\n`;
        data.alerts.critical.forEach(alert => {
          summary += `• ${alert.message}\n`;
        });
        summary += '\n';
      }

      if (data.alerts.high?.length > 0) {
        summary += `🟡 HIGH PRIORITY:\n`;
        data.alerts.high.forEach(alert => {
          summary += `• ${alert.message}\n`;
        });
        summary += '\n';
      }
    }

    return summary;
  }
}

module.exports = new MedicalIntelligenceService();