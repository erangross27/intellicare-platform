/**
 * ConcussionAssessmentDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: concussion_assessment
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ConcussionAssessmentDocumentPDFTemplate from '../pdf-templates/ConcussionAssessmentDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueTimePicker from '../components/BlueTimePicker';
import secureApiClient from '../../../services/secureApiClient';
import './ConcussionAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'concussion_assessmentPendingEdits';
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
  'injury-info': 'Injury Information',
  'assessment-scores': 'Assessment Scores',
  'symptoms': 'Symptoms',
  'cognitive-balance': 'Cognitive & Balance Testing',
  'imaging-history': 'Imaging & History',
  'return-to-play': 'Return to Play',
};

const FIELD_LABELS = {
  date: 'Date', injuryDateTime: 'Injury Date/Time', mechanismOfInjury: 'Mechanism of Injury',
  sportActivity: 'Sport/Activity', lossOfConsciousness: 'Loss of Consciousness',
  lossOfConsciousnessDuration: 'Loss of Consciousness Duration (seconds)', postTraumaticAmnesia: 'Post-Traumatic Amnesia',
  glasgowComaScore: 'Glasgow Coma Score', scat5TotalScore: 'SCAT5 Total Score',
  symptomSeverityScore: 'Symptom Severity Score', numberOfSymptoms: 'Number of Symptoms',
  headachePresent: 'Headache', nauseaVomiting: 'Nausea/Vomiting',
  dizzinessBalance: 'Dizziness/Balance Problems', visualDisturbances: 'Visual Disturbances',
  photoPhonophobia: 'Photophobia/Phonophobia', cognitiveImpairment: 'Cognitive Impairment',
  neckPainTenderness: 'Neck Pain/Tenderness',
  immediateMemoryScore: 'Immediate Memory Score', delayedRecallScore: 'Delayed Recall Score',
  concentrationScore: 'Concentration Score', balanceErrorScoringSystem: 'Balance Error Scoring System',
  tandemGaitTime: 'Tandem Gait Time',
  imagingPerformed: 'Imaging Performed', priorConcussionCount: 'Prior Concussion Count',
  redFlagsPresent: 'Red Flags Present',
  returnToPlayCleared: 'Return to Play Cleared', returnToPlayStage: 'Return to Play Stage',
};

const SECTION_FIELDS = {
  'injury-info': ['date', 'injuryDateTime', 'mechanismOfInjury', 'sportActivity', 'lossOfConsciousness', 'lossOfConsciousnessDuration', 'postTraumaticAmnesia'],
  'assessment-scores': ['glasgowComaScore', 'scat5TotalScore', 'symptomSeverityScore', 'numberOfSymptoms'],
  'symptoms': ['headachePresent', 'nauseaVomiting', 'dizzinessBalance', 'visualDisturbances', 'photoPhonophobia', 'cognitiveImpairment', 'neckPainTenderness'],
  'cognitive-balance': ['immediateMemoryScore', 'delayedRecallScore', 'concentrationScore', 'balanceErrorScoringSystem', 'tandemGaitTime'],
  'imaging-history': ['imagingPerformed', 'priorConcussionCount', 'redFlagsPresent'],
  'return-to-play': ['returnToPlayCleared', 'returnToPlayStage'],
};

const SENTENCE_FIELDS = ['mechanismOfInjury', 'imagingPerformed'];
const ARRAY_FIELDS = ['redFlagsPresent'];
const BOOLEAN_FIELDS = ['lossOfConsciousness', 'postTraumaticAmnesia', 'headachePresent', 'nauseaVomiting', 'dizzinessBalance', 'visualDisturbances', 'photoPhonophobia', 'cognitiveImpairment', 'neckPainTenderness', 'returnToPlayCleared'];
const DATETIME_FIELDS = ['injuryDateTime'];
const DATE_FIELDS = ['date'];
const NUMERIC_FIELDS = ['lossOfConsciousnessDuration', 'glasgowComaScore', 'scat5TotalScore', 'symptomSeverityScore', 'numberOfSymptoms', 'immediateMemoryScore', 'delayedRecallScore', 'concentrationScore', 'balanceErrorScoringSystem', 'tandemGaitTime', 'priorConcussionCount'];
/* Numeric 0 is a batch-extraction default for these measurements (a GCS of 0 is impossible — min 3) —
   hidden unless the doctor edited the field. priorConcussionCount 0 = "no prior concussions" is REAL data. */
const MEANINGFUL_ZERO_FIELDS = ['priorConcussionCount'];
// Fixed-choice clinical field → dropdown (keep an unmatched current value as an extra option, casing matched).
const ENUM_FIELDS = {
  returnToPlayStage: [
    'Stage 1 — Symptom-limited activity (rest)',
    'Stage 2 — Light aerobic exercise',
    'Stage 3 — Sport-specific exercise',
    'Stage 4 — Non-contact training drills',
    'Stage 5 — Full contact practice',
    'Stage 6 — Return to play',
  ],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
// Copy dividers (4-area mirror): EQ under record + section titles, DASH under every field / group label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// −/+ stepper increment: 1 for integers, else a step matching the value's decimal precision.
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Comma splitter for narrative lists (per sentence, >=3 gate). Paren-aware; keeps Oxford ", and/or X"
// attached; skips no-space commas ("$18,000") and date commas ("January 8, 2026").
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
const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); return isNaN(dt.getTime()) ? '' : dt.toISOString().split('T')[0]; } catch { return ''; } };
const toInputDateTime = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; const pad = (n) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`; } catch { return ''; } };

// Score bar chart helpers
const SCORE_RANGES = {
  gcs: { normalMin: 15, concernMin: 13, scale: [0, 15], higherIsBetter: true },
  scat5: { normalMax: 10, concernMax: 30, scale: [0, 100], higherIsBetter: false },
  symptomSeverity: { normalMax: 10, concernMax: 40, scale: [0, 132], higherIsBetter: false },
  numberOfSymptoms: { normalMax: 3, concernMax: 10, scale: [0, 22], higherIsBetter: false },
  immediateMemory: { normalMin: 13, concernMin: 10, scale: [0, 15], higherIsBetter: true },
  delayedRecall: { normalMin: 4, concernMin: 2, scale: [0, 5], higherIsBetter: true },
  concentration: { normalMin: 4, concernMin: 2, scale: [0, 5], higherIsBetter: true },
  bess: { normalMax: 5, concernMax: 15, scale: [0, 30], higherIsBetter: false },
  tandemGait: { normalMax: 14, concernMax: 18, scale: [0, 30], higherIsBetter: false },
};
const SCORE_INTERPRETATIONS = {
  gcs: { normal: 'Normal', concern: 'Mild TBI', abnormal: 'Moderate-Severe TBI' },
  scat5: { normal: 'Normal', concern: 'Mild Symptoms', abnormal: 'Significant Symptoms' },
  symptomSeverity: { normal: 'Normal', concern: 'Mild Severity', abnormal: 'Significant Severity' },
  numberOfSymptoms: { normal: 'Normal', concern: 'Mild', abnormal: 'Significant' },
  immediateMemory: { normal: 'Normal', concern: 'Mild Impairment', abnormal: 'Significant Impairment' },
  delayedRecall: { normal: 'Normal', concern: 'Mild Impairment', abnormal: 'Significant Impairment' },
  concentration: { normal: 'Normal', concern: 'Mild Impairment', abnormal: 'Significant Impairment' },
  bess: { normal: 'Normal', concern: 'Mild Imbalance', abnormal: 'Significant Imbalance' },
  tandemGait: { normal: 'Normal', concern: 'Mild Impairment', abnormal: 'Significant Impairment' },
};
const SCORE_MAP = {
  glasgowComaScore: { testType: 'gcs', unit: '/15' },
  scat5TotalScore: { testType: 'scat5', unit: '/100' },
  symptomSeverityScore: { testType: 'symptomSeverity', unit: '/132' },
  numberOfSymptoms: { testType: 'numberOfSymptoms', unit: '/22' },
  immediateMemoryScore: { testType: 'immediateMemory', unit: '/15' },
  delayedRecallScore: { testType: 'delayedRecall', unit: '/5' },
  concentrationScore: { testType: 'concentration', unit: '/5' },
  balanceErrorScoringSystem: { testType: 'bess', unit: '/30 errors' },
  tandemGaitTime: { testType: 'tandemGait', unit: ' sec' },
};
const getScoreBarColor = (value, testType) => { if (value === null || value === undefined) return '#9ca3af'; const range = SCORE_RANGES[testType]; if (!range) return '#9ca3af'; if (range.higherIsBetter) { if (value >= range.normalMin) return '#22c55e'; if (value >= range.concernMin) return '#3b82f6'; return '#ef4444'; } else { if (value <= range.normalMax) return '#22c55e'; if (value <= range.concernMax) return '#3b82f6'; return '#ef4444'; } };
const getScoreInterpretation = (value, testType) => { if (value === null || value === undefined) return ''; const range = SCORE_RANGES[testType]; const interp = SCORE_INTERPRETATIONS[testType]; if (!range || !interp) return ''; if (range.higherIsBetter) { if (value >= range.normalMin) return interp.normal; if (value >= range.concernMin) return interp.concern; return interp.abnormal; } else { if (value <= range.normalMax) return interp.normal; if (value <= range.concernMax) return interp.concern; return interp.abnormal; } };
const scoreToPercentage = (value, testType) => { const range = SCORE_RANGES[testType]; if (!range) return 50; const [min, max] = range.scale; return Math.max(5, Math.min(100, ((value - min) / (max - min)) * 100)); };

const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

const ConcussionAssessmentDocument = ({ document: docProp }) => {
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

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.concussion_assessment) return Array.isArray(r.concussion_assessment) ? r.concussion_assessment : [r.concussion_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.concussion_assessment) return Array.isArray(dd.concussion_assessment) ? dd.concussion_assessment : [dd.concussion_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = record && record._id
        ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id)))
        : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          // array-element draft (field.arrayIndex) → mark the element edited
          const baseField = fieldPart.slice(0, lastDot);
          nFields[`${baseField}-${idx}-a${trailing}`] = 'edited';
        } else {
          nFields[editKey] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const formatDateTime = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v, fn) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    if (DATE_FIELDS.includes(fn)) return formatDate(v);
    if (DATETIME_FIELDS.includes(fn)) return formatDateTime(v);
    return String(v || '');
  }, [formatDate, formatDateTime]);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return Array.isArray(record[fn]) ? record[fn] : []; }, [localEdits]);
  // Numeric 0 is a batch-extraction default (GCS 0 is impossible) — hide it unless the doctor edited the
  // field (this session or committed doctorEdits). priorConcussionCount keeps 0 (a real "none" count).
  const numberShows = useCallback((record, fn, idx) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (Number.isNaN(num)) return false;
    if (num === 0) {
      if (MEANINGFUL_ZERO_FIELDS.includes(fn)) return true;
      const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
      return Boolean(editedFields[`${fn}-${idx}`]) || doctorEdited;
    }
    return true;
  }, [getFieldValue, editedFields]);
  // Field visibility incl the numeric sentinel-0 gate (arrays handled separately).
  const fieldShows = useCallback((record, fn, idx) => {
    if (NUMERIC_FIELDS.includes(fn)) return numberShows(record, fn, idx);
    return hasVal(getFieldValue(record, fn, idx));
  }, [numberShows, hasVal, getFieldValue]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const highlightText = useCallback((text) => { if (!searchTerm.trim() || !text) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); const parts = String(text).split(regex); return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part); }, [searchTerm]);

  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, 0);
        if (arr.some(item => String(item).toLowerCase().includes(phrase))) return true;
      } else {
        const val = getFieldValue(record, f, 0);
        if (val !== null && val !== undefined && fmtVal(val, f).toLowerCase().includes(phrase)) return true;
      }
      if (SCORE_MAP[f]) {
        const val = getFieldValue(record, f, 0);
        if (val != null) { const interp = getScoreInterpretation(val, SCORE_MAP[f].testType); if (interp.toLowerCase().includes(phrase)) return true; }
      }
    }
    return false;
  }, [searchTerm, getFieldValue, getEffectiveArray, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    if (ARRAY_FIELDS.includes(fn)) {
      const arr = getEffectiveArray(record, fn, idx);
      return arr.some(item => String(item).toLowerCase().includes(phrase));
    }
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined && fmtVal(val, fn).toLowerCase().includes(phrase)) return true;
    if (SCORE_MAP[fn] && val != null) { const interp = getScoreInterpretation(val, SCORE_MAP[fn].testType); if (interp.toLowerCase().includes(phrase)) return true; }
    return false;
  }, [searchTerm, getFieldValue, getEffectiveArray, fmtVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Concussion Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        if (ARRAY_FIELDS.includes(f)) { const arr = Array.isArray(record[f]) ? record[f] : []; if (arr.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else { const val = record[f]; if (val !== null && val !== undefined && fmtVal(val, f).toLowerCase().includes(phrase)) return true; }
        if (SCORE_MAP[f] && record[f] != null) { const interp = getScoreInterpretation(record[f], SCORE_MAP[f].testType); if (interp.toLowerCase().includes(phrase)) return true; }
      }
      // interpretation keywords
      const interpKeywords = ['Normal', 'Mild TBI', 'Moderate-Severe TBI', 'Mild Symptoms', 'Significant Symptoms', 'Mild Severity', 'Significant Severity', 'Mild Impairment', 'Significant Impairment', 'Mild Imbalance', 'Significant Imbalance'];
      if (interpKeywords.some(kw => kw.toLowerCase().includes(phrase))) return true;
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return filteredRecords;
    return filteredRecords.map((r, idx) => {
      const m = { ...r };
      Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; });
      ARRAY_FIELDS.forEach(field => { const ak = `${field}-${idx}`; if (pendingEdits[ak]) return; m[field] = getEffectiveArray(r, field, idx); });
      return m;
    });
  }, [filteredRecords, localEdits, pendingEdits, getEffectiveArray]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx) => {
    const id = safeId(record); if (!id) return; setSaveError(null);
    let saveValue = editValue;
    if (BOOLEAN_FIELDS.includes(fn)) { saveValue = editValue === 'Yes' || editValue === 'true' || editValue === true; }
    else if (NUMERIC_FIELDS.includes(fn) || typeof record[fn] === 'number') { saveValue = parseFloat(editValue); if (isNaN(saveValue)) { setSaveError('Invalid number'); return; } }
    else if (DATE_FIELDS.includes(fn) || DATETIME_FIELDS.includes(fn)) { if (!editValue) { setSaveError('Invalid date'); return; } const dt = new Date(editValue); if (isNaN(dt.getTime())) { setSaveError('Invalid date'); return; } saveValue = dt.toISOString(); }
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
      if (!sid || !prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev }; delete next[`${sid}-${idx}`]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one sentence = stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageSentenceDraft(id, fn, idx, fullText) {
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setApprovedSections(prev => {
      const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
      if (!sid || !prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev }; delete next[`${sid}-${idx}`]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return; setSaveError(null);
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      stageSentenceDraft(id, fn, idx, fullText);
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); return;
    }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    stageSentenceDraft(id, fn, idx, fullText);
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[.]+$/, '').trim() !== orig.replace(/[.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  // Save one comma-part of a sentence group (labeled OR unlabeled >=3 list) = stage a DRAFT. Rebuilds that
  // sentence (preserving a "Label:" head), then the full field text; an empty edit removes the part.
  function saveCommaItem(record, fn, idx, sid, sIdx, commaIdx) {
    const id = safeId(record); if (!id) return; setSaveError(null);
    const curSentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const sentence = curSentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    const content = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
    const items = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) items.splice(commaIdx, 1); else items[commaIdx] = trimmed;
    const kept = items.map(s => s.trim()).filter(Boolean);
    if (kept.length > 0) curSentences[sIdx] = parsed ? `${parsed.label}: ${kept.join(', ')}` : kept.join(', ');
    else curSentences.splice(sIdx, 1);
    const fullText = reconstructFullText(curSentences);
    stageSentenceDraft(id, fn, idx, fullText);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sIdx}-c${commaIdx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  // Save array item = stage a DRAFT (the whole array value under the field key). No DB write until Approve.
  const saveArrayItem = useCallback((record, fn, idx, itemIdx) => {
    const id = safeId(record); if (!id) return; setSaveError(null);
    const currentArr = [...getEffectiveArray(record, fn, idx)];
    const trimmed = editValue.trim();
    if (!trimmed) { currentArr.splice(itemIdx, 1); } else { currentArr[itemIdx] = trimmed; }
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${itemIdx}`]: 'edited' }));
    setApprovedSections(prev => {
      const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
      if (!sid || !prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev }; delete next[`${sid}-${idx}`]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = currentArr;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray]);

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so committed values flow into PDF.
  // This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Collect this section/record's pending edits from localEdits (keyed "<field>-<idx>").
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const mt = k.match(/^(.+)-(\d+)$/);
        if (!mt || parseInt(mt[2], 10) !== idx) return false;
        const fieldPart = mt[1];
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart;
        return fields.includes(baseField);
      });
      // Persist each staged field to the DB now.
      for (const editKey of toCommit) {
        const mt = editKey.match(/^(.+)-(\d+)$/);
        const fieldPart = mt[1];
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(trailing)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(trailing, 10); }
        const resp = await secureApiClient.put(`/api/edit/concussion_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/concussion_assessment/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => {
          const mt = editKey.match(/^(.+)-(\d+)$/);
          delete store[id][mt[1]];
        });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, localEdits, pendingEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection]);

  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* Shared EQ/DASH numbered section-copy builder — 4-area mirror. Copy Section passes live getFieldValue;
     Copy All passes pdfData's committed values. Score fields emit "1. <val><unit> (<interpretation>)";
     sentinel-0 numbers hidden (numberShows); sentence fields split by sentence then comma (>=3, sub-label
     only on a genuine >=3 split). Returns '' when the section is empty. */
  const buildSectionCopy = useCallback((record, idx, sid, valueOf) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    const emitSentence = (text) => {
      let n = 0;
      splitBySentence(text).forEach(s => {
        const p = parseLabel(s);
        const content = p ? p.content : s.replace(/[;.]+$/, '').trim();
        const c = splitByComma(content);
        if (c.length >= 3) { if (p) { lines.push(p.label, COPY_LINE_DASH); n = 0; } c.forEach(part => lines.push(`${++n}. ${part.replace(/[;.]+$/, '').trim()}`)); }
        else lines.push(`${++n}. ${s.replace(/[;.]+$/, '').trim()}`);
      });
    };
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, idx);
        if (arr.length === 0) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        arr.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
        lines.push('');
      } else if (SCORE_MAP[f]) {
        if (!numberShows(record, f, idx)) return;
        const val = valueOf(f);
        const sm = SCORE_MAP[f]; const interp = getScoreInterpretation(val, sm.testType);
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${val}${sm.unit}${interp ? ` (${interp})` : ''}`, '');
      } else if (SENTENCE_FIELDS.includes(f)) {
        const val = valueOf(f); if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        emitSentence(fmtVal(val, f));
        lines.push('');
      } else {
        if (!fieldShows(record, f, idx)) return;
        const val = valueOf(f);
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(val, f)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [hasVal, fmtVal, splitBySentence, getEffectiveArray, numberShows, fieldShows]);

  const copyAllText = useCallback(async () => {
    let text = '=== CONCUSSION ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Concussion Assessment ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const block = buildSectionCopy(r, idx, sid, f => r[f]);
        if (block) text += `${block}\n`;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, buildSectionCopy, copyToClipboard]);

  // −/+ number stepper (native spinner arrows banned). min 0; Enter saves; stopPropagation so the row click
  // doesn't re-open/close the editor. onSave commits the field.
  const numberStepper = (onSave) => {
    const bump = (dir) => { setSaveError(null); const s = parseFloat(stepFor(editValue)) || 1; const nv = (parseFloat(editValue) || 0) + dir * s; setEditValue(String(Math.max(0, Math.round(nv * 1e6) / 1e6))); };
    return (
      <div className="num-stepper-row">
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>−</button>
        <input type="number" step={stepFor(editValue)} min="0" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => { setSaveError(null); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSave(); } else if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button>
      </div>
    );
  };

  // Render an editable simple field (string, number, boolean, date)
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val, fn); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const isBoolean = BOOLEAN_FIELDS.includes(fn);
    const isNumeric = NUMERIC_FIELDS.includes(fn);
    const isDate = DATE_FIELDS.includes(fn);
    const isDateTime = DATETIME_FIELDS.includes(fn);
    const isScoreField = !!SCORE_MAP[fn];
    // Score fields render as bar chart rows - handled separately
    if (isScoreField) return null;
    const enumOpts = !isBoolean && !isNumeric && !isDate && !isDateTime && ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const startEdit = () => {
      setSaveError(null);
      if (isBoolean) return setEditValue(val ? 'Yes' : 'No');
      if (isDate) return setEditValue(toInputDate(val));
      if (isDateTime) return setEditValue(toInputDateTime(val));
      if (enumOpts) { const cur = String(val ?? '').trim(); const m = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); return setEditValue(m || cur); }
      setEditValue(displayVal);
    };
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); startEdit(); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBoolean ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="Yes">Yes</option><option value="No">No</option></select>
              ) : isDate ? (
                <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              ) : isDateTime ? (
                // Combined themed date + time row: editValue holds 'YYYY-MM-DDTHH:mm' (seeded by startEdit).
                <div className="datetime-pickers-row">
                  <BlueDatePicker value={editValue.slice(0, 10)} onSelect={iso => setEditValue(`${iso}T${editValue.slice(11, 16) || '00:00'}`)} />
                  <BlueTimePicker value={editValue.slice(11, 16)} onChange={hm => setEditValue(`${editValue.slice(0, 10)}T${hm}`)} />
                </div>
              ) : enumOpts ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>{enumOpts.map(o => <option key={o} value={o}>{o}</option>)}</select>
              ) : isNumeric ? (
                numberStepper(() => handleSaveField(record, fn, idx))
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
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

  // Render sentence-editable field (mechanismOfInjury, imagingPerformed)
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (<div key={fn}><div className="rec-mini-card">{sl && <div className="nested-subtitle">{highlightText(label)}</div>}{sentences.map((sentence, sIdx) => {
      const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
      const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      if (!sentenceMatches && searchTerm.trim()) return null;
      const parsed = parseLabel(sentence);
      // Sub-label group ONLY on a genuine >=3 comma list (labeled or unlabeled); below 3 the whole
      // sentence (incl any "Label:") stays one row — mirrors buildSectionCopy + PDF exactly.
      const rawContent = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
      const commaItems = splitByComma(rawContent);
      if (commaItems.length >= 3) {
        return (
          <div key={sIdx} className={parsed ? 'rec-mini-card' : ''} style={parsed ? { marginTop: 8 } : undefined}>
            {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            {commaItems.map((ci, ciIdx) => {
              const commaKey = `${sentenceKey}-c${ciIdx}`; const ciEditing = editingField === commaKey; const ciBadge = editedFields[commaKey];
              return (
                <div key={ciIdx}>
                  <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                    {ciEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
                    ) : (<><div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button></>)}
                  </div>
                  {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        );
      }
      return (<div key={sIdx}><div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[.]+$/, '').trim()); } }}>{isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>{saveError && editingField === sentenceKey && <div className="save-error">{saveError}</div>}</div>) : (<><div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}</div>);
    })}</div></div>);
  };

  // Render array field (redFlagsPresent)
  const renderArrayField = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (<div key={fn} className="rec-mini-card">
      {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
      {arr.map((item, ai) => {
        const arrKey = `${fn}-${idx}-a${ai}`; const isEditing = editingField === arrKey; const badge = editedFields[arrKey];
        const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || String(item).toLowerCase().includes(searchTerm.toLowerCase().trim());
        if (!itemMatches) return null;
        return (<div key={ai}>
          <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrKey); setEditValue(String(item)); } }}>
            {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fn, idx, ai); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>{saveError && editingField === arrKey && <div className="save-error">{saveError}</div>}</div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[arrKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
          {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>);
      })}
    </div>);
  };

  // Render bar chart section for score fields
  const renderBarChartSection = (record, idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const scoreFields = fields.filter(f => SCORE_MAP[f]);
    // Sentinel-0 gate: a batch-extraction 0 (e.g. GCS 0) would otherwise draw an alarming red bar.
    const scoreData = scoreFields.filter(f => numberShows(record, f, idx)).map(f => ({ field: f, label: FIELD_LABELS[f] || f, value: getFieldValue(record, f, idx), ...SCORE_MAP[f] }));
    if (scoreData.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    return (
      <div className="lab-chart-container">
        <div className="lab-chart-legend">
          <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span className="legend-text">Normal</span></div>
          <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span className="legend-text">Mild Concern</span></div>
          <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span className="legend-text">Significant</span></div>
        </div>
        {scoreData.map((d, i) => {
          const color = getScoreBarColor(d.value, d.testType); const interp = getScoreInterpretation(d.value, d.testType); const pct = scoreToPercentage(d.value, d.testType);
          const editKey = `${d.field}-${idx}`; const isEditing = editingField === editKey; const badge = editedFields[editKey];
          const rowMatches = phraseMatch || (searchTerm.trim() && (d.label.toLowerCase().includes(searchTerm.toLowerCase().trim()) || String(d.value).includes(searchTerm.trim()) || interp.toLowerCase().includes(searchTerm.toLowerCase().trim())));
          if (!rowMatches && searchTerm.trim()) return null;
          return (
            <div className={`lab-bar-chart-row ${badge ? 'modified' : ''} editable-row`} key={i} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(d.value)); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <div className="lab-bar-label">{highlightText(d.label)}</div>
                  {numberStepper(() => handleSaveField(record, d.field, idx))}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, d.field, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                  {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
                </div>
              ) : (<>
                <div className="lab-bar-label">{highlightText(d.label)}<span className="edit-indicator">✎</span></div>
                <div className="lab-bar-container">
                  <div className="lab-bar-background"><div className="lab-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} /></div>
                  <div className="lab-bar-value">{highlightText(`${d.value}${d.unit}`)}</div>
                  <button className={`copy-btn lab-bar-copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${d.label}: ${d.value}${d.unit}${interp ? ` (${interp})` : ''}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                </div>
                {interp && <div className="lab-bar-interpretation" style={{ color }}>{highlightText(interp)}</div>}
              </>)}
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; return fieldShows(record, f, idx); });
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    const hasScores = fields.some(f => SCORE_MAP[f]);
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, sid, f => getFieldValue(record, f, idx)), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>
      {hasScores && renderBarChartSection(record, idx, sid)}
      {fields.map(f => { if (SCORE_MAP[f]) return null; if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title); return renderEditableField(record, f, idx, sid, title); })}
    </div></div>);
  };

  if (!records || records.length === 0) return (<div className="concussion-assessment" ref={containerRef}><div className="document-header"><h2 className="document-title">Concussion Assessment</h2></div><div className="empty-state">No concussion assessment records available</div></div>);

  return (
    <div className="concussion-assessment" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Concussion Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ConcussionAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Concussion_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search concussion assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><h3 className="record-name">{highlightText(`Concussion Assessment ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'injury-info')}
            {renderMixedSection(record, idx, 'assessment-scores')}
            {renderMixedSection(record, idx, 'symptoms')}
            {renderMixedSection(record, idx, 'cognitive-balance')}
            {renderMixedSection(record, idx, 'imaging-history')}
            {renderMixedSection(record, idx, 'return-to-play')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConcussionAssessmentDocument;
