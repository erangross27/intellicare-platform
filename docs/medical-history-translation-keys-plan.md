# Medical History Redesign - Translation Keys Plan

## 🎯 **Critical Requirements**
- **ZERO static text** - Everything must use `t('keyName')`
- **Database-driven** - All keys stored in MongoDB via populate-translations.js
- **Dual language** - English (en) and Hebrew (he) with RTL support
- **Medical accuracy** - Proper Hebrew medical terminology

## 📋 **Translation Keys Inventory**

### **✅ EXISTING KEYS (Already Available)**
```javascript
// Basic Medical Terms
symptoms: 'Symptoms' / 'תסמינים'
diagnosis: 'Diagnosis' / 'אבחנה' 
treatment: 'Treatment' / 'טיפול'
medicalHistory: 'Medical History' / 'היסטוריה רפואית'
labResults: 'Lab Results' / 'תוצאות מעבדה'

// UI Elements
expand: 'Expand' / 'הרחב'
collapse: 'Collapse' / 'כווץ'
date: 'Date' / 'תאריך'
entryDate: 'Entry Date' / 'תאריך רשומה'
loading: 'Loading...' / 'טוען...'
error: 'Error occurred' / 'אירעה שגיאה'

// Patient Info
fullName: 'Full Name' / 'שם מלא'
age: 'Age' / 'גיל'
gender: 'Gender' / 'מין'
email: 'Email' / 'אימייל'
phone: 'Phone' / 'טלפון'
```

### **❌ NEW KEYS NEEDED**

#### **1. Medical History Card Components**
```javascript
// Card Headers
medicalHistoryCard: 'Medical History Card' / 'כרטיס היסטוריה רפואית'
visitHistoryCard: 'Visit History Card' / 'כרטיס היסטוריית ביקורים'
documentHistoryCard: 'Document History Card' / 'כרטיס היסטוריית מסמכים'
timelineCard: 'Timeline Card' / 'כרטיס ציר זמן'

// Card Actions
viewDetails: 'View Details' / 'צפה בפרטים'
hideDetails: 'Hide Details' / 'הסתר פרטים'
showMore: 'Show More' / 'הצג עוד'
showLess: 'Show Less' / 'הצג פחות'
expandAll: 'Expand All' / 'הרחב הכל'
collapseAll: 'Collapse All' / 'כווץ הכל'
```

#### **2. Medical Categories**
```javascript
// Primary Categories
medications: 'Medications' / 'תרופות'
procedures: 'Procedures' / 'פרוצדורות'
observations: 'Observations' / 'תצפיות'
vitals: 'Vital Signs' / 'סימנים חיוניים'
allergies: 'Allergies' / 'אלרגיות'
immunizations: 'Immunizations' / 'חיסונים'

// Detailed Categories
bloodPressure: 'Blood Pressure' / 'לחץ דם'
heartRate: 'Heart Rate' / 'דופק'
temperature: 'Temperature' / 'טמפרטורה'
weight: 'Weight' / 'משקל'
height: 'Height' / 'גובה'
oxygenSaturation: 'Oxygen Saturation' / 'רוויה בחמצן'
```

#### **3. Visit Types & Timeline Events**
```javascript
// Visit Types
routineVisit: 'Routine Visit' / 'ביקור שגרתי'
emergencyVisit: 'Emergency Visit' / 'ביקור חירום'
followUpVisit: 'Follow-up Visit' / 'ביקור מעקב'
consultationVisit: 'Consultation' / 'ייעוץ'

// Timeline Events
documentUploaded: 'Document Uploaded' / 'מסמך הועלה'
visitRecorded: 'Visit Recorded' / 'ביקור נרשם'
analysisCompleted: 'Analysis Completed' / 'ניתוח הושלם'
patientRegistered: 'Patient Registered' / 'מטופל נרשם'
```

#### **4. Document Types & Medical Insights**
```javascript
// Document Categories
labReport: 'Lab Report' / 'דוח מעבדה'
imagingStudy: 'Imaging Study' / 'מחקר הדמיה'
prescription: 'Prescription' / 'מרשם'
dischargeSummary: 'Discharge Summary' / 'סיכום שחרור'
consultationNotes: 'Consultation Notes' / 'רשימות ייעוץ'
consentForm: 'Consent Form' / 'טופס הסכמה'

// Medical Insights
clinicalReview: 'Clinical Review Required' / 'נדרשת סקירה קלינית'
manualReview: 'Manual Review Needed' / 'נדרשת סקירה ידנית'
updateRecord: 'Update Medical Record' / 'עדכן רשומה רפואית'
```

#### **5. Status Indicators**
```javascript
// Processing Status
processing: 'Processing' / 'מעבד'
completed: 'Completed' / 'הושלם'
failed: 'Failed' / 'נכשל'
pending: 'Pending' / 'ממתין'
inProgress: 'In Progress' / 'בתהליך'

// Priority Levels
urgent: 'Urgent' / 'דחוף'
high: 'High Priority' / 'עדיפות גבוהה'
normal: 'Normal' / 'רגיל'
low: 'Low Priority' / 'עדיפות נמוכה'
```

#### **6. Medical Terminology (Hebrew Medical Terms)**
```javascript
// Common Medical Conditions
hypertension: 'Hypertension' / 'יתר לחץ דם'
diabetes: 'Diabetes' / 'סוכרת'
heartDisease: 'Heart Disease' / 'מחלת לב'
asthma: 'Asthma' / 'אסתמה'
depression: 'Depression' / 'דיכאון'
anxiety: 'Anxiety' / 'חרדה'

// Medical Procedures
bloodTest: 'Blood Test' / 'בדיקת דם'
xRay: 'X-Ray' / 'צילום רנטגן'
mri: 'MRI' / 'MRI'
ctScan: 'CT Scan' / 'CT'
ultrasound: 'Ultrasound' / 'אולטרסאונד'
ecg: 'ECG' / 'אק"ג'
```

#### **7. UI Section Headers**
```javascript
// Main Sections
patientTimeline: 'Patient Timeline' / 'ציר זמן המטופל'
medicalHistoryOverview: 'Medical History Overview' / 'סקירת היסטוריה רפואית'
recentActivity: 'Recent Activity' / 'פעילות אחרונה'
chronicConditions: 'Chronic Conditions' / 'מצבים כרוניים'
currentMedications: 'Current Medications' / 'תרופות נוכחיות'

// Card Sections
entryDetails: 'Entry Details' / 'פרטי רשומה'
clinicalNotes: 'Clinical Notes' / 'הערות קליניות'
followUpInstructions: 'Follow-up Instructions' / 'הוראות מעקב'
```

#### **8. Error Messages & Validation**
```javascript
// Error States
noHistoryAvailable: 'No Medical History Available' / 'אין היסטוריה רפואית זמינה'
loadingHistoryError: 'Error Loading History' / 'שגיאה בטעינת היסטוריה'
parseError: 'Error Parsing Medical Data' / 'שגיאה בפענוח נתונים רפואיים'
timelineError: 'Timeline Unavailable' / 'ציר הזמן לא זמין'

// Success Messages
historySaved: 'History Saved Successfully' / 'היסטוריה נשמרה בהצלחה'
timelineUpdated: 'Timeline Updated' / 'ציר הזמן עודכן'
```

#### **9. Numbered List Items (For Treatment Recommendations)**
```javascript
// Numbered Items
item1: 'Item 1' / 'פריט 1'
item2: 'Item 2' / 'פריט 2'
item3: 'Item 3' / 'פריט 3'
item4: 'Item 4' / 'פריט 4'
item5: 'Item 5' / 'פריט 5'

// Generic Labels
recommendation: 'Recommendation' / 'המלצה'
instruction: 'Instruction' / 'הוראה'
note: 'Note' / 'הערה'
warning: 'Warning' / 'אזהרה'
```

#### **10. Time & Date Formatting**
```javascript
// Time References
today: 'Today' / 'היום'
yesterday: 'Yesterday' / 'אתמול'
thisWeek: 'This Week' / 'השבוע'
lastWeek: 'Last Week' / 'השבוע שעבר'
thisMonth: 'This Month' / 'החודש'
lastMonth: 'Last Month' / 'החודש שעבר'

// Date Labels
uploadedOn: 'Uploaded on' / 'הועלה ב'
recordedOn: 'Recorded on' / 'נרשם ב'
lastUpdated: 'Last Updated' / 'עודכן לאחרונה'
```

#### **11. Integration with NewVisit Component**
```javascript
// Visit Recording
newVisitEntry: 'New Visit Entry' / 'רשומת ביקור חדשה'
visitSummary: 'Visit Summary' / 'סיכום ביקור'
chiefComplaint: 'Chief Complaint' / 'תלונה עיקרית'
physicalExam: 'Physical Examination' / 'בדיקה גופנית'
assessment: 'Assessment' / 'הערכה'
plan: 'Plan' / 'תוכנית'
```

## 🎯 **Implementation Priority**

### **Phase 1: Core UI Elements (Immediate)**
- Card headers and actions
- Basic medical categories
- Status indicators

### **Phase 2: Medical Terminology (Next)**
- Hebrew medical terms
- Document types
- Visit types

### **Phase 3: Advanced Features (Final)**
- Timeline events
- Error handling
- Success messages

## 📝 **Next Steps**
1. Add all keys to `scripts/populate-translations.js`
2. Run translation script to update MongoDB
3. Verify keys load correctly in both languages
4. Begin UI component development using only these keys

## 📊 **Translation Keys Summary**

### **Total Keys Count**
- **Existing Keys**: ~50 keys already available
- **New Keys Needed**: ~80 additional keys
- **Total System**: ~130 translation keys for complete medical history redesign

### **Key Categories Breakdown**
1. **Medical Categories**: 15 keys (medications, procedures, vitals, etc.)
2. **UI Components**: 20 keys (cards, buttons, actions)
3. **Visit Types**: 8 keys (routine, emergency, follow-up, etc.)
4. **Document Types**: 12 keys (lab reports, imaging, prescriptions)
5. **Status Indicators**: 10 keys (processing, completed, failed)
6. **Medical Terms**: 15 keys (conditions, procedures)
7. **Time/Date**: 10 keys (today, yesterday, uploaded on)
8. **Error/Success**: 10 keys (validation and feedback messages)

## 🔄 **Key Naming Convention**
- Use camelCase: `medicalHistoryCard`
- Be descriptive: `expandMedicalHistoryEntry` not just `expand`
- Group related keys: `visit*`, `timeline*`, `medical*`
- Avoid abbreviations: `bloodPressure` not `bp`

## ⚠️ **Critical Reminders**
- **NO hardcoded text** in any component
- **ALL text must use t('keyName')**
- **Test both Hebrew (RTL) and English (LTR)**
- **Medical terms must be accurate in Hebrew**
- **Update populate-translations.js BEFORE development**
