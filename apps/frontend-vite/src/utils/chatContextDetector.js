// Intelligent context detection for when to split the screen
// Like Claude's Artifacts decision logic

export const detectContextTriggers = (message, functionCalls) => {
  const triggers = [];
  
  // 1. Patient-related triggers
  const patientTriggers = {
    // When patient is found/selected
    patientFound: /מטופל נמצא|patient found|נמצאו הפרטים|found patient details/i,
    patientSelected: /בחרתי את המטופל|selected patient|המטופל שנבחר/i,
    patientInfo: /פרטי המטופל|patient information|מידע על המטופל/i,
    
    // When showing patient details
    showingDetails: /הנה הפרטים|here are the details|להלן הפרטים/i,
    patientHistory: /היסטוריה רפואית|medical history|רשומות קודמות/i
  };
  
  // 2. Lab results triggers
  const labTriggers = {
    labResults: /תוצאות מעבדה|lab results|בדיקות דם/i,
    showingLabs: /תוצאות הבדיקות|test results|להלן התוצאות/i,
    comparingLabs: /השוואת תוצאות|comparing results|מגמות בתוצאות/i,
    abnormalResults: /תוצאות חריגות|abnormal results|ערכים חריגים/i
  };
  
  // 3. Document triggers
  const documentTriggers = {
    showingDocument: /מציג מסמך|showing document|הנה המסמך/i,
    documentList: /רשימת מסמכים|document list|המסמכים הזמינים/i,
    uploadedDocument: /המסמך הועלה|document uploaded|קובץ חדש|הקובץ.*הועלה|העלית.*מסמך|upload.*document/i,
    prescriptions: /מרשמים|prescriptions|תרופות שנרשמו/i,
    documentSuccess: /הועלה בהצלחה|uploaded successfully|תוצאות מעבדה/i
  };
  
  // 4. Medication triggers
  const medicationTriggers = {
    medicationList: /רשימת תרופות|medication list|התרופות הנוכחיות/i,
    medicationSchedule: /לוח תרופות|medication schedule|זמני נטילה/i,
    drugInteractions: /אינטראקציות|drug interactions|התנגשויות תרופתיות/i,
    adherence: /היענות לטיפול|medication adherence|נטילת תרופות/i
  };
  
  // 5. Visual/Chart triggers
  const visualTriggers = {
    charts: /גרף|chart|תרשים|graph/i,
    trends: /מגמות|trends|שינויים לאורך זמן/i,
    comparison: /השוואה|comparison|להשוות/i,
    statistics: /סטטיסטיקה|statistics|נתונים סטטיסטיים/i
  };
  
  // 6. Function call triggers
  if (functionCalls && functionCalls.length > 0) {
    functionCalls.forEach(call => {
      switch(call.name) {
        case 'getPatient':
        case 'searchPatients':
        case 'listPatients':
          triggers.push({ type: 'patient', reason: 'Patient function called' });
          break;
        case 'getLabResults':
        case 'compareLabResults':
          triggers.push({ type: 'labs', reason: 'Lab results function called' });
          break;
        case 'getDocuments':
        case 'viewDocument':
          triggers.push({ type: 'documents', reason: 'Document function called' });
          break;
        case 'getMedications':
        case 'checkInteractions':
          triggers.push({ type: 'medications', reason: 'Medication function called' });
          break;
      }
    });
  }
  
  // Check message against all triggers
  Object.entries(patientTriggers).forEach(([key, regex]) => {
    if (regex.test(message)) {
      triggers.push({ type: 'patient', reason: key });
    }
  });
  
  Object.entries(labTriggers).forEach(([key, regex]) => {
    if (regex.test(message)) {
      triggers.push({ type: 'labs', reason: key });
    }
  });
  
  Object.entries(documentTriggers).forEach(([key, regex]) => {
    if (regex.test(message)) {
      triggers.push({ type: 'documents', reason: key });
    }
  });
  
  Object.entries(medicationTriggers).forEach(([key, regex]) => {
    if (regex.test(message)) {
      triggers.push({ type: 'medications', reason: key });
    }
  });
  
  Object.entries(visualTriggers).forEach(([key, regex]) => {
    if (regex.test(message)) {
      triggers.push({ type: 'visual', reason: key });
    }
  });
  
  return triggers;
};

// Determine if we should split the screen
export const shouldSplitScreen = (message, functionCalls, currentContext) => {
  const triggers = detectContextTriggers(message, functionCalls);
  
  // Don't split for simple queries
  const simpleQueries = /מה השעה|hello|שלום|תודה|thank you|בוקר טוב|good morning/i;
  if (simpleQueries.test(message) && triggers.length === 0) {
    return { split: false };
  }
  
  // Split if we have strong triggers
  if (triggers.length > 0) {
    // Determine which tab to show
    const tabPriority = {
      'patient': 'patient',
      'labs': 'labs',
      'documents': 'documents',
      'medications': 'medications',
      'visual': 'labs' // Show labs tab for visual data
    };
    
    const primaryTrigger = triggers[0];
    return {
      split: true,
      tab: tabPriority[primaryTrigger.type] || 'patient',
      reason: primaryTrigger.reason,
      confidence: triggers.length > 1 ? 'high' : 'medium'
    };
  }
  
  // Check for implicit triggers (substantial content)
  const hasSubstantialContent = message.length > 500;
  const hasMultipleLines = (message.match(/\n/g) || []).length > 5;
  const hasTableData = /\|.*\|.*\|/m.test(message);
  const hasList = /^\s*[-*•]\s+/m.test(message);
  
  if (hasSubstantialContent || hasMultipleLines || hasTableData) {
    return {
      split: true,
      tab: 'patient', // Default tab
      reason: 'substantial_content',
      confidence: 'low'
    };
  }
  
  return { split: false };
};

// Extract patient data from message
export const extractPatientFromMessage = (message) => {
  // Look for patient ID patterns
  const idMatch = message.match(/ID:\s*(\d+)|מזהה:\s*(\d+)|patient\s+#(\d+)/i);
  
  // Look for patient name
  const nameMatch = message.match(/(?:שם|name):\s*([^\n,]+)/i);
  
  // Look for structured patient data
  const patientDataMatch = message.match(/\{[^}]*"firstName"[^}]*\}/);
  
  if (patientDataMatch) {
    try {
      return JSON.parse(patientDataMatch[0]);
    } catch (e) {
      // Not valid JSON
    }
  }
  
  if (idMatch || nameMatch) {
    return {
      _id: idMatch ? (idMatch[1] || idMatch[2] || idMatch[3]) : null,
      name: nameMatch ? nameMatch[1].trim() : null
    };
  }
  
  return null;
};

// Determine context from user's question
export const detectUserIntent = (userMessage) => {
  const intents = {
    searchPatient: /חפש מטופל|find patient|איפה המטופל|where is patient|מי המטופל/i,
    showPatient: /הצג מטופל|show patient|פרטי מטופל|patient details|תראה לי את/i,
    labResults: /תוצאות מעבדה|lab results|בדיקות דם|blood tests|תוצאות בדיקות/i,
    medications: /תרופות|medications|מרשמים|prescriptions|טיפול תרופתי/i,
    documents: /מסמכים|documents|קבצים|files|סריקות|scans/i,
    history: /היסטוריה|history|עבר רפואי|medical history|ביקורים קודמים/i,
    appointment: /תור|appointment|פגישה|meeting|ביקור|visit/i,
    diagnosis: /אבחון|diagnosis|מחלה|disease|תסמינים|symptoms/i
  };
  
  for (const [intent, regex] of Object.entries(intents)) {
    if (regex.test(userMessage)) {
      return intent;
    }
  }
  
  return 'general';
};