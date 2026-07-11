# TASK-018: Implement addMedication Function

## Function Details
- **Name**: addMedication
- **Category**: Medications
- **Priority**: Critical
- **Backend Route**: POST `/medical-data/patients/:patientId/medications` ✅ (Needs creation)

## Current Implementation
```javascript
async addMedication(params, practiceContext) {
  const medicationData = {
    ...params,
    prescribedDate: new Date().toISOString(),
    status: 'active'
  };
  const response = await this.callAPI(`/medical-data/patients/${params.patientId}/medications`, 'POST', medicationData, practiceContext);
  return {
    success: true,
    data: response.data,
    message: practiceContext.language === 'he' 
      ? `התרופה ${params.medicationName} נוספה בהצלחה`
      : `Medication ${params.medicationName} added successfully`
  };
}
```

## Required Implementation

### 1. Medication Validation
- Validate drug name against database
- Check dosage within safe ranges
- Validate frequency format
- Check for duplicates

### 2. Drug Safety Checks
- Check allergies
- Check interactions with existing medications
- Check contraindications
- Age-appropriate dosing

### 3. Prescription Details
- Start and end dates
- Refill information
- Administration instructions
- Prescriber information

## Implementation Code
```javascript
async addMedication(params, practiceContext, session) {
  try {
    // Extract patientId separately to check context
    let { patientId, ...medicationData } = params;
    
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
    
    if (!params.medicationName) {
      throw new Error(practiceContext.language === 'he' 
        ? 'שם התרופה חסר' 
        : 'Medication name is required');
    }
    
    if (!params.dosage) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מינון חסר' 
        : 'Dosage is required');
    }
    
    if (!params.frequency) {
      throw new Error(practiceContext.language === 'he' 
        ? 'תדירות נטילה חסרה' 
        : 'Frequency is required');
    }
    
    // Get patient data for safety checks
    const patientResponse = await this.callAPI(
      `/patients/${params.patientId}`, 
      'GET', 
      null, 
      practiceContext
    );
    const patient = patientResponse.data;
    
    // Parse dosage
    const dosagePattern = /^(\d+(?:\.\d+)?)\s*(\w+)$/;
    const dosageMatch = params.dosage.match(dosagePattern);
    let dosageValue, dosageUnit;
    
    if (dosageMatch) {
      dosageValue = parseFloat(dosageMatch[1]);
      dosageUnit = dosageMatch[2];
    } else {
      dosageValue = parseFloat(params.dosage);
      dosageUnit = params.dosageUnit || 'mg';
    }
    
    // Parse frequency
    const frequencyMap = {
      'once daily': { times: 1, period: 'day', hebrew: 'פעם ביום' },
      'twice daily': { times: 2, period: 'day', hebrew: 'פעמיים ביום' },
      'three times daily': { times: 3, period: 'day', hebrew: 'שלוש פעמים ביום' },
      'four times daily': { times: 4, period: 'day', hebrew: 'ארבע פעמים ביום' },
      'every 8 hours': { times: 3, period: 'day', hebrew: 'כל 8 שעות' },
      'every 12 hours': { times: 2, period: 'day', hebrew: 'כל 12 שעות' },
      'as needed': { times: 0, period: 'prn', hebrew: 'לפי הצורך' },
      'פעם ביום': { times: 1, period: 'day', hebrew: 'פעם ביום' },
      'פעמיים ביום': { times: 2, period: 'day', hebrew: 'פעמיים ביום' }
    };
    
    const frequencyInfo = frequencyMap[params.frequency.toLowerCase()] || {
      times: 1,
      period: 'day',
      hebrew: params.frequency
    };
    
    // Calculate duration and end date
    const startDate = params.startDate ? new Date(params.startDate) : new Date();
    let endDate = null;
    
    if (params.duration) {
      const durationMatch = params.duration.match(/^(\d+)\s*(days?|weeks?|months?)$/i);
      if (durationMatch) {
        const value = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        endDate = new Date(startDate);
        
        switch(unit) {
          case 'day':
          case 'days':
            endDate.setDate(endDate.getDate() + value);
            break;
          case 'week':
          case 'weeks':
            endDate.setDate(endDate.getDate() + (value * 7));
            break;
          case 'month':
          case 'months':
            endDate.setMonth(endDate.getMonth() + value);
            break;
        }
      }
    }
    
    // Check for existing medications
    const existingMedsResponse = await this.callAPI(
      `/medical-data/patients/${params.patientId}/medications`, 
      'GET', 
      { status: 'active' }, 
      practiceContext
    );
    const existingMeds = existingMedsResponse.data || [];
    
    // Check for duplicates
    const duplicate = existingMeds.find(med => 
      med.medicationName?.toLowerCase() === params.medicationName.toLowerCase() &&
      med.status === 'active'
    );
    
    if (duplicate && !params.force) {
      throw new Error(practiceContext.language === 'he' 
        ? `${params.medicationName} כבר רשומה כתרופה פעילה למטופל`
        : `${params.medicationName} is already an active medication for this patient`);
    }
    
    // Check allergies
    const allergiesResponse = await this.callAPI(
      `/medical-data/patients/${params.patientId}/allergies`, 
      'GET', 
      null, 
      practiceContext
    );
    const allergies = allergiesResponse.data || [];
    
    const allergyConflict = allergies.find(allergy => 
      allergy.allergen?.toLowerCase().includes(params.medicationName.toLowerCase()) ||
      params.medicationName.toLowerCase().includes(allergy.allergen?.toLowerCase())
    );
    
    if (allergyConflict && !params.overrideAllergy) {
      throw new Error(practiceContext.language === 'he' 
        ? `אזהרה: למטופל יש אלרגיה ל-${allergyConflict.allergen}`
        : `Warning: Patient has allergy to ${allergyConflict.allergen}`);
    }
    
    // Structure medication data
    const medicationData = {
      medicationName: params.medicationName,
      genericName: params.genericName,
      dosage: dosageValue,
      dosageUnit: dosageUnit,
      frequency: params.frequency,
      frequencyDetails: frequencyInfo,
      route: params.route || 'oral',
      
      startDate: startDate.toISOString(),
      endDate: endDate ? endDate.toISOString() : null,
      duration: params.duration,
      
      instructions: params.instructions || '',
      indication: params.indication || params.reason,
      
      prescribedBy: params.prescribedBy || practiceContext.userId || 'agent',
      prescribedDate: new Date().toISOString(),
      
      refills: params.refills || 0,
      refillsRemaining: params.refills || 0,
      
      status: 'active',
      adherence: 'not_started',
      
      sideEffects: [],
      notes: params.notes,
      
      // Safety checks
      interactionChecked: false,
      allergyChecked: !allergyConflict,
      
      // Patient info for dosage calculation
      patientAge: patient.age,
      patientWeight: patient.weight
    };
    
    // Check drug interactions if multiple medications
    if (existingMeds.length > 0) {
      const interactionCheck = await this.checkDrugInteractions({
        medications: [...existingMeds.map(m => m.medicationName), params.medicationName]
      }, practiceContext);
      
      if (interactionCheck.hasInteractions) {
        medicationData.interactions = interactionCheck.data;
        medicationData.interactionWarning = true;
      }
      medicationData.interactionChecked = true;
    }
    
    // Save medication
    const response = await this.callAPI(
      `/medical-data/patients/${params.patientId}/medications`, 
      'POST', 
      medicationData, 
      practiceContext
    );
    
    // Generate instructions
    const instructions = this.generateMedicationInstructions(medicationData, practiceContext);
    
    return {
      success: true,
      data: response.data,
      medicationId: response.data._id || response.data.id,
      message: practiceContext.language === 'he' 
        ? `${params.medicationName} נוספה בהצלחה לרשימת התרופות`
        : `${params.medicationName} added successfully to medications`,
      instructions: instructions,
      warnings: this.generateMedicationWarnings(medicationData, patient, practiceContext),
      summary: {
        medication: `${params.medicationName} ${dosageValue}${dosageUnit}`,
        frequency: frequencyInfo.hebrew || params.frequency,
        duration: params.duration || (practiceContext.language === 'he' ? 'ללא הגבלת זמן' : 'Ongoing'),
        startDate: startDate.toLocaleDateString(practiceContext.language === 'he' ? 'he-IL' : 'en-US')
      }
    };
    
  } catch (error) {
    console.error('Error adding medication:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בהוספת תרופה: ${error.message}`
        : `Error adding medication: ${error.message}`
    };
  }
}

// Helper: Generate medication instructions
generateMedicationInstructions(medication, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  const instructions = [];
  
  // Basic instruction
  instructions.push(isHebrew 
    ? `ליטול ${medication.medicationName} ${medication.dosage}${medication.dosageUnit}`
    : `Take ${medication.medicationName} ${medication.dosage}${medication.dosageUnit}`);
  
  // Frequency
  instructions.push(medication.frequencyDetails.hebrew || medication.frequency);
  
  // Route
  if (medication.route !== 'oral') {
    const routeMap = {
      'topical': isHebrew ? 'למריחה' : 'Apply topically',
      'injection': isHebrew ? 'בזריקה' : 'By injection',
      'inhaled': isHebrew ? 'לשאיפה' : 'By inhalation',
      'rectal': isHebrew ? 'רקטלי' : 'Rectally',
      'sublingual': isHebrew ? 'מתחת ללשון' : 'Under the tongue'
    };
    instructions.push(routeMap[medication.route] || medication.route);
  }
  
  // Special instructions
  if (medication.instructions) {
    instructions.push(medication.instructions);
  }
  
  // Duration
  if (medication.duration) {
    instructions.push(isHebrew 
      ? `למשך ${medication.duration}`
      : `For ${medication.duration}`);
  }
  
  return instructions.join(', ');
}

// Helper: Generate warnings
generateMedicationWarnings(medication, patient, practiceContext) {
  const warnings = [];
  const isHebrew = practiceContext.language === 'he';
  
  // Interaction warning
  if (medication.interactionWarning) {
    warnings.push(isHebrew 
      ? 'זוהו אינטראקציות אפשריות עם תרופות אחרות'
      : 'Potential drug interactions detected');
  }
  
  // Age-based warnings
  if (patient.age) {
    if (patient.age < 12) {
      warnings.push(isHebrew 
        ? 'מינון ילדים - יש לוודא התאמה לגיל ומשקל'
        : 'Pediatric dosing - verify age and weight appropriate');
    } else if (patient.age > 65) {
      warnings.push(isHebrew 
        ? 'מינון למבוגרים - ייתכן צורך בהתאמת מינון'
        : 'Geriatric patient - dosage adjustment may be needed');
    }
  }
  
  // Common side effects warning
  warnings.push(isHebrew 
    ? 'יש לעקוב אחר תופעות לוואי'
    : 'Monitor for side effects');
  
  return warnings.length > 0 ? warnings : null;
}
```

## Testing Checklist
- [ ] Test with valid medication data
- [ ] Test duplicate medication detection
- [ ] Test allergy checking
- [ ] Test drug interaction checking
- [ ] Test dosage parsing
- [ ] Test frequency parsing
- [ ] Test duration calculation
- [ ] Test with pediatric patient
- [ ] Test with geriatric patient
- [ ] Test Hebrew responses
- [ ] Test English responses

## Notes
- Integrate with drug database for validation
- Add barcode scanning for medication
- Implement adherence tracking
- Add reminder system for doses