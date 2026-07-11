import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AnesthesiaRecordsDocumentPDFTemplate from '../pdf-templates/AnesthesiaRecordsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AnesthesiaRecordsDocument.css';

/**
 * AnesthesiaRecordsDocument - Inline Editing Edition
 *
 * Features:
 * - Bar chart visualization for clinical scores (ASA, STOP-BANG, Apfel, RCRI)
 * - Four-level search filtering with field labels
 * - Blue theme (#2563eb primary)
 * - Mini-card pattern with row-level copy buttons
 * - Per-section approve with inline editing
 * - PDF export with bar charts
 */

// ==================== SECTION_FIELDS for per-section approve ====================
const SECTION_FIELDS = {
  headerInfo: ['surgeryDate', 'anesthesiaType', 'intubationType', 'asaClassification', 'functionalCapacity', 'surgicalProcedure', 'surgeon'],
  anesthesiologyAssessment: ['anesthesiologyAssessment'],
  airwayAssessment: ['airwayAssessment'],
  anesthesiaPlan: ['anesthesiaPlan'],
  painManagement: ['painManagement'],
  induction: ['induction'],
  maintenance: ['maintenance'],
  emergence: ['emergence'],
  monitoring: ['monitoring'],
  operativeDetails: ['operativeDetails'],
  clinicalScores: ['clinicalScores'],
  pulmonaryFunctionTests: ['pulmonaryFunctionTests'],
  sleepStudy: ['sleepStudy'],
  medicalHistory: ['medicalHistory'],
  chiefComplaint: ['chiefComplaint'],
  reviewOfSystems: ['reviewOfSystems'],
  physicalExamination: ['physicalExamination'],
  historyOfPresentIllness: ['historyOfPresentIllness'],
  preOperativePreparation: ['preOperativePreparation'],
  postoperativeOrders: ['postoperativeOrders'],
  dvtProphylaxis: ['dvtProphylaxis'],
  assessmentAndPlan: ['assessmentAndPlan'],
  prognosis: ['prognosis'],
  consultationDetails: ['consultationDetails'],
  patientEducation: ['patientEducation'],
  administrativeData: ['administrativeData'],
  referrals: ['referrals'],
  followUpAppointments: ['followUpAppointments'],
  complications: ['complications'],
  bloodProductsOrdered: ['bloodProductsOrdered'],
  additionalNotes: ['additionalNotes'],
  findings: ['findings'],
  outcome: ['outcome'],
  followUp: ['followUp'],
};

// NON-EDITABLE fields
const NON_EDITABLE_FIELDS = ['procedureDate', 'createdAt', 'updatedAt', 'providers', '_id', 'patientId'];

// Sentence fields (long text)
const SENTENCE_FIELDS = [
  'historyOfPresentIllness', 'assessmentAndPlan', 'additionalNotes',
  'emergence', 'findings', 'outcome', 'followUp', 'bloodProductsOrdered'
];

// Object fields
const OBJECT_FIELDS = [
  'anesthesiologyAssessment', 'airwayAssessment', 'anesthesiaPlan', 'painManagement',
  'induction', 'maintenance', 'operativeDetails', 'clinicalScores',
  'pulmonaryFunctionTests', 'sleepStudy', 'medicalHistory', 'preOperativePreparation',
  'postoperativeOrders', 'dvtProphylaxis', 'consultationDetails', 'patientEducation',
  'administrativeData', 'chiefComplaint', 'reviewOfSystems', 'physicalExamination'
];

// Array fields
const ARRAY_FIELDS = ['monitoring', 'complications', 'referrals', 'followUpAppointments'];

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'anesthesia_recordsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// ==================== PLAIN FUNCTIONS (outside component) ====================

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.;])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

// Paren/bracket-aware comma split with a digit-guard: a comma sitting between two digits
// (e.g. "85,000" / "1,250 mL") is part of the number, NOT a clause separator.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') { depth++; current += ch; }
    else if (ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && !(/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || ''))) {
      const t = current.trim();
      if (t) result.push(t);
      current = '';
    } else {
      current += ch;
    }
  }
  const t = current.trim();
  if (t) result.push(t);
  return result;
};

// Convert a stored date value (ISO string / {$date} / Date) to YYYY-MM-DD for <input type="date">.
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch { return ''; }
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// Strip the trailing sentence/clause separator (';' or '.') + whitespace from a split segment so each
// row reads as a clean item (splitBySentence keeps the delimiter on the preceding segment).
const stripTrailingSep = (s) => (typeof s === 'string' ? s.replace(/[\s;.]+$/, '') : s);

// ── Time-field helpers (the value is a bare clock time → edit with <input type="time">) ──
// A value that is ONLY a clock time, e.g. "06:50 AM", "7:10 am", or 24h "14:30".
const isTimeValue = (s) => typeof s === 'string' && /^\s*\d{1,2}:\d{2}\s*(?:[AaPp][Mm])?\s*$/.test(s);

// Stored time ("06:50 AM" / "02:30 PM" / "14:30") → "HH:MM" 24h for the time input.
const toTimeInput = (timeStr) => {
  if (!timeStr) return '';
  const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = m[3] ? m[3].toUpperCase() : '';
  if (ap === 'AM') { if (h === 12) h = 0; }
  else if (ap === 'PM') { if (h < 12) h += 12; }
  if (h > 23 || parseInt(min, 10) > 59) return '';
  return `${String(h).padStart(2, '0')}:${min}`;
};

// 24h input "14:30" → 12h display "02:30 PM" (keeps the stored hh:mm AM/PM convention).
const fromTimeInput = (val) => {
  if (!val) return '';
  const m = String(val).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return val;
  const h = parseInt(m[1], 10);
  const min = m[2];
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, '0')}:${min} ${ap}`;
};

// ==================== BAR CHART VISUALIZATION ====================

const ANESTHESIA_SCORE_CATEGORIES = [
  {
    id: 'physical_status',
    name: 'Physical Status & Capacity',
    description: 'Overall health classification',
    scores: ['asaClass']
  },
  {
    id: 'perioperative_risk',
    name: 'Perioperative Risk Scores',
    description: 'Specific surgical risk factors',
    scores: ['stopBang', 'apfel', 'rcri']
  },
  {
    id: 'airway_assessment',
    name: 'Airway Assessment',
    description: 'Intubation difficulty indicators',
    scores: ['mallampati', 'intubationGrade']
  },
  {
    id: 'pulmonary_function',
    name: 'Pulmonary Function',
    description: 'Respiratory capacity measures',
    scores: ['fev1', 'fvc', 'fev1FvcRatio']
  },
  {
    id: 'sleep_study',
    name: 'Sleep Study Results',
    description: 'OSA severity indicators',
    scores: ['ahi', 'lowestO2']
  },
  {
    id: 'nsqip_risk',
    name: 'NSQIP Risk Calculator',
    description: 'Predicted surgical complications',
    scores: ['seriousComplication', 'anyComplication', 'pneumonia', 'cardiac', 'vte']
  }
];

const ANESTHESIA_SCORE_CONFIG = {
  asaClass: {
    max: 5,
    type: 'risk',
    label: 'ASA Physical Status',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val).toUpperCase();
      if (str.includes('VI') || str === '6') return 6;
      if (str.includes('V') || str === '5') return 5;
      if (str.includes('IV') || str === '4') return 4;
      if (str.includes('III') || str === '3') return 3;
      if (str.includes('II') || str === '2') return 2;
      if (str.includes('I') || str === '1') return 1;
      return null;
    },
    getInterpretation: (value) => {
      if (value === 1) return 'Healthy patient';
      if (value === 2) return 'Mild systemic disease';
      if (value === 3) return 'Severe systemic disease';
      if (value === 4) return 'Life-threatening disease';
      if (value === 5) return 'Moribund patient';
      if (value === 6) return 'Brain-dead organ donor';
      return '';
    }
  },
  stopBang: {
    max: 8,
    type: 'risk',
    label: 'STOP-BANG (OSA Risk)',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const fractionMatch = str.match(/^(\d+)\s*\/\s*8/);
      if (fractionMatch) return parseInt(fractionMatch[1]);
      const numMatch = str.match(/^(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value <= 2) return 'Low Risk OSA';
      if (value <= 4) return 'Intermediate Risk OSA';
      return 'High Risk OSA';
    }
  },
  apfel: {
    max: 4,
    type: 'risk',
    label: 'Apfel Score (PONV Risk)',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const fractionMatch = str.match(/^(\d+)\s*\/\s*4/);
      if (fractionMatch) return parseInt(fractionMatch[1]);
      const numMatch = str.match(/^(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value === 0) return '10% PONV risk';
      if (value === 1) return '21% PONV risk';
      if (value === 2) return '39% PONV risk';
      if (value === 3) return '61% PONV risk';
      if (value === 4) return '79% PONV risk';
      return '';
    }
  },
  rcri: {
    max: 6,
    type: 'risk',
    label: 'RCRI (Cardiac Risk)',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/^(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value === 0) return 'Low risk (0.4%)';
      if (value === 1) return 'Low risk (0.9%)';
      if (value === 2) return 'Intermediate risk (6.6%)';
      return 'High risk (>11%)';
    }
  },
  mallampati: {
    max: 4,
    type: 'risk',
    label: 'Mallampati Class',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val).toUpperCase();
      if (str.includes('IV') || str.includes('4')) return 4;
      if (str.includes('III') || str.includes('3')) return 3;
      if (str.includes('II') || str.includes('2')) return 2;
      if (str.includes('I') || str.includes('1')) return 1;
      return null;
    },
    getInterpretation: (value) => {
      if (value === 1) return 'Easy - Full uvula visible';
      if (value === 2) return 'Moderate - Partial uvula';
      if (value === 3) return 'Difficult - Soft palate only';
      if (value === 4) return 'Very Difficult - Hard palate only';
      return '';
    }
  },
  intubationGrade: {
    max: 4,
    type: 'risk',
    label: 'Intubation Grade',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/grade\s*(\d)/i);
      if (match) return parseInt(match[1]);
      const numMatch = str.match(/^(\d)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value === 1) return 'Full glottis visible';
      if (value === 2) return 'Posterior glottis only';
      if (value === 3) return 'Epiglottis only visible';
      if (value === 4) return 'No glottic structures';
      return '';
    }
  },
  fev1: {
    max: 100,
    type: 'protective',
    label: 'FEV1 (% Predicted)',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      const numMatch = str.match(/^(\d+(?:\.\d+)?)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value >= 80) return 'Normal';
      if (value >= 70) return 'Mild obstruction';
      if (value >= 60) return 'Moderate obstruction';
      if (value >= 50) return 'Moderately severe';
      return 'Severe obstruction';
    }
  },
  fvc: {
    max: 100,
    type: 'protective',
    label: 'FVC (% Predicted)',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      const numMatch = str.match(/^(\d+(?:\.\d+)?)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value >= 80) return 'Normal';
      if (value >= 70) return 'Mild restriction';
      if (value >= 60) return 'Moderate restriction';
      return 'Severe restriction';
    }
  },
  fev1FvcRatio: {
    max: 100,
    type: 'protective',
    label: 'FEV1/FVC Ratio',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      const numMatch = str.match(/^(\d+(?:\.\d+)?)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value >= 70) return 'Normal ratio';
      if (value >= 60) return 'Mild obstruction';
      return 'Obstructive pattern';
    }
  },
  ahi: {
    max: 60,
    type: 'risk',
    label: 'AHI (Events/Hour)',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)/);
      if (match) return parseFloat(match[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 5) return 'Normal';
      if (value < 15) return 'Mild OSA';
      if (value < 30) return 'Moderate OSA';
      return 'Severe OSA';
    }
  },
  lowestO2: {
    max: 100,
    type: 'protective',
    label: 'Lowest O2 Saturation',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      const numMatch = str.match(/^(\d+(?:\.\d+)?)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value >= 90) return 'Normal desaturation';
      if (value >= 85) return 'Mild desaturation';
      if (value >= 80) return 'Moderate desaturation';
      return 'Severe desaturation';
    }
  },
  seriousComplication: {
    max: 20,
    type: 'risk',
    label: 'Serious Complication Risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 2) return 'Low risk';
      if (value < 5) return 'Moderate risk';
      if (value < 10) return 'High risk';
      return 'Very high risk';
    }
  },
  anyComplication: {
    max: 25,
    type: 'risk',
    label: 'Any Complication Risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 5) return 'Low risk';
      if (value < 10) return 'Moderate risk';
      if (value < 15) return 'High risk';
      return 'Very high risk';
    }
  },
  pneumonia: {
    max: 10,
    type: 'risk',
    label: 'Pneumonia Risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 1) return 'Low risk';
      if (value < 3) return 'Moderate risk';
      return 'Elevated risk';
    }
  },
  cardiac: {
    max: 5,
    type: 'risk',
    label: 'Cardiac Risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 1) return 'Low risk';
      if (value < 2) return 'Moderate risk';
      return 'Elevated risk';
    }
  },
  vte: {
    max: 10,
    type: 'risk',
    label: 'VTE Risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 1) return 'Low risk';
      if (value < 3) return 'Moderate risk';
      return 'Elevated risk';
    }
  }
};

// Get color for RISK scores (higher = worse = red)
const getRiskColor = (percentage) => {
  if (percentage <= 25) return '#22c55e';
  if (percentage <= 50) return '#3b82f6';
  if (percentage <= 75) return '#f59e0b';
  return '#ef4444';
};

// Get color for PROTECTIVE scores (higher = better = green)
const getProtectiveColor = (percentage) => {
  if (percentage >= 80) return '#22c55e';
  if (percentage >= 60) return '#3b82f6';
  if (percentage >= 40) return '#f59e0b';
  return '#ef4444';
};

// Prepare chart data grouped by medical category
const prepareChartDataByCategory = (record) => {
  const dataSources = {
    asaClass: record.clinicalScores?.asaClass,
    stopBang: record.clinicalScores?.stopBang,
    apfel: record.clinicalScores?.apfel,
    rcri: record.clinicalScores?.rcri,
    mallampati: record.airwayAssessment?.mallampati,
    intubationGrade: record.airwayAssessment?.previousIntubationGrade,
    fev1: record.pulmonaryFunctionTests?.fev1,
    fvc: record.pulmonaryFunctionTests?.fvc,
    fev1FvcRatio: record.pulmonaryFunctionTests?.fev1FvcRatio,
    ahi: record.sleepStudy?.ahi,
    lowestO2: record.sleepStudy?.lowestO2,
    seriousComplication: record.prognosis?.nsqipRiskCalculator?.seriousComplication,
    anyComplication: record.prognosis?.nsqipRiskCalculator?.anyComplication,
    pneumonia: record.prognosis?.nsqipRiskCalculator?.pneumonia,
    cardiac: record.prognosis?.nsqipRiskCalculator?.cardiac,
    vte: record.prognosis?.nsqipRiskCalculator?.vte
  };

  const categories = [];

  ANESTHESIA_SCORE_CATEGORIES.forEach(category => {
    const categoryCharts = [];

    category.scores.forEach(key => {
      const config = ANESTHESIA_SCORE_CONFIG[key];
      if (!config) return;

      const rawValue = dataSources[key];
      if (!rawValue) return;

      const numericValue = config.parseValue(rawValue);
      if (numericValue === null) return;

      const percentage = Math.min(100, Math.round((numericValue / config.max) * 100));
      const color = config.type === 'protective' ? getProtectiveColor(percentage) : getRiskColor(percentage);
      const interpretation = config.getInterpretation(numericValue);

      categoryCharts.push({
        key,
        label: config.label,
        percentage,
        rawValue: String(rawValue),
        color,
        interpretation
      });
    });

    if (categoryCharts.length > 0) {
      categories.push({
        ...category,
        charts: categoryCharts
      });
    }
  });

  return categories;
};

// BarChart Component
const BarChart = ({ label, percentage, rawValue, color, interpretation, highlightFn }) => (
  <div className="bar-chart-row">
    <div className="bar-label">{highlightFn ? highlightFn(label) : label}</div>
    <div className="bar-container">
      <div className="bar-background">
        <div
          className="bar-fill"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <div className="bar-value" style={{ color }}>
        {highlightFn ? highlightFn(rawValue) : rawValue}
      </div>
    </div>
    <div className="bar-interpretation" style={{ color }}>
      {highlightFn ? highlightFn(interpretation) : interpretation}
    </div>
  </div>
);

// Legend Component
const Legend = () => (
  <div className="chart-legend">
    <div className="legend-item">
      <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
      <span className="legend-text">Low Risk</span>
    </div>
    <div className="legend-item">
      <span className="legend-color" style={{ backgroundColor: '#3b82f6' }}></span>
      <span className="legend-text">Moderate</span>
    </div>
    <div className="legend-item">
      <span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span>
      <span className="legend-text">High Risk</span>
    </div>
    <div className="legend-item">
      <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
      <span className="legend-text">Very High</span>
    </div>
  </div>
);

// Category Header Component
const CategoryHeader = ({ name, description, highlightFn }) => (
  <div className="category-header">
    <span className="category-name">
      {highlightFn ? highlightFn(name) : name}
    </span>
    <span className="category-description">
      {highlightFn ? highlightFn(description) : description}
    </span>
  </div>
);

// ==================== END BAR CHART VISUALIZATION ====================

const AnesthesiaRecordsDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState(null);
  // Editing state
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  const canEdit = true;

  // Data unwrapping - handle wrapped collection structure
  const unwrappedData = rawDoc?.documentData || rawDoc;
  let recordsArray = [];
  if (unwrappedData?.anesthesia_records && Array.isArray(unwrappedData.anesthesia_records)) {
    recordsArray = unwrappedData.anesthesia_records;
  } else if (Array.isArray(unwrappedData)) {
    recordsArray = unwrappedData;
  } else if (unwrappedData && typeof unwrappedData === 'object') {
    recordsArray = [unwrappedData];
  }

  const record = recordsArray[0] || {};
  const idx = 0;

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    recordsArray.forEach((rec, recIdx) => {
      const recordId = rec && (rec._id?.$oid || rec._id || '');
      const recDrafts = recordId ? store[recordId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${recIdx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = true;
        nSentences[`${fieldPart}-${recIdx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [recordsArray]);

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return String(dateValue);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return String(dateValue);
    }
  };

  // Format object key to readable label
  const formatKey = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  };

  // Highlight text function - Word-by-word with regex escape
  const highlightText = (text) => {
    if (!text) return '';
    const textStr = String(text);
    if (!searchTerm.trim()) return textStr;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    if (searchWords.length === 0) return textStr;

    const escapedWords = searchWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');

    const parts = textStr.split(regex);
    if (parts.length === 1) return textStr;

    return (
      <>
        {parts.map((part, i) => {
          const isMatch = searchWords.some(w => part.toLowerCase() === w.toLowerCase());
          return isMatch ? <mark key={i}>{part}</mark> : part;
        })}
      </>
    );
  };

  // shouldShowRow - Row-level filtering with field labels
  const shouldShowRow = (rec, ...rowContent) => {
    if (!searchTerm.trim()) return true;

    const rawWords = searchTerm.toLowerCase().trim().split(/\s+/);
    const searchWords = rawWords
      .map(w => w.replace(/[()[\],.<>&:%]+/g, ''))
      .filter((w, i) => w.length > 1 || (w.length === 1 && rawWords[i] === w));

    if (rec._showAllSections) return true;

    const rowText = rowContent
      .filter(Boolean)
      .map(item => String(item).toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' '))
      .join(' ');

    return searchWords.every(word => {
      const wordNoHyphen = word.replace(/-/g, ' ');
      return rowText.includes(word) || rowText.includes(wordNoHyphen);
    });
  };

  // shouldShowSection - Section-level filtering
  const shouldShowSection = (rec, sectionTitle, sectionContent) => {
    if (!searchTerm.trim()) return true;

    const rawWords = searchTerm.toLowerCase().trim().split(/\s+/);
    const searchWords = rawWords
      .map(w => w.replace(/[()[\],.<>&:%]+/g, ''))
      .filter((w, i) => w.length > 1 || (w.length === 1 && rawWords[i] === w));

    if (rec._showAllSections) return true;

    const titleLower = (sectionTitle || '').toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' ');
    const contentText = Array.isArray(sectionContent)
      ? sectionContent.filter(Boolean).map(s => String(s).toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' ')).join(' ')
      : (sectionContent || '').toString().toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' ');

    const combinedText = `${titleLower} ${contentText}`;

    return searchWords.every(word => {
      const wordNoHyphen = word.replace(/-/g, ' ');
      return combinedText.includes(word) || combinedText.includes(wordNoHyphen);
    });
  };

  // ─── Editing helpers ──────────────────────────────────────────────────

  const getEffectiveDot = (rec, dotPath, recIdx) => {
    const editKey = `${dotPath}-${recIdx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const parts = dotPath.split('.');
    let current = rec;
    for (const p of parts) { current = current?.[p]; }
    return current;
  };

  const getEffective = (rec, fieldName, recIdx) => {
    const editKey = `${fieldName}-${recIdx}`;
    return localEdits[editKey] !== undefined ? localEdits[editKey] : rec[fieldName];
  };

  const getEffectiveArray = (rec, fieldName, recIdx) => {
    const editKey = `${fieldName}-${recIdx}`;
    return localEdits[editKey] !== undefined ? localEdits[editKey] : (rec[fieldName] || []);
  };

  const handleStartEdit = useCallback((fieldName, recIdx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${recIdx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleStartEditArray = useCallback((fieldName, recIdx, itemIdx, currentValue) => {
    const editKey = `${fieldName}-${recIdx}-item${itemIdx}`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((rec, fieldName, recIdx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = rec._id?.$oid || rec._id || '';
    if (!recordId) { console.error('Cannot save - no _id'); return; }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = editTrackingKey || `${fieldName}-${recIdx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const fullEditKey = `${fieldName}-${recIdx}`;

    // Stage locally only — no DB write on save.
    setLocalEdits(prev => ({ ...prev, [fullEditKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedFields(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${recIdx}`]; return u; });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // reconstructFullText
  const reconstructFullText = (allSentences, sIdx, editedSentence, fieldName, recIdx, hasFullEdit) => {
    const updated = allSentences.map((s, i) => {
      let t;
      if (i === sIdx) {
        t = editedSentence;
      } else if (!hasFullEdit) {
        const pKey = `${fieldName}.s${i}-${recIdx}`;
        t = localEdits[pKey] !== undefined ? localEdits[pKey] : s;
      } else {
        t = s;
      }
      return (t && !/[.!?;]$/.test(t)) ? t + '.' : t;
    });
    return updated.join(' ');
  };

  // saveSentence
  const saveSentence = (rec, fieldName, recIdx, sectionId, sIdx) => {
    let editedSentenceVal = editValue.trim();
    if (editedSentenceVal && !/[.!?]$/.test(editedSentenceVal)) editedSentenceVal += '.';
    const fullEditKey = `${fieldName}-${recIdx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (rec[fieldName] || '');
    const allCurrent = splitBySentence(String(sourceText));
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentenceVal, fieldName, recIdx, hasFullEdit);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    if (extraCount > 0) {
      const editedMap = {};
      editedMap[`${fieldName}-${recIdx}-s${sIdx}`] = 'edited';
      for (let si = sIdx + 1; si <= sIdx + extraCount; si++) {
        editedMap[`${fieldName}-${recIdx}-s${si}`] = 'added';
      }
      setEditedSentences(prev => {
        const cleaned = {};
        for (const key of Object.keys(prev)) {
          if (!key.startsWith(`${fieldName}-${recIdx}-s`)) cleaned[key] = prev[key];
        }
        return { ...cleaned, ...editedMap };
      });
    }
    handleSaveField(rec, fieldName, recIdx, sectionId, sIdx, fullText);
  };

  // saveArrayItem
  const saveArrayItem = (rec, fieldName, recIdx, sectionId, itemIdx) => {
    const newValue = editValue.trim();
    const currentArray = [...getEffectiveArray(rec, fieldName, recIdx)];
    currentArray[itemIdx] = newValue;
    handleSaveField(rec, fieldName, recIdx, sectionId, 0, currentArray, `${fieldName}-${recIdx}-item${itemIdx}`);
  };

  // saveClause — for a comma-split string sub-field, replace clause cIdx and re-join with ", "
  // (lossless round-trip: splitByComma → edit one clause → join ', ' reproduces the field text).
  const saveClause = (rec, fieldName, recIdx, sectionId, cIdx) => {
    const editedClause = editValue.trim();
    const sourceText = getEffectiveDot(rec, fieldName, recIdx);
    const clauses = splitByComma(String(sourceText != null ? sourceText : ''));
    if (cIdx < clauses.length) clauses[cIdx] = editedClause;
    else clauses.push(editedClause);
    const fullText = clauses.join(', ');
    handleSaveField(rec, fieldName, recIdx, sectionId, cIdx, fullText, `${fieldName}-${recIdx}-s${cIdx}`);
  };

  // sectionHasEdits
  const sectionHasEdits = useCallback((sectionId, recIdx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    if (approvedSections[`${sectionId}-${recIdx}`]) return false;
    return fields.some(f => {
      // Match both a top-level field ("induction-0-s2") and its nested dot-path sub-fields
      // ("induction.spinalTechnique-0-s2") so per-clause edits inside object sections light the badge.
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        if (!(key.startsWith(`${f}-${recIdx}-s`) || (key.startsWith(`${f}.`) && key.includes(`-${recIdx}-s`)))) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
      const hasObjectEdits = Object.keys(editedFields).some(key =>
        key.startsWith(`${f}-${recIdx}`) || (key.startsWith(`${f}.`) && key.endsWith(`-${recIdx}`))
      );
      const hasArrayEdits = Object.keys(editedSentences).some(key => {
        if (!(key.startsWith(`${f}-${recIdx}-item`) || (key.startsWith(`${f}.`) && key.includes(`-${recIdx}-item`)))) return false;
        return editedSentences[key] === 'edited';
      });
      return hasSentenceEdits || hasObjectEdits || hasArrayEdits;
    });
  }, [editedSentences, editedFields, approvedSections]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (rec, recIdx, sectionId) => {
    const approveKey = `${sectionId}-${recIdx}`;
    if (approvedSections[approveKey]) return; // ONE-WAY

    const recordId = rec._id?.$oid || rec._id || '';
    const fields = SECTION_FIELDS[sectionId] || [];
    const suffix = `-${recIdx}`;

    // Collect this section's staged (pending) edits from localEdits.
    const toCommit = Object.keys(localEdits).filter(editKey => {
      if (!pendingEdits[editKey] || !editKey.endsWith(suffix)) return false;
      const fieldPart = editKey.slice(0, -suffix.length); // "field" or "parent.child" or "field.arrayIndex"
      const baseField = fieldPart.split('.')[0];
      return fields.includes(fieldPart) || fields.includes(baseField);
    });

    setApproving(true);
    try {
      // Persist each staged field to the DB now. Add arrayIndex ONLY when the trailing dot-segment is numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(trailing, 10);
        if (recordId) {
          const resp = await secureApiClient.put(`/api/edit/anesthesia_records/${recordId}/edit`, payload);
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        }
      }
      // Flag the section approved (audit trail)
      if (recordId) {
        await secureApiClient.put(`/api/edit/anesthesia_records/${recordId}/approve`, {
          sectionId,
          approved: true,
        });
      }

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(editKey => { delete store[recordId][editKey.slice(0, -suffix.length)]; });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [approveKey]: true }));
      setEditedSentences(prev => {
        const cleaned = { ...prev };
        fields.forEach(f => {
          Object.keys(cleaned).forEach(key => {
            // Match both top-level ("induction-0-s2") and nested dot-path ("induction.anesthesiaStart-0-s0") keys.
            if (key.startsWith(`${f}-${recIdx}-`) || (key.startsWith(`${f}.`) && key.includes(`-${recIdx}-`))) delete cleaned[key];
          });
        });
        return cleaned;
      });
      setEditedFields(prev => {
        const cleaned = { ...prev };
        fields.forEach(f => {
          Object.keys(cleaned).forEach(key => {
            if (key.startsWith(`${f}-${recIdx}`) || (key.startsWith(`${f}.`) && key.endsWith(`-${recIdx}`))) delete cleaned[key];
          });
        });
        return cleaned;
      });
    } catch (error) {
      console.error('Approve failed:', error);
    } finally {
      setApproving(false);
    }
  }, [approvedSections, localEdits, pendingEdits]);

  // pdfData memo — merges localEdits into recordsArray for PDF export
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return recordsArray;
    return recordsArray.map((rec, recIdx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const eIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (eIdx === recIdx) {
          if (fieldName.includes('.')) {
            // Nested sub-field (e.g. "induction.anesthesiaStart") — deep-set onto a cloned path so the
            // PDF reads the updated nested value (a flat merged["induction.x"] key would never be seen).
            const parts = fieldName.split('.');
            let cur = merged;
            for (let i = 0; i < parts.length - 1; i++) {
              const p = parts[i];
              cur[p] = Array.isArray(cur[p]) ? [...cur[p]] : { ...(cur[p] || {}) };
              cur = cur[p];
            }
            cur[parts[parts.length - 1]] = editVal;
          } else {
            merged[fieldName] = editVal;
          }
        }
      }
      return merged;
    });
  }, [recordsArray, localEdits, pendingEdits]);

  // Document-level filtering with field labels in searchableText
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return recordsArray;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);

    return recordsArray.map(rec => {
      const searchableText = [
        'anesthesia record', 'Anesthesia Record', 'ANESTHESIA RECORD',
        'surgery information', 'Surgery Information', 'SURGERY INFORMATION',
        'risk assessment overview', 'Risk Assessment Overview', 'RISK ASSESSMENT OVERVIEW',
        'anesthesiology assessment', 'Anesthesiology Assessment', 'ANESTHESIOLOGY ASSESSMENT',
        'airway assessment', 'Airway Assessment', 'AIRWAY ASSESSMENT',
        'anesthesia plan', 'Anesthesia Plan', 'ANESTHESIA PLAN',
        'pain management', 'Pain Management', 'PAIN MANAGEMENT',
        'induction', 'Induction', 'INDUCTION',
        'maintenance', 'Maintenance', 'MAINTENANCE',
        'monitoring', 'Monitoring', 'MONITORING',
        'operative details', 'Operative Details', 'OPERATIVE DETAILS',
        'clinical scores', 'Clinical Scores', 'CLINICAL SCORES',
        'pulmonary function tests', 'Pulmonary Function Tests', 'PULMONARY FUNCTION TESTS',
        'sleep study', 'Sleep Study', 'SLEEP STUDY',
        'preoperative preparation', 'Preoperative Preparation', 'PREOPERATIVE PREPARATION',
        'postoperative orders', 'Postoperative Orders', 'POSTOPERATIVE ORDERS',
        'dvt prophylaxis', 'DVT Prophylaxis', 'DVT PROPHYLAXIS',
        'medical history', 'Medical History', 'MEDICAL HISTORY',
        'history of present illness', 'History of Present Illness', 'HISTORY OF PRESENT ILLNESS',
        'consultation details', 'Consultation Details', 'CONSULTATION DETAILS',
        'patient education', 'Patient Education', 'PATIENT EDUCATION',
        'referrals', 'Referrals', 'REFERRALS',
        'assessment and plan', 'Assessment and Plan', 'ASSESSMENT AND PLAN',
        'prognosis', 'Prognosis', 'PROGNOSIS',
        'additional notes', 'Additional Notes', 'ADDITIONAL NOTES',

        // Bar chart category names
        'physical status & capacity', 'Physical Status & Capacity',
        'physical status and capacity', 'Physical Status and Capacity',
        'overall health classification', 'Overall Health Classification',
        'perioperative risk scores', 'Perioperative Risk Scores',
        'perioperative risk', 'Perioperative Risk',
        'specific surgical risk factors', 'Specific Surgical Risk Factors',
        'airway assessment', 'Airway Assessment',
        'intubation difficulty indicators', 'Intubation Difficulty Indicators',
        'intubation difficulty', 'Intubation Difficulty',
        'pulmonary function', 'Pulmonary Function',
        'respiratory capacity measures', 'Respiratory Capacity Measures',
        'respiratory capacity', 'Respiratory Capacity',
        'sleep study results', 'Sleep Study Results',
        'sleep study', 'Sleep Study',
        'osa severity indicators', 'OSA Severity Indicators',
        'osa severity', 'OSA Severity',
        'nsqip risk calculator', 'NSQIP Risk Calculator',
        'nsqip risk', 'NSQIP Risk', 'NSQIP',
        'predicted surgical complications', 'Predicted Surgical Complications',

        // Bar chart score labels
        'asa physical status', 'ASA Physical Status', 'asa class', 'ASA Class', 'asa', 'ASA',
        'stop-bang', 'STOP-BANG', 'stop bang', 'STOP BANG', 'stopbang',
        'stop-bang osa risk', 'osa risk', 'OSA Risk',
        'apfel score', 'Apfel Score', 'apfel', 'Apfel',
        'apfel score ponv risk', 'ponv risk', 'PONV Risk', 'ponv', 'PONV',
        'rcri', 'RCRI', 'rcri cardiac risk', 'cardiac risk', 'Cardiac Risk',
        'mallampati', 'Mallampati', 'mallampati class', 'Mallampati Class',
        'intubation grade', 'Intubation Grade',
        'fev1', 'FEV1', 'fev1 predicted', 'FEV1 Predicted', 'FEV1 (% Predicted)',
        'fvc', 'FVC', 'fvc predicted', 'FVC Predicted', 'FVC (% Predicted)',
        'fev1/fvc', 'FEV1/FVC', 'fev1 fvc', 'fev1/fvc ratio', 'FEV1/FVC Ratio',
        'ahi', 'AHI', 'apnea hypopnea index', 'ahi events hour', 'events/hour',
        'lowest o2', 'Lowest O2', 'lowest o2 saturation', 'Lowest O2 Saturation',
        'o2 saturation', 'O2 Saturation', 'oxygen saturation',
        'serious complication', 'Serious Complication', 'serious complication risk',
        'any complication', 'Any Complication', 'any complication risk',
        'pneumonia', 'Pneumonia', 'pneumonia risk',
        'cardiac', 'Cardiac', 'vte', 'VTE', 'vte risk',
        'venous thromboembolism',

        // Bar chart interpretations
        'healthy patient', 'mild systemic disease', 'severe systemic disease',
        'life-threatening disease', 'moribund patient',
        'low risk osa', 'intermediate risk osa', 'high risk osa',
        'ponv risk', '10% ponv risk', '21% ponv risk', '39% ponv risk', '61% ponv risk', '79% ponv risk',
        'low risk', 'intermediate risk', 'high risk',
        'easy', 'full uvula visible', 'moderate', 'partial uvula',
        'difficult', 'soft palate only', 'very difficult', 'hard palate only',
        'full glottis visible', 'posterior glottis only', 'epiglottis only visible', 'no glottic structures',
        'normal', 'mild obstruction', 'moderate obstruction', 'moderately severe', 'severe obstruction',
        'mild restriction', 'moderate restriction', 'severe restriction',
        'normal ratio', 'obstructive pattern',
        'mild osa', 'moderate osa', 'severe osa',
        'normal desaturation', 'mild desaturation', 'moderate desaturation', 'severe desaturation',
        'very high risk', 'elevated risk',

        // Field labels
        'surgery date', 'Surgery Date',
        'procedure date', 'Procedure Date',
        'anesthesia type', 'Anesthesia Type',
        'intubation type', 'Intubation Type',
        'asa classification', 'ASA Classification',
        'functional capacity', 'Functional Capacity',
        'surgical procedure', 'Surgical Procedure',
        'surgeon', 'Surgeon',
        'emergence', 'Emergence',
        'complications', 'Complications',
        'blood products ordered', 'Blood Products Ordered',
        'findings', 'Findings',
        'outcome', 'Outcome',
        'follow up', 'Follow Up',

        // Field values
        formatDate(rec.surgeryDate),
        formatDate(rec.procedureDate),
        rec.anesthesiaType,
        rec.intubationType,
        rec.asaClassification,
        rec.functionalCapacity,
        rec.surgicalProcedure,
        rec.surgeon,
        rec.emergence,
        rec.complications,
        rec.bloodProductsOrdered,
        rec.historyOfPresentIllness,
        rec.assessmentAndPlan,
        rec.additionalNotes,
        rec.findings,
        rec.outcome,
        rec.followUp,

        // Nested object contents
        rec.anesthesiologyAssessment ? JSON.stringify(rec.anesthesiologyAssessment) : '',
        rec.airwayAssessment ? JSON.stringify(rec.airwayAssessment) : '',
        rec.anesthesiaPlan ? JSON.stringify(rec.anesthesiaPlan) : '',
        rec.painManagement ? JSON.stringify(rec.painManagement) : '',
        rec.induction ? JSON.stringify(rec.induction) : '',
        rec.maintenance ? JSON.stringify(rec.maintenance) : '',
        rec.operativeDetails ? JSON.stringify(rec.operativeDetails) : '',
        rec.clinicalScores ? JSON.stringify(rec.clinicalScores) : '',
        rec.pulmonaryFunctionTests ? JSON.stringify(rec.pulmonaryFunctionTests) : '',
        rec.sleepStudy ? JSON.stringify(rec.sleepStudy) : '',
        rec.preOperativePreparation ? JSON.stringify(rec.preOperativePreparation) : '',
        rec.postoperativeOrders ? JSON.stringify(rec.postoperativeOrders) : '',
        rec.dvtProphylaxis ? JSON.stringify(rec.dvtProphylaxis) : '',
        rec.medicalHistory ? JSON.stringify(rec.medicalHistory) : '',
        rec.consultationDetails ? JSON.stringify(rec.consultationDetails) : '',
        rec.patientEducation ? JSON.stringify(rec.patientEducation) : '',
        rec.prognosis ? JSON.stringify(rec.prognosis) : '',
        rec.providers ? JSON.stringify(rec.providers) : '',
        rec.chiefComplaint ? JSON.stringify(rec.chiefComplaint) : '',
        rec.reviewOfSystems ? JSON.stringify(rec.reviewOfSystems) : '',
        rec.physicalExamination ? JSON.stringify(rec.physicalExamination) : '',
        rec.administrativeData ? JSON.stringify(rec.administrativeData) : '',

        // Array contents
        rec.monitoring ? rec.monitoring.join(' ') : '',
        rec.referrals ? rec.referrals.join(' ') : ''
      ].filter(Boolean).join(' ').toLowerCase();

      const matches = searchWords.every(word => searchableText.includes(word));

      const docTitleSearch = searchTerm.toLowerCase().includes('anesthesia') &&
                            searchTerm.toLowerCase().includes('record');

      return matches ? { ...rec, _showAllSections: docTitleSearch } : null;
    }).filter(Boolean);
  }, [recordsArray, searchTerm]);

  // Copy section function
  const copySection = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      const textarea = window.document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      window.document.body.appendChild(textarea);
      textarea.select();
      window.document.execCommand('copy');
      window.document.body.removeChild(textarea);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    }
  };

  // Helper: format object section text with subtitle + numbered pattern
  const formatObjectCopyText = (obj) => {
    if (!obj || typeof obj !== 'object') return '';
    return Object.entries(obj).filter(([, v]) => v != null).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${formatKey(key)}\n${value.map((item, i) => `  ${i + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n')}`;
      }
      if (typeof value === 'object' && value !== null) {
        const subs = Object.entries(value).filter(([, v]) => v != null);
        return `${formatKey(key)}\n${subs.map(([k, v], i) => `  ${i + 1}. ${formatKey(k)}: ${v}`).join('\n')}`;
      }
      const clauses = splitByComma(String(value));
      if (clauses.length > 1) {
        return `${formatKey(key)}\n${clauses.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`;
      }
      return `${formatKey(key)}\n  1. ${value}`;
    }).join('\n\n');
  };

  // Helper: format narrative text with sentence-level numbering
  const formatNarrativeCopyText = (text) => {
    if (!text) return '';
    const sentences = splitBySentence(String(text));
    if (sentences.length === 0) return String(text);
    return sentences.map((s, i) => `  ${i + 1}. ${stripTrailingSep(s)}`).join('\n');
  };

  // Helper: format array with numbered items
  const formatArrayCopyText = (arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return '';
    return arr.map((item, i) => `  ${i + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n');
  };

  // Copy All function
  const copyAll = () => {
    let text = '=== ANESTHESIA RECORDS ===\n\n';

    filteredRecords.forEach((rec, recIdx) => {
      text += `Anesthesia Record ${recIdx + 1}\n`;
      text += '='.repeat(60) + '\n\n';

      // Header fields - subtitle + numbered
      text += 'SURGERY INFORMATION:\n';
      if (getEffectiveDot(rec, 'surgeryDate', recIdx)) text += `Surgery Date\n  1. ${formatDate(getEffectiveDot(rec, 'surgeryDate', recIdx))}\n\n`;
      if (rec.procedureDate) text += `Procedure Date\n  1. ${formatDate(rec.procedureDate)}\n\n`;
      const effAnesthesiaType = getEffective(rec, 'anesthesiaType', recIdx);
      if (effAnesthesiaType) text += `Anesthesia Type\n  1. ${effAnesthesiaType}\n\n`;
      const effIntubationType = getEffective(rec, 'intubationType', recIdx);
      if (effIntubationType) text += `Intubation Type\n  1. ${effIntubationType}\n\n`;
      const effAsaClass = getEffective(rec, 'asaClassification', recIdx);
      if (effAsaClass) text += `ASA Classification\n  1. ${effAsaClass}\n\n`;
      const effFunctional = getEffective(rec, 'functionalCapacity', recIdx);
      if (effFunctional) text += `Functional Capacity\n  1. ${effFunctional}\n\n`;
      const effProcedure = getEffective(rec, 'surgicalProcedure', recIdx);
      if (effProcedure) text += `Surgical Procedure\n  1. ${effProcedure}\n\n`;
      const effSurgeon = getEffective(rec, 'surgeon', recIdx);
      if (effSurgeon) text += `Surgeon\n  1. ${effSurgeon}\n\n`;

      // Object sections - subtitle + numbered
      const objectSections = [
        ['anesthesiologyAssessment', 'ANESTHESIOLOGY ASSESSMENT'],
        ['airwayAssessment', 'AIRWAY ASSESSMENT'],
        ['anesthesiaPlan', 'ANESTHESIA PLAN'],
        ['painManagement', 'PAIN MANAGEMENT'],
        ['induction', 'INDUCTION'],
        ['maintenance', 'MAINTENANCE'],
        ['operativeDetails', 'OPERATIVE DETAILS'],
        ['clinicalScores', 'CLINICAL SCORES'],
        ['pulmonaryFunctionTests', 'PULMONARY FUNCTION TESTS'],
        ['sleepStudy', 'SLEEP STUDY'],
        ['medicalHistory', 'MEDICAL HISTORY'],
        ['preOperativePreparation', 'PREOPERATIVE PREPARATION'],
        ['postoperativeOrders', 'POSTOPERATIVE ORDERS'],
        ['dvtProphylaxis', 'DVT PROPHYLAXIS'],
        ['consultationDetails', 'CONSULTATION DETAILS'],
        ['patientEducation', 'PATIENT EDUCATION'],
        ['prognosis', 'PROGNOSIS'],
        ['administrativeData', 'ADMINISTRATIVE DATA'],
      ];

      objectSections.forEach(([field, title]) => {
        const val = rec[field];
        if (val && typeof val === 'object' && Object.keys(val).length > 0) {
          text += `${title}:\n${formatObjectCopyText(val)}\n\n`;
        }
      });

      // Array sections - numbered
      if (rec.monitoring && rec.monitoring.length > 0) {
        text += `MONITORING:\n${formatArrayCopyText(rec.monitoring)}\n\n`;
      }
      if (rec.referrals && rec.referrals.length > 0) {
        text += `REFERRALS:\n${formatArrayCopyText(rec.referrals)}\n\n`;
      }
      if (rec.complications && Array.isArray(rec.complications) && rec.complications.length > 0) {
        text += `COMPLICATIONS:\n${formatArrayCopyText(rec.complications)}\n\n`;
      }
      if (rec.followUpAppointments && rec.followUpAppointments.length > 0) {
        text += `FOLLOW-UP APPOINTMENTS:\n${formatArrayCopyText(rec.followUpAppointments)}\n\n`;
      }

      // Narrative sections - sentence-level numbering
      const effHpi = getEffective(rec, 'historyOfPresentIllness', recIdx);
      if (effHpi) text += `HISTORY OF PRESENT ILLNESS:\n${formatNarrativeCopyText(effHpi)}\n\n`;

      const effAssessment = getEffective(rec, 'assessmentAndPlan', recIdx);
      if (effAssessment) text += `ASSESSMENT AND PLAN:\n${formatNarrativeCopyText(effAssessment)}\n\n`;

      const effNotes = getEffective(rec, 'additionalNotes', recIdx);
      if (effNotes) text += `ADDITIONAL NOTES:\n${formatNarrativeCopyText(effNotes)}\n\n`;

      // Simple fields - subtitle + numbered
      const effEmergence = getEffective(rec, 'emergence', recIdx);
      if (effEmergence) text += `EMERGENCE:\n${formatNarrativeCopyText(effEmergence)}\n\n`;

      const effBloodProducts = getEffective(rec, 'bloodProductsOrdered', recIdx);
      if (effBloodProducts) text += `BLOOD PRODUCTS ORDERED:\n${formatNarrativeCopyText(effBloodProducts)}\n\n`;

      const effFindings = getEffective(rec, 'findings', recIdx);
      if (effFindings) text += `FINDINGS:\n${formatNarrativeCopyText(effFindings)}\n\n`;

      const effOutcome = getEffective(rec, 'outcome', recIdx);
      if (effOutcome) text += `OUTCOME:\n${formatNarrativeCopyText(effOutcome)}\n\n`;

      const effFollowUp = getEffective(rec, 'followUp', recIdx);
      if (effFollowUp) text += `FOLLOW UP:\n${formatNarrativeCopyText(effFollowUp)}\n\n`;

      // Non-editable complications (if string, not array)
      const effComplications = getEffective(rec, 'complications', recIdx);
      if (effComplications && typeof effComplications === 'string') {
        text += `COMPLICATIONS:\n${formatNarrativeCopyText(effComplications)}\n\n`;
      }

      // Providers - non-editable
      if (rec.providers && Object.keys(rec.providers).length > 0) {
        text += `PROVIDERS:\n${formatObjectCopyText(rec.providers)}\n\n`;
      }

      text += '\n' + '='.repeat(80) + '\n\n';
    });

    copySection(text, 'all');
  };

  // ─── Render helpers ──────────────────────────────────────────────────

  // Render approve button below Copy Section
  const renderApproveBtn = (rec, sectionId, recIdx) => {
    const approveKey = `${sectionId}-${recIdx}`;
    const hasEdits = sectionHasEdits(sectionId, recIdx);
    const isApproved = approvedSections[approveKey];
    if (!hasEdits && !isApproved) return null;
    return (
      <button
        className={`approve-btn ${isApproved ? 'approved' : 'pending'}`}
        onClick={() => handleApproveSection(rec, recIdx, sectionId)}
        disabled={approving}
      >
        {approving ? 'Approving...' : isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // Render editable field (simple short fields)
  const renderEditableField = (rec, fieldName, recIdx, sectionId, label, copyId) => {
    const editKey = `${fieldName}-${recIdx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const val = getEffectiveDot(rec, fieldName, recIdx);
    const displayVal = val != null ? String(val) : null;
    if (displayVal === null && !isEditing) return null;

    return (
      <React.Fragment key={copyId}>
        <div className="rec-mini-card">
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleSaveField(rec, fieldName, recIdx, sectionId, 0);
                    } else if (e.key === 'Escape') {
                      setEditingField(null);
                      setEditValue('');
                    }
                  }}
                  disabled={saving}
                />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => handleSaveField(rec, fieldName, recIdx, sectionId, 0)} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`row-content${canEdit ? ' editable' : ''}`}
                  onClick={() => canEdit && handleStartEdit(fieldName, recIdx, displayVal, 0)}
                >
                  <span className="content-value">{highlightText(displayVal)}</span>
                  {canEdit && !isEdited && <span className="edit-indicator">{'\u270E'}</span>}
                </div>
                <button
                  className={`copy-btn${copiedSectionId === copyId ? ' copied' : ''}`}
                  onClick={() => copySection(label ? `${label}\n  1. ${displayVal}` : `1. ${displayVal}`, copyId)}
                >
                  {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
                </button>
              </>
            )}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // Render sentence editable field (long text fields)
  const renderSentenceEditableField = (rec, fieldName, recIdx, sectionId, label, copyId) => {
    const val = getEffective(rec, fieldName, recIdx);
    const strVal = val != null ? String(val) : '';
    if (!strVal) return renderEditableField(rec, fieldName, recIdx, sectionId, label, copyId);

    const sentences = splitBySentence(strVal);
    if (sentences.length <= 1) {
      return renderEditableField(rec, fieldName, recIdx, sectionId, label, copyId);
    }

    return sentences.map((sentence, sIdx) => {
      const cleanSentence = stripTrailingSep(sentence);
      const parsed = parseLabel(cleanSentence);
      const isLabeled = parsed.isLabeled;
      const itemLabel = isLabeled ? parsed.label : null;
      const itemValue = isLabeled ? parsed.value : cleanSentence;

      const partEditKey = `${fieldName}-${recIdx}-s${sIdx}`;
      const isPartEditing = editingField === partEditKey;
      const isPartEdited = editedSentences[partEditKey] === 'edited' || editedSentences[partEditKey] === 'added';
      const partCopyId = `${copyId}-s${sIdx}`;
      const showLabel = label && sIdx === 0;

      return (
        <React.Fragment key={partCopyId}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {isLabeled && <div className="nested-subtitle">{highlightText(itemLabel)}</div>}
            <div className={`numbered-row${isPartEdited ? ' modified' : ''}`}>
              {isPartEditing ? (
                <div className="edit-field-container">
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        saveSentence(rec, fieldName, recIdx, sectionId, sIdx);
                      } else if (e.key === 'Escape') {
                        setEditingField(null);
                        setEditValue('');
                      }
                    }}
                    disabled={saving}
                  />
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => saveSentence(rec, fieldName, recIdx, sectionId, sIdx)} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`row-content${canEdit ? ' editable' : ''}`}
                    onClick={() => canEdit && handleStartEdit(fieldName, recIdx, isLabeled ? itemValue : cleanSentence, sIdx)}
                  >
                    <span className="content-value">{highlightText(isLabeled ? itemValue : cleanSentence)}</span>
                    {canEdit && !isPartEdited && <span className="edit-indicator">{'\u270E'}</span>}
                  </div>
                  <button
                    className={`copy-btn${copiedSectionId === partCopyId ? ' copied' : ''}`}
                    onClick={() => copySection(cleanSentence, partCopyId)}
                  >
                    {copiedSectionId === partCopyId ? 'Copied!' : 'Copy'}
                  </button>
                </>
              )}
            </div>
          </div>
          {isPartEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
        </React.Fragment>
      );
    });
  };

  // Render a bare-time sub-field (e.g. induction.anesthesiaStart "06:50 AM") with a native time picker
  // so the user can only change the time. Stored as 12h "hh:mm AM/PM"; the picker uses 24h HH:MM.
  const renderTimeField = (rec, fieldName, recIdx, sectionId, label, copyId) => {
    const val = getEffectiveDot(rec, fieldName, recIdx);
    const displayVal = val != null ? String(val) : null;
    if (displayVal === null) return null;
    const editKey = `${fieldName}-${recIdx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    return (
      <React.Fragment key={copyId}>
        <div className="rec-mini-card">
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            {isEditing ? (
              <div className="edit-field-container">
                <input
                  type="time"
                  className="edit-time"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  ref={(el) => { if (el) { el.focus(); try { el.showPicker(); } catch { /* showPicker unsupported */ } } }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                />
                <div className="edit-actions">
                  <button
                    className="save-btn"
                    disabled={saving}
                    onClick={() => {
                      if (!editValue) return;
                      handleSaveField(rec, fieldName, recIdx, sectionId, 0, fromTimeInput(editValue));
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`row-content${canEdit ? ' editable' : ''}`}
                  onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(toTimeInput(displayVal)); } }}
                >
                  <span className="content-value">{highlightText(displayVal)}</span>
                  {canEdit && !isEdited && <span className="edit-indicator">{'✎'}</span>}
                </div>
                <button
                  className={`copy-btn${copiedSectionId === copyId ? ' copied' : ''}`}
                  onClick={() => copySection(label ? `${label}\n  1. ${displayVal}` : `1. ${displayVal}`, copyId)}
                >
                  {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
                </button>
              </>
            )}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // Render a string sub-field as comma-split clauses (paren-aware, digit-guarded), each clause its own
  // editable row inside ONE rec-mini-card. Editing a clause re-joins with ", " (lossless round-trip).
  // Falls back to the plain whole-field renderer when there is no real comma (≤1 clause).
  const renderCommaSplitField = (rec, fieldName, recIdx, sectionId, label, copyId) => {
    const val = getEffectiveDot(rec, fieldName, recIdx);
    const displayVal = val != null ? String(val) : null;
    if (displayVal === null) return null;
    // A bare clock time → native time picker (user can only change the time, not free text).
    if (isTimeValue(displayVal)) {
      return renderTimeField(rec, fieldName, recIdx, sectionId, label, copyId);
    }
    const clauses = splitByComma(displayVal);
    if (clauses.length <= 1) {
      return renderEditableField(rec, fieldName, recIdx, sectionId, label, copyId);
    }
    const anyEdited = clauses.some((_, cIdx) => editedSentences[`${fieldName}-${recIdx}-s${cIdx}`]);
    return (
      <div className="rec-mini-card" key={copyId}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {clauses.map((clause, cIdx) => {
          const editKey = `${fieldName}-${recIdx}-s${cIdx}`;
          const isEditing = editingField === editKey;
          const isEdited = editedSentences[editKey] === 'edited' || editedSentences[editKey] === 'added';
          const clauseCopyId = `${copyId}-c${cIdx}`;
          return (
            <div className={`numbered-row${isEdited ? ' modified' : ''}`} key={clauseCopyId}>
              {isEditing ? (
                <div className="edit-field-container">
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        saveClause(rec, fieldName, recIdx, sectionId, cIdx);
                      } else if (e.key === 'Escape') {
                        setEditingField(null);
                        setEditValue('');
                      }
                    }}
                    disabled={saving}
                  />
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => saveClause(rec, fieldName, recIdx, sectionId, cIdx)} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`row-content${canEdit ? ' editable' : ''}`}
                    onClick={() => canEdit && handleStartEdit(fieldName, recIdx, clause, cIdx)}
                  >
                    <span className="content-value">{highlightText(clause)}</span>
                    {canEdit && !isEdited && <span className="edit-indicator">{'✎'}</span>}
                  </div>
                  <button
                    className={`copy-btn${copiedSectionId === clauseCopyId ? ' copied' : ''}`}
                    onClick={() => copySection(`${cIdx + 1}. ${clause}`, clauseCopyId)}
                  >
                    {copiedSectionId === clauseCopyId ? 'Copied!' : 'Copy'}
                  </button>
                </>
              )}
            </div>
          );
        })}
        {anyEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Render dynamic object field (object fields using Object.entries with dot-path editing)
  const renderDynamicObjectField = (rec, parentPath, recIdx, sectionId) => {
    const parentVal = getEffectiveDot(rec, parentPath, recIdx);
    if (!parentVal || typeof parentVal !== 'object') return null;

    return Object.entries(parentVal).map(([key, value]) => {
      if (!value) return null;
      const dotPath = `${parentPath}.${key}`;
      const label = formatKey(key);

      // Handle arrays within objects
      if (Array.isArray(value)) {
        return (
          <div key={dotPath} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {value.map((item, itemIdx) => {
              const arrayEditKey = `${dotPath}-${recIdx}-item${itemIdx}`;
              const isArrayEditing = editingField === arrayEditKey;
              const isArrayEdited = editedSentences[arrayEditKey] === 'edited';
              const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
              const arrayCopyId = `${dotPath}-${recIdx}-item${itemIdx}`;

              return (
                <React.Fragment key={arrayCopyId}>
                  <div className={`numbered-row${isArrayEdited ? ' modified' : ''}`}>
                    {isArrayEditing ? (
                      <div className="edit-field-container">
                        <textarea
                          ref={textareaRef}
                          className="edit-textarea"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              saveArrayItem(rec, dotPath, recIdx, sectionId, itemIdx);
                            } else if (e.key === 'Escape') {
                              setEditingField(null);
                              setEditValue('');
                            }
                          }}
                          disabled={saving}
                        />
                        <div className="edit-actions">
                          <button className="save-btn" onClick={() => saveArrayItem(rec, dotPath, recIdx, sectionId, itemIdx)} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`row-content${canEdit ? ' editable' : ''}`}
                          onClick={() => canEdit && handleStartEditArray(dotPath, recIdx, itemIdx, itemStr)}
                        >
                          <span className="content-value">{highlightText(itemStr)}</span>
                          {canEdit && !isArrayEdited && <span className="edit-indicator">{'\u270E'}</span>}
                        </div>
                        <button
                          className={`copy-btn${copiedSectionId === arrayCopyId ? ' copied' : ''}`}
                          onClick={() => copySection(itemStr, arrayCopyId)}
                        >
                          {copiedSectionId === arrayCopyId ? 'Copied!' : 'Copy'}
                        </button>
                      </>
                    )}
                  </div>
                  {isArrayEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
                </React.Fragment>
              );
            })}
          </div>
        );
      }

      // Handle nested objects within objects
      if (typeof value === 'object' && value !== null) {
        return (
          <div key={dotPath} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {Object.entries(value).map(([nestedKey, nestedValue]) => {
              const nestedDotPath = `${dotPath}.${nestedKey}`;
              const nestedLabel = formatKey(nestedKey);
              return renderEditableField(rec, nestedDotPath, recIdx, sectionId, nestedLabel, `${nestedDotPath}-${recIdx}`);
            })}
          </div>
        );
      }

      // Simple string/number values - comma-split narrative into individual rows (dot-path editing)
      return renderCommaSplitField(rec, dotPath, recIdx, sectionId, label, `${dotPath}-${recIdx}`);
    }).filter(Boolean);
  };

  // Render nested object section (with section header, copy, and approve)
  const renderNestedObjectSection = (rec, obj, sectionTitle, sectionId, recIdx) => {
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;

    const sectionTitleMatches = searchTerm && (
      shouldShowRow(rec, sectionTitle.toLowerCase()) ||
      shouldShowRow(rec, sectionTitle) ||
      shouldShowRow(rec, sectionTitle.toUpperCase())
    );
    const showAll = rec._showAllSections || sectionTitleMatches;

    const sectionContent = Object.entries(obj).map(([key, value]) =>
      [formatKey(key).toLowerCase(), formatKey(key), formatKey(key).toUpperCase(), String(value)].join(' ')
    ).join(' ');

    if (!shouldShowSection(rec, sectionTitle, sectionContent)) return null;

    const hasVisibleRows = showAll || Object.entries(obj).some(([key, value]) =>
      value && shouldShowRow(rec, formatKey(key).toLowerCase(), formatKey(key), formatKey(key).toUpperCase(), String(value))
    );

    if (!hasVisibleRows) return null;

    // Build copy text - subtitle + numbered pattern
    const copyText = formatObjectCopyText(obj);

    // Determine the parentPath for the object field
    const parentPath = sectionId.replace(`record-${recIdx}-`, '');

    return (
      <div className="section-container" key={sectionId}>
        <div className="section-header-row">
          <h4 className="section-title">{highlightText(sectionTitle)}</h4>
          <div className="header-right-actions">
            <button
              className={`copy-btn${copiedSectionId === sectionId ? ' copied' : ''}`}
              onClick={() => copySection(`${sectionTitle}\n${copyText}`, sectionId)}
            >
              {copiedSectionId === sectionId ? 'Copied!' : 'Copy Section'}
            </button>
            {renderApproveBtn(rec, parentPath, recIdx)}
          </div>
        </div>
        <div className="numbered-rows-wrapper">
          <div className="domain-groups-wrapper">
            {renderDynamicObjectField(rec, parentPath, recIdx, parentPath)}
          </div>
        </div>
      </div>
    );
  };

  // Render array section (with per-item editing)
  const renderArraySection = (rec, arr, sectionTitle, sectionId, fieldName, recIdx) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;

    const sectionTitleMatches = searchTerm && (
      shouldShowRow(rec, sectionTitle.toLowerCase()) ||
      shouldShowRow(rec, sectionTitle) ||
      shouldShowRow(rec, sectionTitle.toUpperCase())
    );
    const showAll = rec._showAllSections || sectionTitleMatches;

    const sectionContent = arr.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join(' ');

    if (!shouldShowSection(rec, sectionTitle, sectionContent)) return null;

    const copyText = formatArrayCopyText(arr);

    return (
      <div className="section-container" key={sectionId}>
        <div className="section-header-row">
          <h4 className="section-title">{highlightText(sectionTitle)}</h4>
          <div className="header-right-actions">
            <button
              className={`copy-btn${copiedSectionId === sectionId ? ' copied' : ''}`}
              onClick={() => copySection(`${sectionTitle}\n${copyText}`, sectionId)}
            >
              {copiedSectionId === sectionId ? 'Copied!' : 'Copy Section'}
            </button>
            {renderApproveBtn(rec, fieldName, recIdx)}
          </div>
        </div>
        <div className="numbered-rows-wrapper">
          <div className="domain-groups-wrapper">
            {arr.map((item, itemIdx) => {
              const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
              if (!(showAll || shouldShowRow(rec, itemStr))) return null;

              const arrayEditKey = `${fieldName}-${recIdx}-item${itemIdx}`;
              const isArrayEditing = editingField === arrayEditKey;
              const isArrayEdited = editedSentences[arrayEditKey] === 'edited';
              const arrayCopyId = `${sectionId}-${itemIdx}`;

              return (
                <React.Fragment key={arrayCopyId}>
                  <div className="rec-mini-card">
                    <div className={`numbered-row${isArrayEdited ? ' modified' : ''}`}>
                      {isArrayEditing ? (
                        <div className="edit-field-container">
                          <textarea
                            ref={textareaRef}
                            className="edit-textarea"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                saveArrayItem(rec, fieldName, recIdx, fieldName, itemIdx);
                              } else if (e.key === 'Escape') {
                                setEditingField(null);
                                setEditValue('');
                              }
                            }}
                            disabled={saving}
                          />
                          <div className="edit-actions">
                            <button className="save-btn" onClick={() => saveArrayItem(rec, fieldName, recIdx, fieldName, itemIdx)} disabled={saving}>
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className={`row-content${canEdit ? ' editable' : ''}`}
                            onClick={() => canEdit && handleStartEditArray(fieldName, recIdx, itemIdx, itemStr)}
                          >
                            <span className="content-value">{highlightText(itemStr)}</span>
                            {canEdit && !isArrayEdited && <span className="edit-indicator">{'\u270E'}</span>}
                          </div>
                          <button
                            className={`copy-btn${copiedSectionId === arrayCopyId ? ' copied' : ''}`}
                            onClick={() => copySection(itemStr, arrayCopyId)}
                          >
                            {copiedSectionId === arrayCopyId ? 'Copied!' : 'Copy'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isArrayEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render narrative text section (with per-sentence editing)
  const renderNarrativeSection = (rec, fieldName, sectionTitle, sectionId, recIdx) => {
    const val = getEffective(rec, fieldName, recIdx);
    if (!val) return null;

    const strVal = String(val);

    const sectionTitleMatches = searchTerm && (
      shouldShowRow(rec, sectionTitle.toLowerCase()) ||
      shouldShowRow(rec, sectionTitle) ||
      shouldShowRow(rec, sectionTitle.toUpperCase())
    );
    const showAll = rec._showAllSections || sectionTitleMatches;

    if (!shouldShowSection(rec, sectionTitle, strVal)) return null;

    const sentences = splitBySentence(strVal);
    const visibleSentences = sentences.filter(sentence =>
      showAll || shouldShowRow(rec, sentence)
    );

    if (visibleSentences.length === 0 && sentences.length === 0) return null;

    return (
      <div className="section-container" key={sectionId}>
        <div className="section-header-row">
          <h4 className="section-title">{highlightText(sectionTitle)}</h4>
          <div className="header-right-actions">
            <button
              className={`copy-btn${copiedSectionId === sectionId ? ' copied' : ''}`}
              onClick={() => copySection(`${sectionTitle}\n${formatNarrativeCopyText(strVal)}`, sectionId)}
            >
              {copiedSectionId === sectionId ? 'Copied!' : 'Copy Section'}
            </button>
            {renderApproveBtn(rec, fieldName, recIdx)}
          </div>
        </div>
        <div className="numbered-rows-wrapper">
          <div className="domain-groups-wrapper">
            {sentences.length > 1 ? (
              renderSentenceEditableField(rec, fieldName, recIdx, fieldName, null, `${sectionId}-sent`)
            ) : (
              renderEditableField(rec, fieldName, recIdx, fieldName, null, `${sectionId}-val`)
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render simple field section (single value with section wrapper)
  const renderSimpleFieldSection = (rec, fieldName, sectionTitle, sectionId, recIdx) => {
    const val = getEffective(rec, fieldName, recIdx);
    if (!val) return null;

    const strVal = String(val);

    if (!shouldShowSection(rec, sectionTitle, strVal)) return null;
    const showAll = rec._showAllSections;
    if (!(showAll || shouldShowRow(rec, sectionTitle.toLowerCase(), sectionTitle, sectionTitle.toUpperCase(), strVal))) {
      return null;
    }

    // For sentence fields, use sentence editing; otherwise use simple editing
    if (SENTENCE_FIELDS.includes(fieldName)) {
      return renderNarrativeSection(rec, fieldName, sectionTitle, sectionId, recIdx);
    }

    return (
      <div className="section-container" key={sectionId}>
        <div className="section-header-row">
          <h4 className="section-title">{highlightText(sectionTitle)}</h4>
          <div className="header-right-actions">
            <button
              className={`copy-btn${copiedSectionId === sectionId ? ' copied' : ''}`}
              onClick={() => copySection(`${sectionTitle}\n  1. ${strVal}`, sectionId)}
            >
              {copiedSectionId === sectionId ? 'Copied!' : 'Copy Section'}
            </button>
            {renderApproveBtn(rec, fieldName, recIdx)}
          </div>
        </div>
        <div className="numbered-rows-wrapper">
          <div className="domain-groups-wrapper">
            {renderEditableField(rec, fieldName, recIdx, fieldName, null, `${sectionId}-val`)}
          </div>
        </div>
      </div>
    );
  };

  if (!recordsArray || recordsArray.length === 0) {
    return (
      <div className="anesthesia-records-document">
        <div className="document-header">
          <h1 className="document-title">Anesthesia Records</h1>
        </div>
        <div className="empty-state">
          <p className="empty-text">No anesthesia records found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="anesthesia-records-document">
      {/* Header */}
      <div className="document-header">
        <h1 className="document-title">Anesthesia Records</h1>
        <div className="header-actions">
          <button
            className={`copy-all-btn ${copiedSectionId === 'all' ? 'copied' : ''}`}
            onClick={copyAll}
          >
            {copiedSectionId === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AnesthesiaRecordsDocumentPDFTemplate document={{ anesthesia_records: pdfData }} />}
            fileName={`anesthesia-records-${new Date().toISOString().split('T')[0]}.pdf`}
            className="export-pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export to PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search anesthesia records..."
      />

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((rec, recIdx) => {
          const recordId = rec._id?.$oid || rec._id || '';
          const recordKey = `record-${recIdx}`;

          return (
            <div key={recIdx} className="record-card">
              {/* Record Header - Date top right, Title below left */}
              <div className="card-header">
                {getEffectiveDot(rec, 'surgeryDate', recIdx) && (
                  <div className="date-row">
                    <span className="record-date">{highlightText(formatDate(getEffectiveDot(rec, 'surgeryDate', recIdx)))}</span>
                  </div>
                )}
                <div className="title-row">
                  <h3 className="record-title">
                    {highlightText(`Anesthesia Record ${recIdx + 1}`)}
                  </h3>
                </div>
              </div>

              {/* Surgery Information Section */}
              {shouldShowSection(rec, 'Surgery Information', [
                'surgery information', 'Surgery Information',
                'surgery date', 'Surgery Date', rec.surgeryDate,
                'anesthesia type', 'Anesthesia Type', rec.anesthesiaType,
                'intubation type', 'Intubation Type', rec.intubationType,
                'functional capacity', 'Functional Capacity', rec.functionalCapacity,
                'surgical procedure', 'Surgical Procedure', rec.surgicalProcedure,
                'surgeon', 'Surgeon', rec.surgeon
              ].filter(Boolean).join(' ')) && (() => {
                const sectionTitleMatches = searchTerm && (
                  shouldShowRow(rec, 'surgery information') ||
                  shouldShowRow(rec, 'Surgery Information') ||
                  shouldShowRow(rec, 'SURGERY INFORMATION')
                );
                const showAll = rec._showAllSections || sectionTitleMatches;

                const hasVisibleRows = showAll || (
                  (rec.surgeryDate && shouldShowRow(rec, 'surgery date', 'Surgery Date', 'SURGERY DATE', formatDate(rec.surgeryDate))) ||
                  (rec.anesthesiaType && shouldShowRow(rec, 'anesthesia type', 'Anesthesia Type', 'ANESTHESIA TYPE', rec.anesthesiaType)) ||
                  (rec.intubationType && shouldShowRow(rec, 'intubation type', 'Intubation Type', 'INTUBATION TYPE', rec.intubationType)) ||
                  (rec.functionalCapacity && shouldShowRow(rec, 'functional capacity', 'Functional Capacity', 'FUNCTIONAL CAPACITY', rec.functionalCapacity)) ||
                  (rec.surgicalProcedure && shouldShowRow(rec, 'surgical procedure', 'Surgical Procedure', 'SURGICAL PROCEDURE', rec.surgicalProcedure)) ||
                  (rec.surgeon && shouldShowRow(rec, 'surgeon', 'Surgeon', 'SURGEON', rec.surgeon))
                );

                if (!hasVisibleRows) return null;

                // Build copy text for header section
                const headerCopyText = [
                  getEffectiveDot(rec, 'surgeryDate', recIdx) ? `Surgery Date\n  1. ${formatDate(getEffectiveDot(rec, 'surgeryDate', recIdx))}` : null,
                  getEffective(rec, 'anesthesiaType', recIdx) ? `Anesthesia Type\n  1. ${getEffective(rec, 'anesthesiaType', recIdx)}` : null,
                  getEffective(rec, 'intubationType', recIdx) ? `Intubation Type\n  1. ${getEffective(rec, 'intubationType', recIdx)}` : null,
                  getEffective(rec, 'functionalCapacity', recIdx) ? `Functional Capacity\n  1. ${getEffective(rec, 'functionalCapacity', recIdx)}` : null,
                  getEffective(rec, 'surgicalProcedure', recIdx) ? `Surgical Procedure\n  1. ${getEffective(rec, 'surgicalProcedure', recIdx)}` : null,
                  getEffective(rec, 'surgeon', recIdx) ? `Surgeon\n  1. ${getEffective(rec, 'surgeon', recIdx)}` : null,
                ].filter(Boolean).join('\n\n');

                return (
                  <div className="section-container">
                    <div className="section-header-row">
                      <h4 className="section-title">{highlightText('Surgery Information')}</h4>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn${copiedSectionId === `${recordKey}-header` ? ' copied' : ''}`}
                          onClick={() => copySection(`Surgery Information\n${headerCopyText}`, `${recordKey}-header`)}
                        >
                          {copiedSectionId === `${recordKey}-header` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {renderApproveBtn(rec, 'headerInfo', recIdx)}
                      </div>
                    </div>
                    <div className="numbered-rows-wrapper">
                      <div className="domain-groups-wrapper">
                        {/* Surgery Date - EDITABLE (date picker) */}
                        {getEffectiveDot(rec, 'surgeryDate', recIdx) && (showAll || shouldShowRow(rec, 'surgery date', 'Surgery Date', 'SURGERY DATE', formatDate(getEffectiveDot(rec, 'surgeryDate', recIdx)))) && (() => {
                          const sdVal = getEffectiveDot(rec, 'surgeryDate', recIdx);
                          const sdDisplay = formatDate(sdVal);
                          const sdEditKey = `surgeryDate-${recIdx}-s0`;
                          const sdEditing = editingField === sdEditKey;
                          const sdEdited = editedSentences[sdEditKey] === 'edited';
                          const sdCopyId = `${recordKey}-surgeryDate`;
                          return (
                            <div className="rec-mini-card">
                              <div className="nested-subtitle">{highlightText('Surgery Date')}</div>
                              <div className={`numbered-row${sdEdited ? ' modified' : ''}`}>
                                {sdEditing ? (
                                  <div className="edit-field-container">
                                    <input
                                      type="date"
                                      className="edit-date"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      ref={(el) => { if (el) { el.focus(); try { el.showPicker(); } catch { /* showPicker unsupported */ } } }}
                                      onKeyDown={(e) => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                                    />
                                    <div className="edit-actions">
                                      <button
                                        className="save-btn"
                                        disabled={saving}
                                        onClick={() => {
                                          if (!editValue || isNaN(new Date(editValue).getTime())) return;
                                          handleSaveField(rec, 'surgeryDate', recIdx, 'headerInfo', 0, `${editValue}T00:00:00.000Z`);
                                        }}
                                      >
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div
                                      className={`row-content${canEdit ? ' editable' : ''}`}
                                      onClick={() => { if (canEdit) { setEditingField(sdEditKey); setEditValue(toInputDate(sdVal)); } }}
                                    >
                                      <span className="content-value">{highlightText(sdDisplay)}</span>
                                      {canEdit && !sdEdited && <span className="edit-indicator">{'✎'}</span>}
                                    </div>
                                    <button className={`copy-btn${copiedSectionId === sdCopyId ? ' copied' : ''}`} onClick={() => copySection(`Surgery Date: ${sdDisplay}`, sdCopyId)}>
                                      {copiedSectionId === sdCopyId ? 'Copied!' : 'Copy'}
                                    </button>
                                  </>
                                )}
                              </div>
                              {sdEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
                            </div>
                          );
                        })()}
                        {/* Anesthesia Type - EDITABLE */}
                        {(getEffective(rec, 'anesthesiaType', recIdx)) && (showAll || shouldShowRow(rec, 'anesthesia type', 'Anesthesia Type', 'ANESTHESIA TYPE', getEffective(rec, 'anesthesiaType', recIdx))) && (
                          renderEditableField(rec, 'anesthesiaType', recIdx, 'headerInfo', 'Anesthesia Type', `${recordKey}-anesthesiaType`)
                        )}
                        {/* Intubation Type - EDITABLE */}
                        {(getEffective(rec, 'intubationType', recIdx)) && (showAll || shouldShowRow(rec, 'intubation type', 'Intubation Type', 'INTUBATION TYPE', getEffective(rec, 'intubationType', recIdx))) && (
                          renderEditableField(rec, 'intubationType', recIdx, 'headerInfo', 'Intubation Type', `${recordKey}-intubationType`)
                        )}
                        {/* ASA Classification - EDITABLE */}
                        {(getEffective(rec, 'asaClassification', recIdx)) && (showAll || shouldShowRow(rec, 'asa classification', 'ASA Classification', getEffective(rec, 'asaClassification', recIdx))) && (
                          renderEditableField(rec, 'asaClassification', recIdx, 'headerInfo', 'ASA Classification', `${recordKey}-asaClassification`)
                        )}
                        {/* Functional Capacity - EDITABLE */}
                        {(getEffective(rec, 'functionalCapacity', recIdx)) && (showAll || shouldShowRow(rec, 'functional capacity', 'Functional Capacity', 'FUNCTIONAL CAPACITY', getEffective(rec, 'functionalCapacity', recIdx))) && (
                          renderEditableField(rec, 'functionalCapacity', recIdx, 'headerInfo', 'Functional Capacity', `${recordKey}-functionalCapacity`)
                        )}
                        {/* Surgical Procedure - EDITABLE */}
                        {(getEffective(rec, 'surgicalProcedure', recIdx)) && (showAll || shouldShowRow(rec, 'surgical procedure', 'Surgical Procedure', 'SURGICAL PROCEDURE', getEffective(rec, 'surgicalProcedure', recIdx))) && (
                          renderEditableField(rec, 'surgicalProcedure', recIdx, 'headerInfo', 'Surgical Procedure', `${recordKey}-surgicalProcedure`)
                        )}
                        {/* Surgeon - EDITABLE */}
                        {(getEffective(rec, 'surgeon', recIdx)) && (showAll || shouldShowRow(rec, 'surgeon', 'Surgeon', 'SURGEON', getEffective(rec, 'surgeon', recIdx))) && (
                          renderEditableField(rec, 'surgeon', recIdx, 'headerInfo', 'Surgeon', `${recordKey}-surgeon`)
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ========== RISK ASSESSMENT OVERVIEW - Bar Chart (display-only, no editing) ========== */}
              {(() => {
                const categoryData = prepareChartDataByCategory(rec);
                const hasCategoryData = categoryData.length > 0;

                if (!hasCategoryData) return null;

                const sectionTitleMatches = searchTerm && (
                  shouldShowRow(rec, 'risk assessment overview') ||
                  shouldShowRow(rec, 'Risk Assessment Overview') ||
                  shouldShowRow(rec, 'RISK ASSESSMENT OVERVIEW') ||
                  shouldShowRow(rec, 'clinical scores') ||
                  shouldShowRow(rec, 'Clinical Scores') ||
                  shouldShowRow(rec, 'physical status capacity') ||
                  shouldShowRow(rec, 'Physical Status Capacity') ||
                  shouldShowRow(rec, 'physical status & capacity') ||
                  shouldShowRow(rec, 'Physical Status & Capacity') ||
                  shouldShowRow(rec, 'perioperative risk') ||
                  shouldShowRow(rec, 'Perioperative Risk') ||
                  shouldShowRow(rec, 'perioperative risk scores') ||
                  shouldShowRow(rec, 'Perioperative Risk Scores') ||
                  shouldShowRow(rec, 'airway assessment') ||
                  shouldShowRow(rec, 'Airway Assessment') ||
                  shouldShowRow(rec, 'pulmonary function') ||
                  shouldShowRow(rec, 'Pulmonary Function') ||
                  shouldShowRow(rec, 'sleep study results') ||
                  shouldShowRow(rec, 'Sleep Study Results') ||
                  shouldShowRow(rec, 'sleep study') ||
                  shouldShowRow(rec, 'Sleep Study') ||
                  shouldShowRow(rec, 'nsqip risk calculator') ||
                  shouldShowRow(rec, 'NSQIP Risk Calculator') ||
                  shouldShowRow(rec, 'nsqip risk') ||
                  shouldShowRow(rec, 'NSQIP Risk') ||
                  shouldShowRow(rec, 'nsqip') ||
                  shouldShowRow(rec, 'NSQIP')
                );
                const showAll = rec._showAllSections || sectionTitleMatches;

                const filteredCategoryData = (() => {
                  if (!searchTerm.trim()) return categoryData;

                  const searchLower = searchTerm.toLowerCase().trim();
                  const rawWords = searchLower.split(/\s+/);
                  const searchWords = rawWords
                    .map(w => w.replace(/[()[\],.<>&:%]+/g, ''))
                    .filter((w, i) => w.length > 1 || (w.length === 1 && rawWords[i] === w));

                  if (searchWords.length === 0) return categoryData;
                  if (sectionTitleMatches) return categoryData;

                  return categoryData.map(category => {
                    const categoryNameNorm = category.name.toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' ');
                    const categoryDescNorm = category.description.toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' ');
                    const categoryTextMatches = searchWords.every(word => {
                      const wordNoHyphen = word.replace(/-/g, ' ');
                      return categoryNameNorm.includes(word) || categoryNameNorm.includes(wordNoHyphen) ||
                             categoryDescNorm.includes(word) || categoryDescNorm.includes(wordNoHyphen);
                    });

                    if (categoryTextMatches) return category;

                    const filteredCharts = category.charts.filter(chart => {
                      const labelNorm = chart.label.toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' ');
                      const valueNorm = chart.rawValue.toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' ');
                      const interpNorm = (chart.interpretation || '').toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' ');
                      const combinedText = `${labelNorm} ${valueNorm} ${interpNorm}`;

                      return searchWords.every(word => {
                        const wordNoHyphen = word.replace(/-/g, ' ');
                        return combinedText.includes(word) || combinedText.includes(wordNoHyphen);
                      });
                    });

                    return filteredCharts.length > 0 ? { ...category, charts: filteredCharts } : null;
                  }).filter(Boolean);
                })();

                if (filteredCategoryData.length === 0) return null;

                return (
                  <div className="section-container chart-section">
                    <h4 className="section-title">{highlightText('Risk Assessment Overview')}</h4>
                    <div className="chart-container">
                      <Legend />
                      {filteredCategoryData.map((category, catIdx) => (
                        <div key={category.id} className="chart-category">
                          <CategoryHeader
                            name={category.name}
                            description={category.description}
                            highlightFn={highlightText}
                          />
                          {category.charts.map((chart, cIdx) => (
                            <BarChart
                              key={chart.key}
                              label={chart.label}
                              percentage={chart.percentage}
                              rawValue={chart.rawValue}
                              color={chart.color}
                              interpretation={chart.interpretation}
                              highlightFn={highlightText}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Nested Object Sections */}
              {renderNestedObjectSection(rec, rec.anesthesiologyAssessment, 'Anesthesiology Assessment', `${recordKey}-anesthesiologyAssessment`, recIdx)}
              {renderNestedObjectSection(rec, rec.airwayAssessment, 'Airway Assessment', `${recordKey}-airwayAssessment`, recIdx)}
              {renderNestedObjectSection(rec, rec.anesthesiaPlan, 'Anesthesia Plan', `${recordKey}-anesthesiaPlan`, recIdx)}
              {renderNestedObjectSection(rec, rec.painManagement, 'Pain Management', `${recordKey}-painManagement`, recIdx)}
              {renderNestedObjectSection(rec, rec.induction, 'Induction', `${recordKey}-induction`, recIdx)}
              {renderNestedObjectSection(rec, rec.maintenance, 'Maintenance', `${recordKey}-maintenance`, recIdx)}
              {renderNestedObjectSection(rec, rec.operativeDetails, 'Operative Details', `${recordKey}-operativeDetails`, recIdx)}
              {/* Clinical Scores Section REMOVED - Data now shown in Risk Assessment Overview bar chart above */}
              {renderNestedObjectSection(rec, rec.pulmonaryFunctionTests, 'Pulmonary Function Tests', `${recordKey}-pulmonaryFunctionTests`, recIdx)}
              {renderNestedObjectSection(rec, rec.sleepStudy, 'Sleep Study', `${recordKey}-sleepStudy`, recIdx)}
              {renderNestedObjectSection(rec, rec.chiefComplaint, 'Chief Complaint', `${recordKey}-chiefComplaint`, recIdx)}
              {renderNestedObjectSection(rec, rec.medicalHistory, 'Medical History', `${recordKey}-medicalHistory`, recIdx)}
              {renderNestedObjectSection(rec, rec.reviewOfSystems, 'Review of Systems', `${recordKey}-reviewOfSystems`, recIdx)}
              {renderNestedObjectSection(rec, rec.physicalExamination, 'Physical Examination', `${recordKey}-physicalExamination`, recIdx)}
              {renderNestedObjectSection(rec, rec.preOperativePreparation, 'Preoperative Preparation', `${recordKey}-preOperativePreparation`, recIdx)}
              {renderNestedObjectSection(rec, rec.postoperativeOrders, 'Postoperative Orders', `${recordKey}-postoperativeOrders`, recIdx)}
              {renderNestedObjectSection(rec, rec.dvtProphylaxis, 'DVT Prophylaxis', `${recordKey}-dvtProphylaxis`, recIdx)}
              {renderNestedObjectSection(rec, rec.prognosis, 'Prognosis', `${recordKey}-prognosis`, recIdx)}
              {renderNestedObjectSection(rec, rec.consultationDetails, 'Consultation Details', `${recordKey}-consultationDetails`, recIdx)}
              {renderNestedObjectSection(rec, rec.patientEducation, 'Patient Education', `${recordKey}-patientEducation`, recIdx)}
              {renderNestedObjectSection(rec, rec.administrativeData, 'Administrative Data', `${recordKey}-administrativeData`, recIdx)}

              {/* Array Sections */}
              {renderArraySection(rec, rec.monitoring, 'Monitoring', `${recordKey}-monitoring`, 'monitoring', recIdx)}
              {renderArraySection(rec, rec.complications, 'Complications', `${recordKey}-complications`, 'complications', recIdx)}
              {renderArraySection(rec, rec.referrals, 'Referrals', `${recordKey}-referrals`, 'referrals', recIdx)}
              {renderArraySection(rec, rec.followUpAppointments, 'Follow-Up Appointments', `${recordKey}-followUpAppointments`, 'followUpAppointments', recIdx)}

              {/* Narrative Text Sections (long text with per-sentence editing) */}
              {renderNarrativeSection(rec, 'historyOfPresentIllness', 'History of Present Illness', `${recordKey}-hpi`, recIdx)}
              {renderNarrativeSection(rec, 'assessmentAndPlan', 'Assessment and Plan', `${recordKey}-assessmentAndPlan`, recIdx)}
              {renderNarrativeSection(rec, 'additionalNotes', 'Additional Notes', `${recordKey}-additionalNotes`, recIdx)}

              {/* Simple Field Sections (sentence-editable for long text) */}
              {renderSimpleFieldSection(rec, 'emergence', 'Emergence', `${recordKey}-emergence`, recIdx)}
              {renderSimpleFieldSection(rec, 'bloodProductsOrdered', 'Blood Products Ordered', `${recordKey}-bloodProductsOrdered`, recIdx)}
              {renderSimpleFieldSection(rec, 'findings', 'Findings', `${recordKey}-findings`, recIdx)}
              {renderSimpleFieldSection(rec, 'outcome', 'Outcome', `${recordKey}-outcome`, recIdx)}
              {renderSimpleFieldSection(rec, 'followUp', 'Follow Up', `${recordKey}-followUp`, recIdx)}

              {/* Providers - NON-EDITABLE */}
              {rec.providers && Object.keys(rec.providers).length > 0 && shouldShowSection(rec, 'Providers', JSON.stringify(rec.providers)) && (
                <div className="section-container">
                  <div className="section-header-row">
                    <h4 className="section-title">{highlightText('Providers')}</h4>
                    <div className="header-right-actions">
                      <button
                        className={`copy-btn${copiedSectionId === `${recordKey}-providers` ? ' copied' : ''}`}
                        onClick={() => copySection(`Providers\n${formatObjectCopyText(rec.providers)}`, `${recordKey}-providers`)}
                      >
                        {copiedSectionId === `${recordKey}-providers` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>
                  </div>
                  <div className="numbered-rows-wrapper">
                    <div className="domain-groups-wrapper">
                      {Object.entries(rec.providers).map(([key, value]) => (
                        <div key={key} className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText(formatKey(key))}</div>
                          <div className="numbered-row">
                            <div className="row-content">
                              <span className="content-value">{highlightText(String(value))}</span>
                            </div>
                            <button
                              className={`copy-btn${copiedSectionId === `${recordKey}-providers-${key}` ? ' copied' : ''}`}
                              onClick={() => copySection(`${formatKey(key)}\n  1. ${value}`, `${recordKey}-providers-${key}`)}
                            >
                              {copiedSectionId === `${recordKey}-providers-${key}` ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnesthesiaRecordsDocument;
