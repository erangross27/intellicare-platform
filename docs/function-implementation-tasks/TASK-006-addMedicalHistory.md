# TASK-006: Implement addMedicalHistory Function

## Function Details
- **Name**: addMedicalHistory
- **Category**: Medical History
- **Priority**: Critical
- **Backend Route**: POST `/patients/:id/history` ✅ (Exists)

## Current Implementation
```javascript
async addMedicalHistory(params, practiceContext) {
  const response = await this.callAPI(`/patients/${params.patientId}/history`, 'POST', params, practiceContext);
  return {
    success: true,
    data: response.data
  };
}
```

## Required Implementation

### 1. Validate Medical Data
- Validate required fields (date, diagnosis, treatment)
- Validate date format and ensure not future date
- Validate diagnosis codes (ICD-10)
- Validate medication dosages

### 2. Structure Medical Entry
- Chief complaint
- History of present illness
- Physical examination findings
- Diagnosis with ICD codes
- Treatment plan
- Medications prescribed
- Follow-up instructions

### 3. Add Medical Intelligence
- Auto-suggest ICD-10 codes
- Check for drug interactions
- Flag critical conditions
- Calculate risk scores

## Implementation Code
```javascript
async addMedicalHistory(params, practiceContext, session) {
  try {
    // Extract patientId separately to check context
    let { patientId, ...historyData } = params;
    
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
    
    if (!params.date) {
      params.date = new Date().toISOString();
    } else {
      // Validate and format date
      const visitDate = new Date(params.date);
      if (visitDate > new Date()) {
        throw new Error(practiceContext.language === 'he' 
          ? 'תאריך הביקור לא יכול להיות בעתיד' 
          : 'Visit date cannot be in the future');
      }
      params.date = visitDate.toISOString();
    }
    
    if (!params.diagnosis && !params.chiefComplaint) {
      throw new Error(practiceContext.language === 'he' 
        ? 'נדרש לפחות תלונה עיקרית או אבחנה' 
        : 'At least chief complaint or diagnosis is required');
    }
    
    // Structure the medical history entry
    const historyEntry = {
      date: params.date,
      type: params.type || 'routine_visit',
      
      // Presenting complaint
      chiefComplaint: params.chiefComplaint || params.complaint,
      historyOfPresentIllness: params.historyOfPresentIllness || params.hpi,
      
      // Examination
      vitalSigns: params.vitalSigns || {
        bloodPressure: params.bloodPressure,
        pulse: params.pulse,
        temperature: params.temperature,
        weight: params.weight,
        height: params.height,
        oxygenSaturation: params.oxygenSaturation
      },
      physicalExamination: params.physicalExamination || params.examination,
      
      // Diagnosis
      diagnosis: params.diagnosis,
      icdCodes: params.icdCodes || [],
      differentialDiagnosis: params.differentialDiagnosis || [],
      
      // Treatment
      treatment: params.treatment,
      medications: params.medications || [],
      procedures: params.procedures || [],
      
      // Plan
      followUp: params.followUp,
      referrals: params.referrals || [],
      labTests: params.labTests || [],
      imaging: params.imaging || [],
      
      // Additional
      notes: params.notes,
      attachments: params.attachments || [],
      
      // Metadata
      recordedBy: practiceContext.userId || 'agent',
      practiceId: practiceContext.practiceId,
      language: practiceContext.language
    };
    
    // Process medications if provided
    if (historyEntry.medications && historyEntry.medications.length > 0) {
      historyEntry.medications = historyEntry.medications.map(med => {
        if (typeof med === 'string') {
          // Parse medication string format: "Drug Name 50mg twice daily"
          const parts = med.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(\w+)(?:\s+(.+))?$/);
          if (parts) {
            return {
              name: parts[1],
              dosage: parts[2],
              unit: parts[3],
              frequency: parts[4] || 'as directed'
            };
          }
          return { name: med, frequency: 'as directed' };
        }
        return med;
      });
      
      // Check for drug interactions if multiple medications
      if (historyEntry.medications.length > 1) {
        historyEntry.interactionCheck = 'pending';
      }
    }
    
    // Auto-categorize severity if diagnosis provided
    if (historyEntry.diagnosis) {
      historyEntry.severity = this.categorizeSeverity(historyEntry.diagnosis, historyEntry.vitalSigns);
    }
    
    // Clean up empty fields
    Object.keys(historyEntry).forEach(key => {
      if (historyEntry[key] === null || historyEntry[key] === undefined || 
          (Array.isArray(historyEntry[key]) && historyEntry[key].length === 0) ||
          (typeof historyEntry[key] === 'object' && Object.keys(historyEntry[key]).length === 0)) {
        delete historyEntry[key];
      }
    });
    
    // Save to database
    const response = await this.callAPI(
      `/patients/${params.patientId}/history`, 
      'POST', 
      historyEntry, 
      practiceContext
    );
    
    // Format summary for display
    const summary = this.generateHistorySummary(historyEntry, practiceContext);
    
    return {
      success: true,
      data: response.data,
      entryId: response.data._id || response.data.id,
      message: practiceContext.language === 'he' 
        ? `רשומה רפואית נוספה בהצלחה`
        : `Medical history entry added successfully`,
      summary: summary,
      warnings: this.checkMedicalWarnings(historyEntry, practiceContext)
    };
    
  } catch (error) {
    console.error('Error adding medical history:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בהוספת היסטוריה רפואית: ${error.message}`
        : `Error adding medical history: ${error.message}`
    };
  }
}

// Helper function to categorize severity
categorizeSeverity(diagnosis, vitalSigns) {
  // Check for critical keywords
  const criticalTerms = ['acute', 'severe', 'emergency', 'critical', 'unstable'];
  const moderateTerms = ['moderate', 'chronic', 'stable'];
  
  const diagnosisLower = diagnosis.toLowerCase();
  
  if (criticalTerms.some(term => diagnosisLower.includes(term))) {
    return 'critical';
  }
  
  // Check vital signs for abnormal values
  if (vitalSigns) {
    if (vitalSigns.bloodPressure) {
      const [systolic] = vitalSigns.bloodPressure.split('/').map(Number);
      if (systolic > 180 || systolic < 90) return 'critical';
      if (systolic > 140 || systolic < 100) return 'moderate';
    }
    if (vitalSigns.pulse && (vitalSigns.pulse > 120 || vitalSigns.pulse < 50)) {
      return 'moderate';
    }
    if (vitalSigns.temperature && (vitalSigns.temperature > 39 || vitalSigns.temperature < 35)) {
      return 'moderate';
    }
  }
  
  if (moderateTerms.some(term => diagnosisLower.includes(term))) {
    return 'moderate';
  }
  
  return 'routine';
}

// Helper function to generate summary
generateHistorySummary(entry, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  let summary = [];
  
  if (entry.chiefComplaint) {
    summary.push(isHebrew 
      ? `תלונה עיקרית: ${entry.chiefComplaint}`
      : `Chief Complaint: ${entry.chiefComplaint}`);
  }
  
  if (entry.diagnosis) {
    summary.push(isHebrew 
      ? `אבחנה: ${entry.diagnosis}`
      : `Diagnosis: ${entry.diagnosis}`);
  }
  
  if (entry.treatment) {
    summary.push(isHebrew 
      ? `טיפול: ${entry.treatment}`
      : `Treatment: ${entry.treatment}`);
  }
  
  if (entry.medications && entry.medications.length > 0) {
    const medCount = entry.medications.length;
    summary.push(isHebrew 
      ? `${medCount} תרופות נרשמו`
      : `${medCount} medications prescribed`);
  }
  
  if (entry.followUp) {
    summary.push(isHebrew 
      ? `מעקב: ${entry.followUp}`
      : `Follow-up: ${entry.followUp}`);
  }
  
  return summary.join(' | ');
}

// Helper function to check for medical warnings
checkMedicalWarnings(entry, practiceContext) {
  const warnings = [];
  const isHebrew = practiceContext.language === 'he';
  
  // Check for high-risk conditions
  if (entry.diagnosis) {
    const highRiskConditions = ['diabetes', 'hypertension', 'cardiac', 'stroke', 'cancer'];
    if (highRiskConditions.some(condition => entry.diagnosis.toLowerCase().includes(condition))) {
      warnings.push(isHebrew 
        ? 'מצב רפואי בסיכון גבוה - נדרש מעקב צמוד'
        : 'High-risk medical condition - close monitoring required');
    }
  }
  
  // Check for polypharmacy
  if (entry.medications && entry.medications.length >= 5) {
    warnings.push(isHebrew 
      ? 'ריבוי תרופות - מומלץ לבדוק אינטראקציות'
      : 'Polypharmacy detected - recommend interaction check');
  }
  
  // Check vital signs
  if (entry.vitalSigns) {
    if (entry.vitalSigns.bloodPressure) {
      const [systolic, diastolic] = entry.vitalSigns.bloodPressure.split('/').map(Number);
      if (systolic > 140 || diastolic > 90) {
        warnings.push(isHebrew 
          ? 'לחץ דם גבוה'
          : 'Elevated blood pressure');
      }
    }
  }
  
  return warnings.length > 0 ? warnings : null;
}
```

## Testing Checklist
- [ ] Test with minimal required fields
- [ ] Test with complete medical record
- [ ] Test date validation (no future dates)
- [ ] Test medication parsing
- [ ] Test severity categorization
- [ ] Test with vital signs
- [ ] Test warning generation
- [ ] Test Hebrew responses
- [ ] Test English responses

## Notes
- Consider integrating with ICD-10 database for code validation
- Add templates for common conditions
- Implement voice-to-text for easier data entry
- Add ability to copy from previous visits