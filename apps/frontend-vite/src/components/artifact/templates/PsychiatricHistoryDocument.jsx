/**
 * PsychiatricHistoryDocument.jsx
 * Canonical one-pass (July 2026) — generic recursive mini-card renderer (mirrors PodiatryExaminations).
 * Collection: psychiatric_history
 *
 * Display: section -> mini-cards-container (header INSIDE) -> rec-mini-card per top-level field ->
 *   recursive renderNode. A LABEL is a nested-subtitle on its own line; a VALUE is a numbered-row.
 *   NO "Label: value" inline, NO on-screen numbering. hide-empty everywhere. Booleans -> BlueSelect
 *   (Yes/No), the top-level clinical date -> BlueDatePicker, narratives (findings/assessment/plan/notes)
 *   -> per-sentence editable rows. Per-section Pending Approve -> Approved.
 * Editing: every scalar LEAF anywhere in the nested tree is click-to-edit; on save it deep-clones the
 *   top-level field, sets the leaf, and persists it via a dot-path (e.g. "suicideAttempts.0.hospitalization")
 *   to /api/edit/psychiatric_history/:id/edit (the route allows any path whose ROOT is in ALLOWED_FIELDS).
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PsychiatricHistoryDocumentPDFTemplate from '../pdf-templates/PsychiatricHistoryDocumentPDFTemplate';
import BlueSelect from '../components/BlueSelect';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './PsychiatricHistoryDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Shape: { [recordId]: { [dotField]: value } }  (dotField is the exact /edit field path). */
const DRAFT_KEY = 'psychiatric_historyPendingEdits';
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
  'record-info': 'Record Information',
  'previous-episodes': 'Previous Psychiatric Episodes',
  'hospitalizations': 'Hospitalizations',
  'suicide-attempts': 'Suicide Attempts',
  'substance-abuse': 'Substance Abuse History',
  'previous-psychotherapy': 'Previous Psychotherapy',
  'family-history': 'Family Psychiatric History',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'notes': 'Notes',
  'results': 'Results',
};
/* record-info is a multi-field section (date/type/provider/facility); every other section maps to ONE field. */
const RECORD_INFO_FIELDS = ['date', 'type', 'provider', 'facility'];
const SECTION_FIELD = {
  'previous-episodes': 'previousEpisodes',
  'hospitalizations': 'hospitalizations',
  'suicide-attempts': 'suicideAttempts',
  'substance-abuse': 'substanceAbuse',
  'previous-psychotherapy': 'previousPsychotherapy',
  'family-history': 'familyPsychHistory',
  'findings': 'findings',
  'assessment': 'assessment',
  'plan': 'plan',
  'recommendations': 'recommendations',
  'notes': 'notes',
  'results': 'results',
};
const SECTION_ORDER = ['record-info', 'previous-episodes', 'hospitalizations', 'suicide-attempts', 'substance-abuse', 'previous-psychotherapy', 'family-history', 'findings', 'assessment', 'plan', 'recommendations', 'notes', 'results'];
const NARRATIVE_FIELDS = new Set(['findings', 'assessment', 'plan', 'notes']);
const sectionFieldsFor = (sid) => (sid === 'record-info' ? RECORD_INFO_FIELDS : [SECTION_FIELD[sid]]);

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ═══════ VALUE HELPERS ═══════ */
/* isEmptyDeep — a numeric 0 is a sentinel (empty); false booleans are MEANINGFUL (render "No"). */
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
const deepClone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
/* stepFor: decimal-aware increment for the number stepper. */
const stepFor = (v) => { const s = String(v); const dot = s.indexOf('.'); if (dot === -1) return 1; const decimals = s.length - dot - 1; return decimals <= 0 ? 1 : Math.pow(10, -decimals); };
const setByPath = (obj, pathArr, val) => { let cur = obj; for (let i = 0; i < pathArr.length - 1; i++) cur = cur[pathArr[i]]; cur[pathArr[pathArr.length - 1]] = val; };
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};
const toISODay = (dateValue) => { if (!dateValue) return ''; try { return new Date(dateValue.$date || dateValue).toISOString().split('T')[0]; } catch { return ''; } };
/* buildCopyLines: STACK label-over-value (never "Label: value" side-by-side); every value row is
   numbered "N. value" (restart per labeled leaf / per array). Group/object headers are colon-free. */
const buildCopyLines = (label, value, indent) => {
  const pad = '  '.repeat(indent); const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { if (label) out.push(`${pad}${label}`); out.push(`${pad}1. ${fmtScalar(value)}`); return out; }
  if (Array.isArray(value)) {
    if (label) out.push(`${pad}${label}`);
    let n = 1;
    value.filter(x => !isEmptyDeep(x)).forEach(item => {
      if (isScalar(item)) { out.push(`${pad}${n++}. ${fmtScalar(item)}`); return; }
      const e = Object.entries(item).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v)); if (!e.length) return;
      const headScalar = isScalar(e[0][1]);
      if (headScalar) { out.push(`${pad}${n++}. ${fmtScalar(e[0][1])}`); e.slice(1).forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + 1))); }
      else e.forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + 1)));
    });
    return out;
  }
  if (label) out.push(`${pad}${label}`);
  Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v)).forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
  return out;
};

/* ═══════ COMPONENT ═══════ */
const PsychiatricHistoryDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});      // nested leaf / scalar edits: `${dotPath}@@${idx}` -> 'edited'
  const [editedSentences, setEditedSentences] = useState({}); // narratives: `${fn}-${idx}-s${i}`
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP (3-prop) ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (r.psychiatric_history) return Array.isArray(r.psychiatric_history) ? r.psychiatric_history : [r.psychiatric_history];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_history) return Array.isArray(dd.psychiatric_history) ? dd.psychiatric_history : [dd.psychiatric_history]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* ═══════ UTILS ═══════ */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      if (!record || !record._id) return;
      const rid = (typeof record._id === 'string') ? record._id : (record._id.$oid || String(record._id));
      const recDrafts = store[rid];
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([dotField, value]) => {
        nPending[dotField + `@@${idx}`] = true;
        const path = dotField.split('.');
        const fn = path[0];
        const subPath = path.slice(1);
        if (subPath.length === 0) {
          nLocal[`${fn}-${idx}`] = value;
          nPending[`${fn}-${idx}`] = true;
          if (NARRATIVE_FIELDS.has(fn)) nSentences[`${fn}-${idx}-s0`] = 'edited';
          else nFields[`${fn}@@${idx}`] = 'edited';
        } else {
          const base = nLocal[`${fn}-${idx}`] !== undefined ? nLocal[`${fn}-${idx}`] : record[fn];
          const clone = base === undefined ? undefined : JSON.parse(JSON.stringify(base));
          if (clone !== undefined) { try { setByPath(clone, subPath, value); nLocal[`${fn}-${idx}`] = clone; } catch { /* skip malformed draft */ } }
          nFields[`${dotField}@@${idx}`] = 'edited';
        }
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).split(regex).map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);
  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

  /* ═══════ SEARCH ═══════ */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    if ((SECTION_TITLES[sid] || '').toLowerCase().includes(phrase)) return true;
    return sectionFieldsFor(sid).some(fn => flattenSearchable(getFieldValue(record, fn, 0)).toLowerCase().includes(phrase));
  }, [searchTerm, getFieldValue]);
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      if (`psychiatric history ${idx + 1}`.includes(phrase)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase)) return true; }
      for (const sid of SECTION_ORDER) { if (sectionFieldsFor(sid).some(fn => flattenSearchable(getFieldValue(record, fn, idx)).toLowerCase().includes(phrase))) return true; }
      return false;
    });
  }, [records, searchTerm, getFieldValue]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => filteredRecords.map((record, idx) => {
    const merged = { ...record };
    Object.keys(localEdits).forEach(key => {
      const m = key.match(/^(.+)-(\d+)$/);
      if (!m || parseInt(m[2]) !== idx) return;
      const fn = m[1];
      if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
      const hasPendingLeaf = Object.keys(pendingEdits).some(pk => {
        const at = pk.indexOf('@@');
        if (at === -1) return false;
        if (pk.slice(at + 2) !== String(idx)) return false;
        const dot = pk.slice(0, at);
        return dot === fn || dot.startsWith(`${fn}.`);
      });
      if (hasPendingLeaf) return;
      merged[fn] = localEdits[key];
    });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT: nested scalar LEAF (dot-path save) ═══════ */
  const saveLeaf = useCallback((record, path, idx, sid, newVal) => {
    const recordId = safeId(record); if (!recordId) return;
    const fn = path[0]; const subPath = path.slice(1);
    if (subPath.length === 0) return; // top-level handled by saveScalarField / renderNarrative
    const clone = deepClone(getFieldValue(record, fn, idx));
    try { setByPath(clone, subPath, newVal); } catch (e) { console.error('[PsychiatricHistory] setByPath failed', e); setSaveError('Save failed.'); return; }
    const dotField = path.join('.');
    const editKey = `${dotField}@@${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: clone }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][dotField] = newVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, getFieldValue]);

  /* ═══════ EDIT: top-level scalar field (date/type/provider/facility + narrative full-text) ═══════ */
  const saveScalarField = useCallback((record, fn, idx, sid, newVal, sentenceKey) => {
    const recordId = safeId(record); if (!recordId) return;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: newVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true, [`${fn}@@${idx}`]: true }));
    if (sentenceKey) setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith(`${fn}-${idx}-`)) delete n[k]; }); n[sentenceKey] = 'edited'; return n; });
    setEditedFields(prev => ({ ...prev, [`${fn}@@${idx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fn] = newVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  /* one editable scalar cell — type-aware (boolean -> Yes/No BlueSelect, number -> stepper, string -> textarea) */
  const editCell = (record, value, path, idx, sid, variant) => {
    const editKey = `${path.join('.')}@@${idx}`;
    const isEditing = editingField === editKey;
    const isBool = typeof value === 'boolean';
    const isNum = typeof value === 'number';
    const display = fmtScalar(value);
    const modified = editedFields[editKey] === 'edited';
    const wrapCls = variant === 'head' ? `editable-head ${modified ? 'modified' : ''}` : `numbered-row editable-row ${modified ? 'modified' : ''}`;
    const startEdit = () => { if (!isEditing) { setEditingField(editKey); setEditValue(isBool ? (value ? 'Yes' : 'No') : display); setSaveError(null); } };
    const commit = () => {
      let v;
      if (isBool) v = editValue === 'Yes';
      else if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } v = n; }
      else v = editValue;
      saveLeaf(record, path, idx, sid, v);
    };
    if (isEditing) {
      return (
        <div className={variant === 'head' ? 'editable-head editing' : 'numbered-row'} key={editKey}>
          <div className="edit-field-container">
            {isBool ? (
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={v => { setEditValue(v); setSaveError(null); }} />
            ) : isNum ? (
              <div className="number-edit-row"><div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const base = parseFloat(editValue); if (isNaN(base)) return; setEditValue(String(Math.max(0, +(base - stepFor(editValue)).toFixed(4)))); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const base = parseFloat(editValue); if (isNaN(base)) return; setEditValue(String(Math.max(0, +(base + stepFor(editValue)).toFixed(4)))); }}>+</button>
              </div></div>
            ) : (
              <textarea className="edit-textarea" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commit(); } }} />
            )}
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); commit(); }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }
    if (variant === 'head') {
      return (
        <div key={editKey} className={`nested-subtitle ${wrapCls}`} onClick={startEdit} title="Click to edit">
          {highlightText(display)}<span className="edit-indicator">&#9998;</span>
        </div>
      );
    }
    return (
      <div className={wrapCls} key={editKey} onClick={startEdit}>
        <div className="row-content"><span className="content-value">{highlightText(display)}</span><span className="edit-indicator">&#9998;</span></div>
        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(display, editKey); }}>{copiedItems[editKey] ? 'Copied' : 'Copy'}</button>
      </div>
    );
  };

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = sectionFieldsFor(sid);
    return fields.some(fn =>
      Object.keys(editedFields).some(k => { const [dot, kIdx] = k.split('@@'); return kIdx === String(idx) && (dot === fn || dot.startsWith(`${fn}.`)); }) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${fn}-${idx}`))
    );
  }, [editedFields, editedSentences]);
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = sectionFieldsFor(sid);
    setSaving(true); setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const toCommit = Object.keys(recDrafts).filter(dot => fields.some(fn => dot === fn || dot.startsWith(`${fn}.`)));
      for (const dotField of toCommit) {
        const resp = await secureApiClient.put(`/api/edit/psychiatric_history/${id}/edit`, { field: dotField, value: recDrafts[dotField] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/psychiatric_history/${id}/approve`, { sectionId: sid, approved: true });

      setPendingEdits(prev => {
        const n = { ...prev };
        toCommit.forEach(dot => { delete n[`${dot}@@${idx}`]; });
        fields.forEach(fn => { delete n[`${fn}-${idx}`]; });
        return n;
      });
      if (store[id]) { toCommit.forEach(dot => delete store[id][dot]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { const [dot, kIdx] = k.split('@@'); if (kIdx === String(idx) && fields.some(fn => dot === fn || dot.startsWith(`${fn}.`))) delete n[k]; }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (fields.some(fn => k.startsWith(`${fn}-${idx}`))) delete n[k]; }); return n; });
    } catch (err) { console.error('[PsychiatricHistory] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId]);
  const renderApproveButton = (record, sid, idx) => {
    if (sectionHasEdits(idx, sid)) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (approvedSections[`${sid}-${idx}`]) return <span className="approve-btn approved">Approved</span>;
    return null;
  };

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    if (sid === 'record-info') {
      let body = '';
      RECORD_INFO_FIELDS.forEach(fn => {
        const v = getFieldValue(record, fn, idx);
        if (isEmptyDeep(v)) return;
        const disp = fn === 'date' ? formatDate(v) : fmtScalar(v);
        body += `${humanizeKey(fn)}\n1. ${disp}\n`;
      });
      return body ? `${SECTION_TITLES[sid]}\n${'='.repeat(40)}\n${body}\n` : '';
    }
    const fn = SECTION_FIELD[sid]; const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val)) return '';
    let text = `${SECTION_TITLES[sid]}\n${'='.repeat(40)}\n`;
    if (NARRATIVE_FIELDS.has(fn) && typeof val === 'string') {
      const sents = splitBySentence(val);
      const rows = sents.length > 0 ? sents : [String(val)];
      rows.forEach((s, i) => { text += `${i + 1}. ${s}\n`; });
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.entries(val).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v)).forEach(([k, v]) => buildCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; }));
    } else {
      buildCopyLines('', val, 0).forEach(l => { text += `${l}\n`; });
    }
    return text + '\n';
  }, [getFieldValue, splitBySentence]);
  const copyAllText = useCallback(async () => {
    let text = '=== PSYCHIATRIC HISTORY ===\n\n';
    pdfData.forEach((r, idx) => { text += `Psychiatric History ${idx + 1}\n${'='.repeat(40)}\n\n`; SECTION_ORDER.forEach(sid => { text += buildSectionCopyText(r, idx, sid); }); });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: recursive node — labels = nested-subtitle; scalar leaves = editable cells ═══════ */
  const renderNode = (record, label, value, path, idx, sid, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';

    if (isScalar(value)) {
      return (
        <React.Fragment key={path.join('.')}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          {editCell(record, value, path, idx, sid, 'row')}
        </React.Fragment>
      );
    }

    if (Array.isArray(value)) {
      const items = value.filter(x => !isEmptyDeep(x));
      if (items.length === 0) return null;
      const indexed = []; value.forEach((it, oi) => { if (!isEmptyDeep(it)) indexed.push([oi, it]); });
      return (
        <React.Fragment key={path.join('.')}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          {indexed.map(([oi, item]) => {
            const ipath = [...path, oi];
            if (isScalar(item)) return editCell(record, item, ipath, idx, sid, 'row');
            const entries = Object.entries(item).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
            if (entries.length === 0) return null;
            const headScalar = isScalar(entries[0][1]);
            const rest = headScalar ? entries.slice(1) : entries;
            if (headScalar && rest.length === 0) {
              return <div className="rec-mini-card" key={ipath.join('.')}>{editCell(record, entries[0][1], [...ipath, entries[0][0]], idx, sid, 'row')}</div>;
            }
            return (
              <div className="rec-mini-card" key={ipath.join('.')}>
                {headScalar ? editCell(record, entries[0][1], [...ipath, entries[0][0]], idx, sid, 'head') : null}
                {rest.map(([k, v]) => (
                  isScalar(v) ? (
                    <div className="nested-mini-card" key={k}>
                      <div className="nested-subtitle sub-label">{highlightText(humanizeKey(k))}</div>
                      {editCell(record, v, [...ipath, k], idx, sid, 'row')}
                    </div>
                  ) : (
                    <div className="nested-mini-card" key={k}>
                      {renderNode(record, humanizeKey(k), v, [...ipath, k], idx, sid, depth + 2)}
                    </div>
                  )
                ))}
              </div>
            );
          })}
        </React.Fragment>
      );
    }

    const entries = Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('.')}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">{entries.map(([k, v]) => renderNode(record, humanizeKey(k), v, [...path, k], idx, sid, depth + 1))}</div>
      </React.Fragment>
    );
  };

  /* ═══════ RENDER: top-level DATE cell (BlueDatePicker) ═══════ */
  const renderDateCell = (record, idx, sid) => {
    const val = getFieldValue(record, 'date', idx);
    if (isEmptyDeep(val)) return null;
    const editKey = `date@@${idx}`;
    const isEditing = editingField === editKey;
    const modified = editedFields[editKey] === 'edited';
    const displayVal = formatDate(val);
    return (
      <div className="rec-mini-card" key="date">
        <div className="nested-subtitle">Date</div>
        <div className={`numbered-row editable-row ${modified ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toISODay(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => { setEditValue(iso); setSaveError(null); }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } saveScalarField(record, 'date', idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Date\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {modified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: top-level single-value STRING cell (type/provider/facility) ═══════ */
  const renderStringCell = (record, fn, idx, sid, label) => {
    const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val)) return null;
    const strVal = fmtScalar(val);
    const editKey = `${fn}@@${idx}`;
    const isEditing = editingField === editKey;
    const modified = editedFields[editKey] === 'edited';
    return (
      <div className="rec-mini-card" key={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row editable-row ${modified ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveScalarField(record, fn, idx, sid, editValue); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveScalarField(record, fn, idx, sid, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {modified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: narrative (findings/assessment/plan/notes) — per-sentence editable ═══════ */
  const renderNarrative = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val)) return null;
    const sents = splitBySentence(String(val));
    const rows = sents.length > 0 ? sents : [String(val)];
    const saveRow = (i) => {
      const cur = String(getFieldValue(record, fn, idx) || '');
      const updated = splitBySentence(cur);
      const editedVal = editValue.trim();
      if (!editedVal.replace(/[;.]+$/, '')) updated.splice(i, 1);
      else updated.splice(i, 1, ...splitBySentence(editedVal));
      const fullText = reconstructFullText(updated);
      saveScalarField(record, fn, idx, sid, fullText, `${fn}-${idx}-s${i}`);
    };
    return (
      <div className="rec-mini-card">
        {rows.map((sentence, sIdx) => {
          const key = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === key; const badge = editedSentences[key];
          return (
            <div key={sIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(key); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveRow(sIdx); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRow(sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, key); }}>{copiedItems[key] ? 'Copied' : 'Copy'}</button>
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

  /* ═══════ RENDER: SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;
    let body = null;
    if (sid === 'record-info') {
      const cells = [renderDateCell(record, idx, sid), renderStringCell(record, 'type', idx, sid, 'Type'), renderStringCell(record, 'provider', idx, sid, 'Provider'), renderStringCell(record, 'facility', idx, sid, 'Facility')].filter(Boolean);
      if (cells.length === 0) return null;
      body = cells;
    } else {
      const fn = SECTION_FIELD[sid]; const val = getFieldValue(record, fn, idx);
      if (isEmptyDeep(val)) return null;
      if (NARRATIVE_FIELDS.has(fn)) body = renderNarrative(record, fn, idx, sid);
      else if (val && typeof val === 'object' && !Array.isArray(val)) body = Object.entries(val).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v)).map(([k, v]) => (<div className="rec-mini-card" key={k}>{renderNode(record, humanizeKey(k), v, [fn, k], idx, sid, 0)}</div>));
      else body = <div className="rec-mini-card">{renderNode(record, '', val, [fn], idx, sid, 0)}</div>;
    }
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {body}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="psychiatric-history-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Psychiatric History</h2></div>
        <div className="empty-state">No psychiatric history records available</div>
      </div>
    );
  }
  return (
    <div className="psychiatric-history-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Psychiatric History</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<PsychiatricHistoryDocumentPDFTemplate document={pdfData} />} fileName="Psychiatric_History.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search psychiatric history..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Psychiatric History ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PsychiatricHistoryDocument;
