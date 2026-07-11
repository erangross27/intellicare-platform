/**
 * DementiaEducationDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: dementia_education
 *
 * 10 Sections:
 *   1. clinical-overview: dementiaType, diseaseStage, caregiverType, fallRiskAssessment, advanceDirectiveStatus, wanderingBehavior (select), respiteCareNeeds, nutritionalStatus
 *   2. assessment-scores: mmseScore, mocsScore, cdrGlobalScore, npiScore, adlScore, iadlScore, caregiverBurdenScore (bar chart, display-only)
 *   3. education-topics: educationTopics[] (array)
 *   4. behavioral-symptoms: behavioralSymptoms[] (array)
 *   5. agitation-triggers: agitationTriggers[] (array)
 *   6. communication-strategies: communicationStrategies[] (array)
 *   7. environmental-modifications: environmentalModifications[] (array)
 *   8. sleep-disorders: sleepDisorders[] (array)
 *   9. non-pharm-interventions: nonPharmacologicalInterventions[] (array)
 *  10. cognitive-enhancers: cognitiveEnhancerMedications[] (array)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DementiaEducationDocumentPDFTemplate from '../pdf-templates/DementiaEducationPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DementiaEducationDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'clinical-overview': 'Clinical Overview',
  'assessment-scores': 'Assessment Scores',
  'education-topics': 'Education Topics',
  'behavioral-symptoms': 'Behavioral Symptoms',
  'agitation-triggers': 'Agitation Triggers',
  'communication-strategies': 'Communication Strategies',
  'environmental-modifications': 'Environmental Modifications',
  'sleep-disorders': 'Sleep Disorders',
  'non-pharm-interventions': 'Non-Pharmacological Interventions',
  'cognitive-enhancers': 'Cognitive Enhancer Medications',
};

const FIELD_LABELS = {
  dementiaType: 'Dementia Type',
  diseaseStage: 'Disease Stage',
  caregiverType: 'Caregiver Type',
  fallRiskAssessment: 'Fall Risk Assessment',
  advanceDirectiveStatus: 'Advance Directive Status',
  wanderingBehavior: 'Wandering Behavior',
  respiteCareNeeds: 'Respite Care Needs',
  nutritionalStatus: 'Nutritional Status',
  mmseScore: 'MMSE Score',
  mocsScore: 'MoCA Score',
  cdrGlobalScore: 'CDR Global Score',
  npiScore: 'NPI Score',
  adlScore: 'ADL Score',
  iadlScore: 'IADL Score',
  caregiverBurdenScore: 'Caregiver Burden Score',
  educationTopics: 'Education Topics',
  behavioralSymptoms: 'Behavioral Symptoms',
  agitationTriggers: 'Agitation Triggers',
  communicationStrategies: 'Communication Strategies',
  environmentalModifications: 'Environmental Modifications',
  sleepDisorders: 'Sleep Disorders',
  nonPharmacologicalInterventions: 'Non-Pharmacological Interventions',
  cognitiveEnhancerMedications: 'Cognitive Enhancer Medications',
};

const SECTION_FIELDS = {
  'clinical-overview': ['dementiaType', 'diseaseStage', 'caregiverType', 'fallRiskAssessment', 'advanceDirectiveStatus', 'wanderingBehavior', 'respiteCareNeeds', 'nutritionalStatus'],
  'assessment-scores': ['mmseScore', 'mocsScore', 'cdrGlobalScore', 'npiScore', 'adlScore', 'iadlScore', 'caregiverBurdenScore'],
  'education-topics': ['educationTopics'],
  'behavioral-symptoms': ['behavioralSymptoms'],
  'agitation-triggers': ['agitationTriggers'],
  'communication-strategies': ['communicationStrategies'],
  'environmental-modifications': ['environmentalModifications'],
  'sleep-disorders': ['sleepDisorders'],
  'non-pharm-interventions': ['nonPharmacologicalInterventions'],
  'cognitive-enhancers': ['cognitiveEnhancerMedications'],
};

const BOOLEAN_FIELDS = ['wanderingBehavior'];
const NUMBER_FIELDS = ['mmseScore', 'mocsScore', 'cdrGlobalScore', 'npiScore', 'adlScore', 'iadlScore', 'caregiverBurdenScore'];

/* Fixed-choice clinical scales → themed <select> (one-pass item 8); off-scale stored value stays selectable */
const ENUM_FIELDS = {
  dementiaType: ["Alzheimer's", 'Vascular', 'Lewy Body', 'Frontotemporal', 'Mixed', "Parkinson's Disease Dementia"],
  diseaseStage: ['Mild', 'Moderate', 'Severe'],
  caregiverType: ['Spouse', 'Adult Child', 'Other Family', 'Friend or Neighbor', 'Professional', 'None'],
  fallRiskAssessment: ['Low', 'Moderate', 'High'],
  advanceDirectiveStatus: ['Complete', 'In Progress', 'Not Started', 'Declined'],
  respiteCareNeeds: ['None', 'Occasional', 'Regular', 'Urgent'],
  nutritionalStatus: ['Well-Nourished', 'At Risk of Malnutrition', 'Malnourished'],
};
const enumOptionsWith = (options, current) => {
  const cur = String(current ?? '').trim();
  if (!cur || options.some(o => o.toLowerCase() === cur.toLowerCase())) return options;
  return [cur, ...options];
};

/* CDR® global score is the fixed 5-point clinical scale — stored as a NUMBER (0/0.5/1/2/3) */
const CDR_GLOBAL_NUM_OPTIONS = [
  { value: '0', label: '0 — Normal' },
  { value: '0.5', label: '0.5 — Very Mild Dementia' },
  { value: '1', label: '1 — Mild Dementia' },
  { value: '2', label: '2 — Moderate Dementia' },
  { value: '3', label: '3 — Severe Dementia' },
];

const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const ARRAY_SECTION_CONFIG = [
  { key: 'educationTopics', sid: 'education-topics' },
  { key: 'behavioralSymptoms', sid: 'behavioral-symptoms' },
  { key: 'agitationTriggers', sid: 'agitation-triggers' },
  { key: 'communicationStrategies', sid: 'communication-strategies' },
  { key: 'environmentalModifications', sid: 'environmental-modifications' },
  { key: 'sleepDisorders', sid: 'sleep-disorders' },
  { key: 'nonPharmacologicalInterventions', sid: 'non-pharm-interventions' },
  { key: 'cognitiveEnhancerMedications', sid: 'cognitive-enhancers' },
];

/* Score configs */
const SCORE_CONFIG = [
  { key: 'mmseScore', label: 'MMSE Score', max: 30 },
  { key: 'mocsScore', label: 'MoCA Score', max: 30 },
  { key: 'cdrGlobalScore', label: 'CDR Global Score', max: 3 },
  { key: 'npiScore', label: 'NPI Score', max: 144 },
  { key: 'adlScore', label: 'ADL Score', max: 6 },
  { key: 'iadlScore', label: 'IADL Score', max: 8 },
  { key: 'caregiverBurdenScore', label: 'Caregiver Burden Score', max: 88 },
];

const getScoreInterpretation = (key, value) => {
  switch (key) {
    case 'mmseScore': return value >= 24 ? { color: '#22c55e', text: 'Normal' } : value >= 18 ? { color: '#fbbf24', text: 'Mild' } : { color: '#ef4444', text: 'Severe' };
    case 'mocsScore': return value >= 26 ? { color: '#22c55e', text: 'Normal' } : value >= 18 ? { color: '#fbbf24', text: 'Mild' } : { color: '#ef4444', text: 'Severe' };
    case 'cdrGlobalScore': return value <= 0 ? { color: '#22c55e', text: 'Normal' } : value <= 1 ? { color: '#fbbf24', text: 'Mild' } : { color: '#ef4444', text: 'Severe' };
    case 'npiScore': return value <= 12 ? { color: '#22c55e', text: 'Minimal' } : value <= 36 ? { color: '#fbbf24', text: 'Moderate' } : { color: '#ef4444', text: 'Severe' };
    case 'adlScore': return value >= 5 ? { color: '#22c55e', text: 'Independent' } : value >= 3 ? { color: '#fbbf24', text: 'Some Help' } : { color: '#ef4444', text: 'Dependent' };
    case 'iadlScore': return value >= 6 ? { color: '#22c55e', text: 'Independent' } : value >= 4 ? { color: '#fbbf24', text: 'Some Help' } : { color: '#ef4444', text: 'Dependent' };
    case 'caregiverBurdenScore': return value <= 20 ? { color: '#22c55e', text: 'Minimal' } : value <= 40 ? { color: '#fbbf24', text: 'Mild' } : { color: '#ef4444', text: 'Severe' };
    default: return { color: '#94a3b8', text: '' };
  }
};

const scoreToPct = (value, max) => Math.min(100, Math.max(2, (value / max) * 100));

/* parseLabel: detect "Label: value" patterns — medical regex */
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

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'dementia_educationPendingEdits';
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
const DementiaEducationDocument = ({ document: docProp }) => {
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
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.dementia_education) return Array.isArray(r.dementia_education) ? r.dementia_education : [r.dementia_education];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dementia_education) return Array.isArray(dd.dementia_education) ? dd.dementia_education : [dd.dementia_education]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     fieldPart = "field" (scalar) or "field.arrayIndex" (array element). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (!record?._id) ? null : (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(trailing);
        if (isArrayElem) {
          const fn = fieldPart.slice(0, lastDot);
          const ai = parseInt(trailing, 10);
          const localKey = `${fn}-${idx}`;
          const base = nLocal[localKey] !== undefined
            ? nLocal[localKey]
            : [...(Array.isArray(record[fn]) ? record[fn] : [])];
          base[ai] = value;
          nLocal[localKey] = base;
          nPending[`${fn}-${idx}-a${ai}`] = true;
          nFields[`${fn}-${idx}-a${ai}`] = 'edited';
        } else {
          const fn = fieldPart;
          nLocal[`${fn}-${idx}`] = value;
          nPending[`${fn}-${idx}`] = true;
          nFields[`${fn}-${idx}`] = 'edited';
        }
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
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
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
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
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dementia Education ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined) {
            if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
            else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    const arrayKeys = new Set(ARRAY_SECTION_CONFIG.map(c => c.key));
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx && !arrayKeys.has(m[1])) {
          merged[m[1]] = localEdits[key];
        }
      });
      /* Merge array edits — but keep any pending (un-approved) array items OUT of the PDF. */
      ARRAY_SECTION_CONFIG.forEach(({ key }) => {
        const edited = getEffectiveArray(record, key, idx);
        const original = Array.isArray(record[key]) ? record[key] : [];
        const result = edited.map((item, ai) => (pendingEdits[`${key}-${idx}-a${ai}`] ? (original[ai] !== undefined ? original[ai] : item) : item));
        merged[key] = result;
      });
      return merged;
    });
  }, [filteredRecords, localEdits, getEffectiveArray, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // sid that owns a given field (to clear the right approve button on re-edit).
  const sidForField = useCallback((fn) => {
    for (const [sid, fields] of Object.entries(SECTION_FIELDS)) { if (fields.includes(fn)) return sid; }
    return null;
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;

    /* Numeric validation for NUMBER_FIELDS */
    if (NUMBER_FIELDS.includes(fn)) {
      const trimmed = String(saveVal).trim();
      if (isNaN(Number(trimmed))) {
        setSaveError('Please enter a valid number');
        return;
      }
      saveVal = Number(trimmed);
    }

    /* Boolean validation for BOOLEAN_FIELDS */
    if (BOOLEAN_FIELDS.includes(fn)) {
      const lower = String(saveVal).toLowerCase().trim();
      if (['yes', 'true'].includes(lower)) saveVal = true;
      else if (['no', 'false'].includes(lower)) saveVal = false;
      else { setSaveError('Please select Yes or No'); return; }
    }

    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section's approved flag so the button goes back to yellow Pending.
    const sid = _sid || sidForField(fn);
    if (sid) setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);

    setEditingField(null); setEditValue('');
  }, [editValue, safeId, sidForField]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const currentArr = [...(getEffectiveArray(record, fn, idx))];
    currentArr[arrayIndex] = editValue;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIndex}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIndex}`]: 'edited' }));
    const sid = sidForField(fn);
    if (sid) setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}.${arrayIndex}`] = editValue;
    writeDrafts(store);

    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray, sidForField]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Collect this section's pending edits (scalar "fn-idx" + array "fn-idx-a<n>").
      const committedKeys = [];
      for (const fn of fields) {
        const scalarKey = `${fn}-${idx}`;
        const localKey = `${fn}-${idx}`;
        // Array element edits for this field
        const arrayPendKeys = Object.keys(pendingEdits).filter(k => pendingEdits[k] && k.startsWith(`${fn}-${idx}-a`));
        if (arrayPendKeys.length > 0) {
          const arr = localEdits[localKey];
          for (const k of arrayPendKeys) {
            const ai = parseInt(k.slice(k.lastIndexOf('-a') + 2), 10);
            const value = Array.isArray(arr) ? arr[ai] : undefined;
            const resp = await secureApiClient.put(`/api/edit/dementia_education/${id}/edit`, { field: fn, value, arrayIndex: ai });
            if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
            committedKeys.push(k);
          }
        } else if (pendingEdits[scalarKey]) {
          const value = localEdits[localKey];
          const resp = await secureApiClient.put(`/api/edit/dementia_education/${id}/edit`, { field: fn, value });
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
          committedKeys.push(scalarKey);
        }
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/dementia_education/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        fields.forEach(fn => {
          delete store[id][fn];
          Object.keys(store[id]).forEach(fp => { if (fp.startsWith(`${fn}.`)) delete store[id][fp]; });
        });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[DementiaEducation] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

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
  const buildOverviewCopyText = useCallback((record, idx) => {
    let text = `Clinical Overview\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS['clinical-overview'];
    fields.forEach(f => {
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const label = FIELD_LABELS[f] || f;
      text += `${label}\n${COPY_LINE_DASH}\n1. ${fmtVal(val)}\n\n`;
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal]);

  const buildScoresCopyText = useCallback((record, idx) => {
    let text = `Assessment Scores\n${COPY_LINE_EQ}\n\n`;
    SCORE_CONFIG.forEach(s => {
      const val = getFieldValue(record, s.key, idx);
      if (!hasVal(val)) return;
      const numVal = Number(val);
      const interp = getScoreInterpretation(s.key, numVal);
      text += `${s.label}\n${COPY_LINE_DASH}\n1. ${numVal}/${s.max} (${interp.text})\n\n`;
    });
    return text;
  }, [getFieldValue, hasVal]);

  const buildArrayCopyText = useCallback((record, idx, fn, title) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (arr.length === 0) return '';
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    arr.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
    text += '\n';
    return text;
  }, [getEffectiveArray]);

  /* empty-section guard: title + '=' divider = 2 non-empty lines; require real content */
  const hasCopyContent = (t) => t.split('\n').filter(l => l.trim()).length > 2;

  const copyAllText = useCallback(async () => {
    let text = '=== DEMENTIA EDUCATION ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Dementia Education ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      const ov = buildOverviewCopyText(r, idx);
      if (hasCopyContent(ov)) text += ov;
      const sc = buildScoresCopyText(r, idx);
      if (hasCopyContent(sc)) text += sc;
      ARRAY_SECTION_CONFIG.forEach(({ key, sid }) => {
        text += buildArrayCopyText(r, idx, key, SECTION_TITLES[sid]);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildOverviewCopyText, buildScoresCopyText, buildArrayCopyText]);

  /* ═══════ RENDER: BOOLEAN SELECT FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(typeof val === 'boolean' ? (val ? 'yes' : 'no') : String(val).toLowerCase()); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
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
      </div>
    );
  };

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                {ENUM_FIELDS[fn] ? (
                  <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                    {enumOptionsWith(ENUM_FIELDS[fn], displayVal).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                )}
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
      </div>
    );
  };

  /* ═══════ RENDER: CLINICAL OVERVIEW SECTION ═══════ */
  const renderClinicalOverview = (record, idx) => {
    const sid = 'clinical-overview';
    if (!shouldShowSection(record, sid, idx)) return null;
    const fields = SECTION_FIELDS[sid];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Clinical Overview')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildOverviewCopyText(record, idx), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            return renderEditableField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ASSESSMENT SCORES BAR CHART (display-only, no editing) ═══════ */
  const renderAssessmentScores = (record, idx) => {
    const sid = 'assessment-scores';
    if (!shouldShowSection(record, sid, idx)) return null;
    const visibleScores = SCORE_CONFIG.filter(s => hasVal(getFieldValue(record, s.key, idx)));
    if (visibleScores.length === 0) return null;
    const copyId = `${sid}-${idx}`;

    /* Build unique legend */
    const legendItems = visibleScores.map(s => {
      const numVal = Number(getFieldValue(record, s.key, idx));
      return getScoreInterpretation(s.key, numVal);
    });
    const uniqueLegend = [];
    const seenColors = new Set();
    legendItems.forEach(item => { if (!seenColors.has(item.color)) { seenColors.add(item.color); uniqueLegend.push(item); } });

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Assessment Scores')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildScoresCopyText(record, idx), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          <div className="chart-container">
            <div className="chart-legend">
              {uniqueLegend.map((entry, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: entry.color }}></span>
                  <span>{entry.text}</span>
                </div>
              ))}
            </div>
            {visibleScores.map(s => {
              const val = Number(getFieldValue(record, s.key, idx));
              const pct = scoreToPct(val, s.max);
              const interp = getScoreInterpretation(s.key, val);
              const scoreKey = `${s.key}-${idx}`;
              const isEditing = editingField === scoreKey;
              const isModified = editedFields[scoreKey];

              if (searchTerm.trim() && !fieldMatches(record, s.key, idx) && !sectionTitleMatches(sid)) return null;

              return (
                <div key={s.key} className={`bar-row ${isModified ? 'bar-row-modified' : ''}`}>
                  <div className="bar-label">{highlightText(s.label)}</div>
                  <div className="bar-container">
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${pct}%`, backgroundColor: interp.color }}></div>
                    </div>
                    <div className="bar-value-edit editable-row" onClick={() => { if (!isEditing) { setEditingField(scoreKey); setEditValue(String(val)); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          {s.key === 'cdrGlobalScore' ? (
                            /* CDR global score = fixed 5-point clinical scale → dropdown (saved as a number) */
                            <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                              {CDR_GLOBAL_NUM_OPTIONS.some(o => o.value === editValue) ? null : <option value={editValue}>{editValue}</option>}
                              {CDR_GLOBAL_NUM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : (
                            <div className="num-stepper-row">
                              <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const n = parseFloat(editValue) || 0; setEditValue(String(Math.max(0, n - 1))); }}>&minus;</button>
                              <input type="number" step={stepFor(editValue)} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); handleSaveField(record, s.key, idx); } }} />
                              <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const n = parseFloat(editValue) || 0; setEditValue(String(Math.min(s.max, n + 1))); }}>+</button>
                            </div>
                          )}
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, s.key, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="bar-value" style={{ color: interp.color }}>{highlightText(`${val}/${s.max}`)}</span>
                          <span className="edit-indicator">✎</span>
                        </>
                      )}
                    </div>
                    <div className="bar-interpretation" style={{ color: interp.color }}>{interp.text}</div>
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY SECTION with per-item editing ═══════ */
  const renderArraySection = (record, idx, fn, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
    const arr = getEffectiveArray(record, fn, idx);
    if (arr.length === 0) return null;
    const copyId = `${sid}-${idx}`;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { let t = `${title}\n${'='.repeat(40)}\n\n`; arr.forEach((item, i) => { t += `${i + 1}. ${item}\n`; }); copySection(t, copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {arr.map((item, ai) => {
            const itemKey = `${fn}-${idx}-a${ai}`;
            const isEditing = editingField === itemKey;
            const badge = editedFields[itemKey];
            const itemMatches = phraseMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(String(item)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, ai); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="dementia-education-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dementia Education</h2></div>
        <div className="empty-state">No dementia education records available</div>
      </div>
    );
  }

  return (
    <div className="dementia-education-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dementia Education</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DementiaEducationDocumentPDFTemplate document={pdfData} />} fileName="Dementia_Education.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dementia education..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Dementia Education ${idx + 1}`)}</h3>
            </div>
            {renderClinicalOverview(record, idx)}
            {renderAssessmentScores(record, idx)}
            {ARRAY_SECTION_CONFIG.map(({ key, sid }) => renderArraySection(record, idx, key, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DementiaEducationDocument;
