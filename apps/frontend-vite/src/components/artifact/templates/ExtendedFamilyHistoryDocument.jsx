/**
 * ExtendedFamilyHistoryDocument.jsx
 * March 2026 — inline editing, blue glow theme. One-pass polish July 2026 (Brian Richardson,
 * autosomal-dominant cardiomyopathy pedigree). Collection: extended_family_history
 *
 * 10 Sections:
 *   1. session-info: date (BlueDatePicker), provider (PARTS — '; '-separated clinicians → one row
 *      each, parts kept whole as name+credentials), facility (plain)
 *   2. family-conditions: 7 relative-conditions string arrays (labeled items → sub-label + value row)
 *   3-5. cardiovascular/cancer/diabetes history (objects → sub-label + value rows; single-name gate
 *      hides the field label; values with ≥3 guarded comma items split into per-item rows)
 *   6-9. neurologic/psychiatric/autoimmune/genetic disorder arrays (single-name sections)
 *  10. additional-info: consanguinity, ethnicBackground (plain), ageOfOnsetPatterns,
 *      thromboembolicHistory (objects), multipleAffectedRelatives, bilateralCancerHistory (arrays),
 *      pedigreeGenerationsDocumented (−/+ stepper, 0 = not documented → hidden),
 *      geneticCounselingRecommended (sentence — [.;] + comma split)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ExtendedFamilyHistoryDocumentPDFTemplate from '../pdf-templates/ExtendedFamilyHistoryDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './ExtendedFamilyHistoryDocument.css';

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'family-conditions': 'Family Member Conditions',
  'cardiovascular-history': 'Cardiovascular Disease History',
  'cancer-history': 'Cancer History',
  'diabetes-history': 'Diabetes History',
  'neurologic-history': 'Neurologic Disorder History',
  'psychiatric-history': 'Psychiatric Disorder History',
  'autoimmune-history': 'Autoimmune Disorder History',
  'genetic-history': 'Genetic Disorder History',
  'additional-info': 'Additional Information',
};

/* Single-field disorder sections: label == section title so the single-name gate hides the
   duplicate sub-label in all 4 areas (JSX / Copy Section / Copy All / PDF). */
const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  maternalGrandmotherConditions: 'Maternal Grandmother',
  maternalGrandfatherConditions: 'Maternal Grandfather',
  paternalGrandmotherConditions: 'Paternal Grandmother',
  paternalGrandfatherConditions: 'Paternal Grandfather',
  maternalAuntsUnclesConditions: 'Maternal Aunts/Uncles',
  paternalAuntsUnclesConditions: 'Paternal Aunts/Uncles',
  cousinConditions: 'Cousins',
  cardiovascularDiseaseHistory: 'Cardiovascular Disease History',
  cancerHistory: 'Cancer History',
  diabetesHistory: 'Diabetes History',
  neurologicDisorderHistory: 'Neurologic Disorder History',
  psychiatricDisorderHistory: 'Psychiatric Disorder History',
  autoimmuneDisorderHistory: 'Autoimmune Disorder History',
  geneticDisorderHistory: 'Genetic Disorder History',
  consanguinity: 'Consanguinity',
  ethnicBackground: 'Ethnic Background',
  ageOfOnsetPatterns: 'Age of Onset Patterns',
  multipleAffectedRelatives: 'Multiple Affected Relatives',
  bilateralCancerHistory: 'Bilateral Cancer History',
  thromboembolicHistory: 'Thromboembolic History',
  pedigreeGenerationsDocumented: 'Pedigree Generations Documented',
  geneticCounselingRecommended: 'Genetic Counseling Recommended',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility'],
  'family-conditions': ['maternalGrandmotherConditions', 'maternalGrandfatherConditions', 'paternalGrandmotherConditions', 'paternalGrandfatherConditions', 'maternalAuntsUnclesConditions', 'paternalAuntsUnclesConditions', 'cousinConditions'],
  'cardiovascular-history': ['cardiovascularDiseaseHistory'],
  'cancer-history': ['cancerHistory'],
  'diabetes-history': ['diabetesHistory'],
  'neurologic-history': ['neurologicDisorderHistory'],
  'psychiatric-history': ['psychiatricDisorderHistory'],
  'autoimmune-history': ['autoimmuneDisorderHistory'],
  'genetic-history': ['geneticDisorderHistory'],
  'additional-info': ['consanguinity', 'ethnicBackground', 'ageOfOnsetPatterns', 'multipleAffectedRelatives', 'bilateralCancerHistory', 'thromboembolicHistory', 'pedigreeGenerationsDocumented', 'geneticCounselingRecommended'],
};

const STRING_ARRAY_FIELDS = [
  'maternalGrandmotherConditions', 'maternalGrandfatherConditions',
  'paternalGrandmotherConditions', 'paternalGrandfatherConditions',
  'maternalAuntsUnclesConditions', 'paternalAuntsUnclesConditions',
  'cousinConditions', 'neurologicDisorderHistory', 'psychiatricDisorderHistory',
  'autoimmuneDisorderHistory', 'geneticDisorderHistory',
  'multipleAffectedRelatives', 'bilateralCancerHistory',
];

const OBJECT_FIELDS = [
  'cardiovascularDiseaseHistory', 'cancerHistory', 'diabetesHistory',
  'ageOfOnsetPatterns', 'thromboembolicHistory',
];

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['pedigreeGenerationsDocumented'];
/* pedigreeGenerationsDocumented 0 = "pedigree not documented" extractor sentinel → hidden. */
const ZERO_SENTINEL_FIELDS = ['pedigreeGenerationsDocumented'];
/* PARTS fields: '; '-separated clinician list → one row per part; parts kept WHOLE (name +
   credentials, never comma-split); per-part edits rejoin with '; '. */
const PARTS_FIELDS = ['provider'];
/* Narrative fields → sentence-split ([.;]) + guarded comma-split, numbered in Copy/PDF only. */
const SENTENCE_FIELDS = ['geneticCounselingRecommended'];

/* Copy dividers: EQ (====) under section/record titles, DASH (----) under EVERY field label + sub-label. */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* Comma-split an object leaf / labeled item value only when it is a real list (≥3 items) —
   2-item values like "Died age 52, heart failure" read as one clinical statement and stay whole. */
const LEAF_SPLIT_MIN = 3;

/* stepFor: decimal-aware step for the −/+ number stepper (3 → 1, 0.5 → 0.1). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split. Keeps a comma JOINED when it is a decimal grouping
   ("5,000"), a continuation conjunction ("…, and/or/then …"), or follows a trailing and/or. */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const nextChar = rest.charAt(0);
      const restTrim = rest.replace(/^\s+/, '');
      if ((nextChar && /\d/.test(nextChar)) || /^(and|or|then)\b/i.test(restTrim) || /\b(and|or)$/i.test(current.trim())) {
        current += ch;
      } else {
        const t = current.trim(); if (t) result.push(t); current = '';
      }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* provider parts: '; '-separated clinicians */
const splitParts = (text) => String(text || '').split(/;\s*/).map(s => s.trim()).filter(Boolean);

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* camelCase -> Title Case ("paternalUncle1" → "Paternal Uncle 1") */
const camelToTitle = (str) => {
  if (!str) return '';
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/\d+/g, m => ` ${m}`)
    .trim();
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field", "field.arrayIndex" or "field.subKey") */
const DRAFT_KEY = 'extended_family_historyPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ======= COMPONENT ======= */
const ExtendedFamilyHistoryDocument = ({ document: docProp }) => {
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
  // sub-row badges (sentence rows / provider parts / object-leaf parts) — keys start `${fn}-${idx}`
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.extended_family_history) return Array.isArray(r.extended_family_history) ? r.extended_family_history : [r.extended_family_history];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.extended_family_history) return Array.isArray(dd.extended_family_history) ? dd.extended_family_history : [dd.extended_family_history]; return [dd]; }
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

  /* ======= UTILS ======= */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

  const getArrayItemValue = useCallback((record, fn, idx, arrIdx) => {
    const k = `${fn}.${arrIdx}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record[fn];
    if (!Array.isArray(arr) || !arr[arrIdx]) return undefined;
    return arr[arrIdx];
  }, [localEdits]);

  const getObjectSubValue = useCallback((record, fn, idx, subKey) => {
    const k = `${fn}.${subKey}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const obj = record[fn];
    if (!obj || typeof obj !== 'object') return undefined;
    return obj[subKey];
  }, [localEdits]);

  /* hide-zero: 0 in a sentinel field = "not documented" → hidden unless staged-edited to 0 */
  const numberShows = useCallback((record, fn, idx) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (Number.isNaN(num)) return false;
    if (num === 0 && ZERO_SENTINEL_FIELDS.includes(fn)) return Boolean(editedFields[`${fn}-${idx}`]);
    return true;
  }, [getFieldValue, editedFields]);

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

  /* ======= SEARCH ======= */
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
        if (Array.isArray(val)) {
          for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
        } else if (typeof val === 'object') {
          for (const [k, v] of Object.entries(val)) { if (camelToTitle(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase)) return true; }
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      if (typeof val === 'object') return Object.entries(val).some(([k, v]) => camelToTitle(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Extended Family History ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
          } else if (val && typeof val === 'object') {
            for (const [k, v] of Object.entries(val)) { if (camelToTitle(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase)) return true; }
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 2) {
            const [parentField, sub] = dotParts;
            if (Array.isArray(record[parentField])) {
              if (!merged[parentField] || merged[parentField] === record[parentField]) merged[parentField] = [...(record[parentField] || [])];
              merged[parentField][parseInt(sub)] = localEdits[key];
            } else if (typeof record[parentField] === 'object' && record[parentField] !== null) {
              if (!merged[parentField] || merged[parentField] === record[parentField]) merged[parentField] = { ...(record[parentField] || {}) };
              merged[parentField][sub] = localEdits[key];
            }
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ======= EDIT HANDLERS =======
     Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits). */

  // Reverse-lookup the sectionId that owns a field, so re-editing can drop a prior 'approved' flag.
  const sidForField = useCallback((fn) => {
    for (const [sid, fields] of Object.entries(SECTION_FIELDS)) { if (fields.includes(fn)) return sid; }
    return null;
  }, []);

  // Stage a draft: localEdits + pendingEdits + editedFields marker, clear the approved flag, persist to localStorage.
  const stageDraft = useCallback((record, fn, idx, fieldPart, value) => {
    const id = safeId(record);
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow Pending Approve
    const sid = sidForField(fn);
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    if (id) {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fieldPart] = value;
      writeDrafts(store);
    }
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId, sidForField]);

  const handleSaveField = useCallback((record, fn, idx, _sid, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    stageDraft(record, fn, idx, fn, saveVal);
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    stageDraft(record, fn, idx, `${fn}.${arrIdx}`, value);
  }, [safeId, stageDraft]);

  const handleSaveObjectSub = useCallback((record, fn, idx, subKey, value) => {
    const id = safeId(record); if (!id) return;
    stageDraft(record, fn, idx, `${fn}.${subKey}`, value);
  }, [safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      stageDraft(record, fn, idx, fn, reconstructFullText(updated));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    stageDraft(record, fn, idx, fn, reconstructFullText(updated));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
  }

  /* ======= APPROVE ======= */
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
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Collect this section's staged (pending) edits from localEdits using the "-<idx>" suffix convention.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field", "field.arrayIndex" or "field.subKey"
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return fields.includes(baseField);
      });
      // Persist each staged field to the DB now.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          // Array element: "field.<n>" -> field + arrayIndex
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(tail, 10);
        } else {
          // Plain field or object sub-path ("field" or "field.subKey") -> field stays whole, no arrayIndex
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/extended_family_history/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/extended_family_history/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); if (store[id]) delete store[id][fp]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[ExtendedFamilyHistory] Approve error:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ======= COPY ======= */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ======= COPY TEXT BUILDERS ======= */
  // Sentence field → numbered lines (labeled → sub-heading + comma rows; unlabeled → comma rows or whole).
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
      } else {
        const parts = splitByComma(s);
        if (parts.length >= 2) { parts.forEach(item => { lines.push(`${n++}. ${item}`); }); }
        else { lines.push(`${n++}. ${s}`); }
      }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = '';
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sl = label.toLowerCase() !== (title || '').toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (NUMBER_FIELDS.includes(f)) { if (!numberShows(record, f, idx)) return; }
      else if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += sl ? `${label}\n${COPY_LINE_DASH}\n${formatDate(val)}\n\n` : `${formatDate(val)}\n\n`;
      } else if (PARTS_FIELDS.includes(f)) {
        const parts = splitParts(val);
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        parts.forEach((p, i) => { text += `${i + 1}. ${p}\n`; });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        const entries = Object.entries(val).filter(([, v]) => hasVal(v));
        if (entries.length === 0) return;
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        entries.forEach(([k, v]) => {
          const subStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
          text += `${camelToTitle(k)}\n${COPY_LINE_DASH}\n`;
          const parts = splitByComma(subStr);
          if (parts.length >= LEAF_SPLIT_MIN) { parts.forEach((p, i) => { text += `${i + 1}. ${p}\n`; }); }
          else { text += `1. ${subStr}\n`; }
        });
        text += '\n';
      } else if (STRING_ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val : [val];
        if (arr.length === 0) return;
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        // Numbering RESTARTS at each LABELED group; unlabeled items continue the running count.
        let n = 1;
        arr.forEach(item => {
          const itemStr = String(item);
          const parsed = parseLabel(itemStr);
          if (parsed.isLabeled) {
            const parts = splitByComma(parsed.value);
            text += `${parsed.label}\n${COPY_LINE_DASH}\n`;
            n = 1;
            parts.forEach(p => { text += `${n++}. ${p}\n`; });
          } else {
            text += `${n++}. ${itemStr}\n`;
          }
        });
        text += '\n';
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        // plain (facility, consanguinity, ethnicBackground) / number
        text += sl ? `${label}\n${COPY_LINE_DASH}\n${fmtVal(val)}\n\n` : `${fmtVal(val)}\n\n`;
      }
    });
    // Empty-section drop: a section with no populated fields emits NOTHING (never a bare title+divider).
    return text.trim() ? `${title}\n${COPY_LINE_EQ}\n\n${text}` : '';
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, numberShows]);

  const copyAllText = useCallback(async () => {
    let text = '=== EXTENDED FAMILY HISTORY ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Extended Family History ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: DATE FIELD (BlueDatePicker) ======= */
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
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'✎'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: PARTS FIELD (provider — '; '-separated clinicians, one row each) ======= */
  const renderPartsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const parts = splitParts(val);
    if (parts.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {parts.map((part, pi) => {
          const partKey = `${fn}-${idx}-p${pi}`;
          const isEditing = editingField === partKey;
          const badge = editedSentences[partKey];
          return (
            <div key={pi}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(partKey); setEditValue(part); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const current = splitParts(String(getFieldValue(record, fn, idx) || '')); const trimmed = editValue.trim(); if (trimmed) current[pi] = trimmed; else current.splice(pi, 1); stageDraft(record, fn, idx, fn, current.join('; ')); setEditedSentences(prev => ({ ...prev, [partKey]: 'edited' })); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">{'✎'}</span></div>
                    <button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(part, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: NUMBER FIELD (−/+ stepper) ======= */
  const renderNumberField = (record, fn, idx, sid) => {
    if (!numberShows(record, fn, idx)) return null;
    const val = getFieldValue(record, fn, idx);
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
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); const numVal = Number(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, numVal); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'✎'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: SIMPLE EDITABLE FIELD (facility, consanguinity, ethnicBackground) ======= */
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
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'✎'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: SENTENCE FIELD ([.;] split + comma-split; geneticCounselingRecommended) ======= */
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
            const commaItems = splitByComma(parsed.isLabeled ? parsed.value : sentence);
            if (commaItems.length >= 2) {
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  {commaItems.map((ci, ciIdx) => {
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
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); const items2 = splitByComma(p2.isLabeled ? p2.value : s2); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else if (trimmed) { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } else { items2.splice(ciIdx, 1); } const rebuilt = p2.isLabeled ? `${p2.label}: ${items2.join(', ')}.` : items2.join(', '); const allS = [...sentences2]; allS[sIdx] = rebuilt; stageDraft(record, fn, idx, fn, reconstructFullText(allS)); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); }}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">{'✎'}</span></div>
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
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const reconstructed = `${parsed.label}: ${trimmed}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; stageDraft(record, fn, idx, fn, reconstructFullText(sentences2)); setEditedSentences(prev => ({ ...prev, [sentenceKey]: 'edited' })); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">{'✎'}</span></div>
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

  /* ======= RENDER: STRING ARRAY FIELD (each item editable; labeled → sub-label + value row) ======= */
  const renderStringArrayField = (record, idx, fn, sid, title) => {
    const arr = getFieldValue(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, arrIdx) => {
          const itemVal = getArrayItemValue(record, fn, idx, arrIdx) ?? item;
          if (!itemVal) return null;
          const itemStr = String(itemVal);

          if (searchTerm.trim() && !phraseMatch) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!itemStr.toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
          }

          const editKey = `${fn}.${arrIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const parsed = parseLabel(itemStr);

          return (
            <div key={arrIdx}>
              {parsed.isLabeled && <div className="nested-subtitle sub-label" style={{ marginTop: arrIdx > 0 ? 4 : 0 }}>{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
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
                    <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : itemStr)}</span><span className="edit-indicator">{'✎'}</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ======= RENDER: OBJECT FIELD (sub-label + value rows; ≥3-comma values split into per-item rows;
     single-name gate hides the field label when it equals the section title) ======= */
  const renderObjectField = (record, idx, fn, sid, title) => {
    const obj = getFieldValue(record, fn, idx);
    if (!hasVal(obj)) return null;

    if (Array.isArray(obj)) return renderStringArrayField(record, idx, fn, sid, title);
    if (typeof obj !== 'object') return renderEditableField(record, fn, idx, sid, title);

    const keys = Object.keys(obj);
    if (keys.length === 0) return null;

    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {keys.map(subKey => {
          const subVal = getObjectSubValue(record, fn, idx, subKey) ?? obj[subKey];
          if (!hasVal(subVal)) return null;
          const subStr = typeof subVal === 'object' ? JSON.stringify(subVal) : String(subVal);
          const subLabel = camelToTitle(subKey);

          if (searchTerm.trim() && !phraseMatch) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!subLabel.toLowerCase().includes(phrase) && !subStr.toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
          }

          const groupKey = `${fn}.${subKey}-${idx}`;
          const groupModified = editedFields[groupKey];
          const parts = splitByComma(subStr);
          const doSplit = parts.length >= LEAF_SPLIT_MIN;

          /* ≥3-item comma list → sub-label + one editable row per item (edits splice + rejoin ', ') */
          if (doSplit) {
            return (
              <div key={subKey}>
                <div className="nested-subtitle sub-label" style={{ marginTop: 4 }}>{highlightText(subLabel)}</div>
                {parts.map((part, pi) => {
                  const partKey = `${fn}-${idx}-k${subKey}-p${pi}`;
                  const partEditing = editingField === partKey;
                  const partBadge = editedSentences[partKey];
                  return (
                    <div key={pi}>
                      <div className={`numbered-row ${partBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!partEditing) { setEditingField(partKey); setEditValue(part); setSaveError(null); } }}>
                        {partEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const curStr = String((getObjectSubValue(record, fn, idx, subKey) ?? obj[subKey]) || ''); const items2 = splitByComma(curStr); const trimmed = editValue.trim(); if (trimmed) items2[pi] = trimmed; else items2.splice(pi, 1); handleSaveObjectSub(record, fn, idx, subKey, items2.join(', ')); setEditedSentences(prev => ({ ...prev, [partKey]: 'edited' })); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">{'✎'}</span></div>
                            <button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(part, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {partBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                })}
              </div>
            );
          }

          const isEditing = editingField === groupKey;
          return (
            <div key={subKey}>
              <div className="nested-subtitle sub-label" style={{ marginTop: 4 }}>{highlightText(subLabel)}</div>
              <div className={`numbered-row ${groupModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(groupKey); setEditValue(subStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveObjectSub(record, fn, idx, subKey, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(subStr)}</span><span className="edit-indicator">{'✎'}</span></div>
                    <button className={`copy-btn ${copiedItems[groupKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}\n${subStr}`, groupKey); }}>{copiedItems[groupKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {groupModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: GENERIC SECTION ======= */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      if (NUMBER_FIELDS.includes(f)) return numberShows(record, f, idx);
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
            if (PARTS_FIELDS.includes(f)) return renderPartsField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, idx, f, sid, title);
            if (STRING_ARRAY_FIELDS.includes(f)) return renderStringArrayField(record, idx, f, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="extended-family-history-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Extended Family History</h2></div>
        <div className="empty-state">No extended family history records available</div>
      </div>
    );
  }

  return (
    <div className="extended-family-history-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Extended Family History</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ExtendedFamilyHistoryDocumentPDFTemplate document={pdfData} />} fileName="Extended_Family_History.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search extended family history..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Extended Family History ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'family-conditions')}
            {renderSection(record, idx, 'cardiovascular-history')}
            {renderSection(record, idx, 'cancer-history')}
            {renderSection(record, idx, 'diabetes-history')}
            {renderSection(record, idx, 'neurologic-history')}
            {renderSection(record, idx, 'psychiatric-history')}
            {renderSection(record, idx, 'autoimmune-history')}
            {renderSection(record, idx, 'genetic-history')}
            {renderSection(record, idx, 'additional-info')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExtendedFamilyHistoryDocument;
