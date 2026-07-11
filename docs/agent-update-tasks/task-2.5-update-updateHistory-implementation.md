# Task 2.5: Update updateHistory Implementation

## 📋 **Task Overview**
**Phase:** 2 (Search & Display Functions)  
**Time Estimate:** 10 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

Update the `updateHistory` method implementation to work with the new patient schema for patient identification while maintaining medical history update functionality.

## 🎯 **Objective**
Modernize the medical history update to:
- Use new schema fields for patient identification
- Maintain all medical history update functionality
- Provide localized success/error messages
- Ensure compatibility with new patient schema

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Lines:** 1073-1135  
**Method:** `async updateHistory(params, practiceContext)`

## 🔍 **Current Code Issues**
- Patient identification may use old field names
- No country-specific messaging
- May reference old patient display format

## ✅ **New Implementation**
```javascript
async updateHistory(params, practiceContext) {
  try {
    console.log('✏️ AGENT: Update history request:', JSON.stringify(params, null, 2));

    const missingFields = [];
    if (!params.patient_name) missingFields.push('patient_name');
    if (!params.entry_id) missingFields.push('entry_id');

    if (missingFields.length > 0) {
      const country = this.getClinicCountry(practiceContext);
      const fieldMessages = {
        'Israel': {
          patient_name: 'שם המטופל',
          entry_id: 'מזהה הרשומה'
        },
        'United States': {
          patient_name: 'patient name',
          entry_id: 'entry ID'
        }
      };
      
      const countryMessages = fieldMessages[country] || fieldMessages['Israel'];
      const missingList = missingFields.map(field => countryMessages[field]).join(', ');
      
      return {
        success: false,
        error: country === 'Israel'
          ? `חסרים שדות נדרשים: ${missingList}`
          : `Missing required fields: ${missingList}`
      };
    }

    // First, find the patient
    const patientResponse = await axios.get(`${this.intellicareApiBase}/patients/search`, {
      params: { q: params.patient_name },
      headers: this.getAuthHeaders(practiceContext),
      timeout: 10000
    });

    if (!patientResponse.data.success || patientResponse.data.data.length === 0) {
      const country = this.getClinicCountry(practiceContext);
      return {
        success: false,
        message: country === 'Israel'
          ? `לא נמצא מטופל עם השם: ${params.patient_name}`
          : `No patient found with name: ${params.patient_name}`
      };
    }

    const patient = patientResponse.data.data[0];
    console.log(`👤 AGENT: Found patient: ${patient.firstName} ${patient.lastName}`);

    // Prepare update data
    const updateData = {};
    if (params.category) updateData.category = params.category;
    if (params.diagnosis) updateData.diagnosis = params.diagnosis;
    if (params.symptoms) updateData.symptoms = params.symptoms;
    if (params.treatment) updateData.treatment = params.treatment;
    if (params.notes) updateData.notes = params.notes;
    if (params.followUpDate) updateData.followUpDate = params.followUpDate;

    // Update the history entry
    const response = await axios.put(
      `${this.intellicareApiBase}/patients/${patient._id}/history/${params.entry_id}`,
      updateData,
      {
        headers: this.getAuthHeaders(practiceContext),
        timeout: 30000
      }
    );

    if (response.data.success) {
      const country = this.getClinicCountry(practiceContext);
      return {
        success: true,
        message: country === 'Israel'
          ? `✅ היסטוריה רפואית עודכנה בהצלחה עבור ${patient.firstName} ${patient.lastName}`
          : `✅ Medical history updated successfully for ${patient.firstName} ${patient.lastName}`
      };
    } else {
      const country = this.getClinicCountry(practiceContext);
      return {
        success: false,
        error: country === 'Israel'
          ? `שגיאה בעדכון היסטוריה: ${response.data.message || 'שגיאה לא ידועה'}`
          : `Error updating history: ${response.data.message || 'Unknown error'}`
      };
    }
  } catch (error) {
    console.error('❌ AGENT: Update history error:', error);
    const country = this.getClinicCountry(practiceContext);
    
    return {
      success: false,
      error: country === 'Israel'
        ? `שגיאה בעדכון היסטוריה: ${error.response?.data?.message || error.message}`
        : `Failed to update history: ${error.response?.data?.message || error.message}`
    };
  }
}
```

## 🔧 **Key Changes**
1. **✅ New schema field usage:**
   - Uses `firstName` + `lastName` for patient identification
   - Uses `patient._id` for history update API calls
   - Displays patient info with new schema format

2. **✅ Enhanced patient lookup:**
   - Uses search API to find patient by name
   - Handles patient not found scenarios
   - Logs patient identification for debugging

3. **✅ Improved error handling:**
   - Localized missing field messages
   - Country-specific field name translations
   - Better error message formatting

4. **✅ Localized messages:**
   - Hebrew messages for Israeli practices
   - English messages for US practices
   - Country-appropriate success and error messages

## ⚠️ **Safety Notes**
- **✅ SAFE:** Only changing patient identification and messaging logic
- **✅ SAFE:** API call structure remains the same
- **✅ SAFE:** Return format stays consistent
- **✅ SAFE:** Uses existing helper methods (getClinicCountry)
- **❌ DON'T TOUCH:** Function calling detection logic

## 🧪 **Testing After Change**
1. **Test Israeli practice:**
   - Update history for Israeli patient
   - Verify Hebrew success/error messages
   - Check patient identification

2. **Test US practice:**
   - Update history for US patient
   - Verify English success/error messages
   - Check patient identification

3. **Test edge cases:**
   - Patient not found
   - Invalid entry ID
   - Missing required fields
   - API errors

4. **Test update functionality:**
   - Update different history fields
   - Verify partial updates work
   - Check field validation

## ✅ **Success Criteria**
- [ ] Patient lookup works with new schema
- [ ] History update uses correct patient ID
- [ ] Localized success and error messages
- [ ] Proper error handling for missing patients
- [ ] Country-specific field name translations
- [ ] Function calling still works

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 3.1:** Update Error Messages (Phase 3)

## 📝 **Notes**
- Uses helper methods from previous tasks (getClinicCountry)
- Test with both Israeli and US patient data
- Verify update functionality works correctly
- Check patient identification accuracy
- This completes Phase 2 (Search & Display Functions)
