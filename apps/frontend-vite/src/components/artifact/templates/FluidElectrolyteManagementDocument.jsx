/**
 * FluidElectrolyteManagementDocument.jsx
 * June 2026 — Collection: fluid_electrolyte_management (REBUILT, schema-only)
 *
 * Donor cloned: PointOfCareUltrasoundHeartRateDocument (generic date + object + array + string,
 *   recursive renderObjectLeaf/renderObjectNode, per-sentence renderStringField, 4-level search,
 *   per-section approve, Copy row/Section/All, pdfData memo, blue-glow theme).
 *
 * FIELDS (21 → 100% schema coverage):
 *   DATE   (1):  date
 *   STRING (14): volumeStatus, dryWeight, edema, sodium, potassium, bicarbonate, chloride,
 *                provider, facility, findings, assessment, plan, notes, status
 *   OBJECT (4):  bloodPressure, acidosisManagement, hyperkalemiaManagement, results
 *   ARRAY  (2):  diureticRegimen, recommendations
 *
 * Sections:
 *   Volume Status   : volumeStatus, dryWeight, edema, bloodPressure
 *   Electrolytes    : sodium, potassium, bicarbonate, chloride
 *   Management      : acidosisManagement, hyperkalemiaManagement, diureticRegimen
 *   Assessment      : findings, assessment, plan, results, recommendations
 *   Notes & Status  : notes, status
 * Header: date + provider + facility.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FluidElectrolyteManagementDocumentPDFTemplate from '../pdf-templates/FluidElectrolyteManagementDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './FluidElectrolyteManagementDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name; values may be strings,
   objects, or arrays since this template stages whole-field values keyed `${fn}-${idx}`). */
const DRAFT_KEY = 'fluid_electrolyte_managementPendingEdits';
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
  'volume-status': 'Volume Status',
  'electrolytes': 'Electrolytes',
  'management': 'Management',
  'assessment-section': 'Assessment',
  'notes-status': 'Notes & Status',
};

const FIELD_LABELS = {
  date: 'Date',
  volumeStatus: 'Volume Status',
  dryWeight: 'Dry Weight',
  edema: 'Edema',
  bloodPressure: 'Blood Pressure',
  sodium: 'Sodium',
  potassium: 'Potassium',
  bicarbonate: 'Bicarbonate',
  chloride: 'Chloride',
  acidosisManagement: 'Acidosis Management',
  hyperkalemiaManagement: 'Hyperkalemia Management',
  diureticRegimen: 'Diuretic Regimen',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
  status: 'Status',
  provider: 'Provider',
  facility: 'Facility',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility'],
  'volume-status': ['volumeStatus', 'dryWeight', 'edema', 'bloodPressure'],
  'electrolytes': ['sodium', 'potassium', 'bicarbonate', 'chloride'],
  'management': ['acidosisManagement', 'hyperkalemiaManagement', 'diureticRegimen'],
  'assessment-section': ['findings', 'assessment', 'plan', 'results', 'recommendations'],
  'notes-status': ['notes', 'status'],
};

const SECTION_ORDER = ['record-info', 'volume-status', 'electrolytes', 'management', 'assessment-section', 'notes-status'];

const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['volumeStatus', 'dryWeight', 'edema', 'sodium', 'potassium', 'bicarbonate', 'chloride', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
/* single number+unit measures → −/+ stepper */
const MEASURE_FIELDS = ['dryWeight'];
/* comma-joined measures → one row per comma part */
const COMMA_FIELDS = ['edema', 'sodium', 'potassium', 'bicarbonate', 'chloride'];
/* comma-part rows whose leading number is a −/+ stepper (unit/qualifier stays literal); subset of COMMA_FIELDS */
const COMMA_MEASURE_FIELDS = ['sodium', 'potassium', 'bicarbonate', 'chloride'];
/* recursive OBJECT fields */
const OBJECT_FIELDS = ['bloodPressure', 'acidosisManagement', 'hyperkalemiaManagement', 'results'];
/* array fields — diureticRegimen (array of objects) + recommendations (array of {recommendation,date}) */
const ARRAY_FIELDS = ['diureticRegimen', 'recommendations'];

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const KEY_OVERRIDES = {
  bp: 'BP', sbp: 'SBP', dbp: 'DBP', mg: 'Mg', meq: 'mEq', iv: 'IV', po: 'PO', egfr: 'eGFR', gfr: 'GFR',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (/\s/.test(String(key))) return String(key); // already human-readable — don't mangle
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

/* splitLeafCommas: paren-aware, splits ONLY on a comma followed by whitespace (so "1,000" stays whole).
   Breaks comma-joined object-leaf measures ("172/94 pre-dialysis, 132/74 post-dialysis") into rows. */
const splitLeafCommas = (text) => {
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
const FluidElectrolyteManagementDocument = ({ document: docProp, data, templateData }) => {
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
      if (r.fluid_electrolyte_management) return Array.isArray(r.fluid_electrolyte_management) ? r.fluid_electrolyte_management : [r.fluid_electrolyte_management];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.fluid_electrolyte_management) return Array.isArray(dd.fluid_electrolyte_management) ? dd.fluid_electrolyte_management : [dd.fluid_electrolyte_management]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
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

  const recsToText = useCallback((recs) => {
    if (!Array.isArray(recs)) return '';
    return recs.map(r => {
      if (r === null || typeof r !== 'object') return fmtVal(r);
      if (r.recommendation !== undefined || r.date !== undefined) return `${r?.recommendation || ''} ${r?.date || ''}`;
      return flattenSearchable(r);
    }).join(' ');
  }, [fmtVal]);

  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (ARRAY_FIELDS.includes(f)) return recsToText(val);
    if (OBJECT_FIELDS.includes(f)) return flattenSearchable(val);
    return fmtVal(val);
  }, [recsToText, fmtVal]);

  /* is this array field the {recommendation,date} shape? */
  const isRecommendationArray = useCallback((val) => {
    if (!Array.isArray(val)) return false;
    return val.some(r => r && typeof r === 'object' && (r.recommendation !== undefined || r.date !== undefined));
  }, []);

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
      const rt = `fluid & electrolyte management ${idx + 1}`.toLowerCase();
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
    Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key]; });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection
     commits). The draft store keys whole-field values by field name (`${fn}`) under the record id;
     localEdits/pendingEdits/editedFields/editedSentences keys use the `${fn}-${idx}` convention. */
  const stageDraft = useCallback((record, fn, idx, sid, value, { trackKey, sentenceKey, sentenceBadge } = {}) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sentenceKey) setEditedSentences(prev => ({ ...prev, [sentenceKey]: sentenceBadge || 'edited' }));
    else setEditedFields(prev => ({ ...prev, [trackKey || editKey]: 'edited' }));
    // Re-edit after approval → drop the section's approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, sid, saveVal, { trackKey: editTrackingKey || `${fn}-${idx}` });
  }, [editValue, stageDraft]);

  /* stage a nested OBJECT leaf edit (whole root object staged under `${rootField}-${idx}`) */
  /* read the current value of a nested object leaf (draft-aware), walking the dot-path */
  const getLeafValue = useCallback((record, rootField, idx, path) => {
    let node = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    for (let i = 0; i < path.length; i++) { if (node == null) return undefined; node = node[path[i]]; }
    return node;
  }, [localEdits]);

  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    setSaveError(null);
    stageDraft(record, rootField, idx, sid, clone, { trackKey: leafKeyTrack });
  }, [safeId, localEdits, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
      const editKey = `${fn}-${idx}`;
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store);
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const editKey = `${fn}-${idx}`;
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
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this record+section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Commit this section's staged field edits (localEdits keys "field-idx" or "field.arrayIndex-idx")
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(trailing, 10);
        }
        const resp = await secureApiClient.put(`/api/edit/fluid_electrolyte_management/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/fluid_electrolyte_management/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); const base = fp.includes('.') ? fp.slice(0, fp.indexOf('.')) : fp; delete store[id][base]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[FluidElectrolyteManagement] Approve error:', err); }
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

  /* object → copy lines (recursive, STACKED: sub-label + DASH + numbered value, never "key: value") */
  const objectCopyLines = useCallback((label, value) => {
    const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) {
      if (label) { out.push(label); out.push(COPY_LINE_DASH); }
      splitLeafCommas(fmtScalar(value)).forEach((p, i) => out.push(`${i + 1}. ${p}`));
      return out;
    }
    if (Array.isArray(value)) {
      /* nested array (e.g. bloodPressure.medications) → numbered rows under the sub-label */
      if (label) { out.push(label); out.push(COPY_LINE_DASH); }
      let n = 1;
      value.filter(v => !isEmptyDeep(v)).forEach(v => {
        if (isScalar(v)) out.push(`${n++}. ${fmtScalar(v)}`);
        else objectCopyLines('', v).forEach(l => out.push(l));
      });
      return out;
    }
    if (label) { out.push(label); out.push(COPY_LINE_DASH); }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v)));
    return out;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    let body = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      if (ARRAY_FIELDS.includes(f)) {
        body += head;
        const items = Array.isArray(val) ? val : [];
        if (isRecommendationArray(val)) {
          let lastDate = null; let n = 1;
          items.forEach((r) => {
            const rec = (r?.recommendation || '').trim(); if (!rec) return;
            const date = (r?.date || '').trim();
            if (date !== lastDate) { if (date) body += `${date}\n`; lastDate = date; n = 1; }
            body += `${n++}. ${rec}\n`;
          });
        } else {
          let n = 1;
          items.filter(it => !isEmptyDeep(it)).forEach((it) => {
            if (isScalar(it)) body += `${n++}. ${fmtScalar(it)}\n`;
            else { objectCopyLines('', it).forEach(l => { body += `${l}\n`; }); }
          });
        }
        body += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        body += head;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { objectCopyLines(humanizeKey(k), v).forEach(l => { body += `${l}\n`; }); body += '\n'; });
      } else if (DATE_FIELDS.includes(f)) {
        body += `${head}1. ${formatDate(val)}\n\n`;
      } else if (COMMA_FIELDS.includes(f)) {
        body += head;
        splitLeafCommas(fmtVal(val)).forEach((p, i) => { body += `${i + 1}. ${p}\n`; });
        body += '\n';
      } else {
        body += head;
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) sentences.forEach((s, i) => { body += `${i + 1}. ${s.replace(/[;.]+$/, '').trim()}\n`; });
        else body += `1. ${strVal}\n`;
        body += '\n';
      }
    });
    if (!body.trim()) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${body}`;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, objectCopyLines, isRecommendationArray]);

  const copyAllText = useCallback(async () => {
    let text = `Fluid & Electrolyte Management\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Fluid & Electrolyte Management ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      SECTION_ORDER.forEach(sid => { const sec = buildSectionCopyText(r, idx, sid); if (sec) text += sec; });
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
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
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
  /* ═══════ RENDER: MEASURE FIELD (single number+unit → −/+ stepper) ═══════ */
  const renderMeasureField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const nu = splitNumberUnit(strVal);
    if (!nu) return renderStringField(record, fn, idx, sid); // not a clean number+unit → plain text
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(nu.num); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="number-edit-row">
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String(Math.max(0, (isNaN(c) ? 0 : c) - 1))); }}>−</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String((isNaN(c) ? 0 : c) + 1)); }}>+</button>
                </div>
                {nu.unit && <span className="number-edit-unit">{nu.unit}</span>}
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } const newVal = nu.unit ? `${n}${nu.sep}${nu.unit}` : String(n); handleSaveField(record, fn, idx, sid, newVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* COMMA field → one editable row per comma part (rejoin ', ' on save).
       COMMA_MEASURE_FIELDS: each part's leading number is a −/+ stepper; the unit/qualifier stays literal. */
    if (COMMA_FIELDS.includes(fn)) {
      const isMeasureComma = COMMA_MEASURE_FIELDS.includes(fn);
      const parts = splitLeafCommas(strVal);
      if (isMeasureComma || parts.length > 1) {
        return (
          <div key={fn} className="rec-mini-card">
            {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {parts.map((part, ci) => {
              const partKey = `${fn}-${idx}-c${ci}`;
              const partEditing = editingField === partKey;
              const partBadge = editedFields[partKey];
              const nu = isMeasureComma ? splitNumberUnit(part) : null;
              return (
                <div key={ci}>
                  <div className={`numbered-row ${partBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!partEditing) { setEditingField(partKey); setEditValue(nu ? nu.num : part); setSaveError(null); } }}>
                    {partEditing ? (
                      <div className="edit-field-container">
                        {nu ? (
                          <div className="number-edit-row">
                            <div className="num-stepper-row">
                              <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String(Math.max(0, (isNaN(c) ? 0 : c) - 1))); }}>−</button>
                              <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String((isNaN(c) ? 0 : c) + 1)); }}>+</button>
                            </div>
                            {nu.unit && <span className="number-edit-unit">{nu.unit}</span>}
                          </div>
                        ) : (
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        )}
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); let newPart; if (nu) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newPart = nu.unit ? `${n}${nu.sep}${nu.unit}` : String(n); } else { newPart = editValue.trim(); } const cur = splitLeafCommas(String(getFieldValue(record, fn, idx) || '')); cur[ci] = newPart; const joined = cur.filter(p => p !== '').join(', '); handleSaveField(record, fn, idx, sid, joined, partKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(part, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {partBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        );
      }
    }

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
  const renderObjectLeaf = (record, rootField, path, idx, sid, value, isArrayItem) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    const leafLabel = isArrayItem ? '' : humanizeKey(path[path.length - 1]);

    /* plain-text leaf with comma-joined measures → one editable row per comma part (rejoin ', ' on save) */
    const commaParts = (!isBool && !ratio && !nu) ? splitLeafCommas(leafValueString) : null;
    if (commaParts && commaParts.length > 1) {
      return (
        <div key={path[path.length - 1]} className="nested-mini-card">
          {leafLabel && <div className="nested-subtitle sub-label">{highlightText(leafLabel)}</div>}
          {commaParts.map((part, ci) => {
            const partKey = `${leafKey}-c${ci}`;
            const partEditing = editingField === partKey;
            const partBadge = editedFields[partKey];
            return (
              <div key={ci}>
                <div className={`numbered-row ${partBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!partEditing) { setEditingField(partKey); setEditValue(part); setSaveError(null); } }}>
                  {partEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const parts = splitLeafCommas(fmtScalar(getLeafValue(record, rootField, idx, path))); parts[ci] = editValue.trim(); const rejoined = parts.filter(p => p !== '').join(', '); saveLeaf(record, rootField, path, idx, sid, partKey, rejoined); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(part, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {partBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        {leafLabel && <div className="nested-subtitle sub-label">{highlightText(leafLabel)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <BlueSelect value={editValue === 'yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v === 'Yes' ? 'yes' : 'no')} />
              ) : (ratio || nu) ? (
                <div className="number-edit-row">
                  <div className="num-stepper-row">
                    <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String(Math.max(0, (isNaN(c) ? 0 : c) - 1))); }}>−</button>
                    <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); setEditValue(String((isNaN(c) ? 0 : c) + 1)); }}>+</button>
                  </div>
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
                    newVal = nu.unit ? `${n}${nu.sep}${nu.unit}` : String(n);
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
    /* nested ARRAY (e.g. bloodPressure.medications) → list children by index, NO "0/1/2" key labels */
    if (Array.isArray(value)) {
      const arrEntries = value.map((v, i) => [i, v]).filter(([, v]) => !isEmptyDeep(v));
      if (arrEntries.length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          <div className="nested-group">
            {arrEntries.map(([i, v]) => (
              isScalar(v) ? renderObjectLeaf(record, rootField, [...path, i], idx, sid, v, true)
                : <div className="nested-mini-card" key={i}>{renderObjectNode(record, rootField, idx, sid, '', v, [...path, i], depth + 1)}</div>
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

  /* ═══════ RENDER: ARRAY FIELD — per-item ═══════
     recommendations → array of {recommendation, date} (date-grouped numbered list, editable text)
     diureticRegimen → array of objects → recursive per-item object render */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(it => !isEmptyDeep(it)) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();

    /* recommendation-shaped array → date-grouped numbered list with editable text */
    if (isRecommendationArray(val)) {
      const groups = [];
      (Array.isArray(val) ? val : []).forEach((rec, rIdx) => {
        if (isEmptyDeep(rec)) return;
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
              <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
                {group.items.map(({ rec, rIdx }) => {
                  const recText = (rec?.recommendation || '').trim();
                  const recDate = (rec?.date || '').trim();
                  const itemKey = `${fn}-${idx}-r${rIdx}`;
                  const isEditing = editingField === itemKey;
                  const badge = editedSentences[itemKey];
                  const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || recText.toLowerCase().includes(phrase) || recDate.toLowerCase().includes(phrase);
                  if (!itemMatches && searchTerm.trim()) return null;
                  return (
                    <div key={rIdx}>
                      <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
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
                                const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
                                setSaveError(null);
                                // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
                                const editKey = `${fn}-${idx}`;
                                setLocalEdits(prev => ({ ...prev, [editKey]: newArr }));
                                setPendingEdits(prev => ({ ...prev, [editKey]: true }));
                                setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
                                setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                                const store = readDrafts(); if (!store[id2]) store[id2] = {}; store[id2][fn] = newArr; writeDrafts(store);
                                setEditingField(null); setEditValue('');
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
    }

    /* generic array (e.g. diureticRegimen — array of objects/scalars) → per-item render */
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, iIdx) => {
          if (isScalar(item)) {
            const itemKey = `${fn}-${idx}-i${iIdx}`;
            const itemVisible = phraseMatch || labelMatch || !searchTerm.trim() || fmtScalar(item).toLowerCase().includes(phrase);
            if (!itemVisible && searchTerm.trim()) return null;
            return (
              <div key={iIdx} className="nested-mini-card">
                <div className="numbered-row editable-row">
                  <div className="row-content"><span className="content-value">{highlightText(fmtScalar(item))}</span></div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(fmtScalar(item), itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          }
          const itemText = flattenSearchable(item).toLowerCase();
          const itemVisible = phraseMatch || labelMatch || !searchTerm.trim() || itemText.includes(phrase);
          if (!itemVisible && searchTerm.trim()) return null;
          const subEntries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
          if (subEntries.length === 0) return null;
          return (
            <div key={iIdx} className="nested-mini-card" style={{ marginTop: iIdx > 0 ? 8 : 0 }}>
              {subEntries.map(([k, v]) => (
                isScalar(v) ? renderObjectLeaf(record, fn, [iIdx, k], idx, sid, v)
                  : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [iIdx, k], 1)}</div>
              ))}
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
            if (MEASURE_FIELDS.includes(f)) return renderMeasureField(record, f, idx, sid);
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
      <div className="fluid-electrolyte-management-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Fluid &amp; Electrolyte Management</h2></div>
        <div className="empty-state">No fluid &amp; electrolyte management records available</div>
      </div>
    );
  }

  return (
    <div className="fluid-electrolyte-management-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Fluid &amp; Electrolyte Management</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<FluidElectrolyteManagementDocumentPDFTemplate document={pdfData} />} fileName="Fluid_Electrolyte_Management.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search fluid & electrolyte management records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">Fluid &amp; Electrolyte Management {idx + 1}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FluidElectrolyteManagementDocument;
