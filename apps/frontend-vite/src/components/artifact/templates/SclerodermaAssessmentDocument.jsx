/**
 * SclerodermaAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: scleroderma_assessment
 *
 * 7 Sections:
 *   1. classification: type
 *   2. skin-thickness: skinThickness.mrodnanScore, skinThickness.distribution
 *   3. raynauds: raynaudsPhenomenon.severity, raynaudsPhenomenon.digitalUlcers, raynaudsPhenomenon.nailfoldCapillaroscopy
 *   4. organ-involvement: internalOrganInvolvement.pulmonary, internalOrganInvolvement.cardiac, internalOrganInvolvement.renal, internalOrganInvolvement.gastrointestinal
 *   5. clinical-summary: findings, assessment, plan
 *   6. recommendations-notes: notes
 *   7. provider-info: provider, facility
 *
 *   recommendations array rendered separately
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SclerodermaAssessmentDocumentPDFTemplate from '../pdf-templates/SclerodermaAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './SclerodermaAssessmentDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'classification': 'Classification',
  'skin-thickness': 'Skin Thickness',
  'raynauds': "Raynaud's Phenomenon",
  'organ-involvement': 'Internal Organ Involvement',
  'clinical-summary': 'Clinical Summary',
  'recommendations-notes': 'Recommendations & Notes',
  'provider-info': 'Provider Information',
};

const FIELD_LABELS = {
  type: 'Type',
  'skinThickness.mrodnanScore': 'Modified Rodnan Score',
  'skinThickness.distribution': 'Distribution',
  'raynaudsPhenomenon.severity': 'Severity',
  'raynaudsPhenomenon.digitalUlcers': 'Digital Ulcers',
  'raynaudsPhenomenon.nailfoldCapillaroscopy': 'Nailfold Capillaroscopy',
  'internalOrganInvolvement.pulmonary': 'Pulmonary',
  'internalOrganInvolvement.cardiac': 'Cardiac',
  'internalOrganInvolvement.renal': 'Renal',
  'internalOrganInvolvement.gastrointestinal': 'Gastrointestinal',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  provider: 'Provider',
  facility: 'Facility',
};

const SECTION_FIELDS = {
  'classification': ['type'],
  'skin-thickness': ['skinThickness.mrodnanScore', 'skinThickness.distribution'],
  'raynauds': ['raynaudsPhenomenon.severity', 'raynaudsPhenomenon.digitalUlcers', 'raynaudsPhenomenon.nailfoldCapillaroscopy'],
  'organ-involvement': ['internalOrganInvolvement.pulmonary', 'internalOrganInvolvement.cardiac', 'internalOrganInvolvement.renal', 'internalOrganInvolvement.gastrointestinal'],
  'clinical-summary': ['findings', 'assessment', 'plan'],
  'recommendations-notes': ['notes'],
  'provider-info': ['provider', 'facility'],
};

const BOOLEAN_FIELDS = ['raynaudsPhenomenon.digitalUlcers'];
const DATE_FIELDS = [];
const NUMBER_FIELDS = [];

// ─── Defer-save draft store (localStorage) ────────────────────────────────────
// Save stages a local DRAFT only; Approve is the ONLY path that writes to MongoDB.
// Shape: { [recordId]: { [dbFieldPath]: value } } — dbFieldPath is the EXACT PUT
// field each save site computes (flat/dotted field, dotted object-leaf, array-element).
const DRAFT_KEY = 'scleroderma_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
};
const writeDrafts = (store) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); } catch { /* ignore */ }
};
const stageDraft = (recId, dbField, value) => {
  if (!recId) return;
  const store = readDrafts();
  store[recId] = { ...(store[recId] || {}), [dbField]: value };
  writeDrafts(store);
};

/* ═══════ DYNAMIC-KEY OBJECT (results) HELPERS ═══════ */
const KEY_OVERRIDES = {
  dlco: 'DLCO', fvc: 'FVC', ef: 'EF', rvsp: 'RVSP', pah: 'PAH', ild: 'ILD',
  bp: 'BP', gerd: 'GERD', hrct: 'HRCT', mrss: 'mRSS', scl70: 'Scl-70', ana: 'ANA',
  gi: 'GI', pft: 'PFT', pfts: 'PFTs',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const low = String(key).toLowerCase();
  if (KEY_OVERRIDES[low]) return KEY_OVERRIDES[low];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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
/* flatten dynamic object to [{ path, label, value }] leaves (typed-aware), dot-path for save */
const flattenResults = (obj, basePath = 'results', labelPrefix = '') => {
  const out = [];
  if (!obj || typeof obj !== 'object') return out;
  const entries = Array.isArray(obj) ? obj.map((v, i) => [String(i), v]) : Object.entries(obj);
  entries.forEach(([k, v]) => {
    if (isEmptyDeep(v)) return;
    const label = Array.isArray(obj) ? `${labelPrefix}${labelPrefix ? ' ' : ''}${Number(k) + 1}` : `${labelPrefix}${labelPrefix ? ' — ' : ''}${humanizeKey(k)}`;
    const path = `${basePath}.${k}`;
    if (isScalar(v)) out.push({ path, label, value: v });
    else out.push(...flattenResults(v, path, label));
  });
  return out;
};
const STRING_FIELDS = [
  'type',
  'skinThickness.mrodnanScore', 'skinThickness.distribution',
  'raynaudsPhenomenon.severity', 'raynaudsPhenomenon.nailfoldCapillaroscopy',
  'internalOrganInvolvement.pulmonary', 'internalOrganInvolvement.cardiac',
  'internalOrganInvolvement.renal', 'internalOrganInvolvement.gastrointestinal',
  'findings', 'assessment', 'plan', 'notes',
  'provider', 'facility',
];

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

/* ═══════ COMPONENT ═══════ */
const SclerodermaAssessmentDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
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
      if (r?.scleroderma_assessment) return Array.isArray(r.scleroderma_assessment) ? r.scleroderma_assessment : [r.scleroderma_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.scleroderma_assessment) return Array.isArray(dd.scleroderma_assessment) ? dd.scleroderma_assessment : [dd.scleroderma_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* get nested dot-path value from record, with localEdits override */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { if (val == null) return undefined; val = val[p]; }
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
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
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
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Scleroderma Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      /* recommendations array */
      const recs = Array.isArray(record.recommendations) ? record.recommendations : [];
      for (const r of recs) {
        const txt = typeof r === 'string' ? r : r?.recommendation || r?.text || '';
        if (txt.toLowerCase().includes(phrase)) return true;
      }
      /* results dynamic-key object */
      const resVal = getFieldValue(record, 'results', idx);
      if (resVal && typeof resVal === 'object' && !Array.isArray(resVal)) {
        if ('results'.includes(phrase) || phrase.includes('results')) return true;
        for (const l of flattenResults(resVal, 'results', '')) {
          if (l.label.toLowerCase().includes(phrase) || fmtScalar(l.value).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      /* deep-clone nested objects before applying edits */
      if (record.skinThickness) merged.skinThickness = { ...record.skinThickness };
      if (record.raynaudsPhenomenon) merged.raynaudsPhenomenon = { ...record.raynaudsPhenomenon };
      if (record.internalOrganInvolvement) merged.internalOrganInvolvement = { ...record.internalOrganInvolvement };
      if (record.results && typeof record.results === 'object') merged.results = JSON.parse(JSON.stringify(record.results));
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // un-approved draft stays OUT of PDF/Copy All
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          if (fn.includes('.')) {
            const parts = fn.split('.');
            if (parts.length === 2 && merged[parts[0]]) {
              merged[parts[0]][parts[1]] = localEdits[key];
            }
          } else {
            merged[fn] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // DEFER-SAVE: rehydrate staged drafts on mount so a Save survives refresh (shown in
  // JSX, kept OUT of DB/PDF until Approve). Whole-field drafts (SECTION_FIELDS entries,
  // incl. dotted ones) store the value directly; results/recommendations leaf drafts
  // reconstruct into the whole object/array. Markers re-light each Pending Approve button.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const wholeFields = new Set(Object.values(SECTION_FIELDS).flat());
    const le = {}, pe = {}, ef = {};
    filteredRecords.forEach((rec, idx) => {
      const id = safeId(rec);
      const drafts = id && store[id];
      if (!drafts) return;
      for (const [dbField, value] of Object.entries(drafts)) {
        const root = dbField.split('.')[0];
        if (wholeFields.has(dbField)) {
          le[`${dbField}-${idx}`] = value;
          pe[`${dbField}-${idx}`] = true;
        } else if (root === 'results' || root === 'recommendations') {
          const rest = dbField.split('.').slice(1);
          const key = `${root}-${idx}`;
          const seed = rec[root] ?? (root === 'recommendations' ? [] : {});
          const base = le[key] !== undefined ? le[key] : JSON.parse(JSON.stringify(seed));
          let node = base;
          for (let i = 0; i < rest.length - 1; i++) {
            if (node[rest[i]] == null) node[rest[i]] = /^\d+$/.test(rest[i + 1]) ? [] : {};
            node = node[rest[i]];
          }
          if (rest.length) node[rest[rest.length - 1]] = value;
          le[key] = base;
          pe[key] = true;
        } else {
          le[`${dbField}-${idx}`] = value;
          pe[`${dbField}-${idx}`] = true;
        }
        ef[`${dbField}-${idx}`] = 'edited';
      }
    });
    if (Object.keys(le).length) {
      setLocalEdits(prev => ({ ...le, ...prev }));
      setPendingEdits(prev => ({ ...pe, ...prev }));
      setEditedFields(prev => ({ ...ef, ...prev }));
    }
  }, [filteredRecords]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    // DEFER-SAVE: stage a local draft only; Approve commits to the DB.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, fn, saveVal);
  }, [editValue, safeId]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    // DEFER-SAVE: stage a local draft only; Approve commits to the DB.
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      setEditingField(null); setEditValue('');
      stageDraft(id, fn, fullText);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
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
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, fn, fullText);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // DEFER-SAVE: commit (replay to /edit) the record's staged drafts matching a
  // predicate, drop them from the store, and clear their pendingEdits. Returns ok.
  const commitDrafts = useCallback(async (record, idx, matches) => {
    const id = safeId(record); if (!id) return false;
    const store = readDrafts();
    const recordDrafts = store[id] || {};
    const toCommit = Object.entries(recordDrafts).filter(([f]) => matches(f));
    try {
      for (const [field, value] of toCommit) {
        await secureApiClient.put(`/api/edit/scleroderma_assessment/${id}/edit`, { field, value });
      }
    } catch (err) { console.error('[SclerodermaAssessment] commit error:', err); return false; }
    if (toCommit.length) {
      const remaining = { ...recordDrafts };
      toCommit.forEach(([f]) => delete remaining[f]);
      if (Object.keys(remaining).length) store[id] = remaining; else delete store[id];
      writeDrafts(store);
      const clear = new Set(toCommit.flatMap(([d]) => [`${d}-${idx}`, `${d.split('.')[0]}-${idx}`]));
      setPendingEdits(prev => { const n = { ...prev }; clear.forEach(k => delete n[k]); return n; });
    }
    return true;
  }, [safeId]);

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const ok = await commitDrafts(record, idx, (f) => fields.some(ff => f === ff || f.startsWith(`${ff}.`)));
    if (!ok) return;
    try {
      await secureApiClient.put(`/api/edit/scleroderma_assessment/${id}/approve`, { sectionId: sid, approved: true });
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, commitDrafts]);

  // Dedicated approve handlers for the recommendations/results sections (their own
  // inline approve buttons), each replaying only their own staged drafts.
  const approveRecommendations = useCallback(async (record, idx) => {
    const id = safeId(record); if (!id) return;
    const ok = await commitDrafts(record, idx, (f) => f === 'recommendations' || f.startsWith('recommendations.'));
    if (!ok) return;
    try {
      await secureApiClient.put(`/api/edit/scleroderma_assessment/${id}/approve`, { sectionId: 'recommendations', approved: true });
      setApprovedSections(prev => ({ ...prev, [`recommendations-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith('recommendations.') && k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, commitDrafts]);

  const approveResults = useCallback(async (record, idx) => {
    const id = safeId(record); if (!id) return;
    const ok = await commitDrafts(record, idx, (f) => f === 'results' || f.startsWith('results.'));
    if (!ok) return;
    try {
      await secureApiClient.put(`/api/edit/scleroderma_assessment/${id}/approve`, { sectionId: 'results', approved: true });
      setApprovedSections(prev => ({ ...prev, [`results-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith('results.') && k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, commitDrafts]);

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

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}: ${val ? 'Yes' : 'No'}\n\n`;
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

  const copyAllText = useCallback(async () => {
    let text = '=== SCLERODERMA ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Scleroderma Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (r.date) text += `Date: ${formatDate(r.date)}\n`;
      if (r.status) text += `Status: ${r.status}\n`;
      text += '\n';
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      /* recommendations */
      const recs = Array.isArray(r.recommendations) ? r.recommendations : [];
      if (recs.length > 0) {
        text += `Recommendations\n${'='.repeat(40)}\n\n`;
        recs.forEach((rec, i) => {
          const txt = typeof rec === 'string' ? rec : rec?.recommendation || rec?.text || JSON.stringify(rec);
          text += `${i + 1}. ${txt}\n`;
        });
        text += '\n';
      }
      /* results dynamic-key object */
      if (r.results && typeof r.results === 'object' && !Array.isArray(r.results)) {
        const leaves = flattenResults(r.results, 'results', '');
        if (leaves.length > 0) {
          text += `Results\n${'='.repeat(40)}\n\n`;
          leaves.forEach(l => { text += `${l.label}: ${fmtScalar(l.value)}\n`; });
          text += '\n';
        }
      }
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: BOOLEAN FIELD — select Yes/No, convert to boolean on save ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) && val !== false) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText2 })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id2, fn, fullText2); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                            {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(safeId(record), fn, fullText); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

    /* Single-value string: simple editable */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
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
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS ARRAY (per-item editing with dot-path) ═══════ */
  const renderRecommendations = (record, idx) => {
    const effRecs = getFieldValue(record, 'recommendations', idx);
    const recs = Array.isArray(effRecs) ? effRecs : (Array.isArray(record.recommendations) ? record.recommendations : []);
    if (recs.length === 0) return null;
    const sid = 'recommendations-notes';
    const title = 'Recommendations';

    if (searchTerm.trim()) {
      const phrase = searchTerm.toLowerCase().trim();
      const titleMatch = title.toLowerCase().includes(phrase) || phrase.includes(title.toLowerCase());
      if (!titleMatch && !record._showAllSections) {
        const anyMatch = recs.some(r => {
          const txt = typeof r === 'string' ? r : r?.recommendation || r?.text || '';
          return txt.toLowerCase().includes(phrase);
        });
        if (!anyMatch) return null;
      }
    }

    const copyId = `recommendations-${idx}`;
    const recTexts = recs.map(r => typeof r === 'string' ? r : r?.recommendation || r?.text || JSON.stringify(r));
    const copyText = `Recommendations\n${'='.repeat(40)}\n\n${recTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

    /* Check if recommendations section has edits */
    const hasRecsEdits = Object.keys(editedFields).some(k => k.startsWith('recommendations.') && k.endsWith(`-${idx}`));
    const isRecsApproved = approvedSections[`recommendations-${idx}`];

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(copyText, copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {hasRecsEdits ? (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); approveRecommendations(record, idx); }}>Pending Approve</button>) : isRecsApproved ? <span className="approve-btn approved">Approved</span> : null}
            </div>
          </div>
          <div className="rec-mini-card">
            {recs.map((rec, itemIdx) => {
              const recText = typeof rec === 'string' ? rec : rec?.recommendation || rec?.text || JSON.stringify(rec);
              const editKey = `recommendations.${itemIdx}.recommendation-${idx}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];

              if (searchTerm.trim() && !record._showAllSections) {
                const phrase = searchTerm.toLowerCase().trim();
                const titleMatch = title.toLowerCase().includes(phrase) || phrase.includes(title.toLowerCase());
                if (!titleMatch && !recText.toLowerCase().includes(phrase)) return null;
              }

              return (
                <div key={itemIdx}>
                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} style={{ marginBottom: itemIdx < recs.length - 1 ? 8 : 0 }} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(recText); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const arr = JSON.parse(JSON.stringify(getFieldValue(record, 'recommendations', idx) || record.recommendations || [])); arr[itemIdx] = (arr[itemIdx] && typeof arr[itemIdx] === 'object') ? { ...arr[itemIdx], recommendation: editValue } : { recommendation: editValue }; setLocalEdits(prev => ({ ...prev, [`recommendations-${idx}`]: arr })); setPendingEdits(prev => ({ ...prev, [`recommendations-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`recommendations-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, `recommendations.${itemIdx}.recommendation`, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(recText, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RESULTS (dynamic-key object, typed leaves, dot-path save) ═══════ */
  const renderResults = (record, idx) => {
    const resultsObj = getFieldValue(record, 'results', idx);
    if (!hasVal(resultsObj) || typeof resultsObj !== 'object' || Array.isArray(resultsObj)) return null;
    const leaves = flattenResults(resultsObj, 'results', '');
    if (leaves.length === 0) return null;
    const title = 'Results';

    /* search gating */
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const titleMatch = title.toLowerCase().includes(phrase) || phrase.includes(title.toLowerCase());
      const anyLeaf = leaves.some(l => l.label.toLowerCase().includes(phrase) || fmtScalar(l.value).toLowerCase().includes(phrase));
      if (!titleMatch && !anyLeaf) return null;
    }

    const copyId = `results-${idx}`;
    const copyText = `Results\n${'='.repeat(40)}\n\n${leaves.map(l => `${l.label}: ${fmtScalar(l.value)}`).join('\n')}`;
    const hasResultsEdits = Object.keys(editedFields).some(k => k.startsWith('results.') && k.endsWith(`-${idx}`));
    const isResultsApproved = approvedSections[`results-${idx}`];

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(copyText, copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {hasResultsEdits ? (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); approveResults(record, idx); }}>Pending Approve</button>) : isResultsApproved ? <span className="approve-btn approved">Approved</span> : null}
            </div>
          </div>
          <div className="rec-mini-card">
            {leaves.map((leaf, lIdx) => {
              const editKey = `${leaf.path}-${idx}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];
              const isNum = typeof leaf.value === 'number';
              const isBool = typeof leaf.value === 'boolean';
              const displayVal = fmtScalar(leaf.value);
              if (searchTerm.trim() && !record._showAllSections) {
                const phrase = searchTerm.toLowerCase().trim();
                const titleMatch = title.toLowerCase().includes(phrase) || phrase.includes(title.toLowerCase());
                if (!titleMatch && !leaf.label.toLowerCase().includes(phrase) && !displayVal.toLowerCase().includes(phrase)) return null;
              }
              return (
                <div key={leaf.path}>
                  <div className="nested-subtitle">{highlightText(leaf.label)}</div>
                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} style={{ marginBottom: lIdx < leaves.length - 1 ? 8 : 0 }} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        {isBool ? (
                          <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        ) : isNum ? (
                          <input type="number" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        ) : (
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        )}
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; let saveVal = editValue; if (isBool) saveVal = editValue === 'Yes'; else if (isNum) { const p = parseFloat(editValue); saveVal = isNaN(p) ? editValue : p; } setLocalEdits(prev => { const cur = getFieldValue(record, 'results', idx); const clone = JSON.parse(JSON.stringify(cur && typeof cur === 'object' ? cur : {})); const parts = leaf.path.split('.').slice(1); let node = clone; for (let pi = 0; pi < parts.length - 1; pi++) { if (node[parts[pi]] == null || typeof node[parts[pi]] !== 'object') node[parts[pi]] = {}; node = node[parts[pi]]; } node[parts[parts.length - 1]] = saveVal; return { ...prev, [`results-${idx}`]: clone }; }); setPendingEdits(prev => ({ ...prev, [`results-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`results-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, leaf.path, saveVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${leaf.label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        </div>
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
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="scleroderma-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Scleroderma Assessment</h2></div>
        <div className="empty-state">No scleroderma assessment records available</div>
      </div>
    );
  }

  return (
    <div className="scleroderma-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Scleroderma Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<SclerodermaAssessmentDocumentPDFTemplate document={pdfData} />} fileName={`scleroderma-assessment-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search scleroderma assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date || record.createdAt) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date || record.createdAt)}</span>
                  {record.status && <span className="record-status">{record.status}</span>}
                </div>
              )}
              <h3 className="record-name">{highlightText(record.type || `Scleroderma Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'classification')}
            {renderSection(record, idx, 'skin-thickness')}
            {renderSection(record, idx, 'raynauds')}
            {renderSection(record, idx, 'organ-involvement')}
            {renderSection(record, idx, 'clinical-summary')}
            {renderRecommendations(record, idx)}
            {renderResults(record, idx)}
            {renderSection(record, idx, 'recommendations-notes')}
            {renderSection(record, idx, 'provider-info')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SclerodermaAssessmentDocument;
