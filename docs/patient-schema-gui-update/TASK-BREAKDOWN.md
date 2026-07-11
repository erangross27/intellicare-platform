# Task Breakdown: Patient Schema GUI Update

## 🎯 Project: Update Patient Details GUI for New Schema

### 📋 Epic: Add Missing Patient Fields to Frontend
**Goal**: Update PatientDetail.js and related components to support all fields from the new PatientSchemaFactory.js schema

---

## 📅 Sprint 1: Infrastructure & Translations (Days 1-2)

### Task 1.1: Update Translation Files
**Story**: As a user, I want all new patient fields to be properly translated in both English and Hebrew

**Acceptance Criteria**:
- [ ] Add universal field translations (dateOfBirth, street, city, zipCode, country, status)
- [ ] Add country-specific field translations for all 13 supported countries
- [ ] Add section header translations (basicInformation, contactInformation, etc.)
- [ ] Verify Hebrew RTL compatibility
- [ ] Test translation loading

**Files to Modify**:
- `frontend-vite/src/translations/en.json`
- `frontend-vite/src/translations/he.json`

**Estimated Time**: 4 hours

---

### Task 1.2: Create Country Configuration Utility
**Story**: As a developer, I need a centralized configuration for country-specific fields

**Acceptance Criteria**:
- [ ] Create `utils/countryConfig.js` with field definitions for all countries
- [ ] Include validation rules for each country's ID formats
- [ ] Add field labels, placeholders, and help text
- [ ] Export functions to get country fields dynamically
- [ ] Add unit tests for country configurations

**Files to Create**:
- `frontend-vite/src/utils/countryConfig.js`
- `frontend-vite/src/utils/__tests__/countryConfig.test.js`

**Dependencies**: None

**Estimated Time**: 6 hours

---

### Task 1.3: Create Base Form Components
**Story**: As a developer, I need reusable components for the new form sections

**Acceptance Criteria**:
- [ ] Create `AddressFields.js` component
- [ ] Create `StatusSelector.js` component  
- [ ] Create `CountrySelector.js` component
- [ ] Add proper prop validation and TypeScript support
- [ ] Include responsive design
- [ ] Add accessibility attributes

**Files to Create**:
- `frontend-vite/src/components/AddressFields.js`
- `frontend-vite/src/components/StatusSelector.js`
- `frontend-vite/src/components/CountrySelector.js`

**Dependencies**: Task 1.1, 1.2

**Estimated Time**: 8 hours

---

## 📅 Sprint 2: Country-Specific Components (Days 3-4)

### Task 2.1: Enhance NationalIdField Component
**Story**: As a user, I want to enter country-appropriate identification numbers with proper validation

**Acceptance Criteria**:
- [ ] Update NationalIdField to accept country parameter
- [ ] Add validation for each country's ID format
- [ ] Update labels and placeholders based on country
- [ ] Add proper error messages for invalid formats
- [ ] Maintain backward compatibility with existing Israeli ID usage

**Files to Modify**:
- `frontend-vite/src/components/NationalIdField.js`

**Dependencies**: Task 1.2

**Estimated Time**: 6 hours

---

### Task 2.2: Create CountrySpecificFields Component
**Story**: As a user, I want to see only the identification and healthcare fields relevant to my country

**Acceptance Criteria**:
- [ ] Create dynamic component that renders fields based on country
- [ ] Support all 13 countries from the schema
- [ ] Include proper validation for each field type
- [ ] Add help text and examples for complex fields
- [ ] Handle field visibility based on required/optional status

**Files to Create**:
- `frontend-vite/src/components/CountrySpecificFields.js`

**Dependencies**: Task 1.2, 2.1

**Estimated Time**: 10 hours

---

### Task 2.3: Add DateOfBirth Field Component
**Story**: As a user, I want to enter patient date of birth instead of just age

**Acceptance Criteria**:
- [ ] Create DatePicker component or use existing CustomDatePicker
- [ ] Auto-calculate age from date of birth
- [ ] Add proper date validation (not future dates, reasonable age limits)
- [ ] Support both manual entry and picker selection
- [ ] Format dates according to user locale

**Files to Modify/Create**:
- Extend existing `frontend-vite/src/components/CustomDatePicker.js` or create new component

**Dependencies**: None

**Estimated Time**: 4 hours

---

## 📅 Sprint 3: PatientDetail Integration (Days 5-6)

### Task 3.1: Restructure PatientDetail Form Layout
**Story**: As a user, I want the patient form to be organized in logical sections with all required fields

**Acceptance Criteria**:
- [ ] Reorganize form into sections (Basic Info, Contact, Identification, Healthcare)
- [ ] Update form grid layout for better field organization
- [ ] Add section headers and styling
- [ ] Ensure responsive design on mobile devices
- [ ] Maintain proper tab order and accessibility

**Files to Modify**:
- `frontend-vite/src/components/PatientDetail.js`
- `frontend-vite/src/components/PatientDetail.css`

**Dependencies**: Tasks 1.3, 2.1, 2.2, 2.3

**Estimated Time**: 8 hours

---

### Task 3.2: Update State Management
**Story**: As a developer, I need the form state to handle all new fields properly

**Acceptance Criteria**:
- [ ] Extend editForm state to include all new fields
- [ ] Add state for country selection and dynamic fields
- [ ] Implement proper state updates when country changes
- [ ] Add validation state management
- [ ] Ensure proper form reset and cancel behavior

**Files to Modify**:
- `frontend-vite/src/components/PatientDetail.js`

**Dependencies**: Task 3.1

**Estimated Time**: 6 hours

---

### Task 3.3: Implement Field Validation
**Story**: As a user, I want proper validation feedback for all form fields

**Acceptance Criteria**:
- [ ] Add validation for all universal fields
- [ ] Implement country-specific validation rules
- [ ] Show real-time validation feedback
- [ ] Prevent form submission with invalid data
- [ ] Display helpful error messages

**Files to Modify**:
- `frontend-vite/src/components/PatientDetail.js`

**Dependencies**: Task 1.2, 3.2

**Estimated Time**: 6 hours

---

## 📅 Sprint 4: API Integration & Polish (Days 7-8)

### Task 4.1: Update API Integration
**Story**: As a system, I need to save and load all patient fields correctly

**Acceptance Criteria**:
- [ ] Update patient creation API calls to include new fields
- [ ] Update patient update API calls to include new fields
- [ ] Handle backward compatibility for existing patients
- [ ] Add proper error handling for API failures
- [ ] Update patient loading to populate all form fields

**Files to Modify**:
- `frontend-vite/src/components/PatientDetail.js`
- `frontend-vite/src/services/api.js` (if needed)

**Dependencies**: Task 3.2, 3.3

**Estimated Time**: 6 hours

---

### Task 4.2: Update Display/View Mode
**Story**: As a user, I want to see all patient information in a well-organized view

**Acceptance Criteria**:
- [ ] Update patient info display to show all fields
- [ ] Group fields logically in view mode
- [ ] Add proper formatting for dates, addresses, etc.
- [ ] Handle missing/optional fields gracefully
- [ ] Ensure proper RTL support for Hebrew

**Files to Modify**:
- `frontend-vite/src/components/PatientDetail.js`
- `frontend-vite/src/components/PatientDetail.css`

**Dependencies**: Task 4.1

**Estimated Time**: 6 hours

---

### Task 4.3: CSS Styling and Responsive Design
**Story**: As a user, I want the form to look professional and work well on all devices

**Acceptance Criteria**:
- [ ] Update CSS for new form sections
- [ ] Ensure responsive design for mobile devices
- [ ] Add proper spacing and visual hierarchy
- [ ] Style country-specific fields consistently
- [ ] Test on various screen sizes

**Files to Modify**:
- `frontend-vite/src/components/PatientDetail.css`
- `frontend-vite/src/styles/` (global styles if needed)

**Dependencies**: Task 4.2

**Estimated Time**: 6 hours

---

## 📅 Sprint 5: Testing & Documentation (Day 9)

### Task 5.1: Comprehensive Testing
**Story**: As a QA engineer, I need to verify all functionality works correctly

**Acceptance Criteria**:
- [ ] Test patient creation with all field types
- [ ] Test patient editing and updates
- [ ] Test all 13 supported countries
- [ ] Test form validation for each country
- [ ] Test responsive design on mobile/tablet
- [ ] Test Hebrew RTL layout
- [ ] Test backward compatibility with existing patients

**Test Cases to Create**:
- Patient form validation tests
- Country switching tests
- API integration tests
- UI/UX tests

**Dependencies**: All previous tasks

**Estimated Time**: 6 hours

---

### Task 5.2: Update Documentation
**Story**: As a developer, I need updated documentation for the new patient fields

**Acceptance Criteria**:
- [ ] Update README with new field descriptions
- [ ] Document country-specific field requirements
- [ ] Add examples for each country configuration
- [ ] Update API documentation if needed
- [ ] Create user guide for new fields

**Files to Update/Create**:
- `README.md`
- `docs/patient-fields.md` (new)
- `docs/country-configurations.md` (new)

**Dependencies**: Task 5.1

**Estimated Time**: 4 hours

---

## 🏆 Definition of Done

### For Each Task:
- [ ] Code is written and tested
- [ ] All acceptance criteria are met
- [ ] Code review is completed
- [ ] Documentation is updated
- [ ] No regression in existing functionality

### For the Epic:
- [ ] All schema fields are accessible in the GUI
- [ ] Country-specific fields work for all 13 countries
- [ ] Form validation is comprehensive and user-friendly
- [ ] Responsive design works on all devices
- [ ] Hebrew and English translations are complete
- [ ] Backward compatibility is maintained
- [ ] Performance is not degraded

## 📊 Risk Mitigation

### High Risk: Breaking Existing Functionality
**Mitigation**: 
- Implement feature flags for gradual rollout
- Maintain backward compatibility in API calls
- Extensive testing with existing patient data

### Medium Risk: UI Complexity
**Mitigation**:
- Use progressive disclosure (show relevant fields only)
- Group related fields in sections
- Add clear field labels and help text

### Medium Risk: Performance Impact
**Mitigation**:
- Lazy load country-specific components
- Optimize form rendering with React.memo
- Monitor bundle size impact

## 📈 Success Metrics

1. **Functionality**: 100% of schema fields accessible in GUI
2. **Usability**: < 2 seconds form load time
3. **Compatibility**: 0 regressions in existing patient workflows
4. **Internationalization**: 100% translation coverage
5. **Accessibility**: Pass WCAG 2.1 AA standards
