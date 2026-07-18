/**
 * ReproductiveHistoryDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: reproductive_history
 *
 * 9 Sections:
 *   1. history-info: date, type, provider, facility
 *   2. infertility: infertilityDiagnosis, infertilityDuration
 *   3. art-cycles: artCycles (array of objects)
 *   4. pgt-testing: pgtTesting.performed, pgtTesting.result, pgtTesting.embryoAge
 *   5. menstrual-history: menstrualHistory.lmp, menstrualHistory.menarche, menstrualHistory.cycleRegularity, menstrualHistory.duration, menstrualHistory.flow, menstrualHistory.dysmenorrhea, menstrualHistory.intermenstrualBleeding, menstrualHistory.postcoitalBleeding
 *   6. contraceptive-history: contraceptiveHistory (array)
 *   7. clinical-findings: findings, assessment, notes
 *   8. plan-recommendations: plan, recommendations (array)
 *   9. status-info: status
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import ReproductiveHistoryDocumentPDFTemplate from '../pdf-templates/ReproductiveHistoryDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ReproductiveHistoryDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits field path, e.g. "pgtTesting.result") */
const DRAFT_KEY = 'reproductiveHistoryPendingEdits';
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
  'history-info': 'History Information',
  'infertility': 'Infertility',
  'art-cycles': 'ART Cycles',
  'pgt-testing': 'PGT Testing',
  'menstrual-history': 'Menstrual History',
  'contraceptive-history': 'Contraceptive History',
  'clinical-findings': 'Clinical Findings',
  'plan-recommendations': 'Plan & Recommendations',
  'status-info': 'Status',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  infertilityDiagnosis: 'Infertility Diagnosis',
  infertilityDuration: 'Infertility Duration',
  artCycles: 'ART Cycles',
  'pgtTesting.performed': 'PGT Performed',
  'pgtTesting.result': 'PGT Result',
  'pgtTesting.embryoAge': 'Embryo Age',
  'menstrualHistory.lmp': 'LMP',
  'menstrualHistory.menarche': 'Menarche',
  'menstrualHistory.cycleRegularity': 'Cycle Regularity',
  'menstrualHistory.duration': 'Duration',
  'menstrualHistory.flow': 'Flow',
  'menstrualHistory.dysmenorrhea': 'Dysmenorrhea',
  'menstrualHistory.intermenstrualBleeding': 'Intermenstrual Bleeding',
  'menstrualHistory.postcoitalBleeding': 'Postcoital Bleeding',
  pgtTesting: 'PGT Testing',
  menstrualHistory: 'Menstrual History',
  contraceptiveHistory: 'Contraceptive History',
  findings: 'Findings',
  assessment: 'Assessment',
  results: 'Results',
  additionalData: 'Additional Data',
  notes: 'Notes',
  plan: 'Plan',
  recommendations: 'Recommendations',
  status: 'Status',
};

const SECTION_FIELDS = {
  'history-info': ['date', 'type', 'provider', 'facility'],
  'infertility': ['infertilityDiagnosis', 'infertilityDuration'],
  'art-cycles': ['artCycles'],
  'pgt-testing': ['pgtTesting'],
  'menstrual-history': ['menstrualHistory'],
  'contraceptive-history': ['contraceptiveHistory'],
  'clinical-findings': ['findings', 'assessment', 'results', 'additionalData', 'notes'],
  'plan-recommendations': ['plan', 'recommendations'],
  'status-info': ['status'],
};

const OBJECT_FIELDS = ['pgtTesting', 'menstrualHistory', 'results', 'additionalData'];

/* humanizeKey: camelCase / snake_case → "Title Case" */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

const BOOLEAN_FIELDS = [];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['contraceptiveHistory'];
const RECOMMENDATION_FIELDS = ['recommendations'];
const OBJECT_ARRAY_FIELDS = ['artCycles'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'infertilityDiagnosis', 'infertilityDuration', 'findings', 'assessment', 'notes', 'plan', 'status'];
const COMMA_OBJECT_PATHS = ['pgtTesting.result'];
const COMMA_STRING_FIELDS = ['notes'];
const WHOLE_STRING_FIELDS = ['provider', 'facility'];
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();
const stepFor = (value) => { const match = String(value).trim().match(/\.(\d+)/); return match ? Math.pow(10, -match[1].length) : 1; };
const splitNumberUnit = (value) => {
  const match = String(value ?? '').trim().match(/^(-?[\d,]+(?:\.\d+)?)(\s*)([^\d].*)?$/);
  if (!match) return null;
  return { num: match[1].replace(/,/g, ''), sep: match[2] || '', unit: match[3] || '' };
};
const isDatePath = (path) => /(^|\.)(date|lmp|lastMenstrualPeriod|dateOfConception|estimatedDueDate|datePerformed|customDate)$/i.test(path);

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,120}?):\s+([\s\S]+)/);
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const ReproductiveHistoryDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
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
      if (r?.reproductive_history) return Array.isArray(r.reproductive_history) ? r.reproductive_history : [r.reproductive_history];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.reproductive_history) return Array.isArray(dd.reproductive_history) ? dd.reproductive_history : [dd.reproductive_history]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = idOf(record);
      const recDrafts = rid ? store[rid] : null;
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

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text
      .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;]\s+/)
      .map(s => s.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
      .filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  const setNestedValue = useCallback((source, path, value) => {
    const root = Array.isArray(source) ? [...source] : { ...(source || {}) };
    let node = root;
    path.forEach((part, pathIndex) => {
      if (pathIndex === path.length - 1) { node[part] = value; return; }
      const next = node[part];
      node[part] = Array.isArray(next) ? [...next] : { ...(next || {}) };
      node = node[part];
    });
    return root;
  }, []);

  /* Get nested field value supporting dot-path */
  const getNestedValue = useCallback((obj, path) => {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let val = obj;
    for (const p of parts) {
      if (val === null || val === undefined) return undefined;
      val = val[p];
    }
    return val;
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
        if (OBJECT_FIELDS.includes(f)) { if (flattenSearchable(val).toLowerCase().includes(phrase)) return true; }
        else if (Array.isArray(val)) { if (val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (JSON.stringify(val).toLowerCase().includes(phrase)) return true; }
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
      if (OBJECT_FIELDS.includes(fn)) return flattenSearchable(val).toLowerCase().includes(phrase);
      if (Array.isArray(val)) return val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase));
      if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Reproductive History ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (OBJECT_FIELDS.includes(f) ? flattenSearchable(val).toLowerCase().includes(phrase) : Array.isArray(val) ? val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase)) : typeof val === 'object' ? JSON.stringify(val).toLowerCase().includes(phrase) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
          const fieldPath = m[1];
          if (fieldPath.includes('.')) {
            const [rootField, ...path] = fieldPath.split('.');
            merged[rootField] = setNestedValue(merged[rootField], path, localEdits[key]);
          } else merged[fieldPath] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits, setNestedValue]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // stageDraft = persist a single field's staged value to the localStorage draft store (survives refresh).
  // store shape: { [recordId]: { [fieldPath]: value } }. fieldPath is the localEdits field key (e.g. "pgtTesting.result").
  const stageDraft = useCallback((record, fieldPath, value) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPath] = value;
    writeDrafts(store);
  }, [safeId]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(record, fn, saveVal);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then flag approved + clear pending so the
  // committed values now flow into pdfData/PDF/Copy All. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Collect this record's pending field edits that belong to this section.
      // localEdits keys are `${fieldPath}-${idx}` where fieldPath may itself be dotted (e.g. "pgtTesting.result").
      // Per the dotted-field rule, a trailing ".<n>" (purely numeric) means arrayIndex; here field paths never
      // end in a numeric segment (arrays store the FULL array under `${field}-${idx}`), so we PUT the whole value.
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPath = k.slice(0, -suffix.length);
        return fields.includes(fieldPath) || fields.includes(fieldPath.split('.')[0]);
      });
      for (const editKey of toCommit) {
        const fieldPath = editKey.slice(0, -suffix.length);
        const payload = { field: fieldPath, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/reproductive_history/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/reproductive_history/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        Object.keys(store[id]).forEach(path => { if (fields.includes(path) || fields.includes(path.split('.')[0])) delete store[id][path]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[ReproductiveHistory] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
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
  const formatSentenceFieldLines = useCallback((text, fieldName) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      const source = parsed.isLabeled ? parsed.value : s;
      const commaItems = splitByComma(source);
      const parts = (parsed.isLabeled || COMMA_STRING_FIELDS.includes(fieldName)) && commaItems.length >= 2 ? commaItems : [source];
      if (parsed.isLabeled) { lines.push(parsed.label); lines.push('-'.repeat(40)); n = 1; }
      parts.forEach(item => { lines.push(`${n++}. ${item}`); });
    });
    return lines;
  }, [splitBySentence]);

  const objectCopyLines = useCallback(function buildObjectCopyLines(label, value, indent, fieldPath = '') {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (label) { out.push(`${pad}${label}`); out.push(`${pad}${'-'.repeat(40)}`); }
    if (isScalar(value)) {
      if (typeof value === 'string' && isDatePath(fieldPath) && !isNaN(new Date(value).getTime())) {
        out.push(`${pad}1. ${formatDate(value)}`);
        return out;
      }
      const rows = [];
      (typeof value === 'string' ? splitBySentence(value) : [fmtScalar(value)]).forEach(sentence => {
        const parsed = parseLabel(sentence);
        const source = parsed.isLabeled ? parsed.value : sentence;
        const commaItems = splitByComma(source);
        const parts = (parsed.isLabeled || COMMA_OBJECT_PATHS.includes(fieldPath)) && commaItems.length >= 2 ? commaItems : [source];
        if (parsed.isLabeled) { out.push(`${pad}${parsed.label}`); out.push(`${pad}${'-'.repeat(40)}`); }
        rows.push(...parts);
      });
      rows.forEach((row, rowIndex) => out.push(`${pad}${rowIndex + 1}. ${row}`));
      return out;
    }
    if (Array.isArray(value)) {
      value.filter(item => !isEmptyDeep(item)).forEach((item, itemIndex) => {
        if (isScalar(item)) out.push(`${pad}${itemIndex + 1}. ${fmtScalar(item)}`);
        else out.push(...buildObjectCopyLines(`Item ${itemIndex + 1}`, item, indent + 1, `${fieldPath}.${itemIndex}`));
      });
      return out;
    }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...buildObjectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0), fieldPath ? `${fieldPath}.${k}` : k)));
    return out;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const showLabel = !sameAsTitle(label, sid);
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (OBJECT_FIELDS.includes(f)) {
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0, `${f}.${k}`).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${'-'.repeat(40)}\n1. ${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        text += `1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        items.forEach((item, i) => {
          text += `ART Cycle ${i + 1}\n${'-'.repeat(40)}\n`;
          Object.entries(item || {}).filter(([, itemValue]) => !isEmptyDeep(itemValue)).forEach(([key, itemValue]) => {
            objectCopyLines(humanizeKey(key), itemValue, 0).forEach(line => { text += `${line}\n`; });
          });
        });
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        text += `${items.map((item, i) => `${i + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}`).join('\n')}\n\n`;
      } else if (RECOMMENDATION_FIELDS.includes(f)) {
        const groups = [];
        (Array.isArray(val) ? val : []).forEach(item => {
          const rec = typeof item === 'string' ? { recommendation: item, date: '' } : item;
          const dateKey = toInputDate(rec?.date) || String(rec?.date || '') || 'no-date';
          const group = groups.find(entry => entry.dateKey === dateKey);
          if (group) group.rows.push(rec?.recommendation || '');
          else groups.push({ dateKey, date: rec?.date, rows: [rec?.recommendation || ''] });
        });
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        groups.forEach(group => {
          if (group.date) text += `${formatDate(group.date)}\n${'-'.repeat(40)}\n`;
          const rows = group.rows.flatMap(row => { const parts = splitByComma(row); return parts.length >= 2 ? parts : [row]; }).filter(Boolean);
          rows.forEach((row, rowIndex) => { text += `${rowIndex + 1}. ${row}\n`; });
        });
        text += '\n';
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        formatSentenceFieldLines(strVal, f).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        text += `1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== REPRODUCTIVE HISTORY ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Reproductive History ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
        <div className="nested-mini-card" data-edit-field={fn}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value || ''); setSaveError(null); }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } const iso = String(editValue).includes('T') ? editValue : `${editValue}T00:00:00.000Z`; handleSaveField(record, fn, idx, sid, null, iso); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card" data-edit-field={fn}>
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

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card">
        {items.map((item, itemIdx) => {
          const fieldPath = `${fn}.${itemIdx}`;
          const editKey = `${fieldPath}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const currentItem = localEdits[editKey] === undefined ? item : localEdits[editKey];
          const itemStr = typeof currentItem === 'object' ? (currentItem.text || currentItem.recommendation || JSON.stringify(currentItem)) : String(currentItem);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx} data-edit-field={fieldPath}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const nextValue = editValue.trim(); setLocalEdits(prev => ({ ...prev, [editKey]: nextValue })); setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); stageDraft(record, fieldPath, nextValue); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT ARRAY FIELD (artCycles) ═══════ */
  const renderObjectArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => (
          <div key={itemIdx} className="nested-mini-card">
            <div className="nested-subtitle sub-label">{highlightText(`ART Cycle ${itemIdx + 1}`)}</div>
            {renderObjectNode(record, fn, idx, sid, '', item, [itemIdx], 1)}
          </div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with semantic labeled/unlabeled grouping ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const segments = splitBySentence(strVal).map((sentence, sentenceIndex) => {
      const parsed = parseLabel(sentence);
      const source = parsed.isLabeled ? parsed.value : sentence;
      const commaParts = splitByComma(source);
      const shouldSplitComma = parsed.isLabeled || COMMA_STRING_FIELDS.includes(fn);
      return { sentenceIndex, label: parsed.isLabeled ? parsed.label : '', parts: shouldSplitComma && commaParts.length >= 2 ? commaParts : [source] };
    });
    const cards = [];
    segments.forEach(segment => {
      const rows = segment.parts.map((text, partIndex) => ({ ...segment, text, partIndex }));
      if (segment.label) cards.push({ label: segment.label, rows });
      else {
        const previous = cards[cards.length - 1];
        if (previous && !previous.label) previous.rows.push(...rows);
        else cards.push({ label: '', rows });
      }
    });
    const savePart = (row, rowKey, replacement) => {
      const currentSentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
      const currentSentence = currentSentences[row.sentenceIndex] || '';
      const parsed = parseLabel(currentSentence);
      const source = parsed.isLabeled ? parsed.value : currentSentence;
      const commaParts = splitByComma(source);
      const shouldSplitComma = parsed.isLabeled || COMMA_STRING_FIELDS.includes(fn);
      const parts = shouldSplitComma && commaParts.length >= 2 ? commaParts : [source];
      parts[row.partIndex] = replacement.trim().replace(/[;.]+$/, '');
      currentSentences[row.sentenceIndex] = parsed.isLabeled ? `${parsed.label}: ${parts.join(', ')}` : parts.join(', ');
      const rebuilt = reconstructFullText(currentSentences);
      const editKey = `${fn}-${idx}`;
      setLocalEdits(prev => ({ ...prev, [editKey]: rebuilt }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedSentences(prev => ({ ...prev, [rowKey]: 'edited' }));
      setApprovedSections(prev => { const next = { ...prev }; delete next[`${sid}-${idx}`]; return next; });
      stageDraft(record, fn, rebuilt);
      setEditingField(null); setEditValue(''); setSaveError(null);
    };
    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {cards.map((card, cardIndex) => (
          <div key={`${fn}-card-${cardIndex}`} className={`nested-mini-card ${card.label ? '' : 'regular-row-group'}`.trim()}>
            {card.label && <div className="nested-subtitle sub-label">{highlightText(card.label)}</div>}
            {card.rows.map(row => {
              const rowKey = `${fn}-${idx}-s${row.sentenceIndex}-c${row.partIndex}`;
              const isEditing = editingField === rowKey;
              const badge = editedSentences[rowKey];
              const measurement = splitNumberUnit(row.text);
              const editStart = measurement ? measurement.num : row.text;
              const step = stepFor(editStart);
              const stepValue = direction => {
                const current = Number.parseFloat(editValue);
                const decimals = (String(step).split('.')[1] || '').length;
                setEditValue(((Number.isFinite(current) ? current : 0) + direction * step).toFixed(decimals));
              };
              const statusOptions = ['Active', 'Complete', 'Final', 'Inactive'].filter((option, optionIndex, options) => options.findIndex(candidate => candidate.toLowerCase() === option.toLowerCase()) === optionIndex);
              if (!statusOptions.some(option => option.toLowerCase() === String(editStart).toLowerCase())) statusOptions.push(String(editStart));
              return (
                <div key={rowKey} data-edit-field={fn}>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(editStart); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        {fn === 'status' ? (
                          <BlueSelect value={editValue} options={statusOptions} onChange={setEditValue} />
                        ) : measurement ? (
                          <div className="num-stepper-row">
                            <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepValue(-1); }}>−</button>
                            <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={event => setEditValue(event.target.value)} />
                            {measurement.unit && <span className="number-edit-unit">{measurement.unit}</span>}
                            <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepValue(1); }}>+</button>
                          </div>
                        ) : (
                          <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />
                        )}
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => {
                            event.stopPropagation();
                            let replacement = editValue;
                            if (measurement) {
                              const number = Number.parseFloat(editValue);
                              if (!Number.isFinite(number)) { setSaveError('Please enter a valid number'); return; }
                              replacement = measurement.unit ? `${number}${measurement.sep || ' '}${measurement.unit}` : String(number);
                            }
                            savePart(row, rowKey, replacement);
                          }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(row.text)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(row.text, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT FIELD (results — dynamic-key, nested) ═══════ */
  /* save a nested OBJECT leaf by dot-path (e.g. results.NST or results.amniocentesis.AFP) — value stays a STRING */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const fieldPath = `${rootField}.${path.join('.')}`;
    const editKey = `${fieldPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(record, fieldPath, newVal);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId, stageDraft]);

  const renderObjectLeaf = (record, rootField, path, idx, sid, value, labelOverride) => {
    const fieldPath = `${rootField}.${path.join('.')}`;
    const leafEditKey = `${fieldPath}-${idx}`;
    const currentValue = localEdits[leafEditKey] === undefined ? value : localEdits[leafEditKey];
    const leafValueString = fmtScalar(currentValue);
    const leafLabel = labelOverride === undefined ? humanizeKey(path[path.length - 1]) : labelOverride;
    const isBool = typeof currentValue === 'boolean';
    const isDate = !isBool && typeof currentValue === 'string' && isDatePath(fieldPath) && !isNaN(new Date(currentValue).getTime());
    const measurement = (!isBool && !isDate) ? splitNumberUnit(leafValueString) : null;
    const sentenceValues = (isBool || isDate || measurement) ? [leafValueString] : splitBySentence(leafValueString);
    const cards = [];
    sentenceValues.forEach((sentence, sentenceIndex) => {
      const parsed = parseLabel(sentence);
      const source = parsed.isLabeled ? parsed.value : sentence;
      const commaItems = splitByComma(source);
      const shouldSplitComma = parsed.isLabeled || COMMA_OBJECT_PATHS.includes(fieldPath);
      const rows = (shouldSplitComma && commaItems.length >= 2 ? commaItems : [source]).map((text, partIndex) => ({ text, sentenceIndex, partIndex, label: parsed.isLabeled ? parsed.label : '' }));
      if (parsed.isLabeled) cards.push({ label: parsed.label, rows });
      else {
        const previous = cards[cards.length - 1];
        if (previous && !previous.label) previous.rows.push(...rows);
        else cards.push({ label: '', rows });
      }
    });
    const saveRow = (row, rowKey) => {
      let newValue;
      if (isBool) newValue = editValue === 'Yes';
      else if (isDate) newValue = String(editValue).includes('T') ? editValue : `${editValue}T00:00:00.000Z`;
      else if (measurement) {
        const number = Number.parseFloat(editValue);
        if (!Number.isFinite(number)) { setSaveError('Please enter a valid number'); return; }
        newValue = typeof currentValue === 'number' ? number : (measurement.unit ? `${number}${measurement.sep || ' '}${measurement.unit}` : String(number));
      } else {
        const sentences = splitBySentence(leafValueString);
        const currentSentence = sentences[row.sentenceIndex] || '';
        const parsed = parseLabel(currentSentence);
        const source = parsed.isLabeled ? parsed.value : currentSentence;
        const commaItems = splitByComma(source);
        const shouldSplitComma = parsed.isLabeled || COMMA_OBJECT_PATHS.includes(fieldPath);
        const parts = shouldSplitComma && commaItems.length >= 2 ? commaItems : [source];
        parts[row.partIndex] = editValue.trim().replace(/[;.]+$/, '');
        sentences[row.sentenceIndex] = parsed.isLabeled ? `${parsed.label}: ${parts.join(', ')}` : parts.join(', ');
        newValue = reconstructFullText(sentences);
      }
      saveLeaf(record, rootField, path, idx, sid, rowKey, newValue);
    };
    const leafContent = (
      <>
        {leafLabel && <div className="nested-subtitle sub-label">{highlightText(leafLabel)}</div>}
        {cards.map((card, cardIndex) => (
          <div key={`${fieldPath}-card-${cardIndex}`} className={card.label ? 'nested-mini-card' : (leafLabel === '' ? '' : 'nested-mini-card regular-row-group')}>
            {card.label && <div className="nested-subtitle sub-label">{highlightText(card.label)}</div>}
            {card.rows.map(row => {
              const rowKey = `${rootField}-${idx}-${path.join('.')}-s${row.sentenceIndex}-c${row.partIndex}`;
              const isEditing = editingField === rowKey;
              const isModified = editedFields[rowKey];
              const editStartValue = isBool ? (currentValue ? 'Yes' : 'No') : isDate ? toInputDate(currentValue) : measurement ? measurement.num : row.text;
              const step = stepFor(editStartValue);
              const stepValue = direction => {
                const current = Number.parseFloat(editValue);
                const decimals = (String(step).split('.')[1] || '').length;
                setEditValue(((Number.isFinite(current) ? current : 0) + direction * step).toFixed(decimals));
              };
              const displayValue = isDate ? formatDate(currentValue) : row.text;
              return (
                <div key={rowKey} data-edit-field={fieldPath}>
                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(editStartValue); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        {isBool ? (
                          <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
                        ) : isDate ? (
                          <BlueDatePicker value={editValue} onSelect={selected => setEditValue(selected || '')} />
                        ) : measurement ? (
                          <div className="num-stepper-row">
                            <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepValue(-1); }}>−</button>
                            <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={event => setEditValue(event.target.value)} />
                            {measurement.unit && <span className="number-edit-unit">{measurement.unit}</span>}
                            <button type="button" className="num-step" onClick={event => { event.stopPropagation(); stepValue(1); }}>+</button>
                          </div>
                        ) : (
                          <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />
                        )}
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); saveRow(row, rowKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(displayValue, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        ))}
      </>
    );
    return leafLabel === ''
      ? <React.Fragment key={path.join('-')}>{leafContent}</React.Fragment>
      : <div key={path.join('-')} className="nested-mini-card">{leafContent}</div>;
  };

  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    if (Array.isArray(value)) {
      const items = value.filter(item => !isEmptyDeep(item));
      if (items.length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          <div className="nested-mini-card regular-row-group">
            {items.map((item, itemIndex) => isScalar(item)
              ? renderObjectLeaf(record, rootField, [...path, itemIndex], idx, sid, item, '')
              : renderObjectNode(record, rootField, idx, sid, `Item ${itemIndex + 1}`, item, [...path, itemIndex], depth + 1))}
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
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS — group repeated dates and persist every represented path ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx);
    const recommendations = Array.isArray(value)
      ? value.map((item, itemIndex) => {
        const normalized = typeof item === 'string' ? { recommendation: item, date: '' } : { ...(item || {}) };
        for (const key of ['recommendation', 'date']) {
          const localKey = `${fn}.${itemIndex}.${key}-${idx}`;
          if (localEdits[localKey] !== undefined) normalized[key] = localEdits[localKey];
        }
        return normalized;
      })
      : [];
    if (!recommendations.some(item => !isEmptyDeep(item))) return null;
    const label = FIELD_LABELS[fn] || fn;
    const groups = [];
    recommendations.forEach((item, itemIndex) => {
      const dateKey = toInputDate(item?.date) || String(item?.date || '').trim() || 'no-date';
      const existing = groups.find(group => group.dateKey === dateKey);
      if (existing) existing.items.push({ item, itemIndex });
      else groups.push({ dateKey, dateValue: item?.date || '', items: [{ item, itemIndex }] });
    });
    const saveRecommendationPaths = (entries) => {
      const editEntries = Object.fromEntries(entries.map(({ path, value: nextValue }) => [`${path}-${idx}`, nextValue]));
      setLocalEdits(prev => ({ ...prev, ...editEntries }));
      setPendingEdits(prev => ({ ...prev, ...Object.fromEntries(Object.keys(editEntries).map(key => [key, true])) }));
      setEditedFields(prev => ({ ...prev, ...Object.fromEntries(Object.keys(editEntries).map(key => [key, 'edited'])) }));
      setApprovedSections(prev => { const next = { ...prev }; delete next[`${sid}-${idx}`]; return next; });
      entries.forEach(({ path, value: nextValue }) => stageDraft(record, path, nextValue));
      setEditingField(null); setEditValue(''); setSaveError(null);
    };
    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, groupIndex) => {
          const datePaths = group.items.map(({ itemIndex }) => `${fn}.${itemIndex}.date`);
          const dateEditKey = `${fn}-date-${group.dateKey}-${idx}`;
          const dateEditing = editingField === dateEditKey;
          const dateModified = datePaths.some(path => editedFields[`${path}-${idx}`]);
          return (
            <div key={group.dateKey || groupIndex} className="nested-mini-card recommendation-group">
              {group.dateValue && (
                <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
                  <div className={`nested-subtitle date-subtitle editable-row ${dateModified ? 'modified' : ''}`} onClick={() => { if (!dateEditing) { setEditingField(dateEditKey); setEditValue(toInputDate(group.dateValue)); setSaveError(null); } }}>
                    {dateEditing ? (
                      <div className="edit-field-container">
                        <BlueDatePicker value={editValue} onSelect={selected => setEditValue(selected || '')} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => {
                            event.stopPropagation();
                            if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; }
                            const iso = String(editValue).includes('T') ? editValue : `${editValue}T00:00:00.000Z`;
                            saveRecommendationPaths(datePaths.map(path => ({ path, value: iso })));
                          }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <><span className="content-value">{highlightText(formatDate(group.dateValue))}</span><span className="edit-indicator">&#9998;</span></>
                    )}
                  </div>
                  {dateModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              )}
              {group.items.flatMap(({ item, itemIndex }) => {
                const fieldPath = `${fn}.${itemIndex}.recommendation`;
                const recommendation = String(item?.recommendation || '').trim();
                const commaParts = splitByComma(recommendation);
                const rows = commaParts.length >= 2 ? commaParts : [recommendation];
                return rows.filter(Boolean).map((text, partIndex) => {
                  const rowKey = `${fieldPath}-${idx}-p${partIndex}`;
                  const isEditing = editingField === rowKey;
                  const badge = editedFields[`${fieldPath}-${idx}`];
                  return (
                    <div key={rowKey} data-edit-field={fieldPath}>
                      <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(text); setSaveError(null); } }}>
                        {isEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={event => {
                                event.stopPropagation();
                                const parts = splitByComma(String(recommendations[itemIndex].recommendation || ''));
                                const nextValue = parts.length >= 2
                                  ? (parts.map((part, index) => index === partIndex ? editValue.trim() : part).join(', '))
                                  : editValue.trim();
                                saveRecommendationPaths([{ path: fieldPath, value: nextValue }]);
                              }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(text)}</span><span className="edit-indicator">&#9998;</span></div>
                            <button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(text, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                });
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderObjectArrayField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (RECOMMENDATION_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="reproductive-history-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Reproductive History</h2></div>
        <div className="empty-state">No reproductive history records available</div>
      </div>
    );
  }

  return (
    <div className="reproductive-history-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Reproductive History</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ReproductiveHistoryDocumentPDFTemplate document={pdfData} />} fileName="Reproductive_History.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search reproductive history..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(record.provider || `Reproductive History ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'history-info')}
            {renderSection(record, idx, 'infertility')}
            {renderSection(record, idx, 'art-cycles')}
            {renderSection(record, idx, 'pgt-testing')}
            {renderSection(record, idx, 'menstrual-history')}
            {renderSection(record, idx, 'contraceptive-history')}
            {renderSection(record, idx, 'clinical-findings')}
            {renderSection(record, idx, 'plan-recommendations')}
            {renderSection(record, idx, 'status-info')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReproductiveHistoryDocument;
