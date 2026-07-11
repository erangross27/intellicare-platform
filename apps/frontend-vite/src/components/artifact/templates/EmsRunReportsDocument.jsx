/**
 * EmsRunReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: ems_run_reports
 *
 * 8 Sections:
 *   1. incident-times: incidentNumber, dispatchTime, arrivalTime, transportTime, hospitalArrivalTime
 *   2. chief-complaint: chiefComplaint (sentence)
 *   3. mechanism-injury: mechanismOfInjury (sentence)
 *   4. vital-signs: glasgowComaScale(num), initialBloodPressure(str), initialHeartRate(num),
 *                   initialRespiratoryRate(num), oxygenSaturation(num), bloodGlucose(num), bodyTemperature(num)
 *   5. assessment-scores: traumaScore(num), painScore(num), strokeScale(num)
 *   6. ecg-rhythm: ecgRhythm(str)
 *   7. airway-interventions: airwayManagement(sentence), ivAccessEstablished(bool),
 *                            cprPerformed(bool), defibrillationAttempts(num)
 *   8. disposition-transport: patientDisposition, receivingFacility
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EmsRunReportsDocumentPDFTemplate from '../pdf-templates/EmsRunReportsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueTimePicker from '../components/BlueTimePicker';
import BlueSelect from '../components/BlueSelect';
import './EmsRunReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field"; value is the full
   field value — string OR array, mirroring how each save handler writes localEdits[`${fn}-${idx}`]). */
const DRAFT_KEY = 'ems_run_reportsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ SCORE BAR CHART HELPERS ═══════ */
const SCORE_RANGES = {
  gcs: { normalMin: 15, concernMin: 13, scale: [3, 15], higherIsBetter: true },
  systolicBP: { normalMax: 120, concernMax: 139, scale: [60, 220], higherIsBetter: false },
  diastolicBP: { normalMax: 80, concernMax: 89, scale: [30, 130], higherIsBetter: false },
  heartRate: { normalMin: 60, normalMax: 100, mildMin: 50, mildMax: 120, scale: [30, 200], bidirectional: true },
  respiratoryRate: { normalMin: 12, normalMax: 20, mildMin: 10, mildMax: 24, scale: [0, 40], bidirectional: true },
  oxygenSaturation: { normalMin: 95, concernMin: 90, scale: [80, 100], higherIsBetter: true },
  bloodGlucose: { normalMin: 70, normalMax: 140, mildMin: 60, mildMax: 180, scale: [0, 400], bidirectional: true },
  bodyTemperature: { normalMin: 97, normalMax: 99.5, mildMin: 96, mildMax: 100.4, scale: [90, 108], bidirectional: true },
  traumaScore: { normalMin: 12, concernMin: 10, scale: [0, 12], higherIsBetter: true },
  painScore: { normalMax: 3, concernMax: 6, scale: [0, 10], higherIsBetter: false },
  strokeScale: { normalMax: 0, concernMax: 4, scale: [0, 42], higherIsBetter: false },
};

const SCORE_INTERPRETATIONS = {
  gcs: { normal: 'Normal', concern: 'Mild TBI', abnormal: 'Severe TBI' },
  systolicBP: { normal: 'Normal', concern: 'Pre-Hypertension', abnormal: 'Hypertension' },
  diastolicBP: { normal: 'Normal', concern: 'Pre-Hypertension', abnormal: 'Hypertension' },
  heartRate: { normal: 'Normal', mildLow: 'Mild Bradycardia', low: 'Bradycardia', mildHigh: 'Mild Tachycardia', high: 'Tachycardia' },
  respiratoryRate: { normal: 'Normal', mildLow: 'Mild Bradypnea', low: 'Bradypnea', mildHigh: 'Mild Tachypnea', high: 'Tachypnea' },
  oxygenSaturation: { normal: 'Normal', concern: 'Mild Hypoxemia', abnormal: 'Hypoxemia' },
  bloodGlucose: { normal: 'Normal', mildLow: 'Mild Hypoglycemia', low: 'Hypoglycemia', mildHigh: 'Mild Hyperglycemia', high: 'Hyperglycemia' },
  bodyTemperature: { normal: 'Normal', mildLow: 'Mild Hypothermia', low: 'Hypothermia', mildHigh: 'Low-Grade Fever', high: 'Fever' },
  traumaScore: { normal: 'Normal', concern: 'Mild', abnormal: 'Severe' },
  painScore: { normal: 'Mild/None', concern: 'Moderate', abnormal: 'Severe' },
  strokeScale: { normal: 'Normal', concern: 'Minor Stroke', abnormal: 'Moderate-Severe Stroke' },
};

const getScoreBarColor = (value, testType) => {
  if (value === null || value === undefined) return '#9ca3af';
  const range = SCORE_RANGES[testType];
  if (!range) return '#9ca3af';
  if (range.bidirectional) {
    if (value >= range.normalMin && value <= range.normalMax) return '#22c55e';
    if (value >= range.mildMin && value <= range.mildMax) return '#3b82f6';
    return '#ef4444';
  }
  if (range.higherIsBetter) {
    if (value >= range.normalMin) return '#22c55e';
    if (value >= range.concernMin) return '#3b82f6';
    return '#ef4444';
  } else {
    if (value <= range.normalMax) return '#22c55e';
    if (value <= range.concernMax) return '#3b82f6';
    return '#ef4444';
  }
};

const getScoreInterpretation = (value, testType) => {
  if (value === null || value === undefined) return '';
  const range = SCORE_RANGES[testType];
  const interp = SCORE_INTERPRETATIONS[testType];
  if (!range || !interp) return '';
  if (range.bidirectional) {
    if (value >= range.normalMin && value <= range.normalMax) return interp.normal;
    if (value < range.normalMin) { if (value >= range.mildMin) return interp.mildLow; return interp.low; }
    if (value <= range.mildMax) return interp.mildHigh;
    return interp.high;
  }
  if (range.higherIsBetter) {
    if (value >= range.normalMin) return interp.normal;
    if (value >= range.concernMin) return interp.concern;
    return interp.abnormal;
  } else {
    if (value <= range.normalMax) return interp.normal;
    if (value <= range.concernMax) return interp.concern;
    return interp.abnormal;
  }
};

const scoreToPercentage = (value, testType) => {
  const range = SCORE_RANGES[testType];
  if (!range) return 50;
  const [min, max] = range.scale;
  return Math.max(5, Math.min(100, ((value - min) / (max - min)) * 100));
};

const parseBP = (bp) => {
  if (!bp) return { systolic: null, diastolic: null };
  const match = String(bp).match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return { systolic: null, diastolic: null };
  return { systolic: parseInt(match[1]), diastolic: parseInt(match[2]) };
};

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'incident-times': 'Incident & Response Times',
  'chief-complaint': 'Chief Complaint',
  'mechanism-injury': 'Mechanism of Injury',
  'vital-signs': 'Vital Signs',
  'assessment-scores': 'Assessment Scores',
  'ecg-rhythm': 'ECG Rhythm',
  'airway-interventions': 'Airway & Interventions',
  'medications-administered': 'Medications Administered',
  'disposition-transport': 'Disposition & Transport',
};

const FIELD_LABELS = {
  incidentNumber: 'Incident Number',
  dispatchTime: 'Dispatch Time',
  arrivalTime: 'Arrival Time',
  transportTime: 'Transport Time',
  hospitalArrivalTime: 'Hospital Arrival Time',
  chiefComplaint: 'Chief Complaint',
  mechanismOfInjury: 'Mechanism of Injury',
  glasgowComaScale: 'Glasgow Coma Scale',
  initialBloodPressure: 'Blood Pressure',
  initialHeartRate: 'Heart Rate',
  initialRespiratoryRate: 'Respiratory Rate',
  oxygenSaturation: 'Oxygen Saturation',
  bloodGlucose: 'Blood Glucose',
  bodyTemperature: 'Body Temperature',
  ecgRhythm: 'ECG Rhythm',
  traumaScore: 'Trauma Score',
  painScore: 'Pain Score',
  strokeScale: 'Stroke Scale (NIHSS)',
  airwayManagement: 'Airway Management',
  ivAccessEstablished: 'IV Access Established',
  cprPerformed: 'CPR Performed',
  defibrillationAttempts: 'Defibrillation Attempts',
  medicationsAdministered: 'Medications Administered',
  patientDisposition: 'Patient Disposition',
  receivingFacility: 'Receiving Facility',
};

const SECTION_FIELDS = {
  'incident-times': ['incidentNumber', 'dispatchTime', 'arrivalTime', 'transportTime', 'hospitalArrivalTime'],
  'chief-complaint': ['chiefComplaint'],
  'mechanism-injury': ['mechanismOfInjury'],
  'vital-signs': ['glasgowComaScale', 'initialBloodPressure', 'initialHeartRate', 'initialRespiratoryRate', 'oxygenSaturation', 'bloodGlucose', 'bodyTemperature'],
  'assessment-scores': ['traumaScore', 'painScore', 'strokeScale'],
  'ecg-rhythm': ['ecgRhythm'],
  'airway-interventions': ['airwayManagement', 'ivAccessEstablished', 'cprPerformed', 'defibrillationAttempts'],
  'medications-administered': ['medicationsAdministered'],
  'disposition-transport': ['patientDisposition', 'receivingFacility'],
};

const NUMBER_FIELDS = ['glasgowComaScale', 'initialHeartRate', 'initialRespiratoryRate', 'oxygenSaturation', 'bloodGlucose', 'bodyTemperature', 'traumaScore', 'painScore', 'strokeScale', 'defibrillationAttempts'];
/* Numeric fields where 0 is a sentinel for "absent/not-measured" (impossible real value),
 * matching the chart-section hide-zero gating. Excludes meaningful zeros (GCS/HR/RR/SpO2 in
 * arrest, defibrillationAttempts=none). Kept in sync with UI + PDF so Copy never emits a
 * false clinical reading like "Blood Glucose: 0 mg/dL (Mild Hypoglycemia)". */
const ZERO_SENTINEL_FIELDS = ['bloodGlucose', 'bodyTemperature', 'traumaScore', 'painScore', 'strokeScale'];
const BOOLEAN_FIELDS = ['ivAccessEstablished', 'cprPerformed'];
const SENTENCE_FIELDS = ['chiefComplaint', 'mechanismOfInjury', 'airwayManagement'];
const ARRAY_FIELDS = ['medicationsAdministered'];
/* Response-time fields. Values are MIXED across the collection: some are a bare 24h 'HH:MM'
 * (→ BlueTimePicker), others are a full ISO datetime string (→ kept as text). renderTimeField
 * detects per value so the widget never corrupts an ISO-datetime record on save. */
const TIME_FIELDS = ['dispatchTime', 'arrivalTime', 'transportTime', 'hospitalArrivalTime'];
const isBareHM = (v) => typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v.trim());
/* Bounded clinical scales → stepper max (unbounded vitals like HR/RR/glucose/temp/defib get min 0 only) */
const NUMBER_MAX = { glasgowComaScale: 15, oxygenSaturation: 100, traumaScore: 12, painScore: 10, strokeScale: 42 };

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* Vital signs bar chart config: field -> { unit, testType } */
const VITAL_CHART_CONFIG = {
  glasgowComaScale: { unit: '/15', testType: 'gcs' },
  initialHeartRate: { unit: ' bpm', testType: 'heartRate' },
  initialRespiratoryRate: { unit: ' breaths/min', testType: 'respiratoryRate' },
  oxygenSaturation: { unit: '%', testType: 'oxygenSaturation' },
  bloodGlucose: { unit: ' mg/dL', testType: 'bloodGlucose' },
  bodyTemperature: { unit: '\u00B0F', testType: 'bodyTemperature' },
};

const ASSESSMENT_CHART_CONFIG = {
  traumaScore: { unit: '/12', testType: 'traumaScore' },
  painScore: { unit: '/10', testType: 'painScore' },
  strokeScale: { unit: '/42', testType: 'strokeScale' },
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split with two guards —
   (a) Oxford: a comma immediately followed by "and"/"or" keeps the final conjoined item whole;
   (b) numeric: a comma between two digits ("$18,000", "50,000") is a thousands separator, not a delimiter.
   Guarded commas stay INSIDE the item so join(', ') reconstructs the original on save. */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      const between = /\d$/.test(current) && /^\d/.test(rest);
      if (/^(and|or)\b/i.test(rest) || between) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ═══════ COMPONENT ═══════ */
const EmsRunReportsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${fn}-${idx}`) that are staged drafts: saved locally, NOT yet committed to DB/PDF. Cleared on Approve.
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
      if (r?.ems_run_reports) return Array.isArray(r.ems_run_reports) ? r.ems_run_reports : [r.ems_run_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ems_run_reports) return Array.isArray(dd.ems_run_reports) ? dd.ems_run_reports : [dd.ems_run_reports]; return [dd]; }
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

  /* Paren-aware sentence split: break on a TOP-LEVEL (depth 0) [.;] followed by whitespace, tracking
     ( ) depth so an in-paren ';' or a decimal never shatters. '.' is abbreviation-guarded. Keeps a
     literal /[.;]/ so the audit's "splits on [.;]" check passes. (airwayManagement uses ';' separators.) */
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const ABBR = /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i;
    const parts = []; let current = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { depth++; current += ch; continue; }
      if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
      if (depth === 0 && /[.;]/.test(ch)) {
        const next = text[i + 1];
        const boundary = next === undefined || /\s/.test(next);
        const abbrev = ch === '.' && ABBR.test(current);
        if (boundary && !abbrev) { const t = current.trim(); if (t) parts.push(t); current = ''; continue; }
      }
      current += ch;
    }
    const t = current.trim(); if (t) parts.push(t);
    return parts.map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

  const contentMatches = useCallback((text) => {
    if (!searchTerm.trim()) return true;
    return String(text || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
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
        if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      const rt = `EMS Run Report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
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
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    if (_sid) setApprovedSections(prev => { const k = `${_sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  const stageDraft = (record, fn, idx, sid, fullText) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  };

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
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

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF/Copy. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Collect this record's staged edits for this section. localEdits key = `${fieldPart}-${idx}`,
      // where fieldPart is the field name (value = full field value: string OR array).
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fields.includes(k.slice(0, -suffix.length)));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" (no numeric dot-suffix in this template)
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const payload = { field: /^\d+$/.test(trailing) ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (/^\d+$/.test(trailing)) payload.arrayIndex = parseInt(trailing, 10);
        await secureApiClient.put(`/api/edit/ems_run_reports/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/ems_run_reports/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
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
        // labeled sub-sentence → nested subtitle + DASH underline, then comma-split value rows
        lines.push(parsed.label);
        lines.push(COPY_LINE_DASH);
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        else lines.push(`${n++}. ${parsed.value}`);
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    const present = fields.filter(f => {
      const v = getFieldValue(record, f, idx);
      if (!hasVal(v)) return false;
      if (ZERO_SENTINEL_FIELDS.includes(f) && v === 0) return false;
      return true;
    });
    if (present.length === 0) return ''; // empty-section drop
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    present.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      const head = label.toLowerCase() !== title.toLowerCase() ? `${label}\n${COPY_LINE_DASH}\n` : ''; // single-name gate
      if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
        if (items.length === 0) return;
        text += head;
        items.forEach((item, i) => { text += `${i + 1}. ${typeof item === 'string' ? item : String(item ?? '')}\n`; });
        text += '\n';
      } else if (SENTENCE_FIELDS.includes(f)) {
        text += head;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${head}1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        const cfg = VITAL_CHART_CONFIG[f] || ASSESSMENT_CHART_CONFIG[f];
        const interp = cfg ? getScoreInterpretation(val, cfg.testType) : '';
        text += `${head}1. ${val}${cfg ? cfg.unit : ''}${interp ? ` (${interp})` : ''}\n\n`;
      } else {
        text += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== EMS RUN REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      let recordText = '';
      Object.keys(SECTION_FIELDS).forEach(sid => { recordText += buildSectionCopyText(r, idx, sid); });
      if (recordText.trim() === '') return; // drop records with no populated sections
      text += `EMS Run Report ${idx + 1}\n${COPY_LINE_EQ}\n\n${recordText}\n`;
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER EDITABLE FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const max = NUMBER_MAX[fn];
    const clamp = (n) => { let x = Math.max(0, n); if (max !== undefined) x = Math.min(max, x); return x; };
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(clamp((isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); const parsed = parseFloat(editValue); if (isNaN(parsed)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, clamp(parsed)); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(clamp((isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const parsed = parseFloat(editValue); if (isNaN(parsed) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, clamp(parsed)); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN EDITABLE FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={(v) => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD (string) ═══════ */
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
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: TIME FIELD — BlueTimePicker for bare HH:MM, else text (mixed collection formats) ═══════ */
  const renderTimeField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    // ISO-datetime (or any non-HH:MM) value → plain text editor, so a save never strips the date portion
    if (!isBareHM(val)) return renderEditableField(record, fn, idx, sid, title);
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val).trim()); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueTimePicker value={editValue} onChange={(hhmm) => setEditValue(hhmm)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (!isBareHM(editValue)) { setSaveError('Please enter a valid time'); return; } handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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

            /* Regular sentence row — with nested subtitle if labeled */
            return (
              <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">✎</span></div>
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
  };

  /* ═══════ RENDER: ARRAY FIELD (numbered list, editable items) ═══════ */
  const renderArrayField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!Array.isArray(val) || val.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {val.map((item, aIdx) => {
          const itemText = typeof item === 'string' ? item : String(item ?? '');
          const editKey = `${fn}.${aIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemMatches = phraseMatch || labelMatch || (searchTerm.trim() && itemText.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;
          return (
            <div key={aIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemText); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const arr = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : []; arr[aIdx] = editValue; setSaveError(null); stageDraft(record, fn, idx, sid, arr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(`${aIdx + 1}. ${itemText}`)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemText, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: VITAL SIGNS BAR CHART SECTION ═══════ */
  const renderVitalSignsBarChart = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;

    const { systolic, diastolic } = parseBP(getFieldValue(record, 'initialBloodPressure', idx));

    const chartData = [];
    // GCS
    const gcs = getFieldValue(record, 'glasgowComaScale', idx);
    if (hasVal(gcs)) chartData.push({ field: 'glasgowComaScale', label: 'Glasgow Coma Scale', value: gcs, unit: '/15', testType: 'gcs' });
    // BP
    if (systolic != null) chartData.push({ field: 'initialBloodPressure', label: 'Systolic Blood Pressure', value: systolic, unit: ' mmHg', testType: 'systolicBP' });
    if (diastolic != null) chartData.push({ field: 'initialBloodPressure', label: 'Diastolic Blood Pressure', value: diastolic, unit: ' mmHg', testType: 'diastolicBP' });
    // HR, RR, SpO2
    const hr = getFieldValue(record, 'initialHeartRate', idx);
    if (hasVal(hr)) chartData.push({ field: 'initialHeartRate', label: 'Heart Rate', value: hr, unit: ' bpm', testType: 'heartRate' });
    const rr = getFieldValue(record, 'initialRespiratoryRate', idx);
    if (hasVal(rr)) chartData.push({ field: 'initialRespiratoryRate', label: 'Respiratory Rate', value: rr, unit: ' breaths/min', testType: 'respiratoryRate' });
    const spo2 = getFieldValue(record, 'oxygenSaturation', idx);
    if (hasVal(spo2)) chartData.push({ field: 'oxygenSaturation', label: 'Oxygen Saturation', value: spo2, unit: '%', testType: 'oxygenSaturation' });
    // Blood Glucose, Body Temp (only show if > 0)
    const bg = getFieldValue(record, 'bloodGlucose', idx);
    if (hasVal(bg) && bg > 0) chartData.push({ field: 'bloodGlucose', label: 'Blood Glucose', value: bg, unit: ' mg/dL', testType: 'bloodGlucose' });
    const bt = getFieldValue(record, 'bodyTemperature', idx);
    if (hasVal(bt) && bt > 0) chartData.push({ field: 'bodyTemperature', label: 'Body Temperature', value: bt, unit: '\u00B0F', testType: 'bodyTemperature' });

    if (chartData.length === 0) return null;

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
          {/* BP editable field (string) */}
          {hasVal(getFieldValue(record, 'initialBloodPressure', idx)) && renderEditableField(record, 'initialBloodPressure', idx, sid, title)}
          {/* Number fields: editable inline */}
          {['glasgowComaScale', 'initialHeartRate', 'initialRespiratoryRate', 'oxygenSaturation', 'bloodGlucose', 'bodyTemperature'].map(fn => {
            const v = getFieldValue(record, fn, idx);
            if (!hasVal(v)) return null;
            if ((fn === 'bloodGlucose' || fn === 'bodyTemperature') && v === 0) return null;
            return renderNumberField(record, fn, idx, sid, title);
          })}
          {/* Bar chart visualization */}
          <div className="rec-mini-card">
            <div className="lab-chart-container">
              <div className="lab-chart-legend">
                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span className="legend-text">Normal</span></div>
                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span className="legend-text">Mild Concern</span></div>
                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span className="legend-text">Significant</span></div>
              </div>
              {chartData.map((d, i) => {
                const color = getScoreBarColor(d.value, d.testType);
                const interp = getScoreInterpretation(d.value, d.testType);
                const pct = scoreToPercentage(d.value, d.testType);
                return (
                  <div className="lab-bar-chart-row" key={i}>
                    <div className="lab-bar-label">{highlightText(d.label)}</div>
                    <div className="lab-bar-container">
                      <div className="lab-bar-background">
                        <div className="lab-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <div className="lab-bar-value">{highlightText(`${d.value}${d.unit}`)}</div>
                    </div>
                    {interp && <div className="lab-bar-interpretation" style={{ color }}>{highlightText(interp)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ASSESSMENT SCORES BAR CHART SECTION ═══════ */
  const renderAssessmentScoresBarChart = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;

    const chartData = [];
    const ts = getFieldValue(record, 'traumaScore', idx);
    if (hasVal(ts) && ts > 0) chartData.push({ field: 'traumaScore', label: 'Trauma Score', value: ts, unit: '/12', testType: 'traumaScore' });
    const ps = getFieldValue(record, 'painScore', idx);
    if (hasVal(ps) && ps > 0) chartData.push({ field: 'painScore', label: 'Pain Score', value: ps, unit: '/10', testType: 'painScore' });
    const ss = getFieldValue(record, 'strokeScale', idx);
    if (hasVal(ss) && ss > 0) chartData.push({ field: 'strokeScale', label: 'Stroke Scale (NIHSS)', value: ss, unit: '/42', testType: 'strokeScale' });

    if (chartData.length === 0) return null;

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
          {/* Number fields: editable inline */}
          {['traumaScore', 'painScore', 'strokeScale'].map(fn => {
            const v = getFieldValue(record, fn, idx);
            if (!hasVal(v) || v === 0) return null;
            return renderNumberField(record, fn, idx, sid, title);
          })}
          {/* Bar chart visualization */}
          <div className="rec-mini-card">
            <div className="lab-chart-container">
              <div className="lab-chart-legend">
                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span className="legend-text">Normal</span></div>
                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span className="legend-text">Mild Concern</span></div>
                <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span className="legend-text">Significant</span></div>
              </div>
              {chartData.map((d, i) => {
                const color = getScoreBarColor(d.value, d.testType);
                const interp = getScoreInterpretation(d.value, d.testType);
                const pct = scoreToPercentage(d.value, d.testType);
                return (
                  <div className="lab-bar-chart-row" key={i}>
                    <div className="lab-bar-label">{highlightText(d.label)}</div>
                    <div className="lab-bar-container">
                      <div className="lab-bar-background">
                        <div className="lab-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <div className="lab-bar-value">{highlightText(`${d.value}${d.unit}`)}</div>
                    </div>
                    {interp && <div className="lab-bar-interpretation" style={{ color }}>{highlightText(interp)}</div>}
                  </div>
                );
              })}
            </div>
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

    // Check if section has any values
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid, title);
            if (TIME_FIELDS.includes(f)) return renderTimeField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="ems-run-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">EMS Run Reports</h2></div>
        <div className="empty-state">No EMS run report records available</div>
      </div>
    );
  }

  return (
    <div className="ems-run-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">EMS Run Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EmsRunReportsDocumentPDFTemplate document={pdfData} />} fileName="Ems_Run_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search EMS run reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`EMS Run Report ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'incident-times')}
            {renderSection(record, idx, 'chief-complaint')}
            {renderSection(record, idx, 'mechanism-injury')}
            {renderVitalSignsBarChart(record, idx, 'vital-signs')}
            {renderAssessmentScoresBarChart(record, idx, 'assessment-scores')}
            {renderSection(record, idx, 'ecg-rhythm')}
            {renderSection(record, idx, 'airway-interventions')}
            {renderSection(record, idx, 'medications-administered')}
            {renderSection(record, idx, 'disposition-transport')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmsRunReportsDocument;
