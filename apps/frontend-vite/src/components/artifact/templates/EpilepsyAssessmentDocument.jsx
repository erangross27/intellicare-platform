/**
 * EpilepsyAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: epilepsy_assessment
 *
 * 7 Sections:
 *   1. session-info: date (date picker), provider, facility, status
 *   2. seizure-profile: seizureTypes[], seizureFrequency, lastSeizure
 *   3. triggers-aura: triggers[], auraSymptoms[]
 *   4. postictal-section: postictalSymptoms[]
 *   5. medications: antiEpilepticDrugs[] — {medication, dose, level, sideEffects}
 *   6. eeg-section: eegFindings (parseLabel sentence)
 *   7. seizure-diary: seizureDiary[] — object array (generic object items)
 *   8. vns-section: vagusNerveStimulator (OBJECT, recursive editable leaves)
 *   9. clinical-notes: findings (sentence), assessment (sentence), plan (sentence+rejoinOrphans), notes (sentence)
 *  10. results-section: results (OBJECT, recursive editable leaves)
 *  11. recommendations-section: recommendations[] — object array {recommendation, date}, date-grouped
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EpilepsyAssessmentDocumentPDFTemplate from '../pdf-templates/EpilepsyAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import './EpilepsyAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = localEdits key minus the trailing "-<idx>") */
const DRAFT_KEY = 'epilepsy_assessmentPendingEdits';
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
  'seizure-profile': 'Seizure Profile',
  'triggers-aura': 'Triggers & Aura',
  'postictal-section': 'Postictal Symptoms',
  'medications': 'Anti-Epileptic Medications',
  'eeg-section': 'EEG Findings',
  'seizure-diary': 'Seizure Diary',
  'vns-section': 'Vagus Nerve Stimulator',
  'clinical-notes': 'Clinical Notes',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  seizureTypes: 'Seizure Types',
  seizureFrequency: 'Seizure Frequency',
  lastSeizure: 'Last Seizure',
  triggers: 'Triggers',
  auraSymptoms: 'Aura Symptoms',
  postictalSymptoms: 'Postictal Symptoms',
  antiEpilepticDrugs: 'Anti-Epileptic Drugs',
  eegFindings: 'EEG Findings',
  seizureDiary: 'Seizure Diary',
  vagusNerveStimulator: 'Vagus Nerve Stimulator',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  results: 'Results',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'seizure-profile': ['seizureTypes', 'seizureFrequency', 'lastSeizure'],
  'triggers-aura': ['triggers', 'auraSymptoms'],
  'postictal-section': ['postictalSymptoms'],
  'medications': ['antiEpilepticDrugs'],
  'eeg-section': ['eegFindings'],
  'seizure-diary': ['seizureDiary'],
  'vns-section': ['vagusNerveStimulator'],
  'clinical-notes': ['findings', 'assessment', 'plan', 'notes'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
};

const STRING_ARRAY_FIELDS = ['seizureTypes', 'triggers', 'auraSymptoms', 'postictalSymptoms'];
const OBJECT_ARRAY_FIELDS = ['antiEpilepticDrugs'];
const GENERIC_OBJECT_ARRAY_FIELDS = ['seizureDiary'];
const RECOMMENDATION_ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['vagusNerveStimulator', 'results'];
const AED_SUB_FIELDS = ['medication', 'dose', 'level', 'sideEffects'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes', 'eegFindings', 'seizureFrequency'];
const DATE_FIELDS = ['date'];

/* Known clinical/record enum → themed BlueSelect dropdown (edit-widget-only; unmatched stored value preserved). */
const ENUM_FIELDS = {
  status: ['Active', 'Completed', 'Not Active'],
};
const enumCanonical = (options, current) => {
  if (current === null || current === undefined || String(current).trim() === '') return '';
  const c = String(current).trim().toLowerCase();
  const match = (options || []).find(o => o.toLowerCase() === c);
  return match || String(current).trim();
};
const enumOptionsWith = (options, current) => {
  const canon = enumCanonical(options, current);
  if (canon && !(options || []).some(o => o.toLowerCase() === canon.toLowerCase())) return [canon, ...(options || [])];
  return options || [];
};
/* −/+ stepper step = the value's OWN precision (decimal-aware): integer→1, 0.1-value→0.1, 0.01-value→0.01. */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
/* stripLeadingNum: remove a "1. " / "2) " list prefix — used so the numbered `plan` field shows UNNUMBERED rows
   in the JSX (numbering lives only in Copy/PDF). The prefix is preserved in storage + re-added on save. */
const stripLeadingNum = (s) => String(s ?? '').replace(/^\s*\d+[.)]\s+/, '');
/* Copy dividers (one-pass item 2): '='×40 under section/record titles, '-'×40 under every field
   sub-label / sub-category — the text mirror of the PDF box-free underlines. */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* humanizeKey: snake/camel → "Title Case" for generic object keys */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* number+unit leaf splitter — returns null for plain text and "4/5" ratios */
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (isScalar(v)) return fmtScalar(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split with guards for free narrative —
   never split a numeric comma with no following space ("18,000") and keep an Oxford "and/or"
   on either side joined ("structural (x), functional (y), and electrophysiological (z)"). */
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const EpilepsyAssessmentDocument = ({ document: docProp }) => {
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
      if (r?.epilepsy_assessment) return Array.isArray(r.epilepsy_assessment) ? r.epilepsy_assessment : [r.epilepsy_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.epilepsy_assessment) return Array.isArray(dd.epilepsy_assessment) ? dd.epilepsy_assessment : [dd.epilepsy_assessment]; return [dd]; }
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
        // Mark edited so the section's "Pending Approve" button shows after refresh.
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

  const recsToText = useCallback((recs) => { if (!Array.isArray(recs)) return ''; return recs.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' '); }, []);
  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (RECOMMENDATION_ARRAY_FIELDS.includes(f)) return recsToText(val);
    if (OBJECT_FIELDS.includes(f) || GENERIC_OBJECT_ARRAY_FIELDS.includes(f)) return flattenSearchable(val);
    if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(val) ? val.map(it => AED_SUB_FIELDS.map(sf => fmtVal(it?.[sf])).join(' ')).join(' ') : '';
    if (Array.isArray(val)) return val.map(fmtVal).join(' ');
    return fmtVal(val);
  }, [recsToText, fmtVal]);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  /* rejoinOrphans: after splitBySentence on numbered text ("1. ... 2. ..."),
     any fragment that does NOT start with a number prefix is joined back to the previous item */
  const splitBySentenceRejoin = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const t = text.trim();
    if (!t) return [];
    // Numbered list ("1. ... 2. ...") → split ONLY at a period/paren + space that PRECEDES the next
    // "N. " marker, so each item keeps its own internal periods/commas intact (a plain splitBySentence
    // shatters "1. " into a bare "1" and merges everything). Non-numbered text → normal sentence split.
    if (/^\s*\d+[.)]\s/.test(t)) {
      return t.split(/(?<=[.)])\s+(?=\d+[.)]\s)/).map(s => s.trim()).filter(Boolean);
    }
    return splitBySentence(t);
  }, [splitBySentence]);

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

  const getAedItemValue = useCallback((record, fn, idx, arrIdx, subField) => {
    const k = `${fn}.${arrIdx}.${subField}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record[fn];
    if (!Array.isArray(arr) || !arr[arrIdx]) return undefined;
    return arr[arrIdx][subField];
  }, [localEdits]);

  const getStringArrayItemValue = useCallback((record, fn, idx, arrIdx) => {
    const k = `${fn}.${arrIdx}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record[fn];
    if (!Array.isArray(arr)) return undefined;
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
      if (val !== null && val !== undefined && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) return fieldSearchText(fn, val).toLowerCase().includes(phrase);
    return false;
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Epilepsy Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fieldSearchText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 3) {
            const [arrField, arrIdx, subField] = dotParts;
            if (!merged[arrField]) merged[arrField] = [...(record[arrField] || [])];
            else merged[arrField] = [...merged[arrField]];
            if (merged[arrField][parseInt(arrIdx)]) {
              merged[arrField][parseInt(arrIdx)] = { ...merged[arrField][parseInt(arrIdx)], [subField]: localEdits[key] };
            }
          } else if (dotParts.length === 2) {
            const [arrField, arrIdx] = dotParts;
            if (!merged[arrField]) merged[arrField] = [...(record[arrField] || [])];
            else merged[arrField] = [...merged[arrField]];
            merged[arrField][parseInt(arrIdx)] = localEdits[key];
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* stageDraft: write a single staged edit into the pending-drafts localStorage store (survives refresh).
     The editKey is "<fieldPart>-<idx>"; fieldPart (key minus the trailing "-<idx>") is the draft store sub-key.
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve. */
  const stageDraft = useCallback((record, idx, editKey, value, sid) => {
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending Approve.
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const id = safeId(record);
    if (id) {
      const suffix = `-${idx}`;
      const fieldPart = editKey.endsWith(suffix) ? editKey.slice(0, -suffix.length) : editKey;
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fieldPart] = value;
      writeDrafts(store);
    }
    setEditingField(null); setEditValue('');
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    stageDraft(record, idx, editKey, saveVal, sid);
  }, [editValue, safeId, stageDraft]);

  const handleSaveAedItem = useCallback((record, fn, idx, arrIdx, subField, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}.${arrIdx}.${subField}-${idx}`;
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    stageDraft(record, idx, editKey, value);
  }, [safeId, stageDraft]);

  const handleSaveStringArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}.${arrIdx}-${idx}`;
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    stageDraft(record, idx, editKey, value);
  }, [safeId, stageDraft]);

  /* saveStringArrayCommaItem: edit ONE comma item of a LABELED string-array element (e.g. a seizure type
     "Label: a, b, c"). Rebuilds "Label: a, b, c" and stages the whole element as a draft. */
  function saveStringArrayCommaItem(record, fn, idx, arrIdx, ciIdx) {
    const id = safeId(record); if (!id) return;
    const itemVal = String(getStringArrayItemValue(record, fn, idx, arrIdx) ?? (Array.isArray(record[fn]) ? record[fn][arrIdx] : '') ?? '');
    const p = parseLabel(itemVal);
    const items = splitByComma(p.isLabeled ? p.value : itemVal);
    const trimmed = editValue.trim();
    const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(Boolean);
    if (subParts.length > 1) { items.splice(ciIdx, 1, ...subParts); } else { items[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    const joined = items.join(', ');
    const rebuilt = p.isLabeled ? `${p.label}: ${joined}` : joined;
    setEditedFields(prev => ({ ...prev, [`${fn}.${arrIdx}.c${ciIdx}-${idx}`]: 'edited' }));
    stageDraft(record, idx, `${fn}.${arrIdx}-${idx}`, rebuilt);
    setEditingField(null); setEditValue('');
  }

  /* save a nested OBJECT leaf by dot-path (e.g. results.ef) — value stays its typed scalar.
     Staged as a draft: the FULL merged object is stored under "<rootField>-<idx>" (Approve writes the whole field). */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => {
      const cur = prev[`${rootField}-${idx}`] !== undefined ? prev[`${rootField}-${idx}`] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      const editKey = `${rootField}-${idx}`;
      setPendingEdits(p => ({ ...p, [editKey]: true }));
      const recId = safeId(record);
      if (recId) {
        const store = readDrafts();
        if (!store[recId]) store[recId] = {};
        store[recId][rootField] = clone; // fieldPart = rootField (no numeric suffix → whole-object write on Approve)
        writeDrafts(store);
      }
      return { ...prev, [editKey]: clone };
    });
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }, [safeId]);

  function saveSentence(record, fn, idx, sid, sentenceIdx, usePlanRejoin) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = usePlanRejoin ? splitBySentenceRejoin(currentVal) : splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const numMatch = usePlanRejoin ? String(sentences[sentenceIdx] || '').match(/^\s*(\d+[.)])\s+/) : null;
    const numPrefix = numMatch ? numMatch[1] + ' ' : '';
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      stageDraft(record, idx, `${fn}-${idx}`, fullText, sid);
      return;
    }
    const splitter = usePlanRejoin ? splitBySentenceRejoin : splitBySentence;
    const newSentences = splitter(editedVal);
    if (numPrefix && newSentences.length > 0) newSentences[0] = numPrefix + newSentences[0];
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    stageDraft(record, idx, `${fn}-${idx}`, fullText, sid);
  }

  /* saveSentenceCommaItem: commit an edit to ONE comma item of sentence sIdx (labeled or unlabeled;
     a `plan` item keeps its "N." list prefix). Rebuilds the sentence and stages the whole field as a draft. */
  function saveSentenceCommaItem(record, fn, idx, sid, sIdx, ciIdx, usePlanRejoin) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const rawSentences = usePlanRejoin ? splitBySentenceRejoin(currentVal) : splitBySentence(currentVal);
    const raw = rawSentences[sIdx] || '';
    const numMatch = usePlanRejoin ? raw.match(/^\s*(\d+[.)])\s+/) : null;
    const numPrefix = numMatch ? numMatch[1] + ' ' : '';
    const body = usePlanRejoin ? stripLeadingNum(raw) : raw;
    const p = parseLabel(body);
    const items = splitByComma(p.isLabeled ? p.value : body);
    const trimmed = editValue.trim();
    const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(Boolean);
    if (subParts.length > 1) { items.splice(ciIdx, 1, ...subParts); } else { items[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    const joined = items.join(', ');
    rawSentences[sIdx] = numPrefix + (p.isLabeled ? `${p.label}: ${joined}` : joined);
    const fullText = reconstructFullText(rawSentences);
    const sentenceKey = `${fn}-${idx}-s${sIdx}`;
    const commaKey = `${sentenceKey}-c${ciIdx}`;
    const marks = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ciIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
    stageDraft(record, idx, `${fn}-${idx}`, fullText, sid);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed values
  // now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // staged drafts for THIS record whose base field belongs to THIS section
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);     // "field" | "field.arrayIndex" | "field.arrayIndex.subField"
        const baseField = fieldPart.split('.')[0];
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const segs = fieldPart.split('.');
        // arrayIndex applies ONLY when a dot-segment is purely numeric (reverse of the save key build).
        const payload = { field: segs[0], value: localEdits[editKey] };
        if (segs.length >= 2 && /^\d+$/.test(segs[1])) {
          payload.arrayIndex = parseInt(segs[1], 10);
          if (segs.length >= 3) payload.subField = segs.slice(2).join('.'); // AED sub-field (e.g. medication)
        }
        // NOTE: whole-object/whole-array drafts (saveLeaf, recommendations) have no numeric segment →
        // committed as { field, value: <object|array> }, overwriting the field (matches their original intent).
        const resp = await secureApiClient.put(`/api/edit/epilepsy_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/epilepsy_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); if (store[id]) delete store[id][fp]; });
        if (store[id] && Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[EpilepsyAssessment] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
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
  const formatSentenceFieldLines = useCallback((text, usePlanRejoin) => {
    const sentences = (usePlanRejoin ? splitBySentenceRejoin(text) : splitBySentence(text)).map(s => usePlanRejoin ? stripLeadingNum(s) : s);
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
  }, [splitBySentence, splitBySentenceRejoin]);

  /* object → copy lines (recursive) */
  const objectCopyLines = useCallback((label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { if (label) { out.push(`${pad}${label}`); out.push(`${pad}${COPY_LINE_DASH}`); } out.push(`${pad}${fmtScalar(value)}`); return out; }
    if (Array.isArray(value)) { value.filter(v => !isEmptyDeep(v)).forEach((v, i) => out.push(...objectCopyLines(label ? `${label} ${i + 1}` : `${i + 1}`, v, indent))); return out; }
    if (label) { out.push(`${pad}${label}`); out.push(`${pad}${COPY_LINE_DASH}`); }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = '';
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n${formatDate(val)}\n\n`;
      } else if (ENUM_FIELDS[f]) {
        text += `${label}\n${COPY_LINE_DASH}\n${enumCanonical(ENUM_FIELDS[f], val) || fmtVal(val)}\n\n`;
      } else if (RECOMMENDATION_ARRAY_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val : [];
        text += `${label}\n${COPY_LINE_DASH}\n`;
        let lastDate = null; let n = 1;
        recs.forEach((r) => {
          const rec = (r?.recommendation || '').trim();
          const date = (r?.date || '').trim();
          if (date !== lastDate) { if (date) text += `${date}\n`; lastDate = date; n = 1; }
          text += `${n++}. ${rec}\n`;
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else if (GENERIC_OBJECT_ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val : [];
        text += `${label}\n${COPY_LINE_DASH}\n`;
        arr.filter(it => !isEmptyDeep(it)).forEach((it, i) => {
          text += `${i + 1}.\n`;
          if (isScalar(it)) text += `  ${fmtScalar(it)}\n`;
          else objectCopyLines('', it, 1).forEach(l => { text += `${l}\n`; });
        });
        text += '\n';
      } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const arr = record[f];
        if (!Array.isArray(arr) || arr.length === 0) return;
        text += `${label}\n${COPY_LINE_DASH}\n`;
        arr.forEach((item, i) => {
          const med = getAedItemValue(record, f, idx, i, 'medication') ?? item.medication;
          const dose = getAedItemValue(record, f, idx, i, 'dose') ?? item.dose;
          const level = getAedItemValue(record, f, idx, i, 'level') ?? item.level;
          const se = getAedItemValue(record, f, idx, i, 'sideEffects') ?? item.sideEffects;
          text += `${i + 1}. ${med || 'N/A'}\n${COPY_LINE_DASH}\n`;
          if (hasVal(dose)) text += `Dose\n${COPY_LINE_DASH}\n${fmtVal(dose)}\n`;
          if (hasVal(level)) text += `Level\n${COPY_LINE_DASH}\n${fmtVal(level)}\n`;
          if (hasVal(se)) text += `Side Effects\n${COPY_LINE_DASH}\n${Array.isArray(se) ? se.filter(Boolean).join(', ') : fmtVal(se)}\n`;
          text += '\n';
        });
      } else if (STRING_ARRAY_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n`;
        const arr = record[f];
        let na = 1;
        if (Array.isArray(arr)) arr.forEach((item, i) => {
          const iv = String(getStringArrayItemValue(record, f, idx, i) ?? item);
          const p = parseLabel(iv);
          if (p.isLabeled) { const parts = splitByComma(p.value); text += `${p.label}\n${COPY_LINE_DASH}\n`; parts.forEach(part => { text += `${na++}. ${part}\n`; }); }
          else { text += `${na++}. ${iv}\n`; }
        });
        text += '\n';
      } else if (SENTENCE_FIELDS.includes(f)) {
        const usePlanRejoin = f === 'plan';
        text += `${label}\n${COPY_LINE_DASH}\n`;
        formatSentenceFieldLines(fmtVal(val), usePlanRejoin).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        text += `${label}\n${COPY_LINE_DASH}\n${fmtVal(val)}\n\n`;
      }
    });
    // Empty-section drop (one-pass item 3 GOTCHA): a section with no populated fields emits NOTHING —
    // never a bare title+divider (which would also break the JSX/PDF parity check).
    return text.trim() ? `${title}\n${COPY_LINE_EQ}\n\n${text}` : '';
  }, [getFieldValue, getAedItemValue, getStringArrayItemValue, hasVal, fmtVal, formatSentenceFieldLines, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== EPILEPSY ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Epilepsy Assessment ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD (known clinical/record scale → themed BlueSelect) ═══════ */
  const renderEnumField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const options = enumOptionsWith(ENUM_FIELDS[fn], val);
    const displayVal = enumCanonical(ENUM_FIELDS[fn], val) || fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={options} onChange={(v) => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING ARRAY SECTION ═══════ */
  const renderStringArraySection = (record, idx, fn, sid) => {
    const arr = record[fn];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const title = FIELD_LABELS[fn] || fn;
    const showTitle = title.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div key={fn} className="rec-mini-card">
        {showTitle && <div className="nested-subtitle">{highlightText(title)}</div>}
        {arr.map((item, arrIdx) => {
          const itemVal = getStringArrayItemValue(record, fn, idx, arrIdx) ?? item;
          if (!itemVal) return null;
          if (searchTerm.trim() && !phraseMatch) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!String(itemVal).toLowerCase().includes(phrase) && !title.toLowerCase().includes(phrase)) return null;
          }
          /* Labeled element ("Label: a, b, c") → nested-subtitle label + one editable row per comma item. */
          const parsedItem = parseLabel(String(itemVal));
          if (parsedItem.isLabeled) {
            const commaItems = splitByComma(parsedItem.value);
            return (
              <div key={arrIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                <div className="nested-subtitle">{highlightText(parsedItem.label)}</div>
                {commaItems.map((ci, ciIdx) => {
                  const commaKey = `${fn}.${arrIdx}.c${ciIdx}-${idx}`;
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
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveStringArrayCommaItem(record, fn, idx, arrIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#x270E;</span></div>
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
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveStringArrayItem(record, fn, idx, arrIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(String(itemVal))}</span><span className="edit-indicator">&#x270E;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(itemVal), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: AED ARRAY (object array with medication/dose/level/sideEffects) ═══════ */
  const renderAedArraySection = (record, idx, fn, sid) => {
    const arr = record[fn];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const title = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return arr.map((item, arrIdx) => {
      const medVal = getAedItemValue(record, fn, idx, arrIdx, 'medication') ?? item.medication;
      const doseVal = getAedItemValue(record, fn, idx, arrIdx, 'dose') ?? item.dose;
      const levelVal = getAedItemValue(record, fn, idx, arrIdx, 'level') ?? item.level;
      const seVal = getAedItemValue(record, fn, idx, arrIdx, 'sideEffects') ?? item.sideEffects;

      if (!medVal && !doseVal && !levelVal && !seVal) return null;

      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        const combined = [medVal, doseVal, levelVal, seVal].filter(Boolean).join(' ').toLowerCase();
        if (!combined.includes(phrase) && !title.toLowerCase().includes(phrase)) return null;
      }

      const subFields = [
        { key: 'medication', label: 'Medication', val: medVal },
        { key: 'dose', label: 'Dose', val: doseVal },
        { key: 'level', label: 'Level', val: levelVal },
        { key: 'sideEffects', label: 'Side Effects', val: seVal },
      ];

      return (
        <div key={arrIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(`${title} ${arrIdx + 1}`)}</div>
          {subFields.map(sf => {
            if (!hasVal(sf.val)) return null;
            const editKey = `${fn}.${arrIdx}.${sf.key}-${idx}`;
            const isEditing = editingField === editKey;
            const badge = editedFields[editKey];
            const displayVal = fmtVal(sf.val);

            return (
              <div key={sf.key}>
                <div className="nested-subtitle" style={{ fontSize: 14, marginTop: 4, borderBottom: 'none', paddingBottom: 0, marginBottom: 2 }}>{highlightText(sf.label)}</div>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveAedItem(record, fn, idx, arrIdx, sf.key, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    });
  };

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const usePlanRejoin = fn === 'plan';
    const sentences = usePlanRejoin ? splitBySentenceRejoin(val) : splitBySentence(val);
    if (sentences.length === 0) return null;
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

            const displayText = usePlanRejoin ? stripLeadingNum(sentence) : sentence;
            const parsed = parseLabel(displayText);
            const commaSource = parsed.isLabeled ? parsed.value : displayText;
            const commaItems = splitByComma(commaSource);
            const parsedLabelMatch = searchTerm.trim() && parsed.isLabeled && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (commaItems.length >= 2) {
                return (
                  <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                    {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentenceCommaItem(record, fn, idx, sid, sIdx, ciIdx, usePlanRejoin); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#x270E;</span></div>
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

            /* Single row (labeled → nested-subtitle + value; unlabeled → bare row) */
            return (
              <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : (usePlanRejoin ? stripLeadingNum(sentence) : sentence).replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { saveSentenceCommaItem(record, fn, idx, sid, sIdx, 0, usePlanRejoin); } else { saveSentence(record, fn, idx, sid, sIdx, usePlanRejoin); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : (usePlanRejoin ? stripLeadingNum(sentence) : sentence))}</span><span className="edit-indicator">&#x270E;</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(usePlanRejoin ? stripLeadingNum(sentence) : sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: OBJECT LEAF (editable; boolean -> Yes/No select, number+unit -> number input, "4/5" stays text) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'Yes' : 'No') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <BlueSelect value={editValue} options={['Yes', 'No']} onChange={(v) => setEditValue(v)} />
              ) : (ratio || nu) ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button>
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
                    newVal = editValue === 'Yes';
                  } else if (ratio) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = `${n}/${ratio.denom}`;
                  } else if (nu) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : (typeof value === 'number' ? n : String(n));
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
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#x270E;</span></div>
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
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          <div className="nested-group">
            {value.map((v, i) => (
              isScalar(v) ? renderObjectLeaf(record, rootField, [...path, String(i)], idx, sid, v)
                : <div className="nested-mini-card" key={i}>{renderObjectNode(record, rootField, idx, sid, `${humanizeKey(path[path.length - 1] || 'Item')} ${i + 1}`, v, [...path, String(i)], depth + 1)}</div>
            ))}
          </div>
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

  /* ═══════ RENDER: GENERIC OBJECT ARRAY (seizureDiary — arbitrary object items, editable leaves) ═══════ */
  const renderGenericObjectArraySection = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const arr = Array.isArray(val) ? val : [];
    const items = arr.filter(it => !isEmptyDeep(it));
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, arrIdx) => {
          if (isEmptyDeep(item)) return null;
          if (isScalar(item)) return renderObjectLeaf(record, fn, [String(arrIdx)], idx, sid, item);
          const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
          if (entries.length === 0) return null;
          return (
            <div key={arrIdx} className="nested-mini-card">
              <div className="nested-subtitle sub-label">{highlightText(`${label} ${arrIdx + 1}`)}</div>
              <div className="nested-group">
                {entries.map(([k, v]) => (
                  isScalar(v) ? renderObjectLeaf(record, fn, [String(arrIdx), k], idx, sid, v)
                    : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [String(arrIdx), k], 2)}</div>
                ))}
              </div>
            </div>
          );
        })}
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
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              const id2 = safeId(record); if (!id2) return;
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                              const trimmed = editValue.trim();
                              const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
                              setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
                              stageDraft(record, idx, `${fn}-${idx}`, newArr, sid);
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#x270E;</span></div>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (OBJECT_ARRAY_FIELDS.includes(f) || STRING_ARRAY_FIELDS.includes(f) || GENERIC_OBJECT_ARRAY_FIELDS.includes(f) || RECOMMENDATION_ARRAY_FIELDS.includes(f)) return Array.isArray(val) && val.filter(it => !isEmptyDeep(it)).length > 0;
      if (OBJECT_FIELDS.includes(f)) return hasVal(val) && !isEmptyDeep(val);
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
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderAedArraySection(record, idx, f, sid);
            if (RECOMMENDATION_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (GENERIC_OBJECT_ARRAY_FIELDS.includes(f)) return renderGenericObjectArraySection(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (STRING_ARRAY_FIELDS.includes(f)) return renderStringArraySection(record, idx, f, sid);
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid, title);
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
      <div className="epilepsy-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Epilepsy Assessment</h2></div>
        <div className="empty-state">No epilepsy assessment records available</div>
      </div>
    );
  }

  return (
    <div className="epilepsy-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Epilepsy Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EpilepsyAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Epilepsy_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search epilepsy assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Epilepsy Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'seizure-profile')}
            {renderSection(record, idx, 'triggers-aura')}
            {renderSection(record, idx, 'postictal-section')}
            {renderSection(record, idx, 'medications')}
            {renderSection(record, idx, 'eeg-section')}
            {renderSection(record, idx, 'seizure-diary')}
            {renderSection(record, idx, 'vns-section')}
            {renderSection(record, idx, 'clinical-notes')}
            {renderSection(record, idx, 'results-section')}
            {renderSection(record, idx, 'recommendations-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EpilepsyAssessmentDocument;
