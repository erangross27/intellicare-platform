/**
 * Claude Intent Patterns - Semantic Understanding for Function Selection
 *
 * This replaces the broken keyword system with intent-based matching.
 * Each function group has example prompts that demonstrate the user's intent.
 * Claude analyzes the semantic meaning, not just keyword matching.
 *
 * Benefits:
 * - Understands "I want to see this patient" means schedule appointment
 * - Won't match unrelated functions just because they contain "appointment"
 * - Learns context like "with me" means use current provider
 * - Scales to thousands of functions without confusion
 */

const appointmentIntentPatterns = {
  scheduleAppointment: {
    name: "Schedule New Appointment",
    description: "User wants to create a new appointment or meeting with a patient",
    examplePrompts: [
      // English variations - Direct requests
      "I need to schedule an appointment with patient John Doe for tomorrow",
      "Book a meeting with the patient next week",
      "Can you set up an appointment for 3pm today",
      "Schedule a consultation with this patient",
      "I want to see this patient tomorrow at 10am",
      "Add an appointment to my calendar with patient ID 12345",
      "Create a new appointment slot for this patient",
      "Set up a follow-up appointment in two weeks",
      "Book this patient for a 30-minute session",
      "Schedule three patients for appointments tomorrow",
      "I need to see these patients: [list of names]",
      "Can you book appointments for these three patients with me",
      "Make an appointment",
      "Set up a visit with the patient",

      // Hebrew variations
      "קבע תור למטופל",
      "אני רוצה לקבוע פגישה עם המטופל",
      "תזמן פגישה למחר בשעה 10",
      "קבע תור למטופל ג'ון דו",
      "צור תור חדש למטופל הזה",
      "הוסף פגישה עם המטופל ליומן שלי",
      "קבע פגישות לשלושה מטופלים",
      "תקבע לי תור עם המטופל",
      "אני צריך לראות את המטופל",

      // Context-specific variations
      "The patient needs to come back for a follow-up",
      "We need to discuss the test results with the patient",
      "Schedule a review of the treatment plan",
      "Book time to go over the lab results",
      "Patient requires a consultation",
      "Need to examine this patient",
      "Arrange a check-up for the patient",

      // Implicit provider variations (user is the provider)
      "Schedule the patient with me",
      "I want to see this patient",
      "Book them into my schedule",
      "Add to my appointments for tomorrow",
      "Put them on my calendar",
      "I'll see them next week",
      "Get them on my schedule",

      // Multiple patients
      "Schedule appointments for each one with me",
      "Book all three patients",
      "Set up meetings with these patients",
      "I need to see all of them",
      "Create appointments for the whole list"
    ],

    // Functions that MUST be included for this intent
    requiredFunctions: ['scheduleAppointment', 'findAvailableSlots', 'createAppointment'],

    // Functions that might be helpful depending on context
    optionalFunctions: ['getDoctorSchedule', 'checkConflicts', 'getPatientDetails'],

    // Context rules for smart defaults
    contextRules: {
      autoProvider: true,  // If user is provider and says "with me", use their ID
      requireTimeSlot: false,  // If no time specified, show available slots
      multiPatient: true  // Can handle multiple patients in one request
    },

    // Negative examples - what this intent is NOT
    negativeExamples: [
      "Show me my appointments",  // This is VIEW, not SCHEDULE
      "Cancel the appointment",    // This is CANCEL, not SCHEDULE
      "When is my next appointment",  // This is QUERY, not SCHEDULE
      "Move the appointment to tomorrow"  // This is RESCHEDULE, not SCHEDULE
    ]
  },

  viewAppointments: {
    name: "View Appointments",
    description: "User wants to see, list, or check existing appointments",
    examplePrompts: [
      // English
      "Show me today's appointments",
      "What appointments do I have",
      "List all scheduled appointments",
      "Display my schedule for today",
      "Who do I see today",
      "What's on my calendar",
      "Check my appointments",
      "View patient appointments",
      "Show me tomorrow's schedule",
      "What meetings are coming up",

      // Hebrew
      "הצג את התורים להיום",
      "מה יש לי היום",
      "תראה לי את הלוח שנה",
      "איזה פגישות יש לי",
      "מי המטופלים שלי היום"
    ],
    requiredFunctions: ['getAppointments', 'getTodayAppointments', 'getUpcomingAppointments'],
    optionalFunctions: ['getDoctorSchedule', 'getPatientAppointments'],
    contextRules: {
      autoProvider: true,
      defaultTimeframe: 'today'
    }
  },

  cancelAppointment: {
    name: "Cancel Appointment",
    description: "User wants to cancel, delete, or remove an appointment",
    examplePrompts: [
      // English
      "Cancel the appointment",
      "Remove this appointment",
      "Delete the scheduled meeting",
      "Cancel tomorrow's appointment",
      "Remove patient from schedule",
      "Delete this booking",
      "Cancel all appointments for today",
      "Remove the 3pm slot",

      // Hebrew
      "בטל את התור",
      "תמחק את הפגישה",
      "הסר את התור מהיומן",
      "בטל את כל התורים להיום"
    ],
    requiredFunctions: ['cancelAppointment', 'deleteAppointment'],
    optionalFunctions: ['notifyPatient', 'updateSchedule'],
    contextRules: {
      requireConfirmation: true,
      allowBulkCancel: true
    }
  },

  rescheduleAppointment: {
    name: "Reschedule Appointment",
    description: "User wants to move, change, or reschedule an existing appointment",
    examplePrompts: [
      // English
      "Move the appointment to next week",
      "Reschedule for tomorrow",
      "Change the appointment time",
      "Push the meeting to 4pm",
      "Postpone the appointment",
      "Move it to Monday",
      "Can we do 3pm instead",
      "Shift the appointment earlier",

      // Hebrew
      "העבר את התור למחר",
      "דחה את הפגישה",
      "שנה את השעה ל-3",
      "תזיז את התור ליום שני"
    ],
    requiredFunctions: ['rescheduleAppointment', 'updateAppointment', 'findAvailableSlots'],
    optionalFunctions: ['notifyPatient', 'checkConflicts'],
    contextRules: {
      preserveProvider: true,
      requireNewTime: true
    }
  },

  findAvailability: {
    name: "Find Available Slots",
    description: "User wants to check availability or find free time slots",
    examplePrompts: [
      // English
      "What times are available tomorrow",
      "Show me free slots",
      "When can I see the patient",
      "Check availability for next week",
      "Find an opening in my schedule",
      "What's open on Friday",
      "When is the doctor free",
      "Show available appointments",

      // Hebrew
      "מתי יש זמן פנוי",
      "הצג זמנים פנויים",
      "מתי אני יכול לראות את המטופל",
      "בדוק זמינות לשבוע הבא"
    ],
    requiredFunctions: ['findAvailableSlots', 'getDoctorAvailability'],
    optionalFunctions: ['getDoctorSchedule', 'suggestOptimalTime'],
    contextRules: {
      autoProvider: true,
      defaultDuration: 30
    }
  }
};

// Patient Management Intent Patterns
const patientIntentPatterns = {
  addPatient: {
    name: "Add New Patient",
    description: "User wants to add or register a new patient",
    examplePrompts: [
      // English
      "Add a new patient",
      "Register patient John Smith",
      "Create a new patient record",
      "I want to add a patient",
      "New patient registration",
      "Enroll a new patient",
      "Add patient to the system",
      "Register this person as a patient",

      // Hebrew
      "הוסף מטופל חדש",
      "רשום מטופל חדש",
      "צור רשומת מטופל",
      "אני רוצה להוסיף מטופל",
      "רישום מטופל חדש"
    ],
    requiredFunctions: ['addPatient', 'searchPatients', 'validatePatientData'],
    optionalFunctions: ['checkDuplicatePatient', 'getPatientDefaults'],
    contextRules: {
      checkDuplicates: true,
      validateRequired: true
    }
  },

  searchPatient: {
    name: "Search for Patient",
    description: "User wants to find or look up an existing patient",
    examplePrompts: [
      // English - Basic searches
      "Find patient John Smith",
      "Search for a patient",
      "Look up patient by name",
      "Find patient with ID 12345",
      "Search patient database",
      "Show me patient records",

      // English - Filtered searches
      "Show me the list of patients with medical device",
      "Show me the list of patinet with medical device", // Common typo
      "List patients with pacemakers",
      "Find patients with diabetes",
      "Show patients with high blood pressure",
      "List all patients with heart conditions",
      "Find patients on insulin",
      "Show me patients with implants",
      "List patients with medical devices",
      "Find patients with specific conditions",
      "Show patients with action items",
      "List patients needing follow-up",
      "Find patients with pending labs",
      "Show me patients with chronic conditions",
      "Which patients do we have",
      "List all patients",

      // Hebrew
      "חפש מטופל",
      "מצא את המטופל ג'ון סמית",
      "חיפוש מטופל",
      "איזה מטופלים יש לנו",
      "הצג רשימת מטופלים"
    ],
    requiredFunctions: ['searchPatients', 'searchPatientsByName', 'getPatientDetails', 'listAllPatients'],
    optionalFunctions: ['countPatients', 'findPatient', 'searchMedicalDevices', 'getFullMedicalReport', 'getPatientConditions'],
    contextRules: {
      includeInactive: false,
      detectFilters: true  // Detect if user is asking for filtered results
    }
  },

  updatePatient: {
    name: "Update Patient Information",
    description: "User wants to update or edit patient information",
    examplePrompts: [
      "Update patient information",
      "Change patient phone number",
      "Edit patient address",
      "Update patient insurance",
      "Modify patient details",
      "עדכן פרטי מטופל",
      "שנה כתובת מטופל"
    ],
    requiredFunctions: ['updatePatient', 'getPatientDetails', 'validatePatientData'],
    optionalFunctions: ['auditPatientChange', 'notifyPatientUpdate']
  },

  deletePatient: {
    name: "Delete Patient",
    description: "User wants to delete or remove a patient",
    examplePrompts: [
      "Delete patient record",
      "Remove patient from system",
      "Delete this patient",
      "מחק מטופל",
      "הסר מטופל מהמערכת"
    ],
    requiredFunctions: ['deletePatient', 'archivePatient'],
    optionalFunctions: ['confirmDeletion', 'backupPatientData'],
    contextRules: {
      requireConfirmation: true,
      checkDependencies: true
    }
  }
};

// Prescription intent patterns
const prescriptionIntentPatterns = {
  createPrescription: {
    name: "Create New Prescription",
    description: "User wants to prescribe medication to a patient",
    examplePrompts: [
      "Prescribe amoxicillin 500mg",
      "Write a prescription for antibiotics",
      "Give the patient pain medication",
      "Prescribe blood pressure medication",
      "Write Rx for patient",
      "Prescribe medication",
      "רשום מרשם לאנטיביוטיקה",
      "תן למטופל תרופה לכאב",
      "רשום מרשם",
      "תרופה למטופל"
    ],
    requiredFunctions: ['createPrescription', 'checkDrugInteractions', 'checkAllergies'],
    optionalFunctions: ['getDrugInformation', 'checkInsuranceCoverage', 'getPrescriptionHistory']
  },

  viewPrescriptions: {
    name: "View Prescriptions",
    description: "User wants to see prescription history or current medications",
    examplePrompts: [
      "Show prescription history",
      "What medications is the patient taking",
      "View current prescriptions",
      "List all medications",
      "הצג היסטוריית מרשמים",
      "איזה תרופות המטופל לוקח"
    ],
    requiredFunctions: ['getPrescriptions', 'getMedications', 'getPrescriptionHistory'],
    optionalFunctions: ['checkRefills', 'checkAdherence']
  },

  refillPrescription: {
    name: "Refill Prescription",
    description: "User wants to refill or renew a prescription",
    examplePrompts: [
      "Refill prescription",
      "Renew medication",
      "Patient needs refill",
      "חדש מרשם",
      "מילוי חוזר"
    ],
    requiredFunctions: ['refillPrescription', 'checkRefillEligibility'],
    optionalFunctions: ['notifyPharmacy', 'updatePrescriptionStatus']
  }
};

// Lab result intent patterns
const labIntentPatterns = {
  viewLabResults: {
    name: "View Lab Results",
    description: "User wants to see laboratory test results",
    examplePrompts: [
      "Show me the blood test results",
      "What were the lab results",
      "Display CBC results",
      "Check the glucose levels",
      "Show latest lab work",
      "View test results",
      "הצג תוצאות בדיקות דם",
      "מה התוצאות של בדיקת המעבדה",
      "תוצאות בדיקות",
      "בדיקות מעבדה"
    ],
    requiredFunctions: ['getLabResults', 'interpretLabResults', 'getLatestLabResults'],
    optionalFunctions: ['compareLabResults', 'flagAbnormalResults', 'trendAnalysis']
  },

  orderLabTest: {
    name: "Order Lab Test",
    description: "User wants to order laboratory tests",
    examplePrompts: [
      "Order CBC test",
      "Request blood work",
      "Order lab tests",
      "Schedule blood test",
      "הזמן בדיקת דם",
      "בקש בדיקות מעבדה"
    ],
    requiredFunctions: ['orderLabTest', 'getAvailableTests', 'checkTestPrerequisites'],
    optionalFunctions: ['scheduleLabAppointment', 'printLabOrder']
  },

  interpretLabResults: {
    name: "Interpret Lab Results",
    description: "User wants analysis or interpretation of lab results",
    examplePrompts: [
      "What do these results mean",
      "Interpret the lab values",
      "Analyze blood test",
      "Is this result normal",
      "מה המשמעות של התוצאות",
      "האם התוצאה תקינה"
    ],
    requiredFunctions: ['interpretLabResults', 'compareToNormalRange', 'generateLabSummary'],
    optionalFunctions: ['suggestFollowUpTests', 'correlateWithDiagnosis']
  }
};

// Vital Signs intent patterns
const vitalSignsIntentPatterns = {
  recordVitals: {
    name: "Record Vital Signs",
    description: "User wants to record or add vital signs",
    examplePrompts: [
      "Record blood pressure 120/80",
      "Add vital signs",
      "Record temperature 98.6",
      "Enter pulse 72",
      "Record vitals",
      "Blood pressure is 140/90",
      "רשום סימנים חיוניים",
      "לחץ דם 120/80",
      "דופק 72",
      "חום 37"
    ],
    requiredFunctions: ['addVitalSigns', 'recordVitalSigns', 'validateVitalSigns'],
    optionalFunctions: ['analyzeVitalSigns', 'setVitalAlerts', 'calculateNEWSScore']
  },

  viewVitals: {
    name: "View Vital Signs",
    description: "User wants to see vital signs history or current vitals",
    examplePrompts: [
      "Show vital signs",
      "What's the blood pressure",
      "Display latest vitals",
      "View vital signs history",
      "הצג סימנים חיוניים",
      "מה לחץ הדם"
    ],
    requiredFunctions: ['getVitalSigns', 'getLatestVitals', 'getVitalSignsHistory'],
    optionalFunctions: ['graphVitalTrends', 'compareVitals']
  },

  analyzeVitals: {
    name: "Analyze Vital Signs",
    description: "User wants analysis of vital signs",
    examplePrompts: [
      "Analyze vital signs",
      "Are the vitals normal",
      "Check for abnormal vitals",
      "Calculate NEWS score",
      "נתח סימנים חיוניים",
      "האם הסימנים תקינים"
    ],
    requiredFunctions: ['analyzeVitalSigns', 'calculateNEWSScore', 'detectAbnormalVitals'],
    optionalFunctions: ['predictDeterior ation', 'triggerAlerts']
  }
};

// Medical History intent patterns
const medicalHistoryIntentPatterns = {
  viewMedicalHistory: {
    name: "View Medical History",
    description: "User wants to see list of available medical categories for a patient",
    examplePrompts: [
      "Show medical history",
      "show medical data",
      "What's the patient's history",
      "medical data for patient",
      "הצג היסטוריה רפואית",
      "הצג נתונים רפואיים"
    ],
    requiredFunctions: ['getFullMedicalReport'],
    optionalFunctions: ['searchPatients', 'findPatient']
  },

  viewAIInsights: {
    name: "View AI Clinical Insights",
    description: "User wants to see AI-generated clinical analysis (8 insight collections)",
    examplePrompts: [
      "show AI insights",
      "AI analysis",
      "AI clinical insights",
      "show AI recommendations",
      "הצג תובנות AI",
      "ניתוח AI"
    ],
    requiredFunctions: ['getAIInsights'],
    optionalFunctions: ['searchPatients', 'findPatient']
  },

  addMedicalHistory: {
    name: "Add Medical History",
    description: "User wants to add or update medical history",
    examplePrompts: [
      "Add medical history",
      "Patient has diabetes",
      "Add past surgery",
      "Record medical condition",
      "הוסף היסטוריה רפואית",
      "למטופל יש סוכרת"
    ],
    requiredFunctions: ['addMedicalHistory', 'updateMedicalHistory', 'validateMedicalData'],
    optionalFunctions: ['linkToDiagnosis', 'updateProblemList']
  }
};

// Provider Meeting Intent Patterns - For professional meetings between providers
const providerMeetingIntentPatterns = {
  scheduleDoctorMeeting: {
    name: "Schedule Provider Meeting",
    description: "User wants to schedule a professional meeting or consultation between providers/doctors",
    examplePrompts: [
      // English variations - Direct requests
      "Schedule a meeting with Dr. Smith",
      "I need to meet with the cardiologist",
      "Book a consultation with another provider",
      "Set up a case discussion with Dr. Cohen",
      "Schedule a professional meeting with the specialist",
      "I want to discuss a patient with Dr. Johnson",
      "Arrange a meeting with the head of department",
      "Book time with the radiologist to review scans",
      "Set up a multidisciplinary team meeting",
      "Schedule a case conference",
      "I need to consult with the surgeon",
      "Book a peer consultation",
      "Schedule a meeting with another doctor",
      "Arrange a professional consultation",

      // Hebrew variations
      "קבע פגישה עם ד\"ר כהן",
      "אני צריך להיפגש עם הקרדיולוג",
      "תזמן פגישה מקצועית עם המומחה",
      "קבע דיון מקרה עם ד\"ר לוי",
      "אני רוצה להתייעץ עם המנתח",
      "סדר פגישה עם מנהל המחלקה",
      "קבע פגישת צוות רב מקצועי",
      "תקבע לי פגישה עם רופא אחר",
      "צור פגישה מקצועית",
      "זמן התייעצות עמיתים",

      // Context-specific variations
      "We need to discuss this complex case together",
      "Let's meet to review the treatment plan",
      "I'd like to get a second opinion from Dr. Miller",
      "Can we schedule a tumor board meeting",
      "Need to coordinate care with the psychiatrist",
      "Schedule a handoff meeting with the night shift doctor",
      "Book a teaching session with the residents"
    ],

    // Functions that MUST be included for this intent
    requiredFunctions: ['scheduleDoctorMeeting', 'searchUsers', 'getPatientProvider'],

    // Functions that might be helpful depending on context
    optionalFunctions: ['findAvailableSlots', 'getDoctorSchedule', 'checkConflicts'],

    // Context rules for smart defaults
    contextRules: {
      autoProvider: true,  // If user is provider and says "with me", use their ID
      distinguishFromPatientAppointment: true,  // Must distinguish from patient appointments
      requireProviderRole: true,  // Only providers can schedule provider meetings
      defaultDuration: 30  // Default meeting duration in minutes
    },

    // Negative examples - what this intent is NOT
    negativeExamples: [
      "Schedule an appointment with the patient",  // This is patient appointment
      "Book the patient with Dr. Smith",  // This is patient appointment
      "I need to see this patient",  // This is patient appointment
      "Cancel the meeting",  // This is CANCEL, not SCHEDULE
      "Show me my meetings"  // This is VIEW, not SCHEDULE
    ]
  },

  viewProviderMeetings: {
    name: "View Provider Meetings",
    description: "User wants to see, list, or check professional meetings with other providers",
    examplePrompts: [
      // English
      "Show me my provider meetings",
      "What meetings do I have with other doctors",
      "List professional meetings",
      "Display my consultations schedule",
      "Show upcoming case discussions",
      "What provider meetings are scheduled",
      "Check my professional meetings",
      "View peer consultations",

      // Hebrew
      "הצג פגישות מקצועיות",
      "מה הפגישות שלי עם רופאים אחרים",
      "תראה לי התייעצויות מקצועיות",
      "איזה דיוני מקרה יש לי"
    ],
    requiredFunctions: ['getDoctorMeetings'],
    optionalFunctions: ['getDoctorSchedule'],
    contextRules: {
      autoProvider: true,
      defaultTimeframe: 'upcoming'
    }
  },

  cancelProviderMeeting: {
    name: "Cancel Provider Meeting",
    description: "User wants to cancel a professional meeting with another provider",
    examplePrompts: [
      // English
      "Cancel the meeting with Dr. Smith",
      "Remove the consultation with the specialist",
      "Cancel tomorrow's case discussion",
      "Delete the provider meeting",

      // Hebrew
      "בטל את הפגישה עם ד\"ר כהן",
      "תמחק את ההתייעצות המקצועית",
      "הסר את דיון המקרה"
    ],
    requiredFunctions: ['cancelProviderMeeting'],
    optionalFunctions: ['notifyProvider', 'getDoctorMeetings'],
    contextRules: {
      requireConfirmation: true,
      notifyOtherProvider: true
    }
  }
};

// Export all intent patterns
module.exports = {
  appointmentIntentPatterns,
  patientIntentPatterns,
  prescriptionIntentPatterns,
  labIntentPatterns,
  vitalSignsIntentPatterns,
  medicalHistoryIntentPatterns,
  providerMeetingIntentPatterns,

  // Get all intent patterns combined
  getAllIntentPatterns: function() {
    return {
      ...appointmentIntentPatterns,
      ...patientIntentPatterns,
      ...prescriptionIntentPatterns,
      ...labIntentPatterns,
      ...vitalSignsIntentPatterns,
      ...medicalHistoryIntentPatterns,
      ...providerMeetingIntentPatterns
    };
  },

  // Helper function to get all intents for a category
  getAllIntents: function(category) {
    switch(category) {
      case 'appointment':
        return appointmentIntentPatterns;
      case 'patient':
        return patientIntentPatterns;
      case 'prescription':
        return prescriptionIntentPatterns;
      case 'lab':
        return labIntentPatterns;
      case 'vitals':
        return vitalSignsIntentPatterns;
      case 'history':
        return medicalHistoryIntentPatterns;
      case 'providerMeeting':
        return providerMeetingIntentPatterns;
      default:
        return {};
    }
  },

  // Get all available intent names for the analyzer
  getAllIntentNames: function() {
    return [
      // Appointments
      'scheduleAppointment',
      'viewAppointments',
      'cancelAppointment',
      'rescheduleAppointment',
      'findAvailability',
      // Patients
      'addPatient',
      'searchPatient',
      'updatePatient',
      'deletePatient',
      // Prescriptions
      'createPrescription',
      'viewPrescriptions',
      'refillPrescription',
      // Lab
      'viewLabResults',
      'orderLabTest',
      'interpretLabResults',
      // Vitals
      'recordVitals',
      'viewVitals',
      'analyzeVitals',
      // Medical History
      'viewMedicalHistory',
      'addMedicalHistory',
      // Provider Meetings
      'scheduleDoctorMeeting',
      'viewProviderMeetings',
      'cancelProviderMeeting',
      // Complex workflows
      'multiStepWorkflow',  // For complex multi-turn conversations
      'followUpAction'      // For actions on previous results
    ];
  },

  // Complex workflow patterns for multi-step operations
  complexWorkflowPatterns: {
    multiStepWorkflow: {
      name: "Multi-Step Workflow",
      description: "User is performing multiple related actions",
      examplePrompts: [
        "Show me patients and then schedule appointments",
        "Find patients needing follow-up and book them",
        "List patients and create appointments for them"
      ],
      requiredFunctions: [
        // Patient functions
        'searchPatients', 'getPatientDetails', 'listAllPatients',
        // Appointment functions
        'scheduleAppointment', 'findAvailableSlots', 'createAppointment',
        // Provider functions
        'getDoctorSchedule'
      ],
      contextRules: {
        preserveContext: true,
        allowMultipleIntents: true
      }
    }
  }
};