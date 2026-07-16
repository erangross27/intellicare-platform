/**
 * TrendAnalysisDocument.jsx
 * June 2026 — Collection: trend_analysis (NEW template, schema-only build)
 *
 * Donor cloned: PointOfCareUltrasoundHeartRateDocument (generic recursive
 * date+object+array+string with renderObjectLeaf / renderObjectNode, per-sentence
 * renderStringField, renderDateField (input type=date YYYY-MM-DD), array-of-objects
 * renderRecommendationsField, 4-level search, per-section approve, Copy row/Section/All,
 * pdfData memo, blue editing theme #2563eb).
 *
 * FIELDS (14 → 100% schema coverage):
 *   DATE(1):   date
 *   OBJECT(4): vitalSignTrends, clinicalTrends, renalTrends, results
 *   ARRAY(2):  laboratoryTrends, recommendations
 *   STRING(7): provider, facility, findings, assessment, plan, notes, status
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import TrendAnalysisDocumentPDFTemplate from '../pdf-templates/TrendAnalysisDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './TrendAnalysisDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { localValue, payload, track } } }
     localValue — value to merge into localEdits (root-field whole value or subfield scalar)
     payload    — the exact { field, value, [arrayIndex], [subField] } to PUT on approve
     track      — { editedFields?: key, editedSentences?: key } markers to repaint on rehydrate */
const DRAFT_KEY = 'trend_analysisPendingEdits';
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
  'general': 'General Information',
  'trends': 'Trends',
  'clinical': 'Clinical',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  laboratoryTrends: 'Laboratory Trends',
  vitalSignTrends: 'Vital Sign Trends',
  clinicalTrends: 'Clinical Trends',
  renalTrends: 'Renal Trends',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
  status: 'Status',
};

const SECTION_FIELDS = {
  'general': ['date', 'type', 'provider', 'facility', 'status'],
  'trends': ['laboratoryTrends', 'vitalSignTrends', 'clinicalTrends', 'renalTrends'],
  'clinical': ['findings', 'assessment', 'plan', 'results', 'recommendations'],
  'notes': ['notes'],
};

const SECTION_ORDER = ['general', 'trends', 'clinical', 'notes'];

const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
const ENUM_OPTIONS = { status: ['Completed', 'Active', 'Pending', 'Reviewed'] };
const NARRATIVE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const COMMA_PATHS = ['clinicalTrends.symptomProgression', 'clinicalTrends.medicationResponse', 'clinicalTrends.diseaseControl'];
/* DISPLAY/EDIT recursive object fields */
const OBJECT_FIELDS = ['vitalSignTrends', 'clinicalTrends', 'renalTrends', 'results'];
/* Array-of-objects {recommendation, date} (date-grouped) — date-grouped renderer */
const OBJECT_ARRAY_FIELDS = ['recommendations'];
/* Array-of-objects with multiple subfields → per-subfield editable rows (preserve object shape) */
const SUBFIELD_ARRAY_FIELDS = ['laboratoryTrends'];
const OBJECT_SUBFIELDS = {
  laboratoryTrends: [
    { key: 'test', label: 'Test' },
    { key: 'currentValue', label: 'Current Value' },
    { key: 'previousValue', label: 'Previous Value' },
    { key: 'trend', label: 'Trend' },
    { key: 'dateRange', label: 'Date Range' },
  ],
};
/* flatten an object-array item to a readable one-line string (Copy/PDF/search — no [object Object]) */
const formatObjectArrayItem = (item, fn) => {
  if (!item || typeof item !== 'object') return String(item ?? '');
  const defs = OBJECT_SUBFIELDS[fn];
  if (defs) return defs.filter(d => item[d.key] !== undefined && item[d.key] !== null && String(item[d.key]).trim() !== '').map(d => `${d.label}: ${item[d.key]}`).join(', ');
  return Object.entries(item).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([k, v]) => `${humanizeKey(k)}: ${v}`).join(', ');
};
const displaySubfieldValue = (key, value) => key === 'trend'
  ? String(value ?? '').replace(/^↓\s*/, 'Decreasing - ').replace(/^↑\s*/, 'Increasing - ').replace(/^→\s*/, 'Stable - ')
  : String(value ?? '');

const KEY_OVERRIDES = {
  bun: 'BUN', gfr: 'GFR', egfr: 'eGFR', creatinine: 'Creatinine', bp: 'BP', hr: 'HR',
  rr: 'RR', spo2: 'SpO2', wbc: 'WBC', rbc: 'RBC', hgb: 'Hgb', hct: 'Hct', plt: 'Plt',
  ckd: 'CKD', aki: 'AKI', ckmb: 'CK-MB', bnp: 'BNP', inr: 'INR', ptt: 'PTT',
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

const splitGuardedComma = (text) => {
  const source = String(text || '');
  const parts = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if ('([{'.includes(char)) { depth += 1; current += char; continue; }
    if (')]}'.includes(char)) { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char !== ',' || depth > 0) { current += char; continue; }
    const before = current.trim();
    const after = source.slice(index + 1);
    const trimmed = after.trimStart();
    const nextWord = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed))
      || after.length === trimmed.length
      || ['and', 'or', 'then'].includes(nextWord)
      || ['and', 'or'].includes(previousWord);
    if (protectedComma) current += char;
    else { if (before) parts.push(before); current = ''; }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : [source];
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
const enumCanonical = (field, current) => { const value = String(current ?? ''); return (ENUM_OPTIONS[field] || []).find(o => o.toLowerCase() === value.toLowerCase()) || value; };
const enumOptionsWith = (field, current) => { const base = ENUM_OPTIONS[field] || []; const value = String(current ?? '').trim(); return base.some(o => o.toLowerCase() === value.toLowerCase()) ? base : value ? [value, ...base] : base; };
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

/* ═══════ COMPONENT ═══════ */
const TrendAnalysisDocument = ({ document: docProp, data, templateData }) => {
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
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (r.trend_analysis) return Array.isArray(r.trend_analysis) ? r.trend_analysis : [r.trend_analysis];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.trend_analysis) return Array.isArray(dd.trend_analysis) ? dd.trend_analysis : [dd.trend_analysis]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Draft entries are stored idx-agnostic (keyBody = editKey minus the "-<idx>" suffix); reattach the
     current render idx. Each entry may carry: localValue (→ localEdits), payload (→ pendingEdits PUT),
     and track markers (editedFields / editedSentences). Leaf-root entries carry only the cumulative
     clone (localValue + payload:true); each leaf-payload entry carries its own dotted-path payload. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    let found = false;
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.values(recDrafts).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        if (entry.isLeafPayload) {
          // Leaf payload: live key is "<rootField>-<idx>-<leafPath>" (idx is mid-key). No localValue
          // here (the leaf-root clone entry carries it); this only restores pending + the edited marker.
          const leafKey = `${entry.rootField}-${idx}-${entry.leafPath}`;
          nPending[leafKey] = entry.payload; nFields[leafKey] = 'edited'; found = true;
          return;
        }
        const editKey = `${entry.keyBody}-${idx}`;
        if (entry.localValue !== undefined) { nLocal[editKey] = entry.localValue; found = true; }
        if (entry.payload !== undefined && entry.payload !== null) { nPending[editKey] = entry.payload; found = true; }
        if (entry.track?.editedFields) nFields[`${entry.track.editedFields}-${idx}`] = 'edited';
        if (entry.track?.editedSentences) nSentences[`${entry.track.editedSentences}-${idx}`] = entry.track.editedSentencesValue || 'edited';
        (entry.track?.editedSentencesExtra || []).forEach(body => { nSentences[`${body}-${idx}`] = 'added'; });
      });
    });
    if (!found) return;
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
    return text.split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    return recs.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ');
  }, []);

  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (SUBFIELD_ARRAY_FIELDS.includes(f)) return (Array.isArray(val) ? val : []).map(it => formatObjectArrayItem(it, f)).join(' ');
    if (OBJECT_ARRAY_FIELDS.includes(f)) return recsToText(val);
    if (OBJECT_FIELDS.includes(f)) return flattenSearchable(val);
    return fmtVal(val);
  }, [recsToText, fmtVal]);

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
      const rt = `trend analysis ${idx + 1}`.toLowerCase();
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
      // Object-subfield edit key shape: "field.arrayIndex.subField-idx"
      const sub = key.match(/^(.+)\.(\d+)\.(.+)-(\d+)$/);
      if (sub && parseInt(sub[4]) === idx) {
        const [, field, arrIdxStr, subField] = sub;
        const arrIdx = parseInt(arrIdxStr);
        const arr = Array.isArray(merged[field]) ? merged[field].map(it => (it && typeof it === 'object' ? { ...it } : it)) : [];
        if (arr[arrIdx] && typeof arr[arrIdx] === 'object') { arr[arrIdx][subField] = localEdits[key]; merged[field] = arr; }
        return;
      }
      const m = key.match(/^(.+)-(\d+)$/);
      if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key];
    });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  /* Stage an edit locally as a DRAFT (no DB write). Mirrors the gold reference: updates localEdits +
     pendingEdits + the edited markers, drops the section's approved flag (re-edit → yellow Pending
     Approve), and writes the pending-drafts localStorage store so the draft survives refresh.
     payload = exact { field, value, [arrayIndex], [subField] } to PUT on Approve.
     editKey = "<keyBody>-<idx>"; track repaints markers on rehydrate. */
  const stageDraft = useCallback((record, idx, sid, editKey, localValue, payload, track) => {
    const id = safeId(record); if (!id) return;
    const keyBody = editKey.slice(0, editKey.length - `-${idx}`.length);
    setLocalEdits(prev => ({ ...prev, [editKey]: localValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: payload }));
    if (track?.editedFields) setEditedFields(prev => ({ ...prev, [track.editedFields]: 'edited' }));
    if (track?.editedSentences) setEditedSentences(prev => ({ ...prev, [track.editedSentences]: track.editedSentencesValue || 'edited' }));
    if (track?.editedSentencesExtra) setEditedSentences(prev => { const n = { ...prev }; track.editedSentencesExtra.forEach(k => { n[k] = 'added'; }); return n; });
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Persist the draft (keyed by record id, idx-agnostic) so it survives refresh.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][editKey] = {
      keyBody,
      localValue,
      payload,
      track: {
        editedFields: track?.editedFields ? track.editedFields.slice(0, track.editedFields.length - `-${idx}`.length) : undefined,
        editedSentences: track?.editedSentences ? track.editedSentences.slice(0, track.editedSentences.length - `-${idx}`.length) : undefined,
        editedSentencesValue: track?.editedSentencesValue,
        editedSentencesExtra: (track?.editedSentencesExtra || []).map(k => k.slice(0, k.length - `-${idx}`.length)),
      },
    };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    // Stage as a DRAFT (no DB write). Approve commits { field: fn, value } to MongoDB.
    stageDraft(record, idx, sid, `${fn}-${idx}`, saveVal, { field: fn, value: saveVal }, { editedFields: trackKey });
  }, [editValue, safeId, stageDraft]);

  /* save a nested OBJECT leaf by dot-path (e.g. results.bun) */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`; // dotted path, last seg is a KEY (not numeric) → NO arrayIndex
    setSaveError(null);
    // localEdits keeps the whole object clone under "<rootField>-<idx>" (so getFieldValue renders the leaf),
    // but the DRAFT/pending payload is keyed PER LEAF so multiple leaf edits each commit their own dotted path.
    const cur = (localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField]);
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;

    setLocalEdits(prev => ({ ...prev, [`${rootField}-${idx}`]: clone }));
    setPendingEdits(prev => ({ ...prev, [`${rootField}-${idx}`]: true, [leafKeyTrack]: { field: dottedField, value: newVal } }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Persist draft: the cumulative clone (root key, render-only) + the per-leaf payload. leafPath lets
    // rehydrate rebuild the leaf's live key "<rootField>-<idx>-<path>" (idx is MID-key here, not a suffix).
    const leafPath = path.join('.');
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${rootField}-${idx}`] = { keyBody: rootField, localValue: clone, payload: true, isLeafRoot: true };
    store[id][leafKeyTrack] = { isLeafPayload: true, rootField, leafPath, payload: { field: dottedField, value: newVal } };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, localEdits]);

  /* save an object-array item's subfield (preserves {test, currentValue, ...} shape) */
  const saveObjectSubField = useCallback((record, fn, idx, sid, arrayIndex, subField, newVal) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const editKey = `${fn}.${arrayIndex}.${subField}-${idx}`;
    // Stage the exact dotted path so the audit and backend both verify the leaf that will persist.
    stageDraft(record, idx, sid, editKey, newVal, { field: `${fn}.${arrayIndex}.${subField}`, value: newVal }, { editedFields: editKey });
  }, [safeId, stageDraft]);

  const saveRecommendationDates = useCallback((record, fn, idx, sid, indexes, newDate) => {
    const id = safeId(record); if (!id) return;
    const current = getFieldValue(record, fn, idx);
    const clone = (Array.isArray(current) ? current : []).map((item) => ({ ...item }));
    indexes.forEach((itemIndex) => { if (clone[itemIndex]) clone[itemIndex].date = newDate; });
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: clone }));
    setPendingEdits(prev => {
      const next = { ...prev, [`${fn}-${idx}`]: true };
      indexes.forEach((itemIndex) => { next[`${fn}-${idx}-${itemIndex}.date`] = { field: `${fn}.${itemIndex}.date`, value: newDate }; });
      return next;
    });
    setEditedFields(prev => { const next = { ...prev }; indexes.forEach((itemIndex) => { next[`${fn}-${idx}-${itemIndex}.date`] = 'edited'; }); return next; });
    setApprovedSections(prev => { const next = { ...prev }; delete next[`${sid}-${idx}`]; return next; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}-${idx}`] = { keyBody: fn, localValue: clone, payload: true, isLeafRoot: true };
    indexes.forEach((itemIndex) => {
      store[id][`${fn}-${idx}-${itemIndex}.date`] = { isLeafPayload: true, rootField: fn, leafPath: `${itemIndex}.date`, payload: { field: `${fn}.${itemIndex}.date`, value: newDate } };
    });
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId, getFieldValue]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = fn === 'findings' ? splitBySentence(currentVal).flatMap(splitGuardedComma) : splitBySentence(currentVal);
    let prefix = '';
    if (fn === 'findings') {
      let remainder = sentences[sentenceIdx] || '';
      if (sentenceIdx === 0) {
        const overall = remainder.match(/^([^:]+):\s+(.+)$/);
        if (overall) { prefix += `${overall[1]}: `; remainder = overall[2]; }
      }
      const phase = remainder.match(/^([^:]+):\s+(.+)$/);
      if (phase) prefix += `${phase[1]}: `;
    }
    const editedVal = prefix + editValue.trim();
    const joinDelimiter = fn === 'findings' ? ', ' : currentVal.includes('; ') ? '; ' : '. ';
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = updated.join(joinDelimiter);
      setSaveError(null);
      // Stage as a DRAFT (no DB write). Approve commits { field: fn, value: fullText }.
      stageDraft(record, idx, sid, `${fn}-${idx}`, fullText, { field: fn, value: fullText }, { editedSentences: `${fn}-${idx}-s${sentenceIdx}` });
      return;
    }
    const newSentences = fn === 'findings' ? splitBySentence(editedVal).flatMap(splitGuardedComma) : splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = updated.join(joinDelimiter);
    const extraBodies = [];
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) extraBodies.push(`${fn}-s${sentenceIdx + 1 + ei}`);
    setSaveError(null);
    // Stage as a DRAFT (no DB write). Approve commits { field: fn, value: fullText }.
    stageDraft(record, idx, sid, `${fn}-${idx}`, fullText, { field: fn, value: fullText }, {
      editedSentences: `${fn}-${idx}-s${sentenceIdx}`,
      editedSentencesExtra: extraBodies.map(b => `${b}-${idx}`),
    });
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const matches = (k, f) => k.startsWith(`${f}-${idx}`) || new RegExp(`^${f}\\.\\d+\\..+-${idx}$`).test(k);
    return fields.some(f =>
      Object.keys(editedFields).some(k => matches(k, f)) ||
      Object.keys(editedSentences).some(k => matches(k, f))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  // Drives off the localStorage draft store (keyed by record id) so it handles every save shape:
  // single field, dotted leaf path (field.subkey — NO arrayIndex, last seg is a key), object-subfield
  // (field + arrayIndex + subField), per-sentence/per-rec full-text. A draft entry is committed when it
  // carries an object payload; the leaf-root clone entry (payload === true) is a render-only aggregate.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // Root field a draft entry targets — payload.field's part before the FIRST dot (dotted leaf paths
    // like "results.bun" → root "results"); fall back to the keyBody's leading field token.
    const entryRoot = (entry) => {
      if (entry.payload && typeof entry.payload === 'object' && entry.payload.field) return String(entry.payload.field).split('.')[0];
      return String(entry.keyBody || '').split('.')[0].split('-')[0];
    };
    setSaving(true); setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // store keys are the live editKeys (already idx-suffixed for this record's current render).
      const sectionKeys = Object.keys(recDrafts).filter(k => fields.includes(entryRoot(recDrafts[k])));
      // PUT each committable payload (skip the leaf-root render-only aggregate).
      for (const k of sectionKeys) {
        const entry = recDrafts[k];
        if (!entry || !entry.payload || entry.payload === true) continue;
        const resp = await secureApiClient.put(`/api/edit/trend_analysis/${id}/edit`, entry.payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/trend_analysis/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; sectionKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      sectionKeys.forEach(k => delete recDrafts[k]);
      if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const matches = (k, f) => k.startsWith(`${f}-${idx}`) || new RegExp(`^${f}\\.\\d+\\..+-${idx}$`).test(k);
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (matches(k, f)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (matches(k, f)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[TrendAnalysis] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
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

  /* object → copy lines (recursive) */
  const objectCopyLines = useCallback((label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) {
      if (label) out.push(`${pad}${label}`, `${pad}${'-'.repeat(40)}`);
      const rows = ['Symptom Progression', 'Medication Response', 'Disease Control'].includes(label) ? splitGuardedComma(fmtScalar(value)) : [fmtScalar(value)];
      rows.forEach((row, index) => out.push(`${pad}${index + 1}. ${row}`));
      return out;
    }
    if (label) out.push(`${pad}${label}`, `${pad}${'-'.repeat(40)}`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid, approvedOnly = false) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const val = approvedOnly ? record[f] : getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (SUBFIELD_ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [];
        if (!sameAsTitle) text += `${label}\n${'-'.repeat(40)}\n`;
        items.forEach((it, i) => {
          text += `Laboratory Trend ${i + 1}\n${'-'.repeat(40)}\n`;
          (OBJECT_SUBFIELDS[f] || []).forEach(({ key, label: subLabel }) => {
            if (!hasVal(it?.[key])) return;
            text += `${subLabel}\n${'-'.repeat(40)}\n1. ${displaySubfieldValue(key, it[key])}\n`;
          });
        });
        text += '\n';
      } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val : [];
        if (!sameAsTitle) text += `${label}\n${'-'.repeat(40)}\n`;
        let lastDate = null; let n = 1;
        recs.forEach((r) => {
          const rec = (r?.recommendation || '').trim();
          const date = (r?.date || '').trim();
          if (date !== lastDate) { if (date) text += `Recommendation Date\n${'-'.repeat(40)}\n1. ${formatDate(date)}\n`; lastDate = date; n = 1; }
          text += `${n++}. ${rec}\n`;
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n${'-'.repeat(40)}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else if (DATE_FIELDS.includes(f)) {
        text += sameAsTitle ? `1. ${formatDate(val)}\n\n` : `${label}\n${'-'.repeat(40)}\n1. ${formatDate(val)}\n\n`;
      } else {
        const strVal = ENUM_OPTIONS[f] ? enumCanonical(f, val) : fmtVal(val);
        const sentences = f === 'findings' ? splitBySentence(strVal).flatMap(splitGuardedComma) : splitBySentence(strVal);
        const embeddedLabel = f === 'findings' ? sentences[0]?.match(/^([^:]+):\s+(.+)$/)?.[1] : '';
        if (sentences.length > 1) {
          if (!sameAsTitle) text += `${label}\n${'-'.repeat(40)}\n`;
          if (embeddedLabel) text += `${embeddedLabel}\n${'-'.repeat(40)}\n`;
          sentences.forEach((s, i) => {
            const withoutOverall = f === 'findings' && i === 0 ? s.replace(/^[^:]+:\s+/, '') : s;
            const phase = f === 'findings' ? withoutOverall.match(/^([^:]+):\s+(.+)$/) : null;
            if (phase) text += `${phase[1]}\n${'-'.repeat(40)}\n`;
            text += `${i + 1}. ${phase?.[2] || withoutOverall}\n`;
          });
          text += '\n';
        } else {
          text += sameAsTitle ? `1. ${strVal}\n\n` : `${label}\n${'-'.repeat(40)}\n1. ${strVal}\n\n`;
        }
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== TREND ANALYSIS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Trend Analysis ${idx + 1}\n${'='.repeat(40)}\n\n`;
      SECTION_ORDER.forEach(sid => {
        if ((SECTION_FIELDS[sid] || []).some((field) => hasVal(r[field]))) text += buildSectionCopyText(r, idx, sid, true);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText, hasVal]);

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
      <div key={fn} className="rec-mini-card nested-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={setEditValue} />
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
        </div></div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD (per-sentence) ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = fn === 'findings' ? splitBySentence(strVal).flatMap(splitGuardedComma) : splitBySentence(strVal);
    const embeddedLabel = fn === 'findings' ? sentences[0]?.match(/^([^:]+):\s+(.+)$/)?.[1] : '';
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
      return (
        <div key={fn} className="rec-mini-card nested-mini-card">
          {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {embeddedLabel && <div className="nested-subtitle sub-label">{highlightText(embeddedLabel)}</div>}
          {sentences.map((sentence, sIdx) => {
            const shownSentence = fn === 'findings' && sIdx === 0 ? sentence.replace(/^[^:]+:\s+/, '') : sentence;
            const phaseMatch = fn === 'findings' ? shownSentence.match(/^([^:]+):\s+(.+)$/) : null;
            const rowText = phaseMatch?.[2] || shownSentence;
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            return (
              <div key={sIdx} className={phaseMatch ? 'nested-mini-card' : ''}>
                {phaseMatch && <div className="nested-subtitle sub-label">{highlightText(phaseMatch[1])}</div>}
              <div data-edit-field={fn}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(rowText.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
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
                      <div className="row-content"><span className="content-value">{highlightText(rowText)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(rowText, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div></div>
            );
          })}
        </div>
      );
    }

    /* Single-value string */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(ENUM_OPTIONS[fn] ? enumCanonical(fn, strVal) : strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {ENUM_OPTIONS[fn] ? <BlueSelect value={editValue} options={enumOptionsWith(fn, strVal)} onChange={setEditValue} />
                : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSaveField(record, fn, idx, sid); } }} />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(ENUM_OPTIONS[fn] ? enumCanonical(fn, strVal) : strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${ENUM_OPTIONS[fn] ? enumCanonical(fn, strVal) : strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div></div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; bool -> Yes/No, number+unit -> number input, text -> textarea, "4/5" stays text) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const dottedPath = `${rootField}.${path.join('.')}`;
    const lastPathPart = String(path[path.length - 1]);
    const leafLabel = /^\d+$/.test(lastPathPart) ? `Item ${Number(lastPathPart) + 1}` : humanizeKey(lastPathPart);
    const parts = COMMA_PATHS.includes(dottedPath) ? splitGuardedComma(leafValueString) : [leafValueString];
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(leafLabel)}</div>
        {parts.map((part, partIndex) => {
          const leafKey = `${rootField}-${idx}-${path.join('.')}${parts.length > 1 ? `-part-${partIndex}` : ''}`;
          const isEditing = editingField === leafKey;
          const isModified = editedFields[leafKey];
          const isBool = typeof value === 'boolean' && parts.length === 1;
          const isDateLeaf = parts.length === 1 && /date/i.test(path[path.length - 1]) && /^\d{4}-\d{2}-\d{2}$/.test(part);
          const ratio = (isBool || isDateLeaf || parts.length > 1) ? null : splitRatio(part);
          const nu = (isBool || isDateLeaf || ratio || parts.length > 1) ? null : splitNumberUnit(part);
          const numeric = typeof value === 'number' || Boolean(ratio || nu);
          const editStartValue = isBool ? (value ? 'Yes' : 'No') : isDateLeaf ? part : ratio ? ratio.num : nu ? nu.num : part;
          return <div key={partIndex} data-edit-field={dottedPath}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
              ) : isDateLeaf ? <BlueDatePicker value={editValue} onSelect={setEditValue} />
                : numeric ? (
                <div className="number-edit-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String(Number((Number(editValue || 0) - (String(editValue).includes('.') ? 0.1 : 1)).toFixed(String(editValue).includes('.') ? 1 : 0)))); }}>−</button>
                  <input inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String(Number((Number(editValue || 0) + (String(editValue).includes('.') ? 0.1 : 1)).toFixed(String(editValue).includes('.') ? 1 : 0)))); }}>+</button>
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
                  } else if (isDateLeaf) {
                    if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; }
                    newVal = editValue;
                  } else if (ratio) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = `${n}/${ratio.denom}`;
                  } else if (nu) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = typeof value === 'number' ? n : nu.unit ? `${n}${nu.sep}${nu.unit}` : String(n);
                  } else {
                    newVal = editValue.trim();
                  }
                  const nextLeaf = parts.length > 1 ? parts.map((entry, entryIndex) => entryIndex === partIndex ? newVal : entry).join(', ') : newVal;
                  saveLeaf(record, rootField, path, idx, sid, leafKey, nextLeaf);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${leafLabel}\n${part}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
          </div>;
        })}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
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

  /* ═══════ RENDER: ARRAY-OF-OBJECTS per-subfield (preserves {test, currentValue, ...} shape on save) ═══════ */
  const renderSubFieldArray = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const arr = Array.isArray(val) ? val : [];
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phrase = searchTerm.toLowerCase().trim();
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(phrase);
    const subDefs = OBJECT_SUBFIELDS[fn] || [];
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, oi) => {
          if (!item || typeof item !== 'object') return null;
          const visibleSubs = subDefs.filter(sf => {
            const sfVal = localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key];
            return sfVal !== undefined && sfVal !== null && String(sfVal).trim() !== '';
          });
          if (visibleSubs.length === 0) return null;
          if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !labelMatch) {
            const anyMatch = visibleSubs.some(sf => String(localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key]).toLowerCase().includes(phrase));
            if (!anyMatch) return null;
          }
          const itemTitle = `Laboratory Trend ${oi + 1}`;
          return (
            <div key={oi} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(String(itemTitle))}</div>
              {visibleSubs.map(sf => {
                const sfVal = localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key];
                const sfEditKey = `${fn}.${oi}.${sf.key}-${idx}`;
                const isEditing = editingField === sfEditKey;
                const badge = editedFields[sfEditKey];
                const dateValue = sf.key === 'dateRange' && /^\d{4}-\d{2}-\d{2}$/.test(String(sfVal));
                const measure = ['currentValue', 'previousValue'].includes(sf.key) ? splitNumberUnit(sfVal) : null;
                return (
                  <div key={sf.key} className="nested-mini-card" data-edit-field={`${fn}.${oi}.${sf.key}`}>
                    <div className="nested-subtitle sub-label">{sf.label}</div>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(null); setEditingField(sfEditKey); setEditValue(dateValue ? String(sfVal) : measure ? measure.num : String(sfVal)); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          {dateValue ? <BlueDatePicker value={editValue} onSelect={setEditValue} />
                            : measure ? <div className="number-edit-row">
                              <button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String(Number((Number(editValue || 0) - (String(editValue).includes('.') ? 0.1 : 1)).toFixed(String(editValue).includes('.') ? 1 : 0)))); }}>−</button>
                              <input inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} />
                              {measure.unit && <span className="number-edit-unit">{measure.unit}</span>}
                              <button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String(Number((Number(editValue || 0) + (String(editValue).includes('.') ? 0.1 : 1)).toFixed(String(editValue).includes('.') ? 1 : 0)))); }}>+</button>
                            </div>
                              : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setSaveError(null); setEditingField(null); setEditValue(''); } }} />}
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              let nextValue = editValue.trim();
                              if (measure) { const n = Number(nextValue); if (Number.isNaN(n)) { setSaveError('Please enter a valid number'); return; } nextValue = `${n}${measure.sep}${measure.unit}`; }
                              if (dateValue && Number.isNaN(new Date(nextValue).getTime())) { setSaveError('Please enter a valid date'); return; }
                              saveObjectSubField(record, fn, idx, sid, oi, sf.key, nextValue);
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setSaveError(null); setEditingField(null); setEditValue(''); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(displaySubfieldValue(sf.key, sfVal))}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[sfEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}\n${displaySubfieldValue(sf.key, sfVal)}`, sfEditKey); }}>{copiedItems[sfEditKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: ARRAY of {recommendation, date}, date-grouped ═══════ */
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
            <div key={gIdx} className="rec-mini-card nested-mini-card recommendation-group" style={{ marginTop: 8 }}>
              {group.date && (() => {
                const dateKey = `${fn}-${idx}-date-${gIdx}`;
                const isDateEditing = editingField === dateKey;
                const datePaths = group.items.map(({ rIdx }) => `${fn}.${rIdx}.date`);
                return <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
                  <div className="date-subtitle nested-subtitle editable-row" onClick={() => { if (!isDateEditing) { setEditingField(dateKey); setEditValue(group.date); setSaveError(null); } }}>
                    {isDateEditing ? <div className="edit-field-container">
                      <BlueDatePicker value={editValue} onSelect={setEditValue} />
                      <div className="edit-actions">
                        <button className="save-btn" onClick={e => { e.stopPropagation(); if (Number.isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } saveRecommendationDates(record, fn, idx, sid, group.items.map(({ rIdx }) => rIdx), editValue); }}>Save</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div> : <><span className="content-value">{highlightText(formatDate(group.date))}</span><span className="edit-indicator">&#9998;</span></>}
                  </div>
                </div>;
              })()}
              {group.items.map(({ rec, rIdx }) => {
                const recText = (rec?.recommendation || '').trim();
                const recDate = (rec?.date || '').trim();
                const itemKey = `${fn}-${idx}-r${rIdx}`;
                const isEditing = editingField === itemKey;
                const recommendationLeafKey = `${fn}-${idx}-${rIdx}.recommendation`;
                const badge = editedSentences[itemKey] || editedFields[recommendationLeafKey];
                const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || recText.toLowerCase().includes(phrase) || recDate.toLowerCase().includes(phrase);
                if (!itemMatches && searchTerm.trim()) return null;
                return (
                  <div key={rIdx} data-edit-field={`${fn}.${rIdx}.recommendation`}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              const trimmed = editValue.trim();
                              setSaveError(null);
                              saveLeaf(record, fn, [rIdx, 'recommendation'], idx, sid, recommendationLeafKey, trimmed);
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (SUBFIELD_ARRAY_FIELDS.includes(f)) return renderSubFieldArray(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="trend-analysis-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Trend Analysis</h2></div>
        <div className="empty-state">No trend analysis records available</div>
      </div>
    );
  }

  return (
    <div className="trend-analysis-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Trend Analysis</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<TrendAnalysisDocumentPDFTemplate document={pdfData} />} fileName="Trend_Analysis.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search trend analysis records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Trend Analysis ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrendAnalysisDocument;
