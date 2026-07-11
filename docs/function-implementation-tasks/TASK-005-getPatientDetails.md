# TASK-005: Implement getPatientDetails Function

## Function Details
- **Name**: getPatientDetails
- **Category**: Patient Management
- **Priority**: High
- **Backend Route**: GET `/patients/:id` ✅ (Exists)

## Current Implementation
```javascript
async getPatientDetails(params, practiceContext) {
  const response = await this.callAPI(`/patients/${params.patientId}`, 'GET', null, practiceContext);
  return {
    success: true,
    data: response.data
  };
}
```

## Required Implementation

### 1. Add Validation
- Validate patientId format
- Handle different ID types (MongoDB ObjectId, National ID)

### 2. Enhance Data Retrieval
- Include related data based on params
- Add calculated fields (age, next appointment)
- Format dates appropriately

### 3. Add Localization
- Format response based on language
- Localize field labels
- Handle country-specific fields

## Implementation Code
```javascript
async getPatientDetails(params, practiceContext, session) {
  try {
    // Extract patientId separately to check context
    let { patientId, ...queryOptions } = params;
    
    // Check context if no patientId provided
    if (!patientId && session?.currentContext?.patientId) {
      patientId = session.currentContext.patientId;
      console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
    }
    
    // Validate patient ID exists (either from params or context)
    if (!patientId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
        : 'Patient ID required. Please search for a patient first');
    }
    
    // Include related data flags
    const queryParams = {
      includeHistory: params.includeHistory || false,
      includeDocuments: params.includeDocuments || false,
      includeMedications: params.includeMedications || false,
      includeAppointments: params.includeAppointments || false,
      includeLabResults: params.includeLabResults || false
    };
    
    // Get patient details
    const response = await this.callAPI(
      `/patients/${params.patientId}`, 
      'GET', 
      queryParams, 
      practiceContext
    );
    
    if (!response.data) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מטופל לא נמצא' 
        : 'Patient not found');
    }
    
    const patient = response.data;
    
    // Calculate age if birth date exists
    if (patient.dateOfBirth) {
      const birthDate = new Date(patient.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      patient.age = age;
      patient.ageDisplay = practiceContext.language === 'he' 
        ? `${age} שנים` 
        : `${age} years old`;
    }
    
    // Format the response based on language
    const formattedResponse = practiceContext.language === 'he' 
      ? this.formatPatientDetailsHebrew(patient, practiceContext)
      : this.formatPatientDetailsEnglish(patient, practiceContext);
    
    return {
      success: true,
      data: patient,
      formattedData: formattedResponse,
      message: practiceContext.language === 'he' 
        ? `פרטי המטופל ${patient.firstName} ${patient.lastName} נטענו בהצלחה`
        : `Patient details for ${patient.firstName} ${patient.lastName} loaded successfully`,
      summary: this.generatePatientSummary(patient, practiceContext)
    };
    
  } catch (error) {
    console.error('Error getting patient details:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בטעינת פרטי המטופל: ${error.message}`
        : `Error loading patient details: ${error.message}`
    };
  }
}

// Helper function to format Hebrew response
formatPatientDetailsHebrew(patient, practiceContext) {
  return {
    'פרטים אישיים': {
      'שם מלא': `${patient.firstName} ${patient.lastName}`,
      'תעודת זהות': patient.nationalId || 'לא צוין',
      'תאריך לידה': patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('he-IL') : 'לא צוין',
      'גיל': patient.ageDisplay || 'לא ידוע',
      'מין': patient.gender === 'male' ? 'זכר' : patient.gender === 'female' ? 'נקבה' : 'לא צוין'
    },
    'פרטי קשר': {
      'טלפון': patient.phone || 'לא צוין',
      'אימייל': patient.email || 'לא צוין',
      'כתובת': `${patient.street || ''} ${patient.buildingNumber || ''}, ${patient.city || ''} ${patient.zipCode || ''}`.trim() || 'לא צוינה'
    },
    'מידע רפואי': {
      'קופת חולים': patient.healthFund || 'לא צוינה',
      'רופא משפחה': patient.familyDoctor || 'לא צוין',
      'אלרגיות': patient.allergiesCount ? `${patient.allergiesCount} אלרגיות רשומות` : 'אין אלרגיות רשומות',
      'תרופות קבועות': patient.medicationsCount ? `${patient.medicationsCount} תרופות` : 'אין תרופות קבועות'
    }
  };
}

// Helper function to format English response
formatPatientDetailsEnglish(patient, practiceContext) {
  return {
    'Personal Information': {
      'Full Name': `${patient.firstName} ${patient.lastName}`,
      'ID Number': patient.socialSecurityNumber || patient.nationalId || 'Not specified',
      'Date of Birth': patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('en-US') : 'Not specified',
      'Age': patient.ageDisplay || 'Unknown',
      'Gender': patient.gender || 'Not specified'
    },
    'Contact Information': {
      'Phone': patient.phone || 'Not specified',
      'Email': patient.email || 'Not specified',
      'Address': `${patient.street || ''} ${patient.buildingNumber || ''}, ${patient.city || ''} ${patient.zipCode || ''}`.trim() || 'Not specified'
    },
    'Medical Information': {
      'Insurance': patient.insuranceProvider || patient.healthFund || 'Not specified',
      'Primary Physician': patient.familyDoctor || 'Not specified',
      'Allergies': patient.allergiesCount ? `${patient.allergiesCount} allergies on record` : 'No allergies recorded',
      'Medications': patient.medicationsCount ? `${patient.medicationsCount} medications` : 'No regular medications'
    }
  };
}

// Helper function to generate summary
generatePatientSummary(patient, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  let summary = isHebrew 
    ? `${patient.firstName} ${patient.lastName}`
    : `${patient.firstName} ${patient.lastName}`;
    
  if (patient.age) {
    summary += isHebrew ? `, בן/בת ${patient.age}` : `, ${patient.age} years old`;
  }
  
  if (patient.lastVisit) {
    const lastVisitDate = new Date(patient.lastVisit).toLocaleDateString(
      isHebrew ? 'he-IL' : 'en-US'
    );
    summary += isHebrew 
      ? `. ביקור אחרון: ${lastVisitDate}`
      : `. Last visit: ${lastVisitDate}`;
  }
  
  if (patient.nextAppointment) {
    const nextDate = new Date(patient.nextAppointment).toLocaleDateString(
      isHebrew ? 'he-IL' : 'en-US'
    );
    summary += isHebrew 
      ? `. תור הבא: ${nextDate}`
      : `. Next appointment: ${nextDate}`;
  }
  
  return summary;
}
```

## Testing Checklist
- [ ] Test with valid patient ID
- [ ] Test with invalid patient ID
- [ ] Test with non-existent patient
- [ ] Test age calculation
- [ ] Test with includeHistory flag
- [ ] Test with includeDocuments flag
- [ ] Test Hebrew formatting
- [ ] Test English formatting
- [ ] Test with missing optional fields

## Notes
- Consider caching frequently accessed patient details
- Add option to include photo/avatar if available
- Consider HIPAA compliance for data exposure