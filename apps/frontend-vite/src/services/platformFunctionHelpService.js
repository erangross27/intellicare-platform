/**
 * Platform Function Help Service
 * Provides detailed explanations and interactive help for all platform functions
 * Bilingual support (Hebrew/English) with contextual tooltips
 */

class PlatformFunctionHelpService {
  constructor() {
    this.currentFunction = null;
    this.helpHistory = [];
    this.activeTooltips = new Map();
  }

  /**
   * Get all platform functions with detailed help
   */
  getAllFunctionHelp(language = 'en') {
    const isHebrew = language === 'he';
    
    return {
      // ========== PATIENT MANAGEMENT ==========
      patientManagement: {
        category: isHebrew ? 'ניהול מטופלים' : 'Patient Management',
        icon: '👥',
        description: isHebrew 
          ? 'כלים לניהול מטופלים במערכת'
          : 'Tools for managing patients in the system',
        functions: {
          addPatient: {
            name: isHebrew ? 'הוספת מטופל' : 'Add Patient',
            trigger: isHebrew ? 'הוסף מטופל' : 'add patient',
            description: isHebrew 
              ? 'הוספת מטופל חדש למערכת עם כל הפרטים הנדרשים'
              : 'Add a new patient to the system with all required details',
            howToUse: isHebrew
              ? 'אמור "הוסף מטופל חדש" או "רשום מטופל" והמערכת תדריך אותך שלב אחר שלב'
              : 'Say "add new patient" or "register patient" and the system will guide you step by step',
            requiredInfo: isHebrew
              ? ['שם פרטי ומשפחה', 'תאריך לידה', 'תעודת זהות', 'טלפון', 'אימייל', 'כתובת', 'קופת חולים']
              : ['First and last name', 'Date of birth', 'National ID/SSN', 'Phone', 'Email', 'Address', 'Insurance'],
            examples: isHebrew
              ? [
                  'הוסף מטופל חדש בשם יוסי כהן',
                  'רשום מטופלת חדשה',
                  'צור כרטיס מטופל'
                ]
              : [
                  'Add new patient John Smith',
                  'Register a new patient',
                  'Create patient record'
                ],
            tips: isHebrew
              ? [
                  '💡 המערכת תבקש את כל הפרטים החסרים אוטומטית',
                  '💡 ניתן לומר את כל הפרטים בבת אחת או בשלבים',
                  '💡 המערכת תאמת את תעודת הזהות אוטומטית'
                ]
              : [
                  '💡 The system will automatically ask for missing details',
                  '💡 You can provide all details at once or step by step',
                  '💡 The system will validate the ID automatically'
                ]
          },
          
          searchPatients: {
            name: isHebrew ? 'חיפוש מטופלים' : 'Search Patients',
            trigger: isHebrew ? 'חפש מטופל' : 'search patient',
            description: isHebrew 
              ? 'חיפוש מטופלים לפי שם, תעודת זהות או פרטים אחרים'
              : 'Search for patients by name, ID, or other details',
            howToUse: isHebrew
              ? 'אמור "חפש מטופל" ואז את השם או תעודת הזהות'
              : 'Say "search patient" followed by name or ID',
            examples: isHebrew
              ? [
                  'חפש את יוסי כהן',
                  'מצא מטופל עם תעודת זהות 123456789',
                  'הצג את כל המטופלים בשם דוד'
                ]
              : [
                  'Find John Smith',
                  'Search patient with ID 123-45-6789',
                  'Show all patients named David'
                ],
            tips: isHebrew
              ? [
                  '💡 ניתן לחפש גם לפי שם חלקי',
                  '💡 החיפוש מציג עד 10 תוצאות',
                  '💡 ניתן לסנן לפי תאריך או סטטוס'
                ]
              : [
                  '💡 You can search with partial names',
                  '💡 Search shows up to 10 results',
                  '💡 You can filter by date or status'
                ]
          },
          
          updatePatient: {
            name: isHebrew ? 'עדכון פרטי מטופל' : 'Update Patient',
            trigger: isHebrew ? 'עדכן מטופל' : 'update patient',
            description: isHebrew 
              ? 'עדכון פרטים של מטופל קיים במערכת'
              : 'Update existing patient information',
            howToUse: isHebrew
              ? 'אמור "עדכן את הטלפון של יוסי כהן ל-0501234567"'
              : 'Say "update John Smith\'s phone to 555-1234"',
            examples: isHebrew
              ? [
                  'עדכן את הכתובת של יוסי כהן',
                  'שנה את האימייל של המטופל',
                  'עדכן קופת חולים למכבי'
                ]
              : [
                  'Update John Smith\'s address',
                  'Change patient email',
                  'Update insurance to Blue Cross'
                ],
            tips: isHebrew
              ? [
                  '💡 המערכת תמצא את המטופל אוטומטית לפי השם',
                  '💡 ניתן לעדכן מספר שדות בבת אחת',
                  '💡 כל השינויים נשמרים בהיסטוריה'
                ]
              : [
                  '💡 System will find patient automatically by name',
                  '💡 You can update multiple fields at once',
                  '💡 All changes are saved in history'
                ]
          },
          
          deletePatient: {
            name: isHebrew ? 'מחיקת מטופל' : 'Delete Patient',
            trigger: isHebrew ? 'מחק מטופל' : 'delete patient',
            description: isHebrew 
              ? 'מחיקת מטופל מהמערכת (דורש אישור)'
              : 'Delete patient from system (requires confirmation)',
            howToUse: isHebrew
              ? 'אמור "מחק את יוסי כהן" והמערכת תבקש אישור'
              : 'Say "delete John Smith" and system will ask for confirmation',
            examples: isHebrew
              ? [
                  'מחק את המטופל יוסי כהן',
                  'הסר מטופל עם תעודת זהות 123456789'
                ]
              : [
                  'Delete patient John Smith',
                  'Remove patient with ID 123-45-6789'
                ],
            warnings: isHebrew
              ? [
                  '⚠️ פעולה זו בלתי הפיכה',
                  '⚠️ כל המסמכים וההיסטוריה יימחקו',
                  '⚠️ נדרש אישור כפול למחיקה'
                ]
              : [
                  '⚠️ This action cannot be undone',
                  '⚠️ All documents and history will be deleted',
                  '⚠️ Double confirmation required'
                ]
          }
        }
      },

      // ========== MEDICAL HISTORY ==========
      medicalHistory: {
        category: isHebrew ? 'היסטוריה רפואית' : 'Medical History',
        icon: '📋',
        description: isHebrew 
          ? 'ניהול היסטוריה רפואית ורשומות'
          : 'Manage medical history and records',
        functions: {
          getMedicalHistory: {
            name: isHebrew ? 'הצגת היסטוריה' : 'View History',
            trigger: isHebrew ? 'הצג היסטוריה' : 'show history',
            description: isHebrew 
              ? 'הצגת ההיסטוריה הרפואית המלאה של מטופל'
              : 'View complete medical history of a patient',
            howToUse: isHebrew
              ? 'אמור "הצג היסטוריה של יוסי כהן"'
              : 'Say "show history for John Smith"',
            examples: isHebrew
              ? [
                  'הצג היסטוריה רפואית של יוסי כהן',
                  'מה ההיסטוריה של המטופל מהשנה האחרונה',
                  'הראה ביקורים קודמים'
                ]
              : [
                  'Show medical history for John Smith',
                  'What is the patient history from last year',
                  'Display previous visits'
                ],
            tips: isHebrew
              ? [
                  '💡 ניתן לסנן לפי תאריכים',
                  '💡 ההיסטוריה כוללת אבחנות, טיפולים ותרופות',
                  '💡 ניתן לייצא להדפסה או PDF'
                ]
              : [
                  '💡 You can filter by dates',
                  '💡 History includes diagnoses, treatments and medications',
                  '💡 Can export to print or PDF'
                ]
          },
          
          addMedicalHistory: {
            name: isHebrew ? 'הוספת רשומה' : 'Add Entry',
            trigger: isHebrew ? 'הוסף להיסטוריה' : 'add to history',
            description: isHebrew 
              ? 'הוספת רשומה חדשה להיסטוריה הרפואית'
              : 'Add new entry to medical history',
            howToUse: isHebrew
              ? 'אמור "הוסף ביקור חדש ליוסי כהן - כאב ראש, נתתי אקמול"'
              : 'Say "add visit for John Smith - headache, prescribed Tylenol"',
            examples: isHebrew
              ? [
                  'הוסף אבחנה של שפעת',
                  'רשום טיפול שניתן היום',
                  'הוסף תרופה חדשה להיסטוריה'
                ]
              : [
                  'Add flu diagnosis',
                  'Record treatment given today',
                  'Add new medication to history'
                ],
            requiredInfo: isHebrew
              ? ['תאריך', 'אבחנה', 'טיפול (אופציונלי)', 'תרופות (אופציונלי)']
              : ['Date', 'Diagnosis', 'Treatment (optional)', 'Medications (optional)']
          }
        }
      },

      // ========== DOCUMENT MANAGEMENT ==========
      documentManagement: {
        category: isHebrew ? 'ניהול מסמכים' : 'Document Management',
        icon: '📄',
        description: isHebrew 
          ? 'העלאה, ניתוח וניהול מסמכים רפואיים'
          : 'Upload, analyze and manage medical documents',
        functions: {
          analyzeDocument: {
            name: isHebrew ? 'ניתוח מסמך' : 'Analyze Document',
            trigger: isHebrew ? 'נתח מסמך' : 'analyze document',
            description: isHebrew 
              ? 'ניתוח מסמך רפואי באמצעות AI וחילוץ מידע חשוב'
              : 'Analyze medical document with AI and extract important information',
            howToUse: isHebrew
              ? 'העלה קובץ ואמור "נתח את המסמך עבור יוסי כהן"'
              : 'Upload file and say "analyze document for John Smith"',
            supportedTypes: ['PDF', 'Images', 'Lab Results', 'Prescriptions', 'X-rays'],
            examples: isHebrew
              ? [
                  'נתח את בדיקת הדם שהעליתי',
                  'מה כתוב במרשם הזה',
                  'פענח את תוצאות הבדיקה'
                ]
              : [
                  'Analyze the blood test I uploaded',
                  'What does this prescription say',
                  'Decode the test results'
                ],
            features: isHebrew
              ? [
                  '🔍 זיהוי אוטומטי של סוג המסמך',
                  '🧠 חילוץ נתונים חכם עם AI',
                  '📊 השוואה לערכי נורמה',
                  '⚠️ התראות על ערכים חריגים'
                ]
              : [
                  '🔍 Automatic document type detection',
                  '🧠 Smart data extraction with AI',
                  '📊 Comparison to normal values',
                  '⚠️ Alerts for abnormal values'
                ]
          },
          
          getDocuments: {
            name: isHebrew ? 'הצגת מסמכים' : 'View Documents',
            trigger: isHebrew ? 'הצג מסמכים' : 'show documents',
            description: isHebrew 
              ? 'הצגת כל המסמכים של מטופל'
              : 'View all patient documents',
            howToUse: isHebrew
              ? 'אמור "הצג מסמכים של יוסי כהן"'
              : 'Say "show documents for John Smith"',
            examples: isHebrew
              ? [
                  'הראה את כל המסמכים',
                  'הצג בדיקות דם אחרונות',
                  'מה המרשמים הפעילים'
                ]
              : [
                  'Show all documents',
                  'Display recent blood tests',
                  'What are the active prescriptions'
                ],
            filters: isHebrew
              ? ['לפי סוג', 'לפי תאריך', 'לפי סטטוס']
              : ['By type', 'By date', 'By status']
          }
        }
      },

      // ========== DIAGNOSIS & TREATMENT ==========
      diagnosisTreatment: {
        category: isHebrew ? 'אבחון וטיפול' : 'Diagnosis & Treatment',
        icon: '🩺',
        description: isHebrew 
          ? 'כלי AI לאבחון והמלצות טיפול'
          : 'AI tools for diagnosis and treatment recommendations',
        functions: {
          analyzeSymptoms: {
            name: isHebrew ? 'ניתוח סימפטומים' : 'Analyze Symptoms',
            trigger: isHebrew ? 'נתח סימפטומים' : 'analyze symptoms',
            description: isHebrew 
              ? 'ניתוח סימפטומים והצעת אבחנות אפשריות עם Gemini AI'
              : 'Analyze symptoms and suggest possible diagnoses with Gemini AI',
            howToUse: isHebrew
              ? 'תאר את הסימפטומים והמערכת תנתח אותם'
              : 'Describe symptoms and system will analyze them',
            examples: isHebrew
              ? [
                  'המטופל מתלונן על כאב ראש וחום גבוה',
                  'נתח: בחילות, סחרחורת וכאבי בטן',
                  'מה האבחנה לשיעול יבש וקוצר נשימה'
                ]
              : [
                  'Patient complains of headache and high fever',
                  'Analyze: nausea, dizziness and stomach pain',
                  'What diagnosis for dry cough and shortness of breath'
                ],
            aiFeatures: isHebrew
              ? [
                  '🤖 ניתוח AI מתקדם',
                  '📊 דירוג הסתברות לאבחנות',
                  '⚠️ דגלים אדומים',
                  '💊 המלצות טיפול'
                ]
              : [
                  '🤖 Advanced AI analysis',
                  '📊 Probability ranking for diagnoses',
                  '⚠️ Red flags',
                  '💊 Treatment recommendations'
                ]
          },
          
          checkDrugInteractions: {
            name: isHebrew ? 'בדיקת אינטראקציות' : 'Check Interactions',
            trigger: isHebrew ? 'בדוק אינטראקציות' : 'check interactions',
            description: isHebrew 
              ? 'בדיקת אינטראקציות בין תרופות'
              : 'Check drug interactions',
            howToUse: isHebrew
              ? 'רשום את כל התרופות והמערכת תבדוק אינטראקציות'
              : 'List all medications and system will check interactions',
            examples: isHebrew
              ? [
                  'בדוק אינטראקציה בין אספירין וקומדין',
                  'האם אקמול בטוח עם אדקס',
                  'בדוק תרופות: מטפורמין, אספירין, סימבסטטין'
                ]
              : [
                  'Check interaction between aspirin and warfarin',
                  'Is Tylenol safe with Advil',
                  'Check drugs: metformin, aspirin, simvastatin'
                ],
            safety: isHebrew
              ? [
                  '⚠️ התראות על אינטראקציות מסוכנות',
                  '📋 רמות חומרה',
                  '💡 חלופות בטוחות'
                ]
              : [
                  '⚠️ Warnings for dangerous interactions',
                  '📋 Severity levels',
                  '💡 Safe alternatives'
                ]
          }
        }
      },

      // ========== APPOINTMENTS ==========
      appointments: {
        category: isHebrew ? 'תורים' : 'Appointments',
        icon: '📅',
        description: isHebrew 
          ? 'ניהול תורים ופגישות'
          : 'Manage appointments and meetings',
        functions: {
          scheduleAppointment: {
            name: isHebrew ? 'קביעת תור' : 'Schedule Appointment',
            trigger: isHebrew ? 'קבע תור' : 'schedule appointment',
            description: isHebrew 
              ? 'קביעת תור חדש למטופל'
              : 'Schedule new appointment for patient',
            howToUse: isHebrew
              ? 'אמור "קבע תור ליוסי כהן ביום שני בשעה 10:00"'
              : 'Say "schedule appointment for John Smith on Monday at 10:00"',
            examples: isHebrew
              ? [
                  'קבע תור למחר בבוקר',
                  'זמן פגישה בשבוע הבא',
                  'תור דחוף להיום'
                ]
              : [
                  'Schedule appointment for tomorrow morning',
                  'Book meeting next week',
                  'Urgent appointment today'
                ]
          }
        }
      }
    };
  }

  /**
   * Get contextual help based on current chat context
   */
  getContextualHelp(message, language = 'en') {
    const isHebrew = language === 'he';
    const messageLower = message.toLowerCase();
    
    // Detect what the user is trying to do
    const detectedFunctions = [];
    
    // Patient operations
    if (messageLower.includes('patient') || messageLower.includes('מטופל')) {
      if (messageLower.includes('add') || messageLower.includes('new') || 
          messageLower.includes('הוסף') || messageLower.includes('חדש')) {
        detectedFunctions.push('addPatient');
      }
      if (messageLower.includes('search') || messageLower.includes('find') ||
          messageLower.includes('חפש') || messageLower.includes('מצא')) {
        detectedFunctions.push('searchPatients');
      }
      if (messageLower.includes('update') || messageLower.includes('edit') ||
          messageLower.includes('עדכן') || messageLower.includes('שנה')) {
        detectedFunctions.push('updatePatient');
      }
    }
    
    // Document operations
    if (messageLower.includes('document') || messageLower.includes('file') ||
        messageLower.includes('מסמך') || messageLower.includes('קובץ')) {
      if (messageLower.includes('analyze') || messageLower.includes('נתח')) {
        detectedFunctions.push('analyzeDocument');
      }
      if (messageLower.includes('upload') || messageLower.includes('העלה')) {
        detectedFunctions.push('analyzeDocument');
      }
    }
    
    // Medical history
    if (messageLower.includes('history') || messageLower.includes('היסטוריה')) {
      detectedFunctions.push('getMedicalHistory');
    }
    
    // Symptoms
    if (messageLower.includes('symptom') || messageLower.includes('diagnos') ||
        messageLower.includes('סימפטום') || messageLower.includes('אבחון')) {
      detectedFunctions.push('analyzeSymptoms');
    }
    
    return detectedFunctions;
  }

  /**
   * Get quick action suggestions based on context
   */
  getQuickActions(currentFunction, language = 'en') {
    const isHebrew = language === 'he';
    const allHelp = this.getAllFunctionHelp(language);
    
    const suggestions = [];
    
    // If no specific function, show common actions
    if (!currentFunction) {
      return isHebrew
        ? [
            { text: '➕ הוסף מטופל', action: 'add patient' },
            { text: '🔍 חפש מטופל', action: 'search patient' },
            { text: '📄 נתח מסמך', action: 'analyze document' },
            { text: '🩺 נתח סימפטומים', action: 'analyze symptoms' },
            { text: '❓ עזרה', action: 'help' }
          ]
        : [
            { text: '➕ Add Patient', action: 'add patient' },
            { text: '🔍 Search Patient', action: 'search patient' },
            { text: '📄 Analyze Document', action: 'analyze document' },
            { text: '🩺 Analyze Symptoms', action: 'analyze symptoms' },
            { text: '❓ Help', action: 'help' }
          ];
    }
    
    // Show related actions based on current function
    switch(currentFunction) {
      case 'searchPatients':
        return isHebrew
          ? [
              { text: '✏️ עדכן פרטים', action: 'update patient' },
              { text: '📋 הצג היסטוריה', action: 'show history' },
              { text: '📄 הצג מסמכים', action: 'show documents' },
              { text: '➕ הוסף ביקור', action: 'add visit' }
            ]
          : [
              { text: '✏️ Update Details', action: 'update patient' },
              { text: '📋 View History', action: 'show history' },
              { text: '📄 View Documents', action: 'show documents' },
              { text: '➕ Add Visit', action: 'add visit' }
            ];
      
      case 'analyzeDocument':
        return isHebrew
          ? [
              { text: '💾 שמור למטופל', action: 'save to patient' },
              { text: '🔍 נתח נוסף', action: 'analyze another' },
              { text: '📊 השווה לקודמים', action: 'compare previous' },
              { text: '🏥 הוסף להיסטוריה', action: 'add to history' }
            ]
          : [
              { text: '💾 Save to Patient', action: 'save to patient' },
              { text: '🔍 Analyze Another', action: 'analyze another' },
              { text: '📊 Compare Previous', action: 'compare previous' },
              { text: '🏥 Add to History', action: 'add to history' }
            ];
      
      default:
        return [];
    }
  }

  /**
   * Show interactive tooltip for a specific function
   */
  showFunctionTooltip(functionName, language = 'en') {
    const allHelp = this.getAllFunctionHelp(language);
    
    // Find the function in categories
    for (const category of Object.values(allHelp)) {
      if (category.functions && category.functions[functionName]) {
        const func = category.functions[functionName];
        
        // Create tooltip data
        const tooltip = {
          id: functionName,
          title: func.name,
          description: func.description,
          howToUse: func.howToUse,
          examples: func.examples,
          tips: func.tips || [],
          warnings: func.warnings || [],
          quickActions: this.getQuickActions(functionName, language),
          timestamp: Date.now()
        };
        
        // Store active tooltip
        this.activeTooltips.set(functionName, tooltip);
        
        // Emit event for UI
        this.emitTooltipUpdate(tooltip);
        
        return tooltip;
      }
    }
    
    return null;
  }

  /**
   * Hide tooltip
   */
  hideTooltip(functionName) {
    this.activeTooltips.delete(functionName);
    this.emitTooltipUpdate({ id: functionName, hidden: true });
  }

  /**
   * Get all active tooltips
   */
  getActiveTooltips() {
    return Array.from(this.activeTooltips.values());
  }

  /**
   * Emit tooltip update event
   */
  emitTooltipUpdate(tooltip) {
    window.dispatchEvent(new CustomEvent('functionTooltipUpdate', {
      detail: tooltip
    }));
  }

  /**
   * Search functions by keyword
   */
  searchFunctions(keyword, language = 'en') {
    const allHelp = this.getAllFunctionHelp(language);
    const results = [];
    const keywordLower = keyword.toLowerCase();
    
    for (const [categoryKey, category] of Object.entries(allHelp)) {
      for (const [funcKey, func] of Object.entries(category.functions || {})) {
        // Search in name, description, trigger
        if (func.name.toLowerCase().includes(keywordLower) ||
            func.description.toLowerCase().includes(keywordLower) ||
            func.trigger.toLowerCase().includes(keywordLower)) {
          results.push({
            categoryKey,
            category: category.category,
            functionKey: funcKey,
            ...func
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Get help message for display in chat
   */
  getHelpMessage(functionName, language = 'en') {
    const isHebrew = language === 'he';
    const allHelp = this.getAllFunctionHelp(language);
    
    // If no specific function, show categories
    if (!functionName) {
      let message = isHebrew 
        ? '📚 **פונקציות זמינות במערכת:**\n\n'
        : '📚 **Available System Functions:**\n\n';
      
      for (const category of Object.values(allHelp)) {
        message += `${category.icon} **${category.category}**\n`;
        message += `${category.description}\n`;
        
        // List first 3 functions
        const funcs = Object.values(category.functions || {}).slice(0, 3);
        for (const func of funcs) {
          message += `  • ${func.name} - ${func.trigger}\n`;
        }
        message += '\n';
      }
      
      message += isHebrew
        ? '\n💡 **טיפ:** כתוב "עזרה" ואז שם הפונקציה לקבלת הסבר מפורט'
        : '\n💡 **Tip:** Type "help" followed by function name for detailed explanation';
      
      return message;
    }
    
    // Show specific function help
    for (const category of Object.values(allHelp)) {
      if (category.functions && category.functions[functionName]) {
        const func = category.functions[functionName];
        
        let message = `${category.icon} **${func.name}**\n\n`;
        message += `📝 ${func.description}\n\n`;
        
        message += isHebrew ? '**איך להשתמש:**\n' : '**How to use:**\n';
        message += `${func.howToUse}\n\n`;
        
        if (func.examples && func.examples.length > 0) {
          message += isHebrew ? '**דוגמאות:**\n' : '**Examples:**\n';
          for (const example of func.examples) {
            message += `  • "${example}"\n`;
          }
          message += '\n';
        }
        
        if (func.tips && func.tips.length > 0) {
          message += isHebrew ? '**טיפים:**\n' : '**Tips:**\n';
          for (const tip of func.tips) {
            message += `  ${tip}\n`;
          }
          message += '\n';
        }
        
        if (func.warnings && func.warnings.length > 0) {
          message += isHebrew ? '**אזהרות:**\n' : '**Warnings:**\n';
          for (const warning of func.warnings) {
            message += `  ${warning}\n`;
          }
        }
        
        return message;
      }
    }
    
    return isHebrew
      ? `❌ לא נמצאה פונקציה בשם "${functionName}"`
      : `❌ Function "${functionName}" not found`;
  }
}

// Create singleton instance
const platformFunctionHelpService = new PlatformFunctionHelpService();

export default platformFunctionHelpService;