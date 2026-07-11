// Additional IntelliCare Function Tooltip Definitions - Specialized Functions
// Categories: Patient Management, Appointments, Lab Results, Medications, Provider Management, etc.

const additionalTooltipDefinitions = {
  // ========== PATIENT MANAGEMENT (Additional Functions) ==========
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

  getPatientDetails: {
    name: { he: 'פרטי מטופל מלאים', en: 'Complete Patient Details' },
    contextualTitle: { 
      he: 'בואו נציג את כל פרטי המטופל', 
      en: "Let's view all patient details" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת פרופיל מטופל מקיף כולל פרטים אישיים, ביטוח, והיסטוריה רפואית'
        : 'Display comprehensive patient profile including personal details, insurance, and medical history';
    },
    whyNeeded: {
      he: 'מספק מבט כולל על המטופל לקבלת החלטות טיפוליות מושכלות',
      en: 'Provides comprehensive view of the patient for informed treatment decisions'
    }
  },

  listAllPatients: {
    name: { he: 'רשימת כל המטופלים', en: 'All Patients List' },
    contextualTitle: { 
      he: 'בואו נציג את רשימת המטופלים', 
      en: "Let's view the patient list" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת רשימה מלאה של כל המטופלים הרשומים במרפאה עם אפשרויות סינון'
        : 'Display complete list of all patients registered in the practice with filtering options';
    },
    whyNeeded: {
      he: 'מאפשר ניהול יעיל של מאגר המטופלים וסקירה כללית של המרפאה',
      en: 'Enables efficient management of patient database and practice overview'
    }
  },

  countPatients: {
    name: { he: 'ספירת מטופלים', en: 'Patient Count' },
    contextualTitle: { 
      he: 'בואו נספור כמה מטופלים יש במרפאה', 
      en: "Let's count how many patients are in the practice" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'ספירת מספר המטופלים הכולל הרשומים במרפאה לצרכי סטטיסטיקה וניהול'
        : 'Count total number of patients registered in the practice for statistics and management';
    },
    whyNeeded: {
      he: 'חיוני למדדי ביצועים של המרפאה ותכנון קיבולת',
      en: 'Essential for practice performance metrics and capacity planning'
    }
  },

  // ========== APPOINTMENTS MANAGEMENT ==========
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

  updateAppointment: {
    name: { he: 'עדכון תור רפואי', en: 'Update Medical Appointment' },
    contextualTitle: { 
      he: 'בואו נעדכן את פרטי התור', 
      en: "Let's update appointment details" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'עדכון פרטי התור כמו זמן, משך, או הערות מיוחדות'
        : 'Update appointment details such as time, duration, or special notes';
    },
    whyNeeded: {
      he: 'מאפשר גמישות בניהול התורים והתאמה לשינויים בלתי צפויים',
      en: 'Provides flexibility in appointment management and adaptation to unexpected changes'
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

  rescheduleAppointment: {
    name: { he: 'דחיית תור רפואי', en: 'Reschedule Medical Appointment' },
    contextualTitle: { 
      he: 'בואו נדחה את התור לזמן אחר', 
      en: "Let's reschedule the appointment to another time" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'דחיית תורים לזמן אחר תוך שמירה על רצף הטיפול'
        : 'Reschedule appointments to another time while maintaining treatment continuity';
    },
    whyNeeded: {
      he: 'מספק גמישות למטופלים ומונע פספוס טיפולים חשובים',
      en: 'Provides flexibility for patients and prevents missing important treatments'
    }
  },

  getAppointmentDetails: {
    name: { he: 'פרטי התור הרפואי', en: 'Appointment Details' },
    contextualTitle: { 
      he: 'בואו נציג את פרטי התור', 
      en: "Let's view appointment details" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת מידע מפורט על התור כולל רופא, זמן, סיבת הביקור והערות'
        : 'Display detailed appointment information including doctor, time, visit reason and notes';
    },
    whyNeeded: {
      he: 'מאפשר הכנה לביקור ומבטיח שכל הפרטים מדויקים',
      en: 'Enables visit preparation and ensures all details are accurate'
    }
  },

  // ========== LAB RESULTS MANAGEMENT ==========
  addLabResult: {
    name: { he: 'הוספת תוצאות מעבדה', en: 'Add Lab Results' },
    contextualTitle: { 
      he: 'בואו נוסיף תוצאות מעבדה למטופל', 
      en: "Let's add lab results for the patient" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הוספת תוצאות בדיקות מעבדה חדשות לתיק הרפואי של המטופל'
        : 'Add new laboratory test results to the patient\'s medical record';
    },
    whyNeeded: {
      he: 'חיוני למעקב אחר מצב המטופל ותכנון טיפול מבוסס נתונים אובייקטיביים',
      en: 'Essential for monitoring patient condition and planning treatment based on objective data'
    }
  },

  getLabResults: {
    name: { he: 'הצגת תוצאות מעבדה', en: 'View Lab Results' },
    contextualTitle: { 
      he: 'בואו נציג את תוצאות המעבדה', 
      en: "Let's view the lab results" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת תוצאות בדיקות מעבדה עם אפשרות לסינון לפי תאריך וסוג בדיקה'
        : 'Display laboratory test results with filtering options by date and test type';
    },
    whyNeeded: {
      he: 'מאפשר למקצועי הבריאות לעקוב אחר מגמות ושינויים במצב המטופל',
      en: 'Allows healthcare professionals to track trends and changes in patient condition'
    }
  },

  // ========== MEDICATIONS MANAGEMENT ==========
  addMedication: {
    name: { he: 'הוספת תרופה', en: 'Add Medication' },
    contextualTitle: { 
      he: 'בואו נוסיף תרופה לטיפול של המטופל', 
      en: "Let's add a medication to the patient's treatment" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הוספת תרופה חדשה לרשימת התרופות הפעילות של המטופל כולל מינון והוראות'
        : 'Add new medication to patient\'s active medication list including dosage and instructions';
    },
    whyNeeded: {
      he: 'מבטיח מעקב מדויק אחר הטיפול התרופתי ומונע אינטראקציות מסוכנות',
      en: 'Ensures accurate medication therapy monitoring and prevents dangerous interactions'
    }
  },

  getMedications: {
    name: { he: 'הצגת תרופות המטופל', en: 'View Patient Medications' },
    contextualTitle: { 
      he: 'בואו נציג את רשימת התרופות של המטופל', 
      en: "Let's view the patient's medication list" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת רשימה מלאה של כל התרופות שהמטופל נוטל כולל מינונים וסטטוס'
        : 'Display complete list of all medications the patient is taking including dosages and status';
    },
    whyNeeded: {
      he: 'קריטי לבטיחות התרופתית ומניעת כפל טיפולים או אינטראקציות',
      en: 'Critical for medication safety and preventing duplicate treatments or interactions'
    }
  },

  // ========== VITAL SIGNS MANAGEMENT ==========
  addVitalSigns: {
    name: { he: 'הוספת סימנים חיוניים', en: 'Add Vital Signs' },
    contextualTitle: { 
      he: 'בואו נרשום את הסימנים החיוניים', 
      en: "Let's record the vital signs" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'רישום סימנים חיוניים כמו לחץ דם, דופק, חום, ורוויון חמצן'
        : 'Record vital signs such as blood pressure, pulse, temperature, and oxygen saturation';
    },
    whyNeeded: {
      he: 'הכרחי לניטור מצב המטופל וזיהוי מוקדם של בעיות בריאותיות',
      en: 'Essential for monitoring patient condition and early identification of health issues'
    }
  },

  getVitalSigns: {
    name: { he: 'הצגת סימנים חיוניים', en: 'View Vital Signs' },
    contextualTitle: { 
      he: 'בואו נציג את הסימנים החיוניים', 
      en: "Let's view the vital signs" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת היסטוריה של סימנים חיוניים עם גרפים ומגמות לאורך זמן'
        : 'Display vital signs history with graphs and trends over time';
    },
    whyNeeded: {
      he: 'מאפשר למקצועי הבריאות לזהות דפוסים ושינויים במצב המטופל',
      en: 'Enables healthcare professionals to identify patterns and changes in patient condition'
    }
  },

  // ========== ALLERGIES MANAGEMENT ==========
  addAllergy: {
    name: { he: 'הוספת אלרגיה', en: 'Add Allergy' },
    contextualTitle: { 
      he: 'בואו נרשום אלרגיה של המטופל', 
      en: "Let's record patient allergy" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'רישום אלרגיה חדשה כולל רמת חומרה ותיאור התגובה האלרגית'
        : 'Record new allergy including severity level and allergic reaction description';
    },
    whyNeeded: {
      he: 'קריטי לבטיחות המטופל ומניעת חשיפה לאלרגנים מסכנים',
      en: 'Critical for patient safety and preventing exposure to dangerous allergens'
    }
  },

  getAllergies: {
    name: { he: 'הצגת אלרגיות המטופל', en: 'View Patient Allergies' },
    contextualTitle: { 
      he: 'בואו נציג את רשימת האלרגיות', 
      en: "Let's view the allergy list" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת כל האלרגיות הידועות של המטופל עם רמות חומרה וסימפטומים'
        : 'Display all known patient allergies with severity levels and symptoms';
    },
    whyNeeded: {
      he: 'מבטיח שכל הצוות הרפואי מודע לאלרגיות לפני מתן כל טיפול',
      en: 'Ensures all medical staff are aware of allergies before providing any treatment'
    }
  },

  // ========== VACCINATIONS MANAGEMENT ==========
  addVaccination: {
    name: { he: 'הוספת חיסון', en: 'Add Vaccination' },
    contextualTitle: { 
      he: 'בואו נרשום חיסון שהמטופל קיבל', 
      en: "Let's record a vaccination the patient received" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'רישום חיסון חדש כולל תאריך מתן, יצרן, ומספר אצווה'
        : 'Record new vaccination including administration date, manufacturer, and lot number';
    },
    whyNeeded: {
      he: 'חיוני למעקב אחר מצב החיסונים ותכנון חיסונים עתידיים',
      en: 'Essential for tracking vaccination status and planning future immunizations'
    }
  },

  getVaccinations: {
    name: { he: 'הצגת חיסוני המטופל', en: 'View Patient Vaccinations' },
    contextualTitle: { 
      he: 'בואו נציג את רשימת החיסונים', 
      en: "Let's view the vaccination list" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת כל החיסונים שהמטופל קיבל עם תאריכים וחיסונים חסרים'
        : 'Display all vaccinations the patient received with dates and missing immunizations';
    },
    whyNeeded: {
      he: 'מאפשר זיהוי חיסונים חסרים ותכנון לוח חיסונים מעודכן',
      en: 'Enables identification of missing vaccines and planning updated immunization schedule'
    }
  },

  // ========== PROVIDER MANAGEMENT ==========
  getProviders: {
    name: { he: 'הצגת רשימת רופאים', en: 'View Providers List' },
    contextualTitle: { 
      he: 'בואו נציג את רשימת הרופאים', 
      en: "Let's view the providers list" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת כל הרופאים והמטפלים הפעילים במרפאה עם פרטי התקשרות'
        : 'Display all active doctors and healthcare providers in the practice with contact details';
    },
    whyNeeded: {
      he: 'מאפשר תזמון תורים יעיל וקשר מהיר עם צוות המרפאה',
      en: 'Enables efficient appointment scheduling and quick contact with practice staff'
    }
  },

  setupUserAsProvider: {
    name: { he: 'הגדרת משתמש כספק שירות', en: 'Setup User as Provider' },
    contextualTitle: { 
      he: 'בואו נגדיר משתמש חדש כספק שירותי בריאות', 
      en: "Let's setup a new user as healthcare provider" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הגדרת משתמש חדש במערכת כרופא או מטפל עם הרשאות מתאימות'
        : 'Setup new user in system as doctor or healthcare provider with appropriate permissions';
    },
    whyNeeded: {
      he: 'הכרחי להרחבת הצוות הרפואי ומתן גישה מתאימה לכל ספק שירות',
      en: 'Essential for expanding medical staff and providing appropriate access to each service provider'
    }
  },

  getDoctorAvailability: {
    name: { he: 'זמינות הרופא', en: 'Provider Availability' },
    contextualTitle: { 
      he: 'בואו נבדוק את זמינות הרופא', 
      en: "Let's check provider availability" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'בדיקת זמינות הרופא לתזמון תורים ותכנון לוח הזמנים השבועי'
        : 'Check provider availability for appointment scheduling and weekly schedule planning';
    },
    whyNeeded: {
      he: 'מבטיח תזמון תורים יעיל ומקסום ניצול זמן הרופאים',
      en: 'Ensures efficient appointment scheduling and maximizes provider time utilization'
    }
  },

  setDoctorAvailability: {
    name: { he: 'הגדרת זמינות רופא', en: 'Set Provider Availability' },
    contextualTitle: { 
      he: 'בואו נגדיר את זמינות הרופא', 
      en: "Let's set provider availability" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הגדרת שעות העבודה והזמינות של הרופא לתזמון תורים אוטומטי'
        : 'Set provider working hours and availability for automatic appointment scheduling';
    },
    whyNeeded: {
      he: 'מאפשר תזמון אוטומטי של תורים בהתאם לזמינות הרופא',
      en: 'Enables automatic appointment scheduling according to provider availability'
    }
  },

  // ========== USER MANAGEMENT ==========
  createUser: {
    name: { he: 'יצירת משתמש חדש', en: 'Create New User' },
    contextualTitle: { 
      he: 'בואו ניצור משתמש חדש במערכת', 
      en: "Let's create a new user in the system" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'יצירת חשבון משתמש חדש עם הגדרת תפקיד והרשאות מתאימות'
        : 'Create new user account with role assignment and appropriate permissions';
    },
    whyNeeded: {
      he: 'הכרחי לניהול צוות המרפאה ובקרת גישה למידע רפואי',
      en: 'Essential for practice staff management and medical information access control'
    }
  },

  searchUsers: {
    name: { he: 'חיפוש משתמשים', en: 'Search Users' },
    contextualTitle: { 
      he: 'בואו נחפש משתמשים במערכת', 
      en: "Let's search for users in the system" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'חיפוש משתמשים במערכת לפי שם, תפקיד, או מחלקה'
        : 'Search for users in the system by name, role, or department';
    },
    whyNeeded: {
      he: 'מאפשר ניהול יעיל של חשבונות המשתמשים ומתן הרשאות',
      en: 'Enables efficient user account management and permissions assignment'
    }
  },

  updateUserRole: {
    name: { he: 'עדכון תפקיד משתמש', en: 'Update User Role' },
    contextualTitle: { 
      he: 'בואו נעדכן את תפקיד המשתמש', 
      en: "Let's update the user role" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'עדכון תפקיד משתמש במערכת עם התאמת הרשאות בהתאם'
        : 'Update user role in system with corresponding permissions adjustment';
    },
    whyNeeded: {
      he: 'מבטיח שהרשאות המשתמש מתאימות לתפקידו הנוכחי במרפאה',
      en: 'Ensures user permissions match their current role in the practice'
    }
  },

  // ========== IMAGING MANAGEMENT ==========
  addImagingResult: {
    name: { he: 'הוספת תוצאת הדמיה', en: 'Add Imaging Result' },
    contextualTitle: { 
      he: 'בואו נוסיף תוצאת הדמיה רפואית', 
      en: "Let's add medical imaging result" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הוספת תוצאות הדמיה רפואית כמו רנטגן, CT, MRI עם פירוש רדיולוגי'
        : 'Add medical imaging results such as X-ray, CT, MRI with radiological interpretation';
    },
    whyNeeded: {
      he: 'חיוני לאבחון רפואי מקיף ותכנון טיפול מבוסס הדמיה',
      en: 'Essential for comprehensive medical diagnosis and imaging-based treatment planning'
    }
  },

  getImagingResults: {
    name: { he: 'הצגת תוצאות הדמיה', en: 'View Imaging Results' },
    contextualTitle: { 
      he: 'בואו נציג את תוצאות ההדמיה', 
      en: "Let's view imaging results" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הצגת כל תוצאות ההדמיה הרפואית של המטופל עם אפשרות השוואה'
        : 'Display all patient medical imaging results with comparison options';
    },
    whyNeeded: {
      he: 'מאפשר מעקב אחר התקדמות מחלה והשוואת תוצאות לאורך זמן',
      en: 'Enables tracking of disease progression and comparison of results over time'
    }
  },

  orderImaging: {
    name: { he: 'הזמנת בדיקת הדמיה', en: 'Order Imaging Study' },
    contextualTitle: { 
      he: 'בואו נזמין בדיקת הדמיה למטופל', 
      en: "Let's order an imaging study for the patient" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הזמנת בדיקות הדמיה רפואית עם ציון אינדיקציה ודרגת דחיפות'
        : 'Order medical imaging studies with indication and urgency level specification';
    },
    whyNeeded: {
      he: 'מאפשר תזמון יעיל של בדיקות הדמיה הנדרשות לאבחון',
      en: 'Enables efficient scheduling of imaging studies required for diagnosis'
    }
  }
};

module.exports = additionalTooltipDefinitions;