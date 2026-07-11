/**
 * Keyword-based Function Selector
 * Maps keywords to specific function groups to return 5-20 relevant functions
 * Solves the token limit issue (200k max) while maintaining accuracy
 */

class KeywordFunctionSelector {
  constructor() {
    this.initialized = false;
    this.functionGroups = this.initializeFunctionGroups();
  }

  initializeFunctionGroups() {
    return {
      // Patient search and list operations
      patientList: {
        keywords: [
          'list', 'show', 'display', 'patients', 'patient list', 'all patients',
          'patinet', 'pateint', 'patiant', // Common typos
          'רשימת', 'מטופלים', 'הצג'
        ],
        functions: [
          'listAllPatients',
          'countPatients',
          'searchPatientsByName',
          'findPatient',
          'getPatientDetails'
        ]
      },

      // Patient details and specific patient operations
      patientDetails: {
        keywords: [
          'details', 'information', 'info', 'about', 'patient details',
          'more details', 'tell me about', 'show me',
          'detials', 'infromation', // Common typos
          'פרטים', 'מידע'
        ],
        functions: [
          'getPatientDetails',
          'getPatientMedications',
          'getPatientAllergies',
          'getPatientMedicalHistory',
          'getPatientDocuments',
          'getPatientAppointments'
        ]
      },

      // Finding specific patients
      findPatient: {
        keywords: [
          'find', 'search', 'look for', 'locate', 'where',
          'michelle', 'john', 'william', 'sarah', 'emily', // Common names
          'חפש', 'מצא', 'איפה'
        ],
        functions: [
          'findPatient',
          'searchPatientsByName',
          'searchPatientsByPhone',
          'searchPatientsByEmail',
          'getPatientDetails',
          'searchPatients'
        ]
      },

      // Appointment operations
      appointments: {
        keywords: [
          'appointment', 'schedule', 'booking', 'calendar', 'upcoming',
          'appointments', 'scheduled', 'today', 'tomorrow',
          'appoitment', 'apointment', 'schedual', // Common typos
          'פגישה', 'תור', 'זימון', 'היום', 'מחר'
        ],
        functions: [
          'getPatientAppointments',
          'getTodayAppointments',
          'getUpcomingAppointments',
          'scheduleAppointment',
          'cancelAppointment',
          'updateAppointmentStatus',
          'getAvailableSlots',
          'rescheduleAppointment'
        ]
      },

      // Pronouns and context-dependent queries
      pronounContext: {
        keywords: [
          'she', 'her', 'he', 'him', 'his', 'they', 'them', 'this patient',
          'that patient', 'the patient'
        ],
        // Functions determined by context
        functions: [] // Will be filled based on previous context
      },

      // Medical operations
      medical: {
        keywords: [
          'medication', 'prescription', 'medicine', 'drug', 'allergy',
          'diagnosis', 'medical', 'history', 'condition', 'treatment',
          'mediction', 'perscription', 'alergy', // Common typos
          'תרופה', 'מרשם', 'אלרגיה', 'אבחנה'
        ],
        functions: [
          'getPatientMedications',
          'addMedication',
          'updateMedication',
          'getPatientAllergies',
          'addAllergy',
          'getPatientMedicalHistory',
          'addMedicalHistory',
          'generateDiagnosis',
          'recommendTreatment'
        ]
      },

      // Document operations
      documents: {
        keywords: [
          'document', 'file', 'upload', 'scan', 'pdf', 'image',
          'documents', 'files', 'report', 'lab',
          'documnet', 'uplod', // Common typos
          'מסמך', 'קובץ', 'סריקה'
        ],
        functions: [
          'uploadDocument',
          'getPatientDocuments',
          'analyzeUploadedDocuments',
          'analyzeDocument',
          'deleteDocument',
          'getDocumentStatus'
        ]
      },

      // User and practice management
      userManagement: {
        keywords: [
          'user', 'staff', 'doctor', 'nurse', 'admin', 'provider',
          'practice', 'clinic', 'settings'
        ],
        functions: [
          'listUsers',
          'addUser',
          'updateUserRole',
          'getPracticeInfo',
          'updatePracticeSettings'
        ]
      }
    };
  }

  /**
   * Analyze the query and conversation context to determine what the user is asking about
   */
  analyzeContext(messages) {
    const context = {
      hasPatientMention: false,
      patientName: null,
      previousFunction: null,
      topic: null
    };

    // Analyze previous messages for context
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        const content = msg.content?.toLowerCase() || '';

        // Check for patient names
        const namePatterns = [
          /michelle\s+hall/i,
          /john\s+smith/i,
          /william\s+young/i,
          /sarah\s+johnson/i,
          /emily\s+thompson/i
        ];

        for (const pattern of namePatterns) {
          const match = content.match(pattern);
          if (match) {
            context.hasPatientMention = true;
            context.patientName = match[0];
            break;
          }
        }

        // Check for topics
        if (content.includes('appointment')) context.topic = 'appointments';
        if (content.includes('medication')) context.topic = 'medical';
        if (content.includes('patient')) context.hasPatientMention = true;
      }
    }

    return context;
  }

  /**
   * Select 5-20 relevant functions based on keywords and context
   */
  selectFunctions(query, messages = []) {
    const queryLower = query.toLowerCase();
    const context = this.analyzeContext(messages);
    const selectedFunctions = new Set();
    const matchedGroups = [];

    // Check each function group for keyword matches
    for (const [groupName, group] of Object.entries(this.functionGroups)) {
      let score = 0;

      // Check keywords
      for (const keyword of group.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += keyword.split(' ').length; // Multi-word keywords get higher score
        }
      }

      if (score > 0) {
        matchedGroups.push({ name: groupName, score, functions: group.functions });
      }
    }

    // Sort by score (highest first)
    matchedGroups.sort((a, b) => b.score - a.score);

    // Handle pronouns with context
    if (queryLower.match(/\b(she|her|he|him|his|they|them|this patient|that patient)\b/)) {
      if (context.hasPatientMention) {
        // Add patient-related functions when pronouns refer to a patient
        if (queryLower.includes('appointment')) {
          this.functionGroups.pronounContext.functions = [
            'getPatientAppointments',
            'scheduleAppointment',
            'getUpcomingAppointments'
          ];
        } else if (queryLower.includes('medication')) {
          this.functionGroups.pronounContext.functions = [
            'getPatientMedications',
            'addMedication'
          ];
        } else {
          // General patient functions for pronouns
          this.functionGroups.pronounContext.functions = [
            'getPatientDetails',
            'getPatientAppointments',
            'getPatientMedications',
            'getPatientMedicalHistory'
          ];
        }

        // Add pronoun context functions with high priority
        matchedGroups.unshift({
          name: 'pronounContext',
          score: 100,
          functions: this.functionGroups.pronounContext.functions
        });
      }
    }

    // Add functions from matched groups (aim for 5-20 total)
    for (const group of matchedGroups) {
      for (const func of group.functions) {
        selectedFunctions.add(func);
        if (selectedFunctions.size >= 20) break;
      }
      if (selectedFunctions.size >= 20) break;
    }

    // If we have too few functions, add some common ones
    if (selectedFunctions.size < 5) {
      const commonFunctions = [
        'listAllPatients',
        'findPatient',
        'getPatientDetails',
        'getTodayAppointments',
        'scheduleAppointment'
      ];

      for (const func of commonFunctions) {
        selectedFunctions.add(func);
        if (selectedFunctions.size >= 5) break;
      }
    }

    return Array.from(selectedFunctions);
  }
}

module.exports = new KeywordFunctionSelector();