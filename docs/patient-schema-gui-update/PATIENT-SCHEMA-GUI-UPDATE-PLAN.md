# Patient Schema GUI Update Plan

## Project Overview
Update the frontend GUI (both Hebrew and English) to support the new country-specific patient schema fields as defined in `PatientSchemaFactory.js`. The updated schema now supports multiple countries with specific identification and healthcare fields.

## Current State Analysis

### Existing Fields in GUI (PatientDetail.js)
✅ **Currently Implemented:**
- name (combined field - needs separation)
- age
- gender
- email
- phone
- nationalId (Israeli ID only)
- healthFund (Israeli practices only)
- doctorSummary

❌ **Missing from GUI (Available in Schema):**
- firstName (separate field)
- lastName (separate field)
- dateOfBirth
- street
- city
- zipCode
- country
- Country-specific ID fields (e.g., socialSecurityNumber, healthCardNumber, etc.)
- Country-specific healthcare fields (e.g., insuranceProvider, province, state, etc.)
- status (active/inactive/archived)

## Goals
1. Separate name field into firstName and lastName
2. Add missing address fields (street, city, zipCode)
3. Add dateOfBirth field
4. Add country selection and dynamic country-specific fields
5. Add patient status field
6. Update translations for all new fields
7. Ensure responsive design for additional fields
8. Maintain backward compatibility

## Supported Countries & Their Fields

### Israel (Current - Partial Support)
- ✅ nationalId (implemented)
- ✅ healthFund (implemented)
- ❌ country field (missing)

### United States
- socialSecurityNumber
- insuranceProvider

### Canada
- healthCardNumber
- province

### United Kingdom
- nhsNumber

### Germany
- healthInsuranceNumber
- insuranceProvider

### France
- socialSecurityNumber
- vitaleCardNumber

### Spain
- healthCardNumber
- autonomousCommunity

### Brazil
- cpfNumber
- susNumber
- state

### Argentina
- nationalIdNumber
- healthInsuranceProvider
- province

### Japan
- healthInsuranceNumber
- prefecture
- insuranceType

### South Korea
- residentRegistrationNumber
- nationalHealthInsuranceNumber

### Australia
- medicareNumber
- state
- indigenousStatus

### New Zealand
- nationalHealthIndexNumber
- ethnicity

## Implementation Strategy

### Phase 1: Core Infrastructure Updates
1. Update translation files with new field labels
2. Create country-specific field components
3. Update PatientDetail.js to handle dynamic fields

### Phase 2: Field Implementation
1. Add universal fields (firstName, lastName, address, dateOfBirth, status)
2. Implement country selection logic
3. Add country-specific identification fields
4. Add country-specific healthcare fields

### Phase 3: UI/UX Enhancements
1. Optimize form layout for additional fields
2. Add field validation
3. Implement conditional field display
4. Test responsive design

### Phase 4: Integration & Testing
1. Update API calls to include new fields
2. Test all supported countries
3. Verify backward compatibility
4. Update documentation

## Timeline Estimation
- **Phase 1**: 2-3 days
- **Phase 2**: 3-4 days  
- **Phase 3**: 2-3 days
- **Phase 4**: 2-3 days
- **Total**: 9-13 days

## Risk Assessment
- **High Risk**: Breaking existing functionality during updates
- **Medium Risk**: UI becoming cluttered with too many fields
- **Low Risk**: Translation consistency across languages

## Success Criteria
1. All schema fields are accessible through the GUI
2. Country-specific fields display correctly based on practice location
3. Form validation works for all field types
4. Responsive design maintained
5. Both Hebrew and English translations complete
6. Backward compatibility preserved

## Next Steps
1. Create detailed technical specifications
2. Update translation files
3. Implement field components
4. Update PatientDetail.js
5. Test and validate
