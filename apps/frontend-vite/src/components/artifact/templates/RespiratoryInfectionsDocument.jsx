/**
 * RespiratoryInfectionsDocument.jsx
 * June 2026 — Blue glow editing theme. Collection: respiratory_infections
 *
 * 7 Sections:
 *   1. overview: date (date picker), type, provider, facility, status (narrative)
 *   2. current-infection: currentInfection (nested OBJECT — recursive display: type/pathogen/
 *        sputumCulture strings + antibioticSensitivity ARRAY of strings + treatment string)
 *   3. infection-history: recurrentInfections (ARRAY of objects — recursive display, each a card),
 *        pneumoniaHistory (array of strings → numbered editable rows)
 *   4. immunization-tb: immunizations (key-value OBJECT — recursive display), tuberculosisRisk (narrative)
 *   5. findings-plan: findings, assessment, plan, notes (narrative)
 *   6. results-section: results (key-value OBJECT — recursive display)
 *   7. recommendations-section: recommendations (array of {recommendation, date} — date-grouped editable)
 *
 * Object / array-of-object fields use exact-path editable recursive leaves (humanizeKey,
 * semantic nested-mini-card grouping, hide-empty at every level). All visible values are editable.
 * Persistence: staged local drafts, then exact-path commits via /api/edit/respiratory_infections/:id/edit.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import RespiratoryInfectionsDocumentPDFTemplate from '../pdf-templates/RespiratoryInfectionsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RespiratoryInfectionsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the field name, e.g. "status") */
const DRAFT_KEY = 'respiratory_infectionsPendingEdits';
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
  'overview': 'Overview',
  'current-infection': 'Current Infection',
  'infection-history': 'Infection History',
  'immunization-tb': 'Immunizations & TB Risk',
  'findings-plan': 'Findings & Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  currentInfection: 'Current Infection',
  recurrentInfections: 'Recurrent Infections',
  pneumoniaHistory: 'Pneumonia History',
  tuberculosisRisk: 'Tuberculosis Risk',
  immunizations: 'Immunizations',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  results: 'Results',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'overview': ['date', 'type', 'provider', 'facility', 'status'],
  'current-infection': ['currentInfection'],
  'infection-history': ['recurrentInfections', 'pneumoniaHistory'],
  'immunization-tb': ['immunizations', 'tuberculosisRisk'],
  'findings-plan': ['findings', 'assessment', 'plan', 'notes'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
};

const DATE_FIELDS = ['date'];
/* Narrative string fields → per-sentence editable */
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'tuberculosisRisk', 'findings', 'assessment', 'plan', 'notes'];
/* Object fields rendered through exact-path recursive editable leaves. */
const OBJECT_FIELDS = ['currentInfection', 'immunizations', 'results'];
/* Array-of-objects rendered through exact-path recursive editable leaves (each item a card). */
const OBJECT_ARRAY_DISPLAY_FIELDS = ['recurrentInfections'];
/* Array of strings → numbered editable rows */
const STRING_ARRAY_FIELDS = ['pneumoniaHistory'];
/* Array-of-objects {recommendation,date} → date-grouped editable */
const RECOMMENDATIONS_FIELDS = ['recommendations'];
const COMMA_FIELDS = ['status'];

/* ═══════ NUMBER+UNIT SPLIT (number+unit leaves edit as number input; ratios stay text) ═══════ */
const splitNumberUnit = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null; // ratio -> stays text
  const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(%|[A-Za-z]{1,8}(?:\/[A-Za-z]{1,8})?)?$/);
  if (!m || !/\d/.test(m[1])) return null;
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() };
};

/* ═══════ HUMANIZE ═══════ */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
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

const isDateString = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value);
const splitByComma = text => {
  const source = String(text || ''); const result = []; let current = ''; let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
const stepFor = value => String(value).includes('.') ? 0.1 : 1;
// Split narrative delimiters /[.;]\s+/: semicolons always split; periods retain abbreviation/number guards.
const splitSentencesRaw = text => String(text || '')
  .split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map(value => value.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter(value => value && !/^[;.,!?]+$/.test(value));
const splitTextRows = (fieldPath, value) => splitSentencesRaw(value).flatMap((sentence, sentenceIndex) => {
  const parts = COMMA_FIELDS.includes(fieldPath) ? splitByComma(sentence) : [sentence];
  return parts.map((text, partIndex) => ({ text, sentenceIndex, partIndex: parts.length > 1 ? partIndex : null }));
});

/* Recursive copy formatter: labels and values stay stacked; every scalar value is numbered. */
const buildCopyLines = (label, value, indent, fieldPath = '') => {
  const pad = '  '.repeat(indent); const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) {
    if (label) out.push(`${pad}${label}`);
    const display = isDateString(value) ? formatDate(value) : fmtScalar(value);
    const rows = typeof value === 'string' && !isDateString(value) ? splitTextRows(fieldPath, display) : [{ text: display }];
    rows.forEach((row, index) => out.push(`${pad}${index + 1}. ${row.text}`));
    return out;
  }
  if (Array.isArray(value)) {
    if (label) out.push(`${pad}${label}`);
    value.forEach((item, itemIndex) => {
      if (isEmptyDeep(item)) return;
      const itemPath = fieldPath ? `${fieldPath}.${itemIndex}` : String(itemIndex);
      if (isScalar(item)) {
        const display = isDateString(item) ? formatDate(item) : fmtScalar(item);
        const rows = typeof item === 'string' && !isDateString(item) ? splitTextRows(itemPath, display) : [{ text: display }];
        rows.forEach(row => out.push(`${pad}${itemIndex + 1}. ${row.text}`));
      } else {
        out.push(`${pad}Item ${itemIndex + 1}`);
        Object.entries(item).filter(([, child]) => !isEmptyDeep(child)).forEach(([key, child]) => out.push(...buildCopyLines(humanizeKey(key), child, indent + 1, `${itemPath}.${key}`)));
      }
    });
    return out;
  }
  if (label) out.push(`${pad}${label}`);
  Object.entries(value).filter(([, child]) => !isEmptyDeep(child)).forEach(([key, child]) => {
    const childPath = fieldPath ? `${fieldPath}.${key}` : key;
    out.push(...buildCopyLines(humanizeKey(key), child, indent + (label ? 1 : 0), childPath));
  });
  return out;
};

/* ═══════ COMPONENT ═══════ */
const RespiratoryInfectionsDocument = ({ document: docProp, data, templateData }) => {
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

  /* ═══════ DATA UNWRAP (3-prop) ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (r.respiratory_infections) return Array.isArray(r.respiratory_infections) ? r.respiratory_infections : [r.respiratory_infections];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.respiratory_infections) return Array.isArray(dd.respiratory_infections) ? dd.respiratory_infections : [dd.respiratory_infections]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idFor = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = idFor(record);
      const recDrafts = id ? store[id] : null;
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
    return splitSentencesRaw(text);
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

  const setNestedValue = useCallback(function setNestedValueRecursive(source, path, value) {
    if (!path.length) return value;
    const [head, ...tail] = path;
    const clone = Array.isArray(source) ? [...source] : { ...(source && typeof source === 'object' ? source : {}) };
    const key = /^\d+$/.test(String(head)) ? Number(head) : head;
    clone[key] = setNestedValueRecursive(clone[key], tail, value);
    return clone;
  }, []);
  const getNestedValue = useCallback((source, path) => String(path).split('.').reduce((value, key) => value?.[key], source), []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    let value = getNestedValue(record, fn);
    const suffix = `-${idx}`;
    Object.entries(localEdits).forEach(([editKey, editValue]) => {
      if (!editKey.endsWith(suffix)) return;
      const fieldPath = editKey.slice(0, -suffix.length);
      if (!fieldPath.startsWith(`${fn}.`)) return;
      value = setNestedValue(value, fieldPath.slice(fn.length + 1).split('.'), editValue);
    });
    return value;
  }, [localEdits, getNestedValue, setNestedValue]);

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

  /* field searchable text (handles all field shapes) */
  const fieldSearchText = useCallback((fn, val) => {
    if (RECOMMENDATIONS_FIELDS.includes(fn)) return recsToText(val);
    if (OBJECT_FIELDS.includes(fn) || OBJECT_ARRAY_DISPLAY_FIELDS.includes(fn) || STRING_ARRAY_FIELDS.includes(fn)) return flattenSearchable(val);
    return fmtVal(val);
  }, [recsToText, fmtVal]);

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
      const rt = `Respiratory Infections ${idx + 1}`.toLowerCase();
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
      const m = key.match(/^(.+)-(\d+)$/);
      if (m && parseInt(m[2]) === idx) {
        const [rootField, ...path] = m[1].split('.');
        if (path.length) merged[rootField] = setNestedValue(merged[rootField], path, localEdits[key]);
        else merged[rootField] = localEdits[key];
      }
    });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits, setNestedValue]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const stageDraft = useCallback((record, fn, idx, sid, saveVal) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sid) setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    stageDraft(record, fn, idx, sid, saveVal);
    setEditedFields(prev => ({ ...prev, [editTrackingKey || editKey]: 'edited' }));
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && (k.endsWith(`-${idx}`) || k.includes(`-${idx}-`)))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Collect exact staged paths for this section, including nested object/array leaves.
      const toCommit = Object.keys(localEdits).filter(k => {
        const suffix = `-${idx}`;
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        return fields.some(field => fieldPart === field || fieldPart.startsWith(`${field}.`));
      });
      for (const editKey of toCommit) {
        const m = editKey.match(/^(.+)-(\d+)$/);
        const fieldPart = m[1];
        const payload = { field: fieldPart, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/respiratory_infections/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/respiratory_infections/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { delete store[id][k.slice(0, -(`-${idx}`).length)]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && (k.endsWith(`-${idx}`) || k.includes(`-${idx}-`)))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[RespiratoryInfections] Approve error:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    if (sectionHasEdits(idx, sid)) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (approvedSections[`${sid}-${idx}`]) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${sameAsTitle ? '' : `${label}\n${'-'.repeat(40)}\n`}1. ${formatDate(val)}\n\n`;
      } else if (RECOMMENDATIONS_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val : [];
        if (!sameAsTitle) text += `${label}\n${'-'.repeat(40)}\n`;
        let lastDate = null; let n = 1;
        recs.forEach((r) => {
          const rec = (r?.recommendation || '').trim();
          const date = (r?.date || '').trim();
          if (date !== lastDate) { if (date) text += `${formatDate(date)}\n`; lastDate = date; n = 1; }
          text += `${n++}. ${rec}\n`;
        });
        text += '\n';
      } else if (STRING_ARRAY_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n${'-'.repeat(40)}\n`;
        buildCopyLines('', val, 0, f).forEach(line => { text += `${line}\n`; });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f) || OBJECT_ARRAY_DISPLAY_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n${'-'.repeat(40)}\n`;
        buildCopyLines('', val, 0, f).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (STRING_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n${'-'.repeat(40)}\n`;
        splitTextRows(f, fmtVal(val)).forEach((row, rowIndex) => { text += `${rowIndex + 1}. ${row.text}\n`; });
        text += '\n';
      } else {
        text += `${sameAsTitle ? '' : `${label}\n${'-'.repeat(40)}\n`}1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== RESPIRATORY INFECTIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Respiratory Infections ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  const saveTextRow = (record, fieldPath, idx, sid, row, trackKey) => {
    const currentSentences = splitBySentence(String(getFieldValue(record, fieldPath, idx) || ''));
    const currentSentence = currentSentences[row.sentenceIndex] || '';
    const parts = row.partIndex === null ? [currentSentence] : splitByComma(currentSentence);
    const cleanValue = editValue.replace(/[;.]+$/, '').trim();
    if (row.partIndex === null) parts[0] = cleanValue;
    else parts[row.partIndex] = cleanValue;
    currentSentences[row.sentenceIndex] = parts.join(', ');
    handleSaveField(record, fieldPath, idx, sid, reconstructFullText(currentSentences), trackKey);
  };

  /* Exact-path editable recursive leaf. A labeled leaf owns one mini-card; array siblings share one card. */
  const renderEditableLeaf = (record, rootField, path, idx, sid, value, label = '', framed = true) => {
    const fieldPath = [rootField, ...path].join('.');
    const currentValue = getFieldValue(record, fieldPath, idx);
    const rawValue = currentValue === undefined ? value : currentValue;
    const isBool = typeof rawValue === 'boolean';
    const isDate = !isBool && isDateString(rawValue);
    const numeric = typeof rawValue === 'number' ? { num: String(rawValue), sep: '', unit: '' } : (!isBool && !isDate ? splitNumberUnit(rawValue) : null);
    const displayValue = isDate ? formatDate(rawValue) : fmtScalar(rawValue);
    const rows = (!isBool && !isDate && !numeric) ? splitTextRows(fieldPath, displayValue) : [{ text: displayValue, sentenceIndex: 0, partIndex: null }];
    const leafContent = (
      <>
        {label && <div className="nested-subtitle sub-label">{highlightText(label)}</div>}
        {rows.map((row, rowIndex) => {
          const trackKey = `${fieldPath}-${idx}-r${rowIndex}`;
          const editKey = `${fieldPath}-${idx}-${rowIndex}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[trackKey];
          const step = numeric ? stepFor(numeric.num) : 1;
          const parsed = Number.parseFloat(editValue);
          const safeNumber = Number.isFinite(parsed) ? parsed : 0;
          const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
          const stepValue = direction => setEditValue(String(Number((safeNumber + direction * step).toFixed(decimals))));
          return (
            <div key={`${fieldPath}-${rowIndex}`} data-edit-field={fieldPath}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isBool ? (rawValue ? 'Yes' : 'No') : isDate ? toInputDate(rawValue) : numeric ? numeric.num : row.text); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    {isBool ? (
                      <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
                    ) : isDate ? (
                      <BlueDatePicker value={editValue} onSelect={setEditValue} />
                    ) : numeric ? (
                      <div className="number-edit-row">
                        <div className="num-stepper-row">
                          <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepValue(-1); }}>−</button>
                          <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onClick={event => event.stopPropagation()} onChange={event => setEditValue(event.target.value)} />
                          <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepValue(1); }}>+</button>
                        </div>
                        {numeric.unit && <span className="number-edit-unit">{numeric.unit}</span>}
                      </div>
                    ) : (
                      <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    )}
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={event => {
                        event.stopPropagation();
                        if (isBool) { handleSaveField(record, fieldPath, idx, sid, editValue === 'Yes', trackKey); return; }
                        if (isDate) { if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fieldPath, idx, sid, editValue, trackKey); return; }
                        if (numeric) { const numberValue = Number.parseFloat(editValue); if (!Number.isFinite(numberValue)) { setSaveError('Please enter a valid number'); return; } const saved = typeof rawValue === 'number' ? numberValue : numeric.unit ? `${numberValue}${numeric.sep || ' '}${numeric.unit}` : String(numberValue); handleSaveField(record, fieldPath, idx, sid, saved, trackKey); return; }
                        saveTextRow(record, fieldPath, idx, sid, row, trackKey);
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(row.text)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(row.text, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </>
    );
    return framed ? <div key={fieldPath} className="nested-mini-card">{leafContent}</div> : <React.Fragment key={fieldPath}>{leafContent}</React.Fragment>;
  };

  const renderObjectNode = (record, rootField, path, idx, sid, value, label = '') => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderEditableLeaf(record, rootField, path, idx, sid, value, label, true);
    if (Array.isArray(value)) {
      const items = value.map((item, itemIndex) => [itemIndex, item]).filter(([, item]) => !isEmptyDeep(item));
      if (!items.length) return null;
      const allScalar = items.every(([, item]) => isScalar(item));
      if (allScalar) return (
        <div className="nested-mini-card" key={`${rootField}-${path.join('.')}`}>
          {label && <div className="nested-subtitle sub-label">{highlightText(label)}</div>}
          {items.map(([itemIndex, item]) => renderEditableLeaf(record, rootField, [...path, String(itemIndex)], idx, sid, item, '', false))}
        </div>
      );
      return (
        <div className="nested-group" key={`${rootField}-${path.join('.')}`}>
          {label && <div className="nested-subtitle sub-label">{highlightText(label)}</div>}
          {items.map(([itemIndex, item]) => (
            <div className="nested-mini-card object-item-card" key={itemIndex}>
              <div className="nested-subtitle sub-label">{`Item ${itemIndex + 1}`}</div>
              {Object.entries(item).filter(([, child]) => !isEmptyDeep(child)).map(([key, child]) => renderObjectNode(record, rootField, [...path, String(itemIndex), key], idx, sid, child, humanizeKey(key)))}
            </div>
          ))}
        </div>
      );
    }
    const entries = Object.entries(value).filter(([, child]) => !isEmptyDeep(child));
    if (!entries.length) return null;
    return (
      <div className="nested-mini-card" key={`${rootField}-${path.join('.')}`}>
        {label && <div className="nested-subtitle sub-label">{highlightText(label)}</div>}
        {entries.map(([key, child]) => renderObjectNode(record, rootField, [...path, key], idx, sid, child, humanizeKey(key)))}
      </div>
    );
  };

  const renderDisplayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {Array.isArray(val)
          ? renderObjectNode(record, fn, [], idx, sid, val, '')
          : Object.entries(val).filter(([, child]) => !isEmptyDeep(child)).map(([key, child]) => renderObjectNode(record, fn, [key], idx, sid, child, humanizeKey(key)))}
      </div>
    );
  };

  /* ═══════ RENDER: DATE FIELD ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card" data-edit-field={fn}>
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
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
    const rows = splitTextRows(fn, strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card regular-row-group">
          {rows.map((row, rowIndex) => {
            const rowKey = `${fn}-${idx}-s${row.sentenceIndex}${row.partIndex === null ? '' : `-c${row.partIndex}`}`;
            const isEditing = editingField === rowKey;
            const badge = editedFields[rowKey] || editedSentences[rowKey];
            return (
              <div key={`${row.sentenceIndex}-${rowIndex}`} data-edit-field={fn}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(row.text); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); saveTextRow(record, fn, idx, sid, row, rowKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY OF STRINGS (numbered editable rows) ═══════ */
  const renderStringArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val : [];
    const indexed = []; items.forEach((it, oi) => { if (hasVal(it)) indexed.push([oi, it]); });
    if (indexed.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card regular-row-group">
          {indexed.map(([itemIndex, item]) => renderEditableLeaf(record, fn, [String(itemIndex)], idx, sid, item, '', false))}
        </div>
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
    const groups = [];
    recs.forEach((rec, rIdx) => {
      const datePath = `${fn}.${rIdx}.date`;
      const dateValue = getFieldValue(record, datePath, idx) ?? rec?.date ?? '';
      const dateKey = toInputDate(dateValue) || 'no-date';
      const last = groups[groups.length - 1];
      if (last && last.dateKey === dateKey) last.items.push({ rec, rIdx, datePath, dateValue });
      else groups.push({ dateKey, items: [{ rec, rIdx, datePath, dateValue }] });
    });

    const saveGroupDate = (datePaths, value) => {
      const saved = value ? `${value}T00:00:00.000Z` : '';
      datePaths.forEach(path => stageDraft(record, path, idx, sid, saved));
      setEditedFields(prev => ({ ...prev, ...Object.fromEntries(datePaths.map(path => [`${path}-${idx}-date`, 'edited'])) }));
      setEditingField(null); setEditValue(''); setSaveError(null);
    };

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, groupIndex) => {
          const datePaths = group.dateKey === 'no-date' ? [] : group.items.map(item => item.datePath);
          const dateEditKey = `${fn}-date-group-${groupIndex}-${idx}`;
          const isDateEditing = editingField === dateEditKey;
          return (
            <div key={`${group.dateKey}-${groupIndex}`} className="nested-mini-card recommendation-group">
              {group.dateKey !== 'no-date' && (
                <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
                  <div className="nested-subtitle date-subtitle editable-row" onClick={() => { if (!isDateEditing) { setEditingField(dateEditKey); setEditValue(group.dateKey); setSaveError(null); } }}>
                    {isDateEditing ? (
                      <div className="edit-field-container">
                        <BlueDatePicker value={editValue} onSelect={setEditValue} />
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); saveGroupDate(datePaths, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : <><span className="content-value">{highlightText(formatDate(group.items[0].dateValue))}</span><span className="edit-indicator">&#9998;</span></>}
                  </div>
                </div>
              )}
              {group.items.map(({ rec, rIdx }) => {
                const recommendationPath = `${fn}.${rIdx}.recommendation`;
                const recommendationValue = getFieldValue(record, recommendationPath, idx) ?? rec?.recommendation ?? '';
                return hasVal(recommendationValue) ? renderEditableLeaf(record, fn, [String(rIdx), 'recommendation'], idx, sid, recommendationValue, '', false) : null;
              })}
                    </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: SECTION ═══════ */
  const renderField = (record, f, idx, sid) => {
    if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
    if (RECOMMENDATIONS_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
    if (STRING_ARRAY_FIELDS.includes(f)) return renderStringArrayField(record, f, idx, sid);
    if (OBJECT_FIELDS.includes(f) || OBJECT_ARRAY_DISPLAY_FIELDS.includes(f)) return renderDisplayField(record, f, idx, sid);
    return renderStringField(record, f, idx, sid);
  };

  const renderSection = (record, idx, sid) => {
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => renderField(record, f, idx, sid))}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="respiratory-infections-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Respiratory Infections</h2></div>
        <div className="empty-state">No respiratory infections records available</div>
      </div>
    );
  }

  return (
    <div className="respiratory-infections-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Respiratory Infections</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RespiratoryInfectionsDocumentPDFTemplate document={pdfData} />} fileName="Respiratory_Infections.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search respiratory infections..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><h3 className="record-name">{highlightText(`Respiratory Infections ${idx + 1}`)}</h3></div>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RespiratoryInfectionsDocument;
