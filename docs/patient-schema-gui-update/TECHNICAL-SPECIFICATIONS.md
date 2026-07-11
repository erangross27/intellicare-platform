# Technical Specifications: Patient Schema GUI Update

## 1. Translation Updates Required

### 1.1 Universal Fields (All Countries)
**English (en.json) additions:**
```json
{
  "dateOfBirth": "Date of Birth",
  "streetAddress": "Street Address",
  "city": "City", 
  "zipCode": "ZIP/Postal Code",
  "country": "Country",
  "status": "Status",
  "active": "Active",
  "inactive": "Inactive", 
  "archived": "Archived",
  "selectStatus": "Select Status",
  "patientStatus": "Patient Status",
  "enterStreetAddress": "Enter street address",
  "enterCity": "Enter city",
  "enterZipCode": "Enter ZIP/postal code",
  "selectCountry": "Select Country"
}
```

**Hebrew (he.json) additions:**
```json
{
  "dateOfBirth": "תאריך לידה",
  "streetAddress": "כתובת רחוב", 
  "city": "עיר",
  "zipCode": "מיקוד",
  "country": "מדינה",
  "status": "סטטוס",
  "active": "פעיל",
  "inactive": "לא פעיל",
  "archived": "בארכיון", 
  "selectStatus": "בחר סטטוס",
  "patientStatus": "סטטוס מטופל",
  "enterStreetAddress": "הזן כתובת רחוב",
  "enterCity": "הזן עיר", 
  "enterZipCode": "הזן מיקוד",
  "selectCountry": "בחר מדינה"
}
```

### 1.2 Country-Specific Field Translations

**English:**
```json
{
  "socialSecurityNumber": "Social Security Number",
  "healthCardNumber": "Health Card Number", 
  "nhsNumber": "NHS Number",
  "healthInsuranceNumber": "Health Insurance Number",
  "vitaleCardNumber": "Vitale Card Number",
  "cpfNumber": "CPF Number",
  "susNumber": "SUS Number",
  "nationalIdNumber": "National ID Number",
  "residentRegistrationNumber": "Resident Registration Number",
  "medicareNumber": "Medicare Number",
  "nationalHealthIndexNumber": "National Health Index Number",
  "insuranceProvider": "Insurance Provider",
  "province": "Province", 
  "state": "State",
  "autonomousCommunity": "Autonomous Community",
  "prefecture": "Prefecture",
  "insuranceType": "Insurance Type",
  "healthInsuranceProvider": "Health Insurance Provider",
  "nationalHealthInsuranceNumber": "National Health Insurance Number",
  "indigenousStatus": "Indigenous Status",
  "ethnicity": "Ethnicity"
}
```

**Hebrew:**
```json
{
  "socialSecurityNumber": "מספר ביטוח לאומי",
  "healthCardNumber": "מספר כרטיס בריאות",
  "nhsNumber": "מספר NHS", 
  "healthInsuranceNumber": "מספר ביטוח בריאות",
  "vitaleCardNumber": "מספר כרטיס ויטאל",
  "cpfNumber": "מספר CPF",
  "susNumber": "מספר SUS", 
  "nationalIdNumber": "מספר זהות לאומי",
  "residentRegistrationNumber": "מספר רישום תושב",
  "medicareNumber": "מספר מדיקר",
  "nationalHealthIndexNumber": "מספר אינדקס בריאות לאומי",
  "insuranceProvider": "ספק ביטוח",
  "province": "מחוז",
  "state": "מדינה", 
  "autonomousCommunity": "קהילה אוטונומית",
  "prefecture": "מחוז",
  "insuranceType": "סוג ביטוח",
  "healthInsuranceProvider": "ספק ביטוח בריאות", 
  "nationalHealthInsuranceNumber": "מספר ביטוח בריאות לאומי",
  "indigenousStatus": "מעמד ילידי",
  "ethnicity": "מוצא אתני"
}
```

## 2. Component Architecture

### 2.1 New Components to Create

#### `CountrySelector.js`
```javascript
// Purpose: Handle country selection and trigger field updates
// Props: { value, onChange, disabled, required }
// Features: 
// - Dropdown with all supported countries
// - Integration with practice country settings
// - Automatic field configuration updates
```

#### `CountrySpecificFields.js` 
```javascript
// Purpose: Render country-specific identification and healthcare fields
// Props: { country, values, onChange, errors }
// Features:
// - Dynamic field rendering based on country
// - Validation for country-specific formats
// - Proper field labels and help text
```

#### `AddressFields.js`
```javascript
// Purpose: Render universal address fields
// Props: { values, onChange, errors, required }
// Features: 
// - Street, city, zipCode fields
// - Country-appropriate validation
// - Responsive layout
```

#### `StatusSelector.js`
```javascript
// Purpose: Handle patient status selection
// Props: { value, onChange, disabled }
// Features:
// - Active/Inactive/Archived options
// - Visual indicators for each status
// - Proper accessibility
```

### 2.2 Enhanced NationalIdField Component
Update existing `NationalIdField.js` to handle multiple country ID types:

```javascript
// New props to add:
// - country: determines which ID type to use
// - idType: specific ID field type (nationalId, socialSecurityNumber, etc.)
// - Dynamic validation based on country
// - Country-specific formatting
```

## 3. PatientDetail.js Updates

### 3.1 Form Structure Changes

**Current form grid:**
```javascript
<div className="form-grid">
  {/* Name, NationalId, Age, Gender, Email, Phone, HealthFund */}
</div>
```

**New form structure:**
```javascript
<div className="patient-form-container">
  {/* Basic Information Section */}
  <div className="form-section">
    <h4>{t('basicInformation')}</h4>
    <div className="form-grid">
      {/* Name, DateOfBirth, Age, Gender */}
    </div>
  </div>
  
  {/* Contact Information Section */} 
  <div className="form-section">
    <h4>{t('contactInformation')}</h4>
    <div className="form-grid">
      {/* Email, Phone, Address fields */}
    </div>
  </div>
  
  {/* Identification Section */}
  <div className="form-section">
    <h4>{t('identification')}</h4>
    <div className="form-grid">
      {/* Country, Country-specific ID fields */}
    </div>
  </div>
  
  {/* Healthcare Information Section */}
  <div className="form-section">
    <h4>{t('healthcareInformation')}</h4>
    <div className="form-grid">
      {/* Country-specific healthcare fields, Status */}
    </div>
  </div>
</div>
```

### 3.2 State Management Updates

**New state variables needed:**
```javascript
const [selectedCountry, setSelectedCountry] = useState('');
const [countryFields, setCountryFields] = useState({});
const [fieldErrors, setFieldErrors] = useState({});
```

**Enhanced editForm state:**
```javascript
const [editForm, setEditForm] = useState({
  // Existing fields
  name: '',
  nationalId: '',
  age: '',
  gender: '',
  email: '',
  phone: '',
  healthFund: '',
  doctorSummary: '',
  
  // New universal fields
  dateOfBirth: '',
  street: '',
  city: '',
  zipCode: '',
  country: '',
  status: 'active',
  
  // Country-specific fields (dynamic)
  countrySpecific: {}
});
```

### 3.3 Validation Logic

**Field validation by country:**
```javascript
const validateCountryFields = (country, values) => {
  const errors = {};
  const config = getCountryFieldConfig(country);
  
  config.requiredFields.forEach(field => {
    if (!values[field]) {
      errors[field] = t('fieldRequired');
    }
  });
  
  // Country-specific validation rules
  if (country === 'Israel' && values.nationalId) {
    if (!validateIsraeliId(values.nationalId)) {
      errors.nationalId = t('invalidIsraeliId');
    }
  }
  
  // Add validation for other countries...
  
  return errors;
};
```

## 4. API Integration Updates

### 4.1 Patient API Call Updates

**Current API payload structure:**
```javascript
{
  name: string,
  nationalId: string, 
  age: number,
  gender: string,
  email: string,
  phone: string,
  healthFund: string,
  doctorSummary: string
}
```

**New API payload structure:**
```javascript
{
  // Base fields
  firstName: string,
  lastName: string, 
  dateOfBirth: Date,
  email: string,
  phone: string,
  street: string,
  city: string,
  zipCode: string,
  status: string,
  doctorSummary: string,
  
  // Country-specific fields (dynamic based on country)
  country: string,
  nationalId?: string,      // Israel
  healthFund?: string,      // Israel
  socialSecurityNumber?: string,  // US/France
  insuranceProvider?: string,     // US/Germany
  healthCardNumber?: string,      // Canada/Spain
  province?: string,        // Canada/Argentina
  nhsNumber?: string,       // UK
  // ... other country fields
}
```

### 4.2 Form Data Processing

**Helper function for processing form data:**
```javascript
const processFormDataForSubmission = (formData, country) => {
  const processedData = {
    // Split name into firstName/lastName
    firstName: formData.name.split(' ')[0] || '',
    lastName: formData.name.split(' ').slice(1).join(' ') || '',
    
    // Universal fields
    dateOfBirth: formData.dateOfBirth,
    email: formData.email,
    phone: formData.phone, 
    street: formData.street,
    city: formData.city,
    zipCode: formData.zipCode,
    status: formData.status,
    doctorSummary: formData.doctorSummary,
    country: country,
    
    // Add country-specific fields
    ...formData.countrySpecific
  };
  
  return processedData;
};
```

## 5. CSS/Styling Updates

### 5.1 New CSS Classes Needed

```css
/* Form section styling */
.patient-form-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.form-section h4 {
  margin: 0 0 1rem 0;
  color: #495057;
  font-weight: 600;
  font-size: 1.1rem;
}

/* Country-specific field styling */
.country-specific-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

/* Status indicator styling */
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-inactive {
  background: #f8d7da;
  color: #721c24;
}

.status-archived {
  background: #e2e3e5;
  color: #6c757d;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .form-section {
    padding: 1rem;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
}
```

## 6. Implementation Order

### Day 1-2: Infrastructure
1. ✅ Update translation files (en.json, he.json)
2. ✅ Create country configuration utility
3. ✅ Create basic new components (CountrySelector, AddressFields, StatusSelector)

### Day 3-4: Core Components  
4. ✅ Update NationalIdField to handle multiple countries
5. ✅ Create CountrySpecificFields component
6. ✅ Update PatientDetail.js form structure

### Day 5-6: Integration
7. ✅ Add state management for new fields
8. ✅ Implement validation logic
9. ✅ Update API integration

### Day 7-8: UI/UX
10. ✅ Update CSS for new layout
11. ✅ Test responsive design
12. ✅ Add field help text and validation messages

### Day 9: Testing & Validation
13. ✅ Test all supported countries
14. ✅ Verify backward compatibility
15. ✅ Update documentation

## 7. Testing Checklist

### Functional Testing
- [ ] All new fields display correctly
- [ ] Country selection updates available fields
- [ ] Field validation works for all countries
- [ ] Form submission includes all data
- [ ] Edit mode preserves all field values

### UI/UX Testing  
- [ ] Responsive design on mobile devices
- [ ] Hebrew RTL layout works correctly
- [ ] Form sections are clearly organized
- [ ] Field labels are properly translated

### Integration Testing
- [ ] Patient data saves with new fields
- [ ] Existing patients load without errors
- [ ] API handles missing fields gracefully
- [ ] Cache invalidation works correctly

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers
