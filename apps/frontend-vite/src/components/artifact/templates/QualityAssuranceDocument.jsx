/**
 * QualityAssuranceDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: quality_assurance
 *
 * 6 Sections:
 *   1. record-info: date, type, provider, facility, status
 *   2. outside-consultation: outsideConsultationRecommendation.recommended, .institution, .reason, .specialty
 *   3. peer-review: peerReview
 *   4. clinical-details: findings, assessment, plan
 *   5. recommendations-section: recommendations (array-of-objects), qualityMetrics (array), results (dynamic-key object)
 *   6. notes-section: notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import QualityAssuranceDocumentPDFTemplate from '../pdf-templates/QualityAssuranceDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './QualityAssuranceDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'outside-consultation': 'Outside Consultation Recommendation',
  'peer-review': 'Peer Review',
  'clinical-details': 'Clinical Details',
  'recommendations-section': 'Recommendations',
  'notes-section': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'outsideConsultationRecommendation.recommended': 'Recommended',
  'outsideConsultationRecommendation.institution': 'Institution',
  'outsideConsultationRecommendation.reason': 'Reason',
  'outsideConsultationRecommendation.specialty': 'Specialty',
  peerReview: 'Peer Review',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  qualityMetrics: 'Quality Metrics',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'type', 'provider', 'facility', 'status'],
  'outside-consultation': ['outsideConsultationRecommendation.recommended', 'outsideConsultationRecommendation.institution', 'outsideConsultationRecommendation.reason', 'outsideConsultationRecommendation.specialty'],
  'peer-review': ['peerReview'],
  'clinical-details': ['findings', 'assessment', 'plan'],
  'recommendations-section': ['recommendations', 'qualityMetrics', 'results'],
  'notes-section': ['notes'],
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fn]: { value, fields: { [trackPart]: badge }, sentences: { [trackPart]: badge } } } }
   trackPart has the record's "-<idx>" suffix STRIPPED so it can be re-mapped to the render index. */
const DRAFT_KEY = 'quality_assurancePendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const BOOLEAN_FIELDS = ['outsideConsultationRecommendation.recommended'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['recommendations', 'qualityMetrics'];
const OBJECT_FIELDS = ['results'];
const ENUM_OPTIONS = { status: ['Complete', 'Pending', 'In Progress', 'Draft', 'Reviewed'] };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(28);
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

/* humanizeKey: dynamic object key -> Title Case label */
const humanizeKey = (k) => {
  if (!k && k !== 0) return '';
  return String(k)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'outsideConsultationRecommendation.institution', 'outsideConsultationRecommendation.reason', 'outsideConsultationRecommendation.specialty', 'peerReview', 'findings', 'assessment', 'plan', 'notes'];
const COMMA_SPLIT_FIELDS = ['findings', 'assessment', 'plan', 'notes'];

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
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
const QualityAssuranceDocument = ({ document: docProp, data, templateData }) => {
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
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (r?.quality_assurance) return Array.isArray(r.quality_assurance) ? r.quality_assurance : [r.quality_assurance];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.quality_assurance) return Array.isArray(dd.quality_assurance) ? dd.quality_assurance : [dd.quality_assurance]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  const recId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Stored trackParts have the idx stripped; re-suffix with the current render idx. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = recId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fn, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        const editKey = `${fn}-${idx}`;
        nLocal[editKey] = entry.value;
        nPending[editKey] = true;
        Object.entries(entry.fields || {}).forEach(([trackPart, badge]) => { nFields[`${trackPart}-${idx}`] = badge; });
        Object.entries(entry.sentences || {}).forEach(([trackPart, badge]) => { nSentences[`${trackPart}-${idx}`] = badge; });
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, recId]);

  /* stageDraft — central helper: stage a DRAFT locally (NO DB write) + persist to localStorage.
     editKey = `${fn}-${idx}`. trackKind is 'fields' or 'sentences'; trackKey is the FULL key (with idx).
     Clears the section's approvedSections key so a re-edit returns to yellow Pending Approve. */
  const stageDraft = useCallback((record, fn, idx, sid, editKey, value, trackKind, trackKey, badge) => {
    const rid = recId(record); if (!rid) return;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (trackKind === 'sentences') setEditedSentences(prev => ({ ...prev, [trackKey]: badge || 'edited' }));
    else setEditedFields(prev => ({ ...prev, [trackKey]: badge || 'edited' }));
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Persist: store the merged value under fn, plus the idx-stripped track key so refresh re-maps it.
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    if (!store[rid][fn]) store[rid][fn] = { value, fields: {}, sentences: {} };
    store[rid][fn].value = value;
    const suffix = `-${idx}`;
    const trackPart = trackKey.endsWith(suffix) ? trackKey.slice(0, -suffix.length) : trackKey;
    if (trackKind === 'sentences') { if (!store[rid][fn].sentences) store[rid][fn].sentences = {}; store[rid][fn].sentences[trackPart] = badge || 'edited'; }
    else { if (!store[rid][fn].fields) store[rid][fn].fields = {}; store[rid][fn].fields[trackPart] = badge || 'edited'; }
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [recId]);

  /* stageDraftSentences — like stageDraft but applies MULTIPLE editedSentences marks at once
     (labeled / comma sentence edits that may add extra "added" rows). value is the full field text. */
  const stageDraftSentences = useCallback((record, fn, idx, sid, value, marks) => {
    const rid = recId(record); if (!rid) return;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: value }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, ...marks }));
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    if (!store[rid][fn]) store[rid][fn] = { value, fields: {}, sentences: {} };
    store[rid][fn].value = value;
    if (!store[rid][fn].sentences) store[rid][fn].sentences = {};
    const suffix = `-${idx}`;
    Object.entries(marks).forEach(([k, badge]) => {
      // k = `${fn}-${idx}-s..` → strip the `-${idx}` that immediately follows fn
      const part = k.startsWith(`${fn}${suffix}`) ? `${fn}${k.slice(`${fn}${suffix}`.length)}` : k;
      store[rid][fn].sentences[part] = badge;
    });
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [recId]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const protectedText = text
      .replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\./gi, '$1<prd>')
      .replace(/\b([A-Z])\.(?=\s*[A-Z]\.)/g, '$1<prd>')
      .replace(/\b(\d+)\.(?=\d)/g, '$1<prd>');
    return protectedText
      .split(/[.;](?:\s+|$)/)
      .map(s => s.replace(/<prd>/g, '.').trim())
      .filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* getFieldValue — supports dot-path (outsideConsultationRecommendation.recommended) */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; }
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
  const shouldShowSection = useCallback((record, sid, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, idx);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (JSON.stringify(val).toLowerCase().includes(phrase)) return true; }
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
      if (Array.isArray(val)) return val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase));
      if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Quality Assurance ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase)) : (typeof val === 'object' ? JSON.stringify(val).toLowerCase().includes(phrase) : fmtVal(val).toLowerCase().includes(phrase)))) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      if (record.outsideConsultationRecommendation) {
        merged.outsideConsultationRecommendation = { ...record.outsideConsultationRecommendation };
      }
      if (record.results && typeof record.results === 'object' && !Array.isArray(record.results)) {
        merged.results = { ...record.results };
      }
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          if (fn.includes('.')) {
            const parts = fn.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]]) merged[parts[0]] = {};
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

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    // Stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, fn, idx, sid, `${fn}-${idx}`, saveVal, 'fields', trackKey, 'edited');
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage a DRAFT (no DB write). Approve commits it.
      stageDraft(record, fn, idx, sid, `${fn}-${idx}`, fullText, 'sentences', `${fn}-${idx}-s${sentenceIdx}`, 'edited');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    // Stage a DRAFT (no DB write). Approve commits it.
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const extra = newSentences.length - 1;
    const marks = {};
    if (changed) marks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    for (let ei = 0; ei < extra; ei++) marks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Persist draft (value + sentence track-marks, idx stripped).
    const rid = recId(record);
    if (rid) {
      const store = readDrafts();
      if (!store[rid]) store[rid] = {};
      if (!store[rid][fn]) store[rid][fn] = { value: fullText, fields: {}, sentences: {} };
      store[rid][fn].value = fullText;
      if (!store[rid][fn].sentences) store[rid][fn].sentences = {};
      Object.entries(marks).forEach(([k, badge]) => { store[rid][fn].sentences[k.slice(0, -`-${idx}`.length)] = badge; });
      writeDrafts(store);
    }
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
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
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Build the per-edit DB payloads for this section's pending fields from the tracking keys.
      const committedKeys = []; // localEdits keys (`${f}-${idx}`) committed → clear from pendingEdits
      for (const f of fields) {
        const editKey = `${f}-${idx}`;
        if (!pendingEdits[editKey]) continue;
        const stagedVal = localEdits[editKey];
        committedKeys.push(editKey);

        if (ARRAY_FIELDS.includes(f)) {
          // Array field: stagedVal is the whole array. Replay each tracked element/subfield edit.
          const arr = Array.isArray(stagedVal) ? stagedVal : [];
          // object-subfield tracks: `${f}.${itemIdx}.${subKey}-${idx}`
          // string-item tracks:     `${f}.${itemIdx}-${idx}`  (trailing segment numeric)
          const seen = new Set();
          for (const tk of Object.keys(editedFields)) {
            if (!tk.startsWith(`${f}.`) || !tk.endsWith(`-${idx}`)) continue;
            const mid = tk.slice(`${f}.`.length, -`-${idx}`.length); // "itemIdx" or "itemIdx.subKey"
            if (seen.has(mid)) continue; seen.add(mid);
            const dot = mid.indexOf('.');
            if (dot === -1) {
              const itemIdx = parseInt(mid, 10);
              if (Number.isNaN(itemIdx)) continue;
              await secureApiClient.put(`/api/edit/quality_assurance/${id}/edit`, { field: `${f}.${itemIdx}`, value: arr[itemIdx] });
            } else {
              const itemIdx = parseInt(mid.slice(0, dot), 10);
              const subKey = mid.slice(dot + 1);
              if (Number.isNaN(itemIdx)) continue;
              const subVal = arr[itemIdx] && typeof arr[itemIdx] === 'object' ? arr[itemIdx][subKey] : undefined;
              await secureApiClient.put(`/api/edit/quality_assurance/${id}/edit`, { field: `${f}.${itemIdx}.${subKey}`, value: subVal });
            }
          }
        } else if (OBJECT_FIELDS.includes(f)) {
          // Object field: stagedVal is the whole object. Replay each tracked leaf via dot-path field.
          const obj = stagedVal && typeof stagedVal === 'object' ? stagedVal : {};
          for (const tk of Object.keys(editedFields)) {
            if (!tk.startsWith(`${f}.`) || !tk.endsWith(`-${idx}`)) continue;
            const rawKey = tk.slice(`${f}.`.length, -`-${idx}`.length);
            await secureApiClient.put(`/api/edit/quality_assurance/${id}/edit`, { field: `${f}.${rawKey}`, value: obj[rawKey] });
          }
        } else {
          // Scalar / string / dotted-scalar (e.g. outsideConsultationRecommendation.recommended) /
          // sentence-split string: stagedVal is the final value. Single field write.
          await secureApiClient.put(`/api/edit/quality_assurance/${id}/edit`, { field: f, value: stagedVal });
        }
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/quality_assurance/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const rid = recId(record);
      if (rid) {
        const store = readDrafts();
        if (store[rid]) { fields.forEach(f => { delete store[rid][f]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, recId, pendingEdits, localEdits, editedFields]);

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
    const fields = SECTION_FIELDS[sid] || [];
    if (!fields.some(field => hasVal(getFieldValue(record, field, idx)))) return '';
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const labelLine = sameAsTitle(label, sid) ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${labelLine}${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${labelLine}${val ? 'Yes' : 'No'}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += labelLine;
        if (f === 'recommendations') {
          items.forEach((item, i) => {
            if (!item || typeof item !== 'object') return;
            if (hasVal(item.date)) text += `${formatDate(item.date)}\n${COPY_LINE_DASH}\n`;
            if (hasVal(item.recommendation)) text += `${i + 1}. ${item.recommendation}\n`;
          });
        } else {
          items.forEach((item, i) => {
            const parsed = parseLabel(String(item));
            if (parsed.isLabeled) text += `${parsed.label}\n${COPY_LINE_DASH}\n${i + 1}. ${parsed.value}\n`;
            else text += `${i + 1}. ${item}\n`;
          });
        }
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f) && val && typeof val === 'object' && !Array.isArray(val)) {
        const entries = Object.entries(val).filter(([, v]) => hasVal(v));
        if (entries.length === 0) return;
        text += labelLine;
        entries.forEach(([rawKey, leafVal]) => {
          if (leafVal && typeof leafVal === 'object' && !Array.isArray(leafVal)) {
            const inner = Object.entries(leafVal).filter(([, lv]) => hasVal(lv)).map(([lk, lv]) => `${humanizeKey(lk)}: ${fmtVal(lv)}`).join(', ');
            text += `${humanizeKey(rawKey)}\n${COPY_LINE_DASH}\n${inner}\n`;
          } else {
            text += `${humanizeKey(rawKey)}\n${COPY_LINE_DASH}\n${fmtVal(leafVal)}\n`;
          }
        });
        text += '\n';
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const parsed = parseLabel(strVal);
        const parts = COMMA_SPLIT_FIELDS.includes(f)
          ? splitByComma(parsed.isLabeled ? parsed.value : strVal)
          : [parsed.isLabeled ? parsed.value : strVal];
        text += labelLine;
        if (parsed.isLabeled) text += `${parsed.label}\n${COPY_LINE_DASH}\n`;
        if (parts.length > 1) parts.forEach((part, i) => { text += `${i + 1}. ${part}\n`; });
        else if (splitBySentence(strVal).length > 1) formatSentenceFieldLines(strVal).forEach(line => { text += `${line}\n`; });
        else text += `${parsed.isLabeled ? parsed.value : strVal}\n`;
        text += '\n';
      } else {
        text += `${labelLine}${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== QUALITY ASSURANCE ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Quality Assurance ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value); setSaveError(null); }} />
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

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
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

  /* flatten an array-of-object item to readable text (for Copy / search) */
  const flattenObjItem = (item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      if (item.recommendation !== undefined) return `${fmtVal(item.recommendation)}${hasVal(item.date) ? ` (${fmtVal(item.date)})` : ''}`;
      return Object.entries(item).filter(([, v]) => hasVal(v)).map(([k, v]) => `${humanizeKey(k)}: ${fmtVal(v)}`).join(', ');
    }
    return String(item ?? '');
  };

  /* renderArraySubfieldRow — one editable scalar row inside an array-of-objects item;
     saves via arrayIndex + subField dot-path so the object shape is preserved */
  const renderArraySubfieldRow = (record, fn, idx, sid, itemIdx, subKey, subVal, isDateSub) => {
    const editKey = `${fn}.${itemIdx}.${subKey}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const displayVal = isDateSub ? formatDate(subVal) : fmtVal(subVal);

    if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!humanizeKey(subKey).toLowerCase().includes(phrase) && !displayVal.toLowerCase().includes(phrase)) return null;
    }

    return (
      <div key={subKey} className="rec-mini-card" style={{ marginTop: 6 }} data-edit-field={`${fn}.${itemIdx}.${subKey}`}>
        <div className="nested-subtitle">{highlightText(humanizeKey(subKey))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isDateSub ? toInputDate(subVal) : fmtVal(subVal)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isDateSub
                ? <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value); setSaveError(null); }} />
                : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  if (isDateSub && editValue && isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; }
                  const outVal = editValue;
                  const id = safeId(record); if (!id) return;
                  // Stage a DRAFT (no DB write). Approve commits via arrayIndex + subField.
                  const cur = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx).map(it => (it && typeof it === 'object' ? { ...it } : it)) : [];
                  if (cur[itemIdx] && typeof cur[itemIdx] === 'object') cur[itemIdx][subKey] = outVal;
                  stageDraft(record, fn, idx, sid, `${fn}-${idx}`, cur, 'fields', editKey, 'edited');
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(subKey)}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderRecommendationDateSubtitle = (record, idx, sid, itemIdx, dateValue) => {
    const editKey = `recommendations.${itemIdx}.date-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const displayVal = formatDate(dateValue);
    return (
      <div className="editable-date-subtitle" data-edit-field={`recommendations.${itemIdx}.date`}>
        {isEditing ? (
          <div className="edit-field-container">
            <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value); setSaveError(null); }} />
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={e => {
                e.stopPropagation();
                const current = Array.isArray(getFieldValue(record, 'recommendations', idx))
                  ? getFieldValue(record, 'recommendations', idx).map(item => ({ ...item })) : [];
                if (current[itemIdx]) current[itemIdx].date = editValue;
                stageDraft(record, 'recommendations', idx, sid, `recommendations-${idx}`, current, 'fields', editKey, 'edited');
              }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className={`nested-subtitle date-subtitle numbered-row editable-row ${isModified ? 'modified' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(toInputDate(dateValue)); setSaveError(null); }}>
            <span className="content-value">{highlightText(displayVal)}</span> <span className="edit-indicator">&#9998;</span>
          </div>
        )}
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD — string items per-row; object items per-SUBFIELD (shape-preserving) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const isObjItem = item && typeof item === 'object' && !Array.isArray(item);

          /* OBJECT ITEM → per-subfield editable rows (preserves {recommendation, date} shape on save) */
          if (isObjItem) {
            const subEntries = Object.entries(item).filter(([, v]) => hasVal(v));
            if (subEntries.length === 0) return null;
            if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              const flat = flattenObjItem(item).toLowerCase();
              if (!label.toLowerCase().includes(phrase) && !flat.includes(phrase)) return null;
            }
            if (fn === 'recommendations') {
              return (
                <div key={itemIdx} className="rec-mini-card recommendation-group" style={{ marginTop: 8 }}>
                  {hasVal(item.date) && renderRecommendationDateSubtitle(record, idx, sid, itemIdx, item.date)}
                  {hasVal(item.recommendation) && renderArraySubfieldRow(record, fn, idx, sid, itemIdx, 'recommendation', item.recommendation, false)}
                </div>
              );
            }
            return (
              <div key={itemIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                <div className="nested-subtitle">{highlightText(`${label.replace(/s$/, '')} ${itemIdx + 1}`)}</div>
                {subEntries.map(([subKey, subVal]) => renderArraySubfieldRow(record, fn, idx, sid, itemIdx, subKey, subVal, subKey === 'date'))}
              </div>
            );
          }

          /* STRING ITEM → single editable row */
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);
          const parsedItem = fn === 'qualityMetrics' ? parseLabel(itemStr) : { isLabeled: false, label: '', value: itemStr };
          const displayItem = parsedItem.isLabeled ? parsedItem.value : itemStr;

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx} data-edit-field={`${fn}.${itemIdx}`} className={parsedItem.isLabeled ? 'rec-mini-card' : ''}>
              {parsedItem.isLabeled && <div className="nested-subtitle">{highlightText(parsedItem.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayItem); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = parsedItem.isLabeled ? `${parsedItem.label}: ${editValue.trim()}` : editValue; stageDraft(record, fn, idx, sid, `${fn}-${idx}`, currentArr, 'fields', editKey, 'edited'); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(displayItem)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayItem, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: OBJECT FIELD (dynamic-key, e.g. results {metric: value}) ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([rawKey, leafVal]) => {
          const subLabel = humanizeKey(rawKey);
          const isLeafObj = leafVal && typeof leafVal === 'object' && !Array.isArray(leafVal);
          const editKey = `${fn}.${rawKey}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const isNum = typeof leafVal === 'number';
          const isBool = typeof leafVal === 'boolean';
          const displayVal = isLeafObj
            ? Object.entries(leafVal).filter(([, lv]) => hasVal(lv)).map(([lk, lv]) => `${humanizeKey(lk)}: ${fmtVal(lv)}`).join(', ')
            : fmtVal(leafVal);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!subLabel.toLowerCase().includes(phrase) && !displayVal.toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
          }

          return (
              <div key={rawKey} className="rec-mini-card" style={{ marginTop: 8 }} data-edit-field={`${fn}.${rawKey}`}>
              <div className="nested-subtitle">{highlightText(subLabel)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} ${isLeafObj ? '' : 'editable-row'}`} onClick={() => { if (!isEditing && !isLeafObj) { setEditingField(editKey); setEditValue(isBool ? (leafVal ? 'Yes' : 'No') : fmtVal(leafVal)); setSaveError(null); } }}>
                {isEditing && !isLeafObj ? (
                  <div className="edit-field-container">
                    {isBool ? (
                      <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
                    ) : isNum ? (
                      <input type="text" inputMode="decimal" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    ) : (
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    )}
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => {
                        e.stopPropagation();
                        let outVal = editValue;
                        if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } outVal = n; }
                        else if (isBool) { outVal = editValue === 'Yes'; }
                        const id = safeId(record); if (!id) return;
                        setSaveError(null);
                        // Stage a DRAFT (no DB write). Approve commits via dot-path field `${fn}.${rawKey}`.
                        const cur = { ...(getFieldValue(record, fn, idx) || {}) };
                        cur[rawKey] = outVal;
                        stageDraft(record, fn, idx, sid, `${fn}-${idx}`, cur, 'fields', editKey, 'edited');
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span>{!isLeafObj && <span className="edit-indicator">&#9998;</span>}</div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Labeled and comma-delimited values are displayed as a subtitle plus one editable row per item. */
    const parsedWhole = parseLabel(strVal);
    const commaItems = COMMA_SPLIT_FIELDS.includes(fn)
      ? splitByComma(parsedWhole.isLabeled ? parsedWhole.value : strVal)
      : [parsedWhole.isLabeled ? parsedWhole.value : strVal];
    if (parsedWhole.isLabeled || commaItems.length > 1) {
      const visibleLabel = parsedWhole.isLabeled ? parsedWhole.label : label;
      return (
        <div key={fn} className="rec-mini-card">
          {!sameAsTitle(visibleLabel, sid) && <div className="nested-subtitle">{highlightText(visibleLabel)}</div>}
          {commaItems.map((item, itemIdx) => {
            const editKey = `${fn}-${idx}-c${itemIdx}`;
            const isEditing = editingField === editKey;
            const isModified = editedSentences[editKey];
            return (
              <div key={itemIdx} data-edit-field={fn}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(item); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => {
                          e.stopPropagation();
                          const current = String(getFieldValue(record, fn, idx) || '');
                          const parsed = parseLabel(current);
                          const parts = splitByComma(parsed.isLabeled ? parsed.value : current);
                          const replacement = editValue.trim();
                          if (replacement) parts[itemIdx] = replacement;
                          else parts.splice(itemIdx, 1);
                          const rebuilt = parsed.isLabeled ? `${parsed.label}: ${parts.join(', ')}` : parts.join(', ');
                          stageDraftSentences(record, fn, idx, sid, rebuilt, { [editKey]: 'edited' });
                        }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    }

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                    <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }} data-edit-field={fn}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx} data-edit-field={fn}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; stageDraftSentences(record, fn, idx, sid, fullText2, marks); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined} data-edit-field={fn}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id3 = safeId(record); if (!id3) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; stageDraftSentences(record, fn, idx, sid, fullText, marks); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
      <div key={fn} className="rec-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {ENUM_OPTIONS[fn]
                ? <BlueSelect value={editValue} options={ENUM_OPTIONS[fn]} onChange={setEditValue} />
                : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="quality-assurance-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Quality Assurance</h2></div>
        <div className="empty-state">No quality assurance records available</div>
      </div>
    );
  }

  return (
    <div className="quality-assurance-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Quality Assurance</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<QualityAssuranceDocumentPDFTemplate document={pdfData} />} fileName="Quality_Assurance.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search quality assurance records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Quality Assurance ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'record-info')}
            {renderSection(record, idx, 'outside-consultation')}
            {renderSection(record, idx, 'peer-review')}
            {renderSection(record, idx, 'clinical-details')}
            {renderSection(record, idx, 'recommendations-section')}
            {renderSection(record, idx, 'notes-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QualityAssuranceDocument;
