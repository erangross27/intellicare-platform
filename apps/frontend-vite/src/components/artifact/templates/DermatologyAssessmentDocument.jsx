/**
 * DermatologyAssessmentDocument.jsx
 * June 2026 — FULL TEMPLATE STANDARD rewrite — 100% coverage (19 non-system fields)
 * Collection: dermatology_assessment
 *
 * Field types:
 *   NUMBER  : pasiScore, scoradIndex, dlqi              → −/+ stepper, hide-zero
 *   OBJECT  : biopsyResults, phototherapy, dermoscopicPhotography,
 *             melanomaSurveillancePlan, systemicTherapyInitiation, results
 *                                                        → recursive renderObjectNode/renderObjectLeaf
 *             (string leaf with >=3 guarded comma items → numbered rows, per-comma editing;
 *              array leaf → numbered rows, per-item editing)
 *   ARRAY   : skinLesions (array of lesion objects), recommendations ([{recommendation, date}])
 *   DATE    : date                                      → BlueDatePicker
 *   ENUM    : status                                    → <select> (Active / Not Active)
 *   STRING  : provider, facility, type                  → simple editable
 *   SENTENCE: findings, assessment, plan, notes         → per-sentence [.;] split; labeled →
 *             nested-subtitle + value; value with >=3 guarded comma items → per-comma rows
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DermatologyAssessmentDocumentPDFTemplate from '../pdf-templates/DermatologyAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './DermatologyAssessmentDocument.css';

/* ═══════ CONSTANTS ═══════ */
const COLLECTION = 'dermatology_assessment';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { localKey, localValue, marker, db } } }
     - localKey   : the localEdits key to repopulate (e.g. "findings-0", "biopsyResults-0")
     - localValue : the value to put in localEdits (string, number, whole object, or whole array)
     - marker     : { store: 'fields'|'sentences', key, value }  → which edited* map + key to set
     - db         : { field, value, arrayIndex? }  → the exact PUT payload replayed on Approve */
const DRAFT_KEY = 'dermatology_assessmentPendingEdits';
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
  'provider-details': 'Provider Details',
  'skin-lesions': 'Skin Lesions',
  scores: 'Severity Scores',
  'biopsy-results': 'Biopsy Results',
  phototherapy: 'Phototherapy',
  photography: 'Dermoscopic Photography',
  'melanoma-surveillance': 'Melanoma Surveillance Plan',
  'systemic-therapy': 'Systemic Therapy Initiation',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  type: 'Type',
  status: 'Status',
  pasiScore: 'PASI Score',
  scoradIndex: 'SCORAD Index',
  dlqi: 'DLQI',
  biopsyResults: 'Biopsy Results',
  phototherapy: 'Phototherapy',
  dermoscopicPhotography: 'Dermoscopic Photography',
  melanomaSurveillancePlan: 'Melanoma Surveillance Plan',
  systemicTherapyInitiation: 'Systemic Therapy Initiation',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'provider-details': ['date', 'provider', 'facility', 'type', 'status'],
  scores: ['pasiScore', 'scoradIndex', 'dlqi'],
  'biopsy-results': ['biopsyResults'],
  phototherapy: ['phototherapy'],
  photography: ['dermoscopicPhotography'],
  'melanoma-surveillance': ['melanomaSurveillancePlan'],
  'systemic-therapy': ['systemicTherapyInitiation'],
  results: ['results'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  recommendations: ['recommendations'],
  notes: ['notes'],
};

const SECTION_ORDER = [
  'provider-details', 'skin-lesions', 'scores', 'biopsy-results', 'phototherapy',
  'photography', 'melanoma-surveillance', 'systemic-therapy', 'results',
  'findings', 'assessment', 'plan', 'recommendations', 'notes',
];

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['pasiScore', 'scoradIndex', 'dlqi'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['biopsyResults', 'phototherapy', 'dermoscopicPhotography', 'melanomaSurveillancePlan', 'systemicTherapyInitiation', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const STRING_FIELDS = ['provider', 'facility', 'type', 'status'];
const ENUM_FIELDS = { status: ['Active', 'Not Active'] };

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* enum helpers: seed <select> with the canonical-cased match of the stored value;
   keep an off-scale stored value selectable as an extra option */
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

/* stepper step: decimals step 0.1, integers step 1 */
const stepFor = (v) => (/\.\d/.test(String(v)) ? 0.1 : 1);

/* lesion sub-fields whose value is measurement text ("9mm x 7mm", "40% involvement") —
   every number edits with its own −/+ segment, literals/units preserved verbatim */
const LESION_NUMERIC_FIELDS = ['size'];
const parseNumeric = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text);
  if (!/\d/.test(s)) return null;
  const nums = []; const literals = [];
  const re = /-?\d+(?:\.\d+)?/g; let last = 0; let m;
  while ((m = re.exec(s)) !== null) { literals.push(s.slice(last, m.index)); nums.push(m[0]); last = m.index + m[0].length; }
  literals.push(s.slice(last));
  return { nums, literals };
};
const rebuildNumeric = (literals, nums) => literals.slice(0, -1).map((lit, i) => lit + (nums[i] ?? '')).join('') + literals[literals.length - 1];

const LESION_SUB_FIELDS = ['morphology', 'size', 'distribution', 'color', 'dermoscopyFindings'];
const LESION_LABELS = { morphology: 'Morphology', size: 'Size', distribution: 'Distribution', color: 'Color', dermoscopyFindings: 'Dermoscopy Findings' };

const KEY_OVERRIDES = {
  pasi: 'PASI', scorad: 'SCORAD', dlqi: 'DLQI', uvb: 'UVB', uva: 'UVA', puva: 'PUVA',
  nbuvb: 'NB-UVB', med: 'MED', tbse: 'TBSE', ifMelanoma: 'If Melanoma', ifDysplasticNevus: 'If Dysplastic Nevus',
};

/* ═══════ PURE HELPERS ═══════ */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
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
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

/* parseLabel: detect "Label: value" or "1. Label - value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const nm = text.match(/^\d+\.\s*(.+?)\s*[-–]\s+([\s\S]*)/);
  if (nm) return { isLabeled: true, label: nm[1].trim(), value: nm[2].trim() };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware + guards — skip no-space commas ("$18,000"),
   keep "and"/"or" adjacent to the comma connected, next non-space char must be letter/>/( */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const noSpace = !/^\s/.test(rest);
      const nextWordM = rest.match(/^\s*([^\s,]+)/);
      const nextWord = nextWordM ? nextWordM[1].toLowerCase() : '';
      const prevWordM = current.match(/(\S+)\s*$/);
      const prevWord = prevWordM ? prevWordM[1].toLowerCase() : '';
      const nextCharM = rest.match(/^\s*(.)/);
      const nextChar = nextCharM ? nextCharM[1] : '';
      const badNext = nextChar && !/[A-Za-z>(]/.test(nextChar);
      if (noSpace || nextWord === 'and' || nextWord === 'or' || prevWord === 'and' || prevWord === 'or' || badNext) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ═══════ COMPONENT ═══════ */
const DermatologyAssessmentDocument = ({ document: docProp }) => {
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
  // editKeys staged as drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  // segmented numeric editing ({nums, literals}) for measurement-text values ("9mm x 7mm")
  const [editNums, setEditNums] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.dermatology_assessment) return Array.isArray(r.dermatology_assessment) ? r.dermatology_assessment : [r.dermatology_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dermatology_assessment) return Array.isArray(dd.dermatology_assessment) ? dd.dermatology_assessment : [dd.dermatology_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ DRAFT REHYDRATION ═══════ */
  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Each entry stores the index it was saved at (entry.idx); we re-key to the current render index.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const reidx = (key, oldIdx, newIdx) => (oldIdx === newIdx ? key : key.split(`-${oldIdx}`).join(`-${newIdx}`));
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = record?._id == null ? null : (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id)));
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        const oldIdx = typeof entry.idx === 'number' ? entry.idx : idx;
        nPending[reidx(editKey, oldIdx, idx)] = true;
        if (entry.localKey) nLocal[reidx(entry.localKey, oldIdx, idx)] = entry.localValue;
        const m = entry.marker;
        if (m && m.key) {
          const mk = reidx(m.key, oldIdx, idx);
          if (m.store === 'sentences') nSentences[mk] = m.value || 'edited';
          else nFields[mk] = m.value || 'edited';
        }
        if (m && m.extraFieldKey) nFields[reidx(m.extraFieldKey, oldIdx, idx)] = 'edited';
        if (m && Array.isArray(m.addedKeys)) m.addedKeys.forEach(ak => { nSentences[reidx(ak, oldIdx, idx)] = 'added'; });
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => !isEmptyDeep(v), []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const formatDate = useCallback((d) => {
    if (!d) return '';
    try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
  }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const raw = text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
    const result = [];
    for (let i = 0; i < raw.length; i++) {
      if (/^\d{1,2}$/.test(raw[i]) && i + 1 < raw.length) { result.push(`${raw[i]}. ${raw[i + 1]}`); i++; }
      else { result.push(raw[i]); }
    }
    return result;
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

  const recsToText = useCallback((recs) => {
    if (!Array.isArray(recs)) return '';
    return recs.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ');
  }, []);

  const lesionsToText = useCallback((lesions) => {
    if (!Array.isArray(lesions)) return '';
    return lesions.map(l => `${l?.location || ''} ${LESION_SUB_FIELDS.map(sf => l?.[sf] || '').join(' ')}`).join(' ');
  }, []);

  const fieldSearchText = useCallback((f, val) => {
    if (f === 'skinLesions') return lesionsToText(val);
    if (OBJECT_ARRAY_FIELDS.includes(f)) return recsToText(val);
    if (OBJECT_FIELDS.includes(f)) return flattenSearchable(val);
    return fmtVal(val);
  }, [recsToText, lesionsToText, fmtVal]);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).split(regex).map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
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
    if (sid === 'skin-lesions') {
      return fieldSearchText('skinLesions', record.skinLesions).toLowerCase().includes(phrase);
    }
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (hasVal(val) && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, hasVal, fieldSearchText]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    return hasVal(val) && fieldSearchText(fn, val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, hasVal, fieldSearchText]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dermatology Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      if (fieldSearchText('skinLesions', record.skinLesions).toLowerCase().includes(phrase)) return true;
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (hasVal(val) && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, hasVal, fieldSearchText]);

  /* localEdits keys (remapped to current render idx) that are still PENDING (un-approved).
     These must stay OUT of the PDF/Copy All. Derived from the draft store via pendingEdits. */
  const pendingLocalKeys = useMemo(() => {
    const set = new Set();
    if (Object.keys(pendingEdits).length === 0) return set;
    const store = readDrafts();
    const reidx = (key, oldIdx, newIdx) => (oldIdx === newIdx ? key : key.split(`-${oldIdx}`).join(`-${newIdx}`));
    records.forEach((record, idx) => {
      const id = safeId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, entry]) => {
        if (!entry || typeof entry !== 'object' || !entry.localKey) return;
        const oldIdx = typeof entry.idx === 'number' ? entry.idx : idx;
        const remappedEditKey = reidx(editKey, oldIdx, idx);
        if (pendingEdits[remappedEditKey]) set.add(reidx(entry.localKey, oldIdx, idx));
      });
    });
    return set;
  }, [records, pendingEdits, safeId]);

  /* ═══════ EFFECTIVE ARRAYS ═══════ */
  // excludePending=true → omit staged (un-approved) lesion edits (used for PDF/Copy All only).
  const getEffectiveLesions = useCallback((record, idx, excludePending = false) => {
    const raw = record.skinLesions || [];
    return raw.map((lesion, li) => {
      const merged = { ...lesion };
      LESION_SUB_FIELDS.forEach(sf => {
        const ek = `skinLesions.${li}.${sf}-${idx}`;
        if (excludePending && pendingLocalKeys.has(ek)) return;
        if (localEdits[ek] !== undefined) merged[sf] = localEdits[ek];
      });
      const locKey = `skinLesions.${li}.location-${idx}`;
      if (!(excludePending && pendingLocalKeys.has(locKey)) && localEdits[locKey] !== undefined) merged.location = localEdits[locKey];
      return merged;
    });
  }, [localEdits, pendingLocalKeys]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      // Apply top-level field localEdits (including object roots replaced by saveLeaf)
      Object.keys(localEdits).forEach(key => {
        if (pendingLocalKeys.has(key)) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^([^.]+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx && !m[1].includes('.')) merged[m[1]] = localEdits[key];
      });
      merged.skinLesions = getEffectiveLesions(record, idx, true);
      return merged;
    });
  }, [filteredRecords, localEdits, getEffectiveLesions, pendingLocalKeys]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Stage a DRAFT in localStorage (survives refresh). NOT written to MongoDB and NOT shown in the
  // PDF/Copy All until Approve commits it. `db` is the exact PUT payload replayed on Approve.
  // Sibling entries that share the same localKey are kept in sync with the latest localValue
  // (e.g. multiple edited sentences of one field accumulate into one full-text value).
  const stageDraft = useCallback((record, idx, editKey, localKey, localValue, marker, db) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    if (localKey) {
      Object.values(store[id]).forEach(e => { if (e && e.localKey === localKey) e.localValue = localValue; });
    }
    store[id][editKey] = { idx, localKey, localValue, marker, db };
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;
    if (NUMBER_FIELDS.includes(fn)) {
      if (isNaN(parseFloat(saveVal))) { setSaveError('Please enter a valid number'); return; }
      saveVal = parseFloat(saveVal);
    }
    if (DATE_FIELDS.includes(fn)) {
      if (isNaN(new Date(saveVal).getTime())) { setSaveError('Please enter a valid date'); return; }
      saveVal = saveVal + 'T00:00:00.000Z';
    }
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    stageDraft(record, idx, editKey, editKey, saveVal,
      { store: 'fields', key: editKey, value: 'edited' },
      { field: fn, value: saveVal });
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  /* saveLeaf: stage a nested object scalar edit (dotted path); update root object in localEdits.
     DB write (dotted field) is DEFERRED to Approve. */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    setSaveError(null);
    const localKey = `${rootField}-${idx}`;
    let clone;
    setLocalEdits(prev => {
      const cur = prev[localKey] !== undefined ? prev[localKey] : record[rootField];
      clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      return { ...prev, [localKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [leafKeyTrack]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(record, idx, leafKeyTrack, localKey, clone,
      { store: 'fields', key: leafKeyTrack, value: 'edited' },
      { field: dottedField, value: newVal });
    setEditingField(null); setEditValue('');
  }, [safeId, stageDraft]);

  /* Save lesion sub-field — stage a DRAFT; DB write deferred to Approve */
  const saveLesionField = useCallback((record, idx, lesionIdx, subField, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const ek = `skinLesions.${lesionIdx}.${subField}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`skin-lesions-${idx}`]; return n; });
    stageDraft(record, idx, ek, ek, saveVal,
      { store: 'fields', key: ek, value: 'edited' },
      { field: `skinLesions.${lesionIdx}.${subField}`, value: saveVal });
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  /* Save recommendations array item — stage a DRAFT; DB write (whole array) deferred to Approve */
  const saveRecItem = useCallback((record, fn, idx, sid, recIdx, itemKey) => {
    const id = safeId(record); if (!id) return;
    const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
    const trimmed = editValue.trim();
    const newArr = currentArr.map((r, i) => i === recIdx ? { ...r, recommendation: trimmed } : { ...r });
    setSaveError(null);
    const localKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: newArr }));
    setPendingEdits(prev => ({ ...prev, [itemKey]: true }));
    setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(record, idx, itemKey, localKey, newArr,
      { store: 'sentences', key: itemKey, value: 'edited' },
      { field: fn, value: newArr });
    setEditingField(null); setEditValue('');
  }, [editValue, getFieldValue, safeId, stageDraft]);

  // Save a "Label: value" / "1. Label - value" sentence — preserve the original number prefix
  // and label delimiter; stage a DRAFT; DB write deferred to Approve.
  const saveLabeledSentence = useCallback((record, fn, idx, sid, sIdx, sentenceKey, label) => {
    const id = safeId(record); if (!id) return;
    const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const orig = sentences2[sIdx] || '';
    const numM = orig.match(/^(\d+\.\s*)/);
    const numPrefix = numM ? numM[1] : '';
    const sep = /^[^-–]*:/.test(orig.replace(/^\d+\.\s*/, '')) ? ': ' : ' - ';
    sentences2[sIdx] = `${numPrefix}${label}${sep}${editValue.trim()}`;
    const fullText = reconstructFullText(sentences2);
    setSaveError(null);
    const localKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [sentenceKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sentenceKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(record, idx, sentenceKey, localKey, fullText,
      { store: 'sentences', key: sentenceKey, value: 'edited' },
      { field: fn, value: fullText });
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue, splitBySentence, stageDraft]);

  // Save one comma-item of a lesion dermoscopyFindings list — stage a DRAFT; DB write deferred.
  const saveDermoscopyComma = useCallback((record, idx, li, sf, items, ciIdx, commaKey, sfEditKey) => {
    const id = safeId(record); if (!id) return;
    const allItems = [...items]; allItems[ciIdx] = editValue.trim();
    const fullText = allItems.join(', ');
    setSaveError(null);
    const localKey = `skinLesions.${li}.${sf}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [commaKey]: true }));
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    setEditedFields(prev => ({ ...prev, [sfEditKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`skin-lesions-${idx}`]; return n; });
    stageDraft(record, idx, commaKey, localKey, fullText,
      { store: 'sentences', key: commaKey, value: 'edited', extraFieldKey: sfEditKey },
      { field: `skinLesions.${li}.${sf}`, value: fullText });
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  // Save one comma-item of a sentence-field value — rebuild the comma list, re-attach the label
  // (when labeled), splice into the sentence list, stage a DRAFT. DB write deferred to Approve.
  const saveSentenceComma = useCallback((record, fn, idx, sid, sIdx, label, items, ciIdx, commaKey) => {
    const id = safeId(record); if (!id) return;
    const allItems = [...items]; allItems[ciIdx] = editValue.trim();
    const newValue = allItems.filter(Boolean).join(', ');
    const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const orig = sentences2[sIdx] || '';
    const numM = orig.match(/^(\d+\.\s*)/);
    const numPrefix = numM ? numM[1] : '';
    sentences2[sIdx] = label ? `${numPrefix}${label} - ${newValue}` : `${numPrefix}${newValue}`;
    // preserve the original label delimiter (": " vs " - ")
    if (label && /^[^-–]*:/.test(orig.replace(/^\d+\.\s*/, ''))) sentences2[sIdx] = `${numPrefix}${label}: ${newValue}`;
    const fullText = reconstructFullText(sentences2);
    setSaveError(null);
    const localKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [commaKey]: true }));
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(record, idx, commaKey, localKey, fullText,
      { store: 'sentences', key: commaKey, value: 'edited' },
      { field: fn, value: fullText });
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue, splitBySentence, stageDraft]);

  // Save one comma-item of an object-leaf comma list — rejoin, stage the leaf edit as a DRAFT.
  const saveLeafComma = useCallback((record, rootField, path, idx, sid, items, ciIdx, commaKey) => {
    const allItems = [...items]; allItems[ciIdx] = editValue.trim();
    const fullText = allItems.filter(Boolean).join(', ');
    saveLeaf(record, rootField, path, idx, sid, commaKey, fullText);
  }, [editValue, saveLeaf]);

  // Save one item of an object-leaf ARRAY (e.g. prerequisites, imagesObtained) — splice the
  // array, stage the whole new array as the leaf value. DB write deferred to Approve.
  const saveLeafArrayItem = useCallback((record, rootField, path, idx, sid, arr, itemIdx, itemKey) => {
    const newArr = arr.map((it, i) => (i === itemIdx ? editValue.trim() : it)).filter(it => String(it ?? '').trim() !== '');
    saveLeaf(record, rootField, path, idx, sid, itemKey, newArr);
  }, [editValue, saveLeaf]);

  // saveSentence — stage a DRAFT (splice sentence into full text). DB write deferred to Approve.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const localKey = `${fn}-${idx}`;
    const sentenceKey = `${fn}-${idx}-s${sentenceIdx}`;
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [sentenceKey]: true }));
      setEditedSentences(prev => ({ ...prev, [sentenceKey]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      stageDraft(record, idx, sentenceKey, localKey, fullText,
        { store: 'sentences', key: sentenceKey, value: 'edited' },
        { field: fn, value: fullText });
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [sentenceKey]: true }));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const addedKeys = [];
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) addedKeys.push(`${fn}-${idx}-s${sentenceIdx + 1 + ei}`);
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[sentenceKey] = 'edited';
      addedKeys.forEach(ak => { n[ak] = 'added'; });
      return n;
    });
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(record, idx, sentenceKey, localKey, fullText,
      { store: 'sentences', key: sentenceKey, value: changed ? 'edited' : undefined, addedKeys },
      { field: fn, value: fullText });
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    if (sid === 'skin-lesions') {
      return Object.keys(editedFields).some(k => k.startsWith('skinLesions.') && k.endsWith(`-${idx}`));
    }
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Does a staged-draft editKey belong to this (idx, sid) section?
  const draftKeyInSection = useCallback((editKey, idx, sid) => {
    if (sid === 'skin-lesions') {
      return editKey.startsWith('skinLesions.') && (editKey.endsWith(`-${idx}`) || editKey.includes(`-${idx}-c`));
    }
    const fields = SECTION_FIELDS[sid] || [];
    // editKey forms: "field-idx", "field-idx-sN", "field-idx-rN", "rootField-idx-path.path"
    return fields.some(f => editKey === `${f}-${idx}` || editKey.startsWith(`${f}-${idx}-`) || editKey.startsWith(`${f}-${idx}.`));
  }, []);

  // Approve = COMMIT this section's staged drafts to MongoDB (replaying each stored PUT payload),
  // flag approved, then clear pending + drop committed drafts. This is the ONLY DB writer.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setApproving(true);
    try {
      const store = readDrafts();
      const recDrafts = (store[id] && typeof store[id] === 'object') ? store[id] : {};
      const committedKeys = [];
      for (const [editKey, entry] of Object.entries(recDrafts)) {
        if (!entry || typeof entry !== 'object' || !draftKeyInSection(editKey, idx, sid)) continue;
        const payload = { field: entry.db.field, value: entry.db.value };
        if (typeof entry.db.arrayIndex === 'number') payload.arrayIndex = entry.db.arrayIndex;
        const resp = await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedKeys.push(editKey);
      }
      await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/approve`, { sectionId: sid, approved: true });

      // Clear committed drafts from localStorage + pending markers → values now flow into PDF/Copy All
      if (store[id]) { committedKeys.forEach(k => delete store[id][k]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      if (sid === 'skin-lesions') {
        setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith('skinLesions.') && k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
        setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith('skinLesions.') && (k.endsWith(`-${idx}`) || k.includes(`-${idx}-c`))) delete n[k]; }); return n; });
      } else {
        const fields = SECTION_FIELDS[sid] || [];
        setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
        setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      }
    } catch (err) { console.error(err); }
    finally { setApproving(false); }
  }, [safeId, draftKeyInSection]);

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

  /* object → copy lines (recursive, canonical): DASH under every label/object key,
     every value row numbered; string leaf with >=3 guarded comma items → numbered rows;
     array leaf → numbered rows */
  const objectCopyLines = useCallback((label, value) => {
    const out = [];
    if (isEmptyDeep(value)) return out;
    if (Array.isArray(value)) {
      if (label) { out.push(label); out.push(COPY_LINE_DASH); }
      let n = 1;
      value.filter(v => !isEmptyDeep(v)).forEach((v) => {
        if (isScalar(v)) out.push(`${n++}. ${fmtScalar(v)}`);
        else out.push(...objectCopyLines('', v));
      });
      return out;
    }
    if (isScalar(value)) {
      if (label) { out.push(label); out.push(COPY_LINE_DASH); }
      const items = typeof value === 'string' ? splitByComma(String(value)) : [fmtScalar(value)];
      if (items.length >= 3) items.forEach((it, i) => out.push(`${i + 1}. ${it}`));
      else out.push(`1. ${fmtScalar(value)}`);
      return out;
    }
    if (label) { out.push(label); out.push(COPY_LINE_DASH); }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v)));
    return out;
  }, []);

  /* sentence field → copy lines: per-sentence parseLabel; labeled → sub-label + DASH +
     numbered comma rows (restart at 1); unlabeled → numbered rows (running count) */
  const formatSentenceFieldLines = useCallback((textVal) => {
    const lines = [];
    const sentences = splitBySentence(textVal);
    let running = 1;
    sentences.forEach(sentence => {
      const parsed = parseLabel(sentence);
      const value = (parsed.isLabeled ? parsed.value : sentence.replace(/^\d+\.\s*/, '')).replace(/[;.]+$/, '').trim();
      if (!value) return;
      const items = splitByComma(value);
      if (parsed.isLabeled) {
        lines.push(parsed.label);
        lines.push(COPY_LINE_DASH);
        if (items.length >= 3) items.forEach((it, i) => lines.push(`${i + 1}. ${it}`));
        else lines.push(`1. ${value}`);
      } else if (items.length >= 3) {
        items.forEach(it => lines.push(`${running++}. ${it}`));
      } else {
        lines.push(`${running++}. ${value}`);
      }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;

    if (sid === 'skin-lesions') {
      const lesions = getEffectiveLesions(record, idx);
      lesions.forEach((lesion, li) => {
        if (isEmptyDeep(lesion)) return;
        text += `${lesion.location || `Lesion ${li + 1}`}\n${COPY_LINE_DASH}\n`;
        LESION_SUB_FIELDS.forEach(sf => {
          if (!hasVal(lesion[sf])) return;
          text += `${LESION_LABELS[sf]}\n${COPY_LINE_DASH}\n`;
          const items = splitByComma(String(lesion[sf]));
          if (sf === 'dermoscopyFindings' && items.length >= 2) items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; });
          else text += `1. ${lesion[sf]}\n`;
        });
        text += '\n';
      });
      return text;
    }

    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const head = sameAsTitle ? '' : `${label}\n${COPY_LINE_DASH}\n`;

      if (DATE_FIELDS.includes(f)) { text += `${head}1. ${formatDate(val)}\n\n`; return; }
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val : [];
        text += head;
        let lastDate = null; let n = 1;
        recs.forEach((r) => {
          const rec = (r?.recommendation || '').trim();
          const date = (r?.date || '').trim();
          if (date !== lastDate) { if (date) text += `${date}\n${COPY_LINE_DASH}\n`; lastDate = date; n = 1; }
          if (rec) text += `${n++}. ${rec}\n`;
        });
        text += '\n'; return;
      }
      if (OBJECT_FIELDS.includes(f)) {
        text += head;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v).forEach(l => { text += `${l}\n`; }));
        text += '\n'; return;
      }
      if (SENTENCE_FIELDS.includes(f)) {
        text += head;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n'; return;
      }
      text += `${head}1. ${fmtVal(val)}\n\n`;
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatDate, getEffectiveLesions, objectCopyLines, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `Dermatology Assessment\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Dermatology Assessment ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      SECTION_ORDER.forEach(sid => {
        const st = buildSectionCopyText(r, idx, sid);
        // empty-section guard: title + EQ divider = 2 lines; require real content beyond them
        if (st.split('\n').filter(l => l.trim()).length > 2) text += st;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE FIELD ═══════ */
  const renderDateField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val.$date || val).split('T')[0]); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* stepper helpers: adjust editValue by the field's step, clamped >= 0 (clinical scores) */
  const stepEditValue = (dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      const s = stepFor(prev);
      const next = (isNaN(n) ? 0 : n) + dir * s;
      return String(Math.max(0, Math.round(next * 100) / 100));
    });
  };

  /* segmented-numeric helpers: per-number −/+ inside a measurement string, clamped >= 0 */
  const stepNum = (ni, dir) => setEditNums(prev => {
    if (!prev) return prev;
    const nums = [...prev.nums];
    const n = parseFloat(nums[ni]); const s = stepFor(nums[ni]);
    nums[ni] = String(Math.max(0, Math.round(((isNaN(n) ? 0 : n) + dir * s) * 100) / 100));
    return { ...prev, nums };
  });
  const setNum = (ni, v) => setEditNums(prev => {
    if (!prev) return prev;
    const nums = [...prev.nums]; nums[ni] = v;
    return { ...prev, nums };
  });

  /* ═══════ RENDER: NUMBER FIELD (−/+ stepper, hide-zero) ═══════ */
  const renderNumberField = (record, fn, idx, sid, title) => {
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
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>&#8722;</button>
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveField(record, fn, idx); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SIMPLE STRING FIELD (enum fields → <select>) ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    const enumOpts = ENUM_FIELDS[fn];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(enumOpts ? enumCanonical(enumOpts, displayVal) : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {enumOpts ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  {enumOptionsWith(enumOpts, displayVal).map(o => <option key={o} value={o}>{o}</option>)}
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF COMMA ROWS (string leaf with >=3 guarded comma items) ═══════ */
  const renderLeafCommaRows = (record, rootField, path, idx, sid, items) => (
    <div key={path[path.length - 1]} className="nested-mini-card">
      <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
      {items.map((ci, ciIdx) => {
        const commaKey = `${rootField}-${idx}-${path.join('.')}-c${ciIdx}`;
        const ciEditing = editingField === commaKey;
        const ciBadge = editedFields[commaKey];
        return (
          <div key={ciIdx}>
            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
              {ciEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLeafComma(record, rootField, path, idx, sid, items, ciIdx, commaKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT LEAF ARRAY ROW (scalar item of an array leaf, per-item editing) ═══════ */
  const renderLeafArrayRow = (record, rootField, path, idx, sid, arr, i, item) => {
    const itemKey = `${rootField}-${idx}-${path.join('.')}.${i}`;
    const isEditing = editingField === itemKey;
    const isModified = editedFields[itemKey];
    const itemStr = fmtScalar(item);
    return (
      <div key={i}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(itemStr); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLeafArrayItem(record, rootField, path, idx, sid, arr, i, itemKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> −/+ stepper, "4/5" ratio, bool -> select) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const commaItems = (!isBool && !ratio && !nu && typeof value === 'string') ? splitByComma(leafValueString) : [];
    if (commaItems.length >= 3) return renderLeafCommaRows(record, rootField, path, idx, sid, commaItems);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (ratio || nu) ? (
                <div className="number-edit-row">
                  <div className="num-stepper-row">
                    <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>&#8722;</button>
                    <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
                  </div>
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

  /* ═══════ RENDER: OBJECT NODE (recursive; arrays → per-item numbered-rows, NOT index keys) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    if (Array.isArray(value)) {
      if (value.filter(v => !isEmptyDeep(v)).length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          {value.map((it, i) => {
            if (isEmptyDeep(it)) return null;
            if (!isScalar(it)) return <div className="nested-mini-card" key={i}>{renderObjectNode(record, rootField, idx, sid, '', it, [...path, String(i)], depth + 1)}</div>;
            return renderLeafArrayRow(record, rootField, path, idx, sid, value, i, it);
          })}
        </React.Fragment>
      );
    }
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

  /* ═══════ RENDER: OBJECT FIELD ═══════ */
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
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRecItem(record, fn, idx, sid, rIdx, itemKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SENTENCE EDITABLE (per-sentence) ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title, showLabel = true) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = showLabel && label.toLowerCase() !== (title || '').toLowerCase();
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
            const stripNum = (s) => s.replace(/^\d+\.\s*/, '').replace(/[;.]+$/, '').trim();
            const displayText = (parsed.isLabeled ? parsed.value : stripNum(sentence)).replace(/[;.]+$/, '').trim();
            const commaItems = splitByComma(displayText);

            /* value with >=3 guarded comma items → one editable row per item */
            if (commaItems.length >= 3) {
              return (
                <div key={sIdx} className="rec-mini-card" style={{ marginTop: sIdx > 0 ? 8 : 0 }}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  {commaItems.map((ci, ciIdx) => {
                    const commaKey = `${sentenceKey}-c${ciIdx}`;
                    const ciEditing = editingField === commaKey;
                    const ciBadge = editedSentences[commaKey];
                    return (
                      <div key={ciIdx}>
                        <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                          {ciEditing ? (
                            <div className="edit-field-container">
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentenceComma(record, fn, idx, sid, sIdx, parsed.isLabeled ? parsed.label : '', commaItems, ciIdx, commaKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

            return (
              <div key={sIdx} className="rec-mini-card" style={{ marginTop: sIdx > 0 ? 8 : 0 }}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(displayText); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { saveLabeledSentence(record, fn, idx, sid, sIdx, sentenceKey, parsed.label); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(displayText)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: SKIN LESIONS SECTION ═══════ */
  const renderSkinLesionsSection = (record, idx) => {
    const lesions = getEffectiveLesions(record, idx);
    if (!lesions || lesions.length === 0) return null;
    if (!shouldShowSection(record, 'skin-lesions')) return null;
    const copyId = `skin-lesions-${idx}`;
    const phrase = searchTerm.toLowerCase().trim();

    return (
      <div key="skin-lesions" className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Skin Lesions')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, 'skin-lesions'), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'skin-lesions', idx)}
            </div>
          </div>
          {lesions.map((lesion, li) => {
            const locMatches = !searchTerm.trim() || sectionTitleMatches('skin-lesions') || record._showAllSections || (lesion.location && lesion.location.toLowerCase().includes(phrase)) || LESION_SUB_FIELDS.some(sf => lesion[sf] && String(lesion[sf]).toLowerCase().includes(phrase));
            if (!locMatches && searchTerm.trim()) return null;

            return (
              <div key={li} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(lesion.location || `Lesion ${li + 1}`)}</div>
                {LESION_SUB_FIELDS.map(sf => {
                  if (!hasVal(lesion[sf])) return null;
                  const sfEditKey = `skinLesions.${li}.${sf}-${idx}`;
                  const sfEditing = editingField === sfEditKey;
                  const sfModified = editedFields[sfEditKey];
                  const sfLabel = LESION_LABELS[sf];
                  const sfVal = String(lesion[sf]);

                  if (sf === 'dermoscopyFindings') {
                    const items = splitByComma(sfVal);
                    if (items.length >= 2) {
                      return (
                        <div key={sf} className="rec-mini-card" style={{ marginTop: 4 }}>
                          <div className="nested-subtitle">{highlightText(sfLabel)}</div>
                          {items.map((ci, ciIdx) => {
                            const commaKey = `skinLesions.${li}.${sf}-${idx}-c${ciIdx}`;
                            const ciEditing = editingField === commaKey;
                            const ciBadge = editedSentences[commaKey];
                            return (
                              <div key={ciIdx}>
                                <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                                  {ciEditing ? (
                                    <div className="edit-field-container">
                                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                      {saveError && <div className="save-error">{saveError}</div>}
                                      <div className="edit-actions">
                                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveDermoscopyComma(record, idx, li, sf, items, ciIdx, commaKey, sfEditKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

                  const numParsed = LESION_NUMERIC_FIELDS.includes(sf) ? parseNumeric(sfVal) : null;
                  return (
                    <div key={sf}>
                      <div className="nested-subtitle sub-label">{highlightText(sfLabel)}</div>
                      <div className={`numbered-row ${sfModified ? 'modified' : ''} editable-row`} onClick={() => { if (!sfEditing) { setEditingField(sfEditKey); setEditValue(sfVal); setEditNums(numParsed ? { literals: numParsed.literals, nums: [...numParsed.nums] } : null); setSaveError(null); } }}>
                        {sfEditing ? (
                          <div className="edit-field-container">
                            {numParsed && editNums ? (
                              <div className="number-edit-row">
                                {editNums.literals[0] ? <span className="number-edit-unit">{editNums.literals[0]}</span> : null}
                                {editNums.nums.map((n, ni) => (
                                  <React.Fragment key={ni}>
                                    <div className="num-seg">
                                      <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepNum(ni, -1); }}>&#8722;</button>
                                      <input type="number" step="any" className="edit-number" value={n} autoFocus={ni === 0} onChange={e => setNum(ni, e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setEditNums(null); setSaveError(null); } }} />
                                      <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepNum(ni, 1); }}>+</button>
                                    </div>
                                    {editNums.literals[ni + 1] ? <span className="number-edit-unit">{editNums.literals[ni + 1]}</span> : null}
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : (
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            )}
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const vo = (numParsed && editNums) ? rebuildNumeric(editNums.literals, editNums.nums) : undefined; saveLesionField(record, idx, li, sf, vo); setEditNums(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setEditNums(null); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(sfVal)}</span><span className="edit-indicator">&#9998;</span></div>
                            <button className={`copy-btn ${copiedItems[sfEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sfLabel}\n${sfVal}`, sfEditKey); }}>{copiedItems[sfEditKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {sfModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title, false);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="dermatology-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dermatology Assessment</h2></div>
        <div className="empty-state">No dermatology assessment records available</div>
      </div>
    );
  }

  return (
    <div className="dermatology-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dermatology Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DermatologyAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Dermatology_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dermatology assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.status && <span className="record-status">{highlightText(record.status)}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Dermatology Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'provider-details')}
            {renderSkinLesionsSection(record, idx)}
            {renderSection(record, idx, 'scores')}
            {renderSection(record, idx, 'biopsy-results')}
            {renderSection(record, idx, 'phototherapy')}
            {renderSection(record, idx, 'photography')}
            {renderSection(record, idx, 'melanoma-surveillance')}
            {renderSection(record, idx, 'systemic-therapy')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'findings')}
            {renderSection(record, idx, 'assessment')}
            {renderSection(record, idx, 'plan')}
            {renderSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DermatologyAssessmentDocument;
