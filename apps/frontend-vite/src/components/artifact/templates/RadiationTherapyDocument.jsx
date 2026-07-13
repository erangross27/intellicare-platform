/**
 * RadiationTherapyDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: radiation_therapy
 *
 * 7 Sections:
 *   1. treatment-overview: site, intent, technique, provider, facility, status
 *   2. dose-information: dose, totalDose, fractions
 *   3. treatment-schedule: startDate, endDate, concurrentChemo
 *   4. planning: dynamic-key object (timing/simulationDate/positioning/acquisition/imageGuidance/respiratoryGating/targetVolumes/…)
 *   5. side-effects: sideEffects
 *   6. clinical-assessment: response, assessment, findings
 *   7. treatment-plan: plan, recommendations, notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import RadiationTherapyDocumentPDFTemplate from '../pdf-templates/RadiationTherapyDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './RadiationTherapyDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex"/"field.key") */
const DRAFT_KEY = 'radiation_therapyPendingEdits';
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
  'treatment-overview': 'Treatment Overview',
  'dose-information': 'Dose Information',
  'treatment-schedule': 'Treatment Schedule',
  'toxicities': 'Toxicities',
  'planning': 'Planning',
  'side-effects': 'Side Effects',
  'clinical-assessment': 'Clinical Assessment',
  'treatment-plan': 'Treatment Plan',
};

const FIELD_LABELS = {
  indication: 'Indication',
  date: 'Consultation Date',
  site: 'Site',
  intent: 'Intent',
  technique: 'Technique',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  dose: 'Dose Per Fraction',
  totalDose: 'Total Dose',
  fractions: 'Fractions',
  startDate: 'Start Date',
  endDate: 'End Date',
  concurrentChemo: 'Concurrent Chemotherapy',
  concurrentChemotherapy: 'Concurrent Chemotherapy',
  completionStatus: 'Completion Status',
  boostDose: 'Boost Dose',
  acuteToxicities: 'Acute Toxicities',
  lateToxicities: 'Late Toxicities',
  complications: 'Complications',
  planning: 'Treatment Planning',
  sideEffects: 'Side Effects',
  response: 'Response',
  results: 'Results',
  assessment: 'Assessment',
  findings: 'Findings',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'treatment-overview': ['date', 'indication', 'site', 'intent', 'technique', 'provider', 'facility', 'status'],
  'dose-information': ['dose', 'totalDose', 'boostDose', 'fractions'],
  'treatment-schedule': ['startDate', 'endDate', 'completionStatus', 'concurrentChemo', 'concurrentChemotherapy'],
  'toxicities': ['acuteToxicities', 'lateToxicities', 'complications'],
  'planning': ['planning'],
  'side-effects': ['sideEffects'],
  'clinical-assessment': ['response', 'results', 'assessment', 'findings'],
  'treatment-plan': ['plan', 'recommendations', 'notes'],
};

const BOOLEAN_FIELDS = ['concurrentChemo', 'concurrentChemotherapy'];
const DATE_FIELDS = ['date', 'startDate', 'endDate'];
const ARRAY_FIELDS = ['sideEffects', 'recommendations', 'complications'];
const NUMBER_FIELDS = [];
const STRING_FIELDS = ['indication', 'site', 'intent', 'technique', 'provider', 'facility', 'status', 'dose', 'totalDose', 'boostDose', 'fractions', 'completionStatus', 'response', 'assessment', 'findings', 'plan', 'notes'];
const COMMA_FIELDS = ['site'];
const NUMBER_UNIT_FIELDS = ['dose', 'totalDose', 'boostDose', 'fractions'];
const ENUM_FIELDS = ['status'];
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const sameAsTitle = (label, sid) => String(label || '').trim().toLowerCase() === String(SECTION_TITLES[sid] || '').trim().toLowerCase();
// `planning` is a dynamic-key object {timing, simulationDate, positioning, acquisition,
// imageGuidance, respiratoryGating, targetVolumes, ...} — keys vary per record. Rendered as
// editable scalar rows keyed by the ACTUAL keys via planning.<key> dot-path (route allow-lists
// the `planning` root). Not in STRING_FIELDS (those are flat top-level strings).
const EDITABLE_OBJECT_FIELDS = ['planning', 'results'];

const OBJECT_ARRAY_FIELDS = ['acuteToxicities', 'lateToxicities']; // arrays of {toxicity, expectedGrade|timing}
const STRING_ARRAY_FIELDS = ['complications']; // arrays of plain strings
const OBJECT_FIELDS = ['results']; // recursive key/value object

const isRadiationOncologyRecord = record => Boolean(
  record && ('acuteToxicities' in record || 'lateToxicities' in record || 'concurrentChemotherapy' in record || 'indication' in record)
);
const collectionForRecord = record => isRadiationOncologyRecord(record) ? 'radiation_oncology' : 'radiation_therapy';
const titleForRecord = record => isRadiationOncologyRecord(record) ? 'Radiation Oncology' : 'Radiation Therapy';
const enumOptionsWith = (current, options) => {
  const base = [...options];
  const cur = String(current || '').trim();
  if (cur && !base.some(o => o.toLowerCase() === cur.toLowerCase())) base.unshift(cur);
  return base;
};
const parseMeasurement = value => {
  const match = String(value || '').trim().match(/^(-?\d+(?:\.\d+)?)(\s*.*)$/);
  if (!match || !match[2].trim()) return null;
  return { number: match[1], suffix: match[2] };
};
const stepFor = value => {
  const decimals = (String(value ?? '').split('.')[1] || '').length;
  return decimals > 0 ? 10 ** -decimals : 1;
};

/* Format an object-array item like {toxicity, expectedGrade|timing} → "Toxicity — Detail" */
const formatObjItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item !== 'object') return String(item);
  const main = item.toxicity || item.name || item.type || item.event || '';
  const detail = item.expectedGrade || item.timing || item.grade || item.severity || item.description || '';
  const combined = [main, detail].filter(Boolean).join(' — ');
  return combined || Object.values(item).filter(Boolean).join(' — ');
};

/* ═══════ OBJECT-FIELD HELPERS (for `results` recursive render) ═══════ */
const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
/* Flatten any value (incl. nested objects/arrays) into a lowercase searchable string */
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (isScalar(v)) return fmtScalar(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  return Object.entries(v).map(([k, sv]) => `${humanizeKey(k)} ${flattenSearchable(sv)}`).join(' ');
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
    else if (ch === ',' && depth === 0) {
      // Preserve calendar dates ("February 12, 2026") as one clinical value.
      if (/\d$/.test(current.trim()) && /^\s*\d{4}\b/.test(text.slice(i + 1))) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
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
const isStandaloneDateText = value => /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/i.test(String(value || '').trim()) || /^\d{4}-\d{2}-\d{2}/.test(String(value || '').trim());

const cloneValue = value => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, sub]) => [key, cloneValue(sub)]));
  return value;
};
const setNestedValue = (value, path, nextValue) => {
  const root = cloneValue(value);
  const parts = String(path || '').split('.').filter(Boolean);
  if (parts.length === 0) return nextValue;
  let cursor = root;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) { cursor[part] = nextValue; return; }
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    cursor = cursor[part];
  });
  return root;
};

/* ═══════ COMPONENT ═══════ */
const RadiationTherapyDocument = ({ document: docProp, data, templateData }) => {
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
  const [approving, setApproving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    const rawInput = docProp ?? data ?? templateData;
    if (!rawInput) return [];
    let arr = Array.isArray(rawInput) ? rawInput : [rawInput];
    arr = arr.flatMap(r => {
      if (r?.radiation_oncology) return Array.isArray(r.radiation_oncology) ? r.radiation_oncology : [r.radiation_oncology];
      if (r?.radiation_therapy) return Array.isArray(r.radiation_therapy) ? r.radiation_therapy : [r.radiation_therapy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.radiation_oncology) return Array.isArray(dd.radiation_oncology) ? dd.radiation_oncology : [dd.radiation_oncology]; if (dd?.radiation_therapy) return Array.isArray(dd.radiation_therapy) ? dd.radiation_therapy : [dd.radiation_therapy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);
  const oncologyDocument = records.some(isRadiationOncologyRecord);
  const documentTitle = oncologyDocument ? 'Radiation Oncology' : 'Radiation Therapy';

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Maps each draft's record _id (handling _id.$oid) to its render index. localEdits is keyed by
     "<fieldPart>-<idx>"; editedFields marker reuses that key so sectionHasEdits lights the Approve button. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idFor = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = idFor(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const firstDot = fieldPart.indexOf('.');
        if (firstDot !== -1) {
          const baseField = fieldPart.slice(0, firstDot);
          const baseKey = `${baseField}-${idx}`;
          const existing = nLocal[baseKey] !== undefined ? nLocal[baseKey] : record[baseField];
          nLocal[baseKey] = setNestedValue(existing, fieldPart.slice(firstDot + 1), value);
          nPending[baseKey] = true;
          nFields[`${fieldPart}-${idx}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
        }
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
    const protectedText = text
      .replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\./gi, '$1<prd>')
      .replace(/\b([A-Z])\.(?=\s|[A-Z]\.)/g, '$1<prd>')
      .replace(/\b(\d+)\.(?=\d)/g, '$1<prd>');
    return protectedText.split(/[.;](?:\s+|$)/).map(s => s.replace(/<prd>/g, '.').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences, originalText = '') {
    if (!sentences || sentences.length === 0) return '';
    const protectedOriginal = String(originalText || '')
      .replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\./gi, '$1<prd>')
      .replace(/\b([A-Z])\.(?=\s|[A-Z]\.)/g, '$1<prd>')
      .replace(/\b(\d+)\.(?=\d)/g, '$1<prd>');
    const delimiters = [...protectedOriginal.matchAll(/([.;])(?:\s+|$)/g)].map(match => match[1]);
    const endedWithDelimiter = /[.;]\s*$/.test(protectedOriginal);
    return sentences.map((s, i) => {
      const clean = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) return `${clean}${delimiters[i] || delimiters[delimiters.length - 1] || ';'}`;
      return `${clean}${endedWithDelimiter ? (delimiters[delimiters.length - 1] || '.') : ''}`;
    }).join(' ');
  }

  const getNestedValue = useCallback((obj, path) => {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
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
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => formatObjItem(item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (flattenSearchable(val).toLowerCase().includes(phrase)) return true; }
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
      if (Array.isArray(val)) return val.some(item => formatObjItem(item).toLowerCase().includes(phrase));
      if (typeof val === 'object') return flattenSearchable(val).toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Radiation Therapy ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => formatObjItem(item).toLowerCase().includes(phrase)) : typeof val === 'object' ? flattenSearchable(val).toLowerCase().includes(phrase) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
          const fieldPath = m[1];
          if (fieldPath.includes('.')) {
            const parts = fieldPath.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]]) merged[parts[0]] = {};
              merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[key] };
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
  // Save = stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageDraft(record, fn, idx, sid, value) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }

  function stageNestedDraft(record, fieldPath, idx, sid, value) {
    const id = safeId(record); if (!id) return;
    const firstDot = fieldPath.indexOf('.');
    const baseField = firstDot === -1 ? fieldPath : fieldPath.slice(0, firstDot);
    const baseKey = `${baseField}-${idx}`;
    const currentBase = getFieldValue(record, baseField, idx);
    const nextBase = firstDot === -1 ? value : setNestedValue(currentBase, fieldPath.slice(firstDot + 1), value);
    const trackKey = `${fieldPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [baseKey]: nextBase }));
    setPendingEdits(prev => ({ ...prev, [baseKey]: true }));
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPath] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
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

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const collection = collectionForRecord(record);
    setSaving(true); setApproving(true); setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // fieldParts belonging to this section (base field before first dot is in this section's fields)
      const sectionParts = Object.keys(recDrafts).filter(fp => fields.includes(fp.includes('.') ? fp.slice(0, fp.indexOf('.')) : fp));
      // Persist every staged leaf by its exact dot path. Both edit routes validate the root field
      // and MongoDB applies the full path (including nested object-array leaves) atomically.
      for (const fieldPart of sectionParts) {
        const payload = { field: fieldPart, value: recDrafts[fieldPart] };
        const resp = await secureApiClient.put(`/api/edit/${collection}/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/${collection}/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending base keys → committed edits now flow into pdfData/PDF
      const baseKeys = new Set(sectionParts.map(fp => `${fp.includes('.') ? fp.slice(0, fp.indexOf('.')) : fp}-${idx}`));
      setPendingEdits(prev => { const n = { ...prev }; baseKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed); remove the record entry if empty
      sectionParts.forEach(fp => { delete recDrafts[fp]; });
      if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[RadiationTreatment] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); setApproving(false); }
  }, [safeId]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={approving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, approving]);

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
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (EDITABLE_OBJECT_FIELDS.includes(f)) {
        if (isScalar(val)) return;
        const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
        if (entries.length === 0) return;
        text += `${label}\n${COPY_LINE_DASH}\n`;
        entries.forEach(([k, v]) => {
          const subLabel = humanizeKey(k);
          text += `${subLabel}\n${COPY_LINE_DASH}\n`;
          if (f === 'planning' && k === 'targetVolumes' && typeof v === 'string') {
            const clauses = splitBySentence(v);
            clauses.forEach(clause => {
              const parsed = parseLabel(clause);
              if (parsed.isLabeled) text += `${parsed.label}\n${COPY_LINE_DASH}\n1. ${parsed.value}\n`;
              else text += `1. ${clause}\n`;
            });
          } else if (f === 'planning' && k === 'acquisition' && typeof v === 'string') {
            splitByComma(v).forEach((item, itemIndex) => { text += `${itemIndex + 1}. ${item}\n`; });
          } else {
            const displayValue = f === 'planning' && k === 'simulationDate' && isStandaloneDateText(v)
              ? formatDate(v)
              : (isScalar(v) ? fmtScalar(v) : flattenSearchable(v));
            text += `1. ${displayValue}\n`;
          }
        });
        text += '\n';
        return;
      }
      if (OBJECT_FIELDS.includes(f)) {
        if (isScalar(val)) return;
        const flatten = (obj, prefix, depth) => {
          let out = '';
          Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
            const lbl = humanizeKey(k);
            if (isScalar(v)) out += `${'  '.repeat(depth)}${lbl}: ${fmtScalar(v)}\n`;
            else { out += `${'  '.repeat(depth)}${lbl}\n`; out += flatten(v, prefix, depth + 1); }
          });
          return out;
        };
        text += `${label}\n${flatten(val, '', 0)}\n`;
        return;
      }
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val.filter(Boolean) : [];
        if (arr.length) {
          text += `${label}\n${COPY_LINE_DASH}\n`;
          let rowNumber = 1;
          arr.forEach(item => {
            Object.entries(item).filter(([, sub]) => !isEmptyDeep(sub)).forEach(([, sub]) => {
              text += `${rowNumber++}. ${fmtScalar(sub)}\n`;
            });
          });
          text += '\n';
        }
        return;
      }
      if (STRING_ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
        if (arr.length) text += `${label}\n${arr.map((it, i) => `${i + 1}. ${typeof it === 'object' ? formatObjItem(it) : it}`).join('\n')}\n\n`;
        return;
      }
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n1. ${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${label}\n${items.map((item, i) => `${i + 1}. ${typeof item === 'object' ? (item.recommendation || item.text || JSON.stringify(item)) : item}`).join('\n')}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        text += `${label}: ${val}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        const commaParts = COMMA_FIELDS.includes(f) ? splitByComma(strVal) : [strVal];
        if (commaParts.length > 1) {
          text += `${label}\n${COPY_LINE_DASH}\n`;
          commaParts.forEach((part, partIndex) => { text += `${partIndex + 1}. ${part}\n`; });
          text += '\n';
        } else if (sentences.length > 1) {
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
    let text = `=== ${documentTitle.toUpperCase()} ===\n\n`;
    pdfData.forEach((r, idx) => {
      text += `${titleForRecord(r)} ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText, documentTitle]);

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
      <div key={fn} className="rec-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card">
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value); setSaveError(null); }} />
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
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD — select Yes/No, convert to boolean on save ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card">
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
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD (BlueSelect) ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const label = FIELD_LABELS[fn] || fn;
    const options = enumOptionsWith(val, ['planned', 'in progress', 'completed', 'held', 'discontinued']);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card">
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={options} onChange={setEditValue} />
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(String(val))}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${label}\n${COPY_LINE_DASH}\n1. ${val}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: NUMBER + UNIT/ANNOTATION FIELD ═══════ */
  const renderMeasurementField = (record, fn, idx, sid) => {
    const raw = fmtVal(getFieldValue(record, fn, idx));
    const measurement = parseMeasurement(raw);
    if (!measurement) return renderStringField(record, fn, idx, sid);
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const label = FIELD_LABELS[fn] || fn;
    const changeNumber = direction => {
      const current = Number.parseFloat(editValue);
      const step = stepFor(editValue || measurement.number);
      const next = Math.max(0, (Number.isFinite(current) ? current : 0) + direction * step);
      const decimals = Math.max(0, String(step).split('.')[1]?.length || 0);
      setEditValue(decimals ? next.toFixed(decimals) : String(Math.round(next)));
    };
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card">
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(measurement.number); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={event => { event.stopPropagation(); changeNumber(-1); }} aria-label={`Decrease ${label}`}>−</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={event => setEditValue(event.target.value)} onClick={event => event.stopPropagation()} autoFocus />
                <button type="button" className="num-step" onClick={event => { event.stopPropagation(); changeNumber(1); }} aria-label={`Increase ${label}`}>+</button>
                <span className="measurement-unit">{measurement.suffix.trim()}</span>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); const numeric = Number.parseFloat(editValue); if (!Number.isFinite(numeric) || numeric < 0) { setSaveError('Please enter a valid non-negative number'); return; } handleSaveField(record, fn, idx, sid, null, `${editValue.trim()}${measurement.suffix}`); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(raw)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${label}\n${COPY_LINE_DASH}\n1. ${raw}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
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
      <div key={fn} className={`rec-mini-card ${fn === 'recommendations' ? 'recommendation-group' : ''}`}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card regular-row-group">
          {items.map((item, itemIdx) => {
          const itemStr = typeof item === 'object' ? (item.recommendation || item.text || JSON.stringify(item)) : String(item);
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx} className="grouped-row-item" data-edit-field={`${fn}.${itemIdx}`}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][`${fn}.${itemIdx}`] = editValue; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const commaParts = COMMA_FIELDS.includes(fn) ? splitByComma(strVal) : [strVal];
    if (commaParts.length > 1) {
      const term = searchTerm.toLowerCase().trim();
      const showAllParts = !term || sectionTitleMatches(sid) || record._showAllSections || label.toLowerCase().includes(term);
      const visibleParts = commaParts.map((part, partIndex) => ({ part, partIndex }))
        .filter(({ part }) => showAllParts || part.toLowerCase().includes(term));
      if (visibleParts.length === 0) return null;

      return (
        <div key={fn} className="rec-mini-card">
          {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="nested-mini-card regular-row-group">
            {visibleParts.map(({ part, partIndex }) => {
              const editKey = `${fn}-${idx}-c${partIndex}`;
              const isEditing = editingField === editKey;
              const badge = editedSentences[editKey];
              return (
                <div key={editKey} className="grouped-row-item" data-edit-field={fn}>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(part); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); const currentValue = String(getFieldValue(record, fn, idx) || ''); const updatedParts = splitByComma(currentValue); updatedParts[partIndex] = editValue.trim(); stageDraft(record, fn, idx, sid, updatedParts.join(', ')); setEditedSentences(previous => ({ ...previous, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(part, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
    }

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      /* Preserve semantic grouping inside a rich text field:
       * - one nested mini-card per labeled sentence/group;
       * - one shared, subtitle-free nested mini-card for each consecutive run of regular rows.
       * This keeps rows like the post-DVH constraints together instead of boxing every row separately. */
      const sentenceGroups = [];
      sentences.forEach((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        const entry = { sentence, sIdx, parsed, parsedDateValue: parsed.isLabeled && isStandaloneDateText(parsed.value) };
        if (parsed.isLabeled) {
          sentenceGroups.push({ type: 'labeled', entries: [entry] });
          return;
        }
        const previous = sentenceGroups[sentenceGroups.length - 1];
        if (previous?.type === 'regular') previous.entries.push(entry);
        else sentenceGroups.push({ type: 'regular', entries: [entry] });
      });

      const term = searchTerm.toLowerCase().trim();
      const isEntryVisible = entry => {
        if (!term || phraseMatch || labelMatch) return true;
        if (entry.sentence.toLowerCase().includes(term)) return true;
        if (entry.parsed.isLabeled && entry.parsed.label.toLowerCase().includes(term)) return true;
        return entry.parsed.isLabeled && splitByComma(entry.parsed.value).some(item => item.toLowerCase().includes(term));
      };

      const visibleCommaItems = entry => {
        const items = splitByComma(entry.parsed.value);
        if (!term || phraseMatch || labelMatch || entry.parsed.label.toLowerCase().includes(term)) return items;
        return items.filter(item => item.toLowerCase().includes(term));
      };

      const renderSentenceRow = entry => {
        const { sentence, sIdx, parsed, parsedDateValue } = entry;
        const sentenceKey = `${fn}-${idx}-s${sIdx}`;
        const isEditing = editingField === sentenceKey;
        const badge = editedSentences[sentenceKey];
        return (
          <div key={sentenceKey} className="grouped-row-item" data-edit-field={fn}>
            <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsedDateValue ? toInputDate(parsed.value) : (parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim())); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  {parsedDateValue
                    ? <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value); setSaveError(null); }} />
                    : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = parsedDateValue ? formatDate(`${editValue}T00:00:00.000Z`) : editValue.trim(); if (parsedDateValue && !trimmed) { setSaveError('Please select a valid date'); return; } const subParts = parsedDateValue ? [trimmed] : trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const currentText = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentText); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2, currentText); stageDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
      };

      const renderCommaRow = (entry, ci, ciIdx) => {
        const { sIdx } = entry;
        const sentenceKey = `${fn}-${idx}-s${sIdx}`;
        const commaKey = `${sentenceKey}-c${ciIdx}`;
        const ciEditing = editingField === commaKey;
        const ciBadge = editedSentences[commaKey];
        return (
          <div key={commaKey} className="grouped-row-item" data-edit-field={fn}>
            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
              {ciEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS, currentVal2); stageDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      };

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
            {sentenceGroups.map((group, groupIndex) => {
              const visibleEntries = group.entries.filter(isEntryVisible);
              if (visibleEntries.length === 0) return null;
              if (group.type === 'regular') {
                return (
                  <div key={`regular-${groupIndex}`} className="nested-mini-card regular-row-group">
                    {visibleEntries.map(renderSentenceRow)}
                  </div>
                );
              }
              const entry = visibleEntries[0];
              const commaItems = visibleCommaItems(entry);
              return (
                <div key={`labeled-${entry.sIdx}`} className="nested-mini-card labeled-row-group">
                  <div className="nested-subtitle sub-label">{highlightText(entry.parsed.label)}</div>
                  {commaItems.length >= 2
                    ? commaItems.map((item, itemIndex) => renderCommaRow(entry, item, itemIndex))
                    : renderSentenceRow(entry)}
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
      <div key={fn} className="rec-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card">
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
      </div>
    );
  };

  /* ═══════ RENDER: EDITABLE DYNAMIC-KEY OBJECT (planning) ═══════
   * Keys derived from the ACTUAL object (timing, simulationDate, positioning, …).
   * Each scalar leaf is an editable row saved via planning.<key> dot-path (route
   * allow-lists the `planning` root). Edit-tracking key `planning.<key>-<idx>` so it
   * is recognized by sectionHasEdits/handleApproveSection (startsWith `${f}.` + ends `-${idx}`).
   * Saving merges into the localEdits object value at key `planning-<idx>` (preserves shape). */
  const renderEditableObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {entries.map(([k, v]) => {
          const subLabel = humanizeKey(k);
          const subStr = isScalar(v) ? fmtScalar(v) : flattenSearchable(v);
          const editKey = `${fn}.${k}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const editable = isScalar(v); // only scalar leaves are inline-editable

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!subLabel.toLowerCase().includes(phrase) && !subStr.toLowerCase().includes(phrase)) return null;
          }

          if (fn === 'planning' && k === 'targetVolumes' && editable) {
            const clauses = splitBySentence(subStr);
            return (
              <div key={k} className="nested-group">
                <div className="nested-subtitle sub-label">{highlightText(subLabel)}</div>
                {clauses.map((clause, clauseIndex) => {
                  const parsed = parseLabel(clause);
                  const partKey = `${fn}.${k}.part${clauseIndex}-${idx}`;
                  const partEditing = editingField === partKey;
                  const partModified = editedFields[partKey] || editedFields[editKey];
                  const displayValue = parsed.isLabeled ? parsed.value : clause;
                  return (
                    <div key={partKey} className={`nested-mini-card ${parsed.isLabeled ? 'labeled-row-group' : 'regular-row-group'}`}>
                      {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
                      <div className="grouped-row-item" data-edit-field={`${fn}.${k}`}>
                        <div className={`numbered-row ${partModified ? 'modified' : ''} editable-row`} onClick={() => { if (!partEditing) { setEditingField(partKey); setEditValue(displayValue); setSaveError(null); } }}>
                          {partEditing ? (
                            <div className="edit-field-container">
                              <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={event => {
                                  event.stopPropagation();
                                  const currentObject = getFieldValue(record, fn, idx) || {};
                                  const currentText = String(currentObject[k] || '');
                                  const currentClauses = splitBySentence(currentText);
                                  currentClauses[clauseIndex] = parsed.isLabeled ? `${parsed.label}: ${editValue.trim()}` : editValue.trim();
                                  const separator = currentText.includes(';') ? '; ' : '. ';
                                  stageNestedDraft(record, `${fn}.${k}`, idx, sid, currentClauses.join(separator));
                                  setEditedFields(previous => ({ ...previous, [partKey]: 'edited' }));
                                }}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
                              <button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${parsed.isLabeled ? `${parsed.label}\n${COPY_LINE_DASH}\n` : ''}1. ${displayValue}`, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button>
                            </>
                          )}
                        </div>
                        {partModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          if (fn === 'planning' && k === 'acquisition' && editable && splitByComma(subStr).length > 1) {
            const parts = splitByComma(subStr);
            return (
              <div key={k} className="nested-mini-card labeled-row-group">
                <div className="nested-subtitle sub-label">{highlightText(subLabel)}</div>
                {parts.map((part, partIndex) => {
                  const partKey = `${fn}.${k}.part${partIndex}-${idx}`;
                  const partEditing = editingField === partKey;
                  const partModified = editedFields[partKey] || editedFields[editKey];
                  return (
                    <div key={partKey} className="grouped-row-item" data-edit-field={`${fn}.${k}`}>
                      <div className={`numbered-row ${partModified ? 'modified' : ''} editable-row`} onClick={() => { if (!partEditing) { setEditingField(partKey); setEditValue(part); setSaveError(null); } }}>
                        {partEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={event => {
                                event.stopPropagation();
                                const currentObject = getFieldValue(record, fn, idx) || {};
                                const currentParts = splitByComma(String(currentObject[k] || ''));
                                currentParts[partIndex] = editValue.trim();
                                stageNestedDraft(record, `${fn}.${k}`, idx, sid, currentParts.join(', '));
                                setEditedFields(previous => ({ ...previous, [partKey]: 'edited' }));
                              }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">&#9998;</span></div>
                            <button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`1. ${part}`, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {partModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                })}
              </div>
            );
          }

          const isObjectDate = fn === 'planning' && k === 'simulationDate' && isStandaloneDateText(subStr);
          const displayStr = isObjectDate ? formatDate(v) : subStr;

          return (
            <div key={k} className="nested-mini-card" data-edit-field={`${fn}.${k}`}>
              <div className="nested-subtitle sub-label">{highlightText(subLabel)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} ${editable ? 'editable-row' : ''}`} onClick={() => { if (editable && !isEditing) { setEditingField(editKey); setEditValue(isObjectDate ? toInputDate(v) : subStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    {isObjectDate
                      ? <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value); setSaveError(null); }} />
                      : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => {
                        e.stopPropagation();
                        const id = safeId(record); if (!id) return;
                        // Stage a DRAFT only (no DB write). Whole object kept in localEdits for render;
                        // draft store keyed by "planning.<key>" so Approve PUTs field "planning.<key>" (no arrayIndex).
                        const curObj = getFieldValue(record, fn, idx);
                        const baseObj = (curObj && typeof curObj === 'object' && !Array.isArray(curObj)) ? curObj : {};
                        setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: { ...baseObj, [k]: editValue } }));
                        setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
                        setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                        setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                        const store = readDrafts();
                        if (!store[id]) store[id] = {};
                        store[id][`${fn}.${k}`] = editValue;
                        writeDrafts(store);
                        setEditingField(null); setEditValue(''); setSaveError(null);
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(displayStr)}</span>{editable && <span className="edit-indicator">&#9998;</span>}</div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}\n${COPY_LINE_DASH}\n1. ${displayStr}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: EDITABLE OBJECT ARRAY (radiation_oncology toxicities) ═══════ */
  const renderObjectArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(item => item && typeof item === 'object') : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => (
          <div key={itemIdx} className="nested-group">
            {Object.entries(item).filter(([, sub]) => !isEmptyDeep(sub)).map(([subKey, subValue]) => {
              const fieldPath = `${fn}.${itemIdx}.${subKey}`;
              const editKey = `${fieldPath}-${idx}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];
              const subLabel = humanizeKey(subKey);
              const displayValue = fmtScalar(subValue);
              if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)) {
                const phrase = searchTerm.toLowerCase().trim();
                if (!subLabel.toLowerCase().includes(phrase) && !displayValue.toLowerCase().includes(phrase)) return null;
              }
              return (
                <div key={subKey} className="nested-mini-card" data-edit-field={fieldPath}>
                  <div className="nested-subtitle sub-label">{highlightText(subLabel)}</div>
                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayValue); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); stageNestedDraft(record, fieldPath, idx, sid, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${subLabel}\n${COPY_LINE_DASH}\n1. ${displayValue}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: READ-ONLY FIELD (radiation_oncology shared fields) ═══════
   * Display-only (no inline edit) because the shared component posts edits to a
   * hardcoded /api/edit/radiation_therapy endpoint. Handles object-arrays
   * (acuteToxicities/lateToxicities → "Toxicity — Detail" rows), booleans (Yes/No),
   * and plain strings. hide-empty so radiation_therapy records (which lack these
   * fields) render nothing here. */
  /* recursive read-only object node for `results` (humanizeKey + nested-mini-card, hide-empty) */
  const renderReadOnlyObjectNode = (label, value, keyPath, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) {
      const leafStr = fmtScalar(value);
      return (
        <div key={keyPath} className="nested-mini-card">
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          <div className="numbered-row">
            <div className="row-content"><span className="content-value">{highlightText(leafStr)}</span></div>
            <button className={`copy-btn ${copiedItems[keyPath] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${leafStr}`, keyPath); }}>{copiedItems[keyPath] ? 'Copied!' : 'Copy'}</button>
          </div>
        </div>
      );
    }
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={keyPath}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => renderReadOnlyObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}
        </div>
      </React.Fragment>
    );
  };

  const renderReadOnlyField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (OBJECT_FIELDS.includes(fn)) {
      if (isScalar(val)) return null;
      const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
      if (entries.length === 0) return null;
      const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
      return (
        <div key={fn} className="rec-mini-card">
          {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {entries.map(([k, v]) => renderReadOnlyObjectNode(humanizeKey(k), v, `${fn}-${idx}-${k}`, 1))}
        </div>
      );
    }

    if (STRING_ARRAY_FIELDS.includes(fn)) {
      const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
      if (items.length === 0) return null;
      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {items.map((item, i) => {
            const txt = typeof item === 'object' ? formatObjItem(item) : String(item);
            const ik = `${fn}.${i}-${idx}`;
            return (
              <div key={i} className="nested-mini-card">
                <div className="numbered-row">
                  <div className="row-content"><span className="content-value">{highlightText(txt)}</span></div>
                  <button className={`copy-btn ${copiedItems[ik] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(txt, ik); }}>{copiedItems[ik] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (OBJECT_ARRAY_FIELDS.includes(fn)) {
      const items = Array.isArray(val) ? val.filter(Boolean) : [];
      if (items.length === 0) return null;
      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {items.map((item, i) => {
            const txt = formatObjItem(item);
            const ik = `${fn}.${i}-${idx}`;
            return (
              <div key={i} className="nested-mini-card">
                <div className="numbered-row">
                  <div className="row-content"><span className="content-value">{highlightText(txt)}</span></div>
                  <button className={`copy-btn ${copiedItems[ik] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(txt, ik); }}>{copiedItems[ik] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val);
    const ik = `${fn}-${idx}`;
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
          <div className="numbered-row">
            <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span></div>
            <button className={`copy-btn ${copiedItems[ik] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, ik); }}>{copiedItems[ik] ? 'Copied!' : 'Copy'}</button>
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
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderObjectArrayField(record, f, idx, sid);
            if (EDITABLE_OBJECT_FIELDS.includes(f)) return renderEditableObjectField(record, f, idx, sid);
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (ENUM_FIELDS.includes(f)) return renderEnumField(record, f, idx, sid);
            if (NUMBER_UNIT_FIELDS.includes(f) && parseMeasurement(getFieldValue(record, f, idx))) return renderMeasurementField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="radiation-therapy-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Radiation Treatment</h2></div>
        <div className="empty-state">No radiation treatment records available</div>
      </div>
    );
  }

  return (
    <div className="radiation-therapy-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">{documentTitle}</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RadiationTherapyDocumentPDFTemplate document={pdfData} />} fileName={`Radiation_${oncologyDocument ? 'Oncology' : 'Therapy'}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder={`Search ${documentTitle.toLowerCase()} records...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`${titleForRecord(record)} ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'treatment-overview')}
            {renderSection(record, idx, 'dose-information')}
            {renderSection(record, idx, 'treatment-schedule')}
            {renderSection(record, idx, 'toxicities')}
            {renderSection(record, idx, 'planning')}
            {renderSection(record, idx, 'side-effects')}
            {renderSection(record, idx, 'clinical-assessment')}
            {renderSection(record, idx, 'treatment-plan')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RadiationTherapyDocument;
