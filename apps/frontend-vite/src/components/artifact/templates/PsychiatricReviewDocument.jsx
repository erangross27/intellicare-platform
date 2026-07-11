/**
 * PsychiatricReviewDocument.jsx
 * March 2026 — Complete template with inline editing, blue glow theme
 * Collection: psychiatric_review
 *
 * 5 Sections:
 *   1. visit-info: date, type, provider, facility, status
 *   2. medication-review: lastPsychiatristVisit, medicationCompliance, medicationSideEffects, therapeuticResponse
 *   3. lab-monitoring: bloodLevels (arr of objects), metabolicMonitoring (nested obj), ekg, geneticTesting
 *   4. clinical-assessment: findings, assessment
 *   5. management: plan, notes, recommendations (arr of objects)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PsychiatricReviewDocumentPDFTemplate from '../pdf-templates/PsychiatricReviewDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PsychiatricReviewDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name, e.g. "plan" or "results") */
const DRAFT_KEY = 'psychiatric_reviewPendingEdits';
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
  'visit-info': 'Visit Information',
  'medication-review': 'Medication Review',
  'lab-monitoring': 'Lab Monitoring',
  'clinical-assessment': 'Clinical Assessment',
  management: 'Management',
  results: 'Results',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  lastPsychiatristVisit: 'Last Psychiatrist Visit',
  medicationCompliance: 'Medication Compliance',
  medicationSideEffects: 'Medication Side Effects',
  therapeuticResponse: 'Therapeutic Response',
  bloodLevels: 'Blood Levels',
  metabolicMonitoring: 'Metabolic Monitoring',
  ekg: 'EKG',
  geneticTesting: 'Genetic Testing',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  recommendations: 'Recommendations',
  results: 'Results',
};

/* OBJECT_FIELDS: dynamic-key object fields rendered recursively (humanized keys + typed leaves) */
const OBJECT_FIELDS = ['results'];

const KEY_OVERRIDES = {
  ekg: 'EKG', ecg: 'ECG', bmi: 'BMI', tsh: 'TSH', ldl: 'LDL', hdl: 'HDL', qtc: 'QTc',
  id: 'ID', url: 'URL',
};

/* humanizeKey: camelCase / snake_case object key -> Title Case label */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isScalar = (v) => v === null || v === undefined || typeof v !== 'object';
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const SECTION_FIELDS = {
  'visit-info': ['date', 'type', 'provider', 'facility', 'status'],
  'medication-review': ['lastPsychiatristVisit', 'medicationCompliance', 'medicationSideEffects', 'therapeuticResponse'],
  'lab-monitoring': ['bloodLevels', 'metabolicMonitoring', 'ekg', 'geneticTesting'],
  'clinical-assessment': ['findings', 'assessment'],
  management: ['plan', 'notes', 'recommendations'],
  results: ['results'],
};

const DATE_FIELDS = ['date'];
const SEMICOLON_FIELDS = ['medicationCompliance', 'plan'];
const SENTENCE_FIELDS = ['therapeuticResponse', 'findings', 'assessment', 'notes'];
const SIMPLE_STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'lastPsychiatristVisit', 'ekg', 'geneticTesting'];
const ARRAY_FIELDS = ['medicationSideEffects'];

const BLOOD_LEVEL_SUB_FIELDS = [
  { key: 'level', label: 'Level' },
  { key: 'date', label: 'Date' },
  { key: 'therapeutic', label: 'Therapeutic' },
];

const METABOLIC_LABELS = {
  weight: 'Weight',
  glucose: 'Glucose',
  lipids: 'Lipids',
  prolactin: 'Prolactin',
  thyroid: 'Thyroid',
};

/* parseLabel: detect "Label: value" patterns */
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

/* ═══════ COMPONENT ═══════ */
const PsychiatricReviewDocument = ({ document: docProp }) => {
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
      if (r?.psychiatric_review) return Array.isArray(r.psychiatric_review) ? r.psychiatric_review : [r.psychiatric_review];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_review) return Array.isArray(dd.psychiatric_review) ? dd.psychiatric_review : [dd.psychiatric_review]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const recId = idOf(record);
      const recDrafts = recId ? store[recId] : null;
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
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  /* flattenSearchable: recursively flatten any value (incl. dynamic-key objects) into searchable text (humanized keys + leaves; never "[object Object]") */
  const flattenSearchable = useCallback((v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
    if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
    return String(v);
  }, []);

  const formatDate = useCallback((d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
  }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  const splitBySemicolon = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
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
  const safeArray = useCallback((v) => Array.isArray(v) ? v.filter(Boolean) : [], []);
  const stripNumber = useCallback((t) => t ? t.replace(/^\d+[.)]\s*/, '') : t, []);

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
        if (flattenSearchable(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, flattenSearchable]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      return flattenSearchable(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, flattenSearchable]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Psychiatric Review ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && flattenSearchable(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, flattenSearchable]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* stageDraft: stage a field value as a DRAFT (localStorage). NO DB write — Approve commits.
     localEdits always holds the FULL field value keyed by `${fn}-${idx}`; the draft store mirrors
     that under store[recordId][fn]. Drafts survive refresh + show in JSX but stay OUT of DB/PDF. */
  const stageDraft = useCallback((record, fn, idx, fullValue) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullValue;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageDraft(record, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageDraft(record, fn, idx, fullText);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue('');
  }

  function saveSemicolonItem(record, fn, idx, itemIdx, newText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitBySemicolon(currentVal);
    items[itemIdx] = newText.trim();
    const fullText = items.join('; ');
    const itemKey = `${fn}-${idx}-sc${itemIdx}`;
    setSaveError(null);
    stageDraft(record, fn, idx, fullText);
    setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  function saveArrayItem(record, fn, idx, arrayIdx, newText) {
    const id = safeId(record); if (!id) return;
    const arrKey = `${fn}-${idx}-a${arrayIdx}`;
    const currentArr = [...safeArray(getFieldValue(record, fn, idx))];
    currentArr[arrayIdx] = newText;
    setSaveError(null);
    stageDraft(record, fn, idx, currentArr);
    setEditedSentences(prev => ({ ...prev, [arrKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  function saveBloodLevelSubField(record, idx, blIdx, subField, newValue) {
    const id = safeId(record); if (!id) return;
    const trackKey = `bl-${idx}-${blIdx}-${subField}`;
    const currentLevels = [...safeArray(getFieldValue(record, 'bloodLevels', idx))];
    if (!currentLevels[blIdx]) return;
    currentLevels[blIdx] = { ...currentLevels[blIdx], [subField]: newValue };
    setSaveError(null);
    stageDraft(record, 'bloodLevels', idx, currentLevels);
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  function saveMetabolicField(record, idx, metaKey, newValue) {
    const id = safeId(record); if (!id) return;
    const trackKey = `meta-${idx}-${metaKey}`;
    const currentMeta = { ...(getFieldValue(record, 'metabolicMonitoring', idx) || {}) };
    currentMeta[metaKey] = newValue;
    setSaveError(null);
    stageDraft(record, 'metabolicMonitoring', idx, currentMeta);
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  /* saveObjectLeaf: dynamic-key object leaf — stage the full root object as a draft (Approve commits the whole field). */
  function saveObjectLeaf(record, rootField, idx, path, newValue) {
    const id = safeId(record); if (!id) return;
    const trackKey = `obj-${rootField}-${idx}-${path.join('.')}`;
    const fullKey = `${rootField}-${idx}`;
    const cur = localEdits[fullKey] !== undefined ? localEdits[fullKey] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) {
      if (typeof node[path[i]] !== 'object' || node[path[i]] === null) node[path[i]] = {};
      node = node[path[i]];
    }
    node[path[path.length - 1]] = newValue;
    setSaveError(null);
    stageDraft(record, rootField, idx, clone);
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  function saveRecommendationSubField(record, idx, recIdx, subField, newValue) {
    const id = safeId(record); if (!id) return;
    const trackKey = `rec-${idx}-${recIdx}-${subField}`;
    const currentRecs = [...safeArray(getFieldValue(record, 'recommendations', idx))];
    if (!currentRecs[recIdx]) return;
    currentRecs[recIdx] = { ...currentRecs[recIdx], [subField]: newValue };
    setSaveError(null);
    stageDraft(record, 'recommendations', idx, currentRecs);
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)) || k.startsWith(`bl-${idx}`) || k.startsWith(`meta-${idx}`) || k.startsWith(`rec-${idx}`) || k.startsWith(`obj-${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Commit each staged field for THIS section + record. localEdits[`${fn}-${idx}`] holds the FULL
      // field value (string/array/object); write it whole. arrayIndex is only ever added when the key's
      // trailing dot-segment is purely numeric — none of this template's field names are, so never here.
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fields.includes(k.slice(0, -suffix.length)));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // plain field name (no numeric dot-suffix here)
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/psychiatric_review/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/psychiatric_review/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)) || k.startsWith(`bl-${idx}`) || k.startsWith(`meta-${idx}`) || k.startsWith(`rec-${idx}`) || k.startsWith(`obj-${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
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

  const objectCopyLines = useCallback((value, indent, label) => {
    const lines = [];
    if (isEmptyDeep(value)) return lines;
    if (isScalar(value)) { lines.push(`${'  '.repeat(indent)}${label ? label + ': ' : ''}${fmtVal(value)}`); return lines; }
    if (label) lines.push(`${'  '.repeat(indent)}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
      lines.push(...objectCopyLines(v, indent + (label ? 1 : 0), humanizeKey(k)));
    });
    return lines;
  }, [fmtVal]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];

    if (sid === 'results') {
      const rv = getFieldValue(record, 'results', idx);
      if (rv && typeof rv === 'object' && !isEmptyDeep(rv)) {
        objectCopyLines(rv, 0, '').forEach(l => { text += `${l}\n`; });
        text += '\n';
      }
      return text;
    }

    if (sid === 'lab-monitoring') {
      // bloodLevels
      const levels = safeArray(getFieldValue(record, 'bloodLevels', idx));
      if (levels.length > 0) {
        text += 'Blood Levels\n';
        levels.forEach((bl, bi) => {
          text += `  ${bi + 1}. ${bl.medication || 'Unknown'}\n`;
          BLOOD_LEVEL_SUB_FIELDS.forEach(sf => { if (bl[sf.key]) text += `     ${sf.label}: ${bl[sf.key]}\n`; });
        });
        text += '\n';
      }
      // metabolicMonitoring
      const meta = getFieldValue(record, 'metabolicMonitoring', idx);
      if (meta && typeof meta === 'object') {
        text += 'Metabolic Monitoring\n';
        Object.entries(meta).forEach(([k, v]) => {
          if (hasVal(v)) text += `  ${METABOLIC_LABELS[k] || k}: ${fmtVal(v)}\n`;
        });
        text += '\n';
      }
      // ekg, geneticTesting
      ['ekg', 'geneticTesting'].forEach(f => {
        const val = getFieldValue(record, f, idx);
        if (hasVal(val)) text += `${FIELD_LABELS[f]}\n${fmtVal(val)}\n\n`;
      });
      return text;
    }

    if (sid === 'management') {
      // plan (semicolon)
      const planVal = getFieldValue(record, 'plan', idx);
      if (hasVal(planVal)) {
        text += 'Plan\n';
        splitBySemicolon(String(planVal)).forEach((item, i) => { text += `  ${i + 1}. ${stripNumber(item)}\n`; });
        text += '\n';
      }
      // notes (sentence)
      const notesVal = getFieldValue(record, 'notes', idx);
      if (hasVal(notesVal)) {
        text += 'Notes\n';
        formatSentenceFieldLines(String(notesVal)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      }
      // recommendations
      const recs = safeArray(getFieldValue(record, 'recommendations', idx));
      if (recs.length > 0) {
        text += 'Recommendations\n';
        recs.forEach((rec, ri) => {
          text += `  ${ri + 1}. ${rec.recommendation || 'Unknown'}\n`;
          if (rec.date) text += `     Date: ${rec.date}\n`;
        });
        text += '\n';
      }
      return text;
    }

    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;

      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = safeArray(val);
        if (items.length > 0) {
          text += `${label}\n`;
          items.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
          text += '\n';
        }
      } else if (SEMICOLON_FIELDS.includes(f)) {
        const parts = splitBySemicolon(String(val));
        if (parts.length <= 1) { text += `${label}\n${val}\n\n`; return; }
        text += `${label}\n`;
        parts.forEach((p, i) => { text += `  ${i + 1}. ${stripNumber(p)}\n`; });
        text += '\n';
      } else if (SENTENCE_FIELDS.includes(f)) {
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
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, splitBySemicolon, formatSentenceFieldLines, formatDate, safeArray, stripNumber, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PSYCHIATRIC REVIEW ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Psychiatric Review ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const isoVal = val ? new Date(val).toISOString().split('T')[0] : '';

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isoVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SEMICOLON-SPLIT FIELD (medicationCompliance, plan) ═══════ */
  const renderSemicolonField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const items = splitBySemicolon(val); if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (searchTerm.trim() && !phraseMatch && !labelMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {items.map((item, iIdx) => {
            const itemKey = `${fn}-${idx}-sc${iIdx}`;
            const isEditing = editingField === itemKey;
            const badge = editedSentences[itemKey];
            const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!itemMatches && searchTerm.trim()) return null;

            const parsed = parseLabel(item);

            return (
              <div key={iIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(stripNumber(item)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSemicolonItem(record, fn, idx, iIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{parsed.isLabeled ? <><strong>{highlightText(parsed.label)}:</strong> {highlightText(parsed.value)}</> : highlightText(item)}</span><span className="edit-indicator">&#x270E;</span></div>
                      <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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
  };

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
      const showLabel = label !== sectionTitle;

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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, fn, idx, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#x270E;</span></div>
                                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                                </>
                              )}
                            </div>
                            {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              /* Regular sentence row */
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, fn, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">&#x270E;</span></div>
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

    /* Single-value string: use saveSentence(record, fn, idx, sid, 0) */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey] || editedSentences[`${fn}-${idx}-s0`];
    const showLabelSingle = label.toLowerCase() !== sectionTitle.toLowerCase();

    return (
      <div key={fn} className="rec-mini-card">
        {showLabelSingle && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
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
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (medicationSideEffects — per-item editing) ═══════ */
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
          const arrKey = `${fn}-${idx}-a${itemIdx}`;
          const isEditing = editingField === arrKey;
          const badge = editedSentences[arrKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fn, idx, itemIdx, editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#x270E;</span></div>
                    <button className={`copy-btn ${copiedItems[arrKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: BLOOD LEVELS SECTION (array of objects) ═══════ */
  const renderBloodLevelsSection = (record, idx) => {
    const levels = safeArray(getFieldValue(record, 'bloodLevels', idx));
    if (levels.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches('lab-monitoring') || record._showAllSections;

    return levels.map((bl, blIdx) => {
      const blContent = [bl.medication, ...BLOOD_LEVEL_SUB_FIELDS.filter(f => bl[f.key]).map(f => `${f.label}: ${bl[f.key]}`)].join(' ');
      if (!phraseMatch && searchTerm.trim() && !blContent.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;

      return (
        <div key={blIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(bl.medication || `Blood Level ${blIdx + 1}`)}</div>
          {BLOOD_LEVEL_SUB_FIELDS.map(sf => {
            const val = bl[sf.key]; if (!hasVal(val)) return null;
            const trackKey = `bl-${idx}-${blIdx}-${sf.key}`;
            const isEditing = editingField === trackKey;
            const isModified = editedFields[trackKey];
            return (
              <div key={sf.key} className="nested-mini-card">
                <div className="nested-subtitle sub-label">{highlightText(sf.label)}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(trackKey); setEditValue(fmtVal(val)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveBloodLevelSubField(record, idx, blIdx, sf.key, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(fmtVal(val))}</span><span className="edit-indicator">&#x270E;</span></div>
                      <button className={`copy-btn ${copiedItems[trackKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${fmtVal(val)}`, trackKey); }}>{copiedItems[trackKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    });
  };

  /* ═══════ RENDER: METABOLIC MONITORING (nested object) ═══════ */
  const renderMetabolicMonitoringSection = (record, idx) => {
    const meta = getFieldValue(record, 'metabolicMonitoring', idx);
    if (!meta || typeof meta !== 'object' || Object.keys(meta).length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches('lab-monitoring') || record._showAllSections;

    const entries = Object.entries(meta).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText('Metabolic Monitoring')}</div>
        {entries.map(([key, val]) => {
          const trackKey = `meta-${idx}-${key}`;
          const isEditing = editingField === trackKey;
          const isModified = editedFields[trackKey];
          const metaLabel = METABOLIC_LABELS[key] || key;

          if (!phraseMatch && searchTerm.trim() && !metaLabel.toLowerCase().includes(searchTerm.toLowerCase().trim()) && !fmtVal(val).toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;

          return (
            <div key={key} className="nested-mini-card">
              <div className="nested-subtitle sub-label">{highlightText(metaLabel)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(trackKey); setEditValue(fmtVal(val)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveMetabolicField(record, idx, key, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(fmtVal(val))}</span><span className="edit-indicator">&#x270E;</span></div>
                    <button className={`copy-btn ${copiedItems[trackKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${metaLabel}: ${fmtVal(val)}`, trackKey); }}>{copiedItems[trackKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: RECOMMENDATIONS (array of objects {recommendation, date}) ═══════ */
  const renderRecommendationsSection = (record, idx) => {
    const recs = safeArray(getFieldValue(record, 'recommendations', idx));
    if (recs.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches('management') || record._showAllSections;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText('Recommendations')}</div>
        {recs.map((rec, recIdx) => {
          const recContent = [rec.recommendation, rec.date].filter(Boolean).join(' ');
          if (!phraseMatch && searchTerm.trim() && !recContent.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;

          return (
            <div key={recIdx} className="rec-mini-card" style={{ marginTop: 4 }}>
              <div className="nested-subtitle">{highlightText(rec.recommendation || `Recommendation ${recIdx + 1}`)}</div>
              {[{ key: 'recommendation', label: 'Recommendation' }, { key: 'date', label: 'Date' }].map(sf => {
                const val = rec[sf.key]; if (!hasVal(val)) return null;
                const trackKey = `rec-${idx}-${recIdx}-${sf.key}`;
                const isEditing = editingField === trackKey;
                const isModified = editedFields[trackKey];
                return (
                  <div key={sf.key} className="nested-mini-card">
                    <div className="nested-subtitle sub-label">{highlightText(sf.label)}</div>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(trackKey); setEditValue(fmtVal(val)); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRecommendationSubField(record, idx, recIdx, sf.key, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(fmtVal(val))}</span><span className="edit-indicator">&#x270E;</span></div>
                          <button className={`copy-btn ${copiedItems[trackKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${fmtVal(val)}`, trackKey); }}>{copiedItems[trackKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: DYNAMIC-KEY OBJECT LEAF (typed: boolean→Yes/No select, number→number input, else textarea) ═══════ */
  const renderObjectLeaf = (record, rootField, idx, path, value) => {
    const leafKey = `obj-${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const leafLabel = humanizeKey(path[path.length - 1]);
    const isBool = typeof value === 'boolean';
    const isNum = typeof value === 'number';
    const displayVal = fmtVal(value);
    const copyKey = leafKey;

    if (searchTerm.trim() && !sectionTitleMatches('results') && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!leafLabel.toLowerCase().includes(phrase) && !displayVal.toLowerCase().includes(phrase)) return null;
    }

    return (
      <div key={path.join('.')} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(leafLabel)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(isBool ? (value ? 'Yes' : 'No') : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : isNum ? (
                <input type="number" className="edit-input" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let saveVal;
                  if (isBool) saveVal = editValue === 'Yes';
                  else if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } saveVal = n; }
                  else saveVal = editValue.trim();
                  saveObjectLeaf(record, rootField, idx, path, saveVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[copyKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${leafLabel}: ${displayVal}`, copyKey); }}>{copiedItems[copyKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* renderObjectNode: recursive — scalar leaf or nested object with humanized subtitle */
  const renderObjectNode = (record, rootField, idx, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, idx, path, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={path.join('-') || rootField} className={depth > 0 ? 'nested-mini-card' : ''}>
        {label && <div className={depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle'}>{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectLeaf(record, rootField, idx, [...path, k], v)
            : renderObjectNode(record, rootField, idx, humanizeKey(k), v, [...path, k], depth + 1)
        ))}
      </div>
    );
  };

  /* renderObjectField: dynamic-key OBJECT root (results). Content-gated (Rule #74). */
  const renderObjectField = (record, fieldName, idx) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!val || isScalar(val) || isEmptyDeep(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectLeaf(record, fieldName, idx, [k], v)
            : renderObjectNode(record, fieldName, idx, humanizeKey(k), v, [k], 1)
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    /* For lab-monitoring and management, check specific complex fields */
    let hasAnyVal = false;
    if (sid === 'lab-monitoring') {
      hasAnyVal = safeArray(getFieldValue(record, 'bloodLevels', idx)).length > 0 ||
        (getFieldValue(record, 'metabolicMonitoring', idx) && typeof getFieldValue(record, 'metabolicMonitoring', idx) === 'object' && Object.values(getFieldValue(record, 'metabolicMonitoring', idx)).some(v => hasVal(v))) ||
        hasVal(getFieldValue(record, 'ekg', idx)) ||
        hasVal(getFieldValue(record, 'geneticTesting', idx));
    } else if (sid === 'management') {
      hasAnyVal = hasVal(getFieldValue(record, 'plan', idx)) ||
        hasVal(getFieldValue(record, 'notes', idx)) ||
        safeArray(getFieldValue(record, 'recommendations', idx)).length > 0;
    } else if (sid === 'results') {
      const rv = getFieldValue(record, 'results', idx);
      hasAnyVal = rv && typeof rv === 'object' && !isEmptyDeep(rv);
    } else {
      hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    }
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
          {sid === 'lab-monitoring' ? (
            <>
              {renderBloodLevelsSection(record, idx)}
              {renderMetabolicMonitoringSection(record, idx)}
              {renderEditableField(record, 'ekg', idx, sid, title)}
              {renderEditableField(record, 'geneticTesting', idx, sid, title)}
            </>
          ) : sid === 'management' ? (
            <>
              {SEMICOLON_FIELDS.includes('plan') && renderSemicolonField(record, 'plan', idx, sid, title)}
              {renderSentenceEditableField(record, 'notes', idx, sid, title)}
              {renderRecommendationsSection(record, idx)}
            </>
          ) : sid === 'results' ? (
            renderObjectField(record, 'results', idx)
          ) : (
            fields.map(f => {
              if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
              if (SEMICOLON_FIELDS.includes(f)) return renderSemicolonField(record, f, idx, sid, title);
              if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
              if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
              return renderEditableField(record, f, idx, sid, title);
            })
          )}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="psychiatric-review-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Psychiatric Review</h2></div>
        <div className="empty-state">No psychiatric review records available</div>
      </div>
    );
  }

  return (
    <div className="psychiatric-review-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Psychiatric Review</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PsychiatricReviewDocumentPDFTemplate document={pdfData} />} fileName={`psychiatric-review-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search psychiatric review records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{formatDate(record.date)}</span>}
                {record.status && <span className="record-status">{record.status}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Psychiatric Review ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'visit-info')}
            {renderSection(record, idx, 'medication-review')}
            {renderSection(record, idx, 'lab-monitoring')}
            {renderSection(record, idx, 'clinical-assessment')}
            {renderSection(record, idx, 'management')}
            {renderSection(record, idx, 'results')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PsychiatricReviewDocument;
