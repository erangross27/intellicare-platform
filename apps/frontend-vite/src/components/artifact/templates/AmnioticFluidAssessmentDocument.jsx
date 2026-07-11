/**
 * AmnioticFluidAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: amniotic_fluid_assessment
 *
 * 5 Sections:
 *   1. header-info: date, provider, facility, status
 *   2. monitoring-config: frequency, startingWeek, method
 *   3. clinical-findings: findings, assessment
 *   4. plan-notes: plan, notes
 *   5. thresholds-data: thresholds (object with polyhydramnios/oligohydramnios/normalRange)
 *   6. results-data: results (recursive OBJECT)
 *   7. recommendations-data: recommendations (array of {recommendation, date}, date-grouped)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AmnioticFluidAssessmentDocumentPDFTemplate from '../pdf-templates/AmnioticFluidAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AmnioticFluidAssessmentDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'header-info': 'Header Information',
  'monitoring-config': 'Monitoring Configuration',
  'clinical-findings': 'Clinical Findings',
  'plan-notes': 'Plan & Notes',
  'thresholds-data': 'Thresholds',
  'results-data': 'Results',
  'recommendations-data': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  frequency: 'Frequency',
  startingWeek: 'Starting Week',
  method: 'Method',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  thresholds: 'Thresholds',
  results: 'Results',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'header-info': ['date', 'provider', 'facility', 'status'],
  'monitoring-config': ['frequency', 'startingWeek', 'method'],
  'clinical-findings': ['findings', 'assessment'],
  'plan-notes': ['plan', 'notes'],
  'thresholds-data': ['thresholds'],
  'results-data': ['results'],
  'recommendations-data': ['recommendations'],
};

const BOOLEAN_FIELDS = [];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = [];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const NUMBER_FIELDS = ['startingWeek'];
const STRING_FIELDS = ['provider', 'facility', 'status', 'frequency', 'method', 'findings', 'assessment', 'plan', 'notes'];

/* ═══════ OBJECT/SCALAR HELPERS (for results recursive renderer) ═══════ */
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* Strip trailing list/sentence punctuation from a display clause */
const STRIP = (s) => String(s == null ? '' : s).replace(/[;.\s]+$/, '').trim();

/* Paren-aware split on a single separator char. For comma, skip a comma between two digits
   (thousands sep / "46,XX" karyotype / numeric ranges). */
const splitOnChar = (text, sep) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === sep && depth === 0) {
      if (sep === ',' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = '';
    } else { cur += ch; }
  }
  const t = cur.trim(); if (t) out.push(t);
  return out;
};

/* splitByComma kept for back-compat (paren-aware) */
const splitByComma = (text) => splitOnChar(text, ',');

/* clausesOf: choose the list separator for a value. Semicolon first (>=2 items) — always safe
   (explicit separator). Comma (>=3) ONLY for LABELED values (genuine lists) — never comma-split
   unlabeled narrative, so "Robert Yamashiro, MD, FACOG" stays whole. Else a single clause. */
const clausesOf = (base, isLabeled) => {
  const semi = splitOnChar(base, ';');
  if (semi.length >= 2) return { sep: '; ', items: semi };
  if (isLabeled) { const c = splitOnChar(base, ','); if (c.length >= 3) return { sep: ', ', items: c }; }
  return { sep: null, items: [String(base || '').trim()] };
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { field, value, local, fields, sentences } } }
     - editKey  : the localEdits key ("field-idx") so rehydration can re-render the draft
     - field    : exact API field for the /edit payload (may be dotted, e.g. "thresholds.x")
     - value    : exact API value for the /edit payload (leaf value, full text, or array)
     - local    : the value stored into localEdits (drives JSX rendering — object/array/string)
     - fields   : { [editedFieldsKey]: 'edited' }    markers to restore on rehydrate
     - sentences: { [editedSentencesKey]: 'edited'|'added' } markers to restore on rehydrate */
const DRAFT_KEY = 'amniotic_fluid_assessmentPendingEdits';
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
const AmnioticFluidAssessmentDocument = ({ document: docProp }) => {
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
  const [saveError, setSaveError] = useState(null);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.amniotic_fluid_assessment) return Array.isArray(r.amniotic_fluid_assessment) ? r.amniotic_fluid_assessment : [r.amniotic_fluid_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.amniotic_fluid_assessment) return Array.isArray(dd.amniotic_fluid_assessment) ? dd.amniotic_fluid_assessment : [dd.amniotic_fluid_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* safeId at module level not available; define locally below in UTILS. Rehydrate uses inline id extract. */

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Maps each record's stored drafts onto its current render index. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const getId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = getId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, draft]) => {
        if (!draft || typeof draft !== 'object') return;
        // editKey was stored as "field-<origIdx>"; remap the trailing idx to the current render idx
        const baseKey = editKey.replace(/-\d+$/, `-${idx}`);
        nLocal[baseKey] = draft.local;
        nPending[baseKey] = true;
        const remap = (k) => k.replace(/-\d+(?=(-|$))/, `-${idx}`);
        if (draft.fields) Object.entries(draft.fields).forEach(([k, v]) => { nFields[remap(k)] = v; });
        if (draft.sentences) Object.entries(draft.sentences).forEach(([k, v]) => { nSentences[remap(k)] = v; });
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
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  // Build display "units" for a string field: split into sentences (period), then each labeled value
  // (or unlabeled sentence) into clauses via clausesOf (semicolon-first; comma >=3 only for labeled).
  // Consecutive UNLABELED sentences merge into ONE card. Each row carries its sentence+clause index.
  const buildUnits = (value) => {
    const sentences = splitBySentence(String(value || ''));
    const units = [];
    sentences.forEach((sentence, sIdx) => {
      const p = parseLabel(sentence);
      const base = p.isLabeled ? p.value : sentence;
      const { sep, items } = clausesOf(base, p.isLabeled);
      const rows = items.map((text, cIdx) => ({ text: STRIP(text), sIdx, cIdx, sep }));
      const last = units[units.length - 1];
      if (!p.isLabeled && last && !last.label) last.rows.push(...rows);
      else units.push({ label: p.isLabeled ? p.label : null, rows });
    });
    return units;
  };

  // Stage one clause edit as a DRAFT (no DB write). Reconstructs the sentence with its detected
  // separator (';' or ','), then the full field, preserving every other clause. A blank edit deletes
  // the clause; typing the separator splits into added clauses. Approve commits it.
  function saveClause(record, fn, idx, sid, sIdx, cIdx) {
    const id = safeId(record); if (!id) return;
    const cur = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(cur);
    const sentence = sentences[sIdx] || '';
    const p = parseLabel(sentence);
    const base = p.isLabeled ? p.value : sentence;
    const { sep, items } = clausesOf(base, p.isLabeled);
    const origLen = items.length;
    const edited = editValue.trim();
    const sKeyBase = `${fn}-${idx}-s${sIdx}`;
    const marks = {};
    let isDelete = false;
    if (!edited || /^[;.,!?]+$/.test(edited)) {
      if (cIdx < items.length) items.splice(cIdx, 1);
      isDelete = true;
    } else {
      const sepChar = sep ? sep.trim()[0] : null;
      const subParts = (sepChar ? splitOnChar(edited, sepChar) : [edited]).map(s => s.replace(/[;.]+$/, '').trim()).filter(Boolean);
      if (subParts.length === 0) { if (cIdx < items.length) items.splice(cIdx, 1); isDelete = true; }
      else {
        items.splice(cIdx, 1, ...subParts);
        marks[`${sKeyBase}-c${cIdx}`] = 'edited';
        for (let e = 1; e < subParts.length; e++) marks[`${sKeyBase}-c${cIdx + e}`] = 'added';
      }
    }
    const delta = items.length - origLen; // -1 on delete, +N-1 on a separator-add; 0 on a plain edit
    const newBase = items.join(sep || ' ');
    const rebuilt = p.isLabeled ? (newBase ? `${p.label}: ${newBase}` : '') : newBase;
    sentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(sentences);
    // A clause delete has no specific clause to badge → flag the field so the section's approve button
    // still appears (sectionHasEdits matches startsWith `${f}-${idx}`); no false row badge.
    const fieldFlag = isDelete ? { [`${fn}-${idx}`]: 'edited' } : null;
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    stageDraft(record, `${fn}-${idx}`, fullText, fn, fullText, fieldFlag, marks, { prefix: `${sKeyBase}-c`, at: cIdx, delta });
  }

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Pending Approve
     (handleApproveSection commits). editKey = localEdits key ("field-idx"). field/value = exact
     API payload to replay on approve. fields/sentences = edited-marker maps to persist. */
  const stageDraft = useCallback((record, editKey, localVal, field, value, fields, sentences, rebase) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [editKey]: localVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (fields) setEditedFields(prev => ({ ...prev, ...fields }));
    if (sentences || (rebase && rebase.delta)) setEditedSentences(prev => {
      // Re-base existing clause badges after an index-shifting edit so a badge never drifts onto an
      // untouched clause (delete shifts indices down; separator-add shifts them up).
      let next = prev;
      if (rebase && rebase.delta) {
        next = {};
        const { prefix, at, delta } = rebase;
        for (const [k, v] of Object.entries(prev)) {
          if (k.startsWith(prefix)) {
            const n = parseInt(k.slice(prefix.length), 10);
            if (!isNaN(n)) { if (n === at) continue; if (n > at) { next[`${prefix}${n + delta}`] = v; continue; } }
          }
          next[k] = v;
        }
      } else { next = { ...prev }; }
      return { ...next, ...(sentences || {}) };
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    const existing = store[id][editKey] || {};
    store[id][editKey] = {
      field, value, local: localVal,
      fields: { ...(existing.fields || {}), ...(fields || {}) },
      sentences: { ...(existing.sentences || {}), ...(sentences || {}) },
    };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

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

  /* recommendations (array of {recommendation, date}) → searchable text */
  const recsToText = useCallback((recs) => {
    if (!Array.isArray(recs)) return '';
    return recs.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ');
  }, []);

  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (OBJECT_ARRAY_FIELDS.includes(f)) return recsToText(val);
    if (OBJECT_FIELDS.includes(f)) return flattenSearchable(val);
    return fmtVal(val);
  }, [recsToText, fmtVal]);

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
  const shouldShowSection = useCallback((record, sid, idx = 0) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, idx);
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
      const rt = `Amniotic Fluid Assessment ${idx + 1}`.toLowerCase();
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
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setSaveError(null);
    // Stage a DRAFT only — no DB write. Pending Approve commits it.
    stageDraft(record, editKey, saveVal, fn, saveVal, { [trackKey]: 'edited' }, null);
  }, [editValue, safeId, stageDraft]);

  /* ═══════ SAVE OBJECT LEAF (dotted path) ═══════ */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    const editKey = `${rootField}-${idx}`;
    setSaveError(null);
    // Build the merged clone object for local rendering (mirrors prior behavior).
    const cur = localEdits[editKey] !== undefined ? localEdits[editKey] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    // Re-edit after approval → drop the section's approved flag so the button returns to yellow.
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Stage a DRAFT only — DB write happens on Pending Approve (payload = dotted field + leaf value).
    stageDraft(record, editKey, clone, dottedField, newVal, { [leafKeyTrack]: 'edited' }, null);
  }, [safeId, localEdits, stageDraft]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF/Copy All. This is the ONLY path that writes to the DB.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // editKeys staged for THIS section+record: editKey is "field-idx"; base field must be in section.
    const toCommit = Object.keys(pendingEdits).filter(k => {
      if (!pendingEdits[k]) return false;
      const m = k.match(/^(.+)-(\d+)$/);
      if (!m || parseInt(m[2], 10) !== idx) return false;
      return fields.includes(m[1]);
    });
    setSaving(true); setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // Persist each staged field to the DB now using its exact saved {field, value} payload.
      // arrayIndex is added ONLY when the field's trailing dot-segment is purely numeric.
      for (const editKey of toCommit) {
        const draft = recDrafts[editKey];
        const apiField = draft ? draft.field : editKey.replace(/-\d+$/, '');
        const apiValue = draft ? draft.value : localEdits[editKey];
        const payload = { field: apiField, value: apiValue };
        const dot = apiField.lastIndexOf('.');
        if (dot !== -1 && /^\d+$/.test(apiField.slice(dot + 1))) {
          payload.field = apiField.slice(0, dot);
          payload.arrayIndex = parseInt(apiField.slice(dot + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/amniotic_fluid_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/amniotic_fluid_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      if (store[id]) {
        toCommit.forEach(k => { delete store[id][k]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed.'); } finally { setSaving(false); }
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
  // Copy formatting mirrors the JSX units: labeled unit → "Label:" + indented numbered rows;
  // unlabeled unit → numbered rows. Per-unit numbering (matches the PDF).
  const formatFieldForCopy = (text) => {
    const units = buildUnits(text);
    const lines = [];
    units.forEach(u => {
      if (u.label) { lines.push(`${u.label}:`); u.rows.forEach((r, i) => lines.push(`  ${i + 1}. ${r.text}`)); }
      else u.rows.forEach((r, i) => lines.push(`${i + 1}. ${r.text}`));
    });
    return lines;
  };

  /* object → copy lines (recursive) */
  const objectCopyLines = useCallback((label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val : [];
        if (!sameAsTitle) text += `${label}\n`;
        let lastDate = null; let n = 1;
        recs.forEach((r) => {
          const rec = (r?.recommendation || '').trim();
          const date = (r?.date || '').trim();
          if (date !== lastDate) { if (date) text += `${date}\n`; lastDate = date; n = 1; }
          text += `${n++}. ${rec}\n`;
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        if (!sameAsTitle) text += `${label}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (f === 'thresholds') {
        if (typeof val === 'object' && !Array.isArray(val)) {
          // duplicate label suppression: skip label if it matches section title
          const entries = Object.entries(val);
          if (entries.length > 0) {
            text += `${label}\n`;
            entries.forEach(([k, v]) => { text += `  ${k}: ${v}\n`; });
            text += '\n';
          }
        } else {
          text += `${label}\n${fmtVal(val)}\n\n`;
        }
      } else if (NUMBER_FIELDS.includes(f)) {
        text += `${label}: ${fmtVal(val)}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        text += `${label}\n`;
        formatFieldForCopy(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        text += `${label}\n${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== AMNIOTIC FLUID ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Amniotic Fluid Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
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
              <input type="number" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} style={{ minHeight: 'auto', padding: '10px' }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
    );
  };

  /* ═══════ RENDER: THRESHOLDS (object field) ═══════ */
  const renderThresholdsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (typeof val === 'object' && !Array.isArray(val)) {
      const entries = Object.entries(val);
      if (entries.length === 0) return null;
      return (
        <div key={fn} className="rec-mini-card">
          {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {entries.map(([tKey, tValue], tIdx) => {
            const editKey = `${fn}.${tKey}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const displayKey = humanizeKey(tKey);
            const displayVal = String(tValue);

            if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              if (!displayKey.toLowerCase().includes(phrase) && !displayVal.toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
            }

            return (
              <div key={tIdx} className="nested-mini-card">
                <div className="nested-subtitle sub-label">{highlightText(displayKey)}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const currentObj = { ...(typeof getFieldValue(record, fn, idx) === 'object' ? getFieldValue(record, fn, idx) : {}) }; currentObj[tKey] = editValue; setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); /* Stage DRAFT only — DB write on Pending Approve (payload = dotted field + leaf value). */ stageDraft(record, `${fn}-${idx}`, currentObj, `${fn}.${tKey}`, editValue, { [editKey]: 'edited' }, null); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${displayKey}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    }

    /* Scalar thresholds fallback */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const strVal = fmtVal(val);

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
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

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, text -> textarea, "4/5" stays text) ═══════ */
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
                  <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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
                              const id2 = safeId(record); if (!id2) return;
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                              const trimmed = editValue.trim();
                              const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
                              setSaveError(null);
                              setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                              /* Stage DRAFT only — DB write on Pending Approve (payload = field + full array). */
                              stageDraft(record, `${fn}-${idx}`, newArr, fn, newArr, null, { [itemKey]: 'edited' });
                            }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STRING FIELD — triple-nested clause rows (semicolon / labeled comma) ═══════
     Field = rec-mini-card (label = nested-subtitle). Each labeled value / unlabeled run becomes a
     nested-mini-card; its clauses (split by ';' or labeled ',') are the editable rows. Consecutive
     unlabeled sentences merge into one card. */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const units = buildUnits(fmtVal(val));
    const phrase = searchTerm.trim().toLowerCase();
    const fieldOrTitleMatch = !phrase || sectionTitleMatches(sid) || record._showAllSections || label.toLowerCase().includes(phrase);

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {units.map((unit, uIdx) => {
          const unitMatch = fieldOrTitleMatch || (unit.label && unit.label.toLowerCase().includes(phrase));
          const visibleRows = unit.rows.filter(r => !phrase || unitMatch || r.text.toLowerCase().includes(phrase));
          if (visibleRows.length === 0) return null;
          return (
            <div key={uIdx} className="nested-mini-card">
              {unit.label && <div className="nested-subtitle sub-label">{highlightText(unit.label)}</div>}
              {visibleRows.map(row => {
                const editKey = `${fn}-${idx}-s${row.sIdx}-c${row.cIdx}`;
                const isEditing = editingField === editKey;
                const badge = editedSentences[editKey];
                return (
                  <div key={editKey}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(row.text); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveClause(record, fn, idx, sid, row.sIdx, row.cIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(row.text)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(row.text, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (f === 'thresholds') return renderThresholdsField(record, f, idx, sid);
            return renderSentenceEditableField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="amniotic-fluid-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Amniotic Fluid Assessment</h2></div>
        <div className="empty-state">No amniotic fluid assessment records available</div>
      </div>
    );
  }

  return (
    <div className="amniotic-fluid-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Amniotic Fluid Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<AmnioticFluidAssessmentDocumentPDFTemplate document={pdfData} />} fileName={`amniotic-fluid-assessment-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search amniotic fluid assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(`Amniotic Fluid Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'header-info')}
            {renderSection(record, idx, 'monitoring-config')}
            {renderSection(record, idx, 'clinical-findings')}
            {renderSection(record, idx, 'plan-notes')}
            {renderSection(record, idx, 'thresholds-data')}
            {renderSection(record, idx, 'results-data')}
            {renderSection(record, idx, 'recommendations-data')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AmnioticFluidAssessmentDocument;
