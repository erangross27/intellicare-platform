/**
 * HeadacheAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: headache_assessment
 *
 * 9 Sections:
 *   1. session-info: date (date picker), provider (string), facility (string), status (string)
 *   2. headache-profile: headacheType, frequency, severity, duration, location, quality
 *   3. triggers: triggers (array of strings)
 *   4. associated-symptoms: associatedSymptoms.nausea (bool), .photophobia (bool), .phonophobia (bool), .aura (string)
 *   5. therapies: abortiveTherapy (array of objects), preventiveTherapy (array of objects)
 *   6. diary: headacheDiary (array of objects, recursive)
 *   7. scoring: midasScore
 *   8. clinical-findings: findings (narrative string, per-sentence), assessment, plan
 *   9. results-recs: results (object, recursive), recommendations (array of {recommendation,date})
 *  10. clinical-notes: notes (long string)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import HeadacheAssessmentDocumentPDFTemplate from '../pdf-templates/HeadacheAssessmentDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './HeadacheAssessmentDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'headache-profile': 'Headache Profile',
  'triggers': 'Triggers',
  'associated-symptoms': 'Associated Symptoms',
  'therapies': 'Therapies',
  'diary': 'Headache Diary',
  'scoring': 'Scoring',
  'clinical-findings': 'Clinical Findings',
  'results-recs': 'Results & Recommendations',
  'clinical-notes': 'Clinical Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  headacheType: 'Headache Type',
  frequency: 'Frequency',
  severity: 'Severity',
  duration: 'Duration',
  location: 'Location',
  quality: 'Quality',
  triggers: 'Triggers',
  'associatedSymptoms.nausea': 'Nausea',
  'associatedSymptoms.photophobia': 'Photophobia',
  'associatedSymptoms.phonophobia': 'Phonophobia',
  'associatedSymptoms.aura': 'Aura',
  headacheDiary: 'Headache Diary',
  midasScore: 'MIDAS Score',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'headache-profile': ['headacheType', 'frequency', 'severity', 'duration', 'location', 'quality'],
  'triggers': ['triggers'],
  'associated-symptoms': ['associatedSymptoms.nausea', 'associatedSymptoms.photophobia', 'associatedSymptoms.phonophobia', 'associatedSymptoms.aura'],
  'therapies': ['abortiveTherapy', 'preventiveTherapy'],
  'diary': ['headacheDiary'],
  'scoring': ['midasScore'],
  'clinical-findings': ['findings', 'assessment', 'plan'],
  'results-recs': ['results', 'recommendations'],
  'clinical-notes': ['notes'],
};

const STRING_FIELDS = ['provider', 'facility', 'status', 'headacheType', 'frequency', 'severity', 'duration', 'location', 'quality', 'midasScore', 'findings', 'assessment', 'plan', 'notes', 'associatedSymptoms.aura'];
const BOOLEAN_FIELDS = ['associatedSymptoms.nausea', 'associatedSymptoms.photophobia', 'associatedSymptoms.phonophobia'];
const DATE_FIELDS = ['date'];
const ARRAY_OF_STRING_FIELDS = ['triggers'];
const ARRAY_OF_OBJECT_FIELDS = ['abortiveTherapy', 'preventiveTherapy', 'headacheDiary'];
const OBJECT_FIELDS = ['results'];
const RECOMMENDATIONS_FIELDS = ['recommendations'];

const ABORTIVE_THERAPY_FIELDS = [
  { key: 'medication', label: 'Medication' },
  { key: 'usage', label: 'Usage' },
  { key: 'effectiveness', label: 'Effectiveness' },
];

const PREVENTIVE_THERAPY_FIELDS = [
  { key: 'medication', label: 'Medication' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'effectiveness', label: 'Effectiveness' },
];

/* humanizeKey: camelCase / snake_case → "Title Case" */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
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

/* parseLabel: detect "Label: value" patterns (CLAUSE_OPENER guard rejects sentence clauses) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
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

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'headache_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ COMPONENT ═══════ */
const HeadacheAssessmentDocument = ({ document: docProp }) => {
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
      if (r?.headache_assessment) return Array.isArray(r.headache_assessment) ? r.headache_assessment : [r.headache_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.headache_assessment) return Array.isArray(dd.headache_assessment) ? dd.headache_assessment : [dd.headache_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recId(record);
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
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]|\d))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* getNestedFieldValue: supports dotted paths like associatedSymptoms.nausea */
  const getNestedValue = useCallback((record, fn) => {
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { if (val == null) return undefined; val = val[p]; }
      return val;
    }
    return record[fn];
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return getNestedValue(record, fn);
  }, [localEdits, getNestedValue]);

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
      if (ARRAY_OF_OBJECT_FIELDS.includes(f)) {
        const arr = getFieldValue(record, f, 0);
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item && typeof item === 'object') {
              for (const v of Object.values(item)) {
                if (v && fmtVal(v).toLowerCase().includes(phrase)) return true;
              }
            }
          }
        }
      } else if (ARRAY_OF_STRING_FIELDS.includes(f)) {
        const arr = getFieldValue(record, f, 0);
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item && String(item).toLowerCase().includes(phrase)) return true;
          }
        }
      } else {
        const val = getFieldValue(record, f, 0);
        if (val !== null && val !== undefined) {
          if (fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
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
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Headache Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          if (ARRAY_OF_OBJECT_FIELDS.includes(f)) {
            const arr = getFieldValue(record, f, idx);
            if (Array.isArray(arr)) {
              for (const item of arr) {
                if (item && typeof item === 'object') {
                  for (const v of Object.values(item)) {
                    if (v && fmtVal(v).toLowerCase().includes(phrase)) return true;
                  }
                }
              }
            }
          } else if (ARRAY_OF_STRING_FIELDS.includes(f)) {
            const arr = getFieldValue(record, f, idx);
            if (Array.isArray(arr)) {
              for (const item of arr) {
                if (item && String(item).toLowerCase().includes(phrase)) return true;
              }
            }
          } else {
            const val = getFieldValue(record, f, idx);
            if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          if (fn.includes('.')) {
            const parts = fn.split('.');
            if (!merged[parts[0]]) merged[parts[0]] = {};
            merged[parts[0]][parts[1]] = localEdits[key];
          } else {
            merged[fn] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  /* save a nested OBJECT leaf by dot-path (e.g. results.severity) */
  // Save = stage a DRAFT locally (no DB write). localStorage keeps it across refresh; Approve commits it.
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
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
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId]);

  // Save = stage a DRAFT locally + write to localStorage (survives refresh). Approve commits to DB.
  function stageSentenceDraft(id, fn, idx, fullText) {
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
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
      const fullText = reconstructFullText(updated);
      stageSentenceDraft(id, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageSentenceDraft(id, fn, idx, fullText);
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

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values flow into pdfData/PDF/Copy. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Pending edits for this record whose field belongs to this section
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
          ? fieldPart.slice(0, lastDot) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        // arrayIndex ONLY when the trailing dot-segment is purely numeric (e.g. "recommendations.2")
        const hasArrayIndex = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: hasArrayIndex ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (hasArrayIndex) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/headache_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/headache_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); if (store[id]) delete store[id][fp]; });
        if (store[id] && Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); } finally { setSaving(false); }
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
          parts.forEach(item => { const ip = parseLabel(item); if (ip.isLabeled) { lines.push(`  ${ip.label}:`); lines.push(`    ${n++}. ${ip.value}`); } else { lines.push(`  ${n++}. ${item}`); } });
        } else { lines.push(parsed.label + ':'); lines.push(`  ${n++}. ${parsed.value}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    const flattenObjectLines = (obj, indent) => {
      const lines = [];
      Object.entries(obj).forEach(([k, v]) => {
        if (isEmptyDeep(v)) return;
        if (isScalar(v)) lines.push(`${indent}${humanizeKey(k)}: ${fmtScalar(v)}`);
        else { lines.push(`${indent}${humanizeKey(k)}:`); lines.push(...flattenObjectLines(v, indent + '  ')); }
      });
      return lines;
    };
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (f === 'headacheDiary') {
        const arr = getFieldValue(record, f, idx);
        if (!Array.isArray(arr) || arr.length === 0) return;
        text += `${label}\n`;
        arr.forEach((item, mi) => {
          if (isEmptyDeep(item)) return;
          if (isScalar(item)) { text += `  ${mi + 1}. ${fmtScalar(item)}\n`; return; }
          text += `  Entry ${mi + 1}\n`;
          flattenObjectLines(item, '     ').forEach(l => { text += `${l}\n`; });
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        const obj = getFieldValue(record, f, idx);
        if (!obj || typeof obj !== 'object' || isEmptyDeep(obj)) return;
        text += `${label}\n`;
        flattenObjectLines(obj, '  ').forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (RECOMMENDATIONS_FIELDS.includes(f)) {
        const arr = getFieldValue(record, f, idx);
        if (!Array.isArray(arr) || arr.length === 0) return;
        text += `${label}\n`;
        arr.forEach((item, i) => {
          const rt = (item?.recommendation || '').trim();
          const rd = (item?.date || '').trim();
          if (!rt && !rd) return;
          text += `  ${i + 1}. ${rt}${rd ? ` (${rd})` : ''}\n`;
        });
        text += '\n';
      } else if (ARRAY_OF_OBJECT_FIELDS.includes(f)) {
        const arr = getFieldValue(record, f, idx);
        if (!Array.isArray(arr) || arr.length === 0) return;
        const subFields = f === 'abortiveTherapy' ? ABORTIVE_THERAPY_FIELDS : PREVENTIVE_THERAPY_FIELDS;
        text += `${label}\n`;
        arr.forEach((item, mi) => {
          text += `  ${mi + 1}. ${item.medication || `Item ${mi + 1}`}\n`;
          subFields.forEach(sf => {
            if (sf.key === 'medication') return;
            const sv = item[sf.key];
            if (sv) { text += `     ${sf.label}\n`; text += `       1. ${sv}\n`; }
          });
        });
        text += '\n';
      } else if (ARRAY_OF_STRING_FIELDS.includes(f)) {
        const arr = getFieldValue(record, f, idx);
        if (!Array.isArray(arr) || arr.length === 0) return;
        text += `${label}\n`;
        arr.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
        text += '\n';
      } else if (BOOLEAN_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        if (val === null || val === undefined) return;
        text += `${label}\n${val ? 'Yes' : 'No'}\n\n`;
      } else if (DATE_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        text += `${label}\n${formatDate(val)}\n\n`;
      } else {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1 || (sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
          text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `${label}\n${strVal}\n\n`;
        }
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== HEADACHE ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Headache Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined) return null;
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
              <BlueSelect value={editValue === 'true' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v === 'Yes' ? 'true' : 'false')} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue === 'true'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence OR single labeled sentence: render with splitBySentence */
    if (sentences.length > 1 || (sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
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
                        const ciParsed = parseLabel(ci);
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx}>
                            {ciParsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(ciParsed.label)}</div>}
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageSentenceDraft(id2, fn, idx, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ciParsed.isLabeled ? ciParsed.value : ci)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ciParsed.isLabeled ? `${ciParsed.label}\n${ciParsed.value}` : ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id2 = safeId(record); if (!id2) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageSentenceDraft(id2, fn, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY OF STRINGS (triggers) ═══════ */
  const renderArrayOfStrings = (record, fn, idx, sid) => {
    const arr = getFieldValue(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !sectionTitleMatches(sid)) {
      const phrase = searchTerm.toLowerCase().trim();
      const labelMatch = label.toLowerCase().includes(phrase);
      const anyItemMatch = arr.some(item => String(item).toLowerCase().includes(phrase));
      if (!labelMatch && !anyItemMatch) return null;
    }

    return (
      <div key={fn}>
        {arr.map((item, ai) => {
          const itemKey = `${fn}-${idx}-item${ai}`;
          const isEditing = editingField === itemKey;
          const isModified = editedFields[itemKey];
          const itemStr = String(item || '');
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelMatch = label.toLowerCase().includes(phrase);
            if (!labelMatch && !itemStr.toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={ai} className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} style={{ marginBottom: 6 }} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(itemStr); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentArr = [...(getFieldValue(record, fn, idx) || [])]; currentArr[ai] = editValue.trim(); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const dstore = readDrafts(); if (!dstore[id2]) dstore[id2] = {}; dstore[id2][fn] = currentArr; writeDrafts(dstore); setEditedFields(prev => ({ ...prev, [itemKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY OF OBJECTS (abortiveTherapy, preventiveTherapy) as mini-cards ═══════ */
  const renderArrayOfObjects = (record, fn, idx, sid) => {
    const arr = getFieldValue(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const subFields = fn === 'abortiveTherapy' ? ABORTIVE_THERAPY_FIELDS : PREVENTIVE_THERAPY_FIELDS;

    return (
      <div key={fn}>
        <div className="nested-subtitle">{highlightText(label === fn ? (fn === 'abortiveTherapy' ? 'Abortive Therapy' : 'Preventive Therapy') : label)}</div>
        {arr.map((item, mi) => {
          if (!item || typeof item !== 'object') return null;
          const medName = item.medication || `Item ${mi + 1}`;
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const anyMatch = subFields.some(sf => {
              const sv = item[sf.key];
              return sv && String(sv).toLowerCase().includes(phrase);
            });
            if (!anyMatch && !medName.toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={mi} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(medName)}</div>
              {subFields.map(sf => {
                if (sf.key === 'medication') return null;
                const sv = item[sf.key];
                if (!sv) return null;
                const sfKey = `${fn}-${idx}-${mi}-${sf.key}`;
                const isEditing = editingField === sfKey;
                const isModified = editedFields[sfKey];
                const svStr = String(sv);
                if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
                  const phrase = searchTerm.toLowerCase().trim();
                  if (!sf.label.toLowerCase().includes(phrase) && !svStr.toLowerCase().includes(phrase) && !medName.toLowerCase().includes(phrase)) return null;
                }
                return (
                  <div key={sf.key}>
                    <div className="nested-subtitle sub-label">{highlightText(sf.label)}</div>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sfKey); setEditValue(svStr); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentArr = JSON.parse(JSON.stringify(getFieldValue(record, fn, idx) || [])); if (currentArr[mi]) currentArr[mi][sf.key] = editValue.trim(); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const dstore = readDrafts(); if (!dstore[id2]) dstore[id2] = {}; dstore[id2][fn] = currentArr; writeDrafts(dstore); setEditedFields(prev => ({ ...prev, [sfKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(svStr)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[sfKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}\n${svStr}`, sfKey); }}>{copiedItems[sfKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: OBJECT LEAF (editable scalar within an object/diary item) ═══════ */
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
                <BlueSelect value={editValue === 'yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v === 'Yes' ? 'yes' : 'no')} />
              ) : (ratio || nu) ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String(Math.round(((isNaN(cur) ? 0 : cur) - 1) * 1e6) / 1e6)); }}>−</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String(Math.round(((isNaN(cur) ? 0 : cur) + 1) * 1e6) / 1e6)); }}>+</button>
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
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: OBJECT FIELD (results) ═══════ */
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

  /* ═══════ RENDER: GENERIC ARRAY OF OBJECTS (headacheDiary) — recursive leaves ═══════ */
  const renderGenericObjectArray = (record, fn, idx, sid) => {
    const arr = getFieldValue(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const labelMatch = label.toLowerCase().includes(phrase);
      const anyMatch = arr.some(item => item && typeof item === 'object' && Object.values(item).some(v => v != null && fmtScalar(v).toLowerCase().includes(phrase)));
      if (!labelMatch && !anyMatch) return null;
    }
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, mi) => {
          if (isEmptyDeep(item)) return null;
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const itemMatch = item && typeof item === 'object' && Object.values(item).some(v => v != null && fmtScalar(v).toLowerCase().includes(phrase));
            if (!itemMatch && !label.toLowerCase().includes(phrase)) return null;
          }
          if (isScalar(item)) {
            return <div key={mi} className="nested-mini-card">{renderObjectLeaf(record, fn, [mi], idx, sid, item)}</div>;
          }
          const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
          if (entries.length === 0) return null;
          return (
            <div key={mi} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(`Entry ${mi + 1}`)}</div>
              {entries.map(([k, v]) => (
                isScalar(v) ? renderObjectLeaf(record, fn, [mi, k], idx, sid, v)
                  : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [mi, k], 1)}</div>
              ))}
            </div>
          );
        })}
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
                              setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: newArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const dstore = readDrafts(); if (!dstore[id2]) dstore[id2] = {}; dstore[id2][fn] = newArr; writeDrafts(dstore); setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); setSaveError(null);
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
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      if (ARRAY_OF_OBJECT_FIELDS.includes(f) || ARRAY_OF_STRING_FIELDS.includes(f) || RECOMMENDATIONS_FIELDS.includes(f)) {
        const arr = getFieldValue(record, f, idx);
        return Array.isArray(arr) && arr.some(x => !isEmptyDeep(x));
      }
      if (OBJECT_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        return val && typeof val === 'object' && !isEmptyDeep(val);
      }
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
            if (ARRAY_OF_STRING_FIELDS.includes(f)) return renderArrayOfStrings(record, f, idx, sid);
            if (f === 'headacheDiary') return renderGenericObjectArray(record, f, idx, sid);
            if (ARRAY_OF_OBJECT_FIELDS.includes(f)) return renderArrayOfObjects(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (RECOMMENDATIONS_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="headache-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Headache Assessment</h2></div>
        <div className="empty-state">No headache assessment records available</div>
      </div>
    );
  }

  return (
    <div className="headache-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Headache Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<HeadacheAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Headache_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search headache assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Headache Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'headache-profile')}
            {renderSection(record, idx, 'triggers')}
            {renderSection(record, idx, 'associated-symptoms')}
            {renderSection(record, idx, 'therapies')}
            {renderSection(record, idx, 'diary')}
            {renderSection(record, idx, 'scoring')}
            {renderSection(record, idx, 'clinical-findings')}
            {renderSection(record, idx, 'results-recs')}
            {renderSection(record, idx, 'clinical-notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeadacheAssessmentDocument;
