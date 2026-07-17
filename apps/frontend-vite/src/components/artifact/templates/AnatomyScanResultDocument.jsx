/**
 * AnatomyScanResultDocument.jsx
 * June 2026 — Fetal anatomy ultrasound survey (second-trimester anatomy scan)
 * Collection: anatomy_scan_result
 *
 * 5 Sections (covering all 20 extractable fields, none added/omitted):
 *   1. scan-overview:  gestationalAge, scanCompleteness, fetalNumber, sex
 *   2. fetal-anatomy:  brain, face, spine, heart, chest, abdomen, kidneys, extremities
 *   3. placenta-fluid: placenta, amnioticFluid
 *   4. findings-recs:  abnormalities (array), recommendations, notes
 *   5. provider:       sonographer, facility, date
 *
 * Field handling:
 *   - Narrative strings (organ findings, recommendations, notes) → per-sentence/semicolon
 *     split with TRAILING-DELIMITER STRIP + per-sentence editing
 *   - Array (abnormalities) → per-item, delimiters stripped
 *   - date → formatted, simple field
 *   - Short strings (gestationalAge, scanCompleteness, fetalNumber, sex, sonographer, facility) → simple field
 *   - hide-empty everywhere; never truthiness for numeric
 *
 * THE SPLIT FIX (root defect this rebuild addresses):
 *   stripDelims() removes any trailing [.;,]+ (and trims) from EVERY rendered row, so no
 *   leftover ";" / "." / "," ever shows. Internal commas inside a finding are preserved
 *   ("right 6.2 mm, left 5.8 mm" stays ONE row). Applied identically in all 4 areas:
 *   JSX render, per-section Copy, Copy All, and PDF.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AnatomyScanResultDocumentPDFTemplate from '../pdf-templates/AnatomyScanResultDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './AnatomyScanResultDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'scan-overview': 'Scan Overview',
  'fetal-anatomy': 'Fetal Anatomy',
  'placenta-fluid': 'Placenta & Amniotic Fluid',
  'findings-recs': 'Findings & Recommendations',
  'provider': 'Provider',
};

const FIELD_LABELS = {
  gestationalAge: 'Gestational Age',
  scanCompleteness: 'Scan Completeness',
  fetalNumber: 'Fetal Number',
  sex: 'Sex',
  brain: 'Brain',
  face: 'Face',
  spine: 'Spine',
  heart: 'Heart',
  chest: 'Chest',
  abdomen: 'Abdomen',
  kidneys: 'Kidneys',
  extremities: 'Extremities',
  placenta: 'Placenta',
  amnioticFluid: 'Amniotic Fluid',
  abnormalities: 'Abnormalities',
  recommendations: 'Recommendations',
  notes: 'Notes',
  sonographer: 'Sonographer',
  facility: 'Facility',
  date: 'Scan Date',
};

const SECTION_FIELDS = {
  'scan-overview': ['gestationalAge', 'scanCompleteness', 'fetalNumber', 'sex'],
  'fetal-anatomy': ['brain', 'face', 'spine', 'heart', 'chest', 'abdomen', 'kidneys', 'extremities'],
  'placenta-fluid': ['placenta', 'amnioticFluid'],
  'findings-recs': ['abnormalities', 'recommendations', 'notes'],
  'provider': ['sonographer', 'facility', 'date'],
};

// Narrative string fields → per-sentence/semicolon editing.
const STRING_FIELDS = ['brain', 'face', 'spine', 'heart', 'chest', 'abdomen', 'kidneys', 'extremities', 'placenta', 'amnioticFluid', 'recommendations', 'notes'];
// Array fields → per-item editing.
const ARRAY_FIELDS = ['abnormalities'];
// Date fields → formatted, simple field.
const DATE_FIELDS = ['date'];
// Simple short strings → simple field (everything else not classified above).
const SIMPLE_FIELDS = ['gestationalAge', 'scanCompleteness', 'fetalNumber', 'sex', 'sonographer', 'facility'];
const COMMA_SPLIT_FIELDS = new Set([]);
const SEMICOLON_SPLIT_FIELDS = new Set(STRING_FIELDS);
const SEMICOLON_SEPARATOR = /;\s+/;

/* ═══════ SHARED HELPERS (delimiter-stripping) ═══════ */
/* stripDelims: remove ANY trailing [.;,]+ and surrounding whitespace from a row.
   This is THE fix — no rendered row ever ends with ; . or , */
const stripDelims = (text) => {
  if (text === null || text === undefined) return '';
  return String(text).replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();
};

/* splitBySentence: split on sentence (.) and clinical-finding (;) boundaries, with
   parenthesis protection and title protection (Mr./Dr./etc.). Each resulting row is
   delimiter-stripped. Internal commas are KEPT (one finding can contain commas). */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    const atBoundary = ch === '.' && parenDepth === 0 &&
      (i + 1 >= text.length || /\s/.test(text[i + 1]));
    if (atBoundary) {
      // Title protection: don't split "Dr." / "Mr." etc.
      if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/.test(current)) {
        current += ch;
        continue;
      }
      const t = stripDelims(current);
      if (t) result.push(t);
      current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
    } else {
      current += ch;
    }
  }
  const t = stripDelims(current);
  if (t) result.push(t);
  return result;
};

/* reconstructFullText: rejoin sentence rows with period restoration on every row. */
const reconstructFullText = (sentences) => {
  if (!sentences || sentences.length === 0) return '';
  return sentences
    .map(s => stripDelims(s))
    .filter(Boolean)
    .map(s => (/[.!?]$/.test(s) ? s : s + '.'))
    .join(' ');
};

/* parseLabel: detect "Label: value" patterns. */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: stripDelims(m[2]) };
  return { isLabeled: false, label: '', value: text };
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name; arrays store the full array) */
const DRAFT_KEY = 'anatomy_scan_resultPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* splitOnChar: split on a single separator char at paren depth 0. For comma, a comma BETWEEN two
   digits is NOT a separator (46,XX / 1,000 / "6.2 mm, left 5.8" ranges). Each part is delimiter-stripped. */
const splitOnChar = (text, sep) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === sep && depth === 0) {
      if (sep === ',' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) { cur += ch; continue; }
      const t = stripDelims(cur); if (t) out.push(t); cur = '';
    } else { cur += ch; }
  }
  const t = stripDelims(cur); if (t) out.push(t);
  return out;
};

/* clausesOf: semicolon FIRST (>=2 → list, sep '; '), else comma ONLY when labeled (>=3 per Rule #73,
   sep ', ' — so "Complete, no anomalies detected" stays ONE row), else single clause. */
const clausesOf = (base, fieldName) => {
  const semi = SEMICOLON_SPLIT_FIELDS.has(fieldName) && SEMICOLON_SEPARATOR.test(base) ? splitOnChar(base, ';') : [base];
  if (semi.length >= 2) return { sep: '; ', items: semi };
  if (COMMA_SPLIT_FIELDS.has(fieldName)) { const c = splitOnChar(base, ','); if (c.length >= 2) return { sep: ', ', items: c }; }
  return { sep: null, items: [stripDelims(base)] };
};

/* segmentSentence: a semicolon list (>=2) is decomposed FIRST (each clause kept whole, NO leading-label
   hoist), else parseLabel + clausesOf. SHARED by buildUnits (render) AND saveClause (edit) so the
   per-clause edit reconstruction stays lossless. */
const segmentSentence = (sentence, fieldName) => {
  const semi = SEMICOLON_SPLIT_FIELDS.has(fieldName) && SEMICOLON_SEPARATOR.test(sentence) ? splitOnChar(sentence, ';') : [sentence];
  if (semi.length >= 2) return { label: null, sep: '; ', items: semi.map(s => stripDelims(s)) };
  const p = parseLabel(sentence);
  const { sep, items } = clausesOf(p.isLabeled ? p.value : sentence, fieldName);
  return { label: p.isLabeled ? p.label : null, sep, items };
};

/* buildUnits: period-split sentences → segmentSentence. A LABELED sentence = its own unit (sub-label);
   CONSECUTIVE UNLABELED sentences MERGE into one card. Rows carry {text, sIdx, cIdx, sep} for editing. */
const buildUnits = (value, fieldName) => {
  const sentences = splitBySentence(String(value || ''));
  const units = [];
  sentences.forEach((sentence, sIdx) => {
    const { label, sep, items } = segmentSentence(sentence, fieldName);
    const rows = items.map((text, cIdx) => ({ text: stripDelims(text), sIdx, cIdx, sep }));
    const last = units[units.length - 1];
    if (!label && last && !last.label) last.rows.push(...rows);
    else units.push({ label, rows });
  });
  return units;
};

/* ═══════ COMPONENT ═══════ */
const AnatomyScanResultDocument = ({ document: docProp, data, templateData }) => {
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

  /* ═══════ DATA UNWRAP (3-prop, all formats) ═══════ */
  const records = useMemo(() => {
    const src = docProp || data || templateData;
    if (!src) return [];
    let arr = Array.isArray(src) ? src : [src];
    arr = arr.flatMap(r => {
      if (r?.anatomy_scan_result) return Array.isArray(r.anatomy_scan_result) ? r.anatomy_scan_result : [r.anatomy_scan_result];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.anatomy_scan_result) return Array.isArray(dd.anatomy_scan_result) ? dd.anatomy_scan_result : [dd.anatomy_scan_result];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = (() => { const r = record?._id; if (!r) return null; if (typeof r === 'string') return r; if (r.$oid) return r.$oid; return String(r); })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        // Mark badges using the SAME keys the renderers read (the whole drafted field is pending):
        //   array → per-item `${f}-${idx}-a${i}` (renderArrayField); string → per-clause
        //   `${f}-${idx}-s${sIdx}-c${cIdx}` (renderStringField, via buildUnits). A bare `-s0` matched neither.
        if (Array.isArray(value)) {
          value.forEach((_, i) => { nFields[`${fieldPart}-${idx}-a${i}`] = 'edited'; });
        } else {
          buildUnits(String(value || ''), fieldPart).forEach(u => u.rows.forEach(r => { nSentences[`${fieldPart}-${idx}-s${r.sIdx}-c${r.cIdx}`] = 'edited'; }));
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    const timer = setTimeout(() => {
      setLocalEdits(prev => ({ ...nLocal, ...prev }));
      setPendingEdits(prev => ({ ...nPending, ...prev }));
      setEditedFields(prev => ({ ...nFields, ...prev }));
      setEditedSentences(prev => ({ ...nSentences, ...prev }));
    }, 0);
    return () => clearTimeout(timer);
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }, []);

  const fmtVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime()) || d.getFullYear() < 1971) return '';
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return ''; }
  }, []);

  const safeArray = useCallback((v) => (Array.isArray(v) ? v.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : []), []);

  /* per-field presence + display value (handles date + array + string) */
  const fieldHasVal = useCallback((fn, v) => {
    if (ARRAY_FIELDS.includes(fn)) return safeArray(v).length > 0;
    if (DATE_FIELDS.includes(fn)) return formatDate(v) !== '';
    return hasVal(v);
  }, [hasVal, safeArray, formatDate]);

  const fieldDisplay = useCallback((fn, v) => {
    if (DATE_FIELDS.includes(fn)) return formatDate(v);
    return fmtVal(v);
  }, [formatDate, fmtVal]);

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

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.startsWith(p) || p.startsWith(t);
  }, [searchTerm]);

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
  // Level 2: section visibility (startsWith on title, plus field labels/values).
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.startsWith(phrase) || phrase.startsWith(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (!fieldHasVal(f, val)) continue;
      if (ARRAY_FIELDS.includes(f)) {
        if (safeArray(val).some(item => stripDelims(item).toLowerCase().includes(phrase))) return true;
      } else if (fieldDisplay(f, val).toLowerCase().includes(phrase)) {
        return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fieldHasVal, fieldDisplay, safeArray]);

  // Level 3: field/row visibility.
  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return false;
    if (ARRAY_FIELDS.includes(fn)) {
      return safeArray(val).some(item => stripDelims(item).toLowerCase().includes(phrase));
    }
    return fieldDisplay(fn, val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fieldHasVal, fieldDisplay, safeArray]);

  // Level 1: record/document filtering with searchableText incl document + record title.
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `Anatomy Scan Result ${idx + 1}`.toLowerCase();
      const searchableParts = ['anatomy scan result', recordTitle];
      Object.values(SECTION_TITLES).forEach(t => searchableParts.push(t.toLowerCase()));
      Object.values(FIELD_LABELS).forEach(l => searchableParts.push(l.toLowerCase()));
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (!fieldHasVal(f, val)) continue;
          if (ARRAY_FIELDS.includes(f)) {
            safeArray(val).forEach(item => searchableParts.push(stripDelims(item).toLowerCase()));
          } else {
            searchableParts.push(fieldDisplay(f, val).toLowerCase());
          }
        }
      }
      const searchableText = searchableParts.filter(Boolean).join(' ');
      const matches = searchableText.includes(phrase);
      if (matches) {
        // Title-level matches reveal all sections.
        if (recordTitle.startsWith(phrase) || phrase.startsWith(recordTitle) ||
            'anatomy scan result'.startsWith(phrase) || phrase.startsWith('anatomy scan result')) {
          record._showAllSections = true;
        }
      }
      return matches;
    });
  }, [records, searchTerm, getFieldValue, fieldHasVal, fieldDisplay, safeArray]);

  /* ═══════ PDF DATA (merge local edits) ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key];
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* Stage a string-field DRAFT (localStorage, no DB write) + rebase clause badges on splice so a badge
     never drifts onto an untouched clause. Approve commits. */
  const stageDraftClause = (record, fn, idx, sid, fullText, sentenceMarks, rebase) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => {
      let next;
      if (rebase && rebase.delta) {
        next = {};
        const { prefix, at, delta } = rebase;
        for (const [k, v] of Object.entries(prev)) {
          if (k.startsWith(prefix)) { const n = parseInt(k.slice(prefix.length), 10); if (!isNaN(n)) { if (n === at) continue; if (n > at) { next[`${prefix}${n + delta}`] = v; continue; } } }
          next[k] = v;
        }
      } else { next = { ...prev }; }
      return { ...next, ...sentenceMarks };
    });
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store);
    setEditingField(null); setEditValue('');
  };

  /* Per-clause save: reconstruct the sentence via segmentSentence (same decomposition as buildUnits),
     splice the edited clause, rebuild the full field. Blank edit deletes the clause; typing the
     separator splits. Stages a DRAFT (localStorage); committed only on Approve. */
  function saveClause(record, fn, idx, sid, sIdx, cIdx) {
    const id = safeId(record); if (!id) return;
    const cur = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(cur);
    const sentence = sentences[sIdx] || '';
    const { label, sep, items } = segmentSentence(sentence, fn);
    const origLen = items.length;
    const edited = stripDelims(editValue);
    const sKeyBase = `${fn}-${idx}-s${sIdx}`;
    const marks = {}; let isDelete = false;
    setSaveError(null);
    if (!edited) { if (cIdx < items.length) items.splice(cIdx, 1); isDelete = true; }
    else {
      const sepChar = sep ? sep.trim()[0] : null;
      const subParts = (sepChar ? splitOnChar(edited, sepChar) : [edited]).map(s => stripDelims(s)).filter(Boolean);
      if (subParts.length === 0) { if (cIdx < items.length) items.splice(cIdx, 1); isDelete = true; }
      else { items.splice(cIdx, 1, ...subParts); marks[`${sKeyBase}-c${cIdx}`] = 'edited'; for (let e = 1; e < subParts.length; e++) marks[`${sKeyBase}-c${cIdx + e}`] = 'added'; }
    }
    if (isDelete) setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    const delta = items.length - origLen;
    const newBase = items.join(sep || ' ');
    const rebuilt = label ? (newBase ? `${label}: ${newBase}` : '') : newBase;
    sentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(sentences);
    stageDraftClause(record, fn, idx, sid, fullText, marks, { prefix: `${sKeyBase}-c`, at: cIdx, delta });
  }

  /* per-array-item save (plain function) — stages a DRAFT locally; committed only on Approve. */
  function saveArrayItem(record, fn, idx, sid, itemIdx) {
    const id = safeId(record); if (!id) return;
    const current = [...safeArray(getFieldValue(record, fn, idx))];
    const editedVal = stripDelims(editValue);
    if (!editedVal) current.splice(itemIdx, 1);
    else current[itemIdx] = editedVal;
    const filtered = current.filter(i => String(i).trim().length > 0);
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: filtered }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited', [`${fn}-${idx}-a${itemIdx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = filtered; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so committed
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true);
    setSaveError(null);
    try {
      // Collect this section's pending edits (editKey = "field-idx").
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart;
        return fields.includes(baseField);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for dotted numeric keys).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await secureApiClient.put(`/api/edit/anatomy_scan_result/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/anatomy_scan_result/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage.
      if (toCommit.length > 0) {
        const store = readDrafts();
        if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error(err);
      setSaveError(err?.message || 'Unable to approve this section.');
    } finally {
      setSaving(false);
    }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = window.document.createElement('textarea');
      ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(ta);
      ta.select(); window.document.execCommand('copy');
      (containerRef.current || window.document.body).removeChild(ta);
      return true;
    }
  }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY (delimiter-stripped) ═══════ */
  // Mirror the JSX units: labeled unit → "Label:" + indented numbered rows; unlabeled unit → numbered rows.
  const formatFieldForCopy = useCallback((text, fieldName) => {
    const units = buildUnits(text, fieldName);
    const lines = [];
    units.forEach(u => {
      if (u.label) { lines.push(`${u.label}:`); u.rows.forEach((r, i) => lines.push(`  ${i + 1}. ${r.text}`)); }
      else u.rows.forEach((r, i) => lines.push(`${i + 1}. ${r.text}`));
    });
    return lines;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      if (ARRAY_FIELDS.includes(f)) {
        text += `${label}\n`;
        safeArray(val).forEach((item, i) => { text += `  ${i + 1}. ${stripDelims(item)}\n`; });
        text += '\n';
      } else if (DATE_FIELDS.includes(f) || SIMPLE_FIELDS.includes(f)) {
        text += `${label}\n${fieldDisplay(f, val)}\n\n`;
      } else {
        text += `${label}\n`;
        formatFieldForCopy(fmtVal(val), f).forEach(l => { text += `${l}\n`; });
        text += '\n';
      }
    });
    return text;
  }, [getFieldValue, fieldHasVal, fieldDisplay, fmtVal, safeArray, formatFieldForCopy]);

  const copyAllText = useCallback(async () => {
    let text = '=== ANATOMY SCAN RESULT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Anatomy Scan Result ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: SIMPLE / DATE FIELD ═══════ */
  const renderSimpleField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fieldDisplay(fn, val);
    const isModified = editedFields[editKey];
    const isDate = DATE_FIELDS.includes(fn);

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card regular-row-group">
        <div className="editable-leaf" data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isDate ? (val ? new Date(val).toISOString().split('T')[0] : '') : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isDate ? (
                <BlueDatePicker value={editValue} onSelect={next => setEditValue(next || '')} />
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSaveField(record, fn, idx, sid, null, editValue.trim()); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, isDate ? (editValue ? new Date(editValue).toISOString() : '') : editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD (buildUnits triple-nested: labeled → sub-label cards) ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const strVal = fmtVal(val);
    const label = FIELD_LABELS[fn] || fn;
    const units = buildUnits(strVal, fn);
    if (!units.length) return null;
    const term = searchTerm.toLowerCase().trim();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = !!term && label.toLowerCase().includes(term);
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {units.map((unit, uIdx) => {
          const unitLabelMatch = labelMatch || (!!term && unit.label && unit.label.toLowerCase().includes(term));
          const visibleRows = unit.rows.filter(r => phraseMatch || unitLabelMatch || (!!term && r.text.toLowerCase().includes(term)));
          if (searchTerm.trim() && !visibleRows.length) return null;
          return (
            <div key={uIdx} className="nested-mini-card">
              {unit.label && <div className="nested-subtitle sub-label">{highlightText(unit.label)}</div>}
              {visibleRows.map(row => {
                const rowKey = `${fn}-${idx}-s${row.sIdx}-c${row.cIdx}`;
                const isEditing = editingField === rowKey;
                const badge = editedSentences[rowKey];
                return (
                  <div key={`${row.sIdx}-${row.cIdx}`} className="editable-leaf" data-edit-field={fn}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(row.text); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveClause(record, fn, idx, sid, row.sIdx, row.cIdx); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveClause(record, fn, idx, sid, row.sIdx, row.cIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(row.text)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(row.text, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (abnormalities — per-item, strip delimiters) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const items = safeArray(getFieldValue(record, fn, idx));
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    // Compute visible items BEFORE rendering the card (no empty container).
    const visible = items
      .map((item, aIdx) => ({ item: stripDelims(item), aIdx }))
      .filter(({ item }) => {
        if (!searchTerm.trim() || phraseMatch || labelMatch) return true;
        return item.toLowerCase().includes(searchTerm.toLowerCase().trim());
      });
    if (visible.length === 0) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {visible.map(({ item, aIdx }) => {
          const itemKey = `${fn}-${idx}-a${aIdx}`;
          const isEditing = editingField === itemKey;
          const isModified = editedFields[itemKey];
          return (
            <div key={aIdx} className="nested-mini-card editable-leaf" data-edit-field={fn}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(item); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveArrayItem(record, fn, idx, sid, aIdx); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fn, idx, sid, aIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value warning-text">{highlightText(item)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: ONE FIELD (dispatch by type) ═══════ */
  const renderField = (record, fn, idx, sid) => {
    if (ARRAY_FIELDS.includes(fn)) return renderArrayField(record, fn, idx, sid);
    if (STRING_FIELDS.includes(fn)) return renderStringField(record, fn, idx, sid);
    return renderSimpleField(record, fn, idx, sid); // SIMPLE_FIELDS + DATE_FIELDS
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => fieldHasVal(f, getFieldValue(record, f, idx)));
    if (!hasAnyVal) return null;
    const isWarning = sid === 'findings-recs';
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className={`mini-cards-container ${isWarning ? 'warning-container' : ''}`}>
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => renderField(record, f, idx, sid))}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="anatomy-scan-result-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Anatomy Scan Result</h2></div>
        <div className="empty-state">No anatomy scan result records available</div>
      </div>
    );
  }

  return (
    <div className="anatomy-scan-result-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Anatomy Scan Result</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<AnatomyScanResultDocumentPDFTemplate document={pdfData} />} fileName="Anatomy_Scan_Result.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search anatomy scan result..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Anatomy Scan Result ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'scan-overview')}
            {renderSection(record, idx, 'fetal-anatomy')}
            {renderSection(record, idx, 'placenta-fluid')}
            {renderSection(record, idx, 'findings-recs')}
            {renderSection(record, idx, 'provider')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnatomyScanResultDocument;
