/**
 * CognitiveEvaluationsDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: cognitive_evaluations
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CognitiveEvaluationsDocumentPDFTemplate from '../pdf-templates/CognitiveEvaluationsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './CognitiveEvaluationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "fn-idx" editKey base) */
const DRAFT_KEY = 'cognitive_evaluationsPendingEdits';
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
  'screening-scores': 'Screening Scores',
  'neuropsych-tests': 'Neuropsychological Tests',
  'cognitive-indices': 'Cognitive Indices',
  'functional-assessment': 'Functional Assessment',
  'memory-domains': 'Memory Domains',
};

const FIELD_LABELS = {
  mmseScore: 'MMSE Score', mocaScore: 'MoCA Score', glasgowComaScale: 'Glasgow Coma Scale', clockDrawingTest: 'Clock Drawing Test',
  trailMakingTestA: 'Trail Making Test A', trailMakingTestB: 'Trail Making Test B', verbalFluencyScore: 'Verbal Fluency', digitSpanForward: 'Digit Span Forward', digitSpanBackward: 'Digit Span Backward', bostonNamingTest: 'Boston Naming Test', wisconsinCardSortTest: 'Wisconsin Card Sort', stroopTestScore: 'Stroop Test', reyComplexFigure: 'Rey Complex Figure', californiVerbalLearning: 'California Verbal Learning',
  iqScore: 'IQ Score', processingSpeedIndex: 'Processing Speed Index', workingMemoryIndex: 'Working Memory Index', perceptualReasoningIndex: 'Perceptual Reasoning Index', verbalComprehensionIndex: 'Verbal Comprehension Index',
  attentionDeficitRating: 'Attention Deficit Rating', executiveFunctionScore: 'Executive Function', cognitiveReserveIndex: 'Cognitive Reserve Index',
  memoryDomainImpairment: 'Memory Domain Impairment',
};

const SECTION_FIELDS = {
  'screening-scores': ['mmseScore', 'mocaScore', 'glasgowComaScale', 'clockDrawingTest'],
  'neuropsych-tests': ['trailMakingTestA', 'trailMakingTestB', 'verbalFluencyScore', 'digitSpanForward', 'digitSpanBackward', 'bostonNamingTest', 'wisconsinCardSortTest', 'stroopTestScore', 'reyComplexFigure', 'californiVerbalLearning'],
  'cognitive-indices': ['iqScore', 'processingSpeedIndex', 'workingMemoryIndex', 'perceptualReasoningIndex', 'verbalComprehensionIndex'],
  'functional-assessment': ['attentionDeficitRating', 'executiveFunctionScore', 'cognitiveReserveIndex'],
  'memory-domains': ['memoryDomainImpairment'],
};

const ARRAY_FIELDS = ['memoryDomainImpairment'];
const SENTENCE_FIELDS = [];
// Copy dividers (mirror the PDF): '=' under record + section titles, '-' under each field label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// Decimal-aware step for the −/+ number stepper (scores are integers → step 1)
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// All scores are integers where 0 = "not administered" (sentinel), not a real result
// (real data shows complementary MMSE/MoCA: one scored, the other 0). Hide zero for these.
const NUMERIC_FIELDS = [
  'mmseScore', 'mocaScore', 'glasgowComaScale', 'clockDrawingTest',
  'trailMakingTestA', 'trailMakingTestB', 'verbalFluencyScore', 'digitSpanForward', 'digitSpanBackward', 'bostonNamingTest', 'wisconsinCardSortTest', 'stroopTestScore', 'reyComplexFigure', 'californiVerbalLearning',
  'iqScore', 'processingSpeedIndex', 'workingMemoryIndex', 'perceptualReasoningIndex', 'verbalComprehensionIndex',
  'attentionDeficitRating', 'executiveFunctionScore', 'cognitiveReserveIndex',
];

const CognitiveEvaluationsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.cognitive_evaluations) return Array.isArray(r.cognitive_evaluations) ? r.cognitive_evaluations : [r.cognitive_evaluations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cognitive_evaluations) return Array.isArray(dd.cognitive_evaluations) ? dd.cognitive_evaluations : [dd.cognitive_evaluations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = safeIdOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart is the editKey base "fn-idx0" from when it was saved; re-key to current render idx.
        const m = fieldPart.match(/^(.+)-(\d+)$/);
        const fn = m ? m[1] : fieldPart;
        const editKey = `${fn}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (Array.isArray(value)) value.forEach((_, ai) => { nFields[`${fn}-${idx}-ai${ai}`] = 'edited'; });
        else nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records, safeIdOf]);

  const hasVal = useCallback((v, fn) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    // Score fields use 0 as a "not administered" sentinel — hide it
    if (typeof v === 'number') return !(fn && NUMERIC_FIELDS.includes(fn) && v === 0);
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }, []);

  const formatDate = useCallback((d) => {
    if (!d) return '';
    try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
  }, []);

  const fmtVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; } return Array.isArray(record[fn]) ? record[fn] : []; }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionId) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
      else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sectionId) => {
    if (!searchTerm.trim()) return false;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    return title.includes(phrase) || phrase.includes(title);
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `Cognitive Evaluation ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key]; });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ========== EDIT ==========
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    let stagedValue;
    const isArray = ARRAY_FIELDS.includes(fn);
    if (isArray) {
      const arrMatch = editingField?.match(/-ai(\d+)$/);
      const arrayIndex = arrMatch ? parseInt(arrMatch[1]) : null;
      if (arrayIndex === null) return;
      const arr = [...(getEffectiveArray(record, fn, idx))];
      arr[arrayIndex] = editValue;
      stagedValue = arr;
      setLocalEdits(prev => ({ ...prev, [editKey]: arr }));
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    } else {
      let valueToSave = editValue;
      if (NUMERIC_FIELDS.includes(fn)) { const n = parseFloat(editValue); valueToSave = isNaN(n) ? 0 : n; }
      stagedValue = valueToSave;
      setLocalEdits(prev => ({ ...prev, [editKey]: valueToSave }));
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    }
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    // Persist the draft to localStorage (survives refresh; still NOT in DB/PDF until Approve).
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][editKey] = stagedValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editingField, editValue, safeId, getEffectiveArray]);

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)));
  }, [editedFields]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Collect this section's pending edits (editKey = "fn-idx"; localEdits holds full value/array).
      const toCommit = fields
        .map(f => `${f}-${idx}`)
        .filter(k => pendingEdits[k] && localEdits[k] !== undefined);
      for (const editKey of toCommit) {
        const fn = editKey.slice(0, -`-${idx}`.length);
        const value = localEdits[editKey];
        if (Array.isArray(value)) {
          // Array field: PUT each element with its arrayIndex
          for (let ai = 0; ai < value.length; ai++) {
            const resp = await secureApiClient.put(`/api/edit/cognitive_evaluations/${id}/edit`, { field: fn, value: value[ai], arrayIndex: ai });
            if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
          }
        } else {
          const resp = await secureApiClient.put(`/api/edit/cognitive_evaluations/${id}/edit`, { field: fn, value });
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        }
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/cognitive_evaluations/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => delete store[id][k]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CognitiveEvaluations] Approve error:', err); } finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // Single section-copy builder (mirrors JSX + PDF): "TITLE\n=(40)\n\nLabel\n-(40)\n1. value\n\n...".
  // valueOf(f) abstracts the source — Copy Section reads live edits, Copy All reads committed pdfData.
  const buildSectionCopy = (sid, valueOf) => {
    const title = SECTION_TITLES[sid]; const blocks = [];
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f; const val = valueOf(f); if (!hasVal(val, f)) return;
      if (Array.isArray(val)) {
        const items = val.filter(x => hasVal(x));
        if (!items.length) return;
        blocks.push(`${label}\n${COPY_LINE_DASH}\n${items.map((it, i) => `${i + 1}. ${it}`).join('\n')}`);
      } else {
        blocks.push(`${label}\n${COPY_LINE_DASH}\n1. ${fmtVal(val)}`);
      }
    });
    return blocks.length ? `${title.toUpperCase()}\n${COPY_LINE_EQ}\n\n${blocks.join('\n\n')}` : '';
  };

  const buildSectionCopyText = useCallback((record, idx, sid) =>
    buildSectionCopy(sid, f => getFieldValue(record, f, idx)), [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    const chunks = pdfData.map((r, idx) => {
      const dateBlock = r.date ? `Date\n${COPY_LINE_DASH}\n1. ${formatDate(r.date)}` : '';
      const secs = Object.keys(SECTION_FIELDS).map(sid => buildSectionCopy(sid, f => r[f])).filter(Boolean);
      const body = [dateBlock, ...secs].filter(Boolean).join('\n\n');
      return `COGNITIVE EVALUATION ${idx + 1}\n${COPY_LINE_EQ}\n\n${body}`;
    });
    const text = `COGNITIVE EVALUATIONS RECORDS\n\n${chunks.join('\n\n\n')}`;
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate]);

  // ========== RENDER HELPERS ==========
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val, fn)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val); const isModified = editedFields[editKey]; const itemId = `${fn}-${idx}`;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); } }}>
            {isEditing ? (<div className="edit-field-container">{NUMERIC_FIELDS.includes(fn) ? (<div className="num-stepper-row"><button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button><input type="number" step={stepFor(val)} min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveField(record, fn, idx, sid); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button></div>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />)}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[itemId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, itemId); }}>{copiedItems[itemId] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderEditableArrayItem = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== title.toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {arr.map((item, ai) => {
            const editKey = `${fn}-${idx}-ai${ai}`; const isEditing = editingField === editKey; const badge = editedFields[editKey];
            const itemMatches = phraseMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item)); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; return hasVal(getFieldValue(record, f, idx), f); });
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
            if (ARRAY_FIELDS.includes(f)) return renderEditableArrayItem(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) {
    return (<div className="cognitive-evaluations" ref={containerRef}><div className="document-header"><h2 className="document-title">Cognitive Evaluations</h2></div><div className="empty-state">No cognitive evaluation records available</div></div>);
  }

  return (
    <div className="cognitive-evaluations" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Cognitive Evaluations</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<CognitiveEvaluationsDocumentPDFTemplate document={pdfData} />} fileName="Cognitive_Evaluations.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search cognitive evaluations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <h3 className="record-name">{highlightText(`Cognitive Evaluation ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'screening-scores')}
            {renderMixedSection(record, idx, 'neuropsych-tests')}
            {renderMixedSection(record, idx, 'cognitive-indices')}
            {renderMixedSection(record, idx, 'functional-assessment')}
            {renderMixedSection(record, idx, 'memory-domains')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CognitiveEvaluationsDocument;
