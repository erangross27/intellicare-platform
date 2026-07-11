# Task 07: Restructure PatientDetail Form Layout

## 📋 Task Overview
**Epic**: Patient Schema GUI Update  
**Sprint**: Phase 3 - PatientDetail Integration  
**Estimated Time**: 6 hours (reduced from 8)  
**Priority**: High (Critical Path)  
**Assignee**: Developer  

## 🎯 Objective
Restructure the PatientDetail.js form layout to implement the new schema with separate firstName/lastName fields, organized sections, and all new schema fields. No backward compatibility needed.

## 📝 Description
As a user, I want the patient form to be organized in logical sections with all required fields so that data entry is intuitive and all patient information can be captured according to the new schema.

## ✅ Acceptance Criteria
- [ ] Implement separate firstName/lastName fields
- [ ] Organize form into logical sections (Basic Info, Contact, Identification, Healthcare)
- [ ] Integrate all new components (FormSection, NameFields, AddressFields, etc.)
- [ ] Update form grid layout for better field organization
- [ ] Add section headers and proper styling
- [ ] Ensure responsive design on mobile devices
- [ ] Maintain proper tab order and accessibility
- [ ] Support both edit and view modes

## 🔧 Technical Requirements

### File to Modify
- `frontend-vite/src/components/PatientDetail.js`

### New Form Structure Implementation

#### 1. Import New Components
```javascript
// Add these imports to PatientDetail.js
import FormSection from './FormSection';
import NameFields from './NameFields';
import AddressFields from './AddressFields';
import CountrySelector from './CountrySelector';
import CountrySpecificFields from './CountrySpecificFields';
import StatusSelector from './StatusSelector';
import DateOfBirthField from './DateOfBirthField';
```

#### 2. Replace Existing Form Structure

**Current Structure** (to be replaced):
```javascript
<div className="form-grid">
  {/* Name, NationalId, Age, Gender, Email, Phone, HealthFund */}
</div>
```

**New Structure** (implementation):
```javascript
{isEditing ? (
  <div className="patient-form-container">
    <form onSubmit={handleSave} autoComplete="off">
      {/* Hidden dummy fields for autofill prevention */}
      <input type="text" name="_fake_user" style={{ display: 'none' }} autoComplete="off" />
      <input type="password" name="_fake_pass" style={{ display: 'none' }} autoComplete="new-password" />

      {/* Basic Information Section */}
      <FormSection
        title={t('basicInformation')}
        icon="👤"
        required={true}
        fieldCount={4}
        completedFields={calculateBasicInfoCompletion()}
        id="basic-info-section"
      >
        <div className="form-grid basic-info-grid">
          <NameFields
            firstName={editForm.firstName}
            lastName={editForm.lastName}
            onChange={handleNameChange}
            errors={{
              firstName: fieldErrors.firstName,
              lastName: fieldErrors.lastName
            }}
            required={true}
          />
          
          <DateOfBirthField
            value={editForm.dateOfBirth}
            onChange={handleDateOfBirthChange}
            onAgeCalculated={handleAgeCalculated}
            error={fieldErrors.dateOfBirth}
            required={true}
          />

          <div className="form-group">
            <label htmlFor="gender">{t('gender')} *</label>
            <select 
              id="gender" 
              name="gender" 
              value={editForm.gender || ''} 
              onChange={handleInputChange} 
              required 
              className="form-control"
              aria-describedby="gender-help"
            >
              <option value="">{t('selectGender')}</option>
              <option value="male">{t('male')}</option>
              <option value="female">{t('female')}</option>
              <option value="other">{t('other')}</option>
            </select>
            <small id="gender-help" className="form-text text-muted">
              {t('selectPatientGender')}
            </small>
          </div>
        </div>
      </FormSection>

      {/* Contact Information Section */}
      <FormSection
        title={t('contactInformation')}
        icon="📞"
        collapsible={true}
        defaultExpanded={true}
        fieldCount={5}
        completedFields={calculateContactInfoCompletion()}
        id="contact-info-section"
      >
        <div className="form-grid contact-info-grid">
          <div className="form-group">
            <label htmlFor="patient-edit-email-input">{t('email')}</label>
            <input
              type="email"
              id="patient-edit-email-input"
              name="email"
              value={editForm.email || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              className="form-control"
              placeholder={t('enterEmail')}
              autoComplete="section-patientedit email-off"
            />
          </div>

          <div className="form-group">
            <label htmlFor="patient-edit-phone-input">{t('phone')}</label>
            <input
              type="tel"
              id="patient-edit-phone-input"
              name="phone"
              value={editForm.phone || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
              className="form-control"
              placeholder={t('enterPhone')}
              autoComplete="section-patientedit tel-off"
            />
          </div>
        </div>

        <AddressFields
          values={{
            street: editForm.street,
            city: editForm.city,
            zipCode: editForm.zipCode
          }}
          onChange={handleAddressChange}
          errors={{
            street: fieldErrors.street,
            city: fieldErrors.city,
            zipCode: fieldErrors.zipCode
          }}
        />
      </FormSection>

      {/* Identification Section */}
      <FormSection
        title={t('identification')}
        icon="🆔"
        required={true}
        fieldCount={getIdentificationFieldCount()}
        completedFields={calculateIdentificationCompletion()}
        id="identification-section"
      >
        <div className="form-grid identification-grid">
          <CountrySelector
            value={editForm.country}
            onChange={handleCountryChange}
            required={true}
          />

          {editForm.country && (
            <CountrySpecificFields
              country={editForm.country}
              values={editForm.countrySpecific}
              onChange={handleCountrySpecificFieldsChange}
              errors={fieldErrors.countrySpecific || {}}
            />
          )}
        </div>
      </FormSection>

      {/* Healthcare Information Section */}
      <FormSection
        title={t('healthcareInformation')}
        icon="🏥"
        collapsible={true}
        defaultExpanded={true}
        fieldCount={1}
        completedFields={calculateHealthcareInfoCompletion()}
        id="healthcare-info-section"
      >
        <div className="form-grid healthcare-info-grid">
          <StatusSelector
            value={editForm.status}
            onChange={handleStatusChange}
            required={true}
          />
        </div>
      </FormSection>

      {/* Doctor Summary Section */}
      <FormSection
        title={t('doctorsSummary')}
        icon="👨‍⚕️"
        collapsible={true}
        defaultExpanded={false}
        id="doctor-summary-section"
      >
        <div className="form-group">
          <label htmlFor="doctorSummary">{t('doctorSummary')}</label>
          <textarea 
            id="doctorSummary" 
            name="doctorSummary" 
            rows="6" 
            placeholder={t('doctorSummaryPlaceholder')} 
            value={editForm.doctorSummary || ''} 
            onChange={handleInputChange} 
            className="doctor-summary-textarea"
            autoComplete="off"
          />
          <small className="form-text text-muted">
            {t('doctorSummaryHelp')}
          </small>
        </div>
      </FormSection>

      {/* Medical Documents Section */}
      <FormSection
        title={t('medicalDocuments')}
        icon="📄"
        collapsible={true}
        defaultExpanded={false}
        id="documents-section"
      >
        <div className="form-group">
          <label>{t('medicalDocuments')}</label>
          <div className="file-upload-area">
            <input 
              type="file" 
              id="fileUpload" 
              multiple 
              onChange={handleFileUpload} 
              style={fileInputStyle} 
            />
            <label htmlFor="fileUpload" className="file-upload-label">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p>{t('uploadFiles')}</p>
              <p className="text-xs">{t('uploadDescription')}</p>
            </label>
          </div>
          {uploadingFiles && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={progressBarStyle}></div>
              </div>
              <p>{t('uploading')}... {processingDocuments.size > 0 ? 'AI Analysis in progress...' : ''}</p>
            </div>
          )}
        </div>
      </FormSection>

      {/* Form Actions */}
      <div className={`form-actions ${isRTL ? 'rtl' : 'ltr'}`}>
        <button type="submit" className="save-btn" disabled={loading}>
          {loading ? '⏳' : '✅'} {t('save')}
        </button>
        <button type="button" onClick={handleCancel} className="cancel-btn">
          ❌ {t('cancel')}
        </button>
      </div>
    </form>
  </div>
) : (
  // View mode structure (to be updated in next section)
  <ViewModeDisplay />
)}
```

#### 3. Update State Management

**Enhanced editForm state**:
```javascript
const [editForm, setEditForm] = useState({
  // Basic information
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  age: '',
  gender: '',
  
  // Contact information
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
  
  // Legacy/additional
  doctorSummary: '',
  
  // Computed field for backward compatibility
  get name() {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }
});
```

#### 4. Add New Event Handlers

```javascript
// Name change handler
const handleNameChange = useCallback(({ firstName, lastName }) => {
  setEditForm(prev => ({
    ...prev,
    firstName: firstName || '',
    lastName: lastName || ''
  }));
}, []);

// Date of birth change handler
const handleDateOfBirthChange = useCallback((dateOfBirth) => {
  setEditForm(prev => ({
    ...prev,
    dateOfBirth
  }));
}, []);

// Age calculation handler
const handleAgeCalculated = useCallback((age) => {
  setEditForm(prev => ({
    ...prev,
    age: age || ''
  }));
}, []);

// Address change handler
const handleAddressChange = useCallback((addressData) => {
  setEditForm(prev => ({
    ...prev,
    ...addressData
  }));
}, []);

// Country change handler
const handleCountryChange = useCallback((country) => {
  setEditForm(prev => ({
    ...prev,
    country,
    countrySpecific: {} // Clear country-specific fields when country changes
  }));
  setFieldErrors(prev => ({
    ...prev,
    countrySpecific: {} // Clear country-specific errors
  }));
}, []);

// Country-specific fields change handler
const handleCountrySpecificFieldsChange = useCallback((countryData) => {
  setEditForm(prev => ({
    ...prev,
    countrySpecific: {
      ...prev.countrySpecific,
      ...countryData
    }
  }));
}, []);

// Status change handler
const handleStatusChange = useCallback((status) => {
  setEditForm(prev => ({
    ...prev,
    status
  }));
}, []);

// Field completion calculators
const calculateBasicInfoCompletion = useCallback(() => {
  const fields = ['firstName', 'lastName', 'dateOfBirth', 'gender'];
  return fields.filter(field => editForm[field] && editForm[field].trim()).length;
}, [editForm]);

const calculateContactInfoCompletion = useCallback(() => {
  const fields = ['email', 'phone', 'street', 'city', 'zipCode'];
  return fields.filter(field => editForm[field] && editForm[field].trim()).length;
}, [editForm]);

const calculateIdentificationCompletion = useCallback(() => {
  if (!editForm.country) return 0;
  
  const countryFields = getRequiredFields(editForm.country);
  const completedCountryFields = countryFields.filter(field => 
    editForm.countrySpecific[field] && editForm.countrySpecific[field].trim()
  ).length;
  
  return 1 + completedCountryFields; // 1 for country + country-specific fields
}, [editForm.country, editForm.countrySpecific]);

const calculateHealthcareInfoCompletion = useCallback(() => {
  return editForm.status ? 1 : 0;
}, [editForm.status]);
```

#### 5. Update View Mode Display

```javascript
const ViewModeDisplay = () => (
  <div className="patient-view-container">
    <FormSection
      title={t('basicInformation')}
      icon="👤"
      id="basic-info-view"
    >
      <div className="patient-info-grid">
        {[
          { label: t('firstName'), value: patient?.firstName || t('notProvided'), icon: '👤' },
          { label: t('lastName'), value: patient?.lastName || t('notProvided'), icon: '👤' },
          { label: t('dateOfBirth'), value: patient?.dateOfBirth ? formatDate(patient.dateOfBirth) : t('notProvided'), icon: '📅' },
          { label: t('age'), value: `${patient?.age || t('notProvided')}${patient?.age ? ` ${t('years')}` : ''}`, icon: '🎂' },
          { label: t('gender'), value: patient?.gender ? getGenderDisplay(patient.gender) : t('notProvided'), icon: getGenderIcon(patient?.gender) }
        ].map((item, index) => (
          <PatientInfoItem key={index} {...item} />
        ))}
      </div>
    </FormSection>

    <FormSection
      title={t('contactInformation')}
      icon="📞"
      collapsible={true}
      defaultExpanded={false}
      id="contact-info-view"
    >
      <div className="patient-info-grid">
        {[
          { label: t('email'), value: patient?.email || t('notProvided'), icon: '📧' },
          { label: t('phone'), value: patient?.phone || t('notProvided'), icon: '📱' },
          { label: t('streetAddress'), value: patient?.street || t('notProvided'), icon: '🏠' },
          { label: t('city'), value: patient?.city || t('notProvided'), icon: '🏙️' },
          { label: t('zipCode'), value: patient?.zipCode || t('notProvided'), icon: '📮' }
        ].map((item, index) => (
          <PatientInfoItem key={index} {...item} />
        ))}
      </div>
    </FormSection>

    {/* Additional sections for identification, healthcare info, etc. */}
  </div>
);
```

## 🎨 CSS Requirements

### New Form Layout Styles
```css
.patient-form-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 0;
}

.patient-view-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 0;
}

/* Grid layouts for different sections */
.basic-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  align-items: start;
}

.contact-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.identification-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

.healthcare-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

/* Patient info display for view mode */
.patient-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.patient-info-item {
  background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #e3e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.patient-info-item-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.patient-info-item-icon {
  font-size: 1.25rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.patient-info-item-label {
  font-weight: 600;
  color: #4b5563;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.patient-info-item-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  line-height: 1.4;
}

/* Form actions */
.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #e9ecef;
}

.form-actions.rtl {
  justify-content: flex-start;
}

.save-btn, .cancel-btn {
  padding: 0.875rem 2rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.save-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
  color: white;
}

.cancel-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(108, 117, 125, 0.4);
}

/* Responsive design */
@media (max-width: 768px) {
  .patient-form-container,
  .patient-view-container {
    padding: 1rem;
  }

  .basic-info-grid,
  .contact-info-grid,
  .identification-grid,
  .healthcare-info-grid,
  .patient-info-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .form-actions {
    flex-direction: column;
  }
}

/* RTL support */
[dir="rtl"] .form-actions {
  justify-content: flex-start;
}

[dir="rtl"] .form-actions.rtl {
  justify-content: flex-end;
}
```

## 🧪 Testing Requirements

### Functional Tests
```javascript
describe('PatientDetail Form Restructure', () => {
  describe('Form Sections', () => {
    it('renders all form sections', () => {});
    it('shows correct field counts in sections', () => {});
    it('handles section collapse/expand', () => {});
  });

  describe('Name Fields Integration', () => {
    it('separates firstName and lastName correctly', () => {});
    it('updates form state when names change', () => {});
    it('maintains backward compatibility with name field', () => {});
  });

  describe('Country-Specific Fields', () => {
    it('shows appropriate fields based on country selection', () => {});
    it('clears fields when country changes', () => {});
    it('validates country-specific fields', () => {});
  });

  describe('Form Submission', () => {
    it('submits all form data correctly', () => {});
    it('handles validation errors', () => {});
    it('processes country-specific data', () => {});
  });
});
```

### Integration Tests
```javascript
describe('PatientDetail Integration', () => {
  it('loads existing patient data correctly', () => {});
  it('handles edit/view mode switching', () => {});
  it('integrates with file upload functionality', () => {});
  it('maintains compatibility with existing API', () => {});
});
```

## 📦 Dependencies
**Requires**: 
- Task 03 - Create Base Form Components
- Task 04 - Create CountrySpecificFields Component
- Task 05 - Add DateOfBirth Field Component
- Task 06 - Create FormSection Component

**Blocks**: 
- Task 08 - Enhance NationalIdField Component
- Task 09 - Update State Management
- Task 10 - Implement Field Validation

## ✨ Definition of Done
- [ ] Form structure completely reorganized into sections
- [ ] firstName/lastName fields separated and functional
- [ ] All new components integrated successfully
- [ ] Section-based layout implemented with proper styling
- [ ] Field completion tracking working
- [ ] Form validation integrated with new structure
- [ ] View mode updated to show all fields
- [ ] Responsive design works on all devices
- [ ] RTL layout supported for Hebrew
- [ ] Accessibility attributes maintained
- [ ] File upload functionality preserved
- [ ] Backward compatibility with existing data
- [ ] Unit and integration tests passing
- [ ] Code review completed

## 📚 Additional Notes

### Data Migration Considerations
- Handle existing patients with combined name field
- Migrate existing data to new structure
- Maintain API compatibility during transition
- Provide fallback for missing fields

### Performance Optimizations
- Lazy load country-specific components
- Memoize field completion calculations
- Optimize re-renders with React.memo
- Debounce validation calls

### Accessibility Enhancements
- Proper form labeling and associations
- Keyboard navigation between sections
- Screen reader announcements for dynamic content
- ARIA live regions for progress updates

## 🔗 Related Tasks
- **Previous**: Task 06 - Create FormSection Component
- **Next**: Task 08 - Enhance NationalIdField Component
- **Parallel**: Task 09 - Update State Management
- **Integration**: Task 11 - Update API Integration
