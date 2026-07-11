/**
 * TrendingAnalysisDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: trending_analysis
 *
 * 5 Sections:
 *   1. lab-trends: labTrends[] -> test, trend, latestValue, targetValue, interpretation, actionNeeded, reassessmentTimeline, priority
 *   2. vital-signs-trends: vitalSignsTrends[] -> parameter, trend, latestValue, monitoringThreshold, interpretation, clinicalSignificance, actionNeeded, reassessmentTimeline, priority
 *   3. disease-trajectory: diseaseProgression.trajectory, diseaseProgression.timeline
 *   4. key-events: diseaseProgression.keyEvents[] -> date, event, impact
 *   5. prognosis: diseaseProgression.prognosis
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TrendingAnalysisPDFTemplate from '../pdf-templates/TrendingAnalysisTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './TrendingAnalysisDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the full dotted field path) */
const DRAFT_KEY = 'trending_analysisPendingEdits';
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
  'document-details': 'Document Details',
  'lab-trends': 'Laboratory Trends',
  'vital-signs-trends': 'Vital Signs Trends',
  'disease-trajectory': 'Disease Trajectory',
  'key-events': 'Key Events',
  'prognosis': 'Prognosis',
  'clinical-summary': 'Clinical Summary',
};

const FIELD_LABELS = {
  /* lab-trends item fields */
  test: 'Test',
  /* vital-signs-trends item fields */
  parameter: 'Parameter',
  /* shared item fields */
  trend: 'Trend',
  latestValue: 'Latest Value',
  targetValue: 'Target Value',
  monitoringThreshold: 'Monitoring Threshold',
  interpretation: 'Interpretation',
  clinicalSignificance: 'Clinical Significance',
  actionNeeded: 'Action Needed',
  reassessmentTimeline: 'Reassessment Timeline',
  priority: 'Priority',
  /* disease-trajectory fields */
  'diseaseProgression.trajectory': 'Overall Trajectory',
  'diseaseProgression.timeline': 'Timeline',
  /* key-events item fields */
  date: 'Date',
  event: 'Event',
  impact: 'Impact',
  /* prognosis */
  'diseaseProgression.prognosis': 'Prognosis',
  /* document-level fields */
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
  status: 'Status',
};

/* Document-level field-type buckets */
const DOC_STRING_FIELDS = ['type', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
const DOC_DATE_FIELDS = ['date'];
const DOC_ARRAY_FIELDS = ['recommendations'];
const DOC_OBJECT_FIELDS = ['results'];

const SECTION_FIELDS = {
  'document-details': ['date', 'type', 'provider', 'facility', 'status'],
  'lab-trends': ['labTrends'],
  'vital-signs-trends': ['vitalSignsTrends'],
  'disease-trajectory': ['diseaseProgression.trajectory', 'diseaseProgression.timeline'],
  'key-events': ['diseaseProgression.keyEvents'],
  'prognosis': ['diseaseProgression.prognosis'],
  'clinical-summary': ['findings', 'assessment', 'plan', 'recommendations', 'results', 'notes'],
};

const LAB_ITEM_FIELDS = ['test', 'trend', 'latestValue', 'targetValue', 'interpretation', 'actionNeeded', 'reassessmentTimeline', 'priority'];
const VITAL_ITEM_FIELDS = ['parameter', 'trend', 'latestValue', 'monitoringThreshold', 'interpretation', 'clinicalSignificance', 'actionNeeded', 'reassessmentTimeline', 'priority'];
const EVENT_ITEM_FIELDS = ['date', 'event', 'impact'];

const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['test', 'parameter', 'trend', 'latestValue', 'targetValue', 'monitoringThreshold', 'interpretation', 'clinicalSignificance', 'actionNeeded', 'reassessmentTimeline', 'priority', 'event', 'impact', 'diseaseProgression.trajectory', 'diseaseProgression.timeline', 'diseaseProgression.prognosis'];

/* SENTENCE_FIELDS: NARRATIVE TEXT fields that use per-sentence editing (Rule #68).
 * Each may hold multiple sentences. Identified by trailing field name (matches both
 * doc-level keys e.g. 'findings' and array-item / dot-path keys e.g. 'labTrends.0.interpretation'
 * or 'diseaseProgression.prognosis' via their leaf segment). SHORT/SIMPLE fields
 * (status, type, provider, facility, date, test, parameter, trend, priority, reassessmentTimeline,
 * monitoringThreshold, latestValue, targetValue) stay on the simple editable path. */
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes', 'interpretation', 'clinicalSignificance', 'actionNeeded', 'event', 'impact', 'trajectory', 'timeline', 'prognosis'];

/* isSentenceField: does the leaf segment of a field path belong to SENTENCE_FIELDS? */
const isSentenceField = (fieldPath) => {
  if (!fieldPath || typeof fieldPath !== 'string') return false;
  const leaf = fieldPath.split('.').pop();
  return SENTENCE_FIELDS.includes(leaf);
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
const TrendingAnalysisDocument = ({ document: docProp }) => {
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
      if (r?.trending_analysis) return Array.isArray(r.trending_analysis) ? r.trending_analysis : [r.trending_analysis];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.trending_analysis) return Array.isArray(dd.trending_analysis) ? dd.trending_analysis : [dd.trending_analysis]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
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

  /* getFieldValue: supports dot-path for diseaseProgression fields */
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

  /* ═══════ SORT BY PRIORITY ═══════ */
  const sortByPriority = useCallback((items) => {
    if (!items || !Array.isArray(items)) return [];
    const priorityOrder = { urgent: 1, critical: 1, immediate: 1, high: 2, important: 2, moderate: 3, medium: 3, monitor: 3, watch: 3, routine: 4, normal: 4, low: 5 };
    return [...items].sort((a, b) => {
      const aPriority = a.priority ? (priorityOrder[a.priority.toLowerCase()] || 999) : 999;
      const bPriority = b.priority ? (priorityOrder[b.priority.toLowerCase()] || 999) : 999;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aName = (a.test || a.parameter || '').toLowerCase();
      const bName = (b.test || b.parameter || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }, []);

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    /* Check field labels and values */
    if (sid === 'lab-trends') {
      const labs = record.labTrends || [];
      for (const lab of labs) {
        for (const f of LAB_ITEM_FIELDS) {
          const label = (FIELD_LABELS[f] || f).toLowerCase();
          if (label.includes(phrase) || phrase.includes(label)) return true;
          const v = lab[f]; if (v && String(v).toLowerCase().includes(phrase)) return true;
        }
      }
    } else if (sid === 'vital-signs-trends') {
      const vitals = record.vitalSignsTrends || [];
      for (const vital of vitals) {
        for (const f of VITAL_ITEM_FIELDS) {
          const label = (FIELD_LABELS[f] || f).toLowerCase();
          if (label.includes(phrase) || phrase.includes(label)) return true;
          const v = vital[f]; if (v && String(v).toLowerCase().includes(phrase)) return true;
        }
      }
    } else if (sid === 'disease-trajectory') {
      const dp = record.diseaseProgression;
      if (dp?.trajectory && String(dp.trajectory).toLowerCase().includes(phrase)) return true;
      if (dp?.timeline && String(dp.timeline).toLowerCase().includes(phrase)) return true;
      for (const f of ['diseaseProgression.trajectory', 'diseaseProgression.timeline']) {
        const label = (FIELD_LABELS[f] || '').toLowerCase();
        if (label.includes(phrase) || phrase.includes(label)) return true;
      }
    } else if (sid === 'key-events') {
      const events = record.diseaseProgression?.keyEvents || [];
      for (const ev of events) {
        for (const f of EVENT_ITEM_FIELDS) {
          const label = (FIELD_LABELS[f] || f).toLowerCase();
          if (label.includes(phrase) || phrase.includes(label)) return true;
          const v = ev[f]; if (v && String(v).toLowerCase().includes(phrase)) return true;
        }
      }
    } else if (sid === 'prognosis') {
      const dp = record.diseaseProgression;
      if (dp?.prognosis && String(dp.prognosis).toLowerCase().includes(phrase)) return true;
      const label = (FIELD_LABELS['diseaseProgression.prognosis'] || '').toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
    } else if (sid === 'document-details' || sid === 'clinical-summary') {
      const fields = SECTION_FIELDS[sid] || [];
      for (const f of fields) {
        const label = (FIELD_LABELS[f] || f).toLowerCase();
        if (label.includes(phrase) || phrase.includes(label)) return true;
        const v = record[f];
        if (v && JSON.stringify(v).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm]);

  const fieldMatches = useCallback((val, fn) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    if (val !== null && val !== undefined) return fmtVal(val).toLowerCase().includes(phrase);
    return false;
  }, [searchTerm, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Trending Analysis ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      /* Check lab values */
      const labs = record.labTrends || [];
      for (const lab of labs) { for (const f of LAB_ITEM_FIELDS) { const v = lab[f]; if (v && String(v).toLowerCase().includes(phrase)) return true; } }
      /* Check vital values */
      const vitals = record.vitalSignsTrends || [];
      for (const vital of vitals) { for (const f of VITAL_ITEM_FIELDS) { const v = vital[f]; if (v && String(v).toLowerCase().includes(phrase)) return true; } }
      /* Check disease progression */
      const dp = record.diseaseProgression;
      if (dp) {
        if (dp.trajectory && String(dp.trajectory).toLowerCase().includes(phrase)) return true;
        if (dp.timeline && String(dp.timeline).toLowerCase().includes(phrase)) return true;
        if (dp.prognosis && String(dp.prognosis).toLowerCase().includes(phrase)) return true;
        const events = dp.keyEvents || [];
        for (const ev of events) { for (const f of EVENT_ITEM_FIELDS) { const v = ev[f]; if (v && String(v).toLowerCase().includes(phrase)) return true; } }
      }
      /* Check document-level fields */
      for (const f of [...SECTION_FIELDS['document-details'], ...SECTION_FIELDS['clinical-summary']]) {
        const v = record[f];
        if (v && JSON.stringify(v).toLowerCase().includes(phrase)) return true;
      }
      return false;
    });
  }, [records, searchTerm]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          if (fieldPath.includes('.')) {
            /* Dot-path: e.g. diseaseProgression.trajectory */
            const parts = fieldPath.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]]) merged[parts[0]] = {};
              merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[key] };
            }
          } else if (fieldPath.startsWith('labTrends.') || fieldPath.startsWith('vitalSignsTrends.') || fieldPath.startsWith('diseaseProgression.keyEvents.')) {
            /* Array item field: e.g. labTrends.0.interpretation */
            const pp = fieldPath.split('.');
            const arrName = pp[0];
            const arrIdx = parseInt(pp[1]);
            const itemField = pp[2];
            if (!merged[arrName]) merged[arrName] = [];
            merged[arrName] = [...merged[arrName]];
            if (merged[arrName][arrIdx]) {
              merged[arrName][arrIdx] = { ...merged[arrName][arrIdx], [itemField]: localEdits[key] };
            }
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // stageDraft = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives
  // refresh). NOT written to MongoDB and NOT shown in the PDF until Approve commits it.
  const stageDraft = useCallback((record, fn, idx, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }, [safeId]);

  // Re-edit after approval → drop the section-level 'approved' flag so the button returns to yellow.
  const clearApprovedForField = useCallback((idx, fn) => {
    setApprovedSections(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [sid, fields] of Object.entries(SECTION_FIELDS)) {
        const belongs = fields.some(f => fn === f || fn.startsWith(`${f}.`));
        const key = `${sid}-${idx}`;
        if (belongs && next[key]) { delete next[key]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, []);

  // Save = stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    clearApprovedForField(idx, fn);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft, clearApprovedForField]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      clearApprovedForField(idx, fn);
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
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
    clearApprovedForField(idx, fn);
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const allKeys = [...Object.keys(editedFields), ...Object.keys(editedSentences)];
    if (sid === 'lab-trends') {
      return allKeys.some(k => k.startsWith('labTrends.') && k.endsWith(`-${idx}`));
    } else if (sid === 'vital-signs-trends') {
      return allKeys.some(k => k.startsWith('vitalSignsTrends.') && k.endsWith(`-${idx}`));
    } else if (sid === 'disease-trajectory') {
      return allKeys.some(k => (k.startsWith('diseaseProgression.trajectory-') || k.startsWith('diseaseProgression.timeline-')) && k.endsWith(`-${idx}`));
    } else if (sid === 'key-events') {
      return allKeys.some(k => k.startsWith('diseaseProgression.keyEvents.') && k.endsWith(`-${idx}`));
    } else if (sid === 'prognosis') {
      return allKeys.some(k => k.startsWith('diseaseProgression.prognosis-') && k.endsWith(`-${idx}`));
    } else if (sid === 'document-details' || sid === 'clinical-summary') {
      const fields = SECTION_FIELDS[sid] || [];
      return allKeys.some(k => fields.some(f => k.startsWith(`${f}-`) || k.startsWith(`${f}.`)) && k.endsWith(`-${idx}`));
    }
    return false;
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      // Which field paths belong to this section?
      const belongsToSection = (fieldPart) => {
        if (sid === 'lab-trends') return fieldPart.startsWith('labTrends.');
        if (sid === 'vital-signs-trends') return fieldPart.startsWith('vitalSignsTrends.');
        if (sid === 'disease-trajectory') return fieldPart === 'diseaseProgression.trajectory' || fieldPart === 'diseaseProgression.timeline';
        if (sid === 'key-events') return fieldPart.startsWith('diseaseProgression.keyEvents.');
        if (sid === 'prognosis') return fieldPart === 'diseaseProgression.prognosis';
        if (sid === 'document-details' || sid === 'clinical-summary') {
          const fields = SECTION_FIELDS[sid] || [];
          return fields.some(f => fieldPart === f || fieldPart.startsWith(`${f}.`));
        }
        return false;
      };
      // Commit each staged (pending) edit for this record's section. editKey = `${fieldPart}-${idx}`.
      // The stored field path is the full dotted path; the backend resolves dot-paths itself (NO arrayIndex).
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && belongsToSection(k.slice(0, -suffix.length)));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const resp = await secureApiClient.put(`/api/edit/trending_analysis/${id}/edit`, { field: fieldPart, value: localEdits[editKey] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/trending_analysis/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      if (toCommit.length > 0) {
        const store = readDrafts();
        if (store[id]) { toCommit.forEach(k => { delete store[id][k.slice(0, -suffix.length)]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      /* Clear edited markers for this section */
      const sectionFieldPrefixes = (sid === 'document-details' || sid === 'clinical-summary')
        ? (SECTION_FIELDS[sid] || []).flatMap(f => [`${f}-`, `${f}.`])
        : null;
      const clearPrefix = sid === 'lab-trends' ? 'labTrends.' : sid === 'vital-signs-trends' ? 'vitalSignsTrends.' : sid === 'disease-trajectory' ? 'diseaseProgression.tra' : sid === 'key-events' ? 'diseaseProgression.keyEvents.' : sid === 'prognosis' ? 'diseaseProgression.prognosis' : null;
      const matchesSection = (k) => sectionFieldPrefixes ? sectionFieldPrefixes.some(p => k.startsWith(p)) : (clearPrefix && k.startsWith(clearPrefix));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (matchesSection(k) && k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (matchesSection(k) && k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
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

  const buildLabCopyText = useCallback((record, idx) => {
    let text = 'Laboratory Trends\n' + '='.repeat(40) + '\n\n';
    const labs = sortByPriority(record.labTrends || []);
    labs.forEach((lab, i) => {
      text += `${i + 1}. ${lab.test || 'Test'}\n`;
      if (lab.priority) text += `   Priority: ${lab.priority}\n`;
      if (lab.trend) text += `   Trend: ${lab.trend}\n`;
      if (lab.latestValue) text += `   Latest Value: ${lab.latestValue}\n`;
      if (lab.targetValue) text += `   Target: ${lab.targetValue}\n`;
      if (lab.interpretation) text += `   Interpretation: ${lab.interpretation}\n`;
      if (lab.actionNeeded) text += `   Action Needed: ${lab.actionNeeded}\n`;
      if (lab.reassessmentTimeline) text += `   Reassess: ${lab.reassessmentTimeline}\n`;
      text += '\n';
    });
    return text;
  }, [sortByPriority]);

  const buildVitalsCopyText = useCallback((record, idx) => {
    let text = 'Vital Signs Trends\n' + '='.repeat(40) + '\n\n';
    const vitals = sortByPriority(record.vitalSignsTrends || []);
    vitals.forEach((vital, i) => {
      text += `${i + 1}. ${vital.parameter || 'Parameter'}\n`;
      if (vital.priority) text += `   Priority: ${vital.priority}\n`;
      if (vital.trend) text += `   Trend: ${vital.trend}\n`;
      if (vital.latestValue) text += `   Latest Value: ${vital.latestValue}\n`;
      if (vital.monitoringThreshold) text += `   Monitoring Threshold: ${vital.monitoringThreshold}\n`;
      if (vital.interpretation) text += `   Interpretation: ${vital.interpretation}\n`;
      if (vital.clinicalSignificance) text += `   Clinical Significance: ${vital.clinicalSignificance}\n`;
      if (vital.actionNeeded) text += `   Action Needed: ${vital.actionNeeded}\n`;
      if (vital.reassessmentTimeline) text += `   Reassess: ${vital.reassessmentTimeline}\n`;
      text += '\n';
    });
    return text;
  }, [sortByPriority]);

  const buildTrajectoryCopyText = useCallback((record) => {
    let text = 'Disease Trajectory\n' + '='.repeat(40) + '\n\n';
    const dp = record.diseaseProgression || {};
    if (dp.trajectory) text += `Overall Trajectory:\n${dp.trajectory}\n\n`;
    if (dp.timeline) text += `Timeline:\n${dp.timeline}\n\n`;
    return text;
  }, []);

  const buildEventsCopyText = useCallback((record) => {
    let text = 'Key Events\n' + '='.repeat(40) + '\n\n';
    const events = (record.diseaseProgression?.keyEvents || []).slice().sort((a, b) => {
      const dA = new Date(a.date); const dB = new Date(b.date);
      if (isNaN(dA.getTime())) return 1; if (isNaN(dB.getTime())) return -1;
      return dA - dB;
    });
    events.forEach((ev, i) => {
      text += `${i + 1}. ${formatDate(ev.date)}\n`;
      if (ev.event) text += `   Event: ${ev.event}\n`;
      if (ev.impact) text += `   Impact: ${ev.impact}\n`;
      text += '\n';
    });
    return text;
  }, []);

  const buildPrognosisCopyText = useCallback((record) => {
    let text = 'Prognosis\n' + '='.repeat(40) + '\n\n';
    const dp = record.diseaseProgression || {};
    if (dp.prognosis) {
      const sentences = splitBySentence(dp.prognosis);
      if (sentences.length > 1) {
        formatSentenceFieldLines(dp.prognosis).forEach(l => { text += `${l}\n`; });
      } else {
        text += dp.prognosis + '\n';
      }
    }
    return text;
  }, [splitBySentence, formatSentenceFieldLines]);

  const buildDocSectionCopyText = useCallback((record, idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    let text = `${SECTION_TITLES[sid]}\n` + '='.repeat(40) + '\n\n';
    fields.forEach(f => {
      const v = getFieldValue(record, f, idx);
      if (!hasVal(v)) return;
      const label = FIELD_LABELS[f] || f;
      if (DOC_DATE_FIELDS.includes(f)) { text += `${label}: ${formatDate(v)}\n`; }
      else if (Array.isArray(v)) { text += `${label}: ${v.map(it => fmtVal(it)).join(', ')}\n`; }
      else if (typeof v === 'object') {
        text += `${label}:\n`;
        Object.entries(v).filter(([, vv]) => hasVal(vv)).forEach(([k, vv]) => { text += `  ${humanizeKey(k)}: ${isScalarVal(vv) ? fmtVal(vv) : JSON.stringify(vv)}\n`; });
      }
      else { text += `${label}: ${fmtVal(v)}\n`; }
    });
    return text + '\n';
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== TRENDING ANALYSIS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Trending Analysis ${idx + 1}\n${'='.repeat(40)}\n\n`;
      text += buildDocSectionCopyText(r, idx, 'document-details');
      if (r.labTrends?.length) text += buildLabCopyText(r, idx);
      if (r.vitalSignsTrends?.length) text += buildVitalsCopyText(r, idx);
      if (r.diseaseProgression) {
        if (r.diseaseProgression.trajectory || r.diseaseProgression.timeline) text += buildTrajectoryCopyText(r);
        if (r.diseaseProgression.keyEvents?.length) text += buildEventsCopyText(r);
        if (r.diseaseProgression.prognosis) text += buildPrognosisCopyText(r);
      }
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildLabCopyText, buildVitalsCopyText, buildTrajectoryCopyText, buildEventsCopyText, buildPrognosisCopyText]);

  /* ═══════ TREND / PRIORITY BADGES ═══════ */
  const renderTrendBadge = useCallback((trend) => {
    if (!trend) return null;
    const tl = String(trend).toLowerCase();
    let cls = '';
    let arrow = '';
    if (tl.includes('improv') || tl.includes('better')) { cls = 'trend-improving'; arrow = '\u2197'; }
    else if (tl.includes('increas') || tl.includes('rising') || tl.includes('elevat') || tl === 'up') { cls = 'trend-up'; arrow = '\u2191'; }
    else if (tl.includes('decreas') || tl.includes('declining') || tl.includes('down') || tl.includes('lower')) { cls = 'trend-down'; arrow = '\u2193'; }
    else if (tl.includes('stable') || tl.includes('steady') || tl.includes('unchanged')) { cls = 'trend-stable'; arrow = '\u2192'; }
    return <span className={`trend-badge ${cls}`}>{arrow} {trend}</span>;
  }, []);

  const renderPriorityTag = useCallback((priority) => {
    if (!priority) return null;
    const pl = String(priority).toLowerCase();
    let cls = '';
    if (pl === 'urgent' || pl === 'critical' || pl === 'immediate' || pl === 'high') cls = 'priority-urgent';
    else if (pl === 'routine' || pl === 'normal' || pl === 'low') cls = 'priority-routine';
    else if (pl === 'monitor' || pl === 'watch' || pl === 'moderate' || pl === 'medium') cls = 'priority-monitor';
    return <span className={`priority-tag ${cls}`}>{priority}</span>;
  }, []);

  /* ═══════ RENDER: DATE FIELD (for key-events date) ═══════ */
  const renderDateField = (record, fn, editKeyPrefix, idx, sid) => {
    const val = typeof fn === 'string' ? fn : '';
    if (!hasVal(val)) return null;
    const editKey = `${editKeyPrefix}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS['date'] || 'Date';
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];

    return (
      <div key={editKeyPrefix} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, editKeyPrefix.replace(/-\d+$/, ''), idx, sid, null, editValue + 'T00:00:00.000Z', editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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
  const renderStringField = (record, fn, editKeyPrefix, idx, sid, label) => {
    const val = typeof fn === 'string' && fn.includes('.') ? getFieldValue(record, fn, idx) : fn;
    const actualFieldPath = editKeyPrefix.replace(/-\d+$/, '');
    /* If fn is a raw value (not a path), use it directly */
    const rawVal = (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') ? val : getFieldValue(record, fn, idx);
    if (!hasVal(rawVal)) return null;
    const strVal = fmtVal(rawVal);
    const sentences = splitBySentence(strVal);
    const editKey = `${editKeyPrefix}-${idx}`;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={editKeyPrefix}>
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${editKeyPrefix}-${idx}-s${sIdx}`;
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, actualFieldPath, idx) || rawVal || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, actualFieldPath, idx, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${editKeyPrefix}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); clearApprovedForField(idx, actualFieldPath); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, actualFieldPath, idx) || rawVal || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, actualFieldPath, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${editKeyPrefix}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); clearApprovedForField(idx, actualFieldPath); setEditingField(null); setEditValue(''); } else { saveSentence(record, actualFieldPath, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={editKeyPrefix} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, actualFieldPath, idx, sid, null, undefined, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SENTENCE-EDITABLE FIELD (Rule #68) ═══════
   * Per-sentence text editing for NARRATIVE TEXT fields (findings, assessment, plan,
   * notes, interpretation, clinicalSignificance, actionNeeded, event, impact,
   * trajectory, timeline, prognosis). Each sentence is its own editable row, NO
   * numbering, label appears only on the first row (sIdx===0), single-value fallback
   * to a plain editable row when there is one sentence. Cloned from the authoritative
   * reference PastMedicalHistoryDocument.jsx -> renderSentenceEditableField.
   * Delegates to renderStringField, which implements exactly this structure
   * (splitBySentence rows + parseLabel/comma sub-rows + single-value fallback). */
  const renderSentenceEditableField = (record, fn, editKeyPrefix, idx, sid, label) =>
    renderStringField(record, fn, editKeyPrefix, idx, sid, label);

  /* ═══════ RENDER: DOC-LEVEL DATE FIELD (date) ═══════ */
  const renderDocDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z', editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: DOC-LEVEL ARRAY FIELD (recommendations) ═══════ */
  const renderDocArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const items = Array.isArray(val) ? val : [val];
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(items.map(it => fmtVal(it)).join(', ')); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus placeholder="Comma-separated values" onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const arrVal = editValue.split(',').map(s => s.trim()).filter(s => s); handleSaveField(record, fn, idx, sid, null, arrVal, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content">
                <div className="array-tags">{items.map((item, i) => <span key={i} className="array-tag">{highlightText(fmtVal(item))}</span>)}</div>
                <span className="edit-indicator">&#9998;</span>
              </div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${items.map(it => fmtVal(it)).join(', ')}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (recursive object support for results) ═══════ */
  const isScalarVal = (v) => v === null || v === undefined || typeof v !== 'object';
  const humanizeKey = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const isNum = typeof value === 'number';
    const leafLabel = humanizeKey(path[path.length - 1]);
    const displayVal = fmtVal(value);
    if (isNum && value === 0) return null; /* hide-zero */
    const editStartValue = isBool ? (value ? 'yes' : 'no') : isNum ? String(value) : displayVal;
    const fullPath = `${rootField}.${path.join('.')}`;

    return (
      <div key={path[path.length - 1]} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(leafLabel)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : isNum ? (
                <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) { newVal = editValue === 'yes'; }
                  else if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = n; }
                  else { newVal = editValue.trim(); }
                  handleSaveField(record, fullPath, idx, sid, null, newVal, leafKey);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${leafLabel}\n${displayVal}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (!hasVal(value)) return null;
    if (isScalarVal(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className="nested-subtitle sub-label">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalarVal(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
            : <div className="rec-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
        ))}
      </React.Fragment>
    );
  };

  /* ═══════ RENDER: DOC-LEVEL OBJECT FIELD (results) ═══════ */
  const renderDocObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || isScalarVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const entries = Object.entries(val).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {entries.map(([k, v]) => (
          isScalarVal(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="rec-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: DOCUMENT DETAILS SECTION ═══════ */
  const renderDocumentDetailsSection = (record, idx) => {
    const sid = 'document-details';
    const fields = SECTION_FIELDS[sid];
    const hasAny = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAny) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildDocSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DOC_DATE_FIELDS.includes(f)) return renderDocDateField(record, f, idx, sid);
            return renderStringField(record, getFieldValue(record, f, idx), f, idx, sid, FIELD_LABELS[f] || f);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: CLINICAL SUMMARY SECTION ═══════ */
  const renderClinicalSummarySection = (record, idx) => {
    const sid = 'clinical-summary';
    const fields = SECTION_FIELDS[sid];
    const hasAny = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAny) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildDocSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DOC_ARRAY_FIELDS.includes(f)) return renderDocArrayField(record, f, idx, sid);
            if (DOC_OBJECT_FIELDS.includes(f)) return renderDocObjectField(record, f, idx, sid);
            const renderer = isSentenceField(f) ? renderSentenceEditableField : renderStringField;
            return renderer(record, getFieldValue(record, f, idx), f, idx, sid, FIELD_LABELS[f] || f);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: LAB TRENDS SECTION ═══════ */
  const renderLabTrendsSection = (record, idx) => {
    const sid = 'lab-trends';
    const labs = record.labTrends || [];
    if (!labs.length) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;
    const sorted = sortByPriority(labs);

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildLabCopyText(record, idx), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {sorted.map((lab, labIdx) => {
            const origIdx = labs.indexOf(lab);
            const nameVal = lab.test || lab.parameter || `Lab ${labIdx + 1}`;
            if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              let itemMatch = false;
              for (const f of LAB_ITEM_FIELDS) {
                if (fieldMatches(lab[f], f)) { itemMatch = true; break; }
              }
              if (!itemMatch) return null;
            }
            return (
              <div key={labIdx} className="rec-mini-card" style={{ marginBottom: 12 }}>
                <div className="item-header">
                  <span className="item-name">{highlightText(nameVal)}</span>
                  <div className="item-badges">
                    {renderTrendBadge(lab.trend)}
                    {renderPriorityTag(lab.priority)}
                  </div>
                </div>
                {LAB_ITEM_FIELDS.filter(f => f !== 'test' && f !== 'trend' && f !== 'priority').map(f => {
                  const v = lab[f];
                  if (!hasVal(v)) return null;
                  const editKeyPrefix = `labTrends.${origIdx}.${f}`;
                  const renderer = isSentenceField(f) ? renderSentenceEditableField : renderStringField;
                  return renderer(record, v, editKeyPrefix, idx, sid, FIELD_LABELS[f] || f);
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: VITAL SIGNS TRENDS SECTION ═══════ */
  const renderVitalSignsSection = (record, idx) => {
    const sid = 'vital-signs-trends';
    const vitals = record.vitalSignsTrends || [];
    if (!vitals.length) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;
    const sorted = sortByPriority(vitals);

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildVitalsCopyText(record, idx), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {sorted.map((vital, vitalIdx) => {
            const origIdx = vitals.indexOf(vital);
            const nameVal = vital.parameter || `Vital ${vitalIdx + 1}`;
            if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              let itemMatch = false;
              for (const f of VITAL_ITEM_FIELDS) {
                if (fieldMatches(vital[f], f)) { itemMatch = true; break; }
              }
              if (!itemMatch) return null;
            }
            return (
              <div key={vitalIdx} className="rec-mini-card" style={{ marginBottom: 12 }}>
                <div className="item-header">
                  <span className="item-name">{highlightText(nameVal)}</span>
                  <div className="item-badges">
                    {renderTrendBadge(vital.trend)}
                    {renderPriorityTag(vital.priority)}
                  </div>
                </div>
                {VITAL_ITEM_FIELDS.filter(f => f !== 'parameter' && f !== 'trend' && f !== 'priority').map(f => {
                  const v = vital[f];
                  if (!hasVal(v)) return null;
                  const editKeyPrefix = `vitalSignsTrends.${origIdx}.${f}`;
                  const renderer = isSentenceField(f) ? renderSentenceEditableField : renderStringField;
                  return renderer(record, v, editKeyPrefix, idx, sid, FIELD_LABELS[f] || f);
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: DISEASE TRAJECTORY SECTION ═══════ */
  const renderDiseaseTrajectorySection = (record, idx) => {
    const sid = 'disease-trajectory';
    const dp = record.diseaseProgression;
    if (!dp || (!dp.trajectory && !dp.timeline)) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildTrajectoryCopyText(record), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {hasVal(dp.trajectory) && renderSentenceEditableField(record, getFieldValue(record, 'diseaseProgression.trajectory', idx) || dp.trajectory, 'diseaseProgression.trajectory', idx, sid, FIELD_LABELS['diseaseProgression.trajectory'])}
          {hasVal(dp.timeline) && renderSentenceEditableField(record, getFieldValue(record, 'diseaseProgression.timeline', idx) || dp.timeline, 'diseaseProgression.timeline', idx, sid, FIELD_LABELS['diseaseProgression.timeline'])}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: KEY EVENTS SECTION ═══════ */
  const renderKeyEventsSection = (record, idx) => {
    const sid = 'key-events';
    const events = record.diseaseProgression?.keyEvents || [];
    if (!events.length) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;
    const sorted = [...events].sort((a, b) => {
      const dA = new Date(a.date); const dB = new Date(b.date);
      if (isNaN(dA.getTime())) return 1; if (isNaN(dB.getTime())) return -1;
      return dA - dB;
    });

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildEventsCopyText(record), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {sorted.map((ev, evIdx) => {
            const origIdx = events.indexOf(ev);
            if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              let itemMatch = false;
              for (const f of EVENT_ITEM_FIELDS) {
                if (fieldMatches(ev[f], f)) { itemMatch = true; break; }
              }
              if (!itemMatch) return null;
            }
            return (
              <div key={evIdx} className="rec-mini-card" style={{ marginBottom: 12 }}>
                <div className="item-header">
                  <span className="item-name">{highlightText(formatDate(ev.date) || `Event ${evIdx + 1}`)}</span>
                </div>
                {hasVal(ev.date) && renderDateField(record, ev.date, `diseaseProgression.keyEvents.${origIdx}.date`, idx, sid)}
                {hasVal(ev.event) && renderSentenceEditableField(record, ev.event, `diseaseProgression.keyEvents.${origIdx}.event`, idx, sid, FIELD_LABELS['event'])}
                {hasVal(ev.impact) && renderSentenceEditableField(record, ev.impact, `diseaseProgression.keyEvents.${origIdx}.impact`, idx, sid, FIELD_LABELS['impact'])}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: PROGNOSIS SECTION ═══════ */
  const renderPrognosisSection = (record, idx) => {
    const sid = 'prognosis';
    const dp = record.diseaseProgression;
    if (!dp?.prognosis) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildPrognosisCopyText(record), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {renderSentenceEditableField(record, getFieldValue(record, 'diseaseProgression.prognosis', idx) || dp.prognosis, 'diseaseProgression.prognosis', idx, sid, FIELD_LABELS['diseaseProgression.prognosis'])}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="trending-analysis-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Trending Analysis</h2></div>
        <div className="empty-state">No trending analysis records available</div>
      </div>
    );
  }

  return (
    <div className="trending-analysis-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Trending Analysis</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<TrendingAnalysisPDFTemplate document={pdfData} />} fileName={`trending-analysis-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search trending analysis..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      {saveError && <div className="save-error" style={{ marginBottom: 12 }}>{saveError}</div>}
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.documentDate || record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.documentDate || record.date)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(record.patientName || `Trending Analysis ${idx + 1}`)}</h3>
            </div>
            {renderDocumentDetailsSection(record, idx)}
            {renderLabTrendsSection(record, idx)}
            {renderVitalSignsSection(record, idx)}
            {renderDiseaseTrajectorySection(record, idx)}
            {renderKeyEventsSection(record, idx)}
            {renderPrognosisSection(record, idx)}
            {renderClinicalSummarySection(record, idx)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrendingAnalysisDocument;
