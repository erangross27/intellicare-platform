// Extended IntelliCare Function Tooltip Definitions - 100+ Additional Functions
// Categories: Document Management, Billing & Insurance, Communication, Reporting & Analytics, Clinical, System/Admin, External Integrations

const extendedTooltipDefinitions = {
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

  sendAppointmentConfirmationRequest: {
    name: { he: 'בקשת אישור תור', en: 'Appointment Confirmation Request' },
    contextualTitle: { 
      he: 'בואו נבקש אישור תור מהמטופל', 
      en: "Let's request appointment confirmation from the patient" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'שליחת בקשות אישור תורים אוטומטיות למטופלים לצמצום אי-הגעות'
        : 'Send automatic appointment confirmation requests to patients to reduce no-shows';
    },
    whyNeeded: {
      he: 'משפר יעילות התזמון ומקטין פערים בלוח הזמנים',
      en: 'Improves scheduling efficiency and reduces gaps in the appointment schedule'
    }
  },

  // ========== REPORTING & ANALYTICS FUNCTIONS ==========
  generatePatientReport: {
    name: { he: 'דוח מטופל מקיף', en: 'Comprehensive Patient Report' },
    contextualTitle: { 
      he: 'בואו ניצור דוח מקיף על המטופל', 
      en: "Let's create a comprehensive patient report" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'יצירת דוחות מפורטים על המטופל כולל היסטוריה רפואית, תרופות, וסיכום קליני'
        : 'Create detailed patient reports including medical history, medications, and clinical summary';
    },
    whyNeeded: {
      he: 'חיוני להעברת מידע בין ספקי שירותי בריאות ולתיעוד רפואי מקיף',
      en: 'Essential for information transfer between healthcare providers and comprehensive medical documentation'
    }
  },

  generateClinicReport: {
    name: { he: 'דוח סטטיסטיקות מרפאה', en: 'Practice Statistics Report' },
    contextualTitle: { 
      he: 'בואו ניצור דוח סטטיסטיקות למרפאה', 
      en: "Let's create practice statistics report" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'דוחות ניהוליים מקיפים על ביצועי המרפאה, מספר מטופלים, והכנסות'
        : 'Comprehensive management reports on practice performance, patient volume, and revenue';
    },
    whyNeeded: {
      he: 'מאפשר קבלת החלטות מבוססות נתונים לשיפור תפעול המרפאה',
      en: 'Enables data-driven decision making to improve practice operations'
    }
  },

  getClinicStatistics: {
    name: { he: 'סטטיסטיקות המרפאה', en: 'Practice Statistics' },
    contextualTitle: { 
      he: 'בואו נציג את הסטטיסטיקות של המרפאה', 
      en: "Let's view practice statistics" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת מדדי ביצועים מרכזיים של המרפאה כולל מספר ביקורים יומי, שבועי וחודשי'
        : 'Display key practice performance metrics including daily, weekly, and monthly visit counts';
    },
    whyNeeded: {
      he: 'מספק תובנות חשובות על מגמות וביצועים לניהול יעיל יותר',
      en: 'Provides important insights on trends and performance for more effective management'
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

  getAPIPerformance: {
    name: { he: 'ביצועי המערכת', en: 'System Performance' },
    contextualTitle: { 
      he: 'בואו נבדוק את ביצועי המערכת', 
      en: "Let's check system performance" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'מעקב אחר ביצועי API וזמני תגובה לזיהוי בעיות ואופטימיזציה'
        : 'Monitor API performance and response times for issue identification and optimization';
    },
    whyNeeded: {
      he: 'מבטיח שהמערכת פועלת ברמת ביצועים אופטימלית לחוויית משתמש טובה',
      en: 'Ensures the system operates at optimal performance levels for good user experience'
    }
  },

  generateComplianceReport: {
    name: { he: 'דוח ציות רגולטורי', en: 'Compliance Report' },
    contextualTitle: { 
      he: 'בואו ניצור דוח ציות לתקנות רפואיות', 
      en: "Let's create a medical regulations compliance report" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'יצירת דוחות ציות מפורטים לתקנות HIPAA, FDA ותקני בטיחות רפואית'
        : 'Create detailed compliance reports for HIPAA, FDA regulations and medical safety standards';
    },
    whyNeeded: {
      he: 'הכרחי לעמידה בתקנות ומניעת קנסות או בעיות רגולטוריות',
      en: 'Essential for regulatory compliance and avoiding fines or regulatory issues'
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

  // ========== SYSTEM/ADMIN FUNCTIONS ==========
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

  optimizeDatabase: {
    name: { he: 'אופטימיזציית בסיס הנתונים', en: 'Database Optimization' },
    contextualTitle: { 
      he: 'בואו נבצע אופטימיזציה לבסיס הנתונים', 
      en: "Let's optimize the database" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ביצוע פעולות אופטימיזציה לבסיס הנתונים לשיפור ביצועים ומהירות שאילתות'
        : 'Perform database optimization operations to improve performance and query speed';
    },
    whyNeeded: {
      he: 'מבטיח ביצועים מיטביים של המערכת ומהירות גישה למידע רפואי',
      en: 'Ensures optimal system performance and fast access to medical information'
    }
  },

  clearCache: {
    name: { he: 'ניקוי זיכרון מטמון', en: 'Clear System Cache' },
    contextualTitle: { 
      he: 'בואו ננקה את זיכרון המטמון', 
      en: "Let's clear the system cache" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ניקוי זיכרון המטמון של המערכת לפתרון בעיות ביצועים ושחרור זיכרון'
        : 'Clear system cache memory to resolve performance issues and free up memory';
    },
    whyNeeded: {
      he: 'מסייע בפתרון בעיות ביצועים ומבטיח פעולה חלקה של המערכת',
      en: 'Helps resolve performance issues and ensures smooth system operation'
    }
  },

  updateUserPermissions: {
    name: { he: 'עדכון הרשאות משתמש', en: 'Update User Permissions' },
    contextualTitle: { 
      he: 'בואו נעדכן הרשאות למשתמש', 
      en: "Let's update user permissions" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ניהול הרשאות משתמשים במערכת לבקרת גישה למידע רפואי רגיש'
        : 'Manage user permissions in the system for access control to sensitive medical information';
    },
    whyNeeded: {
      he: 'הכרחי לביטחון המידע ועמידה בתקני HIPAA להגנת פרטיות המטופל',
      en: 'Essential for information security and HIPAA compliance for patient privacy protection'
    }
  },

  deactivateUser: {
    name: { he: 'השבתת משתמש', en: 'Deactivate User' },
    contextualTitle: { 
      he: 'בואו נשבית גישת משתמש למערכת', 
      en: "Let's deactivate user access to the system" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'השבתה בטוחה של חשבונות משתמש תוך שמירת היסטוריית הפעילות לביקורת'
        : 'Secure user account deactivation while preserving activity history for audit purposes';
    },
    whyNeeded: {
      he: 'מבטיח ביטחון המערכת כאשר עובדים עוזבים את המרפאה',
      en: 'Ensures system security when staff members leave the practice'
    }
  },

  // ========== EXTERNAL INTEGRATION FUNCTIONS ==========
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

  checkDrugSafety: {
    name: { he: 'בדיקת בטיחות תרופה', en: 'Drug Safety Check' },
    contextualTitle: { 
      he: 'בואו נבדוק בטיחות התרופה', 
      en: "Let's check drug safety" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'בדיקת מידע בטיחותי מעודכן על תרופות כולל התרעות FDA ואירועים לוואיים'
        : 'Check updated safety information for drugs including FDA alerts and adverse events';
    },
    whyNeeded: {
      he: 'הכרחי לבטיחות המטופל ומניעת מתן תרופות עם סיכונים ידועים',
      en: 'Essential for patient safety and preventing prescription of drugs with known risks'
    }
  },

  searchProviders: {
    name: { he: 'חיפוש ספקי שירות', en: 'Healthcare Provider Search' },
    contextualTitle: { 
      he: 'בואו נחפש ספקי שירותי בריאות', 
      en: "Let's search for healthcare providers" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש ספקי שירותי בריאות לפי התמחות, מיקום, ורשת ביטוח במאגרים הלאומיים'
        : 'Search healthcare providers by specialty, location, and insurance network in national databases';
    },
    whyNeeded: {
      he: 'מסייע בהפניות מטופלים לספקי שירותים מתאימים ומכוסים ביטוחית',
      en: 'Assists in patient referrals to appropriate and insurance-covered service providers'
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

  matchPatientToTrials: {
    name: { he: 'התאמת מטופל לניסויים', en: 'Patient-Trial Matching' },
    contextualTitle: { 
      he: 'בואו נתאים מטופל לניסויים קליניים', 
      en: "Let's match patient to clinical trials" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'התאמה אוטומטית של מטופלים לניסויים קליניים מתאימים על פי קריטריוני הכלה ואי-הכלה'
        : 'Automatic matching of patients to suitable clinical trials based on inclusion and exclusion criteria';
    },
    whyNeeded: {
      he: 'מזהה הזדמנויות טיפול חדשניות הרלוונטיות ספציפית לכל מטופל',
      en: 'Identifies innovative treatment opportunities specifically relevant to each patient'
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
  },

  getFDASafetyAlerts: {
    name: { he: 'התרעות בטיחות FDA', en: 'FDA Safety Alerts' },
    contextualTitle: { 
      he: 'בואו נבדוק התרעות בטיחות של FDA', 
      en: "Let's check FDA safety alerts" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'קבלת התרעות בטיחות עדכניות מה-FDA על תרופות ומכשירים רפואיים'
        : 'Receive current FDA safety alerts for drugs and medical devices';
    },
    whyNeeded: {
      he: 'הכרחי להישארות מעודכן בהתרעות בטיחות ומניעת פגיעה במטופלים',
      en: 'Essential for staying updated on safety alerts and preventing patient harm'
    }
  },

  // ========== ADDITIONAL SPECIALIZED FUNCTIONS ==========
  generateVaccinationSchedule: {
    name: { he: 'לוח חיסונים מותאם', en: 'Personalized Vaccination Schedule' },
    contextualTitle: { 
      he: 'בואו ניצור לוח חיסונים מותאם אישית', 
      en: "Let's create a personalized vaccination schedule" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'יצירת לוח חיסונים מותאם אישית בהתאם לגיל, מצב רפואי, ונסיעות מתוכננות'
        : 'Create personalized vaccination schedule based on age, medical conditions, and planned travel';
    },
    whyNeeded: {
      he: 'מבטיח שהמטופל מקבל חיסונים נדרשים בזמן המתאים ומונע מחלות נמנעות',
      en: 'Ensures patient receives required vaccinations at appropriate times and prevents preventable diseases'
    }
  },

  calculateMedicationDosing: {
    name: { he: 'חישוב מינון תרופות', en: 'Medication Dosage Calculation' },
    contextualTitle: { 
      he: 'בואו נחשב מינון תרופה מדויק', 
      en: "Let's calculate accurate medication dosage" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חישוב מינונים מדויקים בהתבסס על משקל, גיל, תפקוד כליות וכבד של המטופל'
        : 'Calculate accurate dosages based on patient weight, age, kidney and liver function';
    },
    whyNeeded: {
      he: 'מבטיח בטיחות תרופתית ויעילות טיפולית אופטימלית',
      en: 'Ensures medication safety and optimal therapeutic efficacy'
    }
  },

  generateSOAPNote: {
    name: { he: 'יצירת רשומת SOAP', en: 'Generate SOAP Note' },
    contextualTitle: { 
      he: 'בואו ניצור רשומת SOAP מקיפה', 
      en: "Let's create a comprehensive SOAP note" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'יצירה אוטומטית של רשומות SOAP מובנות לתיעוד קליני מקצועי'
        : 'Automatic creation of structured SOAP notes for professional clinical documentation';
    },
    whyNeeded: {
      he: 'מבטיח תיעוד רפואי סטנדרטי ומקצועי הנדרש לטיפול רפואי איכותי',
      en: 'Ensures standardized and professional medical documentation required for quality medical care'
    }
  },

  searchNIHGrants: {
    name: { he: 'חיפוש מענקי NIH', en: 'NIH Grants Search' },
    contextualTitle: { 
      he: 'בואו נחפש מענקי מחקר של NIH', 
      en: "Let's search NIH research grants" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש במאגר מענקי המחקר של NIH לזיהוי הזדמנויות מימון ושיתופי פעולה'
        : 'Search NIH research grants database to identify funding opportunities and collaborations';
    },
    whyNeeded: {
      he: 'מסייע במציאת הזדמנויות מימון למחקר רפואי וקידום הידע המדעי',
      en: 'Assists in finding funding opportunities for medical research and advancing scientific knowledge'
    }
  },

  getGeneticVariantInfo: {
    name: { he: 'מידע על וריאנטים גנטיים', en: 'Genetic Variant Information' },
    contextualTitle: { 
      he: 'בואו נקבל מידע על וריאנט גנטי', 
      en: "Let's get information about a genetic variant" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'קבלת מידע מפורט על וריאנטים גנטיים ומשמעותם הקלינית מבאגרי dbSNP'
        : 'Get detailed information about genetic variants and their clinical significance from dbSNP databases';
    },
    whyNeeded: {
      he: 'מאפשר רפואה מדויקת ומותאמת אישית על בסיס גנטי',
      en: 'Enables precision and personalized medicine based on genetics'
    }
  },

  getPharmacogenomics: {
    name: { he: 'המלצות פרמקוגנומיות', en: 'Pharmacogenomic Recommendations' },
    contextualTitle: { 
      he: 'בואו נקבל המלצות פרמקוגנומיות לתרופה', 
      en: "Let's get pharmacogenomic recommendations for the drug" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'המלצות מינון והתוויות מנגד מבוססות פרופיל גנטי למיטוב יעילות התרופה'
        : 'Dosage and contraindication recommendations based on genetic profile to optimize drug efficacy';
    },
    whyNeeded: {
      he: 'מונע תופעות לוואי ומשפר יעילות טיפולית על בסיס הגנטיקה האישית',
      en: 'Prevents side effects and improves therapeutic efficacy based on individual genetics'
    }
  },

  getCDCDiseaseData: {
    name: { he: 'נתוני מחלות CDC', en: 'CDC Disease Data' },
    contextualTitle: { 
      he: 'בואו נקבל נתוני מחלות מה-CDC', 
      en: "Let's get disease data from CDC" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'קבלת נתונים אפידמיולוגיים עדכניים מה-CDC למעקב מגמות ותכנון בריאות הציבור'
        : 'Get current epidemiological data from CDC for trend monitoring and public health planning';
    },
    whyNeeded: {
      he: 'מסייע בהבנת מגמות מחלות ותכנון אסטרטגיות מניעה ברמה המקומית',
      en: 'Helps understand disease trends and plan prevention strategies at the local level'
    }
  },

  findSubstanceAbuseTreatment: {
    name: { he: 'מרכזי טיפול בהתמכרויות', en: 'Substance Abuse Treatment Centers' },
    contextualTitle: { 
      he: 'בואו נמצא מרכזי טיפול בהתמכרויות', 
      en: "Let's find substance abuse treatment centers" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש מרכזי טיפול בהתמכרויות מאושרים לפי מיקום וסוג טיפול'
        : 'Search approved substance abuse treatment centers by location and treatment type';
    },
    whyNeeded: {
      he: 'מאפשר הפניה מהירה ויעילה של מטופלים לטיפול מתאים בהתמכרויות',
      en: 'Enables quick and efficient referral of patients to appropriate addiction treatment'
    }
  },

  getNutritionData: {
    name: { he: 'נתוני תזונה', en: 'Nutrition Data' },
    contextualTitle: { 
      he: 'בואו נקבל נתוני תזונה מפורטים', 
      en: "Let's get detailed nutrition data" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'קבלת נתוני תזונה מפורטים ממאגר USDA למזונות שונים לייעוץ תזונתי מדויק'
        : 'Get detailed nutrition data from USDA database for various foods for accurate nutritional counseling';
    },
    whyNeeded: {
      he: 'מאפשר ייעוץ תזונתי מבוסס נתונים מדויקים ומעודכנים',
      en: 'Enables nutritional counseling based on accurate and updated data'
    }
  },

  calculateNutritionNeeds: {
    name: { he: 'חישוב צרכים תזונתיים', en: 'Calculate Nutrition Needs' },
    contextualTitle: { 
      he: 'בואו נחשב צרכים תזונתיים מותאמים', 
      en: "Let's calculate personalized nutrition needs" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חישוב צרכים תזונתיים מותאמים אישית לפי גיל, מין, משקל, פעילות ומצב בריאות'
        : 'Calculate personalized nutrition needs by age, gender, weight, activity level and health status';
    },
    whyNeeded: {
      he: 'מבטיח תזונה אופטימלית מותאמת למצבו הבריאותי הייחודי של כל מטופל',
      en: 'Ensures optimal nutrition tailored to each patient\'s unique health condition'
    }
  },

  getEnvironmentalHealthData: {
    name: { he: 'נתוני בריאות סביבתית', en: 'Environmental Health Data' },
    contextualTitle: { 
      he: 'בואו נקבל נתוני בריאות סביבתית', 
      en: "Let's get environmental health data" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'קבלת נתונים על איכות אוויר, מים וחשיפות סביבתיות מה-EPA לאזור המטופל'
        : 'Get air quality, water quality and environmental exposure data from EPA for patient area';
    },
    whyNeeded: {
      he: 'מסייע בזיהוי קשרים בין בריאות המטופל לגורמים סביבתיים',
      en: 'Helps identify connections between patient health and environmental factors'
    }
  }
};

module.exports = extendedTooltipDefinitions;