// NEW TRANSLATION KEYS FOR MEDICAL HISTORY REDESIGN
// Add these to scripts/populate-translations.js

// ENGLISH TRANSLATIONS
const englishKeys = {
  // Medical History Card Components
  medicalHistoryCard: 'Medical History Card',
  visitHistoryCard: 'Visit History Card', 
  documentHistoryCard: 'Document History Card',
  timelineCard: 'Timeline Card',
  
  // Card Actions
  viewDetails: 'View Details',
  hideDetails: 'Hide Details',
  showMore: 'Show More',
  showLess: 'Show Less',
  expandAll: 'Expand All',
  collapseAll: 'Collapse All',
  
  // Medical Categories
  medications: 'Medications',
  procedures: 'Procedures',
  observations: 'Observations',
  vitals: 'Vital Signs',
  allergies: 'Allergies',
  immunizations: 'Immunizations',
  
  // Detailed Categories
  bloodPressure: 'Blood Pressure',
  heartRate: 'Heart Rate',
  temperature: 'Temperature',
  weight: 'Weight',
  height: 'Height',
  oxygenSaturation: 'Oxygen Saturation',
  
  // Visit Types & Timeline Events
  routineVisit: 'Routine Visit',
  emergencyVisit: 'Emergency Visit',
  followUpVisit: 'Follow-up Visit',
  consultationVisit: 'Consultation',
  
  // Timeline Events
  documentUploaded: 'Document Uploaded',
  visitRecorded: 'Visit Recorded',
  analysisCompleted: 'Analysis Completed',
  patientRegistered: 'Patient Registered',
  
  // Document Types
  labReport: 'Lab Report',
  imagingStudy: 'Imaging Study',
  prescription: 'Prescription',
  dischargeSummary: 'Discharge Summary',
  consultationNotes: 'Consultation Notes',
  consentForm: 'Consent Form',
  
  // Medical Insights
  clinicalReview: 'Clinical Review Required',
  manualReview: 'Manual Review Needed',
  updateRecord: 'Update Medical Record',
  
  // Status Indicators
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  pending: 'Pending',
  inProgress: 'In Progress',
  
  // Priority Levels
  urgent: 'Urgent',
  high: 'High Priority',
  normal: 'Normal',
  low: 'Low Priority',
  
  // Medical Terminology
  hypertension: 'Hypertension',
  diabetes: 'Diabetes',
  heartDisease: 'Heart Disease',
  asthma: 'Asthma',
  depression: 'Depression',
  anxiety: 'Anxiety',
  
  // Medical Procedures
  bloodTest: 'Blood Test',
  xRay: 'X-Ray',
  mri: 'MRI',
  ctScan: 'CT Scan',
  ultrasound: 'Ultrasound',
  ecg: 'ECG',
  
  // UI Section Headers
  patientTimeline: 'Patient Timeline',
  medicalHistoryOverview: 'Medical History Overview',
  recentActivity: 'Recent Activity',
  chronicConditions: 'Chronic Conditions',
  currentMedications: 'Current Medications',
  
  // Card Sections
  entryDetails: 'Entry Details',
  clinicalNotes: 'Clinical Notes',
  followUpInstructions: 'Follow-up Instructions',
  
  // Error Messages
  noHistoryAvailable: 'No Medical History Available',
  loadingHistoryError: 'Error Loading History',
  parseError: 'Error Parsing Medical Data',
  timelineError: 'Timeline Unavailable',
  
  // Success Messages
  historySaved: 'History Saved Successfully',
  timelineUpdated: 'Timeline Updated',
  
  // Numbered Items
  item1: 'Item 1',
  item2: 'Item 2',
  item3: 'Item 3',
  item4: 'Item 4',
  item5: 'Item 5',
  
  // Generic Labels
  recommendation: 'Recommendation',
  instruction: 'Instruction',
  note: 'Note',
  warning: 'Warning',
  
  // Time References
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  
  // Date Labels
  uploadedOn: 'Uploaded on',
  recordedOn: 'Recorded on',
  lastUpdated: 'Last Updated',
  
  // Visit Recording
  newVisitEntry: 'New Visit Entry',
  visitSummary: 'Visit Summary',
  chiefComplaint: 'Chief Complaint',
  physicalExam: 'Physical Examination',
  assessment: 'Assessment',
  plan: 'Plan'
};

// HEBREW TRANSLATIONS
const hebrewKeys = {
  // Medical History Card Components
  medicalHistoryCard: 'כרטיס היסטוריה רפואית',
  visitHistoryCard: 'כרטיס היסטוריית ביקורים',
  documentHistoryCard: 'כרטיס היסטוריית מסמכים',
  timelineCard: 'כרטיס ציר זמן',
  
  // Card Actions
  viewDetails: 'צפה בפרטים',
  hideDetails: 'הסתר פרטים',
  showMore: 'הצג עוד',
  showLess: 'הצג פחות',
  expandAll: 'הרחב הכל',
  collapseAll: 'כווץ הכל',
  
  // Medical Categories
  medications: 'תרופות',
  procedures: 'פרוצדורות',
  observations: 'תצפיות',
  vitals: 'סימנים חיוניים',
  allergies: 'אלרגיות',
  immunizations: 'חיסונים',
  
  // Detailed Categories
  bloodPressure: 'לחץ דם',
  heartRate: 'דופק',
  temperature: 'טמפרטורה',
  weight: 'משקל',
  height: 'גובה',
  oxygenSaturation: 'רוויה בחמצן',
  
  // Visit Types & Timeline Events
  routineVisit: 'ביקור שגרתי',
  emergencyVisit: 'ביקור חירום',
  followUpVisit: 'ביקור מעקב',
  consultationVisit: 'ייעוץ',
  
  // Timeline Events
  documentUploaded: 'מסמך הועלה',
  visitRecorded: 'ביקור נרשם',
  analysisCompleted: 'ניתוח הושלם',
  patientRegistered: 'מטופל נרשם',
  
  // Document Types
  labReport: 'דוח מעבדה',
  imagingStudy: 'מחקר הדמיה',
  prescription: 'מרשם',
  dischargeSummary: 'סיכום שחרור',
  consultationNotes: 'רשימות ייעוץ',
  consentForm: 'טופס הסכמה',
  
  // Medical Insights
  clinicalReview: 'נדרשת סקירה קלינית',
  manualReview: 'נדרשת סקירה ידנית',
  updateRecord: 'עדכן רשומה רפואית',
  
  // Status Indicators
  processing: 'מעבד',
  completed: 'הושלם',
  failed: 'נכשל',
  pending: 'ממתין',
  inProgress: 'בתהליך',
  
  // Priority Levels
  urgent: 'דחוף',
  high: 'עדיפות גבוהה',
  normal: 'רגיל',
  low: 'עדיפות נמוכה',
  
  // Medical Terminology
  hypertension: 'יתר לחץ דם',
  diabetes: 'סוכרת',
  heartDisease: 'מחלת לב',
  asthma: 'אסתמה',
  depression: 'דיכאון',
  anxiety: 'חרדה',
  
  // Medical Procedures
  bloodTest: 'בדיקת דם',
  xRay: 'צילום רנטגן',
  mri: 'MRI',
  ctScan: 'CT',
  ultrasound: 'אולטרסאונד',
  ecg: 'אק"ג',
  
  // UI Section Headers
  patientTimeline: 'ציר זמן המטופל',
  medicalHistoryOverview: 'סקירת היסטוריה רפואית',
  recentActivity: 'פעילות אחרונה',
  chronicConditions: 'מצבים כרוניים',
  currentMedications: 'תרופות נוכחיות',
  
  // Card Sections
  entryDetails: 'פרטי רשומה',
  clinicalNotes: 'הערות קליניות',
  followUpInstructions: 'הוראות מעקב',
  
  // Error Messages
  noHistoryAvailable: 'אין היסטוריה רפואית זמינה',
  loadingHistoryError: 'שגיאה בטעינת היסטוריה',
  parseError: 'שגיאה בפענוח נתונים רפואיים',
  timelineError: 'ציר הזמן לא זמין',
  
  // Success Messages
  historySaved: 'היסטוריה נשמרה בהצלחה',
  timelineUpdated: 'ציר הזמן עודכן',
  
  // Numbered Items
  item1: 'פריט 1',
  item2: 'פריט 2',
  item3: 'פריט 3',
  item4: 'פריט 4',
  item5: 'פריט 5',
  
  // Generic Labels
  recommendation: 'המלצה',
  instruction: 'הוראה',
  note: 'הערה',
  warning: 'אזהרה',
  
  // Time References
  today: 'היום',
  yesterday: 'אתמול',
  thisWeek: 'השבוע',
  lastWeek: 'השבוע שעבר',
  thisMonth: 'החודש',
  lastMonth: 'החודש שעבר',
  
  // Date Labels
  uploadedOn: 'הועלה ב',
  recordedOn: 'נרשם ב',
  lastUpdated: 'עודכן לאחרונה',
  
  // Visit Recording
  newVisitEntry: 'רשומת ביקור חדשה',
  visitSummary: 'סיכום ביקור',
  chiefComplaint: 'תלונה עיקרית',
  physicalExam: 'בדיקה גופנית',
  assessment: 'הערכה',
  plan: 'תוכנית'
};

module.exports = { englishKeys, hebrewKeys };
