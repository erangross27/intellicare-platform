/**
 * PerformanceStatusDocument.jsx
 * Canonical one-pass rebuild (July 2026) — config-driven rec-mini-card rows with .numbered-row.editable-row,
 * BlueDatePicker (date) / BlueSelect (status enum) / −+ num-steppers for the ECOG / Karnofsky / Lansky
 * performance scales, single-name gate, canonical EQ/DASH numbered copy (empty-section drop), standard
 * Pending-Approve draft wiring, box-free PDF. Oncology performance-status schema.
 * Header is TITLE-ONLY — date/type/status render inside the Assessment Information section (no meta pills).
 * Collection: performance_status
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PerformanceStatusDocumentPDFTemplate from '../pdf-templates/PerformanceStatusDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './PerformanceStatusDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve. */
const DRAFT_KEY = 'performanceStatusPendingEdits';
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'performance-scores': 'Performance Scores',
  'functional-capacity': 'Functional Capacity',
  'provider-info': 'Provider Information',
  'clinical-findings': 'Clinical Findings',
  'clinical-assessment': 'Clinical Assessment',
  'monitoring-plan': 'Monitoring Plan',
  'additional-notes': 'Additional Notes',
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', status: 'Status',
  karnofsky: 'Karnofsky (KPS)', ecog: 'ECOG', lansky: 'Lansky',
  functionalCapacity: 'Functional Capacity',
  provider: 'Provider', facility: 'Facility',
  findings: 'Clinical Findings', assessment: 'Clinical Assessment',
  plan: 'Monitoring Plan', notes: 'Additional Notes',
};
const SECTION_FIELDS = {
  'assessment-info': ['date', 'type', 'status'],
  'performance-scores': ['karnofsky', 'ecog', 'lansky'],
  'functional-capacity': ['functionalCapacity'],
  'provider-info': ['provider', 'facility'],
  'clinical-findings': ['findings'],
  'clinical-assessment': ['assessment'],
  'monitoring-plan': ['plan'],
  'additional-notes': ['notes'],
};
const SECTION_ORDER = ['assessment-info', 'performance-scores', 'functional-capacity', 'provider-info', 'clinical-findings', 'clinical-assessment', 'monitoring-plan', 'additional-notes'];

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['karnofsky', 'ecog', 'lansky'];
const ENUM_FIELDS = ['status'];
const ENUM_OPTIONS = {
  status: ['Active', 'Completed', 'Not Active'],
};
/* Known clinical performance scales — −+ stepper clamped to the scale's range/step (act-like-a-professional). */
const SCALE = {
  ecog: { max: 5, step: 1 },        // ECOG 0–5
  karnofsky: { max: 100, step: 10 },// Karnofsky 0–100 by 10
  lansky: { max: 100, step: 10 },   // Lansky 0–100 by 10
};
const enumCanonical = (options, val) => { const cur = String(val ?? '').trim(); const hit = (options || []).find(o => o.toLowerCase() === cur.toLowerCase()); return hit || cur; };
const enumOptionsWith = (options, val) => { const cur = String(val ?? '').trim(); if (cur && !(options || []).some(o => o.toLowerCase() === cur.toLowerCase())) return [enumCanonical(options, cur), ...options]; return options || []; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; }
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

const PerformanceStatusDocument = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP (multi-record) ═══════ */
  const records = useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.performance_status) return Array.isArray(r.performance_status) ? r.performance_status : [r.performance_status];
      if (r?.records) return Array.isArray(r.records) ? r.records : [r.records];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.performance_status) return Array.isArray(dd.performance_status) ? dd.performance_status : [dd.performance_status]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  /* Rehydrate pending drafts from localStorage. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const rid = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = rid(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fn, value]) => { const lk = `${fn}-${idx}`; nLocal[lk] = value; nPending[lk] = true; nFields[lk] = 'edited'; });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => !isEmptyDeep(v), []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Canonical splitBySentence — splits on [.;] (protects honorifics/initials & numbered prefixes) */
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

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

  const fieldRawText = useCallback((record, fn, idx) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined) return '';
    if (DATE_FIELDS.includes(fn)) return formatDate(val);
    if (ENUM_FIELDS.includes(fn)) return enumCanonical(ENUM_OPTIONS[fn], fmtVal(val));
    return fmtVal(val);
  }, [getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const p = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(p) || p.includes(label)) return true;
    return fieldRawText(record, fn, idx).toLowerCase().includes(p);
  }, [searchTerm, fieldRawText]);

  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    if (sectionTitleMatches(sid)) return true;
    return (SECTION_FIELDS[sid] || []).some(f => hasVal(getFieldValue(record, f, 0)) && fieldMatches(record, f, 0));
  }, [searchTerm, sectionTitleMatches, hasVal, getFieldValue, fieldMatches]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const p = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Performance Status Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(p)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) if (t.toLowerCase().includes(p)) return true;
      for (const l of Object.values(FIELD_LABELS)) if (l.toLowerCase().includes(p)) return true;
      for (const fields of Object.values(SECTION_FIELDS)) for (const f of fields) if (fieldRawText(record, f, idx).toLowerCase().includes(p)) return true;
      if (Array.isArray(record.recommendations) && record.recommendations.some(rec => String(typeof rec === 'string' ? rec : (rec.recommendation || '')).toLowerCase().includes(p))) return true;
      return false;
    });
  }, [records, searchTerm, fieldRawText]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return;
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key];
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT / APPROVE ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editTrackingKey || editKey]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = saveVal; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const edited = editValue.trim();
    const strip = (s) => s.replace(/[;.]+$/, '').trim();
    let updated;
    if (!edited || /^[;.,!?]+$/.test(edited)) { updated = [...sentences]; updated.splice(sentenceIdx, 1); }
    else { const ns = splitBySentence(edited); updated = [...sentences]; updated.splice(sentenceIdx, 1, ...ns); }
    const fullText = updated.map(strip).join('. ') + (updated.length ? '.' : '');
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue, splitBySentence]);

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)));
  }, [editedFields]);

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      for (const [fn, value] of Object.entries(recDrafts)) {
        if (!fields.includes(fn)) continue;
        const resp = await secureApiClient.put(`/api/edit/performance_status/${id}/edit`, { field: fn, value });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/performance_status/${id}/approve`, { sectionId: sid, approved: true });
      setPendingEdits(prev => { const n = { ...prev }; fields.forEach(f => { delete n[`${f}-${idx}`]; }); return n; });
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[PerformanceStatus] Approve error:', err); setSaveError('Save failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    let body = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      if (DATE_FIELDS.includes(f)) {
        body += `${head}1. ${formatDate(val)}\n\n`;
      } else if (ENUM_FIELDS.includes(f)) {
        body += `${head}1. ${enumCanonical(ENUM_OPTIONS[f], fmtVal(val))}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        body += `${head}1. ${fmtVal(val)}\n\n`;
      } else {
        body += head;
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) sentences.forEach((s, i) => { body += `${i + 1}. ${s.replace(/[;.]+$/, '').trim()}\n`; });
        else body += `1. ${strVal}\n`;
        body += '\n';
      }
    });
    if (!body.trim()) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${body}`;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence]);

  const buildRecommendationsCopyText = useCallback((record) => {
    if (!Array.isArray(record.recommendations) || record.recommendations.length === 0) return '';
    let body = '';
    record.recommendations.forEach((rec, i) => {
      const text = typeof rec === 'string' ? rec : (rec.recommendation || '');
      const date = typeof rec === 'string' ? null : rec.date;
      body += `${i + 1}. ${text}${date ? ` (${formatDate(date)})` : ''}\n`;
    });
    return `Recommendations\n${COPY_LINE_EQ}\n\n${body}\n`;
  }, []);

  const copyAllText = useCallback(async () => {
    let text = `Performance Status\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Performance Status Assessment ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      SECTION_ORDER.forEach(sid => { const sec = buildSectionCopyText(r, idx, sid); if (sec) text += sec; });
      text += buildRecommendationsCopyText(r);
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText, buildRecommendationsCopyText]);

  /* ═══════ RENDER: DATE FIELD (BlueDatePicker) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
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

  /* ═══════ RENDER: ENUM FIELD (BlueSelect) ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const options = ENUM_OPTIONS[fn] || [];
    const displayVal = enumCanonical(options, fmtVal(val));
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={enumCanonical(options, editValue)} options={enumOptionsWith(options, displayVal)} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER FIELD (−+ stepper, clamped to the clinical scale) ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    const sc = SCALE[fn] || { max: null, step: 1 };
    const clamp = (n) => { let x = n; if (x < 0) x = 0; if (sc.max != null && x > sc.max) x = sc.max; return x; };
    const stepNum = (dir) => { const cur = parseFloat(editValue); setEditValue(String(clamp((isNaN(cur) ? 0 : cur) + dir * sc.step))); };
    const saveNum = () => { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, clamp(n)); };
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepNum(-1); }} disabled={saving}>−</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); saveNum(); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepNum(1); }} disabled={saving}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveNum(); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="score-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD (splitBySentence) ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length > 1) {
      return (
        <div key={fn} className="rec-mini-card">
          {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedFields[sentenceKey];
            return (
              <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
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

    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ═══════ RENDER: SECTION ═══════ */
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ENUM_FIELDS.includes(f)) return renderEnumField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS (array, copy-only) ═══════ */
  const renderRecommendations = (record, idx) => {
    if (!Array.isArray(record.recommendations) || record.recommendations.length === 0) return null;
    if (searchTerm.trim() && !record._showAllSections) {
      const p = searchTerm.toLowerCase().trim();
      const titleMatch = 'recommendations'.includes(p) || p.includes('recommendations');
      const contentMatch = record.recommendations.some(rec => String(typeof rec === 'string' ? rec : (rec.recommendation || '')).toLowerCase().includes(p));
      if (!titleMatch && !contentMatch) return null;
    }
    const copyId = `recommendations-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Recommendations')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildRecommendationsCopyText(record), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {record.recommendations.map((rec, recIdx) => {
            const text = typeof rec === 'string' ? rec : (rec.recommendation || '');
            const date = typeof rec === 'string' ? null : rec.date;
            const itemKey = `rec-${idx}-${recIdx}`;
            return (
              <div key={recIdx} className="rec-mini-card">
                {date && <div className="nested-subtitle">{highlightText(formatDate(date))}</div>}
                <div className="numbered-row">
                  <div className="row-content"><span className="content-value">{highlightText(text)}</span></div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(text, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="performance-status-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Performance Status</h2></div>
        <div className="empty-state">No performance status records available</div>
      </div>
    );
  }

  return (
    <div className="performance-status-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Performance Status</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PerformanceStatusDocumentPDFTemplate document={pdfData} />} fileName="Performance_Status.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search performance status assessments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Performance Status Assessment ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
            {renderRecommendations(record, idx)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PerformanceStatusDocument;
