// IntelliCare Agent Capability Manager
// This service helps the AI agent understand and communicate its full capabilities

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AgentCapabilityManager {
  constructor() {
    // Cache for function metadata
    this.functionMetadata = null;
    this.lastUpdate = null;
    this.updateInterval = 1000 * 60 * 60; // 1 hour cache
    this.serviceToken = null;
  }

  async initialize() {
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('agent-capability-manager-service');
    return this;
  }

  // Get a comprehensive capability overview without exposing all function details
  getCapabilityOverview(language = 'en') {
    const isHebrew = language === 'he';
    
    return {
      summary: isHebrew 
        ? "אני עוזר AI רפואי עם יותר מ-235 פונקציות המכסות את כל היבטי הטיפול הרפואי"
        : "I'm a medical AI assistant with over 235 functions covering all aspects of medical care",
      
      categories: [
        {
          name: isHebrew ? "ניהול מטופלים" : "Patient Management",
          icon: "👥",
          capabilities: isHebrew 
            ? ["הוספת מטופלים", "חיפוש", "עדכון פרטים", "היסטוריה רפואית", "מחיקה"]
            : ["Add patients", "Search", "Update details", "Medical history", "Deletion"],
          functionCount: 12,
          examples: isHebrew
            ? ["הוסף מטופל חדש בשם יוסי כהן", "חפש מטופל עם ת.ז. 123456789", "עדכן כתובת למטופל"]
            : ["Add new patient John Doe", "Search patient with ID 123456789", "Update patient address"]
        },
        {
          name: isHebrew ? "מסמכים רפואיים" : "Medical Documents",
          icon: "📄",
          capabilities: isHebrew
            ? ["העלאת מסמכים", "ניתוח OCR", "חיפוש", "חילוץ מידע", "סיווג"]
            : ["Upload documents", "OCR analysis", "Search", "Data extraction", "Categorization"],
          functionCount: 8,
          examples: isHebrew
            ? ["העלה תוצאות בדיקות", "נתח מסמך זה", "חפש מסמכים עם 'סוכרת'"]
            : ["Upload lab results", "Analyze this document", "Search documents with 'diabetes'"]
        },
        {
          name: isHebrew ? "בדיקות מעבדה" : "Laboratory Tests",
          icon: "🧪",
          capabilities: isHebrew
            ? ["הוספת תוצאות", "מעקב מגמות", "השוואה", "ערכי ייחוס", "התראות"]
            : ["Add results", "Track trends", "Compare", "Reference ranges", "Alerts"],
          functionCount: 10,
          examples: isHebrew
            ? ["הוסף תוצאת המוגלובין A1C: 7.2", "הצג מגמת סוכר ב-6 חודשים", "השווה בדיקות דם"]
            : ["Add HbA1c result: 7.2", "Show glucose trend for 6 months", "Compare blood tests"]
        },
        {
          name: isHebrew ? "תרופות" : "Medications",
          icon: "💊",
          capabilities: isHebrew
            ? ["ניהול תרופות", "בדיקת אינטראקציות", "מינונים", "מרשמים", "חידושים"]
            : ["Medication management", "Check interactions", "Dosing", "Prescriptions", "Refills"],
          functionCount: 15,
          examples: isHebrew
            ? ["הוסף מטפורמין 500mg פעמיים ביום", "בדוק אינטראקציות", "חדש מרשם"]
            : ["Add Metformin 500mg twice daily", "Check interactions", "Refill prescription"]
        },
        {
          name: isHebrew ? "מדדים חיוניים" : "Vital Signs",
          icon: "❤️",
          capabilities: isHebrew
            ? ["רישום מדדים", "מעקב מגמות", "התראות", "גרפים", "ניתוח"]
            : ["Record vitals", "Track trends", "Alerts", "Charts", "Analysis"],
          functionCount: 8,
          examples: isHebrew
            ? ["הוסף לחץ דם 120/80, דופק 72", "הצג מגמת לחץ דם", "התרע על חריגות"]
            : ["Add BP 120/80, pulse 72", "Show BP trend", "Alert on abnormalities"]
        },
        {
          name: isHebrew ? "תורים" : "Appointments",
          icon: "📅",
          capabilities: isHebrew
            ? ["קביעת תורים", "חיפוש זמנים", "שינוי", "ביטול", "תזכורות"]
            : ["Schedule appointments", "Find slots", "Reschedule", "Cancel", "Reminders"],
          functionCount: 11,
          examples: isHebrew
            ? ["קבע תור מחר ב-14:00", "מצא זמנים פנויים השבוע", "שנה תור ליום שני"]
            : ["Schedule appointment tomorrow at 2pm", "Find available slots this week", "Reschedule to Monday"]
        },
        {
          name: isHebrew ? "אבחון AI" : "AI Diagnosis",
          icon: "🤖",
          capabilities: isHebrew
            ? ["ניתוח תסמינים", "אבחנה מבדלת", "המלצות טיפול", "דגלים אדומים"]
            : ["Symptom analysis", "Differential diagnosis", "Treatment recommendations", "Red flags"],
          functionCount: 6,
          examples: isHebrew
            ? ["נתח: כאב ראש, חום, עייפות", "הצע אבחנה מבדלת", "זהה דגלים אדומים"]
            : ["Analyze: headache, fever, fatigue", "Suggest differential diagnosis", "Identify red flags"]
        },
        {
          name: isHebrew ? "אלרגיות וחיסונים" : "Allergies & Vaccinations",
          icon: "🩹",
          capabilities: isHebrew
            ? ["ניהול אלרגיות", "מעקב חיסונים", "לוח חיסונים", "התראות"]
            : ["Manage allergies", "Track vaccinations", "Immunization schedule", "Alerts"],
          functionCount: 8,
          examples: isHebrew
            ? ["הוסף אלרגיה לפניצילין", "בדוק חיסונים חסרים", "קבע תזכורת לחיסון שפעת"]
            : ["Add penicillin allergy", "Check missing vaccines", "Set flu shot reminder"]
        },
        {
          name: isHebrew ? "הפניות ודימות" : "Referrals & Imaging",
          icon: "🏥",
          capabilities: isHebrew
            ? ["יצירת הפניות", "מעקב", "תוצאות דימות", "DICOM", "דוחות"]
            : ["Create referrals", "Track", "Imaging results", "DICOM", "Reports"],
          functionCount: 12,
          examples: isHebrew
            ? ["צור הפניה לקרדיולוג", "הצג תוצאות MRI", "העלה צילום חזה"]
            : ["Create cardiology referral", "Show MRI results", "Upload chest X-ray"]
        },
        {
          name: isHebrew ? "ביטוח ותשלומים" : "Insurance & Billing",
          icon: "💰",
          capabilities: isHebrew
            ? ["אימות ביטוח", "הגשת תביעות", "בדיקת כיסוי", "חיובים", "קבלות"]
            : ["Verify insurance", "Submit claims", "Check coverage", "Billing", "Receipts"],
          functionCount: 13,
          examples: isHebrew
            ? ["בדוק כיסוי ביטוחי", "הגש תביעה", "צור חשבונית"]
            : ["Check insurance coverage", "Submit claim", "Generate invoice"]
        },
        {
          name: isHebrew ? "דוחות וניתוחים" : "Reports & Analytics",
          icon: "📊",
          capabilities: isHebrew
            ? ["דוחות רפואיים", "ניתוחי נתונים", "סטטיסטיקות", "HIPAA/GDPR", "ייצוא"]
            : ["Medical reports", "Data analytics", "Statistics", "HIPAA/GDPR", "Export"],
          functionCount: 18,
          examples: isHebrew
            ? ["צור דוח חודשי", "הצג סטטיסטיקות סוכרת", "ייצא נתונים ל-Excel"]
            : ["Generate monthly report", "Show diabetes statistics", "Export data to Excel"]
        },
        {
          name: isHebrew ? "ניהול משתמשים" : "User Management",
          icon: "🔐",
          capabilities: isHebrew
            ? ["יצירת משתמשים", "הרשאות", "תפקידים", "MFA", "אבטחה"]
            : ["Create users", "Permissions", "Roles", "MFA", "Security"],
          functionCount: 20,
          examples: isHebrew
            ? ["צור משתמש חדש", "הוסף הרשאת רופא", "הפעל אימות דו-שלבי"]
            : ["Create new user", "Add doctor permission", "Enable two-factor auth"]
        },
        {
          name: isHebrew ? "תקשורת" : "Communication",
          icon: "💬",
          capabilities: isHebrew
            ? ["הודעות SMS", "דוא\"ל", "התראות", "תזכורות", "צ'אט"]
            : ["SMS messages", "Email", "Notifications", "Reminders", "Chat"],
          functionCount: 10,
          examples: isHebrew
            ? ["שלח תזכורת לתור", "שלח תוצאות בדיקה במייל", "התחל צ'אט עם מטופל"]
            : ["Send appointment reminder", "Email test results", "Start patient chat"]
        },
        {
          name: isHebrew ? "פעולות מערכת" : "System Operations",
          icon: "⚙️",
          capabilities: isHebrew
            ? ["גיבויים", "ניטור", "ביצועים", "תחזוקה", "אבטחה"]
            : ["Backups", "Monitoring", "Performance", "Maintenance", "Security"],
          functionCount: 25,
          examples: isHebrew
            ? ["בדוק מצב מערכת", "צור גיבוי", "הצג ביצועים"]
            : ["Check system status", "Create backup", "Show performance"]
        },
        {
          name: isHebrew ? "אינטגרציות" : "Integrations",
          icon: "🔗",
          capabilities: isHebrew
            ? ["מערכות חיצוניות", "API", "Webhooks", "HL7/FHIR", "IoT"]
            : ["External systems", "APIs", "Webhooks", "HL7/FHIR", "IoT"],
          functionCount: 15,
          examples: isHebrew
            ? ["חבר למערכת מעבדה", "צור webhook", "סנכרן עם מכשיר IoT"]
            : ["Connect to lab system", "Create webhook", "Sync with IoT device"]
        }
      ],
      
      totalFunctions: 235,
      
      howToUse: isHebrew
        ? "פשוט תאר מה אתה צריך בשפה טבעית, ואני אבחר ואפעיל את הפונקציות המתאימות עבורך."
        : "Just describe what you need in natural language, and I'll select and execute the appropriate functions for you.",
      
      tips: isHebrew ? [
        "אתה יכול לדבר איתי בעברית או באנגלית",
        "אני יכול לבצע פעולות מרובות בבקשה אחת",
        "אני זוכר את ההקשר של השיחה שלנו",
        "אני יכול לעבוד עם קבצים ומסמכים",
        "אני תומך בתהליכי עבודה מורכבים"
      ] : [
        "You can speak to me in Hebrew or English",
        "I can perform multiple actions in a single request",
        "I remember the context of our conversation",
        "I can work with files and documents",
        "I support complex workflows"
      ]
    };
  }

  // Get a detailed function listing without full schemas (for help command)
  getFunctionListing(language = 'en', category = null) {
    const isHebrew = language === 'he';
    const proxy = getServiceProxy();
    const agentV4 = proxy.getService('agentServiceV4');
    const agent = new agentV4.IntelliCareCompleteAgent();
    
    // Get all functions
    const allFunctions = agent.getAllPlatformFunctions(language, 'Israel');
    
    // Group functions by category
    const categories = {
      patient: {
        name: isHebrew ? "ניהול מטופלים" : "Patient Management",
        functions: ["addPatient", "updatePatient", "deletePatientBySearch", "searchPatients", "getPatientDetails", "countPatients", "bulkUpdatePatients", "exportPatients", "importPatients", "importPatientsFromCSV", "mergePatients", "getPatientTimeline", "getPatientSummary"]
      },
      medical: {
        name: isHebrew ? "נתונים רפואיים" : "Medical Data",
        functions: ["addMedicalHistory", "getMedicalHistory", "updateMedicalHistory", "deleteMedicalHistory", "getLabResults", "addLabResult", "updateLabResult", "deleteLabResult", "getMedications", "addMedication", "updateMedication", "deleteMedication", "checkDrugInteractions", "getVitalSigns", "addVitalSigns", "updateVitalSigns", "deleteVitalSigns", "getAllergies", "addAllergy", "updateAllergy", "deleteAllergy", "getVaccinations", "addVaccination", "updateVaccination", "deleteVaccination"]
      },
      documents: {
        name: isHebrew ? "מסמכים" : "Documents",
        functions: ["uploadDocument", "getDocuments", "analyzeDocument", "deleteDocument", "searchDocuments", "batchUploadDocuments", "getDocumentOCR", "categorizeDocument", "retrievePendingUpload", "analyzePendingDocument"]
      },
      appointments: {
        name: isHebrew ? "תורים" : "Appointments",
        functions: ["getAppointments", "scheduleAppointment", "updateAppointment", "cancelAppointment", "rescheduleAppointment", "findAvailableSlots", "getWaitlist", "addToWaitlist", "sendAppointmentReminder", "getAppointmentHistory", "bulkScheduleAppointments"]
      },
      diagnosis: {
        name: isHebrew ? "אבחון" : "Diagnosis",
        functions: ["generateDiagnosis", "getDifferentialDiagnosis", "analyzeSymptomsAndSuggestTests", "interpretLabResults", "suggestTreatmentPlan", "identifyRedFlags"]
      },
      prescriptions: {
        name: isHebrew ? "מרשמים" : "Prescriptions",
        functions: ["createPrescription", "getPrescriptions", "updatePrescription", "cancelPrescription", "refillPrescription", "checkPrescriptionInteractions", "getPrescriptionHistory"]
      },
      referrals: {
        name: isHebrew ? "הפניות" : "Referrals",
        functions: ["createReferral", "getReferrals", "updateReferral", "cancelReferral", "trackReferralStatus", "getSpecialists"]
      },
      imaging: {
        name: isHebrew ? "דימות" : "Imaging",
        functions: ["orderImaging", "getImagingResults", "uploadImagingResults", "viewDICOM", "compareImagingStudies", "getImagingHistory"]
      },
      insurance: {
        name: isHebrew ? "ביטוח" : "Insurance",
        functions: ["verifyInsurance", "checkCoverage", "submitClaim", "getClaimStatus", "updateInsurance", "getPriorAuthorization", "estimateCosts"]
      },
      billing: {
        name: isHebrew ? "חיובים" : "Billing",
        functions: ["createInvoice", "getInvoices", "processPayment", "issueRefund", "getPaymentHistory", "sendPaymentReminder", "generateStatement"]
      },
      communication: {
        name: isHebrew ? "תקשורת" : "Communication",
        functions: ["sendSMS", "sendEmail", "sendNotification", "getMessages", "createBroadcast", "scheduleMessage", "getMessageTemplates"]
      },
      reports: {
        name: isHebrew ? "דוחות" : "Reports",
        functions: ["generateMedicalReport", "generateLabReport", "generatePatientSummary", "getClinicStatistics", "generateComplianceReport", "exportData", "scheduleReport"]
      },
      users: {
        name: isHebrew ? "משתמשים" : "Users",
        functions: ["createUser", "updateUser", "deleteUser", "getUsers", "assignRole", "updatePermissions", "resetPassword", "enableMFA", "disableUser", "getUserActivity"]
      },
      system: {
        name: isHebrew ? "מערכת" : "System",
        functions: ["getSystemStatus", "createBackup", "restoreBackup", "getAuditLog", "getPerformanceMetrics", "runDiagnostics", "clearCache", "updateConfiguration"]
      }
    };

    // Filter by category if specified
    if (category && categories[category]) {
      const cat = categories[category];
      return {
        category: cat.name,
        functions: allFunctions.filter(f => cat.functions.includes(f.name))
          .map(f => ({
            name: f.name,
            description: f.description
          }))
      };
    }

    // Return all categories with function counts
    return Object.entries(categories).map(([key, cat]) => ({
      id: key,
      name: cat.name,
      functionCount: cat.functions.length,
      sample: cat.functions.slice(0, 3)
    }));
  }

  // Generate a capability card for the agent to reference
  generateCapabilityCard(language = 'en') {
    const isHebrew = language === 'he';
    const overview = this.getCapabilityOverview(language);
    
    const card = isHebrew ? `
🏥 **יכולות IntelliCare AI Agent**

אני עוזר AI רפואי מתקדם עם ${overview.totalFunctions}+ פונקציות המכסות:

${overview.categories.map(cat => 
  `${cat.icon} **${cat.name}** (${cat.functionCount} פונקציות)
   • ${cat.capabilities.join(', ')}
   דוגמה: "${cat.examples[0]}"`
).join('\n\n')}

💡 **איך להשתמש בי:**
${overview.howToUse}

🎯 **טיפים:**
${overview.tips.map(tip => `• ${tip}`).join('\n')}

פשוט תגיד לי מה אתה צריך, ואני אדאג לכל השאר!
    ` : `
🏥 **IntelliCare AI Agent Capabilities**

I'm an advanced medical AI assistant with ${overview.totalFunctions}+ functions covering:

${overview.categories.map(cat => 
  `${cat.icon} **${cat.name}** (${cat.functionCount} functions)
   • ${cat.capabilities.join(', ')}
   Example: "${cat.examples[0]}"`
).join('\n\n')}

💡 **How to use me:**
${overview.howToUse}

🎯 **Tips:**
${overview.tips.map(tip => `• ${tip}`).join('\n')}

Just tell me what you need, and I'll take care of the rest!
    `;

    return card;
  }

  // Help command handler
  async handleHelpCommand(command, language = 'en') {
    const isHebrew = language === 'he';
    
    // Parse help command
    const parts = command.toLowerCase().split(' ');
    
    if (parts.length === 1 || parts[1] === 'overview') {
      // General help
      return this.generateCapabilityCard(language);
    }
    
    if (parts[1] === 'functions' || parts[1] === 'פונקציות') {
      // List all function categories
      const categories = this.getFunctionListing(language);
      return isHebrew 
        ? `📋 **קטגוריות פונקציות זמינות:**\n\n${categories.map(cat => 
            `• **${cat.name}** (${cat.functionCount} פונקציות)\n  דוגמאות: ${cat.sample.join(', ')}`
          ).join('\n\n')}\n\nהקלד "help category [שם]" לפרטים על קטגוריה ספציפית.`
        : `📋 **Available Function Categories:**\n\n${categories.map(cat => 
            `• **${cat.name}** (${cat.functionCount} functions)\n  Examples: ${cat.sample.join(', ')}`
          ).join('\n\n')}\n\nType "help category [name]" for details on a specific category.`;
    }
    
    if (parts[1] === 'category' && parts[2]) {
      // Specific category help
      const categoryDetails = this.getFunctionListing(language, parts[2]);
      if (categoryDetails.functions) {
        return isHebrew
          ? `📁 **${categoryDetails.category}:**\n\n${categoryDetails.functions.map(f => 
              `• **${f.name}**\n  ${f.description}`
            ).join('\n\n')}`
          : `📁 **${categoryDetails.category}:**\n\n${categoryDetails.functions.map(f => 
              `• **${f.name}**\n  ${f.description}`
            ).join('\n\n')}`;
      }
    }
    
    if (parts[1] === 'examples' || parts[1] === 'דוגמאות') {
      return isHebrew ? `
🎯 **דוגמאות לשימוש:**

**ניהול מטופלים:**
• "הוסף מטופל חדש בשם דוד לוי, ת.ז. 123456789, נולד ב-1/1/1980"
• "חפש מטופל עם שם משפחה כהן"
• "עדכן כתובת של מטופל 12345 לרחוב הרצל 10, תל אביב"

**בדיקות ותוצאות:**
• "הוסף תוצאת סוכר 95 mg/dl מהיום"
• "הצג את כל בדיקות הדם מהחודש האחרון"
• "השווה תוצאות המוגלובין מהשנה האחרונה"

**תרופות:**
• "הוסף אקמול 500mg לפי הצורך"
• "בדוק אינטראקציות בין התרופות של המטופל"
• "הצג רשימת תרופות פעילות"

**תורים:**
• "קבע תור מחר ב-10:00 בבוקר"
• "מצא זמנים פנויים השבוע"
• "בטל את התור של יום שני"
      ` : `
🎯 **Usage Examples:**

**Patient Management:**
• "Add new patient John Smith, ID 123456789, born 1/1/1980"
• "Search for patients with last name Johnson"
• "Update address for patient 12345 to 123 Main St, New York"

**Tests and Results:**
• "Add glucose result 95 mg/dl from today"
• "Show all blood tests from last month"
• "Compare HbA1c results from last year"

**Medications:**
• "Add Tylenol 500mg as needed"
• "Check drug interactions for patient's medications"
• "Show active medication list"

**Appointments:**
• "Schedule appointment tomorrow at 10am"
• "Find available slots this week"
• "Cancel Monday's appointment"
      `;
    }
    
    // Default help
    return isHebrew 
      ? `ℹ️ **עזרה זמינה:**\n• help / עזרה - סקירה כללית\n• help functions - רשימת קטגוריות\n• help category [name] - פרטי קטגוריה\n• help examples - דוגמאות שימוש`
      : `ℹ️ **Available Help:**\n• help - General overview\n• help functions - List categories\n• help category [name] - Category details\n• help examples - Usage examples`;
  }

  // Check if message is asking about capabilities
  isCapabilityQuery(message) {
    const lowerMessage = message.toLowerCase();
    
    const capabilityKeywords = [
      // English
      'what can you do', 'what do you do', 'your capabilities', 'your functions',
      'help', 'how to use', 'what functions', 'list functions', 'show functions',
      'available functions', 'what features', 'what can i do', 'how do i',
      // Hebrew
      'מה אתה יכול', 'מה אתה עושה', 'היכולות שלך', 'הפונקציות שלך',
      'עזרה', 'איך להשתמש', 'אילו פונקציות', 'רשימת פונקציות', 'הצג פונקציות',
      'פונקציות זמינות', 'אילו תכונות', 'מה אני יכול', 'איך אני'
    ];
    
    return capabilityKeywords.some(keyword => lowerMessage.includes(keyword));
  }
}

// Create instance
const agentCapabilityManager = new AgentCapabilityManager();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('agentCapabilityManager', () => agentCapabilityManager);
}

module.exports = agentCapabilityManager;