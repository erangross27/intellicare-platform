# Task Index: Patient Schema GUI Update

## 📋 Overview
This directory contains individual task documents for updating the PatientDetails GUI to support the new patient schema with separate firstName/lastName fields and country-specific configurations.

## 📁 Task Structure

### 🎯 Sprint 1: Infrastructure & Translations (Days 1-2)

#### [Task 01: Update Translation Files](./TASK-01-Update-Translation-Files.md)
**Priority**: High | **Time**: 4 hours  
Add translations for all new fields in English and Hebrew, including country-specific field labels for all 13 supported countries.

#### [Task 02: Create Country Configuration Utility](./TASK-02-Create-Country-Configuration-Utility.md)
**Priority**: High | **Time**: 6 hours  
Create centralized configuration system for country-specific fields, validation rules, and field definitions.

#### [Task 03: Create AddressFields Component](./TASK-03-Create-AddressFields-Component.md)
**Priority**: Medium | **Time**: 4 hours  
Build reusable component for street, city, and zipCode fields with proper validation.

#### [Task 04: Create StatusSelector Component](./TASK-04-Create-StatusSelector-Component.md)
**Priority**: Medium | **Time**: 3 hours  
Create component for patient status selection (active/inactive/archived) with visual indicators.

#### [Task 05: Create CountrySelector Component](./TASK-05-Create-CountrySelector-Component.md)
**Priority**: High | **Time**: 4 hours  
Build dropdown component for country selection that triggers field configuration updates.

#### [Task 06: Create DateOfBirth Component](./TASK-06-Create-DateOfBirth-Component.md)
**Priority**: Medium | **Time**: 4 hours  
Implement date picker component with age auto-calculation and proper validation.

#### [Task 07: Restructure PatientDetail Form](./TASK-07-RESTRUCTURE-PATIENTDETAIL-FORM.md)
**Priority**: High | **Time**: 8 hours  
Reorganize form layout into logical sections and separate firstName/lastName fields.

### 🎯 Sprint 2: Country-Specific Components (Days 3-4)

#### [Task 08: Create CountrySpecificFields Component](./TASK-08-CountrySpecificFields-Component.md)
**Priority**: High | **Time**: 10 hours  
Build dynamic component that renders country-specific identification and healthcare fields based on selected country.

### 🎯 Sprint 3: PatientDetail Integration (Days 5-6)

#### [Task 09: Update PatientDetail Form Structure](./TASK-09-Update-PatientDetail-Form-Structure.md)
**Priority**: High | **Time**: 8 hours  
Restructure PatientDetail.js form layout with logical sections and separate firstName/lastName fields.

#### [Task 10: Update State Management](./TASK-10-Update-State-Management.md)
**Priority**: High | **Time**: 6 hours  
Update component state management to handle all new fields including separate firstName/lastName and country-specific fields.

#### [Task 11: Implement Field Validation](./TASK-11-Implement-Field-Validation.md)
**Priority**: High | **Time**: 6 hours  
Implement comprehensive field validation including country-specific validation rules and real-time feedback.

### 🎯 Sprint 4: API Integration & Polish (Days 7-8)

#### [Task 12: Update API Integration](./TASK-12-Update-API-Integration.md)
**Priority**: High | **Time**: 6 hours  
Update API integration to handle all new fields including firstName/lastName separation and country-specific fields.

#### [Task 13: Update View Mode Display](./TASK-13-Update-View-Mode-Display.md)
**Priority**: High | **Time**: 6 hours  
Update patient view mode to display all information including separate firstName/lastName in organized sections.

#### [Task 14: CSS Styling and Responsive Design](./TASK-14-CSS-Styling-Responsive-Design.md)
**Priority**: Medium | **Time**: 6 hours  
Update CSS styling for new form sections and ensure responsive design with proper Hebrew RTL support.

### 🎯 Sprint 5: Testing & Documentation (Day 9)

#### [Task 15: Comprehensive Testing and Documentation](./TASK-15-Comprehensive-Testing-Documentation.md)
**Priority**: High | **Time**: 8 hours  
Conduct comprehensive testing of all functionality and update documentation for the new patient schema implementation.

## 📊 Summary Statistics

- **Total Tasks**: 15
- **Total Estimated Time**: 85 hours (≈ 11 working days)
- **High Priority Tasks**: 10
- **Medium Priority Tasks**: 5
- **Critical Path Tasks**: 8

## � Task Dependencies

### Critical Path
```
Task 01 → Task 02 → Task 08 → Task 09 → Task 10 → Task 11 → Task 12 → Task 15
```

### Parallel Development Opportunities
- Tasks 03, 04, 05, 06, 07 can be developed in parallel after Task 01
- Tasks 13, 14 can be developed in parallel with Tasks 12
- Task 15 requires all other tasks to be complete

## 🚀 Getting Started

1. **Start Here**: [Task 01: Update Translation Files](./TASK-01-Update-Translation-Files.md)
2. **Next**: [Task 02: Create Country Configuration Utility](./TASK-02-Create-Country-Configuration-Utility.md)
3. **Then**: Choose parallel tasks based on team availability

## 📋 Key Features Implemented

✅ **firstName/lastName Separation**: Replace combined name with separate fields  
✅ **13 Country Support**: Complete configuration for all countries in schema  
✅ **Address Fields**: Street, city, zipCode with proper validation  
✅ **Patient Status**: Active/inactive/archived with visual indicators  
✅ **Date of Birth**: Auto-age calculation and proper date validation  
✅ **Country-Specific Fields**: Dynamic fields based on selected country  
✅ **Responsive Design**: Mobile-first approach with tablet and desktop optimization  
✅ **Hebrew RTL Support**: Complete right-to-left layout support  
✅ **Field Validation**: Real-time validation with country-specific rules  
✅ **API Integration**: Updated endpoints with backward compatibility  

## 🎯 Success Criteria

- [ ] All 13 countries fully supported
- [ ] firstName/lastName working independently  
- [ ] Responsive design on all devices
- [ ] Hebrew RTL layout functional
- [ ] 95%+ test coverage
- [ ] Backward compatibility maintained
- [ ] Performance standards met
- [ ] Accessibility compliance achieved
