/**
 * PathologyReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: pathology_reports
 *
 * Sections:
 *   1. specimen-info:    specimenType, specimenSource, date
 *   2. clinical-history: clinicalHistory
 *   3. gross-description: grossDescription
 *   4. microscopic:      microscopicDescription
 *   5. special-stains:   specialStains (array of strings)
 *   6. immunohisto:      immunohistochemistry (array of strings)
 *   7. molecular:        molecularStudies (array of strings)
 *   8. diagnosis:        diagnosis
 *   9. staging:          staging.whoGrade, staging.molecularSubtype
 *  10. margins:          margins (recursive OBJECT — booleans → Yes/No)
 *  11. pathologist:      pathologist
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PathologyReportsDocumentPDFTemplate from '../pdf-templates/PathologyReportsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './PathologyReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { value, put } } } where editKey is the file's own "<fn>-<idx>"
   localEdits key, value is the merged localEdits value (array/object/string for the JSX), and `put`
   is the exact DB payload(s) to replay on Approve ({ field, value, arrayIndex? } or array thereof). */
const DRAFT_KEY = 'pathology_reportsPendingEdits';
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
  'specimen-info':     'Specimen Information',
  'clinical-history':  'Clinical History',
  'gross-description': 'Gross Description',
  'microscopic':       'Microscopic Description',
  'special-stains':    'Special Stains',
  'immunohisto':       'Immunohistochemistry',
  'molecular':         'Molecular Studies',
  'diagnosis':         'Diagnosis',
  'staging':           'Staging',
  'margins':           'Margins',
  'pathologist':       'Pathologist',
};

const FIELD_LABELS = {
  specimenType:           'Specimen Type',
  specimenSource:         'Specimen Source',
  date:                   'Date',
  clinicalHistory:        'Clinical History',
  grossDescription:       'Gross Description',
  microscopicDescription: 'Microscopic Description',
  specialStains:          'Special Stains',
  immunohistochemistry:   'Immunohistochemistry',
  molecularStudies:       'Molecular Studies',
  diagnosis:              'Diagnosis',
  staging:                'Staging',
  margins:                'Margins',
  pathologist:            'Pathologist',
};

const SECTION_FIELDS = {
  'specimen-info':     ['specimenType', 'specimenSource', 'date'],
  'clinical-history':  ['clinicalHistory'],
  'gross-description': ['grossDescription'],
  'microscopic':       ['microscopicDescription'],
  'special-stains':    ['specialStains'],
  'immunohisto':       ['immunohistochemistry'],
  'molecular':         ['molecularStudies'],
  'diagnosis':         ['diagnosis'],
  'staging':           ['staging'],
  'margins':           ['margins'],
  'pathologist':       ['pathologist'],
};

const DATE_FIELDS    = ['date'];
const ARRAY_FIELDS   = ['specialStains', 'immunohistochemistry', 'molecularStudies'];
const OBJECT_FIELDS  = ['staging', 'margins'];
const STRING_FIELDS  = ['specimenType', 'specimenSource', 'clinicalHistory', 'grossDescription', 'microscopicDescription', 'diagnosis', 'pathologist'];

/* humanizeKey for nested object keys */
const KEY_OVERRIDES = { dcis: 'DCIS', lvi: 'LVI', pni: 'PNI' };
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
/* recursive object → indented copy lines */
const objectToCopyLines = (obj, depth) => {
  let out = '';
  const pad = '  '.repeat(depth + 1);
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (isEmptyDeep(v)) return;
    if (isScalar(v)) out += `${pad}${humanizeKey(k)}: ${fmtScalar(v)}\n`;
    else { out += `${pad}${humanizeKey(k)}\n${objectToCopyLines(v, depth + 1)}`; }
  });
  return out;
};

/* ═══════ PURE HELPERS ═══════ */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
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
const PathologyReportsDocument = ({ document: docProp }) => {
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
  // editKeys (= the file's "<fn>-<idx>" localEdits keys) that are staged drafts: saved locally,
  // NOT yet committed to DB/PDF. Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.pathology_reports) return Array.isArray(r.pathology_reports) ? r.pathology_reports : [r.pathology_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pathology_reports) return Array.isArray(dd.pathology_reports) ? dd.pathology_reports : [dd.pathology_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Resolve a record's id the same way safeId does (handles _id.$oid) — needed at mount before
     safeId's useCallback is defined in render order. */
  const recordId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Draft shape per record: { [fn]: { value, puts:[{field,value,arrayIndex?}], marks:[trackSuffix...] } }
     where fn is the localEdits base field, value is the merged localEdits value, puts are the DB writes
     to replay on Approve, and marks are the editedFields/editedSentences suffixes (after the "<idx>"). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recordId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fn, draft]) => {
        const localKey = `${fn}-${idx}`;
        nLocal[localKey] = draft.value;
        nPending[localKey] = true;
        (draft.fieldMarks || []).forEach(suffix => { nFields[`${fn}-${idx}${suffix}`] = 'edited'; });
        (draft.rawFieldMarks || []).forEach(pre => { nFields[`${pre}-${idx}`] = 'edited'; });
        (draft.sentenceMarks || []).forEach(suffix => { nSentences[`${fn}-${idx}${suffix}`] = 'edited'; });
        if ((draft.fieldMarks || []).length === 0 && (draft.rawFieldMarks || []).length === 0 && (draft.sentenceMarks || []).length === 0) nFields[localKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* Stage a DRAFT locally (NO DB write). Persists to localStorage so it survives refresh; the value
     shows in the JSX but stays OUT of the PDF/DB until Approve replays draft.puts. `sid` clears the
     section's approve button so a re-edit returns it to yellow Pending Approve. */
  const stageDraft = useCallback((record, fn, idx, mergedValue, puts, opts = {}) => {
    const id = recordId(record); if (!id) return;
    const localKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: mergedValue }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    if (opts.fieldMark) setEditedFields(prev => ({ ...prev, [`${fn}-${idx}${opts.fieldMark.suffix}`]: opts.fieldMark.state || 'edited' }));
    if (opts.fieldMarks) setEditedFields(prev => { const n = { ...prev }; opts.fieldMarks.forEach(m => { n[`${fn}-${idx}${m.suffix}`] = m.state || 'edited'; }); return n; });
    // rawFieldMarks: marker keys NOT of the form `${fn}-${idx}…` (e.g. array `${fn}.${itemIdx}-${idx}`);
    // stored/rehydrated as the pre-"-${idx}" segment so the record index can be re-applied on refresh.
    if (opts.rawFieldMarks) setEditedFields(prev => { const n = { ...prev }; opts.rawFieldMarks.forEach(m => { n[`${m.pre}-${idx}`] = m.state || 'edited'; }); return n; });
    if (opts.sentenceMarks) setEditedSentences(prev => { const n = { ...prev }; opts.sentenceMarks.forEach(m => { n[`${fn}-${idx}${m.suffix}`] = m.state || 'edited'; }); return n; });
    if (opts.sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${opts.sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    const prevDraft = store[id][fn] || {};
    store[id][fn] = {
      value: mergedValue,
      puts,
      fieldMarks: [
        ...(prevDraft.fieldMarks || []),
        ...(opts.fieldMark ? [opts.fieldMark.suffix] : []),
        ...((opts.fieldMarks || []).map(m => m.suffix)),
      ],
      rawFieldMarks: [
        ...(prevDraft.rawFieldMarks || []),
        ...((opts.rawFieldMarks || []).map(m => m.pre)),
      ],
      sentenceMarks: [
        ...(prevDraft.sentenceMarks || []),
        ...((opts.sentenceMarks || []).map(m => m.suffix)),
      ],
    };
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, []);

  /* ═══════ UTILS ═══════ */

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* Resolve nested field like staging.whoGrade from record */
  const getNestedValue = useCallback((record, fn) => {
    if (!fn.includes('.')) return record[fn];
    const parts = fn.split('.');
    let val = record;
    for (const p of parts) { if (val == null) return undefined; val = val[p]; }
    return val;
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
        if (OBJECT_FIELDS.includes(f) && typeof val === 'object') { if (flattenSearchable(val).toLowerCase().includes(phrase)) return true; }
        else if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      const rt = `pathology report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (OBJECT_FIELDS.includes(f) && typeof val === 'object' ? flattenSearchable(val).toLowerCase().includes(phrase) : Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
          const fn = m[1];
          if (fn.includes('.')) {
            const parts = fn.split('.');
            if (!merged[parts[0]]) merged[parts[0]] = {};
            merged[parts[0]][parts[1]] = localEdits[key];
          } else {
            merged[fn] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally (no DB write). localStorage keeps it across refresh; Approve commits it.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    // trackKey is normally `${fn}-${idx}`; if a custom one is passed, derive its suffix after the idx.
    const fullTrack = editTrackingKey || `${fn}-${idx}`;
    const suffix = fullTrack.startsWith(`${fn}-${idx}`) ? fullTrack.slice(`${fn}-${idx}`.length) : '';
    stageDraft(record, fn, idx, saveVal, [{ field: fn, value: saveVal }], { sid, fieldMark: { suffix } });
  }, [editValue, safeId, stageDraft]);

  /* Save a single leaf of an object field via dotted path (e.g. margins.status) */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    // Build the merged object value (what the JSX shows) without touching the DB.
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    // leafKeyTrack === `${rootField}-${idx}-${path.join('.')}`; suffix is everything after the localEdits key.
    const base = `${rootField}-${idx}`;
    const suffix = leafKeyTrack.startsWith(base) ? leafKeyTrack.slice(base.length) : `-${path.join('.')}`;
    stageDraft(record, rootField, idx, clone, [{ field: dottedField, value: newVal }], { sid, fieldMark: { suffix } });
  }, [safeId, localEdits, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      // Deleting a sentence — stage the rebuilt text as a draft (no DB write until Approve).
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, fullText, [{ field: fn, value: fullText }], { sid, sentenceMarks: [{ suffix: `-s${sentenceIdx}` }] });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const sentenceMarks = [];
    if (changed) sentenceMarks.push({ suffix: `-s${sentenceIdx}`, state: 'edited' });
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) sentenceMarks.push({ suffix: `-s${sentenceIdx + 1 + ei}`, state: 'added' });
    stageDraft(record, fn, idx, fullText, [{ field: fn, value: fullText }], { sid, sentenceMarks });
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB (the ONLY path that writes to the DB),
  // then clear pending so the committed values now flow into pdfData/PDF/Copy All.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Collect this record's pending edits for this section's fields ("<fn>-<idx>" keys).
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const toCommit = Object.keys(pendingEdits).filter(k => {
        if (!k.endsWith(`-${idx}`)) return false;
        const fn = k.slice(0, -`-${idx}`.length);
        return fields.includes(fn);
      });
      // Replay each staged field's DB write(s). Prefer the exact `puts` recorded at save time; if a
      // draft is missing (edge case), fall back to a single {field, value} from localEdits.
      for (const k of toCommit) {
        const fn = k.slice(0, -`-${idx}`.length);
        const puts = (recDrafts[fn] && recDrafts[fn].puts) || [{ field: fn, value: localEdits[k] }];
        for (const p of puts) {
          await secureApiClient.put(`/api/edit/pathology_reports/${id}/edit`, p);
        }
      }
      // Flag the section approved (audit trail) — committed values now flow into the PDF.
      await secureApiClient.put(`/api/edit/pathology_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed).
      fields.forEach(f => { if (recDrafts[f]) delete recDrafts[f]; });
      if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Save failed.'); } finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

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

  /* ═══════ COPY ALL ═══════ */
  const copyAllText = useCallback(async () => {
    let text = '=== PATHOLOGY REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Pathology Report ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (r.date) text += `Date\n${formatDate(r.date)}\n\n`;
      if (r.specimenType) text += `Specimen Type\n${r.specimenType}\n\n`;
      if (r.specimenSource) text += `Specimen Source\n${r.specimenSource}\n\n`;
      if (r.clinicalHistory) { text += `Clinical History\n`; splitBySentence(r.clinicalHistory).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
      if (r.grossDescription) { text += `Gross Description\n`; splitBySentence(r.grossDescription).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
      if (r.microscopicDescription) { text += `Microscopic Description\n`; splitBySentence(r.microscopicDescription).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
      if (r.specialStains?.length) { text += `Special Stains\n`; r.specialStains.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
      if (r.immunohistochemistry?.length) { text += `Immunohistochemistry\n`; r.immunohistochemistry.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
      if (r.molecularStudies?.length) { text += `Molecular Studies\n`; r.molecularStudies.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
      if (r.diagnosis) text += `Diagnosis\n${r.diagnosis}\n\n`;
      if (r.staging && typeof r.staging === 'object' && !isEmptyDeep(r.staging)) { text += `Staging\n${objectToCopyLines(r.staging, 0)}\n`; }
      if (r.margins && typeof r.margins === 'object' && !isEmptyDeep(r.margins)) { text += `Margins\n${objectToCopyLines(r.margins, 0)}\n`; }
      if (r.pathologist) text += `Pathologist\n${r.pathologist}\n\n`;
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, splitBySentence]);

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

  /* ═══════ RENDER: STRING ARRAY FIELD ═══════ */
  const renderStringArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(v => v && String(v).trim()) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!label.toLowerCase().includes(phrase) && !itemStr.toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => {
                        e.stopPropagation(); const id2 = safeId(record); if (!id2) return;
                        // Stage the whole-array draft locally; Approve replays the per-element DB write.
                        const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])];
                        currentArr[itemIdx] = editValue;
                        stageDraft(record, fn, idx, currentArr, [{ field: fn, value: editValue, arrayIndex: itemIdx }], { sid, rawFieldMarks: [{ pre: `${fn}.${itemIdx}` }] });
                      }}>{saving ? 'Saving...' : 'Save'}</button>
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
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                                    <button className="save-btn" disabled={saving} onClick={e => {
                                      e.stopPropagation(); const id2 = safeId(record); if (!id2) return;
                                      const currentVal2 = String(getFieldValue(record, fn, idx) || '');
                                      const sentences2 = splitBySentence(currentVal2);
                                      const s2 = sentences2[sIdx] || '';
                                      const p2 = parseLabel(s2);
                                      if (!p2.isLabeled) return;
                                      const items2 = splitByComma(p2.value);
                                      const trimmed = editValue.trim();
                                      const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
                                      if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
                                      const rebuilt = `${p2.label}: ${items2.join(', ')}.`;
                                      const allS = [...sentences2]; allS[sIdx] = rebuilt;
                                      const fullText2 = reconstructFullText(allS);
                                      // Stage draft (no DB write); Approve commits fullText2 to field `fn`.
                                      const sMarks = [{ suffix: `-s${sIdx}-c${ciIdx}`, state: 'edited' }];
                                      for (let ei = 1; ei < subParts.length; ei++) sMarks.push({ suffix: `-s${sIdx}-c${ciIdx + ei}`, state: 'added' });
                                      stageDraft(record, fn, idx, fullText2, [{ field: fn, value: fullText2 }], { sid, sentenceMarks: sMarks });
                                    }}>{saving ? 'Saving...' : 'Save'}</button>
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
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => {
                            e.stopPropagation();
                            if (parsed.isLabeled) {
                              const id3 = safeId(record); if (!id3) return;
                              const trimmed = editValue.trim();
                              const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp);
                              const newValue = subParts.join(', ');
                              const reconstructed = `${parsed.label}: ${newValue}`;
                              const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
                              sentences2[sIdx] = reconstructed;
                              const fullText = reconstructFullText(sentences2);
                              // Stage draft (no DB write); Approve commits fullText to field `fn`.
                              const sMarks = [{ suffix: `-s${sIdx}`, state: 'edited' }];
                              for (let ei = 1; ei < subParts.length; ei++) sMarks.push({ suffix: `-s${sIdx}-c${ei}`, state: 'added' });
                              stageDraft(record, fn, idx, fullText, [{ field: fn, value: fullText }], { sid, sentenceMarks: sMarks });
                            } else { saveSentence(record, fn, idx, sid, sIdx); }
                          }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT NODE (recursive, read-only) ═══════ */
  const renderObjectNode = (label, value, key) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) {
      return (
        <div key={key} className="nested-mini-card">
          <div className="nested-subtitle sub-label">{highlightText(label)}</div>
          <div className="numbered-row">
            <div className="row-content"><span className="content-value">{highlightText(fmtScalar(value))}</span></div>
            <button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(fmtScalar(value), key); }}>{copiedItems[key] ? 'Copied!' : 'Copy'}</button>
          </div>
        </div>
      );
    }
    if (Array.isArray(value)) {
      const items = value.filter(x => !isEmptyDeep(x));
      return (
        <div key={key} className="nested-mini-card">
          <div className="nested-subtitle sub-label">{highlightText(label)}</div>
          {items.map((it, i) => isScalar(it)
            ? (<div key={i} className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(fmtScalar(it))}</span></div><button className={`copy-btn ${copiedItems[`${key}-${i}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(fmtScalar(it), `${key}-${i}`); }}>{copiedItems[`${key}-${i}`] ? 'Copied!' : 'Copy'}</button></div>)
            : renderObjectNode(`Item ${i + 1}`, it, `${key}-${i}`))}
        </div>
      );
    }
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    return (
      <div key={key} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(label)}</div>
        {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${key}-${k}`))}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT FIELD (staging / margins — read-only recursive) ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val) || isScalar(val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${fn}-${idx}-${k}`))}
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
    let copyText = `${title}\n${'='.repeat(40)}\n\n`;
    fields.forEach(f => {
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const label = FIELD_LABELS[f] || f;
      if (DATE_FIELDS.includes(f)) { copyText += `${label}\n${formatDate(val)}\n\n`; }
      else if (ARRAY_FIELDS.includes(f)) { const arr = Array.isArray(val) ? val : []; arr.forEach((item, i) => { copyText += `${i + 1}. ${item}\n`; }); copyText += '\n'; }
      else if (OBJECT_FIELDS.includes(f) && typeof val === 'object') { copyText += `${objectToCopyLines(val, 0)}\n`; }
      else { copyText += `${label}\n${fmtVal(val)}\n\n`; }
    });
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(copyText, copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderStringArrayField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ BAR CHART HELPERS ═══════ */
  const extractPercentage = (text) => { if (!text) return null; const match = String(text).match(/(\d+(?:\.\d+)?)\s*%/); return match ? parseFloat(match[1]) : null; };
  const extractKi67 = (ihc) => { if (!Array.isArray(ihc)) return null; const e = ihc.find(i => String(i).toLowerCase().includes('ki-67') || String(i).toLowerCase().includes('ki67')); if (!e) return null; const pct = extractPercentage(e); return pct !== null ? { value: pct, raw: String(e) } : null; };
  const extractMGMT = (mol) => { if (!Array.isArray(mol)) return null; const e = mol.find(i => String(i).toLowerCase().includes('mgmt')); if (!e) return null; const pct = extractPercentage(e); return pct !== null ? { value: pct, raw: String(e) } : null; };
  const extractWHOGrade = (staging) => {
    if (!staging?.whoGrade) return null;
    const s = String(staging.whoGrade).toLowerCase();
    let g = null;
    if (s.includes('iv') || s.includes('4')) g = 4;
    else if (s.includes('iii') || s.includes('3')) g = 3;
    else if (s.includes('ii') || s.includes('2')) g = 2;
    else if (s.includes('i') || s.includes('1')) g = 1;
    if (!g) return null;
    return { value: g * 25, raw: String(staging.whoGrade), grade: g };
  };
  const getKi67Color = (p) => p <= 15 ? '#22c55e' : p <= 30 ? '#3b82f6' : p <= 50 ? '#f59e0b' : '#ef4444';
  const getKi67Interpretation = (p) => p <= 15 ? 'Low proliferation index' : p <= 30 ? 'Moderate proliferation' : p <= 50 ? 'High proliferation' : 'Very high proliferation - aggressive';
  const getMGMTColor = (p) => p >= 50 ? '#22c55e' : p >= 30 ? '#3b82f6' : '#f59e0b';
  const getMGMTInterpretation = (p) => p >= 50 ? 'Favorable temozolomide response' : p >= 30 ? 'Moderate response expected' : 'Lower treatment response';
  const getWHOGradeColor = (g) => g === 1 ? '#22c55e' : g === 2 ? '#3b82f6' : g === 3 ? '#f59e0b' : '#ef4444';
  const getWHOGradeInterpretation = (g) => g === 1 ? 'Low grade - favorable prognosis' : g === 2 ? 'Low grade - relatively favorable' : g === 3 ? 'High grade - aggressive' : 'Highest grade - most aggressive';

  const prepareChartData = (record) => {
    const charts = [];
    const ki67 = extractKi67(record.immunohistochemistry);
    if (ki67) charts.push({ key: 'ki67', label: 'Ki-67 (Proliferation Index)', percentage: ki67.value, rawValue: `${ki67.value}%`, color: getKi67Color(ki67.value), interpretation: getKi67Interpretation(ki67.value) });
    const mgmt = extractMGMT(record.molecularStudies);
    if (mgmt) charts.push({ key: 'mgmt', label: 'MGMT Methylation', percentage: mgmt.value, rawValue: `${mgmt.value}%`, color: getMGMTColor(mgmt.value), interpretation: getMGMTInterpretation(mgmt.value) });
    const who = extractWHOGrade(record.staging);
    if (who) charts.push({ key: 'who', label: 'WHO Grade', percentage: who.value, rawValue: who.raw, color: getWHOGradeColor(who.grade), interpretation: getWHOGradeInterpretation(who.grade) });
    return charts;
  };

  const Legend = () => (
    <div className="chart-legend">
      {[['#22c55e','Favorable'],['#3b82f6','Moderate'],['#f59e0b','Concerning'],['#ef4444','High Risk']].map(([c,l]) => (
        <div key={l} className="legend-item"><div className="legend-color" style={{ backgroundColor: c }} /><span>{l}</span></div>
      ))}
    </div>
  );

  const BarChart = ({ label, percentage, rawValue, color, interpretation }) => (
    <div className="bar-chart-row">
      <div className="bar-label">{highlightText(label)}</div>
      <div className="bar-container">
        <div className="bar-background"><div className="bar-fill" style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: color }} /></div>
        <div className="bar-value">{highlightText(rawValue)}</div>
      </div>
      <div className="bar-interpretation" style={{ color }}>{highlightText(interpretation)}</div>
    </div>
  );

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="pathology-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Pathology Reports</h2></div>
        <div className="empty-state">No pathology reports available</div>
      </div>
    );
  }

  return (
    <div className="pathology-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Pathology Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PathologyReportsDocumentPDFTemplate document={pdfData} />} fileName="Pathology_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search pathology reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.length === 0 ? (
          <div className="empty-state">{searchTerm ? 'No reports match your search.' : 'No reports available.'}</div>
        ) : (
          filteredRecords.map((record, idx) => {
            const chartData = prepareChartData(record);
            return (
              <div key={idx} className="record-card">
                <div className="record-header">
                  {hasVal(record.date) && <div className="record-meta-row"><span className="record-date">{formatDate(record.date)}</span></div>}
                  <h3 className="record-name">{highlightText(`Pathology Report ${idx + 1}`)}</h3>
                </div>
                {chartData.length > 0 && (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Biomarker Overview')}</h4>
                      </div>
                      <div className="chart-container">
                        <Legend />
                        {chartData.map(chart => <BarChart key={chart.key} {...chart} />)}
                      </div>
                    </div>
                  </div>
                )}
                {renderSection(record, idx, 'specimen-info')}
                {renderSection(record, idx, 'clinical-history')}
                {renderSection(record, idx, 'gross-description')}
                {renderSection(record, idx, 'microscopic')}
                {renderSection(record, idx, 'special-stains')}
                {renderSection(record, idx, 'immunohisto')}
                {renderSection(record, idx, 'molecular')}
                {renderSection(record, idx, 'diagnosis')}
                {renderSection(record, idx, 'staging')}
                {renderSection(record, idx, 'margins')}
                {renderSection(record, idx, 'pathologist')}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PathologyReportsDocument;
