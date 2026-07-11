# TASK-007: Implement getMedicalHistory Function

## Function Details
- **Name**: getMedicalHistory
- **Category**: Medical History
- **Priority**: Critical
- **Backend Route**: GET `/patients/:id/history` ✅ (Exists)

## Current Implementation
```javascript
async getMedicalHistory(params, practiceContext) {
  const response = await this.callAPI(`/patients/${params.patientId}/history`, 'GET', {}, practiceContext);
  return {
    success: true,
    data: response.data
  };
}
```

## Required Implementation

### 1. Enhanced Query Options
- Filter by date range
- Filter by diagnosis type
- Filter by severity
- Search by keywords
- Pagination support

### 2. Data Formatting
- Sort chronologically (newest first)
- Group by visit type
- Extract key information
- Calculate trends

### 3. Medical Intelligence
- Identify patterns
- Flag concerning changes
- Calculate risk scores
- Suggest follow-ups

## Implementation Code
```javascript
async getMedicalHistory(params, practiceContext) {
  try {
    // Validate patient ID
    if (!params.patientId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מזהה מטופל חסר' 
        : 'Patient ID is required');
    }
    
    // Build query parameters
    const queryParams = {
      patientId: params.patientId,
      limit: params.limit || 50,
      offset: params.offset || 0,
      sortBy: params.sortBy || 'date',
      sortOrder: params.sortOrder || 'desc'
    };
    
    // Add filters if provided
    if (params.startDate) {
      queryParams.startDate = new Date(params.startDate).toISOString();
    }
    if (params.endDate) {
      queryParams.endDate = new Date(params.endDate).toISOString();
    }
    if (params.diagnosisType) {
      queryParams.diagnosisType = params.diagnosisType;
    }
    if (params.severity) {
      queryParams.severity = params.severity;
    }
    if (params.keyword) {
      queryParams.search = params.keyword;
    }
    if (params.visitType) {
      queryParams.visitType = params.visitType;
    }
    
    // Fetch medical history
    const response = await this.callAPI(
      `/patients/${params.patientId}/history`, 
      'GET', 
      queryParams, 
      practiceContext
    );
    
    const history = response.data.history || response.data || [];
    const totalCount = response.data.total || history.length;
    
    if (!Array.isArray(history) || history.length === 0) {
      return {
        success: true,
        data: [],
        total: 0,
        message: practiceContext.language === 'he' 
          ? 'לא נמצאה היסטוריה רפואית למטופל זה'
          : 'No medical history found for this patient',
        summary: this.generateEmptyHistorySummary(practiceContext)
      };
    }
    
    // Process and enhance history entries
    const processedHistory = history.map(entry => this.processHistoryEntry(entry, practiceContext));
    
    // Generate medical insights
    const insights = this.generateMedicalInsights(processedHistory, practiceContext);
    
    // Create timeline summary
    const timeline = this.createMedicalTimeline(processedHistory, practiceContext);
    
    // Format for display
    const formattedHistory = this.formatHistoryForDisplay(processedHistory, practiceContext);
    
    return {
      success: true,
      data: formattedHistory,
      total: totalCount,
      hasMore: (queryParams.offset + queryParams.limit) < totalCount,
      insights: insights,
      timeline: timeline,
      message: practiceContext.language === 'he' 
        ? `נמצאו ${processedHistory.length} רשומות רפואיות`
        : `Found ${processedHistory.length} medical records`,
      summary: this.generateHistoryOverview(processedHistory, practiceContext)
    };
    
  } catch (error) {
    console.error('Error fetching medical history:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בטעינת היסטוריה רפואית: ${error.message}`
        : `Error loading medical history: ${error.message}`
    };
  }
}

// Helper function to process individual history entry
processHistoryEntry(entry, practiceContext) {
  const processed = {
    ...entry,
    displayDate: this.formatMedicalDate(entry.date, practiceContext),
    ageAtVisit: this.calculateAgeAtVisit(entry.date, entry.patientBirthDate),
    riskLevel: this.assessEntryRisk(entry),
    keyFindings: this.extractKeyFindings(entry),
    medications: this.processMedications(entry.medications || []),
    followUpStatus: this.assessFollowUpStatus(entry)
  };
  
  return processed;
}

// Helper function to generate medical insights
generateMedicalInsights(history, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  const insights = [];
  
  // Check for chronic conditions
  const chronicConditions = this.identifyChronicConditions(history);
  if (chronicConditions.length > 0) {
    insights.push({
      type: 'chronic_conditions',
      severity: 'info',
      title: isHebrew ? 'מצבים כרוניים' : 'Chronic Conditions',
      description: chronicConditions.join(', '),
      recommendations: this.getChronicConditionRecommendations(chronicConditions, isHebrew)
    });
  }
  
  // Check medication patterns
  const medicationInsights = this.analyzeMedicationPatterns(history, isHebrew);
  if (medicationInsights) {
    insights.push(medicationInsights);
  }
  
  // Check for concerning trends
  const trendInsights = this.analyzeTrends(history, isHebrew);
  if (trendInsights.length > 0) {
    insights.push(...trendInsights);
  }
  
  // Check follow-up compliance
  const followUpInsights = this.analyzeFollowUpCompliance(history, isHebrew);
  if (followUpInsights) {
    insights.push(followUpInsights);
  }
  
  return insights;
}

// Helper function to create medical timeline
createMedicalTimeline(history, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  return history.slice(0, 10).map(entry => ({
    date: entry.displayDate,
    type: entry.type || 'visit',
    title: entry.chiefComplaint || entry.diagnosis || (isHebrew ? 'ביקור רפואי' : 'Medical Visit'),
    description: this.createTimelineDescription(entry, isHebrew),
    severity: entry.severity || 'routine',
    icon: this.getTimelineIcon(entry.type)
  }));
}

// Helper function to format history for display
formatHistoryForDisplay(history, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  return history.map(entry => ({
    id: entry._id || entry.id,
    date: entry.displayDate,
    type: entry.type,
    complaint: entry.chiefComplaint,
    diagnosis: entry.diagnosis,
    treatment: entry.treatment,
    medications: entry.medications?.map(med => 
      typeof med === 'string' ? med : `${med.name} ${med.dosage || ''}${med.unit || ''}`
    ).join(', '),
    severity: entry.severity,
    riskLevel: entry.riskLevel,
    provider: entry.recordedBy,
    summary: this.createEntrySummary(entry, isHebrew),
    badges: this.createEntryBadges(entry, isHebrew)
  }));
}

// Helper function to generate history overview
generateHistoryOverview(history, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  const overview = [];
  
  // Total visits
  overview.push(isHebrew 
    ? `סה"כ ${history.length} ביקורים`
    : `Total ${history.length} visits`);
  
  // Date range
  if (history.length > 0) {
    const earliest = new Date(history[history.length - 1].date);
    const latest = new Date(history[0].date);
    const monthsSpan = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24 * 30));
    
    overview.push(isHebrew 
      ? `תקופה: ${monthsSpan} חודשים`
      : `Period: ${monthsSpan} months`);
  }
  
  // Most common diagnoses
  const diagnoses = history
    .filter(entry => entry.diagnosis)
    .map(entry => entry.diagnosis)
    .reduce((acc, diagnosis) => {
      acc[diagnosis] = (acc[diagnosis] || 0) + 1;
      return acc;
    }, {});
  
  const topDiagnosis = Object.entries(diagnoses)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (topDiagnosis) {
    overview.push(isHebrew 
      ? `אבחנה שכיחה: ${topDiagnosis[0]} (${topDiagnosis[1]} פעמים)`
      : `Common diagnosis: ${topDiagnosis[0]} (${topDiagnosis[1]} times)`);
  }
  
  return overview.join(' | ');
}

// Additional helper functions
formatMedicalDate(date, practiceContext) {
  const d = new Date(date);
  const isHebrew = practiceContext.language === 'he';
  
  if (isHebrew) {
    return d.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } else {
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

assessEntryRisk(entry) {
  if (entry.severity === 'critical') return 'high';
  if (entry.diagnosis && ['emergency', 'acute', 'severe'].some(term => 
    entry.diagnosis.toLowerCase().includes(term))) return 'high';
  if (entry.severity === 'moderate') return 'medium';
  return 'low';
}

extractKeyFindings(entry) {
  const findings = [];
  
  if (entry.chiefComplaint) findings.push(entry.chiefComplaint);
  if (entry.diagnosis) findings.push(entry.diagnosis);
  if (entry.vitalSigns?.bloodPressure) findings.push(`BP: ${entry.vitalSigns.bloodPressure}`);
  if (entry.medications?.length > 0) findings.push(`${entry.medications.length} medications`);
  
  return findings.slice(0, 3);
}

processMedications(medications) {
  return medications.map(med => {
    if (typeof med === 'string') {
      return { name: med, display: med };
    }
    return {
      ...med,
      display: `${med.name} ${med.dosage || ''}${med.unit || ''} ${med.frequency || ''}`
    };
  });
}
```

## Testing Checklist
- [ ] Test with valid patient ID
- [ ] Test with invalid patient ID
- [ ] Test date range filtering
- [ ] Test keyword search
- [ ] Test pagination
- [ ] Test sorting options
- [ ] Test empty history
- [ ] Test medical insights generation
- [ ] Test timeline creation
- [ ] Test Hebrew responses
- [ ] Test English responses

## Notes
- Consider caching frequently accessed histories
- Add export functionality for patient records
- Implement medical history templates for common conditions
- Add integration with diagnostic imaging systems