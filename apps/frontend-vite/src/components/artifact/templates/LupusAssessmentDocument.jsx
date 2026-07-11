/**
 * LupusAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: lupus_assessment
 *
 * 8 Sections:
 *   1. session-info: date (date picker), provider (string), facility (string), status (string)
 *   2. sledai-acr: sledaiScore (string), acr1997Criteria (array strings)
 *   3. eular-criteria: eularCriteria (array strings)
 *   4. cutaneous: cutaneousManifestations.malarRash (bool), discoidRash (bool),
 *                 photosensitivity (bool), oralUlcers (bool), alopecia (string)
 *   5. renal: renalInvolvement.proteinuria (string), hematuria (bool), casts (string),
 *             twentyFourHourUrineOrdered (bool)
 *   6. neuro-heme-serositis: neurologicalInvolvement (array), hematologicalInvolvement (object),
 *                            serositis (array)
 *   7. findings: findings (string long, per-sentence)
 *   8. assessment-plan: assessment (string long), plan (string long)
 *   9. results-section: results (object, recursive editable leaves)
 *  10. recommendations-section: recommendations (array of {recommendation, date})
 *  11. notes-section: notes (string long)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import LupusAssessmentDocumentPDFTemplate from '../pdf-templates/LupusAssessmentDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './LupusAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the field name; value = full field value) */
const DRAFT_KEY = 'lupus_assessmentPendingEdits';
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
  'session-info': 'Session Information',
  'sledai-acr': 'SLEDAI Score & ACR 1997 Criteria',
  'eular-criteria': 'EULAR Criteria',
  'cutaneous': 'Cutaneous Manifestations',
  'renal': 'Renal Involvement',
  'neuro-heme-serositis': 'Neurological, Hematological & Serositis',
  'findings-section': 'Findings',
  'assessment-plan': 'Assessment & Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-section': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  sledaiScore: 'SLEDAI Score',
  acr1997Criteria: 'ACR 1997 Criteria',
  eularCriteria: 'EULAR Criteria',
  'cutaneousManifestations.malarRash': 'Malar Rash',
  'cutaneousManifestations.discoidRash': 'Discoid Rash',
  'cutaneousManifestations.photosensitivity': 'Photosensitivity',
  'cutaneousManifestations.oralUlcers': 'Oral Ulcers',
  'cutaneousManifestations.alopecia': 'Alopecia',
  'renalInvolvement.proteinuria': 'Proteinuria',
  'renalInvolvement.hematuria': 'Hematuria',
  'renalInvolvement.casts': 'Casts',
  'renalInvolvement.twentyFourHourUrineOrdered': '24-Hour Urine Ordered',
  neurologicalInvolvement: 'Neurological Involvement',
  'hematologicalInvolvement.anemia': 'Anemia',
  'hematologicalInvolvement.leukopenia': 'Leukopenia',
  'hematologicalInvolvement.thrombocytopenia': 'Thrombocytopenia',
  'hematologicalInvolvement.lymphopenia': 'Lymphopenia',
  serositis: 'Serositis',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'sledai-acr': ['sledaiScore', 'acr1997Criteria'],
  'eular-criteria': ['eularCriteria'],
  'cutaneous': ['cutaneousManifestations.malarRash', 'cutaneousManifestations.discoidRash', 'cutaneousManifestations.photosensitivity', 'cutaneousManifestations.oralUlcers', 'cutaneousManifestations.alopecia'],
  'renal': ['renalInvolvement.proteinuria', 'renalInvolvement.hematuria', 'renalInvolvement.casts', 'renalInvolvement.twentyFourHourUrineOrdered'],
  'neuro-heme-serositis': ['neurologicalInvolvement', 'hematologicalInvolvement.anemia', 'hematologicalInvolvement.leukopenia', 'hematologicalInvolvement.thrombocytopenia', 'hematologicalInvolvement.lymphopenia', 'serositis'],
  'findings-section': ['findings'],
  'assessment-plan': ['assessment', 'plan'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-section': ['notes'],
};

const ARRAY_FIELDS = ['acr1997Criteria', 'eularCriteria', 'neurologicalInvolvement', 'serositis'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['results'];
const RECOMMENDATION_FIELDS = ['recommendations'];
const BOOLEAN_FIELDS = ['cutaneousManifestations.malarRash', 'cutaneousManifestations.discoidRash', 'cutaneousManifestations.photosensitivity', 'cutaneousManifestations.oralUlcers', 'renalInvolvement.hematuria', 'renalInvolvement.twentyFourHourUrineOrdered'];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = [];
const STRING_FIELDS = ['provider', 'facility', 'status', 'sledaiScore', 'cutaneousManifestations.alopecia', 'renalInvolvement.proteinuria', 'renalInvolvement.casts', 'hematologicalInvolvement.anemia', 'hematologicalInvolvement.leukopenia', 'hematologicalInvolvement.thrombocytopenia', 'hematologicalInvolvement.lymphopenia'];

const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

/* ═══════ OBJECT/SCALAR HELPERS (for recursive results renderer) ═══════ */
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const objectToCopyLines = (obj, indent = '  ') => { if (!obj || typeof obj !== 'object') return ''; let out = ''; Object.entries(obj).forEach(([k, v]) => { if (isEmptyDeep(v)) return; if (isScalar(v)) { out += `${indent}${humanizeKey(k)}: ${fmtScalar(v)}\n`; } else { out += `${indent}${humanizeKey(k)}\n${objectToCopyLines(v, indent + '  ')}`; } }); return out; };

/* ═══════ COMPONENT ═══════ */
const LupusAssessmentDocument = ({ document: docProp }) => {
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
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.lupus_assessment) return Array.isArray(r.lupus_assessment) ? r.lupus_assessment : [r.lupus_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.lupus_assessment) return Array.isArray(dd.lupus_assessment) ? dd.lupus_assessment : [dd.lupus_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
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
  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }, []);

  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const toDateInputValue = useCallback((d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }

  /* Resolve nested dot-path field from record or localEdits */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; if (val === undefined) return undefined; }
      return val;
    }
    return record[fn];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; }
    const raw = record[fn];
    return Array.isArray(raw) ? raw : [];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionId) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
      else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sectionId) => {
    if (!searchTerm.trim()) return false;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    return title.includes(phrase) || phrase.includes(title);
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `Lupus Assessment ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = getFieldValue(record, f, idx);
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal, getFieldValue]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) { merged[m[1]] = localEdits[key]; } });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Stage a DRAFT locally + persist it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection
     commits). fieldPart is the field name; value is the FULL field value (string/bool/array/object). */
  const stageDraft = useCallback((record, fn, idx, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => {
      let changed = false; const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.endsWith(`-${idx}`)) { delete next[k]; changed = true; } });
      return changed ? next : prev;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx) => {
    if (!safeId(record)) return;
    setSaveError(null);
    stageDraft(record, fn, idx, editValue);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    if (!safeId(record)) return;
    setSaveError(null);
    const arr = [...(getEffectiveArray(record, fn, idx))]; arr[arrayIndex] = editValue;
    stageDraft(record, fn, idx, arr);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray, stageDraft]);

  const handleSaveDateField = useCallback((record, fn, idx) => {
    if (!safeId(record)) return;
    setSaveError(null);
    const isoDate = editValue ? new Date(editValue + 'T00:00:00.000Z').toISOString() : editValue;
    stageDraft(record, fn, idx, isoDate);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  const handleSaveBooleanField = useCallback((record, fn, idx) => {
    if (!safeId(record)) return;
    setSaveError(null);
    const boolVal = editValue === 'Yes' || editValue === 'true' || editValue === true;
    stageDraft(record, fn, idx, boolVal);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
      stageDraft(record, fn, idx, fullText);
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, fn, idx, fullText);
    const originalSentence = sentences[sentenceIdx] || '';
    const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== originalSentence.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  /* ═══════ OBJECT LEAF SAVE (dot-path, value stays STRING/boolean) ═══════ */
  const saveLeaf = useCallback((record, rootField, path, idx, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    // Build the updated full root object, then stage the WHOLE object as a DRAFT (no DB write).
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    stageDraft(record, rootField, idx, clone);
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [safeId, localEdits, stageDraft]);

  /* ═══════ RECOMMENDATIONS ITEM SAVE (array of {recommendation, date}) ═══════ */
  const saveRecommendationItem = useCallback((record, fn, idx, rIdx, leafKeyTrack, newText) => {
    const id = safeId(record); if (!id) return;
    const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
    const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: newText } : { ...r });
    setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, fn, idx, newArr);
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [safeId, getFieldValue, stageDraft]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)));
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section/record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true);
    try {
      // Collect this section's pending edits. localEdits key = `${fieldPart}-${idx}` where fieldPart is
      // the field name (may itself contain dots as a path segment, e.g. "renalInvolvement.proteinuria").
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) &&
        fields.includes(k.slice(0, -suffix.length)));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.subPath" (NOT an index here)
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the trailing dot-segment is purely numeric (never the case here, but parity-safe).
        const lastDot = fieldPart.lastIndexOf('.');
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/lupus_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/lupus_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[LupusAssessment] Approve error:', err); }
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

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid]; let text = `${title}\n${'='.repeat(40)}\n\n`;
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f; const val = getFieldValue(record, f, idx); if (!hasVal(val)) return;
      if (ARRAY_FIELDS.includes(f)) { const arr = getEffectiveArray(record, f, idx); text += `${label}\n`; arr.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
      else if (RECOMMENDATION_FIELDS.includes(f)) { const arr = Array.isArray(val) ? val : []; text += `${label}\n`; arr.forEach((rec, i) => { const t = (rec?.recommendation || '').trim(); const d = (rec?.date || '').trim(); text += `${i + 1}. ${t}${d ? ` (${d})` : ''}\n`; }); text += '\n'; }
      else if (OBJECT_FIELDS.includes(f)) { text += `${label}\n${objectToCopyLines(val, '  ')}\n`; }
      else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s.replace(/[;.]+$/, '').trim()); const raw = p ? p.content : s.replace(/[;.]+$/, '').trim(); const ci = raw.split(/,\s+/).filter(x => x.trim()); if (p) text += `  ${p.label}\n`; if (ci.length > 1) { ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `  ${i + 1}. ${raw}\n`; } }); text += '\n'; }
      else if (DATE_FIELDS.includes(f)) { text += `${label}\n${formatDate(val)}\n\n`; }
      else if (BOOLEAN_FIELDS.includes(f)) { text += `${label}\n${typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val)}\n\n`; }
      else { text += `${label}\n${fmtVal(val)}\n\n`; }
    });
    return text;
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, formatDate, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== LUPUS ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Lupus Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (r.date) text += `Date\n${formatDate(r.date)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const fields = SECTION_FIELDS[sid]; const hasAny = fields.some(f => { if (ARRAY_FIELDS.includes(f)) { const raw = r[f]; return Array.isArray(raw) && raw.length > 0; } const val = getFieldValue(r, f, idx); return hasVal(val); }); if (!hasAny) return;
        text += `${SECTION_TITLES[sid]}\n${'-'.repeat(30)}\n`;
        fields.forEach(f => { const label = FIELD_LABELS[f] || f; const val = getFieldValue(r, f, idx); if (!hasVal(val)) return;
          if (ARRAY_FIELDS.includes(f)) { const arr = Array.isArray(val) ? val : []; text += `${label}\n`; arr.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
          else if (RECOMMENDATION_FIELDS.includes(f)) { const arr = Array.isArray(val) ? val : []; text += `${label}\n`; arr.forEach((rec, i) => { const t = (rec?.recommendation || '').trim(); const d = (rec?.date || '').trim(); text += `${i + 1}. ${t}${d ? ` (${d})` : ''}\n`; }); text += '\n'; }
          else if (OBJECT_FIELDS.includes(f)) { text += `${label}\n${objectToCopyLines(val, '  ')}\n`; }
          else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s.replace(/[;.]+$/, '').trim()); const raw = p ? p.content : s.replace(/[;.]+$/, '').trim(); const ci = raw.split(/,\s+/).filter(x => x.trim()); if (p) text += `  ${p.label}\n`; if (ci.length > 1) { ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `  ${i + 1}. ${raw}\n`; } }); text += '\n'; }
          else if (DATE_FIELDS.includes(f)) { text += `${label}\n${formatDate(val)}\n\n`; }
          else if (BOOLEAN_FIELDS.includes(f)) { text += `${label}\n${typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val)}\n\n`; }
          else { text += `${label}\n${fmtVal(val)}\n\n`; }
        });
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate, splitBySentence, getFieldValue]);

  /* ═══════ RENDER: EDITABLE FIELD (string / date / boolean) ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (DATE_FIELDS.includes(fn)) {
      const displayVal = formatDate(val);
      return (
        <div key={fn}>
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toDateInputValue(val)); setSaveError(null); } }}>
            {isEditing ? (<div className="edit-field-container"><BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveDateField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>{saveError && <div className="save-error">{saveError}</div>}</div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    }

    if (BOOLEAN_FIELDS.includes(fn)) {
      const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val);
      return (
        <div key={fn}>
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
            {isEditing ? (<div className="edit-field-container"><BlueSelect value={editValue === 'Yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v)} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveBooleanField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>{saveError && <div className="save-error">{saveError}</div>}</div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    }

    const displayVal = fmtVal(val);
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>{saveError && <div className="save-error">{saveError}</div>}</div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SENTENCE FIELD (splitBySentence) ═══════ */
  function saveCommaItem(record, fn, idx, sid, sIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sIdx] || '';
    const parsed = parseLabel(sentence.replace(/[;.]+$/, '').trim());
    const rawValue = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
    const items = rawValue.split(/,\s+/).filter(x => x.trim());
    const trimmed = editValue.trim();
    if (!trimmed) { items.splice(commaIdx, 1); }
    else { const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items.splice(commaIdx, 1, ...subParts); } else { items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim(); } }
    const rebuilt = items.length > 0 ? (parsed ? `${parsed.label}: ${items.join(', ')}` : items.join(', ')) : '';
    const updated = [...sentences]; if (rebuilt) { updated[sIdx] = rebuilt; } else { updated.splice(sIdx, 1); }
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, fn, idx, fullText);
    setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sIdx}-c${commaIdx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(sentence.replace(/[;.]+$/, '').trim());
            const rawContent = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
            const commaItems = rawContent.split(/,\s+/).filter(s => s.trim());
            const showCommaRows = commaItems.length > 1;

            const parsedLabelMatch = searchTerm.trim() && parsed && parsed.label && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());

            if (showCommaRows) {
              return (<div key={sIdx} className={parsed ? 'rec-mini-card' : ''}>
                {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                {commaItems.map((ci, ciIdx) => {
                  const commaKey = `${fn}-${idx}-s${sIdx}-c${ciIdx}`;
                  const ciEditing = editingField === commaKey;
                  const ciBadge = editedSentences[commaKey];
                  const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                  if (!ciMatches && searchTerm.trim()) return null;
                  if (ciEditing) {
                    return (<div key={ciIdx} className="numbered-row"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>{saveError && <div className="save-error">{saveError}</div>}</div></div>);
                  }
                  return (<React.Fragment key={ciIdx}>
                    <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { setEditingField(commaKey); setEditValue(ci.trim()); setSaveError(null); }}>
                      <div className="row-content"><span className="content-value">{highlightText(ci.trim())}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci.trim(), commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                    </div>
                    {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                  </React.Fragment>);
                })}
              </div>);
            }

            return (<div key={sIdx}>
              {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed) { const curSentences = splitBySentence(String(getFieldValue(record, fn, idx) || '')); curSentences[sIdx] = `${parsed.label}: ${editValue.trim()}`; const fullText = reconstructFullText(curSentences); if (!safeId(record)) return; setSaveError(null); stageDraft(record, fn, idx, fullText); setEditedSentences(prev => ({ ...prev, [sentenceKey]: 'edited' })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>{saveError && <div className="save-error">{saveError}</div>}</div>
                ) : (<><div className="row-content"><span className="content-value">{highlightText(parsed ? parsed.content : sentence)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}
              </div>
              {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
            </div>);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD ═══════ */
  const renderArraySection = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== title.toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {arr.map((item, ai) => {
            const editKey = `${fn}-${idx}-ai${ai}`; const isEditing = editingField === editKey; const badge = editedFields[editKey];
            const itemStr = String(item);
            const itemMatches = phraseMatch || (searchTerm.trim() && itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(itemStr);
            if (parsed) {
              return (
                <div key={ai} className="rec-mini-card" style={{ marginTop: ai > 0 ? 8 : 0 }}>
                  <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(parsed.content); setSaveError(null); } }}>
                    {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const fullVal = `${parsed.label}: ${editValue.trim()}`; if (!safeId(record)) return; setSaveError(null); const a = [...(getEffectiveArray(record, fn, idx))]; a[ai] = fullVal; stageDraft(record, fn, idx, a); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>{saveError && <div className="save-error">{saveError}</div>}</div>
                    ) : (<><div className="row-content"><span className="content-value">{highlightText(parsed.content)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                  </div>
                  {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            }
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, ai); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>{saveError && <div className="save-error">{saveError}</div>}</div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; boolean -> select, text -> textarea) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const editStartValue = isBool ? (value ? 'Yes' : 'No') : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <BlueSelect value={editValue === 'Yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const newVal = isBool ? (editValue === 'Yes') : editValue.trim(); saveLeaf(record, rootField, path, idx, leafKey, newVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
            </div>
          ) : (
            <><div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button></>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT NODE (recursive) ═══════ */
  const renderObjectNode = (record, rootField, idx, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, value);
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  /* ═══════ RENDER: OBJECT FIELD (results — recursive editable leaves) ═══════ */
  const renderObjectField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS — array of {recommendation, date}, date-grouped ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();
    const groups = [];
    recs.forEach((rec, rIdx) => { const d = (rec?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push({ rec, rIdx }); else groups.push({ date: d, items: [{ rec, rIdx }] }); });
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                const badge = editedFields[itemKey];
                const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || recText.toLowerCase().includes(phrase) || recDate.toLowerCase().includes(phrase);
                if (!itemMatches && searchTerm.trim()) return null;
                return (
                  <div key={rIdx}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRecommendationItem(record, fn, idx, rIdx, itemKey, editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                          {saveError && <div className="save-error">{saveError}</div>}
                        </div>
                      ) : (
                        <><div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${recText}${recDate ? ` (${recDate})` : ''}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button></>
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

  /* ═══════ RENDER: MIXED SECTION ═══════ */
  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; return hasVal(getFieldValue(record, f, idx)); });
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
            if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, f, idx, sid, title);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid, title);
            if (RECOMMENDATION_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (<div className="lupus-assessment-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Lupus Assessment</h2></div><div className="empty-state">No lupus assessment records available</div></div>);
  }

  return (
    <div className="lupus-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Lupus Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<LupusAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Lupus_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search lupus assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Lupus Assessment ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'session-info')}
            {renderMixedSection(record, idx, 'sledai-acr')}
            {renderMixedSection(record, idx, 'eular-criteria')}
            {renderMixedSection(record, idx, 'cutaneous')}
            {renderMixedSection(record, idx, 'renal')}
            {renderMixedSection(record, idx, 'neuro-heme-serositis')}
            {renderMixedSection(record, idx, 'findings-section')}
            {renderMixedSection(record, idx, 'assessment-plan')}
            {renderMixedSection(record, idx, 'results-section')}
            {renderMixedSection(record, idx, 'recommendations-section')}
            {renderMixedSection(record, idx, 'notes-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LupusAssessmentDocument;
