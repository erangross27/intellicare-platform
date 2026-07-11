/**
 * SpondyloarthritisAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: spondyloarthritis_assessment (displayed as "Spondyloarthritis Assessment")
 *
 * 8 Sections:
 *   1. record-info: date, provider, facility, status, type
 *   2. disease-scores: basdaiScore, basfiScore, asdas, hlab27
 *   3. sacroiliitis: sacroiliitis
 *   4. spinal-mobility: spinalMobility (object with schober, occiputToWall, chestExpansion, cervicalRotation)
 *   5. extra-articular: enthesitis, dactylitis
 *   6. findings: findings
 *   7. assessment: assessment
 *   8. plan: plan
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SpondyloarthritisAssessmentDocumentPDFTemplate from '../pdf-templates/SpondyloarthritisAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './SpondyloarthritisAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [draftKey]: { lk, value, payload, marker } } }
   `lk` is the localEdits key part (no -idx); `payload` is the exact body the DB write needs
   (so Approve replays the same field/arrayIndex/subField). */
const DRAFT_KEY = 'spondyloarthritis_assessmentPendingEdits';
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
  'disease-scores': 'Disease Scores',
  'sacroiliitis': 'Sacroiliitis',
  'spinal-mobility': 'Spinal Mobility',
  'extra-articular': 'Extra-Articular Manifestations',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  type: 'Type',
  basdaiScore: 'BASDAI Score',
  basfiScore: 'BASFI Score',
  asdas: 'ASDAS',
  hlab27: 'HLA-B27',
  sacroiliitis: 'Sacroiliitis',
  spinalMobility: 'Spinal Mobility',
  'spinalMobility.schober': 'Schober',
  'spinalMobility.occiputToWall': 'Occiput-to-Wall',
  'spinalMobility.chestExpansion': 'Chest Expansion',
  'spinalMobility.cervicalRotation': 'Cervical Rotation',
  enthesitis: 'Enthesitis',
  dactylitis: 'Dactylitis',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility', 'status', 'type'],
  'disease-scores': ['basdaiScore', 'basfiScore', 'asdas', 'hlab27'],
  'sacroiliitis': ['sacroiliitis'],
  'spinal-mobility': ['spinalMobility'],
  'extra-articular': ['enthesitis', 'dactylitis'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'recommendations': ['recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['enthesitis', 'dactylitis'];
/* Array-of-objects: per-subfield editable rows that preserve object shape on save. */
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const OBJECT_ARRAY_SUBFIELDS = {
  recommendations: [
    { key: 'recommendation', label: 'Recommendation' },
    { key: 'date', label: 'Date' },
  ],
};
/* Dynamic-key object fields (arbitrary keys). spinalMobility has a fixed key set; results is open-ended. */
const OBJECT_FIELDS = ['spinalMobility'];
const DYNAMIC_OBJECT_FIELDS = ['results'];
const SPINAL_MOBILITY_KEYS = ['schober', 'occiputToWall', 'chestExpansion', 'cervicalRotation'];
const STRING_FIELDS = ['type', 'basdaiScore', 'basfiScore', 'asdas', 'hlab27', 'sacroiliitis', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];

const humanizeKey = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

/* Flatten dynamic-key object for display (results). Nested objects expanded one level → no [object Object]. */
const flattenObject = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const label = humanizeKey(key);
    if (typeof value === 'boolean') {
      items.push({ key, label, value: value ? 'Yes' : 'No' });
    } else if (Array.isArray(value)) {
      items.push({ key, label, value: value.map(v => (v && typeof v === 'object') ? Object.values(v).join(' ') : String(v)).join(', ') });
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (subValue !== null && subValue !== undefined && subValue !== '') {
          items.push({ key: `${key}.${subKey}`, label: `${label} - ${humanizeKey(subKey)}`, value: (subValue && typeof subValue === 'object') ? Object.values(subValue).join(' ') : String(subValue) });
        }
      });
    } else {
      items.push({ key, label, value: String(value) });
    }
  });
  return items;
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const SpondyloarthritisAssessmentDocument = ({ document: docProp }) => {
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
  // editKeys staged as drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.spondyloarthritis_assessment) return Array.isArray(r.spondyloarthritis_assessment) ? r.spondyloarthritis_assessment : [r.spondyloarthritis_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.spondyloarthritis_assessment) return Array.isArray(dd.spondyloarthritis_assessment) ? dd.spondyloarthritis_assessment : [dd.spondyloarthritis_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.values(recDrafts).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const { lk, value, marker } = entry;
        if (lk === undefined) return;
        const localKey = `${lk}-${idx}`;
        nLocal[localKey] = value;       // the value rendered in the JSX
        nPending[localKey] = true;      // keep it OUT of the PDF until approved
        // Re-apply the SAME edited/sentence marker the original save handler set.
        if (marker && marker.map === 'sentences') nSentences[`${marker.keyPart}-${idx}`] = marker.badge || 'edited';
        else if (marker && marker.map === 'fields') nFields[`${marker.keyPart}-${idx}`] = marker.badge || 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  // Stage one DB-bound edit as a DRAFT: persist value + the exact DB payload to localStorage so a
  // Save survives refresh and Approve can replay it. draftKey is unique per editable item.
  const stageDraft = useCallback((id, draftKey, entry) => {
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][draftKey] = entry;
    writeDrafts(store);
  }, []);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

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
    /* dot-path get: "spinalMobility.schober" -> record.spinalMobility.schober */
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { if (val && typeof val === 'object') val = val[p]; else return undefined; }
      return val;
    }
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
        if (Array.isArray(val)) { if (val.some(item => (item && typeof item === 'object') ? Object.values(item).some(v => String(v).toLowerCase().includes(phrase)) : String(item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (Object.entries(val).some(([k, v]) => String(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase))) return true; }
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
      if (Array.isArray(val)) return val.some(item => (item && typeof item === 'object') ? Object.values(item).some(v => String(v).toLowerCase().includes(phrase)) : String(item).toLowerCase().includes(phrase));
      if (typeof val === 'object') return Object.entries(val).some(([k, v]) => String(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Spondyloarthritis Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => (item && typeof item === 'object') ? Object.values(item).some(v => String(v).toLowerCase().includes(phrase)) : String(item).toLowerCase().includes(phrase)) : typeof val === 'object' ? Object.entries(val).some(([k, v]) => String(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
        // Object-subfield edit key shape: "field.arrayIndex.subField-idx" (recommendations)
        const sub = key.match(/^(.+)\.(\d+)\.(.+)-(\d+)$/);
        if (sub && parseInt(sub[4]) === idx) {
          const [, field, arrIdxStr, subField] = sub;
          const arrIdx = parseInt(arrIdxStr);
          const arr = Array.isArray(merged[field]) ? merged[field].map(it => (it && typeof it === 'object' ? { ...it } : it)) : [];
          if (arr[arrIdx] && typeof arr[arrIdx] === 'object') { arr[arrIdx][subField] = localEdits[key]; merged[field] = arr; }
          return;
        }
        // Dynamic-object dot-path key shape: "results.someKey-idx" (set nested, never a flat bogus key)
        const dyn = key.match(/^(results)\.(.+)-(\d+)$/);
        if (dyn && parseInt(dyn[3]) === idx) {
          const [, field, subKey] = dyn;
          const base = (merged[field] && typeof merged[field] === 'object' && !Array.isArray(merged[field])) ? { ...merged[field] } : {};
          base[subKey] = localEdits[key];
          merged[field] = base;
          return;
        }
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB / NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const localKey = `${fn}-${idx}`;
    const trackKey = editTrackingKey || localKey;
    const markerKeyPart = trackKey.endsWith(`-${idx}`) ? trackKey.slice(0, -`-${idx}`.length) : fn;
    setLocalEdits(prev => ({ ...prev, [localKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(id, `field-${fn}`, { lk: fn, value: saveVal, payload: { field: fn, value: saveVal }, marker: { map: 'fields', keyPart: markerKeyPart } });
  }, [editValue, safeId, stageDraft]);

  /* Save one subfield of an object-array item via dot-path (field.arrayIndex.subField) — preserves object shape. */
  const handleSaveObjectSubField = useCallback((record, fn, idx, sid, arrayIndex, subField) => {
    const id = safeId(record); if (!id) return;
    const saveVal = editValue.trim();
    const lk = `${fn}.${arrayIndex}.${subField}`;
    const editKey = `${lk}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, lk, { lk, value: saveVal, payload: { field: fn, value: saveVal, arrayIndex, subField }, marker: { map: 'fields', keyPart: lk } });
  }, [editValue, safeId, stageDraft]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const localKey = `${fn}-${idx}`;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [localKey]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      stageDraft(id, `${fn}-del`, { lk: fn, value: fullText, payload: { field: fn, value: fullText }, marker: { map: 'sentences', keyPart: `${fn}-s${sentenceIdx}` } });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
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
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(id, `${fn}-s${sentenceIdx}`, { lk: fn, value: fullText, payload: { field: fn, value: fullText }, marker: { map: 'sentences', keyPart: `${fn}-s${sentenceIdx}` } });
  }

  function saveCommaItem(record, fn, idx, sid, sIdx, ciIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const s = sentences[sIdx] || '';
    const p = parseLabel(s);
    if (!p.isLabeled) return;
    const items = splitByComma(p.value);
    const trimmed = editValue.trim();
    const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp);
    if (subParts.length > 1) { items.splice(ciIdx, 1, ...subParts); } else { items[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    const rebuilt = `${p.label}: ${items.join(', ')}.`;
    const allS = [...sentences]; allS[sIdx] = rebuilt;
    const fullText = reconstructFullText(allS);
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const sentenceKey = `${fn}-${idx}-s${sIdx}`;
    const commaKey = `${sentenceKey}-c${ciIdx}`;
    const marks = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ciIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
    setEditingField(null); setEditValue('');
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(id, `${fn}-c${sIdx}-${ciIdx}`, { lk: fn, value: fullText, payload: { field: fn, value: fullText }, marker: { map: 'sentences', keyPart: `${fn}-s${sIdx}-c${ciIdx}` } });
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
  // then flag the section approved, clear pending so committed values flow into pdfData/PDF, and
  // drop the committed drafts from localStorage.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // payload.field may be a dot-path for dynamic-object subfields (e.g. "results.someKey") — match on base too.
    const fieldInSection = (pf) => fields.includes(pf) || fields.includes(String(pf).split('.')[0]);
    try {
      // Replay each staged DB write for fields in this section (preserving field/arrayIndex/subField).
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedDraftKeys = [];
      const committedLocalKeys = new Set();
      for (const [draftKey, entry] of Object.entries(recDrafts)) {
        if (!entry || typeof entry !== 'object' || !entry.payload) continue;
        if (!fieldInSection(entry.payload.field)) continue;
        const resp = await secureApiClient.put(`/api/edit/spondyloarthritis_assessment/${id}/edit`, entry.payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedDraftKeys.push(draftKey);
        if (entry.lk !== undefined) committedLocalKeys.add(`${entry.lk}-${idx}`);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/spondyloarthritis_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed values now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedLocalKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage
      if (committedDraftKeys.length > 0) {
        const s2 = readDrafts();
        if (s2[id]) { committedDraftKeys.forEach(k => delete s2[id][k]); if (Object.keys(s2[id]).length === 0) delete s2[id]; writeDrafts(s2); }
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
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
  const copySectionText = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text) => {
    const semiItems = splitBySemicolon(text);
    const raw = semiItems.length >= 2 ? semiItems : splitBySentence(text);
    const lines = []; let n = 1;
    raw.forEach(s => {
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
  }, [splitBySentence, splitBySemicolon]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const showLabelCopy = label.toLowerCase() !== (title || '').toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += showLabelCopy ? `${label}\n${formatDate(val)}\n\n` : `${formatDate(val)}\n\n`;
      } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val.filter(it => it !== null && it !== undefined && it !== '') : [];
        if (arr.length > 0) {
          if (showLabelCopy) text += `${label}\n`;
          const subDefs = OBJECT_ARRAY_SUBFIELDS[f] || [];
          arr.forEach((item, i) => {
            if (typeof item !== 'object' || item === null) { text += `  ${i + 1}. ${String(item)}\n`; return; }
            const knownKeys = subDefs.map(sf => sf.key);
            const allDefs = [...subDefs, ...Object.keys(item).filter(k => !knownKeys.includes(k)).map(k => ({ key: k, label: humanizeKey(k) }))];
            const parts = allDefs.filter(sf => hasVal(item[sf.key])).map(sf => `${sf.label}: ${sf.key === 'date' ? formatDate(item[sf.key]) : String(item[sf.key])}`);
            text += `  ${i + 1}. ${parts.join(' | ')}\n`;
          });
          text += '\n';
        }
      } else if (DYNAMIC_OBJECT_FIELDS.includes(f)) {
        const flatItems = flattenObject(val);
        if (flatItems.length > 0) {
          if (showLabelCopy) text += `${label}\n`;
          flatItems.forEach(item => { text += `  ${item.label}: ${item.value}\n`; });
          text += '\n';
        }
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(Boolean) : [];
        if (items.length > 0) {
          if (showLabelCopy) text += `${label}\n`;
          items.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
          text += '\n';
        }
      } else if (OBJECT_FIELDS.includes(f)) {
        if (showLabelCopy) text += `${label}\n`;
        SPINAL_MOBILITY_KEYS.forEach(key => {
          const kv = val[key];
          if (hasVal(kv)) {
            const keyLabel = FIELD_LABELS[`spinalMobility.${key}`] || key;
            text += `  ${keyLabel}: ${kv}\n`;
          }
        });
        text += '\n';
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const semiItems = splitBySemicolon(strVal);
        const sentences = semiItems.length >= 2 ? semiItems : splitBySentence(strVal);
        if (sentences.length > 1) {
          if (showLabelCopy) text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += showLabelCopy ? `${label}\n${strVal}\n\n` : `${strVal}\n\n`;
        }
      } else {
        text += `${label}\n${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, splitBySemicolon, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== SPONDYLOARTHRITIS ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Spondyloarthritis Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id2, `${fn}-a${itemIdx}`, { lk: fn, value: currentArr, payload: { field: fn, value: editValue, arrayIndex: itemIdx }, marker: { map: 'fields', keyPart: `${fn}.${itemIdx}` } }); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SPINAL MOBILITY OBJECT (nested-subtitle + value row per key) ═══════ */
  const renderSpinalMobilityField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || typeof val !== 'object' || Array.isArray(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {SPINAL_MOBILITY_KEYS.map((key) => {
          const kv = val[key];
          if (!hasVal(kv)) return null;
          const editKey = `${fn}.${key}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const keyLabel = FIELD_LABELS[`spinalMobility.${key}`] || key.replace(/([A-Z])/g, ' $1').trim();
          const displayVal = String(kv);

          return (
            <div key={key} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(keyLabel)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const currentObj = { ...(typeof getFieldValue(record, fn, idx) === 'object' ? getFieldValue(record, fn, idx) : {}) }; currentObj[key] = editValue; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentObj })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id2, `${fn}-k${key}`, { lk: fn, value: currentObj, payload: { field: `${fn}.${key}`, value: editValue }, marker: { map: 'fields', keyPart: `${fn}.${key}` } }); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${keyLabel}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: OBJECT-ARRAY FIELD (recommendations) — per-subfield rows preserve object shape ═══════
     Each editable row saves a single subfield via dot-path field.arrayIndex.subField, so the {…} slot is
     never overwritten with a flat string. Plain-string items get a single slot-preserving row. */
  const renderObjectArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(it => it !== null && it !== undefined && it !== '') : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();
    const subDefs = OBJECT_ARRAY_SUBFIELDS[fn] || [];

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          /* Plain-string item: single editable row preserving the array slot (save via arrayIndex, no subField). */
          if (typeof item !== 'object' || item === null) {
            const itemStr = String(item);
            const editKey = `${fn}.${itemIdx}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            if (searchTerm.trim() && !phraseMatch && !labelMatch && !itemStr.toLowerCase().includes(phrase)) return null;
            return (
              <div key={itemIdx}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const trimmed = editValue.trim(); setSaveError(null); const cur = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : []; cur[itemIdx] = trimmed; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: cur })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, `${fn}-o${itemIdx}`, { lk: fn, value: cur, payload: { field: fn, value: trimmed, arrayIndex: itemIdx }, marker: { map: 'fields', keyPart: `${fn}.${itemIdx}` } }); }}>{saving ? 'Saving...' : 'Save'}</button>
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
          }

          /* Object item: per-subfield editable rows. Unknown keys (not in subDefs) shown too — nothing dropped. */
          const knownKeys = subDefs.map(sf => sf.key);
          const extraDefs = Object.keys(item).filter(k => !knownKeys.includes(k)).map(k => ({ key: k, label: humanizeKey(k) }));
          const allDefs = [...subDefs, ...extraDefs];
          const visibleSubs = allDefs.filter(sf => {
            const sv = localEdits[`${fn}.${itemIdx}.${sf.key}-${idx}`] ?? item[sf.key];
            return sv !== null && sv !== undefined && sv !== '';
          });
          if (visibleSubs.length === 0) return null;
          if (searchTerm.trim() && !phraseMatch && !labelMatch) {
            const anyMatch = visibleSubs.some(sf => { const sv = localEdits[`${fn}.${itemIdx}.${sf.key}-${idx}`] ?? item[sf.key]; return String(sv).toLowerCase().includes(phrase); });
            if (!anyMatch) return null;
          }

          return (
            <div key={itemIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(`${label.replace(/s$/, '')} ${itemIdx + 1}`)}</div>
              {visibleSubs.map(sf => {
                const rawVal = localEdits[`${fn}.${itemIdx}.${sf.key}-${idx}`] ?? item[sf.key];
                const isDateSub = sf.key === 'date';
                const sfDisplay = isDateSub ? formatDate(rawVal) : String(rawVal);
                const sfEditKey = `${fn}.${itemIdx}.${sf.key}-${idx}`;
                const isEditing = editingField === sfEditKey;
                const badge = editedFields[sfEditKey];
                return (
                  <div key={sf.key} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(sf.label)}</div>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sfEditKey); setEditValue(isDateSub ? (toInputDate(rawVal) || String(rawVal)) : String(rawVal)); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          {isDateSub ? (
                            <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          ) : (
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          )}
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isDateSub && editValue && isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveObjectSubField(record, fn, idx, sid, itemIdx, sf.key); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(sfDisplay)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[sfEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${sfDisplay}`, sfEditKey); }}>{copiedItems[sfEditKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: DYNAMIC-KEY OBJECT FIELD (results) — humanized keys + typed leaves + dot-path save ═══════ */
  const renderDynamicObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
    const flatItems = flattenObject(val);
    if (flatItems.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {flatItems.map((item) => {
          const editKey = `${fn}.${item.key}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = item.label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !item.value.toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={item.key} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(item.label)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(item.value); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, `${fn}.${item.key}`, idx, sid, null, editValue, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(item.value)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${item.label}: ${item.value}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: STRING FIELD with saveSentence + splitBySemicolon pre-split ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const semiItems = splitBySemicolon(strVal);
    const sentences = semiItems.length >= 2 ? semiItems : splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySemicolon / splitBySentence */
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
              if (parsed.isLabeled) {
                const semiSub = splitBySemicolon(parsed.value);
                const commaItems = semiSub.length >= 2 ? semiSub : splitByComma(parsed.value);
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                            {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              /* Regular sentence row — always in rec-mini-card */
              return (
                <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id = safeId(record); if (!id) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, `${fn}-ls${sIdx}`, { lk: fn, value: fullText, payload: { field: fn, value: fullText }, marker: { map: 'sentences', keyPart: `${fn}-s${sIdx}` } }); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

    /* Single-value: check for labeled comma items (e.g., "Phone: xxx, Fax: xxx, Email: xxx") */
    const singleCommaItems = splitByComma(strVal);
    const labeledCommaItems = singleCommaItems.length >= 2 && singleCommaItems.some(ci => parseLabel(ci).isLabeled);

    if (labeledCommaItems) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {singleCommaItems.map((ci, ciIdx) => {
              const ciParsed = parseLabel(ci);
              const commaKey = `${fn}-${idx}-s0-c${ciIdx}`;
              const ciEditing = editingField === commaKey;
              const ciBadge = editedSentences[commaKey];
              const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
              if (!ciMatches && searchTerm.trim()) return null;

              if (ciParsed.isLabeled) {
                /* Determine input type based on label */
                const lbl = ciParsed.label.toLowerCase();
                const isPhone = lbl.includes('phone') || lbl.includes('fax') || lbl.includes('tel') || lbl.includes('mobile') || lbl.includes('cell');
                const isEmail = lbl.includes('email') || lbl.includes('e-mail');

                const validateAndSave = (e) => {
                  e.stopPropagation();
                  const trimmed = editValue.trim();
                  if (!trimmed) { setSaveError('Value cannot be empty'); return; }
                  if (isPhone && !/^[\d\s()+-]+$/.test(trimmed)) { setSaveError('Please enter a valid phone number (digits, spaces, parentheses, +, -)'); return; }
                  if (isEmail && !trimmed.includes('@')) { setSaveError('Please enter a valid email address (must contain @)'); return; }
                  const id = safeId(record); if (!id) return;
                  const allItems = splitByComma(String(getFieldValue(record, fn, idx) || ''));
                  allItems[ciIdx] = `${ciParsed.label}: ${trimmed}`;
                  const fullText = allItems.join(', ');
                  setSaveError(null);
                  setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
                  setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
                  setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
                  setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                  setEditingField(null); setEditValue('');
                  stageDraft(id, `${fn}-sc${ciIdx}`, { lk: fn, value: fullText, payload: { field: fn, value: fullText }, marker: { map: 'sentences', keyPart: `${fn}-s0-c${ciIdx}` } });
                };

                return (
                  <div key={ciIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(ciParsed.label)}</div>
                    <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ciParsed.value); setSaveError(null); } }}>
                      {ciEditing ? (
                        <div className="edit-field-container">
                          <input
                            type={isPhone ? 'tel' : isEmail ? 'email' : 'text'}
                            className="edit-textarea"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            autoFocus
                            placeholder={isPhone ? '(555) 555-0000' : isEmail ? 'name@example.com' : ''}
                            onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { validateAndSave(e); } }}
                          />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={validateAndSave}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(ciParsed.value)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${ciParsed.label}: ${ciParsed.value}`, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added' : 'edited'} - click Pending Approve to save</span>}
                  </div>
                );
              }

              /* Non-labeled comma item */
              return (
                <div key={ciIdx}>
                  <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                    {ciEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => {
                            e.stopPropagation();
                            const id = safeId(record); if (!id) return;
                            const allItems = splitByComma(String(getFieldValue(record, fn, idx) || ''));
                            allItems[ciIdx] = editValue.trim();
                            const fullText = allItems.join(', ');
                            setSaveError(null);
                            setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
                            setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
                            setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
                            setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                            setEditingField(null); setEditValue('');
                            stageDraft(id, `${fn}-nc${ciIdx}`, { lk: fn, value: fullText, payload: { field: fn, value: fullText }, marker: { map: 'sentences', keyPart: `${fn}-s0-c${ciIdx}` } });
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
                  {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added' : 'edited'} - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value string (no comma items): saveSentence editable */
    const editKey = `${fn}-${idx}`;
    const singleEditKey = `${fn}-${idx}-s0`;
    const isEditing = editingField === singleEditKey;
    const isModified = editedFields[editKey] || editedSentences[singleEditKey];

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(singleEditKey); setEditValue(strVal); setSaveError(null); } }}>
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
              <button className={`copy-btn ${copiedItems[singleEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, singleEditKey); }}>{copiedItems[singleEditKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className={`modified-badge ${isModified === 'added' ? 'added' : ''}`}>edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
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
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySectionText(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderObjectArrayField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (DYNAMIC_OBJECT_FIELDS.includes(f)) return renderDynamicObjectField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderSpinalMobilityField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="spondyloarthritis-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Spondyloarthritis Assessment</h2></div>
        <div className="empty-state">No spondyloarthritis assessment records available</div>
      </div>
    );
  }

  return (
    <div className="spondyloarthritis-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Spondyloarthritis Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<SpondyloarthritisAssessmentDocumentPDFTemplate document={pdfData} />} fileName={`spondyloarthritis-assessment-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search spondyloarthritis assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{highlightText(formatDate(record.date))}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(`Spondyloarthritis Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'record-info')}
            {renderSection(record, idx, 'disease-scores')}
            {renderSection(record, idx, 'sacroiliitis')}
            {renderSection(record, idx, 'spinal-mobility')}
            {renderSection(record, idx, 'extra-articular')}
            {renderSection(record, idx, 'findings')}
            {renderSection(record, idx, 'assessment')}
            {renderSection(record, idx, 'plan')}
            {renderSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpondyloarthritisAssessmentDocument;
