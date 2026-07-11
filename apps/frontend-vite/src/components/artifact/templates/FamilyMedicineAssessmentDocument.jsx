/**
 * FamilyMedicineAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: family_medicine_assessment
 *
 * 9 Sections:
 *   1. session-info: date (date picker), provider, facility, status
 *   2. preventive-screening: preventiveScreening.colonoscopy.{status,referral}, preventiveScreening.diabetesScreening.{hba1c,microalbumin}
 *   3. immunization-status: immunizationStatus.vaccines[] (array)
 *   4. chronic-disease: chronicDiseaseManagement.diabetes.{hba1c,goal,status}, .hypertension.{bp,goal,status}, .hyperlipidemia.{ldl,hdl,goal,status}
 *   5. mental-health: mentalHealthScreening.phq9Score (number), mentalHealthScreening.auditScore (number) + bar chart
 *   6. social-determinants: socialDeterminants (dynamic keys)
 *   7. assessment: assessment (semicolon-separated sentence)
 *   8. plan: plan (semicolon-separated sentence)
 *   9. notes-findings: findings, notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FamilyMedicineAssessmentDocumentPDFTemplate from '../pdf-templates/FamilyMedicineAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import './FamilyMedicineAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { field, value, arrayIndex? } } }
   The inner editKey mirrors this file's own localEdits key (e.g. "provider-0",
   "immunizationStatus.vaccines-0-2", "results-0"); the stored object is the EXACT PUT payload
   the original save handler would have sent, so Approve replays it faithfully (including the
   dotted-leaf field path that object-leaf edits use). */
const DRAFT_KEY = 'family_medicine_assessmentPendingEdits';
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
  'preventive-screening': 'Preventive Screening',
  'immunization-status': 'Immunization Status',
  'chronic-disease': 'Chronic Disease Management',
  'mental-health': 'Mental Health Screening',
  'social-determinants': 'Social Determinants',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  'notes-findings': 'Notes & Findings',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'preventiveScreening.colonoscopy.status': 'Colonoscopy Status',
  'preventiveScreening.colonoscopy.referral': 'Colonoscopy Referral',
  'preventiveScreening.diabetesScreening.hba1c': 'HbA1c (Screening)',
  'preventiveScreening.diabetesScreening.microalbumin': 'Microalbumin',
  'immunizationStatus.vaccines': 'Vaccines',
  'chronicDiseaseManagement.diabetes.hba1c': 'Diabetes HbA1c',
  'chronicDiseaseManagement.diabetes.goal': 'Diabetes Goal',
  'chronicDiseaseManagement.diabetes.status': 'Diabetes Status',
  'chronicDiseaseManagement.hypertension.bp': 'Hypertension BP',
  'chronicDiseaseManagement.hypertension.goal': 'Hypertension Goal',
  'chronicDiseaseManagement.hypertension.status': 'Hypertension Status',
  'chronicDiseaseManagement.hyperlipidemia.ldl': 'LDL',
  'chronicDiseaseManagement.hyperlipidemia.hdl': 'HDL',
  'chronicDiseaseManagement.hyperlipidemia.goal': 'Hyperlipidemia Goal',
  'chronicDiseaseManagement.hyperlipidemia.status': 'Hyperlipidemia Status',
  'mentalHealthScreening.phq9Score': 'PHQ-9 Score',
  'mentalHealthScreening.auditScore': 'AUDIT Score',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  findings: 'Findings',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'preventive-screening': [
    'preventiveScreening.colonoscopy.status', 'preventiveScreening.colonoscopy.referral',
    'preventiveScreening.diabetesScreening.hba1c', 'preventiveScreening.diabetesScreening.microalbumin',
  ],
  'immunization-status': ['immunizationStatus.vaccines'],
  'chronic-disease': [
    'chronicDiseaseManagement.diabetes.hba1c', 'chronicDiseaseManagement.diabetes.goal', 'chronicDiseaseManagement.diabetes.status',
    'chronicDiseaseManagement.hypertension.bp', 'chronicDiseaseManagement.hypertension.goal', 'chronicDiseaseManagement.hypertension.status',
    'chronicDiseaseManagement.hyperlipidemia.ldl', 'chronicDiseaseManagement.hyperlipidemia.hdl', 'chronicDiseaseManagement.hyperlipidemia.goal', 'chronicDiseaseManagement.hyperlipidemia.status',
  ],
  'mental-health': ['mentalHealthScreening.phq9Score', 'mentalHealthScreening.auditScore'],
  'social-determinants': [],
  assessment: ['assessment'],
  plan: ['plan'],
  results: ['results'],
  recommendations: ['recommendations'],
  'notes-findings': ['findings', 'notes'],
};

const NUMBER_FIELDS = ['mentalHealthScreening.phq9Score', 'mentalHealthScreening.auditScore'];
const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['provider', 'facility', 'status',
  'preventiveScreening.colonoscopy.status', 'preventiveScreening.colonoscopy.referral',
  'preventiveScreening.diabetesScreening.hba1c', 'preventiveScreening.diabetesScreening.microalbumin',
  'chronicDiseaseManagement.diabetes.hba1c', 'chronicDiseaseManagement.diabetes.goal', 'chronicDiseaseManagement.diabetes.status',
  'chronicDiseaseManagement.hypertension.bp', 'chronicDiseaseManagement.hypertension.goal', 'chronicDiseaseManagement.hypertension.status',
  'chronicDiseaseManagement.hyperlipidemia.ldl', 'chronicDiseaseManagement.hyperlipidemia.hdl', 'chronicDiseaseManagement.hyperlipidemia.goal', 'chronicDiseaseManagement.hyperlipidemia.status',
];
const SENTENCE_FIELDS = ['assessment', 'plan', 'findings', 'notes'];
const ARRAY_FIELDS = ['immunizationStatus.vaccines'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['results'];

/* ═══════ OBJECT / RECURSIVE HELPERS (donor: PointOfCareUltrasoundHeartRateDocument) ═══════ */
const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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

/* Nested object groupings */
const CDM_GROUPS = [
  { key: 'diabetes', label: 'Diabetes', fields: ['chronicDiseaseManagement.diabetes.hba1c', 'chronicDiseaseManagement.diabetes.goal', 'chronicDiseaseManagement.diabetes.status'] },
  { key: 'hypertension', label: 'Hypertension', fields: ['chronicDiseaseManagement.hypertension.bp', 'chronicDiseaseManagement.hypertension.goal', 'chronicDiseaseManagement.hypertension.status'] },
  { key: 'hyperlipidemia', label: 'Hyperlipidemia', fields: ['chronicDiseaseManagement.hyperlipidemia.ldl', 'chronicDiseaseManagement.hyperlipidemia.hdl', 'chronicDiseaseManagement.hyperlipidemia.goal', 'chronicDiseaseManagement.hyperlipidemia.status'] },
];

const PS_GROUPS = [
  { key: 'colonoscopy', label: 'Colonoscopy', fields: ['preventiveScreening.colonoscopy.status', 'preventiveScreening.colonoscopy.referral'] },
  { key: 'diabetesScreening', label: 'Diabetes Screening', fields: ['preventiveScreening.diabetesScreening.hba1c', 'preventiveScreening.diabetesScreening.microalbumin'] },
];

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

/* ═══════ COMPONENT ═══════ */
const FamilyMedicineAssessmentDocument = ({ document: docProp }) => {
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
      if (r?.family_medicine_assessment) return Array.isArray(r.family_medicine_assessment) ? r.family_medicine_assessment : [r.family_medicine_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.family_medicine_assessment) return Array.isArray(dd.family_medicine_assessment) ? dd.family_medicine_assessment : [dd.family_medicine_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const recordId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, payload]) => {
        if (!payload || typeof payload !== 'object') return;
        // editKey already carries the "-<idx>" of the ORIGINAL record index it was saved under.
        // Remap to the CURRENT render index by replacing the trailing index segment.
        let remapped = editKey;
        const m = editKey.match(/^(.*)-(\d+)(-\d+)?$/);
        if (m) remapped = `${m[1]}-${idx}${m[3] || ''}`;
        nLocal[remapped] = payload.value;
        nPending[remapped] = true;
        // restore the right edited/sentence marker so the row + Pending Approve button reappear
        if (payload.marker === 'sentence') nSentences[remapped] = 'edited';
        else nFields[remapped] = 'edited';
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
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.join(', '); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const safe = text
      .replace(/\bvs\.\s/gi, 'vs\u200B ')
      .replace(/\bDr\.\s/gi, 'Dr\u200B ')
      .replace(/\bMr\.\s/gi, 'Mr\u200B ')
      .replace(/\bMrs\.\s/gi, 'Mrs\u200B ')
      .replace(/\bSt\.\s/gi, 'St\u200B ')
      .replace(/\bJr\.\s/gi, 'Jr\u200B ')
      .replace(/\bSr\.\s/gi, 'Sr\u200B ');
    const raw = safe.split(/[;.]\s+/).map(s =>
      s.replace(/vs\u200B/g, 'vs.').replace(/Dr\u200B/g, 'Dr.').replace(/Mr\u200B/g, 'Mr.').replace(/Mrs\u200B/g, 'Mrs.').replace(/St\u200B/g, 'St.').replace(/Jr\u200B/g, 'Jr.').replace(/Sr\u200B/g, 'Sr.').trim()
    ).filter(s => s && !/^[;.,!?]+$/.test(s));
    /* Rejoin orphans: merge short fragments (<15 chars, no number prefix) into previous */
    const merged = [];
    for (const s of raw) {
      if (merged.length > 0 && s.length < 15 && !/^\d+[\.\)]/.test(s)) {
        merged[merged.length - 1] += '. ' + s;
      } else {
        merged.push(s);
      }
    }
    return merged;
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* dot-path getFieldValue: supports "preventiveScreening.colonoscopy.status" etc. */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) { const parts = fn.split('.'); let v = record; for (const p of parts) { if (v == null) return undefined; v = v[p]; } return v; }
    return record[fn];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    let orig;
    if (fn.includes('.')) { const parts = fn.split('.'); let v = record; for (const p of parts) { if (v == null) { orig = []; break; } v = v[p]; } if (orig === undefined) orig = Array.isArray(v) ? v : []; }
    else { orig = Array.isArray(record[fn]) ? record[fn] : []; }
    const edited = [];
    for (let i = 0; i < orig.length; i++) {
      const ik = `${fn}-${idx}-${i}`;
      edited.push(localEdits[ik] !== undefined ? localEdits[ik] : (typeof orig[i] === 'string' ? orig[i] : (orig[i]?.name || JSON.stringify(orig[i]))));
    }
    return edited;
  }, [localEdits]);

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
        if (Array.isArray(val)) { if (val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    /* social-determinants: dynamic keys */
    if (sid === 'social-determinants') {
      const sdoh = record.socialDeterminants || {};
      for (const k of Object.keys(sdoh)) {
        if (k.toLowerCase().includes(phrase) || String(sdoh[k]).toLowerCase().includes(phrase)) return true;
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
      if (Array.isArray(val)) return val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Family Medicine Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const sFields of Object.values(SECTION_FIELDS)) {
        for (const f of sFields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined) {
            if (Array.isArray(val)) { if (val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase))) return true; }
            else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      /* social determinants dynamic */
      const sdoh = record.socialDeterminants || {};
      for (const k of Object.keys(sdoh)) { if (k.toLowerCase().includes(phrase) || String(sdoh[k]).toLowerCase().includes(phrase)) return true; }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return filteredRecords;
    return filteredRecords.map((r, idx) => {
      const m = JSON.parse(JSON.stringify(r));
      Object.keys(localEdits).forEach(k => {
        if (pendingEdits[k]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const mt = k.match(/^(.+)-(\d+)$/);
        if (mt && parseInt(mt[2]) === idx && !k.match(/^.+-\d+-\d+$/)) {
          const fn = mt[1];
          if (fn.includes('.')) {
            const parts = fn.split('.');
            let obj = m;
            for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
            obj[parts[parts.length - 1]] = localEdits[k];
          } else { m[fn] = localEdits[k]; }
        }
      });
      return m;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* stageDraft — the single place a Save persists to. It does NOT write to MongoDB; it stages the
     edit locally (localEdits for render) + flags it pending (kept OUT of PDF/Copy All) + writes a
     DRAFT to localStorage so it survives refresh. The DB write happens ONLY on Approve, which
     replays the exact `payload` stored here. `marker` selects the edited/sentence tracking map. */
  const stageDraft = useCallback((record, idx, sid, localKey, localValue, payload, marker) => {
    const id = recordId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [localKey]: localValue }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    if (marker === 'sentence') setEditedSentences(prev => ({ ...prev, [localKey]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [localKey]: 'edited' }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow.
    if (sid != null) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][localKey] = { ...payload, marker: marker === 'sentence' ? 'sentence' : 'field' };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [recordId]);

  // Save = stage a DRAFT only (no DB write). Approve commits via the stored `payload`.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = recordId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    // localEdits key is always `${fn}-${idx}`; trackKey may differ but for this file they match.
    stageDraft(record, idx, sid, `${fn}-${idx}`, saveVal, { field: fn, value: saveVal }, 'field');
    if (trackKey !== `${fn}-${idx}`) setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
  }, [editValue, recordId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sectionId, arrayIndex) => {
    const id = recordId(record); if (!id) return;
    setSaveError(null);
    stageDraft(record, idx, sectionId, `${fn}-${idx}-${arrayIndex}`, editValue, { field: fn, value: editValue, arrayIndex }, 'field');
  }, [editValue, recordId, stageDraft]);

  /* stage a nested OBJECT leaf by dot-path (e.g. results.ef) — value stays a STRING.
     localEdits stores the merged root-object clone (for render); the DRAFT payload keeps the
     EXACT dotted-leaf PUT the original handler used, so Approve writes the leaf, not the object. */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = recordId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    setSaveError(null);
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    // localEdits key = `${rootField}-${idx}` (merged object); DRAFT key = leafKeyTrack (unique leaf).
    const recId = id;
    setLocalEdits(prev => ({ ...prev, [`${rootField}-${idx}`]: clone }));
    setPendingEdits(prev => ({ ...prev, [`${rootField}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[recId]) store[recId] = {};
    store[recId][leafKeyTrack] = { field: dottedField, value: newVal, marker: 'field', rootKey: `${rootField}-${idx}` };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [recordId, localEdits]);

  /* Stage a sentence edit as a DRAFT (no DB write). localEdits key is the whole-field `${fn}-${idx}`
     (so the rebuilt full text renders); the DRAFT payload is the field-level PUT Approve replays. */
  function stageFullTextDraft(record, fn, idx, fullText) {
    const id = recordId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}-${idx}`] = { field: fn, value: fullText, marker: 'sentence' };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = recordId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageFullTextDraft(record, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageFullTextDraft(record, fn, idx, fullText);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Resolve a stored draft's PUT `field` (e.g. "provider", "results.ef", "socialDeterminants.housing")
  // back to its section id, so Approve only commits drafts belonging to the approved section.
  const fieldToSection = useCallback((field) => {
    if (field && field.startsWith('socialDeterminants.')) return 'social-determinants';
    for (const [sid, fields] of Object.entries(SECTION_FIELDS)) {
      for (const f of fields) {
        if (field === f || field.startsWith(`${f}.`)) return sid;
      }
    }
    return null;
  }, []);

  // Approve = COMMIT this section's staged drafts to MongoDB (the ONLY DB writer), then clear pending
  // so the committed values flow into pdfData/PDF, drop the committed drafts from localStorage, flag
  // the record approved, and clear this section's edited/sentence markers (as the old handler did).
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = recordId(record); if (!id) return;
    setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // draftKeys (in the store) for THIS section whose entry resolves to `sid`
      const sectionDraftKeys = Object.keys(recDrafts).filter(dk => {
        const p = recDrafts[dk];
        return p && typeof p === 'object' && fieldToSection(p.field) === sid;
      });
      // localEdits keys to clear pending on = the draft key OR its rootKey (object-leaf merges)
      const localKeysToClear = new Set();
      for (const dk of sectionDraftKeys) {
        const p = recDrafts[dk];
        const payload = { field: p.field, value: p.value };
        if (typeof p.arrayIndex === 'number') payload.arrayIndex = p.arrayIndex;
        const resp = await secureApiClient.put(`/api/edit/family_medicine_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        localKeysToClear.add(p.rootKey || dk);
      }
      // Flag the record/section approved (audit trail) — same endpoint the old handler used
      await secureApiClient.put(`/api/edit/family_medicine_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; localKeysToClear.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store2 = readDrafts();
      if (store2[id]) { sectionDraftKeys.forEach(dk => delete store2[id][dk]); if (Object.keys(store2[id]).length === 0) delete store2[id]; writeDrafts(store2); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const fields = SECTION_FIELDS[sid] || [];
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[FamilyMedicineAssessment] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
  }, [recordId, fieldToSection]);

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

  /* object → copy lines (recursive) */
  const objectCopyLines = useCallback((label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const src = pdfData[idx] || record;
    if (sid === 'social-determinants') {
      const sdoh = src.socialDeterminants || {};
      Object.keys(sdoh).forEach(k => { if (hasVal(sdoh[k])) text += `${k}: ${fmtVal(sdoh[k])}\n`; });
      text += '\n'; return text;
    }
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        const recs = Array.isArray(val) ? val : [];
        if (recs.length === 0) return;
        text += `${label}\n`;
        recs.forEach((rec, i) => { const rt = (rec?.recommendation || '').trim(); const rd = (rec?.date || '').trim(); text += `${i + 1}. ${rt}${rd ? ` (${rd})` : ''}\n`; });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val) || isScalar(val)) return;
        text += `${label}\n`;
        objectCopyLines('', val, 0).forEach(line => { text += `${line}\n`; });
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, idx);
        if (!arr || arr.length === 0) return;
        text += `${label}\n`;
        arr.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        text += '\n';
      } else if (SENTENCE_FIELDS.includes(f)) {
        const val = String(getFieldValue(record, f, idx) || ''); if (!val.trim()) return;
        text += `${label}\n`;
        formatSentenceFieldLines(val).forEach(line => { text += `${line}\n`; });
        text += '\n';
      } else if (DATE_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx); if (!hasVal(val)) return;
        text += `${label}\n${formatDate(val)}\n\n`;
      } else {
        const val = getFieldValue(record, f, idx); if (!hasVal(val)) return;
        text += `${label}\n${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [pdfData, getEffectiveArray, getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== FAMILY MEDICINE ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Family Medicine Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ BAR CHART for Mental Health ═══════ */
  const prepareChartData = useCallback((record) => {
    const chartData = [];
    const phq9 = getFieldValue(record, 'mentalHealthScreening.phq9Score', 0);
    if (phq9 !== undefined && phq9 !== null && phq9 !== '') {
      const score = Number(phq9);
      if (!isNaN(score)) {
        const percentage = Math.max((score / 27) * 100, 5);
        let color, interpretation;
        if (score <= 4) { color = '#22c55e'; interpretation = 'Minimal Depression'; }
        else if (score <= 9) { color = '#3b82f6'; interpretation = 'Mild Depression'; }
        else if (score <= 14) { color = '#f59e0b'; interpretation = 'Moderate Depression'; }
        else if (score <= 19) { color = '#f97316'; interpretation = 'Moderately Severe Depression'; }
        else { color = '#ef4444'; interpretation = 'Severe Depression'; }
        chartData.push({ label: 'PHQ-9', rawValue: `${score}/27`, percentage, color, interpretation, maxValue: 27 });
      }
    }
    const audit = getFieldValue(record, 'mentalHealthScreening.auditScore', 0);
    if (audit !== undefined && audit !== null && audit !== '') {
      const score = Number(audit);
      if (!isNaN(score)) {
        const percentage = Math.max((score / 40) * 100, 5);
        let color, interpretation;
        if (score <= 7) { color = '#22c55e'; interpretation = 'Low Risk'; }
        else if (score <= 15) { color = '#3b82f6'; interpretation = 'Hazardous Drinking'; }
        else if (score <= 19) { color = '#f59e0b'; interpretation = 'Harmful Drinking'; }
        else { color = '#ef4444'; interpretation = 'Possible Dependence'; }
        chartData.push({ label: 'AUDIT', rawValue: `${score}/40`, percentage, color, interpretation, maxValue: 40 });
      }
    }
    return chartData;
  }, [getFieldValue]);

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
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
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

  /* ═══════ RENDER: NUMBER FIELD — input[type=number step=any] + parseFloat+isNaN→block save ═══════ */
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
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String(Math.max(0, (isNaN(c) ? 0 : c) - 1))); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String((isNaN(c) ? 0 : c) + 1)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const isSingleName = title && label.toLowerCase().trim() === String(title).toLowerCase().trim();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {!isSingleName && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageFullTextDraft(record, fn, idx, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageFullTextDraft(record, fn, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
        {!isSingleName && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ═══════ RENDER: ARRAY FIELD (immunizationStatus.vaccines) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const arr = getEffectiveArray(record, fn, idx); if (!arr || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, ai) => {
          const itemKey = `${fn}-${idx}-${ai}`;
          const isEditing = editingField === itemKey;
          const badge = editedFields[itemKey];
          const itemStr = String(item || '');
          const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches) return null;
          return (
            <div key={ai}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, sid, ai); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: GROUPED SECTION (Chronic Disease / Preventive Screening) ═══════ */
  const renderGroupedSection = (record, idx, sid, groups, sectionAllFields) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const hasAnyVal = sectionAllFields.some(f => hasVal(getFieldValue(record, f, idx)));
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
          {groups.map(group => {
            const groupHasVal = group.fields.some(f => hasVal(getFieldValue(record, f, idx)));
            if (!groupHasVal) return null;
            return (
              <div key={group.key} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(group.label)}</div>
                {group.fields.map(f => {
                  const val = getFieldValue(record, f, idx); if (!hasVal(val)) return null;
                  const editKey = `${f}-${idx}`; const isEditing = editingField === editKey;
                  const isNumberField = NUMBER_FIELDS.includes(f);
                  const fieldLabel = FIELD_LABELS[f] || f.split('.').pop();
                  const shortLabel = fieldLabel.replace(group.label + ' ', '');
                  const displayVal = fmtVal(val);
                  const isModified = editedFields[editKey];
                  if (searchTerm.trim() && !fieldMatches(record, f, idx) && !sectionTitleMatches(sid)) return null;
                  return (
                    <div key={f}>
                      <div className="field-label-inline">{highlightText(shortLabel)}</div>
                      <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(fmtVal(val)); setSaveError(null); } }}>
                        {isEditing ? (
                          <div className="edit-field-container">
                            {isNumberField ? (
                              <div className="num-stepper-row">
                                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String(Math.max(0, (isNaN(c) ? 0 : c) - 1))); }}>&minus;</button>
                                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const num = parseFloat(editValue); if (isNaN(num) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, f, idx, sid, null, num); } }} />
                                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String((isNaN(c) ? 0 : c) + 1)); }}>+</button>
                              </div>
                            ) : (
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            )}
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNumberField) { const num = parseFloat(editValue); if (isNaN(num) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, f, idx, sid, null, num); } else { handleSaveField(record, f, idx, sid); } }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                            <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${shortLabel}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SOCIAL DETERMINANTS (dynamic keys) ═══════ */
  const renderSocialDeterminants = (record, idx) => {
    const sid = 'social-determinants';
    const sdoh = record.socialDeterminants || {};
    if (!shouldShowSection(record, sid)) return null;
    const keys = Object.keys(sdoh).filter(k => hasVal(sdoh[k]));
    if (keys.length === 0) return null;
    const title = SECTION_TITLES[sid]; const copyId = `${sid}-${idx}`;
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
          {keys.map(k => {
            const dotPath = `socialDeterminants.${k}`;
            const editKey = `${dotPath}-${idx}`;
            const val = localEdits[editKey] !== undefined ? localEdits[editKey] : sdoh[k];
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const kLabel = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
            if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !kLabel.toLowerCase().includes(searchTerm.toLowerCase().trim()) && !fmtVal(val).toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
            return (
              <div key={k} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(kLabel)}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(fmtVal(val)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, dotPath, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(fmtVal(val))}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${kLabel}\n${fmtVal(val)}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: MENTAL HEALTH SECTION with bar chart + editable scores ═══════ */
  const renderMentalHealthSection = (record, idx) => {
    const sid = 'mental-health';
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid];
    const hasAnyVal2 = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAnyVal2) return null;
    const title = SECTION_TITLES[sid]; const copyId = `${sid}-${idx}`;
    const chartData = prepareChartData(record);
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
          {/* Editable number fields */}
          {fields.map(f => renderNumberField(record, f, idx, sid))}
          {/* Bar Chart */}
          {chartData.length > 0 && (
            <div className="chart-container">
              <div className="chart-legend">
                <div className="legend-item"><span className="legend-color" style={{ background: '#22c55e' }} /><span>Normal/Minimal</span></div>
                <div className="legend-item"><span className="legend-color" style={{ background: '#3b82f6' }} /><span>Mild</span></div>
                <div className="legend-item"><span className="legend-color" style={{ background: '#f59e0b' }} /><span>Moderate</span></div>
                <div className="legend-item"><span className="legend-color" style={{ background: '#ef4444' }} /><span>Severe</span></div>
              </div>
              {chartData.map((item, chartIdx) => (
                <div key={chartIdx} className="bar-chart-row">
                  <div className="bar-label">{item.label}</div>
                  <div className="bar-category-value" style={{ color: item.color }}>{item.rawValue}</div>
                  <div className="bar-container">
                    <div className="bar-background">
                      <div className="bar-fill" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                  <div className="bar-scale">
                    <span className="scale-item" style={{ left: '0%' }}>0</span>
                    <span className="scale-item" style={{ left: '50%' }}>{Math.round(item.maxValue / 2)}</span>
                    <span className="scale-item" style={{ left: '100%' }}>{item.maxValue}</span>
                  </div>
                  <div className="bar-interpretation" style={{ color: item.color }}>{item.interpretation}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, ratio stays text) ═══════ */
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
                <BlueSelect value={editValue === 'yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v === 'Yes' ? 'yes' : 'no')} />
              ) : (ratio || nu) ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String((isNaN(c) ? 0 : c) - 1)); }}>&minus;</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String((isNaN(c) ? 0 : c) + 1)); }}>+</button>
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
                  if (isBool) { newVal = editValue === 'yes'; }
                  else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = `${n}/${ratio.denom}`; }
                  else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); }
                  else { newVal = editValue.trim(); }
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

  /* ═══════ RENDER: OBJECT NODE (recursive) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
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
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
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
                              const id2 = recordId(record); if (!id2) return;
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                              const trimmed = editValue.trim();
                              const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
                              setSaveError(null);
                              // Stage a DRAFT only (no DB write). Approve replays { field: fn, value: newArr }.
                              setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: newArr }));
                              setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
                              setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
                              setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                              { const store = readDrafts(); if (!store[id2]) store[id2] = {}; store[id2][`${fn}-${idx}`] = { field: fn, value: newArr, marker: 'sentence' }; writeDrafts(store); }
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    /* Special sections */
    if (sid === 'chronic-disease') return renderGroupedSection(record, idx, sid, CDM_GROUPS, SECTION_FIELDS[sid]);
    if (sid === 'preventive-screening') return renderGroupedSection(record, idx, sid, PS_GROUPS, SECTION_FIELDS[sid]);
    if (sid === 'mental-health') return renderMentalHealthSection(record, idx);
    if (sid === 'social-determinants') return renderSocialDeterminants(record, idx);

    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal2 = fields.some(f => {
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      return hasVal(getFieldValue(record, f, idx));
    });
    if (!hasAnyVal2) return null;

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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderStringField(record, f, idx, sid, title);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="family-medicine-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Family Medicine Assessment</h2></div>
        <div className="empty-state">No family medicine assessment records available</div>
      </div>
    );
  }

  return (
    <div className="family-medicine-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Family Medicine Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<FamilyMedicineAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Family_Medicine_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search family medicine assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Family Medicine Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'preventive-screening')}
            {renderSection(record, idx, 'immunization-status')}
            {renderSection(record, idx, 'chronic-disease')}
            {renderSection(record, idx, 'mental-health')}
            {renderSection(record, idx, 'social-determinants')}
            {renderSection(record, idx, 'assessment')}
            {renderSection(record, idx, 'plan')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'notes-findings')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FamilyMedicineAssessmentDocument;
