# TASK-003: Implement deletePatient Function

## Function Details
- **Name**: deletePatient
- **Category**: Patient Management
- **Priority**: High
- **Backend Route**: DELETE `/patients/:id` ✅ (Exists)

## Current Implementation
```javascript
async deletePatient(params, practiceContext) {
  const response = await this.callAPI(`/patients/${params.patientId}`, 'DELETE', { reason: params.reason }, practiceContext);
  return {
    success: true,
    data: response.data
  };
}
```

## Required Implementation

### 1. Add Proper Validation
- Validate patientId format (MongoDB ObjectId or national ID)
- Validate reason is provided and not empty
- Check user has permission to delete

### 2. Add Safety Checks
- Confirm patient exists before deletion
- Check for dependent data (appointments, prescriptions, etc.)
- Add soft delete option

### 3. Enhance Response
- Return deleted patient info
- Add audit trail information
- Provide undo information if soft delete

### 4. Add Localization
- Hebrew: "המטופל נמחק בהצלחה"
- English: "Patient deleted successfully"
- Error messages in both languages

## Implementation Code
```javascript
async deletePatient(params, practiceContext, session) {
  try {
    // Extract patientId separately to check context
    let { patientId, ...deleteData } = params;
    
    // Check context if no patientId provided
    if (!patientId && session?.currentContext?.patientId) {
      patientId = session.currentContext.patientId;
      console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
    }
    
    // Validate patientId exists (either from params or context)
    if (!patientId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
        : 'Patient ID required. Please search for a patient first');
    }
    
    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error(practiceContext.language === 'he' 
        ? 'נדרשת סיבה למחיקה' 
        : 'Deletion reason is required');
    }
    
    // Check if patient exists first
    const checkResponse = await this.callAPI(
      `/patients/${params.patientId}`, 
      'GET', 
      null, 
      practiceContext
    );
    
    if (!checkResponse.data) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מטופל לא נמצא' 
        : 'Patient not found');
    }
    
    const patientName = `${checkResponse.data.firstName} ${checkResponse.data.lastName}`;
    
    // Perform deletion with reason
    const deleteData = {
      reason: params.reason,
      deletedBy: practiceContext.userId || 'agent',
      deletedAt: new Date().toISOString(),
      softDelete: params.softDelete !== false // Default to soft delete
    };
    
    const response = await this.callAPI(
      `/patients/${params.patientId}`, 
      'DELETE', 
      deleteData, 
      practiceContext
    );
    
    return {
      success: true,
      data: response.data,
      deletedPatient: patientName,
      message: practiceContext.language === 'he' 
        ? `המטופל ${patientName} נמחק בהצלחה. סיבה: ${params.reason}`
        : `Patient ${patientName} deleted successfully. Reason: ${params.reason}`,
      canUndo: deleteData.softDelete,
      undoInfo: deleteData.softDelete ? {
        message: practiceContext.language === 'he' 
          ? 'ניתן לשחזר את המטופל תוך 30 יום'
          : 'Patient can be restored within 30 days',
        restoreEndpoint: `/patients/${params.patientId}/restore`
      } : null
    };
    
  } catch (error) {
    console.error('Error deleting patient:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה במחיקת המטופל: ${error.message}`
        : `Error deleting patient: ${error.message}`
    };
  }
}
```

## Testing Checklist
- [ ] Test with valid patient ID
- [ ] Test with invalid patient ID format
- [ ] Test with non-existent patient
- [ ] Test without reason
- [ ] Test soft delete vs hard delete
- [ ] Test Hebrew responses
- [ ] Test English responses
- [ ] Test audit logging
- [ ] Test permissions

## Notes
- Soft delete is preferred to maintain data integrity
- Consider archiving instead of deletion for compliance
- Ensure cascade handling for related records