# Task 01: Update Translation Files

## 📋 Task Overview
**Epic**: Patient Schema GUI Update  
**Sprint**: Phase 1 - Infrastructure  
**Estimated Time**: 4 hours  
**Priority**: High (Blocking)  
**Assignee**: Developer  

## 🎯 Objective
Update both English and Hebrew translation files to include all new patient fields, including firstName/lastName separation and country-specific fields for all 13 supported countries.

## 📝 Description
As a user, I want all new patient fields to be properly translated in both English and Hebrew so that the interface displays correctly in both languages with proper RTL support.

## ✅ Acceptance Criteria
- [ ] Add translations for firstName and lastName as separate fields
- [ ] Add universal field translations (dateOfBirth, street, city, zipCode, country, status)
- [ ] Add country-specific field translations for all 13 supported countries
- [ ] Add section header translations (basicInformation, contactInformation, etc.)
- [ ] Add field validation messages and help text
- [ ] Verify Hebrew RTL compatibility for all new translations
- [ ] Test translation loading and fallback behavior
- [ ] Ensure no duplicate or conflicting translation keys

## 🔧 Technical Requirements

### Files to Modify
- `frontend-vite/src/translations/en.json`
- `frontend-vite/src/translations/he.json`

### English Translations to Add
```json
{
  "firstName": "First Name",
  "lastName": "Last Name", 
  "enterFirstName": "Enter first name",
  "enterLastName": "Enter last name",
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
  "selectCountry": "Select Country",
  "basicInformation": "Basic Information",
  "contactInformation": "Contact Information",
  "identification": "Identification",
  "healthcareInformation": "Healthcare Information",
  
  // Country-specific fields
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
  "ethnicity": "Ethnicity",
  
  // Country names
  "israel": "Israel",
  "unitedstates": "United States",
  "canada": "Canada",
  "unitedkingdom": "United Kingdom",
  "germany": "Germany",
  "france": "France",
  "spain": "Spain",
  "brazil": "Brazil",
  "argentina": "Argentina",
  "japan": "Japan",
  "southkorea": "South Korea",
  "australia": "Australia",
  "newzealand": "New Zealand",
  
  // Validation messages
  "firstNameRequired": "First name is required",
  "lastNameRequired": "Last name is required",
  "invalidDateOfBirth": "Invalid date of birth",
  "fieldRequired": "This field is required",
  "invalidFormat": "Invalid format"
}
```

### Hebrew Translations to Add
```json
{
  "firstName": "שם פרטי",
  "lastName": "שם משפחה",
  "enterFirstName": "הזן שם פרטי",
  "enterLastName": "הזן שם משפחה",
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
  "selectCountry": "בחר מדינה",
  "basicInformation": "מידע בסיסי",
  "contactInformation": "פרטי התקשרות",
  "identification": "זיהוי",
  "healthcareInformation": "מידע רפואי",
  
  // Country-specific fields
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
  "ethnicity": "מוצא אתני",
  
  // Country names
  "israel": "ישראל",
  "unitedstates": "ארצות הברית",
  "canada": "קנדה",
  "unitedkingdom": "בריטניה",
  "germany": "גרמניה",
  "france": "צרפת",
  "spain": "ספרד",
  "brazil": "ברזיל",
  "argentina": "ארגנטינה",
  "japan": "יפן",
  "southkorea": "דרום קוריאה",
  "australia": "אוסטרליה",
  "newzealand": "ניו זילנד",
  
  // Validation messages
  "firstNameRequired": "שם פרטי נדרש",
  "lastNameRequired": "שם משפחה נדרש",
  "invalidDateOfBirth": "תאריך לידה לא תקין",
  "fieldRequired": "שדה זה נדרש",
  "invalidFormat": "פורמט לא תקין"
}
```

## 🧪 Testing Checklist
- [ ] Verify all new translation keys load correctly
- [ ] Test both English and Hebrew languages
- [ ] Confirm RTL layout works with Hebrew translations
- [ ] Check for translation key conflicts or duplicates
- [ ] Test fallback behavior for missing translations
- [ ] Verify special characters and unicode support
- [ ] Test on different browsers and devices

## 📦 Dependencies
**Blocks**: All other tasks depend on this translation update

**Requirements**: 
- Access to translation files
- Understanding of existing translation structure
- Hebrew language validation capability

## ✨ Definition of Done
- [ ] All translation keys added to both files
- [ ] No syntax errors in JSON files
- [ ] Hebrew translations are accurate and culturally appropriate
- [ ] RTL layout compatibility verified
- [ ] Code review completed
- [ ] No duplicate or conflicting keys
- [ ] Translation loading tested in application

## 📚 Additional Notes
- Maintain consistency with existing translation patterns
- Use formal/medical Hebrew terminology where appropriate
- Ensure translations are concise and user-friendly
- Consider cultural sensitivity for different countries
- Keep backup of original files before modification

## 🔗 Related Tasks
- **Next**: Task 02 - Create Country Configuration Utility
- **Depends On**: None (First task)
