# TASK-019: Implement getMedications Function

## Function Details
- **Name**: getMedications
- **Category**: Medications
- **Priority**: Critical
- **Backend Route**: GET `/medical-data/patients/:patientId/medications` ✅ (Exists)

## Current Implementation
```javascript
async getMedications(params, practiceContext) {
  const { patientId, status = 'active' } = params;
  const response = await this.callAPI(`/medical-data/patients/${patientId}/medications`, 'GET', { status }, practiceContext);
  return {
    success: true,
    data: response.data,
    count: response.count,
    message: practiceContext.language === 'he' 
      ? `נמצאו ${response.count} תרופות`
      : `Found ${response.count} medications`
  };
}
```

## Required Implementation

### 1. Enhanced Filtering
- Filter by status (active, discontinued, completed)
- Filter by date range
- Filter by prescriber
- Filter by route

### 2. Medication Analysis
- Check adherence
- Calculate days remaining
- Identify expiring medications
- Check for interactions

### 3. Formatting
- Group by status
- Sort by priority
- Format for display
- Generate summary

## Implementation Code
```javascript
async getMedications(params, practiceContext, session) {
  try {
    // Extract patientId separately to check context
    let { patientId, ...queryOptions } = params;
    
    // Check context if no patientId provided
    if (!patientId && session?.currentContext?.patientId) {
      patientId = session.currentContext.patientId;
      console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
    }
    
    // Validate patient ID
    if (!patientId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
        : 'Patient ID required. Please search for a patient first');
    }
    
    // Build query parameters
    const queryParams = {
      status: params.status || 'all',
      includeDiscontinued: params.includeDiscontinued !== false,
      includeHistory: params.includeHistory || false
    };
    
    // Add date filters if provided
    if (params.startDate) queryParams.startDate = params.startDate;
    if (params.endDate) queryParams.endDate = params.endDate;
    if (params.prescribedAfter) queryParams.prescribedAfter = params.prescribedAfter;
    
    // Get medications
    const response = await this.callAPI(
      `/medical-data/patients/${params.patientId}/medications`, 
      'GET', 
      queryParams, 
      practiceContext
    );
    
    if (!response.data) {
      return {
        success: true,
        data: [],
        count: 0,
        message: practiceContext.language === 'he' 
          ? 'לא נמצאו תרופות'
          : 'No medications found'
      };
    }
    
    // Process medications
    const medications = Array.isArray(response.data) ? response.data : [response.data];
    const now = new Date();
    
    // Enhance medication data
    const enhancedMedications = medications.map(med => {
      const enhanced = { ...med };
      
      // Calculate days remaining if end date exists
      if (med.endDate) {
        const endDate = new Date(med.endDate);
        const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        enhanced.daysRemaining = daysRemaining;
        enhanced.isExpiring = daysRemaining <= 7 && daysRemaining > 0;
        enhanced.isExpired = daysRemaining < 0;
        
        if (enhanced.isExpired && med.status === 'active') {
          enhanced.status = 'completed';
        }
      }
      
      // Calculate refills status
      if (med.refills !== undefined) {
        enhanced.refillsUsed = (med.refills - (med.refillsRemaining || 0));
        enhanced.needsRefill = med.refillsRemaining === 0 && med.status === 'active';
      }
      
      // Format display text
      enhanced.displayText = this.formatMedicationDisplay(med, practiceContext);
      
      // Add priority score for sorting
      enhanced.priority = this.calculateMedicationPriority(enhanced);
      
      return enhanced;
    });
    
    // Sort by priority and status
    enhancedMedications.sort((a, b) => {
      // Active medications first
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      // Then by priority
      return b.priority - a.priority;
    });
    
    // Group medications by status
    const groupedMedications = {
      active: enhancedMedications.filter(m => m.status === 'active'),
      discontinued: enhancedMedications.filter(m => m.status === 'discontinued'),
      completed: enhancedMedications.filter(m => m.status === 'completed' || m.isExpired),
      all: enhancedMedications
    };
    
    // Check for drug interactions among active medications
    let interactionWarnings = [];
    if (groupedMedications.active.length > 1) {
      const interactionCheck = await this.checkDrugInteractions({
        medications: groupedMedications.active.map(m => m.medicationName)
      }, practiceContext);
      
      if (interactionCheck.hasInteractions) {
        interactionWarnings = interactionCheck.data || [];
      }
    }
    
    // Generate summary
    const summary = this.generateMedicationSummary(groupedMedications, practiceContext);
    
    // Generate alerts
    const alerts = this.generateMedicationAlerts(enhancedMedications, practiceContext);
    
    // Format response based on requested view
    const viewType = params.view || 'all';
    const medicationsToReturn = viewType === 'grouped' ? groupedMedications : groupedMedications[params.status || 'all'];
    
    return {
      success: true,
      data: medicationsToReturn,
      count: Array.isArray(medicationsToReturn) ? medicationsToReturn.length : {
        active: groupedMedications.active.length,
        discontinued: groupedMedications.discontinued.length,
        completed: groupedMedications.completed.length,
        total: enhancedMedications.length
      },
      summary: summary,
      alerts: alerts,
      interactions: interactionWarnings,
      message: this.generateMedicationMessage(groupedMedications, practiceContext),
      lastUpdated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting medications:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בטעינת תרופות: ${error.message}`
        : `Error loading medications: ${error.message}`
    };
  }
}

// Helper: Format medication display
formatMedicationDisplay(med, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  let display = `${med.medicationName}`;
  
  if (med.dosage) {
    display += ` ${med.dosage}${med.dosageUnit || 'mg'}`;
  }
  
  if (med.frequency) {
    display += ` - ${med.frequencyDetails?.hebrew || med.frequency}`;
  }
  
  if (med.route && med.route !== 'oral') {
    const routeText = {
      'topical': isHebrew ? 'למריחה' : 'topical',
      'injection': isHebrew ? 'זריקה' : 'injection',
      'inhaled': isHebrew ? 'שאיפה' : 'inhaled'
    };
    display += ` (${routeText[med.route] || med.route})`;
  }
  
  if (med.isExpiring) {
    display += isHebrew ? ' ⚠️ עומד להסתיים' : ' ⚠️ Expiring soon';
  }
  
  if (med.needsRefill) {
    display += isHebrew ? ' 🔄 נדרש חידוש' : ' 🔄 Needs refill';
  }
  
  return display;
}

// Helper: Calculate medication priority
calculateMedicationPriority(med) {
  let priority = 0;
  
  // Active medications have higher priority
  if (med.status === 'active') priority += 100;
  
  // Expiring medications are high priority
  if (med.isExpiring) priority += 50;
  
  // Medications needing refill
  if (med.needsRefill) priority += 30;
  
  // Critical medications (based on common critical drug categories)
  const criticalMeds = ['insulin', 'warfarin', 'digoxin', 'levothyroxine', 'antibiotic'];
  if (criticalMeds.some(critical => med.medicationName?.toLowerCase().includes(critical))) {
    priority += 40;
  }
  
  // Recently prescribed
  if (med.prescribedDate) {
    const daysSincePrescribed = Math.floor((new Date() - new Date(med.prescribedDate)) / (1000 * 60 * 60 * 24));
    if (daysSincePrescribed < 7) priority += 20;
  }
  
  return priority;
}

// Helper: Generate medication summary
generateMedicationSummary(grouped, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  const summary = {
    total: grouped.all.length,
    active: grouped.active.length,
    discontinued: grouped.discontinued.length,
    completed: grouped.completed.length
  };
  
  // Count by route
  const byRoute = {};
  grouped.active.forEach(med => {
    const route = med.route || 'oral';
    byRoute[route] = (byRoute[route] || 0) + 1;
  });
  summary.byRoute = byRoute;
  
  // Average medications per day
  const dailyMeds = grouped.active.reduce((total, med) => {
    if (med.frequencyDetails?.times) {
      return total + med.frequencyDetails.times;
    }
    return total + 1;
  }, 0);
  summary.dailyPills = dailyMeds;
  
  // Text summary
  summary.text = isHebrew 
    ? `${summary.active} תרופות פעילות, ${dailyMeds} מנות ביום`
    : `${summary.active} active medications, ${dailyMeds} daily doses`;
  
  return summary;
}

// Helper: Generate alerts
generateMedicationAlerts(medications, practiceContext) {
  const alerts = [];
  const isHebrew = practiceContext.language === 'he';
  
  // Check for expiring medications
  const expiring = medications.filter(m => m.isExpiring && m.status === 'active');
  if (expiring.length > 0) {
    alerts.push({
      type: 'warning',
      message: isHebrew 
        ? `${expiring.length} תרופות עומדות להסתיים בשבוע הקרוב`
        : `${expiring.length} medications expiring within a week`,
      medications: expiring.map(m => m.medicationName)
    });
  }
  
  // Check for medications needing refill
  const needRefill = medications.filter(m => m.needsRefill);
  if (needRefill.length > 0) {
    alerts.push({
      type: 'info',
      message: isHebrew 
        ? `${needRefill.length} תרופות דורשות חידוש מרשם`
        : `${needRefill.length} medications need refill`,
      medications: needRefill.map(m => m.medicationName)
    });
  }
  
  // Check for high pill burden
  const activeMeds = medications.filter(m => m.status === 'active');
  if (activeMeds.length >= 5) {
    alerts.push({
      type: 'info',
      message: isHebrew 
        ? 'ריבוי תרופות - מומלץ לבצע סקירת תרופות'
        : 'Polypharmacy detected - medication review recommended'
    });
  }
  
  return alerts;
}

// Helper: Generate message
generateMedicationMessage(grouped, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  if (grouped.all.length === 0) {
    return isHebrew ? 'לא נמצאו תרופות' : 'No medications found';
  }
  
  const parts = [];
  
  if (grouped.active.length > 0) {
    parts.push(isHebrew 
      ? `${grouped.active.length} תרופות פעילות`
      : `${grouped.active.length} active medications`);
  }
  
  if (grouped.discontinued.length > 0) {
    parts.push(isHebrew 
      ? `${grouped.discontinued.length} הופסקו`
      : `${grouped.discontinued.length} discontinued`);
  }
  
  if (grouped.completed.length > 0) {
    parts.push(isHebrew 
      ? `${grouped.completed.length} הסתיימו`
      : `${grouped.completed.length} completed`);
  }
  
  return parts.join(isHebrew ? ', ' : ', ');
}
```

## Testing Checklist
- [ ] Test with no medications
- [ ] Test with active medications only
- [ ] Test with mixed status medications
- [ ] Test expiring medication detection
- [ ] Test refill needed detection
- [ ] Test interaction checking
- [ ] Test filtering by status
- [ ] Test filtering by date
- [ ] Test priority sorting
- [ ] Test Hebrew responses
- [ ] Test English responses

## Notes
- Consider medication reconciliation features
- Add medication history timeline
- Implement medication reminders
- Add cost information if available