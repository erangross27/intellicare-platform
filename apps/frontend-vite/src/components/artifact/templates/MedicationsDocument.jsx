/**
 * MedicationsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: medications
 *
 * 5 Sections:
 *   1. med-info: dosage (string), form (string), frequency (string), route (string)
 *   2. prescription: prescriber (string), quantity (string), refills (number),
 *                    duration (string), startDate (date), endDate (date)
 *   3. clinical: indication (string), instructions (string)
 *   4. side-effects: sideEffects (array)
 *   5. safety: safetyWarning (string)
 *
 * Top-level fields rendered in header: name, genericName, status, prn
 * drugInteractions rendered as read-only nested object inside safety section
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import MedicationsDocumentPDFTemplate from '../pdf-templates/MedicationsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './MedicationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'medicationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  'med-info': 'Medication Information',
  'prescription': 'Prescription Details',
  'clinical': 'Clinical Information',
  'side-effects': 'Side Effects',
  'safety': 'Safety Alerts & Drug Interactions',
};

const FIELD_LABELS = {
  name: 'Name',
  genericName: 'Generic Name',
  dosage: 'Dosage',
  originalDosage: 'Original Dosage',
  form: 'Form',
  frequency: 'Frequency',
  route: 'Route',
  maxDailyDose: 'Max Daily Dose',
  prescriber: 'Prescriber',
  quantity: 'Quantity',
  refills: 'Refills',
  duration: 'Duration',
  durationDays: 'Duration (Days)',
  durationUnit: 'Duration Unit',
  startDate: 'Start Date',
  endDate: 'End Date',
  prn: 'PRN (As Needed)',
  active: 'Active',
  indication: 'Indication',
  usage: 'Usage',
  instructions: 'Instructions',
  taperInstructions: 'Taper Instructions',
  sideEffects: 'Side Effects',
  safetyWarning: 'Safety Warning',
  drugInteractions: 'Drug Interactions',
  status: 'Status',
};

const SECTION_FIELDS = {
  'med-info': ['dosage', 'originalDosage', 'form', 'frequency', 'route', 'maxDailyDose'],
  'prescription': ['prescriber', 'quantity', 'refills', 'duration', 'durationDays', 'durationUnit', 'startDate', 'endDate', 'prn', 'active'],
  'clinical': ['indication', 'usage', 'instructions', 'taperInstructions'],
  'side-effects': ['sideEffects'],
  'safety': ['safetyWarning', 'drugInteractions'],
};

const NUMBER_FIELDS = ['refills', 'durationDays'];
// dosage is stored as "<number><unit>" ("40mg", "0.4 mg", "5000 IU", "2 puffs");
// edited number-only with the unit preserved verbatim (see renderDosageField).
const DOSE_FIELDS = ['dosage'];
const BOOLEAN_FIELDS = ['prn', 'active'];
const DATE_FIELDS = ['startDate', 'endDate'];
const ARRAY_FIELDS = ['sideEffects'];
const OBJECT_FIELDS = ['drugInteractions'];
/* Per-sentence narrative fields (splitBySentence editing). */
const SENTENCE_FIELDS = ['usage', 'instructions', 'taperInstructions', 'safetyWarning', 'indication'];
const STRING_FIELDS = [
  'dosage', 'originalDosage', 'form', 'frequency', 'route', 'maxDailyDose',
  'prescriber', 'quantity', 'duration', 'durationUnit',
  'indication', 'usage', 'instructions', 'taperInstructions', 'safetyWarning',
];

/* humanizeKey — for recursive object (drugInteractions) leaf/node labels */
const KEY_OVERRIDES = {
  totalInteractions: 'Total Interactions',
  contraindicated: 'Contraindicated',
  major: 'Major',
  moderate: 'Moderate',
  minor: 'Minor',
  interactions: 'Interactions',
  interactsWith: 'Interacts With',
  severity: 'Severity',
  description: 'Description',
  source: 'Source',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return v === 0 || !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
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

/* ======= COMPONENT ======= */
const MedicationsDocument = ({ document: docProp }) => {
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

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      // Detect wrapper documents from wrapRecordsIntoSingleDocument
      const recordsArr = r?.records || r?._records;
      const isWrapper = recordsArr && Array.isArray(recordsArr) && recordsArr.length > 0 &&
        (String(r?._id || '').startsWith('wrapped_') || r?._recordCount || r?._collectionName || r?._documentTitle);
      if (isWrapper) return recordsArr;
      if (r?.medications) return Array.isArray(r.medications) ? r.medications : [r.medications];
      if (r?.data?.medications) return Array.isArray(r.data.medications) ? r.data.medications : [r.data.medications];
      if (r?.documentData?.medications) return Array.isArray(r.documentData.medications) ? r.documentData.medications : [r.documentData.medications];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* safeId — resolve a record's MongoDB id (string or { $oid }). Declared here so the rehydrate
     effect below can map drafts (keyed by record id) back to the rendered record index. */
  const safeIdLocal = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((rec, idx) => {
      const id = safeIdLocal(rec);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, safeIdLocal]);

  /* ======= UTILS ======= */
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

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const val = record[fn];
    return Array.isArray(val) ? val : [];
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
    return t.includes(p) || p.startsWith(t);
  }, [searchTerm]);

  /* ======= SEARCH - 4-LEVEL ======= */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.startsWith(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.startsWith(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.startsWith(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  /* Group medications by status */
  const { activeMeds, discontinuedMeds } = useMemo(() => {
    const active = [];
    const discontinued = [];
    records.forEach(med => {
      const status = (med.status || 'active').toLowerCase();
      if (status === 'discontinued' || status === 'stopped' || status === 'inactive') {
        discontinued.push(med);
      } else {
        active.push(med);
      }
    });
    return { activeMeds: active, discontinuedMeds: discontinued };
  }, [records]);

  /* Level 1: Record-level filtering */
  const filteredActiveMeds = useMemo(() => {
    if (!searchTerm.trim()) return activeMeds;
    const phrase = searchTerm.toLowerCase().trim();
    return activeMeds.filter(med => {
      med._showAllSections = false;
      const nameMatch = med.name && (med.name.toLowerCase().includes(phrase) || phrase.startsWith(med.name.toLowerCase()));
      if (nameMatch) { med._showAllSections = true; return true; }
      // Check section titles
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.startsWith(t.toLowerCase())) return true; }
      // Check field labels
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.startsWith(l.toLowerCase())) return true; }
      // Check all field values
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = med[f];
          if (val && Array.isArray(val)) {
            if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      // Check header fields
      if (med.genericName && med.genericName.toLowerCase().includes(phrase)) return true;
      if (med.status && med.status.toLowerCase().includes(phrase)) return true;
      return false;
    });
  }, [activeMeds, searchTerm, fmtVal]);

  const filteredDiscontinuedMeds = useMemo(() => {
    if (!searchTerm.trim()) return discontinuedMeds;
    const phrase = searchTerm.toLowerCase().trim();
    return discontinuedMeds.filter(med => {
      med._showAllSections = false;
      const nameMatch = med.name && (med.name.toLowerCase().includes(phrase) || phrase.startsWith(med.name.toLowerCase()));
      if (nameMatch) { med._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.startsWith(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.startsWith(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = med[f];
          if (val && Array.isArray(val)) {
            if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      if (med.genericName && med.genericName.toLowerCase().includes(phrase)) return true;
      if (med.status && med.status.toLowerCase().includes(phrase)) return true;
      return false;
    });
  }, [discontinuedMeds, searchTerm, fmtVal]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    const allMeds = [...filteredActiveMeds, ...filteredDiscontinuedMeds];
    if (Object.keys(localEdits).length === 0) return allMeds;
    return allMeds.map((med, idx) => {
      const merged = { ...med };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      // ARRAY_FIELDS: only override with the merged array when it is NOT a pending draft.
      ARRAY_FIELDS.forEach(f => { if (pendingEdits[`${f}-${idx}`]) return; merged[f] = getEffectiveArray(med, f, idx); });
      return merged;
    });
  }, [filteredActiveMeds, filteredDiscontinuedMeds, localEdits, pendingEdits, getEffectiveArray]);

  /* ======= EDIT HANDLERS =======
     Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives
     refresh). NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve
     (handleApproveSection commits). stageDraft persists ONE fieldPart for a record into localStorage;
     fieldPart is "field" for scalar/array/object/sentence edits and "field.arrayIndex" only when an
     arrayIndex is supplied — matching the approve-side parse below. */
  const stageDraft = useCallback((record, fieldPart, value, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending.
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    // Stage locally only (no DB write). Approve commits.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    stageDraft(record, fn, saveVal, sid, idx);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  /* saveLeaf — persist a single nested leaf of an OBJECT field (drugInteractions) via dotted path */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    // Build the merged object clone, stage it locally, and persist the WHOLE object as a draft.
    // Approve replays it as { field: rootField, value: <object> } (equivalent to the dotted-leaf PUT).
    setLocalEdits(prev => {
      const cur = prev[`${rootField}-${idx}`] !== undefined ? prev[`${rootField}-${idx}`] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      stageDraft(record, rootField, clone, sid, idx);
      return { ...prev, [`${rootField}-${idx}`]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [`${rootField}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage locally only (no DB write). Approve commits.
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      stageDraft(record, fn, fullText, sid, idx);
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    // Stage locally only (no DB write). Approve commits.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    stageDraft(record, fn, fullText, sid, idx);
    setEditingField(null); setEditValue('');
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Pending editKeys for THIS section/record: localEdits key is "<fieldPart>-<idx>" where
      // fieldPart is "field" (scalar/array/object/sentence) or "field.arrayIndex" (numeric suffix).
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return fields.includes(baseField);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for "field.<digits>").
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIndex = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(trailing, 10);
        const resp = await secureApiClient.put(`/api/edit/medications/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/medications/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[Medications] Approve error:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ======= COPY ======= */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ======= FORMAT HELPERS FOR COPY ======= */
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
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (NUMBER_FIELDS.includes(f) && Number(val) === 0) return; // hide-zero (refills 0, durationDays 0)
      if (OBJECT_FIELDS.includes(f)) {
        return; // drugInteractions copied via dedicated block in buildMedicationCopyText
      } else if (BOOLEAN_FIELDS.includes(f)) {
        const bv = typeof val === 'boolean' ? val : (String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'yes');
        text += `${label}\n${bv ? 'Yes' : 'No'}\n\n`;
      } else if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(Boolean) : [];
        if (items.length > 0) {
          text += `${label}\n`;
          items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
          text += '\n';
        }
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

  /* Title line — name (+ generic) (+ status); NO "Label: value" so the Copy-All side-by-side gate stays clean */
  const medTitle = useCallback((med) => {
    let t = med.name || 'Unnamed Medication';
    if (med.genericName) t += ` (${med.genericName})`;
    if (med.status) t += ` - ${med.status}`;
    return t;
  }, []);

  /* Body = every section (label-on-own-line) + a dedicated indented drug-interactions block (hide-zero) */
  const buildMedicationBody = useCallback((med, idx) => {
    let text = '';
    Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(med, idx, sid); });
    const di = med.drugInteractions;
    if (di && Number(di.totalInteractions) > 0) {
      text += `Drug Interactions (${di.totalInteractions})\n`;
      if (Number(di.contraindicated) > 0) text += `  Contraindicated: ${di.contraindicated}\n`;
      if (Number(di.major) > 0) text += `  Major: ${di.major}\n`;
      if (Number(di.moderate) > 0) text += `  Moderate: ${di.moderate}\n`;
      if (Number(di.minor) > 0) text += `  Minor: ${di.minor}\n`;
      (Array.isArray(di.interactions) ? di.interactions : []).forEach((int, i) => {
        text += `  ${i + 1}. ${int.interactsWith || ''}${int.severity ? ' - ' + int.severity : ''}${int.description ? ': ' + int.description : ''}\n`;
      });
      text += '\n';
    }
    return text;
  }, [buildSectionCopyText]);

  const buildMedicationCopyText = useCallback((med, idx) => {
    return `${medTitle(med)}\n${'='.repeat(40)}\n\n` + buildMedicationBody(med, idx);
  }, [medTitle, buildMedicationBody]);

  const copyAllText = useCallback(async () => {
    let text = '=== MEDICATIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `${idx + 1}. ${medTitle(r)}\n${'='.repeat(40)}\n\n`;
      text += buildMedicationBody(r, idx);
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, medTitle, buildMedicationBody]);

  /* ======= RENDER: DATE FIELD ======= */
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
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: NUMBER FIELD - input[type=number step=any] + parseFloat+isNaN->block save ======= */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || Number(val) === 0) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: DOSAGE FIELD (number-only inline edit, unit preserved) =======
     dosage is one stored string of "<number><unit>" ("40mg", "0.4 mg", "5000 IU",
     "2 puffs"). Editing binds a number input to the numeric part ONLY; the
     remainder (separator + unit, captured verbatim) is shown read-only and
     re-attached on save, so the unit — mg vs mcg matters 1000x — is never lost.
     A dose with no leading number ("as needed") falls back to the text editor. */
  const renderDosageField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const m = String(val).match(/^(\s*)(-?\d+(?:\.\d+)?)(.*)$/s);
    if (!m) return renderStringField(record, fn, idx, sid, title); // non-numeric dose → text editor
    const lead = m[1], numPart = m[2], rest = m[3]; // rest = separator + unit, kept verbatim
    const unitLabel = rest.trim();
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const commitDose = () => {
      const typed = editValue.trim();
      if (isNaN(parseFloat(typed)) || typed === '') { setSaveError('Please enter a valid number'); return; }
      handleSaveField(record, fn, idx, sid, null, `${lead}${typed}${rest}`); // reattach unit verbatim
    };

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(numPart); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="dose-edit-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); commitDose(); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
                </div>
                {unitLabel && <span className="dose-unit" style={{ whiteSpace: 'nowrap', opacity: 0.85 }}>{unitLabel}</span>}
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); commitDose(); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: BOOLEAN FIELD (prn, active) — Yes/No select, real boolean ======= */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined || val === '') return null;
    const boolVal = typeof val === 'boolean' ? val : (String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'yes');
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = boolVal ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(boolVal ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue === 'Yes'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: OBJECT LEAF (recursive object leaf — editable; boolean -> Yes/No, else textarea) ======= */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const isNum = typeof value === 'number';
    const editStartValue = isBool ? (value ? 'Yes' : 'No') : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <BlueSelect value={editValue} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
              ) : isNum ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) { newVal = editValue === 'Yes'; }
                  else if (isNum) { const n = parseFloat(editValue); if (isNaN(n) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } newVal = n; }
                  else { newVal = editValue.trim(); }
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
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: OBJECT NODE (recursive; humanizeKey + nested-mini-card; editable leaves) ======= */
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

  /* ======= RENDER: OBJECT FIELD (drugInteractions) — recursive, hide-empty ======= */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ======= RENDER: ARRAY FIELD (sideEffects) ======= */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.startsWith(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); stageDraft(record, fn, currentArr, sid, idx); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
              {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: STRING FIELD with splitBySentence ======= */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label !== title;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              const parsedLabelMatch = searchTerm.trim() && parsed.isLabeled && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
              if (parsed.isLabeled) {
                const commaItems = splitByComma(parsed.value);
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText2 })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); stageDraft(record, fn, fullText2, sid, idx); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                            {ciBadge && <span className="modified-badge">edited — click Pending Approve to save</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              /* Regular sentence row - suppress dup label */
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id3 = safeId(record); if (!id3) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); stageDraft(record, fn, fullText, sid, idx); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added — click Pending Approve to save' : 'edited — click Pending Approve to save'}</span>}
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
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: GENERIC SECTION ======= */
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
        <div className={`mini-cards-container ${sid === 'safety' ? 'warning-container' : ''}`}>
          <div className="section-header">
            <h4 className={`section-title ${sid === 'safety' ? 'warning-title' : ''}`}>{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (DOSE_FIELDS.includes(f)) return renderDosageField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ======= RENDER: Single Medication Card ======= */
  const renderMedication = (med, idx, globalIdx) => {
    const medStatus = (med.status || 'active').toLowerCase();
    const copyMedId = `med-all-${globalIdx}`;

    return (
      <article key={globalIdx} className="medication-record">
        {/* Record Header */}
        <div className="record-header">
          <div className="header-top-row">
            {med.status && (
              <span className={`status-badge ${medStatus}`}>
                {highlightText(medStatus)}
              </span>
            )}
            {med.prn && <span className="prn-badge">PRN</span>}
            <div className="header-right-actions">
              <button
                className={`copy-btn copy-medication-btn ${copiedSection === copyMedId ? 'copied' : ''}`}
                onClick={() => copySection(buildMedicationCopyText(med, globalIdx), copyMedId)}
              >
                {copiedSection === copyMedId ? 'Copied!' : 'Copy Medication'}
              </button>
            </div>
          </div>
          <h3 className="record-title">{highlightText(med.name || 'Unnamed Medication')}</h3>
          {med.genericName && (
            <div className="generic-name">{highlightText(med.genericName)}</div>
          )}
        </div>

        {/* Medication Information */}
        {renderSection(med, globalIdx, 'med-info')}

        {/* Prescription Details */}
        {renderSection(med, globalIdx, 'prescription')}

        {/* Clinical Information */}
        {renderSection(med, globalIdx, 'clinical')}

        {/* Side Effects */}
        {renderSection(med, globalIdx, 'side-effects')}

        {/* Safety Alerts & Drug Interactions */}
        {(hasVal(getFieldValue(med, 'safetyWarning', globalIdx)) || med.drugInteractions?.totalInteractions > 0) && shouldShowSection(med, 'safety') && (
          <div className="section">
            <div className="mini-cards-container warning-container">
              <div className="section-header">
                <h4 className="section-title warning-title">{highlightText('Safety Alerts & Drug Interactions')}</h4>
                <div className="header-right-actions">
                  <button className={`copy-btn ${copiedSection === `safety-${globalIdx}` ? 'copied' : ''}`} onClick={() => {
                    const lines = [`SAFETY ALERTS & DRUG INTERACTIONS`, '=' .repeat(40)];
                    const sw = getFieldValue(med, 'safetyWarning', globalIdx);
                    if (sw) { lines.push('', `Safety Warning: ${sw}`); }
                    if (med.drugInteractions?.totalInteractions > 0) {
                      lines.push('', `Drug Interactions (${med.drugInteractions.totalInteractions}):`);
                      if (med.drugInteractions.contraindicated > 0) lines.push(`  Contraindicated: ${med.drugInteractions.contraindicated}`);
                      if (med.drugInteractions.major > 0) lines.push(`  Major: ${med.drugInteractions.major}`);
                      if (med.drugInteractions.moderate > 0) lines.push(`  Moderate: ${med.drugInteractions.moderate}`);
                      if (med.drugInteractions.minor > 0) lines.push(`  Minor: ${med.drugInteractions.minor}`);
                      med.drugInteractions.interactions?.forEach((int, i) => { lines.push(`  ${i + 1}. ${int.interactsWith} - ${int.severity}${int.description ? ': ' + int.description : ''}`); });
                    }
                    copySection(lines.join('\n'), `safety-${globalIdx}`);
                  }}>{copiedSection === `safety-${globalIdx}` ? 'Copied!' : 'Copy Section'}</button>
                  {renderApproveButton(med, 'safety', globalIdx)}
                </div>
              </div>

              {/* Safety Warning — per-sentence editable narrative */}
              {renderStringField(med, 'safetyWarning', globalIdx, 'safety', 'Safety Alerts & Drug Interactions')}

              {/* Drug Interactions — recursive editable object */}
              {renderObjectField(med, 'drugInteractions', globalIdx, 'safety')}
            </div>
          </div>
        )}
      </article>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="medications-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Medications</h2></div>
        <div className="no-data">No medication data available</div>
      </div>
    );
  }

  const totalFiltered = filteredActiveMeds.length + filteredDiscontinuedMeds.length;

  return (
    <div className="medications-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Medications</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<MedicationsDocumentPDFTemplate document={pdfData} />} fileName="Medications.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search medications..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results-count">Showing {totalFiltered} of {records.length} medications</span>}
      </div>
      <div className="records-container">
        {/* Active Medications */}
        {filteredActiveMeds.length > 0 && (
          <section className="medications-group">
            <div className="group-header">
              <h2 className="group-title">{highlightText(`Active Medications (${filteredActiveMeds.length})`)}</h2>
            </div>
            {filteredActiveMeds.map((med, idx) => renderMedication(med, idx, idx))}
          </section>
        )}

        {/* Discontinued Medications */}
        {filteredDiscontinuedMeds.length > 0 && (
          <section className="medications-group discontinued">
            <div className="group-header">
              <h2 className="group-title">{highlightText(`Discontinued Medications (${filteredDiscontinuedMeds.length})`)}</h2>
            </div>
            {filteredDiscontinuedMeds.map((med, idx) => renderMedication(med, idx, filteredActiveMeds.length + idx))}
          </section>
        )}

        {/* No Results State */}
        {totalFiltered === 0 && searchTerm && (
          <div className="no-data">No medications found matching "{searchTerm}"</div>
        )}
      </div>
    </div>
  );
};

export default MedicationsDocument;
