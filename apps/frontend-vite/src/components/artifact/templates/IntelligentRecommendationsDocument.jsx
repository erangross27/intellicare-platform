/**
 * IntelligentRecommendationsDocument.jsx
 * June 2026 — Collection: intelligent_recommendations (REBUILT from schema)
 *
 * Donor cloned: PointOfCareUltrasoundHeartRateDocument (generic date + object + array + string
 * with recursive renderObjectLeaf / renderObjectNode, DATE renderDateField, 4-level search,
 * per-section approve, Copy row / Section / All, blue-glow editing theme).
 *
 * FIELDS (15 → 100% schema coverage):
 *   DATE(1):        date (header)
 *   OBJECT(1):      results
 *   ARRAY(5):       immediate, shortTerm, longTerm, preventive, psychoBehavioralSupport  (string arrays)
 *   OBJECT-ARRAY(1): recommendations  (array of {recommendation/title, category/type, priority, description,
 *                    rationale/reasoning, expectedBenefit, implementationSteps[], timeframe, evidenceLevel};
 *                    per-SUBFIELD editable rows save via arrayIndex+subField — preserves object shape)
 *   STRING(7):      provider, facility, findings, assessment, plan, notes, status
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import IntelligentRecommendationsDocumentPDFTemplate from '../pdf-templates/IntelligentRecommendationsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './IntelligentRecommendationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }
   fieldPart = the localEdits editKey minus its trailing "-<idx>" (e.g. "findings",
   "immediate" (array value), "results" (object value), or "recommendations.2.priority"). */
const DRAFT_KEY = 'intelligent_recommendationsPendingEdits';
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
  'recommendations-by-timeframe': 'Recommendations by Timeframe',
  'clinical': 'Clinical',
  'notes-status': 'Notes & Status',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  immediate: 'Immediate',
  shortTerm: 'Short Term',
  longTerm: 'Long Term',
  preventive: 'Preventive',
  psychoBehavioralSupport: 'Psycho-Behavioral Support',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
  status: 'Status',
};

const SECTION_FIELDS = {
  'recommendations-by-timeframe': ['immediate', 'shortTerm', 'longTerm', 'preventive', 'psychoBehavioralSupport'],
  'clinical': ['findings', 'assessment', 'plan', 'results', 'recommendations'],
  'notes-status': ['notes', 'status'],
};

const SECTION_ORDER = ['recommendations-by-timeframe', 'clinical', 'notes-status'];

const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
/* DISPLAY/EDIT recursive object field */
const OBJECT_FIELDS = ['results'];
/* Plain string arrays (per-item editable) */
const ARRAY_FIELDS = ['immediate', 'shortTerm', 'longTerm', 'preventive', 'psychoBehavioralSupport'];
/* Array-of-objects: AI recommendations {recommendation/title, category/type, priority, description,
   rationale/reasoning, expectedBenefit, implementationSteps[], timeframe, evidenceLevel}.
   Rendered as per-SUBFIELD editable rows that PRESERVE object shape via arrayIndex+subField. */
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const OBJECT_SUBFIELDS = {
  recommendations: [
    { key: 'recommendation', label: 'Recommendation' },
    { key: 'title', label: 'Title' },
    { key: 'category', label: 'Category' },
    { key: 'type', label: 'Type' },
    { key: 'priority', label: 'Priority' },
    { key: 'description', label: 'Description' },
    { key: 'rationale', label: 'Rationale' },
    { key: 'reasoning', label: 'Reasoning' },
    { key: 'expectedBenefit', label: 'Expected Benefit' },
    { key: 'implementationSteps', label: 'Implementation Steps' },
    { key: 'timeframe', label: 'Timeframe' },
    { key: 'evidenceLevel', label: 'Evidence Level' },
  ],
};

const KEY_OVERRIDES = {};
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

/* ═══════ COMPONENT ═══════ */
const IntelligentRecommendationsDocument = ({ document: docProp, data, templateData }) => {
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
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (r.intelligent_recommendations) return Array.isArray(r.intelligent_recommendations) ? r.intelligent_recommendations : [r.intelligent_recommendations];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.intelligent_recommendations) return Array.isArray(dd.intelligent_recommendations) ? dd.intelligent_recommendations : [dd.intelligent_recommendations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
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
        // Mark edited so the section-level "Pending Approve" button shows (matchKey in sectionHasEdits).
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => !isEmptyDeep(v), []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

  const arrayToText = useCallback((arr) => {
    if (!Array.isArray(arr)) return '';
    return arr.map(item => isScalar(item) ? fmtScalar(item) : flattenSearchable(item)).join(' ');
  }, []);

  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (OBJECT_ARRAY_FIELDS.includes(f)) return arrayToText(val);
    if (ARRAY_FIELDS.includes(f)) return arrayToText(val);
    if (OBJECT_FIELDS.includes(f)) return flattenSearchable(val);
    return fmtVal(val);
  }, [arrayToText, fmtVal]);

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
      const rt = `intelligent recommendations ${idx + 1}`.toLowerCase();
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
      /* Object-array subfield edit key shape: "field.arrayIndex.subField-idx" */
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

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  /* save ONE subfield of an object-array item — PRESERVES object shape via arrayIndex+subField */
  const handleSaveObjectSubField = useCallback((record, fn, idx, sid, arrayIndex, subField) => {
    const id = safeId(record); if (!id) return;
    const saveVal = editValue.trim();
    const fieldPart = `${fn}.${arrayIndex}.${subField}`;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  /* save a nested OBJECT leaf by dot-path (e.g. results.score) */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${rootField}-${idx}`;
    let cloneOut;
    setLocalEdits(prev => {
      const cur = prev[editKey] !== undefined ? prev[editKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      cloneOut = clone;
      return { ...prev, [editKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Stage the whole updated object as a draft; Approve PUTs { field: rootField, value: object }.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    if (cloneOut !== undefined) store[id][rootField] = cloneOut;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const editKey = `${fn}-${idx}`;
    const stage = (fullText) => {
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
      setEditingField(null); setEditValue(''); setSaveError(null);
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      stage(fullText);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    stage(fullText);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    /* object-array subfield keys are "field.arrayIndex.subField-idx" → match by suffix "-idx" + field prefix */
    const matchKey = (f, k) => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`));
    return fields.some(f =>
      Object.keys(editedFields).some(k => matchKey(f, k)) ||
      Object.keys(editedSentences).some(k => matchKey(f, k))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Pending editKeys for THIS section: base field is the part before the first "." (or whole), and the
    // key must end with "-idx". (Subfield keys "field.oi.sub-idx" and dotted keys still resolve to `field`.)
    const baseField = (fieldPart) => { const d = fieldPart.indexOf('.'); return d === -1 ? fieldPart : fieldPart.slice(0, d); };
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      return fields.includes(baseField(fieldPart));
    });
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        // Object-array subfield: "field.arrayIndex.subField"
        const sub = fieldPart.match(/^(.+)\.(\d+)\.(.+)$/);
        let payload;
        if (sub) {
          payload = { field: sub[1], value: localEdits[editKey], arrayIndex: parseInt(sub[2], 10), subField: sub[3] };
        } else {
          // Treat a trailing ".<n>" as arrayIndex ONLY when the LAST dot-segment is purely numeric.
          const lastDot = fieldPart.lastIndexOf('.');
          const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
          if (lastDot !== -1 && /^\d+$/.test(tail)) {
            payload = { field: fieldPart.slice(0, lastDot), value: localEdits[editKey], arrayIndex: parseInt(tail, 10) };
          } else {
            // Plain field (value may be string/array/object — e.g. results object, immediate array)
            payload = { field: fieldPart, value: localEdits[editKey] };
          }
        }
        const resp = await secureApiClient.put(`/api/edit/intelligent_recommendations/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/intelligent_recommendations/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => { const fp = editKey.slice(0, -suffix.length); delete store[id][fp]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const matchKey = (f, k) => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (matchKey(f, k)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (matchKey(f, k)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[IntelligentRecommendations] Approve error:', err); }
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
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
        if (!sameAsTitle) text += `${label}\n`;
        const subDefs = OBJECT_SUBFIELDS[f] || [];
        items.forEach((item, i) => {
          if (isScalar(item)) { text += `${i + 1}. ${fmtScalar(item)}\n`; return; }
          text += `${i + 1}.\n`;
          subDefs.forEach(sf => { const sv = item[sf.key]; if (!isEmptyDeep(sv)) text += `   ${sf.label}: ${isScalar(sv) ? fmtScalar(sv) : flattenSearchable(sv)}\n`; });
        });
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
        if (!sameAsTitle) text += `${label}\n`;
        items.forEach((item, i) => { text += `${i + 1}. ${isScalar(item) ? fmtScalar(item) : flattenSearchable(item)}\n`; });
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
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== INTELLIGENT RECOMMENDATIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Intelligent Recommendations ${idx + 1}\n${'='.repeat(40)}\n\n`;
      SECTION_ORDER.forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
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

  /* ═══════ RENDER: STRING FIELD (per-sentence) ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
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

    /* Single-value string */
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

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, text -> textarea, "4/5" stays text) ═══════ */
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

  /* ═══════ RENDER: OBJECT-ARRAY FIELD — array of {recommendation, priority, ...} ═══════
     Per-SUBFIELD editable rows that PRESERVE object shape (save via arrayIndex+subField).
     Array-typed subfields (implementationSteps) are flattened READ-ONLY (no string corruption). */
  const renderObjectArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const arr = Array.isArray(val) ? val : (hasVal(val) ? [val] : []);
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();
    const subDefs = OBJECT_SUBFIELDS[fn] || [];

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, oi) => {
          /* Plain-string item (mixed-shape data): single editable row preserving the array slot. */
          if (isScalar(item)) {
            if (isEmptyDeep(item)) return null;
            const itemStr = fmtScalar(item);
            const objKey = `${fn}-${idx}-o${oi}`;
            const isEditing = editingField === objKey;
            const badge = editedFields[objKey];
            const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || itemStr.toLowerCase().includes(phrase);
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={oi}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(objKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => {
                          e.stopPropagation();
                          const id2 = safeId(record); if (!id2) return;
                          const trimmed = editValue.trim();
                          const cur = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : [];
                          cur[oi] = trimmed;
                          const editKey = `${fn}-${idx}`;
                          setLocalEdits(prev => ({ ...prev, [editKey]: cur }));
                          setPendingEdits(prev => ({ ...prev, [editKey]: true }));
                          setEditedFields(prev => ({ ...prev, [objKey]: 'edited' }));
                          setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                          const store = readDrafts();
                          if (!store[id2]) store[id2] = {};
                          store[id2][fn] = cur;
                          writeDrafts(store);
                          setEditingField(null); setEditValue(''); setSaveError(null);
                        }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[objKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, objKey); }}>{copiedItems[objKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          }
          /* Object item: per-subfield editable rows preserving {recommendation, priority, ...} shape. */
          const visibleSubs = subDefs.filter(sf => {
            const sv = localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key];
            return !isEmptyDeep(sv);
          });
          if (visibleSubs.length === 0) return null;
          if (searchTerm.trim() && !phraseMatch && !labelMatch) {
            const anyMatch = visibleSubs.some(sf => flattenSearchable(localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key]).toLowerCase().includes(phrase));
            if (!anyMatch) return null;
          }
          return (
            <div key={oi} className="nested-mini-card">
              <div className="nested-subtitle">{highlightText(`${label.replace(/s$/, '')} ${oi + 1}`)}</div>
              {visibleSubs.map(sf => {
                const rawVal = localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key];
                const isArrSub = Array.isArray(rawVal);
                const sfDisplay = isScalar(rawVal) ? fmtScalar(rawVal) : flattenSearchable(rawVal);
                const sfEditKey = `${fn}.${oi}.${sf.key}-${idx}`;
                const isEditing = editingField === sfEditKey;
                const badge = editedFields[sfEditKey];
                return (
                  <div key={sf.key}>
                    <div className="nested-subtitle sub-label">{highlightText(sf.label)}</div>
                    {isArrSub ? (
                      /* Array-typed subfield (e.g. implementationSteps) — read-only flattened to avoid string corruption */
                      <div className="numbered-row">
                        <div className="row-content"><span className="content-value">{highlightText(rawVal.filter(x => !isEmptyDeep(x)).map(fmtScalar).join('; '))}</span></div>
                        <button className={`copy-btn ${copiedItems[sfEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${rawVal.filter(x => !isEmptyDeep(x)).map(fmtScalar).join('; ')}`, sfEditKey); }}>{copiedItems[sfEditKey] ? 'Copied!' : 'Copy'}</button>
                      </div>
                    ) : (
                      <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sfEditKey); setEditValue(sfDisplay); setSaveError(null); } }}>
                        {isEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSaveObjectSubField(record, fn, idx, sid, oi, sf.key); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveObjectSubField(record, fn, idx, sid, oi, sf.key); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(sfDisplay)}</span><span className="edit-indicator">&#9998;</span></div>
                            <button className={`copy-btn ${copiedItems[sfEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${sfDisplay}`, sfEditKey); }}>{copiedItems[sfEditKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                    )}
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

  /* ═══════ RENDER: ARRAY FIELD — array of strings, per-item editable ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val : [];
    const visibleItems = items.map((item, i) => ({ item, i })).filter(({ item }) => !isEmptyDeep(item));
    if (visibleItems.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {visibleItems.map(({ item, i: aIdx }) => {
          const itemText = isScalar(item) ? fmtScalar(item) : flattenSearchable(item);
          const itemKey = `${fn}-${idx}-a${aIdx}`;
          const isEditing = editingField === itemKey;
          const badge = editedSentences[itemKey];
          const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || itemText.toLowerCase().includes(phrase);
          if (!itemMatches && searchTerm.trim()) return null;
          return (
            <div key={aIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(itemText); setSaveError(null); } }}>
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
                        const newArr = currentArr.map((it, i) => i === aIdx ? trimmed : it);
                        const editKey = `${fn}-${idx}`;
                        setLocalEdits(prev => ({ ...prev, [editKey]: newArr }));
                        setPendingEdits(prev => ({ ...prev, [editKey]: true }));
                        setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
                        setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                        const store = readDrafts();
                        if (!store[id2]) store[id2] = {};
                        store[id2][fn] = newArr;
                        writeDrafts(store);
                        setEditingField(null); setEditValue(''); setSaveError(null);
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemText)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemText, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderObjectArrayField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
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
      <div className="intelligent-recommendations-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Intelligent Recommendations</h2></div>
        <div className="empty-state">No intelligent recommendations records available</div>
      </div>
    );
  }

  return (
    <div className="intelligent-recommendations-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Intelligent Recommendations</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<IntelligentRecommendationsDocumentPDFTemplate document={pdfData} />} fileName={`intelligent-recommendations-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search intelligent recommendations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
              <h3 className="record-name">{highlightText(`Intelligent Recommendations ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntelligentRecommendationsDocument;
