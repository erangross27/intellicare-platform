/**
 * RenalProtectionPlanDocument.jsx
 * July 2026 — canonical inline editing and blue glow theme
 * Collection: renal_protection_plan
 *
 * 12 Sections: record information, findings, assessment, hydration,
 * nephrotoxin avoidance, monitoring, results, additional data, plan,
 * recommendations, consultations, and notes.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import RenalProtectionPlanDocumentPDFTemplate from '../pdf-templates/RenalProtectionPlanDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RenalProtectionPlanDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   This template's saves store the WHOLE root value in localEdits while the DB write is a per-leaf
   dotted path (e.g. ironStudies.ferritin) or a whole array. So each draft entry records BOTH the
   render value (localEdits) AND the exact DB payloads to replay on Approve. Multiple leaves of the
   same root object share one localEdits key, so payloads is a list keyed by DB field (last write wins
   per field).
   Shape: { [recordId]: { [editKeyBase]: { value, payloads: { [dbField]: dbValue } } } }
     - value:    what localEdits[editKeyBase-idx] becomes (drives the JSX render)
     - payloads: map of DB field -> exact value to PUT (replayed on Approve) */
const DRAFT_KEY = 'renalProtectionPlanPendingEdits';
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
  'record-info': 'Record Information',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'hydration': 'Hydration',
  'nephrotoxin-avoidance': 'Nephrotoxin Avoidance',
  'monitoring': 'Monitoring',
  'results': 'Results',
  'additional-data': 'Additional Data',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'consultations': 'Consultations',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status',
  findings: 'Findings', assessment: 'Assessment', hydration: 'Hydration',
  nephrotoxinAvoidance: 'Nephrotoxin Avoidance', monitoring: 'Monitoring',
  results: 'Results', additionalData: 'Additional Data', plan: 'Plan',
  recommendations: 'Recommendations', consultations: 'Consultations', notes: 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'type', 'provider', 'facility', 'status'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'hydration': ['hydration'],
  'nephrotoxin-avoidance': ['nephrotoxinAvoidance'],
  'monitoring': ['monitoring'],
  'results': ['results'],
  'additional-data': ['additionalData'],
  'plan': ['plan'],
  'recommendations': ['recommendations'],
  'consultations': ['consultations'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = [];
const ARRAY_FIELDS = ['nephrotoxinAvoidance', 'monitoring'];
const COMMA_ARRAY_FIELDS = ['monitoring'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'findings', 'assessment', 'hydration', 'plan', 'consultations', 'notes'];
const WHOLE_STRING_FIELDS = ['provider', 'consultations'];
/* DISPLAY/EDIT recursive object fields */
const OBJECT_FIELDS = ['results', 'additionalData'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const STATUS_OPTIONS = ['Active', 'Monitoring', 'Improving', 'Stable', 'Completed', 'On Hold', 'Discontinued'];
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const SENTENCE_BOUNDARY = /[.;]\s+/;

/* humanizeKey for object leaf labels */
const KEY_OVERRIDES = { nsaids: 'NSAIDs', picc: 'PICC', bmi: 'BMI', bp: 'BP', iv: 'IV' };
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
  if (/^-?\d+(?:\.\d+)?\s*-\s*\d/.test(s)) return null;
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const recsToText = (recs) => {
  if (!Array.isArray(recs)) return '';
  return recs.map(r => typeof r === 'string' ? r : `${r?.recommendation || ''} ${r?.date || ''}`).join(' ');
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&().#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/);
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
    else if (ch === ',' && depth === 0) {
      const before = current.trim();
      const after = text.slice(i + 1);
      const afterTrimmed = after.trimStart();
      const nextWord = (afterTrimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
      const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(afterTrimmed)) || after.length === afterTrimmed.length || ['and', 'or', 'then'].includes(nextWord) || ['and', 'or'].includes(previousWord);
      if (protectedComma) current += ch;
      else { if (before) result.push(before); current = ''; }
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

const enumOptionsWith = (options, current) => {
  const list = options || [];
  if (!current || list.some(o => o.toLowerCase() === String(current).toLowerCase())) return list;
  return [String(current), ...list];
};

const stepFor = (value) => {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.(\d+))?/);
  return match?.[1] ? 10 ** -match[1].length : 1;
};

const setAtPath = (source, path, value) => {
  const clone = Array.isArray(source) ? [...source] : { ...(source || {}) };
  let node = clone;
  path.forEach((part, index) => {
    if (index === path.length - 1) { node[part] = value; return; }
    const next = node[part];
    node[part] = Array.isArray(next) ? [...next] : { ...(next || {}) };
    node = node[part];
  });
  return clone;
};

const splitNarrative = (text) => {
  if (!text || typeof text !== 'string') return { parts: [], delimiters: [] };
  const parts = []; const delimiters = []; let current = '';
  const abbreviations = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g)$/i;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]; current += ch;
    if ((ch !== '.' && ch !== ';') || !/\s/.test(text[i + 1] || '')) continue;
    const candidate = current.slice(0, -1).trim();
    const genus = ch === '.' && /(?:^|\s)[A-Z]$/.test(candidate);
    const listMarker = ch === '.' && /(?:^|\s)\d+$/.test(candidate);
    if (genus || listMarker || abbreviations.test(candidate)) continue;
    parts.push(candidate.replace(/^\d+\.\s*/, '')); delimiters.push(ch); current = '';
  }
  const tail = current.trim().replace(/[.;]+$/, '');
  if (tail) parts.push(tail.replace(/^\d+\.\s*/, ''));
  return { parts, delimiters };
};

/* ═══════ COMPONENT ═══════ */
const RenalProtectionPlanDocument = ({ document: docProp }) => {
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
      if (r?.renal_protection_plan) return Array.isArray(r.renal_protection_plan) ? r.renal_protection_plan : [r.renal_protection_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.renal_protection_plan) return Array.isArray(dd.renal_protection_plan) ? dd.renal_protection_plan : [dd.renal_protection_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Each draft entry carries the render value (-> localEdits) and the exact DB payload (replayed on Approve). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (record && record._id) ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKeyBase, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        const editKey = `${editKeyBase}-${idx}`;
        nLocal[editKey] = entry.value;
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
    if (!SENTENCE_BOUNDARY.test(String(text || ''))) return splitNarrative(text).parts.filter(s => s && !/^[;.,!?]+$/.test(s));
    return splitNarrative(text).parts.filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences, originalText = '') {
    if (!sentences || sentences.length === 0) return '';
    const { delimiters } = splitNarrative(originalText);
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += delimiters[i] || '.';
      return c;
    }).join(' ');
  }

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    // Handle dot-notation for nested fields
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) {
        if (val === null || val === undefined) return undefined;
        val = val[p];
      }
      return val;
    }
    return record[fn];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* searchable text for any field type (objects/array-of-objects flattened) */
  const fieldSearchText = useCallback((f, val) => {
    if (OBJECT_ARRAY_FIELDS.includes(f)) return recsToText(val);
    if (OBJECT_FIELDS.includes(f)) return flattenSearchable(val);
    return fmtVal(val);
  }, [fmtVal]);

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
        if (OBJECT_FIELDS.includes(f) || OBJECT_ARRAY_FIELDS.includes(f)) { if (fieldSearchText(f, val).toLowerCase().includes(phrase)) return true; }
        else if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, fieldSearchText]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (OBJECT_FIELDS.includes(fn) || OBJECT_ARRAY_FIELDS.includes(fn)) return fieldSearchText(fn, val).toLowerCase().includes(phrase);
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, fieldSearchText]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Renal Protection Plan ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (!val) continue;
          if (OBJECT_FIELDS.includes(f) || OBJECT_ARRAY_FIELDS.includes(f)) { if (fieldSearchText(f, val).toLowerCase().includes(phrase)) return true; continue; }
          if (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, fieldSearchText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      let merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldName = m[1];
          merged = setAtPath(merged, fieldName.split('.'), localEdits[key]);
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Stage a DRAFT locally (NO DB write). Persists to the pending-drafts localStorage store so it
     survives refresh, marks the editKey pending (kept OUT of PDF/Copy All), and drops the section's
     approved flag so the button returns to yellow "Pending Approve". Approve commits the recorded
     { field, payloadValue } to MongoDB. localEditKeyBase = "fn" or "rootField" (the localEdits key
     without the trailing "-idx"); dbField/dbValue = the exact DB payload the old save would have PUT. */
  const stageDraft = useCallback((record, idx, sid, localEditKeyBase, renderValue, dbField, dbValue) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${localEditKeyBase}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: renderValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    const existing = store[id][localEditKeyBase];
    const payloads = (existing && existing.payloads && typeof existing.payloads === 'object') ? { ...existing.payloads } : {};
    payloads[dbField] = dbValue;
    store[id][localEditKeyBase] = { value: renderValue, payloads };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  // Save = stage a DRAFT (no DB write). Approve commits it.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    stageDraft(record, idx, sid, fn, saveVal, fn, saveVal);
  }, [editValue, safeId, stageDraft]);

  /* ═══════ SAVE: OBJECT LEAF (dotted path) ═══════ */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    // Build the updated whole-object clone for rendering (localEdits holds the whole root object).
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    // Render value = whole object clone; DB payload = the single dotted leaf path + scalar.
    stageDraft(record, idx, sid, rootField, clone, dottedField, newVal);
  }, [safeId, localEdits, stageDraft]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB (the ONLY DB writer), then clear pending
  // so the committed values flow into pdfData/PDF, drop the record's drafts from localStorage, and
  // mark the section approved + clear its edited markers (as the old handler did).
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // localEdits keys staged for this record+section: "<field>-<idx>" where field maps into this section.
    const editKeysForSection = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k]) return false;
      const m = k.match(/^(.+)-(\d+)$/);
      if (!m || parseInt(m[2], 10) !== idx) return false;
      const base = m[1];
      return fields.some(f => base === f || base.startsWith(`${f}.`) || f.startsWith(`${base}.`));
    });
    setSaving(true); setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // Replay each staged field's exact DB payload(s). Falls back to (field=base, value=localEdits) if missing.
      for (const editKey of editKeysForSection) {
        const m = editKey.match(/^(.+)-(\d+)$/);
        const base = m[1];
        const entry = recDrafts[base];
        const payloads = (entry && entry.payloads && typeof entry.payloads === 'object') ? entry.payloads : { [base]: localEdits[editKey] };
        for (const [dbField, dbValue] of Object.entries(payloads)) {
          const resp = await secureApiClient.put(`/api/edit/renal_protection_plan/${id}/edit`, { field: dbField, value: dbValue });
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        }
      }
      await secureApiClient.put(`/api/edit/renal_protection_plan/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; editKeysForSection.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store2 = readDrafts();
      if (store2[id]) {
        editKeysForSection.forEach(k => { const mm = k.match(/^(.+)-(\d+)$/); if (mm) delete store2[id][mm[1]]; });
        if (Object.keys(store2[id]).length === 0) delete store2[id];
        writeDrafts(store2);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[RenalProtectionPlan] Approve error:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
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
  const formatSentenceFieldLines = useCallback((text, fieldName) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(sentence => {
      const parsed = parseLabel(sentence);
      const source = parsed.isLabeled ? parsed.value : sentence;
      const commaParts = splitByComma(source);
      const parts = (parsed.isLabeled && commaParts.length >= 2) || (!parsed.isLabeled && !WHOLE_STRING_FIELDS.includes(fieldName) && commaParts.length >= 3) ? commaParts : [source];
      if (parsed.isLabeled) {
        lines.push(parsed.label);
        lines.push(COPY_LINE_DASH);
        n = 1;
      }
      parts.forEach(item => { lines.push(`${n++}. ${item}`); });
    });
    return lines;
  }, [splitBySentence]);

  /* object → copy lines (recursive) */
  const objectCopyLines = useCallback(function buildObjectCopyLines(label, value, indent) {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (label) { out.push(`${pad}${label}`); out.push(`${pad}${COPY_LINE_DASH}`); }
    if (isScalar(value)) {
      const rows = typeof value === 'string' && !splitRatio(value) && !splitNumberUnit(value)
        ? splitNarrative(value).parts
        : [fmtScalar(value)];
      rows.forEach((row, rowIndex) => out.push(`${pad}${rowIndex + 1}. ${row}`));
      return out;
    }
    if (Array.isArray(value)) {
      value.filter(item => !isEmptyDeep(item)).forEach((item, itemIndex) => {
        if (isScalar(item)) out.push(`${pad}${itemIndex + 1}. ${fmtScalar(item)}`);
        else out.push(...buildObjectCopyLines(`${label || 'Item'} ${itemIndex + 1}`, item, indent + 1));
      });
      return out;
    }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...buildObjectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let body = '';
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val.map(item => typeof item === 'string' ? { recommendation: item, date: '' } : item) : [];
        if (!sameAsTitle) body += `${label}\n${COPY_LINE_DASH}\n`;
        const groups = [];
        recs.forEach((item) => {
          const dateKey = toInputDate(item?.date) || String(item?.date || '') || 'no-date';
          const group = groups.find(entry => entry.dateKey === dateKey);
          if (group) group.rows.push(item?.recommendation || '');
          else groups.push({ dateKey, date: item?.date, rows: [item?.recommendation || ''] });
        });
        groups.forEach(group => {
          if (group.date) body += `${formatDate(group.date)}\n${COPY_LINE_DASH}\n`;
          group.rows.filter(Boolean).forEach((row, rowIndex) => { body += `${rowIndex + 1}. ${row}\n`; });
        });
        body += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        if (!sameAsTitle) body += `${label}\n${COPY_LINE_DASH}\n`;
        const items = Array.isArray(val) ? val.filter(item => !isEmptyDeep(item)) : [];
        const rows = items.flatMap(item => {
          const value = fmtScalar(item);
          const parts = COMMA_ARRAY_FIELDS.includes(f) ? splitByComma(value) : [value];
          return parts.length >= 2 ? parts : [value];
        });
        rows.forEach((row, rowIndex) => { body += `${rowIndex + 1}. ${row}\n`; });
        body += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        if (!sameAsTitle) body += `${label}\n${COPY_LINE_DASH}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { body += `${l}\n`; }));
        body += '\n';
      } else if (DATE_FIELDS.includes(f)) {
        body += `${label}\n${COPY_LINE_DASH}\n1. ${formatDate(val)}\n\n`;
      } else if (f === 'transfusionHistory') {
        const items = Array.isArray(val) ? val : [];
        items.forEach((t, i) => {
          body += `Transfusion ${i + 1}\n${COPY_LINE_DASH}\n`;
          if (t.date) body += `Date\n${COPY_LINE_DASH}\n1. ${formatDate(t.date)}\n`;
          if (!isEmptyDeep(t.units)) body += `Units\n${COPY_LINE_DASH}\n1. ${fmtScalar(t.units)}\n`;
          if (t.type) body += `Type\n${COPY_LINE_DASH}\n1. ${t.type}\n`;
          if (t.reason) body += `Reason\n${COPY_LINE_DASH}\n1. ${t.reason}\n`;
        });
        body += '\n';
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        if (!sameAsTitle) body += `${label}\n${COPY_LINE_DASH}\n`;
        formatSentenceFieldLines(strVal, f).forEach(l => { body += `${l}\n`; });
        body += '\n';
      } else {
        body += `${label}\n${COPY_LINE_DASH}\n1. ${fmtVal(val)}\n\n`;
      }
    });
    return body ? `${title}\n${COPY_LINE_EQ}\n\n${body}` : '';
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = 'RENAL PROTECTION PLAN\n\n';
    pdfData.forEach((r, idx) => {
      text += `Renal Protection Plan ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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
        <div className="nested-mini-card" data-edit-field={fn}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value || ''); setSaveError(null); }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } const iso = String(editValue).includes('T') ? editValue : `${editValue}T00:00:00.000Z`; handleSaveField(record, fn, idx, sid, null, iso); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with semantic labeled/unlabeled grouping ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (typeof val !== 'boolean') return renderStringField(record, fn, idx, sid);
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const isModified = editedFields[editKey];
    const label = FIELD_LABELS[fn] || fn; const displayVal = val ? 'Yes' : 'No';
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (<div key={fn} className="rec-mini-card">{label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase() && <div className="nested-subtitle">{highlightText(label)}</div>}
      <div className="nested-mini-card"><div data-edit-field={fn}><div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
        {isEditing ? <div className="edit-field-container"><BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
          <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); stageDraft(record, idx, sid, fn, editValue === 'Yes', fn, editValue === 'Yes'); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
          : <><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
      </div></div></div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
  };

  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!Array.isArray(val) || !val.some(item => !isEmptyDeep(item))) return null;
    const label = FIELD_LABELS[fn] || fn; const sameAsTitle = label.toLowerCase() === (SECTION_TITLES[sid] || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rows = val.flatMap((item, itemIndex) => {
      if (isEmptyDeep(item)) return [];
      const value = String(item);
      const parts = COMMA_ARRAY_FIELDS.includes(fn) ? splitByComma(value) : [value];
      return (parts.length >= 2 ? parts : [value]).map((text, partIndex) => ({ itemIndex, partIndex, text }));
    });
    return (<div key={fn} className="rec-mini-card">{!sameAsTitle && <div className="nested-subtitle">{highlightText(label)}</div>}<div className="nested-mini-card">
      {rows.map(({ itemIndex, partIndex, text }) => { const path = `${fn}.${itemIndex}`; const editKey = `${path}-${idx}-p${partIndex}`; const trackingKey = `${path}-${idx}`; const isEditing = editingField === editKey; const isModified = editedFields[trackingKey];
        return <div key={editKey} data-edit-field={path}><div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(text); } }}>
          {isEditing ? <div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus/><div className="edit-actions"><button className="save-btn" onClick={e => { e.stopPropagation(); const nextValue = editValue.trim(); const updated = [...val]; const original = String(val[itemIndex]); const originalParts = COMMA_ARRAY_FIELDS.includes(fn) ? splitByComma(original) : [original]; if (originalParts.length >= 2) { originalParts[partIndex] = nextValue; updated[itemIndex] = originalParts.join(', '); } else updated[itemIndex] = nextValue; setEditedFields(prev => ({ ...prev, [trackingKey]: 'edited' })); stageDraft(record, idx, sid, fn, updated, path, updated[itemIndex]); }}>Save</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
            : <><div className="row-content"><span className="content-value">{highlightText(text)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(text, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
        </div></div>; })}
    </div></div>);
  };

  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const label = FIELD_LABELS[fn] || fn;
    const showFieldLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const sentences = splitBySentence(strVal);
    const segments = sentences.map((sentence, sentenceIndex) => {
      const parsed = parseLabel(sentence);
      const source = parsed.isLabeled ? parsed.value : sentence;
      const commaParts = splitByComma(source);
      const parts = (parsed.isLabeled && commaParts.length >= 2) || (!parsed.isLabeled && !WHOLE_STRING_FIELDS.includes(fn) && commaParts.length >= 3) ? commaParts : [source];
      return { sentenceIndex, label: parsed.isLabeled ? parsed.label : '', parts };
    });
    const cards = [];
    segments.forEach(segment => {
      const rows = segment.parts.map((text, partIndex) => ({ ...segment, text, partIndex }));
      if (segment.label) cards.push({ label: segment.label, rows });
      else {
        const previous = cards[cards.length - 1];
        if (previous && !previous.label) previous.rows.push(...rows);
        else cards.push({ label: '', rows });
      }
    });

    const savePart = (row, rowKey, replacement) => {
      const currentText = String(getFieldValue(record, fn, idx) || '');
      const currentSentences = splitBySentence(currentText);
      const currentSentence = currentSentences[row.sentenceIndex] || '';
      const parsed = parseLabel(currentSentence);
      const source = parsed.isLabeled ? parsed.value : currentSentence;
      const commaParts = splitByComma(source);
      const currentParts = (parsed.isLabeled && commaParts.length >= 2) || (!parsed.isLabeled && !WHOLE_STRING_FIELDS.includes(fn) && commaParts.length >= 3) ? commaParts : [source];
      currentParts[row.partIndex] = replacement.trim().replace(/[;.]+$/, '');
      currentSentences[row.sentenceIndex] = parsed.isLabeled ? `${parsed.label}: ${currentParts.join(', ')}` : currentParts.join(', ');
      const rebuilt = reconstructFullText(currentSentences, currentText);
      setEditedSentences(prev => ({ ...prev, [rowKey]: 'edited' }));
      stageDraft(record, idx, sid, fn, rebuilt, fn, rebuilt);
      setSaveError(null);
    };

    return (
      <div key={fn} className="rec-mini-card">
        {showFieldLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {cards.map((card, cardIndex) => (
          <div key={`${fn}-card-${cardIndex}`} className={`nested-mini-card ${card.label ? '' : 'regular-row-group'}`.trim()}>
            {card.label && <div className="nested-subtitle sub-label">{highlightText(card.label)}</div>}
            {card.rows.map(row => {
              const rowKey = `${fn}-${idx}-s${row.sentenceIndex}-c${row.partIndex}`;
              const isEditing = editingField === rowKey;
              const badge = editedSentences[rowKey];
              const ratio = splitRatio(row.text);
              const measurement = ratio ? null : splitNumberUnit(row.text);
              const editStart = ratio ? ratio.num : measurement ? measurement.num : row.text;
              const step = stepFor(editStart);
              const stepValue = direction => {
                const current = Number.parseFloat(editValue);
                const decimals = (String(step).split('.')[1] || '').length;
                setEditValue(((Number.isFinite(current) ? current : 0) + direction * step).toFixed(decimals));
              };
              return (
                <div key={rowKey} data-edit-field={fn}>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(editStart); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        {fn === 'status' ? (
                          <BlueSelect value={editValue} options={enumOptionsWith(STATUS_OPTIONS, editValue)} onChange={setEditValue} />
                        ) : (ratio || measurement) ? (
                          <div className="num-stepper-row">
                            <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepValue(-1); }}>−</button>
                            <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={event => setEditValue(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (measurement.unit && <span className="number-edit-unit">{measurement.unit}</span>)}
                            <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepValue(1); }}>+</button>
                          </div>
                        ) : (
                          <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        )}
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => {
                            event.stopPropagation();
                            let replacement = editValue;
                            if (ratio || measurement) {
                              const number = Number.parseFloat(editValue);
                              if (!Number.isFinite(number)) { setSaveError('Please enter a valid number'); return; }
                              replacement = ratio ? `${number}/${ratio.denom}` : (measurement.unit ? `${number}${measurement.sep || ' '}${measurement.unit}` : String(number));
                            }
                            savePart(row, rowKey, replacement);
                          }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(row.text)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(row.text, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (sentence rows share one card and persist one dotted leaf) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const fieldPath = `${rootField}.${path.join('.')}`;
    const rootDraft = localEdits[`${rootField}-${idx}`];
    const currentValue = rootDraft === undefined ? value : path.reduce((node, part) => node?.[part], rootDraft);
    const leafValueString = fmtScalar(currentValue);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isBool = typeof currentValue === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const narrativeRows = (!isBool && !ratio && !nu && typeof currentValue === 'string')
      ? splitBySentence(leafValueString)
      : [leafValueString];

    const saveRow = (rowIndex, rowKey) => {
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
        newVal = typeof currentValue === 'number' ? n : (nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n));
      } else {
        const updatedRows = [...narrativeRows];
        updatedRows[rowIndex] = editValue.trim();
        newVal = reconstructFullText(updatedRows, leafValueString);
      }
      saveLeaf(record, rootField, path, idx, sid, rowKey, newVal);
    };

    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        {narrativeRows.map((rowText, rowIndex) => {
          const rowKey = narrativeRows.length > 1 ? `${leafKey}-s${rowIndex}` : leafKey;
          const isEditing = editingField === rowKey;
          const isModified = editedFields[rowKey];
          const editStartValue = isBool ? (currentValue ? 'Yes' : 'No') : ratio ? ratio.num : nu ? nu.num : rowText;
          const step = stepFor(editStartValue);
          const stepNumber = direction => {
            const current = Number.parseFloat(editValue);
            const decimals = (String(step).split('.')[1] || '').length;
            setEditValue(((Number.isFinite(current) ? current : 0) + direction * step).toFixed(decimals));
          };
          return (
            <div key={rowKey} data-edit-field={fieldPath}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(editStartValue); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    {isBool ? (
                      <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
                    ) : (ratio || nu) ? (
                      <div className="num-stepper-row">
                        <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepNumber(-1); }}>−</button>
                        <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                        <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepNumber(1); }}>+</button>
                      </div>
                    ) : (
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    )}
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRow(rowIndex, rowKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(rowText)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(rowText, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: OBJECT (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    if (Array.isArray(value)) {
      const items = value.filter(item => !isEmptyDeep(item));
      if (items.length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          <div className="nested-mini-card">
            {items.map((item, itemIndex) => isScalar(item)
              ? renderObjectLeaf(record, rootField, [...path, itemIndex], idx, sid, item)
              : renderObjectNode(record, rootField, idx, sid, `${humanizeKey(path[path.length - 1])} ${itemIndex + 1}`, item, [...path, itemIndex], depth + 1))}
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

  /* ═══════ RENDER: RECOMMENDATIONS — array of {recommendation, date}, date-grouped ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val.map(item => typeof item === 'string' ? { recommendation: item, date: '' } : item) : [];
    if (recs.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();

    const groups = [];
    recs.forEach((rec, rIdx) => {
      const datePath = `${fn}.${rIdx}.date`;
      const dateValue = localEdits[`${datePath}-${idx}`] !== undefined ? localEdits[`${datePath}-${idx}`] : (rec?.date || '');
      const dateKey = toInputDate(dateValue) || String(dateValue || '').trim() || 'no-date';
      const existing = groups.find(group => group.dateKey === dateKey);
      if (existing) existing.items.push({ rec, rIdx });
      else groups.push({ dateKey, dateValue, items: [{ rec, rIdx }] });
    });

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, gIdx) => {
          const anyVisible = !searchTerm.trim() || phraseMatch || labelMatch || String(group.dateValue || '').toLowerCase().includes(phrase) || group.items.some(({ rec }) => (rec?.recommendation || '').toLowerCase().includes(phrase));
          if (searchTerm.trim() && !anyVisible) return null;
          const datePaths = group.items.map(({ rIdx }) => `${fn}.${rIdx}.date`);
          const dateEditKey = `${fn}-date-${group.dateKey}-${idx}`;
          const dateEditing = editingField === dateEditKey;
          const dateModified = datePaths.some(path => editedFields[`${path}-${idx}`]);
          return (
            <div key={group.dateKey || gIdx} className="nested-mini-card recommendation-group">
              {group.dateValue && (
                <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
                  <div className={`nested-subtitle date-subtitle editable-row ${dateModified ? 'modified' : ''}`} onClick={() => { if (!dateEditing) { setEditingField(dateEditKey); setEditValue(toInputDate(group.dateValue)); setSaveError(null); } }}>
                    {dateEditing ? (
                      <div className="edit-field-container">
                        <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value || ''); setSaveError(null); }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => {
                            event.stopPropagation();
                            if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; }
                            const iso = String(editValue).includes('T') ? editValue : `${editValue}T00:00:00.000Z`;
                            const markers = {};
                            datePaths.forEach(path => { markers[`${path}-${idx}`] = 'edited'; stageDraft(record, idx, sid, path, iso, path, iso); });
                            setEditedFields(prev => ({ ...prev, ...markers }));
                            setEditingField(null); setEditValue(''); setSaveError(null);
                          }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <><span className="content-value">{highlightText(formatDate(group.dateValue))}</span><span className="edit-indicator">&#9998;</span></>
                    )}
                  </div>
                  {dateModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              )}
              {group.items.map(({ rec, rIdx }) => {
                const fieldPath = `${fn}.${rIdx}.recommendation`;
                const editKey = `${fieldPath}-${idx}`;
                const recText = String(localEdits[editKey] !== undefined ? localEdits[editKey] : (rec?.recommendation || '')).trim();
                const itemKey = `${fn}-${idx}-r${rIdx}`;
                const isEditing = editingField === itemKey;
                const badge = editedFields[editKey];
                const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || recText.toLowerCase().includes(phrase) || String(group.dateValue || '').toLowerCase().includes(phrase);
                if (!itemMatches && searchTerm.trim()) return null;
                return (
                  <div key={rIdx} data-edit-field={fieldPath}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              const trimmed = editValue.trim();
                              setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                              stageDraft(record, idx, sid, fieldPath, trimmed, fieldPath, trimmed);
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(recText, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
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
      <div className="renal-protection-plan-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Renal Protection Plan</h2></div>
        <div className="empty-state">No renal protection plan records available</div>
      </div>
    );
  }

  return (
    <div className="renal-protection-plan-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Renal Protection Plan</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RenalProtectionPlanDocumentPDFTemplate document={pdfData} />} fileName="Renal_Protection_Plan.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search renal anemia..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Renal Protection Plan ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'record-info')}
            {renderSection(record, idx, 'findings')}
            {renderSection(record, idx, 'assessment')}
            {renderSection(record, idx, 'hydration')}
            {renderSection(record, idx, 'nephrotoxin-avoidance')}
            {renderSection(record, idx, 'monitoring')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'additional-data')}
            {renderSection(record, idx, 'plan')}
            {renderSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'consultations')}
            {renderSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RenalProtectionPlanDocument;
