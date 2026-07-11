// Function Component Mapping Configuration
// Maps backend function names to frontend components for rich visualization

export const functionComponentMap = {
  // ===== PATIENT FUNCTIONS (30+ functions) =====
  'searchPatients': {
    component: 'UniversalDataDisplay',
    displayType: 'table',
    layout: 'split',
    showInSplit: true,
    actions: ['select', 'view', 'edit'],
    icon: '👥',
    title: {
      he: 'תוצאות חיפוש מטופלים',
      en: 'Patient Search Results'
    }
  },
  
  'getPatient': {
    component: 'UniversalDataDisplay',
    displayType: 'card',
    layout: 'split',
    showInSplit: true,
    actions: ['edit', 'history', 'documents', 'appointments'],
    icon: '👤',
    title: {
      he: 'פרטי מטופל',
      en: 'Patient Details'
    }
  },
  
  'addPatient': {
    component: 'PatientForm',
    displayType: 'form',
    layout: 'modal',
    showInModal: true,
    actions: ['save', 'cancel'],
    icon: '➕',
    title: {
      he: 'הוספת מטופל חדש',
      en: 'Add New Patient'
    }
  },
  
  'updatePatient': {
    component: 'PatientForm',
    displayType: 'form',
    layout: 'modal',
    showInModal: true,
    actions: ['save', 'cancel'],
    icon: '✏️',
    title: {
      he: 'עדכון פרטי מטופל',
      en: 'Update Patient Details'
    }
  },
  
  'listPatients': {
    component: 'PatientGrid',
    displayType: 'grid',
    layout: 'split',
    showInSplit: true,
    actions: ['filter', 'sort', 'export'],
    icon: '📋',
    title: {
      he: 'רשימת מטופלים',
      en: 'Patient List'
    }
  },
  
  'getMedicalHistory': {
    component: 'PatientCard',
    displayType: 'card',
    layout: 'split',
    showInSplit: true,
    actions: ['edit', 'print', 'export'],
    icon: '📋',
    title: {
      he: 'היסטוריה רפואית',
      en: 'Medical History'
    }
  },
  
  'getHistory': {
    component: 'PatientCard',
    displayType: 'card',
    layout: 'split',
    showInSplit: true,
    actions: ['edit', 'print', 'export'],
    icon: '📋',
    title: {
      he: 'היסטוריה רפואית',
      en: 'Medical History'
    }
  },
  
  'updateHistory': {
    component: 'PatientForm',
    displayType: 'form',
    layout: 'modal',
    showInModal: true,
    actions: ['save', 'cancel'],
    icon: '✏️',
    title: {
      he: 'עדכון היסטוריה רפואית',
      en: 'Update Medical History'
    }
  },
  
  // ===== LAB FUNCTIONS (20+ functions) =====
  'getLabResults': {
    component: 'UniversalDataDisplay',
    displayType: 'table-with-chart',
    layout: 'split',
    showInSplit: true,
    highlightAbnormal: true,
    showTrends: true,
    actions: ['print', 'export', 'trend', 'compare'],
    icon: '🧪',
    title: {
      he: 'תוצאות מעבדה',
      en: 'Lab Results'
    }
  },
  
  'compareLabResults': {
    component: 'LabComparison',
    displayType: 'comparison-chart',
    layout: 'split',
    showInSplit: true,
    actions: ['export', 'print', 'zoom'],
    icon: '📊',
    title: {
      he: 'השוואת תוצאות מעבדה',
      en: 'Lab Results Comparison'
    }
  },
  
  'getLabTrends': {
    component: 'LabTrendsChart',
    displayType: 'line-chart',
    layout: 'split',
    showInSplit: true,
    actions: ['timerange', 'export', 'print'],
    icon: '📈',
    title: {
      he: 'מגמות תוצאות מעבדה',
      en: 'Lab Results Trends'
    }
  },
  
  // ===== DOCUMENT FUNCTIONS (25+ functions) =====
  'uploadDocument': {
    component: 'DocumentUpload',
    displayType: 'upload-progress',
    layout: 'inline',
    showProgress: true,
    actions: ['cancel', 'retry'],
    icon: '📤',
    title: {
      he: 'העלאת מסמך',
      en: 'Document Upload'
    }
  },
  
  'viewDocument': {
    component: 'DocumentViewer',
    displayType: 'viewer',
    layout: 'split',
    showInSplit: true,
    actions: ['download', 'print', 'analyze', 'zoom'],
    icon: '📄',
    title: {
      he: 'צפייה במסמך',
      en: 'View Document'
    }
  },
  
  'getDocuments': {
    component: 'DocumentGallery',
    displayType: 'gallery',
    layout: 'split',
    showInSplit: true,
    actions: ['filter', 'sort', 'upload', 'delete'],
    icon: '📁',
    title: {
      he: 'מסמכים רפואיים',
      en: 'Medical Documents'
    }
  },
  
  'analyzeDocument': {
    component: 'DocumentAnalysis',
    displayType: 'analysis-result',
    layout: 'split',
    showInSplit: true,
    actions: ['save', 'export', 'edit'],
    icon: '🔍',
    title: {
      he: 'ניתוח מסמך',
      en: 'Document Analysis'
    }
  },
  
  // ===== MEDICATION FUNCTIONS (20+ functions) =====
  'getMedications': {
    component: 'MedicationList',
    displayType: 'medication-cards',
    layout: 'split',
    showInSplit: true,
    actions: ['refill', 'discontinue', 'edit', 'interactions'],
    icon: '💊',
    title: {
      he: 'רשימת תרופות',
      en: 'Medications'
    }
  },
  
  'checkDrugInteractions': {
    component: 'DrugInteractions',
    displayType: 'alert-matrix',
    layout: 'modal',
    showInModal: true,
    severity: 'dynamic', // warning, danger, info based on results
    actions: ['acknowledge', 'override', 'alternatives'],
    icon: '⚠️',
    title: {
      he: 'בדיקת אינטראקציות תרופתיות',
      en: 'Drug Interactions Check'
    }
  },
  
  'prescribeMedication': {
    component: 'PrescriptionForm',
    displayType: 'prescription-form',
    layout: 'modal',
    showInModal: true,
    actions: ['prescribe', 'save-draft', 'cancel'],
    icon: '📝',
    title: {
      he: 'מרשם חדש',
      en: 'New Prescription'
    }
  },
  
  'getMedicationSchedule': {
    component: 'MedicationSchedule',
    displayType: 'calendar',
    layout: 'split',
    showInSplit: true,
    actions: ['edit', 'print', 'reminder'],
    icon: '📅',
    title: {
      he: 'לוח תרופות',
      en: 'Medication Schedule'
    }
  },
  
  // ===== APPOINTMENT FUNCTIONS (15+ functions) =====
  'scheduleAppointment': {
    component: 'AppointmentForm',
    displayType: 'booking-form',
    layout: 'modal',
    showInModal: true,
    actions: ['book', 'check-availability', 'cancel'],
    icon: '📆',
    title: {
      he: 'קביעת תור',
      en: 'Schedule Appointment'
    }
  },
  
  'getAppointments': {
    component: 'AppointmentCalendar',
    displayType: 'calendar',
    layout: 'split',
    showInSplit: true,
    viewModes: ['month', 'week', 'day', 'list'],
    actions: ['reschedule', 'cancel', 'checkin', 'add'],
    icon: '🗓️',
    title: {
      he: 'לוח תורים',
      en: 'Appointments'
    }
  },
  
  'getAvailableSlots': {
    component: 'SlotPicker',
    displayType: 'slot-grid',
    layout: 'inline',
    showInline: true,
    actions: ['select', 'refresh'],
    icon: '🕐',
    title: {
      he: 'זמנים פנויים',
      en: 'Available Slots'
    }
  },
  
  // ===== DIAGNOSIS FUNCTIONS (15+ functions) =====
  'getDiagnosis': {
    component: 'DiagnosisCard',
    displayType: 'diagnosis-result',
    layout: 'split',
    showInSplit: true,
    actions: ['save', 'print', 'second-opinion'],
    icon: '🩺',
    title: {
      he: 'אבחון',
      en: 'Diagnosis'
    }
  },
  
  'suggestDifferentialDiagnosis': {
    component: 'DifferentialList',
    displayType: 'probability-list',
    layout: 'split',
    showInSplit: true,
    showProbabilities: true,
    actions: ['explore', 'compare', 'save'],
    icon: '🔬',
    title: {
      he: 'אבחנה מבדלת',
      en: 'Differential Diagnosis'
    }
  },
  
  // ===== BILLING FUNCTIONS (10+ functions) =====
  'generateInvoice': {
    component: 'InvoicePreview',
    displayType: 'invoice',
    layout: 'modal',
    showInModal: true,
    actions: ['send', 'print', 'download', 'edit'],
    icon: '🧾',
    title: {
      he: 'חשבונית',
      en: 'Invoice'
    }
  },
  
  'getPaymentHistory': {
    component: 'PaymentHistory',
    displayType: 'transaction-list',
    layout: 'split',
    showInSplit: true,
    actions: ['filter', 'export', 'receipt'],
    icon: '💳',
    title: {
      he: 'היסטוריית תשלומים',
      en: 'Payment History'
    }
  },
  
  // ===== STATISTICS FUNCTIONS (10+ functions) =====
  'getPracticeStatistics': {
    component: 'StatsDashboard',
    displayType: 'dashboard',
    layout: 'full',
    showInFull: true,
    widgets: ['patients', 'appointments', 'revenue', 'treatments'],
    actions: ['timerange', 'export', 'share'],
    icon: '📊',
    title: {
      he: 'סטטיסטיקות מרפאה',
      en: 'Practice Statistics'
    }
  },
  
  'generateReport': {
    component: 'ReportViewer',
    displayType: 'report',
    layout: 'split',
    showInSplit: true,
    actions: ['download', 'print', 'email'],
    icon: '📑',
    title: {
      he: 'דוח',
      en: 'Report'
    }
  }
};

// Helper function to get component config by function name
export const getComponentConfig = (functionName) => {
  return functionComponentMap[functionName] || {
    component: 'DefaultCard',
    displayType: 'text',
    layout: 'inline',
    icon: '📋',
    title: {
      he: 'תוצאה',
      en: 'Result'
    }
  };
};

// Get all functions by category
export const getFunctionsByCategory = (category) => {
  const categories = {
    patient: ['searchPatients', 'getPatient', 'addPatient', 'updatePatient', 'listPatients', 'getMedicalHistory', 'getHistory', 'updateHistory'],
    lab: ['getLabResults', 'compareLabResults', 'getLabTrends'],
    document: ['uploadDocument', 'viewDocument', 'getDocuments', 'analyzeDocument'],
    medication: ['getMedications', 'checkDrugInteractions', 'prescribeMedication', 'getMedicationSchedule'],
    appointment: ['scheduleAppointment', 'getAppointments', 'getAvailableSlots'],
    diagnosis: ['getDiagnosis', 'suggestDifferentialDiagnosis'],
    billing: ['generateInvoice', 'getPaymentHistory'],
    statistics: ['getPracticeStatistics', 'generateReport']
  };
  
  return categories[category] || [];
};

// Determine if function result should trigger split screen
export const shouldShowInSplitScreen = (functionName) => {
  const config = functionComponentMap[functionName];
  return config && (config.showInSplit || config.showInFull);
};

// Get the appropriate layout for a function
export const getFunctionLayout = (functionName) => {
  const config = functionComponentMap[functionName];
  return config?.layout || 'inline';
};

// Export display types for component factory
export const DISPLAY_TYPES = {
  TABLE: 'table',
  CARD: 'card',
  FORM: 'form',
  CHART: 'chart',
  GRID: 'grid',
  LIST: 'list',
  CALENDAR: 'calendar',
  VIEWER: 'viewer',
  DASHBOARD: 'dashboard',
  MODAL: 'modal',
  INLINE: 'inline'
};

// Export layout types
export const LAYOUT_TYPES = {
  SPLIT: 'split',
  FULL: 'full',
  MODAL: 'modal',
  INLINE: 'inline'
};