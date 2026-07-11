/**
 * TreatmentSummaryDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: treatment_summary
 *
 * 6 Sections:
 *   1. general-info: date, type, provider, facility, status
 *   2. primary-diagnosis: primaryDiagnosis.site, primaryDiagnosis.histology, primaryDiagnosis.dateOfDiagnosis, primaryDiagnosis.stageAtDiagnosis
 *   3. treatment-timeline: treatmentTimeline (array of objects)
 *   4. treatment-status: currentTreatmentStatus, diseaseStatus
 *   5. clinical-notes: findings, assessment, plan, notes
 *   6. recommendations: recommendations (array)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TreatmentSummaryDocumentPDFTemplate from '../pdf-templates/TreatmentSummaryDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './TreatmentSummaryDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { field, value } } }
   editKey = the file's localEdits key (e.g. "type-0", "primaryDiagnosis.site-0",
   "treatmentTimeline.1.response-0", "recommendations.2-0"); field = the exact DB field path the
   old save would have PUT; value = the staged value. */
const DRAFT_KEY = 'treatmentSummaryPendingEdits';
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
  'general-info': 'General Information',
  'primary-diagnosis': 'Primary Diagnosis',
  'treatment-timeline': 'Treatment Timeline',
  'treatment-status': 'Treatment Status',
  'clinical-notes': 'Clinical Notes',
  'results-section': 'Results',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'primaryDiagnosis.site': 'Site',
  'primaryDiagnosis.histology': 'Histology',
  'primaryDiagnosis.dateOfDiagnosis': 'Date of Diagnosis',
  'primaryDiagnosis.stageAtDiagnosis': 'Stage at Diagnosis',
  currentTreatmentStatus: 'Current Treatment Status',
  diseaseStatus: 'Disease Status',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  results: 'Results',
};

const SECTION_FIELDS = {
  'general-info': ['date', 'type', 'provider', 'facility', 'status'],
  'primary-diagnosis': ['primaryDiagnosis.site', 'primaryDiagnosis.histology', 'primaryDiagnosis.dateOfDiagnosis', 'primaryDiagnosis.stageAtDiagnosis'],
  'treatment-timeline': [],
  'treatment-status': ['currentTreatmentStatus', 'diseaseStatus'],
  'clinical-notes': ['findings', 'assessment', 'plan', 'notes'],
  'results-section': ['results'],
  'recommendations': [],
};

const DATE_FIELDS = ['date', 'primaryDiagnosis.dateOfDiagnosis'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'primaryDiagnosis.site', 'primaryDiagnosis.histology', 'primaryDiagnosis.stageAtDiagnosis', 'currentTreatmentStatus', 'diseaseStatus', 'findings', 'assessment', 'plan', 'notes'];
/* OBJECT fields — dynamic-key recursive editor (renderObjectField/Node/Leaf) */
const OBJECT_FIELDS = ['results'];

const KEY_OVERRIDES = {};

/* humanizeKey: object-key -> readable label */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* number+unit leaf splitter — returns null for plain text and "120/80" ratios */
const splitNumberUnit = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null;
  const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/);
  if (!m || !/\d/.test(m[1])) return null;
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() };
};

/* ratio splitter — "120/80" stays text, edits numerator only */
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

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
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const TreatmentSummaryDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  // Value shape: { field, value } — the exact DB field path + value the old save would have PUT.
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
      if (r?.treatment_summary) return Array.isArray(r.treatment_summary) ? r.treatment_summary : [r.treatment_summary];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.treatment_summary) return Array.isArray(dd.treatment_summary) ? dd.treatment_summary : [dd.treatment_summary]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

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
      Object.entries(recDrafts).forEach(([editKey, draft]) => {
        if (!draft || typeof draft !== 'object') return;
        nLocal[editKey] = draft.value;
        nPending[editKey] = { field: draft.field, value: draft.value };
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

  /* Get a nested field value from a record (supports dot-notation like primaryDiagnosis.site) */
  const getNestedVal = useCallback((record, fieldPath) => {
    const parts = fieldPath.split('.');
    let val = record;
    for (const p of parts) { if (val == null) return undefined; val = val[p]; }
    return val;
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return getNestedVal(record, fn);
  }, [localEdits, getNestedVal]);

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
        if (OBJECT_FIELDS.includes(f) && typeof val === 'object') { if (flattenSearchable(val).toLowerCase().includes(phrase)) return true; }
        else if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    /* Treatment timeline special check */
    if (sid === 'treatment-timeline' && Array.isArray(record.treatmentTimeline)) {
      for (const t of record.treatmentTimeline) {
        const fields = [t.treatment, t.startDate, t.endDate, t.response, ...(t.complications || [])];
        if (fields.filter(Boolean).some(f => String(f).toLowerCase().includes(phrase))) return true;
      }
    }
    /* Recommendations special check */
    if (sid === 'recommendations' && Array.isArray(record.recommendations)) {
      for (const r of record.recommendations) {
        if (typeof r === 'object') {
          if ((r.recommendation && r.recommendation.toLowerCase().includes(phrase)) || (r.date && String(r.date).toLowerCase().includes(phrase))) return true;
        } else if (String(r).toLowerCase().includes(phrase)) return true;
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
      if (OBJECT_FIELDS.includes(fn) && typeof val === 'object') return flattenSearchable(val).toLowerCase().includes(phrase);
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
      const rt = `Treatment Summary ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (!val) continue;
          if (OBJECT_FIELDS.includes(f) && typeof val === 'object') { if (flattenSearchable(val).toLowerCase().includes(phrase)) return true; }
          else if (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      /* Check treatment timeline */
      if (Array.isArray(record.treatmentTimeline)) {
        for (const t of record.treatmentTimeline) {
          const tFields = [t.treatment, t.startDate, t.endDate, t.response, ...(t.complications || [])];
          if (tFields.filter(Boolean).some(f => String(f).toLowerCase().includes(phrase))) return true;
        }
      }
      /* Check recommendations */
      if (Array.isArray(record.recommendations)) {
        for (const r of record.recommendations) {
          if (typeof r === 'object') { if ((r.recommendation || '').toLowerCase().includes(phrase) || (r.date ? String(r.date).toLowerCase().includes(phrase) : false)) return true; }
          else if (String(r).toLowerCase().includes(phrase)) return true;
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
          if (fieldPath.includes('.')) {
            const parts = fieldPath.split('.');
            if (parts.length === 2) {
              merged[parts[0]] = { ...(merged[parts[0]] || {}), [parts[1]]: localEdits[key] };
            }
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* stageDraft — record a Save as a local DRAFT only (NO DB write). The draft is written to
     localStorage (survives refresh) and shown in the JSX, but is kept OUT of the PDF/DB until
     Approve commits it. editKey = the file's localEdits key; dbField = the exact field path the
     old save would have PUT; localVal = what gets stored in localEdits for display (may differ
     from the DB value, e.g. an object clone vs. the dotted leaf). */
  const stageDraft = useCallback((record, editKey, dbField, dbValue, localVal) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [editKey]: localVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: { field: dbField, value: dbValue } }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][editKey] = { field: dbField, value: dbValue };
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    stageDraft(record, editKey, fn, saveVal, saveVal);
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  /* ═══════ SAVE: OBJECT LEAF (dot-path) ═══════ */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    const rootEditKey = `${rootField}-${idx}`;
    setSaveError(null);
    // Build the merged object clone for display (localEdits stores the whole object for this rootField)
    const cur = localEdits[rootEditKey] !== undefined ? localEdits[rootEditKey] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    // Stage a DRAFT only — DB write happens on Approve, which PUTs the dotted leaf field.
    stageDraft(record, rootEditKey, dottedField, newVal, clone);
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }, [safeId, stageDraft, localEdits]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageDraft(record, `${fn}-${idx}`, fn, fullText, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageDraft(record, `${fn}-${idx}`, fn, fullText, fullText);
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
    /* For treatment-timeline check timeline-specific edit keys */
    if (sid === 'treatment-timeline') {
      return Object.keys(editedFields).some(k => k.startsWith('treatmentTimeline.') && k.endsWith(`-${idx}`)) ||
        Object.keys(editedSentences).some(k => k.startsWith('treatmentTimeline.') && k.endsWith(`-${idx}`) || k.includes(`treatmentTimeline`) && k.includes(`-${idx}-s`));
    }
    /* For recommendations check recommendation-specific edit keys */
    if (sid === 'recommendations') {
      return Object.keys(editedFields).some(k => k.startsWith('recommendations.') && k.endsWith(`-${idx}`)) ||
        Object.keys(editedSentences).some(k => k.startsWith('recommendations') && k.includes(`-${idx}`));
    }
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  /* editKeyInSection — does a localEdits/pendingEdits key belong to (idx, sid)? Mirrors the
     marker-clearing logic below so Approve commits exactly this section's staged drafts. */
  const editKeyInSection = useCallback((key, sid, idx) => {
    if (!key.endsWith(`-${idx}`)) return false;
    if (sid === 'treatment-timeline') return key.startsWith('treatmentTimeline.');
    if (sid === 'recommendations') return key.startsWith('recommendations.') || key.startsWith('recommendations-');
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => key === `${f}-${idx}` || (key.startsWith(`${f}.`) && key.endsWith(`-${idx}`)));
  }, []);

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      // Approve = the ONLY DB writer. Commit this section's staged drafts now.
      const toCommit = Object.keys(pendingEdits).filter(k => editKeyInSection(k, sid, idx));
      for (const key of toCommit) {
        const draft = pendingEdits[key];
        if (!draft) continue;
        const resp = await secureApiClient.put(`/api/edit/treatment_summary/${id}/edit`, { field: draft.field, value: draft.value });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/treatment_summary/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed values now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => delete store[id][k]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const fields = SECTION_FIELDS[sid] || [];
      if (sid === 'treatment-timeline') {
        setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith('treatmentTimeline.') && k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
        setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.includes('treatmentTimeline') && k.includes(`-${idx}`)) delete n[k]; }); return n; });
      } else if (sid === 'recommendations') {
        setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith('recommendations') && k.includes(`-${idx}`)) delete n[k]; }); return n; });
        setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith('recommendations') && k.includes(`-${idx}`)) delete n[k]; }); return n; });
      } else {
        setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
        setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      }
    } catch (err) { console.error(err); }
  }, [safeId, pendingEdits, editKeyInSection]);

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
    if (sid === 'treatment-timeline') {
      const tl = record.treatmentTimeline || [];
      tl.forEach((t, tIdx) => {
        text += `  ${t.treatment || `Treatment ${tIdx + 1}`}\n`;
        if (t.startDate) text += `    Start Date: ${t.startDate}\n`;
        if (t.endDate) text += `    End Date: ${t.endDate}\n`;
        if (t.response) { text += `    Response:\n`; splitBySentence(t.response).forEach(s => { text += `      ${s}\n`; }); }
        if (t.complications && t.complications.length > 0) text += `    Complications: ${t.complications.join(', ')}\n`;
        text += '\n';
      });
      return text;
    }
    if (sid === 'recommendations') {
      const recs = record.recommendations || [];
      recs.forEach((rec, rIdx) => {
        if (typeof rec === 'object') {
          if (rec.date) text += `  ${formatDate(rec.date)}\n`;
          text += `  ${rIdx + 1}. ${rec.recommendation || 'N/A'}\n`;
        } else { text += `  ${rIdx + 1}. ${rec}\n`; }
      });
      text += '\n';
      return text;
    }
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (OBJECT_FIELDS.includes(f)) {
        if (isScalar(val) || isEmptyDeep(val)) return;
        text += `${label}\n`;
        const lines = [];
        const walk = (obj, prefix) => {
          Object.entries(obj).forEach(([k, v]) => {
            if (isEmptyDeep(v)) return;
            if (isScalar(v)) lines.push(`${prefix}${humanizeKey(k)}: ${fmtScalar(v)}`);
            else if (Array.isArray(v)) lines.push(`${prefix}${humanizeKey(k)}: ${v.filter(x => !isEmptyDeep(x)).map(fmtScalar).join(', ')}`);
            else { lines.push(`${prefix}${humanizeKey(k)}:`); walk(v, prefix + '  '); }
          });
        };
        walk(val, '  ');
        lines.forEach(l => { text += `${l}\n`; });
        text += '\n';
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
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== TREATMENT SUMMARY ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Treatment Summary ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, `${fn}-${idx}`, fn, fullText2, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, `${fn}-${idx}`, fn, fullText, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT LEAF (number+unit -> number input, bool -> Yes/No select, "120/80" stays text) ═══════ */
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

  /* ═══════ RENDER: OBJECT NODE (recursive; arrays of scalars become comma leaves) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          <div className="nested-group">
            {items.map((v, i) => (
              isScalar(v) ? renderObjectLeaf(record, rootField, [...path, i], idx, sid, v)
                : <div className="nested-mini-card" key={i}>{renderObjectNode(record, rootField, idx, sid, `${humanizeKey(label)} ${i + 1}`, v, [...path, i], depth + 1)}</div>
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

  /* ═══════ RENDER: OBJECT FIELD (top-level dynamic-key recursive editor) ═══════ */
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

  /* ═══════ RENDER: TREATMENT TIMELINE SECTION ═══════ */
  const renderTimelineSection = (record, idx) => {
    const sid = 'treatment-timeline';
    if (!shouldShowSection(record, sid)) return null;
    const timeline = record.treatmentTimeline;
    if (!Array.isArray(timeline) || timeline.length === 0) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Treatment Timeline')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {timeline.map((t, tIdx) => {
            const phrase = searchTerm.toLowerCase().trim();
            if (phrase && !record._showAllSections && !sectionTitleMatches(sid)) {
              const tFields = [t.treatment, t.startDate, t.endDate, t.response, ...(t.complications || [])];
              if (!tFields.filter(Boolean).some(f => String(f).toLowerCase().includes(phrase))) return null;
            }

            /* Each timeline item has: treatment (title), startDate, endDate, response, complications */
            const treatmentEditKey = `treatmentTimeline.${tIdx}.treatment-${idx}`;
            const startDateEditKey = `treatmentTimeline.${tIdx}.startDate-${idx}`;
            const endDateEditKey = `treatmentTimeline.${tIdx}.endDate-${idx}`;
            const responseEditKey = `treatmentTimeline.${tIdx}.response-${idx}`;
            const complicationsEditKey = `treatmentTimeline.${tIdx}.complications-${idx}`;

            const treatmentVal = localEdits[treatmentEditKey] !== undefined ? localEdits[treatmentEditKey] : t.treatment;
            const startDateVal = localEdits[startDateEditKey] !== undefined ? localEdits[startDateEditKey] : t.startDate;
            const endDateVal = localEdits[endDateEditKey] !== undefined ? localEdits[endDateEditKey] : t.endDate;
            const responseVal = localEdits[responseEditKey] !== undefined ? localEdits[responseEditKey] : t.response;

            const responseSentences = splitBySentence(responseVal || '');
            const hasContent = startDateVal || endDateVal || responseVal || (t.complications && t.complications.length > 0);

            return (
              <div key={tIdx} className="rec-mini-card" style={{ marginTop: tIdx > 0 ? 12 : 0 }}>
                {/* Treatment name - editable */}
                <div className="nested-subtitle">{highlightText(treatmentVal || `Treatment ${tIdx + 1}`)}</div>
                <div className={`numbered-row ${editedFields[treatmentEditKey] ? 'modified' : ''} editable-row`} onClick={() => { if (editingField !== treatmentEditKey) { setEditingField(treatmentEditKey); setEditValue(treatmentVal || ''); setSaveError(null); } }}>
                  {editingField === treatmentEditKey ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); stageDraft(record, treatmentEditKey, `treatmentTimeline.${tIdx}.treatment`, editValue, editValue); setEditedFields(prev => ({ ...prev, [treatmentEditKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText('Treatment Name: ' + (treatmentVal || 'N/A'))}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[treatmentEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(treatmentVal || '', treatmentEditKey); }}>{copiedItems[treatmentEditKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {editedFields[treatmentEditKey] && <span className="modified-badge">edited - click Pending Approve to save</span>}

                {hasContent && (
                  <>
                    {/* Start Date */}
                    {startDateVal && (
                      <>
                        <div className={`numbered-row ${editedFields[startDateEditKey] ? 'modified' : ''} editable-row`} onClick={() => { if (editingField !== startDateEditKey) { setEditingField(startDateEditKey); setEditValue(startDateVal); setSaveError(null); } }}>
                          {editingField === startDateEditKey ? (
                            <div className="edit-field-container">
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); stageDraft(record, startDateEditKey, `treatmentTimeline.${tIdx}.startDate`, editValue, editValue); setEditedFields(prev => ({ ...prev, [startDateEditKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="row-content"><span className="content-value">{highlightText('Start Date: ' + startDateVal)}</span><span className="edit-indicator">&#9998;</span></div>
                              <button className={`copy-btn ${copiedItems[startDateEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(startDateVal, startDateEditKey); }}>{copiedItems[startDateEditKey] ? 'Copied!' : 'Copy'}</button>
                            </>
                          )}
                        </div>
                        {editedFields[startDateEditKey] && <span className="modified-badge">edited - click Pending Approve to save</span>}
                      </>
                    )}

                    {/* End Date */}
                    {endDateVal && (
                      <>
                        <div className={`numbered-row ${editedFields[endDateEditKey] ? 'modified' : ''} editable-row`} onClick={() => { if (editingField !== endDateEditKey) { setEditingField(endDateEditKey); setEditValue(endDateVal); setSaveError(null); } }}>
                          {editingField === endDateEditKey ? (
                            <div className="edit-field-container">
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); stageDraft(record, endDateEditKey, `treatmentTimeline.${tIdx}.endDate`, editValue, editValue); setEditedFields(prev => ({ ...prev, [endDateEditKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="row-content"><span className="content-value">{highlightText('End Date: ' + endDateVal)}</span><span className="edit-indicator">&#9998;</span></div>
                              <button className={`copy-btn ${copiedItems[endDateEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(endDateVal, endDateEditKey); }}>{copiedItems[endDateEditKey] ? 'Copied!' : 'Copy'}</button>
                            </>
                          )}
                        </div>
                        {editedFields[endDateEditKey] && <span className="modified-badge">edited - click Pending Approve to save</span>}
                      </>
                    )}

                    {/* Response - sentence-split */}
                    {responseVal && (
                      <div className="rec-mini-card" style={{ marginTop: 4 }}>
                        <div className="nested-subtitle">{highlightText('Response')}</div>
                        {responseSentences.length > 1 ? responseSentences.map((sentence, sIdx) => {
                          const sentKey = `${responseEditKey}-s${sIdx}`;
                          const isSentEditing = editingField === sentKey;
                          const sentBadge = editedSentences[sentKey];
                          return (
                            <div key={sIdx}>
                              <div className={`numbered-row ${sentBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!isSentEditing) { setEditingField(sentKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                                {isSentEditing ? (
                                  <div className="edit-field-container">
                                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                    {saveError && <div className="save-error">{saveError}</div>}
                                    <div className="edit-actions">
                                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const curResp = String(localEdits[responseEditKey] !== undefined ? localEdits[responseEditKey] : t.response || ''); const sents = splitBySentence(curResp); const newSents = splitBySentence(editValue.trim()); const updated = [...sents]; updated.splice(sIdx, 1, ...newSents); const fullText = reconstructFullText(updated); setSaveError(null); stageDraft(record, responseEditKey, `treatmentTimeline.${tIdx}.response`, fullText, fullText); const orig = sents[sIdx] || ''; const changed = (newSents[0] || '').replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim(); setEditedSentences(prev => { const n = { ...prev }; if (changed) n[sentKey] = 'edited'; for (let ei = 1; ei < newSents.length; ei++) n[`${responseEditKey}-s${sIdx + ei}`] = 'added'; return n; }); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                                    <button className={`copy-btn ${copiedItems[sentKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentKey); }}>{copiedItems[sentKey] ? 'Copied!' : 'Copy'}</button>
                                  </>
                                )}
                              </div>
                              {sentBadge && <span className={`modified-badge ${sentBadge === 'added' ? 'added' : ''}`}>{sentBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                            </div>
                          );
                        }) : (
                          /* Single-sentence response */
                          <>
                            <div className={`numbered-row ${editedFields[responseEditKey] ? 'modified' : ''} editable-row`} onClick={() => { if (editingField !== responseEditKey) { setEditingField(responseEditKey); setEditValue(responseVal); setSaveError(null); } }}>
                              {editingField === responseEditKey ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); stageDraft(record, responseEditKey, `treatmentTimeline.${tIdx}.response`, editValue, editValue); setEditedFields(prev => ({ ...prev, [responseEditKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(responseVal)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[responseEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(responseVal, responseEditKey); }}>{copiedItems[responseEditKey] ? 'Copied!' : 'Copy'}</button>
                                </>
                              )}
                            </div>
                            {editedFields[responseEditKey] && <span className="modified-badge">edited - click Pending Approve to save</span>}
                          </>
                        )}
                      </div>
                    )}

                    {/* Complications */}
                    {t.complications && t.complications.length > 0 && (
                      <>
                        <div className={`numbered-row ${editedFields[complicationsEditKey] ? 'modified' : ''} editable-row`} onClick={() => { if (editingField !== complicationsEditKey) { setEditingField(complicationsEditKey); setEditValue(t.complications.join(', ')); setSaveError(null); } }}>
                          {editingField === complicationsEditKey ? (
                            <div className="edit-field-container">
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const newComps = editValue.split(',').map(c => c.trim()).filter(Boolean); setSaveError(null); stageDraft(record, complicationsEditKey, `treatmentTimeline.${tIdx}.complications`, newComps, newComps); setEditedFields(prev => ({ ...prev, [complicationsEditKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="row-content"><span className="content-value">{highlightText('Complications: ' + t.complications.join(', '))}</span><span className="edit-indicator">&#9998;</span></div>
                              <button className={`copy-btn ${copiedItems[complicationsEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(t.complications.join(', '), complicationsEditKey); }}>{copiedItems[complicationsEditKey] ? 'Copied!' : 'Copy'}</button>
                            </>
                          )}
                        </div>
                        {editedFields[complicationsEditKey] && <span className="modified-badge">edited - click Pending Approve to save</span>}
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS SECTION ═══════ */
  const renderRecommendationsSection = (record, idx) => {
    const sid = 'recommendations';
    if (!shouldShowSection(record, sid)) return null;
    const recs = record.recommendations;
    if (!Array.isArray(recs) || recs.length === 0) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Recommendations')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {recs.map((rec, rIdx) => {
            const phrase = searchTerm.toLowerCase().trim();
            if (phrase && !record._showAllSections && !sectionTitleMatches(sid)) {
              const recText = typeof rec === 'object' ? `${rec.recommendation || ''} ${rec.date || ''}` : String(rec);
              if (!recText.toLowerCase().includes(phrase)) return null;
            }

            const isObj = typeof rec === 'object';
            const recText = isObj ? (rec.recommendation || 'N/A') : String(rec);
            const editKey = `recommendations.${rIdx}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const displayRecText = localEdits[editKey] !== undefined ? localEdits[editKey] : recText;

            return (
              <div key={rIdx} className="rec-mini-card">
                {isObj && rec.date && <div className="nested-subtitle">{highlightText(formatDate(rec.date))}</div>}
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayRecText); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const field = isObj ? `recommendations.${rIdx}.recommendation` : `recommendations.${rIdx}`; setSaveError(null); stageDraft(record, editKey, field, editValue, editValue); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(displayRecText)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayRecText, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
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
      <div className="treatment-summary-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Treatment Summary</h2></div>
        <div className="empty-state">No treatment summary records available</div>
      </div>
    );
  }

  return (
    <div className="treatment-summary-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Treatment Summary</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<TreatmentSummaryDocumentPDFTemplate document={pdfData} />} fileName={`treatment-summary-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search treatment summary..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(`Treatment Summary ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'general-info')}
            {renderSection(record, idx, 'primary-diagnosis')}
            {renderTimelineSection(record, idx)}
            {renderSection(record, idx, 'treatment-status')}
            {renderSection(record, idx, 'clinical-notes')}
            {renderSection(record, idx, 'results-section')}
            {renderRecommendationsSection(record, idx)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TreatmentSummaryDocument;
