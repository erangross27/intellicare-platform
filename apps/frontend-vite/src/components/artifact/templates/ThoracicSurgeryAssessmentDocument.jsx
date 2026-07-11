/**
 * ThoracicSurgeryAssessmentDocument.jsx
 * June 2026 — FULL TEMPLATE STANDARD rewrite (100% schema coverage, recursive object renderer).
 * Collection: thoracic_surgery_assessment
 *
 * Donor cloned: PointOfCareUltrasoundHeartRateDocument (recursive renderObjectLeaf / renderObjectNode /
 *   renderObjectField with typed leaves: number+unit -> number input, boolean -> Yes/No select,
 *   "4/5" ratio -> number input, else -> textarea; per-sentence renderStringField; renderDateField
 *   date-picker; 4-level search; per-section approve Pending->Approved; Copy row/Section/All; pdfData memo).
 * Per-sentence narrative reference: PastMedicalHistoryDocument.
 *
 * 31 EXTRACTABLE FIELDS (100% coverage):
 *   DATE(1):    date
 *   STRING(11): consultationReason, surgeonCredentials, adlStatus, type, provider, facility,
 *               findings, assessment, plan, notes, status
 *   ARRAY(3):   backupSurgicalPlan, alternativeTreatments, recommendations
 *   OBJECT(16): performanceStatus, pulmonaryFunction, tumorStaging, mediastinoscopy, bronchoscopy,
 *               vatsAssessment, preoperativePreparation, operativeDetails, adjuvantTherapy,
 *               petCtFindings, informedConsent, tumorBoard, anesthesiaPlanning,
 *               enhancedRecoveryProtocol, postoperativeOrders, results
 *   (every nested object leaf is rendered recursively + typed.)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ThoracicSurgeryAssessmentDocumentPDFTemplate from '../pdf-templates/ThoracicSurgeryAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ThoracicSurgeryAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection
   commits). Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { localValue, dbField, dbValue, track } } }
     editKey  = the localEdits key the UI reads (e.g. "findings-0" or "pulmonaryFunction-0")
     localValue = value stored in localEdits[editKey] (string for simple fields; full merged
                  object/array for nested object/array leaf edits) — drives the on-screen render
     dbField/dbValue = the exact /edit payload to replay on Approve (dotted path for object leaves,
                  whole array for array-leaf edits, plain field for strings/sentences/dates)
     track    = the editedFields / editedSentences tracking key to restore on refresh */
const DRAFT_KEY = 'thoracic_surgery_assessmentPendingEdits';
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
  'consultation': 'Consultation Reason',
  'surgeon': 'Surgeon Credentials',
  'performance': 'Performance Status',
  'pulmonary': 'Pulmonary Function',
  'staging': 'Tumor Staging',
  'diagnostics': 'Diagnostic Procedures',
  'petct': 'PET/CT Findings',
  'vats': 'VATS Assessment',
  'preop': 'Preoperative Preparation',
  'operative': 'Operative Details',
  'anesthesia': 'Anesthesia Planning',
  'recovery': 'Enhanced Recovery Protocol',
  'adjuvant': 'Adjuvant Therapy',
  'consent': 'Informed Consent',
  'tumorboard': 'Tumor Board',
  'backup': 'Backup Surgical Plan',
  'alternatives': 'Alternative Treatments',
  'postop': 'Postoperative Orders',
  'results': 'Results',
  'clinical': 'Clinical',
  'recommendations-section': 'Recommendations',
  'notes-status': 'Notes & Status',
};

const FIELD_LABELS = {
  date: 'Date',
  consultationReason: 'Consultation Reason',
  surgeonCredentials: 'Surgeon Credentials',
  performanceStatus: 'Performance Status',
  adlStatus: 'ADL Status',
  pulmonaryFunction: 'Pulmonary Function',
  tumorStaging: 'Tumor Staging',
  mediastinoscopy: 'Mediastinoscopy',
  bronchoscopy: 'Bronchoscopy',
  vatsAssessment: 'VATS Assessment',
  preoperativePreparation: 'Preoperative Preparation',
  operativeDetails: 'Operative Details',
  adjuvantTherapy: 'Adjuvant Therapy',
  petCtFindings: 'PET/CT Findings',
  informedConsent: 'Informed Consent',
  tumorBoard: 'Tumor Board',
  anesthesiaPlanning: 'Anesthesia Planning',
  enhancedRecoveryProtocol: 'Enhanced Recovery Protocol',
  postoperativeOrders: 'Postoperative Orders',
  backupSurgicalPlan: 'Backup Surgical Plan',
  alternativeTreatments: 'Alternative Treatments',
  recommendations: 'Recommendations',
  results: 'Results',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  status: 'Status',
};

const SECTION_FIELDS = {
  'consultation': ['consultationReason'],
  'surgeon': ['surgeonCredentials'],
  'performance': ['performanceStatus', 'adlStatus'],
  'pulmonary': ['pulmonaryFunction'],
  'staging': ['tumorStaging'],
  'diagnostics': ['mediastinoscopy', 'bronchoscopy'],
  'petct': ['petCtFindings'],
  'vats': ['vatsAssessment'],
  'preop': ['preoperativePreparation'],
  'operative': ['operativeDetails'],
  'anesthesia': ['anesthesiaPlanning'],
  'recovery': ['enhancedRecoveryProtocol'],
  'adjuvant': ['adjuvantTherapy'],
  'consent': ['informedConsent'],
  'tumorboard': ['tumorBoard'],
  'backup': ['backupSurgicalPlan'],
  'alternatives': ['alternativeTreatments'],
  'postop': ['postoperativeOrders'],
  'results': ['results'],
  'clinical': ['type', 'findings', 'assessment', 'plan'],
  'recommendations-section': ['recommendations'],
  'notes-status': ['notes', 'status'],
};

const SECTION_ORDER = [
  'consultation', 'surgeon', 'performance', 'pulmonary', 'staging', 'diagnostics',
  'petct', 'vats', 'preop', 'operative', 'anesthesia', 'recovery', 'adjuvant',
  'consent', 'tumorboard', 'backup', 'alternatives', 'postop', 'results',
  'clinical', 'recommendations-section', 'notes-status',
];

const DATE_FIELDS = ['date'];
/* Per-sentence narrative strings (long-form). Short strings stay simple single-row. */
const SENTENCE_FIELDS = ['consultationReason', 'adlStatus', 'findings', 'assessment', 'plan', 'notes'];
const STRING_FIELDS = ['consultationReason', 'surgeonCredentials', 'adlStatus', 'type', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
/* DISPLAY/EDIT recursive object fields (16) */
const OBJECT_FIELDS = ['performanceStatus', 'pulmonaryFunction', 'tumorStaging', 'mediastinoscopy', 'bronchoscopy', 'vatsAssessment', 'preoperativePreparation', 'operativeDetails', 'adjuvantTherapy', 'petCtFindings', 'informedConsent', 'tumorBoard', 'anesthesiaPlanning', 'enhancedRecoveryProtocol', 'postoperativeOrders', 'results'];
/* Recursive array fields (arrays of strings or of {key:value} objects), editable per-leaf */
const ARRAY_FIELDS = ['backupSurgicalPlan', 'alternativeTreatments', 'recommendations'];

const KEY_OVERRIDES = {
  ecog: 'ECOG', fev1: 'FEV1', fvc: 'FVC', dlco: 'DLCO', tnm: 'TNM', tnmStage: 'TNM Stage',
  egfr: 'EGFR', alk: 'ALK', ros1: 'ROS1', 'pd-l1': 'PD-L1', suvMax: 'SUV Max', suv: 'SUV',
  vats: 'VATS', adl: 'ADL', icu: 'ICU', nsclc: 'NSCLC', sbrt: 'SBRT', afib: 'AFib',
  ct: 'CT', pet: 'PET', mri: 'MRI', id: 'ID',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const lower = String(key).toLowerCase();
  if (KEY_OVERRIDES[lower]) return KEY_OVERRIDES[lower];
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
const ThoracicSurgeryAssessmentDocument = ({ document: docProp, data, templateData }) => {
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
      if (r.thoracic_surgery_assessment) return Array.isArray(r.thoracic_surgery_assessment) ? r.thoracic_surgery_assessment : [r.thoracic_surgery_assessment];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.thoracic_surgery_assessment) return Array.isArray(dd.thoracic_surgery_assessment) ? dd.thoracic_surgery_assessment : [dd.thoracic_surgery_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      // remap any "...-<oldIdx>..." key's record-index segment to this render index
      const remapIdx = (key) => key.replace(/-(\d+)(?=$|-)/, `-${idx}`);
      Object.values(recDrafts).forEach((draft) => {
        if (!draft || typeof draft !== 'object') return;
        // localKey is the actual localEdits key (object-leaf drafts merge under the root key);
        // simple fields store localKey === draft key.
        const localKey = remapIdx(draft.localKey || draft.track || '');
        if (!localKey) return;
        nLocal[localKey] = draft.localValue;
        nPending[localKey] = true;
        if (draft.track) {
          const tk = remapIdx(draft.track);
          if (/-s\d+$/.test(draft.track)) nSentences[tk] = 'edited';
          else nFields[tk] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
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

  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (OBJECT_FIELDS.includes(f) || ARRAY_FIELDS.includes(f)) return flattenSearchable(val);
    if (DATE_FIELDS.includes(f)) return `${formatDate(val)} ${fmtVal(val)}`;
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
      const rt = `thoracic surgery assessment ${idx + 1}`.toLowerCase();
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
    Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; /* pending drafts stay OUT of the PDF until approved */ const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key]; });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    const trackKey = editTrackingKey || editKey;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][editKey] = { localValue: saveVal, dbField: fn, dbValue: saveVal, track: trackKey };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* save a nested OBJECT leaf by dot-path (e.g. pulmonaryFunction.predictedPostop.fev1) */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    const editKey = `${rootField}-${idx}`;
    setSaveError(null);
    // Stage the full updated root object in localEdits (drives the render) — no DB write.
    const cur = localEdits[editKey] !== undefined ? localEdits[editKey] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    setLocalEdits(prev => ({ ...prev, [editKey]: clone }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Draft: each leaf is its OWN dotted-path PUT on approve; localValue carries the full root object.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    // keep every sibling draft sharing this root in sync so the cumulative object survives refresh
    Object.values(store[id]).forEach(d => { if (d && d.localKey === editKey) d.localValue = clone; });
    store[id][leafKeyTrack] = { localValue: clone, localKey: editKey, dbField: dottedField, dbValue: newVal, track: leafKeyTrack };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, localEdits]);

  /* save one leaf inside an ARRAY field (path can dig into array-of-objects) */
  const saveArrayLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const editKey = `${rootField}-${idx}`;
    const cur = getFieldValue(record, rootField, idx);
    const clone = JSON.parse(JSON.stringify(Array.isArray(cur) ? cur : []));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    // Stage the full updated array in localEdits (drives the render) — no DB write.
    setLocalEdits(prev => ({ ...prev, [editKey]: clone }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Draft: the whole array is the PUT value on approve; localValue carries the full array.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    Object.values(store[id]).forEach(d => { if (d && d.localKey === editKey) d.localValue = clone; });
    store[id][leafKeyTrack] = { localValue: clone, localKey: editKey, dbField: rootField, dbValue: clone, track: leafKeyTrack };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, getFieldValue]);

  // Save one sentence = stage a DRAFT locally + write to the pending-drafts localStorage store.
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError(null);
    const stage = (fullText, applyTrack) => {
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      applyTrack();
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][editKey] = { localValue: fullText, localKey: editKey, dbField: fn, dbValue: fullText, track: `${fn}-${idx}-s${sentenceIdx}` };
      writeDrafts(store);
      setEditingField(null); setEditValue('');
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stage(fullText, () => setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })));
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    stage(fullText, () => setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    }));
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
    const belongsToSection = (draft) => {
      const k = draft.localKey || draft.track || '';
      return fields.some(f => k.startsWith(`${f}-${idx}`));
    };
    setSaving(true); setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const toCommit = Object.entries(recDrafts).filter(([, d]) => d && belongsToSection(d));
      // Persist each staged edit to the DB now (exact field/value captured at save time).
      for (const [, draft] of toCommit) {
        await secureApiClient.put(`/api/edit/thoracic_surgery_assessment/${id}/edit`, { field: draft.dbField, value: draft.dbValue });
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/thoracic_surgery_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending for this section's localEdits keys → committed edits now flow into pdfData/PDF
      const committedLocalKeys = new Set(toCommit.map(([, d]) => d.localKey).filter(Boolean));
      setPendingEdits(prev => { const n = { ...prev }; committedLocalKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      toCommit.forEach(([dk]) => { delete recDrafts[dk]; });
      if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[ThoracicSurgeryAssessment] Approve error:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, [safeId]);

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

  /* recursive value -> copy lines */
  const valueCopyLines = useCallback((label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
    if (Array.isArray(value)) {
      if (label) out.push(`${pad}${label}:`);
      let n = 1;
      value.filter(v => !isEmptyDeep(v)).forEach(v => {
        if (isScalar(v)) out.push(`${pad}  ${n++}. ${fmtScalar(v)}`);
        else valueCopyLines('', v, indent + 1).forEach(l => out.push(l));
      });
      return out;
    }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => valueCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0)).forEach(l => out.push(l)));
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
      if (OBJECT_FIELDS.includes(f) || ARRAY_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n`;
        valueCopyLines('', val, 0).forEach(l => { text += `${l}\n`; });
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
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, valueCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== THORACIC SURGERY ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Thoracic Surgery Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (hasVal(r.date)) text += `Date: ${formatDate(r.date)}\n`;
      if (hasVal(r.provider)) text += `Provider: ${fmtVal(r.provider)}\n`;
      if (hasVal(r.facility)) text += `Facility: ${fmtVal(r.facility)}\n`;
      text += '\n';
      SECTION_ORDER.forEach(sid => { const fields = SECTION_FIELDS[sid] || []; if (fields.some(f => hasVal(getFieldValue(r, f, idx)))) text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText, hasVal, fmtVal, getFieldValue]);

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

  /* ═══════ RENDER: STRING FIELD (per-sentence for narrative fields) ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const perSentence = SENTENCE_FIELDS.includes(fn);
    const sentences = perSentence ? splitBySentence(strVal) : [strVal];
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (perSentence && sentences.length > 1) {
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

  /* ═══════ RENDER: OBJECT LEAF (typed: number+unit -> number input, boolean -> Yes/No, "4/5" stays ratio, else text) ═══════ */
  const renderLeaf = (record, rootField, path, idx, sid, value, saveFn) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path.join('.')} className="nested-mini-card">
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
                  saveFn(record, rootField, path, idx, sid, leafKey, newVal);
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

  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => renderLeaf(record, rootField, path, idx, sid, value, saveLeaf);
  const renderArrayLeaf = (record, rootField, path, idx, sid, value) => renderLeaf(record, rootField, path, idx, sid, value, saveArrayLeaf);

  /* ═══════ RENDER: OBJECT NODE (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth, leafRenderer) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return leafRenderer(record, rootField, path, idx, sid, value);
    /* arrays nested inside objects: render each element recursively */
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          <div className="nested-group">
            {items.map((v, i) => (
              isScalar(v) ? leafRenderer(record, rootField, [...path, i], idx, sid, v)
                : <div className="nested-mini-card" key={i}>{renderObjectNode(record, rootField, idx, sid, '', v, [...path, i], depth + 1, leafRenderer)}</div>
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
            isScalar(v) ? leafRenderer(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1, leafRenderer)}</div>
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
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1, renderObjectLeaf)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (array of strings or of {key:value} objects; recursive, editable leaves) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(v => !isEmptyDeep(v)) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, i) => (
          isScalar(item)
            ? renderArrayLeaf(record, fn, [i], idx, sid, item)
            : <div className="nested-mini-card" key={i}>{renderObjectNode(record, fn, idx, sid, '', item, [i], 1, renderArrayLeaf)}</div>
        ))}
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
      <div className="thoracic-surgery-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Thoracic Surgery Assessment</h2></div>
        <div className="empty-state">No thoracic surgery assessment records available</div>
      </div>
    );
  }

  return (
    <div className="thoracic-surgery-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Thoracic Surgery Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ThoracicSurgeryAssessmentDocumentPDFTemplate document={pdfData} />} fileName={`thoracic-surgery-assessment-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search thoracic surgery assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
              <h3 className="record-name">{highlightText(`Thoracic Surgery Assessment ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThoracicSurgeryAssessmentDocument;
