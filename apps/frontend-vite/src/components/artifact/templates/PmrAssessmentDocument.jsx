/**
 * PmrAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: pmr_assessment
 *
 * Sections:
 *   1. functional-history: functionalHistory.priorLevelOfFunction, functionalHistory.currentFunctionalStatus.mobilityDetails, functionalHistory.currentFunctionalStatus.adls, functionalHistory.currentFunctionalStatus.iadls
 *   2. functional-assessment: functionalAssessment.fimScore, functionalAssessment.barthel, functionalAssessment.bergBalance, functionalAssessment.timedUpAndGo, functionalAssessment.sixMinuteWalk, functionalAssessment.tenMeterWalkTest, functionalAssessment.fuglMeyerUpperExtremity, functionalAssessment.actionResearchArmTest
 *   3. balance-assessment: balanceAssessment.sittingBalance, balanceAssessment.standingBalanceEyesOpen, balanceAssessment.standingBalanceEyesClosed, balanceAssessment.bergBalanceScore
 *   4. gait-analysis: gaitAnalysis.cadence, gaitAnalysis.assistiveDevice
 *   5. spasticity-assessment: spasticityAssessment (dynamic keys)
 *   6. copm: copm (dynamic array of objects)
 *   7. swallow-study: swallowStudy.findings, swallowStudy.dietRecommendation, swallowStudy.aspirationRisk
 *   8. neuropsychological-testing: neuropsychologicalTesting.executiveFunction, neuropsychologicalTesting.processingSpeed, neuropsychologicalTesting.memory, neuropsychologicalTesting.recommendations
 *   9. botulinum-toxin: botulinumToxinInjections.indication, botulinumToxinInjections.targetedMuscles, botulinumToxinInjections.plan
 *   10. equipment: equipment (array of objects)
 *   11. physical-therapy: therapyInterventions.physicalTherapy
 *   12. occupational-therapy: therapyInterventions.occupationalTherapy
 *   13. speech-therapy: therapyInterventions.speechTherapy
 *   14. psychology: therapyInterventions.psychology
 *   15. pharmacologic-plan: medicalManagement.pharmacologicPlan
 *   16. spasticity-medications: medicalManagement.spasticityMedications
 *   17. support-groups: supportGroups
 *   18. discharge-planning: dischargePlanningPMR.longTermGoal, dischargePlanningPMR.anticipatedDisposition
 *   19. provider-info: provider
 *   20. assessment-section: assessment
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PmrAssessmentDocumentPDFTemplate from '../pdf-templates/PmrAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PmrAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits key path, e.g.
   "functionalHistory.priorLevelOfFunction" or "balanceAssessment"; value may be a string, number,
   boolean, array, or whole sub-object — exactly what is stored in localEdits[`${fieldPart}-${idx}`]). */
const DRAFT_KEY = 'pmr_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'functional-history': 'Functional History',
  'functional-assessment': 'Functional Assessment',
  'balance-assessment': 'Balance Assessment',
  'gait-analysis': 'Gait Analysis',
  'spasticity-assessment': 'Spasticity Assessment - Ashworth Scale',
  'emg-studies': 'EMG / Nerve Conduction Studies',
  'orthotic': 'Orthotic',
  'copm': 'COPM Priority Areas',
  'swallow-study': 'Swallow Study',
  'neuropsychological-testing': 'Neuropsychological Testing',
  'botulinum-toxin': 'Botulinum Toxin Injections',
  'equipment': 'Equipment',
  'physical-therapy': 'Physical Therapy',
  'occupational-therapy': 'Occupational Therapy',
  'speech-therapy': 'Speech Therapy',
  'psychology': 'Psychology',
  'pharmacologic-plan': 'Pharmacologic Plan',
  'spasticity-medications': 'Spasticity Medications',
  'support-groups': 'Support Groups',
  'discharge-planning': 'Discharge Planning',
  'general-info': 'General Information',
  'provider-info': 'Provider',
  'findings-section': 'Findings',
  'assessment-section': 'Assessment',
  'plan-section': 'Plan',
  'recommendations-section': 'Recommendations',
  'results-section': 'Results',
  'notes-section': 'Notes',
};

const FIELD_LABELS = {
  'functionalHistory.priorLevelOfFunction': 'Prior Level of Function',
  'functionalHistory.currentFunctionalStatus.mobilityDetails': 'Mobility Details',
  'functionalHistory.currentFunctionalStatus.adls': 'ADLs',
  'functionalHistory.currentFunctionalStatus.iadls': 'IADLs',
  'functionalAssessment.fimScore': 'FIM Score',
  'functionalAssessment.barthel': 'Barthel Index',
  'functionalAssessment.bergBalance': 'Berg Balance Score',
  'functionalAssessment.timedUpAndGo': 'Timed Up And Go',
  'functionalAssessment.sixMinuteWalk': 'Six Minute Walk',
  'functionalAssessment.tenMeterWalkTest': 'Ten Meter Walk Test',
  'functionalAssessment.fuglMeyerUpperExtremity': 'Fugl-Meyer Upper Extremity',
  'functionalAssessment.actionResearchArmTest': 'Action Research Arm Test',
  'balanceAssessment.sittingBalance': 'Sitting Balance',
  'balanceAssessment.standingBalanceEyesOpen': 'Standing Balance Eyes Open',
  'balanceAssessment.standingBalanceEyesClosed': 'Standing Balance Eyes Closed',
  'balanceAssessment.bergBalanceScore': 'Berg Balance Score',
  'gaitAnalysis.cadence': 'Cadence',
  'gaitAnalysis.assistiveDevice': 'Assistive Device',
  'swallowStudy.findings': 'Findings',
  'swallowStudy.dietRecommendation': 'Diet Recommendation',
  'swallowStudy.aspirationRisk': 'Aspiration Risk',
  'neuropsychologicalTesting.executiveFunction': 'Executive Function',
  'neuropsychologicalTesting.processingSpeed': 'Processing Speed',
  'neuropsychologicalTesting.memory': 'Memory',
  'neuropsychologicalTesting.recommendations': 'Recommendations',
  'botulinumToxinInjections.indication': 'Indication',
  'botulinumToxinInjections.targetedMuscles': 'Targeted Muscles',
  'botulinumToxinInjections.plan': 'Plan',
  'dischargePlanningPMR.longTermGoal': 'Long Term Goal',
  'dischargePlanningPMR.anticipatedDisposition': 'Anticipated Disposition',
  emgStudies: 'EMG / Nerve Conduction Studies',
  orthotic: 'Orthotic',
  results: 'Results',
  recommendations: 'Recommendations',
  facility: 'Facility',
  provider: 'Provider',
  assessment: 'Assessment',
  findings: 'Findings',
  plan: 'Plan',
  notes: 'Notes',
  date: 'Date',
  status: 'Status',
};

const SECTION_FIELDS = {
  'functional-history': ['functionalHistory.priorLevelOfFunction', 'functionalHistory.currentFunctionalStatus.mobilityDetails', 'functionalHistory.currentFunctionalStatus.adls', 'functionalHistory.currentFunctionalStatus.iadls'],
  'functional-assessment': ['functionalAssessment.fimScore', 'functionalAssessment.barthel', 'functionalAssessment.bergBalance', 'functionalAssessment.timedUpAndGo', 'functionalAssessment.sixMinuteWalk', 'functionalAssessment.tenMeterWalkTest', 'functionalAssessment.fuglMeyerUpperExtremity', 'functionalAssessment.actionResearchArmTest'],
  'balance-assessment': ['balanceAssessment.sittingBalance', 'balanceAssessment.standingBalanceEyesOpen', 'balanceAssessment.standingBalanceEyesClosed', 'balanceAssessment.bergBalanceScore'],
  'gait-analysis': ['gaitAnalysis.cadence', 'gaitAnalysis.assistiveDevice'],
  'spasticity-assessment': [],
  'emg-studies': ['emgStudies'],
  'orthotic': ['orthotic'],
  'copm': [],
  'swallow-study': ['swallowStudy.findings', 'swallowStudy.dietRecommendation', 'swallowStudy.aspirationRisk'],
  'neuropsychological-testing': ['neuropsychologicalTesting.executiveFunction', 'neuropsychologicalTesting.processingSpeed', 'neuropsychologicalTesting.memory', 'neuropsychologicalTesting.recommendations'],
  'botulinum-toxin': ['botulinumToxinInjections.indication', 'botulinumToxinInjections.targetedMuscles', 'botulinumToxinInjections.plan'],
  'equipment': [],
  'physical-therapy': [],
  'occupational-therapy': [],
  'speech-therapy': [],
  'psychology': [],
  'pharmacologic-plan': [],
  'spasticity-medications': [],
  'support-groups': [],
  'discharge-planning': ['dischargePlanningPMR.longTermGoal', 'dischargePlanningPMR.anticipatedDisposition'],
  'general-info': ['facility'],
  'provider-info': ['provider'],
  'findings-section': ['findings'],
  'assessment-section': ['assessment'],
  'plan-section': ['plan'],
  'recommendations-section': ['recommendations'],
  'results-section': ['results'],
  'notes-section': ['notes'],
};

const OBJECT_FIELDS = ['emgStudies', 'orthotic', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

const NUMBER_FIELDS = ['functionalAssessment.fimScore', 'functionalAssessment.barthel', 'functionalAssessment.bergBalance', 'balanceAssessment.bergBalanceScore'];
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = [];
const STRING_FIELDS = [
  'functionalHistory.priorLevelOfFunction',
  'functionalHistory.currentFunctionalStatus.mobilityDetails', 'functionalHistory.currentFunctionalStatus.adls', 'functionalHistory.currentFunctionalStatus.iadls',
  'functionalAssessment.timedUpAndGo', 'functionalAssessment.sixMinuteWalk', 'functionalAssessment.tenMeterWalkTest', 'functionalAssessment.fuglMeyerUpperExtremity', 'functionalAssessment.actionResearchArmTest',
  'balanceAssessment.sittingBalance', 'balanceAssessment.standingBalanceEyesOpen', 'balanceAssessment.standingBalanceEyesClosed',
  'gaitAnalysis.cadence', 'gaitAnalysis.assistiveDevice',
  'swallowStudy.findings', 'swallowStudy.dietRecommendation', 'swallowStudy.aspirationRisk',
  'neuropsychologicalTesting.executiveFunction', 'neuropsychologicalTesting.processingSpeed', 'neuropsychologicalTesting.memory', 'neuropsychologicalTesting.recommendations',
  'botulinumToxinInjections.indication', 'botulinumToxinInjections.plan',
  'dischargePlanningPMR.longTermGoal', 'dischargePlanningPMR.anticipatedDisposition',
  'facility', 'provider', 'assessment', 'findings', 'plan', 'notes',
];
const ARRAY_FIELDS = ['botulinumToxinInjections.targetedMuscles'];

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

const keyToLabel = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

/* ═══════ RECURSIVE-OBJECT HELPERS (donor: PointOfCareUltrasoundHeartRateDocument) ═══════ */
const KEY_OVERRIDES = {
  emg: 'EMG',
  needleEmg: 'Needle EMG',
  copm: 'COPM',
  iadls: 'IADLs',
  adls: 'ADLs',
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* number+unit leaf splitter — returns null for plain text and "4/5" ratios */
const splitNumberUnit = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null;
  const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/);
  if (!m || !/\d/.test(m[1])) return null;
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() };
};

const splitRatio = (text) => {
  if (text === null || text === undefined) return null;
  const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { num: m[1], denom: m[2] };
};

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

/* ═══════ COMPONENT ═══════ */
const PmrAssessmentDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.pmr_assessment) return Array.isArray(r.pmr_assessment) ? r.pmr_assessment : [r.pmr_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pmr_assessment) return Array.isArray(dd.pmr_assessment) ? dd.pmr_assessment : [dd.pmr_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Drafts are keyed by record _id (handling _id.$oid); we map them back to the current render index. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* Deep getter for dot-notation paths */
  const getNestedValue = useCallback((obj, path) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => acc && acc[key], obj);
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return getNestedValue(record, fn);
  }, [localEdits, getNestedValue]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    /* For dynamic sections (objects/arrays not in SECTION_FIELDS), search their content */
    if (sid === 'spasticity-assessment') {
      const ash = record.spasticityAssessment?.ashworthScale;
      if (ash) { for (const [k, v] of Object.entries(ash)) { if (k === '_id') continue; if (keyToLabel(k).toLowerCase().includes(phrase) || fmtVal(v).toLowerCase().includes(phrase)) return true; } }
    }
    if (sid === 'copm') {
      const areas = record.copm?.priorityAreas;
      if (areas && Array.isArray(areas)) { for (const a of areas) { if ((a.activity || '').toLowerCase().includes(phrase) || String(a.performanceScore).includes(phrase) || String(a.satisfactionScore).includes(phrase)) return true; } }
    }
    if (sid === 'equipment') {
      const eq = record.equipment;
      if (eq && Array.isArray(eq)) { for (const e of eq) { if ((e.item || '').toLowerCase().includes(phrase) || (e.indication || '').toLowerCase().includes(phrase) || (e.status || '').toLowerCase().includes(phrase)) return true; } }
    }
    const therapyMap = { 'physical-therapy': 'physicalTherapy', 'occupational-therapy': 'occupationalTherapy', 'speech-therapy': 'speechTherapy', 'psychology': 'psychology' };
    if (therapyMap[sid]) {
      const therapy = record.therapyInterventions?.[therapyMap[sid]];
      if (therapy) {
        if ((therapy.frequency || '').toLowerCase().includes(phrase)) return true;
        if ((therapy.duration || '').toLowerCase().includes(phrase)) return true;
        if (therapy.interventions && therapy.interventions.some(item => item.toLowerCase().includes(phrase))) return true;
      }
    }
    if (sid === 'pharmacologic-plan') {
      const pp = record.medicalManagement?.pharmacologicPlan;
      if (pp && Array.isArray(pp)) { if (pp.some(item => item.toLowerCase().includes(phrase))) return true; }
    }
    if (sid === 'spasticity-medications') {
      const sm = record.medicalManagement?.spasticityMedications;
      if (sm && Array.isArray(sm)) { for (const m of sm) { if ((m.medication || '').toLowerCase().includes(phrase) || (m.action || '').toLowerCase().includes(phrase)) return true; } }
    }
    if (sid === 'support-groups') {
      const sg = record.supportGroups;
      if (sg && Array.isArray(sg)) { if (sg.some(g => g.toLowerCase().includes(phrase))) return true; }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `PMR Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      /* Also search dynamic content */
      const ash = record.spasticityAssessment?.ashworthScale;
      if (ash) { for (const [k, v] of Object.entries(ash)) { if (k !== '_id' && (keyToLabel(k).toLowerCase().includes(phrase) || fmtVal(v).toLowerCase().includes(phrase))) return true; } }
      const areas = record.copm?.priorityAreas;
      if (areas && Array.isArray(areas)) { for (const a of areas) { if ((a.activity || '').toLowerCase().includes(phrase)) return true; } }
      const eq = record.equipment;
      if (eq && Array.isArray(eq)) { for (const e of eq) { if ((e.item || '').toLowerCase().includes(phrase) || (e.indication || '').toLowerCase().includes(phrase) || (e.status || '').toLowerCase().includes(phrase)) return true; } }
      const ti = record.therapyInterventions;
      if (ti) { for (const tk of ['physicalTherapy', 'occupationalTherapy', 'speechTherapy', 'psychology']) { const t = ti[tk]; if (t) { if ((t.frequency || '').toLowerCase().includes(phrase) || (t.duration || '').toLowerCase().includes(phrase)) return true; if (t.interventions && t.interventions.some(item => item.toLowerCase().includes(phrase))) return true; } } }
      const pp = record.medicalManagement?.pharmacologicPlan;
      if (pp && Array.isArray(pp) && pp.some(item => item.toLowerCase().includes(phrase))) return true;
      const sm = record.medicalManagement?.spasticityMedications;
      if (sm && Array.isArray(sm)) { for (const m of sm) { if ((m.medication || '').toLowerCase().includes(phrase) || (m.action || '').toLowerCase().includes(phrase)) return true; } }
      const sg = record.supportGroups;
      if (sg && Array.isArray(sg) && sg.some(g => g.toLowerCase().includes(phrase))) return true;
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const path = m[1];
          const parts = path.split('.');
          if (parts.length === 1) {
            merged[parts[0]] = localEdits[key];
          } else {
            /* Deep set */
            let obj = merged;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Stage a DRAFT (no DB write). localEdits[`${fieldPart}-${idx}`] holds the full value (string,
  // number, boolean, array, or whole sub-object); the localStorage draft store keeps it across
  // refresh. handleApproveSection commits drafts to MongoDB. clearApprovedFor un-approves a section
  // when it is re-edited so the button returns to yellow "Pending Approve".
  const stageDraft = useCallback((record, fieldPart, idx, value) => {
    setLocalEdits(prev => ({ ...prev, [`${fieldPart}-${idx}`]: value }));
    setPendingEdits(prev => ({ ...prev, [`${fieldPart}-${idx}`]: true }));
    const id = safeId(record);
    if (id) {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fieldPart] = value;
      writeDrafts(store);
    }
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  /* ═══════ SAVE: OBJECT LEAF (deep dotted path) ═══════ */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    // Stage the WHOLE merged root object as a draft under `${rootField}-${idx}`. Approve replays it
    // to MongoDB as { field: rootField, value: wholeObject } ($set of the root subtree).
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    stageDraft(record, rootField, idx, clone);
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }, [safeId, localEdits, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageDraft(record, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageDraft(record, fn, idx, fullText);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    /* Also check dynamic field keys for sections with dynamic content */
    const dynamicPrefixes = [];
    if (sid === 'spasticity-assessment') dynamicPrefixes.push('spasticityAssessment.ashworthScale.');
    if (sid === 'copm') dynamicPrefixes.push('copm.priorityAreas.');
    if (sid === 'equipment') dynamicPrefixes.push('equipment.');
    if (sid === 'physical-therapy') dynamicPrefixes.push('therapyInterventions.physicalTherapy.');
    if (sid === 'occupational-therapy') dynamicPrefixes.push('therapyInterventions.occupationalTherapy.');
    if (sid === 'speech-therapy') dynamicPrefixes.push('therapyInterventions.speechTherapy.');
    if (sid === 'psychology') dynamicPrefixes.push('therapyInterventions.psychology.');
    if (sid === 'pharmacologic-plan') dynamicPrefixes.push('medicalManagement.pharmacologicPlan.');
    if (sid === 'spasticity-medications') dynamicPrefixes.push('medicalManagement.spasticityMedications.');
    if (sid === 'support-groups') dynamicPrefixes.push('supportGroups.');

    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    ) || dynamicPrefixes.some(dp =>
      Object.keys(editedFields).some(k => k.startsWith(dp) && k.endsWith(`-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(dp) && k.includes(`-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF/Copy All. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const suffix = `-${idx}`;
      // localEdits keys for THIS record that are still pending drafts (e.g. "balanceAssessment-0").
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field", "a.b.c", or "field.<arrayIndex>"
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // GOTCHA: treat a trailing dot-segment as arrayIndex ONLY when it is purely numeric.
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(tail, 10);
        }
        const resp = await secureApiClient.put(`/api/edit/pmr_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/pmr_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const fields = SECTION_FIELDS[sid] || [];
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[PmrAssessment] Approve error:', err); setSaveError('Approve failed. Please try again.'); } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) {
          lines.push(parsed.label + ':');
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else { lines.push(parsed.label + ':'); lines.push(`  ${n++}. ${parsed.value}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}: ${val ? 'Yes' : 'No'}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        text += `${label}: ${val}\n\n`;
      } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val : [];
        text += `${label}\n`;
        recs.forEach((r, i) => { const rt = (r?.recommendation || '').trim(); const rd = (r?.date || '').trim(); text += `${i + 1}. ${rt}${rd ? ` (${rd})` : ''}\n`; });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        const flatten = (o, prefix) => {
          Object.entries(o).filter(([k, v]) => k !== '_id' && hasVal(v)).forEach(([k, v]) => {
            if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, `${prefix}${keyToLabel(k)} - `);
            else text += `${prefix}${keyToLabel(k)}: ${Array.isArray(v) ? v.join(', ') : fmtVal(v)}\n`;
          });
        };
        text += `${label}\n`;
        flatten(val, '');
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${label}\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `${label}\n${strVal}\n\n`;
        }
      } else {
        text += `${label}\n${fmtVal(val)}\n\n`;
      }
    });
    /* Dynamic content for certain sections */
    if (sid === 'spasticity-assessment') {
      const ash = record.spasticityAssessment?.ashworthScale;
      if (ash) { Object.entries(ash).filter(([k]) => k !== '_id').forEach(([k, v]) => { text += `${keyToLabel(k)}: ${fmtVal(v)}\n`; }); text += '\n'; }
    }
    if (sid === 'copm') {
      const areas = record.copm?.priorityAreas;
      if (areas && Array.isArray(areas)) { areas.forEach((a, i) => { text += `${i + 1}. ${a.activity} (Performance: ${a.performanceScore}, Satisfaction: ${a.satisfactionScore})\n`; }); text += '\n'; }
    }
    if (sid === 'equipment') {
      const eq = record.equipment;
      if (eq && Array.isArray(eq)) { eq.forEach((e, i) => { let line = `${i + 1}. ${e.item}`; if (e.indication) line += ` - Indication: ${e.indication}`; if (e.status) line += ` - Status: ${e.status}`; text += line + '\n'; }); text += '\n'; }
    }
    const therapyMap = { 'physical-therapy': 'physicalTherapy', 'occupational-therapy': 'occupationalTherapy', 'speech-therapy': 'speechTherapy', 'psychology': 'psychology' };
    if (therapyMap[sid]) {
      const therapy = record.therapyInterventions?.[therapyMap[sid]];
      if (therapy) {
        if (therapy.frequency) text += `Frequency: ${therapy.frequency}\n`;
        if (therapy.duration) text += `Duration: ${therapy.duration}\n`;
        if (therapy.interventions) { therapy.interventions.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
        text += '\n';
      }
    }
    if (sid === 'pharmacologic-plan') {
      const pp = record.medicalManagement?.pharmacologicPlan;
      if (pp && Array.isArray(pp)) { pp.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
    }
    if (sid === 'spasticity-medications') {
      const sm = record.medicalManagement?.spasticityMedications;
      if (sm && Array.isArray(sm)) { sm.forEach((m, i) => { text += `${i + 1}. ${m.medication}${m.action ? ` - ${m.action}` : ''}\n`; }); text += '\n'; }
    }
    if (sid === 'support-groups') {
      const sg = record.supportGroups;
      if (sg && Array.isArray(sg)) { sg.forEach((g, i) => { text += `${i + 1}. ${g}\n`; }); text += '\n'; }
    }
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PMR ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `PMR Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (r.date) text += `Date: ${formatDate(r.date)}\n`;
      if (r.provider) text += `Provider: ${r.provider}\n`;
      if (r.status) text += `Status: ${r.status}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE FIELD ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" className="edit-textarea" style={{ minHeight: 'auto' }} value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; stageDraft(record, fn, idx, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              if (parsed.isLabeled) {
                const commaItems = splitByComma(parsed.value);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2) {
                  return (
                    <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, fn, idx, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                                </>
                              )}
                            </div>
                            {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              /* Regular sentence row */
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, fn, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value string: simple editable */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC EDITABLE ROW (for dynamic object entries) ═══════ */
  const renderEditableRow = (record, fieldPath, idx, label, value, sid) => {
    const editKey = `${fieldPath}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const displayVal = fmtVal(value);

    return (
      <div key={fieldPath}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fieldPath, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, "4/5" stays text) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (ratio || nu) ? (
                <div className="number-edit-row">
                  <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) {
                    newVal = editValue === 'yes';
                  } else if (ratio) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = `${n}/${ratio.denom}`;
                  } else if (nu) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n);
                  } else {
                    newVal = editValue.trim();
                  }
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT NODE (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS — array of {recommendation, date}, date-grouped ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();

    const groups = [];
    recs.forEach((rec, rIdx) => {
      const d = (rec?.date || '').trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push({ rec, rIdx });
      else groups.push({ date: d, items: [{ rec, rIdx }] });
    });

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, gIdx) => {
          const anyVisible = !searchTerm.trim() || phraseMatch || labelMatch || group.date.toLowerCase().includes(phrase) || group.items.some(({ rec }) => (rec?.recommendation || '').toLowerCase().includes(phrase));
          if (searchTerm.trim() && !anyVisible) return null;
          return (
            <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
              {group.items.map(({ rec, rIdx }) => {
                const recText = (rec?.recommendation || '').trim();
                const recDate = (rec?.date || '').trim();
                const itemKey = `${fn}-${idx}-r${rIdx}`;
                const isEditing = editingField === itemKey;
                const badge = editedSentences[itemKey];
                const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || recText.toLowerCase().includes(phrase) || recDate.toLowerCase().includes(phrase);
                if (!itemMatches && searchTerm.trim()) return null;
                return (
                  <div key={rIdx}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              const id2 = safeId(record); if (!id2) return;
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                              const trimmed = editValue.trim();
                              const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
                              setSaveError(null);
                              stageDraft(record, fn, idx, newArr);
                              setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
                              setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                              setEditingField(null); setEditValue('');
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${recText}${recDate ? ` (${recDate})` : ''}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: FIM SUBSCALES ═══════ */
  const renderFimSubscales = (record, idx, sid) => {
    const subs = record.functionalAssessment?.fimSubscales;
    if (!subs || typeof subs !== 'object') return null;
    const subscaleLabels = { selfCare: 'Self Care', transfers: 'Transfers', locomotion: 'Locomotion', communication: 'Communication', cognition: 'Cognition' };
    const entries = Object.entries(subs).filter(([k, v]) => v && k !== '_id');
    if (entries.length === 0) return null;

    return entries.map(([k, v]) => {
      const label = `FIM - ${subscaleLabels[k] || keyToLabel(k)}`;
      const fieldPath = `functionalAssessment.fimSubscales.${k}`;
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!label.toLowerCase().includes(phrase) && !fmtVal(v).toLowerCase().includes(phrase)) return null;
      }
      return (
        <div key={k} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {renderEditableRow(record, fieldPath, idx, label, v, sid)}
        </div>
      );
    });
  };

  /* ═══════ RENDER SECTION WRAPPER ═══════ */
  const renderSectionWrapper = (record, idx, sid, children) => {
    if (!shouldShowSection(record, sid)) return null;
    const title = SECTION_TITLES[sid];
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {children}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: STANDARD FLAT SECTION ═══════ */
  const renderFlatSection = (record, idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAnyVal) return null;

    const children = fields.map(f => {
      if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
      if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
      if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
      if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
      if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
      if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
      return renderStringField(record, f, idx, sid);
    });

    return renderSectionWrapper(record, idx, sid, children);
  };

  /* ═══════ RENDER: FUNCTIONAL ASSESSMENT (special: includes FIM subscales) ═══════ */
  const renderFunctionalAssessmentSection = (record, idx) => {
    const sid = 'functional-assessment';
    const fa = record.functionalAssessment;
    if (!fa) return null;
    const fields = SECTION_FIELDS[sid];
    const hasFimSubs = fa.fimSubscales && Object.entries(fa.fimSubscales).filter(([k, v]) => v && k !== '_id').length > 0;
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx))) || hasFimSubs;
    if (!hasAnyVal) return null;

    const children = (
      <>
        {renderNumberField(record, 'functionalAssessment.fimScore', idx, sid)}
        {renderFimSubscales(record, idx, sid)}
        {fields.slice(1).map(f => {
          if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
          return renderStringField(record, f, idx, sid);
        })}
      </>
    );

    return renderSectionWrapper(record, idx, sid, children);
  };

  /* ═══════ RENDER: SPASTICITY ASSESSMENT (dynamic object keys) ═══════ */
  const renderSpasticitySection = (record, idx) => {
    const sid = 'spasticity-assessment';
    const ash = record.spasticityAssessment?.ashworthScale;
    if (!ash || typeof ash !== 'object') return null;
    const entries = Object.entries(ash).filter(([k, v]) => k !== '_id' && hasVal(v));
    if (entries.length === 0) return null;

    const children = entries.map(([k, v]) => {
      const label = keyToLabel(k);
      const fieldPath = `spasticityAssessment.ashworthScale.${k}`;
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!label.toLowerCase().includes(phrase) && !fmtVal(v).toLowerCase().includes(phrase)) return null;
      }
      return (
        <div key={k} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {renderEditableRow(record, fieldPath, idx, label, v, sid)}
        </div>
      );
    });

    return renderSectionWrapper(record, idx, sid, children);
  };

  /* ═══════ RENDER: COPM (array of objects) ═══════ */
  const renderCOPMSection = (record, idx) => {
    const sid = 'copm';
    const areas = record.copm?.priorityAreas;
    if (!areas || !Array.isArray(areas) || areas.length === 0) return null;

    const children = areas.map((area, aIdx) => {
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!(area.activity || '').toLowerCase().includes(phrase) && !String(area.performanceScore).includes(phrase) && !String(area.satisfactionScore).includes(phrase)) return null;
      }
      return (
        <div key={aIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(area.activity)}</div>
          {renderEditableRow(record, `copm.priorityAreas.${aIdx}.performanceScore`, idx, 'Performance Score', area.performanceScore, sid)}
          {renderEditableRow(record, `copm.priorityAreas.${aIdx}.satisfactionScore`, idx, 'Satisfaction Score', area.satisfactionScore, sid)}
        </div>
      );
    });

    return renderSectionWrapper(record, idx, sid, children);
  };

  /* ═══════ RENDER: EQUIPMENT (array of objects) ═══════ */
  const renderEquipmentSection = (record, idx) => {
    const sid = 'equipment';
    const items = record.equipment;
    if (!items || !Array.isArray(items) || items.length === 0) return null;

    const children = items.map((eq, eqIdx) => {
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!(eq.item || '').toLowerCase().includes(phrase) && !(eq.indication || '').toLowerCase().includes(phrase) && !(eq.status || '').toLowerCase().includes(phrase)) return null;
      }
      return (
        <div key={eqIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(eq.item)}</div>
          {eq.indication && renderEditableRow(record, `equipment.${eqIdx}.indication`, idx, 'Indication', eq.indication, sid)}
          {eq.status && renderEditableRow(record, `equipment.${eqIdx}.status`, idx, 'Status', eq.status, sid)}
        </div>
      );
    });

    return renderSectionWrapper(record, idx, sid, children);
  };

  /* ═══════ RENDER: THERAPY SECTION (PT/OT/Speech/Psychology) ═══════ */
  const renderTherapySection = (record, idx, sid, therapyKey) => {
    const therapy = record.therapyInterventions?.[therapyKey];
    if (!therapy) return null;
    const interventions = Array.isArray(therapy.interventions) ? therapy.interventions : [];
    if (interventions.length === 0 && !therapy.frequency && !therapy.duration) return null;

    const children = (
      <>
        {therapy.frequency && (
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText('Frequency')}</div>
            {renderEditableRow(record, `therapyInterventions.${therapyKey}.frequency`, idx, 'Frequency', therapy.frequency, sid)}
          </div>
        )}
        {therapy.duration && (
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText('Duration')}</div>
            {renderEditableRow(record, `therapyInterventions.${therapyKey}.duration`, idx, 'Duration', therapy.duration, sid)}
          </div>
        )}
        {interventions.length > 0 && (
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText('Interventions')}</div>
            {interventions.map((item, iIdx) => {
              if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
                const phrase = searchTerm.toLowerCase().trim();
                if (!item.toLowerCase().includes(phrase) && !'interventions'.includes(phrase)) return null;
              }
              return renderEditableRow(record, `therapyInterventions.${therapyKey}.interventions.${iIdx}`, idx, `Intervention ${iIdx + 1}`, item, sid);
            })}
          </div>
        )}
      </>
    );

    return renderSectionWrapper(record, idx, sid, children);
  };

  /* ═══════ RENDER: PHARMACOLOGIC PLAN (string array) ═══════ */
  const renderPharmacologicPlanSection = (record, idx) => {
    const sid = 'pharmacologic-plan';
    const pp = record.medicalManagement?.pharmacologicPlan;
    if (!pp || !Array.isArray(pp) || pp.length === 0) return null;

    const children = (
      <div className="rec-mini-card">
        {pp.map((item, iIdx) => {
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!item.toLowerCase().includes(phrase)) return null;
          }
          return renderEditableRow(record, `medicalManagement.pharmacologicPlan.${iIdx}`, idx, `Plan ${iIdx + 1}`, item, sid);
        })}
      </div>
    );

    return renderSectionWrapper(record, idx, sid, children);
  };

  /* ═══════ RENDER: SPASTICITY MEDICATIONS (array of objects) ═══════ */
  const renderSpasticityMedicationsSection = (record, idx) => {
    const sid = 'spasticity-medications';
    const meds = record.medicalManagement?.spasticityMedications;
    if (!meds || !Array.isArray(meds) || meds.length === 0) return null;

    const children = meds.map((med, mIdx) => {
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!(med.medication || '').toLowerCase().includes(phrase) && !(med.action || '').toLowerCase().includes(phrase)) return null;
      }
      return (
        <div key={mIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(med.medication)}</div>
          {med.action && renderEditableRow(record, `medicalManagement.spasticityMedications.${mIdx}.action`, idx, 'Action', med.action, sid)}
        </div>
      );
    });

    return renderSectionWrapper(record, idx, sid, children);
  };

  /* ═══════ RENDER: SUPPORT GROUPS (string array) ═══════ */
  const renderSupportGroupsSection = (record, idx) => {
    const sid = 'support-groups';
    const sg = record.supportGroups;
    if (!sg || !Array.isArray(sg) || sg.length === 0) return null;

    const children = (
      <div className="rec-mini-card">
        {sg.map((g, gIdx) => {
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!g.toLowerCase().includes(phrase)) return null;
          }
          return renderEditableRow(record, `supportGroups.${gIdx}`, idx, `Group ${gIdx + 1}`, g, sid);
        })}
      </div>
    );

    return renderSectionWrapper(record, idx, sid, children);
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="pmr-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">PMR Assessment</h2></div>
        <div className="empty-state">No PMR assessment records available</div>
      </div>
    );
  }

  return (
    <div className="pmr-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">PMR Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PmrAssessmentDocumentPDFTemplate document={pdfData} />} fileName={`pmr-assessment-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search PMR assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date)}</span>
                  {record.status && <span className="record-date">{record.status}</span>}
                </div>
              )}
              <h3 className="record-name">{highlightText(`PMR Assessment ${idx + 1}`)}</h3>
              {record.provider && <span className="record-provider">{highlightText(record.provider)}</span>}
            </div>

            {/* 1. Functional History */}
            {renderFlatSection(record, idx, 'functional-history')}

            {/* 2. Functional Assessment */}
            {renderFunctionalAssessmentSection(record, idx)}

            {/* 3. Balance Assessment */}
            {renderFlatSection(record, idx, 'balance-assessment')}

            {/* 4. Gait Analysis */}
            {renderFlatSection(record, idx, 'gait-analysis')}

            {/* 5. Spasticity Assessment */}
            {renderSpasticitySection(record, idx)}

            {/* 5b. EMG / Nerve Conduction Studies */}
            {renderFlatSection(record, idx, 'emg-studies')}

            {/* 5c. Orthotic */}
            {renderFlatSection(record, idx, 'orthotic')}

            {/* 6. COPM Priority Areas */}
            {renderCOPMSection(record, idx)}

            {/* 7. Swallow Study */}
            {renderFlatSection(record, idx, 'swallow-study')}

            {/* 8. Neuropsychological Testing */}
            {renderFlatSection(record, idx, 'neuropsychological-testing')}

            {/* 9. Botulinum Toxin */}
            {renderFlatSection(record, idx, 'botulinum-toxin')}

            {/* 10. Equipment */}
            {renderEquipmentSection(record, idx)}

            {/* 11-14. Therapy Interventions */}
            {renderTherapySection(record, idx, 'physical-therapy', 'physicalTherapy')}
            {renderTherapySection(record, idx, 'occupational-therapy', 'occupationalTherapy')}
            {renderTherapySection(record, idx, 'speech-therapy', 'speechTherapy')}
            {renderTherapySection(record, idx, 'psychology', 'psychology')}

            {/* 15. Pharmacologic Plan */}
            {renderPharmacologicPlanSection(record, idx)}

            {/* 16. Spasticity Medications */}
            {renderSpasticityMedicationsSection(record, idx)}

            {/* 17. Support Groups */}
            {renderSupportGroupsSection(record, idx)}

            {/* 18. Discharge Planning */}
            {renderFlatSection(record, idx, 'discharge-planning')}

            {/* 19. General Information (facility) */}
            {renderFlatSection(record, idx, 'general-info')}

            {/* 20. Provider */}
            {renderFlatSection(record, idx, 'provider-info')}

            {/* 21. Findings */}
            {renderFlatSection(record, idx, 'findings-section')}

            {/* 22. Assessment */}
            {renderFlatSection(record, idx, 'assessment-section')}

            {/* 23. Plan */}
            {renderFlatSection(record, idx, 'plan-section')}

            {/* 24. Recommendations */}
            {renderFlatSection(record, idx, 'recommendations-section')}

            {/* 25. Results */}
            {renderFlatSection(record, idx, 'results-section')}

            {/* 26. Notes */}
            {renderFlatSection(record, idx, 'notes-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PmrAssessmentDocument;
