/**
 * Complete Medical Grid Mappings for all 184 GET Functions
 * Auto-generated from medical-grid-system configuration
 * Each function maps to a specific grid template with column definitions
 */

const medicalGridTemplateService = require('./medicalGridTemplateService');

// Import all 184 function definitions
const { getFunctions } = require('../medical-grid-system/configs/ALL_GET_FUNCTIONS');

// Generate grid mappings for all medical GET functions
const medicalGridMappings = {};

getFunctions.forEach(func => {
  const gridConfig = medicalGridTemplateService.getGridConfig(func.name);

  medicalGridMappings[func.name] = {
    gridType: 'medical-data-grid',
    title: func.name.replace(/^get/, '').replace(/([A-Z])/g, ' $1').trim(),
    category: func.category,
    collection: func.collection,
    priority: func.priority,

    // Column configuration from template service
    columns: gridConfig?.columns?.map(col => col.id) || [],
    headers: gridConfig?.columns?.map(col => col.headerName) || [],

    // Column-specific properties
    columnWidths: gridConfig?.columns?.reduce((acc, col) => {
      acc[col.id] = col.width;
      return acc;
    }, {}) || {},

    // Sortable columns
    sortableColumns: gridConfig?.columns?.filter(col => col.sortable).map(col => col.id) || [],

    // Filterable columns
    filterableColumns: gridConfig?.columns?.filter(col => col.filterable).map(col => col.id) || [],

    // Hidden columns (for linking/actions)
    hiddenColumns: [`${func.collection}Id`, 'patientId', '_id', 'createdBy', 'lastModifiedBy'],

    // Frozen columns (stay visible on horizontal scroll)
    frozenColumns: gridConfig?.columns?.filter(col => col.frozen).map(col => col.id) || ['patientName'],

    // Cell renderers for special formatting
    cellRenderers: gridConfig?.columns?.reduce((acc, col) => {
      if (col.cellRenderer) {
        acc[col.id] = col.cellRenderer;
      }
      return acc;
    }, {}) || {},

    // Data formatting rules
    formatters: gridConfig?.formatters || {},

    // Quick filters
    quickFilters: gridConfig?.filters?.quickFilters || [],

    // Advanced filters
    advancedFilters: gridConfig?.filters?.advancedFilters || [],

    // Row actions
    rowActions: gridConfig?.actions?.row || [],

    // Bulk actions
    bulkActions: gridConfig?.actions?.bulk || [],

    // Context menu actions
    contextMenuActions: gridConfig?.actions?.contextMenu || [],

    // Features
    features: gridConfig?.features || {
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: func.priority !== 'CRITICAL',
      editable: func.priority !== 'CRITICAL',
      realTimeUpdates: func.priority === 'CRITICAL',
      virtualScrolling: true,
      pagination: true
    },

    // Performance settings
    performance: gridConfig?.performance || {
      pageSize: func.priority === 'CRITICAL' ? 50 : 100,
      cacheEnabled: true,
      cacheDuration: func.priority === 'CRITICAL' ? 30 : 300
    }
  };
});

// Specific overrides for certain functions that need custom configuration
const customOverrides = {
  // Core Medical Records - High Priority Functions
  'getAppointments': {
    ...medicalGridMappings['getAppointments'],
    columns: ['patientName', 'appointmentDate', 'appointmentTime', 'providerName', 'department',
              'appointmentType', 'status', 'reason', 'duration', 'location'],
    headers: ['Patient', 'Date', 'Time', 'Provider', 'Department',
              'Type', 'Status', 'Reason', 'Duration', 'Location'],
    quickFilters: [
      { id: 'today', label: 'Today' },
      { id: 'thisWeek', label: 'This Week' },
      { id: 'upcoming', label: 'Upcoming' },
      { id: 'myPatients', label: 'My Patients' }
    ],
    cellRenderers: {
      status: 'StatusBadgeRenderer',
      appointmentDate: 'DateRenderer',
      appointmentTime: 'TimeRenderer',
      patientName: 'LinkRenderer'
    }
  },

  'getMedications': {
    ...medicalGridMappings['getMedications'],
    columns: ['patientName', 'medicationName', 'dosage', 'frequency', 'route',
              'startDate', 'endDate', 'prescriber', 'status', 'refills', 'instructions'],
    headers: ['Patient', 'Medication', 'Dosage', 'Frequency', 'Route',
              'Start Date', 'End Date', 'Prescriber', 'Status', 'Refills', 'Instructions'],
    cellRenderers: {
      status: 'StatusBadgeRenderer',
      medicationName: 'MedicationRenderer', // Shows generic/brand, highlights controlled substances
      refills: 'RefillRenderer',
      startDate: 'DateRenderer',
      endDate: 'DateRenderer'
    },
    features: {
      ...medicalGridMappings['getMedications'].features,
      drugInteractionCheck: true,
      allergyCheck: true
    }
  },

  'getAllergies': {
    ...medicalGridMappings['getAllergies'],
    columns: ['patientName', 'allergen', 'category', 'severity', 'reaction',
              'onsetDate', 'verificationStatus', 'reportedBy', 'lastReaction'],
    headers: ['Patient', 'Allergen', 'Category', 'Severity', 'Reaction',
              'Onset Date', 'Verified', 'Reported By', 'Last Reaction'],
    cellRenderers: {
      severity: 'SeverityRenderer', // Color-coded with icons
      allergen: 'AllergenRenderer', // Bold for severe, red for life-threatening
      verificationStatus: 'VerificationRenderer'
    },
    features: {
      ...medicalGridMappings['getAllergies'].features,
      alwaysVisible: true, // Critical safety information
      alertBanner: true // Show red banner for life-threatening allergies
    }
  },

  'getVitalSignsLogs': {
    ...medicalGridMappings['getVitalSignsLogs'],
    columns: ['patientName', 'recordedAt', 'bloodPressure', 'heartRate', 'temperature',
              'respiratoryRate', 'oxygenSaturation', 'weight', 'bmi', 'recordedBy'],
    headers: ['Patient', 'Date/Time', 'BP', 'HR', 'Temp', 'RR', 'O2 Sat', 'Weight', 'BMI', 'Recorded By'],
    cellRenderers: {
      bloodPressure: 'BloodPressureRenderer',
      heartRate: 'VitalRenderer',
      temperature: 'TemperatureRenderer',
      oxygenSaturation: 'OxygenRenderer',
      recordedAt: 'DateTimeRenderer'
    },
    features: {
      ...medicalGridMappings['getVitalSignsLogs'].features,
      trendGraphs: true,
      abnormalHighlight: true
    }
  },

  'getLabResults': {
    ...medicalGridMappings['getLabResults'],
    columns: ['patientName', 'testName', 'result', 'referenceRange', 'flag',
              'collectionDate', 'resultDate', 'status', 'orderedBy', 'lab'],
    headers: ['Patient', 'Test', 'Result', 'Reference', 'Flag',
              'Collected', 'Resulted', 'Status', 'Ordered By', 'Lab'],
    cellRenderers: {
      result: 'LabResultRenderer', // Highlights abnormal values
      flag: 'FlagRenderer', // H/L/Critical indicators
      status: 'StatusBadgeRenderer',
      collectionDate: 'DateTimeRenderer',
      resultDate: 'DateTimeRenderer'
    },
    quickFilters: [
      { id: 'abnormal', label: 'Abnormal Only' },
      { id: 'critical', label: 'Critical Values' },
      { id: 'pending', label: 'Pending Results' },
      { id: 'today', label: 'Today\'s Results' }
    ]
  },

  // Hospital & Emergency - Critical Functions
  'getEmergencyReports': {
    ...medicalGridMappings['getEmergencyReports'],
    priority: 'CRITICAL',
    columns: ['patientName', 'arrivalTime', 'chiefComplaint', 'triageLevel',
              'vitalSigns', 'disposition', 'attendingPhysician', 'status'],
    headers: ['Patient', 'Arrival', 'Chief Complaint', 'Triage',
              'Vitals', 'Disposition', 'Attending', 'Status'],
    cellRenderers: {
      triageLevel: 'TriageLevelRenderer', // Color-coded 1-5
      vitalSigns: 'VitalsRenderer',
      status: 'EmergencyStatusRenderer',
      arrivalTime: 'DateTimeRenderer'
    },
    features: {
      ...medicalGridMappings['getEmergencyReports'].features,
      realTimeUpdates: true,
      autoRefresh: 30, // seconds
      alertOnCritical: true
    }
  },

  'getIcuFlowSheets': {
    ...medicalGridMappings['getIcuFlowSheets'],
    priority: 'CRITICAL',
    columns: ['patientName', 'bedNumber', 'admissionDate', 'diagnosis', 'vitalSigns',
              'ventilatorSettings', 'vasopressors', 'sedation', 'intakeOutput', 'attending'],
    headers: ['Patient', 'Bed', 'Admitted', 'Diagnosis', 'Vitals',
              'Ventilator', 'Pressors', 'Sedation', 'I/O', 'Attending'],
    cellRenderers: {
      vitalSigns: 'ICUVitalsRenderer',
      ventilatorSettings: 'VentilatorRenderer',
      vasopressors: 'MedicationRenderer',
      intakeOutput: 'IntakeOutputRenderer'
    },
    features: {
      ...medicalGridMappings['getIcuFlowSheets'].features,
      realTimeUpdates: true,
      autoRefresh: 10, // seconds
      criticalAlerts: true,
      compactView: true // Fit more data
    }
  },

  // Surgical & Operative
  'getOperativeReports': {
    ...medicalGridMappings['getOperativeReports'],
    columns: ['patientName', 'procedureDate', 'procedureName', 'surgeon',
              'operatingRoom', 'duration', 'anesthesiaType', 'complications', 'disposition'],
    headers: ['Patient', 'Date', 'Procedure', 'Surgeon',
              'OR', 'Duration', 'Anesthesia', 'Complications', 'Disposition'],
    cellRenderers: {
      procedureDate: 'DateRenderer',
      duration: 'DurationRenderer',
      complications: 'ComplicationRenderer'
    }
  },

  // Cardiology
  'getEcgReports': {
    ...medicalGridMappings['getEcgReports'],
    columns: ['patientName', 'studyDate', 'rhythm', 'rate', 'prInterval',
              'qrsComplex', 'qtInterval', 'axis', 'interpretation', 'cardiologist'],
    headers: ['Patient', 'Date', 'Rhythm', 'Rate', 'PR',
              'QRS', 'QT', 'Axis', 'Interpretation', 'Cardiologist'],
    cellRenderers: {
      rhythm: 'RhythmRenderer',
      interpretation: 'InterpretationRenderer',
      studyDate: 'DateRenderer'
    },
    features: {
      ...medicalGridMappings['getEcgReports'].features,
      waveformPreview: true
    }
  },

  'getEchoReports': {
    ...medicalGridMappings['getEchoReports'],
    columns: ['patientName', 'studyDate', 'ejectionFraction', 'wallMotion',
              'valvularFunction', 'chamberSize', 'findings', 'cardiologist'],
    headers: ['Patient', 'Date', 'EF%', 'Wall Motion',
              'Valves', 'Chambers', 'Findings', 'Cardiologist'],
    cellRenderers: {
      ejectionFraction: 'PercentageRenderer',
      wallMotion: 'WallMotionRenderer',
      studyDate: 'DateRenderer'
    }
  },

  // Imaging & Radiology
  'getMriReports': {
    ...medicalGridMappings['getMriReports'],
    columns: ['patientName', 'studyDate', 'bodyPart', 'technique', 'contrast',
              'findings', 'impression', 'radiologist', 'status'],
    headers: ['Patient', 'Date', 'Body Part', 'Technique', 'Contrast',
              'Findings', 'Impression', 'Radiologist', 'Status'],
    cellRenderers: {
      contrast: 'BooleanRenderer',
      studyDate: 'DateRenderer',
      status: 'StatusBadgeRenderer'
    },
    features: {
      ...medicalGridMappings['getMriReports'].features,
      imagePreview: true,
      pacsIntegration: true
    }
  },

  // Pediatrics
  'getPediatricGrowthCharts': {
    ...medicalGridMappings['getPediatricGrowthCharts'],
    columns: ['patientName', 'age', 'measurementDate', 'weight', 'weightPercentile',
              'height', 'heightPercentile', 'bmi', 'bmiPercentile', 'headCircumference'],
    headers: ['Patient', 'Age', 'Date', 'Weight', 'Wt %ile',
              'Height', 'Ht %ile', 'BMI', 'BMI %ile', 'HC'],
    cellRenderers: {
      weightPercentile: 'PercentileRenderer',
      heightPercentile: 'PercentileRenderer',
      bmiPercentile: 'PercentileRenderer',
      measurementDate: 'DateRenderer'
    },
    features: {
      ...medicalGridMappings['getPediatricGrowthCharts'].features,
      growthChartVisualization: true,
      cdcComparison: true
    }
  },

  // Oncology
  'getChemotherapyRecords': {
    ...medicalGridMappings['getChemotherapyRecords'],
    priority: 'CRITICAL',
    columns: ['patientName', 'cycleDate', 'protocol', 'cycleNumber', 'drugs',
              'dosage', 'bsa', 'premedications', 'toxicities', 'oncologist'],
    headers: ['Patient', 'Date', 'Protocol', 'Cycle', 'Drugs',
              'Dosage', 'BSA', 'Premed', 'Toxicities', 'Oncologist'],
    cellRenderers: {
      drugs: 'ChemoDrugRenderer',
      toxicities: 'ToxicityRenderer',
      cycleDate: 'DateRenderer'
    },
    features: {
      ...medicalGridMappings['getChemotherapyRecords'].features,
      cumulativeDoseTracking: true,
      toxicityGrading: true
    }
  },

  // Diagnostic & Laboratory
  'getPathologyReports': {
    ...medicalGridMappings['getPathologyReports'],
    columns: ['patientName', 'specimenDate', 'specimenType', 'procedure',
              'diagnosis', 'microscopic', 'grossDescription', 'pathologist', 'status'],
    headers: ['Patient', 'Date', 'Specimen', 'Procedure',
              'Diagnosis', 'Microscopic', 'Gross', 'Pathologist', 'Status'],
    cellRenderers: {
      diagnosis: 'DiagnosisRenderer',
      specimenDate: 'DateRenderer',
      status: 'StatusBadgeRenderer'
    }
  },

  // Therapy & Rehabilitation
  'getPhysicalTherapyNotes': {
    ...medicalGridMappings['getPhysicalTherapyNotes'],
    columns: ['patientName', 'sessionDate', 'therapist', 'diagnosis', 'goals',
              'interventions', 'response', 'plan', 'functionalStatus'],
    headers: ['Patient', 'Date', 'Therapist', 'Diagnosis', 'Goals',
              'Interventions', 'Response', 'Plan', 'Function'],
    cellRenderers: {
      functionalStatus: 'FunctionalStatusRenderer',
      sessionDate: 'DateRenderer'
    }
  },

  // Mental Health
  'getPsychiatricEvaluations': {
    ...medicalGridMappings['getPsychiatricEvaluations'],
    columns: ['patientName', 'evaluationDate', 'psychiatrist', 'chiefComplaint',
              'diagnosis', 'medications', 'riskAssessment', 'plan', 'followUp'],
    headers: ['Patient', 'Date', 'Psychiatrist', 'Chief Complaint',
              'Diagnosis', 'Medications', 'Risk', 'Plan', 'Follow-up'],
    cellRenderers: {
      riskAssessment: 'RiskRenderer',
      medications: 'MedicationListRenderer',
      evaluationDate: 'DateRenderer'
    },
    features: {
      ...medicalGridMappings['getPsychiatricEvaluations'].features,
      confidentialityNotice: true,
      restrictedAccess: true
    }
  }
};

// Merge custom overrides with generated mappings
Object.assign(medicalGridMappings, customOverrides);

// Export the complete mappings
module.exports = medicalGridMappings;