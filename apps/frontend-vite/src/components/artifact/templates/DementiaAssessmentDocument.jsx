/**
 * DementiaAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: dementia_assessment
 *
 * 11 Sections:
 *   1. overview: dementiaType, cdrsScore
 *   2. functional-status: functionalStatus.adls, functionalStatus.iadls (bar chart + dot-path editing)
 *   3. behavioral-symptoms: behavioralSymptoms (array of strings)
 *   4. cognitive-enhancers: cognitiveEnhancers (array of objects: medication, dose, frequency, status, plan)
 *   5. caregiver-burden: caregiverBurden (semicolon-split text)
 *   6. safety-assessment: safetyAssessment.driving/homeAlone/medication/wandering (dot-path)
 *   7. advance-directives: advanceDirectives.healthcarePowerOfAttorney/livingWill/financialPowerOfAttorney (dot-path)
 *   8. findings: findings (sentence text)
 *   9. assessment: assessment (sentence text with parseLabel)
 *  10. plan: plan (semicolon-split text)
 *  11. results: results (recursive object — renderObjectNode / renderObjectLeaf)
 *  12. recommendations: recommendations (array of {recommendation, date}, date-grouped)
 *  13. notes: notes (per-sentence editable narrative)
 *  14. provider-info: date (BlueDatePicker), provider (semicolon-split, per-part editing), facility
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DementiaAssessmentPDFTemplate from '../pdf-templates/DementiaAssessmentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './DementiaAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits "fn" — may be a dotted path) */
const DRAFT_KEY = 'dementia_assessmentPendingEdits';
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
  overview: 'Dementia Overview',
  'functional-status': 'Functional Status',
  'behavioral-symptoms': 'Behavioral Symptoms',
  'cognitive-enhancers': 'Cognitive Enhancers',
  'caregiver-burden': 'Caregiver Burden',
  'safety-assessment': 'Safety Assessment',
  'advance-directives': 'Advance Directives',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
  'provider-info': 'Provider Information',
};

const FIELD_LABELS = {
  date: 'Date',
  dementiaType: 'Dementia Type',
  cdrsScore: 'CDRS Score',
  'functionalStatus.adls': 'ADLs',
  'functionalStatus.iadls': 'IADLs',
  caregiverBurden: 'Caregiver Burden',
  'safetyAssessment.driving': 'Driving',
  'safetyAssessment.homeAlone': 'Home Alone Safety',
  'safetyAssessment.medication': 'Medication Management',
  'safetyAssessment.wandering': 'Wandering Risk',
  'advanceDirectives.healthcarePowerOfAttorney': 'Healthcare Power of Attorney',
  'advanceDirectives.livingWill': 'Living Will',
  'advanceDirectives.financialPowerOfAttorney': 'Financial Power of Attorney',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  provider: 'Provider',
  facility: 'Facility',
};

const SECTION_FIELDS = {
  overview: ['dementiaType', 'cdrsScore'],
  'functional-status': ['functionalStatus.adls', 'functionalStatus.iadls'],
  'behavioral-symptoms': ['behavioralSymptoms'],
  'cognitive-enhancers': ['cognitiveEnhancers'],
  'caregiver-burden': ['caregiverBurden'],
  'safety-assessment': ['safetyAssessment.driving', 'safetyAssessment.homeAlone', 'safetyAssessment.medication', 'safetyAssessment.wandering'],
  'advance-directives': ['advanceDirectives.healthcarePowerOfAttorney', 'advanceDirectives.livingWill', 'advanceDirectives.financialPowerOfAttorney'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  results: ['results'],
  recommendations: ['recommendations'],
  notes: ['notes'],
  'provider-info': ['date', 'provider', 'facility'],
};

const SENTENCE_FIELDS = ['assessment', 'notes'];
const SEMICOLON_FIELDS = ['findings', 'caregiverBurden', 'plan'];
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* Fixed-choice fields → themed <select> (one-pass item 8); current stored value stays selectable */
const ENUM_FIELDS = {
  dementiaType: ["Alzheimer's", 'Vascular', 'Lewy Body', 'Frontotemporal', 'Mixed', "Parkinson's Disease Dementia"],
};
const MED_STATUS_OPTIONS = ['active', 'discontinued', 'on hold', 'future consideration'];
/* CDR® global score — fixed 5-point clinical scale (Morris 1993); format matches stored "1.0 (Mild Dementia)" */
const CDR_GLOBAL_OPTIONS = ['0 (Normal)', '0.5 (Very Mild Dementia)', '1.0 (Mild Dementia)', '2.0 (Moderate Dementia)', '3.0 (Severe Dementia)'];
const isCdrGlobalValue = (v) => /^\d(?:\.\d)?\s*\([^)]*\)$/.test(String(v || '').trim());
const enumOptionsWith = (options, current) => {
  const cur = String(current ?? '').trim();
  if (!cur || options.some(o => o.toLowerCase() === cur.toLowerCase())) return options;
  return [cur, ...options];
};

const KEY_OVERRIDES = {};

/* Copy dividers per one-pass */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const MED_SUB_FIELDS = [
  { key: 'dose', label: 'Dose' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'status', label: 'Status' },
  { key: 'plan', label: 'Plan' },
];

const SAFETY_KEYS = ['driving', 'homeAlone', 'medication', 'wandering'];
const DIRECTIVE_KEYS = ['healthcarePowerOfAttorney', 'livingWill', 'financialPowerOfAttorney'];

/* ═══════ BAR CHART HELPERS ═══════ */
const parseFunctionalScore = (text) => {
  if (!text) return null;
  const match = String(text).match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*[-\u2013]\s*(.*)/s);
  if (!match) return { score: null, description: String(text) };
  return { score: { value: parseFloat(match[1]), max: parseFloat(match[2]) }, description: match[3].trim() };
};
const getScoreColor = (pct) => { if (pct >= 80) return '#22c55e'; if (pct >= 50) return '#fbbf24'; return '#ef4444'; };
const getScoreInterpretation = (pct) => { if (pct >= 80) return 'Normal'; if (pct >= 50) return 'Mild'; return 'Impaired'; };
const scoreToPct = (v, m) => Math.min(100, Math.max(2, (v / m) * 100));

/* parseLabel: detect "Label: value" patterns - canonical cap 80 + :\s+ (per 6a48aab9) */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.'"-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware + guards (date, no-space, and/or) */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const t = current.trim();
      if (!t) { current = ''; continue; }
      // guard date comma e.g. "January 8, 2026"
      const rest = text.slice(i + 1).trim();
      if (/\d\s*$/.test(t) && /^\s*\d{4}\b/.test(rest)) { current += ch; continue; }
      // skip no-space like $18,000
      if (/\S$/.test(current) && /^\S/.test(rest)) { current += ch; continue; }
      result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* Number picker helpers (new stepper for dose "5 mg" etc, per 6a451881) */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const parseNumeric = (v) => {
  const s = String(v ?? ''); const nums = []; const literals = []; let last = 0;
  const re = /-?\d+(?:\.\d+)?/g; let m;
  while ((m = re.exec(s)) !== null) { literals.push(s.slice(last, m.index)); nums.push(m[0]); last = m.index + m[0].length; }
  literals.push(s.slice(last));
  return { nums, literals };
};

/* ═══════ OBJECT (results) HELPERS ═══════ */
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
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

/* ═══════ COMPONENT ═══════ */
const DementiaAssessmentDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editNums, setEditNums] = useState([]);
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
      if (r?.dementia_assessment) return Array.isArray(r.dementia_assessment) ? r.dementia_assessment : [r.dementia_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dementia_assessment) return Array.isArray(dd.dementia_assessment) ? dd.dementia_assessment : [dd.dementia_assessment]; return [dd]; }
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

  const formatDate = useCallback((d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
  }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    // canonical [.;] + abbrev guard (per recent one-pass audits)
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No))\s*[.;]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  const splitBySemicolon = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* dot-path get: "functionalStatus.adls" -> record.functionalStatus.adls */
  const getNestedVal = useCallback((record, fn) => {
    if (!fn.includes('.')) return record[fn];
    const parts = fn.split('.');
    let cur = record;
    for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
    return cur;
  }, []);

  /* Number picker helpers inside (for dose) */
  const startNumEdit = useCallback((ek, parsed) => {
    setEditingField(ek);
    setEditNums(parsed.nums.slice());
    setEditValue('');
    setSaveError(null);
  }, []);
  const rebuildNumeric = useCallback((parsed) => {
    let out = parsed.literals[0] || '';
    editNums.forEach((n, i) => { out += String(n ?? '').trim(); out += parsed.literals[i + 1] || ''; });
    out = out.trim();
    return out;
  }, [editNums]);
  const renderNumberEditor = useCallback((parsed, onSave) => (
    <div className="number-edit-row">
      {parsed.literals[0] && <span className="number-edit-unit">{parsed.literals[0]}</span>}
      {editNums.map((n, i) => (
        <span key={i} className="num-seg">
          <button type="button" className="num-step" onClick={() => {
            const curr = parseFloat(n) || 0; const st = parseFloat(stepFor(n)) || 1;
            const dec = String(n).includes('.') ? String(n).split('.')[1].length : 0;
            const newN = (curr - st).toFixed(dec);
            const nn = [...editNums]; nn[i] = newN; setEditNums(nn);
          }}>−</button>
          <input type="number" step={stepFor(n)} className="edit-number" value={n} onChange={e => { const nn=[...editNums]; nn[i]=e.target.value; setEditNums(nn); }} onKeyDown={e => { if (e.key==='Enter') onSave(); if (e.key==='Escape'){setEditingField(null);setEditNums([]);} }} autoFocus={i===0} />
          <button type="button" className="num-step" onClick={() => {
            const curr = parseFloat(n) || 0; const st = parseFloat(stepFor(n)) || 1;
            const dec = String(n).includes('.') ? String(n).split('.')[1].length : 0;
            const newN = (curr + st).toFixed(dec);
            const nn = [...editNums]; nn[i] = newN; setEditNums(nn);
          }}>+</button>
          {parsed.literals[i+1] && <span className="number-edit-unit">{parsed.literals[i+1]}</span>}
        </span>
      ))}
    </div>
  ), [editNums]);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return getNestedVal(record, fn);
  }, [localEdits, getNestedVal]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const safeArray = useCallback((v) => Array.isArray(v) ? v.filter(Boolean) : [], []);
  const stripNumber = useCallback((t) => t ? t.replace(/^\d+[.)]\s*/, '') : t, []);

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
        if (typeof val === 'string' && val.toLowerCase().includes(phrase)) return true;
        if (Array.isArray(val) && val.some(item => {
          if (typeof item === 'string') return item.toLowerCase().includes(phrase);
          if (typeof item === 'object') return JSON.stringify(item).toLowerCase().includes(phrase);
          return false;
        })) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined) return false;
    if (DATE_FIELDS.includes(fn) && formatDate(val).toLowerCase().includes(phrase)) return true;
    return fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal, formatDate]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dementia Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && typeof val === 'string' && val.toLowerCase().includes(phrase)) return true;
          if (Array.isArray(val) && val.some(item => JSON.stringify(item).toLowerCase().includes(phrase))) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      // Apply localEdits, handling dot-paths
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          if (fn.includes('.')) {
            const parts = fn.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]] || typeof merged[parts[0]] !== 'object') merged[parts[0]] = {};
              merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[key] };
            }
          } else {
            merged[fn] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Reverse-lookup the section id that owns a localEdits field name (`fn` may be a dotted path). */
  const sidForField = useCallback((fn) => {
    for (const [sid, fields] of Object.entries(SECTION_FIELDS)) {
      if (fields.includes(fn)) return sid;
    }
    // cognitiveEnhancers.* / nested paths → match on the root field
    const root = fn.split('.')[0];
    for (const [sid, fields] of Object.entries(SECTION_FIELDS)) {
      if (fields.includes(root)) return sid;
    }
    return null;
  }, []);

  /* stageEdit = stage a DRAFT locally + persist it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
     `fieldPart` is the localEdits "fn" (the field name, possibly a dotted path); `value` is the FULL field value. */
  const stageEdit = useCallback((record, fieldPart, idx, fullValue, trackKey, sentenceKey) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (trackKey) setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button returns to yellow Pending Approve.
    const sid = sidForField(fieldPart);
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = fullValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
    return sentenceKey; // convenience for callers that also set editedSentences
  }, [safeId, sidForField]);

  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    if (!safeId(record)) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    stageEdit(record, fn, idx, saveVal, trackKey);
  }, [editValue, safeId, stageEdit]);

  /* saveLeaf: persist a single leaf within an object field via dotted path; merge full object into localEdits */
  const saveLeaf = useCallback((record, rootField, path, idx, _sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    // Build the FULL merged object value, then stage it as a DRAFT (no DB write until Approve).
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) { if (node[path[i]] == null || typeof node[path[i]] !== 'object') node[path[i]] = {}; node = node[path[i]]; }
    node[path[path.length - 1]] = newVal;
    stageEdit(record, rootField, idx, clone, leafKeyTrack);
  }, [safeId, localEdits, stageEdit]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageEdit(record, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageEdit(record, fn, idx, fullText);
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

  function saveSemicolonItem(record, fn, idx, itemIdx, newText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitBySemicolon(currentVal);
    items[itemIdx] = newText.trim();
    const fullText = items.join('; ');
    const itemKey = `${fn}-${idx}-sc${itemIdx}`;
    stageEdit(record, fn, idx, fullText);
    setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
  }

  function saveCommaItemInSentence(record, fn, idx, sIdx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    if (!parsed.isLabeled) return;
    const items = splitByComma(parsed.value);
    const trimmed = newItemText.trim();
    // Handle ". Test" pattern — add as new comma items within the same label group
    const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
    if (subParts.length > 1) {
      items.splice(commaIdx, 1, ...subParts);
    } else {
      items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim();
    }
    const rebuilt = `${parsed.label}: ${items.join(', ')}`;
    const allSentences = [...sentences];
    allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    stageEdit(record, fn, idx, fullText);
    const n = { [commaKey]: subParts[0] !== items[commaIdx] ? 'edited' : 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) n[`${fn}-${idx}-s${sIdx}-c${commaIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...n }));
  }

  function saveArrayItem(record, fn, idx, arrayIdx, newText) {
    const id = safeId(record); if (!id) return;
    const arrKey = `${fn}-${idx}-a${arrayIdx}`;
    // Stage the FULL array as a DRAFT (no DB write until Approve).
    const currentArr = [...safeArray(getFieldValue(record, fn, idx))];
    currentArr[arrayIdx] = newText;
    stageEdit(record, fn, idx, currentArr);
    setEditedSentences(prev => ({ ...prev, [arrKey]: 'edited' }));
  }

  function saveMedSubField(record, idx, medIdx, subField, newValue) {
    const id = safeId(record); if (!id) return;
    const trackKey = `med-${idx}-${medIdx}-${subField}`;
    // Stage the FULL cognitiveEnhancers array as a DRAFT (no DB write until Approve).
    const currentMeds = [...safeArray(getFieldValue(record, 'cognitiveEnhancers', idx))];
    if (!currentMeds[medIdx]) return;
    currentMeds[medIdx] = { ...currentMeds[medIdx], [subField]: newValue };
    stageEdit(record, 'cognitiveEnhancers', idx, currentMeds, trackKey);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (sid === 'cognitive-enhancers' && k.startsWith(`med-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // localEdits keys are `${fn}-${idx}`; commit only this section's pending fields.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // the field name (may be a dotted path)
      const root = fieldPart.split('.')[0];
      return fields.includes(fieldPart) || fields.includes(root);
    });
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric (reverse of fieldPart build).
        if (lastDot !== -1 && /^\d+$/.test(tail)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(tail, 10); }
        else { payload.field = fieldPart; }
        const resp = await secureApiClient.put(`/api/edit/dementia_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/dementia_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); if (sid === 'cognitive-enhancers' && k.startsWith(`med-${idx}`)) delete n[k]; }); return n; });
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
  const splitFuncStatus = useCallback((text) => {
    if (!text) return [];
    const groups = String(text).split(/;\s*/).map(s => s.trim()).filter(Boolean);
    const allParts = [];
    groups.forEach(group => {
      const items = group.split(/,\s*/).map(s => s.trim().replace(/^and\s+/i, '')).filter(Boolean);
      allParts.push(...items);
    });
    return allParts;
  }, []);

  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        /* labeled group: sub-label + DASH divider, numbering RESTARTS at 1 */
        const rawParts = splitByComma(parsed.value);
        const parts = rawParts.length >= 3 ? rawParts : [parsed.value];
        lines.push(stripDelims(parsed.label));
        lines.push(COPY_LINE_DASH);
        parts.forEach((item, i) => { lines.push(`${i + 1}. ${stripDelims(item)}`); });
      } else {
        /* unlabeled row: running count continues */
        lines.push(`${n++}. ${stripDelims(s)}`);
      }
    });
    return lines;
  }, [splitBySentence]);

  const stripDelims = (t) => String(t || '').replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];

    /* Semicolon narrative fields (findings / caregiverBurden / plan): single-name → NO field label.
       Labeled items → sub-label + DASH + restart numbering; unlabeled → running count. Mirrors JSX + PDF. */
    const semicolonFieldLines = (val) => {
      let out = ''; let n = 1;
      splitBySemicolon(String(val)).forEach(item => {
        const pr = parseLabel(stripNumber(item));
        if (pr.isLabeled) {
          const rawComma = splitByComma(pr.value);
          const parts = rawComma.length >= 3 ? rawComma : [pr.value];
          out += `${pr.label}\n${COPY_LINE_DASH}\n`;
          parts.forEach((p, i) => { out += `${i + 1}. ${stripDelims(p)}\n`; });
        } else {
          out += `${n++}. ${stripDelims(stripNumber(item))}\n`;
        }
      });
      return out;
    };

    if (sid === 'functional-status') {
      ['functionalStatus.adls', 'functionalStatus.iadls'].forEach(f => {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        const label = FIELD_LABELS[f];
        text += `${label}\n${COPY_LINE_DASH}\n`;
        splitFuncStatus(String(val)).forEach((p, i) => { text += `${i + 1}. ${p}\n`; });
        text += '\n';
      });
      return text;
    }

    if (sid === 'behavioral-symptoms') {
      const items = safeArray(getFieldValue(record, 'behavioralSymptoms', idx));
      items.forEach((item, i) => { text += `${i + 1}. ${stripNumber(item)}\n`; });
      return text;
    }

    if (sid === 'cognitive-enhancers') {
      const meds = safeArray(getFieldValue(record, 'cognitiveEnhancers', idx));
      meds.forEach((med, mi) => {
        const medName = med.medication || `Medication ${mi + 1}`;
        text += `${mi + 1}. ${medName}\n${COPY_LINE_DASH}\n`;
        MED_SUB_FIELDS.forEach(sf => {
          const v = med[sf.key];
          if (v) {
            text += `${sf.label}\n${COPY_LINE_DASH}\n1. ${v}\n`;
          }
        });
        text += '\n';
      });
      return text;
    }

    if (sid === 'caregiver-burden' || sid === 'plan' || sid === 'findings') {
      const fn = sid === 'caregiver-burden' ? 'caregiverBurden' : sid;
      const val = getFieldValue(record, fn, idx);
      if (hasVal(val)) text += semicolonFieldLines(val);
      return text;
    }

    if (sid === 'safety-assessment') {
      SAFETY_KEYS.forEach(key => {
        const fn = `safetyAssessment.${key}`;
        const val = getFieldValue(record, fn, idx);
        if (!hasVal(val)) return;
        const label = FIELD_LABELS[fn];
        const parts = splitBySemicolon(String(val));
        text += `${label}\n${COPY_LINE_DASH}\n`;
        parts.forEach((p, i) => { text += `${i + 1}. ${stripNumber(p)}\n`; });
        text += '\n';
      });
      return text;
    }

    if (sid === 'advance-directives') {
      DIRECTIVE_KEYS.forEach(key => {
        const fn = `advanceDirectives.${key}`;
        const val = getFieldValue(record, fn, idx);
        if (!hasVal(val)) return;
        const label = FIELD_LABELS[fn];
        text += `${label}\n${COPY_LINE_DASH}\n1. ${stripDelims(fmtVal(val))}\n\n`;
      });
      return text;
    }

    if (sid === 'assessment' || sid === 'notes') {
      const val = getFieldValue(record, sid, idx);
      if (hasVal(val)) {
        formatSentenceFieldLines(String(val)).forEach(l => { text += `${l}\n`; });
      }
      return text;
    }

    if (sid === 'recommendations') {
      const recs = safeArray(getFieldValue(record, 'recommendations', idx));
      const groups = [];
      recs.forEach(rec => { const d = (rec?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(rec); else groups.push({ date: d, items: [rec] }); });
      let n = 1;
      groups.forEach(group => {
        if (group.date) {
          text += `${group.date}\n${COPY_LINE_DASH}\n`;
          group.items.forEach((rec, i) => { text += `${i + 1}. ${(rec?.recommendation || '').trim()}\n`; });
        } else {
          group.items.forEach(rec => { text += `${n++}. ${(rec?.recommendation || '').trim()}\n`; });
        }
      });
      return text;
    }

    if (sid === 'results') {
      const val = getFieldValue(record, 'results', idx);
      if (hasVal(val) && !isScalar(val)) {
        const walk = (obj, indent) => {
          Object.entries(obj).forEach(([k, v]) => {
            if (isEmptyDeep(v)) return;
            if (isScalar(v)) { text += `${indent}${humanizeKey(k)}\n${indent}${COPY_LINE_DASH}\n${indent}1. ${fmtScalar(v)}\n`; }
            else { text += `${indent}${humanizeKey(k)}\n${indent}${COPY_LINE_DASH}\n`; walk(v, indent + '  '); }
          });
        };
        walk(val, '');
      }
      return text;
    }

    // provider-info and overview
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (f === 'date') {
        text += `${label}\n${COPY_LINE_DASH}\n1. ${formatDate(val)}\n`;
      } else if (f === 'provider') {
        const provs = String(val).split(/;\s*/).map(s => s.trim()).filter(Boolean);
        text += `${label}\n${COPY_LINE_DASH}\n`;
        provs.forEach((p, i) => { text += `${i + 1}. ${stripDelims(p)}\n`; });
      } else if (f === 'cdrsScore') {
        const parts = splitBySemicolon(String(val));
        text += `${label}\n${COPY_LINE_DASH}\n`;
        parts.forEach((part) => {
          const pr = parseLabel(part);
          if (pr.isLabeled) {
            text += `${pr.label}\n${COPY_LINE_DASH}\n`;
            const rawComma = splitByComma(pr.value).filter(Boolean);
            const sub = rawComma.length >= 3 ? rawComma : [pr.value];
            sub.forEach((sp, si) => { text += `${si + 1}. ${sp}\n`; });
          } else {
            text += `1. ${part}\n`;
          }
        });
      } else {
        text += `${label}\n${COPY_LINE_DASH}\n1. ${stripDelims(fmtVal(val))}\n`;
      }
      text += '\n';
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, splitBySemicolon, splitFuncStatus, safeArray, stripNumber, formatDate]);

  const copyAllText = useCallback(async () => {
    let text = '=== DEMENTIA ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Dementia Assessment ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const st = buildSectionCopyText(r, idx, sid);
        /* empty-section guard: title + '=' divider = 2 lines; require real content */
        if (st.split('\n').filter(l => l.trim()).length > 2) text += st;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE FIELD ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const isoVal = val ? new Date(val).toISOString().split('T')[0] : '';

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isoVal); setSaveError(null); } }}>
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
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SEMICOLON-SPLIT FIELD (findings, caregiverBurden, plan) ═══════ */
  const renderSemicolonField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const items = splitBySemicolon(val); if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (searchTerm.trim() && !phraseMatch && !labelMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {items.map((item, iIdx) => {
            const itemKey = `${fn}-${idx}-sc${iIdx}`;
            const isEditing = editingField === itemKey;
            const badge = editedSentences[itemKey];
            const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!itemMatches && searchTerm.trim()) return null;

            /* parseLabel for "Label: value" patterns within semicolon items → sub-label + value row(s), never inline */
            const parsed = parseLabel(item);
            if (parsed.isLabeled) {
              const rawComma = splitByComma(parsed.value);
              const valueParts = rawComma.length >= 3 ? rawComma : [parsed.value];
              const saveValuePart = (vpIdx, newText) => {
                let newValue;
                if (rawComma.length >= 3) { const parts = [...rawComma]; parts[vpIdx] = newText.trim(); newValue = parts.filter(Boolean).join(', '); }
                else { newValue = newText.trim(); }
                const all = splitBySemicolon(String(getFieldValue(record, fn, idx) || ''));
                all[iIdx] = `${parsed.label}: ${newValue}`;
                stageEdit(record, fn, idx, all.join('; '));
                setEditedSentences(prev => ({ ...prev, [`${itemKey}-c${vpIdx}`]: 'edited' }));
              };
              return (
                <div key={iIdx} className="nested-mini-card">
                  <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>
                  {valueParts.map((vp, vpIdx) => {
                    const vpKey = `${itemKey}-c${vpIdx}`;
                    const vpEditing = editingField === vpKey;
                    const vpBadge = editedSentences[vpKey];
                    return (
                      <div key={vpIdx}>
                        <div className={`numbered-row ${vpBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!vpEditing) { setEditingField(vpKey); setEditValue(vp); setSaveError(null); } }}>
                          {vpEditing ? (
                            <div className="edit-field-container">
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveValuePart(vpIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="row-content"><span className="content-value">{highlightText(vp)}</span><span className="edit-indicator">&#x270E;</span></div>
                              <button className={`copy-btn ${copiedItems[vpKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(vp, vpKey); }}>{copiedItems[vpKey] ? 'Copied!' : 'Copy'}</button>
                            </>
                          )}
                        </div>
                        {vpBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                      </div>
                    );
                  })}
                </div>
              );
            }

            return (
              <div key={iIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(stripNumber(item)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSemicolonItem(record, fn, idx, iIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">&#x270E;</span></div>
                      <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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

            /* parseLabel for Label: value patterns */
            const parsed = parseLabel(sentence);
            if (parsed.isLabeled) {
              const textToSplit = parsed.value;
              const commaItems = splitByComma(textToSplit);
              if (commaItems.length >= 3) {
                return (
                  <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(parsed.label)}</div>
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItemInSentence(record, fn, idx, sIdx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageEdit(record, fn, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">&#x270E;</span></div>
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

  /* ═══════ RENDER: DOT-PATH SEMICOLON FIELD (safetyAssessment.*, with per-semicolon editing) ═══════ */
  const renderDotPathSemicolonField = (record, fn, idx, sid) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const label = FIELD_LABELS[fn] || fn;
    const items = splitBySemicolon(val);
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (searchTerm.trim() && !phraseMatch && !labelMatch && !fieldMatches(record, fn, idx)) return null;

    if (items.length >= 2) {
      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {items.map((item, iIdx) => {
            const itemKey = `${fn}-${idx}-sc${iIdx}`;
            const isEditing = editingField === itemKey;
            const badge = editedSentences[itemKey];
            const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={iIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(item); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const current = String(getFieldValue(record, fn, idx) || ''); const all = splitBySemicolon(current); all[iIdx] = editValue.trim(); const fullText = all.join('; '); stageEdit(record, fn, idx, fullText); setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' })); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">&#x270E;</span></div>
                      <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    }

    /* Single value - simple editable */
    return renderEditableField(record, fn, idx, sid, SECTION_TITLES[sid]);
  };

  /* ═══════ RENDER: DOT-PATH SIMPLE FIELD (advanceDirectives.*) ═══════ */
  const renderDotPathField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; ratio/number+unit -> number input, bool -> select, text -> textarea) ═══════ */
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
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (ratio || nu) ? (
                <div className="number-edit-row">
                  <button type="button" className="num-step" onClick={() => { const n = parseFloat(editValue)||0; setEditValue(String((n - (ratio||nu?0.1:1)).toFixed(2))); }}>-</button>
                  <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" onClick={() => { const n = parseFloat(editValue)||0; setEditValue(String((n + (ratio||nu?0.1:1)).toFixed(2))); }}>+</button>
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

  /* ═══════ RENDER: OBJECT FIELD (results — recursive object) ═══════ */
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
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              if (!safeId(record)) return;
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                              const trimmed = editValue.trim();
                              const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
                              stageEdit(record, fn, idx, newArr);
                              setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
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

  /* ═══════ RENDER SECTIONS ═══════ */

  /* Section 1: Dementia Overview */
  const renderOverviewSection = (record, idx) => {
    const sid = 'overview';
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid];
    const hasAny = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAny) return null;
    const copyId = `${sid}-${idx}`;

    /* cdrsScore special: split by semicolons for parseLabel display */
    const renderCdrsScore = () => {
      const val = String(getFieldValue(record, 'cdrsScore', idx) || ''); if (!val.trim()) return null;
      const parts = splitBySemicolon(val);
      if (parts.length >= 2) {
        return (
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText('CDRS Score')}</div>
            {parts.map((part, pi) => {
              const partKey = `cdrsScore-${idx}-sc${pi}`;
              const isEditing = editingField === partKey;
              const badge = editedSentences[partKey];
              const parsed = parseLabel(part);
              /* unlabeled "1.0 (Mild Dementia)" = CDR global score → fixed clinical scale dropdown */
              const isCdrGlobal = !parsed.isLabeled && isCdrGlobalValue(part);
              return (
                <div className="nested-mini-card" key={pi}>
                  {parsed.isLabeled && (
                    <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>
                  )}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => {
                    if (!isEditing) {
                      const valToEdit = parsed.isLabeled ? parsed.value : part;
                      const pnum = parseNumeric(valToEdit);
                      if (!isCdrGlobal && pnum && pnum.nums.length > 0 && !/[a-zA-Z]/.test(valToEdit)) {
                        startNumEdit(partKey, pnum);
                      } else {
                        setEditingField(partKey); setEditValue(valToEdit); setSaveError(null);
                      }
                    }
                  }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        {(editNums.length > 0) ? (
                          renderNumberEditor( parseNumeric( parsed.isLabeled ? parsed.value : part ) || {nums:editNums, literals:['',''] } , () => {
                            const current = String(getFieldValue(record, 'cdrsScore', idx) || '');
                            const all = splitBySemicolon(current);
                            const p = parseLabel(all[pi] || '');
                            const rebuilt = rebuildNumeric( parseNumeric(p.isLabeled ? p.value : all[pi]) || {nums:editNums, literals:['','']} );
                            all[pi] = p.isLabeled ? `${p.label}: ${rebuilt}` : rebuilt;
                            const fullText = all.join('; ');
                            stageEdit(record, 'cdrsScore', idx, fullText);
                            setEditedSentences(prev => ({ ...prev, [partKey]: 'edited' }));
                            setEditNums([]);
                          })
                        ) : isCdrGlobal ? (
                          <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                            {enumOptionsWith(CDR_GLOBAL_OPTIONS, part).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        )}
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const current = String(getFieldValue(record, 'cdrsScore', idx) || ''); const all = splitBySemicolon(current); const p = parseLabel(all[pi] || ''); let newValPart; if (editNums.length>0) { newValPart = rebuildNumeric(parseNumeric(p.isLabeled?p.value:all[pi]) || {nums:editNums,literals:['','']}); } else { newValPart=editValue.trim(); } all[pi] = p.isLabeled ? `${p.label}: ${newValPart}` : newValPart; const fullText = all.join('; '); stageEdit(record, 'cdrsScore', idx, fullText); setEditedSentences(prev => ({ ...prev, [partKey]: 'edited' })); setEditNums([]); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setEditNums([]); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : part)}</span><span className="edit-indicator">&#x270E;</span></div>
                        <button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(parsed.isLabeled ? parsed.value : part, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        );
      }
      return renderEditableField(record, 'cdrsScore', idx, sid, 'Dementia Overview');
    };

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Dementia Overview')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {renderEditableField(record, 'dementiaType', idx, sid, 'Dementia Overview')}
          {renderCdrsScore()}
        </div>
      </div>
    );
  };

  /* Section 2: Functional Status (bar chart + dot-path editing) */
  const renderFunctionalStatusSection = (record, idx) => {
    const sid = 'functional-status';
    if (!shouldShowSection(record, sid)) return null;
    const adlsVal = getFieldValue(record, 'functionalStatus.adls', idx);
    const iadlsVal = getFieldValue(record, 'functionalStatus.iadls', idx);
    if (!hasVal(adlsVal) && !hasVal(iadlsVal)) return null;
    const copyId = `${sid}-${idx}`;

    /* Parse bar chart scores */
    const funcScores = ['adls', 'iadls'].map(key => {
      const fn = `functionalStatus.${key}`;
      const raw = getFieldValue(record, fn, idx);
      const parsed = parseFunctionalScore(raw);
      if (!parsed || !parsed.score) return null;
      const label = key === 'adls' ? 'ADLs' : 'IADLs';
      const pct = scoreToPct(parsed.score.value, parsed.score.max);
      return { key, fn, label, ...parsed.score, description: parsed.description, percentage: pct, color: getScoreColor(pct), interpretation: getScoreInterpretation(pct), display: `${parsed.score.value}/${parsed.score.max}` };
    }).filter(Boolean);

    const renderFuncField = (fn, label) => {
      const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
      const editKey = `${fn}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];
      const parts = splitFuncStatus(String(val));
      if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {parts.map((part, pi) => {
            const partKey = `${fn}-${idx}-fp${pi}`;
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
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation();
                          /* Reconstruct full text: split by ; then , same as splitFuncStatus but preserve structure */
                          const currentFull = String(getFieldValue(record, fn, idx) || '');
                          /* Simple approach: replace the original text entirely by rebuilding from parts */
                          const currentParts = splitFuncStatus(currentFull);
                          currentParts[pi] = editValue.trim();
                          /* Rebuild: join with ", " and preserve the score prefix */
                          const scoreMatch = currentFull.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*[-\u2013]\s*/);
                          const prefix = scoreMatch ? scoreMatch[0] : '';
                          const newVal = prefix + currentParts.join(', ');
                          stageEdit(record, fn, idx, newVal);
                          setEditedSentences(prev => ({ ...prev, [partKey]: 'edited' }));
                        }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">&#x270E;</span></div>
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
    };

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Functional Status')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {/* Bar chart - display only */}
          {funcScores.length > 0 && (
            <div className="chart-container">
              <div className="chart-legend">
                <span className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }}></span>Normal (&ge;80%)</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: '#fbbf24' }}></span>Mild (50-79%)</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }}></span>Impaired (&lt;50%)</span>
              </div>
              {funcScores.map((s, si) => (
                <div key={si} className="bar-row">
                  <div className="bar-label">{highlightText(s.label)}</div>
                  <div className="bar-container">
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${s.percentage}%`, backgroundColor: s.color }}></div></div>
                    <div className="bar-value" style={{ color: s.color }}>{highlightText(s.display)}</div>
                    <div className="bar-interpretation" style={{ color: s.color }}>{s.interpretation}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {renderFuncField('functionalStatus.adls', 'ADLs')}
          {renderFuncField('functionalStatus.iadls', 'IADLs')}
        </div>
      </div>
    );
  };

  /* Section 3: Behavioral Symptoms (array of strings) */
  const renderBehavioralSymptomsSection = (record, idx) => {
    const sid = 'behavioral-symptoms';
    if (!shouldShowSection(record, sid)) return null;
    const items = safeArray(getFieldValue(record, 'behavioralSymptoms', idx));
    if (items.length === 0) return null;
    const copyId = `${sid}-${idx}`;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Behavioral Symptoms')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {items.map((item, ai) => {
            const arrKey = `behavioralSymptoms-${idx}-a${ai}`;
            const isEditing = editingField === arrKey;
            const badge = editedSentences[arrKey];
            const itemMatches = phraseMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrKey); setEditValue(stripNumber(item)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, 'behavioralSymptoms', idx, ai, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">&#x270E;</span></div>
                      <button className={`copy-btn ${copiedItems[arrKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button>
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

  /* Section 4: Cognitive Enhancers (array of objects) */
  const renderCognitiveEnhancersSection = (record, idx) => {
    const sid = 'cognitive-enhancers';
    if (!shouldShowSection(record, sid)) return null;
    const meds = safeArray(getFieldValue(record, 'cognitiveEnhancers', idx));
    if (meds.length === 0) return null;
    const copyId = `${sid}-${idx}`;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Cognitive Enhancers')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {meds.map((med, mi) => {
            const medContent = [med.medication, ...MED_SUB_FIELDS.filter(f => med[f.key]).map(f => `${f.label}: ${med[f.key]}`)].join(' ');
            if (!phraseMatch && searchTerm.trim() && !medContent.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;

            return (
              <div key={mi} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(med.medication || `Medication ${mi + 1}`)}</div>
                {MED_SUB_FIELDS.map(sf => {
                  const val = med[sf.key]; if (!hasVal(val)) return null;
                  const trackKey = `med-${idx}-${mi}-${sf.key}`;
                  const isEditing = editingField === trackKey;
                  const isModified = editedFields[trackKey];
                  const isDose = sf.key === 'dose';
                  const numericParsed = isDose && hasVal(val) ? parseNumeric(val) : null;
                  const handleDoseSave = () => {
                    if (numericParsed && editNums.length) {
                      const rebuilt = rebuildNumeric(numericParsed);
                      saveMedSubField(record, idx, mi, sf.key, rebuilt);
                    } else {
                      saveMedSubField(record, idx, mi, sf.key, editValue);
                    }
                  };
                  const onClickEdit = () => {
                    if (!isEditing) {
                      if (isDose && numericParsed) {
                        startNumEdit(trackKey, numericParsed);
                      } else {
                        setEditingField(trackKey); setEditValue(fmtVal(val)); setSaveError(null);
                      }
                    }
                  };
                  return (
                    <div key={sf.key} className="nested-mini-card">
                      <div className="nested-subtitle sub-label">{highlightText(sf.label)}</div>
                      <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={onClickEdit}>
                        {isEditing ? (
                          <div className="edit-field-container">
                            {isDose && numericParsed && editNums.length ? (
                              renderNumberEditor(numericParsed, handleDoseSave)
                            ) : sf.key === 'status' ? (
                              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                                {enumOptionsWith(MED_STATUS_OPTIONS, fmtVal(val)).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            )}
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isDose && numericParsed && editNums.length) { handleDoseSave(); } else { saveMedSubField(record, idx, mi, sf.key, editValue); } }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setEditNums([]); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(fmtVal(val))}</span><span className="edit-indicator">&#x270E;</span></div>
                            <button className={`copy-btn ${copiedItems[trackKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${fmtVal(val)}`, trackKey); }}>{copiedItems[trackKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
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

  /* Generic section renderer for standard sections */
  const renderGenericSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAny = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAny) return null;
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
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            if (SEMICOLON_FIELDS.includes(f)) return renderSemicolonField(record, f, idx, sid, title);
            if (f.startsWith('safetyAssessment.')) return renderDotPathSemicolonField(record, f, idx, sid);
            if (f.startsWith('advanceDirectives.')) return renderDotPathField(record, f, idx, sid);
            if (f === 'provider') {
              /* Provider: semicolon-split display with per-part editing (rejoin with '; ') */
              const val = String(getFieldValue(record, f, idx) || ''); if (!val.trim()) return null;
              const provs = val.split(/;\s*/).map(s => s.trim()).filter(Boolean);
              if (provs.length >= 2) {
                return (
                  <div key={f} className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText('Provider')}</div>
                    {provs.map((prov, pi) => {
                      const provKey = `provider-${idx}-p${pi}`;
                      const provEditing = editingField === provKey;
                      const provBadge = editedSentences[provKey];
                      return (
                        <div key={pi}>
                          <div className={`numbered-row ${provBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!provEditing) { setEditingField(provKey); setEditValue(prov); setSaveError(null); } }}>
                            {provEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const all = String(getFieldValue(record, f, idx) || '').split(/;\s*/).map(s => s.trim()).filter(Boolean); all[pi] = editValue.trim(); stageEdit(record, f, idx, all.filter(Boolean).join('; ')); setEditedSentences(prev => ({ ...prev, [provKey]: 'edited' })); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(prov)}</span><span className="edit-indicator">&#x270E;</span></div>
                                <button className={`copy-btn ${copiedItems[provKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(prov, provKey); }}>{copiedItems[provKey] ? 'Copied!' : 'Copy'}</button>
                              </>
                            )}
                          </div>
                          {provBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return renderEditableField(record, f, idx, sid, title);
            }
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="dementia-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dementia Assessment</h2></div>
        <div className="empty-state">No dementia assessment records available</div>
      </div>
    );
  }

  return (
    <div className="dementia-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dementia Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DementiaAssessmentPDFTemplate document={pdfData} />} fileName="Dementia_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dementia assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.status && <span className="record-status">{record.status}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Dementia Assessment ${idx + 1}`)}</h3>
            </div>
            {renderOverviewSection(record, idx)}
            {renderFunctionalStatusSection(record, idx)}
            {renderBehavioralSymptomsSection(record, idx)}
            {renderCognitiveEnhancersSection(record, idx)}
            {renderGenericSection(record, idx, 'caregiver-burden')}
            {renderGenericSection(record, idx, 'safety-assessment')}
            {renderGenericSection(record, idx, 'advance-directives')}
            {renderGenericSection(record, idx, 'findings')}
            {renderGenericSection(record, idx, 'assessment')}
            {renderGenericSection(record, idx, 'plan')}
            {renderGenericSection(record, idx, 'results')}
            {renderGenericSection(record, idx, 'recommendations')}
            {renderGenericSection(record, idx, 'notes')}
            {renderGenericSection(record, idx, 'provider-info')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DementiaAssessmentDocument;
