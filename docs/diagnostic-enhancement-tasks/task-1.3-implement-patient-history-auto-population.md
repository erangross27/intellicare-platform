# Task 1.3: Implement Patient History Auto-Population

## ⚡ **HIGH EFFICIENCY TASK**
**Phase:** 1 (Enhanced Clinical Input)  
**Time Estimate:** 30 minutes  
**Risk Level:** LOW  
**Priority:** HIGH  
**ROI:** IMMEDIATE - 5-10 minutes saved per diagnosis

## 🎯 **Objective**
Automatically populate diagnostic form with relevant patient medical history, current medications, allergies, and previous diagnoses from your existing patient database to eliminate manual data entry.

## 📈 **Clinical Efficiency Benefits**
- **5-10 minutes saved** per diagnosis session
- **Reduced data entry errors** through automation
- **Complete medical context** for better diagnosis accuracy
- **Previous diagnosis correlation** - "Patient had similar symptoms 6 months ago"
- **Medication history integration** - automatic drug interaction checking
- **Chronic condition tracking** - diabetes, hypertension, etc.

## 📁 **Files to Create/Modify**
- `backend/services/patientHistoryService.js` (create new)
- `frontend/components/DiagnosisForm/PatientHistoryLoader.jsx` (create new)
- `backend/services/diagnosticServiceNew.js` (enhance existing)
- `frontend/pages/diagnosis/index.jsx` (modify existing)

## 🔧 **Implementation**

### **Step 1: Create Patient History Service**
```javascript
// backend/services/patientHistoryService.js
class PatientHistoryService {
  constructor() {
    this.relevantHistoryLookback = {
      symptoms: 365, // Look back 1 year for similar symptoms
      medications: 90, // Current medications from last 3 months
      diagnoses: 180, // Recent diagnoses from last 6 months
      allergies: Infinity, // All known allergies
      vitals: 30, // Vital signs from last 30 days
      labResults: 90, // Lab results from last 3 months
      chronicConditions: Infinity // All chronic conditions
    };
  }

  // Main method to get comprehensive patient context
  async getPatientContextForDiagnosis(patientId, practiceId, language = 'en') {
    try {
      const Patient = require('../models/PatientSchemaFactory').getPatientModel(practiceId);
      const Document = require('../models/Document');
      
      const patient = await Patient.findById(patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }

      // Get all relevant medical context
      const context = {
        patient: {
          id: patient._id,
          name: `${patient.firstName} ${patient.lastName}`,
          age: this.calculateAge(patient.dateOfBirth),
          gender: patient.gender,
          dateOfBirth: patient.dateOfBirth
        },
        demographics: await this.getDemographics(patient, language),
        medicalHistory: await this.getMedicalHistory(patient, language),
        currentMedications: await this.getCurrentMedications(patient, language),
        allergies: await this.getAllergies(patient, language),
        recentDiagnoses: await this.getRecentDiagnoses(patientId, practiceId, language),
        similarSymptomHistory: await this.getSimilarSymptomHistory(patientId, practiceId, language),
        chronicConditions: await this.getChronicConditions(patient, language),
        recentVitals: await this.getRecentVitals(patientId, practiceId),
        recentLabResults: await this.getRecentLabResults(patientId, practiceId, language),
        familyHistory: await this.getFamilyHistory(patient, language),
        socialHistory: await this.getSocialHistory(patient, language),
        riskFactors: await this.calculateRiskFactors(patient, language)
      };

      // Generate contextual summary
      context.summary = await this.generateContextualSummary(context, language);
      context.diagnosticRelevance = await this.assessDiagnosticRelevance(context, language);

      return context;

    } catch (error) {
      console.error('Failed to get patient context:', error);
      return this.getMinimalContext(patientId, error.message);
    }
  }

  // Get patient demographics
  async getDemographics(patient, language) {
    const demographics = {
      age: this.calculateAge(patient.dateOfBirth),
      gender: patient.gender,
      country: patient.country || 'IL'
    };

    // Israeli-specific demographics
    if (patient.country === 'IL') {
      demographics.healthFund = patient.healthFund; // קופת חולים
      demographics.nationalId = patient.nationalId ? patient.nationalId.slice(-4) : null; // Last 4 digits only
    }

    // US-specific demographics  
    if (patient.country === 'US') {
      demographics.insuranceProvider = patient.insuranceProvider;
      demographics.socialSecurityLast4 = patient.socialSecurityNumber ? 
        patient.socialSecurityNumber.slice(-4) : null;
    }

    return demographics;
  }

  // Get comprehensive medical history
  async getMedicalHistory(patient, language) {
    const history = {
      chronic: [],
      surgical: [],
      hospitalizations: [],
      pregnancies: [],
      immunizations: []
    };

    // Parse existing medical history
    if (patient.medicalHistory) {
      // Chronic conditions
      if (patient.medicalHistory.chronicConditions) {
        history.chronic = patient.medicalHistory.chronicConditions.map(condition => ({
          condition: condition.name || condition,
          diagnosedDate: condition.diagnosedDate,
          status: condition.status || 'active',
          notes: condition.notes,
          nameHe: language === 'he' ? this.translateCondition(condition.name, 'he') : null
        }));
      }

      // Surgical history
      if (patient.medicalHistory.surgicalHistory) {
        history.surgical = patient.medicalHistory.surgicalHistory.map(surgery => ({
          procedure: surgery.procedure,
          date: surgery.date,
          hospital: surgery.hospital,
          complications: surgery.complications,
          notes: surgery.notes
        }));
      }

      // Extract from medical history text if structured data not available
      if (typeof patient.medicalHistory === 'string') {
        history.textHistory = patient.medicalHistory;
        history.extractedConditions = this.extractConditionsFromText(patient.medicalHistory);
      }
    }

    return history;
  }

  // Get current medications
  async getCurrentMedications(patient, language) {
    const medications = [];
    
    // From structured medication list
    if (patient.currentMedications && Array.isArray(patient.currentMedications)) {
      patient.currentMedications.forEach(med => {
        if (this.isMedicationCurrent(med)) {
          medications.push({
            name: med.name,
            nameHe: language === 'he' ? this.translateMedication(med.name, 'he') : null,
            dosage: med.dosage,
            frequency: med.frequency,
            startDate: med.startDate,
            endDate: med.endDate,
            prescribedBy: med.prescribedBy,
            indication: med.indication,
            notes: med.notes,
            compliance: med.compliance || 'unknown'
          });
        }
      });
    }

    // Extract from medical history text
    if (patient.medicalHistory && typeof patient.medicalHistory === 'string') {
      const extractedMeds = this.extractMedicationsFromText(patient.medicalHistory);
      medications.push(...extractedMeds);
    }

    return medications;
  }

  // Get all allergies
  async getAllergies(patient, language) {
    const allergies = [];

    if (patient.allergies && Array.isArray(patient.allergies)) {
      patient.allergies.forEach(allergy => {
        allergies.push({
          allergen: allergy.allergen || allergy,
          type: allergy.type || 'drug', // drug, food, environmental
          severity: allergy.severity || 'unknown',
          reaction: allergy.reaction,
          dateReported: allergy.dateReported,
          source: allergy.source || 'patient_reported',
          allergenHe: language === 'he' ? this.translateAllergen(allergy.allergen, 'he') : null,
          reactionHe: language === 'he' ? this.translateReaction(allergy.reaction, 'he') : null
        });
      });
    }

    // Extract from medical history
    if (patient.medicalHistory) {
      const extractedAllergies = this.extractAllergiesFromText(
        typeof patient.medicalHistory === 'string' ? 
          patient.medicalHistory : 
          JSON.stringify(patient.medicalHistory)
      );
      allergies.push(...extractedAllergies);
    }

    // Remove duplicates
    return this.deduplicateAllergies(allergies);
  }

  // Get recent diagnoses from previous diagnostic sessions
  async getRecentDiagnoses(patientId, practiceId, language) {
    try {
      // This would query your diagnostic history/session storage
      // Assuming you store diagnostic sessions in a collection
      const DiagnosticSession = require('../models/DiagnosticSession'); // If you have this
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.relevantHistoryLookback.diagnoses);

      const recentSessions = await DiagnosticSession.find({
        patientId,
        practiceId,
        createdAt: { $gte: cutoffDate }
      }).sort({ createdAt: -1 }).limit(10);

      return recentSessions.map(session => ({
        date: session.createdAt,
        primaryDiagnosis: session.primaryDiagnosis,
        confidence: session.confidence,
        symptoms: session.symptoms,
        riskLevel: session.riskLevel,
        prescribedTreatment: session.prescribedTreatment,
        outcome: session.outcome, // If available
        followUpRequired: session.followUpRequired
      }));

    } catch (error) {
      console.log('No recent diagnoses found:', error.message);
      return [];
    }
  }

  // Find similar symptom patterns in patient history
  async getSimilarSymptomHistory(patientId, practiceId, language) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.relevantHistoryLookback.symptoms);

      // This would search through stored diagnostic sessions
      // or medical history for similar symptom patterns
      const similarPatterns = await this.findSimilarSymptomPatterns(patientId, practiceId, cutoffDate);
      
      return similarPatterns.map(pattern => ({
        date: pattern.date,
        symptoms: pattern.symptoms,
        diagnosis: pattern.diagnosis,
        treatment: pattern.treatment,
        outcome: pattern.outcome,
        similarity: pattern.similarity, // 0-1 similarity score
        relevantFindings: pattern.relevantFindings
      }));

    } catch (error) {
      console.log('No similar symptom history found:', error.message);
      return [];
    }
  }

  // Get chronic conditions with current status
  async getChronicConditions(patient, language) {
    const conditions = [];

    if (patient.medicalHistory?.chronicConditions) {
      patient.medicalHistory.chronicConditions.forEach(condition => {
        conditions.push({
          name: condition.name || condition,
          nameHe: language === 'he' ? this.translateCondition(condition.name, 'he') : null,
          status: condition.status || 'active',
          controlLevel: condition.controlLevel, // well-controlled, poorly-controlled
          lastMonitored: condition.lastMonitored,
          relevantMetrics: condition.relevantMetrics, // HbA1c for diabetes, etc.
          complications: condition.complications,
          currentTreatment: condition.currentTreatment,
          diagnosisYear: condition.diagnosisYear
        });
      });
    }

    return conditions;
  }

  // Get recent vital signs
  async getRecentVitals(patientId, practiceId) {
    try {
      // Assuming you have a VitalSigns collection or store vitals somewhere
      const VitalSigns = require('../models/VitalSigns'); // If you have this
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.relevantHistoryLookback.vitals);

      const recentVitals = await VitalSigns.findOne({
        patientId,
        practiceId,
        recordedDate: { $gte: cutoffDate }
      }).sort({ recordedDate: -1 });

      if (recentVitals) {
        return {
          date: recentVitals.recordedDate,
          bloodPressure: {
            systolic: recentVitals.systolic,
            diastolic: recentVitals.diastolic,
            status: this.assessBloodPressure(recentVitals.systolic, recentVitals.diastolic)
          },
          heartRate: {
            value: recentVitals.heartRate,
            status: this.assessHeartRate(recentVitals.heartRate)
          },
          temperature: {
            value: recentVitals.temperature,
            unit: recentVitals.temperatureUnit || 'C',
            status: this.assessTemperature(recentVitals.temperature)
          },
          weight: recentVitals.weight,
          height: recentVitals.height,
          bmi: recentVitals.weight && recentVitals.height ? 
            this.calculateBMI(recentVitals.weight, recentVitals.height) : null,
          oxygenSaturation: recentVitals.oxygenSaturation
        };
      }

      return null;
    } catch (error) {
      console.log('No recent vitals found:', error.message);
      return null;
    }
  }

  // Generate contextual summary for diagnostic use
  async generateContextualSummary(context, language) {
    const summary = {
      clinicallyRelevant: [],
      warningsAndAlerts: [],
      diagnosticClues: [],
      riskFactors: []
    };

    const isHebrew = language === 'he';

    // Clinically relevant conditions
    context.chronicConditions?.forEach(condition => {
      if (condition.status === 'active') {
        summary.clinicallyRelevant.push({
          type: 'chronic_condition',
          text: isHebrew ? 
            `מטופל עם ${condition.nameHe || condition.name} פעיל` :
            `Patient with active ${condition.name}`,
          condition: condition.name,
          relevance: 'high'
        });
      }
    });

    // Allergy warnings
    context.allergies?.forEach(allergy => {
      if (allergy.type === 'drug' && allergy.severity !== 'mild') {
        summary.warningsAndAlerts.push({
          type: 'drug_allergy',
          text: isHebrew ?
            `אלרגיה ל-${allergy.allergenHe || allergy.allergen} (${allergy.severity})` :
            `Allergy to ${allergy.allergen} (${allergy.severity})`,
          allergen: allergy.allergen,
          severity: allergy.severity,
          priority: allergy.severity === 'severe' ? 'critical' : 'high'
        });
      }
    });

    // Recent similar symptoms
    context.similarSymptomHistory?.forEach(pattern => {
      if (pattern.similarity > 0.7) {
        summary.diagnosticClues.push({
          type: 'similar_symptoms',
          text: isHebrew ?
            `תסמינים דומים לפני ${this.formatTimeAgo(pattern.date, 'he')} - ${pattern.diagnosis}` :
            `Similar symptoms ${this.formatTimeAgo(pattern.date, 'en')} ago - ${pattern.diagnosis}`,
          previousDiagnosis: pattern.diagnosis,
          similarity: pattern.similarity,
          relevance: pattern.similarity > 0.8 ? 'high' : 'medium'
        });
      }
    });

    // Risk factors
    if (context.patient.age > 65) {
      summary.riskFactors.push({
        type: 'age',
        text: isHebrew ? 'מטופל מבוגר (>65)' : 'Elderly patient (>65)',
        factor: 'advanced_age',
        relevance: 'medium'
      });
    }

    return summary;
  }

  // Calculate overall diagnostic relevance
  async assessDiagnosticRelevance(context, language) {
    const relevance = {
      overallScore: 0,
      factors: {
        chronicConditions: 0,
        medicationComplexity: 0,
        allergyRisk: 0,
        recentDiagnoses: 0,
        similarSymptoms: 0
      },
      recommendations: []
    };

    // Score chronic conditions
    const activeConditions = context.chronicConditions?.filter(c => c.status === 'active').length || 0;
    relevance.factors.chronicConditions = Math.min(activeConditions * 0.2, 1.0);

    // Score medication complexity
    const medicationCount = context.currentMedications?.length || 0;
    relevance.factors.medicationComplexity = Math.min(medicationCount * 0.1, 1.0);

    // Score allergy risk
    const drugAllergies = context.allergies?.filter(a => a.type === 'drug').length || 0;
    relevance.factors.allergyRisk = Math.min(drugAllergies * 0.3, 1.0);

    // Score recent diagnostic activity
    const recentDiagnosesCount = context.recentDiagnoses?.length || 0;
    relevance.factors.recentDiagnoses = Math.min(recentDiagnosesCount * 0.15, 1.0);

    // Score similar symptoms
    const highSimilarityCount = context.similarSymptomHistory?.filter(s => s.similarity > 0.7).length || 0;
    relevance.factors.similarSymptoms = Math.min(highSimilarityCount * 0.25, 1.0);

    // Calculate overall score
    relevance.overallScore = Object.values(relevance.factors).reduce((sum, score) => sum + score, 0) / 5;

    // Generate recommendations
    if (relevance.factors.allergyRisk > 0.5) {
      relevance.recommendations.push({
        type: 'allergy_caution',
        message: language === 'he' ? 
          'זהירות - מטופל עם אלרגיות תרופתיות מרובות' :
          'Caution - patient with multiple drug allergies'
      });
    }

    if (relevance.factors.chronicConditions > 0.6) {
      relevance.recommendations.push({
        type: 'complex_medical_history',
        message: language === 'he' ?
          'מטופל עם רקע רפואי מורכב - שקול התייעצות' :
          'Patient with complex medical history - consider consultation'
      });
    }

    return relevance;
  }

  // Utility methods
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  isMedicationCurrent(medication) {
    if (!medication.endDate) return true; // No end date means current
    const endDate = new Date(medication.endDate);
    return endDate > new Date();
  }

  formatTimeAgo(date, language) {
    const diff = new Date() - new Date(date);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (language === 'he') {
      if (days < 7) return `${days} ימים`;
      if (days < 30) return `${Math.floor(days / 7)} שבועות`;
      return `${Math.floor(days / 30)} חודשים`;
    } else {
      if (days < 7) return `${days} days`;
      if (days < 30) return `${Math.floor(days / 7)} weeks`;
      return `${Math.floor(days / 30)} months`;
    }
  }

  // Basic translation helpers (would use proper translation service in production)
  translateCondition(condition, language) {
    const translations = {
      'diabetes': 'סכרת',
      'hypertension': 'יתר לחץ דם',
      'asthma': 'אסתמה',
      'depression': 'דיכאון',
      'anxiety': 'חרדה'
    };
    return translations[condition?.toLowerCase()] || condition;
  }

  translateMedication(medication, language) {
    const translations = {
      'metformin': 'מטפורמין',
      'aspirin': 'אספירין',
      'atorvastatin': 'אטורבסטטין',
      'lisinopril': 'ליסינופריל'
    };
    return translations[medication?.toLowerCase()] || medication;
  }

  translateAllergen(allergen, language) {
    const translations = {
      'penicillin': 'פניצילין',
      'aspirin': 'אספירין',
      'iodine': 'יוד',
      'latex': 'לטקס'
    };
    return translations[allergen?.toLowerCase()] || allergen;
  }

  getMinimalContext(patientId, error) {
    return {
      patient: { id: patientId },
      error,
      summary: {
        clinicallyRelevant: [],
        warningsAndAlerts: [{
          type: 'system_error',
          text: 'Unable to load patient history - manual entry required',
          priority: 'medium'
        }],
        diagnosticClues: [],
        riskFactors: []
      }
    };
  }
}

module.exports = new PatientHistoryService();
```

### **Step 2: Create Frontend Patient History Loader**
```jsx
// frontend/components/DiagnosisForm/PatientHistoryLoader.jsx
import React, { useState, useEffect } from 'react';
import styles from './PatientHistoryLoader.module.css';

const PatientHistoryLoader = ({ 
  patientId, 
  practiceId,
  language = 'en',
  onHistoryLoaded,
  onError,
  autoLoad = true 
}) => {
  const [historyContext, setHistoryContext] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (autoLoad && patientId) {
      loadPatientHistory();
    }
  }, [patientId, autoLoad]);

  const loadPatientHistory = async () => {
    if (!patientId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/patients/${patientId}/diagnostic-context`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load patient history');
      }

      const context = await response.json();
      setHistoryContext(context);

      if (onHistoryLoaded) {
        onHistoryLoaded(context);
      }

    } catch (err) {
      console.error('Failed to load patient history:', err);
      setError(err.message);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderLoadingState = () => (
    <div className={styles.loadingState}>
      <div className={styles.spinner}>
        <div className={styles.spinnerIcon}>📋</div>
        <span>
          {language === 'he' ? 
            'טוען היסטוריה רפואית...' : 
            'Loading patient history...'}
        </span>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <div className={styles.errorState}>
      <span className={styles.errorIcon}>⚠️</span>
      <span className={styles.errorMessage}>
        {language === 'he' ? 
          'שגיאה בטעינת היסטוריה רפואית' : 
          'Error loading patient history'}
      </span>
      <button 
        className={styles.retryBtn}
        onClick={loadPatientHistory}
      >
        {language === 'he' ? 'נסה שוב' : 'Retry'}
      </button>
    </div>
  );

  const renderHistoryContext = () => {
    if (!historyContext) return null;

    const { patient, summary, demographics, chronicConditions, currentMedications, allergies } = historyContext;

    return (
      <div className={styles.historyContext}>
        {/* Patient Summary */}
        <div className={styles.patientSummary}>
          <div className={styles.patientHeader}>
            <h3>
              {patient.name} ({demographics.age} {language === 'he' ? 'שנים' : 'years old'})
            </h3>
            <button
              className={styles.detailsToggle}
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 
                (language === 'he' ? 'הסתר פרטים' : 'Hide Details') :
                (language === 'he' ? 'הצג פרטים' : 'Show Details')
              }
            </button>
          </div>
        </div>

        {/* Clinical Alerts */}
        {summary?.warningsAndAlerts?.length > 0 && (
          <div className={styles.alertsSection}>
            <h4 className={styles.sectionTitle}>
              🚨 {language === 'he' ? 'התראות קליניות' : 'Clinical Alerts'}
            </h4>
            {summary.warningsAndAlerts.map((alert, index) => (
              <div 
                key={index} 
                className={`${styles.alert} ${styles[alert.priority || 'medium']}`}
              >
                <span className={styles.alertText}>{alert.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quick Summary */}
        <div className={styles.quickSummary}>
          <div className={styles.summaryGrid}>
            {/* Chronic Conditions */}
            {chronicConditions?.length > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  {language === 'he' ? 'מצבים כרוניים:' : 'Chronic Conditions:'}
                </span>
                <span className={styles.summaryValue}>
                  {chronicConditions.slice(0, 2).map(c => c.name).join(', ')}
                  {chronicConditions.length > 2 && ` +${chronicConditions.length - 2}`}
                </span>
              </div>
            )}

            {/* Current Medications */}
            {currentMedications?.length > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  {language === 'he' ? 'תרופות נוכחיות:' : 'Current Medications:'}
                </span>
                <span className={styles.summaryValue}>
                  {currentMedications.slice(0, 2).map(m => m.name).join(', ')}
                  {currentMedications.length > 2 && ` +${currentMedications.length - 2}`}
                </span>
              </div>
            )}

            {/* Allergies */}
            {allergies?.length > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  {language === 'he' ? 'אלרגיות:' : 'Allergies:'}
                </span>
                <span className={styles.summaryValue}>
                  {allergies.slice(0, 2).map(a => a.allergen).join(', ')}
                  {allergies.length > 2 && ` +${allergies.length - 2}`}
                </span>
              </div>
            )}

            {/* Demographics */}
            {demographics?.healthFund && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  {language === 'he' ? 'קופת חולים:' : 'Health Fund:'}
                </span>
                <span className={styles.summaryValue}>
                  {demographics.healthFund}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Detailed History (expandable) */}
        {showDetails && (
          <div className={styles.detailedHistory}>
            {/* Diagnostic Clues */}
            {summary?.diagnosticClues?.length > 0 && (
              <div className={styles.diagnosticClues}>
                <h4 className={styles.sectionTitle}>
                  🔍 {language === 'he' ? 'רמזים אבחוניים' : 'Diagnostic Clues'}
                </h4>
                {summary.diagnosticClues.map((clue, index) => (
                  <div key={index} className={styles.diagnosticClue}>
                    <span className={styles.clueText}>{clue.text}</span>
                    <span className={`${styles.relevanceBadge} ${styles[clue.relevance]}`}>
                      {clue.relevance}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Current Medications Detail */}
            {currentMedications?.length > 0 && (
              <div className={styles.medicationsDetail}>
                <h4 className={styles.sectionTitle}>
                  💊 {language === 'he' ? 'תרופות נוכחיות (מפורט)' : 'Current Medications (Detailed)'}
                </h4>
                {currentMedications.map((med, index) => (
                  <div key={index} className={styles.medicationItem}>
                    <div className={styles.medicationName}>
                      {language === 'he' && med.nameHe ? med.nameHe : med.name}
                    </div>
                    <div className={styles.medicationDetails}>
                      {med.dosage && <span className={styles.dosage}>{med.dosage}</span>}
                      {med.frequency && <span className={styles.frequency}>{med.frequency}</span>}
                      {med.indication && (
                        <span className={styles.indication}>
                          {language === 'he' ? 'לטיפול ב:' : 'For:'} {med.indication}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Risk Factors */}
            {summary?.riskFactors?.length > 0 && (
              <div className={styles.riskFactors}>
                <h4 className={styles.sectionTitle}>
                  ⚠️ {language === 'he' ? 'גורמי סיכון' : 'Risk Factors'}
                </h4>
                {summary.riskFactors.map((risk, index) => (
                  <div key={index} className={styles.riskFactor}>
                    <span className={styles.riskText}>{risk.text}</span>
                    <span className={`${styles.relevanceBadge} ${styles[risk.relevance]}`}>
                      {risk.relevance}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Auto-Population Actions */}
        <div className={styles.autoPopulateActions}>
          <button 
            className={styles.autoFillBtn}
            onClick={() => onHistoryLoaded && onHistoryLoaded(historyContext, true)}
          >
            {language === 'he' ? 
              '🤖 מלא אוטומטית את הטופס' : 
              '🤖 Auto-Fill Form'}
          </button>
          <span className={styles.autoFillHint}>
            {language === 'he' ? 
              'יעביר את המידע הרלוונטי לטופס האבחון' :
              'Will transfer relevant information to diagnosis form'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.patientHistoryLoader}>
      {isLoading && renderLoadingState()}
      {error && renderErrorState()}
      {!isLoading && !error && historyContext && renderHistoryContext()}
      
      {!autoLoad && !historyContext && !isLoading && (
        <div className={styles.manualLoad}>
          <button 
            className={styles.loadBtn}
            onClick={loadPatientHistory}
          >
            {language === 'he' ? 
              '📋 טען היסטוריה רפואית' : 
              '📋 Load Patient History'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientHistoryLoader;
```

### **Step 3: Backend API Route**
```javascript
// backend/routes/patients.js - Add this route
const patientHistoryService = require('../services/patientHistoryService');

// Get patient diagnostic context
router.get('/:id/diagnostic-context', [practiceAuth, practiceContext], async (req, res) => {
  try {
    const patientId = req.params.id;
    const practiceId = req.practice._id;
    const language = req.query.language || 'en';

    const context = await patientHistoryService.getPatientContextForDiagnosis(
      patientId,
      practiceId,
      language
    );

    res.json(context);
  } catch (error) {
    console.error('Failed to get patient diagnostic context:', error);
    res.status(500).json({
      error: 'Failed to load patient diagnostic context',
      message: error.message
    });
  }
});
```

### **Step 4: Enhanced Diagnostic Service Integration**
```javascript
// backend/services/diagnosticServiceNew.js - Add this method
async getComprehensiveDiagnosisWithPatientContext(symptoms, age, gender, history, patientContext, language = 'en') {
  try {
    // Enhance the prompt with patient context
    const contextualPrompt = this.createContextualPrompt(symptoms, age, gender, history, patientContext, language);
    
    // Get base diagnosis
    const diagnosis = await this.getComprehensiveDiagnosis(symptoms, age, gender, contextualPrompt, language);
    
    // Add context-aware insights
    diagnosis.contextualInsights = await this.generateContextualInsights(diagnosis, patientContext, language);
    
    // Modify recommendations based on patient history
    diagnosis.contextAwareRecommendations = await this.adjustRecommendationsForContext(
      diagnosis,
      patientContext,
      language
    );
    
    return diagnosis;
    
  } catch (error) {
    console.error('Contextual diagnosis failed:', error);
    throw error;
  }
}

createContextualPrompt(symptoms, age, gender, history, patientContext, language) {
  const isHebrew = language === 'he';
  
  let contextualInfo = '';
  
  // Add chronic conditions context
  if (patientContext.chronicConditions?.length > 0) {
    const conditions = patientContext.chronicConditions.map(c => c.name).join(', ');
    contextualInfo += isHebrew ? 
      `מצבים כרוניים ידועים: ${conditions}. ` :
      `Known chronic conditions: ${conditions}. `;
  }
  
  // Add current medications context
  if (patientContext.currentMedications?.length > 0) {
    const medications = patientContext.currentMedications.map(m => m.name).join(', ');
    contextualInfo += isHebrew ?
      `תרופות נוכחיות: ${medications}. ` :
      `Current medications: ${medications}. `;
  }
  
  // Add allergy warnings
  if (patientContext.allergies?.length > 0) {
    const allergies = patientContext.allergies.map(a => a.allergen).join(', ');
    contextualInfo += isHebrew ?
      `אלרגיות ידועות: ${allergies}. ` :
      `Known allergies: ${allergies}. `;
  }
  
  // Add similar symptom history
  if (patientContext.similarSymptomHistory?.length > 0) {
    const recentSimilar = patientContext.similarSymptomHistory[0];
    contextualInfo += isHebrew ?
      `תסמינים דומים בעבר: ${recentSimilar.diagnosis} (${recentSimilar.date}). ` :
      `Previous similar symptoms: ${recentSimilar.diagnosis} (${recentSimilar.date}). `;
  }
  
  const enhancedHistory = `${history}\n\nCONTEXT: ${contextualInfo}`;
  
  return enhancedHistory;
}
```

### **Step 5: Frontend Integration**
```jsx
// frontend/pages/diagnosis/index.jsx - Integrate the history loader
import PatientHistoryLoader from '../../components/DiagnosisForm/PatientHistoryLoader';

const DiagnosisPage = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientContext, setPatientContext] = useState(null);
  const [formData, setFormData] = useState({
    symptoms: '',
    age: '',
    gender: '',
    history: ''
  });

  const handlePatientHistoryLoaded = (context, autoFill = false) => {
    setPatientContext(context);
    
    if (autoFill) {
      // Auto-populate form with patient data
      const contextualHistory = generateContextualHistory(context);
      
      setFormData(prev => ({
        ...prev,
        age: context.patient.age || prev.age,
        gender: context.patient.gender || prev.gender,
        history: contextualHistory
      }));
    }
  };

  const generateContextualHistory = (context) => {
    const parts = [];
    
    // Add chronic conditions
    if (context.chronicConditions?.length > 0) {
      const conditions = context.chronicConditions.map(c => c.name).join(', ');
      parts.push(`Chronic conditions: ${conditions}`);
    }
    
    // Add current medications
    if (context.currentMedications?.length > 0) {
      const medications = context.currentMedications.map(m => 
        `${m.name} ${m.dosage} ${m.frequency}`
      ).join(', ');
      parts.push(`Current medications: ${medications}`);
    }
    
    // Add allergies
    if (context.allergies?.length > 0) {
      const allergies = context.allergies.map(a => a.allergen).join(', ');
      parts.push(`Allergies: ${allergies}`);
    }
    
    return parts.join('. ');
  };

  return (
    <div className="diagnosis-page">
      {/* Patient Selection */}
      <PatientSelector 
        onPatientSelected={setSelectedPatient}
      />
      
      {/* Patient History Loader */}
      {selectedPatient && (
        <PatientHistoryLoader
          patientId={selectedPatient.id}
          practiceId={practice.id}
          language={language}
          onHistoryLoaded={handlePatientHistoryLoaded}
          autoLoad={true}
        />
      )}
      
      {/* Rest of diagnosis form */}
      <DiagnosisForm 
        formData={formData}
        setFormData={setFormData}
        patientContext={patientContext}
        // ... other props
      />
    </div>
  );
};
```

## ✅ **Success Criteria**
- [ ] Automatic patient history loading when patient selected
- [ ] 5-10 minutes saved per diagnosis through auto-population
- [ ] Integration with existing patient database
- [ ] Clinical alerts for allergies and drug interactions
- [ ] Similar symptom history detection working
- [ ] Hebrew/English bilingual context display

## 🔄 **Next Task**
Proceed to: **Task 1.4:** Add Voice-to-Text Input

## 📝 **Integration Notes**
- Builds on your existing patient database structure
- Leverages your practice-based multi-tenancy
- Integrates with קופת חולים data you already have
- Maintains privacy and security standards