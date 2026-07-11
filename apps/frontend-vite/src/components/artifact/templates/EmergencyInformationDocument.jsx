/**
 * EmergencyInformationDocument.jsx
 * June 2026 — Emergency Information (unified blue-glow mini-card theme + full INLINE EDITING + hide-empty).
 * Data collection: emergency_information
 * Edit route: emergency_information
 *
 * 7 Sections (covering all 16 extractable fields, none added):
 *   1. contacts:          emergencyContacts (ARRAY OF OBJECTS — nested-mini-card per item)
 *   2. numbers:           officePhone, afterHoursPhone
 *   3. provider:          provider, facility, type, status, date
 *   4. whentocall:        whenToCall (array of strings)
 *   5. warning:           warningCriteria (array of strings)
 *   6. findings:          findings, assessment, results
 *   7. plan:              plan, recommendations, notes
 *
 * Field handling:
 *   - DATE             → header badge + click-to-edit date input
 *   - SIMPLE STRINGS   → click-to-edit textarea (renderEditableField)
 *   - NARRATIVE STRINGS→ per-sentence editing (renderSentenceEditableField)
 *   - ARRAYS OF STRINGS→ per-item editing with arrayIndex
 *   - ARRAY OF OBJECTS → recursive nested-mini-card; scalar leaves editable via dot-path
 *
 * hide-empty everywhere (isEmptyDeep / fieldHasVal). NO "-" placeholder anywhere.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EmergencyInformationDocumentPDFTemplate from '../pdf-templates/EmergencyInformationDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BluePhonePicker from '../components/BluePhonePicker';
import secureApiClient from '../../../services/secureApiClient';
import './EmergencyInformationDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  contacts: 'Emergency Contacts',
  numbers: 'Contact Numbers',
  provider: 'Provider & Facility',
  whentocall: 'When to Call',
  warning: 'Warning Criteria',
  findings: 'Findings & Assessment',
  plan: 'Plan & Recommendations',
};

const SECTION_ORDER = ['contacts', 'numbers', 'provider', 'whentocall', 'warning', 'findings', 'plan'];

const FIELD_LABELS = {
  emergencyContacts: 'Emergency Contacts',
  officePhone: 'Office Phone',
  afterHoursPhone: 'After-Hours Phone',
  provider: 'Provider',
  facility: 'Facility',
  type: 'Type',
  status: 'Status',
  date: 'Date',
  whenToCall: 'When to Call',
  warningCriteria: 'Warning Criteria',
  findings: 'Findings',
  assessment: 'Assessment',
  results: 'Results',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  contacts: ['emergencyContacts'],
  numbers: ['officePhone', 'afterHoursPhone'],
  provider: ['provider', 'facility', 'type', 'status', 'date'],
  whentocall: ['whenToCall'],
  warning: ['warningCriteria'],
  findings: ['findings', 'assessment', 'results'],
  plan: ['plan', 'recommendations', 'notes'],
};

const DATE_FIELDS = ['date'];
const SIMPLE_STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'officePhone', 'afterHoursPhone', 'results'];
const NARRATIVE_STRING_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const ARRAY_FIELDS = ['whenToCall', 'warningCriteria', 'recommendations'];
const OBJECT_ARRAY_FIELDS = ['emergencyContacts'];
const PHONE_FIELDS = ['phone', 'officePhone', 'afterHoursPhone', 'fax', 'mobile', 'cell', 'telephone', 'phoneNumber'];

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = scalar field, "field.arrayIndex",
   or a dot-path leaf for nested objects e.g. "emergencyContacts.0.name") */
const DRAFT_KEY = 'emergency_informationPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ VALUE HELPERS (hide-empty) ═══════ */
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

/* 1970-epoch / invalid date guard */
const isEmptyDate = (v) => {
  if (isEmptyDeep(v)) return true;
  const d = new Date(v.$date || v);
  if (isNaN(d.getTime())) return true;
  if (d.getTime() <= 0 || d.getUTCFullYear() <= 1970) return true;
  return false;
};

const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const deepClone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const setByPath = (obj, pathArr, val) => { let cur = obj; for (let i = 0; i < pathArr.length - 1; i++) cur = cur[pathArr[i]]; cur[pathArr[pathArr.length - 1]] = val; };

const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

const formatDate = (dateValue) => {
  if (isEmptyDate(dateValue)) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};
const toDateInputValue = (dateValue) => {
  if (isEmptyDate(dateValue)) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* parseLabel: detect "Label: value" patterns inside array items */
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

/* copy-text builder for nested objects (emergencyContacts) */
const buildCopyLines = (label, value, indent) => {
  const pad = '  '.repeat(indent); const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
  if (Array.isArray(value)) {
    value.filter(x => !isEmptyDeep(x)).forEach(item => {
      if (isScalar(item)) out.push(`${pad}${fmtScalar(item)}`);
      else { const e = Object.entries(item).filter(([, v]) => !isEmptyDeep(v)); if (!e.length) return; const head = isScalar(e[0][1]) ? fmtScalar(e[0][1]) : ''; if (head) { out.push(`${pad}${head}`); e.slice(1).forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + 1))); } else e.forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + 1))); }
    });
    return out;
  }
  if (label) out.push(`${pad}${label}:`);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
  return out;
};

/* ═══════ COMPONENT ═══════ */
const EmergencyInformationDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});      // scalar/array/nested leaf edits
  const [editedSentences, setEditedSentences] = useState({}); // narrative: `${fn}-${idx}-s${i}`
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP (3-prop) ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (r.emergency_information) return Array.isArray(r.emergency_information) ? r.emergency_information : [r.emergency_information];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.emergency_information) return Array.isArray(dd.emergency_information) ? dd.emergency_information : [dd.emergency_information]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     fieldPart forms: "field" (scalar/array whole), "field.N" (array element), or a dot-path leaf
     like "emergencyContacts.0.name" (nested object). We reconstruct localEdits + the same markers
     each save handler sets, so the UI shows "edited / Pending Approve" exactly as after a manual Save. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = recId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIndex = lastDot !== -1 && /^\d+$/.test(trailing);
        if (isArrayIndex) {
          // array element: localEdits keyed by base field holding the whole array; marker `${fn}-${idx}-i${n}`
          const fn = fieldPart.slice(0, lastDot);
          const aIdx = parseInt(trailing, 10);
          const cur = nLocal[`${fn}-${idx}`] !== undefined ? nLocal[`${fn}-${idx}`] : record[fn];
          const arr = Array.isArray(cur) ? [...cur] : [];
          arr[aIdx] = value;
          nLocal[`${fn}-${idx}`] = arr;
          nPending[`${fn}-${idx}`] = true;
          nFields[`${fn}-${idx}-i${aIdx}`] = 'edited';
        } else if (lastDot !== -1) {
          // nested object dot-path leaf (e.g. emergencyContacts.0.name)
          const fn = fieldPart.split('.')[0];
          const subPath = fieldPart.split('.').slice(1);
          const base = nLocal[`${fn}-${idx}`] !== undefined ? nLocal[`${fn}-${idx}`] : record[fn];
          const clone = base === undefined ? undefined : JSON.parse(JSON.stringify(base));
          if (clone !== undefined) {
            try { setByPath(clone, subPath, value); nLocal[`${fn}-${idx}`] = clone; } catch { /* ignore */ }
          }
          nPending[`${fn}-${idx}`] = true;
          nFields[`${fieldPart}@@${idx}`] = 'edited';
        } else {
          // scalar / narrative / array-whole field
          nLocal[`${fieldPart}-${idx}`] = value;
          nPending[`${fieldPart}-${idx}`] = true;
          nFields[`${fieldPart}-${idx}`] = 'edited';
          if (NARRATIVE_STRING_FIELDS.includes(fieldPart)) nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0 && Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const fieldHasVal = useCallback((fn, v) => {
    if (DATE_FIELDS.includes(fn)) return !isEmptyDate(v);
    return !isEmptyDeep(v);
  }, []);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).split(regex).map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/)
      // A leading conditional clause's colon is grammatical, not a Label:Value delimiter — drop it (memory 6a4cb55c).
      .map(s => s.trim().replace(/^((?:If|When|While|Unless|Until|Once|Whenever|Should|In case|As needed)\b[^:]{0,60}?):\s+/i, '$1 '))
      .filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

  /* display string for a field */
  const fieldDisplay = useCallback((fn, val) => {
    if (DATE_FIELDS.includes(fn)) return formatDate(val);
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(val) ? val.join(', ') : String(val ?? '');
    if (OBJECT_ARRAY_FIELDS.includes(fn)) return flattenSearchable(val);
    return fmtScalar(val);
  }, []);

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (fieldHasVal(fn, val)) return fieldDisplay(fn, val).toLowerCase().includes(phrase);
    return false;
  }, [searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    if ((SECTION_TITLES[sid] || '').toLowerCase().includes(phrase) || phrase.includes((SECTION_TITLES[sid] || '').toLowerCase())) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (fieldHasVal(f, val) && fieldDisplay(f, val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `emergency information ${idx + 1}`;
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (fieldHasVal(f, val) && fieldDisplay(f, val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => filteredRecords.map((record, idx) => {
    const merged = { ...record };
    Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; /* pending drafts stay OUT of PDF/Copy All until approved */ const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key]; });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleStartEdit = (field, idx, val) => {
    setEditingField(`${field}-${idx}`);
    setEditValue(val);
    setSaveError(null);
  };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, field, idx, sectionId, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${field}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][field] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* array item edit — uses arrayIndex */
  const handleSaveArrayItem = useCallback((record, field, idx, sectionId, arrayIndex, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const cur = getFieldValue(record, field, idx);
    const currentArr = Array.isArray(cur) ? [...cur] : [];
    setSaveError(null);
    currentArr[arrayIndex] = saveVal;
    // Stage as a DRAFT (no DB write). fieldPart "field.arrayIndex" so Approve can rebuild field+arrayIndex.
    setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [`${field}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}-i${arrayIndex}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${field}.${arrayIndex}`] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue]);

  /* nested scalar LEAF (dot-path save) — emergencyContacts */
  const saveLeaf = useCallback((record, path, idx, sid, newVal) => {
    const recordId = safeId(record); if (!recordId) return;
    const fn = path[0]; const subPath = path.slice(1);
    if (subPath.length === 0) return;
    const clone = deepClone(getFieldValue(record, fn, idx));
    try { setByPath(clone, subPath, newVal); } catch (e) { console.error('[EmergencyInformation] setByPath failed', e); setSaveError('Save failed.'); return; }
    const dotField = path.join('.');
    const editKey = `${dotField}@@${idx}`;
    setSaveError(null);
    // Stage as a DRAFT (no DB write). fieldPart is the dot-path so Approve can PUT the same dotField.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: clone }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][dotField] = newVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, getFieldValue]);

  /* narrative per-sentence save */
  function saveSentence(record, field, idx, sectionId, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, field, idx) || '');
    const allCurrent = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const updated = [...allCurrent];
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) updated.splice(sentenceIdx, 1);
    else updated.splice(sentenceIdx, 1, ...splitBySentence(editedVal));
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits the whole field.
    setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${field}-${idx}`]: true }));
    setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith(`${field}-${idx}-s`)) delete n[k]; }); n[`${field}-${idx}-s${sentenceIdx}`] = 'edited'; return n; });
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][field] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => {
      // dot-path nested leaf edits: `${f}.x.y@@${idx}` or `${f}@@${idx}`
      const nested = Object.keys(editedFields).some(k => {
        const [dot, kIdx] = k.split('@@');
        return kIdx === String(idx) && (dot === f || dot.startsWith(`${f}.`));
      });
      // scalar / array-item edits: `${f}-${idx}` or `${f}-${idx}-i${n}`
      const flat = Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`));
      const sent = Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`));
      return nested || flat || sent;
    });
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Collect this record's staged drafts whose base field belongs to this section.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const toCommit = Object.keys(recDrafts).filter(fieldPart => {
        const base = fieldPart.split('.')[0];
        return fields.includes(base);
      });
      // Persist each staged draft to the DB now.
      for (const fieldPart of toCommit) {
        const value = recDrafts[fieldPart];
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value };
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          // array element: "field.N" → field + arrayIndex
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(trailing, 10);
        } else {
          // scalar / narrative / array-whole / nested dot-path (sent as-is)
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/emergency_information/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/emergency_information/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => { const n = { ...prev }; fields.forEach(f => { delete n[`${f}-${idx}`]; }); return n; });
      // Drop this section's drafts from localStorage (now committed).
      if (toCommit.length > 0) {
        toCommit.forEach(fp => { delete recDrafts[fp]; });
        if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { const dot = k.split('@@')[0]; fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || dot === f || dot.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[EmergencyInformation] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId]);

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
    const fields = SECTION_FIELDS[sid] || [];
    const present = fields.filter(f => fieldHasVal(f, getFieldValue(record, f, idx)));
    if (present.length === 0) return '';
    const DASH = '-'.repeat(40);
    const title = (SECTION_TITLES[sid] || '').toUpperCase();
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    present.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        text += `${label}\n${DASH}\n`;
        buildCopyLines('', val, 0).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
        text += `${label}\n${DASH}\n`;
        items.forEach((item, i) => { const p = parseLabel(String(item)); text += `${i + 1}. ${p.value || item}\n`; });
        text += '\n';
      } else if (NARRATIVE_STRING_FIELDS.includes(f)) {
        const strVal = fieldDisplay(f, val);
        const sentences = splitBySentence(strVal);
        text += `${label}\n${DASH}\n`;
        (sentences.length > 1 ? sentences : [strVal]).forEach((s, i) => { text += `${i + 1}. ${s}\n`; });
        text += '\n';
      } else {
        text += `${label}\n${DASH}\n1. ${fieldDisplay(f, val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, fieldHasVal, fieldDisplay, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== EMERGENCY INFORMATION ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Emergency Information ${idx + 1}\n${'='.repeat(40)}\n`;
      if (!isEmptyDate(r.date)) text += `${formatDate(r.date)}\n`;
      text += '\n';
      SECTION_ORDER.forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: SIMPLE EDITABLE STRING FIELD (textarea) ═══════ */
  const renderEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const strVal = fmtScalar(val);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, strVal); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: PHONE FIELD (BluePhonePicker) ═══════ */
  const renderPhoneField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtScalar(val);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, displayVal); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BluePhonePicker value={editValue} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: DATE FIELD (date input) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, toDateInputValue(val)); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso || '')} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (!editValue) { setSaveError('Please select a date'); return; } handleSaveField(record, fn, idx, sid, new Date(editValue).toISOString()); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY OF STRINGS — per-item editing with arrayIndex ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rawArr = Array.isArray(val) ? val : splitByComma(String(val));
    const items = rawArr.filter(x => !isEmptyDeep(x));
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    const showFieldLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();

    return (
      <div key={fn} className="rec-mini-card">
        {showFieldLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, aIdx) => {
          const parsed = parseLabel(String(item));
          const itemVal = parsed.value || String(item);
          const itemKey = `${fn}-${idx}-i${aIdx}`;
          const isEditing = editingField === itemKey;
          const isModified = editedFields[itemKey];
          const itemMatches = phraseMatch || labelMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;

          const valueRow = (
            <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(String(item)); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, sid, aIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row-content"><span className="content-value">{highlightText(itemVal)}</span><span className="edit-indicator">&#9998;</span></div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </>
              )}
            </div>
          );

          // Labeled item ("FEVER: Go to ED") → nested-mini-card: label heading on its own line + value in its own row box
          if (parsed.isLabeled) {
            return (
              <div key={aIdx} className="nested-mini-card">
                <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                {valueRow}
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          }
          // Plain item → just the value row
          return (
            <div key={aIdx}>
              {valueRow}
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: NARRATIVE FIELD — per-sentence editing ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const strVal = fmtScalar(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rows = sentences.length > 1 ? sentences : [strVal];
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {rows.map((sentence, sIdx) => {
          const sentenceKey = `${fn}-${idx}-s${sIdx}`;
          const isEditing = editingField === sentenceKey;
          const badge = editedSentences[sentenceKey] || (rows.length === 1 && editedFields[`${fn}-${idx}`]);
          const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!sentenceMatches && searchTerm.trim()) return null;

          return (
            <div key={sIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit2(fn, idx, sentence.replace(/[;.]+$/, '').trim(), sIdx); }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* start-edit helper for per-sentence rows */
  const handleStartEdit2 = (field, idx, val, sentenceIdx) => {
    setEditingField(`${field}-${idx}-s${sentenceIdx}`);
    setEditValue(val);
    setSaveError(null);
  };

  /* ═══════ RENDER: emergencyContacts — recursive nested-mini-card per contact ═══════ */
  const editCell = (record, value, path, idx, sid) => {
    const editKey = `${path.join('.')}@@${idx}`;
    const isEditing = editingField === editKey;
    const display = fmtScalar(value);
    const modified = editedFields[editKey] === 'edited';
    const isPhone = PHONE_FIELDS.includes(path[path.length - 1]);
    const startEdit = () => { if (!isEditing) { setEditingField(editKey); setEditValue(display); setSaveError(null); } };
    if (isEditing) {
      return (
        <div className="numbered-row" key={editKey}>
          <div className="edit-field-container">
            {isPhone
              ? <BluePhonePicker value={editValue} onChange={v => setEditValue(v)} />
              : <textarea className="edit-textarea" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLeaf(record, path, idx, sid, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={`numbered-row editable-row ${modified ? 'modified' : ''}`} key={editKey} onClick={startEdit}>
        <div className="row-content"><span className="content-value">{highlightText(display)}</span><span className="edit-indicator">&#9998;</span></div>
        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(display, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
      </div>
    );
  };

  const renderObjectArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid) && !record._showAllSections) return null;
    const arr = Array.isArray(val) ? val : [];
    const indexed = []; arr.forEach((it, oi) => { if (!isEmptyDeep(it)) indexed.push([oi, it]); });
    if (indexed.length === 0) return null;

    return (
      <React.Fragment key={fn}>
        {indexed.map(([oi, item]) => {
          if (isScalar(item)) {
            return <div className="rec-mini-card" key={oi}>{editCell(record, item, [fn, oi], idx, sid)}</div>;
          }
          const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
          if (entries.length === 0) return null;
          const headScalar = isScalar(entries[0][1]);
          const rest = headScalar ? entries.slice(1) : entries;
          if (headScalar && rest.length === 0) {
            return <div className="rec-mini-card" key={oi}>{editCell(record, entries[0][1], [fn, oi, entries[0][0]], idx, sid)}</div>;
          }
          return (
            <div className="rec-mini-card" key={oi}>
              {entries.map(([k, v]) => (
                <div className="nested-mini-card" key={k}>
                  <div className="nested-subtitle sub-label">{highlightText(humanizeKey(k))}</div>
                  {isScalar(v)
                    ? editCell(record, v, [fn, oi, k], idx, sid)
                    : <div className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(flattenSearchable(v))}</span></div></div>}
                </div>
              ))}
            </div>
          );
        })}
      </React.Fragment>
    );
  };

  /* ═══════ FIELD DISPATCH ═══════ */
  const renderField = (record, fn, idx, sid) => {
    if (DATE_FIELDS.includes(fn)) return renderDateField(record, fn, idx, sid);
    if (PHONE_FIELDS.includes(fn)) return renderPhoneField(record, fn, idx, sid);
    if (OBJECT_ARRAY_FIELDS.includes(fn)) return renderObjectArrayField(record, fn, idx, sid);
    if (ARRAY_FIELDS.includes(fn)) return renderArrayField(record, fn, idx, sid);
    if (NARRATIVE_STRING_FIELDS.includes(fn)) return renderSentenceEditableField(record, fn, idx, sid);
    return renderEditableField(record, fn, idx, sid);
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => fieldHasVal(f, getFieldValue(record, f, idx)));
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
          {fields.map(f => renderField(record, f, idx, sid))}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="emergency-information-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Emergency Information</h2></div>
        <div className="empty-state">No emergency information records available</div>
      </div>
    );
  }

  return (
    <div className="emergency-information-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Emergency Information</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EmergencyInformationDocumentPDFTemplate document={pdfData} />} fileName="Emergency_Information.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search emergency information..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const title = `Emergency Information ${idx + 1}`;
          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                {!isEmptyDate(record.date) && (<div className="record-meta-row"><span className="record-date">{highlightText(formatDate(record.date))}</span></div>)}
                <h3 className="record-name">{highlightText(title)}</h3>
              </div>
              {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmergencyInformationDocument;
