/**
 * DiseaseSeverityDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: disease_severity
 *
 * 8 Sections:
 *   1. session-info: date (date picker), provider, facility, status
 *   2. severity-overview: overallSeverity
 *   3. crisis-frequency: crisisFrequency.currentYearCount (number), crisisFrequency.annualAverage (number)
 *   4. complications-section: complications[]
 *   5. quality-of-life: qualityOfLife (sentence)
 *   6. prognostic-factors: prognosticFactors[]
 *   7. assessment-plan: assessment (sentence), plan (sentence), findings (sentence)
 *   8. recommendations-notes: recommendations[], notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DiseaseSeverityDocumentPDFTemplate from '../pdf-templates/DiseaseSeverityDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './DiseaseSeverityDocument.css';

/* Canonical copy dividers (one-pass item 2): '=' under record/section titles, '-' under every field
   sub-label. Every value row is numbered (item 3). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* −/+ stepper step = the value's own smallest digit (decimal-aware): integers by 1, one-decimal by 0.1.
   The customer TYPES the exact value; we NEVER impose a fixed increment (memory 6a4a3fae). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'severity-overview': 'Severity Overview',
  'crisis-frequency': 'Crisis Frequency',
  'complications-section': 'Complications',
  'quality-of-life': 'Quality of Life',
  'prognostic-factors': 'Prognostic Factors',
  'assessment-plan': 'Assessment & Plan',
  'recommendations-notes': 'Recommendations & Notes',
  'results-section': 'Results',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  overallSeverity: 'Overall Severity',
  'crisisFrequency.currentYearCount': 'Current Year Count',
  'crisisFrequency.annualAverage': 'Annual Average',
  complications: 'Complications',
  qualityOfLife: 'Quality of Life',
  prognosticFactors: 'Prognostic Factors',
  assessment: 'Assessment',
  plan: 'Plan',
  findings: 'Findings',
  recommendations: 'Recommendations',
  notes: 'Notes',
  results: 'Results',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'severity-overview': ['overallSeverity'],
  'crisis-frequency': ['crisisFrequency.currentYearCount', 'crisisFrequency.annualAverage'],
  'complications-section': ['complications'],
  'quality-of-life': ['qualityOfLife'],
  'prognostic-factors': ['prognosticFactors'],
  'assessment-plan': ['assessment', 'plan', 'findings'],
  'recommendations-notes': ['recommendations', 'notes'],
  'results-section': ['results'],
};

const SENTENCE_FIELDS = ['qualityOfLife', 'assessment', 'plan', 'findings', 'notes'];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['crisisFrequency.currentYearCount', 'crisisFrequency.annualAverage'];
const BOOLEAN_FIELDS = [];
const ARRAY_FIELDS = ['complications', 'prognosticFactors', 'recommendations'];
const OBJECT_FIELDS = ['results'];

/* Known clinical-scale dropdowns (memory 6a4908b2) — overallSeverity is a severity ladder (records hold
   'High'/'Moderate'). Edit-widget-only: the stored value shape is unchanged so Copy/PDF stay identical. */
const ENUM_FIELDS = { overallSeverity: ['Low', 'Moderate', 'High', 'Very High'] };
const enumCanonical = (options, current) => { const c = String(current ?? '').trim().toLowerCase(); const hit = options.find(o => o.toLowerCase() === c); return hit || (current ?? ''); };
const enumOptionsWith = (options, current) => { const cur = String(current ?? '').trim(); if (!cur) return options; return options.some(o => o.toLowerCase() === cur.toLowerCase()) ? options : [cur, ...options]; };

/* ═══════ OBJECT-FIELD HELPERS (for `results` recursive renderer) ═══════ */
const KEY_OVERRIDES = { ekg: 'EKG', ecg: 'ECG', wbc: 'WBC', rbc: 'RBC', bun: 'BUN', inr: 'INR', ct: 'CT', mri: 'MRI', xray: 'X-Ray', hr: 'HR', bp: 'BP' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isScalar = (v) => v === null || typeof v !== 'object';
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
/* Canonical object copy lines (recursive): each scalar leaf = sub-label + '-' + "1. value" (NEVER
   side-by-side "Label: value"); nested object = sub-label header + recurse. */
const objectCopyLines = (label, value) => {
  const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push(`${label}\n${COPY_LINE_DASH}`); out.push(`1. ${fmtScalar(value)}`); return out; }
  out.push(`${label}\n${COPY_LINE_DASH}`);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v)));
  return out;
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

/* splitBySemicolon + splitGuardedComma (memory 6a4a4cd5): sentence → semicolon → guarded comma. */
const splitBySemicolon = (text) => (!text || typeof text !== 'string') ? [] : text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
const splitGuardedComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const noSpace = s[i + 1] !== ' ';
      let j = i + 1; while (j < s.length && s[j] === ' ') j++;
      const rest = s.slice(j); const nextChar = s[j] || '';
      const andOrAfter = /^(and|or)\b/i.test(rest);
      const andOrBefore = /\b(and|or)\s*$/i.test(cur);
      const dateComma = /\d\s*$/.test(cur) && /^\d{4}\b/.test(rest);
      const nextOk = /[A-Za-z(>]/.test(nextChar);
      if (!noSpace && !andOrAfter && !andOrBefore && !dateComma && nextOk) { const p = cur.trim(); if (p) out.push(p); cur = ''; continue; }
    }
    cur += ch;
  }
  const p = cur.trim(); if (p) out.push(p);
  return out;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = localEdits key minus the "-<idx>" suffix) */
const DRAFT_KEY = 'disease_severityPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};
/* Module-scope record-id reader (mirrors the safeId hook; handles _id.$oid) for the rehydrate effect. */
const recordIdOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };

/* ═══════ COMPONENT ═══════ */
const DiseaseSeverityDocument = ({ document: docProp }) => {
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

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.disease_severity) return Array.isArray(r.disease_severity) ? r.disease_severity : [r.disease_severity];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.disease_severity) return Array.isArray(dd.disease_severity) ? dd.disease_severity : [dd.disease_severity]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = recordIdOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        // best-effort sentence-row badge restore for narrative base fields
        if (SENTENCE_FIELDS.includes(fieldPart)) nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

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

  /* Resolve nested dot-path value from record */
  const resolveNestedValue = useCallback((record, fieldPath) => {
    const parts = fieldPath.split('.');
    let val = record;
    for (const p of parts) {
      if (val === null || val === undefined) return undefined;
      val = val[p];
    }
    return val;
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return resolveNestedValue(record, fn);
  }, [localEdits, resolveNestedValue]);

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

  /* ═══════ SEARCH ═══════ */
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
        if (Array.isArray(val)) {
          for (const item of val) {
            if (String(item).toLowerCase().includes(phrase)) return true;
          }
        } else if (OBJECT_FIELDS.includes(f) && typeof val === 'object') {
          if (flattenSearchable(val).toLowerCase().includes(phrase)) return true;
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      if (OBJECT_FIELDS.includes(fn) && typeof val === 'object') return flattenSearchable(val).toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Disease Severity ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            }
          } else if (val && OBJECT_FIELDS.includes(f) && typeof val === 'object') {
            if (flattenSearchable(val).toLowerCase().includes(phrase)) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      if (merged.crisisFrequency) merged.crisisFrequency = { ...merged.crisisFrequency };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m2 = key.match(/^(.+)-(\d+)$/);
        if (m2 && parseInt(m2[2]) === idx) {
          const fieldPath = m2[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 2 && dotParts[0] === 'crisisFrequency') {
            if (!merged.crisisFrequency) merged.crisisFrequency = {};
            merged.crisisFrequency[dotParts[1]] = localEdits[key];
          } else if (dotParts.length === 1) {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS (defer-save: stage locally + localStorage; Approve commits to DB) ═══════ */

  /* Find which section a localEdits fieldPart belongs to (for re-edit → drop the approved flag). */
  const sectionIdForFieldPart = useCallback((fieldPart) => {
    const dot = fieldPart.lastIndexOf('.');
    const base = (dot !== -1 && /^\d+$/.test(fieldPart.slice(dot + 1))) ? fieldPart.slice(0, dot) : fieldPart;
    for (const [sid, fields] of Object.entries(SECTION_FIELDS)) { if (fields.includes(base)) return sid; }
    return null;
  }, []);

  /* Stage a draft: localEdits + pendingEdits + localStorage, drop the section's approved flag. NO DB write. */
  const stageDraft = useCallback((record, fieldPart, editKey, value, idx) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const sid = sectionIdForFieldPart(fieldPart);
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId, sectionIdForFieldPart]);

  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    stageDraft(record, fn, editKey, saveVal, idx);
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}.${arrIdx}-${idx}`;
    stageDraft(record, `${fn}.${arrIdx}`, editKey, value, idx);
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId, stageDraft]);

  /* Save a nested OBJECT leaf by dot-path (e.g. results.wbc) — stage the merged object under `${rootField}-${idx}` */
  const saveLeaf = useCallback((record, rootField, path, idx, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${rootField}-${idx}`;
    setLocalEdits(prev => {
      const cur = prev[editKey] !== undefined ? prev[editKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) { if (node[path[i]] === undefined || node[path[i]] === null) node[path[i]] = {}; node = node[path[i]]; }
      node[path[path.length - 1]] = newVal;
      // stage the merged object as the pending draft (committed whole on Approve)
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][rootField] = clone;
      writeDrafts(store);
      return { ...prev, [editKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const sid = sectionIdForFieldPart(rootField);
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId, sectionIdForFieldPart]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage as DRAFT (no DB write); localStorage keeps it across refresh; Approve commits it.
      stageDraft(record, fn, `${fn}-${idx}`, fullText, idx);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(record, fn, `${fn}-${idx}`, fullText, idx);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* −/+ stepper: nudge editValue by the value's own precision (stepFor), clamped >= 0. */
  const stepEditValue = (dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev); const base = isNaN(n) ? 0 : n;
      const stepStr = stepFor(prev); const step = parseFloat(stepStr) || 1;
      const decimals = (stepStr.split('.')[1] || '').length;
      let next = parseFloat((base + dir * step).toFixed(decimals));
      if (next < 0) next = 0;
      return String(next);
    });
  };

  /* saveSentenceLeaf: edit ONE leaf of an unlabeled sentence addressed by (sIdx, pi=semicolon-part,
     ci=guarded-comma-item). Rebuilds part=items.join(', '), sentence=parts.join('; '), full text via
     reconstructFullText; empty edit removes the leaf (memory 6a4a4cd5). */
  function saveSentenceLeaf(record, fn, idx, sIdx, pi, ci, isComma) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const semParts = splitBySemicolon(sentences[sIdx] || '');
    const edited = editValue.trim();
    if (isComma) {
      const items = splitGuardedComma(semParts[pi] || '');
      if (!edited || /^[;.,!?]+$/.test(edited)) { items.splice(ci, 1); }
      else { const subParts = splitGuardedComma(edited); if (subParts.length > 1) items.splice(ci, 1, ...subParts); else items[ci] = edited; }
      semParts[pi] = items.join(', ');
    } else {
      if (!edited || /^[;.,!?]+$/.test(edited)) { semParts.splice(pi, 1); }
      else { semParts[pi] = edited; }
    }
    sentences[sIdx] = semParts.filter(p => p && p.trim()).join('; ');
    const fullText = reconstructFullText(sentences);
    stageDraft(record, fn, `${fn}-${idx}`, fullText, idx);
    setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sIdx}-p${pi}-c${ci}`]: 'edited' }));
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so committed values
  // flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Collect this record's pending edits whose base field belongs to this section.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // "field", "field.arrayIndex", or dotted nested field
      const dot = fieldPart.lastIndexOf('.');
      const base = (dot !== -1 && /^\d+$/.test(fieldPart.slice(dot + 1))) ? fieldPart.slice(0, dot) : fieldPart;
      return fields.includes(base);
    });
    setSaving(true); setSaveError(null);
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dot = fieldPart.lastIndexOf('.');
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric (reverses handleSaveField/handleSaveArrayItem)
        const isArrayItem = dot !== -1 && /^\d+$/.test(fieldPart.slice(dot + 1));
        const payload = isArrayItem
          ? { field: fieldPart.slice(0, dot), value: localEdits[editKey], arrayIndex: parseInt(fieldPart.slice(dot + 1), 10) }
          : { field: fieldPart, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/disease_severity/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/disease_severity/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fieldPart = k.slice(0, -suffix.length); delete store[id][fieldPart]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[DiseaseSeverity] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
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

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  /* Copy lines for a sentence field: labeled group (label + comma rows) OR unlabeled → semicolon parts,
     each guarded-comma (>=3) expanded. Running number (unlabeled continues) — memory 6a4a4cd5. */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        lines.push(parsed.label + ':');
        if (parts.length >= 2) parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        else lines.push(`  ${n++}. ${parsed.value}`);
        return;
      }
      splitBySemicolon(s).forEach(part => {
        const items = splitGuardedComma(part);
        if (items.length >= 3) items.forEach(it => { lines.push(`${n++}. ${it}`); });
        else lines.push(`${n++}. ${part.replace(/[;.]+$/, '').trim()}`);
      });
    });
    return lines;
  }, [splitBySentence]);

  /* Canonical section copy: title + '='; every field = sub-label + '-' + numbered value row(s). NEVER
     side-by-side "Label: value" (one-pass items 1-3). single-name rule (item 4): field label == section
     title → hide the sub-label (Complications / Quality of Life / Prognostic Factors). */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sl = label.toLowerCase() !== title.toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val) && val !== 0) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n1. ${formatDate(val)}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        const arr = Array.isArray(val) ? val : [];
        arr.forEach((item, i) => { text += `${i + 1}. ${typeof item === 'object' ? JSON.stringify(item) : String(item)}\n`; });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f) && typeof val === 'object') {
        if (isEmptyDeep(val)) return;
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else {
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        text += `1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `Disease Severity\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Disease Severity ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const section = buildSectionCopyText(r, idx, sid);
        // Empty-section guard: a section with only its title + '=' divider (<=2 non-empty lines) is empty.
        if (section.split('\n').filter(l => l.trim()).length > 2) text += section;
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) && val !== 0) return null;
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
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>{'−'}</button>
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const parsed = parseFloat(editValue); if (isNaN(parsed)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, parsed); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD (known clinical scale → <select>) ═══════ */
  const renderEnumField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    const options = enumOptionsWith(ENUM_FIELDS[fn], displayVal);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(enumCanonical(ENUM_FIELDS[fn], displayVal)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD ═══════ */
  const renderArrayField = (record, fn, idx, sid, title) => {
    const rawArr = getFieldValue(record, fn, idx);
    if (!Array.isArray(rawArr) || rawArr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase(); // single-name rule: hide sub-label == section title
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    /* Apply local edits to array items */
    const arr = rawArr.map((item, ai) => {
      const eKey = `${fn}.${ai}-${idx}`;
      return localEdits[eKey] !== undefined ? localEdits[eKey] : item;
    });

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {arr.map((item, arrIdx) => {
            const itemStr = String(item);
            const editKey = `${fn}.${arrIdx}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!itemMatches && searchTerm.trim()) return null;

            return (
              <div key={arrIdx}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx, editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageDraft(record, fn, `${fn}-${idx}`, fullText2, idx); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div>
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

            /* Labeled sentence with < 2 comma items → single labeled row */
            if (parsed.isLabeled) {
              return (
                <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                  <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.value); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = `${parsed.label}: ${editValue.trim()}`; const fullText = reconstructFullText(sentences2); stageDraft(record, fn, `${fn}-${idx}`, fullText, idx); setEditedSentences(prev => ({ ...prev, [sentenceKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed.value)}</span><span className="edit-indicator">✎</span></div>
                        <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                </div>
              );
            }

            /* Unlabeled sentence → split by semicolon, then guarded comma (>=3) into leaf rows (6a4a4cd5) */
            const semParts = splitBySemicolon(sentence);
            const leaves = [];
            semParts.forEach((part, pi) => {
              const items = splitGuardedComma(part);
              if (items.length >= 3) items.forEach((it, ci) => leaves.push({ pi, ci, text: it, comma: true }));
              else leaves.push({ pi, ci: 0, text: part.replace(/[;.]+$/, '').trim(), comma: false });
            });
            return (
              <div key={sIdx}>
                {leaves.map((leaf, li) => {
                  const leafKey = `${fn}-${idx}-s${sIdx}-p${leaf.pi}-c${leaf.ci}`;
                  const leafEditing = editingField === leafKey;
                  const leafBadge = editedSentences[leafKey];
                  const leafMatches = phraseMatch || labelMatch || !searchTerm.trim() || leaf.text.toLowerCase().includes(searchTerm.toLowerCase().trim());
                  if (!leafMatches && searchTerm.trim()) return null;
                  return (
                    <div key={li}>
                      <div className={`numbered-row ${leafBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!leafEditing) { setEditingField(leafKey); setEditValue(leaf.text); setSaveError(null); } }}>
                        {leafEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentenceLeaf(record, fn, idx, sIdx, leaf.pi, leaf.ci, leaf.comma); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(leaf.text)}</span><span className="edit-indicator">✎</span></div>
                            <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(leaf.text, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {leafBadge && <span className={`modified-badge ${leafBadge === 'added' ? 'added' : ''}`}>{leafBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: editable OBJECT leaf (scalar) by dot-path ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    return (
      <div key={path[path.length - 1]} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(leafValueString); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLeaf(record, rootField, path, idx, leafKey, editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(leafValueString, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: recursively render an OBJECT node ═══════ */
  const renderObjectNode = (record, rootField, idx, label, value, path) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectLeaf(record, rootField, [...path, k], idx, v)
            : <div className="rec-mini-card" key={k}>{renderObjectNode(record, rootField, idx, humanizeKey(k), v, [...path, k])}</div>
        ))}
      </React.Fragment>
    );
  };

  /* ═══════ RENDER: object section (e.g. `results`) ═══════ */
  const renderObjectSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fn = (SECTION_FIELDS[sid] || [])[0];
    const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const copyId = `${sid}-${idx}`;
    const copyText = () => {
      const lines = [`${title}`, COPY_LINE_EQ, ''];
      entries.forEach(([k, v]) => objectCopyLines(humanizeKey(k), v).forEach(l => lines.push(l)));
      return lines.join('\n');
    };
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(copyText(), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {entries.map(([k, v]) => (
            isScalar(v)
              ? renderObjectLeaf(record, fn, [k], idx, v)
              : <div className="rec-mini-card" key={k}>{renderObjectNode(record, fn, idx, humanizeKey(k), v, [k])}</div>
          ))}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    // Check if section has any values
    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(val) && val.length > 0;
      return hasVal(val) || val === 0;
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
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="disease-severity-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Disease Severity</h2></div>
        <div className="empty-state">No disease severity records available</div>
      </div>
    );
  }

  return (
    <div className="disease-severity-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Disease Severity</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DiseaseSeverityDocumentPDFTemplate document={pdfData} />} fileName="Disease_Severity.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search disease severity..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Disease Severity ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'severity-overview')}
            {renderSection(record, idx, 'crisis-frequency')}
            {renderSection(record, idx, 'complications-section')}
            {renderSection(record, idx, 'quality-of-life')}
            {renderSection(record, idx, 'prognostic-factors')}
            {renderSection(record, idx, 'assessment-plan')}
            {renderSection(record, idx, 'recommendations-notes')}
            {renderObjectSection(record, idx, 'results-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiseaseSeverityDocument;
