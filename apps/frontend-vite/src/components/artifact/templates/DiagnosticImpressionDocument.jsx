/**
 * DiagnosticImpressionDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: diagnostic_impression
 *
 * 11 Sections:
 *   1. session-info: date (date picker), type, provider, facility, status
 *   2. primary-diagnosis: primaryDiagnosis.diagnosis, primaryDiagnosis.severity
 *   3. differential-diagnoses: differentialDiagnoses[] (hide if empty)
 *   4. comorbidities: comorbidities[] — {diagnosis}
 *   5. provisional-diagnoses: provisionalDiagnoses[] (hide if empty)
 *   6. rule-out-diagnoses: ruleOutDiagnoses[] (hide if empty)
 *   7. findings-section: findings (parseLabel!)
 *   8. assessment-section: assessment (sentence)
 *   9. plan-section: plan (numbered, splitBySentence)
 *  10. recommendations-section: recommendations[] — {recommendation, date}
 *  11. notes-section: notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DiagnosticImpressionDocumentPDFTemplate from '../pdf-templates/DiagnosticImpressionDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DiagnosticImpressionDocument.css';
import BlueDatePicker from '../components/BlueDatePicker';

/* Canonical copy dividers (one-pass item 2): '=' under record/section titles,
   '-' under every field sub-label. Every value row is numbered (item 3). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'primary-diagnosis': 'Primary Diagnosis',
  'differential-diagnoses': 'Differential Diagnoses',
  'comorbidities': 'Comorbidities',
  'provisional-diagnoses': 'Provisional Diagnoses',
  'rule-out-diagnoses': 'Rule Out Diagnoses',
  'findings-section': 'Clinical Findings',
  'assessment-section': 'Assessment',
  'plan-section': 'Plan',
  'recommendations-section': 'Recommendations',
  'results-section': 'Test Results',
  'notes-section': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'primaryDiagnosis.diagnosis': 'Diagnosis',
  'primaryDiagnosis.icd10Code': 'ICD-10 Code',
  'primaryDiagnosis.severity': 'Severity',
  'primaryDiagnosis.specifiers': 'Specifiers',
  differentialDiagnoses: 'Differential Diagnoses',
  comorbidities: 'Comorbidities',
  provisionalDiagnoses: 'Provisional Diagnoses',
  ruleOutDiagnoses: 'Rule Out Diagnoses',
  findings: 'Clinical Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Test Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'type', 'provider', 'facility', 'status'],
  'primary-diagnosis': ['primaryDiagnosis.diagnosis', 'primaryDiagnosis.icd10Code', 'primaryDiagnosis.severity', 'primaryDiagnosis.specifiers'],
  'differential-diagnoses': ['differentialDiagnoses'],
  'comorbidities': ['comorbidities'],
  'provisional-diagnoses': ['provisionalDiagnoses'],
  'rule-out-diagnoses': ['ruleOutDiagnoses'],
  'findings-section': ['findings'],
  'assessment-section': ['assessment'],
  'plan-section': ['plan'],
  'recommendations-section': ['recommendations'],
  'results-section': ['results'],
  'notes-section': ['notes'],
};

const DATE_FIELDS = ['date'];
const SENTENCE_FIELDS = ['assessment', 'notes'];
const PARSELAB_FIELDS = ['findings'];
const NUMBERED_FIELDS = ['plan'];
const DIAGNOSIS_ARRAY_FIELDS = ['differentialDiagnoses', 'comorbidities', 'provisionalDiagnoses', 'ruleOutDiagnoses'];
const DOT_NOTATION_FIELDS = ['primaryDiagnosis.diagnosis', 'primaryDiagnosis.icd10Code', 'primaryDiagnosis.severity'];
/* Read-only display field: primaryDiagnosis.specifiers is an array — shown but not edited
   (not in the backend ALLOWED_FIELDS). Rendered as numbered rows under a "Specifiers" label. */
const READONLY_ARRAY_FIELDS = ['primaryDiagnosis.specifiers'];
const RECOMMENDATIONS_FIELD = 'recommendations';
const RESULTS_FIELD = 'results';
const BOOLEAN_FIELDS = [];
const NUMBER_FIELDS = [];

/* formatKey: turn a dynamic object key into a readable label (camelCase / snake_case) */
const formatKey = (key) => String(key || '')
  .replace(/([A-Z])/g, ' $1')
  .replace(/_/g, ' ')
  .replace(/^\w/, c => c.toUpperCase())
  .trim();

/* flattenDynamicObject: recursively flatten a dynamic-key object into [{label, value}] lines */
const flattenDynamicObject = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object') return [];
  const lines = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const label = prefix ? `${prefix} - ${formatKey(key)}` : formatKey(key);
    if (Array.isArray(value)) {
      const items = value.filter(v => v !== null && v !== undefined && v !== '');
      if (items.length === 0) return;
      lines.push({ label, value: items.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ') });
    } else if (typeof value === 'object') {
      const nested = flattenDynamicObject(value, label);
      if (nested.length > 0) lines.push(...nested);
    } else {
      lines.push({ label, value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) });
    }
  });
  return lines;
};

/* ═══════ HIDE-IF-EMPTY SECTIONS ═══════ */
const HIDE_IF_EMPTY_SECTIONS = ['differential-diagnoses', 'provisional-diagnoses', 'rule-out-diagnoses'];

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

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field", "field.arrayIndex",
   "field.arrayIndex.subField", or "parent.child" for dot-notation fields) */
const DRAFT_KEY = 'diagnostic_impressionPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ COMPONENT ═══════ */
const DiagnosticImpressionDocument = ({ document: docProp }) => {
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
      if (r?.diagnostic_impression) return Array.isArray(r.diagnostic_impression) ? r.diagnostic_impression : [r.diagnostic_impression];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diagnostic_impression) return Array.isArray(dd.diagnostic_impression) ? dd.diagnostic_impression : [dd.diagnostic_impression]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Maps record _id (handling _id.$oid) → render index. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = record?._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        if (SENTENCE_FIELDS.includes(baseField) || PARSELAB_FIELDS.includes(baseField) || NUMBERED_FIELDS.includes(baseField)) {
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        } else {
          nFields[editKey] = 'edited';
        }
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
    /* For numbered items like "1. Foo 2. Bar 3. Baz" — split on number boundaries */
    const numbered = text.split(/\s+(?=\d+\.\s)/).filter(s => s.trim()).map(s => s.trim());
    if (numbered.length > 1) return numbered;
    /* Fall back to sentence split */
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    /* Check if numbered — if first item starts with digit+dot, rejoin with spaces */
    const isNumbered = sentences.length > 0 && /^\d+\.\s/.test(sentences[0]);
    if (isNumbered) return sentences.join(' ');
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* ═══════ FIELD VALUE GETTERS ═══════ */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    /* dot-notation for nested fields like primaryDiagnosis.diagnosis */
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let obj = record;
      for (const p of parts) { obj = obj?.[p]; if (obj === undefined) return undefined; }
      return obj;
    }
    return record[fn];
  }, [localEdits]);

  const getRecommendationItemValue = useCallback((record, idx, arrIdx, subField) => {
    const k = `recommendations.${arrIdx}.${subField}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record.recommendations;
    if (!Array.isArray(arr) || !arr[arrIdx]) return undefined;
    return arr[arrIdx][subField];
  }, [localEdits]);

  const getDiagnosisItemValue = useCallback((record, fn, idx, arrIdx) => {
    const k = `${fn}.${arrIdx}.diagnosis-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record[fn];
    if (!Array.isArray(arr) || !arr[arrIdx]) return undefined;
    const item = arr[arrIdx];
    return typeof item === 'object' ? item.diagnosis : item;
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
        if (f === RESULTS_FIELD && typeof val === 'object' && !Array.isArray(val)) {
          if (flattenDynamicObject(val).some(line => `${line.label} ${line.value}`.toLowerCase().includes(phrase))) return true;
        } else if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'object') {
              const txt = item.diagnosis || item.recommendation || '';
              if (String(txt).toLowerCase().includes(phrase)) return true;
            } else {
              if (String(item).toLowerCase().includes(phrase)) return true;
            }
          }
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
      if (fn === RESULTS_FIELD && typeof val === 'object' && !Array.isArray(val)) {
        return flattenDynamicObject(val).some(line => `${line.label} ${line.value}`.toLowerCase().includes(phrase));
      }
      if (Array.isArray(val)) {
        return val.some(item => {
          if (typeof item === 'object') {
            const txt = item.diagnosis || item.recommendation || '';
            return String(txt).toLowerCase().includes(phrase);
          }
          return String(item).toLowerCase().includes(phrase);
        });
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Diagnostic Impression ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && f === RESULTS_FIELD && typeof val === 'object' && !Array.isArray(val)) {
            if (flattenDynamicObject(val).some(line => `${line.label} ${line.value}`.toLowerCase().includes(phrase))) return true;
          } else if (val && Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'object') {
                const txt = item.diagnosis || item.recommendation || '';
                if (String(txt).toLowerCase().includes(phrase)) return true;
              } else if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            }
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
      if (record.primaryDiagnosis) merged.primaryDiagnosis = { ...record.primaryDiagnosis };
      if (record.recommendations) merged.recommendations = record.recommendations.map(r => ({ ...r }));
      if (record.comorbidities) merged.comorbidities = record.comorbidities.map(c => typeof c === 'object' ? { ...c } : c);
      if (record.differentialDiagnoses) merged.differentialDiagnoses = record.differentialDiagnoses.map(d => typeof d === 'object' ? { ...d } : d);
      if (record.provisionalDiagnoses) merged.provisionalDiagnoses = record.provisionalDiagnoses.map(d => typeof d === 'object' ? { ...d } : d);
      if (record.ruleOutDiagnoses) merged.ruleOutDiagnoses = record.ruleOutDiagnoses.map(d => typeof d === 'object' ? { ...d } : d);
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 3) {
            /* e.g. recommendations.0.recommendation or comorbidities.0.diagnosis */
            const [arrField, arrIdx, subField] = dotParts;
            if (!merged[arrField]) merged[arrField] = [...(record[arrField] || [])];
            else merged[arrField] = [...merged[arrField]];
            if (merged[arrField][parseInt(arrIdx)]) {
              merged[arrField][parseInt(arrIdx)] = { ...merged[arrField][parseInt(arrIdx)], [subField]: localEdits[key] };
            }
          } else if (dotParts.length === 2) {
            /* e.g. primaryDiagnosis.diagnosis */
            const [parent, child] = dotParts;
            if (!merged[parent]) merged[parent] = {};
            else merged[parent] = { ...merged[parent] };
            merged[parent][child] = localEdits[key];
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback(async (record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const originalVal = DOT_NOTATION_FIELDS.includes(fn) ? (() => { const parts = fn.split('.'); let o = record; for (const p of parts) { o = o?.[p]; } return o; })() : record[fn];

    /* Number validation: parseFloat + isNaN → warning + block save */
    if (NUMBER_FIELDS.includes(fn) || (typeof originalVal === 'number' && !DIAGNOSIS_ARRAY_FIELDS.includes(fn))) {
      const trimmed = String(saveVal).trim();
      if (isNaN(Number(trimmed))) { setSaveError('Please enter a valid number'); return; }
      saveVal = Number(trimmed);
    }
    /* Boolean validation: convert Yes/No → true/false */
    if (BOOLEAN_FIELDS.includes(fn) || typeof originalVal === 'boolean') {
      const lower = String(saveVal).toLowerCase();
      if (!['true', 'false', 'yes', 'no', '1', '0'].includes(lower)) { setSaveError('Please enter Yes or No'); return; }
      saveVal = ['true', 'yes', '1'].includes(lower);
    }

    // Stage a DRAFT locally + persist to localStorage (survives refresh). NO DB write — Approve commits.
    setSaveError(null);
    const displayVal = typeof saveVal === 'boolean' ? (saveVal ? 'Yes' : 'No') : String(saveVal);
    const stagedVal = typeof saveVal === 'boolean' ? saveVal : (typeof saveVal === 'number' ? saveVal : displayVal);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: stagedVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section's approved flag so the button goes back to yellow Pending
    setApprovedSections(prev => { const k = `${_sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = stagedVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, subField, value) => {
    const id = safeId(record); if (!id) return;
    // Stage a DRAFT locally + persist to localStorage. NO DB write — Approve commits.
    setSaveError(null);
    const fieldPart = `${fn}.${arrIdx}.${subField}`;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    // Stage a DRAFT locally + persist to localStorage. NO DB write — Approve commits.
    const stageDraft = (fullText) => {
      setSaveError(null);
      const editKey = `${fn}-${idx}`;
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
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
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Pending editKeys belonging to THIS record + section (baseField in section fields)
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      const base = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(fieldPart) || fields.includes(base);
    });
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field", "field.idx", "field.idx.subField", or "parent.child"
        const parts = fieldPart.split('.');
        const payload = { value: localEdits[editKey] };
        if (parts.length === 3 && /^\d+$/.test(parts[1])) {
          // array item: field + arrayIndex + subField (reverses handleSaveArrayItem)
          payload.field = parts[0];
          payload.arrayIndex = parseInt(parts[1], 10);
          payload.subField = parts[2];
        } else if (parts.length === 2 && /^\d+$/.test(parts[1])) {
          // array element: field + arrayIndex (only when trailing segment is purely numeric)
          payload.field = parts[0];
          payload.arrayIndex = parseInt(parts[1], 10);
        } else {
          // simple field or dot-notation field (e.g. primaryDiagnosis.diagnosis) — send whole path
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/diagnostic_impression/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/diagnostic_impression/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); if (store[id]) delete store[id][fp]; });
        if (store[id] && Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[DiagnosticImpression] Approve error:', err); }
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

  /* Canonical section copy: title + '=', every field = sub-label + '-' + numbered value rows.
     NEVER side-by-side "Label: value" (one-pass items 1-3). Single-name array sections (the field
     label == section title) skip the sub-label and number the items directly. */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    const pushLabeled = (label, values) => {
      if (!values || values.length === 0) return;
      text += `${label}\n${COPY_LINE_DASH}\n`;
      values.forEach((v, i) => { text += `${i + 1}. ${v}\n`; });
      text += '\n';
    };
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        pushLabeled(label, [formatDate(val)]);
      } else if (READONLY_ARRAY_FIELDS.includes(f)) {
        pushLabeled(label, (Array.isArray(val) ? val : [val]).filter(v => hasVal(v)).map(v => String(v)));
      } else if (f === RECOMMENDATIONS_FIELD) {
        const arr = record.recommendations || [];
        if (arr.length > 0) {
          const recDates = [...new Set(arr.filter(r => r.date).map(r => formatDate(r.date)))];
          pushLabeled('Date', recDates);
          arr.forEach((item, i) => {
            const recText = getRecommendationItemValue(record, idx, i, 'recommendation') ?? item.recommendation ?? String(item);
            text += `${i + 1}. ${recText}\n`;
          });
          text += '\n';
        }
      } else if (DIAGNOSIS_ARRAY_FIELDS.includes(f)) {
        const arr = record[f] || [];
        if (arr.length > 0) {
          arr.forEach((item, i) => {
            const diagText = getDiagnosisItemValue(record, f, idx, i) ?? (typeof item === 'object' ? item.diagnosis : item) ?? '';
            const icd = (item && typeof item === 'object') ? item.icd10Code : '';
            text += `${i + 1}. ${diagText}${icd ? ` (${icd})` : ''}\n`;
          });
          text += '\n';
        }
      } else if (f === RESULTS_FIELD) {
        flattenDynamicObject(record.results).forEach(line => pushLabeled(line.label, [line.value]));
      } else if (PARSELAB_FIELDS.includes(f) || SENTENCE_FIELDS.includes(f) || NUMBERED_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n`;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        pushLabeled(label, [fmtVal(val)]);
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, getRecommendationItemValue, getDiagnosisItemValue]);

  const copyAllText = useCallback(async () => {
    let text = `Diagnostic Impression\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Diagnostic Impression ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const section = buildSectionCopyText(r, idx, sid);
        // Empty-section guard: a section with only its title + '=' divider (<=2 non-empty
        // lines) has no real content — skip it so empty sections don't leak their heading.
        if (section.split('\n').filter(l => l.trim()).length > 2) text += section;
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
            <div className="edit-field-container" onClick={e => e.stopPropagation()}>
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (!editValue || isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
    const isBool = BOOLEAN_FIELDS.includes(fn) || typeof val === 'boolean';
    const isNum = NUMBER_FIELDS.includes(fn) || typeof val === 'number';
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isBool ? fmtVal(val) : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="Yes">Yes</option><option value="No">No</option></select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isBool) { handleSaveField(record, fn, idx, undefined, undefined, editValue === 'Yes'); } else if (isNum) { const trimmed = editValue.trim(); if (isNaN(Number(trimmed))) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, undefined, undefined, Number(trimmed)); } else { handleSaveField(record, fn, idx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: DIAGNOSIS ARRAY SECTION ═══════ */
  const renderDiagnosisArraySection = (record, idx, fn, sid) => {
    const arr = record[fn];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return arr.map((item, arrIdx) => {
      const diagVal = getDiagnosisItemValue(record, fn, idx, arrIdx);
      if (!diagVal) return null;

      /* Append the item's ICD-10 code to the DISPLAY (edit still operates on the diagnosis text). */
      const icd = (item && typeof item === 'object') ? item.icd10Code : '';
      const displayText = `${diagVal}${icd ? ` (${icd})` : ''}`;

      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!displayText.toLowerCase().includes(phrase)) return null;
      }

      const editKey = `${fn}.${arrIdx}.diagnosis-${idx}`;
      const isEditing = editingField === editKey;
      const badge = editedFields[editKey];

      return (
        <div key={arrIdx} className="rec-mini-card">
          <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(diagVal)); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx, 'diagnosis', editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(displayText)}</span><span className="edit-indicator">{'\u270E'}</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayText, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: RECOMMENDATIONS ARRAY ═══════ */
  const renderRecommendationsSection = (record, idx, sid) => {
    const arr = record.recommendations;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    /* Group by date */
    const recDates = [...new Set(arr.filter(r => r.date).map(r => formatDate(r.date)))];

    return (
      <div key="recommendations">
        {recDates.length > 0 && (
          <div className="rec-mini-card" style={{ marginBottom: 8 }}>
            <div className="nested-subtitle">Date</div>
            <div className="numbered-row">
              <div className="row-content"><span className="content-value">{highlightText(recDates.join(', '))}</span></div>
            </div>
          </div>
        )}
        {arr.map((item, arrIdx) => {
          const recVal = getRecommendationItemValue(record, idx, arrIdx, 'recommendation') ?? item.recommendation ?? String(item);
          if (!recVal) return null;

          if (searchTerm.trim() && !phraseMatch) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!String(recVal).toLowerCase().includes(phrase)) return null;
          }

          const editKey = `recommendations.${arrIdx}.recommendation-${idx}`;
          const isEditing = editingField === editKey;
          const badge = editedFields[editKey];

          return (
            <div key={arrIdx} className="rec-mini-card">
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(recVal)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, 'recommendations', idx, arrIdx, 'recommendation', editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(String(recVal))}</span><span className="edit-indicator">{'\u270E'}</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(recVal), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
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
    const useParseLab = PARSELAB_FIELDS.includes(fn);

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

            const parsed = useParseLab ? parseLabel(sentence) : { isLabeled: false, label: '', value: sentence };
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); /* Stage a DRAFT locally + persist to localStorage. NO DB write — Approve commits. */ setSaveError(null); const editKey2 = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey2]: fullText2 })); setPendingEdits(prev => ({ ...prev, [editKey2]: true })); setApprovedSections(prev => { const ak = `${sid}-${idx}`; if (!prev[ak]) return prev; const n = { ...prev }; delete n[ak]; return n; }); const store2 = readDrafts(); if (!store2[id2]) store2[id2] = {}; store2[id2][fn] = fullText2; writeDrafts(store2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">{'\u270E'}</span></div>
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

            /* Regular sentence row -- with nested subtitle if labeled */
            return (
              <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id3 = safeId(record); if (!id3) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); /* Stage a DRAFT locally + persist to localStorage. NO DB write — Approve commits. */ setSaveError(null); const editKey3 = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey3]: fullText })); setPendingEdits(prev => ({ ...prev, [editKey3]: true })); setApprovedSections(prev => { const ak = `${sid}-${idx}`; if (!prev[ak]) return prev; const n = { ...prev }; delete n[ak]; return n; }); const store3 = readDrafts(); if (!store3[id3]) store3[id3] = {}; store3[id3][fn] = fullText; writeDrafts(store3); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">{'\u270E'}</span></div>
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
  };

  /* ═══════ RENDER: RESULTS DYNAMIC-KEY OBJECT ═══════ */
  const renderResultsSection = (record, idx, sid) => {
    const obj = record.results;
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
    const lines = flattenDynamicObject(obj);
    if (lines.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    const rendered = lines.map((line, lineIdx) => {
      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!`${line.label} ${line.value}`.toLowerCase().includes(phrase)) return null;
      }
      const copyId = `results.${lineIdx}-${idx}`;
      return (
        <div key={lineIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(line.label)}</div>
          <div className="numbered-row">
            <div className="row-content"><span className="content-value">{highlightText(line.value)}</span></div>
            <button className={`copy-btn ${copiedItems[copyId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${line.label}\n${line.value}`, copyId); }}>{copiedItems[copyId] ? 'Copied!' : 'Copy'}</button>
          </div>
        </div>
      );
    }).filter(Boolean);

    if (rendered.length === 0) return null;
    return <div key="results">{rendered}</div>;
  };

  /* ═══════ RENDER: READ-ONLY ARRAY FIELD (e.g. primaryDiagnosis.specifiers) ═══════ */
  const renderReadOnlyArrayField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(v => hasVal(v)) : (hasVal(val) ? [val] : []);
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, i) => {
          const copyId = `${fn}.${i}-${idx}`;
          return (
            <div key={i} className="numbered-row">
              <div className="row-content"><span className="content-value">{highlightText(String(item))}</span></div>
              <button className={`copy-btn ${copiedItems[copyId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), copyId); }}>{copiedItems[copyId] ? 'Copied!' : 'Copy'}</button>
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    /* Check if section has any values */
    const hasAnyVal = fields.some(f => {
      if (DIAGNOSIS_ARRAY_FIELDS.includes(f)) return Array.isArray(record[f]) && record[f].length > 0;
      if (f === RECOMMENDATIONS_FIELD) return Array.isArray(record.recommendations) && record.recommendations.length > 0;
      if (f === RESULTS_FIELD) return record.results && typeof record.results === 'object' && Object.keys(record.results).length > 0;
      const val = getFieldValue(record, f, idx);
      return hasVal(val);
    });
    if (!hasAnyVal) return null;

    /* Hide-if-empty sections: skip when array is empty even if not searching */
    if (HIDE_IF_EMPTY_SECTIONS.includes(sid)) {
      const arrField = fields[0];
      const arr = record[arrField];
      if (!Array.isArray(arr) || arr.length === 0) return null;
    }

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
            if (f === RECOMMENDATIONS_FIELD) return renderRecommendationsSection(record, idx, sid);
            if (f === RESULTS_FIELD) return renderResultsSection(record, idx, sid);
            if (DIAGNOSIS_ARRAY_FIELDS.includes(f)) return renderDiagnosisArraySection(record, idx, f, sid);
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (READONLY_ARRAY_FIELDS.includes(f)) return renderReadOnlyArrayField(record, f, idx, sid, title);
            if (PARSELAB_FIELDS.includes(f) || SENTENCE_FIELDS.includes(f) || NUMBERED_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="diagnostic-impression-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Diagnostic Impression</h2></div>
        <div className="empty-state">No diagnostic impression records available</div>
      </div>
    );
  }

  return (
    <div className="diagnostic-impression-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Diagnostic Impression</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DiagnosticImpressionDocumentPDFTemplate document={pdfData} />} fileName="Diagnostic_Impression.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search diagnostic impression..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {/* Canonical record title only — date/type/status render in the Session Information section */}
              <h3 className="record-name">{highlightText(`Diagnostic Impression ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'primary-diagnosis')}
            {renderSection(record, idx, 'differential-diagnoses')}
            {renderSection(record, idx, 'comorbidities')}
            {renderSection(record, idx, 'provisional-diagnoses')}
            {renderSection(record, idx, 'rule-out-diagnoses')}
            {renderSection(record, idx, 'findings-section')}
            {renderSection(record, idx, 'assessment-section')}
            {renderSection(record, idx, 'plan-section')}
            {renderSection(record, idx, 'recommendations-section')}
            {renderSection(record, idx, 'results-section')}
            {renderSection(record, idx, 'notes-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiagnosticImpressionDocument;
