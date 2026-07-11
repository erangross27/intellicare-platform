// Complete IntelliCare Function Tooltip Definitions - 100+ Functions
// All Categories: Document Management, Billing & Insurance, Communication, 
// Reporting & Analytics, Clinical, System/Admin, External Integrations, and More

const completeTooltipDefinitions = {
  // ========== DOCUMENT MANAGEMENT FUNCTIONS ==========
  uploadDocument: {
    name: { he: 'העלת מסמך רפואי', en: 'Upload Medical Document' },
    contextualTitle: { 
      he: 'בואו נעלה מסמך רפואי חדש למטופל', 
      en: "Let's upload a new medical document for the patient" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'העלה מסמכים רפואיים חדשים כמו מרשמים, תוצאות בדיקות, או דוחות רפואיים למערכת'
        : 'Upload new medical documents such as prescriptions, test results, or medical reports to the system';
    },
    whyNeeded: {
      he: 'חיוני לשמירה מרכזית של כל המסמכים הרפואיים של המטופל במקום אחד מאובטח',
      en: 'Essential for centralized storage of all patient medical documents in one secure location'
    }
  },

  analyzeDocument: {
    name: { he: 'ניתוח מסמך רפואי', en: 'Analyze Medical Document' },
    contextualTitle: { 
      he: 'בואו ננתח מסמך רפואי באמצעות בינה מלאכותית', 
      en: "Let's analyze a medical document using AI" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ניתוח אוטומטי של מסמכים רפואיים להפקת מידע מובנה וזיהוי נתונים קליניים חשובים'
        : 'Automatic analysis of medical documents to extract structured information and identify important clinical data';
    },
    whyNeeded: {
      he: 'מאפשר עיבוד מהיר ויעיל של מסמכים רפואיים מורכבים וחילוץ מידע קליני חשוב',
      en: 'Enables rapid and efficient processing of complex medical documents and extraction of important clinical information'
    }
  },

  getDocuments: {
    name: { he: 'הצגת מסמכי המטופל', en: 'View Patient Documents' },
    contextualTitle: { 
      he: 'בואו נציג את כל המסמכים של המטופל', 
      en: "Let's view all patient documents" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת כל המסמכים הרפואיים של המטופל בצורה מסודרת עם אפשרות סינון לפי סוג וטווח תאריכים'
        : 'Display all patient medical documents in an organized manner with filtering options by type and date range';
    },
    whyNeeded: {
      he: 'מאפשר למקצועי הבריאות לקבל מבט כללי מהיר על כל המסמכים הרפואיים של המטופל',
      en: 'Allows healthcare professionals to get a quick overview of all patient medical documents'
    }
  },

  deleteDocument: {
    name: { he: 'מחיקת מסמך רפואי', en: 'Delete Medical Document' },
    contextualTitle: { 
      he: 'בואו נמחק מסמך רפואי מהמערכת', 
      en: "Let's delete a medical document from the system" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'מחיקה מבוקרת של מסמכים רפואיים עם רישום מלא לצרכי ביקורת וציות'
        : 'Controlled deletion of medical documents with full audit logging for compliance purposes';
    },
    whyNeeded: {
      he: 'מאפשר ניהול תיקים רפואיים תוך שמירה על עקבות ביקורת מלאות',
      en: 'Enables medical records management while maintaining complete audit trails'
    }
  },

  searchDocuments: {
    name: { he: 'חיפוש במסמכים רפואיים', en: 'Search Medical Documents' },
    contextualTitle: { 
      he: 'בואו נחפש במסמכים הרפואיים', 
      en: "Let's search through medical documents" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש מתקדם במסמכים רפואיים לפי תוכן, סוג, תאריך, או מטופל'
        : 'Advanced search through medical documents by content, type, date, or patient';
    },
    whyNeeded: {
      he: 'מאפשר מציאה מהירה של מידע קליני ספציפי מתוך כמויות גדולות של מסמכים',
      en: 'Enables quick finding of specific clinical information from large volumes of documents'
    }
  },

  // ========== BILLING & INSURANCE FUNCTIONS ==========
  createInvoice: {
    name: { he: 'יצירת חשבונית', en: 'Create Invoice' },
    contextualTitle: { 
      he: 'בואו ניצור חשבונית לטיפול הרפואי', 
      en: "Let's create an invoice for medical treatment" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'יצירת חשבוניות מפורטות עבור שירותים רפואיים כולל קודי CPT ואבחון ICD-10'
        : 'Create detailed invoices for medical services including CPT codes and ICD-10 diagnoses';
    },
    whyNeeded: {
      he: 'חיוני לניהול פיננסי של המרפאה ולהגשת תביעות לחברות ביטוח',
      en: 'Essential for practice financial management and insurance claim submissions'
    }
  },

  recordPayment: {
    name: { he: 'רישום תשלום', en: 'Record Payment' },
    contextualTitle: { 
      he: 'בואו נרשום תשלום שהתקבל', 
      en: "Let's record a received payment" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'רישום תשלומים מדויק כולל סוג התשלום, סכום, ותאריך לצרכי הנהלת חשבונות'
        : 'Accurate payment recording including payment type, amount, and date for accounting purposes';
    },
    whyNeeded: {
      he: 'מבטיח מעקב מדויק אחר כל התקבולים והזרמת המזומנים של המרפאה',
      en: 'Ensures accurate tracking of all receivables and cash flow for the practice'
    }
  },

  verifyInsurance: {
    name: { he: 'אימות ביטוח רפואי', en: 'Verify Insurance Coverage' },
    contextualTitle: { 
      he: 'בואו נאמת את כיסוי הביטוח הרפואי', 
      en: "Let's verify medical insurance coverage" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'בדיקת כיסוי ביטוחי בזמן אמת כולל זכאויות, השתתפות עצמית, ומגבלות פוליסה'
        : 'Real-time insurance coverage verification including eligibility, copays, and policy limitations';
    },
    whyNeeded: {
      he: 'מונע בעיות תשלום עתידיות ומבטיח שהמטופל מקבל שירותים מכוסים',
      en: 'Prevents future payment issues and ensures patients receive covered services'
    }
  },

  submitInsuranceClaim: {
    name: { he: 'הגשת תביעת ביטוח', en: 'Submit Insurance Claim' },
    contextualTitle: { 
      he: 'בואו נגיש תביעת ביטוח לחברת הביטוח', 
      en: "Let's submit an insurance claim to the insurance company" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הגשה אלקטרונית של תביעות ביטוח עם כל הקודים הרפואיים הנדרשים'
        : 'Electronic submission of insurance claims with all required medical codes';
    },
    whyNeeded: {
      he: 'מאפשר קבלת החזרים מחברות הביטוח באופן יעיל ומהיר',
      en: 'Enables efficient and fast reimbursement from insurance companies'
    }
  },

  getOutstandingBalances: {
    name: { he: 'הצגת חובות פתוחים', en: 'View Outstanding Balances' },
    contextualTitle: { 
      he: 'בואו נציג את החובות הפתוחים של המטופלים', 
      en: "Let's view outstanding patient balances" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת כל החובות הפתוחים של המטופלים עם פירוט ימי איחור ופעולות המלצות'
        : 'Display all outstanding patient balances with aging details and recommended actions';
    },
    whyNeeded: {
      he: 'חיוני לניהול זרם המזומנים וגביה יעילה של החובות',
      en: 'Essential for cash flow management and efficient debt collection'
    }
  },

  checkCoverage: {
    name: { he: 'בדיקת כיסוי ביטוחי', en: 'Check Insurance Coverage' },
    contextualTitle: { 
      he: 'בואו נבדוק כיסוי ביטוחי לפרוצדורה', 
      en: "Let's check insurance coverage for a procedure" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'בדיקת כיסוי ביטוחי ספציפי לפרוצדורות וטיפולים לפני ביצועם'
        : 'Check specific insurance coverage for procedures and treatments before performing them';
    },
    whyNeeded: {
      he: 'מונע הפתעות כלכליות למטופל ומבטיח תשלום מהחברה הביטוח',
      en: 'Prevents financial surprises for patients and ensures payment from insurance company'
    }
  },

  // ========== COMMUNICATION FUNCTIONS ==========
  sendSMS: {
    name: { he: 'שליחת SMS', en: 'Send SMS' },
    contextualTitle: { 
      he: 'בואו נשלח הודעת טקסט למטופל', 
      en: "Let's send a text message to the patient" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'שליחת הודעות SMS בטוחות למטופלים לתזכורות, הודעות חירום, ועדכונים רפואיים'
        : 'Send secure SMS messages to patients for reminders, emergency alerts, and medical updates';
    },
    whyNeeded: {
      he: 'מבטיח תקשורת מהירה ויעילה עם המטופלים בדרך הנוחה להם ביותר',
      en: 'Ensures quick and efficient communication with patients in their preferred method'
    }
  },

  sendEmail: {
    name: { he: 'שליחת אימייל', en: 'Send Email' },
    contextualTitle: { 
      he: 'בואו נשלח אימייל למטופל', 
      en: "Let's send an email to the patient" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'שליחת הודעות אימייל מאובטחות למטופלים עם אפשרות לקבצים מצורפים'
        : 'Send secure email messages to patients with the option for attachments';
    },
    whyNeeded: {
      he: 'מאפשר שליחת מידע מפורט ומסמכים רפואיים בצורה מאובטחת',
      en: 'Enables sending detailed information and medical documents securely'
    }
  },

  scheduleReminder: {
    name: { he: 'תזמון תזכורת', en: 'Schedule Reminder' },
    contextualTitle: { 
      he: 'בואו נתזמן תזכורת אוטומטית למטופל', 
      en: "Let's schedule an automatic reminder for the patient" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'תזמון תזכורות אוטומטיות למטופלים לתורים, נטילת תרופות, ומעקבים רפואיים'
        : 'Schedule automatic reminders for patients for appointments, medication, and medical follow-ups';
    },
    whyNeeded: {
      he: 'משפר משמעת טיפולית ומקטין אי-הגעות לתורים',
      en: 'Improves treatment compliance and reduces appointment no-shows'
    }
  },

  sendBulkPatientSMS: {
    name: { he: 'שליחת SMS המונית', en: 'Send Bulk SMS' },
    contextualTitle: { 
      he: 'בואו נשלח הודעות טקסט לקבוצת מטופלים', 
      en: "Let's send text messages to a group of patients" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'שליחת הודעות SMS המוניות לקבוצות מטופלים עם סינון לפי גיל, מצב רפואי, או קריטריונים אחרים'
        : 'Send bulk SMS messages to patient groups with filtering by age, medical condition, or other criteria';
    },
    whyNeeded: {
      he: 'יעיל לקמפיינים של בריאות הציבור, תזכורות חיסונים, ועדכונים חשובים',
      en: 'Efficient for public health campaigns, vaccination reminders, and important updates'
    }
  },

  sendBulkPatientEmail: {
    name: { he: 'שליחת אימייל המונית', en: 'Send Bulk Email' },
    contextualTitle: { 
      he: 'בואו נשלח אימיילים לקבוצת מטופלים', 
      en: "Let's send emails to a group of patients" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'שליחת הודעות אימייל המוניות עם תוכן מתואם אישית לקבוצות ספציפיות של מטופלים'
        : 'Send bulk email messages with personalized content to specific patient groups';
    },
    whyNeeded: {
      he: 'מאפשר החלפת מידע רפואי חשוב ועדכונים למספר רב של מטופלים בו-זמנית',
      en: 'Enables sharing important medical information and updates with many patients simultaneously'
    }
  },

  // ========== CLINICAL FUNCTIONS ==========
  analyzeSymptoms: {
    name: { he: 'ניתוח תסמינים', en: 'Symptom Analysis' },
    contextualTitle: { 
      he: 'בואו ננתח את התסמינים באמצעות AI', 
      en: "Let's analyze symptoms using AI" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ניתוח אינטליגנטי של תסמינים למתן הצעות לאבחנה מבדלת ובדיקות נוספות'
        : 'Intelligent symptom analysis to provide differential diagnosis suggestions and additional tests';
    },
    whyNeeded: {
      he: 'מסייע לרופאים בתהליך האבחון ומבטיח שלא מפספסים מצבים חשובים',
      en: 'Assists doctors in the diagnostic process and ensures important conditions are not missed'
    }
  },

  recommendTreatment: {
    name: { he: 'המלצות טיפול', en: 'Treatment Recommendations' },
    contextualTitle: { 
      he: 'בואו נקבל המלצות לטיפול מבוססות ראיות', 
      en: "Let's get evidence-based treatment recommendations" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'המלצות טיפול מותאמות אישית המבוססות על הנחיות קליניות עדכניות ומחקרים'
        : 'Personalized treatment recommendations based on current clinical guidelines and research';
    },
    whyNeeded: {
      he: 'מבטיח שהמטופלים מקבלים את הטיפול המיטבי ביותר על פי הסטנדרטים העדכניים',
      en: 'Ensures patients receive the best possible treatment according to current standards'
    }
  },

  checkDrugInteractions: {
    name: { he: 'בדיקת אינטראקציות תרופתיות', en: 'Drug Interaction Check' },
    contextualTitle: { 
      he: 'בואו נבדוק אינטראקציות בין התרופות', 
      en: "Let's check for drug interactions" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'בדיקה מקיפה של אינטראקציות פוטנציאליות בין תרופות למניעת תופעות לוואי'
        : 'Comprehensive check for potential drug interactions to prevent adverse effects';
    },
    whyNeeded: {
      he: 'קריטי לבטיחות המטופל ומניעת אינטראקציות תרופתיות מסוכנות',
      en: 'Critical for patient safety and preventing dangerous drug interactions'
    }
  },

  checkDrugAllergy: {
    name: { he: 'בדיקת אלרגיות תרופתיות', en: 'Drug Allergy Check' },
    contextualTitle: { 
      he: 'בואו נבדוק אלרגיות לתרופות', 
      en: "Let's check for drug allergies" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'בדיקה אוטומטית של אלרגיות ידועות לתרופות לפני מתן טיפול תרופתי'
        : 'Automatic check for known drug allergies before prescribing medication';
    },
    whyNeeded: {
      he: 'מונע תגובות אלרגיות מסכנות חיים ומבטיח בטיחות המטופל',
      en: 'Prevents life-threatening allergic reactions and ensures patient safety'
    }
  },

  analyzeVitalSigns: {
    name: { he: 'ניתוח סימנים חיוניים', en: 'Vital Signs Analysis' },
    contextualTitle: { 
      he: 'בואו ננתח את הסימנים החיוניים', 
      en: "Let's analyze the vital signs" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ניתוח אוטומטי של סימנים חיוניים כולל חישוב ציון NEWS לזיהוי מטופלים בסיכון'
        : 'Automatic vital signs analysis including NEWS score calculation for identifying at-risk patients';
    },
    whyNeeded: {
      he: 'מאפשר זיהוי מוקדם של הידרדרות קלינית וקבלת החלטות טיפוליות מהירות',
      en: 'Enables early identification of clinical deterioration and rapid treatment decisions'
    }
  },

  interpretLabResults: {
    name: { he: 'פרשנות תוצאות מעבדה', en: 'Lab Results Interpretation' },
    contextualTitle: { 
      he: 'בואו נפרש את תוצאות המעבדה', 
      en: "Let's interpret the lab results" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'פרשנות אינטליגנטית של תוצאות מעבדה עם זיהוי ערכים קריטיים והמלצות למעקב'
        : 'Intelligent lab results interpretation with critical value identification and follow-up recommendations';
    },
    whyNeeded: {
      he: 'מסייע ברופאים בפרשנות מדויקת ומהירה של בדיקות מעבדה מורכבות',
      en: 'Assists doctors in accurate and rapid interpretation of complex laboratory tests'
    }
  },

  getDifferentialDiagnosis: {
    name: { he: 'אבחנה מבדלת', en: 'Differential Diagnosis' },
    contextualTitle: { 
      he: 'בואו נקבל אבחנה מבדלת מקיפה', 
      en: "Let's get a comprehensive differential diagnosis" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'יצירת רשימת אבחנות מבדלות מסודרת לפי הסתברות על בסיס התסמינים והממצאים'
        : 'Generate a prioritized list of differential diagnoses based on symptoms and findings';
    },
    whyNeeded: {
      he: 'מבטיח שכל האבחנות הרלוונטיות נשקלות ומונע החמצת מחלות נדירות',
      en: 'Ensures all relevant diagnoses are considered and prevents missing rare diseases'
    }
  },

  recommendTests: {
    name: { he: 'המלצות לבדיקות', en: 'Test Recommendations' },
    contextualTitle: { 
      he: 'בואו נקבל המלצות לבדיקות נוספות', 
      en: "Let's get recommendations for additional tests" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'המלצות חכמות לבדיקות נוספות בהתבסס על התסמינים והאבחנה המשוערת'
        : 'Smart recommendations for additional tests based on symptoms and suspected diagnosis';
    },
    whyNeeded: {
      he: 'מבטיח גישת אבחון מקיפה ומונע הזמנת בדיקות מיותרות',
      en: 'Ensures comprehensive diagnostic approach while preventing unnecessary tests'
    }
  },

  // ========== PATIENT MANAGEMENT ==========
  addPatient: {
    name: { he: 'הוספת מטופל חדש', en: 'Add New Patient' },
    contextualTitle: { 
      he: 'בואו נוסיף מטופל חדש למערכת', 
      en: "Let's add a new patient to the system" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'רישום מטופל חדש במערכת עם כל הפרטים הדמוגרפיים והביטוח הנדרשים'
        : 'Register a new patient in the system with all required demographic and insurance details';
    },
    whyNeeded: {
      he: 'חיוני לניהול תיקים רפואיים מקיף ומעקב אחר המטופלים במרפאה',
      en: 'Essential for comprehensive medical records management and patient tracking in the practice'
    }
  },

  updatePatient: {
    name: { he: 'עדכון פרטי מטופל', en: 'Update Patient Information' },
    contextualTitle: { 
      he: 'בואו נעדכן את פרטי המטופל', 
      en: "Let's update patient information" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'עדכון פרטים אישיים, כתובת, פרטי קשר, וביטוח של המטופל'
        : 'Update personal details, address, contact information, and insurance of the patient';
    },
    whyNeeded: {
      he: 'מבטיח שפרטי המטופל מעודכנים לתקשורת יעילה ותביעות ביטוח נכונות',
      en: 'Ensures patient details are current for effective communication and accurate insurance claims'
    }
  },

  findPatient: {
    name: { he: 'חיפוש מטופל', en: 'Find Patient' },
    contextualTitle: { 
      he: 'בואו נחפש מטופל במערכת', 
      en: "Let's find a patient in the system" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש מטופלים לפי שם, תעודת זהות, טלפון, או כל פרט זיהוי אחר'
        : 'Search for patients by name, ID number, phone, or any other identifying detail';
    },
    whyNeeded: {
      he: 'מאפשר גישה מהירה למידע של המטופל לצרכי טיפול ותזמון תורים',
      en: 'Enables quick access to patient information for treatment and appointment scheduling'
    }
  },

  // ========== APPOINTMENTS ==========
  scheduleAppointment: {
    name: { he: 'תזמון תור רפואי', en: 'Schedule Medical Appointment' },
    contextualTitle: { 
      he: 'בואו נקבע תור רפואי למטופל', 
      en: "Let's schedule a medical appointment for the patient" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'תזמון תורים רפואיים עם בחירת רופא, תאריך, שעה וסוג הביקור'
        : 'Schedule medical appointments with doctor selection, date, time and visit type';
    },
    whyNeeded: {
      he: 'מרכזי לניהול יעיל של זמן הרופאים ולמתן שירות איכותי למטופלים',
      en: 'Central to efficient doctor time management and quality service for patients'
    }
  },

  findAvailableSlots: {
    name: { he: 'מציאת זמנים פנויים', en: 'Find Available Time Slots' },
    contextualTitle: { 
      he: 'בואו נמצא זמנים פנויים לתור', 
      en: "Let's find available appointment slots" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש זמנים פנויים בלוח הזמנים של הרופא לתזמון תורים יעיל'
        : 'Search for available slots in the doctor\'s schedule for efficient appointment scheduling';
    },
    whyNeeded: {
      he: 'מאפשר תזמון מהיר ויעיל של תורים תוך מיטוב ניצול זמן הרופא',
      en: 'Enables quick and efficient appointment scheduling while optimizing doctor time utilization'
    }
  },

  cancelAppointment: {
    name: { he: 'ביטול תור רפואי', en: 'Cancel Medical Appointment' },
    contextualTitle: { 
      he: 'בואו נבטל את התור הרפואי', 
      en: "Let's cancel the medical appointment" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ביטול תורים עם תיעוד הסיבה ושחרור הזמן בלוח הזמנים'
        : 'Cancel appointments with reason documentation and time slot release in schedule';
    },
    whyNeeded: {
      he: 'מאפשר ניהול יעיל של לוח הזמנים ומקסום זמינות הרופאים',
      en: 'Enables efficient schedule management and maximizes doctor availability'
    }
  },

  // ========== SYSTEM FUNCTIONS ==========
  runBackup: {
    name: { he: 'הרצת גיבוי מערכת', en: 'Run System Backup' },
    contextualTitle: { 
      he: 'בואו נבצע גיבוי למערכת', 
      en: "Let's perform a system backup" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ביצוע גיבויים מלאים או חלקיים של נתוני המערכת לשמירה על המידע הרפואי'
        : 'Perform full or partial system data backups to protect medical information';
    },
    whyNeeded: {
      he: 'הכרחי להגנה על מידע רפואי רגיש ושחזור המערכת במקרה של תקלה',
      en: 'Essential for protecting sensitive medical data and system recovery in case of failure'
    }
  },

  getSystemHealth: {
    name: { he: 'בדיקת בריאות המערכת', en: 'System Health Check' },
    contextualTitle: { 
      he: 'בואו נבדוק את בריאות המערכת', 
      en: "Let's check system health" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'בדיקה מקיפה של מצב המערכת כולל ביצועים, זיכרון, ושירותים פעילים'
        : 'Comprehensive system status check including performance, memory, and active services';
    },
    whyNeeded: {
      he: 'מבטיח פעולה תקינה של המערכת ומאפשר זיהוי בעיות לפני שהן מתפתחות',
      en: 'Ensures proper system operation and enables issue identification before they develop'
    }
  },

  exportAuditLogs: {
    name: { he: 'ייצוא יומני ביקורת', en: 'Export Audit Logs' },
    contextualTitle: { 
      he: 'בואו נייצא את יומני הביקורת למערכת', 
      en: "Let's export system audit logs" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ייצוא יומני פעילות מפורטים לצרכי ביקורת, ציות לתקנות, וניתוח אבטחה'
        : 'Export detailed activity logs for audit purposes, regulatory compliance, and security analysis';
    },
    whyNeeded: {
      he: 'חובה לציות לתקני HIPAA ותקנות הגנת פרטיות רפואית',
      en: 'Required for HIPAA compliance and medical privacy protection regulations'
    }
  },

  // ========== EXTERNAL INTEGRATIONS ==========
  searchDrugInformation: {
    name: { he: 'חיפוש מידע על תרופות', en: 'Drug Information Search' },
    contextualTitle: { 
      he: 'בואו נחפש מידע מפורט על התרופה', 
      en: "Let's search for detailed drug information" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש מקיף במאגר FDA למידע על תרופות כולל מינונים, אינדיקציות ותופעות לוואי'
        : 'Comprehensive FDA database search for drug information including dosages, indications and side effects';
    },
    whyNeeded: {
      he: 'מספק מידע מהימן ועדכני על תרופות לקבלת החלטות טיפוליות בטוחות',
      en: 'Provides reliable and current drug information for safe treatment decisions'
    }
  },

  searchClinicalTrials: {
    name: { he: 'חיפוש ניסויים קליניים', en: 'Clinical Trials Search' },
    contextualTitle: { 
      he: 'בואו נחפש ניסויים קליניים רלוונטיים', 
      en: "Let's search for relevant clinical trials" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש ניסויים קליניים במאגר הלאומי לזיהוי הזדמנויות טיפול חדשניות למטופלים'
        : 'Search clinical trials in national database to identify innovative treatment opportunities for patients';
    },
    whyNeeded: {
      he: 'מאפשר למטופלים גישה לטיפולים חדשניים וניסיוניים',
      en: 'Enables patient access to innovative and experimental treatments'
    }
  },

  searchMedicalLiterature: {
    name: { he: 'חיפוש ספרות רפואית', en: 'Medical Literature Search' },
    contextualTitle: { 
      he: 'בואו נחפש בספרות הרפואית העדכנית', 
      en: "Let's search current medical literature" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש במאגרי PubMed ומאגרים רפואיים נוספים למחקרים ומאמרים עדכניים'
        : 'Search PubMed and other medical databases for current research and articles';
    },
    whyNeeded: {
      he: 'מבטיח שהטיפול מבוסס על הראיות המדעיות העדכניות ביותר',
      en: 'Ensures treatment is based on the most current scientific evidence'
    }
  }
};

module.exports = completeTooltipDefinitions;