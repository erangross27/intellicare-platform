/**
 * AllergyHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class AllergyHelpers {

    groupAllergies(allergies) {
      const grouped = {
        bySeverity: {
          'life-threatening': [],
          'severe': [],
          'moderate': [],
          'mild': []
        },
        byType: {
          'drug': [],
          'food': [],
          'environmental': [],
          'contact': [],
          'other': []
        },
        active: [],
        inactive: []
      };
  
      allergies.forEach(allergy => {
        // Group by severity
        const severity = allergy.severity || 'moderate';
        if (grouped.bySeverity[severity]) {
          grouped.bySeverity[severity].push(allergy);
        }
  
        // Group by type
        const type = allergy.allergyType || 'other';
        if (grouped.byType[type]) {
          grouped.byType[type].push(allergy);
        }
  
        // Group by status
        if (allergy.status === 'active') {
          grouped.active.push(allergy);
        } else {
          grouped.inactive.push(allergy);
        }
      });
  
      return grouped;
    }

    generateAllergiesAlerts(allergies, practiceContext) {
      const alerts = [];
      const isHebrew = practiceContext.language === 'he';
  
      // Count critical allergies
      const critical = allergies.filter(a => a.severity === 'life-threatening');
      if (critical.length > 0) {
        alerts.push({
          type: 'critical',
          message: isHebrew 
            ? `⚠️ ${critical.length} אלרגיות מסכנות חיים`
            : `⚠️ ${critical.length} life-threatening allergies`,
          allergies: critical.map(a => a.allergen)
        });
      }
  
      // Count drug allergies
      const drugAllergies = allergies.filter(a => a.allergyType === 'drug');
      if (drugAllergies.length > 0) {
        alerts.push({
          type: 'warning',
          message: isHebrew 
            ? `${drugAllergies.length} אלרגיות לתרופות - בדוק בכל מתן תרופה`
            : `${drugAllergies.length} drug allergies - check before prescribing`,
          allergies: drugAllergies.map(a => a.allergen)
        });
      }
  
      // Multiple allergies warning
      if (allergies.length >= 5) {
        alerts.push({
          type: 'info',
          message: isHebrew 
            ? 'מטופל עם אלרגיות מרובות - נדרשת זהירות מיוחדת'
            : 'Patient with multiple allergies - requires special caution'
        });
      }
  
      return alerts;
    }

    generateAllergiesSummary(allergies, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      const summary = {
        total: allergies.length,
        critical: allergies.filter(a => a.severity === 'life-threatening').length,
        drug: allergies.filter(a => a.allergyType === 'drug').length,
        food: allergies.filter(a => a.allergyType === 'food').length,
        environmental: allergies.filter(a => a.allergyType === 'environmental').length
      };
  
      // Most severe allergy
      const severities = ['life-threatening', 'severe', 'moderate', 'mild'];
      summary.mostSevere = severities.find(s => allergies.some(a => a.severity === s)) || 'none';
  
      // Common allergens
      const allergenCounts = {};
      allergies.forEach(allergy => {
        const type = allergy.allergyType || 'other';
        allergenCounts[type] = (allergenCounts[type] || 0) + 1;
      });
      summary.primaryType = Object.keys(allergenCounts).reduce((a, b) => 
        allergenCounts[a] > allergenCounts[b] ? a : b, 'none');
  
      // Text summary
      if (allergies.length === 0) {
        summary.text = isHebrew ? 'אין אלרגיות ידועות' : 'No known allergies';
      } else {
        summary.text = isHebrew 
          ? `${summary.total} אלרגיות (${summary.critical} קריטיות)`
          : `${summary.total} allergies (${summary.critical} critical)`;
      }
  
      return summary;
    }

    generateAllergiesMessage(allergies, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
  
      if (allergies.length === 0) {
        return isHebrew ? 'לא נמצאו אלרגיות' : 'No allergies found';
      }
  
      const critical = allergies.filter(a => a.severity === 'life-threatening').length;
      const drug = allergies.filter(a => a.allergyType === 'drug').length;
  
      let message = isHebrew 
        ? `נמצאו ${allergies.length} אלרגיות`
        : `Found ${allergies.length} allergies`;
  
      if (critical > 0) {
        message += isHebrew 
          ? ` (${critical} מסכנות חיים)`
          : ` (${critical} life-threatening)`;
      }
  
      if (drug > 0) {
        message += isHebrew 
          ? `, כולל ${drug} אלרגיות לתרופות`
          : `, including ${drug} drug allergies`;
      }
  
      return message;
    }

    categorizeAllergyType(allergen) {
      const allergenLower = allergen.toLowerCase();
      
      // Common drug categories
      const drugKeywords = ['cillin', 'mycin', 'cef', 'sulfa', 'aspirin', 'ibuprofen', 
                            'codeine', 'morphine', 'contrast', 'latex', 'adhesive'];
      if (drugKeywords.some(keyword => allergenLower.includes(keyword))) {
        return 'drug';
      }
      
      // Common food allergens
      const foodKeywords = ['peanut', 'nut', 'milk', 'egg', 'wheat', 'soy', 'fish', 
                            'shellfish', 'sesame', 'gluten'];
      if (foodKeywords.some(keyword => allergenLower.includes(keyword))) {
        return 'food';
      }
      
      // Environmental allergens
      const envKeywords = ['pollen', 'dust', 'mold', 'pet', 'cat', 'dog', 'grass', 'tree'];
      if (envKeywords.some(keyword => allergenLower.includes(keyword))) {
        return 'environmental';
      }
      
      // Contact allergens
      const contactKeywords = ['nickel', 'latex', 'rubber', 'adhesive', 'fragrance'];
      if (contactKeywords.some(keyword => allergenLower.includes(keyword))) {
        return 'contact';
      }
      
      return 'other';
    }

    parseReactionTypes(reaction) {
      if (!reaction) return [];
      
      const reactionLower = reaction.toLowerCase();
      const types = [];
      
      // Skin reactions
      if (reactionLower.match(/rash|hives|itch|urticaria|eczema/)) {
        types.push('skin');
      }
      
      // Respiratory reactions
      if (reactionLower.match(/wheez|breath|asthma|cough|throat/)) {
        types.push('respiratory');
      }
      
      // GI reactions
      if (reactionLower.match(/nausea|vomit|diarrhea|stomach|abdominal/)) {
        types.push('gastrointestinal');
      }
      
      // Anaphylaxis
      if (reactionLower.match(/anaphyla|shock|severe|emergency/)) {
        types.push('anaphylaxis');
      }
      
      // Cardiovascular
      if (reactionLower.match(/heart|blood pressure|dizzy|faint/)) {
        types.push('cardiovascular');
      }
      
      return types;
    }

    getSeverityScore(severity) {
      const scores = {
        'mild': 1,
        'moderate': 2,
        'severe': 3,
        'life-threatening': 4
      };
      return scores[severity.toLowerCase()] || 2;
    }

    checkMedicationAllergyConflicts(allergen, allergyType, medications) {
      const conflicts = [];
      
      if (allergyType === 'drug') {
        medications.forEach(med => {
          // Check for direct match
          if (med.medicationName?.toLowerCase().includes(allergen.toLowerCase()) ||
              med.genericName?.toLowerCase().includes(allergen.toLowerCase())) {
            conflicts.push({
              medication: med.medicationName,
              type: 'direct',
              severity: 'high',
              action: 'discontinue'
            });
          }
          
          // Check for class matches (e.g., penicillin allergy with amoxicillin)
          if (allergen.toLowerCase().includes('penicillin') && 
              med.medicationName?.toLowerCase().match(/amox|ampic/)) {
            conflicts.push({
              medication: med.medicationName,
              type: 'cross-reactive',
              severity: 'high',
              action: 'review'
            });
          }
        });
      }
      
      return conflicts;
    }

    getCrossReactiveAllergens(allergen, type) {
      const crossReactive = [];
      const allergenLower = allergen.toLowerCase();
      
      // Penicillin cross-reactivity
      if (allergenLower.includes('penicillin')) {
        crossReactive.push('amoxicillin', 'ampicillin', 'cephalosporins (10% risk)');
      }
      
      // Sulfa cross-reactivity
      if (allergenLower.includes('sulfa')) {
        crossReactive.push('sulfamethoxazole', 'sulfasalazine', 'some diuretics');
      }
      
      // Shellfish cross-reactivity
      if (allergenLower.includes('shellfish')) {
        crossReactive.push('other shellfish', 'possible iodine contrast');
      }
      
      // Tree nut cross-reactivity
      if (allergenLower.includes('nut') && !allergenLower.includes('peanut')) {
        crossReactive.push('other tree nuts', 'nut oils');
      }
      
      return crossReactive;
    }

    generateAllergyAlerts(allergy, conflicts, practiceContext) {
      const alerts = [];
      const isHebrew = practiceContext.language === 'he';
      
      // Critical allergy alert
      if (allergy.criticalAlert) {
        alerts.push({
          type: 'critical',
          message: isHebrew 
            ? `⚠️ אלרגיה מסכנת חיים ל-${allergy.allergen}`
            : `⚠️ Life-threatening allergy to ${allergy.allergen}`,
          action: isHebrew 
            ? 'יש לעדכן את כל הצוות הרפואי'
            : 'Alert all medical staff'
        });
      }
      
      // Medication conflicts
      if (conflicts.length > 0) {
        alerts.push({
          type: 'warning',
          message: isHebrew 
            ? `נמצאו ${conflicts.length} תרופות בקונפליקט`
            : `${conflicts.length} medication conflicts found`,
          medications: conflicts
        });
      }
      
      // Cross-reactivity warning
      if (allergy.crossReactivity && allergy.crossReactivity.length > 0) {
        alerts.push({
          type: 'info',
          message: isHebrew 
            ? 'יש להיזהר מאלרגנים צולבים'
            : 'Be aware of cross-reactive allergens',
          allergens: allergy.crossReactivity
        });
      }
      
      return alerts;
    }

    generateAllergyCard(allergy, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      return {
        title: isHebrew ? 'כרטיס אלרגיה' : 'Allergy Card',
        allergen: allergy.allergen.toUpperCase(),
        severity: allergy.severity.toUpperCase(),
        reaction: allergy.reaction,
        instructions: isHebrew 
          ? `במקרה של חשיפה: ${allergy.treatment || 'פנה לעזרה רפואית מיידית'}`
          : `In case of exposure: ${allergy.treatment || 'Seek immediate medical attention'}`,
        emergency: allergy.criticalAlert
      };
    }

    generateAllergyMessage(allergy, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      let message = isHebrew 
        ? `אלרגיה ל-${allergy.allergen} (${allergy.severity}) נוספה בהצלחה`
        : `Allergy to ${allergy.allergen} (${allergy.severity}) added successfully`;
      
      if (allergy.criticalAlert) {
        message += isHebrew 
          ? '. ⚠️ סומנה כאלרגיה מסכנת חיים'
          : '. ⚠️ Marked as life-threatening';
      }
      
      return message;
    }
}

module.exports = AllergyHelpers;
