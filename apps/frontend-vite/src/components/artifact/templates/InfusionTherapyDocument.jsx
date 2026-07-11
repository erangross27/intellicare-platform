/**
 * InfusionTherapyDocument.jsx
 * June 2026 — Infusion Therapy (unified flat schema)
 * Data collection: infusion_therapy
 * Edit route: infusion_therapy
 *
 * 5 Sections (covering all 25 extractable fields, none added):
 *   1. infusion:        infusionMedication, infusionDose, infusionRate, infusionDuration,
 *                       totalVolumeAdministered, diluentSolution, infusionPumpType, infusionProtocol
 *   2. vascular-access: vascularAccessType, vascularAccessSite, vascularAccessGauge
 *   3. vitals-labs:     preInfusionVitalSigns, postInfusionVitalSigns, patientWeight, bodyMassIndex,
 *                       estimatedGlomerularFiltrationRate, laboratoryMonitoring
 *   4. safety:          premedications, allergyScreening, concurrentMedications,
 *                       infusionComplications, infusionTolerability
 *   5. clinical-timing: therapeuticIndication, infusionStartTime, infusionEndTime
 *
 * Field handling:
 *   - SIMPLE STRINGS → click-to-edit textarea (renderEditableField)
 *   - NARRATIVE STRINGS → per-sentence editing (renderSentenceEditableField)
 *   - DATE/DATETIME → formatted; epoch/null hidden; time-bearing values edited
 *     losslessly with a datetime-local picker, date-only with a date picker (renderDateField)
 *   - ARRAYS OF STRINGS → per-item editing with arrayIndex
 *
 * Header: infusionStartTime shown as date badge if present.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import InfusionTherapyDocumentPDFTemplate from '../pdf-templates/InfusionTherapyDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './InfusionTherapyDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'infusion_therapyPendingEdits';
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
  'infusion': 'Infusion',
  'vascular-access': 'Vascular Access',
  'vitals-labs': 'Vitals & Labs',
  'safety': 'Safety',
  'clinical-timing': 'Clinical & Timing',
};

const FIELD_LABELS = {
  infusionMedication: 'Infusion Medication',
  infusionDose: 'Infusion Dose',
  infusionRate: 'Infusion Rate',
  infusionDuration: 'Infusion Duration',
  totalVolumeAdministered: 'Total Volume Administered',
  diluentSolution: 'Diluent Solution',
  infusionPumpType: 'Infusion Pump Type',
  infusionProtocol: 'Infusion Protocol',
  vascularAccessType: 'Vascular Access Type',
  vascularAccessSite: 'Vascular Access Site',
  vascularAccessGauge: 'Vascular Access Gauge',
  preInfusionVitalSigns: 'Pre-Infusion Vital Signs',
  postInfusionVitalSigns: 'Post-Infusion Vital Signs',
  patientWeight: 'Patient Weight',
  bodyMassIndex: 'Body Mass Index',
  estimatedGlomerularFiltrationRate: 'Estimated Glomerular Filtration Rate',
  laboratoryMonitoring: 'Laboratory Monitoring',
  premedications: 'Premedications',
  allergyScreening: 'Allergy Screening',
  concurrentMedications: 'Concurrent Medications',
  infusionComplications: 'Infusion Complications',
  infusionTolerability: 'Infusion Tolerability',
  therapeuticIndication: 'Therapeutic Indication',
  infusionStartTime: 'Infusion Start Time',
  infusionEndTime: 'Infusion End Time',
};

const SECTION_FIELDS = {
  'infusion': ['infusionMedication', 'infusionDose', 'infusionRate', 'infusionDuration', 'totalVolumeAdministered', 'diluentSolution', 'infusionPumpType', 'infusionProtocol'],
  'vascular-access': ['vascularAccessType', 'vascularAccessSite', 'vascularAccessGauge'],
  'vitals-labs': ['preInfusionVitalSigns', 'postInfusionVitalSigns', 'patientWeight', 'bodyMassIndex', 'estimatedGlomerularFiltrationRate', 'laboratoryMonitoring'],
  'safety': ['premedications', 'allergyScreening', 'concurrentMedications', 'infusionComplications', 'infusionTolerability'],
  'clinical-timing': ['therapeuticIndication', 'infusionStartTime', 'infusionEndTime'],
};

// Narrative strings → per-sentence editing (renderSentenceEditableField)
const NARRATIVE_STRING_FIELDS = ['therapeuticIndication', 'infusionProtocol'];
// Schema-typed Date fields. infusionStartTime/infusionEndTime can carry a time
// component (e.g. "2026-02-09T10:00:00") — when present it must be preserved
// losslessly via a datetime-local picker rather than truncated to date-only.
const DATE_FIELDS = ['infusionStartTime', 'infusionEndTime'];
// Arrays of strings → per-item editing with arrayIndex
const ARRAY_FIELDS = ['infusionComplications', 'premedications', 'laboratoryMonitoring', 'allergyScreening', 'concurrentMedications'];

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split (thousands-separator guard: comma must be followed by whitespace) */
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

/* date presence + format — null / 1970-epoch hidden */
const parseDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  let d;
  if (v instanceof Date) d = v;
  else if (typeof v === 'object' && v.$date) d = new Date(v.$date);
  else d = new Date(v);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() <= 0 || d.getUTCFullYear() <= 1970) return null;
  return d;
};
const hasDate = (v) => parseDate(v) !== null;
const fmtDate = (v) => {
  const d = parseDate(v);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

/* time-bearing detection: does the stored value carry a non-midnight time component?
   Stored as naive local-time strings ("2026-02-09T10:00:00") or date-only ("2026-02-08"). */
const hasTimeComponent = (v) => {
  if (v instanceof Date) return v.getHours() !== 0 || v.getMinutes() !== 0 || v.getSeconds() !== 0;
  const s = (typeof v === 'object' && v && v.$date) ? v.$date : v;
  if (typeof s !== 'string') return false;
  const m = s.match(/T(\d{2}):(\d{2})/);
  if (!m) return false;
  return !(m[1] === '00' && m[2] === '00');
};
/* parse a naive datetime string as local wall-clock (no TZ shift) */
const parseDateTimeLocal = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = (typeof v === 'object' && v && v.$date) ? v.$date : v;
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
/* display date + time when the value carries a time component, else date-only */
const fmtDateTime = (v) => {
  if (!hasTimeComponent(v)) return fmtDate(v);
  const d = parseDateTimeLocal(v);
  if (!d) return fmtDate(v);
  return d.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
/* BlueDatePicker day value ("YYYY-MM-DD") from the stored date/datetime string (no TZ shift) */
const toISODay = (v) => {
  const s = (typeof v === 'object' && v && v.$date) ? v.$date : v;
  if (typeof s === 'string') { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; }
  const d = parseDate(v);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
/* time suffix ("THH:mm:ss") to re-attach after a BlueDatePicker day edit, so a stored time
   component (infusionEndTime "…T10:00:00") is preserved losslessly; '' for date-only values. */
const timeSuffixOf = (v) => {
  const s = (typeof v === 'object' && v && v.$date) ? v.$date : v;
  if (typeof s === 'string') { const m = s.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/); if (m && !(m[1] === '00' && m[2] === '00')) return `T${m[1]}:${m[2]}:${m[3] || '00'}`; }
  return '';
};

/* ═══════ COMPONENT ═══════ */
const InfusionTherapyDocument = ({ document: docProp }) => {
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
    if (!docProp) return [];
    const pick = (r) => r?.infusion_therapy;
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      const p = pick(r);
      if (p) return Array.isArray(p) ? p : [p];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; const pp = pick(dd); if (pp) return Array.isArray(pp) ? pp : [pp]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Draft shape: { [recordId]: { [fieldPart]: value } } where fieldPart = "field" or "field.arrayIndex".
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    // group array drafts per (field, idx) so the full array can be reconstructed
    const arrayDrafts = {}; // `${field}-${idx}` -> { [arrayIndex]: value }
    records.forEach((record, idx) => {
      const rid = safeIdOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayElement = dotIdx !== -1 && /^\d+$/.test(tail);
        if (isArrayElement) {
          const field = fieldPart.slice(0, dotIdx);
          const aIdx = parseInt(tail, 10);
          const lk = `${field}-${idx}`;
          if (!arrayDrafts[lk]) arrayDrafts[lk] = { field, idx, indices: {} };
          arrayDrafts[lk].indices[aIdx] = value;
          nPending[lk] = true;
          nFields[`${field}-${idx}-i${aIdx}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          if (NARRATIVE_STRING_FIELDS.includes(fieldPart)) {
            nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
          } else {
            nFields[editKey] = 'edited';
          }
        }
      });
    });
    // reconstruct full arrays for array-field drafts, merging onto current record values
    Object.values(arrayDrafts).forEach(({ field, idx, indices }) => {
      const record = records[idx];
      const cur = record ? record[field] : undefined;
      const base = Array.isArray(cur) ? [...cur] : [];
      Object.entries(indices).forEach(([aIdx, val]) => { base[parseInt(aIdx, 10)] = val; });
      nLocal[`${field}-${idx}`] = base;
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, safeIdOf]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.join(', '); return String(v || ''); }, []);

  // Per-field presence
  const fieldHasVal = useCallback((fn, v) => {
    if (DATE_FIELDS.includes(fn)) return hasDate(v);
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
    return hasVal(v);
  }, [hasVal]);

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

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
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

  /* display string for a field (dates/arrays normalized) */
  const fieldDisplay = useCallback((fn, val) => {
    if (DATE_FIELDS.includes(fn)) return fmtDateTime(val);
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(val) ? val.join(', ') : fmtVal(val);
    return fmtVal(val);
  }, [fmtVal]);

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
      if (fieldHasVal(f, val)) {
        if (fieldDisplay(f, val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (fieldHasVal(fn, val)) {
      return fieldDisplay(fn, val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Infusion Therapy ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (fieldHasVal(f, val)) {
            if (fieldDisplay(f, val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleStartEdit = (field, idx, val, sentenceIdx = 0) => {
    setEditingField(sentenceIdx ? `${field}-${idx}-s${sentenceIdx}` : `${field}-${idx}`);
    setEditValue(val);
    setSaveError(null);
  };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, field, idx, sectionId, sentenceIdx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${field}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][field] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  /* array item edit — stages a DRAFT (full array locally; element draft keyed field.arrayIndex). No DB write until Approve. */
  const handleSaveArrayItem = useCallback((record, field, idx, sectionId, arrayIndex, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const cur = getFieldValue(record, field, idx);
    const currentArr = Array.isArray(cur) ? [...cur] : [];
    currentArr[arrayIndex] = saveVal;
    const editKey = `${field}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}-i${arrayIndex}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${field}.${arrayIndex}`] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, getFieldValue]);

  // Save one sentence = stage a DRAFT (full reconstructed text) locally + localStorage. No DB write until Approve.
  function saveSentence(record, field, idx, sectionId, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, field, idx) || '');
    const allCurrent = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const stageDraft = (fullText) => {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][field] = fullText;
      writeDrafts(store);
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...allCurrent]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${field}-${idx}`]: true }));
      setEditedFields(prev => ({ ...prev, [`${field}-${idx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
      stageDraft(fullText);
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const updated = [...allCurrent]; updated[sentenceIdx] = editedVal;
    const fullText = reconstructFullText(updated);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${field}-${idx}`]: true }));
    const editedMap = {};
    editedMap[`${field}-${idx}-s${sentenceIdx}`] = 'edited';
    if (extraCount > 0) {
      for (let si = sentenceIdx + 1; si <= sentenceIdx + extraCount; si++) {
        editedMap[`${field}-${idx}-s${si}`] = 'added';
      }
    }
    setEditedSentences(prev => {
      const cleaned = {};
      for (const key of Object.keys(prev)) {
        if (!key.startsWith(`${field}-${idx}-s`)) cleaned[key] = prev[key];
      }
      return { ...cleaned, ...editedMap };
    });
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    stageDraft(fullText);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Drafts staged for this record: { fieldPart: value }. fieldPart = "field" or "field.arrayIndex".
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // Only commit fieldParts whose base field belongs to this section AND whose localEdits key is pending.
      const committedKeys = []; // localEdits keys to clear from pendingEdits
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayElement = dotIdx !== -1 && /^\d+$/.test(tail);
        const baseField = isArrayElement ? fieldPart.slice(0, dotIdx) : fieldPart;
        if (!fields.includes(baseField)) continue;
        const localKey = `${baseField}-${idx}`;
        if (!pendingEdits[localKey]) continue;
        const payload = isArrayElement
          ? { field: baseField, value, arrayIndex: parseInt(tail, 10) }
          : { field: baseField, value };
        const resp = await secureApiClient.put(`/api/edit/infusion_therapy/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedKeys.push(localKey);
      }
      // Flag the section approved (audit trail) — existing endpoint
      await secureApiClient.put(`/api/edit/infusion_therapy/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for committed fields from localStorage
      const store2 = readDrafts();
      if (store2[id]) {
        Object.keys(store2[id]).forEach(fp => {
          const dotIdx = fp.lastIndexOf('.');
          const tail = dotIdx === -1 ? '' : fp.slice(dotIdx + 1);
          const baseField = (dotIdx !== -1 && /^\d+$/.test(tail)) ? fp.slice(0, dotIdx) : fp;
          if (fields.includes(baseField)) delete store2[id][fp];
        });
        if (Object.keys(store2[id]).length === 0) delete store2[id];
        writeDrafts(store2);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[InfusionTherapy] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [safeId, pendingEdits]);

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
      } else {
        // bare comma list (e.g. infusionProtocol) → number each item (aggressive split)
        const parts = splitByComma(s);
        if (parts.length >= 2) parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        else lines.push(`${n++}. ${s}`);
      }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = (SECTION_TITLES[sid] || '').toUpperCase();
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${fieldDisplay(f, val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
        text += `${label}\n`;
        items.forEach((item) => { const p = parseLabel(String(item)); text += `  ${p.value || item}\n`; });
        text += '\n';
      } else {
        const strVal = fieldDisplay(f, val);
        const sentences = splitBySentence(strVal);
        const commaParts = splitByComma(strVal);
        if (NARRATIVE_STRING_FIELDS.includes(f) && (sentences.length > 1 || commaParts.length > 1)) {
          text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `${label}\n${strVal}\n\n`;
        }
      }
    });
    return text;
  }, [getFieldValue, fieldHasVal, fieldDisplay, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== INFUSION THERAPY ===\n\n';
    pdfData.forEach((r, idx) => {
      const rt = `Infusion Therapy ${idx + 1}`;
      text += `${rt}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: SIMPLE EDITABLE STRING FIELD (textarea) ═══════ */
  const renderEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const strVal = fmtVal(val);
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
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, 0, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: DATE FIELD (BlueDatePicker; epoch/null hidden) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtDateTime(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    // BlueDatePicker edits the calendar day; a stored time component (infusionEndTime) is
    // re-attached on save so it is preserved losslessly (date-only fields keep no suffix).
    const isoVal = toISODay(val);
    const onSaveDate = (e) => {
      e.stopPropagation();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(editValue)) { setSaveError('Please enter a valid date'); return; }
      handleSaveField(record, fn, idx, sid, 0, editValue + timeSuffixOf(val));
    };

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, isoVal); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={onSaveDate}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD — per-item editing with arrayIndex ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rawArr = Array.isArray(val) ? val : splitByComma(String(val));
    const items = rawArr.filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, aIdx) => {
          const parsed = parseLabel(String(item));
          const itemVal = parsed.value || String(item);
          const itemKey = `${fn}-${idx}-i${aIdx}`;
          const isEditing = editingField === itemKey;
          const isModified = editedFields[itemKey];
          const itemMatches = phraseMatch || labelMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;

          return (
            <div key={aIdx}>
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
                    <div className="row-content">
                      {parsed.isLabeled && <span className="content-subtitle-label">{highlightText(parsed.label)}</span>}
                      <span className="content-value">{highlightText(itemVal)}</span>
                      <span className="edit-indicator">&#9998;</span>
                    </div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: NARRATIVE FIELD — per-sentence editing ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;

            return (
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, sentence.replace(/[;.]+$/, '').trim(), sIdx); }}>
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
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      );
    }

    /* Single-sentence narrative */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey || editingField === `${fn}-${idx}-s0`;
    const isModified = editedFields[editKey] || editedSentences[`${fn}-${idx}-s0`];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, strVal, 0); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, 0); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ FIELD DISPATCH ═══════ */
  const renderField = (record, fn, idx, sid) => {
    if (DATE_FIELDS.includes(fn)) return renderDateField(record, fn, idx, sid);
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
      <div className="infusion-therapy-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Infusion Therapy</h2></div>
        <div className="empty-state">No infusion therapy records available</div>
      </div>
    );
  }

  return (
    <div className="infusion-therapy-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Infusion Therapy</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<InfusionTherapyDocumentPDFTemplate document={pdfData} />} fileName="Infusion_Therapy.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search infusion therapy..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const title = `Infusion Therapy ${idx + 1}`;
          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <h3 className="record-name">{highlightText(title)}</h3>
              </div>
              {renderSection(record, idx, 'infusion')}
              {renderSection(record, idx, 'vascular-access')}
              {renderSection(record, idx, 'vitals-labs')}
              {renderSection(record, idx, 'safety')}
              {renderSection(record, idx, 'clinical-timing')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InfusionTherapyDocument;
