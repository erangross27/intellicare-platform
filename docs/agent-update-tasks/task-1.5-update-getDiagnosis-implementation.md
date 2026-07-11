# Task 1.5: Update getDiagnosis Implementation

## 📋 **Task Overview**
**Phase:** 1 (Critical Functions)  
**Time Estimate:** 15 minutes  
**Risk Level:** LOW  
**Priority:** HIGH  

Update the `getDiagnosis` method implementation to handle the new schema by retrieving patient information from the database instead of using direct age/gender parameters.

## 🎯 **Objective**
Modernize the diagnosis implementation to:
- Remove direct age/gender parameter usage
- Retrieve patient info from database if patient name provided
- Calculate age from dateOfBirth
- Work with symptoms-only when no patient context

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Lines:** 1138-1208  
**Method:** `async getDiagnosis(params, practiceContext)`

## 🔍 **Current Code Issues**
- Uses `params.age` and `params.gender` directly
- Hardcoded field access
- No database lookup for patient context

## ✅ **New Implementation**
```javascript
async getDiagnosis(params, practiceContext) {
  try {
    console.log('🩺 AGENT: Get diagnosis request:', JSON.stringify(params, null, 2));

    if (!params.symptoms) {
      const country = this.getClinicCountry(practiceContext);
      return {
        success: false,
        error: country === 'Israel' 
          ? 'נדרשים תסמינים לאבחון'
          : 'Symptoms are required for diagnosis'
      };
    }

    // Prepare diagnosis request
    const diagnosisData = {
      symptoms: params.symptoms,
      language: this.getClinicCountry(practiceContext) === 'Israel' ? 'he' : 'en'
    };

    // If patient name provided, get age from database
    if (params.patient_name) {
      try {
        console.log(`👤 AGENT: Looking up patient: ${params.patient_name}`);
        
        const patientResponse = await axios.get(`${this.intellicareApiBase}/patients/search`, {
          params: { q: params.patient_name },
          headers: this.getAuthHeaders(practiceContext),
          timeout: 10000
        });

        if (patientResponse.data.success && patientResponse.data.data.length > 0) {
          const patient = patientResponse.data.data[0];
          
          // Calculate age from dateOfBirth
          if (patient.dateOfBirth) {
            const age = this.calculateAge(patient.dateOfBirth);
            diagnosisData.age = age;
            console.log(`👤 AGENT: Found patient: ${patient.firstName} ${patient.lastName}, age: ${age}`);
          }
          
          // Note: gender removed from new schema, diagnosis will work without it
        } else {
          console.log(`⚠️ AGENT: Patient "${params.patient_name}" not found, proceeding with symptoms only`);
        }
      } catch (error) {
        console.log('⚠️ AGENT: Could not retrieve patient info for diagnosis, proceeding with symptoms only');
        console.error('Patient lookup error:', error.message);
      }
    }

    // Call diagnosis API
    console.log('🩺 AGENT: Calling diagnosis API with:', diagnosisData);
    
    const response = await axios.post(`${this.intellicareApiBase}/diagnosis/predict`, diagnosisData, {
      headers: this.getAuthHeaders(practiceContext),
      timeout: 30000
    });

    if (response.data.success) {
      const country = this.getClinicCountry(practiceContext);
      const diagnosis = response.data.data.diagnosis;
      const recommendations = response.data.data.recommendations?.join(', ') || '';
      
      const message = country === 'Israel'
        ? `🩺 אבחנה: ${diagnosis}\n📋 המלצות: ${recommendations || 'אין המלצות נוספות'}`
        : `🩺 Diagnosis: ${diagnosis}\n📋 Recommendations: ${recommendations || 'No additional recommendations'}`;

      return {
        success: true,
        message: message
      };
    } else {
      const country = this.getClinicCountry(practiceContext);
      return {
        success: false,
        error: country === 'Israel'
          ? `שגיאה באבחון: ${response.data.message || 'אבחון נכשל'}`
          : `Diagnosis error: ${response.data.message || 'Diagnosis failed'}`
      };
    }
  } catch (error) {
    console.error('❌ AGENT: Diagnosis error:', error);
    const country = this.getClinicCountry(practiceContext);
    
    return {
      success: false,
      error: country === 'Israel'
        ? `שגיאה באבחון: ${error.response?.data?.message || error.message}`
        : `Diagnosis error: ${error.response?.data?.message || error.message}`
    };
  }
}
```

## 🔧 **Helper Method to Add**
```javascript
calculateAge(dateOfBirth) {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1;
  }
  return age;
}
```

## 🔧 **Key Changes**
1. **✅ Removed direct parameter usage:**
   - No more `params.age` or `params.gender`
   - Dynamic patient lookup instead

2. **✅ Added patient database lookup:**
   - Search for patient by name if provided
   - Calculate age from dateOfBirth
   - Graceful fallback if patient not found

3. **✅ Enhanced error handling:**
   - Localized error messages (Hebrew/English)
   - Proper fallback when patient lookup fails
   - Better logging for debugging

4. **✅ Improved language support:**
   - Dynamic language detection for diagnosis API
   - Localized response messages
   - Country-specific formatting

## ⚠️ **Safety Notes**
- **✅ SAFE:** Only changing parameter handling and patient lookup
- **✅ SAFE:** API call structure remains the same
- **✅ SAFE:** Return format stays consistent
- **✅ SAFE:** Graceful fallback when patient not found
- **❌ DON'T TOUCH:** Function calling detection logic

## 🧪 **Testing After Change**
1. **Test with patient context:**
   - Provide symptoms + patient name
   - Verify patient lookup works
   - Check age calculation

2. **Test without patient context:**
   - Provide symptoms only
   - Verify diagnosis still works
   - Check fallback behavior

3. **Test error cases:**
   - Patient not found
   - Invalid patient name
   - API errors

4. **Test both languages:**
   - Israeli practice (Hebrew)
   - US practice (English)

## ✅ **Success Criteria**
- [ ] Patient lookup works correctly
- [ ] Age calculated from dateOfBirth
- [ ] Diagnosis works with and without patient context
- [ ] Localized error messages
- [ ] Function calling still works
- [ ] Graceful fallback behavior

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 2.1:** Update getPatientFunction Schema (Phase 2)

## 📝 **Notes**
- This completes Phase 1 (Critical Functions)
- Test all Phase 1 changes before proceeding to Phase 2
- Verify function calling still works correctly
- Check both Israeli and US practice scenarios
