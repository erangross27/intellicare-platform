/**
 * HematologyAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: hematology_assessment
 *
 * 12 Sections:
 *   1. session-info: date, provider, facility
 *   2. diagnosis: bloodDisorder, stagingClassification
 *   3. blood-smear: bloodSmear.rbcMorphology, bloodSmear.inclusions, bloodSmear.polychromasia, bloodSmear.interpretation
 *   4. hemoglobinopathy: hemoglobinopathy.electrophoresis (HbS, HbF, HbA2, HbA), hemoglobinopathy.sickling
 *   5. transfusion: transfusion.bloodType, transfusion.antibodyScreen, transfusion.reactions
 *   6. treatment-plan: treatmentPlan.immediateInterventions (painControl, hydration, oxygenation, monitoring)
 *   7. chemotherapy: chemotherapy[] (regimen, drugs[], schedule, intent)
 *   8. supportive-care: supportiveCare[], transfusionSupport, growthFactors[]
 *   9. transplant-trials: transplantEligibility, clinicalTrials[] (trialName, intervention, eligibility)
 *  10. prognosis: prognosis.shortTerm, longTerm, riskFactors[], protectiveFactors[]
 *  11. follow-up: followUp
 *  12. clinical-notes: assessment, plan
 *
 * Inline editing support for all ALLOWED_FIELDS
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import HematologyAssessmentDocumentPDFTemplate from '../pdf-templates/HematologyAssessmentDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './HematologyAssessmentDocument.css';

/* ═══════ CONSTANTS ═══════ */
const API_BASE = '/api/edit/hematology_assessment';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection).
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = dotted field path, e.g. "bloodSmear.rbcMorphology") */
const DRAFT_KEY = 'hematology_assessmentPendingEdits';
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
  'session-info': 'Session Information',
  'diagnosis': 'Diagnosis',
  'blood-smear': 'Blood Smear',
  'hemoglobinopathy': 'Hemoglobinopathy - Electrophoresis',
  'coagulation': 'Coagulation',
  'bone-marrow': 'Bone Marrow',
  'transfusion': 'Transfusion',
  'treatment-plan': 'Treatment Plan - Immediate Interventions',
  'chemotherapy': 'Chemotherapy/Disease-Modifying Therapy',
  'supportive-care': 'Supportive Care',
  'transplant-trials': 'Transplant & Clinical Trials',
  'prognosis': 'Prognosis',
  'follow-up': 'Follow Up',
  'clinical-notes': 'Clinical Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  bloodDisorder: 'Blood Disorder',
  stagingClassification: 'Staging/Classification',
  'bloodSmear.rbcMorphology': 'RBC Morphology',
  'bloodSmear.inclusions': 'Inclusions',
  'bloodSmear.polychromasia': 'Polychromasia',
  'bloodSmear.interpretation': 'Interpretation',
  'hemoglobinopathy.electrophoresis.HbS': 'HbS (Sickle)',
  'hemoglobinopathy.electrophoresis.HbF': 'HbF (Fetal)',
  'hemoglobinopathy.electrophoresis.HbA2': 'HbA2',
  'hemoglobinopathy.electrophoresis.HbA': 'HbA (Normal)',
  'hemoglobinopathy.sickling': 'Sickling',
  'transfusion.bloodType': 'Blood Type',
  'transfusion.antibodyScreen': 'Antibody Screen',
  'transfusion.reactions': 'Reactions',
  'treatmentPlan.immediateInterventions.painControl': 'Pain Control',
  'treatmentPlan.immediateInterventions.hydration': 'Hydration',
  'treatmentPlan.immediateInterventions.oxygenation': 'Oxygenation',
  'treatmentPlan.immediateInterventions.monitoring': 'Monitoring',
  supportiveCare: 'Supportive Care',
  transfusionSupport: 'Transfusion Support',
  growthFactors: 'Growth Factors',
  transplantEligibility: 'Transplant Eligibility',
  clinicalTrials: 'Clinical Trials',
  'prognosis.shortTerm': 'Short Term',
  'prognosis.longTerm': 'Long Term',
  'prognosis.riskFactors': 'Risk Factors',
  'prognosis.protectiveFactors': 'Protective Factors',
  followUp: 'Follow Up',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  coagulation: 'Coagulation',
  boneMarrow: 'Bone Marrow',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility'],
  'diagnosis': ['bloodDisorder', 'stagingClassification'],
  'blood-smear': ['bloodSmear.rbcMorphology', 'bloodSmear.inclusions', 'bloodSmear.polychromasia', 'bloodSmear.interpretation'],
  'hemoglobinopathy': ['hemoglobinopathy.electrophoresis.HbS', 'hemoglobinopathy.electrophoresis.HbF', 'hemoglobinopathy.electrophoresis.HbA2', 'hemoglobinopathy.electrophoresis.HbA', 'hemoglobinopathy.sickling'],
  'coagulation': ['coagulation'],
  'bone-marrow': ['boneMarrow'],
  'transfusion': ['transfusion.bloodType', 'transfusion.antibodyScreen', 'transfusion.reactions'],
  'treatment-plan': ['treatmentPlan.immediateInterventions.painControl', 'treatmentPlan.immediateInterventions.hydration', 'treatmentPlan.immediateInterventions.oxygenation', 'treatmentPlan.immediateInterventions.monitoring'],
  'chemotherapy': ['chemotherapy'],
  'supportive-care': ['supportiveCare', 'transfusionSupport', 'growthFactors'],
  'transplant-trials': ['transplantEligibility', 'clinicalTrials'],
  'prognosis': ['prognosis.shortTerm', 'prognosis.longTerm', 'prognosis.riskFactors', 'prognosis.protectiveFactors'],
  'results': ['results'],
  'follow-up': ['followUp'],
  'clinical-notes': ['findings', 'assessment', 'plan', 'recommendations', 'notes'],
};

const DATE_FIELDS = ['date'];

/* All long-text string fields that use splitBySentence + textarea editing */
const STRING_FIELDS = [
  'provider', 'facility', 'bloodDisorder', 'stagingClassification',
  'bloodSmear.rbcMorphology', 'bloodSmear.polychromasia', 'bloodSmear.interpretation',
  'hemoglobinopathy.electrophoresis.HbS', 'hemoglobinopathy.electrophoresis.HbF',
  'hemoglobinopathy.electrophoresis.HbA2', 'hemoglobinopathy.electrophoresis.HbA',
  'hemoglobinopathy.sickling',
  'transfusion.bloodType',
  'treatmentPlan.immediateInterventions.painControl',
  'treatmentPlan.immediateInterventions.hydration',
  'treatmentPlan.immediateInterventions.oxygenation',
  'treatmentPlan.immediateInterventions.monitoring',
  'transfusionSupport', 'transplantEligibility',
  'prognosis.shortTerm', 'prognosis.longTerm',
  'followUp', 'findings', 'assessment', 'plan', 'notes',
];

/* OBJECT fields → recursive editor (renderObjectField). results, coagulation, boneMarrow are free-form nested objects */
const OBJECT_FIELDS = ['coagulation', 'boneMarrow', 'results'];

/* ARRAY-of-OBJECT fields → object-array renderer */
const OBJECT_ARRAY_FIELDS = ['recommendations', 'growthFactors'];

/* ═══════ RECURSIVE OBJECT HELPERS (donor: PointOfCareUltrasoundHeartRateDocument) ═══════ */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
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

/* ═══════ UTILITY FUNCTIONS ═══════ */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

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

/* Resolve nested dot-path values: "bloodSmear.rbcMorphology" -> record.bloodSmear.rbcMorphology */
const resolvePath = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
};

/* ═══════ HEMOGLOBIN BAR CHART HELPERS ═══════ */
const extractPercentage = (value) => {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*%?$/);
  if (match) return parseFloat(match[1]);
  return null;
};

const getHemoglobinColor = (hbType) => {
  switch (hbType) {
    case 'HbA': return '#22c55e';
    case 'HbA2': return '#3b82f6';
    case 'HbF': return '#f59e0b';
    case 'HbS': return '#ef4444';
    default: return '#6b7280';
  }
};

const getHemoglobinInterpretation = (hbType, percentage) => {
  if (percentage === null) return '';
  switch (hbType) {
    case 'HbA':
      if (percentage >= 95) return 'Normal';
      if (percentage >= 50) return 'Reduced (possible trait)';
      if (percentage > 0) return 'Significantly reduced';
      return 'Absent';
    case 'HbA2':
      if (percentage >= 3.5 && percentage <= 7) return 'Elevated (possible thalassemia)';
      if (percentage >= 2 && percentage < 3.5) return 'Normal';
      if (percentage < 2) return 'Low';
      return 'Elevated';
    case 'HbF':
      if (percentage <= 1) return 'Normal';
      if (percentage <= 10) return 'Mildly elevated';
      if (percentage <= 30) return 'Elevated (possible HPFH or thalassemia)';
      return 'Significantly elevated';
    case 'HbS':
      if (percentage === 0) return 'Absent (normal)';
      if (percentage <= 45) return 'Sickle Cell Trait (HbAS)';
      if (percentage <= 95) return 'Sickle Cell Disease (HbSS)';
      return 'Severe sickle cell';
    default:
      return '';
  }
};

const prepareElectrophoresisChartData = (electrophoresis) => {
  if (!electrophoresis) return [];
  const charts = [];
  const hbTypes = [
    { key: 'HbS', label: 'HbS (Sickle)' },
    { key: 'HbA', label: 'HbA (Normal)' },
    { key: 'HbA2', label: 'HbA2' },
    { key: 'HbF', label: 'HbF (Fetal)' },
  ];
  hbTypes.forEach(({ key, label }) => {
    const rawValue = electrophoresis[key];
    if (!rawValue) return;
    const percentage = extractPercentage(rawValue);
    if (percentage === null) return;
    charts.push({
      key, label,
      rawValue: String(rawValue),
      percentage: Math.min(100, Math.max(0, percentage)),
      color: getHemoglobinColor(key),
      interpretation: getHemoglobinInterpretation(key, percentage),
    });
  });
  return charts;
};

/* ═══════ COMPONENT ═══════ */
const HematologyAssessmentDocument = ({ document: docProp }) => {
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
      if (r?.hematology_assessment) return Array.isArray(r.hematology_assessment) ? r.hematology_assessment : [r.hematology_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.hematology_assessment) return Array.isArray(dd.hematology_assessment) ? dd.hematology_assessment : [dd.hematology_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = safeIdOf(record);
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
  }, [records, safeIdOf]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    return resolvePath(record, fn);
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
        const strVal = Array.isArray(val) ? val.join(' ') : typeof val === 'object' ? JSON.stringify(val) : fmtVal(val);
        if (strVal.toLowerCase().includes(phrase)) return true;
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
      const strVal = Array.isArray(val) ? val.join(' ') : typeof val === 'object' ? JSON.stringify(val) : fmtVal(val);
      return strVal.toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Hematology Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val) {
            const strVal = Array.isArray(val) ? val.join(' ') : typeof val === 'object' ? JSON.stringify(val) : fmtVal(val);
            if (strVal.toLowerCase().includes(phrase)) return true;
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          /* Set nested path back on merged object */
          const parts = m[1].split('.');
          if (parts.length === 1) {
            merged[parts[0]] = localEdits[key];
          } else {
            let obj = merged;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
     fieldPart = the dotted field path; value = exactly what the backend expects for that field. */
  const stageDraft = useCallback((record, idx, fieldPart, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    // Re-edit after approval → drop any 'approved' flags for this record so the button returns to yellow
    setApprovedSections(prev => {
      const keys = Object.keys(prev).filter(k => k.endsWith(`-${idx}`));
      if (keys.length === 0) return prev;
      const next = { ...prev };
      keys.forEach(k => delete next[k]);
      return next;
    });
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    // Stage locally only — NOT written to MongoDB / NOT shown in PDF until Approve.
    stageDraft(record, idx, fn, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  /* save a nested OBJECT leaf by dot-path (e.g. coagulation.pt) — value stays a STRING/boolean.
     Stage as a DRAFT: keep the whole cloned ROOT object in localEdits (so getFieldValue/pdfData
     reconstruct the nested object) and stage it under fieldPart=rootField. Approve PUTs the root object. */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : resolvePath(record, rootField);
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) { if (!node[path[i]] || typeof node[path[i]] !== 'object') node[path[i]] = {}; node = node[path[i]]; }
    node[path[path.length - 1]] = newVal;
    stageDraft(record, idx, rootField, clone);
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId, localEdits, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, idx, fn, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(record, idx, fn, fullText);
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
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Collect this record's staged drafts whose field belongs to this section.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      const baseField = fieldPart.split('.')[0];
      return fields.some(f => f === fieldPart || f === baseField || f.split('.')[0] === baseField);
    });
    setSaving(true); setSaveError(null);
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // dotted field path or "field"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric
        if (/^\d+$/.test(trailing)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(trailing, 10); }
        const resp = await secureApiClient.put(`${API_BASE}/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`${API_BASE}/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { delete store[id][k.slice(0, -suffix.length)]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[HematologyAssessment] Approve error:', err); setSaveError('Approve failed.'); }
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

    /* Special sections handled individually */
    if (sid === 'chemotherapy') {
      const chemo = record.chemotherapy || [];
      chemo.forEach((c, ci) => {
        text += `  ${ci + 1}. ${c.regimen || 'Unknown Regimen'}\n`;
        if (c.drugs?.length) text += `     Drugs: ${c.drugs.join(', ')}\n`;
        if (c.schedule) text += `     Schedule: ${c.schedule}\n`;
        if (c.intent) text += `     Intent: ${c.intent}\n`;
      });
      text += '\n';
      return text;
    }
    if (sid === 'transplant-trials') {
      if (record.transplantEligibility) text += `Transplant Eligibility\n${record.transplantEligibility}\n\n`;
      const trials = record.clinicalTrials || [];
      if (trials.length > 0) {
        text += 'Clinical Trials\n';
        trials.forEach((t, ti) => {
          text += `  ${ti + 1}. ${t.trialName || 'Unknown Trial'}\n`;
          if (t.intervention) text += `     Intervention: ${t.intervention}\n`;
          if (t.eligibility) text += `     Eligibility: ${t.eligibility}\n`;
        });
      }
      text += '\n';
      return text;
    }
    if (sid === 'prognosis') {
      const p = record.prognosis;
      if (p) {
        if (p.shortTerm) text += `Short Term\n${p.shortTerm}\n\n`;
        if (p.longTerm) text += `Long Term\n${p.longTerm}\n\n`;
        if (p.riskFactors?.length) { text += 'Risk Factors\n'; p.riskFactors.forEach((rf, i) => { text += `  ${i + 1}. ${rf}\n`; }); text += '\n'; }
        if (p.protectiveFactors?.length) { text += 'Protective Factors\n'; p.protectiveFactors.forEach((pf, i) => { text += `  ${i + 1}. ${pf}\n`; }); text += '\n'; }
      }
      return text;
    }
    if (sid === 'supportive-care') {
      const sc = record.supportiveCare || [];
      if (sc.length > 0) { text += 'Supportive Care\n'; sc.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; }); text += '\n'; }
      if (record.transfusionSupport) text += `Transfusion Support\n${record.transfusionSupport}\n\n`;
      const gf = record.growthFactors || [];
      if (gf.length > 0) { text += 'Growth Factors\n'; gf.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; }); text += '\n'; }
      return text;
    }

    /* object → indented copy lines (recursive) */
    const objectCopyLines = (lbl, value, indent) => {
      const pad = '  '.repeat(indent); const out = [];
      if (isEmptyDeep(value)) return out;
      if (isScalar(value)) { out.push(`${pad}${lbl ? lbl + ': ' : ''}${fmtScalar(value)}`); return out; }
      if (lbl) out.push(`${pad}${lbl}:`);
      Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (lbl ? 1 : 0))));
      return out;
    };

    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val.filter(it => !isEmptyDeep(it)) : [];
        if (arr.length) {
          text += `${label}\n`;
          arr.forEach((it, i) => {
            const primaryKey = it.recommendation !== undefined ? 'recommendation' : (it.agent !== undefined ? 'agent' : Object.keys(it)[0]);
            text += `  ${i + 1}. ${fmtScalar(it[primaryKey])}\n`;
            Object.entries(it).filter(([k, v]) => k !== primaryKey && !isEmptyDeep(v)).forEach(([k, v]) => { text += `     ${humanizeKey(k)}: ${fmtScalar(v)}\n`; });
          });
          text += '\n';
        }
      } else if (OBJECT_FIELDS.includes(f) || (typeof val === 'object' && !Array.isArray(val))) {
        text += `${label}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 1).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else if (Array.isArray(val)) {
        text += `${label}\n${val.join(', ')}\n\n`;
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
    let text = '=== HEMATOLOGY ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Hematology Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageDraft(record, idx, fn, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageDraft(record, idx, fn, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ═══════ RENDER: ARRAY OF STRINGS ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || !Array.isArray(val) || val.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {val.map((item, itemIdx) => {
          const itemKey = `${fn}-${idx}-item${itemIdx}`;
          const isEditing = editingField === itemKey;
          const isModified = editedFields[itemKey];
          const itemStr = String(item);
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections && !itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const newArr = [...val]; newArr[itemIdx] = editValue.trim(); stageDraft(record, idx, fn, newArr); setEditedFields(prev => ({ ...prev, [itemKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; boolean -> Yes/No select, number+unit -> number input, "4/5" stays text) ═══════ */
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
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>−</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
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
                  if (isBool) {
                    newVal = editValue === 'yes';
                  } else if (ratio) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = `${n}/${ratio.denom}`;
                  } else if (nu) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n);
                  } else {
                    newVal = editValue.trim();
                  }
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

  /* ═══════ RENDER: OBJECT NODE (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
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

  /* ═══════ RENDER: OBJECT FIELD (recursive; coagulation, boneMarrow, results, transfusion.antibodyScreen) ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val) || Array.isArray(val)) return null;
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

  /* ═══════ RENDER: OBJECT-ARRAY FIELD (recommendations: {recommendation,date}; growthFactors: {agent,indication,dosing}) ═══════ */
  const renderObjectArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(it => !isEmptyDeep(it)) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phrase = searchTerm.toLowerCase().trim();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(phrase);

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const itemKey = `${fn}-${idx}-o${itemIdx}`;
          /* primary display key: recommendation / agent / trialName fallback */
          const primaryKey = item.recommendation !== undefined ? 'recommendation' : (item.agent !== undefined ? 'agent' : Object.keys(item)[0]);
          const heading = fmtScalar(item[primaryKey]) || `${humanizeKey(fn)} ${itemIdx + 1}`;
          const subEntries = Object.entries(item).filter(([k, v]) => k !== primaryKey && !isEmptyDeep(v));
          const itemText = Object.values(item).map(v => fmtScalar(v)).join(' ').toLowerCase();
          if (searchTerm.trim() && !phraseMatch && !labelMatch && !itemText.includes(phrase)) return null;
          const headEditing = editingField === itemKey;
          const headBadge = editedFields[itemKey];
          return (
            <div key={itemIdx} className="nested-mini-card" style={{ marginTop: itemIdx > 0 ? 8 : 0 }}>
              <div className={`numbered-row ${headBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!headEditing) { setEditingField(itemKey); setEditValue(fmtScalar(item[primaryKey])); setSaveError(null); } }}>
                {headEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => {
                        e.stopPropagation();
                        const id2 = safeId(record); if (!id2) return;
                        const curArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                        const trimmed = editValue.trim();
                        const newArr = curArr.map((r, i) => i === itemIdx ? { ...r, [primaryKey]: trimmed } : { ...r });
                        stageDraft(record, idx, fn, newArr); setEditedFields(prev => ({ ...prev, [itemKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null);
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(heading)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(heading, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {headBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              {subEntries.map(([k, v]) => {
                const subKey = `${fn}-${idx}-o${itemIdx}-${k}`;
                const subEditing = editingField === subKey;
                const subBadge = editedFields[subKey];
                const subStr = fmtScalar(v);
                return (
                  <div key={k}>
                    <div className={`numbered-row ${subBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!subEditing) { setEditingField(subKey); setEditValue(subStr); setSaveError(null); } }}>
                      {subEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              const id2 = safeId(record); if (!id2) return;
                              const curArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                              const trimmed = editValue.trim();
                              const newArr = curArr.map((r, i) => i === itemIdx ? { ...r, [k]: trimmed } : { ...r });
                              stageDraft(record, idx, fn, newArr); setEditedFields(prev => ({ ...prev, [subKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null);
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-subtitle">{highlightText(humanizeKey(k))}</span><span className="content-value">{highlightText(subStr)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[subKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(k)}: ${subStr}`, subKey); }}>{copiedItems[subKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {subBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: HEMOGLOBINOPATHY BAR CHART SECTION ═══════ */
  const renderHemoglobinopathySection = (record, idx) => {
    const sid = 'hemoglobinopathy';
    if (!shouldShowSection(record, sid)) return null;
    const electrophoresis = record.hemoglobinopathy?.electrophoresis;
    const sickling = getFieldValue(record, 'hemoglobinopathy.sickling', idx);
    const chartData = prepareElectrophoresisChartData(electrophoresis);
    const hasChartData = chartData.length > 0;
    const hasSickling = hasVal(sickling);
    if (!hasChartData && !hasSickling && !electrophoresis) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `${SECTION_TITLES[sid]}\n${'='.repeat(40)}\n\n`;
                if (electrophoresis) {
                  if (electrophoresis.HbS) text += `HbS (Sickle): ${electrophoresis.HbS}\n`;
                  if (electrophoresis.HbA) text += `HbA (Normal): ${electrophoresis.HbA}\n`;
                  if (electrophoresis.HbA2) text += `HbA2: ${electrophoresis.HbA2}\n`;
                  if (electrophoresis.HbF) text += `HbF (Fetal): ${electrophoresis.HbF}\n`;
                }
                if (hasSickling) text += `\nSickling: ${fmtVal(sickling)}\n`;
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>

          {/* Bar Chart Visualization */}
          {hasChartData && (
            <div className="chart-section">
              <div className="chart-container">
                <div className="chart-legend">
                  <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span>HbA (Normal)</span></div>
                  <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span>HbA2</span></div>
                  <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#f59e0b' }} /><span>HbF (Fetal)</span></div>
                  <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span>HbS (Sickle)</span></div>
                </div>
                {chartData.map((chart) => (
                  <div key={chart.key} className="bar-chart-row">
                    <div className="bar-label">{highlightText(chart.label)}</div>
                    <div className="bar-category-value" style={{ color: chart.color }}>{highlightText(chart.rawValue)}</div>
                    <div className="bar-container">
                      <div className="bar-background">
                        <div className="bar-fill" style={{ width: `${chart.percentage}%`, backgroundColor: chart.color }} />
                      </div>
                    </div>
                    <div className="bar-scale">
                      <span className="scale-item" style={{ left: '0%' }}>0%</span>
                      <span className="scale-item" style={{ left: '25%' }}>25%</span>
                      <span className="scale-item" style={{ left: '50%' }}>50%</span>
                      <span className="scale-item" style={{ left: '75%' }}>75%</span>
                      <span className="scale-item" style={{ left: '100%' }}>100%</span>
                    </div>
                    {chart.interpretation && <div className="bar-interpretation" style={{ color: chart.color }}>{highlightText(chart.interpretation)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Electrophoresis values as editable fields (when no chart data, show raw values) */}
          {!hasChartData && electrophoresis && (
            <>
              {['hemoglobinopathy.electrophoresis.HbS', 'hemoglobinopathy.electrophoresis.HbA', 'hemoglobinopathy.electrophoresis.HbA2', 'hemoglobinopathy.electrophoresis.HbF'].map(f => renderStringField(record, f, idx, sid))}
            </>
          )}

          {/* Sickling field */}
          {hasSickling && renderStringField(record, 'hemoglobinopathy.sickling', idx, sid)}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: CHEMOTHERAPY SECTION ═══════ */
  const renderChemotherapySection = (record, idx) => {
    const sid = 'chemotherapy';
    const chemo = record.chemotherapy;
    if (!chemo || !Array.isArray(chemo) || chemo.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {chemo.map((c, cIdx) => {
            const cKey = `chemo-${idx}-${cIdx}`;
            if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)) {
              const cText = [c.regimen, c.schedule, c.intent, ...(c.drugs || [])].filter(Boolean).join(' ').toLowerCase();
              if (!cText.includes(searchTerm.toLowerCase().trim())) return null;
            }
            return (
              <div key={cIdx} className="rec-mini-card" style={{ marginTop: cIdx > 0 ? 8 : 0 }}>
                <div className="nested-subtitle">{highlightText(c.regimen || `Therapy ${cIdx + 1}`)}</div>
                {c.drugs?.length > 0 && (
                  <div className="numbered-row">
                    <div className="row-content">
                      <span className="content-subtitle">{highlightText('Drugs')}</span>
                      <span className="content-value">{highlightText(c.drugs.join(', '))}</span>
                    </div>
                    <button className={`copy-btn ${copiedItems[`${cKey}-drugs`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Drugs: ${c.drugs.join(', ')}`, `${cKey}-drugs`); }}>{copiedItems[`${cKey}-drugs`] ? 'Copied!' : 'Copy'}</button>
                  </div>
                )}
                {c.schedule && (
                  <div className="numbered-row">
                    <div className="row-content">
                      <span className="content-subtitle">{highlightText('Schedule')}</span>
                      <span className="content-value">{highlightText(c.schedule)}</span>
                    </div>
                    <button className={`copy-btn ${copiedItems[`${cKey}-sched`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Schedule: ${c.schedule}`, `${cKey}-sched`); }}>{copiedItems[`${cKey}-sched`] ? 'Copied!' : 'Copy'}</button>
                  </div>
                )}
                {c.intent && (
                  <div className="numbered-row">
                    <div className="row-content">
                      <span className="content-subtitle">{highlightText('Intent')}</span>
                      <span className="content-value">{highlightText(c.intent)}</span>
                    </div>
                    <button className={`copy-btn ${copiedItems[`${cKey}-intent`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Intent: ${c.intent}`, `${cKey}-intent`); }}>{copiedItems[`${cKey}-intent`] ? 'Copied!' : 'Copy'}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: CLINICAL TRIALS (within transplant-trials section) ═══════ */
  const renderClinicalTrials = (record, idx) => {
    const trials = record.clinicalTrials;
    if (!trials || !Array.isArray(trials) || trials.length === 0) return null;

    return trials.map((trial, tIdx) => {
      const tKey = `trial-${idx}-${tIdx}`;
      if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches('transplant-trials')) {
        const tText = [trial.trialName, trial.intervention, trial.eligibility].filter(Boolean).join(' ').toLowerCase();
        if (!tText.includes(searchTerm.toLowerCase().trim())) return null;
      }
      return (
        <div key={tIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
          <div className="nested-subtitle">{highlightText(trial.trialName || `Trial ${tIdx + 1}`)}</div>
          {trial.intervention && (
            <div className="numbered-row">
              <div className="row-content">
                <span className="content-subtitle">{highlightText('Intervention')}</span>
                <span className="content-value">{highlightText(trial.intervention)}</span>
              </div>
              <button className={`copy-btn ${copiedItems[`${tKey}-interv`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Intervention: ${trial.intervention}`, `${tKey}-interv`); }}>{copiedItems[`${tKey}-interv`] ? 'Copied!' : 'Copy'}</button>
            </div>
          )}
          {trial.eligibility && (
            <div className="numbered-row">
              <div className="row-content">
                <span className="content-subtitle">{highlightText('Eligibility')}</span>
                <span className="content-value">{highlightText(trial.eligibility)}</span>
              </div>
              <button className={`copy-btn ${copiedItems[`${tKey}-elig`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Eligibility: ${trial.eligibility}`, `${tKey}-elig`); }}>{copiedItems[`${tKey}-elig`] ? 'Copied!' : 'Copy'}</button>
            </div>
          )}
        </div>
      );
    });
  };

  /* ═══════ RENDER: PROGNOSIS SECTION ═══════ */
  const renderPrognosisSection = (record, idx) => {
    const sid = 'prognosis';
    const p = record.prognosis;
    if (!p) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>

          {/* Short Term */}
          {hasVal(p.shortTerm) && renderStringField(record, 'prognosis.shortTerm', idx, sid)}
          {/* Long Term */}
          {hasVal(p.longTerm) && renderStringField(record, 'prognosis.longTerm', idx, sid)}

          {/* Risk Factors */}
          {p.riskFactors?.length > 0 && (
            <div className="rec-mini-card">
              <div className="nested-subtitle">{highlightText('Risk Factors')}</div>
              {p.riskFactors.map((rf, rfIdx) => {
                const rfKey = `riskfactor-${idx}-${rfIdx}`;
                if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !rf.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
                return (
                  <div key={rfIdx} className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(rf)}</span></div>
                    <button className={`copy-btn ${copiedItems[rfKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(rf, rfKey); }}>{copiedItems[rfKey] ? 'Copied!' : 'Copy'}</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Protective Factors */}
          {p.protectiveFactors?.length > 0 && (
            <div className="rec-mini-card">
              <div className="nested-subtitle">{highlightText('Protective Factors')}</div>
              {p.protectiveFactors.map((pf, pfIdx) => {
                const pfKey = `protfactor-${idx}-${pfIdx}`;
                if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !pf.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
                return (
                  <div key={pfIdx} className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(pf)}</span></div>
                    <button className={`copy-btn ${copiedItems[pfKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(pf, pfKey); }}>{copiedItems[pfKey] ? 'Copied!' : 'Copy'}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    /* Custom sections handled separately */
    if (sid === 'hemoglobinopathy') return renderHemoglobinopathySection(record, idx);
    if (sid === 'chemotherapy') return renderChemotherapySection(record, idx);
    if (sid === 'prognosis') return renderPrognosisSection(record, idx);

    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    /* Transplant-trials: mix of editable string + array of objects */
    if (sid === 'transplant-trials') {
      const hasTransplant = hasVal(record.transplantEligibility);
      const hasTrials = record.clinicalTrials?.length > 0;
      if (!hasTransplant && !hasTrials) return null;
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
            {hasTransplant && renderStringField(record, 'transplantEligibility', idx, sid)}
            {hasTrials && renderClinicalTrials(record, idx)}
          </div>
        </div>
      );
    }

    /* Supportive-care: arrays + string */
    if (sid === 'supportive-care') {
      const hasSC = record.supportiveCare?.length > 0;
      const hasTS = hasVal(record.transfusionSupport);
      const hasGF = record.growthFactors?.length > 0;
      if (!hasSC && !hasTS && !hasGF) return null;
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
            {hasSC && renderArrayField(record, 'supportiveCare', idx, sid)}
            {hasTS && renderStringField(record, 'transfusionSupport', idx, sid)}
            {hasGF && renderObjectArrayField(record, 'growthFactors', idx, sid)}
          </div>
        </div>
      );
    }

    /* Transfusion: bloodType (string), antibodyScreen (object), reactions (array) */
    if (sid === 'transfusion') {
      const bt = getFieldValue(record, 'transfusion.bloodType', idx);
      const as = getFieldValue(record, 'transfusion.antibodyScreen', idx);
      const rx = getFieldValue(record, 'transfusion.reactions', idx);
      if (!hasVal(bt) && !hasVal(as) && !hasVal(rx)) return null;
      const copyId = `${sid}-${idx}`;
      return (
        <div key={sid} className="section">
          <div className="mini-cards-container">
            <div className="section-header">
              <h4 className="section-title">{highlightText(title)}</h4>
              <div className="header-right-actions">
                <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                  let text = `${title}\n${'='.repeat(40)}\n\n`;
                  if (hasVal(bt)) text += `Blood Type: ${fmtVal(bt)}\n`;
                  if (hasVal(as)) text += `Antibody Screen: ${typeof as === 'object' ? JSON.stringify(as) : fmtVal(as)}\n`;
                  if (hasVal(rx) && Array.isArray(rx)) text += `Reactions: ${rx.join(', ')}\n`;
                  copySection(text, copyId);
                }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                {renderApproveButton(record, sid, idx)}
              </div>
            </div>
            {hasVal(bt) && renderStringField(record, 'transfusion.bloodType', idx, sid)}
            {hasVal(as) && renderObjectField(record, 'transfusion.antibodyScreen', idx, sid)}
            {hasVal(rx) && Array.isArray(rx) && renderArrayField(record, 'transfusion.reactions', idx, sid)}
          </div>
        </div>
      );
    }

    /* Default: standard flat-field sections */
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
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderObjectArrayField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            const val = getFieldValue(record, f, idx);
            if (Array.isArray(val)) return renderArrayField(record, f, idx, sid);
            if (typeof val === 'object' && val !== null) return renderObjectField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="hematology-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Hematology Assessment</h2></div>
        <div className="empty-state">No hematology assessment records available</div>
      </div>
    );
  }

  return (
    <div className="hematology-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Hematology Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<HematologyAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Hematology_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search hematology assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Hematology Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'diagnosis')}
            {renderSection(record, idx, 'blood-smear')}
            {renderSection(record, idx, 'hemoglobinopathy')}
            {renderSection(record, idx, 'coagulation')}
            {renderSection(record, idx, 'bone-marrow')}
            {renderSection(record, idx, 'transfusion')}
            {renderSection(record, idx, 'treatment-plan')}
            {renderSection(record, idx, 'chemotherapy')}
            {renderSection(record, idx, 'supportive-care')}
            {renderSection(record, idx, 'transplant-trials')}
            {renderSection(record, idx, 'prognosis')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'follow-up')}
            {renderSection(record, idx, 'clinical-notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HematologyAssessmentDocument;
