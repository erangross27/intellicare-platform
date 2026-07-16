/**
 * TumorMarkersDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: tumor_markers
 *
 * 6 Sections:
 *   1. header-info: date, type, provider, facility, status
 *   2. standard-markers: cea, ca199, ca125, afp, psa, ldh, alkalinePhosphatase
 *   3. other-markers: otherMarkers (array of objects {name, value})
 *   4. clinical-assessment: findings, assessment
 *   5. treatment-plan: plan, notes
 *   6. results-data: results (object)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TumorMarkersDocumentPDFTemplate from '../pdf-templates/TumorMarkersDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueMonthPicker from '../components/BlueMonthPicker';
import BlueSelect from '../components/BlueSelect';
import './TumorMarkersDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits "field" key, e.g. "findings") */
const DRAFT_KEY = 'tumor_markersPendingEdits';
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
  'header-info': 'Header Information',
  'standard-markers': 'Standard Markers',
  'other-markers': 'Other Markers',
  'clinical-assessment': 'Clinical Assessment',
  'treatment-plan': 'Treatment Plan',
  'results-data': 'Results',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  cea: 'CEA',
  ca199: 'CA 19-9',
  ca125: 'CA 125',
  afp: 'AFP',
  psa: 'PSA',
  ldh: 'LDH',
  alkalinePhosphatase: 'Alkaline Phosphatase',
  otherMarkers: 'Other Markers',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
  results: 'Results',
};

const SECTION_FIELDS = {
  'header-info': ['date', 'type', 'provider', 'facility', 'status'],
  'standard-markers': ['cea', 'ca199', 'ca125', 'afp', 'psa', 'ldh', 'alkalinePhosphatase'],
  'other-markers': ['otherMarkers'],
  'clinical-assessment': ['findings', 'assessment'],
  'treatment-plan': ['plan', 'recommendations', 'notes'],
  'results-data': ['results'],
};

const BOOLEAN_FIELDS = ['aiProcessed'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['otherMarkers'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['results'];
const NUMBER_FIELDS = [];
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'cea', 'ca199', 'ca125', 'afp', 'psa', 'ldh', 'alkalinePhosphatase', 'findings', 'assessment', 'plan', 'notes'];
const MEASUREMENT_FIELDS = new Set(['cea', 'ca199', 'ca125', 'afp', 'psa', 'ldh', 'alkalinePhosphatase']);
const ENUM_FIELDS = { status: ['Active', 'Complete', 'Normal', 'Baseline', 'Not Active'] };
const COMMA_SPLIT_FIELDS = new Set(['findings']);

const enumOptionsWith = (field, current) => {
  const options = ENUM_FIELDS[field] || [];
  return options.some(o => o.toLowerCase() === String(current || '').toLowerCase()) || !current ? options : [...options, current];
};
const enumCanonical = (field, current) => (ENUM_FIELDS[field] || []).find(option => option.toLowerCase() === String(current || '').toLowerCase()) || current;
const splitMeasurement = (value) => {
  const match = String(value || '').match(/^\s*(-?\d+(?:\.\d+)?)([\s\S]*)$/);
  return match ? { num: Number(match[1]), numericText: match[1], suffix: match[2] } : null;
};
const stepFor = (value) => { const text = String(value ?? ''); const decimals = text.includes('.') ? text.split('.')[1].length : 0; return decimals ? 10 ** -decimals : 1; };
const setAtPath = (source, path, value) => {
  const parts = String(path).split('.');
  const root = Array.isArray(source) ? [...source] : { ...(source || {}) };
  let cursor = root;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) { cursor[part] = value; return; }
    const next = cursor[part];
    cursor[part] = Array.isArray(next) ? [...next] : { ...(next || {}) };
    cursor = cursor[part];
  });
  return root;
};
const getAtPath = (source, path) => String(path).split('.').reduce((value, part) => value?.[part], source);
const humanizeKey = key => String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const formatMonth = value => {
  const text = String(value || '');
  const iso = text.match(/^(\d{4})-(\d{2})$/);
  if (iso) return `${MONTHS[Number(iso[2]) - 1] || iso[2]} ${iso[1]}`;
  return text;
};
const toStoredMonth = value => {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  const match = text.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return text;
  const month = MONTHS.findIndex(item => item.toLowerCase() === match[1].toLowerCase());
  return month >= 0 ? `${match[2]}-${String(month + 1).padStart(2, '0')}` : text;
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
const TumorMarkersDocument = ({ document: docProp, data, templateData }) => {
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
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (Array.isArray(r.wrapRecordsIntoSingleDocument)) return r.wrapRecordsIntoSingleDocument;
      if (Array.isArray(r.records || r._records)) return r.records || r._records;
      if (r?.tumor_markers) return Array.isArray(r.tumor_markers) ? r.tumor_markers : [r.tumor_markers];
      if (r?.data?.tumor_markers) return Array.isArray(r.data.tumor_markers) ? r.data.tumor_markers : [r.data.tumor_markers];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.tumor_markers) return Array.isArray(dd.tumor_markers) ? dd.tumor_markers : [dd.tumor_markers]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

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

  const splitBySentence = useCallback((text, field = '') => {
    if (!text || typeof text !== 'string') return [];
    const clauses = text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\d)\.(?:\s+)|;\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
    return COMMA_SPLIT_FIELDS.has(field) ? clauses.flatMap(splitByComma) : clauses;
  }, []);

  function reconstructFullText(sentences, field = '', originalText = '') {
    if (!sentences || sentences.length === 0) return '';
    const clean = sentences.map(s => s.replace(/[;.,]+$/, '').trim()).filter(Boolean);
    const delimiter = COMMA_SPLIT_FIELDS.has(field) ? ', ' : String(originalText).includes(';') ? '; ' : '. ';
    return clean.join(delimiter);
  }

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    let value = getAtPath(record, fn);
    Object.entries(localEdits).forEach(([key, edit]) => {
      const match = key.match(new RegExp(`^${fn}\\.(.+)-${idx}$`));
      if (match) value = setAtPath(value, match[1], edit);
    });
    return value;
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
        if (Array.isArray(val)) { if (val.some(item => { const s = typeof item === 'object' ? `${item.name || ''} ${item.value || ''}` : String(item); return s.toLowerCase().includes(phrase); })) return true; }
        else if (typeof val === 'object') { if (Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase))) return true; }
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
      if (Array.isArray(val)) return val.some(item => { const s = typeof item === 'object' ? `${item.name || ''} ${item.value || ''}` : String(item); return s.toLowerCase().includes(phrase); });
      if (typeof val === 'object') return Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Tumor Markers ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => { const s = typeof item === 'object' ? `${item.name || ''} ${item.value || ''}` : String(item); return s.toLowerCase().includes(phrase); }) : (typeof val === 'object' ? Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase)))) return true;
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPart = m[1];
          const [rootField, ...rest] = fieldPart.split('.');
          if (rest.length) merged[rootField] = setAtPath(merged[rootField], rest.join('.'), localEdits[key]);
          else merged[rootField] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Stage a DRAFT for field `fn` of `record` into the pending-drafts localStorage store (survives refresh).
  // Also drops the section's 'approved' flag so re-edit returns to yellow Pending Approve.
  const stageDraft = useCallback((record, fn, idx, value, sid) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }, [safeId]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, fn, idx, saveVal, sid);
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal, fn);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated, fn, currentVal);
      // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
      stageDraft(record, fn, idx, fullText, sid);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal, fn);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated, fn, currentVal);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, fn, idx, fullText, sid);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // localEdits keys are always "<field>-<idx>" (whole-field values); commit only this section's pending fields.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        // field, or array/object element trailing dot-segment that is NON-numeric (e.g. "results.glucose")
        return fields.includes(fieldPart.split('.')[0]);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/tumor_markers/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/tumor_markers/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[TumorMarkers] Approve error:', err); }
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
  const formatSentenceFieldLines = useCallback((text, field) => {
    const sentences = splitBySentence(text, field);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) {
          lines.push(parsed.label); lines.push('-'.repeat(40));
          parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        } else { lines.push(parsed.label); lines.push('-'.repeat(40)); lines.push(`${n++}. ${parsed.value}`); }
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
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n1. ${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}\n1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (ENUM_FIELDS[f]) {
        text += `${label}\n1. ${enumCanonical(f, val)}\n\n`;
      } else if (f === 'otherMarkers') {
        const items = Array.isArray(val) ? val : [val];
        const validItems = items.filter(m => { if (typeof m === 'object') return (m.name && m.name.trim()) || (m.value && m.value.trim()); return m && String(m).trim(); });
        if (validItems.length > 0) {
          text += `${label}\n`;
          validItems.forEach((item, i) => {
            if (typeof item === 'object') {
              text += `Marker ${i + 1}\n${'-'.repeat(40)}\n`;
              Object.entries(item).forEach(([key, value]) => { if (hasVal(value)) text += `${key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')}\n1. ${fmtVal(value)}\n`; });
            } else text += `${i + 1}. ${item}\n`;
          });
          text += '\n';
        }
      } else if (f === 'recommendations') {
        const items = Array.isArray(val) ? val.filter(r => { if (typeof r === 'object' && r !== null) return (r.recommendation && String(r.recommendation).trim()) || (r.date && String(r.date).trim()); return r && String(r).trim(); }) : [];
        if (items.length > 0) {
          text += `${label}\n`;
          const groups = [];
          items.forEach((item, i) => { const date = (typeof item === 'object' && item !== null ? item.date || '' : '').toString(); const group = groups.find(entry => entry.date === date); if (group) group.items.push({ item, i }); else groups.push({ date, items: [{ item, i }] }); });
          groups.forEach(group => { if (group.date) { const dateDisplay = /^\d{4}-\d{2}$/.test(group.date) ? formatMonth(group.date) : formatDate(group.date); text += `${dateDisplay}\n${'-'.repeat(40)}\n`; } group.items.forEach(({ item }, i) => { const recText = (typeof item === 'object' && item !== null ? item.recommendation || '' : String(item)).trim(); text += `${i + 1}. ${recText}\n`; }); });
          text += '\n';
        }
      } else if (f === 'results') {
        if (typeof val === 'object') {
          text += `${label}\n`;
          Object.entries(val).forEach(([k, v]) => { const display = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? formatDate(v) : typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? formatMonth(v) : fmtVal(v); text += `${humanizeKey(k)}\n1. ${display}\n`; });
          text += '\n';
        } else {
          text += `${label}\n${fmtVal(val)}\n\n`;
        }
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal, f);
        if (sentences.length > 1) {
          text += `${label}\n`;
          formatSentenceFieldLines(strVal, f).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `${label}\n1. ${ENUM_FIELDS[f] ? enumCanonical(f, strVal) : strVal}\n\n`;
        }
      } else {
        text += `${label}\n1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `Tumor Markers\n${'='.repeat(40)}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Tumor Markers ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={setEditValue} />
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
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
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
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const current = Number(editValue); const base = Number.isFinite(current) ? current : Number(val) || 0; setEditValue(String(base - stepFor(base))); }}>−</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const current = Number(editValue); const base = Number.isFinite(current) ? current : Number(val) || 0; setEditValue(String(base + stepFor(base))); }}>+</button>
              </div>
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

  const renderEnumField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const displayVal = enumCanonical(fn, String(raw)); const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? <div className="edit-field-container">
            <BlueSelect value={editValue} options={enumOptionsWith(fn, String(raw))} onChange={setEditValue} />
            <div className="edit-actions"><button className="save-btn" onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>Save</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div>
          </div> : <><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderMeasurementField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const parsed = splitMeasurement(raw);
    if (!parsed) return renderStringField(record, fn, idx, sid);
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(parsed.numericText); setSaveError(null); } }}>
          {isEditing ? <div className="edit-field-container">
            <div className="num-stepper-row"><button type="button" className="num-step" onClick={e => { e.stopPropagation(); const base = Number(editValue); setEditValue(String((Number.isFinite(base) ? base : parsed.num) - stepFor(Number.isFinite(base) ? base : parsed.num))); }}>−</button><input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus/><button type="button" className="num-step" onClick={e => { e.stopPropagation(); const base = Number(editValue); setEditValue(String((Number.isFinite(base) ? base : parsed.num) + stepFor(Number.isFinite(base) ? base : parsed.num))); }}>+</button><span className="number-edit-unit">{parsed.suffix}</span></div>
            <div className="edit-actions"><button className="save-btn" onClick={e => { e.stopPropagation(); const number = Number(editValue); if (!Number.isFinite(number)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, `${editValue}${parsed.suffix}`); }}>Save</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div>
          </div> : <><div className="row-content"><span className="content-value">{highlightText(String(raw))}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${raw}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderNestedLeaf = (record, fieldPath, label, fallbackValue, idx, sid) => {
    const stagedValue = getFieldValue(record, fieldPath, idx);
    const value = stagedValue !== undefined ? stagedValue : fallbackValue;
    if (!hasVal(value)) return null;
    const editKey = `${fieldPath}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const isMonth = typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
    const isDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
    const isBoolean = typeof value === 'boolean';
    const isNumber = typeof value === 'number';
    const measurement = !isDate && !isMonth && typeof value === 'string' ? splitMeasurement(value) : null;
    const displayValue = isBoolean ? (value ? 'Yes' : 'No') : isDate ? formatDate(value) : isMonth ? formatMonth(value) : String(value);
    const beginEdit = () => {
      setEditingField(editKey);
      setEditValue(isBoolean ? (value ? 'Yes' : 'No') : isDate ? toInputDate(value) : isNumber ? String(value) : measurement ? measurement.numericText : String(value));
      setSaveError(null);
    };
    const saveLeaf = event => {
      event.stopPropagation();
      let nextValue = editValue;
      if (isBoolean) nextValue = editValue === 'Yes';
      else if (isDate) nextValue = editValue ? `${editValue}T00:00:00.000Z` : '';
      else if (isMonth) nextValue = toStoredMonth(editValue);
      else if (isNumber) {
        nextValue = Number(editValue);
        if (!Number.isFinite(nextValue)) { setSaveError('Please enter a valid number'); return; }
      } else if (measurement) {
        if (!Number.isFinite(Number(editValue))) { setSaveError('Please enter a valid number'); return; }
        nextValue = `${editValue}${measurement.suffix}`;
      }
      handleSaveField(record, fieldPath, idx, sid, null, nextValue, editKey);
    };
    const numericBase = Number(editValue);
    const fallbackNumber = isNumber ? value : measurement?.num;
    const stepValue = Number.isFinite(numericBase) ? numericBase : fallbackNumber;
    return (
      <div key={fieldPath} className="nested-leaf" data-edit-field={fieldPath}>
        <div className="nested-subtitle field-label">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) beginEdit(); }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isDate ? <BlueDatePicker value={editValue} onSelect={setEditValue} />
                : isMonth ? <BlueMonthPicker value={editValue} onSelect={setEditValue} />
                  : isBoolean ? <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
                    : (isNumber || measurement) ? <div className="num-stepper-row"><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String(stepValue - stepFor(stepValue))); }}>−</button><input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus/><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String(stepValue + stepFor(stepValue))); }}>+</button>{measurement?.suffix && <span className="number-edit-unit">{measurement.suffix}</span>}</div>
                      : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={saveLeaf}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
            </div>
          ) : <><div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${label}\n${displayValue}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OTHER MARKERS (array of dynamic objects) ═══════ */
  const renderOtherMarkersField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.map((item, itemIdx) => ({ item, itemIdx })).filter(({ item }) => typeof item === 'object' && item !== null ? Object.values(item).some(hasVal) : hasVal(item)) : [];
    if (items.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="other-marker-groups">
        {items.map(({ item, itemIdx }) => (
          <div key={itemIdx} className="rec-mini-card nested-mini-card">
            <div className="nested-subtitle">Marker {itemIdx + 1}</div>
            {typeof item === 'object' && item !== null
              ? Object.entries(item).filter(([, leaf]) => hasVal(leaf)).map(([key, leaf]) => renderNestedLeaf(record, `${fn}.${itemIdx}.${key}`, humanizeKey(key), leaf, idx, sid))
              : renderNestedLeaf(record, `${fn}.${itemIdx}`, `Marker ${itemIdx + 1}`, item, idx, sid)}
          </div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: RESULTS (dynamic object field) ═══════ */
  const renderResultsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    if (typeof val === 'object' && !Array.isArray(val)) {
      const entries = Object.entries(val).filter(([, leaf]) => hasVal(leaf));
      if (entries.length === 0) return null;
      return <div key={fn} className="rec-mini-card nested-mini-card">{entries.map(([key, leaf]) => renderNestedLeaf(record, `${fn}.${key}`, humanizeKey(key), leaf, idx, sid))}</div>;
    }
    return <div key={fn} className="rec-mini-card nested-mini-card">{renderNestedLeaf(record, fn, FIELD_LABELS[fn] || fn, val, idx, sid)}</div>;
  };

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal, fn);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn} className="rec-mini-card nested-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
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
                if (commaItems.length >= 2) {
                  return (
                    <div key={sIdx} className="rec-mini-card nested-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx} data-edit-field={fn}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageDraft(record, fn, idx, fullText2, sid); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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

              /* Regular sentence row */
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card nested-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined} data-edit-field={fn}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageDraft(record, fn, idx, fullText, sid); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
            })}
        </div>
      );
    }

    /* Single-value string: simple editable */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
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

  /* ═══════ RENDER: RECOMMENDATIONS (array of {recommendation, date}, date-grouped) ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val.map((item, itemIndex) => ({ item: item && typeof item === 'object' ? item : { recommendation: String(item || ''), date: '' }, itemIndex })).filter(({ item }) => hasVal(item.recommendation) || hasVal(item.date)) : [];
    if (!recs.length) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const groups = [];
    recs.forEach(entry => {
      const dateKey = String(entry.item.date || '').trim() || 'no-date';
      const previous = groups[groups.length - 1];
      if (previous && previous.dateKey === dateKey) previous.entries.push(entry);
      else groups.push({ dateKey, entries: [entry] });
    });

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {groups.map((group, groupIndex) => {
          const datePaths = group.entries.filter(({ item }) => hasVal(item.date)).map(({ itemIndex }) => `${fn}.${itemIndex}.date`);
          const dateEditKey = `${fn}-date-group-${groupIndex}-${idx}`;
          const isDateEditing = editingField === dateEditKey;
          const isMonthDate = /^\d{4}-\d{2}$/.test(group.dateKey);
          const displayDate = isMonthDate ? formatMonth(group.dateKey) : group.dateKey !== 'no-date' ? formatDate(group.dateKey) : '';
          const dateModified = datePaths.some(path => editedFields[`${path}-${idx}`]);
          const saveGroupDate = event => {
            event.stopPropagation();
            const storedDate = isMonthDate ? toStoredMonth(editValue) : editValue ? `${editValue}T00:00:00.000Z` : '';
            datePaths.forEach(path => stageDraft(record, path, idx, storedDate, sid));
            setEditedFields(previous => ({ ...previous, ...Object.fromEntries(datePaths.map(path => [`${path}-${idx}`, 'edited'])) }));
            setEditingField(null); setEditValue(''); setSaveError(null);
          };
          return (
            <div key={`${group.dateKey}-${groupIndex}`} className="rec-mini-card nested-mini-card recommendation-group">
              {group.dateKey !== 'no-date' && <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
                <div className={`nested-subtitle date-subtitle editable-row ${dateModified ? 'modified' : ''}`} onClick={() => { if (!isDateEditing) { setEditingField(dateEditKey); setEditValue(group.dateKey); setSaveError(null); } }}>
                  {isDateEditing ? <div className="edit-field-container">
                    {isMonthDate ? <BlueMonthPicker value={editValue} onSelect={setEditValue} /> : <BlueDatePicker value={editValue} onSelect={setEditValue} />}
                    <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={saveGroupDate}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
                  </div> : <><span className="content-value">{highlightText(displayDate)}</span><span className="edit-indicator">&#9998;</span></>}
                </div>
                {dateModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>}
              {group.entries.map(({ item, itemIndex }) => {
                if (!hasVal(item.recommendation)) return null;
                const fieldPath = `${fn}.${itemIndex}.recommendation`;
                const itemKey = `${fieldPath}-${idx}`;
                const isEditing = editingField === itemKey;
                const isModified = editedFields[itemKey];
                const recText = String(getFieldValue(record, fieldPath, idx) ?? item.recommendation);
                return (
                  <div key={fieldPath} data-edit-field={fieldPath}>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); handleSaveField(record, fieldPath, idx, sid, null, editValue.trim(), itemKey); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
                        </div>
                      ) : <><div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(recText, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button></>}
                    </div>
                    {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
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
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid);
            if (MEASUREMENT_FIELDS.has(f)) return renderMeasurementField(record, f, idx, sid);
            if (f === 'otherMarkers') return renderOtherMarkersField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (f === 'results') return renderResultsField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="tumor-markers-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Tumor Markers</h2></div>
        <div className="empty-state">No tumor markers records available</div>
      </div>
    );
  }

  return (
    <div className="tumor-markers-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Tumor Markers</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<TumorMarkersDocumentPDFTemplate document={pdfData} />} fileName="Tumor_Markers.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search tumor markers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(record.provider || `Tumor Markers ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'header-info')}
            {renderSection(record, idx, 'standard-markers')}
            {renderSection(record, idx, 'other-markers')}
            {renderSection(record, idx, 'clinical-assessment')}
            {renderSection(record, idx, 'treatment-plan')}
            {renderSection(record, idx, 'results-data')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TumorMarkersDocument;
