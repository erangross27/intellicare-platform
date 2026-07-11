# TASK-022: Implement addAllergy Function

## Function Details
- **Name**: addAllergy
- **Category**: Allergies
- **Priority**: Critical
- **Backend Route**: POST `/medical-data/patients/:patientId/allergies` ✅ (Exists)

## Current Implementation
```javascript
async addAllergy(params, practiceContext) {
  const allergyData = {
    allergen: params.allergen,
    severity: params.severity,
    reaction: params.reaction,
    notes: params.notes
  };
  const response = await this.callAPI(`/medical-data/patients/${params.patientId}/allergies`, 'POST', allergyData, practiceContext);
  return {
    success: true,
    data: response.data,
    message: practiceContext.language === 'he' 
      ? `אלרגיה ל${params.allergen} נוספה בהצלחה`
      : `Allergy to ${params.allergen} added successfully`
  };
}
```

## Required Implementation

### 1. Comprehensive Validation
- Validate allergen against known allergens database
- Validate severity levels
- Check for duplicate allergies
- Validate reaction types

### 2. Clinical Categorization
- Drug allergies
- Food allergies
- Environmental allergies
- Contact allergies
- Other allergies

### 3. Safety Integration
- Update medication warnings
- Alert prescribers
- Cross-reference with current medications
- Generate allergy card

## Implementation Code
```javascript
async addAllergy(params, practiceContext, session) {
  try {
    // Extract patientId separately to check context
    let { patientId, ...allergyData } = params;
    
    // Check context if no patientId provided
    if (!patientId && session?.currentContext?.patientId) {
      patientId = session.currentContext.patientId;
      console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
    }
    
    // Validate required fields
    if (!patientId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
        : 'Patient ID required. Please search for a patient first');
    }
    
    if (!params.allergen) {
      throw new Error(practiceContext.language === 'he' 
        ? 'שם האלרגן חסר' 
        : 'Allergen name is required');
    }
    
    if (!params.severity) {
      throw new Error(practiceContext.language === 'he' 
        ? 'חומרת האלרגיה חסרה' 
        : 'Allergy severity is required');
    }
    
    // Validate severity level
    const validSeverities = ['mild', 'moderate', 'severe', 'life-threatening'];
    if (!validSeverities.includes(params.severity.toLowerCase())) {
      throw new Error(practiceContext.language === 'he' 
        ? 'רמת חומרה לא תקינה. אפשרויות: mild, moderate, severe, life-threatening' 
        : 'Invalid severity level. Options: mild, moderate, severe, life-threatening');
    }
    
    // Categorize allergy type
    const allergyType = this.categorizeAllergyType(params.allergen);
    
    // Parse and validate reaction
    const reactionTypes = this.parseReactionTypes(params.reaction);
    
    // Check for existing allergies
    const existingAllergiesResponse = await this.callAPI(
      `/medical-data/patients/${params.patientId}/allergies`, 
      'GET', 
      null, 
      practiceContext
    );
    const existingAllergies = existingAllergiesResponse.data || [];
    
    // Check for duplicates
    const duplicate = existingAllergies.find(allergy => 
      allergy.allergen?.toLowerCase() === params.allergen.toLowerCase()
    );
    
    if (duplicate && !params.force) {
      throw new Error(practiceContext.language === 'he' 
        ? `אלרגיה ל-${params.allergen} כבר רשומה במערכת`
        : `Allergy to ${params.allergen} is already recorded`);
    }
    
    // Get current medications for cross-reference
    const medicationsResponse = await this.callAPI(
      `/medical-data/patients/${params.patientId}/medications`, 
      'GET', 
      { status: 'active' }, 
      practiceContext
    );
    const activeMedications = medicationsResponse.data || [];
    
    // Check for medication conflicts
    const medicationConflicts = this.checkMedicationAllergyConflicts(
      params.allergen, 
      allergyType, 
      activeMedications
    );
    
    // Structure allergy data
    const allergyData = {
      allergen: params.allergen,
      allergyType: allergyType,
      severity: params.severity.toLowerCase(),
      severityScore: this.getSeverityScore(params.severity),
      
      // Reactions
      reaction: params.reaction,
      reactionTypes: reactionTypes,
      onset: params.onset || 'unknown', // immediate, delayed, unknown
      
      // Verification
      verificationStatus: params.verificationStatus || 'confirmed',
      diagnosedDate: params.diagnosedDate || new Date().toISOString(),
      diagnosedBy: params.diagnosedBy || practiceContext.userId || 'agent',
      
      // Additional details
      notes: params.notes,
      treatment: params.treatment,
      crossReactivity: this.getCrossReactiveAllergens(params.allergen, allergyType),
      
      // Metadata
      recordedDate: new Date().toISOString(),
      recordedBy: practiceContext.userId || 'agent',
      lastUpdated: new Date().toISOString(),
      
      // Status
      status: 'active',
      criticalAlert: params.severity === 'life-threatening'
    };
    
    // Save allergy
    const response = await this.callAPI(
      `/medical-data/patients/${params.patientId}/allergies`, 
      'POST', 
      allergyData, 
      practiceContext
    );
    
    // Generate alerts and warnings
    const alerts = this.generateAllergyAlerts(allergyData, medicationConflicts, practiceContext);
    
    // Generate allergy card information
    const allergyCard = this.generateAllergyCard(allergyData, practiceContext);
    
    // Update patient's critical alerts if life-threatening
    if (allergyData.criticalAlert) {
      await this.updatePatientCriticalAlerts(params.patientId, allergyData, practiceContext);
    }
    
    return {
      success: true,
      data: response.data,
      allergyId: response.data._id || response.data.id,
      message: this.generateAllergyMessage(allergyData, practiceContext),
      alerts: alerts,
      medicationConflicts: medicationConflicts,
      allergyCard: allergyCard,
      crossReactivity: allergyData.crossReactivity,
      summary: {
        allergen: params.allergen,
        type: allergyType,
        severity: params.severity,
        reaction: params.reaction
      }
    };
    
  } catch (error) {
    console.error('Error adding allergy:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בהוספת אלרגיה: ${error.message}`
        : `Error adding allergy: ${error.message}`
    };
  }
}

// Helper: Categorize allergy type
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

// Helper: Parse reaction types
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

// Helper: Get severity score
getSeverityScore(severity) {
  const scores = {
    'mild': 1,
    'moderate': 2,
    'severe': 3,
    'life-threatening': 4
  };
  return scores[severity.toLowerCase()] || 2;
}

// Helper: Check medication conflicts
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

// Helper: Get cross-reactive allergens
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

// Helper: Generate allergy alerts
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

// Helper: Generate allergy card
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

// Helper: Update patient critical alerts
async updatePatientCriticalAlerts(patientId, allergy, practiceContext) {
  try {
    await this.callAPI(
      `/patients/${patientId}`, 
      'PUT', 
      {
        criticalAlerts: {
          hasLifeThreateningAllergies: true,
          allergens: [allergy.allergen]
        }
      }, 
      practiceContext
    );
  } catch (error) {
    console.error('Failed to update critical alerts:', error);
  }
}

// Helper: Generate message
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
```

## Testing Checklist
- [ ] Test with valid allergy data
- [ ] Test severity validation
- [ ] Test duplicate detection
- [ ] Test medication conflict detection
- [ ] Test drug allergy categorization
- [ ] Test food allergy categorization
- [ ] Test environmental allergy categorization
- [ ] Test cross-reactivity detection
- [ ] Test critical alert generation
- [ ] Test Hebrew responses
- [ ] Test English responses

## Notes
- Integrate with allergen database
- Add FHIR AllergyIntolerance support
- Implement allergy testing results
- Add desensitization tracking