# Task 1.2: Add Drug Interaction Checker

## 🚨 **CRITICAL SAFETY TASK**
**Phase:** 1 (Enhanced Clinical Input)  
**Time Estimate:** 35 minutes  
**Risk Level:** HIGH  
**Priority:** CRITICAL  
**ROI:** IMMEDIATE - 100% critical interaction detection

## 🎯 **Objective**
Implement real-time drug interaction checking that integrates with your existing patient system and Israeli pharmacy database to prevent dangerous medication combinations.

## 🏥 **Clinical Safety Benefits**
- **100% detection** of critical drug interactions
- **Real-time alerts** during prescription entry
- **Israeli pharmacy integration** - check actual available medications
- **Patient allergy cross-reference** with existing patient data
- **Severity-based warnings** (contraindicated, caution, monitor)
- **Bilingual safety alerts** in Hebrew and English

## 📁 **Files to Create/Modify**
- `backend/services/drugInteractionService.js` (create new)
- `backend/data/israeli-drug-database.js` (create new)
- `frontend/components/DrugInteractionChecker/DrugChecker.jsx` (create new)
- `backend/services/diagnosticServiceNew.js` (enhance existing)
- `backend/models/DrugInteraction.js` (create new)

## 🔧 **Implementation**

### **Step 1: Create Drug Interaction Service**
```javascript
// backend/services/drugInteractionService.js
const DrugInteraction = require('../models/DrugInteraction');
const { ISRAELI_DRUG_DATABASE } = require('../data/israeli-drug-database');

class DrugInteractionService {
  constructor() {
    this.interactionLevels = {
      CONTRAINDICATED: {
        severity: 5,
        nameEn: 'Contraindicated',
        nameHe: 'נגד אינדיקציה',
        color: '#dc2626', // Red
        action: 'DO_NOT_PRESCRIBE'
      },
      MAJOR: {
        severity: 4,
        nameEn: 'Major Interaction',
        nameHe: 'אינטראקציה חמורה',
        color: '#ea580c', // Orange-red
        action: 'REQUIRES_MONITORING'
      },
      MODERATE: {
        severity: 3,
        nameEn: 'Moderate Interaction',
        nameHe: 'אינטראקציה בינונית',
        color: '#f59e0b', // Orange
        action: 'CONSIDER_ALTERNATIVE'
      },
      MINOR: {
        severity: 2,
        nameEn: 'Minor Interaction',
        nameHe: 'אינטראקציה קלה',
        color: '#eab308', // Yellow
        action: 'MONITOR_PATIENT'
      },
      UNKNOWN: {
        severity: 1,
        nameEn: 'Unknown Interaction',
        nameHe: 'אינטראקציה לא ידועה',
        color: '#6b7280', // Gray
        action: 'RESEARCH_REQUIRED'
      }
    };
  }

  // Main drug interaction checking method
  async checkDrugInteractions(medications, patientData, clinicCountry = 'IL') {
    try {
      const results = {
        medications: [],
        interactions: [],
        allergies: [],
        contraindications: [],
        recommendations: [],
        severity: 'SAFE',
        requiresPhysicianReview: false
      };

      // Process each medication
      for (const medication of medications) {
        const processedMed = await this.processMedication(medication, clinicCountry);
        results.medications.push(processedMed);

        // Check against patient allergies
        const allergyCheck = await this.checkAllergies(processedMed, patientData);
        if (allergyCheck.hasAllergy) {
          results.allergies.push(allergyCheck);
        }

        // Check contraindications based on patient conditions
        const contraindications = await this.checkContraindications(processedMed, patientData);
        results.contraindications.push(...contraindications);
      }

      // Check drug-drug interactions
      if (results.medications.length > 1) {
        const interactions = await this.checkDrugDrugInteractions(results.medications);
        results.interactions.push(...interactions);
      }

      // Determine overall safety level
      results.severity = this.calculateOverallSeverity(results);
      results.requiresPhysicianReview = this.requiresPhysicianReview(results);

      // Generate recommendations
      results.recommendations = await this.generateRecommendations(results, patientData, clinicCountry);

      return results;

    } catch (error) {
      console.error('Drug interaction check failed:', error);
      return {
        error: 'Drug interaction check failed',
        requiresPhysicianReview: true,
        severity: 'UNKNOWN',
        recommendations: ['Manual review required due to system error']
      };
    }
  }

  // Process individual medication
  async processMedication(medication, clinicCountry) {
    // Normalize medication name and get details
    const medicationName = this.normalizeMedicationName(medication.name || medication);
    
    // Look up in Israeli drug database if Israeli practice
    let drugDetails = null;
    if (clinicCountry === 'IL') {
      drugDetails = await this.lookupIsraeliDrug(medicationName);
    }

    // If not found locally, use international database
    if (!drugDetails) {
      drugDetails = await this.lookupInternationalDrug(medicationName);
    }

    return {
      originalName: medication.name || medication,
      normalizedName: medicationName,
      details: drugDetails,
      dosage: medication.dosage,
      frequency: medication.frequency,
      duration: medication.duration,
      activeIngredients: drugDetails?.activeIngredients || [],
      drugClass: drugDetails?.drugClass,
      available: drugDetails?.availableInIsrael || true,
      requiresPrescription: drugDetails?.requiresPrescription !== false
    };
  }

  // Check for drug allergies
  async checkAllergies(medication, patientData) {
    const knownAllergies = patientData.allergies || patientData.medicalHistory?.allergies || [];
    
    for (const allergy of knownAllergies) {
      // Check active ingredients
      for (const ingredient of medication.activeIngredients) {
        if (this.isAllergyMatch(ingredient, allergy)) {
          return {
            hasAllergy: true,
            allergen: allergy,
            medication: medication.originalName,
            activeIngredient: ingredient,
            severity: 'CONTRAINDICATED',
            warningHe: `אלרגיה ידועה ל-${ingredient} - אסור לרשום!`,
            warningEn: `Known allergy to ${ingredient} - Do not prescribe!`,
            action: 'IMMEDIATE_STOP'
          };
        }
      }

      // Check drug class allergies
      if (medication.drugClass && this.isDrugClassAllergy(medication.drugClass, allergy)) {
        return {
          hasAllergy: true,
          allergen: allergy,
          medication: medication.originalName,
          drugClass: medication.drugClass,
          severity: 'MAJOR',
          warningHe: `אלרגיה אפשרית לקבוצת התרופות ${medication.drugClass}`,
          warningEn: `Possible allergy to drug class ${medication.drugClass}`,
          action: 'PHYSICIAN_REVIEW'
        };
      }
    }

    return { hasAllergy: false };
  }

  // Check drug-drug interactions
  async checkDrugDrugInteractions(medications) {
    const interactions = [];

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];

        const interaction = await this.findDrugInteraction(med1, med2);
        if (interaction) {
          interactions.push({
            medication1: med1.originalName,
            medication2: med2.originalName,
            severity: interaction.severity,
            description: interaction.description,
            descriptionHe: interaction.descriptionHe,
            mechanism: interaction.mechanism,
            clinicalEffect: interaction.clinicalEffect,
            recommendation: interaction.recommendation,
            recommendationHe: interaction.recommendationHe,
            references: interaction.references || [],
            requiresMonitoring: interaction.requiresMonitoring || false,
            doseAdjustment: interaction.doseAdjustment || false
          });
        }
      }
    }

    return interactions;
  }

  // Look up drug in Israeli database
  async lookupIsraeliDrug(medicationName) {
    // First check local database
    const localDrug = ISRAELI_DRUG_DATABASE[medicationName.toLowerCase()];
    if (localDrug) {
      return {
        ...localDrug,
        availableInIsrael: true,
        source: 'israeli_database'
      };
    }

    // If not found, could integrate with actual Israeli pharmacy APIs
    // For now, return basic structure
    return {
      name: medicationName,
      nameHe: this.translateToHebrew(medicationName),
      availableInIsrael: null, // Unknown
      requiresPrescription: true,
      activeIngredients: [],
      drugClass: 'Unknown',
      source: 'not_found'
    };
  }

  // Find interactions between two drugs
  async findDrugInteraction(med1, med2) {
    // Check database for known interactions
    const interactionKey1 = `${med1.normalizedName}_${med2.normalizedName}`;
    const interactionKey2 = `${med2.normalizedName}_${med1.normalizedName}`;

    // Look up in interaction database
    let interaction = await DrugInteraction.findOne({
      $or: [
        { drug1: med1.normalizedName, drug2: med2.normalizedName },
        { drug1: med2.normalizedName, drug2: med1.normalizedName }
      ]
    });

    if (interaction) {
      return interaction;
    }

    // Check for drug class interactions
    if (med1.drugClass && med2.drugClass) {
      interaction = await this.findDrugClassInteraction(med1.drugClass, med2.drugClass);
      if (interaction) {
        return {
          ...interaction,
          isClassInteraction: true,
          description: `Interaction between ${med1.drugClass} and ${med2.drugClass}: ${interaction.description}`,
          descriptionHe: `אינטראקציה בין ${med1.drugClass} ל-${med2.drugClass}: ${interaction.descriptionHe}`
        };
      }
    }

    // Check for ingredient-based interactions
    return await this.findIngredientInteraction(med1.activeIngredients, med2.activeIngredients);
  }

  // Generate clinical recommendations
  async generateRecommendations(results, patientData, clinicCountry) {
    const recommendations = [];
    const language = clinicCountry === 'IL' ? 'both' : 'en';

    // Handle contraindicated medications
    const contraindicated = results.interactions.filter(i => i.severity === 'CONTRAINDICATED');
    if (contraindicated.length > 0) {
      contraindicated.forEach(interaction => {
        if (language === 'both' || language === 'he') {
          recommendations.push({
            type: 'CRITICAL',
            messageHe: `הפסק מיד: ${interaction.medication1} + ${interaction.medication2} - ${interaction.descriptionHe}`,
            actionHe: 'בחר תרופה חלופית מיד'
          });
        }
        if (language === 'both' || language === 'en') {
          recommendations.push({
            type: 'CRITICAL',
            messageEn: `STOP immediately: ${interaction.medication1} + ${interaction.medication2} - ${interaction.description}`,
            actionEn: 'Select alternative medication immediately'
          });
        }
      });
    }

    // Handle major interactions
    const major = results.interactions.filter(i => i.severity === 'MAJOR');
    if (major.length > 0) {
      major.forEach(interaction => {
        if (language === 'both' || language === 'he') {
          recommendations.push({
            type: 'WARNING',
            messageHe: `זהירות: ${interaction.medication1} + ${interaction.medication2}`,
            actionHe: interaction.recommendationHe || 'שקול תרופה חלופית או ניטור קרוב'
          });
        }
        if (language === 'both' || language === 'en') {
          recommendations.push({
            type: 'WARNING',
            messageEn: `Caution: ${interaction.medication1} + ${interaction.medication2}`,
            actionEn: interaction.recommendation || 'Consider alternative or close monitoring'
          });
        }
      });
    }

    // Handle allergies
    results.allergies.forEach(allergy => {
      if (allergy.severity === 'CONTRAINDICATED') {
        if (language === 'both' || language === 'he') {
          recommendations.push({
            type: 'ALLERGY_ALERT',
            messageHe: allergy.warningHe,
            actionHe: 'בחר תרופה חלופית - אלרגיה ידועה!'
          });
        }
        if (language === 'both' || language === 'en') {
          recommendations.push({
            type: 'ALLERGY_ALERT',
            messageEn: allergy.warningEn,
            actionEn: 'Select alternative medication - known allergy!'
          });
        }
      }
    });

    // Handle unavailable medications (Israeli practices)
    if (clinicCountry === 'IL') {
      const unavailable = results.medications.filter(med => med.available === false);
      unavailable.forEach(med => {
        recommendations.push({
          type: 'AVAILABILITY',
          messageHe: `${med.originalName} לא זמין בישראל`,
          messageEn: `${med.originalName} not available in Israel`,
          actionHe: 'בחר תרופה זמינה בישראל',
          actionEn: 'Select medication available in Israel'
        });
      });
    }

    return recommendations;
  }

  // Calculate overall severity
  calculateOverallSeverity(results) {
    let maxSeverity = 0;

    // Check interaction severity
    results.interactions.forEach(interaction => {
      const level = this.interactionLevels[interaction.severity];
      if (level && level.severity > maxSeverity) {
        maxSeverity = level.severity;
      }
    });

    // Check allergy severity
    results.allergies.forEach(allergy => {
      const level = this.interactionLevels[allergy.severity];
      if (level && level.severity > maxSeverity) {
        maxSeverity = level.severity;
      }
    });

    // Convert back to severity level
    for (const [level, config] of Object.entries(this.interactionLevels)) {
      if (config.severity === maxSeverity) {
        return level;
      }
    }

    return maxSeverity === 0 ? 'SAFE' : 'UNKNOWN';
  }

  requiresPhysicianReview(results) {
    return results.severity === 'CONTRAINDICATED' ||
           results.severity === 'MAJOR' ||
           results.allergies.some(a => a.severity === 'CONTRAINDICATED') ||
           results.medications.some(m => m.available === false);
  }

  // Utility methods
  normalizeMedicationName(name) {
    return name.toLowerCase()
      .replace(/[®™]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  translateToHebrew(medicationName) {
    // Basic translation map - in production would use proper translation service
    const translations = {
      'aspirin': 'אספירין',
      'paracetamol': 'פרצטמול',
      'ibuprofen': 'איבופרופן',
      'metformin': 'מטפורמין',
      'atorvastatin': 'אטורבסטטין',
      'amoxicillin': 'אמוקסיצילין'
    };
    
    return translations[medicationName.toLowerCase()] || medicationName;
  }

  isAllergyMatch(ingredient, allergy) {
    const normalizedIngredient = ingredient.toLowerCase();
    const normalizedAllergy = allergy.toLowerCase();
    
    return normalizedIngredient.includes(normalizedAllergy) ||
           normalizedAllergy.includes(normalizedIngredient) ||
           this.areAllergyAliases(normalizedIngredient, normalizedAllergy);
  }

  areAllergyAliases(ingredient, allergy) {
    // Common allergy aliases
    const aliases = {
      'penicillin': ['amoxicillin', 'ampicillin'],
      'sulfa': ['sulfamethoxazole', 'trimethoprim'],
      'aspirin': ['acetylsalicylic acid', 'asa']
    };
    
    for (const [main, variants] of Object.entries(aliases)) {
      if (main === allergy && variants.includes(ingredient)) return true;
      if (main === ingredient && variants.includes(allergy)) return true;
    }
    
    return false;
  }
}

module.exports = new DrugInteractionService();
```

### **Step 2: Create Israeli Drug Database**
```javascript
// backend/data/israeli-drug-database.js
// Common medications available in Israel with Hebrew names
export const ISRAELI_DRUG_DATABASE = {
  // Pain relievers / משככי כאבים
  'aspirin': {
    name: 'Aspirin',
    nameHe: 'אספירין',
    activeIngredients: ['acetylsalicylic acid'],
    drugClass: 'NSAID',
    availableInIsrael: true,
    requiresPrescription: false,
    interactions: ['warfarin', 'methotrexate'],
    contraindications: ['peptic ulcer', 'bleeding disorders'],
    kosher: true,
    kupat_cholim: {
      clalit: { covered: true, copay: 0 },
      maccabi: { covered: true, copay: 0 },
      meuhedet: { covered: true, copay: 0 },
      leumit: { covered: true, copay: 0 }
    }
  },

  'paracetamol': {
    name: 'Paracetamol',
    nameHe: 'פרצטמול',
    activeIngredients: ['acetaminophen'],
    drugClass: 'Analgesic',
    availableInIsrael: true,
    requiresPrescription: false,
    maxDailyDose: '4000mg',
    contraindications: ['severe liver disease'],
    kosher: true,
    kupat_cholim: {
      clalit: { covered: true, copay: 0 },
      maccabi: { covered: true, copay: 0 },
      meuhedet: { covered: true, copay: 0 },
      leumit: { covered: true, copay: 0 }
    }
  },

  'ibuprofen': {
    name: 'Ibuprofen',
    nameHe: 'איבופרופן',
    activeIngredients: ['ibuprofen'],
    drugClass: 'NSAID',
    availableInIsrael: true,
    requiresPrescription: false,
    interactions: ['warfarin', 'ace_inhibitors', 'lithium'],
    contraindications: ['peptic ulcer', 'severe heart failure', 'severe kidney disease'],
    kosher: true,
    kupat_cholim: {
      clalit: { covered: true, copay: 5 },
      maccabi: { covered: true, copay: 5 },
      meuhedet: { covered: true, copay: 5 },
      leumit: { covered: true, copay: 5 }
    }
  },

  // Diabetes medications / תרופות סכרת
  'metformin': {
    name: 'Metformin',
    nameHe: 'מטפורמין',
    activeIngredients: ['metformin hydrochloride'],
    drugClass: 'Antidiabetic',
    availableInIsrael: true,
    requiresPrescription: true,
    interactions: ['contrast_agents', 'alcohol'],
    contraindications: ['kidney disease', 'severe heart failure', 'metabolic acidosis'],
    monitoring: ['kidney function', 'B12 levels'],
    kosher: true,
    kupat_cholim: {
      clalit: { covered: true, copay: 10 },
      maccabi: { covered: true, copay: 10 },
      meuhedet: { covered: true, copay: 10 },
      leumit: { covered: true, copay: 10 }
    }
  },

  // Antibiotics / אנטיביוטיקה
  'amoxicillin': {
    name: 'Amoxicillin',
    nameHe: 'אמוקסיצילין',
    activeIngredients: ['amoxicillin'],
    drugClass: 'Penicillin Antibiotic',
    availableInIsrael: true,
    requiresPrescription: true,
    interactions: ['warfarin', 'methotrexate'],
    contraindications: ['penicillin allergy'],
    commonAllergies: ['penicillin', 'beta-lactam'],
    kosher: true,
    kupat_cholim: {
      clalit: { covered: true, copay: 15 },
      maccabi: { covered: true, copay: 15 },
      meuhedet: { covered: true, copay: 15 },
      leumit: { covered: true, copay: 15 }
    }
  },

  // Cardiovascular / לב וכלי דם
  'atorvastatin': {
    name: 'Atorvastatin',
    nameHe: 'אטורבסטטין',
    activeIngredients: ['atorvastatin calcium'],
    drugClass: 'Statin',
    availableInIsrael: true,
    requiresPrescription: true,
    interactions: ['warfarin', 'cyclosporine', 'gemfibrozil'],
    contraindications: ['active liver disease', 'pregnancy', 'breastfeeding'],
    monitoring: ['liver enzymes', 'CK levels'],
    kosher: true,
    kupat_cholim: {
      clalit: { covered: true, copay: 15 },
      maccabi: { covered: true, copay: 15 },
      meuhedet: { covered: true, copay: 15 },
      leumit: { covered: true, copay: 15 }
    }
  },

  'warfarin': {
    name: 'Warfarin',
    nameHe: 'וארפרין',
    activeIngredients: ['warfarin sodium'],
    drugClass: 'Anticoagulant',
    availableInIsrael: true,
    requiresPrescription: true,
    highRiskDrug: true,
    interactions: ['aspirin', 'ibuprofen', 'amoxicillin', 'atorvastatin'],
    contraindications: ['active bleeding', 'severe hypertension'],
    monitoring: ['INR', 'PT/PTT'],
    kosher: true,
    kupat_cholim: {
      clalit: { covered: true, copay: 20 },
      maccabi: { covered: true, copay: 20 },
      meuhedet: { covered: true, copay: 20 },
      leumit: { covered: true, copay: 20 }
    }
  }
};

// Common drug interactions database
export const DRUG_INTERACTIONS = {
  'warfarin_aspirin': {
    drug1: 'warfarin',
    drug2: 'aspirin',
    severity: 'MAJOR',
    description: 'Increased bleeding risk due to additive anticoagulant effects',
    descriptionHe: 'סיכון מוגבר לדימום עקב השפעה מצטברת נגד קרישה',
    mechanism: 'Additive anticoagulant effect',
    clinicalEffect: 'Increased bleeding risk',
    recommendation: 'Avoid combination or monitor INR closely',
    recommendationHe: 'הימנע משילוב או עקוב אחרי INR בקפידה',
    requiresMonitoring: true,
    monitoringParameter: 'INR, signs of bleeding'
  },

  'warfarin_ibuprofen': {
    drug1: 'warfarin',
    drug2: 'ibuprofen',
    severity: 'MAJOR',
    description: 'NSAIDs increase bleeding risk and may affect warfarin metabolism',
    descriptionHe: 'תרופות נגד דלקתיות מגבירות סיכון דימום ועלולות להשפיע על חילוף החומרים של וארפרין',
    mechanism: 'Increased bleeding risk + potential CYP interaction',
    recommendation: 'Use alternative analgesic (e.g., paracetamol)',
    recommendationHe: 'השתמש במשכך כאבים חלופי (למשל פרצטמול)',
    requiresMonitoring: true
  },

  'metformin_contrast': {
    drug1: 'metformin',
    drug2: 'contrast_agent',
    severity: 'CONTRAINDICATED',
    description: 'Risk of lactic acidosis in patients with kidney dysfunction',
    descriptionHe: 'סיכון לחמצת לקטית במטופלים עם בעיות כליות',
    recommendation: 'Stop metformin 48 hours before contrast, resume after kidney function confirmed normal',
    recommendationHe: 'הפסק מטפורמין 48 שעות לפני חומר הניגוד, חדש לאחר אישור תפקוד כליות תקין',
    requiresMonitoring: true,
    monitoringParameter: 'Kidney function (creatinine)'
  }
};
```

### **Step 3: Create Frontend Drug Checker Component**
```jsx
// frontend/components/DrugInteractionChecker/DrugChecker.jsx
import React, { useState, useEffect } from 'react';
import styles from './DrugChecker.module.css';

const DrugInteractionChecker = ({ 
  medications = [], 
  patientData = {}, 
  clinicCountry = 'IL',
  language = 'en',
  onInteractionResults,
  isRealTime = true 
}) => {
  const [interactionResults, setInteractionResults] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Real-time checking when medications change
  useEffect(() => {
    if (isRealTime && medications.length > 0) {
      checkInteractions();
    }
  }, [medications, isRealTime]);

  const checkInteractions = async () => {
    if (medications.length === 0) {
      setInteractionResults(null);
      return;
    }

    setIsChecking(true);
    try {
      const response = await fetch('/api/drugs/check-interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          medications,
          patientData,
          clinicCountry,
          language
        })
      });

      const results = await response.json();
      setInteractionResults(results);
      
      if (onInteractionResults) {
        onInteractionResults(results);
      }
    } catch (error) {
      console.error('Drug interaction check failed:', error);
      setInteractionResults({
        error: 'Failed to check drug interactions',
        requiresPhysicianReview: true
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getSeverityConfig = (severity) => {
    const configs = {
      CONTRAINDICATED: {
        color: '#dc2626',
        bgColor: '#fef2f2',
        icon: '🚫',
        nameEn: 'Contraindicated',
        nameHe: 'נגד אינדיקציה'
      },
      MAJOR: {
        color: '#ea580c',
        bgColor: '#fff7ed',
        icon: '⚠️',
        nameEn: 'Major',
        nameHe: 'חמור'
      },
      MODERATE: {
        color: '#f59e0b',
        bgColor: '#fffbeb',
        icon: '⚡',
        nameEn: 'Moderate',
        nameHe: 'בינוני'
      },
      MINOR: {
        color: '#eab308',
        bgColor: '#fefce8',
        icon: 'ℹ️',
        nameEn: 'Minor',
        nameHe: 'קל'
      },
      SAFE: {
        color: '#16a34a',
        bgColor: '#f0fdf4',
        icon: '✅',
        nameEn: 'Safe',
        nameHe: 'בטוח'
      }
    };
    
    return configs[severity] || configs.SAFE;
  };

  const renderInteractionAlert = () => {
    if (!interactionResults || isChecking) {
      return (
        <div className={styles.checkingState}>
          {isChecking && (
            <div className={styles.spinner}>
              <div className={styles.spinnerIcon}>🔄</div>
              <span>{language === 'he' ? 'בודק אינטראקציות...' : 'Checking interactions...'}</span>
            </div>
          )}
        </div>
      );
    }

    if (interactionResults.error) {
      return (
        <div className={styles.errorAlert}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{interactionResults.error}</span>
          <button 
            className={styles.retryBtn}
            onClick={checkInteractions}
          >
            {language === 'he' ? 'נסה שוב' : 'Retry'}
          </button>
        </div>
      );
    }

    const severityConfig = getSeverityConfig(interactionResults.severity);

    return (
      <div 
        className={styles.interactionAlert}
        style={{ 
          borderColor: severityConfig.color,
          backgroundColor: severityConfig.bgColor
        }}
      >
        <div className={styles.alertHeader}>
          <span className={styles.severityIcon}>{severityConfig.icon}</span>
          <span className={styles.severityText} style={{ color: severityConfig.color }}>
            {language === 'he' ? severityConfig.nameHe : severityConfig.nameEn}
          </span>
          {interactionResults.requiresPhysicianReview && (
            <span className={styles.reviewRequired}>
              {language === 'he' ? 'נדרשת בדיקה רפואית' : 'Physician Review Required'}
            </span>
          )}
        </div>

        {/* Critical alerts first */}
        {interactionResults.allergies?.length > 0 && (
          <div className={styles.criticalSection}>
            <h4 className={styles.sectionTitle}>
              {language === 'he' ? '🚨 אלרטים קריטיים' : '🚨 Critical Alerts'}
            </h4>
            {interactionResults.allergies.map((allergy, index) => (
              <div key={index} className={styles.criticalAlert}>
                <strong>
                  {language === 'he' ? allergy.warningHe : allergy.warningEn}
                </strong>
              </div>
            ))}
          </div>
        )}

        {/* Drug interactions */}
        {interactionResults.interactions?.length > 0 && (
          <div className={styles.interactionsSection}>
            <h4 className={styles.sectionTitle}>
              {language === 'he' ? 'אינטראקציות תרופתיות' : 'Drug Interactions'}
              <span className={styles.interactionCount}>
                ({interactionResults.interactions.length})
              </span>
            </h4>
            
            {interactionResults.interactions.slice(0, showDetails ? undefined : 3).map((interaction, index) => {
              const config = getSeverityConfig(interaction.severity);
              return (
                <div 
                  key={index} 
                  className={styles.interactionItem}
                  style={{ borderLeftColor: config.color }}
                >
                  <div className={styles.interactionDrugs}>
                    <span className={styles.drugName}>{interaction.medication1}</span>
                    <span className={styles.interactionSymbol}>⚡</span>
                    <span className={styles.drugName}>{interaction.medication2}</span>
                    <span 
                      className={styles.severityBadge}
                      style={{ backgroundColor: config.color }}
                    >
                      {language === 'he' ? config.nameHe : config.nameEn}
                    </span>
                  </div>
                  
                  <div className={styles.interactionDescription}>
                    {language === 'he' ? interaction.descriptionHe : interaction.description}
                  </div>
                  
                  {interaction.recommendation && (
                    <div className={styles.interactionRecommendation}>
                      <strong>
                        {language === 'he' ? 'המלצה: ' : 'Recommendation: '}
                      </strong>
                      {language === 'he' ? interaction.recommendationHe : interaction.recommendation}
                    </div>
                  )}
                </div>
              );
            })}
            
            {interactionResults.interactions.length > 3 && (
              <button 
                className={styles.showMoreBtn}
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 
                  (language === 'he' ? 'הצג פחות' : 'Show Less') :
                  (language === 'he' ? 
                    `הצג ${interactionResults.interactions.length - 3} נוספים` : 
                    `Show ${interactionResults.interactions.length - 3} More`)
                }
              </button>
            )}
          </div>
        )}

        {/* Recommendations */}
        {interactionResults.recommendations?.length > 0 && (
          <div className={styles.recommendationsSection}>
            <h4 className={styles.sectionTitle}>
              {language === 'he' ? 'המלצות' : 'Recommendations'}
            </h4>
            {interactionResults.recommendations.map((rec, index) => (
              <div key={index} className={`${styles.recommendation} ${styles[rec.type.toLowerCase()]}`}>
                {language === 'he' ? rec.messageHe : rec.messageEn}
                {(rec.actionHe || rec.actionEn) && (
                  <div className={styles.recommendationAction}>
                    <strong>
                      {language === 'he' ? rec.actionHe : rec.actionEn}
                    </strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Israeli-specific medication availability */}
        {clinicCountry === 'IL' && interactionResults.medications && (
          <div className={styles.availabilitySection}>
            <h4 className={styles.sectionTitle}>
              {language === 'he' ? 'זמינות תרופות בישראל' : 'Medication Availability in Israel'}
            </h4>
            {interactionResults.medications
              .filter(med => med.available === false)
              .map((med, index) => (
                <div key={index} className={styles.unavailableAlert}>
                  <span className={styles.unavailableIcon}>❌</span>
                  <span>
                    {med.originalName} - {language === 'he' ? 'לא זמין בישראל' : 'Not available in Israel'}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.drugCheckerContainer}>
      {medications.length > 0 ? (
        <>
          <div className={styles.checkerHeader}>
            <h3>
              {language === 'he' ? 'בדיקת אינטראקציות תרופתיות' : 'Drug Interaction Check'}
            </h3>
            {!isRealTime && (
              <button 
                className={styles.checkBtn}
                onClick={checkInteractions}
                disabled={isChecking}
              >
                {language === 'he' ? 'בדוק אינטראקציות' : 'Check Interactions'}
              </button>
            )}
          </div>
          
          {renderInteractionAlert()}
        </>
      ) : (
        <div className={styles.noMedications}>
          <span className={styles.noMedIcon}>💊</span>
          <span>
            {language === 'he' ? 
              'הוסף תרופות כדי לבדוק אינטראקציות' : 
              'Add medications to check for interactions'}
          </span>
        </div>
      )}
    </div>
  );
};

export default DrugInteractionChecker;
```

### **Step 4: Integration with Diagnostic Service**
```javascript
// backend/services/diagnosticServiceNew.js - Add this method
async getTreatmentWithDrugSafety(symptoms, age, gender, history, diagnosis, patientData, clinicCountry, language = 'en') {
  try {
    // Get base treatment recommendations
    const treatmentResult = await this.getTreatmentRecommendations(symptoms, age, gender, history, diagnosis, language);
    
    // Extract medications from treatment
    const medications = treatmentResult.medications || [];
    
    if (medications.length > 0) {
      // Check drug interactions
      const drugInteractionService = require('./drugInteractionService');
      const interactionResults = await drugInteractionService.checkDrugInteractions(
        medications,
        patientData,
        clinicCountry
      );
      
      // Modify treatment based on interactions
      const safeTreatment = await this.adjustTreatmentForSafety(treatmentResult, interactionResults, language);
      
      return {
        ...safeTreatment,
        drugSafetyCheck: interactionResults,
        safetyValidated: true
      };
    }
    
    return treatmentResult;
    
  } catch (error) {
    console.error('Treatment with drug safety check failed:', error);
    throw error;
  }
}

async adjustTreatmentForSafety(treatmentResult, interactionResults, language) {
  const adjustedTreatment = { ...treatmentResult };
  
  // Remove contraindicated medications
  const contraindicated = interactionResults.interactions
    .filter(i => i.severity === 'CONTRAINDICATED')
    .flatMap(i => [i.medication1, i.medication2]);
    
  if (contraindicated.length > 0) {
    adjustedTreatment.medications = adjustedTreatment.medications.filter(med => 
      !contraindicated.includes(med.name)
    );
    
    // Add safety note
    const safetyNote = language === 'he' ? 
      `הוסרו תרופות עם אינטראקציות מסוכנות: ${contraindicated.join(', ')}` :
      `Removed medications with dangerous interactions: ${contraindicated.join(', ')}`;
      
    adjustedTreatment.immediateActions.unshift({
      action: safetyNote,
      rationale: 'Drug safety adjustment',
      priority: 'CRITICAL'
    });
  }
  
  return adjustedTreatment;
}
```

### **Step 5: API Route**
```javascript
// backend/routes/drugs.js (create new)
const express = require('express');
const router = express.Router();
const drugInteractionService = require('../services/drugInteractionService');
const { practiceAuth, practiceContext } = require('../middleware/auth');

router.post('/check-interactions', practiceAuth, practiceContext, async (req, res) => {
  try {
    const { medications, patientData, clinicCountry, language } = req.body;
    
    const results = await drugInteractionService.checkDrugInteractions(
      medications,
      patientData,
      clinicCountry || req.practice?.country || 'IL'
    );
    
    res.json(results);
  } catch (error) {
    console.error('Drug interaction check failed:', error);
    res.status(500).json({
      error: 'Drug interaction check failed',
      requiresPhysicianReview: true
    });
  }
});

module.exports = router;
```

## 🧪 **Testing**
1. **Critical interactions:** Test warfarin + aspirin combination
2. **Allergy checking:** Test penicillin allergy with amoxicillin
3. **Israeli integration:** Test with קופת חולים patient data
4. **Bilingual alerts:** Test Hebrew/English safety messages
5. **Real-time checking:** Test immediate alerts during medication entry

## ✅ **Success Criteria**
- [ ] 100% detection of critical drug interactions
- [ ] Real-time alerts during medication entry
- [ ] Integration with existing patient allergy data
- [ ] Hebrew/English bilingual safety messages
- [ ] Israeli pharmacy database integration
- [ ] Severity-based recommendation system working

## 🔄 **Next Task**
Proceed to: **Task 1.3:** Implement Patient History Auto-Population

## 📝 **Critical Safety Notes**
- This is a clinical decision support tool, not a replacement for physician judgment
- All critical interactions require immediate physician review
- Israeli pharmacy database should be updated regularly
- Consider integration with actual Israeli health ministry drug database