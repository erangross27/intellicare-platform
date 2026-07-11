/**
 * DiabetesEducatorDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: diabetes_educator
 *
 * 14 Sections:
 *   1. session-info: date (date picker), provider, facility, sessionType
 *   2. diabetes-overview: diabetesType, diagnosisDate (date), currentA1c (num), targetA1c (num)
 *   3. medications: currentMedications[] (string array)
 *   4. insulin-regimen: insulinRegimen object { basal: {type, dose, timing}, bolus: {type, dosing} }
 *   5. glucose-targets: bloodGlucoseTargets object {fasting, preMeal, postMeal}, selfMonitoringFrequency (sentence)
 *   6. hypoglycemia: hypoglycemiaHistory (sentence), hypoglycemiaTreatment (sentence)
 *   7. nutrition: carbohydrateCounting (sentence), mealPlanType, nutritionGoals[] (string array)
 *   8. physical-activity: physicalActivityPlan (sentence)
 *   9. foot-care: footExamPerformed (boolean), footCareKnowledge (sentence)
 *   10. complications: complicationsScreening object {retinopathy, nephropathy, neuropathy}
 *   11. psychosocial: psychosocialBarriers[] (string array)
 *   12. technology: technologyUsed[] (string array)
 *   13. sick-day: sickDayManagement (sentence)
 *   14. next-steps: nextEducationTopic (comma-split string)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DiabetesEducatorDocumentPDFTemplate from '../pdf-templates/DiabetesEducatorDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './DiabetesEducatorDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits key minus the
   trailing "-<idx>", i.e. "field", "object.sub.prop", or "arrayField.arrayIndex"). */
const DRAFT_KEY = 'diabetes_educatorPendingEdits';
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
  'session-info': 'Session Information',
  'diabetes-overview': 'Diabetes Overview',
  'medications': 'Current Medications',
  'insulin-regimen': 'Insulin Regimen',
  'glucose-targets': 'Glucose Targets & Monitoring',
  'hypoglycemia': 'Hypoglycemia',
  'nutrition': 'Nutrition',
  'physical-activity': 'Physical Activity',
  'foot-care': 'Foot Care',
  'complications': 'Complications Screening',
  'psychosocial': 'Psychosocial Barriers',
  'technology': 'Technology',
  'sick-day': 'Sick Day Management',
  'next-steps': 'Next Steps',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  sessionType: 'Session Type',
  diabetesType: 'Diabetes Type',
  diagnosisDate: 'Diagnosis Date',
  currentA1c: 'Current A1c',
  targetA1c: 'Target A1c',
  currentMedications: 'Current Medications',
  'insulinRegimen.basal.type': 'Basal Type',
  'insulinRegimen.basal.dose': 'Basal Dose',
  'insulinRegimen.basal.timing': 'Basal Timing',
  'insulinRegimen.bolus.type': 'Bolus Type',
  'insulinRegimen.bolus.dosing': 'Bolus Dosing',
  'bloodGlucoseTargets.fasting': 'Fasting Target',
  'bloodGlucoseTargets.preMeal': 'Pre-Meal Target',
  'bloodGlucoseTargets.postMeal': 'Post-Meal Target',
  selfMonitoringFrequency: 'Self-Monitoring Frequency',
  hypoglycemiaHistory: 'Hypoglycemia History',
  hypoglycemiaTreatment: 'Hypoglycemia Treatment',
  carbohydrateCounting: 'Carbohydrate Counting',
  mealPlanType: 'Meal Plan Type',
  nutritionGoals: 'Nutrition Goals',
  physicalActivityPlan: 'Physical Activity Plan',
  footExamPerformed: 'Foot Exam Performed',
  footCareKnowledge: 'Foot Care Knowledge',
  'complicationsScreening.retinopathy': 'Retinopathy',
  'complicationsScreening.nephropathy': 'Nephropathy',
  'complicationsScreening.neuropathy': 'Neuropathy',
  psychosocialBarriers: 'Psychosocial Barriers',
  technologyUsed: 'Technology Used',
  sickDayManagement: 'Sick Day Management',
  nextEducationTopic: 'Next Education Topic',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'sessionType'],
  'diabetes-overview': ['diabetesType', 'diagnosisDate', 'currentA1c', 'targetA1c'],
  'medications': ['currentMedications'],
  'insulin-regimen': ['insulinRegimen.basal.type', 'insulinRegimen.basal.dose', 'insulinRegimen.basal.timing', 'insulinRegimen.bolus.type', 'insulinRegimen.bolus.dosing'],
  'glucose-targets': ['bloodGlucoseTargets.fasting', 'bloodGlucoseTargets.preMeal', 'bloodGlucoseTargets.postMeal', 'selfMonitoringFrequency'],
  'hypoglycemia': ['hypoglycemiaHistory', 'hypoglycemiaTreatment'],
  'nutrition': ['carbohydrateCounting', 'mealPlanType', 'nutritionGoals'],
  'physical-activity': ['physicalActivityPlan'],
  'foot-care': ['footExamPerformed', 'footCareKnowledge'],
  'complications': ['complicationsScreening.retinopathy', 'complicationsScreening.nephropathy', 'complicationsScreening.neuropathy'],
  'psychosocial': ['psychosocialBarriers'],
  'technology': ['technologyUsed'],
  'sick-day': ['sickDayManagement'],
  'next-steps': ['nextEducationTopic'],
};

const DATE_FIELDS = ['date', 'diagnosisDate'];
const NUMBER_FIELDS = ['currentA1c', 'targetA1c'];
const BOOLEAN_FIELDS = ['footExamPerformed'];
const ARRAY_FIELDS = ['currentMedications', 'nutritionGoals', 'psychosocialBarriers', 'technologyUsed'];
const SENTENCE_FIELDS = ['selfMonitoringFrequency', 'hypoglycemiaHistory', 'hypoglycemiaTreatment', 'carbohydrateCounting', 'physicalActivityPlan', 'footCareKnowledge', 'sickDayManagement'];
const COMMA_SPLIT_FIELDS = ['nextEducationTopic'];
const OBJECT_DOT_FIELDS = [
  'insulinRegimen.basal.type', 'insulinRegimen.basal.dose', 'insulinRegimen.basal.timing',
  'insulinRegimen.bolus.type', 'insulinRegimen.bolus.dosing',
  'bloodGlucoseTargets.fasting', 'bloodGlucoseTargets.preMeal', 'bloodGlucoseTargets.postMeal',
  'complicationsScreening.retinopathy', 'complicationsScreening.nephropathy', 'complicationsScreening.neuropathy',
];

/* Dynamic-key objects whose subfields vary by record. Subfield dot-paths are
   derived from the actual record at render time (NOT a hardcoded key list), so
   keys like dayTarget/nightTarget/TIR or cardiovascular are never dropped. */
const DYNAMIC_OBJECT_ROOTS = ['bloodGlucoseTargets', 'complicationsScreening'];

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* Known fixed-choice scales → full-scale dropdowns; off-list stored values stay selectable */
const ENUM_FIELDS = {
  sessionType: ['Initial', 'Follow-up', 'Annual Assessment', 'Group'],
  diabetesType: ['Type 1', 'Type 2', 'Gestational', 'Prediabetes', 'LADA', 'MODY'],
  mealPlanType: ['Carb Counting', 'Plate Method', 'Exchange System', 'Consistent Carbohydrate'],
};
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

/* humanizeKey: 'dayTarget' -> 'Day Target', 'TIR' -> 'TIR', 'postMeal' -> 'Post-Meal' */
const humanizeKey = (key) => {
  if (!key) return '';
  if (key === key.toUpperCase()) return key; // acronyms (TIR, UACR)
  const spaced = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.replace(/\b\w/g, c => c.toUpperCase());
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const DiabetesEducatorDocument = ({ document: docProp }) => {
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
      if (r?.diabetes_educator) return Array.isArray(r.diabetes_educator) ? r.diabetes_educator : [r.diabetes_educator];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_educator) return Array.isArray(dd.diabetes_educator) ? dd.diabetes_educator : [dd.diabetes_educator]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Re-applies localEdits + pendingEdits and the edited/sentence markers. The fieldPart trailing dot
     segment decides whether the staged key is an array element (numeric) or a field/dotted path. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const rid = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = rid(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        if (isArrayElem) {
          nFields[editKey] = 'edited';
        } else {
          // Mark both a field-style and a first-sentence marker so the row + section show as edited.
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

  /* stepper helper: A1c steps 0.1, clamped >= 0 */
  const stepEditValue = (dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      let next = (isNaN(n) ? 0 : n) + dir * 0.1;
      next = Math.round(next * 10) / 10;
      if (next < 0) next = 0;
      return String(next);
    });
  };

  /* Resolve a dot-notation field from record, e.g. 'insulinRegimen.basal.type' */
  const resolveDotPath = useCallback((record, dotPath) => {
    const parts = dotPath.split('.');
    let cur = record;
    for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
    return cur;
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) return resolveDotPath(record, fn);
    return record[fn];
  }, [localEdits, resolveDotPath]);

  /* Derive dot-paths for a dynamic-key object root from the actual record,
     e.g. 'bloodGlucoseTargets' -> ['bloodGlucoseTargets.dayTarget', ...]. */
  const dynamicDotPaths = useCallback((record, root, idx) => {
    const obj = record[root];
    const keys = new Set();
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach(k => keys.add(k));
    }
    // Include any keys created only via localEdits (e.g. newly added subfield)
    Object.keys(localEdits).forEach(lk => {
      const m = lk.match(new RegExp(`^${root}\\.([^.]+)-${idx}$`));
      if (m) keys.add(m[1]);
    });
    return [...keys].map(k => `${root}.${k}`);
  }, [localEdits]);

  /* Effective field list for a section, expanding dynamic-object roots to the
     record's actual subfield dot-paths so search/copy/approve cover every key. */
  const sectionFieldsFor = useCallback((record, sid, idx) => {
    const base = SECTION_FIELDS[sid] || [];
    const out = [];
    const seenRoots = new Set();
    base.forEach(f => {
      const root = f.includes('.') ? f.split('.')[0] : null;
      if (root && DYNAMIC_OBJECT_ROOTS.includes(root)) {
        if (seenRoots.has(root)) return;
        seenRoots.add(root);
        dynamicDotPaths(record, root, idx).forEach(p => out.push(p));
      } else {
        out.push(f);
      }
    });
    return out;
  }, [dynamicDotPaths]);

  const getArrayItemValue = useCallback((record, fn, idx, arrIdx) => {
    const k = `${fn}.${arrIdx}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record[fn];
    if (!Array.isArray(arr) || arrIdx >= arr.length) return undefined;
    return arr[arrIdx];
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
    const fields = sectionFieldsFor(record, sid, 0);
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || humanizeKey(f.split('.').pop())).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, sectionFieldsFor]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || humanizeKey(fn.split('.').pop())).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Diabetes Educator ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const sid of Object.keys(SECTION_FIELDS)) {
        for (const f of sectionFieldsFor(record, sid, idx)) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, sectionFieldsFor]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      // Deep clone nested objects for mutation
      if (record.insulinRegimen) merged.insulinRegimen = { basal: { ...(record.insulinRegimen.basal || {}) }, bolus: { ...(record.insulinRegimen.bolus || {}) } };
      if (record.bloodGlucoseTargets) merged.bloodGlucoseTargets = { ...record.bloodGlucoseTargets };
      if (record.complicationsScreening) merged.complicationsScreening = { ...record.complicationsScreening };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          // dot-path: insulinRegimen.basal.type
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 3) {
            const [obj, sub, prop] = dotParts;
            if (!merged[obj]) merged[obj] = {};
            if (!merged[obj][sub]) merged[obj][sub] = {};
            merged[obj][sub][prop] = localEdits[key];
          } else if (dotParts.length === 2) {
            // array index: currentMedications.0
            const [arrField, arrIdx] = dotParts;
            if (ARRAY_FIELDS.includes(arrField)) {
              if (!merged[arrField]) merged[arrField] = [...(record[arrField] || [])];
              else merged[arrField] = [...merged[arrField]];
              merged[arrField][parseInt(arrIdx)] = localEdits[key];
            } else {
              const [obj2, prop2] = dotParts;
              if (!merged[obj2]) merged[obj2] = {};
              merged[obj2][prop2] = localEdits[key];
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
  /* Find the sectionId whose field list owns this field path (for clearing approvedSections on
     re-edit). Matches exact field, shared dotted root (dynamic objects), or array-field base. */
  const findSectionForField = useCallback((fn) => {
    const root = fn.includes('.') ? fn.split('.')[0] : fn;
    for (const sid of Object.keys(SECTION_FIELDS)) {
      const fields = SECTION_FIELDS[sid];
      if (fields.includes(fn)) return sid;
      if (fields.some(f => (f.includes('.') ? f.split('.')[0] : f) === root)) return sid;
    }
    return null;
  }, []);

  /* Stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
     fieldPart = the localEdits key minus the trailing "-<idx>"; for array elements it is
     "arrayField.arrayIndex". NOT written to MongoDB and NOT shown in the PDF until Approve commits. */
  const stageDraft = useCallback((record, fieldPart, idx, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop this section's 'approved' flag so the button returns to yellow.
    const rootFn = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
    const sid = findSectionForField(rootFn);
    if (sid) {
      setApprovedSections(prev => {
        const k = `${sid}-${idx}`;
        if (!prev[k]) return prev;
        const next = { ...prev }; delete next[k]; return next;
      });
    }
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId, findSectionForField]);

  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    stageDraft(record, `${fn}.${arrIdx}`, idx, value);
    const editKey = `${fn}.${arrIdx}-${idx}`;
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated, currentVal);
      setSaveError(null);
      stageDraft(record, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated, currentVal);
    setSaveError(null);
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
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  /* Match an edit-tracking key against a section field. For dynamic-object root
     fields, match any subfield path under that root (keys vary per record). */
  const editKeyMatchesField = useCallback((k, f, idx) => {
    const root = f.includes('.') ? f.split('.')[0] : null;
    if (root && DYNAMIC_OBJECT_ROOTS.includes(root)) {
      return k.startsWith(`${root}.`) && k.endsWith(`-${idx}`);
    }
    return k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`));
  }, []);

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => editKeyMatchesField(k, f, idx)) ||
      Object.keys(editedSentences).some(k => editKeyMatchesField(k, f, idx))
    );
  }, [editedFields, editedSentences, editKeyMatchesField]);

  /* Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the
     committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database. */
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Pending edits for this record that belong to a field in this section.
      const toCommit = Object.keys(localEdits).filter(k =>
        pendingEdits[k] && k.endsWith(suffix) && fields.some(f => editKeyMatchesField(k, f, idx))
      );
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field", "object.sub.prop", or "arrayField.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = isArrayElem
          ? { field: fieldPart.slice(0, lastDot), value: localEdits[editKey], arrayIndex: parseInt(fieldPart.slice(lastDot + 1), 10) }
          : { field: fieldPart, value: localEdits[editKey] };
        await secureApiClient.put(`/api/edit/diabetes_educator/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail).
      await secureApiClient.put(`/api/edit/diabetes_educator/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage.
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); if (store[id]) delete store[id][fp]; });
        if (store[id] && Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (editKeyMatchesField(k, f, idx)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (editKeyMatchesField(k, f, idx)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Save failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, editKeyMatchesField, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
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

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = sectionFieldsFor(record, sid, idx);
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || humanizeKey(f.split('.').pop());
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (NUMBER_FIELDS.includes(f) && typeof val === 'number' && val === 0) return; // A1c sentinel
      // single-name rule: a field label equal to the section title is not repeated
      const head = label.trim().toLowerCase() !== (title || '').trim().toLowerCase() ? `${label}\n${COPY_LINE_DASH}\n` : '';
      if (DATE_FIELDS.includes(f)) {
        text += `${head}1. ${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${head}1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        text += `${head}1. ${val}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        text += head;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val : [];
        if (arr.length > 0) {
          text += head;
          arr.forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
          text += '\n';
        }
      } else if (COMMA_SPLIT_FIELDS.includes(f)) {
        const items = splitByComma(fmtVal(val));
        text += head;
        if (items.length >= 3) items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        else text += `1. ${fmtVal(val)}\n`;
        text += '\n';
      } else {
        text += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, sectionFieldsFor]);

  const copyAllText = useCallback(async () => {
    let text = `Diabetes Educator\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Diabetes Educator ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
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
    // A1c of 0 is physiologically impossible — a 0 here is an extractor sentinel → hide
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || (typeof val === 'number' && val === 0)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>{'−'}</button>
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'yes' : 'no'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ENUM FIELD (fixed-choice dropdown) ═══════ */
  const renderEnumField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const strVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const options = enumOptionsWith(ENUM_FIELDS[fn], strVal);

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
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
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: ARRAY SECTION (string arrays) ═══════ */
  const renderArraySection = (record, idx, fn, sid) => {
    const arr = record[fn];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return arr.map((item, arrIdx) => {
      const itemVal = getArrayItemValue(record, fn, idx, arrIdx) ?? item;
      if (!itemVal) return null;

      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        const label = (FIELD_LABELS[fn] || fn).toLowerCase();
        if (!String(itemVal).toLowerCase().includes(phrase) && !label.includes(phrase)) return null;
      }

      const editKey = `${fn}.${arrIdx}-${idx}`;
      const isEditing = editingField === editKey;
      const badge = editedFields[editKey];

      return (
        <div key={arrIdx}>
          <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(itemVal)); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(String(itemVal))}</span><span className="edit-indicator">✎</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(itemVal), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: COMMA-SPLIT STRING ═══════ */
  const renderCommaSplitField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const items = splitByComma(fmtVal(val));
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    if (items.length < 3) {
      // Below a genuine list — render whole as simple editable
      return renderEditableField(record, fn, idx, sid, SECTION_TITLES[sid]);
    }

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {items.map((ci, ciIdx) => {
            const commaKey = `${fn}-${idx}-c${ciIdx}`;
            const ciEditing = editingField === commaKey;
            const ciBadge = editedSentences[commaKey];
            const ciMatches = phraseMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!ciMatches && searchTerm.trim()) return null;
            return (
              <div key={ciIdx}>
                <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                  {ciEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = fmtVal(getFieldValue(record, fn, idx) || ''); const items2 = splitByComma(currentVal2); items2[ciIdx] = editValue.trim(); const fullText2 = items2.join(', '); setSaveError(null); stageDraft(record, fn, idx, fullText2); setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS, currentVal2); setSaveError(null); stageDraft(record, fn, idx, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const cur2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(cur2); const parts2 = splitByComma((sentences2[sIdx] || '').replace(/[;.]+$/, '').trim()); parts2[ciIdx] = editValue.trim().replace(/[;.]+$/, '').trim(); const allS = [...sentences2]; allS[sIdx] = parts2.filter(Boolean).join(', '); setSaveError(null); stageDraft(record, fn, idx, reconstructFullText(allS, cur2)); setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                  </React.Fragment>
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
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const cur2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(cur2); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2, cur2); setSaveError(null); stageDraft(record, fn, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT DOT-NOTATION FIELD ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || humanizeKey(fn.split('.').pop());
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    // Check if section has any values (dynamic-object roots expand to the record's real keys)
    const hasAnyVal = sectionFieldsFor(record, sid, idx).some(f => {
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(record[f]) && record[f].length > 0;
      const val = getFieldValue(record, f, idx);
      return hasVal(val);
    });
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;

    /* Group insulin-regimen fields under Basal / Bolus subtitles */
    if (sid === 'insulin-regimen') {
      const basalFields = ['insulinRegimen.basal.type', 'insulinRegimen.basal.dose', 'insulinRegimen.basal.timing'];
      const bolusFields = ['insulinRegimen.bolus.type', 'insulinRegimen.bolus.dosing'];
      const hasBasal = basalFields.some(f => hasVal(getFieldValue(record, f, idx)));
      const hasBolus = bolusFields.some(f => hasVal(getFieldValue(record, f, idx)));
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
            {hasBasal && (
              <div className="rec-mini-card">
                <div className="nested-subtitle">{highlightText('Basal Insulin')}</div>
                {basalFields.map(f => renderObjectField(record, f, idx, sid))}
              </div>
            )}
            {hasBolus && (
              <div className="rec-mini-card">
                <div className="nested-subtitle">{highlightText('Bolus Insulin')}</div>
                {bolusFields.map(f => renderObjectField(record, f, idx, sid))}
              </div>
            )}
          </div>
        </div>
      );
    }

    /* Group glucose targets with subtitle (dynamic keys: fasting/preMeal/postMeal OR dayTarget/nightTarget/TIR) */
    if (sid === 'glucose-targets') {
      const bgFields = dynamicDotPaths(record, 'bloodGlucoseTargets', idx);
      const hasBG = bgFields.some(f => hasVal(getFieldValue(record, f, idx)));
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
            {hasBG && (
              <div className="rec-mini-card">
                <div className="nested-subtitle">{highlightText('Blood Glucose Targets')}</div>
                {bgFields.map(f => renderObjectField(record, f, idx, sid))}
              </div>
            )}
            {renderSentenceEditableField(record, 'selfMonitoringFrequency', idx, sid, title)}
          </div>
        </div>
      );
    }

    /* Group complications screening with subtitle (dynamic keys: retinopathy/nephropathy/neuropathy/cardiovascular/...) */
    if (sid === 'complications') {
      const compFields = dynamicDotPaths(record, 'complicationsScreening', idx);
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
            {compFields.map(f => renderObjectField(record, f, idx, sid))}
          </div>
        </div>
      );
    }

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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, idx, f, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            if (COMMA_SPLIT_FIELDS.includes(f)) return renderCommaSplitField(record, f, idx, sid);
            if (OBJECT_DOT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="diabetes-educator-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Diabetes Educator</h2></div>
        <div className="empty-state">No diabetes educator records available</div>
      </div>
    );
  }

  return (
    <div className="diabetes-educator-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Diabetes Educator</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DiabetesEducatorDocumentPDFTemplate document={pdfData} />} fileName="Diabetes_Educator.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search diabetes educator records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Diabetes Educator ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'diabetes-overview')}
            {renderSection(record, idx, 'medications')}
            {renderSection(record, idx, 'insulin-regimen')}
            {renderSection(record, idx, 'glucose-targets')}
            {renderSection(record, idx, 'hypoglycemia')}
            {renderSection(record, idx, 'nutrition')}
            {renderSection(record, idx, 'physical-activity')}
            {renderSection(record, idx, 'foot-care')}
            {renderSection(record, idx, 'complications')}
            {renderSection(record, idx, 'psychosocial')}
            {renderSection(record, idx, 'technology')}
            {renderSection(record, idx, 'sick-day')}
            {renderSection(record, idx, 'next-steps')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiabetesEducatorDocument;
