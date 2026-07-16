/**
 * UrologyAssessmentDocument.jsx
 * June 2026 — Collection: urology_assessment (NEW template)
 *
 * Donor cloned: PointOfCareUltrasoundHeartRateDocument
 *  - Generic recursive date+object+array+string renderer
 *    (renderDateField / renderStringField / renderObjectLeaf / renderObjectNode /
 *     renderObjectField / renderRecommendationsField)
 *  - DATE: renderDateField (input type=date YYYY-MM-DD, record-header date)
 *  - OBJECT: recursive sub-key render (booleans -> Yes/No select, numeric value+unit ->
 *    number input parseFloat + hide-zero via isEmptyDeep, else per-sentence string)
 *  - ARRAY: renderRecommendationsField per-item
 *  - 4-level search, per-section approve (yellow -> green), per-row Copy + Copy Section + Copy All,
 *    typed editing per type. copied-state BLUE #2563eb.
 *
 * FIELDS (15 -> 100% schema coverage):
 *   DATE:   date
 *   OBJECT: urodynamicStudies, cystoscopy, psaLevels, renalFunction, stoneAnalysis, results
 *   STRING: provider, facility, findings, assessment, plan, notes, status
 *   ARRAY:  recommendations
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import UrologyAssessmentDocumentPDFTemplate from '../pdf-templates/UrologyAssessmentDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './UrologyAssessmentDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'details': 'Assessment Details',
  'diagnostics': 'Diagnostics',
  'renal-stones': 'Renal & Stones',
  'clinical': 'Clinical',
  'recommendations-notes': 'Recommendations & Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  urodynamicStudies: 'Urodynamic Studies',
  cystoscopy: 'Cystoscopy',
  psaLevels: 'PSA Levels',
  renalFunction: 'Renal Function',
  stoneAnalysis: 'Stone Analysis',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
  status: 'Status',
};

const SECTION_FIELDS = {
  'details': ['date', 'provider', 'facility'],
  'diagnostics': ['urodynamicStudies', 'cystoscopy', 'psaLevels'],
  'renal-stones': ['renalFunction', 'stoneAnalysis'],
  'clinical': ['findings', 'assessment', 'plan', 'results'],
  'recommendations-notes': ['recommendations', 'notes', 'status'],
};

const SECTION_ORDER = ['details', 'diagnostics', 'renal-stones', 'clinical', 'recommendations-notes'];

const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
/* DISPLAY/EDIT recursive object fields */
const OBJECT_FIELDS = ['urodynamicStudies', 'cystoscopy', 'psaLevels', 'renalFunction', 'stoneAnalysis', 'results'];
/* Array-of-objects {recommendation, date} (date-grouped, editable) */
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const COMMA_SPLIT_PATHS = new Set(['cystoscopy.bladderMucosa', 'stoneAnalysis.size', 'plan']);

const KEY_OVERRIDES = {
  psa: 'PSA', gfr: 'GFR', egfr: 'eGFR', bun: 'BUN', uti: 'UTI', ph: 'pH', ct: 'CT', mri: 'MRI', usg: 'USG',
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
  const unit = (m[3] || '').trim();
  if (unit && !/^(?:mL|L|mg\/dL|g\/dL|ng\/mL|mEq\/L|U\/L|mmHg|cmH(?:2|\u2082)O|mL\/s|mL\/min|mL\/cmH(?:2|\u2082)O|mm|cm|kg|g|%)$/i.test(unit)) return null;
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit };
};

const splitRatio = (text) => {
  if (text === null || text === undefined) return null;
  const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { num: m[1], denom: m[2] };
};

const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)$/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: String(text || '').trim() };
};

const splitByComma = (text) => {
  const result = [];
  let current = '';
  let depth = 0;
  for (const char of String(text || '')) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [String(text || '').trim()];
};

const splitEditableClauses = (text) => {
  const source = String(text || '');
  const clauses = [];
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const nextIsBoundary = i === source.length - 1 || /\s/.test(source[i + 1]);
    const periodBoundary = char === '.' && !/\d/.test(source[i - 1] || '') && nextIsBoundary;
    const semicolonBoundary = char === ';' && nextIsBoundary;
    if (!periodBoundary && !semicolonBoundary) continue;
    const value = source.slice(start, i).trim();
    if (value) clauses.push({ text: value, separator: char });
    start = i + 1;
    while (/\s/.test(source[start] || '')) start += 1;
  }
  const tail = source.slice(start).trim();
  if (tail) clauses.push({ text: tail, separator: '' });
  return clauses;
};

const reconstructClauses = (clauses) => clauses.map((clause, index) => {
  const separator = clause.separator || (index < clauses.length - 1 ? '.' : '');
  return `${clause.text.trim()}${separator}`;
}).join(' ');

const setAtPath = (source, path, value) => {
  const clone = JSON.parse(JSON.stringify(source ?? (/^\d+$/.test(String(path[0])) ? [] : {})));
  let node = clone;
  path.forEach((segment, index) => {
    if (index === path.length - 1) { node[segment] = value; return; }
    const nextIsIndex = /^\d+$/.test(String(path[index + 1]));
    if (node[segment] === null || typeof node[segment] !== 'object') node[segment] = nextIsIndex ? [] : {};
    node = node[segment];
  });
  return clone;
};

const stringRows = (field, value) => splitEditableClauses(value).flatMap((clause, clauseIndex) => {
  const parsed = parseLabel(clause.text);
  const items = COMMA_SPLIT_PATHS.has(field) ? splitByComma(parsed.value) : [parsed.value];
  return items.filter(Boolean).map((item, itemIndex) => {
    const numbered = item.match(/^(\d+\.\s+)([\s\S]*)$/);
    return { clauseIndex, itemIndex, label: parsed.isLabeled ? parsed.label : '', prefix: numbered?.[1] || '', value: numbered?.[2] || item };
  });
});

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

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = base field name, e.g. "findings" / "results" / "recommendations") */
const DRAFT_KEY = 'urology_assessmentPendingEdits';
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
const UrologyAssessmentDocument = ({ document: docProp, data, templateData }) => {
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
      if (Array.isArray(r.wrapRecordsIntoSingleDocument)) return r.wrapRecordsIntoSingleDocument;
      if (Array.isArray(r.records || r._records)) return r.records || r._records;
      if (r.urology_assessment) return Array.isArray(r.urology_assessment) ? r.urology_assessment : [r.urology_assessment];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.urology_assessment) return Array.isArray(dd.urology_assessment) ? dd.urology_assessment : [dd.urology_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (!record?._id) ? null : (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id)));
      const recDrafts = rid ? store[rid] : null;
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
    let value = localEdits[k] !== undefined ? localEdits[k] : record[fn];
    const suffix = `-${idx}`;
    const prefix = `${fn}.`;
    Object.entries(localEdits).forEach(([editKey, editValue]) => {
      if (!editKey.endsWith(suffix)) return;
      const fieldPath = editKey.slice(0, -suffix.length);
      if (!fieldPath.startsWith(prefix)) return;
      value = setAtPath(value, fieldPath.slice(prefix.length).split('.'), editValue);
    });
    return value;
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
      const rt = `urology assessment ${idx + 1}`.toLowerCase();
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
      if (pendingEdits[key]) return;
      const match = key.match(/^(.+)-(\d+)$/);
      if (!match || parseInt(match[2], 10) !== idx) return;
      const fieldPath = match[1].split('.');
      const root = fieldPath.shift();
      merged[root] = fieldPath.length ? setAtPath(merged[root], fieldPath, localEdits[key]) : localEdits[key];
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
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* save a nested OBJECT leaf by dot-path (e.g. results.ef) — stage the whole merged rootField object
     as a DRAFT (no DB write). Approve commits field=rootField with the full object. */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${rootField}-${idx}`;
    const cur = localEdits[editKey] !== undefined ? localEdits[editKey] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    setLocalEdits(prev => ({ ...prev, [editKey]: clone }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][rootField] = clone;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, localEdits]);

  // Save one sentence = stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const stageDraft = (fullText) => {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
    };
    const editKey = `${fn}-${idx}`;
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      stageDraft(fullText);
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
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
    stageDraft(fullText);
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Pending keys for THIS record whose base field belongs to THIS section.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const base = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        return fields.includes(base);
      });
      // Persist each staged field to the DB now. arrayIndex ONLY when the trailing dot-segment is numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIdx = dotIdx !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(tail, 10);
        await secureApiClient.put(`/api/edit/urology_assessment/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/urology_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage (only the fields we just committed).
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fieldPart = k.slice(0, -suffix.length); const base = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart; delete store[id][fieldPart]; delete store[id][base]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[UrologyAssessment] Approve error:', err);
      setSaveError('Save failed. Please try again.');
    } finally { setSaving(false); }
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

  /* object -> stacked copy lines (recursive; never "Label: value") */
  const objectCopyLines = useCallback((label, value, path = []) => {
    const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) {
      const pathKey = path.join('.');
      const values = typeof value === 'string' ? stringRows(pathKey, value).map(row => row.value) : [fmtScalar(value)];
      if (label) out.push(label);
      out.push('-'.repeat(40));
      values.forEach((item, index) => out.push(`${index + 1}. ${item}`));
      return out;
    }
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (label) out.push(label);
      if (items.every(isScalar)) {
        out.push('-'.repeat(40));
        items.flatMap((item, index) => typeof item === 'string' ? stringRows(path.join('.'), item).map(row => row.value) : [fmtScalar(item)]).forEach((item, index) => out.push(`${index + 1}. ${item}`));
      } else items.forEach((item, index) => out.push(...objectCopyLines('', item, [...path, String(index)])));
      return out;
    }
    if (label) out.push(label);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([key, child]) => out.push(...objectCopyLines(humanizeKey(key), child, [...path, key])));
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
        const recs = Array.isArray(val) ? val : [];
        if (!sameAsTitle) text += `${label}\n`;
        let lastDate = null; let n = 1;
        recs.forEach((r) => {
          const rec = (r?.recommendation || '').trim();
          const date = (r?.date || '').trim();
          const normalizedDate = date ? (toInputDate(date) || date) : '';
          if (normalizedDate !== lastDate) { if (normalizedDate) text += `Date\n${'-'.repeat(40)}\n1. ${formatDate(normalizedDate)}\n`; lastDate = normalizedDate; n = 1; }
          text += `${n++}. ${rec}\n`;
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, [f, k]).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else if (DATE_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n`;
        text += `${'-'.repeat(40)}\n1. ${formatDate(val)}\n\n`;
      } else {
        const strVal = fmtVal(val);
        const rows = stringRows(f, strVal);
        if (!sameAsTitle) text += `${label}\n`;
        let activeLabel = null;
        let rowNumber = 0;
        rows.forEach(row => {
          if (row.label !== activeLabel) {
            activeLabel = row.label;
            rowNumber = 0;
            if (activeLabel) text += `${activeLabel}\n`;
            text += `${'-'.repeat(40)}\n`;
          }
          text += `${++rowNumber}. ${row.value}\n`;
        });
        text += '\n';
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== UROLOGY ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Urology Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD (per-sentence) ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const rows = stringRows(fn, strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const groups = [];
    rows.forEach(row => {
      const last = groups[groups.length - 1];
      if (last && last.label === row.label) last.rows.push(row);
      else groups.push({ label: row.label, rows: [row] });
    });

    const saveRow = (row, editKey) => {
      const clauses = splitEditableClauses(String(getFieldValue(record, fn, idx) || ''));
      const clause = clauses[row.clauseIndex];
      if (!clause) return;
      const parsed = parseLabel(clause.text);
      const items = COMMA_SPLIT_PATHS.has(fn) ? splitByComma(parsed.value) : [parsed.value];
      items[row.itemIndex] = `${row.prefix || ''}${editValue.trim()}`;
      clause.text = parsed.isLabeled ? `${parsed.label}: ${items.join(', ')}` : items.join(', ');
      handleSaveField(record, fn, idx, sid, reconstructClauses(clauses), editKey);
    };

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, groupIndex) => (
          <div key={`${group.label}-${groupIndex}`} className="nested-mini-card">
            {group.label && <div className="nested-subtitle sub-label">{highlightText(group.label)}</div>}
            {group.rows.map(row => {
              const editKey = `${fn}-${idx}-c${row.clauseIndex}-i${row.itemIndex}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];
              return (
                <div key={editKey} data-edit-field={fn}>
                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(row.value); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveRow(row, editKey); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRow(row, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : <><div className="row-content"><span className="content-value">{highlightText(row.value)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${group.label ? `${group.label}\n` : ''}${row.value}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, text -> textarea, "4/5" stays text) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const pathKey = `${rootField}.${path.join('.')}`;
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const rows = (!isBool && !ratio && !nu && typeof value === 'string') ? stringRows(pathKey, value) : [{ clauseIndex: 0, itemIndex: 0, label: '', value: leafValueString }];
    /* nested array element (path tail is a numeric index) -> no "0"/"1" index label */
    const leafSegment = path[path.length - 1];
    const isArrayItem = /^\d+$/.test(String(leafSegment));

    const saveRow = (row, leafKey) => {
      if (isBool) { saveLeaf(record, rootField, path, idx, sid, leafKey, editValue === 'Yes'); return; }
      if (ratio || nu) {
        const number = parseFloat(editValue);
        if (isNaN(number)) { setSaveError('Please enter a valid number'); return; }
        const nextValue = ratio ? `${number}/${ratio.denom}` : (nu.unit ? `${number}${nu.sep || ' '}${nu.unit}` : String(number));
        saveLeaf(record, rootField, path, idx, sid, leafKey, nextValue);
        return;
      }
      const clauses = splitEditableClauses(leafValueString);
      const clause = clauses[row.clauseIndex];
      if (!clause) return;
      const parsed = parseLabel(clause.text);
      const items = COMMA_SPLIT_PATHS.has(pathKey) ? splitByComma(parsed.value) : [parsed.value];
      items[row.itemIndex] = `${row.prefix || ''}${editValue.trim()}`;
      clause.text = parsed.isLabeled ? `${parsed.label}: ${items.join(', ')}` : items.join(', ');
      saveLeaf(record, rootField, path, idx, sid, leafKey, reconstructClauses(clauses));
    };

    return (
      <div key={leafSegment} className="nested-mini-card">
        {!isArrayItem && <div className="nested-subtitle sub-label">{highlightText(humanizeKey(leafSegment))}</div>}
        {rows.map(row => {
          const leafKey = `${rootField}-${idx}-${path.join('.')}-c${row.clauseIndex}-i${row.itemIndex}`;
          const isEditing = editingField === leafKey;
          const isModified = editedFields[leafKey];
          const editStartValue = isBool ? (value ? 'Yes' : 'No') : ratio ? ratio.num : nu ? nu.num : row.value;
          return (
            <div key={leafKey} data-edit-field={rootField}>
              {row.label && <div className="nested-subtitle sub-label">{highlightText(row.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    {isBool ? <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} /> : (ratio || nu) ? <div className="number-edit-row"><button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String((Number(editValue) || 0) - 1)); }}>−</button><input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String((Number(editValue) || 0) + 1)); }}>+</button>{ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}</div> : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRow(row, leafKey); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
                  </div>
                ) : <><div className="row-content"><span className="content-value">{highlightText(row.value)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${row.value}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button></>}
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
    /* nested array (e.g. cystoscopy.lesions) -> per-item editable leaves at path.N (no "0"/"1" labels) */
    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v]).filter(([, v]) => !isEmptyDeep(v))
      : Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
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
    const entries = Array.isArray(val)
      ? val.map((v, i) => [String(i), v]).filter(([, v]) => !isEmptyDeep(v))
      : Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
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
    const recs = Array.isArray(val) ? val.map((rec, rIdx) => ({ rec, rIdx })).filter(({ rec }) => hasVal(rec?.recommendation) || hasVal(rec?.date)) : [];
    if (recs.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();

    const groups = [];
    recs.forEach(({ rec, rIdx }) => {
      const d = rec?.date ? (toInputDate(rec.date) || String(rec.date).trim()) : '';
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
                const datePaths = group.items.map(({ rIdx }) => `${fn}.${rIdx}.date`);
                const dateKey = `${fn}-${idx}-date-${gIdx}`;
                const isEditing = editingField === dateKey;
                const isModified = editedFields[dateKey];
                return <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}><div className={`nested-subtitle date-subtitle editable-row ${isModified ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(dateKey); setEditValue(group.date); setSaveError(null); } }}>{isEditing ? <div className="edit-field-container"><BlueDatePicker value={editValue} onSelect={setEditValue} /><div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); datePaths.forEach(path => handleSaveField(record, path, idx, sid, `${editValue}T00:00:00.000Z`, `${path}-${idx}`)); }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div> : <><span className="content-value">{highlightText(formatDate(group.date))}</span><span className="edit-indicator">&#9998;</span></>}</div></div>;
              })()}
              {group.items.map(({ rec, rIdx }) => {
                const recText = (rec?.recommendation || '').trim();
                const recDate = (rec?.date || '').trim();
                const itemKey = `${fn}-${idx}-r${rIdx}`;
                const isEditing = editingField === itemKey;
                const badge = editedFields[itemKey];
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
                              handleSaveField(record, `${fn}.${rIdx}.recommendation`, idx, sid, editValue.trim(), itemKey);
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
      <div className="urology-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Urology Assessment</h2></div>
        <div className="empty-state">No urology assessment records available</div>
      </div>
    );
  }

  return (
    <div className="urology-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Urology Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<UrologyAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Urology_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search urology assessment records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Urology Assessment ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UrologyAssessmentDocument;
