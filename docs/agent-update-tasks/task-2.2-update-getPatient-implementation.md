# Task 2.2: Update getPatient Implementation

## 📋 **Task Overview**
**Phase:** 2 (Search & Display Functions)  
**Time Estimate:** 15 minutes  
**Risk Level:** LOW  
**Priority:** MEDIUM  

Update the `getPatient` method implementation to work with the new patient schema and provide country-specific patient information display.

## 🎯 **Objective**
Modernize the patient search implementation to:
- Work with new schema fields (firstName, lastName, dateOfBirth)
- Display appropriate fields for Israeli vs US patients
- Calculate age from dateOfBirth
- Provide localized patient information formatting

## 📁 **File to Modify**
**File:** `backend/services/agentService.js`  
**Lines:** 633-694  
**Method:** `async getPatient(params, practiceContext)`

## 🔍 **Current Code Issues**
- Uses old patient display format
- No country-specific formatting
- No age calculation from dateOfBirth

## ✅ **New Implementation**
```javascript
async getPatient(params, practiceContext) {
  try {
    console.log('🔍 AGENT: Getting patient:', params);

    if (!params.searchTerm) {
      const country = this.getClinicCountry(practiceContext);
      return {
        success: false,
        error: country === 'Israel' 
          ? 'נדרש מונח חיפוש'
          : 'Search term is required'
      };
    }

    const response = await axios.get(`${this.intellicareApiBase}/patients/search`, {
      params: { q: params.searchTerm },
      headers: this.getAuthHeaders(practiceContext),
      timeout: 10000
    });

    if (response.data.success && response.data.data.length > 0) {
      const patients = response.data.data;
      const country = this.getClinicCountry(practiceContext);
      
      if (patients.length === 1) {
        // Single patient found
        const patient = patients[0];
        const patientInfo = this.formatPatientInfo(patient, country);
        
        return {
          success: true,
          message: patientInfo
        };
      } else {
        // Multiple patients found
        const patientList = patients.map((patient, index) => 
          `${index + 1}. ${this.formatPatientInfo(patient, country, true)}`
        ).join('\n');
        
        return {
          success: true,
          message: country === 'Israel' 
            ? `נמצאו ${patients.length} מטופלים:\n${patientList}`
            : `Found ${patients.length} patients:\n${patientList}`
        };
      }
    } else {
      const country = this.getClinicCountry(practiceContext);
      return {
        success: false,
        message: country === 'Israel'
          ? `לא נמצא מטופל עם המונח: ${params.searchTerm}`
          : `No patient found with search term: ${params.searchTerm}`
      };
    }
  } catch (error) {
    console.error('❌ AGENT: Get patient error:', error);
    const country = this.getClinicCountry(practiceContext);
    
    return {
      success: false,
      message: country === 'Israel'
        ? `שגיאה בחיפוש מטופל: ${error.message}`
        : `Failed to retrieve patient: ${error.message}`
    };
  }
}
```

## 🔧 **Helper Methods to Add**

### **Patient Information Formatter**
```javascript
formatPatientInfo(patient, country, brief = false) {
  const name = `${patient.firstName} ${patient.lastName}`;
  const age = patient.dateOfBirth ? this.calculateAge(patient.dateOfBirth) : 'Unknown';
  
  if (brief) {
    // Brief format for lists
    if (country === 'Israel') {
      return `${name} (ת.ז: ${patient.nationalId}, גיל: ${age})`;
    } else {
      return `${name} (SSN: ${patient.socialSecurityNumber}, Age: ${age})`;
    }
  }
  
  // Full format for single patient
  if (country === 'Israel') {
    return `👤 שם: ${name}
🆔 תעודת זהות: ${patient.nationalId}
🎂 גיל: ${age}
🏥 קופת חולים: ${patient.healthFund}
📧 מייל: ${patient.email || 'לא צוין'}
📱 טלפון: ${patient.phone || 'לא צוין'}
🏠 כתובת: ${this.formatAddress(patient)}`.trim();
  } else {
    return `👤 Name: ${name}
🆔 SSN: ${patient.socialSecurityNumber}
🎂 Age: ${age}
🏥 Insurance: ${patient.insuranceProvider || 'Not specified'}
📧 Email: ${patient.email || 'Not specified'}
📱 Phone: ${patient.phone || 'Not specified'}
🏠 Address: ${this.formatAddress(patient)}`.trim();
  }
}
```

### **Address Formatter**
```javascript
formatAddress(patient) {
  const parts = [
    patient.street,
    patient.city,
    patient.zipCode
  ].filter(part => part && part.trim());
  
  return parts.length > 0 ? parts.join(', ') : 'Not specified';
}
```

### **Age Calculator** (if not already added from Task 1.5)
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
1. **✅ New schema field usage:**
   - Uses `firstName` + `lastName` instead of `name`
   - Calculates age from `dateOfBirth`
   - Uses new address fields (`street`, `city`, `zipCode`)

2. **✅ Country-specific display:**
   - Israeli format: Hebrew labels, nationalId, healthFund
   - US format: English labels, SSN, insuranceProvider
   - Appropriate field display for each country

3. **✅ Enhanced formatting:**
   - Brief format for multiple results
   - Full format for single result
   - Proper address formatting
   - Age calculation and display

4. **✅ Localized messages:**
   - Hebrew messages for Israeli practices
   - English messages for US practices
   - Country-appropriate error messages

## ⚠️ **Safety Notes**
- **✅ SAFE:** Only changing display logic and field access
- **✅ SAFE:** API call structure remains the same
- **✅ SAFE:** Return format stays consistent
- **✅ SAFE:** Graceful handling of missing fields
- **❌ DON'T TOUCH:** Function calling detection logic

## 🧪 **Testing After Change**
1. **Test Israeli practice:**
   - Search for Israeli patient
   - Verify Hebrew display format
   - Check nationalId and healthFund display

2. **Test US practice:**
   - Search for US patient
   - Verify English display format
   - Check SSN and insuranceProvider display

3. **Test search scenarios:**
   - Single patient found
   - Multiple patients found
   - No patients found
   - Search by different fields

4. **Test edge cases:**
   - Missing optional fields
   - Invalid search terms
   - API errors

## ✅ **Success Criteria**
- [ ] Patient search works with new schema
- [ ] Country-specific display formatting
- [ ] Age calculated from dateOfBirth
- [ ] Localized error messages
- [ ] Brief and full format options
- [ ] Function calling still works

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 2.3:** Update listPatients Implementation

## 📝 **Notes**
- Add all helper methods to the class
- Test both Israeli and US patient display
- Verify search functionality works
- Check formatting for missing fields
