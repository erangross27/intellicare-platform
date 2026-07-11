/**
 * DiabetesManagementNotesDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: diabetes_management_notes
 *
 * 13 Sections:
 *   1. session-info: date (date picker), type, provider, facility, status
 *   2. vitals: weight, bmi, bloodPressure
 *   3. glycemic-control: hba1c, glucoseLevel, glucoseRange, timeInRange, controlStatus
 *   4. diabetes-info: diabetesType
 *   5. medications: insulinRegimen (sentence), oralMedications[], otherMedications[], medicationChanges (sentence)
 *   6. monitoring: selfMonitoring, medicationAdherence
 *   7. complications-section: complications[], neuropathyStatus (sentence), retinopathyStatus (sentence), nephropathyStatus (sentence), footExam (sentence)
 *   8. lifestyle: dietAdherence, exercisePattern, diabetesEducation (comma-delimited string), hypoglycemicEvents (sentence)
 *   9. findings-section: findings (sentence)
 *  10. assessment-section: assessment (sentence)
 *  11. plan-section: plan (sentence)
 *  12. goals-section: goals[], recommendations[]
 *  13. followup-notes: followUp (sentence), notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DiabetesManagementNotesDocumentPDFTemplate from '../pdf-templates/DiabetesManagementNotesDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './DiabetesManagementNotesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'diabetes_management_notesPendingEdits';
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
  'session-info': 'Session Information',
  'vitals': 'Vitals',
  'glycemic-control': 'Glycemic Control',
  'diabetes-info': 'Diabetes Information',
  'medications': 'Medications',
  'monitoring': 'Monitoring',
  'complications-section': 'Complications',
  'lifestyle': 'Lifestyle',
  'findings-section': 'Findings',
  'assessment-section': 'Assessment',
  'plan-section': 'Plan',
  'goals-section': 'Goals & Recommendations',
  'results-section': 'Results',
  'followup-notes': 'Follow-up & Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  weight: 'Weight',
  bmi: 'BMI',
  bloodPressure: 'Blood Pressure',
  hba1c: 'HbA1c',
  glucoseLevel: 'Glucose Level',
  glucoseRange: 'Glucose Range',
  timeInRange: 'Time in Range',
  controlStatus: 'Control Status',
  diabetesType: 'Diabetes Type',
  insulinRegimen: 'Insulin Regimen',
  oralMedications: 'Oral Medications',
  otherMedications: 'Other Medications',
  medicationChanges: 'Medication Changes',
  selfMonitoring: 'Self-Monitoring',
  medicationAdherence: 'Medication Adherence',
  complications: 'Complications',
  neuropathyStatus: 'Neuropathy Status',
  retinopathyStatus: 'Retinopathy Status',
  nephropathyStatus: 'Nephropathy Status',
  footExam: 'Foot Exam',
  dietAdherence: 'Diet Adherence',
  exercisePattern: 'Exercise Pattern',
  diabetesEducation: 'Diabetes Education',
  hypoglycemicEvents: 'Hypoglycemic Events',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  goals: 'Goals',
  recommendations: 'Recommendations',
  results: 'Results',
  followUp: 'Follow-up',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'type', 'provider', 'facility', 'status'],
  'vitals': ['weight', 'bmi', 'bloodPressure'],
  'glycemic-control': ['hba1c', 'glucoseLevel', 'glucoseRange', 'timeInRange', 'controlStatus'],
  'diabetes-info': ['diabetesType'],
  'medications': ['insulinRegimen', 'oralMedications', 'otherMedications', 'medicationChanges'],
  'monitoring': ['selfMonitoring', 'medicationAdherence'],
  'complications-section': ['complications', 'neuropathyStatus', 'retinopathyStatus', 'nephropathyStatus', 'footExam'],
  'lifestyle': ['dietAdherence', 'exercisePattern', 'diabetesEducation', 'hypoglycemicEvents'],
  'findings-section': ['findings'],
  'assessment-section': ['assessment'],
  'plan-section': ['plan'],
  'goals-section': ['goals', 'recommendations'],
  'results-section': ['results'],
  'followup-notes': ['followUp', 'notes'],
};

const SENTENCE_FIELDS = ['insulinRegimen', 'medicationChanges', 'neuropathyStatus', 'retinopathyStatus', 'nephropathyStatus', 'footExam', 'hypoglycemicEvents', 'findings', 'assessment', 'plan', 'followUp', 'notes'];
const ARRAY_FIELDS = ['oralMedications', 'otherMedications', 'complications', 'goals', 'recommendations'];
const DATE_FIELDS = ['date'];
const COMMA_DELIMITED_FIELDS = ['diabetesEducation'];

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* Known fixed-choice scales → full-scale dropdowns; descriptive stored values stay selectable.
   controlStatus/dietAdherence/weight are descriptive sentences across records → text. */
const ENUM_FIELDS = {
  type: ['Initial Consult', 'Follow-up', 'Annual Review', 'Urgent', 'Telehealth'],
  status: ['Active', 'Completed', 'Not Active'],
  diabetesType: ['Type 1', 'Type 2', 'Gestational', 'Prediabetes', 'LADA', 'MODY'],
};
const enumCanonical = (options, current) => {
  const cur = String(current ?? '').trim();
  const hit = options.find(o => o.toLowerCase() === cur.toLowerCase());
  return hit || cur;
};
const enumOptionsWith = (options, current) => {
  const cur = String(current ?? '').trim();
  if (!cur || options.some(o => o.toLowerCase() === cur.toLowerCase())) return options;
  return [cur, ...options];
};

/* Number+unit measurement strings ("9.8%", "186 mg/dL", "62%", bare "32.4") → stepper per
   number with the unit preserved verbatim. Explicit field list — never value-shape detection.
   bloodPressure ("142/88 mmHg") and weight (descriptive) stay text. */
const MEASURE_FIELDS = ['hba1c', 'glucoseLevel', 'timeInRange', 'bmi'];
const splitNumberUnit = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null; // ratios like 142/88 stay text
  const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/);
  if (!m || !/\d/.test(m[1]) || /\d/.test(m[3])) return null; // unit must be number-free
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() };
};
const stepFor = (v) => (/\.\d/.test(String(v)) ? 0.1 : 1);

/* ═══════ DYNAMIC-KEY OBJECT HELPERS (for `results`) ═══════ */
const KEY_OVERRIDES = { hba1c: 'HbA1c', bmi: 'BMI', egfr: 'eGFR', ldl: 'LDL', hdl: 'HDL', cgm: 'CGM' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
const isScalar = (v) => v === null || typeof v !== 'object';
const scalarToText = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const flattenObject = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenObject).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenObject(val)}`).join(' ');
  return '';
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split with the 4 guards
   (no-space commas like "2,300" stay; "and"/"or" adjacency stays connected;
   next char must be a letter / '>' / '(' to split) */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const nextTrim = rest.trimStart();
      const noSpace = rest.charAt(0) !== ' ';
      const andOr = /(?:^|\s)(?:and|or)$/i.test(current.trimEnd()) || /^(?:and|or)\b/i.test(nextTrim);
      const badNext = !/^[A-Za-z>(]/.test(nextTrim.charAt(0) || '');
      if (noSpace || andOr || badNext) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
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

/* ═══════ COMPONENT ═══════ */
const DiabetesManagementNotesDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.diabetes_management_notes) return Array.isArray(r.diabetes_management_notes) ? r.diabetes_management_notes : [r.diabetes_management_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_management_notes) return Array.isArray(dd.diabetes_management_notes) ? dd.diabetes_management_notes : [dd.diabetes_management_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // fieldPart is "field" or "field.arrayIndex"; mark the matching edited marker
        if (/\.\d+$/.test(fieldPart)) nFields[editKey] = 'edited';
        else { nFields[editKey] = 'edited'; nSentences[`${fieldPart}-${idx}-s0`] = 'edited'; }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  /* Rebuild the field text after a sentence edit. A semicolon-joined list ("a; b; c") keeps
     its SEMICOLON delimiter — rejoining with periods silently corrupts the stored shape. */
  function reconstructFullText(sentences, originalText) {
    if (!sentences || sentences.length === 0) return '';
    const semiJoined = typeof originalText === 'string' && originalText.includes(';') && !/\.\s/.test(originalText);
    if (semiJoined) return sentences.map(s => s.replace(/[;.]+$/, '').trim()).filter(Boolean).join('; ');
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* stepper helper: measurements step by decimal precision, clamped >= 0 */
  const stepEditValue = (dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      const s = stepFor(prev);
      let next = (isNaN(n) ? 0 : n) + dir * s;
      next = Math.round(next * 100) / 100;
      if (next < 0) next = 0;
      return String(next);
    });
  };

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const getArrayItemValue = useCallback((record, fn, idx, arrIdx) => {
    const k = `${fn}.${arrIdx}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record[fn];
    if (!Array.isArray(arr) || !arr[arrIdx]) return undefined;
    return arr[arrIdx];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const contentMatches = useCallback((text) => {
    if (!searchTerm.trim()) return true;
    return String(text || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ═══════ SEARCH ═══════ */
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
        if (Array.isArray(val)) {
          for (const item of val) {
            if (String(item).toLowerCase().includes(phrase)) return true;
          }
        } else if (val && typeof val === 'object') {
          if (flattenObject(val).toLowerCase().includes(phrase)) return true;
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
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
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      if (val && typeof val === 'object') return flattenObject(val).toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Diabetes Management Notes ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            }
          } else if (val && typeof val === 'object') {
            if (flattenObject(val).toLowerCase().includes(phrase)) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
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
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 2) {
            const [arrField, arrIdx] = dotParts;
            if (!merged[arrField]) merged[arrField] = [...(record[arrField] || [])];
            else merged[arrField] = [...merged[arrField]];
            merged[arrField][parseInt(arrIdx)] = localEdits[key];
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal; // simple/date field → fieldPart is the bare field name
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Save = stage a DRAFT locally only (fieldPart "field.arrayIndex"); committed to DB on Approve.
  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    const fieldPart = `${fn}.${arrIdx}`;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId]);

  // Save one sentence = stage the rebuilt full field text as a DRAFT locally (no DB write). Approve commits.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const stageDraft = (fullText) => {
      const editKey = `${fn}-${idx}`;
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated, currentVal);
      stageDraft(fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated, currentVal);
    stageDraft(fullText);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Collect this record's pending edits whose base field belongs to this section.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
      const lastDot = fieldPart.lastIndexOf('.');
      const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart;
      return fields.includes(baseField);
    });
    setSaving(true); setSaveError(null);
    try {
      // Persist each staged field now (field, or field+arrayIndex when the trailing segment is numeric).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const hasArrayIndex = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: hasArrayIndex ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (hasArrayIndex) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await secureApiClient.put(`/api/edit/diabetes_management_notes/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/diabetes_management_notes/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts (only the fields we committed) from localStorage.
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
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
    const lines = []; let running = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
      if (!value) return;
      const parts = splitByComma(value);
      if (parsed.isLabeled) {
        lines.push(parsed.label);
        lines.push(COPY_LINE_DASH);
        if (parts.length >= 3) parts.forEach((item, i) => { lines.push(`${i + 1}. ${item}`); });
        else lines.push(`1. ${value}`);
      } else if (parts.length >= 3) {
        parts.forEach(item => { lines.push(`${running++}. ${item}`); });
      } else {
        lines.push(`${running++}. ${value}`);
      }
    });
    return lines;
  }, [splitBySentence]);

  /* recursive object walk: every key = labeled sub-group (DASH + restart numbering) */
  const objectCopyLines = useCallback((label, value) => {
    const lines = [];
    if (label) { lines.push(label); lines.push(COPY_LINE_DASH); }
    if (isScalar(value)) { lines.push(`1. ${scalarToText(value)}`); return lines; }
    if (Array.isArray(value)) {
      value.filter(v => !isEmptyDeep(v)).forEach((v, i) => {
        if (isScalar(v)) lines.push(`${i + 1}. ${scalarToText(v)}`);
        else objectCopyLines('', v).forEach(l => lines.push(l));
      });
      return lines;
    }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
      objectCopyLines(humanizeKey(k), v).forEach(l => lines.push(l));
    });
    return lines;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      // single-name rule: a field label equal to the section title is not repeated
      const head = label.trim().toLowerCase() !== (title || '').trim().toLowerCase() ? `${label}\n${COPY_LINE_DASH}\n` : '';
      if (f === 'results' && val && typeof val === 'object' && !Array.isArray(val) && !isEmptyDeep(val)) {
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
          objectCopyLines(humanizeKey(k), v).forEach(l => { text += `${l}\n`; });
        });
        text += '\n';
      } else if (DATE_FIELDS.includes(f)) {
        text += `${head}1. ${formatDate(val)}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        text += head;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (COMMA_DELIMITED_FIELDS.includes(f)) {
        text += head;
        const items = splitByComma(fmtVal(val));
        items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        text += '\n';
      } else if (Array.isArray(val)) {
        text += head;
        val.forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
        text += '\n';
      } else {
        text += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = `Diabetes Management Notes\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Diabetes Management Notes ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const sectionText = buildSectionCopyText(r, idx, sid);
        // skip empty sections: title + divider alone is 2 non-empty lines
        if (sectionText.split('\n').filter(l => l.trim()).length > 2) text += sectionText;
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
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD (fixed-choice dropdown) ═══════ */
  const renderEnumField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const strVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const options = enumOptionsWith(ENUM_FIELDS[fn], strVal);

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(enumCanonical(ENUM_FIELDS[fn], strVal)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">{'✎'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: MEASUREMENT FIELD (number + preserved unit → stepper) ═══════ */
  const renderMeasureField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const nu = splitNumberUnit(fmtVal(val));
    if (!nu) return renderEditableField(record, fn, idx, sid, title); // off-shape value → plain text edit
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const strVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(nu.num); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="number-edit-row">
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>{'−'}</button>
                  <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
                </div>
                {nu.unit && <span className="number-edit-unit">{nu.unit}</span>}
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } const rebuilt = nu.unit ? `${n}${nu.sep}${nu.unit}` : String(n); handleSaveField(record, fn, idx, sid, null, rebuilt); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">{'✎'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (string arrays with arrayIndex) ═══════ */
  const renderArrayField = (record, idx, fn, sid) => {
    const arr = record[fn];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, arrIdx) => {
          const itemVal = getArrayItemValue(record, fn, idx, arrIdx) ?? item;
          if (!itemVal) return null;

          if (searchTerm.trim() && !phraseMatch) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!String(itemVal).toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
          }

          const editKey = `${fn}.${arrIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];

          return (
            <div key={arrIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(itemVal)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(String(itemVal))}</span><span className="edit-indicator">&#x270E;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(itemVal), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: COMMA-DELIMITED STRING FIELD (like diabetesEducation) ═══════ */
  const renderCommaDelimitedField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const items = splitByComma(fmtVal(val));
    if (items.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((ci, ciIdx) => {
          const commaKey = `${fn}-${idx}-c${ciIdx}`;
          const ciEditing = editingField === commaKey;
          const ciBadge = editedSentences[commaKey];
          const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!ciMatches && searchTerm.trim()) return null;
          return (
            <div key={ciIdx}>
              <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                {ciEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => {
                        e.stopPropagation();
                        const id2 = safeId(record); if (!id2) return;
                        const currentVal2 = fmtVal(getFieldValue(record, fn, idx) || '');
                        const allItems = splitByComma(currentVal2);
                        const trimmed = editValue.trim();
                        allItems[ciIdx] = trimmed;
                        const fullText2 = allItems.join(', ');
                        // Stage DRAFT locally only (no DB write); Approve commits.
                        const editKey2 = `${fn}-${idx}`;
                        setLocalEdits(prev => ({ ...prev, [editKey2]: fullText2 }));
                        setPendingEdits(prev => ({ ...prev, [editKey2]: true }));
                        setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
                        const store2 = readDrafts();
                        if (!store2[id2]) store2[id2] = {};
                        store2[id2][fn] = fullText2;
                        writeDrafts(store2);
                        setEditingField(null); setEditValue(''); setSaveError(null);
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#x270E;</span></div>
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
  };

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
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
              if (commaItems.length >= 3) {
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS, currentVal2); const editKey2 = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey2]: fullText2 })); setPendingEdits(prev => ({ ...prev, [editKey2]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); const store2 = readDrafts(); if (!store2[id2]) store2[id2] = {}; store2[id2][fn] = fullText2; writeDrafts(store2); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#x270E;</span></div>
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

            /* Unlabeled sentence that is a genuine comma list (>=3 guarded parts) → one row per part */
            if (!parsed.isLabeled) {
              const parts = splitByComma(sentence.replace(/[;.]+$/, '').trim());
              if (parts.length >= 3) {
                return (
                  <React.Fragment key={sIdx}>
                    {parts.map((ci, ciIdx) => {
                      const commaKey = `${sentenceKey}-c${ciIdx}`;
                      const ciEditing = editingField === commaKey;
                      const ciBadge = editedSentences[commaKey];
                      const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                      if (!ciMatches && searchTerm.trim()) return null;
                      return (
                        <div key={ciIdx}>
                          <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                            {ciEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const cur2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(cur2); const parts2 = splitByComma((sentences2[sIdx] || '').replace(/[;.]+$/, '').trim()); parts2[ciIdx] = editValue.trim().replace(/[;.]+$/, '').trim(); const allS = [...sentences2]; allS[sIdx] = parts2.filter(Boolean).join(', '); const fullText2 = reconstructFullText(allS, cur2); const editKey2 = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey2]: fullText2 })); setPendingEdits(prev => ({ ...prev, [editKey2]: true })); setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); const store2 = readDrafts(); if (!store2[id2]) store2[id2] = {}; store2[id2][fn] = fullText2; writeDrafts(store2); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">{'✎'}</span></div>
                                <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                              </>
                            )}
                          </div>
                          {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              }
            }

            /* Regular sentence row — with nested subtitle if labeled */
            return (
              <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const cur3 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(cur3); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2, cur3); const id3 = safeId(record); if (!id3) return; const editKey3 = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey3]: fullText })); setPendingEdits(prev => ({ ...prev, [editKey3]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); const store3 = readDrafts(); if (!store3[id3]) store3[id3] = {}; store3[id3][fn] = fullText; writeDrafts(store3); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText((parsed.isLabeled ? parsed.value : sentence).replace(/[;.]+$/, '').trim())}</span><span className="edit-indicator">&#x270E;</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence.replace(/[;.]+$/, '').trim(), sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
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
  };

  /* ═══════ RENDER: DYNAMIC-KEY OBJECT NODE (read-only, recursive) — for `results` ═══════ */
  const renderObjectNode = (label, value, keyPath, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) {
      const text = scalarToText(value);
      return (
        <div key={keyPath} className={label ? 'nested-mini-card' : ''}>
          {label && <div className="nested-subtitle sub-label">{highlightText(label)}</div>}
          <div className="numbered-row">
            <div className="row-content"><span className="content-value">{highlightText(text)}</span></div>
            <button className={`copy-btn ${copiedItems[keyPath] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(text, keyPath); }}>{copiedItems[keyPath] ? 'Copied!' : 'Copy'}</button>
          </div>
        </div>
      );
    }
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (
        <div key={keyPath} className="nested-mini-card">
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          {items.map((v, i) => isScalar(v)
            ? <div key={i} className="numbered-row"><div className="row-content"><span className="content-value">{i + 1}. {highlightText(scalarToText(v))}</span></div></div>
            : renderObjectNode('', v, `${keyPath}-${i}`, depth + 1))}
        </div>
      );
    }
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={keyPath} className={label ? 'nested-mini-card' : ''}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}
      </div>
    );
  };

  const renderResultsSection = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!val || typeof val !== 'object' || Array.isArray(val) || isEmptyDeep(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !flattenObject(val).toLowerCase().includes(searchTerm.toLowerCase().trim()) && !label.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {entries.map(([k, v]) => isScalar(v)
          ? renderObjectNode(humanizeKey(k), v, `${fn}-${idx}-${k}`, 1)
          : <div className="nested-mini-card" key={k}>{renderObjectNode(humanizeKey(k), v, `${fn}-${idx}-${k}`, 1)}</div>)}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(record[f]) && record[f].length > 0;
      return hasVal(val);
    });
    if (!hasAnyVal) return null;

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
          {fields.map(f => {
            if (f === 'results') return renderResultsSection(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, idx, f, sid);
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid, title);
            if (MEASURE_FIELDS.includes(f)) return renderMeasureField(record, f, idx, sid, title);
            if (COMMA_DELIMITED_FIELDS.includes(f)) return renderCommaDelimitedField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="diabetes-management-notes-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Diabetes Management Notes</h2></div>
        <div className="empty-state">No diabetes management notes records available</div>
      </div>
    );
  }

  return (
    <div className="diabetes-management-notes-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Diabetes Management Notes</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DiabetesManagementNotesDocumentPDFTemplate document={pdfData} />} fileName="Diabetes_Management_Notes.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search diabetes management notes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Diabetes Management Notes ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'vitals')}
            {renderSection(record, idx, 'glycemic-control')}
            {renderSection(record, idx, 'diabetes-info')}
            {renderSection(record, idx, 'medications')}
            {renderSection(record, idx, 'monitoring')}
            {renderSection(record, idx, 'complications-section')}
            {renderSection(record, idx, 'lifestyle')}
            {renderSection(record, idx, 'findings-section')}
            {renderSection(record, idx, 'assessment-section')}
            {renderSection(record, idx, 'plan-section')}
            {renderSection(record, idx, 'goals-section')}
            {renderSection(record, idx, 'results-section')}
            {renderSection(record, idx, 'followup-notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiabetesManagementNotesDocument;
