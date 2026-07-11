# Task 10: Update State Management

## 📋 Task Overview
**Priority**: High  
**Type**: Development  
**Estimated Time**: 6 hours  
**Sprint**: 3  

## 🎯 Objective
Update the PatientDetail component's state management to handle all new fields including separate firstName/lastName, country-specific fields, and proper validation state.

## 📝 Description
As a developer, I need the form state to properly handle all new fields, including separate firstName/lastName, country-specific dynamic fields, and comprehensive validation state management.

## ✅ Acceptance Criteria
- [ ] editForm state includes all new schema fields
- [ ] firstName and lastName are separate state properties
- [ ] Country-specific fields are handled dynamically
- [ ] Validation state is properly managed
- [ ] State updates correctly when country changes
- [ ] Form reset and cancel behavior works properly
- [ ] Data loading populates all fields correctly
- [ ] State persists during form interactions
- [ ] Proper error state management
- [ ] Backward compatibility with existing data

## 🔧 Technical Requirements

### Updated State Structure
```javascript
const [editForm, setEditForm] = useState({
  // Basic Information (separated name fields)
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  age: '',
  gender: '',
  
  // Contact Information
  email: '',
  phone: '',
  street: '',
  city: '',
  zipCode: '',
  
  // Identification
  country: '',
  
  // Healthcare
  status: 'active',
  
  // Medical
  doctorSummary: '',
  
  // Country-specific fields (dynamic)
  countrySpecific: {}
});

// Additional state for form management
const [selectedCountry, setSelectedCountry] = useState('');
const [fieldErrors, setFieldErrors] = useState({});
const [isFormDirty, setIsFormDirty] = useState(false);
```

### Data Loading Logic
```javascript
const loadPatientData = (patientData) => {
  // Handle name migration from combined to separate fields
  const { firstName, lastName } = migrateName(patientData.name);
  
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
};
```

## 📁 Files to Modify
- `frontend-vite/src/components/PatientDetail.js`

## 🔗 Dependencies
- **Blocked by**: Task 09 (Update PatientDetail Form Structure)
- **Blocks**: Task 11 (Field Validation Implementation)

## 🧪 Testing Requirements
- [ ] State updates correctly for all fields
- [ ] Country change updates available fields
- [ ] Form reset clears all state properly
- [ ] Data loading populates all fields
- [ ] Name migration works correctly
- [ ] Error state management functions
- [ ] Form dirty state tracking works

## 📚 Implementation Details

### Country Change Handler
```javascript
const handleCountryChange = (newCountry) => {
  setSelectedCountry(newCountry);
  setEditForm(prev => ({
    ...prev,
    country: newCountry,
    // Clear country-specific fields when country changes
    countrySpecific: {}
  }));
  
  // Clear any country-specific validation errors
  setFieldErrors(prev => {
    const newErrors = { ...prev };
    const countryConfig = getCountryConfig(newCountry);
    if (countryConfig) {
      Object.keys(countryConfig.fields).forEach(fieldName => {
        delete newErrors[fieldName];
      });
    }
    return newErrors;
  });
};
```

### Country-Specific Field Handler
```javascript
const handleCountrySpecificChange = (fieldName, value) => {
  setEditForm(prev => ({
    ...prev,
    countrySpecific: {
      ...prev.countrySpecific,
      [fieldName]: value
    }
  }));
  
  // Clear validation error for this field
  setFieldErrors(prev => ({
    ...prev,
    [fieldName]: null
  }));
  
  setIsFormDirty(true);
};
```

### Name Migration Helper
```javascript
const migrateName = (existingName) => {
  if (!existingName) return { firstName: '', lastName: '' };
  
  if (typeof existingName === 'string') {
    const nameParts = existingName.trim().split(' ');
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || ''
    };
  }
  
  // If it's already an object with firstName/lastName
  return {
    firstName: existingName.firstName || '',
    lastName: existingName.lastName || ''
  };
};
```

### Country-Specific Data Extraction
```javascript
const extractCountrySpecificFields = (patientData) => {
  const countrySpecificFields = {};
  const countryConfig = getCountryConfig(patientData.country);
  
  if (countryConfig) {
    Object.keys(countryConfig.fields).forEach(fieldName => {
      if (patientData[fieldName]) {
        countrySpecificFields[fieldName] = patientData[fieldName];
      }
    });
  }
  
  return countrySpecificFields;
};
```

### Form Reset Logic
```javascript
const handleCancel = () => {
  // Reset to original patient data
  if (patient) {
    loadPatientData(patient);
  } else {
    // Reset to empty form
    setEditForm({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      age: '',
      gender: '',
      email: '',
      phone: '',
      street: '',
      city: '',
      zipCode: '',
      country: '',
      status: 'active',
      doctorSummary: '',
      countrySpecific: {}
    });
    setSelectedCountry('');
  }
  
  setFieldErrors({});
  setIsFormDirty(false);
  setIsEditing(false);
};
```

### Form Dirty State Tracking
```javascript
const handleFieldChange = (fieldName, value) => {
  setEditForm(prev => ({
    ...prev,
    [fieldName]: value
  }));
  
  setIsFormDirty(true);
  
  // Clear validation error for this field
  if (fieldErrors[fieldName]) {
    setFieldErrors(prev => ({
      ...prev,
      [fieldName]: null
    }));
  }
};
```

### Data Preparation for API
```javascript
const prepareDataForAPI = () => {
  const apiData = {
    firstName: editForm.firstName,
    lastName: editForm.lastName,
    dateOfBirth: editForm.dateOfBirth,
    email: editForm.email,
    phone: editForm.phone,
    street: editForm.street,
    city: editForm.city,
    zipCode: editForm.zipCode,
    country: editForm.country,
    status: editForm.status,
    doctorSummary: editForm.doctorSummary,
    
    // Legacy field for backward compatibility
    name: `${editForm.firstName} ${editForm.lastName}`.trim(),
    age: editForm.age,
    gender: editForm.gender,
    
    // Add country-specific fields
    ...editForm.countrySpecific
  };
  
  return apiData;
};
```

## 🔄 State Flow Diagram
```
Initial Load → migrateName() → loadPatientData() → setEditForm()
                                                 → setSelectedCountry()

Country Change → handleCountryChange() → setSelectedCountry()
                                      → clear countrySpecific
                                      → clear related errors

Field Change → handleFieldChange() → setEditForm()
                                  → setIsFormDirty(true)
                                  → clear field error

Form Submit → prepareDataForAPI() → API call → success/error handling

Form Cancel → handleCancel() → reset all state → setIsEditing(false)
```

## ✔️ Definition of Done
- [ ] All state variables are properly defined
- [ ] firstName/lastName are separate in state
- [ ] Country-specific fields are handled dynamically
- [ ] Data loading works with name migration
- [ ] Form reset functionality works
- [ ] Error state management implemented
- [ ] Form dirty state tracking works
- [ ] API data preparation handles all fields
- [ ] Code review approved
- [ ] Unit tests pass

## 📋 Checklist
- [ ] Update editForm state structure
- [ ] Add additional state variables
- [ ] Implement name migration logic
- [ ] Add country change handler
- [ ] Update form reset logic
- [ ] Add dirty state tracking
- [ ] Implement API data preparation
- [ ] Test all state transitions
- [ ] Verify backward compatibility
