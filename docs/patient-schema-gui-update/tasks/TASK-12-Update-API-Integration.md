# Task 12: Update API Integration

## 📋 Task Overview
**Priority**: High  
**Type**: Development  
**Estimated Time**: 6 hours  
**Sprint**: 4  

## 🎯 Objective
Update the PatientDetail component's API integration to handle all new fields including separate firstName/lastName and country-specific fields.

## 📝 Description
As a system, I need to save and load all patient fields correctly, including the new firstName/lastName separation and country-specific fields, while maintaining backward compatibility with existing data.

## ✅ Acceptance Criteria
- [ ] Patient creation API calls include all new fields
- [ ] Patient update API calls include all new fields  
- [ ] firstName and lastName are sent separately to API
- [ ] Country-specific fields are included in API payload
- [ ] Data loading populates all form fields correctly
- [ ] Backward compatibility maintained for existing patients
- [ ] Proper error handling for API failures
- [ ] Loading states handled appropriately
- [ ] Cache invalidation works correctly
- [ ] Name migration works when loading existing data

## 🔧 Technical Requirements

### API Payload Structure
```javascript
// New API payload format
const apiPayload = {
  // Separated name fields
  firstName: string,
  lastName: string,
  
  // Universal fields
  dateOfBirth: Date,
  email: string,
  phone: string,
  street: string,
  city: string,
  zipCode: string,
  country: string,
  status: string,
  doctorSummary: string,
  
  // Legacy fields for backward compatibility
  name: string,  // Combined firstName + lastName
  age: number,
  gender: string,
  
  // Country-specific fields (dynamic)
  nationalId?: string,         // Israel
  healthFund?: string,         // Israel
  socialSecurityNumber?: string, // US/France
  insuranceProvider?: string,    // US/Germany
  healthCardNumber?: string,     // Canada/Spain
  province?: string,            // Canada/Argentina
  nhsNumber?: string,           // UK
  // ... other country fields
};
```

### Data Processing Functions
```javascript
const prepareDataForAPI = (formData) => {
  const processedData = {
    // Separated name fields
    firstName: formData.firstName,
    lastName: formData.lastName,
    
    // Combined name for backward compatibility
    name: `${formData.firstName} ${formData.lastName}`.trim(),
    
    // Universal fields
    dateOfBirth: formData.dateOfBirth,
    email: formData.email,
    phone: formData.phone,
    street: formData.street,
    city: formData.city,
    zipCode: formData.zipCode,
    country: formData.country,
    status: formData.status,
    doctorSummary: formData.doctorSummary,
    
    // Legacy fields
    age: formData.age,
    gender: formData.gender,
    
    // Country-specific fields
    ...formData.countrySpecific
  };
  
  // Remove empty fields to keep payload clean
  Object.keys(processedData).forEach(key => {
    if (processedData[key] === '' || processedData[key] === null || processedData[key] === undefined) {
      delete processedData[key];
    }
  });
  
  return processedData;
};
```

## 📁 Files to Modify
- `frontend-vite/src/components/PatientDetail.js`
- `frontend-vite/src/services/api.js` (if needed)

## 🔗 Dependencies
- **Blocked by**: Task 11 (Implement Field Validation)
- **Blocks**: Task 13 (Update View Mode Display)

## 🧪 Testing Requirements
- [ ] Patient creation with all fields works
- [ ] Patient updates save correctly
- [ ] Data loading populates all fields
- [ ] Name migration functions properly
- [ ] Country-specific fields save/load
- [ ] Backward compatibility verified
- [ ] Error handling works correctly

## 📚 Implementation Details

### Updated Save Handler
```javascript
const handleSave = async (e) => {
  if (e) e.preventDefault();
  
  try {
    setLoading(true);
    setError('');
    
    // Validate form before submission
    const isValid = validateForm();
    if (!isValid) {
      setError(t('pleaseFixValidationErrors'));
      return;
    }
    
    // Prepare data for API
    const apiData = prepareDataForAPI(editForm);
    
    console.log('💾 Saving patient data:', apiData);
    
    let response;
    if (id && id !== 'new') {
      // Update existing patient
      response = await patientAPI.updatePatient(id, apiData);
    } else {
      // Create new patient
      response = await patientAPI.createPatient(apiData);
    }
    
    console.log('✅ Patient saved successfully:', response);
    
    // Invalidate cache
    const { cacheUtils } = await import('../services/cachedApi');
    cacheUtils.invalidatePatientCache(id);
    
    // Refresh patient data
    await loadPatient();
    setIsEditing(false);
    setIsFormDirty(false);
    
  } catch (error) {
    console.error('❌ Error saving patient:', error);
    setError(error.message || t('errorSavingPatient'));
  } finally {
    setLoading(false);
  }
};
```

### Enhanced Data Loading
```javascript
const loadPatient = useCallback(async () => {
  try {
    setLoading(true);
    setError('');
    
    console.log('📥 Loading patient data for ID:', id);
    
    const response = await cachedPatientAPI.getPatient(id);
    const patientData = response.data?.data || response.data;
    
    console.log('📋 Loaded patient data:', patientData);
    
    if (patientData) {
      setPatient(patientData);
      
      // Populate edit form with loaded data
      const { firstName, lastName } = migrateName(patientData.name || patientData);
      
      setEditForm({
        firstName: firstName || patientData.firstName || '',
        lastName: lastName || patientData.lastName || '',
        dateOfBirth: patientData.dateOfBirth || '',
        age: patientData.age || '',
        gender: patientData.gender || '',
        email: patientData.email || '',
        phone: patientData.phone || '',
        street: patientData.street || '',
        city: patientData.city || '',
        zipCode: patientData.zipCode || '',
        country: patientData.country || '',
        status: patientData.status || 'active',
        doctorSummary: patientData.doctorSummary || '',
        countrySpecific: extractCountrySpecificFields(patientData)
      });
      
      setSelectedCountry(patientData.country || '');
    }
    
  } catch (error) {
    console.error('❌ Error loading patient:', error);
    setError(error.message || t('errorLoadingPatient'));
  } finally {
    setLoading(false);
  }
}, [id, t]);
```

### Country-Specific Field Extraction
```javascript
const extractCountrySpecificFields = (patientData) => {
  const countrySpecificFields = {};
  
  if (!patientData.country) return countrySpecificFields;
  
  const countryConfig = getCountryConfig(patientData.country);
  if (!countryConfig) return countrySpecificFields;
  
  // Extract country-specific fields based on configuration
  Object.keys(countryConfig.fields).forEach(fieldName => {
    if (patientData[fieldName] !== undefined && patientData[fieldName] !== '') {
      countrySpecificFields[fieldName] = patientData[fieldName];
    }
  });
  
  return countrySpecificFields;
};
```

### Name Migration Logic
```javascript
const migrateName = (nameData) => {
  // If already separated
  if (nameData && typeof nameData === 'object' && nameData.firstName) {
    return {
      firstName: nameData.firstName || '',
      lastName: nameData.lastName || ''
    };
  }
  
  // If combined name string
  if (nameData && typeof nameData === 'string') {
    const nameParts = nameData.trim().split(' ');
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || ''
    };
  }
  
  // Fallback to individual fields if available
  return {
    firstName: nameData?.firstName || '',
    lastName: nameData?.lastName || ''
  };
};
```

### Error Handling Enhancement
```javascript
const handleAPIError = (error, operation) => {
  console.error(`❌ API Error during ${operation}:`, error);
  
  let errorMessage = t('unexpectedError');
  
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 400:
        errorMessage = data.message || t('invalidData');
        break;
      case 401:
        errorMessage = t('unauthorized');
        // Redirect to login if needed
        break;
      case 403:
        errorMessage = t('accessDenied');
        break;
      case 404:
        errorMessage = t('patientNotFound');
        break;
      case 409:
        errorMessage = t('conflictError');
        break;
      case 500:
        errorMessage = t('serverError');
        break;
      default:
        errorMessage = data.message || t('unexpectedError');
    }
  } else if (error.request) {
    // Network error
    errorMessage = t('networkError');
  } else {
    // Other error
    errorMessage = error.message || t('unexpectedError');
  }
  
  setError(errorMessage);
  return errorMessage;
};
```

### Cache Management
```javascript
const refreshPatientData = async () => {
  try {
    // Invalidate relevant caches
    const { cacheUtils } = await import('../services/cachedApi');
    cacheUtils.invalidatePatientCache(id);
    cacheUtils.invalidateDocumentCache(id);
    
    // Reload patient data
    await loadPatient();
    
    // Force refresh of Documents tab if needed
    setDocumentsRefreshKey(prev => prev + 1);
    
  } catch (error) {
    console.error('❌ Error refreshing patient data:', error);
  }
};
```

## 🔄 API Call Flow
```
Form Submit → validateForm() → prepareDataForAPI() → 
API Call (create/update) → handleResponse() → 
invalidateCache() → loadPatient() → updateUI()

Data Load → loadPatient() → extractCountrySpecificFields() → 
migrateName() → setEditForm() → setSelectedCountry()
```

## 🌐 Translation Keys Required
```json
{
  "pleaseFixValidationErrors": "Please fix validation errors before saving",
  "errorSavingPatient": "Error saving patient data",
  "errorLoadingPatient": "Error loading patient data",
  "unexpectedError": "An unexpected error occurred",
  "invalidData": "Invalid data provided",
  "unauthorized": "You are not authorized to perform this action",
  "accessDenied": "Access denied",
  "patientNotFound": "Patient not found",
  "conflictError": "Data conflict occurred",
  "serverError": "Server error occurred",
  "networkError": "Network connection error"
}
```

## ✔️ Definition of Done
- [ ] API calls include all new fields
- [ ] firstName/lastName sent separately
- [ ] Data loading works correctly
- [ ] Country-specific fields handled
- [ ] Name migration functional
- [ ] Error handling comprehensive
- [ ] Cache management works
- [ ] Backward compatibility verified
- [ ] Code review approved

## 📋 Checklist
- [ ] Update save handler
- [ ] Enhance data loading
- [ ] Implement name migration
- [ ] Add country-specific field extraction
- [ ] Improve error handling
- [ ] Add cache management
- [ ] Test API integration
- [ ] Verify backward compatibility
- [ ] Add proper logging
