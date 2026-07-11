/**
 * Tooltip Definitions for Top 20 Missing Functions
 * To be integrated into platformFunctionHelpServiceV2.js
 */

const missingTooltipDefinitions = {

  // ========== MEDICAL HISTORY FUNCTIONS ==========
  addMedicalHistory: {
    name: { he: 'הוספת היסטוריה רפואית', en: 'Add Medical History' },
    contextualTitle: { 
      he: 'בואו נוסיף היסטוריה רפואית למטופל', 
      en: "Let's add medical history to the patient" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      const patientName = context.currentPatient?.name || (isHebrew ? 'המטופל' : 'the patient');
      
      return isHebrew 
        ? `הוספת רקע רפואי חשוב עבור ${patientName} - מחלות קודמות, ניתוחים, אלרגיות ותרופות`
        : `Adding important medical background for ${patientName} - past illnesses, surgeries, allergies and medications`;
    },
    whyNeeded: {
      he: 'היסטוריה רפואית מלאה חיונית לאבחון נכון ולמניעת טעויות רפואיות מסוכנות',
      en: 'Complete medical history is essential for accurate diagnosis and preventing dangerous medical errors'
    },
    triggers: ['medical history', 'patient history', 'previous illness', 'היסטוריה רפואית', 'רקע רפואי', 'מחלות קודמות'],
    steps: {
      he: [
        '1. 🏥 מחלות קודמות ואבחנות',
        '2. 🔪 ניתוחים והליכים רפואיים',
        '3. 💊 תרופות קבועות ותגובות',
        '4. 🧬 היסטוריה משפחתית רלוונטית',
        '5. ✅ אימות ושמירת המידע'
      ],
      en: [
        '1. 🏥 Previous illnesses and diagnoses',
        '2. 🔪 Surgeries and medical procedures',
        '3. 💊 Regular medications and reactions',
        '4. 🧬 Relevant family history',
        '5. ✅ Verify and save information'
      ]
    }
  },

  getMedicalHistory: {
    name: { he: 'צפייה בהיסטוריה רפואית', en: 'View Medical History' },
    contextualTitle: { 
      he: 'בואו נסתכל על ההיסטוריה הרפואית', 
      en: "Let's review the medical history" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      const patientName = context.currentPatient?.name || (isHebrew ? 'המטופל' : 'the patient');
      
      return isHebrew 
        ? `צפייה בהיסטוריה הרפואית המלאה של ${patientName} בציר זמן אינטראקטיבי`
        : `Viewing complete medical history of ${patientName} in interactive timeline`;
    },
    whyNeeded: {
      he: 'סקירת ההיסטוריה הרפואית לפני קבלת החלטות טיפוליות חדשות',
      en: 'Reviewing medical history before making new treatment decisions'
    }
  },

  // ========== LAB RESULTS FUNCTIONS ==========
  addLabResult: {
    name: { he: 'הוספת תוצאות בדיקות', en: 'Add Lab Results' },
    contextualTitle: { 
      he: 'בואו נכניס תוצאות בדיקות חדשות', 
      en: "Let's enter new lab results" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הזנת תוצאות בדיקות מעבדה עם זיהוי אוטומטי של ערכים חריגים והתראות'
        : 'Entering lab test results with automatic detection of abnormal values and alerts';
    },
    whyNeeded: {
      he: 'תיעוד מדויק של תוצאות בדיקות למעקב ואבחון רציף',
      en: 'Accurate documentation of test results for continuous monitoring and diagnosis'
    },
    triggers: ['lab results', 'test results', 'blood work', 'תוצאות בדיקות', 'בדיקות דם', 'תוצאות מעבדה']
  },

  getLabResults: {
    name: { he: 'צפייה בתוצאות בדיקות', en: 'View Lab Results' },
    contextualTitle: { 
      he: 'בואו נבדוק את תוצאות הבדיקות', 
      en: "Let's check the lab results" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'סקירת תוצאות בדיקות קודמות עם השוואת מגמות וזיהוי שינויים'
        : 'Reviewing previous test results with trend comparison and change detection';
    },
    whyNeeded: {
      he: 'מעקב אחר התקדמות הבריאות והשפעת הטיפולים',
      en: 'Tracking health progress and treatment effectiveness'
    }
  },

  // ========== MEDICATION FUNCTIONS ==========
  addMedication: {
    name: { he: 'הוספת תרופה', en: 'Add Medication' },
    contextualTitle: { 
      he: 'בואו נוסיף תרופה חדשה', 
      en: "Let's add a new medication" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'הוספת תרופה חדשה עם בדיקת אינטראקציות אוטומטית ואישור מינון'
        : 'Adding new medication with automatic interaction checking and dosage verification';
    },
    whyNeeded: {
      he: 'תיעוד מדויק של תרופות למניעת אינטראקציות מסוכנות וכפילויות',
      en: 'Accurate medication documentation to prevent dangerous interactions and duplications'
    },
    triggers: ['add medication', 'new medication', 'prescribe', 'הוסף תרופה', 'תרופה חדשה', 'רושם תרופה']
  },

  getMedications: {
    name: { he: 'רשימת תרופות', en: 'Medication List' },
    contextualTitle: { 
      he: 'בואו נסתכל על התרופות הנוכחיות', 
      en: "Let's review current medications" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'צפייה ברשימת כל התרופות הפעילות עם מינונים, תדירות ותאריכי תפוגה'
        : 'Viewing all active medications with dosages, frequency and expiration dates';
    },
    whyNeeded: {
      he: 'סקירת התרופות הנוכחיות לפני הוספת טיפולים חדשים',
      en: 'Reviewing current medications before adding new treatments'
    }
  },

  // ========== VITAL SIGNS FUNCTIONS ==========
  addVitalSigns: {
    name: { he: 'הוספת מדדים חיוניים', en: 'Add Vital Signs' },
    contextualTitle: { 
      he: 'בואו נרשום את המדדים החיוניים', 
      en: "Let's record the vital signs" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'רישום מדדים חיוניים - לחץ דם, דופק, חום, נשימה וחמצן בדם'
        : 'Recording vital signs - blood pressure, pulse, temperature, respiration and blood oxygen';
    },
    whyNeeded: {
      he: 'מעקב רציף אחר מצבו הבסיסי של המטופל ליצירת קו בסיס רפואי',
      en: 'Continuous monitoring of patient\'s basic condition to establish medical baseline'
    },
    triggers: ['vital signs', 'blood pressure', 'pulse', 'temperature', 'מדדים חיוניים', 'לחץ דם', 'דופק', 'חום']
  },

  getVitalSigns: {
    name: { he: 'צפייה במדדים חיוניים', en: 'View Vital Signs' },
    contextualTitle: { 
      he: 'בואו נבדוק את המדדים החיוניים', 
      en: "Let's check the vital signs" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'צפייה במדדים חיוניים קודמים עם גרפים ומגמות לאורך זמן'
        : 'Viewing previous vital signs with graphs and trends over time';
    },
    whyNeeded: {
      he: 'זיהוי מגמות ושינויים במצב הבריאותי של המטופל',
      en: 'Identifying trends and changes in patient\'s health status'
    }
  },

  // ========== ALLERGY FUNCTIONS ==========
  addAllergy: {
    name: { he: 'הוספת אלרגיה', en: 'Add Allergy' },
    contextualTitle: { 
      he: 'בואו נרשום אלרגיה חדשה', 
      en: "Let's record a new allergy" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'רישום אלרגיה חדשה עם חומרת התגובה ותיאור הסימפטומים'
        : 'Recording new allergy with reaction severity and symptom description';
    },
    whyNeeded: {
      he: 'מניעת תגובות אלרגיות מסוכנות בעת רישום תרופות או טיפולים',
      en: 'Preventing dangerous allergic reactions when prescribing medications or treatments'
    },
    triggers: ['allergy', 'allergic reaction', 'drug allergy', 'אלרגיה', 'תגובה אלרגית', 'רגישות לתרופה']
  },

  getAllergies: {
    name: { he: 'רשימת אלרגיות', en: 'Allergy List' },
    contextualTitle: { 
      he: 'בואו נבדוק את כל האלרגיות', 
      en: "Let's check all allergies" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'צפייה בכל האלרגיות הידועות עם רמות חומרה והתראות פעילות'
        : 'Viewing all known allergies with severity levels and active alerts';
    },
    whyNeeded: {
      he: 'וידוא שכל צוות הרפואה מודע לאלרגיות לפני מתן טיפול',
      en: 'Ensuring all medical staff are aware of allergies before providing treatment'
    }
  },

  // ========== VACCINATION FUNCTIONS ==========
  addVaccination: {
    name: { he: 'הוספת חיסון', en: 'Add Vaccination' },
    contextualTitle: { 
      he: 'בואו נרשום חיסון חדש', 
      en: "Let's record a new vaccination" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'רישום חיסון חדש עם תאריך, מנה, יצרן ומיקום החיסון'
        : 'Recording new vaccination with date, dose, manufacturer and vaccination site';
    },
    whyNeeded: {
      he: 'מעקב אחר סטטוס החיסונים והתראה על חיסונים נדרשים',
      en: 'Tracking vaccination status and alerts for required immunizations'
    },
    triggers: ['vaccination', 'immunization', 'vaccine', 'חיסון', 'חסינות']
  },

  getVaccinations: {
    name: { he: 'היסטוריית חיסונים', en: 'Vaccination History' },
    contextualTitle: { 
      he: 'בואו נבדוק את היסטוריית החיסונים', 
      en: "Let's check vaccination history" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'סקירת כל החיסונים שניתנו עם תאריכים והתראות על חיסונים חסרים'
        : 'Reviewing all administered vaccinations with dates and alerts for missing immunizations';
    },
    whyNeeded: {
      he: 'וידוא הגנה רפואית מלאה והתאמה להנחיות משרד הבריאות',
      en: 'Ensuring complete medical protection and compliance with health ministry guidelines'
    }
  },

  // ========== PRESCRIPTION FUNCTIONS ==========
  createPrescription: {
    name: { he: 'יצירת מרשם', en: 'Create Prescription' },
    contextualTitle: { 
      he: 'בואו ניצור מרשם רפואי חדש', 
      en: "Let's create a new medical prescription" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'יצירת מרשם רפואי מלא עם בדיקת אינטראקציות ואישור אלרגיות'
        : 'Creating complete medical prescription with interaction checking and allergy verification';
    },
    whyNeeded: {
      he: 'מתן טיפול תרופתי בטוח ומדויק עם כל הפרטים הנדרשים',
      en: 'Providing safe and accurate medication treatment with all required details'
    },
    triggers: ['create prescription', 'prescribe medication', 'write prescription', 'יצירת מרשם', 'רושם תרופה', 'כתיבת מרשם']
  },

  getPrescriptions: {
    name: { he: 'רשימת מרשמים', en: 'Prescription List' },
    contextualTitle: { 
      he: 'בואו נסתכל על המרשמים', 
      en: "Let's look at the prescriptions" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'צפייה בכל המרשמים הפעילים עם סטטוס מימוש ותאריכי תפוגה'
        : 'Viewing all active prescriptions with fulfillment status and expiration dates';
    },
    whyNeeded: {
      he: 'מעקב אחר הטיפול התרופתי הנוכחי והתראה על מרשמים שצריך לחדש',
      en: 'Tracking current medication treatment and alerts for prescriptions needing renewal'
    }
  },

  // ========== DIAGNOSIS FUNCTIONS ==========
  generateDiagnosis: {
    name: { he: 'יצירת אבחנה', en: 'Generate Diagnosis' },
    contextualTitle: { 
      he: 'בואו ניצור אבחנה מקצועית', 
      en: "Let's create a professional diagnosis" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'יצירת אבחנה מקצועית עם AI מבוסס על סימפטומים, בדיקות ויסטוריה רפואית'
        : 'Creating professional diagnosis with AI based on symptoms, tests and medical history';
    },
    whyNeeded: {
      he: 'אבחון מדויק המבוסס על כלל המידע הרפואי הזמין',
      en: 'Accurate diagnosis based on all available medical information'
    },
    triggers: ['diagnosis', 'diagnose', 'medical assessment', 'אבחנה', 'אבחון', 'הערכה רפואית']
  },

  getDifferentialDiagnosis: {
    name: { he: 'אבחנה מבדלת', en: 'Differential Diagnosis' },
    contextualTitle: { 
      he: 'בואו נבחן אפשרויות אבחון', 
      en: "Let's examine diagnostic possibilities" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'רשימת אבחנות אפשריות מסודרות לפי הסתברות עם הנמקות רפואיות'
        : 'List of possible diagnoses ranked by probability with medical reasoning';
    },
    whyNeeded: {
      he: 'שיקול מקיף של כל האפשרויות האבחוניות למניעת טעויות',
      en: 'Comprehensive consideration of all diagnostic possibilities to prevent errors'
    }
  },

  // ========== TREATMENT FUNCTIONS ==========
  recommendTreatment: {
    name: { he: 'המלצות טיפול', en: 'Treatment Recommendations' },
    contextualTitle: { 
      he: 'בואו נמצא את הטיפול הטוב ביותר', 
      en: "Let's find the best treatment" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'המלצות טיפול מותאמות אישית על בסיס אבחנה, היסטוריה ומחקר עדכני'
        : 'Personalized treatment recommendations based on diagnosis, history and current research';
    },
    whyNeeded: {
      he: 'מתן הטיפול היעיל והמתאים ביותר לכל מטופל',
      en: 'Providing the most effective and appropriate treatment for each patient'
    }
  },

  checkDrugAllergy: {
    name: { he: 'בדיקת אלרגיה לתרופה', en: 'Drug Allergy Check' },
    contextualTitle: { 
      he: 'בואו נוודא שהתרופה בטוחה', 
      en: "Let's ensure the medication is safe" 
    },
    dynamicDescription: (context) => {
      const isHebrew = context.language === 'he';
      return isHebrew 
        ? 'בדיקה אוטומטית של תרופה מול כל האלרגיות הידועות של המטופל'
        : 'Automatic checking of medication against all known patient allergies';
    },
    whyNeeded: {
      he: 'מניעת תגובות אלרגיות מסכנות חיים לפני מתן תרופה',
      en: 'Preventing life-threatening allergic reactions before medication administration'
    }
  }

};

export default missingTooltipDefinitions;