/**
 * DiabetesManagementPlanDocument.jsx
 * June 2026 — Complete template with inline editing, blue glow theme
 * Collection: diabetes_management_plan
 *
 * 6 Sections:
 *   1. overview: date, provider, facility, status
 *   2. regimen: insulinAdministration, glucometerDownloadSchedule, carbohydrateCounting, monitoringFrequency
 *   3. meal-plan: mealPlan
 *   4. targets: targetRanges (OBJECT {dayTargetBG,nightTargetBG,TIR,TBR})
 *   5. clinical: findings, assessment, plan, recommendations, notes
 *   6. results-section: results (DYNAMIC-KEY OBJECT, recursively nested lab/test results)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DiabetesManagementPlanDocumentPDFTemplate from '../pdf-templates/DiabetesManagementPlanDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './DiabetesManagementPlanDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'diabetes_management_planPendingEdits';
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
  'overview': 'Plan Overview',
  'regimen': 'Insulin & Monitoring',
  'meal-plan': 'Meal Plan',
  'targets': 'Target Ranges',
  'clinical': 'Findings, Assessment & Plan',
  'results-section': 'Results',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  insulinAdministration: 'Insulin Administration',
  glucometerDownloadSchedule: 'Glucometer Download Schedule',
  carbohydrateCounting: 'Carbohydrate Counting',
  monitoringFrequency: 'Monitoring Frequency',
  mealPlan: 'Meal Plan',
  targetRanges: 'Target Ranges',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
  results: 'Results',
};

/* humanized labels for targetRanges object sub-keys */
const OBJECT_KEY_LABELS = {
  targetRanges: {
    dayTargetBG: 'Day Target BG',
    nightTargetBG: 'Night Target BG',
    TIR: 'TIR',
    TBR: 'TBR',
  },
};

const SECTION_FIELDS = {
  'overview': ['date', 'provider', 'facility', 'status'],
  'regimen': ['insulinAdministration', 'glucometerDownloadSchedule', 'carbohydrateCounting', 'monitoringFrequency'],
  'meal-plan': ['mealPlan'],
  'targets': ['targetRanges'],
  'clinical': ['findings', 'assessment', 'plan', 'recommendations', 'notes'],
  'results-section': ['results'],
};

const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['carbohydrateCounting'];
const ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['targetRanges'];
/* targetRanges = flat object (display-only key:value rows); results = dynamic-key recursive object (editable leaves) */
const RECURSIVE_OBJECT_FIELDS = ['results'];
const STRING_FIELDS = ['provider', 'facility', 'status', 'insulinAdministration', 'glucometerDownloadSchedule', 'monitoringFrequency', 'mealPlan', 'findings', 'assessment', 'plan', 'notes'];
/* narrative fields get sentence/comma splitting; provider/facility credentials must stay whole */
const NARRATIVE_FIELDS = ['insulinAdministration', 'glucometerDownloadSchedule', 'monitoringFrequency', 'mealPlan', 'findings', 'assessment', 'plan', 'notes'];

/* single-name sections: field label === section title → suppress duplicate field label */
const SINGLE_NAME_SECTIONS = { 'meal-plan': 'mealPlan' };

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* status is a fixed-choice enum (stored lowercase "active") */
const ENUM_FIELDS = { status: ['Active', 'Completed', 'Not Active'] };
const enumCanonical = (options, current) => {
  const cur = String(current ?? '').trim();
  const hit = options.find(o => o.toLowerCase() === cur.toLowerCase());
  return hit || cur;
};
const enumOptionsWith = (options, current) => {
  const cur = String(current ?? '').trim();
  if (!cur || options.some(o => o.toLowerCase() === cur.toLowerCase())) return options;
  return [cur, ...options];
};

/* recursive-object helpers (for dynamic-key `results`) */
const isEmptyDeep = (v) => {
  if (v === null || v === undefined || v === '') return true;
  if (typeof v === 'boolean' || typeof v === 'number') return false;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* humanize an object key for display */
const humanizeKey = (k) => {
  if (!k) return '';
  return String(k)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
    .trim();
};

/* formatDate: format a date string for display */
const formatDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  if (d.getUTCFullYear() <= 1970) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split with the 4 guards
   (no-space commas like "2,300" stay; "and"/"or" adjacency stays connected;
   next char must be a letter / '>' / '(' to split) */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const nextTrim = rest.trimStart();
      const noSpace = rest.charAt(0) !== ' ';
      const andOr = /(?:^|\s)(?:and|or)$/i.test(current.trimEnd()) || /^(?:and|or)\b/i.test(nextTrim);
      const badNext = !/^[A-Za-z>(]/.test(nextTrim.charAt(0) || '');
      if (noSpace || andOr || badNext) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ═══════ COMPONENT ═══════ */
const DiabetesManagementPlanDocument = ({ document: docProp }) => {
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
      if (r?.diabetes_management_plan) return Array.isArray(r.diabetes_management_plan) ? r.diabetes_management_plan : [r.diabetes_management_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_management_plan) return Array.isArray(dd.diabetes_management_plan) ? dd.diabetes_management_plan : [dd.diabetes_management_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Draft store shape: { [recordId]: { [field]: value } }. We repopulate localEdits + pendingEdits and
     the edited-field markers so the Pending Approve button reappears. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([field, value]) => {
        const editKey = `${field}-${idx}`;
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

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  /* Rebuild the field text after a sentence edit. A semicolon-joined list ("a; b; c") keeps
     its SEMICOLON delimiter — rejoining with periods silently corrupts the stored shape. */
  function reconstructFullText(sentences, originalText) {
    if (!sentences || sentences.length === 0) return '';
    const semiJoined = typeof originalText === 'string' && originalText.includes(';') && !/\.\s/.test(originalText);
    if (semiJoined) return sentences.map(s => s.replace(/[;.]+$/, '').trim()).filter(Boolean).join('; ');
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

  /* populated entries of an object field (hide empty) */
  const objectEntries = useCallback((record, fn, idx) => {
    const val = getFieldValue(record, fn, idx);
    if (!val || typeof val !== 'object' || Array.isArray(val)) return [];
    return Object.entries(val).filter(([, v]) => hasVal(v));
  }, [getFieldValue, hasVal]);

  /* flatten a (possibly nested) object's keys+values into one lowercase searchable string */
  const flattenSearchable = useCallback((value) => {
    if (isEmptyDeep(value)) return '';
    if (isScalar(value)) return fmtScalar(value).toLowerCase();
    return Object.entries(value)
      .filter(([, v]) => !isEmptyDeep(v))
      .map(([k, v]) => `${humanizeKey(k).toLowerCase()} ${flattenSearchable(v)}`)
      .join(' ');
  }, []);

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
      if (RECURSIVE_OBJECT_FIELDS.includes(f)) {
        if (flattenSearchable(getFieldValue(record, f, 0)).includes(phrase)) return true;
        continue;
      }
      if (OBJECT_FIELDS.includes(f)) {
        const keyMap = OBJECT_KEY_LABELS[f] || {};
        for (const [k, v] of objectEntries(record, f, 0)) {
          const kl = (keyMap[k] || humanizeKey(k)).toLowerCase();
          if (kl.includes(phrase) || String(v).toLowerCase().includes(phrase)) return true;
        }
        continue;
      }
      let val = getFieldValue(record, f, 0);
      if (DATE_FIELDS.includes(f)) val = formatDate(val);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (Object.entries(val).some(([k, v]) => String(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, objectEntries]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    if (RECURSIVE_OBJECT_FIELDS.includes(fn)) {
      return flattenSearchable(getFieldValue(record, fn, idx)).includes(phrase);
    }
    if (OBJECT_FIELDS.includes(fn)) {
      const keyMap = OBJECT_KEY_LABELS[fn] || {};
      return objectEntries(record, fn, idx).some(([k, v]) => {
        const kl = (keyMap[k] || humanizeKey(k)).toLowerCase();
        return kl.includes(phrase) || String(v).toLowerCase().includes(phrase);
      });
    }
    let val = getFieldValue(record, fn, idx);
    if (DATE_FIELDS.includes(fn)) val = formatDate(val);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      if (typeof val === 'object') return Object.entries(val).some(([k, v]) => String(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, objectEntries]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Diabetes Management Plan ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const km of Object.values(OBJECT_KEY_LABELS)) { for (const l of Object.values(km)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; } }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          if (RECURSIVE_OBJECT_FIELDS.includes(f)) {
            if (flattenSearchable(getFieldValue(record, f, idx)).includes(phrase)) return true;
            continue;
          }
          if (OBJECT_FIELDS.includes(f)) {
            if (objectEntries(record, f, idx).some(([, v]) => String(v).toLowerCase().includes(phrase))) return true;
            continue;
          }
          let val = getFieldValue(record, f, idx);
          if (DATE_FIELDS.includes(f)) val = formatDate(val);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, objectEntries]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button returns to yellow Pending.
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  /* saveLeaf: edit a nested OBJECT leaf by dot-path (e.g. results.HbA1c) — value stays a string.
     Defer-save: stages the whole rootField object clone locally + to localStorage; commits on Approve. */
  const saveLeaf = useCallback((record, rootField, path, idx, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${rootField}-${idx}`;
    setLocalEdits(prev => {
      const cur = prev[editKey] !== undefined ? prev[editKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][rootField] = clone;
      writeDrafts(store);
      return { ...prev, [editKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId]);

  /* stageDraft: shared defer-save for whole-string fields — stage locally + localStorage, no DB write. */
  function stageDraft(record, fn, idx, sid, fullText) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated, currentVal);
      stageDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated, currentVal);
    stageDraft(record, fn, idx, sid, fullText);
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
    const fullText = reconstructFullText(allS, currentVal);
    stageDraft(record, fn, idx, sid, fullText);
    const sentenceKey = `${fn}-${idx}-s${sIdx}`;
    const commaKey = `${sentenceKey}-c${ciIdx}`;
    const marks = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ciIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
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

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Collect this record's pending edits for this section's fields (localEdits key = "<field>-<idx>").
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart;
        // base = field unless the trailing dot-segment is purely numeric (arrayIndex)
        const lastSeg = fieldPart.slice(fieldPart.lastIndexOf('.') + 1);
        const realField = (fieldPart.includes('.') && /^\d+$/.test(lastSeg)) ? baseField : fieldPart;
        return fields.includes(realField);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for dotted-numeric keys).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(lastSeg);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(lastSeg, 10);
        await secureApiClient.put(`/api/edit/diabetes_management_plan/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/diabetes_management_plan/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed fields from the localStorage draft store
      const store = readDrafts();
      if (store[id]) {
        fields.forEach(f => { if (store[id]) delete store[id][f]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySectionText = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let running = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
      if (!value) return;
      const parts = splitByComma(value);
      if (parsed.isLabeled) {
        lines.push(parsed.label);
        lines.push(COPY_LINE_DASH);
        if (parts.length >= 3) parts.forEach((item, i) => { lines.push(`${i + 1}. ${item}`); });
        else lines.push(`1. ${value}`);
      } else if (parts.length >= 3) {
        parts.forEach(item => { lines.push(`${running++}. ${item}`); });
      } else {
        lines.push(`${running++}. ${value}`);
      }
    });
    return lines;
  }, [splitBySentence]);

  /* recursive copy lines: every key = labeled sub-group (DASH + restart numbering) */
  const objectCopyLines = useCallback((label, value) => {
    const out = [];
    if (isEmptyDeep(value)) return out;
    if (label) { out.push(label); out.push(COPY_LINE_DASH); }
    if (isScalar(value)) { out.push(`1. ${fmtScalar(value)}`); return out; }
    if (Array.isArray(value)) {
      value.filter(v => !isEmptyDeep(v)).forEach((v, i) => {
        if (isScalar(v)) out.push(`${i + 1}. ${fmtScalar(v)}`);
        else out.push(...objectCopyLines('', v));
      });
      return out;
    }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v)));
    return out;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      // single-name rule: a field label equal to the section title is not repeated
      const suppressLabel = SINGLE_NAME_SECTIONS[sid] === f || label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = suppressLabel ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      if (DATE_FIELDS.includes(f)) {
        const dv = formatDate(getFieldValue(record, f, idx));
        if (!dv) return;
        text += `${head}1. ${dv}\n\n`;
        return;
      }
      if (BOOLEAN_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        if (typeof val !== 'boolean') return;
        text += `${head}1. ${fmtVal(val)}\n\n`;
        return;
      }
      if (RECURSIVE_OBJECT_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        if (isEmptyDeep(val)) return;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v).forEach(l => { text += `${l}\n`; }));
        text += '\n';
        return;
      }
      if (OBJECT_FIELDS.includes(f)) {
        const entries = objectEntries(record, f, idx);
        if (entries.length === 0) return;
        const keyMap = OBJECT_KEY_LABELS[f] || {};
        entries.forEach(([k, v]) => { text += `${keyMap[k] || humanizeKey(k)}\n${COPY_LINE_DASH}\n1. ${fmtVal(v)}\n`; });
        text += '\n';
        return;
      }
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${head}${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (NARRATIVE_FIELDS.includes(f)) {
        text += head;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (STRING_FIELDS.includes(f)) {
        text += `${head}1. ${fmtVal(val).replace(/[;.]+$/, '').trim()}\n\n`;
      } else {
        text += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, objectEntries, splitBySentence, formatSentenceFieldLines, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = `Diabetes Management Plan\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Diabetes Management Plan ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const sectionText = buildSectionCopyText(r, idx, sid);
        // skip empty sections: title + divider alone is 2 non-empty lines
        if (sectionText.split('\n').filter(l => l.trim()).length > 2) text += sectionText;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE FIELD (display-only formatted, editable raw) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx);
    const displayVal = formatDate(raw);
    if (!displayVal) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const editInit = (() => { const d = new Date(raw); return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; })();

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(editInit); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: BOOLEAN FIELD (Yes/No dropdown) ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (typeof val !== 'boolean') return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'true' : 'false'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue === 'true'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT FIELD (sub-label + editable value rows via saveLeaf) ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const entries = objectEntries(record, fn, idx);
    if (entries.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    const keyMap = OBJECT_KEY_LABELS[fn] || {};
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => {
          const keyLabel = keyMap[k] || humanizeKey(k);
          const itemKey = `${fn}.${k}-${idx}`;
          const isEditing = editingField === itemKey;
          const isModified = editedFields[itemKey];
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const ll = label.toLowerCase();
            const kl = keyLabel.toLowerCase();
            if (!ll.includes(phrase) && !phrase.includes(ll) && !kl.includes(phrase) && !String(v).toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={k} className="nested-mini-card">
              <div className="nested-subtitle sub-label">{highlightText(keyLabel)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(fmtVal(v)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLeaf(record, fn, [k], idx, itemKey, editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(fmtVal(v))}</span><span className="edit-indicator">{'✎'}</span></div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(fmtVal(v), itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: ENUM FIELD (fixed-choice dropdown) ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const strVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const options = enumOptionsWith(ENUM_FIELDS[fn], strVal);

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(enumCanonical(ENUM_FIELDS[fn], strVal)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">{'✎'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: RESULTS — DYNAMIC-KEY OBJECT (recursive, editable scalar leaves) ═══════ */
  const renderResultsLeaf = (record, rootField, path, idx, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const keyLabel = humanizeKey(path[path.length - 1]);
    return (
      <div key={path.join('.')} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(keyLabel)}</div>
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
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${keyLabel}: ${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* recursive node: scalar → editable leaf; nested object → subtitle + recurse */
  const renderResultsNode = (record, rootField, idx, label, value, path) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderResultsLeaf(record, rootField, path, idx, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={path.join('.') || rootField} className="rec-mini-card">
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => renderResultsNode(record, rootField, idx, humanizeKey(k), v, [...path, k]))}
      </div>
    );
  };

  const renderResultsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => renderResultsNode(record, fn, idx, humanizeKey(k), v, [k]))}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
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
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          const parsed = parseLabel(itemStr);
          return (
            <div key={itemIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 4 } : undefined}>
              {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(parsed.isLabeled ? parsed.value : itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const saveVal = parsed.isLabeled ? `${parsed.label}: ${editValue}` : editValue; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = saveVal; stageDraft(record, fn, idx, sid, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const suppressLabel = SINGLE_NAME_SECTIONS[sid] === fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Narrative fields take the sentence/comma path even for a SINGLE sentence
       (a lone 5-comma "plan" sentence must still become per-part rows) */
    const singleParts = sentences.length === 1 ? splitByComma(sentences[0].replace(/[;.]+$/, '').trim()) : [];
    if (NARRATIVE_FIELDS.includes(fn) && (sentences.length > 1 || parseLabel(sentences[0] || '').isLabeled || singleParts.length >= 3)) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {!suppressLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                if (commaItems.length >= 3) {
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

              /* Unlabeled sentence that is a genuine comma list (>=3 guarded parts) → one row per part */
              if (!parsed.isLabeled) {
                const parts = splitByComma(sentence.replace(/[;.]+$/, '').trim());
                if (parts.length >= 3) {
                  return (
                    <React.Fragment key={sIdx}>
                      {parts.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const cur2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(cur2); const parts2 = splitByComma((sentences2[sIdx] || '').replace(/[;.]+$/, '').trim()); parts2[ciIdx] = editValue.trim().replace(/[;.]+$/, '').trim(); const allS = [...sentences2]; allS[sIdx] = parts2.filter(Boolean).join(', '); stageDraft(record, fn, idx, sid, reconstructFullText(allS, cur2)); setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">{'✎'}</span></div>
                                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                                </>
                              )}
                            </div>
                            {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                          </div>
                        );
                      })}
                    </React.Fragment>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText((parsed.isLabeled ? parsed.value : sentence).replace(/[;.]+$/, '').trim())}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence.replace(/[;.]+$/, '').trim(), sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
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

    /* Single-value string: use saveSentence */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        {!suppressLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(suppressLabel ? strVal : `${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      if (DATE_FIELDS.includes(f)) return Boolean(formatDate(getFieldValue(record, f, idx)));
      if (BOOLEAN_FIELDS.includes(f)) return typeof getFieldValue(record, f, idx) === 'boolean';
      if (RECURSIVE_OBJECT_FIELDS.includes(f)) { const v = getFieldValue(record, f, idx); return v && typeof v === 'object' && !isScalar(v) && !isEmptyDeep(v); }
      if (OBJECT_FIELDS.includes(f)) return objectEntries(record, f, idx).length > 0;
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
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySectionText(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid);
            if (RECURSIVE_OBJECT_FIELDS.includes(f)) return renderResultsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="diabetes-management-plan-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Diabetes Management Plan</h2></div>
        <div className="empty-state">No diabetes management plan data available</div>
      </div>
    );
  }

  return (
    <div className="diabetes-management-plan-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Diabetes Management Plan</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DiabetesManagementPlanDocumentPDFTemplate document={pdfData} />} fileName="Diabetes_Management_Plan.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search diabetes management plan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Diabetes Management Plan ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'overview')}
            {renderSection(record, idx, 'regimen')}
            {renderSection(record, idx, 'meal-plan')}
            {renderSection(record, idx, 'targets')}
            {renderSection(record, idx, 'clinical')}
            {renderSection(record, idx, 'results-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiabetesManagementPlanDocument;
