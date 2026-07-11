/**
 * ConnectiveTissueDiseaseAssessmentDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: connective_tissue_disease_assessment
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ConnectiveTissueDiseaseAssessmentDocumentPDFTemplate from '../pdf-templates/ConnectiveTissueDiseaseAssessmentDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './ConnectiveTissueDiseaseAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits key minus the "-<idx>" suffix) */
const DRAFT_KEY = 'connective_tissue_disease_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_TITLES = {
  providerInfo: 'Provider Information',
  clinicalNarrative: 'Clinical Narrative',
  classification: 'Classification Criteria',
  diseaseActivity: 'Disease Activity',
  organInvolvement: 'Organ Involvement',
  results: 'Results',
  recommendations: 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', diagnosis: 'Diagnosis', status: 'Status',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
  results: 'Results', recommendations: 'Recommendations',
  'diseaseActivity.severity': 'Severity', 'diseaseActivity.scale': 'Scale', 'diseaseActivity.score': 'Score',
};

const SECTION_FIELDS = {
  providerInfo: ['date', 'provider', 'facility', 'diagnosis', 'status'],
  clinicalNarrative: ['findings', 'assessment', 'plan', 'notes'],
  classification: ['classificationCriteria'],
  diseaseActivity: ['diseaseActivity.severity', 'diseaseActivity.scale', 'diseaseActivity.score'],
  organInvolvement: ['organInvolvement'],
  results: ['results'],
  recommendations: ['recommendations'],
};

const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const DOT_PATH_FIELDS = ['diseaseActivity.severity', 'diseaseActivity.scale', 'diseaseActivity.score'];
const OBJECT_FIELDS = ['results'];
const RECOMMENDATION_FIELDS = ['recommendations'];

const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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
// Fixed-choice clinical field → dropdown (keep an unmatched current value as an extra option, casing matched).
const ENUM_FIELDS = { status: ['active', 'not active', 'inactive', 'resolved'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
// Copy dividers (4-area mirror): EQ under record + section titles, DASH under every field / group label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// Comma splitter for narrative lists (>=3 gate). Paren-aware; keeps Oxford ", and/or X" attached;
// skips no-space commas ("$18,000") and date commas ("January 8, 2026").
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};

const ConnectiveTissueDiseaseAssessmentDocument = ({ document: docProp }) => {
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
  // localEdits keys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.connective_tissue_disease_assessment) return Array.isArray(r.connective_tissue_disease_assessment) ? r.connective_tissue_disease_assessment : [r.connective_tissue_disease_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.connective_tissue_disease_assessment) return Array.isArray(dd.connective_tissue_disease_assessment) ? dd.connective_tissue_disease_assessment : [dd.connective_tissue_disease_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // safeId is defined below; replicate the minimal id-extraction here for rehydration
  const recordId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recordId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // field-level edited marker → surfaces the Pending Approve button (sectionHasEdits matches `${f}-${idx}`)
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records, recordId]);

  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).filter(k => !k.startsWith('_')).length > 0;
    return true;
  }, []);

  const formatDate = useCallback((d) => {
    if (!d) return '';
    try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
  }, []);

  const fmtVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/)
      .map(s => s.replace(/[;.]+$/, '').trim())
      .filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

  // Parse "Label: value" pattern from a sentence
  const parseLabel = (sentence) => {
    const match = sentence.match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s);
    if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
    return { isLabeled: false, label: null, value: sentence };
  };

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    // Dot-path support
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; }
      return val;
    }
    return record[fn];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; }
    return Array.isArray(record[fn]) ? record[fn] : [];
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
      if (Array.isArray(val)) { if (val.some(item => { const s = typeof item === 'object' ? JSON.stringify(item) : String(item); return s.toLowerCase().includes(phrase); })) return true; }
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
    if (Array.isArray(val)) return val.some(item => { const s = typeof item === 'object' ? JSON.stringify(item) : String(item); return s.toLowerCase().includes(phrase); });
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
      const recordTitle = `Connective Tissue Disease Assessment ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) { record._showAllSections = true; return true; }
      if (phrase.startsWith('ctd assessment') || phrase.startsWith('connective tissue')) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      // Search all field values
      const searchableValues = [
        record.date ? formatDate(record.date) : '', record.provider, record.facility, record.diagnosis, record.status,
        record.findings, record.assessment, record.plan, record.notes,
        ...(Array.isArray(record.classificationCriteria) ? record.classificationCriteria.flatMap(c => [c.criterion, c.met ? 'Yes' : 'No', c.details]) : []),
        record.diseaseActivity?.severity, record.diseaseActivity?.scale, record.diseaseActivity?.score,
        ...(Array.isArray(record.organInvolvement) ? record.organInvolvement.flatMap(o => [o.organ, o.manifestation, o.severity]) : []),
        record.results && typeof record.results === 'object' ? JSON.stringify(record.results) : '',
        ...(Array.isArray(record.recommendations) ? record.recommendations.flatMap(rec => [rec?.recommendation, rec?.date]) : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchableValues.includes(phrase);
    });
  }, [records, searchTerm, formatDate]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldName = m[1];
          if (fieldName.includes('.')) {
            // Dot-path: set nested value
            const parts = fieldName.split('.');
            let target = merged;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!target[parts[i]] || typeof target[parts[i]] !== 'object') target[parts[i]] = {};
              target = target[parts[i]];
            }
            target[parts[parts.length - 1]] = localEdits[key];
          } else {
            merged[fieldName] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ========== EDIT ==========
  // Stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // Drafts are NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
  // editKey is the localEdits key (`${field}-${idx}`); fieldPart = editKey minus the "-${idx}" suffix.
  const stageDraft = useCallback((record, sid, idx, editKey, value) => {
    const id = safeId(record); if (!id) return;
    const suffix = `-${idx}`;
    const fieldPart = editKey.endsWith(suffix) ? editKey.slice(0, -suffix.length) : editKey;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop this section's 'approved' flag so the button returns to yellow Pending
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const saveVal = valueOverride !== undefined ? valueOverride : editValue.trim();
    // Field type validation
    const origVal = (() => { if (fn.includes('.')) { const parts = fn.split('.'); let v = record; for (const p of parts) { v = v?.[p]; } return v; } return record[fn]; })();
    let finalVal = saveVal;
    if (typeof origVal === 'number') {
      if (isNaN(Number(saveVal))) { setSaveError('Please enter a valid number'); return; }
      finalVal = Number(saveVal);
    } else if (typeof origVal === 'boolean') {
      const lower = String(saveVal).toLowerCase();
      if (!['yes', 'no', 'true', 'false'].includes(lower)) { setSaveError('Please enter Yes or No'); return; }
      finalVal = lower === 'yes' || lower === 'true';
    }
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, sid, idx, `${fn}-${idx}`, finalVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  /* save a nested OBJECT leaf by dot-path (e.g. results.ef) — value stays a STRING.
     Stages a DRAFT: the whole rootField object (with the leaf updated) is stored under `${rootField}-${idx}`. */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    stageDraft(record, sid, idx, `${rootField}-${idx}`, clone);
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [safeId, localEdits, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage as a DRAFT (no DB write); Approve commits it.
      stageDraft(record, sid, idx, `${fn}-${idx}`, fullText);
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    // Stage as a DRAFT (no DB write); Approve commits it.
    stageDraft(record, sid, idx, `${fn}-${idx}`, fullText);
    const originalSentence = sentences[sentenceIdx] || '';
    const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== originalSentence.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  // Per-comma-item save: reconstructs "Label: item1, item2, item3" from edited single item
  function saveCommaItem(record, fn, idx, sid, sIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sIdx] || '';
    const parsed = parseLabel(sentence.replace(/[;.]+$/, '').trim());
    const rawValue = parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim();
    const items = splitByComma(rawValue);
    const trimmed = editValue.trim();
    if (!trimmed) { items.splice(commaIdx, 1); }
    else {
      const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
      if (subParts.length > 1) { items.splice(commaIdx, 1, ...subParts); } else { items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    }
    const rebuilt = items.length > 0 ? (parsed.isLabeled ? `${parsed.label}: ${items.join(', ')}` : items.join(', ')) : '';
    const updated = [...sentences];
    if (rebuilt) { updated[sIdx] = rebuilt; } else { updated.splice(sIdx, 1); }
    const fullText = reconstructFullText(updated);
    // Stage as a DRAFT (no DB write); Approve commits it.
    stageDraft(record, sid, idx, `${fn}-${idx}`, fullText);
    const trimmedParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
    const originalItem = splitByComma(rawValue)[commaIdx] || '';
    const originalChanged = trimmedParts[0] !== originalItem;
    setEditedSentences(prev => {
      const n = { ...prev };
      if (originalChanged) n[`${fn}-${idx}-s${sIdx}-c${commaIdx}`] = 'edited';
      for (let ei = 1; ei < trimmedParts.length; ei++) n[`${fn}-${idx}-s${sIdx}-c${commaIdx + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue('');
  }

  // Save comma-item for array sub-fields (e.g., organInvolvement[i].manifestation)
  function saveArrayCommaItem(record, arrayField, idx, sid, arrayIndex, subField, commaIdx) {
    const id = safeId(record); if (!id) return;
    const arr = getEffectiveArray(record, arrayField, idx);
    const item = arr[arrayIndex];
    if (!item) return;
    const currentVal = String(item[subField] || '');
    const items = splitByComma(currentVal);
    const trimmed = editValue.trim();
    if (!trimmed) { items.splice(commaIdx, 1); }
    else {
      const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
      if (subParts.length > 1) { items.splice(commaIdx, 1, ...subParts); } else { items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    }
    const rebuilt = items.join(', ');
    // Stage as a DRAFT (no DB write); the whole updated array is stored under `${arrayField}-${idx}`. Approve commits it.
    const newArr = [...(getEffectiveArray(record, arrayField, idx))];
    if (newArr[arrayIndex]) { newArr[arrayIndex] = { ...newArr[arrayIndex], [subField]: rebuilt }; }
    stageDraft(record, sid, idx, `${arrayField}-${idx}`, newArr);
    const trackKey = `${arrayField}.${arrayIndex}.${subField}-${idx}-c${commaIdx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  // Save array-of-objects item field
  const handleSaveArrayItem = useCallback((record, arrayField, idx, sid, arrayIndex, subField, newValue) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    // Validate boolean for 'met' field
    let finalVal = newValue;
    if (subField === 'met') {
      const lower = String(newValue).toLowerCase();
      if (!['yes', 'no', 'true', 'false'].includes(lower)) { setSaveError('Please enter Yes or No'); return; }
      finalVal = lower === 'yes' || lower === 'true';
    }
    // Stage as a DRAFT (no DB write); the whole updated array is stored under `${arrayField}-${idx}`. Approve commits it.
    const arr = [...(getEffectiveArray(record, arrayField, idx))];
    if (arr[arrayIndex]) { arr[arrayIndex] = { ...arr[arrayIndex], [subField]: finalVal }; }
    stageDraft(record, sid, idx, `${arrayField}-${idx}`, arr);
    const trackKey = `${arrayField}.${arrayIndex}.${subField}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [safeId, getEffectiveArray, stageDraft]);

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) ||
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
      // Pending edits whose fieldPart belongs to this section's fields
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart; // localEdits keys here never carry a sub-path beyond the field name
        return fields.some(f => baseField === f || baseField.startsWith(`${f}.`));
      });
      // Persist each staged field to the DB now.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.<seg>"
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        // arrayIndex ONLY when the trailing dot-segment is purely numeric (mirrors handleSaveField's `${field}.${arrayIndex}`)
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(tail, 10);
        } else {
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/connective_tissue_disease_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the record/section approved (audit trail)
      await secureApiClient.put(`/api/edit/connective_tissue_disease_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CTDAssessment] Approve error:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* Shared EQ/DASH numbered section-copy builder — 4-area mirror (JSX = Copy Section = Copy All = PDF).
     EQ under section titles, DASH under every field/group label, "1." on every value row; sentence fields
     split by sentence then comma (>=3, sub-label only on a genuine split); array-of-objects render
     criterion/organ as the group header + secondary attrs; results object walks key→value. '' when empty. */
  const buildSectionCopy = useCallback((r, sid) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    const pushLabeled = (label, value) => { lines.push(label, COPY_LINE_DASH, `1. ${value}`, ''); };
    const emitSentences = (val) => {
      let n = 0;
      splitBySentence(String(val)).forEach(s => {
        const p = parseLabel(s.replace(/[;.]+$/, '').trim());
        const content = p.isLabeled ? p.value : s.replace(/[;.]+$/, '').trim();
        const c = splitByComma(content);
        if (c.length >= 3) { if (p.isLabeled) { lines.push(p.label, COPY_LINE_DASH); n = 0; } c.forEach(part => lines.push(`${++n}. ${part.replace(/[;.]+$/, '').trim()}`)); }
        else lines.push(`${++n}. ${s.replace(/[;.]+$/, '').trim()}`);
      });
    };
    const emitCommaValue = (val) => { const c = splitByComma(String(val)); if (c.length >= 3) c.forEach((part, i) => lines.push(`${i + 1}. ${part}`)); else lines.push(`1. ${val}`); };
    if (sid === 'providerInfo') {
      if (r.date) pushLabeled('Date', formatDate(r.date));
      ['provider', 'facility', 'diagnosis', 'status'].forEach(f => { if (hasVal(r[f])) pushLabeled(FIELD_LABELS[f], fmtVal(r[f])); });
    } else if (sid === 'clinicalNarrative') {
      ['findings', 'assessment', 'plan', 'notes'].forEach(f => { if (!hasVal(r[f])) return; lines.push(FIELD_LABELS[f], COPY_LINE_DASH); emitSentences(r[f]); lines.push(''); });
    } else if (sid === 'classification') {
      (Array.isArray(r.classificationCriteria) ? r.classificationCriteria : []).forEach(c => {
        lines.push(c.criterion || 'Criterion', COPY_LINE_DASH);
        if (hasVal(c.details)) emitCommaValue(c.details);
        if (c.met !== undefined) lines.push('Met', COPY_LINE_DASH, `1. ${c.met ? 'Yes' : 'No'}`);
        lines.push('');
      });
    } else if (sid === 'diseaseActivity') {
      const da = r.diseaseActivity || {};
      ['severity', 'scale', 'score'].forEach(k => { if (hasVal(da[k])) pushLabeled(FIELD_LABELS[`diseaseActivity.${k}`], fmtVal(da[k])); });
    } else if (sid === 'organInvolvement') {
      (Array.isArray(r.organInvolvement) ? r.organInvolvement : []).forEach(o => {
        lines.push(o.organ || 'Organ', COPY_LINE_DASH);
        if (hasVal(o.manifestation)) emitCommaValue(o.manifestation);
        if (hasVal(o.severity)) lines.push('Severity', COPY_LINE_DASH, `1. ${o.severity}`);
        lines.push('');
      });
    } else if (sid === 'results') {
      const walk = (obj, depth) => Object.entries(obj).filter(([k, v]) => !k.startsWith('_') && !isEmptyDeep(v)).forEach(([k, v]) => {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) { lines.push(humanizeKey(k), COPY_LINE_DASH); walk(v, depth + 1); }
        else lines.push(humanizeKey(k), COPY_LINE_DASH, `1. ${fmtScalar(v)}`, '');
      });
      if (r.results && typeof r.results === 'object') walk(r.results, 0);
    } else if (sid === 'recommendations') {
      let prevDate = null, n = 0;
      (Array.isArray(r.recommendations) ? r.recommendations : []).forEach(rec => {
        const d = (rec?.date || '').trim();
        if (d && d !== prevDate) { lines.push(d, COPY_LINE_DASH); prevDate = d; n = 0; }
        lines.push(`${++n}. ${(rec?.recommendation || '').trim()}`);
      });
      if (lines.length) lines.push('');
    }
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [formatDate, splitBySentence, hasVal, fmtVal]);

  const buildSectionCopyText = useCallback((record, idx, sid) => buildSectionCopy(pdfData[idx] || record, sid), [pdfData, buildSectionCopy]);

  const copyAllText = useCallback(async () => {
    let text = '=== CONNECTIVE TISSUE DISEASE ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Connective Tissue Disease Assessment ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const block = buildSectionCopy(r, sid); if (block) text += `${block}\n`; });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, buildSectionCopy, copyToClipboard]);

  // ========== RENDER HELPERS ==========
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    if (fn === 'date') {
      const dateKey = `${fn}-${idx}`; const isDateEditing = editingField === dateKey; const dateModified = editedFields[dateKey];
      const toDateInputVal = (v) => { try { const d = new Date(v?.$date || v); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; } };
      return (
        <div key={fn}>
          <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
          <div className={`numbered-row ${dateModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isDateEditing) { setEditingField(dateKey); setEditValue(toDateInputVal(val)); setSaveError(null); } }}>
            {isDateEditing ? (
              <div className="edit-field-container">
                <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const testDate = new Date(editValue); if (isNaN(testDate.getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, undefined, undefined, editValue + 'T00:00:00.000Z', dateKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(formatDate(val))}</span><span className="edit-indicator">✎</span></div>
                <button className={`copy-btn ${copiedItems[dateKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(formatDate(val), dateKey); }}>{copiedItems[dateKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {dateModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    }
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val); const isModified = editedFields[editKey]; const itemId = `${fn}-${idx}`;
    const isBool = typeof val === 'boolean' || typeof record[fn] === 'boolean';
    const enumOpts = !isBool && ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const startEdit = () => { setSaveError(null); setEditingField(editKey); if (enumOpts) { const cur = String(val ?? '').trim(); const m = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); setEditValue(m || cur); } else setEditValue(displayVal); };
    return (
      <div key={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) startEdit(); }}>
          {isEditing ? (<div className="edit-field-container">{isBool ? (<select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="Yes">Yes</option><option value="No">No</option></select>) : enumOpts ? (<select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>{enumOpts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}</select>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />)}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[itemId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, itemId); }}>{copiedItems[itemId] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn}>
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(sentence.replace(/[;.]+$/, '').trim());
            const rawValue = parsed.isLabeled ? parsed.value : parsed.value;
            const commaItems = splitByComma(rawValue);
            const showCommaRows = commaItems.length >= 3;

            return (<div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''}>
              {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
              {showCommaRows ? (
                commaItems.map((item, ci) => {
                  const commaKey = `${fn}-${idx}-s${sIdx}-c${ci}`;
                  const isCommaEditing = editingField === commaKey;
                  const isCommaEdited = editedSentences[commaKey];
                  if (isCommaEditing) {
                    return (<div key={ci} className="numbered-row"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => { setEditValue(e.target.value); setSaveError(null); }} autoFocus onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveCommaItem(record, fn, idx, sid, sIdx, ci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ci); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
                  }
                  return (<React.Fragment key={ci}>
                    <div className={`numbered-row ${isCommaEdited ? 'modified' : ''} editable-row`} onClick={() => { setEditingField(commaKey); setEditValue(item.trim()); setSaveError(null); }}>
                      <div className="row-content"><span className="content-value">{highlightText(item.trim())}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item.trim(), commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                    </div>
                    {isCommaEdited && <span className={`modified-badge ${isCommaEdited === 'added' ? 'added' : ''}`}>{isCommaEdited === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                  </React.Fragment>);
                })
              ) : isEditing ? (
                <div className="numbered-row"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => { setEditValue(e.target.value); setSaveError(null); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>
              ) : (
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); }}>
                  <div className="row-content"><span className="content-value">{highlightText(parsed.value)}</span><span className="edit-indicator">✎</span></div>
                  <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              )}
              {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
            </div>);
          })}
        </div>
      </div>
    );
  };

  const renderDotPathField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn.split('.').pop();
    const displayVal = fmtVal(val); const isModified = editedFields[editKey]; const itemId = `${fn}-${idx}`;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(null); setEditingField(editKey); setEditValue(displayVal); } }}>
          {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[itemId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, itemId); }}>{copiedItems[itemId] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderClassificationCriteriaSection = (record, idx, sid) => {
    const criteria = getEffectiveArray(record, 'classificationCriteria', idx);
    if (criteria.length === 0) return null;
    const title = SECTION_TITLES.classification;
    if (!shouldShowSection(record, sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
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
          {criteria.map((c, ci) => {
            const itemText = [c.criterion, c.details, c.met ? 'Yes' : 'No'].filter(Boolean).join(' ');
            const itemMatches = phraseMatch || (searchTerm.trim() && itemText.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={ci} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(c.criterion || `Criterion ${ci + 1}`)}</div>
                {/* Details field - editable with comma-split */}
                {(() => {
                  const detailVal = c.details || '';
                  if (!detailVal) return null;
                  const commaItems = splitByComma(detailVal);
                  if (commaItems.length >= 3) {
                    return commaItems.map((dItem, dci) => {
                      const commaKey = `classificationCriteria.${ci}.details-${idx}-c${dci}`;
                      const isCommaEditing = editingField === commaKey;
                      const isCommaEdited = editedFields[commaKey];
                      if (isCommaEditing) {
                        return (<div key={dci} className="numbered-row"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => { setEditValue(e.target.value); setSaveError(null); }} autoFocus onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveArrayCommaItem(record, 'classificationCriteria', idx, sid, ci, 'details', dci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayCommaItem(record, 'classificationCriteria', idx, sid, ci, 'details', dci); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
                      }
                      return (<React.Fragment key={dci}>
                        <div className={`numbered-row ${isCommaEdited ? 'modified' : ''} editable-row`} onClick={() => { setEditingField(commaKey); setEditValue(dItem.trim()); setSaveError(null); }}>
                          <div className="row-content"><span className="content-value">{highlightText(dItem.trim())}</span><span className="edit-indicator">✎</span></div>
                          <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(dItem.trim(), commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                        </div>
                        {isCommaEdited && <span className="modified-badge">edited - click Pending Approve to save</span>}
                      </React.Fragment>);
                    });
                  }
                  const detailKey = `classificationCriteria.${ci}.details-${idx}`;
                  const isDetailEditing = editingField === detailKey;
                  const detailModified = editedFields[detailKey];
                  return (
                    <div>
                      <div className={`numbered-row ${detailModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isDetailEditing) { setSaveError(null); setEditingField(detailKey); setEditValue(detailVal); } }}>
                        {isDetailEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, 'classificationCriteria', idx, sid, ci, 'details', editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
                        ) : (<><div className="row-content"><span className="content-value">{highlightText(detailVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[detailKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(detailVal, detailKey); }}>{copiedItems[detailKey] ? 'Copied!' : 'Copy'}</button></>)}
                      </div>
                      {detailModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                })()}
                {/* Met field - dropdown with nested-subtitle */}
                {c.met !== undefined && (() => {
                  const metKey = `classificationCriteria.${ci}.met-${idx}`;
                  const isMetEditing = editingField === metKey;
                  const metModified = editedFields[metKey];
                  const metVal = c.met ? 'Yes' : 'No';
                  return (
                    <div>
                      <div className="nested-subtitle">{highlightText('Met')}</div>
                      <div className={`numbered-row ${metModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isMetEditing) { setSaveError(null); setEditingField(metKey); setEditValue(metVal); } }}>
                        {isMetEditing ? (<div className="edit-field-container"><select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="Yes">Yes</option><option value="No">No</option></select><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, 'classificationCriteria', idx, sid, ci, 'met', editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
                        ) : (<><div className="row-content"><span className="content-value"><span style={{ color: c.met ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{metVal}</span></span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[metKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Met: ${metVal}`, metKey); }}>{copiedItems[metKey] ? 'Copied!' : 'Copy'}</button></>)}
                      </div>
                      {metModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOrganInvolvementSection = (record, idx, sid) => {
    const organs = getEffectiveArray(record, 'organInvolvement', idx);
    if (organs.length === 0) return null;
    const title = SECTION_TITLES.organInvolvement;
    if (!shouldShowSection(record, sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
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
          {organs.map((o, oi) => {
            const itemText = [o.organ, o.manifestation, o.severity].filter(Boolean).join(' ');
            const itemMatches = phraseMatch || (searchTerm.trim() && itemText.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={oi} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(o.organ || `Organ ${oi + 1}`)}</div>
                {/* Manifestation - editable with comma-split */}
                {(() => {
                  const mVal = o.manifestation || '';
                  if (!mVal) return null;
                  const commaItems = splitByComma(mVal);
                  if (commaItems.length >= 3) {
                    return commaItems.map((mItem, mci) => {
                      const commaKey = `organInvolvement.${oi}.manifestation-${idx}-c${mci}`;
                      const isCommaEditing = editingField === commaKey;
                      const isCommaEdited = editedFields[commaKey];
                      if (isCommaEditing) {
                        return (<div key={mci} className="numbered-row"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => { setEditValue(e.target.value); setSaveError(null); }} autoFocus onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveArrayCommaItem(record, 'organInvolvement', idx, sid, oi, 'manifestation', mci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayCommaItem(record, 'organInvolvement', idx, sid, oi, 'manifestation', mci); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
                      }
                      return (<React.Fragment key={mci}>
                        <div className={`numbered-row ${isCommaEdited ? 'modified' : ''} editable-row`} onClick={() => { setEditingField(commaKey); setEditValue(mItem.trim()); setSaveError(null); }}>
                          <div className="row-content"><span className="content-value">{highlightText(mItem.trim())}</span><span className="edit-indicator">✎</span></div>
                          <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(mItem.trim(), commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                        </div>
                        {isCommaEdited && <span className="modified-badge">edited - click Pending Approve to save</span>}
                      </React.Fragment>);
                    });
                  }
                  const mKey = `organInvolvement.${oi}.manifestation-${idx}`;
                  const isMEditing = editingField === mKey;
                  const mModified = editedFields[mKey];
                  return (
                    <div>
                      <div className={`numbered-row ${mModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isMEditing) { setSaveError(null); setEditingField(mKey); setEditValue(mVal); } }}>
                        {isMEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, 'organInvolvement', idx, sid, oi, 'manifestation', editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
                        ) : (<><div className="row-content"><span className="content-value">{highlightText(mVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[mKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Manifestation: ${mVal}`, mKey); }}>{copiedItems[mKey] ? 'Copied!' : 'Copy'}</button></>)}
                      </div>
                      {mModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                })()}
                {/* Severity - editable with nested-subtitle */}
                {(() => {
                  const sKey = `organInvolvement.${oi}.severity-${idx}`;
                  const isSEditing = editingField === sKey;
                  const sModified = editedFields[sKey];
                  const sVal = o.severity || '';
                  if (!sVal && !isSEditing) return null;
                  return (
                    <div>
                      <div className="nested-subtitle">{highlightText('Severity')}</div>
                      <div className={`numbered-row ${sModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isSEditing) { setSaveError(null); setEditingField(sKey); setEditValue(sVal); } }}>
                        {isSEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, 'organInvolvement', idx, sid, oi, 'severity', editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
                        ) : (<><div className="row-content"><span className="content-value">{highlightText(sVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Severity: ${sVal}`, sKey); }}>{copiedItems[sKey] ? 'Copied!' : 'Copy'}</button></>)}
                      </div>
                      {sModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, "4/5" stays text) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
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
                  if (isBool) { newVal = editValue === 'yes'; }
                  else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = `${n}/${ratio.denom}`; }
                  else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); }
                  else { newVal = editValue.trim(); }
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT NODE (recursive) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([k, v]) => !k.startsWith('_') && !isEmptyDeep(v));
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
    const entries = Object.entries(val).filter(([k, v]) => !k.startsWith('_') && !isEmptyDeep(v));
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

  /* ═══════ RENDER: RECOMMENDATIONS — array of {recommendation, date}, date-grouped ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();

    const groups = [];
    recs.forEach((rec, rIdx) => {
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
                              // Stage as a DRAFT (no DB write); the whole updated array is stored under `${fn}-${idx}`. Approve commits it.
                              stageDraft(record, sid, idx, `${fn}-${idx}`, newArr);
                              setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
                              setEditingField(null); setEditValue('');
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">✎</span></div>
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
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (f === 'classificationCriteria' || f === 'organInvolvement' || RECOMMENDATION_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      return hasVal(getFieldValue(record, f, idx));
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
            if (DOT_PATH_FIELDS.includes(f)) return renderDotPathField(record, f, idx, sid, title);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (RECOMMENDATION_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) {
    return (<div className="connective-tissue-disease-assessment" ref={containerRef}><div className="document-header"><h2 className="document-title">Connective Tissue Disease Assessment</h2></div><div className="empty-state">No connective tissue disease assessment records available</div></div>);
  }

  return (
    <div className="connective-tissue-disease-assessment" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Connective Tissue Disease Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ConnectiveTissueDiseaseAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Connective_Tissue_Disease_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search connective tissue disease assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Connective Tissue Disease Assessment ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'providerInfo')}
            {renderMixedSection(record, idx, 'clinicalNarrative')}
            {renderClassificationCriteriaSection(record, idx, 'classification')}
            {renderMixedSection(record, idx, 'diseaseActivity')}
            {renderOrganInvolvementSection(record, idx, 'organInvolvement')}
            {renderMixedSection(record, idx, 'results')}
            {renderMixedSection(record, idx, 'recommendations')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectiveTissueDiseaseAssessmentDocument;
