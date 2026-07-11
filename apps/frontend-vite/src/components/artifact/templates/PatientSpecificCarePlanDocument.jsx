/**
 * PatientSpecificCarePlanDocument.jsx
 * June 2026 — Full Template Standard upgrade — Collection: patient_specific_care_plan
 * API: /api/edit/patient_specific_care_plan
 *
 * Donors cloned:
 *  - PastMedicalHistoryDocument: per-sentence editing (splitBySentence/SENTENCE_FIELDS/
 *    renderSentenceEditableField/reconstructFullText/saveSentence), per-sentence approve.
 *  - PointOfCareUltrasoundHeartRateDocument: DATE renderDateField, recursive OBJECT
 *    renderObjectLeaf/renderObjectNode/renderObjectField, date-grouped recommendations,
 *    4-level search, typed leaf editing (number/boolean/text).
 *
 * SCHEMA FIELDS (15 → 100% coverage):
 *   ARRAY-of-OBJECTS: tailoredInterventions, lifestyleModifications
 *   OBJECT (recursive): comorbidityManagement, results
 *   DATE:   date
 *   STRING: type, provider, facility, findings, assessment, plan, notes, status, longTerm
 *   ARRAY (recommendations of {recommendation,date} or strings): recommendations
 *
 * Narrative STRING fields use per-sentence editing: findings, assessment, plan, notes, longTerm.
 * Short STRING fields stay simple/typed: type, provider, facility, status.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PatientSpecificCarePlanDocumentPDFTemplate from '../pdf-templates/PatientSpecificCarePlanDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './PatientSpecificCarePlanDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [draftKey]: { localKey, localValue, field, value, track } } }
   - localKey/localValue → repopulate localEdits (always `${rootField}-${idx}`)
   - field/value         → the exact backend payload replayed on Approve (field may be dotted)
   - track               → { kind: 'field'|'sentence', key } marker to restore on refresh */
const DRAFT_KEY = 'patient_specific_care_planPendingEdits';
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
  'encounter': 'Encounter',
  'tailored-interventions': 'Tailored Interventions',
  'lifestyle-mods': 'Lifestyle Modifications',
  'comorbidity-mgmt': 'Comorbidity Management',
  'clinical': 'Clinical Assessment',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-status': 'Notes & Status',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  longTerm: 'Long-Term Plan',
  notes: 'Notes',
  status: 'Status',
  results: 'Results',
  recommendations: 'Recommendations',
  comorbidityManagement: 'Comorbidity Management',
  tailoredInterventions: 'Tailored Interventions',
  lifestyleModifications: 'Lifestyle Modifications',
};

/* SECTION_FIELDS — every schema field assigned to a section group */
const SECTION_FIELDS = {
  'encounter': ['date', 'type', 'provider', 'facility'],
  'tailored-interventions': ['tailoredInterventions'],
  'lifestyle-mods': ['lifestyleModifications'],
  'comorbidity-mgmt': ['comorbidityManagement'],
  'clinical': ['findings', 'assessment', 'plan', 'longTerm'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-status': ['notes', 'status'],
};

const SECTION_ORDER = ['encounter', 'tailored-interventions', 'lifestyle-mods', 'comorbidity-mgmt', 'clinical', 'results-section', 'recommendations-section', 'notes-status'];

const DATE_FIELDS = ['date'];
/* Short simple strings (typed, no per-sentence) */
const SIMPLE_STRING_FIELDS = ['type', 'provider', 'facility', 'status'];
/* Narrative strings — per-sentence editing */
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'longTerm', 'notes'];
/* Recursive object fields */
const OBJECT_FIELDS = ['comorbidityManagement', 'results'];
/* Array-of-objects {recommendation, date} (date-grouped) */
const OBJECT_ARRAY_FIELDS = ['recommendations'];
/* Array-of-objects custom-rendered sections */
const CUSTOM_ARRAY_FIELDS = ['tailoredInterventions', 'lifestyleModifications'];

const KEY_OVERRIDES = {
  bp: 'BP', hr: 'HR', ldl: 'LDL', hdl: 'HDL', hba1c: 'HbA1c', egfr: 'eGFR', bmi: 'BMI', gdmt: 'GDMT',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key);
  if (/\s/.test(s)) return s.charAt(0).toUpperCase() + s.slice(1);
  const r = s.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return r.charAt(0).toUpperCase() + r.slice(1);
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

/* ═══════ VALUE HELPERS ═══════ */
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};
const isEpochSentinel = (dateValue) => {
  if (!dateValue) return false;
  try { const d = new Date(dateValue.$date || dateValue); return d.getTime() === 0 || (d.getFullYear() === 1970 && d.getMonth() === 0 && d.getDate() === 1); } catch { return false; }
};

/* ═══════ COMPONENT ═══════ */
const PatientSpecificCarePlanDocument = ({ document: docProp, data, templateData }) => {
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (r.patient_specific_care_plan) return Array.isArray(r.patient_specific_care_plan) ? r.patient_specific_care_plan : [r.patient_specific_care_plan];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.patient_specific_care_plan) return Array.isArray(dd.patient_specific_care_plan) ? dd.patient_specific_care_plan : [dd.patient_specific_care_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idById = {};
    records.forEach((r, idx) => {
      if (!r?._id) return;
      const id = typeof r._id === 'string' ? r._id : (r._id.$oid || String(r._id));
      idById[id] = idx;
    });
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    Object.entries(store).forEach(([recId, drafts]) => {
      const idx = idById[recId];
      if (idx === undefined || !drafts) return;
      Object.values(drafts).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const localKey = (entry.localKey || '').replace(/-\d+$/, `-${idx}`);
        if (localKey) { nLocal[localKey] = entry.localValue; nPending[localKey] = true; }
        const track = entry.track;
        if (track && track.key) {
          const tkey = track.key.replace(/-(\d+)(?=(-|$))/, `-${idx}$2`);
          if (track.kind === 'sentence') nSentences[tkey] = track.badge || 'edited';
          else nFields[tkey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0 && Object.keys(nFields).length === 0 && Object.keys(nSentences).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => !isEmptyDeep(v), []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).split(regex).map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  const recsToText = useCallback((recs) => {
    if (!Array.isArray(recs)) return '';
    return recs.map(r => (typeof r === 'string' ? r : `${r?.recommendation || ''} ${r?.date || ''}`)).join(' ');
  }, []);

  /* tailoredInterventions / lifestyleModifications → searchable text */
  const customArrayText = useCallback((arr) => {
    if (!Array.isArray(arr)) return '';
    return arr.map(flattenSearchable).join(' ');
  }, []);

  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (OBJECT_ARRAY_FIELDS.includes(f)) return recsToText(val);
    if (CUSTOM_ARRAY_FIELDS.includes(f)) return customArrayText(val);
    if (OBJECT_FIELDS.includes(f)) return flattenSearchable(val);
    if (DATE_FIELDS.includes(f)) return formatDate(val);
    return fmtVal(val);
  }, [recsToText, customArrayText, fmtVal]);

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
      if (val !== null && val !== undefined && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) return fieldSearchText(fn, val).toLowerCase().includes(phrase);
    return false;
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `patient-specific care plan ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fieldSearchText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => filteredRecords.map((record, idx) => {
    const merged = { ...record };
    Object.keys(localEdits).forEach(key => {
      if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
      const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key];
    });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Stage a DRAFT locally (localEdits + pendingEdits + marker) and persist to the pending-drafts
     localStorage store. NOT written to MongoDB and NOT shown in the PDF until Approve commits it.
     - localKey/localValue → what gets merged into localEdits (always `${rootField}-${idx}`)
     - field/value         → exact backend payload replayed on Approve (field may be dotted)
     - track               → { kind, key, badge? } marker restored on refresh */
  const stageDraft = useCallback((record, idx, sid, { localKey, localValue, field, value, track }) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [localKey]: localValue }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    if (track) {
      if (track.kind === 'sentence') setEditedSentences(prev => ({ ...prev, [track.key]: track.badge || 'edited' }));
      else setEditedFields(prev => ({ ...prev, [track.key]: 'edited' }));
    }
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    // draftKey = the exact backend field path (dotted ok) → one payload per distinct DB write
    store[id][field] = { localKey, localValue, field, value, track };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, idx, sid, {
      localKey: `${fn}-${idx}`, localValue: saveVal,
      field: fn, value: saveVal,
      track: { kind: 'field', key: trackKey },
    });
  }, [editValue, safeId, stageDraft]);

  /* Build a cloned root field with newVal written at path, merging any already-staged localEdits. */
  const cloneRootWithPath = useCallback((record, rootField, idx, path, newVal, emptyDefault) => {
    setSaveError(null);
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? emptyDefault));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    return clone;
  }, [localEdits]);

  /* save a nested array-item path (e.g. tailoredInterventions.0.adherenceStrategy) → stage DRAFT only */
  const savePath = useCallback((record, rootField, path, idx, sid, trackKey, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    const clone = cloneRootWithPath(record, rootField, idx, path, newVal, (typeof path[0] === 'number' ? [] : {}));
    stageDraft(record, idx, sid, {
      localKey: `${rootField}-${idx}`, localValue: clone,
      field: dottedField, value: newVal,
      track: { kind: 'field', key: trackKey },
    });
  }, [safeId, cloneRootWithPath, stageDraft]);

  /* save a nested OBJECT leaf by dot-path (e.g. comorbidityManagement.integratedApproach) → stage DRAFT only */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    const clone = cloneRootWithPath(record, rootField, idx, path, newVal, {});
    stageDraft(record, idx, sid, {
      localKey: `${rootField}-${idx}`, localValue: clone,
      field: dottedField, value: newVal,
      track: { kind: 'field', key: leafKeyTrack },
    });
  }, [safeId, cloneRootWithPath, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage DRAFT only (no DB write). Approve commits.
      stageDraft(record, idx, sid, {
        localKey: `${fn}-${idx}`, localValue: fullText,
        field: fn, value: fullText,
        track: { kind: 'sentence', key: `${fn}-${idx}-s${sentenceIdx}`, badge: 'edited' },
      });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    // Stage DRAFT only (no DB write). Approve commits.
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = { localKey: `${fn}-${idx}`, localValue: fullText, field: fn, value: fullText, track: { kind: 'sentence', key: `${fn}-${idx}-s${sentenceIdx}`, badge: changed ? 'edited' : undefined } };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so committed
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Collect this record's staged drafts that belong to this section (by root field of the payload).
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const sectionDraftKeys = Object.keys(recDrafts).filter(draftField => {
        const root = draftField.includes('.') ? draftField.slice(0, draftField.indexOf('.')) : draftField;
        return fields.includes(root);
      });
      // Persist each staged payload to the DB now (field may be dotted; value is the exact payload).
      for (const draftField of sectionDraftKeys) {
        const entry = recDrafts[draftField];
        const resp = await secureApiClient.put(`/api/edit/patient_specific_care_plan/${id}/edit`, { field: entry.field, value: entry.value });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/patient_specific_care_plan/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; sectionDraftKeys.forEach(df => { const lk = recDrafts[df]?.localKey; if (lk) delete n[lk]; }); return n; });
      // Drop this section's drafts from localStorage (now committed)
      if (store[id]) { sectionDraftKeys.forEach(df => delete store[id][df]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[PatientSpecificCarePlan] Approve error:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, [safeId]);

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

  /* object → copy lines (recursive) — stacked: label ABOVE value, never side-by-side */
  const objectCopyLines = useCallback((label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { if (label) out.push(`${pad}${label}:`); out.push(`${pad}${fmtScalar(value)}`); return out; }
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return out;
      if (label) out.push(`${pad}${label}:`);
      items.forEach((v, i) => { if (isScalar(v)) out.push(`${pad}  ${i + 1}. ${fmtScalar(v)}`); else out.push(...objectCopyLines(`Item ${i + 1}`, v, indent + 1)); });
      return out;
    }
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return out;
    if (label) out.push(`${pad}${label}:`);
    entries.forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  }, []);

  /* custom array (tailoredInterventions/lifestyleModifications) → copy text */
  const customArrayCopyLines = useCallback((arr) => {
    const out = [];
    (Array.isArray(arr) ? arr : []).filter(it => !isEmptyDeep(it)).forEach((item, i) => {
      const title = item.intervention || item.condition || item.domain || `Item ${i + 1}`;
      out.push(`${i + 1}. ${title}`);
      Object.entries(item).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
        if (k === 'intervention' || k === 'condition' || k === 'domain') return;
        objectCopyLines(humanizeKey(k), v, 1).forEach(l => out.push(l));
      });
    });
    return out;
  }, [objectCopyLines]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val : [];
        if (!sameAsTitle) text += `${label}\n`;
        let lastDate = null; let n = 1;
        recs.forEach((r) => {
          const rec = typeof r === 'string' ? r : (r?.recommendation || '').trim();
          const date = typeof r === 'string' ? '' : (r?.date || '').trim();
          if (date !== lastDate) { if (date) text += `${date}\n`; lastDate = date; n = 1; }
          text += `${n++}. ${rec}\n`;
        });
        text += '\n';
      } else if (CUSTOM_ARRAY_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n`;
        customArrayCopyLines(val).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else if (DATE_FIELDS.includes(f)) {
        text += sameAsTitle ? `${formatDate(val)}\n\n` : `${label}\n${formatDate(val)}\n\n`;
      } else {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          if (!sameAsTitle) text += `${label}\n`;
          sentences.forEach((s, i) => { text += `${i + 1}. ${s}\n`; });
          text += '\n';
        } else {
          text += sameAsTitle ? `${strVal}\n\n` : `${label}\n${strVal}\n\n`;
        }
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, objectCopyLines, customArrayCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PATIENT-SPECIFIC CARE PLAN ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Patient-Specific Care Plan ${idx + 1}\n${'='.repeat(40)}\n\n`;
      SECTION_ORDER.forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE FIELD ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isEpochSentinel(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SIMPLE STRING FIELD (single-value, typed) ═══════ */
  const renderSimpleStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSaveField(record, fn, idx, sid); } }} />
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

  /* ═══════ RENDER: SENTENCE-EDITABLE STRING FIELD (per-sentence) ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
      return (
        <div key={fn} className="rec-mini-card">
          {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            return (
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveSentence(record, fn, idx, sid, sIdx); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      );
    }

    /* Single-value fallback */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSaveField(record, fn, idx, sid); } }} />
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

  /* ═══════ RENDER: OBJECT LEAF (number/boolean/text typed; "4/5" stays text) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'Yes' : 'No') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <BlueSelect value={editValue === 'Yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
              ) : (ratio || nu) ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>{'−'}</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } let nv; if (ratio) nv = `${n}/${ratio.denom}`; else if (nu) nv = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); else nv = String(n); saveLeaf(record, rootField, path, idx, sid, leafKey, nv); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu && nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
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
                    newVal = editValue === 'Yes';
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

  /* ═══════ RENDER: OBJECT (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    if (Array.isArray(value)) {
      const items = value.map((v, i) => [i, v]).filter(([, v]) => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          <div className="nested-group">
            {items.map(([i, v]) => (
              isScalar(v) ? renderObjectLeaf(record, rootField, [...path, i], idx, sid, v)
                : <div className="nested-mini-card" key={i}>{renderObjectNode(record, rootField, idx, sid, `${label} ${i + 1}`.trim(), v, [...path, i], depth + 1)}</div>
            ))}
          </div>
        </React.Fragment>
      );
    }
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

  /* ═══════ RENDER: RECOMMENDATIONS — array of {recommendation, date} or strings, date-grouped ═══════ */
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
      const d = (typeof rec === 'string' ? '' : (rec?.date || '')).trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push({ rec, rIdx });
      else groups.push({ date: d, items: [{ rec, rIdx }] });
    });

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, gIdx) => {
          const anyVisible = !searchTerm.trim() || phraseMatch || labelMatch || group.date.toLowerCase().includes(phrase) || group.items.some(({ rec }) => (typeof rec === 'string' ? rec : (rec?.recommendation || '')).toLowerCase().includes(phrase));
          if (searchTerm.trim() && !anyVisible) return null;
          return (
            <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
              {group.items.map(({ rec, rIdx }) => {
                const recText = (typeof rec === 'string' ? rec : (rec?.recommendation || '')).trim();
                const recDate = (typeof rec === 'string' ? '' : (rec?.date || '')).trim();
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
                              const newArr = currentArr.map((r, i) => i === rIdx ? (typeof r === 'string' ? trimmed : { ...r, recommendation: trimmed }) : (typeof r === 'string' ? r : { ...r }));
                              // Stage DRAFT only (no DB write). Approve commits.
                              stageDraft(record, idx, sid, {
                                localKey: `${fn}-${idx}`, localValue: newArr,
                                field: fn, value: newArr,
                                track: { kind: 'sentence', key: itemKey, badge: 'edited' },
                              });
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

  /* ═══════ RENDER: TAILORED INTERVENTIONS (array of objects) ═══════ */
  const renderTailoredInterventions = (record, idx, sid) => {
    const tis = getFieldValue(record, 'tailoredInterventions', idx);
    if (!Array.isArray(tis) || tis.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, 'tailoredInterventions', idx) && !sectionTitleMatches(sid)) return null;
    return tis.map((ti, tiIdx) => {
      if (isEmptyDeep(ti)) return null;
      const title = ti.intervention || ti.condition || `Intervention ${tiIdx + 1}`;
      const root = 'tailoredInterventions';
      const cardCopyId = `ti-card-${idx}-${tiIdx}`;
      return (
        <div key={tiIdx} className="rec-mini-card ti-card">
          <div className="ti-card-header">
            <div className="ti-card-title">{highlightText(title)}</div>
            <button className={`copy-btn ${copiedItems[cardCopyId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(customArrayCopyLines([ti]).join('\n'), cardCopyId); }}>{copiedItems[cardCopyId] ? 'Copied!' : 'Copy'}</button>
          </div>
          {Object.entries(ti).filter(([k, v]) => !isEmptyDeep(v) && k !== 'intervention' && k !== 'condition').map(([k, v]) => (
            <React.Fragment key={k}>{renderObjectNode(record, root, idx, sid, humanizeKey(k), v, [tiIdx, k], 1)}</React.Fragment>
          ))}
        </div>
      );
    });
  };

  /* ═══════ RENDER: LIFESTYLE MODIFICATIONS (array of objects) ═══════ */
  const renderLifestyleModifications = (record, idx, sid) => {
    const lms = getFieldValue(record, 'lifestyleModifications', idx);
    if (!Array.isArray(lms) || lms.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, 'lifestyleModifications', idx) && !sectionTitleMatches(sid)) return null;
    return lms.map((lm, lmIdx) => {
      if (isEmptyDeep(lm)) return null;
      const title = lm.domain || `Lifestyle ${lmIdx + 1}`;
      const root = 'lifestyleModifications';
      const cardCopyId = `lm-card-${idx}-${lmIdx}`;
      return (
        <div key={lmIdx} className="rec-mini-card lm-card">
          <div className="ti-card-header">
            <div className="ti-card-title">{highlightText(title)}</div>
            <button className={`copy-btn ${copiedItems[cardCopyId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(customArrayCopyLines([lm]).join('\n'), cardCopyId); }}>{copiedItems[cardCopyId] ? 'Copied!' : 'Copy'}</button>
          </div>
          {Object.entries(lm).filter(([k, v]) => !isEmptyDeep(v) && k !== 'domain').map(([k, v]) => (
            <React.Fragment key={k}>{renderObjectNode(record, root, idx, sid, humanizeKey(k), v, [lmIdx, k], 1)}</React.Fragment>
          ))}
        </div>
      );
    });
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
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
            if (f === 'tailoredInterventions') return <React.Fragment key={f}>{renderTailoredInterventions(record, idx, sid)}</React.Fragment>;
            if (f === 'lifestyleModifications') return <React.Fragment key={f}>{renderLifestyleModifications(record, idx, sid)}</React.Fragment>;
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid);
            return renderSimpleStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="patient-specific-care-plan-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Patient-Specific Care Plan</h2></div>
        <div className="empty-state">No patient-specific care plan records available</div>
      </div>
    );
  }

  return (
    <div className="patient-specific-care-plan-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Patient-Specific Care Plan</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PatientSpecificCarePlanDocumentPDFTemplate document={pdfData} />} fileName="Patient_Specific_Care_Plan.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search care plan (interventions, lifestyle, findings, plan, results...)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {hasVal(record.date) && <span className="record-date">{formatDate(record.date)}</span>}
                {hasVal(record.provider) && <span className="record-date">{fmtVal(record.provider)}</span>}
                {hasVal(record.facility) && <span className="record-date">{fmtVal(record.facility)}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Patient-Specific Care Plan ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatientSpecificCarePlanDocument;
