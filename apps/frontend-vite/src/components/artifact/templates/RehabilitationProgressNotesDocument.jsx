/**
 * RehabilitationProgressNotesDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: rehabilitation_progress_notes
 *
 * 8 Sections:
 *   1. record-info: createdAt (display only)
 *   2. assessment-scores: functionalIndependenceMeasure, barthel, rankinScale, cognitiveAssessment, berghBalance, painScale
 *   3. mobility-testing: gaitSpeed, sixMinuteWalkTest, timedUpAndGo, functionalReach, ashworthScale
 *   4. muscle-rom: rangeOfMotion, muscleStrengthTesting
 *   5. therapy-progress: swallowingAssessment, speechTherapyProgress, therapyParticipation
 *   6. goals-interventions: occupationalTherapyGoals, physicalTherapyInterventions
 *   7. devices-comorbidities: assistiveDevices, comorbidityImpact
 *   8. discharge: dischargeDisposition, rehabilitationPotential, medicationCompliance
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueSelect from '../components/BlueSelect';
import RehabilitationProgressNotesDocumentPDFTemplate from '../pdf-templates/RehabilitationProgressNotesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RehabilitationProgressNotesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'rehabilitation_progress_notesPendingEdits';
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
  'assessment-scores': 'Assessment Scores',
  'mobility-testing': 'Mobility Testing',
  'muscle-rom': 'Muscle & Range of Motion',
  'therapy-progress': 'Therapy Progress',
  'goals-interventions': 'Goals & Interventions',
  'devices-comorbidities': 'Devices & Comorbidities',
  'discharge': 'Discharge',
};

const FIELD_LABELS = {
  functionalIndependenceMeasure: 'Functional Independence Measure (FIM)',
  barthel: 'Barthel Index',
  rankinScale: 'Modified Rankin Scale',
  cognitiveAssessment: 'Cognitive Assessment',
  berghBalance: 'Berg Balance Scale',
  painScale: 'Pain Scale (0-10)',
  gaitSpeed: 'Gait Speed (m/s)',
  sixMinuteWalkTest: 'Six-Minute Walk Test (m)',
  timedUpAndGo: 'Timed Up and Go (seconds)',
  functionalReach: 'Functional Reach (cm)',
  ashworthScale: 'Modified Ashworth Scale',
  rangeOfMotion: 'Range of Motion',
  muscleStrengthTesting: 'Muscle Strength Testing',
  swallowingAssessment: 'Swallowing Assessment',
  speechTherapyProgress: 'Speech Therapy Progress',
  therapyParticipation: 'Therapy Participation',
  occupationalTherapyGoals: 'Occupational Therapy Goals',
  physicalTherapyInterventions: 'Physical Therapy Interventions',
  assistiveDevices: 'Assistive Devices',
  comorbidityImpact: 'Comorbidity Impact',
  dischargeDisposition: 'Discharge Disposition',
  rehabilitationPotential: 'Rehabilitation Potential',
  medicationCompliance: 'Medication Compliance',
};

const SECTION_FIELDS = {
  'assessment-scores': ['functionalIndependenceMeasure', 'barthel', 'rankinScale', 'cognitiveAssessment', 'berghBalance', 'painScale'],
  'mobility-testing': ['gaitSpeed', 'sixMinuteWalkTest', 'timedUpAndGo', 'functionalReach', 'ashworthScale'],
  'muscle-rom': ['rangeOfMotion', 'muscleStrengthTesting'],
  'therapy-progress': ['swallowingAssessment', 'speechTherapyProgress', 'therapyParticipation'],
  'goals-interventions': ['occupationalTherapyGoals', 'physicalTherapyInterventions'],
  'devices-comorbidities': ['assistiveDevices', 'comorbidityImpact'],
  'discharge': ['dischargeDisposition', 'rehabilitationPotential', 'medicationCompliance'],
};

const NUMBER_FIELDS = ['functionalIndependenceMeasure', 'barthel', 'rankinScale', 'gaitSpeed', 'sixMinuteWalkTest', 'berghBalance', 'timedUpAndGo', 'cognitiveAssessment', 'functionalReach', 'painScale'];
const BOOLEAN_FIELDS = ['medicationCompliance'];
const ARRAY_FIELDS = ['rangeOfMotion', 'muscleStrengthTesting', 'occupationalTherapyGoals', 'physicalTherapyInterventions', 'assistiveDevices', 'comorbidityImpact'];
const STRING_FIELDS = ['ashworthScale', 'swallowingAssessment', 'speechTherapyProgress', 'dischargeDisposition', 'rehabilitationPotential', 'therapyParticipation'];
const ENUM_FIELDS = {
  ashworthScale: ['0', '1', '1+', '2', '3', '4'],
  rehabilitationPotential: ['excellent', 'good', 'fair', 'poor', 'guarded'],
  therapyParticipation: ['excellent', 'good', 'fair', 'poor', 'limited', 'minimal', 'refused'],
};
const NUMBER_CONFIG = {
  functionalIndependenceMeasure: { min: 18, max: 126, step: 1 },
  barthel: { min: 0, max: 100, step: 5 },
  rankinScale: { min: 0, max: 6, step: 1 },
  gaitSpeed: { min: 0, max: 3, step: 0.1 },
  sixMinuteWalkTest: { min: 0, max: 1000, step: 10 },
  berghBalance: { min: 0, max: 56, step: 1 },
  timedUpAndGo: { min: 0, max: 300, step: 0.5 },
  cognitiveAssessment: { min: 0, max: 30, step: 1 },
  functionalReach: { min: 0, max: 100, step: 1 },
  painScale: { min: 0, max: 10, step: 1 },
};
const ZERO_SENTINEL_FIELDS = new Set(['functionalIndependenceMeasure', 'gaitSpeed', 'timedUpAndGo']);
const CLINICAL_TEXT_DELIMITER = /[.;]\s/;
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();
const displayFieldValue = (field, value) => field === 'ashworthScale' ? `Grade ${value}` : String(value ?? '');
const fieldHasVal = (field, value) => {
  if (ZERO_SENTINEL_FIELDS.has(field) && Number(value) === 0) return false;
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(item => item !== null && item !== undefined && String(item).trim() !== '');
  return typeof value === 'object' ? Object.keys(value).length > 0 : true;
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&().#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/);
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
    else if (ch === ',' && depth === 0) {
      const before = current.trim();
      const after = text.slice(i + 1);
      const afterTrimmed = after.trimStart();
      const nextWord = (afterTrimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
      const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
      const numericThousands = /\d$/.test(before) && /^\d{3}\b/.test(afterTrimmed);
      const noFollowingSpace = after.length === afterTrimmed.length;
      const linkedByConjunction = ['and', 'or'].includes(nextWord) || ['and', 'or'].includes(previousWord);
      if (numericThousands || noFollowingSpace || linkedByConjunction) current += ch;
      else { if (before) result.push(before); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const enumOptionsWith = (field, current) => {
  const base = ENUM_FIELDS[field] || [];
  if (!current || base.some(o => o.toLowerCase() === String(current).toLowerCase())) return base;
  return [String(current), ...base];
};

/* ═══════ COMPONENT ═══════ */
const RehabilitationProgressNotesDocument = ({ document: docProp }) => {
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
      if (r?.rehabilitation_progress_notes) return Array.isArray(r.rehabilitation_progress_notes) ? r.rehabilitation_progress_notes : [r.rehabilitation_progress_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.rehabilitation_progress_notes) return Array.isArray(dd.rehabilitation_progress_notes) ? dd.rehabilitation_progress_notes : [dd.rehabilitation_progress_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Draft store shape: { [recordId]: { [fieldPart]: value } }; fieldPart is "field" or "field.arrayIndex". */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      let rid = null;
      if (record && record._id) rid = typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id));
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
    /* eslint-disable react-hooks/set-state-in-effect -- restore one local draft snapshot after records resolve */
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitTextSegments = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const segments = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      const isCandidate = depth === 0 && (ch === ';' || ch === '.');
      const protectedTitle = ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g)$/.test(current);
      const decimal = ch === '.' && /\d$/.test(current) && /^\d/.test(text[i + 1] || '');
      const boundary = isCandidate && !protectedTitle && !decimal && (!text[i + 1] || CLINICAL_TEXT_DELIMITER.test(`${ch}${text[i + 1]}`));
      if (!boundary) { current += ch; continue; }
      let separator = ch;
      while (/\s/.test(text[i + 1] || '')) { separator += text[i + 1]; i += 1; }
      if (current.trim()) segments.push({ text: current.trim(), separator });
      current = '';
    }
    if (current.trim()) segments.push({ text: current.trim(), separator: '' });
    return segments;
  }, []);

  const splitBySentence = useCallback((text) => splitTextSegments(text).map(segment => segment.text), [splitTextSegments]);

  const replaceSegment = useCallback((originalText, segmentIndex, replacementText) => {
    const original = splitTextSegments(String(originalText || ''));
    if (!original[segmentIndex]) return String(originalText || '');
    const replacement = splitTextSegments(String(replacementText || '').trim());
    const originalSeparator = original[segmentIndex].separator;
    if (!replacement.length) original.splice(segmentIndex, 1);
    else {
      replacement[replacement.length - 1].separator = originalSeparator;
      original.splice(segmentIndex, 1, ...replacement);
    }
    return original.map(part => `${part.text}${part.separator}`).join('').trim();
  }, [splitTextSegments]);

  const splitBySemicolon = useCallback((text) => {
    if (!text || typeof text !== 'string') return [text || ''];
    return text.split(/;\s+/).map(s => s.trim()).filter(s => s);
  }, []);

  function reconstructFullText(sentences) {
    return (sentences || []).map(sentence => String(sentence || '').replace(/[;.]+$/, '').trim()).filter(Boolean).join('. ');
  }

  const setAtPath = useCallback((source, path, value) => {
    const parts = String(path).split('.');
    const root = Array.isArray(source) ? [...source] : { ...source };
    let cursor = root;
    let originalCursor = source;
    parts.forEach((part, partIndex) => {
      if (partIndex === parts.length - 1) { cursor[part] = value; return; }
      const originalNext = originalCursor?.[part];
      const clone = Array.isArray(originalNext) ? [...originalNext] : { ...(originalNext || {}) };
      cursor[part] = clone;
      cursor = clone;
      originalCursor = originalNext;
    });
    return root;
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    let value = record[fn];
    if (Array.isArray(value)) {
      value = [...value];
      Object.entries(localEdits).forEach(([editKey, editValue]) => {
        const match = editKey.match(new RegExp(`^${fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)-${idx}$`));
        if (match) value[Number(match[1])] = editValue;
      });
    }
    return value;
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
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
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
      const rt = `Rehabilitation Progress Notes ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : typeof val === 'object' ? Object.entries(val).some(([k, v]) => String(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      let merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged = setAtPath(merged, m[1], localEdits[key]);
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits, setAtPath]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
     fieldPart = "field" (whole-field value) or "field.arrayIndex" (single array element). */
  const stageDraft = useCallback((record, fieldPart, value) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId]);

  // Save = stage a DRAFT locally + write the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop section 'approved' flag so the button returns to yellow Pending Approve
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    stageDraft(record, fn, saveVal);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  // Save one sentence = stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const editedVal = editValue.trim();
    const replacement = !editedVal || /^[;.,!?]+$/.test(editedVal) ? '' : editedVal;
    const fullText = replaceSegment(currentVal, sentenceIdx, replacement);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => {
      const n = { ...prev };
      n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = Math.max(0, splitBySentence(replacement).length - 1);
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    stageDraft(record, fn, fullText);
    setEditingField(null); setEditValue('');
  }

  function saveCommaItem(record, fn, idx, sid, sIdx, ciIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const s = sentences[sIdx] || '';
    const p = parseLabel(s);
    if (!p.isLabeled) return;
    const semiItems = splitBySemicolon(p.value);
    const useSemicolon = semiItems.length >= 2;
    const items = useSemicolon ? semiItems : splitByComma(p.value);
    const trimmed = editValue.trim();
    const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp);
    if (subParts.length > 1) { items.splice(ciIdx, 1, ...subParts); } else { items[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    const delimiter = useSemicolon ? '; ' : ', ';
    const rebuilt = `${p.label}: ${items.join(delimiter)}.`;
    const allS = [...sentences]; allS[sIdx] = rebuilt;
    const fullText = reconstructFullText(allS);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const sentenceKey = `${fn}-${idx}-s${sIdx}`;
    const commaKey = `${sentenceKey}-c${ciIdx}`;
    const marks = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ciIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    stageDraft(record, fn, fullText);
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

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Pending edits whose base field belongs to this section (localEdits key = "field-idx" or "field.arrayIndex-idx")
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const payload = { field: fieldPart, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/rehabilitation_progress_notes/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/rehabilitation_progress_notes/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Save failed. Please try again.'); }
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
  const copySectionText = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = [];
    let unlabeledNumber = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const semiItems = splitBySemicolon(parsed.value);
        const parts = semiItems.length >= 2 ? semiItems : splitByComma(parsed.value);
        lines.push(parsed.label, COPY_LINE_DASH);
        parts.forEach((item, itemIndex) => { lines.push(`${itemIndex + 1}. ${item}`); });
      } else {
        splitByComma(s).forEach(item => { lines.push(`${unlabeledNumber++}. ${item}`); });
      }
    });
    return lines;
  }, [splitBySentence, splitBySemicolon]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const body = [];
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      if (!sameAsTitle(label, title)) body.push(label, COPY_LINE_DASH);
      if (NUMBER_FIELDS.includes(f)) body.push(`1. ${val}`);
      else if (BOOLEAN_FIELDS.includes(f)) body.push(`1. ${val ? 'Yes' : 'No'}`);
      else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        let unlabeledNumber = 1;
        let previousLabel = '';
        let labeledNumber = 0;
        items.filter(item => item !== null && item !== undefined && String(item).trim() !== '').forEach(item => {
          const parsed = parseLabel(fmtVal(item));
          if (parsed.isLabeled) {
            if (parsed.label !== previousLabel) { body.push(parsed.label, COPY_LINE_DASH); labeledNumber = 0; }
            previousLabel = parsed.label;
            body.push(`${++labeledNumber}. ${parsed.value}`);
          } else {
            previousLabel = '';
            body.push(`${unlabeledNumber++}. ${fmtVal(item)}`);
          }
        });
      } else if (STRING_FIELDS.includes(f)) body.push(...formatSentenceFieldLines(displayFieldValue(f, fmtVal(val))));
      else body.push(`1. ${fmtVal(val)}`);
      body.push('');
    });
    if (!body.length) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${body.join('\n').trim()}\n\n`;
  }, [getFieldValue, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `Rehabilitation Progress Notes\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Rehabilitation Progress Note ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = !sameAsTitle(label, SECTION_TITLES[sid]);
    const rawVal = String(val);
    const displayVal = displayFieldValue(fn, rawVal);
    const isModified = editedFields[editKey];
    const config = NUMBER_CONFIG[fn] || { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY, step: 1 };
    const changeNumber = (direction) => {
      const current = Number.parseFloat(editValue);
      const base = Number.isNaN(current) ? config.min : current;
      const precision = String(config.step).includes('.') ? String(config.step).split('.')[1].length : 0;
      const next = Math.min(config.max, Math.max(config.min, base + direction * config.step));
      setEditValue(String(Number(next.toFixed(precision))));
    };
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(rawVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); changeNumber(-1); }} aria-label={`Decrease ${label}`}>-</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); changeNumber(1); }} aria-label={`Increase ${label}`}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number.parseFloat(editValue); if (Number.isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } const bounded = Math.min(config.max, Math.max(config.min, numVal)); handleSaveField(record, fn, idx, sid, null, bounded); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD — BlueSelect Yes/No, boolean persisted ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = !sameAsTitle(label, SECTION_TITLES[sid]);
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: CLINICAL ENUM FIELD ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = !sameAsTitle(label, SECTION_TITLES[sid]);
    const rawVal = String(val);
    const displayVal = displayFieldValue(fn, rawVal);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(rawVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={enumOptionsWith(fn, editValue)} onChange={setEditValue} />
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
    const items = (Array.isArray(val) ? val : [])
      .map((item, sourceIndex) => ({ item: String(item ?? ''), sourceIndex }))
      .filter(({ item }) => item.trim() !== '')
      .map(entry => ({ ...entry, parsed: parseLabel(entry.item) }));
    if (!items.length) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = !sameAsTitle(label, SECTION_TITLES[sid]);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const groups = [];
    items.forEach(entry => {
      const groupLabel = entry.parsed.isLabeled ? entry.parsed.label : '';
      const previous = groups[groups.length - 1];
      if (previous && previous.label === groupLabel) previous.rows.push(entry);
      else groups.push({ label: groupLabel, rows: [entry] });
    });

    const renderArrayRow = ({ item, sourceIndex, parsed }) => {
      const editKey = `${fn}.${sourceIndex}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];
      const displayValue = parsed.isLabeled ? parsed.value : item;
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!label.toLowerCase().includes(phrase) && !item.toLowerCase().includes(phrase)) return null;
      }
      return (
        <div key={sourceIndex} data-edit-field={`${fn}.${sourceIndex}`}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayValue); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (!safeId(record)) return; const savedValue = parsed.isLabeled ? `${parsed.label}: ${editValue.trim()}` : editValue.trim(); stageDraft(record, `${fn}.${sourceIndex}`, savedValue); setLocalEdits(prev => ({ ...prev, [editKey]: savedValue })); setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayValue, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    };

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, groupIndex) => group.label ? (
          <div key={`${group.label}-${groupIndex}`} className="rec-mini-card nested-mini-card">
            <div className="nested-subtitle">{highlightText(group.label)}</div>
            {group.rows.map(renderArrayRow)}
          </div>
        ) : <React.Fragment key={`unlabeled-${groupIndex}`}>{group.rows.map(renderArrayRow)}</React.Fragment>)}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with splitBySentence + splitBySemicolon pre-split ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = !sameAsTitle(label, SECTION_TITLES[sid]);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card nested-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              if (parsed.isLabeled) {
                const semiItems = splitBySemicolon(parsed.value);
                const commaItems = semiItems.length >= 2 ? semiItems : splitByComma(parsed.value);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2) {
                  return (
                    <div key={sIdx} className="rec-mini-card nested-mini-card" style={{ marginTop: 8 }}>
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
                <div key={sIdx} data-edit-field={fn} className={parsed.isLabeled ? 'rec-mini-card nested-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id3 = safeId(record); if (!id3) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const lk = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [lk]: fullText })); setPendingEdits(prev => ({ ...prev, [lk]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; }); stageDraft(record, fn, fullText); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
          <div className="rec-mini-card nested-mini-card">
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
                  const lk = `${fn}-${idx}`;
                  setLocalEdits(prev => ({ ...prev, [lk]: fullText }));
                  setPendingEdits(prev => ({ ...prev, [lk]: true }));
                  setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
                  setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
                  stageDraft(record, fn, fullText);
                  setEditingField(null); setEditValue('');
                };

                return (
                  <div key={ciIdx} data-edit-field={fn} className="rec-mini-card nested-mini-card" style={{ marginTop: 8 }}>
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
                          <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ciParsed.value, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added' : 'edited'} - click Pending Approve to save</span>}
                  </div>
                );
              }

              /* Non-labeled comma item */
              return (
                <div key={ciIdx} data-edit-field={fn}>
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
                            const lk = `${fn}-${idx}`;
                            setLocalEdits(prev => ({ ...prev, [lk]: fullText }));
                            setPendingEdits(prev => ({ ...prev, [lk]: true }));
                            setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
                            setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
                            stageDraft(record, fn, fullText);
                            setEditingField(null); setEditValue('');
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
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
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
              <button className={`copy-btn ${copiedItems[singleEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(strVal, singleEditKey); }}>{copiedItems[singleEditKey] ? 'Copied!' : 'Copy'}</button>
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
      return fieldHasVal(f, val);
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
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid);
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
      <div className="rehabilitation-progress-notes-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Rehabilitation Progress Notes</h2></div>
        <div className="empty-state">No rehabilitation progress notes available</div>
      </div>
    );
  }

  return (
    <div className="rehabilitation-progress-notes-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Rehabilitation Progress Notes</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RehabilitationProgressNotesDocumentPDFTemplate document={pdfData} />} fileName="Rehabilitation_Progress_Notes.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search rehabilitation progress notes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Rehabilitation Progress Note ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'assessment-scores')}
            {renderSection(record, idx, 'mobility-testing')}
            {renderSection(record, idx, 'muscle-rom')}
            {renderSection(record, idx, 'therapy-progress')}
            {renderSection(record, idx, 'goals-interventions')}
            {renderSection(record, idx, 'devices-comorbidities')}
            {renderSection(record, idx, 'discharge')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RehabilitationProgressNotesDocument;
