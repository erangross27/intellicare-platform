/**
 * Platform Function Help Service V2
 * Dynamic help system for ALL 470+ platform functions
 * Provides contextual, intelligent tooltips based on chat state and user context
 */

// Import static translations
import enTranslations from '../translations/en.json';
import heTranslations from '../translations/he.json';

// Helper function to get translation or fallback
const getTranslation = (key, language, fallback) => {
  const translations = language === 'he' ? heTranslations : enTranslations;
  return translations.translations?.[key] || fallback;
};

class PlatformFunctionHelpServiceV2 {
  constructor() {
    this.currentContext = null;
    this.userProfile = null;
    this.chatState = null;
    this.activeTooltips = new Map();
    this.functionUsageHistory = new Map();
    this.contextHistory = [];
    
    // Initialize function categories database
    this.initializeFunctionDatabase();
  }

  /**
   * Initialize comprehensive function database covering all 470+ functions
   */
  initializeFunctionDatabase() {
    this.functionDatabase = {
      // ========== PATIENT MANAGEMENT (50+ functions) ==========
      patientManagement: {
        category: { he: 'ניהול מטופלים', en: 'Patient Management' },
        icon: '👥',
        description: { 
          he: 'מערכת מקיפה לניהול מטופלים - הוספה, עדכון, חיפוש ומעקב',
          en: 'Comprehensive patient management - add, update, search and tracking'
        },
        functions: {
          importPatients: {
            name: { he: 'ייבוא מטופלים', en: 'Import Patients' },
            contextualTitle: { 
              he: 'ייבוא מטופלים למערכת', 
              en: "Importing patients to system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ייבוא מטופלים ממקורות שונים. המערכת תעבד את הנתונים ותוסיף את המטופלים למערכת.'
                : 'Import patients from various sources. The system will process the data and add patients to the system.';
            },
            whyNeeded: {
              he: 'מאפשר העברת נתוני מטופלים ממערכות אחרות בצורה יעילה.',
              en: 'Enables efficient transfer of patient data from other systems.'
            }
          },
          importPatientsFromCSV: {
            name: { he: 'ייבוא מטופלים מקובץ CSV', en: 'Import Patients from CSV' },
            contextualTitle: { 
              he: 'ייבוא רשימת מטופלים מקובץ', 
              en: "Importing patient list from file" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ייבוא מטופלים מרובים מקובץ CSV או Excel. המערכת תעבד את הקובץ ותוסיף את כל המטופלים למערכת באופן אוטומטי.'
                : 'Import multiple patients from a CSV or Excel file. The system will process the file and automatically add all patients to the system.';
            },
            whyNeeded: {
              he: 'מאפשר הוספה מהירה של מטופלים רבים בבת אחת, חוסך זמן בהעברת נתונים ממערכות אחרות.',
              en: 'Enables quick addition of multiple patients at once, saves time when transferring data from other systems.'
            }
          },
          addPatient: {
            name: { 
              he: 'הוספת מטופל חדש', 
              en: 'Add New Patient'
            },
            contextualTitle: { 
              he: 'הוספת מטופל חדש למערכת', 
              en: "Adding new patient to the system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              const hasPatients = context.patientCount > 0;
              
              // Check if we just searched and found no patient
              if (context.previousAction === 'searchPatients' || context.afterSearch) {
                return isHebrew 
                  ? `✅ שלב 2: המטופל לא נמצא במערכת - מוסיף מטופל חדש`
                  : `✅ Step 2: Patient not found in system - adding new patient`;
              }
              
              return isHebrew 
                ? hasPatients 
                  ? `הוספת מטופל נוסף למערכת (כבר יש לך ${context.patientCount} מטופלים)`
                  : 'הוספת המטופל הראשון שלך למערכת - התחלה נהדרת!'
                : hasPatients
                  ? `Adding another patient to your system (you have ${context.patientCount} patients)`
                  : 'Adding your first patient to the system - great start!';
            },
            whyNeeded: {
              he: 'רישום מטופל חדש במערכת עם כל הפרטים הרפואיים הבסיסיים לאחר וידוא שאינו קיים',
              en: 'Registering a new patient with all basic medical information after verifying they don\'t already exist'
            },
            triggers: ['add patient', 'new patient', 'register patient', 'הוסף מטופל', 'מטופל חדש', 'רישום מטופל'],
            steps: {
              he: [
                '1. 📝 הזנת פרטים אישיים (שם, ת.ז., תאריך לידה)',
                '2. 📞 פרטי התקשרות (טלפון, אימייל, כתובת)',
                '3. 🏥 פרטים רפואיים (קופת חולים, אלרגיות, תרופות)',
                '4. ✅ אימות הפרטים ושמירה במערכת'
              ],
              en: [
                '1. 📝 Enter personal details (name, ID, birth date)',
                '2. 📞 Contact information (phone, email, address)',
                '3. 🏥 Medical details (insurance, allergies, medications)',
                '4. ✅ Verify details and save to system'
              ]
            },
            quickActions: {
              he: [
                { text: '⚡ התחל הוספת מטופל', action: 'add new patient' },
                { text: '📋 צור מטופל עם תבנית', action: 'create patient from template' },
                { text: '📄 ייבא ממסמך', action: 'import patient from document' }
              ],
              en: [
                { text: '⚡ Start adding patient', action: 'add new patient' },
                { text: '📋 Create with template', action: 'create patient from template' },
                { text: '📄 Import from document', action: 'import patient from document' }
              ]
            },
            contextualTips: (context) => {
              const isHebrew = context.language === 'he';
              const tips = [];
              
              if (context.isFirstPatient) {
                tips.push(isHebrew 
                  ? '💡 זה המטופל הראשון שלך - המערכת תדריך אותך בכל שלב'
                  : '💡 This is your first patient - the system will guide you through each step');
              }
              
              if (context.hasIncompletePatients) {
                tips.push(isHebrew
                  ? '⚠️ יש לך מטופלים עם פרטים חסרים - כדאי להשלים אותם'
                  : '⚠️ You have patients with missing details - consider completing them');
              }
              
              return tips;
            }
          },
          
          searchPatients: {
            name: { he: 'בדיקת קיום מטופל', en: 'Checking Patient Existence' },
            contextualTitle: { 
              he: 'בודק אם המטופל כבר קיים במערכת', 
              en: "Checking if patient already exists" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              // Check if this is before an add operation based on context
              if (context.nextAction === 'add' || context.userIntent?.includes('add') || context.userIntent?.includes('new')) {
                return isHebrew 
                  ? `🔍 שלב 1: בדיקה במאגר של ${context.patientCount || 0} מטופלים למניעת כפילויות לפני הוספת מטופל חדש`
                  : `🔍 Step 1: Checking ${context.patientCount || 0} patients to prevent duplicates before adding new patient`;
              }
              return isHebrew 
                ? `חיפוש במאגר של ${context.patientCount || 0} מטופלים לפי שם, ת.ז., טלפון או אימייל`
                : `Searching database of ${context.patientCount || 0} patients by name, ID, phone or email`;
            },
            whyNeeded: {
              he: 'המערכת תמיד בודקת תחילה אם המטופל קיים כדי למנוע רישומים כפולים. זה שלב חובה לפני כל הוספה או עדכון',
              en: 'The system always checks first if the patient exists to prevent duplicate records. This is a required step before any addition or update'
            },
            triggers: ['search patient', 'find patient', 'locate patient', 'חפש מטופל', 'מצא מטופל', 'איתור מטופל'],
            intelligentSearch: {
              he: [
                '🔍 חיפוש לפי שם (גם חלקי)',
                '🆔 תעודת זהות או מספר מטופל',
                '📱 מספר טלפון',
                '🏥 מספר ביטוח או קופת חולים',
                '📅 טווח תאריכים',
                '🔬 אבחנות קודמות',
                '💊 תרופות שנרשמו'
              ],
              en: [
                '🔍 Search by name (partial works)',
                '🆔 ID number or patient number',
                '📱 Phone number',
                '🏥 Insurance number or provider',
                '📅 Date ranges',
                '🔬 Previous diagnoses',
                '💊 Prescribed medications'
              ]
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
            name: { he: 'איסוף פרטי מטופל', en: 'Getting Patient Details' },
            contextualTitle: { 
              he: 'אוסף פרטי מטופל לתור', 
              en: "Getting patient details for appointment" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              // Check if this is for appointment scheduling
              if (context.userIntent?.includes('appointment') || context.userIntent?.includes('schedule') || 
                  context.userIntent?.includes('תור') || context.userIntent?.includes('פגישה')) {
                return isHebrew 
                  ? '📋 אוסף פרטי מטופל לקביעת תור - שם, טלפון, וסיבת הביקור'
                  : '📋 Gathering patient details for appointment - name, phone, and reason for visit';
              }
              return isHebrew 
                ? 'מאחזר פרטים מלאים של המטופל מהמערכת'
                : 'Retrieving complete patient details from the system';
            },
            whyNeeded: {
              he: 'נדרש לאסוף פרטי מטופל לפני קביעת תור או ביצוע פעולות רפואיות',
              en: 'Need to gather patient details before scheduling appointments or performing medical actions'
            }
          },
          
          patientHistory: {
            name: { he: 'היסטוריה רפואית', en: 'Medical History' },
            contextualTitle: { 
              he: 'בואו נסתכל על ההיסטוריה הרפואית', 
              en: "Let's look at the medical history" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              const patientName = context.currentPatient?.name || 'המטופל';
              return isHebrew 
                ? `היסטוריה רפואית מלאה של ${patientName} עם ציר זמן אינטראקטיבי`
                : `Complete medical history of ${patientName} with interactive timeline`;
            },
            whyNeeded: {
              he: 'הכרת ההיסטוריה הרפואית חיונית לאבחון נכון והחלטות טיפול מושכלות',
              en: 'Medical history knowledge is crucial for accurate diagnosis and informed treatment decisions'
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

          addAllergy: {
            name: { he: 'הוספת אלרגיה', en: 'Add Allergy' },
            contextualTitle: { 
              he: 'בואו נוסיף אלרגיה למטופל', 
              en: "Let's add an allergy to the patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיעוד אלרגיה חדשה למטופל כולל רמת חומרה וסוג התגובה'
                : 'Document new allergy for patient including severity level and reaction type';
            },
            whyNeeded: {
              he: 'חיוני לבטיחות המטופל ומניעת תרופות או טיפולים מסוכנים',
              en: 'Critical for patient safety and preventing dangerous medications or treatments'
            }
          },

          addMedicalHistory: {
            name: { he: 'הוספת היסטוריה רפואית', en: 'Add Medical History' },
            contextualTitle: { 
              he: 'בואו נוסיף היסטוריה רפואית למטופל', 
              en: "Let's add medical history to the patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיעוד מידע רפואי קודם של המטופל - מחלות, ניתוחים, טיפולים'
                : 'Document previous medical information - diseases, surgeries, treatments';
            },
            whyNeeded: {
              he: 'הכרחי להבנת המצב הרפואי הכללי ולקבלת החלטות טיפול נכונות',
              en: 'Essential for understanding overall medical condition and making correct treatment decisions'
            }
          },

          addMedication: {
            name: { he: 'הוספת תרופה', en: 'Add Medication' },
            contextualTitle: { 
              he: 'בואו נוסיף תרופה לטיפול המטופל', 
              en: "Let's add medication to patient's treatment" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הוספת תרופה חדשה לטיפול הנוכחי של המטופל עם מינון והוראות נטילה'
                : 'Add new medication to patient current treatment with dosage and intake instructions';
            },
            whyNeeded: {
              he: 'לנהל את הטיפול התרופתי ולמנוע אינטראקציות מסוכנות',
              en: 'To manage pharmaceutical treatment and prevent dangerous interactions'
            }
          },

          addVaccination: {
            name: { he: 'הוספת חיסון', en: 'Add Vaccination' },
            contextualTitle: { 
              he: 'בואו נתעד חיסון למטופל', 
              en: "Let's document vaccination for patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיעוד חיסון שהתקבל כולל תאריך, סוג חיסון ומס אצווה'
                : 'Document received vaccination including date, vaccine type and batch number';
            },
            whyNeeded: {
              he: 'לשמור על כרטיס חיסונים מדויק ולמלא דרישות משרד הבריאות',
              en: 'To maintain accurate vaccination record and meet health ministry requirements'
            }
          },

          addVitalSigns: {
            name: { he: 'הוספת סימנים חיוניים', en: 'Add Vital Signs' },
            contextualTitle: { 
              he: 'בואו נתעד סימנים חיוניים למטופל', 
              en: "Let's document vital signs for patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיעוד מדדים חיוניים - לחץ דם, דופק, חום, נשימה, רוויה'
                : 'Document vital measurements - blood pressure, pulse, temperature, breathing, saturation';
            },
            whyNeeded: {
              he: 'למעקב אחר מצבו הבסיסי של המטופל ולזיהוי מגמות',
              en: 'To monitor patient baseline condition and identify trends'
            }
          },

          getAllergies: {
            name: { he: 'קבלת רשימת אלרגיות', en: 'Get Allergies List' },
            contextualTitle: { 
              he: 'בואו נראה את האלרגיות של המטופל', 
              en: "Let's see patient's allergies" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת רשימה מלאה של כל האלרגיות הידועות של המטופל'
                : 'Display complete list of all known patient allergies';
            },
            whyNeeded: {
              he: 'למנוע מתן תרופות או טיפולים שעלולים לגרום לתגובה אלרגית',
              en: 'To prevent giving medications or treatments that could cause allergic reaction'
            }
          },

          getMedications: {
            name: { he: 'קבלת רשימת תרופות', en: 'Get Medications List' },
            contextualTitle: { 
              he: 'בואו נראה את התרופות של המטופל', 
              en: "Let's see patient's medications" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת כל התרופות הנוכחיות והקודמות של המטופל עם מינונים'
                : 'Display all current and previous patient medications with dosages';
            },
            whyNeeded: {
              he: 'לבדוק אינטראקציות תרופתיות ולנהל טיפול תרופתי בטוח',
              en: 'To check drug interactions and manage safe pharmaceutical treatment'
            }
          },

          getVaccinations: {
            name: { he: 'קבלת רשימת חיסונים', en: 'Get Vaccinations List' },
            contextualTitle: { 
              he: 'בואו נראה את החיסונים של המטופל', 
              en: "Let's see patient's vaccinations" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת היסטוריית חיסונים מלאה של המטופל עם תאריכים'
                : 'Display complete vaccination history of patient with dates';
            },
            whyNeeded: {
              he: 'לוודא שהמטופל מחוסן כנדרש ולזהות חיסונים חסרים',
              en: 'To ensure patient is properly vaccinated and identify missing immunizations'
            }
          },

          getVitalSigns: {
            name: { he: 'קבלת סימנים חיוניים', en: 'Get Vital Signs' },
            contextualTitle: { 
              he: 'בואו נראה את הסימנים החיוניים של המטופל', 
              en: "Let's see patient's vital signs" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת המדדים החיוניים האחרונים והיסטוריים של המטופל'
                : 'Display latest and historical vital measurements of patient';
            },
            whyNeeded: {
              he: 'למעקב אחר מצב המטופל ולזיהוי שינויים בזמן',
              en: 'To monitor patient condition and identify changes over time'
            }
          },

          getMedicalHistory: {
            name: { he: 'קבלת היסטוריה רפואית', en: 'Get Medical History' },
            contextualTitle: { 
              he: 'בואו נראה את ההיסטוריה הרפואית של המטופל', 
              en: "Let's see patient's medical history" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת ההיסטוריה הרפואית המלאה של המטופל - מחלות, ניתוחים, טיפולים קודמים'
                : 'Display complete medical history - diseases, surgeries, previous treatments';
            },
            whyNeeded: {
              he: 'להבין את המצב הרפואי הכולל ולקבל החלטות טיפול מושכלות',
              en: 'To understand overall medical condition and make informed treatment decisions'
            }
          },

          addLabResult: {
            name: { he: 'הוספת תוצאות מעבדה', en: 'Add Lab Results' },
            contextualTitle: { 
              he: 'בואו נוסיף תוצאות בדיקת מעבדה', 
              en: "Let's add laboratory test results" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיעוד תוצאות בדיקות מעבדה חדשות למטופל עם ערכי נורמה והערות'
                : 'Document new laboratory test results for patient with normal ranges and comments';
            },
            whyNeeded: {
              he: 'למעקב אחר מצבו הרפואי של המטופל ולקבלת החלטות טיפול מבוססות נתונים',
              en: 'To monitor patient medical condition and make data-driven treatment decisions'
            }
          },

          getLabResults: {
            name: { he: 'קבלת תוצאות מעבדה', en: 'Get Lab Results' },
            contextualTitle: { 
              he: 'בואו נראה את תוצאות המעבדה של המטופל', 
              en: "Let's see patient's lab results" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת כל תוצאות בדיקות המעבדה של המטופל עם מגמות לאורך זמן'
                : 'Display all patient laboratory test results with trends over time';
            },
            whyNeeded: {
              he: 'לנתח מגמות בבדיקות ולהעריך יעילות הטיפול',
              en: 'To analyze test trends and assess treatment effectiveness'
            }
          },

          addImagingResult: {
            name: { he: 'הוספת תוצאות הדמיה', en: 'Add Imaging Results' },
            contextualTitle: { 
              he: 'בואו נוסיף תוצאות בדיקת הדמיה', 
              en: "Let's add imaging test results" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיעוד תוצאות בדיקות הדמיה - רנטגן, CT, MRI, אולטרסאונד'
                : 'Document imaging test results - X-ray, CT, MRI, ultrasound';
            },
            whyNeeded: {
              he: 'לשמור תוצאות הדמיה חשובות לאבחון ומעקב אחר התקדמות',
              en: 'To store important imaging results for diagnosis and progress monitoring'
            }
          },

          getImagingResults: {
            name: { he: 'קבלת תוצאות הדמיה', en: 'Get Imaging Results' },
            contextualTitle: { 
              he: 'בואו נראה את תוצאות ההדמיה של המטופל', 
              en: "Let's see patient's imaging results" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת כל תוצאות בדיקות ההדמיה של המטופל עם תמונות וממצאים'
                : 'Display all patient imaging test results with images and findings';
            },
            whyNeeded: {
              he: 'להשוות תוצאות לאורך זמן ולהעריך התקדמות או שינויים',
              en: 'To compare results over time and assess progression or changes'
            }
          },

          orderLabTest: {
            name: { he: 'הזמנת בדיקת מעבדה', en: 'Order Lab Test' },
            contextualTitle: { 
              he: 'בואו נזמין בדיקת מעבדה למטופל', 
              en: "Let's order lab test for patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הזמנת בדיקות מעבדה חדשות למטופל עם הוראות מיוחדות'
                : 'Order new laboratory tests for patient with special instructions';
            },
            whyNeeded: {
              he: 'לאבחון, מעקב אחר טיפול או בדיקות מניעה',
              en: 'For diagnosis, treatment monitoring or preventive screening'
            }
          },

          orderImaging: {
            name: { he: 'הזמנת בדיקת הדמיה', en: 'Order Imaging' },
            contextualTitle: { 
              he: 'בואו נזמין בדיקת הדמיה למטופל', 
              en: "Let's order imaging test for patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הזמנת בדיקות הדמיה - רנטגן, CT, MRI או אולטרסאונד'
                : 'Order imaging tests - X-ray, CT, MRI or ultrasound';
            },
            whyNeeded: {
              he: 'לאבחון מדויק של מצבים רפואיים או מעקב אחר טיפול',
              en: 'For accurate diagnosis of medical conditions or treatment follow-up'
            }
          },

          interpretLabResults: {
            name: { he: 'פרשנות תוצאות מעבדה', en: 'Interpret Lab Results' },
            contextualTitle: { 
              he: 'בואו נפרש את תוצאות המעבדה', 
              en: "Let's interpret the lab results" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ניתוח מקצועי של תוצאות בדיקות המעבדה עם הסברים קליניים'
                : 'Professional analysis of laboratory test results with clinical explanations';
            },
            whyNeeded: {
              he: 'להבין את המשמעות הקלינית של תוצאות הבדיקות',
              en: 'To understand the clinical significance of test results'
            }
          },

          parseLabResults: {
            name: { he: 'עיבוד תוצאות מעבדה', en: 'Parse Lab Results' },
            contextualTitle: { 
              he: 'בואו נעבד את תוצאות המעבדה', 
              en: "Let's parse the lab results" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עיבוד אוטומטי של תוצאות בדיקות מעבדה מפורמטים שונים'
                : 'Automatic processing of lab test results from various formats';
            },
            whyNeeded: {
              he: 'לייבא תוצאות ממעבדות חיצוניות בצורה מדויקת ויעילה',
              en: 'To import results from external labs accurately and efficiently'
            }
          },

          flagCriticalValues: {
            name: { he: 'סימון ערכים קריטיים', en: 'Flag Critical Values' },
            contextualTitle: { 
              he: 'בואו נסמן ערכים קריטיים בבדיקות', 
              en: "Let's flag critical values in tests" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'זיהוי אוטומטי של ערכים קריטיים בתוצאות בדיקות הדורשים התייחסות מיידית'
                : 'Automatic identification of critical values in test results requiring immediate attention';
            },
            whyNeeded: {
              he: 'למנוע החמצת ערכים מסוכנים שדורשים טיפול דחוף',
              en: 'To prevent missing dangerous values requiring urgent treatment'
            }
          },

          prescribeMedication: {
            name: { he: 'רישום תרופה', en: 'Prescribe Medication' },
            contextualTitle: { 
              he: 'בואו נרשום תרופה למטופל', 
              en: "Let's prescribe medication for patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'רישום מרשם תרופה חדש כולל מינון, תדירות ומשך טיפול'
                : 'Write new medication prescription including dosage, frequency and treatment duration';
            },
            whyNeeded: {
              he: 'לטפל במחלות ותסמינים בהתאם לפרוטוקולים רפואיים',
              en: 'To treat diseases and symptoms according to medical protocols'
            }
          },

          getPrescriptions: {
            name: { he: 'קבלת מרשמים', en: 'Get Prescriptions' },
            contextualTitle: { 
              he: 'בואו נראה את המרשמים של המטופל', 
              en: "Let's see patient's prescriptions" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת כל המרשמים הפעילים וההיסטוריים של המטופל'
                : 'Display all active and historical patient prescriptions';
            },
            whyNeeded: {
              he: 'לעקוב אחר טיפול תרופתי ולמנוע אינטראקציות מסוכנות',
              en: 'To monitor pharmaceutical treatment and prevent dangerous interactions'
            }
          },

          generatePrescription: {
            name: { he: 'יצירת מרשם', en: 'Generate Prescription' },
            contextualTitle: { 
              he: 'בואו ניצור מרשם למטופל', 
              en: "Let's generate prescription for patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'יצירת מרשם פורמלי למטופל עם כל הפרטים הנדרשים לפי חוק'
                : 'Create formal prescription for patient with all required details by law';
            },
            whyNeeded: {
              he: 'ליצור מסמך רשמי לקבלת תרופות בבית מרקחת',
              en: 'To create official document for getting medications at pharmacy'
            }
          },

          validatePrescription: {
            name: { he: 'אימות מרשם', en: 'Validate Prescription' },
            contextualTitle: { 
              he: 'בואו נאמת את המרשם', 
              en: "Let's validate the prescription" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקת תקינות המרשם כולל אינטראקציות, אלרגיות ומינונים'
                : 'Check prescription validity including interactions, allergies and dosages';
            },
            whyNeeded: {
              he: 'להבטיח בטיחות המטופל ומניעת שגיאות תרופתיות',
              en: 'To ensure patient safety and prevent medication errors'
            }
          },

          cancelPrescription: {
            name: { he: 'ביטול מרשם', en: 'Cancel Prescription' },
            contextualTitle: { 
              he: 'בואו נבטל את המרשם', 
              en: "Let's cancel the prescription" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ביטול מרשם קיים עקב שינוי בטיפול או תופעות לוואי'
                : 'Cancel existing prescription due to treatment change or side effects';
            },
            whyNeeded: {
              he: 'לעדכן הטיפול במקרה של שינויים במצב המטופל',
              en: 'To update treatment in case of changes in patient condition'
            }
          },

          refillPrescription: {
            name: { he: 'חידוש מרשם', en: 'Refill Prescription' },
            contextualTitle: { 
              he: 'בואו נחדש את המרשם', 
              en: "Let's refill the prescription" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חידוש מרשם קיים לטיפול רציף בתרופות כרוניות'
                : 'Refill existing prescription for continuous treatment with chronic medications';
            },
            whyNeeded: {
              he: 'להמשיך טיפול תרופתי רציף במחלות כרוניות',
              en: 'To continue continuous pharmaceutical treatment for chronic diseases'
            }
          },

          requestPrescriptionRefill: {
            name: { he: 'בקשת חידוש מרשם', en: 'Request Prescription Refill' },
            contextualTitle: { 
              he: 'בואו נבקש חידוש מרשם', 
              en: "Let's request prescription refill" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הגשת בקשה לחידוש מרשם על ידי המטופל או הצוות'
                : 'Submit request for prescription refill by patient or staff';
            },
            whyNeeded: {
              he: 'לוודא שלמטופל לא יגמרו התרופות הכרוניות',
              en: 'To ensure patient doesn\'t run out of chronic medications'
            }
          },

          checkDrugInteractions: {
            name: { he: 'בדיקת אינטראקציות תרופתיות', en: 'Check Drug Interactions' },
            contextualTitle: { 
              he: 'בואו נבדוק אינטראקציות תרופתיות', 
              en: "Let's check drug interactions" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקה מקיפה של אינטראקציות אפשריות בין תרופות שונות'
                : 'Comprehensive check of possible interactions between different medications';
            },
            whyNeeded: {
              he: 'למנוע אינטראקציות מסוכנות שעלולות לפגוע במטופל',
              en: 'To prevent dangerous interactions that could harm the patient'
            }
          },

          checkDrugAllergy: {
            name: { he: 'בדיקת אלרגיה לתרופה', en: 'Check Drug Allergy' },
            contextualTitle: { 
              he: 'בואו נבדוק אלרגיה לתרופה', 
              en: "Let's check drug allergy" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקה האם למטופל יש אלרגיה ידועה לתרופה המוצעת'
                : 'Check if patient has known allergy to the proposed medication';
            },
            whyNeeded: {
              he: 'למנוע תגובות אלרגיות מסכנות חיים',
              en: 'To prevent life-threatening allergic reactions'
            }
          },

          checkDrugSafety: {
            name: { he: 'בדיקת בטיחות תרופתית', en: 'Check Drug Safety' },
            contextualTitle: { 
              he: 'בואו נבדוק בטיחות התרופה', 
              en: "Let's check drug safety" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקה מקיפה של בטיחות התרופה כולל מינון, הכוונות נגד ותופעות לוואי'
                : 'Comprehensive check of drug safety including dosage, contraindications and side effects';
            },
            whyNeeded: {
              he: 'להבטיח שהתרופה בטוחה למטופל הספציפי',
              en: 'To ensure the medication is safe for the specific patient'
            }
          },

          calculateMedicationDosing: {
            name: { he: 'חישוב מינון תרופה', en: 'Calculate Medication Dosing' },
            contextualTitle: { 
              he: 'בואו נחשב מינון תרופה', 
              en: "Let's calculate medication dosing" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חישוב מדויק של מינון התרופה בהתאם לגיל, משקל ומצב כלי הדם'
                : 'Accurate calculation of medication dosage according to age, weight and kidney function';
            },
            whyNeeded: {
              he: 'למנוע תת מינון או מינון יתר שעלול להזיק למטופל',
              en: 'To prevent under-dosing or overdosing that could harm the patient'
            }
          },

          deleteMedicalHistory: {
            name: { he: 'מחיקת היסטוריה רפואית', en: 'Delete Medical History' },
            contextualTitle: { 
              he: 'בואו נמחק היסטוריה רפואית', 
              en: "Let's delete medical history" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '⚠️ מחיקת רשומה רפואית ספציפית - פעולה רגישה הדורשת אישור'
                : '⚠️ Delete specific medical record - sensitive action requiring authorization';
            },
            whyNeeded: {
              he: 'לתיקון שגיאות או הסרת מידע שגוי מההיסטוריה הרפואית',
              en: 'To correct errors or remove incorrect information from medical history'
            }
          },

          updateMedicalHistory: {
            name: { he: 'עדכון היסטוריה רפואית', en: 'Update Medical History' },
            contextualTitle: { 
              he: 'בואו נעדכן את ההיסטוריה הרפואית', 
              en: "Let's update the medical history" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עדכון פרטים בהיסטוריה הרפואית הקיימת של המטופל'
                : 'Update details in existing patient medical history';
            },
            whyNeeded: {
              he: 'לשמור על דיוק המידע הרפואי ולהוסיף פרטים חשובים',
              en: 'To maintain accuracy of medical information and add important details'
            }
          },

          updateVitalSigns: {
            name: { he: 'עדכון סימנים חיוניים', en: 'Update Vital Signs' },
            contextualTitle: { 
              he: 'בואו נעדכן את הסימנים החיוניים', 
              en: "Let's update the vital signs" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיקון או עדכון מדידות סימנים חיוניים קיימות'
                : 'Correct or update existing vital signs measurements';
            },
            whyNeeded: {
              he: 'לתקן שגיאות במדידות או לעדכן ערכים משולבים',
              en: 'To fix measurement errors or update combined values'
            }
          },

          permanentlyDeletePatient: {
            name: { he: 'מחיקת מטופל לצמיתות', en: 'Permanently Delete Patient' },
            contextualTitle: { 
              he: '🚨 מחיקה לצמיתות של מטופל', 
              en: "🚨 Permanently delete patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '⛔ מחיקה מוחלטת של מטופל מהמערכת - פעולה בלתי הפיכה!'
                : '⛔ Complete deletion of patient from system - irreversible action!';
            },
            whyNeeded: {
              he: 'במקרים חריגים של בקשה חוקית למחיקת נתונים',
              en: 'In exceptional cases of legal request for data deletion'
            }
          },

          restorePatient: {
            name: { he: 'שחזור מטופל', en: 'Restore Patient' },
            contextualTitle: { 
              he: 'בואו נשחזר מטופל שנמחק', 
              en: "Let's restore deleted patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שחזור מטופל שנמחק באופן זמני מהמערכת'
                : 'Restore patient that was temporarily deleted from the system';
            },
            whyNeeded: {
              he: 'לתקן מחיקות בטעות או להחזיר מטופלים פעילים',
              en: 'To fix accidental deletions or restore active patients'
            }
          },

          deletePatientBySearch: {
            name: { he: 'מחיקת מטופל לפי חיפוש', en: 'Delete Patient by Search' },
            contextualTitle: { 
              he: 'בואו נמצא ונמחק מטופל', 
              en: "Let's find and delete patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '⚠️ חיפוש מטופל לפי קריטריונים ומחיקתו - דורש אישור'
                : '⚠️ Search patient by criteria and delete - requires authorization';
            },
            whyNeeded: {
              he: 'למחיקת מטופלים מרובים או לפי תנאים ספציפיים',
              en: 'For deleting multiple patients or by specific conditions'
            }
          },

          getDeletedPatients: {
            name: { he: 'קבלת מטופלים שנמחקו', en: 'Get Deleted Patients' },
            contextualTitle: { 
              he: 'בואו נראה מטופלים שנמחקו', 
              en: "Let's see deleted patients" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת רשימת מטופלים שנמחקו זמנית למטרות שחזור'
                : 'Display list of temporarily deleted patients for recovery purposes';
            },
            whyNeeded: {
              he: 'לבדוק מחיקות שגויות ולאפשר שחזור במידת הצורך',
              en: 'To check wrong deletions and enable recovery if needed'
            }
          },

          searchPatientsByName: {
            name: { he: 'חיפוש מטופלים לפי שם', en: 'Search Patients by Name' },
            contextualTitle: { 
              he: 'בואו נחפש מטופלים לפי שם', 
              en: "Let's search patients by name" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חיפוש מטופלים בהתבסס על שם פרטי ומשפחה עם תמיכה בחיפוש חלקי'
                : 'Search patients based on first and last name with partial search support';
            },
            whyNeeded: {
              he: 'למצוא במהירות מטופל ספציפי כאשר יודעים רק את השם',
              en: 'To quickly find specific patient when knowing only the name'
            }
          },

          anonymizePatientData: {
            name: { he: 'אנונימיזציה של נתוני מטופל', en: 'Anonymize Patient Data' },
            contextualTitle: { 
              he: 'בואו נאנונימיזציה נתוני מטופל', 
              en: "Let's anonymize patient data" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הסרת מידע מזהה אישי מנתוני המטופל למחקר או ניתוח'
                : 'Remove personally identifying information from patient data for research or analysis';
            },
            whyNeeded: {
              he: 'לאפשר מחקר רפואי תוך שמירה על פרטיות המטופל',
              en: 'To enable medical research while protecting patient privacy'
            }
          },

          batchUpdatePatients: {
            name: { he: 'עדכון מטופלים במקבץ', en: 'Batch Update Patients' },
            contextualTitle: { 
              he: 'בואו נעדכן מטופלים במקבץ', 
              en: "Let's batch update patients" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עדכון פרטים של מספר מטופלים בו זמנית - חיסכון בזמן'
                : 'Update details of multiple patients simultaneously - saves time';
            },
            whyNeeded: {
              he: 'ליעילות בעדכון פרטים של קבוצות מטופלים גדולות',
              en: 'For efficiency when updating details of large patient groups'
            }
          },

          exportAnonymizedData: {
            name: { he: 'ייצוא נתונים אנונימיים', en: 'Export Anonymized Data' },
            contextualTitle: { 
              he: 'בואו נייצא נתונים אנונימיים', 
              en: "Let's export anonymized data" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ייצוא נתוני מטופלים ללא מידע מזהה למחקר או ניתוח'
                : 'Export patient data without identifying information for research or analysis';
            },
            whyNeeded: {
              he: 'לאפשר שיתוף נתונים למחקר תוך שמירה על פרטיות',
              en: 'To enable data sharing for research while maintaining privacy'
            }
          },

          generateSOAPNote: {
            name: { he: 'יצירת רשומה רפואית SOAP', en: 'Generate SOAP Note' },
            contextualTitle: { 
              he: 'בואו ניצור רשומה רפואית מובנית', 
              en: "Let's create structured medical record" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'יצירת רשומה רפואית מובנית במתכונת SOAP - סימנים, הערכה, תוכנית'
                : 'Create structured medical record in SOAP format - symptoms, assessment, plan';
            },
            whyNeeded: {
              he: 'לתיעוד רפואי סטנדרטי ומקצועי של הביקור',
              en: 'For standard and professional medical documentation of the visit'
            }
          },

          generateTreatmentRecommendations: {
            name: { he: 'המלצות טיפול', en: 'Treatment Recommendations' },
            contextualTitle: { 
              he: 'בואו נקבל המלצות טיפול', 
              en: "Let's get treatment recommendations" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'המלצות טיפול מותאמות אישית בהתבסס על האבחנה ומצב המטופל'
                : 'Personalized treatment recommendations based on diagnosis and patient condition';
            },
            whyNeeded: {
              he: 'להבטיח טיפול אופטימלי מבוסס על עדכון עדכני',
              en: 'To ensure optimal treatment based on current best practices'
            }
          },

          analyzePatientFlow: {
            name: { he: 'ניתוח זרימת מטופלים', en: 'Analyze Patient Flow' },
            contextualTitle: { 
              he: 'בואו ננתח את זרימת המטופלים במרפאה', 
              en: "Let's analyze patient flow in the practice" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ניתוח דפוסי תנועה של מטופלים במרפאה לשיפור יעילות'
                : 'Analyze patient movement patterns in practice to improve efficiency';
            },
            whyNeeded: {
              he: 'לזיהוי צווארי בקבוק ושיפור חוויית המטופל',
              en: 'To identify bottlenecks and improve patient experience'
            }
          },

          analyzeVitalTrends: {
            name: { he: 'ניתוח מגמות סימנים חיוניים', en: 'Analyze Vital Trends' },
            contextualTitle: { 
              he: 'בואו ננתח מגמות בסימנים החיוניים', 
              en: "Let's analyze vital signs trends" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ניתוח מגמות בסימנים החיוניים לאיתור שינויים ודפוסים חשובים'
                : 'Analyze vital signs trends to detect important changes and patterns';
            },
            whyNeeded: {
              he: 'לזיהוי מוקדם של הרעה או שיפור במצב המטופל',
              en: 'For early detection of deterioration or improvement in patient condition'
            }
          },

          parseSymptoms: {
            name: { he: 'עיבוד תסמינים', en: 'Parse Symptoms' },
            contextualTitle: { 
              he: 'בואו נעבד את התסמינים שדווחו', 
              en: "Let's parse the reported symptoms" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עיבוד וניתוח תסמינים שדווחו על ידי המטופל למונחים רפואיים'
                : 'Process and analyze symptoms reported by patient into medical terms';
            },
            whyNeeded: {
              he: 'להמיר תיאורים של המטופל לקטגוריות רפואיות מובנות',
              en: 'To convert patient descriptions into structured medical categories'
            }
          },

          parseTreatment: {
            name: { he: 'עיבוד תוכנית טיפול', en: 'Parse Treatment Plan' },
            contextualTitle: { 
              he: 'בואו נעבד את תוכנית הטיפול', 
              en: "Let's parse the treatment plan" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עיבוד תוכנית טיפול למרכיבים מובנים וניתנים ליישום'
                : 'Parse treatment plan into structured, actionable components';
            },
            whyNeeded: {
              he: 'להפוך המלצות טיפול לשלבים מדויקים וניתנים למעקב',
              en: 'To convert treatment recommendations into precise, trackable steps'
            }
          },

          recordVitalSigns: {
            name: { he: 'רישום סימנים חיוניים', en: 'Record Vital Signs' },
            contextualTitle: { 
              he: 'בואו נרשום סימנים חיוניים', 
              en: "Let's record vital signs" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'רישום מדויק של סימנים חיוניים עם חותמת זמן ומדענת'
                : 'Accurate recording of vital signs with timestamp and device info';
            },
            whyNeeded: {
              he: 'לתיעוד מדויק למעקב רפואי ואבחון',
              en: 'For accurate documentation for medical monitoring and diagnosis'
            }
          },

          setVitalAlerts: {
            name: { he: 'הגדרת התראות סימנים חיוניים', en: 'Set Vital Alerts' },
            contextualTitle: { 
              he: 'בואו נגדיר התראות לסימנים חיוניים', 
              en: "Let's set vital signs alerts" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הגדרת התראות אוטומטיות כאשר סימנים חיוניים חורגים מנורמה'
                : 'Set automatic alerts when vital signs exceed normal ranges';
            },
            whyNeeded: {
              he: 'למעקב רציף ותגובה מהירה למצבים מסוכנים',
              en: 'For continuous monitoring and rapid response to dangerous conditions'
            }
          },

          checkFormularyCoverage: {
            name: { he: 'בדיקת כיסוי פורמולרי', en: 'Check Formulary Coverage' },
            contextualTitle: { 
              he: 'בואו נבדוק כיסוי תרופות בביטוח', 
              en: "Let's check medication coverage in insurance" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקה האם תרופה מסוימת מכוסה על ידי קרן החולים או הביטוח'
                : 'Check if specific medication is covered by health fund or insurance';
            },
            whyNeeded: {
              he: 'לוודא שהמטופל יוכל לקבל את התרופה המומלצת',
              en: 'To ensure patient can receive the recommended medication'
            }
          },

          checkDrugAdverseEvents: {
            name: { he: 'בדיקת תופעות לוואי', en: 'Check Drug Adverse Events' },
            contextualTitle: { 
              he: 'בואו נבדוק תופעות לוואי אפשריות', 
              en: "Let's check possible adverse events" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקת תופעות לוואי ידועות של תרופה כולל שכיחות וחומרה'
                : 'Check known adverse effects of medication including frequency and severity';
            },
            whyNeeded: {
              he: 'ליידע את המטופל על סיכונים אפשריים ולהכין למעקב',
              en: 'To inform patient about possible risks and prepare for monitoring'
            }
          },

          sendMedicationRefillReminders: {
            name: { he: 'שליחת תזכורות לחידוש תרופות', en: 'Send Medication Refill Reminders' },
            contextualTitle: { 
              he: 'בואו נשלח תזכורות לחידוש תרופות', 
              en: "Let's send medication refill reminders" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת תזכורות אוטומטיות למטופלים לחדש תרופות כרוניות'
                : 'Send automatic reminders to patients to refill chronic medications';
            },
            whyNeeded: {
              he: 'למנוע הפסקת טיפול תרופתי וסיבוכים רפואיים',
              en: 'To prevent medication interruption and medical complications'
            }
          },

          sendTestResultNotifications: {
            name: { he: 'שליחת הודעות תוצאות בדיקות', en: 'Send Test Result Notifications' },
            contextualTitle: { 
              he: 'בואו נשלח הודעות תוצאות בדיקות', 
              en: "Let's send test result notifications" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת הודעות אוטומטיות למטופלים כאשר תוצאות בדיקות מוכנות'
                : 'Send automatic notifications to patients when test results are ready';
            },
            whyNeeded: {
              he: 'לעדכן מטופלים במהירות ולאפשר המשך טיפול',
              en: 'To update patients quickly and enable continued treatment'
            }
          },

          reportPatientSymptoms: {
            name: { he: 'דיווח תסמינים של מטופל', en: 'Report Patient Symptoms' },
            contextualTitle: { 
              he: 'בואו נדווח על תסמינים של המטופל', 
              en: "Let's report patient symptoms" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'דיווח מובנה של תסמינים למטרות אבחון ומעקב'
                : 'Structured reporting of symptoms for diagnosis and monitoring purposes';
            },
            whyNeeded: {
              he: 'לתיעוד מדויק של מצב המטופל ולמעקב אחר שינויים',
              en: 'For accurate documentation of patient condition and tracking changes'
            }
          },

          extractMedicalData: {
            name: { he: 'חילוץ נתונים רפואיים', en: 'Extract Medical Data' },
            contextualTitle: { 
              he: 'בואו נחלץ נתונים רפואיים', 
              en: "Let's extract medical data" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חילוץ אוטומטי של נתונים רפואיים מטקסטים ומסמכים'
                : 'Automatic extraction of medical data from texts and documents';
            },
            whyNeeded: {
              he: 'לדיגיטיזציה מהירה של מידע רפואי ומסמכים קיימים',
              en: 'For rapid digitization of medical information and existing documents'
            }
          },

          calculateNutritionNeeds: {
            name: { he: 'חישוב צרכים תזונתיים', en: 'Calculate Nutrition Needs' },
            contextualTitle: { 
              he: 'בואו נחשב צרכים תזונתיים', 
              en: "Let's calculate nutrition needs" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חישוב צרכים תזונתיים מותאמים אישית לגיל, מין, פעילות ומצב רפואי'
                : 'Calculate personalized nutrition needs based on age, sex, activity and medical condition';
            },
            whyNeeded: {
              he: 'למתן הנחיות תזונה מדויקות לבריאות אופטימלית',
              en: 'To provide accurate nutrition guidance for optimal health'
            }
          },

          getNutritionData: {
            name: { he: 'קבלת נתוני תזונה', en: 'Get Nutrition Data' },
            contextualTitle: { 
              he: 'בואו נקבל נתוני תזונה', 
              en: "Let's get nutrition data" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'קבלת מידע תזונתי מפורט על מזונות וערכים תזונתיים'
                : 'Get detailed nutritional information about foods and nutritional values';
            },
            whyNeeded: {
              he: 'למתן ייעוץ תזונתי מבוסס נתונים מדויקים',
              en: 'To provide nutrition counseling based on accurate data'
            }
          },

          // ========== SECURITY & COMPLIANCE FUNCTIONS ==========
          acknowledgePolicy: {
            name: { he: 'אישור מדיניות', en: 'Acknowledge Policy' },
            contextualTitle: { 
              he: 'בואו נאשר קריאת המדיניות', 
              en: "Let's acknowledge policy reading" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'אישור רשמי שהמשתמש קרא והבין את המדיניות החדשה'
                : 'Official confirmation that user has read and understood the new policy';
            },
            whyNeeded: {
              he: 'לעמידה בתקנות אכיפה ותיעוד הכשרות משפטיות',
              en: 'For compliance with enforcement regulations and legal training documentation'
            }
          },

          reportBreach: {
            name: { he: 'דיווח הפרת אבטחה', en: 'Report Security Breach' },
            contextualTitle: { 
              he: '🚨 דיווח חירום על הפרת אבטחה', 
              en: "🚨 Emergency security breach report" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '⚠️ דיווח מיידי על חשד להפרת אבטחה או דליפת מידע רפואי'
                : '⚠️ Immediate report of suspected security breach or medical information leak';
            },
            whyNeeded: {
              he: 'חובה חוקית לדווח תוך 72 שעות על הפרות אבטחת מידע רפואי',
              en: 'Legal obligation to report medical information security breaches within 72 hours'
            }
          },

          blacklistIP: {
            name: { he: 'חסימת כתובת IP', en: 'Blacklist IP Address' },
            contextualTitle: { 
              he: 'בואו נחסום כתובת IP חשודה', 
              en: "Let's blacklist suspicious IP address" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '🛡️ חסימת כתובת IP חשודה מגישה למערכת לצמיתות'
                : '🛡️ Block suspicious IP address from accessing system permanently';
            },
            whyNeeded: {
              he: 'למנוע התקפות מתמשכות מכתובות IP מסוכנות',
              en: 'To prevent ongoing attacks from dangerous IP addresses'
            }
          },

          addServer: {
            name: { he: 'הוספת שרת', en: 'Add Server' },
            contextualTitle: { 
              he: 'בואו נוסיף שרת חדש למערכת', 
              en: "Let's add new server to system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הוספת שרת חדש לצבר השרתים לצרכי הרחבת קיבולת או גיבוי'
                : 'Add new server to server cluster for capacity expansion or backup needs';
            },
            whyNeeded: {
              he: 'להגדלת כושר העיבוד או לשיפור יכולת השירות במערכת',
              en: 'To increase processing power or improve system service capability'
            }
          },

          removeServer: {
            name: { he: 'הסרת שרת', en: 'Remove Server' },
            contextualTitle: { 
              he: 'בואו נסיר שרת מהמערכת', 
              en: "Let's remove server from system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הסרת שרת מצבר השרתים לצרכי תחזוקה או חיסכון בעלויות'
                : 'Remove server from cluster for maintenance needs or cost savings';
            },
            whyNeeded: {
              he: 'לתחזוקה מתוכננת או כאשר הקיבולת עודפת לצרכים',
              en: 'For planned maintenance or when capacity exceeds requirements'
            }
          },

          drainServer: {
            name: { he: 'ריקון שרת', en: 'Drain Server' },
            contextualTitle: { 
              he: 'בואו נרוקן שרת מפעילות', 
              en: "Let's drain server from activity" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'העברה הדרגתית של פעילות מהשרת לשרתים אחרים לפני תחזוקה'
                : 'Gradual transfer of activity from server to others before maintenance';
            },
            whyNeeded: {
              he: 'להבטיח המשכיות שירות תוך כדי תחזוקה או עדכון שרת',
              en: 'To ensure service continuity during server maintenance or updates'
            }
          },

          optimizeDatabase: {
            name: { he: 'אופטימיזציה של מסד נתונים', en: 'Optimize Database' },
            contextualTitle: { 
              he: 'בואו נבצע אופטימיזציה למסד הנתונים', 
              en: "Let's perform database optimization" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שיפור ביצועי מסד הנתונים על ידי ארגון מחדש של אינדקסים וטבלאות'
                : 'Improve database performance by reorganizing indexes and tables';
            },
            whyNeeded: {
              he: 'לשמירה על מהירות גישה למידע ומניעת האטה במערכת',
              en: 'To maintain information access speed and prevent system slowdown'
            }
          },

          rebuildIndexes: {
            name: { he: 'בניית אינדקסים מחדש', en: 'Rebuild Database Indexes' },
            contextualTitle: { 
              he: 'בואו נבנה את האינדקסים מחדש', 
              en: "Let's rebuild database indexes" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בניה מחדש של אינדקסים במסד הנתונים לשיפור מהירות חיפוש'
                : 'Rebuild database indexes to improve search speed';
            },
            whyNeeded: {
              he: 'אינדקסים מפוצלים יכולים להאט את החיפושים במסד הנתונים',
              en: 'Fragmented indexes can slow down database searches'
            }
          },

          analyzeDatabase: {
            name: { he: 'ניתוח מסד נתונים', en: 'Analyze Database' },
            contextualTitle: { 
              he: 'בואו ננתח את מסד הנתונים', 
              en: "Let's analyze the database" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ניתוח מקיף של ביצועי מסד הנתונים וזיהוי בעיות פוטנציאליות'
                : 'Comprehensive analysis of database performance and identification of potential issues';
            },
            whyNeeded: {
              he: 'לזיהוי מוקדם של בעיות ביצועים ותכנון קיבולת עתידית',
              en: 'For early detection of performance issues and future capacity planning'
            }
          },

          getDatabaseStats: {
            name: { he: 'קבלת סטטיסטיקות מסד נתונים', en: 'Get Database Statistics' },
            contextualTitle: { 
              he: 'בואו נראה סטטיסטיקות מסד הנתונים', 
              en: "Let's see database statistics" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת נתונים סטטיסטיים על שימוש, ביצועים וגודל מסד הנתונים'
                : 'Display statistical data about database usage, performance and size';
            },
            whyNeeded: {
              he: 'לניטור שוטף של בריאות מסד הנתונים ותכנון משאבים',
              en: 'For ongoing monitoring of database health and resource planning'
            }
          },

          performFailover: {
            name: { he: 'ביצוע מעבר לגיבוי', en: 'Perform System Failover' },
            contextualTitle: { 
              he: 'בואו נבצע מעבר למערכת גיבוי', 
              en: "Let's perform failover to backup system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '🔄 מעבר אוטומטי למערכת גיבוי במקרה של תקלה במערכת הראשית'
                : '🔄 Automatic switch to backup system in case of main system failure';
            },
            whyNeeded: {
              he: 'להבטיח המשכיות שירות ללא הפרעה למטופלים',
              en: 'To ensure service continuity without interruption to patients'
            }
          },

          clearCache: {
            name: { he: 'מחיקת מטמון', en: 'Clear System Cache' },
            contextualTitle: { 
              he: 'בואו נמחק את המטמון', 
              en: "Let's clear the system cache" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'מחיקת מטמון המערכת לפתרון בעיות או שחרור זיכרון'
                : 'Clear system cache to resolve issues or free up memory';
            },
            whyNeeded: {
              he: 'לפתרון בעיות ביצועים או כאשר המידע במטמון מיושן',
              en: 'To resolve performance issues or when cached information is outdated'
            }
          },

          getCacheStatistics: {
            name: { he: 'סטטיסטיקות מטמון', en: 'Cache Statistics' },
            contextualTitle: { 
              he: 'בואו נראה סטטיסטיקות המטמון', 
              en: "Let's see cache statistics" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת נתוני שימוש במטמון - פגיעות, החמצות, שימוש בזיכרון'
                : 'Display cache usage data - hits, misses, memory usage';
            },
            whyNeeded: {
              he: 'לאופטימיזציה של ביצועי המטמון ותכנון זיכרון',
              en: 'For cache performance optimization and memory planning'
            }
          },

          warmupCache: {
            name: { he: 'חימום מטמון', en: 'Warmup Cache' },
            contextualTitle: { 
              he: 'בואו נחמם את המטמון', 
              en: "Let's warmup the cache" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'טעינה מוקדמת של נתונים נפוצים למטמון לשיפור ביצועים'
                : 'Preload frequently used data into cache for performance improvement';
            },
            whyNeeded: {
              he: 'להבטיח תגובה מהירה לבקשות נפוצות מתחילת היום',
              en: 'To ensure fast response to common requests from start of day'
            }
          },

          // ========== APPOINTMENTS & SCHEDULING FUNCTIONS ==========
          scheduleAppointment: {
            name: { he: 'תיאום פגישה', en: 'Schedule Appointment' },
            contextualTitle: { 
              he: 'בואו נתאם פגישה חדשה למטופל', 
              en: "Let's schedule new appointment for patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיאום פגישה חדשה עם רופא או מומחה כולל בחירת זמן ומקום'
                : 'Schedule new appointment with doctor or specialist including time and location selection';
            },
            whyNeeded: {
              he: 'לתיאום מפגשים בין מטופלים לצוות הרפואי במועדים נוחים',
              en: 'To coordinate meetings between patients and medical staff at convenient times'
            }
          },

          rescheduleAppointment: {
            name: { he: 'שינוי מועד פגישה', en: 'Reschedule Appointment' },
            contextualTitle: { 
              he: 'בואו נשנה מועד פגישה קיימת', 
              en: "Let's reschedule existing appointment" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שינוי מועד פגישה קיימת למועד אחר מסיבות אישיות או רפואיות'
                : 'Change existing appointment to different time for personal or medical reasons';
            },
            whyNeeded: {
              he: 'לגמישות בלוח הזמנים כאשר נדרש שינוי במועדי הפגישות',
              en: 'For schedule flexibility when appointment time changes are needed'
            }
          },

          cancelAppointment: {
            name: { he: 'ביטול פגישה', en: 'Cancel Appointment' },
            contextualTitle: { 
              he: 'בואו נבטל פגישה', 
              en: "Let's cancel appointment" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ביטול פגישה מתוכננת וביטול ההזמנה במערכת'
                : 'Cancel planned appointment and remove booking from system';
            },
            whyNeeded: {
              he: 'לשחרור מקומות במערכת ומניעת המתנה מיותרת',
              en: 'To free up slots in system and prevent unnecessary waiting'
            }
          },

          findAvailableSlots: {
            name: { he: 'חיפוש מועדים פנויים', en: 'Find Available Slots' },
            contextualTitle: { 
              he: 'בואו נמצא מועדים פנויים', 
              en: "Let's find available time slots" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חיפוש מועדים פנויים בלוח הזמנים של רופא או מומחה ספציפי'
                : 'Search for available time slots in specific doctor or specialist schedule';
            },
            whyNeeded: {
              he: 'למצוא במהירות מועדים פנויים לתיאום פגישות חדשות',
              en: 'To quickly find available times for scheduling new appointments'
            }
          },

          getAppointments: {
            name: { he: 'קבלת רשימת פגישות', en: 'Get Appointments List' },
            contextualTitle: { 
              he: 'בואו נראה את רשימת הפגישות', 
              en: "Let's see appointments list" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת רשימת כל הפגישות המתוכננות למטופל או לרופא'
                : 'Display list of all planned appointments for patient or doctor';
            },
            whyNeeded: {
              he: 'לסקירה כללית של לוח הזמנים והכנה לפגישות הבאות',
              en: 'For schedule overview and preparation for upcoming appointments'
            }
          },

          getTodayAppointments: {
            name: { he: 'פגישות היום', en: "Today's Appointments" },
            contextualTitle: { 
              he: 'בואו נראה את פגישות היום', 
              en: "Let's see today's appointments" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת רשימת כל הפגישות המתוכננות להיום הנוכחי'
                : 'Display list of all appointments scheduled for today';
            },
            whyNeeded: {
              he: 'לתכנון יום העבודה וסיקור הפגישות הקרובות',
              en: 'For daily work planning and review of upcoming appointments'
            }
          },

          getOverdueAppointments: {
            name: { he: 'פגישות באיחור', en: 'Overdue Appointments' },
            contextualTitle: { 
              he: 'בואו נראה פגישות שפוספסו', 
              en: "Let's see missed appointments" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת פגישות שלא התקיימו או שהמטופלים לא הגיעו אליהן'
                : 'Display appointments that did not take place or patients did not show up';
            },
            whyNeeded: {
              he: 'למעקב אחר אחוזי הגעה ותיאום פגישות חלופיות',
              en: 'To track attendance rates and coordinate alternative appointments'
            }
          },

          updateAppointment: {
            name: { he: 'עדכון פגישה', en: 'Update Appointment' },
            contextualTitle: { 
              he: 'בואו נעדכן פרטי פגישה', 
              en: "Let's update appointment details" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עדכון פרטי פגישה כמו הערות, מטרה, או משך זמן'
                : 'Update appointment details like notes, purpose, or duration';
            },
            whyNeeded: {
              he: 'לשמירה על מידע עדכני ומדויק על הפגישות המתוכננות',
              en: 'To maintain current and accurate information about planned appointments'
            }
          },

          checkCalendarConflicts: {
            name: { he: 'בדיקת התנגשויות בלוח זמנים', en: 'Check Calendar Conflicts' },
            contextualTitle: { 
              he: 'בואו נבדוק התנגשויות בלוח הזמנים', 
              en: "Let's check calendar conflicts" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקת התנגשויות אפשריות בלוח הזמנים לפני תיאום פגישה חדשה'
                : 'Check possible calendar conflicts before scheduling new appointment';
            },
            whyNeeded: {
              he: 'למניעת כפילויות ולוודא זמינות של הצוות הרפואי',
              en: 'To prevent duplicates and ensure availability of medical staff'
            }
          },

          sendAppointmentConfirmationRequest: {
            name: { he: 'שליחת בקשת אישור פגישה', en: 'Send Appointment Confirmation Request' },
            contextualTitle: { 
              he: 'בואו נשלח בקשת אישור לפגישה', 
              en: "Let's send appointment confirmation request" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת הודעה למטופל לאישור הגעה לפגישה המתוכננת'
                : 'Send message to patient to confirm attendance at planned appointment';
            },
            whyNeeded: {
              he: 'לוודא הגעת מטופלים ולמנוע פגישות ריקות',
              en: 'To ensure patient attendance and prevent empty appointments'
            }
          },

          // ========== USER MANAGEMENT FUNCTIONS ==========
          createUser: {
            name: { he: 'יצירת משתמש חדש', en: 'Create New User' },
            contextualTitle: { 
              he: 'בואו ניצור משתמש חדש במערכת', 
              en: "Let's create new user in system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'יצירת משתמש חדש במערכת עם הרשאות ותפקיד מתאימים'
                : 'Create new user in system with appropriate permissions and role';
            },
            whyNeeded: {
              he: 'להוספת חברי צוות חדשים או משתמשים חיצוניים למערכת',
              en: 'To add new staff members or external users to the system'
            }
          },

          getAllUsers: {
            name: { he: 'קבלת רשימת כל המשתמשים', en: 'Get All Users List' },
            contextualTitle: { 
              he: 'בואו נראה את כל המשתמשים', 
              en: "Let's see all users" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת רשימה מלאה של כל המשתמשים הרשומים במערכת'
                : 'Display complete list of all users registered in the system';
            },
            whyNeeded: {
              he: 'לניהול משתמשים ובקרת גישות למערכת',
              en: 'For user management and system access control'
            }
          },

          getUserDetails: {
            name: { he: 'קבלת פרטי משתמש', en: 'Get User Details' },
            contextualTitle: { 
              he: 'בואו נראה פרטי משתמש ספציפי', 
              en: "Let's see specific user details" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת מידע מפורט על משתמש ספציפי כולל הרשאות ופעילות'
                : 'Display detailed information about specific user including permissions and activity';
            },
            whyNeeded: {
              he: 'לבדיקת סטטוס משתמש ומעקב אחר פעילותו במערכת',
              en: 'To check user status and monitor their system activity'
            }
          },

          updateUserProfile: {
            name: { he: 'עדכון פרופיל משתמש', en: 'Update User Profile' },
            contextualTitle: { 
              he: 'בואו נעדכן את פרופיל המשתמש', 
              en: "Let's update user profile" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עדכון פרטי משתמש כמו שם, אימייל, טלפון ומידע אישי'
                : 'Update user details like name, email, phone and personal information';
            },
            whyNeeded: {
              he: 'לשמירה על מידע עדכני של המשתמשים במערכת',
              en: 'To maintain current user information in the system'
            }
          },

          suspendUser: {
            name: { he: 'השעיית משתמש', en: 'Suspend User' },
            contextualTitle: { 
              he: 'בואו נשעה משתמש זמנית', 
              en: "Let's suspend user temporarily" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '⚠️ השעיה זמנית של משתמש מגישה למערכת עקב הפרה או בעיה'
                : '⚠️ Temporary suspension of user from system access due to violation or issue';
            },
            whyNeeded: {
              he: 'להשעיית משתמש זמנית עד לבירור או פתרון בעיה',
              en: 'To suspend user temporarily pending investigation or issue resolution'
            }
          },

          reactivateUser: {
            name: { he: 'הפעלת משתמש מחדש', en: 'Reactivate User' },
            contextualTitle: { 
              he: 'בואו נפעיל משתמש מחדש', 
              en: "Let's reactivate user" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הפעלת משתמש מחדש לאחר השעיה או השבתה'
                : 'Reactivate user after suspension or deactivation';
            },
            whyNeeded: {
              he: 'להחזרת משתמש לפעילות לאחר פתרון הבעיה או הבירור',
              en: 'To restore user to activity after resolving issue or investigation'
            }
          },

          getUserActivity: {
            name: { he: 'פעילות משתמש', en: 'User Activity' },
            contextualTitle: { 
              he: 'בואו נראה את פעילות המשתמש', 
              en: "Let's see user activity" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת היסטוריית פעילות של משתמש במערכת כולל כניסות ופעולות'
                : 'Display user activity history in system including logins and actions';
            },
            whyNeeded: {
              he: 'לניטור פעילות ובקרת שימוש במערכת',
              en: 'For activity monitoring and system usage control'
            }
          },

          searchUsers: {
            name: { he: 'חיפוש משתמשים', en: 'Search Users' },
            contextualTitle: { 
              he: 'בואו נחפש משתמשים במערכת', 
              en: "Let's search users in system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חיפוש משתמשים לפי שם, תפקיד, מחלקה או קריטריונים אחרים'
                : 'Search users by name, role, department or other criteria';
            },
            whyNeeded: {
              he: 'למציאת משתמשים ספציפיים במערכת גדולה',
              en: 'To find specific users in large system'
            }
          },

          setupMFA: {
            name: { he: 'הגדרת אימות דו-שלבי', en: 'Setup Multi-Factor Authentication' },
            contextualTitle: { 
              he: 'בואו נגדיר אימות דו-שלבי', 
              en: "Let's setup multi-factor authentication" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '🔐 הגדרת אימות דו-שלבי לחיזוק אבטחת חשבון המשתמש'
                : '🔐 Setup two-factor authentication to strengthen user account security';
            },
            whyNeeded: {
              he: 'לחיזוק האבטחה ומניעת גישה לא מורשית לחשבונות',
              en: 'To strengthen security and prevent unauthorized account access'
            }
          },

          disableMFA: {
            name: { he: 'ביטול אימות דו-שלבי', en: 'Disable Multi-Factor Authentication' },
            contextualTitle: { 
              he: 'בואו נבטל אימות דו-שלבי', 
              en: "Let's disable multi-factor authentication" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '⚠️ ביטול אימות דו-שלבי (מוריד רמת אבטחה)'
                : '⚠️ Disable two-factor authentication (reduces security level)';
            },
            whyNeeded: {
              he: 'במקרי חירום או בעיות טכניות עם המכשיר',
              en: 'In emergency cases or technical issues with device'
            }
          },

          getMFAStatus: {
            name: { he: 'סטטוס אימות דו-שלבי', en: 'MFA Status' },
            contextualTitle: { 
              he: 'בואו נבדוק סטטוס אימות דו-שלבי', 
              en: "Let's check MFA status" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקה האם אימות דו-שלבי מופעל עבור המשתמש'
                : 'Check if two-factor authentication is enabled for user';
            },
            whyNeeded: {
              he: 'לוודא שאבטחת החשבון מוגדרת כראוי',
              en: 'To ensure account security is properly configured'
            }
          },

          // ========== COMMUNICATION FUNCTIONS ==========
          sendEmail: {
            name: { he: 'שליחת אימייל', en: 'Send Email' },
            contextualTitle: { 
              he: 'בואו נשלח אימייל', 
              en: "Let's send email" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת הודעת אימייל למטופל, צוות או גורם חיצוני'
                : 'Send email message to patient, staff or external party';
            },
            whyNeeded: {
              he: 'לתקשורת רשמית ותיעוד התכתבות חשובה',
              en: 'For official communication and documentation of important correspondence'
            }
          },

          sendSMS: {
            name: { he: 'שליחת SMS', en: 'Send SMS' },
            contextualTitle: { 
              he: 'בואו נשלח הודעת SMS', 
              en: "Let's send SMS message" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת הודעת טקסט קצרה בנייד למטופל או צוות'
                : 'Send short text message to patient or staff mobile phone';
            },
            whyNeeded: {
              he: 'להתראות דחופות או תזכורות מהירות',
              en: 'For urgent alerts or quick reminders'
            }
          },

          sendBulkPatientEmail: {
            name: { he: 'שליחת אימייל קבוצתי למטופלים', en: 'Send Bulk Patient Email' },
            contextualTitle: { 
              he: 'בואו נשלח אימייל לקבוצת מטופלים', 
              en: "Let's send email to patient group" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת אימייל לקבוצה גדולה של מטופלים בו זמנית'
                : 'Send email to large group of patients simultaneously';
            },
            whyNeeded: {
              he: 'להודעות כלליות, קמפיינים בריאותיים או עדכוני מרפאה',
              en: 'For general announcements, health campaigns or practice updates'
            }
          },

          sendBulkPatientSMS: {
            name: { he: 'שליחת SMS קבוצתי למטופלים', en: 'Send Bulk Patient SMS' },
            contextualTitle: { 
              he: 'בואו נשלח SMS לקבוצת מטופלים', 
              en: "Let's send SMS to patient group" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת הודעת SMS לקבוצה גדולה של מטופלים בו זמנית'
                : 'Send SMS message to large group of patients simultaneously';
            },
            whyNeeded: {
              he: 'להתראות דחופות או תזכורות חשובות לכלל המטופלים',
              en: 'For urgent alerts or important reminders to all patients'
            }
          },

          sendChatMessage: {
            name: { he: 'שליחת הודעת צ׳אט', en: 'Send Chat Message' },
            contextualTitle: { 
              he: 'בואו נשלח הודעת צ׳אט', 
              en: "Let's send chat message" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת הודעה במערכת הצ׳אט הפנימית של המרפאה'
                : 'Send message in practice internal chat system';
            },
            whyNeeded: {
              he: 'לתקשורת מהירה בין חברי הצוות במהלך העבודה',
              en: 'For quick communication between team members during work'
            }
          },

          sendPatientPortalMessage: {
            name: { he: 'שליחת הודעה לפורטל המטופל', en: 'Send Patient Portal Message' },
            contextualTitle: { 
              he: 'בואו נשלח הודעה לפורטל המטופל', 
              en: "Let's send message to patient portal" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת הודעה מאובטחת למטופל דרך הפורטל האישי שלו'
                : 'Send secure message to patient through their personal portal';
            },
            whyNeeded: {
              he: 'לתקשורת בטוחה עם המטופל ושמירה על פרטיות רפואית',
              en: 'For secure communication with patient while maintaining medical privacy'
            }
          },

          // ========== INSURANCE & BILLING FUNCTIONS ==========
          checkCoverage: {
            name: { he: 'בדיקת כיסוי ביטוחי', en: 'Check Insurance Coverage' },
            contextualTitle: { 
              he: 'בואו נבדוק כיסוי ביטוחי', 
              en: "Let's check insurance coverage" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקת כיסוי ביטוחי לטיפול או בדיקה רפואית ספציפית'
                : 'Check insurance coverage for specific medical treatment or examination';
            },
            whyNeeded: {
              he: 'לוודא שהמטופל יקבל כיסוי מביטוח בריאות',
              en: 'To ensure patient receives health insurance coverage'
            }
          },

          verifyInsurance: {
            name: { he: 'אימות ביטוח', en: 'Verify Insurance' },
            contextualTitle: { 
              he: 'בואו נאמת ביטוח המטופל', 
              en: "Let's verify patient insurance" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'אימות תקינות וזכאות הביטוח הרפואי של המטופל'
                : 'Verify validity and eligibility of patient medical insurance';
            },
            whyNeeded: {
              he: 'להבטיח קבלת תשלום עבור שירותים רפואיים',
              en: 'To ensure payment reception for medical services'
            }
          },

          getInsuranceDetails: {
            name: { he: 'קבלת פרטי ביטוח', en: 'Get Insurance Details' },
            contextualTitle: { 
              he: 'בואו נקבל פרטי ביטוח', 
              en: "Let's get insurance details" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'קבלת מידע מפורט על פוליסת הביטוח של המטופל'
                : 'Get detailed information about patient insurance policy';
            },
            whyNeeded: {
              he: 'להבין את היקף הכיסוי והשתתפויות עצמיות',
              en: 'To understand coverage scope and co-payments'
            }
          },

          updateInsurance: {
            name: { he: 'עדכון פרטי ביטוח', en: 'Update Insurance Details' },
            contextualTitle: { 
              he: 'בואו נעדכן פרטי ביטוח', 
              en: "Let's update insurance details" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עדכון פרטי הביטוח הרפואי של המטופל במערכת'
                : 'Update patient medical insurance details in system';
            },
            whyNeeded: {
              he: 'לשמור על מידע ביטוח עדכני לצורך חיובים',
              en: 'To maintain current insurance information for billing purposes'
            }
          },

          submitInsuranceClaim: {
            name: { he: 'הגשת תביעת ביטוח', en: 'Submit Insurance Claim' },
            contextualTitle: { 
              he: 'בואו נגיש תביעת ביטוח', 
              en: "Let's submit insurance claim" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הגשת תביעה לחברת הביטוח לקבלת החזר עבור טיפול'
                : 'Submit claim to insurance company for treatment reimbursement';
            },
            whyNeeded: {
              he: 'לקבל החזר כספי עבור שירותים רפואיים שניתנו',
              en: 'To receive financial reimbursement for medical services provided'
            }
          },

          createInvoice: {
            name: { he: 'יצירת חשבונית', en: 'Create Invoice' },
            contextualTitle: { 
              he: 'בואו ניצור חשבונית', 
              en: "Let's create invoice" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'יצירת חשבונית רשמי עבור שירותים רפואיים שניתנו למטופל'
                : 'Create official invoice for medical services provided to patient';
            },
            whyNeeded: {
              he: 'לתיעוד פיננסי ולתביעת תשלום עבור שירותים',
              en: 'For financial documentation and payment claim for services'
            }
          },

          recordPayment: {
            name: { he: 'רישום תשלום', en: 'Record Payment' },
            contextualTitle: { 
              he: 'בואו נרשום תשלום', 
              en: "Let's record payment" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיעוד תשלום שהתקבל מהמטופל או מחברת הביטוח'
                : 'Document payment received from patient or insurance company';
            },
            whyNeeded: {
              he: 'לניהול פיננסי מדויק ומעקב אחר תקבולים',
              en: 'For accurate financial management and revenue tracking'
            }
          },

          getOutstandingBalances: {
            name: { he: 'קבלת יתרות חוב', en: 'Get Outstanding Balances' },
            contextualTitle: { 
              he: 'בואו נראה יתרות חוב', 
              en: "Let's see outstanding balances" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת רשימת מטופלים עם חובות תשלום בעלים'
                : 'Display list of patients with outstanding payment debts';
            },
            whyNeeded: {
              he: 'לניהול גבייה ומעקב אחר תקבולים חסרים',
              en: 'For collection management and tracking missing revenues'
            }
          },

          // ========== EXTERNAL API & INTEGRATIONS ==========
          searchFDADrugs: {
            name: { he: 'חיפוש תרופות ב-FDA', en: 'Search FDA Drugs' },
            contextualTitle: { 
              he: 'בואו נחפש תרופות במאגר ה-FDA', 
              en: "Let's search drugs in FDA database" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חיפוש תרופות במאגר הרשמי של ה-FDA האמריקאי'
                : 'Search drugs in official US FDA database';
            },
            whyNeeded: {
              he: 'לקבלת מידע מהימן על תרופות שאושרו על ידי הרשויות',
              en: 'To get reliable information about drugs approved by authorities'
            }
          },

          getFDARecalls: {
            name: { he: 'קבלת ריקולים של FDA', en: 'Get FDA Recalls' },
            contextualTitle: { 
              he: 'בואו נראה ריקולי FDA', 
              en: "Let's see FDA recalls" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'קבלת רשימה עדכנית של תרופות ומכשירים שנזכרו על ידי ה-FDA'
                : 'Get current list of drugs and devices recalled by the FDA';
            },
            whyNeeded: {
              he: 'להימנע מרישום תרופות מסוכנות או פגומות',
              en: 'To avoid prescribing dangerous or defective medications'
            }
          },

          getCDCDiseaseData: {
            name: { he: 'קבלת נתוני מחלות מה-CDC', en: 'Get CDC Disease Data' },
            contextualTitle: { 
              he: 'בואו נקבל נתונים מה-CDC', 
              en: "Let's get data from CDC" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'קבלת נתונים עדכניים על מחלות ומגיפות ממרכז בקרת המחלות האמריקאי'
                : 'Get current data about diseases and epidemics from US Centers for Disease Control';
            },
            whyNeeded: {
              he: 'לעדכון בהתפשטות מחלות ונוהלי טיפול מעודכנים',
              en: 'For updates on disease spread and current treatment protocols'
            }
          },

          searchDrugInformation: {
            name: { he: 'חיפוש מידע על תרופות', en: 'Search Drug Information' },
            contextualTitle: { 
              he: 'בואו נחפש מידע על תרופות', 
              en: "Let's search drug information" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חיפוש מידע מקיף על תרופות מבסיסי נתונים רפואיים'
                : 'Search comprehensive drug information from medical databases';
            },
            whyNeeded: {
              he: 'לקבלת מידע עדכני על תרופות לפני רישום מרשם',
              en: 'To get current drug information before writing prescription'
            }
          },

          convertCurrency: {
            name: { he: 'המרת מטבע', en: 'Convert Currency' },
            contextualTitle: { 
              he: 'בואו נמיר מטבע', 
              en: "Let's convert currency" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'המרת סכומי כסף בין מטבעות שונים לפי שער חליפין עדכני'
                : 'Convert money amounts between different currencies at current exchange rate';
            },
            whyNeeded: {
              he: 'לחיובי מטופלים בינלאומיים או תשלומים זרים',
              en: 'For international patient billing or foreign payments'
            }
          },

          getCurrency: {
            name: { he: 'קבלת מטבע', en: 'Get Currency' },
            contextualTitle: { 
              he: 'בואו נראה את המטבע הנוכחי', 
              en: "Let's see current currency" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הצגת המטבע הנוכחי המוגדר במערכת לתשלומים וחיובים'
                : 'Display current currency set in system for payments and billing';
            },
            whyNeeded: {
              he: 'לוודא שהמחירים מוצגים במטבע הנכון',
              en: 'To ensure prices are displayed in correct currency'
            }
          },

          setCurrency: {
            name: { he: 'הגדרת מטבע', en: 'Set Currency' },
            contextualTitle: { 
              he: 'בואו נגדיר מטבע', 
              en: "Let's set currency" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הגדרת המטבע הבסיסי לשימוש במערכת לתשלומים וחיובים'
                : 'Set base currency for use in system for payments and billing';
            },
            whyNeeded: {
              he: 'להתאמת המערכת למטבע המקומי של המרפאה',
              en: 'To adapt system to practice local currency'
            }
          },

          getExchangeRate: {
            name: { he: 'קבלת שער חליפין', en: 'Get Exchange Rate' },
            contextualTitle: { 
              he: 'בואו נראה שער חליפין', 
              en: "Let's see exchange rate" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'קבלת שער החליפין העדכני בין מטבעות שונים'
                : 'Get current exchange rate between different currencies';
            },
            whyNeeded: {
              he: 'לחישוב מחירים מדויקים בעסקאות בינלאומיות',
              en: 'To calculate accurate prices in international transactions'
            }
          },

          validateAddress: {
            name: { he: 'אימות כתובת', en: 'Validate Address' },
            contextualTitle: { 
              he: 'בואו נאמת כתובת', 
              en: "Let's validate address" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'אימות תקינות וזמינות של כתובת פיזית למשלוח או ביקור'
                : 'Validate correctness and availability of physical address for delivery or visit';
            },
            whyNeeded: {
              he: 'לוודא שכתובות המטופלים נכונות למשלוח תרופות או ביקורי בית',
              en: 'To ensure patient addresses are correct for medication delivery or home visits'
            }
          },

          searchAddress: {
            name: { he: 'חיפוש כתובת', en: 'Search Address' },
            contextualTitle: { 
              he: 'בואו נחפש כתובת', 
              en: "Let's search address" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חיפוש כתובות פיזיות לפי חלקי מידע או קואורדינטות'
                : 'Search physical addresses by partial information or coordinates';
            },
            whyNeeded: {
              he: 'לאיתור כתובות למטרות משלוח, ביקור או הנחיות נסיעה',
              en: 'To locate addresses for delivery, visit or travel directions purposes'
            }
          },

          // Default fallback for any patient-related function
          default: {
            name: { he: 'פעולת מטופל', en: 'Patient Operation' },
            contextualTitle: { 
              he: 'מבצע פעולה על מטופל', 
              en: "Performing patient operation" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'מבצע פעולה על מטופל במערכת'
                : 'Performing operation on patient in the system';
            },
            whyNeeded: {
              he: 'ביצוע פעולה על מטופל במערכת',
              en: 'Performing operation on patient in the system'
            }
          }
        }
      },

      // ========== MEDICAL DIAGNOSIS & AI ANALYSIS (80+ functions) ==========
      medicalDiagnosis: {
        category: { he: 'אבחון רפואי ו-AI', en: 'Medical Diagnosis & AI' },
        icon: '🩺',
        description: { 
          he: 'כלי AI מתקדמים לאבחון, ניתוח סימפטומים והמלצות טיפול',
          en: 'Advanced AI tools for diagnosis, symptom analysis and treatment recommendations'
        },
        functions: {
          interpretLabResults: {
            name: { he: 'פענוח תוצאות מעבדה', en: 'Interpret Lab Results' },
            contextualTitle: { 
              he: 'מפענח תוצאות מעבדה', 
              en: "Interpreting lab results" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ניתוח תוצאות מעבדה וזיהוי ערכים קריטיים'
                : 'Analyzing lab results and identifying critical values';
            },
            whyNeeded: {
              he: 'פענוח מקצועי של תוצאות מעבדה לזיהוי בעיות רפואיות',
              en: 'Professional interpretation of lab results to identify medical issues'
            }
          },
          analyzeSymptoms: {
            name: { he: 'ניתוח סימפטומים', en: 'Analyze Symptoms' },
            contextualTitle: { 
              he: 'בואו נבין מה קורה עם המטופל', 
              en: "Let's understand what's happening with the patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ניתוח AI מתקדם של הסימפטומים עם המלצות אבחנה ודחיפות טיפול'
                : 'Advanced AI analysis of symptoms with diagnostic recommendations and urgency assessment';
            },
            whyNeeded: {
              he: 'כדי לקבל עזרה מהירה באבחון ראשוני ולוודא שלא מפספסים דברים חשובים',
              en: 'To get quick help with initial diagnosis and ensure we don\'t miss important indicators'
            },
            aiCapabilities: {
              he: [
                '🧠 ניתוח תבניות סימפטומים',
                '⚡ זיהוי דגלים אדומים',
                '📊 דירוג הסתברות אבחנות',
                '🎯 המלצות לבדיקות נוספות',
                '⏰ הערכת דחיפות',
                '💡 השוואה למקרים דומים'
              ],
              en: [
                '🧠 Symptom pattern analysis',
                '⚡ Red flag identification',
                '📊 Diagnosis probability ranking',
                '🎯 Recommended additional tests',
                '⏰ Urgency assessment',
                '💡 Similar case comparison'
              ]
            }
          },
          
          drugInteractions: {
            name: { he: 'בדיקת אינטראקציות תרופות', en: 'Drug Interaction Check' },
            contextualTitle: { 
              he: 'בואו נוודא שהתרופות בטוחות יחד', 
              en: "Let's ensure the medications are safe together" 
            },
            whyNeeded: {
              he: 'למנוע אינטראקציות מסוכנות בין תרופות שיכולות לסכן חיים',
              en: 'To prevent dangerous drug interactions that could be life-threatening'
            },
            safetyLevels: {
              he: [
                '🟢 בטוח - אין אינטראקציה',
                '🟡 זהירות - מעקב נדרש',
                '🟠 אזהרה - התאמת מינון',
                '🔴 מסוכן - אין לשלב'
              ],
              en: [
                '🟢 Safe - No interaction',
                '🟡 Caution - Monitoring required',
                '🟠 Warning - Dose adjustment needed',
                '🔴 Dangerous - Do not combine'
              ]
            }
          },
          
          labResultsAnalysis: {
            name: { he: 'ניתוח תוצאות בדיקות', en: 'Lab Results Analysis' },
            contextualTitle: { 
              he: 'בואו נפרש את תוצאות הבדיקות', 
              en: "Let's interpret the lab results" 
            },
            whyNeeded: {
              he: 'לקבל פירוש מקצועי ומיידי של תוצאות בדיקות מעבדה עם התראות על ערכים חריגים',
              en: 'Get professional and immediate interpretation of lab results with alerts for abnormal values'
            }
          },
          
          // Medical History Functions
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
          
          // Lab Results Functions
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
            }
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
          
          // Medication Functions
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
            }
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
          
          // Vital Signs Functions
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
            }
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
          
          // Prescription Functions
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
            }
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
          }
        }
      },

      // ========== DOCUMENT MANAGEMENT & AI ANALYSIS (60+ functions) ==========
      documentManagement: {
        category: { he: 'ניהול מסמכים', en: 'Document Management' },
        icon: '📄',
        description: { 
          he: 'מערכת חכמה לעיבוד, ניתוח ואחסון מסמכים רפואיים',
          en: 'Smart system for processing, analyzing and storing medical documents'
        },
        functions: {
          retrievePendingUpload: {
            name: { he: 'אחזור קובץ שהועלה', en: 'Retrieve Uploaded File' },
            contextualTitle: { 
              he: 'מאחזר את הקובץ שהעלית', 
              en: "Retrieving your uploaded file" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'אחזור וטעינת הקובץ שהועלה לצורך עיבוד וניתוח. המערכת תזהה את סוג הקובץ ותכין אותו לעיבוד.'
                : 'Retrieving and loading the uploaded file for processing and analysis. The system will identify the file type and prepare it for processing.';
            },
            whyNeeded: {
              he: 'נדרש כדי לגשת לתוכן הקובץ שהועלה ולהכין אותו לניתוח.',
              en: 'Required to access the uploaded file content and prepare it for analysis.'
            }
          },
          previewPendingDocument: {
            name: { he: 'הצג מידע על מסמך', en: 'Preview Document Info' },
            contextualTitle: {
              he: 'בודק מה הועלה',
              en: "Checking what was uploaded"
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew
                ? 'הצגת מידע בסיסי על הקובץ שהועלה (שם, גודל, סוג) ללא עיבוד.'
                : 'Shows basic info about the uploaded file (name, size, type) without processing.';
            },
            whyNeeded: {
              he: 'לראות מה הועלה לפני עיבוד.',
              en: 'To see what was uploaded before processing.'
            }
          },
          analyzeDocument: {
            name: { he: 'ניתוח מסמך רפואי', en: 'Medical Document Analysis' },
            contextualTitle: { 
              he: 'בואו נבין מה כתוב במסמך', 
              en: "Let's understand what's in the document" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'ניתוח AI של מסמכים רפואיים - מבדיקות דם ועד תמונות רנטגן'
                : 'AI analysis of medical documents - from blood tests to X-ray images';
            },
            whyNeeded: {
              he: 'לחלץ מידע רפואי חשוב במהירות ובדיוק, לזהות דברים שעלולים להתפספס',
              en: 'To extract important medical information quickly and accurately, identify things that might be missed'
            },
            documentTypes: {
              he: [
                '🩸 בדיקות דם ושתן',
                '📊 דוחות CT ו-MRI',
                '🫀 EKG ובדיקות לב',
                '📋 מכתבי שחרור',
                '💊 מרשמים רפואיים',
                '🔬 ביופסיות ופתולוגיה',
                '📷 תמונות רנטגן'
              ],
              en: [
                '🩸 Blood and urine tests',
                '📊 CT and MRI reports',
                '🫀 EKG and cardiac tests',
                '📋 Discharge summaries',
                '💊 Medical prescriptions',
                '🔬 Biopsies and pathology',
                '📷 X-ray images'
              ]
            }
          },
          
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

          documentSearch: {
            name: { he: 'חיפוש במסמכים', en: 'Document Search' },
            contextualTitle: { 
              he: 'בואו נמצא את המסמך הספציפי', 
              en: "Let's find the specific document" 
            },
            whyNeeded: {
              he: 'למצוא במהירות מסמכים רלוונטיים מתוך אלפי קבצים',
              en: 'Quickly find relevant documents from thousands of files'
            }
          }
        }
      },

      // ========== APPOINTMENT & SCHEDULING (45+ functions) ==========
      appointmentScheduling: {
        category: { he: 'תורים ותזמונים', en: 'Appointments & Scheduling' },
        icon: '📅',
        description: { 
          he: 'מערכת תורים חכמה עם אופטימיזציה אוטומטית',
          en: 'Smart appointment system with automatic optimization'
        },
        functions: {
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
          
          appointmentReminders: {
            name: { he: 'תזכורות תורים', en: 'Appointment Reminders' },
            contextualTitle: { 
              he: 'נוודא שהמטופל לא ישכח', 
              en: "Let's make sure the patient doesn't forget" 
            },
            whyNeeded: {
              he: 'להפחית אי-הגעות ולשפר את התרומה למטופלים',
              en: 'To reduce no-shows and improve patient care'
            }
          },
          
          updateAppointment: {
            name: { he: 'עדכון תור', en: 'Update Appointment' },
            contextualTitle: { 
              he: 'בואו נעדכן את פרטי התור', 
              en: "Let's update the appointment details" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עדכון פרטי תור קיים - שעה, מיקום, סיבת ביקור או רופא מטפל'
                : 'Update existing appointment - time, location, reason or provider';
            },
            whyNeeded: {
              he: 'לשמור על מידע מעודכן ומדויק של תורים',
              en: 'To keep appointment information up-to-date and accurate'
            }
          },
          
          rescheduleAppointment: {
            name: { he: 'דחיית תור', en: 'Reschedule Appointment' },
            contextualTitle: { 
              he: 'בואו נמצא זמן חדש לתור', 
              en: "Let's find a new time for the appointment" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'העברת תור לזמן חדש עם שמירת כל הפרטים'
                : 'Move appointment to new time while preserving all details';
            },
            whyNeeded: {
              he: 'לאפשר גמישות במקרה של שינויים בזמינות',
              en: 'To allow flexibility when availability changes'
            }
          },
          
          createAppointment: {
            name: { he: 'יצירת תור חדש', en: 'Create New Appointment' },
            contextualTitle: { 
              he: 'בואו ניצור תור חדש במערכת', 
              en: "Let's create a new appointment in the system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'יצירת תור חדש עם כל הפרטים הנדרשים'
                : 'Create new appointment with all required details';
            },
            whyNeeded: {
              he: 'לתעד ולנהל את כל התורים במערכת אחת',
              en: 'To document and manage all appointments in one system'
            }
          },
          
          getAppointments: {
            name: { he: 'רשימת תורים', en: 'Appointment List' },
            contextualTitle: { 
              he: 'בואו נראה את כל התורים', 
              en: "Let's see all appointments" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'צפייה בכל התורים של המטופל או הרופא'
                : 'View all appointments for patient or provider';
            },
            whyNeeded: {
              he: 'לקבל תמונה מלאה של לוח הזמנים',
              en: 'To get a complete view of the schedule'
            }
          },
          
          getTodayAppointments: {
            name: { he: 'תורים להיום', en: "Today's Appointments" },
            contextualTitle: { 
              he: 'בואו נראה את התורים להיום', 
              en: "Let's see today's appointments" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'רשימת כל התורים המתוכננים להיום'
                : 'List of all appointments scheduled for today';
            },
            whyNeeded: {
              he: 'לנהל את סדר היום ולהתכונן לביקורים',
              en: 'To manage daily schedule and prepare for visits'
            }
          },
          
          getOverdueAppointments: {
            name: { he: 'תורים שפוספסו', en: 'Overdue Appointments' },
            contextualTitle: { 
              he: 'בואו נבדוק תורים שלא התקיימו', 
              en: "Let's check missed appointments" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'זיהוי תורים שעברו ללא הגעה או ביצוע'
                : 'Identify appointments that passed without attendance or completion';
            },
            whyNeeded: {
              he: 'למעקב אחר אי-הגעות ותזמון מחדש',
              en: 'To track no-shows and reschedule as needed'
            }
          },
          
          scheduleReminder: {
            name: { he: 'הגדרת תזכורת', en: 'Set Reminder' },
            contextualTitle: { 
              he: 'בואו נגדיר תזכורת אוטומטית', 
              en: "Let's set an automatic reminder" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הגדרת תזכורת אוטומטית לתור או משימה'
                : 'Set automatic reminder for appointment or task';
            },
            whyNeeded: {
              he: 'להפחית אי-הגעות ולשפר את ההיענות',
              en: 'To reduce no-shows and improve compliance'
            }
          },
          
          sendAppointmentConfirmationRequest: {
            name: { he: 'בקשת אישור הגעה', en: 'Request Appointment Confirmation' },
            contextualTitle: { 
              he: 'בואו נבקש אישור הגעה מהמטופל', 
              en: "Let's request confirmation from the patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת בקשה למטופל לאשר הגעה לתור'
                : 'Send request to patient to confirm appointment attendance';
            },
            whyNeeded: {
              he: 'לוודא הגעה ולאפשר ביטול מוקדם אם צריך',
              en: 'To ensure attendance and allow early cancellation if needed'
            }
          },
          
          schedulePatientAppointment: {
            name: { he: 'תיאום תור למטופל', en: 'Schedule Patient Appointment' },
            contextualTitle: { 
              he: 'בואו נתאם תור עבור המטופל', 
              en: "Let's coordinate an appointment for the patient" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיאום תור ספציפי למטופל עם התאמה לצרכיו'
                : 'Schedule specific appointment for patient tailored to their needs';
            },
            whyNeeded: {
              he: 'לספק שירות מותאם אישית לכל מטופל',
              en: 'To provide personalized service for each patient'
            }
          },
          
          scheduleComplianceAudit: {
            name: { he: 'תזמון ביקורת תאימות', en: 'Schedule Compliance Audit' },
            contextualTitle: { 
              he: 'בואו נתזמן ביקורת תאימות', 
              en: "Let's schedule a compliance audit" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תזמון ביקורת תאימות לרגולציה ונהלים'
                : 'Schedule audit for regulatory compliance and procedures';
            },
            whyNeeded: {
              he: 'לעמוד בדרישות רגולטוריות ולשמור על איכות',
              en: 'To meet regulatory requirements and maintain quality'
            }
          },
          
          scheduleBackup: {
            name: { he: 'תזמון גיבוי', en: 'Schedule Backup' },
            contextualTitle: { 
              he: 'בואו נתזמן גיבוי אוטומטי', 
              en: "Let's schedule automatic backup" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הגדרת גיבוי אוטומטי למידע קריטי'
                : 'Set up automatic backup for critical data';
            },
            whyNeeded: {
              he: 'להגן על המידע הרפואי מפני אובדן',
              en: 'To protect medical data from loss'
            }
          },
          
          scheduleDoctorMeeting: {
            name: { he: 'תיאום פגישת צוות', en: 'Schedule Doctor Meeting' },
            contextualTitle: { 
              he: 'בואו נתאם פגישת צוות רפואי', 
              en: "Let's schedule a medical team meeting" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תיאום פגישה בין אנשי הצוות הרפואי'
                : 'Coordinate meeting between medical staff members';
            },
            whyNeeded: {
              he: 'לתיאום טיפול ושיתוף פעולה בין הצוות',
              en: 'For care coordination and team collaboration'
            }
          },
          
          getDoctorAppointments: {
            name: { he: 'תורים של רופא', en: 'Doctor Appointments' },
            contextualTitle: {
              he: 'בואו נראה את לוח הזמנים של הרופא',
              en: "Let's see the doctor's schedule"
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew
                ? 'צפייה בכל התורים של רופא ספציפי'
                : "View all appointments for a specific doctor";
            },
            whyNeeded: {
              he: 'לנהל את לוח הזמנים של הצוות הרפואי',
              en: 'To manage medical staff scheduling'
            }
          },
          
          scheduleTraining: {
            name: { he: 'תזמון הדרכה', en: 'Schedule Training' },
            contextualTitle: { 
              he: 'בואו נתזמן הדרכה לצוות', 
              en: "Let's schedule staff training" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'תזמון הדרכות והשתלמויות לצוות הרפואי'
                : 'Schedule training and education sessions for medical staff';
            },
            whyNeeded: {
              he: 'לשמור על רמה מקצועית גבוהה ועדכנית',
              en: 'To maintain high and current professional standards'
            }
          }
        }
      },

      // ========== BILLING & INSURANCE (35+ functions) ==========
      billingInsurance: {
        category: { he: 'חיוב וביטוח', en: 'Billing & Insurance' },
        icon: '💰',
        description: { 
          he: 'ניהול חשבוניות וביטוח עם אוטומציה מלאה',
          en: 'Invoice and insurance management with full automation'
        },
        functions: {
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

          insuranceVerification: {
            name: { he: 'אימות ביטוח', en: 'Insurance Verification' },
            contextualTitle: { 
              he: 'בואו נוודא שהביטוח תקף', 
              en: "Let's verify the insurance is valid" 
            },
            whyNeeded: {
              he: 'להימנע מבעיות תשלום ולוודא שהמטופל מכוסה',
              en: 'To avoid payment issues and ensure the patient is covered'
            }
          }
        }
      },

      // ========== COMMUNICATION & NOTIFICATIONS (40+ functions) ==========
      communication: {
        category: { he: 'תקשורת והתראות', en: 'Communication & Notifications' },
        icon: '📱',
        description: { 
          he: 'מערכת תקשורת מתקדמת עם מטופלים ואנשי צוות',
          en: 'Advanced communication system with patients and staff'
        },
        functions: {
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

          sendMessage: {
            name: { he: 'שליחת הודעה', en: 'Send Message' },
            contextualTitle: { 
              he: 'בואו ניצור קשר עם המטופל', 
              en: "Let's contact the patient" 
            },
            whyNeeded: {
              he: 'לתקשר באופן מאובטח ומקצועי עם מטופלים',
              en: 'To communicate securely and professionally with patients'
            }
          }
        }
      },

      // ========== REPORTING & ANALYTICS (50+ functions) ==========
      reportingAnalytics: {
        category: { he: 'דוחות וניתוחים', en: 'Reporting & Analytics' },
        icon: '📊',
        description: { 
          he: 'דוחות מתקדמים וניתוח נתונים עם תובנות AI',
          en: 'Advanced reports and data analysis with AI insights'
        },
        functions: {
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

          generatePracticeReport: {
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

          getPracticeStatistics: {
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

          generateReport: {
            name: { he: 'יצירת דוח', en: 'Generate Report' },
            contextualTitle: { 
              he: 'בואו נכין דוח מקצועי', 
              en: "Let's create a professional report" 
            },
            whyNeeded: {
              he: 'לקבל תמונה ברורה של הביצועים ושל מצב המטופלים',
              en: 'To get a clear picture of performance and patient status'
            }
          }
        }
      },

      // ========== COMPLIANCE & SECURITY (30+ functions) ==========
      complianceSecurity: {
        category: { he: 'ציות ואבטחה', en: 'Compliance & Security' },
        icon: '🔒',
        description: { 
          he: 'כלים להבטחת ציות לתקנות HIPAA וMOH',
          en: 'Tools to ensure HIPAA and MOH regulatory compliance'
        },
        functions: {
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

          auditLog: {
            name: { he: 'רישום פעולות', en: 'Audit Log' },
            contextualTitle: { 
              he: 'מעקב אחר כל הפעולות במערכת', 
              en: "Track all system activities" 
            },
            whyNeeded: {
              he: 'לעמוד בדרישות ציות ולשמור על שקיפות',
              en: 'To meet compliance requirements and maintain transparency'
            }
          }
        }
      },

      // ========== USER MANAGEMENT & SYSTEM ADMIN (25+ functions) ==========
      userManagement: {
        category: { he: 'ניהול משתמשים', en: 'User Management' },
        icon: '👥',
        description: { 
          he: 'ניהול חשבונות משתמש, הרשאות ותפקידים במערכת',
          en: 'Manage user accounts, permissions and roles in the system'
        },
        functions: {
          createUser: {
            name: { he: 'יצירת משתמש חדש', en: 'Create New User' },
            contextualTitle: { 
              he: 'בואו נוסיף משתמש חדש למערכת', 
              en: "Let's add a new user to the system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              const userCount = context.userCount || 0;
              
              return isHebrew 
                ? userCount > 0
                  ? `הוספת משתמש נוסף למערכת (כבר יש לך ${userCount} משתמשים)`
                  : 'הוספת המשתמש הראשון שלך למערכת - התחלה נהדרת!'
                : userCount > 0
                  ? `Add another user to your system (you have ${userCount} users)`
                  : 'Add your first user to the system - great start!';
            },
            whyNeeded: {
              he: 'כדי לאפשר לצוות הרפואי נוסף לגשת למערכת ולעבוד עם מטופלים',
              en: 'To allow additional medical staff to access the system and work with patients'
            },
            triggers: ['create user', 'add user', 'new user', 'user management', 'צור משתמש', 'הוסף משתמש', 'משתמש חדש', 'ניהול משתמשים'],
            steps: {
              he: [
                '1. 📧 הזנת כתובת אימייל של המשתמש החדש',
                '2. 👤 הוספת פרטים אישיים (שם פרטי ומשפחה)',
                '3. 🏷️ בחירת תפקיד מתאים (מנהל, רופא, אחות או משתמש)',
                '4. 🔐 הגדרת הרשאות וגישות למערכת',
                '5. ✉️ שליחת אימייל הזמנה למשתמש החדש'
              ],
              en: [
                '1. 📧 Enter the new user\'s email address',
                '2. 👤 Add personal details (first and last name)',
                '3. 🏷️ Choose appropriate role (admin, doctor, nurse or user)',
                '4. 🔐 Set permissions and system access',
                '5. ✉️ Send invitation email to new user'
              ]
            },
            quickActions: {
              he: [
                { text: '⚡ התחל הוספת משתמש', action: 'create new user' },
                { text: '👨‍⚕️ הוסף רופא', action: 'add doctor user' },
                { text: '👩‍⚕️ הוסף אחות', action: 'add nurse user' },
                { text: '🙍 הוסף משתמש בסיסי', action: 'add user' }
              ],
              en: [
                { text: '⚡ Start adding user', action: 'create new user' },
                { text: '👨‍⚕️ Add doctor', action: 'add doctor user' },
                { text: '👩‍⚕️ Add nurse', action: 'add nurse user' },
                { text: '🙍 Add basic user', action: 'add user' }
              ]
            },
            contextualTips: (context) => {
              const isHebrew = context.language === 'he';
              const tips = [];
              
              if (context.userRole === 'admin') {
                tips.push(isHebrew 
                  ? '✅ יש לך הרשאות מנהל - אתה יכול ליצור משתמשים חדשים'
                  : '✅ You have admin permissions - you can create new users');
              }
              
              if (context.isFirstUser) {
                tips.push(isHebrew 
                  ? '💡 זה המשתמש הראשון שלך - בחר תפקיד מתאים לצוות'
                  : '💡 This is your first user - choose appropriate role for your team');
              }
              
              return tips;
            }
          },
          
          manageUsers: {
            name: { he: 'ניהול משתמשים', en: 'Manage Users' },
            contextualTitle: { 
              he: 'בואו ננהל את המשתמשים במערכת', 
              en: "Let's manage the users in the system" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'צפייה ועריכה של כל המשתמשים במערכת - תפקידים, הרשאות וסטטוס'
                : 'View and edit all system users - roles, permissions and status';
            },
            whyNeeded: {
              he: 'לשלוט במי יש גישה למערכת ואילו הרשאות יש לכל משתמש',
              en: 'To control who has access to the system and what permissions each user has'
            },
            triggers: ['manage users', 'user management', 'edit users', 'ניהול משתמשים', 'עריכת משתמשים', 'רשימת משתמשים'],
            steps: {
              he: [
                '1. 👀 צפייה ברשימת כל המשתמשים',
                '2. ✏️ עריכת פרטים או תפקידים',
                '3. 🔒 שינוי הרשאות גישה',
                '4. ❌ השבתה או הפעלה של משתמשים'
              ],
              en: [
                '1. 👀 View list of all users',
                '2. ✏️ Edit details or roles',
                '3. 🔒 Change access permissions',
                '4. ❌ Enable or disable users'
              ]
            }
          },
          
          updateUserRole: {
            name: { he: 'עדכון תפקיד משתמש', en: 'Update User Role' },
            contextualTitle: { 
              he: 'בואו נשנה את תפקיד המשתמש', 
              en: "Let's change the user's role" 
            },
            whyNeeded: {
              he: 'כאשר משתמש מקבל תפקיד חדש או צריך הרשאות שונות',
              en: 'When a user gets a new role or needs different permissions'
            },
            triggers: ['update role', 'change role', 'user role', 'עדכון תפקיד', 'שינוי תפקיד', 'תפקיד משתמש'],
            availableRoles: {
              he: [
                '👑 מנהל - גישה מלאה לכל וניהול המשתמשים',
                '👨‍⚕️ רופא - טיפול במטופלים, ניתן לקבוע לו תורים',
                '👩‍⚕️ אחות - תיעוד קליני, ניתן לקבוע לה תורים',
                '🙍 משתמש - גישה בסיסית (צפייה במטופלים וקביעת תורים)'
              ],
              en: [
                '👑 Admin - Full system access & user management',
                '👨‍⚕️ Doctor - Patient treatment, can be scheduled',
                '👩‍⚕️ Nurse - Clinical documentation, can be scheduled',
                '🙍 User - Basic access (view patients & book appointments)'
              ]
            }
          },
          
          userPermissions: {
            name: { he: 'הרשאות משתמש', en: 'User Permissions' },
            contextualTitle: { 
              he: 'בואו נבדוק את ההרשאות', 
              en: "Let's check the permissions" 
            },
            whyNeeded: {
              he: 'לוודא שכל משתמש יכול לגשת בדיוק למה שהוא צריך',
              en: 'To ensure each user can access exactly what they need'
            }
          },
          
          updateUserPermissions: {
            name: { he: 'עדכון הרשאות משתמש', en: 'Update User Permissions' },
            contextualTitle: { 
              he: 'בואו נעדכן את ההרשאות של המשתמש', 
              en: "Let's update the user's permissions" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שינוי הרשאות גישה ופעולות שמשתמש יכול לבצע במערכת'
                : 'Change access permissions and actions a user can perform in the system';
            },
            whyNeeded: {
              he: 'להתאים את רמת הגישה לתפקיד ולצרכים המשתנים',
              en: 'To adjust access level to role and changing needs'
            }
          },
          
          deactivateUser: {
            name: { he: 'השבתת משתמש', en: 'Deactivate User' },
            contextualTitle: { 
              he: 'בואו נשבית את חשבון המשתמש', 
              en: "Let's deactivate the user account" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'השבתה זמנית של חשבון משתמש מבלי למחוק את הנתונים'
                : 'Temporarily disable user account without deleting data';
            },
            whyNeeded: {
              he: 'להשעות גישה זמנית בלי לאבד היסטוריה ונתונים',
              en: 'To suspend access temporarily without losing history and data'
            }
          },
          
          deleteUser: {
            name: { he: 'מחיקת משתמש', en: 'Delete User' },
            contextualTitle: { 
              he: 'בואו נמחק את המשתמש לצמיתות', 
              en: "Let's permanently delete the user" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? '⚠️ מחיקה לצמיתות של משתמש מהמערכת - פעולה בלתי הפיכה'
                : '⚠️ Permanently delete user from system - irreversible action';
            },
            whyNeeded: {
              he: 'להסיר לחלוטין משתמשים שכבר לא רלוונטיים',
              en: 'To completely remove users who are no longer relevant'
            }
          },
          
          resetUserPassword: {
            name: { he: 'איפוס סיסמה', en: 'Reset Password' },
            contextualTitle: { 
              he: 'בואו נאפס את הסיסמה של המשתמש', 
              en: "Let's reset the user's password" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'שליחת קישור לאיפוס סיסמה למשתמש באימייל'
                : 'Send password reset link to user via email';
            },
            whyNeeded: {
              he: 'לעזור למשתמשים שכחו סיסמה או נחסמו',
              en: 'To help users who forgot password or got locked out'
            }
          },
          
          getRoles: {
            name: { he: 'רשימת תפקידים', en: 'Role List' },
            contextualTitle: { 
              he: 'בואו נראה את כל התפקידים במערכת', 
              en: "Let's see all system roles" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'צפייה בכל התפקידים הזמינים וההרשאות שלהם'
                : 'View all available roles and their permissions';
            },
            whyNeeded: {
              he: 'להבין את המבנה הארגוני ומה כל תפקיד יכול לעשות',
              en: 'To understand organizational structure and what each role can do'
            }
          },
          
          getUserPermissions: {
            name: { he: 'בדיקת הרשאות', en: 'Check Permissions' },
            contextualTitle: { 
              he: 'בואו נבדוק מה המשתמש יכול לעשות', 
              en: "Let's check what the user can do" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'בדיקה מפורטת של כל ההרשאות והגישות של משתמש ספציפי'
                : 'Detailed check of all permissions and access for specific user';
            },
            whyNeeded: {
              he: 'לפתרון בעיות גישה ואימות הרשאות',
              en: 'For troubleshooting access issues and verifying permissions'
            }
          },
          
          assignRole: {
            name: { he: 'הקצאת תפקיד', en: 'Assign Role' },
            contextualTitle: { 
              he: 'בואו נקצה תפקיד למשתמש', 
              en: "Let's assign a role to the user" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'הקצאת תפקיד חדש למשתמש - מנהל, רופא, אחות או משתמש'
                : 'Assign new role to user - admin, doctor, nurse or user';
            },
            whyNeeded: {
              he: 'לקבוע את רמת הגישה והאחריות של המשתמש',
              en: 'To set user access level and responsibilities'
            }
          },
          
          getAllUsers: {
            name: { he: 'כל המשתמשים', en: 'All Users' },
            contextualTitle: { 
              he: 'בואו נראה את כל המשתמשים', 
              en: "Let's see all users" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'רשימה מלאה של כל המשתמשים במערכת עם פרטיהם'
                : 'Complete list of all system users with their details';
            },
            whyNeeded: {
              he: 'לקבל סקירה כללית של כל הצוות במערכת',
              en: 'To get an overview of all team members in the system'
            }
          },
          
          searchUsers: {
            name: { he: 'חיפוש משתמשים', en: 'Search Users' },
            contextualTitle: { 
              he: 'בואו נחפש משתמש ספציפי', 
              en: "Let's search for a specific user" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'חיפוש משתמשים לפי שם, אימייל, תפקיד או כל פרט אחר'
                : 'Search users by name, email, role or any other detail';
            },
            whyNeeded: {
              he: 'למצוא במהירות משתמש ספציפי מתוך רשימה גדולה',
              en: 'To quickly find specific user from a large list'
            }
          },
          
          setupUserAsDoctor: {
            name: { he: 'הגדרת משתמש כרופא', en: 'Setup User as Doctor' },
            contextualTitle: {
              he: 'בואו נהפוך את המשתמש לרופא',
              en: "Let's make the user a doctor"
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew
                ? 'הגדרת משתמש כרופא עם לוח זמנים'
                : 'Set up a user as a doctor with a schedule';
            },
            whyNeeded: {
              he: 'לאפשר למשתמש לקבל תורים ולספק טיפול רפואי',
              en: 'To enable user to receive appointments and provide medical care'
            }
          },
          
          bulkUpdateRoles: {
            name: { he: 'עדכון תפקידים קבוצתי', en: 'Bulk Update Roles' },
            contextualTitle: { 
              he: 'בואו נעדכן תפקידים למספר משתמשים', 
              en: "Let's update roles for multiple users" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עדכון תפקידים למספר משתמשים בפעולה אחת'
                : 'Update roles for multiple users in one action';
            },
            whyNeeded: {
              he: 'לחסוך זמן בעדכון מספר רב של משתמשים',
              en: 'To save time when updating many users'
            }
          },
          
          getUserDetails: {
            name: { he: 'פרטי משתמש', en: 'User Details' },
            contextualTitle: { 
              he: 'בואו נראה את כל הפרטים של המשתמש', 
              en: "Let's see all user details" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'צפייה בפרטים מלאים של משתמש - פרופיל, הרשאות, היסטוריה'
                : 'View complete user details - profile, permissions, history';
            },
            whyNeeded: {
              he: 'לקבל תמונה מלאה על המשתמש ופעילותו',
              en: 'To get complete picture of user and their activity'
            }
          },
          
          updateUserProfile: {
            name: { he: 'עדכון פרופיל', en: 'Update Profile' },
            contextualTitle: { 
              he: 'בואו נעדכן את פרופיל המשתמש', 
              en: "Let's update the user profile" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'עדכון פרטים אישיים - שם, טלפון, תמונה, התמחות'
                : 'Update personal details - name, phone, photo, specialization';
            },
            whyNeeded: {
              he: 'לשמור על פרטים מעודכנים ומדויקים של הצוות',
              en: 'To keep team member details current and accurate'
            }
          },
          
          getUserActivity: {
            name: { he: 'פעילות משתמש', en: 'User Activity' },
            contextualTitle: { 
              he: 'בואו נראה מה המשתמש עשה לאחרונה', 
              en: "Let's see what the user did recently" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'צפייה בהיסטוריית פעולות ושימוש במערכת של המשתמש'
                : 'View user\'s action history and system usage';
            },
            whyNeeded: {
              he: 'למעקב אחר פעילות ואיתור בעיות שימוש',
              en: 'To track activity and identify usage issues'
            }
          },
          
          suspendUser: {
            name: { he: 'השעיית משתמש', en: 'Suspend User' },
            contextualTitle: { 
              he: 'בואו נשעה את המשתמש זמנית', 
              en: "Let's temporarily suspend the user" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'השעיה זמנית של גישת המשתמש למערכת'
                : 'Temporarily suspend user access to the system';
            },
            whyNeeded: {
              he: 'לחסום גישה זמנית בגלל חשד לפריצה או הפרת נהלים',
              en: 'To block temporary access due to security concerns or policy violations'
            }
          },
          
          reactivateUser: {
            name: { he: 'הפעלת משתמש מחדש', en: 'Reactivate User' },
            contextualTitle: { 
              he: 'בואו נפעיל מחדש את המשתמש', 
              en: "Let's reactivate the user" 
            },
            dynamicDescription: (context) => {
              const isHebrew = context.language === 'he';
              return isHebrew 
                ? 'החזרת גישה למשתמש שהושעה או הושבת'
                : 'Restore access for suspended or deactivated user';
            },
            whyNeeded: {
              he: 'להחזיר משתמש לפעילות אחרי פתרון הבעיה',
              en: 'To bring user back to activity after resolving the issue'
            }
          }
        }
      },

      // ========== INTEGRATIONS & APIs (40+ functions) ==========
      integrations: {
        category: { he: 'אינטגרציות', en: 'Integrations' },
        icon: '🔗',
        description: { 
          he: 'חיבורים למערכות חיצוניות ומעבדות',
          en: 'Connections to external systems and laboratories'
        },
        functions: {
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
          },

          labIntegration: {
            name: { he: 'אינטגרציה למעבדה', en: 'Lab Integration' },
            contextualTitle: { 
              he: 'חיבור אוטומטי לתוצאות מעבדה', 
              en: "Automatic connection to lab results" 
            },
            whyNeeded: {
              he: 'לקבל תוצאות בדיקות אוטומטית ללא טעויות הזנה',
              en: 'To receive test results automatically without input errors'
            }
          }
        }
      }
    };
  }

  /**
   * Get dynamic, contextual help based on current chat state
   */
  getContextualHelp(message, chatState, userContext) {
    const context = this.buildContext(message, chatState, userContext);
    const detectedFunctions = this.detectFunctions(message, context);
    
    return {
      detectedFunctions,
      primaryFunction: detectedFunctions[0] || null,
      contextualTooltip: this.generateContextualTooltip(detectedFunctions[0], context),
      suggestedActions: this.getSuggestedActions(context),
      dynamicTips: this.getDynamicTips(context)
    };
  }

  /**
   * Build comprehensive context from chat state and user info
   */
  buildContext(message, chatState, userContext) {
    return {
      language: userContext?.language || 'en',
      currentPatient: chatState?.currentPatient || null,
      patientCount: chatState?.patientCount || 0,
      userCount: chatState?.userCount || 0,
      recentActions: chatState?.recentActions || [],
      userRole: userContext?.role || userContext?.roles?.[0] || 'doctor',
      practiceType: userContext?.practiceType || 'general',
      isFirstPatient: chatState?.patientCount === 0,
      isFirstUser: chatState?.userCount === 0,
      hasIncompletePatients: chatState?.incompletePatients > 0,
      currentMessage: message,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      urgentTasks: chatState?.urgentTasks || [],
      lastActivity: chatState?.lastActivity || null
    };
  }

  /**
   * Detect functions from message with AI-powered understanding
   */
  detectFunctions(message, context) {
    const messageLower = message.toLowerCase();
    const detectedFunctions = [];
    
    // Advanced pattern matching for different languages
    const patterns = {
      // USER MANAGEMENT PATTERNS
      createUser: [
        /create.*user|add.*user|new.*user|register.*user/i,
        /צור.*משתמש|הוסף.*משתמש|משתמש.*חדש|רישום.*משתמש/i,
        /user.*creation|add.*staff|new.*staff/i
      ],
      manageUsers: [
        /manage.*user|user.*management|edit.*user|list.*user/i,
        /ניהול.*משתמש|משתמשים|עריכת.*משתמש|רשימת.*משתמש/i,
        /staff.*management|team.*management/i
      ],
      updateUserRole: [
        /update.*role|change.*role|user.*role|assign.*role/i,
        /עדכון.*תפקיד|שינוי.*תפקיד|תפקיד.*משתמש|הקצאת.*תפקיד/i,
        /role.*management|permission.*change/i
      ],
      userPermissions: [
        /user.*permission|permission|access.*control|user.*access/i,
        /הרשאות.*משתמש|הרשאות|בקרת.*גישה|גישות.*משתמש/i,
        /security.*setting|access.*level/i
      ],
      
      // PATIENT MANAGEMENT PATTERNS  
      addPatient: [
        /add.*patient|new.*patient|register.*patient/i,
        /הוסף.*מטופל|מטופל.*חדש|רישום.*מטופל/i,
        /create.*patient|patient.*registration/i
      ],
      searchPatients: [
        /search.*patient|find.*patient|locate.*patient/i,
        /חפש.*מטופל|מצא.*מטופל|איתור.*מטופל/i,
        /where.*is|show.*me.*patient/i
      ],
      analyzeSymptoms: [
        /symptom|diagnose|analyze.*health/i,
        /סימפטום|אבחון|בדיקה.*רפואית/i,
        /patient.*complain|health.*issue/i
      ],
      analyzeDocument: [
        /analyze.*document|upload.*file|document.*analysis/i,
        /נתח.*מסמך|העלה.*קובץ|ניתוח.*מסמך/i,
        /lab.*result|test.*result|medical.*report/i
      ],
      scheduleAppointment: [
        /schedule.*appointment|book.*appointment|set.*appointment/i,
        /קבע.*תור|זמן.*פגישה|תור.*חדש/i,
        /appointment.*for|meeting.*with/i
      ]
    };

    // Check each pattern
    for (const [functionKey, functionPatterns] of Object.entries(patterns)) {
      for (const pattern of functionPatterns) {
        if (pattern.test(messageLower)) {
          detectedFunctions.push(functionKey);
          break;
        }
      }
    }

    // Context-based detection
    if (context.currentPatient && messageLower.includes('history')) {
      detectedFunctions.push('patientHistory');
    }

    if (messageLower.includes('remind') || messageLower.includes('notification')) {
      detectedFunctions.push('appointmentReminders');
    }

    return [...new Set(detectedFunctions)]; // Remove duplicates
  }

  /**
   * Generate contextual tooltip with dynamic content
   */
  generateContextualTooltip(functionKey, context) {
    if (!functionKey) return null;

    // Find function in database
    let functionData = null;
    let categoryData = null;

    for (const [catKey, category] of Object.entries(this.functionDatabase)) {
      if (category?.functions?.[functionKey]) {
        functionData = category.functions[functionKey];
        categoryData = category;
        break;
      }
    }

    if (!functionData) {
      console.warn(`Tooltip not found for function: ${functionKey}`);
      // Return a default tooltip for unknown functions
      return {
        id: functionKey,
        title: functionKey,
        description: `Function: ${functionKey}`,
        whyNeeded: '',
        steps: [],
        quickActions: [],
        contextualTips: [],
        category: 'General',
        categoryIcon: '🔧',
        urgency: 'medium',
        timeEstimate: '1-2 min',
        prerequisites: [],
        nextSteps: []
      };
    }

    const isHebrew = context?.language === 'he';
    const lang = isHebrew ? 'he' : 'en';

    // Ensure all properties exist with safe access
    const title = functionData?.contextualTitle?.[lang] || 
                  functionData?.name?.[lang] || 
                  functionKey;
    
    const description = typeof functionData?.dynamicDescription === 'function' 
        ? functionData.dynamicDescription(context)
        : (functionData?.description?.[lang] || '');
    
    const whyNeeded = functionData?.whyNeeded?.[lang] || '';
    const steps = functionData?.steps?.[lang] || [];
    const quickActions = functionData?.quickActions?.[lang] || [];
    const contextualTips = typeof functionData?.contextualTips === 'function'
        ? functionData.contextualTips(context)
        : [];
    const category = categoryData?.category?.[lang] || 'General';
    const categoryIcon = categoryData?.icon || '🔧';

    return {
      id: functionKey,
      title,
      description,
      whyNeeded,
      steps,
      quickActions,
      contextualTips,
      category,
      categoryIcon,
      urgency: this.calculateUrgency(functionKey, context),
      timeEstimate: this.getTimeEstimate(functionKey, context),
      prerequisites: this.getPrerequisites(functionKey, context),
      nextSteps: this.getNextSteps(functionKey, context)
    };
  }

  /**
   * Get suggested actions based on context and user role
   */
  getSuggestedActions(context) {
    const isHebrew = context.language === 'he';
    const suggestions = [];
    const userRole = context.userRole || 'doctor';

    // Role-based suggestions for ADMIN
    if (userRole === 'admin') {
      
      // First-time user setup
      if (context.isFirstUser) {
        suggestions.push({
          priority: 'high',
          icon: '👥',
          title: isHebrew ? 'הוסף צוות רפואי' : 'Add Medical Staff',
          action: 'create new user',
          description: isHebrew 
            ? 'הוסף את הצוות הרפואי הראשון שלך'
            : 'Add your first medical staff member'
        });
      }

      // User management suggestions
      suggestions.push({
        priority: 'medium',
        icon: '👨‍⚕️',
        title: isHebrew ? 'הוספת משתמש חדש' : 'Add new user',
        action: 'create new user',
        description: isHebrew 
          ? 'הוסף רופא, אחות או משתמש למערכת'
          : 'Add doctor, nurse or user to system'
      });

      suggestions.push({
        priority: 'medium', 
        icon: '⚙️',
        title: isHebrew ? 'ניהול משתמשים' : 'Manage users',
        action: 'manage users',
        description: isHebrew 
          ? 'עדכן תפקידים והרשאות של המשתמשים'
          : 'Update user roles and permissions'
      });

      // If there are patients but few users - suggest adding more staff
      if (context.patientCount > 10 && context.userCount < 3) {
        suggestions.push({
          priority: 'high',
          icon: '🚨',
          title: isHebrew ? 'הוסף עוד צוות' : 'Add more staff',
          action: 'create multiple users',
          description: isHebrew 
            ? `יש לך ${context.patientCount} מטופלים אבל רק ${context.userCount} משתמשים`
            : `You have ${context.patientCount} patients but only ${context.userCount} users`
        });
      }
    }

    // Role-based suggestions for ALL USERS
    // First-time patient suggestions
    if (context.isFirstPatient) {
      suggestions.push({
        priority: 'high',
        icon: '🎯',
        title: isHebrew ? 'הוסף מטופל ראשון' : 'Add first patient',
        action: 'add new patient',
        description: isHebrew 
          ? 'הוסף את המטופל הראשון שלך'
          : 'Add your first patient'
      });
    }

    // Patient management suggestions for medical roles
    if (['doctor', 'nurse', 'admin'].includes(userRole)) {
      suggestions.push({
        priority: 'medium',
        icon: '👥',
        title: isHebrew ? 'עדכון פרטי מטופל' : 'Update patient information',
        action: 'update patient information',
        description: isHebrew 
          ? 'עדכן מידע רפואי או פרטי קשר'
          : 'Update medical info or contact details'
      });

      suggestions.push({
        priority: 'medium',
        icon: '🔍',
        title: isHebrew ? 'חיפוש מטופלים' : 'Search patients by name...',
        action: 'search patients',
        description: isHebrew 
          ? 'מצא מטופל לפי שם, ת.ז או טלפון'
          : 'Find patient by name, ID or phone'
      });

      suggestions.push({
        priority: 'medium',
        icon: '📄',
        title: isHebrew ? 'ניתוח מסמך רפואי' : 'Analyze medical document',
        action: 'analyze medical document',
        description: isHebrew 
          ? 'העלה וניתח תוצאות בדיקות'
          : 'Upload and analyze test results'
      });
    }

    // Contextual suggestions based on time
    if (context.timeOfDay >= 8 && context.timeOfDay <= 10) {
      suggestions.push({
        priority: 'medium',
        icon: '🌅',
        title: isHebrew ? 'תורים של היום' : "Today's Appointments",
        action: 'show today appointments',
        description: isHebrew 
          ? 'בדוק את התורים להיום'
          : 'Check your appointments for today'
      });
    }

    // Urgent tasks (all roles)
    if (context.urgentTasks.length > 0) {
      suggestions.push({
        priority: 'high',
        icon: '🚨',
        title: isHebrew ? 'משימות דחופות' : 'Urgent Tasks',
        action: 'show urgent tasks',
        description: isHebrew 
          ? `יש לך ${context.urgentTasks.length} משימות דחופות`
          : `You have ${context.urgentTasks.length} urgent tasks`
      });
    }

    // Add "Monitoring functions..." at the end for all users
    suggestions.push({
      priority: 'low',
      icon: '⚙️',
      title: isHebrew ? 'מעקב אחר פונקציות...' : 'Monitoring functions...',
      action: 'show monitoring functions',
      description: isHebrew 
        ? 'בדוק סטטוס המערכת והפונקציות הפעילות'
        : 'Check system status and active functions'
    });

    return suggestions;
  }

  /**
   * Get dynamic tips based on context and usage patterns
   */
  getDynamicTips(context) {
    const isHebrew = context.language === 'he';
    const tips = [];

    // Usage-based tips
    const usage = this.functionUsageHistory;
    if (usage.has('addPatient') && !usage.has('searchPatients')) {
      tips.push({
        type: 'suggestion',
        icon: '💡',
        message: isHebrew 
          ? 'כדאי ללמוד כיצד לחפש מטופלים קיימים'
          : 'Consider learning how to search for existing patients'
      });
    }

    // Context-aware tips
    if (context.currentPatient && !context.lastActivity) {
      tips.push({
        type: 'reminder',
        icon: '📋',
        message: isHebrew 
          ? 'אולי כדאי להתחיל עם צפייה בהיסטוריה הרפואית'
          : 'You might want to start by viewing medical history'
      });
    }

    return tips;
  }

  /**
   * Calculate urgency level for a function
   */
  calculateUrgency(functionKey, context) {
    const urgencyMap = {
      // User Management urgencies
      createUser: context.isFirstUser ? 'high' : 'medium',
      manageUsers: (context.userCount > 5) ? 'high' : 'medium',
      updateUserRole: 'medium',
      userPermissions: 'medium',
      
      // Patient Management urgencies
      analyzeSymptoms: context.currentPatient ? 'high' : 'medium',
      addPatient: context.isFirstPatient ? 'high' : 'low',
      searchPatients: context.patientCount > 10 ? 'high' : 'medium'
    };
    
    return urgencyMap[functionKey] || 'medium';
  }

  /**
   * Get time estimate for completing a function
   */
  getTimeEstimate(functionKey, context) {
    const estimates = {
      // User Management estimates
      createUser: context.isFirstUser ? '3-5 min' : '2-3 min',
      manageUsers: '2-4 min',
      updateUserRole: '1-2 min',
      userPermissions: '2-3 min',
      
      // Patient Management estimates
      addPatient: context.isFirstPatient ? '5-10 min' : '3-5 min',
      searchPatients: '30 sec',
      analyzeSymptoms: '2-3 min',
      analyzeDocument: '1-2 min'
    };
    
    return estimates[functionKey] || '1-2 min';
  }

  /**
   * Get prerequisites for a function
   */
  getPrerequisites(functionKey, context) {
    const isHebrew = context.language === 'he';
    const prerequisites = {
      // User Management prerequisites
      createUser: isHebrew ? ['הרשאות מנהל או מנהל רפואי'] : ['Admin or Medical Director permissions'],
      manageUsers: isHebrew ? ['הרשאות מנהל או מנהל רפואי'] : ['Admin or Medical Director permissions'],
      updateUserRole: isHebrew ? ['הרשאות מנהל', 'בחר משתמש לעדכון'] : ['Admin permissions', 'Select user to update'],
      userPermissions: isHebrew ? ['הרשאות מנהל'] : ['Admin permissions'],
      
      // Patient Management prerequisites
      patientHistory: isHebrew ? ['בחר מטופל קודם'] : ['Select a patient first'],
      analyzeDocument: isHebrew ? ['העלה קובץ או מסמך'] : ['Upload a file or document'],
      scheduleAppointment: isHebrew ? ['בחר מטופל', 'בדוק זמינות'] : ['Select patient', 'Check availability']
    };
    
    return prerequisites[functionKey] || [];
  }

  /**
   * Get next steps after completing a function
   */
  getNextSteps(functionKey, context) {
    const isHebrew = context.language === 'he';
    const nextSteps = {
      // User Management next steps
      createUser: isHebrew 
        ? ['שלח אימייל הזמנה', 'הגדר הרשאות מפורטות', 'הדרך המשתמש החדש']
        : ['Send invitation email', 'Set detailed permissions', 'Guide new user'],
      manageUsers: isHebrew
        ? ['בדוק פעילות משתמשים', 'עדכן הרשאות לפי צורך', 'הסר משתמשים לא פעילים']
        : ['Check user activity', 'Update permissions as needed', 'Remove inactive users'],
      updateUserRole: isHebrew
        ? ['בדוק שהמשתמש יכול לגשת לכל הנדרש', 'עדכן צוות על השינוי']
        : ['Verify user can access everything needed', 'Update team about the change'],
      
      // Patient Management next steps  
      addPatient: isHebrew 
        ? ['הוסף היסטוריה רפואית', 'קבע תור ראשון', 'שלח הודעת ברוכים הבאים']
        : ['Add medical history', 'Schedule first appointment', 'Send welcome message'],
      analyzeSymptoms: isHebrew
        ? ['בדוק אינטראקציות תרופות', 'תזמן בדיקות נוספות', 'עדכן היסטוריה']
        : ['Check drug interactions', 'Schedule additional tests', 'Update history']
    };
    
    return nextSteps[functionKey] || [];
  }

  /**
   * Track function usage for learning
   */
  trackFunctionUsage(functionKey, context) {
    const current = this.functionUsageHistory.get(functionKey) || { count: 0, lastUsed: null };
    this.functionUsageHistory.set(functionKey, {
      count: current.count + 1,
      lastUsed: new Date(),
      context: context
    });
  }

  /**
   * Get smart function recommendations
   */
  getSmartRecommendations(context) {
    const isHebrew = context.language === 'he';
    const recommendations = [];

    // Analyze patterns
    const recentlyUsed = Array.from(this.functionUsageHistory.entries())
      .filter(([_, data]) => data.lastUsed && (Date.now() - data.lastUsed.getTime()) < 86400000) // Last 24h
      .sort(([_, a], [__, b]) => b.lastUsed - a.lastUsed);

    // Suggest complementary functions
    if (recentlyUsed.length > 0) {
      const lastFunction = recentlyUsed[0][0];
      const complementary = this.getComplementaryFunctions(lastFunction);
      
      recommendations.push(...complementary.map(func => ({
        functionKey: func,
        reason: isHebrew ? 'משלים לפעולה האחרונה' : 'Complements your last action',
        priority: 'medium'
      })));
    }

    return recommendations;
  }

  /**
   * Get functions that complement the given function
   */
  getComplementaryFunctions(functionKey) {
    const complementary = {
      addPatient: ['scheduleAppointment', 'patientHistory'],
      searchPatients: ['patientHistory', 'analyzeDocument'],
      analyzeSymptoms: ['drugInteractions', 'scheduleAppointment'],
      analyzeDocument: ['patientHistory', 'generateReport']
    };
    
    return complementary[functionKey] || [];
  }

  /**
   * Search functions across all categories
   */
  searchFunctions(query, language = 'en') {
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const [categoryKey, category] of Object.entries(this.functionDatabase)) {
      for (const [functionKey, functionData] of Object.entries(category.functions)) {
        const name = functionData.name[language]?.toLowerCase() || '';
        const description = functionData.whyNeeded[language]?.toLowerCase() || '';
        
        if (name.includes(queryLower) || description.includes(queryLower)) {
          results.push({
            functionKey,
            categoryKey,
            name: functionData.name[language],
            description: functionData.whyNeeded[language],
            category: category.category[language],
            icon: category.icon
          });
        }
      }
    }
    
    return results;
  }
}

// Create singleton instance
const platformFunctionHelpServiceV2 = new PlatformFunctionHelpServiceV2();

export default platformFunctionHelpServiceV2;