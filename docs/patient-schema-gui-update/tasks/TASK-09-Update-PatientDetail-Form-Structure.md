# Task 09: Update PatientDetail Form Structure

## 📋 Task Overview
**Priority**: High  
**Type**: Development  
**Estimated Time**: 8 hours  
**Sprint**: 3  

## 🎯 Objective
Restructure the PatientDetail.js form layout to organize fields into logical sections and accommodate all new fields including separate firstName and lastName.

## 📝 Description
As a user, I want the patient form to be organized in logical sections with all required fields clearly grouped, so that I can efficiently enter patient information without confusion.

## ✅ Acceptance Criteria
- [ ] Form is organized into 4 logical sections: Basic Info, Contact, Identification, Healthcare
- [ ] firstName and lastName are separate fields instead of combined name
- [ ] All new fields are included in appropriate sections
- [ ] Section headers are clearly visible and translated
- [ ] Form maintains responsive design on all devices
- [ ] Proper tab order and accessibility maintained
- [ ] RTL layout works correctly for Hebrew
- [ ] Form validation works across all sections
- [ ] Loading states are handled properly
- [ ] Form state persists when switching between sections

## 🔧 Technical Requirements

### Form Section Structure
```javascript
// New form organization
<div className="patient-form-container">
  {/* Basic Information Section */}
  <div className="form-section">
    <h4>{t('basicInformation')}</h4>
    <div className="form-grid">
      {/* firstName, lastName, dateOfBirth, age, gender */}
    </div>
  </div>
  
  {/* Contact Information Section */}
  <div className="form-section">
    <h4>{t('contactInformation')}</h4>
    <div className="form-grid">
      {/* email, phone */}
    </div>
    <AddressFields />
  </div>
  
  {/* Identification Section */}
  <div className="form-section">
    <h4>{t('identification')}</h4>
    <div className="form-grid">
      {/* country, country-specific ID fields */}
    </div>
  </div>
  
  {/* Healthcare Information Section */}
  <div className="form-section">
    <h4>{t('healthcareInformation')}</h4>
    <div className="form-grid">
      {/* status, country-specific healthcare fields */}
    </div>
  </div>
  
  {/* Doctor Summary */}
  <div className="form-section">
    <h4>{t('medicalInformation')}</h4>
    {/* doctorSummary, file upload */}
  </div>
</div>
```

### State Management Updates
```javascript
const [editForm, setEditForm] = useState({
  // Basic Information
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
  countrySpecific: {},
  
  // Healthcare
  status: 'active',
  
  // Medical
  doctorSummary: ''
});
```

## 📁 Files to Modify
- `frontend-vite/src/components/PatientDetail.js`
- `frontend-vite/src/components/PatientDetail.css`

## 🔗 Dependencies
- **Blocked by**: Task 03 (AddressFields Component), Task 04 (StatusSelector Component), Task 05 (CountrySelector Component)
- **Blocks**: Task 10 (State Management Updates), Task 11 (Field Validation Implementation)

## 🧪 Testing Requirements
- [ ] Form renders all sections correctly
- [ ] firstName and lastName fields work independently
- [ ] Section navigation works properly
- [ ] Responsive design on mobile/tablet
- [ ] RTL layout for Hebrew
- [ ] Keyboard navigation
- [ ] Screen reader accessibility

## 📚 Implementation Details

### firstName/lastName Implementation
```javascript
// Replace single name field with separate fields
<div className="form-group">
  <label htmlFor="firstName">{t('firstName')} *</label>
  <input
    type="text"
    id="firstName"
    name="firstName"
    value={editForm.firstName || ''}
    onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
    required
    className="form-control"
  />
</div>

<div className="form-group">
  <label htmlFor="lastName">{t('lastName')} *</label>
  <input
    type="text"
    id="lastName"
    name="lastName"
    value={editForm.lastName || ''}
    onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
    required
    className="form-control"
  />
</div>
```

### Data Migration Logic
```javascript
// Handle existing patients with combined name
const migrateName = (existingName) => {
  if (existingName && typeof existingName === 'string') {
    const nameParts = existingName.trim().split(' ');
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || ''
    };
  }
  return { firstName: '', lastName: '' };
};
```

### Section Component Integration
```javascript
// Import new components
import AddressFields from './AddressFields';
import StatusSelector from './StatusSelector';
import CountrySelector from './CountrySelector';
import CountrySpecificFields from './CountrySpecificFields';

// Use in form sections
<AddressFields
  values={{
    street: editForm.street,
    city: editForm.city,
    zipCode: editForm.zipCode
  }}
  onChange={(addressData) => setEditForm(prev => ({ ...prev, ...addressData }))}
  errors={fieldErrors}
/>
```

## 🎨 CSS Updates Required
```css
.patient-form-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.form-section {
  background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
  padding: 2rem;
  border-radius: 16px;
  border: 1px solid #e3e8f0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}

.form-section h4 {
  margin: 0 0 1.5rem 0;
  color: #374151;
  font-weight: 600;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  align-items: start;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .form-section {
    padding: 1.5rem;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
```

## 🌐 Translation Keys Required
```json
{
  "firstName": "First Name",
  "lastName": "Last Name", 
  "basicInformation": "Basic Information",
  "contactInformation": "Contact Information",
  "identification": "Identification",
  "healthcareInformation": "Healthcare Information",
  "medicalInformation": "Medical Information"
}
```

Hebrew translations:
```json
{
  "firstName": "שם פרטי",
  "lastName": "שם משפחה",
  "basicInformation": "מידע בסיסי", 
  "contactInformation": "פרטי התקשרות",
  "identification": "זיהוי",
  "healthcareInformation": "מידע רפואי",
  "medicalInformation": "מידע רפואי"
}
```

## ✔️ Definition of Done
- [ ] Form structure is completely reorganized
- [ ] firstName and lastName are separate fields
- [ ] All sections render correctly
- [ ] Component integration works
- [ ] Responsive design maintained
- [ ] RTL layout works for Hebrew
- [ ] Code review approved
- [ ] Manual testing completed
- [ ] Accessibility verified

## 📋 Checklist
- [ ] Update form JSX structure
- [ ] Separate name field into firstName/lastName
- [ ] Add section headers
- [ ] Integrate new components
- [ ] Update CSS styling
- [ ] Add data migration logic
- [ ] Test responsive design
- [ ] Verify RTL layout
- [ ] Update translations
